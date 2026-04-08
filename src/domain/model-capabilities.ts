const normalizeModel = (model: string): string => model.trim().toLowerCase();

const TEMPERATURE_SUPPORTED_EXACT_MODELS = new Set<string>([
  'gpt-5.1',
  'gpt-5.1-chat-latest'
]);

export const supportsTemperatureParameter = (model: string): boolean => {
  const normalized = normalizeModel(model);
  if (!normalized) {
    return true;
  }

  // GPT-5.x family has mixed parameter compatibility.
  // In this app we do not expose reasoning_effort, so we disable temperature
  // for GPT-5 models except the explicit gpt-5.1 variants.
  if (normalized.startsWith('gpt-5')) {
    return TEMPERATURE_SUPPORTED_EXACT_MODELS.has(normalized);
  }

  return true;
};
