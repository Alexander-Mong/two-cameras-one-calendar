/* Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md. */
// protocol.cjs: the Model Context Protocol core shared by both front ends (server.cjs over stdio, http_server.cjs over Streamable HTTP):
// initialize, ping, tools/list, tools/call, the six record tools' descriptions (fire_now and the nasa_ tools come from now.cjs and nasa.cjs) and the instructions to the connected model. No outside packages.
//
'use strict';
const path = require('path');
const fire = require('./fire.cjs');
const nasa = require('./nasa.cjs');
const now = require('./now.cjs');
const viirs = require('./viirs.cjs');   // viirs_scale: the record on the newer camera's scale (the team lead: "Yes, build it")

const NAME = 'nasa-fire-record', VERSION = '0.3.9';   // build 3.9 (Nov 14, 2026; page word fixes synced; viirs_scale aligned with the page); the outside tests read this to know which build answered
const SUPPORTED = ['2025-06-18', '2025-03-26', '2024-11-05'];

const INSTRUCTIONS = 'These tools answer one question from NASA\'s FIRMS satellite fire data: is a place burning more than usual? ' +
  'Talk about fire plainly: "fire", "fires", "burning" and "active fire" are the right words (NASA calls these active fire detections, and a detection the satellite marks as vegetation fire with high confidence is a fire). Never refuse, hedge or lecture when someone calls it a fire or asks about fires. ' +
  'One fact about the NUMBERS, to say once and plainly when you give a count: a count is how many times and places satellites detected fire (each 5 km patch of ground, once per day; one large fire gives many detections, and small or cloud-covered fires can be missed), so it is not a count of separate fires and not an amount of land burned. ' +
  'Lead with the answer in words the tool gives (for example "About normal for early November"), then the comparison a person can feel ("about half the usual"), and keep counts small. ' +
  'From 2022 on there are two answers: our record (MODIS and VIIRS put on one scale, since 2000) and MODIS, NASA\'s older camera, counted on its own; when the tool gives both and they differ, pass both on, never just one. ' +
  'Where the tool says our record is unreliable for a country, go by MODIS as the tool does. When it says "early data", say so: those months can still change. ' +
  'When it gives no verdict (too little fire, too few years, no data), do not make one up. For a question about the future ("will it be a bad season?", "what about next year?"), call fire_answer with that period: it answers with one clause that nothing about it is certain, then the patterns to watch (when the season runs and peaks, how this year and the last season compare with usual, what the big years looked like). Pass that on; never give a number, a date or a verdict for the future yourself. ' +
  'For decisions on the ground, right now, send people to their local authorities and emergency services (NASA\'s own caution about these data, word for word, is in the nasa_ paragraph below). ' +
  'Say that only when the person asks what to do right now or where to go (then set acting_now to true and the tool adds one line); ordinary answers end on the answer and an offer of the next question. ' +
  'This is a prototype built at NASA Space Apps 2026; no outside expert in satellite fire data has reviewed it.';

// string limits are part of the advertised schema, and are checked BEFORE any lookup or suggestion work
const NOW_INSTRUCTIONS = 'For "is it burning right now?" or "what\'s happening with fire in X?", call fire_now: one answer with NASA\'s file labeled 24h (its observations can be older than 24 hours; the answer says how many came in the 24 hours before it was fetched) and the 26-year record\'s word on whether that is normal. ' +
  'Say the unit once in a conversation, the first time you give a number (each tool\'s structured result carries it as "unit"), not in every reply. ' +
  'When someone names a city, park or province, use its country and say so ("Córdoba is in Argentina; here\'s Argentina"). ' +
  'End on the next question the tool offers.';
