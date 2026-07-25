// Grok AI Farm Matchmaking Engine & Daily Video Selector

import AsyncStorage from '@react-native-async-storage/async-storage';
import { YouTubeFarmingItem } from './youtubeService';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

export interface GrokMatchedVideoResult {
  recommendedVideo: YouTubeFarmingItem;
  fieldNameEn: string;
  fieldNameNe: string;
}

export function getTodayDateString(): string {
  const d = new Date();
  const year = d.getFullYear();
  const month = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function getDailySeedIndex(arrayLength: number, offset: number = 0): number {
  if (arrayLength <= 0) return 0;
  const todayStr = getTodayDateString();
  let hash = 0;
  for (let i = 0; i < todayStr.length; i++) {
    hash = (hash * 31 + todayStr.charCodeAt(i)) % 1000007;
  }
  return (hash + offset) % arrayLength;
}

/**
 * AI Matchmaking Pipeline: Matches farmer's farms with exact required videos
 */
export async function getDailyGrokVideoRecommendation(
  userFields: any[],
  videoPool: YouTubeFarmingItem[]
): Promise<GrokMatchedVideoResult[]> {
  if (!videoPool || videoPool.length === 0) {
    return [];
  }

  const todayStr = getTodayDateString();
  const cacheKey = `@avani_grok_rec_${todayStr}`;

  // 1. Local Cache Check
  try {
    const cached = await AsyncStorage.getItem(cacheKey);
    if (cached) {
      const parsed = JSON.parse(cached);
      if (Array.isArray(parsed) && parsed.length > 0) {
        return parsed;
      }
    }
  } catch (err) {
    console.warn('Cache error:', err);
  }

  // 2. Grok AI Matchmaking logic
  const fieldsInfo = (userFields && userFields.length > 0)
    ? userFields.map(f => `Field: ${f.name || 'Farm'}, Crop: ${f.crop_type || f.crop || 'Paddy'}`)
    : ['Field: Primary Farm, Crop: Paddy'];

  const videosSummary = videoPool.slice(0, 40).map(v => `ID: ${v.id}, Title: "${v.titleEn}", Crop: ${v.cropType}`).join('\n');

  try {
    const prompt = `You are Avani's Matchmaking Algorithm for Nepalese Farmers.
Farmer Registered Fields:
${fieldsInfo.join('\n')}

Available YouTube Farming Video Inventory:
${videosSummary}

Select the exact video ID required for each registered field today. Return JSON array:
[
  {
    "videoId": "video_id_string",
    "fieldNameEn": "Field Name",
    "fieldNameNe": "खेतको नाम"
  }
]
Return raw JSON array ONLY.`;

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 6000);

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: prompt }],
        temperature: 0.2,
        max_tokens: 500,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content || '';
      const cleanJson = rawText.replace(/```json/g, '').replace(/```/g, '').trim();
      const parsedArray = JSON.parse(cleanJson);

      if (Array.isArray(parsedArray) && parsedArray.length > 0) {
        const results: GrokMatchedVideoResult[] = parsedArray.map((item: any) => {
          const video = videoPool.find(v => v.id === item.videoId) || videoPool[0];
          return {
            recommendedVideo: video,
            fieldNameEn: item.fieldNameEn || 'Recommended',
            fieldNameNe: item.fieldNameNe || 'सिफारिस',
          };
        });

        await AsyncStorage.setItem(cacheKey, JSON.stringify(results)).catch(() => {});
        return results;
      }
    }
  } catch (err) {
    console.warn('Grok AI selector fallback triggered:', err);
  }

  // 3. Fallback Matcher
  const fallbackResults: GrokMatchedVideoResult[] = (userFields && userFields.length > 0)
    ? userFields.map((field, idx) => {
        const cropStr = (field.crop_type || field.crop || '').toLowerCase();
        let matchedVideo = videoPool.find(v => v.cropType === cropStr || cropStr.includes(v.cropType));
        if (!matchedVideo) {
          const seedIdx = getDailySeedIndex(videoPool.length, idx);
          matchedVideo = videoPool[seedIdx] || videoPool[0];
        }
        return {
          recommendedVideo: matchedVideo,
          fieldNameEn: field.name || 'My Field',
          fieldNameNe: field.name || 'मेरो खेत',
        };
      })
    : [0, 1, 2, 3].map((idx) => {
        const seedIdx = getDailySeedIndex(videoPool.length, idx);
        return {
          recommendedVideo: videoPool[seedIdx] || videoPool[0],
          fieldNameEn: 'Recommended',
          fieldNameNe: 'सिफारिस',
        };
      });

  return fallbackResults;
}
