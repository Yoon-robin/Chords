import { useRef, type ReactNode } from 'react';
import { arpeggio, strum } from '../lib/audio';
import { chordTones, parseSongChord, pretty, voicings, type Voicing } from '../lib/theory';
import { ChordDiagram, type LabelMode } from './ChordDiagram';

export function flash(el: HTMLElement | null) {
  if (!el) return;
  el.classList.remove('ringing');
  void el.offsetWidth;
  el.classList.add('ringing');
}

// 악보 속 코드 이름 → 다이어그램/소리용 정보
export function resolveChord(text: string) {
  const c = parseSongChord(text);
  if (!c) return null;
  const v = voicings(c.pc, c.qid)[0];
  return v ? { chord: c, voicing: v, tones: chordTones(c.rootName, c.qid) } : null;
}

export function playChordName(text: string) {
  const r = resolveChord(text);
  if (r) strum(r.voicing.frets);
}

// 누르면 스트럼되는 작은 코드 카드
export function MiniChord({
  name,
  sub,
  active,
  children,
  onPress,
  className,
}: {
  name: string;
  sub?: ReactNode;
  active?: boolean;
  children?: ReactNode;
  onPress?: () => void;
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
        else if (r) strum(r.voicing.frets);
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
      <div className="mt-1 flex items-center justify-between">
        <code className="text-xs tracking-wider text-muted">{voicing.code}</code>
        <button
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            arpeggio(voicing.frets);
            flash(ref.current);
          }}
          className="rounded-lg bg-surface-secondary px-2 py-1 text-xs font-semibold text-muted hover:text-accent"
        >
          아르페지오
        </button>
      </div>
    </div>
  );
}