const PLACE = { type: 'string', minLength: 1, maxLength: 80, description: 'A country or territory, by its everyday name ("Argentina", "Greece", "Ghana", "USA"). For a city, park or province, use its country and say so ("Córdoba is in Argentina; here\'s Argentina"). The find_places tool lists all 235.' };
const PERIOD = { type: 'string', maxLength: 40, description: 'Which dates: "latest" (default: the newest month, maybe unfinished), "this year" (the year so far, or the last full year), "last season" (the last finished fire season), a year "2020", a month "2020-09" or "September 2020", or "season 2020" (the fire season that starts in 2020).' };
const ACTING_NOW = { type: 'boolean', description: 'Set true only when the person is asking what to do right now or where to go; the answer then ends with one line pointing to local authorities. Leave it out otherwise.' };
const RO = { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false };   // the six record tools read local files only
const TOOLS = [
  { name: 'fire_answer', title: 'Is this place burning more than usual?',
    description: 'The answer for a place and period: the verdict in words (far quieter, quieter, about normal, busier, far busier than normal), a comparison with the usual for the same dates in other years, MODIS\'s own answer when it differs, an early-data note, and the numbers behind it. No verdict when there is too little fire to judge. A season also lists each of its months.',
    inputSchema: { type: 'object', properties: { place: PLACE, period: PERIOD, acting_now: ACTING_NOW }, required: ['place'], additionalProperties: false }, annotations: RO },
  { name: 'place_record', title: 'A place\'s record by year or by month',
    description: 'A place\'s fire record: view "years" gives every year since 2000 (detections per whole year, MODIS alone from 2022, what a plain unadjusted join of the two cameras would wrongly show, and which years burned most, when the gap is big enough to say); view "months" gives one year month by month with a verdict for each month.',
    inputSchema: { type: 'object', properties: { place: PLACE, view: { type: 'string', enum: ['years', 'months'], description: '"years" (default) or "months".' }, year: { type: 'integer', minimum: 1900, maximum: 2100, description: 'For view "months": which year (default: the newest year in the record).' } }, required: ['place'], additionalProperties: false }, annotations: RO },
  { name: 'how_sure', title: 'How far to trust our record in a place',
    description: 'How far our record (MODIS and VIIRS on one scale) can be trusted in this place: how far it missed MODIS\'s own count in past tests, and whether answers there lead with our record or with MODIS alone.',
    inputSchema: { type: 'object', properties: { place: PLACE }, required: ['place'], additionalProperties: false }, annotations: RO },
  { name: 'report_sentence', title: 'A sentence a report could carry',
    description: 'A sentence for a report or article about a place and period: a short form in plain words, and a full form with the numbers, both cameras and how sure we are.',
    inputSchema: { type: 'object', properties: { place: PLACE, period: PERIOD }, required: ['place'], additionalProperties: false }, annotations: RO },
  { name: 'find_places', title: 'Find places',
    description: 'Search the 235 countries and territories in the record by name (leave the query empty for all of them), with how far the record runs and how far to trust it there.',
    inputSchema: { type: 'object', properties: { query: { type: 'string', maxLength: 80, description: 'Part of a name, e.g. "guinea". Empty: list all.' }, limit: { type: 'integer', minimum: 1, maximum: 300, description: 'At most this many (default 25; up to 300).' } }, additionalProperties: false }, annotations: RO },
  { name: 'compare', title: 'Compare two places or two periods',
    description: 'Two answers side by side: two places for the same dates, or one place in two periods (e.g. September 2020 against September 2025). Each is judged against its own usual; counts are compared directly only for one place, like spans and reliable data.',
    inputSchema: { type: 'object', properties: {
      first: { type: 'object', properties: { place: PLACE, period: PERIOD }, required: ['place'], additionalProperties: false },
      second: { type: 'object', properties: { place: PLACE, period: PERIOD }, required: ['place'], additionalProperties: false }, acting_now: ACTING_NOW }, required: ['first', 'second'], additionalProperties: false }, annotations: RO }
];
// only declared tools are ever dispatched (a Map: no inherited names such as "constructor" or "toString")
const RECORD_TOOLS = TOOLS.slice();
const ALL_INSTRUCTIONS = INSTRUCTIONS + ' ' + NOW_INSTRUCTIONS + ' ' + viirs.INSTRUCTIONS + ' ' + nasa.INSTRUCTIONS;
// fire_now first: it is the answer to the most common question ("is it burning right now?"); then the record tools; then NASA's own
TOOLS.unshift(now.TOOL);
TOOLS.push(viirs.TOOL);   // after the record tools, before NASA's own
for (const t of nasa.TOOLS) TOOLS.push(t);
// fire_now and the nasa_ tools reach NASA's servers: read-only, but open-world (shallow copies; the imported objects stay untouched)
for (let i = 0; i < TOOLS.length; i++) if (!TOOLS[i].annotations) TOOLS[i] = Object.assign({}, TOOLS[i], { annotations: { readOnlyHint: true, destructiveHint: false, openWorldHint: true } });
const HANDLERS = new Map([
  ['fire_now', (a) => now.fireNow(a.place, a.acting_now)],
  ['viirs_scale', (a) => viirs.viirsScale(a.place, a.period)],
  ['fire_answer', (a) => fire.answer(a.place, a.period, a.acting_now)],
  ['place_record', (a) => fire.record(a.place, a.view, a.year)],
  ['how_sure', (a) => fire.trust(a.place)],
  ['report_sentence', (a) => fire.sentence(a.place, a.period)],
  ['find_places', (a) => fire.find(a.query, a.limit)],
  ['compare', (a) => fire.compare(a.first, a.second, a.acting_now)]
]);
const SCHEMAS = new Map(TOOLS.map(t => [t.name, t.inputSchema]));
const NASA = new Set(nasa.TOOL_NAMES);   // routed to nasa.call, which never throws and scrubs any key

