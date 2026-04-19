// ════════════════════════════════════════════════════════════
//  APP SHELL — Top bar + sidebar wrapper
// ════════════════════════════════════════════════════════════
import { useState, ReactNode } from 'react';
import type { Page } from '../../types';
import { useApp } from '../../context/AppContext';
import { Sidebar } from './Sidebar';
import { getAnyKeyAvailable, getAvailableProviders } from '../../services/aiGateway';

const PAGE_TITLES: Partial<Record<Page, string>> = {
  dashboard: '🏠 Dashboard',
  tools: '🤖 AI Tools',
  tasks: '📋 AI Tasks',
  'create-task': '➕ Create AI Task',
  history: '📜 History',
  settings: '⚙️ Settings',
  'tool-content': '📝 Content Generator',
  'tool-code': '💻 Code Assistant',
  'tool-image': '🎨 Image Creator',
  'tool-task': '📋 Task Manager AI',
  'tool-story': '📖 Story Creator',
  'tool-summary': '📄 Text Summarizer',
  'tool-imageSummary': '🖼️ Image Summarizer',
  'tool-codeCheck': '🔍 Code Checker',
  'tool-humanize': '🧑 Text Humanizer',
  'tool-grammar': '✏️ Grammar Fixer'
};

export function AppShell({ children }: { children: ReactNode }) {
  const { session, page, navigate } = useApp();
  const [sidebarOpen, setSidebarOpen] = useState(false);
  const hasKey = getAnyKeyAvailable();
  const availableProviders = getAvailableProviders();

  return (
    <div className="app-layout">
      <Sidebar open={sidebarOpen} onClose={() => setSidebarOpen(false)} />
      <div className="main-content">
        <div className="top-bar">
          <div className="flex gap-md" style={{ alignItems: 'center' }}>
            <button className="menu-btn" onClick={() => setSidebarOpen(o => !o)}>☰</button>
            <span className="top-bar-title">{PAGE_TITLES[page] || 'Dashboard'}</span>
          </div>
          <div className="top-bar-right">
            {hasKey ? (
              <div className="przovider-status-indicator hide-mobile" style={{ display: 'flex', gap: 6, alignItems: 'center' }} title="Active AI Providers">
                <span className="ai-badge">✨ {availableProviders.length} Providers Ready</span>
              </div>
            ) : (
              <span className="ai-badge hide-mobile"
                style={{ background: 'rgba(239,68,68,0.1)', borderColor: 'rgba(239,68,68,0.3)', color: '#f87171', cursor: 'pointer' }}
                onClick={() => navigate('settings')}>⚠ Add API Key</span>
            )}
            <span className="text-muted hide-mobile" style={{ fontSize: 13 }}>
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
