// ════════════════════════════════════════════════════════════
//  TOOL CONFIG — Canonical definitions for all 10 AI tools
//  Each tool defines: id, label, type, placeholder, handler,
//  page route, icon, color, and category.
//  Used by ToolPage, AllTools, AIToolsPage, Dashboard, Sidebar.
// ════════════════════════════════════════════════════════════
import type { TaskType, ToolConfig, Page } from '../types';

/** All 10 tool definitions — single source of truth */
export const TOOL_CONFIGS: ToolConfig[] = [
  {
    id: 'content',
    page: 'tool-content' as Page,
    icon: '📝',
    name: 'Content Generator',
    shortName: 'Content',
    description: 'Write blogs, articles, emails, social posts and any content you need.',
    inputLabel: 'What content do you need?',
    inputPlaceholder: 'e.g. Write a 500-word blog post about AI in healthcare...',
    outputLabel: 'Generated Content',
    color: 'blue',
    category: 'existing'
  },
  {
    id: 'code',
    page: 'tool-code' as Page,
    icon: '💻',
    name: 'Code Assistant',
    shortName: 'Code',
    description: 'Generate, debug, and explain code in any programming language.',
    inputLabel: 'Describe the code you need',
    inputPlaceholder: 'e.g. Create a Python Flask REST API with JWT authentication...',
    outputLabel: 'Generated Code',
    color: 'purple',
    category: 'existing'
  },
  {
    id: 'image',
    page: 'tool-image' as Page,
    icon: '🎨',
    name: 'Image Creator',
    shortName: 'Image',
    description: 'Generate detailed image descriptions and optimized AI art prompts.',
    inputLabel: 'Describe your image',
    inputPlaceholder: 'e.g. A futuristic city at night with neon lights and flying cars...',
    outputLabel: 'Image Description & Prompts',
    color: 'green',
    category: 'existing'
  },
  {
    id: 'task',
    page: 'tool-task' as Page,
    icon: '📋',
    name: 'Task Manager AI',
    shortName: 'Tasks',
    description: 'Let AI plan, organize, and break down complex projects into steps.',
    inputLabel: 'Describe your project or task',
    inputPlaceholder: 'e.g. Plan a 3-month mobile app launch from idea to store listing...',
    outputLabel: 'AI Task Plan',
    color: 'amber',
    category: 'existing'
  },
  {
    id: 'story',
    page: 'tool-story' as Page,
    icon: '📖',
    name: 'Story Creator',
    shortName: 'Story',
    description: 'Generate creative short stories, narratives, and fictional content.',
    inputLabel: 'Describe your story idea',
    inputPlaceholder: 'e.g. A detective story set in a futuristic city where AI commits crimes...',
    outputLabel: 'Your Story',
    color: 'pink',
    category: 'new'
  },
  {
    id: 'summary',
    page: 'tool-summary' as Page,
    icon: '📄',
    name: 'Text Summarizer',
    shortName: 'Summary',
    description: 'Paste any long text and get a concise, clear summary instantly.',
    inputLabel: 'Paste the text to summarize',
    inputPlaceholder: 'Paste your article, document, or any long text here...',
    outputLabel: 'Summary',
    color: 'teal',
    category: 'new'
  },
  {
    id: 'imageSummary',
    page: 'tool-imageSummary' as Page,
    icon: '🖼️',
    name: 'Image Summarizer',
    shortName: 'Img Sum',
    description: 'Describe an image URL or provide context to get an AI explanation.',
    inputLabel: 'Describe the image or paste its URL',
    inputPlaceholder: 'Describe what is in the image, or paste an image URL for analysis...',
    outputLabel: 'Image Analysis',
    color: 'indigo',
    category: 'new'
  },
  {
    id: 'codeCheck',
    page: 'tool-codeCheck' as Page,
    icon: '🔍',
    name: 'Code Checker',
    shortName: 'Check',
    description: 'Paste your code and get detailed error detection and improvement suggestions.',
    inputLabel: 'Paste your code to check',
    inputPlaceholder: 'Paste your code here — any language supported...',
    outputLabel: 'Code Review & Fixes',
    color: 'red',
    category: 'new'
  },
  {
    id: 'humanize',
    page: 'tool-humanize' as Page,
    icon: '🧑',
    name: 'Text Humanizer',
    shortName: 'Humanize',
    description: 'Convert robotic AI-generated text into natural, human-sounding writing.',
    inputLabel: 'Paste the AI text to humanize',
    inputPlaceholder: 'Paste the robotic or AI-generated text here...',
    outputLabel: 'Humanized Text',
    color: 'orange',
    category: 'new'
  },
  {
    id: 'grammar',
    page: 'tool-grammar' as Page,
    icon: '✏️',
    name: 'Grammar Fixer',
    shortName: 'Grammar',
    description: 'Fix grammar, spelling, punctuation, and improve writing clarity.',
    inputLabel: 'Paste the text to fix',
    inputPlaceholder: 'Paste your text with grammar issues here...',
    outputLabel: 'Corrected Text',
    color: 'cyan',
    category: 'new'
  }
];

/** Map from TaskType to ToolConfig for O(1) lookup */
export const TOOL_MAP = new Map<TaskType, ToolConfig>(
  TOOL_CONFIGS.map(t => [t.id, t])
);

/** Get tool config by type, fallback to first tool */
export function getToolConfig(type: TaskType): ToolConfig {
  return TOOL_MAP.get(type) || TOOL_CONFIGS[0];
}

/** Color classes for tool-specific styling */
export const TOOL_COLOR_CLASSES: Record<string, { bg: string; text: string; border: string }> = {
  blue:   { bg: 'rgba(59,130,246,0.12)',  text: '#60a5fa', border: 'rgba(59,130,246,0.25)' },
  purple: { bg: 'rgba(139,92,246,0.12)',  text: '#a78bfa', border: 'rgba(139,92,246,0.25)' },
  green:  { bg: 'rgba(16,185,129,0.12)',  text: '#34d399', border: 'rgba(16,185,129,0.25)' },
  amber:  { bg: 'rgba(245,158,11,0.12)',  text: '#fbbf24', border: 'rgba(245,158,11,0.25)' },
  pink:   { bg: 'rgba(236,72,153,0.12)',  text: '#f472b6', border: 'rgba(236,72,153,0.25)' },
  teal:   { bg: 'rgba(20,184,166,0.12)',  text: '#2dd4bf', border: 'rgba(20,184,166,0.25)' },
  indigo: { bg: 'rgba(99,102,241,0.12)',  text: '#818cf8', border: 'rgba(99,102,241,0.25)' },
  red:    { bg: 'rgba(239,68,68,0.12)',   text: '#f87171', border: 'rgba(239,68,68,0.25)'  },
  orange: { bg: 'rgba(249,115,22,0.12)',  text: '#fb923c', border: 'rgba(249,115,22,0.25)' },
  cyan:   { bg: 'rgba(6,182,212,0.12)',   text: '#22d3ee', border: 'rgba(6,182,212,0.25)'  }
};
