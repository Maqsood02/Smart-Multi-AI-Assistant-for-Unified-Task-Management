// ════════════════════════════════════════════════════════════
//  SERVER-SIDE AI GATEWAY
//  Mirrors the frontend fallback chain but runs server-side
//  so API keys are NEVER exposed to the browser.
//
//  Text:  Groq → Gemini → OpenRouter → Cloudflare → HuggingFace
//  Image: Gemini → Cloudflare → HuggingFace → Text Fallback
//
//  Supports:
//  - Multiple Gemini keys with rotation
//  - Circuit breaker per provider
//  - Backoff with jitter between attempts
//  - Proper error classification (400=stop, 429/500/503=retry)
// ════════════════════════════════════════════════════════════

// ── System prompts ────────────────────────────────────────
const SYSTEM_PROMPTS = {
  content:     'You are an expert content writer. Write engaging, high-quality, well-structured content. Be detailed, professional, and creative. Use clear headings and formatting.',
  code:        'You are a senior software developer. Write clean, production-ready, well-commented code. First briefly explain what the code does, then provide the complete implementation.',
  image:       'You are a creative AI art director. Describe in vivid detail how the requested image would look — composition, colors, lighting, style, and mood. Then provide 3 optimized prompts for Midjourney, DALL-E 3, and Stable Diffusion.',
  task:        'You are an expert project manager. Break the request into numbered, actionable steps with clear ownership, priority levels (HIGH/MED/LOW), and estimated time.',
  story:       'You are a creative fiction writer. Write an engaging, well-structured short story (400–600 words). Include vivid descriptions, natural dialogue, and a satisfying narrative arc.',
  summary:     'You are an expert at summarizing information. Produce a concise, accurate summary: Key Points as bullet points, then an Overall Summary in 2-3 sentences.',
  imageSummary:'You are an expert image analyst. Analyze the described image in detail: identify objects, text, people, emotions, colors, composition.',
  codeCheck:   'You are a senior code reviewer and security expert. Report: 1) Syntax Errors, 2) Logic Errors, 3) Security Issues, 4) Performance Issues, 5) Best Practice Violations.',
  humanize:    'You are an expert editor. Transform robotic AI text into natural, warm, human-sounding writing. Maintain original meaning.',
  grammar:     'You are a professional grammar editor. Fix all grammar, spelling, punctuation, and style issues. Provide corrected text then list corrections.',
  general:     'You are a highly capable, helpful AI assistant. Answer accurately, concisely, and helpfully.'
};

function getPrompt(taskType) {
  return SYSTEM_PROMPTS[taskType] || SYSTEM_PROMPTS.general;
}

// ── Circuit breaker ────────────────────────────────────────
const COOLDOWN_MS = 60000;
const breakerStates = {};

function isProviderOpen(name) {
  const s = breakerStates[name];
  if (!s || !s.isOpen) return false;
  if (Date.now() - s.openedAt > COOLDOWN_MS) {
    delete breakerStates[name];
    return false;
  }
  return true;
}

function recordProviderFailure(name) {
  const s = breakerStates[name] || { isOpen: false, openedAt: 0, failCount: 0 };
  s.isOpen = true;
  s.openedAt = Date.now();
  s.failCount++;
  breakerStates[name] = s;
  console.warn(`[CircuitBreaker] ${name} tripped (fail #${s.failCount})`);
}

function recordProviderSuccess(name) {
  delete breakerStates[name];
}

// ── Key rotation ───────────────────────────────────────────
const keyIndexes = {};

function getGeminiKeys() {
  const keys = (process.env.GEMINI_KEY || process.env.GEMINI_KEYS || '').trim();
  return keys.split(',').map(k => k.trim()).filter(k => k.length > 10);
}

function rotateKey(keys, provider) {
  if (!keys.length) return '';
  const idx = (keyIndexes[provider] || 0) % keys.length;
  keyIndexes[provider] = idx + 1;
  return keys[idx];
}

