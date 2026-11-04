import { useEffect, useSyncExternalStore } from 'react';
import { load, save } from './storage';

// 날짜(현지 YYYY-MM-DD) → 그날 연습한 초. 메트로놈·코드 진행·곡 반주를 켜 둔 시간을 모은다.
export type PracticeLog = Record<string, number>;

const KEEP_DAYS = 90;

export const dayKey = (d: Date) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;

const addDays = (d: Date, n: number) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);

export function addSeconds(log: PracticeLog, today: Date, secs: number): PracticeLog {
  const k = dayKey(today);
  const oldest = dayKey(addDays(today, -KEEP_DAYS));
  const next: PracticeLog = { [k]: (log[k] ?? 0) + secs };
  for (const [d, s] of Object.entries(log)) if (d !== k && d >= oldest) next[d] = s;
  return next;
}

// 오늘(아직 안 했으면 어제)부터 거꾸로 이어서 1분 이상 연습한 날 수
export function streak(log: PracticeLog, today: Date) {
  const did = (d: Date) => (log[dayKey(d)] ?? 0) >= 60;
  let d = did(today) ? today : addDays(today, -1);
  let n = 0;
  while (did(d)) {
    n++;
    d = addDays(d, -1);
  }
  return n;
}

// 최근 n일 (오래된 날 → 오늘)
export function lastDays(log: PracticeLog, today: Date, n = 7) {
  return Array.from({ length: n }, (_, i) => {
    const d = addDays(today, i - n + 1);
    return { date: d, secs: log[dayKey(d)] ?? 0 };
  });
}

let log = load<PracticeLog>('practice.log', {});
const listeners = new Set<() => void>();

function record(secs: number) {
  if (secs < 1) return;
  log = addSeconds(log, new Date(), Math.round(secs));
  save('practice.log', log);
  listeners.forEach((l) => l());
}

export function usePracticeLog() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => log,
  );
}

// active인 동안 흐른 시간을 기록한다 (30초마다, 그리고 멈출 때)
export function usePracticeTimer(active: boolean) {
  useEffect(() => {
    if (!active) return;
    let last = performance.now();
    const flush = () => {
      const t = performance.now();
      record((t - last) / 1000);
      last = t;
    };
    const id = setInterval(flush, 30_000);
    return () => {
      clearInterval(id);
      flush();
    };
  }, [active]);
}
