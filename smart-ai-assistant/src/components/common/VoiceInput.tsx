// ════════════════════════════════════════════════════════════
//  VOICE INPUT — Mic button + status indicator
//  Uses the useSpeechToText hook internally
// ════════════════════════════════════════════════════════════
import { useEffect } from 'react';
import { useSpeechToText } from '../../utils/voice/speechToText';

interface VoiceInputProps {
  onTranscript: (text: string) => void;   // called with final transcript
  disabled?: boolean;
}

export function VoiceInput({ onTranscript, disabled }: VoiceInputProps) {
  const { transcript, isListening, isSupported, error, startListening, stopListening } = useSpeechToText();

  // Push transcript to parent whenever it updates
  useEffect(() => {
    if (transcript) onTranscript(transcript);
  }, [transcript, onTranscript]);

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
  const handleTranscript = (t: string) => onChange(t);

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
