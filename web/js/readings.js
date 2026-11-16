/* Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md. */
// readings.js: the ONE home for the two readings, the gates, the words and "your sentence" (DESIGN.md sections 5 to 7, amendments A1 to A3,
// A8, A11, A13, and the coordinator's additions of Nov 14: the exact record-word gate and the per-place latest period).
// Every number here is read from an engine result (HSEngine.query) or an adapter (HSAdapters);
// the only arithmetic of the page's own is in this file: the older camera's (Aqua's) own typical and word, the gates, yearly sums by camera.
// Works in a browser (window.Readings; needs window.HSAdapters loaded first) and in Node (require; loads the adapters itself).
// null is "no data", never zero. A positive value under 0.5 prints "under 1".
(function (root) {
  'use strict';
  const A = (typeof module !== 'undefined' && module.exports) ? require('../parts/engine_and_data/adapters.js') : root.HSAdapters;
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const TOO_FEW = 16, MIN_YEARS = 5, OLDER_FROM = '2022-01';
  const NUMBER_WORDS = ['zero', 'one', 'two', 'three', 'four', 'five', 'six', 'seven', 'eight', 'nine', 'ten', 'eleven', 'twelve', 'thirteen', 'fourteen',
    'fifteen', 'sixteen', 'seventeen', 'eighteen', 'nineteen', 'twenty', 'twenty-one', 'twenty-two', 'twenty-three', 'twenty-four', 'twenty-five',
    'twenty-six', 'twenty-seven', 'twenty-eight', 'twenty-nine', 'thirty', 'thirty-one'];
  // display names for NASA's file names (underscores become spaces; a few need a hand)
  const NAMES = { Cote_d_Ivoire: "Côte d'Ivoire", Dem_Rep_Korea: 'North Korea (Dem. Rep. Korea)', Republic_of_Korea: 'South Korea (Rep. of Korea)',
    Macedonia_Former_Yugoslav_Republic_of: 'North Macedonia', Heard_I_and_McDonald_Islands: 'Heard and McDonald Islands', Lao_PDR: 'Lao PDR',
    Faeroe_Islands: 'Faroe Islands', Swaziland: 'Eswatini (Swaziland)', Brunei_Darussalam: 'Brunei', Federated_States_of_Micronesia: 'Micronesia',
    Saint_Barthelemy: 'Saint Barthélemy', 'Saint-Barthelemy': 'Saint Barthélemy', 'Saint-Martin': 'Saint Martin', Reunion: 'Réunion', Curacao: 'Curaçao',
    Sao_Tome_and_Principe: 'São Tomé and Príncipe', Aland_Islands: 'Åland Islands', The_Gambia: 'The Gambia' };
  function displayName(file) { if (!file) return 'This place'; return NAMES[file] || String(file).replace(/_/g, ' '); }

  // ---------- small helpers (formatting only) ----------
  function fmt(v) { if (v === null || v === undefined || !isFinite(v)) return 'no data'; const r = Math.round(v); return v > 0 && r === 0 ? 'under 1' : r.toLocaleString('en-US'); }
  function unit(v) { const s = fmt(v); return s + (s === '1' || s === 'under 1' ? ' detection' : ' detections'); }
  // "about 550 detections", but "under 1 detection" (never "about under 1")
  function aboutUnit(v) { const s = fmt(v); return s === 'under 1' || s === 'no data' ? unit(v) : 'about ' + unit(v); }
  function pct(x) { return x === null || x === undefined || !isFinite(x) ? null : Math.round(x); }
  const median = (a) => A.median(a);
  const yOf = (ym) => +ym.slice(0, 4), moOf = (ym) => +ym.slice(5, 7);
  const ymOf = (y, mo) => y + '-' + (mo < 10 ? '0' : '') + mo;
  function row(r, ym) { return r.monthly.find(x => x.ym === ym) || null; }
  function inBase(r, y) { return !r.baseline || (y >= r.baseline[0] && y <= r.baseline[1]); }
  function placeOf(r) { return displayName(r && r.area && r.area.country); }
  // the name inside a sentence: no bracketed alias, and "the" where English wants it ("across the United States", "for the Philippines")
  const THE = /^(United |Bahamas$|Comoros$|Netherlands$|Philippines$|Isle of Man$|Russian Federation$|Maldives$|French Southern|Democratic Republic|Republic of|Central African Republic$|Czech Republic$|Dominican Republic$)|Islands$/;
  function inSentence(name) { const n = String(name || '').replace(/\s*\([^)]*\)\s*$/, '').replace(/^The /, 'the '); return /^the /.test(n) ? n : THE.test(n) ? 'the ' + n : n; }
  // THE ONE hand-kept rule (the engine has no provisional flag): Argentina's 2026 file is NASA's standard processing to about July 2026
  // and near-real-time after, so its months from August 2026 on are provisional; January to July 2026 are not.
  const PROVISIONAL_FROM = '2026-08', PROVISIONAL_LABEL = 'provisional: near-real-time data';
  function isProvisional(r, ym) { return !!r.uses_2026_extension && ym >= PROVISIONAL_FROM; }
  function numberWord(n) { return NUMBER_WORDS[n] || String(n); }

  // the five-class word with the demo's own gate 1 (either count or the typical under 16, or fewer than 5 other years: no word)
  // gate (unit switch only, Nov 14): on VIIRS's scale the "too little fire" floor of 16 is read on MODIS's scale, where it was set, so a month's
  // verdict is the same on both scales; gate = { value, pool } of the same period on MODIS's scale. Without a gate: exactly the old rule.
  function gatedWord(value, pool, gate) {
    if (value === null || value === undefined) return { word: null, tooFew: false, noData: true };
    const typical = median(pool), gv = gate ? gate.value : value, gt = gate ? median(gate.pool) : typical;
    if (typical === null || pool.length < MIN_YEARS || gt === null || gt < TOO_FEW || gv === null || gv < TOO_FEW) return { word: null, tooFew: true, noData: false, fewYears: gv !== null && gv >= TOO_FEW && (gt === null || gt >= TOO_FEW) && pool.length < MIN_YEARS,
      why: gv === null || gv < TOO_FEW ? 'small' : typical === null || pool.length < MIN_YEARS ? 'years' : 'usual' };   // why: the true reason, said in words
    if (gate) { const p = A.percentile(value, pool); return { word: p < 0.10 ? 'much quieter' : p < 0.30 ? 'quieter' : p <= 0.70 ? 'about usual' : p <= 0.90 ? 'busier' : 'much busier', tooFew: false, noData: false }; }
    const w = A.verdict(value, pool);
    return w === 'too few to call' ? { word: null, tooFew: true, noData: false, why: 'small' } : { word: w, tooFew: false, noData: false };
  }
  // the reason a record gives no verdict, in plain words (finding 2 of the afternoon word check): never "too little fire" when the count is not small
  function heldBack(rec, who, when) {   // rec: f.ours or f.older; who: 'Our count' | "MODIS's count"; when: 'December' | '2025' | 'these dates'
    if (!rec || !rec.tooFew) return null;
    if (rec.why === 'years') return 'There aren\'t enough other years with data to compare ' + when + ' with.';
    if (rec.why === 'usual') return when.charAt(0).toUpperCase() + when.slice(1) + (/^(these|the)/.test(when) ? ' are' : ' is') + ' usually too quiet here for a reliable comparison.';
    return who + ' is too small to judge.';
  }

  // ---------- per-camera availability, read from the country file itself ----------
  // The engine's raw arrays start at zero, so a camera with NO row for a month would read 0. Here a row exists or it does not;
  // a row with a count of 0 is a real zero. Load once per place with Readings.loadAvailability(layer, result) (browser and Node).
  const SAT = { Terra: 0, Aqua: 1, SNPP: 2, NOAA20: 3 };
  const mIndex = (ym) => (yOf(ym) - 2000) * 12 + moOf(ym) - 1;
  async function loadAvailability(L, r) {
    if (!r || !r.area || !r.area.country) return null;
    if (r.availability) return r.availability;
    const mk = () => [new Set(), new Set(), new Set(), new Set(), new Set()];
    const av = { month: mk(), same: mk() }, file = r.area.country;
    const c = await L.json(L.paths.layer + 'countries/' + file + '.json');
    for (const rw of c.rows) if (rw[0] < 312 && rw[1] >= 0 && rw[1] < 5) av.month[rw[1]].add(rw[0]);   // the engine reads the same rows (2026 comes from the extension)
    if (r.uses_2026_extension) {
      const x = await L.json(L.paths.ext + 'country_' + file + '.json');
      for (const rw of x.rows) av.month[rw[1]].add(rw[0]);
      for (const rw of x.same_rows) av.same[rw[1]].add(rw[0]);
    }
    r.availability = av; return av;
  }
  const hasAvailability = (r) => !!(r && r.availability);
  function hasRow(r, cam, ym) { return !r.availability || r.availability.month[SAT[cam]].has(mIndex(ym)); }
  function hasSame(r, cam, year, mo) { return !r.availability || r.availability.same[SAT[cam]].has((year - 2000) * 12 + mo - 1); }
  function aquaOf(r, x) { return x && hasRow(r, 'Aqua', x.ym) && x.raw && x.raw.Aqua !== null && x.raw.Aqua !== undefined ? x.raw.Aqua : null; }

  // ---------- the place's held-back score (gate 3) ----------
  function score(r) {
    const hy = r && r.hide_a_year && r.hide_a_year.SNPP, mode = hy ? hy.mode : null;   // 'month_of_year' twelve numbers | 'single' one number | 'none' shared curve
    const place = placeOf(r);
    const rawPct = hy && hy.typical_pct !== null && hy.typical_pct !== undefined ? hy.typical_pct : null;
    // the shared-curve places' percent is NOT a held-back score (the curve saw those years): never shown, never used for a record word
    const typicalPct = mode === 'none' ? null : rawPct;
    const oneInTenPct = mode !== 'none' && hy && hy.nine_in_ten_pct !== null && hy.nine_in_ten_pct !== undefined ? hy.nine_in_ten_pct : null;
    const months = hy ? hy.months : 0;
    let rule;
    if (mode === 'month_of_year') rule = typicalPct === null ? 'none' : 'twelve';
    else if (mode === 'single') rule = 'one';
    else rule = rawPct === null ? 'none' : 'curve';
    let line;
    if (rule === 'twelve') line = 'In whole past months in ' + place + ', our joined record typically landed within about ' + pct(typicalPct) + '% of the older camera\'s own count.';
    else if (rule === 'one') line = place + ' is translated with one number for the whole year, the rule behind our worst misses; treat the count with care.' +
      (typicalPct !== null ? ' One-number rule: in whole past months it typically missed the older camera\'s own count by about ' + pct(typicalPct) + '%.' : ' No fair test score exists here.');
    else if (rule === 'curve') line = 'No fair test score here: ' + place + ' is translated with a shared worldwide curve, not numbers of its own.';
    else line = 'No fair test score exists for ' + place + ': too few months could be tested.';
    return { rule, typicalPct, oneInTenPct, months, line, scored: rawPct !== null };
  }
  // A3: a place whose (newer-camera) translation is known to be weak
  function weakLine(r) {
    const s = score(r);
    if (s.rule === 'one') return 'This country is translated with one number for the whole year. ' + (s.typicalPct === null ? 'Its miss in past tests was not measured.' :
      s.typicalPct > 25 ? 'In past tests that did poorly here (typical miss ' + pct(s.typicalPct) + '%).' : 'In past tests its typical miss here was ' + pct(s.typicalPct) + '%.') + ' Read MODIS\'s own count first.';
    if (s.rule === 'curve' || s.rule === 'none') return 'This country is translated with a shared worldwide curve and has no fair test score. Read MODIS\'s own count first.';
    // Nov 14, 2026 (build day, ruled by the team lead): twelve numbers but a held-back typical miss over 25% is weak too, so MODIS leads there
    if (highMiss(s)) return 'In past tests our record typically missed MODIS\'s own count here by about ' + pct(s.typicalPct) + '%. Read MODIS\'s own count first.';
    return null;
  }
  function highMiss(s) { return s.rule === 'twelve' && s.typicalPct !== null && s.typicalPct > 25; }
  // A3 as amended (coordinator, fix round): the gate follows the camera that CARRIED the month and that camera's own rule here
  function modeFor(r, carrier, method) {
    if (method === 'curve_only') return 'none';
    const f = r.factors || {};
    if (carrier === 'Terra') return f.Terra ? f.Terra.mode : null;
    if (carrier === 'SNPP' || carrier === 'NOAA20') return f.SNPP ? f.SNPP.mode : null;
    return 'own';   // the older camera's own count: nothing translated
  }
  function weakLineFor(r, x) {
    if (!x || !x.translated || x.value === null) return null;
    const mode = modeFor(r, x.carrier, x.method);
    if (mode === 'own') return null;
    if (mode === 'month_of_year') return x.carrier === 'Terra' ? null : weakLine(r);   // null unless the place's own held-back miss is over 25% (Nov 14)
    if (x.carrier === 'Terra') {
      const hy = r.hide_a_year && r.hide_a_year.Terra, p = mode === 'single' && hy && hy.typical_pct !== null && hy.typical_pct !== undefined ? pct(hy.typical_pct) : null;
      return 'This month comes from the earlier camera (Terra), translated here with ' + (mode === 'single' ? 'one number for the whole year' : 'no numbers of its own') +
        (p !== null ? ' (in past tests, a typical miss of ' + p + '%)' : '') + ', so we give it no word.';
    }
    return weakLine(r) || 'This month is translated without numbers of its own here, so we give it no word. Read MODIS\'s own count first.';
  }

  // finding 5: in a dated answer, "Read MODIS's own count first" only when MODIS has a count for those dates; otherwise say it has none
  function datedWeak(w, older, olderMissing) {
    if (!w || older) return w;
    return w.replace(/ Read MODIS's own count first\.$/, olderMissing ? ' MODIS has no count of its own for these dates.' : '');
  }
  // ---------- the period a selection means ----------
  // 'latest' = the unfinished month if there is one, else this place's newest finished month (latest.ym; never assumed to be December 2025)
  function resolve(r, sel) {
    if (!sel || sel === 'latest') { const ym = r.current ? r.current.ym : r.latest ? r.latest.ym : null; return ym ? { month: ym } : null; }
    return sel;
  }

  // the older camera's (Aqua's) own count and its pool, for a month from 2022 (gate 4)
  // returns null before 2022, { missing: true } when the older camera has no row for these dates, else { value, pool }.
  // Its pool is every other year in which the older camera has a row for the same period (the same days for an unfinished month),
  // whatever the joined record did that year.
  function olderMonth(r, ym) {
    if (ym < OLDER_FROM) return null;
    const rw = row(r, ym); if (!rw) return null;
    const mo = moOf(ym), y = yOf(ym);
    if (rw.status === 'partial' && r.current) {
      const value = hasRow(r, 'Aqua', ym) && r.current.raw && r.current.raw.Aqua !== null && r.current.raw.Aqua !== undefined ? r.current.raw.Aqua : null;
      if (value === null) return { missing: true };
      const pool = r.current.same_days.filter(s => s.year !== y && hasSame(r, 'Aqua', s.year, mo) && s.raw && s.raw.Aqua !== null && s.raw.Aqua !== undefined && inBase(r, s.year)).map(s => s.raw.Aqua);
      return { value, pool };
    }
    const value = aquaOf(r, rw);
    if (value === null) return { missing: true };
    const pool = r.monthly.filter(x => moOf(x.ym) === mo && x.ym !== ym && x.status !== 'partial' && inBase(r, yOf(x.ym))).map(x => aquaOf(r, x)).filter(v => v !== null);
    return { value, pool };
  }
  // the older camera's own total for a whole year: all twelve months must have its own row (else null: incomplete, no dot, no gap)
  function olderYearTotal(r, y) {
    let t = 0;
    for (let mo = 1; mo <= 12; mo++) { const rw = row(r, ymOf(y, mo)); if (!rw || rw.status === 'partial') return null; const v = aquaOf(r, rw); if (v === null) return null; t += v; }
    return t;
  }
  function olderYear(r, y) {
    if (y < 2022) return null;
    const cur = r.current && yOf(r.current.ym) === y ? r.current : null;
    if (cur) {   // the year so far, date for date: finished months of this year plus the same days of the unfinished month
      const k0 = moOf(cur.ym) - 1, mo0 = moOf(cur.ym);
      const sumYear = (yy, partialAqua) => { if (partialAqua === null || partialAqua === undefined) return null; let t = partialAqua;
        for (let mo = 1; mo <= k0; mo++) { const v = aquaOf(r, row(r, ymOf(yy, mo))); if (v === null) return null; t += v; } return t; };
      const value = hasRow(r, 'Aqua', cur.ym) ? sumYear(y, cur.raw ? cur.raw.Aqua : null) : null;
      if (value === null) return { missing: true };
      const pool = cur.same_days.filter(s => s.year !== y && inBase(r, s.year) && hasSame(r, 'Aqua', s.year, mo0)).map(s => sumYear(s.year, s.raw ? s.raw.Aqua : null)).filter(v => v !== null);
      return { value, pool };
    }
    const value = olderYearTotal(r, y); if (value === null) return { missing: true };
    const pool = r.year_totals.filter(t => t.year !== y && inBase(r, t.year)).map(t => olderYearTotal(r, t.year)).filter(v => v !== null);
    return { value, pool };
  }

  // ---------- the fire season (the engine's `season` months), summed per year: the page's own arithmetic, kept here ----------
  // A season is named by the year it starts in; one that wraps the new year (Ghana: December to January) ends in the next year.
  function seasonMonthsOf(r) {
    if (!r || !r.season) return [];
    const out = []; let k = r.season.about_start;
    for (let i = 0; i < 12; i++) { out.push(k); if (k === r.season.about_end) break; k = k % 12 + 1; }
    return out;
  }
  function seasonYms(r, y) { const ms = seasonMonthsOf(r); let yy = y; return ms.map((mo, i) => { if (i > 0 && mo < ms[i - 1]) yy = y + 1; return ymOf(yy, mo); }); }
  function seasonSum(r, y, pick) {
    const yms = seasonYms(r, y); if (!yms.length) return null; let t = 0;
    for (const ym of yms) { const x = row(r, ym); if (!x || x.status !== 'final') return null; const v = pick(x); if (v === null || v === undefined) return null; t += v; }
    return t;
  }
  // MODIS's own season total: every month must have MODIS's own row (a joined month with no data can still have a MODIS count)
  function olderSeasonSum(r, y) {
    const yms = seasonYms(r, y); if (!yms.length) return null; let t = 0;
    for (const ym of yms) { const x = row(r, ym); if (!x || x.status === 'partial') return null; const v = aquaOf(r, x); if (v === null) return null; t += v; }
    return t;
  }
  // the most recent season whose months are all finished in this place's record (null when none)
  function lastSeason(r) {
    if (!r || !r.season || !Array.isArray(r.monthly)) return null;
    for (let y = yOf(r.record_ends); y >= yOf(r.record_starts); y--) { const yms = seasonYms(r, y);
      if (yms.every(ym => { const x = row(r, ym); return x && x.status === 'final'; }) && seasonSum(r, y, x => x.value) !== null) return y; }
    return null;
  }
  function seasonAnswer(r, y) {
    const yms = seasonYms(r, y), first = yms[0], last = yms[yms.length - 1];
    const others = [];
    for (let yy = yOf(r.record_starts); yy <= yOf(r.record_ends); yy++) if (yy !== y) { const s = seasonYms(r, yy); if (s[0] < r.record_starts || s[s.length - 1] > r.record_ends) continue; others.push({ year: yy, value: seasonSum(r, yy, x => x.value) }); }
    const pool = others.filter(o => o.value !== null && inBase(r, o.year)).map(o => o.value);
    const span = MONTHS[moOf(first) - 1] + ' to ' + MONTHS[moOf(last) - 1];
    return { periodLabel: span + (yOf(first) === yOf(last) ? ' ' + yOf(first) : ' ' + yOf(first) + '–' + String(yOf(last)).slice(2)), value: seasonSum(r, y, x => x.value), typical: median(pool), others, comparison: null, daysNote: null, span, yms };
  }
  function olderSeason(r, y) {
    const yms = seasonYms(r, y); if (!yms.length || yms[0] < OLDER_FROM) return null;
    const value = olderSeasonSum(r, y); if (value === null) return { missing: true };
    const pool = [];
    for (let yy = yOf(r.record_starts); yy <= yOf(r.record_ends); yy++) if (yy !== y && inBase(r, yy)) { const v = olderSeasonSum(r, yy); if (v !== null) pool.push(v); }
    return { value, pool };
  }

  // ---------- Readings.forPeriod ----------
  // sel: 'latest' | {month:'YYYY-MM'} | {year:YYYY} | {season:YYYY} (the season that starts in that year)
  function forPeriod(r, sel) {
    const place = placeOf(r);
    const empty = (code, message) => ({ place, periodLabel: null, partial: false, provisional: false, ours: null, older: null, sameWord: false, tooFew: false, lead: 'none', kind: null, refusal: { code, message } });
    if (!r || !Array.isArray(r.monthly)) return empty('BAD_REQUEST', 'no engine result to read');
    if (sel && sel.season !== undefined) return forSeason(r, sel.season, empty);
    const p = resolve(r, sel);
    if (!p) return empty('NO_USABLE_MONTHS', place + ' has no month with usable data in this record, so there is nothing to show');
    const a = A.answer(r, p);
    if (A.isRefusal(a)) return empty(a.refused, a.message);
    const isMonth = p.month !== undefined, ym = isMonth ? p.month : null, y = isMonth ? yOf(ym) : p.year;
    const rw = isMonth ? row(r, ym) : null;
    const partial = isMonth ? (rw && rw.status === 'partial') : !!(r.current && yOf(r.current.ym) === y);
    const provisional = isMonth ? isProvisional(r, ym) : (!!r.uses_2026_extension && ymOf(y, 12) >= PROVISIONAL_FROM);
    const pool = a.others.filter(o => o.value !== null && inBase(r, o.year)).map(o => o.value);
    const gate = r.unit ? gateOf(r, p) : null;
    const g = gatedWord(a.value, pool, gate);
    const ours = { value: a.value, typical: a.typical, years: pool.length, word: g.word, comparison: a.comparison, tooFew: g.tooFew, fewYears: !!g.fewYears, noData: g.noData, weak: null, translated: false, carrier: null };
    if (g.why) ours.why = g.why;
    if (r.unit) { ours._gate = gate; if (isMonth && rw && rw.no_scale) { ours.noScale = true; ours.noData = true; ours.tooFew = false; ours.word = null; }
      if (!isMonth) { const ns = r.monthly.filter(x => x.no_scale && yOf(x.ym) === y).map(x => MONTHS[moOf(x.ym) - 1]); if (ns.length) { ours.noScaleMonths = ns; ours.noScale = true; ours.word = null; ours.tooFew = false; ours.noData = true; } } }
    // A3 (as amended): a translated month gets no word from our record when the translation used for THAT month's camera is weak here
    if (isMonth && rw) {
      ours.translated = !!rw.translated; ours.carrier = rw.carrier;
      const wl = ours.value !== null ? weakLineFor(r, rw) : null;
      if (wl) { ours.word = null; ours.weak = wl; }
    } else if (!isMonth && ours.value !== null) {
      const weakMonth = r.monthly.find(x => yOf(x.ym) === y && weakLineFor(r, x));
      if (weakMonth) { ours.word = null; ours.weak = weakLineFor(r, weakMonth); }
    }
    ours.weakLine = ours.weak;   // the same line under the name builder B's test page uses
    // gate 4: the older camera's own reading, only from January 2022; a missing row is "no count", never 0
    let older = null, olderMissing = false;
    const o = isMonth ? olderMonth(r, ym) : olderYear(r, y);
    const ob = r.unit && o && !o.missing ? (isMonth ? olderMonth(r.unit.base, ym) : olderYear(r.unit.base, y)) : null;
    if (o && o.missing) olderMissing = true;
    else if (o) { const og = gatedWord(o.value, o.pool, ob && !ob.missing ? ob : null); older = { value: o.value, typical: median(o.pool), years: o.pool.length, word: og.word, tooFew: og.tooFew };
      if (og.why) older.why = og.why;
      if (r.unit) older._gate = ob && !ob.missing ? ob : null; }
    if (ours.noScale) { older = null; olderMissing = false; }
    ours.weak = datedWeak(ours.weak, older, olderMissing); ours.weakLine = ours.weak;   // finding 5: no "Read MODIS first" when MODIS has no count here   // unit switch: a month with a conversion number of 0 has no count on VIIRS's scale for either record
    const sameWord = !!(older && ours.word && older.word && ours.word === older.word);
    const tooFew = ours.tooFew && (!older || older.tooFew);
    // A1: the headline made from the two words (from 2022 on, never a single summary word); before 2022, the one word
    let headline = null, underCards = null;
    if (olderMissing) { headline = 'One record for these dates.'; underCards = null; }   // the blue card itself says the older camera has no count
    else if (older) {
      if (sameWord) headline = 'Both records read: ' + ours.word + '.';
      else if (ours.word && older.word) { headline = 'Two records. Two readings.'; underCards = 'The two records disagree for these dates, so we give no single word. Neither camera is the ground.'; }
      else if (ours.tooFew && older.tooFew) { headline = 'Too few to call.'; underCards = 'Both counts are too small for a word. Neither camera is the ground.'; }
      else { headline = 'Two records, counted side by side.'; underCards = 'No single word for these dates. Neither camera is the ground.'; }
    } else if (ours.word) headline = ours.word.charAt(0).toUpperCase() + ours.word.slice(1) + '.';
    else if (ours.noScale) headline = 'No count on this scale.';
    else if (ours.noData) headline = 'No data for these dates.';
    else if (ours.tooFew) headline = 'Too few to call.';
    else headline = 'Counted, with no word.';
    // labels
    let periodLabel = a.periodLabel, upper;
    if (isMonth && partial) { const last = r.current.days; periodLabel = MONTHS[moOf(ym) - 1] + ' 1–' + last + ', ' + y; }
    upper = (place + ' · ' + periodLabel).toUpperCase() + (provisional ? ' · ' + PROVISIONAL_LABEL.toUpperCase() : '') + (isMonth && partial ? (provisional ? ', ' : ' · ') + 'DAYS 1–' + r.current.days + ' ONLY' : '');
    const daysNote = isMonth && partial ? 'Days 1 to ' + r.current.days + ' only, compared with the same ' + numberWord(r.current.days) + ' days of every other year.' : (a.daysNote || null);
    const kind = isMonth ? 'month' : partial ? 'yearSoFar' : 'year';
    return finish(r, { ...(r.unit ? { scale: 'viirs' } : {}), place, periodLabel, upperLabel: upper, ym, year: y, isMonth, kind, partial: !!partial, provisional, ours, older, olderMissing, sameWord, tooFew, headline, underCards, daysNote,
      unfinishedNote: null, availability: hasAvailability(r), days: partial && r.current ? r.current.days : null,
      trust: trustLine(r, !!partial), recordEnds: r.latest ? r.latest.ym : null, refusal: null }, pool, o && !o.missing ? o.pool : null);
  }
  // the season as a period: same shape as forPeriod's other answers
  function forSeason(r, sy, empty) {
    const place = placeOf(r), yms = seasonYms(r, sy);
    if (!yms.length) return empty('NO_SEASON', place + ' has no fire season in this record');
    if (yms[0] < r.record_starts || yms[yms.length - 1] > r.record_ends) return empty('OUT_OF_COVERAGE', 'that season is outside this record');
    const a = seasonAnswer(r, sy);
    const pool = a.others.filter(o => o.value !== null && inBase(r, o.year)).map(o => o.value);
    let gate = null;
    if (r.unit) { const b = r.unit.base, ab = seasonAnswer(b, sy); gate = { value: ab.value, typical: ab.typical, pool: ab.others.filter(o => o.value !== null && inBase(b, o.year)).map(o => o.value) }; }
    const g = gatedWord(a.value, pool, gate);
    const ours = { value: a.value, typical: a.typical, years: pool.length, word: g.word, comparison: null, tooFew: g.tooFew, fewYears: !!g.fewYears, noData: g.noData, weak: null, translated: false, carrier: null };
    if (g.why) ours.why = g.why;
    if (ours.value !== null) { const wm = yms.map(ym => row(r, ym)).find(x => x && weakLineFor(r, x)); if (wm) { ours.word = null; ours.weak = weakLineFor(r, wm); } }
    ours.weakLine = ours.weak;
    if (r.unit) ours._gate = gate;
    let older = null, olderMissing = false; const o = olderSeason(r, sy);
    const ob = r.unit && o && !o.missing ? olderSeason(r.unit.base, sy) : null;
    if (o && o.missing) olderMissing = true;
    else if (o) { const og = gatedWord(o.value, o.pool, ob && !ob.missing ? ob : null); older = { value: o.value, typical: median(o.pool), years: o.pool.length, word: og.word, tooFew: og.tooFew };
      if (og.why) older.why = og.why;
      if (r.unit) older._gate = ob && !ob.missing ? ob : null; }
    ours.weak = datedWeak(ours.weak, older, olderMissing); ours.weakLine = ours.weak;
    const sameWord = !!(older && ours.word && older.word && ours.word === older.word);
    const provisional = yms.some(ym => isProvisional(r, ym));
    return finish(r, { ...(r.unit ? { scale: 'viirs' } : {}), place, periodLabel: a.periodLabel, upperLabel: (place + ' · ' + a.periodLabel).toUpperCase(), ym: null, year: sy, isMonth: false, kind: 'season', season: { start: yms[0], end: yms[yms.length - 1], span: a.span, yms },
      partial: false, provisional, ours, older, olderMissing, sameWord, tooFew: ours.tooFew && (!older || older.tooFew), headline: null, underCards: null, daysNote: null, unfinishedNote: null,
      availability: hasAvailability(r), days: null, trust: trustLine(r, false), recordEnds: r.latest ? r.latest.ym : null, refusal: null }, pool, o && !o.missing ? o.pool : null);
  }
  // what every answer carries for the new screens: which record leads, and each record's rank among the other years (0 to 1)
  // lead: 'ours' when our record gives a verdict; 'modis' when ours is weak here (or has none) and MODIS's own count gives one; else 'none'.
  function finish(r, f, pool, olderPool) {
    f.ours.rankFraction = f.ours.value === null || !pool || !pool.length ? null : A.percentile(f.ours.value, pool);
    if (f.older) f.older.rankFraction = olderPool && olderPool.length ? A.percentile(f.older.value, olderPool) : null;
    f.ours.feel = feel(f.ours.value, f.ours.typical, f.ours._gate);
    if (f.older) f.older.feel = feel(f.older.value, f.older.typical, f.older._gate);
    // how many of the other years had less / more (the verdict's own rank, said plainly when the ratio would read as a contradiction)
    const rk = (v, p) => v === null || v === undefined || !p ? null : { less: p.filter(x => x < v).length, more: p.filter(x => x > v).length, of: p.length, same: p.filter(x => x === v).length };
    f.ours.rank = rk(f.ours.value, pool); if (f.older) f.older.rank = rk(f.older.value, olderPool);
    // lead: 'ours' (our verdict) | 'modis' (ours is weak for the camera that carried the period AND MODIS has a verdict) |
    // 'weak' (ours is weak and MODIS has no verdict or no count: our count and the warning, no verdict) | 'none' (no verdict: too little fire, too few years, no data).
    // A strong record with too little fire stays ours (too little to judge); MODIS never leads just because our count is small.
    f.lead = f.ours.word ? 'ours' : f.ours.weak && f.older && f.older.word ? 'modis' : f.ours.weak && !f.ours.tooFew ? 'weak' : 'none';   // too little fire stays the too-little state, warning added
    f.early = !!(f.provisional || f.partial);
    f.recordYears = recordYears(r);
    f.placeIn = inSentence(f.place);
    f.latestYm = r.current ? r.current.ym : r.latest ? r.latest.ym : null;
    return f;
  }
  // the record's span in whole years, month by month (Argentina Nov 2000 to Nov 2026: 26; Ghana Nov 2000 to Dec 2025: 25). ONE form everywhere:
  // every screen says "our N-year record" from this number (recordName), never a typed 26.
  function recordYears(r) { if (!r || !r.record_starts || !r.record_ends) return null; return Math.floor((mIndex(r.record_ends) - mIndex(r.record_starts) + 1) / 12); }
  // "our 26-year record"; first use in a room: "our 26-year record: MODIS and VIIRS on one scale"
  function recordName(r, first) { const n = r && r.record_starts ? recordYears(r) : r && r.recordYears; return 'our ' + n + '-year record' + (first ? ': MODIS and VIIRS on one scale' : ''); }

  // ---------- the new voice (VOICE_AND_COPY_0704.md): verdict words, feel phrases, period words, the short sentence ----------
  const SAY = { 'much quieter': 'Far quieter than normal', 'quieter': 'Quieter than normal', 'about usual': 'About normal', 'busier': 'Busier than normal',
    'much busier': 'Far busier than normal', 'too few to call': 'Too little fire to judge' };
  function say(code) { return code && SAY[code] ? SAY[code] : null; }
  const lower1 = (s) => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
  const cap1 = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
  // value / typical as a phrase a person can feel; null when either is missing or under 16
  const FEEL = [[0.15, 'a small fraction of the usual'], [0.29, 'about a quarter of the usual'], [0.41, 'about a third of the usual'], [0.58, 'about half the usual'],
    [0.71, 'about two-thirds of the usual'], [0.87, 'about three-quarters of the usual'], [0.95, 'a little under the usual'], [1.05, 'almost exactly the usual'],
    [1.18, 'a little over the usual'], [1.29, 'about a quarter more than usual'], [1.42, 'about a third more than usual'], [1.7, 'about half again the usual'],
    [2.4, 'about double the usual'], [3.5, 'about three times the usual']];
  function feel(value, typical, gate) {   // gate (unit switch): the floor is read on MODIS's scale, as in gatedWord
    const gv = gate ? gate.value : value, gt = gate ? (gate.typical !== undefined ? gate.typical : median(gate.pool)) : typical;
    if (value === null || value === undefined || typical === null || typical === undefined || !isFinite(value) || !isFinite(typical) || gv === null || gt === null || gv < TOO_FEW || gt < TOO_FEW) return null;
    const ratio = value / typical;
    let phrase = null;
    for (const [hi, p] of FEEL) if (hi === 1.05 ? ratio <= hi : ratio < hi) { phrase = p; break; }
    if (!phrase) phrase = 'about ' + numberWord(Math.round(ratio)) + ' times the usual';
    return { phrase, pct: Math.round(100 * (ratio - 1)), ratio };
  }
  // "almost exactly the usual" -> "almost exactly the usual amount of fire"; "about a third more than usual" -> "about a third more fire than usual"
  function amountOf(phrase, whose) {
    const w = whose || 'the';
    if (/ more than usual$/.test(phrase)) return phrase.replace(/ more than usual$/, ' more fire than ' + (w === 'the' ? 'usual' : w + ' usual'));
    if (phrase === 'a little under the usual') return 'a little less fire than ' + (w === 'the' ? 'usual' : w + ' usual');
    if (phrase === 'a little over the usual') return 'a little more fire than ' + (w === 'the' ? 'usual' : w + ' usual');
    return phrase.replace(/the usual$/, w + ' usual') + ' amount of fire';
  }
  // "about a third more than usual" -> "about a third more than its usual" (the MODIS line)
  function itsFeel(phrase) { return phrase.replace(/ the usual$/, ' its usual').replace(/ than usual$/, ' than its usual'); }
  // the small print says the percent plainly: "2% over", "76% under"
  function pctWords(fl) { if (!fl) return null; return fl.pct === 0 ? 'right on the usual' : Math.abs(fl.pct) + '% ' + (fl.pct > 0 ? 'over' : 'under'); }

  // the period in words: "early November", "November", "December 2015", "so far this year", "2025", "this fire season (July to September)"
  function periodWords(f) {
    if (!f || f.refusal) return null;
    if (f.kind === 'month') {
      const mo = MONTHS[moOf(f.ym) - 1];
      if (f.partial) return (f.days <= 12 ? 'early ' : f.days <= 21 ? 'mid ' : 'late ') + mo;
      return f.ym === f.recordEnds || f.ym === f.latestYm ? mo : mo + ' ' + yOf(f.ym);
    }
    if (f.kind === 'yearSoFar') return 'so far this year';
    if (f.kind === 'year') return String(f.year);
    if (f.kind === 'season') {
      const s = f.season, endY = yOf(s.end), startY = yOf(s.start);
      const recent = f.recordEnds && yOf(f.recordEnds) === endY && f.recordEnds >= '2026-01';
      return (recent ? 'this fire season' : 'the ' + (startY === endY ? startY : startY + '–' + String(endY).slice(2)) + ' fire season') + ' (' + s.span + ')';
    }
    return f.periodLabel;
  }
  // "in these twelve days" | "in December" | "so far this year" | "in 2025" | "this season"
  function stretchWords(f) {
    if (f.kind === 'month') return f.partial ? 'in these ' + numberWord(f.days) + ' days' : 'in ' + periodWords(f);
    if (f.kind === 'yearSoFar') return 'so far this year';
    if (f.kind === 'year') return 'in ' + f.year;
    return /^this/.test(periodWords(f)) ? 'this season' : 'that season';
  }
  // the one big line on the first screen
  function answerLine(f) {
    if (!f || f.refusal) return null;
    const pw = periodWords(f);
    const w = f.lead === 'ours' ? f.ours.word : f.lead === 'modis' ? f.older.word : null;
    if (w) {
      if (f.kind === 'season') return cap1(pw) + ' was ' + lower1(say(w)) + '.';
      if (f.kind === 'yearSoFar') return say(w) + ' ' + pw + '.';
      if (f.kind === 'year' || /\d{4}$/.test(pw)) return pw + ' was ' + lower1(say(w)) + '.';   // "2025 was far quieter than normal." / "August 2007 was ..."
      return say(w) + ' for ' + pw + '.';
    }
    if (f.ours.noScale && f.ours.noScaleMonths) return "No total on VIIRS's scale for " + pw + ': ' + f.ours.noScaleMonths.join(' and ') + ' has no count on this scale here (its conversion number is zero).';
    if (f.ours.noScale) return "No count on VIIRS's scale for " + pw + ': the conversion number for this month here is zero, so nothing can be scaled up.';
    if (f.ours.noData) return (f.older ? 'No data on our record for ' : 'No data for ') + (f.kind === 'yearSoFar' ? 'this year so far' : pw) + '.';
    if (f.lead === 'weak') return 'No fair answer for ' + (f.kind === 'yearSoFar' ? 'this year so far' : pw) + ' from our record.';
    if (f.ours.fewYears && !(f.older && f.older.word)) return 'Too few other years with data to judge ' + (f.kind === 'yearSoFar' ? 'this year so far' : f.kind === 'season' ? pw.replace(/ \(.*\)$/, '') : pw) + '.';
    if ((f.tooFew || f.ours.tooFew) && f.ours.why === 'usual' && !(f.older && f.older.why === 'small'))   // finding 2: a small usual, not a small count
      return (f.kind === 'month' && !f.partial ? MONTHS[moOf(f.ym) - 1] + ' is' : 'These dates are') + ' usually too quiet here for a reliable comparison.';
    if (f.tooFew || f.ours.tooFew) return 'Hardly any fire to count ' + (f.kind === 'yearSoFar' ? pw : f.kind === 'season' ? 'in ' + pw.replace(/ \(.*\)$/, '') : 'in ' + pw) + '.';
    return 'No fair answer for ' + (f.kind === 'yearSoFar' ? 'this year so far' : pw) + ' here.';
  }
  // ---------- verdict and felt phrase together (rank vs ratio) ----------
  // The verdict comes from RANK among the other years, the felt phrase from the RATIO to the usual. They can drift apart
  // ("Far quieter than normal" beside "about three-quarters of the usual"). Which ratios fit which verdict (NOTES.md has the table):
  //   Far quieter: under 0.71 (up to "about two-thirds")      Quieter: 0.29 to 0.95 ("about a third" to "a little under")
  //   About normal: 0.71 to 1.42 ("three-quarters" to "a third more")   Busier: 1.05 to 2.4 ("a little over" to "double")
  //   Far busier: 1.42 and up ("half again" and more)
  // Outside its verdict's range the felt phrase is replaced by the rank said plainly; the ratio stays in the small print.
  const FITS = { 'much quieter': [0, 0.71], 'quieter': [0.29, 0.95], 'about usual': [0.71, 1.42], 'busier': [1.05, 2.4], 'much busier': [1.42, Infinity] };
  function feelFits(word, fl) { if (!word || !fl || !FITS[word]) return true; const [lo, hi] = FITS[word]; return fl.ratio >= lo && fl.ratio < hi; }
  // "less fire than all but 3 of the 25 other years" / "more fire than any of the 25 other years" / "about as much as a typical year: 12 of the 25 other years had less"
  function rankWords(word, rk) {
    if (!rk || !rk.of) return null;
    const q = word === 'much quieter' || word === 'quieter', b = word === 'busier' || word === 'much busier';
    const same = rk.same || 0, tie = (n) => n === 1 ? 'one other year' : numberWord(n) + ' other years';
    if (q) return rk.less === 0 ? (same ? 'the least fire in the record, tied with ' + tie(same) : 'less fire than any of the ' + rk.of + ' other years') : 'less fire than all but ' + (rk.less + same) + ' of the ' + rk.of + ' other years';
    if (b) return rk.more === 0 ? (same ? 'the most fire in the record, tied with ' + tie(same) : 'more fire than any of the ' + rk.of + ' other years') : 'more fire than all but ' + (rk.more + same) + ' of the ' + rk.of + ' other years';
    return 'about as much fire as a typical year (' + rk.less + ' of the ' + rk.of + ' other years had less)';
  }
  // the phrase that goes with a verdict: the felt ratio when it fits, else the rank
  function fitPhrase(word, fl, rk, whose) { if (fl && feelFits(word, fl)) return { feel: true, text: amountOf(fl.phrase, whose) }; const w = rankWords(word, rk); return w ? { feel: false, text: w } : null; }
  // the felt sentence when the ratio would clash: the rank, as a person would say it
  function rankSentence(who, word, rk, place, stretch) {
    if (!rk || !rk.of) return null;
    const q = word === 'much quieter' || word === 'quieter', b = word === 'busier' || word === 'much busier', n = rk.of;
    const same = rk.same || 0, tie = same === 1 ? 'one other year' : numberWord(same) + ' other years';
    if (q && rk.less === 0 && same) return who + ' picked up the least fire across ' + place + ' ' + stretch + ' of any year in the record, tied with ' + tie + '.';
    if (b && rk.more === 0 && same) return who + ' picked up the most fire across ' + place + ' ' + stretch + ' of any year in the record, tied with ' + tie + '.';
    if (q) return who + ' picked up less fire across ' + place + ' ' + stretch + ' than in ' + (rk.less === 0 ? 'any of the ' + n + ' other years' : 'all but ' + (rk.less + same) + ' of the ' + n + ' other years') + '.';
    if (b) return who + ' picked up more fire across ' + place + ' ' + stretch + ' than in ' + (rk.more === 0 ? 'any of the ' + n + ' other years' : 'all but ' + (rk.more + same) + ' of the ' + n + ' other years') + '.';
    return who + ' picked up about as much fire across ' + place + ' ' + stretch + ' as in a typical year: ' + rk.less + ' of the ' + n + ' other years had less.';
  }
  function clash(f) { if (!f || f.refusal) return false; if (f.lead === 'ours') return !!f.ours.feel && !feelFits(f.ours.word, f.ours.feel); if (f.lead === 'modis') return !!f.older.feel && !feelFits(f.older.word, f.older.feel); return false; }
  // the felt sentence under it: "Satellites picked up almost exactly the usual amount of fire across Argentina in these twelve days."
  function feltLine(f) {
    if (!f || f.refusal) return null;
    if (f.lead === 'ours' && f.ours.feel) { const p = fitPhrase(f.ours.word, f.ours.feel, f.ours.rank);
      return p.feel ? 'Satellites picked up ' + p.text + ' across ' + f.placeIn + ' ' + stretchWords(f) + '.' : rankSentence('Satellites', f.ours.word, f.ours.rank, f.placeIn, stretchWords(f)); }
    if (f.lead === 'modis' && f.older.feel) { const p = fitPhrase(f.older.word, f.older.feel, f.older.rank, 'its');
      return p.feel ? 'MODIS picked up ' + p.text + ' across ' + f.placeIn + ' ' + stretchWords(f) + '.' : rankSentence('MODIS', f.older.word, f.older.rank, f.placeIn, stretchWords(f)); }
    return null;
  }
  // the too-little line: "3 detections; 8 is usual. That's too little to call it quiet or busy."
  function detections(v) { const s = fmt(v); return s + (s === '1' ? ' detection' : s === 'under 1' ? ' detection' : ' detections'); }
  function tooLittleLine(f) {
    if (!f || f.refusal || f.lead !== 'none' || !(f.tooFew || f.ours.tooFew || f.ours.fewYears) || f.ours.value === null) return null;
    const v = fmt(f.ours.value) === 'under 1' ? 'Next to nothing detected' : cap1(detections(f.ours.value));
    if (f.ours.fewYears) return v + ', but too few other years with data to compare with, so we can\'t call it quiet or busy.';
    if (f.ours.typical === null || f.ours.years < MIN_YEARS) return v + ', and too few other years to say what\'s usual, so we can\'t call it quiet or busy.';
    if (f.ours.why === 'usual') return v + '; ' + fmt(f.ours.typical) + ' is usual. That usual is too small for a reliable comparison, so we can\'t call it quiet or busy.';
    return v + '; ' + fmt(f.ours.typical) + ' is usual. That\'s too little to call it quiet or busy.';
  }
  // the MODIS line: when it differs, when it agrees, or nothing (no MODIS count, or MODIS already leads)
  // what MODIS's held-back reading says, in words (finding 2): "saw too little fire to judge" only when its count is small
  function olderHeld(f) {
    const o = f.older, when = f.kind === 'month' ? (f.partial ? 'these dates' : MONTHS[moOf(f.ym) - 1]) : f.kind === 'season' ? 'this season' : String(f.year);
    if (o.why === 'years') return 'saw ' + detections(o.value) + ', but there aren\'t enough other years with data to judge ' + (f.kind === 'month' ? 'it' : when);
    if (o.why === 'usual') return 'saw ' + detections(o.value) + ' against a usual of ' + fmt(o.typical) + ', too few for a reliable comparison';
    return 'saw too little fire to judge';
  }
  function modisLine(f) {
    if (!f || f.refusal || !f.older || f.lead === 'modis') return null;
    if (f.lead !== 'ours') return { agree: true, own: true, text: 'MODIS, NASA\'s older camera, counted on its own, ' + (f.older.word ? 'calls it ' + lower1(say(f.older.word)) + (f.older.feel && feelFits(f.older.word, f.older.feel) ? ' (' + itsFeel(f.older.feel.phrase) + ')' : '') : f.older.tooFew ? olderHeld(f) : 'gives no clear answer') + '.' };
    if (f.sameWord) return { agree: true, text: 'MODIS, NASA\'s older camera, counted on its own, says the same.' };
    const oFits = !f.older.feel || feelFits(f.older.word, f.older.feel);
    const what = f.older.feel ? 'saw ' + (oFits ? itsFeel(f.older.feel.phrase) : rankWords(f.older.word, f.older.rank)) : f.older.tooFew ? olderHeld(f) : 'gives no clear answer';
    const when = f.kind === 'month' ? 'this month' : f.kind === 'season' ? 'this season' : 'this year';
    // same direction, different degree ("far quieter" against "quieter"): say so, instead of "don't agree"
    const side = (w) => w === 'much quieter' || w === 'quieter' ? -1 : w === 'busier' || w === 'much busier' ? 1 : 0, deg = (w) => /much/.test(w) ? 2 : side(w) ? 1 : 0;
    if (f.older.feel && oFits && f.ours.word && f.older.word && side(f.ours.word) && side(f.ours.word) === side(f.older.word)) {
      const unit = f.kind === 'month' ? 'month' : f.kind === 'season' ? 'season' : 'year', q = side(f.ours.word) < 0 ? 'quiet' : 'busy';
      return { agree: false, sameWay: true, text: 'MODIS, NASA\'s older camera, counted on its own, also saw a ' + (q === 'quiet' ? 'quieter' : 'busier') + ' ' + unit + ' than usual, ' +
        (deg(f.older.word) < deg(f.ours.word) ? 'just not as ' + q : q === 'quiet' ? 'even quieter' : 'even busier') + ': ' + itsFeel(f.older.feel.phrase) + '.' };
    }
    return { agree: false, text: 'One catch: MODIS, NASA\'s older camera, counted on its own, ' + what + '. The two cameras don\'t agree ' + when + '.' };
  }
  // the weak-record line under a MODIS-led answer
  function weakLead(f) {
    if (!f || !f.ours || !f.ours.weak) return null;
    if (f.lead === 'modis') return 'Going by MODIS, NASA\'s older camera. Our own ' + f.recordYears + '-year record is unreliable for ' + f.placeIn + '.';
    if (f.lead === 'weak') return 'Our own ' + f.recordYears + '-year record is unreliable for ' + f.placeIn + (f.older ? ', and MODIS can\'t judge it either.' : f.olderMissing ? ', and MODIS has no count of its own for these dates.' : ', so it gives no verdict.');
    if (f.lead === 'none' && f.ours.value !== null) return 'Our own ' + f.recordYears + '-year record is also unreliable for ' + f.placeIn + '.';
    return null;
  }
  // the small print: "550 detections this period; 538 is usual for these dates (26 years). MODIS alone: 757; its usual is 557."
  function smallPrint(f) {
    if (!f || f.refusal) return null;
    const o = f.ours, parts = [];
    const forWhat = f.kind === 'year' ? 'for a whole year' : f.kind === 'season' ? 'for a whole season' : f.kind === 'month' && !f.partial ? 'for ' + MONTHS[moOf(f.ym) - 1] : 'for these dates';
    if (o.value === null) parts.push('No data on our record for these dates.');
    else if (tooLittleLine(f)) { /* the too-little line already says both counts */ }
    else parts.push((f.lead === 'modis' || f.lead === 'weak' ? 'Our record: ' + detections(o.value) : detections(o.value) + ' ' + (f.kind === 'season' ? 'this season' : f.kind === 'year' ? 'in ' + f.year : f.kind === 'yearSoFar' ? 'so far this year' : f.partial ? 'this period' : 'in ' + periodWords(f))) + (o.typical === null ? '; too few other years for a usual.' : '; ' + fmt(o.typical) + ' is usual ' + forWhat + ' (the middle of ' + o.years + ' other years).'));
    if (clash(f) && f.lead === 'ours') parts.push('That is ' + pctWords(f.ours.feel) + ' the usual.');
    if (f.older) parts.push('MODIS alone: ' + fmt(f.older.value) + (f.older.typical === null ? '.' : '; its usual is ' + fmt(f.older.typical) + (clash(f) && f.lead === 'modis' ? ' (' + pctWords(f.older.feel) + ')' : '') + '.'));
    else if (f.olderMissing) parts.push('MODIS has no count of its own ' + (f.kind === 'year' ? 'for all of ' + f.year : f.kind === 'yearSoFar' ? 'for every month this year' : f.kind === 'season' ? 'for the whole season' : 'for these dates') + '.');
    return parts.join(' ');
  }
  const UNIT_SENTENCE = 'How we count: each 5 km patch of ground where a satellite detected fire, once per day. Not a count of individual fires or of land burned.';
  const EARLY_TIP = 'The last few months come from NASA\'s rapid feed and can still change.';
  function earlyTip(f) { return !f || !f.early ? null : (f.provisional ? EARLY_TIP : '') + (f.partial && f.kind === 'month' ? (f.provisional ? ' ' : '') + 'Days 1 to ' + f.days + ' so far, compared with the same days in other years.' : ''); }

  // "what's been happening": the last three finished months before a month; at least two quiet (or busy) by the feel gates, both cameras the same way
  function happeningLine(r, f) {
    if (!f || f.refusal || f.kind !== 'month') return null;
    const yms = []; let y = yOf(f.ym), mo = moOf(f.ym);
    for (let k = 0; k < 36 && yms.length < 3; k++) { mo--; if (mo < 1) { mo = 12; y--; } const ym = ymOf(y, mo); if (ym < r.record_starts) break;
      const x = row(r, ym); if (x && x.status === 'final' && x.value !== null) yms.unshift(ym); }
    if (yms.length < 3) return null;
    const months = yms.map(ym => {
      const p = forPeriod(r, { month: ym }); if (p.refusal) return null;
      const fo = feel(p.ours.value, p.ours.typical, p.ours._gate);
      if (ym < OLDER_FROM) return !p.ours.weak && fo ? { ym, fl: fo } : null;   // before 2022 the record IS MODIS (unless weakly translated)
      const fm = p.older ? feel(p.older.value, p.older.typical, p.older._gate) : null;
      if (!fo || !fm || (fo.ratio < 1) !== (fm.ratio < 1)) return null;          // both comparable, both the same way
      return { ym, fl: p.ours.weak ? fm : fo };
    }).filter(Boolean);
    const quiet = months.filter(m => m.fl.ratio < 0.71), busy = months.filter(m => m.fl.ratio >= 1.42);
    const set = quiet.length >= 2 ? quiet : busy.length >= 2 ? busy : null;
    if (!set) return null;
    const two = set.slice().sort((a, b) => quiet.length >= 2 ? a.fl.ratio - b.fl.ratio : b.fl.ratio - a.fl.ratio).slice(0, 2).sort((a, b) => a.ym < b.ym ? -1 : 1);
    const inSeason = yms.filter(ym => seasonMonthsOf(r).indexOf(moOf(ym)) >= 0).length >= 2;
    const what = (quiet.length >= 2 ? 'a strangely quiet ' : 'an unusually busy ') + (inSeason ? 'season' : 'few months');
    const full = (fl) => /than usual$/.test(fl.phrase) ? amountOf(fl.phrase) : fl.phrase.replace(/the usual$/, 'its usual fire');
    const short = (fl) => fl.phrase.replace(/ of the usual$/, '').replace(/ the usual$/, '').replace(/ than usual$/, '');
    const nm = (ym) => MONTHS[moOf(ym) - 1];
    return 'It follows ' + what + ': ' + nm(two[0].ym) + ' saw ' + full(two[0].fl) + ', ' + nm(two[1].ym) + ' ' + short(two[1].fl) + '.';
  }

  // the three positions of the first screen's switch, for this place
  function positions(r) {
    const latest = r && (r.current ? r.current.ym : r.latest ? r.latest.ym : null);
    const lastComplete = r && Array.isArray(r.year_totals) ? (r.year_totals.filter(t => t.complete).map(t => t.year).pop() || null) : null;
    return { month: latest ? { month: latest } : null, year: r && r.current ? { year: yOf(r.current.ym) } : lastComplete ? { year: lastComplete } : null,
      season: lastSeason(r) !== null ? { season: lastSeason(r) } : null, yearIsSoFar: !!(r && r.current), latestYm: latest };
  }

  // ---------- Readings.shortSentence: the new short report sentence (slide 6's quote box) ----------
  function shortSentence(r, sel) { const s = shortSentenceM(r, sel); return r && r.unit ? s + scaleTail(r, sel) : s; }   // unit switch: the scale is named
  function shortSentenceM(r, sel) {
    const f = forPeriod(r, sel);
    if (f.refusal) return 'Nothing to show here: ' + f.refusal.message + '.';
    const pw = periodWords(f), when = f.kind === 'yearSoFar' ? pw : f.kind === 'month' && !f.partial ? 'in ' + MONTHS[moOf(f.ym) - 1] + ' ' + yOf(f.ym) : 'in ' + pw;
    const n = f.recordYears, early = f.early ? ' Early data.' : '';
    if (f.lead === 'ours') {
      let s = 'Fire activity across ' + f.placeIn + ' was ' + lower1(say(f.ours.word)) + ' ' + when + ' on the ' + n + '-year satellite record.';
      if (f.older && f.sameWord) s += ' NASA\'s older MODIS camera, counted on its own, says the same.';
      else if (f.older) s += ' NASA\'s older MODIS camera, counted on its own, saw ' + (f.older.feel ? (feelFits(f.older.word, f.older.feel) ? f.older.feel.phrase : rankWords(f.older.word, f.older.rank)) : f.older.tooFew ? 'too little fire to judge' : lower1(say(f.older.word) || 'no clear answer')) + '.';
      else if (f.olderMissing) s += ' NASA\'s older MODIS camera has no count of its own ' + (f.kind === 'year' ? 'for all of ' + f.year : f.kind === 'season' ? 'for the whole season' : f.kind === 'yearSoFar' ? 'for every month this year' : 'for these dates') + '.';
      else if (f.ours.feel) s = s.replace(/\.$/, ' (' + (feelFits(f.ours.word, f.ours.feel) ? f.ours.feel.phrase : rankWords(f.ours.word, f.ours.rank)) + ').');
      return s + early;
    }
    if (f.lead === 'modis') return 'Fire activity across ' + f.placeIn + ' was ' + lower1(say(f.older.word)) + ' ' + when + ', going by NASA\'s older MODIS camera counted on its own' +
      (f.older.feel ? ' (' + (feelFits(f.older.word, f.older.feel) ? itsFeel(f.older.feel.phrase) : rankWords(f.older.word, f.older.rank)) + ')' : '') + '. Our ' + n + '-year record is unreliable for ' + f.placeIn + '.' + early;
    const modisOwn = f.older ? ' NASA\'s older MODIS camera, counted on its own, saw ' + detections(f.older.value) + (f.older.typical === null ? '' : ' against its usual ' + fmt(f.older.typical)) + (f.older.word ? ': ' + lower1(say(f.older.word)) : '') + '.' : '';
    if (f.ours.value === null) return 'Our record has no data for ' + f.placeIn + ' ' + when + '.' + modisOwn + early;
    if (f.lead === 'weak') return 'Our ' + n + '-year record is unreliable for ' + f.placeIn + ', so it gives no verdict ' + when + ' (' + detections(f.ours.value) + ').' +
      (f.older ? modisOwn : f.olderMissing ? ' NASA\'s older MODIS camera has no count of its own for these dates.' : '') + early;
    if (f.ours.fewYears) return cap1(detections(f.ours.value)) + ' across ' + f.placeIn + ' ' + when + ', but too few other years with data to call it quiet or busy.' + modisOwn + early;
    if (f.tooFew || f.ours.tooFew) return 'Hardly any fire was detected across ' + f.placeIn + ' ' + when + ': ' + (fmt(f.ours.value) === 'under 1' ? 'next to nothing' : detections(f.ours.value)) +
      (f.ours.typical === null || f.ours.years < MIN_YEARS || fmt(f.ours.value) === 'under 1' ? '' : ' against a usual ' + fmt(f.ours.typical)) + ', too little to call it quiet or busy.' + modisOwn + early;
    return 'Our ' + n + '-year record gives no clear answer for ' + f.placeIn + ' ' + when + '.' + modisOwn + early;
  }
  // everything the first screen says, in one place (so the screen and the checks read the same words)
  function screen(r, sel) {
    const f = forPeriod(r, sel), pos = positions(r);
    const switchLabels = { month: r && r.current ? 'This month' : 'Latest month', year: pos.yearIsSoFar ? 'This year so far' : 'Last full year', season: 'Last fire season' };
    if (f.refusal) return { f, refusal: refusalLine(f), switchLabels };
    const modis = modisLine(f);
    return { f, label: screenLabel(r, f), question: 'Is ' + f.placeIn + ' burning more than usual?', answer: answerLine(f), felt: feltLine(f), weak: weakLead(f), modis, tooLittle: tooLittleLine(f),
      happening: happeningLine(r, f), small: smallPrint(f), unit: UNIT_SENTENCE, early: f.early, earlyTip: earlyTip(f), periodWords: periodWords(f),
      past: pastLine(r, f), caption: pictureCaption(r, f), keyOurs: recordName(r), switchLabels, otherMonth: 'another month', backToNow: 'Back to now',
      buttons: [modis && !modis.agree ? 'See why the cameras disagree ▸' : 'See how two cameras can disagree ▸', 'Explore ' + f.recordYears + ' years ▸'], sure: 'How sure are we? ▸' };
  }
  // the refusal, said plainly: "There's no month with usable data for Monaco in this record, so there's nothing to show."
  function refusalLine(f) {
    const m = f.refusal.message || '';
    if (f.refusal.code === 'NO_USABLE_MONTHS' || /no month with usable data/.test(m)) return 'There\'s no month with usable data for ' + inSentence(f.place) + ' in this record, so there\'s nothing to show.';
    return 'Nothing to show here: ' + m + '.';
  }
  // the small label over the answer: "ARGENTINA · NOVEMBER 1–12, 2026"; a place whose record ends early says so
  function screenLabel(r, f) {
    let what = f.periodLabel;
    if (f.kind === 'yearSoFar') { const d = r.current.last_day; what = 'January 1 to ' + MONTHS[+d.slice(5, 7) - 1] + ' ' + (+d.slice(8, 10)) + ', ' + d.slice(0, 4); }
    const latest = r.current ? r.current.ym : r.latest ? r.latest.ym : null;
    const ended = f.kind === 'month' && !r.current && f.ym === latest && f.ym < '2025-12' ? ' · the latest month in its record' : '';
    return (f.place + ' · ' + what + ended).toUpperCase();
  }
  // the picture's caption: "Early November, every year since 2000. This year in gold."
  function pictureCaption(r, f) {
    const first = yOf(r.record_starts);
    let what;
    if (f.kind === 'month') what = f.partial ? cap1(periodWords(f)) : MONTHS[moOf(f.ym) - 1];
    else if (f.kind === 'yearSoFar') { const d = r.current.last_day; what = 'January 1 to ' + MONTHS[+d.slice(5, 7) - 1] + ' ' + (+d.slice(8, 10)); }
    else if (f.kind === 'year') what = 'The whole year';
    else what = cap1(f.season.span);
    const gold = f.partial || f.kind === 'yearSoFar' ? 'This year' : f.kind === 'season' ? 'The ' + (yOf(f.season.start) === yOf(f.season.end) ? f.year : f.year + '–' + String(yOf(f.season.end)).slice(2)) + ' season' : String(f.year);
    // finding 6: "every year since" only when every year from the first one with data has a value; else "in the years with data"
    const sel = f.kind === 'month' ? { month: f.ym } : f.kind === 'season' ? { season: f.year } : { year: f.year };
    let ser = []; try { ser = seriesFor(r, sel) || []; } catch (e) { ser = []; }
    const have = ser.filter(x => x.ours !== null && x.ours !== undefined).map(x => x.year);
    if (!have.length) return what + ', every year since ' + first + '. ' + gold + ' in gold.';
    const y0 = Math.min(...have), y1 = Math.max(...have), full = have.length === y1 - y0 + 1;
    return full ? what + ', every year since ' + y0 + '. ' + gold + ' in gold.' : (f.kind === 'year' ? 'Whole years with data since ' + y0 : what + ' in the years with data since ' + y0) + '. ' + gold + ' in gold.';
  }
  // a month chosen from the past, before 2022: one answer, and one small line saying why
  function pastLine(r, f) {
    if (f.kind !== 'month' || f.ym >= OLDER_FROM || f.ym === f.latestYm) return null;
    const x = row(r, f.ym); if (!x || x.value === null) return null;
    if (x.carrier === 'Terra') return 'Before 2022 MODIS was the record, so there\'s one answer. This month comes from MODIS on Terra, the first of NASA\'s two MODIS cameras.';
    if (x.carrier === 'SNPP' || x.carrier === 'NOAA20') return 'Before 2022 MODIS was the record, so there\'s one answer. This month MODIS sent too little, so VIIRS stood in, put on MODIS\'s scale.';
    return 'Before 2022 MODIS was the record, so there\'s one answer.';
  }

  // A2: the trust chip never puts the whole-month score beside a part-month answer without saying so
  function partialLine(r) { const d = numberWord(r.current.days); return d.charAt(0).toUpperCase() + d.slice(1) + ' days of early data. In past tests, ' + d + '-day counts of this size were off by more than a quarter about one time in four.'; }
  function trustLine(r, partial) {
    const s = score(r);
    if (!partial) return s.line;
    // coordinator's change to A2 (final plan synthesis): on an unfinished month the whole-month score is NOT printed
    return partialLine(r);
  }

  // ---------- Readings.yearly ----------
  function yearly(r) {
    if (!r || !Array.isArray(r.year_totals)) return [];
    const st = A.stitched(r && r.unit ? r.unit.base : r), glued = A.isRefusal(st) ? null : st;   // glued as-is = each camera's own counts, on no common scale
    return r.year_totals.map(t => ({ year: t.year, ours: t.complete ? t.total : null, soFar: t.complete ? null : t.months_so_far_total, olderOwn: olderYearTotal(r, t.year),
      newerAsIs: glued ? glued.stitched[glued.years.indexOf(t.year)] : null, complete: !!t.complete, typical: t.typical_other }));
  }

  // ---------- extras for the page's pictures (all arithmetic stays here) ----------
  // the answer's picture: the same period in every year, ours and (from 2022) the older camera's own count, read from the engine/adapter
  function series(r, sel) {
    const p = resolve(r, sel); if (!p || !p.month) return [];
    const a = A.answer(r, p); if (A.isRefusal(a)) return [];
    const ym = p.month, y = yOf(ym), mo = moOf(ym), rw = row(r, ym), partial = rw && rw.status === 'partial';
    const out = a.others.map(o => ({ year: o.year, ours: o.value, older: null, judged: false }));
    out.push({ year: y, ours: a.value, older: null, judged: true });
    for (const s of out) {
      if (s.year < 2022) continue;
      if (partial) { if (s.judged) s.older = hasRow(r, 'Aqua', ym) && r.current.raw ? r.current.raw.Aqua : null;
        else { const sd = r.current.same_days.find(d => d.year === s.year); s.older = sd && sd.raw && hasSame(r, 'Aqua', s.year, mo) ? sd.raw.Aqua : null; } }
      else { const rr = row(r, ymOf(s.year, mo)); s.older = rr && rr.status !== 'partial' ? aquaOf(r, rr) : null; }
      if (s.older === undefined) s.older = null;
    }
    return out.sort((u, v) => u.year - v.year);
  }
  // MODIS's own count for one month, from 2022 only (the first screen's ticks and the monthly record's ticks); null = no count
  function modisMonth(r, ym) {
    if (ym < OLDER_FROM) return null; const x = row(r, ym); if (!x) return null;
    if (x.status === 'partial') return r.current && hasRow(r, 'Aqua', ym) && r.current.raw && r.current.raw.Aqua !== null && r.current.raw.Aqua !== undefined ? r.current.raw.Aqua : null;
    return aquaOf(r, x);   // MODIS's own row decides, whatever the joined month's status
  }
  // the first screen's picture for any switch position: one bar per year for the same stretch; MODIS's own count from 2022
  function seriesFor(r, sel) {
    const f = forPeriod(r, sel); if (f.refusal) return [];
    if (f.kind === 'month') return series(r, sel);
    const out = [];
    if (f.kind === 'yearSoFar') {
      const cur = r.current, k0 = moOf(cur.ym) - 1, mo0 = moOf(cur.ym), y0 = yOf(cur.ym);
      const sumA = (yy, part) => { if (part === null || part === undefined) return null; let t = part; for (let mo = 1; mo <= k0; mo++) { const v = aquaOf(r, row(r, ymOf(yy, mo))); if (v === null) return null; t += v; } return t; };
      for (const o of cur.year_so_far.others) if (o.year !== y0) {
        const sd = cur.same_days.find(d => d.year === o.year);
        out.push({ year: o.year, ours: o.value, older: o.year >= 2022 && sd && hasSame(r, 'Aqua', o.year, mo0) ? sumA(o.year, sd.raw ? sd.raw.Aqua : null) : null, judged: false });
      }
      out.push({ year: y0, ours: cur.year_so_far.value, older: f.older ? f.older.value : null, judged: true });
    } else if (f.kind === 'year') {
      for (const t of r.year_totals) if (t.year !== (r.current ? yOf(r.current.ym) : -1)) out.push({ year: t.year, ours: t.complete ? t.total : null, older: t.year >= 2022 ? olderYearTotal(r, t.year) : null, judged: t.year === f.year });
    } else if (f.kind === 'season') {
      for (let yy = yOf(r.record_starts); yy <= yOf(r.record_ends); yy++) { const s = seasonYms(r, yy); if (s[0] < r.record_starts || s[s.length - 1] > r.record_ends) continue;
        out.push({ year: yy, ours: seasonSum(r, yy, x => x.value), older: s[0] >= OLDER_FROM ? olderSeasonSum(r, yy) : null, judged: yy === f.year }); }
    }
    return out.sort((u, v) => u.year - v.year);
  }
  // A4's caption for the glued switch, for any place: ratios of 2022 to 2021 (glued and on one scale); generic when a year is missing
  function gluedCaption(r) {
    const ys = yearly(r), y21 = ys.find(t => t.year === 2021), y22 = ys.find(t => t.year === 2022);
    const tail = 'Switching cameras mixes what was detected with how it was counted.';
    if (!y21 || !y22 || !(y21.ours > 0) || y22.ours === null || y22.newerAsIs === null) return tail;
    const g = y22.newerAsIs / y21.ours, s = Math.round(100 * (y22.ours / y21.ours - 1));
    const one = s === 0 ? 'about the same as 2021' : 'about ' + Math.abs(s) + '% ' + (s > 0 ? 'above' : 'below') + ' 2021';
    return 'Glued as-is, 2022 reads ' + (g >= 1.95 ? g.toFixed(1) + ' times' : 'about ' + Math.round(100 * (g - 1)) + '% ' + (g >= 1 ? 'above' : 'below')) + ' 2021. On one scale it is ' + one + '. ' + tail;
  }
  // after 2021: ours against the older camera's own count, whole years from 2022
  function afterGaps(r) {
    return yearly(r).filter(t => t.year >= 2022 && t.complete && t.ours !== null && t.olderOwn).map(t => ({ year: t.year, ours: t.ours, olderOwn: t.olderOwn, gapPct: 100 * (t.ours / t.olderOwn - 1) }));
  }
  // camera names, said the same way everywhere (never "first camera")
  const CAMERA = { Terra: 'the earlier camera (Terra)', Aqua: 'the older camera (Aqua)', SNPP: 'the newer camera (S-NPP)', NOAA20: 'the newer camera\'s twin (NOAA-20)' };
  function cameraName(k) { return CAMERA[k] || 'no camera'; }

  // ---------- Readings.recordWord (gate 2, exact form: [The team lead's ruling: default assumed]) ----------
  // a "busiest" label only when 100*(top - runnerUp)/runnerUp is larger than the place's typical miss, and, for a top year from 2022,
  // also larger than 100*|ours/olderOwn - 1| for that year; null when any input is missing or a denominator is zero.
  function recordCheck(r) {
    const comp = (r && r.year_totals || []).filter(t => t.complete && t.total !== null);
    if (comp.length < 2) return { ok: false, reason: 'fewer than two whole years', top: null, runnerUp: null };
    const s = comp.slice().sort((x, y) => y.total - x.total), top = s[0], ru = s[1];
    const out = { top: { year: top.year, total: top.total }, runnerUp: { year: ru.year, total: ru.total }, gapPct: null, missPct: null, cameraPct: null, ok: false, reason: null };
    if (!(ru.total > 0)) { out.reason = 'the runner-up year is zero'; return out; }
    out.gapPct = 100 * (top.total - ru.total) / ru.total;
    const s0 = score(r); out.missPct = s0.typicalPct;
    if (out.missPct === null) { out.reason = 'noscore'; return out; }   // shared-curve places included: their percent is not a fair score
    if (!(out.gapPct > out.missPct)) { out.reason = 'tie'; return out; }
    // builder A's addition (GUESSES 6): a top year with earlier-camera (Terra) months must also beat that camera's own tested miss here
    if (r.monthly.some(x => yOf(x.ym) === top.year && x.carrier === 'Terra' && x.value !== null)) {
      const tf = r.factors && r.factors.Terra, th = r.hide_a_year && r.hide_a_year.Terra;
      out.earlierPct = tf && tf.mode !== 'none' && th && th.typical_pct !== null && th.typical_pct !== undefined ? th.typical_pct : null;
      if (out.earlierPct === null || !(out.gapPct > out.earlierPct)) { out.reason = 'earlier'; return out; }
    }
    if (top.year >= 2022) { const ow = olderYearTotal(r, top.year); if (!ow) { out.reason = 'noolder'; return out; }
      out.cameraPct = 100 * Math.abs(top.total / ow - 1); if (!(out.gapPct > out.cameraPct)) { out.reason = 'cameras'; return out; } }
    out.ok = true; return out;
  }
  function recordWord(r) { const c = recordCheck(r); return c.ok ? { year: c.top.year, total: c.top.total, runnerUp: c.runnerUp } : null; }
  function recordLine(r) {
    const c = recordCheck(r);
    if (!c.top) return null;
    if (c.ok) return c.top.year + ' is the busiest whole year in this record: ' + fmt(c.top.total) + ' lit squares, ahead of ' + c.runnerUp.year + ' (' + fmt(c.runnerUp.total) + ') by more than this place\'s typical miss.';
    // the real reason, said plainly (fix round, item 5)
    if (c.reason === 'tie') return c.top.year + ' and ' + c.runnerUp.year + ', nearly tied (' + fmt(c.top.total) + ' and ' + fmt(c.runnerUp.total) + '): the lead is smaller than this place\'s typical miss, so no busiest year is named.';
    if (c.reason === 'cameras') return 'No busiest year is named: the two cameras disagree about ' + c.top.year + ' by more than its lead over ' + c.runnerUp.year + '.';
    if (c.reason === 'noolder') return 'No busiest year is named: the older camera has no full-year count for ' + c.top.year + ' to check it against.';
    if (c.reason === 'earlier') return 'No busiest year is named: ' + c.top.year + ' comes partly from the earlier camera (Terra), and its lead over ' + c.runnerUp.year + ' is not larger than that camera\'s typical miss here.';
    if (c.reason === 'noscore') return 'No busiest year is named: this place has no fair test score to judge a lead by.';
    return 'No busiest year is named: the runner-up year is zero.';
  }

  // ---------- the record room in the new voice (Nov 14 day build) ----------
  // "Which years burned most?": the biggest whole year when the gate lets us name it; otherwise the plain reason we don't
  function yearsLine(r) {
    const c = recordCheck(r); if (!c.top) return null;
    const place = inSentence(placeOf(r)), t = c.top.year, ru = c.runnerUp.year, T = fmt(c.top.total), RU = fmt(c.runnerUp.total);
    const looks = t + ' has the most detections (' + T + ', then ' + ru + ' with ' + RU + ')';
    if (c.ok) return t + ' burned most: ' + T + ' detections, clearly ahead of ' + ru + ' (' + RU + ').';
    if (c.reason === 'tie') return t + ' and ' + ru + ' burned most, and they\'re too close to pick one: ' + T + ' and ' + RU + ' detections, a gap smaller than our record\'s usual miss here.';
    if (c.reason === 'cameras') return looks + ', but the two cameras disagree about ' + t + ' by more than its lead, so we won\'t call it the biggest.';
    if (c.reason === 'noolder') return looks + ', but MODIS has no full-year count for ' + t + ' to check it against, so we won\'t call it the biggest.';
    if (c.reason === 'earlier') return looks + ', but part of ' + t + ' comes from MODIS on Terra, the earliest camera, and its lead is smaller than that camera\'s usual miss here, so we won\'t call it the biggest.';
    if (c.reason === 'noscore') return looks + ', but our record has no fair test score for ' + place + ', so we won\'t call it the biggest.';
    return null;
  }
  // why our record gives no verdict for a month (or a place), in plain words; "Go by MODIS" only when MODIS has a count
  function weakPlain(r, x, hasModis) {
    const place = inSentence(placeOf(r)), go = hasModis ? ' Go by MODIS\'s own count.' : '';
    if (x && x.carrier === 'Terra') {
      const mode = modeFor(r, 'Terra', x.method), hy = r.hide_a_year && r.hide_a_year.Terra, p = mode === 'single' && hy && hy.typical_pct !== null && hy.typical_pct !== undefined ? pct(hy.typical_pct) : null;
      return 'This month comes from MODIS on Terra, the earliest camera. Here its count is put on the later scale with ' + (mode === 'single' ? 'one number for the whole year' : 'no numbers of its own') +
        (p !== null ? ' (a typical miss of about ' + p + '% in past tests)' : '') + ', so our record gives no verdict.' + go;
    }
    const s = score(r);
    if (s.rule === 'one') return 'Our record is unreliable for ' + place + ': here VIIRS is put on MODIS\'s scale with one number for the whole year' + (s.typicalPct !== null ? ', and in past tests that missed by about ' + pct(s.typicalPct) + '% in a typical month' : '') + '.' + go;
    if (highMiss(s)) return 'Our record is unreliable for ' + place + ': in past tests it typically missed MODIS\'s own count here by about ' + pct(s.typicalPct) + '% in a month.' + go;
    return 'Our record is unreliable for ' + place + ': here VIIRS is put on MODIS\'s scale with a curve shared by the whole world, not numbers of its own.' + go;
  }
  // how a month was counted, in plain words (the engine's own note, translated)
  function howCounted(x) {
    if (!x || !x.why || x.value === null) return null;
    const mo = MONTHS[moOf(x.ym) - 1];
    let w = String(x.why).replace(/\s*\(fix \d+:[^)]*\)/g, '');
    w = w.replace(/^Aqua is the reference camera: its own count$/, 'MODIS\'s own count, as it came')
      .replace(/^NOAA-20 count/, 'The count from VIIRS on NOAA-20 (standing in for S-NPP)').replace(/^S-NPP count/, 'The VIIRS count').replace(/^Terra count/, 'The count from MODIS on Terra')
      .replace(/this area's number for this month of the year/, 'this country\'s number for ' + mo).replace(/this area's one number/, 'one number for the whole year').replace(/this area's/g, 'this country\'s').replace(/times NOAA-20 onto S-NPP/, 'with a small step from NOAA-20 to S-NPP')
      .replace(/\(learned (\d{4})-(\d{4})\)/, '(learned from $1 to $2, when both cameras flew)').replace(/\(Terra onto Aqua, learned (\d{4})-(\d{4})\)/, '(learned from $1 to $2)');
    return w.charAt(0).toUpperCase() + w.slice(1);
  }
  // the month panel's lines, what happened first and the counts second
  function monthPanel(r, ym) {
    const f = forPeriod(r, { month: ym }); if (f.refusal) return { refusal: f.refusal.message };
    const o = f.ours, x = row(r, ym), out = { f, early: f.early, earlyTip: earlyTip(f) };
    if (o.value === null) {
      if (o.noScale) { out.say = 'No count on VIIRS\'s scale this month.'; out.note = 'The conversion number for this month here is zero, so nothing can be scaled up.'; return out; }
      if (f.older) { out.say = 'Our record has no count this month.'; out.note = 'The gap is in our record. MODIS counted ' + detections(f.older.value) + '.'; return out; }   // finding 4
      out.say = 'No data this month.'; out.note = 'A gap in the record, not a quiet month.'; return out; }
    if (f.lead === 'ours') { const p = o.feel ? fitPhrase(o.word, o.feel, o.rank) : null; out.say = say(o.word) + (p ? ': ' + p.text + '.' : '.'); }
    else if (f.lead === 'modis') { const p = f.older.feel ? fitPhrase(f.older.word, f.older.feel, f.older.rank, 'its') : null; out.say = say(f.older.word) + ', going by MODIS' + (p ? ': ' + p.text + '.' : '.'); }
    else if (o.fewYears) out.say = 'Too few other years to judge.';
    else if (o.tooFew) out.say = o.why === 'usual' ? 'Usually too quiet here to judge.' : o.why === 'years' ? 'Too few other years to judge.' : 'Too little fire to judge.';
    else out.say = 'No fair verdict from our record this month.';
    out.sayOk = f.lead !== 'none';
    if (f.lead === 'ours' && f.older) out.modis = f.sameWord ? 'MODIS alone says the same.' : 'MODIS alone: ' + lower1(say(f.older.word) || (f.older.tooFew ? (f.older.why === 'usual' ? 'usually too quiet here to judge' : f.older.why === 'years' ? 'too few other years to judge' : 'too little fire to judge') : 'no clear answer')) + (f.older.feel && feelFits(f.older.word, f.older.feel) ? ' (' + itsFeel(f.older.feel.phrase) + ')' : '') + '.';
    else if (f.lead === 'none' && f.older) out.modis = 'MODIS alone: ' + fmt(f.older.value) + (f.older.typical === null ? '.' : '; its usual is ' + fmt(f.older.typical) + '.');
    else if (f.olderMissing) out.modis = 'MODIS has no count of its own this month.';
    if (o.weak) out.weak = weakPlain(r, x, !!f.older);
    out.past = pastLine(r, f);
    out.counts = cap1(detections(o.value)) + ' on ' + recordName(r) + (o.typical === null ? '; too few other years for a usual.' : '; ' + fmt(o.typical) + ' is usual (the middle of ' + o.years + ' other years' + (f.partial ? ', same days' : '') + ').') +
      (f.older && f.lead !== 'none' ? ' MODIS alone: ' + fmt(f.older.value) + (f.older.typical === null ? '.' : '; its usual is ' + fmt(f.older.typical) + '.') : '');
    out.how = howCountedAny(x);
    return out;
  }
  // "How is this year going?": the year in one line, then MODIS when it differs
  function yearSay(r, y) {
    const f = forPeriod(r, { year: y }); if (f.refusal) return { f, line: null };
    const now = f.kind === 'yearSoFar', pw = now ? 'so far this year' : 'in ' + y;
    let line;
    const fp = (w, fl, rk, whose) => { const p = fl ? fitPhrase(w, fl, rk, whose) : null; return p ? ': ' + p.text + '.' : '.'; };
    if (f.lead === 'ours') line = (now ? say(f.ours.word) + ' so far this year' : y + ' was ' + lower1(say(f.ours.word))) + fp(f.ours.word, f.ours.feel, f.ours.rank);
    else if (f.lead === 'modis') line = (now ? say(f.older.word) + ' so far this year' : y + ' was ' + lower1(say(f.older.word))) + ', going by MODIS' + fp(f.older.word, f.older.feel, f.older.rank, 'its');
    else line = answerLine(f);
    return { f, line, modis: modisLine(f), weak: f.ours.weak ? weakPlain(r, null, !!f.older) : null, little: tooLittleLine(f), when: pw };
  }

  // whole years against MODIS's own count, said the way a person would: "within 3% in 2022 and 2023, about 7% lower in 2024 and 2025"
  function gapWords(gaps) {
    const and = (ys) => ys.length === 1 ? String(ys[0]) : ys.slice(0, -1).join(', ') + ' and ' + ys[ys.length - 1];
    const close = gaps.filter(g => Math.abs(g.gapPct) < 3).map(g => g.year), parts = close.length ? ['within 3% in ' + and(close)] : [];
    const rest = {}; for (const g of gaps) if (Math.abs(g.gapPct) >= 3) { const k = Math.round(Math.abs(g.gapPct)) + (g.gapPct < 0 ? '% lower' : '% higher'); (rest[k] = rest[k] || []).push(g.year); }
    for (const k in rest) parts.push('about ' + k + ' in ' + and(rest[k]));
    return parts.join(', ');
  }
  // ---------- Readings.sentence (A8) ----------
  function sentence(r, sel) { const s = sentenceM(r, sel); return r && r.unit ? s + scaleTail(r, sel) : s; }   // unit switch: the scale is named
  function sentenceM(r, sel) {
    const f = forPeriod(r, sel);
    if (f.refusal) return 'Nothing to show here: ' + f.refusal.message + '.';
    const o = f.ours, prov = f.provisional ? ' (early data)' : '';
    const parts = [];
    // the span the usual comes from, named truly
    const sameDates = f.isMonth ? 'for those same dates' : f.kind === 'season' ? 'for the same season in other years' : f.kind === 'yearSoFar' ? 'for the same dates in other years' : 'for other whole years';
    const sameWhat = f.isMonth ? 'for the same month' : f.kind === 'season' ? 'for the same season in other years' : f.kind === 'yearSoFar' ? 'for the same dates in other years' : 'for other whole years';
    const against = (t, what) => t === null || t === undefined ? ' (no typical: too few other years)' : ', against a historical median of ' + fmt(t) + ' ' + what;
    const against2 = (t, what) => against(t, what).replace(/^, against/, ' against');
    if (o.noData) parts.push(f.place + ', ' + f.periodLabel + prov + ': no data on our record for these dates.' + (f.older ? ' MODIS, NASA\'s older camera, counted ' + fmt(f.older.value) + ' on its own' + (f.older.typical === null ? '' : ', against its own historical median of ' + fmt(f.older.typical)) + (f.older.word ? ': ' + say(f.older.word).toLowerCase() : f.older.tooFew ? (f.older.why === 'small' || !f.older.why ? ': too little fire to judge' : '. ' + heldBack(f.older, '', f.isMonth ? MONTHS[moOf(f.ym) - 1] : 'these dates').replace(/\.$/, '')) : '') + '.' : ''));
    else if (f.older) {
      let lead = f.place + ', ' + f.periodLabel + prov + ': our record is ' + aboutUnit(o.value) + against(o.typical, sameDates) +
        '; MODIS, NASA\'s older camera, counted ' + fmt(f.older.value) + ' on its own.';
      if (f.sameWord) lead += ' Both read ‘' + say(o.word).toLowerCase() + '’ against their own histories for those dates.';
      else if (o.word && f.older.word) lead += ' The two disagree: ' + say(o.word).toLowerCase() + ' on our record, ' + say(f.older.word).toLowerCase() + ' on MODIS.';
      else if (o.weak && f.older.word) lead += ' On its own history MODIS reads ‘' + say(f.older.word).toLowerCase() + '’; our record is unreliable here.';
      else { const when = f.isMonth && !f.partial ? MONTHS[moOf(f.ym) - 1] : 'these dates';   // finding 2: the true reason, once
        lead += ' ' + (o.tooFew && f.older.tooFew && o.why === 'small' && f.older.why === 'small' ? 'Both counts are too small to judge.' :
          o.tooFew && f.older.tooFew && o.why === f.older.why ? heldBack(o, 'Our count', when) :
          [o.tooFew ? heldBack(o, 'Our count', when) : null, f.older.tooFew ? heldBack(f.older, 'MODIS\'s count', when) : null].filter(Boolean).filter((x, i, a) => a.indexOf(x) === i).join(' ')); }
      parts.push(lead);
    } else if (o.tooFew) parts.push(f.place + ', ' + f.periodLabel + prov + ': ' + unit(o.value) + (o.typical === null ? ' (no typical: too few other years)' : ' against a typical ' + fmt(o.typical)) + (o.why === 'usual' ? ': too small a usual for a reliable comparison.' : o.why === 'years' ? ': too few other years to compare.' : ': too little fire to judge.'));
    else if (o.word && f.olderMissing) parts.push(f.place + ', ' + f.periodLabel + prov + ': ' + unit(o.value) + ' on our record, which reads ‘' + say(o.word).toLowerCase() + '’' + against2(o.typical, sameWhat) + '.');
    else if (o.word) parts.push(f.place + ', ' + f.periodLabel + prov + ': ' + unit(o.value) + ', ' + say(o.word).toLowerCase() + against2(o.typical, sameWhat) + '.');
    else parts.push(f.place + ', ' + f.periodLabel + prov + ': ' + unit(o.value) + against2(o.typical, sameDates) + '.');
    const s = score(r);
    if (o.weak) parts.push(o.weak);
    else if (f.partial) parts.push(partialLine(r));   // an unfinished month never carries the whole-month score
    else if (s.rule === 'twelve') parts.push('In whole past months here, our record typically landed within about ' + pct(s.typicalPct) + '% of MODIS\'s own count.');
    else if (s.rule === 'one') parts.push('This place is translated with one number for the whole year, the rule behind our worst misses; treat the count with care.');
    else parts.push('No fair test score exists for this place.');
    parts.push('Counts are detections: 5 km patches of ground where a satellite detected fire, once per day; not individual fires or land burned. Source: NASA FIRMS.');
    return parts.join(' ');
  }

  // ---------- the monthly table (coordinator's column list; counts UNROUNDED, missing fields empty) ----------
  const TABLE_COLUMNS = ['ym', 'value', 'status', 'days', 'carrier', 'translated', 'earlier_camera', 'handed_over', 'Terra', 'Aqua', 'SNPP', 'NOAA20', 'tested_miss_pct', 'rule'];
  // each camera's own count for a month row; a month the engine calls "no data" (no rows of any kind here) gives empty, never 0
  // each camera's own count for a month row: empty where that camera has no row in the country file (never 0); a row of 0 is a real 0.
  // Without loaded availability it falls back to blanking months the engine calls "no data".
  function ownCounts(x, r) {
    const av = !!(r && r.availability), blank = !x || (!av && x.status === 'no_data');
    const g = (k) => blank || !x.raw || x.raw[k] === null || x.raw[k] === undefined || (av && !hasRow(r, k, x.ym)) ? null : x.raw[k];
    return { Terra: g('Terra'), Aqua: g('Aqua'), SNPP: g('SNPP'), NOAA20: g('NOAA20') };
  }
  function tableRows(r) {
    const s = score(r), cell = (v) => v === null || v === undefined ? '' : v;
    return r.monthly.map(x => { const c = ownCounts(x, r); return [x.ym, cell(x.value), x.status + (isProvisional(r, x.ym) ? ' provisional' : ''),
      cell(x.days), x.value === null ? '' : cell(x.carrier), x.value === null ? '' : (x.translated ? 'yes' : 'no'), x.first_camera ? 'yes' : 'no', x.handed_over ? 'yes' : 'no',
      cell(c.Terra), cell(c.Aqua), cell(c.SNPP), cell(c.NOAA20), cell(s.typicalPct), s.rule]; });
  }
  // the table's header: on VIIRS's scale (unit switch) the two scaled columns say so; on MODIS's scale exactly TABLE_COLUMNS
  function tableColumns(r) { return r && r.unit ? TABLE_COLUMNS.map(c => c === 'value' ? 'value_on_viirs_scale' : c === 'Aqua' ? 'Aqua_on_viirs_scale' : c) : TABLE_COLUMNS; }
  function csv(r) {
    const esc = (v) => { const t = String(v); return /[",\n]/.test(t) ? '"' + t.replace(/"/g, '""') + '"' : t; };
    return [tableColumns(r).join(',')].concat(tableRows(r).map(rw => rw.map(esc).join(','))).join('\n') + '\n';
  }

  // ---------- the unit switch: MODIS's scale / VIIRS's scale (built Nov 14; OFF by default, see UNIT_SWITCH in js/app.js) ----------
  // VIIRS's scale is the reverse-join research's "up-mirror" (round_SAT/reverse_join/REVERSE_JOIN.md, Q1 and Q3): every count of our record
  // divided by that month of the year's conversion number (factors.SNPP.f: S-NPP onto MODIS Aqua, learned 2012 to 2021). A month carried by
  // NOAA-20 was shipped as f x g x NOAA-20, so it comes out as g x NOAA-20, i.e. on S-NPP's scale; a Terra month (to mid-2002) stacks both
  // conversions. MODIS's own counts are divided by the same number so the two records stay side by side. One number per month of the year
  // cancels in "against the usual", so every MONTH reads the same on both scales; yearly totals re-weight the months and can read differently.
  // No new engine arithmetic: the engine's own result, divided. A month whose number is 0 or missing has no count on this scale.
  const SCALE_NAMES = { modis: 'MODIS\'s scale', viirs: 'VIIRS\'s scale' };
  const SCALE_LINE = 'The same record, counted the way the newer camera counts.';
  const SCALE_PAST = 'Before 2012 these are estimates of what a camera like VIIRS would have counted; none flew then to check them.';
  function scaleCheck(r) {
    const F = r && r.factors && r.factors.SNPP;
    if (r && Array.isArray(r.monthly) && !r.latest && !r.current) return { ok: false, why: 'Only on MODIS\'s scale here: this place has no usable month in the record.' };
    if (!F || F.mode === 'none' || !Array.isArray(F.f) || !F.f.some(v => v !== null && isFinite(v) && v > 0))
      return { ok: false, why: 'Only on MODIS\'s scale here: this place has no conversion numbers of its own (it uses the curve shared by the whole world), so there is nothing to run backward.' };
    if (r.method && r.method !== 'plain') return { ok: false, why: 'Only on MODIS\'s scale with the experimental method.' };
    return { ok: true, why: null };
  }
  const scaled = (typeof WeakMap !== 'undefined') ? new WeakMap() : null;
  function onScale(r, scale) {
    if (scale !== 'viirs' || !r) return r;
    if (!scaleCheck(r).ok) return null;
    if (scaled && scaled.has(r)) return scaled.get(r);
    const f = r.factors.SNPP.f, divOf = (ym) => { const d = f[moOf(ym) - 1]; return d !== null && d !== undefined && isFinite(d) && d > 0 ? d : null; };
    const dv = (v, d) => v === null || v === undefined ? v : d === null ? null : v / d;
    const av = r.availability; delete r.availability;
    let c; try { c = JSON.parse(JSON.stringify(r)); } finally { r.availability = av; }
    c.availability = av;
    const ROWSTATS = ['value', 'median', 'average', 'p10', 'p25', 'p75', 'p90', 'min_other', 'max_other'];
    for (const x of c.monthly) {
      const d = divOf(x.ym);
      for (const k of ROWSTATS) if (k in x) x[k] = dv(x[k], d);
      if (Array.isArray(x.range)) x.range = x.range.map(v => dv(v, d));
      if (x.raw && x.raw.Aqua !== null && x.raw.Aqua !== undefined) x.raw.Aqua = dv(x.raw.Aqua, d);
      if (d === null && x.status === 'final') { x.status = 'no_scale'; x.no_scale = true; x.value = null; }
      x._viirs = true;
    }
    const rowOf = {}; for (const x of c.monthly) rowOf[x.ym] = x;
    const yr = (ym) => +ym.slice(0, 4), inB = (y) => !c.baseline || (y >= c.baseline[0] && y <= c.baseline[1]);
    if (c.current) {
      const cu = c.current, d = divOf(cu.ym), k0 = moOf(cu.ym) - 1;
      for (const k of ['value', 'median', 'average', 'p10', 'p25', 'p75', 'p90', 'min_other', 'max_other', 'check_same_file_value']) if (k in cu) cu[k] = dv(cu[k], d);
      if (cu.raw && cu.raw.Aqua !== null && cu.raw.Aqua !== undefined) cu.raw.Aqua = dv(cu.raw.Aqua, d);
      for (const s of cu.same_days || []) { s.value = dv(s.value, d); if (s.raw && s.raw.Aqua !== null && s.raw.Aqua !== undefined) s.raw.Aqua = dv(s.raw.Aqua, d); }
      // the year so far, date for date, re-added on this scale
      const sumTo = (y, last) => { if (last === null || last === undefined) return null; let t = last;
        for (let k = 0; k < k0; k++) { const x = rowOf[ymOf(y, k + 1)]; if (!x || x.status !== 'final') return null; t += x.value; } return t; };
      if (cu.year_so_far) {
        cu.year_so_far.value = sumTo(yr(cu.ym), cu.value);
        cu.year_so_far.others = (cu.same_days || []).map(s => ({ year: s.year, value: sumTo(s.year, s.value) }));
        cu.year_so_far.typical = median(cu.year_so_far.others.filter(o => o.value !== null && inB(o.year)).map(o => o.value));
      }
    }
    // whole years, re-added on this scale (a year with a month that has no count on this scale has no total)
    for (const t of c.year_totals) {
      const ys = c.monthly.filter(x => yr(x.ym) === t.year), ok = ys.filter(x => x.status === 'final');
      let s = 0; for (const x of ok) s += x.value;
      t.total = ok.length === 12 ? s : null; t.months_so_far_total = ok.length && ok.length < 12 ? s : null; t.months_counted = ok.length; t.complete = ok.length === 12;
    }
    const comp = c.year_totals.filter(t => t.complete);
    for (const t of c.year_totals) t.typical_other = median(comp.filter(o => o !== t && inB(o.year)).map(o => o.total));
    let by = null; for (const t of comp) if (!by || t.total > by.total) by = t;
    c.busiest_year = by && { year: by.year, total: by.total };
    const fin = c.monthly.filter(x => x.status === 'final');
    let bm = null; for (const x of fin) if (!bm || x.value > bm.value) bm = x;
    c.busiest_month = bm && { ym: bm.ym, value: bm.value };
    if (c.latest) { const d = divOf(c.latest.ym); for (const k of ['value', 'median', 'average']) c.latest[k] = dv(c.latest[k], d); }
    const moy = []; for (let k = 1; k <= 12; k++) { const kk = (k < 10 ? '0' : '') + k; moy.push(median(fin.filter(x => x.ym.slice(5) === kk).map(x => x.value))); }
    c.month_of_year_medians = moy;
    // the season, by the engine's own rule (months around the peak whose median is at least a third of the peak's), on this scale
    let pk = 0; for (let k = 1; k < 12; k++) if ((moy[k] || 0) > (moy[pk] || 0)) pk = k;
    if (moy[pk] > 0) { const thr = moy[pk] / 3, inS = new Uint8Array(12); inS[pk] = 1; let a = pk, n = 0;
      while (n < 11 && moy[(a + 11) % 12] >= thr) { a = (a + 11) % 12; inS[a] = 1; n++; } let z = pk; n = 0; while (n < 11 && moy[(z + 1) % 12] >= thr) { z = (z + 1) % 12; inS[z] = 1; n++; }
      c.season = Object.assign({}, c.season || {}, { about_start: a + 1, about_end: z + 1 }); c.peak_month_of_year = pk + 1;
      let two = false; for (let k = 0; k < 12; k++) if (!inS[k] && moy[k] >= moy[pk] / 2 && moy[k] >= moy[(k + 11) % 12] && moy[k] >= moy[(k + 1) % 12]) two = true; c.two_seasons = two; }
    if (c.after_2021) { let j = 0, a2 = 0; for (const x of fin) { if (x.ym < '2022-01' || x.ym >= '2026-01' || x.carrier === 'Aqua' || !x.raw || x.raw.Aqua === null) continue; j += x.value; a2 += x.raw.Aqua; }
      c.after_2021.joined_total = j; c.after_2021.aqua_total = a2; c.after_2021.total_pct = a2 ? (j / a2 - 1) * 100 : null; }
    c.unit = { scale: 'viirs', base: r };
    if (scaled) scaled.set(r, c);
    return c;
  }
  // the same period on MODIS's scale, for the floor (gatedWord, feel): { value, typical, pool }
  function gateOf(r, p) {
    const b = r.unit.base; let ab; try { ab = A.answer(b, p); } catch (e) { return null; }
    if (A.isRefusal(ab)) return null;
    return { value: ab.value, typical: ab.typical, pool: ab.others.filter(o => o.value !== null && inBase(b, o.year)).map(o => o.value) };
  }
  // the tail a copied sentence carries on VIIRS's scale; before 2012 it says the counts are an estimate
  function scaleTail(r, sel) {
    const f = forPeriod(r, sel); if (f.refusal) return '';
    const first = f.isMonth ? f.ym : f.kind === 'season' && f.season ? f.season.start : ymOf(f.year, 1);
    return first < '2012-01' ? " Counts are on VIIRS's scale: an estimate of what a camera like VIIRS would have counted, scaled up from MODIS." : " Counts are on VIIRS's scale.";
  }
  // one small line when a yearly statement differs between the scales (null when it reads the same)
  function scaleNote(rv, sel) {
    if (!rv || !rv.unit) return null;
    const b = rv.unit.base, other = 'On MODIS\'s scale';
    if (sel === 'years') { const a = recordCheck(rv), c = recordCheck(b);
      const ta = a.top ? a.top.year : null, tc = c.top ? c.top.year : null;
      return ta !== tc || a.ok !== c.ok ? other + ': ' + (yearsLine(b) || 'no busiest year is named.') : null; }
    if (!sel || sel.month !== undefined || sel === 'latest') return null;   // a month reads the same on both scales
    const fv = forPeriod(rv, sel), fb = forPeriod(b, sel);
    if (fv.refusal || fb.refusal) return null;
    const wv = fv.lead === 'ours' ? fv.ours.word : fv.lead === 'modis' ? fv.older.word : null, wb = fb.lead === 'ours' ? fb.ours.word : fb.lead === 'modis' ? fb.older.word : null;
    return wv !== wb ? other + ' the same stretch reads ' + (wb ? lower1(say(wb)) : 'with no verdict') + '; each camera weights the months of the year differently.' : null;
  }

  // finding 1 (afternoon word check): on VIIRS's scale, MODIS's figures are MODIS's counts converted to VIIRS's scale, so they are labelled that way
  const VIIRS_WORDS = [
    [/MODIS alone: /g, 'MODIS, converted to VIIRS\'s scale: '], [/MODIS alone says the same\./g, 'MODIS, converted to VIIRS\'s scale, says the same.'],
    [/MODIS alone counted /g, 'MODIS, converted to VIIRS\'s scale, counted '],
    [/MODIS, NASA's older camera, counted on its own,/g, 'MODIS, NASA\'s older camera, converted to VIIRS\'s scale,'],
    [/NASA's older MODIS camera, counted on its own,/g, 'NASA\'s older MODIS camera, converted to VIIRS\'s scale,'],
    [/going by NASA's older MODIS camera counted on its own/g, 'going by NASA\'s older MODIS camera'],
    [/MODIS, NASA's older camera, counted ([\d,]+|under 1) on its own/g, 'MODIS, NASA\'s older camera, counted $1 converted to VIIRS\'s scale'],
    [/against its own historical median/g, 'against its historical median on that scale'],
    [/MODIS's own count/g, 'MODIS\'s count'], [/MODIS has no count of its own/g, 'MODIS has no count']];
  function viirsWords(v) {
    if (typeof v === 'string') { let t = v; for (const [a, b] of VIIRS_WORDS) t = t.replace(a, b); return t; }
    if (Array.isArray(v)) return v.map(viirsWords);
    if (v && typeof v === 'object' && !v.monthly && !(v.unit && typeof v.unit === 'object')) { const o = {}; for (const k in v) o[k] = k === 'f' || k === '_gate' ? v[k] : viirsWords(v[k]); return o; }
    return v;
  }
  // a month's recipe on VIIRS's scale: what the number now is, not how the MODIS-scale number was made
  function howCountedViirs(x) {
    if (!x || x.value === null) return null;
    const mo = MONTHS[moOf(x.ym) - 1];
    if (x.carrier === 'SNPP') return 'VIIRS on S-NPP\'s own count.';
    if (x.carrier === 'NOAA20') return 'VIIRS on NOAA-20, adjusted to S-NPP\'s scale.';
    if (x.carrier === 'Aqua') return 'MODIS on Aqua\'s count, converted to VIIRS\'s scale with this country\'s number for ' + mo + ' (an estimate: learned from 2012 to 2021, when both cameras flew).';
    if (x.carrier === 'Terra') return 'MODIS on Terra\'s count, put on Aqua\'s scale and then converted to VIIRS\'s scale (an estimate).';
    return null;
  }
  const isV = (a) => !!(a && (a.unit || a.scale === 'viirs' || a._viirs));
  const wrapV = (fn) => function (a) { const out = fn.apply(this, arguments); return isV(a) ? viirsWords(out) : out; };
  const howCountedAny = (x) => x && x._viirs ? howCountedViirs(x) : howCounted(x);
  const api = { onScale, scaleCheck, scaleNote, tableColumns, SCALE_NAMES, SCALE_LINE, SCALE_PAST, feelFits, rankWords, clash, FITS, olderSeasonSum, gapWords, yearsLine, weakPlain, howCounted, monthPanel, yearSay, inSentence, recordName, refusalLine, screenLabel, pictureCaption, pastLine, loadAvailability, hasRow: (r, cam, ym) => hasRow(r, cam, ym), aboutUnit, weakLineFor, partialLine, forPeriod, score, yearly, series, gluedCaption, afterGaps, cameraName, recordWord, recordCheck, recordLine, sentence, displayName, fmt, unit, weakLine, olderYearTotal,
    tableRows, csv, ownCounts, TABLE_COLUMNS, MONTHS,
    modisMonth, feel, say, periodWords, shortSentence, screen, seriesFor, answerLine, feltLine, modisLine, happeningLine, smallPrint, tooLittleLine, positions, lastSeason, seasonMonths: seasonMonthsOf, seasonYms,
    seasonSum: (r, y, older) => older ? olderSeasonSum(r, y) : seasonSum(r, y, x => x.value), olderSeason, detections, UNIT_SENTENCE, EARLY_TIP, earlyTip, recordYears, amountOf, itsFeel, pctWords, PROVISIONAL_LABEL, PROVISIONAL_FROM, isProvisional: (r, ym) => isProvisional(r, ym), TOO_FEW, numberWord, version: 'readings-2026-11-14-voice' };
  // the word wrappers for VIIRS's scale (finding 1); on MODIS's scale every function returns exactly what it did
  for (const k of ['screen', 'monthPanel', 'yearSay', 'sentence', 'shortSentence', 'answerLine', 'feltLine', 'modisLine', 'smallPrint', 'tooLittleLine', 'weakPlain', 'weakLineFor', 'happeningLine', 'pastLine', 'yearsLine'])
    if (typeof api[k] === 'function') api[k] = wrapV(api[k]);
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.Readings = api;
})(typeof window !== 'undefined' ? window : globalThis);
