import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { AgriUIBlock } from './blocks/BlockRegistry';

interface DynamicAIVideoCardProps {
  blocks?: AgriUIBlock[];
  isDarkMode: boolean;
  colors: any;
}

// ─── Color palette helpers ───
const brandGreen = '#2E7D32';
const accentOrange = '#FF8F00';
const accentBlue = '#1565C0';
const dangerRed = '#E53935';
const successGreen = '#43A047';
const infoBlue = '#1E88E5';
const neutralGray = '#78909C';

const getAlertColors = (level: string, isDark: boolean) => {
  switch (level) {
    case 'Danger': case 'Toxic': case 'Severe': case 'Critical': case 'urgent':
      return { bg: isDark ? '#2b1e1e' : '#FFEBEE', border: dangerRed, icon: dangerRed };
    case 'Warning': case 'Caution': case 'moderate':
      return { bg: isDark ? '#2b2510' : '#FFF8E1', border: accentOrange, icon: accentOrange };
    default:
      return { bg: isDark ? '#1A2E22' : '#E8F5E9', border: successGreen, icon: successGreen };
  }
};

const getBadgeColors = (variant?: string, isDark?: boolean) => {
  switch (variant) {
    case 'success': return { bg: isDark ? '#1A2E22' : '#E8F5E9', text: successGreen };
    case 'warning': return { bg: isDark ? '#2b2510' : '#FFF8E1', text: accentOrange };
    case 'info': return { bg: isDark ? '#1A2232' : '#E3F2FD', text: infoBlue };
    default: return { bg: isDark ? '#2A2A2A' : '#F5F5F5', text: neutralGray };
  }
};

/**
 * Dynamic AI Block Renderer Engine — renders 68 block types
 * The Block Architect AI picks 5-8 blocks per video. This renders them all.
 */
