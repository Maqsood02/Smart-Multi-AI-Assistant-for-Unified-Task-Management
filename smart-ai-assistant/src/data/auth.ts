// ════════════════════════════════════════════════════════════
//  AUTH — User registration, login, session management
// ════════════════════════════════════════════════════════════
import type { User, Session } from '../types';
import { Storage } from '../utils/storage';

export const Auth = {
  getUsers():  User[]  { return Storage.get<User[]>('smai_users', []); },
  saveUsers(u: User[]) { Storage.set('smai_users', u); },

  register(name: string, email: string, password: string): { ok: boolean; msg?: string } {
    const users = this.getUsers();
    if (users.some(u => u.email === email)) return { ok: false, msg: 'Email already registered.' };
    users.push({ id: Date.now(), name, email, password });
    this.saveUsers(users);
    return { ok: true };
  },

  login(email: string, password: string): { ok: boolean; user?: Session; msg?: string } {
    const user = this.getUsers().find(u => u.email === email && u.password === password);
    if (!user) return { ok: false, msg: 'Invalid email or password.' };
    const session: Session = { id: user.id, name: user.name, email: user.email };
    Storage.set('smai_session', session);
    return { ok: true, user: session };
  },

  logout()    { Storage.remove('smai_session'); },
  current():   Session | null { return Storage.get<Session | null>('smai_session', null); },
  isLoggedIn():boolean        { return !!this.current(); },

  seedDemo() {
    if (this.getUsers().length === 0) {
      this.register('Demo User', 'demo@smartai.com', 'demo123');
    }
  }
};
