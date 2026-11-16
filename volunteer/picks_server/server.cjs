/* Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md. */
//
// Picks service for the hot spot volunteer page. Node only (http, fs, path): no packages.
// Stores ONE line per pick in a plain file: {"place","pick","t" (UTC, to the minute),"session"}. Nothing else.
//
// Settings (environment variables):
//   PICKS_PORT       port on 127.0.0.1 (default 8871). It never listens on a public interface.
//   PICKS_ORIGIN     the one web origin allowed to call it, e.g. https://example.org (required for POST from a browser)
//   PICKS_FILE       where picks are kept (default ./picks.jsonl beside this file)
//   PICKS_PLACES     the page's places.json (default ../site/data/places.json)
//   PICKS_MAX_BYTES  stop accepting when the file reaches this size (default 5 MB)
//   PICKS_READONLY   1 = take no new picks (tally and health still answer)
//   PICKS_RATE       picks per device per ten minutes (default 120); the device address is counted in memory only
'use strict';
const http = require('http'); const fs = require('fs'); const path = require('path');
const VERSION = 'picks-0.1-pencil';
const ANSWERS = new Set(['fire', 'industry', 'volcano', 'something', 'canttell']);
const SESSION_RE = /^[A-Za-z0-9]{1,24}$/;
const MAX_BODY = 300;

