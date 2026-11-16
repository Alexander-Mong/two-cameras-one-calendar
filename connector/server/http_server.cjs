#!/usr/bin/env node
// http_server.cjs: the fire record's Model Context Protocol server over Streamable HTTP (the hosted front end). Same tools as server.cjs
// (both use protocol.cjs). Stateless: no sessions, no event stream; POST /mcp takes one JSON-RPC message or a batch and answers application/json.
// Read-only, and built to sit behind a reverse proxy: binds 127.0.0.1 by default, caps the body, limits each address's request rate,
// times out slow requests, checks Host and Origin (DNS-rebinding guard), never puts a stack trace or a path in a response.
//   Usage: node server/http_server.cjs   (settings below, from the environment)
'use strict';
const http = require('http'), path = require('path'), fs = require('fs');
const P = require('./protocol.cjs');

const env = process.env;
const HOST = env.HOST || '127.0.0.1';
const PORT = env.PORT === undefined ? 8797 : +env.PORT;
const BASE = (env.BASE_PATH || '').replace(/\/+$/, '');            // e.g. "/spaceapps-connector" when a proxy forwards that path unchanged
const MAX_BODY = +(env.MAX_BODY || 65536);                            // bytes
const RATE = +(env.RATE_PER_MIN || 60);                               // requests per minute per address (POST /mcp)
const TRUST_PROXY = env.TRUST_PROXY === '1';                          // take the address from X-Forwarded-For (only behind your own proxy)
const TOOL_TIMEOUT = +(env.TOOL_TIMEOUT_MS || 28000);   // NASA's per-file timeout is 25 s; Caddy's response_header_timeout is 30 s
const list = (s) => String(s || '').split(',').map(x => x.trim()).filter(Boolean);
// Origins a browser-based chat client may call from: server/allowed_origins.json (the one file with web addresses in it) plus ALLOWED_ORIGINS.
// Requests with no Origin (servers, command-line tools, desktop apps) are allowed; so are local addresses on any port.
const ORIGINS = JSON.parse(fs.readFileSync(path.join(__dirname, 'allowed_origins.json'), 'utf8')).origins.concat(list(env.ALLOWED_ORIGINS));
// Host names this server answers to (the DNS-rebinding guard). Local names always; add the public name in ALLOWED_HOSTS when proxied.
const HOSTS = ['localhost', '127.0.0.1', '[::1]'].concat(list(env.ALLOWED_HOSTS));

const PAGE = '<!doctype html><html lang="en"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fire record connector</title>' +
  '<style>body{font:16px/1.5 system-ui,sans-serif;max-width:40em;margin:3em auto;padding:0 1em;color:#222;background:#fff}code{background:#f2f2f2;padding:0 .2em}</style></head><body>' +
  '<h1>Fire record connector</h1><p>This address is a chat connector (Model Context Protocol) that lets an AI chat app answer "Is this place burning more than usual?" from NASA\'s FIRMS satellite fire detections, MODIS and VIIRS put on one scale. ' +
  'Add <code>' + '{{MCP}}' + '</code> as a connector in your chat app; there is nothing to read here.</p>' +
  '<p>A prototype built at NASA Space Apps 2026. It counts satellite detections, not individual fires or land burned; it does not forecast and gives no safety advice.</p></body></html>';

// ---------- small helpers ----------
const hostName = (h) => String(h || '').toLowerCase().replace(/:\d+$/, '');
function hostOk(req) { return env.ALLOWED_HOSTS === '*' || HOSTS.indexOf(hostName(req.headers.host)) >= 0; }
function originOk(o) {
  if (!o) return true;
  if (ORIGINS.indexOf('*') >= 0 || ORIGINS.indexOf(o) >= 0) return true;
  const m = /^(\w+):\/\/(localhost|127\.0\.0\.1|\[::1\])(:\d+)?$/.exec(o);
  return !!m && (m[1] === 'http' || m[1] === 'https');
}
function clientAddr(req) {
  if (TRUST_PROXY && req.headers['x-forwarded-for']) { const parts = String(req.headers['x-forwarded-for']).split(',').map(s => s.trim()).filter(Boolean); if (parts.length) return parts[parts.length - 1]; }
  return req.socket.remoteAddress || 'unknown';
}
const buckets = new Map();
function rateOk(addr) {
  const now = Date.now(), b = buckets.get(addr);
  if (!b || now - b.start >= 60000) { buckets.set(addr, { start: now, n: 1 }); return { ok: true }; }
  b.n++;
  return b.n <= RATE ? { ok: true } : { ok: false, retry: Math.ceil((b.start + 60000 - now) / 1000) };
}
setInterval(() => { const now = Date.now(); for (const [k, b] of buckets) if (now - b.start >= 60000) buckets.delete(k); }, 60000).unref();

function cors(req, res) {
  const o = req.headers.origin;
  if (o && originOk(o)) {
    res.setHeader('Access-Control-Allow-Origin', o); res.setHeader('Vary', 'Origin');
    res.setHeader('Access-Control-Allow-Methods', 'POST, GET, OPTIONS');
    res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Accept, Authorization, Mcp-Protocol-Version, Mcp-Session-Id, Last-Event-ID');
    res.setHeader('Access-Control-Expose-Headers', 'Mcp-Protocol-Version');
    res.setHeader('Access-Control-Max-Age', '600');
  }
}
function send(res, status, body, type, extra) {
  if (res.headersSent) return;
  const data = body === null || body === undefined ? '' : typeof body === 'string' ? body : JSON.stringify(body);
  res.writeHead(status, Object.assign({ 'Content-Type': type || 'application/json; charset=utf-8', 'Content-Length': Buffer.byteLength(data), 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff',
    'Referrer-Policy': 'no-referrer' }, extra || {}));
  res.end(data);
}
const rpcFail = (res, status, code, message, extra) => send(res, status, P.err(null, code, message), null, extra);

