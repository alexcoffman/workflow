import { STORAGE_KEYS } from '../domain/constants';
import type { FlowSchema } from '../domain/schema';
import type { TelegramBotConfig, TelegramPollingOffsets } from '../domain/telegram';
import { createId } from './id';

const hasWindow = (): boolean => typeof window !== 'undefined';

export const getLocalString = (key: string): string | null => {
  if (!hasWindow()) {
    return null;
  }
  return window.localStorage.getItem(key);
};

export const setLocalString = (key: string, value: string): void => {
  if (!hasWindow()) {
    return;
  }
  window.localStorage.setItem(key, value);
};

export const removeLocalValue = (key: string): void => {
  if (!hasWindow()) {
    return;
  }
  window.localStorage.removeItem(key);
};

export const readApiKey = (): string => getLocalString(STORAGE_KEYS.OPENAI_API_KEY) ?? '';

export const writeApiKey = (apiKey: string): void => {
  setLocalString(STORAGE_KEYS.OPENAI_API_KEY, apiKey);
};

export const clearApiKey = (): void => {
  removeLocalValue(STORAGE_KEYS.OPENAI_API_KEY);
};

export const readModelList = (): string[] | null => {
  const raw = getLocalString(STORAGE_KEYS.OPENAI_MODEL_LIST);
  if (!raw) {
    return null;
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return null;
    }
    return parsed.filter((item): item is string => typeof item === 'string' && item.trim().length > 0);
  } catch {
    return null;
  }
};

export const writeModelList = (models: string[]): void => {
  setLocalString(STORAGE_KEYS.OPENAI_MODEL_LIST, JSON.stringify(models));
};

const normalizeTelegramBot = (value: unknown): TelegramBotConfig | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  const candidate = value as Partial<TelegramBotConfig>;
  if (
    typeof candidate.id !== 'string' ||
    candidate.id.trim().length === 0 ||
    typeof candidate.name !== 'string' ||
    candidate.name.trim().length === 0 ||
    typeof candidate.token !== 'string' ||
    candidate.token.trim().length === 0
  ) {
    return null;
  }

  return {
    id: candidate.id.trim(),
    name: candidate.name.trim(),
    token: candidate.token.trim()
  };
};

export const readTelegramBots = (): TelegramBotConfig[] => {
  const raw = getLocalString(STORAGE_KEYS.TELEGRAM_BOTS);
  if (!raw) {
    return [];
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const bots: TelegramBotConfig[] = [];
    for (const item of parsed) {
      const normalized = normalizeTelegramBot(item);
      if (!normalized) {
        continue;
      }

      if (bots.some((bot) => bot.id === normalized.id)) {
        continue;
      }

      bots.push(normalized);
    }

    return bots;
  } catch {
    return [];
  }
};

export const writeTelegramBots = (bots: TelegramBotConfig[]): void => {
  const normalizedBots = bots
    .map((item) => normalizeTelegramBot(item))
    .filter((item): item is TelegramBotConfig => item !== null);

  setLocalString(STORAGE_KEYS.TELEGRAM_BOTS, JSON.stringify(normalizedBots));
};

export const readTelegramPollingOffsets = (): TelegramPollingOffsets => {
  const raw = getLocalString(STORAGE_KEYS.TELEGRAM_OFFSETS);
  if (!raw) {
    return {};
  }

  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!parsed || typeof parsed !== 'object') {
      return {};
    }

    const offsets: TelegramPollingOffsets = {};
    for (const [key, value] of Object.entries(parsed as Record<string, unknown>)) {
      if (typeof key !== 'string' || key.trim().length === 0) {
        continue;
      }

      if (typeof value !== 'number' || !Number.isFinite(value)) {
        continue;
      }

      offsets[key.trim()] = Math.floor(value);
    }

    return offsets;
  } catch {
    return {};
  }
};

export const writeTelegramPollingOffsets = (offsets: TelegramPollingOffsets): void => {
  const normalized: TelegramPollingOffsets = {};

  for (const [botId, offset] of Object.entries(offsets)) {
    if (botId.trim().length === 0) {
      continue;
    }

    if (typeof offset !== 'number' || !Number.isFinite(offset)) {
      continue;
    }

    normalized[botId.trim()] = Math.floor(offset);
  }

  setLocalString(STORAGE_KEYS.TELEGRAM_OFFSETS, JSON.stringify(normalized));
};

export const readSchemaDraft = (): string | null => getLocalString(STORAGE_KEYS.ACTIVE_SCHEMA);

export const writeSchemaDraft = (schema: FlowSchema): void => {
  setLocalString(STORAGE_KEYS.ACTIVE_SCHEMA, JSON.stringify(schema));
};

export interface SavedSchemaRecord {
  id: string;
  name: string;
  schemaJson: string;
  savedAt: number;
}

export interface PromptLibraryRecord {
  id: string;
  name: string;
  promptText: string;
  createdAt: number;
  updatedAt: number;
}

