# 🤖 Smart Multi-AI Assistant — v5.0

Unified Multi-AI Task Management Platform  
**Tasks 1–5 Complete** | React 19 + TypeScript + Vite | MERN-Ready

---

## 🚀 Quick Start (Frontend Only — Works Right Now)

```bash
# 1. Open SmartAI-Hub-v5.html in any browser
# 2. Go to ⚙️ Settings and add your Gemini API key
# 3. Start using all 10 AI tools!
```

**Free API Keys:**
| Provider   | Link                             | Speed   |
|------------|----------------------------------|---------|
| Groq       | console.groq.com                 | Fastest |
| Gemini     | aistudio.google.com              | Best    |
| OpenRouter | openrouter.ai                    | Many models |

---

## 📁 Project Structure

```
smart-ai-project/
│
├── src/                          ← Frontend (React + TypeScript)
│   ├── types/index.ts            ← All TypeScript types
│   ├── utils/
│   │   ├── storage.ts            ← localStorage wrapper
│   │   ├── helpers.ts            ← ALL_TOOLS config (10 tools)
│   │   ├── voice/speechToText.ts ← Web Speech API hook
│   │   └── aiAdapters/formatters.ts ← Request normalizers
│   │
│   ├── services/                 ← AI Provider Services
│   │   ├── aiGateway.ts          ← MAIN BRAIN: fallback chain + circuit breaker
│   │   ├── geminiService.ts      ← Gemini (multi-key rotation, 3 models)
│   │   ├── groqService.ts        ← Groq (LLaMA 3.3 / Mixtral)
│   │   ├── openrouterService.ts  ← OpenRouter (4 free models)
│   │   └── cloudflareService.ts  ← Cloudflare AI + HuggingFace
│   │
│   ├── data/
│   │   ├── auth.ts               ← User auth (localStorage)
│   │   └── db.ts                 ← Task CRUD (localStorage)
│   │
│   ├── context/AppContext.tsx    ← Global state + navigation
│   │
│   ├── components/
│   │   ├── common/
│   │   │   ├── Toast.tsx         ← Toast notifications
│   │   │   ├── TypingDots.tsx    ← AI loading animation
│   │   │   ├── VoiceInput.tsx    ← 🎤 Mic button (all tools)
│   │   │   ├── AITaskCard.tsx    ← Task card with all actions
│   │   │   └── EmptyState.tsx    ← Empty list states
│   │   └── layout/
│   │       ├── Sidebar.tsx       ← Navigation sidebar
│   │       └── AppShell.tsx      ← Top bar + layout
│   │
│   ├── pages/
│   │   ├── LoginPage.tsx
│   │   ├── RegisterPage.tsx
│   │   ├── Dashboard.tsx         ← AI workspace home
│   │   ├── TasksPage.tsx         ← All tasks + filters + tabs
│   │   ├── CreateTaskPage.tsx    ← 10-type task creator
│   │   ├── AIToolsPage.tsx       ← Tool gallery
│   │   ├── HistoryPage.tsx       ← Grouped by date
│   │   ├── SettingsPage.tsx      ← API keys + provider status
│   │   └── tools/
│   │       ├── ToolPage.tsx      ← Shared template (voice + AI + save)
│   │       └── AllTools.tsx      ← 10 tool page exports
│   │
│   ├── App.tsx                   ← Thin router (30 lines)
│   ├── index.css                 ← All styles
│   └── main.tsx                  ← Entry point
│
├── server/                       ← MERN Backend Scaffold
│   ├── routes/
│   │   ├── aiRoutes.js           ← POST /api/ai/generate
│   │   ├── taskRoutes.js         ← GET/POST/PUT/DELETE /api/tasks
│   │   └── authRoutes.js         ← POST /api/auth/login|register
│   ├── controllers/
│   │   ├── aiController.js
│   │   ├── taskController.js
│   │   └── authController.js
│   ├── services/
│   │   └── aiGateway.js          ← Server-side AI fallback
│   ├── middleware/
│   │   └── authMiddleware.js     ← JWT verification
│   ├── utils/validate.js
│   ├── app.js
│   ├── server.js
│   ├── package.json
│   └── .env.example
│
├── .env                          ← Frontend env (VITE_ prefix)
├── vite.config.ts
└── package.json
```

---

## 🧰 10 AI Tools

| # | Tool | Type | Voice |
|---|------|------|-------|
| 1 | 📝 Content Generator | Existing | ✅ |
| 2 | 💻 Code Assistant    | Existing | ✅ |
| 3 | 🎨 Image Creator     | Existing | ✅ |
| 4 | 📋 Task Manager AI   | Existing | ✅ |
| 5 | 📖 Story Creator     | **NEW**  | ✅ |
| 6 | 📄 Text Summarizer   | **NEW**  | ✅ |
| 7 | 🖼️ Image Summarizer  | **NEW**  | ✅ |
| 8 | 🔍 Code Checker      | **NEW**  | ✅ |
| 9 | 🧑 Text Humanizer    | **NEW**  | ✅ |
| 10| ✏️ Grammar Fixer     | **NEW**  | ✅ |

---

## 🔁 AI Fallback Chain

```
User Request
     ↓
1. Groq (fastest — LLaMA 3.3)       ← tries first
     ↓ fails (429/503/500)
2. Gemini (3 models + key rotation)  ← tries second
     ↓ fails
3. OpenRouter (4 free models)        ← tries third
     ↓ fails
4. Cloudflare Workers AI             ← tries fourth
     ↓ fails
5. HuggingFace Inference API         ← final failsafe
     ↓ all fail
❌ Clear error message shown to user
```

**Circuit Breaker:** Failed providers are disabled for 60 seconds.  
**Backoff:** 800ms delay before switching providers.

---

## 🔐 API Key Setup

### Option A — Developer Keys (.env)
```env
VITE_GEMINI_KEYS=AIzaSy...,AIzaSy...  # comma-separated for rotation
VITE_GROQ_KEY=gsk_...
VITE_OPENROUTER_KEY=sk-or-...
```

### Option B — User Keys (Settings Page)
Users can enter their own keys in ⚙️ Settings.  
**Priority:** User key > Developer key.

---

## 🖥️ Backend Setup (When Ready)

```bash
cd server
cp .env.example .env
# Fill in your keys in .env
npm install
npm run dev     # starts on localhost:5000
```

Install MongoDB integration when activating full MERN:
```bash
npm install mongoose bcryptjs
```

---

## ✅ Tasks Completed

| Task | Description |
|------|-------------|
| Task 1 | Frontend UI — Login, Register, Dashboard, Add Task |
| Task 2 | Search, Filter, Sort tasks |
| Task 3 | Delete, Mark Complete, Completed styling |
| Task 4 | Better UI/UX, validation, duplicate prevention, filter tabs |
| Task 5 | Multi-AI fallback, 10 tools, voice input, modular architecture |
