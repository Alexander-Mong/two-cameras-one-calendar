/* Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md. */
// Made Nov 13, 2026 by an AI agent (Claude) for this NASA Space Apps team. License: Apache-2.0 (the event's default), pending the team lead's choice.
// Pencil. Credit: The team lead directed and reviewed it as it was built; a second AI model family independently reproduced the main numbers and read the code, without redoing NASA's data extraction; no outside expert in satellite fire data has reviewed it. Part F1 (CONSOLIDATE/F_parts/engine_and_data). Runs unchanged in a browser (script tag -> window.HSEngine,
// or import for its side effect -> globalThis.HSEngine) and in Node (require -> module.exports).
// Counts are "lit squares": 0.05-degree squares (about 5 km) with at least one detected hot spot on a UTC day, counted once that day.
//
// F1 changes to demo A's copy (marked "F1:" in the code):
//  F1-a. paths are configurable (default: this part's data/world_by_country/ and data/argentina_2026/); built-in loaders for browser and Node;
//  F1-b. per-place hand-over (builder B's test, as demos C and D adopted it): a month in which the older camera (Aqua) sent far less than usual
//        worldwide on more than 3 days is handed to the newer camera (S-NPP), translated, ONLY if Aqua's own count here divided by the translated
//        S-NPP count is under 0.75 times the same ratio in up to two sound months on either side (both counts at least 16). No evidence = keep Aqua
//        (demo D's choice: missing evidence is not proof of a deficit). Initial factors leave out world-flagged months; final factors leave out
//        only the handed-over months. Demo A only flagged such months; F1 replaces them and flags them (handed_over, translated);
//  F1-c. outside the coverage is refused (HSEngine.month throws an OutOfCoverage error); an unknown country is refused; a drawn area is refused
//        when only the per-country package is loaded;
//  F1-d. "typical year" leaves the judged year out (year_totals[i].typical_other); the engine's old all-years usual_year is removed;
//  F1-e. every month says first_camera (before July 2002), translated (not Aqua's own count), handed_over;
//  F1-f. the unfinished month also gives the year so far, date for date (current.year_so_far).
//  F1-g. (after the second-family check, sol_check) an incomplete year's `total` is null; its finished months' sum is `months_so_far_total`;
//        boxes and outlines must lie on the Earth and in order (else a BAD_AREA refusal); a drawn area touching no data file is refused
//        (NO_DATA_FILES); HSEngine.month takes only a strict YYYY-MM (else BAD_REQUEST). Every refusal is an Error with a `code`.
// Demo A's own change list follows (kept for provenance):
//  1. a carrier month with no rows of any type (country) or no rows anywhere (world, for a box) is "no_data", not 0 (rule 8);
//  2. outline area is orientation-free (ring nesting decides holes), so ranges no longer vanish for a reversed outline;
//  3. "too small alone" totals are whole quarters (all three months) and the year's own complete total, never leftovers;
//  4. no 8-in-10 range for a whole country or a country-sized area (that row failed tests: held 63 to 97%);
//  5. the 2026 extension for Argentina (ext/): months to the data's last day, NOAA-20 carrying from Nov 2026,
//     the unfinished month compared only with the same days of the same month in other years (rule 9);
//  6. an "after 2021" check against Aqua's own counts, and optional baseline years for the usual.
//  7. (second pass) S-NPP months with more than 3 weak days go whole to NOAA-20 (builder B's rule); the S-NPP/NOAA-20 day splice is off by default.
//     Each month also reports low_days (worldwide weak days of its camera) and reads_low (checked in THIS area against a partner camera; see 8).
// Paths: the loader gets paths relative to the demo folder ('layer/...', 'ext/...').
(function (root) {
  'use strict';
  const NMAX = 324, M0 = 10;
  const SATS = ['Terra', 'Aqua', 'SNPP', 'NOAA20', 'SNPP_filled'];
  const MIN_MONTH_SUM = 50, MIN_POOLED = 200, TOO_SMALL = 16;
  function ymOf(m) { const y = 2000 + Math.floor(m / 12), mo = m % 12 + 1; return y + '-' + (mo < 10 ? '0' : '') + mo; }
  function dim(m) { const y = 2000 + Math.floor(m / 12), mo = m % 12 + 1; return new Date(Date.UTC(y, mo, 0)).getUTCDate(); }
  function rnd(x) { return Math.floor(x + 0.5); }
  function median(a) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), n = s.length;
    return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; }
  function quantile(a, q) { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), p = (s.length - 1) * q,
    lo = Math.floor(p), hi = Math.min(lo + 1, s.length - 1); return s[lo] + (s[hi] - s[lo]) * (p - lo); }
  function mean(a) { if (!a.length) return null; let t = 0; for (const x of a) t += x; return t / a.length; }

  // ---------- geometry ----------
  function pip(x, y, rings) {
    let inside = false;
    for (const r of rings) for (let i = 0, j = r.length - 1; i < r.length; j = i++) {
      const xi = r[i][0], yi = r[i][1], xj = r[j][0], yj = r[j][1];
      if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
  }
  function segHitsRect(x1, y1, x2, y2, L, B, R, T) {
    let t0 = 0, t1 = 1; const dx = x2 - x1, dy = y2 - y1;
    const p = [-dx, dx, -dy, dy], q = [x1 - L, R - x1, y1 - B, T - y1];
    for (let i = 0; i < 4; i++) {
      if (p[i] === 0) { if (q[i] < 0) return false; }
      else { const t = q[i] / p[i]; if (p[i] < 0) { if (t > t1) return false; if (t > t0) t0 = t; } else { if (t < t0) return false; if (t < t1) t1 = t; } }
    }
    return true;
  }
  function ringArea(r) { let a = 0; for (let i = 0, j = r.length - 1; i < r.length; j = i++) a += r[j][0] * r[i][1] - r[i][0] * r[j][1]; return Math.abs(a) / 2; }
  // even-odd area, independent of winding: a ring inside an odd number of other rings is a hole (fix 2)
  function evenOddArea(rings) {
    let t = 0;
    rings.forEach((r, i) => { let depth = 0; const [x, y] = r[0];
      rings.forEach((o, j) => { if (j !== i && pip(x, y, [o])) depth++; });
      t += (depth % 2 ? -1 : 1) * ringArea(r); });
    return Math.abs(t);
  }
  function areaPlan(area) {
    if (area.box) {
      const [w, s, e, n] = area.box, W = rnd(w * 1e5), S = rnd(s * 1e5), E = rnd(e * 1e5), N = rnd(n * 1e5);
      const tiles = [];
      for (let lo = Math.floor(w); lo <= Math.floor(e); lo++) for (let la = Math.floor(s); la <= Math.floor(n); la++) {
        const cx0 = lo * 100000 + 2500, cx1 = (lo + 1) * 100000 - 2500, cy0 = la * 100000 + 2500, cy1 = (la + 1) * 100000 - 2500;
        if (cx1 < W || cx0 > E || cy1 < S || cy0 > N) continue;
        tiles.push([lo, la, W <= cx0 && cx1 <= E && S <= cy0 && cy1 <= N]);
      }
      return { tiles, areaDeg2: (e - w) * (n - s),
        inCell: (ix, iy) => { const cx = ix * 5000 + 2500, cy = iy * 5000 + 2500; return W <= cx && cx <= E && S <= cy && cy <= N; } };
    }
    const rings = area.rings; let w = 1e9, s = 1e9, e = -1e9, n = -1e9;
    for (const r of rings) for (const [x, y] of r) { if (x < w) w = x; if (x > e) e = x; if (y < s) s = y; if (y > n) n = y; }
    const tiles = [];
    for (let lo = Math.floor(w); lo <= Math.floor(e); lo++) for (let la = Math.floor(s); la <= Math.floor(n); la++) {
      let whole = pip(lo, la, rings) && pip(lo + 1, la, rings) && pip(lo, la + 1, rings) && pip(lo + 1, la + 1, rings);
      if (whole) for (const r of rings) { for (let i = 0, j = r.length - 1; i < r.length; j = i++)
        if (segHitsRect(r[j][0], r[j][1], r[i][0], r[i][1], lo, la, lo + 1, la + 1)) { whole = false; break; } if (!whole) break; }
      tiles.push([lo, la, whole]);
    }
    return { tiles, areaDeg2: evenOddArea(rings), inCell: (ix, iy) => pip((ix * 5000 + 2500) / 1e5, (iy * 5000 + 2500) / 1e5, rings) };
  }
  // share of the area's 5 km squares whose centers are inside Argentina (no download needed)
  function argShare(area, L) {
    if (area.country) return area.country === 'Argentina' ? 1 : 0;
    if (!L.ext) return 0;
    const plan = areaPlan(area), mask = L.ext.mask; let tot = 0, inA = 0;
    for (const [lo, la] of plan.tiles) {
      const mk = mask[lo + '_' + la];
      for (let i = 0; i < 400; i++) { if (!plan.inCell(lo * 20 + i % 20, la * 20 + Math.floor(i / 20))) continue; tot++; if (mk && mk[i] === '1') inA++; }
    }
    return tot ? inA / tot : 0;
  }

  // ---------- step A: monthly series ----------
  function emptySeries() { const S = []; for (let s = 0; s < 5; s++) { S.push({ ad: new Float64Array(NMAX), det: new Float64Array(NMAX), b: [] });
    for (let k = 0; k < 7; k++) S[s].b.push(new Float64Array(NMAX)); } return S; }
  function addRec(S, r, o) { const s = r[o + 2], m = r[o + 1]; if (m < 0 || m >= NMAX) return;
    S[s].ad[m] += r[o + 3]; S[s].det[m] += r[o + 4]; for (let k = 0; k < 7; k++) S[s].b[k][m] += r[o + 5 + k]; }

  async function loadSeries(area, L, stats, useExt) {
    const S = emptySeries(), SS = useExt ? emptySeries() : null;
    if (area.country) {
      const c = await L.json(L.paths.layer + 'countries/' + area.country + '.json'); stats.files++;
      const daysAny = [0, 1, 2, 3, 4].map(() => new Float64Array(NMAX));
      for (const row of c.rows) { if (row[0] >= 312) continue; const r = [0].concat(row.slice(0, 11)); addRec(S, r, 0); if (row[1] < 5) daysAny[row[1]][row[0]] = row[11]; }
      if (useExt) {
        const x = await L.json(L.paths.ext + 'country_' + area.country + '.json'); stats.files++;
        for (const row of x.rows) { addRec(S, [0].concat(row.slice(0, 11)), 0); daysAny[row[1]][row[0]] = row[11]; }
        for (const row of x.same_rows) addRec(SS, [0].concat(row.slice(0, 11)), 0);
      }
      return { S, SS, daysAny, areaDeg2: null, isCountry: true };
    }
    const plan = areaPlan(area), idx = L.index, blockCache = {};
    const clip = useExt ? L.ext.mask : null, full = useExt ? new Set(L.ext.full_tiles) : null;
    for (const [lo, la, whole0] of plan.tiles) {
      const key = lo + '_' + la;
      if (clip && !clip[key]) continue;
      const whole = whole0 && (!clip || full.has(key));
      const ok = new Int8Array(400).fill(-1);
      const test = (i) => { if (ok[i] < 0) ok[i] = plan.inCell(lo * 20 + i % 20, la * 20 + Math.floor(i / 20)) && (!clip || clip[key][i] === '1') ? 1 : 0; return ok[i]; };
      if (key in idx.tiles) {
        if (whole) {
          const bl = Math.floor(lo / 10) * 10, ba = Math.floor(la / 10) * 10, bk = bl + '_' + ba;
          if (!blockCache[bk]) { blockCache[bk] = await L.bin(L.paths.layer + 'blocks/b_' + bk + '.bin.gz'); stats.files++; stats.blocks++; }
          const r = blockCache[bk], want = (la - ba) * 10 + (lo - bl);
          for (let o = 0; o < r.length; o += 12) if (r[o] === want) addRec(S, r, o);
          stats.tilesWhole++;
        } else {
          const r = await L.bin(L.paths.layer + 'cells/c_' + key + '.bin.gz'); stats.files++; stats.tilesCut++;
          for (let o = 0; o < r.length; o += 12) if (test(r[o])) addRec(S, r, o);
        }
      }
      if (useExt) {
        if (key in L.ext.tiles) { const r = await L.bin(L.paths.ext + 'cells/c_' + key + '.bin.gz'); stats.files++; for (let o = 0; o < r.length; o += 12) if (test(r[o])) addRec(S, r, o); }
        if (key in L.ext.same_tiles) { const r = await L.bin(L.paths.ext + 'same/c_' + key + '.bin.gz'); stats.files++; for (let o = 0; o < r.length; o += 12) if (test(r[o])) addRec(SS, r, o); }
      }
    }
    // F1-c: a drawn area that touches no data file at all is refused, not shown as zeros
    if (stats.files === 0) throw Refusal('NO_DATA_FILES', 'no data file covers this area (open sea, or no hot spot ever detected there), so there is nothing to show');
    return { S, SS, daysAny: null, areaDeg2: plan.areaDeg2, isCountry: false };
  }

  // ---------- the record ----------
  function compute(series, L, opts, useExt) {
    const { S, SS, daysAny } = series, method = opts.method || 'plain', fill = opts.fill === true;   // second pass: filling S-NPP's weak days from NOAA-20 is off by default (rule 7 below replaces it)
    const NM = useExt ? L.ext.partial.m + 1 : 312, MP = useExt ? L.ext.partial.m : null;
    const first = L.index.first_month, days = L.days, curve = L.curve;
    const notes = [];
    const avail = (s, m) => first[String(s)] !== undefined && m >= first[String(s)] && !(s === 4 && m >= 312) && !(s === 2 && m > 322);
    const worldDays = (s, m) => m >= 312 ? ((L.ext && L.ext.days_in_data_2026[String(s)]) || {})[ymOf(m)] || 0
      : ((days.days_in_data[String(s)] || {})[ymOf(m)] || 0);
    const daysOf = (s, m) => daysAny ? daysAny[s][m] : worldDays(s, m);
    const short = [null, null, new Uint8Array(NMAX), new Uint8Array(NMAX)];
    let shortRule = daysAny ? 'country: rows of any type in the country on fewer than (days in month - 3) days' :
      'world: rows anywhere on fewer than (days in month - 3) days (layer days.json; for 2026, rows in Argentina)';
    for (const s of [2, 3]) {
      let nShort = 0, nFin = 0;
      for (let m = M0; m < NM; m++) { if (!avail(s, m) || m === MP) continue; nFin++;
        if (daysOf(s, m) < dim(m) - 3) { short[s][m] = 1; nShort++; } }
      if (nFin && nShort / nFin > 0.1) { short[s].fill(0); const f0 = first[String(s)]; if (f0 !== undefined) short[s][f0] = 1;
        shortRule = 'off (more than one month in ten marked short; only the first month is short)'; notes.push('short-month test switched off for ' + SATS[s]); }
    }
    if (first['2'] !== undefined) short[2][first['2']] = 1;
    if (first['3'] !== undefined) short[3][first['3']] = 1;
    const lowDays = (sat, m) => m >= 312 ? 0 : ((days.not_sending[String(sat)] || {})[ymOf(m)] || []).length;
    const fillMonths = new Uint8Array(NMAX);
    for (const ym in (days.not_sending['2'] || {})) { const m = (+ym.slice(0, 4) - 2000) * 12 + (+ym.slice(5, 7)) - 1; if (m >= 0 && m < 312 && avail(4, m)) fillMonths[m] = 1; }
    const ahatS = (X, s, m) => { let t = 0; for (let k = 0; k < 7; k++) t += X[s].b[k][m] * curve.chance[k]; return curve.k * t; };
    const ahat = (s, m) => ahatS(S, s, m);
    const bad = new Uint8Array(NMAX);
    if (opts.excludeNotSending) for (const s of ['1', '2']) for (const ym in (days.not_sending[s] || {})) { const m = (+ym.slice(0, 4) - 2000) * 12 + (+ym.slice(5, 7)) - 1; if (m >= 0 && m < NMAX) bad[m] = 1; }

    // F1-b: worldwide weak sending (more than 3 days) nominates a month for the local test; localLow = Aqua months handed over here.
    const worldGap = (s, m) => m < 312 && lowDays(s, m) > 3;
    const localLow = new Uint8Array(NMAX), localTests = {};
    function learnMonths(kind, hide, skipWorld) {
      const [y0, y1] = kind === 'T' ? [2003, 2019] : [2012, 2021], out = [];
      for (let m = (y0 - 2000) * 12; m < (y1 - 2000 + 1) * 12; m++) {
        if (hide !== undefined && 2000 + Math.floor(m / 12) === hide) continue;
        const s = kind === 'T' ? 0 : 2; if (!avail(s, m) || !avail(1, m)) continue;
        if (kind !== 'T' && short[2][m]) continue; if (bad[m] || localLow[m]) continue;
        if (skipWorld && (worldGap(s, m) || worldGap(1, m))) continue;
        out.push(m);
      }
      return out;
    }
    const denom = (kind, m) => kind === 'T' ? S[0].ad[m] : kind === 'NP' ? S[2].ad[m] : ahat(2, m);
    // BUSY TWELVE RULE (added Nov 14, 2026, build day; its test: round_SAT/refine/r1/RESULT.md and APPLIED.md). For the newer camera only:
    // a BUSY country (the median of MODIS Aqua's own count over the learning months where Aqua counted anything is 50 or more, and both
    // whole-year sums reach 200) always gets twelve month-of-year numbers; a month of the year with no newer-camera learning count uses the
    // whole-year number. Every other country keeps the rule below unchanged (twelve only if every month of the year has 50 in both cameras,
    // else one number, else the shared curve). The choice is made once on all years and kept for each hidden year, like the mode.
    const BUSY_MONTH = 50;
    function factors(kind, hide, mode, skipWorld, busy) {
      const ms = learnMonths(kind, hide, skipWorld), A = new Array(12).fill(0), D = new Array(12).fill(0), C = new Array(12).fill(0);
      let pa = 0, pd = 0, pc = 0;
      for (const m of ms) { const k = m % 12, a = S[1].ad[m], d = denom(kind, m), c = kind === 'T' ? S[0].ad[m] : S[2].ad[m];
        A[k] += a; D[k] += d; C[k] += c; pa += a; pd += d; pc += c; }
      if (busy === undefined) {
        busy = false;
        if (kind !== 'T' && pa >= MIN_POOLED && pc >= MIN_POOLED) { const typ = median(ms.map(m => S[1].ad[m]).filter(a => a > 0)); busy = typ !== null && typ >= BUSY_MONTH; }
      }
      if (mode === undefined) {
        if (busy) mode = 'month_of_year';
        else if (A.every((x, k) => x >= MIN_MONTH_SUM && C[k] >= MIN_MONTH_SUM)) mode = 'month_of_year';
        else if (pa >= MIN_POOLED && pc >= MIN_POOLED) mode = 'single'; else mode = 'none';
      }
      let f = null;
      const one = pd > 0 ? pa / pd : null;
      if (mode === 'month_of_year' && busy) f = A.map((a, k) => D[k] > 0 && C[k] > 0 ? a / D[k] : one);
      else if (mode === 'month_of_year') f = A.map((a, k) => D[k] > 0 ? a / D[k] : null);
      else if (mode === 'single') f = new Array(12).fill(one);
      return { mode, f, months_used: ms.length, busy_twelve: busy };
    }
    // F1-b: the per-place test, with first factors learned WITHOUT any world-flagged month; decisions are frozen before the final fit.
    const kindN = method === 'plain' ? 'NP' : 'NS';
    { const F0 = factors(kindN, undefined, undefined, true);
      const tr = (k) => { const f = F0.f ? F0.f[k % 12] : null; return f === null || f === undefined ? null : f * denom(kindN, k); };
      const sound = (k) => k >= M0 && k < 264 && avail(2, k) && !short[2][k] && !worldGap(1, k) && !worldGap(2, k);
      for (let m = 30; m < 264; m++) {
        if (!worldGap(1, m) || !avail(2, m) || short[2][m] || worldGap(2, m)) continue;
        const refs = [];
        for (const k of [m - 2, m - 1, m + 1, m + 2]) { if (!sound(k)) continue; const t = tr(k);
          if (t !== null && t >= TOO_SMALL && S[1].ad[k] >= TOO_SMALL) refs.push(S[1].ad[k] / t); }
        const t = tr(m), ratio = t ? S[1].ad[m] / t : null, ref = mean(refs);
        const low = ratio !== null && ref !== null && ratio < 0.75 * ref;
        localTests[m] = { older_over_newer: ratio, neighbours: ref, neighbour_months: refs.length, threshold: 0.75, handed_over: low,
          evidence: ratio !== null && ref !== null };
        if (low) localLow[m] = 1;
      }
    }
    const FT = factors('T'), FS = factors(kindN);
    let g = null; const gs = { a: 0, b: 0, c: 0, d: 0 };
    for (let m = 228; m < 264; m++) { if (!avail(3, m) || short[2][m] || short[3][m]) continue;
      gs.a += S[2].ad[m]; gs.b += S[3].ad[m]; gs.c += ahat(2, m); gs.d += ahat(3, m); }
    if (gs.a >= MIN_POOLED && gs.b >= MIN_POOLED) g = method === 'plain' ? gs.a / gs.b : gs.c / gs.d;

    function convert(X, sat, m) {
      if (sat === 1) return [X[1].ad[m], 'counted', 'Aqua is the reference camera: its own count'];
      if (sat === 0) { if (!FT.f || FT.f[m % 12] === null) return [null, 'no_factor', 'too little overlap here to join the cameras (Terra)'];
        return [FT.f[m % 12] * X[0].ad[m], 'terra_' + FT.mode, 'Terra count times this area\'s ' + (FT.mode === 'single' ? 'one number' : 'number for this month of the year') + ' (Terra onto Aqua, learned 2003-2019)']; }
      const viaN20 = sat === 3, src = viaN20 ? 3 : sat;
      const base = method === 'plain' ? X[src].ad[m] : ahatS(X, src, m);
      if (viaN20 && g === null) return [ahatS(X, 3, m), 'curve_only', 'NOAA-20 carries; too little overlap to put it onto S-NPP here, so the worldwide curve alone (rougher)'];
      if (!FS.f || FS.f[m % 12] === null) return [ahatS(X, src, m), 'curve_only', 'too little overlap history here for this area\'s own numbers: the worldwide seven-number curve alone (rougher)'];
      const word = method === 'plain' ? 'count' : 'count by fire-power band times the worldwide curve';
      return [FS.f[m % 12] * (viaN20 ? g : 1) * base, (method === 'plain' ? 'plain_' : 'strength_') + FS.mode,
        (viaN20 ? 'NOAA-20 ' : sat === 4 ? 'S-NPP (its not-sending days filled from NOAA-20) ' : 'S-NPP ') + word + ' times this area\'s ' + (FS.mode === 'single' ? 'one number' : 'number for this month of the year') + ' (learned 2012-2021)' + (viaN20 ? ', times NOAA-20 onto S-NPP' : '')];
    }
    function carrierOf(m) {
      if (m < 30) return 0; if (m < 264) return localLow[m] ? 2 : 1;   // F1-b
      if (m >= 322) return 3;                           // S-NPP's last rows are Nov 2, 2026: NOAA-20 carries from November 2026
      if (short[2][m] && avail(3, m) && !short[3][m]) return 3;
      // 7 (second pass, after builder B): S-NPP sent far less than usual on more than 3 days -> NOAA-20 carries the whole month
      if (!fill && lowDays(2, m) > 3 && avail(3, m) && !short[3][m] && lowDays(3, m) <= 3) return 3;
      if (fill && fillMonths[m]) return 4; return 2;
    }
    const daySat = (s) => s === 4 ? 2 : s;
    // ---------- months ----------
    const months = [];
    for (let m = M0; m < NM; m++) {
      const c = carrierOf(m), sat = avail(c, m) ? c : null;
      const raw = {}, det = {};
      for (let s = 0; s < 5; s++) { raw[SATS[s]] = avail(s, m) ? S[s].ad[m] : null; det[SATS[s]] = avail(s, m) ? S[s].det[m] : null; }
      if (!(fill && fillMonths[m])) { raw.SNPP_filled = null; det.SNPP_filled = null; }
      let value = null, meth = 'no_data', why = 'the carrier satellite has no data this month';
      if (sat !== null && daysOf(daySat(sat), m) === 0) { meth = 'no_data'; why = daysAny ? 'no carrier rows this month in this country (fix 1: shown as a gap, not a zero)' : 'the carrier satellite sent no rows anywhere this month'; }
      else if (sat !== null) [value, meth, why] = convert(S, sat, m);
      const st = value === null ? (meth === 'no_factor' ? 'no_factor' : 'no_data') : (m === MP ? 'partial' : 'final');
      // F1-b/e: hand-over and plain flags
      const handed = !!localLow[m] && sat === 2;
      if (handed && value !== null) why += '; the older camera (Aqua) sent far less than usual worldwide on ' + lowDays(1, m) + ' days that month and reads clearly low HERE against the months around it (' +
        (localTests[m].older_over_newer).toFixed(3) + ' against ' + (localTests[m].neighbours).toFixed(3) + ' x 0.75), so the newer camera supplies the whole month, translated';
      else if (localTests[m] && value !== null) why += '; the older camera sent far less than usual worldwide on ' + lowDays(1, m) + ' days that month, but ' +
        (localTests[m].evidence ? 'it does not read low here against the months around it' : 'there is no local evidence that it reads low') + ', so its own count stands';
      months.push({ m, ym: ymOf(m), carrier: sat === null ? null : SATS[sat], value, method: meth, why, raw, detections: det,
        status: st, low_days: sat === null ? 0 : lowDays(sat, m), days: m === MP ? L.ext.partial.days : dim(m), short: { SNPP: !!short[2][m], NOAA20: !!short[3][m] },
        first_camera: m < 30, translated: value !== null && sat !== 1, handed_over: handed, older_low_days: lowDays(1, m), newer_low_days: lowDays(2, m), local_test: localTests[m] || null });
    }
    // 8 (second pass): a month whose camera sent far less than usual worldwide on 4+ days is checked IN THIS AREA against a partner camera
    //   (Aqua against S-NPP translated, or against Terra translated); it is flagged reads_low only if it comes out under 75% of the partner (and the partner is 50 or more).
    //   Terra-only months (no partner) are flagged only if under half this area's usual for that month (checked after medians below).
    for (const r of months) {
      r.reads_low = false; r.low_check = null;
      if (r.low_days <= 3 || r.value === null || r.carrier === null || r.local_test) continue;   // F1-b: months the local test decided are not re-flagged
      let est = null, by = null;
      if (r.carrier === 'Aqua' && avail(2, r.m) && FS.f && FS.f[r.m % 12] !== null) { est = convert(S, 2, r.m)[0]; by = 'S-NPP, translated'; }
      else if (r.carrier === 'Aqua' && avail(0, r.m) && FT.f && FT.f[r.m % 12] !== null) { est = FT.f[r.m % 12] * S[0].ad[r.m]; by = 'Terra, translated'; }
      if (est !== null) { r.low_check = { partner: by, partner_value: est }; r.reads_low = est >= 50 && r.value < 0.75 * est; }
    }
    const fin = months.filter(r => r.status === 'final');
    // ---------- ranges (fix 4) ----------
    let cls = 'own20';
    if (series.areaDeg2 !== null) { const side = Math.sqrt(series.areaDeg2), opt = [['1', 1], ['2p5', 2.5], ['5', 5], ['10', 10], ['own20', 20]];
      let best = null, bd = 1e9; for (const [c, v] of opt) { const d = Math.abs(Math.log(side) - Math.log(v)); if (d < bd) { bd = d; best = c; } } cls = best; }
    const rangesOn = !series.isCountry && cls !== 'own20';
    const RT = L.ranges.tables, ED = L.ranges.edges;
    const binOf = (v) => { if (v <= 0) return 0; for (let i = 0; i < ED.length; i++) if (v < ED[i]) return i + 1; return ED.length; };
    for (const r of months) {
      r.range = null; r.too_small_alone = false;
      if (r.value === null || r.carrier === 'Aqua') continue;
      if (r.value < TOO_SMALL) r.too_small_alone = true;
      if (!rangesOn) continue;
      const cam = r.carrier === 'Terra' ? 't' : 'n'; let b = binOf(r.value);
      while (!((cls + '|' + b) in RT[cam]) && b > 0) b--;
      const q = RT[cam][cls + '|' + b];
      if (q) r.range = b === 0 ? [0, q[3]] : [q[0] * r.value, q[3] * r.value];
    }
    // ---------- medians, averages, ranks (optional baseline years) ----------
    const by = opts.baseline || null, inBase = (ym) => !by || (+ym.slice(0, 4) >= by[0] && +ym.slice(0, 4) <= by[1]);
    for (const r of months) {
      if (r.status === 'partial') continue;
      const others = fin.filter(o => o !== r && o.ym.slice(5) === r.ym.slice(5) && inBase(o.ym)).map(o => o.value);
      r.median = median(others); r.average = mean(others); r.p25 = quantile(others, 0.25); r.p75 = quantile(others, 0.75); r.p10 = quantile(others, 0.1); r.p90 = quantile(others, 0.9);
      r.min_other = others.length ? Math.min(...others) : null; r.max_other = others.length ? Math.max(...others) : null;
      r.rank = r.value === null ? null : { busier_than: others.filter(v => v < r.value).length, of: others.length };
    }
    for (const r of months) if (r.low_days > 3 && r.low_check === null && !r.local_test && r.value !== null && r.median) { r.low_check = { partner: 'the usual for this month here', partner_value: r.median }; r.reads_low = r.median >= 50 && r.value < 0.5 * r.median; }
    // ---------- the unfinished month against the same days (fix 5) ----------
    let current = null;
    if (MP !== null) {
      const r = months.find(x => x.m === MP), same = [];
      for (let m = M0 + ((MP % 12) - (M0 % 12) + 12) % 12; m < MP; m += 12) {
        const c = carrierOf(m); if (!avail(c, m)) continue;
        const [v, me] = convert(SS, c, m); if (v === null) continue;
        same.push({ year: 2000 + Math.floor(m / 12), value: v, carrier: SATS[c], method: me, raw: { Terra: avail(0, m) ? SS[0].ad[m] : null, Aqua: avail(1, m) ? SS[1].ad[m] : null, SNPP: avail(2, m) ? SS[2].ad[m] : null, NOAA20: avail(3, m) ? SS[3].ad[m] : null } });
      }
      const others = same.filter(o => inBase(String(o.year))).map(o => o.value);
      r.median = median(others); r.average = mean(others); r.p25 = quantile(others, 0.25); r.p75 = quantile(others, 0.75); r.p10 = quantile(others, 0.1); r.p90 = quantile(others, 0.9);
      r.min_other = others.length ? Math.min(...others) : null; r.max_other = others.length ? Math.max(...others) : null;
      r.rank = r.value === null ? null : { busier_than: others.filter(v => v < r.value).length, of: others.length };
      const [vSS] = convert(SS, carrierOf(MP), MP);
      // F1-f: the year so far, date for date: finished months of the year before MP plus the same days of MP's month, in every year that has them all
      const k0 = MP % 12, ysf = [];
      for (const o of same) { const y = o.year; let t = o.value, ok = true;
        for (let k = 0; k < k0; k++) { const r2 = months.find(x => x.m === (y - 2000) * 12 + k); if (!r2 || r2.status !== 'final') { ok = false; break; } t += r2.value; }
        ysf.push({ year: y, value: ok ? t : null }); }
      let ysfNow = r.value; for (let k = 0; k < k0; k++) { const r2 = months.find(x => x.m === MP - k0 + k); if (!r2 || r2.status !== 'final') { ysfNow = null; break; } ysfNow += r2.value; }
      const ysfOthers = ysf.filter(o => o.value !== null && inBase(String(o.year)));
      current = { year_so_far: { year: 2000 + Math.floor(MP / 12), through: L.ext.partial.last_day, value: ysfNow, typical: median(ysfOthers.map(o => o.value)), others: ysf }, ym: r.ym, days: L.ext.partial.days, last_day: L.ext.partial.last_day, value: r.value, carrier: r.carrier, raw: r.raw, detections: r.detections,
        median: r.median, average: r.average, p10: r.p10, p25: r.p25, p75: r.p75, p90: r.p90, min_other: r.min_other, max_other: r.max_other, rank: r.rank, same_days: same,
        check_same_file_value: vSS };
    }
    // ---------- totals ----------
    const lastY = 2000 + Math.floor((NM - 1) / 12);
    const yearTotals = [];
    for (let y = 2000; y <= lastY; y++) { const ys = months.filter(r => +r.ym.slice(0, 4) === y), ok = ys.filter(r => r.status === 'final');
      let t = 0; for (const r of ok) t += r.value; yearTotals.push({ year: y, total: ok.length === 12 ? t : null, months_so_far_total: ok.length && ok.length < 12 ? t : null, months_counted: ok.length, complete: ok.length === 12 }); }   // F1-g: a part-year never has a 'total'
    const comp = yearTotals.filter(t => t.complete);
    // F1-d: a typical year = the middle total of the OTHER complete years (the judged year left out)
    for (const t of yearTotals) t.typical_other = median(comp.filter(o => o !== t && inBase(String(o.year))).map(o => o.total));
    // quarter and year totals where single months are too small (fix 3): whole quarters, all three months
    const blocks = [];
    for (let y = 2000; y <= lastY; y++) {
      for (let qq = 0; qq < 4; qq++) {
        const qm = months.filter(r => +r.ym.slice(0, 4) === y && Math.floor((+r.ym.slice(5, 7) - 1) / 3) === qq);
        if (!qm.some(r => r.too_small_alone)) continue;
        const okq = qm.filter(r => r.status === 'final'); let t = 0; for (const r of okq) t += r.value;
        blocks.push({ kind: 'quarter', label: y + ' Q' + (qq + 1), months: qm.map(r => r.ym), complete: okq.length === 3, total: okq.length === 3 ? t : null, still_under_16: okq.length === 3 && t < TOO_SMALL });
      }
    }
    let busiestYear = null; for (const t of comp) if (!busiestYear || t.total > busiestYear.total) busiestYear = t;
    let busiestMonth = null; for (const r of fin) if (!busiestMonth || r.value > busiestMonth.value) busiestMonth = r;
    let latest = null; for (const r of fin) latest = r;
    const moyMed = []; for (let k = 1; k <= 12; k++) { const kk = (k < 10 ? '0' : '') + k; moyMed.push(median(fin.filter(r => r.ym.slice(5) === kk).map(r => r.value))); }
    let pk = 0; for (let k = 1; k < 12; k++) if (moyMed[k] > moyMed[pk]) pk = k;
    let season = null, twoSeasons = false;
    if (moyMed[pk] > 0) {
      const thr = moyMed[pk] / 3, inS = new Uint8Array(12); inS[pk] = 1;
      let a = pk, n = 0; while (n < 11 && moyMed[(a + 11) % 12] >= thr) { a = (a + 11) % 12; inS[a] = 1; n++; }
      let z = pk; n = 0; while (n < 11 && moyMed[(z + 1) % 12] >= thr) { z = (z + 1) % 12; inS[z] = 1; n++; }
      season = { about_start: a + 1, about_end: z + 1, rule: 'months around the peak whose median is at least one third of the peak month\'s median' };
      for (let k = 0; k < 12; k++) if (!inS[k] && moyMed[k] >= moyMed[pk] / 2 && moyMed[k] >= moyMed[(k + 11) % 12] && moyMed[k] >= moyMed[(k + 1) % 12]) twoSeasons = true;
    }
    // ---------- hide-a-year ----------
    function hideAYear(kind) {
      const full = factors(kind), y0 = kind === 'T' ? 2003 : 2012, y1 = kind === 'T' ? 2019 : 2021, miss = [], signed = [];
      for (let y = y0; y <= y1; y++) {
        const F = full.mode === 'none' ? null : factors(kind, y, full.mode, undefined, full.busy_twelve);
        for (let m = (y - 2000) * 12; m < (y - 2000 + 1) * 12; m++) {
          const s = kind === 'T' ? 0 : 2; if (!avail(s, m)) continue; const a = S[1].ad[m];
          if (a === 0 || (kind !== 'T' && short[2][m]) || bad[m] || localLow[m]) continue;   // F1-b: a handed-over Aqua month is not a test answer
          let p;
          if (F === null) { if (kind === 'T') continue; p = ahat(2, m); }
          else { const f = F.f[m % 12]; if (f === null) continue; p = f * denom(kind, m); }
          miss.push(Math.abs(p - a) / a * 100); signed.push({ ym: ymOf(m), predicted: p, aqua: a });
        }
      }
      if (miss.length < 24) return { months: miss.length, typical_pct: null, nine_in_ten_pct: null, mode: full.mode, reason: 'fewer than 24 months could be compared', pairs: signed };
      return { months: miss.length, typical_pct: median(miss), nine_in_ten_pct: quantile(miss, 0.9), mode: full.mode, pairs: signed };
    }
    const hy = { SNPP: hideAYear(method === 'plain' ? 'NP' : 'NS'), Terra: hideAYear('T') };
    // ---------- after 2021: the joined value against Aqua's own count (Aqua kept flying, but its pass drifted later) ----------
    const a21 = { months: 0, joined_total: 0, aqua_total: 0, typical_pct: null };
    { const miss = []; for (const r of fin) { if (r.m < 264 || r.m >= 312 || r.carrier === 'Aqua' || r.raw.Aqua === null) continue;
        a21.months++; a21.joined_total += r.value; a21.aqua_total += r.raw.Aqua; if (r.raw.Aqua > 0) miss.push(Math.abs(r.value - r.raw.Aqua) / r.raw.Aqua * 100); }
      a21.typical_pct = median(miss); a21.total_pct = a21.aqua_total ? (a21.joined_total / a21.aqua_total - 1) * 100 : null; }
    if (!useExt) notes.push('the world record in this demo ends December 2025; 2026 is on this laptop for Argentina only');
    const sum = (r) => r && { ym: r.ym, value: r.value, median: r.median, average: r.average, carrier: r.carrier,
      vs_median_pct: r.median ? (r.value / r.median - 1) * 100 : null, vs_average_pct: r.average ? (r.value / r.average - 1) * 100 : null };
    return {
      method, fill_snpp_from_noaa20: fill, short_rule: shortRule, range_size_class: cls, ranges_shown: rangesOn,
      record_ends: ymOf(NM - 1), uses_2026_extension: useExt, baseline: by,
      factors: { Terra: FT, SNPP: FS, NOAA20_onto_SNPP: g },
      hide_a_year: hy, after_2021: a21, monthly: months, blocks_too_small: blocks, year_totals: yearTotals,
      method_label: method === 'plain' ? 'plain month-by-month' : 'strength-weighted (experimental)',
      record_starts: ymOf(M0), handed_over: months.filter(r => r.handed_over).map(r => r.ym),
      latest: sum(latest), current,
      busiest_month: busiestMonth && { ym: busiestMonth.ym, value: busiestMonth.value },
      busiest_year: busiestYear && { year: busiestYear.year, total: busiestYear.total },
      peak_month_of_year: moyMed[pk] > 0 ? pk + 1 : null, month_of_year_medians: moyMed, season, two_seasons: twoSeasons, notes
    };
  }

  // ---------- F1-a: loading ----------
  // paths: { layer: folder of index.json/days.json/shared/countries (and cells/blocks for drawn areas), ext: folder of the Argentina 2026 files }
  const DEFAULT_PATHS = { layer: 'data/world_by_country/', ext: 'data/argentina_2026/' };
  async function makeLayer(loadBin, loadJson, paths) {
    const L = { bin: loadBin, json: loadJson, paths: Object.assign({}, DEFAULT_PATHS, paths || {}) };
    const P = L.paths.layer;
    [L.index, L.days, L.curve, L.ranges] = await Promise.all([P + 'index.json', P + 'days.json', P + 'shared/curve.json', P + 'shared/ranges.json'].map(loadJson));
    try { L.pkg = await loadJson(P + 'package_info.json'); } catch (e) { L.pkg = null; }
    L.countriesOnly = !!(L.pkg && L.pkg.kind === 'countries_only');
    if (L.paths.ext) { try { L.ext = await loadJson(L.paths.ext + 'ext_index.json'); } catch (e) { L.ext = null; } } else L.ext = null;
    return L;
  }
  function browserLoaders(base) {
    base = base || '';
    const get = async (p) => { const r = await fetch(base + p); if (!r.ok) throw new Error('could not fetch ' + base + p + ' (' + r.status + ')'); return r; };
    return {
      json: async (p) => (await get(p)).json(),
      bin: async (p) => { const r = await get(p); return new Int32Array(await new Response(r.body.pipeThrough(new DecompressionStream('gzip'))).arrayBuffer()); }
    };
  }
  function nodeLoaders(base) {
    const fs = require('fs'), path = require('path'), zlib = require('zlib'); base = base || '.';
    return {
      json: async (p) => JSON.parse(fs.readFileSync(path.resolve(base, p), 'utf8')),
      bin: async (p) => { const b = zlib.gunzipSync(fs.readFileSync(path.resolve(base, p))); return new Int32Array(new Uint8Array(b).buffer); }
    };
  }
  // open({ base, paths }): base = where this part's folder is (URL prefix in a browser, a folder in Node); loaders picked for you.
  async function open(o) {
    o = o || {}; const inNode = typeof window === 'undefined' && typeof process !== 'undefined' && !!(process.versions && process.versions.node);
    const ld = o.loaders || (inNode ? nodeLoaders(o.base) : browserLoaders(o.base));
    return makeLayer(ld.bin, ld.json, o.paths);
  }
  // ---------- F1-c: refusals ----------
  function Refusal(code, msg) { const e = new Error(msg); e.name = 'Refusal'; e.code = code; return e; }
  function OutOfCoverage(msg) { const e = Refusal('OUT_OF_COVERAGE', msg); e.name = 'OutOfCoverage'; return e; }
  const YM = /^(\d{4})-(0[1-9]|1[0-2])$/;
  // F1-c: coordinates must be on the Earth and in order
  function checkArea(area) {
    const okPt = (x, y) => typeof x === 'number' && typeof y === 'number' && isFinite(x) && isFinite(y) && x >= -180 && x <= 180 && y >= -90 && y <= 90;
    if (area.box) { const b = area.box;
      if (!Array.isArray(b) || b.length !== 4 || !okPt(b[0], b[1]) || !okPt(b[2], b[3])) throw Refusal('BAD_AREA', 'a box is [west, south, east, north] with longitude -180 to 180 and latitude -90 to 90');
      if (!(b[0] < b[2]) || !(b[1] < b[3])) throw Refusal('BAD_AREA', 'a box needs west less than east and south less than north'); return; }
    if (area.rings) { if (!Array.isArray(area.rings) || !area.rings.length || area.rings.some(r => !Array.isArray(r) || r.length < 3 || r.some(p => !Array.isArray(p) || !okPt(p[0], p[1]))))
      throw Refusal('BAD_AREA', 'an outline is a list of rings of at least 3 [longitude, latitude] points, longitude -180 to 180, latitude -90 to 90'); return; }
    if (!area.country) throw Refusal('BAD_AREA', 'an area is {country}, {box} or {rings}');
  }
  function countries(L) { return Object.keys(L.index.countries || {}).sort(); }
  // the month row for 'YYYY-MM'; throws OutOfCoverage outside the record (a month inside it with no rows comes back with value null)
  function month(result, ym) {
    if (typeof ym !== 'string' || !YM.test(ym)) throw Refusal('BAD_REQUEST', 'a month is written YYYY-MM, for example 2025-12 (got ' + JSON.stringify(ym) + ')');
    if (ym < result.record_starts || ym > result.record_ends) throw OutOfCoverage(ym + ' is outside this record (' + result.record_starts + ' to ' + result.record_ends + (result.current ? ', ' + result.current.ym + ' unfinished' : '') + ')');
    return result.monthly.find(r => r.ym === ym);
  }
  // opts.method: 'plain' (default) or 'strength' (experimental); opts.ext: false = ignore Argentina's 2026 files; opts.clip: true = drawn area cut to Argentina (needs the full ext);
  // opts.baseline: [firstYear, lastYear] for "typical" (default: all years).
  async function query(area, L, opts) {
    opts = opts || {}; const stats = { files: 0, blocks: 0, tilesWhole: 0, tilesCut: 0 };
    if (opts.method && opts.method !== 'plain' && opts.method !== 'strength') throw new Error('unknown method ' + opts.method + " (use 'plain' or 'strength')");
    checkArea(area || {});
    if (area.country) { if (!(area.country in (L.index.countries || {}))) throw OutOfCoverage('no country file for "' + area.country + '"; the names are NASA\'s (HSEngine.countries(layer) lists them)'); }
    else if (L.countriesOnly) throw OutOfCoverage('a drawn area needs the full world layer; this package holds whole countries only (see DATA_POINTERS.md)');
    const useExt = !!L.ext && opts.ext !== false && ((area.country === 'Argentina') || (!area.country && !!opts.clip));
    const series = await loadSeries(area, L, stats, useExt);
    const out = compute(series, L, opts, useExt); out.area = area; out.clipped_to_argentina = useExt && !area.country; out.fetch_stats = stats; return out;
  }
  const api = { query, makeLayer, open, browserLoaders, nodeLoaders, month, countries, OutOfCoverage, Refusal, argShare, ymOf, evenOddArea, version: 'f1-engine-2026-11-13 (from demo A, engine-demoA-2)' };
  if (typeof module !== 'undefined' && module.exports) module.exports = api; else root.HSEngine = api;
})(typeof window !== 'undefined' ? window : globalThis);
