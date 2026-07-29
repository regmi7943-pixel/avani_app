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
        # STEP 3: Groq Llama 8B Instant — BLOCK ARCHITECT AI
        # ──────────────────────────────────────────
        prompt = f"""You are the Avani AI Block Architect. Your job: analyze a YouTube farming video and pick the PERFECT UI blocks to display.

TITLE: "{title}"
TRANSCRIPT (first 3000 chars): "{transcript[:3000]}"

STEP 1 — REASON: Think about what this video teaches. What does a Nepali farmer NEED from this video? Is it a crop guide? Livestock? Business plan? Disease cure? Equipment?

STEP 2 — PICK BLOCKS: Choose 5-8 blocks from this palette. ONLY pick blocks that are genuinely useful for THIS video. Never pad with irrelevant blocks.

AVAILABLE BLOCKS (68 types):
CONTENT: hero_summary, quote_highlight, fun_fact, video_context, narrator_note, key_takeaways, audio_snippet_transcript
STEPS: step_list, numbered_process, quick_steps, decision_tree, flowchart_steps, troubleshooting_steps
DATA: kv_table, comparison_table, dosage_chart, nutrient_table, cost_breakdown, roi_calculator, yield_estimate, measurement_specs, soil_test_report, feed_conversion_ratio
LISTS: bullet_insights, checklist, pro_con_list, faq_list, do_dont_list, ingredient_list, tool_list, requirement_list, organic_cert_checklist
TIMELINE: timeline, season_calendar, growth_stages, monthly_planner, harvest_schedule, gestation_timeline
AGRICULTURE: breed_card, disease_card, pest_identification, soil_profile, irrigation_plan, seed_variety, fertilizer_schedule, spray_timing, weather_advisory, compost_recipe, aquaponics_setup, apiculture_hive_card, mushroom_flushing_card, weed_identification, pruning_guide
BUSINESS: machine_specs, maintenance_checklist, market_price, subsidy_info, business_plan_summary, investment_table, loan_calculator
ALERTS: warning_box, tip_box, success_box, info_box, metric_row, stat_highlight, badge_row, separator

RULES:
- ALWAYS start with hero_summary as the first block
- For crop videos: use step_list, dosage_chart, fertilizer_schedule, season_calendar, yield_estimate, warning_box
- For livestock: use breed_card, feed_conversion_ratio, gestation_timeline, cost_breakdown, checklist
- For disease/pest: use disease_card OR pest_identification, spray_timing, dosage_chart, do_dont_list
- For equipment: use machine_specs, pro_con_list, maintenance_checklist, cost_breakdown
- For business: use business_plan_summary, investment_table, roi_calculator, timeline
- For compost/organic: use compost_recipe OR ingredient_list, step_list, tip_box
- For subsidy: use subsidy_info, checklist, requirement_list
- NEVER use dosage_chart for livestock videos
- NEVER use breed_card for crop videos
- End with either tip_box or warning_box

OUTPUT FORMAT — Return ONLY this JSON (no markdown, no explanation):
{{
  "blocks": [
    {{
      "type": "hero_summary",
      "data": {{
        "title": "Video title summary",
        "description": "2-3 sentence video summary for Nepali farmers",
        "badge": "CROP_TUTORIAL or LIVESTOCK or EQUIPMENT etc",
        "difficultyLevel": "Beginner/Intermediate/Advanced"
      }}
    }},
    ... more blocks with their data filled ...
  ]
}}

Fill each block's data fields with REAL content from the video transcript. Use practical Nepali farming units (ropani, muri, kg).
Return raw JSON ONLY. No markdown wrappers."""


        try:
            print("[STEP 3] Sending to Groq Llama 8B Instant...")
            llm_res = requests.post(
                "https://api.groq.com/openai/v1/chat/completions",
                headers={
                    "Authorization": f"Bearer {GROQ_API_KEY}",
                    "Content-Type": "application/json"
                },
                json={
                    "model": "llama-3.1-8b-instant",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.1
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
            return {
                "success": True,
                "transcript": transcript,
                "analysis": parsed_analysis
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"LLM Summarization failed: {str(e)}")
