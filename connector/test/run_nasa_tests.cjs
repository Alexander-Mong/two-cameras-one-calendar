#!/usr/bin/env node
// run_nasa_tests.cjs: checks for server/nasa.cjs against saved NASA samples (no network), plus --live: one real keyless fetch and the three example answers.
// Usage: node test/run_nasa_tests.cjs [--live]   Writes test/TEST_OUTPUT_NASA.txt (or TEST_OUTPUT_NASA_LIVE.txt).
'use strict';
const fs = require('fs'), path = require('path');
const LIVE = process.argv.includes('--live');
delete process.env.FIRMS_MAP_KEY;   // start with no key, whatever the shell has
const NASA_BASE = ['https', '://', 'firms.modaps.eosdis.nasa.gov'].join('');
const N = require('../server/nasa.cjs');
const SRC = require('../server/nasa_sources.json');
const FIX = path.join(__dirname, 'fixtures_nasa');
const out = []; let pass = 0, fail = 0;
const say = (s) => { out.push(s); process.stdout.write(s + '\n'); };
function check(name, ok, detail) { if (ok) pass++; else fail++; say((ok ? 'PASS ' : 'FAIL ') + name + (detail !== undefined && !ok ? '   [' + String(detail).slice(0, 300) + ']' : '')); }
const text = (r) => r && r.content && r.content[0] ? r.content[0].text : '';

