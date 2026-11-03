import { describe, expect, it } from 'vitest';
import { detectPitch } from './pitch';
import { createPitchTracker } from './pitchTracker';

const SR = 48000;
// 배음이 섞인 기타 비슷한 신호
function tone(f: number, n = 4096) {
  const buf = new Float32Array(n);
  for (let i = 0; i < n; i++) {
    const t = i / SR;
    buf[i] = 0.5 * Math.sin(2 * Math.PI * f * t) + 0.3 * Math.sin(4 * Math.PI * f * t) + 0.15 * Math.sin(6 * Math.PI * f * t);
  }
  return buf;
}

describe('detectPitch', () => {
  it.each([82.41, 110, 146.83, 196, 246.94, 329.63])('%f Hz를 0.5Hz 안으로 찾는다', (f) => {
    expect(detectPitch(tone(f), SR)).toBeCloseTo(f, 0);
  });

  it('조용하면 null', () => {
    expect(detectPitch(new Float32Array(4096), SR)).toBeNull();
  });
});

describe('pitchTracker', () => {
  it('한두 프레임 옥타브 튐은 무시한다', () => {
    const tr = createPitchTracker();
    for (let i = 0; i < 5; i++) tr.push(110);
    expect(tr.push(220)).toBeCloseTo(110);
    expect(tr.push(110)).toBeCloseTo(110);
  });

  it('다른 줄로 바뀐 것은 몇 프레임 뒤 받아들인다', () => {
    const tr = createPitchTracker();
    for (let i = 0; i < 5; i++) tr.push(110);
    tr.push(146.8);
    tr.push(146.8);
    expect(tr.push(146.8)).toBeCloseTo(146.8);
  });

  it('오래 조용하면 초기화된다', () => {
    const tr = createPitchTracker({ silenceFrames: 3 });
    tr.push(110);
    for (let i = 0; i < 3; i++) expect(tr.push(null)).toBeCloseTo(110);
    expect(tr.push(null)).toBeNull();
  });
});
