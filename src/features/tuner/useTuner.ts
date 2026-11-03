import { useCallback, useEffect, useRef, useState } from 'react';
import { detectPitch } from '../../lib/pitch';
import { createPitchTracker } from '../../lib/pitchTracker';

export type TunerStatus = 'idle' | 'starting' | 'listening' | 'denied' | 'unsupported';

type Session = { ctx: AudioContext; stream: MediaStream; raf: number };

function release(s: { ctx?: AudioContext; stream?: MediaStream; raf?: number }) {
  if (s.raf) cancelAnimationFrame(s.raf);
  s.stream?.getTracks().forEach((t) => t.stop());
  if (s.ctx && s.ctx.state !== 'closed') void s.ctx.close();
}

// 마이크 입력을 받아 실시간으로 주파수를 알려준다
export function useTuner() {
  const [status, setStatus] = useState<TunerStatus>('idle');
  const [freq, setFreq] = useState<number | null>(null);
  const [level, setLevel] = useState(0);
  const session = useRef<Session | null>(null);
  // start()가 권한을 기다리는 사이 stop()이나 화면 이동이 있었는지 알아내는 세대 번호
  const generation = useRef(0);

  const stop = useCallback(() => {
    generation.current++;
    if (session.current) release(session.current);
    session.current = null;
    setStatus('idle');
    setFreq(null);
    setLevel(0);
  }, []);

  const start = useCallback(async () => {
    if (!navigator.mediaDevices?.getUserMedia) {
      setStatus('unsupported');
      return;
    }
    const gen = ++generation.current;
    if (session.current) release(session.current);
    session.current = null;
    setStatus('starting');

    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({
        audio: { echoCancellation: false, noiseSuppression: false, autoGainControl: false },
      });
    } catch {
      if (gen === generation.current) setStatus('denied');
      return;
    }
    // 기다리는 동안 정지됐거나 다시 시작됐다면 이 마이크는 바로 반납
    if (gen !== generation.current) {
      release({ stream });
      return;
    }

    const ctx = new AudioContext();
    const analyser = ctx.createAnalyser();
    analyser.fftSize = 4096;
    ctx.createMediaStreamSource(stream).connect(analyser);
    const buf = new Float32Array(analyser.fftSize);
    const tracker = createPitchTracker();
    let frame = 0;

    const s: Session = { ctx, stream, raf: 0 };
    const loop = () => {
      if (gen !== generation.current) return;
      s.raf = requestAnimationFrame(loop);
      if (frame++ % 2) return; // 약 30fps로 분석
      analyser.getFloatTimeDomainData(buf);
      let peak = 0;
      for (let i = 0; i < buf.length; i += 8) peak = Math.max(peak, Math.abs(buf[i]));
      setLevel(Math.min(1, peak * 3));
      setFreq(tracker.push(detectPitch(buf, ctx.sampleRate)));
    };
    s.raf = requestAnimationFrame(loop);
    session.current = s;
    setStatus('listening');
  }, []);

  useEffect(() => stop, [stop]);

  return { status, freq, level, start, stop };
}
