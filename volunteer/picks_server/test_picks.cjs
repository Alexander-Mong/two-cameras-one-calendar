/* Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md. */
//
// Tests for server.cjs. Node only. usage: node picks_server/test_picks.cjs
'use strict';
const fs = require('fs'); const path = require('path'); const os = require('os'); const http = require('http');
const { createPicks } = require('./server.cjs');
const PLACES = path.join(__dirname, '..', 'site', 'data', 'places.json');
const ids = JSON.parse(fs.readFileSync(PLACES, 'utf8')).places.map(p => p.id);
const ORIGIN = 'http://127.0.0.1:8870';
const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'picks-test-'));
let pass = 0, fail = 0;
const ok = (cond, name) => { if (cond) { pass++; console.log('ok  ', name); } else { fail++; console.log('FAIL', name); } };

async function start(opt) {
  const file = path.join(tmp, (opt.name || 'p') + '.jsonl');
  const { server } = createPicks({ file, places: PLACES, origin: ORIGIN, ...opt });
  await new Promise(r => server.listen(0, '127.0.0.1', r));
  const base = 'http://127.0.0.1:' + server.address().port;
  return { server, file, base };
}
// raw request so we control headers and bodies exactly
function req(base, method, p, body, headers = {}) {
  return new Promise((res) => {
    const u = new URL(base + p);
    const r = http.request({ hostname: u.hostname, port: u.port, path: u.pathname + u.search, method, headers: { Origin: ORIGIN, ...headers } }, resp => {
      const parts = []; resp.on('data', c => parts.push(c)); resp.on('end', () => res({ status: resp.statusCode, headers: resp.headers, text: Buffer.concat(parts).toString() }));
    });
    r.on('error', e => res({ status: 0, text: String(e) }));
    if (body !== undefined) r.write(typeof body === 'string' ? body : JSON.stringify(body));
    r.end();
  });
}
const pick = (base, b, h) => req(base, 'POST', '/pick', b, { 'Content-Type': 'application/json', ...h });

