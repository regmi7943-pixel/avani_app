import { supabase } from '../lib/supabase';

const GEMINI_API_KEY = (process.env.EXPO_PUBLIC_GEMINI_API_KEY || '') as string;
const GEMINI_API_URL = 'https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent';

export const hasGeminiKey = GEMINI_API_KEY !== 'YOUR_GEMINI_API_KEY_HERE' && GEMINI_API_KEY !== '';

export const GROQ_API_KEY = (process.env.EXPO_PUBLIC_GROQ_API_KEY || '') as string;
export const GROQ_API_URL = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODEL = 'llama-3.3-70b-versatile';

export const hasGroqKey = GROQ_API_KEY !== 'YOUR_GROQ_API_KEY_HERE' && GROQ_API_KEY !== '';

export interface ChatMessage {
  text: string;
  isUser: boolean;
  id?: string;
  timestamp?: Date;
}

const classifySoil = (clay: number, sand: number, silt: number): string => {
  if (clay >= 40) return 'Clay';
  if (sand >= 85) return 'Sandy';
  if (silt >= 80) return 'Silty';
  if (clay >= 27 && sand <= 45) return 'Clay Loam';
  if (sand >= 50 && clay >= 20) return 'Sandy Clay Loam';
  if (silt >= 50 && clay < 27) return 'Silt Loam';
  if (sand >= 43 && clay < 20) return 'Sandy Loam';
  return 'Loamy';
};

const getEstimatedSoilProperties = (lat: number, lon: number) => {
  const seed = Math.sin(lat * 1000 + lon * 10000);
  const hash = (min: number, max: number, offset = 0) => {
    const val = Math.abs(Math.sin(seed + offset));
    return min + val * (max - min);
  };

  let clay = 20;
  let sand = 40;
  let silt = 40;
  let ph = 6.2;
  let organic = 2.4;

  if (lat < 27.2) {
    clay = hash(18, 25, 1);
    silt = hash(52, 68, 2);
    sand = 100 - clay - silt;
    ph = hash(6.3, 7.3, 3);
    organic = hash(2.0, 3.2, 4);
  } else if (lat > 28.0) {
    sand = hash(62, 76, 1);
    clay = hash(8, 14, 2);
    silt = 100 - sand - clay;
    ph = hash(5.1, 5.9, 3);
    organic = hash(0.8, 1.6, 4);
  } else {
    clay = hash(28, 38, 1);
    sand = hash(22, 35, 2);
    silt = 100 - clay - sand;
    ph = hash(5.6, 6.5, 3);
    organic = hash(1.6, 2.6, 4);
  }

  const type = classifySoil(clay, sand, silt);
  return { type, clay, sand, silt, ph, organic };
};

export function getSeasonalContext(date: Date): string {
  const month = date.getMonth(); // 0 = Jan, 1 = Feb, ..., 6 = Jul, ...
  const day = date.getDate();
  
  let nepaliMonth = "";
  let seasonEn = "";
  let seasonNe = "";
  let keyActivities = "";
  let climateDetails = "";
  let scientificGuidelines = "";
  
  if (month === 0) { // January
    nepaliMonth = "Poush / Magh";
    seasonEn = "Winter";
    seasonNe = "Shishir Ritu";
    climateDetails = "Coldest temperatures of the year. High fog and morning dew in the Terai region, limiting sunlight. Soil evaporation is extremely low.";
    keyActivities = "Irrigation of wheat at the crown root initiation (CRI) and late vegetative stages. Weed management in winter crops. Harvesting of sugarcane, winter potatoes, and winter cole crops (cauliflower, cabbage). Nursery preparation for spring vegetables.";
    scientificGuidelines = "Apply light, frequent irrigations to protect crops from frost damage. Maintain soil moisture around field capacity for wheat. Apply micro-nutrients like Boron to winter vegetables to prevent hollow stems.";
  } else if (month === 1) { // February
    nepaliMonth = "Magh / Falgun";
    seasonEn = "Late Winter / Transition to Spring";
    seasonNe = "Shishir to Basanta";
    climateDetails = "Gradual rise in temperature. Low precipitation. Warm days and cool nights. Relative humidity drops.";
    keyActivities = "First or second top-dressing of Urea in wheat (booting stage). Land preparation for spring maize and spring rice. Harvesting of potato, lentils, and winter oilseeds (mustard). Sowing of summer gourds and cucurbits.";
    scientificGuidelines = "Ensure nitrogen top-dressing is done immediately after irrigation or light rainfall. Watch for yellow rust in wheat and apply chemical control like Propiconazole if pustules are observed.";
  } else if (month === 2) { // March
    nepaliMonth = "Falgun / Chaitra";
    seasonEn = "Spring";
    seasonNe = "Basanta Ritu";
    climateDetails = "Dry, windy, and warm. Evapotranspiration increases rapidly. High risk of dry winds causing soil moisture depletion.";
    keyActivities = "Sowing of spring maize (pahaad/Terai). Transplanting spring paddy (Chaite Dhan). Harvesting of wheat, mustard, and winter legumes. Regular irrigation of spring vegetables and early potatoes.";
    scientificGuidelines = "Apply mulching to spring maize and vegetables to conserve moisture. Ensure critical irrigation in wheat at the flowering and grain-filling stages to prevent terminal heat stress.";
  } else if (month === 3) { // April
    nepaliMonth = "Chaitra / Baishakh";
    seasonEn = "Spring / Dry Season";
    seasonNe = "Basanta Ritu";
    climateDetails = "Very hot and dry. Occasional pre-monsoon hailstorms and localized windstorms. Evaporative demand is at its peak.";
    keyActivities = "Peak harvesting, threshing, and storage of wheat. Cultivation and vegetative care of spring maize and Chaite rice. Land preparation for main-season rice (paddy) seedbeds. Sowing of summer vegetables.";
    scientificGuidelines = "Dry wheat grains to under 12% moisture before storage to prevent post-harvest mold and grain weevils. Implement drip or sprinkler irrigation for vegetables to maximize water use efficiency.";
  } else if (month === 4) { // May
    nepaliMonth = "Baishakh / Jestha";
    seasonEn = "Pre-monsoon / Summer";
    seasonNe = "Grishma Ritu";
    climateDetails = "Extremely hot. High heat-wave conditions in the Terai. Pre-monsoon showers begin. Soil temperature is high.";
    keyActivities = "Sowing of main-season rice (paddy) nursery beds (nurseries). Weeding and earthing up of spring maize. Harvesting of spring potatoes and early summer vegetables. Land preparation for main paddy fields.";
    scientificGuidelines = "Treat rice seeds with fungicides before sowing in nursery beds to prevent blast and damping-off. Apply organic manure (FYM or compost) during land preparation to improve water retention capacity before monsoon.";
  } else if (month === 5) { // June
    nepaliMonth = "Jestha / Ashadh";
    seasonEn = "Onset of Monsoon";
    seasonNe = "Varsha Ritu";
    climateDetails = "High rainfall begins with the arrival of the monsoonal winds from the Bay of Bengal. High relative humidity (70-90%). Frequent showers.";
    keyActivities = "Onset of main-season rice transplanting. Seedlings are uprooted from nurseries and transplanted to puddled clayey/loamy fields. Harvesting of spring maize. Weeding and fertilizing of summer vegetables.";
    scientificGuidelines = "Keep standing water depth of 2-3 cm in transplanted rice fields to prevent weed growth. Do not apply chemical nitrogen (urea) during heavy rain events to prevent runoff and leaching.";
  } else if (month === 6) { // July
    nepaliMonth = "Ashadh / Shrawan";
    seasonEn = "Peak Monsoon";
    seasonNe = "Varsha Ritu";
    climateDetails = "Heaviest rainfall of the year. Saturated soil. Extremely high humidity (85-98%). Low sunshine hours due to thick cloud cover. Active river floodings in lowlands.";
    keyActivities = "Peak main-season rice transplanting (celebration of Ashadh 15 - Dhan Ropain Diwas). Uprooting and transplanting late paddy seedlings. Weeding of early transplanted paddy (25-30 days post-transplant). Drainage management in upland maize and ginger fields to prevent waterlogging.";
    scientificGuidelines = "Maintain standing water of 3-5 cm in paddy fields to support tillering. Ensure rapid drainage in maize, ginger, and turmeric fields; even 24 hours of waterlogging can cause severe rhizome/root rot. Delay pesticide or foliar fertilizer spraying if rain is forecasted within 4 hours.";
  } else if (month === 7) { // August
    nepaliMonth = "Shrawan / Bhadra";
    seasonEn = "Active Monsoon";
    seasonNe = "Varsha Ritu";
    climateDetails = "Hot, wet, and highly humid. Warm monsoon temperatures foster rapid weed growth and fungal disease proliferation. Saturated fields.";
    keyActivities = "First or second top-dressing of Urea in rice (active tillering stage, 30-40 days post-transplanting). Hand weeding in paddy. Managing pests like Stem Borer and diseases like Rice Blast. Sowing of early winter vegetables (cole crops) in raised nursery beds under plastic tunnels.";
    scientificGuidelines = "Apply Urea in split doses (e.g., 30 kg/ha at tillering) when the field has thin water film, avoiding deep standing water. Monitor humidity-induced Blast disease (diamond-shaped lesions) and spray Tricyclazole if threshold is reached.";
  } else if (month === 8) { // September
    nepaliMonth = "Bhadra / Ashwin";
    seasonEn = "Late Monsoon / Transition to Autumn";
    seasonNe = "Varsha to Sharad";
    climateDetails = "Monsoon rain begins to recede. Sunny days become more frequent. Moderate temperatures. Relative humidity begins to fall.";
    keyActivities = "Second top-dressing of Urea in rice (panicle initiation stage, 50-60 days post-transplanting). Harvesting summer maize in mid-hills. Weeding and fertilization of summer vegetables. Nursery management of winter crops.";
    scientificGuidelines = "Ensure rice fields do not face water stress during flowering and panicle initiation, as drought at this stage causes blank grains (chaff). Maintain at least 5 cm of water.";
  } else if (month === 9) { // October
    nepaliMonth = "Ashwin / Kartik";
    seasonEn = "Autumn";
    seasonNe = "Sharad Ritu";
    climateDetails = "Clear, sunny skies and pleasant temperatures. Cool nights. Soil moisture begins to deplete in rainfed areas. Dry atmosphere.";
    keyActivities = "Harvesting, threshing, and drying of main-season rice (paddy). Land preparation and sowing of early wheat, winter mustard (Tori), potato, and winter legumes (lentils, chickpeas). Planting winter vegetables.";
    scientificGuidelines = "Drain rice fields 10-15 days before harvest to facilitate mechanical harvesting and uniform grain drying. Sow wheat and mustard when soil is at optimum moisture (vatar) for uniform germination.";
  } else if (month === 10) { // November
    nepaliMonth = "Kartik / Mangsir";
    seasonEn = "Late Autumn";
    seasonNe = "Hemanta Ritu";
    climateDetails = "Dry, clear, and cool. Rapidly falling night temperatures. High dew formation in the morning. Zero monsoonal rain risk.";
    keyActivities = "Peak wheat sowing (Terai and mid-hills). Sowing and fertilization of winter oilseeds. Rice threshing, cleaning, and dry grain storage. Transplanting winter vegetables. Early potato earthing up.";
    scientificGuidelines = "Sow wheat seeds at a depth of 4-5 cm. Apply recommended basal fertilizers: DAP (100 kg/ha), Muriate of Potash (60 kg/ha), and Urea (50 kg/ha). Treat seeds with Vitavax or Trichoderma.";
  } else if (month === 11) { // December
    nepaliMonth = "Mangsir / Poush";
    seasonEn = "Early Winter";
    seasonNe = "Shishir Ritu";
    climateDetails = "Cold and dry. Moderate to thick fog in the Terai region. Short days with low sunlight hours. Low soil temperatures.";
    keyActivities = "First irrigation of wheat at Crown Root Initiation (CRI) stage (20-25 days after sowing), followed by first Urea top-dressing. Weeding in wheat and mustard. Earthing up and fertilization of potato. Harvesting sugarcane.";
    scientificGuidelines = "The CRI stage is the most critical irrigation window for wheat; water stress now will permanently reduce tillers. Top-dress with Urea at 50 kg/ha immediately after this first irrigation.";
  }

  return `Seasonal & Timeline Context:
- Current Local Date: ${date.toISOString().split('T')[0]}
- Approximate Nepalese Month: ${nepaliMonth}
- Current Season: ${seasonEn} (${seasonNe})
- Monsoonal/Climate Details: ${climateDetails}
- Peak Agricultural Tasks in Nepal: ${keyActivities}
- Recommended Farm Management Guidelines:
${scientificGuidelines}`;
}

