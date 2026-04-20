// ════════════════════════════════════════════════════════════
//  BACKEND SERVICE — Frontend → Backend → AI APIs
//  When VITE_BACKEND_URL is set, all AI calls go through
//  the Express server (which hides keys from browser).
//  When not set, falls back to direct API calls.
// ════════════════════════════════════════════════════════════
import type { TaskType, GenerationStatus } from '../types';
import type { ImageResult } from './aiGateway/imagePipeline';

const BACKEND_URL = (import.meta.env.VITE_BACKEND_URL ?? '').trim();

/** Is the backend configured? */
export function isBackendEnabled(): boolean {
  return BACKEND_URL.length > 0;
}

export type OnStatus = (s: GenerationStatus) => void;

/**
 * Generate text via backend POST /api/ai/generate-text
 * Returns same shape as frontend gateway: { text, provider }
 */
export async function generateTextViaBackend(
  prompt:   string,
  taskType: TaskType | string,
  onStatus: OnStatus = () => {}
): Promise<{ text: string; provider: string }> {
  onStatus({ message: 'Sending to server…', provider: 'Backend' });

  const res = await fetch(`${BACKEND_URL}/api/ai/generate-text`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ prompt, taskType })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
    const msg = errData?.error || `Backend error: HTTP ${res.status}`;

    if (res.status === 400) throw new Error(msg);  // safety — no retry
    throw new Error(msg);
  }

  const data = await res.json() as { success: boolean; text: string; provider: string; error?: string };
  if (!data.text) throw new Error('Backend returned empty response');
  return { text: data.text, provider: data.provider || 'Backend' };
}

/**
 * Generate image via backend POST /api/ai/generate-image
 */
export async function generateImageViaBackend(
  prompt:   string,
  onStatus: OnStatus = () => {}
): Promise<ImageResult> {
  onStatus({ message: 'Requesting image from server…', provider: 'Backend' });

  const res = await fetch(`${BACKEND_URL}/api/ai/generate-image`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify({ prompt })
  });

  if (!res.ok) {
    const errData = await res.json().catch(() => ({ error: `HTTP ${res.status}` })) as { error?: string };
    throw new Error(errData?.error || `Backend image error: HTTP ${res.status}`);
  }

  const data = await res.json() as ImageResult & { error?: string };
  if (!data.description && !data.imageUrl) throw new Error('Backend returned empty image response');

  return {
    success:     data.success ?? true,
    imageUrl:    data.imageUrl ?? null,
    description: data.description ?? '',
    provider:    data.provider ?? 'Backend',
    mode:        data.mode ?? 'described',
    meta:        data.meta ?? {}
  };
}