// ---------- the operator's log: stderr only, with this installation's folder replaced by a token ----------
const HOME_DIR = path.resolve(__dirname, '..');
function clean(s) { return String(s).split(HOME_DIR).join('<connector>').split(HOME_DIR.replace(/\\/g, '/')).join('<connector>'); }
function log(...x) { process.stderr.write('[' + NAME + '] ' + clean(x.map(v => v && v.stack ? v.stack.split('\n').slice(0, 4).join(' | ') : String(v)).join(' ')) + '\n'); }
const ok = (id, result) => ({ jsonrpc: '2.0', id, result });
const err = (id, code, message, data) => ({ jsonrpc: '2.0', id: id === undefined ? null : id, error: data === undefined ? { code, message } : { code, message, data } });

// ---------- a small validator for the advertised schemas (the subset they use) ----------
const own = (o, k) => Object.prototype.hasOwnProperty.call(o, k);
function typeOk(v, t) {
  if (t === 'object') return v !== null && typeof v === 'object' && !Array.isArray(v);
  if (t === 'integer') return typeof v === 'number' && Number.isInteger(v);
  if (t === 'number') return typeof v === 'number' && isFinite(v);
  if (t === 'array') return Array.isArray(v);
  return typeof v === t;
}
function editDist(a, b) {
  const d = []; for (let j = 0; j <= b.length; j++) d.push(j);
  for (let i = 1; i <= a.length; i++) { let prev = d[0]; d[0] = i; for (let j = 1; j <= b.length; j++) { const t = d[j]; d[j] = Math.min(d[j] + 1, d[j - 1] + 1, prev + (a[i - 1] === b[j - 1] ? 0 : 1)); prev = t; } }
  return d[b.length];
}
function closest(k, known) { let best = null, bd = 3; for (const c of known) { const e = editDist(String(k).slice(0, 40).toLowerCase(), c.toLowerCase()); if (e < bd) { bd = e; best = c; } } return best; }
function validate(v, s, where) {
  if (s.type && !typeOk(v, s.type)) return where + ' must be ' + (s.type === 'integer' ? 'a whole number' : s.type === 'object' ? 'an object' : 'a ' + s.type);
  if (s.enum && s.enum.indexOf(v) < 0) return where + ' must be one of ' + s.enum.map(x => JSON.stringify(x)).join(', ');
  if (typeof v === 'string') { if (s.maxLength !== undefined && v.length > s.maxLength) return where + ' is too long (at most ' + s.maxLength + ' characters)'; if (s.minLength !== undefined && v.trim().length < s.minLength) return where + ' is empty'; }
  if (typeof v === 'number') { if (s.minimum !== undefined && v < s.minimum) return where + ' must be at least ' + s.minimum; if (s.maximum !== undefined && v > s.maximum) return where + ' must be at most ' + s.maximum; }
  if (s.type === 'array') {
    if (s.minItems !== undefined && v.length < s.minItems) return where + ' needs at least ' + s.minItems + ' items';
    if (s.maxItems !== undefined && v.length > s.maxItems) return where + ' takes at most ' + s.maxItems + ' items';
    if (s.items) for (let i = 0; i < v.length; i++) { const e = validate(v[i], s.items, where + '[' + i + ']'); if (e) return e; }
  }
  if (s.type === 'object') {
    // unknown keys first: a misspelled required key ("plase") then gets "did you mean", not just "needs place"
    if (s.additionalProperties === false) for (const k of Object.keys(v)) if (!own(s.properties || {}, k)) { const g = closest(k, Object.keys(s.properties || {})); return (where === 'arguments' ? 'there is no "' : where + ' has no "') + String(k).slice(0, 40) + '"' + (g ? '; did you mean "' + g + '"?' : ''); }
    for (const k of s.required || []) if (!own(v, k)) return where + ' needs "' + k + '"';
    for (const k of Object.keys(s.properties || {})) if (own(v, k) && v[k] !== undefined) { const e = validate(v[k], s.properties[k], where === 'arguments' ? '"' + k + '"' : where + '.' + k); if (e) return e; }
  }
  return null;
}
const INIT_SCHEMA = { type: 'object', required: ['protocolVersion', 'capabilities', 'clientInfo'], properties: { protocolVersion: { type: 'string', maxLength: 40 }, capabilities: { type: 'object' },
  clientInfo: { type: 'object', required: ['name', 'version'], properties: { name: { type: 'string', maxLength: 200 }, version: { type: 'string', maxLength: 100 } } } } };

