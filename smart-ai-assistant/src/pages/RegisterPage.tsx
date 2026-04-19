import { useState } from 'react';
import { Auth } from '../data/auth';
import { useApp } from '../context/AppContext';

export function RegisterPage() {
  const { navigate } = useApp();
  const [name,setName]=useState(''); const [email,setEmail]=useState('');
  const [pass,setPass]=useState(''); const [pass2,setPass2]=useState('');
  const [errs,setErrs]=useState<Record<string,string>>({});

  const doReg = () => {
    const e: Record<string,string>={};
    if(!name.trim()) e.name='Full name is required.';
    if(!email.trim()) e.email='Email is required.';
    else if(!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email='Enter a valid email.';
    if(!pass.trim()) e.pass='Password is required.';
    else if(pass.length<6) e.pass='Minimum 6 characters.';
    if(!pass2.trim()) e.pass2='Confirm your password.';
    else if(pass!==pass2) e.pass2='Passwords do not match.';
    if(Object.keys(e).length){setErrs(e);return;}
    const res=Auth.register(name.trim(),email.trim(),pass);
    if(!res.ok){setErrs({general:res.msg||'Registration failed.'});return;}
    Auth.login(email.trim(),pass);
    navigate('dashboard');
  };
  const clr=(f:string)=>setErrs(p=>{const n={...p};delete n[f];delete n.general;return n;});

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-grid"/><div className="auth-glow-1"/><div className="auth-glow-2"/>
        <div className="auth-left-content">
          <div className="auth-brand">
            <div className="auth-brand-icon">🤖</div>
            <div className="auth-brand-name">Smart AI Assistant<span>Unified Multi-AI Task Platform</span></div>
          </div>
          <h1>Join the AI Revolution</h1>
          <p>10 AI tools, multi-provider fallback, voice input, and smart task management — all in one free platform.</p>
          <div className="auth-features">
            {[
              {icon:'🚀',title:'10 AI Tools',       desc:'Content, Code, Images, Stories, Grammar & more'},
              {icon:'🎤',title:'Voice Input',        desc:'Speak your prompts on every single tool'},
              {icon:'🔁',title:'Auto AI Fallback',   desc:'Never fails — switches providers automatically'}
            ].map(f=>(
              <div className="auth-feature" key={f.title}>
                <span className="auth-feature-icon">{f.icon}</span>
                <div className="auth-feature-text"><strong>{f.title}</strong>{f.desc}</div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-form-wrap">
          <h2>Create your account 🚀</h2>
          <p className="auth-subtitle">Join the Smart AI Assistant platform today</p>
          {[
            {id:'name',label:'Full Name',type:'text',val:name,set:setName,ph:'Jane Doe'},
            {id:'email',label:'Email address',type:'email',val:email,set:setEmail,ph:'you@example.com'},
            {id:'pass',label:'Password',type:'password',val:pass,set:setPass,ph:'Min 6 characters'},
            {id:'pass2',label:'Confirm Password',type:'password',val:pass2,set:setPass2,ph:'Repeat password'}
          ].map(({id,label,type,val,set,ph})=>(
            <div className="form-group" key={id}>
              <label>{label}</label>
              <input type={type} className={`form-control ${errs[id]?'error':''}`}
                placeholder={ph} value={val}
                onChange={e=>{set(e.target.value);clr(id);}}
                onKeyDown={e=>e.key==='Enter'&&doReg()}/>
              {errs[id]&&<span className="field-error show">{errs[id]}</span>}
            </div>
          ))}
          {errs.general&&<div style={{color:'#f87171',fontSize:13,marginBottom:12}}>⚠ {errs.general}</div>}
          <button className="btn btn-primary btn-full btn-lg mt-md" onClick={doReg}>Create Account →</button>
          <div className="auth-footer">Already have an account? <a onClick={()=>navigate('login')}>Sign in</a></div>
        </div>
      </div>
    </div>
  );
}
