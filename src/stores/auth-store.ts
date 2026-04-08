import { create } from 'zustand';

import { hashPassword } from '../lib/auth-crypto';
import {
  changePasswordByServer,
  loginByServer,
  logoutByServer,
  registerByServer,
  validateSessionByServer
} from '../lib/server-auth';
import { clearAuthSession, readAuthSession, writeAuthSession, type AuthSessionRecord } from '../lib/storage';

interface AuthState {
  initialized: boolean;
  session: AuthSessionRecord | null;
  bootstrap: () => Promise<void>;
  register: (login: string, password: string) => Promise<{ ok: boolean; message: string }>;
  signIn: (login: string, password: string) => Promise<{ ok: boolean; message: string }>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<{ ok: boolean; message: string }>;
  signOut: () => Promise<void>;
}

const validateCredentials = (login: string, password: string): { ok: boolean; message: string } => {
  if (login.trim().length < 3) {
    return { ok: false, message: 'Логин должен быть не короче 3 символов.' };
  }

  if (password.length < 6) {
    return { ok: false, message: 'Пароль должен быть не короче 6 символов.' };
  }

  return { ok: true, message: '' };
};

export const useAuthStore = create<AuthState>((set, get) => ({
  initialized: false,
  session: null,
  bootstrap: async () => {
    const saved = readAuthSession();
    if (!saved) {
      set({ initialized: true, session: null });
      return;
    }

    const validated = await validateSessionByServer(saved.token);
    if (!validated) {
      clearAuthSession();
      set({ initialized: true, session: null });
      return;
    }

    writeAuthSession(validated);
    set({ initialized: true, session: validated });
  },
  register: async (login, password) => {
    const validation = validateCredentials(login, password);
    if (!validation.ok) {
      return validation;
    }

    try {
      const passwordHash = await hashPassword(password);
      const session = await registerByServer(login.trim(), passwordHash);
      writeAuthSession(session);
      set({ session });
      return { ok: true, message: 'Регистрация успешна.' };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Не удалось зарегистрироваться.'
      };
    }
  },
  signIn: async (login, password) => {
    const validation = validateCredentials(login, password);
    if (!validation.ok) {
      return validation;
    }

    try {
      const passwordHash = await hashPassword(password);
      const session = await loginByServer(login.trim(), passwordHash);
      writeAuthSession(session);
      set({ session });
      return { ok: true, message: 'Вход выполнен.' };
    } catch (error) {
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Не удалось выполнить вход.'
      };
    }
  },
  changePassword: async (currentPassword, nextPassword) => {
    const session = get().session;
    if (!session) {
      return { ok: false, message: 'Сессия не найдена.' };
    }

    if (nextPassword.length < 6) {
      return { ok: false, message: 'Новый пароль должен быть не короче 6 символов.' };
    }

    const currentHash = await hashPassword(currentPassword);
    const nextHash = await hashPassword(nextPassword);
    return changePasswordByServer(session.token, currentHash, nextHash);
  },
  signOut: async () => {
    const session = get().session;
    if (session) {
      await logoutByServer(session.token);
    }

    clearAuthSession();
    set({ session: null });
  }
}));
