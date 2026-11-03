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
    void navigator.serviceWorker.register('./sw.js').then(() => {
      const prefetch = () => {
        void import('./features/tuner/Tuner');
        void import('./features/songs/Songbook');
        void import('./features/chords/ChordLibrary');
        void import('./features/practice/Practice');
      };
      if ('requestIdleCallback' in window) requestIdleCallback(prefetch);
      else setTimeout(prefetch, 1500);
    });
  });
}
