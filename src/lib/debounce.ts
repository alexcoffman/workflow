import { useEffect, useRef } from 'react';

export const useDebouncedEffect = (
  callback: () => void,
  delayMs: number,
  deps: readonly unknown[]
): void => {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  useEffect(() => {
    const timer = window.setTimeout(() => {
      callbackRef.current();
    }, delayMs);

    return () => {
      window.clearTimeout(timer);
    };
  }, deps);
};
