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

export const STORAGE_ERROR = 'chordbook:storage-error';

// 저장 실패(용량 초과, 사생활 보호 모드 등)는 화면에 알릴 수 있게 이벤트로 내보낸다
export function save(key: string, value: unknown) {
  try {
    localStorage.setItem(PREFIX + key, JSON.stringify(value));
    return true;
  } catch (err) {
    window.dispatchEvent(new CustomEvent(STORAGE_ERROR, { detail: { key, err } }));
    return false;
  }
}

export function useStorageError() {
  const [failed, setFailed] = useState(false);
  useEffect(() => {
    const on = () => setFailed(true);
    window.addEventListener(STORAGE_ERROR, on);
    return () => window.removeEventListener(STORAGE_ERROR, on);
  }, []);
  return [failed, () => setFailed(false)] as const;
}

// localStorage에 자동 저장되는 useState
export function usePersistent<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => load(key, fallback));
  useEffect(() => {
    save(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}
