import { create } from 'zustand';

import { DEFAULT_MODELS } from '../domain/constants';
import type { TelegramBotConfig } from '../domain/telegram';
import { fetchUserSettings, saveUserSettings } from '../lib/server-user-settings';
import { readAuthSession } from '../lib/storage';

interface SettingsState {
  apiKey: string;
  models: string[];
  telegramBots: TelegramBotConfig[];
  settingsLoading: boolean;
  hydrateFromServer: (token: string) => Promise<void>;
  saveApiSettings: (
    apiKey: string,
    models: string[],
    telegramBots: TelegramBotConfig[]
  ) => Promise<{ ok: boolean; message: string }>;
  resetState: () => void;
  setTelegramBots: (bots: TelegramBotConfig[]) => void;
}

const normalizeModels = (models: string[]): string[] => {
  const cleaned = models
    .map((model) => model.trim())
    .filter((model) => model.length > 0)
    .filter((model, index, arr) => arr.indexOf(model) === index);

  return cleaned.length > 0 ? cleaned : [...DEFAULT_MODELS];
};

const normalizeBots = (bots: TelegramBotConfig[]): TelegramBotConfig[] => {
  return bots
    .map((bot) => ({
      id: bot.id.trim(),
      name: bot.name.trim(),
      token: bot.token.trim()
    }))
    .filter((bot) => bot.id.length > 0 && bot.name.length > 0 && bot.token.length > 0)
    .filter((bot, index, arr) => arr.findIndex((item) => item.id === bot.id) === index);
};

export const useSettingsStore = create<SettingsState>((set) => ({
  apiKey: '',
  models: [...DEFAULT_MODELS],
  telegramBots: [],
  settingsLoading: false,
  hydrateFromServer: async (token) => {
    set({ settingsLoading: true });
    try {
      const settings = await fetchUserSettings(token);
      set({
        apiKey: settings.apiKey,
        models: settings.models.length > 0 ? settings.models : [...DEFAULT_MODELS],
        telegramBots: normalizeBots(settings.telegramBots),
        settingsLoading: false
      });
    } catch {
      set({
        apiKey: '',
        models: [...DEFAULT_MODELS],
        telegramBots: [],
        settingsLoading: false
      });
    }
  },
  saveApiSettings: async (apiKey, models, telegramBots) => {
    const session = readAuthSession();
    if (!session) {
      return { ok: false, message: 'Сессия пользователя не найдена.' };
    }

    set({ settingsLoading: true });
    try {
      const saved = await saveUserSettings(session.token, {
        apiKey: apiKey.trim(),
        models: normalizeModels(models),
        telegramBots: normalizeBots(telegramBots)
      });

      set({
        apiKey: saved.apiKey,
        models: saved.models.length > 0 ? saved.models : [...DEFAULT_MODELS],
        telegramBots: normalizeBots(saved.telegramBots),
        settingsLoading: false
      });

      return { ok: true, message: 'Настройки сохранены на сервере.' };
    } catch (error) {
      set({ settingsLoading: false });
      return {
        ok: false,
        message: error instanceof Error ? error.message : 'Не удалось сохранить настройки на сервере.'
      };
    }
  },
  resetState: () => {
    set({
      apiKey: '',
      models: [...DEFAULT_MODELS],
      telegramBots: [],
      settingsLoading: false
    });
  },
  setTelegramBots: (bots) => {
    set({ telegramBots: normalizeBots(bots) });
  }
}));
