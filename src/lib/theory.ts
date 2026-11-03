// 음악 이론 + 기타 보이싱 생성

export type Fret = number | null;
export type Quality = { id: string; sym: string; name: string; iv: number[]; lb: string[]; dg: number[] };
export type Tone = { pc: number; name: string; label: string };
export type Voicing = { frets: Fret[]; shape: string | null; code: string; position: string };

const LETTERS = ['C', 'D', 'E', 'F', 'G', 'A', 'B'];
const LETTER_PC = [0, 2, 4, 5, 7, 9, 11];

// 인덱스 = pitch class. 기타에서 흔히 쓰는 표기
export const ROOTS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
export const FLAT_ROOTS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];
const MAJOR_KEYS = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'Ab', 'A', 'Bb', 'B'];
const MINOR_KEYS = ['C', 'C#', 'D', 'Eb', 'E', 'F', 'F#', 'G', 'G#', 'A', 'Bb', 'B'];

// 표준 튜닝 MIDI (6번줄 → 1번줄)
export const TUNING = [40, 45, 50, 55, 59, 64];

export const QUALITIES: Quality[] = [
  { id: '', sym: '', name: '메이저', iv: [0, 4, 7], lb: ['R', '3', '5'], dg: [1, 3, 5] },
  { id: 'm', sym: 'm', name: '마이너', iv: [0, 3, 7], lb: ['R', '♭3', '5'], dg: [1, 3, 5] },
  { id: '7', sym: '7', name: '세븐', iv: [0, 4, 7, 10], lb: ['R', '3', '5', '♭7'], dg: [1, 3, 5, 7] },
  { id: 'maj7', sym: 'maj7', name: '메이저 세븐', iv: [0, 4, 7, 11], lb: ['R', '3', '5', '7'], dg: [1, 3, 5, 7] },
  { id: 'm7', sym: 'm7', name: '마이너 세븐', iv: [0, 3, 7, 10], lb: ['R', '♭3', '5', '♭7'], dg: [1, 3, 5, 7] },
  { id: '6', sym: '6', name: '식스', iv: [0, 4, 7, 9], lb: ['R', '3', '5', '6'], dg: [1, 3, 5, 6] },
  { id: 'm6', sym: 'm6', name: '마이너 식스', iv: [0, 3, 7, 9], lb: ['R', '♭3', '5', '6'], dg: [1, 3, 5, 6] },
  { id: 'sus2', sym: 'sus2', name: '서스투', iv: [0, 2, 7], lb: ['R', '2', '5'], dg: [1, 2, 5] },
  { id: 'sus4', sym: 'sus4', name: '서스포', iv: [0, 5, 7], lb: ['R', '4', '5'], dg: [1, 4, 5] },
  { id: '7sus4', sym: '7sus4', name: '세븐 서스포', iv: [0, 5, 7, 10], lb: ['R', '4', '5', '♭7'], dg: [1, 4, 5, 7] },
  { id: 'add9', sym: 'add9', name: '애드나인', iv: [0, 4, 7, 2], lb: ['R', '3', '5', '9'], dg: [1, 3, 5, 2] },
  { id: '9', sym: '9', name: '나인스', iv: [0, 4, 7, 10, 2], lb: ['R', '3', '5', '♭7', '9'], dg: [1, 3, 5, 7, 2] },
  { id: 'dim', sym: 'dim', name: '디미니쉬', iv: [0, 3, 6], lb: ['R', '♭3', '♭5'], dg: [1, 3, 5] },
  { id: 'dim7', sym: 'dim7', name: '디미니쉬 세븐', iv: [0, 3, 6, 9], lb: ['R', '♭3', '♭5', '𝄫7'], dg: [1, 3, 5, 7] },
  { id: 'm7b5', sym: 'm7♭5', name: '하프 디미니쉬', iv: [0, 3, 6, 10], lb: ['R', '♭3', '♭5', '♭7'], dg: [1, 3, 5, 7] },
  { id: 'aug', sym: 'aug', name: '어그먼트', iv: [0, 4, 8], lb: ['R', '3', '♯5'], dg: [1, 3, 5] },
];
export const QMAP: Record<string, Quality> = Object.fromEntries(QUALITIES.map((q) => [q.id, q]));

