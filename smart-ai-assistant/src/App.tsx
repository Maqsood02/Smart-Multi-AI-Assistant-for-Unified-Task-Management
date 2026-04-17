import { useState, useEffect, useCallback } from 'react';

/* ════════════════════════════════════════
   STORAGE
════════════════════════════════════════ */
const Storage = {
  get: <T,>(key: string, fallback: T): T => {
    try {
      const v = localStorage.getItem(key);
      return v ? (JSON.parse(v) as T) : fallback;
    } catch {
      return fallback;
    }
  },
  set: (key: string, value: unknown) => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch {}
  },
  remove: (key: string) => {
    try { localStorage.removeItem(key); } catch {}
  }
};

/* ════════════════════════════════════════
   TYPES
════════════════════════════════════════ */
interface User {
  id: number;
  name: string;
  email: string;
  password: string;
}

interface Session {
  id: number;
  name: string;
  email: string;
}

interface Task {
  id: number;
  userId: number;
  title: string;
  description: string;
  priority: 'high' | 'medium' | 'low' | '';
  category: string;
  dueDate: string;
  done: boolean;
  createdAt: string;
}

type Page = 'login' | 'register' | 'dashboard' | 'tasks' | 'add-task';

/* ════════════════════════════════════════
   AUTH
════════════════════════════════════════ */
const Auth = {
  KEY: 'smai_users',
  SESSION: 'smai_session',
  getUsers: (): User[] => Storage.get<User[]>('smai_users', []),
  saveUsers: (u: User[]) => Storage.set('smai_users', u),
  register: (name: string, email: string, password: string): { ok: boolean; msg?: string } => {
    const users = Auth.getUsers();
    if (users.find(u => u.email === email)) return { ok: false, msg: 'Email already registered.' };
    users.push({ id: Date.now(), name, email, password });
    Auth.saveUsers(users);
    return { ok: true };
  },
  login: (email: string, password: string): { ok: boolean; user?: Session; msg?: string } => {
    const users = Auth.getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return { ok: false, msg: 'Invalid email or password.' };
    const session: Session = { id: user.id, name: user.name, email: user.email };
    Storage.set('smai_session', session);
    return { ok: true, user: session };
  },
  logout: () => Storage.remove('smai_session'),
  current: (): Session | null => Storage.get<Session | null>('smai_session', null),
  isLoggedIn: (): boolean => !!Auth.current()
};

/* ════════════════════════════════════════
   TASKS
════════════════════════════════════════ */
const TasksDB = {
  KEY: 'smai_tasks',
  all: (): Task[] => Storage.get<Task[]>('smai_tasks', []),
  forUser: (userId: number): Task[] => TasksDB.all().filter(t => t.userId === userId),
  add: (task: Omit<Task, 'id' | 'createdAt' | 'done'>) => {
    const tasks = TasksDB.all();
    tasks.unshift({ id: Date.now(), createdAt: new Date().toISOString(), done: false, ...task });
    Storage.set('smai_tasks', tasks);
  },
  toggle: (id: number) => {
    const tasks = TasksDB.all();
    const t = tasks.find(t => t.id === id);
    if (t) t.done = !t.done;
    Storage.set('smai_tasks', tasks);
  },
  delete: (id: number) => {
    Storage.set('smai_tasks', TasksDB.all().filter(t => t.id !== id));
  },
  stats: (userId: number) => {
    const tasks = TasksDB.forUser(userId);
    return {
      total: tasks.length,
      done: tasks.filter(t => t.done).length,
      pending: tasks.filter(t => !t.done).length,
      high: tasks.filter(t => t.priority === 'high' && !t.done).length
    };
  }
};

/* ════════════════════════════════════════
   HELPERS
════════════════════════════════════════ */
function esc(str: string): string {
  return String(str ?? '')
    .replace(/&/g, '&amp;').replace(/</g, '&lt;')
    .replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

/* ════════════════════════════════════════
   TOAST HOOK
════════════════════════════════════════ */
interface ToastMsg { id: number; msg: string; type: 'success' | 'error' | 'info'; }

function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 3200);
  }, []);
  return { toasts, toast };
}