/**
 * Fetches the user's field data from Supabase to serve as context for RAG
 */
async function getFieldsContext(): Promise<string> {
  try {
    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (!user) return 'No active user session found.';

    const { data: fields, error } = await supabase
      .from('fields')
      .select('*')
      .eq('user_id', user.id);

    if (error || !fields || fields.length === 0) {
      return 'The farmer currently has no active fields registered in the database.';
    }

    const today = new Date('2026-07-04'); // Lock today's date for consistent timeline matching

    let context = 'Here is the farmer\'s current registered fields status:\n';
    fields.forEach((field, index) => {
      const isPlanned = field.status === 'planned';
      let stageInfo = '';
      if (isPlanned) {
        stageInfo = `⚠️ PLANNED / UNPLANTED FIELD (Muddy / Prepared Land stage). NO CROPS PLANTED YET. Sowing is scheduled for the future.`;
      } else {
        let days = 0;
        if (field.planting_date) {
          const pDate = new Date(field.planting_date);
          const diff = today.getTime() - pDate.getTime();
          days = Math.max(0, Math.floor(diff / (1000 * 60 * 60 * 24)));
        }
        stageInfo = `ACTIVE GROWING CROP (${days} days since planting, planted on ${field.planting_date || 'recent'}).`;
      }

      // Calculate center coordinate of the boundaries
      let lat = 27.7172;
      let lon = 85.3240;
      if (field.boundaries) {
        try {
          const bounds = typeof field.boundaries === 'string' ? JSON.parse(field.boundaries) : field.boundaries;
          if (Array.isArray(bounds) && bounds.length > 0) {
            lat = bounds.reduce((sum: number, p: any) => sum + (p.latitude || p.lat || 0), 0) / bounds.length;
            lon = bounds.reduce((sum: number, p: any) => sum + (p.longitude || p.lon || 0), 0) / bounds.length;
          }
        } catch (err) {
          console.warn('Error parsing boundaries for field context:', err);
        }
      }
      
      const soilProps = getEstimatedSoilProperties(lat, lon);

      context += `${index + 1}. Field Name: "${field.name}"\n`;
      context += `   - Field Growth Stage & Status: ${stageInfo}\n`;
      context += `   - Crop Type (Target/Active): ${field.crop_type}\n`;
      context += `   - Soil Classification: ${field.soil_type || soilProps.type || 'Unknown'}\n`;
      context += `     * Soil Chemistry: pH ${soilProps.ph.toFixed(1)}, Organic Matter ${soilProps.organic.toFixed(2)}%\n`;
      context += `     * Soil Texture: Clay ${soilProps.clay.toFixed(1)}%, Sand ${soilProps.sand.toFixed(1)}%, Silt ${soilProps.silt.toFixed(1)}%\n`;
      context += `   - Area Dimensions: ${field.area} ${field.area_unit.toUpperCase()}\n`;
      if (field.health_score) {
        context += `   - Soil Health Index: ${field.health_score}%\n`;
      }
    });

    return context;
  } catch (err) {
    console.warn('Error fetching fields RAG context:', err);
    return 'Could not retrieve registered fields from database due to connection error.';
  }
}

/**
 * Fetches real-time weather details for the user's location to serve as context for RAG
 */
