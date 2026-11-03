import { useEffect } from 'react';

// 자동 스크롤·반주 중에는 화면이 꺼지지 않게 한다 (지원하는 브라우저에서만)
export function useWakeLock(active: boolean) {
  useEffect(() => {
    if (!active || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    const request = async () => {
      try {
        const l = await navigator.wakeLock.request('screen');
        if (cancelled) void l.release();
        else lock = l;
      } catch {
        /* 배터리 절약 모드 등으로 거부될 수 있음 */
      }
    };
    // 다른 앱에 다녀오면 잠금이 풀리므로 다시 요청
    const onVisible = () => {
      if (document.visibilityState === 'visible') void request();
    };
    void request();
    document.addEventListener('visibilitychange', onVisible);
    return () => {
      cancelled = true;
      document.removeEventListener('visibilitychange', onVisible);
      void lock?.release();
    };
  }, [active]);
}
