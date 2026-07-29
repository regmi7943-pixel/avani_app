import React, { useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Modal,
  TouchableOpacity,
  ScrollView,
  TextInput,
  ActivityIndicator,
  Platform,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { LinearGradient } from 'expo-linear-gradient';
import { inspectLiveAIPipeline, AIPipelineInspectorStep } from '../lib/grokSubtitleParser';

let WebView: any = View;
if (Platform.OS !== 'web') {
  try {
    WebView = require('react-native-webview').WebView;
  } catch (e) {}
}

interface LiveAIPipelineInspectorModalProps {
  visible: boolean;
  onClose: () => void;
}

const SAMPLE_VIDEOS = [
  {
    id: 'rUrb1zxJP3o',
    title: '🌾 Rice Paddy Cultivation (SRI Method)',
    url: 'https://www.youtube.com/watch?v=rUrb1zxJP3o',
  },
  {
    id: 'L2zFX4uWFic',
    title: '🍅 Tomato Leaf Blight & Pest Control',
    url: 'https://www.youtube.com/watch?v=L2zFX4uWFic',
  },
  {
    id: 'Np6gmsulo9E',
    title: '🌽 Maize Top-Dressing & Fertilizer Timing',
    url: 'https://www.youtube.com/watch?v=Np6gmsulo9E',
  },
];

export const LiveAIPipelineInspectorModal: React.FC<LiveAIPipelineInspectorModalProps> = ({
  visible,
  onClose,
}) => {
  const [selectedUrl, setSelectedUrl] = useState(SAMPLE_VIDEOS[0].url);
  const [customUrl, setCustomUrl] = useState('');
  const [isTesting, setIsTesting] = useState(false);
  const [currentStep, setCurrentStep] = useState<AIPipelineInspectorStep | null>(null);


  const activeUrl = customUrl.trim() || selectedUrl;

  const extractId = (urlStr: string) => {
    const match = urlStr.match(/(?:v=|\/embed\/|\/watch\?v=|\/v\/|youtu\.be\/|\/shorts\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : 'rUrb1zxJP3o';
  };

  const handleRunTest = async () => {
    if (!activeUrl) return;
    setIsTesting(true);
    setCurrentStep(null);

    try {
      await inspectLiveAIPipeline(activeUrl, (stepData) => {
        setCurrentStep(stepData);
      });
    } catch (e) {
      console.warn("Inspector test error:", e);
    } finally {
      setIsTesting(false);
    }
  };

  const currentStepName = currentStep?.step || 'idle';

  return (
    <Modal visible={visible} animationType="slide" transparent onRequestClose={onClose}>
      <View style={styles.overlay}>
        <View style={styles.container}>
          {/* Header */}
          <LinearGradient colors={['#0F172A', '#1E293B']} style={styles.header}>
            <View style={styles.headerTitleRow}>
              <View style={styles.pillBadge}>
                <Text style={styles.pillBadgeText}>🧪 LIVE AI PIPELINE INSPECTOR</Text>
              </View>
              <TouchableOpacity onPress={onClose} style={styles.closeBtn}>
                <Ionicons name="close-circle" size={26} color="#94A3B8" />
              </TouchableOpacity>
            </View>
            <Text style={styles.headerSubtitle}>
              Test live audio stream extraction, Groq Whisper speech-to-text, & Groq Llama 8B AI generation in real time.
            </Text>
          </LinearGradient>

          <ScrollView style={styles.scrollContent} contentContainerStyle={styles.scrollInner}>
            {/* Sample Video Selector */}
            <Text style={styles.sectionLabel}>1. SELECT SAMPLE TEST VIDEO</Text>
            <View style={styles.sampleList}>
              {SAMPLE_VIDEOS.map((item) => {
                const isSelected = selectedUrl === item.url && !customUrl;
                return (
                  <TouchableOpacity
                    key={item.id}
                    style={[styles.sampleCard, isSelected && styles.sampleCardSelected]}
                    onPress={() => {
                      setSelectedUrl(item.url);
                      setCustomUrl('');
                    }}
                  >
                    <Ionicons
                      name={isSelected ? 'radio-button-on' : 'radio-button-off'}
                      size={18}
                      color={isSelected ? '#10B981' : '#64748B'}
                    />
                    <Text style={[styles.sampleTitle, isSelected && styles.sampleTitleSelected]}>
                      {item.title}
                    </Text>
                  </TouchableOpacity>
                );
              })}
            </View>

            {/* Custom URL Input */}
            <View style={styles.inputBox}>
              <Ionicons name="link" size={18} color="#64748B" style={styles.inputIcon} />
              <TextInput
                style={styles.textInput}
                placeholder="Or paste any YouTube video URL..."
                placeholderTextColor="#64748B"
                value={customUrl}
                onChangeText={setCustomUrl}
                autoCapitalize="none"
              />
              {customUrl ? (
                <TouchableOpacity onPress={() => setCustomUrl('')}>
                  <Ionicons name="close-circle" size={18} color="#64748B" />
                </TouchableOpacity>
              ) : null}
            </View>

            {/* Real YouTube Video Player Preview */}
            <Text style={styles.sectionLabel}>2. REAL VIDEO PREVIEW & LIVE AUDIO</Text>
            <View style={styles.videoPlayerBox}>
              {Platform.OS === 'web' ? (
                <iframe
                  width="100%"
                  height="210"
                  src={`https://www.youtube.com/embed/${extractId(activeUrl)}?playsinline=1&controls=1&rel=0`}
                  style={{ border: 'none', borderRadius: 12 }}
                  allow="accelerometer; autoplay; clipboard-write; encrypted-media; gyroscope; picture-in-picture"
                  allowFullScreen
                />
              ) : (
                <WebView
                  originWhitelist={['*']}
                  source={{
                    uri: `https://www.youtube.com/embed/${extractId(activeUrl)}?playsinline=1&controls=1&rel=0&enablejsapi=1`,
                    headers: {
                      'Referer': 'https://www.youtube.com/',
                      'User-Agent': 'Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36',
                    },
                  }}
                  userAgent="Mozilla/5.0 (Linux; Android 11; Pixel 5) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/122.0.0.0 Mobile Safari/537.36"
                  style={{ height: 210, width: '100%', borderRadius: 12 }}
                  allowsInlineMediaPlayback
                  mediaPlaybackRequiresUserAction={false}
                  javaScriptEnabled
                  domStorageEnabled
                  scrollEnabled={false}
                />
              )}
            </View>

            {/* Run Test Button */}
            <TouchableOpacity
              style={[styles.runBtn, isTesting && styles.runBtnDisabled]}
              onPress={handleRunTest}
              disabled={isTesting}
            >
              <LinearGradient colors={['#10B981', '#059669']} style={styles.runBtnGradient}>
                {isTesting ? (
                  <ActivityIndicator color="#FFF" size="small" style={{ marginRight: 8 }} />
                ) : (
                  <Ionicons name="play" size={18} color="#FFF" style={{ marginRight: 8 }} />
                )}
                <Text style={styles.runBtnText}>
                  {isTesting ? 'INSPECTING AI PIPELINE...' : 'START LIVE PIPELINE TEST'}
                </Text>
              </LinearGradient>
            </TouchableOpacity>

            {/* Pipeline Stage Indicators */}
            {currentStep && (
              <View style={styles.pipelineContainer}>
                <Text style={styles.sectionLabel}>3. REAL-TIME PIPELINE FLOW</Text>

                {/* STAGE 1: AUDIO EXTRACTION */}
                <View style={[styles.stageBox, currentStepName === 'extracting_audio' && styles.stageBoxActive]}>
                  <View style={styles.stageHeader}>
                    <Ionicons
                      name="musical-notes"
                      size={20}
                      color={currentStepName === 'idle' ? '#64748B' : '#38BDF8'}
                    />
                    <Text style={styles.stageTitle}>Stage 1: Audio Stream Extractor</Text>
                    {currentStepName === 'extracting_audio' && <ActivityIndicator size="small" color="#38BDF8" />}
                    {currentStepName !== 'extracting_audio' && currentStepName !== 'idle' && (
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    )}
                  </View>
                  <Text style={styles.stageDesc}>
                    Extracts high-fidelity audio stream (64kbps MP3 format) directly from YouTube video.
                  </Text>

                  {/* Audio Extraction Status */}
                  {currentStepName !== 'extracting_audio' && currentStepName !== 'idle' && (
                    <View style={styles.audioStatusContainer}>
                      <Ionicons name="checkmark-circle" size={16} color="#10B981" />
                      <Text style={styles.audioStatusText}>
                        {currentStep?.audioUrl && !currentStep.audioUrl.includes('download-audio-file')
                          ? '⚡ Client-Side Direct Audio Stream Extracted (Residential IP)'
                          : '✅ Audio & Transcript Stream Analyzed (YouTube API + Groq Whisper)'}
                      </Text>
                    </View>
                  )}
                </View>

                {/* STAGE 2: GROQ WHISPER STT */}
                <View
                  style={[
                    styles.stageBox,
                    (currentStepName === 'transcribing_whisper' || currentStepName === 'generating_llama' || currentStepName === 'completed') &&
                      styles.stageBoxActive,
                  ]}
                >
                  <View style={styles.stageHeader}>
                    <Ionicons name="mic" size={20} color="#A855F7" />
                    <Text style={styles.stageTitle}>Stage 2: Groq Whisper Speech-to-Text</Text>
                    {currentStepName === 'transcribing_whisper' && <ActivityIndicator size="small" color="#A855F7" />}
                    {(currentStepName === 'generating_llama' || currentStepName === 'completed') && (
                      <Ionicons name="checkmark-circle" size={20} color="#10B981" />
                    )}
                  </View>
                  <Text style={styles.stageDesc}>
                    Converts spoken agricultural speech into clean textual transcript using Groq Whisper-v3.
                  </Text>

                  {currentStep.transcript ? (
                    <View style={styles.transcriptBox}>
                      <Text style={styles.transcriptText}>{currentStep.transcript}</Text>
                    </View>
                  ) : null}
                </View>

                {/* STAGE 3: GROQ LLAMA 8B INSTANT */}
                <View style={[styles.stageBox, currentStepName === 'completed' && styles.stageBoxActive]}>
                  <View style={styles.stageHeader}>
                    <Ionicons name="hardware-chip" size={20} color="#F59E0B" />
                    <Text style={styles.stageTitle}>Stage 3: Groq Llama-3.1-8b-instant Engine</Text>
                    {currentStepName === 'generating_llama' && <ActivityIndicator size="small" color="#F59E0B" />}
                    {currentStepName === 'completed' && <Ionicons name="checkmark-circle" size={20} color="#10B981" />}
                  </View>

                  {currentStep.elapsedMs ? (
                    <Text style={styles.benchmarkText}>
                      ⚡ End-to-End Latency: {(currentStep.elapsedMs / 1000).toFixed(2)} seconds
                    </Text>
                  ) : null}

                  {currentStep.analysis ? (
                    <View style={styles.analysisResultBox}>
                      <Text style={styles.resultTitle}>📋 English Summary</Text>
                      <Text style={styles.resultBody}>{currentStep.analysis.summaryEn}</Text>

                      <Text style={[styles.resultTitle, { marginTop: 12 }]}>🇳🇵 Nepali Summary</Text>
                      <Text style={styles.resultBody}>{currentStep.analysis.summaryNe}</Text>

                      <Text style={[styles.resultTitle, { marginTop: 12 }]}>🛠️ 4-Step Practical Field Plan</Text>
                      {currentStep.analysis.stepsEn?.map((stepStr, idx) => (
                        <Text key={idx} style={styles.stepBullet}>
                          • {stepStr}
                        </Text>
                      ))}

                      {currentStep.analysis.dosageTable ? (
                        <View style={styles.dosageContainer}>
                          <Text style={styles.resultTitle}>💊 Fertilizer & Spray Dosage Table</Text>
                          <Text style={styles.dosageText}>
                            <Text style={{ fontWeight: 'bold' }}>Basal:</Text> {currentStep.analysis.dosageTable.basalEn}
                          </Text>
                          <Text style={styles.dosageText}>
                            <Text style={{ fontWeight: 'bold' }}>Top-Dress:</Text>{' '}
                            {currentStep.analysis.dosageTable.topDressEn}
                          </Text>
                          <Text style={styles.dosageText}>
                            <Text style={{ fontWeight: 'bold' }}>Spray:</Text> {currentStep.analysis.dosageTable.sprayEn}
                          </Text>
                        </View>
                      ) : null}
                    </View>
                  ) : null}
                </View>
              </View>
            )}
          </ScrollView>
        </View>
      </View>
    </Modal>
  );
};

const styles = StyleSheet.create({
  overlay: {
    flex: 1,
    backgroundColor: 'rgba(15, 23, 42, 0.85)',
    justifyContent: 'flex-end',
  },
  container: {
    height: '92%',
    backgroundColor: '#090D16',
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    overflow: 'hidden',
  },
  header: {
    paddingHorizontal: 20,
    paddingTop: 16,
    paddingBottom: 16,
    borderBottomWidth: 1,
    borderBottomColor: '#1E293B',
  },
  headerTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  pillBadge: {
    backgroundColor: 'rgba(16, 185, 129, 0.15)',
    paddingHorizontal: 12,
    paddingVertical: 6,
    borderRadius: 20,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.4)',
  },
  pillBadgeText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  closeBtn: {
    padding: 4,
  },
  headerSubtitle: {
    color: '#94A3B8',
    fontSize: 13,
    marginTop: 8,
    lineHeight: 18,
  },
  scrollContent: {
    flex: 1,
  },
  scrollInner: {
    padding: 20,
    paddingBottom: 40,
  },
  sectionLabel: {
    color: '#64748B',
    fontSize: 11,
    fontWeight: '800',
    letterSpacing: 1,
    marginBottom: 10,
  },
  sampleList: {
    gap: 8,
    marginBottom: 16,
  },
  sampleCard: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    paddingHorizontal: 14,
    paddingVertical: 12,
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#334155',
    gap: 10,
  },
  sampleCardSelected: {
    backgroundColor: 'rgba(16, 185, 129, 0.12)',
    borderColor: '#10B981',
  },
  sampleTitle: {
    color: '#94A3B8',
    fontSize: 13,
    fontWeight: '600',
    flex: 1,
  },
  sampleTitleSelected: {
    color: '#F8FAFC',
  },
  inputBox: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#1E293B',
    borderRadius: 12,
    paddingHorizontal: 12,
    height: 46,
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
  inputIcon: {
    marginRight: 8,
  },
  textInput: {
    flex: 1,
    color: '#F8FAFC',
    fontSize: 13,
  },
  runBtn: {
    borderRadius: 14,
    overflow: 'hidden',
    marginBottom: 24,
  },
  runBtnDisabled: {
    opacity: 0.6,
  },
  runBtnGradient: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    height: 50,
  },
  runBtnText: {
    color: '#FFF',
    fontSize: 14,
    fontWeight: '700',
    letterSpacing: 0.5,
  },
  pipelineContainer: {
    marginTop: 8,
  },
  stageBox: {
    backgroundColor: '#0F172A',
    borderRadius: 16,
    padding: 16,
    borderWidth: 1,
    borderColor: '#1E293B',
    marginBottom: 14,
  },
  stageBoxActive: {
    borderColor: '#38BDF8',
    backgroundColor: '#0F172A',
  },
  stageHeader: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
    marginBottom: 6,
  },
  stageTitle: {
    color: '#F8FAFC',
    fontSize: 14,
    fontWeight: '700',
    flex: 1,
  },
  stageDesc: {
    color: '#64748B',
    fontSize: 12,
    lineHeight: 16,
  },
  audioStatusContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: 'rgba(16, 185, 129, 0.1)',
    paddingHorizontal: 12,
    paddingVertical: 10,
    borderRadius: 10,
    marginTop: 12,
    gap: 8,
    borderWidth: 1,
    borderColor: 'rgba(16, 185, 129, 0.3)',
  },
  audioStatusText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '600',
    flex: 1,
  },
  transcriptBox: {
    backgroundColor: '#1E293B',
    borderRadius: 10,
    padding: 12,
    marginTop: 10,
  },
  transcriptText: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
    fontStyle: 'italic',
  },
  benchmarkText: {
    color: '#34D399',
    fontSize: 12,
    fontWeight: '700',
    marginTop: 8,
  },
  analysisResultBox: {
    marginTop: 12,
    backgroundColor: '#1E293B',
    borderRadius: 12,
    padding: 14,
  },
  resultTitle: {
    color: '#F8FAFC',
    fontSize: 13,
    fontWeight: '700',
    marginBottom: 4,
  },
  resultBody: {
    color: '#94A3B8',
    fontSize: 12,
    lineHeight: 18,
  },
  stepBullet: {
    color: '#CBD5E1',
    fontSize: 12,
    lineHeight: 18,
    marginTop: 2,
  },
  dosageContainer: {
    marginTop: 12,
    backgroundColor: '#0F172A',
    padding: 10,
    borderRadius: 8,
    gap: 4,
  },
  dosageText: {
    color: '#94A3B8',
    fontSize: 11,
  },
  videoPlayerBox: {
    height: 215,
    backgroundColor: '#0F172A',
    borderRadius: 14,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#334155',
    marginBottom: 16,
  },
});
