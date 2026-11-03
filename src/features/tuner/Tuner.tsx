import { useEffect, useMemo, useState } from 'react';
import { Button, Card, Description, Label, ListBox, Select, Slider, Switch, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { Check, Mic, MicOff, Volume2 } from 'lucide-react';
import { motion } from 'motion/react';
import { click, now, pluck } from '../../lib/audio';
import { freqToMidi, midiName, midiToFreq, NOTE_NAMES } from '../../lib/theory';
import { usePersistent } from '../../lib/storage';
import { useTuner } from './useTuner';

const TUNINGS = [
  { id: 'standard', name: '표준 (E A D G B E)', midi: [40, 45, 50, 55, 59, 64] },
  { id: 'half-down', name: '반음 내림 (E♭ 튜닝)', midi: [39, 44, 49, 54, 58, 63] },
  { id: 'drop-d', name: 'Drop D', midi: [38, 45, 50, 55, 59, 64] },
  { id: 'open-g', name: 'Open G', midi: [38, 43, 50, 55, 59, 62] },
  { id: 'open-d', name: 'Open D', midi: [38, 45, 50, 54, 57, 62] },
  { id: 'dadgad', name: 'DADGAD', midi: [38, 45, 50, 55, 57, 62] },
];

const IN_TUNE = 5; // ±센트
const noteOnly = (midi: number) => NOTE_NAMES[midi % 12].replace('#', '♯');
const SOLFEGE = ['도', '도♯', '레', '레♯', '미', '파', '파♯', '솔', '솔♯', '라', '라♯', '시'];

function Gauge({ cents, active, inTune }: { cents: number; active: boolean; inTune: boolean }) {
  const cx = 160;
  const cy = 172;
  const r = 140;
  const toAngle = (c: number) => (Math.max(-50, Math.min(50, c)) / 50) * 70;
  const polar = (deg: number, rad: number) => {
    const a = ((deg - 90) * Math.PI) / 180;
    return [cx + rad * Math.cos(a), cy + rad * Math.sin(a)];
  };
  const arc = (from: number, to: number, rad: number) => {
    const [x1, y1] = polar(toAngle(from), rad);
    const [x2, y2] = polar(toAngle(to), rad);
    return `M${x1} ${y1} A${rad} ${rad} 0 0 1 ${x2} ${y2}`;
  };
  const ticks = [];
  for (let c = -50; c <= 50; c += 5) {
    const major = c % 25 === 0;
    const [x1, y1] = polar(toAngle(c), r);
    const [x2, y2] = polar(toAngle(c), r - (major ? 16 : 9));
    ticks.push(
      <line key={c} x1={x1} y1={y1} x2={x2} y2={y2} strokeWidth={major ? 2.5 : 1.5} strokeLinecap="round" className="stroke-muted/60" />,
    );
    if (major) {
      const [tx, ty] = polar(toAngle(c), r - 30);
      ticks.push(
        <text key={`t${c}`} x={tx} y={ty + 4} textAnchor="middle" className="fill-muted text-[11px] font-semibold">
          {c > 0 ? `+${c}` : c}
        </text>,
      );
    }
  }
  const color = !active ? 'stroke-muted' : inTune ? 'stroke-success' : Math.abs(cents) < 15 ? 'stroke-warning' : 'stroke-danger';
  return (
    <svg viewBox="0 0 320 190" className="w-full max-w-md">
      <path d={arc(-50, 50, r + 8)} fill="none" strokeWidth={6} strokeLinecap="round" className="stroke-surface-tertiary" />
      <path d={arc(-IN_TUNE, IN_TUNE, r + 8)} fill="none" strokeWidth={6} strokeLinecap="round" className="stroke-success" />
      {ticks}
      <motion.g
        animate={{ rotate: active ? toAngle(cents) : 0 }}
        transition={{ type: 'spring', stiffness: 170, damping: 18 }}
        style={{ originX: `${cx}px`, originY: `${cy}px`, transformBox: 'view-box' }}
      >
        <line x1={cx} y1={cy} x2={cx} y2={cy - r + 14} strokeWidth={4} strokeLinecap="round" className={`${color} transition-colors`} />
      </motion.g>
      <circle cx={cx} cy={cy} r={9} className="fill-foreground" />
    </svg>
  );
}

export function Tuner() {
  const { status, freq, level, start, stop } = useTuner();
  const [tuningId, setTuningId] = usePersistent('tuner.tuning', 'standard');
  const [auto, setAuto] = usePersistent('tuner.auto', true);
  const [a4, setA4] = usePersistent('tuner.a4', 440);
  // 크로매틱: 기타 줄 대신 들리는 음에 가장 가까운 반음을 기준으로 (다른 악기·노래 음 확인용)
  const [chromatic, setChromatic] = usePersistent('tuner.chromatic', false);
  const [manual, setManual] = useState(0);
  const [tuned, setTuned] = useState<Set<number>>(new Set());

  const tuning = TUNINGS.find((t) => t.id === tuningId) ?? TUNINGS[0];
  const listening = status === 'listening';

  // 자동 모드: 들리는 음에 가장 가까운 줄
  const target = useMemo(() => {
    if (!auto || !freq) return manual;
    const m = freqToMidi(freq, a4);
    let best = 0;
    tuning.midi.forEach((s, i) => {
      if (Math.abs(s - m) < Math.abs(tuning.midi[best] - m)) best = i;
    });
    return best;
  }, [auto, freq, a4, tuning, manual]);

  const heardMidi = freq ? Math.round(freqToMidi(freq, a4)) : null;
  const targetMidi = chromatic ? (heardMidi ?? 69) : tuning.midi[target];
  const cents = freq ? 1200 * Math.log2(freq / midiToFreq(targetMidi, a4)) : 0;
  const hasSignal = listening && freq != null;
  const inTune = hasSignal && Math.abs(cents) <= IN_TUNE;

  useEffect(() => {
    if (auto && freq) setManual(target);
  }, [auto, freq, target]);

  // 0.6초 동안 계속 맞춰져 있으면 그 줄은 완료 표시 (중간에 벗어나면 타이머 초기화).
  // 완료되면 짧은 알림음을 내고, 수동 모드에서는 아직 안 맞춘 다음 줄로 넘어간다.
  useEffect(() => {
    if (chromatic || !inTune || tuned.has(target)) return;
    const id = setTimeout(() => {
      const next = new Set(tuned).add(target);
      setTuned(next);
      click(now() + 0.01, true);
      if (!auto) {
        const rest = [1, 2, 3, 4, 5].map((d) => (target + d) % 6).find((i) => !next.has(i));
        if (rest != null) setManual(rest);
      }
    }, 600);
    return () => clearTimeout(id);
  }, [inTune, target, tuned, auto, chromatic]);

  useEffect(() => setTuned(new Set()), [tuningId]);

  const allTuned = tuned.size === tuning.midi.length;
  const hint = chromatic
    ? !listening
      ? '마이크를 켜고 아무 음이나 내 보세요'
      : !hasSignal
        ? '소리를 내 주세요'
        : inTune
          ? '정확해요!'
          : cents < 0
            ? '조금 낮아요'
            : '조금 높아요'
    : allTuned
    ? '모든 줄을 맞췄어요. 연주를 시작하세요!'
    : !listening
    ? '마이크를 켜고 줄을 하나씩 튕겨 보세요'
    : !hasSignal
      ? `${6 - target}번줄을 튕겨 주세요`
      : inTune
        ? '정확해요!'
        : cents < 0
          ? '음이 낮아요 — 줄을 조여 주세요'
          : '음이 높아요 — 줄을 풀어 주세요';

  return (
    <div className="mx-auto flex max-w-xl flex-col items-center gap-6">
      <ToggleButtonGroup
        selectionMode="single"
        disallowEmptySelection
        selectedKeys={[chromatic ? 'chromatic' : 'guitar']}
        onSelectionChange={(k) => setChromatic([...k][0] === 'chromatic')}
        size="sm"
        aria-label="튜너 종류"
      >
        <ToggleButton id="guitar">기타 줄</ToggleButton>
        <ToggleButton id="chromatic">
          <ToggleButtonGroup.Separator />
          크로매틱
        </ToggleButton>
      </ToggleButtonGroup>

      <section className="-mt-2 flex w-full flex-col items-center">
        <div className="flex h-28 flex-col items-center justify-end">
          <motion.div
            key={targetMidi}
            initial={{ scale: 0.85, opacity: 0 }}
            animate={{ scale: inTune ? 1.08 : 1, opacity: 1 }}
            className={`text-8xl leading-none font-black tracking-tighter transition-colors ${
              inTune ? 'text-success' : hasSignal ? 'text-foreground' : 'text-muted'
            }`}
          >
            {chromatic && heardMidi == null ? (
              '—'
            ) : (
              <>
                {noteOnly(targetMidi)}
                <sub className="ml-1 align-baseline text-2xl font-bold text-muted">{Math.floor(targetMidi / 12) - 1}</sub>
              </>
            )}
          </motion.div>
          {chromatic && heardMidi != null && (
            <span className="mt-1 text-sm font-semibold text-muted">{SOLFEGE[targetMidi % 12]}</span>
          )}
        </div>

        <Gauge cents={cents} active={hasSignal} inTune={inTune} />

        <div className="-mt-3 flex h-14 flex-col items-center">
          <div className={`text-lg font-bold tabular-nums ${inTune ? 'text-success' : ''}`}>
            {hasSignal ? `${cents > 0 ? '+' : ''}${cents.toFixed(0)} cent` : '—'}
          </div>
          <div className="text-sm text-muted tabular-nums">
            {hasSignal ? `${freq!.toFixed(1)} Hz · 들리는 음 ${heardMidi != null ? midiName(heardMidi) : ''}` : hint}
          </div>
        </div>
        {hasSignal && <p className="text-sm font-semibold text-muted">{hint}</p>}
      </section>

      {/* 줄 선택 */}
      {!chromatic && (
        <section className="grid w-full grid-cols-6 gap-2">
          {tuning.midi.map((m, i) => {
            const isTarget = i === target;
            const done = tuned.has(i);
            return (
              <button
                key={i}
                type="button"
                onClick={() => {
                  setAuto(false);
                  setManual(i);
                  pluck(m);
                }}
                className={`relative flex flex-col items-center rounded-2xl border py-3 transition ${
                  isTarget ? 'border-accent bg-accent/15' : 'border-border bg-surface hover:border-accent'
                }`}
              >
                {done && (
                  <span className="absolute -top-1.5 -right-1.5 grid size-5 place-items-center rounded-full bg-success text-success-foreground">
                    <Check className="size-3.5" strokeWidth={3} />
                  </span>
                )}
                <span className="text-xl font-extrabold">{noteOnly(m)}</span>
                <span className="text-[11px] text-muted">{6 - i}번줄</span>
              </button>
            );
          })}
        </section>
      )}

      <div className="flex w-full items-center gap-3">
        {/* 마이크가 켜져 있을 때만 입력 음량을 보여 주고, 꺼져 있으면 시작 버튼을 넓게 */}
        {listening && (
          <div className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface-secondary" aria-label="입력 음량">
            <div className="h-full rounded-full bg-accent transition-[width] duration-75" style={{ width: `${level * 100}%` }} />
          </div>
        )}
        <Button
          size="lg"
          variant={listening ? 'secondary' : 'primary'}
          isPending={status === 'starting'}
          onPress={() => (listening ? stop() : start())}
          className={listening ? '' : 'flex-1'}
        >
          {listening ? <MicOff className="size-5" /> : <Mic className="size-5" />}
          {listening ? '정지' : '튜닝 시작'}
        </Button>
        <Button size="lg" variant="tertiary" isIconOnly aria-label="기준음 듣기" onPress={() => pluck(targetMidi)}>
          <Volume2 className="size-5" />
        </Button>
      </div>

      {status === 'denied' && (
        <p className="w-full rounded-xl bg-danger/10 p-3 text-sm text-danger">
          마이크 권한이 거부되었습니다. 브라우저 주소창의 권한 설정에서 마이크를 허용해 주세요.
        </p>
      )}
      {status === 'unsupported' && (
        <p className="w-full rounded-xl bg-danger/10 p-3 text-sm text-danger">
          이 브라우저에서는 마이크를 쓸 수 없습니다. (휴대폰에서는 https 주소가 필요합니다)
        </p>
      )}

      <Card className="w-full">
        <Card.Content className="flex flex-col gap-5">
          {!chromatic && (
            <>
              <Select value={tuningId} onChange={(k) => k && setTuningId(String(k))} fullWidth>
                <Label>튜닝</Label>
                <Select.Trigger>
                  <Select.Value />
                  <Select.Indicator />
                </Select.Trigger>
                <Select.Popover>
                  <ListBox>
                    {TUNINGS.map((t) => (
                      <ListBox.Item key={t.id} id={t.id} textValue={t.name}>
                        <Label>{t.name}</Label>
                        <Description>{t.midi.map(noteOnly).join(' ')}</Description>
                        <ListBox.ItemIndicator />
                      </ListBox.Item>
                    ))}
                  </ListBox>
                </Select.Popover>
              </Select>

              <Switch isSelected={auto} onChange={setAuto}>
                <Switch.Control>
                  <Switch.Thumb />
                </Switch.Control>
                <Switch.Content>
                  <Label>자동 줄 인식</Label>
                  <Description>끄면 아래에서 고른 줄 기준으로 맞춥니다</Description>
                </Switch.Content>
              </Switch>
            </>
          )}

          <Slider value={a4} onChange={(v) => setA4(v as number)} minValue={430} maxValue={450} step={1}>
            <Label>기준음 A4</Label>
            <Slider.Output>{a4} Hz</Slider.Output>
            <Slider.Track>
              <Slider.Fill />
              <Slider.Thumb />
            </Slider.Track>
          </Slider>
        </Card.Content>
      </Card>
    </div>
  );
}
