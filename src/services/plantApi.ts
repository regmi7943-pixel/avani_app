/**
 * Plant Identification and Diagnosis Service
 * Uses Plant.id for Crop Identification and Crop.health for Disease Diagnosis
 * Uses clean JSON Base64 payloads for maximum reliability on mobile platforms.
 */

const CROP_HEALTH_API_KEY = (process.env.EXPO_PUBLIC_CROP_HEALTH_API_KEY || 'SctSH5n34B3mdKKcWChRILWdOXrR0NJYd8TXQ5ejUxYLMroMzM') as string;
const CROP_HEALTH_API_URL = 'https://crop.kindwise.com/api/v1/identification';

const PLANT_ID_API_KEY = (process.env.EXPO_PUBLIC_PLANT_ID_API_KEY || 'jyMBQbnZDKw3X3helfw1LSEsuGdldeuk8vGDPwO7J9hmkQyOtx') as string;
const PLANT_ID_API_URL = 'https://api.plant.id/v3/identification';

export const hasApiKeys = !!(CROP_HEALTH_API_KEY || PLANT_ID_API_KEY);

import * as FileSystem from 'expo-file-system';
import { hasGroqKey, GROQ_API_KEY, GROQ_API_URL, GROQ_MODEL } from './aiService';

export interface PlantIdentificationResult {
  plantName?: string;
  botanicalName?: string;
  confidence?: number;
  diseaseName?: string | null;
  diseaseConfidence?: number | null;
  cause?: string | null;
  symptoms?: string | null;
  treatment?: string | null;
  urgency?: 'low' | 'medium' | 'high' | 'critical';
  nepaliName?: string | null;
  error?: string;
}

