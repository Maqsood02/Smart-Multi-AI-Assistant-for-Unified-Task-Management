import { SYSTEM_PROMPTS, TASK_TEMPERATURE } from './systemPrompts';

export const GROQ_BASE   = 'https://api.groq.com/openai/v1/chat/completions';
export const GROQ_MODELS = [
  'llama-3.3-70b-versatile',   // best quality
  'llama-3.1-8b-instant',      // fastest
  'mixtral-8x7b-32768'         // fallback
];

export function formatRequest(prompt: string, taskType: string, model: string) {
  const temp = TASK_TEMPERATURE[taskType] ?? 0.8;
  return {
    model,
    messages: [
      { role: 'system', content: SYSTEM_PROMPTS[taskType] || SYSTEM_PROMPTS.general },
      { role: 'user',   content: prompt }
    ],
    temperature:  temp,
    max_tokens:   1500,
    top_p:        0.95
  };
}

interface OpenAIResponse {
  choices?: Array<{ message?: { content?: string } }>;
  error?:   { message?: string };
}

export function extractText(data: unknown): string {
  const d = data as OpenAIResponse;
  const text = d?.choices?.[0]?.message?.content?.trim();
  if (!text) throw new Error('Empty Groq response');
  return text;
}
