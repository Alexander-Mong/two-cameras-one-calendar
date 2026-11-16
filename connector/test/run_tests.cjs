// run_tests.cjs: starts the MCP server (server/server.cjs) as a child process, speaks the protocol to it over stdio, and runs every check in
// checks.cjs (all six tools for Argentina, Ghana, Greece and an unknown place, plus the hard cases) against values read directly from the
// vendored engine and Readings. Prints PASS or FAIL and writes the same lines to TEST_OUTPUT.txt.
//   Usage: node test/run_tests.cjs   (Node 20 or newer, no packages)
'use strict';
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
const { runChecks } = require('./checks.cjs');
const ROOT = path.resolve(__dirname, '..');
const out = [], results = [];
function line(s) { out.push(s); console.log(s); }
function check(name, ok, got) { results.push(!!ok); line((ok ? 'PASS ' : 'FAIL ') + name + (got !== undefined ? '  | got: ' + (typeof got === 'string' ? got : JSON.stringify(got)) : '')); }

const NASA_ENV = { FIRE_CONNECTOR_NASA_FIXTURES: path.join(__dirname, 'fixtures_nasa'), FIRE_CONNECTOR_NOW: '2026-11-14T16:21:00Z' };   // NASA's saved files, a fixed clock: no network
function startServer(envExtra) {
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'server.cjs')], { env: Object.assign({}, process.env, NASA_ENV, envExtra || {}), stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = '', nextId = 1, stderr = ''; const stray = [], nonJson = [], waiting = new Map();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (!l.trim()) continue;
    let m; try { m = JSON.parse(l); } catch (e) { nonJson.push(l); continue; }
    const w = (typeof m.id === 'string' || typeof m.id === 'number') ? waiting.get(m.id) : null; if (w) { waiting.delete(m.id); w(m); } else stray.push(m); } });
  child.stderr.setEncoding('utf8'); child.stderr.on('data', (d) => { stderr += d; });
  const write = (obj) => child.stdin.write(JSON.stringify(obj) + '\n');
  // a raw message: resolves with the next unclaimed reply, or null when none comes within 800 ms (a notification gets none)
  const raw = (obj) => new Promise((res) => { const before = stray.length; write(obj); const t0 = Date.now();
    const iv = setInterval(() => { if (stray.length > before) { clearInterval(iv); res(stray.splice(before, 1)[0]); } else if (Date.now() - t0 > 800) { clearInterval(iv); res(null); } }, 10); });
  const request = (method, params) => new Promise((res, rej) => { const id = nextId++; const t = setTimeout(() => rej(new Error('timeout on ' + method)), 30000);
    waiting.set(id, (m) => { clearTimeout(t); res(m); }); write({ jsonrpc: '2.0', id, method, params }); });
  return { child, request, notify: async (method, params) => write({ jsonrpc: '2.0', method, params }), stray: () => stray, nonJson: () => nonJson, stderr: () => stderr, raw, write, waiting };
}

