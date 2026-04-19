// ════════════════════════════════════════════════════════════
//  CIRCUIT BREAKER — Prevents hammering dead providers
//  Each provider gets disabled for COOLDOWN_MS on failure.
//  Auto-resets after cooldown period.
// ════════════════════════════════════════════════════════════

const COOLDOWN_MS = 60_000; // 60 seconds

interface BreakerState {
  isOpen: boolean;
  openedAt: number;
  failCount: number;
}

const states = new Map<string, BreakerState>();

export function isOpen(provider: string): boolean {
  const s = states.get(provider);
  if (!s || !s.isOpen) return false;
  if (Date.now() - s.openedAt > COOLDOWN_MS) {
    // Auto-reset after cooldown
    states.set(provider, { isOpen: false, openedAt: 0, failCount: 0 });
    return false;
  }
  return true;
}

export function recordFailure(provider: string): void {
  const s = states.get(provider) ?? { isOpen: false, openedAt: 0, failCount: 0 };
  const failCount = s.failCount + 1;
  states.set(provider, { isOpen: true, openedAt: Date.now(), failCount });
  console.warn(`[CircuitBreaker] ${provider} tripped (fail #${failCount}). Cooldown 60s.`);
}

export function recordSuccess(provider: string): void {
  states.set(provider, { isOpen: false, openedAt: 0, failCount: 0 });
}

export function resetAll(): void {
  states.clear();
}

export function getStatus(): Record<string, BreakerState & { retryAfterMs: number }> {
  const result: Record<string, BreakerState & { retryAfterMs: number }> = {};
  states.forEach((s, name) => {
    const retryAfterMs = s.isOpen
      ? Math.max(0, COOLDOWN_MS - (Date.now() - s.openedAt))
      : 0;
    result[name] = { ...s, retryAfterMs };
  });
  return result;
}
