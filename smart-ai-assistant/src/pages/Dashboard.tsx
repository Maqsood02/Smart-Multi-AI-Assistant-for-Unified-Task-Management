// ════════════════════════════════════════════════════════════
//  DASHBOARD — AI workspace home with live input + stats
// ════════════════════════════════════════════════════════════
import { useState, useRef, useCallback } from 'react';
import type { GenerationStatus } from '../types';
import { useApp } from '../context/AppContext';
import { Auth } from '../data/auth';
import { DB } from '../data/db';
import { generateWithFallback, getAnyKeyAvailable } from '../services/aiGateway';
import { AITaskCard } from '../components/common/AITaskCard';
import { TypingDots } from '../components/common/TypingDots';
import { VoiceInput } from '../components/common/VoiceInput';
import { ALL_TOOLS } from '../utils/helpers';
import { useToasts, ToastContainer } from '../components/common/Toast';

const SUGGESTED = [
  {icon:'✍️', text:'Write a blog post about the future of AI in 2025'},
  {icon:'💻', text:'Generate Python code for a login system with JWT'},
  {icon:'📖', text:'Write a short mystery story set in a smart city'},
  {icon:'📋', text:'Plan a 3-month roadmap for launching a mobile app'},
  {icon:'🎨', text:'Describe a futuristic city at night for an AI image'}
];

