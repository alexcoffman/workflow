import { create } from 'zustand';

import { DEFAULT_MODELS } from '../domain/constants';
import type { TelegramBotConfig } from '../domain/telegram';
import { fetchUserSettings, saveUserSettings } from '../lib/server-user-settings';
import { readAuthSession, readTelegramBots, writeTelegramBots } from '../lib/storage';

interface SettingsState {
  apiKey: string;
  models: string[];
  telegramBots: TelegramBotConfig[];
  settingsLoading: boolean;
  hydrateFromServer: (userId: string) => Promise<void>;
  saveApiSettings: (apiKey: string, models: string[]) => Promise<{ ok: boolean; message: string }>;
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

export const useSettingsStore = create<SettingsState>((set) => ({
  apiKey: '',
  models: [...DEFAULT_MODELS],
  telegramBots: [],
  settingsLoading: false,
  hydrateFromServer: async (userId) => {
    set({ settingsLoading: true });
    try {
      const settings = await fetchUserSettings(userId);
      set({
        apiKey: settings.apiKey,
        models: settings.models.length > 0 ? settings.models : [...DEFAULT_MODELS],
        telegramBots: readTelegramBots(),
        settingsLoading: false
      });
    } catch {
      set({
        apiKey: '',
        models: [...DEFAULT_MODELS],
        telegramBots: readTelegramBots(),
        settingsLoading: false
      });
    }
  },
  saveApiSettings: async (apiKey, models) => {
    const session = readAuthSession();
    if (!session) {
      return { ok: false, message: 'Сессия пользователя не найдена.' };
    }

    const normalizedModels = normalizeModels(models);

    set({ settingsLoading: true });
    try {
      const saved = await saveUserSettings(session.userId, {
        apiKey: apiKey.trim(),
        models: normalizedModels
      });

      set({
        apiKey: saved.apiKey,
        models: saved.models.length > 0 ? saved.models : [...DEFAULT_MODELS],
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
    const normalizedBots = bots
      .map((bot) => ({
        id: bot.id.trim(),
        name: bot.name.trim(),
        token: bot.token.trim()
      }))
      .filter((bot) => bot.id.length > 0 && bot.name.length > 0 && bot.token.length > 0)
      .filter((bot, index, arr) => arr.findIndex((item) => item.id === bot.id) === index);

    writeTelegramBots(normalizedBots);
    set({ telegramBots: normalizedBots });
  }
}));
