import { describe, expect, it } from 'vitest';
import {
  arpString,
  chordTones,
  fretsToMidi,
  mod12,
  parseSongChord,
  slashVoicings,
  transposeChord,
  TUNING,
  voicings,
} from './theory';

const lowest = (frets: (number | null)[]) => Math.min(...fretsToMidi(frets).filter((m): m is number => m != null));

describe('parseSongChord', () => {
  it('6/9는 분수 코드가 아니라 코드 종류로 읽는다', () => {
    const c = parseSongChord('C6/9')!;
    expect(c).not.toBeNull();
    expect(c.bass).toBeUndefined();
    expect(c.rest).toBe('6/9');
    expect(c.qid).toBe('6');
  });

  it('분수 코드의 베이스를 읽는다', () => {
    const c = parseSongChord('G/B')!;
    expect(c.pc).toBe(7);
    expect(c.bass).toEqual({ name: 'B', pc: 11 });
  });

  it('6/9 위에 베이스가 또 있어도 읽는다', () => {
    const c = parseSongChord('C6/9/E')!;
    expect(c.rest).toBe('6/9');
    expect(c.bass?.pc).toBe(4);
  });
});

describe('조옮김', () => {
  it('mod12는 음수도 0~11로 돌려준다', () => {
    expect(mod12(-1)).toBe(11);
    expect(mod12(-121)).toBe(11);
    expect(mod12(25)).toBe(1);
  });

  it('아주 많이 내려도 코드 이름이 깨지지 않는다', () => {
    const c = parseSongChord('G/B')!;
    expect(transposeChord(c, -2)).toBe('F/A');
    expect(transposeChord(c, -134)).toBe('F/A');
  });
});

describe('분수 코드 보이싱', () => {
  it.each([
    ['G', 7, '', 11], // G/B
    ['C', 0, '', 7], // C/G
    ['D', 2, '', 6], // D/F#
    ['Am', 9, 'm', 7], // Am/G
    ['C', 0, '', 11], // C/B (코드 밖 베이스)
  ])('%s 위 베이스 %i: 가장 낮은 음이 베이스다', (_name, pc, qid, bass) => {
    const vs = slashVoicings(pc, qid, bass);
    expect(vs.length).toBeGreaterThan(0);
    for (const v of vs) expect(mod12(lowest(v.frets))).toBe(bass);
  });

  it('분수 코드 보이싱도 코드 구성음을 모두 갖는다', () => {
    const [v] = slashVoicings(7, '', 11);
    const pcs = new Set(fretsToMidi(v.frets).filter((m): m is number => m != null).map(mod12));
    for (const t of chordTones('G', '')) expect(pcs.has(t.pc)).toBe(true);
  });
});

describe('fretsToMidi', () => {
  it('카포만큼 실제 음을 올린다', () => {
    const [g] = voicings(7, '');
    const open = fretsToMidi(g.frets);
    const capo2 = fretsToMidi(g.frets, 2);
    open.forEach((m, i) => expect(capo2[i]).toBe(m == null ? null : m + 2));
  });
});

describe('아르페지오 줄 순서', () => {
  it.each([
    ['D', 'xx0232'],
    ['C', 'x32010'],
    ['G', '320003'],
  ])('%s 코드에서 뮤트된 줄을 고르지 않는다', (_n, code) => {
    const frets = [...code].map((ch) => (ch === 'x' ? null : Number(ch)));
    for (let step = 0; step < 8; step++) {
      const s = arpString(frets, step);
      expect(s).not.toBeNull();
      expect(frets[s!]).not.toBeNull();
    }
    expect(arpString(frets, 0)).toBe(frets.findIndex((f) => f != null));
  });

  it('TUNING은 6번줄부터', () => {
    expect(TUNING[0]).toBe(40);
  });
});
