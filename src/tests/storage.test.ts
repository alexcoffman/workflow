import { beforeEach, describe, expect, it } from 'vitest';

import { STORAGE_KEYS } from '../domain/constants';
import { CURRENT_SCHEMA_VERSION, type FlowSchema } from '../domain/schema';
import {
  createPromptLibraryRecord,
  readPromptLibrary,
  readSavedSchemas,
  removePromptLibraryRecord,
  removeSavedSchema,
  saveNamedSchema
} from '../lib/storage';

const makeSchema = (name: string): FlowSchema => ({
  schemaVersion: CURRENT_SCHEMA_VERSION,
  nodes: [],
  edges: [],
  metadata: {
    name,
    maxIterations: null,
    createdAt: Date.now(),
    updatedAt: Date.now()
  }
});

describe('saved schema storage', () => {
  beforeEach(() => {
    window.localStorage.removeItem(STORAGE_KEYS.SAVED_SCHEMAS);
    window.localStorage.removeItem(STORAGE_KEYS.PROMPT_LIBRARY);
  });

  it('stores saved schema records and reads them back', () => {
    saveNamedSchema('Моя схема', makeSchema('Моя схема'));

    const records = readSavedSchemas();
    expect(records).toHaveLength(1);
    expect(records[0]?.name).toBe('Моя схема');
    expect(records[0]?.schemaJson.length).toBeGreaterThan(10);
  });

  it('overwrites existing record by case-insensitive name', () => {
    const first = saveNamedSchema('Пайплайн', makeSchema('Первая'));
    const second = saveNamedSchema('пайплайн', makeSchema('Вторая'));

    const records = readSavedSchemas();
    expect(records).toHaveLength(1);
    expect(records[0]?.id).toBe(first.id);
    expect(second.id).toBe(first.id);
    expect(records[0]?.name).toBe('пайплайн');
  });

  it('deletes saved schema by id', () => {
    const first = saveNamedSchema('Схема 1', makeSchema('Схема 1'));
    saveNamedSchema('Схема 2', makeSchema('Схема 2'));

    let records = readSavedSchemas();
    expect(records).toHaveLength(2);

    removeSavedSchema(first.id);
    records = readSavedSchemas();
    expect(records).toHaveLength(1);
    expect(records.some((record) => record.id === first.id)).toBe(false);
  });

  it('stores prompt library records and deletes by id', () => {
    const first = createPromptLibraryRecord('Первый', 'Текст первого');
    createPromptLibraryRecord('Второй', 'Текст второго');

    let prompts = readPromptLibrary();
    expect(prompts).toHaveLength(2);
    expect(prompts.some((record) => record.id === first.id)).toBe(true);

    removePromptLibraryRecord(first.id);
    prompts = readPromptLibrary();
    expect(prompts).toHaveLength(1);
    expect(prompts.some((record) => record.id === first.id)).toBe(false);
  });
});
