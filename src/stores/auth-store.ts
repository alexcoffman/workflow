import { create } from 'zustand';

import { hashPassword } from '../lib/auth-crypto';
import {
  changeAuthUserPassword,
  clearAuthSession,
  createAuthSession,
  createAuthUser,
  findAuthUserByLogin,
  readAuthSession,
  type AuthSessionRecord
} from '../lib/storage';

interface AuthState {
  initialized: boolean;
  session: AuthSessionRecord | null;
  bootstrap: () => void;
  register: (login: string, password: string) => Promise<{ ok: boolean; message: string }>;
  signIn: (login: string, password: string) => Promise<{ ok: boolean; message: string }>;
  changePassword: (currentPassword: string, nextPassword: string) => Promise<{ ok: boolean; message: string }>;
  signOut: () => void;
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
  bootstrap: () => {
    set({
      initialized: true,
      session: readAuthSession()
    });
  },
  register: async (login, password) => {
    const validation = validateCredentials(login, password);
    if (!validation.ok) {
      return validation;
    }

    const existing = findAuthUserByLogin(login);
    if (existing) {
      return { ok: false, message: 'Пользователь с таким логином уже существует.' };
    }

    const passwordHash = await hashPassword(password);
    const user = createAuthUser(login, passwordHash);
    const session = createAuthSession(user);
    set({ session });
    return { ok: true, message: 'Регистрация успешна.' };
  },
  signIn: async (login, password) => {
    const validation = validateCredentials(login, password);
    if (!validation.ok) {
      return validation;
    }

    const user = findAuthUserByLogin(login);
    if (!user) {
      return { ok: false, message: 'Пользователь не найден.' };
    }

    const passwordHash = await hashPassword(password);
    if (user.passwordHash !== passwordHash) {
      return { ok: false, message: 'Неверный пароль.' };
    }

    const session = createAuthSession(user);
    set({ session });
    return { ok: true, message: 'Вход выполнен.' };
  },
  changePassword: async (currentPassword, nextPassword) => {
    const session = get().session;
    if (!session) {
      return { ok: false, message: 'Сессия не найдена.' };
    }

    if (nextPassword.length < 6) {
      return { ok: false, message: 'Новый пароль должен быть не короче 6 символов.' };
    }

    const user = findAuthUserByLogin(session.login);
    if (!user) {
      return { ok: false, message: 'Пользователь не найден.' };
    }

    const currentHash = await hashPassword(currentPassword);
    if (user.passwordHash !== currentHash) {
      return { ok: false, message: 'Текущий пароль указан неверно.' };
    }

    const nextHash = await hashPassword(nextPassword);
    changeAuthUserPassword(user.id, nextHash);
    return { ok: true, message: 'Пароль обновлен.' };
  },
  signOut: () => {
    clearAuthSession();
    set({ session: null });
  }
}));
