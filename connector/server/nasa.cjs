// nasa.cjs: three tools that reach NASA FIRMS directly (nasa_recent, nasa_archive, nasa_sources), for the stdio and the hosted connector.
// Node 20+, no outside packages. Talks to ONE host only (firms.modaps.eosdis.nasa.gov). Never stores, prints or logs a map key.
// Wiring: see ../NASA_DIRECT.md.
'use strict';
const SRC = require('./nasa_sources.json');

// ---------- limits (all stated in NASA_DIRECT.md) ----------
const LIMITS = Object.freeze({
  cacheMinutesRecent: 15,          // a NASA file is fetched at most once per 15 minutes per connector
  cacheMinutesArchive: 360,        // archive answers change rarely
  fileMaxBytes: 48 * 1024 * 1024,  // the biggest file NASA lists (VIIRS, whole world, 7 days) was about 35 MB on 2026-11-14
  // counted in CSV text bytes; the parsed rows take several times that in memory, so 64 MB here sits inside the service's 512 MB cap (deploy\fire-connector.service)
  cacheMaxBytes: Math.max(8, Math.min(160, Number(process.env.NASA_CACHE_MB) || 64)) * 1024 * 1024,
  timeoutMs: 25000,
  maxInFlight: 3,                  // fetches to NASA at once, across all callers
  archiveMaxDays: 31,              // at most 7 requests of 5 days each
  topRows: 5,
  textMax: 80                      // longest place name, date or source accepted
});
const HOST = SRC.host;
const ALLOWED_HOSTS = new Set([HOST]);
const SCHEME = 'https';   // the one scheme; addresses are built from the host so no full web address sits in the files
const MAP_URL = SCHEME + '://' + HOST + SRC.live_map_path;
const MAP_KEY_PAGE = SCHEME + '://' + HOST + SRC.map_key_page_path.join('');
const CAUTION = SRC.nasa_caution;

// ---------- small helpers ----------
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
const fmt = (n) => Number(n).toLocaleString('en-US');
const r2 = (v) => Math.round(v * 100) / 100;
function log(...x) { process.stderr.write('[nasa] ' + scrub(x.join(' ')) + '\n'); }
function keyNow() { const k = process.env.FIRMS_MAP_KEY; return typeof k === 'string' && k.trim() ? k.trim() : null; }
// the key never leaves: every outgoing string passes through here
function scrub(s) { const k = keyNow(); s = String(s); return k ? s.split(k).join('[key hidden]').split(encodeURIComponent(k)).join('[key hidden]') : s; }

class Refusal extends Error { constructor(code, message, extra) { super(message); this.code = code; this.extra = extra || {}; } }
class FetchFail extends Error { constructor(kind) { super(kind); this.kind = kind; } }

// ---------- places: Maps only, built once ----------
const norm = (s) => String(s).normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\-'’.,()]/g, ' ').replace(/^the\s+/, '').replace(/\s+/g, ' ').trim();
const PLACES = new Map();      // normalized name -> country entry
const ALIASES = [['usa', 'United_States'], ['us', 'United_States'], ['united states of america', 'United_States'], ['america', 'United_States'],
  ['uk', 'United_Kingdom'], ['britain', 'United_Kingdom'], ['great britain', 'United_Kingdom'], ['russia', 'Russian_Federation'],
  ['south korea', 'Republic_of_Korea'], ['north korea', 'Dem_Rep_Korea'], ['drc', 'Democratic_Republic_of_the_Congo'], ['dr congo', 'Democratic_Republic_of_the_Congo'],
  ['ivory coast', 'Cote_d_Ivoire'], ['laos', 'Lao_PDR'], ['eswatini', 'Swaziland'], ['north macedonia', 'Macedonia_Former_Yugoslav_Republic_of'],
  ['burma', 'Myanmar'], ['czechia', 'Czech_Republic'], ['turkiye', 'Turkey'], ['east timor', 'Timor-Leste'], ['uae', 'United_Arab_Emirates'],
  ['gambia', 'The_Gambia'], ['vietnam', 'Viet_Nam']];
(function buildPlaces() {
  const byFile = new Map();
  for (const c of SRC.countries) {
    byFile.set(c.file, c);
    for (const k of [norm(c.file), norm(c.name), norm(c.name.replace(/\s*\([^)]*\)\s*$/, ''))]) if (k && !PLACES.has(k)) PLACES.set(k, c);
  }
  for (const [k, f] of ALIASES) if (byFile.has(f) && !PLACES.has(k)) PLACES.set(k, byFile.get(f));
})();
const CITIES = new Map([['cordoba', ['Córdoba', 'Argentina']], ['athens', ['Athens', 'Greece']], ['los angeles', ['Los Angeles', 'United States']], ['sydney', ['Sydney', 'Australia']], ['manaus', ['Manaus', 'Brazil']]]);
const NO_OUTLINE = new Set(['french guiana', 'guadeloupe', 'martinique', 'mayotte', 'reunion', 'svalbard and jan mayen', 'svalbard']);
function suggest(q) {
  const n = norm(q).slice(0, LIMITS.textMax); if (n.length < 2) return [];
  const out = [];
  for (const c of SRC.countries) { const cn = norm(c.name); if (cn.indexOf(n) >= 0 || (n.length >= 4 && cn.startsWith(n.slice(0, 4)))) out.push(c.name); if (out.length >= 5) break; }
  return out;
}

