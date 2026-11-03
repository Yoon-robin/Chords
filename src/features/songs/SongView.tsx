import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Chip, Slider, Label } from '@heroui/react';
import { ALargeSmall, ArrowDownToLine, Repeat, ChevronLeft, Minus, Pause, Pencil, Play, Plus, Star, Trash } from 'lucide-react';
import { MiniChord, playChordName, resolveChord } from '../../components/ChordCard';
import { click, createLoop, damp, strum } from '../../lib/audio';
import { parseBody, songChords, transposeText, type Line, type Song } from '../../lib/songs';
import { usePersistent } from '../../lib/storage';
import { pretty } from '../../lib/theory';
import { useWakeLock } from '../../lib/useWakeLock';
import { buildTimeline, hasPlayable, METERS, slotAt, stepSeconds, type TimelineBar } from '../../lib/timeline';

// 조옮김은 한 옥타브 안에서만 (그 이상은 같은 코드 이름이 반복됨)
const MAX_SHIFT = 11;
type SongPrefs = { semis?: number; flats?: boolean; bpm?: number };
// 악보 글자 크기 (보면대 거리에 맞게 고른다)
const TEXT_SIZES = [14, 16, 19, 23];

export function SongView({
  song,
  editable,
  onBack,
  onEdit,
  onDelete,
  favorite,
  onToggleFavorite,
}: {
  song: Song;
  editable: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  favorite: boolean;
  onToggleFavorite: () => void;
}) {
  // 조옮김·표기·템포는 곡마다 기억한다 (다음에 열어도 내 키로)
  const [prefs, setPrefs] = usePersistent<SongPrefs>(`song.prefs.${song.id}`, {});
  const semis = prefs.semis ?? 0;
  const flats = prefs.flats ?? false;
  const bpm = prefs.bpm ?? song.bpm ?? 80;
  const setPref = <K extends keyof SongPrefs>(k: K, v: SongPrefs[K]) => setPrefs((p) => ({ ...p, [k]: v }));
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentBar, setCurrentBar] = useState(-1);
  // 시작 전 한 마디 동안 박을 세어 준다 (0이면 카운트 중 아님)
  const [countBeat, setCountBeat] = useState(0);
  const [textSize, setTextSize] = usePersistent('song.textSize', 1);
  useWakeLock(scrolling || playing);

  const lines = useMemo(() => parseBody(song.body), [song.body]);
  const tx = (c: string) => transposeText(c, semis, flats);
  const chords = songChords(lines).map(tx);

  const capo = song.capo ?? 0;
  const time = song.time ?? '4/4';
  const fullTimeline = useMemo(() => buildTimeline(lines), [lines]);
  const playable = hasPlayable(fullTimeline);

  // 구간 반복: 고른 구간 제목 줄부터 다음 구간 제목 전까지만 반주한다
  const [loopSection, setLoopSection] = useState<number | null>(null);
  const sectionRange = (start: number) => {
    const next = lines.findIndex((l, i) => i > start && l.kind === 'section');
    return [start, next < 0 ? lines.length : next] as const;
  };
  const loopable = useMemo(() => {
    const set = new Set<number>();
    lines.forEach((l, i) => {
      if (l.kind !== 'section') return;
      const next = lines.findIndex((x, j) => j > i && x.kind === 'section');
      const end = next < 0 ? lines.length : next;
      if (fullTimeline.some((b) => b.line > i && b.line < end && b.slots.some((c) => c != null))) set.add(i);
    });
    return set;
  }, [lines, fullTimeline]);
  const timeline = useMemo(() => {
    if (loopSection == null) return fullTimeline;
    const [start, end] = sectionRange(loopSection);
    const part = fullTimeline.filter((b) => b.line > start && b.line < end);
    return part.length ? part : fullTimeline;
  }, [fullTimeline, loopSection, lines]);

  // 자동 스크롤
  useEffect(() => {
    if (!scrolling) return;
    let raf = 0;
    let last = performance.now();
    let acc = 0;
    const loop = (t: number) => {
      acc += ((t - last) / 1000) * speed * 9;
      last = t;
      if (acc >= 1) {
        window.scrollBy(0, Math.floor(acc));
        acc -= Math.floor(acc);
      }
      if (window.innerHeight + window.scrollY >= document.body.scrollHeight - 2) setScrolling(false);
      else raf = requestAnimationFrame(loop);
    };
    raf = requestAnimationFrame(loop);
    return () => cancelAnimationFrame(raf);
  }, [scrolling, speed]);

  // 반주 재생: 박자표에 맞는 스트럼 패턴, 쉬는 마디(N.C.)는 소리 없이 지나간다
  const state = useRef({ bpm, timeline, semis, flats, capo, time });
  state.current = { bpm, timeline, semis, flats, capo, time };
  const loop = useMemo(
    () =>
      createLoop(
        () => stepSeconds(state.current.bpm, state.current.time),
        (step, when, at) => {
          const { timeline: tl, semis: s, flats: f, capo: cp, time: ts } = state.current;
          if (!tl.length) return;
          const meter = METERS[ts];
          if (step < meter.steps) {
            if (step % meter.stepsPerBeat === 0) {
              const beat = step / meter.stepsPerBeat + 1;
              click(when, beat === 1);
              at(() => setCountBeat(beat));
            }
            return;
          }
          step -= meter.steps;
          const barIdx = Math.floor(step / meter.steps) % tl.length;
          const e = step % meter.steps;
          if (step === 0) at(() => setCountBeat(0));
          if (e === 0) at(() => setCurrentBar(barIdx));
          const bar = tl[barIdx];
          const { index, chord } = slotAt(bar, e, meter.steps);
          const slotStart = slotAt(bar, Math.max(0, e - 1), meter.steps).index !== index || e === 0;
          if (chord == null) {
            if (slotStart) damp(when);
            return;
          }
          const r = resolveChord(transposeText(chord, s, f));
          if (!r) return;
          // 코드가 바뀌는 칸은 패턴과 상관없이 다운으로 시작
          const p = slotStart ? 'D' : meter.pattern[e];
          if (p === 'D') strum(r.voicing.frets, { when, vel: e === 0 ? 1 : 0.72, spread: 0.02, transpose: cp });
          else if (p === 'U') strum(r.voicing.frets, { when, dir: 'up', vel: 0.5, spread: 0.014, transpose: cp });
        },
      ),
    [],
  );
  useEffect(() => () => loop.stop(), [loop]);
  const togglePlay = () => {
    if (playing) {
      loop.stop();
      setCurrentBar(-1);
      setCountBeat(0);
    } else loop.start();
    setPlaying(!playing);
  };

  const tapChord = (c: string) => {
    playChordName(c, capo);
    setSelected(c);
    document.getElementById(`strip-${c}`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  const keyLabel = song.key ? pretty(transposeText(song.key, semis, flats)) : null;
  const playingBar = playing && currentBar >= 0 ? (timeline[currentBar] ?? null) : null;
  // 반주 중에는 지금 마디가 화면 가운데 근처에 오도록 따라간다 (자동 스크롤 중엔 그대로)
  useEffect(() => {
    if (!playingBar || scrolling) return;
    const el = document.querySelector(`[data-pos="${playingBar.line}-${playingBar.bar}"]`);
    if (!el) return;
    const r = el.getBoundingClientRect();
    if (r.top < 200 || r.bottom > window.innerHeight - 120) el.scrollIntoView({ block: 'center', behavior: 'smooth' });
  }, [playingBar, scrolling]);

  const shiftSemis = (d: number) => setPref('semis', Math.max(-MAX_SHIFT, Math.min(MAX_SHIFT, semis + d)));

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onPress={onBack}>
          <ChevronLeft className="size-4" />
          목록
        </Button>
        <div className="flex-1" />
        <Button
          variant="ghost"
          size="sm"
          isIconOnly
          aria-label={favorite ? '즐겨찾기에서 빼기' : '즐겨찾기에 추가'}
          aria-pressed={favorite}
          onPress={onToggleFavorite}
        >
          <Star className={`size-5 ${favorite ? 'fill-accent text-accent' : ''}`} />
        </Button>
        <Button variant="tertiary" size="sm" onPress={onEdit}>
          <Pencil className="size-4" />
          {editable ? '편집' : (
            <>
              <span className="sm:hidden">복사해 편집</span>
              <span className="hidden sm:inline">내 노래로 복사해 편집</span>
            </>
          )}
        </Button>
        {editable && (
          <Button variant="danger-soft" size="sm" isIconOnly aria-label="삭제" onPress={onDelete}>
            <Trash className="size-4" />
          </Button>
        )}
      </div>

      <header>
        <h1 className="text-3xl font-extrabold tracking-tight">{song.title}</h1>
        <p className="text-muted">{song.artist}</p>
        <div className="mt-2 flex flex-wrap gap-1.5">
          {keyLabel && <Chip size="sm" color="accent" variant="soft">키 {keyLabel}</Chip>}
          {song.capo ? <Chip size="sm">카포 {song.capo}</Chip> : null}
          {song.bpm ? <Chip size="sm">♩ {song.bpm}</Chip> : null}
          {time !== '4/4' && <Chip size="sm">{time}</Chip>}
          {song.strum && <Chip size="sm">{song.strum}</Chip>}
          {!song.hasLyrics && <Chip size="sm" variant="tertiary">코드 진행만</Chip>}
        </div>
      </header>

      {/* 곡에 쓰인 코드 */}
      <div className="sticky top-[57px] z-20 -mx-4 border-b border-separator bg-background/90 px-4 py-2 backdrop-blur-xl">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {chords.map((c) => (
            <div key={c} id={`strip-${c}`} className="w-[92px] shrink-0">
              <MiniChord name={c} transpose={capo} active={selected === c || playingBarHas(playingBar, c, tx)} className="w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* 조옮김 / 스크롤 / 반주 */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-border bg-surface p-3">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold whitespace-nowrap text-muted">조옮김</span>
          <Button
            size="sm"
            variant="tertiary"
            isIconOnly
            aria-label="반음 내리기"
            isDisabled={semis <= -MAX_SHIFT}
            onPress={() => shiftSemis(-1)}
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-8 text-center font-bold tabular-nums">{semis > 0 ? `+${semis}` : semis}</span>
          <Button
            size="sm"
            variant="tertiary"
            isIconOnly
            aria-label="반음 올리기"
            isDisabled={semis >= MAX_SHIFT}
            onPress={() => shiftSemis(1)}
          >
            <Plus className="size-4" />
          </Button>
          <button
            type="button"
            onClick={() => setPref('flats', !flats)}
            className="rounded-lg bg-surface-secondary px-2 py-1 text-xs font-bold whitespace-nowrap text-muted hover:text-foreground"
          >
            {flats ? '♭ 표기' : '♯ 표기'}
          </button>
          {(semis !== 0 || prefs.bpm != null) && (
            <button
              type="button"
              onClick={() => setPrefs({})}
              className="rounded-lg px-2 py-1 text-xs font-bold whitespace-nowrap text-accent hover:bg-accent/15"
            >
              원래대로
            </button>
          )}
        </div>

        <Button
          size="sm"
          variant="tertiary"
          aria-label={`글자 크기 ${textSize + 1}/${TEXT_SIZES.length}`}
          onPress={() => setTextSize((t) => (t + 1) % TEXT_SIZES.length)}
        >
          <ALargeSmall className="size-4" />
          <span className="tabular-nums">{textSize + 1}</span>
        </Button>

        <div className="flex min-w-[200px] flex-1 items-center gap-2">
          <Button
            size="sm"
            variant={scrolling ? 'primary' : 'tertiary'}
            onPress={() => setScrolling((s) => !s)}
            aria-label="자동 스크롤"
          >
            <ArrowDownToLine className="size-4" />
            스크롤
          </Button>
          <Slider value={speed} onChange={(v) => setSpeed(v as number)} minValue={1} maxValue={10} className="flex-1" aria-label="스크롤 속도">
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>
        </div>

        {playable && (
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <Button size="sm" variant={playing ? 'secondary' : 'primary'} onPress={togglePlay}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              {countBeat ? <span className="w-[2.5em] tabular-nums">{countBeat}…</span> : '반주'}
            </Button>
            <Slider value={bpm} onChange={(v) => setPref('bpm', v as number)} minValue={40} maxValue={180} className="flex-1">
              <Label className="sr-only">템포</Label>
              <Slider.Track>
                <Slider.Fill />
                <Slider.Thumb />
              </Slider.Track>
            </Slider>
            <span className="w-14 text-right text-sm font-bold tabular-nums">♩ {bpm}</span>
          </div>
        )}
      </div>

      <article className="flex flex-col gap-1 pb-10" style={{ fontSize: TEXT_SIZES[textSize] ?? 16 }}>
        {lines.map((l, i) => (
          <LineView
            key={i}
            line={l}
            index={i}
            tx={tx}
            onChord={tapChord}
            playingBar={playingBar}
            looping={loopSection === i}
            onLoop={loopable.has(i) ? () => setLoopSection((cur) => (cur === i ? null : i)) : undefined}
          />
        ))}
      </article>
    </div>
  );
}

function playingBarHas(bar: TimelineBar | null, chord: string, tx: (c: string) => string) {
  return !!bar && bar.slots.some((c) => c != null && tx(c) === chord);
}

function ChordButton({ chord, onChord, active }: { chord: string; onChord: (c: string) => void; active?: boolean }) {
  return (
    <button
      type="button"
      onClick={() => onChord(chord)}
      className={`rounded-md px-0.5 font-bold transition hover:bg-accent/15 ${
        active ? 'bg-accent text-accent-foreground hover:bg-accent' : 'text-accent'
      }`}
    >
      {pretty(chord)}
    </button>
  );
}

// 악보 한 줄 그리기 (곡 화면과 편집기 미리보기에서 함께 씀)
export function LineView({
  line,
  index,
  tx,
  onChord,
  playingBar,
  looping,
  onLoop,
}: {
  line: Line;
  index: number;
  tx: (c: string) => string;
  onChord: (c: string) => void;
  playingBar: TimelineBar | null;
  looping?: boolean;
  onLoop?: () => void;
}) {
  switch (line.kind) {
    case 'empty':
      return <div className="h-[0.75em]" />;
    case 'section':
      return (
        <h2 className="mt-4 mb-1 flex items-center gap-2 text-sm font-extrabold tracking-wide text-muted uppercase">
          <span className="h-4 w-1 rounded-full bg-accent" />
          {line.name}
          {onLoop && (
            <button
              type="button"
              onClick={onLoop}
              aria-pressed={looping}
              className={`ml-1 flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-bold tracking-normal normal-case transition ${
                looping ? 'bg-accent text-accent-foreground' : 'bg-surface-secondary text-muted hover:text-foreground'
              }`}
            >
              <Repeat className="size-3" />
              {looping ? '이 구간 반복 중' : '구간 반복'}
            </button>
          )}
        </h2>
      );
    case 'note':
      return <p className="text-[0.875em] text-muted italic">{line.text}</p>;
    case 'tab':
      return (
        <pre className="my-1 overflow-x-auto rounded-xl border border-border bg-surface px-3 py-2 font-mono text-[0.8em] leading-snug text-foreground/90">
          {line.lines.join('\n')}
        </pre>
      );
    case 'bars':
      return (
        <div className="grid grid-cols-2 gap-1.5 sm:grid-cols-4">
          {line.bars.map((bar, bi) => {
            const active = playingBar?.line === index && playingBar.bar === bi;
            return (
              <div
                key={bi}
                data-pos={`${index}-${bi}`}
                className={`flex min-h-[2.75em] items-center justify-around gap-1 rounded-xl border px-2 text-[1.125em] transition ${
                  active ? 'border-accent bg-accent/15' : 'border-border bg-surface'
                }`}
              >
                {bar.map((c, ci) =>
                  resolveChord(c) ? (
                    <ChordButton key={ci} chord={tx(c)} onChord={onChord} />
                  ) : (
                    <span key={ci} className="text-muted">
                      {c}
                    </span>
                  ),
                )}
              </div>
            );
          })}
        </div>
      );
    case 'lyric': {
      const hasChord = line.segments.some((s) => s.chord);
      if (!hasChord) return <p className="text-[1.125em] leading-relaxed whitespace-pre-wrap">{line.segments.map((s) => s.text).join('')}</p>;
      return (
        <div className="flex flex-wrap items-end text-[1.125em] leading-tight">
          {line.segments.map((s, i) => (
            <span key={i} data-pos={`${index}-${i}`} className="inline-flex flex-col">
              <span className="h-[1.5em] pr-1 text-[0.9em]">
                {s.chord ? (
                  <ChordButton
                    chord={tx(s.chord)}
                    onChord={onChord}
                    active={playingBar?.line === index && playingBar.bar === i}
                  />
                ) : (
                  ' '
                )}
              </span>
              <span className="whitespace-pre">{s.text || ' '}</span>
            </span>
          ))}
        </div>
      );
    }
  }
}
