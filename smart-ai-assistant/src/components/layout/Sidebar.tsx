import type { Page } from '../../types';
import { useApp } from '../../context/AppContext';
import { DB } from '../../data/db';
import { initials } from '../../utils/helpers';
import { getAnyKeyAvailable } from '../../services/aiGateway';

interface Props { open: boolean; onClose: () => void; }

const NAV: { page: Page; icon: string; label: string; pendingCount?: boolean }[] = [
  { page: 'dashboard',   icon: '🏠', label: 'Dashboard' },
  { page: 'tools',       icon: '🤖', label: 'AI Tools' },
  { page: 'tasks',       icon: '📋', label: 'Tasks', pendingCount: true },
  { page: 'history',     icon: '📜', label: 'History' },
  { page: 'create-task', icon: '➕', label: 'New AI Task' },
  { page: 'quiz',        icon: '🧠', label: 'AI Quiz' },
];

const TOOL_CHIPS = [
  { icon:'📝', label:'Content' }, { icon:'💻', label:'Code' },
  { icon:'🎨', label:'Image' },   { icon:'📋', label:'Tasks' },
  { icon:'📖', label:'Story' },   { icon:'📄', label:'Summary' },
  { icon:'🖼️', label:'Img Sum' }, { icon:'🔍', label:'Check' },
  { icon:'🧑', label:'Humanize' },{ icon:'✏️', label:'Grammar' }
];

export function Sidebar({ open, onClose }: Props) {
  const { session, page, navigate, logout } = useApp();
  const stats  = session ? DB.stats(session.id) : { total:0, completed:0, pending:0 };
  const ui     = session ? initials(session.name) : 'U';
  const hasKey = getAnyKeyAvailable();

  return (
    <>
      <div className={`sidebar-overlay ${open ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${open ? 'open' : ''}`}>

        <div className="sb-brand">
          <div className="sb-brand-icon">🤖</div>
          <div className="sb-brand-text">
            Smart AI Assistant
            <span>Unified Multi-AI Platform</span>
          </div>
        </div>

        <div className="ai-status">
          <div className="ai-status-dot" style={{ background: hasKey ? 'var(--accent3)' : 'var(--danger)' }} />
          <span>{hasKey ? 'AI Ready ✓' : 'No API Key'}</span>
        </div>

        <div className="sb-section">
          <div className="sb-label">Navigation</div>
          {NAV.map(({ page: p, icon, label, pendingCount }) => (
            <a key={p} className={`nav-item ${page === p ? 'active' : ''}`}
               onClick={() => { navigate(p); onClose(); }}>
              <span className="nav-icon">{icon}</span>
              {label}
              {p === 'quiz' && <span style={{ fontSize:10, background:'rgba(91,158,249,0.2)', color:'var(--accent-l)', padding:'1px 6px', borderRadius:100, marginLeft:4, fontWeight:700 }}>NEW</span>}
              {pendingCount && stats.pending > 0 && <span className="nav-badge">{stats.pending}</span>}
            </a>
          ))}
        </div>

        <div className="sb-section">
          <div className="sb-label">AI Tools (10)</div>
          <div className="sb-tools-grid" style={{ gridTemplateColumns:'repeat(2,1fr)' }}>
            {TOOL_CHIPS.map(t => (
              <div key={t.label} className="sb-tool-chip"
                   onClick={() => { navigate('tools'); onClose(); }}>
                <span className="chip-ico">{t.icon}</span>
                {t.label}
              </div>
            ))}
          </div>
        </div>

        <div className="sb-section">
          <div className="sb-label">Stats</div>
          <div style={{ padding:'10px 12px', background:'rgba(91,158,249,0.06)', border:'1px solid var(--border)', borderRadius:10 }}>
            {[
              { label:'Total AI Tasks', val:stats.total,     color:'var(--text)' },
              { label:'Completed',      val:stats.completed, color:'var(--accent3)' },
              { label:'Pending',        val:stats.pending,   color:'var(--warning)' }
            ].map(s => (
              <div key={s.label} style={{ display:'flex', justifyContent:'space-between', marginBottom:8, fontSize:12 }}>
                <span style={{ color:'var(--text3)' }}>{s.label}</span>
                <strong style={{ color:s.color }}>{s.val}</strong>
              </div>
            ))}
          </div>
        </div>

        <div className="sb-footer">
          <div className="user-chip">
            <div className="user-avatar">{ui}</div>
            <div className="user-info">
              <div className="user-name">{session?.name || 'User'}</div>
              <div className="user-role">AI Platform User</div>
            </div>
            <span className="logout-btn" title="Logout" onClick={logout}>⏻</span>
          </div>
        </div>
      </aside>
    </>
  );
}