// ---------- argument checks: type and length first, before any work ----------
function checkArgs(args, spec) {
  if (args === undefined || args === null) args = {};
  if (typeof args !== 'object' || Array.isArray(args)) throw new Refusal('BAD_ARGUMENTS', 'The arguments have to be an object, like {"place": "Argentina"}.');
  for (const k of Object.keys(args)) if (!own(spec, k)) throw new Refusal('BAD_ARGUMENTS', 'This tool doesn\'t take "' + String(k).slice(0, 40) + '". It takes: ' + Object.keys(spec).join(', ') + '.');
  const out = {};
  for (const k of Object.keys(spec)) {
    if (!own(args, k) || args[k] === undefined || args[k] === null) continue;
    const v = args[k], t = spec[k];
    if (t === 'string') { if (typeof v !== 'string') throw new Refusal('BAD_ARGUMENTS', '"' + k + '" has to be text.'); if (v.length > LIMITS.textMax) throw new Refusal('BAD_ARGUMENTS', '"' + k + '" is too long: at most ' + LIMITS.textMax + ' characters.'); out[k] = v.trim(); }
    else if (t === 'boolean') { if (typeof v !== 'boolean') throw new Refusal('BAD_ARGUMENTS', '"' + k + '" has to be true or false.'); out[k] = v; }
    else if (t === 'box') out[k] = checkBox(v);
    else if (Array.isArray(t)) { if (typeof v !== 'string' || t.indexOf(v) < 0) throw new Refusal('BAD_ARGUMENTS', '"' + k + '" has to be one of: ' + t.join(', ') + '.'); out[k] = v; }
  }
  return out;
}
const BOX_HELP = 'A box is four numbers in degrees: west, south, east, north, for example [-73.7, -55.2, -53.6, -21.7] (west and east from -180 to 180, south and north from -90 to 90, south less than north). A box across the 180° line has west greater than east, for example [170, -50, -170, -30]; it is read as two boxes, one on each side of the line.';
function checkBox(v) {
  let a = null;
  if (Array.isArray(v) && v.length === 4) a = v;
  else if (v && typeof v === 'object' && !Array.isArray(v) && Object.keys(v).length === 4 && own(v, 'west') && own(v, 'south') && own(v, 'east') && own(v, 'north')) a = [v.west, v.south, v.east, v.north];
  if (!a || !a.every(x => typeof x === 'number' && isFinite(x))) throw new Refusal('BAD_BOX', 'That isn\'t a box. ' + BOX_HELP);
  const [w, s, e, n] = a;
  if (w < -180 || w > 180 || e < -180 || e > 180 || s < -90 || n > 90 || w === e || !(s < n)) throw new Refusal('BAD_BOX', 'That isn\'t a box. ' + BOX_HELP);
  return [w, s, e, n];
}
// a box with west greater than east crosses the 180° line: two boxes, one on each side
const splitBox = (b) => b[0] > b[2] ? [[b[0], b[1], 180, b[3]], [-180, b[1], b[2], b[3]]] : [b.slice()];
const NUM_WORDS = ['no', 'one', 'two', 'three', 'four', 'five'];
// a place or a box, exactly one. boxes: the rectangles searched, none crossing the 180° line
function where(a) {
  if (a.place !== undefined && a.box !== undefined) throw new Refusal('BAD_ARGUMENTS', 'Give a place or a box, not both.');
  if (a.box !== undefined) {
    const b = a.box, wraps = b[0] > b[2], ns = (v) => Math.abs(v) + '°' + (v < 0 ? 'S' : 'N'), ew = (v) => Math.abs(v) + '°' + (v < 0 ? 'W' : 'E');
    return { label: 'inside the box you gave (' + ns(b[1]) + ' to ' + ns(b[3]) + ', ' + ew(b[0]) + ' to ' + ew(b[2]) + (wraps ? ', across the 180° line' : '') + ')', short: 'that box', box: b, wraps, boxes: splitBox(b), country: null }; }
  if (!a.place) throw new Refusal('BAD_ARGUMENTS', 'Say where: a country ("Argentina") or a box of latitude and longitude. ' + BOX_HELP);
  const k = norm(a.place);
  if (NO_OUTLINE.has(k)) throw new Refusal('NO_BOX', 'We don\'t have an outline for ' + a.place + ', so there\'s no box around it. Give a box of latitude and longitude instead. ' + BOX_HELP);
  const c = PLACES.get(k);
  if (!c) {
    const city = CITIES.get(k), s = city ? [] : suggest(a.place);
    throw new Refusal('UNKNOWN_PLACE', 'We don\'t know a place called "' + a.place + '". This tool takes a country or a latitude-longitude box.' + (city ? ' ' + city[0] + ' is in ' + city[1] + ': ask for ' + city[1] + '.' : s.length ? ' Did you mean ' + s.map(x => '"' + x + '"').join(', ') + '?' : '') + ' ' + BOX_HELP, { suggestions: city ? [city[1]] : s });
  }
  const boxes = Array.isArray(c.boxes) && c.boxes.length ? c.boxes.map(b => b.slice()) : splitBox(c.box);
  const label = boxes.length > 1 ? 'in the ' + (NUM_WORDS[boxes.length] || boxes.length) + ' boxes around ' + c.name + ', which take in nearby areas' : 'in the box around ' + c.name + ', which takes in nearby areas';
  return { label, short: c.name, box: c.box.slice(), wraps: !!c.crosses_180, boxes, country: c.name };
}
function coverageOf(place) {
  const many = place.boxes.length > 1;
  const note = (place.country
    ? (many ? NUM_WORDS[place.boxes.length].replace(/^./, ch => ch.toUpperCase()) + ' rectangles' : 'A rectangle') + ' drawn around ' + place.country + '\'s outline, widened by 0.1 degree; ' + (many ? 'they take' : 'it takes') + ' in nearby areas (edges of neighboring countries and sea).' + (many ? ' A country gets more than one box when it crosses the 180° line or has far islands.' : '')
    : 'The box you gave' + (place.wraps ? ', split at the 180° line into two.' : '.')) +
    ' Each detection is counted once, however many boxes or NASA files it shows up in.';
  return { mode: 'rectangles', boxes: place.boxes.map(b => ({ west: b[0], south: b[1], east: b[2], north: b[3] })), note };
}
function inBoxes(lat, lon, boxes) {
  for (const b of boxes) if (lat >= b[1] && lat <= b[3] && lon >= b[0] && lon <= b[2]) return true;
  return false;
}
// NASA's region files to read: the smallest one that holds every box; else the smallest for each box; the world file when any box needs it
const GLOBAL = SRC.regions.find(r => r.file_part === 'Global');
function smallestRegion(boxes) {
  let best = null, bestArea = Infinity;
  for (const r of SRC.regions) {
    if (r.file_part === 'Global') continue;
    const [w, s, e, n] = r.box;
    if (boxes.every(b => b[0] >= w && b[2] <= e && b[1] >= s && b[3] <= n)) { const ar = (e - w) * (n - s); if (ar < bestArea) { best = r; bestArea = ar; } }
  }
  return best;
}
function regionsFor(boxes) {
  const one = smallestRegion(boxes); if (one) return [one];
  const each = boxes.map(b => smallestRegion([b]));
  if (each.some(r => !r)) return [GLOBAL];
  return [...new Set(each)];
}
// one detection, however many boxes or files it shows up in
const detKey = (r) => r.lat + '|' + r.lon + '|' + r.date + '|' + r.time + '|' + r.sat;
const stampMs = (r) => Date.parse(r.date + 'T' + r.time.slice(0, 2) + ':' + r.time.slice(2) + ':00Z');
const WINDOW_HOURS = { '24h': 24, '48h': 48, '7d': 168 };
const BEFORE_WORDS = { '24h': 'the 24 hours', '48h': 'the 48 hours', '7d': 'the 7 days' };

