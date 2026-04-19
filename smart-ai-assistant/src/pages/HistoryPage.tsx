import { useApp } from '../context/AppContext';
import { Auth } from '../data/auth';
import { DB } from '../data/db';
import { AITaskCard } from '../components/common/AITaskCard';
import { EmptyState } from '../components/common/EmptyState';
import { formatDateFull } from '../utils/helpers';
import type { AITask } from '../types';
import { useToasts, ToastContainer } from '../components/common/Toast';

export function HistoryPage() {
  const { navigate, refresh } = useApp();
  const user = Auth.current()!;
  const { toasts, toast } = useToasts();
  const tasks = DB.forUser(user.id).sort((a,b)=>new Date(b.createdAt).getTime()-new Date(a.createdAt).getTime());

  const handleToggle = (id:number)=>{ DB.toggle(id); refresh(); };
  const handleDelete = (id:number)=>{ DB.delete(id); refresh(); toast('Deleted.','info'); };
  const handleRerun  = (task:AITask)=>navigate('create-task',task);

  if(!tasks.length) return(
    <>
      <div className="page-header"><h2>📜 History</h2><p>Complete AI activity log.</p></div>
      <EmptyState icon="🤖" title="No AI history yet" desc="Run your first AI task!"
        action={{label:'🚀 Create AI Task',onClick:()=>navigate('create-task')}}/>
    </>
  );

  const groups: Record<string,AITask[]>={};
  tasks.forEach(t=>{
    const key=formatDateFull(t.createdAt);
    if(!groups[key]) groups[key]=[];
    groups[key].push(t);
  });

  return (
    <>
      <ToastContainer toasts={toasts}/>
      <div className="page-header">
        <h2>📜 History</h2>
        <p>All {tasks.length} AI tasks — grouped by date.</p>
      </div>
      {Object.entries(groups).map(([date,dateTasks])=>(
        <div key={date} style={{marginBottom:28}}>
          <div className="tasks-divider">
            <div className="tasks-divider-line"/>
            <div className="tasks-divider-label">📅 {date}</div>
            <div className="tasks-divider-line"/>
          </div>
          <div className="ai-tasks-grid">
            {dateTasks.map((t,i)=>(
              <AITaskCard key={t.id} task={t} onToggle={handleToggle} onDelete={handleDelete} onRerun={handleRerun} animDelay={i*0.04}/>
            ))}
          </div>
        </div>
      ))}
    </>
  );
}