/* ════════════════════════════════════════
   TOAST CONTAINER
════════════════════════════════════════ */
function ToastContainer({ toasts }: { toasts: ToastMsg[] }) {
  const icons: Record<string, string> = { success: '✅', error: '❌', info: 'ℹ️' };
  return (
    <div className="toast-container">
      {toasts.map(t => (
        <div key={t.id} className={`toast ${t.type}`}>
          <span>{icons[t.type]}</span>
          <span>{t.msg}</span>
        </div>
      ))}
    </div>
  );
}

/* ════════════════════════════════════════
   BADGE
════════════════════════════════════════ */
function PriorityBadge({ p }: { p: string }) {
  const cls: Record<string, string> = { high: 'red', medium: 'purple', low: 'green' };
  const lbl: Record<string, string> = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
  return <span className={`badge ${cls[p] || ''}`}>{lbl[p] || p}</span>;
}

/* ════════════════════════════════════════
   TASK CARD
════════════════════════════════════════ */
function TaskCard({
  task,
  onToggle,
  onDelete,
  showActions = true
}: {
  task: Task;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
  showActions?: boolean;
}) {
  return (
    <div className={`task-card ${task.done ? 'done' : ''}`}>
      <div className={`priority-dot ${task.priority}`} />
      <div
        className={`task-check ${task.done ? 'checked' : ''}`}
        onClick={() => onToggle(task.id)}
        title={task.done ? 'Mark pending' : 'Mark complete'}
      />
      <div className="task-body">
        <div className="task-title">{task.title}</div>
        {task.description && <div className="task-desc">{task.description}</div>}
        <div className="task-meta">
          <PriorityBadge p={task.priority} />
          {task.category && <span className="badge">{task.category}</span>}
          {task.dueDate && <span className="text-muted">📅 {task.dueDate}</span>}
          <span className="text-muted">🕐 {formatDate(task.createdAt)}</span>
        </div>
      </div>
      {showActions && (
        <div className="task-actions">
          <button
            className="btn btn-ghost btn-sm"
            title="Delete"
            onClick={() => {
              if (window.confirm('Delete this task?')) onDelete(task.id);
            }}
          >🗑️</button>
        </div>
      )}
    </div>
  );
}

