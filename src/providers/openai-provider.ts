import OpenAI from 'openai';

import type { LlmGenerateRequest, LlmGenerateResponse, LlmProvider } from './types';

const readUsage = (usage: OpenAI.Responses.ResponseUsage | null | undefined) => ({
  inputTokens: usage?.input_tokens ?? null,
  outputTokens: usage?.output_tokens ?? null,
  totalTokens: usage?.total_tokens ?? null
});

const readFinishReason = (response: OpenAI.Responses.Response): string | null => {
  if (response.incomplete_details?.reason) {
    return response.incomplete_details.reason;
  }

  if (typeof response.status === 'string') {
    return response.status;
  }

  return null;
};

const asRecord = (value: unknown): Record<string, unknown> | null => {
  if (!value || typeof value !== 'object') {
    return null;
  }

  return value as Record<string, unknown>;
};

const readStringField = (record: Record<string, unknown> | null, field: string): string | null => {
  if (!record) {
    return null;
  }

  const value = record[field];
  return typeof value === 'string' && value.trim().length > 0 ? value.trim() : null;
};

const readNumberField = (record: Record<string, unknown> | null, field: string): number | null => {
  if (!record) {
    return null;
  }

  const value = record[field];
  return typeof value === 'number' && Number.isFinite(value) ? value : null;
};

const formatOpenAiError = (error: unknown): string => {
  const root = asRecord(error);
  const nestedError = asRecord(root?.error);

  const status = readNumberField(root, 'status');
  const code = readStringField(root, 'code') ?? readStringField(nestedError, 'code');
  const type = readStringField(root, 'type') ?? readStringField(nestedError, 'type');
  const message =
    readStringField(nestedError, 'message') ??
    readStringField(root, 'message') ??
    (error instanceof Error ? error.message : null) ??
    'Неизвестная ошибка OpenAI API.';

  const parts: string[] = ['Ошибка OpenAI API'];
  if (status !== null) {
    parts.push(`HTTP ${status}`);
  }
  if (code) {
    parts.push(`code=${code}`);
  }
  if (type) {
    parts.push(`type=${type}`);
  }

  return `${parts.join(' | ')}: ${message}`;
};

export class OpenAIProvider implements LlmProvider {
  public readonly id = 'openai';

  private readonly client: OpenAI;

  constructor(apiKey: string) {
    this.client = new OpenAI({
      apiKey,
      dangerouslyAllowBrowser: true
    });
  }

  async generateText(request: LlmGenerateRequest): Promise<LlmGenerateResponse> {
    const payload: OpenAI.Responses.ResponseCreateParams = {
      model: request.model,
      input: request.input,
      instructions: request.instructions,
      max_output_tokens: request.maxOutputTokens
    };

    if (typeof request.temperature === 'number') {
      payload.temperature = request.temperature;
    }

    try {
      const response = await this.client.responses.create(payload, {
        signal: request.signal
      });

      return {
        outputText: response.output_text,
        usage: readUsage(response.usage),
        finishReason: readFinishReason(response),
        rawResponse: response
      };
    } catch (error) {
      throw new Error(formatOpenAiError(error));
    }
  }
}
