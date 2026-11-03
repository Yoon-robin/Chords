import { useRef, type ReactNode } from 'react';
import { arpeggio, strum } from '../lib/audio';
import {
  chordTones,
  INTERVAL_LABELS,
  mod12,
  parseSongChord,
  pretty,
  slashVoicings,
  voicings,
  type SongChord,
  type Tone,
  type Voicing,
} from '../lib/theory';
import { ChordDiagram, type LabelMode } from './ChordDiagram';

export function flash(el: HTMLElement | null) {
  if (!el) return;
  el.classList.remove('ringing');
  void el.offsetWidth;
  el.classList.add('ringing');
}

export type ResolvedChord = {
  chord: SongChord;
  voicing: Voicing;
  tones: Tone[];
  // 분수 코드인데 베이스음을 넣은 운지를 못 찾아 기본 코드로 대신한 경우
  bassMissing: boolean;
};

const resolved = new Map<string, ResolvedChord | null>();

// 악보 속 코드 이름 → 다이어그램/소리용 정보 (결과는 캐시)
export function resolveChord(text: string): ResolvedChord | null {
  if (resolved.has(text)) return resolved.get(text)!;
  const r = computeResolved(text);
  resolved.set(text, r);
  return r;
}

function computeResolved(text: string): ResolvedChord | null {
  const c = parseSongChord(text);
  if (!c) return null;
  const tones = chordTones(c.rootName, c.qid);
  if (c.bass && c.bass.pc !== c.pc) {
    const sv = slashVoicings(c.pc, c.qid, c.bass.pc)[0];
    if (sv) {
      const inChord = tones.some((t) => t.pc === c.bass!.pc);
      const bassTone = { pc: c.bass.pc, name: c.bass.name, label: INTERVAL_LABELS[mod12(c.bass.pc - c.pc)] };
      return { chord: c, voicing: sv, tones: inChord ? tones : [...tones, bassTone], bassMissing: false };
    }
  }
  const v = voicings(c.pc, c.qid)[0];
  return v ? { chord: c, voicing: v, tones, bassMissing: !!c.bass && c.bass.pc !== c.pc } : null;
}

// transpose: 카포 프렛 수 (운지는 그대로, 실제 소리만 올라감)
export function playChordName(text: string, transpose = 0) {
  const r = resolveChord(text);
  if (r) strum(r.voicing.frets, { transpose });
}

// 누르면 스트럼되는 작은 코드 카드
export function MiniChord({
  name,
  sub,
  active,
  children,
  onPress,
  transpose = 0,
  className,
}: {
  name: string;
  sub?: ReactNode;
  active?: boolean;
  children?: ReactNode;
  onPress?: () => void;
  transpose?: number;
  className?: string;
}) {
  const ref = useRef<HTMLButtonElement>(null);
  const r = resolveChord(name);
  return (
    <button
      ref={ref}
      type="button"
      onClick={() => {
        if (onPress) onPress();
        else if (r) strum(r.voicing.frets, { transpose });
        flash(ref.current);
      }}
      className={`group relative flex shrink-0 flex-col items-center rounded-2xl border px-2 pt-2 pb-1 text-center transition
        ${active ? 'border-accent bg-accent/15 -translate-y-1' : 'border-border bg-surface hover:-translate-y-0.5 hover:border-accent'} ${className ?? ''}`}
    >
      {sub && <span className="font-serif text-xs font-bold text-accent">{sub}</span>}
      <span className="text-base font-bold tracking-tight">{pretty(name)}</span>
      {r ? (
        <ChordDiagram voicing={r.voicing} tones={r.tones} labels="none" title={name} className="max-w-[92px]" />
      ) : (
        <span className="py-6 text-xs text-muted">다이어그램 없음</span>
      )}
      {r?.chord.approx && <span className="text-[10px] text-muted">근사 모양</span>}
      {r?.bassMissing && <span className="text-[10px] text-warning">베이스 {pretty(r.chord.bass!.name)} 생략</span>}
      {children}
    </button>
  );
}

// 코드 사전용 큰 카드
export function VoicingCard({
  voicing,
  name,
  rootName,
  qid,
  labels,
}: {
  voicing: Voicing;
  name: string;
  rootName: string;
  qid: string;
  labels: LabelMode;
}) {
  const ref = useRef<HTMLDivElement>(null);
  const tones = chordTones(rootName, qid);
  const play = () => {
    strum(voicing.frets);
    flash(ref.current);
  };
  return (
    <div
      ref={ref}
      role="button"
      tabIndex={0}
      onClick={play}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          play();
        }
      }}
      className="cursor-pointer rounded-2xl border border-border bg-surface p-3 shadow-sm transition hover:-translate-y-0.5 hover:border-accent"
    >
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="font-bold">{voicing.position}</span>
        {voicing.shape && (
          <span className="rounded-md bg-surface-secondary px-2 py-0.5 text-xs text-muted">{voicing.shape}</span>
        )}
      </div>
      <ChordDiagram voicing={voicing} tones={tones} labels={labels} title={name} className="mx-auto max-w-[150px]" />
      <div className="mt-1 flex flex-wrap items-center justify-between gap-1">
        <code className="text-xs tracking-wider text-muted">{voicing.code}</code>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            arpeggio(voicing.frets, {});
            flash(ref.current);
          }}
          className="rounded-lg bg-surface-secondary px-2 py-1 text-xs font-semibold whitespace-nowrap text-muted hover:text-accent"
        >
          아르페지오
        </button>
      </div>
    </div>
  );
}
