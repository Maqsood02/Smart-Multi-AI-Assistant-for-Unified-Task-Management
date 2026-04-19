import { useState } from 'react';
import { Auth } from '../data/auth';
import { useApp } from '../context/AppContext';

export function LoginPage() {
  const { navigate } = useApp();
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [errs,  setErrs]  = useState<Record<string,string>>({});

  const doLogin = () => {
    const e: typeof errs = {};
    if (!email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email.';
    if (!pass.trim()) e.pass = 'Password is required.';
    if (Object.keys(e).length) { setErrs(e); return; }
    const res = Auth.login(email.trim(), pass);
    if (!res.ok) { setErrs({ general: res.msg || 'Login failed.' }); return; }
    navigate('dashboard');
  };
  const clr = (f: string) => setErrs(p => { const n={...p}; delete n[f]; delete n.general; return n; });

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-grid" /><div className="auth-glow-1" /><div className="auth-glow-2" />
        <div className="auth-left-content">
          <div className="auth-brand">
            <div className="auth-brand-icon">🤖</div>
            <div className="auth-brand-name">Smart AI Assistant<span>Unified Multi-AI Task Platform</span></div>
          </div>
          <h1>Your AI Command Center</h1>
          <p>Content · Code · Images · Stories · Grammar — all 10 AI tools in one intelligent workspace, powered by multi-provider AI.</p>
          <div className="auth-features">
            {[
              { icon:'⚡', title:'Multi-AI Fallback',   desc:'Groq → Gemini → OpenRouter auto-switch' },
              { icon:'🎤', title:'Voice Input',          desc:'Speak your prompts on every tool' },
              { icon:'🧰', title:'10 AI Tools',          desc:'4 existing + 6 new tools added' }
            ].map(f => (
              <div className="auth-feature" key={f.title}>
                <span className="auth-feature-icon">{f.icon}</span>
                <div className="auth-feature-text"><strong>{f.title}</strong>{f.desc}</div>
              </div>
            ))}
          </div>
          <div className="ai-model-tags">
            {['📝','💻','🎨','📋','📖','📄','🖼️','🔍','🧑','✏️'].map(icon => (
              <span className="ai-model-tag" key={icon}>{icon}</span>
            ))}
          </div>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-form-wrap">
          <h2>Welcome back 👋</h2>
          <p className="auth-subtitle">Sign in to your Smart AI Assistant account</p>
          <div className="form-group">
            <label>Email address</label>
            <input type="email" className={`form-control ${errs.email?'error':''}`}
              placeholder="you@example.com" value={email}
              onChange={e=>{setEmail(e.target.value);clr('email');}}
              onKeyDown={e=>e.key==='Enter'&&doLogin()}/>
            {errs.email&&<span className="field-error show">{errs.email}</span>}
          </div>
          <div className="form-group">
            <label>Password</label>
            <input type="password" className={`form-control ${errs.pass?'error':''}`}
              placeholder="Your password" value={pass}
              onChange={e=>{setPass(e.target.value);clr('pass');}}
              onKeyDown={e=>e.key==='Enter'&&doLogin()}/>
            {errs.pass&&<span className="field-error show">{errs.pass}</span>}
          </div>
          {errs.general&&<div style={{color:'#f87171',fontSize:13,marginBottom:12}}>⚠ {errs.general}</div>}
          <button className="btn btn-primary btn-full btn-lg mt-md" onClick={doLogin}>Sign In →</button>
          <div className="auth-divider">or</div>
          <button className="btn btn-secondary btn-full" onClick={()=>navigate('register')}>Create an account</button>
          <div className="auth-footer">Don't have an account? <a onClick={()=>navigate('register')}>Register here</a></div>
          <div className="demo-hint"><strong style={{color:'var(--accent-l)'}}>Demo:</strong> demo@smartai.com / demo123</div>
        </div>
      </div>
    </div>
  );
}
