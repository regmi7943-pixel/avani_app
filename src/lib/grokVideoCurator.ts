// Grok AI Agricultural Video Curator & Universal Relevance Filter

import { YouTubeFarmingItem } from './youtubeService';

const GROQ_API_KEY = process.env.EXPO_PUBLIC_GROQ_API_KEY || '';

/**
 * Filters candidate YouTube videos using Grok AI based on title relevance.
 * Supports ALL farming topics in Nepal (Dragon Fruit, Ginger, Paddy, Maize, Potato, Tomato, Spices, Livestock, etc.).
 */
export async function filterYouTubeVideosWithGrokAI(
  candidateVideos: YouTubeFarmingItem[]
): Promise<YouTubeFarmingItem[]> {
  if (!candidateVideos || candidateVideos.length === 0) {
    return [];
  }

  const candidateList = candidateVideos.map(v => ({
    id: v.id,
    title: v.titleEn || v.titleNe,
  }));

  const systemPrompt = `You are Avani's Master Agricultural Video Curator for Nepalese Farmers.
We ACCEPT ALL practical, real-world farming tutorial guides for Nepalese agriculture, including:
- Core Crops (Paddy, Maize, Wheat, Potato, Mustard, Buckwheat, Millet)
- Fruits & Commercial Crops (Dragon Fruit, Banana, Apple, Orange, Lemon, Papaya, Mango)
- Vegetables & Spices (Ginger, Garlic, Cardamom, Tomato, Onion, Cucumber, Chili, Mushroom)
- Livestock & Agronomy (Beekeeping, Poultry, Cattle, Organic Fertilizer, Hydroponics)

STRICT REJECTION RULES (REJECT ONLY THE FOLLOWING JUNK):
- REJECT magic spells, kiosks, revenge spells, occult, entertainment, memes, gaming, music.
- REJECT B.Sc agriculture entrance exams, Loksewa exams, MCQs, tuition, college fees, syllabus reviews.
- REJECT completely unrelated non-agricultural content.

Candidate Videos:
${JSON.stringify(candidateList)}

Evaluate each video title carefully. Return a JSON array containing ONLY the string IDs of approved valid farming videos:
["id1", "id2", ...]
Return raw JSON array ONLY. No markdown, no extra commentary.`;

  try {
    console.log(`[Grok AI Curator] Sending ${candidateVideos.length} video titles to Grok AI for universal relevance filtering...`);

    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 10000);

    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${GROQ_API_KEY}`
      },
      body: JSON.stringify({
        model: 'llama-3.3-70b-versatile',
        messages: [{ role: 'user', content: systemPrompt }],
        temperature: 0.1,
        max_tokens: 1000,
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (res.ok) {
      const data = await res.json();
      const rawText = data.choices?.[0]?.message?.content || '';
      
      // Robust JSON array extraction
      const match = rawText.match(/\[[\s\S]*\]/);
      if (match) {
        const approvedIds: string[] = JSON.parse(match[0]);
        if (Array.isArray(approvedIds)) {
          const approvedSet = new Set(approvedIds);
          const filtered = candidateVideos.filter(v => approvedSet.has(v.id));
          console.log(`[Grok AI Curator] Grok AI approved ${filtered.length} of ${candidateVideos.length} videos.`);
          return filtered.length > 0 ? filtered : candidateVideos;
        }
      }
    }
  } catch (err) {
    console.warn('[Grok AI Curator handled fallback]:', err);
  }

  // Smart regex fallback if AI request fails or times out
  const fallbackFiltered = candidateVideos.filter(v => {
    const t = (v.titleEn + ' ' + v.subtitleEn).toLowerCase();
    const junkTerms = ['magic', 'kiosk', 'spell', 'loksewa', 'mcq', 'entrance', 'tuition', 'revenge'];
    return !junkTerms.some(term => t.includes(term));
  });

  return fallbackFiltered;
}
