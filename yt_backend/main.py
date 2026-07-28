import os
import tempfile
import requests
import json
import re
from fastapi import FastAPI, HTTPException
import yt_dlp

app = FastAPI(title="Avani YouTube Audio & AI Analysis Microservice")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

@app.api_route("/ping", methods=["GET", "HEAD", "POST", "OPTIONS"])
def ping():
    """Health check endpoint for UptimeRobot keep-alive pings."""
    return {"status": "alive", "service": "Avani YouTube AI Service"}

@app.get("/extract-audio")
def extract_audio(url: str):
    """Returns direct audio stream URL and video metadata."""
    try:
        ydl_opts = {
            'format': 'ba[ext=m4a]/ba/b',
            'extractor_args': {'youtube': {'player_client': ['android', 'ios']}},
            'http_headers': {'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11; US) gzip'},
            'quiet': True,
            'no_warnings': True,
        }
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

@app.get("/youtube-full-analysis")
def youtube_full_analysis(url: str):
    """
    1. Extracts YouTube audio using yt-dlp.
    2. Transcribes audio to text using Groq Whisper.
    3. Summarizes & extracts farming steps, dosage, and methods using Groq Llama-3.3-70B.
    """
    if not GROQ_API_KEY:
        raise HTTPException(status_code=500, detail="GROQ_API_KEY is missing on server environment.")

    with tempfile.TemporaryDirectory() as temp_dir:
        audio_path = os.path.join(temp_dir, "audio.mp3")

        title = "YouTube Video"
        transcript = ""

        # STEP 1: Download Audio with yt-dlp (Using Android/iOS client bypass)
        ydl_opts = {
            'format': 'ba[ext=m4a]/ba/b',
            'outtmpl': audio_path,
            'download_ranges': yt_dlp.utils.download_range_func(None, [(0, 180)]),
            'extractor_args': {'youtube': {'player_client': ['android', 'ios', 'web_creator']}},
            'http_headers': {'User-Agent': 'com.google.android.youtube/19.09.37 (Linux; U; Android 11; US) gzip'},
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '64',
            }],
            'quiet': True,
        }

        download_success = False
        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                title = info.get('title', 'YouTube Video')
                download_success = True
        except Exception as e:
            print(f"Audio download notice: {e}. Attempting TimedText transcript fallback...")

        # STEP 2: Transcribe Spoken Audio with Groq Whisper API (or TimedText fallback)
        if download_success and os.path.exists(audio_path):
            try:
                with open(audio_path, "rb") as audio_file:
                    whisper_res = requests.post(
                        "https://api.groq.com/openai/v1/audio/transcriptions",
                        headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                        files={"file": ("audio.mp3", audio_file, "audio/mp3")},
                        data={"model": "whisper-large-v3-turbo", "response_format": "json"}
                    )

                if whisper_res.status_code == 200:
                    transcript = whisper_res.json().get("text", "")
            except Exception as e:
                print(f"Whisper transcription notice: {e}")

        # Fallback to TimedText API if audio stream was restricted
        if not transcript:
            try:
                vid_id_match = re.search(r'(?:v=|\/)([0-9A-Za-z_-]{11})', url)
                if vid_id_match:
                    vid_id = vid_id_match.group(1)
                    watch_res = requests.get(f"https://www.youtube.com/watch?v={vid_id}", headers={"User-Agent": "Mozilla/5.0"})
                    if watch_res.ok and "captionTracks" in watch_res.text:
                        match = re.search(r'https:\\\/\\\/www\.youtube\.com\\\/api\\\/timedtext[^\"]*', watch_res.text)
                        if match:
                            sub_url = match.group(0).replace(r'\u0026', '&').replace(r'\/', '/')
                            sub_url = sub_url if 'fmt=json3' in sub_url else f"{sub_url}&fmt=json3"
                            sub_res = requests.get(sub_url)
                            if sub_res.ok:
                                events = sub_res.json().get("events", [])
                                words = [s.get("utf8", "").strip() for e in events for s in e.get("segs", []) if s.get("utf8")]
                                transcript = " ".join([w for w in words if w])
            except Exception as sub_err:
                print(f"TimedText fallback notice: {sub_err}")

        # STEP 3: Summarize & Extract Methods with Groq Llama-3.3-70B
        prompt = f"""You are Avani AI's Master Agronomist.
Analyze this YouTube video title and transcript:
Title: "{title}"
Transcript: "{transcript[:3000]}"

Generate a structured agronomic summary and step-by-step method in JSON format:
{{
  "title": "{title}",
  "summaryEn": "Detailed 2-sentence summary of what this video teaches in English.",
  "summaryNe": "यस भिडियोले सिकाउने विस्तृत २-वाक्यको सारांश (नेपालीमा)।",
  "stepsEn": [
    "Step 1: Land prep / seed selection method...",
    "Step 2: Planting / spacing method...",
    "Step 3: Fertilizer / irrigation method...",
    "Step 4: Pest control / harvesting method..."
  ],
  "stepsNe": [
    "पाइला १: माटो तयारी र बीउ छनोट...",
    "पाइला २: रोप्ने तरिका र दुरी...",
    "पाइला ३: मल र सिँचाइ तरिका...",
    "पाइला ४: रोग र कीरा नियन्त्रण..."
  ],
  "dosageTable": {{
    "unit": "Per Ropani / Per Plant",
    "basalEn": "Basal fertilizer dosage taught...",
    "basalNe": "आधार मल परिमाण (नेपालीमा)...",
    "topDressEn": "Top-dressing schedule...",
    "topDressNe": "थप मल परिमाण (नेपालीमा)...",
    "sprayEn": "Pesticide/fungicide spray recommended...",
    "sprayNe": "विषादी स्प्रे परिमाण (नेपालीमा)..."
  }},
  "precautionsEn": ["Precaution 1...", "Precaution 2..."],
  "precautionsNe": ["सावधानी १...", "सावधानी २..."]
}}
Return raw JSON ONLY. No markdown wrappers.
"""

        try:
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
                }
            )

            if llm_res.status_code != 200:
                raise HTTPException(status_code=500, detail=f"LLM Error: {llm_res.text}")

            llm_json = llm_res.json()
            raw_content = llm_json["choices"][0]["message"]["content"]
            
            match = re.search(r'\{[\s\S]*\}', raw_content)
            parsed_analysis = json.loads(match.group(0)) if match else {"rawText": raw_content}

            return {
                "success": True,
                "transcript": transcript,
                "analysis": parsed_analysis
            }
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"LLM Summarization failed: {str(e)}")
