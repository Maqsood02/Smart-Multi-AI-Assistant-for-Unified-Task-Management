/* ============================================
   SMART MULTI-AI ASSISTANT — Main JS
   ============================================ */

'use strict';

/* ══════════════════════════════════════════
   STORAGE HELPERS
══════════════════════════════════════════ */
const Storage = {
  get: (key, fallback = null) => {
    try { const v = localStorage.getItem(key); return v ? JSON.parse(v) : fallback; }
    catch { return fallback; }
  },
  set: (key, value) => { try { localStorage.setItem(key, JSON.stringify(value)); } catch {} },
  remove: (key) => { try { localStorage.removeItem(key); } catch {} }
};

/* ══════════════════════════════════════════
   AUTH
══════════════════════════════════════════ */
const Auth = {
  KEY: 'smai_users',
  SESSION: 'smai_session',

  getUsers() { return Storage.get(this.KEY, []); },
  saveUsers(u) { Storage.set(this.KEY, u); },

  register(name, email, password) {
    const users = this.getUsers();
    if (users.find(u => u.email === email)) return { ok: false, msg: 'Email already registered.' };
    users.push({ id: Date.now(), name, email, password });
    this.saveUsers(users);
    return { ok: true };
  },

  login(email, password) {
    const users = this.getUsers();
    const user = users.find(u => u.email === email && u.password === password);
    if (!user) return { ok: false, msg: 'Invalid email or password.' };
    Storage.set(this.SESSION, { id: user.id, name: user.name, email: user.email });
    return { ok: true, user };
  },

  logout() { Storage.remove(this.SESSION); },

  current() { return Storage.get(this.SESSION, null); },

  isLoggedIn() { return !!this.current(); }
};

/* ══════════════════════════════════════════
   TASKS
══════════════════════════════════════════ */
const Tasks = {
  KEY: 'smai_tasks',

  all() { return Storage.get(this.KEY, []); },

  forUser(userId) { return this.all().filter(t => t.userId === userId); },

  add(task) {
    const tasks = this.all();
    tasks.unshift({ id: Date.now(), createdAt: new Date().toISOString(), done: false, ...task });
    Storage.set(this.KEY, tasks);
  },

  toggle(id) {
    const tasks = this.all();
    const t = tasks.find(t => t.id === id);
    if (t) t.done = !t.done;
    Storage.set(this.KEY, tasks);
  },

  delete(id) {
    Storage.set(this.KEY, this.all().filter(t => t.id !== id));
  },

  stats(userId) {
    const tasks = this.forUser(userId);
    return {
      total: tasks.length,
      done: tasks.filter(t => t.done).length,
      pending: tasks.filter(t => !t.done).length,
      high: tasks.filter(t => t.priority === 'high' && !t.done).length
    };
  }
};

/* ══════════════════════════════════════════
   ROUTER
══════════════════════════════════════════ */
const Router = {
  currentPage: null,

  go(page) {
    this.currentPage = page;
    const params = new URLSearchParams(window.location.search);
    params.set('page', page);
    window.history.pushState({}, '', '?' + params.toString());
    this.render();
  },

  init() {
    const params = new URLSearchParams(window.location.search);
    const page = params.get('page') || 'login';
    this.currentPage = page;
    this.render();
    window.addEventListener('popstate', () => {
      const p = new URLSearchParams(window.location.search).get('page') || 'login';
      this.currentPage = p;
      this.render();
    });
  },

  render() {
    const page = this.currentPage;
    const loggedIn = Auth.isLoggedIn();

    // Guard routes
    if (['dashboard', 'add-task', 'tasks'].includes(page) && !loggedIn) {
      this.go('login'); return;
    }
    if (['login', 'register'].includes(page) && loggedIn) {
      this.go('dashboard'); return;
    }

    // Render
    const map = {
      login:     Pages.login,
      register:  Pages.register,
      dashboard: Pages.dashboard,
      'add-task': Pages.addTask,
      tasks:     Pages.tasks
    };
    const renderer = map[page] || Pages.login;
    document.getElementById('app').innerHTML = renderer();
    this.afterRender(page);
  },

  afterRender(page) {
    UI.initToasts();
    const map = {
      login:     Events.login,
      register:  Events.register,
      dashboard: Events.dashboard,
      'add-task': Events.addTask,
      tasks:     Events.tasks
    };
    if (map[page]) map[page]();
  }
};

