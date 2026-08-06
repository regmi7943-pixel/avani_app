// Comprehensive South Asian Agricultural RAG Knowledge Base & Context Engine
// Optimized for Llama 3.3 70B (Groq) & Gemini 1.5 Flash (Google AI)

export interface CropDiseaseInfo {
  id: string;
  nameEn: string;
  nameNe: string;
  botanicalPathogen: string;
  symptomsEn: string;
  symptomsNe: string;
  causeEn: string;
  causeNe: string;
  chemicalTreatmentEn: string;
  chemicalTreatmentNe: string;
  organicRemedyEn: string;
  organicRemedyNe: string;
  dosageDetails: {
    tradeNames: string[];
    rateFoliar: string;
    perRopani: string;
    perHectare: string;
    safetyInterval: string;
  };
  urgency: 'low' | 'medium' | 'high' | 'critical';
  environmentalTriggers: string;
}

export interface CropKnowledgeProfile {
  cropId: 'rice' | 'maize' | 'wheat' | 'potato' | 'mustard';
  nameEn: string;
  nameNe: string;
  scientificName: string;
  npkGuide: {
    targetHa: string;
    targetRopani: string;
    basalEn: string;
    basalNe: string;
    topDress1En: string;
    topDress1Ne: string;
    topDress2En: string;
    topDress2Ne: string;
    micronutrientsEn: string;
    micronutrientsNe: string;
  };
  ipmPracticesEn: string[];
  ipmPracticesNe: string[];
  diseases: CropDiseaseInfo[];
}

