// ════════════════════════════════════════════════════════════
//  HELPERS — Pure utility functions
//  Tool config now lives in src/data/toolConfig.ts
// ════════════════════════════════════════════════════════════

// Re-export everything from toolConfig for backward compat
export {
  ALL_TOOLS, TOOL_MAP, TOOL_COLOR_CLASSES, getToolConfig
} from '../data/toolConfig';
export type { ToolConfig } from '../data/toolConfig';

export function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

export function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

export function formatDateFull(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', {
    weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
  });
}

export function sleep(ms: number): Promise<void> {
  return new Promise(r => setTimeout(r, ms));
}

export function truncate(str: string, max = 80): string {
  return str.length > max ? str.slice(0, max) + '…' : str;
}
