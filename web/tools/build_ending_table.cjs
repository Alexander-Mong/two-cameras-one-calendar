// build_ending_table.cjs -> data/ending_table.json: every number the new ending's five screens show, computed from the engine and the country data.
// Ending builder, night of Nov 14, 2026.
// Usage: node tools/build_ending_table.cjs      (no network; reads the engine, js/readings.js and data/world_table.json; writes data/ending_table.json)
//
// Screen 1 (yardstick): the method of SUNDAY/review/yardstick/yardsticks.cjs, recomputed here for Argentina and the busy countries.
// Screens 2-3 (not just Argentina): the SECOND-MODEL recount's fairer rule (SUNDAY/review/CHECK_TONIGHT.md part 1, "matched years"):
//   per country keep only years complete in the product's record AND with all twelve months of raw Aqua (the older camera's own satellite;
//   nothing before July 2002, no translated Terra, no replaced months); a country is testable when all three readings have a year before
//   2022 and one after. Readings: stitched as it comes (product's one-scale years before 2022, the newer camera's own count from 2022),
//   one scale (the product's translation), the older camera alone (raw Aqua).
// Screen 4: the chat exchange is Readings.shortSentence for Argentina's latest period, as slide 7 builds it.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), BASE = path.join(ROOT, 'parts', 'engine_and_data');
const E = require(path.join(BASE, 'engine', 'hs_engine.js')), R = require(path.join(ROOT, 'js', 'readings.js'));
const WT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'world_table.json'), 'utf8'));
const OUT = path.join(ROOT, 'data', 'ending_table.json');

// the small multiples, in order; Argentina first (the one the room already knows). A country is shown only when all three readings
// agree on its biggest year (orchestrator, 21:40: "pick display countries where all three readings agree"), except Canada, which is
// shown as the record that holds (it agrees too: 2023 on all three).
const SHOW = ['Argentina', 'Brazil', 'India', 'United_States', 'Australia', 'Spain', 'Canada'];
const FLOOR = 50;
const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const best = s => s.filter(x => x[1] != null).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0] || null;

