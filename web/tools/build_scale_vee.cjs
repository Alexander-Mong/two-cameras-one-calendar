/* Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md. */
// build_scale_vee.cjs: data/scale_vee.json, the numbers for StoryBeats.historyScale = 'vee' (team lead's question, 12:39 AM: lift Moe's
// years UP to Vee's scale instead of bringing Vee's DOWN to Moe's). the default stays 'moe'.
// Usage: node tools/build_scale_vee.cjs   (then node tools/check_numbers.cjs)
// Vee's scale = Readings.onScale(result, 'viirs'): every month of the product divided by its month's conversion number (the page's own unit
// switch; reverse_join/UNIT_SWITCH_BUILT.md). Nothing new is computed in the engine.
//  - Slide 6 (small multiples): the same matched-years rule as tools/build_ending_table.cjs (complete product year AND twelve raw Aqua months;
//    at least one such year before 2022 and one after), the same testable countries; the biggest year read on Vee's scale.
//  - The world chart: the same 66-country set (CHECK_WORLD.md "A66") where every country can switch; a country that cannot (no conversion
//    numbers of its own, or a month whose number is zero) is left out and named.
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), BASE = path.join(ROOT, 'parts', 'engine_and_data');
const E = require(path.join(BASE, 'engine', 'hs_engine.js')), R = require(path.join(ROOT, 'js', 'readings.js'));
const WT = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'world_table.json'), 'utf8'));
const ET = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'ending_table.json'), 'utf8'));
const best = s => s.filter(x => x[1] != null).sort((a, b) => b[1] - a[1] || a[0] - b[0])[0] || null;
const med = a => { if (!a.length) return null; const s = a.slice().sort((x, y) => x - y), n = s.length; return n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2; };
const mean = a => a.reduce((p, q) => p + q, 0) / a.length;

