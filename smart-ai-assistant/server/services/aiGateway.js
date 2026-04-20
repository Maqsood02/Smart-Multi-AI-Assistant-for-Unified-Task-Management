'use strict';
// ════════════════════════════════════════════════════════════
//  SERVER-SIDE AI GATEWAY — Mirrors frontend fallback chain
//  Keys come from server .env — never sent to browser.
//  Requires Node.js 18+ (native fetch).
// ════════════════════════════════════════════════════════════

if (!globalThis.fetch) {
  console.error('[Server] FATAL: Native fetch unavailable. Requires Node.js 18+.');
  console.error('[Server] Alternative: npm install node-fetch and add: global.fetch = require("node-fetch")');
  process.exit(1);
}

// ── System prompts ────────────────────────────────────────
const SYSTEM_PROMPTS = {
  content:     'You are an expert content writer. Write engaging, high-quality, well-structured content with clear headings.',
  code:        'You are a senior software developer. Write clean, well-commented, production-ready code. Explain briefly, then provide implementation.',
  task:        'You are an expert project manager. Break requests into numbered, actionable steps with priorities (HIGH/MED/LOW) and time estimates.',
  story:       'You are a creative fiction writer. Write an engaging short story (400-600 words) with vivid descriptions, dialogue, and a satisfying arc.',
  summary:     'You are an expert summarizer. Produce: (1) Key Points — 5-7 bullets, (2) Overall Summary — 2-3 sentences.',
  codeCheck:   'You are a senior code reviewer. Report: 1) Syntax Errors, 2) Logic Errors, 3) Security Issues, 4) Performance Problems. Show fixes.',
  humanize:    'Transform robotic AI text into natural, warm, human-sounding writing. Keep meaning, vary sentences, remove AI clichés.',
  grammar:     'Fix all grammar, spelling, and punctuation. Show corrected text then list main corrections.',
  analysis:    'Provide thorough structured analysis with: key findings, evidence, implications, and conclusion.',
  image:       'You are a creative AI art director. Describe the image vividly then provide prompts for Midjourney, DALL-E, and Stable Diffusion.',
  imageSummary:'Analyze the described image in detail: objects, people, colors, composition, emotions, and what it represents.',
  general:     'You are a helpful AI assistant. Answer accurately and concisely with clear structure.'
};

// ── Models ────────────────────────────────────────────────
const TEXT_MODELS = {
  gemini:     ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'],
  groq:       ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant', 'mixtral-8x7b-32768'],
  openrouter: ['meta-llama/llama-3.3-70b-instruct:free', 'meta-llama/llama-3.1-8b-instruct:free', 'google/gemma-3-27b-it:free']
};

const IMAGE_MODELS = {
  gemini: ['gemini-2.0-flash-exp-image-generation', 'gemini-2.0-flash'],
  cf:     ['@cf/stabilityai/stable-diffusion-xl-base-1.0'],
  hf:     ['stabilityai/stable-diffusion-2-1', 'runwayml/stable-diffusion-v1-5']
};

// ── Error classification ──────────────────────────────────
function classifyStatus(status) {
  if (status === 400) return 'stop';
  if (status === 401 || status === 403) return 'auth';
  if ([429, 500, 502, 503, 504].includes(status)) return 'retry';
  return 'retry';
}

// ── Read error body safely ────────────────────────────────
async function readErr(res) {
  try {
    const d = await res.json();
    return d?.error?.message || d?.message || `HTTP ${res.status}`;
  } catch { return `HTTP ${res.status}`; }
}

// ── TEXT PROVIDERS ────────────────────────────────────────

async function tryGeminiText(prompt, taskType) {
  const key = process.env.GEMINI_KEY || '';
  if (!key) throw new Error('NO_KEY:GEMINI_KEY not set');

  const sys = SYSTEM_PROMPTS[taskType] || SYSTEM_PROMPTS.general;

  for (const model of TEXT_MODELS.gemini) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: `${sys}\n\nUser Request:\n${prompt}` }] }],
          generationConfig: { temperature: 0.75, maxOutputTokens: 1500 }
        })
      }
    );

    if (res.ok) {
      const data = await res.json();
      if (data?.promptFeedback?.blockReason) throw new Error(`SAFETY:${data.promptFeedback.blockReason}`);
      const text = data?.candidates?.[0]?.content?.parts?.map(p => p.text || '').join('').trim();
      if (text) return { text, provider: `Gemini (${model})` };
    }

    const action = classifyStatus(res.status);
    const msg    = await readErr(res);
    if (action === 'stop') throw new Error(`SAFETY:${msg}`);
    if (action === 'auth') throw new Error(`AUTH:${msg}`);
    // retry → next model
  }
  throw new Error('All Gemini text models failed');
}

async function tryGroqText(prompt, taskType) {
  const key = process.env.GROQ_KEY || '';
  if (!key) throw new Error('NO_KEY:GROQ_KEY not set');

  const sys = SYSTEM_PROMPTS[taskType] || SYSTEM_PROMPTS.general;

  for (const model of TEXT_MODELS.groq) {
    const res = await fetch('https://api.groq.com/openai/v1/chat/completions', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', 'Authorization': `Bearer ${key}` },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
        temperature: 0.75,
        max_tokens: 1500
      })
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return { text, provider: `Groq (${model})` };
    }

    const action = classifyStatus(res.status);
    const msg    = await readErr(res);
    if (action === 'stop') throw new Error(`SAFETY:${msg}`);
    if (action === 'auth') throw new Error(`AUTH:${msg}`);
  }
  throw new Error('All Groq models failed');
}

