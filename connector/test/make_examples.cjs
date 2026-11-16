// make_examples.cjs: runs three real exchanges against the server over stdio and writes them, request and response, to ../EXAMPLES.md.
//   Usage: node test/make_examples.cjs
'use strict';
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const EX = [
  { title: 'Argentina right now (NASA\'s last 24 hours with the 26-year record\'s answer)', ask: '"Is Argentina burning right now?"', name: 'fire_now', arguments: { place: 'Argentina' } },
  { title: 'Australia, December 2019 (a strong result, said as strong)', ask: '"How bad were the fires in Australia in December 2019?"', name: 'fire_answer', arguments: { place: 'Australia', period: 'December 2019' } },
  { title: 'Argentina, next season (the future: nothing is certain, here are the patterns to watch)', ask: '"Will Argentina have a bad fire season next year?"', name: 'fire_answer', arguments: { place: 'Argentina', period: 'next season' } }
];
// NASA's part comes from its files as saved on Nov 14 at 16:20 UTC (test/fixtures_nasa), so the examples are the same on every run and use no network
const child = spawn(process.execPath, [path.join(ROOT, 'server', 'server.cjs')], { env: Object.assign({}, process.env, { FIRE_CONNECTOR_NASA_FIXTURES: path.join(__dirname, 'fixtures_nasa'), FIRE_CONNECTOR_NOW: '2026-11-14T16:21:00Z' }), stdio: ['pipe', 'pipe', 'ignore'] });
let buf = ''; child.stdout.setEncoding('utf8'); child.stdout.on('data', d => { buf += d; });
const reqs = [{ jsonrpc: '2.0', id: 0, method: 'initialize', params: { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'make_examples', version: '1' } } }, { jsonrpc: '2.0', method: 'notifications/initialized' }]
  .concat(EX.map((e, i) => ({ jsonrpc: '2.0', id: i + 1, method: 'tools/call', params: { name: e.name, arguments: e.arguments } })));
for (const q of reqs) child.stdin.write(JSON.stringify(q) + '\n');
child.stdin.end();
child.on('close', () => {
  const byId = {}; for (const l of buf.trim().split('\n')) { const m = JSON.parse(l); byId[m.id] = m; }
  const md = ['# Three example exchanges', '', ' Made by `node test/make_examples.cjs` on ' + new Date().toString() + ', from the server talking over stdio (the same messages a chat app sends). In exchange 1, NASA\'s last-24-hours count comes from NASA\'s files as saved on Nov 14 at 16:20 UTC and trimmed to a few hundred rows (`test/fixtures_nasa`), so it is smaller than the live count. The text under "What the chat model reads" is the response\'s text part; the JSON under it is the whole response, structured numbers included.', ''];
  EX.forEach((e, i) => {
    const m = byId[i + 1];
    md.push('## ' + (i + 1) + '. ' + e.title, '', 'A person might type: ' + e.ask + ' The chat model then calls:', '', '```json', JSON.stringify(reqs[i + 2], null, 2), '```', '',
      'What the chat model reads:', '', '```text', m.result.content[0].text, '```', '', 'The full response:', '', '```json', JSON.stringify(m, null, 2), '```', '');
  });
  fs.writeFileSync(path.join(ROOT, 'EXAMPLES.md'), md.join('\n'), 'utf8');
  console.log('wrote EXAMPLES.md (' + EX.length + ' exchanges)');
});