// ── Verified Nepali Disease Dictionary (Comprehensive NARC & Local terms) ────
const LOCAL_NEPALI_NAMES: Record<string, string> = {
  // Rice Diseases (धानबालीका रोगहरू)
  'false smut': 'धानको कालो पोके रोग (Kalo Poke)',
  'rice false smut': 'धानको कालो पोके रोग (Kalo Poke)',
  'rice blast': 'धानको मरुवा रोग (Maruwa Rog)',
  'blast': 'मरुवा रोग (Maruwa Rog)',
  'leaf blast': 'मरुवा रोग (Leaf Blast / Maruwa)',
  'neck blast': 'घाँटी मरुवा रोग (Neck Blast)',
  'bacterial leaf blight': 'पातको ब्याक्टेरियल डढुवा रोग (Bacterial Leaf Blight)',
  'bacterial blight': 'पातको ब्याक्टेरियल डढुवा रोग (Bacterial Blight)',
  'brown spot': 'धानको खैरो थोप्ले रोग (Brown Spot / Khairo Thople)',
  'brown leaf spot': 'धानको खैरो थोप्ले रोग (Brown Leaf Spot / Khairo Thople)',
  'rice brown spot': 'धानको खैरो थोप्ले रोग (Brown Leaf Spot / Khairo Thople)',
  'sheath blight': 'पातेफेद डढुवा (Sheath Blight)',
  'sheath rot': 'पातेफेद कुहिने रोग (Sheath Rot)',
  'foot rot': 'फेद कुहिने रोग / बाकाने (Foot Rot / Bakanae)',
  'bakanae': 'फेद कुहिने रोग / बाकाने (Foot Rot / Bakanae)',
  'seedling blight': 'बेर्ना डढुवा रोग (Seedling Blight)',
  'stem rot': 'डाँठ कुहिने रोग (Stem Rot)',
  'khaira': 'खैरा रोग (Khaira Disease - Zinc Deficiency)',
  
  // Wheat / Barley Diseases (गहुँ / जौका रोगहरू)
  'loose smut': 'कालो धुलो रोग (Loose Smut / Kalo Dhulo)',
  'stem rust': 'कालो सिन्दुरे रोग (Black Rust / Kale Sindure)',
  'leaf rust': 'खैरो सिन्दुरे रोग (Brown Rust / Khaire Sindure)',
  'stripe rust': 'पहेंलो सिन्दुरे रोग (Yellow Rust / Peli Sindure)',
  'yellow rust': 'पहेंलो सिन्दुरे रोग (Yellow Rust / Peli Sindure)',
  'black rust': 'कालो सिन्दुरे रोग (Black Rust / Kale Sindure)',
  'brown rust': 'खैरो सिन्दुरे रोग (Brown Rust / Khaire Sindure)',
  'spot blotch': 'पातको थोप्ले रोग (Spot Blotch / Thople Rog)',
  'powdery mildew': 'खरानी रोग (Powdery Mildew / Kharani Rog)',
  
  // Maize Diseases (मकैबालीका रोगहरू)
  'gray leaf spot': 'मकैको खैरो थोप्ले रोग (Gray Leaf Spot)',
  'maize dwarf mosaic': 'मकैको पुड्के रोग (Dwarf Mosaic)',
  'northern leaf blight': 'मकैको पात डढ्ने रोग (Northern Leaf Blight)',
  'southern leaf blight': 'मकैको पात डढ्ने रोग (Southern Leaf Blight)',
  'banded leaf and sheath blight': 'मकैको पातेफेद डढुवा (BLSB)',
  'head smut': 'मकैको कालो पोके रोग (Head Smut / Kalo Poke)',
  'stalk rot': 'मकैको डाँठ कुहिने रोग (Stalk Rot)',
  'ear rot': 'मकैको घोगा कुहिने रोग (Ear Rot)',
  
  // Potato / Tomato Diseases (आलु / गोलभेडाका रोगहरू)
  'late blight': 'डढुवा रोग (Late Blight / Dadhuwa)',
  'early blight': 'अगेती डढुवा रोग (Early Blight / Ageti Dadhuwa)',
  'bacterial wilt': 'आलु/गोलभेडाको ओइलाउने रोग (Bacterial Wilt / Oilane)',
  'septoria leaf spot': 'सेप्टोरिया थोप्ले रोग (Septoria Leaf Spot)',
  'fusarium wilt': 'फ्युजारियम ओइलाउने रोग (Fusarium Wilt)',
  'root knot nematode': 'जराको गाँठो पर्ने रोग (Root Knot Nematode)',
  'damping off': 'बेर्ना कुहिने रोग (Damping Off)',
  
  // Citrus Diseases (कागती / सुन्तलाका रोगहरू)
  'citrus canker': 'कागतीको खटिरा रोग (Citrus Canker)',
  'citrus greening': 'कागतीको ह्रास रोग (Citrus Greening / Huanglongbing)',
  'foot rot of citrus': 'फेद कुहिने रोग (Citrus Foot Rot)',
  
  // General Fallbacks (अन्य सामान्य रोगहरू)
  'downy mildew': 'डाउन मिल्ड्यू / खरानी रोग (Downy Mildew)',
  'anthracnose': 'एन्थ्राकनोज / कोत्रो रोग (Anthracnose)',
  'leaf spot': 'पातको थोप्ले रोग (Leaf Spot)',
  'mosaic virus': 'मोज्याक भाइरस रोग (Mosaic Virus)',
  'leaf curl': 'पात खुम्चिने रोग (Leaf Curl)',
  'healthy': 'स्वस्थ बाली (Healthy Crop)',
  'healthy crop': 'स्वस्थ बाली (Healthy Crop)'
};

// Returns a verified Nepali name if mapped, otherwise null
function getNepaliDiseaseName(diseaseName: string): string | null {
  const normalized = diseaseName.toLowerCase().trim();
  
  // Direct match
  if (LOCAL_NEPALI_NAMES[normalized]) {
    return LOCAL_NEPALI_NAMES[normalized];
  }
  
  // Substring match
  for (const key of Object.keys(LOCAL_NEPALI_NAMES)) {
    if (normalized.includes(key) || key.includes(normalized)) {
      return LOCAL_NEPALI_NAMES[key];
    }
  }
  return null;
}

