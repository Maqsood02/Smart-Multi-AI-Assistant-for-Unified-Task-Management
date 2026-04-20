// ════════════════════════════════════════════════════════════
//  VOICE INPUT — Web Speech API hook (FIXED)
// ════════════════════════════════════════════════════════════
import { useState, useRef, useCallback, useEffect } from 'react';

declare global {
  interface Window {
    SpeechRecognition: typeof SpeechRecognition;
    webkitSpeechRecognition: typeof SpeechRecognition;
  }
}

export interface UseSpeechToTextReturn {
  transcript: string;
  isListening: boolean;
  isSupported: boolean;
  error: string;
  startListening: () => void;
  stopListening: () => void;
  clearTranscript: () => void;
}

export function useSpeechToText(): UseSpeechToTextReturn {
  const [transcript, setTranscript] = useState('');
  const [isListening, setIsListening] = useState(false);
  const [error, setError] = useState('');

  const recognitionRef = useRef<SpeechRecognition | null>(null);

  // ✅ FIX: persistent final transcript (prevents duplication)
  const finalTranscriptRef = useRef('');

  const SpeechRecognitionAPI =
    typeof window !== 'undefined'
      ? window.SpeechRecognition || window.webkitSpeechRecognition
      : null;

  const isSupported = !!SpeechRecognitionAPI;

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setIsListening(false);
  }, []);

  const startListening = useCallback(() => {
    if (!SpeechRecognitionAPI) {
      setError('Voice input is not supported in this browser. Please use Chrome or Edge.');
      return;
    }

    setError('');
    setTranscript('');
    finalTranscriptRef.current = ''; // ✅ reset properly

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let interim = '';

      for (let i = event.resultIndex; i < event.results.length; i++) {
        const text = event.results[i][0].transcript;

        if (event.results[i].isFinal) {
          // ✅ only add final ONCE
          finalTranscriptRef.current += text + ' ';
        } else {
          // ✅ interim should NOT accumulate
          interim = text;
        }
      }

      // ✅ replace transcript instead of appending
      setTranscript(finalTranscriptRef.current + interim);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      const messages: Record<string, string> = {
        'not-allowed': 'Microphone access denied. Please allow microphone in browser settings.',
        'no-speech': 'No speech detected. Try speaking closer to the microphone.',
        'network': 'Network error during voice recognition.',
        'audio-capture': 'No microphone found. Please connect a microphone.',
        'aborted': ''
      };

      const msg = messages[event.error] ?? `Voice error: ${event.error}`;
      if (msg) setError(msg);

      setIsListening(false);
    };

    recognition.onend = () => setIsListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [SpeechRecognitionAPI]);

  const clearTranscript = useCallback(() => {
    setTranscript('');
    finalTranscriptRef.current = ''; // ✅ also clear stored final
  }, []);

  useEffect(() => {
    return () => {
      recognitionRef.current?.stop();
    };
  }, []);

  return {
    transcript,
    isListening,
    isSupported,
    error,
    startListening,
    stopListening,
    clearTranscript
  };
}