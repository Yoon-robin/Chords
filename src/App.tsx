import { lazy, Suspense } from 'react';
import { Button, Tabs, useTheme } from '@heroui/react';
import { BookOpen, Gauge, Grid3x3, Metronome, Moon, Sun, TriangleAlert, X } from 'lucide-react';
import { AnimatePresence, motion } from 'motion/react';
import { usePersistent, useStorageError } from './lib/storage';

// 탭마다 따로 불러와 첫 화면을 가볍게 (처음 연 탭만 내려받음)
const Tuner = lazy(() => import('./features/tuner/Tuner').then((m) => ({ default: m.Tuner })));
const Songbook = lazy(() => import('./features/songs/Songbook').then((m) => ({ default: m.Songbook })));
const ChordLibrary = lazy(() => import('./features/chords/ChordLibrary').then((m) => ({ default: m.ChordLibrary })));
const Practice = lazy(() => import('./features/practice/Practice').then((m) => ({ default: m.Practice })));

const TABS = [
  { id: 'tuner', label: '튜너', icon: Gauge },
  { id: 'songs', label: '송북', icon: BookOpen },
  { id: 'chords', label: '코드', icon: Grid3x3 },
  { id: 'practice', label: '연습', icon: Metronome },
] as const;
type TabId = (typeof TABS)[number]['id'];

export function App() {
  const [tab, setTabState] = usePersistent<TabId>('tab', 'tuner');
  const setTab = (t: TabId) => {
    setTabState(t);
    window.scrollTo({ top: 0 });
  };
  const { resolvedTheme, setTheme } = useTheme('dark');
  const [storageFailed, dismissStorage] = useStorageError();

  return (
    <div className="min-h-dvh bg-background text-foreground">
      <header className="sticky top-0 z-30 border-b border-separator bg-background/80 backdrop-blur-xl">
        <div className="mx-auto flex max-w-5xl items-center justify-between gap-3 px-4 py-3">
          <div className="flex items-center gap-2">
            <svg viewBox="0 0 32 32" className="size-7 fill-accent" aria-hidden>
              <path d="M16 2C8 2 3 5.5 3 11c0 7 7 15 13 19 6-4 13-12 13-19 0-5.5-5-9-13-9z" />
            </svg>
            <span className="text-lg font-extrabold tracking-tight">코드북</span>
          </div>

          <Tabs selectedKey={tab} onSelectionChange={(k) => setTab(k as TabId)} className="hidden md:block">
            <Tabs.ListContainer>
              <Tabs.List aria-label="메뉴">
                {TABS.map(({ id, label, icon: Icon }) => (
                  <Tabs.Tab key={id} id={id}>
                    <span className="flex items-center gap-1.5 px-1">
                      <Icon className="size-4" />
                      {label}
                    </span>
                    <Tabs.Indicator />
                  </Tabs.Tab>
                ))}
              </Tabs.List>
            </Tabs.ListContainer>
          </Tabs>

          <Button
            isIconOnly
            variant="ghost"
            aria-label="테마 바꾸기"
            onPress={() => setTheme(resolvedTheme === 'dark' ? 'light' : 'dark')}
          >
            {resolvedTheme === 'dark' ? <Sun className="size-5" /> : <Moon className="size-5" />}
          </Button>
        </div>
      </header>

      <main className="mx-auto max-w-5xl px-4 pt-5 pb-28 md:pb-12">
        {storageFailed && (
          <div role="alert" className="mb-4 flex items-start gap-3 rounded-xl bg-danger/10 p-3 text-sm text-danger">
            <TriangleAlert className="mt-0.5 size-4 shrink-0" />
            <p className="flex-1">
              변경 내용을 기기에 저장하지 못했어요. 저장 공간이 부족하거나 사생활 보호 모드일 수 있습니다. 새로 고치기 전에
              악보를 따로 복사해 두세요.
            </p>
            <button type="button" aria-label="닫기" onClick={dismissStorage} className="rounded p-0.5 hover:bg-danger/15">
              <X className="size-4" />
            </button>
          </div>
        )}
        <AnimatePresence mode="wait">
          <motion.div
            key={tab}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.16 }}
          >
            <Suspense fallback={<div className="py-24 text-center text-sm text-muted">불러오는 중…</div>}>
              {tab === 'tuner' && <Tuner />}
              {tab === 'songs' && <Songbook />}
              {tab === 'chords' && <ChordLibrary />}
              {tab === 'practice' && <Practice />}
            </Suspense>
          </motion.div>
        </AnimatePresence>
      </main>

      {/* 모바일 하단 탭바 */}
      <nav className="safe-bottom fixed inset-x-0 bottom-0 z-30 border-t border-separator bg-background/90 backdrop-blur-xl md:hidden">
        <div className="mx-auto grid max-w-md grid-cols-4">
          {TABS.map(({ id, label, icon: Icon }) => {
            const active = tab === id;
            return (
              <button
                key={id}
                type="button"
                onClick={() => setTab(id)}
                aria-current={active ? 'page' : undefined}
                className={`flex flex-col items-center gap-0.5 py-2.5 text-[11px] font-semibold transition ${
                  active ? 'text-accent' : 'text-muted'
                }`}
              >
                <Icon className={`size-6 transition ${active ? 'scale-110' : ''}`} strokeWidth={active ? 2.4 : 1.8} />
                {label}
              </button>
            );
          })}
        </div>
      </nav>
    </div>
  );
}
