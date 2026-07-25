import React, { useState, useEffect, useRef } from 'react';
import {
  View,
  Text,
  StyleSheet,
  TouchableOpacity,
  Image,
  TextInput,
  Platform,
  Keyboard,
  KeyboardAvoidingView,
  TouchableWithoutFeedback,
  Modal,
  Animated,
  ActivityIndicator,
  ScrollView,
  Dimensions,
  Easing,
  Alert,
  FlatList,
} from 'react-native';
import AsyncStorage from '@react-native-async-storage/async-storage';
import { SafeAreaView } from 'react-native-safe-area-context';
import { Ionicons } from '@expo/vector-icons';
import { useLanguage } from '../../lib/LanguageContext';
import { useTheme } from '../../lib/ThemeContext';
import { askAIAssistant, transcribeAudioWithGroq, streamAIAssistant, ChatMessage } from '../../services/aiService';
import * as Speech from 'expo-speech';
import Markdown from '@ronradtke/react-native-markdown-display';

interface PlaybackItem {
  text: string;
  fileUri?: string;
  status: 'pending_fetch' | 'fetching' | 'ready' | 'playing' | 'played';
  sound?: Audio.Sound;
}
import { LinearGradient } from 'expo-linear-gradient';
import { Audio } from 'expo-av';
import * as FileSystem from 'expo-file-system/src/legacy';

const COLORS = {
  forest900: '#1b382b',
  forest700: '#2d5a27',
  forest500: '#468340',
  forest300: '#7cb376',
  white: '#ffffff',
  paper: '#f4f2ec',
  line: '#e6e3d8',
  ink: '#2d2b27',
  inkSoft: '#636059',
  inkFaint: '#a8a59c',
  clay: '#c85e43',
};

const markdownStyles = {
  body: {
    color: COLORS.ink,
    fontSize: 14.5,
    lineHeight: 20,
  },
  heading1: {
    fontSize: 18,
    fontWeight: '800' as const,
    color: COLORS.forest900,
    marginTop: 8,
    marginBottom: 4,
  },
  heading2: {
    fontSize: 16,
    fontWeight: '800' as const,
    color: COLORS.forest900,
    marginTop: 8,
    marginBottom: 4,
  },
  heading3: {
    fontSize: 15,
    fontWeight: '800' as const,
    color: COLORS.forest900,
    marginTop: 6,
    marginBottom: 4,
  },
  paragraph: {
    marginTop: 2,
    marginBottom: 4,
  },
  bullet_list: {
    marginTop: 4,
    marginBottom: 4,
  },
  list_item: {
    fontSize: 14.5,
    lineHeight: 20,
    color: COLORS.ink,
    marginVertical: 1.5,
  },
  strong: {
    fontWeight: '800' as const,
    color: COLORS.forest900,
  },
  em: {
    fontStyle: 'italic' as const,
  },
  blockquote: {
    backgroundColor: 'rgba(239, 68, 68, 0.08)',
    borderLeftColor: '#EF4444',
    borderLeftWidth: 4,
    paddingHorizontal: 12,
    paddingVertical: 8,
    marginVertical: 6,
    borderRadius: 8,
    width: '100%' as const,
    flexDirection: 'row' as const,
    flexWrap: 'wrap' as const,
  },
};