// ── Backoff with jitter ────────────────────────────────────
function backoff() {
  const base = 800 + Math.random() * 400;
  const jitter = (Math.random() - 0.5) * 600;
  const ms = Math.max(200, base + jitter);
  return new Promise(r => setTimeout(r, ms));
}

// ── Error classification ──────────────────────────────────
function isRetryable(status) { return [429, 500, 502, 503, 504].includes(status); }
function isStop(status)      { return status === 400; }

// ── Provider: Gemini ──────────────────────────────────────
async function tryGemini(prompt, taskType) {
  const keys = getGeminiKeys();
  if (!keys.length) throw new Error('NO_KEY: GEMINI_KEY not set');

  const MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];
  const BASE   = 'https://generativelanguage.googleapis.com/v1beta/models';

  for (const model of MODELS) {
    const key = rotateKey(keys, 'Gemini');
    const res = await fetch(`${BASE}/${model}:generateContent?key=${key}`, {
      method:  'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        contents: [{ parts: [{ text: `${getPrompt(taskType)}\n\nRequest: ${prompt}` }] }],
        generationConfig: { temperature: 0.8, maxOutputTokens: 1500 }
      })
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
      if (text) {
        recordProviderSuccess('Gemini');
        return { text, provider: `Gemini (${model})` };
      }
    }
    if (isStop(res.status)) throw new Error(`SAFETY:Gemini safety block`);
    // 429/500/503 → try next model
  }
  throw new Error('All Gemini models failed');
}

// ── Provider: Groq ────────────────────────────────────────
async function tryGroq(prompt, taskType) {
  const key = process.env.GROQ_KEY || '';
  if (!key) throw new Error('NO_KEY: GROQ_KEY not set');

  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

  for (const model of models) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method:  'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: getPrompt(taskType) },
          { role: 'user',   content: prompt }
        ],
        temperature: 0.8, max_tokens: 1500
      })
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) {
        recordProviderSuccess('Groq');
        return { text, provider: `Groq (${model})` };
      }
    }
    if (isStop(res.status)) throw new Error('SAFETY:Groq blocked the request');
  }
  throw new Error('All Groq models failed');
}

// ── Provider: OpenRouter ──────────────────────────────────
async function tryOpenRouter(prompt, taskType) {
  const key = process.env.OPENROUTER_KEY || '';
  if (!key) throw new Error('NO_KEY: OPENROUTER_KEY not set');

  const models = ['meta-llama/llama-3.3-70b-instruct:free', 'meta-llama/llama-3.1-8b-instruct:free'];

  for (const model of models) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method:  'POST',
      headers: {
        'Content-Type':  'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer':  'https://smart-ai-assistant.app',
        'X-Title':       'Smart Multi-AI Assistant'
      },
      body: JSON.stringify({
        model,
        messages: [
          { role: 'system', content: getPrompt(taskType) },
          { role: 'user',   content: prompt }
        ],
        max_tokens: 1500
      })
    });
    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) {
        recordProviderSuccess('OpenRouter');
        return { text, provider: 'OpenRouter' };
      }
    }
    if (isStop(res.status)) throw new Error('SAFETY:OpenRouter blocked the request');
  }
  throw new Error('All OpenRouter models failed');
}

// ── Provider: Cloudflare ──────────────────────────────────
async function tryCloudflare(prompt, taskType) {
  const key = process.env.CLOUDFLARE_KEY || '';
  const accountId = process.env.CLOUDFLARE_ACCOUNT_ID || '';
  if (!key || !accountId) throw new Error('NO_KEY: CLOUDFLARE_KEY not set');

  const model = '@cf/meta/llama-3.1-8b-instruct';
  const res = await fetch(
    `https://api.cloudflare.com/client/v4/accounts/${accountId}/ai/run/${model}`,
    {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        messages: [
          { role: 'system', content: getPrompt(taskType) },
          { role: 'user', content: prompt }
        ],
        max_tokens: 1200
      })
    }
  );
  if (!res.ok) throw new Error(`Cloudflare HTTP ${res.status}`);
  const data = await res.json();
  const text = data?.result?.response?.trim();
  if (!text) throw new Error('Empty Cloudflare response');
  recordProviderSuccess('Cloudflare');
  return { text, provider: 'Cloudflare AI' };
}