/* ════════════════════════════════════════
   SIDEBAR
════════════════════════════════════════ */
function Sidebar({
  activePage,
  onNavigate,
  onLogout,
  sidebarOpen,
  onClose
}: {
  activePage: Page;
  onNavigate: (p: Page) => void;
  onLogout: () => void;
  sidebarOpen: boolean;
  onClose: () => void;
}) {
  const user = Auth.current();
  const stats = user ? TasksDB.stats(user.id) : { total: 0, done: 0, pending: 0, high: 0 };
  const userInitials = user ? initials(user.name) : 'U';

  return (
    <>
      {/* Overlay */}
      <div
        className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`}
        onClick={onClose}
      />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>
        {/* Logo */}
        <div className="sidebar-logo">
          <div className="sidebar-logo-icon">🤖</div>
          <div className="sidebar-logo-text">
            SmartAI
            <span>Multi-AI Assistant</span>
          </div>
        </div>

        {/* Nav */}
        <div className="sidebar-section">
          <div className="sidebar-label">Main</div>
          {([
            { page: 'dashboard' as Page, icon: '📊', label: 'Dashboard', badge: stats.pending > 0 ? stats.pending : null },
            { page: 'tasks' as Page, icon: '📋', label: 'All Tasks', badge: null },
            { page: 'add-task' as Page, icon: '➕', label: 'Add Task', badge: null }
          ]).map(({ page, icon, label, badge }) => (
            <a
              key={page}
              className={`nav-item ${activePage === page ? 'active' : ''}`}
              onClick={() => { onNavigate(page); onClose(); }}
            >
              <span className="nav-icon">{icon}</span>
              {label}
              {badge !== null && <span className="nav-badge">{badge}</span>}
            </a>
          ))}
        </div>

        {/* Quick Stats */}
        <div className="sidebar-section" style={{ marginTop: 8 }}>
          <div className="sidebar-label">Quick Stats</div>
          <div className="quick-stats-box">
            <div className="quick-stats-row">
              <span style={{ color: 'var(--muted)' }}>Total Tasks</span>
              <strong>{stats.total}</strong>
            </div>
            <div className="quick-stats-row">
              <span style={{ color: 'var(--muted)' }}>Completed</span>
              <strong style={{ color: 'var(--accent3)' }}>{stats.done}</strong>
            </div>
            <div className="quick-stats-row">
              <span style={{ color: 'var(--muted)' }}>Pending</span>
              <strong style={{ color: 'var(--accent)' }}>{stats.pending}</strong>
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="sidebar-footer">
          <div className="user-chip">
            <div className="user-avatar">{userInitials}</div>
            <div className="user-info">
              <div className="user-name">{user?.name || 'User'}</div>
              <div className="user-role">AI Assistant User</div>
            </div>
            <span className="logout-btn" title="Logout" onClick={onLogout}>⏻</span>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ════════════════════════════════════════
   APP SHELL (authenticated layout)
════════════════════════════════════════ */
function AppShell({
  title,
  activePage,
  onNavigate,
  onLogout,
  children
}: {
  title: string;
  activePage: Page;
  onNavigate: (p: Page) => void;
  onLogout: () => void;
  children: React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user = Auth.current();

  return (
    <div className="app-layout">
      <Sidebar
        activePage={activePage}
        onNavigate={onNavigate}
        onLogout={onLogout}
        sidebarOpen={sidebarOpen}
        onClose={() => setSidebarOpen(false)}
      />
      <div className="main-content">
        {/* Top bar */}
        <div className="top-bar">
          <div className="flex gap-md" style={{ alignItems: 'center' }}>
            <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <span className="top-bar-title">{title}</span>
          </div>
          <div className="top-bar-right">
            <span className="text-muted" style={{ fontSize: 13 }}>👤 {esc(user?.name || '')}</span>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('add-task')}>+ New Task</button>
          </div>
        </div>
        {/* Scrollable content */}
        <div className="page-content">
          {children}
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   LOGIN PAGE
════════════════════════════════════════ */
function LoginPage({
  onNavigate,
  toast
}: {
  onNavigate: (p: Page) => void;
  toast: (m: string, t?: 'success' | 'error' | 'info') => void;
}) {
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [errors, setErrors] = useState<{ email?: string; pass?: string; general?: string }>({});

  const doLogin = () => {
    const errs: typeof errors = {};
    if (!email.trim()) errs.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email.';
    if (!pass.trim()) errs.pass = 'Password is required.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const res = Auth.login(email.trim(), pass);
    if (!res.ok) {
      setErrors({ general: res.msg });
    } else {
      toast('Welcome back! Redirecting…', 'success');
      setTimeout(() => onNavigate('dashboard'), 600);
    }
  };

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="grid-lines" />
        <div className="auth-left-content">
          <div className="auth-logo">🤖</div>
          <h1>Smart Multi-AI Assistant</h1>
          <p>Your intelligent task command center powered by cutting-edge AI workflows.</p>
          <div className="auth-features">
            {[
              { icon: '⚡', title: 'AI-Powered Tasks', desc: 'Smart categorization and priority suggestions' },
              { icon: '📊', title: 'Live Dashboard', desc: 'Real-time stats and progress tracking' },
              { icon: '🔒', title: 'Secure & Private', desc: 'Your data stays on your device' }
            ].map(f => (
              <div className="auth-feature" key={f.title}>
                <span className="auth-feature-icon">{f.icon}</span>
                <div className="auth-feature-text">
                  <strong>{f.title}</strong>
                  {f.desc}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
      <div className="auth-right">
        <div className="auth-form-wrap">
          <h2>Welcome back 👋</h2>
          <p className="subtitle">Sign in to your Smart AI Assistant account</p>

          <div className="form-group">
            <label>Email address</label>
            <input
              type="email" className={`form-control ${errors.email ? 'error' : ''}`}
              placeholder="you@example.com" value={email}
              onChange={e => { setEmail(e.target.value); setErrors(p => ({ ...p, email: undefined, general: undefined })); }}
              onKeyDown={e => e.key === 'Enter' && doLogin()}
            />
            {errors.email && <span className="field-error show">{errors.email}</span>}
          </div>

          <div className="form-group">
            <label>Password</label>
            <input
              type="password" className={`form-control ${errors.pass ? 'error' : ''}`}
              placeholder="Your password" value={pass}
              onChange={e => { setPass(e.target.value); setErrors(p => ({ ...p, pass: undefined, general: undefined })); }}
              onKeyDown={e => e.key === 'Enter' && doLogin()}
            />
            {errors.pass && <span className="field-error show">{errors.pass}</span>}
          </div>

          {errors.general && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{errors.general}</div>
          )}

          <button className="btn btn-primary btn-full btn-lg mt-md" onClick={doLogin}>Sign In →</button>
          <div className="auth-divider">or</div>
          <button className="btn btn-secondary btn-full" onClick={() => onNavigate('register')}>Create an account</button>
          <div className="auth-footer">
            Don't have an account? <a href="#" onClick={e => { e.preventDefault(); onNavigate('register'); }}>Register here</a>
          </div>
          <div style={{ marginTop: 16, padding: '10px 14px', background: 'rgba(91,124,250,0.08)', borderRadius: 10, fontSize: 12, color: 'var(--muted)' }}>
            <strong style={{ color: 'var(--accent)' }}>Demo:</strong> demo@smartai.com / demo123
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   REGISTER PAGE
════════════════════════════════════════ */
function RegisterPage({
  onNavigate,
  toast
}: {
  onNavigate: (p: Page) => void;
  toast: (m: string, t?: 'success' | 'error' | 'info') => void;
}) {
  const [name, setName]   = useState('');
  const [email, setEmail] = useState('');
  const [pass, setPass]   = useState('');
  const [pass2, setPass2] = useState('');
  const [errors, setErrors] = useState<Record<string, string>>({});

  const doReg = () => {
    const errs: Record<string, string> = {};
    if (!name.trim())  errs.name  = 'Full name is required.';
    if (!email.trim()) errs.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) errs.email = 'Enter a valid email.';
    if (!pass.trim())  errs.pass  = 'Password is required.';
    else if (pass.length < 6) errs.pass = 'Password must be at least 6 characters.';
    if (!pass2.trim()) errs.pass2 = 'Confirm password is required.';
    else if (pass !== pass2) errs.pass2 = 'Passwords do not match.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    const res = Auth.register(name.trim(), email.trim(), pass);
    if (!res.ok) {
      setErrors({ general: res.msg || 'Registration failed.' });
    } else {
      Auth.login(email.trim(), pass);
      toast('Account created! Signing you in…', 'success');
      setTimeout(() => onNavigate('dashboard'), 700);
    }
  };

  const clearErr = (field: string) => setErrors(p => { const n = { ...p }; delete n[field]; delete n.general; return n; });

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="grid-lines" />
        <div className="auth-left-content">
          <div className="auth-logo">🤖</div>
          <h1>Join Smart AI</h1>
          <p>Create your free account and start managing tasks with the power of AI.</p>
          <div className="auth-features">
            {[
              { icon: '🚀', title: 'Free Forever', desc: 'No credit card required' },
              { icon: '🧠', title: 'AI Assistance', desc: 'Get smart suggestions instantly' },
              { icon: '🎯', title: 'Stay Focused', desc: 'Priority-first task management' }
            ].map(f => (
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
          <h2>Create account 🚀</h2>
          <p className="subtitle">Join thousands of users boosting their productivity</p>

          {[
            { id: 'name', label: 'Full Name', type: 'text', val: name, set: setName, ph: 'Jane Doe' },
            { id: 'email', label: 'Email address', type: 'email', val: email, set: setEmail, ph: 'you@example.com' },
            { id: 'pass', label: 'Password', type: 'password', val: pass, set: setPass, ph: 'Minimum 6 characters' },
            { id: 'pass2', label: 'Confirm Password', type: 'password', val: pass2, set: setPass2, ph: 'Repeat your password' }
          ].map(({ id, label, type, val, set, ph }) => (
            <div className="form-group" key={id}>
              <label>{label}</label>
              <input
                type={type} className={`form-control ${errors[id] ? 'error' : ''}`}
                placeholder={ph} value={val}
                onChange={e => { set(e.target.value); clearErr(id); }}
                onKeyDown={e => e.key === 'Enter' && doReg()}
              />
              {errors[id] && <span className="field-error show">{errors[id]}</span>}
            </div>
          ))}

          {errors.general && (
            <div style={{ color: 'var(--danger)', fontSize: 13, marginBottom: 12 }}>{errors.general}</div>
          )}

          <button className="btn btn-primary btn-full btn-lg mt-md" onClick={doReg}>Create Account →</button>
          <div className="auth-footer">
            Already have an account? <a href="#" onClick={e => { e.preventDefault(); onNavigate('login'); }}>Sign in</a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════
   DASHBOARD PAGE
════════════════════════════════════════ */
function DashboardPage({
  onNavigate,
  onToggle,
  onDelete
}: {
  onNavigate: (p: Page) => void;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const user = Auth.current()!;
  const tasks = TasksDB.forUser(user.id);
  const stats = TasksDB.stats(user.id);
  const pct = stats.total ? Math.round((stats.done / stats.total) * 100) : 0;
  const recent = tasks.slice(0, 5);

  return (
    <>
      <div className="page-header">
        <h2>Good day, {user.name.split(' ')[0]} 👋</h2>
        <p>Here's what's happening with your tasks today.</p>
      </div>

      {/* Stats */}
      <div className="stats-grid">
        {[
          { cls: 'blue',   icon: '📋', value: stats.total,   label: 'Total Tasks' },
          { cls: 'green',  icon: '✅', value: stats.done,    label: 'Completed' },
          { cls: 'purple', icon: '⏳', value: stats.pending, label: 'Pending' },
          { cls: 'red',    icon: '🔴', value: stats.high,    label: 'High Priority' }
        ].map(s => (
          <div className={`stat-card ${s.cls}`} key={s.label}>
            <div className="stat-icon">{s.icon}</div>
            <div className="stat-value">{s.value}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Progress */}
      <div className="progress-card">
        <div className="progress-header">
          <span className="progress-title">Overall Progress</span>
          <span className="progress-pct">{pct}%</span>
        </div>
        <div className="progress-bar-track">
          <div className="progress-bar-fill" style={{ width: `${pct}%` }} />
        </div>
        <div className="progress-footer">
          <span>{stats.done} completed</span>
          <span>{stats.pending} remaining</span>
        </div>
      </div>

      {/* Recent tasks */}
      <div className="section-header">
        <h3>Recent Tasks</h3>
        <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('tasks')}>View all →</button>
      </div>
      <div className="tasks-grid">
        {recent.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">📭</div>
            <h4>No tasks yet</h4>
            <p>Create your first task to get started</p>
            <br />
            <button className="btn btn-primary mt-md" onClick={() => onNavigate('add-task')}>+ Add First Task</button>
          </div>
        ) : (
          recent.map(t => (
            <TaskCard key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} />
          ))
        )}
      </div>
    </>
  );
}

/* ════════════════════════════════════════
   ALL TASKS PAGE
════════════════════════════════════════ */
function TasksPage({
  onNavigate,
  onToggle,
  onDelete
}: {
  onNavigate: (p: Page) => void;
  onToggle: (id: number) => void;
  onDelete: (id: number) => void;
}) {
  const user = Auth.current()!;
  const [search,   setSearch]   = useState('');
  const [status,   setStatus]   = useState('all');
  const [priority, setPriority] = useState('all');
  const [sort,     setSort]     = useState('newest');

  const allTasks = TasksDB.forUser(user.id);

  let filtered = [...allTasks];

  if (search.trim()) {
    const q = search.toLowerCase();
    filtered = filtered.filter(t => t.title.toLowerCase().includes(q));
  }
  if (status === 'pending') filtered = filtered.filter(t => !t.done);
  if (status === 'done')    filtered = filtered.filter(t => t.done);
  if (priority !== 'all')   filtered = filtered.filter(t => t.priority === priority);

  filtered.sort((a, b) => {
    if (sort === 'newest') return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
    if (sort === 'priority') {
      const pMap: Record<string, number> = { high: 3, medium: 2, low: 1, '': 0 };
      return (pMap[b.priority] || 0) - (pMap[a.priority] || 0);
    }
    if (sort === 'deadline') {
      if (!a.dueDate) return 1;
      if (!b.dueDate) return -1;
      return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
    }
    return 0;
  });

  return (
    <>
      <div className="page-header">
        <h2>All Tasks</h2>
        <p>Manage, filter, search, and sort all your tasks in one place.</p>
      </div>

      <div className="filter-bar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input
            type="text" className="form-control"
            placeholder="Search tasks by title…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <span className="filter-label">Status:</span>
          <select className="filter-select" value={status} onChange={e => setStatus(e.target.value)}>
            <option value="all">All Status</option>
            <option value="pending">Pending</option>
            <option value="done">Completed</option>
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">Priority:</span>
          <select className="filter-select" value={priority} onChange={e => setPriority(e.target.value)}>
            <option value="all">All Priorities</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">Sort:</span>
          <select className="filter-select" value={sort} onChange={e => setSort(e.target.value)}>
            <option value="newest">Newest First</option>
            <option value="priority">By Priority</option>
            <option value="deadline">By Deadline</option>
          </select>
        </div>
      </div>

      <div className="tasks-grid">
        {filtered.length === 0 ? (
          <div className="empty-state">
            <div className="empty-icon">🔍</div>
            <h4>No tasks found</h4>
            <p>Try adjusting your search or filters.</p>
            <br />
            <button className="btn btn-primary mt-md" onClick={() => onNavigate('add-task')}>+ Add Task</button>
          </div>
        ) : (
          filtered.map(t => (
            <TaskCard key={t.id} task={t} onToggle={onToggle} onDelete={onDelete} />
          ))
        )}
      </div>
    </>
  );
}

/* ════════════════════════════════════════
   ADD TASK PAGE
════════════════════════════════════════ */
function AddTaskPage({
  onNavigate,
  toast
}: {
  onNavigate: (p: Page) => void;
  toast: (m: string, t?: 'success' | 'error' | 'info') => void;
}) {
  const user = Auth.current()!;
  const [title,    setTitle]    = useState('');
  const [desc,     setDesc]     = useState('');
  const [priority, setPriority] = useState('');
  const [category, setCategory] = useState('');
  const [dueDate,  setDueDate]  = useState('');
  const [errors,   setErrors]   = useState<Record<string, string>>({});

  const doSave = () => {
    const errs: Record<string, string> = {};
    if (!title.trim())    errs.title    = 'Task title is required.';
    if (!priority)        errs.priority = 'Priority is required.';
    if (Object.keys(errs).length) { setErrors(errs); return; }

    TasksDB.add({
      userId:      user.id,
      title:       title.trim(),
      description: desc.trim(),
      priority:    priority as Task['priority'],
      category,
      dueDate
    });

    toast('Task added successfully! 🎉', 'success');
    setTimeout(() => onNavigate('tasks'), 700);
  };

  return (
    <>
      <div className="page-header">
        <h2>Add New Task</h2>
        <p>Fill in the details below to create a new task.</p>
      </div>
      <div className="add-task-layout">
        <div className="form-card">
          <h3>✏️ Task Details</h3>

          <div className="form-group">
            <label>Task Title *</label>
            <input
              type="text" className={`form-control ${errors.title ? 'error' : ''}`}
              placeholder="e.g. Review AI model output" maxLength={100}
              value={title}
              onChange={e => { setTitle(e.target.value); setErrors(p => { const n = { ...p }; delete n.title; return n; }); }}
              onKeyDown={e => e.key === 'Enter' && doSave()}
            />
            {errors.title && <span className="field-error show">{errors.title}</span>}
          </div>

          <div className="form-group">
            <label>Description</label>
            <textarea
              className="form-control" rows={4}
              placeholder="Add more context or details about this task…"
              value={desc}
              onChange={e => setDesc(e.target.value)}
            />
          </div>

          <div className="form-row-2">
            <div className="form-group">
              <label>Priority *</label>
              <select
                className={`form-control ${errors.priority ? 'error' : ''}`}
                value={priority}
                onChange={e => { setPriority(e.target.value); setErrors(p => { const n = { ...p }; delete n.priority; return n; }); }}
              >
                <option value="">Select priority</option>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
              {errors.priority && <span className="field-error show">{errors.priority}</span>}
            </div>
            <div className="form-group">
              <label>Category</label>
              <select className="form-control" value={category} onChange={e => setCategory(e.target.value)}>
                <option value="">Select category</option>
                <option value="Work">💼 Work</option>
                <option value="Personal">👤 Personal</option>
                <option value="Research">🔬 Research</option>
                <option value="Learning">📚 Learning</option>
                <option value="Health">🏃 Health</option>
                <option value="Finance">💰 Finance</option>
                <option value="Other">📌 Other</option>
              </select>
            </div>
          </div>

          <div className="form-group">
            <label>Due Date</label>
            <input type="date" className="form-control" value={dueDate} onChange={e => setDueDate(e.target.value)} />
          </div>

          <div style={{ display: 'flex', gap: 12 }}>
            <button className="btn btn-primary btn-lg" style={{ flex: 1 }} onClick={doSave}>💾 Save Task</button>
            <button className="btn btn-secondary" onClick={() => onNavigate('tasks')}>Cancel</button>
          </div>
        </div>

        <div className="tips-card">
          <h4>✨ Tips for great tasks</h4>
          <div className="tip-item">
            <span className="tip-num">1</span>
            <span>Use clear, action-oriented titles that start with a verb.</span>
          </div>
          <div className="tip-item">
            <span className="tip-num">2</span>
            <span>Set a realistic due date to keep yourself accountable.</span>
          </div>
          <div className="tip-item">
            <span className="tip-num">3</span>
            <span>Use <strong style={{ color: 'var(--danger)' }}>High</strong> priority sparingly — reserve it for truly urgent items.</span>
          </div>
          <div className="tip-item">
            <span className="tip-num">4</span>
            <span>Add a category to keep your workspace organized.</span>
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════
   ROOT APP
════════════════════════════════════════ */
export default function App() {
  const [page, setPage] = useState<Page>(() => {
    if (Auth.isLoggedIn()) return 'dashboard';
    return 'login';
  });

  // Ensure demo user exists
  useEffect(() => {
    if (Auth.getUsers().length === 0) {
      Auth.register('Demo User', 'demo@smartai.com', 'demo123');
    }
  }, []);

  const { toasts, toast } = useToasts();

  // Enforce auth guards
  const navigate = useCallback((target: Page) => {
    const loggedIn = Auth.isLoggedIn();
    const protectedPages: Page[] = ['dashboard', 'tasks', 'add-task'];
    const authPages: Page[] = ['login', 'register'];

    if (protectedPages.includes(target) && !loggedIn) { setPage('login'); return; }
    if (authPages.includes(target) && loggedIn) { setPage('dashboard'); return; }
    setPage(target);
  }, []);

  const handleLogout = () => {
    Auth.logout();
    toast('Logged out successfully.', 'info');
    setTimeout(() => setPage('login'), 400);
  };

  // Force re-render when tasks mutate (toggle / delete)
  const [tick, setTick] = useState(0);
  const refresh = () => setTick(t => t + 1);

  const handleToggle = (id: number) => { TasksDB.toggle(id); refresh(); };
  const handleDelete = (id: number) => { TasksDB.delete(id); toast('Task deleted.', 'info'); refresh(); };

  /* ── Render auth pages ── */
  if (page === 'login') {
    return (
      <>
        <LoginPage onNavigate={navigate} toast={toast} />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  if (page === 'register') {
    return (
      <>
        <RegisterPage onNavigate={navigate} toast={toast} />
        <ToastContainer toasts={toasts} />
      </>
    );
  }

  /* ── Authenticated pages ── */
  const titles: Record<string, string> = {
    dashboard: 'Dashboard',
    tasks:     'All Tasks',
    'add-task': 'Add Task'
  };

  return (
    <>
      <AppShell title={titles[page] || 'Dashboard'} activePage={page} onNavigate={navigate} onLogout={handleLogout}>
        {page === 'dashboard' && (
          <DashboardPage key={tick} onNavigate={navigate} onToggle={handleToggle} onDelete={handleDelete} />
        )}
        {page === 'tasks' && (
          <TasksPage key={tick} onNavigate={navigate} onToggle={handleToggle} onDelete={handleDelete} />
        )}
        {page === 'add-task' && (
          <AddTaskPage onNavigate={navigate} toast={toast} />
        )}
      </AppShell>
      <ToastContainer toasts={toasts} />
    </>
  );
}
