import { SYSTEM_PROMPTS } from './systemPrompts';

export const CF_MODELS = [
  '@cf/meta/llama-3.1-8b-instruct',
  '@cf/mistral/mistral-7b-instruct-v0.1'
];

export function formatRequest(prompt: string, taskType: string) {
  return {
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS[taskType] || SYSTEM_PROMPTS.general },
      { role: 'user',   content: prompt }
    ],
    max_tokens: 1200
  };
}

interface CFResponse { result?: { response?: string }; }

export function extractText(data: unknown): string {
  const d = data as CFResponse;
  const text = d?.result?.response?.trim();
  if (!text) throw new Error('Empty Cloudflare response');
  return text;
}