// ---------- fetching: one host, a timeout, a size cap, one fetch per file at a time, a cache ----------
async function defaultFetch(url, signal) {
  const res = await fetch(url, { signal, redirect: 'error', headers: { 'user-agent': 'spark-squad-fire-connector/0.1' } });
  const len = Number(res.headers.get('content-length'));
  if (len && len > LIMITS.fileMaxBytes) { try { await res.body.cancel(); } catch (e) { /* ignore */ } throw new FetchFail('too_big'); }
  const chunks = []; let total = 0;
  if (res.body) for await (const ch of res.body) { total += ch.length; if (total > LIMITS.fileMaxBytes) throw new FetchFail('too_big'); chunks.push(ch); }
  return { status: res.status, text: Buffer.concat(chunks).toString('utf8'), lastModified: res.headers.get('last-modified') || null };
}
// For the connector's own test suites only: FIRE_CONNECTOR_NASA_FIXTURES names a folder of saved NASA files, and no network is used.
// FIRE_CONNECTOR_NOW fixes the clock those tests read ("about 3 hours ago"). A hosted service never sets either.
function fixtureFetch(dir) {
  const fs = require('fs'), path = require('path');
  return async (url) => {
    const base = String(url).split('/').pop();
    const m = /^(MODIS_C6_1|J1_VIIRS_C2|J2_VIIRS_C2|SUOMI_VIIRS_C2)_[A-Za-z_]+?_(24h|48h|7d)\.csv$/.exec(base);
    if (!m) return { status: 404, text: 'not found' };
    return { status: 200, text: fs.readFileSync(path.join(dir, m[1] + '_South_America_24h.csv'), 'utf8'), lastModified: 'Sat, 14 Nov 2026 15:46:32 GMT' };
  };
}
let fetcher = process.env.FIRE_CONNECTOR_NASA_FIXTURES ? fixtureFetch(process.env.FIRE_CONNECTOR_NASA_FIXTURES) : defaultFetch, timeoutMs = LIMITS.timeoutMs;
let now = process.env.FIRE_CONNECTOR_NOW && isFinite(Date.parse(process.env.FIRE_CONNECTOR_NOW)) ? (() => Date.parse(process.env.FIRE_CONNECTOR_NOW)) : () => Date.now();
const cache = new Map();       // cache key -> { at, bytes, value }
const inflight = new Map();    // cache key -> promise
let running = 0; const waiting = [];
async function slot() { if (running < LIMITS.maxInFlight) { running++; return; } await new Promise(res => waiting.push(res)); running++; }
function release() { running--; const next = waiting.shift(); if (next) next(); }
function cacheBytes() { let t = 0; for (const v of cache.values()) t += v.bytes; return t; }
function remember(k, bytes, value) {
  cache.delete(k); cache.set(k, { at: now(), bytes, value });
  while (cacheBytes() > LIMITS.cacheMaxBytes && cache.size > 1) cache.delete(cache.keys().next().value);   // oldest first
}
// get(url) -> parsed table. cacheKey must not contain the key.
async function getTable(url, cacheKey, minutes) {
  const u = new URL(url);
  if (u.protocol !== SCHEME + ':' || !ALLOWED_HOSTS.has(u.hostname)) throw new FetchFail('host');
  const hit = cache.get(cacheKey);
  if (hit && now() - hit.at < minutes * 60000) return hit.value;
  if (inflight.has(cacheKey)) return inflight.get(cacheKey);
  const p = (async () => {
    await slot();
    const ctl = new AbortController(); let timer;
    try {
      const timeout = new Promise((_, rej) => { timer = setTimeout(() => { ctl.abort(); rej(new FetchFail('timeout')); }, timeoutMs); });
      let res;
      try { res = await Promise.race([fetcher(url, ctl.signal), timeout]); }
      catch (e) { if (e instanceof FetchFail) throw e; throw new FetchFail(e && e.name === 'AbortError' ? 'timeout' : 'network'); }
      if (!res || res.status !== 200) throw new FetchFail(res && res.status === 429 ? 'busy' : 'http');
      if (typeof res.text !== 'string' || res.text.length > LIMITS.fileMaxBytes) throw new FetchFail('too_big');
      const table = parseCsv(res.text);
      table.lastModified = res.lastModified || null; table.fetchedAt = new Date(now()).toISOString();
      remember(cacheKey, res.text.length, table);
      return table;
    } finally { clearTimeout(timer); release(); }
  })();
  inflight.set(cacheKey, p);
  try { return await p; } finally { inflight.delete(cacheKey); }
}

// ---------- NASA's CSV: plain commas, a header row ----------
function parseCsv(text) {
  const t = text.replace(/^﻿/, '');
  const nl = t.indexOf('\n'); const head = (nl < 0 ? t : t.slice(0, nl)).trim().split(',');
  const ix = new Map(); head.forEach((h, i) => ix.set(h.trim(), i));
  for (const need of ['latitude', 'longitude', 'acq_date', 'acq_time']) if (!ix.has(need)) throw new FetchFail(t.trim() ? 'not_csv' : 'empty_body');
  const g = (name) => ix.has(name) ? ix.get(name) : -1;
  const iLat = g('latitude'), iLon = g('longitude'), iD = g('acq_date'), iT = g('acq_time'), iC = g('confidence'), iF = g('frp'), iDN = g('daynight'), iS = g('satellite'), iTy = g('type'), iI = g('instrument');
  const rows = [];
  if (nl >= 0) for (const line of t.slice(nl + 1).split('\n')) {
    if (!line.trim()) continue;
    const c = line.split(',');
    const lat = Number(c[iLat]), lon = Number(c[iLon]);
    if (!isFinite(lat) || !isFinite(lon) || !/^\d{4}-\d{2}-\d{2}$/.test(c[iD] || '')) continue;
    const tm = String(c[iT] || '').trim().padStart(4, '0');
    rows.push({ lat, lon, date: c[iD], time: /^\d{4}$/.test(tm) ? tm : '0000', conf: iC >= 0 ? String(c[iC]).trim() : '', frp: iF >= 0 && c[iF] !== '' && isFinite(Number(c[iF])) ? Number(c[iF]) : null,
      dn: iDN >= 0 ? String(c[iDN]).trim() : '', sat: iS >= 0 ? String(c[iS]).trim() : '', type: iTy >= 0 && String(c[iTy]).trim() !== '' ? String(c[iTy]).trim() : null, instrument: iI >= 0 ? String(c[iI]).trim() : '' });
  }
  return { columns: head.map(h => h.trim()), rows, hasType: iTy >= 0 };
}

