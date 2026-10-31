import { useCallback, useEffect, useRef, useState } from 'react';
import {
  playServerAudioBase64,
  stopAllLivePlayback,
  subscribeLivePlaybackState,
  unlockLiveAudioEngine,
} from '../lib/liveAudioEngine.ts';
import { chatApi } from '../services/api.ts';

interface SpeechRecognitionInstance {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: any) => void) | null;
  onerror: ((event: any) => void) | null;
  onend: (() => void) | null;
  start: () => void;
  stop: () => void;
}

const LANGUAGE_TO_BCP47: Record<string, string> = {
  auto: 'hi-IN',
  English: 'en-US',
  Hindi: 'hi-IN',
  Hinglish: 'en-IN',
  Spanish: 'es-ES',
  French: 'fr-FR',
  German: 'de-DE',
  Arabic: 'ar-SA',
  Bengali: 'bn-IN',
  Tamil: 'ta-IN',
  Japanese: 'ja-JP',
};

export function useSpeech(selectedLanguage: string) {
  const [isListening, setIsListening] = useState(false);
  const [speakingMessageId, setSpeakingMessageId] = useState<
    string | number | null
  >(null);
  const recognitionRef = useRef<SpeechRecognitionInstance | null>(null);
  const ttsAbortRef = useRef<AbortController | null>(null);
  const pendingFetchRef = useRef(false);

  const speechSupported =
    typeof window !== 'undefined' &&
    Boolean(
      (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition
    );

  const ttsSupported = typeof window !== 'undefined';

  useEffect(() => {
    const unsub = subscribeLivePlaybackState((playing) => {
      if (!playing && !pendingFetchRef.current) {
        setSpeakingMessageId(null);
      }
    });
    return () => {
      unsub();
      recognitionRef.current?.stop();
      ttsAbortRef.current?.abort();
      stopAllLivePlayback();
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  const startVoiceInput = useCallback(
    (onTranscript: (text: string) => void, onError?: (msg: string) => void) => {
      const RecognitionCtor =
        (window as any).SpeechRecognition ||
        (window as any).webkitSpeechRecognition;
      if (!RecognitionCtor) {
        onError?.('Voice input is not supported in this browser.');
        return;
      }

      if (isListening) {
        recognitionRef.current?.stop();
        setIsListening(false);
        return;
      }

      const recognition: SpeechRecognitionInstance = new RecognitionCtor();
      recognition.continuous = false;
      recognition.interimResults = true;
      recognition.lang = LANGUAGE_TO_BCP47[selectedLanguage] || 'hi-IN';

      let finalTranscript = '';

      recognition.onresult = (event: any) => {
        let interim = '';
        for (let i = event.resultIndex; i < event.results.length; i++) {
          const transcript = event.results[i][0].transcript;
          if (event.results[i].isFinal) {
            finalTranscript += transcript;
          } else {
            interim += transcript;
          }
        }
        onTranscript((finalTranscript || interim).trim());
      };

      recognition.onerror = (event: any) => {
        setIsListening(false);
        if (
          event?.error &&
          event.error !== 'no-speech' &&
          event.error !== 'aborted'
        ) {
          onError?.(`Microphone error: ${event.error}`);
        }
      };

      recognition.onend = () => {
        setIsListening(false);
      };

      recognitionRef.current = recognition;
      setIsListening(true);
      try {
        recognition.start();
      } catch {
        setIsListening(false);
      }
    },
    [isListening, selectedLanguage]
  );

  const stopVoiceInput = useCallback(() => {
    recognitionRef.current?.stop();
    setIsListening(false);
  }, []);

  const toggleSpeakText = useCallback(
    (id: string | number, rawMarkdown: string) => {
      if (!ttsSupported) return;

      if (speakingMessageId === id) {
        ttsAbortRef.current?.abort();
        pendingFetchRef.current = false;
        stopAllLivePlayback();
        if ('speechSynthesis' in window) {
          window.speechSynthesis.cancel();
        }
        setSpeakingMessageId(null);
        return;
      }

      ttsAbortRef.current?.abort();
      stopAllLivePlayback();
      if ('speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }

      const plainText = rawMarkdown
        .replace(/```[\s\S]*?```/g, ' ')
        .replace(/[#*_`>~-]/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 1800);

      if (!plainText) return;

      // Unlock WebAudio synchronously inside user click gesture
      void unlockLiveAudioEngine();

      const controller = new AbortController();
      ttsAbortRef.current = controller;
      pendingFetchRef.current = true;
      setSpeakingMessageId(id);

      void (async () => {
        try {
          const res = await chatApi.synthesizeSpeech(
            {
              text: plainText,
              voiceName: 'Zephyr',
              voiceTone: 'Pyari',
            },
            controller.signal
          );
          pendingFetchRef.current = false;
          if (controller.signal.aborted) return;

          if (res.audioBase64) {
            const started = await playServerAudioBase64(res.audioBase64);
            if (started) return;
          }
        } catch {
          pendingFetchRef.current = false;
          if (controller.signal.aborted) return;
        }

        // Fallback to browser SpeechSynthesis only if server TTS is unavailable
        if ('speechSynthesis' in window) {
          const utterance = new SpeechSynthesisUtterance(plainText);
          const hasDevanagari = /[\u0900-\u097F]/.test(plainText);
          utterance.lang = hasDevanagari
            ? 'hi-IN'
            : LANGUAGE_TO_BCP47[selectedLanguage] || 'en-IN';
          utterance.pitch = 1.18;
          utterance.rate = 0.98;
          utterance.onend = () => setSpeakingMessageId(null);
          utterance.onerror = () => setSpeakingMessageId(null);
          window.speechSynthesis.speak(utterance);
        } else {
          setSpeakingMessageId(null);
        }
      })();
    },
    [selectedLanguage, speakingMessageId, ttsSupported]
  );

  return {
    speechSupported,
    ttsSupported,
    isListening,
    speakingMessageId,
    startVoiceInput,
    stopVoiceInput,
    toggleSpeakText,
  };
}
