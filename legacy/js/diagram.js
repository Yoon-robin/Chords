// 코드 다이어그램 SVG 렌더링
(() => {
  const SX = 16; // 줄 간격
  const SY = 20; // 프렛 간격
  const PX = 26; // 왼쪽 여백 (프렛 번호 자리)
  const PY = 24; // 위쪽 여백 (O / × 표시 자리)
  const FRETS = 5;
  const R = 6.8;
  const W = PX + SX * 5 + 14;
  const GRID_H = FRETS * SY;

  // 같은 프렛에서 연속된 줄을 한 손가락으로 누르면 바레로 그린다
  function findBarre(frets, base) {
    const fr = frets.filter((f) => f != null && f > 0);
    if (!fr.length) return null;
    const lo = Math.min(...fr);
    if (lo !== base && base !== 1) return null;
    const idx = frets.map((f, i) => (f === lo ? i : -1)).filter((i) => i >= 0);
    if (idx.length < 2) return null;
    const a = idx[0];
    const b = idx[idx.length - 1];
    for (let i = a; i <= b; i++) if (frets[i] == null || frets[i] < lo) return null;
    // 1번줄까지 이어지지 않는 짧은 바레(예: A폼 2-3-4번줄)는 표시하지 않는다
    if (b !== 5) return null;
    return { fret: lo, from: a, to: b };
  }

  function render(voicing, tones, opts = {}) {
    const mode = opts.labels || 'interval';
    const showFoot = mode !== 'none';
    const H = PY + GRID_H + (showFoot ? 22 : 8);
    const { frets } = voicing;
    const byPc = new Map(tones.map((t) => [t.pc, t]));
    const rootPc = tones[0].pc;
    const fr = frets.filter((f) => f != null && f > 0);
    const maxF = fr.length ? Math.max(...fr) : 0;
    const base = maxF <= FRETS ? 1 : Math.min(...fr);
    const x = (i) => PX + i * SX;
    const T = globalThis.Theory;

    const out = [];
    out.push(`<svg class="diagram" viewBox="0 0 ${W} ${H}" role="img" aria-label="${opts.title || ''} ${voicing.code}">`);

    // 프렛선
    for (let k = 0; k <= FRETS; k++) {
      out.push(`<line class="dg-fret" x1="${x(0)}" x2="${x(5)}" y1="${PY + k * SY}" y2="${PY + k * SY}"/>`);
    }
    if (base === 1) {
      out.push(`<rect class="dg-nut" x="${x(0) - 1}" y="${PY - 3}" width="${SX * 5 + 2}" height="4" rx="1"/>`);
    } else {
      out.push(`<text class="dg-base" x="${x(0) - 8}" y="${PY + SY / 2 + 3.5}" text-anchor="end">${base}fr</text>`);
    }
    // 줄 (저음일수록 굵게)
    for (let i = 0; i < 6; i++) {
      out.push(`<line class="dg-string" x1="${x(i)}" x2="${x(i)}" y1="${PY}" y2="${PY + GRID_H}" stroke-width="${(1.7 - i * 0.18).toFixed(2)}"/>`);
    }

    const barre = findBarre(frets, base);
    if (barre) {
      const cy = PY + (barre.fret - base + 0.5) * SY;
      out.push(`<rect class="dg-barre" x="${x(barre.from) - R}" y="${cy - R}" width="${x(barre.to) - x(barre.from) + 2 * R}" height="${2 * R}" rx="${R}"/>`);
    }

    frets.forEach((f, i) => {
      const cx = x(i);
      if (f == null) {
        const y = PY - 11;
        out.push(`<path class="dg-mute" d="M${cx - 3.5} ${y - 3.5}L${cx + 3.5} ${y + 3.5}M${cx + 3.5} ${y - 3.5}L${cx - 3.5} ${y + 3.5}"/>`);
        return;
      }
      const pc = (T.TUNING[i] + f) % 12;
      const tone = byPc.get(pc);
      const isRoot = pc === rootPc;
      const label = mode === 'interval' ? tone.label : mode === 'note' ? T.pretty(tone.name) : '';
      if (f === 0) {
        out.push(`<circle class="dg-open${isRoot ? ' root' : ''}" cx="${cx}" cy="${PY - 11}" r="4.2"/>`);
      } else {
        const cy = PY + (f - base + 0.5) * SY;
        out.push(`<circle class="dg-dot${isRoot ? ' root' : ''}" cx="${cx}" cy="${cy}" r="${R}"/>`);
        if (label) out.push(`<text class="dg-dot-label" x="${cx}" y="${cy + 2.8}" text-anchor="middle">${label}</text>`);
      }
      if (showFoot) {
        out.push(`<text class="dg-foot${isRoot ? ' root' : ''}" x="${cx}" y="${PY + GRID_H + 15}" text-anchor="middle">${label}</text>`);
      }
    });

    out.push('</svg>');
    return out.join('');
  }

  globalThis.Diagram = { render };
})();