export const CROP_KNOWLEDGE_BASE: Record<string, CropKnowledgeProfile> = {
  rice: {
    cropId: 'rice',
    nameEn: 'Rice (Paddy)',
    nameNe: 'धान खेती',
    scientificName: 'Oryza sativa',
    npkGuide: {
      targetHa: 'NPK 100:30:30 kg/ha',
      targetRopani: 'DAP 9 kg + Potash 3.5 kg + Urea 9 kg per Ropani (500 sq. m)',
      basalEn: 'DAP 9 kg + Potash 3.5 kg + Zinc Sulfate 1 kg per ropani at transplanting.',
      basalNe: 'रोपाईं गर्दा: DAP ९ किग्रा + पोटाश ३.५ किग्रा + जिङ्क १ किग्रा प्रति रोपनी।',
      topDress1En: 'Urea 4.5 kg per ropani at Active Tillering (~30 days after transplanting).',
      topDress1Ne: 'गाँज हाल्ने समयमा (३० दिन): यूरिया ४.५ किग्रा प्रति रोपनी।',
      topDress2En: 'Urea 4.5 kg per ropani at Panicle Initiation (~60 days after transplanting).',
      topDress2Ne: 'बाली ग्याब हुँदा (६० दिन): यूरिया ४.५ किग्रा प्रति रोपनी।',
      micronutrientsEn: 'Apply Zinc Sulfate @ 25 kg/ha if leaf bronzing or Khaira occurs.',
      micronutrientsNe: 'पात खैरो हुने खैरा रोगमा जिङ्क सल्फेट १.५ किग्रा प्रति रोपनी छर्कनुहोस्।'
    },
    ipmPracticesEn: [
      'Cultivate NARC-recommended stress-tolerant cultivars (e.g. Sukkha Dhan 1-6, Radha-4).',
      'Maintain SRI 20x20 cm grid spacing to allow canopy light penetration.',
      'Set up sex pheromone traps (5/acre) for Yellow Stem Borer monitoring.',
      'Adopt Alternate Wetting & Drying (AWD) irrigation to prevent Brown Planthopper (BPH) buildup.'
    ],
    ipmPracticesNe: [
      'नेपाल कृषि अनुसन्धान परिषद् (NARC) द्वारा अनुमोदित उन्नत बीउ (सुक्खा धान १-६, राधा-४) प्रयोग गर्ने।',
      'SRI प्रविधि अनुसार २०x२० सेमी दुरीमा रोपाईं गर्ने।',
      'गाँभो कीराको लागि प्रति एकड ५ वटा फेरोमोन ट्र्याप राख्ने।',
      'आलोपालो सिँचाइ र सुकाउने (AWD) तरिका अपनाई लाही र फड्के कीरा नियन्त्रण गर्ने।'
    ],
    diseases: [
      {
        id: 'rice-blast',
        nameEn: 'Rice Blast',
        nameNe: 'धानको मरुवा रोग (Blast)',
        botanicalPathogen: 'Magnaporthe oryzae (Fungus)',
        symptomsEn: 'Spindle-shaped lesions with grayish-white centers and dark reddish-brown margins on leaves; neck rot turning brown/black causing heads to collapse.',
        symptomsNe: 'पातमा तक्मा आकारका खरानी रङ्गका थोप्ला र गानो कुहिएर बाला झुक्ने।',
        causeEn: 'Fungal spores driven by high humidity (>90%), cool nights (20-25°C), and excessive nitrogen.',
        causeNe: 'अत्यधिक चिसो रात, बढी ओसिलोपन र अत्यधिक यूरिया प्रयोग।',
        chemicalTreatmentEn: 'Spray Tricyclazole 75% WP (Beam) @ 0.6g/L water OR Kasugamycin 3% SL @ 2ml/L.',
        chemicalTreatmentNe: 'ट्राइसाइक्लाजोल ७५% WP (बीम) ०.६ ग्राम वा कासुगामाइसिन ३% SL २ मिली प्रति लिटर पानीमा मिसाएर छर्कनुहोस्।',
        organicRemedyEn: 'Seed treatment with Trichoderma viride @ 8g/kg seed; spray Pseudomonas fluorescens @ 10g/L.',
        organicRemedyNe: 'ट्राइकोडर्मा भिरिडे ८ ग्राम प्रति किग्रा बीउ उपचार र स्यूडोमोनास बायो-स्प्रे।',
        dosageDetails: {
          tradeNames: ['Beam 75 WP', 'Baan 75 WP', 'Kasu-B'],
          rateFoliar: '0.6 g to 1 g per Litre water',
          perRopani: '30g per Ropani (mixed in 30-50L water)',
          perHectare: '600g per Hectare',
          safetyInterval: '14 days before harvest'
        },
        urgency: 'high',
        environmentalTriggers: 'Cool night temperature (20°C) with fog/dew and excessive Nitrogen.'
      },
      {
        id: 'rice-sheath-blight',
        nameEn: 'Sheath Blight',
        nameNe: 'धानको बारुले कुहिने रोग (Sheath Blight)',
        botanicalPathogen: 'Rhizoctonia solani (Fungus)',
        symptomsEn: 'Oval or irregular greenish-gray water-soaked spots on leaf sheaths near water level, spreading upward with dark brown borders.',
        symptomsNe: 'पानीको सतह नजिक काण्डको फेदमा हरियो-खरानी रङ्गका ओसिला डाबरहरू।',
        causeEn: 'Soil-borne sclerotia favored by dense planting, high humidity, and warm temperatures (28-32°C).',
        causeNe: 'बाक्लो रोपाईं र तातो-ओसिलो मौसम।',
        chemicalTreatmentEn: 'Spray Propiconazole 25% EC (Tilt) @ 1ml/L OR Hexaconazole 5% EC @ 2ml/L water.',
        chemicalTreatmentNe: 'प्रोपिकोनाजोल २५% EC (टिल्ट) १ मिली वा हेक्साकोनाजोल ५% EC २ मिली प्रति लिटर छर्कनुहोस्।',
        organicRemedyEn: 'Foliar spray of Pseudomonas fluorescens @ 10g/L; avoid water stagnation.',
        organicRemedyNe: 'स्यूडोमोनास १० ग्राम प्रति लिटर स्प्रे र खेतको पानी नकाट्ने।',
        dosageDetails: {
          tradeNames: ['Tilt 25 EC', 'Contaf 5 EC', 'Rizolex'],
          rateFoliar: '1 ml to 1.5 ml per Litre water',
          perRopani: '40ml per Ropani',
          perHectare: '750ml per Hectare',
          safetyInterval: '21 days'
        },
        urgency: 'high',
        environmentalTriggers: 'High relative humidity (>95%) and temperatures between 28–32°C.'
      },
      {
        id: 'rice-blb',
        nameEn: 'Bacterial Leaf Blight (BLB)',
        nameNe: 'धानको जीवाणुजन्य डढुवा रोग (BLB)',
        botanicalPathogen: 'Xanthomonas oryzae pv. oryzae (Bacteria)',
        symptomsEn: 'Water-soaked wavy lesions starting from leaf tips turning yellow then bleaching white; bacterial ooze droplets on young leaves in morning.',
        symptomsNe: 'पातका टोप्पाबाट सुरु भई पहेँलिँदै सुक्ने र बिहान झिसमिसेमा जीवाणुको थोपा देखिने।',
        causeEn: 'Vascular bacterial infection spread via wind-blown rain, irrigation water, and clipping seedlings.',
        causeNe: 'हावाहुरी, वर्षाको पानी र बिरामी बीउबाट सड्ने।',
        chemicalTreatmentEn: 'Spray Copper Oxychloride 50% WP @ 2.5g/L + Streptocycline (0.1g/L) water.',
        chemicalTreatmentNe: 'कपर अक्सिक्लोराइड २.५ ग्राम + स्ट्रेप्टोसाइक्लिन ०.१ ग्राम प्रति लिटर पानीमा घोलेर छर्कनुहोस्।',
        organicRemedyEn: 'Spray fresh cow dung slurry extract (5%) mixed with Neem leaf extract.',
        organicRemedyNe: 'गाईको ताजा गोबर (५%) र नीमको झोल मिसाएर स्प्रे गर्ने।',
        dosageDetails: {
          tradeNames: ['Blitox 50 WP', 'Streptocycline', 'Plantomycin'],
          rateFoliar: 'Copper Oxychloride 2.5g + Streptocycline 100mg/L',
          perRopani: '125g Copper + 5g Streptocycline per Ropani',
          perHectare: '2.5 kg Copper + 100g Streptocycline per Hectare',
          safetyInterval: '15 days'
        },
        urgency: 'critical',
        environmentalTriggers: 'Heavy rain, typhoons, flooding, and temperatures of 25–30°C.'
      },
      {
        id: 'rice-false-smut',
        nameEn: 'False Smut',
        nameNe: 'धानको कालो पोके रोग (False Smut)',
        botanicalPathogen: 'Ustilaginoidea virens (Fungus)',
        symptomsEn: 'Individual grains turn into large orange velvet smut balls that burst into dark greenish-black powdery spores.',
        symptomsNe: 'धानका गेडाहरू सुन्तला रङ्गका ठूला पोकेमा परिणत भई पछि कालो धुलो बन्ने।',
        causeEn: 'Air-borne fungal spores infecting individual florets at flowering stage during high rainfall.',
        causeNe: 'फुल फूल्ने समयमा झरी र ओसिलो मौसम।',
        chemicalTreatmentEn: 'Spray Copper Hydroxide 77% WP @ 2g/L or Propiconazole 25% EC @ 1ml/L at booting stage.',
        chemicalTreatmentNe: 'बाली ग्याब हुँदा (घान आउनु अघि) प्रोपिकोनाजोल २५% EC १ मिली प्रति लिटर पूर्व-रोकथाम स्प्रे गर्नुहोस्।',
        organicRemedyEn: 'Remove infected smut heads in plastic bags and destroy; avoid late Urea top-dressing.',
        organicRemedyNe: 'पोके बाला संकलन गरी नष्ट गर्ने र ढिलो गरी यूरिया नहाल्ने।',
        dosageDetails: {
          tradeNames: ['Kocide 2000', 'Tilt', 'Nativo'],
          rateFoliar: '1 ml/L Propiconazole',
          perRopani: '40ml per Ropani',
          perHectare: '750ml per Hectare',
          safetyInterval: '30 days'
        },
        urgency: 'medium',
        environmentalTriggers: 'High relative humidity (>92%) and rainfall during flowering.'
      },
      {
        id: 'rice-bph-stemborer',
        nameEn: 'Stem Borer & Brown Planthopper (BPH)',
        nameNe: 'धानको गाँभो कीरा र फड्के कीरा (BPH)',
        botanicalPathogen: 'Scirpophaga incertulas / Nilaparvata lugens (Insects)',
        symptomsEn: 'Stem Borer: Dead hearts in vegetative stage and white heads at panicle. BPH: Circular patches of dried, scorched brown plants ("Hopper Burn").',
        symptomsNe: 'गाँभो कीराले गाँज सुकाउने/सेतो बाला बनाउने; फड्के कीराले बोट पोले जस्तै डाबर सुकाउने।',
        causeEn: 'Excessive nitrogen fertilizer, chemical pesticide misuse destroying natural spiders, and continuous flooding.',
        causeNe: 'अत्यधिक यूरिया र माकुरा मार्ने विषादीको जथाभावी प्रयोग।',
        chemicalTreatmentEn: 'Stem Borer: Cartap Hydrochloride 50% SP @ 1.5g/L. BPH: Pymetrozine 50% WG @ 0.6g/L or Dinotefuran 20% SG @ 0.4g/L.',
        chemicalTreatmentNe: 'गाँभो कीरा: कार्टाप ५०% SP १.५ ग्राम/लिटर। फड्के कीरा: पाइमेट्रोजिन ०.६ ग्राम वा डिनोटिफुरान ०.४ ग्राम/लिटर।',
        organicRemedyEn: 'Spray Neem Seed Kernel Extract (NSKE 5%) @ 5ml/L; drain field water for 3-4 days.',
        organicRemedyNe: 'नीमको तेल ५ मिली प्रति लिटर स्प्रे र खेतको पानी ४ दिन सुकाउने।',
        dosageDetails: {
          tradeNames: ['Padan 50 SP', 'Chess 50 WG', 'Oshin 20 SG'],
          rateFoliar: 'Pymetrozine 0.6g/L applied at base of tillers',
          perRopani: '25g per Ropani',
          perHectare: '500g per Hectare',
          safetyInterval: '14 days'
        },
        urgency: 'high',
        environmentalTriggers: 'Dense shade, lack of wind circulation, standing water.'
      }
    ]
  },

  maize: {
    cropId: 'maize',
    nameEn: 'Maize (Corn)',
    nameNe: 'मकै खेती',
    scientificName: 'Zea mays',
    npkGuide: {
      targetHa: 'NPK 120:60:40 kg/ha',
      targetRopani: 'DAP 10.5 kg + Potash 3.5 kg + Urea 14 kg per Ropani (500 sq. m)',
      basalEn: 'DAP 10.5 kg + Potash 3.5 kg + FYM Compost 500 kg per ropani at sowing.',
      basalNe: 'बिउ रोप्दा: DAP १०.५ किग्रा + पोटाश ३.५ किग्रा + कम्पोस्ट ५०० किग्रा प्रति रोपनी।',
      topDress1En: 'Urea 7 kg per ropani at Knee-High stage (30-35 days after sowing).',
      topDress1Ne: 'घुँडा सम्म मकै आउँदा: यूरिया ७ किग्रा प्रति रोपनी।',
      topDress2En: 'Urea 7 kg per ropani at Pre-Tasseling / Flowering stage (55-60 days).',
      topDress2Ne: 'घोगा र जुँगा आउने बेला: यूरिया ७ किग्रा प्रति रोपनी।',
      micronutrientsEn: 'Apply Zinc Sulfate @ 1.5 kg per ropani for white bud symptom.',
      micronutrientsNe: 'मकैको गोप्य सुक्ने/सेतो हुने समस्यामा जिङ्क सल्फेट १.५ किग्रा छर्कनुहोस्।'
    },
    ipmPracticesEn: [
      'Practice deep summer plowing to expose overwintering Fall Armyworm pupae to predators.',
      'Intercrop with legumes (Desmodium / Cowpea) as Push-Pull strategy against FAW.',
      'Place funnel pheromone traps (5 per acre) to detect adult moths.',
      'Apply fine sand or wood ash mixed with Neem powder into plant whorls.'
    ],
    ipmPracticesNe: [
      'गर्मीमा गहिरो जोताइ गरी फौजी कीराको पुतली नष्ट गर्ने।',
      'कोसे बाली (सिमी/भटमास) सँग अन्तरबाली लगाई पुश-पुल प्रविधि अपनाउने।',
      'मकैको पोथी (गाँज) भित्र दाना बालुवा र काठको खरानी हाल्ने।',
      'फेरोमोन ट्र्याप राखी फौजी कीराको अनुगमन गर्ने।'
    ],
    diseases: [
      {
        id: 'maize-fall-armyworm',
        nameEn: 'Fall Armyworm (FAW)',
        nameNe: 'मकैको अमेरिकी फौजी कीरा (Fall Armyworm)',
        botanicalPathogen: 'Spodoptera frugiperda (Insect Pest)',
        symptomsEn: 'Deep ragged holes in whorl leaves, heavy sawdust-like brown frass inside central whorl, windowpane damage on young leaves.',
        symptomsNe: 'मकैको पोथी भित्र भुस जस्तै गुहु र पातमा ठूला ठूला पोलेका दुलोहरू।',
        causeEn: 'Migratory nocturnal moth larvae voraciously feeding inside central vegetative whorl.',
        causeNe: 'रातमा उड्ने पुतलीले पोथी भित्र पारेको अण्डाबाट निस्किएका कीरा।',
        chemicalTreatmentEn: 'Whorl application of Spinetoram 11.7% SC (Delegate) @ 0.5ml/L OR Emamectin Benzoate 5% SG (Proclaim) @ 0.4g/L OR Chlorantraniliprole 18.5% SC (Coragen) @ 0.4ml/L water.',
        chemicalTreatmentNe: 'मकैको घोगा/पोथी भित्र स्प्रे: इमामेक्टिन बेन्जोएट (प्रोक्लेम) ०.४ ग्राम वा कोराजन ०.४ मिली प्रति लिटर पानी घोलेर हाल्नुहोस्।',
        organicRemedyEn: 'Apply 1-2g dry sand mixed with neem powder or wood ash directly into every whorl; spray Metarhizium anisopliae @ 5g/L.',
        organicRemedyNe: 'हरेक मकैको पोथी भित्र बालुवा र नीमको सुक्खा धुलो मिसाएर हाल्ने।',
        dosageDetails: {
          tradeNames: ['Proclaim 5 SG', 'Delegate 11.7 SC', 'Coragen 18.5 SC'],
          rateFoliar: 'Emamectin Benzoate 0.4g per Litre water directly aimed at whorl',
          perRopani: '20g Proclaim per Ropani',
          perHectare: '400g Proclaim per Hectare',
          safetyInterval: '14 days'
        },
        urgency: 'critical',
        environmentalTriggers: 'Dry warm weather (25–32°C) without heavy rain flushing whorls.'
      },
      {
        id: 'maize-turcicum-blight',
        nameEn: 'Turcicum Leaf Blight (TLB)',
        nameNe: 'मकैको तुर्सिकम डढुवा रोग (Turcicum Blight)',
        botanicalPathogen: 'Exserohilum turcicum (Fungus)',
        symptomsEn: 'Large long elliptical cigar-shaped grayish-brown lesions on leaves starting from lower canopy, merging to kill entire blade.',
        symptomsNe: 'तुरुन्त सुक्ने चुरोट आकारका लाम्चा खरानी-खैरा डाबरहरू।',
        causeEn: 'Fungal inoculum surviving in crop residue, favored by moderate temperature (18-27°C) and humid foggy days.',
        causeNe: 'ओसिलो कुहिरो र चिसो मौसम।',
        chemicalTreatmentEn: 'Spray Mancozeb 75% WP @ 2.5g/L OR Azoxystrobin 18.2% + Difenoconazole 11.4% SC (Amistar Top) @ 1ml/L water.',
        chemicalTreatmentNe: 'म्यानकोजेब ७५% WP २.५ ग्राम वा एमिस्टार टप १ मिली प्रति लिटर पानीमा छर्कनुहोस्।',
        organicRemedyEn: 'Spray Trichoderma harzianum @ 10g/L; burn infected leaves after harvest.',
        organicRemedyNe: 'ट्राइकोडर्मा १० ग्राम/लिटर स्प्रे गर्ने र रोगी पात जलाउने।',
        dosageDetails: {
          tradeNames: ['Dithane M-45', 'Amistar Top', 'Tilt'],
          rateFoliar: 'Mancozeb 2.5 g/L water',
          perRopani: '100g per Ropani',
          perHectare: '2 kg per Hectare',
          safetyInterval: '21 days'
        },
        urgency: 'high',
        environmentalTriggers: 'High humidity (>90%) with mild temperatures (20–25°C).'
      },
      {
        id: 'maize-stalk-rot',
        nameEn: 'Fusarium Stalk Rot',
        nameNe: 'मकैको फेद/डाँठ कुहिने रोग (Stalk Rot)',
        botanicalPathogen: 'Fusarium moniliforme / Gibberella zeae (Fungus)',
        symptomsEn: 'Internal pith of lower stalk soft, spongy, and pinkish-red; plants prematurely wilt, turn straw-colored, and lodge easily.',
        symptomsNe: 'मकैको डाँठ भित्र गुलाबी/रातो कुहिएर लड्ने र मकै सुक्ने।',
        causeEn: 'Stress-induced fungal infection (drought followed by heavy rain, high plant density, potassium deficiency).',
        causeNe: 'खडेरी पछि भारी झरी र पोटाशको कमी।',
        chemicalTreatmentEn: 'Soil drenching around stalk base with Carbendazim 50% WP @ 2g/L or Metalaxyl + Mancozeb @ 2g/L.',
        chemicalTreatmentNe: 'मकैको फेदमा कार्बेन्डाजिम ५०% WP २ ग्राम प्रति लिटर पानीको झोल ड्रेन्चिङ गर्नुहोस्।',
        organicRemedyEn: 'Apply Trichoderma viride enriched FYM @ 500kg/ha at planting; ensure proper drainage.',
        organicRemedyNe: 'कम्पोस्ट मलमा ट्राइकोडर्मा मिसाएर फेदमा हाल्ने।',
        dosageDetails: {
          tradeNames: ['Bavistin 50 WP', 'Saaf', 'Ridomil Gold'],
          rateFoliar: '2 g/L soil drench at stem base',
          perRopani: '100g per Ropani',
          perHectare: '2 kg per Hectare',
          safetyInterval: '30 days'
        },
        urgency: 'high',
        environmentalTriggers: 'High soil moisture following dry post-flowering period.'
      }
    ]
  },

  wheat: {
    cropId: 'wheat',
    nameEn: 'Wheat',
    nameNe: 'गहुँ खेती',
    scientificName: 'Triticum aestivum',
    npkGuide: {
      targetHa: 'NPK 100:60:40 kg/ha',
      targetRopani: 'DAP 8 kg + Potash 3 kg + Urea 9 kg per Ropani (500 sq. m)',
      basalEn: 'DAP 8 kg + Potash 3 kg + Urea 4.5 kg per ropani at sowing.',
      basalNe: 'छर्ने बेला: DAP ८ किग्रा + पोटाश ३ किग्रा + यूरिया ४.५ किग्रा प्रति रोपनी।',
      topDress1En: 'Urea 4.5 kg per ropani at Crown Root Initiation (CRI) stage exactly 21 days after sowing with 1st irrigation.',
      topDress1Ne: 'पहिलो सिँचाइ (CRI अवस्था - २१ औं दिन): यूरिया ४.५ किग्रा प्रति रोपनी।',
      topDress2En: 'Urea 3 kg per ropani at Booting / Flowering stage (45-50 days).',
      topDress2Ne: 'टुप्पा र ग्याब आउँदा: यूरिया ३ किग्रा प्रति रोपनी।',
      micronutrientsEn: 'Apply Sulfur 80% WDG @ 1 kg/ropani for golden grain development.',
      micronutrientsNe: 'सल्फर १ किग्रा प्रति रोपनी दाना भरिनका लागि हाल्नुहोस्।'
    },
    ipmPracticesEn: [
      'Ensure 1st irrigation precisely at 21 Days After Sowing (Crown Root Initiation stage).',
      'Sow resistant Nepal varieties (e.g. Gautam, Vijay, NL-971, Borlaug 2015).',
      'Eradicate alternate wild barberry bushes near wheat fields to prevent Rust spores.',
      'Use solar heat seed treatment (soaking seeds 4h in summer sun) against Loose Smut.'
    ],
    ipmPracticesNe: [
      'छरेको २१ औं दिनमा पहिलो अनिवार्य (CRI) सिँचाइ दिई यूरिया टप-ड्रेस गर्ने।',
      'रतुवा प्रतिरोधक बीउ (गौतम, विजय, एन.एल. ९७१) छर्ने।',
      'घाममा ४ घण्टा बीउ सुकाएर कालो पोके रोग रोकथाम गर्ने।'
    ],
    diseases: [
      {
        id: 'wheat-yellow-rust',
        nameEn: 'Yellow (Stripe) Rust',
        nameNe: 'गहुँको पहेंलो रतुवा रोग (Yellow Rust)',
        botanicalPathogen: 'Puccinia striiformis f. sp. tritici (Fungus)',
        symptomsEn: 'Linear bright yellow stripe-like pustules arranged in parallel rows on leaf blades, producing bright yellow powdery spores on fingers when touched.',
        symptomsNe: 'पातमा लहरै पहेंला रेखा जस्तै धर्सा परेका डाबर र हातले छुँदा पहेँलो धुलो टाँसिने।',
        causeEn: 'Wind-borne fungal urediniospores spreading rapidly during cool, humid, foggy winter conditions (10-15°C).',
        causeNe: 'शीतलहर, बाक्लो कुहिरो र चिसो मौसम (१०-१५ डिग्री सेल्सीअस)।',
        chemicalTreatmentEn: 'Spray Propiconazole 25% EC (Tilt) @ 1ml/L OR Tebuconazole 25.9% EC @ 1ml/L OR Kresoxim-methyl 44.3% SC @ 1ml/L water.',
        chemicalTreatmentNe: 'प्रोपिकोनाजोल २५% EC (टिल्ट) १ मिली वा टेबुकोनाजोल २५.९% EC १ मिली प्रति लिटर पानीमा मिसाएर तुरुन्त छर्कनुहोस्।',
        organicRemedyEn: 'Foliar spray of Sour Butter-milk (Fermented Whey) 5% solution mixed with Neem oil @ 3ml/L.',
        organicRemedyNe: 'अमिलो मोही (५%) र नीमको तेल मिसाएर छर्कनुहोस्।',
        dosageDetails: {
          tradeNames: ['Tilt 25 EC', 'Folicur 250 EC', 'Ergon'],
          rateFoliar: '1 ml per Litre water',
          perRopani: '30ml per Ropani',
          perHectare: '500ml per Hectare',
          safetyInterval: '30 days'
        },
        urgency: 'critical',
        environmentalTriggers: 'Prolonged winter fog, high humidity, and temperature 10–15°C.'
      },
      {
        id: 'wheat-loose-smut',
        nameEn: 'Loose Smut',
        nameNe: 'गहुँको कालो पोके रोग (Loose Smut)',
        botanicalPathogen: 'Ustilago nuda var. tritici (Fungus)',
        symptomsEn: 'Entire spike/head turned into a black olive-green powdery mass of smut spores, leaving behind only the bare rachis stalk.',
        symptomsNe: 'गहुँको सम्पूर्ण बाला कालो धुलोमा परिणत भई नाङ्गो डाँठ मात्र बाँकी रहने।',
        causeEn: 'Internally seed-borne fungal mycelium dormant inside the grain embryo until germination.',
        causeNe: 'रोगी बीउ भित्र सुसुप्त बसेको ढुसी।',
        chemicalTreatmentEn: 'Seed treatment before sowing with Carboxin 37.5% + Thiram 37.5% DS (Vitavax Ultra) @ 2.5g/kg seed OR Tebuconazole 2 DS @ 1.5g/kg seed.',
        chemicalTreatmentNe: 'रोप्नु अघि बीउ उपचार: भिटाभाक्स (Carboxin + Thiram) २.५ ग्राम प्रति किग्रा बीउमा मोल्नुहोस्।',
        organicRemedyEn: 'Solar heat treatment: Soak seeds in water for 4h on a hot May/June morning, then dry on flat metal sheet under direct sun for 4h.',
        organicRemedyNe: 'बैशाख/जेठको कडा घाममा ४ घण्टा पानीमा भिजाएर बीउ सुकाउने सोझो सौर्य प्रविधि।',
        dosageDetails: {
          tradeNames: ['Vitavax Ultra', 'Raxil 2 DS', 'Bavistin'],
          rateFoliar: 'Seed Dressing: 2.5 g/kg seed',
          perRopani: '25g per 10kg seed',
          perHectare: '250g per 100kg seed',
          safetyInterval: 'N/A (Pre-sowing)'
        },
        urgency: 'medium',
        environmentalTriggers: 'Moist weather during flowering stage of previous crop.'
      }
    ]
  },

  potato: {
    cropId: 'potato',
    nameEn: 'Potato',
    nameNe: 'आलु खेती',
    scientificName: 'Solanum tuberosum',
    npkGuide: {
      targetHa: 'NPK 150:80:150 kg/ha',
      targetRopani: 'DAP 14 kg + Potash 8 kg + Urea 14 kg + FYM 1000 kg per Ropani',
      basalEn: 'DAP 14 kg + Potash 8 kg + Urea 7 kg + FYM Compost 1000 kg per ropani at planting.',
      basalNe: 'आलु पुर्दा: DAP १४ किग्रा + पोटाश ८ किग्रा + यूरिया ७ किग्रा + मल १००० किग्रा प्रति रोपनी।',
      topDress1En: 'Urea 7 kg per ropani during earthing-up (hilling ridges at 30-35 days).',
      topDress1Ne: 'माटो उप्काउने समय (३०-३५ दिन): यूरिया ७ किग्रा प्रति रोपनी।',
      topDress2En: 'Foliar spray of Potassium Nitrate (13:0:45) @ 5g/L during tuber bulking.',
      topDress2Ne: 'दाहाल लाग्ने समयमा पोटासियम नाइट्रेड ५ ग्राम/लिटर फोलिएर स्प्रे।',
      micronutrientsEn: 'Apply Boron 10% @ 500g/ropani to prevent hollow heart in tubers.',
      micronutrientsNe: 'आलु भित्र प्वाल पर्ने रोक्न बोरन ५०० ग्राम प्रति रोपनी हाल्नुहोस्।'
    },
    ipmPracticesEn: [
      'Plant certified disease-free sprouted tubers (30-40g size).',
      'Hill up ridges high (20-25cm) during earthing-up to prevent Potato Tuber Moth (PTM) laying eggs on tubers.',
      'Dehaulm (cut top vines) 10-14 days before harvest to harden tuber skin.',
      'Store seed tubers under Cool Light Storage (diffused light) with Lantana leaves.'
    ],
    ipmPracticesNe: [
      'निरोगी certified बीउ आलु प्रयोग गर्ने।',
      'माटो अग्लो ड्याङ बनाएर आलु पुर्ने।',
      'खन्नु १० दिन अघि आलुको बोट काटेर फाल्ने (Dehaulming)।'
    ],
    diseases: [
      {
        id: 'potato-late-blight',
        nameEn: 'Late Blight',
        nameNe: 'आलुको डढुवा रोग (Late Blight)',
        botanicalPathogen: 'Phytophthora infestans (Oomycete / Water Mold)',
        symptomsEn: 'Rapidly spreading dark water-soaked lesions starting from leaf tips/margins, purplish-black lesions with white cottony mildew underneath in humid morning.',
        symptomsNe: 'पातका घेराबाट कालो हुनु, बिहान पात पछाडि सेतो ढुसी र बोटै डढ्ने।',
        causeEn: 'Highly destructive water-mold pathogen triggered by cool temperatures (12-20°C), fog, dew, and high humidity (>90%).',
        causeNe: 'बाक्लो तुवाँलो, शित र १२-२० डिग्री सेल्सीअस चिसो weather.',
        chemicalTreatmentEn: 'Prophylactic: Mancozeb 75% WP @ 2.5g/L. Curative: Cymoxanil 8% + Mancozeb 64% WP (Moximate) @ 2.5g/L OR Metalaxyl 8% + Mancozeb 64% WP (Ridomil Gold) @ 2g/L OR Dimethomorph 50% WP @ 1g/L water.',
        chemicalTreatmentNe: 'पूर्व-रोकथाम: म्यानकोजेब २.५ ग्राम। डढेको अवस्थामा: रिडोमिल गोल्ड (Metalaxyl + Mancozeb) २ ग्राम वा मोक्सिमेन्ट २.५ ग्राम प्रति लिटर छर्कनुहोस्।',
        organicRemedyEn: 'Foliar spray of Copper Hydroxide 77% WP @ 2g/L; remove infected plants immediately.',
        organicRemedyNe: 'कपर हाइड्रोक्साइड २ ग्राम प्रति लिटर स्प्रे र रोगी बोट उखेल्ने।',
        dosageDetails: {
          tradeNames: ['Ridomil Gold MZ', 'Moximate WP', 'Sekure', 'Kocide'],
          rateFoliar: '2.5 g per Litre water',
          perRopani: '100g per Ropani',
          perHectare: '2 kg per Hectare',
          safetyInterval: '14 days'
        },
        urgency: 'critical',
        environmentalTriggers: 'Continuous cloudy, foggy weather with temperatures between 10–20°C.'
      },
      {
        id: 'potato-early-blight',
        nameEn: 'Early Blight',
        nameNe: 'आलुको पूर्व-डढुवा रोग (Early Blight)',
        botanicalPathogen: 'Alternaria solani (Fungus)',
        symptomsEn: 'Dark brown concentric ring-like spots ("target board" pattern) on older lower leaves surrounded by yellow chlorotic halo.',
        symptomsNe: 'पुराना पातमा चक्र जस्तै धर्सा परेका गोल खैरा डाबरहरू।',
        causeEn: 'Fungal spores favored by alternating wet and dry warm weather (24-30°C).',
        causeNe: 'तातो र सुख्खा-ओसिलो मौसम।',
        chemicalTreatmentEn: 'Spray Chlorothalonil 75% WP (Kavach) @ 2g/L OR Difenoconazole 25% EC (Score) @ 1ml/L water.',
        chemicalTreatmentNe: 'क्लोरोथ्यालोनिल (कवच) २ ग्राम वा डिफेनोकोनाजोल (स्कोर) १ मिली प्रति लिटर स्प्रे गर्नुहोस्।',
        organicRemedyEn: 'Spray Neem oil extract (1500 ppm) @ 4ml/L + Baking soda 2g/L.',
        organicRemedyNe: 'नीमको तेल ४ मिली + बेकिङ सोडा २ ग्राम/लिटर स्प्रे।',
        dosageDetails: {
          tradeNames: ['Kavach 75 WP', 'Score 25 EC', 'Antracol'],
          rateFoliar: '2 g/L Chlorothalonil',
          perRopani: '80g per Ropani',
          perHectare: '1.6 kg per Hectare',
          safetyInterval: '14 days'
        },
        urgency: 'medium',
        environmentalTriggers: 'Heavy dew with warm days (25–30°C).'
      }
    ]
  },

  mustard: {
    cropId: 'mustard',
    nameEn: 'Mustard / Rapeseed',
    nameNe: 'तोरी खेती',
    scientificName: 'Brassica juncea',
    npkGuide: {
      targetHa: 'NPK 80:40:40 kg/ha + 20 kg Sulfur',
      targetRopani: 'DAP 6 kg + Potash 2.5 kg + Urea 6 kg + Sulfur 1 kg per Ropani',
      basalEn: 'DAP 6 kg + Potash 2.5 kg + Urea 3 kg + Sulfur 1 kg per ropani at sowing.',
      basalNe: 'छर्ने बेला: DAP ६ किग्रा + पोटाश २.५ किग्रा + यूरिया ३ किग्रा + सल्फर १ किग्रा प्रति रोपनी।',
      topDress1En: 'Urea 3 kg per ropani after 1st weeding and irrigation (25-30 days after sowing).',
      topDress1Ne: 'पहिलो गोडमेल र सिँचाइ पछि (२५-३० दिन): यूरिया ३ किग्रा प्रति रोपनी।',
      topDress2En: 'Foliar spray of Water Soluble Boron 20% @ 1g/L at flowering.',
      topDress2Ne: 'फुल फूल्ने समयमा बोरन १ ग्राम प्रति लिटर फोलिएर स्प्रे।',
      micronutrientsEn: 'Crucial: Apply Elemental Sulfur 20 kg/ha to boost mustard seed oil content by 4-6%.',
      micronutrientsNe: 'तोरीमा तेलको मात्रा बढाउन सल्फर १ किग्रा प्रति रोपनी अनिवार्य हाल्नुहोस्।'
    },
    ipmPracticesEn: [
      'Sow mustard early (mid-October to early November) to escape peak Mustard Aphid attacks in January.',
      'Install Yellow Sticky Traps (10 per acre) to catch winged aphids.',
      'Spray local biological "Jholmal" (fermented bio-pesticide) for early aphid suppression.',
      'Maintain proper seed rate (400-500g per ropani) for healthy plant spacing.'
    ],
    ipmPracticesNe: [
      'कात्तिक महिना भित्रै तोरी छरेर लाही कीराको प्रकोपबाट जोगाउने।',
      'पहेंलो स्टिकी ट्र्याप (Yellow Sticky Trap) खेतमा राख्ने।',
      'झोलमल वा नीमको घोल छर्केर लाही कीरा नियन्त्रण गर्ने।'
    ],
    diseases: [
      {
        id: 'mustard-aphid',
        nameEn: 'Mustard Aphid',
        nameNe: 'तोरीको लाही कीरा (Mustard Aphid)',
        botanicalPathogen: 'Lipaphis erysimi (Insect Pest)',
        symptomsEn: 'Dense colonies of tiny green/black soft-bodied aphids sucking sap from inflorescence, stems, and pods; plants stunted, leaves curled, pods turn hollow.',
        symptomsNe: 'तोरीको मुना, कोसा र फुलमा बाक्लो लाही कीरा टाँसिएर रस चुस्ने र सुकाउने।',
        causeEn: 'Cloudy, humid, calm winter days in January/February promoting rapid aphid reproduction.',
        causeNe: 'माघ/फगुनको ओसिलो र बादल लागेको तातो चिसो मौसम।',
        chemicalTreatmentEn: 'Spray Imidacloprid 17.8% SL @ 0.3ml/L OR Thiamethoxam 25% WG @ 0.3g/L OR Dimethoate 30% EC (Rogor) @ 1.5ml/L water in evening.',
        chemicalTreatmentNe: 'बेलुकीपख स्प्रे: इमिडाक्लोप्रिड १७.८% SL ०.३ मिली वा थियामेथोक्साम ०.३ ग्राम प्रति लिटर पानीमा घोलेर छर्कनुहोस्।',
        organicRemedyEn: 'Spray Neem seed extract (NSKE 5%) @ 5ml/L OR Jholmal bio-pesticide @ 250ml/L water.',
        organicRemedyNe: 'झोलमल २५० मिली वा नीमको तेल ५ मिली प्रति लिटर स्प्रे गर्नुहोस्।',
        dosageDetails: {
          tradeNames: ['Confidor 17.8 SL', 'Actara 25 WG', 'Rogor 30 EC'],
          rateFoliar: 'Imidacloprid 0.3 ml per Litre water',
          perRopani: '10ml per Ropani',
          perHectare: '200ml per Hectare',
          safetyInterval: '21 days'
        },
        urgency: 'critical',
        environmentalTriggers: 'Overcast cloudy weather with high relative humidity (>75%) in winter.'
      },
      {
        id: 'mustard-alternaria',
        nameEn: 'Alternaria Black Spot',
        nameNe: 'तोरीको कालो थोप्ले/डढुवा रोग (Alternaria Spot)',
        botanicalPathogen: 'Alternaria brassicae / A. brassicicola (Fungus)',
        symptomsEn: 'Concentric dark brown to black circular spots on leaves, stems, and seed pods, causing pods to shrivel and shatter prematurely.',
        symptomsNe: 'पात र कोसामा चक्र जस्तै काला गोल डाबरहरू परी कोसा चाउरिने।',
        causeEn: 'Fungal spores favored by cool temperatures (15-25°C) with prolonged leaf wetness dew.',
        causeNe: 'शित र १५-२५ डिग्री सेल्सीअस चिसो ओसिलोपन।',
        chemicalTreatmentEn: 'Spray Mancozeb 75% WP @ 2g/L OR Iprodione 50% WP @ 2g/L water.',
        chemicalTreatmentNe: 'म्यानकोजेब ७५% WP २ ग्राम वा इप्रोड्रिओन २ ग्राम प्रति लिटर पानीमा छर्कनुहोस्।',
        organicRemedyEn: 'Seed treatment with Trichoderma viride @ 8g/kg seed.',
        organicRemedyNe: 'ट्राइकोडर्मा ८ ग्राम/किग्रा बीउ उपचार गर्ने।',
        dosageDetails: {
          tradeNames: ['Dithane M-45', 'Rovral 50 WP', 'Saaf'],
          rateFoliar: '2 g per Litre water',
          perRopani: '80g per Ropani',
          perHectare: '1.6 kg per Hectare',
          safetyInterval: '21 days'
        },
        urgency: 'high',
        environmentalTriggers: 'High dew and fog with temperatures 15–22°C.'
      }
    ]
  }
};

