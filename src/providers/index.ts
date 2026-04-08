import { OpenAIProvider } from './openai-provider';
import type { LlmProvider } from './types';

export const createProvider = (provider: 'openai', apiKey: string): LlmProvider => {
  if (provider === 'openai') {
    return new OpenAIProvider(apiKey);
  }

  throw new Error(`Unsupported provider: ${provider}`);
};