async function tryOpenRouterText(prompt, taskType) {
  const key = process.env.OPENROUTER_KEY || '';
  if (!key) throw new Error('NO_KEY:OPENROUTER_KEY not set');

  const sys = SYSTEM_PROMPTS[taskType] || SYSTEM_PROMPTS.general;

  for (const model of TEXT_MODELS.openrouter) {
    const res = await fetch('https://openrouter.ai/api/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${key}`,
        'HTTP-Referer': 'https://smart-ai-assistant.app',
        'X-Title': 'Smart Multi-AI Assistant'
      },
      body: JSON.stringify({
        model,
        messages: [{ role: 'system', content: sys }, { role: 'user', content: prompt }],
        max_tokens: 1500,
        temperature: 0.75
      })
    });

    if (res.ok) {
      const data = await res.json();
      const text = data?.choices?.[0]?.message?.content?.trim();
      if (text) return { text, provider: `OpenRouter (${model.split('/').pop()})` };
    }

    const action = classifyStatus(res.status);
    const msg    = await readErr(res);
    if (action === 'stop') throw new Error(`SAFETY:${msg}`);
    if (action === 'auth') throw new Error(`AUTH:${msg}`);
  }
  throw new Error('All OpenRouter models failed');
}

// ── IMAGE PROVIDERS ───────────────────────────────────────

async function tryGeminiImage(prompt) {
  const key = process.env.GEMINI_KEY || '';
  if (!key) return null;

  for (const model of IMAGE_MODELS.gemini) {
    const res = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${key}`,
      {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          contents: [{ parts: [{ text: prompt }] }],
          generationConfig: { responseModalities: ['TEXT', 'IMAGE'], temperature: 0.9 }
        })
      }
    );

    if (!res.ok) {
      if (res.status === 400) throw new Error('SAFETY:Image blocked');
      continue;
    }

    const data  = await res.json();
    if (data?.promptFeedback?.blockReason) throw new Error(`SAFETY:${data.promptFeedback.blockReason}`);
    const parts = data?.candidates?.[0]?.content?.parts ?? [];

    // Check for base64 image
    for (const part of parts) {
      if (part.inlineData?.data) {
        return {
          success: true,
          imageUrl: `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`,
          description: parts.map(p => p.text || '').join('').trim() || 'Image generated by Gemini',
          provider: `Gemini (${model})`,
          mode: 'generated',
          meta: { model }
        };
      }
    }

    // Text description returned (free tier)
    const text = parts.map(p => p.text || '').join('').trim();
    if (text) {
      return {
        success: true, imageUrl: null,
        description: text, provider: `Gemini (${model})`,
        mode: 'described', meta: { model, note: 'text-only' }
      };
    }
  }
  return null;
}

function buildImageDescription(prompt) {
  return {
    success: true,
    imageUrl: null,
    description: [
      `🎨 Image Concept: "${prompt}"`,
      '',
      '📐 Visual Description:',
      `A stunning composition depicting ${prompt}. Cinematic lighting, rich contrast, atmospheric and immersive.`,
      '',
      '🖼️ AI Art Prompts:',
      `▶ Midjourney: /imagine prompt: ${prompt}, highly detailed, 8k, cinematic lighting --ar 16:9 --v 6`,
      `▶ DALL-E 3: Create a high-quality, detailed image of ${prompt} with cinematic composition.`,
      `▶ Stable Diffusion: ${prompt}, masterpiece, best quality, ultra detailed, photorealistic, 8k`,
      '',
      '💡 Add Cloudflare or HuggingFace keys for actual image generation on the server.'
    ].join('\n'),
    provider: 'Built-in Fallback',
    mode: 'described',
    meta: { fallback: true }
  };
}

// ── MAIN EXPORTS ──────────────────────────────────────────

/**
 * Text generation: Groq → Gemini → OpenRouter
 */
exports.generate = async (prompt, taskType = 'general') => {
  const chain   = [tryGroqText, tryGeminiText, tryOpenRouterText];
  const errors  = [];

  for (const fn of chain) {
    try {
      return await fn(prompt, taskType);
    } catch (err) {
      const msg = err.message || '';
      if (msg.startsWith('SAFETY:') || msg.startsWith('AUTH:')) throw err;
      if (msg.startsWith('NO_KEY:')) { errors.push(msg); continue; }
      errors.push(msg.slice(0, 80));
    }
  }
  throw new Error(`All AI providers failed: ${errors.join(' | ')}`);
};

/**
 * Image generation: Gemini → text description fallback
 */
exports.generateImage = async (prompt) => {
  try {
    const result = await tryGeminiImage(prompt);
    if (result) return result;
  } catch (err) {
    if (err.message?.startsWith('SAFETY:')) throw err;
  }
  return buildImageDescription(prompt);
};
