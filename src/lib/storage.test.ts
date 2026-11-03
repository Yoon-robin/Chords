import { afterEach, describe, expect, it, vi } from 'vitest';
import { save, STORAGE_ERROR } from './storage';

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

  it('성공하면 true', () => {
    const store = new Map<string, string>();
    vi.stubGlobal('window', new EventTarget());
    vi.stubGlobal('localStorage', { setItem: (k: string, v: string) => store.set(k, v) });
    expect(save('tab', 'songs')).toBe(true);
    expect(store.get('chordbook.tab')).toBe('"songs"');
  });
});