(async () => {
  line('MCP server tests over stdio, ' + new Date().toString());
  line('Server: server/server.cjs. Expected values: vendor/ engine and readings, read directly by the checks. Vendored copy: ' + ((fs.existsSync(path.join(ROOT, 'vendor', 'COPIED.txt')) ? fs.readFileSync(path.join(ROOT, 'vendor', 'COPIED.txt'), 'utf8').split('\n')[0] : 'no COPIED.txt')));
  line('');
  const S = startServer();
  await runChecks(S, line, check);
  // stdio-only: bad JSON on a line gets a parse error; nothing but protocol on stdout
  line(''); line('== stdio only');
  const sendText = (text) => new Promise((res) => { const before = S.stray().length; S.child.stdin.write(text); const t0 = Date.now();
    const iv = setInterval(() => { if (S.stray().length > before) { clearInterval(iv); res(S.stray().splice(before, 1)[0]); } else if (Date.now() - t0 > 3000) { clearInterval(iv); res(null); } }, 10); });
  const parsed = await sendText('{not json\n');
  check('a line that is not JSON: JSON-RPC parse error -32700, server keeps running', !!(parsed && parsed.error && parsed.error.code === -32700 && (await S.request('ping', {})).result), parsed && parsed.error);
  // review (3): a line over the size limit is refused before parsing, and the server goes on
  const huge = await sendText('{"jsonrpc":"2.0","id":9,"method":"ping","params":{"pad":"' + 'x'.repeat(2 * 1024 * 1024) + '"}}\n');
  check('a 2 MB line: refused before parsing (-32600, too large), and the next request is answered', !!(huge && huge.error && huge.error.code === -32600 && /too large/.test(huge.error.message) && (await S.request('ping', {})).result), huge && huge.error);
  // review (3): work in flight is bounded: 60 tool calls at once, a few answered "busy", every one answered, the server alive after
  const many = await Promise.all(Array.from({ length: 60 }, () => S.request('tools/call', { name: 'place_record', arguments: { place: 'Brazil', view: 'months', year: 2020 } })));
  const busy = many.filter(m => m.error && m.error.code === -32000).length, okN = many.filter(m => m.result && !m.result.isError).length;
  check('60 tool calls at once: every one answered (' + okN + ' answers, ' + busy + ' "busy"), none lost, server alive after', okN + busy === 60 && busy > 0 && okN >= 4 && !!(await S.request('ping', {})).result, okN + ' / ' + busy);
  // fire_now when NASA can't be reached: says so flatly, and the record's answer still comes
  const S2 = startServer({ FIRE_CONNECTOR_NASA_FIXTURES: path.join(__dirname, 'no_such_folder') });
  await S2.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 't', version: '1' } });
  const down = await S2.request('tools/call', { name: 'fire_now', arguments: { place: 'Argentina' } }), downT = down.result && down.result.content[0].text;
  check('fire_now with NASA unreachable: "We don\'t know what\'s burning in Argentina this hour", then the record\'s answer, not an error', !!(down.result && !down.result.isError && /^We don't know what's burning in Argentina this hour/.test(downT) && /On the 26-year record, Argentina's early November is about normal/.test(downT) && !/no_such_folder|ENOENT/.test(downT)), downT && downT.split('\n')[0]);
  S2.child.stdin.end();
  // review (6): an internal error never reaches the client, and the operator's log carries no machine path
  const P = require(path.join(ROOT, 'server', 'protocol.cjs'));
  const realAnswer = P.fire.answer;
  P.fire.answer = async () => { throw new Error('ENOENT: no such file, open \'' + path.join(ROOT, 'vendor', 'secret.json') + '\''); };
  const origWrite = process.stderr.write.bind(process.stderr); let logged = '';
  process.stderr.write = (x) => { logged += x; return true; };
  const ie = await P.respond({ jsonrpc: '2.0', id: 1, method: 'tools/call', params: { name: 'fire_answer', arguments: { place: 'Argentina' } } }, {});
  process.stderr.write = origWrite; P.fire.answer = realAnswer;
  const ieText = ie.result && ie.result.content[0].text;
  check('an internal error: the client gets a plain sentence, never the error\'s message or a path', !!(ie.result && ie.result.isError && !/ENOENT|secret|vendor|[A-Za-z]:\\/.test(ieText)), ieText);
  check('the operator\'s log names the error but not this machine\'s folder (written as <connector>)', /ENOENT/.test(logged) && logged.indexOf(ROOT) < 0 && /<connector>/.test(logged), logged.trim().slice(0, 120));
  check('the server\'s own stderr carries no machine path', S.stderr().indexOf(ROOT) < 0 && !/[A-Za-z]:\\/.test(S.stderr()), S.stderr().trim().split('\n')[0]);
  check('server wrote nothing but protocol messages on stdout, and no reply went unclaimed', S.nonJson().length === 0 && S.stray().length === 0, S.nonJson().concat(S.stray()).slice(0, 2));
  S.child.stdin.end();
  await new Promise(res => S.child.on('close', res));
  const pass = results.filter(Boolean).length, fail = results.length - pass;
  line(''); line('TOTAL: ' + pass + ' PASS, ' + fail + ' FAIL');
  fs.writeFileSync(path.join(__dirname, 'TEST_OUTPUT.txt'), out.join('\n') + '\n', 'utf8');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { line('FAIL the test run itself: ' + (e && e.stack || e)); fs.writeFileSync(path.join(__dirname, 'TEST_OUTPUT.txt'), out.join('\n') + '\n', 'utf8'); process.exitCode = 1; });
