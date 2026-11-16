//
// Recompute every number the page shows from the data, with code separate from the page's.
//  1. From the NASA rows themselves (work/app_hot_spot_search/data/World2020/*.bin): each place's month-by-month
//     counts per camera, night share, days, label counts, median fire power (0.02-degree square, as built).
//  2. From data/places.json: the page's facts, heat strip, month details, clue and score (site/core.js) against
//     an independent re-derivation here.
//  3. Rules: no names, coordinates to 2 decimals, half steady/half fire, site copy = data copy.
// usage: node tools/check_places.cjs
'use strict';
const fs = require('fs'); const path = require('path'); const zlib = require('zlib');
const VOL = path.dirname(__dirname);
const SRC = path.join(VOL, '..', '..', 'work', 'app_hot_spot_search', 'data', 'World2020');
const D = JSON.parse(fs.readFileSync(path.join(VOL, 'data', 'places.json'), 'utf8'));
const SITE = JSON.parse(fs.readFileSync(path.join(VOL, 'site', 'data', 'places.json'), 'utf8'));
const C = require(path.join(VOL, 'site', 'core.js'));
let pass = 0, fail = 0; const bad = [];
const ok = (c, name) => { if (c) pass++; else { fail++; bad.push(name); } };
const P = D.places;
const MON = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];

// ---- 3. rules
ok(JSON.stringify(D.places) === JSON.stringify(SITE.places), 'site copy equals data copy');
ok(new Set(P.map(p => p.id)).size === P.length, 'ids unique');
ok(P.length >= 40 && P.length <= 60, '40 to 60 places: ' + P.length);
const nFire = P.filter(p => p.nasa_answer === 'fire').length;
ok(Math.abs(nFire - P.length / 2) <= 3, `about half fire: ${nFire} of ${P.length}`);
ok(P.filter(p => p.practice).length === 3, 'three practice places');
const allowed = new Set(['id', 'kind_rule', 'lat', 'lon', 'months_modis', 'months_viirs', 'detections', 'days', 'night_share', 'frp_median_mw', 'frp_max_mw', 'nasa_label', 'first_day', 'last_day', 'busiest_day', 'nasa_answer', 'picture_dates', 'picture_found', 'practice', 'sharp', 'first_view', 'temp', 'months_night']);
for (const p of P) {
  ok(Object.keys(p).every(k => allowed.has(k)), p.id + ' has only known fields (no names)');
  ok(Math.round(p.lat * 100) / 100 === p.lat && Math.round(p.lon * 100) / 100 === p.lon, p.id + ' lat/lon at 2 decimals');
  const sumM = p.months_modis.reduce((a, b) => a + b, 0) + p.months_viirs.reduce((a, b) => a + b, 0);
  const sumL = Object.values(p.nasa_label).reduce((a, b) => a + b, 0);
  ok(sumM === p.detections && sumL === p.detections, p.id + ' months and labels add up to detections');
  const top = Object.entries(p.nasa_label).sort((a, b) => b[1] - a[1])[0][0];
  ok({ vegetation_fire: 'fire', volcano: 'volcano', other_static_land: 'industry', offshore: 'offshore' }[top] === p.nasa_answer, p.id + ' answer = majority label');
  if (p.kind_rule === 'steady') ok(p.months_viirs.filter(x => x).length >= 10 && (p.detections - p.nasa_label.vegetation_fire) >= 0.6 * p.detections, p.id + ' steady rule holds');
  if (p.kind_rule === 'fire') ok(p.nasa_label.vegetation_fire >= 0.98 * p.detections, p.id + ' fire rule holds');
}
for (const p of P) {
  for (const sh of p.sharp || []) for (const f of [sh.close, sh.heat]) {
    const fp = path.join(VOL, 'site', 'img', 'places', f);
    ok(fs.existsSync(fp) && fs.statSync(fp).size < 150 * 1024, p.id + ' stored picture present and under 150 KB: ' + f);
  }
  ok((p.sharp || []).every(sh => sh.date >= (p.kind_rule === 'fire' ? '2020-01-01' : '2020-01-01') && sh.date <= '2021-01-31'), p.id + ' stored picture dates in range');
  if (p.first_view) ok(['wide', 'close', 'heat', 'night'].includes(p.first_view), p.id + ' first view is a tab');
}
const txt = fs.readFileSync(path.join(VOL, 'data', 'places.json'), 'utf8');
ok(!/flare|refinery|oil field|plant\b|steel/i.test(txt), 'no facility words in the data');