// ---------- summarizing one camera's rows inside the place ----------
const TYPE_NAMES = new Map([['0', 'vegetation fire'], ['1', 'active volcano'], ['2', 'other steady heat source on land'], ['3', 'offshore']]);
function confClass(c) {
  if (c === 'h' || c === 'high') return 'high'; if (c === 'n' || c === 'nominal') return 'nominal'; if (c === 'l' || c === 'low') return 'low';
  const v = Number(c); if (c !== '' && isFinite(v)) return v >= 80 ? 'high' : v >= 30 ? 'nominal' : 'low';   // MODIS: 0-100
  return 'not given';
}
const cellKey = (r) => r.date + '|' + Math.floor(Math.round(r.lon * 1e5) / 5000) + '|' + Math.floor(Math.round(r.lat * 1e5) / 5000);
// tables: one or more parsed NASA files for this camera. trail: { refMs, hours } counts the detections observed in the hours before the fetch
function summarize(camId, tables, place, trail) {
  const inside = [], once = new Set();
  for (const t of tables) for (const r of t.rows) { if (!inBoxes(r.lat, r.lon, place.boxes)) continue; const k = detKey(r); if (once.has(k)) continue; once.add(k); inside.push(r); }
  let within = null;
  if (trail && isFinite(trail.refMs)) { const from = trail.refMs - trail.hours * 3600000; within = 0; for (const r of inside) { const ms = stampMs(r); if (ms >= from && ms <= trail.refMs) within++; } }
  const days = new Map(), cells = new Set(), conf = new Map(), types = new Map(); let day = 0, night = 0, newest = null, oldest = null;
  for (const r of inside) {
    const k = cellKey(r); const d = days.get(r.date) || { date: r.date, detections: 0, patches: new Set() };
    d.detections++; d.patches.add(k); days.set(r.date, d); cells.add(k);
    if (r.dn === 'D') day++; else if (r.dn === 'N') night++;
    const cc = confClass(r.conf); conf.set(cc, (conf.get(cc) || 0) + 1);
    if (r.type !== null) { const tn = TYPE_NAMES.get(r.type) || 'type ' + r.type; types.set(tn, (types.get(tn) || 0) + 1); }
    const stamp = r.date + 'T' + r.time.slice(0, 2) + ':' + r.time.slice(2) + ':00Z'; if (!newest || stamp > newest) newest = stamp; if (!oldest || stamp < oldest) oldest = stamp;
  }
  const per_day = [...days.values()].sort((a, b) => a.date < b.date ? -1 : 1).map(d => ({ date: d.date, detections: d.detections, patches_5km: d.patches.size }));
  const seen = new Set(), top = [];   // VIIRS often reports one heat value for neighboring pixels: one row per spot
  for (const r of inside.slice().sort((a, b) => (b.frp === null ? -1 : b.frp) - (a.frp === null ? -1 : a.frp))) {
    const k = r.date + r.time + r2(r.lat) + ',' + r2(r.lon); if (seen.has(k)) continue; seen.add(k); top.push(row(camId, r)); if (top.length >= LIMITS.topRows) break;
  }
  const out = { camera: camId, detections: inside.length };
  if (trail) out.within_window_before_fetch = within;
  return Object.assign(out, { patch_days_5km: cells.size, per_day, newest_utc: newest, oldest_utc: oldest, day, night,
    confidence: Object.fromEntries(conf), types: types.size ? Object.fromEntries(types) : null, strongest: top, _inside: inside });
}
function row(camId, r) { return { time_utc: r.date + ' ' + r.time.slice(0, 2) + ':' + r.time.slice(2), latitude: r2(r.lat), longitude: r2(r.lon), camera: camId, confidence: r.conf || null, fire_radiative_power_mw: r.frp, type: r.type === null ? null : (TYPE_NAMES.get(r.type) || r.type) }; }
// which part of the box most of the fire is in, when one part clearly leads
function wherePart(inside, place) {
  if (inside.length < 10 || place.boxes.length > 1) return '';
  const [w, s, e, n] = place.boxes[0], midLat = (s + n) / 2, midLon = (w + e) / 2;
  let north = 0, east = 0; for (const r of inside) { if (r.lat > midLat) north++; if (r.lon > midLon) east++; }
  const N = inside.length, ns = north / N >= 0.65 ? 'north' : north / N <= 0.35 ? 'south' : '', ew = east / N >= 0.65 ? 'east' : east / N <= 0.35 ? 'west' : '';
  const part = ns && ew ? ns + ew : ns || ew; return part ? 'most of it in the ' + part : '';
}
function ago(iso) {
  if (!iso) return null; const mins = Math.round((now() - Date.parse(iso)) / 60000);
  if (mins < 0) return 'just now';
  if (mins < 90) return 'about ' + Math.max(1, mins) + ' minutes ago';
  const h = Math.round(mins / 60); if (h < 48) return 'about ' + h + ' hours ago';
  return 'about ' + Math.round(h / 24) + ' days ago';
}
const FILE_WORDS = { '24h': 'NASA\'s 24-hour file', '48h': 'NASA\'s 48-hour file', '7d': 'NASA\'s 7-day file' };
const SHORT_TIME = (iso) => iso ? iso.slice(11, 16) + ' UTC ' + new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' }) : null;
const ACT_TAIL = 'NASA\'s own words: "' + CAUTION + '" For what to do right now, follow your local authorities and emergency services.';
const PLAIN_TIME = (iso) => iso ? iso.slice(11, 16) + ' UTC on ' + new Date(iso).toLocaleDateString('en-US', { month: 'long', day: 'numeric', timeZone: 'UTC' }) : null;
const UNIT = 'Each detection is one satellite pass seeing fire in one spot, so a big fire shows up many times and a small one can be missed.';
const QUAL_COMPARE = 'MODIS and VIIRS counts can\'t be added or compared: VIIRS sees about three times as much.';

// places with no usable historical month (world_table rows with record_ends null): no 26-year answer to offer
const NO_HISTORY = new Set();
try { for (const r of require('../vendor/data/world_table.json').rows) if (r.record_ends == null) NO_HISTORY.add(r.file); } catch (e) { /* no table: offer the record as before */ }
const hasHistory = (place) => !!place.country && !NO_HISTORY.has((SRC.countries.find(c => c.name === place.country) || {}).file);

const SAY = new Map([['MODIS', 'MODIS'], ['VIIRS NOAA-20', 'VIIRS on NOAA-20'], ['VIIRS NOAA-21', 'VIIRS on NOAA-21'], ['VIIRS S-NPP', 'VIIRS on S-NPP'], ['Landsat', 'Landsat']]);
const say = (id) => SAY.get(id) || id;
const sayAll = (ids) => ids.map(say).join(' and ');
const family = (id) => SRC.cameras[id] ? SRC.cameras[id].family : String(id).split(' ')[0];

