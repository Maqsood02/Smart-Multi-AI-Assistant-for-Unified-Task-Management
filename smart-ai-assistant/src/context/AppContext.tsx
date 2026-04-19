// ════════════════════════════════════════════════════════════
//  APP CONTEXT — Global state for session + task refresh
// ════════════════════════════════════════════════════════════
import { createContext, useContext, useState, useCallback, useEffect, ReactNode } from 'react';
import type { Session, Page } from '../types';
import { Auth } from '../data/auth';

interface AppContextValue {
  session:    Session | null;
  tick:       number;
  refresh:    () => void;
  page:       Page;
  payload:    unknown;
  navigate:   (p: Page, pl?: unknown) => void;
  logout:     () => void;
}

const Ctx = createContext<AppContextValue | null>(null);

export function AppProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(() => Auth.current());
  const [tick,    setTick]    = useState(0);
  const [page,    setPage]    = useState<Page>(() => Auth.isLoggedIn() ? 'dashboard' : 'login');
  const [payload, setPayload] = useState<unknown>(null);

  useEffect(() => { Auth.seedDemo(); }, []);

  const refresh  = useCallback(() => setTick(t => t + 1), []);

  const navigate = useCallback((target: Page, pl?: unknown) => {
    const loggedIn   = Auth.isLoggedIn();
    const protected_ = new Set<Page>(['dashboard','tools','tasks','create-task','history','settings',
      'tool-content','tool-code','tool-image','tool-task',
      'tool-story','tool-summary','tool-imageSummary',
      'tool-codeCheck','tool-humanize','tool-grammar']);
    const authOnly   = new Set<Page>(['login','register']);

    if (protected_.has(target) && !loggedIn) { setPage('login'); return; }
    if (authOnly.has(target)   && loggedIn)  { setPage('dashboard'); return; }

    setPayload(pl ?? null);
    setPage(target);
  }, []);

  const logout = useCallback(() => {
    Auth.logout();
    setSession(null);
    setTimeout(() => setPage('login'), 400);
  }, []);

  // Keep session in sync
  useEffect(() => { setSession(Auth.current()); }, [tick, page]);

  return (
    <Ctx.Provider value={{ session, tick, refresh, page, payload, navigate, logout }}>
      {children}
    </Ctx.Provider>
  );
}

export function useApp(): AppContextValue {
  const ctx = useContext(Ctx);
  if (!ctx) throw new Error('useApp must be used inside AppProvider');
  return ctx;
}