const ALIASES: Record<string, string> = {
  '': '', M: '', maj: '', major: '',
  m: 'm', min: 'm', minor: 'm', '-': 'm',
  '7': '7', dom7: '7',
  maj7: 'maj7', M7: 'maj7', ma7: 'maj7', 'Δ': 'maj7', 'Δ7': 'maj7',
  m7: 'm7', min7: 'm7', '-7': 'm7',
  '6': '6', m6: 'm6', min6: 'm6',
  sus2: 'sus2', '2': 'sus2',
  sus4: 'sus4', sus: 'sus4', '4': 'sus4',
  '7sus4': '7sus4', '7sus': '7sus4',
  add9: 'add9', add2: 'add9',
  '9': '9',
  dim: 'dim', o: 'dim', '°': 'dim',
  dim7: 'dim7', o7: 'dim7', '°7': 'dim7',
  m7b5: 'm7b5', 'm7-5': 'm7b5', 'ø': 'm7b5', 'ø7': 'm7b5',
  aug: 'aug', '+': 'aug',
};

// 다이어그램이 없는 확장 코드는 가장 가까운 기본 코드로 보여준다
const APPROX: Record<string, string> = {
  m9: 'm7', m11: 'm7', m13: 'm7', maj9: 'maj7', M9: 'maj7', maj13: 'maj7',
  '7#9': '7', '7b9': '7', '7b5': '7', '13': '7', '11': '7sus4', '9sus4': '7sus4', '7sus2': 'sus2',
  '6/9': '6', '69': '6', '6add9': '6', 'm6/9': 'm6',
  '5': '', add4: '', add11: '', madd9: 'm', 'm(add9)': 'm', madd11: 'm',
  mmaj7: 'm', mM7: 'm', 'm(maj7)': 'm', aug7: 'aug', '+7': 'aug', '7#5': 'aug', dim9: 'dim7',
};

const accStr = (a: number) => (a > 0 ? '#'.repeat(a) : 'b'.repeat(-a));