// the shared answer for nasa_recent and nasa_archive: what NASA saw first, as a fact; the unit once; at most one qualifier; the next question last
function buildAnswer(opts) {
  const { place, sums, empties, windowWords, windowId, actingNow, fetchedNote, observedFrom, observedTo, fetchedUtc } = opts;
  const withData = sums.filter(s => s.detections > 0);
  const lines = [];
  const total = sums.reduce((a, s) => a + s.detections, 0);
  // a camera that sent nothing is worth saying only when no camera of its kind sent anything
  const silent = empties.filter(id => !sums.some(s => family(s.camera) === family(id)));
  if (!sums.length) {
    lines.push('We don\'t know: ' + sayAll(empties) + (empties.length > 1 ? ' have' : ' has') + ' sent nothing ' + (windowId ? 'in this window' : 'for these dates') + '.');
  } else if (!total) {
    lines.push('No detections from ' + sayAll(sums.map(s => s.camera)) + (windowId ? ' in this window ' : ' for these dates ') + place.label + '.');
    if (windowId) lines.push('That is ' + windowWords + ', fetched at ' + SHORT_TIME(fetchedUtc) + '.');
    if (silent.length) lines.push(sayAll(silent) + ' sent nothing in this window.');
  } else {
    const lead = withData.slice().sort((a, b) => b.detections - a.detections)[0];
    const part = wherePart(lead._inside, place);
    const leadName = family(lead.camera) === 'VIIRS' ? 'the newer VIIRS camera on ' + lead.camera.replace('VIIRS ', '') : lead.camera === 'MODIS' ? 'MODIS, NASA\'s older camera,' : say(lead.camera);
    if (windowId) {
      // the file's count, then the exact trailing window: NASA's files can hold observations older than their label
      const w = lead.within_window_before_fetch, before = BEFORE_WORDS[windowId] + ' before the file was fetched';
      const trail = Number.isInteger(w) ? ', ' + (w === lead.detections ? 'all of them' : w === 0 ? 'none of them' : fmt(w) + ' of them') + ' in ' + before : '';
      lines.push(windowWords + ' has fire ' + place.label + ': ' + leadName + ' detected it ' + fmt(lead.detections) + ' times' + trail + '.' + (part ? ' ' + part.replace(/^most of it in/, 'Most of it is in') + '.' : ''));
    } else lines.push(windowWords + ' NASA\'s satellites picked up fire ' + place.label + ': ' + leadName + ' detected it ' + fmt(lead.detections) + ' times' + (part ? ', ' + part : '') + '.');
    if (windowId && observedFrom) lines.push('They were observed between ' + SHORT_TIME(observedFrom) + ' and ' + SHORT_TIME(observedTo) + '; the file was fetched at ' + SHORT_TIME(fetchedUtc) + '.');
    lines.push(UNIT);
    const rest = sums.filter(s => s !== lead).map(s => say(s.camera) + ' ' + (s.detections ? fmt(s.detections) : 'none'));
    lines.push('By camera: ' + say(lead.camera) + ' ' + fmt(lead.detections) + ' (in ' + fmt(lead.patch_days_5km) + ' five-km patches of ground, counted once a day)' + (rest.length ? '; ' + rest.join('; ') : '') + '.');
    const newest = sums.map(s => s.newest_utc).filter(Boolean).sort().pop();
    lines.push('The newest detection is from ' + PLAIN_TIME(newest) + ', ' + ago(newest) + '.');
    const day = sums.reduce((a, s) => a + s.day, 0), night = sums.reduce((a, s) => a + s.night, 0);
    if (day + night) { const nf = night / (day + night); lines.push(nf >= 0.6 ? 'Most came at night (' + Math.round(nf * 100) + '%).' : nf <= 0.4 ? 'Most came in daytime (' + Math.round((1 - nf) * 100) + '%).' : 'They split about evenly between day and night.'); }
    const high = lead.confidence.high || 0, nominal = lead.confidence.nominal || 0;
    lines.push('NASA rates ' + (high ? fmt(high) : 'none') + ' of ' + say(lead.camera) + '\'s ' + fmt(lead.detections) + ' as high confidence' + (nominal ? ' and ' + fmt(nominal) + ' as nominal' : '') + '.');
    const types = new Map(); for (const s of sums) if (s.types) for (const k in s.types) types.set(k, (types.get(k) || 0) + s.types[k]);
    if (types.size) lines.push('NASA marks ' + [...types.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => fmt(v) + ' as ' + k).join(', ') + '.');
    const top = sums.flatMap(s => s.strongest).filter(r => r.fire_radiative_power_mw !== null).sort((a, b) => b.fire_radiative_power_mw - a.fire_radiative_power_mw)[0];
    if (top) lines.push('The strongest gave off ' + fmt(Math.round(top.fire_radiative_power_mw)) + ' megawatts of heat, at latitude ' + top.latitude + ', longitude ' + top.longitude + ' (' + say(top.camera) + ', ' + top.time_utc + ' UTC).');
    if (new Set(withData.map(s => family(s.camera))).size > 1) lines.push(QUAL_COMPARE);
    else if (silent.length) lines.push(sayAll(silent) + ' sent nothing in this window.');
  }
  if (fetchedNote) lines.push(fetchedNote);
  if (!sums.length) lines.push('Want to hear from the other cameras? Ask again with camera "all", or look at NASA\'s live map: ' + MAP_URL);
  else if (place.country && !opts.history) lines.push(windowId !== '7d' ? 'Want to look further back? Ask again with window "7d".' : 'Want to see these on a map? NASA\'s live map has them: ' + MAP_URL);
  else if (place.country) lines.push('Want to know if that\'s a lot for ' + place.country + '? Ask the 26-year record how this month compares with the usual.');
  else if (total) lines.push('Want to see these on a map? NASA\'s live map has them: ' + MAP_URL);
  else if (windowId && windowId !== '7d') lines.push('Want to look further back? Ask again with window "7d".');
  else lines.push('Want to try another box? Ask again with a different latitude-longitude box.');
  if (actingNow) lines.push((total ? 'NASA\'s live map shows these same detections: ' : 'NASA\'s live map: ') + MAP_URL + ' . ' + ACT_TAIL);
  return lines.join(' ');
}
function failText(kind, what) {
  const why = kind === 'timeout' ? 'NASA didn\'t answer in time' : kind === 'too_big' ? 'NASA\'s file was bigger than this connector takes' : kind === 'busy' ? 'NASA says it\'s busy' : kind === 'not_csv' || kind === 'empty_body' ? 'NASA sent back something other than fire data' : 'the request to NASA didn\'t go through';
  return 'We don\'t know right now: ' + why + (what ? ' (' + what + ')' : '') + '. Try again in a minute, or look at NASA\'s live map: ' + MAP_URL;
}

