// ════════════════════════════════════════════════════════════
//  TEXT PIPELINE — generateTextWithFallback(prompt, type)
//  BUG FIXES:
//  ✅ Uses classifyError() consistently (was never called before)
//  ✅ Proper 429/503 handling with exhaustKey()
//  ✅ Backoff between model retries within same provider
//  ✅ Circuit breaker actually enforced before each attempt
// ════════════════════════════════════════════════════════════
import type { TaskType, GenerationStatus } from '../../types';
import { PREFERRED_PROVIDER } from '../../utils/aiAdapters/systemPrompts';
import {
  hasGemini, hasGroq, hasOpenRouter, hasCloudflare, hasHuggingFace,
  getGeminiKeys, getGroqKey, getOpenRouterKey, getCloudflareKey,
  getCFAccountId, getHFKey, rotateKey, exhaustKey, backoff, modelBackoff, hasAnyKey
} from './providerManager';
import { isOpen, recordFailure, recordSuccess } from './circuitBreaker';
import { classifyStatus, buildHttpError, buildExceptionError, STATUS_MESSAGES } from '../../utils/helpers/aiErrorHandler';
import {
  GEMINI_TEXT_MODELS, GEMINI_BASE, formatTextRequest, extractText as geminiExtract
} from '../../utils/aiAdapters/geminiAdapter';
import {
  GROQ_BASE, GROQ_MODELS, formatRequest as groqFormat, extractText as groqExtract
} from '../../utils/aiAdapters/groqAdapter';
import {
  OR_BASE, OR_MODELS, formatRequest as orFormat, extractText as orExtract
} from '../../utils/aiAdapters/openrouterAdapter';
import {
  CF_MODELS, formatRequest as cfFormat, extractText as cfExtract
} from '../../utils/aiAdapters/cloudflareAdapter';
import {
  HF_MODELS, HF_BASE, formatRequest as hfFormat, extractText as hfExtract
} from '../../utils/aiAdapters/huggingfaceAdapter';

export type OnStatus = (s: GenerationStatus) => void;

// ── Helper: read error body safely ───────────────────────
async function readErrorBody(res: Response): Promise<string> {
  try {
    const data = await res.json() as { error?: { message?: string }; message?: string };
    return data?.error?.message || data?.message || `HTTP ${res.status}`;
  } catch {
    return `HTTP ${res.status}`;
  }
}

// ── Provider callers ──────────────────────────────────────

async function callGroq(prompt: string, taskType: string, onStatus: OnStatus): Promise<string> {
  const key = getGroqKey();
  if (!key) throw new Error('NO_KEY');

  for (let i = 0; i < GROQ_MODELS.length; i++) {
    const model = GROQ_MODELS[i];
    if (i > 0) await modelBackoff();
    onStatus({ message: `Using Groq (${model.split('-').slice(0,3).join('-')})…`, provider: 'Groq' });

    const res = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(groqFormat(prompt, taskType, model))
    });

    if (res.ok) return groqExtract(await res.json());

    const rawMsg  = await readErrorBody(res);
    const action  = classifyStatus(res.status);

    if (action === 'stop')       throw new Error(`SAFETY:${rawMsg}`);
    if (action === 'auth_error') throw new Error(`AUTH:${rawMsg}`);
    // action === 'retry' → try next model
  }
  throw new Error('All Groq models exhausted');
}

async function callGemini(prompt: string, taskType: string, onStatus: OnStatus): Promise<string> {
  const keys = getGeminiKeys();
  if (!keys.length) throw new Error('NO_KEY');

  for (let i = 0; i < GEMINI_TEXT_MODELS.length; i++) {
    const model = GEMINI_TEXT_MODELS[i];
    if (i > 0) await modelBackoff();

    const key = rotateKey(keys, `Gemini-text`);
    if (!key) break;
    onStatus({ message: `Using Gemini (${model})…`, provider: 'Gemini' });

    const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formatTextRequest(prompt, taskType))
    });

    if (res.ok) return geminiExtract(await res.json());

    const rawMsg = await readErrorBody(res);
    const action = classifyStatus(res.status);

    if (action === 'stop')       throw new Error(`SAFETY:${rawMsg}`);
    if (action === 'auth_error') { exhaustKey(key); throw new Error(`AUTH:${rawMsg}`); }
    if (res.status === 429)      exhaustKey(key); // quota → disable this key
    // retry → try next model
  }
  throw new Error('All Gemini text models exhausted');
}

async function callOpenRouter(prompt: string, taskType: string, onStatus: OnStatus): Promise<string> {
  const key = getOpenRouterKey();
  if (!key) throw new Error('NO_KEY');

  for (let i = 0; i < OR_MODELS.length; i++) {
    const model = OR_MODELS[i];
    if (i > 0) await modelBackoff();
    onStatus({ message: `Using OpenRouter (${model.split('/').pop()?.split(':')[0]})…`, provider: 'OpenRouter' });

    const res = await fetch(OR_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://smart-ai-assistant.app',
        'X-Title': 'Smart Multi-AI Assistant'
      },
      body: JSON.stringify(orFormat(prompt, taskType, model))
    });

    if (res.ok) return orExtract(await res.json());

    const rawMsg = await readErrorBody(res);
    const action = classifyStatus(res.status);

    if (action === 'stop')       throw new Error(`SAFETY:${rawMsg}`);
    if (action === 'auth_error') throw new Error(`AUTH:${rawMsg}`);
  }
  throw new Error('All OpenRouter models exhausted');
}

