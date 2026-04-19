// ════════════════════════════════════════════════════════════
//  PROVIDER MANAGER — Key detection, availability, rotation
//  Reads from localStorage (user keys) then .env (dev keys)
//  Supports per-key circuit breaking for Gemini multi-key rotation.
// ════════════════════════════════════════════════════════════

/** Read a key from localStorage first, then env */
export function readKey(storageKey: string, envKey: string): string {
  try {
    const fromStorage = localStorage.getItem(storageKey)?.trim() || '';
    if (fromStorage.length > 10) return fromStorage;
  } catch { /* ssr / privacy mode */ }
  return (import.meta.env[envKey] ?? '').trim();
}

/** Parse comma-separated Gemini keys, return array */
export function getGeminiKeys(): string[] {
  const fromStorage = readKey('smai_gemini_key', 'VITE_GEMINI_KEYS');
  // also try multi-key env var
  const envMulti = (import.meta.env.VITE_GEMINI_KEYS ?? '').trim();
  const combined = [fromStorage, envMulti].join(',');
  return combined
    .split(',')
    .map(k => k.trim())
    .filter(k => k.length > 10);
}

export function getGroqKey():        string { return readKey('smai_groq_key', 'VITE_GROQ_KEY'); }
export function getOpenRouterKey():  string { return readKey('smai_or_key',   'VITE_OPENROUTER_KEY'); }
export function getCloudflareKey():  string { return readKey('smai_cf_key',   'VITE_CLOUDFLARE_KEY'); }
export function getCFAccountId():    string {
  // Check localStorage first, then env
  try {
    const fromStorage = localStorage.getItem('smai_cf_account')?.trim() || '';
    if (fromStorage.length > 5) return fromStorage;
  } catch { /* */ }
  return (import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID ?? '').trim();
}
export function getHFKey():          string { return readKey('smai_hf_key',   'VITE_HF_KEY'); }

export function hasGemini():      boolean { return getGeminiKeys().length > 0; }
export function hasGroq():        boolean { return getGroqKey().length > 10; }
export function hasOpenRouter():  boolean { return getOpenRouterKey().length > 10; }
export function hasCloudflare():  boolean { return getCloudflareKey().length > 10 && getCFAccountId().length > 0; }
export function hasHuggingFace(): boolean { return getHFKey().length > 10; }

export function getAvailableProviders(): string[] {
  const list: string[] = [];
  if (hasGroq())        list.push('Groq');
  if (hasGemini())      list.push('Gemini');
  if (hasOpenRouter())  list.push('OpenRouter');
  if (hasCloudflare())  list.push('Cloudflare AI');
  if (hasHuggingFace()) list.push('HuggingFace');
  return list;
}

export function hasAnyKey(): boolean { return getAvailableProviders().length > 0; }

// ── Per-key circuit breaker ────────────────────────────────
const KEY_COOLDOWN_MS = 60_000; // 60 seconds

interface KeyState {
  disabledUntil: number;
  failCount: number;
}

const keyStates = new Map<string, KeyState>();

/** Mark a specific key as failing — disable it for 60s */
export function disableKey(key: string): void {
  const existing = keyStates.get(key);
  const failCount = (existing?.failCount ?? 0) + 1;
  keyStates.set(key, {
    disabledUntil: Date.now() + KEY_COOLDOWN_MS,
    failCount
  });
  // Log only first 8 chars for safety
  console.warn(`[KeyRotation] Key ${key.slice(0, 8)}… disabled for 60s (fail #${failCount})`);
}

/** Check if a specific key is currently disabled */
export function isKeyDisabled(key: string): boolean {
  const state = keyStates.get(key);
  if (!state) return false;
  if (Date.now() > state.disabledUntil) {
    // Cooldown expired — re-enable
    keyStates.delete(key);
    return false;
  }
  return true;
}

/** Reset a specific key's failure state */
export function resetKey(key: string): void {
  keyStates.delete(key);
}

/** Round-robin index per provider, skipping disabled keys */
const keyIndexes: Record<string, number> = {};

export function rotateKey(keys: string[], provider: string): string {
  if (!keys.length) return '';

  // Filter out disabled keys
  const available = keys.filter(k => !isKeyDisabled(k));

  // If all keys are disabled, force-use the first one (last resort)
  if (!available.length) {
    console.warn(`[KeyRotation] All ${provider} keys disabled, forcing first key`);
    return keys[0];
  }

  const idx = (keyIndexes[provider] ?? 0) % available.length;
  keyIndexes[provider] = idx + 1;
  return available[idx];
}

/** Classify HTTP error: retry = try next provider, stop = abort */
export function classifyError(status: number): 'retry' | 'stop' | 'auth' {
  if (status === 400)              return 'stop';   // safety / bad request — don't retry
  if (status === 401 || status === 403) return 'auth';   // auth error
  if ([429, 500, 502, 503, 504].includes(status)) return 'retry';
  return 'retry';
}

/** 800–1200ms backoff with ±300ms random jitter */
export function backoff(): Promise<void> {
  const base = 800 + Math.random() * 400;     // 800–1200ms
  const jitter = (Math.random() - 0.5) * 600; // ±300ms
  const ms = Math.max(200, base + jitter);     // never below 200ms
  return new Promise(r => setTimeout(r, ms));
}
