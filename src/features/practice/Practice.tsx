import { useEffect, useMemo, useRef, useState } from 'react';
import { Button, Card, Label, ListBox, Select, Slider, Switch, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { Hand, Minus, Pause, Play, Plus, X } from 'lucide-react';
import { MiniChord } from '../../components/ChordCard';
import { click, createLoop, damp, pluck, strum } from '../../lib/audio';
import { usePersistent } from '../../lib/storage';
import { arpString, diatonic, pretty, SCALES, TUNING, voicings, type Mode } from '../../lib/theory';

const PATTERNS = [
  { id: 'D-D-D-D-', name: '다운 4비트' },
  { id: 'D-DU-UDU', name: '포크 스트럼' },
  { id: 'DUDUDUDU', name: '8비트' },
  { id: 'arp', name: '아르페지오' },
];

const PRESETS: Record<Mode, { name: string; prog: number[] }[]> = {
  major: [
    { name: '팝 진행 (I–V–vi–IV)', prog: [0, 4, 5, 3] },
    { name: '감성 진행 (vi–IV–I–V)', prog: [5, 3, 0, 4] },
    { name: '50년대 (I–vi–IV–V)', prog: [0, 5, 3, 4] },
    { name: '왕도 진행 (IV–V–iii–vi)', prog: [3, 4, 2, 5] },
    { name: '투파이브원 (ii–V–I)', prog: [1, 4, 0, 0] },
    { name: '포크 (I–IV–V–IV)', prog: [0, 3, 4, 3] },
    { name: '캐논 진행', prog: [0, 4, 5, 2, 3, 0, 3, 4] },
  ],
  minor: [
    { name: '에픽 (i–VI–III–VII)', prog: [0, 5, 2, 6] },
    { name: '발라드 (i–iv–VII–III)', prog: [0, 3, 6, 2] },
    { name: '안달루시안풍 (i–VII–VI–VII)', prog: [0, 6, 5, 6] },
    { name: '기본 (i–iv–v–i)', prog: [0, 3, 4, 0] },
  ],
};

type Running = null | 'metro' | 'prog';

export function Practice() {
  const [bpm, setBpm] = usePersistent('practice.bpm', 90);
  const [beats, setBeats] = usePersistent('practice.beats', 4);
  const [keyPc, setKeyPc] = usePersistent('practice.key', 0);
  const [mode, setMode] = usePersistent<Mode>('practice.mode', 'major');
  const [sevenths, setSevenths] = usePersistent('practice.sevenths', false);
  const [prog, setProg] = usePersistent<number[]>('practice.prog', [0, 4, 5, 3]);
  const [pattern, setPattern] = usePersistent('practice.pattern', 'D-DU-UDU');
  const [withClick, setWithClick] = usePersistent('practice.click', false);
  const [running, setRunning] = useState<Running>(null);
  const [beat, setBeat] = useState(-1);
  const [bar, setBar] = useState(-1);
  const taps = useRef<number[]>([]);

  const chords = diatonic(keyPc, mode, sevenths);
  const st = useRef({ bpm, beats, prog, chords, pattern, withClick, running });
  st.current = { bpm, beats, prog, chords, pattern, withClick, running };

  const loop = useMemo(
    () =>
      createLoop(
        () => 60 / st.current.bpm / 2,
        (step, time, at) => {
          const s = st.current;
          if (s.running === 'metro') {
            if (step % 2) return;
            const b = (step / 2) % s.beats;
            click(time, b === 0);
            at(() => setBeat(b));
            return;
          }
          if (!s.prog.length) return;
          const barIdx = Math.floor(step / 8) % s.prog.length;
          const e = step % 8;
          const c = s.chords[s.prog[barIdx]];
          const v = voicings(c.pc, c.qid)[0];
          if (e % 2 === 0) {
            if (s.withClick) click(time, e === 0);
            const b = e / 2;
            at(() => {
              setBeat(b);
              if (b === 0) setBar(barIdx);
            });
          }
          if (!v) return;
          if (s.pattern === 'arp') {
            if (e === 0) damp(time);
            const str = arpString(v.frets, e);
            if (str != null) pluck(TUNING[str] + v.frets[str]!, time, e === 0 ? 0.95 : 0.7);
            return;
          }
          const p = s.pattern[e];
          if (p === 'D') strum(v.frets, { when: time, vel: e === 0 ? 1 : 0.72, spread: 0.02 });
          else if (p === 'U') strum(v.frets, { when: time, dir: 'up', vel: 0.5, spread: 0.014 });
        },
      ),
    [],
  );

  useEffect(() => () => loop.stop(), [loop]);

  const toggle = (which: Exclude<Running, null>) => {
    loop.stop();
    setBeat(-1);
    setBar(-1);
    if (running === which) {
      setRunning(null);
      return;
    }
    st.current.running = which;
    setRunning(which);
    loop.start();
  };

  const tap = () => {
    const t = performance.now();
    taps.current = [...taps.current.filter((x) => t - x < 2500), t].slice(-5);
    if (taps.current.length >= 2) {
      const gaps = taps.current.slice(1).map((x, i) => x - taps.current[i]);
      const avg = gaps.reduce((a, b) => a + b, 0) / gaps.length;
      setBpm(Math.max(40, Math.min(220, Math.round(60000 / avg))));
    }
  };

  const keys = SCALES[mode].keys;
  const presetIdx = PRESETS[mode].findIndex((p) => p.prog.join() === prog.join());
  const beatCount = running === 'prog' ? 4 : beats;

  return (
    <div className="flex flex-col gap-5">
      {/* 메트로놈 */}
      <Card>
        <Card.Header>
          <Card.Title>메트로놈</Card.Title>
        </Card.Header>
        <Card.Content className="flex flex-col items-center gap-5">
          <div className="flex items-center gap-4">
            <Button isIconOnly variant="tertiary" aria-label="느리게" onPress={() => setBpm((b) => Math.max(40, b - 1))}>
              <Minus className="size-5" />
            </Button>
            <div className="w-36 text-center">
              <div className="text-6xl font-black tracking-tighter tabular-nums">{bpm}</div>
              <div className="text-sm text-muted">BPM</div>
            </div>
            <Button isIconOnly variant="tertiary" aria-label="빠르게" onPress={() => setBpm((b) => Math.min(220, b + 1))}>
              <Plus className="size-5" />
            </Button>
          </div>

          <Slider value={bpm} onChange={(v) => setBpm(v as number)} minValue={40} maxValue={220} className="w-full max-w-md" aria-label="템포">
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>

          <div className="flex gap-3">
            {Array.from({ length: beatCount }, (_, i) => (
              <span
                key={i}
                className={`size-5 rounded-full transition duration-75 ${
                  running && beat === i ? (i === 0 ? 'scale-125 bg-accent' : 'scale-110 bg-foreground') : 'bg-surface-tertiary'
                }`}
              />
            ))}
          </div>

          <div className="flex flex-wrap items-center justify-center gap-3">
            <ToggleButtonGroup
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[String(beats)]}
              onSelectionChange={(k) => setBeats(Number([...k][0]))}
              size="sm"
            >
              {[2, 3, 4, 6].map((n, i) => (
                <ToggleButton key={n} id={String(n)}>
                  {i > 0 && <ToggleButtonGroup.Separator />}
                  {n}/4
                </ToggleButton>
              ))}
            </ToggleButtonGroup>
            <Button variant="secondary" size="sm" onPress={tap}>
              <Hand className="size-4" />탭 템포
            </Button>
            <Button onPress={() => toggle('metro')} variant={running === 'metro' ? 'secondary' : 'primary'}>
              {running === 'metro' ? <Pause className="size-4" /> : <Play className="size-4" />}
              {running === 'metro' ? '정지' : '시작'}
            </Button>
          </div>
        </Card.Content>
      </Card>

      {/* 코드 진행 */}
      <Card>
        <Card.Header>
          <Card.Title>코드 진행 연습</Card.Title>
          <Card.Description>키를 고르고 진행을 만들어 반주처럼 들어 보세요</Card.Description>
        </Card.Header>
        <Card.Content className="flex flex-col gap-4">
          <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
            {keys.map((n, pc) => (
              <button
                key={n}
                type="button"
                onClick={() => setKeyPc(pc)}
                className={`rounded-xl border px-2 py-1.5 text-sm font-semibold transition ${
                  pc === keyPc ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface hover:border-accent'
                }`}
              >
                {pretty(n)}
              </button>
            ))}
          </div>
          <div className="flex flex-wrap gap-3">
            <ToggleButtonGroup
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[mode]}
              onSelectionChange={(k) => {
                const m = [...k][0] as Mode;
                setMode(m);
                setProg([...PRESETS[m][0].prog]);
              }}
              size="sm"
            >
              <ToggleButton id="major">메이저</ToggleButton>
              <ToggleButton id="minor">
                <ToggleButtonGroup.Separator />
                마이너
              </ToggleButton>
            </ToggleButtonGroup>
            <ToggleButtonGroup
              selectionMode="single"
              disallowEmptySelection
              selectedKeys={[sevenths ? '7' : '3']}
              onSelectionChange={(k) => setSevenths([...k][0] === '7')}
              size="sm"
            >
              <ToggleButton id="3">3화음</ToggleButton>
              <ToggleButton id="7">
                <ToggleButtonGroup.Separator />
                7화음
              </ToggleButton>
            </ToggleButtonGroup>
          </div>

          <div>
            <p className="mb-2 text-sm font-semibold text-muted">
              {pretty(keys[keyPc])} {mode === 'major' ? '메이저' : '마이너'} 다이아토닉 코드 · 누르면 소리, ＋로 진행에 추가
            </p>
            <div className="grid grid-cols-4 gap-2 sm:grid-cols-7">
              {chords.map((c) => (
                <div key={c.degree} className="relative">
                  <MiniChord name={c.name.replace('♭', 'b').replace('♯', '#')} sub={c.roman} className="w-full" />
                  <button
                    type="button"
                    aria-label={`${c.name} 진행에 추가`}
                    onClick={() => setProg((p) => [...p, c.degree])}
                    className="absolute top-1 right-1 grid size-6 place-items-center rounded-full bg-accent text-accent-foreground shadow"
                  >
                    <Plus className="size-3.5" strokeWidth={3} />
                  </button>
                </div>
              ))}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
            <Select
              value={presetIdx >= 0 ? String(presetIdx) : 'custom'}
              onChange={(k) => k != null && k !== 'custom' && setProg([...PRESETS[mode][Number(k)].prog])}
              fullWidth
            >
              <Label>진행</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {PRESETS[mode].map((p, i) => (
                    <ListBox.Item key={p.name} id={String(i)} textValue={p.name}>
                      {p.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                  <ListBox.Item id="custom" textValue="직접 만들기">
                    직접 만들기
                    <ListBox.ItemIndicator />
                  </ListBox.Item>
                </ListBox>
              </Select.Popover>
            </Select>
            <Select value={pattern} onChange={(k) => k && setPattern(String(k))} fullWidth>
              <Label>리듬</Label>
              <Select.Trigger>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {PATTERNS.map((p) => (
                    <ListBox.Item key={p.id} id={p.id} textValue={p.name}>
                      {p.name}
                      <ListBox.ItemIndicator />
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select>
            <Button
              onPress={() => toggle('prog')}
              isDisabled={!prog.length}
              variant={running === 'prog' ? 'secondary' : 'primary'}
            >
              {running === 'prog' ? <Pause className="size-4" /> : <Play className="size-4" />}
              {running === 'prog' ? '정지' : `재생 ♩${bpm}`}
            </Button>
          </div>

          <Switch isSelected={withClick} onChange={setWithClick} size="sm">
            <Switch.Control>
              <Switch.Thumb />
            </Switch.Control>
            <Switch.Content>
              <Label>메트로놈 소리 같이 듣기</Label>
            </Switch.Content>
          </Switch>

          {prog.length ? (
            <div className="grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
              {prog.map((deg, i) => {
                const c = chords[deg];
                return (
                  <div key={i} className="relative">
                    <MiniChord
                      name={c.name.replace('♭', 'b').replace('♯', '#')}
                      sub={`${i + 1} · ${c.roman}`}
                      active={running === 'prog' && bar === i}
                      className="w-full"
                    />
                    <button
                      type="button"
                      aria-label="삭제"
                      onClick={() => setProg((p) => p.filter((_, j) => j !== i))}
                      className="absolute top-1 right-1 grid size-6 place-items-center rounded-full text-muted hover:bg-surface-secondary hover:text-danger"
                    >
                      <X className="size-3.5" />
                    </button>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="rounded-xl border border-dashed border-border py-6 text-center text-sm text-muted">
              진행이 비어 있어요. 위 코드의 ＋ 버튼으로 추가하세요.
            </p>
          )}
        </Card.Content>
      </Card>
    </div>
  );
}
