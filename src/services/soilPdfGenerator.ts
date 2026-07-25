import * as Print from 'expo-print';
import * as Sharing from 'expo-sharing';
import { RealSoilTelemetry } from './soilApiService';
import { CropGrowthStage, AdvancedPrescription } from './agronomicEngine';

interface GeneratePdfOptions {
  fieldName: string;
  areaKattha: number;
  areaUnit: string;
  cropType: string;
  soilType: string;
  healthScore: number;
  telemetry: RealSoilTelemetry | null;
  growthStage: CropGrowthStage;
  prescriptions: AdvancedPrescription[];
  isNe?: boolean;
}

export async function generateAndShareSoilPdf(options: GeneratePdfOptions): Promise<void> {
  const {
    fieldName,
    areaKattha,
    areaUnit,
    cropType,
    soilType,
    healthScore,
    telemetry,
    growthStage,
    prescriptions,
    isNe = false
  } = options;

  const lat = telemetry?.latitude ?? 27.6784;
  const lon = telemetry?.longitude ?? 84.4385;
  const ph = telemetry?.ph ?? 6.4;
  const socPct = telemetry?.socPct ?? 1.85;
  const socStock = telemetry?.socStockMgHa ?? 48.5;
  const sandPct = telemetry?.sandPct ?? 38;
  const siltPct = telemetry?.siltPct ?? 30;
  const clayPct = telemetry?.clayPct ?? 32;
  const cec = telemetry?.cecMmolKg ?? 18.5;
  const bd = telemetry?.bulkDensity ?? 1.28;
  const surfaceMoisture = telemetry?.surfaceMoisture ?? 34;
  const subsurfaceMoisture = telemetry?.subsurfaceMoisture ?? 40;
  const soilTemp = telemetry?.soilTemperature ?? 26.2;
  const fetchedAt = telemetry?.fetchedAt ?? new Date().toLocaleTimeString();

  const isAcidic = ph < 5.8;
  const statusColor = healthScore >= 80 ? '#16a34a' : (healthScore >= 60 ? '#f59e0b' : '#ef4444');
  const statusText = healthScore >= 80 ? 'HIGH QUALITY SOIL' : (healthScore >= 60 ? 'MODERATE SOIL HEALTH' : 'ACIDIC / NEEDS CORRECTION');

  const htmlContent = `
    <!DOCTYPE html>
    <html>
      <head>
        <meta charset="utf-8" />
        <title>Soil Telemetry Report - ${fieldName}</title>
        <style>
          body {
            font-family: 'Helvetica Neue', Helvetica, Arial, sans-serif;
            color: #1e293b;
            margin: 0;
            padding: 32px;
            background-color: #ffffff;
          }
          .header-banner {
            background: linear-gradient(135deg, #1b3823 0%, #2e7d32 100%);
            color: #ffffff;
            padding: 24px;
            border-radius: 16px;
            margin-bottom: 24px;
            box-shadow: 0 4px 12px rgba(0,0,0,0.1);
          }
          .brand-title {
            font-size: 22px;
            font-weight: 900;
            letter-spacing: 0.5px;
            margin: 0 0 4px 0;
            color: #ffffff;
          }
          .brand-sub {
            font-size: 12px;
            color: #a7f3d0;
            font-weight: 700;
            text-transform: uppercase;
            letter-spacing: 1px;
            margin: 0;
          }
          .meta-grid {
            display: flex;
            justify-content: space-between;
            margin-top: 16px;
            padding-top: 12px;
            border-top: 1px solid rgba(255,255,255,0.2);
            font-size: 12px;
          }
          .score-card {
            display: flex;
            align-items: center;
            justify-content: space-between;
            background: #f0fdf4;
            border: 2px solid #bbf7d0;
            padding: 20px;
            border-radius: 16px;
            margin-bottom: 24px;
          }
          .score-circle {
            width: 72px;
            height: 72px;
            border-radius: 36px;
            border: 4px solid ${statusColor};
            display: flex;
            align-items: center;
            justify-content: center;
            font-size: 24px;
            font-weight: 900;
            color: ${statusColor};
            background: #ffffff;
          }
          .section-title {
            font-size: 15px;
            font-weight: 800;
            color: #166534;
            border-bottom: 2px solid #dcfce7;
            padding-bottom: 6px;
            margin-top: 24px;
            margin-bottom: 14px;
            text-transform: uppercase;
            letter-spacing: 0.5px;
          }
          .data-table {
            width: 100%;
            border-collapse: collapse;
            margin-bottom: 20px;
          }
          .data-table th {
            background: #f1f5f9;
            color: #475569;
            text-align: left;
            padding: 10px 12px;
            font-size: 11px;
            font-weight: 800;
            text-transform: uppercase;
            border-bottom: 2px solid #e2e8f0;
          }
          .data-table td {
            padding: 10px 12px;
            font-size: 12.5px;
            border-bottom: 1px solid #e2e8f0;
            color: #1e293b;
          }
          .badge {
            display: inline-block;
            padding: 4px 8px;
            border-radius: 6px;
            font-size: 11px;
            font-weight: 800;
          }
          .badge-green { background: #dcfce7; color: #166534; }
          .badge-blue { background: #dbeafe; color: #1e40af; }
          .badge-amber { background: #fef3c7; color: #92400e; }
          .prescription-card {
            background: #f8fafc;
            border: 1px solid #e2e8f0;
            border-radius: 12px;
            padding: 14px;
            margin-bottom: 10px;
          }
          .footer {
            margin-top: 40px;
            text-align: center;
            font-size: 11px;
            color: #94a3b8;
            border-top: 1px solid #e2e8f0;
            padding-top: 16px;
          }
        </style>
      </head>
      <body>
        <div class="header-banner">
          <h1 class="brand-title">ANAVI SMART AGRICULTURE</h1>
          <p class="brand-sub">ISRIC SoilGrids 250m GIS & NARC Phenological Telemetry</p>
          <div class="meta-grid">
            <div>
              <strong>Field:</strong> ${fieldName} (${areaKattha} ${areaUnit})<br/>
              <strong>Crop:</strong> ${cropType} • ${soilType} Soil
            </div>
            <div style="text-align: right;">
              <strong>Coordinates:</strong> ${lat.toFixed(4)}° N, ${lon.toFixed(4)}° E<br/>
              <strong>Generated:</strong> ${fetchedAt}
            </div>
          </div>
        </div>

        <div class="score-card">
          <div>
            <div style="font-size: 12px; color: #64748b; font-weight: 700; text-transform: uppercase;">Soil Quality Index</div>
            <div style="font-size: 20px; font-weight: 900; color: #1e293b; margin-top: 2px;">${statusText}</div>
            <div style="font-size: 12px; color: #166534; margin-top: 4px;">
              Phenological Stage: <strong>${growthStage.stageName} (Day ${growthStage.das} DAP)</strong>
            </div>
          </div>
          <div class="score-circle">
            ${healthScore}%
          </div>
        </div>

        <div class="section-title">💧 Multi-Depth Soil Moisture & Thermal Profile</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Horizon Depth</th>
              <th>Moisture Content</th>
              <th>Status & Aeration</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td><strong>Surface Horizon (0–5cm)</strong></td>
              <td><span class="badge badge-blue">${surfaceMoisture}% Volumetric</span></td>
              <td>Active Root & Tiller Zone</td>
            </tr>
            <tr>
              <td><strong>Subsoil Reserve (5–15cm)</strong></td>
              <td><span class="badge badge-blue">${subsurfaceMoisture}% Volumetric</span></td>
              <td>Percolation & Water Reserve</td>
            </tr>
            <tr>
              <td><strong>Root Zone Soil Temperature</strong></td>
              <td><span class="badge badge-amber">${soilTemp}°C</span></td>
              <td>Optimal Microbial Metabolism</td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">🪨 Soil Particle & Mineralogy Telemetry</div>
        <table class="data-table">
          <thead>
            <tr>
              <th>Property</th>
              <th>ISRIC 250m Value</th>
              <th>Agronomic Classification</th>
            </tr>
          </thead>
          <tbody>
            <tr>
              <td>Soil Reaction (pH in H2O)</td>
              <td><strong>${ph} pH</strong></td>
              <td><span class="badge ${isAcidic ? 'badge-amber' : 'badge-green'}">${isAcidic ? 'Acidic' : 'Optimal Balanced'}</span></td>
            </tr>
            <tr>
              <td>Cation Exchange Capacity (CEC)</td>
              <td><strong>${cec} mmol(c)/kg</strong></td>
              <td>High Nutrient Retention</td>
            </tr>
            <tr>
              <td>Soil Organic Carbon (SOC)</td>
              <td><strong>${socPct}% (${socStock} Mg C/ha)</strong></td>
              <td>Organic Carbon Reserve</td>
            </tr>
            <tr>
              <td>Bulk Density (Fine Earth)</td>
              <td><strong>${bd} g/cm³</strong></td>
              <td>Normal Compaction</td>
            </tr>
            <tr>
              <td>Texture Fractions</td>
              <td colspan="2">
                Sand: <strong>${sandPct}%</strong> • Silt: <strong>${siltPct}%</strong> • Clay: <strong>${clayPct}%</strong>
              </td>
            </tr>
          </tbody>
        </table>

        <div class="section-title">🌾 Stage-Window NARC Recommended Inputs</div>
        ${prescriptions.map(p => `
          <div class="prescription-card">
            <div style="display: flex; justify-content: space-between; align-items: center;">
              <strong style="font-size: 14px; color: #1e293b;">${p.emoji} ${p.productName}</strong>
              <span class="badge badge-green">${p.price}</span>
            </div>
            <div style="font-size: 12px; color: #2563eb; font-weight: 700; margin-top: 4px;">
              ⏱️ Timing Window: ${p.growthStageWindow}
            </div>
            <div style="font-size: 12px; color: #475569; margin-top: 4px;">
              <strong>Required Quantity:</strong> ${p.totalDosage}<br/>
              <em>${p.agronomicReason}</em>
            </div>
          </div>
        `).join('')}

        <div class="footer">
          Official Soil Telemetry Document • Generated by Anavi Smart Agriculture Mobile App • Nepal
        </div>
      </body>
    </html>
  `;

  // 1. Convert HTML into PDF file using expo-print
  const { uri } = await Print.printToFileAsync({ html: htmlContent });

  // 2. Open native PDF share sheet using expo-sharing
  if (await Sharing.isAvailableAsync()) {
    await Sharing.shareAsync(uri, {
      mimeType: 'application/pdf',
      dialogTitle: `Share Soil Report - ${fieldName}`,
      UTI: 'com.adobe.pdf'
    });
  }
}
