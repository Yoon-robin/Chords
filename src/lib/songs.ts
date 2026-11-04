// 송북 악보 형식
//   # Verse            → 구간 제목
//   > x2               → 메모
//   | G | D | Em C |   → 마디 단위 코드 진행
//   [G]Amazing [C]grace → 가사 위 코드
import { isChordToken, parseSongChord, transposeChord } from './theory';

export type TimeSig = '4/4' | '3/4' | '6/8';
export const TIME_SIGS: TimeSig[] = ['4/4', '3/4', '6/8'];

export type Song = {
  id: string;
  title: string;
  artist: string;
  key?: string;
  capo?: number;
  bpm?: number;
  time?: TimeSig;
  strum?: string;
  tags?: string[];
  builtin?: boolean;
  hasLyrics: boolean;
  body: string;
};

export type Segment = { chord?: string; text: string };
export type Line =
  | { kind: 'section'; name: string }
  | { kind: 'note'; text: string }
  | { kind: 'bars'; bars: string[][] }
  | { kind: 'lyric'; segments: Segment[] }
  | { kind: 'tab'; lines: string[] }
  | { kind: 'empty' };

const BAR_FILLERS = new Set(['%', '-', '/', '.', '(', ')', 'N.C.', 'NC', 'N.C', '*']);
const isRepeatMark = (t: string) => /^\(?x\d+\)?$/i.test(t) || /^\(?\d+x\)?$/i.test(t);

// 탭 악보 줄: e|---3---0---| 처럼 줄 이름 + 세로선 + 프렛 숫자
export const isTabLine = (line: string) =>
  /^\s*[A-Ga-g][#b]?\s*[|:][-\d|hpbrsvx/\\~()<>[\]=.^*+ ]{3,}$/.test(line) && /-{2,}|\d/.test(line);

function isBarLine(line: string) {
  if (!line.includes('|')) return false;
  const tokens = line.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.every((t) => isChordToken(t) || BAR_FILLERS.has(t) || isRepeatMark(t));
}

export function parseBody(body: string): Line[] {
  const out: Line[] = [];
  for (const raw of body.split(/\r?\n/)) {
    const line = raw.trimEnd();
    // 이어지는 탭 줄은 한 블록으로 묶는다
    if (isTabLine(line)) {
      const prev = out[out.length - 1];
      if (prev?.kind === 'tab') prev.lines.push(line);
      else out.push({ kind: 'tab', lines: [line] });
      continue;
    }
    out.push(parseLine(line));
  }
  return out;
}

function parseLine(line: string): Line {
  {
    if (!line.trim()) return { kind: 'empty' };
    if (line.startsWith('# ')) return { kind: 'section', name: line.slice(2).trim() };
    if (line.startsWith('> ')) return { kind: 'note', text: line.slice(2).trim() };
    if (isBarLine(line)) {
      const bars = line
        .split('|')
        .map((b) => b.trim().split(/\s+/).filter(Boolean))
        .filter((b) => b.length);
      return { kind: 'bars', bars };
    }
    const segments: Segment[] = [];
    const re = /\[([^\]]+)\]/g;
    let last = 0;
    let pending: string | undefined;
    for (let m = re.exec(line); m; m = re.exec(line)) {
      const text = line.slice(last, m.index);
      if (text || pending) segments.push({ chord: pending, text });
      pending = m[1];
      last = m.index + m[0].length;
    }
    segments.push({ chord: pending, text: line.slice(last) });
    return { kind: 'lyric', segments: segments.filter((s) => s.chord || s.text) };
  }
}

// 곡에 쓰인 코드 (등장 순서대로, 중복 제거)
export function songChords(lines: Line[]) {
  const seen = new Set<string>();
  const out: string[] = [];
  const add = (c?: string) => {
    if (c && isChordToken(c) && !seen.has(c)) {
      seen.add(c);
      out.push(c);
    }
  };
  for (const l of lines) {
    if (l.kind === 'bars') l.bars.flat().forEach(add);
    if (l.kind === 'lyric') l.segments.forEach((s) => add(s.chord));
  }
  return out;
}

export function transposeText(chord: string, semis: number, flats: boolean) {
  const c = parseSongChord(chord);
  return c ? transposeChord(c, semis, flats) : chord;
}

// 쉬운 코드: 텐션·7th·sus·베이스음을 빼고 기본 3화음으로 (Cmaj7 → C, Am7 → Am, G/B → G)
const SIMPLE: Record<string, string> = { m: 'm', m7: 'm', m6: 'm', m7b5: 'm', dim: 'dim', dim7: 'dim' };
export function simplifyChord(chord: string) {
  const c = parseSongChord(chord);
  return c ? c.rootName + (SIMPLE[c.qid] ?? '') : chord;
}

// ---------- 붙여넣기: "가사 위에 코드" 형식을 송북 형식으로 변환

const SECTION_WORDS =
  '(?:intro|verse|pre[- ]?chorus|chorus|bridge|outro|solo|interlude|instrumental|refrain|hook|coda|ending|riff|break|tag|인트로|전주|간주|후주|아웃트로|벌스|절|\\d+\\s*절|프리코러스|코러스|후렴|브릿지|브리지|엔딩)';
