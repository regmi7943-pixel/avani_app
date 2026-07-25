// Open Video API Service - Zero API Key Required
// Fetches live public agricultural video tutorials from open Piped/Invidious mirrors.

export interface LiveVideoItem {
  id: string;
  titleEn: string;
  titleNe: string;
  subtitleEn: string;
  subtitleNe: string;
  cropNameEn: string;
  cropNameNe: string;
  cropType: 'rice' | 'maize' | 'potato' | 'wheat' | 'vegetable';
  topic: 'plantation' | 'irrigation' | 'pesticide' | 'fertilizer';
  topicLabelEn: string;
  topicLabelNe: string;
  duration: string;
  authorEn: string;
  authorNe: string;
  thumbnailUrl: string;
  youtubeId: string;
  videoUrl: string;
  viewsText: string;
  uploadedDate: string;
}

// Reliable open public Piped / Invidious API mirrors (No API key needed)
const OPEN_API_INSTANCES = [
  'https://api.piped.private.coffee',
  'https://pipedapi.kavin.rocks',
  'https://invidious.drgns.space',
  'https://inv.tux.pizza',
];

// Keywords to exclude non-practical videos (exams, college admissions, MCQs, syllabus)
const EXCLUDE_KEYWORDS = [
  'b.sc', 'bsc', 'entrance', 'loksewa', 'lok sewa', 'exam', 'mcq', 
  'question', 'college', 'fee', 'salary', 'admission', 'scope', 
  'syllabus', 'model question', 'tuition', 'preparation', 'past paper'
];

/**
 * Extract YouTube Video ID from watch URL or URI snippet
 */
