// 악보 마디 → 반주용 타임라인
//   N.C. / NC        → 쉬는 칸 (소리 없음)
//   %  (마디 전체)    → 앞 마디 반복
//   / - . %          → 바로 앞 코드를 한 칸 더
import { isChordToken } from './theory';
import type { Line, TimeSig } from './songs';

export type Meter = {
  steps: number; // 한 마디의 8분음표 칸 수
  stepsPerBeat: number;
  pattern: string; // 칸마다 D(다운) / U(업) / -(쉼)
  // BPM 한 박(6/8은 점4분음표)당 칸 수
  stepsPerBpm: number;
};

export const METERS: Record<TimeSig, Meter> = {
  '4/4': { steps: 8, stepsPerBeat: 2, pattern: 'D-DU-UDU', stepsPerBpm: 2 },
  '3/4': { steps: 6, stepsPerBeat: 2, pattern: 'D-DUDU', stepsPerBpm: 2 },
  '6/8': { steps: 6, stepsPerBeat: 3, pattern: 'D-UD-U', stepsPerBpm: 3 },
};

export const stepSeconds = (bpm: number, time: TimeSig = '4/4') => 60 / bpm / METERS[time].stepsPerBpm;

export type Slot = string | null;
export type TimelineBar = { line: number; bar: number; slots: Slot[] };

const REST = new Set(['N.C.', 'NC', 'N.C']);
const HOLD = new Set(['/', '-', '.', '%']);

export function buildTimeline(lines: Line[]): TimelineBar[] {
  const out: TimelineBar[] = [];
  let prevSlots: Slot[] = [];
  lines.forEach((l, li) => {
    if (l.kind !== 'bars') return;
    l.bars.forEach((tokens, bi) => {
      const prevChord = prevSlots.length ? prevSlots[prevSlots.length - 1] : null;
      const meaningful = tokens.filter((t) => REST.has(t) || HOLD.has(t) || isChordToken(t));
      if (!meaningful.length) return;
      let slots: Slot[];
      if (meaningful.length === 1 && meaningful[0] === '%') {
        slots = prevSlots.length ? [...prevSlots] : [null];
      } else {
        slots = [];
        for (const t of meaningful) {
          if (REST.has(t)) slots.push(null);
          else if (HOLD.has(t)) slots.push(slots.length ? slots[slots.length - 1] : prevChord);
          else slots.push(t);
        }
      }
      out.push({ line: li, bar: bi, slots });
      prevSlots = slots;
    });
  });
  return out;
}

// 마디 안 몇 번째 칸에서 울릴 코드 (마디를 칸 수로 균등 분할)
export function slotAt(bar: TimelineBar, step: number, steps: number) {
  const i = Math.min(bar.slots.length - 1, Math.floor((step * bar.slots.length) / steps));
  return { index: i, chord: bar.slots[i] };
}

export const hasPlayable = (tl: TimelineBar[]) => tl.some((b) => b.slots.some((s) => s != null));
