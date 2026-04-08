import { create } from 'zustand';

import { DEFAULT_MODELS } from '../domain/constants';
import type { TelegramBotConfig } from '../domain/telegram';
import { clearApiKey, readApiKey, readModelList, readTelegramBots, writeApiKey, writeModelList, writeTelegramBots } from '../lib/storage';

interface SettingsState {
  apiKey: string;
  models: string[];
  telegramBots: TelegramBotConfig[];
  hydrateFromStorage: () => void;
  resetState: () => void;
  setApiKey: (apiKey: string) => void;
  clearApiKey: () => void;
  setModels: (models: string[]) => void;
  setTelegramBots: (bots: TelegramBotConfig[]) => void;
}

const normalizeModels = (models: string[]): string[] => {
  const cleaned = models
    .map((model) => model.trim())
    .filter((model) => model.length > 0)
    .filter((model, index, arr) => arr.indexOf(model) === index);

  return cleaned.length > 0 ? cleaned : [...DEFAULT_MODELS];
};

const mergeWithDefaultModels = (models: string[]): string[] => {
  const normalized = normalizeModels(models);
  const merged = [...normalized];
  for (const defaultModel of DEFAULT_MODELS) {
    if (!merged.includes(defaultModel)) {
      merged.push(defaultModel);
    }
  }
  return merged;
};

export const useSettingsStore = create<SettingsState>((set) => ({
  apiKey: '',
  models: [...DEFAULT_MODELS],
  telegramBots: [],
  hydrateFromStorage: () => {
    const storedModels = readModelList();
    const models = storedModels ? mergeWithDefaultModels(storedModels) : [...DEFAULT_MODELS];
    if (storedModels) {
      writeModelList(models);
    }

    set({
      apiKey: readApiKey(),
      models,
      telegramBots: readTelegramBots()
    });
  },
  resetState: () => {
    set({
      apiKey: '',
      models: [...DEFAULT_MODELS],
      telegramBots: []
    });
  },
  setApiKey: (apiKey) => {
    writeApiKey(apiKey);
    set({ apiKey });
  },
  clearApiKey: () => {
    clearApiKey();
    set({ apiKey: '' });
  },
  setModels: (models) => {
    const normalized = normalizeModels(models);
    writeModelList(normalized);
    set({ models: normalized });
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
