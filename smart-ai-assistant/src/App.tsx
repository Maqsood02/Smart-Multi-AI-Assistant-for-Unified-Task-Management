// ════════════════════════════════════════════════════════════
//  APP — Thin router. All logic is in pages/ and services/
// ════════════════════════════════════════════════════════════
import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';
import { ToastContainer, useToasts } from './components/common/Toast';

// Auth Pages
import { LoginPage }    from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';

// App Pages
import { Dashboard }       from './pages/Dashboard';
import { TasksPage }       from './pages/TasksPage';
import { CreateTaskPage }  from './pages/CreateTaskPage';
import { AIToolsPage }     from './pages/AIToolsPage';
import { HistoryPage }     from './pages/HistoryPage';
import { SettingsPage }    from './pages/SettingsPage';

// 10 Tool Pages
import {
  ContentGeneratorPage, CodeAssistantPage, ImageCreatorPage, TaskManagerAIPage,
  StoryCreatorPage, TextSummarizerPage, ImageSummarizerPage,
  CodeCheckerPage, TextHumanizerPage, GrammarFixerPage
} from './pages/tools/AllTools';

function Router() {
  const { page } = useApp();
  const { toasts, toast } = useToasts();

  // Auth-only pages (no sidebar)
  if (page === 'login')    return <><LoginPage    /><ToastContainer toasts={toasts}/></>;
  if (page === 'register') return <><RegisterPage /><ToastContainer toasts={toasts}/></>;

  // Protected pages (with sidebar via AppShell)
  return (
    <>
      <AppShell>
        {page === 'dashboard'        && <Dashboard/>}
        {page === 'tools'            && <AIToolsPage/>}
        {page === 'tasks'            && <TasksPage/>}
        {page === 'create-task'      && <CreateTaskPage/>}
        {page === 'history'          && <HistoryPage/>}
        {page === 'settings'         && <SettingsPage/>}

        {/* ── 10 AI Tool Pages ── */}
        {page === 'tool-content'     && <ContentGeneratorPage/>}
        {page === 'tool-code'        && <CodeAssistantPage/>}
        {page === 'tool-image'       && <ImageCreatorPage/>}
        {page === 'tool-task'        && <TaskManagerAIPage/>}
        {page === 'tool-story'       && <StoryCreatorPage/>}
        {page === 'tool-summary'     && <TextSummarizerPage/>}
        {page === 'tool-imageSummary'&& <ImageSummarizerPage/>}
        {page === 'tool-codeCheck'   && <CodeCheckerPage/>}
        {page === 'tool-humanize'    && <TextHumanizerPage/>}
        {page === 'tool-grammar'     && <GrammarFixerPage/>}
      </AppShell>
      <ToastContainer toasts={toasts}/>
    </>
  );
}

export default function App() {
  return (
    <AppProvider>
      <Router/>
    </AppProvider>
  );
}
