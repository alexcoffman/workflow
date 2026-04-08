export interface AuthApiSession {
  token: string;
  userId: string;
  login: string;
  signedInAt: number;
}

const readErrorMessage = async (response: Response): Promise<string> => {
  try {
    const payload = (await response.json()) as { error?: string };
    if (typeof payload.error === 'string' && payload.error.trim().length > 0) {
      return payload.error;
    }
  } catch {
    // noop
  }

  return `HTTP ${response.status}`;
};

const parseSession = (value: unknown): AuthApiSession | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<AuthApiSession>;
  if (
    typeof candidate.token !== 'string' ||
    candidate.token.trim().length === 0 ||
    typeof candidate.userId !== 'string' ||
    candidate.userId.trim().length === 0 ||
    typeof candidate.login !== 'string' ||
    candidate.login.trim().length === 0 ||
    typeof candidate.signedInAt !== 'number' ||
    !Number.isFinite(candidate.signedInAt)
  ) {
    return null;
  }

  return {
    token: candidate.token.trim(),
    userId: candidate.userId.trim(),
    login: candidate.login.trim(),
    signedInAt: candidate.signedInAt
  };
};

export const registerByServer = async (login: string, passwordHash: string): Promise<AuthApiSession> => {
  const response = await fetch('/api/auth/register', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ login, passwordHash })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = (await response.json()) as { session?: unknown };
  const session = parseSession(payload.session);
  if (!session) {
    throw new Error('Некорректный ответ сервера авторизации.');
  }

  return session;
};

export const loginByServer = async (login: string, passwordHash: string): Promise<AuthApiSession> => {
  const response = await fetch('/api/auth/login', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ login, passwordHash })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = (await response.json()) as { session?: unknown };
  const session = parseSession(payload.session);
  if (!session) {
    throw new Error('Некорректный ответ сервера авторизации.');
  }

  return session;
};

export const validateSessionByServer = async (token: string): Promise<AuthApiSession | null> => {
  const response = await fetch(`/api/auth/session?token=${encodeURIComponent(token)}`, {
    method: 'GET',
    headers: {
      Accept: 'application/json'
    }
  });

  if (!response.ok) {
    return null;
  }

  const payload = (await response.json()) as { session?: unknown };
  return parseSession(payload.session);
};

export const changePasswordByServer = async (
  token: string,
  currentPasswordHash: string,
  nextPasswordHash: string
): Promise<{ ok: boolean; message: string }> => {
  const response = await fetch('/api/auth/change-password', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ token, currentPasswordHash, nextPasswordHash })
  });

  if (!response.ok) {
    return { ok: false, message: await readErrorMessage(response) };
  }

  return { ok: true, message: 'Пароль обновлен.' };
};

export const logoutByServer = async (token: string): Promise<void> => {
  await fetch('/api/auth/logout', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json'
    },
    body: JSON.stringify({ token })
  });
};
