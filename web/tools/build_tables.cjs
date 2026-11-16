// build_tables.cjs -> data/world_table.json: one row per country file, from the engine run over every file in Node, read through js/readings.js.
// Then compares the busy group, the nine failures and the middle busy country with the claims sheet and the world table lane, and PRINTS
// any difference (never smooths it).   Usage: node tools/build_tables.cjs
'use strict';
const fs = require('fs'), path = require('path');
const ROOT = path.resolve(__dirname, '..'), BASE = path.join(ROOT, 'parts', 'engine_and_data');
const E = require(path.join(BASE, 'engine', 'hs_engine.js')), A = require(path.join(BASE, 'adapters.js')), R = require(path.join(ROOT, 'js', 'readings.js'));
const LANE = path.resolve(ROOT, '..', 'work', 'atk_world_table', 'world_table.json');

// map classes (design section 4, room 3, "The world"); order of precedence is written here once
function classOf(row) {
  if (row.refused) return 'nodata';
  if (row.rule === 'one') return 'one';
  if (row.typical_pct === null || row.rule === 'curve' || row.rule === 'none') return 'noscore';
  if (!row.busy) return 'quiet';
  const p = row.typical_pct;
  return p <= 10 ? 'p10' : p <= 15 ? 'p15' : p <= 25 ? 'p25' : 'p25plus';
}