const SECTION_RE = new RegExp(`^\\s*[[(]?\\s*${SECTION_WORDS}(\\s*\\d+)?\\s*[\\])]?\\s*:?\\s*$`, 'i');
// "[Intro] Em7 G Dsus4", "[Verse 2]", "[Harmonica]"
const BRACKET_RE = /^\s*\[([^\]]+)\]\s*(.*)$/;
// "Chorus: G D Em C"
const LABEL_RE = new RegExp(`^\\s*(${SECTION_WORDS}(?:\\s*\\d+)?)\\s*:\\s*(.+)$`, 'i');

// 악보 머리말 (카포·키·템포·튜닝) 과 버릴 줄
const CAPO_RE = /^\s*(?:capo|카포)\s*[:-]?\s*(?:on\s*)?(\d+)/i;
const NO_CAPO_RE = /^\s*(?:capo|카포)\s*[:-]?\s*(?:no|none|없음|0\b)/i;
const KEY_RE = /^\s*(?:key|키)\s*[:-]\s*([A-G][#b]?m?)\b/i;
const BPM_RE = /^\s*(?:bpm|tempo|템포)\s*[:-]?\s*(\d{2,3})\b/i;
const TIME_RE = /^\s*(?:time(?:\s*signature)?|meter|박자)\s*[:-]?\s*(4\/4|3\/4|6\/8)\s*$/i;
const TUNING_RE = /^\s*(?:tuning|튜닝)\s*[:-]\s*(.+)$/i;
const DROP_RE = /^\s*(?:difficulty|author|chords|strumming|난이도|작성자)\s*:/i;

function isChordLine(line: string) {
  const tokens = line.replace(/\|/g, ' ').split(/\s+/).filter(Boolean);
  return tokens.length > 0 && tokens.some(isChordToken) && tokens.every((t) => isChordToken(t) || BAR_FILLERS.has(t) || isRepeatMark(t));
}

// "A" 한 단어만 있는 줄은 코드인지 영어 가사(관사 A)인지 모호하다.
// 바로 위가 코드 줄이면 그 아래 가사로 본다.
const isLoneA = (line: string) => /^\s*A\s*$/.test(line);

function mergeChordsIntoLyric(chordLine: string, lyric: string) {
  const marks: { pos: number; chord: string }[] = [];
  for (const m of chordLine.matchAll(/\S+/g)) {
    if (isChordToken(m[0])) marks.push({ pos: m.index ?? 0, chord: m[0] });
  }
  // 한글은 고정폭 글꼴에서 두 칸을 차지하므로 화면 열 → 문자 위치로 바꾼다
  const colToIndex = (col: number) => {
    let c = 0;
    for (let i = 0; i < lyric.length; i++) {
      if (c >= col) return i;
      c += /[ᄀ-ᇿ㄰-㆏가-힯　-〿＀-￯]/.test(lyric[i]) ? 2 : 1;
    }
    return lyric.length + Math.max(0, col - c);
  };
  let out = lyric;
  for (const { pos, chord } of [...marks].reverse()) {
    const idx = colToIndex(pos);
    if (idx > out.length) out = out.padEnd(idx, ' ');
    out = out.slice(0, idx) + `[${chord}]` + out.slice(idx);
  }
  return out;
}

// 코드만 있는 줄 → 마디 줄 (+ 반복 표시는 메모로)
function chordLineToBars(line: string) {
  const bars = line.includes('|')
    ? line.trim()
    : '| ' + line.trim().split(/\s+/).filter((t) => !isRepeatMark(t)).join(' | ') + ' |';
  const rep = line.split(/\s+/).find(isRepeatMark);
  return rep ? [bars, '> ' + rep.replace(/[()]/g, '')] : [bars];
}

export type ImportResult = {
  body: string;
  title?: string;
  artist?: string;
  capo?: number;
  key?: string;
  bpm?: number;
  time?: TimeSig;
};

// ChordPro 지시어 {name: value}
const DIRECTIVE_RE = /^\s*\{\s*([a-z_]+)\s*(?::\s*(.*?))?\s*\}\s*$/i;
// "Intro / Verse", "Chorus x2"처럼 구간 이름으로 시작하는 주석은 구간 제목으로
const SECTION_START_RE = new RegExp(`^\\s*${SECTION_WORDS}(?![a-z])`, 'i');
const SECTION_DIRECTIVES: Record<string, string> = {
  start_of_verse: 'Verse',
  sov: 'Verse',
  start_of_chorus: 'Chorus',
  soc: 'Chorus',
  start_of_bridge: 'Bridge',
  sob: 'Bridge',
};

// ChordPro 지시어 줄이면 처리하고 true
function chordProDirective(line: string, out: string[], meta: Omit<ImportResult, 'body'>) {
  const d = DIRECTIVE_RE.exec(line);
  if (!d) return false;
  const name = d[1].toLowerCase();
  const value = (d[2] ?? '').trim();
  if (name === 'title' || name === 't') meta.title = value;
  else if (name === 'artist' || name === 'subtitle' || name === 'st') meta.artist ??= value;
  else if (name === 'key') meta.key = value || undefined;
  else if (name === 'capo') meta.capo = Number(value) || undefined;
  else if (name === 'tempo') meta.bpm = Number(value) || undefined;
  else if (name === 'time' && (TIME_SIGS as string[]).includes(value)) meta.time = value as TimeSig;
  else if (name in SECTION_DIRECTIVES) out.push('# ' + (value || SECTION_DIRECTIVES[name]));
  else if (name === 'comment' || name === 'c') out.push(SECTION_START_RE.test(value) ? '# ' + value : '> ' + value);
  else if (['comment_italic', 'ci', 'comment_box', 'cb'].includes(name)) out.push('> ' + value);
  // end_of_*, start_of_tab 등 나머지는 버린다 (탭 줄은 따로 알아본다)
  return true;
}

export function importText(text: string): ImportResult {
  // 사이트 원본 마크업([ch]G[/ch], [tab]…[/tab])이 섞여 들어와도 처리
  const src = text
    .replace(/\[ch\](.*?)\[\/ch\]/g, '$1')
    .replace(/\[\/?tab\]/g, '')
    .replace(/\t/g, '    ')
    .split(/\r?\n/);
  const out: string[] = [];
  const meta: Omit<ImportResult, 'body'> = {};
  const isLyricCandidate = (l: string) =>
    !!l.trim() &&
    (isLoneA(l) || !isChordLine(l)) &&
    !isTabLine(l) &&
    !SECTION_RE.test(l) &&
    !BRACKET_RE.test(l) &&
    !DIRECTIVE_RE.test(l) &&
    !l.includes('[');

  for (let i = 0; i < src.length; i++) {
    const line = src[i].replace(/\s+$/, '');

    if (isTabLine(line)) {
      out.push(line.trim());
      continue;
    }

    if (chordProDirective(line, out, meta)) continue;

    // 머리말
    if (NO_CAPO_RE.test(line) || DROP_RE.test(line)) continue;
    const capo = CAPO_RE.exec(line);
    if (capo) {
      meta.capo = Number(capo[1]) || undefined;
      continue;
    }
    const key = KEY_RE.exec(line);
    if (key) {
      meta.key = key[1];
      continue;
    }
    const bpm = BPM_RE.exec(line);
    if (bpm) {
      meta.bpm = Number(bpm[1]);
      continue;
    }
    const time = TIME_RE.exec(line);
    if (time) {
      meta.time = time[1] as TimeSig;
      continue;
    }
    const tuning = TUNING_RE.exec(line);
    if (tuning) {
      if (!/^(standard|표준|e a d g b e)/i.test(tuning[1].trim())) out.push('> 튜닝: ' + tuning[1].trim());
      continue;
    }

    // 구간 제목 (뒤에 코드가 같이 올 수도 있다)
    const m = BRACKET_RE.exec(line);
    const header = m && !isChordToken(m[1].trim()) ? m : LABEL_RE.exec(line);
    if (header) {
      const [, name, rest] = header;
      out.push('# ' + name.trim());
      if (rest.trim()) out.push(...(isChordLine(rest) ? chordLineToBars(rest) : [rest.trim()]));
      continue;
    }
    if (SECTION_RE.test(line)) {
      out.push('# ' + line.replace(/[[\]():]/g, '').trim());
      continue;
    }

    if (line.trim() && isChordLine(line)) {
      const next = src[i + 1]?.replace(/\s+$/, '') ?? '';
      if (isLyricCandidate(next)) {
        out.push(mergeChordsIntoLyric(line, next));
        i++;
      } else {
        out.push(...chordLineToBars(line));
      }
      continue;
    }
    out.push(line);
  }
  return { ...meta, body: out.join('\n').replace(/\n{3,}/g, '\n\n').trim() };
}

// 내보내기: ChordPro 형식 (다른 코드 앱에서도 읽을 수 있다)
export function toChordPro(song: Song) {
  const head = [
    `{title: ${song.title || '제목 없음'}}`,
    song.artist && `{artist: ${song.artist}}`,
    song.key && `{key: ${song.key}}`,
    song.capo && `{capo: ${song.capo}}`,
    song.bpm && `{tempo: ${song.bpm}}`,
    song.time && song.time !== '4/4' && `{time: ${song.time}}`,
  ].filter(Boolean);
  const body: string[] = [];
  let inTab = false;
  for (const line of song.body.split(/\r?\n/)) {
    const tab = isTabLine(line);
    if (tab !== inTab) body.push(tab ? '{start_of_tab}' : '{end_of_tab}');
    inTab = tab;
    if (line.startsWith('# ')) body.push(`{comment: ${line.slice(2).trim()}}`);
    else if (line.startsWith('> ')) body.push(`{comment_italic: ${line.slice(2).trim()}}`);
    else body.push(line);
  }
  if (inTab) body.push('{end_of_tab}');
  return [...head, '', ...body].join('\n').trim() + '\n';
}

export const newId = () => Math.random().toString(36).slice(2, 10);
