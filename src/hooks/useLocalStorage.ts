import { useCallback, useEffect, useState } from 'react';

/** Merge stored settings over defaults so newly added fields always exist. */
function mergeDefaults<T>(initial: T, stored: unknown): T {
  if (Array.isArray(initial)) return (Array.isArray(stored) ? stored : initial) as T;
  if (initial && typeof initial === 'object') {
    if (!stored || typeof stored !== 'object') return initial;
    const result: Record<string, unknown> = { ...(initial as Record<string, unknown>) };
    for (const key of Object.keys(initial as Record<string, unknown>)) {
      result[key] = mergeDefaults(
        (initial as Record<string, unknown>)[key],
        (stored as Record<string, unknown>)[key],
      );
    }
    return result as T;
  }
  return (stored === undefined || stored === null ? initial : stored) as T;
}

export function useLocalStorage<T>(key: string, initial: T) {
  const [value, setValue] = useState<T>(() => {
    try {
      const raw = localStorage.getItem(key);
      if (!raw) return initial;
      return mergeDefaults(initial, JSON.parse(raw));
    } catch {
      return initial;
    }
  });

  useEffect(() => {
    try {
      localStorage.setItem(key, JSON.stringify(value));
    } catch {
      /* storage may be unavailable */
    }
  }, [key, value]);

  const reset = useCallback(() => setValue(initial), [initial]);
  return [value, setValue, reset] as const;
}

export function useNow(intervalMs = 1000): Date {
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = window.setInterval(() => setNow(new Date()), intervalMs);
    return () => window.clearInterval(id);
  }, [intervalMs]);
  return now;
}