(async () => {
  const L = await E.open({ base: BASE });
  const rows = [];
  for (const file of E.countries(L)) {
    const r = await E.query({ country: file }, L); await R.loadAvailability(L, r);
    const s = R.score(r), f = R.forPeriod(r, 'latest');
    const pairs = (r.hide_a_year.SNPP.pairs || []).map(p => p.aqua).filter(a => a > 0);
    const medAqua = A.median(pairs);
    const row = { file, name: R.displayName(file), rule: s.rule, scored: s.scored, typical_pct: s.typicalPct, one_in_ten_pct: s.oneInTenPct, months: s.months,
      busy: s.typicalPct !== null && medAqua !== null && medAqua >= 50, median_tested_older_count: medAqua,
      latest: r.current ? r.current.ym : r.latest ? r.latest.ym : null, record_ends: r.latest ? r.latest.ym : null, partial: !!r.current,
      refused: f.refusal ? f.refusal.message : null,
      period: f.refusal ? null : { label: f.periodLabel, ours: f.ours.value, typical: f.ours.typical, word: f.ours.word, tooFew: f.ours.tooFew,
        older: f.older ? { value: f.older.value, typical: f.older.typical, word: f.older.word } : null, olderMissing: !!f.olderMissing } };
    row.cls = classOf(row);
    rows.push(row);
  }
  const busy = rows.filter(x => x.busy), med = A.median(busy.map(x => x.typical_pct));
  const fails = busy.filter(x => x.typical_pct > 30).sort((a, b) => b.typical_pct - a.typical_pct);
  const counts = {}; for (const x of rows) counts[x.cls] = (counts[x.cls] || 0) + 1;
  const out = { made: ' Built by tools/build_tables.cjs from the copied engine, every country file. Pencil.',
    classes: { p10: 'within 10%', p15: '10 to 15%', p25: '15 to 25%', p25plus: 'more than 25%', one: 'one-number rule: treat with care', noscore: 'no fair score', quiet: 'scored, but too quiet to compare', nodata: 'no usable month' },
    summary: { files: rows.length, scored: rows.filter(x => x.scored).length, busy_twelve: busy.filter(x => x.rule === 'twelve').length, one_busy: busy.filter(x => x.rule === 'one').length,
      noscore_unscored: rows.filter(x => x.cls === 'noscore' && !x.scored).length, noscore_curve: rows.filter(x => x.cls === 'noscore' && x.rule === 'curve').length, busy: busy.length, middle_busy_pct: med,
      within10: busy.filter(x => x.typical_pct <= 10).length, within15: busy.filter(x => x.typical_pct <= 15).length, within25: busy.filter(x => x.typical_pct <= 25).length,
      failing: fails.map(x => x.file), class_counts: counts, end_before_dec_2025: rows.filter(x => x.latest && x.latest < '2025-12').length },
    rows };
  fs.mkdirSync(path.join(ROOT, 'data'), { recursive: true });
  fs.writeFileSync(path.join(ROOT, 'data', 'world_table.json'), JSON.stringify(out));
  console.log('files', rows.length, '| scored', out.summary.scored, '| busy', busy.length, '| middle busy', med && med.toFixed(2) + '%',
    '| within 10/15/25:', out.summary.within10, out.summary.within15, out.summary.within25);
  console.log('failing busy (>30%):', fails.map(x => x.file + ' ' + x.typical_pct.toFixed(1) + '% ' + x.rule).join(', '));
  console.log('classes:', JSON.stringify(counts), '| places ending before Dec 2025:', out.summary.end_before_dec_2025);
  // ---- compare with the claims sheet (WHAT_WE_CAN_SAY_v2 B2/B3) ----
  const sheet = { scored: 177, busy: 71, middle: '13.6', within10: 21, within15: 44, within25: 62,
    failing: ['Ghana', 'Lao_PDR', 'Togo', 'Burkina_Faso', 'Liberia', 'Benin', 'Sierra_Leone', 'Zimbabwe', 'Nepal'] };
  const diffs = [];
  if (out.summary.scored !== sheet.scored) diffs.push('scored ' + out.summary.scored + ' vs sheet 177');
  if (busy.length !== sheet.busy) diffs.push('busy ' + busy.length + ' vs sheet 71');
  if (!med || med.toFixed(1) !== sheet.middle) diffs.push('middle ' + (med && med.toFixed(2)) + ' vs sheet 13.6');
  for (const k of ['within10', 'within15', 'within25']) if (out.summary[k] !== sheet[k]) diffs.push(k + ' ' + out.summary[k] + ' vs sheet ' + sheet[k]);
  const fs1 = fails.map(x => x.file).sort().join(','), fs2 = sheet.failing.slice().sort().join(',');
  if (fs1 !== fs2) diffs.push('failing set differs: ours ' + fs1 + ' | sheet ' + fs2);
  console.log('claims sheet comparison:', diffs.length ? 'DIFFERENCES: ' + diffs.join('; ') : 'no difference');
  // ---- compare with the world table lane ----
  if (fs.existsSync(LANE)) {
    let lane = JSON.parse(fs.readFileSync(LANE, 'utf8')); if (!Array.isArray(lane)) lane = lane.rows || lane.countries || Object.values(lane);
    const keyOf = (o) => o.country || o.file || o.name, pctOf = (o) => o.plain_typ !== undefined ? o.plain_typ : o.typical_pct !== undefined ? o.typical_pct : o.median_pct !== undefined ? o.median_pct : o.typical;
    let compared = 0; const ld = [];
    for (const o of lane) { const k = keyOf(o), mine = rows.find(x => x.file === k); const p = pctOf(o);
      if (!mine || p === undefined || p === null || typeof p !== 'number' || mine.rule === 'curve') continue; compared++;
      if (mine.typical_pct === null || Math.abs(mine.typical_pct - p) > 0.05) ld.push(k + ' ours ' + (mine.typical_pct === null ? 'none' : mine.typical_pct.toFixed(2)) + ' lane ' + p.toFixed(2)); }
    console.log('world table lane comparison: ' + compared + ' countries compared; ' + (ld.length ? ld.length + ' differ by more than 0.05 points: ' + ld.slice(0, 20).join('; ') + (ld.length > 20 ? ' ...' : '') : 'no difference'));
  } else console.log('world table lane file not found: ' + path.relative(ROOT, LANE));
})().catch(e => { console.error('CRASH', e); process.exitCode = 1; });
