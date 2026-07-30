import os
import tempfile
import requests
import json
import re
from fastapi import FastAPI, HTTPException
from fastapi.responses import FileResponse
import yt_dlp

app = FastAPI(title="Avani YouTube Audio & AI Analysis Microservice")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

@app.api_route("/ping", methods=["GET", "HEAD", "POST", "OPTIONS"])
def ping():
    """Health check endpoint for UptimeRobot keep-alive pings."""
    return {"status": "alive", "service": "Avani YouTube AI Service"}

@app.api_route("/download-audio-file", methods=["GET", "HEAD"])
def download_audio_file(url: str):
    """Downloads audio via yt-dlp and serves the raw MP3 binary file directly."""
    temp_dir = tempfile.mkdtemp()

    try:
        opts = _get_ydl_opts(temp_dir)
        with yt_dlp.YoutubeDL(opts) as ydl:
            ydl.download([url])

        target_file = _find_audio_file(temp_dir)
        if target_file and os.path.exists(target_file):
            return FileResponse(target_file, media_type="audio/mpeg", filename="extracted_yt_audio.mp3")
    except Exception as e:
        print(f"[download-audio-file] Error: {e}")

    # Fallback sample
    fallback_sample = os.path.join(os.path.dirname(__file__), "sample_audio.mp3")
    if os.path.exists(fallback_sample):
        return FileResponse(fallback_sample, media_type="audio/mpeg", filename="extracted_yt_audio.mp3")

    raise HTTPException(status_code=404, detail="Audio file currently unavailable")

@app.get("/extract-audio")
def extract_audio(url: str):
    """Returns direct audio stream URL and video metadata."""
    try:
        cookie_path = os.path.join(os.path.dirname(__file__), "cookies.txt")
        ydl_opts = {
            'format': 'ba[ext=m4a]/ba/b',
            'http_headers': {'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Safari/537.36'},
            'quiet': True,
            'no_warnings': True,
        }
        if os.path.exists(cookie_path):
            ydl_opts['cookiefile'] = cookie_path

        with yt_dlp.YoutubeDL(ydl_opts) as ydl:
            info = ydl.extract_info(url, download=False)
            audio_url = info.get('url')
            title = info.get('title')
            duration = info.get('duration')

        return {
            "success": True,
            "title": title,
            "duration": duration,
            "audioUrl": audio_url
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=str(e))

def _get_ydl_opts(temp_dir: str, outtmpl_name: str = "audio") -> dict:
    """Shared yt-dlp config with all bot-bypass tricks."""
    cookie_path = os.path.join(os.path.dirname(__file__), "cookies.txt")
    opts = {
        'format': 'ba[ext=m4a]/ba/b',
        'outtmpl': os.path.join(temp_dir, outtmpl_name),
        'download_ranges': yt_dlp.utils.download_range_func(None, [(0, 180)]),
        # web_creator + mweb work with browser cookies (ios/android need OAuth tokens)
        'extractor_args': {'youtube': {'player_client': ['web_creator', 'mweb', 'web']}},
        'http_headers': {
            'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36',
        },
        'postprocessors': [{
            'key': 'FFmpegExtractAudio',
            'preferredcodec': 'mp3',
            'preferredquality': '64',
        }],
        'quiet': True,
        'no_warnings': True,
        'socket_timeout': 30,
    }
    if os.path.exists(cookie_path):
        opts['cookiefile'] = cookie_path
    return opts


def _find_audio_file(temp_dir: str, base_name: str = "audio") -> str | None:
    """Locate the downloaded audio file — yt-dlp may rename it."""
    expected = os.path.join(temp_dir, f"{base_name}.mp3")
    if os.path.exists(expected):
        return expected
    for f in os.listdir(temp_dir):
        if f.endswith(('.mp3', '.m4a', '.opus', '.webm')):
            return os.path.join(temp_dir, f)
    return None


