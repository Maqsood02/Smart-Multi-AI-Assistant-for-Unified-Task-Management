import { useApp } from '../context/AppContext';
import { ALL_TOOLS, TOOL_COLOR_CLASSES } from '../utils/helpers';
import type { Page } from '../types';

export function AIToolsPage() {
  const { navigate } = useApp();

  return (
    <>
      <div className="page-header">
        <h2>🤖 AI Tools</h2>
        <p>10 AI tools in one platform. All support 🎤 voice input. Auto-switches AI providers on failure.</p>
      </div>

      <div style={{display:'flex',gap:10,flexWrap:'wrap',marginBottom:20}}>
        <span style={{fontSize:12,padding:'5px 12px',background:'rgba(16,185,129,0.1)',border:'1px solid rgba(16,185,129,0.25)',borderRadius:100,color:'var(--accent3)',fontWeight:600}}>
          ✅ 4 Existing Tools
        </span>
        <span style={{fontSize:12,padding:'5px 12px',background:'rgba(59,130,246,0.1)',border:'1px solid rgba(59,130,246,0.25)',borderRadius:100,color:'var(--accent-l)',fontWeight:600}}>
          ✨ 6 New Tools
        </span>
        <span style={{fontSize:12,padding:'5px 12px',background:'rgba(236,72,153,0.1)',border:'1px solid rgba(236,72,153,0.25)',borderRadius:100,color:'#f472b6',fontWeight:600}}>
          🎤 All Support Voice Input
        </span>
      </div>

      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:18}}>
        {ALL_TOOLS.map((t,i)=>{
          const colors = TOOL_COLOR_CLASSES[t.color]||TOOL_COLOR_CLASSES.blue;
          return (
            <div key={t.id} className="tool-card anim-fadeInUp"
              style={{padding:24,animationDelay:`${i*0.05}s`,cursor:'pointer',borderColor: colors.border}}
              onClick={()=>navigate(t.page as Page)}>
              <div style={{display:'flex',alignItems:'center',gap:14,marginBottom:14}}>
                <div style={{width:52,height:52,borderRadius:14,background:colors.bg,border:`1px solid ${colors.border}`,
                  display:'flex',alignItems:'center',justifyContent:'center',fontSize:26,flexShrink:0}}>
                  {t.icon}
                </div>
                <div>
                  <div style={{fontSize:15,fontWeight:700,color:'var(--text)',marginBottom:4}}>{t.name}</div>
                  <div style={{display:'flex',gap:6,flexWrap:'wrap'}}>
                    <span className="ai-badge" style={{fontSize:10}}>🤖 AI Powered</span>
                    <span className="ai-badge" style={{fontSize:10,background:'rgba(236,72,153,0.1)',borderColor:'rgba(236,72,153,0.25)',color:'#f472b6'}}>🎤 Voice</span>
                    {t.category==='new'&&<span className="ai-badge" style={{fontSize:10,background:'rgba(16,185,129,0.1)',borderColor:'rgba(16,185,129,0.25)',color:'var(--accent3)'}}>✨ NEW</span>}
                  </div>
                </div>
              </div>
              <div style={{fontSize:13,color:'var(--text2)',lineHeight:1.65,marginBottom:12}}>{t.description}</div>
              <div style={{fontSize:11,fontWeight:700,color:'var(--text3)',marginBottom:8,textTransform:'uppercase',letterSpacing:'0.07em'}}>
                Input placeholder:
              </div>
              <div style={{fontSize:12,color:'var(--text2)',padding:'8px 11px',background:'rgba(0,0,0,0.2)',borderRadius:8,fontStyle:'italic',lineHeight:1.6}}>
                "{t.inputPlaceholder.slice(0,80)}…"
              </div>
              <div className="tool-card-action" style={{marginTop:16,paddingTop:12,color:colors.text}}>
                Open {t.shortName} →
              </div>
            </div>
          );
        })}
      </div>
    </>
  );
}
