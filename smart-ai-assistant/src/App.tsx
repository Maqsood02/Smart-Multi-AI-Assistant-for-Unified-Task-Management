import { AppProvider, useApp } from './context/AppContext';
import { AppShell } from './components/layout/AppShell';

import { LoginPage }    from './pages/LoginPage';
import { RegisterPage } from './pages/RegisterPage';
import { Dashboard }    from './pages/Dashboard';
import { TasksPage }    from './pages/TasksPage';
import { CreateTaskPage } from './pages/CreateTaskPage';
import { AIToolsPage }  from './pages/AIToolsPage';
import { HistoryPage }  from './pages/HistoryPage';
import { QuizPage }     from './pages/QuizPage';

import {
  ContentGeneratorPage, CodeAssistantPage, ImageCreatorPage, TaskManagerAIPage,
  StoryCreatorPage, TextSummarizerPage, ImageSummarizerPage,
  CodeCheckerPage, TextHumanizerPage, GrammarFixerPage
} from './pages/tools/AllTools';

function Router() {
  const { page, tick } = useApp();

  if (page === 'login')    return <LoginPage/>;
  if (page === 'register') return <RegisterPage/>;

  return (
    <AppShell>
      {page === 'dashboard'         && <Dashboard         key={tick} />}
      {page === 'tools'             && <AIToolsPage />}
      {page === 'tasks'             && <TasksPage         key={tick} />}
      {page === 'create-task'       && <CreateTaskPage />}
      {page === 'history'           && <HistoryPage       key={tick} />}
      {page === 'quiz'              && <QuizPage />}

      {page === 'tool-content'      && <ContentGeneratorPage />}
      {page === 'tool-code'         && <CodeAssistantPage />}
      {page === 'tool-image'        && <ImageCreatorPage />}
      {page === 'tool-task'         && <TaskManagerAIPage />}
      {page === 'tool-story'        && <StoryCreatorPage />}
      {page === 'tool-summary'      && <TextSummarizerPage />}
      {page === 'tool-imageSummary' && <ImageSummarizerPage />}
      {page === 'tool-codeCheck'    && <CodeCheckerPage />}
      {page === 'tool-humanize'     && <TextHumanizerPage />}
      {page === 'tool-grammar'      && <GrammarFixerPage />}
    </AppShell>
  );
}

export default function App() {
  return <AppProvider><Router/></AppProvider>;
}