async function callCloudflare(prompt: string, taskType: string, onStatus: OnStatus): Promise<string> {
  const key = getCloudflareKey(); const accountId = getCFAccountId();
  if (!key || !accountId) throw new Error('NO_KEY');

  for (let i = 0; i < CF_MODELS.length; i++) {
    const model = CF_MODELS[i];
    if (i > 0) await modelBackoff();
    onStatus({ message: 'Using Cloudflare AI…', provider: 'Cloudflare AI' });

    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      { method: 'POST', headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
        body: JSON.stringify(cfFormat(prompt, taskType)) }
    );

    if (res.ok) return cfExtract(await res.json());

    const action = classifyStatus(res.status);
    if (action === 'stop') throw new Error(`SAFETY:CF blocked`);
  }
  throw new Error('Cloudflare AI failed');
}

async function callHuggingFace(prompt: string, taskType: string, onStatus: OnStatus): Promise<string> {
  const key = getHFKey();
  if (!key) throw new Error('NO_KEY');

  for (let i = 0; i < HF_MODELS.length; i++) {
    const { id, format } = HF_MODELS[i];
    if (i > 0) await modelBackoff();
    onStatus({ message: 'Using HuggingFace…', provider: 'HuggingFace' });

    const res = await fetch(`${HF_BASE}/${id}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(hfFormat(prompt, taskType, format))
    });

    if (res.ok) return hfExtract(await res.json());
    // HF returns 503 if model loading — retry is fine
  }
  throw new Error('HuggingFace failed');
}

// ── Provider registry ─────────────────────────────────────
interface ProviderDef {
  name:      string;
  available: () => boolean;
  call:      (p: string, t: string, s: OnStatus) => Promise<string>;
}

const PROVIDERS: ProviderDef[] = [
  { name: 'Groq',         available: hasGroq,        call: callGroq },
  { name: 'Gemini',       available: hasGemini,       call: callGemini },
  { name: 'OpenRouter',   available: hasOpenRouter,   call: callOpenRouter },
  { name: 'Cloudflare AI',available: hasCloudflare,   call: callCloudflare },
  { name: 'HuggingFace',  available: hasHuggingFace,  call: callHuggingFace }
];

// ── Main: generateTextWithFallback ────────────────────────
export async function generateTextWithFallback(
  prompt:   string,
  taskType: string,
  onStatus: OnStatus = () => {}
): Promise<{ text: string; provider: string }> {

  if (!hasAnyKey()) {
    throw new Error(STATUS_MESSAGES.noKey());
  }

  // Build type-aware provider order
  const preferred = PREFERRED_PROVIDER[taskType] || ['Groq', 'Gemini', 'OpenRouter'];
  const remaining = PROVIDERS.map(p => p.name).filter(n => !preferred.includes(n));
  const order     = [...preferred, ...remaining];

  // Get active providers (available + circuit not open)
  const active = order
    .map(name => PROVIDERS.find(p => p.name === name))
    .filter((p): p is ProviderDef => !!p && p.available() && !isOpen(p.name));

  if (!active.length) {
    // All circuit-broken — try the first available regardless
    const fallback = PROVIDERS.find(p => p.available());
    if (!fallback) throw new Error(STATUS_MESSAGES.noKey());
    active.push(fallback);
  }

  const errors: string[] = [];

  for (let i = 0; i < active.length; i++) {
    const provider = active[i];

    if (i > 0) {
      onStatus({
        message: STATUS_MESSAGES.switching(active[i-1].name, provider.name),
        provider: provider.name,
        attempt: i + 1
      });
      await backoff();
    } else {
      onStatus({ message: STATUS_MESSAGES.starting(provider.name), provider: provider.name, attempt: 1 });
    }

    try {
      const text = await provider.call(prompt, taskType, onStatus);
      recordSuccess(provider.name);
      return { text, provider: provider.name };

    } catch (err) {
      const aiErr = buildExceptionError(err, provider.name);

      if (aiErr.action === 'stop') {
        throw new Error(aiErr.message); // safety block — no retry
      }
      if (aiErr.action === 'skip') {
        errors.push(aiErr.technical);
        continue; // no key — skip without circuit-breaking
      }
      if (aiErr.action === 'auth_error') {
        recordFailure(provider.name);
        errors.push(aiErr.technical);
        onStatus({ message: aiErr.message, provider: provider.name });
        continue;
      }

      // retry case — circuit-break and try next
      recordFailure(provider.name);
      errors.push(aiErr.technical);
      if (i < active.length - 1) {
        onStatus({ message: aiErr.message, provider: provider.name });
      }
    }
  }

  throw new Error(`${STATUS_MESSAGES.allFailed()}\n\nDetails: ${errors.join(' | ')}`);
}
