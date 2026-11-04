import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Chip, Slider, Label } from '@heroui/react';
import { ALargeSmall, ArrowDownToLine, Check, Repeat, ChevronLeft, ChevronRight, Minus, Pause, Pencil, Play, Plus, Share2, Star, Trash } from 'lucide-react';
import { MiniChord, playChordName, resolveChord } from '../../components/ChordCard';
import { click, createLoop, damp, strum } from '../../lib/audio';
import { parseBody, simplifyChord, songChords, toChordPro, transposeText, type Line, type Song } from '../../lib/songs';
import { usePersistent } from '../../lib/storage';
import { pretty } from '../../lib/theory';
import { useWakeLock } from '../../lib/useWakeLock';
import { buildTimeline, hasPlayable, METERS, slotAt, stepSeconds, type TimelineBar } from '../../lib/timeline';

// 조옮김은 한 옥타브 안에서만 (그 이상은 같은 코드 이름이 반복됨)
const MAX_SHIFT = 11;
type SongPrefs = { semis?: number; flats?: boolean; bpm?: number; simple?: boolean; capo?: number };
const MAX_CAPO = 9;

// 오픈 운지가 없는 코드(바레·하이 포지션) 개수
function hardCount(chords: string[]) {
  return chords.filter((c) => {
    const r = resolveChord(c);
    return r && r.voicing.position !== '오픈';
  }).length;
}
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
  prev,
  next,
  onOpen,
}: {
  song: Song;
  editable: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
  favorite: boolean;
  onToggleFavorite: () => void;
  // 목록(검색·필터 결과)에서 앞뒤 곡. 즐겨찾기 필터로 열면 셋리스트처럼 이어서 연주
  prev?: Song | null;
  next?: Song | null;
  onOpen?: (id: string) => void;
}) {
  // 조옮김·표기·템포는 곡마다 기억한다 (다음에 열어도 내 키로)
  const [prefs, setPrefs] = usePersistent<SongPrefs>(`song.prefs.${song.id}`, {});
  const semis = prefs.semis ?? 0;
  const flats = prefs.flats ?? false;
  const simple = prefs.simple ?? false;
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
  // 카포를 바꾸면 소리는 그대로 두고 운지 모양만 옮긴다 (소리 = 모양 + 카포)
  const songCapo = song.capo ?? 0;
  const capo = prefs.capo ?? songCapo;
  const shapeShift = (c: number) => semis + songCapo - c;
  const shapesAt = (c: number) =>
    [...new Set(songChords(lines).map((ch) => transposeText(simple ? simplifyChord(ch) : ch, shapeShift(c), flats)))];
  const tx = (c: string) => transposeText(simple ? simplifyChord(c) : c, shapeShift(capo), flats);
  // 쉬운 코드로 바꾸면 Cmaj7·C처럼 같은 코드가 겹칠 수 있다
  const chords = shapesAt(capo);
  const hardNow = hardCount(chords);
  // 바레 코드가 가장 적은 카포 위치 (같으면 낮은 쪽)
  const bestCapo = useMemo(() => {
    let best = capo;
    let min = hardNow;
    for (let c = 0; c <= 7; c++) {
      const n = hardCount(shapesAt(c));
      if (n < min) [best, min] = [c, n];
    }
    return { capo: best, hard: min };
  }, [lines, semis, songCapo, simple, capo]);

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
  const state = useRef({ bpm, timeline, capo, time, tx });
  state.current = { bpm, timeline, capo, time, tx };
  const loop = useMemo(
    () =>
      createLoop(
        () => stepSeconds(state.current.bpm, state.current.time),
        (step, when, at) => {
          const { timeline: tl, capo: cp, time: ts, tx: t } = state.current;
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
          const r = resolveChord(t(chord));
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

  // 블루투스 페이지 넘기개·키보드: →/PageDown 다음 화면, ←/PageUp 이전 화면, 스페이스 자동 스크롤, P 반주
  const keys = useRef({ togglePlay, playable });
  keys.current = { togglePlay, playable };
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (e.ctrlKey || e.metaKey || e.altKey || e.defaultPrevented) return;
      const t = e.target as HTMLElement;
      if (t.closest('input, textarea, select, [contenteditable="true"], [role="dialog"], [role="slider"]')) return;
      // 한 화면씩 넘기되 위쪽에 고정된 코드 줄 아래로 앞 화면 끝이 조금 겹쳐 보이게
      const page = window.innerHeight * 0.7;
      if (e.key === 'PageDown' || e.key === 'ArrowRight') {
        e.preventDefault();
        window.scrollBy({ top: page, behavior: 'smooth' });
      } else if (e.key === 'PageUp' || e.key === 'ArrowLeft') {
        e.preventDefault();
        window.scrollBy({ top: -page, behavior: 'smooth' });
      } else if (e.key === ' ' && !t.closest('button, a')) {
        e.preventDefault();
        setScrolling((v) => !v);
      } else if (e.code === 'KeyP' && keys.current.playable) {
        keys.current.togglePlay();
      }
    };
    document.addEventListener('keydown', onKey);
    return () => document.removeEventListener('keydown', onKey);
  }, []);

  // ChordPro로 내보내기: 휴대폰은 공유 시트, 나머지는 클립보드로
  const [copied, setCopied] = useState(false);
  const share = async () => {
    const text = toChordPro(song);
    try {
      if (navigator.share && matchMedia('(pointer: coarse)').matches) {
        await navigator.share({ title: song.title, text });
        return;
      }
      await navigator.clipboard.writeText(text);
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    } catch {
      /* 공유를 취소했거나 클립보드를 쓸 수 없음 */
    }
  };

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
        <Button variant="ghost" size="sm" isIconOnly aria-label={copied ? 'ChordPro로 복사했어요' : '공유 (ChordPro)'} onPress={share}>
          {copied ? <Check className="size-5 text-success" /> : <Share2 className="size-5" />}
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
          {capo ? <Chip size="sm">카포 {capo}</Chip> : null}
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
          <button
            type="button"
            aria-pressed={simple}
            onClick={() => setPref('simple', !simple)}
            className={`rounded-lg px-2 py-1 text-xs font-bold whitespace-nowrap transition ${
              simple ? 'bg-accent text-accent-foreground' : 'bg-surface-secondary text-muted hover:text-foreground'
            }`}
          >
            쉬운 코드
          </button>
          {(semis !== 0 || prefs.bpm != null || simple || prefs.capo != null) && (
            <button
              type="button"
              onClick={() => setPrefs({})}
              className="rounded-lg px-2 py-1 text-xs font-bold whitespace-nowrap text-accent hover:bg-accent/15"
            >
              원래대로
            </button>
          )}
        </div>

        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-semibold whitespace-nowrap text-muted">카포</span>
          <Button
            size="sm"
            variant="tertiary"
            isIconOnly
            aria-label="카포 내리기"
            isDisabled={capo <= 0}
            onPress={() => setPref('capo', capo - 1)}
          >
            <Minus className="size-4" />
          </Button>
          <span className="w-8 text-center font-bold tabular-nums">{capo}</span>
          <Button
            size="sm"
            variant="tertiary"
            isIconOnly
            aria-label="카포 올리기"
            isDisabled={capo >= MAX_CAPO}
            onPress={() => setPref('capo', capo + 1)}
          >
            <Plus className="size-4" />
          </Button>
          {bestCapo.capo !== capo && (
            <button
              type="button"
              onClick={() => setPref('capo', bestCapo.capo)}
              className="rounded-lg bg-accent/15 px-2 py-1 text-xs font-bold whitespace-nowrap text-accent hover:bg-accent/25"
            >
              카포 {bestCapo.capo}이면 바레 {hardNow}→{bestCapo.hard}개
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
        <p className="hidden basis-full text-xs text-muted sm:block">
          키보드·페이지 넘기개: ← → 넘기기 · 스페이스 자동 스크롤{playable ? ' · P 반주' : ''}
        </p>
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

      {(prev || next) && onOpen && (
        <nav aria-label="앞뒤 곡" className="grid grid-cols-2 gap-3 border-t border-separator pt-4">
          {prev ? (
            <button
              type="button"
              onClick={() => onOpen(prev.id)}
              className="flex min-w-0 items-center gap-2 rounded-2xl border border-border bg-surface p-3 text-left transition hover:border-accent"
            >
              <ChevronLeft className="size-5 shrink-0 text-muted" />
              <span className="min-w-0">
                <span className="block text-xs text-muted">이전 곡</span>
                <span className="block truncate font-bold">{prev.title || '제목 없음'}</span>
              </span>
            </button>
          ) : (
            <span />
          )}
          {next && (
            <button
              type="button"
              onClick={() => onOpen(next.id)}
              className="flex min-w-0 items-center justify-end gap-2 rounded-2xl border border-border bg-surface p-3 text-right transition hover:border-accent"
            >
              <span className="min-w-0">
                <span className="block text-xs text-muted">다음 곡</span>
                <span className="block truncate font-bold">{next.title || '제목 없음'}</span>
              </span>
              <ChevronRight className="size-5 shrink-0 text-muted" />
            </button>
          )}
        </nav>
      )}
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
