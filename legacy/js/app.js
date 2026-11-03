(() => {
  const T = globalThis.Theory;
  const D = globalThis.Diagram;
  const G = globalThis.Guitar;
  const $ = (s, el = document) => el.querySelector(s);
  const $$ = (s, el = document) => [...el.querySelectorAll(s)];

  const store = {
    get(k, d) {
      try {
        const v = localStorage.getItem('chords.' + k);
        return v == null ? d : JSON.parse(v);
      } catch (e) {
        return d;
      }
    },
    set(k, v) {
      try {
        localStorage.setItem('chords.' + k, JSON.stringify(v));
      } catch (e) {
        /* 저장 불가 환경 */
      }
    },
  };

  const PATTERNS = [
    { id: 'D-D-D-D-', name: '다운 4비트' },
    { id: 'D-DU-UDU', name: '포크 스트럼' },
    { id: 'DUDUDUDU', name: '8비트' },
    { id: 'arp', name: '아르페지오' },
  ];

  const PRESETS = {
    major: [
      { name: '팝 진행 (I–V–vi–IV)', prog: [0, 4, 5, 3] },
      { name: '감성 진행 (vi–IV–I–V)', prog: [5, 3, 0, 4] },
      { name: '50년대 (I–vi–IV–V)', prog: [0, 5, 3, 4] },
      { name: '왕도 진행 (IV–V–iii–vi)', prog: [3, 4, 2, 5] },
      { name: '투파이브원 (ii–V–I)', prog: [1, 4, 0, 0] },
      { name: '포크 (I–IV–V–IV)', prog: [0, 3, 4, 3] },
      { name: '캐논 진행', prog: [0, 4, 5, 2, 3, 0, 3, 4] },
    ],
    minor: [
      { name: '에픽 (i–VI–III–VII)', prog: [0, 5, 2, 6] },
      { name: '발라드 (i–iv–VII–III)', prog: [0, 3, 6, 2] },
      { name: '안달루시안풍 (i–VII–VI–VII)', prog: [0, 6, 5, 6] },
      { name: '기본 (i–iv–v–i)', prog: [0, 3, 4, 0] },
    ],
  };

  const state = {
    tab: store.get('tab', 'dict'),
    root: store.get('root', 0),
    quality: store.get('quality', ''),
    labels: store.get('labels', 'interval'),
    keyPc: store.get('keyPc', 0),
    keyMode: store.get('keyMode', 'major'),
    sevenths: store.get('sevenths', false),
    prog: store.get('prog', [0, 4, 5, 3]),
    pattern: store.get('pattern', 'D-DU-UDU'),
    bpm: store.get('bpm', 88),
  };
  if (!T.QMAP[state.quality]) state.quality = '';
  const save = (...keys) => keys.forEach((k) => store.set(k, state[k]));

  const best = (pc, qid) => T.voicings(pc, qid)[0];

  function flash(el) {
    if (!el) return;
    el.classList.remove('ringing');
    void el.offsetWidth;
    el.classList.add('ringing');
  }

  function setSeg(el, value) {
    $$('button', el).forEach((b) => b.classList.toggle('active', b.dataset.v === String(value)));
  }

  // ---------- 탭

  function showTab(tab) {
    state.tab = tab;
    save('tab');
    $$('.tabs button').forEach((b) => b.setAttribute('aria-selected', b.dataset.tab === tab));
    $$('.tab').forEach((s) => s.classList.toggle('active', s.id === 'tab-' + tab));
  }

  // ---------- 코드 사전

  let currentVoicings = [];

  function renderPickers() {
    $('#roots').innerHTML = T.ROOTS.map(
      (n, pc) => `<button class="chip${pc === state.root ? ' active' : ''}" data-pc="${pc}">${T.pretty(n)}</button>`,
    ).join('');
    $('#qualities').innerHTML = T.QUALITIES.map(
      (q) =>
        `<button class="chip${q.id === state.quality ? ' active' : ''}" data-q="${q.id}" title="${q.name}">${
          q.sym || 'Major'
        }</button>`,
    ).join('');
  }

  function renderChord() {
    const rootName = T.ROOTS[state.root];
    const q = T.QMAP[state.quality];
    const tones = T.chordTones(rootName, q.id);
    const name = T.chordName(rootName, q.id);

    $('#chord-name').textContent = name;
    $('#chord-desc').textContent = `${T.pretty(rootName)} ${q.name}`;
    $('#tones').innerHTML = tones
      .map((t, i) => `<span class="tone${i === 0 ? ' root' : ''}"><b>${T.pretty(t.name)}</b><i>${t.label}</i></span>`)
      .join('');
    setSeg($('#label-mode'), state.labels);

    currentVoicings = T.voicings(state.root, q.id);
    $('#voicings').innerHTML = currentVoicings.length
      ? currentVoicings
          .map(
            (v, i) => `
        <article class="vcard" data-i="${i}" tabindex="0" aria-label="${name} ${v.position} 재생">
          <header><span class="pos">${v.position}</span>${v.shape ? `<span class="shape">${v.shape}</span>` : ''}</header>
          ${D.render(v, tones, { labels: state.labels, title: name })}
          <footer>
            <code>${v.code}</code>
            <button class="icon-btn" data-act="arp" title="아르페지오로 듣기" aria-label="아르페지오로 듣기">
              <svg viewBox="0 0 24 24"><path d="M9 18V5l11-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="17" cy="16" r="3"/></svg>
            </button>
          </footer>
        </article>`,
          )
          .join('')
      : `<p class="empty">이 코드의 보이싱이 아직 없습니다.</p>`;
  }

  function setChord(pc, qid, { syncSearch = true } = {}) {
    state.root = pc;
    state.quality = qid;
    save('root', 'quality');
    renderPickers();
    renderChord();
    if (syncSearch) {
      $('#search').value = '';
      $('#search').classList.remove('invalid');
    }
  }

  function playVoicing(i, how = 'strum') {
    const v = currentVoicings[i];
    if (!v) return;
    if (how === 'arp') G.arpeggio(v.frets);
    else G.strum(v.frets);
    flash($(`.vcard[data-i="${i}"]`));
  }

  // ---------- 키 & 진행

  function chordsInKey() {
    return T.diatonic(state.keyPc, state.keyMode, state.sevenths);
  }

  function renderKeys() {
    const keys = T.SCALES[state.keyMode].keys;
    $('#keys').innerHTML = keys
      .map((n, pc) => `<button class="chip${pc === state.keyPc ? ' active' : ''}" data-pc="${pc}">${T.pretty(n)}</button>`)
      .join('');
    setSeg($('#key-mode'), state.keyMode);
    setSeg($('#chord-size'), state.sevenths ? 7 : 3);
    $('#key-title').textContent = `${T.pretty(keys[state.keyPc])} ${state.keyMode === 'major' ? '메이저' : '마이너'}`;

    const chords = chordsInKey();
    $('#diatonic').innerHTML = chords
      .map((c) => {
        const v = best(c.pc, c.qid);
        const tones = T.chordTones(c.rootName, c.qid);
        return `
        <article class="dcard" data-deg="${c.degree}" tabindex="0" aria-label="${c.name} 재생">
          <span class="roman">${c.roman}</span>
          <strong>${c.name}</strong>
          ${v ? D.render(v, tones, { labels: 'none', title: c.name }) : ''}
          <div class="dcard-actions">
            <button data-act="add" title="진행에 추가">＋</button>
            <button data-act="open" title="코드 사전에서 보기">사전</button>
          </div>
        </article>`;
      })
      .join('');
    renderProg();
  }

  function renderProg() {
    const chords = chordsInKey();
    const presets = PRESETS[state.keyMode];
    const match = presets.findIndex((p) => p.prog.join() === state.prog.join());
    $('#preset').innerHTML =
      presets.map((p, i) => `<option value="${i}">${p.name}</option>`).join('') +
      `<option value="custom">직접 만들기</option>`;
    $('#preset').value = match >= 0 ? String(match) : 'custom';

    $('#progression').innerHTML = state.prog.length
      ? state.prog
          .map((deg, i) => {
            const c = chords[deg];
            const v = best(c.pc, c.qid);
            return `
          <article class="pcard" data-i="${i}">
            <span class="bar">${i + 1}</span>
            <button class="remove" data-act="remove" title="삭제" aria-label="${c.name} 삭제">×</button>
            <span class="roman">${c.roman}</span>
            <strong>${c.name}</strong>
            ${v ? D.render(v, T.chordTones(c.rootName, c.qid), { labels: 'none', title: c.name }) : ''}
          </article>`;
          })
          .join('')
      : `<p class="empty">진행이 비어 있습니다. 위 코드 카드의 ＋ 버튼으로 추가하세요.</p>`;
    $('#play').disabled = !state.prog.length;
  }

  // ---------- 진행 재생 (8분음표 단위 스케줄러)

  const player = { on: false, timer: null, step: 0, next: 0, marks: [] };

  function scheduleEighth(step, t) {
    if (!state.prog.length) return;
    const bar = Math.floor(step / 8) % state.prog.length;
    const e = step % 8;
    const c = chordsInKey()[state.prog[bar]];
    const v = best(c.pc, c.qid);
    if (!v) return;

    if (e === 0) {
      const delay = Math.max(0, (t - G.now()) * 1000);
      player.marks.push(setTimeout(() => highlight(bar), delay));
    }

    if (state.pattern === 'arp') {
      const sounding = v.frets.map((f, i) => (f == null ? null : i)).filter((i) => i != null);
      const bass = sounding[0];
      const order = [bass, 3, 4, 5, 4, 3, 4, 3];
      const s = order[e];
      if (e === 0) G.damp(t);
      if (v.frets[s] != null) G.pluck(T.TUNING[s] + v.frets[s], t, e === 0 ? 0.95 : 0.7);
      return;
    }

    const p = state.pattern[e];
    if (p === 'D') G.strum(v.frets, { when: t, vel: e === 0 ? 1 : 0.72, spread: 0.02 });
    else if (p === 'U') G.strum(v.frets, { when: t, dir: 'up', vel: 0.5, spread: 0.014 });
  }

  function tick() {
    const eighth = 60 / state.bpm / 2;
    while (player.next < G.now() + 0.15) {
      scheduleEighth(player.step, player.next);
      player.next += eighth;
      player.step++;
    }
    player.timer = setTimeout(tick, 25);
  }

  function highlight(bar) {
    $$('.pcard').forEach((el) => el.classList.toggle('current', Number(el.dataset.i) === bar));
  }

  function setPlayButton() {
    $('#play').innerHTML = player.on
      ? '<svg viewBox="0 0 24 24"><rect x="6" y="5" width="4" height="14" rx="1"/><rect x="14" y="5" width="4" height="14" rx="1"/></svg>정지'
      : '<svg viewBox="0 0 24 24"><path d="M7 4.5v15l13-7.5z"/></svg>재생';
  }

  function play() {
    if (!state.prog.length) return;
    G.ensure();
    player.on = true;
    player.step = 0;
    player.next = G.now() + 0.08;
    tick();
    setPlayButton();
  }

  function stop() {
    player.on = false;
    clearTimeout(player.timer);
    player.marks.forEach(clearTimeout);
    player.marks = [];
    G.damp();
    highlight(-1);
    setPlayButton();
  }

  // ---------- 이벤트

  function bind() {
    $('.tabs').addEventListener('click', (e) => {
      const b = e.target.closest('button[data-tab]');
      if (b) showTab(b.dataset.tab);
    });

    $('#roots').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pc]');
      if (b) setChord(Number(b.dataset.pc), state.quality);
    });
    $('#qualities').addEventListener('click', (e) => {
      const b = e.target.closest('[data-q]');
      if (b) setChord(state.root, b.dataset.q);
    });
    $('#label-mode').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      state.labels = b.dataset.v;
      save('labels');
      renderChord();
    });

    $('#search').addEventListener('input', (e) => {
      const val = e.target.value;
      const c = val.trim() ? T.parseChord(val) : null;
      e.target.classList.toggle('invalid', !!val.trim() && !c);
      if (c) setChord(c.pc, c.qid, { syncSearch: false });
    });
    $('#search').addEventListener('keydown', (e) => {
      if (e.key === 'Enter') {
        e.target.blur();
        playVoicing(0);
      }
    });

    $('#voicings').addEventListener('click', (e) => {
      const card = e.target.closest('.vcard');
      if (!card) return;
      playVoicing(Number(card.dataset.i), e.target.closest('[data-act="arp"]') ? 'arp' : 'strum');
    });
    $('#voicings').addEventListener('keydown', (e) => {
      const card = e.target.closest('.vcard');
      if (card && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        e.stopPropagation();
        playVoicing(Number(card.dataset.i));
      }
    });

    document.addEventListener('keydown', (e) => {
      if (state.tab !== 'dict' || e.target.closest('input, select, textarea, .vcard')) return;
      const qi = T.QUALITIES.findIndex((q) => q.id === state.quality);
      const n = T.QUALITIES.length;
      if (e.key === 'ArrowRight') setChord((state.root + 1) % 12, state.quality);
      else if (e.key === 'ArrowLeft') setChord((state.root + 11) % 12, state.quality);
      else if (e.key === 'ArrowDown') setChord(state.root, T.QUALITIES[(qi + 1) % n].id);
      else if (e.key === 'ArrowUp') setChord(state.root, T.QUALITIES[(qi + n - 1) % n].id);
      else if (e.key === ' ') playVoicing(0);
      else return;
      e.preventDefault();
    });

    $('#keys').addEventListener('click', (e) => {
      const b = e.target.closest('[data-pc]');
      if (!b) return;
      state.keyPc = Number(b.dataset.pc);
      save('keyPc');
      renderKeys();
    });
    $('#key-mode').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b || b.dataset.v === state.keyMode) return;
      state.keyMode = b.dataset.v;
      state.prog = [...PRESETS[state.keyMode][0].prog];
      save('keyMode', 'prog');
      renderKeys();
    });
    $('#chord-size').addEventListener('click', (e) => {
      const b = e.target.closest('[data-v]');
      if (!b) return;
      state.sevenths = b.dataset.v === '7';
      save('sevenths');
      renderKeys();
    });

    $('#diatonic').addEventListener('click', (e) => {
      const card = e.target.closest('.dcard');
      if (!card) return;
      const c = chordsInKey()[Number(card.dataset.deg)];
      const act = e.target.closest('[data-act]')?.dataset.act;
      if (act === 'add') {
        state.prog.push(c.degree);
        save('prog');
        renderProg();
      } else if (act === 'open') {
        setChord(c.pc, c.qid);
        showTab('dict');
        window.scrollTo({ top: 0, behavior: 'smooth' });
      } else {
        const v = best(c.pc, c.qid);
        if (v) G.strum(v.frets);
        flash(card);
      }
    });
    $('#diatonic').addEventListener('keydown', (e) => {
      const card = e.target.closest('.dcard');
      if (card && e.target === card && (e.key === 'Enter' || e.key === ' ')) {
        e.preventDefault();
        card.click();
      }
    });

    $('#progression').addEventListener('click', (e) => {
      const card = e.target.closest('.pcard');
      if (!card) return;
      const i = Number(card.dataset.i);
      if (e.target.closest('[data-act="remove"]')) {
        state.prog.splice(i, 1);
        save('prog');
        renderProg();
        if (!state.prog.length && player.on) stop();
        return;
      }
      const c = chordsInKey()[state.prog[i]];
      const v = best(c.pc, c.qid);
      if (v) G.strum(v.frets);
      flash(card);
    });

    $('#preset').addEventListener('change', (e) => {
      if (e.target.value === 'custom') return;
      state.prog = [...PRESETS[state.keyMode][Number(e.target.value)].prog];
      save('prog');
      renderProg();
    });

    $('#pattern').innerHTML = PATTERNS.map((p) => `<option value="${p.id}">${p.name}</option>`).join('');
    $('#pattern').value = state.pattern;
    $('#pattern').addEventListener('change', (e) => {
      state.pattern = e.target.value;
      save('pattern');
    });

    const bpm = $('#bpm');
    bpm.value = state.bpm;
    $('#bpm-value').textContent = state.bpm;
    bpm.addEventListener('input', () => {
      state.bpm = Number(bpm.value);
      $('#bpm-value').textContent = state.bpm;
      save('bpm');
    });

    $('#play').addEventListener('click', () => (player.on ? stop() : play()));
  }

  bind();
  renderPickers();
  renderChord();
  renderKeys();
  setPlayButton();
  showTab(state.tab);
})();
