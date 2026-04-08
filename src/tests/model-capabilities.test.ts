import { describe, expect, it } from 'vitest';

import { supportsTemperatureParameter } from '../domain/model-capabilities';

describe('model capabilities', () => {
  it('disables temperature for GPT-5.2 and older GPT-5 models', () => {
    expect(supportsTemperatureParameter('gpt-5.2')).toBe(false);
    expect(supportsTemperatureParameter('gpt-5.2-pro')).toBe(false);
    expect(supportsTemperatureParameter('gpt-5')).toBe(false);
    expect(supportsTemperatureParameter('gpt-5-pro')).toBe(false);
    expect(supportsTemperatureParameter('gpt-5-mini')).toBe(false);
    expect(supportsTemperatureParameter('gpt-5-nano')).toBe(false);
    expect(supportsTemperatureParameter('gpt-5-chat-latest')).toBe(false);
    expect(supportsTemperatureParameter('gpt-5.2-chat-latest')).toBe(false);
  });

  it('keeps temperature for gpt-5.1 and gpt-4.x families', () => {
    expect(supportsTemperatureParameter('gpt-5.1')).toBe(true);
    expect(supportsTemperatureParameter('gpt-5.1-chat-latest')).toBe(true);
    expect(supportsTemperatureParameter('gpt-4.1-mini')).toBe(true);
    expect(supportsTemperatureParameter('gpt-4o')).toBe(true);
    expect(supportsTemperatureParameter('chatgpt-4o-latest')).toBe(true);
  });
});
