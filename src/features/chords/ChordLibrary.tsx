import { useEffect, useMemo, useRef, useState } from 'react';
import { SearchField, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { VoicingCard } from '../../components/ChordCard';
import type { LabelMode } from '../../components/ChordDiagram';
import { strum } from '../../lib/audio';
import { setLefty, useLefty } from '../../lib/lefty';
import { BookOpen } from 'lucide-react';
import { BUILTIN_SONGS } from '../../data/songs';
import { parseBody, songChords, type Song } from '../../lib/songs';
import { load, save, usePersistent } from '../../lib/storage';
import { chordName, chordTones, parseChord, parseSongChord, pretty, QMAP, QUALITIES, ROOTS, voicings } from '../../lib/theory';

// 코드 → 그 코드가 나오는 곡 (분수 코드는 베이스음을 빼고 같은 코드로 본다)
function songsByChord() {
  const map = new Map<string, Song[]>();
  for (const song of [...load<Song[]>('songs.mine', []), ...BUILTIN_SONGS]) {
    const keys = new Set(
      songChords(parseBody(song.body))
        .map(parseSongChord)
        .filter((c) => c != null)
        .map((c) => `${c.pc}|${c.qid}`),
    );
    for (const k of keys) map.set(k, [...(map.get(k) ?? []), song]);
  }
  return map;
}

// 송북 탭으로 가서 그 곡을 연다 (App이 탭을 바꾸고, 송북은 열 때 저장된 곡을 읽는다)
function openSong(id: string) {
  save('songs.open', id);
  window.dispatchEvent(new CustomEvent('chordbook:goto', { detail: 'songs' }));
}

export function ChordLibrary() {
  const [root, setRoot] = usePersistent('chords.root', 0);
  const [qid, setQid] = usePersistent('chords.quality', '');
  const [labels, setLabels] = usePersistent<LabelMode>('chords.labels', 'interval');
  const [query, setQuery] = useState('');
  const lefty = useLefty();

  const q = QMAP[qid] ?? QMAP[''];
  const rootName = ROOTS[root];
  const name = chordName(rootName, q.id);
  const tones = chordTones(rootName, q.id);
  const list = voicings(root, q.id);
  const invalid = !!query.trim() && !parseChord(query);
  const byChord = useMemo(songsByChord, []);
  const usedIn = byChord.get(`${root}|${q.id}`) ?? [];

  // ← → 루트, ↑ ↓ 종류, Space 재생
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if ((e.target as HTMLElement).closest('input, textarea, [role="button"], button')) return;
      const qi = QUALITIES.findIndex((x) => x.id === q.id);
      const n = QUALITIES.length;
      if (e.key === 'ArrowRight') setRoot((r) => (r + 1) % 12);
      else if (e.key === 'ArrowLeft') setRoot((r) => (r + 11) % 12);
      else if (e.key === 'ArrowDown') setQid(QUALITIES[(qi + 1) % n].id);
      else if (e.key === 'ArrowUp') setQid(QUALITIES[(qi + n - 1) % n].id);
      else if (e.key === ' ' && list[0]) strum(list[0].frets);
      else return;
      e.preventDefault();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [q.id, list, setRoot, setQid]);

  // 가로 스크롤 줄에서 고른 종류가 화면 밖에 있으면 보이게 옮긴다 (검색·키보드로 바꿨을 때)
  const qualityRow = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const row = qualityRow.current;
    const el = row?.querySelector<HTMLElement>(`[data-qid="${CSS.escape(q.id)}"]`);
    if (!row || !el || row.scrollWidth <= row.clientWidth) return;
    row.scrollTo({ left: el.offsetLeft - row.clientWidth / 2 + el.offsetWidth / 2, behavior: 'smooth' });
  }, [q.id]);

  const pill = (active: boolean) =>
    `rounded-xl border px-3 py-1.5 text-sm font-semibold transition active:scale-95 ${
      active ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface hover:border-accent'
    }`;

  return (
    <div className="flex flex-col gap-4">
      <SearchField
        value={query}
        onChange={(v) => {
          setQuery(v);
          const c = parseChord(v);
          if (c) {
            setRoot(c.pc);
            setQid(c.qid);
          }
        }}
        onSubmit={() => list[0] && strum(list[0].frets)}
        isInvalid={invalid}
        aria-label="코드 검색"
        fullWidth
      >
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="코드 검색 — Am7, F#m, Bbmaj7, Gsus4" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      <div className="grid grid-cols-6 gap-1.5 sm:grid-cols-12">
        {ROOTS.map((n, pc) => (
          <button key={n} type="button" onClick={() => setRoot(pc)} className={pill(pc === root)}>
            {pretty(n)}
          </button>
        ))}
      </div>
      {/* 휴대폰에서는 한 줄 가로 스크롤로 두어 다이어그램이 첫 화면에 보이게 한다 */}
      <div
        ref={qualityRow}
        className="no-scrollbar relative -mx-4 flex gap-1.5 overflow-x-auto px-4 sm:mx-0 sm:flex-wrap sm:overflow-visible sm:px-0"
      >
        {QUALITIES.map((x) => (
          <button
            key={x.id}
            type="button"
            title={x.name}
            data-qid={x.id}
            onClick={() => setQid(x.id)}
            className={`shrink-0 ${pill(x.id === q.id)}`}
          >
            {x.sym || 'Major'}
          </button>
        ))}
      </div>

      <div className="mt-3 flex flex-wrap items-center gap-x-6 gap-y-3">
        <div>
          <h1 className="text-5xl leading-none font-black tracking-tighter">{name}</h1>
          <p className="mt-1 text-muted">
            {pretty(rootName)} {q.name}
          </p>
        </div>
        <div className="flex flex-1 flex-wrap gap-2">
          {tones.map((t, i) => (
            <span
              key={t.label}
              className={`flex min-w-12 flex-col items-center rounded-xl px-2 py-1.5 ${i === 0 ? 'bg-accent/15' : 'bg-surface-secondary'}`}
            >
              <b className={`text-lg ${i === 0 ? 'text-accent' : ''}`}>{pretty(t.name)}</b>
              <span className="text-xs text-muted">{t.label}</span>
            </span>
          ))}
        </div>
        <ToggleButtonGroup
          selectionMode="single"
          disallowEmptySelection
          selectedKeys={[labels]}
          onSelectionChange={(keys) => setLabels([...keys][0] as LabelMode)}
          size="sm"
        >
          <ToggleButton id="interval">음정</ToggleButton>
          <ToggleButton id="note">
            <ToggleButtonGroup.Separator />
            음이름
          </ToggleButton>
          <ToggleButton id="none">
            <ToggleButtonGroup.Separator />
            숨김
          </ToggleButton>
        </ToggleButtonGroup>
        <ToggleButton size="sm" isSelected={lefty} onChange={setLefty} aria-label="왼손잡이 표시 (모든 다이어그램 좌우 반전)">
          왼손잡이
        </ToggleButton>
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((v) => (
          <VoicingCard key={v.code} voicing={v} name={name} rootName={rootName} qid={q.id} labels={labels} />
        ))}
      </div>

      {usedIn.length > 0 && (
        <section aria-label={`${name} 코드가 나오는 곡`}>
          <h2 className="mb-1.5 flex items-center gap-1.5 text-sm font-bold text-muted">
            <BookOpen className="size-4" />
            {name} 코드가 나오는 곡 {usedIn.length}개
          </h2>
          <div className="flex flex-wrap gap-2">
            {usedIn.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => openSong(s.id)}
                className="max-w-56 truncate rounded-xl border border-border bg-surface px-3 py-1.5 text-sm font-semibold transition hover:border-accent"
              >
                {s.title || '제목 없음'}
              </button>
            ))}
          </div>
        </section>
      )}
      <p className="hidden text-sm text-muted md:block">
        카드를 누르면 스트럼 · 키보드 ← → 루트, ↑ ↓ 종류, Space 재생
      </p>
    </div>
  );
}
