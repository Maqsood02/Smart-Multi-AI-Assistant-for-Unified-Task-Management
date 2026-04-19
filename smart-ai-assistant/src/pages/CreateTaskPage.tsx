import { useState } from 'react';
import type { TaskType, Priority, GenerationStatus } from '../types';
import { useApp } from '../context/AppContext';
import { Auth } from '../data/auth';
import { DB } from '../data/db';
import { generateWithFallback, getAnyKeyAvailable } from '../services/aiGateway';
import { VoiceTextarea } from '../components/common/VoiceInput';
import { TypingDots } from '../components/common/TypingDots';
import { useToasts, ToastContainer } from '../components/common/Toast';

export function CreateTaskPage() {
  const { navigate, refresh, payload } = useApp();
  const user = Auth.current()!;
  const { toasts, toast } = useToasts();
  const pre = payload as {preType?:string;prePrompt?:string;prompt?:string;taskType?:string}|undefined;

  const [taskType, setTaskType] = useState<TaskType>((pre?.preType||pre?.taskType||'content') as TaskType);
  const [prompt,   setPrompt]   = useState(pre?.prePrompt||pre?.prompt||'');
  const [priority, setPriority] = useState<Priority>('');
  const [dueDate,  setDueDate]  = useState('');
  const [errs,     setErrs]     = useState<Record<string,string>>({});
  const [running,  setRunning]  = useState(false);
  const [done,     setDone]     = useState(false);
  const [status,   setStatus]   = useState<GenerationStatus|null>(null);

  const TYPES = [
    {id:'content',icon:'📝',label:'Content'},  {id:'code',icon:'💻',label:'Code'},
    {id:'image',icon:'🎨',label:'Image'},       {id:'task',icon:'📋',label:'Tasks'},
    {id:'story',icon:'📖',label:'Story'},        {id:'summary',icon:'📄',label:'Summary'},
    {id:'imageSummary',icon:'🖼️',label:'Img Sum'},{id:'codeCheck',icon:'🔍',label:'Check'},
    {id:'humanize',icon:'🧑',label:'Humanize'},  {id:'grammar',icon:'✏️',label:'Grammar'}
  ];

  const doRun = async () => {
    const e:Record<string,string>={};
    if(!prompt.trim())              e.prompt='⚠️ Please describe what you want AI to do.';
    if(prompt.trim()&&DB.isDuplicate(user.id,prompt)) e.prompt='⚠️ A task with this prompt already exists.';
    if(Object.keys(e).length){setErrs(e);return;}
    if(!getAnyKeyAvailable()){toast('⚙️ No API key. Go to ⚙️ Settings.','error');return;}

    setRunning(true); setErrs({}); setStatus({message:'Initializing AI…'});
    try {
      const {text,provider} = await generateWithFallback(prompt.trim(),taskType,(s)=>setStatus(s));
      DB.add({userId:user.id,taskType,title:prompt.trim().slice(0,80)+(prompt.length>80?'…':''),
        prompt:prompt.trim(),aiOutput:text,priority,dueDate,status:'pending',provider});
      refresh();
      setDone(true);
      toast(`🎉 AI Task created! (${provider})`,'success');
      setTimeout(()=>navigate('tasks'),1300);
    } catch(err){
      toast(`❌ ${err instanceof Error?err.message:'Failed'}`,'error');
    } finally{setRunning(false);}
  };

  if(running) return(
    <>
      <ToastContainer toasts={toasts}/>
      <div className="page-header"><h2>🤖 Running AI Task…</h2><p>Processing with Gemini AI…</p></div>
      <div className="ct-card" style={{maxWidth:600,margin:'0 auto'}}>
        <div className="ai-loading-box">
          <div className="ai-loading-icon">🤖</div>
          <TypingDots/>
          <div className="thinking-text">{status?.message||'AI is thinking…'}</div>
          {status?.provider&&<div className="thinking-sub">Using {status.provider}…</div>}
          <div className="ai-prompt-text" style={{marginTop:20,textAlign:'left',maxWidth:440,width:'100%'}}>{prompt}</div>
        </div>
      </div>
    </>
  );

  if(done) return(
    <div className="ct-card" style={{maxWidth:520,margin:'60px auto',textAlign:'center',padding:40}}>
      <div style={{fontSize:56,marginBottom:16}}>✅</div>
      <h3 style={{fontSize:20,marginBottom:8,fontWeight:800}}>AI Task Created!</h3>
      <p style={{color:'var(--text2)'}}>Saved and redirecting to Tasks…</p>
    </div>
  );

  return (
    <>
      <ToastContainer toasts={toasts}/>
      <div className="page-header"><h2>➕ Create AI Task</h2><p>Choose a task type, describe what you need, and let AI do the work.</p></div>
      <div className="create-task-layout">
        <div className="ct-card">
          <h3>🎯 New AI Request</h3>
          <div className="form-group">
            <label>Task Type *</label>
            <div className="task-type-grid" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
              {TYPES.map(t=>(
                <div key={t.id} className={`type-opt ${t.id} ${taskType===t.id?'selected':''}`} onClick={()=>setTaskType(t.id as TaskType)}>
                  <span className="type-ico">{t.icon}</span>{t.label}
                </div>
              ))}
            </div>
          </div>
          <VoiceTextarea label="Describe what you want AI to do *"
            value={prompt} onChange={p=>{setPrompt(p);setErrs(e=>{const n={...e};delete n.prompt;return n;});}}
            placeholder={`Enter your prompt for ${taskType} AI…`} rows={5}/>
          {errs.prompt&&<span className="field-error show">{errs.prompt}</span>}
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:16,marginTop:16}}>
            <div className="form-group">
              <label>Priority</label>
              <select className="form-control" value={priority} onChange={e=>setPriority(e.target.value as Priority)}>
                <option value="">No priority</option>
                <option value="high">🔴 High</option><option value="medium">🟡 Medium</option><option value="low">🟢 Low</option>
              </select>
            </div>
            <div className="form-group">
              <label>Deadline (optional)</label>
              <input type="date" className="form-control" value={dueDate} onChange={e=>setDueDate(e.target.value)}/>
            </div>
          </div>
          {!getAnyKeyAvailable()&&(
            <div style={{padding:'12px 16px',background:'rgba(239,68,68,0.07)',border:'1px solid rgba(239,68,68,0.2)',borderRadius:10,fontSize:13,color:'#f87171',marginBottom:18}}>
              ⚠️ No API key. <span style={{cursor:'pointer',textDecoration:'underline'}} onClick={()=>navigate('settings')}>Go to Settings →</span>
            </div>
          )}
          <button className="run-btn" onClick={doRun} disabled={running||!prompt.trim()}>🚀 Run AI Task</button>
        </div>
        <div className="ct-tips">
          <h4>💡 Tips</h4>
          <div className="tip-item"><span className="tip-num">1</span><span>Use 🎤 voice input — click the mic icon to speak your prompt.</span></div>
          <div className="tip-item"><span className="tip-num">2</span><span>Be specific and detailed for best AI results.</span></div>
          <div className="tip-item"><span className="tip-num">3</span><span>Choose the right task type — it changes the AI's behavior.</span></div>
          <div className="tip-item"><span className="tip-num">4</span><span>If one AI fails, the system automatically tries the next.</span></div>
          <div style={{marginTop:20,padding:14,background:'rgba(59,130,246,0.06)',border:'1px solid var(--border)',borderRadius:12,fontSize:12}}>
            <div style={{fontWeight:700,color:'var(--accent-l)',marginBottom:6}}>🔁 AI Fallback Chain</div>
            <div style={{color:'var(--text2)',lineHeight:1.7}}>Groq → Gemini → OpenRouter<br/>→ Cloudflare → HuggingFace<br/><span style={{color:'var(--accent3)'}}>Auto-switches on failure</span></div>
          </div>
        </div>
      </div>
    </>
  );
}
