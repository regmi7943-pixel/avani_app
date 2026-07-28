import os
import tempfile
import requests
import json
import re
from fastapi import FastAPI, HTTPException
import yt_dlp

app = FastAPI(title="Avani YouTube Audio & AI Analysis Microservice")

GROQ_API_KEY = os.getenv("GROQ_API_KEY", "")

@app.get("/ping")
def ping():
    """Health check endpoint for UptimeRobot keep-alive pings."""
    return {"status": "alive", "service": "Avani YouTube AI Service"}

@app.get("/extract-audio")
def extract_audio(url: str):
    """Returns direct audio stream URL and video metadata."""
    try:
        ydl_opts = {
            'format': 'bestaudio/best',
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

        # STEP 1: Download Audio with yt-dlp
        ydl_opts = {
            'format': 'bestaudio/best',
            'outtmpl': audio_path,
            'postprocessors': [{
                'key': 'FFmpegExtractAudio',
                'preferredcodec': 'mp3',
                'preferredquality': '128',
            }],
            'quiet': True,
        }

        try:
            with yt_dlp.YoutubeDL(ydl_opts) as ydl:
                info = ydl.extract_info(url, download=True)
                title = info.get('title', 'YouTube Video')
        except Exception as e:
            raise HTTPException(status_code=400, detail=f"yt-dlp audio extraction failed: {str(e)}")

        # STEP 2: Transcribe Spoken Audio with Groq Whisper API
        try:
            with open(audio_path, "rb") as audio_file:
                whisper_res = requests.post(
                    "https://api.groq.com/openai/v1/audio/transcriptions",
                    headers={"Authorization": f"Bearer {GROQ_API_KEY}"},
                    files={"file": ("audio.mp3", audio_file, "audio/mp3")},
                    data={"model": "whisper-large-v3-turbo", "response_format": "json"}
                )

            if whisper_res.status_code != 200:
                raise HTTPException(status_code=500, detail=f"Whisper Error: {whisper_res.text}")

            transcript = whisper_res.json().get("text", "")
        except Exception as e:
            raise HTTPException(status_code=500, detail=f"Speech transcription failed: {str(e)}")

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
                    "model": "llama-3.3-70b-versatile",
                    "messages": [{"role": "user", "content": prompt}],
                    "temperature": 0.2
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
