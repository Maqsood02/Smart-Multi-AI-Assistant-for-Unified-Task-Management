import { useState, useEffect, useCallback, useRef } from 'react';

/* ════════════════════════════════════════════════════════════
   VITE ENV — Developer fallback API key
   Set VITE_GEMINI_API_KEY in your .env file.
   Users can also enter their own key in Settings.
════════════════════════════════════════════════════════════ */
const DEV_API_KEY: string = import.meta.env.VITE_GEMINI_API_KEY ?? '';

/* ════════════════════════════════════════════════════════════
   GEMINI API CONFIGURATION
   Model : gemini-2.0-flash  (free tier, fastest)
   Backup: gemini-1.5-flash  (free tier, stable)
════════════════════════════════════════════════════════════ */
const GEMINI_MODEL    = 'gemini-2.0-flash';
const GEMINI_ENDPOINT = `https://generativelanguage.googleapis.com/v1beta/models/${GEMINI_MODEL}:generateContent`;

/* ════════════════════════════════════════════════════════════
   STORAGE  —  localStorage wrapper
════════════════════════════════════════════════════════════ */
const Storage = {
  get: <T,>(key: string, fallback: T): T => {
    try {
      const v = localStorage.getItem(key);
      return v !== null ? (JSON.parse(v) as T) : fallback;
    } catch { return fallback; }
  },
  set: (key: string, value: unknown): void => {
    try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* quota */ }
  },
  remove: (key: string): void => {
    try { localStorage.removeItem(key); } catch {}
  }
};

/* ════════════════════════════════════════════════════════════
   TYPES
════════════════════════════════════════════════════════════ */
interface User    { id: number; name: string; email: string; password: string; }
interface Session { id: number; name: string; email: string; }

type TaskType   = 'content' | 'code' | 'image' | 'task' | 'general';
type Priority   = 'high' | 'medium' | 'low' | '';
type TaskStatus = 'pending' | 'completed';

interface AITask {
  id: number;
  userId: number;
  taskType: TaskType;
  title: string;
  prompt: string;
  aiOutput: string;
  priority: Priority;
  dueDate: string;
  status: TaskStatus;
  createdAt: string;
}

type Page = 'login' | 'register' | 'dashboard' | 'tools' | 'tasks' | 'create-task' | 'history' | 'settings';

/* ════════════════════════════════════════════════════════════
   AUTH
════════════════════════════════════════════════════════════ */
const Auth = {
  getUsers:  (): User[]  => Storage.get<User[]>('smai_users', []),
  saveUsers: (u: User[]) => Storage.set('smai_users', u),

  register(name: string, email: string, password: string): { ok: boolean; msg?: string } {
    const users = this.getUsers();
    if (users.some(u => u.email === email)) return { ok: false, msg: 'Email already registered.' };
    users.push({ id: Date.now(), name, email, password });
    this.saveUsers(users);
    return { ok: true };
  },

  login(email: string, password: string): { ok: boolean; user?: Session; msg?: string } {
    const user = this.getUsers().find(u => u.email === email && u.password === password);
    if (!user) return { ok: false, msg: 'Invalid email or password.' };
    const session: Session = { id: user.id, name: user.name, email: user.email };
    Storage.set('smai_session', session);
    return { ok: true, user: session };
  },

  logout():    void           { Storage.remove('smai_session'); },
  current():   Session | null { return Storage.get<Session | null>('smai_session', null); },
  isLoggedIn():boolean        { return !!this.current(); }
};

/* ════════════════════════════════════════════════════════════
   TASKS DB  —  All localStorage CRUD for AI tasks
   (Implements: addTask, deleteTask, toggleComplete,
    saveToLocalStorage, loadFromLocalStorage)
════════════════════════════════════════════════════════════ */
const DB = {
  // loadFromLocalStorage equivalent
  all():           AITask[]  { return Storage.get<AITask[]>('smai_ai_tasks', []); },
  forUser(uid: number): AITask[] { return this.all().filter(t => t.userId === uid); },

  // Validation: prevent duplicate prompts
  isDuplicate(uid: number, prompt: string, excludeId?: number): boolean {
    const norm = prompt.trim().toLowerCase();
    return this.forUser(uid).some(t => t.prompt.trim().toLowerCase() === norm && t.id !== excludeId);
  },

  // Validation: prevent duplicate title
  isDuplicateTitle(uid: number, title: string, excludeId?: number): boolean {
    const norm = title.trim().toLowerCase();
    return this.forUser(uid).some(t => t.title.trim().toLowerCase() === norm && t.id !== excludeId);
  },

  // addTask — saveToLocalStorage
  add(t: Omit<AITask, 'id' | 'createdAt'>): void {
    const tasks = this.all();
    tasks.unshift({ id: Date.now(), createdAt: new Date().toISOString(), ...t });
    Storage.set('smai_ai_tasks', tasks); // saveToLocalStorage
  },

  // update — saveToLocalStorage
  update(id: number, patch: Partial<AITask>): void {
    const tasks = this.all().map(t => t.id === id ? { ...t, ...patch } : t);
    Storage.set('smai_ai_tasks', tasks);
  },

  // deleteTask — saveToLocalStorage
  delete(id: number): void {
    Storage.set('smai_ai_tasks', this.all().filter(t => t.id !== id));
  },

  // toggleComplete — saveToLocalStorage
  toggle(id: number): void {
    const tasks = this.all();
    const t = tasks.find(x => x.id === id);
    if (t) t.status = t.status === 'completed' ? 'pending' : 'completed';
    Storage.set('smai_ai_tasks', tasks);
  },

  stats(uid: number) {
    const tasks = this.forUser(uid);
    return {
      total:     tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      pending:   tasks.filter(t => t.status === 'pending').length,
      today:     tasks.filter(t => t.createdAt.startsWith(new Date().toISOString().slice(0, 10))).length
    };
  }
};

/* ════════════════════════════════════════════════════════════
   GEMINI API CALLER
   ✅ Correct model: gemini-2.0-flash (free tier)
   ✅ Correct endpoint: v1beta/models/gemini-2.0-flash:generateContent
   ✅ Correct request body format: contents[].parts[].text
   ✅ Developer key (from .env) + User key (from Settings)
   ✅ Priority: User key > Developer key
════════════════════════════════════════════════════════════ */
function getEffectiveApiKey(): string {
  // Priority 1: User's own key (saved in Settings)
  const userKey = Storage.get<string>('smai_gemini_key', '').trim();
  if (userKey.length > 10) return userKey;
  // Priority 2: Developer key from .env (baked into build)
  if (DEV_API_KEY && DEV_API_KEY.trim().length > 10) return DEV_API_KEY.trim();
  return '';
}

async function callGemini(prompt: string, taskType: string): Promise<string> {
  const apiKey = getEffectiveApiKey();

  if (!apiKey) {
    throw new Error('No API key found. Please add your Gemini API key in ⚙️ Settings, or ask your developer to set VITE_GEMINI_API_KEY in the .env file.');
  }

  // System instructions per task type
  const systemInstructions: Record<string, string> = {
    content: 'You are an expert content writer and copywriter. Write engaging, high-quality, well-structured content. Be detailed, professional, and creative.',
    code:    'You are a senior software developer. Write clean, well-commented, production-ready code. Briefly explain what the code does, then provide the complete implementation.',
    image:   'You are a creative AI art director. Describe in vivid detail how the requested image would look — composition, colors, lighting, style, and mood. Then provide 3 optimized AI image generation prompts ready to use in Midjourney, DALL-E, or Stable Diffusion.',
    task:    'You are an expert project manager and productivity coach. Break down the request into clear, actionable steps with priorities, estimated time, and tips. Use numbered lists for clarity.',
    general: 'You are a highly capable, helpful AI assistant. Answer accurately, concisely, and helpfully. Format your response clearly.'
  };

  const fullPrompt = `${systemInstructions[taskType] || systemInstructions.general}\n\nUser Request:\n${prompt}`;

  const requestBody = {
    contents: [
      {
        parts: [{ text: fullPrompt }]
      }
    ],
    generationConfig: {
      temperature:     0.8,
      maxOutputTokens: 1500,
      topK:            40,
      topP:            0.95
    }
  };

  const response = await fetch(`${GEMINI_ENDPOINT}?key=${apiKey}`, {
    method:  'POST',
    headers: { 'Content-Type': 'application/json' },
    body:    JSON.stringify(requestBody)
  });

  if (!response.ok) {
    let errorMsg = `Gemini API Error (HTTP ${response.status})`;
    try {
      const errData = await response.json() as { error?: { message?: string; status?: string } };
      if (errData?.error?.message) {
        // Make common errors user-friendly
        const raw = errData.error.message;
        if (raw.includes('API_KEY_INVALID') || raw.includes('API key not valid')) {
          errorMsg = '❌ Invalid API key. Check your key in ⚙️ Settings or at aistudio.google.com.';
        } else if (raw.includes('QUOTA_EXCEEDED') || raw.includes('quota')) {
          errorMsg = '⚠️ API quota exceeded. Wait a moment and try again, or use a different key.';
        } else if (raw.includes('PERMISSION_DENIED')) {
          errorMsg = '🔒 Permission denied. Make sure your API key has access to Gemini API.';
        } else {
          errorMsg = raw;
        }
      }
    } catch { /* ignore json parse error */ }
    throw new Error(errorMsg);
  }

  interface GeminiResponse {
    candidates?: Array<{
      content?: {
        parts?: Array<{ text?: string }>;
      };
      finishReason?: string;
    }>;
    promptFeedback?: { blockReason?: string };
  }

  const data = await response.json() as GeminiResponse;

  // Check for safety blocks
  if (data?.promptFeedback?.blockReason) {
    throw new Error(`Content blocked by Gemini safety filters: ${data.promptFeedback.blockReason}`);
  }

  const text = data?.candidates?.[0]?.content?.parts?.[0]?.text?.trim();
  if (!text) {
    throw new Error('Gemini returned an empty response. Please try rephrasing your prompt.');
  }

  return text;
}

