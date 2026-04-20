// Backward-compat re-exports for any legacy imports
export { SYSTEM_PROMPTS, TASK_TEMPERATURE, PREFERRED_PROVIDER } from './systemPrompts';

export function classifyHttpError(status: number): 'retry' | 'stop' | 'fatal' {
  if (status === 400) return 'stop';
  if (status === 401 || status === 403) return 'fatal';
  return 'retry';
}
