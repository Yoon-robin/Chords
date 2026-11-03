import { afterEach, describe, expect, it, vi } from 'vitest';
import { exportBackup, importBackup, load, save, STORAGE_ERROR } from './storage';

afterEach(() => vi.unstubAllGlobals());

describe('save', () => {
  it('저장에 실패하면 알림 이벤트를 보낸다', () => {
    const target = new EventTarget();
    vi.stubGlobal('window', target);
    vi.stubGlobal('localStorage', {
      setItem: () => {
        throw new DOMException('full', 'QuotaExceededError');
      },
    });
    const seen: string[] = [];
    target.addEventListener(STORAGE_ERROR, (e) => seen.push((e as CustomEvent).detail.key));
    expect(save('songs.mine', [1, 2, 3])).toBe(false);
    expect(seen).toEqual(['songs.mine']);
  });

  it('백업을 내보내고 다시 가져오면 내 노래가 id 기준으로 합쳐진다', () => {
    const store = new Map<string, string>();
    const ls = {
      get length() {
        return store.size;
      },
      key: (i: number) => [...store.keys()][i] ?? null,
      getItem: (k: string) => store.get(k) ?? null,
      setItem: (k: string, v: string) => void store.set(k, v),
    };
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('localStorage', ls);
    save('songs.mine', [{ id: 'a', title: '옛 제목' }]);
    save('tab', 'songs');
    const backup = exportBackup();
    expect(backup.data).toEqual({ 'songs.mine': [{ id: 'a', title: '옛 제목' }], tab: 'songs' });

    save('songs.mine', [{ id: 'a', title: '옛 제목' }, { id: 'b', title: '이 기기에만' }]);
    const incoming = { ...backup, data: { 'songs.mine': [{ id: 'a', title: '새 제목' }], tab: 'tuner' } };
    expect(importBackup(JSON.stringify(incoming))).toBe(1);
    expect(load('songs.mine', [])).toEqual([
      { id: 'a', title: '새 제목' },
      { id: 'b', title: '이 기기에만' },
    ]);
    expect(load('tab', '')).toBe('tuner');
    expect(() => importBackup('{"app":"other"}')).toThrow();
  });

  it('성공하면 true', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('localStorage', { setItem: (k: string, v: string) => store.set(k, v) });
    expect(save('tab', 'songs')).toBe(true);
    expect(store.get('chordbook.tab')).toBe('"songs"');
  });
});