// ── Helper: Format symptoms to a safe renderable string ────────────────────
function formatSymptoms(rawSymptoms: any): string {
  if (!rawSymptoms) return 'Visible discoloration or lesions on leaf surface.';
  if (typeof rawSymptoms === 'string') return rawSymptoms;
  if (Array.isArray(rawSymptoms)) {
    return rawSymptoms.map(s => typeof s === 'string' ? s : JSON.stringify(s)).join(', ');
  }
  if (typeof rawSymptoms === 'object') {
    const keys = Object.keys(rawSymptoms);
    if (keys.length === 0) return 'Visible symptoms.';
    return keys.map(key => {
      const val = rawSymptoms[key];
      if (typeof val === 'string') return `${key}: ${val}`;
      if (val === true) return key;
      return `${key}: ${JSON.stringify(val)}`;
    }).join(', ');
  }
  return String(rawSymptoms);
}

// ── Helper: Format treatment to a safe renderable string ───────────────────
function formatTreatment(rawTreatment: any): string {
  if (!rawTreatment) return 'Apply appropriate organic treatment and isolate infected plants.';
  if (typeof rawTreatment === 'string') return rawTreatment;
  if (typeof rawTreatment === 'object') {
    const parts: string[] = [];
    if (rawTreatment.biological) {
      const bio = Array.isArray(rawTreatment.biological) ? rawTreatment.biological : [rawTreatment.biological];
      parts.push(`Biological: ${bio.join(', ')}`);
    }
    if (rawTreatment.chemical) {
      const chem = Array.isArray(rawTreatment.chemical) ? rawTreatment.chemical : [rawTreatment.chemical];
      parts.push(`Chemical: ${chem.join(', ')}`);
    }
    if (rawTreatment.prevention) {
      const prev = Array.isArray(rawTreatment.prevention) ? rawTreatment.prevention : [rawTreatment.prevention];
      parts.push(`Prevention: ${prev.join(', ')}`);
    }
    if (parts.length > 0) return parts.join('\n\n');
    return Object.keys(rawTreatment).map(k => `${k}: ${JSON.stringify(rawTreatment[k])}`).join('\n');
  }
  return String(rawTreatment);
}

// ── Helper: Format cause to a safe renderable string ───────────────────────
function formatCause(rawCause: any): string {
  if (!rawCause) return 'Pathogen infection';
  if (typeof rawCause === 'string') return rawCause;
  if (typeof rawCause === 'object') {
    return Object.keys(rawCause).map(k => `${k}: ${JSON.stringify(rawCause[k])}`).join(', ');
  }
  return String(rawCause);
}

// ── Helper: Read image as base64 using native expo-file-system with XHR fallback ──
async function imageToBase64(imageUri: string): Promise<string> {
  try {
    // Native, buffered file reading is much faster and avoids JS bridge bottlenecks
    const base64 = await FileSystem.readAsStringAsync(imageUri, {
      encoding: 'base64',
    });
    return base64;
  } catch (err: any) {
    console.warn('FileSystem.readAsStringAsync failed, falling back to XMLHttpRequest:', err.message);
    return new Promise((resolve, reject) => {
      const xhr = new XMLHttpRequest();
      xhr.onload = function () {
        const reader = new FileReader();
        reader.onloadend = function () {
          const result = reader.result as string;
          const base64Str = result.split(',')[1];
          if (base64Str) {
            resolve(base64Str);
          } else {
            reject(new Error('Failed to convert image to base64'));
          }
        };
        reader.onerror = () => reject(new Error('FileReader error'));
        reader.readAsDataURL(xhr.response);
      };
      xhr.onerror = () => reject(new Error('Could not read the captured image. Please try again.'));
      xhr.responseType = 'blob';
      xhr.open('GET', imageUri, true);
      xhr.send(null);
    });
  }
}

