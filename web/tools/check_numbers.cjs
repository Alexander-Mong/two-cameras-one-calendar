/* Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md. */
// check_numbers.cjs: PASS or FAIL for every row of DESIGN.md section 8 (and, from Nov 14 morning, the new words of VOICE_AND_COPY_0704.md), the Ghana May 2022 row (A3), a "busiest year IS printed" case (A11),
// the coordinator's additions (latest period per place; record gate exact form; table sums unrounded), read through js/readings.js and the
// copied engine.   Usage: node tools/check_numbers.cjs
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), BASE = path.join(ROOT, 'parts', 'engine_and_data');
const E = require(path.join(BASE, 'engine', 'hs_engine.js')), A = require(path.join(BASE, 'adapters.js')), R = require(path.join(ROOT, 'js', 'readings.js'));
const rnd = Math.round, results = [];
function check(name, ok, got) { results.push({ name, ok: !!ok, got }); console.log((ok ? 'PASS ' : 'FAIL ') + name + (got !== undefined ? '  | got: ' + got : '')); }
const near = (a, b, tol) => a !== null && a !== undefined && Math.abs(a - b) <= (tol === undefined ? 0.5 : tol);

(async () => {
  const L = await E.open({ base: BASE });
  const q = {}; const get = async (c) => { if (!q[c]) { q[c] = await E.query({ country: c }, L); await R.loadAvailability(L, q[c]); } return q[c]; };
  const arg = await get('Argentina');

  // ---- Landing, Argentina ----
  const f = R.forPeriod(arg, 'latest');
  check('Landing Argentina: period Nov 1–12, 2026, partial, provisional', f.periodLabel === 'November 1–12, 2026' && f.partial && f.provisional, f.periodLabel + ' partial=' + f.partial + ' provisional=' + f.provisional);
  check('Landing Argentina: ours 550, typical 538, "about usual"', rnd(f.ours.value) === 550 && rnd(f.ours.typical) === 538 && f.ours.word === 'about usual', rnd(f.ours.value) + ' / ' + rnd(f.ours.typical) + ' / ' + f.ours.word);
  check('Landing Argentina: older camera 757, own typical 556.5 (prints 557), "busier"', f.older && f.older.value === 757 && f.older.typical === 556.5 && R.fmt(f.older.typical) === '557' && f.older.word === 'busier', f.older && (f.older.value + ' / ' + f.older.typical + ' / ' + f.older.word));
  check('Landing Argentina: the two records still disagree underneath (about usual / busier), no shared word', f.ours.word === 'about usual' && f.older.word === 'busier' && !f.sameWord, f.ours.word + ' / ' + f.older.word);
  check('Landing Argentina: A1 label, provisional spelled out (fix 9), no unmeasured-error line', f.upperLabel === 'ARGENTINA · NOVEMBER 1–12, 2026 · PROVISIONAL: NEAR-REAL-TIME DATA, DAYS 1–12 ONLY' && f.unfinishedNote === null, f.upperLabel);
  check('Landing Argentina: A2 (as changed): unfinished month prints the twelve-day line and NOT the whole-month score', f.trust === 'Twelve days of early data. In past tests, twelve-day counts of this size were off by more than a quarter about one time in four.' && !/within about/.test(f.trust), f.trust);
  const fw = R.forPeriod(arg, { month: '2025-12' });
  check('Whole month (Argentina Dec 2025): the whole-month sentence with "in Argentina" and "whole past months", about 10%', fw.trust === 'In whole past months in Argentina, our joined record typically landed within about 10% of the older camera\'s own count.', fw.trust);
  check('Landing Argentina: "1–12" days note', /Days 1 to 12 only/.test(f.daysNote), f.daysNote);

  // ---- Scene 1 (fixed example) ----
  const tc = A.twoCameras(JSON.parse(fs.readFileSync(path.join(BASE, 'data', 'two_cameras', 'corrientes_2020-08-01_15.json'), 'utf8')));
  check('Scene 1: Corrientes Aug 1–15, 2020: 1,397 and 4,150', tc.older.total === 1397 && tc.newer.total === 4150, tc.older.total + ' / ' + tc.newer.total);

  // ---- Scene 2 ----
  const y = R.yearly(arg), yr = (n) => y.find(x => x.year === n);
  const yt = A.yearTotals(arg);   // the adapter's default: judged year = the newest complete year (2025)
  check('Scene 2: glued 2022 = 89,310', rnd(yr(2022).newerAsIs) === 89310, yr(2022).newerAsIs);
  check('Scene 2: old record 2020 = 45,295', rnd(yr(2020).ours) === 45295, rnd(yr(2020).ours));
  check('Scene 2: on one scale 2022 = 26,952', rnd(yr(2022).ours) === 26952, rnd(yr(2022).ours));
  check('Scene 2: typical year 25,365 (adapter default: the other whole years, newest complete year 2025 left out; with 2022 left out it is ' + R.fmt(yr(2022).typical) + ')', rnd(yt.typical) === 25365, rnd(yt.typical));
  check('A4: glued 2022 / 2021 = 4.2 times; one scale = about 26% above 2021', (yr(2022).newerAsIs / yr(2021).ours).toFixed(1) === '4.2' && rnd(100 * (yr(2022).ours / yr(2021).ours - 1)) === 26,
    (yr(2022).newerAsIs / yr(2021).ours).toFixed(3) + ' / ' + (100 * (yr(2022).ours / yr(2021).ours - 1)).toFixed(2) + '%');

  // ---- Scene 3 ----
  check('Scene 3: October number about 0.29', arg.factors.SNPP.f[9].toFixed(2) === '0.29', arg.factors.SNPP.f[9]);
  const own = [2022, 2023, 2024, 2025].map(n => yr(n).olderOwn), gaps = [2022, 2023, 2024, 2025].map(n => (100 * (yr(n).ours / yr(n).olderOwn - 1)).toFixed(1));
  check('Scene 3: older camera own 2022–2025 = 27,056 · 16,796 · 20,271 · 20,377', own.join(',') === '27056,16796,20271,20377', own.join(','));
  check('Scene 3: gaps 0.4% lower · 2.9% higher · 7.0% lower · 7.3% lower', gaps.join(',') === '-0.4,2.9,-7.0,-7.3', gaps.join(','));

  // ---- Scene 4 ----
  const hy = arg.hide_a_year.SNPP, pair = (ym) => hy.pairs.find(p => p.ym === ym), oct = pair('2017-10'), jan = pair('2017-01');
  const octRow = E.month(arg, '2017-10');
  check('Scene 4: Oct 2017 newer camera 6,035 -> guess 1,734 against 1,921 (9.7% low)', octRow.raw.SNPP === 6035 && rnd(oct.predicted) === 1734 && oct.aqua === 1921 && (100 * (1 - oct.predicted / oct.aqua)).toFixed(1) === '9.7',
    octRow.raw.SNPP + ' -> ' + oct.predicted.toFixed(1) + ' vs ' + oct.aqua);
  // the walk-through prints October's number to four places (orchestrator, 22:30): the printed sum must come out right on a calculator
  const oct4 = oct.predicted / octRow.raw.SNPP;
  check('Scene 4: walk-through shows 6,035 × 0.2873 = 1,734 (the printed number gives the printed answer)', oct4.toFixed(4) === '0.2873' && rnd(6035 * +oct4.toFixed(4)) === 1734 && rnd(oct.predicted) === 1734,
    '6035 × ' + oct4.toFixed(4) + ' = ' + (6035 * +oct4.toFixed(4)).toFixed(1));
  check('Scene 4: Jan 2017 guess 1,076 against 1,779', rnd(jan.predicted) === 1076 && jan.aqua === 1779, rnd(jan.predicted) + ' vs ' + jan.aqua);
  const sc = R.score(arg);
  check('Scene 4: Argentina typical 9.5%, one in ten 30.0%, 119 months, rule twelve', sc.typicalPct.toFixed(1) === '9.5' && sc.oneInTenPct.toFixed(1) === '30.0' && sc.months === 119 && sc.rule === 'twelve', sc.typicalPct.toFixed(2) + ' / ' + sc.oneInTenPct.toFixed(2) + ' / ' + sc.months + ' / ' + sc.rule);

  // ---- Scene 5 (from the world table) ----
  const wtPath = path.join(ROOT, 'data', 'world_table.json');
  if (!fs.existsSync(wtPath)) check('Scene 5: world table exists', false, 'data/world_table.json not built yet');
  else {
    const wt = JSON.parse(fs.readFileSync(wtPath, 'utf8')), rows = wt.rows;
    const busy = rows.filter(x => x.busy), med = A.median(busy.map(x => x.typical_pct));
    const fail9 = busy.filter(x => x.typical_pct > 30).map(x => x.file).sort();
    const want9 = ['Benin', 'Burkina_Faso', 'Ghana', 'Lao_PDR', 'Liberia', 'Nepal', 'Sierra_Leone', 'Togo', 'Zimbabwe'];
    check('Scene 5 / A6: 235 files, 177 scored, 71 busy', rows.length === 235 && rows.filter(x => x.scored).length === 177 && busy.length === 71,
      rows.length + ' / ' + rows.filter(x => x.scored).length + ' / ' + busy.length);
    check('Scene 5: middle busy country 12.4% (was 13.6% before the Nov 14 busy-twelve repair)', med !== null && med.toFixed(1) === '12.4', med && med.toFixed(2));
    check('Scene 5: no busy country over 30% after the repair (the nine were all one-number before it)', fail9.length === 0, fail9.join(',') || 'none');
    check('Repair: each of the nine now twelve numbers and at or under 25% (Benin 15.5, Burkina Faso 11.7, Ghana 14.2, Lao PDR 17.0, Liberia 20.8, Nepal 17.9, Sierra Leone 15.5, Togo 17.7, Zimbabwe 14.2)',
      want9.every(f => { const x = rows.find(y => y.file === f); return x && x.rule === 'twelve' && x.typical_pct <= 25; }) &&
      want9.map(f => rows.find(y => y.file === f).typical_pct.toFixed(1)).join(',') === '15.5,11.7,14.2,17.0,20.8,17.9,15.5,17.7,14.2',
      want9.map(f => { const x = rows.find(y => y.file === f); return f + ' ' + x.typical_pct.toFixed(2) + ' ' + x.rule; }).join(', '));
    check('Repair: busy within 10 / 15 / 25% = 23 / 50 / 71; no busy country on one number', wt.summary.within10 === 23 && wt.summary.within15 === 50 && wt.summary.within25 === 71 && wt.summary.one_busy === 0,
      [wt.summary.within10, wt.summary.within15, wt.summary.within25, wt.summary.one_busy].join(' / '));
    const ar = rows.find(x => x.file === 'Argentina');
    check('Scene 5: Argentina 9.5% in the world table', ar && ar.typical_pct.toFixed(1) === '9.5', ar && ar.typical_pct);
    const gh = rows.find(x => x.file === 'Ghana');
    check('Scene 5: Ghana 14% with twelve numbers (101% with one number before the Nov 14 repair)', gh && rnd(gh.typical_pct) === 14 && gh.rule === 'twelve', gh && gh.typical_pct);
    check('World table: latest period per place (Andorra 2022-11, Liechtenstein 2025-08, Argentina 2026-11)',
      rows.find(x => x.file === 'Andorra').latest === '2022-11' && rows.find(x => x.file === 'Liechtenstein').latest === '2025-08' && ar.latest === '2026-11',
      ['Andorra', 'Liechtenstein', 'Argentina'].map(n => rows.find(x => x.file === n).latest).join(', '));
    const early = rows.filter(x => x.latest && x.latest < '2025-12').length;
    check('World table: 55 places end before December 2025', early === 55, early);
  }

  // ---- Record, Argentina ----
  const aug20 = R.forPeriod(arg, { month: '2020-08' });
  check('Record Argentina: Aug 2020 = 12,043 (older camera kept)', rnd(aug20.ours.value) === 12043 && E.month(arg, '2020-08').carrier === 'Aqua', rnd(aug20.ours.value));
  const rc = R.recordCheck(arg);
  check('Record Argentina: 2020 45,295 vs 2003 45,227, NO busiest label; line says nearly tied', R.recordWord(arg) === null && rc.top.year === 2020 && rnd(rc.top.total) === 45295 && rc.runnerUp.year === 2003 && rnd(rc.runnerUp.total) === 45227 && /2020 and 2003, nearly tied/.test(R.recordLine(arg)),
    R.recordLine(arg));
  const y25 = R.forPeriod(arg, { year: 2025 });
  check('Record Argentina: 2025 ours 18,889, older camera 20,377', rnd(y25.ours.value) === 18889 && y25.older && y25.older.value === 20377, rnd(y25.ours.value) + ' / ' + (y25.older && y25.older.value));
  const a25 = R.forPeriod(arg, { month: '2025-08' });
  check('Record Argentina: Aug 2025 4,335 and 4,968', rnd(a25.ours.value) === 4335 && a25.older.value === 4968, rnd(a25.ours.value) + ' / ' + a25.older.value);
  const d25 = R.forPeriod(arg, { month: '2025-12' });
  check('Record Argentina: Dec 2025 588 against typical 801', rnd(d25.ours.value) === 588 && rnd(d25.ours.typical) === 801, rnd(d25.ours.value) + ' / ' + rnd(d25.ours.typical));
  // coordinator addition: the monthly table sums UNROUNDED and rounds once
  const rowsT = R.tableRows(arg), ci = (c) => R.TABLE_COLUMNS.indexOf(c);
  const s25 = rowsT.filter(r => r[0].startsWith('2025-')), sumV = s25.reduce((t, r) => t + r[ci('value')], 0), sumA = s25.reduce((t, r) => t + r[ci('Aqua')], 0);
  check('Table: columns exactly as listed', R.TABLE_COLUMNS.join(',') === 'ym,value,status,days,carrier,translated,earlier_camera,handed_over,Terra,Aqua,SNPP,NOAA20,tested_miss_pct,rule', R.TABLE_COLUMNS.join(','));
  check('Table: 2025 sums (unrounded, rounded once) 18,889 ours and 20,377 older camera', rnd(sumV) === 18889 && sumA === 20377, rnd(sumV) + ' / ' + sumA);
  const csvText = R.csv(arg), dec02 = R.csv(await get('Greece')).split('\n').find(l => l.startsWith('2002-12,'));
  check('Table: an empty month stays empty, never 0 (Greece 2002-12)', dec02 && dec02.split(',')[1] === '', dec02);
  check('Table: provisional months from 2026-08 only (2026-07 not, 2026-08 yes)', /^2026-07,[^,]*,final,/m.test(csvText) && /^2026-08,[^,]*,final provisional,/m.test(csvText), csvText.split('\n').filter(l => /^2026-0[78]/.test(l)).map(l => l.split(',').slice(0, 3).join(',')).join(' | '));

  // ---- Greece ----
  const gr = await get('Greece');
  const gd = R.forPeriod(gr, 'latest');
  check('Greece: latest Dec 2025 "too few to call"', gd.periodLabel === 'December 2025' && gd.tooFew && gd.ours.word === null, gd.periodLabel + ' tooFew=' + gd.tooFew + ' word=' + gd.ours.word + ' (' + R.fmt(gd.ours.value) + ' vs ' + R.fmt(gd.ours.typical) + ')');
  const gf = R.forPeriod(gr, { month: '2010-02' });
  check('Greece: Feb 2010 1 against 33, no word', rnd(gf.ours.value) === 1 && rnd(gf.ours.typical) === 33 && gf.ours.word === null, rnd(gf.ours.value) + ' / ' + rnd(gf.ours.typical) + ' / ' + gf.ours.word);
  const g02 = R.forPeriod(gr, { month: '2002-12' });
  check('Greece: Dec 2002 empty (null), never 0', g02.ours.value === null && g02.ours.noData && R.fmt(g02.ours.value) === 'no data', String(g02.ours.value));

  // ---- Indonesia ----
  const ind = await get('Indonesia'), ia = E.month(ind, '2020-08');
  check('Indonesia: Aug 2020 handed to the newer camera, 704 becomes about 2,566', ia.handed_over && ia.raw.Aqua === 704 && rnd(ia.value) === 2566 && ia.carrier === 'SNPP', ia.raw.Aqua + ' -> ' + rnd(ia.value) + ' handed=' + ia.handed_over);

  // ---- Ghana ----
  const gh = await get('Ghana');
  const gdec = R.forPeriod(gh, { month: '2025-12' });
  check('Ghana: Dec 2025 ours 3,669 (was 2,914 with one number) vs typical 9,390; older camera 3,157', rnd(gdec.ours.value) === 3669 && rnd(gdec.ours.typical) === 9390 && gdec.older.value === 3157, rnd(gdec.ours.value) + ' / ' + rnd(gdec.ours.typical) + ' / ' + gdec.older.value);
  check('Ghana (repaired): twelve numbers, "within about 14%", no "one number" anywhere in its sentence', R.score(gh).rule === 'twelve' && /within about 14%/.test(R.score(gh).line) && !/one number/.test(R.score(gh).line + R.sentence(gh, { month: '2025-12' })) && /within about 14% of MODIS/.test(R.sentence(gh, { month: '2025-12' })), R.score(gh).line);
  const gmay = R.forPeriod(gh, { month: '2022-05' });
  check('Ghana May 2022 (repaired): ours 97 vs typical 98 "about usual" (was 242 vs 106, no word); older 43 "much quieter"; the two records disagree and both are shown', rnd(gmay.ours.value) === 97 && rnd(gmay.ours.typical) === 98 && gmay.ours.word === 'about usual' && gmay.ours.weak === null && gmay.older.value === 43 && gmay.older.word === 'much quieter' && gmay.headline === 'Two records. Two readings.',
    rnd(gmay.ours.value) + ' / ' + rnd(gmay.ours.typical) + ' / ' + gmay.ours.word + ' | older ' + gmay.older.value + ' ' + gmay.older.word);

  // ---- Monaco ----
  const mo = await get('Monaco'), mf = R.forPeriod(mo, 'latest');
  check('Monaco: one plain "nothing to show" message', mf.refusal && /nothing to show/.test(mf.refusal.message) && /^Nothing to show here/.test(R.sentence(mo, 'latest')), mf.refusal && mf.refusal.message);

  // ---- Any month before 2022: no older-camera card ----
  const pre = ['2021-12', '2015-06', '2003-08'].map(m => R.forPeriod(arg, { month: m }).older);
  check('Any month before 2022: no older-camera reading (Argentina 2021-12, 2015-06, 2003-08)', pre.every(x => x === null), pre.map(String).join(','));

  // ---- A11: a "busiest year" label IS printed somewhere (gap beats the place's miss) ----
  let passCase = null, gateFalse = 0, checked = 0;
  for (const c of E.countries(L)) { const r = await get(c); const w = R.recordWord(r); checked++; if (w && !passCase) passCase = { c, w, chk: R.recordCheck(r) }; if (!w) gateFalse++; }
  check('A11: a place where "busiest year" IS printed', !!passCase, passCase ? passCase.c + ': ' + passCase.w.year + ' ' + rnd(passCase.w.total) + ' vs ' + passCase.w.runnerUp.year + ' ' + rnd(passCase.w.runnerUp.total) + ' (gap ' + passCase.chk.gapPct.toFixed(1) + '% > miss ' + passCase.chk.missPct.toFixed(1) + '%)' : 'none found');
  const passes = E.countries(L).filter(c => R.recordWord(q[c])).length;
  console.log('   (record label printed in ' + passes + ' of ' + checked + ' places)');
  // coordinator addition: a 2022+ top year needs the gap to beat the camera disagreement too
  const late = E.countries(L).map(c => R.recordCheck(q[c])).filter(x => x.top && x.top.year >= 2022 && x.missPct !== null);
  check('Record gate: every 2022+ top year with a label also beats its two-camera disagreement', late.filter(x => x.ok).every(x => x.cameraPct !== null && x.gapPct > x.cameraPct), late.length + ' places with a 2022+ top year; ' + late.filter(x => x.ok).length + ' labelled');

  // ---- sweep: no throw, no stray zero for a positive value ----
  let thrown = 0, zeroPrint = 0;
  for (const c of E.countries(L)) { try { const r = q[c]; const ff = R.forPeriod(r, 'latest'); R.sentence(r, 'latest'); R.yearly(r); R.score(r);
    if (ff.ours && ff.ours.value > 0 && R.fmt(ff.ours.value) === '0') zeroPrint++; } catch (e) { thrown++; console.log('   threw for ' + c + ': ' + e.message); } }
  check('Sweep of all 235 places: readings never throw; a positive value never prints "0"', thrown === 0 && zeroPrint === 0 && R.fmt(0.089856) === 'under 1', thrown + ' threw, ' + zeroPrint + ' zero prints');

  // ================= fix round (second-family review, DEMO_REVIEW.md) =================
  // independent availability, read here straight from the country files (not through readings.js)
  const fileRows = (c) => JSON.parse(fs.readFileSync(path.join(BASE, 'data', 'world_by_country', 'countries', c + '.json'), 'utf8')).rows;
  const aquaHas = {}; for (const c of E.countries(L)) { const set = new Set(); for (const rw of fileRows(c)) if (rw[1] === 1 && rw[0] < 312) set.add(rw[0]); aquaHas[c] = set; }
  const mIx = (ym) => (+ym.slice(0, 4) - 2000) * 12 + +ym.slice(5, 7) - 1;
  // 1. a missing older-camera row is "no count", never 0
  const an = R.forPeriod(await get('Andorra'), { month: '2022-11' }), li = R.forPeriod(await get('Liechtenstein'), { month: '2025-08' });
  check('Fix 1: Andorra 2022-11 and Liechtenstein 2025-08: no older-camera count (no Aqua row), never 0', an.older === null && an.olderMissing && li.older === null && li.olderMissing &&
    !/counted 0/.test(R.sentence(q.Andorra, { month: '2022-11' })) && !/counted 0/.test(R.sentence(q.Liechtenstein, { month: '2025-08' })), 'Andorra older=' + JSON.stringify(an.older) + ', Liechtenstein older=' + JSON.stringify(li.older));
  check('Fix 1: Greece 2025 has no complete older-camera year total (a month without an Aqua row)', R.olderYearTotal(q.Greece, 2025) === null && R.yearly(q.Greece).find(t => t.year === 2025).olderOwn === null, String(R.olderYearTotal(q.Greece, 2025)));
  check('Fix 1: the table leaves a missing camera row empty (Andorra 2022-11 Aqua cell)', R.tableRows(q.Andorra).find(rw => rw[0] === '2022-11')[R.TABLE_COLUMNS.indexOf('Aqua')] === '', R.tableRows(q.Andorra).find(rw => rw[0] === '2022-11').join(','));
  // a real zero stays 0: find a month (2022+) with an Aqua row whose count is 0
  let realZero = null;
  for (const c of E.countries(L)) { for (const rw of fileRows(c)) if (rw[1] === 1 && rw[2] === 0 && rw[0] >= 264 && rw[0] < 312) { realZero = { c, ym: E.ymOf(rw[0]) }; break; } if (realZero) break; }
  if (realZero) { const z = R.forPeriod(q[realZero.c], { month: realZero.ym });
    check('Fix 1: a present Aqua row with a count of 0 stays a real 0 (' + realZero.c + ' ' + realZero.ym + ')', z.refusal || (z.older && z.older.value === 0), z.refusal ? 'refused: ' + z.refusal.message : JSON.stringify(z.older)); }
  else check('Fix 1: a present Aqua row with a count of 0 stays a real 0', true, 'no such row from 2022 in the country files (nothing to test)');
  let wrongNull = 0, wrongZero = 0, n1 = 0;
  for (const c of E.countries(L)) { const r = q[c]; for (const x of r.monthly) { if (x.ym < '2022-01' || x.ym > '2025-12' || x.status === 'partial') continue;
    const f2 = R.forPeriod(r, { month: x.ym }); if (f2.refusal) continue; n1++;
    const has = aquaHas[c].has(mIx(x.ym)); if (has && !f2.older) wrongNull++; if (!has && f2.older) wrongZero++; } }
  check('Fix 1 sweep: every month 2022-2025 in 235 places: an older reading exactly where the file has an Aqua row', wrongNull === 0 && wrongZero === 0, n1 + ' months; ' + wrongZero + ' shown without a row, ' + wrongNull + ' hidden with a row');
  // 2. the older camera's typical: every other year with an Aqua row for the same month, whatever the joined record did
  let poolBad = 0, n2 = 0;
  for (const c of E.countries(L)) { const r = q[c]; const f2 = R.forPeriod(r, 'latest'); if (!f2.older || f2.partial) continue; n2++;
    const mo = +f2.ym.slice(5, 7), want = [];
    for (const x of r.monthly) if (+x.ym.slice(5, 7) === mo && x.ym !== f2.ym && x.status !== 'partial' && aquaHas[c].has(mIx(x.ym))) want.push(x.raw.Aqua);
    if (A.median(want) !== f2.older.typical || want.length !== f2.older.years) poolBad++; }
  check('Fix 2: the older camera\'s typical pools every other year with its own row (latest month, every place)', poolBad === 0, n2 + ' places checked; ' + poolBad + ' differ');
  // 3. (rule changed Nov 14, VOICE_AND_COPY_0704.md rule 6) the page MAY lead with one answer; MODIS's own answer is the second line whenever it differs
  let missLine = 0, wrongAgree = 0, n3 = 0;
  for (const c of E.countries(L)) { const r = q[c]; for (const x of r.monthly) { if (x.ym < '2022-01') continue; const sc2 = R.screen(r, { month: x.ym }); const f2 = sc2.f; if (f2.refusal || f2.lead !== 'ours' || !f2.older) continue; n3++;
    if (f2.older.word !== f2.ours.word && !(sc2.modis && !sc2.modis.agree && (/^One catch: MODIS/.test(sc2.modis.text) || (sc2.modis.sameWay && /^MODIS, NASA's older camera, counted on its own, also saw a/.test(sc2.modis.text) && !/don't agree/.test(sc2.modis.text))))) missLine++;
    if (f2.older.word === f2.ours.word && !(sc2.modis && sc2.modis.agree)) wrongAgree++; } }
  check('Fix 3 (as changed): every month from 2022 led by our record shows MODIS\'s own answer as a second line when it differs, "says the same" when it agrees (every place); a missing MODIS count still says so', missLine === 0 && wrongAgree === 0 && an.olderMissing && /MODIS has no count of its own/.test(R.screen(q.Andorra, { month: '2022-11' }).small), n3 + ' months; ' + missLine + ' missing a "One catch" line, ' + wrongAgree + ' agreeing without "says the same"');
  // 4. shared-curve places: no percent, no record word, empty table cell
  const curve = E.countries(L).filter(c => q[c].hide_a_year.SNPP.mode === 'none' && q[c].hide_a_year.SNPP.typical_pct !== null);
  const curveBad = curve.filter(c => R.score(q[c]).typicalPct !== null || R.recordWord(q[c]) !== null || R.tableRows(q[c]).some(rw => rw[R.TABLE_COLUMNS.indexOf('tested_miss_pct')] !== '') || /\d%/.test(R.score(q[c]).line));
  check('Fix 4: the ' + curve.length + ' shared-curve places show no percent, no busiest-year label, an empty tested_miss_pct (Cyprus, Slovenia included)', curve.length === 15 && curveBad.length === 0 && curve.includes('Cyprus') && curve.includes('Slovenia'), curveBad.join(',') || 'none bad');
  const wt2 = fs.existsSync(wtPath) ? JSON.parse(fs.readFileSync(wtPath, 'utf8')) : null;
  check('Fix 4: the world table carries no percent for a shared-curve place', wt2 && wt2.rows.filter(x => x.rule === 'curve').every(x => x.typical_pct === null && x.one_in_ten_pct === null), wt2 ? wt2.rows.filter(x => x.rule === 'curve').length + ' curve rows' : 'no table');
  // 5. the real reason when no busiest year is named
  const mg = R.recordLine(await get('Mongolia'));
  // Mongolia: with missing Aqua rows now honored, 2025 has no full older-camera year, so that is the real reason (not a near tie)
  check('Fix 5: Mongolia 2025 vs 2023 (51% apart) is not called "nearly tied"; the real reason is named', !/nearly tied/.test(mg) && /older camera has no full-year count for 2025|two cameras disagree about 2025/.test(mg), mg);
  const camCase = E.countries(L).find(c => R.recordCheck(q[c]).reason === 'cameras');
  check('Fix 5: a place withheld because the cameras disagree says so' + (camCase ? ' (' + camCase + ')' : ''), !camCase || /two cameras disagree about/.test(R.recordLine(q[camCase])), camCase ? R.recordLine(q[camCase]) : 'no place has that reason now');
  check('Fix 5: Argentina still says nearly tied (the lead is smaller than its typical miss)', /nearly tied/.test(R.recordLine(arg)) && /typical miss/.test(R.recordLine(arg)), R.recordLine(arg));
  check('Fix 5: Cyprus says there is no fair score to judge by', /no fair test score/.test(R.recordLine(await get('Cyprus'))), R.recordLine(q.Cyprus));
  const mad = R.recordCheck(await get('Madagascar'));
  check('Record gate (builder A addition): an earlier-camera top year must beat that camera\'s miss too (Madagascar 2001: lead ' + (mad.gapPct||0).toFixed(1) + '%)', mad.ok === false && mad.reason === 'earlier' && /earlier camera \(Terra\)/.test(R.recordLine(q.Madagascar)), R.recordLine(q.Madagascar));
  // 6. the word gate follows the carrier's own rule (Terra included)
  const al = R.forPeriod(await get('Albania'), { month: '2001-07' });
  check('Fix 6: Albania 2001-07 (earlier camera, one number here): no word, and the care line names the earlier camera', al.ours.word === null && /earlier camera \(Terra\)/.test(al.ours.weak || ''), al.ours.word + ' | ' + al.ours.weak);
  let terraWords = 0, n6 = 0;
  for (const c of E.countries(L)) { const r = q[c]; const tm = r.factors.Terra ? r.factors.Terra.mode : null; if (tm === 'month_of_year') continue;
    for (const x of r.monthly) { if (x.carrier !== 'Terra' || x.value === null) continue; n6++; const f2 = R.forPeriod(r, { month: x.ym }); if (f2.ours && f2.ours.word) terraWords++; } }
  check('Fix 6 sweep: no word on any earlier-camera month in a place where that camera uses one number or none', terraWords === 0, n6 + ' months; ' + terraWords + ' with a word');
  const arT = R.forPeriod(arg, { month: '2001-07' });
  check('Fix 6: a twelve-number Terra place keeps its word (Argentina 2001-07)', arg.factors.Terra.mode !== 'month_of_year' || !!arT.ours.word, arg.factors.Terra.mode + ' -> ' + arT.ours.word);
  // 7. the legend at exact size (counts from the world table)
  check('Fix 7: legend counts: busy twelve-number 71 (was 56); no fair score 52 + 15; one-number 73 (was 88) with 0 busy (was 15); 19 scored but quiet', wt2 && wt2.summary.busy_twelve === 71 && wt2.summary.noscore_unscored === 52 && wt2.summary.noscore_curve === 15 && wt2.summary.class_counts.one === 73 && wt2.summary.one_busy === 0 && wt2.rows.filter(x => x.cls === 'quiet').every(x => x.scored) && wt2.summary.class_counts.quiet === 19,
    wt2 && JSON.stringify({ bt: wt2.summary.busy_twelve, nu: wt2.summary.noscore_unscored, nc: wt2.summary.noscore_curve, one: wt2.summary.class_counts.one, ob: wt2.summary.one_busy, quiet: wt2.summary.class_counts.quiet }));
  const worldSrc = fs.readFileSync(path.join(ROOT, 'js', 'record_world.js'), 'utf8');
  check('Fix 7: the legend words are in the map code (busy heading; "too quiet to compare"; "Counts are country files")', /busy countries with twelve monthly numbers/i.test(worldSrc) && /scored, but too quiet to compare/.test(worldSrc) && /Counts are country files, including a few too small to draw/.test(worldSrc) && !/too little activity to score/.test(worldSrc + fs.readFileSync(path.join(ROOT, 'tools', 'build_tables.cjs'), 'utf8')), '');
  // 8. measured numbers do not count up
  const ansSrc = fs.readFileSync(path.join(ROOT, 'js', 'answer.js'), 'utf8');
  check('Fix 8: no count-up of measured numbers in the answer room', !/count-up|toLocaleString\('en-US'\) : fin/.test(ansSrc) && !/Math\.round\(v \* e\)/.test(ansSrc), '');
  // 9 and 11. prose
  let badProse = 0, n11 = 0;
  for (const c of E.countries(L)) { const r = q[c]; for (const sel of ['latest'].concat(r.monthly.filter(x => x.ym >= '2022-01').map(x => ({ month: x.ym })))) { n11++;
    const t = R.sentence(r, sel); if (/about under 1|median of no data|typical no data|typical: no data/.test(t)) badProse++; } }
  check('Fix 11: no "about under 1" or "median of no data" in any sentence from 2022 (every place)', badProse === 0, n11 + ' sentences; ' + badProse + ' bad');
  check('Fix 11: Andorra 2022-11 reads "under 1 detection ... (no typical: too few other years)"', /under 1 detection/.test(R.sentence(q.Andorra, { month: '2022-11' })) && /no typical: too few other years/.test(R.sentence(q.Andorra, { month: '2022-11' })), R.sentence(q.Andorra, { month: '2022-11' }));
  // 13. the answer can open any month
  const appSrc = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8'), recSrc = fs.readFileSync(path.join(ROOT, 'js', 'record.js'), 'utf8');
  check('Fix 13: "#answer/YYYY-MM" opens a month on the answer; the calendar offers it; the landing offers the way back', /#answer\/YYYY-MM/.test(appSrc) && /answerSel/.test(appSrc) && /answerSel/.test(ansSrc) && /Open this month as the answer/.test(recSrc) && /Back to now/.test(ansSrc) && /another month/.test(fs.readFileSync(path.join(ROOT, "js", "readings.js"), "utf8")), '');
  const past = R.forPeriod(arg, { month: '2015-08' });
  check('Fix 13: a past month before 2022 shows one card (no older reading)', past.older === null && !past.olderMissing, past.headline);

  // ================= Nov 14 morning: the new voice (VOICE_AND_COPY_0704.md) =================
  // feel(): the five check cases in the copy file
  const fc = [[550, 538, 'almost exactly the usual', 2], [757, 556.5, 'about a third more than usual', 36], [1574, 6552, 'about a quarter of the usual', null], [739, 2165, 'about a third of the usual', null], [11939, 23451, 'about half the usual', null]];
  for (const [v, t, want, p] of fc) { const x = R.feel(v, t); check('feel(' + v + ', ' + t + ') = "' + want + '"' + (p !== null ? ' (' + p + '% over)' : ''), x && x.phrase === want && (p === null || x.pct === p), x && (x.phrase + ' / ' + x.pct + '%')); }
  check('feel(): no phrase when either number is under 16', R.feel(3, 8) === null && R.feel(15, 200) === null && R.feel(200, 15) === null && R.feel(null, 40) === null, String(R.feel(3, 8)));
  check('say(): the six verdict words', R.say('much quieter') === 'Far quieter than normal' && R.say('quieter') === 'Quieter than normal' && R.say('about usual') === 'About normal' && R.say('busier') === 'Busier than normal' && R.say('much busier') === 'Far busier than normal' && R.say('too few to call') === 'Too little fire to judge', '');
  // which record leads
  const ni = await get('Niger');   // the still-one-number test place for the weak-record form (Ghana moved to twelve numbers on Nov 14)
  const sA = R.screen(arg, 'latest'), sG = R.screen(gh, R.positions(gh).month), sGr = R.screen(gr, R.positions(gr).month), sAn = R.screen(q.Andorra, R.positions(q.Andorra).month), sN = R.screen(ni, R.positions(ni).month);
  check('Leading record: Argentina ours, Ghana ours (was MODIS before the repair), Niger MODIS, Andorra none, Greece none', sA.f.lead === 'ours' && sG.f.lead === 'ours' && sN.f.lead === 'modis' && sAn.f.lead === 'none' && sGr.f.lead === 'none', [sA.f.lead, sG.f.lead, sN.f.lead, sAn.f.lead, sGr.f.lead].join(', '));
  // Argentina's first screen, word for word (every number in it read from the engine)
  check('First screen Argentina: question, answer, felt sentence', sA.question === 'Is Argentina burning more than usual?' && sA.answer === 'About normal for early November.' && sA.felt === 'Satellites picked up almost exactly the usual amount of fire across Argentina in these twelve days.', sA.answer + ' | ' + sA.felt);
  check('First screen Argentina: the MODIS line', sA.modis && sA.modis.text === 'One catch: MODIS, NASA\'s older camera, counted on its own, saw about a third more than its usual. The two cameras don\'t agree this month.', sA.modis && sA.modis.text);
  check('First screen Argentina: "what\'s been happening" (Aug 1,574 vs 6,552; Oct 739 vs 2,165; MODIS the same way)', sA.happening === 'It follows a strangely quiet season: August saw about a quarter of its usual fire, October about a third.', sA.happening);
  check('First screen Argentina: the small print', sA.small === '550 detections this period; 538 is usual for these dates (the middle of 26 other years). MODIS alone: 757; its usual is 557.', sA.small);
  check('First screen Argentina: EARLY DATA with both notes', sA.early && sA.earlyTip === 'The last few months come from NASA\'s rapid feed and can still change. Days 1 to 12 so far, compared with the same days in other years.', sA.earlyTip);
  const sAy = R.screen(arg, R.positions(arg).year), sAs = R.screen(arg, R.positions(arg).season);
  check('First screen Argentina, this year so far: 11,939 vs 23,451, "Far quieter than normal so far this year." / about half', sAy.answer === 'Far quieter than normal so far this year.' && rnd(sAy.f.ours.value) === 11939 && sAy.f.ours.typical === 23451 && /about half the usual amount of fire/.test(sAy.felt), sAy.answer + ' | ' + sAy.felt);
  const seasonIndep = ['2026-07', '2026-08', '2026-09'].reduce((t, m) => t + E.month(arg, m).value, 0);
  check('First screen Argentina, last fire season: July to September 2026 = the three months summed (' + R.fmt(seasonIndep) + '), "far quieter than normal"', sAs.f.kind === 'season' && Math.abs(sAs.f.ours.value - seasonIndep) < 1e-6 && sAs.answer === 'This fire season (July to September) was far quieter than normal.', R.fmt(sAs.f.ours.value) + ' | ' + sAs.answer);
  check('Argentina rank for the story\'s scale: ours = the engine\'s rank (14 of 26 below), MODIS about 0.71', near(sA.f.ours.rankFraction, arg.current.rank.busier_than / arg.current.rank.of, 0.02) && near(sA.f.older.rankFraction, 0.708, 0.01), sA.f.ours.rankFraction.toFixed(3) + ' vs engine ' + (arg.current.rank.busier_than / arg.current.rank.of).toFixed(3) + '; MODIS ' + sA.f.older.rankFraction.toFixed(3));
  check('Short sentence (slide 6), Argentina', R.shortSentence(arg, 'latest') === 'Fire activity across Argentina was about normal in early November on the 26-year satellite record. NASA\'s older MODIS camera, counted on its own, saw about a third more than usual. Early data.', R.shortSentence(arg, 'latest'));
  check('periodWords: early November / October / so far this year / this fire season', R.periodWords(sA.f) === 'early November' && R.periodWords(R.forPeriod(arg, { month: '2026-10' })) === 'October' && R.periodWords(sAy.f) === 'so far this year' && R.periodWords(sAs.f) === 'this fire season (July to September)',
    [R.periodWords(sA.f), R.periodWords(R.forPeriod(arg, { month: '2026-10' })), R.periodWords(sAy.f), R.periodWords(sAs.f)].join(' / '));
  // Ghana: the weak-record form
  check('First screen Ghana (repaired): "Far quieter than normal for December." from our record (3,669 vs 9,390), MODIS says the same', sG.answer === 'Far quieter than normal for December.' && sG.weak === null && sG.modis && sG.modis.text === 'MODIS, NASA\'s older camera, counted on its own, says the same.' && /^3,669 detections in December; 9,390 is usual/.test(sG.small), sG.answer + ' | ' + sG.weak + ' | ' + sG.small);
  check('First screen Niger (one number, the weak-record form): "Far busier than normal for December." going by MODIS (110 vs 61), ours only in the small print', sN.answer === 'Far busier than normal for December.' && sN.weak === 'Going by MODIS, NASA\'s older camera. Our own 25-year record is unreliable for Niger.' && sN.modis === null && /^Our record: 114 detections/.test(sN.small) && sN.f.older.value === 110 && sN.f.older.typical === 61, sN.answer + ' | ' + sN.weak + ' | ' + sN.small);
  // Greece: too little fire
  check('First screen Greece: "Hardly any fire to count in December." / "3 detections; 8 is usual. That\'s too little to call it quiet or busy."', sGr.answer === 'Hardly any fire to count in December.' && sGr.tooLittle === '3 detections; 8 is usual. That\'s too little to call it quiet or busy.', sGr.answer + ' | ' + sGr.tooLittle);
  check('First screen Andorra: too little fire, no MODIS count, record ends November 2022', sAn.answer === 'Hardly any fire to count in November.' && /^Next to nothing detected/.test(sAn.tooLittle) && sAn.f.olderMissing && sAn.f.ym === '2022-11', sAn.answer + ' | ' + sAn.tooLittle);
  // the two new screens carry no old unit name
  const recSrc2 = fs.readFileSync(path.join(ROOT, 'js', 'record.js'), 'utf8');
  check('No "lit square" in the first screen or the monthly record code; the monthly record has its heading, switch and table link', !/lit square/i.test(ansSrc) && !/lit square/i.test(fs.readFileSync(path.join(ROOT, 'js', 'record_depth.js'), 'utf8')) && /A year of fire, <em>month by month/.test(recSrc2) && /Show the table/.test(recSrc2) && /Laid over each other/.test(recSrc2), '');

  // ================= Nov 14 day build (round_SAT, page and record lane) =================
  // 1. public-safe: the sweep finds nothing in this lane's files; one record span, from the data, said one way
  const { execFileSync } = require('child_process');
  let sweepOut = ''; try { sweepOut = execFileSync(process.execPath, [path.join(ROOT, 'tools', 'public_sweep.cjs')], { encoding: 'utf8' }); } catch (e) { sweepOut = String(e.stdout || e.message); }
  check('Public-safe sweep: no name, machine path, e-mail or key in the page and record lane\'s files', /Page and record lane: 0 hits\./.test(sweepOut), (sweepOut.match(/Page and record lane: [^\n]*/) || [''])[0]);
  check('Record span from the data, in whole years by month: Argentina 26, Ghana 25, Andorra 25 (record Nov 2000 to Dec 2025)', R.recordYears(arg) === 26 && R.recordYears(gh) === 25 && R.recordYears(q.Andorra) === 25, [R.recordYears(arg), R.recordYears(gh), R.recordYears(q.Andorra)].join(' / '));
  check('recordName: "our 26-year record" and its first-use form', R.recordName(arg) === 'our 26-year record' && R.recordName(arg, true) === 'our 26-year record: MODIS and VIIRS on one scale' && R.recordName(gh) === 'our 25-year record', R.recordName(gh));
  const sGh = R.screen(gh, R.positions(gh).month), ghTexts = [sGh.weak, sGh.keyOurs, sGh.buttons.join(' '), R.shortSentence(gh, 'latest')].join(' | ');
  check('Ghana says one span everywhere on its first screen and report sentence (25), never 26; Niger\'s weak line too', /25-year/.test(sN.weak) && /25-year/.test(sGh.keyOurs) && /Explore 25 years/.test(sGh.buttons[1]) && /25-year/.test(R.shortSentence(gh, 'latest')) && !/26[- ]year/.test(ghTexts), ghTexts);
  const laneJs = ['answer.js', 'app.js', 'readings.js', 'record.js', 'record_depth.js', 'record_world.js'].map(n => fs.readFileSync(path.join(ROOT, 'js', n), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n')).join('\n');
  check('No typed record span ("26-year", "25-year", "26 years") in the page lane\'s code', !/\b2[56][- ]years?\b/.test(laneJs), (laneJs.match(/.{30}\b2[56][- ]years?\b.{10}/) || ['none'])[0]);

  // 2. the other record tabs in the new voice
  const code = (n) => fs.readFileSync(path.join(ROOT, 'js', n), 'utf8').split('\n').filter(l => !/^\s*\/\//.test(l)).join('\n');
  const recC = code('record.js'), worC = code('record_world.js');
  check('Record headings are the questions people ask', /Which years <em>burned most\?/.test(recC) && /'How is <em>'/.test(recC) && /Where can you <em>trust this\?/.test(worC) && /Say it <em>in a report/.test(recC), '');
  check('No "lit square", "joined record", "the older camera alone" or "older camera\'s own" left in the record tabs\' code', !/lit square|joined record|the older camera alone|older camera\\?'s own/i.test(recC + worC), (recC + worC).match(/.{20}(lit square|joined record|the older camera alone).{10}/i) || 'none');
  check('"Say it in a report": the short sentence first, the long exact one under "The full version"', recC.indexOf('R.shortSentence(r, { month: m.sentYm })') > 0 && recC.indexOf('The full version') > recC.indexOf('id="s-text"') && /R\.sentence\(r, \{ month: m\.sentYm \}\)/.test(recC), '');
  check('Which years burned most (Argentina): the near tie said plainly', R.yearsLine(arg) === '2020 and 2003 burned most, and they\'re too close to pick one: 45,295 and 45,227 detections, a gap smaller than our record\'s usual miss here.', R.yearsLine(arg));
  const mpA = R.monthPanel(arg, '2026-11'), mpG = R.monthPanel(ni, '2025-12');
  check('Month panel: what happened first, counts second (Argentina Nov 2026; Niger Dec 2025 goes by MODIS and says why; was Ghana May 2022 before the repair)', mpA.say === 'About normal: almost exactly the usual amount of fire.' && /^MODIS alone: busier than normal/.test(mpA.modis) && /^550 detections on our 26-year record/.test(mpA.counts) &&
    /^Far busier than normal, going by MODIS/.test(mpG.say) && /^Our record is unreliable for Niger/.test(mpG.weak) && /Go by MODIS/.test(mpG.weak), mpA.say + ' | ' + mpG.say);
  const ysA = R.yearSay(arg, 2026);
  check('How is this year going (Argentina 2026): far quieter, about half, MODIS says the same', ysA.line === 'Far quieter than normal so far this year: about half the usual amount of fire.' && ysA.modis && ysA.modis.agree, ysA.line);
  // 3. "How we know"
  const rec = (() => { const g = {}; new Function('window', 'document', fs.readFileSync(path.join(ROOT, 'js', 'record.js'), 'utf8'))(g, {}); return g.Record; })();
  check('How we know: the ten questions, in order', rec.HOW_QUESTIONS.join(' | ') === 'What are we counting? | Why are there two cameras? | How do you put them on one scale? | How do you know it works? | Where doesn\'t it work? | Why do the two cameras disagree lately? | What is "early data"? | What else is out there? | What this is not | Who made this', rec.HOW_QUESTIONS.length);
  check('How we know: every answer opens closed (no <details open>)', !/<details open|details' \+ \(open/.test(recC.slice(recC.indexOf('function how('))), '');
  check('How we know: NASA\'s caution word for word', rec.NASA_CAUTION === 'Due to the spatial resolution and other characteristics of these data, their use for tactical decision-making or informing about conditions at a local scale are not advised.', '');
  check('How we know: Argentina\'s cameras lately, from the data: "within 3% in 2022 and 2023, about 7% lower in 2024 and 2025"', R.gapWords(R.afterGaps(arg)) === 'within 3% in 2022 and 2023, about 7% lower in 2024 and 2025', R.gapWords(R.afterGaps(arg)));
  const howC = recC.slice(recC.indexOf('function how('));
  check('How we know: names the other public tools as plain facts, never as users or endorsers; the credit line', /INPE/.test(howC) && /GWIS and EFFIS show this year\\'s fire week by week against past years, with separate MODIS and VIIRS comparisons\. Global Nature Watch shows a weekly VIIRS comparison\./.test(howC) && !/GWIS, EFFIS and Global Nature Watch/.test(howC) && /CONAE/.test(howC) && /FireCalendar/.test(howC) && /None of them is connected to this page/.test(howC) && !/endorse|uses this page|partner/i.test(howC) &&
    /built at NASA Space Apps 2026 by team Spark Squad from NASA\\'s public FIRMS data/.test(howC) && /No outside expert in satellite fire data has reviewed it/.test(howC), '');
  // 4. the period picker
  const ansC = fs.readFileSync(path.join(ROOT, 'js', 'answer.js'), 'utf8');
  check('Period picker: "another month ▾" beside the switch sets #answer/YYYY-MM; "Back to now" returns', /class="a-other-btn"/.test(ansC) && /go\('#answer\/' \+ ms\.value\)/.test(ansC) && /href="#answer">Back to now</.test(ansC), '');
  const p15 = R.screen(arg, { month: '2015-08' }), p23 = R.screen(arg, { month: '2023-08' }), pIn = R.screen(ind, { month: '2020-08' });
  check('A past month before 2022: one answer and one small line (MODIS was the record); from 2022 no such line; VIIRS standing in said so', p15.past === 'Before 2022 MODIS was the record, so there\'s one answer.' && !p15.modis && p23.past === null && /VIIRS stood in/.test(pIn.past || ''), p15.past + ' | ' + pIn.past);
  // 5. the walk: sentences a person would say, for eleven places in every position
  const WALK = ['Argentina', 'Brazil', 'Australia', 'United_States', 'Indonesia', 'Canada', 'Ghana', 'Cyprus', 'Greece', 'Andorra', 'Monaco'];
  const bad = [];
  for (const c of WALK) { const r = await get(c), ps = R.positions(r);
    for (const sel of [ps.month, ps.year, ps.season].filter(Boolean)) { const s = R.screen(r, sel);
      const text = s.refusal || [s.question, s.answer, s.weak, s.felt, s.tooLittle, s.small, s.modis && s.modis.text, s.happening, s.past, s.caption, R.shortSentence(r, sel)].filter(Boolean).join(' ');
      if (/about \d+ times|across United|for United|Is United|Read MODIS|lit square|under 1 detection|\(Dem\.|\(Rep\./.test(text)) bad.push(c + ': ' + text.match(/.{0,30}(about \d+ times|across United|for United|Is United|Read MODIS|lit square|under 1 detection|\(Dem\.|\(Rep\.).{0,20}/)[0]);
      if (s.modis && s.modis.sameWay && /don't agree/.test(s.modis.text)) bad.push(c + ': same-way line says "don\'t agree"');
      if (!s.refusal && !s.answer) bad.push(c + ': no answer'); if (s.refusal && /undefined/.test(s.refusal)) bad.push(c + ': ' + s.refusal); } }
  check('Walk of eleven places, every switch position: no digits in "times", "the" where English wants it, no "Read MODIS first", no "under 1 detection", every screen answers', bad.length === 0, bad.join(' || ') || 'clean');
  check('Walk: "the United States" in the question; Cyprus 2025 says too few years, not "hardly any fire"', R.screen(await get('United_States'), 'latest').question === 'Is the United States burning more than usual?' && /^Too few other years with data to judge 2025/.test(R.screen(q.Cyprus, { year: 2025 }).answer), R.screen(q.Cyprus, { year: 2025 }).answer);
  // 6. the working title: one constant, read by the page title, the bar and "How we know"
  const appC = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8');
  check('Working title: one constant ("Two Cameras, One Calendar"); document.title, the bar and "How we know" read it', (appC.match(/Two Cameras, One Calendar/g) || []).length === 1 && /document\.title = TITLE/.test(appC) && /getElementById\('title'\)\.textContent = TITLE/.test(appC) && /title: TITLE/.test(appC) && /ctx\.title/.test(howC) &&
    !/Two Cameras, One Calendar/.test(recC + ansC + code('readings.js') + fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8')), '');

  // ================= second-family review of the morning rewrite (sol_check_morning\MORNING_REVIEW.md) =================
  const cam = await get('Cambodia'), fCam = R.forPeriod(cam, { month: '2024-07' });
  check('Review 1: Cambodia July 2024 (strong record, ours under 16): ours stays the lead in its too-little state, MODIS does not lead', fCam.lead === 'none' && fCam.ours.tooFew && !fCam.ours.weak && /^Hardly any fire to count/.test(R.screen(cam, { month: '2024-07' }).answer), fCam.lead);
  let leadBad = 0, weakBad = 0, unrelBad = 0, nLead = 0; const leadEx = [];
  for (const c of E.countries(L)) { const r = q[c]; for (const x of r.monthly) { if (x.ym < '2022-01' || x.status === 'partial') continue; const sc = R.screen(r, { month: x.ym }), f2 = sc.f; if (f2.refusal) continue; nLead++;
    if (f2.lead === 'modis' && !f2.ours.weak) { leadBad++; if (leadEx.length < 3) leadEx.push(c + ' ' + x.ym); }
    if (f2.ours.weak && f2.ours.value !== null && !f2.ours.word && !(f2.lead === 'modis' || ((f2.lead === 'weak' || f2.lead === 'none') && sc.weak && sc.answer))) { weakBad++; if (leadEx.length < 3) leadEx.push('weak ' + c + ' ' + x.ym); }
    if (/unreliable/.test(R.shortSentence(r, { month: x.ym })) && !f2.ours.weak) unrelBad++; } }
  check('Review 1: every month from 2022, every place: MODIS leads only where our record is weak for the carrying camera', leadBad === 0, nLead + ' months; ' + leadBad + ' wrong' + (leadEx.length ? ' (' + leadEx.join(', ') + ')' : ''));
  check('Review 2: every weak month without a MODIS verdict says our count AND the weak-record warning, never a silent "none"', weakBad === 0, weakBad + ' silent');
  check('Review 4: the short sentence says "unreliable" only when our record is weak (every month from 2022)', unrelBad === 0, unrelBad + ' wrong');
  const est = await get('Estonia'), fEst = R.forPeriod(est, { season: 2025 });
  check('Review 3: MODIS availability from its own rows: Estonia April to July 2025 MODIS usual 15 from 11 seasons (not 16.5 from 10)', fEst.older && fEst.older.typical === 15 && fEst.older.years === 11, fEst.older && (fEst.older.typical + ' from ' + fEst.older.years));
  const sam = await get('American_Samoa');
  check('Review 3: American Samoa November 2022: MODIS tick 1 in the depth view; the report sentence says OUR record has no data and keeps MODIS\'s count', R.modisMonth(sam, '2022-11') === 1 && /^Our record has no data for American Samoa in November 2022\. NASA's older MODIS camera, counted on its own, saw 1 detection/.test(R.shortSentence(sam, { month: '2022-11' })) && !/There is no data/.test(R.shortSentence(sam, { month: '2022-11' })), R.shortSentence(sam, { month: '2022-11' }));
  let tickBad = 0; for (const c of E.countries(L)) { const r = q[c]; for (const x of r.monthly) { if (x.ym < '2022-01' || x.status === 'partial') continue; if (R.hasRow(r, 'Aqua', x.ym) && x.raw && x.raw.Aqua !== null && x.raw.Aqua !== undefined && R.modisMonth(r, x.ym) === null) tickBad++; } }
  check('Review 3: every month from 2022 with a MODIS row has its tick (235 places)', tickBad === 0, tickBad + ' missing');
  const els = await get('El_Salvador');
  check('Review 5: "what\'s been happening" walks back to three FINISHED months (El Salvador July 2025 names March and April)', /March .*April/.test(R.screen(els, { month: '2025-07' }).happening || ''), R.screen(els, { month: '2025-07' }).happening);
  let hapBad = 0, nHap = 0;
  for (const c of E.countries(L)) { const r = q[c]; for (const x of r.monthly) { if (x.ym < '2022-04' || x.status === 'partial') continue; const sc = R.screen(r, { month: x.ym }); if (!sc.happening) continue; nHap++;
    const named = R.MONTHS.filter(mn => new RegExp('\\b' + mn + '\\b').test(sc.happening.split(':')[1] || ''));
    for (const mn of named) { let y = +x.ym.slice(0, 4), mo = R.MONTHS.indexOf(mn) + 1; if (mo >= +x.ym.slice(5, 7)) y--; const ym = y + '-' + (mo < 10 ? '0' : '') + mo; if (ym < '2022-01') continue;
      const p = R.forPeriod(r, { month: ym }), fo = R.feel(p.ours.value, p.ours.typical), fm = p.older ? R.feel(p.older.value, p.older.typical) : null;
      if (!fo || !fm || (fo.ratio < 1) !== (fm.ratio < 1)) hapBad++; } } }
  check('Review 5: every "what\'s been happening" line from 2022 names only months where both cameras have comparable counts pointing the same way (weak places too)', hapBad === 0, nHap + ' lines; ' + hapBad + ' unsupported months');
  check('Review 5: Argentina\'s line unchanged (August and October)', R.screen(arg, 'latest').happening === 'It follows a strangely quiet season: August saw about a quarter of its usual fire, October about a third.', '');
  const depthMod = (() => { const g = {}; new Function('window', 'document', fs.readFileSync(path.join(ROOT, 'js', 'record_depth.js'), 'utf8'))(g, {}); return g.RecordDepth; })();
  check('Review 6: a missing month breaks the depth silhouette and the dashed usual line (no floor-level zero segment)', depthMod.stepPath([5, null, 7], true) === 'M0,5L1,5M2,7L3,7' && depthMod.stepPath([5, null, 7]) === 'M0,0L0,5L1,5L1,0ZM2,0L2,7L3,7L3,0Z', depthMod.stepPath([5, null, 7], true));
  check('Review 6: the unfinished month is labelled "days 1 to N" beside its bar', /partial: cal\.cells\[i\]\.map/.test(recC) && /'days 1 to ' \+ days/.test(fs.readFileSync(path.join(ROOT, 'js', 'record_depth.js'), 'utf8')), '');
  check('Review 7: one span label, exported for every lane (Readings.recordName); the page lane never types a span', typeof R.recordName === 'function' && R.recordName(arg) === 'our 26-year record' && !/\b2[56][- ]years?\b/.test(laneJs), '');

  // ================= rank against ratio; names with "the" (coordinator, connector and Story lanes) =================
  check('Fit table: "far quieter" never sits beside "about three-quarters"; "about normal" never beside "about half"', !R.feelFits('much quieter', R.feel(75, 100)) && !R.feelFits('about usual', R.feel(50, 100)) && R.feelFits('about usual', R.feel(102, 100)) && R.feelFits('much quieter', R.feel(50, 100)), '');
  const PHRASES = ['a small fraction of', 'about a quarter of', 'about a third of', 'about half', 'about two-thirds of', 'about three-quarters of', 'a little under', 'a little less fire', 'almost exactly', 'a little over', 'a little more fire', 'about a quarter more', 'about a third more', 'about half again', 'about double', 'times the usual'];
  let clashes = 0, replaced = 0, nPos = 0; const clashEx = [];
  for (const c of E.countries(L)) { const r = q[c], ps = R.positions(r);
    for (const sel of [ps.month, ps.year, ps.season].filter(Boolean)) { const s = R.screen(r, sel), f2 = s.f; if (s.refusal) continue; nPos++;
      const word = f2.lead === 'ours' ? f2.ours.word : f2.lead === 'modis' ? f2.older.word : null, fl = f2.lead === 'ours' ? f2.ours.feel : f2.lead === 'modis' ? f2.older.feel : null;
      if (!word || !fl) continue;
      const texts = [s.felt, R.shortSentence(r, sel)].concat(sel.month ? [R.monthPanel(r, sel.month).say] : sel.year ? [R.yearSay(r, sel.year.year || sel.year).line] : []).filter(Boolean).join(' || ');
      const shown = PHRASES.some(p => texts.indexOf(p) >= 0 && fl.phrase.indexOf(p.replace(' fire', '').replace('less', 'under').replace('more', 'over')) >= 0);
      if (!R.feelFits(word, fl)) { replaced++; if (texts.indexOf(fl.phrase.replace(/ the usual$| than usual$/, '')) >= 0 && !/^about (half|a third|a quarter|double)/.test('x')) { if (s.felt && s.felt.indexOf(fl.phrase.replace(/ the usual$| than usual$/, '')) >= 0) { clashes++; if (clashEx.length < 3) clashEx.push(c + ': ' + s.answer + ' | ' + s.felt); } } }
      else if (!shown && s.felt && !/picked up/.test(s.felt)) clashes++; } }
  check('Rank vs ratio: in every country\'s three first-screen positions, a verdict never sits beside a felt phrase from outside its range (the rank is said instead)', clashes === 0, nPos + ' screens; ' + replaced + ' said by rank; ' + clashes + ' clashes' + (clashEx.length ? ' (' + clashEx.join(' || ') + ')' : ''));
  const wt3 = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'world_table.json'), 'utf8'));
  const WANT_THE = ['Åland Islands', 'Bahamas', 'British Virgin Islands', 'Cayman Islands', 'Central African Republic', 'Comoros', 'Cook Islands', 'Czech Republic', 'Democratic Republic of the Congo', 'Dominican Republic', 'Faroe Islands', 'Falkland Islands', 'French Southern and Antarctic Lands', 'Heard and McDonald Islands', 'Isle of Man', 'Netherlands', 'Northern Mariana Islands', 'Philippines', 'Republic of Congo', 'Russian Federation', 'Solomon Islands', 'The Gambia', 'Turks and Caicos Islands', 'United Arab Emirates', 'United Kingdom', 'United States', 'United States Minor Outlying Islands', 'United States Virgin Islands', 'Wallis and Futuna Islands'];
  const artBad = wt3.rows.filter(x => /^the /.test(R.inSentence(x.name)) !== WANT_THE.includes(x.name) || /\(/.test(R.inSentence(x.name))).map(x => x.name + ' -> ' + R.inSentence(x.name));
  check('Names in sentences (all 235): "the" exactly where English wants it, no bracketed alias; every sentence uses the one helper', artBad.length === 0 && R.inSentence('The Gambia') === 'the Gambia' && R.screen(await get('Dominican_Republic'), 'latest').question === 'Is the Dominican Republic burning more than usual?' && !/' \+ f\.place \+ '/.test(code('readings.js').slice(code('readings.js').indexOf('function answerLine'), code('readings.js').indexOf('function screenLabel'))), artBad.join(' | ') || 'clean');

  // "Ask your own AI" (the team lead's ruling, 10:53 AM)
  const recAll = fs.readFileSync(path.join(ROOT, 'js', 'record.js'), 'utf8'), askC = recAll.slice(recAll.indexOf('function ask('), recAll.indexOf('// ---------- 6. how we know'));
  check('"Ask your own AI": a record tab after "Say it in a report", answers from Readings at run time, a relative link to connector/README.md', /\['sentence', 'In a report'\], \['ask', 'Ask your own AI'\]/.test(recAll) && /'sentence', 'ask', 'how'/.test(appC) && /href="connector\/README\.md"/.test(askC) && /R\.screen\(arg, 'latest'\)\.answer|s1\.answer/.test(askC) && /R\.yearsLine\(r\)/.test(askC) && !/\d{3}/.test(askC.replace(/\d{3}\s*AM|10:53/g, '')), '');

  // ================= connector review, part 3 (mcp_sol_check\CONNECTOR_REVIEW.md) =================
  const longSam = R.sentence(sam, { month: '2022-11' });
  check('Connector review 1: the full report sentence keeps MODIS\'s count when our record has no data (American Samoa November 2022: MODIS 1)', /no data on our record/.test(longSam) && /MODIS, NASA's older camera, counted 1 on its own/.test(longSam), longSam);
  let modisClash = 0, nMl = 0; const mcEx = [];
  for (const c of E.countries(L)) { const r = q[c]; for (const x of r.monthly) { if (x.ym < '2022-01' || x.status === 'partial') continue; const f2 = R.forPeriod(r, { month: x.ym }); if (f2.refusal || !f2.older || !f2.older.feel || !f2.older.word) continue;
    const ml = R.modisLine(f2), core = f2.older.feel.phrase.replace(/ the usual$| than usual$/, ''); nMl++;
    const texts = [ml && ml.text, R.shortSentence(r, { month: x.ym }), R.monthPanel(r, x.ym).modis].filter(Boolean).join(' || ');
    if (!R.feelFits(f2.older.word, f2.older.feel) && texts.indexOf(core) >= 0) { modisClash++; if (mcEx.length < 2) mcEx.push(c + ' ' + x.ym + ': ' + texts.slice(0, 160)); } } }
  check('Connector review 2: MODIS\'s felt phrase never contradicts MODIS\'s own verdict (first screen, short sentence, month panel; every month from 2022; Argentina January 2025 included)', modisClash === 0 && !/half again/.test((R.modisLine(R.forPeriod(arg, { month: '2025-01' })) || {}).text || ''), nMl + ' months; ' + modisClash + ' clashes' + (mcEx.length ? ' (' + mcEx.join(' || ') + ')' : ''));
  const longA = R.sentence(arg, 'latest');
  check('Connector review 3: one wording, "early data", in the long sentence too (no "provisional: near-real-time")', /\(early data\)/.test(longA) && !/provisional|near-real-time/.test(longA), longA.slice(0, 120));
  const longS = R.sentence(arg, R.positions(arg).season), longY = R.sentence(arg, R.positions(arg).year);
  check('Connector review 4: the long sentence names the span truly (a season: "the same season in other years"; the year so far: "the same dates in other years")', /same season in other years/.test(longS) && /same dates in other years/.test(longY) && !/other whole years/.test(longS + longY), longS.slice(0, 160) + ' || ' + longY.slice(0, 160));

  // ================= Nov 14, 1:57 PM: the busy-twelve repair (refine/r1/APPLIED.md) =================
  const engSrc = fs.readFileSync(path.join(BASE, 'engine', 'hs_engine.js'), 'utf8');
  check('REPAIR GUARD: the engine still carries the busy-twelve rule (an old engine copied back over it fails here; see tools/copy_parts.cjs)',
    /BUSY TWELVE RULE/.test(engSrc) && /const BUSY_MONTH = 50;/.test(engSrc) && gh.factors.SNPP.mode === 'month_of_year' && gh.factors.SNPP.busy_twelve === true && gh.hide_a_year.SNPP.mode === 'month_of_year',
    'rule text ' + /BUSY TWELVE RULE/.test(engSrc) + '; Ghana ' + gh.factors.SNPP.mode + ' busy_twelve=' + gh.factors.SNPP.busy_twelve);
  const br = await get('Brazil'), bd = await get('Bangladesh');
  check('Repair left a twelve-number country unchanged to the digit (Brazil 6.806962865305108% over 118 months)', br.hide_a_year.SNPP.typical_pct === 6.806962865305108 && br.hide_a_year.SNPP.months === 118 && br.factors.SNPP.mode === 'month_of_year', br.hide_a_year.SNPP.typical_pct + ' / ' + br.hide_a_year.SNPP.months);
  check('Repair left a quiet one-number country unchanged to the digit (Bangladesh 79.6080863325626% over 110 months, one number)', bd.hide_a_year.SNPP.typical_pct === 79.6080863325626 && bd.hide_a_year.SNPP.months === 110 && bd.factors.SNPP.mode === 'single' && bd.factors.SNPP.busy_twelve === false, bd.hide_a_year.SNPP.typical_pct + ' / ' + bd.factors.SNPP.mode);
  check('Repair: Niger (quiet, one number) unchanged: 47.63869012242205%, one number, MODIS leads', ni.hide_a_year.SNPP.typical_pct === 47.63869012242205 && ni.factors.SNPP.mode === 'single', ni.hide_a_year.SNPP.typical_pct);
  const SIX = ['Algeria', 'Egypt', 'Kuwait', 'Libya', 'Oman', 'Syria'], sixBad = [];
  for (const c of SIX) { const r = await get(c), s = R.score(r), fl = R.forPeriod(r, 'latest');
    if (!(s.rule === 'twelve' && s.typicalPct > 25 && fl.ours.weak && /typically missed MODIS's own count here by about/.test(fl.ours.weak) && fl.ours.word === null)) sixBad.push(c + ' ' + s.rule + ' ' + (fl.ours.weak || 'no weak line')); }
  check('Weak-record gap closed: the six twelve-number places with a past typical miss over 25% (Algeria, Egypt, Kuwait, Libya, Oman, Syria) carry the weak line and give no word of their own', sixBad.length === 0, sixBad.join(' | ') || 'all six');
  const sAl = R.screen(await get('Algeria'), R.positions(q.Algeria).month);
  check('Algeria Dec 2025 now goes by MODIS ("About normal for December.", our 18 only in the small print)', sAl.f.lead === 'modis' && sAl.answer === 'About normal for December.' && /^Our record: 18 detections/.test(sAl.small), sAl.f.lead + ' | ' + sAl.answer + ' | ' + sAl.small);

  // ================= Nov 14: the unit switch, MODIS's scale / VIIRS's scale (OFF by default; reverse_join/UNIT_SWITCH_BUILT.md) =================
  const appSrcU = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8'), idxSrc = fs.readFileSync(path.join(ROOT, 'index.html'), 'utf8');
  // Nov 15, 10 AM: the page now OPENS on VIIRS's scale (to match the talk); ?scale=modis opens it on MODIS's scale
  check('Unit switch SHOWN: UNIT_SWITCH = true in js/app.js; the page opens on VIIRS\'s scale unless ?scale=modis, and MODIS\'s scale is the very same result object as the pre-switch page',
    /const UNIT_SWITCH = true;/.test(appSrcU) && /<div id="units" hidden><\/div>/.test(idxSrc) && /scale: qs\.get\('scale'\) === 'modis' \? 'modis' : 'viirs' \}/.test(appSrcU) && R.onScale(arg, 'modis') === arg && !arg.unit, '');
  const argV = R.onScale(arg, 'viirs');
  const wantY = { 2003: 140958, 2005: 87608, 2014: 42850, 2016: 66379, 2020: 144130, 2021: 66981, 2022: 89043, 2025: 61683 };
  const gotY = Object.keys(wantY).map(y => { const t = argV.year_totals.find(x => x.year === +y); return y + ' ' + (t && t.total !== null ? rnd(t.total) : 'none'); });
  check('VIIRS scale, Argentina yearly totals match the reverse-join research to the digit (2003 140,958; 2005 87,608; 2014 42,850; 2016 66,379; 2020 144,130; 2021 66,981; 2022 89,043; 2025 61,683)',
    Object.keys(wantY).every(y => { const t = argV.year_totals.find(x => x.year === +y); return t && rnd(t.total) === wantY[y]; }) && rnd(argV.year_totals.find(x => x.year === 2022).typical_other) === 77217, gotY.join(', '));
  check('VIIRS scale, Argentina: MODIS-scale totals unchanged underneath (2020 45,295; 2003 45,227) and the busiest year stays a near tie on both scales', rnd(arg.year_totals.find(x => x.year === 2020).total) === 45295 && rnd(arg.year_totals.find(x => x.year === 2003).total) === 45227 && /2020 and 2003 burned most/.test(R.yearsLine(argV) || ''), R.yearsLine(argV));
  const mKey = (f) => [f.lead, f.ours.word, f.ours.tooFew, f.ours.noData, f.older && f.older.word, f.ours.feel && f.ours.feel.phrase, f.older && f.older.feel && f.older.feel.phrase, R.answerLine ? '' : ''].join('|');
  let mDiffU = 0, mN = 0; const mEx = [];
  for (const c of ['Argentina', 'Ghana', 'Brazil', 'Australia', 'Niger', 'Bangladesh', 'Russian_Federation', 'Burkina_Faso', 'Algeria']) {
    const r0 = await get(c), rv = R.onScale(r0, 'viirs'); if (!rv) continue;
    const yms = c === 'Argentina' ? r0.monthly.map(x => x.ym) : r0.monthly.filter((x, i) => i % 7 === 0 || x.status === 'partial').map(x => x.ym);
    for (const ym of yms) { const a = R.forPeriod(r0, { month: ym }), b = R.forPeriod(rv, { month: ym }); if (a.refusal || b.ours.noScale) continue; mN++;
      if (mKey(a) !== mKey(b) || R.screen(r0, { month: ym }).answer !== R.screen(rv, { month: ym }).answer) { mDiffU++; if (mEx.length < 3) mEx.push(c + ' ' + ym); } }
  }
  check('VIIRS scale: every month\'s verdict, lead, felt phrase and first-screen answer is identical on both scales (every Argentina month; every 7th month of eight more places)', mN > 600 && mDiffU === 0, mN + ' months; ' + mDiffU + ' differ ' + mEx.join(', '));
  let canN = 0, cantN = 0, badU = 0; const badExU = [];
  const okNum = (v) => v === null || v === undefined || (typeof v === 'number' && isFinite(v) && v >= 0);
  for (const c of E.countries(L)) { const r0 = await get(c), chk = R.scaleCheck(r0), rv = R.onScale(r0, 'viirs');
    if (!chk.ok) { cantN++; if (rv !== null || !/no conversion numbers of its own|no usable month/.test(chk.why || '')) { badU++; if (badExU.length < 3) badExU.push(c + ' disabled wrongly'); } continue; }
    canN++;
    const nums = []; for (const x of rv.monthly) nums.push(x.value, x.median, x.raw && x.raw.Aqua); for (const t of rv.year_totals) nums.push(t.total, t.typical_other);
    if (rv.current) nums.push(rv.current.value, rv.current.median, rv.current.year_so_far && rv.current.year_so_far.value);
    if (!nums.every(okNum)) { badU++; if (badExU.length < 3) badExU.push(c); } }
  check('VIIRS scale: 163 places can switch and the 72 shared-curve or numberless places cannot (with the plain reason); no NaN, Infinity or negative count anywhere in all 235 files on either scale', canN === 163 && cantN === 72 && badU === 0, canN + ' / ' + cantN + '; badU ' + badU + ' ' + badExU.join(', '));
  const bfV = R.onScale(await get('Burkina_Faso'), 'viirs'), bfJ = R.forPeriod(bfV, { month: '2025-07' }), slV = R.onScale(await get('Sierra_Leone'), 'viirs');
  check('VIIRS scale: a month whose conversion number is 0 shows "no count on this scale", never 0 (Burkina Faso July, Sierra Leone August)', bfJ.ours.noScale && bfJ.ours.value === null && /^No count on VIIRS's scale for July 2025/.test(R.screen(bfV, { month: '2025-07' }).answer) &&
    bfV.monthly.filter(x => x.ym.slice(5) === '07').every(x => x.value === null) && slV.monthly.filter(x => x.ym.slice(5) === '08').every(x => x.value === null) && bfV.year_totals.every(t => t.total === null), R.screen(bfV, { month: '2025-07' }).answer);
  const cyV = R.onScale(await get('Cyprus'), 'viirs'), cyC = R.scaleCheck(q.Cyprus);
  check('VIIRS scale is refused for a shared-curve place (Cyprus), with one plain line why', cyV === null && !cyC.ok && /curve shared by the whole world/.test(cyC.why), cyC.why);
  const flippedU = [];
  for (const c of wt3.rows.filter(x => x.busy).map(x => x.file)) { const r0 = await get(c), rv = R.onScale(r0, 'viirs'); if (rv && r0.busiest_year && rv.busiest_year && r0.busiest_year.year !== rv.busiest_year.year) flippedU.push(c + ' ' + r0.busiest_year.year + '->' + rv.busiest_year.year); }
  check('VIIRS scale: the biggest year changes in 4 of 71 busy countries (South Sudan 2015->2024, Turkey 2011->2009, Ukraine 2014->2008, Zambia 2012->2008), as the research found', flippedU.join(', ') === 'South_Sudan 2015->2024, Turkey 2011->2009, Ukraine 2014->2008, Zambia 2012->2008', flippedU.join(', '));
  // the unit switch's copied sentences and table header name their scale; on MODIS's scale they are unchanged to the letter
  const shortM = R.shortSentence(arg, 'latest'), shortV = R.shortSentence(argV, 'latest'), s05M = R.shortSentence(arg, { month: '2005-08' }), s05V = R.shortSentence(argV, { month: '2005-08' });
  check('Report sentences on VIIRS\'s scale name it ("Counts are on VIIRS\'s scale"; before 2012 "an estimate of what a camera like VIIRS would have counted"); on MODIS\'s scale unchanged to the letter',
    shortM === 'Fire activity across Argentina was about normal in early November on the 26-year satellite record. NASA\'s older MODIS camera, counted on its own, saw about a third more than usual. Early data.' &&
    shortV === shortM.replace('NASA\'s older MODIS camera, counted on its own,', 'NASA\'s older MODIS camera, converted to VIIRS\'s scale,') + ' Counts are on VIIRS\'s scale.' && /converted to VIIRS's scale, saw about a third more/.test(shortV) && s05V === s05M + ' Counts are on VIIRS\'s scale: an estimate of what a camera like VIIRS would have counted, scaled up from MODIS.' &&
    !/VIIRS's scale/.test(shortM + s05M + R.sentence(arg, 'latest') + R.sentence(arg, { year: 2005 })) && / Counts are on VIIRS's scale: an estimate of what a camera like VIIRS would have counted, scaled up from MODIS\.$/.test(R.sentence(argV, { year: 2005 })) &&
    / Counts are on VIIRS's scale\.$/.test(R.sentence(argV, 'latest')) && R.sentence(argV, 'latest').replace(/ Counts are on VIIRS's scale\.$/, '') !== R.sentence(arg, 'latest'), shortV + ' || ' + s05V);
  check('The table export names its scale: on VIIRS\'s scale "value_on_viirs_scale" and "Aqua_on_viirs_scale"; on MODIS\'s scale the header is exactly TABLE_COLUMNS',
    R.csv(arg).split('\n')[0] === R.TABLE_COLUMNS.join(',') && R.tableColumns(arg) === R.TABLE_COLUMNS &&
    R.csv(argV).split('\n')[0] === 'ym,value_on_viirs_scale,status,days,carrier,translated,earlier_camera,handed_over,Terra,Aqua_on_viirs_scale,SNPP,NOAA20,tested_miss_pct,rule', R.csv(argV).split('\n')[0]);

  // ================= Nov 14 afternoon: the page's words after the second-family check (sol_check_afternoon/PAGE_WORDS_FIXED.md) =================
  const sAV = R.screen(argV, 'latest'), mpAV = R.monthPanel(argV, '2026-11');
  check('Words 1, VIIRS scale: MODIS\'s converted count is never called its own ("MODIS, converted to VIIRS\'s scale: 3,103"); the month panel says how the number is made on that scale; MODIS\'s scale unchanged',
    /MODIS, converted to VIIRS's scale: 3,103; its usual is 2,281\./.test(sAV.small) && !/MODIS alone|on its own/.test(sAV.small + (sAV.modis ? sAV.modis.text : '') + mpAV.counts + R.shortSentence(argV, 'latest') + R.sentence(argV, 'latest')) &&
    mpAV.how === 'VIIRS on NOAA-20, adjusted to S-NPP\'s scale.' && /MODIS alone: 757; its usual is 557\./.test(sA.small), sAV.small + ' | ' + mpAV.how);
  const bfS = R.screen(await get('Burkina_Faso'), { year: 2025 }), kwS = R.screen(await get('Kuwait'), { month: '2025-12' }), kwL = R.sentence(q.Kuwait, { month: '2025-12' });
  check('Words 2, reasons: too few other years is said as such (Burkina Faso 2025, MODIS 6,272), and a small usual as such (Kuwait December 2025: 20 and 18 against a usual 14), never "too little fire" / "too small to judge"',
    bfS.modis && /saw 6,272 detections, but there aren't enough other years with data to judge 2025\./.test(bfS.modis.text) && kwS.answer === 'December is usually too quiet here for a reliable comparison.' &&
    /December is usually too quiet here for a reliable comparison\./.test(kwL) && !/too small to judge|too little fire/.test(kwL), (bfS.modis && bfS.modis.text) + ' | ' + kwS.answer);
  const saF = R.screen(await get('Saudi_Arabia'), { month: '2005-08' }).felt, beF = R.screen(await get('Belize'), { month: '2005-02' }).felt;
  check('Words 3, ties: an equal year counts among the exceptions (Saudi Arabia August 2005 tied for the least; Belize February 2005 "all but 3")',
    saF === 'Satellites picked up the least fire across Saudi Arabia in August 2005 of any year in the record, tied with one other year.' && /than in all but 3 of the 24 other years\.$/.test(beF), saF + ' | ' + beF);
  const asP = R.monthPanel(await get('American_Samoa'), '2022-11');
  check('Words 4, a missing count of ours never hides MODIS\'s (American Samoa November 2022: "Our record has no count this month." / "The gap is in our record. MODIS counted 1 detection.")',
    asP.say === 'Our record has no count this month.' && asP.note === 'The gap is in our record. MODIS counted 1 detection.', asP.say + ' | ' + asP.note);
  const baL = R.sentence(await get('Barbados'), { month: '2025-11' });
  check('Words 5, a weak place with no MODIS count is never told to "Read MODIS\'s own count first" (Barbados November 2025)', !/Read MODIS/.test(baL) && /no fair test score\. MODIS has no count of its own for these dates\./.test(baL), baL.slice(0, 200));
  const worldSrc5 = fs.readFileSync(path.join(ROOT, 'js', 'record_world.js'), 'utf8'), zim = wt3.rows.find(x => x.file === 'Zimbabwe');
  check('Words 5, the world panel uses the answer screen\'s lead rule: MODIS leads only where our record is weak (Zimbabwe December 2025: twelve numbers, 14%, too little fire on ours, so no MODIS lead; "MODIS alone reads about normal")',
    /const weakHere = r\.rule === 'one' \|\| r\.rule === 'curve' \|\| r\.rule === 'none' \|\| \(r\.rule === 'twelve' && r\.typical_pct !== null && r\.typical_pct > 25\)/.test(worldSrc5) && /weakHere && per\.older && per\.older\.word \? 'modis'/.test(worldSrc5) &&
    zim.rule === 'twelve' && zim.typical_pct < 25 && !zim.period.word && zim.period.older.word === 'about usual' && R.screen(q.Zimbabwe || await get('Zimbabwe'), { month: '2025-12' }).f.lead === 'none', zim.rule + ' ' + zim.typical_pct.toFixed(1) + ' ' + zim.period.older.word);
  const baCap = R.screen(q.Barbados, { month: '2025-11' }).caption;
  check('Words 6, captions: "every year since" only when every year has data (Barbados: "November in the years with data since 2014."; Argentina unchanged)', baCap === 'November in the years with data since 2014. 2025 in gold.' && R.screen(arg, 'latest').caption === 'Early November, every year since 2000. This year in gold.', baCap);
  check('Words 7 to 12: the fixed text in "How we know" (scoped three-times example, 5 km patches are ours, the rule inventory adds to 235, MODIS compared wherever it has a count, no "exact", the prepared world table)',
    /In our Corrientes wetland example, VIIRS picked up about three times as much as MODIS over the same two weeks\./.test(recC) && /We group satellite fire detections into patches of ground about 5 km across/.test(recC) &&
    /Across all ' \+ w\.rows\.length \+ ' country files/.test(recC) && /we compare the two wherever MODIS has a count/.test(recC) && !/Every count, exact/.test(recC) && /the world view uses a table prepared from the same code/.test(recC) && !/check ourselves against it every month/.test(recC), '');

  // Nov 14, 4:42 PM (team lead: "let try hiding them"): the story's full screen, one constant; the bars come back on leaving and by a pointer resting on the top edge
  const appSrcB = fs.readFileSync(path.join(ROOT, 'js', 'app.js'), 'utf8'), cssB = fs.readFileSync(path.join(ROOT, 'css', 'night.css'), 'utf8');
  check('Story full screen: HIDE_BARS_IN_STORY = true in js/app.js; only the story room (not on phones) hides both bars and takes the whole height; the top-edge rest (900 ms) brings them back; leaving the story removes it',
    /const HIDE_BARS_IN_STORY = true;/.test(appSrcB) && /const on = HIDE_BARS_IN_STORY && room === 'story' && !\(narrow && narrow\.matches\)/.test(appSrcB) && /function showRoom\(room\) \{\n    storyFull\(room\);/.test(appSrcB) &&
    /e\.clientY <= 6\) \{ if \(!peekT\) peekT = setTimeout\(\(\) => \{ peekT = null; root\.classList\.add\('bars-peek'\); \}, 900\)/.test(appSrcB) &&
    /html\.story-full #bar, html\.story-full #units \{ display: none !important; \}/.test(cssB) && /html\.story-full #room-story \{ height: 100vh; \}/.test(cssB) && /html\.story-full\.bars-peek #bar \{ display: flex !important; \}/.test(cssB), '');

  // Nov 14 evening: slide 2's camera strip (story.js camStrip) sums each camera's own month rows from Readings.ownCounts; pin the four totals
  {
    const own = (k, y) => arg.monthly.filter(x => x.ym.startsWith(y + '-')).reduce((a, x) => a + (R.ownCounts(x, arg)[k] || 0), 0);
    const got = [own('Aqua', 2020), own('Aqua', 2022), own('SNPP', 2020), own('SNPP', 2022)];
    const stSrc = fs.readFileSync(path.join(ROOT, 'js', 'story.js'), 'utf8');
    check('Slide 2 camera strip: each camera on its own, Argentina: MODIS 2020 45,295 and 2022 27,056; VIIRS (S-NPP) 2020 137,271 and 2022 86,011 (summed from ownCounts, not typed)',
      got.join(',') === '45295,27056,137271,86011' && /function camStrip\(info\)/.test(stSrc) && /R\.ownCounts\(x, r\)\[k\]/.test(stSrc), got.join(', '));
  }

  // Nov 14, 9:40 PM: slide 3's worked rule (story.js, mathOn): August's sums over the shared years, the months the engine learns from
  {
    let a = 0, b = 0;
    for (let y = 2012; y <= 2021; y++) { const x = arg.monthly.find(r => r.ym === y + '-08');
      if (x && x.raw && x.raw.Aqua != null && x.raw.SNPP != null && !(x.short && x.short.SNPP) && !(x.local_test && x.local_test.handed_over)) { a += x.raw.Aqua; b += x.raw.SNPP; } }
    const f8 = arg.factors.SNPP.f[7];
    check('Slide 3 rule: Argentina, August, 2012-2021: MODIS 62,467 / VIIRS 169,528 = 0.37, and that ratio IS the engine\'s August conversion number',
      a === 62467 && b === 169528 && Math.abs(a / b - f8) < 1e-9 && f8.toFixed(2) === '0.37', a + ' / ' + b + ' = ' + (a / b).toFixed(6) + '; engine ' + f8.toFixed(6));
  }
  // ---- historyScale 'vee' (a pencil for the team lead; default 'moe'): the long record's numbers on Vee's scale, recomputed now ----
  {
    const v = await require(path.join(ROOT, 'tools', 'build_scale_vee.cjs')).compute(), saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'scale_vee.json'), 'utf8'));
    const a = v.argentina;
    check("Vee's scale, slide 2: Argentina 2022 = 89,043 against a typical year of 77,217 (15.3% over; on Moe's scale 26,952 against 24,451, 10.2% over)",
      rnd(a.vee.y2022) === 89043 && rnd(a.vee.typical) === 77217 && a.vee.vs_typical_pct.toFixed(1) === '15.3' && rnd(a.moe.y2022) === 26952 && a.moe.vs_typical_pct.toFixed(1) === '10.2',
      rnd(a.vee.y2022) + ' / ' + rnd(a.vee.typical) + ' (' + a.vee.vs_typical_pct.toFixed(2) + '%); moe ' + rnd(a.moe.y2022) + ' / ' + rnd(a.moe.typical) + ' (' + a.moe.vs_typical_pct.toFixed(2) + '%)');
    check("Vee's scale, slide 6: biggest year after 2021 in 9 of 65 (8 on Moe's scale; the one that changes: South Sudan, 2015 -> 2024)",
      v.records.testable === 65 && v.records.one_scale_after_2021 === 8 && v.records.vee_scale_after_2021 === 9 && v.records.changed.map(c => c.name + c.moe_best + c.vee_best).join() === 'South Sudan20152024',
      `${v.records.vee_scale_after_2021} of ${v.records.testable} (moe ${v.records.one_scale_after_2021}); changed ${JSON.stringify(v.records.changed)}`);
    check("Vee's scale, the world chart: all 66 countries switch; last five years against the first five -13.6% (Moe's scale -13.6%)",
      v.world.countries === 66 && v.world.change_pct.toFixed(1) === '-13.6', v.world.countries + ' countries, ' + v.world.change_pct.toFixed(2) + '%');
    // two tones per bar (8:21 AM): what Moe counted + what the translation adds = the bar on Vee's scale, every year before 2022, on every chart
    const parts = [];
    v.argentina.two_tone.forEach(y => { if (y.year < 2022) parts.push(['Argentina ' + y.year, y.moe, y.added, y.vee]); });
    v.small_multiples.forEach(sm => sm.added.forEach((a, k) => { if (a != null) parts.push([sm.name + ' #' + k, sm.moe[k], a, sm.vee[k]]); }));
    v.world.added.forEach((a, k) => { if (a != null) parts.push(['world ' + v.world.years[k], v.world.moe[k], a, v.world.totals[k]]); });
    const bad = parts.filter(([, m, a, b]) => !(m > 0 && a > 0 && Math.abs(m + a - b) < 1e-6));
    check('Two tones: on every Vee-scale chart, Moe\'s part + the added part = the bar, and both parts are positive, for every year before 2022',
      parts.length > 100 && !bad.length, parts.length + ' bars; ' + (bad.length ? 'bad: ' + bad.slice(0, 3).map(b => b[0]).join(', ') : 'all add up'));
    check("Vee's scale, slide 2: Argentina's biggest year is 2020 (144,130 on Vee's scale), as on Moe's scale",
      a.vee.biggest_year === 2020 && a.moe.biggest_year === 2020 && rnd(a.vee.years.find(y => y.year === 2020).v) === 144130, a.vee.biggest_year + ' / ' + rnd(a.vee.years.find(y => y.year === 2020).v));
    check('Vee\'s scale: data/scale_vee.json agrees with the recomputation', saved.records.vee_scale_after_2021 === v.records.vee_scale_after_2021 && rnd(saved.argentina.vee.y2022) === rnd(a.vee.y2022) && saved.world.change_pct.toFixed(3) === v.world.change_pct.toFixed(3),
      saved.records.vee_scale_after_2021 + ' / ' + rnd(saved.argentina.vee.y2022) + ' / ' + saved.world.change_pct.toFixed(3));
  }
  // ---- Slide 3's "smarter version" press (10:43 PM): the seven chances from the engine's curve, and the badge's count recomputed now ----
  {
    const curve = JSON.parse(fs.readFileSync(path.join(BASE, 'data', 'world_by_country', 'shared', 'curve.json'), 'utf8'));
    const per100 = curve.chance.map(c => Math.round(c * 100));
    check('Slide 3 smarter version: the seven chances read from the engine curve are about 4, 6, 10, 17, 28, 40, 57 in 100; bands at 2, 4, 8, 16, 32, 64 MW',
      per100.join(',') === '4,6,10,17,28,40,57' && curve.band_edges_mw.join(',') === '2,4,8,16,32,64', per100.join(',') + ' | ' + curve.band_edges_mw.join(','));
    const now = await require(path.join(ROOT, 'tools', 'build_fire_power.cjs')).compute(), saved = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'fire_power.json'), 'utf8'));
    check('Slide 3 smarter version: closer in 51 of the 71 busy countries (19 tie, 1 worse: Ethiopia), recomputed from the engine both ways; data/fire_power.json agrees',
      now.closer === 51 && now.countries === 71 && now.tie === 19 && now.worse === 1 && now.worseNames.join() === 'Ethiopia' && saved.closer === now.closer && saved.countries === now.countries,
      `now ${now.closer}/${now.countries} (tie ${now.tie}, worse ${now.worse}: ${now.worseNames.join(', ')}); saved ${saved.closer}/${saved.countries}`);
    check('Slide 3 smarter version: middle country 12.35% -> 10.14% on 8,207 country-months (as CHECK_STRENGTH.md)', now.middle.plain === 12.35 && now.middle.strength === 10.14 && now.months === 8207,
      now.middle.plain + ' -> ' + now.middle.strength + ', ' + now.months);
  }

  const nPass = results.filter(x => x.ok).length, nFail = results.length - nPass;
  console.log('\n' + nPass + ' PASS, ' + nFail + ' FAIL' + (nFail ? ': ' + results.filter(x => !x.ok).map(x => x.name).join(' | ') : ''));
  process.exitCode = nFail ? 1 : 0;
})().catch(e => { console.error('CRASH', e); process.exitCode = 2; });
