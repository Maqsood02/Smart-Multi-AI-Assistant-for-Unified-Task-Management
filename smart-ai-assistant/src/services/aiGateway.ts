// ════════════════════════════════════════════════════════════
//  AI GATEWAY — Public API
//  Re-exports the correct pipeline for each request type.
//  Callers use these functions, not individual services.
// ════════════════════════════════════════════════════════════
export { generateTextWithFallback }  from './aiGateway/textPipeline';
export { generateImageWithFallback } from './aiGateway/imagePipeline';
export { getAvailableProviders, hasAnyKey as getAnyKeyAvailable } from './aiGateway/providerManager';
export { getStatus as getCircuitStatus, resetAll as resetCircuits } from './aiGateway/circuitBreaker';

import { generateTextWithFallback } from './aiGateway/textPipeline';
import type { TaskType, GenerationStatus } from '../types';

/** Backward-compatible wrapper used across pages */
export async function generateWithFallback(
  prompt:   string,
  taskType: TaskType | string,
  onStatus?: (s: GenerationStatus) => void
): Promise<{ text: string; provider: string }> {
  return generateTextWithFallback(prompt, taskType, onStatus ?? (() => {}));
}
