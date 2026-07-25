// Advanced NARC Agronomic & Crop Growth Stage Prescription Engine

export interface CropGrowthStage {
  das: number; // Days After Sowing/Planting
  stageCode: string;
  stageName: string;
  stageNameNe: string;
  description: string;
  descriptionNe: string;
  progressPct: number; // 0 - 100% of cycle
}

export interface AdvancedPrescription {
  id: string;
  title: string;
  titleNe: string;
  productName: string;
  productNameNe: string;
  category: 'FERTILIZER' | 'MICRONUTRIENT' | 'SOIL' | 'PESTICIDE' | 'BIO-ORGANIC';
  totalDosage: string;
  totalDosageNe: string;
  price: string;
  emoji: string;
  growthStageWindow: string;
  growthStageWindowNe: string;
  agronomicReason: string;
  agronomicReasonNe: string;
  urgency: 'HIGH' | 'MEDIUM' | 'OPTIMAL';
}

/**
 * Calculates exact Days After Sowing (DAS) and current Phenological Growth Stage for Rice / Maize
 */
export function calculateCropGrowthStage(
  cropType: string = 'Rice',
  plantingDateStr?: string | null
): CropGrowthStage {
  let pDate = plantingDateStr ? new Date(plantingDateStr) : new Date();
  if (isNaN(pDate.getTime())) {
    // Default to ~38 days ago if date string is invalid
    pDate = new Date();
    pDate.setDate(pDate.getDate() - 38);
  }

  const today = new Date();
  const diffTime = Math.max(0, today.getTime() - pDate.getTime());
  const das = Math.floor(diffTime / (1000 * 60 * 60 * 24));

  const isMaize = cropType.toLowerCase().includes('maize') || cropType.toLowerCase().includes('मर्कै');

  if (isMaize) {
    if (das <= 20) {
      return {
        das,
        stageCode: 'V3-V6',
        stageName: 'V3-V6 Knee-High Vegetative Stage',
        stageNameNe: 'V3-V6 घुँडासम्म बढ्ने सुरुवाती अवस्था',
        description: 'Early root expansion and leaf initiation.',
        descriptionNe: 'जरा फैलावट र सुरुवाती पात वृद्धि अवस्था।',
        progressPct: Math.min(100, Math.round((das / 110) * 100)),
      };
    } else if (das <= 50) {
      return {
        das,
        stageCode: 'V12-VT',
        stageName: 'V12-VT Tasseling & Silking Stage',
        stageNameNe: 'V12-VT चमरा र जुँगा आउने मुख्य अवस्था',
        description: 'Peak Nitrogen requirement and cob initiation.',
        descriptionNe: 'नाइट्रोजनको उच्च माग र घोगा विकास हुने अवस्था।',
        progressPct: Math.min(100, Math.round((das / 110) * 100)),
      };
    } else if (das <= 80) {
      return {
        das,
        stageCode: 'R1-R3',
        stageName: 'R1-R3 Blister & Milk Grain Filling Stage',
        stageNameNe: 'R1-R3 दुधिलो पोलो दाना भर्ने अवस्था',
        description: 'Potash and Boron demand for grain plumpness.',
        descriptionNe: 'दाना भर्ने र पोटासियमको मुख्य आवश्यकता।',
        progressPct: Math.min(100, Math.round((das / 110) * 100)),
      };
    } else {
      return {
        das,
        stageCode: 'R6',
        stageName: 'R6 Black Layer Physiological Maturity',
        stageNameNe: 'R6 दाना पाक्ने तथा कटानीको अवस्था',
        description: 'Crop maturity reached. Pre-harvest drying.',
        descriptionNe: 'पाकेर तयार भएको अवस्था। कटानीको तयारी।',
        progressPct: 100,
      };
    }
  } else {
    // Rice / Paddy Cycle (120 Days Baseline)
    if (das <= 20) {
      return {
        das,
        stageCode: 'S1-REG',
        stageName: 'Early Vegetative & Seedling Establishment',
        stageNameNe: 'सुरुवाती जरा गाड्ने तथा बिरुवा सप्रिने अवस्था',
        description: 'Basal root development & early tiller initiation.',
        descriptionNe: 'जरा बलियो हुने र सुरुवाती कन्स हाल्ने समय।',
        progressPct: Math.min(100, Math.round((das / 120) * 100)),
      };
    } else if (das <= 45) {
      return {
        das,
        stageCode: 'S2-TIL',
        stageName: 'Active Tillering & Panicle Initiation Stage',
        stageNameNe: 'मुख्य झाङ हाल्ने र बाला निर्माण हुने अवस्था',
        description: 'Critical window for top-dressing Nitrogen & Zinc.',
        descriptionNe: 'नाइट्रोजन र जिङ्क टप-ड्रेसिङ गर्ने सबैभन्दा मुख्य समय।',
        progressPct: Math.min(100, Math.round((das / 120) * 100)),
      };
    } else if (das <= 75) {
      return {
        das,
        stageCode: 'S3-FLO',
        stageName: 'Booting, Flowering & Grain Milking Stage',
        stageNameNe: 'फूल फुल्ने र दाना दुधिलो हुने अवस्था',
        description: 'Foliar Potash & Boron spray for heavy grain weight.',
        descriptionNe: 'दाना गहु्रङ्गो बनाउन बोरोन र पोटासियम स्प्रे समय।',
        progressPct: Math.min(100, Math.round((das / 120) * 100)),
      };
    } else {
      return {
        das,
        stageCode: 'S4-HAR',
        stageName: 'Ripening & Pre-Harvest Maturity Stage',
        stageNameNe: 'दाना सुनौलो भई पाक्ने कटानी अवस्था',
        description: 'Grain ripening. Cease fertilizer application.',
        descriptionNe: 'धान पाकिसकेको अवस्था। मल हाल्न बन्द गर्नुहोस्।',
        progressPct: 100,
      };
    }
  }
}

