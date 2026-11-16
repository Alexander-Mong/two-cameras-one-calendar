// record.js: room 3, the record (DESIGN.md section 4, room 3, with A4, A6, A7, A8; the world map is in record_world.js).
// Numbers come from Readings and the engine/adapters; this file only draws them.
(function (root) {
  'use strict';
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const MON3 = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const TABS = [['calendar', 'Month by month'], ['years', 'Every year'], ['thisyear', 'This year'], ['world', 'The world'], ['sentence', 'In a report'], ['ask', 'Ask your own AI'], ['how', 'How we know']];
  const NEEDS_DATA = { calendar: 1, table: 1, years: 1, thisyear: 1, sentence: 1 };
  const mem = {};   // per place: selected month, year, glued switch
  const memo = (place) => mem[place] || (mem[place] = { ym: null, year: null, glued: false, sentYm: null, frontYear: null, view: 'depth' });
  const UNIT_LINE = root.Readings ? root.Readings.UNIT_SENTENCE : '';
  const cleanWhy = (s) => String(s || '').replace(/\s*\(fix \d+:[^)]*\)/g, '').replace(/^./, c => c.toUpperCase());
  const monthName = (ym) => root.Readings.MONTHS[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4);

  function render(el, ctx, tab) {
    const R = root.Readings, A = root.HSAdapters, r = ctx.result, place = R.displayName(ctx.place);
    const latest = r ? R.forPeriod(r, 'latest') : null;
    const refused = ctx.error ? ctx.error : latest && latest.refusal ? latest.refusal.message : null;
    if (refused && NEEDS_DATA[tab]) tab = 'world';
    const tabs = TABS.map(([k, label]) => {
      const off = refused && NEEDS_DATA[k];
      return '<a class="tab" ' + (off ? 'aria-disabled="true" tabindex="-1" style="opacity:.4;pointer-events:none"' : 'href="#record/' + k + '"') + (k === tab || (k === 'calendar' && tab === 'table') ? ' aria-current="page"' : '') + '>' + label + '</a>';
    }).join('');
    el.innerHTML = '<div class="record"><nav class="rtabs" aria-label="Record tabs">' + tabs + '</nav>' +
      (refused ? '<div class="rpanel" style="flex:none;padding-bottom:0"><div class="message">Nothing to show here: ' + esc(refused) + '.</div></div>' : '') +
      '<div class="rpanel fade-in" id="rpanel"></div></div>';
    const p = el.querySelector('#rpanel');
    if (tab === 'calendar') monthly(p, ctx);
    else if (tab === 'table') calendar(p, ctx);
    else if (tab === 'years') years(p, ctx);
    else if (tab === 'thisyear') thisYear(p, ctx);
    else if (tab === 'world') { if (root.RecordWorld) root.RecordWorld.render(p, ctx); else p.innerHTML = '<div class="message">The world map is being built.</div>'; }
    else if (tab === 'sentence') sentence(p, ctx);
    else if (tab === 'ask') ask(p, ctx);
    else how(p, ctx);
  }

  // ---------- 1. month by month: one year in front, the earlier years standing behind (VOICE_AND_COPY_0704.md section 4) ----------
  const CAMS = { Terra: 'MODIS on Terra, the earliest camera', Aqua: 'MODIS on Aqua, NASA\'s older camera', SNPP: 'VIIRS on S-NPP, the newer camera', NOAA20: 'VIIRS on NOAA-20, the newer camera\'s twin' };
  const ymOf = (y, mo) => y + '-' + (mo < 10 ? '0' : '') + mo;
  function monthly(p, ctx) {
    const R = root.Readings, A = root.HSAdapters, E = root.HSEngine, D = root.RecordDepth, r = ctx.result, m = memo(ctx.place);
    const cal = A.calendar(r);
    if (A.isRefusal(cal)) { p.innerHTML = '<div class="message">Nothing to show here: ' + esc(cal.message) + '.</div>'; return; }
    const rowOf = {}; for (const x of r.monthly) rowOf[x.ym] = x;
    const latestYm = r.current ? r.current.ym : r.latest ? r.latest.ym : cal.years[cal.years.length - 1] + '-12';
    const curYear = r.current ? +r.current.ym.slice(0, 4) : null;
    const years = cal.years.map((y, i) => ({ y,
      v: cal.cells[i].slice(),
      modis: cal.cells[i].map((_, k) => R.modisMonth(r, ymOf(y, k + 1))),
      early: cal.cells[i].map((_, k) => { const ym = ymOf(y, k + 1), x = rowOf[ym]; return !!x && x.value !== null && (x.status === 'partial' || R.isProvisional(r, ym)); }),
      partial: cal.cells[i].map((_, k) => { const x = rowOf[ymOf(y, k + 1)]; return x && x.status === 'partial' ? x.days : null; }) }));
    const shapes = {};
    const usualFor = (y) => { if (!(y in shapes)) { const s = A.yearShape(r, y); shapes[y] = A.isRefusal(s) ? null : s.months.map(x => x.typical); } return shapes[y]; };
    let max = 1; for (const yr of years) for (const v of yr.v.concat(yr.modis)) if (v !== null && v > max) max = v;
    const label = (y) => y + (y === curYear ? ' so far' : '');
    const biggest = r.year_totals.filter(t => t.complete && t.total !== null).sort((a, b) => b.total - a.total).slice(0, 2).map(t => t.year);
    const data = { years, usualFor, max, label, biggest };
    if (!m.frontYear || cal.years.indexOf(m.frontYear) < 0) m.frontYear = +latestYm.slice(0, 4);
    // the heading's one sentence: the season from the engine, then the year's verdict (same gates as the first screen)
    const place = R.displayName(ctx.place), sm = R.seasonMonths(r), MONTHS = R.MONTHS;
    const quietPlace = ((r.unit ? r.unit.base : r).month_of_year_medians || []).every(v => v === null || v < R.TOO_FEW);   // the floor is read on MODIS's scale
    let line = quietPlace ? place + ' sees hardly any fire in most years.' :
      sm.length === 1 ? place + ' burns most in ' + MONTHS[sm[0] - 1] + '.' : sm.length ? place + ' burns most from ' + MONTHS[sm[0] - 1] + ' to ' + MONTHS[sm[sm.length - 1] - 1] + '.' : '';
    const pos = R.positions(r);
    if (pos.year && !quietPlace) { const f = R.forPeriod(r, pos.year), w = f.lead === 'ours' ? f.ours.word : f.lead === 'modis' ? f.older.word : null;
      if (w) line += ' ' + f.year + (f.kind === 'yearSoFar' ? ' has been ' : ' was ') + R.say(w).toLowerCase() + (f.lead === 'modis' ? ', going by MODIS' : '') + '.'; }
    const yearBtns = cal.years.map(y => '<button type="button" data-y="' + y + '">' + y + '</button>').join('');
    p.innerHTML = '<div class="mm">' +
      '<div class="mm-head"><h2>A year of fire, <em>month by month</em></h2><p class="mm-line">' + esc(line) + '</p></div>' +
      '<div class="two mm-two"><div class="mm-main">' +
        '<div class="mm-controls"><div class="mm-step"><button type="button" class="btn quiet mm-prev" aria-label="Earlier year">◂</button><span class="mm-year" aria-live="polite"></span><button type="button" class="btn quiet mm-next" aria-label="Later year">▸</button></div>' +
          '<div class="switch" role="group" aria-label="How the years are drawn"><button type="button" data-v="depth" data-shot="depth">Stacked in depth</button><button type="button" data-v="lines" data-shot="lines">Laid over each other</button></div></div>' +
        '<svg class="mm-svg" role="img" tabindex="0" aria-label="' + esc(place) + ', months of each year on one scale; Left and Right arrows move through the years"></svg>' +
        '<ul class="key mm-key"></ul>' +
        '<div class="mm-years" role="group" aria-label="Choose a year">' + yearBtns + '</div>' +
      '</div><div class="mm-sidecol"><aside class="side" id="mm-side" aria-live="polite"></aside>' +
        '<p class="note mm-links"><a href="#record/table">Show the table ▸</a></p><p class="note">' + esc(UNIT_LINE) + '</p></div></div></div>';
    const svg = p.querySelector('.mm-svg'), side = p.querySelector('#mm-side'), yl = p.querySelector('.mm-year'), keyEl = p.querySelector('.mm-key');
    const pickMonth = (y) => { if (m.ym && +m.ym.slice(0, 4) === y && rowOf[m.ym]) return m.ym;
      const yr = years.find(q => q.y === y); let best = null; if (yr) yr.v.forEach((v, i) => { if (v !== null && (best === null || v > yr.v[best])) best = i; });
      return y === +latestYm.slice(0, 4) ? latestYm : best === null ? null : ymOf(y, best + 1); };
    function showMonth(ym) { m.ym = ym; side.innerHTML = ym ? detail(r, ym, E, R) : '<p>No months with data in this year.</p>';
      for (const b of svg.querySelectorAll('.dbar')) b.classList.toggle('sel', !!ym && +ym.slice(0, 4) === m.frontYear && +b.dataset.i === +ym.slice(5, 7) - 1); }
    function onYear(y) { m.frontYear = y; yl.textContent = label(y);
      for (const b of p.querySelectorAll('.mm-years button')) { const on = +b.dataset.y === y; b.classList.toggle('on', on); if (on) b.setAttribute('aria-current', 'true'); else b.removeAttribute('aria-current'); }
      p.querySelector('.mm-prev').disabled = y <= cal.years[0]; p.querySelector('.mm-next').disabled = y >= cal.years[cal.years.length - 1];
      const strip = p.querySelector('.mm-years'), on = strip.querySelector('.on'); if (on && strip.scrollWidth > strip.clientWidth) strip.scrollLeft = on.offsetLeft - strip.clientWidth / 2;
      showMonth(pickMonth(y)); if (m.view === 'lines') draw(); }
    const depth = new D.Depth(svg, { still: ctx.still, onYear, onMonth: (y, i) => showMonth(ymOf(y, i + 1)) });
    const hasModis = years.some(q => q.modis.some(v => v !== null));
    function draw() {
      for (const b of p.querySelectorAll('.switch button')) b.setAttribute('aria-pressed', String(b.dataset.v === m.view));
      keyEl.innerHTML = '<li><i class="k-gold"></i>' + esc(label(m.frontYear)) + '</li><li><i class="k-typ"></i>the usual month</li>' +
        (hasModis && m.view === 'depth' ? '<li><i class="k-tick"></i>MODIS alone, from 2022</li>' : '') +
        (m.view === 'depth' ? '<li><i class="k-ghost"></i>earlier years, stepping back</li><li class="hint">Arrows, scroll or swipe to move through the years.</li>' : '<li><i class="k-line"></i>every other year</li><li class="hint">Tap a line to bring that year forward.</li>');
      if (m.view === 'depth') { depth.setData(data, m.frontYear); showMonth(m.ym && +m.ym.slice(0, 4) === m.frontYear ? m.ym : pickMonth(m.frontYear)); }
      else D.overlay(svg, data, m.frontYear, (y) => go(y));
    }
    function go(y) { y = Math.max(cal.years[0], Math.min(cal.years[cal.years.length - 1], y)); if (m.view === 'depth') depth.goto(y); else onYear(y); }
    for (const b of p.querySelectorAll('.switch button')) b.addEventListener('click', () => { m.view = b.dataset.v; draw(); });
    for (const b of p.querySelectorAll('.mm-years button')) b.addEventListener('click', () => go(+b.dataset.y));
    p.querySelector('.mm-prev').addEventListener('click', () => go(m.frontYear - 1));
    p.querySelector('.mm-next').addEventListener('click', () => go(m.frontYear + 1));
    p.querySelector('.mm').addEventListener('keydown', (e) => { if (e.target.tagName === 'SELECT' || e.target.tagName === 'INPUT') return;
      if (e.key === 'ArrowLeft') { e.preventDefault(); go(m.frontYear - 1); } else if (e.key === 'ArrowRight') { e.preventDefault(); go(m.frontYear + 1); } });
    onYear(m.frontYear); draw();
    // redraw on a size change (the SVG is drawn in pixels)
    if (root.ResizeObserver) { let w0 = svg.getBoundingClientRect().width; const ro = new ResizeObserver(() => { const w = svg.getBoundingClientRect().width; if (Math.abs(w - w0) > 2 && document.body.contains(svg)) { w0 = w; draw(); } else if (!document.body.contains(svg)) ro.disconnect(); }); ro.observe(svg); }
  }

  // ---------- the table (yesterday's grid of numbers, behind "Show the table") ----------
  function calendar(p, ctx) {
    const R = root.Readings, A = root.HSAdapters, E = root.HSEngine, r = ctx.result, m = memo(ctx.place);
    const cal = A.calendar(r);
    if (A.isRefusal(cal)) { p.innerHTML = '<div class="message">Nothing to show here: ' + esc(cal.message) + '.</div>'; return; }
    const latest = R.forPeriod(r, 'latest');
    if (!m.ym) m.ym = latest.ym || r.record_ends;
    const rowOf = {}; for (const x of r.monthly) rowOf[x.ym] = x;
    const shade = (rank) => rank === null ? null : 'rgba(255,205,121,' + (0.07 + 0.6 * rank).toFixed(3) + ')';
    let body = '';
    cal.years.forEach((y, i) => {
      body += '<tr><th class="yr" scope="row">' + y + '</th>';
      for (let mo = 1; mo <= 12; mo++) {
        const ym = y + '-' + (mo < 10 ? '0' : '') + mo, row = rowOf[ym], v = cal.cells[i][mo - 1], rk = cal.rank[i][mo - 1];
        if (!row) { body += '<td></td>'; continue; }
        const cls = [], partial = row.status === 'partial';
        if (v === null) cls.push('nodata');
        if (row.translated && v !== null) cls.push('tr');
        if (row.handed_over) cls.push('handed');
        if (partial) cls.push('partial');
        if (R.isProvisional(r, ym)) cls.push('prov');
        const bg = v === null ? '' : ' style="background:' + shade(rk) + (rk !== null && rk > 0.62 ? ';color:#060e19' : '') + '"';
        const txt = v === null ? '–' : (partial ? R.fmt(v) + '*' : R.fmt(v));
        body += '<td><button type="button" class="' + cls.join(' ') + '" data-ym="' + ym + '" tabindex="-1"' + bg + ' aria-label="' + esc(monthName(ym) + ': ' + (v === null ? 'no data' : R.fmt(v) + ' detections') + (partial ? ', days 1 to ' + row.days + ' only' : '')) + '">' + txt + '</button></td>';
      }
      const t = cal.yearTotals[i];
      body += '<td class="tot">' + (t === null ? '<span title="not a whole year">·</span>' : R.fmt(t)) + '</td></tr>';
    });
    const key = '<span class="shade-key" aria-hidden="true">' + [0, .25, .5, .75, 1].map(k => '<i style="background:' + shade(k) + '"></i>').join('') + '</span>';
    p.innerHTML = '<div class="head-row"><h2>Every month since <em>November 2000</em></h2><span class="note">' + esc(R.displayName(ctx.place)) + ' · detections, on one scale · <a href="#record/calendar">Back to the picture ▸</a></span></div>' +
      '<div class="two"><div><div class="cal-wrap"><table class="cal" role="grid" aria-label="Detections by month and year; arrow keys move between months">' +
      '<thead><tr><th class="yr"></th>' + MON3.map(s => '<th scope="col">' + s + '</th>').join('') + '<th scope="col">Year</th></tr></thead><tbody>' + body + '</tbody></table></div></div>' +
      '<div><aside class="side" id="cal-side" aria-live="polite"></aside><ul class="key" style="display:block"><li style="margin-bottom:4px">' + key + ' shade = rank among the same month in other years (quieter to busier), not the amount</li>' +
      '<li><i style="border-top:7px solid var(--dim);border-right:7px solid transparent;width:0;height:0"></i>' + (r.unit ? 'on MODIS\'s scale these months were translated (to June 2002 from MODIS on Terra; from 2022 from VIIRS); on VIIRS\'s scale, shown now, the months from 2022 are VIIRS\'s own counts and the rest are MODIS\'s converted' : 'translated onto MODIS\'s scale (to June 2002 from MODIS on Terra; from 2022 from VIIRS)') + '</li>' +
      '<li><i style="border:1px dashed var(--rule-2)"></i>– = no data, never zero</li>' +
      (r.current ? '<li>* = days 1 to ' + r.current.days + ' only</li>' : '') +
      (r.uses_2026_extension ? '<li><u style="text-decoration-style:dotted">dotted underline</u> = EARLY DATA (NASA&#39;s rapid feed; can still change)</li>' : '') + '</ul>' +
      '<p class="note" style="margin-top:8px">' + esc(UNIT_LINE) + '</p></div></div>';
    const side = p.querySelector('#cal-side');
    const btns = [...p.querySelectorAll('.cal td button')];
    function select(ym, focus) {
      const b = btns.find(x => x.dataset.ym === ym) || btns[btns.length - 1]; if (!b) return;
      for (const x of btns) { x.tabIndex = -1; x.classList.remove('sel'); }
      b.tabIndex = 0; b.classList.add('sel'); if (focus) b.focus();
      m.ym = b.dataset.ym; side.innerHTML = detail(r, m.ym, E, R);
    }
    for (const b of btns) b.addEventListener('click', () => select(b.dataset.ym, false));
    p.querySelector('.cal').addEventListener('keydown', (e) => {
      const map = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -12, ArrowDown: 12, Home: -9999, End: 9999 };
      if (!(e.key in map)) return; e.preventDefault();
      const order = btns.map(b => b.dataset.ym); let i = order.indexOf(m.ym);
      const cur = m.ym, [cy, cm] = [+cur.slice(0, 4), +cur.slice(5, 7)];
      let ny = cy, nm = cm + (map[e.key] === -1 ? -1 : map[e.key] === 1 ? 1 : 0);
      if (map[e.key] === -12) ny--; if (map[e.key] === 12) ny++;
      if (nm < 1) { nm = 12; ny--; } if (nm > 12) { nm = 1; ny++; }
      let target = ny + '-' + (nm < 10 ? '0' : '') + nm;
      if (e.key === 'Home') target = order[0]; if (e.key === 'End') target = order[order.length - 1];
      if (order.indexOf(target) >= 0) select(target, true); else if (i >= 0) select(order[i], true);
    });
    select(m.ym, false);
    // on a narrow screen, bring the chosen month into view inside the calendar's own scroll box (never the page)
    const wrap = p.querySelector('.cal-wrap'), selB = p.querySelector('.cal td button.sel');
    if (wrap && selB && wrap.scrollWidth > wrap.clientWidth) wrap.scrollLeft = Math.max(0, selB.getBoundingClientRect().left - wrap.getBoundingClientRect().left + wrap.scrollLeft - wrap.clientWidth / 2);
  }
  // the month panel: each camera's own count, which camera carried the month, and the way into the answer
  function detail(r, ym, E, R) {
    let row; try { row = E.month(r, ym); } catch (e) { return '<p>Nothing to show here: ' + esc(e.message) + '.</p>'; }
    const P = R.monthPanel(r, ym);
    let own; try { own = r.unit ? R.ownCounts(E.month(r.unit.base, ym), r.unit.base) : R.ownCounts(row, r); } catch (e) { own = R.ownCounts(row, r); }   // own counts are never the scaled ones
    if (P.refusal) return '<p>Nothing to show here: ' + esc(P.refusal) + '.</p>';
    const f = P.f;
    // what happened first (the verdict in words), then MODIS, then the counts, then how it was counted
    let h = '<h3>' + esc(monthName(ym)) + (f.partial ? ' <span class="note">(days 1 to ' + row.days + ')</span>' : '') + (P.early ? ' <span class="tag" title="' + esc(P.earlyTip) + '">EARLY DATA</span>' : '') + '</h3>';
    h += '<p class="mm-verdict mm-say' + (P.sayOk ? '' : ' nil') + '">' + esc(P.say) + '</p>';
    if (P.note) h += '<p class="note">' + esc(P.note) + '</p>';
    if (P.modis) h += '<p class="mm-modis">' + esc(P.modis) + '</p>';
    if (P.weak) h += '<p class="weak" style="border-left:3px solid var(--blue);padding-left:8px;margin:8px 0 0">' + esc(P.weak) + '</p>';
    else if (P.past) h += '<p class="note" style="margin:8px 0 0">' + esc(P.past) + '</p>';
    if (P.counts) {
      h += '<p class="mm-counts">' + esc(P.counts) + '</p>';
      const cams = [['Terra', 'MODIS on Terra'], ['Aqua', 'MODIS on Aqua'], ['SNPP', 'VIIRS on S-NPP'], ['NOAA20', 'VIIRS on NOAA-20']].filter(([k]) => own[k] !== null);
      h += '<dl><dt>Counted by</dt><dd>' + esc(CAMS[row.carrier] || 'no camera') + (r.unit ? ({ SNPP: ', its own count', NOAA20: ', adjusted to S-NPP\'s scale', Aqua: ', converted to VIIRS\'s scale', Terra: ', put on Aqua\'s scale, then converted to VIIRS\'s scale' }[row.carrier] || '') : row.translated ? ', put on MODIS\'s scale' : ', counted as it came') + (row.handed_over ? '; VIIRS stood in this month' : '') + '</dd>';
      h += '<dt>Each camera\'s own count</dt><dd>' + (cams.length ? cams.map(([k, n]) => n + ' ' + esc(R.fmt(own[k]))).join(' · ') : 'none') + '</dd></dl>';
      if (P.how) h += '<p class="why">How it was counted: ' + esc(P.how) + '.</p>';
    }
    h += '<div class="btns" style="margin-top:10px"><a class="btn" href="#answer/' + ym + '">Open this month as the answer ▸</a></div>';
    return h;
  }


  // ---------- 2. every year: "Which years burned most?" ----------
  function years(p, ctx) {
    const R = root.Readings, A = root.HSAdapters, r = ctx.result, m = memo(ctx.place);
    const yt = A.yearTotals(r);
    if (A.isRefusal(yt)) { p.innerHTML = '<div class="message">Nothing to show here: ' + esc(yt.message) + '.</div>'; return; }
    const ys = R.yearly(r).filter(t => t.complete);
    // each view uses the full height: the one-scale view's own maximum; the glued view rescales and says so
    const maxOne = Math.max(1, ...ys.map(t => Math.max(t.ours || 0, t.year >= 2022 ? (t.olderOwn || 0) : 0)), yt.typical || 0);
    const maxGlued = Math.max(1, ...ys.map(t => t.newerAsIs || 0));
    const judged = ys.length ? ys[ys.length - 1].year : null, others = ys.filter(t => t.year !== judged).map(t => t.year);
    const typLabel = 'a usual year: ' + R.fmt(yt.typical) + (others.length ? ', the middle of the other whole years, ' + others[0] + ' to ' + others[others.length - 1] : '');
    let max = maxOne; const h = (v) => (100 * v / max).toFixed(2) + '%';
    function draw() {
      const glued = m.glued; max = glued ? maxGlued : maxOne;
      const bars = ys.map((t, i) => { const v = glued ? t.newerAsIs : t.ours;
        return '<button type="button" class="b' + (glued && t.year >= 2022 ? ' glued' : '') + (!glued ? ' judged' : '') + '" data-i="' + i + '" aria-label="' + t.year + '">' +
          '<span class="fill" style="height:' + (v === null ? '6px' : h(v)) + (glued && t.year < 2022 ? ';background:var(--rule-2)' : '') + '"></span>' +
          (!glued && t.year >= 2022 && t.olderOwn ? '<span class="dot" style="bottom:' + h(t.olderOwn) + '"></span>' : '') + '</button>'; }).join('');
      const typ = !glued && yt.typical !== null ? '<span class="typline" style="bottom:' + h(yt.typical) + '"></span>' : '';
      p.querySelector('#yb').innerHTML = bars + typ;
      p.querySelector('#yb-key').innerHTML = glued ? '<li><i class="k-grey"></i>each year as its own camera counted it</li><li><i class="k-ember"></i>2022 on: VIIRS as it comes, glued on</li>'
        : '<li><i class="k-gold"></i>' + esc(R.recordName(r, true)) + '</li><li><i class="k-typ"></i>' + esc(typLabel) + '</li><li><i class="k-dot"></i>MODIS alone, from 2022</li>';
      const cap = p.querySelector('#yb-cap'); cap.textContent = glued ? 'Glued as-is, the scale has to stretch to ' + R.fmt(maxGlued) + '. ' + R.gluedCaption(r) : ''; cap.className = 'caption' + (glued ? ' glued' : '');
      for (const b of p.querySelectorAll('.switch button')) b.setAttribute('aria-pressed', String((b.dataset.g === '1') === glued));
      const out = p.querySelector('#yb-out');
      for (const b of p.querySelectorAll('#yb .b')) { const t = ys[+b.dataset.i];
        const show = () => { for (const x of p.querySelectorAll('#yb .b.sel')) x.classList.remove('sel'); b.classList.add('sel');
          out.textContent = t.year + ': ' + (glued ? R.detections(t.newerAsIs) + ' as its camera counted them, not on one scale' : R.detections(t.ours) + ' on our record' + (t.year >= 2022 && t.olderOwn ? '; MODIS alone counted ' + R.fmt(t.olderOwn) : '')) + '.'; };
        b.addEventListener('click', show); b.addEventListener('focus', show);
        b.setAttribute('aria-label', t.year + ': ' + (glued ? R.fmt(t.newerAsIs) + ' as counted' : R.fmt(t.ours) + ' on our record' + (t.year >= 2022 && t.olderOwn ? ', MODIS alone ' + R.fmt(t.olderOwn) : ''))); }
    }
    p.innerHTML = '<div class="head-row"><h2>Which years <em>burned most?</em></h2>' +
      '<div class="switch" role="group" aria-label="How the years are joined"><button type="button" data-g="0">On one scale</button><button type="button" class="glued" data-g="1">Glued as-is</button></div></div>' +
      '<p class="mm-line">' + esc(R.yearsLine(r) || '') + '</p>' + (r.unit && R.scaleNote(r, 'years') ? '<p class="note">' + esc(R.scaleNote(r, 'years')) + '</p>' : '') +
      '<div class="bars yearbars" id="yb" role="group" aria-label="Whole years; each bar can be selected"></div>' +
      '<div class="axis ticks" aria-hidden="true">' + ys.map(t => '<span>' + (t.year % 5 === 0 ? t.year : '') + '</span>').join('') + '</div>' +
      '<ul class="key" id="yb-key"></ul><p class="readout" id="yb-out" aria-live="polite">Tap or select a bar for its count.</p><p class="caption" id="yb-cap"></p>' +
      '<p class="note" style="margin-top:8px">' + esc(UNIT_LINE) + '</p>';
    for (const b of p.querySelectorAll('.switch button')) b.addEventListener('click', () => { m.glued = b.dataset.g === '1'; draw(); });
    draw();
  }

  // ---------- 3. this year: "How is this year going?" ----------
  function thisYear(p, ctx) {
    const R = root.Readings, A = root.HSAdapters, r = ctx.result, m = memo(ctx.place);
    const latest = R.forPeriod(r, 'latest');
    const yrs = r.year_totals.map(t => t.year).filter(y => r.monthly.some(x => +x.ym.slice(0, 4) === y && x.value !== null));
    if (!m.year || yrs.indexOf(m.year) < 0) m.year = latest.year || yrs[yrs.length - 1];
    const ys = A.yearShape(r, m.year);
    if (A.isRefusal(ys)) { p.innerHTML = '<div class="message">Nothing to show here: ' + esc(ys.message) + '.</div>'; return; }
    const vals = []; for (const x of ys.months) for (const v of [x.value, x.highHalf, x.typical]) if (v !== null && v !== undefined) vals.push(v);
    const max = Math.max(1, ...vals), h = (v) => (100 * v / max).toFixed(2) + '%';
    const cols = ys.months.map((x, i) => {
      const ym = m.year + '-' + (x.m < 10 ? '0' : '') + x.m, unf = ys.unfinished && ys.unfinished.m === x.m, prov = R.isProvisional(r, ym);
      return '<button type="button" class="m" data-i="' + i + '">' +
        (x.lowHalf !== null ? '<span class="band" style="bottom:' + h(x.lowHalf) + ';height:' + (100 * (x.highHalf - x.lowHalf) / max).toFixed(2) + '%"></span>' : '') +
        (x.typical !== null ? '<span class="typ" style="bottom:' + h(x.typical) + '"></span>' : '') +
        (x.value !== null ? '<span class="val' + (unf ? ' partial' : '') + (prov ? ' prov' : '') + '" style="bottom:' + h(x.value) + '"></span>' : '<span class="nod">–</span>') + '</button>';
    }).join('');
    const opts = yrs.slice().reverse().map(y => '<option value="' + y + '"' + (y === m.year ? ' selected' : '') + '>' + y + '</option>').join('');
    const now = !!(r.current && +r.current.ym.slice(0, 4) === m.year), Y = R.yearSay(r, m.year);
    const early = ys.months.some(x => { const ym = m.year + '-' + (x.m < 10 ? '0' : '') + x.m; return x.value !== null && R.isProvisional(r, ym); }) || !!ys.unfinished;
    const says = (Y.line ? '<p class="mm-line ty-say">' + esc(Y.line) + (early ? ' <span class="tag" title="' + esc(R.EARLY_TIP) + '">EARLY DATA</span>' : '') + '</p>' : '') +
      (Y.modis ? '<p class="mm-modis">' + esc(Y.modis.text) + '</p>' : '') + (Y.weak ? '<p class="caption glued">' + esc(Y.weak) + '</p>' : '') + (Y.little ? '<p class="note">' + esc(Y.little) + '</p>' : '');
    p.innerHTML = '<div class="head-row"><h2>' + (now ? 'How is <em>' + m.year + '</em> going?' : 'How did <em>' + m.year + '</em> go?') + '</h2>' +
      '<label class="pickers" style="margin:0"><span class="note">Year</span> <select id="ty-year">' + opts + '</select></label></div>' + says +
      '<div class="shape" role="group" aria-label="Months of ' + m.year + '; each can be selected">' + cols + '</div>' +
      '<div class="mlabels">' + MON3.map(s => '<span>' + s + '</span>').join('') + '</div>' +
      '<ul class="key"><li><i style="background:var(--gold);border-radius:50%;width:12px;height:12px"></i>' + m.year + ', ' + esc(R.recordName(r)) + '</li>' +
      '<li><i style="background:#7693a533;border:1px solid #7693a566"></i>where the middle half of other years landed</li><li><i class="k-typ"></i>usual</li>' +
      (ys.unfinished ? '<li><i style="border:2px solid var(--gold);border-radius:50%;width:12px;height:12px"></i>month not over yet (days 1 to ' + ys.unfinished.days[1] + ')</li>' : '') +
      (r.uses_2026_extension && m.year >= 2026 ? '<li>halo = EARLY DATA</li>' : '') + '</ul>' +
      '<p class="readout" id="ty-out" aria-live="polite">Tap or select a month for its count.</p>' +
      '<p class="note" style="margin-top:8px">' + esc(UNIT_LINE) + '</p>';
    p.querySelector('#ty-year').addEventListener('change', (e) => { m.year = +e.target.value; thisYear(p, ctx); });
    const out = p.querySelector('#ty-out');
    for (const b of p.querySelectorAll('.shape .m')) { const x = ys.months[+b.dataset.i], ym = m.year + '-' + (x.m < 10 ? '0' : '') + x.m;
      const unf = ys.unfinished && ys.unfinished.m === x.m;
      const xb = r.unit ? (A.yearShape(r.unit.base, m.year).months || []).find(z => z.m === x.m) : null;   // unit switch: the floor on MODIS's scale
      const fl = x.value !== null && x.typical !== null ? R.feel(x.value, x.typical, xb ? { value: xb.value, typical: xb.typical } : undefined) : null;
      const text = R.MONTHS[x.m - 1] + ' ' + m.year + (unf ? ' (days 1 to ' + ys.unfinished.days[1] + ')' : '') + ': ' + (x.value === null ? 'no data' : (fl ? fl.phrase.charAt(0).toUpperCase() + fl.phrase.slice(1) + '. ' : '') + R.detections(x.value)) +
        (x.typical !== null ? '; usual ' + R.fmt(x.typical) : '') + (x.lowHalf !== null ? '; the middle half of other years landed between ' + R.fmt(x.lowHalf) + ' and ' + R.fmt(x.highHalf) : '') +
        (R.isProvisional(r, ym) ? '. EARLY DATA' : '') + '.';
      b.setAttribute('aria-label', text);
      const show = () => { for (const y of p.querySelectorAll('.shape .m.sel')) y.classList.remove('sel'); b.classList.add('sel'); out.textContent = text; };
      b.addEventListener('click', show); b.addEventListener('focus', show); }
  }

  // ---------- 5. "Say it in a report": the short sentence first, the long exact one under "the full version"; copy, CSV ----------
  async function copyText(text, statusEl, what) {
    let ok = false;
    try { if (navigator.clipboard && window.isSecureContext) { await navigator.clipboard.writeText(text); ok = true; } } catch (e) { ok = false; }
    if (!ok) { try { const t = document.createElement('textarea'); t.value = text; t.setAttribute('readonly', ''); t.style.position = 'fixed'; t.style.opacity = '0'; document.body.appendChild(t); t.select(); ok = document.execCommand('copy'); t.remove(); } catch (e) { ok = false; } }
    statusEl.textContent = ok ? what + ' copied.' : 'Copying was blocked here; select the text and copy it by hand.';
  }
  function sentence(p, ctx) {
    const R = root.Readings, r = ctx.result, m = memo(ctx.place);
    const months = r.monthly.filter(x => x.value !== null || x.status === 'partial').map(x => x.ym);
    const latest = R.forPeriod(r, 'latest');
    if (!m.sentYm || months.indexOf(m.sentYm) < 0) m.sentYm = latest.ym;
    const yrs = [...new Set(months.map(x => +x.slice(0, 4)))];
    const file = ctx.place + '_monthly_detections.csv';
    const rows = R.tableRows(r);
    const tableHtml = '<table class="data"><thead><tr>' + R.tableColumns(r).map(c => '<th scope="col">' + esc(c) + '</th>').join('') + '</tr></thead><tbody>' +
      rows.slice().reverse().map(rw => '<tr>' + rw.map((v, i) => '<td>' + esc(typeof v === 'number' && i !== 3 ? (i === 12 ? v.toFixed(1) : R.fmt(v)) : v) + '</td>').join('') + '</tr>').join('') + '</tbody></table>';
    p.innerHTML = '<div class="head-row"><h2>Say it <em>in a report</em></h2></div>' +
      '<div class="pickers"><label><span class="note">Year </span><select id="s-year">' + yrs.slice().reverse().map(y => '<option' + (y === +m.sentYm.slice(0, 4) ? ' selected' : '') + '>' + y + '</option>').join('') + '</select></label>' +
      '<label><span class="note">Month </span><select id="s-month"></select></label></div>' +
      '<blockquote class="quote" id="s-text"></blockquote>' +
      '<div class="btns" style="margin-top:12px"><button type="button" class="btn primary" id="s-copy">Copy this sentence</button></div>' +
      '<details class="s-full"><summary>The full version</summary><p class="note">The counts and how far to trust them, in a fuller account. For a footnote or a methods section.</p>' +
        '<blockquote class="quote small" id="s-long"></blockquote><div class="btns" style="margin-top:8px"><button type="button" class="btn" id="l-copy">Copy the full version</button></div></details>' +
      '<p class="status" id="s-status" aria-live="polite"></p>' +
      '<div class="btns" style="margin-top:4px"><button type="button" class="btn" id="t-copy">Copy this place\'s monthly table</button><a class="btn quiet" id="t-dl" href="#" download="' + esc(file) + '">Download CSV</a></div>' +
      '<p class="note">The table: one row per month, in detections. Copy and download keep every count unrounded; this view rounds them. Empty means no data, never zero.</p>' +
      '<div class="table-wrap" tabindex="0" aria-label="Monthly table">' + tableHtml + '</div>';
    const ySel = p.querySelector('#s-year'), mSel = p.querySelector('#s-month'), text = p.querySelector('#s-text'), long = p.querySelector('#s-long'), st = p.querySelector('#s-status');
    function fillMonths() { const y = +ySel.value, ms = months.filter(x => +x.slice(0, 4) === y);
      if (ms.indexOf(m.sentYm) < 0) m.sentYm = ms[ms.length - 1];
      mSel.innerHTML = ms.map(x => '<option value="' + x + '"' + (x === m.sentYm ? ' selected' : '') + '>' + R.MONTHS[+x.slice(5, 7) - 1] + '</option>').join(''); }
    function write() { text.textContent = R.shortSentence(r, { month: m.sentYm }); long.textContent = R.sentence(r, { month: m.sentYm }); st.textContent = ''; }
    ySel.addEventListener('change', () => { fillMonths(); write(); });
    mSel.addEventListener('change', () => { m.sentYm = mSel.value; write(); });
    fillMonths(); write();
    p.querySelector('#s-copy').addEventListener('click', () => copyText(text.textContent, st, 'The sentence'));
    p.querySelector('#l-copy').addEventListener('click', () => copyText(long.textContent, st, 'The full version'));
    p.querySelector('#t-copy').addEventListener('click', () => copyText(R.csv(r), st, 'The monthly table (' + rows.length + ' months)'));
    const dl = p.querySelector('#t-dl');
    try { const url = URL.createObjectURL(new Blob([R.csv(r)], { type: 'text/csv' })); dl.href = url; }
    catch (e) { dl.removeAttribute('href'); dl.setAttribute('aria-disabled', 'true'); dl.style.display = 'none'; }
    dl.addEventListener('click', () => { st.textContent = 'If the download does not start, use "Copy this place\'s monthly table" instead.'; });
  }
  // ---------- 5b. "Ask your own AI": the chat connector (the team lead's ruling, 10:53 AM: a feature of the submission) ----------
  // Words from the connector lane's README and EXAMPLES (its PAGE_SECTION.md was not there yet); every example answer is worked out
  // here at run time from Readings, the same calls the connector makes, so it never goes stale. Under about 120 words on screen.
  function ask(p, ctx) {
    const R = root.Readings, arg = ctx.argentina, r = ctx.result && !ctx.error ? ctx.result : arg, place = R.displayName(r === arg ? 'Argentina' : ctx.place);
    const ex = [];
    if (arg) { const s1 = R.screen(arg, 'latest'); ex.push(['Is Argentina burning more than usual right now?', s1.answer + (s1.modis && !s1.modis.agree ? ' MODIS, counted on its own, sees more.' : '')]);
      const py = R.positions(arg).year; if (py) ex.push(['How has Argentina\'s year gone?', R.screen(arg, py).answer]); }
    if (r) { const yl = R.yearsLine(r); if (yl) ex.push(['Which years burned most in ' + R.inSentence(place) + '?', yl]); }
    p.innerHTML = '<div class="head-row"><h2>Ask <em>your own AI</em></h2></div>' +
      '<p class="mm-line">Some AI chat apps can plug in small tools called connectors. Ours lets yours answer from this same record, in the same words as this page.</p>' +
      '<dl class="ask-ex">' + ex.map(([q, a]) => '<dt>“' + esc(q) + '”</dt><dd>' + esc(a) + '</dd>').join('') + '</dl>' +
      '<p class="note">It counts satellite detections, like this page; no forecasts, no safety advice. A prototype: we host it online, and it can also run on your own computer; the guide gives the address.</p>' +
      '<div class="btns"><a class="btn" href="connector/README.md">How to add it ▸</a></div>';
  }

  // ---------- 6. how we know: short plain answers to a careful visitor's questions, each one closed until opened ----------
  // Facts: CONSOLIDATE\E_what_we_can_say\WHAT_WE_CAN_SAY_v3.md (its numbers) and the team's research notes (what else is out there).
  // Every count is read at run time (Readings, the world table, the engine's two-camera example); only dates and the tested repair are typed.
  const NASA_CAUTION = 'Due to the spatial resolution and other characteristics of these data, their use for tactical decision-making or informing about conditions at a local scale are not advised.';
  const HOW_QUESTIONS = ['What are we counting?', 'Why are there two cameras?', 'How do you put them on one scale?', 'How do you know it works?', 'Where doesn\'t it work?',
    'Why do the two cameras disagree lately?', 'What is "early data"?', 'What else is out there?', 'What this is not', 'Who made this'];
  function how(p, ctx) {
    const R = root.Readings, A = root.HSAdapters, r = ctx.result, arg = ctx.argentina, w = ctx.world, ws = w && w.summary;
    const title = ctx.title || document.title;
    const here = r && !ctx.error ? R.score(r) : null, placeName = r && !ctx.error ? R.displayName(ctx.place) : null, placeIn = placeName ? R.inSentence(placeName) : null;
    const sa = arg ? R.score(arg) : null, gaps = arg ? R.afterGaps(arg) : [], hereGaps = r && ctx.place !== 'Argentina' && !ctx.error ? R.afterGaps(r) : [];
    const scored = w ? w.rows.filter(x => x.scored) : [], rules = { twelve: 0, one: 0, curve: 0 }; for (const x of scored) if (x.rule in rules) rules[x.rule]++;
    const inv = { twelve: 0, one: 0, curve: 0, none: 0 }; if (w) for (const x of w.rows) inv[x.rule in inv ? x.rule : 'none']++;   // every file, adding up to the total
    const failing = w ? w.rows.filter(x => x.busy && x.typical_pct !== null && x.typical_pct > 30) : [];
    const failPct = failing.map(x => x.typical_pct), ghana = w ? w.rows.find(x => x.file === 'Ghana') : null;
    const names = (ws ? ws.failing : []).map(f => R.displayName(f)), list = names.length ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : '';
    const nRec = arg ? R.recordYears(arg) : null, cur = arg && arg.current, curMonth = cur ? R.MONTHS[+cur.ym.slice(5, 7) - 1] : null, provFrom = R.PROVISIONAL_FROM;
    const sec = (q, body) => '<details><summary>' + esc(q) + '</summary>' + body + '</details>';
    const P = (t) => '<p>' + t + '</p>';
    const ruleHere = here ? (here.rule === 'twelve' ? 'twelve numbers, one for each month of the year' : here.rule === 'one' ? 'one number for the whole year' : here.rule === 'curve' ? 'the curve shared by the whole world' : 'no numbers of its own') : null;
    p.innerHTML = '<div class="how"><div class="head-row"><h2>How we <em>know</em></h2></div>' +
      '<p class="note how-intro">' + esc(title) + ': short answers to the questions a careful visitor asks. Tap a question to open it.</p>' +
      sec(HOW_QUESTIONS[0], P('Fire, as satellites see it from space. We group satellite fire detections into patches of ground about 5 km across, count each patch once per day, and add them up by month and by country.') +
        P('So every number here is a count of <b>detections</b>. It isn\'t a count of separate fires (one big fire burning for a week shows up many times), and it isn\'t the amount of land burned.')) +
      sec(HOW_QUESTIONS[1], P('NASA has watched for fires with <b>MODIS</b> since 2000 (on the Terra satellite, and from mid-2002 on Aqua). In 2012 a newer camera, <b>VIIRS</b>, started flying, and it sees much finer detail.') +
        P('<span id="how-3x">In our Corrientes wetland example, VIIRS picked up about three times as much as MODIS over the same two weeks.</span> Glue the two records end to end and the count jumps when the camera changes, whether or not anything changed on the ground.')) +
      sec(HOW_QUESTIONS[2], P('For ten years, 2012 to 2021, both cameras flew together. Where enough data overlap, we learned numbers that turn a VIIRS count into a MODIS count.') +
        P('Where there is enough fire, a country gets twelve numbers, one for each month of the year. Otherwise it gets one number for the whole year, or a curve shared by the whole world.' + (w ? ' Across all ' + w.rows.length + ' country files: ' + inv.twelve + ' use twelve numbers and ' + inv.one + ' use one number; ' + inv.curve + ' use the shared curve, which has no fair test score; the remaining ' + inv.none + ' have too little data for a score' : '') + '.') +
        P((r && r.unit ? 'On MODIS\'s scale (the page\'s first view; VIIRS\'s scale is shown now and divides these numbers back out), from' : 'From') + ' 2022 on, VIIRS carries the record, put on MODIS\'s scale that way. The first twenty months, November 2000 to June 2002, come from MODIS on Terra, put on the later scale the same way. Together that\'s ' + esc(arg ? R.recordName(arg) : 'our record') + '.') +
        (placeName ? P(esc(placeName) + ' uses ' + ruleHere + '.') : '')) +
      sec(HOW_QUESTIONS[3], P('We left out each year from 2012 to 2021 in turn when learning its conversion numbers, then translated that year\'s VIIRS months and compared each one with what MODIS alone counted.') +
        (sa ? P('In Argentina a translated month usually landed within about ' + Math.round(sa.typicalPct) + '% of MODIS\'s count; about one month in ten was off by ' + Math.round(sa.oneInTenPct) + '% or more.') : '') +
        (ws ? P('Among the ' + ws.busy + ' busiest countries, the one in the middle landed within about ' + Math.round(ws.middle_busy_pct) + '%.') : '') +
        (here && here.typicalPct !== null && ctx.place !== 'Argentina' ? P(esc(placeName) + ': about ' + Math.round(here.typicalPct) + '% in a typical month.') : '') +
        P('That is agreement with MODIS, not with what happened on the ground. And a few of our choices about which months and rules to use did see every year.')) +
      sec(HOW_QUESTIONS[4], (ws ? P('Where there\'s plenty of fire, it works: ' + (ws.within25 < ws.busy ? ws.within25 + ' of the ' + ws.busy + ' busiest countries land' : 'all ' + ws.busy + ' of the busiest countries land') + ' within 25% of MODIS in a typical month, and ' + ws.within10 + ' of them within 10%.') : '') +
        (names.length ? P('In ' + names.length + ' busy countries our record missed badly' + (failPct.length ? ', by ' + Math.round(Math.min(...failPct)) + '% to ' + Math.round(Math.max(...failPct)) + '%' : '') + ': ' + esc(list) + '.') : '') +
        P('Where there\'s little fire, a month holds too few detections to compare well, and our record can miss MODIS by a quarter or more. We mark countries with fewer than 50 detections in a typical tested month as quiet in the world view.') +
        P('Every busy country gets twelve numbers, one for each month of the year: one number for the whole year read the quiet months of a short fire season badly' + (ghana && ghana.rule === 'twelve' ? ' (Ghana now lands within about ' + Math.round(ghana.typical_pct) + '%)' : '') + '.') +
        P('Where our record is weak (one number for the whole year, the shared curve, or a past typical miss over 25%), we give MODIS\'s verdict when it has enough data; otherwise we show what can be counted and say why there\'s no verdict.')) +
      sec(HOW_QUESTIONS[5], P('MODIS is still flying, so from 2022 we compare the two wherever MODIS has a count.') +
        (gaps.length ? P('For Argentina\'s whole years, our record was ' + esc(R.gapWords(gaps)) + ', compared with MODIS\'s own count.') : '') +
        (hereGaps.length ? P(esc(placeName) + ': ' + esc(R.gapWords(hereGaps)) + '.') : '') +
        P('We don\'t know which is closer to what happened on the ground, or why they differ. Where we measured it, MODIS\'s afternoon pass came about 71 minutes later by 2025, and NASA changed its processing in 2023; neither is shown to be the cause. So the page shows both.')) +
      sec(HOW_QUESTIONS[6], P('The newest months come from NASA\'s rapid feed, which can still change when the final files arrive. For Argentina that\'s ' + R.MONTHS[+provFrom.slice(5, 7) - 1] + ' ' + provFrom.slice(0, 4) + ' on.') +
        (cur ? P('A month that isn\'t over yet is compared with the same days in other years: ' + curMonth + ' 1 to ' + cur.days + ' against ' + curMonth + ' 1 to ' + cur.days + '. In past years, ' + R.numberWord(cur.days) + '-day counts like this were off by more than a quarter about one time in four; there\'s no tested miss for this month\'s early data yet.') : '') +
        P('All of this gets one small tag: <span class="tag">EARLY DATA</span>.')) +
      sec(HOW_QUESTIONS[7], P('Others already track fire over time. As far as our research notes found:') +
        '<ul><li>Brazil\'s space research institute, INPE, publishes a year-by-month table of hot spots going back to 1998, on one reference satellite at a time.</li>' +
        '<li>GWIS and EFFIS show this year\'s fire week by week against past years, with separate MODIS and VIIRS comparisons. Global Nature Watch shows a weekly VIIRS comparison.</li>' +
        '<li>Argentina\'s space agency, CONAE, lets you draw a box and get monthly totals, one file per camera.</li>' +
        '<li>FireCalendar, a public project from 2026, builds a joined fire calendar by scaling VIIRS with one number per country.</li>' +
        '<li>Researchers have joined the cameras in other ways: a fire-power record (Zheng and others, 2026), GFED5\'s factors toward burned area, and a NASA science-team project toward burned area.</li></ul>' +
        P('None of them is connected to this page. What we put side by side: each place\'s miss in past tests, and both cameras\' answers when they disagree.')) +
      sec(HOW_QUESTIONS[8], P('Not a forecast: it says what happened, not what comes next. Not a map of today, and not advice about safety: it\'s monthly history for whole countries. Not a count of fires or of land burned.') +
        P('NASA\'s own caution about these data, word for word:') + '<blockquote>' + esc(NASA_CAUTION) + '</blockquote>') +
      sec(HOW_QUESTIONS[9], P(esc(title) + ' was built at NASA Space Apps 2026 by team Spark Squad from NASA\'s public FIRMS data. Parts were prepared before the event and are listed on the project page.') +
        P('AI tools wrote the code under the team\'s direction and review. A second AI model family independently reproduced the main numbers. No outside expert in satellite fire data has reviewed it.') +
        '<p class="note">Data: hot-spot files by country from NASA&#39;s public fire-data service, FIRMS, 2000 to 2025 (MODIS Collection 6.1 on Terra and Aqua; VIIRS 375 m on S-NPP and NOAA-20); Argentina 2026 from FIRMS area files. Country outlines: Natural Earth (public domain), simplified. This project\'s code calculates the counts; the world view uses a table prepared from the same code.</p>') +
      '</div>';
    // the three-times example, read from the engine's own two-camera file (Corrientes wetland, August 1 to 15, 2020)
    const span = p.querySelector('#how-3x');
    if (span && A && A.twoCameras) fetch('parts/engine_and_data/data/two_cameras/corrientes_2020-08-01_15.json').then(x => x.ok ? x.json() : null).then(j => {
      if (!j || !span.isConnected) return; const tc = A.twoCameras(j); if (A.isRefusal && A.isRefusal(tc)) return;
      const k = tc.newer.total / tc.older.total;
      span.textContent = 'On one Argentine wetland over the same two weeks, VIIRS picked up about ' + R.numberWord(Math.round(k)) + ' times as much as MODIS (' + R.fmt(tc.newer.total) + ' detections against ' + R.fmt(tc.older.total) + ').';
    }).catch(() => {});
  }

  root.Record = { render, TABS, HOW_QUESTIONS, NASA_CAUTION };
})(window);