async function getWeatherContext(): Promise<string> {
  try {
    // Default to central coords (Kathmandu) if no fields are present
    let lat = 27.7172;
    let lon = 85.3240;

    const { data: { session } } = await supabase.auth.getSession();
    const user = session?.user ?? null;
    if (user) {
      const { data: fields } = await supabase
        .from('fields')
        .select('boundaries')
        .eq('user_id', user.id)
        .limit(1);

      if (fields && fields[0]?.boundaries) {
        const bounds = fields[0].boundaries as any;
        if (Array.isArray(bounds) && bounds.length > 0) {
          lat = bounds[0].latitude || lat;
          lon = bounds[0].longitude || lon;
        }
      }
    }

    const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&current_weather=true&hourly=relative_humidity_2m,precipitation_probability,cloud_cover`;
    const res = await fetch(url);
    if (!res.ok) throw new Error('Weather API request failed');
    const data = await res.json();

    const temp = data?.current_weather?.temperature ?? 27.5;
    const windSpeed = data?.current_weather?.windspeed ?? 12.0;
    const weatherCode = data?.current_weather?.weathercode ?? 0;
    
    const hourIndex = new Date().getHours();
    const currentCloudCover = data?.hourly?.cloud_cover?.[hourIndex] ?? data?.hourly?.cloud_cover?.[0] ?? 0;
    const currentRainProb = data?.hourly?.precipitation_probability?.[hourIndex] ?? data?.hourly?.precipitation_probability?.[0] ?? 0;

    let desc = 'Clear sky';
    if (weatherCode === 1 || weatherCode === 2 || weatherCode === 3) {
      if (currentCloudCover > 70 || currentRainProb > 35) {
        desc = 'Overcast / Monsoon clouds building up (Rain expected soon)';
      } else if (weatherCode === 3) {
        desc = 'Overcast / Cloudy skies';
      } else {
        desc = 'Partly Cloudy';
      }
    } else if ((weatherCode >= 51 && weatherCode <= 67) || (weatherCode >= 80 && weatherCode <= 82)) {
      desc = 'Active rain showers / Precipitation';
    } else if (weatherCode >= 95) {
      desc = 'Thunderstorms / Lightning warning active';
    }

    return `Current Weather Status (Location: Lat ${lat.toFixed(2)}, Lon ${lon.toFixed(2)}):
- Temperature: ${temp}°C
- Condition: ${desc} (Code ${weatherCode})
- Precipitation Risk: ${currentRainProb}% chance of rain
- Cloud Cover: ${currentCloudCover}% density
- Wind Speed: ${windSpeed} km/h
- Seasonal Climate: Monsoon summer growing cycle`;
  } catch (err) {
    console.warn('Error fetching weather RAG context:', err);
    return `Current Weather Status (Estimated Kathmandu Summer):
- Temperature: 28°C
- Condition: Cloudy with active rain showers
- Seasonal Climate: Monsoon active (high humidity, frequent rain)`;
  }
}

/**
 * Nepal Crop Lifecycle Database — sourced from FAO, NARC, IRRI, JICA, nepjol.info
 * Each crop has full sowing-to-harvest lifecycle data for the AI to reason through
 * every growth stage's water, temperature, and rainfall requirements.
 */
const NEPAL_CROP_LIFECYCLE_DB = `
NEPAL CROP LIFECYCLE DATABASE (Full Stage-by-Stage Analysis):

1. RICE (DHAN / PADDY) — Nepal's #1 crop
   - Sowing Window: June 15 – July 31 (Ashadh/Shrawan). National Paddy Day = Ashadh 15.
   - Total Duration: 120–150 days (short 100–120d, medium 130–150d)
   - Stages: Nursery (20-30d) → Transplanting → Tillering (30-40d post-transplant) → Panicle Initiation (50-60d) → Flowering (70-80d) → Grain Fill (90-110d) → Harvest (120-150d)
   - Water: Standing water 3-5cm during tillering through flowering. Drain 10-15 days before harvest.
   - Temperature: 20-35°C optimal. Fails below 15°C at flowering (causes sterile grains).
   - Monsoon Dependency: Relies entirely on monsoon rain June–September for free irrigation. Post-monsoon grain-fill uses residual soil moisture. Harvest aligns perfectly with dry October.
   - WHY IT WORKS IN JULY: Monsoon provides 90+ days of free water. Harvest hits dry October for clean threshing.
   - FAILURE RISK: Late transplanting after August 15 → shortened grain-fill → 30-40% yield loss.

2. MAIZE (MAKAI / CORN) — Nepal's #2 cereal
   - Sowing Window: February–April (spring/summer season). NOT July.
   - Total Duration: 90–125 days
   - Stages: Emergence (7-10d) → Vegetative (30-40d) → Tasseling/Silking (50-65d) → Grain Fill (70-100d) → Maturity/Harvest (90-125d)
   - Water: Needs 500-600mm total. EXTREMELY sensitive to drought during silking/tasseling. Needs weekly deep irrigation at grain-fill.
   - Temperature: 18-32°C optimal.
   - CRITICAL PROBLEM WITH JULY SOWING: Silking hits October (dry, zero rain). Grain-fill hits November (bone dry, frost risk in hills). Over 80% of Nepal's maize is rainfed — no irrigation means dead crop.
   - WHY IT FAILS IN JULY: Maize planted Feb-April gets harvested by August-September DURING monsoon. July sowing means critical stages hit post-monsoon drought.
   - CORRECT SEASON: Plant February-April, harvest August-September.

3. WHEAT (GAHU) — Winter staple
   - Sowing Window: November–December (Kartik/Mangsir)
   - Total Duration: 120–150 days
   - Stages: Germination (7-10d) → CRI Stage (20-25d) → Tillering (40-50d) → Booting (60-70d) → Flowering (80-90d) → Grain Fill (100-120d) → Harvest (120-150d)
   - Water: 300-380mm total. 6-7 irrigations. Critical at CRI stage (20-25d) and flowering.
   - Temperature: 10-25°C. Thrives in cool winter. Heat stress kills it above 32°C.
   - WHY IT CANNOT BE PLANTED IN JULY: 35°C monsoon heat will kill wheat seedlings. Wheat needs cool, dry winters.

4. POTATO (AALU)
   - Sowing Window: September-November (Terai), August-November (mid-hills)
   - Total Duration: 90-120 days
   - Water: High water needs during tuber formation. Waterlogging causes rot. Stop irrigation 15-20 days before harvest.
   - Temperature: 15-25°C optimal. Above 30°C tuber formation stops.
   - WHY NOT JULY: 85-98% monsoon humidity + saturated soil = guaranteed blight and tuber rot.

5. MUSTARD (TORI)
   - Sowing Window: Late September–October
   - Total Duration: 90-120 days
   - Water: 200-400mm total. Only 2-3 irrigations needed. Critical at branching (30d) and pod formation (60-65d).
   - WHY NOT JULY: Monsoon humidity causes fungal diseases. Mustard needs cool, dry conditions.

6. LENTILS (MASURO/DAL)
   - Sowing Window: October–November (relay crop in rice fields using residual moisture)
   - Total Duration: 100-120 days
   - Water: 250-450mm. Drought-tolerant. EXTREMELY sensitive to waterlogging — will die in standing water.
   - WHY NOT JULY: Monsoon waterlogging is fatal. Lentils thrive on residual post-rice moisture.

7. SUGARCANE (UKHU)
   - Sowing Window: February-March (spring) or September-October (autumn)
   - Total Duration: 10-15 MONTHS (longest crop in Nepal)
   - Water: 1,500-2,500mm annual. Highest water demand of any Nepal crop.
   - CRITICAL PROBLEM: Most Terai farmers cannot irrigate through the entire dry winter/spring (Nov-May = 7 months of no rain). Without canal/tube-well irrigation, sugarcane dies.
   - WHY RISKY IN JULY: Already should have been planted months ago. Late planting = immature cane at harvest.

8. MILLET (KODO)
   - Sowing Window: July-August (nursery), transplant early September
   - Total Duration: 60-120 days depending on variety
   - Water: 500-1000mm. Drought-tolerant. Thrives in poor soils.
   - WHY IT WORKS NOW: Short duration catches tail end of monsoon. Harvest by October-November.

9. GINGER (ADUWA)
   - Sowing Window: March-April (Chaitra)
   - Total Duration: 8-9 months
   - Water: Needs consistent moisture but VERY sensitive to waterlogging — rhizome rot is the #1 killer.
   - WHY RISKY IN JULY: Peak monsoon waterlogging destroys rhizomes unless field has perfect drainage.

10. VEGETABLES (SUMMER)
    - Tomato, Capsicum, Cucumber in monsoon: HIGH RISK of fungal blight, bacterial wilt in 85-98% humidity.
    - Only viable under plastic tunnels/greenhouses with disease management.
`;

/**
 * Forward-looking weather projection based on Nepal's known monsoon climatology.
 * Sources: DHM Nepal (dhm.gov.np), FAO, Nepal Meteorological records.
 * Monsoon withdrawal date: ~October 2 (normal), sometimes delayed to mid-October.
 * 80% of annual rainfall occurs June-September.
 */
export function getForwardWeatherProjection(currentMonth: number): string {
  const projections: Record<number, string> = {
    0: `FORWARD WEATHER PROJECTION (Jan → May):
- January: Cold & dry. Fog in Terai. Frost risk in hills. Minimal rain.
- February: Warming begins. Dry. Good for land preparation.
- March: Hot & windy. Very dry. High evaporation.
- April: Very hot. Pre-monsoon hailstorm risk. Dry.
- May: Extreme heat. Pre-monsoon showers begin late May.`,
    1: `FORWARD WEATHER PROJECTION (Feb → Jun):
- February: Cool, dry. Good for spring sowing.
- March: Dry, windy, hot. Soil moisture depletes fast.
- April: Peak dry heat. Pre-monsoon storms possible.
- May: Extreme heat (38-42°C Terai). Sporadic pre-monsoon showers.
- June: MONSOON ARRIVES mid-June. Heavy daily rainfall begins.`,
    2: `FORWARD WEATHER PROJECTION (Mar → Jul):
- March: Hot, dry, windy. Irrigation critical for spring crops.
- April: Peak heat. Hailstorm risk.
- May: Extreme heat. Pre-monsoon showers start.
- June: Monsoon onset. Heavy rain (150-300mm/month).
- July: PEAK MONSOON. 200-500mm rainfall. 85-98% humidity.`,
    3: `FORWARD WEATHER PROJECTION (Apr → Aug):
- April: Hot & dry. Pre-monsoon thunderstorms.
- May: Extreme heat. Pre-monsoon showers intensify.
- June: Full monsoon. Continuous rain. Fields saturated.
- July: Peak monsoon. Heaviest rainfall of year.
- August: Active monsoon continues. Warm & very wet.`,
    4: `FORWARD WEATHER PROJECTION (May → Sep):
- May: Extreme heat. Pre-monsoon showers.
- June: Monsoon arrives. Heavy daily rainfall.
- July: Peak monsoon (200-500mm).
- August: Active monsoon (200-400mm). High humidity.
- September: Monsoon begins retreating. LAST reliable rains.`,
    5: `FORWARD WEATHER PROJECTION (Jun → Oct):
- June: Monsoon active. Daily rain (150-300mm/month).
- July: PEAK MONSOON. Heaviest rain. Saturated soils.
- August: Active monsoon continues. Fungal disease risk high.
- September: Monsoon retreating. Last reliable rains by end-Sep.
- October: DRY. Monsoon withdraws ~Oct 2. Clear skies. Cool nights. ZERO reliable rain.`,
    6: `FORWARD WEATHER PROJECTION (Jul → Nov):
- July (NOW): PEAK MONSOON. 200-500mm rain. 85-98% humidity. Saturated fields.
- August: Active monsoon. 200-400mm rain. Warm & wet.
- September: Monsoon retreating. Last reliable rains. 100-200mm.
- October: DRY. Monsoon officially withdraws ~Oct 2. Clear skies. NO rain.
- November: BONE DRY. Zero rain. Frost risk in hills. Night temps drop sharply.`,
    7: `FORWARD WEATHER PROJECTION (Aug → Dec):
- August: Active monsoon. Heavy rain continues.
- September: Monsoon retreating. Rainfall decreasing.
- October: DRY. Monsoon withdrawal. Clear skies.
- November: Bone dry. Cold nights. Zero rain.
- December: Cold, dry, foggy in Terai. Frost in hills.`,
    8: `FORWARD WEATHER PROJECTION (Sep → Jan):
- September: Last monsoon rains. Decreasing rainfall.
- October: DRY. Clear skies. Cool pleasant weather.
- November: Bone dry. Cold. Zero rain.
- December: Cold & dry. Heavy fog Terai. Frost hills.
- January: Coldest month. Dry. Frost risk.`,
    9: `FORWARD WEATHER PROJECTION (Oct → Feb):
- October: DRY. Post-monsoon. Cool, clear.
- November: Dry & cold. Zero rain.
- December: Cold, foggy, dry.
- January: Coldest. Dry. Frost risk.
- February: Warming begins. Still dry.`,
    10: `FORWARD WEATHER PROJECTION (Nov → Mar):
- November: Dry, cold. Zero rain.
- December: Cold, foggy, dry.
- January: Coldest month. Frost risk.
- February: Warming. Dry. Land prep begins.
- March: Hot & dry. Wind increases.`,
    11: `FORWARD WEATHER PROJECTION (Dec → Apr):
- December: Cold, dry, foggy.
- January: Coldest. Frost risk.
- February: Warming. Dry.
- March: Hot, dry, windy.
- April: Very hot. Pre-monsoon storms begin.`
  };
  return projections[currentMonth] || projections[6];
}

/**
 * Nepal Crop Viability Table — strict plant/don't-plant reality check per month.
 * Sources: NARC, FAO GIEWS Nepal, FEWS NET, GeoKrishi, krishipatrika.com
 */
export function getCropViabilityTable(currentMonth: number): string {
  const tables: Record<number, string> = {
    0: `NEPAL CROP VIABILITY — JANUARY:
✅ ONGOING: Wheat (irrigate at CRI stage NOW). Winter vegetables.
✅ HARVEST: Sugarcane, winter potatoes, cauliflower, cabbage.
❌ DO NOT PLANT: Rice, Maize, Millet (wrong season — too cold, no monsoon).`,
    1: `NEPAL CROP VIABILITY — FEBRUARY:
✅ PLANT NOW: Spring Maize (hills/Terai). Land prep for spring rice nursery.
✅ ONGOING: Wheat (top-dress urea). Harvest potatoes, lentils, mustard.
❌ DO NOT PLANT: Main-season Rice (too early, no monsoon for 4 months).`,
    2: `NEPAL CROP VIABILITY — MARCH:
✅ PLANT NOW: Spring Maize. Spring Rice (Chaite Dhan) transplanting. Ginger. Summer vegetables.
✅ HARVEST: Wheat, mustard, winter legumes.
❌ DO NOT PLANT: Main-season Rice (wait for monsoon in June).`,
    3: `NEPAL CROP VIABILITY — APRIL:
✅ PLANT NOW: Spring Maize (care). Chaite Rice. Summer vegetables. Ginger.
✅ HARVEST: Wheat (threshing/storage).
✅ PREPARE: Main-season rice seedbeds (May sowing).
❌ DO NOT PLANT: Wheat, Mustard, Lentils (winter crops — wrong season).`,
    4: `NEPAL CROP VIABILITY — MAY:
✅ PLANT NOW: Rice nursery beds (main season). Summer vegetables.
✅ ONGOING: Spring Maize (weeding, earthing up).
✅ PREPARE: Main paddy field puddling.
❌ DO NOT PLANT: Wheat, Potato, Mustard (heat will kill them).`,
    5: `NEPAL CROP VIABILITY — JUNE:
✅ PLANT NOW: Main-season RICE transplanting begins (THE month for rice).
✅ HARVEST: Spring Maize.
⚠️ RISKY: Summer vegetables (fungal disease in high humidity).
❌ DO NOT PLANT: Wheat, Potato, Mustard, Lentils (wrong season entirely).
❌ DO NOT PLANT: New Maize sowing (silking will hit dry October — crop failure without irrigation).`,
    6: `NEPAL CROP VIABILITY — JULY (PEAK MONSOON):
✅ PLANT NOW: RICE — this is THE month. Peak transplanting. Dhan Ropain Diwas.
✅ ACCEPTABLE: Millet nursery (for September transplanting).
⚠️ RISKY: Ginger, Turmeric (waterlogging risk — needs excellent drainage only).
❌ DO NOT PLANT: Maize (NEW sowing) — silking hits dry October with zero rain. Dead crop without irrigation.
❌ DO NOT PLANT: Wheat, Mustard, Lentils, Potato — winter crops, completely wrong season.
❌ DO NOT PLANT: Tomato, Capsicum — fungal death in 85-98% monsoon humidity.
❌ DO NOT RECOMMEND: Sugarcane (needs 12-month commitment + winter irrigation most farmers lack).`,
    7: `NEPAL CROP VIABILITY — AUGUST:
✅ ONGOING: Rice (first urea top-dressing at tillering, 30-40d post-transplant). Weeding.
✅ PLANT NOW: Millet nursery. Early winter vegetable nurseries (under plastic tunnels).
⚠️ MONITOR: Rice Blast disease (humidity-driven). Stem Borer pest.
❌ DO NOT PLANT: Wheat, Potato, Mustard (too early, too wet, too hot).
❌ DO NOT START: New Maize (even worse than July — only 1-2 months of monsoon left).`,
    8: `NEPAL CROP VIABILITY — SEPTEMBER:
✅ ONGOING: Rice (second urea top-dressing at panicle initiation). Critical water stage.
✅ PLANT NOW: Millet transplanting. Winter vegetable nurseries.
✅ PREPARE: Land for wheat, potato, mustard (October/November sowing).
⚠️ LATE: Rice transplanting (if not done by now, yield loss is severe).`,
    9: `NEPAL CROP VIABILITY — OCTOBER:
✅ HARVEST: Main-season Rice. Drain fields 10-15 days before harvest.
✅ PLANT NOW: Wheat, Potato (Terai), Mustard, Lentils, winter vegetables.
✅ PREPARE: Post-rice wheat sowing (rice-wheat rotation).
❌ DO NOT PLANT: Rice (monsoon over — no water source).`,
    10: `NEPAL CROP VIABILITY — NOVEMBER:
✅ PLANT NOW: Peak wheat sowing. Winter oilseeds. Potato planting.
✅ HARVEST: Late rice. Rice threshing and grain storage.
❌ DO NOT PLANT: Rice, Maize, Millet (cold, dry — no monsoon for 7 months).`,
    11: `NEPAL CROP VIABILITY — DECEMBER:
✅ ONGOING: Wheat (first irrigation at CRI stage, 20-25d after sowing). First urea top-dress.
✅ PLANT: Late potato (hills). Winter vegetables. Harvest sugarcane.
❌ DO NOT PLANT: Rice, Maize (cold, dry, wrong season).`
  };
  return tables[currentMonth] || tables[6];
}

/**
 * Knowledge Base of Crop care guides for RAG fallback or contextual injection
 */
const CROP_GUIDELINES_DB = {
  rice: `RICE (PADDY) CARE SHEET:
- Water: Standing water of 3-5 cm depth is required during the active tillering and panicle stages.
- Fertilizers: Apply Nitrogen (urea) at days 25-30 (tillering) and days 50-55 (panicle initiation).
- Disease prevention: Watch for Blast (gray eye-spots) and Blight (yellow stripes). Maintain drainage if Blight spreads.`,
  wheat: `WHEAT CARE SHEET:
- Irrigation: Irrigate at Crown Root Initiation (CRI) stage (20-25 days after sowing) and flowering (80-85 days).
- Disease prevention: Check for Yellow/Strip Rust. Apply propiconazole if rust pustules appear.`,
  maize: `MAIZE (CORN) CARE SHEET:
- Water: Extremely sensitive to drought during silking and tasseling phases. Ensure weekly deep irrigation.
- Pest prevention: Watch for Fall Armyworm. Apply neem-based insect repellents early in the morning.`,
};

/**
 * Local Simulator RAG responses (used when Gemini Key is not set)
 */
function runLocalRagSimulator(userMessage: string, fieldsCtx: string, weatherCtx: string): string {
  const query = userMessage.toLowerCase();
  
  // RAG Matching
  let matchingCrop = '';
  if (query.includes('rice') || query.includes('paddy') || query.includes('धान')) matchingCrop = 'rice';
  else if (query.includes('wheat') || query.includes('गहुँ')) matchingCrop = 'wheat';
  else if (query.includes('maize') || query.includes('corn') || query.includes('मकै')) matchingCrop = 'maize';

  let responseText = '';

  if (query.includes('weather') || query.includes('rain') || query.includes('paniparyo')) {
    responseText = `Based on your real-time farm coordinates, here is the current forecast:\n${weatherCtx}\n\nRecommendations:\n`;
    if (weatherCtx.includes('rain') || weatherCtx.includes('rainfall') || weatherCtx.includes('Thunderstorm')) {
      responseText += `• Rain is forecasted. Delay any planned chemical spraying or fertilizer top-dressing so it doesn't wash away.\n• Ensure field drainage trenches are clear to avoid waterlogging for non-paddy crops.`;
    } else {
      responseText += `• Weather is dry. Perfect conditions for applying foliar spray, weeding, or nitrogen application. Ensure regular irrigation flow is open.`;
    }
  } else if (query.includes('field') || query.includes('planted') || query.includes('my farm')) {
    responseText = `Here is your current database status:\n${fieldsCtx}\n\nHow can I help you optimize fertilizer schedules or identify diseases on any of these fields?`;
  } else if (matchingCrop) {
    const guidelines = CROP_GUIDELINES_DB[matchingCrop as keyof typeof CROP_GUIDELINES_DB];
    responseText = `Here is the agricultural care sheet for your crop:\n\n${guidelines}\n\n`;
    
    // Check if the user has this crop in database RAG
    if (fieldsCtx.toLowerCase().includes(matchingCrop)) {
      responseText += `Note: I see you have an active ${matchingCrop.toUpperCase()} field in your database. Ensure you follow these steps relative to your sowing date!`;
    }
  } else {
    responseText = `Hello! I have loaded your farm coordinates and fields database. You can ask me questions like:
1. "What is the current weather forecast for my field?"
2. "How should I care for my Rice field?"
3. "Show my current planted fields status."
4. "Is it a good time to apply urea?"`;
  }

  return responseText;
}

