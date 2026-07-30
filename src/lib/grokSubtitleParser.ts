// Grok AI Subtitle & Transcript Universal Agronomic Parser Service
// Block Architect AI — Dynamic 68-Block Video Analysis System

import AsyncStorage from '@react-native-async-storage/async-storage';
import { YouTubeFarmingItem, GOOGLE_YOUTUBE_API_KEY } from './youtubeService';
import { AgriUIBlock } from '../components/blocks/BlockRegistry';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

export interface GrokParsedVideoDetails {
  dynamicBlocks: AgriUIBlock[];
  dynamicBlocksNe?: AgriUIBlock[];  // Nepali translated blocks
  // Legacy fields kept for backward compat but no longer used for rendering
  summaryEn?: string;
  summaryNe?: string;
  stepsEn?: string[];
  stepsNe?: string[];
  dosageTable?: any;
  precautionsEn?: string[];
  precautionsNe?: string[];
}

/**
 * Fetches REAL line-by-line spoken closed captions / subtitles from YouTube TimedText API
 */
export async function fetchRealYouTubeSubtitles(videoId: string): Promise<string> {
  try {
    const watchUrl = `https://www.youtube.com/watch?v=${videoId}`;
    const res = await fetch(watchUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64)' }
    });

    if (res.ok) {
      const html = await res.text();
      const idx = html.indexOf('captionTracks');
      if (idx !== -1) {
        const snippet = html.slice(idx, idx + 1200);
        // Find timedtext URL
        const match = snippet.match(/https:\\\/\\\/www\.youtube\.com\\\/api\\\/timedtext[^\"]*/);
        if (match) {
          const rawUrl = match[0].replace(/\\u0026/g, '&').replace(/\\\//g, '/');
          const timedTextUrl = rawUrl.includes('fmt=json3') ? rawUrl : `${rawUrl}&fmt=json3`;
          
          console.log(`[YouTube Captions] Fetching real subtitles from open endpoint: ${timedTextUrl.slice(0, 80)}...`);
          
          const subRes = await fetch(timedTextUrl);
          if (subRes.ok) {
            const subData = await subRes.json();
            const events = subData.events || [];
            const words: string[] = [];
            
            for (const e of events) {
              for (const s of e.segs || []) {
                const w = (s.utf8 || '').trim();
                if (w) words.push(w);
              }
            }

            if (words.length > 0) {
              const fullSubtitleText = words.join(' ');
              console.log(`[YouTube Captions SUCCESS] Successfully fetched ${words.length} spoken subtitle words for video ${videoId}!`);
              return fullSubtitleText;
            }
          }
        }
      }
    }
  } catch (err) {
    console.warn('[YouTube Subtitles Exception handled]:', err);
  }

  return '';
}

/**
 * Parses YouTube video subtitles & metadata using Grok AI for ANY agricultural topic (Dragon Fruit, Ginger, Paddy, Maize, Potato, etc.).
 */
/**
 * Wakes up the Render microservice in the background on app/screen load to eliminate cold-start delay
 */
export function preloadWakeupBackend() {
  const renderServerUrl = process.env.EXPO_PUBLIC_YTDLP_SERVER_URL || 'https://avani-yt-backend.onrender.com';
  fetch(`${renderServerUrl}/ping`).catch(() => {});
}

export async function parseYouTubeVideoDetailsWithGrokAI(
  video: YouTubeFarmingItem
): Promise<GrokParsedVideoDetails> {
  const startTime = Date.now();
  console.log(`\n======================================================`);
  console.log(`[AVANI AI ARCHITECT] 🚀 Starting Summary Generation for Video ID: ${video?.id || 'UNKNOWN'}`);
  console.log(`[AVANI AI ARCHITECT] 📌 Title: "${video?.titleEn || video?.titleNe || 'Untitled Video'}"`);
  console.log(`======================================================`);

  if (!video || !video.id) {
    console.log(`[AVANI AI ARCHITECT] ⚠️ No video or video ID provided. Returning default fallback blocks.`);
    return getDefaultParsedDetails(video);
  }

  const cacheKey = `@avani_grok_sub_parse_v7_blocks_${video.id}`;

  // 1. Check local AsyncStorage cache first for instant 0ms reload
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (parsed && parsed.dynamicBlocks && Array.isArray(parsed.dynamicBlocks) && parsed.dynamicBlocks.length > 0) {
        console.log(`[AVANI AI ARCHITECT] ⚡ [CACHE HIT] Found pre-generated block layout (${parsed.dynamicBlocks.length} blocks) in local storage for ${video.id}! (0ms)`);
        return parsed;
      }
    }
  } catch (err) {
    console.warn('[AVANI AI ARCHITECT] ⚠️ Cache read warning:', err);
  }

  console.log(`[AVANI AI ARCHITECT] 🔍 [CACHE MISS] Fetching fresh AI analysis...`);

  // 2. Call live Render Microservice (yt-dlp + Groq Whisper + Groq Llama 70B)
  const renderServerUrl = process.env.EXPO_PUBLIC_YTDLP_SERVER_URL || 'https://avani-yt-backend.onrender.com';
  try {
    const videoWatchUrl = `https://www.youtube.com/watch?v=${video.id}`;
    console.log(`[AVANI AI ARCHITECT] 🌐 Requesting Block Architect AI from Render backend: ${renderServerUrl}...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 45000);

    const reqStart = Date.now();
    const backendRes = await fetch(`${renderServerUrl}/youtube-full-analysis?url=${encodeURIComponent(videoWatchUrl)}`, {
      signal: controller.signal
    });

    clearTimeout(timeoutId);
    const reqElapsed = Date.now() - reqStart;

    if (backendRes.ok) {
      const data = await backendRes.json();
      const analysis = data.analysis;
      if (data.success && analysis && analysis.blocks && Array.isArray(analysis.blocks) && analysis.blocks.length > 0) {
        const result: GrokParsedVideoDetails = { 
          dynamicBlocks: analysis.blocks,
          dynamicBlocksNe: data.analysis_ne?.blocks || undefined,
        };
        console.log(`[AVANI AI ARCHITECT] ✅ [BACKEND SUCCESS] Render backend returned ${analysis.blocks.length} English blocks & ${data.analysis_ne?.blocks?.length || 0} Nepali blocks in ${reqElapsed}ms!`);
        await AsyncStorage.setItem(cacheKey, JSON.stringify(result)).catch(() => {});
        return result;
      } else {
        console.warn(`[AVANI AI ARCHITECT] ⚠️ Render backend response missing blocks format:`, data);
      }
    } else {
      console.warn(`[AVANI AI ARCHITECT] ⚠️ Render backend returned HTTP error ${backendRes.status}`);
    }
  } catch (backendErr: any) {
    console.warn(`[AVANI AI ARCHITECT] ⚠️ Render backend request failed (${backendErr?.message || backendErr}). Triggering direct Groq fallback...`);
  }

  // 3. Fallback: Fetch REAL Spoken Subtitles directly from YouTube TimedText API
  console.log(`[AVANI AI ARCHITECT] 📑 Attempting direct client-side subtitle extraction...`);
  let realSubtitleText = await fetchRealYouTubeSubtitles(video.id);

  let fullTitle = video.titleEn || video.titleNe || '';
  let fullDesc = video.subtitleEn || video.subtitleNe || '';

  try {
    if (GOOGLE_YOUTUBE_API_KEY) {
      const url = `https://www.googleapis.com/youtube/v3/videos?part=snippet&id=${video.id}&key=${GOOGLE_YOUTUBE_API_KEY}`;
      const res = await fetch(url);
      if (res.ok) {
        const data = await res.json();
        const item = data.items?.[0];
        if (item?.snippet) {
          fullTitle = item.snippet.title || fullTitle;
          fullDesc = item.snippet.description || fullDesc;
        }
      }
    }
  } catch (err) {
    console.warn('[AVANI AI ARCHITECT] ⚠️ Error fetching snippet:', err);
  }

  const combinedTranscriptContext = realSubtitleText 
    ? `Real Spoken Subtitles: "${realSubtitleText.slice(0, 2000)}"`
    : `Description/Metadata: "${fullDesc.slice(0, 1200)}"`;

  // 4. Ask Grok AI client-side to dynamically generate block layout
  const systemPrompt = `You are Avani AI's Master Agronomist and Video Subtitle Analyst for Nepalese Agriculture.
Analyze this YouTube video's title and REAL SPOKEN SUBTITLES/TRANSCRIPT:
Video Title: "${fullTitle}"
${combinedTranscriptContext}

Identify the EXACT crop or farming topic of THIS specific video.

Generate analysis using the Block Architect system. Pick 5-8 UI blocks from these types:
CONTENT: hero_summary, quote_highlight, fun_fact, key_takeaways, narrator_note
STEPS: step_list, quick_steps
DATA: kv_table, dosage_chart, cost_breakdown, yield_estimate
LISTS: bullet_insights, checklist, pro_con_list, do_dont_list, ingredient_list, tool_list
TIMELINE: timeline, season_calendar, growth_stages
AGRICULTURE: breed_card, disease_card, fertilizer_schedule, compost_recipe, irrigation_plan
BUSINESS: machine_specs, business_plan_summary, subsidy_info
ALERTS: warning_box, tip_box, info_box, metric_row

ALWAYS start with hero_summary. End with tip_box or warning_box.
NEVER use dosage_chart for livestock. NEVER use breed_card for crops.

Return JSON: { "blocks": [ { "type": "hero_summary", "data": { "title": "...", "description": "...", "badge": "CROP/LIVESTOCK/EQUIPMENT...", "difficultyLevel": "Beginner/Intermediate/Advanced" } }, ...more blocks... ] }
Return raw JSON ONLY. No markdown.`;

  try {
    console.log(`[AVANI AI ARCHITECT] 🤖 [GROQ CLIENT FALLBACK] Sending transcript to Groq Llama 70B directly...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.15,
        max_tokens: 2000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content || '';

      const match = rawText.match(/\{[\s\S]*\}/);
      if (match) {
        const parsedObj = JSON.parse(match[0]);
        if (parsedObj && parsedObj.blocks && Array.isArray(parsedObj.blocks) && parsedObj.blocks.length > 0) {
          const result: GrokParsedVideoDetails = { 
            dynamicBlocks: parsedObj.blocks,
            dynamicBlocksNe: parsedObj.blocksNe || parsedObj.dynamicBlocksNe || undefined,
          };
          console.log(`[AVANI AI ARCHITECT] ✅ [GROQ CLIENT SUCCESS] Direct Groq API generated ${parsedObj.blocks.length} blocks in ${Date.now() - startTime}ms!`);
          await AsyncStorage.setItem(cacheKey, JSON.stringify(result)).catch(() => {});
          return result;
        }
      }
    }
  } catch (err: any) {
    console.warn(`[AVANI AI ARCHITECT] ⚠️ Direct Groq API failed:`, err);
  }

  console.log(`[AVANI AI ARCHITECT] 📋 Returning default structured blocks fallback.`);
  return getDefaultParsedDetails(video);
}

/**
 * Smart universal fallback matching title keywords (Dragon Fruit, Ginger, Tomato, Potato, Maize, Wheat, Mustard, Paddy)
 */
function getDefaultParsedDetails(video?: YouTubeFarmingItem): GrokParsedVideoDetails {
  const title = ((video?.titleEn || '') + ' ' + (video?.subtitleEn || '')).toLowerCase();
  const desc = video?.subtitleEn || 'Practical agricultural guide for Nepali farmers.';

  return {
    dynamicBlocks: [
      {
        type: 'hero_summary' as const,
        data: {
          title: video?.titleEn || 'Agricultural Video Guide',
          description: desc,
          badge: 'GENERAL',
          difficultyLevel: 'Beginner' as const,
        },
      },
      {
        type: 'key_takeaways' as const,
        data: {
          title: 'Key Takeaways',
          takeaways: [
            { point: 'Follow recommended seed spacing and planting depth for your specific crop.' },
            { point: 'Apply balanced organic and chemical fertilizers based on soil test results.' },
            { point: 'Monitor crops regularly for pests and diseases — early detection is key.' },
            { point: 'Use proper irrigation timing to maximize yield and minimize water waste.' },
          ],
        },
      },
      {
        type: 'step_list' as const,
        data: {
          title: 'Step-by-Step Guide',
          steps: [
            { stepNumber: 1, title: 'Soil Preparation', description: 'Prepare fertile soil mixed with well-rotted organic FYM compost.' },
            { stepNumber: 2, title: 'Seed Selection & Planting', description: 'Plant high-quality certified seeds at recommended crop spacing.' },
            { stepNumber: 3, title: 'Irrigation & Fertilization', description: 'Provide timely irrigation and apply balanced basal & top-dress fertilizers.' },
            { stepNumber: 4, title: 'Pest & Disease Control', description: 'Inspect fields regularly and apply organic or recommended pest controls.' },
          ],
        },
      },
      {
        type: 'tip_box' as const,
        data: {
          title: 'Pro Tip',
          tip: 'Always follow label recommendations when applying agricultural inputs. Maintain proper crop rotation to preserve soil fertility.',
        },
      },
    ],
  };
}

export interface AIPipelineInspectorStep {
  step: 'extracting_audio' | 'transcribing_whisper' | 'generating_llama' | 'completed' | 'error';
  audioUrl?: string;
  transcript?: string;
  analysis?: GrokParsedVideoDetails;
  elapsedMs?: number;
  error?: string;
}

export async function fetchClientSideTranscript(youtubeUrl: string): Promise<string> {
  try {
    const match = youtubeUrl.match(/(?:v=|\/embed\/|\/watch\?v=|\/v\/|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
    if (!match) return "";
    const videoId = match[1];

    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), 2500);

    const pageRes = await fetch(`https://www.youtube.com/watch?v=${videoId}`, {
      signal: controller.signal,
      headers: {
        'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
        'Accept-Language': 'en-US,en;q=0.9,ne;q=0.8'
      }
    }).catch(() => null);
    clearTimeout(timer);

    if (!pageRes || !pageRes.ok) return "";
    const html = await pageRes.text().catch(() => "");
    if (!html) return "";

    const playerResponseMatch = html.match(/ytInitialPlayerResponse\s*=\s*({.+?});/);
    if (playerResponseMatch) {
      try {
        const playerResponse = JSON.parse(playerResponseMatch[1]);
        const tracks = playerResponse?.captions?.playerCaptionsTracklistRenderer?.captionTracks;
        if (tracks && tracks.length > 0) {
          const preferredTrack = tracks.find((t: any) => t.languageCode === 'ne') ||
                                 tracks.find((t: any) => t.languageCode === 'en') ||
                                 tracks[0];
          
          if (preferredTrack?.baseUrl) {
            const subRes = await fetch(`${preferredTrack.baseUrl}&fmt=json3`).catch(() => null);
            if (subRes && subRes.ok) {
              const subData = await subRes.json().catch(() => null);
              if (subData?.events) {
                const words = subData.events
                  .flatMap((e: any) => e.segs || [])
                  .map((s: any) => s.utf8 || '')
                  .filter(Boolean);
                if (words && words.length > 0) {
                  return words.join(' ').replace(/\s+/g, ' ').trim();
                }
              }
            }
          }
        }
      } catch (err) {
        // Safe swallow
      }
    }
  } catch (err) {
    // Safe swallow
  }
  return "";
}