@app.get("/debug-audio-download")
def debug_audio_download(url: str):
    """Diagnostic endpoint — shows exactly what yt-dlp does on this server."""
    temp_dir = tempfile.mkdtemp()
    result = {"url": url, "temp_dir": temp_dir, "success": False, "files": [], "error": None}

    opts = _get_ydl_opts(temp_dir)
    opts['quiet'] = False
    opts['verbose'] = True

    try:
        with yt_dlp.YoutubeDL(opts) as ydl:
            info = ydl.extract_info(url, download=True)
            result["title"] = info.get("title")
            result["duration"] = info.get("duration")
            result["format"] = info.get("format")
            result["success"] = True
    except Exception as e:
        result["error"] = str(e)

    result["files"] = []
    for f in os.listdir(temp_dir):
        fp = os.path.join(temp_dir, f)
        result["files"].append({"name": f, "size_bytes": os.path.getsize(fp)})

    audio = _find_audio_file(temp_dir)
    result["audio_found"] = audio is not None
    result["audio_path"] = audio

    return result


@app.get("/youtube-full-analysis")
def youtube_full_analysis(url: str):
    """
    1. Extracts YouTube audio using yt-dlp (with Android/iOS client bypass + cookies).
    2. Transcribes audio to text using Groq Whisper.
    3. Summarizes & extracts farming steps, dosage, and methods using Groq Llama 8B Instant.
    """
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is missing on server environment.")

    with tempfile.TemporaryDirectory() as temp_dir:
        title = "YouTube Video"
        transcript = ""

        # ──────────────────────────────────────────
        # STEP 1a: Extract video title via YouTube oEmbed API (always works, no auth needed)
        # ──────────────────────────────────────────
        try:
            oembed_res = requests.get(
                f"https://www.youtube.com/oembed?url={url}&format=json",
                timeout=10,
            )
            if oembed_res.ok:
                title = oembed_res.json().get("title", "YouTube Video")
                print(f"[STEP 1a OK] Got title via oEmbed: {title}")
        except Exception as e:
            print(f"[STEP 1a] oEmbed title extraction note: {e}")

        # ──────────────────────────────────────────
        # STEP 1b: Try to download audio (may fail on datacenter IPs)
        # ──────────────────────────────────────────
        opts = _get_ydl_opts(temp_dir)
        download_success = False
        try:
            with yt_dlp.YoutubeDL(opts) as ydl:
                ydl.download([url])
                download_success = True
                print(f"[STEP 1b OK] Downloaded audio for: {title}")
        except Exception as e:
            print(f"[STEP 1b SKIP] Audio download blocked (datacenter IP): {e}")

        audio_path = _find_audio_file(temp_dir)
        print(f"[STEP 1] Files in temp_dir: {os.listdir(temp_dir)}, audio_path={audio_path}")

        # ──────────────────────────────────────────
        # STEP 2: Transcribe with Groq Whisper
        # ──────────────────────────────────────────
        if download_success and audio_path and os.path.exists(audio_path):
            try:
                file_size = os.path.getsize(audio_path)
                print(f"[STEP 2] Sending {file_size} bytes to Groq Whisper...")
                with open(audio_path, "rb") as audio_file:
                    whisper_res = requests.post(
                        "https://api.groq.com/openai/v1/audio/transcriptions",
                        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                        files={"file": ("audio.mp3", audio_file, "audio/mp3")},
                        data={"model": "whisper-large-v3-turbo", "response_format": "json"},
                        timeout=60,
                    )
                if whisper_res.status_code == 200:
                    transcript = whisper_res.json().get("text", "")
                    print(f"[STEP 2 OK] Transcript length: {len(transcript)} chars")
                else:
                    print(f"[STEP 2 FAIL] Whisper HTTP {whisper_res.status_code}: {whisper_res.text[:300]}")
            except Exception as e:
                print(f"[STEP 2 FAIL] Whisper exception: {e}")

        # Fallback: YouTube TimedText captions API
        if not transcript:
            print("[STEP 2 FALLBACK] Trying YouTube TimedText API...")
            try:
                vid_id_match = re.search(r'(?:v=|\/)([0-9A-Za-z_-]{11})', url)
                if vid_id_match:
                    vid_id = vid_id_match.group(1)
                    watch_res = requests.get(
                        f"https://www.youtube.com/watch?v={vid_id}",
                        headers={"User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36"},
                        timeout=15,
                    )
                    if watch_res.ok and "captionTracks" in watch_res.text:
                        cap_match = re.search(r'https:\\/\\/www\.youtube\.com\\/api\\/timedtext[^\"]*', watch_res.text)
                        if cap_match:
                            sub_url = cap_match.group(0).replace(r'\u0026', '&').replace(r'\/', '/')
                            sub_url = sub_url if 'fmt=json3' in sub_url else f"{sub_url}&fmt=json3"
                            sub_res = requests.get(sub_url, timeout=15)
                            if sub_res.ok:
                                events = sub_res.json().get("events", [])
                                words = [s.get("utf8", "").strip() for ev in events for s in ev.get("segs", []) if s.get("utf8")]
                                transcript = " ".join([w for w in words if w])
                                print(f"[STEP 2 FALLBACK OK] TimedText transcript length: {len(transcript)}")
            except Exception as sub_err:
                print(f"[STEP 2 FALLBACK FAIL] TimedText error: {sub_err}")

        # ──────────────────────────────────────────
        # STEP 3: Groq Llama 70B Versatile — BLOCK ARCHITECT AI
        # ──────────────────────────────────────────
        prompt = f"""You are the Avani AI Block Architect for Nepali agriculture. Analyze this video and build a PERFECT content layout.

TITLE: "{title}"
TRANSCRIPT: "{transcript[:3000]}"

Your job: Pick 5-8 blocks and fill them with REAL content from the transcript.

AVAILABLE BLOCKS WITH SCHEMAS:

1. hero_summary (ALWAYS first):
   {{"type":"hero_summary","data":{{"title":"...","description":"2-3 sentence summary","badge":"CROP/LIVESTOCK/EQUIPMENT/DISEASE/BUSINESS/COMPOST/SUBSIDY","difficultyLevel":"Beginner/Intermediate/Advanced"}}}}

2. key_takeaways:
   {{"type":"key_takeaways","data":{{"title":"Key Takeaways","takeaways":[{{"point":"...","elaboration":"..."}}]}}}}

3. step_list:
   {{"type":"step_list","data":{{"title":"...","steps":[{{"stepNumber":1,"title":"...","description":"...","duration":"optional","warning":"optional"}}]}}}}

4. kv_table:
   {{"type":"kv_table","data":{{"tableName":"...","rows":[{{"key":"...","value":"...","unit":"optional"}}]}}}}

5. dosage_chart (ONLY for crop/pesticide videos):
   {{"type":"dosage_chart","data":{{"productName":"...","activeIngredient":"...","dosageRules":[{{"target":"...","dosagePerUnit":"...","waterRatio":"optional","applicationMethod":"...","safetyIntervalDays":7}}]}}}}

6. cost_breakdown:
   {{"type":"cost_breakdown","data":{{"currency":"NPR","items":[{{"category":"...","item":"...","quantity":1,"unitCost":500,"totalCost":500}}],"totalExpenditure":5000}}}}

7. breed_card (ONLY for livestock videos):
   {{"type":"breed_card","data":{{"breedName":"...","origin":"...","traits":["..."],"avgWeight":"...","bestFor":"...","dailyMilkYieldOrEggCount":"optional"}}}}

8. disease_card (ONLY for disease/pest videos):
   {{"type":"disease_card","data":{{"diseaseName":"...","affectedCropsOrAnimals":["..."],"symptoms":["..."],"cause":"...","organicTreatment":["..."],"chemicalTreatment":["..."],"prevention":["..."]}}}}

9. machine_specs (ONLY for equipment videos):
   {{"type":"machine_specs","data":{{"machineName":"...","manufacturer":"optional","horsepower":12,"fuelConsumptionLitersPerHour":"1.5","compatibleImplements":["..."],"idealOperationSpeedKmh":"2-4"}}}}

10. fertilizer_schedule:
    {{"type":"fertilizer_schedule","data":{{"cropName":"...","applications":[{{"growthStage":"...","fertilizerType":"...","dosagePerAcre":"...","applicationMethod":"..."}}]}}}}

11. compost_recipe (ONLY for organic/compost videos):
    {{"type":"compost_recipe","data":{{"compostType":"Hot Compost/Vermicomposting/Bokashi/Pit Compost","targetCnRatio":"25:1","brownsList":["..."],"greensList":["..."],"moistureTargetPercent":"60%","turningFrequencyDays":7,"readyInWeeks":8}}}}

12. subsidy_info (ONLY for government scheme videos):
    {{"type":"subsidy_info","data":{{"schemeName":"...","offeringAuthority":"...","subsidyPercentage":50,"eligibilityCriteria":["..."],"requiredDocuments":["..."]}}}}

13. business_plan_summary:
    {{"type":"business_plan_summary","data":{{"farmBusinessTitle":"...","targetMarket":"...","revenueStreams":["..."],"estimatedCapEx":"...","estimatedOpExAnnual":"...","breakevenTimelineMonths":12,"keyRisks":["..."]}}}}

14. pro_con_list:
    {{"type":"pro_con_list","data":{{"topic":"...","pros":["..."],"cons":["..."]}}}}

15. checklist:
    {{"type":"checklist","data":{{"title":"...","items":[{{"id":"1","label":"...","isOptional":false}}]}}}}

16. season_calendar:
    {{"type":"season_calendar","data":{{"cropName":"...","seasons":[{{"seasonName":"Spring/Summer/Monsoon/Winter","activities":["..."],"keyMilestones":["..."]}}]}}}}

17. growth_stages:
    {{"type":"growth_stages","data":{{"subjectName":"...","stages":[{{"stageNumber":1,"stageName":"...","durationDays":14,"keyIndicators":["..."],"careInstructions":"..."}}]}}}}

18. warning_box (safety alerts):
    {{"type":"warning_box","data":{{"title":"...","message":"...","hazardLevel":"Caution/Danger/Toxic","safetyGearRequired":["Gloves","Mask"]}}}}

19. tip_box (pro tips, ALWAYS use as last block):
    {{"type":"tip_box","data":{{"title":"Pro Tip","tip":"..."}}}}

20. metric_row (key stats):
    {{"type":"metric_row","data":{{"metrics":[{{"label":"...","value":"...","unit":"optional"}}]}}}}

21. bullet_insights:
    {{"type":"bullet_insights","data":{{"heading":"...","bullets":["point 1","point 2"]}}}}

22. do_dont_list:
    {{"type":"do_dont_list","data":{{"topic":"...","dos":["..."],"donts":["..."]}}}}

23. ingredient_list:
    {{"type":"ingredient_list","data":{{"recipeName":"...","yieldVolumeOrWeight":"...","ingredients":[{{"name":"...","quantity":"...","purpose":"optional"}}]}}}}

24. yield_estimate:
    {{"type":"yield_estimate","data":{{"cropName":"...","landArea":"Per Ropani","minExpectedYield":"...","maxExpectedYield":"...","averageYield":"...","factorsInfluencingYield":["..."]}}}}

25. comparison_table:
    {{"type":"comparison_table","data":{{"title":"...","headers":["Option A","Option B"],"rows":[{{"feature":"...","values":["...","..."]}}]}}}}

26. quote_highlight:
    {{"type":"quote_highlight","data":{{"quote":"...","speakerName":"...","speakerTitle":"optional"}}}}

27. fun_fact:
    {{"type":"fun_fact","data":{{"fact":"...","category":"optional","icon":"optional"}}}}

28. video_context:
    {{"type":"video_context","data":{{"region":"...","climateZone":"...","season":"...","farmingType":"...","targetCropsOrLivestock":["..."]}}}}

29. narrator_note:
    {{"type":"narrator_note","data":{{"note":"...","importance":"low/medium/high/critical","authorName":"optional"}}}}

30. audio_snippet_transcript:
    {{"type":"audio_snippet_transcript","data":{{"speaker":"...","startTime":"...","endTime":"...","transcriptText":"..."}}}}

31. numbered_process:
    {{"type":"numbered_process","data":{{"processName":"...","totalPhases":3,"phases":[{{"phaseIndex":1,"name":"...","description":"...","estimatedDays":14}}]}}}}

32. quick_steps:
    {{"type":"quick_steps","data":{{"title":"...","summary":"...","actions":["action 1","action 2"]}}}}

33. decision_tree:
    {{"type":"decision_tree","data":{{"rootQuestion":"...","nodes":[{{"id":"1","condition":"...","outcomeIfTrue":"...","outcomeIfFalse":"..."}}]}}}}

34. flowchart_steps:
    {{"type":"flowchart_steps","data":{{"workflowName":"...","nodes":[{{"id":"1","label":"...","type":"start/process/decision/end","notes":"optional"}}]}}}}

35. troubleshooting_steps:
    {{"type":"troubleshooting_steps","data":{{"issueCategory":"...","troubleshootingGrid":[{{"symptom":"...","probableCause":"...","solution":"...","urgency":"low/moderate/urgent"}}]}}}}

36. nutrient_table:
    {{"type":"nutrient_table","data":{{"materialName":"...","nitrogenPercent":2.5,"phosphorusPercent":1.2,"potassiumPercent":1.8,"organicMatterPercent":25,"micronutrients":[{{"name":"Zinc","ppmOrPercent":"50ppm"}}]}}}}

37. roi_calculator:
    {{"type":"roi_calculator","data":{{"investmentName":"...","currency":"NPR","initialInvestment":50000,"expectedRevenue":120000,"estimatedOperationalCost":30000,"netProfit":40000,"paybackPeriodMonths":8,"roiPercentage":80}}}}

38. measurement_specs:
    {{"type":"measurement_specs","data":{{"title":"...","measurements":[{{"parameter":"...","value":"...","optimalRange":"optional","unit":"cm/kg/L"}}]}}}}

39. soil_test_report:
    {{"type":"soil_test_report","data":{{"sampleLocation":"...","phLevel":6.5,"ecValue":0.8,"organicCarbonPercent":1.2,"nitrogenStatus":"Low/Medium/High","phosphorusStatus":"Low/Medium/High","potassiumStatus":"Low/Medium/High","recommendations":["..."]}}}}

40. feed_conversion_ratio (ONLY for livestock):
    {{"type":"feed_conversion_ratio","data":{{"animalType":"...","fcrRatio":2.5,"feedConsumedKg":100,"weightGainedKg":40,"periodDays":90,"benchmarks":"..."}}}}

41. faq_list:
    {{"type":"faq_list","data":{{"faqs":[{{"question":"...","answer":"..."}}]}}}}

42. tool_list:
    {{"type":"tool_list","data":{{"category":"...","tools":[{{"name":"...","isEssential":true,"estimatedCostRange":"optional","alternative":"optional"}}]}}}}

43. requirement_list:
    {{"type":"requirement_list","data":{{"title":"...","requirements":[{{"name":"...","type":"climate/water/soil/legal/capital","isMandatory":true,"description":"..."}}]}}}}

44. organic_cert_checklist:
    {{"type":"organic_cert_checklist","data":{{"standardName":"...","criteria":[{{"rule":"...","complianceMethod":"...","prohibitedInputs":["..."]}}]}}}}

45. timeline:
    {{"type":"timeline","data":{{"title":"...","events":[{{"dateOrPeriod":"...","title":"...","description":"..."}}]}}}}

46. monthly_planner:
    {{"type":"monthly_planner","data":{{"months":[{{"month":"Baishakh/Jestha/etc","primaryTasks":["..."],"secondaryTasks":["optional"]}}]}}}}

47. harvest_schedule:
    {{"type":"harvest_schedule","data":{{"cropName":"...","firstHarvestDays":90,"harvestWindowDays":30,"maturityIndicators":["..."],"postHarvestStorageDays":14,"idealStorageTemp":"15-20°C"}}}}

48. gestation_timeline (ONLY for livestock breeding):
    {{"type":"gestation_timeline","data":{{"animalSpecies":"...","gestationDaysAvg":150,"keyMilestones":[{{"dayOrWeek":"...","event":"...","careRequired":"..."}}]}}}}

49. pest_identification:
    {{"type":"pest_identification","data":{{"pestName":"...","scientificName":"optional","damageType":"...","identifyingFeatures":["..."],"naturalPredators":["..."],"controlThreshold":"...","recommendedControl":["..."]}}}}

50. soil_profile:
    {{"type":"soil_profile","data":{{"soilType":"Clay/Sandy/Loam/Silt","drainageQuality":"Poor/Moderate/Good/Excessive","idealPhRange":"...","suitableCrops":["..."],"improvementTips":["..."]}}}}

51. irrigation_plan:
    {{"type":"irrigation_plan","data":{{"systemType":"Drip/Sprinkler/Flood/Subsurface/Rainfed","waterRequirementLitersPerDay":500,"wateringFrequency":"...","bestTimeOfDay":"...","moistureMonitoringTip":"..."}}}}

52. seed_variety:
    {{"type":"seed_variety","data":{{"varietyName":"...","type":"Heirloom/Hybrid (F1)/Open-Pollinated","daysToMaturity":90,"diseaseResistance":["..."],"yieldPotential":"...","seedRatePerAcre":"..."}}}}

53. spray_timing:
    {{"type":"spray_timing","data":{{"targetPestOrDisease":"...","idealWindSpeedKmh":"<10","idealTempRangeC":"20-30","rainfastHours":4,"recommendedTimeOfDay":"Early Morning/Late Afternoon/Night","ppeRequired":["Gloves","Mask"]}}}}

54. weather_advisory:
    {{"type":"weather_advisory","data":{{"alertLevel":"Info/Warning/Severe/Critical","weatherCondition":"...","affectedOperations":["..."],"protectiveMeasures":["..."],"validPeriod":"..."}}}}

55. aquaponics_setup:
    {{"type":"aquaponics_setup","data":{{"fishSpecies":"...","cropSpecies":["..."],"phTarget":7.0,"waterTempRangeC":"22-28","stockingDensityKgPerLiter":"..."}}}}

56. apiculture_hive_card (ONLY for beekeeping):
    {{"type":"apiculture_hive_card","data":{{"queenStatus":"Spotted/Eggs Present/Queenless/Virgin Queen","temperament":"Calm/Aggressive/Moderate","broodPattern":"Solid/Spotty/Low","honeyStores":"Low/Medium/High","diseaseOrParasiteObserved":["..."],"actionTaken":"..."}}}}

57. mushroom_flushing_card (ONLY for mushroom cultivation):
    {{"type":"mushroom_flushing_card","data":{{"mushroomVariety":"...","substrateType":"...","incubationTempC":"22-25","fruitingTempC":"15-20","relativeHumidityPercent":"85-95%","expectedFlushes":4}}}}

58. weed_identification:
    {{"type":"weed_identification","data":{{"weedName":"...","category":"Broadleaf/Grassy/Sedge","reproductionMethod":"...","competesWithCrops":["..."],"controlMethods":["..."]}}}}

59. pruning_guide:
    {{"type":"pruning_guide","data":{{"plantType":"...","bestSeason":"...","toolRequired":"...","targetShape":"...","pruningSteps":["..."],"postPruningCare":"..."}}}}

60. maintenance_checklist:
    {{"type":"maintenance_checklist","data":{{"equipmentName":"...","intervalHoursOrMonths":"...","tasks":[{{"component":"...","action":"Check/Clean/Replace/Grease/Calibrate","specification":"optional"}}]}}}}

61. market_price:
    {{"type":"market_price","data":{{"commodityName":"...","marketName":"...","pricePerUnit":"...","currency":"NPR","priceTrend":"Up/Down/Stable","dateUpdated":"...","qualityGrade":"..."}}}}

62. investment_table:
    {{"type":"investment_table","data":{{"currency":"NPR","capexItems":[{{"item":"...","cost":10000}}],"opexItems":[{{"item":"...","annualCost":5000}}],"totalInitialCapitalRequired":50000}}}}

63. loan_calculator:
    {{"type":"loan_calculator","data":{{"loanSchemeName":"...","principalAmount":100000,"annualInterestRatePercent":8,"tenureYears":5,"estimatedMonthlyEmi":2000,"totalInterestPayable":20000}}}}

64. success_box:
    {{"type":"success_box","data":{{"title":"...","achievement":"...","metric":"optional"}}}}

65. info_box:
    {{"type":"info_box","data":{{"title":"optional","content":"..."}}}}

66. stat_highlight:
    {{"type":"stat_highlight","data":{{"bigStat":"...","statLabel":"...","subtext":"optional","accentColor":"optional"}}}}

67. badge_row:
    {{"type":"badge_row","data":{{"badges":[{{"label":"...","variant":"success/warning/info/neutral"}}]}}}}

68. separator:
    {{"type":"separator","data":{{"label":"optional","style":"solid/dashed/dotted"}}}}

RULES:
- ALWAYS start with hero_summary
- ALWAYS end with tip_box or warning_box
- Pick 5-8 blocks total
- For CROP videos: hero_summary + step_list + fertilizer_schedule or dosage_chart + yield_estimate or season_calendar + tip_box
- For LIVESTOCK: hero_summary + breed_card + cost_breakdown + checklist + tip_box
- For DISEASE/PEST: hero_summary + disease_card + dosage_chart + do_dont_list + warning_box
- For EQUIPMENT: hero_summary + machine_specs + pro_con_list + cost_breakdown + tip_box
- For BUSINESS: hero_summary + business_plan_summary + cost_breakdown + metric_row + tip_box
- For COMPOST/ORGANIC: hero_summary + compost_recipe or ingredient_list + step_list + tip_box
- For SUBSIDY: hero_summary + subsidy_info + checklist + tip_box
- For BEEKEEPING: hero_summary + apiculture_hive_card + season_calendar + checklist + tip_box
- For MUSHROOM: hero_summary + mushroom_flushing_card + step_list + ingredient_list + tip_box
- For AQUAPONICS/FISH: hero_summary + aquaponics_setup + cost_breakdown + step_list + tip_box
- For SOIL TESTING: hero_summary + soil_test_report + soil_profile + requirement_list + tip_box
- For MARKET PRICES: hero_summary + market_price + comparison_table + metric_row + tip_box
- For PRUNING/GRAFTING: hero_summary + pruning_guide + growth_stages + tool_list + tip_box
- NEVER use dosage_chart for livestock
- NEVER use breed_card for crops
- Fill ALL data fields with REAL content from the transcript. Use Nepali farming units (ropani, muri, kg).
Generate ALL content in ENGLISH ONLY. Do not use any Nepali or Hindi text.

Return ONLY this JSON:
{{"blocks":[...array of block objects...]}}
No markdown. No explanation. Raw JSON only."""


        try:
            print("[STEP 3] Sending to Groq Llama 70B Block Architect...")
            llm_res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.15,
                    "max_tokens": 2500
                },
                timeout=30,
            )

            if llm_res.status_code != 200:
                raise HTTPException(status_code=500, detail=f"LLM Error: {llm_res.text}")

            llm_json = llm_res.json()
            raw_content = llm_json["choices"][0]["message"]["content"]

            json_match = re.search(r'\{[\s\S]*\}', raw_content)
            parsed_analysis = json.loads(json_match.group(0)) if json_match else {"rawText": raw_content}

            print(f"[STEP 3 OK] Analysis complete for: {title}")

            # STEP 4: Translate blocks to Nepali using second 70B call
            nepali_blocks = None
            try:
                translate_prompt = f"""Translate this JSON to Nepali. Keep all JSON keys in English. Only translate the string VALUES to Nepali (नेपाली). Keep numbers, dates, and technical terms (like chemical names, NPR, kg) as-is.

Input JSON:
{json.dumps(parsed_analysis)}

Return the SAME JSON structure with all string values translated to Nepali. Raw JSON only, no markdown."""

                translate_res = requests.post(
                    "https://api.groq.com/openai/v1/chat/completions",
                    headers={
                        "Authorization": f"Bearer {GROQ_API_KEY}",
                        "Content-Type": "application/json"
                    },
                    json={
                        "model": "llama-3.3-70b-versatile",
                        "messages": [{"role": "user", "content": translate_prompt}],
                        "temperature": 0.1,
                        "max_tokens": 2500
                    },
                    timeout=30,
                )

                if translate_res.status_code == 200:
                    translate_json = translate_res.json()
                    translate_content = translate_json["choices"][0]["message"]["content"]
                    translate_match = re.search(r'\{[\s\S]*\}', translate_content)
                    if translate_match:
                        nepali_blocks = json.loads(translate_match.group(0))
                        print(f"[STEP 4 OK] Nepali translation complete for: {title}")
            except Exception as translate_err:
                print(f"[STEP 4 WARN] Nepali translation failed, serving English only: {translate_err}")

            return {
                "success": True,
                "transcript": transcript,
                "analysis": parsed_analysis,
                "analysis_ne": nepali_blocks
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"LLM Summarization failed: {str(e)}")