/**
 * Handles RAG assembly and calls the AI services
 */
export async function askAIAssistant(
  userMessage: string,
  chatHistory: ChatMessage[],
  preferredLanguage?: 'en' | 'ne',
  isVoiceMode = false,
  systemPromptOverride?: string
): Promise<string> {
  const fieldsCtx = await getFieldsContext();
  const weatherCtx = await getWeatherContext();
  const seasonalCtx = getSeasonalContext(new Date('2026-07-04')); // Lock today's date for consistent timeline matching

  const languagePrefix = `If the user's preferred language is Nepali, please respond entirely in Nepali. Otherwise respond in English. (User's preferred language is ${preferredLanguage === 'ne' ? 'Nepali' : 'English'}).\n\n`;

  const voiceInstructions = `${languagePrefix}You are Avani AI, a friendly, warm agricultural voice assistant helper. You are speaking directly to a farmer in Nepal/South Asia.
You have access to the following real-time data:
=========================================
${fieldsCtx}
=========================================
=========================================
${weatherCtx}
=========================================
=========================================
${seasonalCtx}
=========================================

Voice Instructions:
- Speak in a friendly, conversational, warm, and highly empathetic tone.
- Give a very short, helpful response (strictly 2 to 3 short sentences max, comfortable for voice listening).
- Refer to their fields and crops by name (e.g. "North Field") when relevant.
- Do NOT use any markdown symbols, bullet points, headers, or stars (e.g. no *, #, >, -, **). Write exactly what a human should read out loud naturally.`;

  const textInstructions = `${languagePrefix}You are Avani AI, an expert agricultural specialist. You are assisting a farmer in Nepal/South Asia.
You have direct RAG access to the following real-time data:
=========================================
${fieldsCtx}
=========================================
=========================================
${weatherCtx}
=========================================
=========================================
${seasonalCtx}
=========================================

Instructions:
- Provide friendly, actionable agricultural advice.
- Refer to their specific fields and crops by name (e.g. "North Field") when relevant.
- Advise on water management, fertilization (e.g., urea, NPK), and disease checking based on planting dates and weather.
- Keep answers structured with bullet points.
- Format your response in clean Markdown:
  * Use '# Header Name' for section titles.
  * Use '- Bullet Item' for lists and actions.
  * Use '> WARNING: Warning text' or '> IMPORTANT: Note text' for alerts.
  * Use '**bold text**' for key emphasis.
- Keep answers highly structured and scannable.`;

  // If a systemPromptOverride is provided (e.g., Crop Advisor), enrich it with
  // lifecycle DB, forward weather projection, and crop viability table
  let enrichedOverride = systemPromptOverride;
  if (systemPromptOverride) {
    const currentMonth = new Date().getMonth();
    const forwardWeather = getForwardWeatherProjection(currentMonth);
    const viabilityTable = getCropViabilityTable(currentMonth);
    enrichedOverride = `${systemPromptOverride}

=========================================
REAL-TIME FARM DATA:
${fieldsCtx}
=========================================
${weatherCtx}
=========================================
${seasonalCtx}
=========================================

${forwardWeather}

${viabilityTable}

${NEPAL_CROP_LIFECYCLE_DB}

MANDATORY RULES:
1. Before recommending ANY crop, you MUST cross-reference the Crop Viability Table above. If it says ❌ DO NOT PLANT, you must REFUSE and explain why using the lifecycle data.
2. For every crop suggestion, you MUST check the Forward Weather Projection to verify water/rain will be available during EVERY growth stage (not just planting).
3. Think through the FULL lifecycle: sowing → vegetative → flowering → grain-fill → harvest. Check each stage against the forward weather.
4. If a farmer asks about a crop that will fail post-monsoon (e.g., maize in July), CRITICIZE the idea and explain the exact stage where it will die and why.
5. Always recommend what Nepal farmers ACTUALLY plant this month — do not invent theoretical suggestions.`;
  }

  const ragContext = enrichedOverride || (isVoiceMode ? voiceInstructions : textInstructions);

  // 1. Try Groq API as primary for low latency
  if (hasGroqKey) {
    try {
      console.log('calling Groq API as primary using model:', GROQ_MODEL);
      // Convert history format to OpenAI/Groq messages format
      const messages = [
        { role: 'system', content: ragContext }
      ];

      chatHistory.forEach((msg) => {
        messages.push({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.text,
        });
      });

      // Append new user message
      messages.push({
        role: 'user',
        content: userMessage,
      });

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages,
          temperature: 0.3,
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      const reply = data?.choices?.[0]?.message?.content;
      
      if (!reply) {
        throw new Error('Empty response from Groq API.');
      }

      return reply;
    } catch (error) {
      console.warn('Groq API call failed:', error);
    }
  }

  // 3. Fallback to Local RAG Simulator
  console.log('No active API Key or all requests failed. Running Local RAG simulator.');
  // Add artificial delay for professional feeling
  await new Promise((resolve) => setTimeout(resolve, 1000));
  return runLocalRagSimulator(userMessage, fieldsCtx, weatherCtx);
}

