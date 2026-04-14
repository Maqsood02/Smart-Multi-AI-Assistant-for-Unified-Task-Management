# 🤖 Smart Multi-AI Assistant

A clean, modern frontend for an AI-powered task management system.

---

## 📁 Project Structure

```
smart-ai-assistant/
├── index.html          ← Main entry point (single-page app)
├── css/
│   └── style.css       ← All styles (design system, components, responsive)
├── js/
│   └── app.js          ← All logic (auth, tasks, routing, events, UI)
└── README.md
```

---

## 🚀 How to Run

1. **Open directly in browser** — just double-click `index.html`
2. No build tools, no dependencies, no server required.

---

## 📄 Pages

| Page       | Route (`?page=`) | Description                         |
|------------|------------------|-------------------------------------|
| Login      | `login`          | Sign in with email & password       |
| Register   | `register`       | Create a new account                |
| Dashboard  | `dashboard`      | Stats overview + recent tasks       |
| All Tasks  | `tasks`          | Full task list with search & filter |
| Add Task   | `add-task`       | Create a new task                   |

---

## 🔑 Demo Account

A demo account is pre-seeded on first load:

| Field    | Value              |
|----------|--------------------|
| Email    | `demo@smartai.com` |
| Password | `demo123`          |

---

## ✅ Features

- **Authentication** — Register, login, logout with localStorage
- **Task Management** — Add, complete/toggle, delete tasks
- **Filtering** — Filter by All / Pending / Done / High Priority
- **Search** — Real-time search by title or description
- **Validation** — All forms validate required fields and email format
- **Stats Dashboard** — Total, completed, pending, high-priority counters
- **Progress Bar** — Visual completion percentage
- **Responsive** — Works on mobile, tablet, desktop
- **SPA Router** — Hash-free client-side navigation via `?page=`

---

## 🎨 Design

- **Theme:** Dark mode with deep navy + electric blue accents
- **Fonts:** Syne (headings) + DM Sans (body) from Google Fonts
- **Color Palette:**
  - Background: `#0a0d14`
  - Surface: `#111520`
  - Accent: `#5b7cfa` (blue), `#a78bfa` (purple), `#34d399` (green)
- **Components:** Cards, badges, toasts, sidebar, stat cards, task cards

---

## 🛠 Tech Stack

- **HTML5** — Semantic markup
- **CSS3** — Custom properties, Grid, Flexbox, animations
- **Vanilla JavaScript (ES6+)** — No frameworks, no dependencies
- **localStorage** — Persistent data storage

---

## 📱 Responsive Breakpoints

| Breakpoint | Layout                        |
|------------|-------------------------------|
| > 1100px   | Full sidebar + 4-col stats    |
| 820–1100px | Full sidebar + 2-col stats    |
| < 820px    | Slide-in sidebar (hamburger)  |
| < 480px    | Single column stats           |
