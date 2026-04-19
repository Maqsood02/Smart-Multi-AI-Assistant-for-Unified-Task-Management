import { SYSTEM_PROMPTS, TASK_TEMPERATURE } from './systemPrompts';

export const OR_BASE   = 'https://openrouter.ai/api/v1/chat/completions';
export const OR_MODELS = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'meta-llama/llama-3.1-8b-instruct:free',
  'google/gemma-3-27b-it:free',
  'mistralai/mistral-7b-instruct:free'
];

export function formatRequest(prompt: string, taskType: string, model: string) {
  const temp = TASK_TEMPERATURE[taskType] ?? 0.8;
  return {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS[taskType] || SYSTEM_PROMPTS.general },
      { role: 'user',   content: prompt }
    ],
    temperature: temp,
    max_tokens:  1500
  };
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?:   { message?: string };
}

export function extractText(data: unknown): string {
  const d = data as OpenAIResponse;
  const text = d?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty OpenRouter response');
  return text;
}