export interface VoiceAssistantResponse {
  pcmBase64: string;
  modelName: string;
}

export async function askAIAssistantVoice(
  userMessage: string,
  chatHistory: ChatMessage[],
  preferredLanguage?: 'en' | 'ne'
): Promise<VoiceAssistantResponse> {
  const fieldsCtx = await getFieldsContext();
  const weatherCtx = await getWeatherContext();
  const seasonalCtx = getSeasonalContext(new Date('2026-07-04')); // Lock today's date for consistent timeline matching

  const languageInstruction = preferredLanguage === 'ne'
    ? 'Respond entirely in Nepali (नेपाली).'
    : 'Respond in English.';

  const ragContext = `You are Avani AI, an expert agricultural specialist assisting a farmer in Nepal/South Asia.
You have access to the following real-time data:

${fieldsCtx}

${weatherCtx}

${seasonalCtx}

Instructions:
- Give a brief, friendly, conversational answer (2-3 sentences max).
- Refer to specific fields/crops by name when relevant.
- ${languageInstruction}

User's question: ${userMessage}`;

  const geminiKey = process.env.EXPO_PUBLIC_GEMINI_API_KEY || '';

  if (!geminiKey || geminiKey === 'YOUR_GEMINI_API_KEY_HERE') {
    throw new Error('Gemini API Key not configured.');
  }

  // gemini-3.1-flash-tts-preview: generates answer + speaks it in one shot (fastest pipeline)
  // gemini-2.5-flash-preview-tts: strict TTS-only fallback (needs verbatim text)
  const modelsToTry = ['gemini-3.1-flash-tts-preview'];
  
  for (const modelName of modelsToTry) {
    try {
      const contents = chatHistory.map((msg) => ({
        role: msg.isUser ? 'user' : 'model',
        parts: [{ text: msg.text }],
      }));

      contents.push({
        role: 'user',
        parts: [{ text: ragContext }],
      });

      const requestBody = {
        contents,
        generationConfig: {
          responseModalities: ["AUDIO"],
          speechConfig: {
            voiceConfig: {
              prebuiltVoiceConfig: {
                voiceName: 'Aoede'
              }
            }
          }
        }
      };

      const endpoint = `https://generativelanguage.googleapis.com/v1beta/models/${modelName}:generateContent?key=${geminiKey}`;

      const response = await fetch(endpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(requestBody),
      });

      if (!response.ok) {
        throw new Error(`Gemini Voice API Failed: ${response.status}`);
      }

      const json = await response.json();
      const audioPart = json?.candidates?.[0]?.content?.parts?.find((p: any) => p.inlineData);

      if (!audioPart?.inlineData?.data) {
        throw new Error('No audio data in Gemini response');
      }

      return {
        pcmBase64: audioPart.inlineData.data,
        modelName
      };

    } catch (err) {
      console.warn(`Failed with model ${modelName}:`, err);
    }
  }

  throw new Error('All Gemini voice models failed.');
}

