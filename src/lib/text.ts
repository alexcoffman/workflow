import { LIMITS } from '../domain/constants';

export const truncateWithSuffix = (value: string, maxLength = LIMITS.maxRenderedPreviewLength): string => {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, maxLength)}...[truncated]`;
};

export const toSafeTrimmed = (value: string): string => value.trim();
