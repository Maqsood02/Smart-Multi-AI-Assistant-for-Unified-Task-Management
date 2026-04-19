// ════════════════════════════════════════════════════════════
//  TEXT PIPELINE — generateTextWithFallback(prompt, type)
//  Routing: type-aware provider priority (see systemPrompts)
//  Fallback: circuit-broken providers auto-skipped
//  Error handling: centralized via aiErrorHandler
// ════════════════════════════════════════════════════════════
import type { TaskType, GenerationStatus } from '../../types';
import { PREFERRED_PROVIDER } from '../../utils/aiAdapters/systemPrompts';
import {
  hasGemini, hasGroq, hasOpenRouter, hasCloudflare, hasHuggingFace,
  getGeminiKeys, getGroqKey, getOpenRouterKey, getCloudflareKey,
  getCFAccountId, getHFKey, rotateKey, backoff, hasAnyKey, disableKey
} from './providerManager';
import { isOpen, recordFailure, recordSuccess } from './circuitBreaker';
import { GEMINI_TEXT_MODELS, GEMINI_BASE, formatTextRequest, extractText as geminiExtract } from '../../utils/aiAdapters/geminiAdapter';
import { GROQ_BASE, GROQ_MODELS, formatRequest as groqFormat, extractText as groqExtract } from '../../utils/aiAdapters/groqAdapter';
import { OR_BASE, OR_MODELS, formatRequest as orFormat, extractText as orExtract } from '../../utils/aiAdapters/openrouterAdapter';
import { CF_MODELS, formatRequest as cfFormat, extractText as cfExtract } from '../../utils/aiAdapters/cloudflareAdapter';
import { HF_MODELS, HF_BASE, formatRequest as hfFormat, extractText as hfExtract } from '../../utils/aiAdapters/huggingfaceAdapter';
import { TASK_TEMPERATURE } from '../../utils/aiAdapters/systemPrompts';
import { classifyHttpStatus, getUserMessage, getSwitchMessage, getFailMessage } from '../../utils/helpers/aiErrorHandler';

export type OnStatus = (s: GenerationStatus) => void;

// ── Individual provider callers ───────────────────────────

async function callGroq(prompt: string, taskType: string, onStatus: OnStatus): Promise<string> {
  const key = getGroqKey();
  if (!key) throw new Error('NO_KEY');
  for (const model of GROQ_MODELS) {
    onStatus({ message: `Trying Groq (${model.split('-').slice(0,3).join('-')})…`, provider: 'Groq' });
    const res = await fetch(GROQ_BASE, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify(groqFormat(prompt, taskType, model))
    });
    if (res.ok) return groqExtract(await res.json());

    const action = classifyHttpStatus(res.status);
    if (action === 'stop') {
      const errData = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(`SAFETY:${errData?.error?.message || 'Bad request'}`);
    }
    if (res.status === 429) {
      onStatus({ message: getUserMessage('rate_limited'), provider: 'Groq' });
    }
    // 429/500/503 → try next model
  }
  throw new Error('All Groq models failed');
}

async function callGemini(prompt: string, taskType: string, onStatus: OnStatus): Promise<string> {
  const keys = getGeminiKeys();
  if (!keys.length) throw new Error('NO_KEY');
  const temp = TASK_TEMPERATURE[taskType] ?? 0.8;
  for (const model of GEMINI_TEXT_MODELS) {
    const key = rotateKey(keys, 'Gemini');
    onStatus({ message: `Trying Gemini (${model})…`, provider: 'Gemini' });
    const res = await fetch(`${GEMINI_BASE}/${model}:generateContent?key=${key}`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(formatTextRequest(prompt, taskType, temp))
    });
    if (res.ok) return geminiExtract(await res.json());

    const action = classifyHttpStatus(res.status);
    if (action === 'stop') {
      const errData = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(`SAFETY:${errData?.error?.message || 'Blocked'}`);
    }
    // 429 → disable this specific key
    if (res.status === 429) {
      disableKey(key);
      onStatus({ message: getUserMessage('rate_limited'), provider: 'Gemini' });
    }
    // 429/503 → try next model
  }
  throw new Error('All Gemini models failed');
}

async function callOpenRouter(prompt: string, taskType: string, onStatus: OnStatus): Promise<string> {
  const key = getOpenRouterKey();
  if (!key) throw new Error('NO_KEY');
  for (const model of OR_MODELS) {
    onStatus({ message: `Trying OpenRouter (${model.split('/').pop()?.split(':')[0]})…`, provider: 'OpenRouter' });
    const res = await fetch(OR_BASE, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json', 'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://smart-ai-assistant.app', 'X-Title': 'Smart Multi-AI Assistant'
      },
      body: JSON.stringify(orFormat(prompt, taskType, model))
    });
    if (res.ok) return orExtract(await res.json());

    const action = classifyHttpStatus(res.status);
    if (action === 'stop') {
      const errData = await res.json().catch(() => ({})) as { error?: { message?: string } };
      throw new Error(`SAFETY:${errData?.error?.message || 'Blocked'}`);
    }
  }
  throw new Error('All OpenRouter models failed');
}

