import { useState } from 'react';
import { Button, Card, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { Check, Flame, Volume2, X } from 'lucide-react';
import { resolveChord } from '../../components/ChordCard';
import { ChordDiagram } from '../../components/ChordDiagram';
import { ensureAudio, strum } from '../../lib/audio';
import { usePersistent } from '../../lib/storage';
import { pretty } from '../../lib/theory';
import { OPEN_CHORDS } from './ChangeTrainer';

// 다이어그램을 보고, 또는 소리만 듣고 코드 이름 맞히기
type QuizMode = 'shape' | 'ear';
type Question = { answer: string; options: string[] };

function pick<T>(arr: T[]) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function newQuestion(prev?: string): Question {
  const pool = OPEN_CHORDS.filter((c) => c !== prev && resolveChord(c));
  const answer = pick(pool);
  const others = OPEN_CHORDS.filter((c) => c !== answer).sort(() => Math.random() - 0.5).slice(0, 3);
  return { answer, options: [answer, ...others].sort(() => Math.random() - 0.5) };
}

export function ChordQuiz() {
  const [mode, setMode] = usePersistent<QuizMode>('quiz.mode', 'shape');
  const [bestStreak, setBestStreak] = usePersistent<Record<QuizMode, number>>('quiz.best', { shape: 0, ear: 0 });
  const [q, setQ] = useState(() => newQuestion());
  const [chosen, setChosen] = useState<string | null>(null);
  const [streak, setStreak] = useState(0);
  const [score, setScore] = useState({ right: 0, total: 0 });

  const r = resolveChord(q.answer);
  const play = () => r && strum(r.voicing.frets);

  const next = (m = mode) => {
    const nq = newQuestion(q.answer);
    setQ(nq);
    setChosen(null);
    if (m === 'ear') {
      ensureAudio();
      const nr = resolveChord(nq.answer);
      if (nr) strum(nr.voicing.frets);
    }
  };

  const answer = (c: string) => {
    if (chosen) return;
    setChosen(c);
    const ok = c === q.answer;
    setScore((s) => ({ right: s.right + Number(ok), total: s.total + 1 }));
    const n = ok ? streak + 1 : 0;
    setStreak(n);
    if (n > (bestStreak[mode] ?? 0)) setBestStreak((b) => ({ ...b, [mode]: n }));
    if (mode === 'shape') play();
  };

  const switchMode = (m: QuizMode) => {
    setMode(m);
    setStreak(0);
    setScore({ right: 0, total: 0 });
    next(m);
  };

  return (
    <Card>
      <Card.Header>
        <Card.Title>코드 퀴즈</Card.Title>
        <Card.Description>모양을 보고, 또는 소리만 듣고 어떤 코드인지 맞혀 보세요</Card.Description>
      </Card.Header>
      <Card.Content className="flex flex-col gap-4">
        <ToggleButtonGroup
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[mode]}
          onSelectionChange={(k) => switchMode([...k][0] as QuizMode)}
          size="sm"
          aria-label="퀴즈 종류"
        >
          <ToggleButton id="shape">모양 보고</ToggleButton>
          <ToggleButton id="ear">
            <ToggleButtonGroup.Separator />
            소리 듣고
          </ToggleButton>
        </ToggleButtonGroup>

        <div className="flex min-h-44 items-center justify-center rounded-2xl border border-border bg-surface-secondary p-3">
          {mode === 'shape' || chosen ? (
            r && <ChordDiagram voicing={r.voicing} tones={r.tones} labels="none" title="문제" className="w-full max-w-[140px]" />
          ) : (
            <Button
              size="lg"
              variant="tertiary"
              onPress={() => {
                ensureAudio();
                play();
              }}
            >
              <Volume2 className="size-5" />
              소리 듣기
            </Button>
          )}
        </div>

        <div className="grid grid-cols-2 gap-2">
          {q.options.map((c) => {
            const isAnswer = c === q.answer;
            const state = !chosen ? 'idle' : isAnswer ? 'right' : c === chosen ? 'wrong' : 'dim';
            return (
              <button
                key={c}
                type="button"
                onClick={() => answer(c)}
                aria-disabled={!!chosen}
                className={`flex items-center justify-center gap-1.5 rounded-xl border py-3 text-lg font-bold transition ${
                  state === 'right'
                    ? 'border-success bg-success/15 text-success'
                    : state === 'wrong'
                      ? 'border-danger bg-danger/10 text-danger'
                      : state === 'dim'
                        ? 'border-border bg-surface opacity-50'
                        : 'border-border bg-surface hover:border-accent'
                }`}
              >
                {state === 'right' && <Check className="size-4" />}
                {state === 'wrong' && <X className="size-4" />}
                {pretty(c)}
              </button>
            );
          })}
        </div>

        <div className="flex flex-wrap items-center gap-3">
          <span className="text-sm font-semibold tabular-nums">
            {score.right}/{score.total} 정답
          </span>
          <span className="flex items-center gap-1 text-sm text-muted">
            <Flame className="size-4" />
            연속 {streak} · 최고 {bestStreak[mode] ?? 0}
          </span>
          <div className="flex-1" />
          {chosen && mode === 'ear' && (
            <Button variant="tertiary" size="sm" onPress={play}>
              <Volume2 className="size-4" />
              다시
            </Button>
          )}
          <Button size="sm" variant={chosen ? 'primary' : 'secondary'} onPress={() => next()}>
            {chosen ? '다음 문제' : '건너뛰기'}
          </Button>
        </div>

        {chosen && (
          <p role="status" className="sr-only">
            {chosen === q.answer ? '정답' : `오답, 정답은 ${pretty(q.answer)}`}
          </p>
        )}
      </Card.Content>
    </Card>
  );
}