export interface DynamicAlert {
  type: 'warning' | 'info' | 'success';
  title: string;
  description: string;
}

/**
 * Generates dynamic alerts based on fields context and weather context using AI
 */
export async function generateDynamicAlerts(
  preferredLanguage?: 'en' | 'ne'
): Promise<DynamicAlert[]> {
  const fieldsCtx = await getFieldsContext();
  const weatherCtx = await getWeatherContext();

  const fallbackAlerts = (lang: 'en' | 'ne'): DynamicAlert[] => {
    if (lang === 'ne') {
      return [
        {
          type: 'warning',
          title: 'उच्च आर्द्रता सतर्कता',
          description: 'मौसम पूर्वानुमान अनुसार आज वर्षा हुने सम्भावना छ। कृपया मल हाल्न ढिलाइ गर्नुहोस्।'
        },
        {
          type: 'info',
          title: 'सिंचाई सल्लाह',
          description: 'सिंचाई नालीहरू सफा राख्नुहोस् ता कि खेतमा धेरै पानी नजमोस्।'
        }
      ];
    }
    return [
      {
        type: 'warning',
        title: 'High Humidity Alert',
        description: 'Weather forecast shows rain probability is active. Delay any chemical sprays.'
      },
      {
        type: 'info',
        title: 'Irrigation Advisory',
        description: 'Ensure field drainage trenches are clear to avoid waterlogging.'
      }
    ];
  };

  // 1. Try Gemini API first if key is set
  if (hasGeminiKey) {
    try {
      console.log('generating dynamic alerts via Gemini as primary...');
      const isNepali = preferredLanguage === 'ne';
      const systemPrompt = `You are an expert agricultural AI. Based on the following farmer's fields and current weather, generate 2 or 3 highly relevant alerts or activities.

Fields Data:
${fieldsCtx}

Weather Data:
${weatherCtx}

Instructions:
1. Return ONLY a valid JSON array of objects. Do not include markdown formatting (do NOT include \`\`\`json or \`\`\`).
2. Each object in the array must have the following structure:
{
  "type": "warning" | "info" | "success",
  "title": "Short title (under 5 words)",
  "description": "Short action-oriented description (1-2 sentences)"
}
3. The response must be written entirely in ${isNepali ? 'Nepali (नेपाली)' : 'English'}.
4. Provide practical, weather-derived tips (e.g. spray delay if rain, irrigation if dry, disease checks based on timeline).`;

      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [{
            role: 'user',
            parts: [{ text: systemPrompt }]
          }]
        }),
      });

      if (!response.ok) {
        throw new Error(`Gemini API error: ${response.status}`);
      }

      const data = await response.json();
      let reply = data?.candidates?.[0]?.content?.parts?.[0]?.text || '';
      
      // Clean up markdown block if present
      reply = reply.trim();
      if (reply.startsWith('```')) {
        reply = reply.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(reply);
      if (Array.isArray(parsed)) {
        return parsed.map((item: any) => ({
          type: ['warning', 'info', 'success'].includes(item.type) ? item.type : 'info',
          title: item.title || '',
          description: item.description || ''
        }));
      }
    } catch (error) {
      console.warn('Gemini failed to generate dynamic alerts, attempting Groq fallback:', error);
    }
  }

  // 2. Try Groq API fallback if key is set
  if (hasGroqKey) {
    try {
      console.log('generating dynamic alerts via Groq fallback...');
      const isNepali = preferredLanguage === 'ne';
      const systemPrompt = `You are an expert agricultural AI. Based on the following farmer's fields and current weather, generate 2 or 3 highly relevant alerts or activities.

Fields Data:
${fieldsCtx}

Weather Data:
${weatherCtx}

Instructions:
1. Return ONLY a valid JSON object with a single key "alerts" containing an array of objects. Do not include markdown formatting or backticks.
2. Each object in the array must have the following structure:
{
  "type": "warning" | "info" | "success",
  "title": "Short title (under 5 words)",
  "description": "Short action-oriented description (1-2 sentences)"
}
3. The response must be written entirely in ${isNepali ? 'Nepali (नेपाली)' : 'English'}.
4. Provide practical, weather-derived tips (e.g. spray delay if rain, irrigation if dry, disease checks based on timeline).`;

      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            {
              role: 'user',
              content: systemPrompt
            }
          ],
          temperature: 0.2,
          response_format: { type: 'json_object' }
        }),
      });

      if (!response.ok) {
        throw new Error(`Groq API error: ${response.status} ${response.statusText}`);
      }

      const data = await response.json();
      let reply = data?.choices?.[0]?.message?.content || '';
      
      reply = reply.trim();
      if (reply.startsWith('```')) {
        reply = reply.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
      }

      const parsed = JSON.parse(reply);
      const alertArray = Array.isArray(parsed) ? parsed : (parsed?.alerts || []);

      if (Array.isArray(alertArray)) {
        return alertArray.map((item: any) => ({
          type: ['warning', 'info', 'success'].includes(item.type) ? item.type : 'info',
          title: item.title || '',
          description: item.description || ''
        }));
      }
    } catch (error) {
      console.warn('Groq API dynamic alerts fallback failed:', error);
    }
  }

  // 3. Fallback to pre-programmed alerts
  return fallbackAlerts(preferredLanguage || 'en');
}