/* ══════════════════════════════════════════
   UI HELPERS
══════════════════════════════════════════ */
const UI = {
  toast(msg, type = 'info') {
    const tc = document.getElementById('toast-container');
    if (!tc) return;
    const el = document.createElement('div');
    el.className = `toast ${type}`;
    const icons = { success: '✅', error: '❌', info: 'ℹ️' };
    el.innerHTML = `<span>${icons[type] || 'ℹ️'}</span><span>${msg}</span>`;
    tc.appendChild(el);
    setTimeout(() => { el.style.opacity = '0'; el.style.transition = 'opacity 0.4s'; setTimeout(() => el.remove(), 400); }, 3000);
  },

  initToasts() {
    if (!document.getElementById('toast-container')) {
      const tc = document.createElement('div');
      tc.id = 'toast-container';
      tc.className = 'toast-container';
      document.body.appendChild(tc);
    }
  },

  showError(inputEl, msg) {
    inputEl.classList.add('error');
    const errEl = inputEl.parentElement.querySelector('.field-error');
    if (errEl) { errEl.textContent = msg; errEl.classList.add('show'); }
  },

  clearError(inputEl) {
    inputEl.classList.remove('error');
    const errEl = inputEl.parentElement.querySelector('.field-error');
    if (errEl) errEl.classList.remove('show');
  },

  validateRequired(inputs) {
    let valid = true;
    inputs.forEach(({ el, label }) => {
      if (!el.value.trim()) {
        this.showError(el, `${label} is required.`);
        valid = false;
      } else {
        this.clearError(el);
      }
    });
    return valid;
  },

  validateEmail(el) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!re.test(el.value.trim())) {
      this.showError(el, 'Enter a valid email address.');
      return false;
    }
    this.clearError(el);
    return true;
  },

  validateMinLength(el, min, label) {
    if (el.value.trim().length < min) {
      this.showError(el, `${label} must be at least ${min} characters.`);
      return false;
    }
    this.clearError(el);
    return true;
  },

  // Sidebar / mobile
  initSidebar() {
    const sidebar = document.getElementById('sidebar');
    const overlay = document.getElementById('sidebar-overlay');
    const menuBtn = document.getElementById('menu-btn');
    if (!sidebar) return;
    const open  = () => { sidebar.classList.add('open'); overlay?.classList.add('show'); };
    const close = () => { sidebar.classList.remove('open'); overlay?.classList.remove('show'); };
    menuBtn?.addEventListener('click', open);
    overlay?.addEventListener('click', close);
  },

  // Active nav
  setActiveNav(page) {
    document.querySelectorAll('.nav-item').forEach(el => {
      el.classList.toggle('active', el.dataset.page === page);
    });
  },

  // Nav click
  bindNav() {
    document.querySelectorAll('.nav-item[data-page]').forEach(el => {
      el.addEventListener('click', (e) => {
        e.preventDefault();
        Router.go(el.dataset.page);
      });
    });
    const logoutBtn = document.getElementById('logout-btn');
    if (logoutBtn) {
      logoutBtn.addEventListener('click', () => {
        Auth.logout();
        UI.toast('Logged out successfully.', 'info');
        setTimeout(() => Router.go('login'), 500);
      });
    }
  },

  formatDate(iso) {
    const d = new Date(iso);
    return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
  },

  priorityBadge(p) {
    const map = { high: 'red', medium: 'purple', low: 'green' };
    const cls = map[p] || 'blue';
    const labels = { high: '🔴 High', medium: '🟡 Medium', low: '🟢 Low' };
    return `<span class="badge ${cls}">${labels[p] || p}</span>`;
  },

  categoryBadge(c) {
    return `<span class="badge">${c}</span>`;
  },

  renderTaskCard(task, showActions = true) {
    return `
      <div class="task-card ${task.done ? 'done' : ''}" data-id="${task.id}">
        <div class="priority-dot ${task.priority}"></div>
        <div class="task-check ${task.done ? 'checked' : ''}" data-toggle="${task.id}"></div>
        <div class="task-body">
          <div class="task-title">${this.escape(task.title)}</div>
          ${task.description ? `<div class="task-desc">${this.escape(task.description)}</div>` : ''}
          <div class="task-meta">
            ${this.priorityBadge(task.priority)}
            ${task.category ? this.categoryBadge(task.category) : ''}
            ${task.dueDate ? `<span class="text-muted">📅 ${task.dueDate}</span>` : ''}
            <span class="text-muted">🕐 ${this.formatDate(task.createdAt)}</span>
          </div>
        </div>
        ${showActions ? `<div class="task-actions">
          <button class="btn btn-ghost btn-sm" data-delete="${task.id}" title="Delete">🗑️</button>
        </div>` : ''}
      </div>`;
  },

  escape(str) {
    if (!str) return '';
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
  },

  bindTaskActions(containerSelector) {
    const container = document.querySelector(containerSelector);
    if (!container) return;
    container.addEventListener('click', (e) => {
      const toggle = e.target.closest('[data-toggle]');
      const del    = e.target.closest('[data-delete]');
      if (toggle) {
        Tasks.toggle(Number(toggle.dataset.toggle));
        Events.refreshTaskList();
      }
      if (del) {
        if (confirm('Delete this task?')) {
          Tasks.delete(Number(del.dataset.delete));
          UI.toast('Task deleted.', 'info');
          Events.refreshTaskList();
        }
      }
    });
  }
};