(async () => {
  // ---- good picks, tally, one per place per visit
  let s = await start({ name: 'main' });
  let r = await pick(s.base, { place: ids[0], pick: 'fire', session: 'abc123' });
  ok(r.status === 200 && JSON.parse(r.text).kept === true, 'good pick lands');
  ok(r.headers['access-control-allow-origin'] === ORIGIN, 'allowed origin gets CORS header');
  ok(!r.headers['set-cookie'], 'no cookies');
  r = await pick(s.base, { place: ids[0], pick: 'volcano', session: 'abc123' });
  ok(r.status === 200 && JSON.parse(r.text).kept === false, 'second pick for the same place in a visit is ignored');
  await pick(s.base, { place: ids[0], pick: 'industry', session: 'zzz9' });
  await pick(s.base, { place: ids[1], pick: 'canttell', session: 'zzz9' });
  r = await req(s.base, 'GET', '/tally');
  let t = JSON.parse(r.text);
  ok(t.total === 3 && t.places[ids[0]].fire === 1 && t.places[ids[0]].industry === 1 && !t.places[ids[0]].volcano && t.places[ids[1]].canttell === 1, 'tally adds up');
  r = await req(s.base, 'GET', '/tally?place=' + ids[0]);
  t = JSON.parse(r.text);
  ok(t.place === ids[0] && t.counts.fire === 1 && t.counts.industry === 1, 'one-place tally is live');
  r = await req(s.base, 'GET', '/tally?place=%3Cb%3E');
  ok(r.status === 400 && !r.text.includes('<'), 'one-place tally refuses an unknown place without echoing it');
  r = await req(s.base, 'GET', '/health');
  t = JSON.parse(r.text);
  ok(t.ok === true && t.picks === 3 && t.accepting === true && typeof t.version === 'string', 'health answers');

  // ---- each kind of bad input is refused
  const bad = [
    ['unknown place', { place: 'P999', pick: 'fire', session: 'a1' }, 400],
    ['unknown pick', { place: ids[2], pick: 'flare', session: 'a1' }, 400],
    ['session with symbols', { place: ids[2], pick: 'fire', session: 'a-1' }, 400],
    ['session too long', { place: ids[2], pick: 'fire', session: 'a'.repeat(25) }, 400],
    ['empty session', { place: ids[2], pick: 'fire', session: '' }, 400],
    ['extra field', { place: ids[2], pick: 'fire', session: 'a1', name: 'x' }, 400],
    ['missing field', { place: ids[2], pick: 'fire' }, 400],
    ['number for place', { place: 5, pick: 'fire', session: 'a1' }, 400],
    ['array body', [1, 2], 400],
    ['not json', 'place=P01&pick=fire', 400],
    ['html in pick', { place: ids[2], pick: '<b>fire</b>', session: 'a1' }, 400],
  ];
  for (const [name, body, code] of bad) { r = await pick(s.base, body); ok(r.status === code && !/</.test(r.text) && r.headers['content-type'].startsWith('text/plain'), 'refused: ' + name + ' -> ' + r.status + ' "' + r.text + '"'); }
  r = await pick(s.base, JSON.stringify({ place: ids[2], pick: 'fire', session: 'a'.repeat(400) }));
  ok(r.status === 413 || r.status === 0, 'refused: body over 300 bytes');
  r = await pick(s.base, { place: ids[2], pick: 'fire', session: 'a1' }, { Origin: 'https://evil.example' });
  ok(r.status === 403 && !r.headers['access-control-allow-origin'], 'refused: other origin');
  r = await req(s.base, 'POST', '/pick', { place: ids[2], pick: 'fire', session: 'a1' }, { Origin: '' });
  ok(r.status === 403, 'refused: no origin');
  r = await req(s.base, 'OPTIONS', '/pick', undefined, { 'Access-Control-Request-Method': 'POST' });
  ok(r.status === 204 && r.headers['access-control-allow-origin'] === ORIGIN, 'preflight from the allowed origin');
  r = await req(s.base, 'GET', '/pick');
  ok(r.status === 404, 'wrong method -> 404');
  r = await req(s.base, 'GET', '/<script>');
  ok(r.status === 404 && !r.text.includes('<'), 'unknown path does not echo input');
  s.server.close();

  // ---- restart: state comes back from the file
  s = await start({ name: 'main' });
  t = JSON.parse((await req(s.base, 'GET', '/health')).text);
  ok(t.picks === 3, 'restart rebuilds counts from the file');
  r = await pick(s.base, { place: ids[0], pick: 'fire', session: 'abc123' });
  ok(JSON.parse(r.text).kept === false, 'restart remembers one pick per place per visit');
  s.server.close();

  // ---- the per-device limit
  s = await start({ name: 'rate', rate: 5 });
  const codes = [];
  for (let i = 0; i < 7; i++) codes.push((await pick(s.base, { place: ids[i], pick: 'fire', session: 'r1' }, { 'X-Real-IP': '10.0.0.1' })).status);
  ok(codes.slice(0, 5).every(c => c === 200) && codes.slice(5).every(c => c === 429), 'limit works per device: ' + codes.join(','));
  r = await pick(s.base, { place: ids[0], pick: 'fire', session: 'r2' }, { 'X-Real-IP': '10.0.0.2' });
  ok(r.status === 200, 'another device is not limited');
  ok(!fs.readFileSync(s.file, 'utf8').includes('10.0.0'), 'device address never written');
  s.server.close();

  // ---- the size cap
  s = await start({ name: 'cap', maxBytes: 400 });
  const cc = [];
  for (let i = 0; i < 10; i++) cc.push((await pick(s.base, { place: ids[i], pick: 'industry', session: 'c1' })).status);
  const size = fs.statSync(s.file).size;
  t = JSON.parse((await req(s.base, 'GET', '/health')).text);
  ok(cc.includes(507) && size <= 400 && t.accepting === false, `cap works: ${cc.join(',')}, file ${size} bytes, accepting=${t.accepting}`);
  s.server.close();

  // ---- read-only switch
  s = await start({ name: 'ro', readonly: true });
  r = await pick(s.base, { place: ids[0], pick: 'fire', session: 'q1' });
  t = JSON.parse((await req(s.base, 'GET', '/health')).text);
  ok(r.status === 503 && t.accepting === false && !fs.existsSync(s.file), 'read-only takes nothing');
  s.server.close();

  // ---- a thousand picks in a row
  s = await start({ name: 'many', rate: 100000 });
  const t0 = Date.now(); let good = 0;
  for (let i = 0; i < 1000; i++) {
    const res = await pick(s.base, { place: ids[i % ids.length], pick: ['fire', 'industry', 'volcano', 'something', 'canttell'][i % 5], session: 's' + Math.floor(i / ids.length) });
    if (res.status === 200 && JSON.parse(res.text).kept) good++;
  }
  t = JSON.parse((await req(s.base, 'GET', '/tally')).text);
  let sum = 0; for (const c of Object.values(t.places)) for (const v of Object.values(c)) sum += v;
  ok(good === 1000 && t.total === 1000 && sum === 1000, `1000 picks kept and tallied (${Date.now() - t0} ms)`);
  t = JSON.parse((await req(s.base, 'GET', '/health')).text);
  ok(t.ok, 'still healthy after 1000');
  s.server.close();

  // ---- the files hold nothing but the four fields
  let lines = 0, clean = true;
  for (const f of fs.readdirSync(tmp)) {
    for (const line of fs.readFileSync(path.join(tmp, f), 'utf8').split('\n')) {
      if (!line) continue; lines++;
      const o = JSON.parse(line);
      if (Object.keys(o).join(',') !== 'place,pick,t,session' || !/^\d{4}-\d\d-\d\dT\d\d:\d\dZ$/.test(o.t)) clean = false;
    }
  }
  ok(clean && lines > 1000, `every saved line is exactly place, pick, t (to the minute), session (${lines} lines)`);
  fs.rmSync(tmp, { recursive: true, force: true });
  console.log(`\n${pass} passed, ${fail} failed`);
  process.exit(fail ? 1 : 0);
})();