// ---- 2. page numbers vs independent re-derivation
for (const p of P) {
  const tot = p.months_viirs.map((v, i) => v + p.months_modis[i]);
  const on = tot.map((x, i) => x ? i : -1).filter(i => i >= 0);
  const m = on.length;
  const range = MON[on[0]] === MON[on[on.length - 1]] ? MON[on[0]] : MON[on[0]] + ' to ' + MON[on[on.length - 1]];
  const nw = p.night_share >= 0.7 ? 'mostly at night' : p.night_share <= 0.3 ? 'mostly by day' : 'by day and by night';
  const f = C.facts(p);
  ok(f[0] === (m === 12 ? 'Hot in all 12 months of 2020.' : m >= 10 ? `Hot in ${m} of 12 months of 2020.` : `Hot in only ${m} of 12 months (${range}).`), p.id + ' fact 1: ' + f[0]);
  ok(f[1].includes(`${Math.round(p.night_share * 100)} of every 100`) && f[1].includes(nw), p.id + ' fact 2: ' + f[1]);
  ok(f[2] === `Spotted on ${p.days} different days.`, p.id + ' fact 3');
  const cells = C.stripCells(p);
  ok(cells.every((c, i) => c.n === tot[i] && c.viirs === p.months_viirs[i] && c.modis === p.months_modis[i] && (c.n === 0) === (c.shade === 0)), p.id + ' heat strip');
  ok(cells.every(c => C.monthDetail(c).includes(c.n ? String(c.viirs) : 'no heat')), p.id + ' month details');
  const cl = C.clue(p);
  ok(p.nasa_answer === 'volcano' ? cl.includes(`hot in ${m} of 12`) : p.nasa_answer === 'fire' ? cl.includes(m <= 3 ? `only ${m} month` : `hot in ${m} months`) : cl.includes(`${m} of 12 months`), p.id + ' clue numbers: ' + cl);
}
for (const p of P) {
  const L = C.thermo(p), t = p.temp, nn = t.viirs_night.n + t.modis_night.n;
  ok(L[0].text.includes(nn ? nn.toLocaleString('en-US') : 'never'), p.id + ' thermometer first line = night readings ' + nn);
  for (const [k, cam, when] of [['viirs_night', 'Vee', 'night'], ['viirs_day', 'Vee', 'day'], ['modis_night', 'Moe', 'night'], ['modis_day', 'Moe', 'day']]) {
    const o = t[k], line = L.find(l => l.text.startsWith(`${cam} read it`) && l.text.includes(`typical ${when}`));
    if (o.n < 10) ok(!line, `${p.id} ${k} hidden under 10 readings`);
    else ok(line && line.text.includes(`about ${Math.round(o.median_k - 273.15)} °C`) && line.text.includes(`between ${Math.round(o.p10_k - 273.15)} and ${Math.round(o.p90_k - 273.15)} °C`) && line.small.includes(`${o.n} reading`), `${p.id} ${k} line: ${line && line.text}`);
  }
  const o = t.viirs_night.n >= 10 ? t.viirs_night : t.viirs_day.n >= 10 ? t.viirs_day : null;
  const st = C.steadiness(p);
  if (!o) ok(!st, p.id + ' no steadiness under 10 readings');
  else { const sp = o.p90_k - o.p10_k; ok(st.label === (sp < 20 ? 'very steady' : sp >= 40 ? 'swings a lot' : 'swings some'), p.id + ' steadiness ' + st.label + ' ' + sp.toFixed(1)); }
}
// ---- the drawn card: fixed scales and cut-offs (NOTES.md, round 3)
ok(C.SCALE_C[0] === 20 && C.SCALE_C[1] === 100 && C.NIGHT_FULL === 10, 'fixed thermometer scale 20-100 C, full moon at 10');
ok(Math.abs(C.CAP_X - (367 - 273.15 - 20) / 80) < 1e-9, 'cap at 367 K on the scale');
for (const p of P) {
  const m = C.nightMoons(p);
  ok(m.every((x, i) => x.n === p.months_night[i] && x.level === (x.n >= 10 ? 2 : x.n >= 1 ? 1 : 0)), p.id + ' moons');
  const full = m.filter(x => x.level === 2).length, any = m.filter(x => x.level).length;
  ok(C.nightTag(p) === (full >= 10 ? 'stays on' : any <= 3 ? 'comes and goes' : ''), p.id + ' night tag ' + C.nightTag(p));
  ok(p.months_night.reduce((a, b) => a + b, 0) === p.temp.viirs_night.n + p.temp.modis_night.n, p.id + ' night readings add up');
  for (const k of ['viirs_day', 'viirs_night', 'modis_day', 'modis_night']) {
    const o = p.temp[k], t = C.thermoBar(o);
    if (o.n < 10) ok(t.few === true, `${p.id} ${k} greyed under 10`);
    else {
      const pc = c => Math.max(0, Math.min(1, (c - 20) / 80));
      const lo = Math.round(o.p10_k - 273.15), mid = Math.round(o.median_k - 273.15), hi = Math.round(o.p90_k - 273.15);
      ok(t.mid === mid && t.lo === lo && t.hi === hi && t.x0 === pc(lo) && t.xm === pc(mid) && t.x1 === pc(hi), `${p.id} ${k} thermometer ${mid}`);
    }
  }
  const mw = p.frp_median_mw, lv = mw < 2 ? 1 : mw < 5 ? 2 : mw < 15 ? 3 : 4;
  ok(C.flameLevel(mw) === lv, `${p.id} flame level ${lv} for ${mw} MW`);
  const ch = C.chips(p);
  ok(ch[0].value === `${C.hotMonths(p)}/12` && ch[1].value === `${Math.round(p.night_share * 100)}%` && ch[2].value === `${p.days} days`, p.id + ' chips');
}
const s = C.score([{ pick: 'fire', nasa: 'fire' }, { pick: 'industry', nasa: 'offshore' }, { pick: 'something', nasa: 'industry' }, { pick: 'volcano', nasa: 'fire' }, { pick: 'canttell', nasa: 'volcano' }]);
ok(s.agree === 3 && s.differ === 1 && s.none === 1 && s.total === 5, 'score rule');
const r = C.drawRound(P, new Set(), 10, Math.random);
ok(r.length === 10 && r.filter(p => p.nasa_answer === 'fire').length === 5 && r.every(p => !p.practice), 'a round is 10 places, 5 fire, no practice');

