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

// ---------- 백업: 내 노래와 설정을 JSON 파일 하나로 주고받는다

export type Backup = { app: 'chordbook'; version: 1; exportedAt: string; data: Record<string, unknown> };

export function exportBackup(): Backup {
  const data: Record<string, unknown> = {};
  for (let i = 0; i < localStorage.length; i++) {
    const k = localStorage.key(i);
    if (!k?.startsWith(PREFIX)) continue;
    try {
      data[k.slice(PREFIX.length)] = JSON.parse(localStorage.getItem(k)!);
    } catch {
      /* 깨진 값은 건너뜀 */
    }
  }
  return { app: 'chordbook', version: 1, exportedAt: new Date().toISOString(), data };
}

type Song = { id: string };

// 내 노래는 id 기준으로 합치고(같은 곡은 가져온 쪽으로 교체), 나머지 설정은 덮어쓴다.
// 반환값: 가져온 곡 수
export function importBackup(text: string): number {
  const b = JSON.parse(text) as Partial<Backup>;
  if (b?.app !== 'chordbook' || typeof b.data !== 'object' || !b.data) throw new Error('코드북 백업 파일이 아니에요');
  const { 'songs.mine': songs, ...rest } = b.data as Record<string, unknown>;
  const incoming = Array.isArray(songs) ? (songs as Song[]).filter((s) => s && typeof s.id === 'string') : [];
  const current = load<Song[]>('songs.mine', []);
  const merged = [...incoming, ...current.filter((s) => !incoming.some((x) => x.id === s.id))];
  if (!save('songs.mine', merged)) throw new Error('저장 공간이 부족해 가져오지 못했어요');
  for (const [k, v] of Object.entries(rest)) save(k, v);
  return incoming.length;
}

// localStorage에 자동 저장되는 useState
export function usePersistent<T>(key: string, fallback: T) {
  const [value, setValue] = useState<T>(() => load(key, fallback));
  useEffect(() => {
    save(key, value);
  }, [key, value]);
  return [value, setValue] as const;
}