/* ════════════════════════════════════════════════════════════
   TOAST HOOK
════════════════════════════════════════════════════════════ */
interface ToastMsg { id: number; msg: string; type: 'success' | 'error' | 'info'; }

function useToasts() {
  const [toasts, setToasts] = useState<ToastMsg[]>([]);
  const toast = useCallback((msg: string, type: 'success' | 'error' | 'info' = 'info') => {
    const id = Date.now() + Math.random();
    setToasts(prev => [...prev, { id, msg, type }]);
    setTimeout(() => setToasts(prev => prev.filter(t => t.id !== id)), 4000);
  }, []);
  return { toasts, toast };
}

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

/* ════════════════════════════════════════════════════════════
   HELPERS
════════════════════════════════════════════════════════════ */
function initials(name: string): string {
  return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
}

function formatDate(iso: string): string {
  return new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

const TYPE_LABELS: Record<TaskType, string> = {
  content: '📝 Content Gen',
  code:    '💻 Code Assist',
  image:   '🎨 Image Gen',
  task:    '📋 Task Manager',
  general: '🤖 General AI'
};

function TypingDots() {
  return (
    <div className="typing-dots">
      <div className="typing-dot" />
      <div className="typing-dot" />
      <div className="typing-dot" />
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   AI TASK CARD
   Task 4: delete, mark complete, completed style,
   copy, re-run, expand/collapse long outputs
════════════════════════════════════════════════════════════ */
function AITaskCard({
  task, onToggle, onDelete, onRerun, animDelay = 0
}: {
  task: AITask;
  onToggle:  (id: number) => void;
  onDelete:  (id: number) => void;
  onRerun:   (task: AITask) => void;
  animDelay?: number;
}) {
  const [expanded, setExpanded] = useState(false);
  const isLong = task.aiOutput.length > 350;

  // Copy output to clipboard
  const copyOutput = () => {
    navigator.clipboard.writeText(task.aiOutput).then(
      () => {},
      () => {
        // fallback for browsers without clipboard API
        const el = document.createElement('textarea');
        el.value = task.aiOutput;
        document.body.appendChild(el);
        el.select();
        document.execCommand('copy');
        document.body.removeChild(el);
      }
    );
  };

  // deleteTask — confirm before deleting
  const handleDelete = () => {
    if (window.confirm('Delete this AI task? This cannot be undone.')) {
      onDelete(task.id);
    }
  };

  return (
    <div
      className={`ai-task-card ${task.status === 'completed' ? 'done' : ''} anim-fadeInUp`}
      style={{ animationDelay: `${animDelay}s` }}
    >
      {/* ── Card Header ── */}
      <div className="ai-task-header">
        <div className="ai-task-header-left">
          <span className="ai-badge">🤖 AI Generated</span>
          <span className={`task-type-badge ${task.taskType}`}>{TYPE_LABELS[task.taskType]}</span>
          {task.priority && (
            <span className={`priority-badge ${task.priority}`}>
              {task.priority === 'high' ? '🔴' : task.priority === 'medium' ? '🟡' : '🟢'}{' '}
              {task.priority.charAt(0).toUpperCase() + task.priority.slice(1)}
            </span>
          )}
        </div>
        {/* Status Badge */}
        <span className={`status-badge ${task.status}`}>
          {task.status === 'completed' ? '✅ Completed' : '⏳ Pending'}
        </span>
      </div>

      {/* ── Card Body ── */}
      <div className="ai-task-body">
        {/* Title — strikethrough when completed (Task 4) */}
        <div className="ai-task-title">{task.title}</div>

        {/* Prompt section */}
        <div className="ai-prompt-section">
          <div className="ai-prompt-section-label">💬 Your Prompt</div>
          <div className="ai-prompt-bubble">{task.prompt}</div>
        </div>

        {/* AI Output section */}
        <div className="ai-output-section">
          <div className="ai-output-section-label">
            ⚡ AI Output &nbsp;—&nbsp;
            <span className="ai-badge gemini" style={{ fontSize: 10, padding: '1px 7px' }}>✨ Gemini AI</span>
          </div>
          {/* Collapse long outputs (Task 4 UX) */}
          <div className={`ai-output-content ${!expanded && isLong ? 'collapsed' : ''}`}>
            {task.aiOutput}
          </div>
          {isLong && (
            <button className="expand-btn" onClick={() => setExpanded(e => !e)}>
              {expanded ? '▲ Show less' : '▼ Show more'}
            </button>
          )}
        </div>

        {/* Meta */}
        <div className="ai-task-meta">
          {task.dueDate && <span>📅 Due: {task.dueDate}</span>}
          <span>🕐 {formatDate(task.createdAt)}</span>
        </div>
      </div>

      {/* ── Card Footer — action buttons (Task 4) ── */}
      <div className="ai-task-footer">
        <div className="ai-task-footer-left">
          {/* Re-run */}
          <button className="act-btn run" onClick={() => onRerun(task)} title="Re-run with Gemini AI">
            ↺ Re-run
          </button>
          {/* Copy output */}
          <button className="act-btn copy" onClick={copyOutput} title="Copy AI output">
            📋 Copy
          </button>
        </div>
        <div className="ai-task-footer-right">
          {/* toggleComplete (Task 4) */}
          {task.status === 'pending' ? (
            <button className="act-btn done" onClick={() => onToggle(task.id)} title="Mark as completed">
              ✔️ Mark Done
            </button>
          ) : (
            <button className="act-btn undo" onClick={() => onToggle(task.id)} title="Reopen task">
              ↺ Reopen
            </button>
          )}
          {/* deleteTask (Task 4) */}
          <button className="act-btn del" onClick={handleDelete} title="Delete task">
            🗑 Delete
          </button>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   SIDEBAR
════════════════════════════════════════════════════════════ */
function Sidebar({
  activePage, onNavigate, onLogout, sidebarOpen, onClose
}: {
  activePage: Page;
  onNavigate: (p: Page, payload?: unknown) => void;
  onLogout:   () => void;
  sidebarOpen: boolean;
  onClose:    () => void;
}) {
  const user  = Auth.current();
  const stats = user ? DB.stats(user.id) : { total: 0, completed: 0, pending: 0, today: 0 };
  const ui    = user ? initials(user.name) : 'U';

  const navItems: { page: Page; icon: string; label: string; badge?: number }[] = [
    { page: 'dashboard',   icon: '🏠', label: 'Dashboard' },
    { page: 'tools',       icon: '🤖', label: 'AI Tools' },
    { page: 'tasks',       icon: '📋', label: 'Tasks',    badge: stats.pending },
    { page: 'history',     icon: '📜', label: 'History' },
    { page: 'create-task', icon: '➕', label: 'New AI Task' },
    { page: 'settings',    icon: '⚙️', label: 'Settings' }
  ];

  return (
    <>
      <div className={`sidebar-overlay ${sidebarOpen ? 'show' : ''}`} onClick={onClose} />
      <aside className={`sidebar ${sidebarOpen ? 'open' : ''}`}>

        {/* Brand */}
        <div className="sb-brand">
          <div className="sb-brand-icon">🤖</div>
          <div className="sb-brand-text">
            Smart AI Assistant
            <span>Unified Multi-AI Platform</span>
          </div>
        </div>

        {/* AI Online Indicator */}
        <div className="ai-status">
          <div className="ai-status-dot" />
          <span>Gemini AI — {getEffectiveApiKey() ? 'Ready ✓' : 'No API Key'}</span>
        </div>

        {/* Navigation */}
        <div className="sb-section">
          <div className="sb-label">Navigation</div>
          {navItems.map(({ page, icon, label, badge }) => (
            <a
              key={page}
              className={`nav-item ${activePage === page ? 'active' : ''}`}
              onClick={() => { onNavigate(page); onClose(); }}
            >
              <span className="nav-icon">{icon}</span>
              {label}
              {badge != null && badge > 0 && (
                <span className="nav-badge">{badge}</span>
              )}
            </a>
          ))}
        </div>

        {/* AI Capabilities mini-grid */}
        <div className="sb-section">
          <div className="sb-label">AI Capabilities</div>
          <div className="sb-tools-grid">
            {[
              { icon: '📝', label: 'Content' },
              { icon: '💻', label: 'Code' },
              { icon: '🎨', label: 'Images' },
              { icon: '📋', label: 'Tasks' }
            ].map(t => (
              <div
                key={t.label}
                className="sb-tool-chip"
                onClick={() => { onNavigate('create-task'); onClose(); }}
              >
                <span className="chip-ico">{t.icon}</span>
                {t.label}
              </div>
            ))}
          </div>
        </div>

        {/* Quick Stats */}
        <div className="sb-section">
          <div className="sb-label">Stats</div>
          <div style={{ padding: '10px 12px', background: 'rgba(59,130,246,0.05)', border: '1px solid var(--border)', borderRadius: 10 }}>
            {[
              { label: 'Total AI Tasks', val: stats.total,     color: 'var(--text)' },
              { label: 'Completed',      val: stats.completed, color: 'var(--accent3)' },
              { label: 'Pending',        val: stats.pending,   color: 'var(--warning)' }
            ].map(s => (
              <div key={s.label} style={{ display: 'flex', justifyContent: 'space-between', marginBottom: 8, fontSize: 12 }}>
                <span style={{ color: 'var(--text3)' }}>{s.label}</span>
                <strong style={{ color: s.color }}>{s.val}</strong>
              </div>
            ))}
          </div>
        </div>

        {/* User Footer */}
        <div className="sb-footer">
          <div className="user-chip">
            <div className="user-avatar">{ui}</div>
            <div className="user-info">
              <div className="user-name">{user?.name || 'User'}</div>
              <div className="user-role">AI Platform User</div>
            </div>
            <span className="logout-btn" title="Logout" onClick={onLogout}>⏻</span>
          </div>
        </div>
      </aside>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   APP SHELL
════════════════════════════════════════════════════════════ */
function AppShell({
  title, activePage, onNavigate, onLogout, children
}: {
  title: string;
  activePage: Page;
  onNavigate: (p: Page, payload?: unknown) => void;
  onLogout:   () => void;
  children:   React.ReactNode;
}) {
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const user    = Auth.current();
  const hasKey  = !!getEffectiveApiKey();

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
        <div className="top-bar">
          <div className="flex gap-md" style={{ alignItems: 'center' }}>
            <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <span className="top-bar-title">{title}</span>
          </div>
          <div className="top-bar-right">
            {hasKey
              ? <span className="ai-badge hide-mobile">✨ Gemini AI Ready</span>
              : <span className="ai-badge hide-mobile" style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171', cursor: 'pointer' }}
                  onClick={() => onNavigate('settings')}>⚠ Add API Key</span>
            }
            <span className="text-muted hide-mobile" style={{ fontSize: 13 }}>
              👤 {user?.name || ''}
            </span>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('create-task')}>
              + New AI Task
            </button>
          </div>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   LOGIN PAGE
════════════════════════════════════════════════════════════ */
function LoginPage({ onNavigate, toast }: {
  onNavigate: (p: Page) => void;
  toast: (m: string, t?: 'success' | 'error' | 'info') => void;
}) {
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [errs,  setErrs]  = useState<Record<string, string>>({});

  const doLogin = () => {
    const e: typeof errs = {};
    if (!email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email.';
    if (!pass.trim()) e.pass = 'Password is required.';
    if (Object.keys(e).length) { setErrs(e); return; }
    const res = Auth.login(email.trim(), pass);
    if (!res.ok) { setErrs({ general: res.msg || 'Login failed.' }); return; }
    toast('Welcome back! 👋', 'success');
    setTimeout(() => onNavigate('dashboard'), 500);
  };

  const clr = (f: string) => setErrs(p => { const n = { ...p }; delete n[f]; delete n.general; return n; });

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-grid" />
        <div className="auth-glow-1" /><div className="auth-glow-2" />
        <div className="auth-left-content">
          <div className="auth-brand">
            <div className="auth-brand-icon">🤖</div>
            <div className="auth-brand-name">Smart AI Assistant<span>Unified Multi-AI Task Platform</span></div>
          </div>
          <h1>Your AI Command Center</h1>
          <p>One intelligent platform for content, code, images, and smart task management — powered by Gemini AI.</p>
          <div className="auth-features">
            {[
              { icon: '⚡', title: 'Multi-AI in One Place', desc: 'No more switching between tools' },
              { icon: '🧠', title: 'Gemini AI Powered',    desc: 'State-of-the-art free AI model' },
              { icon: '📊', title: 'Smart Dashboard',      desc: 'Track all AI tasks live' }
            ].map(f => (
              <div className="auth-feature" key={f.title}>
                <span className="auth-feature-icon">{f.icon}</span>
                <div className="auth-feature-text"><strong>{f.title}</strong>{f.desc}</div>
              </div>
            ))}
          </div>
          <div className="ai-model-tags">
            {['📝 Content', '💻 Code', '🎨 Images', '📋 Tasks', '🤖 General AI'].map(tag => (
              <span className="ai-model-tag" key={tag}>{tag}</span>
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
            <input type="email" className={`form-control ${errs.email ? 'error' : ''}`}
              placeholder="you@example.com" value={email}
              onChange={e => { setEmail(e.target.value); clr('email'); }}
              onKeyDown={e => e.key === 'Enter' && doLogin()} />
            {errs.email && <span className="field-error show">{errs.email}</span>}
          </div>

          <div className="form-group">
            <label>Password</label>
            <input type="password" className={`form-control ${errs.pass ? 'error' : ''}`}
              placeholder="Your password" value={pass}
              onChange={e => { setPass(e.target.value); clr('pass'); }}
              onKeyDown={e => e.key === 'Enter' && doLogin()} />
            {errs.pass && <span className="field-error show">{errs.pass}</span>}
          </div>

          {errs.general && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>⚠ {errs.general}</div>}

          <button className="btn btn-primary btn-full btn-lg mt-md" onClick={doLogin}>Sign In →</button>
          <div className="auth-divider">or</div>
          <button className="btn btn-secondary btn-full" onClick={() => onNavigate('register')}>Create an account</button>
          <div className="auth-footer">
            Don't have an account?{' '}
            <a onClick={() => onNavigate('register')}>Register here</a>
          </div>
          <div className="demo-hint">
            <strong style={{ color: 'var(--accent-l)' }}>Demo:</strong> demo@smartai.com / demo123
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   REGISTER PAGE
════════════════════════════════════════════════════════════ */
function RegisterPage({ onNavigate, toast }: {
  onNavigate: (p: Page) => void;
  toast: (m: string, t?: 'success' | 'error' | 'info') => void;
}) {
  const [name,  setName]  = useState('');
  const [email, setEmail] = useState('');
  const [pass,  setPass]  = useState('');
  const [pass2, setPass2] = useState('');
  const [errs,  setErrs]  = useState<Record<string, string>>({});

  const doReg = () => {
    const e: Record<string, string> = {};
    if (!name.trim())  e.name  = 'Full name is required.';
    if (!email.trim()) e.email = 'Email is required.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) e.email = 'Enter a valid email.';
    if (!pass.trim())  e.pass  = 'Password is required.';
    else if (pass.length < 6) e.pass = 'Minimum 6 characters.';
    if (!pass2.trim()) e.pass2 = 'Confirm your password.';
    else if (pass !== pass2) e.pass2 = 'Passwords do not match.';
    if (Object.keys(e).length) { setErrs(e); return; }

    const res = Auth.register(name.trim(), email.trim(), pass);
    if (!res.ok) { setErrs({ general: res.msg || 'Registration failed.' }); return; }
    Auth.login(email.trim(), pass);
    toast('Account created! Welcome aboard 🎉', 'success');
    setTimeout(() => onNavigate('dashboard'), 600);
  };

  const clr = (f: string) => setErrs(p => { const n = { ...p }; delete n[f]; delete n.general; return n; });

  return (
    <div className="auth-page">
      <div className="auth-left">
        <div className="auth-grid" /><div className="auth-glow-1" /><div className="auth-glow-2" />
        <div className="auth-left-content">
          <div className="auth-brand">
            <div className="auth-brand-icon">🤖</div>
            <div className="auth-brand-name">Smart AI Assistant<span>Unified Multi-AI Task Platform</span></div>
          </div>
          <h1>Join the AI Revolution</h1>
          <p>Create your free account and unlock the power of multi-AI tools in a single intelligent workspace.</p>
          <div className="auth-features">
            {[
              { icon: '🚀', title: 'Free Forever',       desc: 'No credit card required' },
              { icon: '🧠', title: 'Gemini AI Built-in', desc: 'Real AI responses instantly' },
              { icon: '🎯', title: 'Stay Productive',    desc: 'All your AI tasks in one place' }
            ].map(f => (
              <div className="auth-feature" key={f.title}>
                <span className="auth-feature-icon">{f.icon}</span>
                <div className="auth-feature-text"><strong>{f.title}</strong>{f.desc}</div>
              </div>
            ))}
          </div>
          <div className="ai-model-tags">
            {['📝 Content', '💻 Code', '🎨 Images', '📋 Tasks', '🤖 General AI'].map(tag => (
              <span className="ai-model-tag" key={tag}>{tag}</span>
            ))}
          </div>
        </div>
      </div>

      <div className="auth-right">
        <div className="auth-form-wrap">
          <h2>Create your account 🚀</h2>
          <p className="auth-subtitle">Join the Smart AI Assistant platform today</p>

          {[
            { id: 'name',  label: 'Full Name',        type: 'text',     val: name,  set: setName,  ph: 'Jane Doe' },
            { id: 'email', label: 'Email address',    type: 'email',    val: email, set: setEmail, ph: 'you@example.com' },
            { id: 'pass',  label: 'Password',         type: 'password', val: pass,  set: setPass,  ph: 'Min 6 characters' },
            { id: 'pass2', label: 'Confirm Password', type: 'password', val: pass2, set: setPass2, ph: 'Repeat password' }
          ].map(({ id, label, type, val, set, ph }) => (
            <div className="form-group" key={id}>
              <label>{label}</label>
              <input type={type} className={`form-control ${errs[id] ? 'error' : ''}`}
                placeholder={ph} value={val}
                onChange={e => { set(e.target.value); clr(id); }}
                onKeyDown={e => e.key === 'Enter' && doReg()} />
              {errs[id] && <span className="field-error show">{errs[id]}</span>}
            </div>
          ))}

          {errs.general && <div style={{ color: '#f87171', fontSize: 13, marginBottom: 12 }}>⚠ {errs.general}</div>}

          <button className="btn btn-primary btn-full btn-lg mt-md" onClick={doReg}>Create Account →</button>
          <div className="auth-footer">
            Already have an account?{' '}
            <a onClick={() => onNavigate('login')}>Sign in</a>
          </div>
        </div>
      </div>
    </div>
  );
}

/* ════════════════════════════════════════════════════════════
   DASHBOARD PAGE
════════════════════════════════════════════════════════════ */
function DashboardPage({ onNavigate, toast, refresh }: {
  onNavigate: (p: Page, payload?: unknown) => void;
  toast:      (m: string, t?: 'success' | 'error' | 'info') => void;
  refresh:    () => void;
}) {
  const user   = Auth.current()!;
  const stats  = DB.stats(user.id);
  const recent = DB.forUser(user.id).slice(0, 3);

  const [prompt,       setPrompt]       = useState('');
  const [aiOutput,     setAiOutput]     = useState('');
  const [aiPromptSent, setAiPromptSent] = useState('');
  const [thinking,     setThinking]     = useState(false);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  const SUGGESTED = [
    { icon: '✍️', text: 'Write a blog post about the benefits of AI for students' },
    { icon: '💻', text: 'Generate Python code for a simple login system' },
    { icon: '📧', text: 'Write a professional email asking for a project update' },
    { icon: '📋', text: 'Create a 3-month project plan for a mobile app' },
    { icon: '🎨', text: 'Describe a futuristic smart city at night for an image' }
  ];

  const sendPrompt = async (p: string) => {
    const text = (p || prompt).trim();
    if (!text) return;

    const hasKey = !!getEffectiveApiKey();
    if (!hasKey) {
      toast('⚙️ No API key found. Add your Gemini key in Settings, or ask your developer.', 'error');
      return;
    }

    setAiPromptSent(text);
    setAiOutput('');
    setThinking(true);

    try {
      const result = await callGemini(text, 'general');
      setAiOutput(result);

      // Auto-save to DB (addTask + saveToLocalStorage)
      DB.add({
        userId:   user.id,
        taskType: 'general',
        title:    text.slice(0, 70) + (text.length > 70 ? '…' : ''),
        prompt:   text,
        aiOutput: result,
        priority: '',
        dueDate:  '',
        status:   'pending'
      });
      refresh();
      toast('✅ AI response saved to Tasks!', 'success');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Unknown error';
      toast(`❌ ${msg}`, 'error');
      setAiOutput('');
      setAiPromptSent('');
    } finally {
      setThinking(false);
      setPrompt('');
    }
  };

  const handleToggle = (id: number) => { DB.toggle(id); refresh(); };
  const handleDelete = (id: number) => { DB.delete(id); refresh(); toast('Task deleted.', 'info'); };

  const greetHour = new Date().getHours();
  const greetWord = greetHour < 12 ? 'Good morning' : greetHour < 17 ? 'Good afternoon' : 'Good evening';

  return (
    <>
      {/* Greeting */}
      <div className="dash-greeting">
        <h2>{greetWord}, <span className="gradient-text">{user.name.split(' ')[0]}</span> 👋</h2>
        <p>What do you want to do today? Ask anything or pick an AI tool below.</p>
      </div>

      {/* ── AI Input Box ── */}
      <div className="ai-input-section">
        <div className="ai-input-box">
          <div className="ai-input-top">
            🤖 <span>Smart AI Assistant</span>
            <span style={{ marginLeft: 'auto', fontSize: 11, opacity: 0.7 }}>
              {getEffectiveApiKey() ? '🟢 Gemini Ready' : '🔴 No API Key — go to Settings'}
            </span>
          </div>
          <textarea
            ref={textareaRef}
            className="ai-input-textarea"
            placeholder={
              'Ask anything...\n' +
              '"Write a blog about AI"  |  "Generate Python code"  |  "Plan my project"'
            }
            value={prompt}
            rows={3}
            onChange={e => setPrompt(e.target.value)}
            onKeyDown={e => {
              if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendPrompt(prompt); }
            }}
            disabled={thinking}
          />
          <div className="ai-input-bottom">
            <div className="ai-input-hint">⏎ Enter to send &nbsp;·&nbsp; Shift+Enter for new line</div>
            <button className="ai-send-btn" onClick={() => sendPrompt(prompt)} disabled={thinking || !prompt.trim()}>
              {thinking ? 'Sending…' : '✨ Ask AI →'}
            </button>
          </div>
        </div>

        {/* Suggested Prompt Chips */}
        <div className="prompt-chips">
          {SUGGESTED.map(s => (
            <span key={s.text} className="prompt-chip"
              onClick={() => !thinking && sendPrompt(s.text)}>
              {s.icon} {s.text}
            </span>
          ))}
        </div>
      </div>

      {/* ── AI Thinking State ── */}
      {thinking && (
        <div className="ai-live-output">
          <div className="ai-thinking">
            <div className="ai-loading-icon">🤖</div>
            <TypingDots />
            <div className="thinking-text">AI is thinking…</div>
            <div className="thinking-sub">Processing with Gemini AI (gemini-2.0-flash)…</div>
          </div>
        </div>
      )}

      {/* ── AI Response ── */}
      {aiOutput && !thinking && (
        <div className="ai-live-output">
          <div className="ai-output-header">
            <div className="ai-output-header-left">
              <span className="ai-badge">🤖 AI Generated</span>
              <span className="ai-badge gemini">✨ Generated by Gemini AI</span>
            </div>
            <button className="act-btn copy"
              onClick={() => navigator.clipboard.writeText(aiOutput).catch(() => {})}>
              📋 Copy
            </button>
          </div>
          <div className="ai-prompt-label">💬 Your prompt:</div>
          <div className="ai-prompt-text">{aiPromptSent}</div>
          <div className="ai-response-label">⚡ AI Response:</div>
          <div className="ai-response-text">{aiOutput}</div>
        </div>
      )}

      {/* ── Stats Cards ── */}
      <div className="dash-stats">
        {[
          { cls: 'blue',   icon: '📋', val: stats.total,     label: 'Total AI Tasks' },
          { cls: 'green',  icon: '✅', val: stats.completed, label: 'Completed' },
          { cls: 'purple', icon: '⏳', val: stats.pending,   label: 'Pending' },
          { cls: 'amber',  icon: '📅', val: stats.today,     label: "Today's Tasks" }
        ].map((s, i) => (
          <div className={`stat-card ${s.cls} anim-fadeInUp`} key={s.label}
            style={{ animationDelay: `${i * 0.06}s` }}>
            <div className="stat-icon-wrap">{s.icon}</div>
            <div className="stat-value">{s.val}</div>
            <div className="stat-label">{s.label}</div>
          </div>
        ))}
      </div>

      {/* ── AI Tool Cards ── */}
      <div className="section-title" style={{ marginBottom: 14 }}>
        🤖 AI Tools
        <span style={{ fontSize: 12, color: 'var(--text3)', fontWeight: 500, marginLeft: 6 }}>
          — Pick a tool to get started
        </span>
      </div>
      <div className="tools-grid">
        {[
          { type: 'content', cls: 'content', icon: '📝', title: 'Content Generator', desc: 'Write blogs, articles, emails, social posts and any content you need.' },
          { type: 'code',    cls: 'code',    icon: '💻', title: 'Code Assistant',    desc: 'Generate, debug, and explain code in any programming language.' },
          { type: 'image',   cls: 'image',   icon: '🎨', title: 'Image Creator',     desc: 'Generate detailed image descriptions and AI art prompts.' },
          { type: 'task',    cls: 'task',    icon: '📋', title: 'Task Manager AI',   desc: 'Let AI plan, organize, and break down any project or task.' }
        ].map((t, i) => (
          <div key={t.type} className={`tool-card ${t.cls} anim-fadeInUp`}
            style={{ animationDelay: `${0.15 + i * 0.07}s` }}
            onClick={() => onNavigate('create-task', { preType: t.type })}>
            <div className="tool-card-icon">{t.icon}</div>
            <div className="tool-card-title">{t.title}</div>
            <div className="tool-card-desc">{t.desc}</div>
            <div className="tool-card-action">Use Tool →</div>
          </div>
        ))}
      </div>

      {/* ── Recent Tasks ── */}
      {recent.length > 0 && (
        <>
          <div className="section-row" style={{ marginBottom: 14 }}>
            <div className="section-title" style={{ marginBottom: 0, fontSize: 15 }}>
              ⚡ Recent AI Tasks
            </div>
            <button className="btn btn-ghost btn-sm" onClick={() => onNavigate('tasks')}>
              View all →
            </button>
          </div>
          <div className="ai-tasks-grid">
            {recent.map((t, i) => (
              <AITaskCard key={t.id} task={t}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onRerun={task => onNavigate('create-task', task)}
                animDelay={i * 0.05}
              />
            ))}
          </div>
        </>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   AI TOOLS PAGE
════════════════════════════════════════════════════════════ */
function AIToolsPage({ onNavigate }: { onNavigate: (p: Page, payload?: unknown) => void }) {
  const TOOLS = [
    {
      type: 'content', cls: 'content', icon: '📝', title: 'Content Generator',
      desc: 'Create high-quality written content. Write blogs, articles, social media posts, emails, and marketing copy.',
      examples: ['Write a 500-word blog post about AI trends in 2025', 'Write a product description for a smartwatch', 'Write a professional email to a client']
    },
    {
      type: 'code',  cls: 'code',  icon: '💻', title: 'Code Assistant',
      desc: 'Generate, debug, and explain code in any programming language. From algorithms to full applications.',
      examples: ['Create a Python login system with password hashing', 'Write a React component for a task dashboard', 'Explain this SQL query and optimize it']
    },
    {
      type: 'image', cls: 'image', icon: '🎨', title: 'Image Creator',
      desc: 'Generate detailed visual descriptions and AI art prompts for Midjourney, DALL-E, and Stable Diffusion.',
      examples: ['A futuristic smart city at night with neon lights', 'Minimalist tech startup logo concept', 'Portrait in Renaissance oil painting style']
    },
    {
      type: 'task',  cls: 'task',  icon: '📋', title: 'Task Manager AI',
      desc: 'Let AI organize, plan, and break down complex projects into clear actionable steps.',
      examples: ['Plan a 3-month mobile app launch roadmap', 'Break down a machine learning thesis project', 'Create an agenda for a team sprint planning meeting']
    }
  ];

  return (
    <>
      <div className="page-header">
        <h2>🤖 AI Tools</h2>
        <p>Choose an AI capability to get started. All powered by Gemini 2.0 Flash — free AI model.</p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 20 }}>
        {TOOLS.map((t, i) => (
          <div key={t.type} className={`tool-card ${t.cls} anim-fadeInUp`}
            style={{ padding: 26, animationDelay: `${i * 0.07}s`, cursor: 'pointer' }}
            onClick={() => onNavigate('create-task', { preType: t.type })}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 14, marginBottom: 14 }}>
              <div className="tool-card-icon" style={{ width: 54, height: 54, fontSize: 26, borderRadius: 15 }}>{t.icon}</div>
              <div>
                <div className="tool-card-title" style={{ fontSize: 16 }}>{t.title}</div>
                <span className="ai-badge" style={{ marginTop: 5, display: 'inline-flex' }}>🤖 AI Powered</span>
              </div>
            </div>
            <div className="tool-card-desc" style={{ fontSize: 13.5, marginBottom: 16 }}>{t.desc}</div>
            <div style={{ fontSize: 11, fontWeight: 700, color: 'var(--text3)', marginBottom: 8, textTransform: 'uppercase', letterSpacing: '0.07em' }}>
              Example prompts:
            </div>
            {t.examples.map(ex => (
              <div key={ex}
                style={{ fontSize: 12.5, color: 'var(--text2)', padding: '7px 11px', background: 'rgba(0,0,0,0.2)', borderRadius: 8, marginBottom: 7, cursor: 'pointer', lineHeight: 1.5 }}
                onClick={e => { e.stopPropagation(); onNavigate('create-task', { preType: t.type, prePrompt: ex }); }}>
                💬 "{ex}"
              </div>
            ))}
            <div className="tool-card-action" style={{ marginTop: 16, paddingTop: 12 }}>Use {t.title} →</div>
          </div>
        ))}
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   CREATE AI TASK PAGE
   Runs Gemini API and saves result to localStorage
════════════════════════════════════════════════════════════ */
function CreateTaskPage({ onNavigate, toast, refresh, payload }: {
  onNavigate: (p: Page) => void;
  toast:      (m: string, t?: 'success' | 'error' | 'info') => void;
  refresh:    () => void;
  payload?:   unknown;
}) {
  const user   = Auth.current()!;
  const pre    = payload as { preType?: string; prePrompt?: string; prompt?: string; taskType?: string } | undefined;

  const [taskType, setTaskType] = useState<TaskType>((pre?.preType || pre?.taskType || 'content') as TaskType);
  const [prompt,   setPrompt]   = useState(pre?.prePrompt || pre?.prompt || '');
  const [priority, setPriority] = useState<Priority>('');
  const [dueDate,  setDueDate]  = useState('');
  const [errs,     setErrs]     = useState<Record<string, string>>({});
  const [running,  setRunning]  = useState(false);
  const [done,     setDone]     = useState(false);

  const TYPES: { id: TaskType; icon: string; label: string }[] = [
    { id: 'content', icon: '📝', label: 'Content Writing' },
    { id: 'code',    icon: '💻', label: 'Code Generation' },
    { id: 'image',   icon: '🎨', label: 'Image Creation' },
    { id: 'task',    icon: '📋', label: 'Task Management' }
  ];

  const doRun = async () => {
    const e: Record<string, string> = {};
    // Validation: prevent empty prompts (Task 4)
    if (!prompt.trim()) {
      e.prompt = '⚠️ Please describe what you want AI to do. This field cannot be empty.';
    }
    // Validation: prevent duplicate tasks (Task 4)
    if (prompt.trim() && DB.isDuplicate(user.id, prompt)) {
      e.prompt = '⚠️ A task with this exact prompt already exists. Please write a unique request.';
    }
    if (Object.keys(e).length) { setErrs(e); return; }

    if (!getEffectiveApiKey()) {
      toast('⚙️ No API key found. Add your Gemini key in ⚙️ Settings.', 'error');
      return;
    }

    setRunning(true);
    setErrs({});

    try {
      // Call Gemini API — real AI response
      const result = await callGemini(prompt.trim(), taskType);

      // addTask + saveToLocalStorage (Task 4)
      DB.add({
        userId:   user.id,
        taskType,
        title:    prompt.trim().slice(0, 80) + (prompt.length > 80 ? '…' : ''),
        prompt:   prompt.trim(),
        aiOutput: result,
        priority,
        dueDate,
        status:   'pending'
      });

      refresh();
      setDone(true);
      toast('🎉 AI Task created and saved!', 'success');
      setTimeout(() => onNavigate('tasks'), 1400);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Gemini API error. Please try again.';
      toast(`❌ ${msg}`, 'error');
    } finally {
      setRunning(false);
    }
  };

  // ── Loading State ──
  if (running) {
    return (
      <>
        <div className="page-header">
          <h2>🤖 Running AI Task…</h2>
          <p>Gemini AI is processing your request. Please wait.</p>
        </div>
        <div className="ct-card" style={{ maxWidth: 600, margin: '0 auto' }}>
          <div className="ai-loading-box">
            <div className="ai-loading-icon">🤖</div>
            <TypingDots />
            <div className="thinking-text">AI is thinking…</div>
            <div className="thinking-sub">Processing with Gemini 2.0 Flash…</div>
            <div className="ai-prompt-text" style={{ marginTop: 20, textAlign: 'left', maxWidth: 440, width: '100%' }}>
              {prompt}
            </div>
          </div>
        </div>
      </>
    );
  }

  // ── Success State ──
  if (done) {
    return (
      <div className="ct-card" style={{ maxWidth: 560, margin: '60px auto', textAlign: 'center', padding: 40 }}>
        <div style={{ fontSize: 60, marginBottom: 16 }}>✅</div>
        <h3 style={{ fontSize: 20, marginBottom: 8, fontWeight: 800 }}>AI Task Created!</h3>
        <p style={{ color: 'var(--text2)', marginBottom: 22 }}>
          Your task was generated by Gemini AI and saved. Redirecting…
        </p>
      </div>
    );
  }

  return (
    <>
      <div className="page-header">
        <h2>➕ Create AI Task</h2>
        <p>Describe what you want AI to do. Gemini 2.0 Flash will generate the output instantly.</p>
      </div>

      <div className="create-task-layout">
        <div className="ct-card">
          <h3>🎯 New AI Request</h3>

          {/* ── Task Type Selector ── */}
          <div className="form-group">
            <label>Task Type *</label>
            <div className="task-type-grid">
              {TYPES.map(t => (
                <div key={t.id} className={`type-opt ${t.id} ${taskType === t.id ? 'selected' : ''}`}
                  onClick={() => setTaskType(t.id)}>
                  <span className="type-ico">{t.icon}</span>
                  {t.label}
                </div>
              ))}
            </div>
          </div>

          {/* ── Prompt Input ── */}
          <div className="form-group">
            <label>Describe what you want AI to do *</label>
            <textarea
              className={`form-control ${errs.prompt ? 'error' : ''}`}
              rows={5}
              placeholder={
                taskType === 'content' ? 'e.g. Write a 500-word blog post about the future of AI in healthcare…' :
                taskType === 'code'    ? 'e.g. Create a Python Flask REST API with JWT authentication and user registration…' :
                taskType === 'image'   ? 'e.g. A futuristic city at night with neon lights, flying cars, and glowing skyscrapers…' :
                                         'e.g. Plan a 3-month roadmap for launching a mobile app startup from idea to launch…'
              }
              value={prompt}
              onChange={e => { setPrompt(e.target.value); setErrs(p => { const n = { ...p }; delete n.prompt; return n; }); }}
            />
            {/* Inline validation error — visible in UI (Task 4) */}
            {errs.prompt && <span className="field-error show">{errs.prompt}</span>}
          </div>

          {/* ── Priority + Deadline ── */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
            <div className="form-group">
              <label>Priority</label>
              <select className="form-control" value={priority}
                onChange={e => setPriority(e.target.value as Priority)}>
                <option value="">No priority</option>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
            </div>
            <div className="form-group">
              <label>Deadline (optional)</label>
              <input type="date" className="form-control" value={dueDate}
                onChange={e => setDueDate(e.target.value)} />
            </div>
          </div>

          {/* ── API Key Warning ── */}
          {!getEffectiveApiKey() && (
            <div style={{ padding: '12px 16px', background: 'rgba(239,68,68,0.07)', border: '1px solid rgba(239,68,68,0.2)', borderRadius: 10, fontSize: 13, color: '#f87171', marginBottom: 18, lineHeight: 1.6 }}>
              ⚠️ <strong>No Gemini API key configured.</strong> The AI Task cannot run without a key.<br />
              <span style={{ color: 'var(--text2)' }}>
                → Go to{' '}
                <span style={{ color: 'var(--accent-l)', cursor: 'pointer', textDecoration: 'underline' }}
                  onClick={() => onNavigate('settings')}>⚙️ Settings</span>
                {' '}to add your free key from{' '}
                <strong>aistudio.google.com</strong>
              </span>
            </div>
          )}

          {/* ── Run Button ── */}
          <button className="run-btn" onClick={doRun}
            disabled={running || !prompt.trim()}>
            🚀 Run AI Task
          </button>
        </div>

        {/* ── Tips Sidebar ── */}
        <div className="ct-tips">
          <h4>💡 Smart Prompt Tips</h4>
          <div className="tip-item">
            <span className="tip-num">1</span>
            <span>Be specific. <strong style={{ color: 'var(--text)' }}>"Write a 500-word blog about AI"</strong> beats just "write blog".</span>
          </div>
          <div className="tip-item">
            <span className="tip-num">2</span>
            <span>For code, specify the <strong style={{ color: 'var(--text)' }}>language, framework,</strong> and exact requirements.</span>
          </div>
          <div className="tip-item">
            <span className="tip-num">3</span>
            <span>For images, describe <strong style={{ color: 'var(--text)' }}>style, colors, mood,</strong> and composition.</span>
          </div>
          <div className="tip-item">
            <span className="tip-num">4</span>
            <span>For tasks, include <strong style={{ color: 'var(--text)' }}>goals, constraints,</strong> and timeframe.</span>
          </div>
          <div className="tip-item">
            <span className="tip-num">5</span>
            <span>Duplicate prompts are blocked. Each task must have a unique description.</span>
          </div>

          <div style={{ marginTop: 20, padding: 14, background: 'rgba(59,130,246,0.06)', border: '1px solid var(--border)', borderRadius: 12, fontSize: 12 }}>
            <div style={{ fontWeight: 700, color: 'var(--accent-l)', marginBottom: 6 }}>🤖 AI Model Info</div>
            <div style={{ color: 'var(--text2)', lineHeight: 1.7 }}>
              Model: <strong>gemini-2.0-flash</strong><br />
              Provider: Google AI Studio<br />
              Cost: <strong style={{ color: 'var(--accent3)' }}>Free tier</strong>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   TASKS PAGE
   Task 4: Filter tabs (All / Active / Completed),
   task counter, delete, toggleComplete, separate sections
════════════════════════════════════════════════════════════ */
function TasksPage({ onNavigate, toast, refresh }: {
  onNavigate: (p: Page, payload?: unknown) => void;
  toast:      (m: string, t?: 'success' | 'error' | 'info') => void;
  refresh:    () => void;
}) {
  const user = Auth.current()!;

  // Filter state
  const [tab,      setTab]      = useState<'all' | 'active' | 'completed'>('all');
  const [search,   setSearch]   = useState('');
  const [typeF,    setTypeF]    = useState('all');
  const [priorityF,setPriorityF]= useState('all');
  const [sort,     setSort]     = useState('newest');

  // Load from localStorage on mount (loadFromLocalStorage)
  // DB.forUser already reads from localStorage on every call

  const all = DB.forUser(user.id);

  // Apply all filters
  const filtered = all
    .filter(t => {
      // Tab filter (Task 4: All / Active / Completed)
      if (tab === 'active'    && t.status !== 'pending')   return false;
      if (tab === 'completed' && t.status !== 'completed') return false;
      // Search — matches title or prompt
      if (search.trim()) {
        const q = search.toLowerCase();
        if (!t.title.toLowerCase().includes(q) && !t.prompt.toLowerCase().includes(q)) return false;
      }
      if (typeF     !== 'all' && t.taskType  !== typeF)     return false;
      if (priorityF !== 'all' && t.priority  !== priorityF) return false;
      return true;
    })
    .sort((a, b) => {
      if (sort === 'newest')   return new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime();
      if (sort === 'priority') {
        const m: Record<string, number> = { high: 3, medium: 2, low: 1, '': 0 };
        return (m[b.priority] || 0) - (m[a.priority] || 0);
      }
      if (sort === 'deadline') {
        if (!a.dueDate && !b.dueDate) return 0;
        if (!a.dueDate) return 1;
        if (!b.dueDate) return -1;
        return new Date(a.dueDate).getTime() - new Date(b.dueDate).getTime();
      }
      return 0;
    });

  const pending   = filtered.filter(t => t.status !== 'completed');
  const completed = filtered.filter(t => t.status === 'completed');

  // Counts for tabs
  const counts = {
    all:       all.length,
    active:    all.filter(t => t.status !== 'completed').length,
    completed: all.filter(t => t.status === 'completed').length
  };

  // toggleComplete — updates localStorage instantly (Task 4)
  const handleToggle = (id: number) => {
    DB.toggle(id); // saveToLocalStorage inside
    refresh();
    const updated = DB.all().find(x => x.id === id);
    toast(updated?.status === 'completed' ? '✅ Task marked as completed!' : '↺ Task reopened.', 'success');
  };

  // deleteTask — updates localStorage instantly (Task 4)
  const handleDelete = (id: number) => {
    DB.delete(id); // saveToLocalStorage inside
    refresh();
    toast('🗑 Task deleted.', 'info');
  };

  return (
    <>
      <div className="page-header">
        <h2>📋 AI Tasks</h2>
        <p>All your AI-generated tasks. Filter, search, complete, and manage them instantly.</p>
      </div>

      {/* ── Filter Tabs (Task 4: All / Active / Completed) ── */}
      <div className="filter-tabs">
        {([
          { key: 'all',       label: 'All Tasks', count: counts.all },
          { key: 'active',    label: '⏳ Active',  count: counts.active },
          { key: 'completed', label: '✅ Done',    count: counts.completed }
        ] as const).map(({ key, label, count }) => (
          <button
            key={key}
            className={`filter-tab ${tab === key ? 'active' : ''}`}
            onClick={() => setTab(key)}
          >
            {label}
            <span className={`tab-count ${tab === key ? 'active' : ''}`}>{count}</span>
          </button>
        ))}
      </div>

      {/* ── Smart Filter Bar (search / type / priority / sort) ── */}
      <div className="smart-filter-bar">
        <div className="search-wrap">
          <span className="search-icon">🔍</span>
          <input className="filter-input"
            placeholder="Search AI tasks by title or prompt…"
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <div className="filter-group">
          <span className="filter-label">Type:</span>
          <select className="filter-select" value={typeF} onChange={e => setTypeF(e.target.value)}>
            <option value="all">All Types</option>
            <option value="content">📝 Content</option>
            <option value="code">💻 Code</option>
            <option value="image">🎨 Image</option>
            <option value="task">📋 Task</option>
            <option value="general">🤖 General</option>
          </select>
        </div>
        <div className="filter-group">
          <span className="filter-label">Priority:</span>
          <select className="filter-select" value={priorityF} onChange={e => setPriorityF(e.target.value)}>
            <option value="all">All Priorities</option>
            <option value="high">🔴 High</option>
            <option value="medium">🟡 Medium</option>
            <option value="low">🟢 Low</option>
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

      {/* ── Active / Pending Tasks (Task 4: shown separately) ── */}
      {tab !== 'completed' && (
        <>
          <div className="section-row">
            <div className="section-title" style={{ marginBottom: 0, fontSize: 15 }}>
              ⏳ Active Tasks
              <span className="count-chip">{pending.length}</span>
            </div>
            <button className="btn btn-primary btn-sm" onClick={() => onNavigate('create-task')}>
              + New AI Task
            </button>
          </div>

          <div className="ai-tasks-grid" style={{ marginBottom: 26 }}>
            {pending.length === 0 ? (
              <div className="empty-state">
                <div className="empty-icon">{search || typeF !== 'all' ? '🔍' : '✨'}</div>
                <h4>{search || typeF !== 'all' ? 'No matching active tasks' : 'No active tasks'}</h4>
                <p>
                  {search || typeF !== 'all'
                    ? 'Try adjusting your search or filters.'
                    : tab === 'active' ? 'Great! All tasks are completed.' : 'Run your first AI task!'}
                </p>
                {!search && typeF === 'all' && (
                  <button className="btn btn-primary mt-md" onClick={() => onNavigate('create-task')}>
                    🚀 Create AI Task
                  </button>
                )}
              </div>
            ) : (
              pending.map((t, i) => (
                <AITaskCard key={t.id} task={t}
                  onToggle={handleToggle}
                  onDelete={handleDelete}
                  onRerun={task => onNavigate('create-task', task)}
                  animDelay={i * 0.04}
                />
              ))
            )}
          </div>
        </>
      )}

      {/* ── Completed Tasks (Task 4: shown separately with different style) ── */}
      {tab !== 'active' && completed.length > 0 && (
        <>
          <div className="tasks-divider">
            <div className="tasks-divider-line" />
            <div className="tasks-divider-label">✅ Completed ({completed.length})</div>
            <div className="tasks-divider-line" />
          </div>
          <div className="section-row" style={{ marginBottom: 12 }}>
            <div className="section-title" style={{ marginBottom: 0, fontSize: 15, color: 'var(--accent3)' }}>
              ✅ Completed Tasks
              <span className="count-chip">{completed.length}</span>
            </div>
          </div>
          <div className="ai-tasks-grid">
            {completed.map((t, i) => (
              <AITaskCard key={t.id} task={t}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onRerun={task => onNavigate('create-task', task)}
                animDelay={i * 0.04}
              />
            ))}
          </div>
        </>
      )}

      {tab === 'active' && completed.length === 0 && pending.length === 0 && (
        <div className="empty-state">
          <div className="empty-icon">📭</div>
          <h4>No tasks found</h4>
          <p>Try adjusting your filters or create a new AI task.</p>
        </div>
      )}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   HISTORY PAGE
════════════════════════════════════════════════════════════ */
function HistoryPage({ onNavigate, toast, refresh }: {
  onNavigate: (p: Page, payload?: unknown) => void;
  toast:      (m: string, t?: 'success' | 'error' | 'info') => void;
  refresh:    () => void;
}) {
  const user  = Auth.current()!;
  const tasks = DB.forUser(user.id).sort((a, b) =>
    new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
  );

  const handleToggle = (id: number) => { DB.toggle(id); refresh(); };
  const handleDelete = (id: number) => { DB.delete(id); refresh(); toast('Deleted.', 'info'); };

  if (tasks.length === 0) {
    return (
      <>
        <div className="page-header">
          <h2>📜 History</h2>
          <p>Your complete AI activity log.</p>
        </div>
        <div className="empty-state">
          <div className="empty-icon">🤖</div>
          <h4>No AI history yet</h4>
          <p>Run your first AI task and it will appear here.</p>
          <button className="btn btn-primary mt-md" onClick={() => onNavigate('create-task')}>
            🚀 Create First AI Task
          </button>
        </div>
      </>
    );
  }

  // Group by date
  const groups: Record<string, AITask[]> = {};
  tasks.forEach(t => {
    const dateKey = new Date(t.createdAt).toLocaleDateString('en-US', {
      weekday: 'long', month: 'long', day: 'numeric', year: 'numeric'
    });
    if (!groups[dateKey]) groups[dateKey] = [];
    groups[dateKey].push(t);
  });

  return (
    <>
      <div className="page-header">
        <h2>📜 History</h2>
        <p>Complete history of all AI tasks and outputs, grouped by date.</p>
      </div>

      {Object.entries(groups).map(([date, dateTasks]) => (
        <div key={date} style={{ marginBottom: 28 }}>
          <div className="tasks-divider">
            <div className="tasks-divider-line" />
            <div className="tasks-divider-label">📅 {date}</div>
            <div className="tasks-divider-line" />
          </div>
          <div className="ai-tasks-grid">
            {dateTasks.map((t, i) => (
              <AITaskCard key={t.id} task={t}
                onToggle={handleToggle}
                onDelete={handleDelete}
                onRerun={task => onNavigate('create-task', task)}
                animDelay={i * 0.04}
              />
            ))}
          </div>
        </div>
      ))}
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   SETTINGS PAGE
   ✅ Developer key from .env shown with status
   ✅ User key input (overrides dev key)
   ✅ Both options clearly explained
════════════════════════════════════════════════════════════ */
function SettingsPage({ toast }: { toast: (m: string, t?: 'success' | 'error' | 'info') => void }) {
  const [userKey,  setUserKey]  = useState(Storage.get<string>('smai_gemini_key', ''));
  const [showKey,  setShowKey]  = useState(false);
  const [testing,  setTesting]  = useState(false);

  const hasDevKey  = DEV_API_KEY.length > 10;
  const hasUserKey = userKey.trim().length > 10;
  const effectKey  = getEffectiveApiKey();

  const saveUserKey = () => {
    Storage.set('smai_gemini_key', userKey.trim());
    toast('✅ Your API key saved!', 'success');
  };

  const clearUserKey = () => {
    Storage.set('smai_gemini_key', '');
    setUserKey('');
    toast('User API key cleared. Using developer key (if set).', 'info');
  };

  // Test the current active key
  const testKey = async () => {
    if (!effectKey) { toast('No API key to test.', 'error'); return; }
    setTesting(true);
    try {
      const result = await callGemini('Say exactly: "Gemini API connection successful!"', 'general');
      if (result.includes('success') || result.toLowerCase().includes('gemini')) {
        toast('✅ API key works! Gemini is connected.', 'success');
      } else {
        toast('✅ API key works! Response: ' + result.slice(0, 60), 'success');
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Test failed';
      toast(`❌ ${msg}`, 'error');
    } finally {
      setTesting(false);
    }
  };

  return (
    <>
      <div className="page-header">
        <h2>⚙️ Settings</h2>
        <p>Configure your Smart AI Assistant — API keys and platform settings.</p>
      </div>

      <div className="settings-grid">
        {/* ── API Key Card ── */}
        <div className="settings-card">
          <h3>🔑 Gemini API Key</h3>

          {/* Overall status */}
          <div className={`api-status-box ${effectKey ? 'active' : 'inactive'}`}>
            {effectKey ? '🟢 Gemini AI is connected and ready!' : '🔴 No API key — AI features disabled'}
          </div>

          {/* Developer Key Status */}
          <div style={{ marginBottom: 18, padding: '12px 14px', background: 'rgba(59,130,246,0.06)', border: '1px solid var(--border)', borderRadius: 10 }}>
            <div style={{ fontWeight: 700, fontSize: 12, color: 'var(--accent-l)', marginBottom: 6 }}>
              🏗 Developer Key (from .env)
            </div>
            <div style={{ fontSize: 13, color: hasDevKey ? 'var(--accent3)' : '#f87171' }}>
              {hasDevKey
                ? '✅ Configured — used as default when no user key is set'
                : '❌ Not set — set VITE_GEMINI_API_KEY in your .env file and rebuild'}
            </div>
            {hasDevKey && (
              <div style={{ marginTop: 6, fontSize: 12, color: 'var(--text3)' }}>
                Key: {DEV_API_KEY.slice(0, 8)}{'•'.repeat(20)}
              </div>
            )}
          </div>

          {/* User Key Input */}
          <div style={{ marginBottom: 10, fontWeight: 700, fontSize: 12, color: 'var(--text2)', textTransform: 'uppercase', letterSpacing: '0.06em' }}>
            👤 Your Personal Key (optional — overrides developer key)
          </div>

          <div className="form-group">
            <label>Your Gemini API Key</label>
            <div className="api-key-input-wrap">
              <input
                type={showKey ? 'text' : 'password'}
                className="form-control"
                placeholder="AIzaSy… (paste your key here)"
                value={userKey}
                onChange={e => setUserKey(e.target.value)}
              />
              <button className="api-key-toggle" onClick={() => setShowKey(s => !s)}>
                {showKey ? '🙈' : '👁'}
              </button>
            </div>
          </div>

          <div style={{ display: 'flex', gap: 10, marginBottom: 14 }}>
            <button className="btn btn-primary" style={{ flex: 1 }} onClick={saveUserKey}>
              💾 Save My Key
            </button>
            {hasUserKey && (
              <button className="btn btn-ghost" onClick={clearUserKey}>Clear</button>
            )}
          </div>

          {/* Test button */}
          <button
            className="btn btn-secondary btn-full"
            onClick={testKey}
            disabled={testing || !effectKey}
            style={{ marginBottom: 16 }}
          >
            {testing ? '⏳ Testing…' : '🧪 Test Connection'}
          </button>

          {/* How to get key */}
          <div style={{ padding: '14px', background: 'rgba(59,130,246,0.04)', border: '1px solid var(--border)', borderRadius: 10, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.8 }}>
            <strong style={{ color: 'var(--accent-l)', display: 'block', marginBottom: 6 }}>
              How to get a FREE Gemini API key:
            </strong>
            1. Go to <strong>aistudio.google.com</strong><br />
            2. Sign in with your Google account<br />
            3. Click <strong>"Get API Key"</strong> → Create new key<br />
            4. Copy the key and paste it above<br />
            <span style={{ color: 'var(--accent3)', fontWeight: 600 }}>
              ✅ 100% Free — no credit card needed!
            </span>
          </div>
        </div>

        {/* ── Platform Info ── */}
        <div className="settings-card">
          <h3>🤖 Platform Info</h3>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 2, marginBottom: 20 }}>
            {[
              { label: 'Platform Name',  value: 'Smart Multi-AI Assistant' },
              { label: 'Version',        value: 'v4.0 — Task 3 + Task 4' },
              { label: 'AI Model',       value: 'gemini-2.0-flash' },
              { label: 'API Version',    value: 'v1beta' },
              { label: 'Storage',        value: 'localStorage (browser)' },
              { label: 'Backend',        value: 'Not required (Frontend only)' },
              { label: 'Framework',      value: 'React 19 + TypeScript + Vite' }
            ].map(({ label, value }) => (
              <div key={label} style={{ display: 'flex', justifyContent: 'space-between', padding: '10px 0', borderBottom: '1px solid var(--border)', fontSize: 13 }}>
                <span style={{ color: 'var(--text3)', fontWeight: 500 }}>{label}</span>
                <span style={{ color: 'var(--text)', fontWeight: 600 }}>{value}</span>
              </div>
            ))}
          </div>

          <div style={{ padding: '16px', background: 'linear-gradient(135deg, rgba(59,130,246,0.07), rgba(139,92,246,0.05))', border: '1px solid rgba(59,130,246,0.2)', borderRadius: 12 }}>
            <div style={{ fontSize: 13, fontWeight: 700, color: 'var(--text)', marginBottom: 10 }}>
              ✅ AI Capabilities
            </div>
            {[
              '📝 Content Generation — blogs, emails, articles',
              '💻 Code Assistance — any language, debugging',
              '🎨 Image Descriptions — AI art prompts',
              '📋 Task Planning — project management',
              '🤖 General AI Chat — any question'
            ].map(c => (
              <div key={c} style={{ fontSize: 12.5, color: 'var(--accent3)', marginBottom: 6 }}>✓ {c}</div>
            ))}
          </div>

          <div style={{ marginTop: 16, padding: '14px', background: 'rgba(16,185,129,0.06)', border: '1px solid rgba(16,185,129,0.2)', borderRadius: 12, fontSize: 12.5, color: 'var(--text2)', lineHeight: 1.7 }}>
            <strong style={{ color: 'var(--accent3)', display: 'block', marginBottom: 6 }}>
              🔑 API Key Priority
            </strong>
            <strong>1st:</strong> Your personal key (from Settings)<br />
            <strong>2nd:</strong> Developer key (from .env file)<br />
            If both are missing, AI features are disabled.
          </div>
        </div>
      </div>
    </>
  );
}

/* ════════════════════════════════════════════════════════════
   ROOT APP
════════════════════════════════════════════════════════════ */
export default function App() {
  const [page,    setPage]    = useState<Page>(() => Auth.isLoggedIn() ? 'dashboard' : 'login');
  const [payload, setPayload] = useState<unknown>(null);
  const [tick,    setTick]    = useState(0);

  // Seed demo user on first load
  useEffect(() => {
    if (Auth.getUsers().length === 0) {
      Auth.register('Demo User', 'demo@smartai.com', 'demo123');
    }
  }, []);

  const { toasts, toast } = useToasts();

  // Navigation with auth guard
  const navigate = useCallback((target: Page, pl?: unknown) => {
    const loggedIn   = Auth.isLoggedIn();
    const protected_ = ['dashboard', 'tools', 'tasks', 'create-task', 'history', 'settings'] as Page[];
    const authOnly   = ['login', 'register'] as Page[];
    if (protected_.includes(target) && !loggedIn) { setPage('login'); return; }
    if (authOnly.includes(target)   && loggedIn)  { setPage('dashboard'); return; }
    setPayload(pl ?? null);
    setPage(target);
  }, []);

  const handleLogout = () => {
    Auth.logout();
    toast('Logged out successfully.', 'info');
    setTimeout(() => setPage('login'), 400);
  };

  // Force re-render when tasks are mutated in localStorage
  const refresh = useCallback(() => setTick(t => t + 1), []);

  // ── Auth-only pages (no sidebar)
  if (page === 'login')    return <><LoginPage    onNavigate={navigate} toast={toast} /><ToastContainer toasts={toasts} /></>;
  if (page === 'register') return <><RegisterPage onNavigate={navigate} toast={toast} /><ToastContainer toasts={toasts} /></>;

  const PAGE_TITLES: Record<string, string> = {
    dashboard:     '🏠 Dashboard',
    tools:         '🤖 AI Tools',
    tasks:         '📋 AI Tasks',
    'create-task': '➕ Create AI Task',
    history:       '📜 History',
    settings:      '⚙️ Settings'
  };

  return (
    <>
      <AppShell
        title={PAGE_TITLES[page] || 'Dashboard'}
        activePage={page}
        onNavigate={navigate}
        onLogout={handleLogout}
      >
        {page === 'dashboard' && (
          <DashboardPage key={tick} onNavigate={navigate} toast={toast} refresh={refresh} />
        )}
        {page === 'tools' && (
          <AIToolsPage onNavigate={navigate} />
        )}
        {page === 'create-task' && (
          <CreateTaskPage
            key={JSON.stringify(payload)}
            onNavigate={navigate}
            toast={toast}
            refresh={refresh}
            payload={payload}
          />
        )}
        {page === 'tasks' && (
          <TasksPage key={tick} onNavigate={navigate} toast={toast} refresh={refresh} />
        )}
        {page === 'history' && (
          <HistoryPage key={tick} onNavigate={navigate} toast={toast} refresh={refresh} />
        )}
        {page === 'settings' && (
          <SettingsPage toast={toast} />
        )}
      </AppShell>
      <ToastContainer toasts={toasts} />
    </>
  );
}
