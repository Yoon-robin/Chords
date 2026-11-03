import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Chip, Slider, Label } from '@heroui/react';
import { ArrowDownToLine, ChevronLeft, Minus, Pause, Pencil, Play, Plus, Trash } from 'lucide-react';
import { MiniChord, playChordName, resolveChord } from '../../components/ChordCard';
import { createLoop, now, strum } from '../../lib/audio';
import { parseBody, songChords, transposeText, type Line, type Song } from '../../lib/songs';
import { pretty } from '../../lib/theory';

type BarRef = { line: number; bar: number; chords: string[] };

export function SongView({
  song,
  editable,
  onBack,
  onEdit,
  onDelete,
}: {
  song: Song;
  editable: boolean;
  onBack: () => void;
  onEdit: () => void;
  onDelete: () => void;
}) {
  const [semis, setSemis] = useState(0);
  const [flats, setFlats] = useState(false);
  const [scrolling, setScrolling] = useState(false);
  const [speed, setSpeed] = useState(4);
  const [selected, setSelected] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [currentBar, setCurrentBar] = useState(-1);
  const [bpm, setBpm] = useState(song.bpm ?? 80);

  const lines = useMemo(() => parseBody(song.body), [song.body]);
  const tx = (c: string) => transposeText(c, semis, flats);
  const chords = songChords(lines).map(tx);

  const bars = useMemo(() => {
    const out: BarRef[] = [];
    lines.forEach((l, li) => {
      if (l.kind === 'bars') l.bars.forEach((b, bi) => out.push({ line: li, bar: bi, chords: b.filter((c) => resolveChord(c)) }));
    });
    return out.filter((b) => b.chords.length);
  }, [lines]);

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

  // 반주 재생: 마디마다 4박 다운 스트럼
  const state = useRef({ bpm, bars, semis, flats });
  state.current = { bpm, bars, semis, flats };
  const loop = useMemo(
    () =>
      createLoop(
        () => state.current.bpm,
        (step, time) => {
          const { bars: bs, semis: s, flats: f } = state.current;
          if (!bs.length || step % 2) return;
          const barIdx = Math.floor(step / 8) % bs.length;
          const beat = (step % 8) / 2;
          const b = bs[barIdx];
          const chord = b.chords[Math.min(b.chords.length - 1, Math.floor((beat * b.chords.length) / 4))];
          const r = resolveChord(transposeText(chord, s, f));
          if (r) strum(r.voicing.frets, { when: time, vel: beat === 0 ? 1 : 0.7, spread: 0.02 });
          if (beat === 0) setTimeout(() => setCurrentBar(barIdx), Math.max(0, (time - now()) * 1000));
        },
      ),
    [],
  );
  useEffect(() => () => loop.stop(), [loop]);
  const togglePlay = () => {
    if (playing) {
      loop.stop();
      setCurrentBar(-1);
    } else loop.start();
    setPlaying(!playing);
  };

  const tapChord = (c: string) => {
    playChordName(c);
    setSelected(c);
    document.getElementById(`strip-${c}`)?.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  };

  const keyLabel = song.key ? pretty(transposeText(song.key, semis, flats)) : null;
  const playingBar = playing && currentBar >= 0 ? bars[currentBar] : null;

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-center gap-2">
        <Button variant="ghost" size="sm" onPress={onBack}>
          <ChevronLeft className="size-4" />
          목록
        </Button>
        <div className="flex-1" />
        <Button variant="tertiary" size="sm" onPress={onEdit}>
          <Pencil className="size-4" />
          {editable ? '편집' : '내 노래로 복사해 편집'}
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
          {song.strum && <Chip size="sm">{song.strum}</Chip>}
          {!song.hasLyrics && <Chip size="sm" variant="tertiary">코드 진행만</Chip>}
        </div>
      </header>

      {/* 곡에 쓰인 코드 */}
      <div className="sticky top-[57px] z-20 -mx-4 border-b border-separator bg-background/90 px-4 py-2 backdrop-blur-xl">
        <div className="no-scrollbar flex gap-2 overflow-x-auto pb-1">
          {chords.map((c) => (
            <div key={c} id={`strip-${c}`} className="w-[92px] shrink-0">
              <MiniChord name={c} active={selected === c || playingBarHas(playingBar, c, tx)} className="w-full" />
            </div>
          ))}
        </div>
      </div>

      {/* 조옮김 / 스크롤 / 반주 */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3 rounded-2xl border border-border bg-surface p-3">
        <div className="flex items-center gap-2">
          <span className="text-sm font-semibold text-muted">조옮김</span>
          <Button size="sm" variant="tertiary" isIconOnly aria-label="반음 내리기" onPress={() => setSemis((s) => s - 1)}>
            <Minus className="size-4" />
          </Button>
          <span className="w-8 text-center font-bold tabular-nums">{semis > 0 ? `+${semis}` : semis}</span>
          <Button size="sm" variant="tertiary" isIconOnly aria-label="반음 올리기" onPress={() => setSemis((s) => s + 1)}>
            <Plus className="size-4" />
          </Button>
          <button
            type="button"
            onClick={() => setFlats((f) => !f)}
            className="rounded-lg bg-surface-secondary px-2 py-1 text-xs font-bold text-muted hover:text-foreground"
          >
            {flats ? '♭ 표기' : '♯ 표기'}
          </button>
        </div>

        <div className="flex min-w-[220px] flex-1 items-center gap-2">
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

        {bars.length > 0 && (
          <div className="flex min-w-[220px] flex-1 items-center gap-2">
            <Button size="sm" variant={playing ? 'secondary' : 'primary'} onPress={togglePlay}>
              {playing ? <Pause className="size-4" /> : <Play className="size-4" />}
              반주
            </Button>
            <Slider value={bpm} onChange={(v) => setBpm(v as number)} minValue={40} maxValue={180} className="flex-1">
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

      <article className="flex flex-col gap-1 pb-10">
        {lines.map((l, i) => (
          <LineView key={i} line={l} index={i} tx={tx} onChord={tapChord} playingBar={playingBar} />
        ))}
      </article>
    </div>
  );
}

function playingBarHas(bar: BarRef | null, chord: string, tx: (c: string) => string) {
  return !!bar && bar.chords.some((c) => tx(c) === chord);
}

function ChordButton({ chord, onChord }: { chord: string; onChord: (c: string) => void }) {
  return (
    <button
      type="button"
      onClick={() => onChord(chord)}
      className="rounded-md px-0.5 font-bold text-accent transition hover:bg-accent/15"
    >
      {pretty(chord)}
    </button>
  );
}

function LineView({
  line,
  index,
  tx,
  onChord,
  playingBar,
}: {
  line: Line;
  index: number;
  tx: (c: string) => string;
  onChord: (c: string) => void;
  playingBar: BarRef | null;
}) {
  switch (line.kind) {
    case 'empty':
      return <div className="h-3" />;
    case 'section':
      return (
        <h2 className="mt-4 mb-1 flex items-center gap-2 text-sm font-extrabold tracking-wide text-muted uppercase">
          <span className="h-4 w-1 rounded-full bg-accent" />
          {line.name}
        </h2>
      );
    case 'note':
      return <p className="text-sm text-muted italic">{line.text}</p>;
    case 'tab':
      return (
        <pre className="my-1 overflow-x-auto rounded-xl border border-border bg-surface px-3 py-2 font-mono text-[13px] leading-snug text-foreground/90">
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
                className={`flex min-h-12 items-center justify-around gap-1 rounded-xl border px-2 text-lg transition ${
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
      if (!hasChord) return <p className="text-lg leading-relaxed whitespace-pre-wrap">{line.segments.map((s) => s.text).join('')}</p>;
      return (
        <div className="flex flex-wrap items-end text-lg leading-tight">
          {line.segments.map((s, i) => (
            <span key={i} className="inline-flex flex-col">
              <span className="h-6 pr-1 text-base">{s.chord ? <ChordButton chord={tx(s.chord)} onChord={onChord} /> : ' '}</span>
              <span className="whitespace-pre">{s.text || ' '}</span>
            </span>
          ))}
        </div>
      );
    }
  }
}
