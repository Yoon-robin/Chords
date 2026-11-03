import { useEffect, useState } from 'react';
import { SearchField, ToggleButton, ToggleButtonGroup } from '@heroui/react';
import { VoicingCard } from '../../components/ChordCard';
import type { LabelMode } from '../../components/ChordDiagram';
import { strum } from '../../lib/audio';
import { usePersistent } from '../../lib/storage';
import { chordName, chordTones, parseChord, pretty, QMAP, QUALITIES, ROOTS, voicings } from '../../lib/theory';

export function ChordLibrary() {
  const [root, setRoot] = usePersistent('chords.root', 0);
  const [qid, setQid] = usePersistent('chords.quality', '');
  const [labels, setLabels] = usePersistent<LabelMode>('chords.labels', 'interval');
  const [query, setQuery] = useState('');

  const q = QMAP[qid] ?? QMAP[''];
  const rootName = ROOTS[root];
  const name = chordName(rootName, q.id);
  const tones = chordTones(rootName, q.id);
  const list = voicings(root, q.id);
  const invalid = !!query.trim() && !parseChord(query);

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
      <div className="flex flex-wrap gap-1.5">
        {QUALITIES.map((x) => (
          <button key={x.id} type="button" title={x.name} onClick={() => setQid(x.id)} className={pill(x.id === q.id)}>
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
      </div>

      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
        {list.map((v) => (
          <VoicingCard key={v.code} voicing={v} name={name} rootName={rootName} qid={q.id} labels={labels} />
        ))}
      </div>
      <p className="hidden text-sm text-muted md:block">
        카드를 누르면 스트럼 · 키보드 ← → 루트, ↑ ↓ 종류, Space 재생
      </p>
    </div>
  );
}
