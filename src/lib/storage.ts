import { useEffect, useState } from 'react';

const PREFIX = 'chordbook.';

export function load<T>(key: string, fallback: T): T {
  try {
    const v = localStorage.getItem(PREFIX + key);
    return v == null ? fallback : (JSON.parse(v) as T);
  } catch {
    return fallback;
  }
}

export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
  } catch {
    /* 저장할 수 없는 환경 (사생활 보호 모드 등) */
  }
}

// localStorage에 자동 저장되는 useState
export function usePersistent<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => load(key, fallback));
  useEffect(() => save(key, value), [key, value]);
  return [value, setValue] as const;
}
