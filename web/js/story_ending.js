/* Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md. */
/* story_ending.js: the new ending of the story (Ending A, ruled by the team lead at 9:38 PM): five screens, self-contained, for the story to wire in.
 Ending builder, night of Nov 14, 2026. Wiring: SUNDAY/review/ENDING_BUILD_NOTES.md.

   window.StoryEnding = {
     load(url?)                    -> Promise of the data (data/ending_table.json, built by tools/build_ending_table.cjs; no number is typed here)
     yardstick(el, data, step)     screen 1, for s5_p1      (steps: 0 the bars, 1 zoom in, 2 every busy country as a dot; 2 can be switched off)
     stitched(el, data, step)      screen 2, for s6_p1      (steps: 0 the charts as the record comes, 1 the record years flagged and the count)
     oneScale(el, data, step)      screen 3, for s6_p2      (steps: 0 the same charts settle onto one scale, 1 false records struck, Canada stands)
     threeWays(el, data, step)     screen 4, for s7_p1      (steps: 0 the page, 1 draw an area, 2 ask your own AI; each card arrives in turn)
     final(el, data, step)         screen 5, for s7_p2      (one step)
     connector(el, data, step)     what happens when you ask it something (step 0 plays about 13 s by itself, step 1 settled)
     world(el, data, step)         screen 3b, for s6_p3     (one step: back to the opening question, the record on one scale)
     press(el, step)               redraw whatever screen el holds at another step (animated unless reduced motion or settings.still)
     steps(name)                   how many steps a screen has under the current settings
     settings                      switches (see SETTINGS below); configure(obj) merges into them and redraws nothing
     text(data)                    every number-bearing string the screens print, for tools/check_ending.cjs
     stop(el)                      stop any timers a screen started (the prototype frames, the chat); call when leaving the screen
   }
   Each render takes a container element (it fills it: give it a size; the class se-host does position:absolute;inset:0) and draws in STAGE
   pixels: 1920 x 1080 when the container is wide, a single column when it is narrower than 1100 px (the story's 720-wide phone stage).
   Plain browser JavaScript, no packages, no network beyond the files named here. */
