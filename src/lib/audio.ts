// Karplus-Strong 방식 어쿠스틱 기타 소리 + 메트로놈 클릭
import { TUNING, type Fret } from './theory';

let ctx: AudioContext | null = null;
let input: AudioNode | null = null;
let clickOut: AudioNode | null = null;
const cache = new Map<number, AudioBuffer>();
type Voice = { src: AudioBufferSourceNode; g: GainNode; start: number };
let voices: Voice[] = [];

export function ensureAudio() {
  if (!ctx) {
    ctx = new AudioContext();
    // 바디 울림(저음 공명) → 고음 정리 → 컴프레서
    const hp = ctx.createBiquadFilter();
    hp.type = 'highpass';
    hp.frequency.value = 60;
    const body = ctx.createBiquadFilter();
    body.type = 'peaking';
    body.frequency.value = 110;
    body.Q.value = 1.1;
    body.gain.value = 4;
    const air = ctx.createBiquadFilter();
    air.type = 'peaking';
    air.frequency.value = 2600;
    air.Q.value = 0.8;
    air.gain.value = 2;
    const lp = ctx.createBiquadFilter();
    lp.type = 'lowpass';
    lp.frequency.value = 6500;
    const comp = ctx.createDynamicsCompressor();
    comp.threshold.value = -14;
    comp.ratio.value = 4;
    hp.connect(body).connect(air).connect(lp).connect(comp).connect(ctx.destination);
    input = hp;
    clickOut = comp;
  }
  if (ctx.state === 'suspended') void ctx.resume();
  return ctx;
}

export const now = () => (ctx ? ctx.currentTime : 0);

function buffer(midi: number) {
  const hit = cache.get(midi);
  if (hit) return hit;
  const c = ctx!;
  const sr = c.sampleRate;
  const f = 440 * Math.pow(2, (midi - 69) / 12);
  const len = Math.floor(sr * 3.2);
  const buf = c.createBuffer(1, len, sr);
  const y = buf.getChannelData(0);

  // 루프 지연 = p + 0.5(평균 필터) = sr / f
  const p = sr / f - 0.5;
  const pi = Math.floor(p);
  const frac = p - pi;
  // 저음은 길게, 고음은 짧게 울린다
  const t60 = Math.max(1.6, 4.2 - ((midi - 40) / 40) * 2.4);
  const decay = Math.pow(10, -3 / (f * t60));

  // 피크로 튕긴 초기 파형: 부드럽게 다듬은 노이즈 + 피킹 위치 콤 필터
  const n0 = pi + 2;
  const noise = new Float32Array(n0);
  let prev = 0;
  for (let i = 0; i < n0; i++) {
    prev = prev * 0.45 + (Math.random() * 2 - 1) * 0.55;
    noise[i] = prev;
  }
  const pick = Math.max(1, Math.round(n0 * 0.18));
  for (let i = 0; i < n0; i++) y[i] = (noise[i] - (i >= pick ? noise[i - pick] : 0)) * 0.6;

  let last = 0;
  for (let n = n0; n < len; n++) {
    const d = (1 - frac) * y[n - pi] + frac * y[n - pi - 1];
    y[n] = decay * 0.5 * (d + last);
    last = d;
  }
  for (let i = 0; i < 48 && i < len; i++) y[i] *= i / 48;

  cache.set(midi, buf);
  return buf;
}

export function pluck(midi: number, when?: number, vel = 0.8) {
  const c = ensureAudio();
  const t = when ?? c.currentTime + 0.01;
  const src = c.createBufferSource();
  src.buffer = buffer(midi);
  const g = c.createGain();
  g.gain.value = 0.2 * vel;
  src.connect(g).connect(input!);
  src.start(t);
  const v = { src, g, start: t };
  voices.push(v);
  src.onended = () => {
    voices = voices.filter((x) => x !== v);
  };
}

// 새 스트럼 직전에 이전 소리를 손으로 뮤트하듯 줄인다
export function damp(when?: number) {
  if (!ctx) return;
  const t = when ?? ctx.currentTime;
  for (const v of voices) {
    if (v.start >= t) continue;
    v.g.gain.setTargetAtTime(0, t, 0.035);
    try {
      v.src.stop(t + 0.4);
    } catch {
      /* 이미 멈춘 소리 */
    }
  }
}

type StrumOpts = { when?: number; dir?: 'down' | 'up'; spread?: number; vel?: number };

export function strum(frets: Fret[], opts: StrumOpts = {}) {
  const c = ensureAudio();
  const t = opts.when ?? c.currentTime + 0.02;
  const spread = opts.spread ?? 0.024;
  const vel = opts.vel ?? 0.9;
  let strings = frets.map((f, i) => (f == null ? -1 : i)).filter((i) => i >= 0);
  if (opts.dir === 'up') strings = strings.filter((i) => i >= 2).reverse();
  damp(t);
  strings.forEach((i, k) => {
    const jitter = (Math.random() - 0.5) * 0.004;
    pluck(TUNING[i] + (frets[i] as number), t + k * spread + jitter, vel * (1 - k * 0.04));
  });
}

export function arpeggio(frets: Fret[], step = 0.16) {
  const c = ensureAudio();
  const t = c.currentTime + 0.02;
  damp(t);
  frets.forEach((f, i) => {
    if (f == null) return;
    const k = frets.slice(0, i).filter((x) => x != null).length;
    pluck(TUNING[i] + f, t + k * step, 0.75);
  });
}

// 메트로놈: 짧은 우드블록 느낌의 클릭
export function click(when: number, accent: boolean) {
  const c = ensureAudio();
  const osc = c.createOscillator();
  const g = c.createGain();
  osc.type = 'triangle';
  osc.frequency.value = accent ? 1800 : 1200;
  g.gain.setValueAtTime(0, when);
  g.gain.linearRampToValueAtTime(accent ? 0.5 : 0.3, when + 0.002);
  g.gain.exponentialRampToValueAtTime(0.001, when + 0.06);
  osc.connect(g).connect(clickOut!);
  osc.start(when);
  osc.stop(when + 0.08);
}

// 8분음표 단위 스케줄러 (setTimeout + 오디오 시계로 정확한 박자)
export function createLoop(getBpm: () => number, onEighth: (step: number, time: number) => void) {
  let timer = 0;
  let step = 0;
  let next = 0;
  let running = false;
  const tick = () => {
    const eighth = 60 / getBpm() / 2;
    while (next < now() + 0.15) {
      onEighth(step, next);
      next += eighth;
      step++;
    }
    timer = window.setTimeout(tick, 25);
  };
  return {
    start() {
      ensureAudio();
      running = true;
      step = 0;
      next = now() + 0.08;
      tick();
    },
    stop() {
      running = false;
      clearTimeout(timer);
      damp();
    },
    get running() {
      return running;
    },
  };
}
