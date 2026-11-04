import { parseSongChord } from './theory';

export interface Tuning {
  id: string;
  name: string;
  midi: number[]; // 6번줄 → 1번줄
  // 악보에 흔히 적히는 다른 이름 (소문자, 공백 무시)
  aliases?: string[];
}

export const TUNINGS: Tuning[] = [
  { id: 'standard', name: '표준 (E A D G B E)', midi: [40, 45, 50, 55, 59, 64] },
  {
    id: 'half-down',
    name: '반음 내림 (E♭ 튜닝)',
    midi: [39, 44, 49, 54, 58, 63],
    aliases: ['반음내림', 'halfstepdown', 'halfstep', 'ebtuning', 'e♭tuning', 'ebstandard'],
  },
  {
    id: 'whole-down',
    name: '온음 내림 (D 튜닝)',
    midi: [38, 43, 48, 53, 57, 62],
    aliases: ['온음내림', 'wholestepdown', 'wholestep', 'dstandard'],
  },
  { id: 'drop-d', name: 'Drop D', midi: [38, 45, 50, 55, 59, 64], aliases: ['dropd', '드롭d', 'dadgbe'] },
  { id: 'drop-c', name: 'Drop C', midi: [36, 43, 48, 53, 57, 62], aliases: ['dropc', '드롭c'] },
  { id: 'open-g', name: 'Open G', midi: [38, 43, 50, 55, 59, 62], aliases: ['openg', '오픈g', 'dgdgbd'] },
  { id: 'open-d', name: 'Open D', midi: [38, 45, 50, 54, 57, 62], aliases: ['opend', '오픈d', 'dadf#ad'] },
  { id: 'open-e', name: 'Open E', midi: [40, 47, 52, 56, 59, 64], aliases: ['opene', '오픈e'] },
  { id: 'open-c', name: 'Open C', midi: [36, 43, 48, 55, 60, 64], aliases: ['openc', '오픈c', 'cgcgce'] },
  { id: 'dadgad', name: 'DADGAD', midi: [38, 45, 50, 55, 57, 62], aliases: ['dadgad'] },
];

// 악보 메모("튜닝: Drop D", "Tuning: Eb Ab Db Gb Bb Eb")에서 표준이 아닌 튜닝을 찾는다
export function matchTuning(text: string): Tuning | null {
  const flat = text.toLowerCase().replace(/\s+/g, '');
  // 긴 별칭부터 (wholestepdown 이 wholestep 보다 먼저)
  const byAlias = TUNINGS.flatMap((t) => (t.aliases ?? []).map((a) => [a, t] as const)).sort(
    (a, b) => b[0].length - a[0].length,
  );
  for (const [a, t] of byAlias) if (flat.includes(a)) return t;

  // 여섯 줄 음이름이 그대로 적힌 경우
  const notes = text.replace(/♯/g, '#').replace(/♭/g, 'b').match(/(?<![A-Za-z])[A-G][#b]?(?![A-Za-z#])/g);
  if (notes && notes.length >= 6) {
    const pcs = notes.slice(0, 6).map((n) => parseSongChord(n)!.pc);
    const t = TUNINGS.find((t) => t.midi.every((m, i) => m % 12 === pcs[i]));
    if (t && t.id !== 'standard') return t;
  }
  return null;
}