export const DynamicAIVideoCard: React.FC<DynamicAIVideoCardProps> = ({ blocks, isDarkMode, colors }) => {
  if (!blocks || blocks.length === 0) return null;

  const renderBlock = (block: AgriUIBlock, idx: number) => {
    try {
      switch (block.type) {

        // ══════════════════════════════════════
        // 1. CONTENT BLOCKS
        // ══════════════════════════════════════

        case 'hero_summary': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                <Ionicons name="sparkles" size={18} color={brandGreen} />
                <Text style={[s.cardTitle, { color: colors.text }]}>{d.title}</Text>
                {d.badge ? (
                  <View style={{ backgroundColor: brandGreen + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4, marginLeft: 'auto' }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: brandGreen }}>{d.badge}</Text>
                  </View>
                ) : null}
              </View>
              <Text style={[s.body, { color: colors.text }]}>{d.description}</Text>
              {d.difficultyLevel ? (
                <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                  <View style={{ backgroundColor: accentBlue + '20', paddingHorizontal: 8, paddingVertical: 3, borderRadius: 4 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: accentBlue }}>📊 {d.difficultyLevel}</Text>
                  </View>
                  {d.duration ? <Text style={{ fontSize: 10, color: colors.secondaryText }}>⏱ {d.duration}</Text> : null}
                </View>
              ) : null}
            </View>
          );
        }

        case 'quote_highlight': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: isDarkMode ? '#1A2232' : '#F3E5F5', borderColor: '#9C27B0', borderLeftWidth: 4 }]}>
              <Text style={{ fontSize: 14, fontStyle: 'italic', color: colors.text, lineHeight: 21 }}>"{d.quote}"</Text>
              <Text style={{ fontSize: 11, color: '#9C27B0', fontWeight: '700', marginTop: 6 }}>— {d.speakerName}{d.speakerTitle ? `, ${d.speakerTitle}` : ''}</Text>
            </View>
          );
        }

        case 'fun_fact': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: isDarkMode ? '#2b2510' : '#FFF8E1', borderColor: accentOrange }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Text style={{ fontSize: 18 }}>{d.icon || '💡'}</Text>
                <Text style={[s.cardTitle, { color: accentOrange }]}>{d.category || 'Did You Know?'}</Text>
              </View>
              <Text style={[s.body, { color: colors.text, marginTop: 6 }]}>{d.fact}</Text>
            </View>
          );
        }

        case 'video_context': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>🌍 Video Context</Text>
              <View style={{ gap: 4, marginTop: 6 }}>
                {[
                  { l: 'Region', v: d.region }, { l: 'Climate', v: d.climateZone },
                  { l: 'Season', v: d.season }, { l: 'Type', v: d.farmingType },
                ].map((r, i) => (
                  <View key={i} style={s.kvRow}>
                    <Text style={[s.kvLabel, { color: colors.secondaryText }]}>{r.l}</Text>
                    <Text style={[s.kvValue, { color: colors.text }]}>{r.v}</Text>
                  </View>
                ))}
                {d.targetCropsOrLivestock?.length > 0 ? (
                  <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 4 }}>
                    {d.targetCropsOrLivestock.map((t, i) => (
                      <View key={i} style={{ backgroundColor: brandGreen + '20', paddingHorizontal: 8, paddingVertical: 2, borderRadius: 4 }}>
                        <Text style={{ fontSize: 10, color: brandGreen, fontWeight: '600' }}>{t}</Text>
                      </View>
                    ))}
                  </View>
                ) : null}
              </View>
            </View>
          );
        }

        case 'narrator_note': {
          const d = block.data;
          const imp = d.importance === 'critical' ? dangerRed : d.importance === 'high' ? accentOrange : brandGreen;
          return (
            <View key={idx} style={[s.card, { backgroundColor: isDarkMode ? '#1A2E22' : '#E8F5E9', borderColor: imp, borderLeftWidth: 4 }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: imp }}>📝 {d.authorName || 'Expert Note'}</Text>
              <Text style={[s.body, { color: colors.text, marginTop: 4 }]}>{d.note}</Text>
            </View>
          );
        }

        case 'key_takeaways': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: brandGreen }]}>
              <Text style={[s.cardTitle, { color: brandGreen }]}>🎯 {d.title || 'Key Takeaways'}</Text>
              {d.takeaways.map((t, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'flex-start', gap: 8, marginTop: 8 }}>
                  <View style={{ width: 20, height: 20, borderRadius: 10, backgroundColor: brandGreen, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 10, fontWeight: '800' }}>{i + 1}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={[s.body, { color: colors.text, fontWeight: '600' }]}>{t.point}</Text>
                    {t.elaboration ? <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>{t.elaboration}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          );
        }

        case 'audio_snippet_transcript': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: isDarkMode ? '#1A2232' : '#E3F2FD', borderColor: accentBlue }]}>
              <Text style={{ fontSize: 11, color: accentBlue, fontWeight: '700' }}>🎙 {d.speaker} ({d.startTime} - {d.endTime})</Text>
              <Text style={[s.body, { color: colors.text, fontStyle: 'italic', marginTop: 4 }]}>"{d.transcriptText}"</Text>
            </View>
          );
        }

        // ══════════════════════════════════════
        // 2. STEP / PROCESS BLOCKS
        // ══════════════════════════════════════

        case 'step_list': {
          const d = block.data;
          return (
            <View key={idx} style={{ gap: 10 }}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>📝 {d.title}</Text>
              {d.steps.map((step, i) => (
                <View key={i} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row', gap: 10, alignItems: 'flex-start' }]}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: brandGreen, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{step.stepNumber}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{step.title}</Text>
                    <Text style={{ fontSize: 12, color: colors.secondaryText, lineHeight: 18, marginTop: 2 }}>{step.description}</Text>
                    {step.duration ? <Text style={{ fontSize: 10, color: accentBlue, marginTop: 4 }}>⏱ {step.duration}</Text> : null}
                    {step.warning ? <Text style={{ fontSize: 10, color: dangerRed, marginTop: 2 }}>⚠️ {step.warning}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          );
        }

        case 'numbered_process': {
          const d = block.data;
          return (
            <View key={idx} style={{ gap: 8 }}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>🔄 {d.processName} ({d.totalPhases} phases)</Text>
              {d.phases.map((p, i) => (
                <View key={i} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <View style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                    <View style={{ backgroundColor: accentBlue, width: 24, height: 24, borderRadius: 12, alignItems: 'center', justifyContent: 'center' }}>
                      <Text style={{ color: '#fff', fontSize: 11, fontWeight: '800' }}>{p.phaseIndex}</Text>
                    </View>
                    <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>{p.name}</Text>
                    {p.estimatedDays ? <Text style={{ fontSize: 10, color: colors.secondaryText, marginLeft: 'auto' }}>{p.estimatedDays}d</Text> : null}
                  </View>
                  <Text style={[s.body, { color: colors.secondaryText, marginTop: 4 }]}>{p.description}</Text>
                </View>
              ))}
            </View>
          );
        }

        case 'quick_steps': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: brandGreen }]}>
              <Text style={[s.cardTitle, { color: brandGreen }]}>⚡ {d.title}</Text>
              <Text style={{ fontSize: 11, color: colors.secondaryText, marginBottom: 6 }}>{d.summary}</Text>
              {d.actions.map((a, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  <Text style={{ color: brandGreen, fontWeight: '800' }}>→</Text>
                  <Text style={[s.body, { color: colors.text }]}>{a}</Text>
                </View>
              ))}
            </View>
          );
        }

        case 'decision_tree': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: accentBlue }]}>
              <Text style={[s.cardTitle, { color: accentBlue }]}>🌳 {d.rootQuestion}</Text>
              {d.nodes.map((n, i) => (
                <View key={i} style={{ marginTop: 8, padding: 8, backgroundColor: isDarkMode ? '#1A2232' : '#E3F2FD', borderRadius: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: accentBlue }}>❓ {n.condition}</Text>
                  <Text style={{ fontSize: 11, color: successGreen, marginTop: 4 }}>✅ Yes → {n.outcomeIfTrue}</Text>
                  <Text style={{ fontSize: 11, color: dangerRed, marginTop: 2 }}>❌ No → {n.outcomeIfFalse}</Text>
                </View>
              ))}
            </View>
          );
        }

        case 'flowchart_steps': {
          const d = block.data;
          return (
            <View key={idx} style={{ gap: 6 }}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>📊 {d.workflowName}</Text>
              {d.nodes.map((n, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 8 }}>
                  <View style={{ width: 10, height: 10, borderRadius: n.type === 'decision' ? 0 : 5, backgroundColor: n.type === 'start' ? successGreen : n.type === 'end' ? dangerRed : accentBlue }} />
                  <Text style={[s.body, { color: colors.text, fontWeight: n.type === 'start' || n.type === 'end' ? '700' : '400' }]}>{n.label}</Text>
                  {i < d.nodes.length - 1 ? <Text style={{ color: colors.secondaryText }}>→</Text> : null}
                </View>
              ))}
            </View>
          );
        }

        case 'troubleshooting_steps': {
          const d = block.data;
          return (
            <View key={idx} style={{ gap: 8 }}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>🔧 {d.issueCategory}</Text>
              {d.troubleshootingGrid.map((t, i) => {
                const ac = getAlertColors(t.urgency, isDarkMode);
                return (
                  <View key={i} style={[s.card, { backgroundColor: ac.bg, borderColor: ac.border }]}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: ac.icon }}>🩺 {t.symptom}</Text>
                    <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>Cause: {t.probableCause}</Text>
                    <Text style={{ fontSize: 12, color: colors.text, fontWeight: '600', marginTop: 4 }}>✅ {t.solution}</Text>
                  </View>
                );
              })}
            </View>
          );
        }

        // ══════════════════════════════════════
        // 3. DATA / TABLE BLOCKS
        // ══════════════════════════════════════

        case 'kv_table': {
          const d = block.data;
          return (
            <View key={idx} style={[s.tableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>📋 {d.tableName}</Text>
              </View>
              {d.rows.map((r, i) => (
                <View key={i} style={[s.kvRow, { borderBottomWidth: i < d.rows.length - 1 ? 1 : 0, borderBottomColor: colors.border, paddingHorizontal: 12, paddingVertical: 8 }]}>
                  <Text style={[s.kvLabel, { color: colors.secondaryText }]}>{r.key}</Text>
                  <Text style={[s.kvValue, { color: colors.text }]}>{r.value}{r.unit ? ` ${r.unit}` : ''}</Text>
                </View>
              ))}
            </View>
          );
        }

        case 'comparison_table': {
          const d = block.data;
          return (
            <View key={idx} style={[s.tableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>⚖️ {d.title}</Text>
              </View>
              {/* Header */}
              <View style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, backgroundColor: isDarkMode ? '#1A2E22' : '#E8F5E9' }}>
                <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: brandGreen }}>Feature</Text>
                {d.headers.map((h, i) => <Text key={i} style={{ flex: 1, fontSize: 11, fontWeight: '700', color: brandGreen, textAlign: 'center' }}>{h}</Text>)}
              </View>
              {d.rows.map((r, i) => (
                <View key={i} style={{ flexDirection: 'row', paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: i < d.rows.length - 1 ? 1 : 0, borderBottomColor: colors.border }}>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '600', color: colors.text }}>{r.feature}</Text>
                  {r.values.map((v, vi) => <Text key={vi} style={{ flex: 1, fontSize: 11, color: colors.secondaryText, textAlign: 'center' }}>{v}</Text>)}
                </View>
              ))}
            </View>
          );
        }

        case 'dosage_chart': {
          const d = block.data;
          return (
            <View key={idx} style={{ gap: 8 }}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>💊 {d.productName} ({d.activeIngredient})</Text>
              {d.dosageRules.map((r, i) => (
                <View key={i} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: brandGreen }}>{r.target}</Text>
                  <View style={{ gap: 2, marginTop: 4 }}>
                    <Text style={{ fontSize: 11, color: colors.text }}>Dose: {r.dosagePerUnit}</Text>
                    {r.waterRatio ? <Text style={{ fontSize: 11, color: colors.secondaryText }}>Water: {r.waterRatio}</Text> : null}
                    <Text style={{ fontSize: 11, color: colors.secondaryText }}>Method: {r.applicationMethod}</Text>
                    <Text style={{ fontSize: 10, color: dangerRed }}>⏳ Safety: {r.safetyIntervalDays} days PHI</Text>
                  </View>
                </View>
              ))}
            </View>
          );
        }

        case 'nutrient_table': {
          const d = block.data;
          return (
            <View key={idx} style={[s.tableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>🧪 {d.materialName} — NPK Profile</Text>
              </View>
              {[{ l: 'Nitrogen (N)', v: `${d.nitrogenPercent}%` }, { l: 'Phosphorus (P)', v: `${d.phosphorusPercent}%` }, { l: 'Potassium (K)', v: `${d.potassiumPercent}%` }].map((r, i) => (
                <View key={i} style={[s.kvRow, { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={[s.kvLabel, { color: colors.secondaryText }]}>{r.l}</Text>
                  <Text style={[s.kvValue, { color: brandGreen, fontWeight: '800' }]}>{r.v}</Text>
                </View>
              ))}
              {d.micronutrients?.map((m, i) => (
                <View key={i} style={[s.kvRow, { paddingHorizontal: 12, paddingVertical: 6 }]}>
                  <Text style={{ fontSize: 11, color: colors.secondaryText }}>{m.name}</Text>
                  <Text style={{ fontSize: 11, color: colors.text }}>{m.ppmOrPercent}</Text>
                </View>
              ))}
            </View>
          );
        }

        case 'cost_breakdown': {
          const d = block.data;
          return (
            <View key={idx} style={[s.tableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>💰 Cost Breakdown ({d.currency})</Text>
              </View>
              {d.items.map((item, i) => (
                <View key={i} style={[s.kvRow, { paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={{ flex: 2, fontSize: 11, color: colors.text }}>{item.item}</Text>
                  <Text style={{ flex: 1, fontSize: 11, color: colors.secondaryText, textAlign: 'center' }}>x{item.quantity}</Text>
                  <Text style={{ flex: 1, fontSize: 11, fontWeight: '700', color: brandGreen, textAlign: 'right' }}>{item.totalCost.toLocaleString()}</Text>
                </View>
              ))}
              <View style={{ padding: 12, backgroundColor: isDarkMode ? '#1A2E22' : '#E8F5E9' }}>
                <View style={s.kvRow}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: brandGreen }}>TOTAL</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: brandGreen }}>{d.currency} {d.totalExpenditure.toLocaleString()}</Text>
                </View>
              </View>
            </View>
          );
        }

        case 'roi_calculator': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: brandGreen }]}>
              <Text style={[s.cardTitle, { color: brandGreen }]}>📈 {d.investmentName} — ROI</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {[
                  { l: 'Investment', v: `${d.currency} ${d.initialInvestment.toLocaleString()}`, c: accentBlue },
                  { l: 'Revenue', v: `${d.currency} ${d.expectedRevenue.toLocaleString()}`, c: successGreen },
                  { l: 'Net Profit', v: `${d.currency} ${d.netProfit.toLocaleString()}`, c: brandGreen },
                  { l: 'ROI', v: `${d.roiPercentage}%`, c: successGreen },
                  { l: 'Payback', v: `${d.paybackPeriodMonths} months`, c: accentOrange },
                ].map((m, i) => (
                  <View key={i} style={{ alignItems: 'center', minWidth: 80, padding: 8, backgroundColor: m.c + '15', borderRadius: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: m.c }}>{m.v}</Text>
                    <Text style={{ fontSize: 9, color: colors.secondaryText }}>{m.l}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        }

        case 'yield_estimate': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>🌾 {d.cropName} — Yield Estimate</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 }}>
                {[{ l: 'Min', v: d.minExpectedYield }, { l: 'Avg', v: d.averageYield }, { l: 'Max', v: d.maxExpectedYield }].map((m, i) => (
                  <View key={i} style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: i === 1 ? brandGreen : colors.text }}>{m.v}</Text>
                    <Text style={{ fontSize: 10, color: colors.secondaryText }}>{m.l}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 10, color: colors.secondaryText, marginTop: 6 }}>Area: {d.landArea}</Text>
            </View>
          );
        }

        case 'measurement_specs': {
          const d = block.data;
          return (
            <View key={idx} style={[s.tableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>📏 {d.title}</Text>
              </View>
              {d.measurements.map((m, i) => (
                <View key={i} style={[s.kvRow, { paddingHorizontal: 12, paddingVertical: 8, borderBottomWidth: i < d.measurements.length - 1 ? 1 : 0, borderBottomColor: colors.border }]}>
                  <Text style={[s.kvLabel, { color: colors.secondaryText }]}>{m.parameter}</Text>
                  <Text style={[s.kvValue, { color: colors.text }]}>{m.value} {m.unit}</Text>
                </View>
              ))}
            </View>
          );
        }

        case 'soil_test_report': {
          const d = block.data;
          const statusColor = (s: string) => s === 'High' ? successGreen : s === 'Medium' ? accentOrange : dangerRed;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>🧪 Soil Test — {d.sampleLocation}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 }}>
                {[{ l: 'pH', v: d.phLevel.toString() }, { l: 'N', v: d.nitrogenStatus, c: statusColor(d.nitrogenStatus) }, { l: 'P', v: d.phosphorusStatus, c: statusColor(d.phosphorusStatus) }, { l: 'K', v: d.potassiumStatus, c: statusColor(d.potassiumStatus) }].map((m, i) => (
                  <View key={i} style={{ alignItems: 'center', padding: 6, backgroundColor: (m.c || accentBlue) + '15', borderRadius: 8 }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: m.c || accentBlue }}>{m.v}</Text>
                    <Text style={{ fontSize: 9, color: colors.secondaryText }}>{m.l}</Text>
                  </View>
                ))}
              </View>
              {d.recommendations.length > 0 ? (
                <View style={{ marginTop: 8 }}>
                  {d.recommendations.map((r, i) => (
                    <Text key={i} style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>• {r}</Text>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }

        case 'feed_conversion_ratio': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>🐄 Feed Conversion — {d.animalType}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 }}>
                {[{ l: 'FCR', v: d.fcrRatio.toString() }, { l: 'Feed (kg)', v: d.feedConsumedKg.toString() }, { l: 'Gain (kg)', v: d.weightGainedKg.toString() }, { l: 'Days', v: d.periodDays.toString() }].map((m, i) => (
                  <View key={i} style={{ alignItems: 'center' }}>
                    <Text style={{ fontSize: 14, fontWeight: '800', color: brandGreen }}>{m.v}</Text>
                    <Text style={{ fontSize: 9, color: colors.secondaryText }}>{m.l}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 10, color: colors.secondaryText, marginTop: 6 }}>Benchmark: {d.benchmarks}</Text>
            </View>
          );
        }

        // ══════════════════════════════════════
        // 4. LIST BLOCKS
        // ══════════════════════════════════════

        case 'bullet_insights': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>💡 {d.heading}</Text>
              {d.bullets.map((b, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 6, marginTop: 4 }}>
                  <Text style={{ color: brandGreen, fontWeight: '800' }}>•</Text>
                  <Text style={[s.body, { color: colors.text }]}>{b}</Text>
                </View>
              ))}
            </View>
          );
        }

        case 'checklist': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>☑️ {d.title}</Text>
              {d.items.map((item, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'flex-start' }}>
                  <View style={{ width: 18, height: 18, borderRadius: 4, borderWidth: 2, borderColor: brandGreen, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ fontSize: 10, color: brandGreen }}>✓</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, color: colors.text }}>{item.label}{item.isOptional ? ' (optional)' : ''}</Text>
                    {item.notes ? <Text style={{ fontSize: 10, color: colors.secondaryText }}>{item.notes}</Text> : null}
                  </View>
                </View>
              ))}
            </View>
          );
        }

        case 'pro_con_list': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>⚖️ {d.topic}</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: successGreen, marginBottom: 4 }}>✅ PROS</Text>
                  {d.pros.map((p, i) => <Text key={i} style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>• {p}</Text>)}
                </View>
                <View style={{ width: 1, backgroundColor: colors.border }} />
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: dangerRed, marginBottom: 4 }}>❌ CONS</Text>
                  {d.cons.map((c, i) => <Text key={i} style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>• {c}</Text>)}
                </View>
              </View>
            </View>
          );
        }

        case 'faq_list': {
          const d = block.data;
          return (
            <View key={idx} style={{ gap: 6 }}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>❓ FAQ</Text>
              {d.faqs.map((f, i) => (
                <View key={i} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: accentBlue }}>Q: {f.question}</Text>
                  <Text style={{ fontSize: 12, color: colors.text, marginTop: 4 }}>A: {f.answer}</Text>
                </View>
              ))}
            </View>
          );
        }

        case 'do_dont_list': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>✅❌ {d.topic}</Text>
              <View style={{ marginTop: 6 }}>
                {d.dos.map((item, i) => <Text key={i} style={{ fontSize: 11, color: successGreen, marginTop: 2 }}>✅ DO: {item}</Text>)}
                {d.donts.map((item, i) => <Text key={i} style={{ fontSize: 11, color: dangerRed, marginTop: 2 }}>❌ DON'T: {item}</Text>)}
              </View>
            </View>
          );
        }

        case 'ingredient_list': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>🧪 {d.recipeName}</Text>
              <Text style={{ fontSize: 10, color: colors.secondaryText }}>Yield: {d.yieldVolumeOrWeight}{d.preparationTime ? ` | ⏱ ${d.preparationTime}` : ''}</Text>
              {d.ingredients.map((ing, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: brandGreen, minWidth: 60 }}>{ing.quantity}</Text>
                  <Text style={{ fontSize: 12, color: colors.text, flex: 1 }}>{ing.name}{ing.purpose ? ` — ${ing.purpose}` : ''}</Text>
                </View>
              ))}
            </View>
          );
        }

        case 'tool_list': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>🔧 {d.category}</Text>
              {d.tools.map((t, i) => (
                <View key={i} style={{ flexDirection: 'row', alignItems: 'center', gap: 6, marginTop: 6 }}>
                  <Text style={{ fontSize: 14 }}>{t.isEssential ? '🔴' : '🟡'}</Text>
                  <Text style={{ fontSize: 12, color: colors.text, flex: 1 }}>{t.name}</Text>
                  {t.estimatedCostRange ? <Text style={{ fontSize: 10, color: colors.secondaryText }}>{t.estimatedCostRange}</Text> : null}
                </View>
              ))}
            </View>
          );
        }

        case 'requirement_list': {
          const d = block.data;
          const typeIcon = (t: string) => t === 'climate' ? '🌤' : t === 'water' ? '💧' : t === 'soil' ? '🌍' : t === 'legal' ? '📜' : '💰';
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>📋 {d.title}</Text>
              {d.requirements.map((r, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 8, marginTop: 6, alignItems: 'flex-start' }}>
                  <Text style={{ fontSize: 14 }}>{typeIcon(r.type)}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{r.name}{r.isMandatory ? ' *' : ''}</Text>
                    <Text style={{ fontSize: 11, color: colors.secondaryText }}>{r.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          );
        }

        case 'organic_cert_checklist': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: isDarkMode ? '#1A2E22' : '#E8F5E9', borderColor: brandGreen }]}>
              <Text style={[s.cardTitle, { color: brandGreen }]}>🌱 {d.standardName}</Text>
              {d.criteria.map((c, i) => (
                <View key={i} style={{ marginTop: 8 }}>
                  <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>✓ {c.rule}</Text>
                  <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>Method: {c.complianceMethod}</Text>
                </View>
              ))}
            </View>
          );
        }

        // ══════════════════════════════════════
        // 5. TIMELINE / CALENDAR BLOCKS
        // ══════════════════════════════════════

        case 'timeline': {
          const d = block.data;
          return (
            <View key={idx} style={{ gap: 2 }}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>📅 {d.title}</Text>
              {d.events.map((e, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 10, marginTop: 8 }}>
                  <View style={{ alignItems: 'center', width: 20 }}>
                    <View style={{ width: 10, height: 10, borderRadius: 5, backgroundColor: brandGreen }} />
                    {i < d.events.length - 1 ? <View style={{ width: 2, flex: 1, backgroundColor: brandGreen + '40' }} /> : null}
                  </View>
                  <View style={{ flex: 1, paddingBottom: 12 }}>
                    <Text style={{ fontSize: 10, fontWeight: '700', color: brandGreen }}>{e.dateOrPeriod}</Text>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{e.title}</Text>
                    <Text style={{ fontSize: 11, color: colors.secondaryText }}>{e.description}</Text>
                  </View>
                </View>
              ))}
            </View>
          );
        }

        case 'season_calendar': {
          const d = block.data;
          return (
            <View key={idx} style={{ gap: 8 }}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>🗓 {d.cropName} — Seasonal Calendar</Text>
              {d.seasons.map((season, i) => (
                <View key={i} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: brandGreen }}>{season.seasonName}</Text>
                  {season.activities.map((a, ai) => <Text key={ai} style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>• {a}</Text>)}
                  {season.keyMilestones.map((m, mi) => <Text key={mi} style={{ fontSize: 10, color: accentOrange, marginTop: 2 }}>🎯 {m}</Text>)}
                </View>
              ))}
            </View>
          );
        }

        case 'growth_stages': {
          const d = block.data;
          return (
            <View key={idx} style={{ gap: 8 }}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>🌱 {d.subjectName} — Growth Stages</Text>
              {d.stages.map((stage, i) => (
                <View key={i} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row', gap: 10 }]}>
                  <View style={{ width: 28, height: 28, borderRadius: 14, backgroundColor: brandGreen, alignItems: 'center', justifyContent: 'center' }}>
                    <Text style={{ color: '#fff', fontSize: 12, fontWeight: '800' }}>{stage.stageNumber}</Text>
                  </View>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '700', color: colors.text }}>{stage.stageName} ({stage.durationDays}d)</Text>
                    <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>{stage.careInstructions}</Text>
                    {stage.keyIndicators.map((k, ki) => <Text key={ki} style={{ fontSize: 10, color: accentBlue, marginTop: 1 }}>📌 {k}</Text>)}
                  </View>
                </View>
              ))}
            </View>
          );
        }

        case 'monthly_planner': {
          const d = block.data;
          return (
            <View key={idx} style={{ gap: 6 }}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>📆 Monthly Planner{d.year ? ` — ${d.year}` : ''}</Text>
              {d.months.map((m, i) => (
                <View key={i} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: brandGreen }}>{m.month}</Text>
                  {m.primaryTasks.map((t, ti) => <Text key={ti} style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>🔵 {t}</Text>)}
                  {m.secondaryTasks?.map((t, ti) => <Text key={ti} style={{ fontSize: 10, color: colors.secondaryText, marginTop: 1 }}>⚪ {t}</Text>)}
                </View>
              ))}
            </View>
          );
        }

        case 'harvest_schedule': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>🌾 Harvest Schedule — {d.cropName}</Text>
              <View style={{ gap: 4, marginTop: 6 }}>
                {[{ l: 'First Harvest', v: `${d.firstHarvestDays} days` }, { l: 'Window', v: `${d.harvestWindowDays} days` }, { l: 'Storage', v: `${d.postHarvestStorageDays} days at ${d.idealStorageTemp}` }].map((r, i) => (
                  <View key={i} style={s.kvRow}>
                    <Text style={[s.kvLabel, { color: colors.secondaryText }]}>{r.l}</Text>
                    <Text style={[s.kvValue, { color: colors.text }]}>{r.v}</Text>
                  </View>
                ))}
              </View>
              <View style={{ marginTop: 6 }}>
                {d.maturityIndicators.map((m, i) => <Text key={i} style={{ fontSize: 10, color: successGreen }}>✅ {m}</Text>)}
              </View>
            </View>
          );
        }

        case 'gestation_timeline': {
          const d = block.data;
          return (
            <View key={idx} style={{ gap: 8 }}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>🤰 {d.animalSpecies} — Gestation ({d.gestationDaysAvg} days)</Text>
              {d.keyMilestones.map((m, i) => (
                <View key={i} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row', gap: 10 }]}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: brandGreen, minWidth: 50 }}>{m.dayOrWeek}</Text>
                  <View style={{ flex: 1 }}>
                    <Text style={{ fontSize: 12, fontWeight: '600', color: colors.text }}>{m.event}</Text>
                    <Text style={{ fontSize: 11, color: colors.secondaryText }}>{m.careRequired}</Text>
                  </View>
                </View>
              ))}
            </View>
          );
        }

        // ══════════════════════════════════════
        // 6. SPECIALIZED AGRICULTURAL BLOCKS
        // ══════════════════════════════════════

        case 'breed_card': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: brandGreen }]}>
              <Text style={[s.cardTitle, { color: brandGreen }]}>🐄 {d.breedName}</Text>
              <Text style={{ fontSize: 10, color: colors.secondaryText }}>Origin: {d.origin} | Best For: {d.bestFor}</Text>
              <View style={{ gap: 2, marginTop: 6 }}>
                {d.traits.map((t, i) => <Text key={i} style={{ fontSize: 11, color: colors.text }}>• {t}</Text>)}
              </View>
              <View style={{ flexDirection: 'row', gap: 12, marginTop: 8 }}>
                <View style={{ padding: 6, backgroundColor: brandGreen + '15', borderRadius: 6 }}>
                  <Text style={{ fontSize: 12, fontWeight: '800', color: brandGreen }}>{d.avgWeight}</Text>
                  <Text style={{ fontSize: 9, color: colors.secondaryText }}>Avg Weight</Text>
                </View>
                {d.dailyMilkYieldOrEggCount ? (
                  <View style={{ padding: 6, backgroundColor: accentBlue + '15', borderRadius: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: accentBlue }}>{d.dailyMilkYieldOrEggCount}</Text>
                    <Text style={{ fontSize: 9, color: colors.secondaryText }}>Daily Yield</Text>
                  </View>
                ) : null}
              </View>
            </View>
          );
        }

        case 'disease_card': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: isDarkMode ? '#2b1e1e' : '#FFEBEE', borderColor: dangerRed }]}>
              <Text style={[s.cardTitle, { color: dangerRed }]}>🦠 {d.diseaseName}{d.scientificName ? ` (${d.scientificName})` : ''}</Text>
              <Text style={{ fontSize: 10, color: colors.secondaryText }}>Affects: {d.affectedCropsOrAnimals.join(', ')}</Text>
              <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 4 }}>Cause: {d.cause}</Text>
              <Text style={{ fontSize: 11, fontWeight: '700', color: dangerRed, marginTop: 8 }}>Symptoms:</Text>
              {d.symptoms.map((sy, i) => <Text key={i} style={{ fontSize: 11, color: colors.text }}>• {sy}</Text>)}
              <Text style={{ fontSize: 11, fontWeight: '700', color: successGreen, marginTop: 8 }}>Organic Treatment:</Text>
              {d.organicTreatment.map((t, i) => <Text key={i} style={{ fontSize: 11, color: colors.text }}>🌿 {t}</Text>)}
              <Text style={{ fontSize: 11, fontWeight: '700', color: accentBlue, marginTop: 6 }}>Chemical Treatment:</Text>
              {d.chemicalTreatment.map((t, i) => <Text key={i} style={{ fontSize: 11, color: colors.text }}>💊 {t}</Text>)}
              <Text style={{ fontSize: 11, fontWeight: '700', color: brandGreen, marginTop: 6 }}>Prevention:</Text>
              {d.prevention.map((p, i) => <Text key={i} style={{ fontSize: 11, color: colors.text }}>🛡 {p}</Text>)}
            </View>
          );
        }

        case 'pest_identification': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: isDarkMode ? '#2b2510' : '#FFF8E1', borderColor: accentOrange }]}>
              <Text style={[s.cardTitle, { color: accentOrange }]}>🐛 {d.pestName}{d.scientificName ? ` (${d.scientificName})` : ''}</Text>
              <Text style={{ fontSize: 11, color: colors.text, marginTop: 4 }}>Damage: {d.damageType}</Text>
              <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>Threshold: {d.controlThreshold}</Text>
              {d.identifyingFeatures.map((f, i) => <Text key={i} style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>👁 {f}</Text>)}
              {d.naturalPredators.length > 0 ? <Text style={{ fontSize: 11, color: successGreen, marginTop: 6 }}>🐞 Predators: {d.naturalPredators.join(', ')}</Text> : null}
              {d.recommendedControl.map((c, i) => <Text key={i} style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>✅ {c}</Text>)}
            </View>
          );
        }

        case 'soil_profile': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>🌍 Soil Profile — {d.soilType}</Text>
              <View style={{ gap: 4, marginTop: 6 }}>
                <Text style={{ fontSize: 11, color: colors.text }}>Drainage: {d.drainageQuality} | pH: {d.idealPhRange}</Text>
                <Text style={{ fontSize: 11, color: brandGreen, fontWeight: '600' }}>Suitable: {d.suitableCrops.join(', ')}</Text>
                {d.improvementTips.map((t, i) => <Text key={i} style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>💡 {t}</Text>)}
              </View>
            </View>
          );
        }

        case 'irrigation_plan': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: accentBlue }]}>
              <Text style={[s.cardTitle, { color: accentBlue }]}>💧 Irrigation — {d.systemType}</Text>
              <View style={{ gap: 4, marginTop: 6 }}>
                {[{ l: 'Water/Day', v: `${d.waterRequirementLitersPerDay}L` }, { l: 'Frequency', v: d.wateringFrequency }, { l: 'Best Time', v: d.bestTimeOfDay }].map((r, i) => (
                  <View key={i} style={s.kvRow}>
                    <Text style={[s.kvLabel, { color: colors.secondaryText }]}>{r.l}</Text>
                    <Text style={[s.kvValue, { color: colors.text }]}>{r.v}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 10, color: brandGreen, marginTop: 6 }}>💡 {d.moistureMonitoringTip}</Text>
            </View>
          );
        }

        case 'seed_variety': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: brandGreen }]}>🌱 {d.varietyName} ({d.type})</Text>
              <View style={{ gap: 4, marginTop: 6 }}>
                {[{ l: 'Maturity', v: `${d.daysToMaturity} days` }, { l: 'Yield', v: d.yieldPotential }, { l: 'Seed Rate', v: d.seedRatePerAcre }].map((r, i) => (
                  <View key={i} style={s.kvRow}>
                    <Text style={[s.kvLabel, { color: colors.secondaryText }]}>{r.l}</Text>
                    <Text style={[s.kvValue, { color: colors.text }]}>{r.v}</Text>
                  </View>
                ))}
              </View>
              {d.diseaseResistance.length > 0 ? <Text style={{ fontSize: 10, color: successGreen, marginTop: 4 }}>🛡 Resistant: {d.diseaseResistance.join(', ')}</Text> : null}
            </View>
          );
        }

        case 'fertilizer_schedule': {
          const d = block.data;
          return (
            <View key={idx} style={{ gap: 8 }}>
              <Text style={[s.sectionTitle, { color: colors.text }]}>🌿 Fertilizer Schedule — {d.cropName}</Text>
              {d.applications.map((a, i) => (
                <View key={i} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <Text style={{ fontSize: 12, fontWeight: '700', color: brandGreen }}>{a.growthStage}</Text>
                  <Text style={{ fontSize: 11, color: colors.text }}>{a.fertilizerType} — {a.dosagePerAcre}</Text>
                  <Text style={{ fontSize: 10, color: colors.secondaryText }}>{a.applicationMethod}</Text>
                </View>
              ))}
            </View>
          );
        }

        case 'spray_timing': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: isDarkMode ? '#2b1e1e' : '#FFEBEE', borderColor: dangerRed }]}>
              <Text style={[s.cardTitle, { color: dangerRed }]}>🎯 Spray Timing — {d.targetPestOrDisease}</Text>
              <View style={{ gap: 4, marginTop: 6 }}>
                {[{ l: 'Time', v: d.recommendedTimeOfDay }, { l: 'Wind', v: d.idealWindSpeedKmh }, { l: 'Temp', v: d.idealTempRangeC }, { l: 'Rainfast', v: `${d.rainfastHours}h` }].map((r, i) => (
                  <View key={i} style={s.kvRow}>
                    <Text style={[s.kvLabel, { color: colors.secondaryText }]}>{r.l}</Text>
                    <Text style={[s.kvValue, { color: colors.text }]}>{r.v}</Text>
                  </View>
                ))}
              </View>
              {d.ppeRequired.length > 0 ? <Text style={{ fontSize: 10, color: dangerRed, marginTop: 6 }}>🧤 PPE: {d.ppeRequired.join(', ')}</Text> : null}
            </View>
          );
        }

        case 'weather_advisory': {
          const d = block.data;
          const ac = getAlertColors(d.alertLevel, isDarkMode);
          return (
            <View key={idx} style={[s.card, { backgroundColor: ac.bg, borderColor: ac.border }]}>
              <Text style={{ fontSize: 13, fontWeight: '800', color: ac.icon }}>⛈ {d.alertLevel}: {d.weatherCondition}</Text>
              <Text style={{ fontSize: 10, color: colors.secondaryText, marginTop: 2 }}>Valid: {d.validPeriod}</Text>
              {d.affectedOperations.map((o, i) => <Text key={i} style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>⚠️ {o}</Text>)}
              {d.protectiveMeasures.map((m, i) => <Text key={i} style={{ fontSize: 11, color: successGreen, marginTop: 2 }}>✅ {m}</Text>)}
            </View>
          );
        }

        case 'compost_recipe': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: isDarkMode ? '#1A2E22' : '#E8F5E9', borderColor: brandGreen }]}>
              <Text style={[s.cardTitle, { color: brandGreen }]}>♻️ {d.compostType} (C:N {d.targetCnRatio})</Text>
              <View style={{ flexDirection: 'row', gap: 8, marginTop: 8 }}>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: '#8D6E63' }}>🟤 Browns</Text>
                  {d.brownsList.map((b, i) => <Text key={i} style={{ fontSize: 11, color: colors.text }}>• {b}</Text>)}
                </View>
                <View style={{ flex: 1 }}>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: successGreen }}>🟢 Greens</Text>
                  {d.greensList.map((g, i) => <Text key={i} style={{ fontSize: 11, color: colors.text }}>• {g}</Text>)}
                </View>
              </View>
              <Text style={{ fontSize: 10, color: colors.secondaryText, marginTop: 6 }}>💧 Moisture: {d.moistureTargetPercent} | 🔄 Turn every {d.turningFrequencyDays}d | ✅ Ready in {d.readyInWeeks} weeks</Text>
            </View>
          );
        }

        case 'aquaponics_setup': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: accentBlue }]}>
              <Text style={[s.cardTitle, { color: accentBlue }]}>🐟 Aquaponics — {d.fishSpecies}</Text>
              <Text style={{ fontSize: 11, color: colors.text, marginTop: 4 }}>Crops: {d.cropSpecies.join(', ')}</Text>
              <View style={{ gap: 4, marginTop: 6 }}>
                {[{ l: 'pH', v: d.phTarget.toString() }, { l: 'Temp', v: d.waterTempRangeC }, { l: 'Density', v: d.stockingDensityKgPerLiter }].map((r, i) => (
                  <View key={i} style={s.kvRow}>
                    <Text style={[s.kvLabel, { color: colors.secondaryText }]}>{r.l}</Text>
                    <Text style={[s.kvValue, { color: colors.text }]}>{r.v}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        }

        case 'apiculture_hive_card': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: isDarkMode ? '#2b2510' : '#FFF8E1', borderColor: accentOrange }]}>
              <Text style={[s.cardTitle, { color: accentOrange }]}>🐝 Hive Inspection</Text>
              <View style={{ gap: 4, marginTop: 6 }}>
                {[{ l: 'Queen', v: d.queenStatus }, { l: 'Brood', v: d.broodPattern }, { l: 'Honey', v: d.honeyStores }, { l: 'Temper', v: d.temperament }].map((r, i) => (
                  <View key={i} style={s.kvRow}>
                    <Text style={[s.kvLabel, { color: colors.secondaryText }]}>{r.l}</Text>
                    <Text style={[s.kvValue, { color: colors.text }]}>{r.v}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 11, color: colors.text, marginTop: 6 }}>Action: {d.actionTaken}</Text>
            </View>
          );
        }

        case 'mushroom_flushing_card': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>🍄 {d.mushroomVariety}</Text>
              <View style={{ gap: 4, marginTop: 6 }}>
                {[{ l: 'Substrate', v: d.substrateType }, { l: 'Incubation', v: d.incubationTempC }, { l: 'Fruiting', v: d.fruitingTempC }, { l: 'Humidity', v: d.relativeHumidityPercent }, { l: 'Flushes', v: d.expectedFlushes.toString() }].map((r, i) => (
                  <View key={i} style={s.kvRow}>
                    <Text style={[s.kvLabel, { color: colors.secondaryText }]}>{r.l}</Text>
                    <Text style={[s.kvValue, { color: colors.text }]}>{r.v}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        }

        case 'weed_identification': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: isDarkMode ? '#2b2510' : '#FFF8E1', borderColor: accentOrange }]}>
              <Text style={[s.cardTitle, { color: accentOrange }]}>🌿 Weed: {d.weedName} ({d.category})</Text>
              <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 4 }}>Reproduction: {d.reproductionMethod}</Text>
              <Text style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>Competes with: {d.competesWithCrops.join(', ')}</Text>
              {d.controlMethods.map((m, i) => <Text key={i} style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>✅ {m}</Text>)}
            </View>
          );
        }

        case 'pruning_guide': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>✂️ Pruning — {d.plantType}</Text>
              <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 4 }}>Season: {d.bestSeason} | Tool: {d.toolRequired} | Shape: {d.targetShape}</Text>
              {d.pruningSteps.map((step, i) => (
                <Text key={i} style={{ fontSize: 11, color: colors.text, marginTop: 4 }}>{i + 1}. {step}</Text>
              ))}
              <Text style={{ fontSize: 10, color: brandGreen, marginTop: 6 }}>🌿 After: {d.postPruningCare}</Text>
            </View>
          );
        }

        // ══════════════════════════════════════
        // 7. EQUIPMENT / BUSINESS BLOCKS
        // ══════════════════════════════════════

        case 'machine_specs': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>🚜 {d.machineName}{d.manufacturer ? ` — ${d.manufacturer}` : ''}</Text>
              <View style={{ gap: 4, marginTop: 6 }}>
                {[{ l: 'Power', v: `${d.horsepower} HP` }, { l: 'Fuel', v: `${d.fuelConsumptionLitersPerHour} L/hr` }, { l: 'Speed', v: d.idealOperationSpeedKmh }].map((r, i) => (
                  <View key={i} style={s.kvRow}>
                    <Text style={[s.kvLabel, { color: colors.secondaryText }]}>{r.l}</Text>
                    <Text style={[s.kvValue, { color: colors.text }]}>{r.v}</Text>
                  </View>
                ))}
              </View>
              {d.compatibleImplements.length > 0 ? (
                <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 4, marginTop: 6 }}>
                  {d.compatibleImplements.map((imp, i) => (
                    <View key={i} style={{ backgroundColor: accentBlue + '20', paddingHorizontal: 6, paddingVertical: 2, borderRadius: 4 }}>
                      <Text style={{ fontSize: 10, color: accentBlue }}>{imp}</Text>
                    </View>
                  ))}
                </View>
              ) : null}
            </View>
          );
        }

        case 'maintenance_checklist': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <Text style={[s.cardTitle, { color: colors.text }]}>🔧 Maintenance — {d.equipmentName}</Text>
              <Text style={{ fontSize: 10, color: colors.secondaryText }}>Interval: {d.intervalHoursOrMonths}</Text>
              {d.tasks.map((t, i) => (
                <View key={i} style={{ flexDirection: 'row', gap: 6, marginTop: 6, alignItems: 'center' }}>
                  <Text style={{ fontSize: 10, color: accentOrange, fontWeight: '700' }}>{t.action}</Text>
                  <Text style={{ fontSize: 11, color: colors.text }}>{t.component}{t.specification ? ` — ${t.specification}` : ''}</Text>
                </View>
              ))}
            </View>
          );
        }

        case 'market_price': {
          const d = block.data;
          const trendColor = d.priceTrend === 'Up' ? successGreen : d.priceTrend === 'Down' ? dangerRed : neutralGray;
          const trendIcon = d.priceTrend === 'Up' ? '📈' : d.priceTrend === 'Down' ? '📉' : '➡️';
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: trendColor }]}>
              <View style={{ flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' }}>
                <Text style={[s.cardTitle, { color: colors.text }]}>💹 {d.commodityName}</Text>
                <Text style={{ fontSize: 16 }}>{trendIcon}</Text>
              </View>
              <Text style={{ fontSize: 18, fontWeight: '800', color: trendColor, marginTop: 4 }}>{d.currency} {d.pricePerUnit}</Text>
              <Text style={{ fontSize: 10, color: colors.secondaryText }}>Market: {d.marketName} | Grade: {d.qualityGrade} | Updated: {d.dateUpdated}</Text>
            </View>
          );
        }

        case 'subsidy_info': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: isDarkMode ? '#1A2232' : '#E3F2FD', borderColor: accentBlue }]}>
              <Text style={[s.cardTitle, { color: accentBlue }]}>🏛 {d.schemeName}</Text>
              <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>By: {d.offeringAuthority}</Text>
              <View style={{ backgroundColor: accentBlue + '20', alignSelf: 'flex-start', paddingHorizontal: 10, paddingVertical: 4, borderRadius: 6, marginTop: 6 }}>
                <Text style={{ fontSize: 14, fontWeight: '800', color: accentBlue }}>{d.subsidyPercentage}% Subsidy</Text>
              </View>
              {d.maxSubsidyAmount ? <Text style={{ fontSize: 11, color: colors.text, marginTop: 4 }}>Max: {d.maxSubsidyAmount}</Text> : null}
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, marginTop: 8 }}>Eligibility:</Text>
              {d.eligibilityCriteria.map((c, i) => <Text key={i} style={{ fontSize: 11, color: colors.text, marginTop: 2 }}>✅ {c}</Text>)}
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, marginTop: 6 }}>Documents:</Text>
              {d.requiredDocuments.map((doc, i) => <Text key={i} style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>📄 {doc}</Text>)}
            </View>
          );
        }

        case 'business_plan_summary': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: brandGreen }]}>
              <Text style={[s.cardTitle, { color: brandGreen }]}>📊 {d.farmBusinessTitle}</Text>
              <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>Market: {d.targetMarket}</Text>
              <View style={{ flexDirection: 'row', justifyContent: 'space-around', marginTop: 8 }}>
                {[{ l: 'CapEx', v: d.estimatedCapEx }, { l: 'OpEx/yr', v: d.estimatedOpExAnnual }, { l: 'Breakeven', v: `${d.breakevenTimelineMonths}m` }].map((m, i) => (
                  <View key={i} style={{ alignItems: 'center', padding: 6, backgroundColor: brandGreen + '15', borderRadius: 6 }}>
                    <Text style={{ fontSize: 12, fontWeight: '800', color: brandGreen }}>{m.v}</Text>
                    <Text style={{ fontSize: 9, color: colors.secondaryText }}>{m.l}</Text>
                  </View>
                ))}
              </View>
              <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text, marginTop: 8 }}>Revenue Streams:</Text>
              {d.revenueStreams.map((r, i) => <Text key={i} style={{ fontSize: 11, color: colors.text }}>💰 {r}</Text>)}
              {d.keyRisks.length > 0 ? (
                <>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: dangerRed, marginTop: 6 }}>Risks:</Text>
                  {d.keyRisks.map((r, i) => <Text key={i} style={{ fontSize: 11, color: colors.text }}>⚠️ {r}</Text>)}
                </>
              ) : null}
            </View>
          );
        }

        case 'investment_table': {
          const d = block.data;
          return (
            <View key={idx} style={[s.tableCard, { backgroundColor: colors.card, borderColor: colors.border }]}>
              <View style={{ padding: 12, borderBottomWidth: 1, borderBottomColor: colors.border }}>
                <Text style={{ fontSize: 13, fontWeight: '700', color: colors.text }}>💼 Investment Breakdown ({d.currency})</Text>
              </View>
              <View style={{ padding: 8, backgroundColor: isDarkMode ? '#1A2232' : '#E3F2FD' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: accentBlue }}>CapEx (One-time)</Text>
              </View>
              {d.capexItems.map((item, i) => (
                <View key={i} style={[s.kvRow, { paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={{ fontSize: 11, color: colors.text }}>{item.item}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>{item.cost.toLocaleString()}</Text>
                </View>
              ))}
              <View style={{ padding: 8, backgroundColor: isDarkMode ? '#1A2E22' : '#E8F5E9' }}>
                <Text style={{ fontSize: 11, fontWeight: '700', color: brandGreen }}>OpEx (Annual)</Text>
              </View>
              {d.opexItems.map((item, i) => (
                <View key={i} style={[s.kvRow, { paddingHorizontal: 12, paddingVertical: 6, borderBottomWidth: 1, borderBottomColor: colors.border }]}>
                  <Text style={{ fontSize: 11, color: colors.text }}>{item.item}</Text>
                  <Text style={{ fontSize: 11, fontWeight: '700', color: colors.text }}>{item.annualCost.toLocaleString()}</Text>
                </View>
              ))}
              <View style={{ padding: 12, backgroundColor: isDarkMode ? '#2b2510' : '#FFF8E1' }}>
                <View style={s.kvRow}>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: accentOrange }}>Total Capital</Text>
                  <Text style={{ fontSize: 13, fontWeight: '800', color: accentOrange }}>{d.currency} {d.totalInitialCapitalRequired.toLocaleString()}</Text>
                </View>
              </View>
            </View>
          );
        }

        case 'loan_calculator': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: colors.card, borderColor: accentBlue }]}>
              <Text style={[s.cardTitle, { color: accentBlue }]}>🏦 {d.loanSchemeName}</Text>
              <View style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, marginTop: 8 }}>
                {[
                  { l: 'Principal', v: d.principalAmount.toLocaleString() },
                  { l: 'Interest', v: `${d.annualInterestRatePercent}%` },
                  { l: 'Tenure', v: `${d.tenureYears}yr` },
                  { l: 'EMI', v: d.estimatedMonthlyEmi.toLocaleString() },
                ].map((m, i) => (
                  <View key={i} style={{ alignItems: 'center', padding: 8, backgroundColor: accentBlue + '15', borderRadius: 8, minWidth: 70 }}>
                    <Text style={{ fontSize: 13, fontWeight: '800', color: accentBlue }}>{m.v}</Text>
                    <Text style={{ fontSize: 9, color: colors.secondaryText }}>{m.l}</Text>
                  </View>
                ))}
              </View>
            </View>
          );
        }

        // ══════════════════════════════════════
        // 8. ALERT / VISUAL BLOCKS
        // ══════════════════════════════════════

        case 'warning_box': {
          const d = block.data;
          const ac = getAlertColors(d.hazardLevel, isDarkMode);
          return (
            <View key={idx} style={[s.card, { backgroundColor: ac.bg, borderColor: ac.border }]}>
              <View style={{ flexDirection: 'row', alignItems: 'center', gap: 6 }}>
                <Ionicons name="warning-outline" size={18} color={ac.icon} />
                <Text style={{ fontSize: 13, fontWeight: '800', color: ac.icon }}>⚠️ {d.title}</Text>
              </View>
              <Text style={[s.body, { color: colors.text, marginTop: 4 }]}>{d.message}</Text>
              {d.safetyGearRequired?.map((g, i) => <Text key={i} style={{ fontSize: 10, color: ac.icon, marginTop: 2 }}>🧤 {g}</Text>)}
            </View>
          );
        }

        case 'tip_box': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: isDarkMode ? '#1A2E22' : '#E8F5E9', borderColor: brandGreen }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: brandGreen }}>💡 {d.title || 'Pro Tip'}</Text>
              <Text style={[s.body, { color: colors.text, marginTop: 4 }]}>{d.tip}</Text>
            </View>
          );
        }

        case 'success_box': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: isDarkMode ? '#1A2E22' : '#E8F5E9', borderColor: successGreen }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: successGreen }}>🏆 {d.title}</Text>
              <Text style={[s.body, { color: colors.text, marginTop: 4 }]}>{d.achievement}</Text>
              {d.metric ? <Text style={{ fontSize: 14, fontWeight: '800', color: successGreen, marginTop: 4 }}>{d.metric}</Text> : null}
            </View>
          );
        }

        case 'info_box': {
          const d = block.data;
          return (
            <View key={idx} style={[s.card, { backgroundColor: isDarkMode ? '#1A2232' : '#E3F2FD', borderColor: infoBlue }]}>
              <Text style={{ fontSize: 12, fontWeight: '700', color: infoBlue }}>ℹ️ {d.title || 'Note'}</Text>
              <Text style={[s.body, { color: colors.text, marginTop: 4 }]}>{d.content}</Text>
            </View>
          );
        }

        case 'metric_row': {
          const d = block.data;
          return (
            <View key={idx} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 8, justifyContent: 'space-around' }}>
              {d.metrics.map((m, i) => (
                <View key={i} style={{ alignItems: 'center', padding: 10, backgroundColor: colors.card, borderRadius: 10, borderWidth: 1, borderColor: colors.border, minWidth: 80 }}>
                  <Text style={{ fontSize: 16, fontWeight: '800', color: m.isPositiveChange === false ? dangerRed : brandGreen }}>{m.value}{m.unit ? ` ${m.unit}` : ''}</Text>
                  <Text style={{ fontSize: 9, color: colors.secondaryText, textAlign: 'center' }}>{m.label}</Text>
                  {m.changePercentage != null ? <Text style={{ fontSize: 9, color: m.isPositiveChange === false ? dangerRed : successGreen }}>{m.isPositiveChange === false ? '↓' : '↑'}{m.changePercentage}%</Text> : null}
                </View>
              ))}
            </View>
          );
        }

        case 'stat_highlight': {
          const d = block.data;
          return (
            <View key={idx} style={{ alignItems: 'center', padding: 16, backgroundColor: colors.card, borderRadius: 12, borderWidth: 1, borderColor: d.accentColor || brandGreen }}>
              <Text style={{ fontSize: 28, fontWeight: '800', color: d.accentColor || brandGreen }}>{d.bigStat}</Text>
              <Text style={{ fontSize: 13, fontWeight: '600', color: colors.text }}>{d.statLabel}</Text>
              {d.subtext ? <Text style={{ fontSize: 11, color: colors.secondaryText, marginTop: 2 }}>{d.subtext}</Text> : null}
            </View>
          );
        }

        case 'badge_row': {
          const d = block.data;
          return (
            <View key={idx} style={{ flexDirection: 'row', flexWrap: 'wrap', gap: 6 }}>
              {d.badges.map((b, i) => {
                const bc = getBadgeColors(b.variant, isDarkMode);
                return (
                  <View key={i} style={{ backgroundColor: bc.bg, paddingHorizontal: 10, paddingVertical: 4, borderRadius: 12 }}>
                    <Text style={{ fontSize: 11, fontWeight: '700', color: bc.text }}>{b.label}</Text>
                  </View>
                );
              })}
            </View>
          );
        }

        case 'separator': {
          const d = block.data;
          return (
            <View key={idx} style={{ alignItems: 'center', marginVertical: 4 }}>
              {d.label ? <Text style={{ fontSize: 10, color: colors.secondaryText, marginBottom: 4 }}>{d.label}</Text> : null}
              <View style={{ width: '100%', height: 1, backgroundColor: colors.border, borderStyle: d.style === 'dashed' ? 'dashed' : d.style === 'dotted' ? 'dotted' : 'solid' }} />
            </View>
          );
        }

        default:
          // Unknown block type — skip gracefully (forward compatible)
          return null;
      }
    } catch {
      // If any block crashes, skip it gracefully — never crash the app
      return null;
    }
  };

  return (
    <View style={s.container}>
      {blocks.map((block, idx) => renderBlock(block, idx))}
    </View>
  );
};

const s = StyleSheet.create({
  container: {
    paddingHorizontal: 18,
    marginTop: 14,
    gap: 12,
  },
  card: {
    borderRadius: 12,
    borderWidth: 1,
    padding: 14,
  },
  tableCard: {
    borderRadius: 12,
    borderWidth: 1,
    overflow: 'hidden',
  },
  cardTitle: {
    fontSize: 14,
    fontWeight: '800',
  },
  sectionTitle: {
    fontSize: 15,
    fontWeight: '800',
    marginBottom: 4,
  },
  body: {
    fontSize: 12.5,
    lineHeight: 19,
  },
  kvRow: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  kvLabel: {
    fontSize: 12,
    fontWeight: '600',
  },
  kvValue: {
    fontSize: 12,
    fontWeight: '700',
    flex: 1,
    textAlign: 'right',
  },
});

export default DynamicAIVideoCard;
