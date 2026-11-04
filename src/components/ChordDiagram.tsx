import { useLefty } from '../lib/lefty';
import { pretty, TUNING, type Fret, type Tone, type Voicing } from '../lib/theory';

const SX = 16; // 줄 간격
const SY = 20; // 프렛 간격
const PX = 26; // 왼쪽 여백 (프렛 번호 자리)
const PY = 24; // 위쪽 여백 (O / × 자리)
const FRETS = 5;
const R = 6.8;
const W = PX + SX * 5 + 14;
const GRID_H = FRETS * SY;

export type LabelMode = 'interval' | 'note' | 'none';

// 같은 프렛에서 1번줄까지 이어지는 줄을 한 손가락으로 누르면 바레로 그린다
function findBarre(frets: Fret[]) {
  const fr = frets.filter((f): f is number => f != null && f > 0);
  if (!fr.length) return null;
  const lo = Math.min(...fr);
  const idx = frets.map((f, i) => (f === lo ? i : -1)).filter((i) => i >= 0);
  if (idx.length < 2 || idx[idx.length - 1] !== 5) return null;
  for (let i = idx[0]; i <= 5; i++) if (frets[i] == null || (frets[i] as number) < lo) return null;
  // 떨어진 두 줄만 같은 프렛이면(예: D 코드) 보통 손가락을 따로 쓴다. 단, 최저음이 바레 위에 있으면 바레
  const firstSounding = frets.findIndex((f) => f != null);
  const isBarre = idx.length >= 3 || idx[1] - idx[0] === 1 || firstSounding === idx[0];
  return isBarre ? { fret: lo, from: idx[0] } : null;
}

export function ChordDiagram({
  voicing,
  tones,
  labels = 'interval',
  title,
  className,
}: {
  voicing: Voicing;
  tones: Tone[];
  labels?: LabelMode;
  title?: string;
  className?: string;
}) {
  const { frets } = voicing;
  const showFoot = labels !== 'none';
  const H = PY + GRID_H + (showFoot ? 22 : 8);
  const byPc = new Map(tones.map((t) => [t.pc, t]));
  const rootPc = tones[0].pc;
  const fr = frets.filter((f): f is number => f != null && f > 0);
  const maxF = fr.length ? Math.max(...fr) : 0;
  const base = maxF <= FRETS ? 1 : Math.min(...fr);
  // 왼손잡이는 6번줄이 오른쪽에 오도록 좌우를 뒤집는다 (글자는 뒤집지 않음)
  const lefty = useLefty();
  const x = (i: number) => PX + (lefty ? 5 - i : i) * SX;
  const barre = findBarre(frets);

  return (
    <svg
      viewBox={`0 0 ${W} ${H}`}
      role="img"
      aria-label={`${title ?? ''} ${voicing.code}`}
      className={`block h-auto w-full select-none ${className ?? ''}`}
    >
      {Array.from({ length: FRETS + 1 }, (_, k) => (
        <line key={k} x1={x(0)} x2={x(5)} y1={PY + k * SY} y2={PY + k * SY} className="stroke-fret" strokeWidth={1} />
      ))}
      {base === 1 ? (
        <rect x={PX - 1} y={PY - 3} width={SX * 5 + 2} height={4} rx={1} className="fill-foreground" />
      ) : (
        <text x={PX - 8} y={PY + SY / 2 + 3.5} textAnchor="end" className="fill-muted text-[9px] font-bold">
          {base}fr
        </text>
      )}
      {frets.map((_, i) => (
        <line
          key={i}
          x1={x(i)}
          x2={x(i)}
          y1={PY}
          y2={PY + GRID_H}
          className="stroke-string"
          strokeWidth={(1.7 - i * 0.18).toFixed(2)}
        />
      ))}
      {barre && (
        <rect
          x={Math.min(x(barre.from), x(5)) - R}
          y={PY + (barre.fret - base + 0.5) * SY - R}
          width={Math.abs(x(5) - x(barre.from)) + 2 * R}
          height={2 * R}
          rx={R}
          className="fill-foreground"
        />
      )}
      {frets.map((f, i) => {
        const cx = x(i);
        if (f == null) {
          const y = PY - 11;
          return (
            <path
              key={i}
              d={`M${cx - 3.5} ${y - 3.5}L${cx + 3.5} ${y + 3.5}M${cx + 3.5} ${y - 3.5}L${cx - 3.5} ${y + 3.5}`}
              className="stroke-muted"
              strokeWidth={1.4}
              strokeLinecap="round"
            />
          );
        }
        const pc = (TUNING[i] + f) % 12;
        const tone = byPc.get(pc);
        const isRoot = pc === rootPc;
        const label = !tone ? '' : labels === 'interval' ? tone.label : labels === 'note' ? pretty(tone.name) : '';
        const cy = PY + (f - base + 0.5) * SY;
        return (
          <g key={i}>
            {f === 0 ? (
              <circle
                cx={cx}
                cy={PY - 11}
                r={4.2}
                fill="none"
                strokeWidth={1.4}
                className={isRoot ? 'stroke-accent' : 'stroke-foreground'}
              />
            ) : (
              <>
                <circle cx={cx} cy={cy} r={R} className={isRoot ? 'fill-accent' : 'fill-foreground'} />
                {label && (
                  <text x={cx} y={cy + 2.8} textAnchor="middle" className="fill-background text-[7.5px] font-bold">
                    {label}
                  </text>
                )}
              </>
            )}
            {showFoot && (
              <text
                x={cx}
                y={PY + GRID_H + 15}
                textAnchor="middle"
                className={`text-[8px] font-semibold ${isRoot ? 'fill-accent' : 'fill-muted'}`}
              >
                {label}
              </text>
            )}
          </g>
        );
      })}
    </svg>
  );
}
