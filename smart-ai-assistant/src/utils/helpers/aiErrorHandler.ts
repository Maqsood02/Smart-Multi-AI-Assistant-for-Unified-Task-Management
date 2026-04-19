// ════════════════════════════════════════════════════════════
//  AI ERROR HANDLER — Centralized error utility
//  Classifies HTTP errors, generates user-friendly messages,
//  and provides a structured AIError class.
// ════════════════════════════════════════════════════════════

/** Classify HTTP status into an action category */
export type ErrorAction = 'stop' | 'retry' | 'auth';

export function classifyHttpStatus(status: number): ErrorAction {
  if (status === 400) return 'stop';           // safety / invalid input — don't retry
  if (status === 401 || status === 403) return 'auth'; // auth error
  if ([429, 500, 502, 503, 504].includes(status)) return 'retry'; // retryable
  return 'retry'; // unknown → try next
}

/** Check if an HTTP status is retryable (429, 500, 503) */
export function isRetryableStatus(status: number): boolean {
  return [429, 500, 502, 503, 504].includes(status);
}

/** Check if an HTTP status should stop immediately (400 = safety/invalid) */
export function isStopStatus(status: number): boolean {
  return status === 400;
}

// ── User-friendly messages ──────────────────────────────────

export type StatusContext =
  | 'switching'
  | 'blocked'
  | 'exhausted'
  | 'starting'
  | 'retrying'
  | 'rate_limited'
  | 'server_error'
  | 'no_key';

const USER_MESSAGES: Record<StatusContext, string> = {
  starting:     '🚀 Starting AI generation…',
  switching:    '🔄 Primary AI busy, switching to backup…',
  retrying:     '⏳ Retrying with next provider…',
  blocked:      '🚫 Request blocked due to safety policy.',
  exhausted:    '❌ All AI providers exhausted. Please try again later.',
  rate_limited: '⏱ Rate limited. Waiting before retry…',
  server_error: '⚠️ Server error. Trying backup provider…',
  no_key:       '🔑 No API key configured. Please add a key in ⚙️ Settings.',
};

export function getUserMessage(context: StatusContext, extra?: string): string {
  const base = USER_MESSAGES[context] || 'Processing…';
  return extra ? `${base} ${extra}` : base;
}

/** Generate a status message for provider switching */
export function getSwitchMessage(fromProvider: string, toProvider: string): string {
  return `${fromProvider} unavailable. Switching to ${toProvider}…`;
}

/** Generate a status message for provider failure */
export function getFailMessage(provider: string, reason?: string): string {
  const base = `${provider} failed.`;
  return reason ? `${base} ${reason}` : `${base} Trying next…`;
}

// ── Structured error class ──────────────────────────────────

export class AIError extends Error {
  public readonly provider: string;
  public readonly status: number;
  public readonly retryable: boolean;
  public readonly action: ErrorAction;

  constructor(
    message: string,
    provider: string,
    status: number = 0,
    retryable: boolean = false
  ) {
    super(message);
    this.name = 'AIError';
    this.provider = provider;
    this.status = status;
    this.retryable = retryable;
    this.action = status ? classifyHttpStatus(status) : (retryable ? 'retry' : 'stop');
  }

  /** Was this a safety/content policy block? */
  get isSafetyBlock(): boolean {
    return this.message.startsWith('SAFETY:') || this.status === 400;
  }

  /** User-safe error message (strips internal prefixes) */
  get userMessage(): string {
    if (this.isSafetyBlock) return getUserMessage('blocked');
    if (this.status === 429) return getUserMessage('rate_limited');
    if (this.status >= 500) return getUserMessage('server_error');
    return this.message.replace('SAFETY:', '').replace('NO_KEY:', '');
  }
}

// ── Helper: wrap raw fetch errors into AIError ──────────────

export function wrapFetchError(err: unknown, provider: string): AIError {
  if (err instanceof AIError) return err;
  const msg = err instanceof Error ? err.message : 'Unknown error';

  // Safety block
  if (msg.startsWith('SAFETY:')) {
    return new AIError(msg, provider, 400, false);
  }
  // No key
  if (msg === 'NO_KEY' || msg.startsWith('NO_KEY:')) {
    return new AIError(msg, provider, 0, false);
  }
  // Generic
  return new AIError(msg, provider, 0, true);
}