async function compute() {
  const L = await E.open({ base: BASE });
  const yearsOf = async (file, opts) => { const r = await E.query({ country: file }, L, opts || {}); await R.loadAvailability(L, r);
    const v = R.onScale(r, 'viirs'); return { r, Ym: R.yearly(r), Yv: v ? R.yearly(v) : null, why: v ? null : R.scaleCheck(r).why }; };
  // ---- slide 2: Argentina, 2022 against the other whole years, on Vee's scale (the scene's own rule: the middle of the OTHER whole years) ----
  const A = await yearsOf('Argentina');
  const arg = sc => { const Y = (sc === 'vee' ? A.Yv : A.Ym).filter(y => y.complete && y.ours != null), g = Y.find(y => y.year === 2022);
    const others = Y.filter(y => y.year !== 2022).map(y => y.ours), typical = med(others), pre = Y.filter(y => y.year < 2022).sort((a, b) => b.ours - a.ours)[0];
    return { y2022: g.ours, typical, vs_typical_pct: 100 * (g.ours / typical - 1), biggest_year: Y.slice().sort((a, b) => b.ours - a.ours)[0].year, biggest_before_2022: { year: pre.year, value: pre.ours },
      glued_2022: g.newerAsIs, years: Y.map(y => ({ year: y.year, v: y.ours })) }; };
  const argentina = { moe: arg('moe'), vee: arg('vee') };
  // two tones (team lead, 8:21 AM): before 2022 each bar on Vee's scale = what Moe counted (the record on Moe's scale; 2003-2021 that IS Moe's own
  // Aqua count, 2001-2002 the other MODIS camera, Terra) + what the translation adds; from 2022 the bar is Vee's own count (nothing added)
  const mOf = {}; argentina.moe.years.forEach(y => { mOf[y.year] = y.v; });
  argentina.two_tone = argentina.vee.years.map(y => ({ year: y.year, vee: y.v, moe: y.year < 2022 ? mOf[y.year] : null, added: y.year < 2022 ? y.v - mOf[y.year] : null }));
  // ---- slide 6: biggest year after 2021, on Vee's scale ----
  const busy = WT.rows.filter(r => r.busy).map(r => r.file), per = {};
  for (const file of busy) {
    const { r, Ym, Yv, why } = await yearsOf(file);
    const aquaYear = y => { let t = 0; for (let m = 1; m <= 12; m++) { const x = r.monthly.find(q => q.ym === y + '-' + String(m).padStart(2, '0')); const a = x ? R.ownCounts(x, r).Aqua : null; if (a == null) return null; t += a; } return t; };
    const vOf = {}; if (Yv) for (const y of Yv) vOf[y.year] = y;
    const years = [];
    for (const y of Ym) {
      if (!y.complete || y.ours == null || y.year < 2003 || y.year > 2025) continue;
      if (aquaYear(y.year) === null) continue;
      const asis = y.year < 2022 ? y.ours : y.newerAsIs; if (asis == null) continue;
      const v = vOf[y.year]; years.push({ year: y.year, asis, one: y.ours, vee: v && v.complete && v.ours != null ? v.ours : null });
    }
    const rd = k => { const all = years.map(y => [y.year, y[k]]), pre = all.filter(x => x[0] < 2022), post = all.filter(x => x[0] >= 2022), b = best(all);
      return { best: b, after: !!b && b[0] >= 2022, ok: !!(best(pre) && best(post)) }; };
    per[file] = { name: R.displayName(file), years, one: rd('one'), vee: rd('vee'), canSwitch: !!Yv, why, missingVee: years.filter(y => y.vee == null).map(y => y.year) };
  }
  // the same testable set as ending_table.json (its rule), so the two counts compare like with like
  const testable = Object.entries(per).filter(([f, c]) => c.one.ok && !ET.records.untestable.includes(c.name));
  const T = testable.map(([, c]) => c), cnt = k => T.filter(c => c[k].after).length;
  const records = { testable: T.length, one_scale_after_2021: cnt('one'), vee_scale_after_2021: T.filter(c => c.vee.ok && c.vee.after).length,
    vee_not_testable: T.filter(c => !c.vee.ok).map(c => c.name + (c.missingVee.length ? ' (no Vee-scale total for ' + c.missingVee.join(', ') + ')' : '')),
    changed: T.filter(c => c.vee.ok && c.vee.after !== c.one.after).map(c => ({ name: c.name, moe_best: c.one.best[0], vee_best: c.vee.best[0] })) };
  // the small multiples already on screen: their years on Vee's scale, and the biggest year there
  const small = ET.small_multiples.map(sm => { const c = per[sm.file]; const byY = {}; for (const y of c.years) byY[y.year] = y.vee;
    return { file: sm.file, name: sm.name, vee: sm.years.map(y => byY[y.year] == null ? null : Math.round(byY[y.year])),
      moe: sm.years.map(y => y.year < 2022 ? y.one : null), added: sm.years.map(y => y.year < 2022 && byY[y.year] != null ? Math.round(byY[y.year]) - y.one : null), vee_best: c.vee.best ? c.vee.best[0] : null, one_best: sm.one_best, stitched_best: sm.stitched_best }; });
  // ---- the world chart: the A66 set, on Vee's scale, the countries that can switch ----
  const WY = ET.world.years, members = [], left = [], tot = WY.map(() => 0);
  for (const file of E.countries(L)) {
    const r = await E.query({ country: file }, L, { ext: false }); await R.loadAvailability(L, r);
    const Ym = R.yearly(r), row = {}; for (const y of Ym) row[y.year] = y;
    let ok = true;
    for (const yy of WY) { const y = row[yy]; if (!y || !y.complete || y.ours == null) { ok = false; break; }
      for (let m = 1; m <= 12 && ok; m++) { const x = r.monthly.find(q => q.ym === yy + '-' + String(m).padStart(2, '0')); if (!x || R.ownCounts(x, r).Aqua == null) ok = false; } if (!ok) break; }
    if (!ok) continue;                                                    // not in A66
    const v = R.onScale(r, 'viirs'); const Yv = v ? R.yearly(v) : null, vr = {}; if (Yv) for (const y of Yv) vr[y.year] = y;
    const vals = WY.map(yy => vr[yy] && vr[yy].complete && vr[yy].ours != null ? vr[yy].ours : null);
    if (!v || vals.some(x => x == null)) { left.push(R.displayName(file) + ': ' + (v ? 'a year with no Vee-scale total' : R.scaleCheck(r).why.replace(/^Only on MODIS's scale here: /, ''))); continue; }
    members.push(R.displayName(file)); vals.forEach((x, i) => { tot[i] += x; });
  }
  const world = { rule: 'the A66 countries (ending_table.json world) that can switch to Vee\'s scale in every year 2003-2025; product totals divided month by month', countries: members.length, a66: ET.world.countries,
    left_out: left, years: WY, totals: tot, first5: { from: 2003, to: 2007, mean: mean(tot.slice(0, 5)) }, last5: { from: 2021, to: 2025, mean: mean(tot.slice(-5)) } };
  world.change_pct = 100 * (world.last5.mean / world.first5.mean - 1);
  world.moe = WY.map((yy, i) => yy < 2022 ? ET.world.totals[i] : null);       // the same 66 countries on Moe's scale (ending_table.json)
  world.added = WY.map((yy, i) => yy < 2022 ? tot[i] - ET.world.totals[i] : null);
  // the same countries on Moe's scale, for a like-for-like comparison of the change
  return { made: 'Built by tools/build_scale_vee.cjs (Readings.onScale(result, "viirs")). Pencil; the default historyScale is "moe".', argentina, records, small_multiples: small, world };
}
module.exports = { compute };
if (require.main === module) compute().then(t => { fs.writeFileSync(path.join(ROOT, 'data', 'scale_vee.json'), JSON.stringify(t, null, 1) + '\n');
  const a = t.argentina;
  console.log(`Argentina 2022: Moe's scale ${Math.round(a.moe.y2022)} vs typical ${Math.round(a.moe.typical)} (${a.moe.vs_typical_pct.toFixed(1)}%); Vee's scale ${Math.round(a.vee.y2022)} vs typical ${Math.round(a.vee.typical)} (${a.vee.vs_typical_pct.toFixed(1)}%); biggest year moe ${a.moe.biggest_year}, vee ${a.vee.biggest_year}`);
  console.log(`slide 6: testable ${t.records.testable}; after 2021 on Moe's scale ${t.records.one_scale_after_2021}, on Vee's scale ${t.records.vee_scale_after_2021}; changed ${JSON.stringify(t.records.changed)}; not testable on Vee ${JSON.stringify(t.records.vee_not_testable)}`);
  console.log(`small multiples vee_best: ${t.small_multiples.map(s => s.name + ' ' + s.vee_best + ' (moe ' + s.one_best + ')').join(', ')}`);
  console.log(`world: ${t.world.countries} of ${t.world.a66}; change ${t.world.change_pct.toFixed(2)}%; left out ${t.world.left_out.length}: ${t.world.left_out.join(' | ')}`); })
  .catch(e => { console.error('ERROR ' + e.stack); process.exit(2); });