function readBody(req) {
  return new Promise((resolve, reject) => {
    const len = +req.headers['content-length'];
    if (len > MAX_BODY) { reject(Object.assign(new Error('too large'), { status: 413 })); return; }
    const chunks = []; let n = 0, done = false;
    req.on('data', (c) => { if (done) return; n += c.length; if (n > MAX_BODY) { done = true; reject(Object.assign(new Error('too large'), { status: 413 })); req.resume(); return; } chunks.push(c); });
    req.on('end', () => { if (!done) { done = true; resolve(Buffer.concat(chunks).toString('utf8')); } });
    req.on('error', (e) => { if (!done) { done = true; reject(e); } });
  });
}
function withTimeout(p, ms) { let t; return Promise.race([p, new Promise((_, rej) => { t = setTimeout(() => rej(Object.assign(new Error('timeout'), { status: 503 })), ms); })]).finally(() => clearTimeout(t)); }

// ---------- the one handler ----------
async function route(req, res) {
  let p = String(req.url || '/').split('?')[0].split('#')[0];
  if (BASE) { if (p === BASE) p = '/'; else if (p.startsWith(BASE + '/')) p = p.slice(BASE.length); else return send(res, 404, { error: 'not found' }); }
  if (!hostOk(req)) return send(res, 403, { error: 'This host name is not served here.' });
  const origin = req.headers.origin;
  if (origin && !originOk(origin)) return send(res, 403, { error: 'This origin may not call this connector.' });
  cors(req, res);
  if (req.method === 'OPTIONS') return send(res, 204, null, 'text/plain');

  if (p === '/' && (req.method === 'GET' || req.method === 'HEAD')) return send(res, 200, PAGE.replace('{{MCP}}', '&lt;this address&gt;' + (BASE || '') + '/mcp'), 'text/html; charset=utf-8');
  if (p === '/health' && (req.method === 'GET' || req.method === 'HEAD')) return send(res, 200, { ok: true, name: P.NAME, version: P.VERSION, tools: P.TOOLS.length });
  if (p !== '/mcp') return send(res, 404, { error: 'not found' });
  if (req.method !== 'POST') return send(res, 405, { error: 'Use POST with a JSON-RPC message. This server keeps no event stream and no sessions.' }, null, { Allow: 'POST, OPTIONS' });

  const rl = rateOk(clientAddr(req));
  if (!rl.ok) return rpcFail(res, 429, -32000, 'Too many requests from this address; try again in ' + rl.retry + ' seconds.', { 'Retry-After': String(rl.retry) });
  const ct = String(req.headers['content-type'] || '').toLowerCase();
  if (!/^application\/json\b/.test(ct)) return rpcFail(res, 415, -32600, 'Send the JSON-RPC message with Content-Type: application/json.');
  const pv = req.headers['mcp-protocol-version'];
  if (pv && P.SUPPORTED.indexOf(pv) < 0) return rpcFail(res, 400, -32600, 'Unsupported MCP-Protocol-Version: this server speaks ' + P.SUPPORTED.join(', ') + '.');
  let raw;
  try { raw = await readBody(req); } catch (e) { return e.status === 413 ? rpcFail(res, 413, -32600, 'The request is too large (limit ' + MAX_BODY + ' bytes).') : rpcFail(res, 400, -32600, 'The request could not be read.'); }
  let msg;
  try { msg = JSON.parse(raw); } catch (e) { return rpcFail(res, 400, -32700, 'Parse error'); }
  // stateless: the session's negotiated version arrives in the MCP-Protocol-Version header (unknown when absent: no batches then)
  const ctx = { version: pv || null };
  let out;
  try { out = await withTimeout(P.respond(msg, ctx), TOOL_TIMEOUT); }
  catch (e) { return rpcFail(res, 503, -32603, 'The answer took too long; try again.'); }
  if (out === null) return send(res, 202, null, 'text/plain');       // only notifications or responses: accepted, nothing to say
  const negotiated = !Array.isArray(out) && out.result && out.result.protocolVersion ? out.result.protocolVersion : null;
  return send(res, 200, out, null, negotiated ? { 'Mcp-Protocol-Version': negotiated } : null);
}

const server = http.createServer((req, res) => {
  const t0 = Date.now();
  res.on('finish', () => P.log(req.method + ' ' + String(req.url).split('?')[0].slice(0, 80) + ' ' + res.statusCode + ' ' + (Date.now() - t0) + 'ms'));
  route(req, res).catch((e) => { P.log('unhandled:', e); send(res, 500, { error: 'Something went wrong.' }); });
});
server.requestTimeout = 15000;     // whole request
server.headersTimeout = 10000;     // headers must arrive within this
server.keepAliveTimeout = 5000;
server.maxConnections = 200;
server.maxHeadersCount = 50;
server.listen(PORT, HOST, () => { const a = server.address(); P.log('listening on ' + (a.family === 'IPv6' ? '[' + a.address + ']' : a.address) + ':' + a.port + (BASE || '') + '/mcp'); });
function stop() { server.close(() => process.exit(0)); setTimeout(() => process.exit(0), 3000).unref(); }
process.on('SIGTERM', stop); process.on('SIGINT', stop);
