import { useSyncExternalStore } from 'react';
import { load, save } from './storage';

// 왼손잡이 표시: 화면의 모든 코드 다이어그램이 같이 바뀌도록 하나의 값을 함께 구독한다
let lefty = load('lefty', false);
const listeners = new Set<() => void>();

export function setLefty(v: boolean) {
  lefty = v;
  save('lefty', v);
  listeners.forEach((l) => l());
}

export function useLefty() {
  return useSyncExternalStore(
    (l) => {
      listeners.add(l);
      return () => listeners.delete(l);
    },
    () => lefty,
  );
}
