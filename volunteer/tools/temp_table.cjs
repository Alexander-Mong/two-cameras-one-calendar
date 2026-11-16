//
// Do the cameras' temperature readings separate NASA-fire places from not-fire places? Tabulates each fact
// against NASA's label and gives a separation score (AUC: 0.5 = coin toss, 1.0 = perfect; computed on these
// 50 hand-picked places only, so it describes this list, not the world). Writes probe/temperature_vs_label.md.
const fs = require('fs'); const path = require('path');
const VOL = path.dirname(__dirname);
const P = JSON.parse(fs.readFileSync(path.join(VOL, 'data', 'places.json'), 'utf8')).places;
const C = require(path.join(VOL, 'site', 'core.js'));
const K = v => v == null ? '' : (v - 273.15).toFixed(0);
const facts = {
  'VIIRS night readings (count)': p => p.temp.viirs_night.n,
  'VIIRS typical night reading (K)': p => p.temp.viirs_night.n >= 10 ? p.temp.viirs_night.median_k : null,
  'VIIRS typical day reading (K)': p => p.temp.viirs_day.n >= 10 ? p.temp.viirs_day.median_k : null,
  'VIIRS night spread, 10th to 90th (K)': p => p.temp.viirs_night.n >= 10 ? p.temp.viirs_night.p90_k - p.temp.viirs_night.p10_k : null,
  'VIIRS day spread, 10th to 90th (K)': p => p.temp.viirs_day.n >= 10 ? p.temp.viirs_day.p90_k - p.temp.viirs_day.p10_k : null,
  'MODIS typical day reading (K)': p => p.temp.modis_day.n >= 10 ? p.temp.modis_day.median_k : null,
  'Typical fire power (MW)': p => p.frp_median_mw,
  'Share of sightings at night': p => p.night_share,
  'Months hot': p => C.hotMonths(p),
};
function auc(a, b) { let s = 0, n = 0; for (const x of a) for (const y of b) { n++; s += x > y ? 1 : x === y ? 0.5 : 0; } return n ? s / n : null; }
let out = '# Temperature readings against NASA\'s label (50 places)\n\n Built by `tools/temp_table.cjs` from `data/places.json`. AUC: chance that a not-fire place reads higher than a fire place (0.5 coin toss; 1.0 or 0.0 = perfect split). Readings on fewer than 10 detections left out. Hand-picked list: describes these 50, not the world.\n\n| Fact | not-fire places (n) median | fire places (n) median | AUC | separates? |\n|---|---|---|---|---|\n';
const med = a => { const s = a.slice().sort((x, y) => x - y); return s.length ? s[s.length >> 1] : null; };
const rows = [];
for (const [name, f] of Object.entries(facts)) {
  const nf = P.filter(p => p.nasa_answer !== 'fire').map(f).filter(v => v != null), fi = P.filter(p => p.nasa_answer === 'fire').map(f).filter(v => v != null);
  const a = auc(nf, fi); const sep = Math.abs(a - 0.5) * 2;
  rows.push({ name, a, sep });
  out += `| ${name} | ${nf.length}: ${(+med(nf)).toFixed(1)} | ${fi.length}: ${(+med(fi)).toFixed(1)} | ${a.toFixed(2)} | ${sep >= 0.8 ? 'yes, on this list' : sep >= 0.5 ? 'partly' : 'no'} |\n`;
}
out += '\n## Each place\n\n| id | NASA | VIIRS night: n, typical °C [10th-90th] | VIIRS day: n, typical °C [10th-90th] | steadiness (VIIRS night) | MODIS day: n, typical °C |\n|---|---|---|---|---|---|\n';
const r = o => o.n >= 10 ? `${o.n}, ${K(o.median_k)} [${K(o.p10_k)} to ${K(o.p90_k)}]` : `${o.n} (too few)`;
for (const p of P) out += `| ${p.id} | ${p.nasa_answer} | ${r(p.temp.viirs_night)} | ${r(p.temp.viirs_day)} | ${C.steadiness(p) ? C.steadiness(p).label : '-'} | ${r(p.temp.modis_day)} |\n`;
fs.writeFileSync(path.join(VOL, 'probe', 'temperature_vs_label.md'), out);
console.log(rows.sort((x, y) => y.sep - x.sep).map(x => `${x.sep.toFixed(2)}  AUC ${x.a.toFixed(2)}  ${x.name}`).join('\n'));
