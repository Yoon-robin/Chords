import { describe, expect, it } from 'vitest';
import { matchTuning } from './tunings';

describe('악보 메모에서 튜닝 찾기', () => {
  const id = (t: string) => matchTuning(t)?.id ?? null;

  it('이름으로 적힌 튜닝', () => {
    expect(id('튜닝: Drop D')).toBe('drop-d');
    expect(id('Tuning: drop D tuning')).toBe('drop-d');
    expect(id('Open D tuning')).toBe('open-d');
    expect(id('DADGAD tuning')).toBe('dadgad');
    expect(id('튜닝: 반음 내림')).toBe('half-down');
    expect(id('Half step down')).toBe('half-down');
    expect(id('Whole Step Down')).toBe('whole-down');
  });

  it('여섯 줄 음이름으로 적힌 튜닝', () => {
    expect(id('튜닝: Eb Ab Db Gb Bb Eb')).toBe('half-down');
    expect(id('Tuning: D A D G B E')).toBe('drop-d');
    expect(id('튜닝: D G D G B D')).toBe('open-g');
    expect(id('E♭ A♭ D♭ G♭ B♭ E♭')).toBe('half-down');
  });

  it('표준 튜닝이나 튜닝이 아닌 메모는 무시', () => {
    expect(id('튜닝: E A D G B E')).toBeNull();
    expect(id('x2 반복')).toBeNull();
    expect(id('Down strokes only, gently')).toBeNull();
  });
});
