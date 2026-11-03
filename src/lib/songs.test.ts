import { describe, expect, it } from 'vitest';
import { importText, parseBody } from './songs';
import { buildTimeline, METERS, slotAt, stepSeconds } from './timeline';

describe('타임라인', () => {
  it('N.C. 마디를 빼지 않고 쉬는 칸으로 둔다', () => {
    const tl = buildTimeline(parseBody('| G | N.C. | C |'));
    expect(tl.map((b) => b.slots)).toEqual([['G'], [null], ['C']]);
  });

  it('% 마디는 앞 마디를 반복한다', () => {
    const tl = buildTimeline(parseBody('| G D | % | C |'));
    expect(tl[1].slots).toEqual(['G', 'D']);
  });

  it('/ 는 앞 코드를 한 칸 더 끈다', () => {
    const tl = buildTimeline(parseBody('| G / / D |'));
    expect(tl[0].slots).toEqual(['G', 'G', 'G', 'D']);
  });

  it('줄이 바뀌어도 마디 위치(줄·마디 번호)를 기억한다', () => {
    const tl = buildTimeline(parseBody('# Verse\n| G | C |\n\n| D | Em |'));
    expect(tl.map((b) => [b.line, b.bar])).toEqual([
      [1, 0],
      [1, 1],
      [3, 0],
      [3, 1],
    ]);
  });

  it('마디 안 코드 두 개는 반씩 나눈다 (3/4 포함)', () => {
    const [bar] = buildTimeline(parseBody('| G D |'));
    const { steps } = METERS['3/4'];
    const chords = Array.from({ length: steps }, (_, e) => slotAt(bar, e, steps).chord);
    expect(chords).toEqual(['G', 'G', 'G', 'D', 'D', 'D']);
  });

  it('박자표마다 칸 길이가 다르다', () => {
    expect(stepSeconds(60, '4/4')).toBeCloseTo(0.5);
    expect(stepSeconds(60, '3/4')).toBeCloseTo(0.5);
    expect(stepSeconds(60, '6/8')).toBeCloseTo(1 / 3);
    expect(METERS['3/4'].steps).toBe(6);
  });
});

describe('붙여넣기 변환', () => {
  it('코드 줄 아래 "A" 한 글자 가사를 코드로 착각하지 않는다', () => {
    const r = importText('G        C\nA');
    // 마디 줄(| A |)이 아니라 가사 한 줄로 합쳐져야 한다
    expect(r.body).toBe('[G]A        [C]');
    expect(parseBody(r.body)[0].kind).toBe('lyric');
  });

  it('머리말의 카포·키·템포·박자를 읽는다', () => {
    const r = importText('Capo: 2nd fret\nKey: Am\nTempo: 96\nTime: 6/8\n\nAm  C\nhello there');
    expect(r).toMatchObject({ capo: 2, key: 'Am', bpm: 96, time: '6/8' });
    expect(r.body).not.toMatch(/Capo|Key|Tempo|Time/);
  });

  it('C6/9 코드 줄을 인식한다', () => {
    const r = importText('C6/9  G/B\nsome words here');
    expect(r.body).toContain('[C6/9]');
    expect(r.body).toContain('[G/B]');
  });
});