async function callCloudflare(prompt: string, taskType: string, onStatus: OnStatus): Promise<string> {
  const key = getCloudflareKey(); const accountId = getCFAccountId();
  if (!key || !accountId) throw new Error('NO_KEY');
  for (const model of CF_MODELS) {
    onStatus({ message: 'Trying Cloudflare AI…', provider: 'Cloudflare AI' });
    const res = await fetch(
      `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
      { method:'POST', headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
        body: JSON.stringify(cfFormat(prompt, taskType)) }
    );
    if (res.ok) return cfExtract(await res.json());

    const action = classifyHttpStatus(res.status);
    if (action === 'stop') throw new Error('SAFETY:Cloudflare blocked the request');
  }
  throw new Error('Cloudflare AI failed');
}

async function callHuggingFace(prompt: string, taskType: string, onStatus: OnStatus): Promise<string> {
  const key = getHFKey();
  if (!key) throw new Error('NO_KEY');
  for (const { id, format } of HF_MODELS) {
    onStatus({ message: 'Trying HuggingFace…', provider: 'HuggingFace' });
    const res = await fetch(`${HF_BASE}/${id}`, {
      method:'POST',
      headers:{'Content-Type':'application/json','Authorization':`Bearer ${key}`},
      body: JSON.stringify(hfFormat(prompt, taskType, format))
    });
    if (res.ok) return hfExtract(await res.json());

    const action = classifyHttpStatus(res.status);
    if (action === 'stop') throw new Error('SAFETY:HuggingFace blocked the request');
  }
  throw new Error('HuggingFace failed');
}

// ── Provider definitions ──────────────────────────────────
interface TextProvider {
  name:      string;
  available: () => boolean;
  call:      (p: string, t: string, s: OnStatus) => Promise<string>;
}

const ALL_PROVIDERS: TextProvider[] = [
  { name: 'Groq',         available: hasGroq,        call: callGroq },
  { name: 'Gemini',       available: hasGemini,       call: callGemini },
  { name: 'OpenRouter',   available: hasOpenRouter,   call: callOpenRouter },
  { name: 'Cloudflare AI',available: hasCloudflare,   call: callCloudflare },
  { name: 'HuggingFace',  available: hasHuggingFace,  call: callHuggingFace }
];

function getProviderByName(name: string): TextProvider | undefined {
  return ALL_PROVIDERS.find(p => p.name === name);
}

// ── Main: generateTextWithFallback ────────────────────────
export async function generateTextWithFallback(
  prompt:   string,
  taskType: string,
  onStatus: OnStatus = () => {}
): Promise<{ text: string; provider: string }> {

  if (!hasAnyKey()) {
    throw new Error('NO_KEY:No AI API keys configured. Please add at least one key in ⚙️ Settings.');
  }

  // Build ordered provider list: type-preferred first, then rest
  const preferred = PREFERRED_PROVIDER[taskType] || ['Groq', 'Gemini', 'OpenRouter'];
  const rest      = ALL_PROVIDERS.map(p => p.name).filter(n => !preferred.includes(n));
  const order     = [...preferred, ...rest];

  // Filter: available + not circuit-broken
  const active = order
    .map(name => getProviderByName(name))
    .filter((p): p is TextProvider => !!p && p.available() && !isOpen(p.name));

  if (!active.length) {
    // All broken — force reset and retry with first available
    const fallback = ALL_PROVIDERS.find(p => p.available());
    if (!fallback) throw new Error('NO_KEY:No available AI providers.');
    active.push(fallback);
  }

  const errors: string[] = [];

  for (let i = 0; i < active.length; i++) {
    const provider = active[i];

    if (i > 0) {
      onStatus({
        message: getSwitchMessage(active[i-1].name, provider.name),
        provider: provider.name, attempt: i + 1
      });
      await backoff();
    } else {
      onStatus({ message: `Starting with ${provider.name}…`, provider: provider.name, attempt: 1 });
    }

    try {
      const text = await provider.call(prompt, taskType, onStatus);
      recordSuccess(provider.name);
      return { text, provider: provider.name };
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';

      // Safety block — stop immediately
      if (msg.startsWith('SAFETY:')) {
        throw new Error(msg.replace('SAFETY:', ''));
      }
      // No key — skip but don't circuit-break
      if (msg === 'NO_KEY') {
        errors.push(`${provider.name}: no key`);
        continue;
      }

      recordFailure(provider.name);
      errors.push(`${provider.name}: ${msg.slice(0, 60)}`);
      onStatus({
        message: getFailMessage(provider.name, 'Trying next…'),
        provider: provider.name, attempt: i + 1
      });
    }
  }

  throw new Error(`All AI providers failed.\n${errors.join(' | ')}`);
}