// ---------- tool 1: nasa_recent ----------
const CAMERAS_FOR = { MODIS: ['MODIS'], VIIRS: ['VIIRS NOAA-20', 'VIIRS NOAA-21', 'VIIRS S-NPP'], all: ['VIIRS NOAA-20', 'VIIRS NOAA-21', 'VIIRS S-NPP', 'MODIS'] };
async function nasaRecent(raw) {
  const a = checkArgs(raw, { place: 'string', box: 'box', window: ['24h', '48h', '7d'], camera: ['MODIS', 'VIIRS', 'all'], acting_now: 'boolean' });
  const place = where(a), win = a.window || '24h', cam = a.camera || 'all';
  const regions = regionsFor(place.boxes);
  const results = await Promise.all(CAMERAS_FOR[cam].map(async (id) => {
    const c = SRC.cameras[id];
    const files = regions.map(region => ({ region, url: SCHEME + '://' + HOST + SRC.files.path.replace('{dir}', c.dir).replace('{prefix}', c.prefix).replace('{file_part}', region.file_part).replace('{window}', win) }));
    try { await Promise.all(files.map(async (f) => { f.table = await getTable(f.url, 'recent|' + f.url, LIMITS.cacheMinutesRecent); })); return { id, files }; }
    catch (e) { if (e instanceof FetchFail) { log('fetch', id, regions.map(r => r.file_part).join('+'), win, 'failed:', e.kind); return { id, files, fail: e.kind }; } throw e; }
  }));
  const failed = results.filter(r => r.fail);
  if (failed.length === results.length) throw new Refusal('NASA_UNREACHABLE', failText(failed[0].fail), { failed: failed.map(f => ({ camera: f.id, reason: f.fail })) });
  const got = results.filter(r => !r.fail);
  // the reference for the trailing window: when the (earliest) file was fetched
  const fetchedUtc = got.flatMap(r => r.files.map(f => f.table.fetchedAt)).sort()[0] || null;
  const trail = { refMs: fetchedUtc ? Date.parse(fetchedUtc) : NaN, hours: WINDOW_HOURS[win] };
  const sums = [], empties = [];
  for (const r of got) { if (r.files.every(f => !f.table.rows.length)) { empties.push(r.id); continue; } sums.push(summarize(r.id, r.files.map(f => f.table), place, trail)); }
  const failNote = failed.length ? sayAll(failed.map(f => f.id)) + ': ' + failText(failed[0].fail).replace(/^We don't know right now: /, '').replace(/\. Try again.*$/, '') + ', so ' + (failed.length > 1 ? 'they\'re' : 'it\'s') + ' left out.' : '';
  const stamps = (k) => sums.map(s => s[k]).filter(Boolean).sort();
  const observedFrom = stamps('oldest_utc')[0] || null, observedTo = stamps('newest_utc').pop() || null;
  const text = buildAnswer({ place, sums, empties, windowWords: FILE_WORDS[win], windowId: win, actingNow: !!a.acting_now, history: hasHistory(place), fetchedNote: failNote, observedFrom, observedTo, fetchedUtc });
  const data = {
    source: 'NASA FIRMS near-real-time active fire files, straight from ' + HOST + ', not adjusted or put on one scale',
    place: place.country, area: place.country ? (place.boxes.length > 1 ? 'boxes' : 'box') + ' around ' + place.country : 'box given', box: { west: place.box[0], south: place.box[1], east: place.box[2], north: place.box[3], crosses_180: place.wraps },
    window: win, window_kind: 'nasa_file_' + win, window_label: FILE_WORDS[win], observed_from_utc: observedFrom, observed_to_utc: observedTo, fetched_utc: fetchedUtc,
    trailing_window: { hours: WINDOW_HOURS[win], reference_utc: fetchedUtc, detections_by_camera: Object.fromEntries(sums.map(s => [s.camera, s.within_window_before_fetch])),
      note: 'NASA\'s ' + win + ' file can hold observations older than ' + BEFORE_WORDS[win].replace(/^the /, '') + ': NASA updates it through the day. These counts keep only the detections observed in ' + BEFORE_WORDS[win] + ' up to reference_utc, when the file was fetched.' },
    coverage_mode: 'rectangles', coverage: coverageOf(place), classification: 'unclassified thermal detections (rapid feed); the 26-year record counts vegetation fire',
    camera: cam, nasa_region_file: regions.map(r => r.nasa_name).join(', '),
    cameras: sums.map(s => { const o = Object.assign({}, s); delete o._inside; return o; }),
    sent_nothing: empties, could_not_fetch: failed.map(f => ({ camera: f.id, reason: f.fail })),
    files: got.flatMap(r => r.files.map(f => ({ camera: r.id, url: f.url, nasa_region_file: f.region.nasa_name, nasa_last_updated: f.table.lastModified, fetched_utc: f.table.fetchedAt, rows_in_file: f.table.rows.length, has_type_column: f.table.hasType }))),
    unit: 'A detection is one satellite pass seeing fire at one spot. patch_days_5km counts each 0.05-degree patch of ground (about 5 km) once per UTC day per camera, the way the 26-year record counts (the record also keeps only NASA type 0, vegetation fire; these quick files carry no type).',
    live_map: MAP_URL, next_question: !place.country ? null : hasHistory(place) ? { tool: 'fire_answer', arguments: { place: place.country, period: 'latest' } } : win !== '7d' ? { tool: 'nasa_recent', arguments: { place: place.country, window: '7d' } } : null
  };
  if (a.acting_now) data.acting_now_line = ACT_TAIL;
  return { text, data };
}

