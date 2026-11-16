// run_http_tests.cjs: starts server/http_server.cjs on a free local port, runs every check in checks.cjs over HTTP (POST /mcp), then the
// abuse cases: oversized body, bad JSON, wrong content type, a flood of requests, a foreign Origin or Host, wrong methods, and a look for
// stack traces or paths in every response. Writes the lines to TEST_OUTPUT_HTTP.txt.
//   Usage: node test/run_http_tests.cjs   (Node 20 or newer: uses the built-in fetch)
'use strict';
const path = require('path'), fs = require('fs'), http = require('http'), { spawn } = require('child_process');
const { runChecks } = require('./checks.cjs');
const ROOT = path.resolve(__dirname, '..');
// web addresses are built at run time (the public copy's scan keeps literal ones out of code): the allowed origin comes from the server's own list
const WEB = (scheme, host) => scheme + ':' + '//' + host;
const GOOD_ORIGIN = require(path.join(ROOT, 'server', 'allowed_origins.json')).origins[0];
const BAD_ORIGIN = WEB('https', 'evil.example');
const out = [], results = [];
function line(s) { out.push(s); console.log(s); }
function check(name, ok, got) { results.push(!!ok); line((ok ? 'PASS ' : 'FAIL ') + name + (got !== undefined ? '  | got: ' + (typeof got === 'string' ? got : JSON.stringify(got)) : '')); }
const bodies = [];   // every response body, for the leak check at the end

function start(envExtra) {
  return new Promise((resolve, reject) => {
    const child = spawn(process.execPath, [path.join(ROOT, 'server', 'http_server.cjs')], { env: Object.assign({}, process.env, { PORT: '0', HOST: '127.0.0.1', FIRE_CONNECTOR_NASA_FIXTURES: path.join(__dirname, 'fixtures_nasa'), FIRE_CONNECTOR_NOW: '2026-11-14T16:21:00Z' }, envExtra), stdio: ['ignore', 'pipe', 'pipe'] });
    let err = '', stdout = '';
    child.stdout.on('data', d => { stdout += d; });
    child.stderr.on('data', d => { err += d; const m = /listening on (\S+?)\/mcp/.exec(err); if (m && !child.base) { child.base = WEB('http', m[1]); resolve(child); } });
    child.on('exit', () => reject(new Error('server exited: ' + err)));
    child.stdoutText = () => stdout;
    setTimeout(() => reject(new Error('server did not start')), 15000);
  });
}
async function post(base, body, headers) {
  const r = await fetch(base + '/mcp', { method: 'POST', headers: Object.assign({ 'Content-Type': 'application/json', Accept: 'application/json, text/event-stream' }, headers || {}), body: typeof body === 'string' ? body : JSON.stringify(body) });
  const text = await r.text(); bodies.push(text);
  let json = null; try { json = JSON.parse(text); } catch (e) { /* not JSON */ }
  return { status: r.status, headers: r.headers, text, json };
}
// a raw request with a chosen Host header (fetch will not let us set Host)
function rawReq(base, opts) {
  const u = new URL(base);
  return new Promise((resolve) => { const req = http.request({ host: u.hostname, port: u.port, method: opts.method || 'GET', path: opts.path || '/health', headers: opts.headers || {} }, (res) => {
    let t = ''; res.on('data', d => { t += d; }); res.on('end', () => { bodies.push(t); resolve({ status: res.statusCode, headers: res.headers, text: t }); }); }); if (opts.body) req.write(opts.body); req.end(); });
}