export interface FieldDiagnosisItem {
  fieldName: string;
  cropType: string;
  healthScore: number;
  riskLevel: 'High Risk' | 'Moderate Risk' | 'Low Risk' | 'Healthy';
  diagnosis: string;
  recommendations: string[];
}

export interface DynamicWeatherAlert {
  hasAlert: boolean;
  title?: string;
  body?: string;
  fieldDiagnoses?: FieldDiagnosisItem[];
}

export async function generateDynamicWeatherAlert(
  combinedReport: string,
  preferredLanguage?: 'en' | 'ne'
): Promise<DynamicWeatherAlert> {
  const languagePrompt = preferredLanguage === 'ne' 
    ? "Return all titles, bodies, diagnoses, and recommendations entirely in Nepali language (नेपाली)."
    : "Return all titles, bodies, diagnoses, and recommendations in English.";

  const prompt = `You are a senior agronomist and crop diagnostic specialist for Nepal/South Asia.
Analyze the following detailed farm telemetry and weather data for registered fields:

${combinedReport}

Perform a rigorous, field-by-field diagnostic assessment of crop health, soil conditions, and weather risks (e.g. waterlogging, root rot, fungal blight due to humidity, nutrient leaching, heat stress, pest vulnerability).

Instructions:
1. CRITICAL FIELD STAGE RULES:
   - Check whether each field is "PLANNED / UNPLANTED" or "ACTIVE GROWING CROP".
   - If a field is "PLANNED / UNPLANTED" (muddy soil / pre-sowing phase):
     * DO NOT report leaf blight, crop pests, or plant disease on non-existent growing plants!
     * Diagnosis MUST state that the field is currently in the pre-sowing/muddy land stage.
     * Recommendations MUST focus on pre-sowing steps: field leveling, boundary drainage trenching before heavy rain, mud puddling, and waiting for optimum moisture before sowing.
   - If a field is "ACTIVE GROWING CROP":
     * Provide full crop disease diagnosis, humidity/blight risks, and nutrient recommendations.
2. Provide an overall executive title (under 6 words) and body (2 clear sentences summarizing overall farm condition).
3. For EVERY registered field listed in the input report, generate a specific entry in "fieldDiagnoses":
   - "fieldName": exact name of the field from input.
   - "cropType": crop type.
   - "healthScore": numeric health score percentage (e.g. 68).
   - "riskLevel": "High Risk", "Moderate Risk", "Low Risk", or "Healthy".
   - "diagnosis": Specific diagnostic explanation of the field's stage and health condition.
   - "recommendations": An array of 2 to 3 highly specific, stage-appropriate actionable steps for the farmer.
4. ${languagePrompt}

Return ONLY a raw valid JSON object with this exact structure (do NOT include markdown code blocks or extra text):
{
  "hasAlert": true,
  "title": string,
  "body": string,
  "fieldDiagnoses": [
    {
      "fieldName": string,
      "cropType": string,
      "healthScore": number,
      "riskLevel": "High Risk" | "Moderate Risk" | "Low Risk" | "Healthy",
      "diagnosis": string,
      "recommendations": [string, string]
    }
  ]
}`;

  // Try Groq first as primary AI provider
  if (hasGroqKey) {
    try {
      console.log('Calling Groq AI for dynamic weather risk analysis...');
      const response = await fetch(GROQ_API_URL, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'Authorization': `Bearer ${GROQ_API_KEY}`,
        },
        body: JSON.stringify({
          model: GROQ_MODEL,
          messages: [
            { role: 'user', content: prompt }
          ],
          temperature: 0.2,
          response_format: { type: "json_object" }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let text = data?.choices?.[0]?.message?.content;
        if (text) {
          text = text.trim();
          if (text.startsWith('```')) {
            text = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
          }
          return JSON.parse(text);
        }
      } else {
        throw new Error(`Groq HTTP Error: ${response.status}`);
      }
    } catch (e) {
      console.warn('Groq weather alert generation failed, attempting Gemini fallback:', e);
    }
  }

  // Fallback to Gemini if Groq fails or no key
  if (hasGeminiKey) {
    try {
      console.log('Calling Gemini as fallback for weather risk analysis...');
      const response = await fetch(`${GEMINI_API_URL}?key=${GEMINI_API_KEY}`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          contents: [
            { role: 'user', parts: [{ text: prompt }] }
          ],
          generationConfig: {
            responseMimeType: "application/json",
            temperature: 0.2,
          }
        }),
      });

      if (response.ok) {
        const data = await response.json();
        let text = data?.candidates?.[0]?.content?.parts?.[0]?.text;
        if (text) {
          text = text.trim();
          if (text.startsWith('```')) {
            text = text.replace(/^```json\s*/i, '').replace(/```$/, '').trim();
          }
          return JSON.parse(text);
        }
      }
    } catch (e) {
      console.warn('Gemini weather alert fallback failed:', e);
    }
  }

  return { hasAlert: false };
}

