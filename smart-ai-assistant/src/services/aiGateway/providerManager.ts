// ════════════════════════════════════════════════════════════
//  PROVIDER MANAGER
//  - Key detection (localStorage priority → .env fallback)
//  - Gemini key rotation with per-key circuit breaking
//  - Backoff with jitter
//  - Error classification (BUG FIX: classifyError now actually used)
// ════════════════════════════════════════════════════════════
import { classifyStatus, type ErrorAction } from '../../utils/helpers/aiErrorHandler';

// ── Key readers ───────────────────────────────────────────
export function readKey(storageKey: string, envKey: string): string {
  try {
    const v = localStorage.getItem(storageKey)?.trim() || '';
    if (v.length > 10) return v;
  } catch { /* SSR / private browsing */ }
  return (import.meta.env[envKey] ?? '').trim();
}

export function getGeminiKeys(): string[] {
  try {
    const fromStorage = localStorage.getItem('smai_gemini_key')?.trim() || '';
    const fromEnv     = (import.meta.env.VITE_GEMINI_KEYS ?? '').trim();
    const combined    = [fromStorage, fromEnv].join(',');
    return combined.split(',').map(k => k.trim()).filter(k => k.length > 10);
  } catch {
    return (import.meta.env.VITE_GEMINI_KEYS ?? '')
      .split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 10);
  }
}

export function getGroqKey():        string { return readKey('smai_groq_key', 'VITE_GROQ_KEY'); }
export function getOpenRouterKey():  string { return readKey('smai_or_key',   'VITE_OPENROUTER_KEY'); }
export function getCloudflareKey():  string { return readKey('smai_cf_key',   'VITE_CLOUDFLARE_KEY'); }
export function getCFAccountId():    string { return (import.meta.env.VITE_CLOUDFLARE_ACCOUNT_ID ?? '').trim(); }
export function getHFKey():          string { return readKey('smai_hf_key',   'VITE_HF_KEY'); }

// ── Availability checks ───────────────────────────────────
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

// ── Per-key circuit breaker for Gemini key rotation ──────
const KEY_COOLDOWN = 90_000; // 90s for exhausted keys
const exhaustedKeys = new Map<string, number>(); // key → exhaustedAt

function isKeyExhausted(key: string): boolean {
  const t = exhaustedKeys.get(key);
  if (!t) return false;
  if (Date.now() - t > KEY_COOLDOWN) { exhaustedKeys.delete(key); return false; }
  return true;
}

function markKeyExhausted(key: string): void {
  exhaustedKeys.set(key, Date.now());
  console.warn(`[KeyRotation] Key ${key.slice(0,12)}… exhausted. Cooldown 90s.`);
}

/** Rotate through Gemini keys, skipping exhausted ones */
const keyIndexes: Record<string, number> = {};

export function rotateKey(keys: string[], provider: string): string {
  const available = keys.filter(k => !isKeyExhausted(k));
  if (!available.length) {
    // All keys exhausted — reset and use first (give it another chance)
    exhaustedKeys.clear();
    return keys[0] || '';
  }
  const idx = (keyIndexes[provider] ?? 0) % available.length;
  keyIndexes[provider] = idx + 1;
  return available[idx];
}

/** Called when a key gets 429 → temporarily disable it */
export function exhaustKey(key: string): void {
  markKeyExhausted(key);
}

// ── Error classification (now actually exported for use everywhere) ──
export { classifyStatus as classifyError } from '../../utils/helpers/aiErrorHandler';
export type { ErrorAction };

// ── Backoff with jitter (800–1300ms) ─────────────────────
export function backoff(baseMs = 900): Promise<void> {
  const ms = baseMs + (Math.random() * 400 - 200); // ±200ms jitter
  return new Promise(r => setTimeout(r, Math.max(600, ms)));
}

/** Shorter backoff between models within same provider (300–600ms) */
export function modelBackoff(): Promise<void> {
  const ms = 300 + Math.random() * 300;
  return new Promise(r => setTimeout(r, ms));
}
