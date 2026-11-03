import { useEffect, useRef, useState } from 'react';
import { Button, Card } from '@heroui/react';
import { RotateCcw, Timer, Trophy } from 'lucide-react';
import { MiniChord } from '../../components/ChordCard';
import { click, ensureAudio, now } from '../../lib/audio';
import { usePersistent } from '../../lib/storage';
import { pretty } from '../../lib/theory';

// 1분 동안 두 코드를 몇 번 바꿔 잡는지 세는 연습 (기록은 코드 쌍마다 저장)
const OPEN_CHORDS = ['C', 'D', 'E', 'G', 'A', 'Am', 'Em', 'Dm', 'F', 'A7', 'D7', 'E7', 'G7', 'B7', 'Cmaj7', 'Fmaj7', 'Asus2', 'Dsus4'];
const DURATION = 60;

function ChordPicker({ value, onChange, other }: { value: string; onChange: (c: string) => void; other: string }) {
  return (
    <div className="no-scrollbar -mx-1 flex gap-1.5 overflow-x-auto px-1">
      {OPEN_CHORDS.map((c) => (
        <button
          key={c}
          type="button"
          disabled={c === other}
          onClick={() => onChange(c)}
          className={`shrink-0 rounded-lg border px-2.5 py-1 text-sm font-semibold transition disabled:opacity-30 ${
            c === value ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface hover:border-accent'
          }`}
        >
          {pretty(c)}
        </button>
      ))}
    </div>
  );
}

export function ChangeTrainer() {
  const [a, setA] = usePersistent('changes.a', 'C');
  const [b, setB] = usePersistent('changes.b', 'G');
  const [best, setBest] = usePersistent<Record<string, number>>('changes.best', {});
  const [endsAt, setEndsAt] = useState<number | null>(null);
  const [left, setLeft] = useState(DURATION);
  const [count, setCount] = useState(0);
  const [result, setResult] = useState<{ count: number; record: boolean } | null>(null);
  const countRef = useRef(0);
  countRef.current = count;

  const pair = [a, b].sort().join('-');
  const running = endsAt != null;

  useEffect(() => {
    if (endsAt == null) return;
    const id = window.setInterval(() => {
      const s = Math.max(0, Math.ceil((endsAt - performance.now()) / 1000));
      setLeft(s);
      if (s === 0) {
        window.clearInterval(id);
        setEndsAt(null);
        click(now() + 0.01, true);
        const n = countRef.current;
        const record = n > (best[pair] ?? 0);
        if (record) setBest((m) => ({ ...m, [pair]: n }));
        setResult({ count: n, record });
      }
    }, 200);
    return () => window.clearInterval(id);
  }, [endsAt, best, pair, setBest]);

  const start = () => {
    ensureAudio(); // 끝날 때 알림음을 낼 수 있게 사용자 동작 시점에 오디오를 깨워 둔다
    setCount(0);
    setResult(null);
    setLeft(DURATION);
    setEndsAt(performance.now() + DURATION * 1000);
  };
  const stop = () => {
    setEndsAt(null);
    setLeft(DURATION);
  };
  const tap = () => {
    if (running) setCount((n) => n + 1);
  };

  // 연습 중에는 스페이스·엔터로도 셀 수 있다 (손이 기타에 있을 때 발로 누르는 페달 키보드 등)
  useEffect(() => {
    if (!running) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== ' ' && e.key !== 'Enter') return;
      e.preventDefault();
      setCount((n) => n + 1);
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [running]);

  return (
    <Card>
      <Card.Header>
        <Card.Title>1분 코드 체인지</Card.Title>
        <Card.Description>두 코드를 번갈아 잡고, 바꿀 때마다 아래 큰 버튼을 누르세요. 매일 기록을 넘겨 보세요.</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        {!running && (
          <div className="flex flex-col gap-2">
            <ChordPicker value={a} onChange={setA} other={b} />
            <ChordPicker value={b} onChange={setB} other={a} />
          </div>
        )}

        <div className="grid grid-cols-2 gap-3">
          <MiniChord name={a} className="w-full" />
          <MiniChord name={b} className="w-full" />
        </div>

        <button
          type="button"
          onClick={tap}
          disabled={!running}
          className={`flex flex-col items-center rounded-2xl border-2 py-6 transition select-none ${
            running ? 'border-accent bg-accent/15 active:scale-[0.98]' : 'border-dashed border-border text-muted'
          }`}
        >
          <span className="text-6xl font-black tabular-nums">{running ? count : (result?.count ?? 0)}</span>
          <span className="text-sm font-semibold">{running ? '바꿀 때마다 누르기' : '번 바꿈'}</span>
        </button>

        <div className="flex flex-wrap items-center gap-3">
          <span className="flex items-center gap-1 text-lg font-bold tabular-nums">
            <Timer className="size-5 text-muted" />
            {left}초
          </span>
          <span className="flex items-center gap-1 text-sm text-muted">
            <Trophy className="size-4" />
            최고 {best[pair] ?? 0}번
          </span>
          <div className="flex-1" />
          {running ? (
            <Button variant="secondary" onPress={stop}>
              <RotateCcw className="size-4" />
              그만
            </Button>
          ) : (
            <Button onPress={start}>
              <Timer className="size-4" />
              1분 시작
            </Button>
          )}
        </div>

        {result && (
          <p role="status" className={`rounded-xl p-3 text-sm ${result.record ? 'bg-success/10 text-success' : 'bg-surface-secondary'}`}>
            {result.record
              ? `새 기록! ${pretty(a)} ↔ ${pretty(b)} 1분에 ${result.count}번`
              : `${result.count}번 바꿨어요. 최고 기록은 ${best[pair] ?? 0}번이에요.`}
          </p>
        )}
      </Card.Content>
    </Card>
  );
}