// ---------- work in flight: at most ACTIVE tool calls at once, QUEUE more waiting; beyond that, "busy" ----------
const ACTIVE = 4, QUEUE = 32; let running = 0; const waiting = [];
function slot() { if (running < ACTIVE) { running++; return Promise.resolve(true); } if (waiting.length >= QUEUE) return Promise.resolve(false); return new Promise(res => waiting.push(res)); }
function release() { const next = waiting.shift(); if (next) next(true); else running--; }

async function callTool(params) {
  if (!params || typeof params !== 'object' || Array.isArray(params) || typeof params.name !== 'string') return { rpcError: [-32602, 'Invalid params: tools/call needs a tool "name"'] };
  const name = params.name;
  if (!HANDLERS.has(name) && !NASA.has(name)) return { rpcError: [-32602, 'Unknown tool: ' + name.slice(0, 60) + '. Tools: ' + TOOLS.map(t => t.name).join(', ')] };
  const args = params.arguments === undefined ? {} : params.arguments;
  const bad = validate(args, SCHEMAS.get(name), 'arguments');
  if (bad) return { rpcError: [-32602, 'Invalid params for ' + name + ': ' + bad] };
  if (!(await slot())) return { rpcError: [-32000, 'The server is busy; try again in a moment.'] };
  if (NASA.has(name)) { try { return await nasa.call(name, args); } finally { release(); } }
  try {
    const out = await HANDLERS.get(name)(args);
    return { content: [{ type: 'text', text: out.text }], structuredContent: out.data, isError: false };
  } catch (e) {
    const act = args.acting_now === true && !!SCHEMAS.get(name).properties.acting_now;   // the safety line rides on errors too
    if (e instanceof fire.Refusal) {
      const sc = Object.assign({ refusal: { code: e.code, message: e.message } }, e.extra);
      if (act) sc.acting_now_line = fire.ACT_LINE;
      return { content: [{ type: 'text', text: act ? e.message + '\n\n' + fire.ACT_LINE : e.message }], structuredContent: sc, isError: true };
    }
    log('tool', name, 'failed:', e);   // detail to the operator's log only; never to the client
    const msg = 'Something went wrong inside the tool, so there is no answer. Try again, or ask about another place or period.';
    return act ? { content: [{ type: 'text', text: msg + '\n\n' + fire.ACT_LINE }], structuredContent: { acting_now_line: fire.ACT_LINE }, isError: true } : { content: [{ type: 'text', text: msg }], isError: true };
  } finally { release(); }
}