// ---------- tool 2: nasa_archive (needs the connector runner's own NASA map key) ----------
const API_SOURCES = Object.keys(SRC.api.sources);
const DATE_RE = /^(\d{4})-(\d{2})-(\d{2})$/;
function parseDate(s, name) {
  const m = DATE_RE.exec(s || ''); const d = m ? new Date(Date.UTC(+m[1], +m[2] - 1, +m[3])) : null;
  if (!d || d.getUTCDate() !== +m[3]) throw new Refusal('BAD_DATE', '"' + name + '" has to be a date like 2026-11-01.');
  return d;
}
function needsKeyText() {
  return 'This one needs a NASA map key, and this connector doesn\'t have one. A key is free: ask NASA for one at ' + MAP_KEY_PAGE + ' (it arrives by e-mail), then set it as FIRMS_MAP_KEY in the environment that starts this connector and restart it. ' +
    'With a key you can ask for any stretch of dates, for example "fire detections in and around Greece from August 1 to August 20, 2025" or "every MODIS detection in this box last March", from NASA\'s near-real-time feed or its finished archive. ' +
    'Without a key, nasa_recent reads NASA\'s files labeled 24h, 48h and 7d.';
}
async function nasaArchive(raw) {
  const a = checkArgs(raw, { place: 'string', box: 'box', from: 'string', to: 'string', source: API_SOURCES, acting_now: 'boolean' });
  const place = where(a);
  if (!a.from || !a.to) throw new Refusal('BAD_DATE', 'Say which dates: "from" and "to", like 2026-11-01 and 2026-11-07.');
  const from = parseDate(a.from, 'from'), to = parseDate(a.to, 'to');
  const today = new Date(now()); const todayUtc = Date.UTC(today.getUTCFullYear(), today.getUTCMonth(), today.getUTCDate());
  if (to < from) throw new Refusal('BAD_DATE', '"to" comes before "from".');
  if (to.getTime() > todayUtc) throw new Refusal('FUTURE_DATE', 'Those dates reach past today. NASA has data up to today; ask about dates up to ' + new Date(todayUtc).toISOString().slice(0, 10) + '.');
  const days = Math.round((to - from) / 86400000) + 1;
  if (days > LIMITS.archiveMaxDays) throw new Refusal('TOO_MANY_DAYS', 'That\'s ' + days + ' days; this connector asks NASA for at most ' + LIMITS.archiveMaxDays + ' at a time. Split it into shorter stretches.');
  const source = a.source || 'VIIRS_NOAA20_SP';
  const key = keyNow();
  if (!key) throw new Refusal('NEEDS_KEY', needsKeyText(), { map_key_page: MAP_KEY_PAGE, environment_variable: 'FIRMS_MAP_KEY' });
  // one request per box (a box over the 180° line is already two), per stretch of at most 5 days
  const boxes = place.boxes;
  const chunks = []; for (let d = new Date(from); d <= to; d = new Date(d.getTime() + SRC.api.day_range_max * 86400000)) { const left = Math.round((to - d) / 86400000) + 1; chunks.push([d.toISOString().slice(0, 10), Math.min(SRC.api.day_range_max, left)]); }
  const tables = []; let tableTypes = false;
  for (const b of boxes) for (const [date, n] of chunks) {
    const area = b.map(v => r2(v)).join(',');
    const url = SCHEME + '://' + HOST + '/api/area/csv/' + encodeURIComponent(key) + '/' + source + '/' + area + '/' + n + '/' + date;
    let t;
    try { t = await getTable(url, 'archive|' + source + '|' + area + '|' + n + '|' + date, source.endsWith('_SP') ? LIMITS.cacheMinutesArchive : LIMITS.cacheMinutesRecent); }
    catch (e) {
      if (!(e instanceof FetchFail)) throw e;
      log('archive', source, date, 'failed:', e.kind);
      if (e.kind === 'not_csv') throw new Refusal('NASA_SAID_NO', 'We don\'t know: NASA turned the request down. The usual reasons are a map key NASA doesn\'t accept, or too many requests in ten minutes (NASA allows 5,000). Check the key at ' + MAP_KEY_PAGE + ' and try again in a few minutes.');
      throw new Refusal('NASA_UNREACHABLE', failText(e.kind));
    }
    tableTypes = tableTypes || t.hasType; tables.push(t);
  }
  const camId = source.startsWith('MODIS') ? 'MODIS' : source.startsWith('VIIRS_NOAA20') ? 'VIIRS NOAA-20' : source.startsWith('VIIRS_NOAA21') ? 'VIIRS NOAA-21' : source.startsWith('VIIRS_SNPP') ? 'VIIRS S-NPP' : 'Landsat';
  const sums = [summarize(camId, tables, place, null)];
  const span = a.from === a.to ? 'On ' + a.from : 'From ' + a.from + ' to ' + a.to;
  const text = buildAnswer({ place, sums, empties: [], windowWords: span + ',', windowId: null, actingNow: !!a.acting_now, fetchedNote: '' });
  const s = Object.assign({}, sums[0]); delete s._inside;
  const acting = a.acting_now ? { acting_now_line: ACT_TAIL } : {};
  return { text, data: Object.assign({ coverage_mode: 'rectangles', coverage: coverageOf(place) }, acting, { source: 'NASA FIRMS area API, ' + source + ' (' + SRC.api.sources[source] + '), straight from ' + HOST, place: place.country, box: { west: place.box[0], south: place.box[1], east: place.box[2], north: place.box[3], crosses_180: place.wraps },
    from: a.from, to: a.to, days, requests_to_nasa: boxes.length * chunks.length, has_type_column: tableTypes, camera: s, live_map: MAP_URL }) };
}

// ---------- tool 3: nasa_sources ----------
function nasaSources(raw) {
  checkArgs(raw, {});
  const cams = Object.values(SRC.cameras);
  const text = 'This connector reaches NASA FIRMS (Fire Information for Resource Management System) directly at ' + HOST + '. ' +
    'With no key: NASA\'s near-real-time active fire files labeled 24h, 48h and 7d, from MODIS (NASA\'s older camera, on the Terra and Aqua satellites) and VIIRS (the newer, sharper camera, on NOAA-20 and NOAA-21), for ' + (SRC.regions.length - 1) + ' world regions and the whole world. ' +
    'NASA updates these files through the day, so a file\'s observations can be older than its label; each answer also counts the detections in the 24 hours, 48 hours or 7 days before the file was fetched. ' +
    'VIIRS on Suomi NPP is no longer in NASA\'s file list; its file has no rows. Landsat fire files exist for the US and Canada only and aren\'t used here. ' +
    'Each answer says when NASA last updated the file. This connector keeps a copy for ' + LIMITS.cacheMinutesRecent + ' minutes, so it asks NASA at most once per file in that time. ' +
    'With a NASA map key (free, from ' + MAP_KEY_PAGE + '): any stretch of up to ' + LIMITS.archiveMaxDays + ' days, from the near-real-time feed or the finished archive (NASA calls it Standard Processing). ' +
    'These are NASA\'s own detections, not put on one scale. The 26-year record is the team\'s: MODIS and VIIRS put on one scale since 2000, to say whether a place is burning more than usual. ' +
    UNIT + ' ' +
    'NASA\'s own caution, word for word: "' + CAUTION + '" For safety, follow local authorities and emergency services. NASA\'s live map: ' + MAP_URL;
  return { text, data: {
    host: HOST, live_map: MAP_URL, nasa_caution: CAUTION, map_key_page: MAP_KEY_PAGE, key_set: !!keyNow(),
    keyless: { windows: SRC.files.windows, cache_minutes: LIMITS.cacheMinutesRecent, cameras: cams.map(c => ({ camera: c.id, nasa_name: c.nasa_name, in_nasa_list: c.listed_by_nasa, note: c.note || null })),
      regions: SRC.regions.map(r => ({ nasa_name: r.nasa_name, box: { west: r.box[0], south: r.box[1], east: r.box[2], north: r.box[3] } })), file_pattern: SCHEME + '://' + HOST + SRC.files.path },
    with_key: { sources: SRC.api.sources, max_days_per_request: SRC.api.day_range_max, max_days_per_question: LIMITS.archiveMaxDays, limit: SRC.api.limit, freshness: SRC.api.freshness, country_query: SRC.api.country_endpoint },
    places: { countries_with_a_box: SRC.countries.length, note: SRC.countries_note }
  } };
}

