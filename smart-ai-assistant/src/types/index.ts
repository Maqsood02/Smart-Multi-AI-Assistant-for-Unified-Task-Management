export type TaskType =
  | 'content' | 'code' | 'image' | 'task'
  | 'story' | 'summary' | 'imageSummary'
  | 'codeCheck' | 'humanize' | 'grammar'
  | 'analysis' | 'general';

export type Priority   = 'high' | 'medium' | 'low' | '';
export type TaskStatus = 'pending' | 'completed';

export type Page =
  | 'login' | 'register' | 'dashboard' | 'tools'
  | 'tasks' | 'create-task' | 'history'
  | 'tool-content' | 'tool-code' | 'tool-image' | 'tool-task'
  | 'tool-story' | 'tool-summary' | 'tool-imageSummary'
  | 'tool-codeCheck' | 'tool-humanize' | 'tool-grammar'
  | 'quiz';

export interface User    { id: number; name: string; email: string; password: string; }
export interface Session { id: number; name: string; email: string; }

export interface AITask {
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
  provider?: string;
}

export interface ToolConfig {
  id:          TaskType;
  page:        Page;
  icon:        string;
  name:        string;
  shortName:   string;
  description: string;
  inputLabel:  string;
  inputPlaceholder: string;
  outputLabel: string;
  color:       string;
  category:    'existing' | 'new';
  handler:     'text' | 'image';
}

export interface GenerationStatus {
  message:   string;
  provider?: string;
  attempt?:  number;
}