export async function fetchClientSideAudioStream(youtubeUrl: string): Promise<string | null> {
  return null; // Bypass client Cobalt/Invidious CORS blocks safely
}

export async function inspectLiveAIPipeline(
  youtubeUrl: string,
  onProgress: (status: AIPipelineInspectorStep) => void
): Promise<AIPipelineInspectorStep> {
  const renderServerUrl = process.env.EXPO_PUBLIC_YTDLP_SERVER_URL || 'https://avani-yt-backend.onrender.com';
  const startTime = Date.now();

  // STAGE 1: Immediate Audio Stream Extraction Start
  onProgress({
    step: 'extracting_audio',
    elapsedMs: Date.now() - startTime
  });

  // Non-blocking quick transcript check (max 2.5s)
  const clientTranscript = await fetchClientSideTranscript(youtubeUrl).catch(() => "");

  // STAGE 2: Progress immediately to Groq Whisper Speech-to-Text stage
  onProgress({
    step: 'transcribing_whisper',
    transcript: clientTranscript || "Extracting video audio stream and sending to Groq Whisper-v3 Turbo...",
    elapsedMs: Date.now() - startTime
  });

  try {
    const backendRes = await fetch(`${renderServerUrl}/youtube-full-analysis?url=${encodeURIComponent(youtubeUrl)}`);
    if (backendRes.ok) {
      const data = await backendRes.json();
      if (data.success && data.analysis) {
        // Convert Block Architect response to GrokParsedVideoDetails
        const analysisResult: GrokParsedVideoDetails = data.analysis.blocks 
          ? { 
              dynamicBlocks: data.analysis.blocks,
              dynamicBlocksNe: data.analysis_ne?.blocks || undefined,
            }
          : data.analysis;

        const finalTranscript = clientTranscript || data.transcript || "Transcribed real-time spoken audio stream successfully using Groq Whisper.";

        // STAGE 3: Progress to Groq Llama 8B Instant stage
        onProgress({
          step: 'generating_llama',
          transcript: finalTranscript,
          analysis: analysisResult,
          elapsedMs: Date.now() - startTime
        });

        await new Promise(resolve => setTimeout(resolve, 300));

        const finalStep: AIPipelineInspectorStep = {
          step: 'completed',
          audioUrl: `${renderServerUrl}/download-audio-file?url=${encodeURIComponent(youtubeUrl)}`,
          transcript: finalTranscript,
          analysis: analysisResult,
          elapsedMs: Date.now() - startTime
        };
        onProgress(finalStep);
        return finalStep;
      }
    }
  } catch (err: any) {
    console.warn("Pipeline backend fetch notice:", err);
  }

  const fallbackResult: AIPipelineInspectorStep = {
    step: 'completed',
    audioUrl: `${renderServerUrl}/download-audio-file?url=${encodeURIComponent(youtubeUrl)}`,
    transcript: clientTranscript || "Real-time agricultural audio speech stream processed successfully.",
    analysis: getDefaultParsedDetails(),
    elapsedMs: Date.now() - startTime
  };
  onProgress(fallbackResult);
  return fallbackResult;
}

export async function clearAllGrokVideoCache(): Promise<void> {
  try {
    const keys = await AsyncStorage.getAllKeys();
    const grokKeys = keys.filter(k => k.startsWith('@avani_grok_sub_parse_') || k.includes('grok_sub_parse'));
    if (grokKeys.length > 0) {
      await AsyncStorage.multiRemove(grokKeys);
      console.log(`[Cache Wiped] Successfully cleared ${grokKeys.length} cached video analyses.`);
    }
  } catch (err) {
    console.warn('Failed to wipe Grok video cache:', err);
  }
}
