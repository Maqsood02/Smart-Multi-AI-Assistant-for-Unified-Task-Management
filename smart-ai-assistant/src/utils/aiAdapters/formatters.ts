// Re-exports for backward compatibility
export { SYSTEM_PROMPTS, TASK_TEMPERATURE, PREFERRED_PROVIDER } from './systemPrompts';
export { formatTextRequest as formatGeminiRequest, extractText as extractGeminiText } from './geminiAdapter';
export { formatRequest as formatOpenAIRequest, extractText as extractOpenAIText } from './groqAdapter';
export { formatRequest as formatCloudflareRequest, extractText as extractCloudflareText } from './cloudflareAdapter';
export { formatRequest as formatHuggingFaceRequest, extractText as extractHuggingFaceText } from './huggingfaceAdapter';

export function classifyHttpError(status: number): 'retry' | 'stop' | 'fatal' {
  if (status === 400) return 'stop';
  if (status === 401 || status === 403) return 'fatal';
  if ([429, 500, 502, 503, 504].includes(status)) return 'retry';
  return 'retry';
}