function parseNote(s: string) {
  const m = /^([A-Ga-g])([#b]{0,2})$/.exec(s);
  if (!m) return null;
  const li = LETTERS.indexOf(m[1].toUpperCase());
  let acc = 0;
  for (const c of m[2]) acc += c === '#' ? 1 : -1;
  return { li, acc, pc: (((LETTER_PC[li] + acc) % 12) + 12) % 12 };
}

// 루트 철자 기준으로 도수에 맞는 음이름 (예: F# 메이저의 3음 → A#)
function spell(rootName: string, semis: number, degree: number) {
  const r = parseNote(rootName)!;
  const li = (r.li + degree - 1) % 7;
  const target = (r.pc + semis) % 12;
  let acc = (((target - LETTER_PC[li]) % 12) + 12) % 12;
  if (acc > 6) acc -= 12;
  return LETTERS[li] + accStr(acc);
}

export const pretty = (name: string) =>
  name
    .replace(/##/g, '𝄪')
    .replace(/#/g, '♯')
    .replace(/([A-G])bb/g, '$1𝄫')
    .replace(/([A-G])b/g, '$1♭');

export const chordName = (rootName: string, qid: string) => pretty(rootName) + QMAP[qid].sym;

export function chordTones(rootName: string, qid: string): Tone[] {
  const q = QMAP[qid];
  const root = parseNote(rootName)!;
  return q.iv.map((s, i) => ({ pc: (root.pc + s) % 12, name: spell(rootName, s, q.dg[i]), label: q.lb[i] }));
}

const normalize = (s: string) => s.trim().replace(/♯/g, '#').replace(/♭/g, 'b');

// "Am7", "C#maj7", "Bbm7b5" → { pc, qid }
export function parseChord(input: string) {
  const m = /^([A-Ga-g])([#b]?)(.*)$/.exec(normalize(input));
  if (!m) return null;
  const note = parseNote(m[1] + m[2])!;
  const rest = m[3].trim();
  const qid = rest in ALIASES ? ALIASES[rest] : ALIASES[rest.toLowerCase()];
  if (qid === undefined) return null;
  return { pc: note.pc, qid };
}

// 악보 속 코드 표기 (G/B, Em9, D7#9 …) 해석
export type SongChord = {
  text: string;
  rootName: string;
  pc: number;
  rest: string;
  qid: string;
  approx: boolean;
  bass?: { name: string; pc: number };
};

export function parseSongChord(token: string): SongChord | null {
  // 6/9는 분수 코드가 아니라 코드 종류 이름이므로 / 를 먼저 감춘다
  const m = /^([A-G])([#b]?)([^/\s]*)(?:\/([A-G][#b]?))?$/.exec(normalize(token).replace(/6\/9/g, '6~9'));
  if (!m) return null;
  const rootName = m[1] + m[2];
  const rest = m[3].replace(/6~9/g, '6/9');
  let qid: string | undefined = rest in ALIASES ? ALIASES[rest] : ALIASES[rest.toLowerCase()];
  let approx = false;
  if (qid === undefined) {
    qid = APPROX[rest] ?? APPROX[rest.toLowerCase()];
    if (qid === undefined) {
      // 처음 보는 표기는 앞부분으로 추정 (예: m7(11) → m7)
      if (/^(maj|M)7?/.test(rest)) qid = 'maj7';
      else if (/^m7/.test(rest)) qid = 'm7';
      else if (/^m/.test(rest)) qid = 'm';
      else if (/^7/.test(rest)) qid = '7';
      else if (/^\(|^add|^\d/.test(rest)) qid = '';
      else return null;
    }
    approx = true;
  }
  const bassName = m[4];
  return {
    text: token,
    rootName,
    pc: parseNote(rootName)!.pc,
    rest,
    qid,
    approx,
    bass: bassName ? { name: bassName, pc: parseNote(bassName)!.pc } : undefined,
  };
}

export const isChordToken = (t: string) => parseSongChord(t) !== null;

export const mod12 = (n: number) => ((n % 12) + 12) % 12;

export function transposeChord(c: SongChord, semis: number, flats = false) {
  if (!semis) return c.text;
  const names = flats ? FLAT_ROOTS : ROOTS;
  const root = names[mod12(c.pc + semis)];
  const bass = c.bass ? '/' + names[mod12(c.bass.pc + semis)] : '';
  return root + c.rest + bass;
}

// ---------- 보이싱

const OPEN_LIB: Record<string, string[]> = {
  C: ['x32010'], Cmaj7: ['x32000'], C7: ['x32310'], Cadd9: ['x32030'], Csus2: ['x30013'],
  Csus4: ['x33011'], C6: ['x32210'], Caug: ['x32110'],
  D: ['xx0232'], Dm: ['xx0231'], D7: ['xx0212'], Dmaj7: ['xx0222'], Dm7: ['xx0211'],
  Dsus2: ['xx0230'], Dsus4: ['xx0233'], D6: ['xx0202'], Dm6: ['xx0201'], D7sus4: ['xx0213'],
  Dm7b5: ['xx0111'],
  E: ['022100'], Em: ['022000'], E7: ['020100', '022130'], Emaj7: ['021100'], Em7: ['022030', '020000'],
  Esus2: ['024400'], Esus4: ['022200'], E7sus4: ['020200'], E6: ['022120'], Em6: ['022020'],
  Eadd9: ['024100'], E9: ['020102'],
  Fmaj7: ['xx3210'], Fadd9: ['xx3213'],
  G: ['320003', '320033'], G7: ['320001'], Gmaj7: ['320002'], G6: ['320000'], Gsus4: ['330013'],
  Gadd9: ['320203'],
  A: ['x02220'], Am: ['x02210'], A7: ['x02020'], Amaj7: ['x02120'], Am7: ['x02010'],
  Asus2: ['x02200'], Asus4: ['x02230'], A7sus4: ['x02030'], A6: ['x02222'], Am6: ['x02212'],
  Aadd9: ['x02420'], Am7b5: ['x01013'],
  B7: ['x21202'], Bm7: ['x20202'],
};
const OPEN: Record<string, string[]> = {};
for (const [name, list] of Object.entries(OPEN_LIB)) {
  const c = parseChord(name)!;
  OPEN[`${c.pc}|${c.qid}`] = list;
}

// 이동 가능한 폼: 루트 줄 프렛 기준 오프셋 (null = 뮤트)
const SHAPES: Record<string, { string: number; q: Record<string, Fret[]> }> = {
  E: {
    string: 0,
    q: {
      '': [0, 2, 2, 1, 0, 0], m: [0, 2, 2, 0, 0, 0], '7': [0, 2, 0, 1, 0, 0],
      maj7: [0, null, 1, 1, 0, null], m7: [0, 2, 0, 0, 0, 0], '6': [0, 2, 2, 1, 2, 0],
      m6: [0, 2, 2, 0, 2, 0], sus4: [0, 2, 2, 2, 0, 0], '7sus4': [0, 2, 0, 2, 0, 0],
      add9: [0, 2, 4, 1, 0, 0], '9': [0, null, 0, 1, 0, 2], dim: [0, 1, 2, 0, null, null],
      dim7: [0, null, -1, 0, -1, null], m7b5: [0, null, 0, 0, -1, null], aug: [0, 3, 2, 1, 1, 0],
    },
  },
  A: {
    string: 1,
    q: {
      '': [null, 0, 2, 2, 2, 0], m: [null, 0, 2, 2, 1, 0], '7': [null, 0, 2, 0, 2, 0],
      maj7: [null, 0, 2, 1, 2, 0], m7: [null, 0, 2, 0, 1, 0], '6': [null, 0, 2, 2, 2, 2],
      m6: [null, 0, -2, -1, -2, null], sus2: [null, 0, 2, 2, 0, 0], sus4: [null, 0, 2, 2, 3, 0],
      '7sus4': [null, 0, 2, 0, 3, 0], add9: [null, 0, -1, -3, 0, null], '9': [null, 0, -1, 0, 0, 0],
      dim: [null, 0, 1, 2, 1, null], dim7: [null, 0, 1, -1, 1, null], m7b5: [null, 0, 1, 0, 1, null],
      aug: [null, 0, -1, -2, -2, null],
    },
  },
  D: {
    string: 2,
    q: {
      '': [null, null, 0, 2, 3, 2], m: [null, null, 0, 2, 3, 1], '7': [null, null, 0, 2, 1, 2],
      maj7: [null, null, 0, 2, 2, 2], m7: [null, null, 0, 2, 1, 1], '6': [null, null, 0, 2, 0, 2],
      m6: [null, null, 0, 2, 0, 1], sus2: [null, null, 0, 2, 3, 0], sus4: [null, null, 0, 2, 3, 3],
      '7sus4': [null, null, 0, 2, 1, 3], dim: [null, null, 0, 1, 3, 1], dim7: [null, null, 0, 1, 0, 1],
      m7b5: [null, null, 0, 1, 1, 1], aug: [null, null, 0, 3, 3, 2],
    },
  },
};

const MAX_FRET = 15;
const fretted = (frets: Fret[]) => frets.filter((f): f is number => f != null && f > 0);
const sounding = (frets: Fret[]) => frets.filter((f): f is number => f != null);
const minFret = (frets: Fret[]) => {
  const fr = fretted(frets);
  return fr.length ? Math.min(...fr) : 0;
};
const parseFrets = (s: string): Fret[] => [...s].map((c) => (c === 'x' ? null : Number(c)));
const fretsToString = (frets: Fret[]) =>
  frets.map((f) => (f == null ? 'x' : f)).join(frets.some((f) => f != null && f > 9) ? '-' : '');

// 루트가 최저음이고, 코드 구성음만 울리며, 필수음(4화음 이상이면 5음 제외)을 모두 포함하는지
function isValid(frets: Fret[], pc: number, q: Quality) {
  const notes = frets.map((f, i) => (f == null ? null : (TUNING[i] + f) % 12)).filter((x): x is number => x != null);
  if (notes.length < 3 || notes[0] !== pc) return false;
  const tones = new Set(q.iv.map((i) => (pc + i) % 12));
  if (notes.some((x) => !tones.has(x))) return false;
  const essential = q.iv.length > 3 ? q.iv.filter((i) => i !== 7) : q.iv;
  if (essential.some((i) => !notes.includes((pc + i) % 12))) return false;
  const fr = fretted(frets);
  return !fr.length || Math.max(...fr) - Math.min(...fr) <= 4;
}

const voicingCache = new Map<string, Voicing[]>();

export function voicings(pc: number, qid: string): Voicing[] {
  const cacheKey = `${pc}|${qid}`;
  const hit = voicingCache.get(cacheKey);
  if (hit) return hit;

  const q = QMAP[qid];
  const out: Voicing[] = [];
  const seen = new Set<string>();
  const add = (frets: Fret[], fromLib: boolean, shape: string | null) => {
    const key = frets.join(',');
    if (seen.has(key) || !isValid(frets, pc, q)) return;
    seen.add(key);
    const isOpen = fromLib || (frets.includes(0) && Math.max(...sounding(frets)) <= 4);
    out.push({ frets, shape, code: fretsToString(frets), position: isOpen ? '오픈' : `${minFret(frets)}프렛` });
  };

  for (const s of OPEN[cacheKey] || []) add(parseFrets(s), true, null);

  const gen: { frets: Fret[]; shapeName: string }[] = [];
  for (const [shapeName, shape] of Object.entries(SHAPES)) {
    const offs = shape.q[qid];
    if (!offs) continue;
    const r = (pc - (TUNING[shape.string] % 12) + 12) % 12;
    for (const base of [r, r + 12]) {
      const frets = offs.map((o) => (o == null ? null : base + o));
      if (frets.some((f) => f != null && f < 0)) continue;
      if (Math.max(...sounding(frets)) > MAX_FRET) continue;
      gen.push({ frets, shapeName });
    }
  }
  gen.sort((a, b) => minFret(a.frets) - minFret(b.frets));
  for (const g of gen) add(g.frets, false, `${g.shapeName}폼`);

  voicingCache.set(cacheKey, out);
  return out;
}

// 분수 코드(D/F#, G/B, C/G …): 기본 보이싱의 아래쪽 줄을 베이스음으로 바꿔서 만든다
export function slashVoicings(pc: number, qid: string, bassPc: number): Voicing[] {
  const q = QMAP[qid];
  const tones = new Set([...q.iv.map((i) => (pc + i) % 12), bassPc]);
  const essential = (q.iv.length > 3 ? q.iv.filter((i) => i !== 7) : q.iv).filter((i) => (pc + i) % 12 !== bassPc);
  const out: Voicing[] = [];
  const seen = new Set<string>();

  for (const base of voicings(pc, qid)) {
    const fr = fretted(base.frets);
    const isOpen = base.frets.includes(0) && Math.max(...sounding(base.frets)) <= 4;
    for (let s = 0; s < 4; s++) {
      // 이 줄에서 베이스음을 낼 수 있는 프렛 중 손 모양 안에 들어오는 것
      for (const f of [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].filter((x) => mod12(TUNING[s] + x) === bassPc)) {
        const fits =
          f === 0
            ? isOpen || !fr.length
            : (fr.length ? Math.max(...fr, f) - Math.min(...fr, f) <= 4 : f <= 4) && !(isOpen && f > 4);
        if (!fits) continue;
        const frets = base.frets.map((x, i) => (i < s ? null : i === s ? f : x));
        const notes = frets
          .map((x, i) => (x == null ? null : mod12(TUNING[i] + x)))
          .filter((x): x is number => x != null);
        if (notes.length < 3 || notes[0] !== bassPc) continue;
        if (notes.some((n) => !tones.has(n))) continue;
        if (essential.some((i) => !notes.includes((pc + i) % 12))) continue;
        const key = frets.join(',');
        if (seen.has(key)) continue;
        seen.add(key);
        out.push({ ...base, frets, code: fretsToString(frets), position: isOpen ? '오픈' : `${minFret(frets)}프렛` });
      }
    }
  }
  return out;
}

// 운지 → 실제 울리는 MIDI 음 (카포·조옮김 반음 수를 더할 수 있음)
export const fretsToMidi = (frets: Fret[], transpose = 0) =>
  frets.map((f, i) => (f == null ? null : TUNING[i] + f + transpose));

// 베이스음 기준 음정 이름 (분수 코드의 코드 밖 베이스음 표시에 사용)
// 8분음표 아르페지오: 1박은 베이스, 나머지는 소리 나는 높은 줄 세 개를 오르내린다
// (뮤트된 줄은 건너뛰므로 D나 C 코드에서도 빈 박이 생기지 않음)
const ARP_ORDER = [0, 1, 2, 1, 0, 1, 0];
export function arpString(frets: Fret[], step: number): number | null {
  const sounding = frets.map((f, i) => (f == null ? -1 : i)).filter((i) => i >= 0);
  if (!sounding.length) return null;
  if (step % 8 === 0) return sounding[0];
  const upper = sounding.slice(1).slice(-3);
  if (!upper.length) return sounding[0];
  return upper[Math.min(upper.length - 1, ARP_ORDER[(step % 8) - 1])];
}

export const INTERVAL_LABELS =['R', '♭9', '9', '♭3', '3', '4', '♭5', '5', '♭6', '6', '♭7', '7'];

// ---------- 키 / 다이아토닉

export type Mode = 'major' | 'minor';

export const SCALES: Record<Mode, {
  iv: number[]; triads: string[]; sevenths: string[]; roman: string[]; roman7: string[]; keys: string[];
}> = {
  major: {
    iv: [0, 2, 4, 5, 7, 9, 11],
    triads: ['', 'm', 'm', '', '', 'm', 'dim'],
    sevenths: ['maj7', 'm7', 'm7', 'maj7', '7', 'm7', 'm7b5'],
    roman: ['I', 'ii', 'iii', 'IV', 'V', 'vi', 'vii°'],
    roman7: ['Imaj7', 'ii7', 'iii7', 'IVmaj7', 'V7', 'vi7', 'viiø7'],
    keys: MAJOR_KEYS,
  },
  minor: {
    iv: [0, 2, 3, 5, 7, 8, 10],
    triads: ['m', 'dim', '', 'm', 'm', '', ''],
    sevenths: ['m7', 'm7b5', 'maj7', 'm7', 'm7', 'maj7', '7'],
    roman: ['i', 'ii°', 'III', 'iv', 'v', 'VI', 'VII'],
    roman7: ['i7', 'iiø7', 'IIImaj7', 'iv7', 'v7', 'VImaj7', 'VII7'],
    keys: MINOR_KEYS,
  },
};

export type DiatonicChord = { degree: number; roman: string; rootName: string; pc: number; qid: string; name: string };

export function diatonic(keyPc: number, mode: Mode, sevenths: boolean): DiatonicChord[] {
  const sc = SCALES[mode];
  const keyName = sc.keys[keyPc];
  return sc.iv.map((s, i) => {
    const rootName = spell(keyName, s, i + 1);
    const qid = (sevenths ? sc.sevenths : sc.triads)[i];
    return {
      degree: i,
      roman: (sevenths ? sc.roman7 : sc.roman)[i],
      rootName,
      pc: (keyPc + s) % 12,
      qid,
      name: chordName(rootName, qid),
    };
  });
}

// ---------- 음 높이

export const NOTE_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
export const midiToFreq = (midi: number, a4 = 440) => a4 * Math.pow(2, (midi - 69) / 12);
export const freqToMidi = (f: number, a4 = 440) => 69 + 12 * Math.log2(f / a4);
export const midiName = (midi: number) => NOTE_NAMES[((midi % 12) + 12) % 12] + (Math.floor(midi / 12) - 1);