function extractYoutubeId(urlOrPath: string): string {
  if (!urlOrPath) return '';
  const match = urlOrPath.match(/(?:v=|\/embed\/|\/watch\?v=|\/v\/|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
  if (match && match[1]) return match[1];
  if (urlOrPath.length === 11) return urlOrPath;
  return '';
}

/**
 * Format duration seconds into MM:SS format
 */
function formatDuration(seconds: number): string {
  if (!seconds || seconds <= 0) return '04:30 MIN';
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  const mStr = mins < 10 ? `0${mins}` : `${mins}`;
  const sStr = secs < 10 ? `0${secs}` : `${secs}`;
  return `${mStr}:${sStr} MIN`;
}

/**
 * Infer crop type and topic from video title
 */
function inferCropAndTopic(title: string): {
  cropType: 'rice' | 'maize' | 'potato' | 'wheat' | 'vegetable';
  topic: 'plantation' | 'irrigation' | 'pesticide' | 'fertilizer';
  cropNameEn: string;
  cropNameNe: string;
  topicLabelEn: string;
  topicLabelNe: string;
} {
  const t = title.toLowerCase();

  let cropType: 'rice' | 'maize' | 'potato' | 'wheat' | 'vegetable' = 'rice';
  let cropNameEn = 'Paddy (Rice)';
  let cropNameNe = 'धान खेती';

  if (t.includes('maize') || t.includes('corn') || t.includes('मकै')) {
    cropType = 'maize';
    cropNameEn = 'Maize (Corn)';
    cropNameNe = 'मकै खेती';
  } else if (t.includes('potato') || t.includes('آلو') || t.includes('आलु')) {
    cropType = 'potato';
    cropNameEn = 'Potato';
    cropNameNe = 'आलु खेती';
  } else if (t.includes('wheat') || t.includes('गहुँ')) {
    cropType = 'wheat';
    cropNameEn = 'Wheat';
    cropNameNe = 'गहुँ खेती';
  } else if (t.includes('vegetable') || t.includes('तर्कारी') || t.includes('सब्जी')) {
    cropType = 'vegetable';
    cropNameEn = 'Organic Vegetables';
    cropNameNe = 'तरकारी खेती';
  }

  let topic: 'plantation' | 'irrigation' | 'pesticide' | 'fertilizer' = 'plantation';
  let topicLabelEn = '🌱 Sowing & Planting';
  let topicLabelNe = '🌱 रोप्ने र ब्याड';

  if (t.includes('irrigat') || t.includes('water') || t.includes('सिँचाइ') || t.includes('पानी')) {
    topic = 'irrigation';
    topicLabelEn = '💧 Smart Irrigation';
    topicLabelNe = '💧 सिँचाइ व्यवस्थापन';
  } else if (t.includes('pest') || t.includes('disease') || t.includes('fungicide') || t.includes('विषादी') || t.includes('रोग')) {
    topic = 'pesticide';
    topicLabelEn = '🛡️ Pest & Disease';
    topicLabelNe = '🛡️ रोग र कीरा नियन्त्रण';
  } else if (t.includes('fertiliz') || t.includes('dap') || t.includes('urea') || t.includes('मल')) {
    topic = 'fertilizer';
    topicLabelEn = '🧪 Fertilizer Dosage';
    topicLabelNe = '🧪 मल र पोषण';
  }

  return { cropType, topic, cropNameEn, cropNameNe, topicLabelEn, topicLabelNe };
}

/**
 * Fetch live Nepal farming tutorials from open Piped endpoints with strict quality filtering
 */
export async function fetchLiveFarmingVideos(searchQuery: string = ''): Promise<LiveVideoItem[]> {
  // Construct targeted farming search query
  const cleanQ = searchQuery ? searchQuery.trim() : '';
  const searchPhrase = cleanQ 
    ? `Nepal ${cleanQ} practical farming guide`
    : `AgroDev Nepal NARC धान मकै आलु खेती प्रविधि tarika`;
  
  const query = encodeURIComponent(searchPhrase);

  for (const baseUrl of OPEN_API_INSTANCES) {
    try {
      const endpoint = `${baseUrl}/search?q=${query}&filter=videos`;
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 6000);

      const response = await fetch(endpoint, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      if (!response.ok) continue;

      const data = await response.json();
      const rawItems = Array.isArray(data) ? data : (data.items || []);

      if (!rawItems || rawItems.length === 0) continue;

      const formattedVideos: LiveVideoItem[] = rawItems
        .filter((item: any) => {
          if (!item || (!item.url && !item.videoId)) return false;
          const title = (item.title || '').toLowerCase();
          const desc = (item.shortDescription || '').toLowerCase();
          // Filter out exam/college/MCQ videos
          const isExcluded = EXCLUDE_KEYWORDS.some(k => title.includes(k) || desc.includes(k));
          return !isExcluded;
        })
        .map((item: any, index: number) => {
          const ytId = extractYoutubeId(item.url || item.videoId || '');
          const title = item.title || 'Nepal Agriculture Practical Guide';
          const { cropType, topic, cropNameEn, cropNameNe, topicLabelEn, topicLabelNe } = inferCropAndTopic(title);
          const author = item.uploaderName || 'AgroDev Nepal';
          const thumbnail = ytId 
            ? `https://img.youtube.com/vi/${ytId}/hqdefault.jpg`
            : (item.thumbnail || 'https://images.unsplash.com/photo-1500937386664-56d1dfef3854?w=600&q=80');

          const viewsCount = item.views ? (item.views > 1000 ? `${(item.views / 1000).toFixed(1)}k views` : `${item.views} views`) : 'Live Farming Guide';

          return {
            id: ytId || `open-vid-${index}`,
            titleEn: title,
            titleNe: title,
            subtitleEn: item.shortDescription || `Practical agronomic tutorial guide by ${author}.`,
            subtitleNe: item.shortDescription || `${author} द्वारा तयार पारिएको व्यावहारिक कृषि निर्देशिका।`,
            cropNameEn,
            cropNameNe,
            cropType,
            topic,
            topicLabelEn,
            topicLabelNe,
            duration: formatDuration(item.duration),
            authorEn: author,
            authorNe: author,
            thumbnailUrl: thumbnail,
            youtubeId: ytId,
            videoUrl: ytId ? `https://www.youtube.com/embed/${ytId}?autoplay=1&playsinline=1&enablejsapi=1&origin=http://localhost` : '',
            viewsText: viewsCount,
            uploadedDate: item.uploadedDate || 'Recent',
          };
        });

      if (formattedVideos.length > 0) {
        return formattedVideos;
      }
    } catch (err) {
      console.warn(`Open Video API mirror ${baseUrl} timed out or failed, trying next mirror...`);
    }
  }

  return [];
}
