export function TypingDots() {
  return (
    <div className="typing-dots">
      <div className="typing-dot" />
      <div className="typing-dot" />
      <div className="typing-dot" />
    </div>
  );
}

export function AIThinkingBox({ status, provider }: { status: string; provider?: string }) {
  return (
    <div className="ai-live-output">
      <div className="ai-thinking">
        <div className="ai-loading-icon">🤖</div>
        <TypingDots />
        <div className="thinking-text">{status || 'AI is thinking…'}</div>
        {provider && (
          <div className="thinking-sub">Processing with {provider}…</div>
        )}
      </div>
    </div>
  );
}