function createPicks(opt = {}) {
  const o = {
    file: opt.file || process.env.PICKS_FILE || path.join(__dirname, 'picks.jsonl'),
    places: opt.places || process.env.PICKS_PLACES || path.join(__dirname, '..', 'site', 'data', 'places.json'),
    origin: opt.origin !== undefined ? opt.origin : (process.env.PICKS_ORIGIN || ''),
    maxBytes: opt.maxBytes || +process.env.PICKS_MAX_BYTES || 5 * 1024 * 1024,
    readonly: opt.readonly !== undefined ? opt.readonly : process.env.PICKS_READONLY === '1',
    rate: opt.rate || +process.env.PICKS_RATE || 120,
    windowMs: opt.windowMs || 10 * 60 * 1000,
    tallyMs: opt.tallyMs || 5000,
  };
  const placeIds = new Set(JSON.parse(fs.readFileSync(o.places, 'utf8')).places.map(p => p.id));
  // state rebuilt from the file at start
  const counts = {}; const seen = new Set(); let total = 0; let bytes = 0;
  const add = r => { const c = counts[r.place] || (counts[r.place] = {}); c[r.pick] = (c[r.pick] || 0) + 1; seen.add(r.session + '|' + r.place); total++; };
  if (fs.existsSync(o.file)) {
    const txt = fs.readFileSync(o.file, 'utf8'); bytes = Buffer.byteLength(txt);
    for (const line of txt.split('\n')) { if (!line) continue; try { const r = JSON.parse(line); if (placeIds.has(r.place) && ANSWERS.has(r.pick)) add(r); } catch (e) { /* skip a damaged line */ } }
  }
  const hits = new Map();   // device address -> [times]; memory only, never written
  setInterval(() => { const cut = Date.now() - o.windowMs; for (const [k, v] of hits) { const w = v.filter(t => t > cut); if (w.length) hits.set(k, w); else hits.delete(k); } }, 60000).unref();
  let tallyCache = null, tallyAt = 0;

  const full = () => bytes >= o.maxBytes;
  function cors(req, res) {
    const org = req.headers.origin;
    if (org && o.origin && org === o.origin) { res.setHeader('Access-Control-Allow-Origin', org); res.setHeader('Vary', 'Origin'); }
  }
  function send(res, code, obj) {
    const body = typeof obj === 'string' ? obj : JSON.stringify(obj);
    res.writeHead(code, { 'Content-Type': typeof obj === 'string' ? 'text/plain; charset=utf-8' : 'application/json; charset=utf-8',
      'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Length': Buffer.byteLength(body) });
    res.end(body);
  }
  function device(req) {   // the web server in front sets X-Real-IP; counted in memory for the limit only
    const h = req.headers['x-real-ip'];
    return (typeof h === 'string' && h.length < 64 ? h : '') || req.socket.remoteAddress || '?';
  }
  function limited(dev) {
    const now = Date.now(), cut = now - o.windowMs;
    const v = (hits.get(dev) || []).filter(t => t > cut);
    if (v.length >= o.rate) { hits.set(dev, v); return true; }
    v.push(now); hits.set(dev, v); return false;
  }
  function minuteUTC() { return new Date().toISOString().slice(0, 16) + 'Z'; }

  function handle(req, res) {
    cors(req, res);
    const url = (req.url || '/').split('?')[0];
    if (req.method === 'OPTIONS') {
      if (req.headers.origin && req.headers.origin === o.origin) {
        res.writeHead(204, { 'Access-Control-Allow-Methods': 'GET, POST', 'Access-Control-Allow-Headers': 'Content-Type', 'Access-Control-Max-Age': '600' });
        return res.end();
      }
      return send(res, 403, 'origin not allowed');
    }
    if (req.method === 'GET' && url === '/health') {
      return send(res, 200, { ok: true, version: VERSION, picks: total, places_with_picks: Object.keys(counts).length, accepting: !o.readonly && !full(), bytes });
    }
    if (req.method === 'GET' && url === '/tally') {
      const q = new URLSearchParams((req.url || '').split('?')[1] || '');
      const one = q.get('place');
      if (one !== null) {   // one place, straight from memory (cheap; includes the pick just made)
        if (!placeIds.has(one)) return send(res, 400, 'unknown place');
        return send(res, 200, { place: one, counts: counts[one] || {} });
      }
      const now = Date.now();
      if (!tallyCache || now - tallyAt > o.tallyMs) { tallyCache = JSON.stringify({ total, places: counts }); tallyAt = now; }
      return send(res, 200, JSON.parse(tallyCache));
    }
    if (req.method === 'POST' && url === '/pick') {
      if (!req.headers.origin || req.headers.origin !== o.origin) return send(res, 403, 'origin not allowed');
      if (o.readonly) return send(res, 503, 'read only');
      if (full()) return send(res, 507, 'full');
      if (limited(device(req))) return send(res, 429, 'too many picks, try later');
      const len = +(req.headers['content-length'] || 0);
      if (len > MAX_BODY) { res.setHeader('Connection', 'close'); send(res, 413, 'too big'); return req.destroy(); }
      let got = 0; const parts = []; let done = false;
      req.on('data', ch => { got += ch.length; if (got > MAX_BODY && !done) { done = true; res.setHeader('Connection', 'close'); send(res, 413, 'too big'); req.destroy(); } else parts.push(ch); });
      req.on('end', () => {
        if (done) return; done = true;
        let b;
        try { b = JSON.parse(Buffer.concat(parts).toString('utf8')); } catch (e) { return send(res, 400, 'not json'); }
        if (!b || typeof b !== 'object' || Array.isArray(b)) return send(res, 400, 'not an object');
        const keys = Object.keys(b).sort().join(',');
        if (keys !== 'pick,place,session') return send(res, 400, 'fields must be place, pick, session');
        if (typeof b.place !== 'string' || !placeIds.has(b.place)) return send(res, 400, 'unknown place');
        if (typeof b.pick !== 'string' || !ANSWERS.has(b.pick)) return send(res, 400, 'unknown pick');
        if (typeof b.session !== 'string' || !SESSION_RE.test(b.session)) return send(res, 400, 'bad session');
        if (seen.has(b.session + '|' + b.place)) return send(res, 200, { ok: true, kept: false });   // one pick per place per visit
        const line = JSON.stringify({ place: b.place, pick: b.pick, t: minuteUTC(), session: b.session }) + '\n';
        if (bytes + Buffer.byteLength(line) > o.maxBytes) { bytes = o.maxBytes; return send(res, 507, 'full'); }
        try { fs.appendFileSync(o.file, line); } catch (e) { return send(res, 500, 'could not save'); }
        bytes += Buffer.byteLength(line); add(b);
        return send(res, 200, { ok: true, kept: true });
      });
      req.on('error', () => { done = true; });
      return;
    }
    return send(res, 404, 'not found');
  }
  const server = http.createServer((req, res) => { try { handle(req, res); } catch (e) { try { send(res, 500, 'error'); } catch (e2) { } } });
  server.requestTimeout = 10000; server.headersTimeout = 8000; server.maxHeadersCount = 40;
  return { server, opts: o };
}

module.exports = { createPicks, VERSION };
if (require.main === module) {
  const { server, opts } = createPicks();
  const port = +process.env.PICKS_PORT || 8871;
  server.listen(port, '127.0.0.1', () => console.log(`${VERSION} on 127.0.0.1:${port}; origin ${opts.origin || '(none: POST refused)'}; file ${opts.file}; ${opts.readonly ? 'READ ONLY' : 'accepting'}`));
}