/**
 * Transcribes user speech audio to text using Groq Whisper model with strict timeout abort
 */
export async function transcribeAudioWithGroq(fileUri: string): Promise<string> {
  if (!GROQ_API_KEY) {
    throw new Error('Groq API Key not configured.');
  }

  const formData = new FormData();
  formData.append('file', {
    uri: fileUri,
    name: 'recording.m4a',
    type: 'audio/m4a',
  } as any);
  formData.append('model', 'whisper-large-v3-turbo');

  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), 10000); // 10s strict upload timeout

  try {
    const response = await fetch('https://api.groq.com/openai/v1/audio/transcriptions', {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${GROQ_API_KEY}`,
      },
      body: formData,
      signal: controller.signal
    });

    clearTimeout(timeoutId);

    if (!response.ok) {
      const errorText = await response.text();
      throw new Error(`Groq Whisper transcription failed: ${response.status} - ${errorText}`);
    }

    const data = await response.json();
    return data.text || '';
  } catch (error) {
    clearTimeout(timeoutId);
    throw error;
  }
}

/**
 * Streams responses token-by-token from Groq Llama 3.3, triggering callbacks as complete sentences are formed
 */
export function streamAIAssistant(
  userMessage: string,
  chatHistory: ChatMessage[],
  preferredLanguage: 'en' | 'ne',
  isVoiceMode: boolean,
  onSentence: (sentence: string) => void,
  onDone: (fullText: string) => void,
  onError: (error: Error) => void
): () => void {
  let isAborted = false;
  let xhr: XMLHttpRequest | null = null;

  const run = async () => {
    try {
      const fieldsCtx = await getFieldsContext();
      const weatherCtx = await getWeatherContext();
      if (isAborted) return;

      const languagePrefix = `If the user's preferred language is Nepali, please respond entirely in Nepali. Otherwise respond in English. (User's preferred language is ${preferredLanguage === 'ne' ? 'Nepali' : 'English'}).\n\n`;

      const voiceInstructions = `${languagePrefix}You are Avani AI, a friendly, warm agricultural voice assistant helper. You are speaking directly to a farmer in Nepal/South Asia.
You have access to the following real-time data:
=========================================
${fieldsCtx}
=========================================
=========================================
${weatherCtx}
=========================================

Voice Instructions:
- Speak in a friendly, conversational, warm, and highly empathetic tone.
- Give a very short, helpful response (strictly 2 to 3 short sentences max, comfortable for voice listening).
- Refer to their fields and crops by name (e.g. "North Field") when relevant.
- Do NOT use any markdown symbols, bullet points, headers, or stars (e.g. no *, #, >, -, **). Write exactly what a human should read out loud naturally.`;

      const textInstructions = `${languagePrefix}You are Avani AI, an expert agricultural specialist. You are assisting a farmer in Nepal/South Asia.
You have direct RAG access to the following real-time data:
=========================================
${fieldsCtx}
=========================================
=========================================
${weatherCtx}
=========================================

Instructions:
- Provide friendly, actionable agricultural advice.
- Refer to their specific fields and crops by name (e.g. "North Field") when relevant.
- Advise on water management, fertilization (e.g., urea, NPK), and disease checking based on planting dates and weather.
- Keep answers structured with bullet points.
- Format your response in clean Markdown.`;

      const ragContext = isVoiceMode ? voiceInstructions : textInstructions;

      if (!GROQ_API_KEY) {
        throw new Error('Groq API Key not configured.');
      }

      const messages = [
        { role: 'system', content: ragContext }
      ];

      chatHistory.forEach((msg) => {
        messages.push({
          role: msg.isUser ? 'user' : 'assistant',
          content: msg.text,
        });
      });

      messages.push({
        role: 'user',
        content: userMessage,
      });

      xhr = new XMLHttpRequest();
      xhr.open('POST', GROQ_API_URL);
      xhr.setRequestHeader('Content-Type', 'application/json');
      xhr.setRequestHeader('Authorization', `Bearer ${GROQ_API_KEY}`);

      let seenBytes = 0;
      let buffer = '';
      let fullText = '';
      let currentSentence = '';
      let firstChunkEmitted = false; // Strategy 1: fast first-chunk emission

      xhr.onreadystatechange = () => {
        if (isAborted) return;
        if (xhr && (xhr.readyState === 3 || xhr.readyState === 4)) {
          const rawText = xhr.responseText;
          const newChunk = rawText.slice(seenBytes);
          seenBytes = rawText.length;
          
          buffer += newChunk;
          let newlineIndex = buffer.indexOf('\n');
          while (newlineIndex !== -1) {
            const line = buffer.slice(0, newlineIndex).trim();
            buffer = buffer.slice(newlineIndex + 1);
            newlineIndex = buffer.indexOf('\n');

            if (!line) continue;
            if (line === 'data: [DONE]') continue;
            if (line.startsWith('data: ')) {
              try {
                const jsonStr = line.slice(6);
                const data = JSON.parse(jsonStr);
                const content = data?.choices?.[0]?.delta?.content || '';
                if (content) {
                  fullText += content;
                  currentSentence += content;

                  if (!firstChunkEmitted) {
                    // Strategy 1: For the FIRST chunk, emit at clause boundaries
                    // (commas, colons, semicolons) in addition to sentence endings.
                    // This fires the first Deepgram TTS call ~300-600ms earlier.
                    const clauseMatch = currentSentence.match(/^([^.!?।,;:]+)([.!?।,;:]+)\s*/);
                    const wordCount = currentSentence.trim().split(/\s+/).length;
                    if (clauseMatch && wordCount >= 4) {
                      const clause = (clauseMatch[1] + clauseMatch[2]).trim();
                      currentSentence = currentSentence.slice(clauseMatch[0].length);
                      if (clause) {
                        firstChunkEmitted = true;
                        onSentence(clause);
                      }
                    }
                  } else {
                    // Normal full-sentence splitting for subsequent chunks
                    const match = currentSentence.match(/^([^.!?।]+)([.!?।]+)/);
                    if (match) {
                      const sentence = (match[1] + match[2]).trim();
                      currentSentence = currentSentence.slice(match[0].length);
                      if (sentence) {
                        onSentence(sentence);
                      }
                    }
                  }
                }
              } catch (e) {
                // Ignore parsing errors of malformed/incomplete data lines
              }
            }
          }
        }
        if (xhr && xhr.readyState === 4) {
          if (xhr.status >= 200 && xhr.status < 300) {
            // Process any remaining text in the buffers
            const remaining = currentSentence.trim();
            if (remaining) {
              onSentence(remaining);
            }
            onDone(fullText);
          } else {
            onError(new Error(`Groq stream failed: ${xhr.status} - ${xhr.responseText}`));
          }
        }
      };

      xhr.onerror = () => {
        if (isAborted) return;
        onError(new Error('Groq stream network error'));
      };

      xhr.send(JSON.stringify({
        model: GROQ_MODEL,
        messages,
        temperature: 0.3,
        stream: true
      }));

    } catch (err: any) {
      if (!isAborted) {
        onError(err);
      }
    }
  };

  run();

  return () => {
    isAborted = true;
    if (xhr) {
      try {
        xhr.abort();
      } catch (e) {}
    }
  };
}
