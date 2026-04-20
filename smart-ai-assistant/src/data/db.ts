// ════════════════════════════════════════════════════════════
//  DB — All localStorage CRUD for AI tasks
//  Functions: addTask, deleteTask, toggleComplete,
//             saveToLocalStorage, loadFromLocalStorage
// ════════════════════════════════════════════════════════════
import type { AITask, Priority, TaskType, TaskStatus } from '../types';
import { Storage } from '../utils/storage';

const KEY = 'smai_ai_tasks';

export const DB = {
  // loadFromLocalStorage
  all():              AITask[] { return Storage.get<AITask[]>(KEY, []); },
  forUser(uid: number): AITask[] { return this.all().filter(t => t.userId === uid); },

  // Validation helpers
  isDuplicate(uid: number, prompt: string, excludeId?: number): boolean {
    const norm = prompt.trim().toLowerCase();
    return this.forUser(uid).some(
      t => t.prompt.trim().toLowerCase() === norm && t.id !== excludeId
    );
  },

  // addTask → saveToLocalStorage
  add(t: Omit<AITask, 'id' | 'createdAt'>): AITask {
    const tasks = this.all();
    const newTask: AITask = {
      id:        Date.now(),
      createdAt: new Date().toISOString(),
      ...t
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
