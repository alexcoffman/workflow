export const DEFAULT_OPENAI_MODEL = 'gpt-4.1-mini';

export const CHATGPT_TEXT_MODELS = [
  'gpt-5.2-chat-latest',
  'gpt-5.1-chat-latest',
  'gpt-5-chat-latest',
  'chatgpt-4o-latest'
] as const;

export const OPENAI_TEXT_MODELS = [
  'gpt-5.2',
  'gpt-5.2-pro',
  'gpt-5.1',
  'gpt-5',
  'gpt-5-pro',
  'gpt-5-mini',
  'gpt-5-nano',
  'gpt-4.1',
  'gpt-4.1-mini',
  'gpt-4.1-nano',
  'gpt-4o',
  'gpt-4o-mini',
  'gpt-4-turbo',
  'gpt-4'
] as const;

export const DEFAULT_MODELS = [...CHATGPT_TEXT_MODELS, ...OPENAI_TEXT_MODELS];

export const STORAGE_KEYS = {
  OPENAI_API_KEY: 'app.openai.apiKey',
  OPENAI_MODEL_LIST: 'app.openai.models',
  TELEGRAM_BOTS: 'app.telegram.bots',
  TELEGRAM_OFFSETS: 'app.telegram.offsets',
  ACTIVE_SCHEMA: 'app.schema.active',
  SAVED_SCHEMAS: 'app.schema.saved',
  PROMPT_LIBRARY: 'app.prompts.library'
} as const;

export const LIMITS = {
  requestTimeoutMs: 60_000,
  retryCount: 1,
  maxLogEventsInMemory: 1000,
  maxNodes: 100,
  maxEdges: 300,
  maxTextLengthPerTextNode: 20_000,
  maxRenderedPreviewLength: 1000,
  maxRawResponsePreviewLength: 1000,
  autosaveDebounceMs: 500
} as const;

export const HANDLE_IDS = {
  defaultInput: 'input',
  defaultOutput: 'output',
  mergeInput: 'merge-input',
  mergeInputPrefix: 'merge-input-',
  decisionOutputYes: 'decision-yes',
  decisionOutputNo: 'decision-no',
  decisionOutputOther: 'decision-other',
  counterOutputIntermediate: 'counter-intermediate',
  counterOutputFinal: 'counter-final'
} as const;
