/* Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md. */
/* story.js: room 2, "How we know": seven click-through scenes that are also the talk's slides.
 Builder B, the night of Nov 13, 2026. Design: ONE_DEMO/DESIGN.md (section 9 outranks 4 to 8).
   Contract: window.Story = { mount(el, ctx), go(n), count, slides, clicks() }: count = scenes with the extras (9), slides = the talk's (7),
   clicks() = presses from the title to the final screen (30 with ending A and every setting at its default: one per line of the live script).
   ctx = { engine, adapters, layer, argentina, place, readings, go(hash), updateHash?, partsBase?, worldTable?, worldTableUrl?, notes?, still? }
   Every number is read at run time from the engine result, the adapters or Readings; this file computes no reading or word itself.
   Plain JavaScript, no outside files. null = no data, never zero. */
(function () {
  'use strict';
  const N = 11, NUM = 7, LW = 1920, LH = 1080, PW = 720;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const MON1 = ['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'];
  const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = v => v == null || !isFinite(v) ? 'no data' : (v > 0 && Math.round(v) === 0 ? 'under 1' : Math.round(v).toLocaleString('en-US'));
  const p1 = v => (Math.round(Math.abs(v) * 10) / 10).toFixed(1) + '%';
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  const ease = t => 1 - Math.pow(1 - t, 3);
  const isRef = o => !!o && typeof o === 'object' && typeof o.refused === 'string';
  const nothing = msg => `<div class="st-refusal" role="status"><b>Nothing to show here</b><span>${esc(msg)}</span></div>`;
  const placeOf = r => (r && r.area && r.area.country) || 'This place';

  let S = null; // the one mounted story

  /* ---------------- small motion helpers ---------------- */
  function tween(key, ms, fn, done) {
    cancelAnimationFrame(S.raf[key]); S.busy = S.busy || {}; S.busy[key] = false;
    if (S.still || !ms) { fn(1); if (done) done(); return; }
    const t0 = performance.now(); S.busy[key] = t0 + ms + 300;     // S.busy: until when each story animation runs (autoplay's "settled" signal); a cancelled one simply expires
    const tick = now => { const t = Math.min(1, (now - t0) / ms); fn(t); if (t < 1) S.raf[key] = requestAnimationFrame(tick); else { S.busy[key] = false; if (done) done(); } };
    S.raf[key] = requestAnimationFrame(tick);
  }
  function countUp(node, to, animate) {   // a count on screen is a measurement: printed at once at its real value; only its box arrives
    if (!node) return;
    node.textContent = fmt(to);
    const box = node.closest('.chip,.s6-card') || node;
    box.classList.remove('st-arrive'); if (animate && !S.still) { void box.offsetWidth; box.classList.add('st-arrive'); }
  }
  const svg = (w, h, inner, label, cls) => `<svg class="st-svg ${cls || ''}" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}">${inner}</svg>`;
  // chart size in stage pixels for the current layout
  const dims = (lw, lh, ph) => S.port ? { w: PW - 64, h: ph, fs: 24, big: 30 } : { w: lw, h: lh, fs: 26, big: 32 };

  /* ---------------- the satellite character (idea and drawing from the exhibit piece, work/look_4_exhibit) ---------------- */
  function satSVG(old) {
    const body = old ? '#ffd23f' : '#3ddc97', id = old ? 'stblurO' : 'stblurN';
    const panel = x => `<g transform="translate(${x},38)"><rect width="34" height="26" rx="4" fill="#2f5bff" stroke="#141414" stroke-width="4"/><path d="M11 0v26M23 0v26M0 13h34" stroke="#9fd8ff" stroke-width="2"/></g>`;
    const face = old
      ? `<g filter="url(#${id})"><circle cx="49" cy="52" r="3.5" fill="#141414"/><circle cx="71" cy="52" r="3.5" fill="#141414"/></g><circle cx="49" cy="52" r="11" fill="rgba(159,216,255,.55)" stroke="#141414" stroke-width="5"/><circle cx="71" cy="52" r="11" fill="rgba(159,216,255,.55)" stroke="#141414" stroke-width="5"/><line x1="58" y1="50" x2="62" y2="50" stroke="#141414" stroke-width="4"/><path d="M50 68q10 6 20 0" fill="none" stroke="#141414" stroke-width="4" stroke-linecap="round"/>`
      : `<circle cx="49" cy="51" r="8" fill="#fff" stroke="#141414" stroke-width="4"/><circle cx="71" cy="51" r="8" fill="#fff" stroke="#141414" stroke-width="4"/><circle cx="51" cy="52" r="3.6" fill="#141414"/><circle cx="73" cy="52" r="3.6" fill="#141414"/><path d="M42 39l12 2M78 39l-12 2" stroke="#141414" stroke-width="4" stroke-linecap="round"/><path d="M50 66q10 8 20 0" fill="#141414" stroke="#141414" stroke-width="3" stroke-linejoin="round"/>`;
    return `<svg viewBox="0 0 120 100" aria-hidden="true"><defs><filter id="${id}"><feGaussianBlur stdDeviation="1.6"/></filter></defs><line x1="60" y1="26" x2="60" y2="8" stroke="#141414" stroke-width="4"/><circle cx="60" cy="7" r="6" fill="#ff4f3a" stroke="#141414" stroke-width="4"/>${panel(2)}${panel(84)}<rect x="34" y="26" width="52" height="54" rx="16" fill="${body}" stroke="#141414" stroke-width="5"/>${face}<path d="M52 80l-4 12h24l-4-12" fill="#fff" stroke="#141414" stroke-width="4" stroke-linejoin="round"/></svg>`;
  }

  /* ---------------- character art: every picture comes through ONE manifest, img/characters/slots.json ----------------
     A slot is a role (older_idle, newer_sign, ...), a box in stage pixels, and a file. Any shape of picture is fitted inside its box
     without distortion or cropping, bottom-anchored. A missing file falls back to the Fire Detectives art for that slot (img/fire_detectives/,
     from the team lead's Fire Detectives site), so a box is never empty. Names on screen come from img/characters/cast.json.
     The built-in copy below is used until (or if) the two files load; ?slots=1 outlines every box with its id. */
  const FD = 'img/fire_detectives/';
  const SLOTS0 = {
    older_idle: { fallback: ['moe_wave'], boxWidth: 96, boxHeight: 96 }, older_looking: { fallback: ['moe_think'], boxWidth: 150, boxHeight: 150 },
    older_puzzled: { fallback: ['moe_confused'], boxWidth: 150, boxHeight: 150 }, older_sign: { fallback: ['moe_point'], boxWidth: 110, boxHeight: 110 },
    newer_idle: { fallback: ['vee_wave'], boxWidth: 148, boxHeight: 96 }, newer_looking: { fallback: ['vee_think'], boxWidth: 150, boxHeight: 150 },
    newer_surprised: { fallback: ['vee_surprised'], boxWidth: 150, boxHeight: 150 }, newer_sign: { fallback: ['vee_point'], boxWidth: 110, boxHeight: 110 },
    detective_thinking: { fallback: ['juno_think'], boxWidth: 90, boxHeight: 132 }, detective_aha: { fallback: ['juno_happy'], boxWidth: 90, boxHeight: 132 },
    detective_point: { fallback: ['juno_point'], boxWidth: 90, boxHeight: 132 },
    both_together: { fallback: ['moe_happy', 'vee_happy'], boxWidth: 260, boxHeight: 130 }
  };
  const CAST0 = { older: { name: 'Moe', camera: 'MODIS' }, newer: { name: 'Vee', camera: 'VIIRS' }, detective: { name: 'Juno', camera: null } };
  const slotDef = id => Object.assign({}, SLOTS0[id] || {}, (S && S.slots && S.slots[id]) || {});
  const fbFile = f => FD + (/\./.test(f) ? f : f + '.webp');
  const fbImgs = (d, alt) => (d.fallback || []).map(f => `<img src="${fbFile(f)}" alt="${esc(alt)}" draggable="false">`).join('');
  function slot(id, cls) {      // an HTML box for one slot
    const d = slotDef(id), alt = d.alt || '';
    const inner = d.file && S && S.slotsLoaded ? `<img src="${esc(d.file)}" alt="${esc(alt)}" draggable="false" onerror="Story._fallback(this)">` : fbImgs(d, alt);
    return `<span class="slot ${cls || ''}" data-slot="${id}" style="width:${d.boxWidth}px;height:${d.boxHeight}px">${inner}</span>`;
  }
  function slotSVG(id, cx, bottom, scale) {      // the same, inside an SVG chart: the box's bottom-center at (cx, bottom)
    const d = slotDef(id), k = scale || 1, w = d.boxWidth * k, h = d.boxHeight * k, x = cx - w / 2, y = bottom - h;
    const real = !!(d.file && S && S.slotsLoaded), files = real ? [d.file] : (d.fallback || []).map(fbFile), each = w / Math.max(1, files.length);
    return `<g class="slot-svg" data-slot="${id}">${files.map((f, i) => `<image href="${esc(f)}" x="${(x + i * each).toFixed(1)}" y="${y.toFixed(1)}" width="${each.toFixed(1)}" height="${h.toFixed(1)}" preserveAspectRatio="xMidYMax meet"${real ? ' onerror="Story._fallback(this)"' : ''}/>`).join('')}` +
      (S && S.slotDebug ? `<rect x="${x.toFixed(1)}" y="${y.toFixed(1)}" width="${w.toFixed(1)}" height="${h.toFixed(1)}" class="slot-dbg"/><text x="${(x + 4).toFixed(1)}" y="${(y + 18).toFixed(1)}" class="slot-dbg-t">${id}</text>` : '') + `</g>`;
  }
  function slotFallback(img) {       // a missing file: put the Fire Detectives art for that slot back in its place
    const box = img.closest('[data-slot]'); if (!box) return;
    const d = slotDef(box.dataset.slot);
    if (box.tagName.toLowerCase() === 'g') {
      const x = +img.getAttribute('x'), y = +img.getAttribute('y'), w = +img.getAttribute('width'), h = +img.getAttribute('height');
      const files = (d.fallback || []).map(fbFile), each = w / Math.max(1, files.length);
      const ns = 'http://www.w3.org/2000/svg';
      files.forEach((f, i) => { const im = document.createElementNS(ns, 'image'); im.setAttribute('href', f); im.setAttribute('x', x + i * each); im.setAttribute('y', y);
        im.setAttribute('width', each); im.setAttribute('height', h); im.setAttribute('preserveAspectRatio', 'xMidYMax meet'); box.insertBefore(im, img); });
      img.remove(); return;
    }
    box.innerHTML = fbImgs(d, d.alt || ''); aiMark();
  }
  const castName = role => `<span data-cast="${role}">${esc(((S && S.cast && S.cast[role]) || CAST0[role] || {}).name || '')}</span>`;
  const plain = h => String(h).replace(/<[^>]+>/g, '');      // a cast name (or any small HTML) as plain text, for SVG text and aria labels
  // slide 2's questions as plain pinned notes on the cork board (team lead, 1:13 PM: the AI-drawn kid detective comes off slide 2)
  // 1:36 PM: a hand-drawn team character stands where the AI-drawn detective was; the questions are her speech again (no name label)
  const pin = q => `<div class="s2-human"><img src="img/characters/team_human_scientist.png" alt="" draggable="false"><p class="fd-bubble">${esc(q)}</p></div>`;
  const juno = (slotId, q) => `<div class="fd-juno">${slot(slotId)}<p class="fd-bubble"><span class="who juno">${castName('detective')}</span>${esc(q)}</p></div>`;
  /* One mark per screen (team lead, 6:43 PM: "watermark every page and are upfront in our writeup"): whenever a picture made with an AI
     image tool is on the current screen, one line shows in the stage's top-right corner. The list of AI-made pictures is AI_ART (folders);
     a hand-drawn picture placed in a slot (img/characters/) is not on it, so the mark leaves those screens by itself. */
  const AI_ART = ['img/fire_detectives/', 'img/explainer/'];
  const AI_TEXT = 'Some art on this screen was made with an AI image tool';
  function aiMark() {
    if (!S || !S.aiMark) return;
    const sec = S.secs && S.secs[S.cur];
    const shown = el => !el.closest('.st-only:not(.on),.st-step:not(.on),.st-step0.off,.s5-x:not(.on),[hidden]') && el.getClientRects().length;
    const on = !!sec && [...sec.querySelectorAll('img,image')].some(el => { const src = el.getAttribute('src') || el.getAttribute('href') || '';
      return AI_ART.some(f => src.includes(f)) && shown(el); });
    S.aiMark.hidden = !on;
  }
  function loadArt() {      // the manifest and the cast, read once; then every box on the stage is refreshed
    const get = u => fetch(u).then(r => r.ok ? r.json() : null).catch(() => null);
    Promise.all([get(S.ctx.slotsUrl || 'img/characters/slots.json'), get(S.ctx.castUrl || 'img/characters/cast.json')]).then(([sl, ca]) => {
      if (sl && sl.slots) { S.slots = sl.slots; S.slotsLoaded = true; }
      if (ca && ca.cast) S.cast = ca.cast;
      S.root.querySelectorAll('span.slot[data-slot]').forEach(b => { const n = document.createElement('span'); n.innerHTML = slot(b.dataset.slot, [...b.classList].filter(c => c !== 'slot').join(' ')); b.replaceWith(n.firstChild); });
      S.root.querySelectorAll('[data-cast]').forEach(e => { const c = S.cast && S.cast[e.dataset.cast]; if (c && c.name) e.textContent = c.name; });
      S.scenes.forEach(sc => sc.layout && sc.layout());
      accentsFromSlots(); aiMark();
    });
  }

  /* =====================================================================================================
     One journey (art direction, 11:44 and 11:45 AM): the stage's look is ONE set of style variables indexed by slide, interpolated
     whenever the slide changes: sky top and bottom, paper dots, stars, glow, the ground, the desk-and-screen, character scale and
     headline weight. Ground in daylight (1), dusk (2), orbit (3 to 5), a desk at night with the page on a screen (6, 7).
     The two camera colors are two variables, --cam-older and --cam-newer, set on the story AND on the page's root element so the
     product pages can read them; they come from the characters (see readAccent) with today's values as the fallback.
     ===================================================================================================== */
  const CAM0 = { older: '#3f3a8f', newer: '#a6c3e4' };   // the artist's two satellites: the older one's indigo panels, the newer one's sky blue (yellow is on both, so it is never a camera color)
  const CAM0_NOTE = 0;   // the artist's older satellite: its deep indigo panels; the newer camera: a magenta from the newer satellite's purple, kept far from the indigo
  const GOLD = '#ffcd79', GOLD_PAPER = '#e39d12';
  /* The climb (team lead, 12:54 PM: "gradually transition from earth to space"): ONE number, the altitude, rises a little on every press
     from the title to slide 5, and the sky, the paper dots, the stars, the hills, the clouds, the curve of the Earth, the glow, the
     character scale and the headline weight all come from it, so no press changes more than a small step. Slides 6 and 7 come back
     down to a desk at night (the desk and the screen); slide 5's last press starts that descent. Extras are back in orbit. */
  const SHOW_EX = () => !(window.StoryBeats && window.StoryBeats.showExplainer === false);
  // historyScale (team lead's question, 12:39 AM; default 'moe'): 'vee' lifts the older years UP to Vee's scale
  // in the pictures of the long record (slide 2's one-scale screen, slide 3's last screen, slide 6's charts and the world chart), instead of
  // bringing Vee's years down. Slides 4 and 5 stay on Moe's scale: they are scored against Moe's own counts. Vee's scale = Readings.onScale(r, 'viirs').
  let ROOM0 = 5;      // the first slide drawn as the desk at night (4 in the 9:19 AM order)
  const SHOW_WAVE = () => !!(window.StoryBeats && window.StoryBeats.showWave === true);
  const VEE = () => !(window.StoryBeats && window.StoryBeats.historyScale === 'moe');      // default Vee's scale since 8:21 AM
  const MEET = () => !(window.StoryBeats && window.StoryBeats.showCharacterMoment === false);
  const DEEP_PAGE = (window.StoryBeats && window.StoryBeats.explainerDeepPage) || 'explainer_deep_clue2';   // or explainer_deep_clue6, explainer_deep_clue1
  const ALT = [[0, .045, .09], [.14, .19, .245], [.31, .36, .5, .64], [.74, .79, .83], [.87, .89, .84], [1], [1], [.8, .8], [.8, .8]];
  const DESK = { '4:2': .35, 5: 1, 6: 1 };
  const SKY_TOP = [[0, '#bfe0f6'], [.09, '#adcdee'], [.16, '#929fd3'], [.25, '#7d84c2'], [.33, '#3c4386'], [.44, '#1d2458'], [.56, '#0d1534'], [.7, '#040a18'], [1, '#030915']];
  const SKY_BOT = [[0, '#fdf5e6'], [.09, '#fbe9cc'], [.16, '#f7d8b9'], [.25, '#eebaa0'], [.33, '#a77d92'], [.44, '#4a3f6c'], [.56, '#1c2448'], [.7, '#0b1a30'], [1, '#0b1828']];
  const hexRGB = h => [1, 3, 5].map(i => parseInt(h.slice(i, i + 2), 16));
  const clamp01 = x => Math.max(0, Math.min(1, x));
  function along(stops, a) { let k = 0; while (k < stops.length - 2 && a > stops[k + 1][0]) k++;
    const [a0, c0] = stops[k], [a1, c1] = stops[k + 1], t = clamp01((a - a0) / (a1 - a0)), x = hexRGB(c0), y = hexRGB(c1); return x.map((v, i) => v + (y[i] - v) * t); }
  function styleAt(n, step) {
    const row = ALT[Math.max(0, Math.min(ALT.length - 1, n))], a = row[Math.max(0, Math.min(row.length - 1, step))];
    const desk = DESK[n + ':' + step] != null ? DESK[n + ':' + step] : DESK[n] != null ? DESK[n] : 0, room = n >= ROOM0 && n <= 6;
    const night = room ? { top: hexRGB('#0b1019'), bot: hexRGB('#1b140e') } : null;
    return { alt: room ? .9 : a, top: night ? night.top : along(SKY_TOP, a), bot: night ? night.bot : along(SKY_BOT, a),
      dots: .08 * clamp01(1 - a / .2), stars: room ? 0 : clamp01((a - .14) / .4) * (1 - desk * .6), glow: room ? 0 : clamp01((a - .5) / .2) * (1 - desk),
      ground: clamp01(1 - a / .3), screen: room ? 1 : 0, desk, chr: clamp01(1.05 - a * .7), hw: a < .45 ? 700 : a < .6 ? 600 : 500 };
  }
  function paintStyle(c) {
    const st = S.stage.style, rgb = a => `rgb(${a.map(Math.round).join(',')})`;
    st.setProperty('--sky-top', rgb(c.top)); st.setProperty('--sky-bot', rgb(c.bot));
    ['alt', 'dots', 'stars', 'glow', 'ground', 'screen', 'desk', 'chr'].forEach(k => st.setProperty('--' + k, c[k].toFixed(3)));
    st.setProperty('--hw', String(Math.round(c.hw / 100) * 100));
  }
  function styleTo(n, step, ms) {
    const to = styleAt(n, step), from = S.sty || to;
    tween('sky', S.still ? 0 : ms, t => {
      const k = ease(t), c = {};
      for (const key of Object.keys(to)) c[key] = Array.isArray(to[key]) ? to[key].map((v, i) => from[key][i] + (v - from[key][i]) * k) : from[key] + (to[key] - from[key]) * k;
      S.sty = c; paintStyle(c);
    });
  }
  function setCams(c) {      // the two camera colors, on the story and on the page's root element (for the product pages)
    S.cams = c;
    const hi = (h, k) => '#' + hexRGB(h).map(v => Math.round(v + (255 - v) * k).toString(16).padStart(2, '0')).join('');   // the same color, lighter, for night skies
    [S.root, document.documentElement].forEach(el => { el.style.setProperty('--cam-older', c.older); el.style.setProperty('--cam-newer', c.newer); });
    S.root.style.setProperty('--cam-older-hi', hi(c.older, .45)); S.root.style.setProperty('--cam-newer-hi', hi(c.newer, .42));
    const ink = h => { const v = hexRGB(h), l = (Math.max(...v) + Math.min(...v)) / 510; return l < .55 ? h : '#' + v.map(x => Math.round(x * .5).toString(16).padStart(2, '0')).join(''); };   // a darker version for words on light paper
    S.root.style.setProperty('--cam-older-ink', ink(c.older)); S.root.style.setProperty('--cam-newer-ink', ink(c.newer));
    if (S.scenes) S.scenes.forEach(sc => sc.layout && sc.layout());
  }
  // the dominant accent of a character drawing: the commonest strong hue, leaving out yellows and reds (gold is our record, ember is fire)
  function readAccent(url) {
    return new Promise(ok => {
      const im = new Image();
      im.onload = () => { try {
        const c = document.createElement('canvas'); c.width = c.height = 64; const g = c.getContext('2d'); g.drawImage(im, 0, 0, 64, 64);
        const px = g.getImageData(0, 0, 64, 64).data, bins = Array.from({ length: 24 }, () => ({ n: 0, r: 0, g: 0, b: 0 })); let all = 0;
        for (let i = 0; i < px.length; i += 4) {
          if (px[i + 3] < 200) continue; all++;
          const r = px[i] / 255, gg = px[i + 1] / 255, b = px[i + 2] / 255, mx = Math.max(r, gg, b), mn = Math.min(r, gg, b), d = mx - mn;
          if (mx < .3 || d / mx < .4) continue;
          let h = mx === r ? ((gg - b) / d) % 6 : mx === gg ? (b - r) / d + 2 : (r - gg) / d + 4; h = (h * 60 + 360) % 360;
          if (h < 80 || h > 340) continue;
          const k = Math.floor(h / 15); bins[k].n++; bins[k].r += px[i]; bins[k].g += px[i + 1]; bins[k].b += px[i + 2];
        }
        const top = bins.reduce((a, b) => b.n > a.n ? b : a);
        ok(all && top.n / all > .03 ? '#' + [top.r, top.g, top.b].map(v => Math.round(v / top.n).toString(16).padStart(2, '0')).join('') : null);
      } catch (e) { ok(null); } };
      im.onerror = () => ok(null); im.src = url;
    });
  }
  function accentsFromSlots() {
    const pick = id => { const d = slotDef(id); return d.accent ? Promise.resolve(d.accent) : d.file && S.slotsLoaded ? readAccent(d.file) : Promise.resolve(null); };
    Promise.all([pick('older_idle'), pick('newer_idle')]).then(([o, n]) => {
      const hue = h => { const [r, g, b] = hexRGB(h).map(v => v / 255), mx = Math.max(r, g, b), d = mx - Math.min(r, g, b); if (!d) return 0;
        const x = mx === r ? ((g - b) / d) % 6 : mx === g ? (b - r) / d + 2 : (r - g) / d + 4; return (x * 60 + 360) % 360; };
      const older = o || CAM0.older; let newer = n || CAM0.newer;
      const gap = Math.abs(hue(older) - hue(newer)), far = Math.min(gap, 360 - gap);
      const light = h => { const [r, g, b] = hexRGB(h); return (Math.max(r, g, b) + Math.min(r, g, b)) / 510; };
      if (far < 40 && Math.abs(light(older) - light(newer)) < .3) newer = Math.abs(hue(older) - hue(CAM0.newer)) > 40 ? CAM0.newer : '#14a39a';   // the two cameras must never look alike (hue or lightness apart)
      setCams({ older, newer });
    });
  }
  // the star field (drawn once, seeded) and the horizon of slides 1 and 2
  function starsSVG() {
    let s = 11, out = ''; const rnd = () => (s = (s * 16807) % 2147483647) / 2147483647;
    for (let i = 0; i < 190; i++) { const x = rnd() * 1920, y = rnd() * 1080, r = rnd() < .12 ? 2.2 : rnd() < .5 ? 1.4 : .9; out += `<circle cx="${x.toFixed(0)}" cy="${y.toFixed(0)}" r="${r}" opacity="${(.35 + rnd() * .65).toFixed(2)}"/>`; }
    for (let i = 0; i < 6; i++) { const x = rnd() * 1920, y = rnd() * 700; out += `<path d="M${x} ${y - 9}L${x + 2} ${y - 2}L${x + 9} ${y}L${x + 2} ${y + 2}L${x} ${y + 9}L${x - 2} ${y + 2}L${x - 9} ${y}L${x - 2} ${y - 2}Z" opacity=".9"/>`; }
    return `<svg viewBox="0 0 1920 1080" preserveAspectRatio="xMidYMid slice" fill="#fff">${out}</svg>`;
  }
  const HORIZON = `<svg viewBox="0 0 1920 330" preserveAspectRatio="none">
    <path d="M0 120 C 260 60 520 70 760 110 S 1260 150 1500 90 S 1800 60 1920 85 V330 H0Z" fill="#a9d68b"/>
    <path d="M0 175 C 300 130 640 150 900 175 S 1450 205 1920 150 V330 H0Z" fill="#86c26a"/>
    <path d="M140 230 C 380 205 620 215 820 238 S 1180 262 1380 236 S 1700 214 1920 232 V330 H0 V250Z" fill="#6aae55"/>
    <path d="M420 262 C 600 246 780 258 980 270 S 1360 284 1560 266" fill="none" stroke="#7cc6e8" stroke-width="16" stroke-linecap="round" opacity=".9"/>
    <ellipse cx="1180" cy="292" rx="120" ry="14" fill="#8fd0ee" opacity=".85"/><ellipse cx="300" cy="300" rx="90" ry="11" fill="#8fd0ee" opacity=".8"/>
    ${[90, 210, 640, 1010, 1640, 1790].map((x, i) => `<g transform="translate(${x},${150 + (i % 3) * 22})"><rect x="-4" y="10" width="8" height="22" fill="#6b4f2e"/><circle r="26" fill="#3f8f45"/><circle cx="-14" cy="8" r="18" fill="#3f8f45"/><circle cx="15" cy="8" r="18" fill="#357d3c"/></g>`).join('')}</svg>`;

  /* ---------------- the wave: "the same years, laid flat" (after the Hot-Spot Clock's strip): Argentina's months, mirrored
     around a line so the record breathes; the camera change is marked. t = 0: glued (the newer camera as it counts from 2022);
     t = 1: on one scale. Every bar is the engine's own month. ---------------- */
  function waveData(r, rv) {
    if (!r || !Array.isArray(r.monthly)) return null;
    const vOf = {}; if (rv && Array.isArray(rv.monthly)) for (const x of rv.monthly) vOf[x.ym] = x.value;
    const rows = r.monthly.filter(x => x.ym >= '2001-01' && x.value != null);
    const newCam = x => x.carrier && x.carrier !== 'Aqua' && x.carrier !== 'Terra' && x.raw && x.raw[x.carrier] != null;
    const M = rows.map(x => { const y = +x.ym.slice(0, 4); return { ym: x.ym, y, ours: x.value, glued: y >= 2022 && newCam(x) ? x.raw[x.carrier] : x.value, partial: x.status === 'partial', vee: vOf[x.ym] != null ? vOf[x.ym] : null }; });
    // on Vee's scale, before 2022 each month = what Moe counted (the record on Moe's scale) + what the translation adds
    if (!M.length) return null;
    const after = M.filter(m => m.y >= 2022 && !m.partial), sum = k => after.reduce((a, m) => a + m[k], 0);
    const ratio = after.length && sum('ours') > 0 ? sum('glued') / sum('ours') : null;
    const hasV = rv && M.every(m => m.vee != null);
    return { M, ratio, maxG: Math.max(...M.map(m => m.glued)), maxO: Math.max(...M.map(m => m.ours)), maxV: hasV ? Math.max(...M.map(m => m.vee)) : null, first: M[0].y, last: M[M.length - 1].y };
  }
  const timesVerb = r => r == null ? 'jumps' : r >= 2.6 && r < 3.5 ? 'suddenly triples' : r >= 1.7 && r < 2.6 ? 'suddenly doubles' : r >= 3.5 ? 'jumps about ' + NUMW[Math.round(r)] + 'fold' : 'jumps';
  function waveSVG(W, opt) {
    const { w, h, fs } = opt, t = opt.t || 0, L = 8, R = 8, top = fs + 16, B = fs + 14, mid = top + (h - top - B) / 2, half = (h - top - B) / 2;
    const n = W.M.length, slotW = (w - L - R) / n, bw = Math.max(1.5, slotW * .72), x = i => L + i * slotW + (slotW - bw) / 2;
    const vee = !!(opt.vee && W.maxV), m0 = opt.fromMoe ? W.maxO : W.maxG, max = m0 + ((vee ? W.maxV : W.maxO) - m0) * t;
    const lerp = (a, b, k) => `color-mix(in srgb, ${b} ${(k * 100).toFixed(0)}%, ${a})`;
    const i22 = W.M.findIndex(m => m.y >= 2022), i12 = W.M.findIndex(m => m.y >= 2012), i21 = W.M.findIndex(m => m.y >= 2022) - 1;
    const bars = W.M.map((m, i) => { const v = vee ? (m.y >= 2022 ? (opt.fromMoe ? m.ours : m.glued) + (m.vee - (opt.fromMoe ? m.ours : m.glued)) * t : m.ours + (m.vee - m.ours) * t) : m.y >= 2022 ? m.glued + (m.ours - m.glued) * t : m.ours;
      if (vee && t > 0) {      // two tones: the added part (light, behind) and Moe's own part (his color, in front); 2022 on: Vee, solid
        const hh = Math.max(1, half * Math.min(1.08, v / max)), op = m.partial ? .45 : .95;
        if (m.y >= 2022) return `<rect x="${x(i).toFixed(1)}" y="${(mid - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${(2 * hh).toFixed(1)}" class="wv-v" opacity="${op}"/>`;
        const mh = Math.max(1, half * Math.min(1.08, m.ours / max));
        return `<rect x="${x(i).toFixed(1)}" y="${(mid - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${(2 * hh).toFixed(1)}" class="wv-a" opacity="${op}"/>` +
          `<rect x="${x(i).toFixed(1)}" y="${(mid - mh).toFixed(1)}" width="${bw.toFixed(1)}" height="${(2 * mh).toFixed(1)}" class="${m.y < 2003 ? 'wv-t' : 'wv-m'}" opacity="${op}"/>`;
      }
      const hh = Math.max(1, half * Math.min(1.08, v / max));
      const fill = m.y >= 2022 ? lerp('var(--cam-newer-hi)', GOLD, t) : lerp('var(--cam-older-hi)', GOLD, t);
      return `<rect x="${x(i).toFixed(1)}" y="${(mid - hh).toFixed(1)}" width="${bw.toFixed(1)}" height="${(2 * hh).toFixed(1)}" style="fill:${fill}" opacity="${m.partial ? .45 : .92}"/>`; }).join('');
    const ticks = W.M.map((m, i) => m.ym.endsWith('-01') && (m.y % 5 === 0 || m.y === W.first) ? `<text x="${(L + i * slotW).toFixed(1)}" y="${h - 6}" style="font-size:${fs}px">${m.y}</text>` : '').join('');
    let marks = '';
    const band = (a, b, cls, label, anchor) => { const x0 = L + a * slotW, x1 = L + (b + 1) * slotW;
      return `<rect x="${x0.toFixed(1)}" y="${top - 4}" width="${(x1 - x0).toFixed(1)}" height="${(h - top - B + 8).toFixed(1)}" class="wv-band ${cls}"/>` +
        (label ? `<text x="${anchor === 'end' ? x1.toFixed(1) : anchor === 'before' ? (x0 - 10).toFixed(1) : ((x0 + x1) / 2).toFixed(1)}" y="${fs}" text-anchor="${anchor === 'before' ? 'end' : anchor || 'middle'}" class="${cls}" style="font-size:${fs}px">${esc(label)}</text>` : ''); };
    if (opt.overlap && i12 >= 0 && i21 > i12) marks += band(i12, i21, 'wv-both', 'both cameras flying, 2012–2021', 'before');
    if (opt.held != null) { const a = W.M.findIndex(m => m.y === opt.held), b = W.M.map(m => m.y).lastIndexOf(opt.held); if (a >= 0) marks += band(a, b, 'wv-held', opt.held + ', left out'); }
    if (opt.check) { const b = W.M.map(m => m.y).lastIndexOf(W.last - (W.M[n - 1].partial ? 1 : 0)); if (i22 >= 0 && b > i22) marks += band(i22, b, 'wv-check', 'MODIS alone, the check', 'end'); }
    if (i22 >= 0) { const xc = L + i22 * slotW - 1;
      marks += `<line x1="${xc.toFixed(1)}" x2="${xc.toFixed(1)}" y1="${top - 6}" y2="${h - B + 4}" class="wv-change"/>`;
      if (opt.say !== false && !(vee && t > .5)) {
        const k = W.ratio ? Math.round(W.ratio) : null, words = t < .5 ? (k && k >= 2 ? `as it comes: about ${NUMW[k] || k} times higher from 2022` : 'as it comes: higher from 2022') : vee ? "on Vee's scale: it keeps breathing evenly" : 'on one scale: it keeps breathing evenly';
        marks += `<text x="${(S.port ? w - R : xc - 10).toFixed(1)}" y="${fs}" text-anchor="end" class="${t < .5 ? 'wv-ember' : 'wv-gold'}" style="font-size:${fs}px">${S.port ? words.replace(/^as it comes: /, '').replace(/^on one scale: /, 'one scale: ') : words}</text>` +
          `<text x="${(xc + 8).toFixed(1)}" y="${h - B + fs + 2}" class="wv-ember" style="font-size:${fs}px">camera change</text>`;
      } }
    if (vee && t > .5) {      // the three tones, named at the top left
      const items = [['wv-m', 'Moe counted'], ['wv-a', 'added: what Vee would likely have seen'], ['wv-v', 'Vee counted'], ['wv-t', 'before 2003: an earlier satellite']]; let xx = L;
      marks += items.map(([c, txt]) => { const g = `<rect x="${xx}" y="${fs - 15}" width="26" height="15" class="${c}"/><text x="${xx + 34}" y="${fs}" class="wv-kt" style="font-size:${fs}px">${esc(txt)}</text>`; xx += 34 + txt.length * fs * .62 + 24; return g; }).join('');
    }
    const label = `The same years, laid flat: Argentina's fire detections month by month, ${W.first} to ${W.last}, drawn above and below a line so the record breathes with the seasons. ` +
      (t < .5 ? `Glued as they come, the newer camera takes over in 2022 and the wave ${timesVerb(W.ratio)}: from 2022 it is about ${W.ratio ? W.ratio.toFixed(1) : '?'} times our record on one scale.` : 'On one scale, it keeps breathing evenly through the camera change in 2022.');
    return `<svg class="st-svg wv-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}">${marks}<line x1="${L}" x2="${w - R}" y1="${mid}" y2="${mid}" class="wv-mid"/>${bars}${ticks}</svg>`;
  }
  function waveBlock(cls) {
    return `<div class="st-wave ${cls || ''}"><p class="wv-cap"><b>Argentina's fire, month by month:</b> one bar per month, drawn above and below the line; each year's rise and fall is its fire season.</p><div class="wv-box"></div></div>`;
  }
  function drawWave(sec, W, opt) { if (!SHOW_WAVE()) return; return drawWaveG(sec, W, opt); }
  function drawWaveG(sec, W, opt) {
    const box = sec && sec.querySelector('.wv-box'); if (!box || !W) return;
    box.innerHTML = waveSVG(W, Object.assign(S.port ? { w: 656, h: 190, fs: 23 } : { w: 1650, h: 182, fs: 22 }, opt));
  }

  /* =====================================================================================================
     The title state (before slide 1, not counted) and slide 1. How do we know where it's burning?
     Order (TEACHING_ORDER.md): the opening question; then ONE camera and what a dot is; only then the second camera, its count and the line.
     ===================================================================================================== */

  // the pixel grids on the flip back (redline 9:02 AM; a pencil, StoryBeats.showPixelGrids = false removes it): one 5 km patch of the map,
  // cut into Moe's squares (about 1 km) and Vee's (about 375 m), true to scale against each other
  const SHOW_GRIDS = () => !(window.StoryBeats && window.StoryBeats.showPixelGrids === false);
  function pixelGrids() {
    const one = (step, cls, title, sub) => { const n = Math.ceil(1 / step), lines = [];
      for (let k = 1; k < n; k++) { const v = (k * step * 100).toFixed(2); lines.push(`<line x1="${v}" y1="0" x2="${v}" y2="100"/><line x1="0" y1="${v}" x2="100" y2="${v}"/>`); }
      return `<figure class="s1-g ${cls}"><svg viewBox="0 0 100 100" aria-hidden="true"><rect x="0" y="0" width="100" height="100" class="bg"/><g class="ln">${lines.join('')}</g><rect x="0" y="0" width="100" height="100" class="fr"/></svg>
        <figcaption><b>${title}</b><span>${sub}</span></figcaption></figure>`; };
    return `<div class="s1-grids" aria-label="One 5 km patch of this map, cut into each camera's squares: Moe's are about 1 km across, Vee's about 375 m." role="img">
      <span class="s1-gpatch" aria-hidden="true"></span>
      <div class="s1-gbox"><p class="s1-gt">One 5 km patch of this map</p><div class="s1-grow">${one(1 / 5, 'o', plain(castName('older')) + "'s squares", 'about 1 km')}${one(375 / 5000, 'n', plain(castName('newer')) + "'s squares", 'about 375 m')}</div></div></div>`;
  }
  // the song screen (10:46 AM): the family's own words, exactly as written; Moe beside the MODIS verse, Vee beside the VIIRS verse
  const SONG = [["Round the earth by night and day,", "MODIS and VIIRS are scanning,", "Gathering up the signs of fires.", "So humans can take warning."], ["MODIS is the older tool,", "Gliding the sky by satellite.", "A photo path but with some gaps,", "At the equator - missing insight."], ["VIIRS, with pixels extra sharp", "Does her daily scannings.", "With a clearer view at night,", "For seeing fire warnings."], ["Combine the data. Get more clues.", "Study history's records.", "That's how we predict the threats,", "and take appropriate measures."]];
  // the song's credit, in the team lead's own words (2:07 PM, Sun Nov 15): he asked for the songwriter to be named on this screen
  const SONG_CREDIT = 'Music: Folk Tune from Newfoundland, Canada · Words: Myrna Mong';
  function songScreen(at) {
    const verse = (v, k) => `<div class="sg-v v${k}">${k === 1 ? `<div class="sg-who o">${slot('older_idle')}</div>` : k === 2 ? `<div class="sg-who n">${slot('newer_idle')}</div>` : ''}<p>${v.map(l => esc(l)).join('<br>')}</p></div>`;
    return `<div class="s1-song st-only" data-only="${at}" role="group" aria-label="Our song, four verses"><span class="sg-note a" aria-hidden="true">♪</span><span class="sg-note b" aria-hidden="true">♫</span><span class="sg-note c" aria-hidden="true">♪</span>
      <div class="sg-grid">${SONG.map(verse).join('')}</div><p class="sg-credit">${esc(SONG_CREDIT)}</p></div>`;
  }
  function scene1() {
    // the explainer press (team lead, 6:37 PM: "show off a few screens and what we built really fast"): one press after the title,
    // switched off by StoryBeats.showExplainer = false; X shifts slide 1's later presses by one
    // two explainer presses when on: the fan of four screens, then one deep page shown large (team lead, 7:25 PM: "show one page in greater detail")
    // Order (team lead, 9:05 PM, ruled: "I like your idea for the flip back"): title; the fan; Moe; Vee; the flip back to Moe ending on the
    // question; then the deep page as the answer. With StoryBeats.showExplainer = false: title; Moe; Vee; the flip back.
    // 10:42 AM: a second screen states the challenge (StoryBeats.showChallenge = false removes it); C shifts every later press by one
    const C = !(window.StoryBeats && window.StoryBeats.showChallenge === false) ? 1 : 0, TQ = !!(window.StoryBeats && window.StoryBeats.titleQuestion === true);
    // 1:46 PM: the flip back to Moe leaves the click path (StoryBeats.showFlipBack = true brings it back); with it the hold button goes
    const FB = !!(window.StoryBeats && window.StoryBeats.showFlipBack === true) ? 1 : 0;
    const X = SHOW_EX() ? 1 : 0, o1 = String(1 + X + C), o2 = String(2 + X + C), o3 = FB ? String(3 + X + C) : '', oDeep = X ? 3 + X + C + FB : -9;
    // 10:46 AM: the family's song, a press of its own after the deep page (StoryBeats.showSong = false removes it). Sung live; nothing plays.
    const SG = !(window.StoryBeats && window.StoryBeats.showSong === false) ? 1 : 0, oSong = 3 + X + C + FB + X;
    const sc = { steps: 3 + 2 * X + C + FB + SG, title: "How do we know where it's burning?", wide: false, cls: 's1' + (FB ? '' : ' s1-nohold') };
    let d = null, sec, cv, base = 0, view = 0, shown = -1, twinkle = 1, thr = null, layers = {}, heat = {}, stepNow = 0, faces = '';
    sc.build = s => {
      sec = s;
      s.innerHTML = `
        <div class="s1-title st-only" data-only="0"><p class="st-eyebrow">${TQ ? 'Two Cameras, One Calendar · ' : ''}NASA Space Apps 2026</p>
          ${TQ ? `<h2 class="t-q">Is the world burning <em>more than it used to?</em></h2>
          <p class="t-bridge">To answer, we have to look from space.</p>` : `<h2 class="t-q">Two Cameras, <em>One Calendar</em></h2>
          <p class="t-bridge">Spark Squad, a homeschool family team</p>`}<div class="t-pair">${slot('both_together')}</div>
          <button type="button" class="st-play" data-noclick aria-label="Play the whole talk with its narration">▶ Play the talk</button></div>
        ${C ? `<div class="s1-title s1-ch st-only" data-only="1"><p class="st-eyebrow">NASA Space Apps Challenge 2026</p>
          <h2 class="t-ch">The challenge: <em>Harmonization of MODIS and VIIRS Hot Spots</em></h2>
          <ol class="t-chl"><li>Satellites have tracked fire hot spots for more than twenty years.</li>
            <li>The older camera is being replaced by a newer one, and their records can't be compared directly.</li>
            <li>Harmonize them into one burning calendar, in a web application, so “the sensor of origin no longer matters”.<small class="t-chsrc">NASA's challenge text</small></li></ol>
          <div class="t-chpair"><figure>${slot('older_idle')}<figcaption>MODIS, the older camera</figcaption></figure><figure>${slot('newer_idle')}<figcaption>VIIRS, the newer camera</figcaption></figure></div></div>` : ''}
        ${SG ? songScreen(oSong) : ''}
        ${X ? `<div class="s1-ex st-only" data-only="${1 + C}" role="img" aria-label="Four screens of Fire Detectives, the fire-data mystery we built first for our kids: its home page, two clue pages and its case board.">
          <p class="s1-ex-line">First, we built a fire-data mystery for our kids: <b>Fire Detectives.</b></p>
          <p class="s1-ex-sub">It's where our two satellite characters come from.</p>
          <div class="s1-ex-fan">${['home', 'clue1', 'clue2', 'board'].map((n, k) => `<img class="s1-ex-card c${k}" src="img/explainer/explainer_${n}.webp" alt="" draggable="false">`).join('')}</div>
          </div>
        <div class="s1-deep st-only" data-only="${oDeep}" role="img" aria-label="Inside Fire Detectives, Clue 02, How it works: why does Vee spot more hot spots than Moe? Each camera cuts the ground into squares and takes one heat reading per square; a small fire heats only part of its square; a hot spot is a square that reads much hotter than the squares around it; Vee's camera is also more sensitive, most of all at night.">
          <p class="s1-deep-trail"><span>Case home</span> › <span>Part 1: How the detectives see</span> › <span>Clue 02: Why does Vee spot more hot spots than Moe?</span> › <b>How it works</b></p>
          <img class="s1-deep-page" src="img/explainer/${DEEP_PAGE}.webp" alt="" draggable="false"></div>` : ''}
        <header class="st-head st-only" data-only="${o1}${o2}${o3}"><p class="st-eyebrow">Corrientes wetlands, Argentina · August 1–15, 2020</p>
          <h2 class="st-h">How do we know <em>where it's burning?</em></h2></header>
        <div class="st-pic st-only" data-only="${o1}${o2}${o3}"><div class="st-exhibit fd-spread s1-spread cam-o">
            <span class="s1-cloud a cl" aria-hidden="true"></span><span class="s1-cloud b cl" aria-hidden="true"></span>
            <div class="s1-hill" aria-hidden="true"></div>
            <svg class="s1-beam" viewBox="0 0 1120 720" preserveAspectRatio="none" aria-hidden="true"><polygon class="bo" points="140,190 205,190 840,215 296,690"/><polygon class="bn" points="915,190 980,190 824,690 280,215"/></svg>
            <div class="s1-sat old" aria-hidden="true"></div><div class="s1-sat new" aria-hidden="true"></div>
            <div class="ex-picwrap"><canvas class="ex-canvas" role="img" aria-label="Loading the wetland picture"></canvas><p class="s1-span">Two weeks: August 1 to 15, 2020</p>${SHOW_GRIDS() ? pixelGrids() : ''}</div>
            <div class="ex-side"><div class="ex-who"><p class="ex-bubble" aria-live="polite"></p></div>
              <p class="ex-count st-step" data-at="${o2}"><b>…</b> <span>fire detections</span><small class="ex-other"></small></p><p class="ex-note st-step" data-at="${o2}"></p></div>
            <button class="ex-hold st-step" data-at="${o2}" type="button" data-noclick>Hold for the older camera</button>
            <p class="fd-stamp st-step" data-at="${o2}">Same job. Different eyes.</p>
          </div>
          <div class="s1-under"><p class="ex-legend"><i aria-hidden="true"></i> Brighter = fire seen on more of the 15 days.</p></div></div>
        <div class="st-words st-only" data-only="${o1}${o2}${o3}">
          <div class="st-swap"><div class="st-only" data-only="${o1}">
            <p class="st-line">A satellite camera sees the heat of fire from space. <b>Every dot on the map is one sighting.</b></p>
            <div class="fd-castrow">${slot('older_idle')}<p class="st-sub fd-cast"><b class="c-moe">${castName('older')}</b> is MODIS, NASA's older fire camera, watching since 2000.</p></div></div>
          <div class="st-only" data-only="${o2}"><div class="fd-castrow">${slot('newer_idle')}<p class="st-sub fd-cast"><b class="c-vee">${castName('newer')}</b> is VIIRS, NASA's newer fire camera, watching since 2012.</p></div>
            <p class="st-line s1-same">Same place. Same days. <b class="s1-more">A different count.</b></p></div>
          <div class="st-only s1-flipq" data-only="${o3 || 'x'}"><p class="st-line">Back to ${castName('older')}'s view.</p>
            <p class="s1-q">Same fires.<br><b>Why do they look so different?</b></p></div></div>
          <p class="st-small st-step" data-at="${o2}">A fire detection: one 5 km patch where a satellite saw fire, once per day. Not a count of fires, and not land burned.</p>
        </div>`;
      cv = s.querySelector('.ex-canvas');
      s.querySelector('.st-play').addEventListener('click', ev => { ev.stopPropagation(); S.armWhole = false; if (WHOLE()) apStart({ only: 'whole' }); });
      if (!WHOLE()) s.querySelector('.st-play').hidden = true;      // the opening is live today (12:09 PM)
      const hold = s.querySelector('.ex-hold');
      const down = ev => { ev.preventDefault(); ev.stopPropagation(); sc.hold(true); };
      const up = ev => { if (ev) ev.stopPropagation(); sc.hold(false); };
      hold.addEventListener('pointerdown', down);
      hold.addEventListener('pointerup', up); hold.addEventListener('pointercancel', up);
      hold.addEventListener('pointerleave', () => { if (S.holding) sc.hold(false); });
      hold.addEventListener('click', ev => ev.stopPropagation());
      hold.addEventListener('contextmenu', ev => ev.preventDefault());
      hold.addEventListener('keydown', ev => { if ((ev.key === ' ' || ev.key === 'Enter') && !ev.repeat) { ev.preventDefault(); ev.stopPropagation(); sc.hold(true); } });
      hold.addEventListener('keyup', ev => { if (ev.key === ' ' || ev.key === 'Enter') { ev.preventDefault(); ev.stopPropagation(); sc.hold(false); } });
      const url = (S.ctx.partsBase || 'parts/engine_and_data/') + 'data/two_cameras/corrientes_2020-08-01_15.json';
      fetch(url).then(r => { if (!r.ok) throw new Error('could not read the wetland picture (' + r.status + ')'); return r.json(); })
        .then(j => {
          const t = S.ctx.adapters.twoCameras(j);
          if (isRef(t)) throw new Error(t.message);
          d = t;
          for (const k of ['older', 'newer']) { const m = new Map(); d[k].days.forEach(day => day.forEach(([x, y]) => { const i = y * d.width + x; m.set(i, (m.get(i) || 0) + 1); })); heat[k] = m; }
          let seed = 7; thr = new Float32Array(d.width * d.height).map(() => (seed = (seed * 16807) % 2147483647) / 2147483647);
          cv.setAttribute('aria-label', `Map of the Corrientes wetlands, ${d.width} by ${d.height} patches about 5 km wide, ${d.daysLabel}. MODIS, the older camera, detected fire ${fmt(d.older.total)} times over the fifteen days; VIIRS, the newer camera, ${fmt(d.newer.total)} times.`);
          const r = d.older.total ? d.newer.total / d.older.total : null;   // how much more the newer camera saw, from the two real totals
          const more = r == null ? 'A different count.' : r >= 1.8 ? `The newer camera spots fire about ${Math.round(r) === 2 ? 'twice' : NUMW[Math.round(r)] + ' times'} as often.` : r >= 1.15 ? `The newer camera spots fire about ${Math.round((r - 1) * 100)}% more often.` : 'About the same count.';
          s.querySelector('.s1-more').textContent = more;
          layers = {}; shown = -1; sc.layout(); if (S.cur === 0) sc.enter(false);
        })
        .catch(e => { s.querySelector('.fd-spread').innerHTML = nothing(e.message); d = null; });
    };
    function layer(k, cell) {  // one camera's dots, drawn once per size
      const key = k + cell; if (layers[key]) return layers[key];
      const c = document.createElement('canvas'); c.width = d.width * cell; c.height = d.height * cell;
      const g = c.getContext('2d'), gap = cell >= 5 ? 1 : 0;
      heat[k].forEach((n, i) => { g.fillStyle = n >= 3 ? '#fff1a8' : '#ffb52e'; g.globalAlpha = Math.min(1, .45 + .55 * n / 4); g.fillRect((i % d.width) * cell + gap / 2, Math.floor(i / d.width) * cell + gap / 2, cell - gap, cell - gap); });
      return (layers[key] = c);
    }
    function draw() {
      if (!d || !cv) return;
      const cell = 12, W = d.width * cell, H = d.height * cell;
      if (cv.width !== W) { cv.width = W; cv.height = H; }
      const g = cv.getContext('2d');
      g.globalAlpha = 1; g.filter = 'none'; g.fillStyle = '#1d3a33'; g.fillRect(0, 0, W, H);
      g.fillStyle = '#21423a'; for (let y = 0; y < d.height; y++) for (let x = (y & 1); x < d.width; x += 2) g.fillRect(x * cell, y * cell, cell, cell);
      if (twinkle < 1) {      // dots light one by one as the scene arrives
        g.fillStyle = '#ffb52e'; const gap = 1;
        heat.older.forEach((n, i) => { if (thr[i] > twinkle) return; const a = Math.min(1, (twinkle - thr[i]) * 8); g.globalAlpha = a * Math.min(1, .45 + .55 * n / 4);
          g.fillRect((i % d.width) * cell + gap / 2, Math.floor(i / d.width) * cell + gap / 2, cell - gap, cell - gap); });
        g.globalAlpha = 1; return;
      }
      if (view < 1) { g.globalAlpha = 1 - view; g.filter = `blur(${((1 - view) * cell * .22).toFixed(2)}px)`; g.drawImage(layer('older', cell), 0, 0); g.filter = 'none'; }
      if (view > 0) { g.globalAlpha = view; g.drawImage(layer('newer', cell), 0, 0); }
      g.globalAlpha = 1;
    }
    function words() {      // only the two REAL counts are ever printed; they switch at the half-way point
      if (!d) return;
      const cam = view >= .5 ? 1 : 0, f = (base === 0 ? 'a' : 'b') + stepNow;
      if (f !== faces) {    // the two big satellites: each looking before the second camera arrives; then the newer surprised, the older puzzled
        faces = f;
        sec.querySelector('.s1-sat.old').innerHTML = slot(stepNow >= 2 ? 'older_puzzled' : 'older_looking');
        sec.querySelector('.s1-sat.new').innerHTML = slot(stepNow >= 2 ? 'newer_surprised' : 'newer_looking');
      }
      const sp = sec.querySelector('.s1-spread'); sp.classList.toggle('cam-o', !cam); sp.classList.toggle('cam-n', !!cam); sp.classList.toggle('one', stepNow < 2);
      if (cam === shown) return; shown = cam;
      const c = cam ? d.newer : d.older, km = c.pixelKm >= 1 ? c.pixelKm + ' km' : Math.round(c.pixelKm * 1000) + ' m';
      sec.querySelector('.ex-bubble').innerHTML = cam ? `<span class="who vee">${castName('newer')}</span>Same patches, sharper eyes: my pixels are ${esc(km)}, so I spot smaller fires inside each patch.`
        : `<span class="who moe">${castName('older')}</span>Every dot is a patch of ground about 5 km across where I saw fire that day. My own pixels are ${esc(km)}, so small fires can slip past me.`;
      sec.querySelector('.ex-count b').textContent = fmt(c.total);
      const o = cam ? d.older : d.newer; sec.querySelector('.ex-other').textContent = `${cam ? 'MODIS, the older camera' : 'VIIRS, the newer camera'}: ${fmt(o.total)}`;
      sec.querySelector('.ex-note').textContent = `What ${cam ? 'VIIRS, the newer camera' : 'MODIS, the older camera'} saw, ${d.daysLabel}.`;
      holdLabel();
    }
    function holdLabel() {
      const b = sec.querySelector('.ex-hold'); if (!b) return;
      b.textContent = base === 1 ? (S.holding ? 'Let go for the newer camera' : 'Hold for the older camera') : (S.holding ? 'Let go for the older camera' : 'Hold for the newer camera');
      b.setAttribute('aria-pressed', String(!!S.holding));
    }
    function setView(target, animate) {
      const from = view;
      tween('s1view', animate ? 700 : 0, t => { view = from + (target - from) * ease(t); draw(); words(); });
    }
    sc.hold = on => { if (S.cur !== 0 || !d || stepNow < 2) return; if (S.holding === on) return; S.holding = on; holdLabel(); setView(on ? 1 - base : base, true); };
    sc.layout = () => { draw(); };
    sc.enter = animate => {
      if (!d) return;
      S.holding = false; view = base; shown = -1; faces = '';
      if (animate && !S.still && stepNow === 1) tween('s1tw', 1500, t => { twinkle = t < 1 ? t * 1.05 : 1; draw(); });
      else { twinkle = 1; draw(); }
      words();
    };
    sc.step = (raw, animate) => {
      const st = raw === 0 ? 0 : C && raw === 1 ? -3 : X && raw === 1 + C ? -1 : X && raw === oDeep ? -2 : SG && raw === oSong ? -4 : raw - X - C;     // -1 = the fan, -2 = the deep page; 1 Moe, 2 Vee, 3 the flip back
      if (S.root) S.root.classList.toggle('st-ex', st < 0);
      if (sec) { sec.classList.toggle('s1-x', st === -1); if (st === -1) { sec.classList.remove('s1-x-go'); if (animate && !S.still) { void sec.offsetWidth; S.busy = S.busy || {}; S.busy.s1ex = performance.now() + 2700; } sec.classList.add('s1-x-go'); } }
      const was = stepNow; stepNow = st; base = st === 2 ? 1 : 0; S.holding = false; if (sec) { sec.classList.toggle('s1-t', st === 0); sec.classList.toggle('s1-flip', st === 3); }
      // Moe and Vee get their moment (team lead, 9:01 PM): arriving large and centered, then settling, under two seconds
      if (sec && MEET() && animate && !S.still && (st === 1 || st === 2) && was !== st) { const c = st === 1 ? 's1-meet-o' : 's1-meet-n';
        sec.classList.remove('s1-meet-o', 's1-meet-n'); void sec.offsetWidth; sec.classList.add(c); S.busy = S.busy || {}; S.busy.s1meet = performance.now() + 2000;
        clearTimeout(S.meetT); S.meetT = setTimeout(() => sec.classList.remove(c), 2100); }
      if (!d) return;
      if (st < 0) return;
      if (was <= 0 && st === 1 && animate && !S.still) { view = 0; shown = -1; tween('s1tw', 1500, t => { twinkle = t < 1 ? t * 1.05 : 1; draw(); words(); }); return; }
      setView(base, animate);
    };
    sc.leave = () => { S.holding = false; if (S.root) S.root.classList.remove('st-ex'); };
    sc.wetland = () => cv && d ? cv : null;     // the lift-off borrows the wetland picture
    return sc;
  }

  /* =====================================================================================================
     Slide 2. Why is that a problem?  On a case board: the everyday question, the record that seems to answer it, the false headline;
     then why it is false (the record switches cameras); last, the one-sentence fix (both cameras on one scale).
     ===================================================================================================== */
  // slide 2, second press ( StoryBeats.showCameraStrip = false hides it): each camera's own
  // yearly count for the top earlier year and 2022, summed from the engine's own month rows (Readings.ownCounts), never typed
  function camStrip(info) {
    if (window.StoryBeats && window.StoryBeats.showCameraStrip === false) return '';
    const r = S.ctx.argentina, R = S.ctx.readings; if (!r || !R.ownCounts || !info) return '';
    const yrs = [info.top.year, info.g22.year];
    const tot = (k, y) => { let t = 0, n = 0; r.monthly.forEach(x => { if (x.ym.startsWith(y + '-')) { const c = R.ownCounts(x, r)[k]; if (c != null) { t += c; n++; } } }); return n === 12 ? t : null; };
    const row = (name, k) => { const a = tot(k, yrs[0]), b = tot(k, yrs[1]); return a == null || b == null ? null : { name, a, b }; };
    const rows = [row('MODIS alone', 'Aqua'), row('VIIRS alone (S-NPP)', 'SNPP')].filter(Boolean);
    if (rows.length < 2 || rows.some(x => x.b >= x.a)) return '';
    S.camStripRows = rows; S.camStripYears = yrs;
    return `<p class="st-small s2-cams st-only" data-only="1"><b class="s2-cams-h">Each camera on its own: ${yrs[1]} is below ${yrs[0]}.</b> ` +
      rows.map(x => `${x.name}: ${yrs[0]} <b>${fmt(x.a)}</b>, ${yrs[1]} <b>${fmt(x.b)}</b>`).join(' · ') + ` <span class="s2-cams-u">(fire detections a year)</span></p>`;
  }
  function scene2() {
    const sc = { steps: 3, title: 'Why is that a problem?', cls: 's2' };
    let sec, Y = null, info = null, t = 0, drawn = 1, stNow = 0, veeOn = false;
    sc.build = s => {
      sec = s;
      const r = S.ctx.argentina, R = S.ctx.readings;
      let err = null;
      try {
        const ys = R.yearly(r).filter(y => y.complete && y.ours != null);
        Y = ys.map(y => ({ year: y.year, ours: y.ours, own: y.olderOwn, glued: y.year >= 2022 ? y.newerAsIs : y.ours }));
        // historyScale 'vee': each year also on Vee's scale (Readings.onScale); the one-scale numbers on this slide are then read there
        const rv = VEE() && R.onScale ? R.onScale(r, 'viirs') : null, yv = {}; if (rv) for (const y of R.yearly(rv)) if (y.complete && y.ours != null) yv[y.year] = y.ours;
        veeOn = !!rv && Y.every(y => yv[y.year] != null); Y.forEach(y => { y.v = veeOn ? yv[y.year] : y.ours; });
        const pre = Y.filter(y => y.year < 2022).slice().sort((a, b) => b.ours - a.ours);
        const g22 = Y.find(y => y.year === 2022), y21 = Y.find(y => y.year === 2021);
        if (!g22 || !y21 || g22.glued == null) throw new Error('no 2022 total to compare in this record');
        const others = Y.filter(y => y.year !== 2022).map(y => y.v).sort((a, b) => a - b), k = others.length;
        const typical = k ? (k % 2 ? others[(k - 1) / 2] : (others[k / 2 - 1] + others[k / 2]) / 2) : null;   // middle of the OTHER whole years
        if (typical == null) throw new Error('no other whole years to compare with');
        info = { g22, y21, top: pre[0], second: pre[1], topV: Y.filter(y => y.year < 2022).slice().sort((a, b) => b.v - a.v)[0], typical, rw: R.recordWord(r) };
      } catch (e) { err = e.message; }
      if (err) { s.innerHTML = `<header class="st-head"><p class="st-eyebrow">The example: Argentina</p><h2 class="st-h">Why is that a problem?</h2></header><div class="st-pic">${nothing(err)}</div>`; return; }
      const ratioTop = info.g22.glued / info.top.ours, dbl = ratioTop >= 1.8 && ratioTop <= 2.2 ? 'about double' : 'about ' + (Math.round(ratioTop * 2) / 2) + ' times';
      const vsTyp = info.g22.v / info.typical;
      const typWord = vsTyp >= 1 && vsTyp < 1.15 ? 'a little above' : vsTyp >= 1.15 ? 'above' : vsTyp > 0.87 ? 'a little below' : 'below';
      const yrs = (S.ctx.readings.recordName ? S.ctx.readings.recordName(r) : '').match(/(\d+)-year/);
      const span = yrs ? NUMW[+yrs[1]] || yrs[1] : null;
      s.innerHTML = `
        <header class="st-head"><p class="st-eyebrow">The example: Argentina · fire, year by year</p>
          <h2 class="st-h">Why is that <em>a problem?</em></h2></header>
        <div class="st-pic"><div class="st-exhibit fd-board s2-ex">
          <div class="s2-quotes">
            <figure class="st-quote ember s2-glued"><figcaption>The record, as it comes</figcaption>
              <blockquote>“${info.g22.year}: Argentina's worst fire year on record”</blockquote><span class="strike" aria-hidden="true"></span></figure>
            <figure class="st-quote gold st-step" data-at="2"><figcaption>${veeOn ? `${plain(castName('older'))}'s older years, lifted to ${plain(castName('newer'))}'s scale` : 'The same years on one scale'}</figcaption>
              <blockquote>“${info.g22.year}: ${typWord} normal${veeOn && info.g22.v < .75 * info.topV.v ? ', far below the tallest years' : ''}”</blockquote></figure>
          </div>
          <div class="s2-chart"></div>
        </div>
        ${camStrip(info)}
        <p class="st-small st-figs st-step" data-at="2">Fire detections in ${info.g22.year}: as it comes <b class="e">${fmt(info.g22.glued)}</b>; ${veeOn ? `on ${castName('newer')}'s scale` : 'on one scale'} <b>${fmt(info.g22.v)}</b>, about ${Math.round(Math.abs(vsTyp - 1) * 100)}% ${vsTyp >= 1 ? 'over' : 'under'} a typical year (<b>${fmt(info.typical)}</b>). ${veeOn ? 'Tallest' : 'Biggest'} earlier year, ${info.topV.year}: <b>${fmt(info.topV.v)}</b>. ${NUMW[Y.length] ? cap(NUMW[Y.length]) : Y.length} whole years shown, ${Y[0].year} to ${Y[Y.length - 1].year}.</p></div>
        <div class="st-words"><div class="st-swap">
          <div class="st-only" data-only="0">${pin('Is ' + info.g22.year + ' worse than usual?')}<p class="st-line">Line up Argentina's years and ${info.g22.year} leaps to <b>${dbl}</b> its biggest year.</p></div>
          <div class="st-only" data-only="1">${pin('Look where the jump starts!')}<p class="st-line">${info.g22.year} is the year the record switches cameras, from ${castName('older')} to ${castName('newer')}. <b>The jump is mostly sharper eyes.</b></p></div>
          <div class="st-only" data-only="2">${pin('So count every year the same way!')}<p class="st-line"><b>Our fix:</b> for ten years both cameras flew together. So we learned how to translate ${veeOn ? "the older camera's counts into the newer one's" : "the newer camera's counts into the older one's"}. Now every year sits on one scale.</p>
            <p class="st-bridge s2-next">Next question: how do you translate one camera into the other?</p></div></div>
          
        </div>`;
    };
    function chart() {     // two strips of paper pinned to the board: the older camera's years, then the newer camera's, taped on at the switch
      const box = sec && sec.querySelector('.s2-chart'); if (!box || !Y) return;
      const w = S.port ? 640 : 1000, h = S.port ? 470 : 500, fs = S.port ? 23 : 23, L = 26, Rm = 26, T = 150, B = 84;
      const n = Y.length, slotW = (w - L - Rm) / n, bw = slotW * 0.7, x = i => L + i * slotW + (slotW - bw) / 2;
      const max = Math.max(...Y.map(y => veeOn ? Math.max(y.glued, y.v) : y.glued)) * 1.02, hh = v => (h - T - B) * v / max * drawn;
      const i22 = Y.findIndex(y => y.year === 2022), seam = L + i22 * slotW;
      const val = y => veeOn ? (y.year < 2022 ? y.ours + (y.v - y.ours) * t : y.glued + (y.v - y.glued) * t) : y.year < 2022 ? y.ours : y.glued + (y.ours - y.glued) * t;
      const col = y => `color-mix(in srgb, ${GOLD_PAPER} ${(t * 100).toFixed(0)}%, var(${y.year < 2022 ? '--cam-older' : '--cam-newer'}))`;
      // two tones on Vee's scale (team lead, 8:21 AM): the stitched bars stay; the added parts GROW on top of Moe's bars, so the old years rise
      // to meet the new ones. Lower part: what Moe counted (his color); upper: what the translation adds (hatched, light Vee); 2022 on: Vee, solid.
      const tt = veeOn && t > 0;
      const bars = Y.map((y, i) => { const bh = Math.max(4, hh(val(y))), x0 = x(i), y0 = h - B - bh, r = Math.min(bw / 2, 9);
        if (!tt) return `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${bw.toFixed(1)}" height="${(bh + r).toFixed(1)}" rx="${r}" class="bar" style="fill:${col(y)}"/>`;
        if (y.year >= 2022) return `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${bw.toFixed(1)}" height="${(bh + r).toFixed(1)}" rx="${r}" class="bar s2-v"/>`;
        // second-model check (8:33 AM): the lower part is what Moe counted only from 2003; 2001-2002 are the earlier satellite, translated
        const mh = Math.max(4, hh(y.ours)), ah = Math.max(0, bh - mh), lowCls = y.own == null ? 's2-t' : 's2-m';
        return `<rect x="${x0.toFixed(1)}" y="${(h - B - mh).toFixed(1)}" width="${bw.toFixed(1)}" height="${(mh + r).toFixed(1)}" rx="3" class="bar ${lowCls}"/>` +
          (ah > .5 ? `<rect x="${x0.toFixed(1)}" y="${y0.toFixed(1)}" width="${bw.toFixed(1)}" height="${ah.toFixed(1)}" rx="3" class="bar s2-a"/>` : ''); }).join('');
      const ttDefs = tt ? `<defs><pattern id="s2-hatch" width="7" height="7" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="7" height="7" class="s2-abg"/><line x1="0" y1="0" x2="0" y2="7" class="s2-aln"/></pattern></defs>` : '';
      const ttKey = tt && t >= .5 ? (() => { const on = plain(castName('older')), nn = plain(castName('newer')), early = Y.some(y => y.year < 2022 && y.own == null);
        const rows = [[['s2-m', `what ${on} counted`], ['s2-v', `what ${nn} counted`]], [['s2-a', `added: what ${nn} would likely have seen`]].concat(early ? [['s2-t', `before ${on}: an earlier satellite`]] : [])];
        return rows.map((row, ri) => { let xx = L + 6; const ky = h - 30 + ri * 24; return row.map(([c, txt]) => { const g = `<rect x="${xx}" y="${ky - 15}" width="28" height="16" rx="3" class="bar ${c}"/><text x="${xx + 36}" y="${ky}" class="ex-t s2-ttk" style="font-size:${fs - 4}px">${esc(txt)}</text>`; xx += 36 + txt.length * (fs - 4) * .52 + 26; return g; }).join(''); }).join(''); })() : '';
      const off = 7 * (1 - t);       // the newer strip sits a little crooked until it is put on one scale
      const strips = `<rect x="6" y="${h - B - (h - T - B) - 34}" width="${(seam - 4).toFixed(1)}" height="${(h - T - B) + B + 24}" rx="6" class="paper"/>
        <g transform="rotate(${(1.4 * (1 - t)).toFixed(2)} ${seam} ${h - B}) translate(0 ${(-off).toFixed(1)})"><rect x="${(seam - 2).toFixed(1)}" y="${h - B - (h - T - B) - 34}" width="${(w - seam - 4).toFixed(1)}" height="${(h - T - B) + B + 24}" rx="6" class="paper"/></g>`;
      const tape = `<g class="tape${stNow === 1 ? ' hot' : ''}" opacity="${(1 - t).toFixed(2)}"><rect x="${(seam - 22).toFixed(1)}" y="${T - 34}" width="44" height="${h - T}" rx="4" transform="rotate(-4 ${seam} ${(T + h) / 2})"/></g>`;
      const sw = stNow === 1 ? `<text x="${seam.toFixed(1)}" y="${h - 8}" text-anchor="middle" class="ex-t sw" style="font-size:${fs}px">▲ the record switches cameras</text>` : '';
      const i12 = Y.findIndex(y => y.year === 2012), band = stNow >= 2 && i12 >= 0 ? `<rect x="${(L + i12 * slotW).toFixed(1)}" y="${T - 4}" width="${((i22 - i12) * slotW).toFixed(1)}" height="${h - B - T + 4}" class="s2-band"/><text x="${(L + (i12 + i22) / 2 * slotW).toFixed(1)}" y="${T + 22}" text-anchor="middle" class="ex-t s2-bandt" style="font-size:${fs - 2}px">both cameras flew together</text>` : '';
      const key = `<text x="${L}" y="${h - B - (h - T - B) - 44}" class="ex-t s2-unit" style="font-size:${fs}px">fire detections a year</text>` +
        (drawn >= 1 && t < .5 ? `<text x="${((L + seam) / 2).toFixed(1)}" y="${T + 22}" text-anchor="middle" class="ex-t s2-ko" style="font-size:${fs - 2}px">older camera</text><text x="${((seam + w - Rm) / 2 + 40).toFixed(1)}" y="${T + 22}" text-anchor="middle" class="ex-t s2-kn" style="font-size:${fs - 2}px">newer camera</text>` : '');
      const holders = drawn >= 1 ? slotSVG('older_sign', (L + seam) / 2, T - 8, S.port ? 1 : 1.35) + slotSVG('newer_sign', (seam + w - Rm) / 2 + 40, T - 8, S.port ? 0.8 : 1) : '';
      const plainV = veeOn && t > .5;
      const label = `Argentina's fire detections, one bar per year, ${Y[0].year} to ${Y[n - 1].year}, on two strips of paper: ${castName('older').replace(/<[^>]+>/g, '')} (MODIS, the older camera) holds up the years to ${Y[i22 - 1].year}; the newer camera (VIIRS) the years from ${Y[i22].year}. ` + (t > .5
        ? (plainV ? `On Vee's scale, ${info.g22.year} is ${fmt(info.g22.v)}, far below the tallest years (${info.topV.year}: ${fmt(info.topV.v)}). Before 2022 each bar is what Moe counted (2001 and 2002: an earlier satellite), with the part Vee would likely have seen added on top. Every year on Vee's scale: ` + Y.map(y => y.year + ' ' + fmt(y.v)).join('; ') + '.'
          : `On one scale, ${info.g22.year} is ${fmt(info.g22.ours)}, below ${info.top.year}'s ${fmt(info.top.ours)}. Every year on one scale: ` + Y.map(y => y.year + ' ' + fmt(y.ours)).join('; ') + '.')
        : `As it comes, ${info.g22.year} leaps to ${fmt(info.g22.glued)}, about double the biggest earlier year (${info.top.year}, ${fmt(info.top.ours)}). Every year as it comes: ` + Y.map(y => y.year + ' ' + fmt(y.glued)).join('; ') + '.');
      box.innerHTML = svg(w, h, `${ttDefs}${strips}${band}${bars}${key}${ttKey}
        <line x1="${L - 8}" x2="${w - Rm + 8}" y1="${h - B}" y2="${h - B}" class="ex-axis"/>${tape}${sw}${holders}
        ${Y.map((y, i) => (y.year % 5 === 0 || i === n - 1 || i === 0) ? `<text x="${(x(i) + bw / 2).toFixed(1)}" y="${h - B + fs + 10}" text-anchor="middle" class="ex-t" style="font-size:${fs}px">${y.year}</text>` : '').join('')}
        ${drawn >= 1 ? `<text x="${(x(i22) + bw / 2).toFixed(1)}" y="${(h - B - hh(val(Y[i22])) - 14).toFixed(1)}" text-anchor="middle" class="ex-t big" style="font-size:${fs + 6}px">${fmt(val(Y[i22]))}</text>` : ''}`, label, 's2-svg');
    }
    sc.numbers = () => Y && info ? { title: "Argentina's yearly fire detections", tables: [{ caption: 'Fire detections per whole year. As it comes: MODIS, the older camera, to 2021, then the newer VIIRS cameras as they count. The last column is the older camera\'s own count of the same year: where it exists, it is within a few percent of ours.', head: ['Year', 'As it comes', 'On one scale (ours)', 'MODIS, counting on its own'],
      rows: Y.map(y => [y.year, fmt(y.glued), fmt(y.ours), y.own == null ? 'no count' : fmt(y.own)]) }] } : null;
    sc.layout = chart;
    sc.enter = animate => { t = stNow >= 2 ? 1 : 0; if (animate && !S.still && stNow === 0) tween('s2draw', 1400, k => { drawn = ease(k); chart(); }); else { drawn = 1; chart(); } };
    sc.step = (st, animate) => {
      stNow = st;
      if (!Y) return;
      const strike = sec.querySelector('.st-quote.ember'); if (strike) strike.classList.toggle('struck', st >= 1);
      const target = st >= 2 ? 1 : 0;
      if (target === t) { chart(); return; }
      const from = t; tween('s2t', animate ? 1500 : 0, k => { t = from + (target - from) * ease(k); chart(); });
    };
    return sc;
  }

  /* =====================================================================================================
     Slide 3. How does the fix work?  The Hot-Spot Clock's picture (work/wild_F): a globe glowing where MODIS saw fire, inside a clock
     whose twelve wedges grow with each month's fire; under it the wave, "the same years, laid flat".
     Order: the ten shared years on the wave; then the wedges (the cameras differ by month); then the twelve conversion numbers, the hand
     sweeping 2025 and settling the newer camera's tall wedges onto MODIS's scale; last, the whole wave on one scale.
     Globe glow: data/globe_glow_2025.json (cut from the clock's own globe file). Land: data/world_shapes.json.
     ===================================================================================================== */
  function loadGlow() {
    if (!S.glow) S.glow = fetch(S.ctx.globeGlowUrl || 'data/globe_glow_2025.json').then(r => { if (!r.ok) throw new Error('could not read the globe file (' + r.status + ')'); return r.json(); })
      .then(j => ({ year: j.year, months: j.months.map(m => Uint8Array.from(m)) }));   // each month: number triples (a, b, v)
    return S.glow;
  }
  const FIRE = [[0, 150, 34, 12], [0.12, 214, 62, 14], [0.3, 255, 140, 30], [0.55, 255, 215, 90], [1, 255, 252, 232]];   // the clock's own fire ramp
  const fireRGB = v => { const t = v / 255; let k = 0; while (k < FIRE.length - 2 && t > FIRE[k + 1][0]) k++; const a = FIRE[k], b = FIRE[k + 1], f = Math.min(1, Math.max(0, (t - a[0]) / (b[0] - a[0])));
    return [1, 2, 3].map(i => Math.round(a[i] + (b[i] - a[i]) * f)); };
  // slide 3's "smarter version" press (team lead, 10:43 PM): on by default; StoryBeats.showFirePower = false removes the press cleanly
  const SHOW_FP = () => !(window.StoryBeats && window.StoryBeats.showFirePower === false);
  const FP_WORDS = ['faintest', 'very faint', 'faint', 'medium', 'strong', 'very strong', 'strongest'];
  function firePowerPanel(box) {      // the smarter version (10:43 PM), built into any box; numbers: the engine's curve and data/fire_power.json
    const get = u => fetch(u).then(r => { if (!r.ok) throw new Error('could not read ' + u.split('/').pop() + ' (' + r.status + ')'); return r.json(); });
    return Promise.all([get((S.ctx.partsBase || 'parts/engine_and_data/') + 'data/world_by_country/shared/curve.json'), get('data/fire_power.json')]).then(([fpCurve, fpRes]) => {
      if (!fpCurve || !Array.isArray(fpCurve.chance) || fpCurve.chance.length !== 7) { box.innerHTML = nothing('the fire-power curve is not in the expected shape'); return; }
      const ch = fpCurve.chance, ed = fpCurve.band_edges_mw, mx = Math.max(...ch);
      const mw = i => i === 0 ? `under ${ed[0]}` : i === ed.length ? `${ed[ed.length - 1]} and up` : `${ed[i - 1]} to ${ed[i]}`;
      const bars = ch.map((c, i) => `<li style="--h:${(c / mx).toFixed(3)};--i:${i}"><b class="fp-n">${Math.round(c * 100)}<small> in 100</small></b><span class="fp-bar"></span>
          <span class="fp-flame" style="--f:${(.45 + .55 * i / 6).toFixed(2)}" aria-hidden="true"></span><span class="fp-w">${FP_WORDS[i]}</span><span class="fp-mw">${mw(i)} MW</span></li>`).join('');
      const R = fpRes && fpRes.closer != null ? fpRes : null;
      box.innerHTML = `<header class="st-head"><p class="st-eyebrow">Our next step · built and tested</p><h2 class="st-h">A smarter version, <em>built and tested</em></h2></header>
        <div class="fp-chart"><p class="fp-cap">${castName('newer')}'s fires, sorted by how much heat they give off. Each bar: how often ${castName('older')} also sees a fire that strong.</p>
          <div class="fp-ends"><div class="fp-end n">${slot('newer_idle', 'fp-pal')}<span>${castName('newer')} sees the faint ones too</span></div>
          <ol class="fp-bars">${bars}</ol>
          <div class="fp-end o">${slot('older_idle', 'fp-pal')}<span>${castName('older')} mostly sees the big, hot fires</span></div></div>
          <p class="fp-axis">fire power, in megawatts (MW)</p></div>
        <div class="fp-foot"><p class="fp-how">Sort ${castName('newer')}'s count by strength, apply these chances, then the twelve month numbers.</p>
          ${R ? `<p class="fp-badge">closer in <b>${R.closer} of the ${R.countries}</b> countries with a lot of fire <i>our next step</i></p>` : ''}</div>`;
      box.setAttribute('aria-label', `A smarter version, built and tested. ${plain(castName('newer'))}'s fires sorted into seven bands, faintest to strongest; the chance ${plain(castName('older'))} also sees a fire that strong: ` +
        ch.map((c, i) => FP_WORDS[i] + ' (' + mw(i) + ' MW) about ' + Math.round(c * 100) + ' in 100').join(', ') + '.' + (R ? ` Closer in ${R.closer} of the ${R.countries} countries with a lot of fire; our next step.` : ''));
      box.setAttribute('role', 'img');
    }).catch(e => { box.innerHTML = nothing(e.message); });
  }
  // slide 3's yearly bars (redline 9:19 AM): Moe's year beside Vee's from 2012 (the ten shared years shaded), and on the one-scale press the
  // two moves: Vee's years come DOWN to Moe's scale, then Moe's older years RISE to Vee's scale in two tones (as on slide 2)
  function yearsData(r) {
    const R = S.ctx.readings, Y = R.yearly(r).filter(y => y.complete && y.ours != null && y.year <= 2025);
    const rv = R.onScale ? R.onScale(r, 'viirs') : null, vv = {}; if (rv) for (const y of R.yearly(rv)) if (y.complete && y.ours != null) vv[y.year] = y.ours;
    const newerOwn = yr => { let t = 0, n = 0; for (const x of r.monthly) if (x.ym.startsWith(yr + '-')) { const c = R.ownCounts(x, r); if (c && c.SNPP != null) { t += c.SNPP; n++; } } return n === 12 ? t : null; };
    return Y.map(y => ({ year: y.year, moe: y.ours, own: y.olderOwn, glued: y.year >= 2022 ? y.newerAsIs : y.ours, vee: vv[y.year] != null ? vv[y.year] : null,
      veeOwn: y.year >= 2012 && y.year <= 2021 ? newerOwn(y.year) : null }));
  }
  function yearsSVG(D, opt) {
    const { w, h, fs } = opt, t = opt.t || 0, L = 8, R = 8, top = fs + 22, B = fs + 12, n = D.length, slot = (w - L - R) / n;
    const pairs = !!opt.pairs, vee = !!opt.vee, max = Math.max(...D.map(d => Math.max(d.glued || 0, d.vee || 0, d.moe || 0, d.veeOwn || 0))) * (pairs ? 1.32 : 1.04);
    const hh = v => (h - top - B) * Math.max(0, v) / max, base = h - B, x = i => L + i * slot;
    const i12 = D.findIndex(d => d.year === 2012), i22 = D.findIndex(d => d.year === 2022);
    let bars = '';
    D.forEach((d, i) => {
      if (pairs) { const bw = slot * .38, own = d.year < 2003 ? 'yb-t' : 'yb-m';
        if (d.moe != null) { const v = d.year >= 2022 ? (d.own != null ? d.own : null) : d.moe; if (v != null) bars += `<rect x="${(x(i) + slot * .1).toFixed(1)}" y="${(base - hh(v)).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh(v).toFixed(1)}" rx="2" class="${own}"/>`; }
        const vv = d.year >= 2022 ? d.glued : d.veeOwn; if (vv != null) bars += `<rect x="${(x(i) + slot * .52).toFixed(1)}" y="${(base - hh(vv)).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh(vv).toFixed(1)}" rx="2" class="yb-v"/>`;
        return; }
      const bw = slot * .7, x0 = (x(i) + slot * .15).toFixed(1);
      if (d.year >= 2022) { const from = vee ? d.moe : d.glued, to = vee ? (d.vee != null ? d.vee : d.glued) : d.moe, v = from + (to - from) * t;
        bars += `<rect x="${x0}" y="${(base - hh(v)).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh(v).toFixed(1)}" rx="2" class="yb-v"/>`; return; }
      const low = d.year < 2003 ? 'yb-t' : 'yb-m'; bars += `<rect x="${x0}" y="${(base - hh(d.moe)).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh(d.moe).toFixed(1)}" rx="2" class="${low}"/>`;
      if (vee && d.vee != null && t > 0) { const add = (d.vee - d.moe) * t; bars += `<rect x="${x0}" y="${(base - hh(d.moe + add)).toFixed(1)}" width="${bw.toFixed(1)}" height="${hh(add).toFixed(1)}" rx="2" class="yb-a"/>`; }
    });
    const band = i12 >= 0 && i22 > i12 ? `<rect x="${x(i12).toFixed(1)}" y="${top - 6}" width="${((i22 - i12) * slot).toFixed(1)}" height="${(base - top + 6).toFixed(1)}" class="yb-band"/>` : '';
    const ticks = D.map((d, i) => d.year % 5 === 0 || i === 0 || i === n - 1 ? `<text x="${(x(i) + slot / 2).toFixed(1)}" y="${h - 4}" text-anchor="middle" class="yb-yr" style="font-size:${fs}px">${d.year}</text>` : '').join('');
    const cap = pairs ? `both cameras counted the same fires, 2012–2021` : vee ? `Or ${plain(castName('older'))}'s older years rise to ${plain(castName('newer'))}'s scale` : t > 0 ? `${plain(castName('newer'))}'s years come down to ${plain(castName('older'))}'s scale` : `As it comes: ${plain(castName('older'))} to 2021, ${plain(castName('newer'))} from 2022`;
    const capX = pairs && i12 >= 0 ? x(i12) + 6 : L, capY = pairs ? top + fs + 4 : fs;
    const key = (pairs ? [['yb-m', `what ${plain(castName('older'))} counted`], ['yb-v', `what ${plain(castName('newer'))} counted`]]
      : vee ? [['yb-m', `what ${plain(castName('older'))} counted`], ['yb-a', `added: what ${plain(castName('newer'))} would likely have seen`], ['yb-v', `what ${plain(castName('newer'))} counted`]] : []);
    let kx = w - R; const keyS = key.slice().reverse().map(([c, tx]) => { const wd = tx.length * fs * .55 + 34; kx -= wd + 18; return `<rect x="${kx.toFixed(0)}" y="${fs - 14}" width="26" height="15" rx="2" class="${c}"/><text x="${(kx + 32).toFixed(0)}" y="${fs}" class="yb-k" style="font-size:${fs}px">${esc(tx)}</text>`; }).join('');
    const label = `Argentina's fire detections, year by year, ${D[0].year} to ${D[n - 1].year}. ` + (pairs ? `Moe's count beside Vee's for the years both counted, 2012 to 2021.` : vee ? `Moe's older years lifted to Vee's scale: what Moe counted, with what Vee would likely have seen added on top.` : `The years as they come.`);
    return `<svg class="st-svg yb-svg" viewBox="0 0 ${w} ${h}" width="${w}" height="${h}" role="img" aria-label="${esc(label)}"><defs><pattern id="yb-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="yb-abg"/><line x1="0" y1="0" x2="0" y2="6" class="yb-aln"/></pattern></defs>${band}${bars}<line x1="${L}" x2="${w - R}" y1="${base}" y2="${base}" class="yb-axis"/>${ticks}<text x="${capX.toFixed(0)}" y="${capY}" class="yb-cap" style="font-size:${fs}px">${esc(cap)}</text>${keyS}</svg>`;
  }
  function scene3() {
    // presses: 0 the shared years, 1 the month-by-month gap, 2 the rule (the math), [3 the smarter version], then the years on one scale
    // StoryBeats.mathDepth 'short' (default, 12:39 AM): the month-by-month gap press goes; the rule (clock, twelve numbers, three lines) is ONE press.
    // 'full' brings back the separate gap press (the autoplay clips follow 'short'). STATES lists, for each press, the clock's state (or 'fp').
    // reorder (team lead, 9:02 AM): slide 3 = the shared years, the rule, the record on one scale; the smarter version now ends slide 4
    const FP = false, FULL = !!(window.StoryBeats && window.StoryBeats.mathDepth === 'full');
    const STATES = [0].concat(FULL ? [1] : [], [2], FP ? ['fp'] : [], [3]), at = v => String(STATES.indexOf(v)), LAST = STATES.length - 1;
    const sc = { steps: LAST + 1, title: 'How does the fix work?', cls: 's3' };
    let fpCurve = null, fpRes = null, fpErr = null;
    let YD = null;
    const drawWave = (sec_, W_, opt) => { if (SHOW_WAVE()) return drawWaveG(sec_, W_, opt);
      const box = sec_ && sec_.querySelector('.wv-box'); if (!box || !YD) return;
      box.innerHTML = yearsSVG(YD, Object.assign(S.port ? { w: 656, h: 210, fs: 18 } : { w: 1650, h: 200, fs: 20 }, opt, { pairs: stNow < 3 })); };
    let wvOpt = {}, sec, skipped = [], mk = 7, mathOn = false, f = null, hiLo = null, ringA = 0, yr = null, months = null, shared = null, hand = 0, stNow = 0, W = null, wt = 0, glow = null, shapes = null, globe = null, oct = null, real = 0;   // real: 0 = the friendly drawn planet, 1 = the real globe
    const LON0 = -61, LAT0 = -27, RAD = Math.PI / 180;
    sc.build = s => {
      sec = s;
      const r = S.ctx.argentina;
      f = r && r.factors && r.factors.SNPP && r.factors.SNPP.f;
      W = waveData(r, VEE() && S.ctx.readings.onScale ? S.ctx.readings.onScale(r, 'viirs') : null);
      try { YD = yearsData(r); } catch (e) { YD = null; }
      const Y = S.ctx.readings.yearly(r).filter(y => y.complete && y.ours != null);
      const last = Y.length ? Y[Y.length - 1] : null;
      if (last) {          // the latest whole year, month by month: what the newer camera counted, and the same month on MODIS's scale
        yr = last.year;
        months = MON3.map((_, i) => { const row = r.monthly.find(x => x.ym === yr + '-' + String(i + 1).padStart(2, '0'));
          if (!row || row.value == null) return null;
          const newer = row.raw && row.carrier && row.carrier !== 'Aqua' && row.carrier !== 'Terra' ? row.raw[row.carrier] : null;
          return { newer, ours: row.value, carrier: row.carrier }; });
        if (months.some(m => !m || m.newer == null)) { months = null; }
      }
      // the ten shared years, month by month: what each camera counted (the engine's own raw counts)
      shared = MON3.map((_, i) => { let a = 0, b = 0, ok = 0; for (let y = 2012; y <= 2021; y++) { const row = r.monthly.find(x => x.ym === y + '-' + String(i + 1).padStart(2, '0'));
        if (row && row.raw && row.raw.Aqua != null && row.raw.SNPP != null && !(row.short && row.short.SNPP) && !(row.local_test && row.local_test.handed_over)) { a += row.raw.Aqua; b += row.raw.SNPP; ok++; } }
        return ok ? { older: a, newer: b, years: ok } : null; });
      // months left out of the learning (the engine's own flags): named in the table so the sums divide to the numbers shown
      skipped = []; for (let y = 2012; y <= 2021; y++) for (let i = 0; i < 12; i++) { const row = r.monthly.find(x => x.ym === y + '-' + String(i + 1).padStart(2, '0'));
        if (row && ((row.short && row.short.SNPP) || (row.local_test && row.local_test.handed_over))) skipped.push(MONTHS[i] + ' ' + y); }
      if (shared.some(x => !x)) shared = null;
      const tot = k => months ? months.reduce((a, m) => a + m[k], 0) : null;
      // the small line on Vee's scale: one older year, what Moe counted and the same year lifted (read from the page's own unit switch)
      const veeLine = () => { try { const R = S.ctx.readings, rv = R.onScale(r, 'viirs'), m = R.yearly(r).find(y => y.year === 2021), v = rv && R.yearly(rv).find(y => y.year === 2021);
        return m && v && m.ours != null && v.ours != null ? `2021: ${plain(castName('older'))} counted ${fmt(m.ours)} detections; on ${plain(castName('newer'))}'s scale, ${fmt(v.ours)}.` : ''; } catch (e) { return ''; } };
      oct = f ? f[9] : null;
      // the worked rule (team lead, 9:10 PM: "we really skip over our math"): one month's number from its two real sums; August, as the voice uses it
      mk = 7; mathOn = !(window.StoryBeats && window.StoryBeats.showMath === false) && !!(f && shared && shared[mk] && shared[mk].newer);
      hiLo = f ? { hi: f.indexOf(Math.max(...f)), lo: f.indexOf(Math.min(...f)) } : null;   // the months where the two cameras are closest and furthest apart, from the engine
      s.innerHTML = `
        <header class="st-head"><p class="st-eyebrow">Argentina · how the join works</p>
          <h2 class="st-h">How does <em>the fix work?</em></h2></header>
        <div class="st-pic"><div class="s3-clock"><canvas class="s3-cv" role="img" aria-label=""></canvas><p class="s3-when"></p><div class="s3-pals" aria-hidden="true">${slot('older_idle', 'pal o')}${slot('newer_idle', 'pal n')}</div></div></div>
        <div class="st-words"><p class="st-bridge">How do you translate one camera into the other?</p><div class="st-swap">
          <div class="st-only" data-only="0"><p class="st-line">Here's how. Look at 2012 to 2021: <b>those ten years have two counts of the same fires</b>, one from each camera.</p>
            <p class="st-small">${SHOW_WAVE() ? "Below: Argentina's fire, month by month, 2001 to now. The shaded part is those ten years." : "Below: Argentina's fire, year by year. The shaded part is those ten years."}</p></div>
          <div class="st-only" data-only="${FULL ? at(1) : 'x'}"><p class="st-line">The gap between the two counts <b>changes with the month.</b>${hiLo ? ` In ${MONTHS[hiLo.hi]}, MODIS counts about ${Math.round(f[hiLo.hi] * 100)} for every 100 VIIRS counts. In ${MONTHS[hiLo.lo]}, about ${Math.round(f[hiLo.lo] * 100)}.` : ''}</p>
            <p class="s3-key"><span>${slot('newer_idle', 'guide')}<i class="k kn"></i>VIIRS, the newer camera</span><span>${slot('older_idle', 'guide')}<i class="k ko"></i>MODIS, the older camera</span></p>
            <p class="st-small">Each wedge: one month of the year, the ten shared years added up.</p></div>
          <div class="st-only" data-only="${at(2)}">${mathOn ? `<div class="s3-math">
              <p class="m1">1. Ten years when both cameras watched the same fires give us the conversion.</p>
              <p class="m2">2. One conversion number for each month of the year: ${castName('newer')}'s count × the month's number ≈ what ${castName('older')} would have counted.</p>
              <p class="m3">How ${MONTHS[mk]}'s number was made: ${fmt(shared[mk].older)} ÷ ${fmt(shared[mk].newer)} = ${f[mk].toFixed(2)}</p></div>`
            : `<p class="st-line">So Argentina gets <b>twelve conversion numbers, one per month.</b> Multiply the newer camera's count by its month's number to estimate what the older camera would have counted.</p>`}
            <p class="s3-key"><span>${slot('newer_idle', 'guide')}<i class="k kd"></i>dashed: VIIRS, as it counts</span><span>${slot('older_idle', 'guide')}<i class="k kg"></i>gold: on MODIS's scale</span></p>
            <p class="st-small">The hand sweeps ${yr || 'a year'}, translating one month at a time.</p></div>
          ${FP ? `<div class="st-only s3-fpword" data-only="${at('fp')}"></div>` : ''}
          <div class="st-only" data-only="${LAST}"><p class="st-line">${VEE() ? `Translate every month before 2022 up to ${castName('newer')}'s scale, and <b>every year sits on one scale.</b>` : 'Translate every month since 2022, and <b>every year sits on one scale.</b>'}${SHOW_WAVE() ? ' The wave keeps breathing evenly.' : ''}</p>
            <p class="st-small">${VEE() ? veeLine() : months ? `${yr}: VIIRS counted ${fmt(tot('newer'))} detections; on MODIS's scale, ${fmt(tot('ours'))}.` : ''}</p>
</div>
        </div></div>
        ${SHOW_WAVE() ? waveBlock('s3-wave') : `<div class="st-wave s3-wave s3-yb"><p class="wv-cap"><b>Argentina's fire detections, year by year.</b></p><div class="wv-box"></div></div>`}
        ${FP ? '<div class="s3-fp" aria-hidden="true"></div>' : ''}`;
      if (FP) {      // the seven chances from the engine's own curve; the count of countries from data/fire_power.json (tools/build_fire_power.cjs)
        const get = u => fetch(u).then(r => { if (!r.ok) throw new Error('could not read ' + u.split('/').pop() + ' (' + r.status + ')'); return r.json(); });
        Promise.all([get((S.ctx.partsBase || 'parts/engine_and_data/') + 'data/world_by_country/shared/curve.json'), get('data/fire_power.json')])
          .then(([c, f]) => { fpCurve = c; fpRes = f; fpBuild(); }).catch(e => { fpErr = e.message; fpBuild(); });
      }
      Promise.all([loadGlow(), loadShapes()]).then(([g, sh]) => { glow = g; shapes = sh; globe = null; sc.layout(); }).catch(e => { glow = null; const w = sec.querySelector('.s3-when'); if (w) w.textContent = e.message; sc.layout(); });
    };
    function fpBuild() {
      const box = sec && sec.querySelector('.s3-fp'); if (!box) return;
      if (fpErr || !fpCurve || !Array.isArray(fpCurve.chance) || fpCurve.chance.length !== 7) { box.innerHTML = nothing(fpErr || 'the fire-power curve is not in the expected shape'); return; }
      const ch = fpCurve.chance, ed = fpCurve.band_edges_mw, mx = Math.max(...ch);
      const mw = i => i === 0 ? `under ${ed[0]}` : i === ed.length ? `${ed[ed.length - 1]} and up` : `${ed[i - 1]} to ${ed[i]}`;
      const bars = ch.map((c, i) => `<li style="--h:${(c / mx).toFixed(3)};--i:${i}"><b class="fp-n">${Math.round(c * 100)}<small> in 100</small></b><span class="fp-bar"></span>
          <span class="fp-flame" style="--f:${(.45 + .55 * i / 6).toFixed(2)}" aria-hidden="true"></span><span class="fp-w">${FP_WORDS[i]}</span><span class="fp-mw">${mw(i)} MW</span></li>`).join('');
      const R = fpRes && fpRes.closer != null ? fpRes : null;
      box.innerHTML = `<header class="st-head"><p class="st-eyebrow">Our next step · built and tested</p><h2 class="st-h">A smarter version, <em>built and tested</em></h2></header>
        <div class="fp-chart"><p class="fp-cap">${castName('newer')}'s fires, sorted by how much heat they give off. Each bar: how often ${castName('older')} also sees a fire that strong.</p>
          <div class="fp-ends"><div class="fp-end n">${slot('newer_idle', 'fp-pal')}<span>${castName('newer')} sees the faint ones too</span></div>
          <ol class="fp-bars">${bars}</ol>
          <div class="fp-end o">${slot('older_idle', 'fp-pal')}<span>${castName('older')} mostly sees the big, hot fires</span></div></div>
          <p class="fp-axis">fire power, in megawatts (MW)</p></div>
        <div class="fp-foot"><p class="fp-how">Sort ${castName('newer')}'s count by strength, apply these chances, then the twelve month numbers.</p>
          ${R ? `<p class="fp-badge">closer in <b>${R.closer} of the ${R.countries}</b> countries with a lot of fire <i>our next step</i></p>` : ''}</div>`;
      const w = sec.querySelector('.s3-fpword');
      if (w) w.innerHTML = `<p class="st-line">A smarter version sorts ${castName('newer')}'s fires by strength first.</p>`;
      box.setAttribute('aria-label', `A smarter version, built and tested. ${castName('newer')}'s fires sorted into seven bands, faintest to strongest; the chance ${castName('older')} also sees a fire that strong: ` +
        ch.map((c, i) => FP_WORDS[i] + ' (' + mw(i) + ' MW) about ' + Math.round(c * 100) + ' in 100').join(', ') + '.' + (R ? ` Closer in ${R.closer} of the ${R.countries} countries with a lot of fire; our next step.` : ''));
      box.setAttribute('role', 'img');
    }
    function fpShow(on, animate) {
      if (!sec) return; const was = sec.classList.contains('s3-fpon'); sec.classList.toggle('s3-fpon', on);
      const box = sec.querySelector('.s3-fp'); if (box) box.setAttribute('aria-hidden', String(!on));
      if (on && !was && animate && !S.still) { sec.classList.remove('s3-fpgo'); void sec.offsetWidth; sec.classList.add('s3-fpgo'); S.busy = S.busy || {}; S.busy.s3fp = performance.now() + 1700; }
      if (!on) sec.classList.remove('s3-fpgo');
    }
    function geom() { const Sz = S.port ? 640 : 680; return { Sz, c: Sz / 2, R: .262 * Sz, ringIn: .274 * Sz, ringOut: .318 * Sz, r0: .328 * Sz, rMax: .412 * Sz, rNum: .448 * Sz }; }
    function fwd(lon, lat) { const dl = (lon - LON0) * RAD, la = lat * RAD, sl = Math.sin(LAT0 * RAD), cl = Math.cos(LAT0 * RAD);
      return [Math.cos(la) * Math.sin(dl), cl * Math.sin(la) - sl * Math.cos(la) * Math.cos(dl), sl * Math.sin(la) + cl * Math.cos(la) * Math.cos(dl)]; }
    function buildGlobe(G, px) {     // land once, and each month's fire as a glowing layer, all at the canvas's pixel size
      const D = Math.ceil(2 * G.R * px), mk = () => { const c = document.createElement('canvas'); c.width = c.height = D; return c; };
      const P = (lon, lat) => { const p = fwd(lon, lat); let x = p[0], y = p[1]; if (p[2] < 0) { const k = Math.hypot(x, y) || 1; x /= k; y /= k; } return [(1 + x) * D / 2, (1 - y) * D / 2, p[2]]; };
      const land = mk(), g = land.getContext('2d');
      const oc = g.createRadialGradient(D * .4, D * .38, D * .05, D / 2, D / 2, D / 2); oc.addColorStop(0, '#12305a'); oc.addColorStop(1, '#050d1c');
      g.fillStyle = oc; g.beginPath(); g.arc(D / 2, D / 2, D / 2, 0, 2 * Math.PI); g.fill();
      g.save(); g.clip();
      g.strokeStyle = 'rgba(140,170,210,.13)'; g.lineWidth = Math.max(1, px);
      for (let la = -60; la <= 60; la += 30) { g.beginPath(); for (let lo = -180; lo <= 180; lo += 4) { const q = P(lo, la); if (q[2] < 0) { continue; } g.lineTo(q[0], q[1]); } g.stroke(); }
      for (let lo = -180; lo < 180; lo += 30) { g.beginPath(); let on = false; for (let la = -88; la <= 88; la += 4) { const q = P(lo, la); if (q[2] < 0) { on = false; continue; } if (!on) { g.moveTo(q[0], q[1]); on = true; } else g.lineTo(q[0], q[1]); } g.stroke(); }
      if (shapes) shapes.shapes.forEach(sh => {
        const vis = sh.rings.some(rg => rg.some(([x, y]) => fwd(x / 10, y / 10)[2] > 0)); if (!vis) return;
        g.beginPath(); sh.rings.forEach(rg => rg.forEach(([x, y], i) => { const q = P(x / 10, y / 10); if (i) g.lineTo(q[0], q[1]); else g.moveTo(q[0], q[1]); }));
        g.fillStyle = sh.file === 'Argentina' ? '#33465f' : '#243247'; g.fill();
        g.strokeStyle = sh.file === 'Argentina' ? 'rgba(255,236,200,.75)' : 'rgba(120,145,175,.35)'; g.lineWidth = (sh.file === 'Argentina' ? 2.2 : 1) * px; g.stroke();
      });
      g.restore();
      const fire = glow ? glow.months.map(a => {
        const c = mk(), q = c.getContext('2d'), sharp = mk(), qs = sharp.getContext('2d'), sz = Math.max(1.6, G.R * px * .5 * RAD * 1.25);
        for (let i = 0; i < a.length; i += 3) { const lon = (a[i] - 184) / 2 + .25, lat = (a[i + 1] - 116) / 2 + .25, v = a[i + 2]; const p = fwd(lon, lat); if (p[2] <= 0.02) continue;
          const [r, gg, b] = fireRGB(v); qs.fillStyle = `rgba(${r},${gg},${b},${Math.min(1, .45 + v / 120).toFixed(2)})`; qs.fillRect((1 + p[0]) * D / 2 - sz / 2, (1 - p[1]) * D / 2 - sz / 2, sz, sz); }
        q.filter = `blur(${(3 * px).toFixed(1)}px)`; q.globalAlpha = .95; q.drawImage(sharp, 0, 0); q.filter = 'none'; q.globalAlpha = 1; q.globalCompositeOperation = 'lighter'; q.drawImage(sharp, 0, 0);
        return c; }) : null;
      const toon = mk(), q = toon.getContext('2d');      // the same planet drawn flat, in the hand of the hills on slides 1 and 2
      q.fillStyle = '#4f93dc'; q.beginPath(); q.arc(D / 2, D / 2, D / 2, 0, 2 * Math.PI); q.fill(); q.save(); q.clip();
      if (shapes) shapes.shapes.forEach(sh => {
        const vis = sh.rings.some(rg => rg.some(([x, y]) => fwd(x / 10, y / 10)[2] > 0)); if (!vis) return;
        q.beginPath(); sh.rings.forEach(rg => rg.forEach(([x, y], i) => { const p = P(x / 10, y / 10); if (i) q.lineTo(p[0], p[1]); else q.moveTo(p[0], p[1]); }));
        q.fillStyle = sh.file === 'Argentina' ? '#a9d97f' : '#7cc46a'; q.fill(); });
      q.restore(); q.strokeStyle = '#1b2433'; q.lineWidth = 5 * px; q.beginPath(); q.arc(D / 2, D / 2, D / 2 - 2.5 * px, 0, 2 * Math.PI); q.stroke();
      return { land, toon, fire, D, px };
    }
    const angOf = x => (x / 12) * 2 * Math.PI - Math.PI / 2;
    function sector(g, c, a0, a1, r0, r1) { g.beginPath(); g.arc(c, c, r1, a0, a1); g.arc(c, c, r0, a1, a0, true); g.closePath(); }
    function draw() {
      const cv = sec && sec.querySelector('.s3-cv'); if (!cv) return;
      const G = geom(), px = Math.min(2, Math.max(1, (S.scale || 1) * (window.devicePixelRatio || 1)));
      if (cv.width !== Math.round(G.Sz * px)) { cv.width = cv.height = Math.round(G.Sz * px); globe = null; }
      cv.style.width = cv.style.height = G.Sz + 'px';
      if (!globe || globe.px !== px) globe = buildGlobe(G, px);
      const g = cv.getContext('2d'), cs = getComputedStyle(S.root), camN = (cs.getPropertyValue('--cam-newer-hi') || '#b9a0f4').trim(), camO = (cs.getPropertyValue('--cam-older-hi') || '#9ab3ef').trim();
      g.setTransform(px, 0, 0, px, 0, 0); g.clearRect(0, 0, G.Sz, G.Sz);
      const c = G.c, H = G.rMax - G.r0;
      // the corona: twelve wedge tracks
      g.globalAlpha = ringA; for (let k = 0; k < 12; k++) { sector(g, c, angOf(k) + .03, angOf(k + 1) - .03, G.r0, G.rMax); g.fillStyle = 'rgba(255,255,255,.035)'; g.fill(); }
      const wedge = (k, part, of, v, max, fill, ghost) => { const a0 = angOf(k) + .03, a1 = angOf(k + 1) - .03, w = (a1 - a0) / of, b0 = a0 + w * part + (part ? .012 : 0), b1 = a0 + w * (part + 1) - (part < of - 1 ? .012 : 0);
        const len = Math.max(3, H * Math.min(1, v / max)); sector(g, c, b0, b1, G.r0, G.r0 + len);
        if (ghost) { g.setLineDash([5, 5]); g.strokeStyle = ghost; g.lineWidth = 1.5; g.stroke(); g.setLineDash([]); return; }
        g.save(); g.shadowColor = fill; g.shadowBlur = 14; g.fillStyle = fill; g.fill(); g.restore(); };
      if (stNow === 1 && shared) { const max = Math.max(...shared.map(x => x.newer)); shared.forEach((m, k) => { wedge(k, 0, 2, m.newer, max, camN); wedge(k, 1, 2, m.older, max, camO); });
        if (hiLo) { g.textAlign = 'center'; g.textBaseline = 'middle';
          for (const k of [hiLo.hi, hiLo.lo]) { const a = angOf(k + .5), rr = G.rMax + 34; g.font = `600 ${S.port ? 25 : 24}px ${cs.getPropertyValue('--mono')}`;
            g.fillStyle = '#fff3d6'; g.fillText(`${MON3[k]}: ${Math.round(f[k] * 100)} per 100`, c + Math.cos(a) * rr, c + Math.sin(a) * rr); } } }
      if (stNow >= 2 && months) {
        const max = Math.max(...months.map(m => m.newer));
        months.forEach((m, k) => { const s = Math.min(1, Math.max(0, hand * 12 - k)), v = m.newer + (m.ours - m.newer) * s;
          if (s > 0) wedge(k, 0, 1, m.newer, max, null, 'rgba(185,160,244,.55)');
          wedge(k, 0, 1, v, max, s >= 1 ? GOLD : s > 0 ? `color-mix(in srgb, ${GOLD} ${(s * 100).toFixed(0)}%, ${camN})` : camN); });
      }
      // the month ring (arrives with the wedges)
      g.globalAlpha = ringA;
      sector(g, c, 0, 2 * Math.PI, G.ringIn, G.ringOut); g.fillStyle = '#0d1a2b'; g.fill();
      g.strokeStyle = 'rgba(159,176,198,.35)'; g.lineWidth = 1; for (let k = 0; k < 12; k++) { const a = angOf(k); g.beginPath(); g.moveTo(c + Math.cos(a) * G.ringIn, c + Math.sin(a) * G.ringIn); g.lineTo(c + Math.cos(a) * G.ringOut, c + Math.sin(a) * G.ringOut); g.stroke(); }
      g.textAlign = 'center'; g.textBaseline = 'middle';
      for (let k = 0; k < 12; k++) { const a = angOf(k + .5), rr = (G.ringIn + G.ringOut) / 2; g.font = `500 ${S.port ? 23 : 22}px ${cs.getPropertyValue('--mono')}`;
        g.fillStyle = k === 9 && stNow >= 2 ? GOLD : '#a5b2c2'; g.fillText(MON3[k], c + Math.cos(a) * rr, c + Math.sin(a) * rr + 1); }
      // the twelve conversion numbers, outside the wedges
      const under = stNow === 2 && hand < 1 ? Math.min(11, Math.floor(hand * 12)) : -1;
      if (stNow >= 2 && f) for (let k = 0; k < 12; k++) { const a = angOf(k + .5); g.font = `${k === under ? 700 : 500} ${k === under ? 30 : 25}px ${cs.getPropertyValue('--mono')}`;
        g.fillStyle = k === under ? GOLD : '#ffe2a8'; g.fillText(f[k].toFixed(2), c + Math.cos(a) * G.rNum, c + Math.sin(a) * G.rNum); }
      // the globe: first the friendly drawn planet, then the real one glowing for the month under the hand (October before the hand moves)
      g.globalAlpha = 1; g.save(); g.shadowColor = 'rgba(90,150,255,.55)'; g.shadowBlur = 28; g.beginPath(); g.arc(c, c, G.R, 0, 2 * Math.PI); g.fillStyle = '#071226'; g.fill(); g.restore();
      g.globalAlpha = real; g.drawImage(globe.land, c - G.R, c - G.R, 2 * G.R, 2 * G.R); g.globalAlpha = 1 - real; g.drawImage(globe.toon, c - G.R, c - G.R, 2 * G.R, 2 * G.R); g.globalAlpha = 1;
      const mf = stNow >= 2 ? Math.min(11.999, hand * 12) : 9.5, m0 = Math.floor(mf), ft = mf - m0 - .5;
      if (globe.fire && real > 0 && isFinite(mf)) try { const a = ft < 0 ? m0 : m0, b = ft < 0 ? Math.max(0, m0 - 1) : Math.min(11, m0 + 1), wB = Math.abs(ft) * .8;
        g.globalAlpha = (1 - wB) * real; g.drawImage(globe.fire[a], c - G.R, c - G.R, 2 * G.R, 2 * G.R); g.globalAlpha = wB * real; g.drawImage(globe.fire[b], c - G.R, c - G.R, 2 * G.R, 2 * G.R); g.globalAlpha = 1; } catch (e) { g.globalAlpha = 1; }
      const sh = g.createRadialGradient(c - G.R * .35, c - G.R * .4, G.R * .2, c, c, G.R); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.75, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,4,12,.55)');
      g.globalAlpha = real; g.fillStyle = sh; g.beginPath(); g.arc(c, c, G.R, 0, 2 * Math.PI); g.fill();
      g.strokeStyle = 'rgba(120,170,255,.5)'; g.lineWidth = 2; g.stroke(); g.globalAlpha = 1;
      // the hand
      if (stNow >= 2) { const a = hand * 2 * Math.PI - Math.PI / 2; g.strokeStyle = '#f4edda'; g.lineWidth = 3; g.lineCap = 'round'; g.beginPath(); g.moveTo(c + Math.cos(a) * (G.R + 4), c + Math.sin(a) * (G.R + 4)); g.lineTo(c + Math.cos(a) * (G.rMax + 14), c + Math.sin(a) * (G.rMax + 14)); g.stroke(); }
      const mon = MONTHS[Math.min(11, Math.floor(mf))];
      sec.querySelector('.s3-when').innerHTML = stNow < 2 ? '' : `<b>${glow ? glow.year : ''}</b> <span>${mon}</span><small>globe: fire seen by MODIS</small>`;
      cv.setAttribute('aria-label', `A clock: one turn of the hand is one year. Inside it, the globe on Argentina's side glows where MODIS saw fire in ${mon} ${glow ? glow.year : ''}. ` +
        (stNow === 1 && shared ? 'Twelve wedges, one per month, the ten shared years 2012 to 2021 added up: the newer camera counted ' + shared.map((m, i) => MON3[i] + ' ' + fmt(m.newer) + ' against ' + fmt(m.older)).join('; ') + '.' : '') +
        (stNow >= 2 && f ? ` Argentina's twelve conversion numbers: ` + f.map((v, i) => MON3[i] + ' ' + v.toFixed(2)).join(', ') + '.' + (months ? ` The hand sweeps ${yr}: each month's VIIRS count becomes its count on MODIS's scale: ` + months.map((m, i) => MON3[i] + ' ' + fmt(m.newer) + ' to ' + fmt(m.ours)).join('; ') + '.' : '') : ''));
    }
    sc.numbers = () => f ? { title: 'Argentina: the conversion numbers, and one year brought onto MODIS\'s scale', tables: S.port ? [{ caption: 'Conversion numbers (learned from 2012-2021)' + (months ? ' and the months of ' + yr : ''), head: ['Month', 'Number'].concat(months ? ['VIIRS ' + yr, "MODIS's scale"] : []),
        rows: f.map((v, i) => [MON3[i], v.toFixed(3)].concat(months ? [fmt(months[i].newer), fmt(months[i].ours)] : [])) }]
      : [{ caption: 'Learned from the shared years 2012-2021: each month\'s number is MODIS\'s count divided by VIIRS\'s, over the months the engine learns from' + (skipped.length ? ' (left out as faulty: ' + skipped.join(', ') + ')' : '') + (months ? '. Then the months of ' + yr : ''),
      head: ['Month', 'Shared years: VIIRS counted', 'Shared years: MODIS counted', 'Conversion number'].concat(months ? ['VIIRS counted ' + yr, "On MODIS's scale"] : []),
      rows: f.map((v, i) => [MONTHS[i], shared ? fmt(shared[i].newer) : '', shared ? fmt(shared[i].older) : '', v.toFixed(3)].concat(months ? [fmt(months[i].newer), fmt(months[i].ours)] : [])) }] } : null;
    sc.layout = () => { draw(); drawWave(sec, W, Object.assign({ t: wt, overlap: stNow <= 1 }, stNow >= 3 ? wvOpt : {})); };
    sc.enter = () => { draw(); drawWave(sec, W, Object.assign({ t: wt, overlap: stNow <= 1 }, stNow >= 3 ? wvOpt : {})); };
    sc.step = (raw, animate) => {
      const sv = STATES[Math.max(0, Math.min(LAST, raw))], fpOn = sv === 'fp', st = fpOn ? 2 : sv;
      fpShow(fpOn, animate);
      if (fpOn) { stNow = 2; if (sec) sec.dataset.st = 2; cancelAnimationFrame(S.raf.s3hand); cancelAnimationFrame(S.raf.s3wave); if (S.busy) S.busy.s3hand = false;
        const r0 = real, a0 = ringA; if (r0 !== 0 || a0 !== 1) tween('s3real', 0, () => { real = 0; ringA = 1; });
        hand = 1; wt = 0; draw(); drawWave(sec, W, { t: 0 }); return; }
      stNow = st; if (sec) sec.dataset.st = st;
      cancelAnimationFrame(S.raf.s3hand); cancelAnimationFrame(S.raf.s3wave);
      // one new thing per press: the ring (press 2), the hand and its date (press 3), the real globe with its fire glow (press 4)
      const r0 = real, r1 = st >= 3 ? 1 : 0, a0 = ringA, a1 = st >= 1 ? 1 : 0;
      if (r0 !== r1 || a0 !== a1) tween('s3real', animate ? 1400 : 0, t => { const k = ease(t); real = r0 + (r1 - r0) * k; ringA = a0 + (a1 - a0) * k; draw(); });
      if (st < 2) { hand = 0; wt = 0; draw(); drawWave(sec, W, { t: 0, overlap: true }); return; }
      if (st === 2) { wt = 0; drawWave(sec, W, { t: 0 }); hand = 0; tween('s3hand', animate ? 4000 : 0, t => { hand = t * t * (3 - 2 * t); draw(); }); return; }
      hand = 1; draw();
      clearTimeout(S.s3beat);
      if (!VEE() || !animate || S.still || !W || !W.maxV) { wvOpt = { vee: VEE(), fromMoe: VEE() }; const from = wt; tween('s3wave', animate ? 1700 : 0, t => { wt = from + (1 - from) * ease(t); drawWave(sec, W, Object.assign({ t: wt }, wvOpt)); }); return; }
      wvOpt = { vee: false }; wt = 0; drawWave(sec, W, { t: 0 }); S.busy = S.busy || {}; S.busy.s3two = performance.now() + 6900;
      S.s3beat = setTimeout(() => { if (stNow !== 3) return;
        tween('s3wave', 2500, t => { wt = ease(t); drawWave(sec, W, { t: wt }); }, () => {
          S.s3beat = setTimeout(() => { if (stNow !== 3) return; wvOpt = { vee: true, fromMoe: true }; wt = 0;
            tween('s3wave', 2500, t => { wt = ease(t); drawWave(sec, W, Object.assign({ t: wt }, wvOpt)); }); }, 1000); }); }, 700);
    };
    sc.globeBox = () => { const cv = sec && sec.querySelector('.s3-cv'); if (!cv) return null; const a = cv.getBoundingClientRect(), b = sec.getBoundingClientRect(), G = geom();
      return { x: (a.left - b.left) / S.scale + G.c, y: (a.top - b.top) / S.scale + G.c, r: G.R }; };
    return sc;
  }

  /* =====================================================================================================
     Scene 4. Hold a year back. Then guess it.
     ===================================================================================================== */
  function scene4() {
    // the left-out-year test walked through, one step per press (team lead, 9:15 PM; clips s4_w1..s4_w7); StoryBeats.showWalkthrough = false
    // returns to the one first press. WK = how many presses the walk takes; raw press r < WK is walk step r + 1, then the chart, then the check.
    // 12:39 AM (trim the math): the walk is TWO presses. Press 1: the ten years, 2017 lifts out, the twelve numbers from the other nine.
    // Press 2: October worked through: Vee's count, x the number = our translation, Moe's own count, how far off. Each arrives in order by itself.
    const WK = !(window.StoryBeats && window.StoryBeats.showWalkthrough === false) ? 2 : 1, A0 = Array.from({ length: WK }, (_, k) => k).join(''), P1 = String(WK), P2 = String(WK + 1);
    let lastRaw = -1;
    const sc = { steps: WK + 2, title: 'How do you know it works?', cls: 's4' };
    sc.capSide = raw => raw === WK;      // the chart press fills the bottom: a caption goes in the empty space under the words
    let sec, walk = 1, hy = null, oct = null, octAll = null, sc0 = null, worst = null, show = 0, Y = [], rec = [], W4 = null;
    sc.build = s => {
      sec = s;
      const r = S.ctx.argentina;
      hy = S.ctx.adapters.hiddenYear(r, 2017); W4 = waveData(r);
      octAll = r.factors && r.factors.SNPP && r.factors.SNPP.f ? r.factors.SNPP.f[9] : null;   // slide 3's October number, learned from every shared year
      sc0 = S.ctx.readings.score(r);
      if (isRef(hy)) { s.innerHTML = `<header class="st-head"><p class="st-eyebrow">The example: Argentina</p><h2 class="st-h">How do you know <em>it works?</em></h2></header><div class="st-pic">${nothing(hy.message)}</div>`; hy = null; return; }
      const row = r.monthly.find(x => x.ym === hy.year + '-10'), m10 = hy.months[9];
      oct = { newer: row && row.raw ? row.raw.SNPP : null, guess: m10.guess, actual: m10.actual };
      oct.factor = oct.newer ? oct.guess / oct.newer : null;           // the hidden-year October number, read back from the engine's own guess
      oct.miss = (oct.guess - oct.actual) / oct.actual * 100;
      // the two largest percentage misses among months where both counts are 16 or more, in calendar order
      const miss = m => (m.guess - m.actual) / m.actual * 100;
      worst = hy.months.map((m, i) => ({ m, i })).filter(o => o.m.guess != null && o.m.actual != null && o.m.guess >= 16 && o.m.actual >= 16)
        .sort((a, b) => Math.abs(miss(b.m)) - Math.abs(miss(a.m))).slice(0, 2).sort((a, b) => a.i - b.i)
        .map(o => ({ i: o.i, pct: miss(o.m), m: o.m }));
      const farLine = worst.length ? 'Not every month is close: ' + worst.map((w, k) => `${MONTHS[w.i]}${k ? '' : ' came out'} ${Math.round(Math.abs(w.pct))}% ${w.pct < 0 ? 'low' : 'high'}`).join(', ') + '.' : '';
      const tp = sc0 && sc0.typicalPct != null ? Math.round(sc0.typicalPct) : null, ot = sc0 && sc0.oneInTenPct != null ? Math.round(sc0.oneInTenPct) : null;
      // October's miss as a share a person can feel: "about a tenth too low"
      const am = Math.abs(oct.miss) / 100, side = oct.miss < 0 ? 'low' : 'high';
      const share = am < 0.03 ? null : am < 0.07 ? 'a few percent' : am < 0.14 ? 'about a tenth' : am < 0.19 ? 'about a sixth' : am < 0.29 ? 'about a quarter' : am < 0.41 ? 'about a third' : am < 0.6 ? 'about half' : 'far';
      const octLine = share ? `Our guess for October was ${share} too ${side}.` : 'Our guess for October was almost exactly right.';
      // the last press: the check since 2021 (MODIS kept flying), each year against MODIS's own count
      Y = S.ctx.readings.yearly(r).filter(y => y.complete && y.ours != null);
      rec = Y.filter(y => y.year >= 2022 && y.olderOwn != null).map(y => ({ year: y.year, ours: y.ours, own: y.olderOwn, gap: (y.ours - y.olderOwn) / y.olderOwn * 100 }));
      // the finding in plain words, built from the yearly gaps: the first run of years within 3%, then how the rest lean
      const NW = ['no', 'one', 'two', 'three', 'four', 'five', 'six'];
      let k = 0; while (k < rec.length && Math.abs(rec[k].gap) < 3) k++;
      const rest = rec.slice(k), allLow = rest.length && rest.every(g => g.gap <= -3), allHigh = rest.length && rest.every(g => g.gap >= 3);
      const big = rest.length ? Math.max(...rest.map(g => Math.abs(g.gap))) : 0, lean = big < 12 ? 'a little ' : '';
      let finding;
      if (!rec.length) finding = 'MODIS has no whole year after 2021 here to check us against.';
      else if (!rest.length) finding = `Every year since ${rec[0].year}, our record and MODIS agree almost exactly.`;
      else finding = `Since ${rec[0].year}, our record and MODIS stay within about ${Math.round(big)}% of each other, year by year.`;

      s.innerHTML = `
        <header class="st-head"><p class="st-eyebrow">Argentina · ${hy.year} left out</p>
          <h2 class="st-h">How do you know <em>it works?</em></h2></header>
        <div class="st-pic"><div class="st-swap"><div class="st-only s4-main" data-only="${A0}${P1}">
          ${WK > 1 ? `<div class="s4-years st-only" data-only="${A0}" aria-label="The ten shared years, 2012 to 2021, with ${hy.year} set aside">${Array.from({ length: 10 }, (_, k) => 2012 + k).map(y => `<span class="${y === hy.year ? 'held' : ''}">${y}</span>`).join('')}</div>` : ''}
          <ol class="s4-trace" aria-label="October ${hy.year}, traced">
            <li class="chip blue-ish" data-w="4"><span>${slot('newer_idle', 'guide')}October ${hy.year}: VIIRS, the newer camera, counted</span><b data-n="newer">${fmt(oct.newer)}</b></li>
            <li class="op" aria-hidden="true" data-w="5">×</li>
            <li class="chip factor" data-w="3"><span>October's conversion number, worked out with ${hy.year} left out${octAll != null ? ` (${octAll.toFixed(4)} with every year)` : ''}</span><b>${oct.factor == null ? 'no data' : oct.factor.toFixed(4)}</b></li>
            <li class="op" aria-hidden="true" data-w="5">=</li>
            <li class="chip gold guess" data-w="5"><span>our translation</span><b data-n="guess">${fmt(oct.guess)}</b></li>
            <li class="chip blue" data-w="6"><span>${slot('older_idle', 'guide')}against MODIS alone, the older camera's own count</span><b data-n="actual">${fmt(oct.actual)}</b></li>
            <li class="chip verdict" data-w="6"><span>our translation was off by</span><b>${p1(oct.miss)}</b><span>${oct.miss < 0 ? 'low' : 'high'}</span></li>
          </ol>
          <div class="s4-chart st-step" data-at="${P1}"></div>
          ${hy && hy.year === 2017 ? `<p class="st-step s4-jan-note" data-at="${P1}"><b>January 2017:</b> after a severe drought, about two dozen wildfires swept the Pampas. Huge fires are the kind ${castName('older')} catches well, so our translation ran low.<small>NASA Earth Observatory, Jan 5, 2017</small></p>` : ''}
</div>
          <div class="st-only s4-check" data-only="${P2}"><div class="s3-table">${rec.length ? `<table><caption>Fire detections per year: MODIS alone beside ours</caption>
              <thead><tr><th scope="col">Year</th><th scope="col">MODIS alone</th><th scope="col">Ours</th><th scope="col">Ours against it</th></tr></thead><tbody>
              ${rec.map(g => `<tr><th scope="row">${g.year}</th><td class="b">${fmt(g.own)}</td><td class="g">${fmt(g.ours)}</td><td>${p1(g.gap)} ${g.gap < 0 ? 'lower' : 'higher'}</td></tr>`).join('')}</tbody></table>` : nothing('MODIS has no whole year after 2021 here')}</div><div class="s4-chk"></div></div>
        </div></div>
        <div class="st-words"><p class="st-bridge st-only" data-only="${A0}${P1}">Nice picture. Is it right?</p><div class="st-swap">
          ${WK > 1 ? `<ol class="s4-walk st-only" data-only="${A0}">
            <li class="st-step" data-at="0" data-k="0"><b>1</b>Ten shared years: 2012 to 2021, both cameras flying.</li>
            <li class="st-step" data-at="0" data-k="1"><b>2</b>Set ${hy.year} aside.</li>
            <li class="st-step" data-at="0" data-k="2"><b>3</b>Work out the twelve numbers from the other nine years. October's: <i>${oct.factor == null ? 'no data' : oct.factor.toFixed(4)}</i>.</li>
            <li class="st-step" data-at="1" data-k="0"><b>4</b>${castName('newer')} counted <i>${fmt(oct.newer)}</i> in October ${hy.year}.</li>
            <li class="st-step" data-at="1" data-k="1"><b>5</b><i>${fmt(oct.newer)} × ${oct.factor == null ? '?' : oct.factor.toFixed(4)} = ${fmt(oct.guess)}</i>, our translation.</li>
            <li class="st-step" data-at="1" data-k="2"><b>6</b>${castName('older')} actually counted <i>${fmt(oct.actual)}</i>: <i>${p1(oct.miss)} ${oct.miss < 0 ? 'low' : 'high'}</i>.</li></ol>` : ''}
          <div class="st-only" data-only="${WK > 1 ? 'x' : '0'}"><p class="st-line"><b>Leave a year out, translate it, compare.</b> We left ${hy.year} out while working out the twelve numbers, then translated ${hy.year}'s newer-camera counts and compared them with MODIS alone.</p>
            <p class="st-sub">${octLine.replace('Our guess', 'Our translation')}</p>
            <p class="st-small">Which months to throw out as faulty was still decided using every year.</p></div>
          <div class="st-only" data-only="${P1}">${WK > 1 && sc0 && sc0.months ? `<p class="st-small s4-months">The same for every month of every shared year: ${sc0.months} months.</p>` : ''}<p class="st-line">${tp == null ? 'No fair left-out score exists here.' : `Left out one year at a time, a typical month lands <b>within about ${tp}%</b> of MODIS alone.`}</p>${tp != null && ot != null ? `<p class="st-sub s4-nine">Nine months in ten land within ${ot}%.</p>` : ''}</div>
          <div class="st-only" data-only="${P2}"><p class="st-line">MODIS kept flying after 2021, so <b>MODIS alone</b> referees the recent years. ${finding}</p>
            <p class="st-sub s4-sub">That's agreement with one camera, not with the ground. We can't yet tell which is closer to it.</p></div>
        </div></div>
        ${SHOW_WAVE() ? waveBlock('s4-wave') : ''}        </div></div>`;
    };
    function chart3() {     // the check since 2021 (MODIS kept flying): our yearly line, MODIS's own years as blue dots
      const box = sec && sec.querySelector('.s4-chk'); if (!box || !Y || !Y.length) return;
      const D = dims(980, 300, 380), { w, h, fs } = D, L = 96, Rm = 30, T = 24, B = 60;
      const n = Y.length, x = i => L + i * (w - L - Rm) / (n - 1);
      const max = Math.max(...Y.map(y => Math.max(y.ours, y.olderOwn || 0))) * 1.12, yy = v => T + (h - T - B) * (1 - v / max);
      const i12 = Y.findIndex(y => y.year === 2012), i21 = Y.findIndex(y => y.year === 2021), half = (w - L - Rm) / (n - 1) / 2;
      const path = Y.map((y, i) => (i ? 'L' : 'M') + x(i).toFixed(1) + ',' + yy(y.ours).toFixed(1)).join(' ');
      const ticks = [0, 20000, 40000].filter(v => v < max);
      const label = `Argentina's yearly fire detections on one scale, ${Y[0].year} to ${Y[n - 1].year}, gold; both cameras flew together 2012 to 2021, shaded. Every year: ` + Y.map(y => y.year + ' ' + fmt(y.ours)).join('; ') + '.' +
        (1 ? ' Blue dots: the older camera\'s own count, ' + rec.map(g => g.year + ' ' + fmt(g.own) + ' against ours ' + fmt(g.ours)).join('; ') + '.' : '');
      box.innerHTML = svg(w, h, `
        ${i12 >= 0 && i21 >= 0 ? `<rect x="${x(i12) - half}" y="${T}" width="${x(i21) - x(i12) + 2 * half}" height="${h - T - B}" class="shade"/>
          <text x="${(x(i12) + x(i21)) / 2}" y="${h - B - 14}" text-anchor="middle" style="font-size:${fs}px" class="paper">both cameras flying, 2012–2021</text>` : ''}
        ${ticks.map(v => `<line x1="${L}" x2="${w - Rm}" y1="${yy(v)}" y2="${yy(v)}" class="grid"/><text x="${L - 14}" y="${yy(v) + fs * .35}" text-anchor="end" style="font-size:${fs}px">${v ? v / 1000 + 'k' : '0'}</text>`).join('')}
        <path d="${path}" fill="none" stroke="#ffcd79" stroke-width="${S.port ? 5 : 6}" stroke-linejoin="round"/>
        ${Y.map((y, i) => `<circle cx="${x(i)}" cy="${yy(y.ours)}" r="5" fill="#ffcd79"/>`).join('')}
        ${1 ? rec.map(g => { const i = Y.findIndex(y => y.year === g.year); return `<circle cx="${x(i)}" cy="${yy(g.own)}" r="${S.port ? 13 : 16}" fill="none" style="stroke:var(--blue)" stroke-width="5"/>`; }).join('') +
          `<text x="${L + 14}" y="${h - B - 16}" style="font-size:${fs}px" class="blue">○ MODIS alone</text>` : ''}
        <text x="${L + 14}" y="${h - B - 16 - (1 ? fs + 12 : 0)}" style="font-size:${fs}px" class="gold">— ${esc(S.ctx.readings.recordName ? S.ctx.readings.recordName(S.ctx.argentina) : 'our record')}</text>
        ${Y.map((y, i) => (y.year % 4 === 1 || i === n - 1) ? `<text x="${x(i)}" y="${h - B + fs + 14}" text-anchor="middle" style="font-size:${fs}px">${y.year}</text>` : '').join('')}
        <line x1="${L}" x2="${w - Rm}" y1="${h - B}" y2="${h - B}" class="axis"/>`, label);
    }
    function chart() {
      const box = sec && sec.querySelector('.s4-chart'); if (!box || !hy) return;
      const D = dims(980, 400, 460), { w, h, fs } = D, L = 96, Rm = 30, T = 70, B = 56;
      const ms = hy.months, x = i => L + 20 + i * (w - L - Rm - 40) / 11;
      const max = Math.max(...ms.map(m => Math.max(m.guess || 0, m.actual || 0))) * 1.15, yy = v => T + (h - T - B) * (1 - v / max);
      const line = k => ms.map((m, i) => m[k] == null ? '' : (i && ms[i - 1][k] != null ? 'L' : 'M') + x(i).toFixed(1) + ',' + yy(m[k]).toFixed(1)).join(' ');
      const far = worst.map(wv => `${MONTHS[wv.i]} ${Math.round(Math.abs(wv.pct))}% ${wv.pct < 0 ? 'low' : 'high'}`).join(', ');
      const label = `${hy.year}, month by month, left out. Our translation (gold) against MODIS alone (blue): ` +
        ms.map((m, i) => MON3[i] + ' ' + fmt(m.guess) + ' against ' + fmt(m.actual)).join('; ') + (far ? `. Two largest percentage misses: ${far}.` : '.');
      // only the month the voice tells the story of carries a circle (orchestrator, 1:35 AM): the furthest LOW month (January 2017, the Pampas
      // fires); the other far month keeps its bar, its number and its place in the line underneath
      const story = worst.filter(wv => wv.pct < 0).sort((p, q) => p.pct - q.pct).slice(0, 1);
      const marks = story.map(wv => { const a = yy(wv.m.guess), b = yy(wv.m.actual), cy = (a + b) / 2, rr = Math.abs(a - b) / 2 + 20;
        return `<circle cx="${x(wv.i)}" cy="${cy}" r="${rr}" fill="none" stroke="#ff7541" stroke-width="3"/>
          <text x="${x(wv.i)}" y="${cy - rr - 12}" text-anchor="middle" style="font-size:${fs}px" class="ember">${Math.round(Math.abs(wv.pct))}% ${wv.pct < 0 ? 'low' : 'high'}</text>` +
          ''; }).join('');
      box.innerHTML = svg(w, h, `
        ${[0, 2000, 4000, 6000].filter(v => v < max).map(v => `<line x1="${L}" x2="${w - Rm}" y1="${yy(v)}" y2="${yy(v)}" class="grid"/><text x="${L - 14}" y="${yy(v) + fs * .35}" text-anchor="end" style="font-size:${fs}px">${v ? v / 1000 + 'k' : '0'}</text>`).join('')}
        <path d="${line('actual')}" fill="none" style="stroke:var(--blue)" stroke-width="${S.port ? 4 : 5}"/>
        <path d="${line('guess')}" fill="none" stroke="#ffcd79" stroke-width="${S.port ? 4 : 5}" stroke-dasharray="${S.port ? '10 7' : '12 8'}"/>
        ${ms.map((m, i) => `${m.actual != null ? `<circle cx="${x(i)}" cy="${yy(m.actual)}" r="${S.port ? 8 : 10}" style="fill:var(--blue)"/>` : ''}${m.guess != null ? `<rect x="${x(i) - 7}" y="${yy(m.guess) - 7}" width="14" height="14" fill="#ffcd79" transform="rotate(45 ${x(i)} ${yy(m.guess)})"/>` : ''}`).join('')}
        ${marks}
        <text x="${x(9)}" y="${yy(ms[9].actual) - 34}" text-anchor="middle" style="font-size:${fs}px" class="paper">Oct</text>
        <g style="font-size:${fs}px"><rect x="${L + 20}" y="${T}" width="16" height="16" fill="#ffcd79" transform="rotate(45 ${L + 28} ${T + 8})"/><text x="${L + 50}" y="${T + 14}" class="gold">our translation</text>
          <circle cx="${L + 28}" cy="${T + 48}" r="9" style="fill:var(--blue)"/><text x="${L + 50}" y="${T + 56}" class="blue">MODIS alone</text></g>
        <text x="${L - 14}" y="${fs}" text-anchor="start" style="font-size:${fs}px" class="paper">Argentina, ${hy.year}: fire detections per month</text>
        ${ms.map((m, i) => `<text x="${x(i)}" y="${h - B + fs + 12}" text-anchor="middle" style="font-size:${fs}px">${S.port ? MON1[i] : MON3[i]}</text>`).join('')}
        <line x1="${L}" x2="${w - Rm}" y1="${h - B}" y2="${h - B}" class="axis"/>`, label);
    }
    sc.layout = () => { chart(); chart3(); drawWave(sec, W4, { t: 1, held: show < 1 && hy && (WK === 1 || walk >= 2) ? hy.year : null, check: show >= 2, say: false }); };
    sc.enter = animate => {
      if (!hy) return;
      const chips = sec.querySelectorAll('.s4-trace > li');
      if (WK === 1) chips.forEach((c, i) => { c.style.transitionDelay = (animate && !S.still ? i * 180 : 0) + 'ms'; });
      else if (animate && S.step === 0) { lastRaw = -1; walkOrder(0, true); lastRaw = 0; }      // arriving on the first walk press: its parts in order
      walkChips(walk);
      countUp(sec.querySelector('[data-n=newer]'), oct.newer, false); countUp(sec.querySelector('[data-n=guess]'), oct.guess, false); countUp(sec.querySelector('[data-n=actual]'), oct.actual, false);   // the chips arrive; the numbers in them never move
      chart();
    };
    sc.numbers = () => hy ? { title: hy.year + ", left out: our translation against MODIS alone", tables: [{ caption: 'Argentina, ' + hy.year + ', fire detections per month', head: ['Month', 'Our translation', 'MODIS alone', 'Off by'],
      rows: hy.months.map((m, i) => [MONTHS[i], fmt(m.guess), fmt(m.actual), m.guess != null && m.actual ? p1((m.guess - m.actual) / m.actual * 100) + (m.guess < m.actual ? ' low' : ' high') : '']) },
      { caption: 'Whole years: ours against MODIS on its own (the check since 2021)', head: ['Year', 'Ours (one scale)', 'MODIS alone', 'Ours against it'],
        rows: Y.map(y => [y.year, fmt(y.ours), y.olderOwn == null ? 'no separate count' : fmt(y.olderOwn), y.year >= 2022 && y.olderOwn ? p1((y.ours - y.olderOwn) / y.olderOwn * 100) + (y.ours < y.olderOwn ? ' lower' : ' higher') : '']) }] } : null;
    // chips by their old walk step (data-w): 3 = the October number (press 1); 4 to 6 = October worked through (press 2)
    function walkChips(w) { if (!sec) return; sec.querySelectorAll('.s4-trace > li').forEach(c => c.classList.toggle('on', WK === 1 || w > 6 || +(c.dataset.w || 0) <= w));
      sec.classList.toggle('s4-held', WK > 1 && w >= 2); }
    // the order inside a walk press: delays set only when moving forward with motion on (Back and early presses land settled)
    function walkOrder(raw, animate) {
      if (!sec) return; const fwd = animate && !S.still && WK > 1 && raw < WK && raw === lastRaw + 1;
      sec.querySelectorAll('.s4-walk li').forEach(li => { li.style.transitionDelay = fwd && +li.dataset.at === raw ? (raw === 0 ? 500 : 0) + (+li.dataset.k) * 450 + 'ms' : '0ms'; });
      sec.querySelectorAll('.s4-trace > li').forEach(c => { const dw = +(c.dataset.w || 0); c.style.transitionDelay = !fwd ? '0ms' : raw === 0 ? (dw === 3 ? '1400ms' : '0ms') : (dw >= 4 ? (dw - 4) * 500 + 'ms' : '0ms'); });
      const held = sec.querySelector('.s4-years span.held'); if (held) held.style.transitionDelay = fwd && raw === 0 ? '300ms' : '0ms';
      if (fwd) { S.busy = S.busy || {}; S.busy.s4walk = performance.now() + 2200; }
    }
    sc.step = (raw, animate) => { const st = raw < WK ? 0 : raw - WK + 1, w = raw < WK ? (WK > 1 ? [3, 6][raw] : 99) : 99; walkOrder(raw, animate); lastRaw = raw; show = st; walk = w;
      if (sec) { sec.classList.toggle('s4-two', st >= 1); sec.dataset.st = st; sec.dataset.w = w; } walkChips(w); chart(); if (st >= 2) chart3();
      drawWave(sec, W4, { t: 1, held: st < 1 && hy && (WK === 1 || w >= 2) ? hy.year : null, check: st >= 2, say: false }); };
    return sc;
  }

  /* =====================================================================================================
     Slide 5. Where does it work?  (team lead, 1:21 PM: "we should not focus as much on the problem areas")
     The world map glowing where our translated count lands close to MODIS's own, in three presses:
     (a) the map and ONE sentence: how many of the countries with a lot of fire land a typical month within 25% of MODIS, and the middle one;
     (b) the dark countries are outside this comparison (little fire, no score, or no usable data); only if any, one small line for places still rough;
     (c) every country with a lot of fire gets twelve conversion numbers, one per month (counted from the table's rules).
     Every number is read at run time from data/world_table.json (each country's held-back score) and the engine; nothing here is typed,
     so when the engine's rule changes and the table is rebuilt, the slide follows with no edit. Ghana appears only if the engine gives it
     twelve numbers (factors.SNPP.mode === 'month_of_year').
     ===================================================================================================== */
  const MAP_TOP = 840, MAP_BOTTOM = -580, MAP_W = 3600, MAP_H = MAP_TOP - MAP_BOTTOM;   // tenths of a degree, 84 N to 58 S, as the world tab
  const mx = lon10 => lon10 + 1800, my = lat10 => MAP_TOP - lat10;
  const CLOSE = 25;     // "close": a typical month within 25% of MODIS's own count
  function scene5() {
    const sc = { steps: 3, title: 'Where does it work?', cls: 's5' };
    let sec, W = null, shapes = null, rows = {}, cen = {}, mine = null, sum = null, gh = null, st = 0;
    const pathOf = rings => rings.map(r => 'M' + r.map(([x, y]) => mx(x) + ' ' + my(y)).join('L') + 'Z').join('');
    function centre(rings) {      // the middle of the biggest ring's box, in map units
      let best = null, area = -1;
      for (const r of rings) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); }
        const a = (x1 - x0) * (y1 - y0); if (a > area) { area = a; best = { x: mx((x0 + x1) / 2), y: my((y0 + y1) / 2), x1: mx(x1), w: x1 - x0, h: y1 - y0 }; } }
      return best;
    }
    const clsOf = r => !r ? '' : !(r.busy && r.typical_pct != null) ? 'tl' : r.typical_pct <= 10 ? 'l10' : r.typical_pct <= 15 ? 'l15' : r.typical_pct <= CLOSE ? 'l25' : 'lr';
    sc.build = s => {
      sec = s;
      s.innerHTML = `<header class="st-head"><p class="st-eyebrow">Countries with a lot of fire · our record against MODIS alone</p>
          <h2 class="st-h">Where does <em>it work?</em></h2></header>
        <div class="st-pic"><div class="s5-map">${nothing('loading the world map')}</div><p class="s5-key st-small"></p><div class="s5-why s5-x" data-only="2"></div></div>
        <div class="st-words"><p class="st-bridge">Does that hold everywhere?</p><p class="st-line s5-lead"></p><div class="st-swap s5-subs"></div><div class="s5-smalls"></div></div>`;
      const table = S.ctx.worldTable ? Promise.resolve(S.ctx.worldTable)
        : fetch(S.ctx.worldTableUrl || 'data/world_table.json').then(r => { if (!r.ok) throw new Error('could not read the world table (' + r.status + ')'); return r.json(); });
      const outl = S.ctx.worldShapes ? Promise.resolve(S.ctx.worldShapes)
        : fetch(S.ctx.worldShapesUrl || 'data/world_shapes.json').then(r => { if (!r.ok) throw new Error('could not read the map outlines (' + r.status + ')'); return r.json(); });
      // Ghana's rule, read from the engine itself: shown on the last press only if it now gets twelve numbers
      const ghana = S.ctx.engine && S.ctx.layer ? Promise.resolve().then(() => S.ctx.engine.query({ country: 'Ghana' }, S.ctx.layer)).catch(() => null) : Promise.resolve(null);
      Promise.all([table, outl, ghana]).then(([t, sh, g]) => {
        W = t; shapes = sh;
        const m = g && g.factors && g.factors.SNPP; gh = m && m.mode === 'month_of_year' ? { f: m.f } : null;
        prep(); sc.layout(); sc.step(st, false); if (S.cur === 4 && S.numBtn) S.numBtn.hidden = !sc.numbers(); })
        .catch(e => { const m = s.querySelector('.s5-map'); if (m) m.innerHTML = nothing(e.message); });
    };
    function prep() {
      if (!W || !Array.isArray(W.rows)) throw new Error('the world table has no rows');
      rows = {}; W.rows.forEach(r => { rows[r.file] = r; });
      cen = {}; shapes.shapes.forEach(sh => { cen[sh.file] = centre(sh.rings); });
      const busy = W.rows.filter(r => r.busy && r.typical_pct != null).map(r => r.typical_pct).sort((a, b) => a - b), n = busy.length;
      const close = busy.filter(p => p <= CLOSE).length;
      const middle = n ? (n % 2 ? busy[(n - 1) / 2] : (busy[n / 2 - 1] + busy[n / 2]) / 2) : null;
      sum = { busy: n, close, rough: n - close, middle, twelve: W.rows.filter(r => r.busy && r.typical_pct != null && r.rule !== 'one').length, quiet: W.rows.filter(r => !(r.busy && r.typical_pct != null)).length };
      if (gh && rows.Ghana) gh.row = rows.Ghana;
      const file = placeOf(S.ctx.place).replace(/ /g, '_');   // NASA's file name, e.g. Burkina_Faso
      mine = rows[file] ? { file, name: rows[file].name } : null;
      words();
    }
    function words() {
      const nw = k => NUMW[k] || String(k), N = sum.close, M = sum.busy, mid = sum.middle != null ? Math.round(sum.middle) : null;
      sec.querySelector('.s5-lead').innerHTML = !M ? 'No country has enough fire to check yet.'
        : `In ${N === M ? 'all ' + nw(M) : N + ' of the ' + M} countries with a lot of fire, <b>a typical month lands within ${CLOSE}% of MODIS's own count.</b>`;
      const rough = sum.rough > 0 ? ` The other ${nw(sum.rough)} ${sum.rough === 1 ? 'is' : 'are'} still rough, more than ${CLOSE}% off; the country page says so when you look one up.` : '';
      sec.querySelector('.s5-subs').innerHTML =
        `<div class="s5-x" data-only="0"><p class="st-sub">${mid != null ? `Half of them are within about ${mid}%.` : ''}${rough}</p>` +
          `<p class="st-small s5-guide">${slot('older_idle', 'guide')}"A lot of fire": at least 50 detections in a typical month. Checked on years we left out and then translated.</p></div>` +
        `<div class="s5-x" data-only="1"><p class="st-sub">The dark countries are outside this comparison.</p><p class="st-small">The page still gives each one its own answer when you look it up.</p></div>` +
        `<div class="s5-x" data-only="2"><p class="st-sub">${sum.twelve === M ? `Every country with a lot of fire now gets <b>twelve conversion numbers, one per month</b>: all ${nw(M)}.` : `${sum.twelve} of the ${M} countries with a lot of fire get <b>twelve conversion numbers, one per month</b>.`}</p>` +
          (gh && gh.row && gh.row.typical_pct != null ? `<p class="st-small">Ghana now gets twelve numbers too: a typical month there lands within about ${Math.round(gh.row.typical_pct)}%.</p>` : '') +
          `<p class="st-bridge s5-next">${ENDING_A() ? 'So which records still stand on one scale?' : 'Now back to Argentina: is it burning more than usual right now?'}</p></div>`;
      sec.querySelector('.s5-smalls').innerHTML = '';
      sec.querySelector('.s5-key').innerHTML = `<span class="k k10"></span>within 10% <span class="k k15"></span>10 to 15% <span class="k k25"></span>15 to ${CLOSE}% ` +
        (sum.rough ? `<span class="k kr"></span>still rough ` : '') + `<span class="k kd"></span>outside this comparison`;
    }
    function why() { const box = sec && sec.querySelector('.s5-why'); if (box) box.innerHTML = ''; }
    function map() {
      const box = sec && sec.querySelector('.s5-map'); if (!box || !shapes || !W) return;
      const lands = shapes.shapes.map(sh => { const r = rows[sh.file]; return `<path class="${r ? clsOf(r) : 'tl'}" d="${pathOf(sh.rings)}"/>`; }).join('');
      const mineShape = mine && shapes.shapes.find(sh => sh.file === mine.file);
      const alt = `World map. Gold where our translated count lands close to MODIS's own on years we left out and then translated: brightest within 10%, then 10 to 15%, then fainter for 15 to ${CLOSE}%. ` +
        `${sum.close} of ${sum.busy} countries with a lot of fire land within ${CLOSE}%.` + (sum.middle != null ? ` Half of them are within about ${Math.round(sum.middle)}% in a typical month.` : '') +
        ` Dark: outside this comparison.` + (sum.rough ? ` ${sum.rough} still rough (more than ${CLOSE}% off), drawn in muted lilac.` : '') + (mine ? ` Your country, ${mine.name}, is outlined.` : '');
      box.innerHTML = `<svg class="st-svg s5-svg" viewBox="0 0 ${MAP_W} ${MAP_H}" preserveAspectRatio="xMidYMid meet" role="img" aria-label="${esc(alt)}">
        <rect class="sea" x="0" y="0" width="${MAP_W}" height="${MAP_H}"/>
        <g class="lands">${lands}</g>
        ${mineShape ? `<path class="mine" d="${pathOf(mineShape.rings)}"/>` : ''}
        <g class="labs"></g></svg>`;
      labels();
    }
    function labels() {          // the visitor's country, named on every press (sized from the map's width on the stage)
      const box = sec && sec.querySelector('.s5-map'), g = box && box.querySelector('.labs'); if (!g) return;
      const k = MAP_W / (box.offsetWidth || (S.port ? 656 : 1250)), fs = 24 * k, halo = 7 * k;
      g.innerHTML = mine && cen[mine.file] ? `<text x="${(cen[mine.file].x1 + 14 * k).toFixed(0)}" y="${(cen[mine.file].y + fs * .35).toFixed(0)}" class="minename" style="font-size:${fs.toFixed(0)}px;stroke-width:${halo.toFixed(0)}px">${esc(mine.name)}</text>` : '';
    }
    function apply(animate) {
      if (!sec) return;
      sec.dataset.st = st;
      sec.classList.toggle('s5-still', !animate);
      sec.querySelectorAll('.s5-x').forEach(e => { const on = e.dataset.only.split('').map(Number).includes(st); e.classList.toggle('on', on); e.setAttribute('aria-hidden', String(!on)); });
    }
    sc.numbers = () => W && sum ? { title: 'Every country with a lot of fire: how close our translated count lands to MODIS', tables: [{ caption: sum.busy + ' countries, closest first. A typical month on years we left out and then translated.',
      head: ['Country', 'Typical month off by', 'Conversion numbers'],
      rows: W.rows.filter(r => r.busy && r.typical_pct != null).sort((a, b) => a.typical_pct - b.typical_pct)
        .map(r => [r.name, p1(r.typical_pct), r.rule === 'one' ? 'one for the year' : 'one for each month']) }] } : null;
    sc.layout = () => { if (!shapes || !W) return; if (!sec.querySelector('.s5-svg')) map(); else labels(); why(); apply(false); };
    sc.enter = () => { sc.layout(); };
    sc.step = (n, animate) => { st = n; apply(!!animate && !S.still); };
    return sc;
  }

  /* =====================================================================================================
     Scene 6. This month: two cameras, two words.
     ===================================================================================================== */
  // the copy button shared by slide 6's quote box
  function copyButton(s, getText) {
    const btn = s.querySelector('.st-copy'), out = s.querySelector('.st-copied'); if (!btn) return;
    btn.addEventListener('click', ev => {
      ev.stopPropagation();
      const text = getText(), done = m => { if (out) out.textContent = m; };
      const fallback = () => { const ta = document.createElement('textarea'); ta.value = text; ta.style.position = 'fixed'; ta.style.opacity = '0'; document.body.appendChild(ta); ta.select();
        try { document.execCommand('copy'); done('Copied.'); } catch (e) { done('Select the words and copy them.'); } ta.remove(); };
      if (navigator.clipboard && navigator.clipboard.writeText) navigator.clipboard.writeText(text).then(() => done('Copied.'), fallback); else fallback();
    });
  }
  const NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen', 'fifteen', 'sixteen',
    'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five', 'twenty-six', 'twenty-seven', 'twenty-eight',
    'twenty-nine', 'thirty', 'thirty-one'];
  const ZONES = ['much quieter', 'quieter', 'about usual', 'busier', 'much busier'];   // the verdict's internal codes, quietest first

  /* =====================================================================================================
     Scene 6. So: is it burning more than usual?  One scale, two markers, then what you can honestly write.
     ===================================================================================================== */
  function scene6() {
    const sc = { steps: 3, title: 'Is it burning more than usual?', wide: true, cls: 's6' };
    let sec, P = null, marks = [], timers = [], short = '', lit = 0;   // lit = how many markers have arrived
    const R = () => S.ctx.readings;
    const zoneWord = code => { const w = R().say(code); return w ? w.replace(/ than normal$/i, '').toLowerCase() : code; };   // "Busier than normal" -> "busier"
    const its = ph => ph.replace(/the usual$/, 'its usual').replace(/than usual$/, 'than its usual');
    // the marker sits inside the zone its own word names, at its rank among the other years (the same rank the verdict uses);
    // the five zones are drawn the same width, so within a zone the position is the rank's place between that zone's edges
    const EDGES = [0, 0.10, 0.30, 0.70, 0.90, 1];
    function posOf(x) {
      let z = ZONES.indexOf(x.word); const p = x.rankFraction;
      if (z < 0) { if (p == null) return null; z = p < 0.10 ? 0 : p < 0.30 ? 1 : p <= 0.70 ? 2 : p <= 0.90 ? 3 : 4; }   // no word (weak record): the zone its rank falls in, by the verdict's own cut points
      const f = p == null ? 0.5 : Math.min(0.92, Math.max(0.08, (p - EDGES[z]) / (EDGES[z + 1] - EDGES[z])));
      return (z + f) / 5;
    }
    sc.build = s => {
      sec = s;
      const r = S.ctx.place || S.ctx.argentina;
      P = R().forPeriod(r, 'latest');
      if (!P || P.refusal) { s.innerHTML = `<header class="st-head"><p class="st-eyebrow">${esc(placeOf(r))}</p><h2 class="st-h">Is it burning more than usual?</h2></header><div class="st-pic">${nothing(P && P.refusal ? P.refusal.message : 'no reading')}</div>`; P = null; return; }
      const pl = P.place, o = P.ours, b = P.older, lead = P.lead || (o.word ? 'ours' : 'none');
      const plIn = P.placeIn || (R().inSentence ? R().inSentence(pl) : pl);     // the name as a sentence says it: "the Dominican Republic"
      const when = R().periodWords(P) || P.periodLabel;
      const days = P.partial && r.current && r.current.days ? r.current.days : null;
      const early = P.partial || P.provisional;
      const tip = 'The last few months come from NASA\'s rapid feed and can still change.' + (days ? ` Days 1 to ${days} so far, compared with the same days in other years.` : '');
      const eyebrow = (P.partial ? 'This month · ' + pl : (/^[A-Za-z]+ \d{4}$/.test(P.periodLabel || '') ? P.periodLabel : when) + ' · ' + pl).toUpperCase();
      short = R().shortSentence(r, 'latest') || '';
      // the answer in words, then this year's story (both read from Readings), before the second camera's answer
      let ans = R().answerLine ? R().answerLine(P) : null;
      const curMo = r.current && r.current.ym ? +r.current.ym.slice(5, 7) - 1 : null;
      if (ans && days && curMo != null) ans = ans.replace(/for (early |late |mid-)?[A-Z][a-z]+\.$/, `for ${MONTHS[curMo]} 1 to ${days}.`);   // the stretch of days said out loud
      let yearText = null;
      try { const cy = r.current && r.current.ym ? +r.current.ym.slice(0, 4) : null, FY = cy ? R().forPeriod(r, { year: cy }) : null, yl = FY && !FY.refusal && R().answerLine ? R().answerLine(FY) : null;
        if (yl) { const fl = FY.lead === 'ours' && FY.ours.word ? R().feel(FY.ours.value, FY.ours.typical) : null, w = FY.lead === 'ours' && FY.ours.word ? R().say(FY.ours.word) : null;
          const stretch = curMo != null ? `January 1 to ${MONTHS[curMo]} ${days || ''}`.trim() : 'this year';
          yearText = w ? `The year so far, ${stretch}: ${w.charAt(0).toLowerCase() + w.slice(1)}${fl && fl.phrase ? ', ' + fl.phrase : ''}.` : yl; } } catch (e) { yearText = null; }
      // the markers, in the order they arrive (the one we lead with first)
      marks = [];
      const oFeel = o.word ? R().feel(o.value, o.typical) : null, bFeel = b && b.word ? R().feel(b.value, b.typical) : null;
      const ourWho = typeof R().recordName === 'function' ? cap(R().recordName(r)) : 'Our 26-year record';   // the shared label: "our N-year record" from the record's own span
      const ourMark = o.word ? { k: 'gold', at: posOf(o), who: ourWho, word: zoneWord(o.word), feel: oFeel && oFeel.phrase }
        : o.weak && b && b.word ? { k: 'gold hollow', at: posOf({ word: null, rankFraction: o.rankFraction }), who: ourWho, word: 'unreliable for ' + plIn, feel: null }
        : lead === 'weak' ? { k: 'gold hollow', at: posOf({ word: null, rankFraction: o.rankFraction }), who: ourWho, word: 'unreliable here', feel: null } : null;
      const modisMark = b && b.word ? { k: 'blue', at: posOf(b), who: 'MODIS alone', word: zoneWord(b.word), feel: bFeel && its(bFeel.phrase) } : null;
      if (lead === 'modis') { if (modisMark) marks.push(modisMark); if (ourMark && ourMark.at != null) marks.push(ourMark); }
      else if (lead === 'ours') { if (ourMark) marks.push(ourMark); if (modisMark) marks.push(modisMark); }
      else if (lead === 'weak') { if (ourMark) marks.push(ourMark); }     // weak record, and MODIS has no verdict or no count: one hollow marker, no verdict word
      marks = marks.filter(m => m.at != null);
      if (marks.length === 2 && Math.abs(marks[0].at - marks[1].at) < 0.032) {   // two markers on the same spot: drawn side by side, never on top of each other,
        // and each stays inside its own zone (a marker is never pushed onto or across a zone's edge)
        const lo = marks[0].at <= marks[1].at ? 0 : 1, hi = 1 - lo;
        const zl = Math.min(4, Math.floor(marks[lo].at * 5)), zh = Math.min(4, Math.floor(marks[hi].at * 5));
        if (zl === zh) { const c = Math.min((zl + 0.92) / 5 - 0.016, Math.max((zl + 0.08) / 5 + 0.016, (marks[0].at + marks[1].at) / 2));
          marks[lo].at = c - 0.016; marks[hi].at = c + 0.016; }
        else { marks[lo].at = Math.min(marks[lo].at, (zl + 0.92) / 5); marks[hi].at = Math.max(marks[hi].at, (zh + 0.08) / 5); } }
      // the line under the scale
      const same = lead === 'ours' && b && P.sameWord;
      const span = days ? `Same ${NUMW[days] || days} days.` : P.isMonth === false ? 'Same stretch of the year.' : 'Same month.';
      let line;
      if (lead === 'none') {
        const x = o.weak && b ? b : o;
        line = `Hardly any fire to count in ${esc(when)}.<span class="s6-under">${fmt(x.value)} detections; ${fmt(x.typical)} is usual. That's too little to call it quiet or busy.</span>`;
      } else if (lead === 'weak') line = `No fair answer for ${esc(plIn)} from our record. <span class="s6-under">${b ? "MODIS, NASA's older camera, saw too little fire here to judge." : "MODIS, NASA's older camera, has no count for these dates."}</span>`;
      else if (lead === 'modis') line = `For ${esc(plIn)}, go by MODIS. <b>Our own record is unreliable here.</b> <button type="button" class="st-link s6-why" data-noclick>Here's why ▸</button>`;
      else if (!b) line = `MODIS, NASA's older camera, has no count for these dates.`;
      else if (!b.word) line = `MODIS, NASA's older camera, saw too little fire here to judge.`;
      else line = `Same country. ${span} <b>Two cameras. ${same ? 'One answer.' : 'Two answers.'}</b>${same ? '' : ' The page shows both.'}`;
      // the one dim line of counts
      const cnt = [];
      if (lead === 'weak') { cnt.push(`our record ${fmt(o.value)} against a usual ${fmt(o.typical)}`); if (b && b.value != null) cnt.push(`MODIS alone ${fmt(b.value)} against a usual ${fmt(b.typical)}`); }
      else if (lead === 'modis') { cnt.push(`MODIS alone ${fmt(b.value)} against a usual ${fmt(b.typical)}`); cnt.push(`our record ${fmt(o.value)} against a usual ${fmt(o.typical)}`); }
      else if (lead === 'none') { if (b && !(o.weak && b)) cnt.push(`MODIS alone ${fmt(b.value)} against a usual ${fmt(b.typical)}`); else if (o.weak && b) cnt.push(`our record ${fmt(o.value)} against a usual ${fmt(o.typical)}`); }
      else { cnt.push(`${fmt(o.value)} fire detections against a usual ${fmt(o.typical)}`); if (b) cnt.push(`MODIS alone: ${fmt(b.value)} against ${fmt(b.typical)}`); }
      cnt.push('a detection is one 5 km patch seen burning on one day');
      const zl = ZONES.map(z => `<span class="${z === 'about usual' ? 'mid' : ''}">${esc(zoneWord(z))}</span>`).join('');
      const markHTML = marks.map((m, i) => `<span class="s6-mk ${m.k}" data-i="${i}" style="left:${(m.at * 100).toFixed(2)}%"></span>`).join('');
      const side = marks.length === 2 ? (marks[0].at <= marks[1].at ? ['left', 'right'] : ['right', 'left']) : ['solo'];
      const labHTML = marks.map((m, i) => `<div class="s6-lab ${m.k} ${side[i]}" data-i="${i}"${side[i] === 'solo' ? ` style="--at:${(m.at * 100).toFixed(2)}"` : ''}>
          <span class="who">${m.k.startsWith('blue') ? slot('older_idle', 'guide') : ''}${esc(m.who)}</span><b>${esc(m.word)}</b>${m.feel ? `<span class="feel">${esc(m.feel)}</span>` : ''}</div>`).join('');
      const alt = `A scale from far quieter to far busier than normal, in five zones. ` + (marks.length ? marks.map(m => `${m.who}: ${m.word}${m.feel ? ', ' + m.feel : ''}`).join('. ') + '.' : 'No marker: too little fire to judge.');
      s.innerHTML = `
        <header class="st-head"><p class="st-eyebrow">${esc(eyebrow)}${early ? ` <button type="button" class="st-tag" data-noclick aria-describedby="s6tip">Early data</button><span class="st-tip" id="s6tip" role="tooltip">${esc(tip)}</span>` : ''}</p>
          <h2 class="st-h">Is ${esc(plIn)} <em>burning more than usual?</em></h2>${early ? `<p class="st-small s6-early">Early data: these days come from NASA's rapid feed, so the count can still change.</p>` : ''}</header>
        <div class="st-pic">
          <div class="s6-scale" role="img" aria-label="${esc(alt)}">
            <div class="s6-labs${marks.length === 2 ? ' two' : ''}">${labHTML}</div>
            <svg class="s6-lead" aria-hidden="true"></svg>
            <div class="s6-bar" aria-hidden="true">${ZONES.map((z, i) => `<i class="z${i}"></i>`).join('')}${markHTML}</div>
            <div class="s6-zones" aria-hidden="true">${zl}</div>
          </div>
        </div>
        <div class="guide-pair" aria-hidden="true">${slot('both_together')}<span>one scale</span></div>
        <div class="st-words"><p class="st-bridge">Our first question, for one place.</p>
          ${ans ? `<p class="st-line s6-ans">${esc(ans)}${yearText ? ` <span class="s6-year">${esc(yearText)}</span>` : ''}</p>` : ''}
          <p class="st-line s6-line">${line}</p>
          <figure class="st-quote gold s6-quote st-step" data-at="2"><figcaption><span>What you can honestly write</span>
              <span class="s6-copyrow"><span class="st-copied" role="status"></span><button type="button" class="st-btn st-copy" data-noclick>Copy</button></span></figcaption>
            <blockquote>${esc(short)}</blockquote></figure>
          <p class="st-small s6-counts st-only" data-only="01">${esc(cnt.join(' · '))}</p>
        </div>`;
      copyButton(s, () => short);
      const why = s.querySelector('.s6-why'); if (why) why.addEventListener('click', ev => { ev.stopPropagation(); show(4, 0, true); });
      const tag = s.querySelector('.st-tag'); if (tag) tag.addEventListener('click', ev => { ev.stopPropagation(); tag.classList.toggle('open'); });
    };
    function leaders() {     // thin lines from each label to its marker (stage pixels; offsets ignore the stage's scale)
      const box = sec && sec.querySelector('.s6-scale'), g = box && box.querySelector('.s6-lead'); if (!g) return;
      const W = box.offsetWidth, H = box.offsetHeight, bar = box.querySelector('.s6-bar');
      g.setAttribute('viewBox', `0 0 ${W} ${H}`); g.setAttribute('width', W); g.setAttribute('height', H);
      g.innerHTML = marks.map((m, i) => {
        const lab = box.querySelector(`.s6-lab[data-i="${i}"]`); if (!lab) return '';
        const mx = m.at * W, y1 = lab.offsetTop + lab.offsetHeight + 10, y2 = bar.offsetTop - 4;
        const sideL = lab.classList.contains('left'), sideR = lab.classList.contains('right');
        const lx = sideL ? Math.min(lab.offsetLeft + lab.offsetWidth - 20, Math.max(lab.offsetLeft + 20, mx)) : sideR ? Math.max(lab.offsetLeft + 20, Math.min(lab.offsetLeft + lab.offsetWidth - 20, mx)) : mx;
        const mid = y1 + (y2 - y1) * 0.45;
        return `<path class="${m.k.split(' ')[0]} s6-ln${i < lit ? ' on' : ''}" data-i="${i}" d="M${lx.toFixed(1)} ${y1} V${mid.toFixed(1)} H${mx.toFixed(1)} V${y2}"/>`;
      }).join('');
    }
    function arrive(animate, upto) {      // markers 0..upto-1 arrive (the one we lead with first); the line under the scale comes with the second
      timers.forEach(clearTimeout); timers = [];
      const parts = i => sec.querySelectorAll(`.s6-mk[data-i="${i}"],.s6-lab[data-i="${i}"],.s6-ln[data-i="${i}"]`);
      const lineOn = upto >= marks.length && (marks.length > 1 || S.step >= 1) || marks.length === 0;
      const line = sec.querySelector('.s6-line');
      if (!animate || S.still) { lit = Math.min(upto, marks.length); sec.querySelectorAll('.s6-mk,.s6-lab,.s6-ln').forEach(e => e.classList.toggle('on', +e.dataset.i < lit)); if (line) line.classList.toggle('on', lineOn); return; }
      for (let i = 0; i < marks.length; i++) if (i >= upto) parts(i).forEach(e => e.classList.remove('on'));
      if (line && !lineOn) line.classList.remove('on');
      let k = 0;
      marks.forEach((m, i) => { if (i >= upto || i < lit) return; timers.push(setTimeout(() => { lit = Math.max(lit, i + 1); parts(i).forEach(e => e.classList.add('on')); }, 500 + k++ * 1100)); });
      if (lineOn) timers.push(setTimeout(() => { if (line) line.classList.add('on'); }, 500 + k * 1100));
      lit = Math.min(lit, upto);
    }
    sc.layout = () => { if (P) leaders(); };
    sc.enter = animate => { if (!P) return; lit = 0; if (animate && !S.still) sec.querySelectorAll('.s6-mk,.s6-lab,.s6-line').forEach(e => e.classList.remove('on')); leaders(); arrive(animate, S.step >= 1 ? marks.length : 1); };
    sc.step = (st, animate) => { if (sec) sec.dataset.st = st; if (!P) return; leaders(); arrive(animate, st >= 1 ? marks.length : 1); };
    sc.leave = () => { timers.forEach(clearTimeout); timers = []; };
    return sc;
  }

  /* =====================================================================================================
     Scene 7. So the report gets both.
     ===================================================================================================== */
  // web addresses shown on slide 7: set in js/beats.js (pageAddress, connectorAddress); null hides them
  const bareAddr = a => a ? String(a).replace(/^[a-z]+:\/\//i, '').replace(/\/$/, '') : null;
  function scene7() {
    const PAGE_ADDR = bareAddr(window.StoryBeats && window.StoryBeats.pageAddress), CONN_ADDR = bareAddr(window.StoryBeats && window.StoryBeats.connectorAddress);
    // the connector press is first, and can be switched off in js/beats.js (showConnector: false) while the team lead decides whether to speak about it
    const conn = !(window.StoryBeats && window.StoryBeats.showConnector === false), c0 = conn ? 1 : 0;
    const sc = { steps: 3 + c0, title: 'How do I use it?', wide: true, cls: 's7' };
    let sec;
    sc.build = s => {
      sec = s;
      // press 1 (optional): the chat connector as a real exchange; the answer is Readings.shortSentence and the counts, read now, never typed
      let chat = '';
      if (conn) {
        const r = S.ctx.place || S.ctx.argentina, R = S.ctx.readings;
        let P = null, ans = '', counts = '';
        try { P = R.forPeriod(r, 'latest'); ans = R.shortSentence(r, 'latest') || ''; } catch (e) { P = null; }
        if (P && !P.refusal) {
          const o = P.ours, b = P.older;
          counts = (o && o.value != null ? `${fmt(o.value)} fire detections against a usual ${fmt(o.typical)}` : '') + (b && b.value != null ? `; MODIS alone ${fmt(b.value)} against ${fmt(b.typical)}` : '') + '. A detection is one 5 km patch seen burning on one day.';
        }
        const place = P && P.placeIn ? P.placeIn : P && P.place ? P.place : placeOf(r);
        chat = `<div class="s7-c st-only" data-only="1">
          <p class="s7-clabel">Or ask your own AI</p><p class="s7-how">Add our connector to your chat app (a link that lets it read our record), then ask about any country.${CONN_ADDR ? ` <b class="s7-addr">${esc(CONN_ADDR)}</b>` : ''}</p>
          <div class="s7-chat" role="group" aria-label="A chat with your own AI">
            <p class="s7-you"><span>You</span>Is ${esc(place)} burning more than usual this month?</p>
            <div class="s7-ai"><span>Your AI · from the satellite record</span><p>${esc(ans || 'No answer for this place right now.')}</p>${counts ? `<p class="s7-cnt">${esc(counts)}</p>` : ''}</div>
          </div></div>`;
      }
      // slide 2's example, read again from the same yearly totals: 2022 on one scale against the highest earlier year
      let figs = '', gold = '';
      try {
        const Y = S.ctx.readings.yearly(S.ctx.argentina).filter(y => y.complete && y.ours != null);
        const y22 = Y.find(y => y.year === 2022), top = Y.filter(y => y.year < 2022).sort((a, b) => b.ours - a.ours)[0];
        if (y22 && top) {
          gold = y22.ours < top.ours * 0.8 ? "On one scale, it wasn't a record. It wasn't close." : y22.ours < top.ours ? "On one scale, it wasn't a record." : 'On one scale, it was still the highest.';
          figs = `Argentina on one scale: ${fmt(y22.ours)} fire detections in ${y22.year}; ${fmt(top.ours)} in ${top.year}, the real record.`;
        }
      } catch (e) { gold = ''; }
      s.innerHTML = `
        <div class="s7-dark" aria-hidden="true"></div>
        <div class="s7-p st-only" data-only="0"><p class="st-bridge">Now it's your turn.</p><h2 class="st-h">How do I <em>use it?</em></h2>
          <p class="st-line">Open the page and pick any country. <b>You can explore its latest answer in plain words and compare the years we have on one scale.</b></p>
          ${PAGE_ADDR ? `<p class="s7-addr big">${esc(PAGE_ADDR)}</p>` : ''}
          <button type="button" class="st-btn primary s7-try" data-go="#record/world" data-noclick>Try your country ▸</button></div>
        <div class="guide-pair" aria-hidden="true">${slot('both_together')}<span>one scale</span></div>${chat}
        <div class="s7-a st-only" data-only="${c0 + 1}">
          <p class="s7-place">Back to the headline from slide 2</p>
          <p class="s7-old"><s>“2022: Argentina's worst fire year on record”</s></p>
          ${gold ? `<p class="s7-gold">${gold.split(/(?<=\.) /).map(g => `<span>${esc(g)}</span>`).join('')}</p>` : ''}
          ${figs ? `<p class="s7-figs">${esc(figs)}</p>` : ''}
        </div>
        <div class="s7-b st-step" data-at="${c0 + 2}">
          <p class="s7-echo">Is the world burning more than it used to? <b>Check the camera first.</b></p>
          <p class="s7-q"><span>Did the world change?</span><span><em>Or the camera? Or both?</em></span></p>
          <div class="s7-after"><p class="s7-now">Now you can check.</p></div>
        </div>
        <button type="button" class="st-link s7-again" data-noclick>start again</button>`;
      s.querySelector('.s7-again').addEventListener('click', ev => { ev.stopPropagation(); show(0, 0, true); });
      s.querySelectorAll('[data-go]').forEach(b => b.addEventListener('click', ev => { ev.stopPropagation(); if (S.ctx.go) S.ctx.go(b.dataset.go); }));
    };
    const dark = on => { if (S.root) S.root.classList.toggle('st-dark', !!on); };
    sc.layout = () => {};
    sc.enter = () => { dark(S.step >= c0 + 2); };
    sc.step = st => { if (sec) sec.classList.toggle('s7-end', st >= c0 + 2); dark(st >= c0 + 2); };
    sc.leave = () => { dark(false); if (sec) sec.classList.remove('s7-end'); };
    return sc;
  }

  /* =====================================================================================================
     Wild cards, after slide 7 (never numbered): reached by pressing on after the end, or with the W key.
     Sentences: round_SAT/wildcards/WILDCARD_FACTS.md (the wild-card lane's, each with its source and check status); its "do not say"
     list is kept (no count of places or sites; no place stated as a flare, field or plant; placed by coordinates only).
     Picture data: data/steady_heat.json (a copy of the wild-card lane's file), read at run time.
     ===================================================================================================== */
  function loadSteady() {
    if (!S.steady) S.steady = (S.ctx.steadyHeat ? Promise.resolve(S.ctx.steadyHeat) : fetch(S.ctx.steadyHeatUrl || 'data/steady_heat.json').then(r => { if (!r.ok) throw new Error('could not read the steady-heat file (' + r.status + ')'); return r.json(); }));
    return S.steady;
  }
  function loadShapes() {
    if (!S.shapes) S.shapes = (S.ctx.worldShapes ? Promise.resolve(S.ctx.worldShapes) : fetch(S.ctx.worldShapesUrl || 'data/world_shapes.json').then(r => { if (!r.ok) throw new Error('could not read the map outlines (' + r.status + ')'); return r.json(); }));
    return S.shapes;
  }
  const nearWord = r => r >= 0.4 && r < 0.6 ? 'About half' : r >= 0.6 && r < 0.7 ? 'About two-thirds' : r >= 0.2 && r < 0.3 ? 'About a quarter' : 'About ' + Math.round(r * 100) + '%';
  const timesWord = r => { const n = Math.round(r); return n >= 2 && n <= 12 ? 'about ' + NUMW[n] + ' times' : 'about ' + n + ' times'; };
  const roughly = n => n >= 1000 ? 'roughly ' + fmt(Math.round(n / 500) * 500) : fmt(n);

  // W1. Not every hot spot is a fire: the 200 squares with the most steady (non-fire) heat in 2020, as dots on the world
  function wild1() {
    const sc = { steps: 2, title: 'Not every hot spot is a fire', cls: 'sw sw1' };
    let sec, D = null, shapes = null, st = 0;
    sc.build = s => {
      sec = s;
      s.innerHTML = `<header class="st-head"><p class="st-eyebrow">Extra · steady heat, 2020</p><h2 class="st-h">Not every hot spot <em>is a fire.</em></h2></header>
        <div class="st-pic"><p class="st-small sw-cap">Steady heat, 2020. One dot = one square about 100 km across.</p><div class="sw-map">${nothing('loading the steady-heat map')}</div><div class="st-small sw-key"></div><p class="st-small sw-b2 st-only" data-only="1"></p></div>
        <div class="st-words"><p class="st-bridge">A third thing can fool a fire count: heat that isn't fire.</p><div class="st-swap"><div class="st-only" data-only="0"><p class="st-line sw-a"></p><p class="st-sub sw-a2"></p></div>
          <div class="st-only" data-only="1"><p class="st-line sw-b"></p><p class="st-sub sw-so"></p></div></div>
          <p class="st-small st-only" data-only="0">How we count: each 5 km patch of ground where a satellite saw heat, counted once per day.</p></div>`;
      Promise.all([loadSteady(), loadShapes()]).then(([d, sh]) => { D = d; shapes = sh; words(); draw(); })
        .catch(e => { const m = s.querySelector('.sw-map'); if (m) m.innerHTML = nothing(e.message); });
    };
    function words() {
      const t = D.totals_world_2020;
      // W1 #1 and #4 (FINDINGS, reviewed by a second model family); #5 worked out from the logged totals; #8 places by coordinates only
      sec.querySelector('.sw-a').innerHTML = 'Satellites see heat, not only fire. <b>Some places stay hot all year long,</b> like gas flares, factories and volcanoes. NASA tags each hot spot: a fire, a volcano, or other steady heat.';
      sec.querySelector('.sw-a2').textContent = `${nearWord(D.top200_share_of_viirs_not_fire)} of the steady heat sits in just ${D.squares.length} squares, out of roughly ${roughly(t.squares_with_any_viirs_not_fire).replace(/^roughly /, '')} that have any.`;
      sec.querySelector('.sw-b').innerHTML = `VIIRS, the newer camera, picks up <b>${timesWord(t.viirs_not_fire / t.modis_not_fire)} as much steady heat</b> as MODIS. On fires, across the world in 2020, its edge is ${timesWord(t.viirs_fire / t.modis_fire)}.`;
      // W1 #3: counting every hot spot instead of only fires adds about 7% (VIIRS) and 3% (MODIS) in 2020; computed here from the file's totals
      sec.querySelector('.sw-so').innerHTML = `Left in, steady heat would make the newer camera read about ${Math.round(t.viirs_not_fire / t.viirs_fire * 100)}% too busy, and the older one about ${Math.round(t.modis_not_fire / t.modis_fire * 100)}%. <b>So we keep it out of the fire record.</b>`;
      sec.querySelector('.sw-b2').textContent = 'The biggest squares sit mostly around the Persian Gulf and the Sahara, in northern South America, on the north China coast and in the Niger Delta. We placed them by map coordinates and didn\'t check each site.';
      sec.querySelector('.sw-key').innerHTML = `<span class="sw-k"><span class="k kv"></span>steady heat seen by VIIRS, the newer camera</span><span class="sw-k st-only sw-km" data-only="1"><span class="k km"></span>the same squares, seen by MODIS, the older camera</span><span class="sw-k">dot size: how much steady heat</span>`;
      apply();
    }
    function draw() {
      const box = sec && sec.querySelector('.sw-map'); if (!box || !D || !shapes) return;
      const lands = shapes.shapes.map(sh => `<path d="${sh.rings.map(r => 'M' + r.map(([x, y]) => (x + 1800) + ' ' + (MAP_TOP - y)).join('L') + 'Z').join('')}"/>`).join('');
      const max = Math.max(...D.squares.map(q => q.viirs_not_fire)), rad = v => 6 + 46 * Math.sqrt(v / max);
      const pt = q => [(q.lon + 0.5) * 10 + 1800, MAP_TOP - (q.lat + 0.5) * 10];
      const dots = D.squares.slice().sort((a, b) => b.viirs_not_fire - a.viirs_not_fire).map(q => { const [x, y] = pt(q); return `<circle cx="${x}" cy="${y}" r="${rad(q.viirs_not_fire).toFixed(1)}" class="dv"/>`; }).join('');
      const mdots = D.squares.map(q => { const [x, y] = pt(q); return q.modis_not_fire > 0 ? `<circle cx="${x}" cy="${y}" r="${Math.max(5, rad(q.modis_not_fire)).toFixed(1)}" class="dm"/>` : ''; }).join('');
      const t = D.totals_world_2020;
      const alt = `World map, 2020: the ${D.squares.length} one-degree squares with the most steady, non-fire heat, one dot each, sized by VIIRS's days of steady heat; the biggest is ${fmt(max)}. In all, VIIRS counted ${fmt(t.viirs_not_fire)} days of steady heat and MODIS ${fmt(t.modis_not_fire)}; for fire, ${fmt(t.viirs_fire)} and ${fmt(t.modis_fire)}.`;
      box.innerHTML = `<svg class="st-svg sw-svg" viewBox="0 0 ${MAP_W} ${MAP_H}" role="img" aria-label="${esc(alt)}"><g class="lands">${lands}</g><g class="dvs">${dots}</g><g class="dms st-only" data-only="1">${mdots}</g></svg>`;
      apply();
    }
    function apply() { if (!sec) return; sec.querySelectorAll('.sw-map .st-only, .sw-key .st-only').forEach(e => { const on = e.dataset.only.includes(String(st)); e.classList.toggle('on', on); }); }
    sc.numbers = () => D ? { title: 'The 200 squares with the most steady heat, 2020', tables: [{ caption: 'Patch-days of heat (5 km patches, counted once per day; a square holds hundreds of patches) in each one-degree square; placed by coordinates only', head: ['Rank', 'Square (west edge, south edge)', 'VIIRS steady heat (patch-days)', 'MODIS steady heat (patch-days)', 'VIIRS fire (patch-days)'],
      rows: D.squares.map(q => [q.rank, `${Math.abs(q.lon)}°${q.lon < 0 ? 'W' : 'E'}, ${Math.abs(q.lat)}°${q.lat < 0 ? 'S' : 'N'}`, fmt(q.viirs_not_fire), fmt(q.modis_not_fire), fmt(q.viirs_fire)]) }] } : null;
    sc.layout = draw; sc.enter = () => {}; sc.step = n => { st = n; apply(); };
    return sc;
  }

  // W2. How we find them and keep them out of the fire record: the porch-light test, as a picture of twelve months
  function wild2() {
    const sc = { steps: 2, title: 'How we find them', cls: 'sw sw2' };
    sc.build = s => {
      const row = (lit, cls) => MON1.map((m, i) => `<span class="pl ${lit.includes(i) ? cls : ''}"><i></i><b>${m}</b></span>`).join('');
      // an illustration of the rule, not a real place: steady heat lit in 11 months; a fire lit in 2
      s.innerHTML = `<header class="st-head"><p class="st-eyebrow">Extra · the porch-light test</p><h2 class="st-h">A light that stays on <em>is not a fire.</em></h2></header>
        <div class="st-pic"><div class="sw-porch" role="img" aria-label="An illustration: a patch lit in eleven months of twelve is steady heat, like a porch light; a patch lit in two months is a fire.">
          <p class="pl-cap">A patch lit up in 11 months of 12 (10 or more counts as steady)</p><div class="pl-row">${row([0, 1, 2, 3, 4, 6, 7, 8, 9, 10, 11], 'on s')}</div><p class="pl-say s">Porch light: steady heat, not a fire</p>
          <p class="pl-cap">A patch lit up in 2 months</p><div class="pl-row">${row([7, 8], 'on f')}</div><p class="pl-say f">A fire</p>
          <p class="st-small">An illustration of the rule, not a real place.</p></div></div>
        <div class="st-words"><div class="st-swap">
          <div class="st-only" data-only="0"><p class="st-bridge">So how do we keep steady heat out?</p><p class="st-line">If a patch of ground is lit up in at least ten months of a year, it's like a neighbor's porch light: <b>not a party, just their light.</b> We count it as steady heat, not a fire.</p>
            <p class="st-small">That's the first check, the porch-light rule. The second is NASA's own tag, which tells fire from steady heat in past years; for the newest months, we use the patches NASA tagged as steady before.</p></div>
          <div class="st-only" data-only="1"><p class="st-line">The checks work. If steady heat stays in, our record for Argentina's year, translated from the newer camera, comes out about 5% too high. <b>With either check, under 1%.</b></p>
            <p class="st-sub">In the Paraná Delta, where steady heat sits right beside real wetland fires, our record comes out 39 to 78% too high with it left in; with either check, within about 5%.</p>
            <p class="st-small">Each recent year, about 15 to 25 patches in Argentina behave like porch lights but are still tagged as fire; only a look can tell which really burn.</p>
            <p class="st-line sw-close">So the one scale stays clean: steady heat is kept out of the fire record.</p></div>
        </div></div>`;
    };
    sc.layout = sc.enter = sc.step = () => {};
    return sc;
  }

  /* =====================================================================================================
     Ending A (team lead, 9:38 PM: "A: not just Argentina"). The screens are drawn by js/story_ending.js (StoryEnding); these wrappers
     give them the story's scene contract. Slide 5 = the yardstick graph, then the existing map (its first and last presses);
     slide 6 = not just Argentina, the same charts settling onto one scale, then the world on one scale; slide 7 = three ways, then
     the final screen. StoryBeats.ending = 'old' brings back the earlier slides 5 to 7 whole.
     ===================================================================================================== */
  const ENDING_A = () => !(window.StoryBeats && window.StoryBeats.ending === 'old') && !!window.StoryEnding;
  function endingConfig() {      // read when a screen is drawn: the laptop's addresses arrive a moment after the page starts
    const B = window.StoryBeats || {};
    StoryEnding.configure({ still: !!S.still, pageUrl: B.pageAddress || '', connectorUrl: B.connectorAddress || '', repoUrl: B.repoUrl || null, volunteerUrl: B.volunteerAddress || '', showPageQr: B.finalPageQr === true });
  }
  function endingSetup() {
    const B = window.StoryBeats || {};
    StoryEnding.configure({ yardstickWorld: true, showDrawCard: B.showDrawCard !== false });
  }
  // picks: one [screen, its step] per press. The talk is read live, one click per line of the script (team lead, 10:37 PM), so each
  // press lands on the screen that its line describes, fully built; a screen's own earlier steps are not separate presses.
  function endingScene(picks, title) {
    const sc = { steps: picks.length, title, wide: true, cls: 'se-scene' };
    let sec = null, host = null, data = null, cur = 0;
    const at = st => picks[Math.max(0, Math.min(picks.length - 1, st))];
    // drawn only while its slide is up: a hidden screen must not keep timers running (the prototype card's frames loop)
    const draw = () => { if (!data || !host || S.secs[S.cur] !== sec) return; endingConfig(); const [n, st] = at(cur); StoryEnding[n](host, data, st); };
    sc.build = s => { sec = s; s.innerHTML = '<div class="se-host"></div>'; host = s.firstChild;
      StoryEnding.load('data/ending_table.json').then(d => VEE() && picks.some(p => /stitched|oneScale|world/.test(p[0])) ? veeEnding(d) : d)
        .then(d => { const only = window.StoryBeats && window.StoryBeats.countryCharts; if (!only || !picks.some(p => /stitched|oneScale/.test(p[0]))) return d;
          const c = Object.assign({}, d, { small_multiples: only.map(nm => d.small_multiples.find(m => m.name === nm)).filter(Boolean) }); if (sec) sec.classList.add('se-few'); return c; }).then(d => { data = d; draw(); if (S.secs[S.cur] === sec && S.numBtn) S.numBtn.hidden = !sc.numbers(); })
        .catch(e => { host.innerHTML = nothing(e.message); }); };
    sc.step = st => { cur = st; draw(); };
    sc.enter = () => draw();
    sc.leave = () => { if (host) StoryEnding.stop(host); };
    sc.layout = () => { if (host && data) { host.innerHTML = ''; draw(); } };      // portrait <-> landscape redraws
    sc.replay = () => { if (!host || !data) return false; StoryEnding.stop(host); host.innerHTML = ''; draw(); return true; };
    sc.numbers = () => data ? StoryEnding.numbers(at(cur)[0], data) : null;
    return sc;
  }
  // Slide 4 after the reorder (team lead, 9:02 AM): 4.1 2017 set aside, 4.2 October, 4.3 every month (January's note), 4.4 the yardstick
  // ("So how good is that?": the bars, the zoom, the 71 dots, by themselves on one press), 4.5 the smarter version. The "MODIS kept flying" check
  // screen is cut; StoryBeats.showModisCheck = true puts it back after the chart.
  function scene4R() {
    const inner = scene4(), keepCheck = !!(window.StoryBeats && window.StoryBeats.showModisCheck === true), IW = inner.steps;
    // 9:19 AM: the yardstick and the seven-band screen give way to the IMPROVEMENT LADDER, two presses (StoryBeats.showLadder = false: the old two)
    const LAD = !(window.StoryBeats && window.StoryBeats.showLadder === false);
    // 12:51 PM: click 18 shows the seven fire-power bands, with the three spoken numbers as small chips (StoryBeats.howGoodLook = 'bars': the ladder)
    const BANDS = !(window.StoryBeats && window.StoryBeats.howGoodLook === 'bars');
    const map = [0, 1, 2].concat(keepCheck ? [IW - 1] : [], LAD ? [BANDS ? 'fp' : 'lad1', 'lad2'] : ['yard', 'fp']);      // inner presses: 0,1 the walk, 2 the chart, IW-1 the check
    const sc = { steps: map.length, title: 'How do you know it works?', cls: 's4 s4x' };
    sc.capSide = raw => map[raw] === 2;
    let sec = null, host = null, wrap = null, fp = null, data = null, cur = 0, timers = [], fpBuilt = false;
    let fpData = null; fetch('data/fire_power.json').then(r => r.ok ? r.json() : null).then(j => { fpData = j; if (sec && /^lad/.test(map[cur])) ladder(cur, false); }).catch(() => {});
    // the ladder: a typical month in Argentina, how far the estimate lands from what Moe counted; then the 71 countries as dots
    const ladder = (raw, animate) => { if (!data || !host || S.secs[S.cur] !== sec) return; clear(); endingConfig();
      const y = data.yardstick, nv = plain(castName('newer')), no = plain(castName('older')), ar = fpData && fpData.rows.find(r => r.name === 'Argentina');
      const pct = v => v == null ? '?' : Math.round(v) + '%', twin = !!(window.StoryBeats && window.StoryBeats.showTwinCameras === true);
      const fpBy = {}; if (fpData) fpData.rows.forEach(r => { fpBy[r.name] = r.strength; });
      const rows = [{ cap: 'Just stitched together', v: (y.untranslated_times - 1) * 100, lab: `about ${(Math.round(y.untranslated_times * 2) / 2)} times ${no}'s count (${Math.round((y.untranslated_times - 1) * 100)}% over)` },
        { cap: 'Our translation', v: y.translated_pct, lab: `within about ${pct(y.translated_pct)}`, cls: 'g', dots: (y.countries || []).map(c => ({ name: c.name, v: c.translated_pct })) },
        { cap: 'Our smarter version', v: ar ? ar.strength : null, lab: `within about ${pct(ar && ar.strength)}`, tag: 'it also sorts fires by heat · built and tested; switching it on is our next step', cls: 'sm',
          dots: (y.countries || []).map(c => ({ name: c.name, v: fpBy[c.name] != null ? fpBy[c.name] : null })) }];
      if (twin) rows.unshift({ cap: 'Two copies of the same camera', v: y.same_camera_pct, lab: `about ${pct(y.same_camera_pct)} apart` });
      const n = y.world ? y.world.n : (y.countries || []).length, within = y.world ? y.world.translated_within25 : null, closer = fpData ? fpData.closer : null;
      const d = Object.assign({}, data, { ladder: { twin }, textOverride: { y_rows: rows.slice(0, 3), y_h1: 'So how good is that?', y_h2: `All ${n} countries with a lot of fire: ${within === n ? 'every one' : within + ' of them'} within 25%.`,
        y_eyebrow: 'A typical month in Argentina · how far from what ' + no + ' counted', y_eyebrow2: `Every country with a lot of fire · a typical month`,
        y_ruler: `How far from what ${no} counted, in a typical month`,
        y_world: `Each dot is one country: gold, our translation; blue, the smarter version${closer != null ? `, which brings ${closer} of the ${fpData.countries} closer` : ''}.` } });
      StoryEnding.yardstick(host, d, map[raw] === 'lad2' ? 2 : 1); };
    const mode = () => { if (!sec) return; const m = map[cur]; sec.classList.toggle('s4x-y', m === 'yard' || /^lad/.test(m)); sec.classList.toggle('s3-fpon', m === 'fp'); };
    const clear = () => { timers.forEach(clearTimeout); timers = []; if (host) StoryEnding.stop(host); };
    const yard = animate => { if (!data || !host || S.secs[S.cur] !== sec) return; clear(); endingConfig();
      const d = Object.assign({}, data, { textOverride: { y_h0: 'So how good is that?', y_h1: 'So how good is that?', y_h2: 'So how good is that?' } });
      if (!animate || S.still) { StoryEnding.yardstick(host, d, 2); return; }
      StoryEnding.yardstick(host, d, 0); S.busy = S.busy || {}; S.busy.s4yard = performance.now() + 5200;
      timers.push(setTimeout(() => StoryEnding.yardstick(host, d, 1), 1900), setTimeout(() => StoryEnding.yardstick(host, d, 2), 3700)); };
    sc.build = s => { sec = s; s.innerHTML = '<div class="se-host"></div><div class="s3-fp" aria-hidden="true"></div><div class="s4x-in"></div>';
      host = s.firstChild; fp = s.children[1]; wrap = s.lastChild; inner.build(wrap);
      StoryEnding.load('data/ending_table.json').then(d => { data = d; if (/^lad/.test(map[cur])) ladder(cur, false); }).catch(() => {}); };
    sc.step = (raw, animate) => { const was = cur; cur = raw; const m = map[raw]; mode();
      if (m === 'yard') { yard(animate && was !== raw); return; }
      if (/^lad/.test(m)) { ladder(raw, animate); return; }
      clear();
      if (m === 'fp') { if (!fpBuilt) { fpBuilt = true; firePowerPanel(fp).then(() => { if (!LAD || !BANDS) return;
          const y = data && data.yardstick, ar = fpData && fpData.rows.find(r => r.name === 'Argentina'); if (!y) return;
          const chips = `<p class="fp-chips"><span class="e">Just stitched: about ${Math.round(y.untranslated_times * 2) / 2} times</span><span class="g">Our translation: within about ${Math.round(y.translated_pct)}%</span>${ar ? `<span class="s">Smarter version: within about ${Math.round(ar.strength)}%</span>` : ''}</p>`;
          const cap = fp.querySelector('.fp-cap'); if (cap) cap.insertAdjacentHTML('beforebegin', chips); }); } fp.setAttribute('aria-hidden', 'false');
        if (animate && !S.still && was !== raw) { sec.classList.remove('s3-fpgo'); void sec.offsetWidth; sec.classList.add('s3-fpgo'); S.busy = S.busy || {}; S.busy.s3fp = performance.now() + 1700; }
        return; }
      fp.setAttribute('aria-hidden', 'true'); sec.classList.remove('s3-fpgo');
      inner.step(m, animate); sec.dataset.st = wrap.dataset.st || ''; sec.dataset.w = wrap.dataset.w || ''; };
    sc.enter = a => { mode(); const m = map[cur]; if (/^lad/.test(m)) ladder(cur, a); else if (m === 'yard') yard(a); else if (m !== 'fp') { inner.enter(a); sec.dataset.st = wrap.dataset.st || ''; sec.dataset.w = wrap.dataset.w || ''; } };
    sc.leave = () => clear();
    sc.replay = () => { const m = map[cur]; if (/^lad/.test(m)) { if (host) { StoryEnding.stop(host); host.innerHTML = ''; } ladder(cur, true); return true; } if (m === 'yard') { yard(true); return true; }
      if (m === 'fp') { sec.classList.remove('s3-fpgo'); void sec.offsetWidth; sec.classList.add('s3-fpgo'); return true; } return false; };
    sc.layout = () => { const m = map[cur]; if (/^lad/.test(m)) { if (host) host.innerHTML = ''; ladder(cur, false); } else if (m === 'yard') yard(false); else if (m !== 'fp') inner.layout(); };
    sc.numbers = () => { const m = map[cur]; return m === 'yard' || /^lad/.test(m) ? (data ? StoryEnding.numbers('yardstick', data) : null) : m === 'fp' ? null : inner.numbers(); };
    return sc;
  }
  // Slide 5 after the reorder: ONE press, "Ask it yourself": the connector screen (StoryEnding.connector) plays by itself and holds settled.
  // StoryBeats.showMapSlide = true brings back the yardstick-then-map slide 5 instead.
  // historyScale 'vee': a copy of the ending table with slide 6's one-scale bars and counts, and the world chart, on Vee's scale
  // (data/scale_vee.json, built by tools/build_scale_vee.cjs from the engine; pinned in check_numbers). The stitched view is unchanged.
  function veeEnding(d) {
    return fetch('data/scale_vee.json').then(r => { if (!r.ok) throw new Error('scale_vee.json: ' + r.status); return r.json(); }).then(v => {
      const c = JSON.parse(JSON.stringify(d)), by = {}; v.small_multiples.forEach(x => { by[x.file] = x; });
      c.small_multiples.forEach(sm => { const x = by[sm.file]; if (!x) return; sm.years.forEach((y, k) => { y.one0 = y.one; y.one = x.vee[k] != null ? x.vee[k] : y.one; }); sm.one_best = x.vee_best; });
      c.records = Object.assign({}, c.records, { one_scale_after_2021: v.records.vee_scale_after_2021 });
      c.world = Object.assign({}, c.world, { countries: v.world.countries, totals: v.world.totals, first5: v.world.first5, last5: v.world.last5, change_pct: v.world.change_pct, moe: v.world.moe, added: v.world.added });
      c.twoTone = true;      // two tones per bar (8:21 AM)
      const nv = (window.StoryEnding && StoryEnding.settings.names && StoryEnding.settings.names.newer) || 'Vee';
      c.textOverride = { o_eyebrow: `It isn't just Argentina · the same charts on ${nv}'s scale`,
        // 9:58 AM (steel team): one answer in the headline; the older camera alone moves to the footnote, small
        o_h1: `On one scale, only <b>${v.records.vee_scale_after_2021}</b> do.`,
        m_small: `Whole years with the older camera's own count, 2003 to 2025. ${c.records.untestable.length ? cap(NUMW[c.records.untestable.length] || String(c.records.untestable.length)) + ' more busy countries have too few whole years to test. ' : ''}The older camera alone, with no translation: ${c.records.older_alone_after_2021}.`,
        w_eyebrow: `Back to the question · on ${nv}'s scale`, w_unit: `fire detections a year on ${nv}'s scale, counted the same way throughout; not land burned` };
      return c;
    }).catch(() => d);      // no Vee-scale table: the default pictures
  }
  // the smarter version's seven bands, now an extra (W key) for questions (9:19 AM)
  function extraFirePower() {
    const sc = { steps: 1, title: 'A smarter version, built and tested', cls: 's4x s3-fpon fp-extra' };
    let box = null, built = false;
    sc.build = s => { s.innerHTML = '<div class="s3-fp" aria-hidden="false"></div>'; box = s.firstChild; };
    sc.enter = () => { if (!built && box) { built = true; firePowerPanel(box); } };
    sc.step = () => {}; sc.layout = () => {};
    return sc;
  }
  // slide 6 (10:51 AM): first the web app's burning calendar, the answer to the challenge (a real screenshot of the page's own grid), then the
  // connector. StoryBeats.showCalendarScreen = false removes the calendar press.
  // the calendar screen's alternative look (team lead, 10:56 AM; StoryBeats.calendarLook = 'globe'): the story's globe turning through 2025's
  // months on the left; on the right Argentina's record stacking up year by year (the page's own calendar data and shading: rank against the
  // same month in other years, on VIIRS's scale), the globe's month lit as a column. End state = the full grid with the year totals.
  function calendarGlobe(box, mode) {
    const RIDGES = mode === 'ridges';
    const R = S.ctx.readings, A = S.ctx.adapters, r0 = S.ctx.argentina, r = (R.onScale && R.onScale(r0, 'viirs')) || r0;
    const cal = A.calendar(r); if (A.isRefusal(cal)) { box.innerHTML = nothing(cal.message); return { play() {}, stop() {} }; }
    const tot = {}; for (const y of R.yearly(r)) tot[y.year] = y.complete && y.ours != null ? y.ours : null;
    const shade = rk => rk == null ? 'transparent' : 'rgba(255,205,121,' + (0.07 + 0.6 * rk).toFixed(3) + ')';
    const rows = cal.years.map((y, i) => `<div class="cg-row" data-i="${i}"><b>${y}</b>${Array.from({ length: 12 }, (_, m) => { const v = cal.cells[i][m];
      return `<i data-m="${m}" style="background:${v == null ? 'transparent' : shade(cal.rank[i][m])}"${v == null ? ' class="nd"' : ''}></i>`; }).join('')}<em>${tot[y] != null ? fmt(tot[y]) : ''}</em></div>`).join('');
    const lastWhole = Math.max(...cal.years.filter(y => tot[y] != null));
    const ridgeYears = cal.years.filter(y => y <= lastWhole), ridgeVals = ridgeYears.map(y => cal.cells[cal.years.indexOf(y)]);
    const rmax = Math.max(...ridgeVals.flat().filter(v => v != null));
    const B = window.StoryBeats || {}, pageAddr = String(B.pageAddress || '').replace(/^[a-z]+:\/\//i, '');
    const rightHTML = RIDGES ? `<div class="cr"><canvas class="cr-cv" width="1180" height="600" role="img" aria-label="Argentina's burning calendar as a landscape: one line per year from ${ridgeYears[0]} at the back to ${lastWhole} at the front, one point per month, height = fire detections on VIIRS's scale; the newest year in gold"></canvas>
        <p class="cr-cap">One line = one year. One point = one month. Height = hot spot detections, on one scale.</p>
        <figure class="cr-thumb"><img src="img/ending/explore_thumb.png" alt="The web app: a globe to pick a country, beside its burning calendar" draggable="false"><figcaption>the page itself${pageAddr ? `<span>${esc(pageAddr)}</span>` : ''}</figcaption></figure></div>` : '';
    box.innerHTML = `<div class="cg${RIDGES ? ' cg-r' : ''}"><figure class="cg-globe"><canvas width="520" height="520" aria-hidden="true"></canvas><figcaption><b class="cg-mon">January</b> 2025<small>fire seen from space, month by month</small></figcaption></figure>
      ${rightHTML}<div class="cg-stack"${RIDGES ? ' hidden' : ''} role="img" aria-label="Argentina's burning calendar: every month since ${cal.years[0]}, one row per year, each month shaded by its rank against the same month in other years, with each year's total, on VIIRS's scale">
        <div class="cg-head"><b></b>${['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, k) => `<i data-m="${k}">${m}</i>`).join('')}<em>year</em></div>${rows}
        <p class="cg-key"><span class="cg-sw"></span>shade: busier than the same month in other years · Argentina, on VIIRS's scale</p></div></div>`;
    const cv = box.querySelector('canvas'), g = cv.getContext('2d'), RAD = Math.PI / 180, LON0 = -61, LAT0 = -27;
    const fwd = (lon, lat) => { const dl = (lon - LON0) * RAD, la = lat * RAD, sl = Math.sin(LAT0 * RAD), cl = Math.cos(LAT0 * RAD);
      return [Math.cos(la) * Math.sin(dl), cl * Math.sin(la) - sl * Math.cos(la) * Math.cos(dl), sl * Math.sin(la) + cl * Math.cos(la) * Math.cos(dl)]; };
    let glow = null, shapes = null, land = null, mon = 0, raf = 0, t0 = 0, timers = [];
    const D = 520, Rr = 240, c = D / 2, P = (lon, lat) => { const q = fwd(lon, lat); return [c + q[0] * Rr, c - q[1] * Rr, q[2]]; };
    function drawLand() { land = document.createElement('canvas'); land.width = land.height = D; const q = land.getContext('2d');
      const oc = q.createRadialGradient(c * .8, c * .76, 20, c, c, Rr); oc.addColorStop(0, '#12305a'); oc.addColorStop(1, '#050d1c');
      q.fillStyle = oc; q.beginPath(); q.arc(c, c, Rr, 0, 2 * Math.PI); q.fill(); q.save(); q.clip();
      if (shapes) shapes.shapes.forEach(sh => { if (!sh.rings.some(rg => rg.some(([x, y]) => fwd(x / 10, y / 10)[2] > 0))) return;
        q.beginPath(); sh.rings.forEach(rg => rg.forEach(([x, y], i) => { const p = P(x / 10, y / 10); if (i) q.lineTo(p[0], p[1]); else q.moveTo(p[0], p[1]); }));
        q.fillStyle = sh.file === 'Argentina' ? '#33465f' : '#243247'; q.fill(); q.strokeStyle = sh.file === 'Argentina' ? 'rgba(255,236,200,.75)' : 'rgba(120,145,175,.35)'; q.lineWidth = sh.file === 'Argentina' ? 2.2 : 1; q.stroke(); });
      q.restore(); }
    function frame(k) {
      g.clearRect(0, 0, D, D); if (land) g.drawImage(land, 0, 0);
      const a = glow && glow.months && glow.months[((k % 12) + 12) % 12]; if (a) { g.save(); g.beginPath(); g.arc(c, c, Rr, 0, 2 * Math.PI); g.clip(); g.globalCompositeOperation = 'lighter';
        for (let i = 0; i < a.length; i += 3) { const p = fwd((a[i] - 184) / 2 + .25, (a[i + 1] - 116) / 2 + .25); if (p[2] <= .02) continue; const v = a[i + 2], [rr, gg, bb] = fireRGB(v);
          g.fillStyle = `rgba(${rr},${gg},${bb},${Math.min(1, .35 + v / 160).toFixed(2)})`; g.beginPath(); g.arc(c + p[0] * Rr, c - p[1] * Rr, 2.4 + v / 70, 0, 2 * Math.PI); g.fill(); }
        g.restore(); }
      g.strokeStyle = 'rgba(120,170,255,.5)'; g.lineWidth = 2; g.beginPath(); g.arc(c, c, Rr, 0, 2 * Math.PI); g.stroke();
      const nm = box.querySelector('.cg-mon'); if (nm) nm.textContent = MONTHS[k % 12];
      box.querySelectorAll('[data-m]').forEach(el => el.classList.toggle('lit', +el.dataset.m === k % 12)); if (rg) { rmon = ((k % 12) + 12) % 12; ridges(); } }
    Promise.all([loadGlow(), loadShapes()]).then(([gl, sh]) => { glow = gl; shapes = sh; drawLand(); frame(mon); }).catch(() => {});
    const rcv = box.querySelector('.cr-cv'), rg = rcv && rcv.getContext('2d'); let rprog = 1, rmon = -1;
    function ridges() {
      if (!rg) return; const W = rcv.width, H = rcv.height, left = 70, right = W - 40, amp = 200, back = amp + 16, front = H - 46, shift = 150;
      const N = ridgeYears.length, pt = (i, m, v) => { const t = i / Math.max(1, N - 1); return { x: left + (1 - t) * shift + m / 11 * (right - left - shift), y: back + t * (front - back) - (v || 0) / rmax * amp }; };
      rg.clearRect(0, 0, W, H);
      for (let m = 0; m < 12; m++) { const a = pt(0, m, 0), b = pt(N - 1, m, 0), lit = m === rmon; rg.beginPath(); rg.moveTo(a.x, a.y); rg.lineTo(b.x, b.y);
        rg.strokeStyle = lit ? 'rgba(255,205,121,.85)' : 'rgba(120,150,200,.22)'; rg.lineWidth = lit ? 2.5 : 1; rg.stroke();
        rg.fillStyle = lit ? '#ffcd79' : '#a5b2c2'; rg.font = `${lit ? 700 : 500} 22px JetBrains Mono, monospace`; rg.textAlign = 'center'; rg.fillText(MON3[m], b.x, b.y + 30); }
      const shown = rprog * N;
      for (let i = 0; i < N; i++) { if (i >= shown) break; const a = Math.min(1, shown - i), newest = i === N - 1, y = ridgeYears[i];
        const pts = ridgeVals[i].map((v, m) => ({ v, m, ...pt(i, m, v), y0: pt(i, m, 0).y }));
        const runs = []; let run = []; for (const q of pts) { if (q.v == null) { if (run.length) runs.push(run); run = []; } else run.push(q); } if (run.length) runs.push(run);
        rg.globalAlpha = a;
        for (const ps of runs) { rg.beginPath(); rg.moveTo(ps[0].x, ps[0].y0); for (const q of ps) rg.lineTo(q.x, q.y); rg.lineTo(ps[ps.length - 1].x, ps[ps.length - 1].y0); rg.closePath();
          rg.fillStyle = newest ? 'rgba(120,70,20,.55)' : 'rgba(8,18,40,.88)'; rg.fill();
          rg.beginPath(); ps.forEach((q, k) => k ? rg.lineTo(q.x, q.y) : rg.moveTo(q.x, q.y));
          const k = i / Math.max(1, N - 1); rg.strokeStyle = newest ? '#ffcd79' : `rgba(${Math.round(110 + 145 * k)},${Math.round(140 + 30 * k)},${Math.round(210 - 120 * k)},${(.45 + .45 * k).toFixed(2)})`; rg.lineWidth = newest ? 4 : 1.6; rg.stroke(); }
        if (y % 5 === 0 || newest) { const b0 = pt(i, 0, 0); rg.font = `${newest ? 700 : 500} ${newest ? 22 : 18}px JetBrains Mono, monospace`; rg.textAlign = 'right'; rg.fillStyle = newest ? '#ffcd79' : '#a5b2c2'; rg.fillText(String(y), b0.x - 10, b0.y + 6); }
        rg.globalAlpha = 1; }
      if (rmon >= 0) { const a = pt(0, rmon, 0), b = pt(N - 1, rmon, 0); rg.beginPath(); rg.moveTo(a.x, a.y); rg.lineTo(b.x, b.y); rg.setLineDash([6, 6]); rg.strokeStyle = 'rgba(255,205,121,.7)'; rg.lineWidth = 2; rg.stroke(); rg.setLineDash([]); }
    }
    const MONTH_MS = 900, rowsEl = [...box.querySelectorAll('.cg-row')];
    function stop() { cancelAnimationFrame(raf); timers.forEach(clearTimeout); timers = []; }
    function play(animate) { stop(); const still = !animate || S.still;
      if (rg) { rprog = still ? 1 : 0; ridges(); if (!still) { const r0 = performance.now(); S.busy = S.busy || {}; S.busy.cr = r0 + 8300;
        const grow = now => { rprog = Math.min(1, (now - r0) / 8000); ridges(); if (rprog < 1) timers.push(setTimeout(() => requestAnimationFrame(grow), 16)); }; requestAnimationFrame(grow); } }
      rowsEl.forEach((el, i) => { el.classList.toggle('in', still); if (!still) timers.push(setTimeout(() => el.classList.add('in'), 300 + i * 260)); });
      if (!still) { S.busy = S.busy || {}; S.busy.cg = performance.now() + 300 + rowsEl.length * 260 + 600; }
      if (still) { mon = 0; frame(0); box.querySelectorAll('.lit').forEach(el => el.classList.remove('lit')); if (rg) { rmon = -1; ridges(); } return; }
      t0 = performance.now(); const tick = now => { const k = Math.floor((now - t0) / MONTH_MS); if (k !== mon) { mon = k; frame(k); } raf = requestAnimationFrame(tick); }; raf = requestAnimationFrame(tick); }
    return { play, stop };
  }
  function slide6cal() {
    const sc = { steps: 2, title: 'Ask it yourself', wide: true, cls: 'se-scene s7v s6cal' };
    let sec = null, host = null, data = null, cur = 0, played = false;
    const LOOK = (window.StoryBeats && window.StoryBeats.calendarLook) || 'ridges', GL = LOOK === 'globe' || LOOK === 'ridges'; let cg = null;
    const draw = force => { if (!sec) return; sec.classList.toggle('s7v-fin', cur === 1);
      if (cur === 1 && data && host && S.secs[S.cur] === sec && (force || !played)) { played = true; endingConfig(); StoryEnding.connector(host, data, 0); } };
    sc.build = s => { sec = s; const B = window.StoryBeats || {};
      s.innerHTML = `<div class="se-host"></div><div class="s7v-vol">
        <header class="st-head"><p class="st-eyebrow">Our web app · the page</p><h2 class="st-h">What the challenge asked for: <em>a burning calendar</em></h2></header>
        ${GL ? (LOOK === 'globe' ? '<p class="cg-sub">Argentina, every month since 2000, one row per year, on one scale.</p>' : '') + '<div class="cg-host"></div>' : ''}
        <div class="s7v-body"${GL ? ' hidden' : ''}><figure class="s7v-shot s6-shot"><div class="s7v-bar" aria-hidden="true"><i></i><i></i><i></i><span>Two Cameras, One Calendar · Argentina · The record</span></div>
            <img src="img/ending/calendar_grid.png" alt="The page's calendar for Argentina: every month since November 2000 by year, each with its fire detections on one scale, shaded by how busy the month was against the same month in other years, with each year's total" draggable="false">
            <figcaption class="s6-addr"></figcaption></figure>
          <div class="s7v-side"><ol class="s7v-calls"><li>Every month since November 2000, harmonized onto one scale</li><li>Each month shaded against the same month in other years, with each year's total</li><li>This month against its usual, the middle of the other years, for the country you pick</li></ol></div></div></div>`;
      host = s.firstChild; if (GL) { try { cg = calendarGlobe(s.querySelector('.cg-host'), LOOK); } catch (e) { s.querySelector('.cg-host').innerHTML = nothing(e.message); } }
      StoryEnding.load('data/ending_table.json').then(d => { data = d; draw(); }).catch(() => {}); };
    const addr = () => { const a = sec && sec.querySelector('.s6-addr'), B = window.StoryBeats || {}, t = String(B.pageAddress || '').replace(/^[a-z]+:\/\//i, ''); if (a) { a.textContent = t; a.hidden = !t; } };
    sc.step = (st, animate) => { const was = cur; if (st !== cur) played = false; cur = st; draw(); addr(); if (cg) { if (st === 0 && was !== 0) cg.play(animate); if (st !== 0) cg.stop(); } };
    sc.enter = animate => { played = false; draw(); addr(); if (cg && cur === 0) cg.play(animate); };
    sc.leave = () => { if (host) StoryEnding.stop(host); played = false; if (cg) cg.stop(); };
    sc.replay = () => { if (cur === 0 && cg) { cg.play(true); return true; } if (cur !== 1 || !host) return false; StoryEnding.stop(host); host.innerHTML = ''; draw(true); return true; };
    sc.layout = () => { if (cur === 1 && host) { host.innerHTML = ''; draw(true); } };
    return sc;
  }
  function slide7v() {
    const sc = { steps: 2, title: 'Try it yourself', wide: true, cls: 'se-scene s7v' };
    let sec = null, host = null, vol = null, data = null, cur = 0;
    const draw = () => { if (!sec) return; sec.classList.toggle('s7v-fin', cur === 1);
      if (cur === 1 && data && host && S.secs[S.cur] === sec) { endingConfig(); StoryEnding.final(host, data, 0); } };
    sc.build = s => { sec = s; const B = window.StoryBeats || {};
      s.innerHTML = `<div class="se-host"></div><div class="s7v-vol">
        <header class="st-head"><p class="st-eyebrow">Built this weekend · live now</p><h2 class="st-h">Fire, <em>or something else?</em></h2></header>
        <div class="s7v-body"><figure class="s7v-shot"><div class="s7v-bar" aria-hidden="true"><i></i><i></i><i></i><span>Fire, or something else?</span></div>
            <img src="img/ending/volunteer_screen_round4.png" alt="The volunteer page on one screen: one hot spot from 2020 shown in pictures from space and at night, its heat readings by month and at night, and five choices: a wildfire or farm burning, oil, gas or other industry, a volcano, something else, or I can't tell" draggable="false">
            <figcaption>Pictures: contains modified Copernicus Sentinel data 2020; NASA HLS, VIIRS and Black Marble images via GIBS.</figcaption></figure>
          <div class="s7v-side"><ol class="s7v-calls"><li>A real hot spot from 2020</li><li>Pictures from space, its lights at night, the cameras' heat readings</li><li>You pick, then see NASA's own label</li></ol>
            <div class="s7v-qr"><img src="img/qr/volunteer.svg" alt="QR code for the volunteer page" draggable="false"><p class="s7v-addr">${esc(String(B.volunteerAddress || '').replace(/^[a-z]+:\/\//i, ''))}</p></div></div></div></div>`;
      host = s.firstChild; vol = s.lastChild;
      StoryEnding.load('data/ending_table.json').then(d => { data = d; draw(); }).catch(() => {}); };
    sc.step = st => { cur = st; draw(); };
    sc.enter = () => { draw(); const a = sec && sec.querySelector('.s7v-addr'), B = window.StoryBeats || {}; if (a) a.textContent = String(B.volunteerAddress || '').replace(/^[a-z]+:\/\//i, ''); };
    sc.leave = () => { if (host) StoryEnding.stop(host); };
    sc.layout = () => { if (cur === 1 && host) { host.innerHTML = ''; draw(); } };
    return sc;
  }
  function scene5A() {
    // press 1: the yardstick (s5_p1; StoryBeats.yardstickView 'bars' or 'zoom'); press 2: the map (s5_p2); press 3: the fifteen countries (s5_p3)
    const inner = scene5(), Y = 1, YS = window.StoryBeats && window.StoryBeats.yardstickView === 'zoom' ? 1 : 0, MAP = [0, 2];
    const sc = { steps: Y + MAP.length, title: 'What did the translation do?', cls: 's5 s5a' };
    let sec = null, host = null, wrap = null, data = null, cur = 0;
    const draw = () => { if (data && host && cur < Y && S.secs[S.cur] === sec) { endingConfig(); StoryEnding.yardstick(host, data, YS); } };
    const mode = () => { if (sec) sec.classList.toggle('s5a-y', cur < Y); };
    sc.build = s => { sec = s; s.innerHTML = '<div class="se-host"></div><div class="s5a-map"></div>'; host = s.firstChild; wrap = s.lastChild;
      inner.build(wrap);       // the map scene writes its header, picture and words into the wrapper (display: contents keeps the slide's grid)
      StoryEnding.load('data/ending_table.json').then(d => { data = d; draw(); }).catch(e => { host.innerHTML = nothing(e.message); }); };
    sc.step = (raw, animate) => { cur = raw; mode();
      if (raw < Y) draw(); else { inner.layout(); inner.step(MAP[raw - Y], animate); sec.dataset.st = wrap.dataset.st; sec.classList.toggle('s5-still', wrap.classList.contains('s5-still')); } };
    sc.enter = a => { mode(); if (cur >= Y) inner.enter(a); else draw(); };
    sc.leave = () => { if (host) StoryEnding.stop(host); };
    sc.layout = () => { if (cur < Y) { if (host && data) { host.innerHTML = ''; draw(); } } else { inner.layout(); sec.dataset.st = wrap.dataset.st; } };
    sc.numbers = () => cur < Y ? (data ? StoryEnding.numbers('yardstick', data) : null) : inner.numbers();
    return sc;
  }

  /* =====================================================================================================
     The frame: stage, scaling, navigation, keys, notes strip
     ===================================================================================================== */
  const ACTS = [[1, 'Act 1 · What is this?'], [1, 'Act 1 · What is this?'], [2, 'Act 2 · How it works'], [2, 'Act 2 · How it works'], [2, 'Act 2 · How it works'],
    [3, 'Act 3 · What we built'], [3, 'Act 3 · What we built'], ['x', 'Extra'], ['x', 'Extra'], ['x', 'Extra'], ['x', 'Extra']];
  function fit() {
    if (!S) return;
    const notesH = S.notesOn ? S.notes.offsetHeight : 0;
    // fit what is actually visible: the page around the story may place bars above it, so never use more than the window has left below its top
    const top = S.el.getBoundingClientRect().top, room = Math.max(200, Math.min(S.el.clientHeight, (window.innerHeight || S.el.clientHeight) - Math.max(0, top)));
    const vw = S.el.clientWidth, vh = Math.max(200, room - notesH);
    const port = vw < 760 || vw / vh < 0.9;
    S.viewport.style.bottom = notesH + 'px';
    if (port !== S.port) { S.port = port; S.root.classList.toggle('st-port', port); S.root.classList.toggle('st-land', !port); S.scenes.forEach(sc => sc.layout && sc.layout()); }
    let sw, sh, s;
    if (port) { s = vw / PW; sw = PW; sh = vh / s; } else { s = Math.min(vw / LW, vh / LH); sw = LW; sh = LH; }
    S.scale = s;
    Object.assign(S.stage.style, { width: sw + 'px', height: sh + 'px', transform: `scale(${s})`, left: ((vw - sw * s) / 2) + 'px', top: (port ? 0 : (vh - sh * s) / 2) + 'px' });
  }
  function show(n, step, animate) {
    const prev = S.cur;
    n = Math.max(0, Math.min(N - 1, n));
    const sc = S.scenes[n]; step = Math.max(0, Math.min(sc.steps - 1, step));
    const entering = n !== prev;
    if (entering && prev >= 0 && S.scenes[prev].leave) S.scenes[prev].leave();
    S.shownAt = performance.now();
    if (entering && prev >= 0) S.root.dataset.move = n > prev ? (n <= 4 ? 'up' : n === 5 ? 'down' : 'side') : (prev <= 4 ? 'down' : prev === 5 && n === 4 ? 'up' : 'side');
    S.cur = n; S.step = step;
    S.secs.forEach((el, k) => { el.classList.toggle('on', k === n); el.classList.toggle('past', k < n); el.setAttribute('aria-hidden', String(k !== n)); if ('inert' in el) el.inert = k !== n; });
    S.secs[n].querySelectorAll('.st-step').forEach(e => e.classList.toggle('on', +e.dataset.at <= step));
    S.secs[n].querySelectorAll('.st-only').forEach(e => { const on = e.dataset.only.split('').map(Number).includes(step); e.classList.toggle('on', on); e.setAttribute('aria-hidden', String(!on)); });
    S.secs[n].querySelectorAll('.st-step0').forEach(e => { e.classList.toggle('off', step >= 1); e.setAttribute('aria-hidden', String(step >= 1)); });
    if (entering) { S.secs[n].scrollTop = 0; sc.step(step, false); sc.enter(animate && !S.still); } else sc.step(step, animate && !S.still);
    numbers(false, true);
    S.numBtn.hidden = !S.scenes[n].numbers || !S.scenes[n].numbers();
    S.root.classList.toggle('st-light', n < 2);     // act 1 is drawn on light paper: the controls change ink with it
    const sk = n + ':' + step; if (sk !== S.styKey) { styleTo(n, step, prev < 0 ? 0 : entering ? 1500 : 1100); S.styKey = sk; }
    S.root.classList.toggle('st-title', n === 0 && step === 0);
    S.counter.textContent = n === 0 && step === 0 ? 'title' : n < NUM ? (n + 1) + ' / ' + NUM : 'extra';
    S.dots.forEach((b, k) => { b.classList.toggle('on', k === n); b.setAttribute('aria-current', k === n ? 'step' : 'false'); });
    S.back.disabled = n === 0 && step === 0;
    const fin = n === NUM - 1 && step === sc.steps - 1;
    S.next.disabled = fin; S.next.classList.toggle('quiet', fin);   // the final screen: Next does nothing (the extras are on W)
    // the presenter's place in the printed script: click k of all the clicks from the title (the title itself is click 1)
    if (S.click) { let k = step + 1; for (let i = 0; i < n && i < NUM; i++) k += S.scenes[i].steps; S.click.textContent = n < NUM ? 'click ' + k + ' / ' + S.clicks : ''; }
    S.live.textContent = n === 0 && step === 0 ? (window.StoryBeats && window.StoryBeats.titleQuestion === true ? 'Title: Is the world burning more than it used to?' : 'Title: Two Cameras, One Calendar. Spark Squad, a homeschool family team') : (n < NUM ? `Scene ${n + 1} of ${NUM}: ` : 'Extra: ') + sc.title + (sc.steps > 1 ? ` (step ${step + 1} of ${sc.steps})` : '');
    notes(); aiMark(); setTimeout(aiMark, 60);
    if (S.pmid) S.pmid.hidden = !atMiddleStart();
    { const cp = S.stage.querySelector('.st-apcap'); if (cp) cp.classList.toggle('side', !!(sc.capSide && sc.capSide(step))); }   // captions (C) move beside a picture that fills the bottom
    if (S.ctx.updateHash !== false && entering) { try { history.replaceState(null, '', '#story/' + (n + 1)); } catch (e) {} }
  }
  function numbers(open, quiet) {      // the plotted values as plain tables, inside the stage (key N; Escape or the button closes)
    const sc = S.scenes[S.cur], spec = open && sc && sc.numbers ? sc.numbers() : null;
    if (open && !spec) return;
    if (open) {
      S.num.querySelector('b').textContent = spec.title;
      S.num.querySelector('.st-num-body').innerHTML = spec.tables.map(t => `<table><caption>${esc(t.caption)}</caption><thead><tr>${t.head.map(h => `<th scope="col">${esc(h)}</th>`).join('')}</tr></thead><tbody>${t.rows.map(r => `<tr>${r.map((c, i) => i ? `<td>${esc(c)}</td>` : `<th scope="row">${esc(c)}</th>`).join('')}</tr>`).join('')}</tbody></table>`).join('');
      S.num.hidden = false; S.num.querySelector('.st-num-body').scrollTop = 0; S.numBtn.setAttribute('aria-expanded', 'true');
      S.num.querySelector('.st-num-close').focus();
    } else if (!S.num.hidden) {
      S.num.hidden = true; S.numBtn.setAttribute('aria-expanded', 'false'); if (!quiet && !S.numBtn.hidden) S.numBtn.focus();
    }
  }
  function next() {
    if (S.ap && !S.apDriving) apStop();      // a manual press during autoplay hands control back
    if (S.harmony) { S.harmony(); return; }      // a press during the lift-off or the landing skips to its end
    const sc = S.scenes[S.cur];
    if (S.step < sc.steps - 1) show(S.cur, S.step + 1, true);
    else if (S.cur === NUM - 1) return;      // the final screen stays up through questions; the extras are on their own key (W)
    else if (S.cur < N - 1) show(S.cur + 1, 0, true);
    else if (S.cur === N - 1) show(NUM - 1, S.scenes[NUM - 1].steps - 1, true);      // after the extras: back to slide 7's closing question
  }
  // one overlay that plays for `ms`, hands over to the next slide at `at`, and can be skipped by a press
  function moment(cls, html, ms, at, done, setup) {
    const k = S.slow || 1; ms *= k; at *= k;      // ?slowmo=N plays the moment N times slower (for checking it frame by frame)
    const ov = document.createElement('div'); ov.className = 'st-moment ' + cls; ov.setAttribute('aria-hidden', 'true'); ov.innerHTML = html;
    S.stage.appendChild(ov); if (setup) setup(ov);
    let ended = false, handed = false;
    const hand = () => { if (handed) return; handed = true; S.styMs = 0; done(); };
    const end = () => { if (ended) return; ended = true; S.harmony = null; clearTimeout(t1); clearTimeout(t2); hand(); ov.classList.add('out'); setTimeout(() => ov.remove(), 650); };
    S.harmony = end;
    requestAnimationFrame(() => requestAnimationFrame(() => { ov.classList.add('go'); if (k !== 1) requestAnimationFrame(() => ov.getAnimations({ subtree: true }).forEach(a => { a.playbackRate = 1 / k; })); }));
    const t1 = setTimeout(hand, at), t2 = setTimeout(end, ms);
  }
  /* The lift-off, slide 2 into slide 3: the camera rises with the two satellites; the paper sky becomes the night of orbit; the ground
     falls away and the wetland shrinks into the globe inside the clock. About 2.8 s; with motion off slide 3 simply begins in orbit. */
  function liftOff(done) {
    if (S.still) { done(); return; }
    const W = S.port ? PW : LW, H = S.port ? S.stage.offsetHeight : LH;
    const gb = (S.scenes[2].globeBox && S.scenes[2].globeBox()) || { x: W * .66, y: H * .4, r: 180 };
    const big = Math.max(W, H) * 1.5, k = big / (2 * gb.r), dx = W / 2 - gb.x, dy = H + big * .5 - 330 - gb.y;
    const wet = S.scenes[0].wetland && S.scenes[0].wetland(); let url = '';
    try { url = wet ? wet.toDataURL('image/png') : ''; } catch (e) { url = ''; }
    const sat = (id, x, y, from) => `<div class="lf-sat" style="left:${x}px;top:${y}px;transform:${from}">${slot(id)}</div>`;
    S.styMs = 0; styleTo(2, 2600 * (S.slow || 1));
    moment('st-lift', `<div class="lf-disc" style="left:${(gb.x - gb.r).toFixed(0)}px;top:${(gb.y - gb.r).toFixed(0)}px;width:${(2 * gb.r).toFixed(0)}px;height:${(2 * gb.r).toFixed(0)}px;transform:translate(${dx.toFixed(0)}px,${dy.toFixed(0)}px) scale(${k.toFixed(3)})">
        <i class="lf-land"${url ? ` style="background-image:url(${url})"` : ''}></i><i class="lf-night"></i></div>
      ${sat('older_idle', S.port ? 40 : 120, S.port ? 90 : 80, `translate(${S.port ? 60 : 160}px,${H - 380}px) scale(2.2)`)}
      ${sat('newer_idle', S.port ? 560 : 1680, S.port ? 90 : 80, `translate(${S.port ? -60 : -160}px,${H - 380}px) scale(2.2)`)}`, 2800, 2050, done);
  }
  /* The landing, slide 5 into slide 6: out of orbit, down through the glow of the planet's edge, to a desk at night where the record is
     a page on a screen. The two cameras arrive small, side by side over one scale: two cameras, one record. About 2.8 s. */
  function landing(done) {
    if (S.still) { done(); return; }
    S.styMs = 0; styleTo(5, 2600 * (S.slow || 1));
    moment('st-landing', `<div class="ld-planet"></div><div class="ld-screen"></div>
      <p class="ld-words">Two cameras. <em>One record.</em></p>
      <div class="ld-pair">${slot('both_together')}<span>one scale</span></div>`, 2800, 2050, done);
  }
  // replay (redline 9:19 AM: "I didn't even see the animation"): key R, or the small ↻ button, plays the current screen's motion again
  function replay() {
    if (!S || S.ap || S.cur < 0) return; const n = S.cur, st = S.step, sc = S.scenes[n];
    if (sc.replay && sc.replay()) return;
    if (st > 0) { show(n, st - 1, false); setTimeout(() => show(n, st, true), 60); }
    else { S.cur = -1; show(n, 0, true); }
  }
  function back() { if (S.ap) apStop(); if (S.step > 0) show(S.cur, S.step - 1, false); else if (S.cur > 0) show(S.cur - 1, S.scenes[S.cur - 1].steps - 1, false); }
  function notes() {
    if (!S.notesOn) return;
    const B = window.StoryBeats && window.StoryBeats.scenes && window.StoryBeats.scenes[S.cur + 1];
    S.notes.innerHTML = B ? `<b>Beat ${esc(B.beat)}</b> <span class="ln">${esc(B.line)}</span> <span class="ho">Hand-off: ${esc(B.handoff)}</span>` : '<span class="ln">No rehearsal line for this scene (js/beats.js).</span>';
  }
  function visible() { return !!S && S.el.isConnected && S.el.getClientRects().length > 0 && !S.el.closest("[hidden]"); }
  /* =====================================================================================================
     Autoplay (OPTIONAL). Team lead, 4:48 PM: "an automatic drive of our demo with a prerecorded voiceover narration"; 6:21 PM: "make it
     timed and animated and self driving so i can hit play the day of and it will just run". Unused, nothing changes.
     The manifest (narration/manifest.json) lists every step in order (one per press, plus "hold" steps that press nothing) and its
     stretches: "whole" (title to slide 7's closing screen) and "middle" (slides 3 to 5). A start begins the stretch whose first step is the
     current press (the title's Play control, or A on the title: the whole show) or the next press (A on slide 2's last press: the middle).
     Each step: make the press (with its motion), wait until the slide is ready for the voice (the step's voiceAfter seconds, or "settled"),
     play the clip and wait for it to END, wait until the slide's own motion has settled (with a ceiling), pause a beat, go on.
     A step with no clip, or a clip that fails, waits its dwell with its words as a caption. Keys while running: Space pauses and resumes;
     right arrow / Page Down skips a step; left arrow / Page Up / Escape stops and hands back manual control. Any other failure: manual, quietly.
     It stops on its stretch's last step and stays there. Settings: window.StoryBeats.autoplay (js/beats.js).
     ?autoplay=test prints the timing table; ?play=whole arms the whole show so the first key press or click starts it; Story.drive for scripts.
     ===================================================================================================== */
  const AP0 = { manifest: 'narration/manifest.json', key: 'a', beat: 0.7, voiceAfter: 1.0, readyMax: 8, captions: 'auto', starts: ['whole', 'middle'] };
  const apCfg = () => Object.assign({}, AP0, (window.StoryBeats && window.StoryBeats.autoplay) || {});
  const apNow = () => performance.now() / 1000;
  function apLoad() {
    if (!S.apManifest) S.apManifest = fetch(apCfg().manifest, { cache: 'no-store' }).then(r => { if (!r.ok) throw new Error('no manifest'); return r.json(); })
      .then(m => {
        const base = new URL(apCfg().manifest, location.href);
        let steps = (m.steps || []).filter(s => s && s.slide && s.press);
        if (!SHOW_EX()) { const gone = steps.filter(s => s.explainer && s.slide === 1).map(s => s.press); steps = steps.filter(s => !s.explainer);
          steps.forEach(s => { if (s.slide === 1 && m.explainerLayout) s.press -= gone.filter(g => g < s.press).length; }); }
        if (!SHOW_FP() && m.firePowerLayout) { const fp = (steps.find(s => s.firePower) || {}).press; steps = steps.filter(s => !s.firePower); steps.forEach(s => { if (s.slide === 3 && fp && s.press > fp) s.press -= 1; }); }
        if (window.StoryBeats && window.StoryBeats.showWalkthrough === false && m.walkLayout) { steps = steps.filter(s => !(s.slide === 4 && s.walk > 1)); const wn = m.walkCount || 7; steps.forEach(s => { if (s.slide === 4 && s.press > wn) s.press -= wn - 1; }); }
        steps.forEach((s, k) => { s.k = k; s.url = s.audio ? new URL(s.audio, base).href : null; s.wordsUrl = s.audio && s.clip ? new URL(s.clip + '.words.json', base).href : null; });
        const idx = id => { if (id == null) return -1; const st = String(id); return steps.findIndex(s => s.clip === st || (!s.hold && s.slide + '.' + s.press === st)); };
        const stretches = {};
        for (const [name, v] of Object.entries(m.stretches || {})) { const a = idx(v.from), b = idx(v.to); if (a >= 0 && b >= a) stretches[name] = { a, b }; }
        if (!Object.keys(stretches).length && steps.length) {      // an older manifest with one stretch (from / to)
          const a = idx(m.from), b = idx(m.to); stretches.middle = { a: a >= 0 ? a : 0, b: b >= 0 ? b : steps.length - 1 }; }
        return { steps, stretches };
      });
    return S.apManifest;
  }
  // the slide's own "settled" signal: no story animation running and the scene's change of place finished
  function apSettled() { const now = performance.now(), busy = S.busy && Object.keys(S.busy).some(k => S.busy[k] && S.busy[k] > now); return !busy && (performance.now() - (S.shownAt || 0)) > (S.still ? 250 : 1500); }
  function apUI() {
    if (S.apBar) return;
    S.apBar = document.createElement('div'); S.apBar.className = 'st-ap'; S.apBar.setAttribute('aria-hidden', 'true'); S.apBar.innerHTML = '<i></i>';
    S.apCap = document.createElement('p'); S.apCap.className = 'st-apcap'; S.apCap.setAttribute('aria-live', 'polite'); S.apCap.hidden = true;
    S.stage.appendChild(S.apBar); S.stage.appendChild(S.apCap);
    const sc = S.scenes[S.cur]; S.apCap.classList.toggle('side', !!(sc && sc.capSide && sc.capSide(S.step)));
  }
  function apProgress(f) { if (S.apBar) S.apBar.firstChild.style.width = (Math.max(0, Math.min(1, f)) * 100).toFixed(2) + '%'; }
  // a caption is shown in pieces of about two lines, each for its share of the clip (or of the dwell), following the step's progress
  function apChunks(text) { const parts = [], out = []; let cur = '';      // sentences; a sentence over 130 characters is cut after a comma or colon near its middle
    for (const sn of String(text || '').match(/[^.!?]+[.!?]+["”]?|[^.!?]+$/g) || []) { let t = sn.trim();
      while (t.length > 130) { const cut = [...t.matchAll(/[,:;] /g)].map(m => m.index + 1).filter(i => i > 40 && i < t.length - 30).sort((x, y) => Math.abs(x - t.length / 2) - Math.abs(y - t.length / 2))[0]; if (!cut) break; parts.push(t.slice(0, cut)); t = t.slice(cut).trim(); }
      parts.push(t); }
    for (const p0 of parts) { const p1 = p0.trim(); if (cur && (cur + " " + p1).length > 130) { out.push(cur); cur = p1; } else cur = cur ? cur + ' ' + p1 : p1; }
    if (cur) out.push(cur); return out; }
  function apCaption(text) { if (!S.apCap) return; const A = S.ap; if (A) { A.cap = text ? apChunks(text) : null; A.capAt = -1; } apCapTick(); }
  function apCapTick() {
    const A = S.ap, c = S.apCap; if (!c) return;
    if (A && A.cueAt != null && A.audio && A.audio.currentTime >= A.cueAt) { A.cueAt = null; apCue(); }
    if (!A || !A.cap || !A.cap.length) { c.hidden = true; c.textContent = ''; return; }
    const f = Math.max(0, Math.min(.999, A.prog ? A.prog() : 0)), words = A.cap.map(x => x.split(' ').length), all = words.reduce((a, b) => a + b, 0);
    let k = 0, acc = words[0]; while (k < A.cap.length - 1 && acc / all <= f) { k++; acc += words[k]; }
    if (k !== A.capAt) { A.capAt = k; c.innerHTML = '<span>' + esc(A.cap[k]) + '</span>'; }
    c.hidden = false;
  }
  function apCue() {      // the cue word is being spoken: a small pulse on what this press already shows
    const sec = S.secs[S.cur]; if (!sec) return; sec.classList.remove('st-cue'); void sec.offsetWidth; sec.classList.add('st-cue');
    setTimeout(() => sec.classList.remove('st-cue'), 1600);
  }
  function apLog(A, fields) { const L = A.log[A.i] || (A.log[A.i] = { step: A.i - A.from + 1, id: A.steps[A.i].clip || (A.steps[A.i].slide + '.' + A.steps[A.i].press) }); Object.assign(L, fields); window.__apLog = A.log.filter(Boolean); }
  function apStop(finished) {      // back to manual on the current press, with nothing left on screen
    const A = S.ap; if (!A) return; A.dead = true; S.ap = null;
    clearTimeout(A.timer); clearInterval(A.tick); if (A.audio) { try { A.audio.pause(); } catch (e) {} }
    if (A.holding && S.scenes[0].hold) { try { S.scenes[0].hold(false); } catch (e) {} }
    if (S.apBar) S.apBar.classList.remove('on'); apCaption(''); S.root.classList.remove('st-autoplay');
    window.__apDone = { finished: !!finished, at: apNow() - A.t0, steps: A.log.filter(Boolean) };
  }
  function apWait(A, sec, onDone) {      // a pausable wait
    A.left = sec * 1000; const total = A.left; A.resume = () => { A.t0w = performance.now(); A.going = true; A.timer = setTimeout(() => { A.resume = null; onDone(); }, A.left); };
    A.hold = () => { clearTimeout(A.timer); A.left -= performance.now() - A.t0w; A.going = false; };
    A.prog = () => total ? 1 - (A.left - (A.going ? performance.now() - A.t0w : 0)) / total : 1;
    A.resume();
  }
  function apUntil(A, test, max, onDone) {     // a pausable wait until test() is true, at most max seconds
    let spent = 0; const tick = () => { if (A.dead) return; if (test() || spent >= max) { onDone(spent >= max); return; } spent += .1; A.timer = setTimeout(tick, 100); };
    A.resume = tick; A.hold = () => clearTimeout(A.timer); tick();
  }
  function apStep(A, i) {
    if (A.dead) return;
    if (i > A.to) { apStop(true); return; }       // end of the stretch: stay on its last press
    A.i = i; const s = A.steps[i], n = s.slide - 1, st = s.press - 1, cfg = A.cfg;
    try {
      if (!S.scenes[n] || st >= S.scenes[n].steps) throw new Error('no such press ' + s.slide + '.' + s.press);
      if (S.cur !== n || S.step !== st) { S.apDriving = true; try { show(n, st, !S.still); } finally { S.apDriving = false; } }
      else if (!s.hold && i === A.from) S.shownAt = performance.now() - 2000;   // starting on the current press: it is already in place
    } catch (e) { apStop(); return; }
    apLog(A, { press: +(apNow() - A.t0).toFixed(2) });
    apProgress((i - A.from) / (A.to - A.from + 1)); A.prog = null; apCaption(''); A.cueAt = null;
    const after = () => {     // the clip (or dwell) is over: let the slide's own motion finish (ceiling), a beat, the next step
      if (A.dead) return; apLog(A, { clipEnd: +(apNow() - A.t0).toFixed(2) });
      if (s.hold && A.holding) { A.holding = false; try { S.scenes[0].hold(false); } catch (e) {} }
      A.prog = () => .999;
      const beat = s.beat != null ? +s.beat : cfg.beat, more = +s.holdAfter || 0;     // per step (narration/overrides.json): hold the picture longer, then the pause
      const tw = apNow(); apUntil(A, apSettled, cfg.readyMax, (late) => { apLog(A, { settleWait: +(apNow() - tw).toFixed(2), late: late ? Object.keys(S.busy || {}).filter(k => S.busy[k] > performance.now()).join(',') || 'scene' : undefined });
        apWait(A, more, () => apWait(A, beat, () => apStep(A, i + 1))); });
    };
    const play = () => {
      if (A.dead) return;
      if (S.cur !== n || S.step !== st) { apStop(); return; }       // something moved the story underneath: hand back
      apLog(A, { ready: +(apNow() - A.t0).toFixed(2) });
      if (s.hold && S.scenes[0].hold) { try { S.scenes[0].hold(true); A.holding = true; } catch (e) {} }
      const dwell = () => { if (A.dead) return; A.audio = null; apLog(A, { clipStart: +(apNow() - A.t0).toFixed(2), kind: 'dwell', length: +s.dwell || 8 });
        apCaption(cfg.captions === 'off' ? '' : s.text); apWait(A, +s.dwell || 8, after); };
      const au = s.url && A.clips[i];
      if (!au || au.failed || A.test) {
        if (A.test) { A.report.push({ i, at: s.clip || (s.slide + '.' + s.press), clip: au && isFinite(au.duration) && !au.failed ? au.duration : null, dwell: +s.dwell || 8, voiceAfter: s.voiceAfter });
          apLog(A, { clipStart: +(apNow() - A.t0).toFixed(2), kind: 'test' }); apWait(A, 0.05, () => { if (s.hold && A.holding) { A.holding = false; S.scenes[0].hold(false); } apStep(A, i + 1); }); return; }
        dwell(); return;
      }
      A.audio = au; A.prog = () => isFinite(au.duration) && au.duration ? au.currentTime / au.duration : 0; apCaption(cfg.captions === 'on' || S.capForce ? s.text : '');
      A.cueAt = A.cues[i] != null ? A.cues[i] : null;
      au.onplaying = () => { (window.__apPlayed = window.__apPlayed || []).push(s.clip || s.slide + '.' + s.press); apLog(A, { clipStart: +(apNow() - A.t0).toFixed(2), kind: 'clip', length: +au.duration.toFixed(2) }); au.onplaying = null; };
      au.currentTime = 0; au.onended = after; au.onerror = () => { au.failed = true; dwell(); };
      au.ontimeupdate = () => { if (isFinite(au.duration) && au.duration) apProgress((i - A.from + au.currentTime / au.duration) / (A.to - A.from + 1)); };
      A.resume = () => { au.play().catch(() => { au.failed = true; dwell(); }); }; A.hold = () => au.pause();
      A.resume();
    };
    // when the voice starts: "settled" waits for the slide's own motion (ceiling readyMax); a number starts it that many seconds after the press
    const va = s.voiceAfter != null ? s.voiceAfter : cfg.voiceAfter;
    if (va === 'settled') apUntil(A, apSettled, cfg.readyMax, play); else apWait(A, Math.max(0, +va || 0), play);
  }
  // which stretch a start begins from where the story is now: one whose first step is this press, or the next press
  const WHOLE = () => !(window.StoryBeats && window.StoryBeats.wholeShow === false);
  // where A may start the middle: the song screen (the last press of slide 1) or the first technical screen (slide 2's first press)
  const atMiddleStart = () => !!S && ((S.cur === 0 && S.step === S.scenes[0].steps - 1) || (S.cur === 1 && S.step === 0));
  function apPick(M, only) {
    const here = { n: S.cur, st: S.step }, sc = S.scenes[S.cur];
    const nxt = S.step < sc.steps - 1 ? { n: S.cur, st: S.step + 1 } : { n: S.cur + 1, st: 0 };
    const is = (s, p) => s && !s.hold && s.slide - 1 === p.n && s.press - 1 === p.st;
    for (const name of (only ? [only] : apCfg().starts)) { const r = M.stretches[name]; if (!r) continue; const s = M.steps[r.a];
      if (is(s, here) || is(s, nxt)) return { name, a: r.a, b: r.b }; }
    return null;
  }
  function apStart(opt) {
    if (S.ap) return;
    const test = opt === 'test', cfg = apCfg();
    apLoad().then(M => {
      if (!M.steps.length) return;
      let pick;
      if (test) { const r = M.stretches[new URLSearchParams(location.search).get('stretch') || 'whole'] || Object.values(M.stretches)[0]; pick = { name: 'test', a: r.a, b: r.b }; }
      else if (opt && opt.force) { const r = M.stretches[opt.force]; if (!r) return; S.apDriving = true; try { show(M.steps[r.a].slide - 1, M.steps[r.a].press - 1, false); } finally { S.apDriving = false; } pick = { name: opt.force, a: r.a, b: r.b }; }
      else pick = apPick(M, opt && opt.only);
      if (!pick) return;                                             // not at the start of a stretch: the key does nothing
      apUI();
      const A = S.ap = { steps: M.steps, from: pick.a, to: pick.b, name: pick.name, cfg, test, clips: [], cues: [], report: [], log: [], dead: false, t0: apNow() };
      // load the stretch's clips now, so there is no gap between steps (a missing file just marks its step as "dwell"); and word times, if any
      for (let k = pick.a; k <= pick.b; k++) { const s = M.steps[k]; if (!s.url) continue; const au = new Audio(); au.preload = 'auto'; au.src = s.url; au.onerror = () => { au.failed = true; }; au.load(); A.clips[k] = au;
        if (s.cue && s.wordsUrl) fetch(s.wordsUrl).then(r => r.ok ? r.json() : null).then(w => { const list = Array.isArray(w) ? w : w && (w.words || w.marks); if (!list) return;
          const norm = x => String(x || '').toLowerCase().replace(/[^a-z0-9]/g, ''), hit = list.find(x => norm(x.word || x.value) === norm(s.cue));
          if (hit) A.cues[k] = +(hit.start != null ? hit.start : hit.time / 1000); }).catch(() => {}); }
      S.apBar.classList.add('on'); S.root.classList.add('st-autoplay'); apProgress(0);
      A.tick = setInterval(() => { if (A.dead) clearInterval(A.tick); else apCapTick(); }, 150);
      if (test) { const chk = setInterval(() => { if (A.dead) { clearInterval(chk); apTestReport(A); } }, 200); }
      apStep(A, pick.a);
    }).catch(() => {});
  }
  function apTestReport(A) {
    const beat = A.cfg.beat, rows = A.report.map(r => { const va = r.voiceAfter === 'settled' ? 1.5 : r.voiceAfter != null ? +r.voiceAfter : A.cfg.voiceAfter, body = r.clip != null ? r.clip : r.dwell;
      return { at: r.at, clip: r.clip == null ? null : +r.clip.toFixed(2), dwell: r.dwell, voiceAfter: va, total: +(va + body + beat).toFixed(2) }; });
    const total = rows.reduce((a, r) => a + r.total, 0);
    const text = 'step  id         clip s  (dwell s)  voice at  total s\n' + rows.map((r, k) => `${String(k + 1).padStart(4)}  ${r.at.padEnd(9)}  ${(r.clip == null ? '-' : r.clip.toFixed(1)).padStart(6)}  ${('(' + r.dwell + ')').padStart(9)}  ${r.voiceAfter.toFixed(1).padStart(8)}  ${r.total.toFixed(1).padStart(7)}`).join('\n') +
      `\nwhole stretch: ${total.toFixed(1)} s (${Math.floor(total / 60)} min ${Math.round(total % 60)} s); beat after each step ${beat} s; a slow animation can add up to ${A.cfg.readyMax} s at a step`;
    window.__autoplayReport = { rows, total, text };
    try { console.log('[autoplay test]\n' + text); } catch (e) {}
    let pre = document.querySelector('.st-aptest'); if (!pre) { pre = document.createElement('pre'); pre.className = 'st-aptest'; S.stage.appendChild(pre); }
    pre.textContent = text;
  }
  function apKey(e) {         // true when autoplay took the key
    const k = e.key, cfg = apCfg();
    if (!S.ap) {
      if (S.armWhole && WHOLE() && !e.repeat && !['Shift', 'Control', 'Alt', 'Meta'].includes(k)) { e.preventDefault(); S.armWhole = false; apStart({ force: 'whole' }); return true; }
      if (k && k.toLowerCase() === String(cfg.key).toLowerCase() && !e.repeat) { e.preventDefault();
        if (atMiddleStart()) apStart({ force: 'middle' });                     // the song screen or the first technical screen (12:09 PM)
        else if (WHOLE() && S.cur === 0 && S.step === 0) apStart({ force: 'whole' });   // the title only, and only with wholeShow on
        return true; }
      return false;
    }
    const A = S.ap;
    if (k === ' ' || k === 'Spacebar') { e.preventDefault(); if (A.paused) { A.paused = false; if (A.resume) A.resume(); } else { A.paused = true; if (A.hold) A.hold(); } return true; }
    if (k === 'ArrowRight' || k === 'PageDown') { e.preventDefault(); clearTimeout(A.timer); if (A.audio) { A.audio.onended = null; A.audio.pause(); }
      if (A.holding) { A.holding = false; try { S.scenes[0].hold(false); } catch (x) {} } A.paused = false; apCaption(''); apStep(A, A.i + 1); return true; }
    if (k === 'ArrowLeft' || k === 'PageUp' || k === 'Escape') { e.preventDefault(); apStop(); return true; }
    if (k === 'c' || k === 'C') { e.preventDefault(); S.capForce = !S.capForce; const st = A.steps[A.i];      // the words as captions, for a room whose sound fails
      if (A.audio && st) { const p = A.prog; apCaption(S.capForce || cfg.captions === 'on' ? st.text : ''); A.prog = p; } return true; }
    e.preventDefault(); return true;       // every other key is ignored while it runs
  }

  function onKey(e) {
    if (!visible() || e.ctrlKey || e.metaKey || e.altKey) return;
    const t = e.target, tag = t && t.tagName;
    if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || (t && t.isContentEditable)) return;
    if (apKey(e)) return;          // autoplay: its own key to start; while it runs, it owns the keys
    if ((e.key === 's' || e.key === 'S') && S.cur === 0 && S.scenes[0].hold) { e.preventDefault(); if (!e.repeat) S.scenes[0].hold(true); return; }
    if (S.num && !S.num.hidden) {        // the Numbers panel is open: N or Escape closes it; nothing else moves the story
      if (e.key === 'Escape' || e.key === 'n' || e.key === 'N') { e.preventDefault(); numbers(false); }
      return;
    }
    if ((e.key === 'n' || e.key === 'N') && !S.numBtn.hidden) { e.preventDefault(); numbers(true); return; }
    if ((e.key === 'r' || e.key === 'R') && !e.repeat) { e.preventDefault(); replay(); return; }
    if (tag === 'BUTTON' && (e.key === ' ' || e.key === 'Enter')) return;   // a focused button does its own job
    if (tag === 'A' && e.key === 'Enter') return;
    if (e.key === ' ' || e.key === 'ArrowRight' || e.key === 'PageDown') { e.preventDefault(); next(); }
    else if (e.key === 'ArrowLeft' || e.key === 'PageUp') { e.preventDefault(); back(); }
    else if (e.key === 'Home') { e.preventDefault(); show(0, 0, true); }
    else if (e.key === 'End') { e.preventDefault(); show(NUM - 1, 0, true); }
    else if (e.key === 'w' || e.key === 'W') { e.preventDefault(); if (S.cur === N - 1) show(NUM - 1, S.scenes[NUM - 1].steps - 1, true); else show(S.cur >= NUM ? S.cur + 1 : NUM, 0, true); }   // the wild cards, after the end
  }
  function onKeyUp(e) { if (S && (e.key === 's' || e.key === 'S') && S.cur === 0 && S.scenes[0].hold) S.scenes[0].hold(false); }

  function mount(el, ctx) {
    if (S) { clearInterval(S.aiT); document.removeEventListener('keydown', onKey); document.removeEventListener('keyup', onKeyUp); if (S.ro) S.ro.disconnect(); Object.values(S.raf).forEach(cancelAnimationFrame); }
    const q = new URLSearchParams(location.search);
    // Act 1's type, as the Fire Detectives site links it (Fredoka, Lexend, JetBrains Mono); with no network the fallback stacks in story.css still read well
    if (!document.querySelector('link[data-fd-fonts]')) { const lk = document.createElement('link'); lk.rel = 'stylesheet'; lk.dataset.fdFonts = '1';
      lk.href = 'https://fonts.googleapis.com/css2?family=Fredoka:wght@500;600;700&family=Lexend:wght@400;500;600&family=JetBrains+Mono:wght@500&display=swap'; document.head.appendChild(lk); }
    const still = ctx.still === true || q.get('still') === '1' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
    if (SHOW_EX() && ALT[0].length === 3) ALT[0] = [0, .015, .045, .07, .09, .09];
    if (!(window.StoryBeats && window.StoryBeats.showChallenge === false) && ALT[0].length === 6) ALT[0] = [0, 0, .015, .045, .07, .09, .09];
    if (!(window.StoryBeats && window.StoryBeats.showSong === false) && ALT[0].length === 7) ALT[0] = ALT[0].concat([0]);      // the song: back in the title's daylight   // the challenge screen keeps the title's daylight
      // the explainer press sits in the daylight, just after the title
    S = { el, ctx, slow: Math.max(1, +q.get('slowmo') || 1), cur: -1, step: 0, still, port: null, scale: 1, raf: {}, holding: false, notesOn: ctx.notes === true || q.get('notes') === '1' };
    el.innerHTML = `<div class="st-root st-land${still ? ' st-still' : ''}">
      <div class="st-viewport"><div class="st-stage">
        <div class="st-sky" aria-hidden="true"><div class="sky-dots"></div><div class="sky-stars">${starsSVG()}</div><div class="sky-glow"></div>
          <div class="sky-ground">${HORIZON}</div><div class="sky-clouds"><span class="cl"></span><span class="cl"></span><span class="cl"></span><span class="cl"></span></div><div class="sky-earth"></div><div class="sky-screen"></div><div class="sky-desk"></div></div>
        ${Array.from({ length: N }, (_, i) => `<section class="st-scene" data-scene="${i + 1}" aria-hidden="true"></section>`).join('')}
        <nav class="st-chrome" aria-label="Scenes">
          <span class="st-counter" aria-hidden="true"></span><span class="st-click" aria-hidden="true"></span>
          <span class="st-dots">${Array.from({ length: N }, (_, i) => `<button type="button" class="st-dot${i >= NUM ? ' extra' : ''}" data-noclick aria-label="${i < NUM ? 'Scene ' + (i + 1) : 'Extra'}"></button>`).join('')}</span>
          <span class="st-arrows"><button type="button" class="st-btn st-numbtn" data-noclick aria-label="Numbers: the plotted values as a table" aria-keyshortcuts="N" aria-expanded="false" hidden>▦ <span class="st-lbl">Numbers</span></button><button type="button" class="st-btn st-pmid" data-noclick aria-label="Play the recorded middle" aria-keyshortcuts="A" hidden>▶ play the middle</button><button type="button" class="st-btn st-replay" data-noclick aria-label="Replay this screen's animation" aria-keyshortcuts="R" title="Replay (R)">↻</button><button type="button" class="st-btn st-back" data-noclick aria-label="Back">← <span class="st-lbl">Back</span></button><button type="button" class="st-btn primary st-next" data-noclick aria-label="Next"><span class="st-lbl">Next </span>→</button></span>
        </nav>
        <div class="st-num" role="dialog" aria-label="The plotted values" data-noclick hidden><div class="st-num-head"><b></b><button type="button" class="st-btn st-num-close" data-noclick>Close ✕</button></div><div class="st-num-body"></div></div>
        <p class="st-live" aria-live="polite"></p>
        <p class="st-aimark" hidden>${AI_TEXT}</p>
      </div></div>
      <div class="st-notes" ${S.notesOn ? '' : 'hidden'}></div></div>`;
    S.root = el.querySelector('.st-root'); setCams(S.cams || CAM0);
    S.slotDebug = q.get('slots') === '1'; if (S.slotDebug) S.root.classList.add('st-slotdbg'); S.viewport = el.querySelector('.st-viewport'); S.stage = el.querySelector('.st-stage');
    S.secs = [...el.querySelectorAll('.st-scene')]; S.notes = el.querySelector('.st-notes'); S.live = el.querySelector('.st-live');
    S.numBtn = el.querySelector('.st-numbtn'); S.aiMark = el.querySelector('.st-aimark'); S.aiT = setInterval(aiMark, 400);  /* the mark follows the screen through a lift-off or a landing */ S.num = el.querySelector('.st-num');
    S.counter = el.querySelector('.st-counter'); S.dots = [...el.querySelectorAll('.st-dot')]; S.back = el.querySelector('.st-back'); S.next = el.querySelector('.st-next'); S.click = el.querySelector('.st-click');
    const endA = ENDING_A(); if (endA) endingSetup();
    const B5 = window.StoryBeats || {};
    // the order of 9:19 AM: slide 5 = what one scale changes (the country charts), slide 6 = the connector, slide 7 = the volunteer page, then the
    // final screen. StoryBeats.order = 'v7' brings back the 9:02 AM order (connector before the charts, "three ways" before the final screen).
    const V8 = B5.order !== 'v7' && B5.showMapSlide !== true; ROOM0 = V8 ? 4 : 5;
    const WA = B5.showWorldAnswer === true || !V8;
    const charts = endingScene([['stitched', 1], ['oneScale', 1]].concat(WA ? [['world', 0]] : []), V8 ? 'What one scale changes' : "It isn't just Argentina"), conn = V8 && B5.showCalendarScreen !== false ? slide6cal() : endingScene([['connector', 0]], 'Ask it yourself');
    const last = V8 && B5.showThreeWays !== true ? slide7v() : endingScene([['threeWays', StoryEnding.steps('threeWays') - 1], ['final', 0]], 'How do I use it?');
    S.scenes = endA ? [scene1(), scene2(), scene3(), B5.showMapSlide === true ? scene4() : scene4R(),
      B5.showMapSlide === true ? scene5A() : V8 ? charts : conn, V8 ? conn : charts, last, wild1(), wild2(), extraFirePower(), endingScene([['world', 0]], 'Is the world burning more than it used to?')]
      : [scene1(), scene2(), scene3(), scene4(), scene5(), scene6(), scene7(), wild1(), wild2(), extraFirePower(), extraFirePower()];
    S.clicks = S.scenes.slice(0, NUM).reduce((a, sc) => a + sc.steps, 0);
    if (!SHOW_EX() && S.scenes[0].steps === 5) ALT[0] = [0, 0, .045, .09, 0];      // 1:46 PM opening: title, challenge, Moe, Vee, then the song back in daylight
    { const k3 = S.scenes[2].steps; ALT[2] = Array.from({ length: k3 }, (_, i) => +(.31 + (.64 - .31) * i / Math.max(1, k3 - 1)).toFixed(3)); }   // slide 3's climb, whatever its press count      // presses from the title to the final screen (the live script's clicks)
    if (endA) { const k = S.scenes[4].steps; ALT[4] = Array.from({ length: k }, (_, i) => i === k - 1 ? .84 : .87 + .02 * i / Math.max(1, k - 2)); delete DESK['4:2']; DESK['4:' + (k - 1)] = .35; ACTS[5] = [3, 'Act 3 · What it shows']; if (ROOM0 === 4) { ACTS[4] = [3, 'Act 3 · What it shows']; ACTS[5] = [3, 'Act 3 · What we built']; ALT[4] = [1]; DESK[4] = 1; delete DESK['4:' + (k - 1)]; } }
    S.scenes.forEach((sc, i) => {
      S.secs[i].classList.add(...sc.cls.split(" ")); S.secs[i].dataset.steps = sc.steps; if (sc.wide) S.secs[i].classList.add('wide');
      S.secs[i].setAttribute('aria-label', 'Scene ' + (i + 1) + ': ' + sc.title);
      S.dots[i].setAttribute('aria-label', (i < NUM ? 'Scene ' + (i + 1) : 'Extra') + ': ' + sc.title);
      try { sc.build(S.secs[i]); } catch (e) { S.secs[i].innerHTML = nothing('this scene could not be built: ' + e.message); sc.layout = sc.enter = sc.step = () => {}; }
      S.secs[i].classList.add('act' + ACTS[i][0]);
      S.secs[i].insertAdjacentHTML('afterbegin', `<p class="st-act" aria-hidden="true">${esc(ACTS[i][1])}</p>`);   // where the room is: the act, in the corner
    });
    S.dots.forEach((b, i) => b.addEventListener('click', ev => { ev.stopPropagation(); if (S.ap) apStop(); show(i, 0, true); }));
    S.back.addEventListener('click', ev => { ev.stopPropagation(); back(); });
    S.el.querySelector('.st-replay').addEventListener('click', ev => { ev.stopPropagation(); replay(); });
    S.pmid = S.el.querySelector('.st-pmid'); S.pmid.addEventListener('click', ev => { ev.stopPropagation(); if (!S.ap && atMiddleStart()) apStart({ force: 'middle' }); });
    S.numBtn.addEventListener('click', ev => { ev.stopPropagation(); numbers(S.num.hidden); });
    el.querySelector('.st-num-close').addEventListener('click', ev => { ev.stopPropagation(); numbers(false); });
    S.next.addEventListener('click', ev => { ev.stopPropagation(); next(); });
    S.stage.addEventListener('click', ev => {     // a click or tap on the stage moves forward, except on controls and text being selected
      if (S.armWhole && WHOLE() && !S.ap) { S.armWhole = false; apStart({ force: 'whole' }); return; }
      if (S.ap) return;
      if (ev.target.closest('button,a,input,select,textarea,[data-noclick],table')) return;
      const sel = window.getSelection && String(window.getSelection()); if (sel) return;
      next();
    });
    document.addEventListener('keydown', onKey); document.addEventListener('keyup', onKeyUp);
    loadArt();
    window.addEventListener('blur', () => { if (S && S.holding) S.scenes[0].hold(false); });
    if (typeof ResizeObserver !== 'undefined') { S.ro = new ResizeObserver(fit); S.ro.observe(el); if (el.parentElement) S.ro.observe(el.parentElement); }
    window.addEventListener('resize', fit); setTimeout(fit, 400); setTimeout(fit, 1500);   // bars above the story may arrive after it mounts
    fit();
    const m = /^#story\/(\d)/.exec(location.hash);
    show(m ? +m[1] - 1 : 0, 0, !still);
    if (q.get('autoplay') === 'test') setTimeout(() => apStart('test'), 1500);   // the timing report
    if (q.get('play') === 'whole') S.armWhole = true;                            // the first key press or click anywhere starts the whole show
    apLoad().then(M => { if (M.stretches.whole) S.root.classList.add('st-has-show'); }).catch(() => {});
  }
  function go(n) { if (!S) return; show((+n || 1) - 1, 0, !S.still); }

  // for an outside script (a page recorder): drive the stretch press by press with no sound. Story.drive.steps() lists the manifest's
  // steps; Story.drive.to(slide, press) shows that press and resolves, with the seconds it waited, once the settle time has passed.
  const drive = {
    steps: () => S ? apLoad().then(M => M.steps.map(x => ({ slide: x.slide, press: x.press, hold: !!x.hold, clip: x.clip || null, audio: x.audio || null, cue: x.cue || null, text: x.text, dwell: x.dwell, voiceAfter: x.voiceAfter }))) : Promise.resolve([]),
    to: (slide, press) => new Promise((ok, no) => { if (!S || !S.scenes[slide - 1] || press < 1 || press > S.scenes[slide - 1].steps) { no(new Error('no such press')); return; }
      const t0 = performance.now(); S.apDriving = true; try { show(slide - 1, press - 1, !S.still); } finally { S.apDriving = false; }
      const wait = () => (apSettled() || performance.now() - t0 > apCfg().readyMax * 1000) ? ok({ slide, press, settled: (performance.now() - t0) / 1000 }) : setTimeout(wait, 100); setTimeout(wait, 100); }),
    stop: () => { if (S) apStop(); }
  };
  window.Story = { mount, go, count: N, slides: NUM, clicks: () => S ? S.clicks : null, drive, _fallback: slotFallback, _busy: () => S && Object.assign({}, S.busy) };
})();
