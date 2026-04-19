// ════════════════════════════════════════════════════════════
//  SETTINGS PAGE — API keys, provider status, platform info
//  Now includes ALL 5 providers' key inputs and circuit breaker status
// ════════════════════════════════════════════════════════════
import { useState, useEffect } from 'react';
import { Storage } from '../utils/storage';
import { getAvailableProviders } from '../services/aiGateway';
import { generateWithFallback } from '../services/aiGateway';
import { getCircuitStatus, resetCircuits } from '../services/aiGateway';
import { useToasts, ToastContainer } from '../components/common/Toast';

const DEV_KEYS = (import.meta.env.VITE_GEMINI_KEYS??'').split(',').map((k:string)=>k.trim()).filter((k:string)=>k.length>10);
const hasDevKey = DEV_KEYS.length>0;

export function SettingsPage() {
  const { toasts, toast } = useToasts();
  const [geminiKeys, setGeminiKeys]   = useState(Storage.get<string>('smai_gemini_key',''));
  const [groqKey,    setGroqKey]      = useState(Storage.get<string>('smai_groq_key',''));
  const [orKey,      setOrKey]        = useState(Storage.get<string>('smai_or_key',''));
  const [cfKey,      setCfKey]        = useState(Storage.get<string>('smai_cf_key',''));
  const [cfAccount,  setCfAccount]    = useState(Storage.get<string>('smai_cf_account',''));
  const [hfKey,      setHfKey]        = useState(Storage.get<string>('smai_hf_key',''));
  const [showKeys,   setShowKeys]     = useState(false);
  const [testing,    setTesting]      = useState(false);
  const [circuitStatus, setCircuitStatus] = useState<Record<string, { isOpen: boolean; failCount: number; retryAfterMs: number }>>({});

  const available = getAvailableProviders();

  // Refresh circuit breaker status
  useEffect(() => {
    const update = () => setCircuitStatus(getCircuitStatus());
    update();
    const interval = setInterval(update, 5000);
    return () => clearInterval(interval);
  }, []);

  const saveKeys = () => {
    Storage.set('smai_gemini_key', geminiKeys.trim());
    Storage.set('smai_groq_key',   groqKey.trim());
    Storage.set('smai_or_key',     orKey.trim());
    Storage.set('smai_cf_key',     cfKey.trim());
    Storage.set('smai_cf_account', cfAccount.trim());
    Storage.set('smai_hf_key',     hfKey.trim());
    toast('✅ API keys saved!','success');
    window.location.reload();
  };

  const testConnection = async () => {
    setTesting(true);
    try {
      const {text,provider} = await generateWithFallback('Say: Connection test successful','general');
      toast(`✅ ${provider} works! Response received.`,'success');
    } catch(err){
      toast(`❌ ${err instanceof Error?err.message:'All providers failed'}`,'error');
    } finally { setTesting(false); }
  };

  const handleResetCircuits = () => {
    resetCircuits();
    setCircuitStatus({});
    toast('🔄 All circuit breakers reset!', 'info');
  };

  return (
    <>
      <ToastContainer toasts={toasts}/>
      <div className="page-header">
        <h2>⚙️ Settings</h2>
        <p>API keys and platform configuration. All keys are stored in your browser only.</p>
      </div>

      <div className="settings-grid">
        {/* ── API Keys Card ── */}
        <div className="settings-card">
          <h3>🔑 API Keys</h3>

          {/* Provider Status */}
          <div style={{marginBottom:18}}>
            <div style={{fontSize:12,fontWeight:700,color:'var(--text3)',textTransform:'uppercase',letterSpacing:'0.06em',marginBottom:8}}>
              Active Providers ({available.length}/5)
            </div>
            <div style={{display:'flex',flexWrap:'wrap',gap:7}}>
              {['Groq','Gemini','OpenRouter','Cloudflare AI','HuggingFace'].map(name=>{
                const on = available.includes(name);
                const breaker = circuitStatus[name];
                const tripped = breaker?.isOpen;
                return (
                  <span key={name} style={{fontSize:11.5,padding:'4px 10px',borderRadius:100,fontWeight:600,
                    background: tripped ? 'rgba(245,158,11,0.1)' : on?'rgba(16,185,129,0.1)':'rgba(239,68,68,0.07)',
                    color: tripped ? '#fbbf24' : on?'var(--accent3)':'#f87171',
                    border:`1px solid ${tripped ? 'rgba(245,158,11,0.25)' : on?'rgba(16,185,129,0.25)':'rgba(239,68,68,0.2)'}`}}>
                    {tripped ? '⚠️' : on?'✅':'❌'} {name}
                    {tripped && <span style={{fontSize:10,marginLeft:4}}>({Math.ceil((breaker.retryAfterMs)/1000)}s)</span>}
                  </span>
                );
              })}
            </div>
            {Object.values(circuitStatus).some(s => s.isOpen) && (
              <button className="btn btn-ghost btn-sm" style={{marginTop:8,fontSize:11}} onClick={handleResetCircuits}>
                🔄 Reset Circuit Breakers
              </button>
            )}
          </div>

          {/* Dev key banner */}
          {hasDevKey&&(
            <div style={{padding:'10px 14px',background:'rgba(16,185,129,0.06)',border:'1px solid rgba(16,185,129,0.2)',borderRadius:10,fontSize:12.5,color:'var(--accent3)',marginBottom:16}}>
              ✅ Developer Gemini key is pre-configured ({DEV_KEYS.length} key{DEV_KEYS.length>1?'s':''}).<br/>
              <span style={{color:'var(--text2)'}}>Users can add their own keys below to override.</span>
            </div>
          )}

          <div style={{display:'flex',justifyContent:'flex-end',marginBottom:14}}>
            <button className="btn btn-ghost btn-sm" onClick={()=>setShowKeys(s=>!s)}>
              {showKeys?'🙈 Hide keys':'👁 Show keys'}
            </button>
          </div>

          {/* Gemini Keys */}
          <div className="form-group">
            <label>Gemini API Keys (comma-separated for rotation)</label>
            <input type={showKeys?'text':'password'} className="form-control"
              placeholder="AIzaSy... (comma-separate multiple keys)"
              value={geminiKeys} onChange={e=>setGeminiKeys(e.target.value)}/>
            <span style={{fontSize:11,color:'var(--text3)',marginTop:4,display:'block'}}>
              Get free key at <strong>aistudio.google.com</strong> — supports multiple keys for rotation
            </span>
          </div>

          {/* Groq Key */}
          <div className="form-group">
            <label>Groq API Key (free — fastest AI)</label>
            <input type={showKeys?'text':'password'} className="form-control"
              placeholder="gsk_..." value={groqKey} onChange={e=>setGroqKey(e.target.value)}/>
            <span style={{fontSize:11,color:'var(--text3)',marginTop:4,display:'block'}}>
              Get free key at <strong>console.groq.com</strong>
            </span>
          </div>

          {/* OpenRouter Key */}
          <div className="form-group">
            <label>OpenRouter API Key (free models available)</label>
            <input type={showKeys?'text':'password'} className="form-control"
              placeholder="sk-or-..." value={orKey} onChange={e=>setOrKey(e.target.value)}/>
            <span style={{fontSize:11,color:'var(--text3)',marginTop:4,display:'block'}}>
              Get free key at <strong>openrouter.ai</strong>
            </span>
          </div>

          {/* Cloudflare Key */}
          <div className="form-group">
            <label>Cloudflare Workers AI Key</label>
            <input type={showKeys?'text':'password'} className="form-control"
              placeholder="Bearer token..." value={cfKey} onChange={e=>setCfKey(e.target.value)}/>
            <div style={{marginTop:6}}>
              <label style={{fontSize:12,color:'var(--text3)'}}>Cloudflare Account ID</label>
              <input type="text" className="form-control" style={{marginTop:4}}
                placeholder="Account ID (e.g. abc123def456)" value={cfAccount} onChange={e=>setCfAccount(e.target.value)}/>
            </div>
            <span style={{fontSize:11,color:'var(--text3)',marginTop:4,display:'block'}}>
              Get key at <strong>developers.cloudflare.com/workers-ai</strong>
            </span>
          </div>

          {/* HuggingFace Key */}
          <div className="form-group">
            <label>HuggingFace Inference API Key</label>
            <input type={showKeys?'text':'password'} className="form-control"
              placeholder="hf_..." value={hfKey} onChange={e=>setHfKey(e.target.value)}/>
            <span style={{fontSize:11,color:'var(--text3)',marginTop:4,display:'block'}}>
              Get free key at <strong>huggingface.co/settings/tokens</strong>
            </span>
          </div>

          <div style={{display:'flex',gap:10}}>
            <button className="btn btn-primary" style={{flex:1}} onClick={saveKeys}>💾 Save Keys</button>
            <button className="btn btn-secondary" onClick={testConnection} disabled={testing}>
              {testing?'⏳ Testing…':'🧪 Test AI'}
            </button>
          </div>
        </div>

        {/* ── Platform Info Card ── */}
        <div className="settings-card">
          <h3>🤖 Platform Info</h3>
          <div style={{display:'flex',flexDirection:'column',gap:2,marginBottom:20}}>
            {[
              ['Platform',    'Smart Multi-AI Assistant'],
              ['Version',     'v5.0 — Production'],
              ['AI Providers','Groq, Gemini, OpenRouter, Cloudflare, HF'],
              ['Tools',       '10 AI Tools (4 + 6 New)'],
              ['Voice Input', 'Web Speech API (all tools)'],
              ['Storage',     'localStorage (browser)'],
              ['Backend',     'Express API (MERN-ready)'],
              ['Framework',   'React 19 + TypeScript + Vite']
            ].map(([label,value])=>(
              <div key={label} style={{display:'flex',justifyContent:'space-between',padding:'9px 0',borderBottom:'1px solid var(--border)',fontSize:13}}>
                <span style={{color:'var(--text3)',fontWeight:500}}>{label}</span>
                <span style={{color:'var(--text)',fontWeight:600,textAlign:'right',maxWidth:220}}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{padding:16,background:'linear-gradient(135deg,rgba(59,130,246,0.07),rgba(139,92,246,0.05))',border:'1px solid rgba(59,130,246,0.2)',borderRadius:12}}>
            <div style={{fontSize:13,fontWeight:700,color:'var(--text)',marginBottom:10}}>🔁 AI Fallback Order</div>
            {[
              ['1st','Groq','Fastest (LLaMA 3.3)'],
              ['2nd','Gemini','Most capable (free)'],
              ['3rd','OpenRouter','Multiple free models'],
              ['4th','Cloudflare AI','Reliable backup'],
              ['5th','HuggingFace','Final failsafe']
            ].map(([num,name,desc])=>(
              <div key={num} style={{display:'flex',gap:10,marginBottom:8,fontSize:12.5}}>
                <span style={{color:'var(--accent-l)',fontWeight:700,minWidth:28}}>{num}</span>
                <span style={{color:'var(--text)',fontWeight:600,minWidth:80}}>{name}</span>
                <span style={{color:'var(--text2)'}}>{desc}</span>
              </div>
            ))}
          </div>

          <div style={{marginTop:14,padding:14,background:'rgba(59,130,246,0.04)',border:'1px solid var(--border)',borderRadius:10,fontSize:12.5,color:'var(--text2)',lineHeight:1.8}}>
            <strong style={{color:'var(--accent-l)',display:'block',marginBottom:6}}>🔑 Key Priority</strong>
            <strong>1st:</strong> User keys (Settings)<br/>
            <strong>2nd:</strong> Developer keys (.env file)<br/>
            Both work simultaneously. User key always wins.
          </div>

          <div style={{marginTop:14,padding:14,background:'rgba(16,185,129,0.04)',border:'1px solid rgba(16,185,129,0.15)',borderRadius:10,fontSize:12.5,color:'var(--text2)',lineHeight:1.8}}>
            <strong style={{color:'var(--accent3)',display:'block',marginBottom:6}}>🛡️ Error Handling</strong>
            <strong>429:</strong> Rate limit → auto-rotate key / switch provider<br/>
            <strong>500/503:</strong> Server error → fallback to next provider<br/>
            <strong>400:</strong> Safety block → stop immediately<br/>
            Circuit breaker: 60s cooldown per provider on failure
          </div>
        </div>
      </div>
    </>
  );
}
