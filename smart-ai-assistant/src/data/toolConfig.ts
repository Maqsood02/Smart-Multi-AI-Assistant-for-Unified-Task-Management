// ════════════════════════════════════════════════════════════
//  TOOL CONFIG — Single source of truth for all 10 AI tools
//  Separated from helpers.ts as required by architecture spec.
// ════════════════════════════════════════════════════════════
import type { TaskType, Page } from '../types';

export interface ToolConfig {
  id:          TaskType;
  page:        Page;
  icon:        string;
  name:        string;
  shortName:   string;
  description: string;
  inputLabel:  string;
  inputPlaceholder: string;
  outputLabel: string;
  color:       string;
  category:    'existing' | 'new';
  handler:     'text' | 'image';   // which pipeline to use
}

export const ALL_TOOLS: ToolConfig[] = [
  /* ── EXISTING 4 ────────────────────────────────────────── */
  {
    id: 'content', page: 'tool-content', icon: '📝',
    name: 'Content Generator', shortName: 'Content',
    description: 'Write blogs, articles, emails, social posts and any written content you need.',
    inputLabel: 'What content do you need?',
    inputPlaceholder: 'e.g. Write a 500-word blog post about the future of AI in healthcare…',
    outputLabel: 'Generated Content',
    color: 'blue', category: 'existing', handler: 'text'
  },
  {
    id: 'code', page: 'tool-code', icon: '💻',
    name: 'Code Assistant', shortName: 'Code',
    description: 'Generate, debug, and explain code in any programming language.',
    inputLabel: 'Describe the code you need',
    inputPlaceholder: 'e.g. Create a Python Flask REST API with JWT authentication and user registration…',
    outputLabel: 'Generated Code',
    color: 'purple', category: 'existing', handler: 'text'
  },
  {
    id: 'image', page: 'tool-image', icon: '🎨',
    name: 'Image Creator', shortName: 'Image',
    description: 'Generate AI images or get detailed prompts for Midjourney, DALL-E and Stable Diffusion.',
    inputLabel: 'Describe your image',
    inputPlaceholder: 'e.g. A futuristic city at night with neon lights, flying cars, cyberpunk style…',
    outputLabel: 'Generated Image & Prompts',
    color: 'green', category: 'existing', handler: 'image'   // ← uses imagePipeline
  },
  {
    id: 'task', page: 'tool-task', icon: '📋',
    name: 'Task Manager AI', shortName: 'Tasks',
    description: 'Plan, organize, and break down complex projects into clear actionable steps.',
    inputLabel: 'Describe your project or task',
    inputPlaceholder: 'e.g. Plan a 3-month roadmap for launching a mobile app startup from idea to store…',
    outputLabel: 'AI Task Plan',
    color: 'amber', category: 'existing', handler: 'text'
  },
  /* ── NEW 6 ──────────────────────────────────────────────── */
  {
    id: 'story', page: 'tool-story', icon: '📖',
    name: 'Story Creator', shortName: 'Story',
    description: 'Generate creative short stories, fiction, and narrative content.',
    inputLabel: 'Describe your story idea',
    inputPlaceholder: 'e.g. A detective story set in a futuristic city where an AI commits a crime…',
    outputLabel: 'Your Story',
    color: 'pink', category: 'new', handler: 'text'
  },
  {
    id: 'summary', page: 'tool-summary', icon: '📄',
    name: 'Text Summarizer', shortName: 'Summary',
    description: 'Paste any long text and get a concise, accurate summary instantly.',
    inputLabel: 'Paste the text to summarize',
    inputPlaceholder: 'Paste your article, document, research paper, or any long text here…',
    outputLabel: 'Summary',
    color: 'teal', category: 'new', handler: 'text'
  },
  {
    id: 'imageSummary', page: 'tool-imageSummary', icon: '🖼️',
    name: 'Image Summarizer', shortName: 'Img Sum',
    description: 'Describe an image or URL to get a detailed AI explanation and analysis.',
    inputLabel: 'Describe the image or paste its URL',
    inputPlaceholder: 'Describe what is in the image in detail, or paste an image URL for AI analysis…',
    outputLabel: 'Image Analysis',
    color: 'indigo', category: 'new', handler: 'text'
  },
  {
    id: 'codeCheck', page: 'tool-codeCheck', icon: '🔍',
    name: 'Code Checker', shortName: 'Check',
    description: 'Paste any code to get detailed error detection and improvement suggestions.',
    inputLabel: 'Paste your code to review',
    inputPlaceholder: 'Paste your code here — any language. Get bugs, security issues, and fixes…',
    outputLabel: 'Code Review & Fixes',
    color: 'red', category: 'new', handler: 'text'
  },
  {
    id: 'humanize', page: 'tool-humanize', icon: '🧑',
    name: 'Text Humanizer', shortName: 'Humanize',
    description: 'Convert robotic AI-generated text into natural, human-sounding writing.',
    inputLabel: 'Paste the AI text to humanize',
    inputPlaceholder: 'Paste the robotic or AI-generated text here to make it sound more natural…',
    outputLabel: 'Humanized Text',
    color: 'orange', category: 'new', handler: 'text'
  },
  {
    id: 'grammar', page: 'tool-grammar', icon: '✏️',
    name: 'Grammar Fixer', shortName: 'Grammar',
    description: 'Fix grammar, spelling, punctuation, and improve writing clarity.',
    inputLabel: 'Paste the text to fix',
    inputPlaceholder: 'Paste your text with grammar issues here and get a corrected version…',
    outputLabel: 'Corrected Text',
    color: 'cyan', category: 'new', handler: 'text'
  }
];

export const TOOL_MAP = new Map<TaskType, ToolConfig>(
  ALL_TOOLS.map(t => [t.id, t])
);

export function getToolConfig(id: TaskType): ToolConfig {
  return TOOL_MAP.get(id) || ALL_TOOLS[0];
}

// Re-export for backward compat with helpers.ts imports
export const TOOL_COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'rgba(77,136,240,0.14)',  text: 'var(--accent-l)', border: 'rgba(77,136,240,0.28)' },
  purple: { bg: 'rgba(155,135,245,0.14)', text: 'var(--accent2)',  border: 'rgba(155,135,245,0.28)' },
  green:  { bg: 'rgba(46,201,138,0.14)',  text: 'var(--accent3)',  border: 'rgba(46,201,138,0.28)' },
  amber:  { bg: 'rgba(245,183,49,0.14)',  text: 'var(--warning)',  border: 'rgba(245,183,49,0.28)' },
  pink:   { bg: 'rgba(236,72,153,0.14)',  text: '#f472b6',         border: 'rgba(236,72,153,0.28)' },
  teal:   { bg: 'rgba(20,184,166,0.14)',  text: '#2dd4bf',         border: 'rgba(20,184,166,0.28)' },
  indigo: { bg: 'rgba(99,102,241,0.14)',  text: '#818cf8',         border: 'rgba(99,102,241,0.28)' },
  red:    { bg: 'rgba(239,68,68,0.14)',   text: '#f87171',         border: 'rgba(239,68,68,0.28)' },
  orange: { bg: 'rgba(249,115,22,0.14)',  text: '#fb923c',         border: 'rgba(249,115,22,0.28)' },
  cyan:   { bg: 'rgba(6,182,212,0.14)',   text: '#22d3ee',         border: 'rgba(6,182,212,0.28)' }
};
