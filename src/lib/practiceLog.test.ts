import { describe, expect, it } from 'vitest';
import { addSeconds, dayKey, lastDays, streak } from './practiceLog';

describe('연습 기록', () => {
  const day = (m: number, d: number) => new Date(2026, m - 1, d, 21, 0);

  it('날짜별로 더하고 오래된 기록은 버린다', () => {
    let log = addSeconds({}, day(11, 4), 90);
    log = addSeconds(log, day(11, 4), 30);
    expect(log['2026-11-04']).toBe(120);
    log = addSeconds({ '2026-01-01': 600, ...log }, day(11, 5), 10);
    expect(log['2026-01-01']).toBeUndefined();
    expect(Object.keys(log).sort()).toEqual(['2026-11-04', '2026-11-05']);
  });

  it('연속 일수: 오늘 안 했으면 어제부터 센다, 1분 미만은 안 친다', () => {
    const log = { '2026-11-01': 300, '2026-11-02': 70, '2026-11-03': 200, '2026-11-04': 20 };
    expect(streak(log, day(11, 4))).toBe(3);
    expect(streak({ ...log, '2026-11-04': 60 }, day(11, 4))).toBe(4);
    expect(streak(log, day(11, 6))).toBe(0);
  });

  it('최근 7일은 오래된 날부터 오늘까지', () => {
    const days = lastDays({ '2026-11-04': 5 }, day(11, 4));
    expect(days).toHaveLength(7);
    expect(dayKey(days[0].date)).toBe('2026-10-29');
    expect(days[6].secs).toBe(5);
  });
});
