// ════════════════════════════════════════════════════════════
//  DB — All localStorage CRUD for AI tasks
//  Functions: addTask, deleteTask, toggleComplete,
//             saveToLocalStorage, loadFromLocalStorage
//  Hardened: validation, duplicate prevention, max tasks limit
// ════════════════════════════════════════════════════════════
import type { AITask, Priority, TaskType, TaskStatus } from '../types';
import { Storage } from '../utils/storage';

const KEY = 'smai_ai_tasks';
const MAX_TASKS = 500; // prevent localStorage overflow

export const DB = {
  // loadFromLocalStorage — with safe parsing
  all(): AITask[] {
    try {
      const tasks = Storage.get<AITask[]>(KEY, []);
      // Validate array and filter out corrupt entries
      if (!Array.isArray(tasks)) return [];
      return tasks.filter(t =>
        t && typeof t === 'object' &&
        typeof t.id === 'number' &&
        typeof t.title === 'string' &&
        typeof t.prompt === 'string'
      );
    } catch {
      console.warn('[DB] Failed to parse tasks, returning empty array');
      return [];
    }
  },

  forUser(uid: number): AITask[] {
    return this.all().filter(t => t.userId === uid);
  },

  // Validation helpers
  isDuplicate(uid: number, prompt: string, excludeId?: number): boolean {
    if (!prompt?.trim()) return false;
    const norm = prompt.trim().toLowerCase();
    return this.forUser(uid).some(
      t => t.prompt.trim().toLowerCase() === norm && t.id !== excludeId
    );
  },

  // Validate task data before adding
  _validate(t: Partial<AITask>): string | null {
    if (!t.prompt?.trim()) return 'Prompt cannot be empty';
    if (!t.title?.trim()) return 'Title cannot be empty';
    if (t.prompt.trim().length < 3) return 'Prompt must be at least 3 characters';
    return null; // valid
  },

  // addTask → saveToLocalStorage (with validation)
  add(t: Omit<AITask, 'id' | 'createdAt'>): AITask {
    // Validate
    const error = this._validate(t as Partial<AITask>);
    if (error) throw new Error(`Validation: ${error}`);

    const tasks = this.all();

    // Enforce max tasks limit
    if (tasks.length >= MAX_TASKS) {
      // Remove oldest tasks beyond the limit
      const overflow = tasks.length - MAX_TASKS + 1;
      tasks.splice(tasks.length - overflow, overflow);
      console.warn(`[DB] Task limit reached (${MAX_TASKS}). Removed ${overflow} oldest tasks.`);
    }

    const newTask: AITask = {
      id:        Date.now(),
      createdAt: new Date().toISOString(),
      ...t,
      // Sanitize inputs
      title: t.title.trim().slice(0, 200),
      prompt: t.prompt.trim().slice(0, 10000),
      aiOutput: (t.aiOutput || '').slice(0, 50000),
    };

    tasks.unshift(newTask);
    Storage.set(KEY, tasks);      // saveToLocalStorage
    return newTask;
  },

  update(id: number, patch: Partial<AITask>): void {
    const tasks = this.all().map(t => t.id === id ? { ...t, ...patch } : t);
    Storage.set(KEY, tasks);
  },

  // deleteTask → saveToLocalStorage
  delete(id: number): void {
    Storage.set(KEY, this.all().filter(t => t.id !== id));
  },

  // toggleComplete → saveToLocalStorage
  toggle(id: number): TaskStatus {
    const tasks = this.all();
    const t = tasks.find(x => x.id === id);
    if (t) t.status = t.status === 'completed' ? 'pending' : 'completed';
    Storage.set(KEY, tasks);
    return t?.status ?? 'pending';
  },

  stats(uid: number) {
    const tasks = this.forUser(uid);
    const today = new Date().toISOString().slice(0, 10);
    return {
      total:     tasks.length,
      completed: tasks.filter(t => t.status === 'completed').length,
      pending:   tasks.filter(t => t.status === 'pending').length,
      today:     tasks.filter(t => t.createdAt.startsWith(today)).length
    };
  }
};