/**
 * Advanced Multi-Factor Agronomic Recommendation Engine
 */
export function generateAdvancedPrescriptions(
  cropType: string,
  plantingDateStr: string | null,
  areaKattha: number,
  areaUnit: string,
  ph: number,
  socPct: number,
  clayPct: number,
  cecMmolKg: number
): AdvancedPrescription[] {
  const stage = calculateCropGrowthStage(cropType, plantingDateStr);
  const isAcidic = ph < 5.8;
  const isLowSoc = socPct < 1.5;
  const prescriptions: AdvancedPrescription[] = [];

  // 1. Stage-Specific Nitrogen Recommendation
  if (stage.das <= 45) {
    const totalUreaKg = (areaKattha * 3.2).toFixed(1);
    prescriptions.push({
      id: 'adv-urea-1',
      title: 'Active Tillering Nitrogen Top-Dressing',
      titleNe: 'मुख्य झाङ हाल्ने यूरिया टप-ड्रेसिङ',
      productName: 'Urea 46% N Top-Dress Fertilizer',
      productNameNe: 'यूरिया ४६% N मल (Top-Dress)',
      category: 'FERTILIZER',
      totalDosage: `${totalUreaKg} kg (${areaKattha} ${areaUnit})`,
      totalDosageNe: `कुल ${totalUreaKg} केजी (${areaKattha} ${areaUnit})`,
      price: 'NPR 950 / Bag',
      emoji: '💧',
      growthStageWindow: `Apply now (Day ${stage.das} - ${stage.stageCode})`,
      growthStageWindowNe: `अहिले प्रयोग गर्नुहोस् (दिन ${stage.das} - ${stage.stageCode})`,
      agronomicReason: `High tiller demand during ${stage.stageName}. Split into 2 split doses.`,
      agronomicReasonNe: `${stage.stageNameNe} मा नाइट्रोजनको उच्च माग हुने हुनाले दुई पटक गरेर हाल्नुहोस्।`,
      urgency: 'HIGH',
    });
  } else if (stage.das <= 75) {
    const totalMopKg = (areaKattha * 1.5).toFixed(1);
    prescriptions.push({
      id: 'adv-mop-1',
      title: 'Panicle Booting Potash Booster',
      titleNe: 'बाला निर्माण पोटाश मल',
      productName: 'MOP Potash 60% K2O Fertilizer',
      productNameNe: 'मुरिएट अफ पोटाश (MOP 60%)',
      category: 'FERTILIZER',
      totalDosage: `${totalMopKg} kg (${areaKattha} ${areaUnit})`,
      totalDosageNe: `कुल ${totalMopKg} केजी (${areaKattha} ${areaUnit})`,
      price: 'NPR 1,650 / Bag',
      emoji: '🌾',
      growthStageWindow: `Booting Window (Day ${stage.das})`,
      growthStageWindowNe: `बाला आउने समय (दिन ${stage.das})`,
      agronomicReason: `Increases grain weight & panicle resistance during ${stage.stageName}.`,
      agronomicReasonNe: `धानको दाना पुष्ट बनाउन र रोग प्रतिरोध बढाउन प्रयोग गर्नुहोस्।`,
      urgency: 'OPTIMAL',
    });
  }

  // 2. Micronutrient Correction (Zinc Sulphate for Khaira Prevention)
  const totalZincKg = (areaKattha * 0.75).toFixed(1);
  prescriptions.push({
    id: 'adv-zinc-1',
    title: 'Zinc Deficit & Khaira Spot Remedy',
    titleNe: 'खैरा रोग रोकथाम जिङ्क सल्फेट',
    productName: 'Zinc Sulphate 21% Micronutrient',
    productNameNe: 'जिङ्क सल्फेट २१% दाना',
    category: 'MICRONUTRIENT',
    totalDosage: `${totalZincKg} kg total`,
    totalDosageNe: `कुल ${totalZincKg} केजी`,
    price: 'NPR 450 / Pack',
    emoji: '🧪',
    growthStageWindow: `Early Vegetative (Day ${stage.das})`,
    growthStageWindowNe: `सुरुवाती वृद्धि समय (दिन ${stage.das})`,
    agronomicReason: `Prevents Khaira rusty leaf chlorosis and boosts enzyme action.`,
    agronomicReasonNe: `धानको पात पहेँलो भई खैरो थोप्ला आउने समस्या समाधान गर्छ।`,
    urgency: 'HIGH',
  });

  // 3. Soil Condition Reaction (Acidity Lime vs Organic Vermicompost)
  if (isAcidic) {
    const totalLimeKg = (areaKattha * 15).toFixed(0);
    prescriptions.push({
      id: 'adv-lime-1',
      title: 'Acidity Remediation Lime Treatment',
      titleNe: 'माटोको अम्लीयपना चुना उपचार',
      productName: 'Agricultural Dolomitic Lime',
      productNameNe: 'कृषि चुना (Agricultural Lime)',
      category: 'SOIL',
      totalDosage: `${totalLimeKg} kg total`,
      totalDosageNe: `कुल ${totalLimeKg} केजी चुना`,
      price: 'NPR 350 / Bag',
      emoji: '🪨',
      growthStageWindow: `Immediate Pre-Soil Treatment`,
      growthStageWindowNe: `तत्काल माटो उपचार समय`,
      agronomicReason: `Soil pH is ${ph} (Acidic). Lime elevates pH to optimal 6.3 range.`,
      agronomicReasonNe: `माटोको pH मान ${ph} (अम्लीय) भएकोले चुना हालेर ६.३ पुर्याउनुहोस्।`,
      urgency: 'HIGH',
    });
  } else if (isLowSoc || socPct < 2.0) {
    const totalVermiKg = (areaKattha * 20).toFixed(0);
    prescriptions.push({
      id: 'adv-vermi-1',
      title: 'Bio-Organic Vermicompost Enricher',
      titleNe: 'जैविक गड्यौला मल भण्डारण',
      productName: 'Organic Vermicompost Soil Enricher',
      productNameNe: 'जैविक गड्यौला मल (Vermicompost)',
      category: 'BIO-ORGANIC',
      totalDosage: `${totalVermiKg} kg total`,
      totalDosageNe: `कुल ${totalVermiKg} केजी मल`,
      price: 'NPR 600 / Bag',
      emoji: '🍂',
      growthStageWindow: `Active Root Growth`,
      growthStageWindowNe: `जरा विकास समय`,
      agronomicReason: `Maintains Soil Organic Carbon (${socPct}%) & CEC nutrient buffer.`,
      agronomicReasonNe: `माटोको जैविक कार्बन (${socPct}%) सुधार्न प्रयोग गर्नुहोस्।`,
      urgency: 'OPTIMAL',
    });
  }

  return prescriptions;
}