const parseSavedSchemas = (raw: string): SavedSchemaRecord[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const records: SavedSchemaRecord[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const candidate = item as Partial<SavedSchemaRecord>;
      if (
        typeof candidate.id !== 'string' ||
        candidate.id.trim().length === 0 ||
        typeof candidate.name !== 'string' ||
        candidate.name.trim().length === 0 ||
        typeof candidate.schemaJson !== 'string' ||
        candidate.schemaJson.trim().length === 0 ||
        typeof candidate.savedAt !== 'number' ||
        !Number.isFinite(candidate.savedAt)
      ) {
        continue;
      }

      records.push({
        id: candidate.id,
        name: candidate.name.trim(),
        schemaJson: candidate.schemaJson,
        savedAt: candidate.savedAt
      });
    }

    return records;
  } catch {
    return [];
  }
};

const writeSavedSchemas = (records: SavedSchemaRecord[]): void => {
  setLocalString(STORAGE_KEYS.SAVED_SCHEMAS, JSON.stringify(records));
};

export const readSavedSchemas = (): SavedSchemaRecord[] => {
  const raw = getLocalString(STORAGE_KEYS.SAVED_SCHEMAS);
  if (!raw) {
    return [];
  }

  const records = parseSavedSchemas(raw);
  return [...records].sort((a, b) => {
    if (a.savedAt !== b.savedAt) {
      return b.savedAt - a.savedAt;
    }
    return a.name.localeCompare(b.name);
  });
};

export const saveNamedSchema = (name: string, schema: FlowSchema): SavedSchemaRecord => {
  const trimmedName = name.trim();
  if (!trimmedName) {
    throw new Error('Название схемы не может быть пустым.');
  }

  const schemaJson = JSON.stringify(schema);
  const savedAt = Date.now();
  const records = readSavedSchemas();
  const normalizedName = trimmedName.toLocaleLowerCase();
  const existingIndex = records.findIndex((item) => item.name.toLocaleLowerCase() === normalizedName);

  if (existingIndex >= 0) {
    const updated: SavedSchemaRecord = {
      ...records[existingIndex],
      name: trimmedName,
      schemaJson,
      savedAt
    };

    const nextRecords = [...records];
    nextRecords[existingIndex] = updated;
    writeSavedSchemas(nextRecords);
    return updated;
  }

  const nextRecord: SavedSchemaRecord = {
    id: createId(),
    name: trimmedName,
    schemaJson,
    savedAt
  };

  writeSavedSchemas([nextRecord, ...records]);
  return nextRecord;
};

export const removeSavedSchema = (recordId: string): void => {
  const trimmedId = recordId.trim();
  if (!trimmedId) {
    return;
  }

  const records = readSavedSchemas();
  const nextRecords = records.filter((record) => record.id !== trimmedId);
  writeSavedSchemas(nextRecords);
};

const parsePromptLibrary = (raw: string): PromptLibraryRecord[] => {
  try {
    const parsed = JSON.parse(raw) as unknown;
    if (!Array.isArray(parsed)) {
      return [];
    }

    const records: PromptLibraryRecord[] = [];
    for (const item of parsed) {
      if (!item || typeof item !== 'object') {
        continue;
      }

      const candidate = item as Partial<PromptLibraryRecord>;
      if (
        typeof candidate.id !== 'string' ||
        candidate.id.trim().length === 0 ||
        typeof candidate.name !== 'string' ||
        candidate.name.trim().length === 0 ||
        typeof candidate.promptText !== 'string' ||
        candidate.promptText.trim().length === 0 ||
        typeof candidate.createdAt !== 'number' ||
        !Number.isFinite(candidate.createdAt) ||
        typeof candidate.updatedAt !== 'number' ||
        !Number.isFinite(candidate.updatedAt)
      ) {
        continue;
      }

      records.push({
        id: candidate.id,
        name: candidate.name.trim(),
        promptText: candidate.promptText,
        createdAt: candidate.createdAt,
        updatedAt: candidate.updatedAt
      });
    }

    return records;
  } catch {
    return [];
  }
};

const writePromptLibrary = (records: PromptLibraryRecord[]): void => {
  setLocalString(STORAGE_KEYS.PROMPT_LIBRARY, JSON.stringify(records));
};

export const readPromptLibrary = (): PromptLibraryRecord[] => {
  const raw = getLocalString(STORAGE_KEYS.PROMPT_LIBRARY);
  if (!raw) {
    return [];
  }

  const records = parsePromptLibrary(raw);
  return [...records].sort((a, b) => {
    if (a.updatedAt !== b.updatedAt) {
      return b.updatedAt - a.updatedAt;
    }
    return a.name.localeCompare(b.name);
  });
};

export const createPromptLibraryRecord = (name: string, promptText: string): PromptLibraryRecord => {
  const trimmedName = name.trim();
  const normalizedPromptText = promptText.trim();

  if (!trimmedName) {
    throw new Error('Название промпта не может быть пустым.');
  }

  if (!normalizedPromptText) {
    throw new Error('Текст промпта не может быть пустым.');
  }

  const now = Date.now();
  const nextRecord: PromptLibraryRecord = {
    id: createId(),
    name: trimmedName,
    promptText: normalizedPromptText,
    createdAt: now,
    updatedAt: now
  };

  const records = readPromptLibrary();
  writePromptLibrary([nextRecord, ...records]);
  return nextRecord;
};

export const removePromptLibraryRecord = (recordId: string): void => {
  const trimmedId = recordId.trim();
  if (!trimmedId) {
    return;
  }

  const records = readPromptLibrary();
  const nextRecords = records.filter((record) => record.id !== trimmedId);
  writePromptLibrary(nextRecords);
};