/* ══════════════════════════════════════════
   PAGE TEMPLATES
══════════════════════════════════════════ */
const Pages = {
  /* ── Login ── */
  login() {
    return `
    <div class="auth-page">
      <div class="auth-left">
        <div class="grid-lines"></div>
        <div class="auth-left-content">
          <div class="auth-logo">🤖</div>
          <h1>Smart Multi-AI Assistant</h1>
          <p>Your intelligent task command center powered by cutting-edge AI workflows.</p>
          <div class="auth-features">
            <div class="auth-feature"><span class="auth-feature-icon">⚡</span><div class="auth-feature-text"><strong>AI-Powered Tasks</strong><br>Smart categorization and priority suggestions</div></div>
            <div class="auth-feature"><span class="auth-feature-icon">📊</span><div class="auth-feature-text"><strong>Live Dashboard</strong><br>Real-time stats and progress tracking</div></div>
            <div class="auth-feature"><span class="auth-feature-icon">🔒</span><div class="auth-feature-text"><strong>Secure & Private</strong><br>Your data stays on your device</div></div>
          </div>
        </div>
      </div>
      <div class="auth-right">
        <div class="auth-form-wrap page">
          <h2>Welcome back 👋</h2>
          <p class="subtitle">Sign in to your Smart AI Assistant account</p>
          <div class="form-group">
            <label>Email address</label>
            <input type="email" id="login-email" class="form-control" placeholder="you@example.com" autocomplete="email">
            <span class="field-error"></span>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="login-pass" class="form-control" placeholder="Your password" autocomplete="current-password">
            <span class="field-error"></span>
          </div>
          <div id="login-error" class="text-muted mt-sm" style="color:var(--danger);font-size:13px;display:none;"></div>
          <button class="btn btn-primary btn-full btn-lg mt-md" id="login-btn">Sign In →</button>
          <div class="auth-divider">or</div>
          <button class="btn btn-secondary btn-full" id="go-register">Create an account</button>
          <div class="auth-footer">Don't have an account? <a href="#" id="go-register-2">Register here</a></div>
        </div>
      </div>
    </div>`;
  },

  /* ── Register ── */
  register() {
    return `
    <div class="auth-page">
      <div class="auth-left">
        <div class="grid-lines"></div>
        <div class="auth-left-content">
          <div class="auth-logo">🤖</div>
          <h1>Join Smart AI</h1>
          <p>Create your free account and start managing tasks with the power of AI.</p>
          <div class="auth-features">
            <div class="auth-feature"><span class="auth-feature-icon">🚀</span><div class="auth-feature-text"><strong>Free Forever</strong><br>No credit card required</div></div>
            <div class="auth-feature"><span class="auth-feature-icon">🧠</span><div class="auth-feature-text"><strong>AI Assistance</strong><br>Get smart suggestions instantly</div></div>
            <div class="auth-feature"><span class="auth-feature-icon">🎯</span><div class="auth-feature-text"><strong>Stay Focused</strong><br>Priority-first task management</div></div>
          </div>
        </div>
      </div>
      <div class="auth-right">
        <div class="auth-form-wrap page">
          <h2>Create account 🚀</h2>
          <p class="subtitle">Join thousands of users boosting their productivity</p>
          <div class="form-group">
            <label>Full Name</label>
            <input type="text" id="reg-name" class="form-control" placeholder="Jane Doe" autocomplete="name">
            <span class="field-error"></span>
          </div>
          <div class="form-group">
            <label>Email address</label>
            <input type="email" id="reg-email" class="form-control" placeholder="you@example.com" autocomplete="email">
            <span class="field-error"></span>
          </div>
          <div class="form-group">
            <label>Password</label>
            <input type="password" id="reg-pass" class="form-control" placeholder="Minimum 6 characters" autocomplete="new-password">
            <span class="field-error"></span>
          </div>
          <div class="form-group">
            <label>Confirm Password</label>
            <input type="password" id="reg-pass2" class="form-control" placeholder="Repeat your password" autocomplete="new-password">
            <span class="field-error"></span>
          </div>
          <div id="reg-error" class="text-muted mt-sm" style="color:var(--danger);font-size:13px;display:none;"></div>
          <button class="btn btn-primary btn-full btn-lg mt-md" id="reg-btn">Create Account →</button>
          <div class="auth-footer">Already have an account? <a href="#" id="go-login">Sign in</a></div>
        </div>
      </div>
    </div>`;
  },

  /* ── App shell wrapper ── */
  appShell(pageTitle, bodyContent, activePage) {
    const user = Auth.current();
    const stats = user ? Tasks.stats(user.id) : {};
    const initials = user ? user.name.split(' ').map(n=>n[0]).join('').toUpperCase().slice(0,2) : 'U';
    return `
    <div class="app-layout">
      <div id="sidebar-overlay" class="sidebar-overlay"></div>
      <aside class="sidebar" id="sidebar">
        <div class="sidebar-logo">
          <div class="sidebar-logo-icon">🤖</div>
          <div class="sidebar-logo-text">SmartAI <span>Multi-AI Assistant</span></div>
        </div>
        <div class="sidebar-section">
          <div class="sidebar-label">Main</div>
          <a class="nav-item" data-page="dashboard"><span class="nav-icon">📊</span>Dashboard ${stats.pending>0?`<span class="nav-badge">${stats.pending}</span>`:''}</a>
          <a class="nav-item" data-page="tasks"><span class="nav-icon">📋</span>All Tasks</a>
          <a class="nav-item" data-page="add-task"><span class="nav-icon">➕</span>Add Task</a>
        </div>
        <div class="sidebar-section mt-md">
          <div class="sidebar-label">Quick Stats</div>
          <div style="padding:12px 12px;background:rgba(91,124,250,0.06);border:1px solid var(--border);border-radius:10px;font-size:13px;">
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:var(--muted);">Total Tasks</span><strong>${stats.total||0}</strong></div>
            <div style="display:flex;justify-content:space-between;margin-bottom:8px;"><span style="color:var(--muted);">Completed</span><strong style="color:var(--accent3)">${stats.done||0}</strong></div>
            <div style="display:flex;justify-content:space-between;"><span style="color:var(--muted);">Pending</span><strong style="color:var(--accent)">${stats.pending||0}</strong></div>
          </div>
        </div>
        <div class="sidebar-footer">
          <div class="user-chip">
            <div class="user-avatar">${initials}</div>
            <div class="user-info">
              <div class="user-name">${UI.escape(user?.name||'User')}</div>
              <div class="user-role">AI Assistant User</div>
            </div>
            <span class="logout-btn" id="logout-btn" title="Logout">⏻</span>
          </div>
        </div>
      </aside>
      <div class="main-content">
        <div class="top-bar">
          <div class="flex gap-md" style="align-items:center">
            <button class="menu-btn" id="menu-btn">☰</button>
            <span class="top-bar-title">${pageTitle}</span>
          </div>
          <div class="top-bar-right">
            <span class="text-muted" style="font-size:13px;">👤 ${UI.escape(user?.name||'')}</span>
            <button class="btn btn-primary btn-sm" onclick="Router.go('add-task')">+ New Task</button>
          </div>
        </div>
        <div class="page-content page">
          ${bodyContent}
        </div>
      </div>
    </div>`;
  },

  /* ── Dashboard ── */
  dashboard() {
    const user = Auth.current();
    const tasks = Tasks.forUser(user.id);
    const stats = Tasks.stats(user.id);
    const pct = stats.total ? Math.round((stats.done/stats.total)*100) : 0;
    const recent = tasks.slice(0, 5);

    const body = `
      <div class="page-header">
        <h2>Good day, ${UI.escape(user.name.split(' ')[0])} 👋</h2>
        <p>Here's what's happening with your tasks today.</p>
      </div>
      <div class="stats-grid">
        <div class="stat-card blue">
          <div class="stat-icon">📋</div>
          <div class="stat-value">${stats.total}</div>
          <div class="stat-label">Total Tasks</div>
        </div>
        <div class="stat-card green">
          <div class="stat-icon">✅</div>
          <div class="stat-value">${stats.done}</div>
          <div class="stat-label">Completed</div>
        </div>
        <div class="stat-card purple">
          <div class="stat-icon">⏳</div>
          <div class="stat-value">${stats.pending}</div>
          <div class="stat-label">Pending</div>
        </div>
        <div class="stat-card red">
          <div class="stat-icon">🔴</div>
          <div class="stat-value">${stats.high}</div>
          <div class="stat-label">High Priority</div>
        </div>
      </div>

      <!-- Progress bar -->
      <div class="card mt-md" style="margin-bottom:28px;">
        <div style="display:flex;align-items:center;justify-content:space-between;margin-bottom:14px;">
          <h3 style="font-size:15px;font-family:'Syne',sans-serif;">Overall Progress</h3>
          <span style="font-family:'Syne',sans-serif;font-size:22px;font-weight:800;color:var(--accent)">${pct}%</span>
        </div>
        <div style="height:8px;background:rgba(255,255,255,0.06);border-radius:100px;overflow:hidden;">
          <div style="height:100%;width:${pct}%;background:linear-gradient(90deg,var(--accent),var(--accent2));border-radius:100px;transition:width 0.8s ease;"></div>
        </div>
        <div style="display:flex;justify-content:space-between;margin-top:8px;font-size:12px;color:var(--muted);">
          <span>${stats.done} completed</span><span>${stats.pending} remaining</span>
        </div>
      </div>

      <div class="section-header">
        <h3>Recent Tasks</h3>
        <button class="btn btn-ghost btn-sm" onclick="Router.go('tasks')">View all →</button>
      </div>
      <div class="tasks-grid" id="task-list">
        ${recent.length === 0
          ? `<div class="empty-state"><div class="empty-icon">📭</div><h4>No tasks yet</h4><p>Create your first task to get started</p><br><button class="btn btn-primary mt-md" onclick="Router.go('add-task')">+ Add First Task</button></div>`
          : recent.map(t => UI.renderTaskCard(t)).join('')}
      </div>`;

    return Pages.appShell('Dashboard', body, 'dashboard');
  },

  /* ── All Tasks ── */
  tasks() {
    const user = Auth.current();
    const allTasks = Tasks.forUser(user.id);

    const body = `
      <div class="page-header">
        <h2>All Tasks</h2>
        <p>Manage and track all your tasks in one place.</p>
      </div>
      <div class="filter-bar">
        <div class="search-wrap">
          <span class="search-icon">🔍</span>
          <input type="text" id="search-input" class="form-control" placeholder="Search tasks…">
        </div>
        <button class="filter-btn active" data-filter="all">All (${allTasks.length})</button>
        <button class="filter-btn" data-filter="pending">Pending (${allTasks.filter(t=>!t.done).length})</button>
        <button class="filter-btn" data-filter="done">Done (${allTasks.filter(t=>t.done).length})</button>
        <button class="filter-btn" data-filter="high">High Priority</button>
      </div>
      <div class="tasks-grid" id="task-list">
        ${allTasks.length === 0
          ? `<div class="empty-state"><div class="empty-icon">📂</div><h4>No tasks found</h4><p>Add your first task to see it here.</p><br><button class="btn btn-primary mt-md" onclick="Router.go('add-task')">+ Add Task</button></div>`
          : allTasks.map(t => UI.renderTaskCard(t)).join('')}
      </div>`;

    return Pages.appShell('All Tasks', body, 'tasks');
  },

  /* ── Add Task ── */
  addTask() {
    const body = `
      <div class="page-header">
        <h2>Add New Task</h2>
        <p>Fill in the details below to create a new task.</p>
      </div>
      <div class="add-task-layout">
        <div class="form-card">
          <h3>✏️ Task Details</h3>
          <div class="form-group">
            <label>Task Title *</label>
            <input type="text" id="task-title" class="form-control" placeholder="e.g. Review AI model output" maxlength="100">
            <span class="field-error"></span>
          </div>
          <div class="form-group">
            <label>Description</label>
            <textarea id="task-desc" class="form-control" placeholder="Add more context or details about this task…" rows="4"></textarea>
            <span class="field-error"></span>
          </div>
          <div style="display:grid;grid-template-columns:1fr 1fr;gap:16px;">
            <div class="form-group">
              <label>Priority *</label>
              <select id="task-priority" class="form-control">
                <option value="">Select priority</option>
                <option value="high">🔴 High</option>
                <option value="medium">🟡 Medium</option>
                <option value="low">🟢 Low</option>
              </select>
              <span class="field-error"></span>
            </div>
            <div class="form-group">
              <label>Category</label>
              <select id="task-category" class="form-control">
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
          <div class="form-group">
            <label>Due Date</label>
            <input type="date" id="task-due" class="form-control">
          </div>
          <div style="display:flex;gap:12px;">
            <button class="btn btn-primary btn-lg" id="save-task-btn" style="flex:1">💾 Save Task</button>
            <button class="btn btn-secondary" onclick="Router.go('tasks')">Cancel</button>
          </div>
        </div>

        <div>
          <div class="tips-card">
            <h4>✨ Tips for great tasks</h4>
            <div class="tip-item"><span class="tip-num">1</span><span>Use clear, action-oriented titles that start with a verb (e.g. "Write report", "Review code").</span></div>
            <div class="tip-item"><span class="tip-num">2</span><span>Set a realistic due date to keep yourself accountable.</span></div>
            <div class="tip-item"><span class="tip-num">3</span><span>Use <strong style="color:var(--danger)">High</strong> priority sparingly — only for truly urgent items.</span></div>
            <div class="tip-item"><span class="tip-num">4</span><span>Categorize tasks to easily filter and find them later.</span></div>
            <div class="tip-item"><span class="tip-num">5</span><span>Add a short description to give context when you revisit the task.</span></div>
          </div>

          <div class="tips-card mt-md" style="margin-top:16px;">
            <h4>🧠 AI Suggestion</h4>
            <p style="font-size:13px;color:var(--muted);line-height:1.7;">Break large tasks into smaller subtasks. Tasks that take less than 2 hours are much easier to start and complete without procrastination.</p>
          </div>
        </div>
      </div>`;

    return Pages.appShell('Add Task', body, 'add-task');
  }
};

