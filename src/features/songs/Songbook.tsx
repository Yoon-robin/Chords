import { useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { Button, Chip, SearchField } from '@heroui/react';
import { History, ListMusic, Plus, Star, Undo2 } from 'lucide-react';
import { BUILTIN_SONGS } from '../../data/songs';
import { usePersistent } from '../../lib/storage';
import { newId, parseBody, songChords, type Song } from '../../lib/songs';
import { pretty } from '../../lib/theory';
import { SongView } from './SongView';
import { SongEditor } from './SongEditor';
import { BackupPanel } from './BackupPanel';

const FILTERS = [
  { id: 'all', label: '전체' },
  { id: 'fav', label: '즐겨찾기' },
  { id: 'mine', label: '내 노래' },
  { id: 'lyrics', label: '가사 포함' },
  { id: 'easy', label: '입문' },
] as const;
type Filter = (typeof FILTERS)[number]['id'];

export function Songbook() {
  const [mine, setMine] = usePersistent<Song[]>('songs.mine', []);
  const [openId, setOpenIdState] = usePersistent<string | null>('songs.open', null);
  const [recent, setRecent] = usePersistent<string[]>('songs.recent', []);
  const [favs, setFavs] = usePersistent<string[]>('songs.fav', []);
  const isFav = (s: Song) => favs.includes(s.id);
  const toggleFav = (id: string) => setFavs((f) => (f.includes(id) ? f.filter((x) => x !== id) : [id, ...f]));
  // 곡을 열 때 목록 위치를 기억했다가 돌아오면 그 자리로
  const listScroll = useRef(0);
  const setOpenId = (id: string | null) => {
    if (id) {
      if (!openId) listScroll.current = window.scrollY;
      setRecent((r) => [id, ...r.filter((x) => x !== id)].slice(0, 6));
      window.scrollTo({ top: 0 });
    }
    setOpenIdState(id);
  };
  useLayoutEffect(() => {
    if (!openId) window.scrollTo({ top: listScroll.current });
  }, [openId]);
  const [query, setQuery] = useState('');
  const [filter, setFilter] = useState<Filter>('all');
  const [editing, setEditing] = useState<Song | null>(null);
  // 지운 곡은 잠시 기억해 두었다가 "되돌리기"로 원래 자리에 복구한다
  const [deleted, setDeleted] = useState<{ song: Song; index: number } | null>(null);
  useEffect(() => {
    if (!deleted) return;
    const id = setTimeout(() => setDeleted(null), 8000);
    return () => clearTimeout(id);
  }, [deleted]);
  const undoDelete = () => {
    if (!deleted) return;
    setMine((prev) => {
      const next = [...prev];
      next.splice(Math.min(deleted.index, next.length), 0, deleted.song);
      return next;
    });
    setDeleted(null);
  };

  const all = useMemo(() => [...mine, ...BUILTIN_SONGS], [mine]);
  const open = all.find((s) => s.id === openId) ?? null;

  const isMine = (s: Song) => mine.some((m) => m.id === s.id);
  const recentSongs = recent.map((id) => all.find((s) => s.id === id)).filter((s): s is Song => !!s);

  // 즐겨찾기한 곡을 맨 위로 (나머지는 원래 순서)
  const list = all
    .filter((s) => {
      const q = query.trim().toLowerCase();
      if (q && !`${s.title} ${s.artist} ${(s.tags ?? []).join(' ')}`.toLowerCase().includes(q)) return false;
      if (filter === 'fav') return isFav(s);
      if (filter === 'mine') return isMine(s);
      if (filter === 'lyrics') return s.hasLyrics;
      if (filter === 'easy') return s.tags?.includes('입문');
      return true;
    })
    .sort((a, b) => Number(isFav(b)) - Number(isFav(a)));

  const saveSong = (song: Song) => {
    setMine((prev) => {
      const i = prev.findIndex((s) => s.id === song.id);
      if (i < 0) return [song, ...prev];
      const next = [...prev];
      next[i] = song;
      return next;
    });
    setEditing(null);
    setOpenId(song.id);
  };

  const editor = editing && (
    <SongEditor song={editing} onCancel={() => setEditing(null)} onSave={saveSong} />
  );

  if (open) {
    const at = list.findIndex((s) => s.id === open.id);
    return (
      <>
        {/* 곡마다 새로 그려서 곡별 설정·재생 상태가 섞이지 않게 */}
        <SongView
          key={open.id}
          song={open}
          editable={isMine(open)}
          favorite={isFav(open)}
          onToggleFavorite={() => toggleFav(open.id)}
          prev={at > 0 ? list[at - 1] : null}
          next={at >= 0 ? (list[at + 1] ?? null) : null}
          onOpen={setOpenId}
          onBack={() => setOpenId(null)}
          onEdit={() =>
            setEditing(
              isMine(open)
                ? open
                : { ...open, id: newId(), builtin: false, title: open.title, tags: (open.tags ?? []).filter((t) => t !== '입문') },
            )
          }
          onDelete={() => {
            const index = mine.findIndex((s) => s.id === open.id);
            setDeleted({ song: open, index });
            setMine((prev) => prev.filter((s) => s.id !== open.id));
            setOpenId(null);
          }}
        />
        {editor}
      </>
    );
  }

  return (
    <div className="flex flex-col gap-4">
      <div className="flex items-end justify-between gap-3">
        <div>
          <h1 className="text-3xl font-extrabold tracking-tight">송북</h1>
          <p className="text-sm text-muted">곡 {all.length}개 · 코드를 누르면 소리가 나요</p>
        </div>
        <Button
          onPress={() =>
            setEditing({ id: newId(), title: '', artist: '', hasLyrics: true, body: '', tags: [] })
          }
        >
          <Plus className="size-4" />곡 추가
        </Button>
      </div>

      {deleted && (
        <div role="status" className="flex items-center gap-3 rounded-xl border border-border bg-surface-secondary px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate">지운 곡: {deleted.song.title || '제목 없음'}</span>
          <Button size="sm" variant="tertiary" onPress={undoDelete}>
            <Undo2 className="size-4" />
            되돌리기
          </Button>
        </div>
      )}

      <SearchField value={query} onChange={setQuery} aria-label="곡 검색" fullWidth>
        <SearchField.Group>
          <SearchField.SearchIcon />
          <SearchField.Input placeholder="제목, 가수, 장르로 검색" />
          <SearchField.ClearButton />
        </SearchField.Group>
      </SearchField>

      <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
        {FILTERS.map((f) => (
          <button
            key={f.id}
            type="button"
            onClick={() => setFilter(f.id)}
            className={`shrink-0 rounded-full border px-4 py-1.5 text-sm font-semibold transition ${
              filter === f.id ? 'border-accent bg-accent text-accent-foreground' : 'border-border bg-surface text-muted hover:text-foreground'
            }`}
          >
            {f.label}
          </button>
        ))}
      </div>

      {recentSongs.length > 0 && !query.trim() && filter === 'all' && (
        <section aria-label="최근 연 곡">
          <h2 className="mb-1.5 flex items-center gap-1.5 text-xs font-bold text-muted">
            <History className="size-3.5" />
            최근 연 곡
          </h2>
          <div className="no-scrollbar -mx-4 flex gap-2 overflow-x-auto px-4">
            {recentSongs.map((s) => (
              <button
                key={s.id}
                type="button"
                onClick={() => setOpenId(s.id)}
                className="flex max-w-44 shrink-0 flex-col rounded-xl border border-border bg-surface px-3 py-2 text-left transition hover:border-accent"
              >
                <span className="truncate text-sm font-bold">{s.title || '제목 없음'}</span>
                <span className="truncate text-xs text-muted">{s.artist}</span>
              </button>
            ))}
          </div>
        </section>
      )}

      {list.length === 0 ? (
        <div className="flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-14 text-center text-muted">
          <ListMusic className="size-8" />
          <p>
            {query.trim()
              ? '검색 결과가 없어요.'
              : filter === 'mine'
                ? '아직 추가한 곡이 없어요. 코드 악보를 붙여넣어 곡을 추가해 보세요.'
                : filter === 'fav'
                  ? '곡을 열고 별을 누르면 여기에 모여요.'
                  : '검색 결과가 없어요.'}
          </p>
        </div>
      ) : (
        <ul className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {list.map((s) => {
            const chords = songChords(parseBody(s.body));
            return (
              <li key={s.id}>
                <button
                  type="button"
                  onClick={() => setOpenId(s.id)}
                  className="group flex w-full flex-col gap-2 rounded-2xl border border-border bg-surface p-4 text-left shadow-sm transition hover:-translate-y-0.5 hover:border-accent"
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="min-w-0">
                      <div className="flex items-center gap-1.5 text-lg font-bold">
                        {isFav(s) && <Star className="size-4 shrink-0 fill-accent text-accent" aria-label="즐겨찾기" />}
                        <span className="truncate">{s.title || '제목 없음'}</span>
                      </div>
                      <div className="truncate text-sm text-muted">{s.artist}</div>
                    </div>
                    <div className="flex shrink-0 gap-1">
                      {isMine(s) && (
                        <Chip size="sm" color="accent" variant="soft">
                          내 노래
                        </Chip>
                      )}
                      {s.key && (
                        <Chip size="sm" variant="secondary">
                          키 {pretty(s.key)}
                        </Chip>
                      )}
                    </div>
                  </div>
                  <div className="flex flex-wrap gap-1.5">
                    {chords.slice(0, 8).map((c) => (
                      <span key={c} className="rounded-md bg-surface-secondary px-2 py-0.5 text-xs font-bold text-accent">
                        {pretty(c)}
                      </span>
                    ))}
                    {chords.length > 8 && <span className="text-xs text-muted">+{chords.length - 8}</span>}
                  </div>
                  <div className="flex gap-3 text-xs text-muted">
                    {s.capo ? <span>카포 {s.capo}</span> : null}
                    {s.bpm ? <span>♩ {s.bpm}</span> : null}
                    {s.time && s.time !== '4/4' ? <span>{s.time}</span> : null}
                    <span>{s.hasLyrics ? '가사 + 코드' : '코드 진행만'}</span>
                  </div>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      <p className="text-xs leading-relaxed text-muted">
        인기곡은 저작권 때문에 가사 없이 코드 진행만 들어 있어요. 곡을 열고 <b>편집</b>을 누르면 내 노래로 복사되고, 갖고 있는
        악보의 가사와 코드를 붙여넣어 완성할 수 있어요.
      </p>
      <BackupPanel mineCount={mine.length} />
      {editor}
    </div>
  );
}
