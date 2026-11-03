// YIN 음높이 검출 (de Cheveigné & Kawahara, 2002)
export function detectPitch(buf: Float32Array, sampleRate: number, minHz = 60, maxHz = 1200): number | null {
  let rms = 0;
  for (let i = 0; i < buf.length; i++) rms += buf[i] * buf[i];
  rms = Math.sqrt(rms / buf.length);
  if (rms < 0.008) return null;

  const tauMin = Math.floor(sampleRate / maxHz);
  const tauMax = Math.min(Math.floor(sampleRate / minHz), Math.floor(buf.length / 2));
  const w = buf.length - tauMax;
  const d = new Float32Array(tauMax + 1);

  // 차이 함수
  for (let tau = 1; tau <= tauMax; tau++) {
    let sum = 0;
    for (let i = 0; i < w; i++) {
      const diff = buf[i] - buf[i + tau];
      sum += diff * diff;
    }
    d[tau] = sum;
  }

  // 누적 평균 정규화
  d[0] = 1;
  let running = 0;
  for (let tau = 1; tau <= tauMax; tau++) {
    running += d[tau];
    d[tau] = running ? (d[tau] * tau) / running : 1;
  }

  // 임계값 아래 첫 번째 골짜기
  const threshold = 0.12;
  let tau = -1;
  for (let t = Math.max(2, tauMin); t < tauMax; t++) {
    if (d[t] < threshold) {
      while (t + 1 < tauMax && d[t + 1] < d[t]) t++;
      tau = t;
      break;
    }
  }
  if (tau < 0) return null;

  // 포물선 보간으로 소수점 지연 추정
  const a = d[tau - 1];
  const b = d[tau];
  const c = d[tau + 1] ?? b;
  const denom = a + c - 2 * b;
  const shift = denom ? (a - c) / (2 * denom) : 0;
  return sampleRate / (tau + shift);
}