// ---------- declarations, handlers and one entry point for the connector ----------
const PLACE_P = { type: 'string', maxLength: LIMITS.textMax, description: 'A country by its everyday name ("Argentina", "Greece"). The tool uses a box drawn around it, which takes in edges of neighboring countries; a country across the 180° line or with far islands gets several boxes (New Zealand with the Chatham Islands, Fiji, Russia, the United States with the Aleutians, Kiribati). Give this or box, not both.' };
const BOX_P = { type: 'array', items: { type: 'number' }, minItems: 4, maxItems: 4, description: 'Instead of a place: [west, south, east, north] in degrees, e.g. [-73.7, -55.2, -53.6, -21.7]. A box across the 180° line has west greater than east, e.g. [170, -50, -170, -30]: it is split into two boxes, one on each side of the line, and each detection is counted once.' };
const ACT_P = { type: 'boolean', description: 'true only when the person is asking because they need to act right now (a fire near them, deciding what to do). Adds NASA\'s live map, NASA\'s caution and a pointer to local authorities.' };
const TOOLS = [
  { name: 'nasa_recent', title: 'NASA\'s fire detections from its 24h, 48h and 7d files',
    description: 'Active fire detections straight from NASA FIRMS for a country or a latitude-longitude box, from NASA\'s files labeled 24h, 48h and 7d. NASA updates these files through the day, so their observations can be older than the label. Per camera: how many times it detected fire in the file, and how many of those were observed in the 24 hours, 48 hours or 7 days before the file was fetched; in how many 5 km patches per day; when the newest one was; day and night; NASA\'s confidence; and the strongest few. No key needed. These are NASA\'s own numbers, not on the 26-year record\'s scale.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { place: PLACE_P, box: BOX_P, window: { type: 'string', enum: ['24h', '48h', '7d'], description: 'Which NASA file: "24h", "48h" or "7d" (NASA\'s labels; observations in a file can be older). Default "24h".' }, camera: { type: 'string', enum: ['MODIS', 'VIIRS', 'all'], description: 'Default "all".' }, acting_now: ACT_P } } },
  { name: 'nasa_archive', title: 'NASA\'s fire detections for chosen dates (needs a NASA map key)',
    description: 'Active fire detections from NASA FIRMS for a country or box between two dates (up to 31 days), from the near-real-time feed or NASA\'s finished archive. Needs a free NASA map key set as FIRMS_MAP_KEY where the connector runs; without one it says how to get one.',
    inputSchema: { type: 'object', additionalProperties: false, properties: { place: PLACE_P, box: BOX_P, from: { type: 'string', maxLength: 10, description: 'First day, YYYY-MM-DD (UTC).' }, to: { type: 'string', maxLength: 10, description: 'Last day, YYYY-MM-DD (UTC).' },
      source: { type: 'string', enum: API_SOURCES, description: 'NASA\'s name for the data. Default VIIRS_NOAA20_SP (finished archive, NOAA-20). _NRT = near real time, _SP = finished archive.' }, acting_now: ACT_P }, required: ['from', 'to'] } },
  { name: 'nasa_sources', title: 'What NASA data this connector reaches',
    description: 'Which NASA FIRMS data this connector can reach, each source\'s window and freshness, NASA\'s own names for them, NASA\'s caution about the data, and the link to NASA\'s live map.',
    inputSchema: { type: 'object', additionalProperties: false, properties: {} } }
];
const HANDLERS = new Map([['nasa_recent', nasaRecent], ['nasa_archive', nasaArchive], ['nasa_sources', nasaSources]]);
const TOOL_NAMES = new Set(HANDLERS.keys());

// One full MCP tools/call result. Never throws; never forwards an internal error; scrubs the key from everything it returns.
async function call(name, args) {
  if (typeof name !== 'string' || !HANDLERS.has(name)) return { content: [{ type: 'text', text: 'There is no NASA tool by that name. These exist: ' + [...TOOL_NAMES].join(', ') + '.' }], isError: true };
  const acting = name !== 'nasa_sources' && !!args && typeof args === 'object' && !Array.isArray(args) && args.acting_now === true;
  const actExtra = acting ? { acting_now_line: ACT_TAIL } : {};
  const actText = (t) => acting ? t + ' ' + ACT_TAIL : t;
  try {
    const out = await HANDLERS.get(name)(args);
    return JSON.parse(scrub(JSON.stringify({ content: [{ type: 'text', text: out.text }], structuredContent: out.data, isError: false })));
  } catch (e) {
    if (e instanceof Refusal) return JSON.parse(scrub(JSON.stringify({ content: [{ type: 'text', text: actText(e.message) }], structuredContent: Object.assign({ refusal: { code: e.code, message: e.message } }, e.extra, actExtra), isError: true })));
    log('tool', name, 'failed:', e && e.name || 'error');   // no stack, no message: they can carry paths or the request address
    return { content: [{ type: 'text', text: actText('Something went wrong inside the NASA tool, so there\'s no answer. Try again, or look at NASA\'s live map: ' + MAP_URL) }], structuredContent: actExtra, isError: true };
  }
}

// a paragraph for the connector's instructions to the connected model
const INSTRUCTIONS = 'The nasa_ tools reach NASA FIRMS directly: NASA\'s own fire detections from its files labeled 24h, 48h and 7d (and chosen dates with a NASA map key), not put on one scale. ' +
  'NASA updates those files through the day, so a file\'s observations can be older than its label; each answer gives the file\'s count and how many of those came in the 24 hours, 48 hours or 7 days before the file was fetched. ' +
  'Lead with what NASA saw, as a fact: "NASA\'s 24-hour file has fire in and around Argentina, most of it in the north." Call it fire. ' +
  'A number counts detections: one satellite pass seeing fire in one spot. Say that once. MODIS and VIIRS counts are never added or compared with each other or with the 26-year record\'s verdicts (VIIRS sees about three times as much). ' +
  'For "is that a lot?", use the 26-year record tools. NASA\'s live map shows the same detections: ' + MAP_URL + ' . ' +
  'Only when someone asks what to do right now: answer what the data shows, then NASA\'s caution, word for word ("' + CAUTION + '"), and send them to local authorities and emergency services.';

module.exports = { TOOLS, HANDLERS, TOOL_NAMES, call, INSTRUCTIONS, Refusal, LIMITS,
  _test: { setFetcher(f) { fetcher = f || defaultFetch; }, setNow(f) { now = f || (() => Date.now()); }, clearCache() { cache.clear(); inflight.clear(); }, setTimeoutMs(ms) { timeoutMs = ms || LIMITS.timeoutMs; }, getTable: (u) => getTable(u, 'test|' + u, 1), scrub, regionsFor, splitBox, parseCsv, cellKey, where: (a) => where(checkArgs(a, { place: 'string', box: 'box' })) } };
