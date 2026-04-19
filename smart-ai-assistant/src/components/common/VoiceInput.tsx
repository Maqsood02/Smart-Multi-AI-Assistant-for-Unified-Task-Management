// ════════════════════════════════════════════════════════════
//  VOICE INPUT — Mic button + status indicator
//  Uses the useSpeechToText hook internally.
//  Fixed: transcript appends to existing text, not replaces.
// ════════════════════════════════════════════════════════════
import { useEffect, useRef } from 'react';
import { useSpeechToText } from '../../utils/voice/speechToText';

interface VoiceInputProps {
  onTranscript: (text: string) => void;   // called with new transcript text
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const { transcript, isListening, isSupported, error, startListening, stopListening } = useSpeechToText();
  const lastTranscriptRef = useRef('');

  // Push transcript to parent whenever it changes (only the new part)
  useEffect(() => {
    if (transcript && transcript !== lastTranscriptRef.current) {
      lastTranscriptRef.current = transcript;
      onTranscript(transcript);
    }
  }, [transcript, onTranscript]);

  // Reset ref when listening starts
  useEffect(() => {
    if (isListening) {
      lastTranscriptRef.current = '';
    }
  }, [isListening]);

  if (!isSupported) {
    return (
      <span
        title="Voice input not supported in this browser (use Chrome/Edge)"
        style={{ opacity: 0.35, cursor: 'not-allowed', fontSize: 18 }}
      >
        🎤
      </span>
    );
  }

  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
      {error && (
        <span style={{ fontSize: 11, color: '#f87171', maxWidth: 160 }}>{error}</span>
      )}
      <button
        type="button"
        className={`voice-btn ${isListening ? 'listening' : ''}`}
        title={isListening ? 'Click to stop recording' : 'Click to speak'}
        disabled={disabled}
        onClick={isListening ? stopListening : startListening}
      >
        {isListening ? '⏹' : '🎤'}
        {isListening && <span className="voice-pulse" />}
      </button>
    </div>
  );
}

// ── Standalone voice textarea wrapper ──────────────────────
interface VoiceTextareaProps {
  value: string;
  onChange: (val: string) => void;
  placeholder?: string;
  rows?: number;
  disabled?: boolean;
  className?: string;
  label?: string;
}

export function VoiceTextarea({
  value, onChange, placeholder, rows = 5, disabled, className, label
}: VoiceTextareaProps) {
  // Append voice transcript to current value instead of replacing
  const handleTranscript = (transcript: string) => {
    const currentVal = value.trim();
    if (currentVal) {
      // Append with a space separator
      onChange(currentVal + ' ' + transcript);
    } else {
      onChange(transcript);
    }
  };

  return (
    <div className="voice-textarea-wrap">
      {label && (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 7 }}>
          <label style={{ fontSize: 13, fontWeight: 600, color: 'var(--text2)' }}>{label}</label>
          <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
            <span style={{ fontSize: 11, color: 'var(--text3)' }}>or speak</span>
            <VoiceInput onTranscript={handleTranscript} disabled={disabled} />
          </div>
        </div>
      )}
      <textarea
        className={`form-control ${className || ''}`}
        value={value}
        rows={rows}
        placeholder={placeholder}
        disabled={disabled}
        onChange={e => onChange(e.target.value)}
      />
    </div>
  );
}