export function Dashboard() {
  const { navigate, refresh, tick } = useApp();
  const user    = Auth.current()!;
  const stats   = DB.stats(user.id);
  const recent  = DB.forUser(user.id).slice(0, 3);
  const { toasts, toast } = useToasts();

  const [prompt,       setPrompt]       = useState('');
  const [aiOutput,     setAiOutput]     = useState('');
  const [aiPromptSent, setAiPromptSent] = useState('');
  const [thinking,     setThinking]     = useState(false);
  const [status,       setStatus]       = useState<GenerationStatus | null>(null);
  const [provider,     setProvider]     = useState('');
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const handleVoice = useCallback((text: string) => { setPrompt(text); }, []);

  const sendPrompt = async (p: string) => {
    const text = (p || prompt).trim();
    if (!text) return;
    if (!getAnyKeyAvailable()) {
      toast('⚙️ No API key configured. Go to ⚙️ Settings.', 'error');
      return;
    }

    setAiPromptSent(text);
    setAiOutput('');
    setThinking(true);
    setStatus({ message: 'Starting AI…' });

    try {
      const { text: result, provider: prov } = await generateWithFallback(
        text, 'general',
        (s: GenerationStatus) => setStatus(s)
      );
      setAiOutput(result);
      setProvider(prov);
      setStatus(null);
      DB.add({ userId:user.id, taskType:'general', title:text.slice(0,70)+(text.length>70?'…':''),
        prompt:text, aiOutput:result, priority:'', dueDate:'', status:'pending', provider:prov });
      refresh();
      toast(`✅ Response saved! (${prov})`, 'success');
    } catch(err) {
      const msg = err instanceof Error ? err.message : 'Error';
      toast(`❌ ${msg}`, 'error');
      setAiPromptSent('');
    } finally { setThinking(false); setPrompt(''); }
  };

  const handleToggle = (id:number) => { DB.toggle(id); refresh(); };
  const handleDelete = (id:number) => { DB.delete(id); refresh(); toast('Task deleted.','info'); };

  const greetHour = new Date().getHours();
  const greetWord = greetHour<12?'Good morning':greetHour<17?'Good afternoon':'Good evening';

  return (
    <>
      <ToastContainer toasts={toasts}/>

      <div className="dash-greeting">
        <h2>{greetWord}, <span className="gradient-text">{user.name.split(' ')[0]}</span> 👋</h2>
        <p>What do you want to do today? Type or speak your request, or pick an AI tool below.</p>
      </div>

      {/* ── AI Input Box ── */}
      <div className="ai-input-section">
        <div className="ai-input-box">
          <div className="ai-input-top">
            🤖 <span>Smart AI Assistant</span>
            <span style={{marginLeft:'auto',fontSize:11,opacity:0.7}}>
              {getAnyKeyAvailable()?'🟢 AI Ready':'🔴 No API Key'}
            </span>
          </div>
          <textarea ref={textareaRef} className="ai-input-textarea"
            placeholder={'Ask anything...\n"Write a blog about AI"  |  "Generate Python code"  |  "Plan my project"'}
            value={prompt} rows={3}
            onChange={e=>setPrompt(e.target.value)}
            onKeyDown={e=>{if(e.key==='Enter'&&!e.shiftKey){e.preventDefault();sendPrompt(prompt);}}}
            disabled={thinking}/>
          <div className="ai-input-bottom">
            <div style={{display:'flex',alignItems:'center',gap:10}}>
              <div className="ai-input-hint">⏎ Send &nbsp;·&nbsp; Shift+Enter new line</div>
              <VoiceInput onTranscript={handleVoice} disabled={thinking}/>
            </div>
            <button className="ai-send-btn" onClick={()=>sendPrompt(prompt)} disabled={thinking||!prompt.trim()}>
              {thinking?'Sending…':'✨ Ask AI →'}
            </button>
          </div>
        </div>
        <div className="prompt-chips">
          {SUGGESTED.map(s=>(
            <span key={s.text} className="prompt-chip" onClick={()=>!thinking&&sendPrompt(s.text)}>
              {s.icon} {s.text}
            </span>
          ))}
        </div>
      </div>

      {/* ── AI Thinking ── */}
      {thinking&&status&&(
        <div className="ai-live-output">
          <div className="ai-thinking">
            <div className="ai-loading-icon">🤖</div>
            <TypingDots/>
            <div className="thinking-text">{status.message}</div>
            {status.provider&&<div className="thinking-sub">Using {status.provider}…</div>}
          </div>
        </div>
      )}

      {/* ── AI Response ── */}
      {aiOutput&&!thinking&&(
        <div className="ai-live-output">
          <div className="ai-output-header">
            <div className="ai-output-header-left">
              <span className="ai-badge">🤖 AI Generated</span>
              <span className="ai-badge gemini">✨ {provider}</span>
            </div>
            <button className="act-btn copy" onClick={()=>navigator.clipboard?.writeText(aiOutput)}>📋 Copy</button>
          </div>
          <div className="ai-prompt-label">💬 Your prompt:</div>
          <div className="ai-prompt-text">{aiPromptSent}</div>
          <div className="ai-response-label">⚡ AI Response:</div>
          <div className="ai-response-text">{aiOutput}</div>
        </div>
      )}

      {/* ── Stats ── */}
      <div className="dash-stats">
        {[
          {cls:'blue',  icon:'📋', val:stats.total,     label:'Total AI Tasks'},
          {cls:'green', icon:'✅', val:stats.completed, label:'Completed'},
          {cls:'purple',icon:'⏳', val:stats.pending,   label:'Pending'},
          {cls:'amber', icon:'📅', val:stats.today,     label:"Today's Tasks"}
        ].map((s,i)=>(
          <div className={`stat-card ${s.cls} anim-fadeInUp`} key={s.label}
            style={{animationDelay:`${i*0.06}s`}}>
            <div className="stat-icon-wrap">{s.icon}</div>
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── 10 AI Tool Cards ── */}
      <div className="section-title" style={{marginBottom:14}}>
        🤖 AI Tools (10)
        <span style={{fontSize:12,color:'var(--text3)',fontWeight:500,marginLeft:6}}>— Pick a tool</span>
      </div>
      <div className="tools-grid" style={{gridTemplateColumns:'repeat(5,1fr)'}}>
        {ALL_TOOLS.map((t,i)=>(
          <div key={t.id} className={`tool-card ${t.color} anim-fadeInUp`}
            style={{animationDelay:`${0.12+i*0.05}s`}}
            onClick={()=>navigate(t.page as import('../types').Page)}>
            <div className="tool-card-icon">{t.icon}</div>
            <div className="tool-card-title" style={{fontSize:13}}>{t.shortName}</div>
            <div className="tool-card-desc" style={{fontSize:11.5,marginBottom:6}}>{t.description.slice(0,55)}…</div>
            {t.category==='new'&&<span style={{fontSize:10,fontWeight:700,color:'var(--accent3)'}}>✨ NEW</span>}
            <div className="tool-card-action" style={{fontSize:11}}>Use →</div>
          </div>
        ))}
      </div>

      {/* ── Recent Tasks ── */}
      {recent.length>0&&(
        <>
          <div className="section-row" style={{marginBottom:14,marginTop:6}}>
            <div className="section-title" style={{marginBottom:0,fontSize:15}}>⚡ Recent AI Tasks</div>
            <button className="btn btn-ghost btn-sm" onClick={()=>navigate('tasks')}>View all →</button>
          </div>
          <div className="ai-tasks-grid">
            {recent.map((t,i)=>(
              <AITaskCard key={t.id} task={t}
                onToggle={handleToggle} onDelete={handleDelete}
                onRerun={task=>navigate('create-task',task)}
                animDelay={i*0.05}/>
            ))}
          </div>
        </>
      )}
    </>
  );
}
