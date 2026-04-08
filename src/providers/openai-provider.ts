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

    const response = await this.client.responses.create(
      payload,
      {
        signal: request.signal
      }
    );

    return {
      outputText: response.output_text,
      usage: readUsage(response.usage),
      finishReason: readFinishReason(response),
      rawResponse: response
    };
  }
}
