// ════════════════════════════════════════════════════════════
//  STORAGE — localStorage wrapper with type safety
// ════════════════════════════════════════════════════════════

export const Storage = {
  get<T>(key: string, fallback: T): T {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set(key: string, value: unknown): void {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  },
  remove(key: string): void {
    try { localStorage.removeItem(key); } catch {}
  }
};
