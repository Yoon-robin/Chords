// Karplus-Strong 방식으로 만든 어쿠스틱 기타 소리
(() => {
  let ctx = null;
  let input = null;
  const cache = new Map();
  let voices = [];

  function ensure() {
    if (!ctx) {
      ctx = new (window.AudioContext || window.webkitAudioContext)();
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
    }
    if (ctx.state === 'suspended') ctx.resume();
    return ctx;
  }

  function buffer(midi) {
    if (cache.has(midi)) return cache.get(midi);
    const sr = ctx.sampleRate;
    const f = 440 * Math.pow(2, (midi - 69) / 12);
    const len = Math.floor(sr * 3.2);
    const buf = ctx.createBuffer(1, len, sr);
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
    // 시작 클릭 방지용 아주 짧은 페이드인
    for (let i = 0; i < 48 && i < len; i++) y[i] *= i / 48;

    cache.set(midi, buf);
    return buf;
  }

  function pluck(midi, when, vel = 0.8) {
    ensure();
    const t = when ?? ctx.currentTime + 0.01;
    const src = ctx.createBufferSource();
    src.buffer = buffer(midi);
    const g = ctx.createGain();
    g.gain.value = 0.2 * vel;
    src.connect(g).connect(input);
    src.start(t);
    const v = { src, g, start: t };
    voices.push(v);
    src.onended = () => {
      voices = voices.filter((x) => x !== v);
    };
  }

  // 새 스트럼 직전에 이전 소리를 손으로 뮤트하듯 줄인다
  function damp(when) {
    if (!ctx) return;
    const t = when ?? ctx.currentTime;
    for (const v of voices) {
      if (v.start >= t) continue;
      v.g.gain.setTargetAtTime(0, t, 0.035);
      try {
        v.src.stop(t + 0.4);
      } catch (e) {
        /* 이미 멈춘 소리 */
      }
    }
  }

  const TUNING = () => globalThis.Theory.TUNING;

  function strum(frets, opts = {}) {
    ensure();
    const t = opts.when ?? ctx.currentTime + 0.02;
    const dir = opts.dir || 'down';
    const spread = opts.spread ?? 0.024;
    const vel = opts.vel ?? 0.9;
    let strings = frets.map((f, i) => (f == null ? null : i)).filter((i) => i != null);
    if (dir === 'up') strings = strings.filter((i) => i >= 2).reverse();
    damp(t);
    strings.forEach((i, k) => {
      // 스트럼이 진행될수록 살짝 약해지고, 미세하게 타이밍이 흔들린다
      const jitter = (Math.random() - 0.5) * 0.004;
      pluck(TUNING()[i] + frets[i], t + k * spread + jitter, vel * (1 - k * 0.04));
    });
  }

  function arpeggio(frets, opts = {}) {
    ensure();
    const t = opts.when ?? ctx.currentTime + 0.02;
    const step = opts.step ?? 0.16;
    const strings = frets.map((f, i) => (f == null ? null : i)).filter((i) => i != null);
    damp(t);
    strings.forEach((i, k) => pluck(TUNING()[i] + frets[i], t + k * step, 0.75));
  }

  globalThis.Guitar = {
    ensure,
    pluck,
    strum,
    arpeggio,
    damp,
    now: () => (ctx ? ctx.currentTime : 0),
  };
})();
