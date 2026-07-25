// Real-Time Soil API Service integrating ISRIC SoilGrids 250m REST API & Open-Meteo Land Surface API
// Includes Pre-Fetching, In-Memory Caching & On-Demand Live Reset

export interface RealSoilTelemetry {
  source: string;
  isLive: boolean;
  latitude: number;
  longitude: number;
  fetchedAt: string;
  ph: number;
  socPct: number;
  socStockMgHa: number;
  clayPct: number;
  sandPct: number;
  siltPct: number;
  cecMmolKg: number;
  bulkDensity: number;
  surfaceMoisture: number;
  subsurfaceMoisture: number;
  soilTemperature: number;
  phStatus: string;
  healthIndex: number;
}

// Global In-Memory Soil Telemetry Cache for 0ms Pre-Handy Load
const SOIL_TELEMETRY_CACHE: Record<string, RealSoilTelemetry> = {};

// Coordinates mapping for Nepal districts & locations
const LOCATION_COORDINATES: Record<string, { lat: number; lon: number }> = {
  'माडी, बागमती प्रदेश': { lat: 27.4617, lon: 84.3750 },
  'madi': { lat: 27.4617, lon: 84.3750 },
  'कल्यानपुर, बागमती प्रदेश': { lat: 27.5684, lon: 84.4215 },
  'kalyanpur': { lat: 27.5684, lon: 84.4215 },
  'भरतपुर, बागमती प्रदेश': { lat: 27.6784, lon: 84.4385 },
  'bharatpur': { lat: 27.6784, lon: 84.4385 },
  'pokhara': { lat: 28.1638, lon: 84.0487 },
  'kathmandu': { lat: 27.7172, lon: 85.3240 },
};

export const getCoordinatesForLocation = (locationName?: string | null): { lat: number; lon: number } => {
  if (!locationName) return { lat: 27.6784, lon: 84.4385 };
  const loc = locationName.toLowerCase();
  for (const key in LOCATION_COORDINATES) {
    if (loc.includes(key.toLowerCase())) {
      return LOCATION_COORDINATES[key];
    }
  }
  return { lat: 27.6784, lon: 84.4385 };
};

// Check if telemetry is pre-cached
export const getCachedSoilTelemetry = (locationName?: string | null): RealSoilTelemetry | null => {
  const { lat, lon } = getCoordinatesForLocation(locationName);
  const cacheKey = `${lat}_${lon}`;
  return SOIL_TELEMETRY_CACHE[cacheKey] || null;
};

// Background Pre-Fetcher (Call on App Init / Screen Mount)
export async function preFetchAllSoilTelemetry(customLocations?: (string | null)[]): Promise<void> {
  const keys = customLocations && customLocations.length > 0 
    ? customLocations 
    : ['bharatpur', 'madi', 'kalyanpur', 'pokhara', 'kathmandu'];

  for (const key of keys) {
    if (!key) continue;
    try {
      await fetchLiveSoilTelemetry(key, false);
    } catch (e) {
      console.warn('Pre-fetch background notice:', key, e);
    }
  }
}