// ── Step 1: Call Plant.id for Crop Identification ────────────────────────────
async function identifyPlant(base64Data: string): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${PLANT_ID_API_URL}?details=common_names,scientific_name,cause,symptoms,treatment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': PLANT_ID_API_KEY,
      },
      body: JSON.stringify({
        images: [base64Data],
        health: 'all'
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Plant.id status ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    console.warn('Plant.id API call failed:', err.message);
    return null;
  }
}

// ── Step 2: Call Crop.health for Disease Diagnosis ───────────────────────────
async function diagnoseCrop(base64Data: string): Promise<any> {
  try {
    const controller = new AbortController();
    const timeoutId = setTimeout(() => controller.abort(), 15000);

    const response = await fetch(`${CROP_HEALTH_API_URL}?details=cause,symptoms,treatment`, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Api-Key': CROP_HEALTH_API_KEY,
      },
      body: JSON.stringify({
        images: [base64Data],
      }),
      signal: controller.signal,
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      throw new Error(`Crop.health status ${response.status}`);
    }

    return await response.json();
  } catch (err: any) {
    console.warn('Crop.health API call failed:', err.message);
    return null;
  }
}

// ── Main Controller ──────────────────────────────────────────────────────────
export async function identifyAndDiagnose(imageUri: string): Promise<PlantIdentificationResult> {
  try {
    console.log('Reading image for dual API scan...');
    const base64Data = await imageToBase64(imageUri);

    console.log('Calling Plant.id and Crop.health APIs in parallel...');
    const [plantData, diseaseData] = await Promise.all([
      identifyPlant(base64Data),
      diagnoseCrop(base64Data)
    ]);

    if (!plantData && !diseaseData) {
      return { error: 'Both plant identification and disease diagnosis calls failed. Please check network.' };
    }

    // ── Parse Crop/Plant Identification from Plant.id ────────────────────────
    let plantName = 'Unknown Crop';
    let botanicalName = 'Unknown';
    let confidence = 0;

    if (plantData) {
      const isPlant = plantData?.result?.is_plant?.binary ?? true;
      const isPlantProbability = plantData?.result?.is_plant?.probability ?? 1.0;

      if (!isPlant && isPlantProbability < 0.55) {
        return { error: 'No plant detected. Please scan a clear picture of a crop leaf.' };
      }

      const plantSuggestion = plantData?.result?.classification?.suggestions?.[0];
      if (plantSuggestion) {
        const rawCommonNames = plantSuggestion.details?.common_names;
        const commonName = rawCommonNames && rawCommonNames.length > 0 ? rawCommonNames[0] : null;
        plantName = commonName ? commonName.charAt(0).toUpperCase() + commonName.slice(1) : plantSuggestion.name;
        botanicalName = plantSuggestion.details?.scientific_name || plantSuggestion.name;
        confidence = Math.round((plantSuggestion.probability || 0) * 100);
      }
    }

    // ── Parse Disease Pathogens (Prioritize Crop.health, Fallback to Plant.id) ──
    let diseaseName = 'Healthy Crop';
    let diseaseConfidence = 0;
    let cause = 'Optimal growth conditions';
    let symptoms = 'Vibrant green leaves, strong stalks, and normal growth pattern.';
    let treatment = 'Maintain standard watering and nourishment.';
    let urgency: 'low' | 'medium' | 'high' | 'critical' = 'low';
    let nepaliName: string | null = null;

    // Prioritize Crop.health for diagnosis data, fallback to Plant.id if Crop.health failed
    const diagSource = diseaseData || plantData;
    
    if (diagSource) {
      const diseaseSuggestion = diagSource?.result?.disease?.suggestions?.[0];
      if (diseaseSuggestion && diseaseSuggestion.probability > 0.35) {
        diseaseName = diseaseSuggestion.name;
        diseaseConfidence = Math.round(diseaseSuggestion.probability * 100);
        
        // Safely format nested structures using helpers
        cause = formatCause(diseaseSuggestion.details?.cause);
        symptoms = formatSymptoms(diseaseSuggestion.details?.symptoms);
        
        const treatDetails = diseaseSuggestion.details?.treatment;
        if (treatDetails) {
          treatment = formatTreatment(treatDetails);
        } else {
          treatment = 'Apply appropriate treatment and isolate infected plants.';
        }
        
        urgency = diseaseSuggestion.details?.severity === 'high' ? 'high' : 'medium';

        // Check if we have a verified local name in our dictionary
        const verifiedNepali = getNepaliDiseaseName(diseaseName);
        if (verifiedNepali) {
          nepaliName = verifiedNepali;
        }

        // ── Groq / Gemini Enrichment (Generates specific localized names and dynamic content) ──
        let enrichmentSucceeded = false;

        // 1. Try Groq API if key is set
        if (hasGroqKey) {
          try {
            console.log(`🌿 Querying Groq (${GROQ_MODEL}) to enrich pathology info for: ${diseaseName} on ${plantName}`);
            
            const localInjectPrompt = nepaliName 
              ? `NOTE: The verified local name in Nepal is "${nepaliName}". You MUST output "${nepaliName}" exactly as the "nepaliName" in your JSON response.`
              : `Search and find the local Nepali name of this disease in Devanagari script and English transliteration (e.g. "Kalo Poke / कालो पोके" for Rice False Smut). If no Nepali name exists, set nepaliName to null.`;

            const promptText = `You are a world-class plant pathologist. A farmer has scanned a crop leaf.
Crop: ${plantName} (${botanicalName})
Diagnosed Disease: ${diseaseName}

Analyze the details. Provide a highly specific, localized diagnostic report for a Nepalese farmer.
${localInjectPrompt}

Rules:
1. Keep the description for each field very short and concise (1-2 sentences maximum).
2. DO NOT use any markdown styling, asterisks (*), or italics.
3. Output ONLY a valid raw JSON object matching this structure (no markdown formatting, no code fences, no extra text):
{
  "nepaliName": "Local name of the disease in Nepal (e.g. Kalo Poke / कालो पोके) or null",
  "cause": "Detailed cause of the disease",
  "symptoms": "Visible symptoms description",
  "treatment": "Practical chemical, biological, or preventive controls",
  "urgency": "low" or "medium" or "high" or "critical"
}`;

            const enrichResponse = await fetch(GROQ_API_URL, {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${GROQ_API_KEY}`,
              },
              body: JSON.stringify({
                model: GROQ_MODEL,
                messages: [
                  {
                    role: 'system',
                    content: 'You are a world-class plant pathologist. Your output MUST be raw JSON matching the requested structure without markdown code blocks, backticks, or fences.'
                  },
                  {
                    role: 'user',
                    content: promptText
                  }
                ],
                temperature: 0.1,
                response_format: { type: 'json_object' }
              })
            });

            if (enrichResponse.ok) {
              const enrichData = await enrichResponse.json();
              const rawText = enrichData?.choices?.[0]?.message?.content || '';
              console.log('🌿 Groq enrichment raw response:', rawText);
              const cleanJson = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
              if (cleanJson) {
                const parsedEnrichment = JSON.parse(cleanJson);
                if (parsedEnrichment.cause) cause = parsedEnrichment.cause;
                if (parsedEnrichment.symptoms) symptoms = parsedEnrichment.symptoms;
                if (parsedEnrichment.treatment) treatment = parsedEnrichment.treatment;
                if (parsedEnrichment.urgency) urgency = parsedEnrichment.urgency;
                if (parsedEnrichment.nepaliName) nepaliName = parsedEnrichment.nepaliName;
                console.log('🌿 Groq enrichment completed successfully.');
                enrichmentSucceeded = true;
              }
            } else {
              const errText = await enrichResponse.text();
              console.warn('Groq enrichment API responded with error status:', enrichResponse.status, errText);
            }
          } catch (groqErr: any) {
            console.warn('Groq description enrichment failed, trying Gemini fallback:', groqErr.message);
          }
        }

        // 2. Try Gemini API fallback if Groq failed or wasn't set
        if (!enrichmentSucceeded) {
          try {
            console.log(`🌿 Querying Gemini (2.5-flash) to enrich pathology info for: ${diseaseName} on ${plantName}`);
            const GEMINI_API_KEY = (process.env.EXPO_PUBLIC_GEMINI_API_KEY || '') as string;
            const geminiUrl = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${GEMINI_API_KEY}`;
            
            const localInjectPrompt = nepaliName 
              ? `NOTE: The verified local name in Nepal is "${nepaliName}". You MUST output "${nepaliName}" exactly as the "nepaliName" in your JSON response.`
              : `Search and find the local Nepali name of this disease in Devanagari script and English transliteration (e.g. "Kalo Poke / कालो पोके" for Rice False Smut). If no Nepali name exists, set nepaliName to null.`;

            const promptText = `You are a world-class plant pathologist. A farmer has scanned a crop leaf.
Crop: ${plantName} (${botanicalName})
Diagnosed Disease: ${diseaseName}

Analyze the details. Provide a highly specific, localized diagnostic report for a Nepalese farmer.
${localInjectPrompt}

Rules:
1. Keep the description for each field very short and concise (1-2 sentences maximum).
2. DO NOT use any markdown styling, asterisks (*), or italics.
3. Output ONLY a valid raw JSON object matching this structure (no markdown formatting, no code fences, no extra text):
{
  "nepaliName": "Local name of the disease in Nepal (e.g. Kalo Poke / कालो पोके) or null",
  "cause": "Detailed cause of the disease",
  "symptoms": "Visible symptoms description",
  "treatment": "Practical chemical, biological, or preventive controls",
  "urgency": "low" or "medium" or "high" or "critical"
}`;

            const enrichResponse = await fetch(geminiUrl, {
              method: 'POST',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                contents: [{ parts: [{ text: promptText }] }],
                tools: [{ google_search: {} }],
                generationConfig: { temperature: 0.1 }
              })
            });

            if (enrichResponse.ok) {
              const enrichData = await enrichResponse.json();
              const rawText = enrichData?.candidates?.[0]?.content?.parts?.[0]?.text || '';
              console.log('🌿 Gemini enrichment raw response:', rawText);
              const cleanJson = rawText.replace(/```json\s*/gi, '').replace(/```\s*/g, '').trim();
              if (cleanJson) {
                const parsedEnrichment = JSON.parse(cleanJson);
                if (parsedEnrichment.cause) cause = parsedEnrichment.cause;
                if (parsedEnrichment.symptoms) symptoms = parsedEnrichment.symptoms;
                if (parsedEnrichment.treatment) treatment = parsedEnrichment.treatment;
                if (parsedEnrichment.urgency) urgency = parsedEnrichment.urgency;
                if (parsedEnrichment.nepaliName) nepaliName = parsedEnrichment.nepaliName;
                console.log('🌿 Gemini enrichment completed successfully.');
                enrichmentSucceeded = true;
              }
            } else {
              const errText = await enrichResponse.text();
              console.warn('Gemini enrichment API responded with error status:', enrichResponse.status, errText);
            }
          } catch (geminiErr: any) {
            console.warn('Gemini description enrichment failed, using Kindwise fallback details:', geminiErr.message);
          }
        }
      }
    }

    return {
      plantName,
      botanicalName,
      confidence,
      diseaseName,
      diseaseConfidence,
      cause,
      symptoms,
      treatment,
      urgency,
      nepaliName,
    };
  } catch (error: any) {
    console.warn('Dual scan execution error:', error.message);
    return { error: error.message || 'Dual scan analysis failed.' };
  }
}
