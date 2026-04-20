import { useState, ReactNode } from 'react';
import type { Page } from '../../types';
import { useApp } from '../../context/AppContext';
import { Sidebar } from './Sidebar';
import { getAnyKeyAvailable } from '../../services/aiGateway';

const PAGE_TITLES: Partial<Record<Page, string>> = {
  dashboard:         '🏠 Dashboard',
  tools:             '🤖 AI Tools',
  tasks:             '📋 AI Tasks',
  'create-task':     '➕ Create AI Task',
  history:           '📜 History',
  quiz:              '🧠 AI Quiz',
  'tool-content':    '📝 Content Generator',
  'tool-code':       '💻 Code Assistant',
  'tool-image':      '🎨 Image Prompt Creator',
  'tool-task':       '📋 Task Manager AI',
  'tool-story':      '📖 Story Creator',
  'tool-summary':    '📄 Text Summarizer',
  'tool-imageSummary':'🖼️ Image Summarizer',
  'tool-codeCheck':  '🔍 Code Checker',
  'tool-humanize':   '🧑 Text Humanizer',
  'tool-grammar':    '✏️ Grammar Fixer'
};

export function AppShell({ children }: { children: ReactNode }) {
  const { session, page, navigate } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hasKey = getAnyKeyAvailable();

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <div className="top-bar">
          <div className="flex gap-md" style={{ alignItems:'center' }}>
            <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <span className="top-bar-title">{PAGE_TITLES[page] || 'Dashboard'}</span>
          </div>
          <div className="top-bar-right">
            {hasKey
              ? <span className="ai-badge hide-mobile">✨ AI Ready</span>
              : <span className="ai-badge hide-mobile" style={{ background:'rgba(241,107,107,0.12)', borderColor:'rgba(241,107,107,0.3)', color:'var(--danger)' }}>⚠ No API Key</span>
            }
            <span className="text-muted hide-mobile" style={{ fontSize:13 }}>
              👤 {session?.name || ''}
            </span>
            <button className="btn btn-primary btn-sm" onClick={() => navigate('create-task')}>
              + New AI Task
            </button>
          </div>
        </div>
        <div className="page-content">{children}</div>
      </div>
    </div>
  );
}
