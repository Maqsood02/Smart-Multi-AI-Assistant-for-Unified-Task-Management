// ════════════════════════════════════════════════════════════
//  SETTINGS PAGE
//  BUG FIX: Now saves ALL 5 provider keys including CF and HF
//  (previously only saved Gemini, Groq, OpenRouter)
// ════════════════════════════════════════════════════════════
import { useState } from 'react';
import { Storage } from '../utils/storage';
import { getAvailableProviders, getAnyKeyAvailable as hasAnyKey } from '../services/aiGateway';
import { generateTextWithFallback } from '../services/aiGateway';
import { useToasts, ToastContainer } from '../components/common/Toast';

const DEV_GEMINI_KEYS = (import.meta.env.VITE_GEMINI_KEYS ?? '')
  .split(',').map((k: string) => k.trim()).filter((k: string) => k.length > 10);
const hasDevGemini = DEV_GEMINI_KEYS.length > 0;

const STORAGE_KEYS = {
  gemini:      'smai_gemini_key',
  groq:        'smai_groq_key',
  openRouter:  'smai_or_key',
  cloudflare:  'smai_cf_key',        // BUG FIX: was never saved before
  huggingFace: 'smai_hf_key'         // BUG FIX: was never saved before
};

export function SettingsPage() {
  const { toasts, toast } = useToasts();

  const [geminiKeys, setGeminiKeys]    = useState(Storage.get<string>(STORAGE_KEYS.gemini, ''));
  const [groqKey,    setGroqKey]       = useState(Storage.get<string>(STORAGE_KEYS.groq, ''));
  const [orKey,      setOrKey]         = useState(Storage.get<string>(STORAGE_KEYS.openRouter, ''));
  const [cfKey,      setCfKey]         = useState(Storage.get<string>(STORAGE_KEYS.cloudflare, ''));
  const [hfKey,      setHfKey]         = useState(Storage.get<string>(STORAGE_KEYS.huggingFace, ''));
  const [cfAccountId,setCfAccountId]   = useState(Storage.get<string>('smai_cf_account', ''));
  const [showKeys,   setShowKeys]      = useState(false);
  const [testing,    setTesting]       = useState(false);

  const available = getAvailableProviders();

  const saveAllKeys = () => {
    Storage.set(STORAGE_KEYS.gemini,      geminiKeys.trim());
    Storage.set(STORAGE_KEYS.groq,        groqKey.trim());
    Storage.set(STORAGE_KEYS.openRouter,  orKey.trim());
    Storage.set(STORAGE_KEYS.cloudflare,  cfKey.trim());       // BUG FIX
    Storage.set(STORAGE_KEYS.huggingFace, hfKey.trim());       // BUG FIX
    Storage.set('smai_cf_account',        cfAccountId.trim()); // BUG FIX
    toast('✅ All API keys saved!', 'success');
  };

  const clearKey = (storageKey: string, setter: (v: string) => void) => {
    Storage.remove(storageKey);
    setter('');
    toast('Key cleared.', 'info');
  };

  const testConnection = async () => {
    if (!hasAnyKey()) { toast('No API key configured to test.', 'error'); return; }
    setTesting(true);
    try {
      const { text, provider } = await generateTextWithFallback(
        'Reply with exactly: "Connection test successful."',
        'general'
      );
      toast(`✅ ${provider} works! "${text.slice(0, 50)}"`, 'success');
    } catch (err) {
      toast(`❌ ${err instanceof Error ? err.message : 'Test failed'}`, 'error');
    } finally { setTesting(false); }
  };

  const keyInputProps = (show: boolean) => ({
    type: show ? 'text' : 'password'
  });

  return (
    <>
      <ToastContainer toasts={toasts}/>
      <div className="page-header">
        <h2>⚙️ Settings</h2>
        <p>API keys and platform configuration. Keys are stored in your browser only.</p>
      </div>

      <div className="settings-grid">
        {/* ── API Keys Card ── */}
        <div className="settings-card">
          <h3>🔑 API Keys</h3>

          {/* Provider status overview */}
          <div style={{ marginBottom: 18 }}>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.07em', marginBottom: 8 }}>
              Active Providers ({available.length}/5)
            </div>
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
              {['Groq', 'Gemini', 'OpenRouter', 'Cloudflare AI', 'HuggingFace'].map(name => {
                const on = available.includes(name);
                return (
                  <span key={name} style={{
                    fontSize: 11.5, padding: '4px 10px', borderRadius: 100, fontWeight: 600,
                    background: on ? 'rgba(46,201,138,0.12)' : 'rgba(239,68,68,0.08)',
                    color:      on ? 'var(--accent3)' : '#f87171',
                    border: `1px solid ${on ? 'rgba(46,201,138,0.25)' : 'rgba(239,68,68,0.2)'}`
                  }}>
                    {on ? '✅' : '❌'} {name}
                  </span>
                );
              })}
            </div>
          </div>

          {/* Developer key status */}
          {hasDevGemini && (
            <div style={{ padding: '10px 14px', background: 'rgba(46,201,138,0.07)', border: '1px solid rgba(46,201,138,0.2)', borderRadius: 10, fontSize: 12.5, color: 'var(--accent3)', marginBottom: 16 }}>
              ✅ Developer Gemini key pre-configured ({DEV_GEMINI_KEYS.length} key{DEV_GEMINI_KEYS.length > 1 ? 's' : ''}).<br/>
              <span style={{ color: 'var(--text2)' }}>User keys below override it.</span>
            </div>
          )}

          <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
            <button className="btn btn-ghost btn-sm" onClick={() => setShowKeys(s => !s)}>
              {showKeys ? '🙈 Hide' : '👁 Show keys'}
            </button>
          </div>

          {/* ── Gemini ── */}
          <div className="form-group">
            <label>Gemini Keys (comma-separated for rotation)</label>
            <input {...keyInputProps(showKeys)} className="form-control"
              placeholder="AIzaSy... (add multiple: key1,key2,key3)"
              value={geminiKeys} onChange={e => setGeminiKeys(e.target.value)}/>
            <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'block' }}>
              Free at <strong>aistudio.google.com</strong> · Multiple keys = auto-rotation
            </span>
          </div>

          {/* ── Groq ── */}
          <div className="form-group">
            <label>Groq API Key <span style={{ fontSize: 11, color: 'var(--accent3)' }}>(fastest — free)</span></label>
            <input {...keyInputProps(showKeys)} className="form-control"
              placeholder="gsk_..." value={groqKey} onChange={e => setGroqKey(e.target.value)}/>
            <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'block' }}>Free at <strong>console.groq.com</strong></span>
          </div>

          {/* ── OpenRouter ── */}
          <div className="form-group">
            <label>OpenRouter API Key <span style={{ fontSize: 11, color: 'var(--accent3)' }}>(free models)</span></label>
            <input {...keyInputProps(showKeys)} className="form-control"
              placeholder="sk-or-..." value={orKey} onChange={e => setOrKey(e.target.value)}/>
            <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'block' }}>Free at <strong>openrouter.ai</strong></span>
          </div>

          {/* ── Cloudflare ── (BUG FIX: now actually saved) */}
          <div style={{ marginBottom: 10, fontSize: 12, fontWeight: 700, color: 'var(--text3)', textTransform: 'uppercase', letterSpacing: '0.06em', borderTop: '1px solid var(--border)', paddingTop: 16, marginTop: 8 }}>
            Optional Providers (for image generation)
          </div>
          <div className="form-group">
            <label>Cloudflare Workers AI Key</label>
            <input {...keyInputProps(showKeys)} className="form-control"
              placeholder="Cloudflare API key" value={cfKey} onChange={e => setCfKey(e.target.value)}/>
          </div>
          <div className="form-group">
            <label>Cloudflare Account ID</label>
            <input type="text" className="form-control"
              placeholder="Your Cloudflare account ID" value={cfAccountId} onChange={e => setCfAccountId(e.target.value)}/>
            <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'block' }}>From <strong>dash.cloudflare.com</strong></span>
          </div>

          {/* ── HuggingFace ── (BUG FIX: now actually saved) */}
          <div className="form-group">
            <label>HuggingFace API Key <span style={{ fontSize: 11, color: 'var(--text3)' }}>(for image gen)</span></label>
            <input {...keyInputProps(showKeys)} className="form-control"
              placeholder="hf_..." value={hfKey} onChange={e => setHfKey(e.target.value)}/>
            <span style={{ fontSize: 11, color: 'var(--text3)', marginTop: 4, display: 'block' }}>Free at <strong>huggingface.co/settings/tokens</strong></span>
          </div>

          <div style={{ display: 'flex', gap: 10 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveAllKeys}>💾 Save All Keys</button>
            <button className="btn btn-secondary" onClick={testConnection} disabled={testing}>
              {testing ? '⏳ Testing…' : '🧪 Test AI'}
            </button>
          </div>
        </div>

        {/* ── Platform Info Card ── */}
        <div className="settings-card">
          <h3>🤖 Platform Info</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 20 }}>
            {[
              ['Platform',    'Smart Multi-AI Assistant'],
              ['Version',     'v6.0 — Tasks 1-5 Complete'],
              ['AI Providers','Groq, Gemini, OpenRouter, Cloudflare, HF'],
              ['Image AI',    'Gemini → Cloudflare SD → HuggingFace SD'],
              ['Tools',       '10 AI Tools (4 original + 6 new)'],
              ['Voice Input', 'Web Speech API (all tools)'],
              ['Architecture','Modular services + circuit breaker'],
              ['Storage',     'localStorage (browser-only)'],
              ['Backend',     'MERN-ready scaffold (server/)']
            ].map(([label, value]) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '9px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text3)', fontWeight: 500 }}>{label}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600, textAlign: 'right', maxWidth: 220 }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: 16, background: 'linear-gradient(135deg,rgba(77,136,240,0.07),rgba(155,135,245,0.04))', border: '1px solid rgba(77,136,240,0.2)', borderRadius: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>🔁 AI Fallback Order</div>
            {[
              ['1st', 'Groq',         'Fastest (LLaMA 3.3 70B)'],
              ['2nd', 'Gemini',       'Multi-key rotation + 3 models'],
              ['3rd', 'OpenRouter',   '4 free models available'],
              ['4th', 'Cloudflare AI','Stable Diffusion (image only)'],
              ['5th', 'HuggingFace', 'Final failsafe']
            ].map(([num, name, desc]) => (
              <div key={num} style={{ display: 'flex', gap: 10, marginBottom: 8, fontSize: 12.5 }}>
                <span style={{ color: 'var(--accent-l)', fontWeight: 700, minWidth: 28 }}>{num}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600, minWidth: 85 }}>{name}</span>
                <span style={{ color: 'var(--text2)' }}>{desc}</span>
              </div>
            ))}
          </div>

          <div style={{ marginTop: 14, padding: 14, background: 'rgba(77,136,240,0.04)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--accent-l)', display: 'block', marginBottom: 6 }}>🔑 Key Priority Logic</strong>
            <strong>1st:</strong> User keys (this Settings page)<br/>
            <strong>2nd:</strong> Developer keys (.env VITE_ vars)<br/>
            Gemini supports multiple keys — they rotate automatically on quota.
          </div>
        </div>
      </div>
    </>
  );
}
