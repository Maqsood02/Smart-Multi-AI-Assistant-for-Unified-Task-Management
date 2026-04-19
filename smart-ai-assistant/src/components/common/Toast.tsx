import { useState, useCallback } from 'react';

export interface ToastMsg { id: number; msg: string; type: 'success' | 'error' | 'info'; }

export function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4200);
  }, []);
  return { toasts, toast };
}

const ICONS: Record<string, string> = { success: '✅', error: '❌', info: 'ℹ️' };

export function ToastContainer({ toasts }: { toasts: ToastMsg[] }) {
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{ICONS[t.type]}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}
