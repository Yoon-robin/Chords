import { Flame } from 'lucide-react';
import { dayKey, lastDays, streak, usePracticeLog } from '../../lib/practiceLog';

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const minutes = (secs: number) => (secs < 60 ? (secs ? '1분 미만' : '0분') : `${Math.floor(secs / 60)}분`);

// 연습 탭 위쪽: 오늘 연습한 시간, 연속 일수, 최근 7일 막대
export function PracticeStreak() {
  const log = usePracticeLog();
  const today = new Date();
  const days = lastDays(log, today);
  const run = streak(log, today);
  const max = Math.max(600, ...days.map((d) => d.secs));
  const todaySecs = days[days.length - 1].secs;

  return (
    <div className="flex items-end gap-4 rounded-2xl border border-border bg-surface px-4 py-3">
      <div className="flex-1">
        <p className="text-xs font-semibold text-muted">오늘 연습</p>
        <p className="text-2xl font-extrabold tabular-nums">{minutes(todaySecs)}</p>
        <p className={`mt-0.5 flex items-center gap-1 text-xs font-semibold ${run ? 'text-accent' : 'text-muted'}`}>
          <Flame className="size-3.5" />
          {run ? `${run}일 연속` : '메트로놈이나 반주를 켜면 기록돼요'}
        </p>
      </div>
      <ol className="flex h-16 items-end gap-1.5" aria-label="최근 7일 연습 시간">
        {days.map(({ date, secs }) => {
          const isToday = dayKey(date) === dayKey(today);
          return (
            <li key={dayKey(date)} className="flex h-full w-5 flex-col items-center justify-end gap-1">
              <span className="sr-only">
                {date.getMonth() + 1}월 {date.getDate()}일 {minutes(secs)}
              </span>
              <span aria-hidden className="flex w-full flex-1 items-end">
                <span
                  className={`w-full rounded-md ${secs >= 60 ? (isToday ? 'bg-accent' : 'bg-accent/50') : 'bg-surface-tertiary'}`}
                  style={{ height: `${Math.max(8, (secs / max) * 100)}%` }}
                />
              </span>
              <span aria-hidden className={`text-[10px] ${isToday ? 'font-bold text-foreground' : 'text-muted'}`}>
                {WEEKDAYS[date.getDay()]}
              </span>
            </li>
          );
        })}
      </ol>
    </div>
  );
}