export default function AIAssistantScreen() {
  const { language } = useLanguage();
  const { colors } = useTheme();
  const [keyboardVisible, setKeyboardVisible] = useState(false);

  // Voice Call Modal States
  const [voiceCallVisible, setVoiceCallVisible] = useState(false);
  const [callStatus, setCallStatus] = useState<'connecting' | 'listening' | 'speaking' | 'idle'>('idle');
  const [userQuery, setUserQuery] = useState('');
  const [aiResponse, setAiResponse] = useState('');
  const [isMuted, setIsMuted] = useState(false);
  const [isSpeakerOn, setIsSpeakerOn] = useState(true);

  // Recording states
  const [recording, setRecording] = useState<Audio.Recording | null>(null);
  const [isRecording, setIsRecording] = useState(false);
  const [hasMicPermission, setHasMicPermission] = useState<boolean | null>(null);

  // Text Chat States
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [inputText, setInputText] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const scrollViewRef = useRef<ScrollView | null>(null);

  // Streaming audio playback queue references
  const abortStreamRef = useRef<(() => void) | null>(null);
  const playbackQueueRef = useRef<PlaybackItem[]>([]);
  const isPlayingRef = useRef<boolean>(false);
  const streamFinishedRef = useRef<boolean>(false);
  
  // Safe hardware states to avoid closures and parallel conflicts
  const recordingRef = useRef<Audio.Recording | null>(null);
  const isStartingRecordingRef = useRef<boolean>(false);

  // Word highlighting states for interactive captions (Wheat-Gold highlight on White Card)
  const [activeWords, setActiveWords] = useState<string[]>([]);
  const [activeWordIndex, setActiveWordIndex] = useState<number>(-1);
  const [contentHeight, setContentHeight] = useState<number>(0);
  const [isIntroPlaying, setIsIntroPlaying] = useState<boolean>(false);
  const wordIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const subtitleScrollRef = useRef<ScrollView | null>(null);

  // Chat History states
  const [historyModalVisible, setHistoryModalVisible] = useState<boolean>(false);
  const [savedSessions, setSavedSessions] = useState<{ id: string; title: string; messages: ChatMessage[]; timestamp: string; }[]>([]);

  // Animations
  const pulseAnim = useRef(new Animated.Value(1)).current;
  const waveAnims = useRef([
    new Animated.Value(10),
    new Animated.Value(25),
    new Animated.Value(15),
    new Animated.Value(30),
    new Animated.Value(20),
  ]).current;
  // Intelligent line-by-line scrolling: scrolls only when active word shifts to a new line that overflows the view
  useEffect(() => {
    if (activeWordIndex !== -1 && activeWords.length > 0) {
      const wordsPerLine = language === 'ne' ? 4 : 5.5; // Average words per line layout
      const lineIndex = Math.floor(activeWordIndex / wordsPerLine);
      const lineHeight = 24; // Mapped exactly to style's lineHeight: 24
      
      // If we are on line 3 or below (index 2+), scroll down to bring the line into view
      const targetScrollY = lineIndex >= 2 ? (lineIndex - 1) * lineHeight : 0;
      
      subtitleScrollRef.current?.scrollTo({
        y: targetScrollY,
        animated: true,
      });
    } else if (activeWordIndex === -1) {
      subtitleScrollRef.current?.scrollTo({
        y: 0,
        animated: true,
      });
    }
  }, [activeWordIndex, activeWords, language]);
  // Request mic permission on mount
  useEffect(() => {
    const initVoiceAssets = async () => {
      try {
        const { status } = await Audio.requestPermissionsAsync();
        setHasMicPermission(status === 'granted');
      } catch (err) {
        console.warn('Failed to get mic permissions:', err);
      }
    };

    initVoiceAssets();

    const showListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillShow' : 'keyboardDidShow',
      () => {
        setKeyboardVisible(true);
        setTimeout(() => {
          scrollViewRef.current?.scrollToEnd({ animated: true });
        }, 120);
      }
    );
    const hideListener = Keyboard.addListener(
      Platform.OS === 'ios' ? 'keyboardWillHide' : 'keyboardDidHide',
      () => setKeyboardVisible(false)
    );
    return () => {
      showListener.remove();
      hideListener.remove();
    };
  }, []);

  // Control Call Animations & Audio Playback
  useEffect(() => {
    if (voiceCallVisible) {
      // Pulse animation
      Animated.loop(
        Animated.sequence([
          Animated.timing(pulseAnim, {
            toValue: 1.12,
            duration: 1200,
            useNativeDriver: true,
          }),
          Animated.timing(pulseAnim, {
            toValue: 1.0,
            duration: 1200,
            useNativeDriver: true,
          })
        ])
      ).start();

      // Audio wave loops
      const animations = waveAnims.map((anim) => {
        return Animated.loop(
          Animated.sequence([
            Animated.timing(anim, {
              toValue: 8 + Math.random() * 26,
              duration: 350 + Math.random() * 250,
              useNativeDriver: false,
            }),
            Animated.timing(anim, {
              toValue: 4,
              duration: 350 + Math.random() * 250,
              useNativeDriver: false,
            })
          ])
        );
      });
      Animated.parallel(animations).start();

      // Start Call Flow
      startCallFlow();
    } else {
      stopAllAudio();
      cleanupRecording();
      pulseAnim.setValue(1);
      waveAnims.forEach(anim => anim.setValue(10));
    }
  }, [voiceCallVisible]);

  const soundRef = useRef<Audio.Sound | null>(null);

  const stopAllAudio = async () => {
    // 1. Abort any active Groq stream
    if (abortStreamRef.current) {
      try {
        abortStreamRef.current();
      } catch (e) {}
      abortStreamRef.current = null;
    }

    // 2. Unload all queued sound objects and delete temp files
    for (const item of playbackQueueRef.current) {
      if (item.sound) {
        try {
          await item.sound.unloadAsync();
        } catch (e) {}
      }
      if (item.fileUri) {
        try {
          await FileSystem.deleteAsync(item.fileUri, { idempotent: true });
        } catch (e) {}
      }
    }
    playbackQueueRef.current = [];
    isPlayingRef.current = false;
    streamFinishedRef.current = false;
    activeFetchCountRef.current = 0;
    stopSilenceDetection(); // Clean up silence timer

    // 3. Stop native Speech
    try {
      await Speech.stop();
    } catch (e) {}

    // 4. Unload direct sound ref
    if (soundRef.current) {
      try {
        await soundRef.current.stopAsync();
        await soundRef.current.unloadAsync();
      } catch (e) {}
      soundRef.current = null;
    }
  };
  // Strategy 3: Pre-warm Deepgram TLS/TCP connection to eliminate first-call handshake latency
  const deepgramWarmedRef = useRef<boolean>(false);
  const prewarmDeepgram = () => {
    if (deepgramWarmedRef.current || language === 'ne') return;
    deepgramWarmedRef.current = true;
    // Fire a tiny throwaway request to establish the connection pool
    fetch('https://api.deepgram.com/v1/speak?model=aura-2-thalia-en', {
      method: 'POST',
      headers: {
        'Authorization': 'Token 97e1f77806a1a0c01e76ec1619b743da8303311d',
        'Content-Type': 'text/plain',
      },
      body: ' ', // Minimal payload — just a space character
    }).catch(() => {}); // Silently discard the response
  };

  // Strategy 2: Parallel prefetch — synthesizes up to 2 sentences concurrently
  const activeFetchCountRef = useRef<number>(0);
  const MAX_CONCURRENT_FETCHES = 2;

  const processSynthesizer = async () => {
    // Find all pending items and launch up to MAX_CONCURRENT_FETCHES in parallel
    while (activeFetchCountRef.current < MAX_CONCURRENT_FETCHES) {
      const pendingItem = playbackQueueRef.current.find(item => item.status === 'pending_fetch');
      if (!pendingItem) break;

      activeFetchCountRef.current++;
      pendingItem.status = 'fetching';

      // Launch fetch without awaiting — runs in parallel
      (async (item) => {
        try {
          if (language === 'ne') {
            item.status = 'ready';
          } else {
            const fileUri = `${FileSystem.cacheDirectory}speech_${Date.now()}_${Math.random().toString(36).substring(7)}.mp3`;
            const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&speed=0.93', {
              method: 'POST',
              headers: {
                'Authorization': 'Token 97e1f77806a1a0c01e76ec1619b743da8303311d',
                'Content-Type': 'text/plain',
              },
              body: item.text,
            });

            if (!response.ok) {
              throw new Error(`Deepgram status ${response.status}`);
            }

            const arrayBuffer = await response.arrayBuffer();
            const base64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer));
            await FileSystem.writeAsStringAsync(fileUri, base64, {
              encoding: FileSystem.EncodingType.Base64,
            });

            try {
              await Audio.setAudioModeAsync({
                allowsRecordingIOS: false,
                playsInSilentModeIOS: true,
              });
            } catch (e) {}

            const { sound } = await Audio.Sound.createAsync(
              { uri: fileUri },
              { 
                shouldPlay: false,
                rate: 1.0,
                shouldCorrectPitch: true,
              }
            );

            item.fileUri = fileUri;
            item.sound = sound;
            item.status = 'ready';
          }
        } catch (err) {
          console.warn('Failed to pre-synthesize sentence:', item.text, err);
          item.status = 'ready'; // fallback
        } finally {
          activeFetchCountRef.current--;
          processSynthesizer(); // pick up next pending item
          processPlayer();
        }
      })(pendingItem);
    }
  };

  // Plays synthesized sentences sequentially
  const processPlayer = async () => {
    if (isPlayingRef.current) return;

    const nextItemIndex = playbackQueueRef.current.findIndex(item => item.status !== 'played' && item.status !== 'playing');
    if (nextItemIndex === -1) {
      if (streamFinishedRef.current && playbackQueueRef.current.every(item => item.status === 'played')) {
        console.log('All sentences played. Resuming recorder.');

        // Clear active highlighting state at the end
        if (wordIntervalRef.current) {
          clearInterval(wordIntervalRef.current);
          wordIntervalRef.current = null;
        }
        setActiveWords([]);
        setActiveWordIndex(-1);
        setIsIntroPlaying(false);

        // Show the complete combined paragraph now that playback has fully completed
        const fullResponse = playbackQueueRef.current.map(item => item.text).join(' ');
        const cleanResponse = fullResponse.replace(/[*#>`_\-]/g, '').replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
        setAiResponse(cleanResponse);

        startAudioRecording();
      }
      return;
    }

    const nextItem = playbackQueueRef.current[nextItemIndex];
    if (nextItem.status !== 'ready') {
      return;
    }

    // Clear any previous highlighting interval
    if (wordIntervalRef.current) {
      clearInterval(wordIntervalRef.current);
      wordIntervalRef.current = null;
    }

    isPlayingRef.current = true;
    nextItem.status = 'playing';
    setCallStatus('speaking');

    const cleanSentenceText = nextItem.text.replace(/[*#>`_\-]/g, '').replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
    setAiResponse(cleanSentenceText);
    
    // Split into words for karaoke highlighting
    const words = cleanSentenceText.split(/\s+/).filter(w => w.length > 0);
    setActiveWords(words);
    setActiveWordIndex(0);

    if (language === 'ne') {
      // Animate Nepalese words sequentially (approx 420ms per word)
      let currentIdx = 0;
      wordIntervalRef.current = setInterval(() => {
        currentIdx++;
        if (currentIdx < words.length) {
          setActiveWordIndex(currentIdx);
        } else {
          if (wordIntervalRef.current) {
            clearInterval(wordIntervalRef.current);
          }
        }
      }, 420);

      speakLocalTTS(nextItem.text, () => {
        if (wordIntervalRef.current) {
          clearInterval(wordIntervalRef.current);
          wordIntervalRef.current = null;
        }
        setActiveWordIndex(-1);
        setActiveWords([]);

        nextItem.status = 'played';
        isPlayingRef.current = false;
        processPlayer();
      });
    } else {
      if (nextItem.sound) {
        try {
          const sound = nextItem.sound;
          const status = await sound.getStatusAsync();
          const duration = (status.isLoaded && status.durationMillis) ? status.durationMillis : (words.length * 350);
          const intervalTime = Math.max(80, duration / words.length);

          sound.setOnPlaybackStatusUpdate(async (playbackStatus) => {
            if (playbackStatus.isLoaded && playbackStatus.didJustFinish) {
              if (wordIntervalRef.current) {
                clearInterval(wordIntervalRef.current);
                wordIntervalRef.current = null;
              }
              setActiveWordIndex(-1);
              setActiveWords([]);

              try {
                await sound.unloadAsync();
              } catch (e) {}
              if (nextItem.fileUri) {
                FileSystem.deleteAsync(nextItem.fileUri, { idempotent: true }).catch(() => {});
              }
              nextItem.status = 'played';
              isPlayingRef.current = false;
              processPlayer();
            }
          });
          
          await sound.playAsync();

          // Highlight words sequentially synchronized to audio duration
          let currentIdx = 0;
          wordIntervalRef.current = setInterval(() => {
            currentIdx++;
            if (currentIdx < words.length) {
              setActiveWordIndex(currentIdx);
            } else {
              if (wordIntervalRef.current) {
                clearInterval(wordIntervalRef.current);
              }
            }
          }, intervalTime);

        } catch (playErr) {
          console.warn('Playback failed, falling back to local TTS:', playErr);
          
          let currentIdx = 0;
          wordIntervalRef.current = setInterval(() => {
            currentIdx++;
            if (currentIdx < words.length) {
              setActiveWordIndex(currentIdx);
            } else {
              if (wordIntervalRef.current) {
                clearInterval(wordIntervalRef.current);
              }
            }
          }, 350);

          speakLocalTTS(nextItem.text, () => {
            if (wordIntervalRef.current) {
              clearInterval(wordIntervalRef.current);
              wordIntervalRef.current = null;
            }
            setActiveWordIndex(-1);
            setActiveWords([]);

            if (nextItem.fileUri) {
              FileSystem.deleteAsync(nextItem.fileUri, { idempotent: true }).catch(() => {});
            }
            nextItem.status = 'played';
            isPlayingRef.current = false;
            processPlayer();
          });
        }
      } else {
        let currentIdx = 0;
        wordIntervalRef.current = setInterval(() => {
          currentIdx++;
          if (currentIdx < words.length) {
            setActiveWordIndex(currentIdx);
          } else {
            if (wordIntervalRef.current) {
              clearInterval(wordIntervalRef.current);
            }
          }
        }, 350);

        speakLocalTTS(nextItem.text, () => {
          if (wordIntervalRef.current) {
            clearInterval(wordIntervalRef.current);
            wordIntervalRef.current = null;
          }
          setActiveWordIndex(-1);
          setActiveWords([]);

          nextItem.status = 'played';
          isPlayingRef.current = false;
          processPlayer();
        });
      }
    }
  };

  const speakLocalTTS = async (text: string, onDoneCallback?: () => void) => {
    try {
      const targetLang = language === 'ne' ? 'ne-NP' : 'en-US';
      const voices = await Speech.getAvailableVoicesAsync();
      
      let chosenVoiceId: string | undefined;
      const langVoices = voices.filter(v => 
        v.language.toLowerCase().startsWith(language === 'ne' ? 'ne' : 'en')
      );
      
      const premiumVoice = langVoices.find(v => {
        const idLower = (v.identifier || '').toLowerCase();
        const nameLower = (v.name || '').toLowerCase();
        return idLower.includes('premium') || idLower.includes('enhanced') || 
               idLower.includes('siri') || idLower.includes('neural') ||
               nameLower.includes('premium') || nameLower.includes('enhanced') ||
               (v.quality && (v.quality === 'Enhanced' || String(v.quality) === '2'));
      });
      
      if (premiumVoice) {
        chosenVoiceId = premiumVoice.identifier;
      } else if (langVoices.length > 0) {
        chosenVoiceId = langVoices[0].identifier;
      }
      
      Speech.speak(text, {
        language: targetLang,
        voice: chosenVoiceId,
        rate: 0.95,
        onDone: onDoneCallback,
        onError: (err) => {
          console.warn('TTS error:', err);
          if (onDoneCallback) onDoneCallback();
        }
      });
    } catch (err) {
      console.warn('Failed to choose premium voice:', err);
      Speech.speak(text, {
        language: language === 'ne' ? 'ne-NP' : 'en-US',
        rate: 0.95,
        onDone: onDoneCallback,
      });
    }
  };

  const base64ToUint8Array = (base64: string): Uint8Array => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    const str = base64.replace(/=+$/, '').replace(/\s/g, '');
    const len = str.length;
    const bufferLength = Math.floor(len * 0.75);
    const bytes = new Uint8Array(bufferLength);

    let p = 0;
    for (let i = 0; i < len; i += 4) {
      const c1 = chars.indexOf(str[i]);
      const c2 = chars.indexOf(str[i + 1] || 'A');
      const c3 = chars.indexOf(str[i + 2] || 'A');
      const c4 = chars.indexOf(str[i + 3] || 'A');

      const byte1 = (c1 << 2) | (c2 >> 4);
      const byte2 = ((c2 & 15) << 4) | (c3 >> 2);
      const byte3 = ((c3 & 3) << 6) | c4;

      bytes[p++] = byte1;
      if (i + 2 < len) bytes[p++] = byte2;
      if (i + 3 < len) bytes[p++] = byte3;
    }
    return bytes;
  };

  const uint8ArrayToBase64 = (uint8: Uint8Array): string => {
    const chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/';
    let result = '';
    const len = uint8.length;
    for (let i = 0; i < len; i += 3) {
      const byte1 = uint8[i];
      const byte2 = i + 1 < len ? uint8[i + 1] : NaN;
      const byte3 = i + 2 < len ? uint8[i + 2] : NaN;

      const c1 = byte1 >> 2;
      const c2 = ((byte1 & 3) << 4) | (isNaN(byte2) ? 0 : byte2 >> 4);
      const c3 = isNaN(byte2) ? NaN : (((byte2 & 15) << 2) | (isNaN(byte3) ? 0 : byte3 >> 6));
      const c4 = isNaN(byte3) ? NaN : (byte3 & 63);

      result += chars[c1];
      result += chars[c2];
      result += isNaN(c3) ? '=' : chars[c3];
      result += isNaN(c4) ? '=' : chars[c4];
    }
    return result;
  };

  const convertPcmToWavBase64 = (pcmBase64: string, sampleRate = 24000): string => {
    const pcmBytes = base64ToUint8Array(pcmBase64);
    const pcmLength = pcmBytes.length;
    const wavBytes = new Uint8Array(44 + pcmLength);

    // 1. ChunkID: "RIFF"
    wavBytes[0] = 0x52; wavBytes[1] = 0x49; wavBytes[2] = 0x46; wavBytes[3] = 0x46; 
    // 2. ChunkSize: 36 + pcmLength
    const chunkSize = 36 + pcmLength;
    wavBytes[4] = chunkSize & 0xff;
    wavBytes[5] = (chunkSize >> 8) & 0xff;
    wavBytes[6] = (chunkSize >> 16) & 0xff;
    wavBytes[7] = (chunkSize >> 24) & 0xff;
    // 3. Format: "WAVE"
    wavBytes[8] = 0x57; wavBytes[9] = 0x41; wavBytes[10] = 0x56; wavBytes[11] = 0x45;
    // 4. Subchunk1ID: "fmt "
    wavBytes[12] = 0x66; wavBytes[13] = 0x6d; wavBytes[14] = 0x74; wavBytes[15] = 0x20;
    // 5. Subchunk1Size: 16
    wavBytes[16] = 16; wavBytes[17] = 0; wavBytes[18] = 0; wavBytes[19] = 0;
    // 6. AudioFormat: 1 (PCM)
    wavBytes[20] = 1; wavBytes[21] = 0;
    // 7. NumChannels: 1 (Mono)
    wavBytes[22] = 1; wavBytes[23] = 0;
    // 8. SampleRate: 24000
    wavBytes[24] = sampleRate & 0xff;
    wavBytes[25] = (sampleRate >> 8) & 0xff;
    wavBytes[26] = (sampleRate >> 16) & 0xff;
    wavBytes[27] = (sampleRate >> 24) & 0xff;
    // 9. ByteRate: 48000 (SampleRate * NumChannels * BitsPerSample/8 = 24000 * 1 * 2)
    const byteRate = sampleRate * 2;
    wavBytes[28] = byteRate & 0xff;
    wavBytes[29] = (byteRate >> 8) & 0xff;
    wavBytes[30] = (byteRate >> 16) & 0xff;
    wavBytes[31] = (byteRate >> 24) & 0xff;
    // 10. BlockAlign: 2 (NumChannels * BitsPerSample/8)
    wavBytes[32] = 2; wavBytes[33] = 0;
    // 11. BitsPerSample: 16
    wavBytes[34] = 16; wavBytes[35] = 0;
    // 12. Subchunk2ID: "data"
    wavBytes[36] = 0x64; wavBytes[37] = 0x61; wavBytes[38] = 0x74; wavBytes[39] = 0x61;
    // 13. Subchunk2Size: pcmLength
    wavBytes[40] = pcmLength & 0xff;
    wavBytes[41] = (pcmLength >> 8) & 0xff;
    wavBytes[42] = (pcmLength >> 16) & 0xff;
    wavBytes[43] = (pcmLength >> 24) & 0xff;

    // Copy PCM bytes to wavBytes starting after the 44-byte header
    wavBytes.set(pcmBytes, 44);

    return uint8ArrayToBase64(wavBytes);
  };

  // Raw PCM to WAV helper is maintained for general utility if needed.

  const speakText = async (text: string, onDoneCallback?: () => void) => {
    await stopAllAudio();

    if (language === 'ne') {
      speakLocalTTS(text, onDoneCallback);
      return;
    }

    try {
      // Disable allowsRecordingIOS before playing so iOS routes sound to loudspeaker instead of earpiece receiver
      try {
        await Audio.setAudioModeAsync({
          allowsRecordingIOS: false,
          playsInSilentModeIOS: true,
        });
      } catch (modeErr) {
        console.warn('Failed to set audio mode for playback:', modeErr);
      }

      const fileUri = `${FileSystem.cacheDirectory}speech_${Date.now()}.mp3`;
      const response = await fetch('https://api.deepgram.com/v1/speak?model=aura-2-thalia-en&speed=0.93', {
        method: 'POST',
        headers: {
          'Authorization': 'Token 97e1f77806a1a0c01e76ec1619b743da8303311d',
          'Content-Type': 'text/plain',
        },
        body: text,
      });

      if (!response.ok) {
        throw new Error(`Deepgram API returned status ${response.status}`);
      }

      const arrayBuffer = await response.arrayBuffer();
      const base64 = uint8ArrayToBase64(new Uint8Array(arrayBuffer));
      await FileSystem.writeAsStringAsync(fileUri, base64, {
        encoding: FileSystem.EncodingType.Base64,
      });

      const { sound } = await Audio.Sound.createAsync(
        { uri: fileUri },
        { 
          shouldPlay: true,
          rate: 1.0, // Play at standard rate (slowing is handled natively by Deepgram Aura-2)
          shouldCorrectPitch: true,
        }
      );
      soundRef.current = sound;

      sound.setOnPlaybackStatusUpdate((status) => {
        if (status.isLoaded && status.didJustFinish) {
          FileSystem.deleteAsync(fileUri, { idempotent: true }).catch(() => {});
          if (onDoneCallback) onDoneCallback();
        }
      });

    } catch (err) {
      console.warn('Deepgram speak failed, falling back to local TTS:', err);
      speakLocalTTS(text, onDoneCallback);
    }
  };

  const cleanupRecording = async () => {
    try {
      if (recordingRef.current) {
        await recordingRef.current.stopAndUnloadAsync();
      }
    } catch (e) {}
    recordingRef.current = null;
    setRecording(null);
    setIsRecording(false);
  };

  // Silence detection refs for auto-send (adaptive relative-drop method)
  const silenceTimerRef = useRef<NodeJS.Timeout | null>(null);
  const silenceStartRef = useRef<number | null>(null);
  const hasSpokenRef = useRef<boolean>(false);
  const peakMeteringRef = useRef<number>(-160); // Track peak dB while speaking
  const SILENCE_DROP_DB = 12; // Must drop 12dB below peak to count as silence (tuned for real device)
  const SILENCE_DURATION_MS = 700; // 700ms — optimal for conversational AI

  const startSilenceDetection = (rec: Audio.Recording) => {
    stopSilenceDetection();
    hasSpokenRef.current = false;
    silenceStartRef.current = null;
    peakMeteringRef.current = -160;

    silenceTimerRef.current = setInterval(async () => {
      try {
        const status = await rec.getStatusAsync();
        if (!status.isRecording) {
          console.log('[SILENCE] Recording not active, skipping');
          return;
        }

        const metering = status.metering ?? -160;
        const peak = peakMeteringRef.current;

        // Update peak metering when user speaks
        if (metering > peakMeteringRef.current) {
          peakMeteringRef.current = metering;
        }

        // Consider "speaking" if metering is within 8dB of peak and above -40dB
        const isSpeaking = metering > -40 && metering > (peakMeteringRef.current - 8);
        // Consider "silent" if metering dropped 12+dB below peak
        const isSilent = hasSpokenRef.current && metering < (peakMeteringRef.current - SILENCE_DROP_DB);

        const silenceMs = silenceStartRef.current ? Date.now() - silenceStartRef.current : 0;

        console.log(`[SILENCE] dB=${metering.toFixed(1)} peak=${peak.toFixed(1)} hasSpoken=${hasSpokenRef.current} isSpeaking=${isSpeaking} isSilent=${isSilent} silenceMs=${silenceMs}`);

        if (isSpeaking) {
          hasSpokenRef.current = true;
          silenceStartRef.current = null; // Reset silence timer
        } else if (isSilent) {
          if (!silenceStartRef.current) {
            silenceStartRef.current = Date.now();
            console.log('[SILENCE] >>> Silence started, timer begin');
          } else if (Date.now() - silenceStartRef.current >= SILENCE_DURATION_MS) {
            console.log('[SILENCE] >>> AUTO-SEND TRIGGERED!');
            stopSilenceDetection();
            stopAudioRecordingAndProcess();
          }
        }
      } catch (e) {
        console.log('[SILENCE] Error polling:', e);
      }
    }, 100); // Poll every 100ms for responsiveness
  };

  const stopSilenceDetection = () => {
    if (silenceTimerRef.current) {
      clearInterval(silenceTimerRef.current);
      silenceTimerRef.current = null;
    }
    silenceStartRef.current = null;
    hasSpokenRef.current = false;
    peakMeteringRef.current = -160;
  };

  const startAudioRecording = async () => {
    // Prevent multiple parallel calls to startAudioRecording
    if (isStartingRecordingRef.current) {
      return;
    }
    isStartingRecordingRef.current = true;

    try {
      await stopAllAudio();
      
      // Safely unload previous recording before starting a new one
      if (recordingRef.current) {
        try {
          await recordingRef.current.stopAndUnloadAsync();
        } catch (e) {}
      }
      recordingRef.current = null;
      setRecording(null);
      setIsRecording(false);

      const { status } = await Audio.requestPermissionsAsync();
      if (status !== 'granted') {
        alert('Microphone access permission is required for voice calling.');
        setCallStatus('idle');
        isStartingRecordingRef.current = false;
        return;
      }

      // Reset native audio bridge state to release any locked hardware resources
      await Audio.setAudioModeAsync({
        allowsRecordingIOS: false,
        playsInSilentModeIOS: true,
      });

      await Audio.setAudioModeAsync({
        allowsRecordingIOS: true,
        playsInSilentModeIOS: true,
      });

      const newRecording = new Audio.Recording();
      await newRecording.prepareToRecordAsync({
        isMeteringEnabled: true, // Enable metering for silence detection
        android: {
          extension: '.m4a',
          outputFormat: Audio.AndroidOutputFormat.MPEG_4,
          audioEncoder: Audio.AndroidAudioEncoder.AAC,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 32000,
        },
        ios: {
          extension: '.m4a',
          outputFormat: Audio.IOSOutputFormat.MPEG4AAC,
          audioQuality: Audio.IOSAudioQuality.LOW,
          sampleRate: 16000,
          numberOfChannels: 1,
          bitRate: 32000,
        },
        web: {}
      });

      await newRecording.startAsync();
      recordingRef.current = newRecording;
      setRecording(newRecording);
      setIsRecording(true);
      setCallStatus('listening');

      // Start silence detection for auto-send
      startSilenceDetection(newRecording);
    } catch (err) {
      console.error('Failed to start recording:', err);
      setCallStatus('idle');
    } finally {
      isStartingRecordingRef.current = false;
    }
  };

  const stopAudioRecordingAndProcess = async () => {
    stopSilenceDetection(); // Stop silence detection before processing
    const activeRec = recordingRef.current;
    if (!activeRec) return;

    setCallStatus('connecting');
    setIsRecording(false);

    try {
      await activeRec.stopAndUnloadAsync();
      const uri = activeRec.getURI();
      recordingRef.current = null;
      setRecording(null);

      if (uri) {
        await handleVoiceAudioFile(uri);
      } else {
        setCallStatus('listening');
      }
    } catch (err) {
      console.error('Failed to stop recording:', err);
      setCallStatus('listening');
    }
  };

  const handleVoiceAudioFile = async (uri: string) => {
    prewarmDeepgram(); // Strategy 3: fire TLS handshake while Groq transcribes
    try {
      setAiResponse(language === 'ne' ? 'प्रशोधन गर्दै...' : 'Processing your voice...');
      
      const transcript = await transcribeAudioWithGroq(uri);
      if (!transcript.trim()) {
        setAiResponse(language === 'ne' ? 'मैले केहि सुनिन। कृपया फेरि प्रयास गर्नुहोस।' : "I didn't hear anything. Please try again.");
        setTimeout(() => startAudioRecording(), 2000);
        return;
      }

      setUserQuery(transcript);
      setAiResponse(language === 'ne' ? 'सोच्दै...' : 'Thinking...');
      setCallStatus('connecting');

      // Append user voice transcript to shared chat history immediately
      const userMsg: ChatMessage = {
        id: `voice_usr_${Date.now()}`,
        text: transcript,
        isUser: true,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, userMsg]);

      // Clear any prior stream/audio leftovers
      await stopAllAudio();

      const abortFn = streamAIAssistant(
        transcript,
        messages, // Pass the active chat history for full contextual session!
        language as any,
        true,
        (sentence) => {
          playbackQueueRef.current.push({
            text: sentence,
            status: 'pending_fetch'
          });
          processSynthesizer();
          processPlayer();
        },
        (doneText) => {
          const cleanDoneText = doneText.replace(/[*#>`_\-]/g, '').replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
          streamFinishedRef.current = true;
          processPlayer();

          // Append AI reply to shared chat history when fully done
          const botMsg: ChatMessage = {
            id: `voice_bot_${Date.now()}`,
            text: cleanDoneText,
            isUser: false,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, botMsg]);
        },
        (err) => {
          console.warn('Voice streaming error:', err);
          setCallStatus('idle');
          const errText = language === 'ne' ? 'माफ गर्नुहोस्, जडानमा समस्या भयो।' : 'Sorry, connection error.';
          setAiResponse(errText);
          speakLocalTTS(errText, () => {
            setCallStatus('idle');
          });
        }
      );

      abortStreamRef.current = abortFn;

    } catch (err) {
      console.warn('Voice call pipeline error:', err);
      setCallStatus('idle');
      const errText = language === 'ne' ? 'माफ गर्नुहोस्, जडानमा समस्या भयो।' : 'Sorry, connection error.';
      setAiResponse(errText);
      speakLocalTTS(errText, () => {
        setCallStatus('idle');
      });
    }
  };

  const startCallFlow = async () => {
    prewarmDeepgram(); // Strategy 3: fire TLS handshake early
    setUserQuery('');
    setAiResponse('');
    setIsIntroPlaying(false);
    await stopAllAudio();
    await cleanupRecording();

    if (messages.length > 0) {
      // Ongoing session: bypass welcome greeting, go straight to listening!
      setCallStatus('listening');
      startAudioRecording();
    } else {
      // Start of fresh session: play introductory greeting
      setCallStatus('connecting');
      setIsIntroPlaying(true); // Intro greeting shouldn't show captions

      setTimeout(async () => {
        if (!voiceCallVisible) return;
        setCallStatus('speaking');

        const introText = language === 'ne' 
          ? 'नमस्ते! म अनाभी AI। म तपाईंलाई कसरी सहयोग गरूँ?' 
          : 'Hello! I am Avani AI. How can I help you today?';
        setAiResponse(introText);

        // Play intro text via the pipelined queue
        playbackQueueRef.current.push({
          text: introText,
          status: 'pending_fetch'
        });
        streamFinishedRef.current = true; // Intro is only 1 sentence
        processSynthesizer();
        processPlayer();
      }, 200);
    }
  };

  const handleVoiceQuery = async (query: string) => {
    if (isMuted) return;
    prewarmDeepgram(); // Strategy 3: fire TLS handshake early
    await stopAllAudio();
    await cleanupRecording();
    
    setCallStatus('connecting');
    setUserQuery(query);
    setAiResponse(language === 'ne' ? 'सोच्दै...' : 'Thinking...');

    // Append user query trigger to shared chat history immediately
    const userMsg: ChatMessage = {
      id: `voice_q_usr_${Date.now()}`,
      text: query,
      isUser: true,
      timestamp: new Date(),
    };
    setMessages(prev => [...prev, userMsg]);

    try {
      setCallStatus('connecting');
      const abortFn = streamAIAssistant(
        query,
        messages, // Pass the active chat history for full contextual session!
        language as any,
        true,
        (sentence) => {
          playbackQueueRef.current.push({
            text: sentence,
            status: 'pending_fetch'
          });
          processSynthesizer();
          processPlayer();
        },
        (doneText) => {
          const cleanDoneText = doneText.replace(/[*#>`_\-]/g, '').replace(/\n+/g, ' ').replace(/\s{2,}/g, ' ').trim();
          streamFinishedRef.current = true;
          processPlayer();

          // Append AI reply to shared chat history when fully done
          const botMsg: ChatMessage = {
            id: `voice_bot_${Date.now()}`,
            text: cleanDoneText,
            isUser: false,
            timestamp: new Date(),
          };
          setMessages(prev => [...prev, botMsg]);
        },
        (err) => {
          console.warn('Voice streaming error:', err);
          setCallStatus('idle');
          const errText = language === 'ne' ? 'माफ गर्नुहोस्, जडानमा समस्या भयो।' : 'Sorry, connection error.';
          setAiResponse(errText);
          speakLocalTTS(errText, () => {
            setCallStatus('idle');
          });
        }
      );

      abortStreamRef.current = abortFn;
    } catch (err) {
      setCallStatus('idle');
      const errText = language === 'ne' ? 'माफ गर्नुहोस्, जडानमा समस्या भयो।' : 'Sorry, connection error.';
      setAiResponse(errText);
      speakLocalTTS(errText, () => {
        setCallStatus('idle');
      });
    }
  };

  // Save current chat silently and start a fresh session immediately with no dialog alerts
  const handleNewChat = async () => {
    if (messages.length === 0) return;

    try {
      const firstMsg = messages.find(m => m.isUser)?.text || 'Chat Session';
      const sessionTitle = firstMsg.substring(0, 30) + (firstMsg.length > 30 ? '...' : '');
      const newSession = {
        id: `session_${Date.now()}`,
        title: sessionTitle,
        messages,
        timestamp: new Date().toLocaleDateString(),
      };

      const existingRaw = await AsyncStorage.getItem('saved_chat_sessions');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      const updated = [newSession, ...existing];
      await AsyncStorage.setItem('saved_chat_sessions', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to auto-save chat session:', e);
    }

    // Instantly reset the active chat window to a fresh session
    setMessages([]);
    setUserQuery('');
    setAiResponse('');
    setInputText('');
  };

  // Load list of saved chat history sessions
  const loadSavedSessions = async () => {
    try {
      const existingRaw = await AsyncStorage.getItem('saved_chat_sessions');
      const existing = existingRaw ? JSON.parse(existingRaw) : [];
      setSavedSessions(existing);
    } catch (e) {
      console.warn('Failed to load saved sessions:', e);
    }
  };

  // Select a previous session to restore
  const handleSelectSession = (selectedMessages: ChatMessage[]) => {
    setMessages(selectedMessages);
    setHistoryModalVisible(false);
  };

  // Delete a saved session from history
  const handleDeleteSession = async (sessionId: string) => {
    try {
      const updated = savedSessions.filter(s => s.id !== sessionId);
      setSavedSessions(updated);
      await AsyncStorage.setItem('saved_chat_sessions', JSON.stringify(updated));
    } catch (e) {
      console.warn('Failed to delete session:', e);
    }
  };

  // Load history when Modal opens
  useEffect(() => {
    if (historyModalVisible) {
      loadSavedSessions();
    }
  }, [historyModalVisible]);

  const handleSendTextMessage = async () => {
    if (!inputText.trim() || isLoading) return;
    const userMsgText = inputText.trim();
    setInputText('');

    const userMsg: ChatMessage = {
      id: `text_usr_${Date.now()}`,
      text: userMsgText,
      isUser: true,
      timestamp: new Date(),
    };

    setMessages(prev => [...prev, userMsg]);
    setIsLoading(true);

    try {
      // Call Groq (non-voice mode: standard chat reply)
      const reply = await askAIAssistant(userMsgText, [...messages, userMsg], language as any, false);
      
      const botMsg: ChatMessage = {
        id: `text_bot_${Date.now()}`,
        text: reply,
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, botMsg]);
    } catch (err) {
      console.warn('Text chat error:', err);
      const errMsg: ChatMessage = {
        id: `text_err_${Date.now()}`,
        text: language === 'ne' 
          ? 'माफ गर्नुहोस्, सन्देश पठाउँदा समस्या भयो।' 
          : 'Sorry, failed to send message. Please try again.',
        isUser: false,
        timestamp: new Date(),
      };
      setMessages(prev => [...prev, errMsg]);
    } finally {
      setIsLoading(false);
      Keyboard.dismiss();
    }
  };

  const voiceSuggestions = language === 'ne' ? [
    'धान खेतको अवस्था कस्तो छ?',
    'के आज पानी पर्छ?',
    'माटोको चिस्यान कति हुनुपर्छ?',
    'मल हाल्ने सही समय कहिले हो?'
  ] : [
    'How is my rice field health?',
    'Is it going to rain today?',
    'What is the optimal soil moisture?',
    'When should I apply fertilizer?'
  ];

  return (
    <SafeAreaView style={styles.screen} edges={['top', 'left', 'right']}>
      <KeyboardAvoidingView
        style={{ flex: 1 }}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        {/* Top Header */}
        <View style={styles.topHeader}>
          {/* Left section: Logo + Title (Static Anavi AI) */}
          <View style={styles.headerLeft}>
            <Image 
              source={require('../../../assets/icon.png')} 
              style={styles.headerLogo} 
              resizeMode="contain"
            />
            <View>
              <Text style={styles.headerTitle}>Anavi AI</Text>
              <Text style={styles.headerSubtitle}>Powered by Groq</Text>
            </View>
          </View>

          {/* Right section: Plus Icon + History Icon */}
          <View style={styles.headerRight}>
            <TouchableOpacity 
              style={[styles.headerActionBtn, messages.length === 0 && { opacity: 0.3 }]} 
              activeOpacity={0.7}
              onPress={handleNewChat}
              disabled={messages.length === 0}
            >
              <Ionicons name="add" size={22} color={COLORS.forest900} />
            </TouchableOpacity>
            
            <TouchableOpacity 
              style={styles.headerActionBtn} 
              activeOpacity={0.7}
              onPress={() => setHistoryModalVisible(true)}
            >
              <Ionicons name="time-outline" size={22} color={COLORS.forest900} />
            </TouchableOpacity>
          </View>
        </View>

        {/* Main Content Area */}
        <View style={styles.container}>
          {messages.length === 0 ? (
            <TouchableWithoutFeedback onPress={Keyboard.dismiss}>
              <View style={styles.chatPlaceholder}>
                <Image 
                  source={require('../../../assets/images/avatar_thinking.png')} 
                  style={styles.chatPlaceholderMascot}
                  resizeMode="contain"
                />
                <Text style={styles.placeholderTitle}>
                  {language === 'ne' ? 'अनाभीसँग कुराकानी गर्नुहोस्' : 'Talk with Anavi'}
                </Text>
                <Text style={styles.placeholderSubtitle}>
                  {language === 'ne' 
                    ? 'कुराकानी सुरु गर्न तल टाईप गर्नुहोस् वा प्रत्यक्ष बोल्नको लागि बाँयाको फेस आइकन थिच्नुहोस्।' 
                    : 'Type below to chat, or tap the face icon on the left to start a real-time talk.'}
                </Text>
              </View>
            </TouchableWithoutFeedback>
          ) : (
            <ScrollView
              ref={scrollViewRef}
              style={styles.messagesList}
              contentContainerStyle={styles.messagesContent}
              keyboardShouldPersistTaps="handled"
              keyboardDismissMode="on-drag"
              onContentSizeChange={() => scrollViewRef.current?.scrollToEnd({ animated: true })}
            >
              {messages.map((msg) => (
                <View 
                  key={msg.id}
                  style={[
                    styles.messageBubbleContainer,
                    msg.isUser ? styles.userBubbleContainer : styles.botBubbleContainer
                  ]}
                >
                  {!msg.isUser && (
                    <Image 
                      source={require('../../../assets/images/avatar_thinking.png')}
                      style={styles.msgAvatar}
                    />
                  )}
                  <View style={[
                    styles.messageBubble,
                    msg.isUser ? styles.userBubble : styles.botBubble
                  ]}>
                    {msg.isUser ? (
                      <Text style={styles.userMsgText}>
                        {msg.text}
                      </Text>
                    ) : (
                      <Markdown style={markdownStyles}>
                        {msg.text}
                      </Markdown>
                    )}
                  </View>
                </View>
              ))}
              {isLoading && (
                <View style={styles.loadingBubbleContainer}>
                  <ActivityIndicator size="small" color={COLORS.forest500} />
                </View>
              )}
            </ScrollView>
          )}
        </View>

        {/* Bottom Capsule Input Bar */}
        <View style={[
          styles.bottomBar,
          { paddingBottom: keyboardVisible ? 12 : (Platform.OS === 'ios' ? 92 : 84) }
        ]}>
          <View style={styles.inputContainer}>
            {/* Face-to-Face Talk Button */}
            <TouchableOpacity 
              style={styles.faceTalkBtn} 
              activeOpacity={0.7}
              onPress={() => setVoiceCallVisible(true)}
            >
              <Ionicons name="person-circle-outline" size={22} color={COLORS.forest900} />
            </TouchableOpacity>

            {/* Text Input Capsule */}
            <View style={styles.inputCapsule}>
              <TextInput
                style={styles.textInput}
                placeholder={language === 'ne' ? 'अनाभीलाई केहि सोध्नुहोस्...' : 'Ask Avani anything...'}
                placeholderTextColor={COLORS.inkFaint}
                multiline
                value={inputText}
                onChangeText={setInputText}
              />
              {/* Send Button */}
              <TouchableOpacity 
                style={styles.sendBtn} 
                activeOpacity={0.8}
                onPress={handleSendTextMessage}
              >
                <Ionicons name="arrow-up" size={18} color={COLORS.white} />
              </TouchableOpacity>
            </View>
          </View>
        </View>
      </KeyboardAvoidingView>

      {/* ─── Real-Time Voice Call Interface (Modal) ─── */}
      <Modal
        visible={voiceCallVisible}
        animationType="slide"
        transparent={false}
        onRequestClose={() => setVoiceCallVisible(false)}
      >
        <LinearGradient 
          colors={['#ffffff', '#f4f6f4']} 
          style={styles.callScreen}
        >
          {/* Top Status Indicators */}
          <View style={styles.callHeader}>
            <View style={styles.callTitleRow}>
              <View style={styles.callGreenDot} />
              <Text style={styles.callTitle}>AVANI LIVE TALK</Text>
            </View>
            <Text style={styles.callStatusText}>
              {callStatus === 'connecting' && (language === 'ne' ? 'जडान हुँदैछ...' : 'Connecting...')}
              {callStatus === 'listening' && (language === 'ne' ? 'सुन्दैछ...' : 'Listening...')}
              {callStatus === 'speaking' && (language === 'ne' ? 'अनाभी बोलिरहेको छ...' : 'Avani is speaking...')}
              {callStatus === 'idle' && (language === 'ne' ? 'निष्क्रिय' : 'Idle')}
            </Text>
          </View>

          {/* Interactive Character Mascot Area */}
          {/* Interactive Character Mascot Area */}
          <TouchableOpacity 
            style={styles.mascotArea}
            activeOpacity={0.9}
            onPress={() => {
              if (callStatus === 'listening') {
                stopAudioRecordingAndProcess();
              } else if (callStatus === 'idle' || callStatus === 'speaking') {
                startAudioRecording();
              }
            }}
          >
            {/* Breathing outer rings */}
            <Animated.View style={[
              styles.breathingRingOuter,
              { transform: [{ scale: pulseAnim }] }
            ]} />
            <View style={styles.breathingRingInner}>
              <Image 
                source={require('../../../assets/images/avatar_thinking.png')} 
                style={styles.callMascotImage}
                resizeMode="contain"
              />
            </View>
          </TouchableOpacity>

          {/* Speech Transcription & Subtitles Box (Wheat-Gold Highlight White Capsule Box) */}
          {isIntroPlaying ? (
            <View style={{ height: 52 }} /> // Maintain layout spacing when greeting intro is speaking
          ) : (
            <View style={styles.transcriptionBox}>
              {callStatus === 'connecting' ? (
                <Text style={styles.thinkingText}>
                  {language === 'ne' ? 'सोच्दै...' : 'Thinking...'}
                </Text>
              ) : (
                <ScrollView
                  ref={subtitleScrollRef}
                  style={styles.transcriptionScroll}
                  contentContainerStyle={styles.wordsWrapper}
                  showsVerticalScrollIndicator={false}
                  onContentSizeChange={(w, h) => setContentHeight(h)}
                >
                  {activeWords.length === 0 ? (
                    <Text style={styles.idleText}>
                      {language === 'ne' ? 'अनाभी सुन्नको लागि तयार छ...' : 'Avani is ready to listen...'}
                    </Text>
                  ) : (
                    <Text style={styles.captionLine}>
                      {activeWords.map((word, index) => {
                        const isActive = index === activeWordIndex;
                        return (
                          <Text 
                            key={`${word}_${index}`}
                            style={[
                              styles.captionWord,
                              isActive ? styles.captionWordActive : styles.captionWordInactive
                            ]}
                          >
                            {word}{index < activeWords.length - 1 ? '  ' : ''}
                          </Text>
                        );
                      })}
                    </Text>
                  )}
                </ScrollView>
              )}
            </View>
          )}

          {/* Real-time Voice Wave Visualizer */}
          <View style={styles.waveVisualizer}>
            {callStatus === 'speaking' || callStatus === 'listening' ? (
              <View style={styles.waveRow}>
                {waveAnims.map((anim, idx) => (
                  <Animated.View 
                    key={idx} 
                    style={[
                      styles.waveBar, 
                      { 
                        height: anim, 
                        backgroundColor: callStatus === 'speaking' ? COLORS.forest500 : '#82a39b' 
                      }
                    ]} 
                  />
                ))}
              </View>
            ) : (
              <View style={styles.waveFlatLine} />
            )}
          </View>

          {/* Quick Voice Suggestions/Prompts for Easy Dialogue */}
          {callStatus === 'listening' && (
            <View style={styles.voiceSuggestionsBlock}>
              <Text style={styles.suggestionHelpText}>
                {language === 'ne' ? 'बोल्नको लागि एक प्रश्न रोज्नुहोस्:' : 'Tap to speak a question:'}
              </Text>
              <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.suggestionsScroll}>
                {voiceSuggestions.map((sug, idx) => (
                  <TouchableOpacity
                     key={idx}
                     style={styles.voiceSugBtn}
                     onPress={() => handleVoiceQuery(sug)}
                     activeOpacity={0.8}
                  >
                    <Text style={styles.voiceSugText}>{sug}</Text>
                  </TouchableOpacity>
                ))}
              </ScrollView>
            </View>
          )}

          {/* Bottom Actions (Mute, Record/Talk, End Call) */}
          <View style={styles.callActionsRow}>
            {/* Mute Toggle */}
            <TouchableOpacity 
              style={[styles.callBtnRound, isMuted && styles.callBtnAlert]} 
              activeOpacity={0.8}
              onPress={() => setIsMuted(!isMuted)}
            >
              <Ionicons 
                name={isMuted ? "mic-off" : "mic"} 
                size={22} 
                color={isMuted ? '#fff' : COLORS.forest900} 
              />
            </TouchableOpacity>

            {/* Tap-To-Talk Button */}
            <TouchableOpacity 
              style={[
                styles.talkCallBtn, 
                callStatus === 'listening' && styles.talkCallBtnActive,
                callStatus === 'connecting' && styles.talkCallBtnDisabled
              ]} 
              activeOpacity={0.8}
              disabled={callStatus === 'connecting'}
              onPress={() => {
                if (callStatus === 'listening') {
                  stopAudioRecordingAndProcess();
                } else {
                  startAudioRecording();
                }
              }}
            >
              {callStatus === 'connecting' ? (
                <ActivityIndicator color={COLORS.white} size="small" />
              ) : (
                <Ionicons 
                  name={callStatus === 'listening' ? "square" : "mic"} 
                  size={26} 
                  color={COLORS.white} 
                />
              )}
            </TouchableOpacity>

            {/* Close/End Call Button */}
            <TouchableOpacity 
              style={[styles.callBtnRound, { backgroundColor: COLORS.clay, borderColor: COLORS.clay }]} 
              activeOpacity={0.8}
              onPress={() => setVoiceCallVisible(false)}
            >
              <Ionicons name="close" size={26} color="#fff" />
            </TouchableOpacity>
          </View>
        </LinearGradient>
      </Modal>

      {/* ─── Chat History Modal ─── */}
      <Modal
        visible={historyModalVisible}
        animationType="slide"
        transparent={true}
        onRequestClose={() => setHistoryModalVisible(false)}
      >
        <View style={styles.historyModalBackdrop}>
          <View style={styles.historyModalContent}>
            <View style={styles.historyHeader}>
              <Text style={styles.historyModalTitle}>
                {language === 'ne' ? 'च्याट इतिहास' : 'Chat History'}
              </Text>
              <TouchableOpacity onPress={() => setHistoryModalVisible(false)}>
                <Ionicons name="close" size={24} color={COLORS.forest900} />
              </TouchableOpacity>
            </View>

            <FlatList
              data={savedSessions}
              keyExtractor={item => item.id}
              contentContainerStyle={{ paddingVertical: 10 }}
              renderItem={({ item }) => (
                <View style={styles.historyItemRow}>
                  <TouchableOpacity 
                    style={styles.historyItemBtn}
                    onPress={() => handleSelectSession(item.messages)}
                  >
                    <Ionicons name="chatbubble-ellipses-outline" size={20} color={COLORS.forest500} />
                    <View style={styles.historyTextContainer}>
                      <Text style={styles.historyItemTitle} numberOfLines={1}>{item.title}</Text>
                      <Text style={styles.historyItemTime}>{item.timestamp}</Text>
                    </View>
                  </TouchableOpacity>

                  <TouchableOpacity 
                    style={styles.historyDeleteBtn}
                    onPress={() => handleDeleteSession(item.id)}
                  >
                    <Ionicons name="trash-outline" size={18} color="#FF6B6B" />
                  </TouchableOpacity>
                </View>
              )}
              ListEmptyComponent={() => (
                <View style={styles.historyEmpty}>
                  <Text style={styles.historyEmptyText}>
                    {language === 'ne' ? 'कुनै च्याट इतिहास फेला परेन।' : 'No chat history found.'}
                  </Text>
                </View>
              )}
            />
          </View>
        </View>
      </Modal>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: COLORS.paper,
  },
  topHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingHorizontal: 16,
    paddingVertical: 12,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
    backgroundColor: COLORS.paper,
  },
  headerLeft: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  headerLogo: {
    width: 40,
    height: 40,
    borderRadius: 10,
  },
  headerTitle: {
    fontSize: 17,
    fontWeight: '800',
    color: COLORS.forest900,
  },
  headerSubtitle: {
    fontSize: 10.5,
    fontWeight: '600',
    color: COLORS.forest500,
    marginTop: 1,
  },
  headerRight: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  headerActionBtn: {
    width: 38,
    height: 38,
    borderRadius: 19,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  container: {
    flex: 1,
    width: '100%',
    backgroundColor: COLORS.paper,
  },
  chatPlaceholder: {
    flex: 1,
    justifyContent: 'center',
    alignItems: 'center',
    paddingHorizontal: 24,
    alignSelf: 'center',
    maxWidth: 320,
  },
  chatPlaceholderMascot: {
    width: 140,
    height: 140,
    marginBottom: 16,
  },
  placeholderTitle: {
    fontSize: 18,
    fontWeight: '800',
    color: COLORS.forest900,
    marginBottom: 8,
    textAlign: 'center',
  },
  placeholderSubtitle: {
    fontSize: 13,
    color: COLORS.inkSoft,
    lineHeight: 19,
    textAlign: 'center',
  },
  bottomBar: {
    paddingHorizontal: 16,
    paddingTop: 10,
    backgroundColor: COLORS.paper,
    borderTopWidth: 1,
    borderColor: COLORS.line,
  },
  inputContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 10,
  },
  faceTalkBtn: {
    width: 44,
    height: 44,
    borderRadius: 22,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  inputCapsule: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: COLORS.white,
    borderRadius: 22,
    borderWidth: 1,
    borderColor: COLORS.line,
    paddingHorizontal: 14,
    paddingVertical: 6,
    minHeight: 46,
  },
  textInput: {
    flex: 1,
    fontSize: 14,
    color: COLORS.ink,
    paddingVertical: 4,
    marginRight: 10,
    maxHeight: 100,
  },
  sendBtn: {
    width: 34,
    height: 34,
    borderRadius: 17,
    backgroundColor: COLORS.forest700,
    alignItems: 'center',
    justifyContent: 'center',
  },

  /* ─── Light/White Voice Call UI (Modal) Styles ─── */
  callScreen: {
    flex: 1,
    paddingHorizontal: 24,
    paddingTop: 54,
    paddingBottom: 40,
    justifyContent: 'space-between',
    alignItems: 'center',
  },
  callHeader: {
    alignItems: 'center',
    width: '100%',
  },
  callTitleRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  callGreenDot: {
    width: 6,
    height: 6,
    borderRadius: 3,
    backgroundColor: '#3baf34',
  },
  callTitle: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.forest500,
    letterSpacing: 1.5,
  },
  callStatusText: {
    fontSize: 16,
    fontWeight: '700',
    color: COLORS.forest900,
    marginTop: 8,
  },
  mascotArea: {
    width: 220,
    height: 220,
    justifyContent: 'center',
    alignItems: 'center',
    position: 'relative',
  },
  breathingRingOuter: {
    position: 'absolute',
    width: 200,
    height: 200,
    borderRadius: 100,
    borderWidth: 2.5,
    borderColor: 'rgba(70, 131, 64, 0.08)',
    backgroundColor: 'rgba(70, 131, 64, 0.03)',
  },
  breathingRingInner: {
    width: 154,
    height: 154,
    borderRadius: 77,
    backgroundColor: COLORS.white,
    borderWidth: 2,
    borderColor: '#d4e8d4',
    overflow: 'hidden',
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: '#000',
    shadowOpacity: 0.04,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 6 },
    elevation: 4,
  },
  callMascotImage: {
    width: 140,
    height: 140,
    marginTop: 10,
  },
  transcriptionBox: {
    width: '82%',
    backgroundColor: '#ffffff',
    borderWidth: 1.5,
    borderColor: '#f2f5f2',
    borderRadius: 24,
    height: 100,
    paddingHorizontal: 20,
    paddingVertical: 14,
    justifyContent: 'center',
    alignItems: 'center',
    alignSelf: 'center',
    shadowColor: '#000000',
    shadowOpacity: 0.04,
    shadowRadius: 14,
    shadowOffset: { width: 0, height: 6 },
    elevation: 3,
  },
  transcriptionScroll: {
    width: '100%',
  },
  wordsWrapper: {
    justifyContent: 'center',
    alignItems: 'center',
  },
  captionLine: {
    fontSize: 16.5,
    lineHeight: 24,
    textAlign: 'center',
  },
  captionWord: {
    fontSize: 16.5,
    lineHeight: 24,
  },
  captionWordActive: {
    color: '#D3A325', // Brand wheat-gold yellow
    fontWeight: '800',
    opacity: 1,
  },
  captionWordInactive: {
    color: COLORS.ink,
    opacity: 0.35,
    fontWeight: '600',
  },
  thinkingText: {
    fontSize: 16.5,
    fontWeight: '800',
    color: '#D3A325', // Brand wheat-gold yellow
    textAlign: 'center',
  },
  idleText: {
    fontSize: 14.5,
    fontWeight: '600',
    color: COLORS.inkFaint,
    textAlign: 'center',
  },
  waveVisualizer: {
    height: 40,
    justifyContent: 'center',
    alignItems: 'center',
    width: '100%',
  },
  waveRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
  },
  waveBar: {
    width: 4,
    borderRadius: 2,
  },
  waveFlatLine: {
    width: 60,
    height: 2,
    backgroundColor: COLORS.line,
  },
  voiceSuggestionsBlock: {
    width: '100%',
  },
  suggestionHelpText: {
    fontSize: 11,
    fontWeight: '800',
    color: COLORS.inkSoft,
    marginBottom: 8,
    textAlign: 'center',
    textTransform: 'uppercase',
    letterSpacing: 0.5,
  },
  suggestionsScroll: {
    gap: 8,
  },
  voiceSugBtn: {
    backgroundColor: COLORS.white,
    paddingVertical: 10,
    paddingHorizontal: 16,
    borderRadius: 16,
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: '#000',
    shadowOpacity: 0.02,
    shadowRadius: 4,
    shadowOffset: { width: 0, height: 2 },
    elevation: 1,
  },
  voiceSugText: {
    color: COLORS.forest900,
    fontSize: 12.5,
    fontWeight: '700',
  },
  callActionsRow: {
    flexDirection: 'row',
    justifyContent: 'center',
    alignItems: 'center',
    gap: 24,
    width: '100%',
  },
  callBtnRound: {
    width: 50,
    height: 50,
    borderRadius: 25,
    backgroundColor: COLORS.white,
    justifyContent: 'center',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: COLORS.line,
    shadowColor: '#000',
    shadowOpacity: 0.05,
    shadowRadius: 5,
    shadowOffset: { width: 0, height: 3 },
    elevation: 2,
  },
  callBtnInactive: {
    backgroundColor: '#f2f0eb',
  },
  callBtnAlert: {
    backgroundColor: COLORS.clay,
    borderColor: COLORS.clay,
  },
  endCallBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.clay,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.clay,
    shadowOpacity: 0.25,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  talkCallBtn: {
    width: 64,
    height: 64,
    borderRadius: 32,
    backgroundColor: COLORS.forest700,
    justifyContent: 'center',
    alignItems: 'center',
    shadowColor: COLORS.forest700,
    shadowOpacity: 0.2,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: 4 },
    elevation: 4,
  },
  talkCallBtnActive: {
    backgroundColor: COLORS.clay,
    shadowColor: COLORS.clay,
    transform: [{ scale: 1.05 }],
  },
  talkCallBtnDisabled: {
    backgroundColor: COLORS.inkFaint,
    shadowColor: 'transparent',
  },

  /* ─── Text Chat Message List Styles ─── */
  messagesList: {
    flex: 1,
    width: '100%',
  },
  messagesContent: {
    paddingVertical: 16,
    paddingHorizontal: 4,
  },
  messageBubbleContainer: {
    flexDirection: 'row',
    marginBottom: 16,
    alignItems: 'flex-end',
    width: '100%',
  },
  userBubbleContainer: {
    justifyContent: 'flex-end',
  },
  botBubbleContainer: {
    justifyContent: 'flex-start',
  },
  msgAvatar: {
    width: 28,
    height: 28,
    borderRadius: 14,
    marginRight: 8,
    backgroundColor: '#e2ede4',
  },
  messageBubble: {
    maxWidth: '82%',
    paddingHorizontal: 14,
    paddingVertical: 10,
    borderRadius: 16,
    overflow: 'hidden',
  },
  userBubble: {
    backgroundColor: COLORS.forest900,
    borderBottomRightRadius: 4,
  },
  botBubble: {
    backgroundColor: COLORS.white,
    borderBottomLeftRadius: 4,
    borderWidth: 1,
    borderColor: COLORS.line,
  },
  userMsgText: {
    color: COLORS.white,
    fontSize: 14.5,
    lineHeight: 20,
  },
  botMsgText: {
    color: COLORS.ink,
    fontSize: 14.5,
    lineHeight: 20,
  },
  loadingBubbleContainer: {
    paddingVertical: 8,
    paddingHorizontal: 12,
    alignSelf: 'flex-start',
    marginLeft: 36,
  },
  // Chat History Modal Styles
  historyModalBackdrop: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.45)',
    justifyContent: 'flex-end',
  },
  historyModalContent: {
    backgroundColor: COLORS.white,
    borderTopLeftRadius: 28,
    borderTopRightRadius: 28,
    height: '65%',
    padding: 24,
    shadowColor: '#000',
    shadowOpacity: 0.15,
    shadowRadius: 10,
    shadowOffset: { width: 0, height: -4 },
    elevation: 10,
  },
  historyHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: 20,
  },
  historyModalTitle: {
    fontSize: 20,
    fontWeight: '800',
    color: COLORS.forest900,
  },
  historyItemRow: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 14,
    borderBottomWidth: 1,
    borderBottomColor: COLORS.line,
  },
  historyItemBtn: {
    flex: 1,
    flexDirection: 'row',
    alignItems: 'center',
    gap: 12,
  },
  historyTextContainer: {
    flex: 1,
  },
  historyItemTitle: {
    fontSize: 15,
    fontWeight: '700',
    color: COLORS.ink,
  },
  historyItemTime: {
    fontSize: 12,
    color: COLORS.inkFaint,
    marginTop: 2,
  },
  historyDeleteBtn: {
    padding: 8,
  },
  historyEmpty: {
    alignItems: 'center',
    paddingVertical: 60,
  },
  historyEmptyText: {
    fontSize: 14.5,
    color: COLORS.inkSoft,
    fontWeight: '600',
  },
});
