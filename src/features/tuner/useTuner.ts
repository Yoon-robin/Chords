import { useCallback, useEffect, useRef, useState } from 'react';
import { detectPitch } from '../../lib/pitch';

export type TunerStatus = 'idle' | 'starting' | 'listening' | 'denied' | 'unsupported';

// 마이크 입력을 받아 실시간으로 주파수를 알려준다
export function useTuner() {
  const [status, setStatus] = useState<TunerStatus>('idle');
  const [freq, setFreq] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const res = useRef<{ ctx: AudioContext; stream: MediaStream; raf: number } | null>(null);

  const stop = useCallback(() => {
    const r = res.current;
    if (!r) return;
    cancelAnimationFrame(r.raf);
    r.stream.getTracks().forEach((t) => t.stop());
    void r.ctx.close();
    res.current = null;
    setStatus('idle');
    setFreq(null);
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    setStatus('starting');
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
      const ctx = new AudioContext();
      const src = ctx.createMediaStreamSource(stream);
      const analyser = ctx.createAnalyser();
      analyser.fftSize = 4096;
      src.connect(analyser);
      const buf = new Float32Array(analyser.fftSize);
      const history: number[] = [];
      let silent = 0;
      let frame = 0;

      const loop = () => {
        res.current!.raf = requestAnimationFrame(loop);
        if (frame++ % 2) return; // 약 30fps로 분석
        analyser.getFloatTimeDomainData(buf);
        let peak = 0;
        for (let i = 0; i < buf.length; i += 8) peak = Math.max(peak, Math.abs(buf[i]));
        setLevel(Math.min(1, peak * 3));

        const f = detectPitch(buf, ctx.sampleRate);
        if (f) {
          silent = 0;
          // 옥타브 튐 방지: 직전 값과 거의 2배/절반이면 버린다
          const prev = history[history.length - 1];
          if (prev && (Math.abs(f / prev - 2) < 0.06 || Math.abs(f / prev - 0.5) < 0.03)) return;
          history.push(f);
          if (history.length > 5) history.shift();
          const sorted = [...history].sort((a, b) => a - b);
          setFreq(sorted[Math.floor(sorted.length / 2)]);
        } else if (++silent > 25) {
          history.length = 0;
          setFreq(null);
        }
      };
      res.current = { ctx, stream, raf: requestAnimationFrame(loop) };
      setStatus('listening');
    } catch {
      setStatus('denied');
    }
  }, []);

  useEffect(() => stop, [stop]);

  return { status, freq, level, start, stop };
}
