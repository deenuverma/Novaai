import React, { useCallback, useEffect, useRef, useState } from 'react';
import {
  ArrowLeft,
  Camera,
  CameraOff,
  Download,
  Globe,
  ImagePlus,
  Keyboard,
  Loader2,
  PanelLeft,
  PhoneOff,
  RefreshCw,
  Send,
  Trash2,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { toast } from 'sonner';
import { NovaLogo } from '../brand/NovaLogo.tsx';
import { useAuth } from '../../context/AuthContext.tsx';
import { chatApi, ensureFreshAccessToken } from '../../services/api.ts';
import {
  encodeFloat32To16kPcmBase64,
  enqueuePcm24kBase64,
  getLiveOutputLevel,
  isLiveAudioUnlocked,
  playServerAudioBase64,
  setLiveOutputMuted,
  stopAllLivePlayback,
  subscribeLivePlaybackState,
  unlockLiveAudioEngine,
} from '../../lib/liveAudioEngine.ts';
import type { ChatMessage } from '../../types/models.ts';

export type LiveOrbState = 'listening' | 'thinking' | 'speaking';
export type HindiVoiceTone = 'Pyari' | 'Bindaas' | 'Samajhdar' | 'Chill';
export type HindiThinkingLevel = 'MINIMAL' | 'LOW' | 'HIGH';

interface LiveTurnEntry {
  id: string;
  sender: 'user' | 'nova';
  text: string;
  timestamp: string;
  imagePreviewUrl?: string;
  sources?: { title: string; url: string }[];
}

export interface ZoyaStyleLiveExperienceProps {
  open?: boolean;
  mode: 'standalone' | 'modal';
  onExit: () => void;
  initialLanguage?: string;
  activeChatId?: number | null;
  onSyncTurn?: (payload: {
    chatId: number;
    title: string;
    userMessage?: ChatMessage;
    assistantMessage?: ChatMessage;
  }) => void;
}

const PERSONA_OPTIONS: { id: HindiVoiceTone; label: string }[] = [
  { id: 'Pyari', label: 'प्यारी & Cute' },
  { id: 'Bindaas', label: 'Bindaas' },
  { id: 'Samajhdar', label: 'Samajhdar' },
  { id: 'Chill', label: 'Chill' },
];

const THINKING_OPTIONS: HindiThinkingLevel[] = ['MINIMAL', 'LOW', 'HIGH'];

const QUICK_HINDI_PROMPTS = [
  {
    label: 'नमस्ते NOVAAI',
    prompt: 'नमस्ते NOVAAI! कैसे हो आज?',
  },
  {
    label: 'मज़ेदार बात सुनाओ',
    prompt: 'कोई मज़ेदार और स्मार्ट बात हिंदी में सुनाओ!',
  },
  {
    label: 'करियर टिप दो',
    prompt: 'सॉफ़्टवेयर इंजीनियरिंग और इंटरव्यू की तैयारी के लिए एक शानदार टिप बताओ।',
  },
  {
    label: 'तुम्हें किसने बनाया?',
    prompt: 'तुम्हें किसने बनाया है और तुम्हारे डेवलपर कौन हैं?',
  },
];

function nowTimeLabel(): string {
  return new Date().toLocaleTimeString([], {
    hour: '2-digit',
    minute: '2-digit',
  });
}

export function ZoyaStyleLiveExperience({
  open = true,
  mode,
  onExit,
  initialLanguage = 'Hindi',
  activeChatId = null,
  onSyncTurn,
}: ZoyaStyleLiveExperienceProps) {
  const { user } = useAuth();
  const userFirstName =
    user?.name?.trim().split(/\s+/)[0] || 'Member';

  const [orbState, setOrbState] = useState<LiveOrbState>('listening');
  const [wsConnected, setWsConnected] = useState(false);
  const [connecting, setConnecting] = useState(true);
  const [needsAudioUnlock, setNeedsAudioUnlock] = useState(false);
  const [micPermissionError, setMicPermissionError] = useState<string | null>(null);

  const [voiceTone, setVoiceTone] = useState<HindiVoiceTone>('Pyari');
  const [thinkingLevel, setThinkingLevel] = useState<HindiThinkingLevel>('LOW');
  const [useGoogleSearch, setUseGoogleSearch] = useState(false);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  const [drawerOpen, setDrawerOpen] = useState(false);
  const [showKeyboardInput, setShowKeyboardInput] = useState(false);
  const [textDraft, setTextDraft] = useState('');
  const [cameraActive, setCameraActive] = useState(false);
  const [attachedImage, setAttachedImage] = useState<{
    mimeType: string;
    data: string;
    previewUrl: string;
  } | null>(null);

  const [turns, setTurns] = useState<LiveTurnEntry[]>([]);
  const [liveUserCaption, setLiveUserCaption] = useState('');
  const [liveNovaCaption, setLiveNovaCaption] = useState('');
  const [visualEnergy, setVisualEnergy] = useState(0.08);
  const [reconnectNonce, setReconnectNonce] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const chatIdRef = useRef<number | null>(activeChatId ?? null);
  const chatTitleRef = useRef<string>('Live Hindi Conversation');
  const micStreamRef = useRef<MediaStream | null>(null);
  const inputAudioCtxRef = useRef<AudioContext | null>(null);
  const scriptNodeRef = useRef<ScriptProcessorNode | null>(null);
  const micRmsRef = useRef(0);
  const isSpeakingRef = useRef(false);
  const unmountedRef = useRef(false);
  const pendingAudioChunksRef = useRef<string[]>([]);

  const liveUserCaptionRef = useRef('');
  const liveNovaCaptionRef = useRef('');

  const videoRef = useRef<HTMLVideoElement | null>(null);
  const cameraStreamRef = useRef<MediaStream | null>(null);
  const frameTimerRef = useRef<number | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement | null>(null);

  const onSyncTurnRef = useRef(onSyncTurn);
  useEffect(() => {
    onSyncTurnRef.current = onSyncTurn;
  }, [onSyncTurn]);

  useEffect(() => {
    if (activeChatId) {
      chatIdRef.current = activeChatId;
    }
  }, [activeChatId]);

  // Subscribe to WebAudio playback state so orb transitions smoothly between speaking & listening
  useEffect(() => {
    return subscribeLivePlaybackState((playing) => {
      isSpeakingRef.current = playing;
      setOrbState((prev) => {
        if (playing) return 'speaking';
        return prev === 'speaking' ? 'listening' : prev;
      });
    });
  }, []);

  // Visual energy animation loop (60fps compositor-friendly state updates)
  useEffect(() => {
    if (!open) return;
    let rafId = 0;
    const updateMeter = () => {
      const outLevel = getLiveOutputLevel();
      const inLevel = Math.min(1, micRmsRef.current * 6.5);
      const target = isSpeakingRef.current
        ? Math.max(0.22, outLevel)
        : Math.max(0.06, inLevel);
      setVisualEnergy((prev) => prev + (target - prev) * 0.28);
      rafId = window.requestAnimationFrame(updateMeter);
    };
    rafId = window.requestAnimationFrame(updateMeter);
    return () => window.cancelAnimationFrame(rafId);
  }, [open]);

  // Auto-scroll transcript drawer
  useEffect(() => {
    if (drawerOpen) {
      transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }
  }, [turns, drawerOpen, liveNovaCaption, liveUserCaption]);

  const appendCompletedTurn = useCallback(
    (
      userText: string,
      novaText: string,
      extra?: {
        imagePreviewUrl?: string;
        sources?: { title: string; url: string }[];
      }
    ) => {
      const cleanU = userText.trim();
      const cleanA = novaText.trim();
      if (!cleanU && !cleanA) return;
      const stamp = nowTimeLabel();
      setTurns((prev) => {
        const next = [...prev];
        if (cleanU) {
          next.push({
            id: `u-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sender: 'user',
            text: cleanU,
            timestamp: stamp,
            imagePreviewUrl: extra?.imagePreviewUrl,
          });
        }
        if (cleanA) {
          next.push({
            id: `a-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
            sender: 'nova',
            text: cleanA,
            timestamp: stamp,
            sources: extra?.sources,
          });
        }
        return next;
      });
    },
    []
  );

  const stopCameraFeed = useCallback(() => {
    if (frameTimerRef.current) {
      window.clearInterval(frameTimerRef.current);
      frameTimerRef.current = null;
    }
    if (cameraStreamRef.current) {
      for (const track of cameraStreamRef.current.getTracks()) {
        track.stop();
      }
      cameraStreamRef.current = null;
    }
    if (videoRef.current) {
      videoRef.current.srcObject = null;
    }
    setCameraActive(false);
  }, []);

  const stopMicrophonePipeline = useCallback(() => {
    if (scriptNodeRef.current) {
      try {
        scriptNodeRef.current.onaudioprocess = null;
        scriptNodeRef.current.disconnect();
      } catch {
        // ignore
      }
      scriptNodeRef.current = null;
    }
    if (inputAudioCtxRef.current) {
      void inputAudioCtxRef.current.close().catch(() => undefined);
      inputAudioCtxRef.current = null;
    }
    if (micStreamRef.current) {
      for (const track of micStreamRef.current.getTracks()) {
        track.stop();
      }
      micStreamRef.current = null;
    }
    micRmsRef.current = 0;
  }, []);

  const startMicrophonePipeline = useCallback(async () => {
    stopMicrophonePipeline();
    setMicPermissionError(null);
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          autoGainControl: true,
          channelCount: 1,
        },
      });
      if (unmountedRef.current) {
        for (const t of stream.getTracks()) t.stop();
        return;
      }
      micStreamRef.current = stream;

      const AudioCtx =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext: typeof AudioContext })
          .webkitAudioContext;
      const inCtx = new AudioCtx({ sampleRate: 16000 });
      if (inCtx.state === 'suspended') {
        await inCtx.resume().catch(() => undefined);
      }
      inputAudioCtxRef.current = inCtx;

      const source = inCtx.createMediaStreamSource(stream);
      const processor = inCtx.createScriptProcessor(4096, 1, 1);
      // Route through a zero-gain sink so mic capture never echoes locally
      const silentSink = inCtx.createGain();
      silentSink.gain.value = 0;

      source.connect(processor);
      processor.connect(silentSink);
      silentSink.connect(inCtx.destination);
      scriptNodeRef.current = processor;

      processor.onaudioprocess = (event) => {
        const ws = wsRef.current;
        const inputSamples = event.inputBuffer.getChannelData(0);
        const { base64, rms } = encodeFloat32To16kPcmBase64(
          inputSamples,
          inCtx.sampleRate
        );
        micRmsRef.current = rms;

        if (ws && ws.readyState === WebSocket.OPEN) {
          ws.send(JSON.stringify({ audio: base64 }));
        }
      };
    } catch {
      setMicPermissionError(
        'माइक्रोफ़ोन की अनुमति नहीं मिली। कृपया ब्राउज़र में Mic Allow करें या नीचे टाइप करके बात करें।'
      );
    }
  }, [stopMicrophonePipeline]);

  // Connect to /api/live real-time Gemini 3.8 Live WebSocket + Always-On Hands-Free mic
  useEffect(() => {
    if (!open) return;
    unmountedRef.current = false;

    let activeSocket: WebSocket | null = null;

    const bootLiveSession = async () => {
      setConnecting(true);
      const unlocked = await unlockLiveAudioEngine();
      setNeedsAudioUnlock(!unlocked && !isLiveAudioUnlocked());

      // Start hands-free microphone capture in parallel
      void startMicrophonePipeline();

      const freshToken = (await ensureFreshAccessToken()) || '';
      if (unmountedRef.current) return;

      const proto = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
      const qs = new URLSearchParams({
        language: initialLanguage || 'Hindi',
        tone: voiceTone,
        voice: 'Zephyr',
      });
      if (freshToken) qs.set('token', freshToken);
      if (chatIdRef.current) qs.set('chatId', String(chatIdRef.current));

      const ws = new WebSocket(`${proto}//${window.location.host}/api/live?${qs.toString()}`);
      activeSocket = ws;
      wsRef.current = ws;

      ws.onmessage = (event) => {
        try {
          const msg = JSON.parse(event.data as string) as {
            type: string;
            audio?: string;
            text?: string;
            error?: string;
            chatId?: number;
            title?: string;
            message?: ChatMessage;
          };

          if (msg.type === 'ready') {
            setConnecting(false);
            setWsConnected(true);
            setOrbState('thinking');
            // Immediately trigger a warm natural spoken Hindi greeting
            ws.send(JSON.stringify({ greet: true }));
          } else if (msg.type === 'audio' && msg.audio) {
            if (!isLiveAudioUnlocked()) {
              pendingAudioChunksRef.current.push(msg.audio);
              setNeedsAudioUnlock(true);
            } else {
              enqueuePcm24kBase64(msg.audio);
            }
          } else if (msg.type === 'input_transcript' && typeof msg.text === 'string') {
            liveUserCaptionRef.current = msg.text;
            setLiveUserCaption(msg.text);
          } else if (msg.type === 'output_transcript' && typeof msg.text === 'string') {
            liveNovaCaptionRef.current = msg.text;
            setLiveNovaCaption(msg.text);
          } else if (msg.type === 'interrupted') {
            stopAllLivePlayback();
            appendCompletedTurn(
              liveUserCaptionRef.current,
              liveNovaCaptionRef.current
            );
            liveUserCaptionRef.current = '';
            liveNovaCaptionRef.current = '';
            setLiveUserCaption('');
            setLiveNovaCaption('');
            setOrbState('listening');
          } else if (msg.type === 'turn_complete') {
            appendCompletedTurn(
              liveUserCaptionRef.current,
              liveNovaCaptionRef.current
            );
            liveUserCaptionRef.current = '';
            liveNovaCaptionRef.current = '';
            setLiveUserCaption('');
            setLiveNovaCaption('');
            if (!isSpeakingRef.current) {
              setOrbState('listening');
            }
          } else if (msg.type === 'chat_meta' && msg.chatId) {
            chatIdRef.current = msg.chatId;
            if (msg.title) chatTitleRef.current = msg.title;
          } else if (msg.type === 'saved_message' && msg.message && chatIdRef.current) {
            onSyncTurnRef.current?.({
              chatId: chatIdRef.current,
              title: chatTitleRef.current,
              ...(msg.message.role === 'user'
                ? { userMessage: msg.message }
                : { assistantMessage: msg.message }),
            });
          } else if (msg.type === 'error' && msg.error) {
            setConnecting(false);
            toast.error(msg.error);
          }
        } catch {
          // ignore malformed frames
        }
      };

      ws.onerror = () => {
        setConnecting(false);
        setWsConnected(false);
      };

      ws.onclose = () => {
        if (!unmountedRef.current) {
          setWsConnected(false);
          setConnecting(false);
        }
      };
    };

    void bootLiveSession();

    return () => {
      unmountedRef.current = true;
      stopAllLivePlayback();
      stopMicrophonePipeline();
      stopCameraFeed();
      if (activeSocket) {
        try {
          activeSocket.close();
        } catch {
          // ignore
        }
      }
      wsRef.current = null;
    };
  }, [
    open,
    initialLanguage,
    voiceTone,
    reconnectNonce,
    appendCompletedTurn,
    startMicrophonePipeline,
    stopMicrophonePipeline,
    stopCameraFeed,
  ]);

  const handleUnlockAudioClick = async () => {
    const ok = await unlockLiveAudioEngine();
    if (ok) {
      setNeedsAudioUnlock(false);
      if (inputAudioCtxRef.current?.state === 'suspended') {
        await inputAudioCtxRef.current.resume().catch(() => undefined);
      }
      const queued = pendingAudioChunksRef.current.splice(0);
      for (const chunk of queued) {
        enqueuePcm24kBase64(chunk);
      }
    }
  };

  const handleToggleMute = () => {
    const next = !isAudioMuted;
    setIsAudioMuted(next);
    setLiveOutputMuted(next);
    if (next) {
      stopAllLivePlayback();
    } else {
      void handleUnlockAudioClick();
    }
  };

  const handleToggleCamera = async () => {
    if (cameraActive) {
      stopCameraFeed();
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
      });
      cameraStreamRef.current = stream;
      setCameraActive(true);
      requestAnimationFrame(() => {
        if (videoRef.current) {
          videoRef.current.srcObject = stream;
          void videoRef.current.play().catch(() => undefined);
        }
      });

      const canvas = document.createElement('canvas');
      canvas.width = 480;
      canvas.height = 360;
      const ctx2d = canvas.getContext('2d');

      // Send 1 frame every 1.5s (< 1 FPS per Live API rule)
      frameTimerRef.current = window.setInterval(() => {
        const ws = wsRef.current;
        const vid = videoRef.current;
        if (!ws || ws.readyState !== WebSocket.OPEN || !vid || !ctx2d) return;
        if (vid.readyState < 2) return;
        ctx2d.drawImage(vid, 0, 0, canvas.width, canvas.height);
        const jpegUrl = canvas.toDataURL('image/jpeg', 0.68);
        const base64 = jpegUrl.split(',')[1];
        if (base64) {
          ws.send(JSON.stringify({ video: base64 }));
        }
      }, 1500);
    } catch {
      toast.error('कैमरा चालू नहीं हो सका। कृपया ब्राउज़र में Camera Allow करें।');
    }
  };

  const handleAttachImage = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const dataUrl = String(reader.result || '');
      const commaIdx = dataUrl.indexOf(',');
      if (commaIdx !== -1) {
        setAttachedImage({
          mimeType: file.type || 'image/jpeg',
          data: dataUrl.slice(commaIdx + 1),
          previewUrl: dataUrl,
        });
        setShowKeyboardInput(true);
      }
    };
    reader.readAsDataURL(file);
    e.target.value = '';
  };

  const sendDirectPrompt = async (promptText: string) => {
    const clean = promptText.trim();
    if (!clean) return;

    await handleUnlockAudioClick();
    stopAllLivePlayback();
    setTextDraft('');

    // Use grounded/multimodal HTTP voiceConverse when Search Grounding or an attached image is present,
    // or if the Live WebSocket is temporarily disconnected.
    const ws = wsRef.current;
    const shouldUseHttpConverse =
      useGoogleSearch ||
      Boolean(attachedImage) ||
      thinkingLevel === 'HIGH' ||
      !ws ||
      ws.readyState !== WebSocket.OPEN;

    if (!shouldUseHttpConverse && ws && ws.readyState === WebSocket.OPEN) {
      liveUserCaptionRef.current = clean;
      setLiveUserCaption(clean);
      setOrbState('thinking');
      ws.send(JSON.stringify({ text: clean }));
      return;
    }

    const snap = attachedImage;
    setAttachedImage(null);
    setLiveUserCaption(clean);
    setOrbState('thinking');

    try {
      const res = await chatApi.voiceConverse({
        chatId: chatIdRef.current,
        message: clean,
        language: initialLanguage || 'Hindi',
        voiceName: 'Zephyr',
        voiceTone,
        thinkingLevel,
        useGoogleSearch,
        imageData: snap ? { mimeType: snap.mimeType, data: snap.data } : null,
      });

      chatIdRef.current = res.chatId;
      chatTitleRef.current = res.title;
      onSyncTurnRef.current?.({
        chatId: res.chatId,
        title: res.title,
        userMessage: res.userMessage,
        assistantMessage: res.assistantMessage,
      });

      setLiveUserCaption('');
      setLiveNovaCaption(res.replyText);
      appendCompletedTurn(clean, res.replyText, {
        imagePreviewUrl: snap?.previewUrl,
        sources: res.sources,
      });

      if (res.audioWavBase64 && !isAudioMuted) {
        await playServerAudioBase64(res.audioWavBase64);
      } else {
        setOrbState('listening');
      }
    } catch (err) {
      setOrbState('listening');
      toast.error(
        err instanceof Error ? err.message : 'आवाज़ से जवाब लाने में समस्या आई।'
      );
    }
  };

  const handleDownloadTranscript = () => {
    if (turns.length === 0) {
      toast.info('अभी तक कोई बातचीत रिकॉर्ड नहीं हुई है।');
      return;
    }
    const lines = turns.map(
      (t) =>
        `[${t.timestamp}] ${t.sender === 'user' ? userFirstName : 'NOVAAI'}: ${t.text}`
    );
    const blob = new Blob([lines.join('\n\n')], {
      type: 'text/plain;charset=utf-8',
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `NOVAAI-Live-Hindi-${new Date().toISOString().slice(0, 10)}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 4000);
  };

  const handleExitSession = () => {
    stopAllLivePlayback();
    stopMicrophonePipeline();
    stopCameraFeed();
    onExit();
  };

  if (!open) return null;

  const orbScaleClass =
    orbState === 'speaking'
      ? 'scale-110'
      : visualEnergy > 0.22
        ? 'scale-105'
        : 'scale-100';

  const outerRingScaleClass =
    orbState === 'speaking'
      ? 'scale-125 opacity-95'
      : orbState === 'thinking'
        ? 'scale-110 opacity-80'
        : visualEnergy > 0.18
          ? 'scale-110 opacity-75'
          : 'scale-100 opacity-45';

  return (
    <div
      className={
        mode === 'modal'
          ? 'fixed inset-0 z-50 flex flex-col bg-[#080C0B] text-[#F2F6F4] overflow-hidden select-none'
          : 'min-h-screen w-full flex flex-col bg-[#080C0B] text-[#F2F6F4] overflow-hidden select-none'
      }
    >
      {/* Subtle Ambient Studio Radial Depth */}
      <div
        aria-hidden="true"
        className="pointer-events-none fixed inset-0 bg-[radial-gradient(circle_at_50%_38%,rgba(16,185,129,0.14),rgba(200,149,107,0.05)_38%,transparent_72%)]"
      />

      {/* Top Navigation & Voice Studio Controls */}
      <header className="relative z-20 flex flex-wrap items-center justify-between gap-3 border-b border-[#1E2B26] bg-[#0B110F]/90 px-4 py-3 sm:px-6">
        <div className="flex items-center gap-3">
          <button
            type="button"
            onClick={handleExitSession}
            className="inline-flex h-10 w-10 items-center justify-center rounded-xl border border-[#23322C] bg-[#121A17] text-[#DCE6E1] transition-colors hover:border-[#10B981]/50 hover:text-white cursor-pointer"
            title="वापस जाएँ"
          >
            {mode === 'modal' ? <X className="h-4 w-4" /> : <ArrowLeft className="h-4 w-4" />}
          </button>

          <div className="flex items-center gap-2.5">
            <NovaLogo size="sm" />
            <div>
              <div className="flex items-center gap-2">
                <span className="font-display text-sm font-bold tracking-tight text-[#F2F6F4] whitespace-nowrap">
                  NOVAAI Live
                </span>
                <span className="text-xs text-[#8DA197] whitespace-nowrap">
                  · Hindi Hands-Free Voice
                </span>
              </div>
              <p className="text-[11px] text-[#7D9187]">
                Created by Deenu Verma · {wsConnected ? 'Live Stream Active' : connecting ? 'Connecting Voice...' : 'Reconnecting'}
              </p>
            </div>
          </div>
        </div>

        {/* Persona, Thinking, Grounding & Audio Actions — Identical on Laptop & Mobile */}
        <div className="flex flex-wrap items-center gap-2 overflow-x-auto">
          {/* Tone Segmented Selector */}
          <div className="flex items-center gap-0.5 rounded-xl border border-[#22312B] bg-[#111916] p-1">
            {PERSONA_OPTIONS.map((p) => {
              const active = voiceTone === p.id;
              return (
                <button
                  key={p.id}
                  type="button"
                  onClick={() => {
                    void handleUnlockAudioClick();
                    setVoiceTone(p.id);
                  }}
                  className={`rounded-lg px-2.5 py-1 text-xs font-semibold transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#10B981] text-[#06120E]'
                      : 'text-[#9AB0A6] hover:text-[#F2F6F4]'
                  }`}
                >
                  {p.label}
                </button>
              );
            })}
          </div>

          {/* Thinking Depth Segmented Selector */}
          <div className="flex items-center gap-0.5 rounded-xl border border-[#22312B] bg-[#111916] p-1">
            {THINKING_OPTIONS.map((lvl) => {
              const active = thinkingLevel === lvl;
              return (
                <button
                  key={lvl}
                  type="button"
                  onClick={() => setThinkingLevel(lvl)}
                  className={`rounded-lg px-2 py-1 text-[11px] font-medium transition-colors whitespace-nowrap cursor-pointer ${
                    active
                      ? 'bg-[#1F2E28] text-[#6EE7B7]'
                      : 'text-[#84998F] hover:text-[#DCE6E1]'
                  }`}
                >
                  {lvl === 'MINIMAL' ? 'Fast' : lvl === 'LOW' ? 'Balanced' : 'Deep'}
                </button>
              );
            })}
          </div>

          {/* Google Search Grounding Toggle */}
          <button
            type="button"
            onClick={() => setUseGoogleSearch((v) => !v)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              useGoogleSearch
                ? 'border-[#C8956B]/60 bg-[#C8956B]/15 text-[#E8C3A3]'
                : 'border-[#22312B] bg-[#111916] text-[#9AB0A6] hover:text-[#F2F6F4]'
            }`}
            title="Live Google Search Grounding"
          >
            <Globe className="h-3.5 w-3.5 shrink-0" />
            <span>Web Grounding</span>
          </button>

          {/* Transcript History Toggle */}
          <button
            type="button"
            onClick={() => setDrawerOpen((v) => !v)}
            className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 text-xs font-medium transition-colors whitespace-nowrap cursor-pointer ${
              drawerOpen
                ? 'border-[#10B981]/60 bg-[#10B981]/15 text-[#6EE7B7]'
                : 'border-[#22312B] bg-[#111916] text-[#9AB0A6] hover:text-[#F2F6F4]'
            }`}
          >
            <PanelLeft className="h-3.5 w-3.5 shrink-0" />
            <span>Transcript ({turns.length})</span>
          </button>

          {/* Speaker Mute/Unmute */}
          <button
            type="button"
            onClick={handleToggleMute}
            className={`inline-flex h-9 w-9 items-center justify-center rounded-xl border transition-colors cursor-pointer ${
              isAudioMuted
                ? 'border-[#E11D48]/50 bg-[#E11D48]/15 text-[#FDA4AF]'
                : 'border-[#22312B] bg-[#111916] text-[#6EE7B7] hover:border-[#10B981]/50'
            }`}
            title={isAudioMuted ? 'आवाज़ चालू करें' : 'आवाज़ म्यूट करें'}
          >
            {isAudioMuted ? <VolumeX className="h-4 w-4" /> : <Volume2 className="h-4 w-4" />}
          </button>

          {/* End Live Call */}
          <button
            type="button"
            onClick={handleExitSession}
            className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#422329] bg-[#261418] px-3 text-xs font-semibold text-[#FDA4AF] transition-colors hover:bg-[#361B21] whitespace-nowrap cursor-pointer"
          >
            <PhoneOff className="h-3.5 w-3.5" />
            <span>End</span>
          </button>
        </div>
      </header>

      {/* One-Tap Browser Audio Unlock Banner (Only shown if F5 reload suspended AudioContext) */}
      {needsAudioUnlock && (
        <div className="relative z-30 mx-auto mt-3 px-4">
          <button
            type="button"
            onClick={handleUnlockAudioClick}
            className="flex items-center gap-2.5 rounded-xl border border-[#10B981] bg-[#059669] px-5 py-2.5 text-sm font-semibold text-white shadow-lg transition-transform hover:bg-[#10B981] active:scale-95 cursor-pointer"
          >
            <Volume2 className="h-4 w-4 shrink-0" />
            <span>NOVAAI की लाइव आवाज़ सुनने के लिए एक बार यहाँ टैप करें</span>
          </button>
        </div>
      )}

      {/* Main Center Stage: Luminous Emerald & Bronze Live Voice Core */}
      <main className="relative z-10 flex flex-1 flex-col items-center justify-center px-4 py-6">
        {/* Camera Vision Floating Preview */}
        {cameraActive && (
          <div className="mb-5 overflow-hidden rounded-2xl border border-[#263831] bg-[#101815] shadow-xl">
            <video
              ref={videoRef}
              muted
              playsInline
              className="h-32 w-44 object-cover sm:h-36 sm:w-52"
            />
          </div>
        )}

        {/* Audio-Reactive Multi-Layer Emerald Jade & Champagne Bronze Orb */}
        <div
          onClick={() => void handleUnlockAudioClick()}
          className="relative flex h-64 w-64 items-center justify-center sm:h-72 sm:w-72 cursor-pointer"
          title="Always-On Hands-Free Hindi Voice"
        >
          {/* Outer Atmospheric Halo */}
          <div
            className={`absolute inset-0 rounded-full border border-[#10B981]/30 bg-[radial-gradient(circle,rgba(16,185,129,0.20)_0%,rgba(200,149,107,0.08)_52%,transparent_75%)] transition-all duration-200 ${outerRingScaleClass}`}
          />

          {/* Secondary Champagne Bronze Acoustic Ring */}
          <div
            className={`absolute inset-6 rounded-full border border-[#C8956B]/35 transition-transform duration-200 ${
              orbState === 'speaking'
                ? 'scale-110 rotate-45'
                : orbState === 'thinking'
                  ? 'scale-105 rotate-12'
                  : 'scale-100'
            }`}
          />

          {/* Inner Core Sphere */}
          <div
            className={`relative flex h-40 w-40 sm:h-44 sm:w-44 flex-col items-center justify-center rounded-full border transition-all duration-200 shadow-2xl ${orbScaleClass} ${
              orbState === 'speaking'
                ? 'border-[#6EE7B7]/80 bg-[radial-gradient(circle_at_35%_30%,#34D399_0%,#059669_52%,#063729_100%)]'
                : orbState === 'thinking'
                  ? 'border-[#D4A373]/70 bg-[radial-gradient(circle_at_35%_30%,#D4A373_0%,#8C5E3C_58%,#1B1612_100%)]'
                  : 'border-[#10B981]/55 bg-[radial-gradient(circle_at_35%_30%,#10B981_0%,#065F46_58%,#0B1613_100%)]'
            }`}
          >
            {/* Acoustic Waveform Bars Inside Core */}
            <div className="flex items-center justify-center gap-1.5 h-12">
              {[0.55, 0.9, 1.25, 0.95, 0.6].map((mult, idx) => {
                const activeLevel =
                  orbState === 'thinking'
                    ? 0.45
                    : Math.max(0.18, Math.min(1, visualEnergy * mult));
                const heightClass =
                  activeLevel > 0.75
                    ? 'h-11'
                    : activeLevel > 0.52
                      ? 'h-8'
                      : activeLevel > 0.32
                        ? 'h-5'
                        : 'h-3';
                return (
                  <span
                    key={idx}
                    className={`w-1.5 rounded-full bg-[#F2F6F4] transition-all duration-100 ${heightClass}`}
                  />
                );
              })}
            </div>
            <span className="mt-2 text-[11px] font-semibold tracking-wide text-[#ECFDF5]/90">
              {orbState === 'speaking'
                ? 'NOVAAI बोल रही है'
                : orbState === 'thinking'
                  ? 'सोच रही है...'
                  : 'सुन रही है · Hands-Free'}
            </span>
          </div>
        </div>

        {/* Live State Headline & Streaming Hindi Subtitles */}
        <div className="mt-5 max-w-2xl text-center space-y-2.5">
          <h1 className="font-display text-xl sm:text-2xl font-bold tracking-tight text-[#F2F6F4] text-balance">
            {connecting
              ? `हाय ${userFirstName}! NOVAAI की प्यारी आवाज़ कनेक्ट हो रही है...`
              : orbState === 'speaking'
                ? `NOVAAI बहुत प्यार से ${userFirstName} से बात कर रही है...`
                : orbState === 'thinking'
                  ? `NOVAAI ${userFirstName} के लिए जवाब तैयार कर रही है...`
                  : `हाय ${userFirstName}! बेझिझक बोलिए — माइक हमेशा ऑन और हैंड्स-फ़्री है`}
          </h1>

          {micPermissionError ? (
            <p className="mx-auto max-w-lg rounded-xl border border-[#C8956B]/40 bg-[#1B1612] px-4 py-2 text-xs text-[#E8C3A3]">
              {micPermissionError}
            </p>
          ) : (
            <p className="text-xs sm:text-sm text-[#94A89E]">
              NOVAAI सिर्फ़ आपके रजिस्टर्ड नाम ({user?.name || userFirstName}) से आपसे एकदम मीठी और क्यूट आवाज़ में बात करेगी। बीच में बोलने पर वह खुद रुककर आपकी सुनेगी।
            </p>
          )}

          {/* Real-Time Captions */}
          {(liveUserCaption || liveNovaCaption) && (
            <div className="mx-auto mt-3 max-w-xl rounded-2xl border border-[#21312B] bg-[#101815]/95 px-5 py-3.5 text-left space-y-2">
              {liveUserCaption && (
                <p className="text-xs sm:text-sm text-[#9AB0A6]">
                  <span className="font-semibold text-[#C8956B]">{userFirstName}: </span>
                  {liveUserCaption}
                </p>
              )}
              {liveNovaCaption && (
                <p className="text-sm sm:text-base font-medium leading-relaxed text-[#ECFDF5]">
                  <span className="font-semibold text-[#34D399]">NOVAAI: </span>
                  {liveNovaCaption}
                </p>
              )}
            </div>
          )}

          {!wsConnected && !connecting && (
            <div className="pt-2">
              <button
                type="button"
                onClick={() => setReconnectNonce((n) => n + 1)}
                className="inline-flex items-center gap-2 rounded-xl border border-[#10B981]/50 bg-[#10B981]/15 px-4 py-2 text-xs font-semibold text-[#6EE7B7] hover:bg-[#10B981]/25 cursor-pointer"
              >
                <RefreshCw className="h-3.5 w-3.5" />
                <span>लाइव वॉइस दोबारा कनेक्ट करें</span>
              </button>
            </div>
          )}
        </div>

        {/* Instant Conversation Starters */}
        <div className="mt-6 flex flex-wrap items-center justify-center gap-2 max-w-2xl">
          {[
            {
              label: `हाय NOVAAI! मैं ${userFirstName} हूँ`,
              prompt: `हाय NOVAAI! मैं ${user?.name || userFirstName} हूँ, कैसे हो आज?`,
            },
            ...QUICK_HINDI_PROMPTS.slice(1),
          ].map((item) => (
            <button
              key={item.label}
              type="button"
              onClick={() => void sendDirectPrompt(item.prompt)}
              className="rounded-xl border border-[#22312B] bg-[#111916] px-3.5 py-2 text-xs font-medium text-[#DCE6E1] transition-colors hover:border-[#10B981]/55 hover:bg-[#16221E] hover:text-white whitespace-nowrap cursor-pointer"
            >
              {item.label}
            </button>
          ))}
        </div>
      </main>

      {/* Bottom Unified Studio Dock (Camera, Image Snap, Optional Text Prompt, Transcript Download) */}
      <footer className="relative z-20 border-t border-[#1E2B26] bg-[#0B110F]/95 px-4 py-3 sm:px-6">
        <div className="mx-auto flex max-w-3xl flex-col gap-2.5">
          {attachedImage && (
            <div className="flex items-center justify-between rounded-xl border border-[#263831] bg-[#121B18] px-3 py-2">
              <div className="flex items-center gap-2.5">
                <img
                  src={attachedImage.previewUrl}
                  alt="Attached visual context"
                  referrerPolicy="no-referrer"
                  className="h-10 w-10 rounded-lg object-cover border border-[#2A3D35]"
                />
                <span className="text-xs text-[#C2CEC8]">
                  तस्वीर जुड़ गई है — अपना सवाल पूछें या भेजें
                </span>
              </div>
              <button
                type="button"
                onClick={() => setAttachedImage(null)}
                className="text-xs text-[#94A89E] hover:text-white cursor-pointer"
              >
                हटाएँ
              </button>
            </div>
          )}

          {showKeyboardInput && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                void sendDirectPrompt(textDraft);
              }}
              className="flex items-center gap-2"
            >
              <input
                type="text"
                value={textDraft}
                onChange={(e) => setTextDraft(e.target.value)}
                placeholder="यहाँ टाइप करके भी पूछ सकते हैं — NOVAAI अपनी नैचुरल हिंदी आवाज़ में बोलकर जवाब देगी..."
                className="h-10 flex-1 rounded-xl border border-[#263831] bg-[#121B18] px-3.5 text-sm text-[#F2F6F4] placeholder:text-[#6B8076] focus:border-[#10B981] focus:outline-none"
              />
              <button
                type="submit"
                disabled={!textDraft.trim() && !attachedImage}
                className="inline-flex h-10 items-center gap-1.5 rounded-xl bg-[#059669] px-4 text-xs font-semibold text-white transition-colors hover:bg-[#10B981] disabled:opacity-45 cursor-pointer"
              >
                <Send className="h-3.5 w-3.5" />
                <span>बोलकर सुनाओ</span>
              </button>
            </form>
          )}

          <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-[#8DA197]">
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => void handleToggleCamera()}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  cameraActive
                    ? 'border-[#10B981]/60 bg-[#10B981]/15 text-[#6EE7B7]'
                    : 'border-[#22312B] bg-[#111916] text-[#C2CEC8] hover:border-[#10B981]/45'
                }`}
              >
                {cameraActive ? (
                  <CameraOff className="h-3.5 w-3.5" />
                ) : (
                  <Camera className="h-3.5 w-3.5" />
                )}
                <span>{cameraActive ? 'Camera On' : 'Live Camera'}</span>
              </button>

              <input
                ref={fileInputRef}
                type="file"
                accept="image/*"
                onChange={handleAttachImage}
                className="hidden"
              />
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#22312B] bg-[#111916] px-3 font-medium text-[#C2CEC8] transition-colors hover:border-[#10B981]/45 whitespace-nowrap cursor-pointer"
              >
                <ImagePlus className="h-3.5 w-3.5" />
                <span>Photo</span>
              </button>

              <button
                type="button"
                onClick={() => setShowKeyboardInput((v) => !v)}
                className={`inline-flex h-9 items-center gap-1.5 rounded-xl border px-3 font-medium transition-colors whitespace-nowrap cursor-pointer ${
                  showKeyboardInput
                    ? 'border-[#C8956B]/60 bg-[#C8956B]/15 text-[#E8C3A3]'
                    : 'border-[#22312B] bg-[#111916] text-[#C2CEC8] hover:border-[#C8956B]/45'
                }`}
              >
                <Keyboard className="h-3.5 w-3.5" />
                <span>Type</span>
              </button>
            </div>

            <div className="flex items-center gap-2">
              {connecting && (
                <span className="inline-flex items-center gap-1.5 text-[#6EE7B7]">
                  <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  <span>Connecting...</span>
                </span>
              )}
              <button
                type="button"
                onClick={handleDownloadTranscript}
                className="inline-flex h-9 items-center gap-1.5 rounded-xl border border-[#22312B] bg-[#111916] px-3 font-medium text-[#C2CEC8] transition-colors hover:border-[#10B981]/45 whitespace-nowrap cursor-pointer"
              >
                <Download className="h-3.5 w-3.5" />
                <span>Save Transcript</span>
              </button>
            </div>
          </div>
        </div>
      </footer>

      {/* Collapsible Transcript Drawer */}
      <AnimatePresence>
        {drawerOpen && (
          <motion.aside
            initial={{ x: '100%' }}
            animate={{ x: 0 }}
            exit={{ x: '100%' }}
            transition={{ duration: 0.18, ease: [0.16, 1, 0.3, 1] }}
            className="fixed inset-y-0 right-0 z-40 flex w-full max-w-md flex-col border-l border-[#22312B] bg-[#0D1412] shadow-2xl"
          >
            <div className="flex items-center justify-between border-b border-[#22312B] px-4 py-3.5">
              <div>
                <h2 className="font-display text-sm font-bold text-[#F2F6F4]">
                  Live Conversation Transcript
                </h2>
                <p className="text-xs text-[#84998F] tabular-nums">
                  {turns.length} messages in this session
                </p>
              </div>
              <div className="flex items-center gap-1.5">
                {turns.length > 0 && (
                  <button
                    type="button"
                    onClick={() => setTurns([])}
                    className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#22312B] text-[#84998F] hover:text-[#FDA4AF] cursor-pointer"
                    title="Clear local view"
                  >
                    <Trash2 className="h-3.5 w-3.5" />
                  </button>
                )}
                <button
                  type="button"
                  onClick={() => setDrawerOpen(false)}
                  className="inline-flex h-8 w-8 items-center justify-center rounded-lg border border-[#22312B] text-[#C2CEC8] hover:text-white cursor-pointer"
                >
                  <X className="h-4 w-4" />
                </button>
              </div>
            </div>

            <div className="flex-1 overflow-y-auto p-4 space-y-3">
              {turns.length === 0 ? (
                <div className="py-12 text-center text-xs text-[#84998F]">
                  आपकी और NOVAAI की लाइव हिंदी बातचीत यहाँ दिखेगी।
                </div>
              ) : (
                turns.map((turn) => (
                  <div
                    key={turn.id}
                    className={`rounded-xl border p-3 text-sm ${
                      turn.sender === 'user'
                        ? 'ml-6 border-[#2A3B34] bg-[#131D19] text-[#E6EEEA]'
                        : 'mr-6 border-[#10B981]/30 bg-[#0F211B] text-[#ECFDF5]'
                    }`}
                  >
                    <div className="mb-1 flex items-center justify-between text-[11px] text-[#84998F] tabular-nums">
                      <span className="font-semibold text-[#6EE7B7]">
                        {turn.sender === 'user' ? userFirstName : 'NOVAAI'}
                      </span>
                      <span>{turn.timestamp}</span>
                    </div>
                    {turn.imagePreviewUrl && (
                      <img
                        src={turn.imagePreviewUrl}
                        alt="Shared snapshot"
                        referrerPolicy="no-referrer"
                        className="mb-2 h-28 w-full rounded-lg object-cover"
                      />
                    )}
                    <p className="leading-relaxed">{turn.text}</p>
                    {turn.sources && turn.sources.length > 0 && (
                      <div className="mt-2 border-t border-[#1E332B] pt-1.5 text-[11px] text-[#94A89E]">
                        {turn.sources.map((s) => s.title).join(' · ')}
                      </div>
                    )}
                  </div>
                ))
              )}
              <div ref={transcriptEndRef} />
            </div>
          </motion.aside>
        )}
      </AnimatePresence>
    </div>
  );
}
