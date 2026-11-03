import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './index.css';
import { App } from './App';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);

// 배포본에서만 오프라인 캐시를 켠다. 다른 탭 코드도 미리 받아 두어
// 인터넷이 끊겨도 모든 탭이 열리게 한다.
if (import.meta.env.PROD && 'serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    void navigator.serviceWorker.register('./sw.js');
    void navigator.serviceWorker.ready.then(async (reg) => {
      await Promise.all([
        import('./features/tuner/Tuner'),
        import('./features/songs/Songbook'),
        import('./features/chords/ChordLibrary'),
        import('./features/practice/Practice'),
      ]);
      // 지금까지 받은 스크립트·스타일을 워커에 알려 캐시에 담게 한다
      const urls = performance
        .getEntriesByType('resource')
        .map((r) => r.name)
        .filter((u) => u.startsWith(location.origin) && /\/assets\//.test(u));
      reg.active?.postMessage({ type: 'cache', urls });
    });
  });
}
