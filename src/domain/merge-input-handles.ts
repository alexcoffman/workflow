import { HANDLE_IDS } from './constants';

const LEGACY_MERGE_HANDLE = HANDLE_IDS.mergeInput;

export const createMergeInputHandle = (index: number): string => {
  const safeIndex = Number.isInteger(index) && index > 0 ? index : 1;
  return `${HANDLE_IDS.mergeInputPrefix}${safeIndex}`;
};

export const parseMergeInputHandleIndex = (handle: string | null): number | null => {
  if (handle === LEGACY_MERGE_HANDLE) {
    return 1;
  }

  if (!handle) {
    return null;
  }

  if (!handle.startsWith(HANDLE_IDS.mergeInputPrefix)) {
    return null;
  }

  const rawIndex = handle.slice(HANDLE_IDS.mergeInputPrefix.length);
  const parsed = Number(rawIndex);

  if (!Number.isInteger(parsed) || parsed < 1) {
    return null;
  }

  return parsed;
};

export const isMergeInputHandle = (handle: string | null): boolean => parseMergeInputHandleIndex(handle) !== null;