/* ══════════════════════════════════════════
   EVENT BINDERS
══════════════════════════════════════════ */
const Events = {
  currentFilter: 'all',
  currentSearch: '',

  login() {
    const btn    = document.getElementById('login-btn');
    const emailEl= document.getElementById('login-email');
    const passEl = document.getElementById('login-pass');
    const errEl  = document.getElementById('login-error');

    const doLogin = () => {
      const v1 = UI.validateRequired([
        { el: emailEl, label: 'Email' },
        { el: passEl,  label: 'Password' }
      ]);
      if (!v1) return;
      if (!UI.validateEmail(emailEl)) return;

      const result = Auth.login(emailEl.value.trim(), passEl.value);
      if (!result.ok) {
        errEl.textContent = result.msg; errEl.style.display = 'block';
        UI.showError(emailEl, ' '); UI.showError(passEl, ' ');
      } else {
        UI.toast('Welcome back! Redirecting…', 'success');
        setTimeout(() => Router.go('dashboard'), 600);
      }
    };

    btn?.addEventListener('click', doLogin);
    [emailEl, passEl].forEach(el => el?.addEventListener('keydown', e => { if (e.key === 'Enter') doLogin(); }));
    [emailEl, passEl].forEach(el => el?.addEventListener('input', () => { UI.clearError(el); errEl.style.display='none'; }));

    document.getElementById('go-register')?.addEventListener('click', () => Router.go('register'));
    document.getElementById('go-register-2')?.addEventListener('click', (e) => { e.preventDefault(); Router.go('register'); });
  },

  register() {
    const btn    = document.getElementById('reg-btn');
    const nameEl = document.getElementById('reg-name');
    const emailEl= document.getElementById('reg-email');
    const passEl = document.getElementById('reg-pass');
    const pass2El= document.getElementById('reg-pass2');
    const errEl  = document.getElementById('reg-error');

    const doReg = () => {
      const v1 = UI.validateRequired([
        { el: nameEl,  label: 'Full name' },
        { el: emailEl, label: 'Email' },
        { el: passEl,  label: 'Password' },
        { el: pass2El, label: 'Confirm password' }
      ]);
      if (!v1) return;
      if (!UI.validateEmail(emailEl)) return;
      if (!UI.validateMinLength(passEl, 6, 'Password')) return;
      if (passEl.value !== pass2El.value) { UI.showError(pass2El, 'Passwords do not match.'); return; }

      const result = Auth.register(nameEl.value.trim(), emailEl.value.trim(), passEl.value);
      if (!result.ok) { errEl.textContent = result.msg; errEl.style.display = 'block'; }
      else {
        UI.toast('Account created! Signing you in…', 'success');
        Auth.login(emailEl.value.trim(), passEl.value);
        setTimeout(() => Router.go('dashboard'), 700);
      }
    };

    btn?.addEventListener('click', doReg);
    [nameEl, emailEl, passEl, pass2El].forEach(el => {
      el?.addEventListener('keydown', e => { if (e.key === 'Enter') doReg(); });
      el?.addEventListener('input', () => { UI.clearError(el); errEl.style.display = 'none'; });
    });
    document.getElementById('go-login')?.addEventListener('click', (e) => { e.preventDefault(); Router.go('login'); });
  },

  dashboard() {
    UI.initSidebar();
    UI.bindNav();
    UI.setActiveNav('dashboard');
    UI.bindTaskActions('#task-list');
    Events.refreshTaskList = () => {
      const user = Auth.current();
      const recent = Tasks.forUser(user.id).slice(0, 5);
      const list = document.getElementById('task-list');
      if (!list) return;
      if (recent.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">📭</div><h4>No tasks yet</h4><p>Create your first task to get started</p><br><button class="btn btn-primary mt-md" onclick="Router.go('add-task')">+ Add First Task</button></div>`;
      } else {
        list.innerHTML = recent.map(t => UI.renderTaskCard(t)).join('');
      }
      UI.bindTaskActions('#task-list');
    };
  },

  tasks() {
    UI.initSidebar();
    UI.bindNav();
    UI.setActiveNav('tasks');
    UI.bindTaskActions('#task-list');

    Events.refreshTaskList = () => {
      const user = Auth.current();
      const all  = Tasks.forUser(user.id);
      let filtered = all;

      if (Events.currentFilter === 'pending') filtered = all.filter(t => !t.done);
      if (Events.currentFilter === 'done')    filtered = all.filter(t => t.done);
      if (Events.currentFilter === 'high')    filtered = all.filter(t => t.priority === 'high');

      if (Events.currentSearch) {
        const q = Events.currentSearch.toLowerCase();
        filtered = filtered.filter(t => t.title.toLowerCase().includes(q) || (t.description||'').toLowerCase().includes(q));
      }

      const list = document.getElementById('task-list');
      if (!list) return;
      if (filtered.length === 0) {
        list.innerHTML = `<div class="empty-state"><div class="empty-icon">🔍</div><h4>No tasks found</h4><p>Try a different filter or search term.</p></div>`;
      } else {
        list.innerHTML = filtered.map(t => UI.renderTaskCard(t)).join('');
      }
      UI.bindTaskActions('#task-list');
    };

    // Filter buttons
    document.querySelectorAll('.filter-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        document.querySelectorAll('.filter-btn').forEach(b => b.classList.remove('active'));
        btn.classList.add('active');
        Events.currentFilter = btn.dataset.filter;
        Events.refreshTaskList();
      });
    });

    // Search
    const searchInput = document.getElementById('search-input');
    searchInput?.addEventListener('input', () => {
      Events.currentSearch = searchInput.value;
      Events.refreshTaskList();
    });
  },

  addTask() {
    UI.initSidebar();
    UI.bindNav();
    UI.setActiveNav('add-task');

    const saveBtn  = document.getElementById('save-task-btn');
    const titleEl  = document.getElementById('task-title');
    const descEl   = document.getElementById('task-desc');
    const prioEl   = document.getElementById('task-priority');
    const catEl    = document.getElementById('task-category');
    const dueEl    = document.getElementById('task-due');

    const doSave = () => {
      const v = UI.validateRequired([
        { el: titleEl, label: 'Task title' },
        { el: prioEl,  label: 'Priority' }
      ]);
      if (!v) return;

      const user = Auth.current();
      Tasks.add({
        userId:      user.id,
        title:       titleEl.value.trim(),
        description: descEl.value.trim(),
        priority:    prioEl.value,
        category:    catEl.value,
        dueDate:     dueEl.value
      });

      UI.toast('Task added successfully! 🎉', 'success');
      setTimeout(() => Router.go('tasks'), 700);
    };

    saveBtn?.addEventListener('click', doSave);
    [titleEl, prioEl].forEach(el => el?.addEventListener('input', () => UI.clearError(el)));
    titleEl?.addEventListener('keydown', e => { if (e.key === 'Enter') doSave(); });
  },

  refreshTaskList() {} // placeholder, overridden per page
};

/* ══════════════════════════════════════════
   BOOTSTRAP
══════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Seed a demo user if no users exist
  if (Auth.getUsers().length === 0) {
    Auth.register('Demo User', 'demo@smartai.com', 'demo123');
  }
  Router.init();
});
