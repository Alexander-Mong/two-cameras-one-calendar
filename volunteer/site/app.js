/* Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md. */
//
// ---- settings -------------------------------------------------------------
const MAIN_URL = '';   // the team's main page; empty = no link on the ending card
const PICKS_URL = '';  // the picks service (picks_server/), e.g. 'https://example.org/picks'; empty = saving off
// ---------------------------------------------------------------------------
(function () {
  'use strict';
  const C = window.VCORE;
  const $ = id => document.getElementById(id);
  const GIBS = 'https://gibs.earthdata.nasa.gov/wms/epsg4326/best/wms.cgi';
  const LAYERS = {
    S30: { name: 'HLS_S30_Nadir_BRDF_Adjusted_Reflectance', credit: 'NASA HLS · contains modified Copernicus Sentinel data 2020' },
    L30: { name: 'HLS_L30_Nadir_BRDF_Adjusted_Reflectance', credit: 'NASA HLS · Landsat courtesy NASA/USGS' },
    MT: { name: 'MODIS_Terra_CorrectedReflectance_TrueColor', credit: 'NASA MODIS Terra via GIBS' },
    MA: { name: 'MODIS_Aqua_CorrectedReflectance_TrueColor', credit: 'NASA MODIS Aqua via GIBS' },
    BM: { name: 'VIIRS_Black_Marble', credit: 'NASA Black Marble 2016 via GIBS' },
    NH: { name: 'VIIRS_SNPP_CorrectedReflectance_BandsM11-I2-I1,VIIRS_SNPP_Thermal_Anomalies_375m_Day,VIIRS_SNPP_Thermal_Anomalies_375m_Night', credit: 'NASA VIIRS false color + FIRMS fire dots via GIBS' },
    NHM: { name: 'MODIS_Terra_CorrectedReflectance_Bands721,VIIRS_SNPP_Thermal_Anomalies_375m_Day,VIIRS_SNPP_Thermal_Anomalies_375m_Night', credit: 'NASA MODIS false color + FIRMS fire dots via GIBS' },
    S2: { credit: 'Contains modified Copernicus Sentinel data 2020' }
  };
  const PIC_TIMEOUT = 12000;
  // Local testing only: ?picks=http://127.0.0.1:8871 works on this computer, never on a public address
  const isLocal = /^(127\.0\.0\.1|localhost)$/.test(location.hostname);
  const qp = new URLSearchParams(location.search);
  let picksUrl = (isLocal && qp.get('picks')) || PICKS_URL;
  let saving = !!picksUrl;

  let PLACES = [], queue = [], qi = 0, mode = 'practice', cur = null, picked = false, roundNo = 0;
  const seen = new Set();
  const picks = [];        // this visit only: {id, pick, nasa}; lives in page memory, gone when the tab closes
  const session = (() => { const a = new Uint8Array(12); crypto.getRandomValues(a); return Array.from(a, b => 'abcdefghijklmnopqrstuvwxyz0123456789'[b % 36]).join(''); })();
  const timing = [];       // picture arrival times, for the check (window.__vol)

  // ---------- screens
  function show(id) { for (const s of document.querySelectorAll('.screen')) s.hidden = s.id !== id; window.scrollTo(0, 0); }
  function updateScore() {
    const s = C.score(picks.filter(r => !r.practice));
    const el = $('score');
    if (!s.total) { el.hidden = true; return; }
    el.hidden = false;
    el.innerHTML = `Agreeing with NASA: <b>${s.agree}</b> of ${s.total}`;
  }

  // ---------- pictures from NASA GIBS, at view time
  function bbox(lat, lon, km) {
    const dl = km / 2 / 111.32, dn = km / 2 / (111.32 * Math.cos(lat * Math.PI / 180));
    return [lat - dl, lon - dn, lat + dl, lon + dn].map(v => v.toFixed(5)).join(',');
  }
  function wms(layer, date, p, km, px) {
    const q = new URLSearchParams({ SERVICE: 'WMS', VERSION: '1.3.0', REQUEST: 'GetMap', FORMAT: 'image/jpeg', CRS: 'EPSG:4326',
      LAYERS: LAYERS[layer].name, STYLES: '', BBOX: bbox(p.lat, p.lon, km), WIDTH: px, HEIGHT: px });
    if (date) q.set('TIME', date);
    return GIBS + '?' + q.toString();
  }
  // Load one picture; resolve with its black share (no-data shows black) or reject on error/timeout
  function load(url) {
    return new Promise((res, rej) => {
      const im = new Image(); im.crossOrigin = 'anonymous';
      const t0 = performance.now();
      const to = setTimeout(() => { im.src = ''; rej(new Error('timeout')); }, PIC_TIMEOUT);
      im.onload = () => {
        clearTimeout(to);
        let black = 0;
        try {
          const c = document.createElement('canvas'); c.width = c.height = 32;
          const g = c.getContext('2d'); g.drawImage(im, 0, 0, 32, 32);
          const d = g.getImageData(0, 0, 32, 32).data;
          for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] < 24) black++;
          black /= 1024;
        } catch (e) { black = 0; }
        timing.push({ url, ms: Math.round(performance.now() - t0), black });
        res({ im, black, url });
      };
      im.onerror = () => { clearTimeout(to); timing.push({ url, ms: Math.round(performance.now() - t0), error: true }); rej(new Error('error')); };
      im.src = url;
    });
  }
  // Try candidates in order until one arrives without a big no-data gap
  async function firstGood(cands, maxBlack, token) {
    for (const c of cands) {
      if (token !== curTok) return null;
      try { const r = await load(c.url); if (r.black <= maxBlack) return { ...r, ...c }; } catch (e) { /* next */ }
    }
    return null;
  }
  let curTok = null, day = 0;
  function putPic(slot, got, token, missText) {
    if (token !== curTok) return;
    const fr = document.querySelector(`.frame[data-slot="${slot}"]`);
    const img = fr.querySelector('img'), w = fr.querySelector('.wait'), cr = fr.querySelector('.credit');
    if (got) {
      img.src = got.im.src; img.classList.add('in'); w.hidden = true;
      cr.textContent = LAYERS[got.layer].credit + (got.date && got.layer !== 'BM' ? ' · ' + got.date : '');
    } else {
      img.classList.remove('in'); img.removeAttribute('src'); w.hidden = false; w.classList.add('fail');
      w.textContent = missText || "This picture didn't arrive from NASA. The heat record below still holds the clues.";
      cr.textContent = '';
    }
  }
  function resetPics(slots) {
    for (const fr of document.querySelectorAll('.frame')) {
      if (slots && !slots.includes(fr.dataset.slot)) continue;
      const img = fr.querySelector('img'), w = fr.querySelector('.wait');
      img.classList.remove('in'); img.removeAttribute('src');
      w.hidden = false; w.classList.remove('fail'); w.textContent = 'Picture on its way...';
      fr.querySelector('.credit').textContent = '';
    }
  }
  const NO_SHARP = "No clear sharp picture of this spot in 2020's open archive. The wide view and the heat record still hold the clues.";
  // pictures that follow the chosen day: stored close + heat, live wide
  async function loadDay(p, token) {
    const sh = (p.sharp || [])[day];
    const date = sh ? sh.date : (p.picture_dates || [])[0];
    $('day-label').textContent = sh ? `Pictures from ${sh.date}` + ((p.sharp || []).length > 1 ? ` (day ${day + 1} of ${p.sharp.length})` : '') : '';
    const stored = sh ? Promise.all([
      firstGood([{ layer: 'S2', date: sh.date, url: 'img/places/' + sh.close }], 1, token).then(g => putPic('close', g, token, NO_SHARP)),
      firstGood([{ layer: 'S2', date: sh.date, url: 'img/places/' + sh.heat }], 1, token).then(g => putPic('heat', g, token, NO_SHARP))
    ]) : (putPic('close', null, token, NO_SHARP), putPic('heat', null, token, NO_SHARP), Promise.resolve());
    const wide = [{ layer: 'S30', date }, { layer: 'MT', date }, { layer: 'MA', date }];
    wide.forEach(c => c.url = wms(c.layer, c.date, p, 30, 500));
    const gw = await firstGood(wide, 0.12, token);
    putPic('wide', gw, token);
    await stored;
    return gw;
  }
  async function loadPictures(p, token) {
    const night = firstGood([{ layer: 'BM', date: '2016-01-01', url: wms('BM', '2016-01-01', p, 30, 400) }], 1, token).then(g => { putPic('night', g, token); return g; });
    const b = p.busiest_day, b1 = new Date(Date.parse(b) + 864e5).toISOString().slice(0, 10);
    $('nasaheat-cap').innerHTML = `<b>NASA's heat view</b>, 30 km, on its busiest day (${b}): red dots are where NASA's VIIRS camera saw heat that day and night.`;
    const nh = [{ layer: 'NH', date: b }, { layer: 'NHM', date: b }, { layer: 'NH', date: b1 }];
    nh.forEach(c => c.url = wms(c.layer, c.date, p, 30, 500));
    const nasaheat = firstGood(nh, 0.12, token).then(g => { putPic('nasaheat', g, token); return g; });
    const gw = await loadDay(p, token);
    const [gn, gh] = await Promise.all([night, nasaheat]);
    if (token === curTok) {
      $('pic-note').hidden = !!gw;
      $('pic-note').textContent = 'Some pictures didn\'t arrive from NASA. The heat record still holds the clues.';
      window.__vol.lastPictures = { id: p.id, wide: gw && { layer: gw.layer, date: gw.date }, nasaheat: gh && { layer: gh.layer, date: gh.date }, night: !!gn,
        close: !!document.querySelector('.frame[data-slot="close"] img.in'), heat: !!document.querySelector('.frame[data-slot="heat"] img.in') };
    }
  }
  function anotherDay() {
    const p = cur; if (!p || !(p.sharp || []).length) return;
    day = (day + 1) % p.sharp.length;
    curTok = {}; const token = curTok;
    resetPics(['close', 'heat', 'wide']);
    loadDay(p, token).then(() => { if (token === curTok) window.__vol.lastDay = { id: p.id, day }; });
  }

  // ---------- one place
  function setTab(v) {
    for (const b of document.querySelectorAll('.tabs button')) b.classList.toggle('on', b.dataset.v === v);
    for (const f of document.querySelectorAll('.pic')) f.hidden = f.dataset.v !== v;
  }
  function renderPlace() {
    const p = queue[qi]; cur = p; picked = false;
    $('p-step').textContent = mode === 'practice' ? `Practice ${qi + 1} of ${queue.length}` : `Place ${qi + 1} of ${queue.length}`;
    resetPics(); setTab(p.first_view || 'wide'); $('pic-note').hidden = true;
    day = 0; window.__vol.lastPictures = null;
    $('b-day').hidden = !((p.sharp || []).length > 1);
    // heat strip
    const cells = C.stripCells(p);
    $('strip').innerHTML = cells.map((c, i) => `<button type="button" data-i="${i}" aria-label="${C.monthDetail(c)}"><span class="cell" style="background:${shade(c.shade)}"></span><span class="m">${c.month[0]}</span></button>`).join('');
    $('strip-detail').textContent = 'Tap a month to see how many times each camera saw heat.';
    for (const b of $('strip').querySelectorAll('button')) b.onclick = () => {
      for (const x of $('strip').querySelectorAll('button')) x.classList.toggle('sel', x === b);
      $('strip-detail').textContent = C.monthDetail(cells[+b.dataset.i]);
    };
    $('facts').innerHTML = C.chips(p).map(c => `<li title="${c.alt}"><span class="ico" role="img" aria-label="${c.alt}">${ICON[c.icon]}</span><b aria-hidden="true">${c.value}</b></li>`).join('');
    renderThermo(p);
    // question
    for (const b of document.querySelectorAll('.answers button')) { b.disabled = false; b.classList.remove('picked'); }
    $('reveal').hidden = true; document.querySelector('.side').classList.remove('picked');
    const coach = $('coach');
    coach.hidden = mode !== 'practice';
    coach.textContent = { industry: 'Tip: how often did the cameras read heat here at night? A fire comes in a season; a steady source stays on.',
      offshore: 'Tip: how often did the cameras read heat here at night? A fire comes in a season; a steady source stays on.',
      volcano: 'Tip: look at the wide view. What kind of land is around it?',
      fire: 'Tip: look at the heat picture. Does one spot glow, or is the land burned?' }[p.nasa_answer];
    window.scrollTo(0, 0);
    curTok = {}; loadPictures(p, curTok);
  }
  // ---------- the drawn heat card (icons, not sentences; round 3)
  const ICON = {
    cal: '<svg viewBox="0 0 20 20" width="18" height="18"><rect x="2.5" y="4" width="15" height="13" rx="2" fill="none" stroke="currentColor" stroke-width="1.6"/><path d="M2.5 8h15M6.5 2.5v3M13.5 2.5v3" stroke="currentColor" stroke-width="1.6"/></svg>',
    moon: '<svg viewBox="0 0 20 20" width="18" height="18"><path d="M14.8 12.6A6.5 6.5 0 0 1 7.4 3.8a6.5 6.5 0 1 0 7.4 8.8z" fill="currentColor"/></svg>',
    sun: '<svg viewBox="0 0 20 20" width="18" height="18"><circle cx="10" cy="10" r="3.6" fill="currentColor"/><path d="M10 1.8v2.6M10 15.6v2.6M1.8 10h2.6M15.6 10h2.6M4.2 4.2l1.8 1.8M14 14l1.8 1.8M4.2 15.8 6 14M14 6l1.8-1.8" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>',
    tally: '<svg viewBox="0 0 20 20" width="18" height="18"><path d="M4 4v12M7.5 4v12M11 4v12M14.5 4v12M2.5 13.5 16.5 6.5" stroke="currentColor" stroke-width="1.6" stroke-linecap="round"/></svg>'
  };
  function moonSvg(level) {
    const o = '<circle cx="8" cy="8" r="6.5" fill="none" stroke="currentColor" stroke-width="1.4"/>';
    const f = level === 2 ? '<circle cx="8" cy="8" r="6.5" fill="currentColor"/>' : level === 1 ? '<path d="M8 1.5a6.5 6.5 0 0 1 0 13z" fill="currentColor"/>' : '';
    return `<svg viewBox="0 0 16 16" aria-hidden="true">${o}${f}</svg>`;
  }
  function flameSvg(level) {
    const s = 14 + level * 5;
    const inner = level === 2 ? '<path d="M10 22a3.5 3.5 0 0 1-3.5-3.5c0-1.8 1.4-2.8 2.2-4 .4 1.3 1 1.8 1.6 2.1.7-1 .8-2.2.8-3.4 1.4 1.3 2.4 3 2.4 5.3A3.5 3.5 0 0 1 10 22z" fill="currentColor"/>' : '';
    return `<svg viewBox="0 0 20 24" width="${s}" height="${Math.round(s * 1.2)}" aria-hidden="true"><path d="M10 1.5c1.2 4.2 6.5 6.6 6.5 12.3A6.5 6.5 0 0 1 3.5 13.8c0-3.2 1.9-4.6 3.1-6.6.4 1.6 1.2 2.6 2.4 3C9.6 7.4 8.7 4.6 10 1.5z" fill="${level >= 3 ? 'currentColor' : 'none'}" stroke="currentColor" stroke-width="1.6"/>${inner}</svg>`;
  }
  function thermoRow(o, icon, name) {
    const t = C.thermoBar(o);
    const lab = t.few ? `${name}: too few readings` : `${name}: typically ${t.mid} degrees Celsius, usually ${t.lo} to ${t.hi}`;
    const bar = t.few ? '<div class="tbar few"><span>too few readings</span></div>'
      : `<div class="tbar"><i class="band" style="left:${t.x0 * 100}%;width:${Math.max(1.5, (t.x1 - t.x0) * 100)}%"></i><i class="tick" style="left:${t.xm * 100}%"></i><i class="cap" style="left:${C.CAP_X * 100}%" title="the newer camera stops at 94 °C"></i></div>`;
    return `<div class="trow${t.few ? ' greyed' : ''}" role="img" aria-label="${lab}"><span class="ico" aria-hidden="true">${ICON[icon]}</span>${bar}<b aria-hidden="true">${t.few ? '–' : t.mid + '°'}</b></div>`;
  }
  let thermoCam = 'viirs';
  function renderThermo(p, keepCam) {
    const t = p.temp;
    const hasMoe = t.modis_day.n >= 10 || t.modis_night.n >= 10;
    if (!keepCam || !hasMoe) thermoCam = 'viirs';
    const m = C.nightMoons(p), tag = C.nightTag(p), nn = p.months_night.reduce((a, b) => a + b, 0);
    const lv = C.flameLevel(p.frp_median_mw), cam = thermoCam === 'viirs' ? 'Vee' : 'Moe';
    const d = t[thermoCam + '_day'], n = t[thermoCam + '_night'];
    const kel = (o, w) => o.n >= 10 ? `<li>${w}: typical ${o.median_k} K (${C.toC(o.median_k)} °C), usual range ${o.p10_k} to ${o.p90_k} K (10th to 90th percentile), ${o.n} readings.</li>` : `<li>${w}: ${o.n} reading${o.n === 1 ? '' : 's'}, too few to show (under 10).</li>`;
    const sw = hasMoe
      ? `<div class="camsw" role="group" aria-label="Which camera"><button type="button" data-c="viirs" class="${thermoCam === 'viirs' ? 'on' : ''}" aria-pressed="${thermoCam === 'viirs'}"><img src="img/vee_icon.webp" alt="">Vee</button><button type="button" data-c="modis" class="${thermoCam === 'modis' ? 'on' : ''}" aria-pressed="${thermoCam === 'modis'}"><img src="img/moe_icon.webp" alt="">Moe</button></div>`
      : '<span class="camone"><img src="img/vee_icon.webp" alt="">Vee</span>';
    $('thermo-card').innerHTML = `
      <h2>Heat at night</h2>
      <div class="moons" role="img" aria-label="Night readings each month of 2020: ${m.map(x => x.month + ' ' + x.n).join(', ')}">${m.map(x => `<span class="mo l${x.level}" title="${x.month}: ${x.n} night readings">${moonSvg(x.level)}<em>${x.month[0]}</em></span>`).join('')}</div>
      <p class="mlabel">${nn.toLocaleString('en-US')} night reading${nn === 1 ? '' : 's'}${tag ? ` <b class="tag ${tag === 'stays on' ? 'on' : 'goes'}">${tag}</b>` : ''}</p>
      <div class="thead"><h2>How hot it read</h2>${sw}</div>
      ${thermoRow(d, 'sun', cam + ' by day')}
      ${thermoRow(n, 'moon', cam + ' by night')}
      <div class="tscale" aria-hidden="true"><span>${C.SCALE_C[0]}°</span><span>${C.SCALE_C[1]}°C</span></div>
      <div class="flame" role="img" aria-label="Typical fire power: ${C.FLAME_WORDS[lv]}, ${p.frp_median_mw} megawatts"><span class="fl">${flameSvg(lv)}</span><b aria-hidden="true">${C.FLAME_WORDS[lv]} power</b><small aria-hidden="true">${p.frp_median_mw} MW</small></div>
      <details class="info"><summary>ⓘ What am I looking at?</summary>
        <p><b>Moons:</b> one per month. Empty = no heat seen at night; half = 1 to 9 night readings; full = ${C.NIGHT_FULL} or more. Vee and Moe together.</p>
        <p><b>Thermometers:</b> the band is the usual range (10th to 90th percentile of the readings), the line the typical reading (median), on one scale from ${C.SCALE_C[0]} to ${C.SCALE_C[1]} °C for every place. The small cap marks 94 °C (367 K), where the newer camera's readings stop.</p>
        <ul>${kel(t.viirs_day, 'Vee by day')}${kel(t.viirs_night, 'Vee by night')}${kel(t.modis_day, 'Moe by day')}${kel(t.modis_night, 'Moe by night')}</ul>
        <p>This is the temperature of the whole patch of ground the camera saw (375 m or 1 km across), fire and cooler ground mixed, not the flames. A small, very hot source reads much cooler than it is.</p>
        <p><b>Flame:</b> typical (median) fire power of ${p.detections.toLocaleString('en-US')} detections. Under 2 MW faint, 2 to 5 low, 5 to 15 medium, 15 or more strong.</p>
      </details>`;
    for (const b of $('thermo-card').querySelectorAll('.camsw button')) b.onclick = () => { thermoCam = b.dataset.c; renderThermo(p, true); };
  }
  function shade(s) { return ['transparent', '#f6d58a', '#f2b134', '#e07a1f', '#b8400f'][s]; }

  function answer(pick) {
    if (picked) return; picked = true; document.querySelector('.side').classList.add('picked');
    const p = cur;
    for (const b of document.querySelectorAll('.answers button')) { b.disabled = true; b.classList.toggle('picked', b.dataset.a === pick); }
    picks.push({ id: p.id, pick, nasa: p.nasa_answer, practice: mode === 'practice' });
    seen.add(p.id);
    $('r-you').textContent = 'You said: ' + C.ANSWERS[pick] + '.';
    $('r-nasa').textContent = "NASA's label says: " + C.NASA_WORDS[p.nasa_answer];
    const a = C.agrees(pick, p.nasa_answer), bd = $('r-badge');
    bd.className = 'badge ' + (a === true ? 'agree' : a === false ? 'differ' : 'none');
    bd.textContent = a === true ? 'You agree with NASA\'s label' : a === false ? 'Different from NASA\'s label' : 'No guess this time. That\'s a fine answer.';
    $('r-clue').textContent = C.clue(p);
    $('b-next').textContent = qi + 1 < queue.length ? 'Next place' : (mode === 'practice' ? 'Start the real round' : 'See how you did');
    $('reveal').hidden = false;
    $('r-tally').hidden = true;
    updateScore();
    if (saving) savePick(p.id, pick);
    if (innerWidth < 900) setTimeout(() => $('reveal').scrollIntoView({ behavior: 'smooth', block: 'start' }), 60);
  }

  // ---------- saving everyone's picks (optional; silent on any failure, never blocks Next)
  async function savePick(place, pick) {
    try {
      const r = await fetch(picksUrl.replace(/\/$/, '') + '/pick', { method: 'POST', headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ place, pick, session }), credentials: 'omit', mode: 'cors' });
      if (r.status === 507 || r.status === 503) { saving = false; return; }   // full or read-only: stop offering
      const t = await fetch(picksUrl.replace(/\/$/, '') + '/tally?place=' + encodeURIComponent(place), { credentials: 'omit', mode: 'cors' });
      if (!t.ok) return;
      const j = await t.json();
      if (cur && cur.id === place) showTally(j.counts);
    } catch (e) { /* silent: the visitor never waits on saving */ }
  }
  function showTally(c) {
    if (!c) return;
    const keys = ['fire', 'industry', 'volcano', 'something', 'canttell'];
    const tot = keys.reduce((s, k) => s + (c[k] || 0), 0);
    if (!tot) return;
    const el = $('r-tally');
    el.innerHTML = `<b>What other visitors said</b> (${tot} pick${tot === 1 ? '' : 's'}, yours included)<div class="bars">` +
      keys.map(k => `<div class="bar"><span>${C.ANSWERS[k]}</span><i style="width:${Math.round((c[k] || 0) / tot * 100)}%"></i><span>${c[k] || 0}</span></div>`).join('') +
      `</div><span class="small">Other visitors' picks are guesses, like yours. NASA's label is the answer key.</span>`;
    el.hidden = false;
  }

  // ---------- flow
  function next() {
    qi++;
    if (qi < queue.length) return renderPlace();
    if (mode === 'practice') return startRound();
    endRound();
  }
  function startRound() {
    mode = 'round'; roundNo++;
    queue = C.drawRound(PLACES, seen, 10, Math.random); qi = 0;
    if (!queue.length) return endRound(true);
    show('s-place'); renderPlace();
  }
  function endRound(empty) {
    const s = C.score(picks.filter(r => !r.practice));
    $('e-title').textContent = empty ? 'You have seen every place!' : 'Nice detective work!';
    $('e-score').textContent = s.total
      ? `You agreed with NASA's label on ${s.agree} of ${s.total} places` + (s.none ? `, and said "I can't tell" on ${s.none}.` : '.')
      : '';
    const left = PLACES.filter(p => !p.practice && !seen.has(p.id)).length;
    $('b-more').hidden = !left;
    $('b-more').textContent = left >= 10 ? '10 more places' : `${left} more place${left === 1 ? '' : 's'}`;
    const m = $('b-main');
    if (MAIN_URL) { m.href = MAIN_URL; m.hidden = false; } else m.hidden = true;
    show('s-end');
  }

  // ---------- start
  function privacyLines() {
    $('privacy-line').textContent = saving
      ? 'We save your pick, the place, the minute and a random visit code. Nothing about you or your device.'
      : 'Your picks stay on this screen. Nothing is saved or sent anywhere.';
    $('about-saving').innerHTML = saving
      ? '<b>What is saved:</b> for each pick, the place, the answer you chose, the time to the minute, and a random visit code made up when the page opened. <b>Not saved:</b> your name, your device\'s address, your browser, or anything you type. Your running score lives only on your screen.'
      : '<b>Nothing is saved.</b> Your picks and your score live only in this page while it is open. Nothing is sent anywhere.';
  }
  async function init() {
    privacyLines();
    for (const b of document.querySelectorAll('.tabs button')) b.onclick = () => setTab(b.dataset.v);
    for (const b of document.querySelectorAll('.answers button')) b.onclick = () => answer(b.dataset.a);
    $('b-next').onclick = next;
    $('b-day').onclick = anotherDay;
    $('about-link').onclick = e => { e.preventDefault(); const d = $('about'); d.open = true; d.scrollIntoView({ behavior: 'smooth' }); };
    $('b-more').onclick = startRound;
    $('b-start').disabled = true;
    try {
      const d = await (await fetch('data/places.json')).json();
      PLACES = d.places;
    } catch (e) {
      $('privacy-line').textContent = 'The place list did not load. Please reload the page.';
      return;
    }
    if (saving) {   // ask the picks service whether it takes picks; silent if not
      try {
        const h = await (await fetch(picksUrl.replace(/\/$/, '') + '/health', { credentials: 'omit', mode: 'cors' })).json();
        if (!h.ok || h.accepting === false) saving = false;
      } catch (e) { saving = false; }
      privacyLines();
    }
    $('b-start').disabled = false;
    $('b-start').onclick = () => {
      mode = 'practice';
      queue = PLACES.filter(p => p.practice); qi = 0;
      show('s-place'); renderPlace();
    };
  }
  window.__vol = { timing, picks, get queue() { return queue; }, get cur() { return cur && cur.id; }, get saving() { return saving; }, session: () => session.length };
  init();
})();
