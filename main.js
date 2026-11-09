(() => {
  'use strict';

  const $ = (s, r = document) => r.querySelector(s);
  const $$ = (s, r = document) => [...r.querySelectorAll(s)];
  const clamp = (v, a = 0, b = 1) => Math.min(b, Math.max(a, v));
  const seg = (p, a, b) => clamp((p - a) / (b - a));
  const lerp = (a, b, t) => a + (b - a) * t;
  const easeOut = t => 1 - Math.pow(1 - t, 3);
  const easeInOut = t => (t < .5 ? 4 * t * t * t : 1 - Math.pow(-2 * t + 2, 3) / 2);
  const easeBack = t => 1 + 2.4 * Math.pow(t - 1, 3) + 1.4 * Math.pow(t - 1, 2);
  const reduced = matchMedia('(prefers-reduced-motion: reduce)').matches;

  /* =====================================================
     PALCO — a lixeira abre conforme o scroll
     ===================================================== */
  const wrap = $('.stage-wrap');
  const stage = $('#stage');
  const intro = $('#intro');
  const hint = $('#hint');
  const binBox = $('#binBox');
  const lidSvg = $('#lidSvg');
  const lidFace = $('#lidFace');
  const lidInset = $('#lidInset');
  const lidLip = $('#lidLip');
  const lidHandle = $('#lidHandle');
  const emerge = $('#emerge');
  const chapters = $$('[data-ch]');
  const cards = $$('[data-card]');
  const canvas = $('#fx');
  const ctx = canvas.getContext('2d');
  const progressBar = $('#progress');

  // linha do tempo (fração do scroll do palco)
  const T = {
    lid: [.05, .2],
    chapters: [[.2, .43], [.41, .64], [.62, .85]],
    cards: i => [.84 + i * .025, .94 + i * .025],
  };

  /* ---- lixeira filmada: quadros do vídeo gerado no Higgsfield ----
     O vídeo vira uma sequência de imagens; o scroll escolhe o quadro.
     ?bin=svg força a versão desenhada em código (para comparar). */
  const qs = new URLSearchParams(location.search);
  const FILM = {
    dir: 'assets/lixeira/', count: 103, ext: 'webp',
    rim: .43,     // altura da borda da frente da lixeira (fração do quadro)
    binW: .19,    // largura da lixeira (fração do quadro)
    scroll: [.03, .24], // trecho do scroll que percorre o vídeo
    idle: 14,     // quantos quadros finais ficam "respirando" depois de aberta
  };
  const film = $('#film'), filmBox = $('#filmBox');
  const filmCtx = film.getContext('2d');
  const frames = [];
  let filmOn = false, lastDrawn = -1;

  function loadFilm() {
    if (qs.get('bin') === 'svg') return;
    for (let i = 0; i < FILM.count; i++) {
      const img = new Image();
      img.decoding = 'async';
      img.onload = () => {
        img.ready = true;
        if (i === 0 && !filmOn) { filmOn = true; stage.classList.add('film'); measure(); }
        lastDrawn = -1; // redesenha: pode ter chegado um quadro melhor
      };
      img.src = `${FILM.dir}f_${String(i + 1).padStart(3, '0')}.${FILM.ext}`;
      frames.push(img);
    }
  }
  function drawFilm(index) {
    let i = clamp(Math.round(index), 0, FILM.count - 1);
    // se o quadro pedido ainda não carregou, usa o mais próximo já disponível
    for (let d = 0; d < FILM.count && !(frames[i] && frames[i].ready); d++) {
      const lo = i - d, hi = i + d;
      if (frames[lo] && frames[lo].ready) { i = lo; break; }
      if (frames[hi] && frames[hi].ready) { i = hi; break; }
    }
    if (!frames[i] || !frames[i].ready || i === lastDrawn) return;
    filmCtx.drawImage(frames[i], 0, 0, film.width, film.height);
    lastDrawn = i;
  }

  let geo = { w: 0, h: 0, cx: 0, rimY: 0, binW: 0 };
  let sizes = { ch: [], card: [] };

  function measure() {
    const w = stage.clientWidth, h = stage.clientHeight;
    const bh = binBox.offsetHeight, bw = binBox.offsetWidth;
    geo = filmOn
      ? { w, h, cx: w / 2, rimY: filmBox.offsetTop + filmBox.offsetHeight * FILM.rim, binW: filmBox.offsetWidth * FILM.binW }
      : { w, h, cx: w / 2, rimY: binBox.offsetTop + bh * (150 / 520), binW: bw };
    emerge.style.clipPath = `inset(0 0 ${Math.max(0, h - geo.rimY)}px 0)`;
    sizes.ch = chapters.map(el => el.offsetHeight);
    sizes.card = cards.map(el => ({ w: el.offsetWidth, h: el.offsetHeight }));
    const dpr = Math.min(devicePixelRatio || 1, 2);
    canvas.width = Math.round(w * dpr);
    canvas.height = Math.round(h * dpr);
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
  }

  /* ---- tampa: dobradiça no fundo da boca, projeção calculada à mão ---- */
  const HX1 = 62, HX2 = 338, HY = 112, MAXPHI = 102 * Math.PI / 180;
  const pt = p => p[0].toFixed(1) + ',' + p[1].toFixed(1);
  function setLid(open) {
    const phi = open * MAXPHI, c = Math.cos(phi), s = Math.sin(phi);
    const fy = HY + 42 * c - 172 * s;      // borda livre da tampa
    const hw = 138 + 32 * c;               // mais larga quando mais perto da câmera
    const H1 = [HX1, HY], H2 = [HX2, HY], F1 = [200 - hw, fy], F2 = [200 + hw, fy];
    lidFace.setAttribute('points', [H1, H2, F2, F1].map(pt).join(' '));
    const topSide = fy > HY + 2;
    lidFace.classList.toggle('under', !topSide);
    const P = (a, b) => [
      lerp(lerp(H1[0], H2[0], b), lerp(F1[0], F2[0], b), a),
      lerp(HY, fy, a),
    ];
    lidInset.setAttribute('points', [P(.14, .07), P(.14, .93), P(.86, .93), P(.86, .07)].map(pt).join(' '));
    const lip = topSide ? 18 * c : 0;
    lidLip.setAttribute('points', [F1, F2, [F2[0], fy + lip], [F1[0], fy + lip]].map(pt).join(' '));
    lidLip.style.opacity = lidHandle.style.opacity = topSide ? 1 : 0;
    lidHandle.setAttribute('y', (fy + lip / 2 - 4).toFixed(1));
    lidSvg.style.zIndex = open > .5 ? 3 : 8; // aberta, a tampa fica atrás do que sai
  }

  /* ---- partículas determinísticas: dependem só do progresso ---- */
  function rng(seed) {
    return () => {
      seed |= 0; seed = seed + 0x6D2B79F5 | 0;
      let t = Math.imul(seed ^ seed >>> 15, 1 | seed);
      t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    };
  }
  const rnd = rng(11);
  const PCOL = ['#2f6fd0', '#d8432f', '#37a063', '#f0b323', '#c6f06a', '#f4f0e4', '#c6f06a', '#8a5a36'];
  const parts = Array.from({ length: 110 }, (_, i) => ({
    t0: .13 + rnd() * .84, life: .09 + rnd() * .15, dir: rnd() * 2 - 1,
    rise: .3 + rnd() * .7, size: 3 + rnd() * 7, col: PCOL[i % PCOL.length],
    shape: i % 3, rot: rnd() * 6.28, spin: (rnd() * 2 - 1) * 7, sway: rnd() * 6.28,
  }));

  function drawParticles(p, now) {
    ctx.clearRect(0, 0, geo.w, geo.h);
    const spread = Math.min(geo.w * .44, 560);
    for (const q of parts) {
      const u = (p - q.t0) / q.life;
      if (u <= 0 || u >= 1) continue;
      const e = easeOut(u);
      const x = geo.cx + q.dir * (geo.binW * .22 + e * spread) + Math.sin(now / 900 + q.sway) * 6;
      const y = geo.rimY - e * q.rise * geo.rimY * .95 + Math.cos(now / 1100 + q.sway) * 5;
      ctx.save();
      ctx.globalAlpha = Math.pow(Math.sin(Math.PI * u), .6) * .9;
      ctx.translate(x, y);
      ctx.rotate(q.rot + u * q.spin);
      ctx.fillStyle = q.col;
      const s = q.size * (.6 + e * .6);
      if (q.shape === 0) {
        ctx.shadowColor = q.col; ctx.shadowBlur = 14;
        ctx.beginPath(); ctx.arc(0, 0, s * .5, 0, 6.29); ctx.fill();
      } else if (q.shape === 1) { // folha
        ctx.beginPath(); ctx.moveTo(0, -s * 1.5);
        ctx.quadraticCurveTo(s * 1.2, 0, 0, s * 1.5);
        ctx.quadraticCurveTo(-s * 1.2, 0, 0, -s * 1.5); ctx.fill();
      } else { // papelzinho
        ctx.fillRect(-s * .8, -s * .55, s * 1.6, s * 1.1);
      }
      ctx.restore();
    }
  }

  function place(el, x, y, scale, rot, opacity) {
    if (opacity <= .001) { el.style.visibility = 'hidden'; return; }
    el.style.visibility = 'visible';
    el.style.opacity = opacity.toFixed(3);
    el.style.transform =
      `translate(${x.toFixed(1)}px,${y.toFixed(1)}px) translate(-50%,-50%) rotate(${rot.toFixed(2)}deg) scale(${scale.toFixed(3)})`;
  }

  function update(p, now) {
    const open = easeInOut(seg(p, T.lid[0], T.lid[1]));

    // lixeira fechada "quer abrir": tremidinhas periódicas
    let wob = 0, peek = 0;
    if (!reduced && open < 1) {
      const burst = Math.pow(Math.max(0, Math.sin(now / 1100)), 10);
      wob = Math.sin(now / 55) * 2.2 * burst * (1 - open);
      peek = burst * .035 * (1 - open) * (.5 + .5 * Math.sin(now / 40));
    }
    if (filmOn) {
      const t = seg(p, FILM.scroll[0], FILM.scroll[1]);
      let f = t * (FILM.count - 1);
      if (t >= 1 && FILM.idle > 1 && !reduced) { // aberta: os últimos quadros vão e voltam devagar
        const k = FILM.idle - 1, ph = (now / 70) % (2 * k);
        f = FILM.count - 1 - (ph < k ? ph : 2 * k - ph);
      }
      drawFilm(f);
      wob *= .45;
    } else {
      setLid(clamp(open + peek));
    }
    stage.style.setProperty('--open', open.toFixed(3));
    stage.style.setProperty('--wob', wob.toFixed(2) + 'deg');
    stage.style.setProperty('--bs', (filmOn ? 1 : 1.2 - .2 * easeInOut(seg(p, .03, .2))).toFixed(3));

    const io = 1 - seg(p, .02, .11);
    intro.style.opacity = io.toFixed(3);
    intro.style.transform = `translateY(${((1 - io) * -50).toFixed(1)}px)`;
    intro.style.visibility = io <= 0 ? 'hidden' : 'visible';
    hint.style.opacity = (1 - seg(p, 0, .03)).toFixed(3);

    const targetY = geo.rimY * .5 + 20;

    chapters.forEach((el, i) => {
      const [a, b] = T.chapters[i];
      const t = seg(p, a, b);
      if (t <= 0 || t >= 1) { el.style.visibility = 'hidden'; return; }
      const tin = easeOut(seg(t, 0, .4)), tout = easeInOut(seg(t, .74, 1));
      const startY = geo.rimY + sizes.ch[i] * .18;
      const y = lerp(startY, targetY, tin) - tout * geo.h * .2;
      place(el, geo.cx, y, .3 + .7 * tin + .08 * tout, 0, Math.min(1, tin * 3) * (1 - tout));
    });

    const mobile = geo.w < 760;
    cards.forEach((el, i) => {
      const [a, b] = T.cards(i);
      const t = seg(p, a, b);
      if (t <= 0) { el.style.visibility = 'hidden'; return; }
      const e = easeBack(t), k = i - 1, sz = sizes.card[i];
      const tx = mobile ? geo.cx : geo.cx + k * (sz.w + 22);
      const ty = mobile ? targetY - 10 + k * (sz.h + 12) : targetY - Math.abs(k) * -14;
      const x = lerp(geo.cx, tx, e);
      const y = lerp(geo.rimY + sz.h * .2, ty, e);
      place(el, x, y, lerp(.25, 1, clamp(e)), mobile ? 0 : k * 4 * e, Math.min(1, t * 4));
    });

    drawParticles(p, now);
  }

  /* ---- laço principal ---- */
  const forced = qs.get('p'); // ?p=0.5 trava um instante (teste)
  if (qs.has('flat')) { // ?flat esconde o palco e revela tudo (teste de layout)
    wrap.style.display = 'none';
    document.documentElement.classList.add('flat');
    const only = qs.get('flat');
    if (only) $$('main > section').forEach(s => { if (s.id !== only) s.style.display = 'none'; });
  }
  let cur = 0;
  function stageProgress() {
    if (forced !== null) return clamp(parseFloat(forced) || 0);
    const r = wrap.getBoundingClientRect();
    return clamp(-r.top / (r.height - innerHeight));
  }
  function frame(now) {
    const doc = document.documentElement;
    progressBar.style.transform = `scaleX(${clamp(scrollY / (doc.scrollHeight - innerHeight || 1))})`;
    if (wrap.getBoundingClientRect().bottom > 0) {
      const target = stageProgress();
      cur = reduced || forced !== null ? target : cur + (target - cur) * .14;
      if (Math.abs(target - cur) < .0003) cur = target;
      update(cur, now);
    }
    requestAnimationFrame(frame);
  }
  measure();
  loadFilm();
  addEventListener('resize', measure);
  if (document.fonts && document.fonts.ready) document.fonts.ready.then(measure);
  requestAnimationFrame(frame);

  /* =====================================================
     LIXEIRAS — cores da coleta seletiva
     ===================================================== */
  const BINS = [
    { id: 'azul', cor: 'Azul', hex: '#2f6fd0', what: 'Papel e papelão', ex: 'Jornais, revistas, caixas, papelão e folhas.' },
    { id: 'vermelho', cor: 'Vermelho', hex: '#d8432f', what: 'Plástico', ex: 'Garrafas, potes, embalagens e copos.' },
    { id: 'verde', cor: 'Verde', hex: '#2f9e56', what: 'Vidro', ex: 'Garrafas, potes, frascos e copos.' },
    { id: 'amarelo', cor: 'Amarelo', hex: '#f0b323', what: 'Metal', ex: 'Latas, ferragens, tampinhas e embalagens metálicas.', dark: true },
    { id: 'marrom', cor: 'Marrom', hex: '#7a4a2b', what: 'Resíduos orgânicos', ex: 'Restos de comida, folhas, galhos e resíduos de jardim.' },
    { id: 'preto', cor: 'Preto', hex: '#23262a', what: 'Madeira', ex: 'Resíduos de madeira.' },
    { id: 'laranja', cor: 'Laranja', hex: '#f07a1c', what: 'Resíduos perigosos', ex: 'Nunca descarte de forma inadequada.', dark: true },
    { id: 'branco', cor: 'Branco', hex: '#f7f6f1', what: 'Resíduos de serviços de saúde', ex: 'Materiais de ambulatórios e serviços de saúde.', dark: true },
    { id: 'roxo', cor: 'Roxo', hex: '#7b3fb8', what: 'Resíduos radioativos', ex: 'Exigem coleta e tratamento especializados.' },
    { id: 'cinza', cor: 'Cinza', hex: '#8b9096', what: 'Não recicláveis ou contaminados', ex: 'O que não pode ser reciclado ou está contaminado.', dark: true },
  ];
  const binsEl = $('#bins'), detail = $('#binDetail');

  function miniBin(b, i) {
    const sym = b.id === 'branco' ? '#7d8a80' : '#ffffff';
    return `<svg viewBox="0 0 80 100" aria-hidden="true">
      <defs><clipPath id="mc${i}"><rect x="0" y="-40" width="80" height="75"/></clipPath></defs>
      <g clip-path="url(#mc${i})"><g class="m-paper">
        <rect x="23" y="38" width="34" height="42" rx="3" fill="#fff" stroke="rgba(14,36,24,.25)"/>
        <path d="M29 47h22M29 54h22M29 61h14" stroke="rgba(14,36,24,.35)" stroke-width="2" stroke-linecap="round"/>
      </g></g>
      <path d="M14 34H66L60 92Q60 96 56 96H24Q20 96 20 92Z" fill="${b.hex}" stroke="rgba(14,36,24,.28)"/>
      <g color="${sym}"><use href="#i-recycle" x="28" y="52" width="24" height="24"/></g>
      <g class="m-lid">
        <rect x="32" y="19" width="16" height="7" rx="3" fill="${b.hex}" stroke="rgba(14,36,24,.28)"/>
        <rect x="10" y="24" width="60" height="11" rx="4" fill="${b.hex}" stroke="rgba(14,36,24,.28)"/>
      </g>
    </svg>`;
  }
  function selectBin(i) {
    const b = BINS[i];
    $$('.bin-btn', binsEl).forEach((el, j) => {
      el.classList.toggle('on', i === j);
      el.setAttribute('aria-pressed', i === j);
    });
    detail.style.setProperty('--c', b.hex);
    detail.style.setProperty('--ct', b.dark ? '#0e2418' : '#fff');
    detail.innerHTML = `<p class="bd-color">${b.cor}</p><p class="bd-what">${b.what}</p><p class="bd-ex">${b.ex}</p>`;
  }
  binsEl.innerHTML = BINS.map((b, i) =>
    `<button class="bin-btn" type="button" role="listitem" data-i="${i}" data-reveal style="--i:${i}" aria-label="${b.cor}: ${b.what}">${miniBin(b, i)}<span>${b.cor}</span></button>`
  ).join('');
  ['click', 'mouseover', 'focusin'].forEach(ev =>
    binsEl.addEventListener(ev, e => {
      const btn = e.target.closest('.bin-btn');
      if (btn) selectBin(+btn.dataset.i);
    }));
  selectBin(0);

  /* =====================================================
     JOGO — onde vai cada resíduo?
     ===================================================== */
  const OPTS = [
    { id: 'azul', label: 'Azul · Papel', hex: '#2f6fd0', ct: '#fff' },
    { id: 'vermelho', label: 'Vermelho · Plástico', hex: '#d8432f', ct: '#fff' },
    { id: 'verde', label: 'Verde · Vidro', hex: '#2f9e56', ct: '#fff' },
    { id: 'amarelo', label: 'Amarelo · Metal', hex: '#f0b323', ct: '#0e2418' },
    { id: 'marrom', label: 'Marrom · Orgânico', hex: '#7a4a2b', ct: '#fff' },
    { id: 'coleta', label: 'Ponto de coleta', hex: '#f4f0e4', ct: '#0e2418' },
  ];
  const ITEMS = [
    ['📰', 'Jornal velho', 'azul'], ['🧴', 'Garrafa PET', 'vermelho'], ['🫙', 'Pote de vidro', 'verde'],
    ['🥫', 'Lata de alumínio', 'amarelo'], ['🍌', 'Casca de banana', 'marrom'], ['🔋', 'Pilha usada', 'coleta'],
    ['📦', 'Caixa de papelão', 'azul'], ['🥤', 'Copo plástico', 'vermelho'], ['📱', 'Celular quebrado', 'coleta'],
    ['🥚', 'Casca de ovo', 'marrom'],
  ];
  const gItem = $('#gameItem'), gOpts = $('#gameOpts'), gMsg = $('#gameMsg'), gScore = $('#gameScore');
  let gi = 0, score = 0, timer = 0;

  function renderRound() {
    if (gi >= ITEMS.length) {
      gItem.innerHTML = `<span class="gi-emoji">🌎</span><span class="gi-name">${score} de ${ITEMS.length} acertos</span>`;
      gOpts.innerHTML = '';
      gMsg.innerHTML = (score >= 8 ? 'Mandou muito bem! ' : 'Dá para melhorar — releia as cores acima. ') +
        '<br><button class="game-again" type="button">Jogar de novo</button>';
      gScore.textContent = '';
      return;
    }
    const [emo, name] = ITEMS[gi];
    gItem.innerHTML = `<span class="gi-emoji">${emo}</span><span class="gi-name">${name}</span>`;
    gItem.classList.remove('pop'); void gItem.offsetWidth; gItem.classList.add('pop');
    gOpts.innerHTML = OPTS.map(o =>
      `<button type="button" data-id="${o.id}" style="--c:${o.hex};--ct:${o.ct}">${o.label}</button>`).join('');
    gMsg.textContent = '';
    gScore.textContent = `${gi + 1} / ${ITEMS.length} · ${score} acerto${score === 1 ? '' : 's'}`;
  }
  $('#game').addEventListener('click', e => {
    if (e.target.closest('.game-again')) { gi = 0; score = 0; renderRound(); return; }
    const btn = e.target.closest('.game-opts button');
    if (!btn || btn.disabled) return;
    const [, name, ans] = ITEMS[gi];
    const right = OPTS.find(o => o.id === ans);
    const ok = btn.dataset.id === ans;
    $$('button', gOpts).forEach(b => {
      b.disabled = true;
      if (b.dataset.id === ans) b.classList.add('right');
    });
    if (ok) score++; else btn.classList.add('wrong');
    const where = ans === 'coleta'
      ? 'vai para um ponto de coleta (logística reversa), nunca para o lixo comum'
      : `vai na lixeira ${right.label.toLowerCase().replace(' · ', ' (')})`;
    gMsg.textContent = (ok ? 'Isso! ' : 'Quase. ') + `${name} ${where}.`;
    clearTimeout(timer);
    timer = setTimeout(() => { gi++; renderRound(); }, ok ? 1300 : 2400);
  });
  renderRound();

  /* =====================================================
     COMPROMISSOS + revelação ao rolar
     ===================================================== */
  const pledge = $('#pledge'), pledgeCount = $('#pledgeCount');
  pledge.addEventListener('change', () => {
    const n = $$('input:checked', pledge).length, total = $$('input', pledge).length;
    pledgeCount.textContent = n === 0 ? '' : n === total ? 'Todos os compromissos assumidos. O planeta agradece!' : `${n} de ${total} compromissos assumidos — continue!`;
  });

  const revealEls = $$('[data-reveal]');
  if ('IntersectionObserver' in window && !reduced) {
    const io = new IntersectionObserver(entries => {
      entries.forEach(en => {
        if (!en.isIntersecting) return;
        en.target.classList.add('in');
        io.unobserve(en.target);
      });
    }, { rootMargin: '0px 0px -8% 0px', threshold: .08 });
    // escalonamento entre irmãos
    revealEls.forEach(el => {
      if (!el.style.getPropertyValue('--i')) {
        const sib = [...el.parentElement.children].filter(c => c.hasAttribute('data-reveal'));
        el.style.setProperty('--i', Math.min(sib.indexOf(el), 6));
      }
      io.observe(el);
    });
  } else {
    revealEls.forEach(el => el.classList.add('in'));
  }
})();