// ── Provider: HuggingFace ─────────────────────────────────
async function tryHuggingFace(prompt, taskType) {
  const key = process.env.HF_KEY || '';
  if (!key) throw new Error('NO_KEY: HF_KEY not set');

  const model = 'mistralai/Mistral-7B-Instruct-v0.2';
  const sys = getPrompt(taskType);
  const res = await fetch(`https://api-inference.huggingface.co/models/${model}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
    body: JSON.stringify({
      inputs: `<s>[INST] ${sys}\n\n${prompt} [/INST]`,
      parameters: { max_new_tokens: 1000, temperature: 0.8, return_full_text: false }
    })
  });
  if (!res.ok) throw new Error(`HuggingFace HTTP ${res.status}`);
  const data = await res.json();
  const text = Array.isArray(data) ? data[0]?.generated_text?.trim() : undefined;
  if (!text) throw new Error('Empty HuggingFace response');
  recordProviderSuccess('HuggingFace');
  return { text, provider: 'HuggingFace' };
}

// ── Main generate function with fallback chain ────────────
exports.generate = async (prompt, taskType = 'general') => {
  const chain = [
    { name: 'Groq',         fn: tryGroq },
    { name: 'Gemini',       fn: tryGemini },
    { name: 'OpenRouter',   fn: tryOpenRouter },
    { name: 'Cloudflare',   fn: tryCloudflare },
    { name: 'HuggingFace',  fn: tryHuggingFace }
  ];

  const errors = [];

  for (let i = 0; i < chain.length; i++) {
    const { name, fn } = chain[i];

    // Skip circuit-broken providers
    if (isProviderOpen(name)) {
      errors.push(`${name}: circuit breaker open`);
      continue;
    }

    // Backoff between provider switches
    if (i > 0) await backoff();

    try {
      return await fn(prompt, taskType);
    } catch (err) {
      if (err.message?.startsWith('NO_KEY')) {
        errors.push(err.message);
        continue;
      }
      if (err.message?.startsWith('SAFETY')) throw err;

      recordProviderFailure(name);
      errors.push(`${name}: ${err.message}`);
    }
  }

  throw new Error(`All AI providers failed: ${errors.join(' | ')}`);
};

// ── Image generation (text description via AI) ────────────
exports.generateImage = async (prompt) => {
  // Server-side image gen uses Gemini image model if available,
  // falls back to text description
  const keys = getGeminiKeys();
  if (keys.length) {
    try {
      const key = rotateKey(keys, 'Gemini-Image');
      const res = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash-exp-image-generation:generateContent?key=${key}`,
        {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            contents: [{ parts: [{ text: prompt }] }],
            generationConfig: { responseModalities: ['TEXT', 'IMAGE'], temperature: 0.9 }
          })
        }
      );
      if (res.ok) {
        const data = await res.json();
        const parts = data?.candidates?.[0]?.content?.parts || [];
        for (const part of parts) {
          if (part.inlineData?.data) {
            return {
              success: true,
              imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
              description: parts.find(p => p.text)?.text || 'Image generated by Gemini AI',
              provider: 'Gemini',
              mode: 'generated'
            };
          }
        }
      }
    } catch { /* fall through to text */ }
  }

  // Fallback: generate description
  const { text, provider } = await exports.generate(
    `You are an AI art director. Describe this image in vivid detail and provide optimized prompts for Midjourney, DALL-E 3, and Stable Diffusion: ${prompt}`,
    'image'
  );
  return {
    success: true,
    imageUrl: null,
    description: text,
    provider: `${provider} (Text)`,
    mode: 'described'
  };
};