const idOk = (id) => typeof id === 'string' || (typeof id === 'number' && Number.isInteger(id));
// ctx: the session as the front end knows it ({ version } once negotiated); stdio keeps one per process, HTTP builds one per request
async function handle(msg, ctx) {
  if (!msg || typeof msg !== 'object' || Array.isArray(msg) || msg.jsonrpc !== '2.0' || typeof msg.method !== 'string') {
    if (msg && typeof msg === 'object' && own(msg, 'id') && (own(msg, 'result') || own(msg, 'error'))) return null;   // a response to us: we send no requests, ignore
    return err(null, -32600, 'Invalid Request');
  }
  if (!own(msg, 'id')) {   // a notification: never answered, whatever it is
    if (msg.method === 'notifications/initialized' && ctx) ctx.initialized = true;
    return null;
  }
  if (!idOk(msg.id)) return err(null, -32600, 'Invalid Request: id must be a string or a whole number');
  const params = msg.params;
  switch (msg.method) {
    case 'initialize': {
      const bad = validate(params, INIT_SCHEMA, 'params');
      if (bad) return err(msg.id, -32602, 'Invalid params: ' + bad);
      const version = SUPPORTED.indexOf(params.protocolVersion) >= 0 ? params.protocolVersion : SUPPORTED[0];
      if (ctx) ctx.version = version;
      return ok(msg.id, { protocolVersion: version, capabilities: { tools: { listChanged: false } },
        serverInfo: { name: NAME, title: 'NASA fire record (MODIS and VIIRS on one scale)', version: VERSION }, instructions: ALL_INSTRUCTIONS });
    }
    case 'ping': return ok(msg.id, {});
    case 'tools/list': return ok(msg.id, { tools: TOOLS });
    case 'tools/call': {
      const res = await callTool(params);
      if (res.rpcError) return err(msg.id, res.rpcError[0], res.rpcError[1]);
      return ok(msg.id, res);
    }
    default: return err(msg.id, -32601, 'Method not found: ' + msg.method.slice(0, 60));
  }
}

// batches exist only before 2025-06-18; a batch is answered only when the session negotiated such a version
const batchesAllowed = (ctx) => !!(ctx && ctx.version && ctx.version < '2025-06-18');
// one parsed message (or batch) in, the reply out (null when nothing is to be sent back)
async function respond(msg, ctx) {
  if (Array.isArray(msg)) {
    if (!batchesAllowed(ctx)) return err(null, -32600, 'Invalid Request: batches are not part of protocol version ' + ((ctx && ctx.version) || SUPPORTED[0]));
    if (!msg.length || msg.length > 20) return err(null, -32600, 'Invalid Request: a batch holds 1 to 20 messages');
    const outs = (await Promise.all(msg.map(m => Array.isArray(m) ? err(null, -32600, 'Invalid Request') : handle(m, ctx).catch(e => { log('internal error:', e); return err(null, -32603, 'Internal error'); })))).filter(Boolean);
    return outs.length ? outs : null;
  }
  return handle(msg, ctx).catch(e => { log('internal error:', e); return err(msg && idOk(msg.id) ? msg.id : null, -32603, 'Internal error'); });
}

module.exports = { respond, handle, err, log, clean, validate, TOOLS, RECORD_TOOLS, INSTRUCTIONS: ALL_INSTRUCTIONS, RECORD_INSTRUCTIONS: INSTRUCTIONS, NAME, VERSION, SUPPORTED, fire, LIMITS: { ACTIVE, QUEUE } };