// ---- 1. from the NASA rows
const G = 0.02, NX = Math.round(360 / G);
const keyOf = (lat, lon) => (Math.floor(lat / G) + Math.round(90 / G)) * NX + Math.floor(lon / G) + Math.round(180 / G);
// each place's square: the one holding its rounded VIIRS mean position, or (if rounding moved it) any square within one
const want = new Map();
for (const p of P) for (let a = -1; a <= 1; a++) for (let b = -1; b <= 1; b++) { const k = keyOf(p.lat + a * G, p.lon + b * G); if (!want.has(k)) want.set(k, []); want.get(k).push(p.id); }
const acc = {};   // key -> stats
const EPOCH = Date.UTC(2000, 0, 1);
for (let m = 1; m <= 12; m++) {
  const mm = String(m).padStart(2, '0');
  const idx = new Uint32Array(fs.readFileSync(path.join(SRC, `2020-${mm}.idx`)).buffer.slice(0));
  const bin = fs.readFileSync(path.join(SRC, `2020-${mm}.bin`));
  for (let t = 0; t < idx.length; t += 4) {
    const tile = idx[t], off = idx[t + 1], len = idx[t + 2];
    const tlat = Math.floor(tile / 360) - 90, tlon = tile % 360 - 180;
    if (!P.some(p => [-0.03, 0.03].some(a => [-0.03, 0.03].some(b => Math.floor(p.lat + a) === tlat && Math.floor(p.lon + b) === tlon)))) continue;   // only tiles holding a place
    const raw = zlib.gunzipSync(bin.subarray(off, off + len));
    const dv = new DataView(raw.buffer, raw.byteOffset, raw.byteLength);
    for (let o = 0; o < raw.length; o += 28) {
      const lon = dv.getInt32(o, true) / 1e5, lat = dv.getInt32(o + 4, true) / 1e5;
      const k = (Math.floor(lat / G) + Math.round(90 / G)) * NX + Math.floor(lon / G) + Math.round(180 / G);
      if (!want.has(k)) continue;
      const a = acc[k] || (acc[k] = { mm: Array(12).fill(0), mv: Array(12).fill(0), night: 0, n: 0, days: new Set(), lab: [0, 0, 0, 0], frp: [], bt: { modis_day: [], modis_night: [], viirs_day: [], viirs_night: [] }, mn: Array(12).fill(0) });
      const sat = raw[o + 25], fl = raw[o + 26], day = dv.getUint16(o + 8, true);
      const mo = new Date(EPOCH + day * 864e5).getUTCMonth();
      (sat >= 2 ? a.mv : a.mm)[mo]++; a.n++; if (!(fl & 1)) { a.night++; a.mn[mo]++; } a.days.add(day); a.lab[(fl >> 1) & 7]++; a.frp.push(dv.getUint32(o + 12, true) / 100);
      const b1 = dv.getUint16(o + 16, true) / 100; if (b1 > 0) a.bt[(sat >= 2 ? 'viirs_' : 'modis_') + ((fl & 1) ? 'day' : 'night')].push(b1);
    }
  }
}
for (const p of P) {
  // the square whose numbers match exactly
  const cands = [...want.entries()].filter(([k, ids]) => ids.includes(p.id) && acc[k]).map(([k]) => acc[k]);
  const hit = cands.find(a => a.n === p.detections && JSON.stringify(a.mv) === JSON.stringify(p.months_viirs) && JSON.stringify(a.mm) === JSON.stringify(p.months_modis));
  ok(!!hit, p.id + ' month counts per camera match the NASA rows'); if (!hit && process.env.DEBUG) console.log(p.id, cands.map(a => [a.n, JSON.stringify(a.mv), JSON.stringify(a.mm)]));
  if (process.env.DEBUG && hit) console.log(p.id, hit.night, hit.n, hit.night / hit.n, hit.frp.length);
  if (!hit) continue;
  const fr = hit.frp.sort((x, y) => x - y); const med = fr.length % 2 ? fr[fr.length >> 1] : (fr[fr.length / 2 - 1] + fr[fr.length / 2]) / 2;
  ok(Math.abs(hit.night / hit.n - p.night_share) <= 0.0051, p.id + ' night share matches (to the rounding)');
  ok(hit.days.size === p.days, p.id + ' days match');
  ok(JSON.stringify(hit.mn) === JSON.stringify(p.months_night), p.id + ' night readings per month match');
  ok(hit.lab[0] === p.nasa_label.vegetation_fire && hit.lab[1] === p.nasa_label.volcano && hit.lab[2] === p.nasa_label.other_static_land && hit.lab[3] === p.nasa_label.offshore, p.id + ' label counts match');
  for (const k of ['modis_day', 'modis_night', 'viirs_day', 'viirs_night']) {
    const v = hit.bt[k].sort((x, y) => x - y), o = p.temp[k];
    const q = f => { if (!v.length) return null; const i = (v.length - 1) * f, lo = Math.floor(i), hi = Math.ceil(i); return v[lo] + (v[hi] - v[lo]) * (i - lo); };
    const close = (x, y) => (x == null && y == null) || Math.abs(x - y) <= 0.051;
    ok(v.length === o.n && close(q(0.5), o.median_k) && close(q(0.1), o.p10_k) && close(q(0.9), o.p90_k), `${p.id} ${k} temperature: n ${v.length}/${o.n} median ${q(0.5)}/${o.median_k}`);
  }
  ok(Math.abs(med - p.frp_median_mw) <= 0.0501, p.id + ' median fire power matches (to the rounding): ' + med + ' vs ' + p.frp_median_mw);
}
console.log(`${pass} checks passed, ${fail} failed`);
if (bad.length) console.log(bad.slice(0, 30).join('\n'));
process.exit(fail ? 1 : 0);
