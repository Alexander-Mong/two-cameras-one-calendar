/* Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md. */
// Made Nov 13, 2026 by an AI agent (Claude) for this NASA Space Apps team. License: Apache-2.0 (the event's default), pending the team lead's choice.
// Pencil. Credit: The team lead directed and reviewed it as it was built; a second AI model family independently reproduced the main numbers and read the code, without redoing NASA's data extraction; no outside expert in satellite fire data has reviewed it. Part F1. adapters.js turns HSEngine answers into EXACTLY the shapes in ../PARTS_CONTRACT.md:
//   Answer, YearShape, Calendar, YearTotals, Stitched, HiddenYear (from an engine result) and TwoCameras (from data/two_cameras/*.json).
// Runs unchanged in a browser (script tag -> window.HSAdapters) and in Node (require). No engine calls here: pass in a result.
// null always means "no data", never zero. Values are unrounded; round for display only.
// An adapter NEVER throws: when there is nothing honest to show it returns a refusal { refused: CODE, message } (see REFUSALS.md).
// "Typical" pools use the SAME baseline years as the engine call (result.baseline; null = every year), the judged year always left out.
//
// THE ONE RULE for the verdict word (every page says the same thing):
//   pool = the same period in the other years within the baseline (an unfinished month: the same days of that month; the year so far:
//   the same dates; a year: the other complete years). If the typical value (the middle of the pool) is under 16 lit squares, or the pool
//   has fewer than 5 years: "too few to call". Otherwise p = (years below + half the years equal) / years in the pool, and
//   p < 0.10 "much quieter" | p < 0.30 "quieter" | p <= 0.70 "about usual" | p <= 0.90 "busier" | p > 0.90 "much busier".
// THE ONE RULE for the comparison sentence:
//   no typical or fewer than 5 years -> "Too few other years to compare with a typical X."
//   value OR typical under 16 -> the two counts in plain words, no percent or fraction: "1 lit square this February, against a typical 33."
//   both 16 or more, ratio r = value / typical: within 5% -> "About the same as a typical X."; r < 0.6 -> "About <share> of a typical X.";
//   r < 1 -> "About <part> less than a typical X."; r >= 1.95 -> "About <n> times a typical X."; else "About <part> more than a typical X."
//   <part>/<share> is a tenth, a fifth, a quarter, a third, half, two thirds or three quarters when within 2.5 points, else a percent rounded to 5.
(function (root) {
  'use strict';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const UNIT_NAME = 'lit squares';
  const UNIT_NOTE = 'Squares about 5 km wide; a square with at least one detected hot spot on a day counts once that day.';
  const TOO_FEW = 16, MIN_YEARS = 5;
  const YM = /^(\d{4})-(0[1-9]|1[0-2])$/;

  function median(a) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
  function quantile(a, q) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), p = (s.length - 1) * q, lo = Math.floor(p), hi = Math.min(lo + 1, s.length - 1); return s[lo] + (s[hi] - s[lo]) * (p - lo); }
  // ---------- refusals ----------
  class Refuse extends Error { constructor(code, msg) { super(msg); this.code = code; } }
  const refusal = (code, message) => ({ refused: code, message });
  const isRefusal = (o) => !!o && typeof o === 'object' && typeof o.refused === 'string';
  // every public adapter goes through this: typed errors become refusals; anything unexpected becomes ADAPTER_ERROR, never a throw
  function guard(fn) { return function () { try { return fn.apply(null, arguments); } catch (e) {
    return e && e.code ? refusal(e.code, e.message) : refusal('ADAPTER_ERROR', 'the adapter could not build this shape: ' + (e && e.message)); } }; }
  function needResult(res) { if (!res || !Array.isArray(res.monthly) || !Array.isArray(res.year_totals)) throw new Refuse('BAD_REQUEST', 'pass an engine result (HSEngine.query) as the first argument'); }
  function needUsable(res) { needResult(res); if (!res.monthly.some(r => r.value !== null)) throw new Refuse('NO_USABLE_MONTHS', placeOf(res) + ' has no month with usable data in this record, so there is nothing to show'); }
  function needYear(res, y) {
    if (!Number.isInteger(y)) throw new Refuse('BAD_REQUEST', 'a year is a whole number, for example 2025 (got ' + JSON.stringify(y) + ')');
    if (y < firstYear(res) || y > lastYear(res)) throw new Refuse('OUT_OF_COVERAGE', y + ' is outside this record (' + res.record_starts + ' to ' + res.record_ends + ')');
  }
  const yOf = (ym) => +ym.slice(0, 4), moOf = (ym) => +ym.slice(5, 7);
  const ymOf = (y, mo) => y + '-' + (mo < 10 ? '0' : '') + mo;
  const placeOf = (res, o) => (o && o.place) || (res && res.area && res.area.country) || 'Drawn area';
  const lastYear = (res) => yOf(res.record_ends), firstYear = (res) => yOf(res.record_starts);
  const inBase = (res, y) => !res.baseline || (y >= res.baseline[0] && y <= res.baseline[1]);

  // ---------- the shared rules ----------
  function percentile(value, pool) { if (value === null || !pool.length) return null; let below = 0, eq = 0; for (const v of pool) { if (v < value) below++; else if (v === value) eq++; } return (below + eq / 2) / pool.length; }
  function verdict(value, pool) {
    const typical = median(pool);
    if (value === null || typical === null || typical < TOO_FEW || pool.length < MIN_YEARS) return 'too few to call';
    const p = percentile(value, pool);
    return p < 0.10 ? 'much quieter' : p < 0.30 ? 'quieter' : p <= 0.70 ? 'about usual' : p <= 0.90 ? 'busier' : 'much busier';
  }
  const PARTS = [[0.1, 'a tenth'], [0.2, 'a fifth'], [0.25, 'a quarter'], [1 / 3, 'a third'], [0.5, 'half'], [2 / 3, 'two thirds'], [0.75, 'three quarters']];
  function partWord(x) { for (const [v, w] of PARTS) if (Math.abs(x - v) <= 0.025) return w; return Math.round(x * 20) * 5 + '%'; }
  function count(v, unit) { const r = Math.round(v); const n = v > 0 && r === 0 ? 'under 1' : r.toLocaleString('en-US');
    return unit ? n + (r === 1 && n === '1' ? ' lit square' : ' lit squares') : n; }
  const cap = (s) => s.charAt(0).toUpperCase() + s.slice(1);
  function comparison(value, pool, what) {
    const typical = median(pool);
    if (value === null) return 'No data for this ' + what + '.';
    if (typical === null || pool.length < MIN_YEARS) return 'Too few other years to compare with a typical ' + what + '.';
    if (value < TOO_FEW || typical < TOO_FEW) return cap(count(value, true)) + ' this ' + what + ', against a typical ' + count(typical, false) + '.';
    const r = value / typical;
    if (Math.abs(r - 1) < 0.05) return 'About the same as a typical ' + what + '.';
    if (r < 0.6) return 'About ' + partWord(r) + ' of a typical ' + what + '.';
    if (r < 1) return 'About ' + partWord(1 - r) + ' less than a typical ' + what + '.';
    if (r >= 1.95) { const n = Math.round(r * 2) / 2; return 'About ' + (n === 2 ? 'twice' : n + ' times') + ' a typical ' + what + '.'; }
    return 'About ' + partWord(r - 1) + ' more than a typical ' + what + '.';
  }

  // ---------- pools from an engine result (baseline honored) ----------
  function monthRow(res, ym) { return res.monthly.find(r => r.ym === ym) || null; }
  function partialYear(res) { return res.current ? yOf(res.current.ym) : null; }
  function monthOthers(res, y, mo) {   // the same month in every other year (final months only; a partial month is not the same period)
    const out = [];
    for (let yy = firstYear(res); yy <= lastYear(res); yy++) { if (yy === y) continue; const r = monthRow(res, ymOf(yy, mo));
      if (!r || r.status === 'partial') continue; out.push({ year: yy, value: r.status === 'final' ? r.value : null }); }
    return out;
  }
  function partialOthers(res) { return res.current.same_days.filter(o => o.year !== partialYear(res)).map(o => ({ year: o.year, value: o.value })); }
  const poolOf = (res, others) => others.filter(o => o.value !== null && inBase(res, o.year)).map(o => o.value);
  function monthPool(res, y, mo) { const r = monthRow(res, ymOf(y, mo)); return poolOf(res, r && r.status === 'partial' ? partialOthers(res) : monthOthers(res, y, mo)); }
  function completeTotals(res) { return res.year_totals.filter(t => t.complete); }
  const baseNote = (res) => res.baseline ? ' Typical uses ' + res.baseline[0] + ' to ' + res.baseline[1] + ' only.' : '';

  // ---------- Answer ----------
  // period: 'latest' (default: the unfinished month if there is one, else the newest finished month) | {month:'YYYY-MM'} | {year:YYYY}
  function answer(res, period, o) {
    needUsable(res); period = period || 'latest';
    const place = placeOf(res, o);
    if (period === 'latest') { const ym = res.current ? res.current.ym : res.latest ? res.latest.ym : null;
      if (!ym) throw new Refuse('NO_USABLE_MONTHS', place + ' has no finished month with usable data'); period = { month: ym }; }
    if (typeof period !== 'object') throw new Refuse('BAD_REQUEST', "period must be 'latest', {month:'YYYY-MM'} or {year:YYYY}");
    if (period.month !== undefined) {
      const ym = period.month;
      if (typeof ym !== 'string' || !YM.test(ym)) throw new Refuse('BAD_REQUEST', 'a month is written YYYY-MM, for example 2025-12 (got ' + JSON.stringify(ym) + ')');
      if (ym < res.record_starts || ym > res.record_ends) throw new Refuse('OUT_OF_COVERAGE', ym + ' is outside this record (' + res.record_starts + ' to ' + res.record_ends + ')');
      const r = monthRow(res, ym), y = yOf(ym), mo = moOf(ym);
      if (r.status === 'partial') {
        const last = +res.current.last_day.slice(8, 10), what = MONTHS[mo - 1] + ' 1–' + last;
        const others = partialOthers(res), pool = poolOf(res, others);
        return { place, periodLabel: what + ', ' + y, daysNote: 'Days 1–' + last + ' only (the data ends ' + MONTHS[mo - 1] + ' ' + last + ', ' + y + '); compared with ' + what + ' of every other year.' + baseNote(res),
          value: r.value, typical: median(pool), unitName: UNIT_NAME, unitNote: UNIT_NOTE, verdict: verdict(r.value, pool), comparison: comparison(r.value, pool, what), others };
      }
      const others = monthOthers(res, y, mo), pool = poolOf(res, others);
      const value = r.status === 'final' ? r.value : null;
      return { place, periodLabel: MONTHS[mo - 1] + ' ' + y, daysNote: res.baseline ? baseNote(res).trim() : null, value, typical: median(pool), unitName: UNIT_NAME, unitNote: UNIT_NOTE,
        verdict: verdict(value, pool), comparison: comparison(value, pool, MONTHS[mo - 1]), others };
    }
    if (period.year !== undefined) {
      const y = period.year; needYear(res, y);
      if (y === partialYear(res)) {   // the year so far, date for date
        const ys = res.current.year_so_far, mo = moOf(res.current.ym), d = +res.current.last_day.slice(8, 10);
        const others = ys.others.filter(x => x.year !== y), pool = poolOf(res, others);
        const what = 'January 1 to ' + MONTHS[mo - 1] + ' ' + d;
        return { place, periodLabel: y + ' so far (' + what + ')', daysNote: 'The year is not finished; compared with ' + what + ' of every other year.' + baseNote(res),
          value: ys.value, typical: median(pool), unitName: UNIT_NAME, unitNote: UNIT_NOTE, verdict: verdict(ys.value, pool), comparison: comparison(ys.value, pool, what), others };
      }
      const t = res.year_totals.find(x => x.year === y);
      const others = res.year_totals.filter(x => x.year !== y && x.year !== partialYear(res)).map(x => ({ year: x.year, value: x.complete ? x.total : null }));
      const pool = poolOf(res, others);
      const value = t && t.complete ? t.total : null;
      return { place, periodLabel: String(y), daysNote: value === null ? 'Not a complete year in this record, so it has no total.' + baseNote(res) : (res.baseline ? baseNote(res).trim() : null), value, typical: median(pool),
        unitName: UNIT_NAME, unitNote: UNIT_NOTE, verdict: verdict(value, pool), comparison: comparison(value, pool, 'year'), others };
    }
    throw new Refuse('BAD_REQUEST', "period must be 'latest', {month:'YYYY-MM'} or {year:YYYY}");
  }

  // ---------- YearShape ----------
  function seasonMonths(res) {
    if (!res.season) return []; const out = []; let k = res.season.about_start;
    for (let i = 0; i < 12; i++) { out.push(k); if (k === res.season.about_end) break; k = k % 12 + 1; }
    return out;
  }
  function yearShape(res, year, o) {
    needUsable(res);
    const y = year === undefined ? lastYear(res) : year; needYear(res, y);
    const months = []; let unfinished = null;
    for (let mo = 1; mo <= 12; mo++) {
      const r = monthRow(res, ymOf(y, mo)), pool = monthPool(res, y, mo);
      const value = r && (r.status === 'final' || r.status === 'partial') ? r.value : null;
      if (r && r.status === 'partial') unfinished = { m: mo, days: [1, +res.current.last_day.slice(8, 10)] };
      months.push({ m: mo, value, typical: median(pool), lowHalf: quantile(pool, 0.25), highHalf: quantile(pool, 0.75), translated: value !== null && r.carrier !== 'Aqua' });
    }
    return { place: placeOf(res, o), year: y, months, unfinished, seasonMonths: seasonMonths(res), peakMonth: res.peak_month_of_year };
  }

  // ---------- Calendar ----------
  function calendar(res, o) {
    needUsable(res);
    const years = [], cells = [], rank = [], yearTotals = [];
    for (let y = firstYear(res); y <= lastYear(res); y++) {
      years.push(y); const row = [], rk = [];
      for (let mo = 1; mo <= 12; mo++) {
        const r = monthRow(res, ymOf(y, mo)), v = r && (r.status === 'final' || r.status === 'partial') ? r.value : null;
        row.push(v); rk.push(v === null ? null : percentile(v, monthPool(res, y, mo)));
      }
      cells.push(row); rank.push(rk);
      const t = res.year_totals.find(x => x.year === y); yearTotals.push(t && t.complete ? t.total : null);
    }
    return { place: placeOf(res, o), years, cells, rank, translatedFrom: { firstCameraUntil: '2002-06', newerFrom: '2022-01' }, yearTotals };
  }

  // ---------- YearTotals ----------
  // judgedYear (default: the newest complete year) is the year whose "typical" is given: the middle of the OTHER complete years in the baseline.
  function fmt(n) { return Math.round(n).toLocaleString('en-US'); }
  function needCompleteYear(res) { needUsable(res); if (!completeTotals(res).length) throw new Refuse('NO_COMPLETE_YEARS', placeOf(res) + ' has no complete year with usable data in this record, so there are no year totals to show'); }
  function yearTotals(res, judgedYear, o) {
    needCompleteYear(res);
    const comp = completeTotals(res);
    const jy = judgedYear === undefined ? comp[comp.length - 1].year : judgedYear; needYear(res, jy);
    const years = [], totals = [];
    for (const t of res.year_totals) { years.push(t.year); totals.push(t.complete ? t.total : null); }
    const typical = median(comp.filter(t => t.year !== jy && inBase(res, t.year)).map(t => t.total));
    const notes = [];
    const inc = res.year_totals.filter(t => !t.complete).map(t => t.year);
    if (inc.length) notes.push('No total for ' + (inc.length > 3 ? inc.length + ' years' : inc.join(' and ')) + ': not complete years in this record.');
    if (res.baseline) notes.push(baseNote(res).trim());
    const ry = comp.filter(t => t.year >= 2022).map(t => t.year).pop();   // recent years: the joined count against the older camera's own count
    if (ry !== undefined) {
      let j = 0, a = 0, ok = true;
      for (let mo = 1; mo <= 12; mo++) { const r = monthRow(res, ymOf(ry, mo)); if (!r || r.raw.Aqua === null) { ok = false; break; } j += r.value; a += r.raw.Aqua; }
      if (ok && a > 0) { const pct = (j / a - 1) * 100;
        if (Math.abs(pct) >= 3) notes.push('Recent years lean on the translation: ' + ry + ' reads about ' + Math.round(Math.abs(pct)) + '% ' + (pct < 0 ? 'below' : 'above') +
          ' the older camera\'s own count here (' + fmt(j) + ' against ' + fmt(a) + ').'); }
    }
    return { place: placeOf(res, o), years, totals, typical, busiest: { year: res.busiest_year.year, value: res.busiest_year.total }, note: notes.length ? notes.join(' ') : null };
  }

  // ---------- Stitched ----------
  // translated = the joined yearly totals; stitched = the same years with each month's camera's OWN count, untranslated (the line that jumps).
  function stitched(res, o) {
    needCompleteYear(res);
    const years = [], translated = [], stitchedV = [];
    for (const t of res.year_totals) {
      years.push(t.year); translated.push(t.complete ? t.total : null);
      if (!t.complete) { stitchedV.push(null); continue; }
      let s = 0; for (let mo = 1; mo <= 12; mo++) { const r = monthRow(res, ymOf(t.year, mo)); s += r.raw[r.carrier]; }
      stitchedV.push(s);
    }
    return { place: placeOf(res, o), years, translated, stitched: stitchedV, handoverYear: 2022 };
  }

  // ---------- HiddenYear ----------
  // year (default): the newest year in the newer camera's learning span (2012-2021) with all 12 months tested and no month in which either camera
  // sent far less than usual worldwide on more than 3 days. Guesses come from factors learned with that whole year hidden.
  function hiddenYear(res, year, o) {
    needUsable(res);
    const hy = res.hide_a_year && res.hide_a_year.SNPP, pairs = (hy && hy.pairs) || [];
    if (!hy || hy.typical_pct === null || hy.typical_pct === undefined) throw new Refuse('TOO_FEW_TESTED_MONTHS', placeOf(res) + ': fewer than 24 months could be hidden and guessed here, so there is no fair score');
    let y = null;
    if (year !== undefined) { if (!Number.isInteger(year) || year < 2012 || year > 2021) throw new Refuse('OUT_OF_COVERAGE', 'the hidden-year test covers 2012 to 2021 (got ' + JSON.stringify(year) + ')'); y = year; }
    else for (let yy = 2021; yy >= 2012; yy--) {
      const ps = pairs.filter(p => yOf(p.ym) === yy);
      const weak = res.monthly.some(r => yOf(r.ym) === yy && (r.older_low_days > 3 || r.newer_low_days > 3));
      if (ps.length === 12 && !weak) { y = yy; break; }
    }
    if (y === null) throw new Refuse('TOO_FEW_TESTED_MONTHS', placeOf(res) + ': no year in 2012 to 2021 has all twelve months tested here');
    const months = [];
    for (let mo = 1; mo <= 12; mo++) { const p = pairs.find(q => q.ym === ymOf(y, mo)); months.push({ m: mo, guess: p ? p.predicted : null, actual: p ? p.aqua : null }); }
    return { place: placeOf(res, o), year: y, months, typicalMissPct: hy.typical_pct, oneInTenPct: hy.nine_in_ten_pct, methodName: res.method_label };
  }

  // ---------- TwoCameras (from the small extract; no engine) ----------
  function twoCameras(x) {
    if (!x || !x.older || !x.newer || !Array.isArray(x.dates)) throw new Refuse('BAD_REQUEST', 'pass the parsed data/two_cameras/*.json file');
    const d0 = new Date(x.dates[0] + 'T00:00:00Z'), d1 = new Date(x.dates[1] + 'T00:00:00Z');
    const label = MONTHS[d0.getUTCMonth()] + ' ' + d0.getUTCDate() + ' to ' + (d1.getUTCMonth() === d0.getUTCMonth() ? '' : MONTHS[d1.getUTCMonth()] + ' ') + d1.getUTCDate() + ', ' + d1.getUTCFullYear();
    return { place: x.place, daysLabel: label, cellKm: 5, width: x.width, height: x.height,
      older: { name: 'Aqua (MODIS), the older camera', pixelKm: 1, total: x.older.total, days: x.older.days },
      newer: { name: 'S-NPP (VIIRS), the newer camera', pixelKm: 0.375, total: x.newer.total, days: x.newer.days } };
  }

  const REFUSAL_CODES = ['OUT_OF_COVERAGE', 'BAD_REQUEST', 'NO_USABLE_MONTHS', 'NO_COMPLETE_YEARS', 'TOO_FEW_TESTED_MONTHS', 'ADAPTER_ERROR'];
  const api = { answer: guard(answer), yearShape: guard(yearShape), calendar: guard(calendar), yearTotals: guard(yearTotals), stitched: guard(stitched),
    hiddenYear: guard(hiddenYear), twoCameras: guard(twoCameras), isRefusal, verdict, comparison, percentile, median, REFUSAL_CODES,
    UNIT_NAME, UNIT_NOTE, TOO_FEW, version: 'f1-adapters-2026-11-13b' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HSAdapters = api;
})(typeof window !== 'undefined' ? window : globalThis);