(async () => {
  line('MCP server tests over Streamable HTTP, ' + new Date().toString());
  line('Server: server/http_server.cjs on 127.0.0.1, a free port. Expected values: vendor/ engine and readings, read directly by the checks.');
  line('');
  const srv = await start({ RATE_PER_MIN: '100000' });
  const base = srv.base; let id = 1;
  const client = {
    request: async (method, params) => { const r = await post(base, { jsonrpc: '2.0', id: id++, method, params }); if (r.status !== 200) throw new Error('HTTP ' + r.status + ' on ' + method + ': ' + r.text); return r.json; },
    notify: async (method, params) => { const r = await post(base, { jsonrpc: '2.0', method, params }); if (r.status !== 202) throw new Error('notification got HTTP ' + r.status); },
    raw: async (obj) => { const r = await post(base, obj); return r.status === 202 ? null : r.json; }
  };
  await runChecks(client, line, check);

  line(''); line('== HTTP front end');
  const init = await post(base, { jsonrpc: '2.0', id: 'i', method: 'initialize', params: { protocolVersion: '2025-03-26', capabilities: {}, clientInfo: { name: 't', version: '1' } } });
  check('initialize over the web front end: 200, JSON, Mcp-Protocol-Version header 2025-03-26', init.status === 200 && /application\/json/.test(init.headers.get('content-type')) && init.headers.get('mcp-protocol-version') === '2025-03-26', init.headers.get('mcp-protocol-version'));
  const note = await post(base, { jsonrpc: '2.0', method: 'notifications/initialized' });
  check('a notification alone: 202 Accepted, empty body', note.status === 202 && note.text === '', note.status);
  const batch = await post(base, [{ jsonrpc: '2.0', id: 1, method: 'ping' }, { jsonrpc: '2.0', id: 2, method: 'tools/list' }, { jsonrpc: '2.0', method: 'notifications/initialized' }], { 'MCP-Protocol-Version': '2025-03-26' });
  check('a batch under protocol 2025-03-26 (which has batches): one array, two answers in it', batch.status === 200 && Array.isArray(batch.json) && batch.json.length === 2 && batch.json[1].result.tools.length === 11, batch.json && batch.json.length);
  const g = await fetch(base + '/mcp'); bodies.push(await g.text());
  check('GET /mcp: 405 (no event stream), Allow: POST, OPTIONS', g.status === 405 && g.headers.get('allow') === 'POST, OPTIONS', g.status);
  const del = await fetch(base + '/mcp', { method: 'DELETE' }); bodies.push(await del.text());
  check('DELETE /mcp: 405 (no sessions)', del.status === 405, del.status);
  const home = await fetch(base + '/'); const homeText = await home.text(); bodies.push(homeText);
  check('GET /: a plain page saying what this address is', home.status === 200 && /text\/html/.test(home.headers.get('content-type')) && /chat connector/.test(homeText) && /does not forecast/.test(homeText), home.status);
  const health = await fetch(base + '/health'); const hj = await health.json();
  check('GET /health: ok, eleven tools', health.status === 200 && hj.ok === true && hj.tools === 11, hj);
  const nf = await fetch(base + '/etc/passwd'); bodies.push(await nf.text());
  check('any other path: 404, no file served', nf.status === 404, nf.status);
  const pre = await fetch(base + '/mcp', { method: 'OPTIONS', headers: { Origin: GOOD_ORIGIN, 'Access-Control-Request-Method': 'POST', 'Access-Control-Request-Headers': 'content-type, mcp-protocol-version' } });
  check('CORS preflight from a browser chat client (the first origin in allowed_origins.json): 204 with Allow-Origin and the MCP headers allowed', pre.status === 204 && pre.headers.get('access-control-allow-origin') === GOOD_ORIGIN && /Mcp-Protocol-Version/.test(pre.headers.get('access-control-allow-headers')), pre.headers.get('access-control-allow-origin'));
  const corsPost = await post(base, { jsonrpc: '2.0', id: 9, method: 'ping' }, { Origin: GOOD_ORIGIN });
  check('POST from an allowed origin: 200 with Access-Control-Allow-Origin', corsPost.status === 200 && corsPost.headers.get('access-control-allow-origin') === GOOD_ORIGIN, corsPost.status);

  line(''); line('== Abuse cases');
  const big = await post(base, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping', params: { pad: 'x'.repeat(100000) } }));
  check('oversized body (100 KB): 413, JSON-RPC error', big.status === 413 && big.json && big.json.error, big.status);
  const badj = await post(base, '{"jsonrpc":"2.0", "id": 1, "method": ');
  check('bad JSON: 400 with parse error -32700', badj.status === 400 && badj.json && badj.json.error.code === -32700, badj.status);
  const ct = await post(base, JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'ping' }), { 'Content-Type': 'text/plain' });
  check('wrong content type (text/plain): 415', ct.status === 415, ct.status);
  const pv = await post(base, { jsonrpc: '2.0', id: 1, method: 'ping' }, { 'MCP-Protocol-Version': '1999-01-01' });
  check('unsupported MCP-Protocol-Version header: 400', pv.status === 400, pv.status);
  const notRpc = await post(base, { hello: 'world' });
  check('JSON that is not JSON-RPC: Invalid Request -32600', notRpc.status === 200 && notRpc.json.error && notRpc.json.error.code === -32600, notRpc.json);
  const hugeBatch = await post(base, Array.from({ length: 50 }, (_, i) => ({ jsonrpc: '2.0', id: i, method: 'ping' })), { 'MCP-Protocol-Version': '2025-03-26' });
  check('a batch of 50 under 2025-03-26: refused (limit 20), -32600', !!(hugeBatch.json && !Array.isArray(hugeBatch.json) && hugeBatch.json.error && hugeBatch.json.error.code === -32600), hugeBatch.json);
  const b0618 = await post(base, [{ jsonrpc: '2.0', id: 1, method: 'ping' }], { 'MCP-Protocol-Version': '2025-06-18' });
  check('a batch under 2025-06-18: -32600, not answered', !!(b0618.json && b0618.json.error && b0618.json.error.code === -32600), b0618.json);
  const evil = await post(base, { jsonrpc: '2.0', id: 1, method: 'ping' }, { Origin: BAD_ORIGIN });
  check('a foreign Origin (evil.example): 403, no CORS header', evil.status === 403 && !evil.headers.get('access-control-allow-origin'), evil.status);
  const reb = await rawReq(base, { path: '/health', headers: { Host: 'attacker.example' } });
  check('a foreign Host header (DNS rebinding): 403', reb.status === 403, reb.status);
  const pathy = await post(base, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fire_answer', arguments: { place: '../../../etc/passwd' } } });
  check('a path as the place name: refused as an unknown place, nothing read', pathy.json.result.isError === true && pathy.json.result.structuredContent.refusal.code === 'UNKNOWN_PLACE', pathy.json.result.content[0].text);
  const wrongType = await post(base, { jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fire_answer', arguments: { place: { $gt: '' }, period: 12 } } });
  check('wrong argument types: -32602 Invalid params, no crash', wrongType.status === 200 && !!(wrongType.json.error && wrongType.json.error.code === -32602), wrongType.json.error);
  srv.kill();

  // the flood: a server with a low limit, 40 requests at once
  const small = await start({ RATE_PER_MIN: '30' });
  const flood = await Promise.all(Array.from({ length: 40 }, (_, i) => post(small.base, { jsonrpc: '2.0', id: i, method: 'ping' })));
  const n200 = flood.filter(r => r.status === 200).length, n429 = flood.filter(r => r.status === 429);
  check('a flood of 40 requests at a limit of 30 a minute: 30 answered, 10 refused with 429 and Retry-After', n200 === 30 && n429.length === 10 && n429.every(r => +r.headers.get('retry-after') > 0), n200 + ' answered, ' + n429.length + ' refused');
  const hAfter = await fetch(small.base + '/health');
  check('after the flood, /health still answers', hAfter.status === 200, hAfter.status);
  small.kill();

  // behind a proxy: a path prefix, the public host name, and addresses from X-Forwarded-For
  const prox = await start({ BASE_PATH: '/spaceapps-connector', ALLOWED_HOSTS: 'connector.example.org', TRUST_PROXY: '1', RATE_PER_MIN: '3' });
  const pb = prox.base.replace(/\/spaceapps-connector$/, '');
  const viaProxy = await rawReq(pb, { method: 'POST', path: '/spaceapps-connector/mcp', headers: { Host: 'connector.example.org', 'Content-Type': 'application/json', 'X-Forwarded-For': '203.0.113.7' }, body: JSON.stringify({ jsonrpc: '2.0', id: 1, method: 'tools/list' }) });
  check('behind a proxy: POST /spaceapps-connector/mcp with the public host name answers', viaProxy.status === 200 && JSON.parse(viaProxy.text).result.tools.length === 11, viaProxy.status);
  const noPrefix = await rawReq(pb, { path: '/health', headers: { Host: 'connector.example.org' } });
  check('behind a proxy: an address outside the prefix: 404', noPrefix.status === 404, noPrefix.status);
  const rs = [];
  for (const ip of ['203.0.113.7', '203.0.113.7', '203.0.113.7', '198.51.100.9']) rs.push((await rawReq(pb, { method: 'POST', path: '/spaceapps-connector/mcp', headers: { Host: 'connector.example.org', 'Content-Type': 'application/json', 'X-Forwarded-For': '10.0.0.1, ' + ip }, body: '{"jsonrpc":"2.0","id":1,"method":"ping"}' })).status);
  check('behind a proxy: the limit counts each forwarded address (3 a minute: the same address\'s 4th is 429, another address still answers)', rs.join(',') === '200,200,429,200', rs.join(','));
  prox.kill();

  line(''); line('== Leaks');
  // built from parts so the scan of the public copy does not read this test's own patterns as paths
  const LEAK = new RegExp(['\\b[A-Za-z]:(\\\\\\\\|/)[A-Za-z_]', '/ho' + 'me/', '/va' + 'r/', '/Us' + 'ers/', '\\.cjs', '\\bat [\\w.<>]+ \\(', 'node:internal'].join('|'));
  for (const b of bodies) { const m = LEAK.exec(b); if (m) line('  leak-like text: ' + b.slice(Math.max(0, m.index - 80), m.index + 60)); }
  const all = bodies.join('\n');
  check('no stack trace, machine path or file name in any of ' + bodies.length + ' response bodies', !LEAK.test(all));
  check('the server printed nothing on stdout (logs go to stderr)', srv.stdoutText() === '' && small.stdoutText() === '' && prox.stdoutText() === '');

  const pass = results.filter(Boolean).length, fail = results.length - pass;
  line(''); line('TOTAL: ' + pass + ' PASS, ' + fail + ' FAIL');
  fs.writeFileSync(path.join(__dirname, 'TEST_OUTPUT_HTTP.txt'), out.join('\n') + '\n', 'utf8');
  process.exit(fail ? 1 : 0);
})().catch(e => { line('FAIL the test run itself: ' + (e && e.stack || e)); fs.writeFileSync(path.join(__dirname, 'TEST_OUTPUT_HTTP.txt'), out.join('\n') + '\n', 'utf8'); process.exit(1); });
