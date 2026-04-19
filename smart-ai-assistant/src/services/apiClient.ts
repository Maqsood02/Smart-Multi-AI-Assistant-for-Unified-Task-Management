// ════════════════════════════════════════════════════════════
//  API CLIENT — Frontend → Backend bridge
//  Tries backend API first, falls back to direct browser calls
//  if server is unavailable. Configurable via VITE_API_URL.
// ════════════════════════════════════════════════════════════

const API_BASE = (import.meta.env.VITE_API_URL ?? '').trim() || 'http://localhost:5000/api';

/** Check if backend server is available */
let _serverAvailable: boolean | null = null;
let _lastCheck = 0;
const CHECK_INTERVAL = 30_000; // re-check every 30s

async function isServerAvailable(): Promise<boolean> {
  const now = Date.now();
  if (_serverAvailable !== null && now - _lastCheck < CHECK_INTERVAL) {
    return _serverAvailable;
  }

  try {
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 3000);
    const res = await fetch(`${API_BASE}/health`, { signal: controller.signal });
    clearTimeout(timeout);
    _serverAvailable = res.ok;
  } catch {
    _serverAvailable = false;
  }
  _lastCheck = now;
  return _serverAvailable;
}

/** Get auth token from localStorage */
function getToken(): string {
  try {
    return localStorage.getItem('smai_token') || '';
  } catch {
    return '';
  }
}

/** Make authenticated API request */
async function apiRequest<T>(
  endpoint: string,
  body: Record<string, unknown>
): Promise<T> {
  const token = getToken();
  const res = await fetch(`${API_BASE}${endpoint}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { 'Authorization': `Bearer ${token}` } : {})
    },
    body: JSON.stringify(body)
  });

  if (!res.ok) {
    const data = await res.json().catch(() => ({})) as { error?: string };
    throw new Error(data.error || `Server error (${res.status})`);
  }

  return res.json() as Promise<T>;
}

// ── Public API ────────────────────────────────────────────

/**
 * Generate text via backend API.
 * Returns null if server is unavailable (caller should fallback to direct calls).
 */
export async function serverGenerateText(
  prompt: string,
  taskType: string
): Promise<{ text: string; provider: string } | null> {
  if (!(await isServerAvailable())) return null;

  try {
    const data = await apiRequest<{ text: string; provider: string }>(
      '/ai/generate-text',
      { prompt, taskType }
    );
    return data;
  } catch {
    return null; // server error → caller falls back to direct
  }
}

/**
 * Generate image via backend API.
 * Returns null if server is unavailable.
 */
export async function serverGenerateImage(
  prompt: string
): Promise<{
  imageUrl: string | null;
  description: string;
  provider: string;
  mode: 'generated' | 'described';
} | null> {
  if (!(await isServerAvailable())) return null;

  try {
    return await apiRequest('/ai/generate-image', { prompt });
  } catch {
    return null;
  }
}

/** Force re-check server availability */
export function resetServerCheck(): void {
  _serverAvailable = null;
  _lastCheck = 0;
}