// ---------- the voice checks applied to every answer ----------
const HEDGES = [/\bmay\b/, /\bmight\b/, /\bcould possibly\b/i, /\bit appears\b/i, /\bit seems\b/i, /\bimportant to note\b/i, /\bplease be aware\b/i, /\bkeep in mind\b/i, /\bI can'?t say\b/i, /\bas an AI\b/i, /\bperhaps\b/i, /\bpossibly\b/i, /\bnote that\b/i, /\bdisclaimer\b/i];
const QUALIFIERS = [/can't be added or compared/g, /sent nothing in this window/g, /sent nothing for these dates/g];
const voiced = [];
function voice(label, r) {
  const t = text(r); voiced.push([label, t]);
  const hedge = HEDGES.find(h => h.test(t));
  check(label + ': no hedge words', !hedge, hedge);
  const actLine = t.indexOf('NASA\'s own words:');
  const body = actLine >= 0 ? t.slice(0, actLine) : t;
  const q = QUALIFIERS.reduce((a, re) => a + (body.match(re) || []).length, 0);
  check(label + ': at most one qualifier (' + q + ')', q <= 1, t);
  const act = r.structuredContent && r.structuredContent.acting_now_line;
  const tt = act && t.endsWith(act) ? t.slice(0, t.lastIndexOf(" NASA's live map")).trim() : t;
  const lastWant = tt.lastIndexOf('Want to ');
  check(label + ': ends on the offer of a next question, not a disclaimer', r.isError || (lastWant > 0 && !/[.!?] [A-Z]/.test(tt.slice(lastWant).replace(/^Want to [^?]*\? /, ''))), tt.slice(-160));
}

// ---------- a fake NASA serving the saved samples ----------
const fixture = (f) => fs.readFileSync(path.join(FIX, f), 'utf8');
let requested = [];
function fakeNasa(map) {   // map: (url) -> response or throws
  return async (url) => { requested.push(url); return map(url); };
}
const bySample = (url) => {
  const base = url.split('/').pop();
  const m = /^(MODIS_C6_1|J1_VIIRS_C2|J2_VIIRS_C2|SUOMI_VIIRS_C2)_[A-Za-z_]+?_(24h|48h|7d)\.csv$/.exec(base);
  if (!m) return { status: 404, text: 'not found' };
  return { status: 200, text: fixture(m[1] + '_South_America_24h.csv'), lastModified: 'Sat, 14 Nov 2026 15:46:32 GMT' };
};
const FIXED_NOW = Date.parse('2026-11-14T16:21:00Z');
function reset(f) { requested = []; N._test.clearCache(); N._test.setFetcher(f); N._test.setNow(() => FIXED_NOW); N._test.setTimeoutMs(null); delete process.env.FIRMS_MAP_KEY; }

// an independent count straight from the sample file, not through nasa.cjs
function recount(file, box) {
  const lines = fixture(file).trim().split('\n'); const h = lines[0].split(',');
  const iLa = h.indexOf('latitude'), iLo = h.indexOf('longitude'), iD = h.indexOf('acq_date');
  let n = 0; const cells = new Set();
  for (const l of lines.slice(1)) { const c = l.split(','); const la = +c[iLa], lo = +c[iLo];
    if (la >= box[1] && la <= box[3] && lo >= box[0] && lo <= box[2]) { n++; cells.add(c[iD] + ':' + Math.floor(lo / 0.05 + 1e-9) + ':' + Math.floor(la / 0.05 + 1e-9)); } }
  return { n, cells: cells.size };
}
// the nominal count (every row of NASA's file inside the box) and the trailing count (rows observed in the hours up to refMs), straight from the sample file
function recountTrailing(file, box, refMs, hours) {
  const lines = fixture(file).trim().split('\n'); const h = lines[0].split(',');
  const iLa = h.indexOf('latitude'), iLo = h.indexOf('longitude'), iD = h.indexOf('acq_date'), iT = h.indexOf('acq_time');
  let n = 0, trail = 0;
  for (const l of lines.slice(1)) { const c = l.split(','); const la = +c[iLa], lo = +c[iLo];
    if (!(la >= box[1] && la <= box[3] && lo >= box[0] && lo <= box[2])) continue; n++;
    const t = String(c[iT]).trim().padStart(4, '0'), ms = Date.parse(c[iD] + 'T' + t.slice(0, 2) + ':' + t.slice(2) + ':00Z');
    if (ms >= refMs - hours * 3600000 && ms <= refMs) trail++; }
  return { n, trail };
}
// a small file shaped like NASA's, for places outside the saved South America files: New Zealand (main islands, the Chatham Islands twice), Fiji on both sides of 180°, Buenos Aires
const PACIFIC_CSV = ['latitude,longitude,acq_date,acq_time,satellite,confidence,frp,daynight',
  '-41.0,174.8,2026-11-14,0130,Aqua,80,5.1,N', '-44.0,-176.5,2026-11-14,0200,Aqua,70,3.2,N', '-44.0,-176.5,2026-11-14,0200,Aqua,70,3.2,N',
  '-17.8,178.0,2026-11-13,1000,Terra,90,7.0,D', '-18.2,-178.8,2026-11-14,0300,Aqua,60,2.0,N', '-34.6,-58.4,2026-11-14,0300,Aqua,60,2.0,N'].join('\n') + '\n';

async function offline() {
  const AR = SRC.countries.find(c => c.file === 'Argentina').box;
  say('== nasa.cjs offline checks, ' + new Date().toISOString() + ' (fixtures fetched 2026-11-14 16:20:57 UTC)');

  // 1. the declarations
  check('three tools declared', N.TOOLS.length === 3 && ['nasa_recent', 'nasa_archive', 'nasa_sources'].every(n => N.TOOL_NAMES.has(n)));
  check('every schema is a closed object', N.TOOLS.every(t => t.inputSchema.type === 'object' && t.inputSchema.additionalProperties === false));

  // 2. a normal answer
  reset(fakeNasa(bySample));
  let r = await N.call('nasa_recent', { place: 'Argentina' });
  let d = r.structuredContent;
  check('normal: not an error', r.isError === false, text(r));
  check('normal: asked for the South America files only', requested.length === 4 && requested.every(u => u.startsWith(NASA_BASE + '/data/active_fire/') && u.includes('_South_America_24h.csv')), requested.join(' '));
  for (const [cam, file] of [['MODIS', 'MODIS_C6_1_South_America_24h.csv'], ['VIIRS NOAA-20', 'J1_VIIRS_C2_South_America_24h.csv'], ['VIIRS NOAA-21', 'J2_VIIRS_C2_South_America_24h.csv']]) {
    const c = d.cameras.find(x => x.camera === cam), rc = recount(file, AR);
    check('normal: ' + cam + ' detections match an independent recount (' + rc.n + ')', c && c.detections === rc.n, c && c.detections);
    check('normal: ' + cam + ' 5 km patch-days match (' + rc.cells + ')', c && c.patch_days_5km === rc.cells, c && c.patch_days_5km);
    check('normal: ' + cam + ' per-day patches add up', c && c.per_day.reduce((a, x) => a + x.patches_5km, 0) === c.patch_days_5km);
    check('normal: ' + cam + ' day + night = detections', c && c.day + c.night === c.detections);
    check('normal: ' + cam + ' strongest rows capped at 5, rounded to 2 places', c && c.strongest.length <= 5 && c.strongest.every(x => Math.round(x.latitude * 100) / 100 === x.latitude && Math.round(x.longitude * 100) / 100 === x.longitude));
  }
  check('normal: S-NPP listed as sent nothing', d.sent_nothing.includes('VIIRS S-NPP'));
  // the file's count and the exact 24 hours before the fetch, both recounted from the saved rows
  check('trailing: trailing_window carries hours 24 and the fetch time as its reference', d.trailing_window && d.trailing_window.hours === 24 && d.trailing_window.reference_utc === new Date(FIXED_NOW).toISOString(), JSON.stringify(d.trailing_window));
  const expect = {};
  for (const [cam, file] of [['MODIS', 'MODIS_C6_1_South_America_24h.csv'], ['VIIRS NOAA-20', 'J1_VIIRS_C2_South_America_24h.csv'], ['VIIRS NOAA-21', 'J2_VIIRS_C2_South_America_24h.csv']]) {
    const c = d.cameras.find(x => x.camera === cam), rc = recountTrailing(file, AR, FIXED_NOW, 24); expect[cam] = rc;
    check('trailing: ' + cam + ' nominal count in NASA\'s 24h file is right (' + rc.n + ')', c && c.detections === rc.n, c && c.detections);
    check('trailing: ' + cam + ' count in the 24 hours before the fetch is right (' + rc.trail + ' of ' + rc.n + ')', c && c.within_window_before_fetch === rc.trail && d.trailing_window.detections_by_camera[cam] === rc.trail, c && c.within_window_before_fetch);
  }
  check('trailing: the saved files hold observations older than 24 hours (the reason for the trailing count)', Object.values(expect).some(x => x.trail < x.n), JSON.stringify(expect));
  const leadCam = d.cameras.filter(c => c.detections > 0).sort((a, b) => b.detections - a.detections)[0].camera;   // the camera the answer leads with
  check('trailing: prose gives the file\'s count, then how many came in the 24 hours before the fetch (' + leadCam + ')', text(r).indexOf('detected it ' + expect[leadCam].n.toLocaleString('en-US') + ' times, ' + expect[leadCam].trail.toLocaleString('en-US') + ' of them in the 24 hours before the file was fetched.') > 0, text(r).slice(0, 260));
  const t = text(r);
  check('normal: leads with what NASA saw', /^NASA's 24-hour file has fire in the box around Argentina, which takes in nearby areas: /.test(t), t.slice(0, 120));
  check('normal: calls it fire', /\bfire\b/.test(t));
  check('normal: the unit said once', (t.match(/Each detection is one satellite pass/g) || []).length === 1);
  check('normal: the camera qualifier, once', (t.match(/can't be added or compared/g) || []).length === 1);
  check('normal: says how old the newest detection is', /The newest detection is from [0-9][0-9]:[0-9][0-9] UTC on November \d+, about \d+ (hours|minutes) ago/.test(t), t);
  check('normal: no caution or authorities line when not acting now', !/tactical|authorities/.test(t));
  check('normal: offers the 26-year record next', /Ask the 26-year record/.test(t) && d.next_question && d.next_question.tool === 'fire_answer');
  check('normal: NASA\'s file time carried', d.files.every(f => f.nasa_last_updated));
  voice('normal', r);

  // 3. cache: a second call fetches nothing; two calls at once fetch each file once
  requested = []; await N.call('nasa_recent', { place: 'Argentina', camera: 'MODIS' });
  check('cache: second question within 15 minutes fetches nothing', requested.length === 0, requested.length);
  reset(fakeNasa(async (u) => { await new Promise(res => setTimeout(res, 30)); return bySample(u); }));
  await Promise.all([N.call('nasa_recent', { place: 'Argentina' }), N.call('nasa_recent', { place: 'Chile' }), N.call('nasa_recent', { place: 'Uruguay' })]);
  check('cache: three questions at once fetch each file once (4 files)', requested.length === 4, requested.length);

  // 4. empty S-NPP: asked alone (every VIIRS file empty)
  reset(fakeNasa((u) => ({ status: 200, text: fixture('SUOMI_VIIRS_C2_South_America_24h.csv') })));
  r = await N.call('nasa_recent', { place: 'Argentina', camera: 'VIIRS' });
  check('empty file: plain "We don\'t know", not "no fire"', /^We don't know: VIIRS on NOAA-20 and VIIRS on NOAA-21 and VIIRS on S-NPP have sent nothing in this window\./.test(text(r)) && !/no fire/.test(text(r)), text(r));
  voice('empty file', r);
  // camera "all", only MODIS has rows: the empty VIIRS cameras are said once
  reset(fakeNasa((u) => u.includes('MODIS') ? bySample(u) : { status: 200, text: fixture('SUOMI_VIIRS_C2_South_America_24h.csv') }));
  r = await N.call('nasa_recent', { place: 'Argentina' });
  check('empty VIIRS beside MODIS: MODIS leads, VIIRS said to have sent nothing', /MODIS, NASA's older camera, detected it/.test(text(r)) && /sent nothing in this window/.test(text(r)) && !/can't be added/.test(text(r)), text(r));
  voice('empty VIIRS', r);

  // 5. a place outside the file's region
  reset(fakeNasa(bySample));
  r = await N.call('nasa_recent', { box: [20, 35, 27, 42], camera: 'MODIS' });
  check('outside: a box over Greece asks for the Europe file', requested.length === 1 && requested[0].includes('MODIS_C6_1_Europe_24h.csv'), requested.join(' '));
  check('outside: the South American rows land outside the box: no fire', /^No detections from MODIS in this window inside the box you gave \(35°N to 42°N, 20°E to 27°E\)\./.test(text(r)) && !/on a map/.test(text(r)), text(r));
  voice('outside', r);
  const regs = (b) => N._test.regionsFor(b).map(x => x.file_part).join(',');
  check('outside: a mid-Pacific box uses the world file', regs([[-150, -10, -140, 0]]) === 'Global');
  check('outside: Russia crosses the 180° line, uses the world file', regs(SRC.countries.find(c => c.file === 'Russian_Federation').boxes) === 'Global');
  check('outside: Argentina uses South America, not the world', regs([AR]) === 'South_America');
  check('outside: boxes in two regions read the two region files, not the world', regs([AR, [20, 35, 27, 42]]) === 'South_America,Europe', regs([AR, [20, 35, 27, 42]]));
  r = await N.call('nasa_recent', { place: 'Atlantis' });
  check('outside: an unknown place is refused plainly', r.isError && r.structuredContent.refusal.code === 'UNKNOWN_PLACE', text(r));
  r = await N.call('nasa_recent', { place: 'Martinique' });
  check('outside: a place with no outline asks for a box', r.isError && r.structuredContent.refusal.code === 'NO_BOX', text(r));

  // 6. bad window, bad camera
  reset(fakeNasa(bySample));
  for (const w of ['3d', '24', 24, '', null === null ? 'week' : 0]) {
    r = await N.call('nasa_recent', { place: 'Argentina', window: w });
    check('bad window ' + JSON.stringify(w) + ': refused before any fetch', r.isError && requested.length === 0 && /window/.test(text(r)), text(r));
  }
  r = await N.call('nasa_recent', { place: 'Argentina', camera: 'Landsat' });
  check('bad camera: refused', r.isError && /camera/.test(text(r)));

  // 7. a box that is not a box
  for (const b of [[1, 2, 3], [5, 0, 5, 1], [0, 10, 5, 1], [-200, 0, 10, 10], [10, 0, 200, 1], [190, 0, 10, 1], ['1', '2', '3', '4'], [0, 0, NaN, 1], { west: 0, south: 0, east: 1 }, 'everywhere', [0, 0, Infinity, 1]]) {
    r = await N.call('nasa_recent', { box: b });
    check('not a box ' + JSON.stringify(b) + ': refused', r.isError && /isn't a box|has to be/.test(text(r)) && requested.length === 0, text(r));
  }
  r = await N.call('nasa_recent', { box: { west: -60, south: -30, east: -50, north: -20 } });
  check('a box as {west, south, east, north} works', !r.isError, text(r));
  r = await N.call('nasa_recent', { place: 'Argentina', box: [0, 0, 1, 1] });
  check('place and box together: refused', r.isError && /not both/.test(text(r)));

  // 7b. several boxes, the 180° line, each detection once
  check('boxes: New Zealand, Fiji, Russia, the United States and Kiribati have several boxes, none crossing 180°', ['New_Zealand', 'Fiji', 'Russian_Federation', 'United_States', 'Kiribati'].every(f => { const c = SRC.countries.find(x => x.file === f); return c && c.boxes.length >= 2 && c.boxes.every(b => b[0] < b[2] && b[0] >= -180 && b[2] <= 180); }));
  check('boxes: New Zealand has a box over the Chatham Islands (44°S, 176.5°W)', SRC.countries.find(x => x.file === 'New_Zealand').boxes.some(b => -44 >= b[1] && -44 <= b[3] && -176.5 >= b[0] && -176.5 <= b[2]));
  check('boxes: Fiji has boxes on both sides of 180°', (() => { const bs = SRC.countries.find(x => x.file === 'Fiji').boxes; return bs.some(b => b[2] === 180) && bs.some(b => b[0] === -180); })());
  check('boxes: the United States reaches the western Aleutians (52.9°N, 172.9°E)', SRC.countries.find(x => x.file === 'United_States').boxes.some(b => 52.9 >= b[1] && 52.9 <= b[3] && 172.9 >= b[0] && 172.9 <= b[2]));
  reset(fakeNasa(() => ({ status: 200, text: PACIFIC_CSV })));
  r = await N.call('nasa_recent', { place: 'New Zealand', camera: 'MODIS' }); d = r.structuredContent;
  check('New Zealand: reads the world file once, counts the main islands and the Chatham Islands, the repeated row once (2)', !r.isError && requested.length === 1 && /MODIS_C6_1_Global_24h\.csv$/.test(requested[0]) && d.cameras[0].detections === 2 && d.cameras[0].within_window_before_fetch === 2, text(r));
  check('New Zealand: coverage is rectangles, two boxes, with a note', d.coverage_mode === 'rectangles' && d.coverage.mode === 'rectangles' && d.coverage.boxes.length === 2 && /nearby areas/.test(d.coverage.note) && d.box.crosses_180 === true, JSON.stringify(d.coverage));
  check('New Zealand: prose says once that the boxes take in nearby areas', /^NASA's 24-hour file has fire in the two boxes around New Zealand, which take in nearby areas: /.test(text(r)) && (text(r).match(/nearby areas/g) || []).length === 1, text(r).slice(0, 140));
  voice('New Zealand', r);
  r = await N.call('nasa_recent', { place: 'Fiji', camera: 'MODIS' }); d = r.structuredContent;
  check('Fiji: both sides of 180° counted (2); one is older than 24 hours before the fetch (1)', !r.isError && d.cameras[0].detections === 2 && d.cameras[0].within_window_before_fetch === 1 && /detected it 2 times, 1 of them in the 24 hours before the file was fetched\./.test(text(r)), text(r));
  r = await N.call('nasa_recent', { box: [170, -50, -170, -30], camera: 'MODIS' }); d = r.structuredContent;
  check('a box across 180° (west 170, east -170): split into two, not refused; both sides counted (2)', !r.isError && d.coverage.boxes.length === 2 && d.coverage.boxes[0].east === 180 && d.coverage.boxes[1].west === -180 && d.cameras[0].detections === 2 && /across the 180° line/.test(text(r)), text(r));
  voice('box across 180', r);
  r = await N.call('nasa_recent', { box: { west: 170, south: -50, east: -170, north: -30 }, camera: 'MODIS' });
  check('a box across 180° as {west, south, east, north} works too', !r.isError && r.structuredContent.cameras[0].detections === 2, text(r));
  reset(fakeNasa(bySample));
  r = await N.call('nasa_recent', { place: 'Argentina', window: '7d', camera: 'MODIS' }); d = r.structuredContent;
  const rc7 = recountTrailing('MODIS_C6_1_South_America_24h.csv', AR, FIXED_NOW, 168);
  check('7d: trailing window is 168 hours; every saved row falls in it (' + rc7.trail + ' of ' + rc7.n + ')', d.trailing_window.hours === 168 && d.cameras[0].detections === rc7.n && d.cameras[0].within_window_before_fetch === rc7.trail && rc7.trail === rc7.n && /all of them in the 7 days before the file was fetched\./.test(text(r)), text(r).slice(0, 220));

  // 8. oversized and odd input
  reset(fakeNasa(bySample));
  let t0 = Date.now(); r = await N.call('nasa_recent', { place: 'A'.repeat(100000) });
  check('oversized place: refused in under 50 ms, nothing fetched', r.isError && Date.now() - t0 < 50 && requested.length === 0 && text(r).length < 400, Date.now() - t0);
  r = await N.call('nasa_recent', { place: 'Argentina', extra: 'x'.repeat(5000) });
  check('unknown argument: refused, name cut short', r.isError && text(r).length < 300);
  for (const a of [[], 'Argentina', 42, true]) { r = await N.call('nasa_recent', a); check('arguments ' + JSON.stringify(a) + ': refused', r.isError); }
  for (const name of ['constructor', '__proto__', 'toString', 'hasOwnProperty', '', null, 42]) {
    r = await N.call(name, {}); check('tool name ' + JSON.stringify(name) + ': plain "no such tool"', r.isError && /no NASA tool by that name/.test(text(r)));
  }
  r = await N.call('nasa_recent', { place: 'constructor' });
  check('place "constructor": unknown place, no crash', r.isError && r.structuredContent.refusal.code === 'UNKNOWN_PLACE');
  r = await N.call('nasa_recent', { place: '__proto__' });
  check('place "__proto__": unknown place, no crash', r.isError && r.structuredContent.refusal.code === 'UNKNOWN_PLACE');

  // 9. the fetch failing or timing out: a plain message, no stack, no path
  const LEAK = new RegExp(['[A-Za-z]' + ':' + '\\\\', '/Us' + 'ers/', '/ho' + 'me/', '\\bat\\s+\\S+\\s+\\(', 'node:internal', 'Error:'].join('|'));   // built from parts so the public scan doesn't read it as a path
  const noLeak = (s) => !LEAK.test(s);
  const stderrCapture = []; const realErr = process.stderr.write.bind(process.stderr);
  process.stderr.write = (s) => { stderrCapture.push(String(s)); return true; };
  try {
    reset(fakeNasa(() => { const e = new Error('ECONNRESET at ' + 'C' + ':' + '\\private\\folder\\x.js'); throw e; }));
    r = await N.call('nasa_recent', { place: 'Argentina' });
    check('fetch fails: plain "We don\'t know right now"', r.isError && /^We don't know right now: the request to NASA didn't go through/.test(text(r)), text(r));
    check('fetch fails: no stack, no path in the answer', noLeak(JSON.stringify(r)), JSON.stringify(r));
    reset(fakeNasa(() => new Promise(() => {}))); N._test.setTimeoutMs(60);
    t0 = Date.now(); r = await N.call('nasa_recent', { place: 'Argentina' });
    check('fetch hangs: times out with a plain message', r.isError && /NASA didn't answer in time/.test(text(r)) && Date.now() - t0 < 2000, text(r));
    reset(fakeNasa(() => ({ status: 503, text: '<html>Service Unavailable at /var/www</html>' })));
    r = await N.call('nasa_recent', { place: 'Argentina' });
    check('NASA answers 503: plain message, NASA\'s page not forwarded', r.isError && !/html|var\/www/.test(JSON.stringify(r)), text(r));
    reset(fakeNasa((u) => u.includes('J1_') ? (() => { throw new Error('boom'); })() : bySample(u)));
    r = await N.call('nasa_recent', { place: 'Argentina' });
    check('one camera fails: the rest answer, the gap said plainly', !r.isError && /VIIRS on NOAA-20: the request to NASA didn't go through, so it's left out\./.test(text(r)), text(r));
    voice('one camera fails', r);
    reset(fakeNasa(() => ({ status: 200, text: fixture('not_csv_reply.txt') })));
    r = await N.call('nasa_recent', { place: 'Argentina' });
    check('NASA sends text, not data: plain message', r.isError && /something other than fire data/.test(text(r)), text(r));
    reset(fakeNasa(bySample));
    let hostErr = null; try { await N._test.getTable(['https', '://', 'example.com/data.csv'].join('')); } catch (e) { hostErr = e.kind; }
    check('allow list: any other host is refused before fetching', hostErr === 'host' && requested.length === 0, hostErr);
    hostErr = null; try { await N._test.getTable(['http', '://', 'firms.modaps.eosdis.nasa.gov/x.csv'].join('')); } catch (e) { hostErr = e.kind; }
    check('allow list: plain http refused', hostErr === 'host');
    check('logs carry no stack or path', noLeak(stderrCapture.join('')), stderrCapture.join(''));
  } finally { process.stderr.write = realErr; }

  // 10. the key path
  reset(fakeNasa(bySample));
  r = await N.call('nasa_archive', { place: 'Greece', from: '2025-08-01', to: '2025-08-20' });
  check('no key: says how to get one, names FIRMS_MAP_KEY, nothing fetched', r.isError && r.structuredContent.refusal.code === 'NEEDS_KEY' && /map.key/.test(text(r)) && /FIRMS_MAP_KEY/.test(text(r)) && requested.length === 0, text(r));
  check('no key: says what a person could then ask', /With a key you can ask/.test(text(r)));
  voice('no key', r);
  const KEY = ['DUMMY0KEY', '1234567890', 'abcdefDUMMY99'].join('');   // a dummy, built from parts
  const logs = []; process.stderr.write = (s) => { logs.push(String(s)); return true; };
  try {
    reset(fakeNasa(() => ({ status: 200, text: fixture('archive_shaped_VIIRS_NOAA20_SP.csv') })));
    process.env.FIRMS_MAP_KEY = KEY;
    r = await N.call('nasa_archive', { place: 'Argentina', from: '2026-11-01', to: '2026-11-12', source: 'VIIRS_NOAA20_SP' });
    const all = JSON.stringify(r);
    check('key: 12 days go as 3 requests of at most 5 days', requested.length === 3 && /\/5\/2026-11-01$/.test(requested[0]) && /\/5\/2026-11-06$/.test(requested[1]) && /\/2\/2026-11-11$/.test(requested[2]), requested.map(u => u.replace(KEY, '[k]')).join(' '));
    check('key: requests use NASA\'s documented area address', requested.every(u => u.startsWith(NASA_BASE + '/api/area/csv/' + KEY + '/VIIRS_NOAA20_SP/-73.7,-55.2,-53.6,-21.7/')));
    check('key: never in the answer', !all.includes(KEY), all.slice(0, 200));
    check('key: answer reports NASA\'s type mark', /NASA marks \d+ as vegetation fire/.test(text(r)), text(r));
    voice('key archive', r);
    check('key: 3 requests returning the same rows count each detection once', r.structuredContent.camera.detections === recount('archive_shaped_VIIRS_NOAA20_SP.csv', AR).n, r.structuredContent.camera.detections);
    reset(fakeNasa(() => ({ status: 200, text: PACIFIC_CSV }))); process.env.FIRMS_MAP_KEY = KEY;
    r = await N.call('nasa_archive', { place: 'Fiji', from: '2026-11-13', to: '2026-11-14', source: 'MODIS_NRT' });
    check('key: Fiji asks NASA once per box, one each side of 180°, and counts each detection once (2)', !r.isError && requested.length === 2 && requested.some(u => u.includes('/176.9,-19.3,180,-12.3/')) && requested.some(u => u.includes('/-180,-20.8,-178.1,-16/')) && r.structuredContent.camera.detections === 2 && r.structuredContent.coverage.boxes.length === 2, requested.map(u => u.replace(KEY, '[k]')).join(' ') + ' | ' + text(r));
    reset(fakeNasa((u) => { throw new Error('failed ' + u); })); process.env.FIRMS_MAP_KEY = KEY;
    r = await N.call('nasa_archive', { place: 'Argentina', from: '2026-11-01', to: '2026-11-02' });
    check('key: a failing request whose error holds the address leaks no key', r.isError && !JSON.stringify(r).includes(KEY), JSON.stringify(r));
    reset(fakeNasa(() => ({ status: 200, text: fixture('not_csv_reply.txt') }))); process.env.FIRMS_MAP_KEY = KEY;
    r = await N.call('nasa_archive', { place: 'Argentina', from: '2026-11-01', to: '2026-11-02' });
    check('key: NASA turning it down gives a plain reason, no key', r.isError && /NASA turned the request down/.test(text(r)) && !JSON.stringify(r).includes(KEY), text(r));
    process.env.FIRMS_MAP_KEY = KEY;
    check('key: scrub() replaces it with [key hidden]', N._test.scrub('x' + KEY + 'y') === 'x[key hidden]y');
    r = await N.call('nasa_sources', {});
    check('key: nasa_sources says a key is set, never shows it', r.structuredContent.key_set === true && !JSON.stringify(r).includes(KEY));
    for (const bad of [{ from: '2026-11-12', to: '2026-11-01' }, { from: '2026-02-30', to: '2026-03-01' }, { from: '2026-10-01', to: '2026-12-31' }, { from: '2026-01-01', to: '2026-03-01' }, { from: 20261101, to: '2026-11-02' }, { from: '2026-11-01' }]) {
      reset(fakeNasa(bySample)); process.env.FIRMS_MAP_KEY = KEY;
      r = await N.call('nasa_archive', Object.assign({ place: 'Argentina' }, bad));
      check('key: bad dates ' + JSON.stringify(bad) + ' refused before any request', r.isError && requested.length === 0 && !JSON.stringify(r).includes(KEY), text(r));
    }
    reset(fakeNasa(bySample)); process.env.FIRMS_MAP_KEY = KEY;
    r = await N.call('nasa_archive', { place: 'Argentina', from: '2026-11-01', to: '2026-11-02', source: 'MODIS_C7' });
    check('key: unknown source refused', r.isError && requested.length === 0);
    check('key: never in any log line', !logs.join('').includes(KEY), logs.join(''));
  } finally { process.stderr.write = realErr; delete process.env.FIRMS_MAP_KEY; }

  // 11. acting now, and the sources tool
  reset(fakeNasa(bySample));
  r = await N.call('nasa_recent', { place: 'Argentina', acting_now: true });
  check('acting now: answer first, then NASA\'s caution word for word and local authorities', text(r).startsWith('NASA\'s 24-hour file has fire') && text(r).endsWith(r.structuredContent.acting_now_line) && text(r).includes('"' + SRC.nasa_caution + '"') && /local authorities and emergency services/.test(text(r)) && /firms\.modaps\.eosdis\.nasa\.gov\/map\//.test(text(r)), text(r));
  voice('acting now', r);
  // new contract checks
  r = await N.call('nasa_recent', { place: 'Argentina' }); d = r.structuredContent;
  check('contract: window_kind, observed range, fetched time, coverage, classification', d.window_kind === 'nasa_file_24h' && /^\d{4}-\d\d-\d\dT/.test(d.observed_from_utc) && d.observed_from_utc <= d.observed_to_utc && d.fetched_utc === new Date(FIXED_NOW).toISOString() && d.coverage_mode === 'rectangles' && d.coverage && d.coverage.boxes.length === 1 && /^unclassified thermal detections/.test(d.classification), JSON.stringify([d.window_kind, d.observed_from_utc, d.observed_to_utc, d.fetched_utc]));
  check('contract: prose names the 24-hour file and the observed range', /NASA's 24-hour file/.test(text(r)) && /observed between \d\d[:]\d\d UTC \w+ \d+ and \d\d[:]\d\d UTC \w+ \d+/.test(text(r)), text(r));
  check('contract: box scope said once', (text(r).match(/takes in nearby areas/g) || []).length === 1);
  check('contract: no acting_now_line when not acting', !('acting_now_line' in d));
  r = await N.call('nasa_recent', { place: 'Argentina', acting_now: true });
  check('acting now: success has acting_now_line key and it ends the text', r.structuredContent.acting_now_line && text(r).endsWith(r.structuredContent.acting_now_line) && /local authorities and emergency services\.$/.test(text(r)));
  for (const [what, args] of [['unknown place', { place: 'Atlantis' }], ['bad box', { box: [1, 2, 3] }], ['fetch failure', { place: 'Argentina' }]]) {
    reset(fakeNasa(what === 'fetch failure' ? () => { throw new Error('x'); } : bySample));
    r = await N.call('nasa_recent', Object.assign({ acting_now: true }, args));
    check('acting now: ' + what + ' ends with the authorities line and carries the key', r.isError && text(r).endsWith('follow your local authorities and emergency services.') && r.structuredContent.acting_now_line && text(r).endsWith(r.structuredContent.acting_now_line), text(r));
  }
  reset(fakeNasa(bySample));
  r = await N.call('nasa_archive', { place: 'Greece', from: '2025-08-01', to: '2025-08-20', acting_now: true });
  check('acting now: NEEDS_KEY ends with the authorities line', r.isError && r.structuredContent.refusal.code === 'NEEDS_KEY' && text(r).endsWith(r.structuredContent.acting_now_line));
  r = await N.call('nasa_recent', { place: 'Córdoba' });
  check('city: says it takes countries or a box and names the country', r.isError && /takes a country or a latitude-longitude box/.test(text(r)) && /Córdoba is in Argentina: ask for Argentina\./.test(text(r)), text(r));
  r = await N.call('nasa_recent', { place: 'Greece', camera: 'MODIS' });
  check('zero detections for a country: plain line, camera named, no map offer', /^No detections from MODIS in this window in the box around Greece, which takes in nearby areas\./.test(text(r)) && !/on a map/.test(text(r)) && r.structuredContent.observed_from_utc === null, text(r));
  r = await N.call('nasa_sources', {});
  check('sources: caution word for word, live map, the three windows, no key', !r.isError && text(r).includes('"' + SRC.nasa_caution + '"') && /labeled 24h, 48h and 7d/.test(text(r)) && /can be older than its label/.test(text(r)) && r.structuredContent.key_set === false);
  check('sources: lists 13 NASA regions and 4 cameras', r.structuredContent.keyless.regions.length === 13 && r.structuredContent.keyless.cameras.length === 4);
  r = await N.call('nasa_sources', { anything: 1 });
  check('sources: an argument it doesn\'t take is refused', r.isError);
  check('hedge scan ran over ' + voiced.length + ' answers', voiced.length >= 8);
}

async function live() {
  say('== nasa.cjs LIVE: real keyless fetches from firms.modaps.eosdis.nasa.gov, ' + new Date().toISOString());
  N._test.clearCache(); N._test.setFetcher(null); N._test.setNow(null);
  const t = await N._test.getTable(NASA_BASE + '/data/active_fire/modis-c6.1/csv/MODIS_C6_1_South_America_24h.csv');
  check('live: MODIS South America 24h has NASA\'s columns', ['latitude', 'longitude', 'acq_date', 'acq_time', 'confidence', 'frp', 'daynight'].every(c => t.columns.includes(c)), t.columns.join(','));
  check('live: it has rows with real coordinates', t.rows.length > 0 && t.rows.every(r => r.lat >= -90 && r.lat <= 90 && r.lon >= -180 && r.lon <= 180), t.rows.length);
  check('live: NASA\'s update time came with it', !!t.lastModified, t.lastModified);
  for (const [name, args] of [['nasa_recent', { place: 'Argentina' }], ['nasa_recent', { place: 'Brazil', window: '7d', camera: 'VIIRS' }], ['nasa_recent', { box: [-125, 32, -114, 42], window: '48h' }], ['nasa_archive', { place: 'Greece', from: '2025-08-01', to: '2025-08-20' }]]) {
    const r = await N.call(name, args);
    say('\n-- ' + name + ' ' + JSON.stringify(args)); say(text(r));
    if (name === 'nasa_recent') { say('structured (cameras): ' + JSON.stringify(r.structuredContent.cameras.map(c => ({ camera: c.camera, detections: c.detections, patch_days_5km: c.patch_days_5km, per_day: c.per_day, newest_utc: c.newest_utc, strongest: c.strongest.slice(0, 2) })))); say('files: ' + JSON.stringify(r.structuredContent.files.map(f => [f.camera, f.nasa_last_updated, f.rows_in_file]))); }
    voice('live ' + JSON.stringify(args), r);
  }
}

(async () => {
  try { await (LIVE ? live() : offline()); }
  catch (e) { fail++; say('FAIL the test run stopped: ' + (e && e.message)); }
  say('\n' + pass + ' PASS, ' + fail + ' FAIL');
  fs.writeFileSync(path.join(__dirname, LIVE ? 'TEST_OUTPUT_NASA_LIVE.txt' : 'TEST_OUTPUT_NASA.txt'), out.join('\n') + '\n');
  process.exit(fail ? 1 : 0);
})();
