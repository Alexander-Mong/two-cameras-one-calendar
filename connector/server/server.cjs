#!/usr/bin/env node
// server.cjs: the fire record's Model Context Protocol server over stdio (the local front end). JSON-RPC 2.0, one message per line.
// Usage: node server.cjs   (a chat app starts it; it talks on stdin/stdout, logs on stderr)
'use strict';
const P = require('./protocol.cjs');

const MAX_LINE = 256 * 1024;   // bytes; a longer line is refused before it is parsed, and skipped up to its newline
const ctx = {};                 // this session: the protocol version once negotiated
function send(msg) { process.stdout.write(JSON.stringify(msg) + '\n'); }
async function onLine(line) {
  if (!line.trim()) return;
  let msg;
  try { msg = JSON.parse(line); } catch (e) { send(P.err(null, -32700, 'Parse error')); return; }
  const out = await P.respond(msg, ctx);
  if (out) send(out);
}

const pending = new Set();
function run(line) { const p = onLine(line).catch(() => {}); pending.add(p); p.finally(() => pending.delete(p)); }
let parts = [], size = 0, skipping = false;
process.stdin.on('data', (chunk) => {
  let start = 0, i;
  while ((i = chunk.indexOf(10, start)) >= 0) {
    const piece = chunk.subarray(start, i); start = i + 1;
    if (skipping) { skipping = false; parts = []; size = 0; continue; }
    if (size + piece.length > MAX_LINE) { parts = []; size = 0; send(P.err(null, -32600, 'Invalid Request: the message is too large (limit ' + MAX_LINE + ' bytes)')); continue; }
    parts.push(piece); const line = Buffer.concat(parts).toString('utf8'); parts = []; size = 0;
    run(line.replace(/\r$/, ''));
  }
  const rest = chunk.subarray(start);
  if (skipping) return;
  if (size + rest.length > MAX_LINE) { parts = []; size = 0; skipping = true; send(P.err(null, -32600, 'Invalid Request: the message is too large (limit ' + MAX_LINE + ' bytes)')); return; }
  if (rest.length) { parts.push(rest); size += rest.length; }
});
process.stdin.on('end', () => {
  if (!skipping && size) run(Buffer.concat(parts).toString('utf8'));
  setImmediate(() => Promise.allSettled([...pending]).then(() => process.exit(0)));
});
P.log('ready (stdio)');
