import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import ee from "npm:@google/earthengine@0.1.385"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
}

serve(async (req) => {
  // CORS Preflight
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders })
  }

  try {
    const { boundaries } = await req.json()
    if (!boundaries || !Array.isArray(boundaries) || boundaries.length < 3) {
      throw new Error('Invalid boundaries coordinates polygon provided. Need at least 3 points.')
    }

    // 1. Fetch credentials from environment
    const serviceAccountJson = Deno.env.get("GOOGLE_EE_CREDENTIALS")
    if (!serviceAccountJson) {
      throw new Error('GOOGLE_EE_CREDENTIALS environment variable is not configured in Supabase.')
    }
    
    let creds: any
    try {
      // 1. Auto-heal any mangled backslash sequences (e.g. \ArWs instead of \nArWs)
      let cleaned = serviceAccountJson.replace(/\\([a-zA-Z])/g, (match, p1) => {
        // Valid JSON escape letters are lowercase: b, f, n, r, t, u
        if (['b', 'f', 'n', 'r', 't', 'u'].includes(p1)) {
          return match;
        }
        return `\\n${p1}`; // Restore the missing 'n'
      });
      creds = JSON.parse(cleaned)
    } catch (e: any) {
      console.warn("Auto-healing parser failed on first pass, attempting secondary sanitization...", e.message)
      try {
        let cleaned = serviceAccountJson.replace(/\\([a-zA-Z])/g, (match, p1) => {
          if (['b', 'f', 'n', 'r', 't', 'u'].includes(p1)) {
            return match;
          }
          return `\\n${p1}`;
        });
        // Handle literal unescaped newlines inside the private key
        cleaned = cleaned.replace(/"private_key"\s*:\s*"([\s\S]*?)"/, (match, keyContent) => {
          const escaped = keyContent.replace(/\r?\n/g, '\\n')
          return `"private_key": "${escaped}"`
        })
        cleaned = cleaned.replace(/\r?\n/g, ' ')
        creds = JSON.parse(cleaned)
      } catch (err: any) {
        return new Response(
          JSON.stringify({ 
            success: false, 
            error: `Failed to parse GOOGLE_EE_CREDENTIALS JSON even after auto-healing. Error: ${e.message}`
          }),
          { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 400 }
        )
      }
    }

    // 2. Authenticate and Initialize GEE
    await new Promise((resolve, reject) => {
      ee.data.authenticateViaPrivateKey(
        { client_email: creds.client_email, private_key: creds.private_key },
        resolve,
        reject
      )
    })

    await new Promise((resolve, reject) => {
      ee.initialize(null, null, resolve, reject)
    })

    // 3. Construct ROI Polygon from boundaries
    const coords = boundaries.map(p => [p.longitude, p.latitude])
    // Close polygon if first and last don't match
    if (coords[0][0] !== coords[coords.length - 1][0] || coords[0][1] !== coords[coords.length - 1][1]) {
      coords.push(coords[0])
    }
    const roi = ee.Geometry.Polygon([coords])

    // 4. Query Sentinel-2 Surface Reflectance (L2A Harmonized) over the last 45 days
    const today = new Date()
    const startDate = new Date(today.getTime() - 45 * 24 * 60 * 60 * 1000).toISOString().split('T')[0]
    const endDate = today.toISOString().split('T')[0]

    // Cloud & Shadow masking using the Scene Classification Layer (SCL)
    const maskCloudsAndScale = (image: any) => {
      const scl = image.select('SCL')
      // Keep: 4 (Vegetation), 5 (Bare soil), 6 (Water)
      // Mask: 3 (Cloud shadow), 8 (Cloud medium prob), 9 (Cloud high prob), 10 (Cirrus), 11 (Snow/Ice)
      const cloudMask = scl.neq(3)
        .and(scl.neq(8))
        .and(scl.neq(9))
        .and(scl.neq(10))
        .and(scl.neq(11))
      
      // Convert raw Digital Numbers (DN) to Surface Reflectance [0-1] (Sentinel-2 scale factor is 10000)
      return image
        .updateMask(cloudMask)
        .divide(10000)
        .copyProperties(image, ['system:time_start'])
    }

    const collection = ee.ImageCollection('COPERNICUS/S2_SR_HARMONIZED')
      .filterBounds(roi)
      .filterDate(startDate, endDate)
      .filter(ee.Filter.lt('CLOUDY_PIXEL_PERCENTAGE', 80))
      .map(maskCloudsAndScale)

    const size = await new Promise<number>((resolve, reject) => {
      collection.size().evaluate((count, err) => {
        if (err) reject(err)
        else resolve(count)
      })
    })

    if (size === 0) {
      return new Response(
        JSON.stringify({ 
          success: false, 
          error: 'No clear-sky satellite passes found over your farm boundaries in the past 45 days.' 
        }),
        { headers: { ...corsHeaders, 'Content-Type': 'application/json' }, status: 200 }
      )
    }

    // Composite cloud-free median image
    const medianImage = collection.median()

    // 5. Calculate Indices using standard scientific band formulas
    // NDVI = (B8 - B4) / (B8 + B4)
    const ndvi = medianImage.normalizedDifference(['B8', 'B4']).rename('NDVI')

    // NDMI (Gao Canopy/Soil Moisture) = (B8 - B11) / (B8 + B11)
    const ndmi = medianImage.normalizedDifference(['B8', 'B11']).rename('NDMI')

    // NDWI (McFeeters Surface Water/Flooding) = (B3 - B8) / (B3 + B8)
    const ndwi = medianImage.normalizedDifference(['B3', 'B8']).rename('NDWI')

    // Combine bands
    const combined = ndvi.addBands(ndmi).addBands(ndwi)

    // Load static SoilGrids assets from ISRIC project in GEE
    const clayImage = ee.Image("projects/soilgrids-isric/clay_mean")
    const sandImage = ee.Image("projects/soilgrids-isric/sand_mean")
    const siltImage = ee.Image("projects/soilgrids-isric/silt_mean")
    const phImage = ee.Image("projects/soilgrids-isric/phh2o_mean")
    const socImage = ee.Image("projects/soilgrids-isric/soc_mean")

    const proj = clayImage.select('clay_0-5cm_mean').projection()

    const soilCombined = clayImage.select('clay_0-5cm_mean')
      .addBands(sandImage.select('sand_0-5cm_mean'))
      .addBands(siltImage.select('silt_0-5cm_mean'))
      .addBands(phImage.select('phh2o_0-5cm_mean'))
      .addBands(socImage.select('soc_0-5cm_mean'))

    // 6. Reduce Region to compute spatial mean averages
    const stats: any = await new Promise((resolve, reject) => {
      combined.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: roi,
        scale: 10, // Native Sentinel-2 10-meter pixel resolution
        maxPixels: 1e6
      }).evaluate((result, err) => {
        if (err) reject(err)
        else resolve(result)
      })
    })

    const soilStats: any = await new Promise((resolve, reject) => {
      soilCombined.reduceRegion({
        reducer: ee.Reducer.mean(),
        geometry: roi.centroid(1).buffer(1000), // Buffer the centroid to guarantee pixel overlap
        crs: proj, // Native projection avoids Homolosine seams/reprojection errors
        scale: 250, // Native SoilGrids scale
        maxPixels: 1e6
      }).evaluate((result, err) => {
        if (err) reject(err)
        else resolve(result)
      })
    })

    const rawNdvi = stats.NDVI ?? 0.15
    const rawNdmi = stats.NDMI ?? -0.10
    const rawNdwi = stats.NDWI ?? -0.15

    const rawClay = soilStats["clay_0-5cm_mean"] ?? 280
    const rawSand = soilStats["sand_0-5cm_mean"] ?? 320
    const rawSilt = soilStats["silt_0-5cm_mean"] ?? 400
    const rawPh = soilStats["phh2o_0-5cm_mean"] ?? 62
    const rawSoc = soilStats["soc_0-5cm_mean"] ?? 180

    // Calibrate values:
    const clayPercent = rawClay / 10
    const sandPercent = rawSand / 10
    const siltPercent = rawSilt / 10
    const phVal = rawPh / 10
    const organicPercent = rawSoc / 100

    // 7. Calibrate raw index boundaries to client percentages
    // NDVI [0.15 (bare soil) to 0.80 (dense vegetation)] mapped to [10% to 95%]
    const healthPercent = Math.round(
      Math.max(10, Math.min(95, ((rawNdvi - 0.15) / 0.65) * 85 + 10))
    )

    // NDMI [ -0.10 (dry) to 0.30 (wet canopy/soil) ] mapped to [15% to 90%]
    const moisturePercent = Math.round(
      Math.max(15, Math.min(90, ((rawNdmi + 0.10) / 0.40) * 75 + 15))
    )

    // NDWI > 0.05 indicates presence of standing water (flooding/rice paddy)
    const isFlooded = rawNdwi > 0.05

    return new Response(
      JSON.stringify({ 
        success: true, 
        health_score: healthPercent, 
        moisture: moisturePercent,
        flooded: isFlooded,
        soil: {
          clay: clayPercent > 0 ? parseFloat(clayPercent.toFixed(1)) : 28.0,
          sand: sandPercent > 0 ? parseFloat(sandPercent.toFixed(1)) : 32.0,
          silt: siltPercent > 0 ? parseFloat(siltPercent.toFixed(1)) : 40.0,
          ph: phVal > 0 ? parseFloat(phVal.toFixed(1)) : 6.2,
          organic: organicPercent > 0 ? parseFloat(organicPercent.toFixed(2)) : 1.8
        },
        raw_ndvi: parseFloat(rawNdvi.toFixed(3)),
        raw_ndmi: parseFloat(rawNdmi.toFixed(3)),
        raw_ndwi: parseFloat(rawNdwi.toFixed(3)),
        timestamp: new Date().toISOString()
      }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 200
      }
    )

  } catch (error: any) {
    return new Response(
      JSON.stringify({ success: false, error: error.message }), 
      { 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        status: 400
      }
    )
  }
})
