// ════════════════════════════════════════════════════════════
//  GEMINI ADAPTER — format request, extract response
//  Supports both text generation and image generation models.
// ════════════════════════════════════════════════════════════
import { SYSTEM_PROMPTS } from './systemPrompts';

export const GEMINI_TEXT_MODELS  = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

// Image generation model cascade:
// 1. gemini-2.0-flash-exp-image-generation — experimental image gen (returns actual images)
// 2. gemini-2.0-flash — capable text model (describes images as text fallback)
// 3. gemini-1.5-flash — final text fallback
export const GEMINI_IMAGE_MODELS = [
  'gemini-2.0-flash-exp-image-generation',  // primary image generation
  'gemini-2.0-flash',                        // text fallback — describe image
  'gemini-1.5-flash'                         // final text fallback
];

export const GEMINI_BASE = 'https://generativelanguage.googleapis.com/v1beta/models';

export function formatTextRequest(prompt: string, taskType: string, temperature = 0.8) {
  const sys = SYSTEM_PROMPTS[taskType] || SYSTEM_PROMPTS.general;
  return {
    contents: [{ parts: [{ text: `${sys}\n\nUser Request:\n${prompt}` }] }],
    generationConfig: { temperature, maxOutputTokens: 1500, topK: 40, topP: 0.95 }
  };
}

export function formatImageRequest(prompt: string) {
  return {
    contents: [{ parts: [{ text: prompt }] }],
    generationConfig: {
      responseModalities: ['TEXT', 'IMAGE'],
      temperature: 0.9
    }
  };
}

interface GeminiResponse {
  candidates?: Array<{
    content?: { parts?: Array<{ text?: string; inlineData?: { mimeType: string; data: string } }> };
    finishReason?: string;
  }>;
  promptFeedback?: { blockReason?: string };
}

export function extractText(data: unknown): string {
  const d = data as GeminiResponse;
  if (d?.promptFeedback?.blockReason) {
    throw new Error(`SAFETY:Content blocked by Gemini: ${d.promptFeedback.blockReason}`);
  }
  const parts = d?.candidates?.[0]?.content?.parts ?? [];
  // Find the first text part (skip image parts)
  for (const part of parts) {
    if (part.text?.trim()) return part.text.trim();
  }
  throw new Error('Empty response from Gemini');
}

export function extractImageData(data: unknown): string | null {
  const d = data as GeminiResponse;
  if (d?.promptFeedback?.blockReason) {
    throw new Error(`SAFETY:Image blocked: ${d.promptFeedback.blockReason}`);
  }
  const parts = d?.candidates?.[0]?.content?.parts ?? [];
  for (const part of parts) {
    if (part.inlineData?.data) {
      return `data:${part.inlineData.mimeType};base64,${part.inlineData.data}`;
    }
  }
  return null; // no image data — model returned text only
}