(function () {
  'use strict';
  const SETTINGS = {
    still: false,                 // true: no motion at all (reduced motion turns motion off by itself)
    yardstickWorld: true,         // screen 1's third step: every busy country as a dot on the zoomed ruler; false = two steps
    showDrawCard: true,
    showVolunteerCard: true,      // the volunteer page as a way to explore (redline 8:58 AM: it is live; the draw card is a prototype and goes)           // screen 4's prototype card (draw an area); false = two cards, two steps
    showPageCapture: true,        // screen 4's first card: the phone captures of the page
    pageUrl: '',                  // empty in the code (the public copy must not carry the address); the story passes the laptop's from js/beats.js
    connectorUrl: '',             // (local/addresses.js); empty, the QR code and its short label stand alone
    repoUrl: null,                // the public repository: null or '' hides its QR code and address on the final screen
    repoQr: 'img/qr/repo.svg',    // its QR code (make it: python -I SUNDAY/tools/make_qr.py repo=<the address> ; copy repo.svg here)
    pageQr: 'img/qr/page.svg', connectorQr: 'img/qr/connector.svg',
    showConnectorQr: true,
    // the final screen's third slot (orchestrator, 8:40 AM): the volunteer page, live. Its QR code always shows; its typed address only where
    // one is passed in (this laptop, from local/addresses.js), never in the public copy
    volunteerQr: 'img/qr/volunteer.svg', volunteerUrl: '', volunteerLabel: 'Fire, or something else?',        // final screen: the connector's QR code beside its address
    teamName: 'Spark Squad',
    closingLine: 'Before you trust a fire record, check the camera.',
    art: { older: 'img/characters/art_older_idle_20261114-120850.webp', newer: 'img/characters/art_newer_idle_20261114-141023.webp',
      both: 'img/characters/art_both_together_20261114-141029.webp', olderSign: 'img/characters/art_older_sign_20261114-120850.webp', newerSign: 'img/characters/art_newer_sign_20261114-141028.webp' },
    names: { older: 'Moe', newer: 'Vee' },
    frameMs: 1300                 // the prototype's still frames: how long each stays up
  };
  const S = Object.assign({}, SETTINGS, window.StoryEndingSettings || {});
  const reduced = () => S.still || (window.matchMedia && window.matchMedia('(prefers-reduced-motion: reduce)').matches);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const fmt = v => v == null ? 'no data' : Math.round(v).toLocaleString('en-US');
  const half = v => (Math.round(v * 2) / 2).toString();             // 3.456 -> "3.5"
  const pct = v => Math.round(v) + '%';
  const ease = t => 1 - Math.pow(1 - t, 3);
  const addrHTML = u => esc(u).replace(/\//g, '/<wbr>');     // an address breaks only after a slash
  const noScheme = u => String(u || '').replace(/^https?:\/\//, '').replace(/\/$/, '');
  const portOf = el => (el.clientWidth || 1920) < 1100;

  /* ---------------- the strings (every number on screen comes from here, so the check can read them) ---------------- */
  function text(d) {
    const y = d.yardstick, w = y.world, r = d.records, n = S.names;
    const times = half(y.untranslated_times), over = Math.round((y.untranslated_times - 1) * 100);
    return {
      y_eyebrow: 'What the translation did · Argentina, a typical month',
      y_eyebrow2: `What the translation did · all ${w.n} countries with a lot of fire`,
      y_h0: `Just stitched together, ${n.newer} reads <em>${times} times</em> as high as ${n.older}.`,
      y_h1: `Translated, a typical month lands within <em>about ${pct(y.translated_pct)}</em>.`,
      y_h2: `Every country with a lot of fire: all ${w.n} within 25%.`,
      y_unit: `fire detections in a typical month, ${n.older}'s count = 1`,
      y_g: [{ cap: 'Just stitched together', lab: `about ${times} times as high` },
        { cap: 'Our translation, tested on a year it was not built from', lab: `within about ${pct(y.translated_pct)}` },
        { cap: 'Two copies of the same camera, compared directly', lab: `about ${pct(y.same_camera_pct)} apart` }],
      y_ruler: 'How far off, in a typical month',
      y_rows: [{ cap: 'Two copies of the same camera', v: y.same_camera_pct, lab: pct(y.same_camera_pct) },
        { cap: 'Our translation', v: y.translated_pct, lab: pct(y.translated_pct) },
        { cap: 'Just stitched together', v: over, lab: `${over}%: off this ruler ${Math.round(over / 30)} times over` }],
      y_floor: 'even twin cameras differ this much',
      y_world: `Each dot is one of the ${w.n} countries with a lot of fire. Just stitched together, every one is ${half(w.untranslated_times_min)} to ${half(w.untranslated_times_max)} times as high: off the ruler.`,
      y_alt0: `Bars, Argentina, a typical month, with the older camera's count as 1: just stitched together the newer camera reads ${y.untranslated_times.toFixed(2)}; translated, a typical month is within ${y.translated_pct.toFixed(1)}%; two copies of the same camera differ by ${y.same_camera_pct.toFixed(1)}%.`,
      s_eyebrow: 'It isn\'t just Argentina · the record as it comes',
      s_h0: 'Stitch the two cameras together, country by country.',
      s_h1: `<b>${r.stitched_after_2021} of ${r.testable}</b> countries with a lot of fire show their biggest year after 2021 when the two cameras are stitched together.`,
      o_eyebrow: 'It isn\'t just Argentina · the same charts on one scale',
      o_h0: `On one scale, only <b>${r.one_scale_after_2021}</b> do.`,
      o_h1: `On one scale, only <b>${r.one_scale_after_2021}</b> do. The older camera alone says <b>${r.older_alone_after_2021}</b>.`,
      m_small: `Whole years with the older camera's own count, 2003 to 2025. ${r.untestable.length ? cap(numWord(r.untestable.length)) + ' more busy countries have too few whole years to test.' : ''}`,
      m_unit: 'fire detections a year',
      w_eyebrow: 'Back to the question · on one scale',
      w_h: 'Is the world burning more than it used to?',
      w_unit: 'fire detections a year, counted the same way throughout; not land burned',
      w_line: 'No increase since the early 2000s. The last five years average a little lower.',
      w_small: d.world ? `${d.world.countries} countries, busy or quiet, with a whole record every year, ${d.world.years[0]} to ${d.world.years[d.world.years.length - 1]}.` : '',
      c_h: 'Ask your own AI. It asks our record.',
      c_line: 'It answers from the record, and says so when the record is weak.',
      t_eyebrow: 'Try it yourself',
      t_h: 'Three ways to use it.',
      f_line: S.closingLine, f_team: S.teamName,
      ...(d.textOverride || {})       // the story's historyScale 'vee' pencil swaps a few headline words
    };
  }
  // two tones per bar (d.twoTone, set by the story when the long record is shown on Vee's scale): before 2022, the lower part is what Moe
  // counted and the upper part, hatched in a light tone of Vee's color, is what the translation adds; from 2022, Vee's own count, solid.
  // The added part differs by pattern AND lightness, not by hue alone.
  const HATCH = `<defs><pattern id="se-hatch" width="6" height="6" patternUnits="userSpaceOnUse" patternTransform="rotate(45)"><rect width="6" height="6" class="se-addbg"/><line x1="0" y1="0" x2="0" y2="6" class="se-addln"/></pattern></defs>`;
  const ttKey = names => `<span class="se-tt"><i class="sw m"></i>what ${esc(names.older)} counted</span><span class="se-tt"><i class="sw a"></i>added: what ${esc(names.newer)} would likely have seen</span><span class="se-tt"><i class="sw v"></i>what ${esc(names.newer)} counted</span>`;
  const NUMW = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve'];
  const numWord = k => NUMW[k] || String(k);
  const cap = s => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  /* ---------------- shared pieces ---------------- */
  const art = (src, cls, alt) => `<img class="se-art ${cls || ''}" src="${esc(src)}" alt="${esc(alt || '')}" draggable="false">`;
  function head(eyebrow, hs, step) {     // eyebrow: a string, or [[text, steps], ...] to change with the step
    const eb = Array.isArray(eyebrow) ? `<div class="se-swap">${eyebrow.map(e => `<p class="se-eyebrow se-only" data-on="${e[1]}">${esc(e[0])}</p>`).join('')}</div>` : `<p class="se-eyebrow">${esc(eyebrow)}</p>`;
    return `<header class="se-head">${eb}<div class="se-swap">${hs.map((h, i) => `<h2 class="se-h se-only" data-on="${Array.isArray(h) ? h[1] : i}">${Array.isArray(h) ? h[0] : h}</h2>`).join('')}</div></header>`;
  }
  // show the step: .se-only[data-on="02"] is on at steps 0 and 2; .se-from[data-at="1"] is on from step 1
  function applyStep(root, step) {
    root.dataset.step = step;
    root.querySelectorAll('.se-only').forEach(e => { const on = String(e.dataset.on).split('').map(Number).includes(step); e.classList.toggle('on', on); e.setAttribute('aria-hidden', String(!on)); });
    root.querySelectorAll('.se-from').forEach(e => { const on = +e.dataset.at <= step; e.classList.toggle('on', on); e.setAttribute('aria-hidden', String(!on)); });
  }
  function base(el, name, d, step, build) {
    const port = portOf(el), key = name + (port ? ':p' : ':l');
    let root = el.querySelector(':scope > .se');
    const fresh = !root || root.dataset.key !== key || root.__data !== d;
    if (fresh && root && root.dataset.name === name && root.dataset.port === String(port) && root.__data === d) { /* same */ }
    if (fresh) {
      stop(el);
      el.innerHTML = `<div class="se se-${name}${port ? ' se-port' : ' se-land'}${reduced() ? ' se-still' : ''}" data-name="${name}" data-key="${key}" data-port="${port}"></div>`;
      root = el.firstChild; root.__data = d; el.__se = { name, d };
      build(root, port);
    }
    return { root, fresh, port };
  }

  /* =====================================================================================================
     Screen 1. THE YARDSTICK (s5_p1). Step 0: three pairs of bars on one honest linear scale (the stitched bar is as tall as it really is).
     Step 1: zoom in: a ruler from 0% to 30%; the stitched bar runs off its end with a break mark. Step 2 (optional): all busy countries as dots.
     ===================================================================================================== */
  function yardstick(el, d, step) {
    step = clampStep('yardstick', step);
    const T = text(d), y = d.yardstick;
    const { root, fresh, port } = base(el, 'yardstick', d, step, (root, port) => {
      const hs = [T.y_h0, T.y_h1]; if (S.yardstickWorld) hs.push(T.y_h2);
      root.innerHTML = head(S.yardstickWorld ? [[T.y_eyebrow, '01'], [T.y_eyebrow2, '2']] : T.y_eyebrow, hs) + `<div class="se-body se-yard"><div class="se-yv se-only" data-on="0">${yBars(T, y, port)}</div>
        <div class="se-yv se-only" data-on="${S.yardstickWorld ? '12' : '1'}">${yRuler(T, y, d, port)}</div></div>`;
    });
    applyStep(root, step);
    root.querySelector('.se-yard').classList.toggle('se-world', step === 2);
    return root;
  }
  function yBars(T, y, port) {
    const W = port ? 640 : 1640, H = port ? 800 : 680, top = port ? 150 : 64, bot = port ? 210 : 170, gw = W / 3;
    const unit = (H - top - bot) / Math.max(3.6, y.untranslated_times * 1.04), base = H - bot, bw = port ? 58 : 118, gap = port ? 10 : 22;
    const vals = [[1, y.untranslated_times], [1, 1 + y.translated_pct / 100], [1, 1 + y.same_camera_pct / 100]];
    const who = [[S.names.older, S.names.newer], [S.names.older, S.names.newer], [S.names.newer, port ? 'twin' : 'her twin']];
    const cls = [['o', 'n'], ['o', 'g'], ['n', 'n']], img = [[S.art.older, S.art.newer], [S.art.older, S.art.newer], [S.art.newer, S.art.newer]];
    const fs = port ? 24 : 26;
    let g = '';
    vals.forEach((pair, k) => {
      const cx = gw * k + gw / 2, x0 = cx - bw - gap / 2, x1 = cx + gap / 2;
      const h0 = pair[0] * unit, h1 = pair[1] * unit;
      g += `<g class="se-grp g${k}">
        <rect class="se-bar ${cls[k][0]}" x="${x0}" y="${base - h0}" width="${bw}" height="${h0}" rx="6"/>
        <rect class="se-bar grow ${cls[k][1]}" x="${x1}" y="${base - h1}" width="${bw}" height="${h1}" rx="6" style="transform-origin:${x1 + bw / 2}px ${base}px"/>
        <line class="se-ref" x1="${x0 - 14}" x2="${x1 + bw + 14}" y1="${base - h0}" y2="${base - h0}"/>
        ${port ? wrapSvg(T.y_g[k].lab, cx, base - Math.max(h0, h1) - 22 - (fs + 2) * 1.25 * (T.y_g[k].lab.length > 13 ? 1 : 0), 13, fs + 2, 'se-lab ' + (k === 0 ? 'e' : 'gold'))
          : `<text class="se-lab ${k === 0 ? 'e' : 'gold'}" x="${cx}" y="${base - Math.max(h0, h1) - 22}" text-anchor="middle" style="font-size:${fs + 6}px">${esc(T.y_g[k].lab)}</text>`}
        <image href="${esc(img[k][0])}" x="${x0 + bw / 2 - 45}" y="${base + 10}" width="90" height="62" preserveAspectRatio="xMidYMid meet"/>
        <image href="${esc(img[k][1])}" x="${x1 + bw / 2 - 45}" y="${base + 10}" width="90" height="62" preserveAspectRatio="xMidYMid meet"${k === 2 ? ' class="twin"' : ''}/>
        <text class="se-who" x="${x0 + bw / 2}" y="${base + 98}" text-anchor="middle" style="font-size:${fs - 2}px">${esc(who[k][0])}</text>
        <text class="se-who" x="${x1 + bw / 2}" y="${base + 98}" text-anchor="middle" style="font-size:${fs - 2}px">${esc(who[k][1])}</text>
        ${wrapSvg(T.y_g[k].cap, cx, base + 140, port ? 15 : 30, fs, 'se-cap')}</g>`;
    });
    return `<svg class="se-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(T.y_alt0)}">
      <line class="se-axis" x1="0" x2="${W}" y1="${base}" y2="${base}"/>
      ${port ? wrapSvg(T.y_unit, W / 2, 30, 40, fs - 2, 'se-unit') : `<text class="se-unit" x="0" y="26" style="font-size:${fs - 2}px">${esc(T.y_unit)}</text>`}${g}</svg>`;
  }
  function wrapSvg(s, x, y, max, fs, cls) {     // a caption over a few lines, centered
    const words = String(s).split(' '), lines = []; let cur = '';
    words.forEach(w => { if ((cur + ' ' + w).trim().length > max && cur) { lines.push(cur); cur = w; } else cur = (cur + ' ' + w).trim(); }); if (cur) lines.push(cur);
    return `<text class="${cls}" x="${x}" y="${y}" text-anchor="middle" style="font-size:${fs}px">${lines.map((l, i) => `<tspan x="${x}" dy="${i ? fs * 1.25 : 0}">${esc(l)}</tspan>`).join('')}</text>`;
  }
  function yRuler(T, y, d, port) {
    const W = port ? 640 : 1640, L = port ? 0 : 430, R = port ? 40 : 90, MAX = 30, rowH = port ? 150 : 128, top = port ? 80 : 90, fs = port ? 24 : 26;
    const H = top + rowH * 3 + (port ? 110 : 96), px = v => L + (W - L - R) * Math.min(v, MAX) / MAX;
    const ticks = [0, 5, 10, 15, 20, 25, 30].map(t => `<line class="se-grid" x1="${px(t)}" x2="${px(t)}" y1="${top - 20}" y2="${top + rowH * 3}"/><text class="se-tick" x="${px(t)}" y="${top + rowH * 3 + 36}" text-anchor="middle" style="font-size:${fs - 2}px">${t}%</text>`).join('');
    const showFloor = !d.ladder || d.ladder.twin;
    const floor = showFloor ? `<rect class="se-floor" x="${px(0)}" y="${top - 20}" width="${px(y.same_camera_pct) - px(0)}" height="${rowH * 3 + 20}"/>` : '';
    const world = d.yardstick.countries || [];
    const rows = T.y_rows.map((rw, k) => {
      const cy = top + rowH * k + rowH / 2, off = rw.v > MAX, x1 = px(rw.v), bh = port ? 30 : 38;
      const labX = port ? 0 : L - 24, capY = port ? cy - bh / 2 - 16 : cy + 9;
      const bar = off
        ? `<rect class="se-rbar e" x="${px(0)}" y="${cy - bh / 2}" width="${W - R + 30 - px(0)}" height="${bh}"/><path class="se-break" d="M${W - R + 6} ${cy - bh / 2 - 8} l14 ${bh / 2 + 8} -14 ${bh / 2 + 8}"/><path class="se-break" d="M${W - R + 22} ${cy - bh / 2 - 8} l14 ${bh / 2 + 8} -14 ${bh / 2 + 8}"/>`
        : `<rect class="se-rbar ${rw.cls || (k === 1 ? 'g' : 'n')}" x="${px(0)}" y="${cy - bh / 2}" width="${Math.max(4, x1 - px(0))}" height="${bh}" style="transform-origin:${px(0)}px ${cy}px"/>`;
      const val = off ? `<text class="se-val e" x="${px(0) + 16}" y="${cy + bh / 2 + (port ? 36 : 40)}" style="font-size:${fs}px">${esc(rw.lab)} ▸</text>`
        : `<text class="se-val ${rw.cls === 'g' || (!rw.cls && k === 1) ? 'gold' : ''}" x="${x1 + 14}" y="${cy + 10}" style="font-size:${fs + 6}px">${esc(rw.lab)}</text>` + (rw.tag ? `<text class="se-tag" x="${x1 + 14}" y="${cy + 10 + fs + 8}" style="font-size:${fs - 4}px">${esc(rw.tag)}</text>` : '');
      const list = rw.dots || (d.ladder ? [] : world.map(c => ({ name: c.name, v: k === 0 ? c.same_camera_pct : k === 1 ? c.translated_pct : null })));
      const dots = list.length ? `<g class="se-dots se-only" data-on="2">${list.map(c => { const v = c.v; if (v == null) return '';
        return `<circle class="se-dot ${rw.cls || (k === 1 ? 'g' : 'n')}" cx="${px(v).toFixed(1)}" cy="${(cy + (hashJit(c.name) - .5) * bh * 1.6).toFixed(1)}" r="${port ? 5 : 7}"><title>${esc(c.name)}: ${v.toFixed(1)}%</title></circle>`; }).join('')}</g>` : '';
      return `<g class="se-row r${k}"><text class="se-rcap" x="${labX}" y="${capY}" text-anchor="${port ? 'start' : 'end'}" style="font-size:${fs}px">${esc(rw.cap)}</text><g class="se-rbars">${bar}${val}</g>${dots}</g>`;
    }).join('');
    const worldNote = '';
    return `<svg class="se-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc('A ruler from 0% to 30%: how far off a typical month is. ' + T.y_rows.map(r => r.cap + ': ' + r.lab).join('. ') + '.')}">
      <text class="se-unit" x="${port ? 0 : L}" y="${top - 46}" style="font-size:${fs - 2}px">${esc(T.y_ruler)}</text>${floor}
      ${showFloor ? `<text class="se-floort" x="${px(0)}" y="${top + rowH * 3 + 74}" style="font-size:${fs - 2}px">▲ shaded: ${esc(T.y_floor)}</text>` : ''}${ticks}${rows}${worldNote}</svg>` +
      (world.length ? `<p class="se-small se-wnote se-only" data-on="2" style="margin-left:${port ? 0 : L}px">${esc(T.y_world)}</p>` : '');
  }
  const hashJit = s => { let h = 7; for (const c of s) h = (h * 31 + c.charCodeAt(0)) % 997; return h / 997; };

  /* =====================================================================================================
     Screens 2 and 3. NOT JUST ARGENTINA: the same small multiples, first as the record comes (older camera to 2021, newer from 2022),
     then settled onto one scale. t = 0 as it comes, 1 one scale; the bars after the switch shrink in place and each chart's height follows.
     ===================================================================================================== */
  function stitched(el, d, step) { return multiples(el, d, clampStep('stitched', step), 0); }
  function oneScale(el, d, step) { return multiples(el, d, clampStep('oneScale', step), 1); }
  function multiples(el, d, step, target) {
    const T = text(d), name = 'multiples';
    const { root, fresh, port } = base(el, name, d, step, (root, port) => {
      root.innerHTML = `<div class="se-mhead"></div><div class="se-body se-grid">${d.small_multiples.map((c, i) => `<figure class="se-cell" data-i="${i}">
          <figcaption><b>${esc(c.name)}</b><span class="se-flag"></span></figcaption><div class="se-mc"></div></figure>`).join('')}
        <figure class="se-cell se-key"><div class="se-keyrow">${art(S.art.older, 'k', '')}<span><b class="o">${esc(S.names.older)}</b>, the older camera, to 2021</span></div>
          <div class="se-keyrow">${art(S.art.newer, 'k', '')}<span><b class="n">${esc(S.names.newer)}</b>, the newer camera, from 2022</span></div>
          <div class="se-keyrow gold"><i class="sw g"></i><span>the same years <b class="g">on one scale</b></span></div>
          ${d.twoTone ? `<div class="se-keyrow ttk">${ttKey(S.names)}</div>` : ''}
          <p class="se-keyunit">Bars: ${esc(T.m_unit)}. Dashed line: the switch.</p></figure></div>
        <p class="se-small se-mfoot">${esc(T.m_small)}</p>`;
      root.__t = target;
    });
    root.__mode = target; root.classList.toggle('se-mode1', target === 1);
    const H = target === 0 ? head(T.s_eyebrow, [T.s_h0, T.s_h1]) : head(T.o_eyebrow, [T.o_h0, T.o_h1]);
    const mh = root.querySelector('.se-mhead'); if (mh.dataset.mode !== String(target)) { mh.innerHTML = H; mh.dataset.mode = target; }
    applyStep(root, step);
    const from = root.__t == null ? target : root.__t;
    root.classList.toggle('se-twotone', !!d.twoTone);
    const draw = t => { root.__t = t; d.small_multiples.forEach((c, i) => cell(root, c, i, t, target, step, port, !!d.twoTone)); };
    if (from === target || reduced()) draw(target);
    else tween(root, 1500, k => draw(from + (target - from) * ease(k)));
    return root;
  }
  function cell(root, c, i, t, target, step, port, tt) {
    const fig = root.querySelector(`.se-cell[data-i="${i}"]`), box = fig.querySelector('.se-mc');
    const W = port ? 300 : 370, H = port ? 190 : 214, L = 4, R = 4, top = 40, bot = 30, n = c.years.length, slot = (W - L - R) / n, bw = Math.max(3, slot * .74);
    const val = y => y.year < 2022 ? (y.one0 != null ? y.one0 + (y.one - y.one0) * t : y.one) : y.asis + (y.one - y.asis) * t;   // one0: where an older bar starts when one scale lifts it (historyScale 'vee')
    const max = Math.max(...c.years.map(val)), hh = v => (H - top - bot) * v / max;
    const i22 = c.years.findIndex(y => y.year >= 2022), seam = L + i22 * slot - (slot - bw) / 2 + 0.5;
    const flagYear = t < .5 ? c.stitched_best : c.one_best;
    const flagIdx = c.years.findIndex(y => y.year === flagYear);
    const showFlags = t === target && ((target === 0 && step >= 1) || target === 1);   // marks only once the bars have settled
    const bars = c.years.map((y, k) => { const v = val(y), bh = Math.max(2, hh(v)), x = L + k * slot + (slot - bw) / 2, cls = y.year < 2022 ? 'o' : 'n';
      if (tt && t > 0) {      // two tones: Moe's part, then the added part growing on top (pre-2022); Vee's own count, solid (from 2022)
        const best = showFlags && k === flagIdx ? ' best' : '';
        if (y.year >= 2022 || y.one0 == null) return `<rect class="se-mb n tt${best}" x="${x.toFixed(1)}" y="${(H - bot - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2"/>`;
        const mh = Math.max(2, hh(y.one0)), ah = Math.max(0, bh - mh);
        return `<rect class="se-mb o tt" x="${x.toFixed(1)}" y="${(H - bot - mh).toFixed(1)}" width="${bw.toFixed(1)}" height="${mh.toFixed(1)}" rx="1"/>` +
          (ah > .5 ? `<rect class="se-mb add${best}" x="${x.toFixed(1)}" y="${(H - bot - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${ah.toFixed(1)}" rx="1"/>` : '');
      }
      const col = t > 0 ? `style="fill:color-mix(in srgb, var(--se-gold) ${(t * 100).toFixed(0)}%, var(--se-${cls === 'o' ? 'older' : 'newer'}))"` : '';
      return `<rect class="se-mb ${cls}${showFlags && k === flagIdx ? ' best' : ''}" x="${x.toFixed(1)}" y="${(H - bot - bh).toFixed(1)}" width="${bw.toFixed(1)}" height="${bh.toFixed(1)}" rx="2" ${col}/>`; }).join('');
    // the old (stitched) record, struck once on one scale; the one-scale biggest year marked
    let marks = '';
    if (showFlags) {
      const k = flagIdx, x = L + k * slot + slot / 2, yTop = H - bot - hh(val(c.years[k]));
      marks += `<text class="se-star ${t < .5 ? 'e' : 'gold'}" x="${x.toFixed(1)}" y="${(yTop - 8).toFixed(1)}" text-anchor="middle" style="font-size:${port ? 22 : 24}px">★</text>`;
    }
    const sw = `<line class="se-seam" x1="${seam.toFixed(1)}" x2="${seam.toFixed(1)}" y1="${top - 6}" y2="${H - bot}"/>`;
    const yrs = `<text class="se-yr" x="${L}" y="${H - 6}" style="font-size:23px">${c.first}</text><text class="se-yr" x="${W - R}" y="${H - 6}" text-anchor="end" style="font-size:23px">${c.last}</text>`;
    const alt = `${c.name}, ${fmt(c.years.length)} whole years ${c.first} to ${c.last}, fire detections a year. ` + (t < .5
      ? `As it comes, the biggest year is ${c.stitched_best}, ${c.stitched_times.toFixed(1)} times the biggest year before the switch.`
      : `On one scale, the biggest year is ${c.one_best}; the older camera alone also says ${c.own_best}.`);
    box.innerHTML = `<svg class="se-svg" viewBox="0 0 ${W} ${H}" width="${W}" height="${H}" role="img" aria-label="${esc(alt)}">${tt ? HATCH : ''}${sw}${bars}${marks}<line class="se-axis" x1="0" x2="${W}" y1="${H - bot}" y2="${H - bot}"/>${yrs}</svg>`;
    // the flag in words, under the name
    const f = fig.querySelector('.se-flag');
    let html = ''; if (t === target) {
    if (target === 0 && step >= 1) html = `<span class="e">★ ${c.stitched_best} record</span> · ${times1(c.stitched_times)} the old best`;
    else if (target === 1 && step === 0) html = `<span class="gold">biggest year: ${c.one_best}</span>`;
    else if (target === 1 && step >= 1) html = c.holds ? `<span class="gold">★ ${c.one_best} holds on every reading</span>` : `<s class="e">${c.stitched_best}</s> <span class="gold">★ biggest: ${c.one_best}</span>`;
    }
    if (f.innerHTML !== html) f.innerHTML = html;
    fig.classList.toggle('holds', target === 1 && step >= 1 && c.holds);
    fig.classList.toggle('struck', target === 1 && step >= 1 && c.false_record);
  }
  const times1 = v => (Math.round(v * 10) / 10).toFixed(1) + '×';
  function tween(root, ms, fn) {
    cancelAnimationFrame(root.__raf); const t0 = performance.now();
    const tick = now => { const k = Math.min(1, (now - t0) / ms); fn(k); if (k < 1) root.__raf = requestAnimationFrame(tick); };
    root.__raf = requestAnimationFrame(tick);
  }

  /* =====================================================================================================
     Screen 3b. BACK TO THE QUESTION (s6_p3): the record's yearly fire detections on one scale, 2003-2025, one calm bar chart from zero,
     with the average of the first five years and of the last five years as two quiet lines. No trend line; no percent in big type.
     ===================================================================================================== */
  function world(el, d, step) {
    const T = text(d), w = d.world;
    const { root } = base(el, 'world', d, 0, (root, port) => {
      const W = port ? 656 : 1240, H = port ? 560 : 600, L = port ? 130 : 150, R = port ? 150 : 250, top = 30, bot = 56, fs = port ? 25 : 26;
      const n = w.years.length, slot = (W - L - R) / n, bw = slot * .72, M6 = Math.max(2, Math.ceil(Math.max(...w.totals) * 1.08 / 1e6)), max = M6 * 1e6, y = v => H - bot - (H - top - bot) * v / max;   // the axis grows to the data (Vee's scale reads about three times higher)
      const tt = !!(d.twoTone && w.moe);
      const bars = tt ? w.years.map((yr, i) => { const x0 = (L + i * slot + (slot - bw) / 2).toFixed(1), top0 = y(w.totals[i]);
          if (w.moe[i] == null) return `<rect class="se-wb n" x="${x0}" y="${top0.toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - bot - top0).toFixed(1)}" rx="3"><title>${yr}: ${fmt(w.totals[i])}, what ${esc(S.names.newer)} counted</title></rect>`;
          const ym = y(w.moe[i]);
          return `<rect class="se-wb o" x="${x0}" y="${ym.toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - bot - ym).toFixed(1)}" rx="2"><title>${yr}: ${esc(S.names.older)} counted ${fmt(w.moe[i])}</title></rect>` +
            `<rect class="se-wb add" x="${x0}" y="${top0.toFixed(1)}" width="${bw.toFixed(1)}" height="${(ym - top0).toFixed(1)}" rx="2"><title>${yr}: added ${fmt(w.totals[i] - w.moe[i])}, to ${fmt(w.totals[i])}</title></rect>`; }).join('')
        : w.years.map((yr, i) => `<rect class="se-wb" x="${(L + i * slot + (slot - bw) / 2).toFixed(1)}" y="${y(w.totals[i]).toFixed(1)}" width="${bw.toFixed(1)}" height="${(H - bot - y(w.totals[i])).toFixed(1)}" rx="3"><title>${yr}: ${fmt(w.totals[i])}</title></rect>`).join('');
      const tick = Array.from({ length: M6 + 1 }, (_, k) => k * 1e6).filter((v, k) => M6 <= 3 || k % 2 === 0 || k === M6).map(v => `<line class="se-grid" x1="${L}" x2="${W - R}" y1="${y(v)}" y2="${y(v)}"/><text class="se-tick" x="${L - 12}" y="${y(v) + 8}" text-anchor="end" style="font-size:${fs - 2}px">${v ? (v / 1e6) + ' million' : '0'}</text>`).join('');
      // each average: a quiet line across the chart, bolder over its own five years, labeled in the right margin
      const avg = (a, k) => { const x0 = L + (k === 0 ? 0 : (n - 5) * slot), x1 = x0 + 5 * slot, yy = y(a.mean), ly = yy + (k === 0 ? -6 : 26);
        return `<line class="se-avg all" x1="${L}" x2="${W - R + 10}" y1="${yy}" y2="${yy}"/><line class="se-avg" x1="${x0}" x2="${x1}" y1="${yy}" y2="${yy}"/><text class="se-avgt" x="${W - R + 20}" y="${ly}" style="font-size:${fs - 2}px">${port ? 'avg.' : 'average'} ${a.from}–${String(a.to).slice(-2)}</text>`; };
      const years = w.years.map((yr, i) => (i === 0 || i === n - 1 || (yr % 5 === 0 && i > 2)) ? `<text class="se-tick" x="${(L + i * slot + slot / 2).toFixed(1)}" y="${H - bot + 34}" text-anchor="middle" style="font-size:${fs - 2}px">${yr}</text>` : '').join('');
      const alt = `Fire detections a year on one scale, ${w.years[0]} to ${w.years[n - 1]}, ${w.countries} countries with complete records: ` + w.years.map((yr, i) => yr + ' ' + fmt(w.totals[i])).join('; ') + `. Average ${w.first5.from} to ${w.first5.to}: ${fmt(w.first5.mean)}; average ${w.last5.from} to ${w.last5.to}: ${fmt(w.last5.mean)}.`;
      root.innerHTML = head(T.w_eyebrow, [T.w_h]) + `<div class="se-body se-wbody"><div class="se-wchart">
          <svg class="se-svg" viewBox="0 0 ${W} ${H}" width="100%" role="img" aria-label="${esc(alt)}">${tt ? HATCH : ''}${tick}${bars}${avg(w.first5, 0)}${avg(w.last5, 1)}${years}<line class="se-axis" x1="${L}" x2="${W - R}" y1="${H - bot}" y2="${H - bot}"/></svg>
          <p class="se-wunit">${esc(T.w_unit)}</p>${tt ? `<p class="se-ttkey">${ttKey(S.names)}</p>` : ''}</div>
        <div class="se-wside">${art(S.art.both, 'both', 'Moe and Vee side by side')}<p class="se-wline">${esc(T.w_line)}</p><p class="se-small">${esc(T.w_small)}</p></div></div>`;
    });
    applyStep(root, 0);
    return root;
  }

  /* =====================================================================================================
     Screen C. WHAT HAPPENS WHEN YOU ASK IT SOMETHING (team lead, Nov 15 morning, Part 25): one real exchange from round_SAT/mcp/EXAMPLES.md
     (exchange 2, Australia, December 2019; data.connector, read from that file by the table builder), playing by itself in about 13 s:
     the question is typed; three parts of the one real tool call (fire_answer) light up, each with what came back; the answer lands with
     the chart it rests on; the closing line. Step 0 plays; step 1 shows it settled. Reduced motion / still: settled at once.
     ===================================================================================================== */
  function connector(el, d, step) {
    step = clampStep('connector', step);
    const c = d.connector, T = text(d);
    if (!c) { el.innerHTML = '<div class="se se-land"><p class="se-h">No connector exchange in the data.</p></div>'; return el.firstChild; }
    const { root, fresh, port } = base(el, 'connector', d, step, (root, port) => {
      const max = Math.max(...c.months.map(m => m.value)), mine = c.months.find(m => m.year === +c.label.slice(-4));
      const usualH = c.usual / max;
      // tiny pictures, one per step: the month lit on a year strip; this month against a usual one; every December ranked
      const strip = `<div class="cx-strip">${['J', 'F', 'M', 'A', 'M', 'J', 'J', 'A', 'S', 'O', 'N', 'D'].map((m, i) => `<i${i === 11 ? ' class="on"' : ''}>${m}</i>`).join('')}</div>`;
      const pair = `<div class="cx-pair"><div><b style="height:${(c.detections / max * 100).toFixed(1)}%"></b><span>${fmt(c.detections)}</span><em>${esc(c.label)}</em></div><div><b class="u" style="height:${(usualH * 100).toFixed(1)}%"></b><span>${fmt(c.usual)}</span><em>a usual December</em></div></div>`;
      const ranked = c.months.slice().sort((a, b) => a.value - b.value);
      const dots = `<div class="cx-rank">${ranked.map(m => `<i class="${m === mine ? 'me' : ''}" style="height:${(m.value / max * 100).toFixed(1)}%"></i>`).join('')}</div>`;
      const steps = [
        ['Finds the place and the month', `${c.place} · ${c.label}`, strip],
        [`Reads ${c.years_compared + 1} Decembers of the record`, `${fmt(c.detections)} fire detections, against a usual ${fmt(c.usual)}`, pair],
        ['Checks how sure it can be', c.engine_higher_than === c.months.length - 1 ? `busier than all ${c.engine_higher_than} other Decembers` : `ranked among ${c.months.length - 1} other Decembers`, dots]];
      const W = port ? 600 : 520, H = port ? 230 : 210, bw = W / c.months.length;
      const chart = `<svg class="se-svg cx-chart" viewBox="0 0 ${W} ${H + 34}" width="${W}" height="${H + 34}" role="img" aria-label="${esc(`${c.place}'s fire detections every December, ${c.months[0].year} to ${c.months[c.months.length - 1].year}: ${c.label} ${fmt(c.detections)}, the highest; a usual December ${fmt(c.usual)}.`)}">
        ${c.months.map((m, i) => `<rect class="cx-b${m === mine ? ' me' : ''}" x="${(i * bw + bw * .14).toFixed(1)}" y="${(H - H * m.value / max).toFixed(1)}" width="${(bw * .72).toFixed(1)}" height="${(H * m.value / max).toFixed(1)}" rx="2"/>`).join('')}
        <line class="cx-usual" x1="0" x2="${W}" y1="${(H - H * usualH).toFixed(1)}" y2="${(H - H * usualH).toFixed(1)}"/>
        <text class="se-tick" x="0" y="${H + 28}" style="font-size:23px">${c.months[0].year}</text><text class="se-tick" x="${W}" y="${H + 28}" text-anchor="end" style="font-size:23px">${c.months[c.months.length - 1].year}</text>
        <text class="cx-ul" x="${W}" y="${(H - H * usualH - 10).toFixed(1)}" text-anchor="end" style="font-size:23px">usual</text></svg>`;
      root.innerHTML = head('What happens when you ask it something', [T.c_h]) + `<p class="cx-mcp">MCP connector</p>
        <div class="se-body cx-body">
          <section class="cx-chat" aria-label="A chat with your own AI">
            <p class="cx-you"><span>You</span><b class="cx-typed" data-full="${esc(c.question)}">${esc(c.question)}</b></p>
            <div class="cx-ai cx-t" data-t="9000"><span>Your AI · from the record</span><div class="cx-ans"><div>${c.said.slice(0, 2).map(s => `<p>${esc(s)}</p>`).join('')}</div>
              <figure>${chart}<figcaption>fire detections each December</figcaption></figure></div></div>
            <p class="cx-line cx-t" data-t="11500">${esc(T.c_line)}</p>
          </section>
          <section class="cx-steps" aria-label="What the connector does">
            <p class="cx-sh">The connector asks the record</p>
            ${steps.map((s, i) => `<div class="cx-step cx-t" data-t="${2600 + i * 2000}"><div class="cx-sw"><b>${esc(s[0])}</b><small>${esc(s[1])}</small><code>${esc(c.tool)}</code></div><div class="cx-pic">${s[2]}</div></div>`).join('')}
          </section>
          <aside class="cx-side">${art(S.art.both, 'both', 'Moe and Vee, the two satellite cameras: the record the AI is asking')}<p class="cx-rec">the record</p>
            <img class="se-qr" src="${esc(S.connectorQr)}" alt="QR code: opens the page that shows how to add the connector to your own AI chat app" draggable="false"><p class="cx-ql">Add the connector to your own AI</p></aside>
        </div>`;
    });
    applyStep(root, 0);
    stop(el);
    const items = [...root.querySelectorAll('.cx-t')], typed = root.querySelector('.cx-typed');
    const settle = () => { items.forEach(e => e.classList.add('on')); typed.textContent = typed.dataset.full; typed.classList.remove('typing'); };
    if (step >= 1 || reduced()) { settle(); return root; }
    items.forEach(e => e.classList.remove('on'));
    const full = typed.dataset.full, timers = el.__seTimers = []; let k = 0;
    typed.textContent = ''; typed.classList.add('typing');
    timers.push(setInterval(() => { k++; typed.textContent = full.slice(0, k); if (k >= full.length) { typed.classList.remove('typing'); clearInterval(timers[0]); } }, Math.round(1800 / full.length)));
    items.forEach(e => timers.push(setTimeout(() => e.classList.add('on'), +e.dataset.t)));
    return root;
  }

  /* =====================================================================================================
     Screen 4. THREE WAYS TO TRY IT (s7_p1): three cards arriving one after another.
     ===================================================================================================== */
  const PAGE_FRAMES = [['img/ending/page_pick_brazil.png', 'Picking Brazil on the page'], ['img/ending/page_answer_brazil.png', 'The page\'s answer for Brazil, in plain words']];
  const DRAW_FRAMES = [['img/ending/draw_1_map.png', '1. The map'], ['img/ending/draw_2_dragging.png', '2. Drag a box'], ['img/ending/draw_3_box.png', '3. The box is drawn'], ['img/ending/draw_4_history.png', '4. That area\'s years appear']];
  function threeWays(el, d, step) {
    step = clampStep('threeWays', step);
    const T = text(d), ch = d.chat || {};
    const { root, fresh, port } = base(el, 'three', d, step, (root, port) => {
      const cards = [];
      cards.push(`<article class="se-card a"><h3><i>1</i>Open the page</h3><p class="se-cd">Pick a country. Get its answer in plain words.</p>
        <div class="se-cbody">${S.showPageCapture ? `<div class="se-phone">${PAGE_FRAMES.map((f, i) => `<img class="se-fr${i === 0 ? ' on' : ''}" src="${f[0]}" alt="${esc(f[1])}" draggable="false">`).join('')}</div>` : ''}
          <div class="se-qrcol"><img class="se-qr" src="${esc(S.pageQr)}" alt="QR code for ${esc(noScheme(S.pageUrl))}" draggable="false"><p class="se-addr">${addrHTML(noScheme(S.pageUrl))}</p></div></div></article>`);
      if (S.showDrawCard) cards.push(`<article class="se-card b"><h3><i>2</i>Draw an area <span class="se-badge">prototype</span></h3><p class="se-cd">Draw a box on a map. See that area's fire, year by year.</p>
        <div class="se-cbody col"><div class="se-frames">${DRAW_FRAMES.map((f, i) => `<img class="se-fr${i === 0 ? ' on' : ''}" src="${f[0]}" alt="${esc(f[1])}" draggable="false">`).join('')}</div>
          <p class="se-steps">${DRAW_FRAMES.map((f, i) => `<span data-i="${i}"${i === 0 ? ' class="on"' : ''}>${i + 1} of ${DRAW_FRAMES.length} · ${esc(f[1].replace(/^\d\. /, ''))}</span>`).join('')}</p>
          <p class="se-proto">A weekend prototype, shown in pictures: not online yet.</p></div></article>`);
      cards.push(`<article class="se-card c"><h3><i>${S.showDrawCard ? 3 : 2}</i>Ask your own AI</h3><p class="se-cd">Add our connector to your AI chat app.</p>
        <div class="se-cbody col"><div class="se-chat" role="group" aria-label="A chat with your own AI">
          <p class="se-you"><span>You</span>Is ${esc(ch.place || 'Argentina')} burning more than usual this month?</p>
          <div class="se-ai"><span>Your AI · from our record</span><p>${esc(ch.answer || '')}</p></div></div>
          <p class="se-clab">Connector address</p><p class="se-addr sel">${addrHTML(noScheme(S.connectorUrl))}</p></div></article>`);
      if (S.showVolunteerCard) cards.push(`<article class="se-card a v"><h3><i>${cards.length + 1}</i>Fire, or something else?</h3><p class="se-cd">Look at a hot spot's pictures and heat record, and say what it is. NASA's own label is the answer key.</p>
        <div class="se-cbody"><div class="se-phone"><img class="se-fr on" src="img/ending/volunteer_place.png" alt="The volunteer page on a phone: a hot spot's close view, and its heat month by month" draggable="false"></div>
          <div class="se-qrcol"><img class="se-qr" src="${esc(S.volunteerQr)}" alt="QR code for the volunteer page" draggable="false"><p class="se-addr">${addrHTML(noScheme(S.volunteerUrl))}</p></div></div></article>`);
      root.innerHTML = head(T.t_eyebrow, [[T.t_h, '012']]) + `<div class="se-body se-cards n${cards.length}">${cards.map((c, i) => c.replace('<article class="se-card', `<article data-at="${i}" class="se-from se-card`)).join('')}</div>`;
    });
    applyStep(root, step);
    // the cards' moving parts: each runs only while its card is on
    stop(el, true);
    const cards = root.querySelectorAll('.se-card');
    const timers = el.__seTimers = [];
    cards.forEach((card, i) => {
      if (i > step) return;
      const frames = card.querySelectorAll('.se-frames .se-fr, .se-phone .se-fr'), labels = card.querySelectorAll('.se-steps span');
      if (frames.length > 1) {
        if (reduced()) { setFrame(frames, labels, frames.length - 1); }
        else { let k = 0; setFrame(frames, labels, 0); timers.push(setInterval(() => { k = (k + 1) % frames.length; setFrame(frames, labels, k); }, S.frameMs * (card.classList.contains('a') ? 1.6 : 1))); }
      }
      const ai = card.querySelector('.se-ai'), you = card.querySelector('.se-you');
      if (ai) {   // the chat: the question, then the answer a moment later (once; a later press shows both at once)
        if (reduced() || card.__chatDone || i < step) { you.classList.add('on'); ai.classList.add('on'); }
        else { you.classList.add('on'); timers.push(setTimeout(() => ai.classList.add('on'), 1400)); }
        card.__chatDone = true;
      }
    });
    return root;
  }
  function setFrame(frames, labels, k) { frames.forEach((f, i) => f.classList.toggle('on', i === k)); labels.forEach((l, i) => l.classList.toggle('on', i === k)); }

  /* =====================================================================================================
     Screen 5. THE FINAL SCREEN (s7_p2): calm, finished, stays up during questions.
     ===================================================================================================== */
  function final(el, d, step) {
    const T = text(d);
    const { root } = base(el, 'final', d, 0, (root, port) => {
      // 1:49 PM: the web app is the globe page (page.svg opens it); the connector's code opens its page for people, and the address under it is
      // the one a person gives their AI app, labelled as such so nobody reads it as where the code goes
      const links = [S.showPageQr !== false ? { lab: 'Explore the burning calendar', url: S.pageUrl, qr: S.pageQr, show: noScheme(S.pageUrl) } : null,
        { lab: 'Connect your own AI', url: S.connectorUrl, qr: S.showConnectorQr ? S.connectorQr : null, show: S.connectorUrl, pre: S.connectorUrl ? 'address for your AI app:' : '' },
        S.volunteerQr ? { lab: S.volunteerLabel, url: S.volunteerUrl || '', qr: S.volunteerQr, show: noScheme(S.volunteerUrl) } : null,
        S.repoUrl ? { lab: 'Read the code and data', url: S.repoUrl, qr: S.repoQr, show: noScheme(S.repoUrl) } : null].filter(Boolean);
      root.innerHTML = `<div class="se-fin">
        <div class="se-fhead">${art(S.art.both, 'both', 'Moe and Vee, the two satellite cameras, side by side')}<div><p class="se-team">${esc(T.f_team)}</p><p class="se-fline">${esc(T.f_line)}</p></div></div>
        <div class="se-links n${links.length}">${links.map(l => `<div class="se-link"><p class="se-llab">${esc(l.lab)}</p>${l.qr ? `<img class="se-qr" src="${esc(l.qr)}" alt="QR code for ${esc(l.show)}" draggable="false">` : ''}${l.pre ? `<p class="se-pre">${esc(l.pre)}</p>` : ''}<p class="se-addr${/connector/.test(l.url) ? ' sel' : ''}">${addrHTML(l.show)}</p></div>`).join('')}</div>
        <p class="se-thanks">Thank you.</p></div>`;
    });
    applyStep(root, 0);
    return root;
  }

  /* ---------------- plumbing ---------------- */
  const STEPS = { yardstick: () => S.yardstickWorld ? 3 : 2, stitched: () => 2, oneScale: () => 2, threeWays: () => 2 + (S.showDrawCard ? 1 : 0) + (S.showVolunteerCard ? 1 : 0), final: () => 1, world: () => 1, connector: () => 2 };
  function clampStep(name, step) { const n = STEPS[name](); step = step == null ? 0 : +step; return Math.max(0, Math.min(n - 1, step | 0)); }
  const RENDER = { yardstick, stitched, oneScale, world, connector, threeWays, final };
  function press(el, step) {
    const s = el.__se; if (!s) return null;
    const root = el.querySelector(':scope > .se'), name = root && root.dataset.name;
    const fn = name === 'multiples' ? (root.__mode === 1 ? oneScale : stitched) : name === 'three' ? threeWays : RENDER[name];
    return fn ? fn(el, s.d, step) : null;
  }
  function stop(el, keepChat) {
    (el.__seTimers || []).forEach(t => { clearInterval(t); clearTimeout(t); }); el.__seTimers = [];
    const root = el.querySelector && el.querySelector(':scope > .se'); if (root && !keepChat) cancelAnimationFrame(root.__raf);
  }
  let cache = null;
  function load(url) { if (cache && !url) return cache; cache = fetch(url || 'data/ending_table.json').then(r => { if (!r.ok) throw new Error('ending_table.json: ' + r.status); return r.json(); }); return cache; }
  function configure(o) { Object.assign(S, o || {}); return S; }
  // numbers for the story's Numbers panel (key N), same shape as story.js's sc.numbers
  function numbers(name, d) {
    const r = d.records;
    if (name === 'yardstick') { const y = d.yardstick; return { title: 'How far off, a typical month (Argentina)', tables: [{ caption: 'Untranslated, translated, and two copies of the same camera.', head: ['Reading', 'Value', 'Months'],
      rows: [['Newer camera as it comes, times the older camera', y.untranslated_times.toFixed(2), y.translated_months], ['Translated, typical miss', y.translated_pct.toFixed(2) + '%', y.translated_months], ['Two copies of the same camera, typical difference', y.same_camera_pct.toFixed(2) + '%', y.same_camera_months]] }] }; }
    if (name === 'stitched' || name === 'oneScale') return { title: 'Biggest year, three readings', tables: [{ caption: `Matched whole years. ${r.testable} of ${r.busy} busy countries testable. After 2021: stitched ${r.stitched_after_2021}, one scale ${r.one_scale_after_2021}, older camera alone ${r.older_alone_after_2021}.`,
      head: ['Country', 'Stitched', 'Times earlier best', 'One scale', 'Older camera alone'], rows: d.small_multiples.map(c => [c.name, c.stitched_best, c.stitched_times.toFixed(2), c.one_best, c.own_best]) }] };
    return null;
  }
  window.StoryEnding = { load, yardstick, stitched, oneScale, world, connector, threeWays, final, press, stop, steps: n => STEPS[n] ? STEPS[n]() : 1, settings: S, configure, text, numbers };
})();
