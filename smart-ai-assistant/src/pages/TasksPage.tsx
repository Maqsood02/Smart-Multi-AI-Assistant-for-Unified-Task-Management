import { useState } from 'react';
import { useApp } from '../context/AppContext';
import { Auth } from '../data/auth';
import { DB } from '../data/db';
import { AITaskCard } from '../components/common/AITaskCard';
import { EmptyState } from '../components/common/EmptyState';
import { useToasts, ToastContainer } from '../components/common/Toast';
import type { AITask } from '../types';

export function TasksPage() {
  const { navigate, refresh } = useApp();
  const user = Auth.current()!;
  const { toasts, toast } = useToasts();

  const [tab,       setTab]       = useState<'all'|'active'|'completed'>('all');
  const [search,    setSearch]    = useState('');
  const [typeF,     setTypeF]     = useState('all');
  const [priorityF, setPriorityF] = useState('all');
  const [sort,      setSort]      = useState('newest');

  const all = DB.forUser(user.id);
  const counts = {
    all: all.length,
    active: all.filter(t=>t.status!=='completed').length,
    completed: all.filter(t=>t.status==='completed').length
  };

  const filtered = all
    .filter(t=>{
      if(tab==='active'    && t.status!=='pending')   return false;
      if(tab==='completed' && t.status!=='completed') return false;
      if(search.trim()){const q=search.toLowerCase();if(!t.title.toLowerCase().includes(q)&&!t.prompt.toLowerCase().includes(q))return false;}
      if(typeF!=='all'     && t.taskType!==typeF)     return false;
      if(priorityF!=='all' && t.priority!==priorityF) return false;
      return true;
    })
    .sort((a,b)=>{
      if(sort==='newest')   return new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime();
      if(sort==='priority'){const m:Record<string,number>={high:3,medium:2,low:1,'':0};return(m[b.priority]||0)-(m[a.priority]||0);}
      if(sort==='deadline'){if(!a.dueDate&&!b.dueDate)return 0;if(!a.dueDate)return 1;if(!b.dueDate)return -1;return new Date(a.dueDate).getTime()-new Date(b.dueDate).getTime();}
      return 0;
    });

  const pending   = filtered.filter(t=>t.status!=='completed');
  const completed = filtered.filter(t=>t.status==='completed');

  const handleToggle = (id:number)=>{const s=DB.toggle(id);refresh();toast(s==='completed'?'✅ Marked completed!':'↺ Reopened.','success');};
  const handleDelete = (id:number)=>{DB.delete(id);refresh();toast('🗑 Deleted.','info');};
  const handleRerun  = (task:AITask)=>navigate('create-task',task);

  return (
    <>
      <ToastContainer toasts={toasts}/>
      <div className="page-header">
        <h2>📋 AI Tasks</h2>
        <p>All AI-generated tasks. Filter, sort, complete, and manage instantly.</p>
      </div>

      {/* Filter Tabs */}
      <div className="filter-tabs">
        {([['all','All Tasks',counts.all],['active','⏳ Active',counts.active],['completed','✅ Done',counts.completed]] as const).map(([key,label,count])=>(
          <button key={key} className={`filter-tab ${tab===key?'active':''}`} onClick={()=>setTab(key as typeof tab)}>
            {label}<span className={`tab-count ${tab===key?'active':''}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* Smart Filter Bar */}
      <div className="smart-filter-bar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input className="filter-input" placeholder="Search tasks…" value={search} onChange={e=>setSearch(e.target.value)}/>
        </div>
        <div className="filter-group">
          <span className="filter-label">Type:</span>
          <select className="filter-select" value={typeF} onChange={e=>setTypeF(e.target.value)}>
            <option value="all">All Types</option>
            {['content','code','image','task','story','summary','imageSummary','codeCheck','humanize','grammar','general'].map(t=>(
              <option key={t} value={t}>{t}</option>
            ))}
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">Priority:</span>
          <select className="filter-select" value={priorityF} onChange={e=>setPriorityF(e.target.value)}>
            <option value="all">All</option>
            <option value="high">🔴 High</option><option value="medium">🟡 Medium</option><option value="low">🟢 Low</option>
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">Sort:</span>
          <select className="filter-select" value={sort} onChange={e=>setSort(e.target.value)}>
            <option value="newest">Newest</option><option value="priority">Priority</option><option value="deadline">Deadline</option>
          </select>
        </div>
      </div>

      {/* Active Tasks */}
      {tab!=='completed'&&(
        <>
          <div className="section-row">
            <div className="section-title" style={{marginBottom:0,fontSize:15}}>
              ⏳ Active <span className="count-chip">{pending.length}</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={()=>navigate('create-task')}>+ New AI Task</button>
          </div>
          <div className="ai-tasks-grid" style={{marginBottom:26}}>
            {pending.length===0
              ? <EmptyState icon={search||typeF!=='all'?'🔍':'✨'}
                  title={search||typeF!=='all'?'No matching tasks':'No active tasks'}
                  desc={tab==='active'?'All tasks completed!':'Create your first AI task.'}
                  action={!search&&typeF==='all'?{label:'🚀 Create AI Task',onClick:()=>navigate('create-task')}:undefined}/>
              : pending.map((t,i)=><AITaskCard key={t.id} task={t} onToggle={handleToggle} onDelete={handleDelete} onRerun={handleRerun} animDelay={i*0.04}/>)
            }
          </div>
        </>
      )}

      {/* Completed Tasks */}
      {tab!=='active'&&completed.length>0&&(
        <>
          <div className="tasks-divider">
            <div className="tasks-divider-line"/><div className="tasks-divider-label">✅ Completed ({completed.length})</div><div className="tasks-divider-line"/>
          </div>
          <div className="ai-tasks-grid">
            {completed.map((t,i)=><AITaskCard key={t.id} task={t} onToggle={handleToggle} onDelete={handleDelete} onRerun={handleRerun} animDelay={i*0.04}/>)}
          </div>
        </>
      )}
    </>
  );
}
