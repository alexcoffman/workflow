export interface LlmGenerateRequest {
  model: string;
  input: string;
  instructions?: string;
  temperature?: number;
  maxOutputTokens: number;
  signal: AbortSignal;
}

export interface LlmGenerateResponse {
  outputText: string;
  usage: {
    inputTokens: number | null;
    outputTokens: number | null;
    totalTokens: number | null;
  };
  finishReason: string | null;
  rawResponse: unknown;
}

export interface LlmProvider {
  id: string;
  generateText(request: LlmGenerateRequest): Promise<LlmGenerateResponse>;
}
