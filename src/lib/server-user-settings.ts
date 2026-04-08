import type { TelegramBotConfig } from '../domain/telegram';

export interface ServerUserSettings {
  apiKey: string;
  models: string[];
  telegramBots: TelegramBotConfig[];
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

const normalizeBots = (value: unknown): TelegramBotConfig[] => {
  if (!Array.isArray(value)) {
    return [];
  }

  const bots: TelegramBotConfig[] = [];
  for (const item of value) {
    if (!item || typeof item !== 'object') {
      continue;
    }

    const candidate = item as Partial<TelegramBotConfig>;
    if (
      typeof candidate.id !== 'string' ||
      candidate.id.trim().length === 0 ||
      typeof candidate.name !== 'string' ||
      candidate.name.trim().length === 0 ||
      typeof candidate.token !== 'string' ||
      candidate.token.trim().length === 0
    ) {
      continue;
    }

    bots.push({
      id: candidate.id.trim(),
      name: candidate.name.trim(),
      token: candidate.token.trim()
    });
  }

  return bots;
};

export const fetchUserSettings = async (token: string): Promise<ServerUserSettings> => {
  const response = await fetch('/api/user-settings', {
    method: 'GET',
    headers: {
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    }
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = (await response.json()) as Partial<ServerUserSettings>;
  const models = Array.isArray(payload.models)
    ? payload.models.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  return {
    apiKey: typeof payload.apiKey === 'string' ? payload.apiKey : '',
    models,
    telegramBots: normalizeBots((payload as Record<string, unknown>).telegramBots)
  };
};

export const saveUserSettings = async (
  token: string,
  settings: ServerUserSettings
): Promise<ServerUserSettings> => {
  const response = await fetch('/api/user-settings', {
    method: 'PUT',
    headers: {
      'Content-Type': 'application/json',
      Accept: 'application/json',
      Authorization: `Bearer ${token}`
    },
    body: JSON.stringify({
      apiKey: settings.apiKey,
      models: settings.models,
      telegramBots: settings.telegramBots
    })
  });

  if (!response.ok) {
    throw new Error(await readErrorMessage(response));
  }

  const payload = (await response.json()) as Partial<ServerUserSettings>;
  const models = Array.isArray(payload.models)
    ? payload.models.filter((item): item is string => typeof item === 'string' && item.trim().length > 0)
    : [];

  return {
    apiKey: typeof payload.apiKey === 'string' ? payload.apiKey : '',
    models,
    telegramBots: normalizeBots((payload as Record<string, unknown>).telegramBots)
  };
};
