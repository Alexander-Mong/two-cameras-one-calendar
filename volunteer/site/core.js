/* Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md. */
//
// Pure functions: every number and sentence the page shows about a place comes from here,
// so tools/check_places.cjs can recompute it from data/places.json.
(function (root) {
  'use strict';
  const MONTHS = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
  const ANSWERS = {
    fire: 'A wildfire or farm burning',
    industry: 'Oil, gas or other industry',
    volcano: 'A volcano',
    something: 'Something else',
    canttell: "I can't tell"
  };
  // NASA's type label, in plain words. nasa_answer: fire (0), volcano (1), industry (2), offshore (3)
  const NASA_WORDS = {
    fire: 'a fire in vegetation: a wildfire or farm burning.',
    volcano: 'a volcano.',
    industry: 'not a fire. A steady heat source on land.',
    offshore: 'not a fire. A steady heat source; NASA files it as "offshore".'
  };

  function monthTotals(p) { return p.months_viirs.map((v, i) => v + p.months_modis[i]); }
  function hotMonths(p) { return monthTotals(p).filter(x => x > 0).length; }
  function monthRange(p) {
    const t = monthTotals(p); const on = t.map((x, i) => x > 0 ? i : -1).filter(i => i >= 0);
    if (!on.length) return '';
    const a = MONTHS[on[0]], b = MONTHS[on[on.length - 1]];
    return a === b ? a : a + ' to ' + b;
  }
  function nightWords(s) { return s >= 0.7 ? 'mostly at night' : s <= 0.3 ? 'mostly by day' : 'by day and by night'; }

  // The two or three plain facts under the heat strip
  function facts(p) {
    const m = hotMonths(p);
    const out = [];
    out.push(m === 12 ? 'Hot in all 12 months of 2020.' : m >= 10 ? `Hot in ${m} of 12 months of 2020.` : `Hot in only ${m} of 12 months (${monthRange(p)}).`);
    out.push(`Seen ${nightWords(p.night_share)}: ${Math.round(p.night_share * 100)} of every 100 sightings were at night.`);
    out.push(`Spotted on ${p.days} different days.`);
    return out;
  }
  // Heat strip: one cell per month, shade 0..4 by detections (both cameras)
  function stripCells(p) {
    return monthTotals(p).map((n, i) => ({
      month: MONTHS[i], n, viirs: p.months_viirs[i], modis: p.months_modis[i],
      shade: n === 0 ? 0 : n < 10 ? 1 : n < 50 ? 2 : n < 200 ? 3 : 4
    }));
  }
  function monthDetail(c) {
    if (!c.n) return `${c.month} 2020: no heat seen by either camera.`;
    return `${c.month} 2020: Vee (VIIRS) saw heat ${c.viirs} time${c.viirs === 1 ? '' : 's'}, Moe (MODIS) ${c.modis} time${c.modis === 1 ? '' : 's'}.`;
  }
  // Does the visitor's pick agree with NASA's label? true / false / null (no guess)
  function agrees(pick, nasa) {
    if (pick === 'canttell') return null;
    if (nasa === 'fire') return pick === 'fire';
    if (nasa === 'volcano') return pick === 'volcano';
    return pick === 'industry' || pick === 'something';   // industry (2) or offshore (3): any "not a fire, built" pick
  }
  // One sentence on the clue that gives it away (claims only what the record shows)
  function clue(p) {
    const m = hotMonths(p);
    if (p.nasa_answer === 'fire') {
      return m <= 3
        ? `The clue: a fire comes in a season and moves on. This place was hot in only ${m} month${m === 1 ? '' : 's'} (${monthRange(p)}), then quiet.`
        : `The clue is weaker here: hot in ${m} months, but seen ${nightWords(p.night_share)} and only on ${p.days} days.`;
    }
    if (p.nasa_answer === 'volcano') {
      return `The clue: a volcano can stay hot month after month like a factory (hot in ${m} of 12 months here), so the setting gives it away. Look for a mountain in the wide view.`;
    }
    return m >= 10
      ? `The clue: a steady source stays on. Hot in ${m} of 12 months, ${nightWords(p.night_share)}, on ${p.days} days. Steady heat is a strong clue, not proof.`
      : `The clue is weaker here: hot in ${m} of 12 months, ${nightWords(p.night_share)}.`;
  }
  // Score kept only in this visitor's page
  function score(picks) {
    let agree = 0, differ = 0, none = 0;
    for (const r of picks) { const a = agrees(r.pick, r.nasa); if (a === true) agree++; else if (a === false) differ++; else none++; }
    return { agree, differ, none, total: picks.length };
  }
  // Round: 10 places, half NASA-fire and half not, drawn from the ones not yet seen
  function drawRound(places, seen, n, rnd) {
    const pool = places.filter(p => !p.practice && !seen.has(p.id));
    const sh = a => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rnd() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
    const f = sh(pool.filter(p => p.nasa_answer === 'fire')), s = sh(pool.filter(p => p.nasa_answer !== 'fire'));
    const out = [];
    while (out.length < n && (f.length || s.length)) { if (s.length) out.push(s.shift()); if (out.length < n && f.length) out.push(f.shift()); }
    return sh(out);
  }
  // ---- the thermometer card: the cameras' brightness temperature (whole pixel, not the flames)
  const toC = k => Math.round(k - 273.15);
  // Steadiness rule (stated in NOTES.md): spread = 90th minus 10th percentile of the newer camera's (VIIRS I4)
  // readings at night (by day if fewer than 10 night readings). Under 20 K "very steady"; 40 K or more "swings a lot";
  // in between "swings some". Fewer than 10 readings either way: no label.
  function steadiness(p) {
    const t = p.temp; if (!t) return null;
    const o = t.viirs_night.n >= 10 ? { ...t.viirs_night, when: 'night' } : t.viirs_day.n >= 10 ? { ...t.viirs_day, when: 'day' } : null;
    if (!o) return null;
    const spread = Math.round((o.p90_k - o.p10_k) * 10) / 10;
    return { spread, when: o.when, n: o.n, label: spread < 20 ? 'very steady' : spread >= 40 ? 'swings a lot' : 'swings some' };
  }
  function tempLine(o, cam, when) {
    if (!o || o.n < 10) return null;
    return { text: `${cam} read it at about ${toC(o.median_k)} °C on a typical ${when}, usually between ${toC(o.p10_k)} and ${toC(o.p90_k)} °C.`,
      small: `${o.median_k} K typical, ${o.p10_k} to ${o.p90_k} K; ${o.n} reading${o.n === 1 ? '' : 's'}`, n: o.n, median_k: o.median_k, p10_k: o.p10_k, p90_k: o.p90_k };
  }
  function thermo(p) {
    const t = p.temp; if (!t) return null;
    const nn = t.viirs_night.n + t.modis_night.n;
    const lines = [];
    // first: the fact that separates best on the 50 places (probe/temperature_vs_label.md): how many night readings
    lines.push({ text: nn ? `The cameras read heat here ${nn.toLocaleString('en-US')} time${nn === 1 ? '' : 's'} at night in 2020.` : 'The cameras never read heat here at night in 2020.', small: `Vee (VIIRS) ${t.viirs_night.n}, Moe (MODIS) ${t.modis_night.n}` });
    for (const [o, cam, when] of [[t.viirs_night, 'Vee', 'night'], [t.viirs_day, 'Vee', 'day'], [t.modis_night, 'Moe', 'night'], [t.modis_day, 'Moe', 'day']]) {
      const l = tempLine(o, cam, when); if (l) lines.push(l);
    }
    // The steadiness label is computed (steadiness()) but NOT shown: on the 50 places it points the wrong way
    // (9 of 25 fires read 'very steady', 15 of 25 steady sources 'swing a lot'; NOTES.md). Kept for the record only.
    lines.push({ text: `Typical fire power: ${p.frp_median_mw} megawatts.`, small: `median of ${p.detections} detections` });
    return lines;
  }
  // ---- the drawn card (round 3). Fixed scales and cut-offs, stated in NOTES.md and pinned by tools/check_places.cjs
  const NIGHT_PART = 1, NIGHT_FULL = 10;          // night readings in a month: 0 empty moon, 1-9 half moon, 10+ full moon
  function nightMoons(p) {
    return p.months_night.map((n, i) => ({ month: MONTHS[i], n, level: n >= NIGHT_FULL ? 2 : n >= NIGHT_PART ? 1 : 0 }));
  }
  function nightTag(p) {
    const m = nightMoons(p), full = m.filter(x => x.level === 2).length, any = m.filter(x => x.level > 0).length;
    return full >= 10 ? 'stays on' : any <= 3 ? 'comes and goes' : '';
  }
  const SCALE_C = [20, 100], CAP_K = 367;         // one thermometer scale for every place; newer camera stops at 367 K
  const pos = c => Math.max(0, Math.min(1, (c - SCALE_C[0]) / (SCALE_C[1] - SCALE_C[0])));
  function thermoBar(o) {
    if (!o || o.n < 10) return { few: true, n: o ? o.n : 0 };
    const lo = toC(o.p10_k), hi = toC(o.p90_k), mid = toC(o.median_k);
    return { few: false, n: o.n, lo, hi, mid, x0: pos(lo), x1: pos(hi), xm: pos(mid), k: [o.p10_k, o.median_k, o.p90_k] };
  }
  const CAP_X = pos(CAP_K - 273.15);
  const FLAME_CUTS = [2, 5, 15];                    // median fire power, MW: under 2 = 1, 2-5 = 2, 5-15 = 3, 15+ = 4
  const FLAME_WORDS = ['', 'faint', 'low', 'medium', 'strong'];
  function flameLevel(mw) { return 1 + FLAME_CUTS.filter(c => mw >= c).length; }
  function chips(p) {
    return [{ icon: 'cal', value: `${hotMonths(p)}/12`, alt: `Hot in ${hotMonths(p)} of 12 months` },
      { icon: 'moon', value: `${Math.round(p.night_share * 100)}%`, alt: `${Math.round(p.night_share * 100)} of every 100 sightings at night` },
      { icon: 'tally', value: `${p.days} days`, alt: `Spotted on ${p.days} days` }];
  }
  root.VCORE = { MONTHS, ANSWERS, NASA_WORDS, monthTotals, hotMonths, monthRange, nightWords, facts, stripCells, monthDetail, agrees, clue, score, drawRound, steadiness, thermo, toC, nightMoons, nightTag, thermoBar, flameLevel, FLAME_WORDS, chips, SCALE_C, CAP_X, NIGHT_FULL };
  if (typeof module !== 'undefined') module.exports = root.VCORE;
})(typeof window !== 'undefined' ? window : globalThis);