// ── RAG Context Search Engine ──────────────────────────────────────────────────
export function getAgriculturalRAGContext(
  userQuery: string,
  cropHint?: string,
  diseaseHint?: string
): string {
  const queryLower = userQuery.toLowerCase();
  let matchedCrops: CropKnowledgeProfile[] = [];

  // Determine crop match
  if (cropHint && CROP_KNOWLEDGE_BASE[cropHint.toLowerCase()]) {
    matchedCrops.push(CROP_KNOWLEDGE_BASE[cropHint.toLowerCase()]);
  } else {
    for (const [key, crop] of Object.entries(CROP_KNOWLEDGE_BASE)) {
      if (
        queryLower.includes(key) ||
        queryLower.includes(crop.nameEn.toLowerCase()) ||
        queryLower.includes(crop.nameNe.toLowerCase()) ||
        queryLower.includes(crop.scientificName.toLowerCase())
      ) {
        matchedCrops.push(crop);
      }
    }
  }

  // Fallback to all crops if none matched specifically
  if (matchedCrops.length === 0) {
    matchedCrops = Object.values(CROP_KNOWLEDGE_BASE);
  }

  let ragContext = `=== GROUNDED AGRICULTURAL KNOWLEDGE BASE (NARC & ICAR SOUTH ASIA STANDARDS) ===\n\n`;

  for (const crop of matchedCrops) {
    ragContext += `CROP: ${crop.nameEn} (${crop.nameNe} - ${crop.scientificName})\n`;
    ragContext += `FERTILIZER & DOSAGE SCHEDULE:\n`;
    ragContext += `- Target: ${crop.npkGuide.targetHa}\n`;
    ragContext += `- Ropani Scale: ${crop.npkGuide.targetRopani}\n`;
    ragContext += `- Basal Application: ${crop.npkGuide.basalEn} (${crop.npkGuide.basalNe})\n`;
    ragContext += `- Top Dress 1: ${crop.npkGuide.topDress1En}\n`;
    ragContext += `- Top Dress 2: ${crop.npkGuide.topDress2En}\n`;
    ragContext += `- Micronutrients: ${crop.npkGuide.micronutrientsEn}\n\n`;

    ragContext += `INTEGRATED PEST MANAGEMENT (IPM):\n`;
    crop.ipmPracticesEn.forEach(ipm => {
      ragContext += `* ${ipm}\n`;
    });
    ragContext += `\nDISEASES & PATHOLOGY:\n`;

    for (const d of crop.diseases) {
      if (
        !diseaseHint ||
        d.nameEn.toLowerCase().includes(diseaseHint.toLowerCase()) ||
        d.nameNe.toLowerCase().includes(diseaseHint.toLowerCase()) ||
        d.id.toLowerCase().includes(diseaseHint.toLowerCase())
      ) {
        ragContext += `  - DISEASE: ${d.nameEn} (${d.nameNe})\n`;
        ragContext += `    Pathogen: ${d.botanicalPathogen}\n`;
        ragContext += `    Symptoms: ${d.symptomsEn}\n`;
        ragContext += `    Cause: ${d.causeEn}\n`;
        ragContext += `    Chemical Treatment: ${d.chemicalTreatmentEn}\n`;
        ragContext += `    Nepali Chemical Instruction: ${d.chemicalTreatmentNe}\n`;
        ragContext += `    Organic Remedy: ${d.organicRemedyEn}\n`;
        ragContext += `    Trade Names: ${d.dosageDetails.tradeNames.join(', ')}\n`;
        ragContext += `    Exact Dosage Rate: ${d.dosageDetails.rateFoliar} (${d.dosageDetails.perRopani})\n`;
        ragContext += `    Safety Interval: ${d.dosageDetails.safetyInterval}\n\n`;
      }
    }
    ragContext += `--------------------------------------------------\n\n`;
  }

  return ragContext;
}

// ── Disease Pathology Helper for Scan Results ─────────────────────────────────
export function getDeepPathologyInfo(diseaseName: string, plantName?: string): CropDiseaseInfo | null {
  const dLower = (diseaseName || '').toLowerCase();
  
  for (const crop of Object.values(CROP_KNOWLEDGE_BASE)) {
    for (const d of crop.diseases) {
      if (
        dLower.includes(d.nameEn.toLowerCase()) ||
        dLower.includes(d.id.toLowerCase()) ||
        d.nameEn.toLowerCase().includes(dLower)
      ) {
        return d;
      }
    }
  }
  return null;
}
