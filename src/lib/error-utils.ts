export const getErrorMessage = (error: unknown): string => {
  if (error instanceof Error) {
    return error.message;
  }
  return 'Неизвестная ошибка';
};

export const isAbortError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }
  return error.name === 'AbortError' || error.message.toLowerCase().includes('aborted');
};

export const isTransientNetworkError = (error: unknown): boolean => {
  if (!(error instanceof Error)) {
    return false;
  }

  const message = error.message.toLowerCase();
  return (
    message.includes('network') ||
    message.includes('timeout') ||
    message.includes('fetch') ||
    message.includes('temporar') ||
    message.includes('503') ||
    message.includes('502') ||
    message.includes('429')
  );
};