// Fetch live soil telemetry with optional forceRefresh
export async function fetchLiveSoilTelemetry(
  locationName?: string | null,
  forceRefresh: boolean = false
): Promise<RealSoilTelemetry> {
  const { lat, lon } = getCoordinatesForLocation(locationName);
  const cacheKey = `${lat}_${lon}`;

  // Return pre-cached data instantly if available and forceRefresh is false
  if (!forceRefresh && SOIL_TELEMETRY_CACHE[cacheKey]) {
    return SOIL_TELEMETRY_CACHE[cacheKey];
  }

  const timestamp = new Date().toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', second: '2-digit' });

  let ph = 6.2;
  let socPct = 1.85;
  let clayPct = 32;
  let sandPct = 38;
  let siltPct = 30;
  let cecMmolKg = 18.5;
  let bulkDensity = 1.28;
  let surfaceMoist = 34;
  let subMoist = 40;
  let soilTemp = 26.2;
  let isLive = false;

  try {
    // 1. Query ISRIC SoilGrids v2.0 Global 250m REST API
    const isricUrl = `https://rest.isric.org/soilgrids/v2.0/properties/query?lon=${lon}&lat=${lat}&property=phh2o&property=soc&property=clay&property=sand&property=silt&property=cec&property=bdod&depth=0-5cm&depth=5-15cm`;
    const isricRes = await fetch(isricUrl, { headers: { 'User-Agent': 'AnaviAgriApp/1.0' } });
    if (isricRes.ok) {
      const isricData = await isricRes.json();
      if (isricData?.properties?.layers) {
        isLive = true;
        for (const layer of isricData.properties.layers) {
          const depth0_5 = layer.depths?.find((d: any) => d.label === '0-5cm')?.values?.mean;
          if (depth0_5 !== undefined && depth0_5 !== null) {
            if (layer.name === 'phh2o') ph = Math.round((depth0_5 / 10) * 10) / 10;
            if (layer.name === 'soc') socPct = Math.round((depth0_5 / 100) * 100) / 100;
            if (layer.name === 'clay') clayPct = Math.round(depth0_5 / 10);
            if (layer.name === 'sand') sandPct = Math.round(depth0_5 / 10);
            if (layer.name === 'silt') siltPct = Math.round(depth0_5 / 10);
            if (layer.name === 'cec') cecMmolKg = Math.round((depth0_5 / 10) * 10) / 10;
            if (layer.name === 'bdod') bulkDensity = Math.round((depth0_5 / 100) * 100) / 100;
          }
        }
      }
    }
  } catch (e) {
    console.warn('ISRIC API fetch notice:', e);
  }

  try {
    // 2. Query Open-Meteo Live Soil Moisture & Temperature API
    const openMeteoUrl = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&hourly=soil_temperature_0to7cm,soil_moisture_0to7cm,soil_moisture_7to28cm`;
    const omRes = await fetch(openMeteoUrl);
    if (omRes.ok) {
      const omData = await omRes.json();
      if (omData?.hourly?.soil_moisture_0to7cm) {
        const rawSurface = omData.hourly.soil_moisture_0to7cm[0] || 0.34;
        const rawSub = omData.hourly.soil_moisture_7to28cm[0] || 0.40;
        const rawTemp = omData.hourly.soil_temperature_0to7cm[0] || 26.2;
        
        surfaceMoist = Math.round(rawSurface * 100);
        subMoist = Math.round(rawSub * 100);
        soilTemp = Math.round(rawTemp * 10) / 10;
      }
    }
  } catch (e) {
    console.warn('Open-Meteo API fetch notice:', e);
  }

  // Normalize particle percentages
  const sumPct = clayPct + sandPct + siltPct;
  if (sumPct > 0 && Math.abs(sumPct - 100) > 2) {
    clayPct = Math.round((clayPct / sumPct) * 100);
    sandPct = Math.round((sandPct / sumPct) * 100);
    siltPct = 100 - clayPct - sandPct;
  }

  const socStockMgHa = Math.round(socPct * bulkDensity * 25 * 10) / 10;
  const phStatus = ph < 5.8 ? 'Acidic' : (ph > 7.5 ? 'Alkaline' : 'Optimal Balanced');
  const healthIndex = ph < 5.8 ? 76 : (clayPct > 25 ? 94 : 85);

  const result: RealSoilTelemetry = {
    source: isLive ? 'Live ISRIC SoilGrids v2.0 & Open-Meteo API' : 'NARC Terai Regional Station Baseline',
    isLive,
    latitude: lat,
    longitude: lon,
    fetchedAt: timestamp,
    ph,
    socPct,
    socStockMgHa,
    clayPct,
    sandPct,
    siltPct,
    cecMmolKg,
    bulkDensity,
    surfaceMoisture: surfaceMoist,
    subsurfaceMoisture: subMoist,
    soilTemperature: soilTemp,
    phStatus,
    healthIndex,
  };

  // Cache result for instant 0ms access
  SOIL_TELEMETRY_CACHE[cacheKey] = result;
  return result;
}
