/* explore.js: the burning calendar for any country, picked on a globe (team lead, Nov 15, 1:34 PM).
   Reads the engine, the adapters and the readings read-only, and data/world_table.json + data/world_shapes.json. Every number comes from them.
   The globe's colors are each country's latest month against its usual (the world table's own verdict word, the page's wording). */
(function () {
  'use strict';
  const E = window.HSEngine, A = window.HSAdapters, R = window.Readings;
  const $ = id => document.getElementById(id);
  const esc = s => String(s == null ? '' : s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
  const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const fmt = v => v == null || !isFinite(v) ? 'no data' : Math.round(v).toLocaleString('en-US');
  const q = new URLSearchParams(location.search);
  const st = { L: null, W: null, shapes: null, rows: {}, file: q.get('place') || 'Argentina', r: null, view: 'lines', scale: q.get('scale') === 'modis' ? 'modis' : 'viirs', lon0: -60, lat0: -15, req: 0 };
  // the verdict colors: quieter (cool), about normal (soft gold), busier (ember); no verdict (dark)
  const VC = { 'much quieter': '#3f6fb0', 'quieter': '#6f95c6', 'about usual': '#c9a560', 'busier': '#f08a4b', 'much busier': '#ff5a2a' };
  const KEY = [['much quieter', 'Far quieter than normal'], ['quieter', 'Quieter'], ['about usual', 'About normal'], ['busier', 'Busier'], ['much busier', 'Far busier']];

  /* ---------------- the globe: orthographic, drag to turn, click to pick ---------------- */
  const cv = $('globe'), g = cv.getContext('2d'), RAD = Math.PI / 180;
  let D = 640, Rr = 300, c = 320;
  function fwd(lon, lat) { const dl = (lon - st.lon0) * RAD, la = lat * RAD, sl = Math.sin(st.lat0 * RAD), cl = Math.cos(st.lat0 * RAD);
    return [Math.cos(la) * Math.sin(dl), cl * Math.sin(la) - sl * Math.cos(la) * Math.cos(dl), sl * Math.sin(la) + cl * Math.cos(la) * Math.cos(dl)]; }
  function inv(px, py) {      // screen -> lon, lat (null off the globe)
    const x = (px - c) / Rr, y = (c - py) / Rr, r2 = x * x + y * y; if (r2 > 1) return null;
    const z = Math.sqrt(1 - r2), p0 = st.lat0 * RAD, la = Math.asin(y * Math.cos(p0) + z * Math.sin(p0)), lo = Math.atan2(x, z * Math.cos(p0) - y * Math.sin(p0));
    return [st.lon0 + lo / RAD, la / RAD]; }
  function inRing(ring, lon, lat) { let ins = false; for (let i = 0, j = ring.length - 1; i < ring.length; j = i++) { const xi = ring[i][0] / 10, yi = ring[i][1] / 10, xj = ring[j][0] / 10, yj = ring[j][1] / 10;
    if (((yi > lat) !== (yj > lat)) && lon < (xj - xi) * (lat - yi) / (yj - yi) + xi) ins = !ins; } return ins; }
  function hit(lon, lat) { if (!st.shapes) return null; for (const sh of st.shapes.shapes) { for (const ring of sh.rings) if (inRing(ring, lon, lat)) return sh.file; } return null; }
  function drawGlobe() {
    const w = cv.clientWidth || 640, dpr = Math.min(2, window.devicePixelRatio || 1); D = Math.round(w * dpr); if (cv.width !== D) { cv.width = cv.height = D; } Rr = D * .47; c = D / 2;
    g.clearRect(0, 0, D, D);
    const oc = g.createRadialGradient(c * .8, c * .76, D * .05, c, c, Rr); oc.addColorStop(0, '#12305a'); oc.addColorStop(1, '#050d1c');
    g.fillStyle = oc; g.beginPath(); g.arc(c, c, Rr, 0, 2 * Math.PI); g.fill();
    g.save(); g.beginPath(); g.arc(c, c, Rr, 0, 2 * Math.PI); g.clip();
    g.strokeStyle = 'rgba(140,170,210,.12)'; g.lineWidth = dpr;
    for (let la = -60; la <= 60; la += 30) { g.beginPath(); let on = false; for (let lo = -180; lo <= 180; lo += 3) { const p = fwd(lo, la); if (p[2] < 0) { on = false; continue; } const X = c + p[0] * Rr, Y = c - p[1] * Rr; if (on) g.lineTo(X, Y); else { g.moveTo(X, Y); on = true; } } g.stroke(); }
    if (st.shapes) for (const sh of st.shapes.shapes) {
      if (!sh.rings.some(rg => rg.some(([x, y]) => fwd(x / 10, y / 10)[2] > 0))) continue;
      g.beginPath();
      for (const rg of sh.rings) { let first = true; for (const [x, y] of rg) { const p = fwd(x / 10, y / 10); let X, Y; if (p[2] < 0) { const k = Math.hypot(p[0], p[1]) || 1; X = c + p[0] / k * Rr; Y = c - p[1] / k * Rr; } else { X = c + p[0] * Rr; Y = c - p[1] * Rr; }
        if (first) { g.moveTo(X, Y); first = false; } else g.lineTo(X, Y); } g.closePath(); }
      const row = st.rows[sh.file], word = row && row.period && row.period.word;
      g.fillStyle = word && VC[word] ? VC[word] : '#22324a'; g.fill();
      g.strokeStyle = 'rgba(8,14,26,.8)'; g.lineWidth = dpr; g.stroke();
    }
    const ps = st.shapes && st.shapes.shapes.find(s => s.file === st.file);
    if (ps) { g.beginPath(); for (const rg of ps.rings) { let first = true, vis = false; for (const [x, y] of rg) { const p = fwd(x / 10, y / 10); if (p[2] >= 0) vis = true; const X = c + p[0] * Rr, Y = c - p[1] * Rr; if (first) { g.moveTo(X, Y); first = false; } else g.lineTo(X, Y); } g.closePath(); }
      g.save(); g.shadowColor = 'rgba(255,205,121,.9)'; g.shadowBlur = 12 * dpr; g.strokeStyle = '#fff3d6'; g.lineWidth = 3.5 * dpr; g.stroke(); g.restore(); }
    g.restore();
    const sh = g.createRadialGradient(c - Rr * .35, c - Rr * .4, Rr * .2, c, c, Rr); sh.addColorStop(0, 'rgba(255,255,255,0)'); sh.addColorStop(.8, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,4,12,.45)');
    g.fillStyle = sh; g.beginPath(); g.arc(c, c, Rr, 0, 2 * Math.PI); g.fill(); g.strokeStyle = 'rgba(120,170,255,.5)'; g.lineWidth = 2 * dpr; g.stroke();
  }
  function centreOn(file) { const sh = st.shapes && st.shapes.shapes.find(s => s.file === file); if (!sh) return; let best = null, area = -1;
    for (const r of sh.rings) { let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9; for (const [x, y] of r) { x0 = Math.min(x0, x); x1 = Math.max(x1, x); y0 = Math.min(y0, y); y1 = Math.max(y1, y); } const a = (x1 - x0) * (y1 - y0); if (a > area) { area = a; best = [(x0 + x1) / 20, (y0 + y1) / 20]; } }
    if (best) { st.lon0 = best[0]; st.lat0 = Math.max(-60, Math.min(60, best[1])); } }
  let drag = null;
  cv.addEventListener('pointerdown', e => { drag = { x: e.clientX, y: e.clientY, lon: st.lon0, lat: st.lat0, moved: false }; cv.setPointerCapture(e.pointerId); });
  cv.addEventListener('pointermove', e => { if (!drag) return; const dx = e.clientX - drag.x, dy = e.clientY - drag.y; if (Math.abs(dx) + Math.abs(dy) > 4) drag.moved = true;
    const k = 180 / (cv.clientWidth || 640); st.lon0 = drag.lon - dx * k; st.lat0 = Math.max(-80, Math.min(80, drag.lat + dy * k)); drawGlobe(); });
  cv.addEventListener('pointerup', e => { const d = drag; drag = null; if (!d || d.moved) return; const b = cv.getBoundingClientRect(), dpr = cv.width / b.width;
    const ll = inv((e.clientX - b.left) * dpr, (e.clientY - b.top) * dpr); if (!ll) return; const f = hit(ll[0], ll[1]); if (f && st.rows[f]) pick(f, false); });
  cv.addEventListener('pointercancel', () => { drag = null; });

  /* ---------------- the calendar for the picked country ---------------- */
  function shown() { if (!st.r) return null; if (st.scale !== 'viirs') return st.r; return (R.scaleCheck(st.r).ok && R.onScale(st.r, 'viirs')) || st.r; }
  function pick(file, recentre) {
    st.file = file; if (recentre) centreOn(file); drawGlobe();
    try { history.replaceState(null, '', '?place=' + encodeURIComponent(file) + (st.scale === 'modis' ? '&scale=modis' : '')); } catch (e) {}
    const n = ++st.req; $('answer').innerHTML = '<p class="xp-loading">Opening ' + esc(R.displayName(file)) + '…</p>'; $('cal').innerHTML = '';
    E.query({ country: file }, st.L).then(async r => { await R.loadAvailability(st.L, r); if (n !== st.req) return; st.r = r; render(); })
      .catch(e => { if (n !== st.req) return; st.r = null; $('answer').innerHTML = '<p class="xp-name">' + esc(R.displayName(file)) + '</p><p class="xp-msg">Nothing to show here: ' + esc(e.message) + '</p>'; $('cal').innerHTML = ''; });
  }
  function render() {
    const r = shown(), chk = R.scaleCheck(st.r);
    document.querySelectorAll('[data-scale]').forEach(b => { b.setAttribute('aria-pressed', String((chk.ok ? st.scale : 'modis') === b.dataset.scale)); b.disabled = b.dataset.scale === 'viirs' && !chk.ok; });
    document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(st.view === b.dataset.view)));
    const pos = R.positions(r), s = R.screen(r, pos.month || 'latest'), name = R.displayName(st.file);
    if (s.refusal) { $('answer').innerHTML = `<p class="xp-name">${esc(name)}</p><p class="xp-msg">${esc(s.refusal)}</p>`; $('cal').innerHTML = ''; $('cap').textContent = ''; $('csv').hidden = true; return; }
    const f = s.f, ours = f.ours || {};
    const usual = ours.value != null && ours.typical != null ? `<p class="xp-vs"><b>This month against its usual:</b> ${fmt(ours.value)} hot spot detections; the usual is ${fmt(ours.typical)} (the historical median: the middle of the other years).</p>` : '';
    $('answer').innerHTML = `<p class="xp-name">${esc(name)} <span>· ${esc(s.label)}</span></p><p class="xp-q">${esc(s.question)}</p><p class="xp-a">${esc(s.answer)}</p>` +
      (s.weak ? `<p class="xp-weak">${esc(s.weak)}</p>` : '') + (s.tooLittle ? `<p class="xp-weak">${esc(s.tooLittle)}</p>` : '') + usual +
      (s.modis && s.modis.text ? `<p class="xp-note">${esc(s.modis.text)}</p>` : '') +
      (!chk.ok && chk.why ? `<p class="xp-note">${esc(chk.why)}</p>` : '');
    const cal = A.calendar(r);
    if (A.isRefusal(cal)) { $('cal').innerHTML = `<p class="xp-msg">${esc(cal.message)}</p>`; $('cap').textContent = ''; }
    else if (st.view === 'grid') drawGrid(r, cal); else drawLines(r, cal);
    const unit = (chk.ok ? st.scale : 'modis') === 'viirs' ? "VIIRS's scale" : "MODIS's scale";
    $('cap').textContent = st.view === 'grid' ? `Each month shaded against the same month in other years (quieter to busier, not the amount); year totals on the right. Hot spot detections on ${unit}.`
      : `One line = one year. One point = one month. Height = hot spot detections, on ${unit}; the newest whole year in gold.`;
    const a = $('csv'); a.hidden = false; try { if (a.dataset.url) URL.revokeObjectURL(a.dataset.url); // the file matches the scale on screen (4:14 PM); its columns name the scale (value_on_viirs_scale), and so do the link and the file name
      const sc = (chk.ok ? st.scale : 'modis'), u = URL.createObjectURL(new Blob([R.csv(r)], { type: 'text/csv' })); a.href = u; a.dataset.url = u;
      a.download = st.file + '_monthly_detections_' + (sc === 'viirs' ? 'VIIRS' : 'MODIS') + '_scale.csv'; a.textContent = "Download the monthly table (CSV, on " + (sc === 'viirs' ? "VIIRS's" : "MODIS's") + " scale)"; } catch (e) { a.hidden = true; }
  }
  function drawLines(r, cal) {
    const tot = {}; for (const y of R.yearly(r)) tot[y.year] = y.complete && y.ours != null ? y.ours : null;
    const whole = cal.years.filter(y => tot[y] != null), last = whole.length ? Math.max(...whole) : cal.years[cal.years.length - 1];
    const years = cal.years.filter(y => y <= last), vals = years.map(y => cal.cells[cal.years.indexOf(y)]);
    const all = vals.flat().filter(v => v != null), mx = all.length ? Math.max(...all) : 0;
    $('cal').innerHTML = '<canvas class="xp-ridges" width="1100" height="520" role="img"></canvas>';
    const rc = $('cal').firstChild, x = rc.getContext('2d'); rc.setAttribute('aria-label', `${R.displayName(st.file)}: one line per year, ${years[0]} to ${last}, one point per month; the busiest month on this chart has ${fmt(mx)} hot spot detections`);
    if (!mx) { $('cal').innerHTML = '<p class="xp-msg">No month here has hot spot detections to draw.</p>'; return; }
    const W = 1100, H = 520, left = 70, right = W - 30, amp = 190, back = amp + 16, front = H - 44, shift = 140, N = years.length;
    const pt = (i, m, v) => { const t = i / Math.max(1, N - 1); return { x: left + (1 - t) * shift + m / 11 * (right - left - shift), y: back + t * (front - back) - (v || 0) / mx * amp }; };
    for (let m = 0; m < 12; m++) { const a = pt(0, m, 0), b = pt(N - 1, m, 0); x.beginPath(); x.moveTo(a.x, a.y); x.lineTo(b.x, b.y); x.strokeStyle = 'rgba(120,150,200,.22)'; x.lineWidth = 1; x.stroke();
      x.fillStyle = '#a5b2c2'; x.font = '500 20px JetBrains Mono, monospace'; x.textAlign = 'center'; x.fillText(MON3[m], b.x, b.y + 28); }
    for (let i = 0; i < N; i++) { const newest = i === N - 1, y = years[i], pts = vals[i].map((v, m) => ({ v, m, ...pt(i, m, v), y0: pt(i, m, 0).y }));
      const runs = []; let run = []; for (const p of pts) { if (p.v == null) { if (run.length) runs.push(run); run = []; } else run.push(p); } if (run.length) runs.push(run);
      for (const ps of runs) { x.beginPath(); x.moveTo(ps[0].x, ps[0].y0); for (const p of ps) x.lineTo(p.x, p.y); x.lineTo(ps[ps.length - 1].x, ps[ps.length - 1].y0); x.closePath();
        x.fillStyle = newest ? 'rgba(120,70,20,.55)' : 'rgba(8,18,40,.88)'; x.fill(); x.beginPath(); ps.forEach((p, k) => k ? x.lineTo(p.x, p.y) : x.moveTo(p.x, p.y));
        const k = i / Math.max(1, N - 1); x.strokeStyle = newest ? '#ffcd79' : `rgba(${Math.round(110 + 145 * k)},${Math.round(140 + 30 * k)},${Math.round(210 - 120 * k)},${(.45 + .45 * k).toFixed(2)})`; x.lineWidth = newest ? 4 : 1.6; x.stroke(); }
      if (y % 5 === 0 || newest) { const b0 = pt(i, 0, 0); x.font = `${newest ? 700 : 500} ${newest ? 20 : 17}px JetBrains Mono, monospace`; x.textAlign = 'right'; x.fillStyle = newest ? '#ffcd79' : '#a5b2c2'; x.fillText(String(y), b0.x - 10, b0.y + 6); } }
  }
  function drawGrid(r, cal) {
    const tot = {}; for (const y of R.yearly(r)) tot[y.year] = y.complete && y.ours != null ? y.ours : null;
    const shade = rk => rk == null ? 'transparent' : 'rgba(255,205,121,' + (0.07 + 0.6 * rk).toFixed(3) + ')';
    $('cal').innerHTML = `<table class="xp-grid"><thead><tr><th></th>${MON3.map(m => `<th>${m}</th>`).join('')}<th>Year</th></tr></thead><tbody>${cal.years.map((y, i) => `<tr><th>${y}</th>${MON3.map((_, m) => { const v = cal.cells[i][m];
      return `<td style="background:${v == null ? 'transparent' : shade(cal.rank[i][m])}${cal.rank[i][m] > .62 ? ';color:#060e19' : ''}">${v == null ? '' : fmt(v)}</td>`; }).join('')}<td class="t">${tot[y] != null ? fmt(tot[y]) : ''}</td></tr>`).join('')}</tbody></table>`;
  }

  /* ---------------- controls, search, links ---------------- */
  document.querySelectorAll('[data-view]').forEach(b => b.addEventListener('click', () => { st.view = b.dataset.view; if (st.r) render(); }));
  document.querySelectorAll('[data-scale]').forEach(b => b.addEventListener('click', () => { if (b.disabled) return; st.scale = b.dataset.scale; if (st.r) { render(); try { history.replaceState(null, '', '?place=' + encodeURIComponent(st.file) + (st.scale === 'modis' ? '&scale=modis' : '')); } catch (e) {} } }));
  $('q').addEventListener('change', () => { const v = $('q').value.trim().toLowerCase(); const row = Object.values(st.rows).find(r => r.name.toLowerCase() === v) || Object.values(st.rows).find(r => r.name.toLowerCase().startsWith(v));
    if (row) { pick(row.file, true); $('q').value = ''; } });
  function links() { const B = window.StoryBeats || {}; if (B.connectorAddress) { $('l-conn').href = B.connectorAddress; } if (B.volunteerAddress) $('l-vol').href = B.volunteerAddress; }
  window.addEventListener('resize', () => { drawGlobe(); });

  /* ---------------- start ---------------- */
  (async () => {
    try {
      const [L, W, shapes] = await Promise.all([E.open({ base: 'parts/engine_and_data/' }), fetch('data/world_table.json').then(r => r.json()), fetch('data/world_shapes.json').then(r => r.json())]);
      st.L = L; st.W = W; st.shapes = shapes; W.rows.forEach(r => { st.rows[r.file] = r; });
      $('names').innerHTML = W.rows.map(r => `<option value="${esc(r.name)}">`).join('');
      $('key').innerHTML = 'Latest month against its usual: ' + KEY.map(([k, t]) => `<span><i style="background:${VC[k]}"></i>${t}</span>`).join('') + '<span><i style="background:#22324a"></i>too little to judge</span>';
      if (!st.rows[st.file]) st.file = 'Argentina';
      links(); setTimeout(links, 800);
      pick(st.file, true);
    } catch (e) { $('answer').innerHTML = '<p class="xp-msg">The record could not be opened: ' + esc(e.message) + '</p>'; }
  })();
})();