(async () => {
  const L = await E.open({ base: BASE });
  const busyFiles = WT.rows.filter(r => r.busy).map(r => r.file);
  const per = {};
  for (const file of busyFiles) {
    // ---- yardstick numbers (ext:false, as the yardstick script) ----
    const r0 = await E.query({ country: file }, L, { ext: false });
    const s = R.score(r0);
    const pairs = (r0.hide_a_year.SNPP.pairs || []).filter(p => p.aqua > 0);
    const rawBy = {}; for (const x of r0.monthly) rawBy[x.ym] = x.raw;
    const untr = pairs.map(p => (rawBy[p.ym].SNPP - p.aqua) / p.aqua * 100);
    const mo = r0.monthly.filter(x => x.status !== 'partial' && x.raw.SNPP !== null && x.raw.NOAA20 !== null && x.raw.SNPP >= FLOOR && !(x.short.SNPP || x.short.NOAA20));
    const same = mo.map(x => Math.abs(x.raw.NOAA20 - x.raw.SNPP) / x.raw.SNPP * 100);
    // ---- yearly readings (the product as the page runs it) ----
    const r = await E.query({ country: file }, L); await R.loadAvailability(L, r);
    const Y = R.yearly(r);
    const aquaYear = y => { let t = 0; for (let m = 1; m <= 12; m++) { const ym = y + '-' + String(m).padStart(2, '0'); const x = r.monthly.find(q => q.ym === ym);
      const a = x ? R.ownCounts(x, r).Aqua : null; if (a === null || a === undefined) return null; t += a; } return t; };
    const years = [];
    for (const y of Y) {
      if (!y.complete || y.ours == null || y.year < 2003 || y.year > 2025) continue;   // Aqua's first whole year is 2003; 2026 is unfinished
      const aqua = aquaYear(y.year); if (aqua === null) continue;
      const asis = y.year < 2022 ? y.ours : y.newerAsIs; if (asis == null) continue;
      years.push({ year: y.year, asis, one: y.ours, own: aqua });
    }
    const rd = k => { const all = years.map(y => [y.year, y[k]]), pre = all.filter(x => x[0] < 2022), post = all.filter(x => x[0] >= 2022);
      const b = best(all), bp = best(pre); return { best: b, pre: bp, post: best(post), after: !!b && b[0] >= 2022, times: b && bp && b[0] >= 2022 ? b[1] / bp[1] : null }; };
    const a = rd('asis'), o = rd('one'), w = rd('own');
    const testable = !!(a.pre && a.post && o.pre && o.post && w.pre && w.post);
    per[file] = { name: R.displayName(file), busy: true,
      yard: { typical_pct: s.typicalPct, test_months: s.months, untranslated_signed_median_pct: med(untr), untranslated_times: 1 + med(untr) / 100, same_camera_pct: med(same), same_camera_months: same.length },
      years, testable, asis: a, one: o, own: w,
      agree: testable && o.best[0] === w.best[0] };
  }
  const B = Object.values(per), T = B.filter(c => c.testable);
  const names = f => f.map(c => c.name);
  const records = {
    rule: 'matched years: complete in the product AND all twelve months of raw Aqua; at least one such year before 2022 and one after, in all three readings',
    busy: B.length, testable: T.length,
    untestable: names(B.filter(c => !c.testable)),
    stitched_after_2021: T.filter(c => c.asis.after).length,
    one_scale_after_2021: T.filter(c => c.one.after).length,
    older_alone_after_2021: T.filter(c => c.own.after).length,
    all_three: T.filter(c => c.asis.after && c.one.after && c.own.after).length,
    all_three_names: names(T.filter(c => c.asis.after && c.one.after && c.own.after)),
    false_pattern: T.filter(c => c.asis.after && !c.one.after && !c.own.after).length,
    disagree_names: names(T.filter(c => c.one.after !== c.own.after)),
    median_stitched_times: med(T.filter(c => c.asis.after).map(c => c.asis.times))
  };
  // the small multiples
  const shown = [], dropped = [];
  for (const f of SHOW) {
    const c = per[f]; if (!c) { dropped.push({ file: f, why: 'not a busy country' }); continue; }
    if (!c.testable) { dropped.push({ file: f, why: 'not testable on matched years' }); continue; }
    if (!c.agree) { dropped.push({ file: f, why: `one scale (${c.one.best[0]}) and the older camera alone (${c.own.best[0]}) disagree` }); continue; }
    shown.push({ file: f, name: c.name, first: c.years[0].year, last: c.years[c.years.length - 1].year,
      years: c.years.map(y => ({ year: y.year, asis: Math.round(y.asis), one: Math.round(y.one), own: y.own })),
      stitched_best: c.asis.best[0], stitched_times: c.asis.times, one_best: c.one.best[0], own_best: c.own.best[0],
      holds: c.asis.after && c.one.after && c.own.after, false_record: c.asis.after && !c.one.after && !c.own.after,
      gaps: (() => { const ys = c.years.map(y => y.year), g = []; for (let y = ys[0]; y <= ys[ys.length - 1]; y++) if (!ys.includes(y)) g.push(y); return g; })() });
  }
  // the yardstick (Argentina; and the middle busy country, for the notes)
  const ar = per.Argentina.yard;
  const yard = { place: 'Argentina', untranslated_times: ar.untranslated_times, translated_pct: ar.typical_pct, translated_months: ar.test_months,
    same_camera_pct: ar.same_camera_pct, same_camera_months: ar.same_camera_months,
    busy_middle: { untranslated_times: 1 + med(B.map(c => c.yard.untranslated_signed_median_pct)) / 100, translated_pct: med(B.map(c => c.yard.typical_pct)), same_camera_pct: med(B.filter(c => c.yard.same_camera_months).map(c => c.yard.same_camera_pct)) },
    // every busy country, for the optional dot view: a typical month's miss untranslated (in percent), translated, and between the two same cameras
    countries: B.map(c => ({ name: c.name, untranslated_pct: Math.abs(c.yard.untranslated_signed_median_pct), untranslated_times: c.yard.untranslated_times,
      translated_pct: c.yard.typical_pct, same_camera_pct: c.yard.same_camera_months ? c.yard.same_camera_pct : null })) };
  const yc = yard.countries;
  yard.world = { n: yc.length, translated_within25: yc.filter(c => c.translated_pct <= 25).length, untranslated_within25: yc.filter(c => c.untranslated_pct <= 25).length,
    untranslated_times_min: Math.min(...yc.map(c => c.untranslated_times)), untranslated_times_max: Math.max(...yc.map(c => c.untranslated_times)),
    translated_max: Math.max(...yc.map(c => c.translated_pct)), same_with_data: yc.filter(c => c.same_camera_pct != null).length };
  // the world, s6_p3: the record's yearly fire detections on one scale, 2003-2025, by the second-model recount's rule
  // (experiments_night/CHECK_WORLD.md, set "A66"): every country file whose product year AND raw Aqua year (twelve Aqua rows) are complete
  // in every year 2003-2025; product values with the 2026 extension off. The same countries every year.
  const WY = []; for (let yy = 2003; yy <= 2025; yy++) WY.push(yy);
  const tot = WY.map(() => 0), aquaTot = WY.map(() => 0); let members = [];
  for (const file of E.countries(L)) {
    const r = await E.query({ country: file }, L, { ext: false }); await R.loadAvailability(L, r);
    const Y = R.yearly(r), row = {};
    for (const y of Y) row[y.year] = y;
    let ok = true; const vals = [], aq = [];
    for (const yy of WY) {
      const y = row[yy]; if (!y || !y.complete || y.ours == null) { ok = false; break; }
      let a = 0; for (let m = 1; m <= 12 && ok; m++) { const x = r.monthly.find(q => q.ym === yy + '-' + String(m).padStart(2, '0')); const v = x ? R.ownCounts(x, r).Aqua : null; if (v == null) ok = false; else a += v; }
      if (!ok) break; vals.push(y.ours); aq.push(a);
    }
    if (!ok) continue;
    members.push(R.displayName(file)); vals.forEach((v, i) => { tot[i] += v; }); aq.forEach((v, i) => { aquaTot[i] += v; });
  }
  const mean = a => a.reduce((p, q) => p + q, 0) / a.length;
  const world = { rule: 'countries complete on one scale and in raw Aqua (twelve rows) in every year 2003-2025 (CHECK_WORLD.md set A66); one-scale product totals, 2026 extension off',
    countries: members.length, years: WY, totals: tot, aqua_totals: aquaTot,
    first5: { from: 2003, to: 2007, mean: mean(tot.slice(0, 5)) }, last5: { from: 2021, to: 2025, mean: mean(tot.slice(-5)) } };
  world.change_pct = 100 * (world.last5.mean / world.first5.mean - 1);

  // the connector screen: exchange 2 of round_SAT/mcp/EXAMPLES.md (Australia, December 2019), read from that file word for word,
  // and the Decembers it rests on, read from the engine (the connector's own numbers are checked against them below)
  let connector = null;
  try {
    const EX = fs.readFileSync(path.resolve(ROOT, '..', 'mcp', 'EXAMPLES.md'), 'utf8'), lines = EX.split('\n');
    const s0 = lines.findIndex(l => /^## 2\./.test(l)), s1 = lines.findIndex((l, i) => i > s0 && /^## 3\./.test(l));
    const sec = lines.slice(s0, s1).join('\n');
    const question = sec.match(/A person might type: "([^"]+)"/)[1];
    const call = JSON.parse(sec.match(/```json\n([\s\S]*?)\n```/)[1]).params;
    const said = sec.match(/What the chat model reads:\n\n```text\n([\s\S]*?)\n```/)[1].split('\n').filter(Boolean);
    const full = JSON.parse(sec.match(/The full response:\n\n```json\n([\s\S]*?)\n```/)[1]).result.structuredContent;
    const ra = await E.query({ country: full.place_file }, L);
    const mo = full.period.month.slice(5), decs = ra.monthly.filter(x => x.ym.slice(5) === mo && x.ym.slice(0, 4) <= full.record_runs.to.slice(0, 4)).map(x => ({ year: +x.ym.slice(0, 4), value: x.value }));
    const me = decs.find(x => x.year === full.period.year), others = decs.filter(x => x.year !== full.period.year).map(x => x.value).sort((a, b) => a - b);
    const usual = others.length % 2 ? others[(others.length - 1) / 2] : (others[others.length / 2 - 1] + others[others.length / 2]) / 2;
    connector = { source: `round_SAT/mcp/EXAMPLES.md lines ${s0 + 1}-${s1}`, question, tool: call.name, args: call.arguments, said,
      place: full.place, label: full.period.label, record_from: full.record_runs.from, record_to: full.record_runs.to,
      detections: full.our_record.detections_exact, usual: full.our_record.usual, years_compared: full.our_record.years_compared,
      verdict: full.verdict.words, compared: full.our_record.compared_with_usual, rank_fraction: full.our_record.verdict_basis.rank_fraction,
      too_little: full.our_record.too_little_to_judge, unit: full.unit,
      months: decs, engine_value: me && me.value, engine_usual: usual, engine_higher_than: others.filter(v => me && v < me.value).length };
    if (Math.round(connector.engine_value) !== connector.detections || Math.abs(connector.engine_usual - connector.usual) > 0.06) console.log('CONNECTOR MISMATCH', connector.engine_value, connector.detections, connector.engine_usual, connector.usual);
  } catch (e) { console.log('CONNECTOR exchange not read: ' + e.message); }

  // the chat (slide 7's own exchange, read now from the product)
  const ra = await E.query({ country: 'Argentina' }, L); await R.loadAvailability(L, ra);
  let chat = null;
  try { const P = R.forPeriod(ra, 'latest'), ans = R.shortSentence(ra, 'latest');
    if (P && !P.refusal) chat = { place: P.placeIn || P.place || 'Argentina', period: P.periodLabel || null, answer: ans,
      ours: P.ours && P.ours.value != null ? Math.round(P.ours.value) : null, ours_typical: P.ours && P.ours.typical != null ? Math.round(P.ours.typical) : null,
      older: P.older && P.older.value != null ? Math.round(P.older.value) : null, older_typical: P.older && P.older.typical != null ? Math.round(P.older.typical) : null };
  } catch (e) { chat = { error: e.message }; }
  const out = { made: 'tools/build_ending_table.cjs, ' + new Date().toISOString(), note: ' Counts are satellite fire detections (about 5 km squares where a camera saw fire on a day).',
    yardstick: yard, records, small_multiples: shown, dropped, world, connector, chat,
    links: { page: null, connector: null, repo: null, note: 'addresses are not stored here (the public copy must not carry them): js/beats.js and local/addresses.js' } };
  fs.writeFileSync(OUT, JSON.stringify(out, null, 1));
  console.log('YARDSTICK', JSON.stringify(yard));
  console.log('RECORDS', JSON.stringify(records));
  console.log('SHOWN', shown.map(s => `${s.name} ${s.first}-${s.last} stitched ${s.stitched_best} x${s.stitched_times && s.stitched_times.toFixed(2)} one ${s.one_best} own ${s.own_best}${s.gaps.length ? ' gaps ' + s.gaps : ''}`).join(' | '));
  console.log('DROPPED', JSON.stringify(dropped));
  console.log('CHAT', JSON.stringify(chat));
  console.log('WORLD', world.countries, 'countries', world.totals.map(v => Math.round(v * 10) / 10).join(' '), 'change', world.change_pct.toFixed(2) + '%');
})();
