// ════════════════════════════════════════════════════════════
//  GEMINI ADAPTER
//  Text models: gemini-2.0-flash → gemini-1.5-flash → gemini-1.5-flash-8b
//  Image models: gemini-2.0-flash-exp-image-generation (only real free model)
//  NOTE: gemini-3.1, gemini-2.5 do NOT exist yet in the API.
// ════════════════════════════════════════════════════════════
import { SYSTEM_PROMPTS, TASK_TEMPERATURE, TASK_MAX_TOKENS } from './systemPrompts';

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

/** Text generation model cascade (all free tier) */
export const GEMINI_TEXT_MODELS = [
  'gemini-2.0-flash',
  'gemini-1.5-flash',
  'gemini-1.5-flash-8b'
];

/**
 * Image generation cascade.
 * gemini-2.0-flash-exp-image-generation: experimental, sometimes returns base64 image
 * gemini-2.0-flash: fallback — returns text description only
 * (No gemini-2.5 or 3.x exists yet — spec model names are aspirational/future)
 */
export const GEMINI_IMAGE_MODELS = [
  'gemini-2.0-flash-exp-image-generation',
  'gemini-2.0-flash'
];

/** Format a text generation request */
export function formatTextRequest(prompt: string, taskType: string) {
  const sys      = SYSTEM_PROMPTS[taskType] || SYSTEM_PROMPTS.general;
  const temp     = TASK_TEMPERATURE[taskType] ?? 0.75;
  const maxTok   = TASK_MAX_TOKENS[taskType] ?? 1500;
  return {
    contents: [{ parts: [{ text: `${sys}\n\nUser Request:\n${prompt}` }] }],
    generationConfig: {
      temperature:     temp,
      maxOutputTokens: maxTok,
      topK:  40,
      topP:  0.95
    }
  };
}

/** Format an image generation request */
export function formatImageRequest(prompt: string) {
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0.9,
      maxOutputTokens: 2048
    }
  };
}

interface GeminiCandidate {
  content?: { parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> };
  finishReason?: string;
}

interface GeminiResponse {
  candidates?: GeminiCandidate[];
  promptFeedback?: { blockReason?: string };
  error?: { code?: number; message?: string };
}

/** Extract text from a Gemini text response */
export function extractText(data: unknown): string {
  const d = data as GeminiResponse;

  if (d?.promptFeedback?.blockReason) {
    throw new Error(`SAFETY:${d.promptFeedback.blockReason}`);
  }
  if (d?.error?.message) {
    throw new Error(`GEMINI_API:${d.error.message}`);
  }

  // Try all parts for text
  const parts = d?.candidates?.[0]?.content?.parts ?? [];
  const text  = parts.map(p => p.text || '').join('').trim();
  if (!text) throw new Error('Empty response from Gemini');
  return text;
}

/** Extract image data URL from a Gemini image response. Returns null if no image. */
export function extractImageData(data: unknown): string | null {
  const d = data as GeminiResponse;

  if (d?.promptFeedback?.blockReason) {
    throw new Error(`SAFETY:${d.promptFeedback.blockReason}`);
  }

  const parts = d?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data && part.inlineData.mimeType) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  return null; // Model returned text only (common on free tier)
}

/** Extract any text that came along with image response */
export function extractImageText(data: unknown): string {
  const d = data as GeminiResponse;
  const parts = d?.candidates?.[0]?.content?.parts ?? [];
  return parts.map(p => p.text || '').join('').trim();
}
