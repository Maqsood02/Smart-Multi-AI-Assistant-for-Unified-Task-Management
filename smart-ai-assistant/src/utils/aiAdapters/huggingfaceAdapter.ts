import { SYSTEM_PROMPTS } from './systemPrompts';

// Best HF models for inference
export const HF_MODELS = [
  { id: 'mistralai/Mistral-7B-Instruct-v0.2', format: 'mistral' },
  { id: 'HuggingFaceH4/zephyr-7b-beta',       format: 'chatml' }
];
export const HF_BASE = 'https://api-inference.huggingface.co/models';

export function formatRequest(prompt: string, taskType: string, format: string) {
  const sys = SYSTEM_PROMPTS[taskType] || SYSTEM_PROMPTS.general;
  const inputText = format === 'mistral'
    ? `<s>[INST] ${sys}\n\n${prompt} [/INST]`
    : `<|system|>\n${sys}</s>\n<|user|>\n${prompt}</s>\n<|assistant|>`;
  return {
    inputs:     inputText,
    parameters: { max_new_tokens: 1000, temperature: 0.8, return_full_text: false, do_sample: true }
  };
}

interface HFResponse { generated_text?: string; }

export function extractText(data: unknown): string {
  const arr = data as HFResponse[];
  const text = (Array.isArray(arr) ? arr[0]?.generated_text : undefined)?.trim();
  if (!text) throw new Error('Empty HuggingFace response');
  return text;
}
