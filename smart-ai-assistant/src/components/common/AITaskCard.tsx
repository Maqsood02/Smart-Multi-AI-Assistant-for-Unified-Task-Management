// ════════════════════════════════════════════════════════════
//  AI TASK CARD — Displays one saved AI task with all actions
// ════════════════════════════════════════════════════════════
import { useState } from 'react';
import type { AITask } from '../../types';
import { formatDate } from '../../utils/helpers';
import { ALL_TOOLS } from '../../utils/helpers';

const TYPE_LABEL: Record<string, string> = Object.fromEntries(
  ALL_TOOLS.map(t => [t.id, `${t.icon} ${t.shortName}`])
);

function copyToClipboard(text: string) {
  navigator.clipboard?.writeText(text).catch(() => {
    const el = document.createElement('textarea');
    el.value = text;
    document.body.appendChild(el);
    el.select();
    document.execCommand('copy');
    document.body.removeChild(el);
  });
}

interface Props {
  task:      AITask;
  onToggle:  (id: number) => void;
  onDelete:  (id: number) => void;
  onRerun:   (task: AITask) => void;
  animDelay?: number;
}

export function AITaskCard({ task, onToggle, onDelete, onRerun, animDelay = 0 }: Props) {
  const [expanded, setExpanded] = useState(false);
  const isLong = task.aiOutput.length > 350;
  const isDone = task.status === 'completed';

  const handleDelete = () => {
    if (window.confirm('Delete this AI task? This cannot be undone.')) onDelete(task.id);
  };

  return (
    <div
      className={`ai-task-card ${isDone ? 'done' : ''} anim-fadeInUp`}
      style={{ animationDelay: `${animDelay}s` }}
    >
      {/* ── Header ── */}
      <div className="ai-task-header">
        <div className="ai-task-header-left">
          <span className="ai-badge">🤖 AI Generated</span>
          <span className={`task-type-badge ${task.taskType}`}>
            {TYPE_LABEL[task.taskType] || task.taskType}
          </span>
          {task.priority && (
            <span className={`priority-badge ${task.priority}`}>
              {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'}{' '}
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </span>
          )}
          {task.provider && (
            <span className="ai-badge gemini" style={{ fontSize: 10 }}>
              ⚡ {task.provider}
            </span>
          )}
        </div>
        <span className={`status-badge ${task.status}`}>
          {isDone ? '✅ Completed' : '⏳ Pending'}
        </span>
      </div>

      {/* ── Body ── */}
      <div className="ai-task-body">
        <div className="ai-task-title">{task.title}</div>

        <div className="ai-prompt-section">
          <div className="ai-prompt-section-label">💬 Prompt</div>
          <div className="ai-prompt-bubble">{task.prompt}</div>
        </div>

        <div className="ai-output-section">
          <div className="ai-output-section-label">
            ⚡ AI Output &nbsp;—&nbsp;
            <span className="ai-badge gemini" style={{ fontSize: 10, padding: '1px 7px' }}>
              ✨ {task.provider || 'AI'}
            </span>
          </div>
          <div className={`ai-output-content ${!expanded && isLong ? 'collapsed' : ''}`}>
            {task.aiOutput}
          </div>
          {isLong && (
            <button className="expand-btn" onClick={() => setExpanded(e => !e)}>
              {expanded ? '▲ Show less' : '▼ Show more'}
            </button>
          )}
        </div>

        <div className="ai-task-meta">
          {task.dueDate && <span>📅 {task.dueDate}</span>}
          <span>🕐 {formatDate(task.createdAt)}</span>
        </div>
      </div>

      {/* ── Footer Actions ── */}
      <div className="ai-task-footer">
        <div className="ai-task-footer-left">
          <button className="act-btn run"  onClick={() => onRerun(task)} title="Re-run with AI">↺ Re-run</button>
          <button className="act-btn copy" onClick={() => copyToClipboard(task.aiOutput)} title="Copy output">📋 Copy</button>
        </div>
        <div className="ai-task-footer-right">
          {!isDone
            ? <button className="act-btn done" onClick={() => onToggle(task.id)}>✔️ Mark Done</button>
            : <button className="act-btn undo" onClick={() => onToggle(task.id)}>↺ Reopen</button>
          }
          <button className="act-btn del" onClick={handleDelete}>🗑 Delete</button>
        </div>
      </div>
    </div>
  );
}
