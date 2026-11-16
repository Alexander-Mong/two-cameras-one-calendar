// build_fire_power.cjs: data/fire_power.json, the numbers behind slide 3's "smarter version" press (team lead, 10:43 PM).
//   Usage: node tools/build_fire_power.cjs   (then node tools/check_numbers.cjs)
// For every country with a lot of fire (data/world_table.json: busy, with a typical miss), the engine is run both ways
// (method 'plain' and 'strength'), and the left-out-year test is scored on the months both methods tested (their intersection):
// a country's typical monthly miss = the median of |translated - older camera| / older camera x 100 over those months.
// "Closer" = the strength method's typical miss is more than one point lower; "worse" = more than one point higher; else a tie.
// The seven chances are NOT stored here: the slide reads them from the engine's own curve (parts/engine_and_data/data/world_by_country/shared/curve.json).
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), BASE = path.join(ROOT, 'parts', 'engine_and_data');
const E = require(path.join(BASE, 'engine', 'hs_engine.js'));
const median = a => { const s = a.slice().sort((x, y) => x - y), n = s.length; return n ? (n % 2 ? s[(n - 1) / 2] : (s[n / 2 - 1] + s[n / 2]) / 2) : null; };
async function compute() {
  const L = await E.open({ base: BASE });
  const W = JSON.parse(fs.readFileSync(path.join(ROOT, 'data', 'world_table.json'), 'utf8'));
  const busy = W.rows.filter(r => r.busy && r.typical_pct != null);
  const rows = [];
  for (const r of busy) {
    let res = {};
    for (const method of ['plain', 'strength']) {
      let q = null;
      for (const name of [r.file, r.name]) { try { q = await E.query({ country: name }, L, { method }); if (q && q.hide_a_year) break; } catch (e) { q = null; } }
      if (!q || !q.hide_a_year || !q.hide_a_year.SNPP) throw new Error('no left-out-year test for ' + r.name + ' (' + method + ')');
      res[method] = new Map(q.hide_a_year.SNPP.pairs.filter(p => p.aqua > 0 && p.predicted != null && isFinite(p.predicted)).map(p => [p.ym, Math.abs(p.predicted - p.aqua) / p.aqua * 100]));
    }
    const both = [...res.plain.keys()].filter(k => res.strength.has(k));
    const plain = median(both.map(k => res.plain.get(k))), strength = median(both.map(k => res.strength.get(k)));
    rows.push({ name: r.name, months: both.length, plain: +plain.toFixed(3), strength: +strength.toFixed(3), verdict: strength < plain - 1 ? 'closer' : strength > plain + 1 ? 'worse' : 'tie' });
  }
  const n = v => rows.filter(r => r.verdict === v).length;
  return { made: 'Built by tools/build_fire_power.cjs from the engine (plain against strength, left-out-year test, months both tested; closer = typical monthly miss more than one point lower).',
    countries: rows.length, closer: n('closer'), tie: n('tie'), worse: n('worse'), worseNames: rows.filter(r => r.verdict === 'worse').map(r => r.name),
    middle: { plain: +median(rows.map(r => r.plain)).toFixed(2), strength: +median(rows.map(r => r.strength)).toFixed(2) }, months: rows.reduce((a, r) => a + r.months, 0), rows };
}
module.exports = { compute };
if (require.main === module) compute().then(t => { fs.writeFileSync(path.join(ROOT, 'data', 'fire_power.json'), JSON.stringify(t, null, 1) + '\n');
  console.log(`fire_power.json: ${t.countries} countries; closer ${t.closer}, tie ${t.tie}, worse ${t.worse} (${t.worseNames.join(', ')}); middle country ${t.middle.plain}% -> ${t.middle.strength}%; ${t.months} country-months`); })
  .catch(e => { console.error('ERROR ' + e.message); process.exit(2); });
