// run_backlog_checks.cjs: backlog checks (P1-1 .. P2-5 plus preserve) against server/server.cjs over stdio.
// Same pattern as run_tests.cjs. Writes TEST_OUTPUT_BACKLOG.txt. Usage: node test/run_backlog_checks.cjs   (Node 20+, no packages)
'use strict';
const path = require('path'), fs = require('fs'), { spawn } = require('child_process');
const ROOT = path.resolve(__dirname, '..');
const out = [], results = [];
function line(s) { out.push(s); console.log(s); }
function check(name, ok, got) { results.push(!!ok); line((ok ? 'PASS ' : 'FAIL ') + name + (got !== undefined ? ' | got: ' + (typeof got === 'string' ? got : JSON.stringify(got)) : '')); }

const NASA_ENV = { FIRE_CONNECTOR_NASA_FIXTURES: path.join(__dirname, 'fixtures_nasa'), FIRE_CONNECTOR_NOW: '2026-11-14T16:21:00Z' };
function startServer() {
  const child = spawn(process.execPath, [path.join(ROOT, 'server', 'server.cjs')], { env: Object.assign({}, process.env, NASA_ENV), stdio: ['pipe', 'pipe', 'pipe'] });
  let buf = '', nextId = 1; const waiting = new Map();
  child.stdout.setEncoding('utf8');
  child.stdout.on('data', (d) => { buf += d; let i; while ((i = buf.indexOf('\n')) >= 0) { const l = buf.slice(0, i); buf = buf.slice(i + 1); if (!l.trim()) continue;
    let m; try { m = JSON.parse(l); } catch (e) { continue; }
    const w = (typeof m.id === 'string' || typeof m.id === 'number') ? waiting.get(m.id) : null; if (w) { waiting.delete(m.id); w(m); } } });
  child.stderr.setEncoding('utf8'); child.stderr.on('data', () => {});
  const write = (obj) => child.stdin.write(JSON.stringify(obj) + '\n');
  const request = (method, params) => new Promise((res, rej) => { const id = nextId++; const t = setTimeout(() => rej(new Error('timeout on ' + method)), 30000);
    waiting.set(id, (m) => { clearTimeout(t); res(m); }); write({ jsonrpc: '2.0', id, method, params }); });
  return { child, request, notify: (method, params) => write({ jsonrpc: '2.0', method, params }) };
}

const txt = (m) => (m && m.result && m.result.content && m.result.content[0] && m.result.content[0].text) || '';
const sc = (m) => (m && m.result && m.result.structuredContent) || {};
const err = (m) => !!(m && m.result && m.result.isError);
const lastLine = (t) => t.split('\n').map(s => s.trim()).filter(Boolean).pop() || '';
const firstLine = (t) => t.split('\n').find(s => s.trim()) || '';
const short = (t) => (t || '').replace(/\s+/g, ' ').slice(0, 160);

(async () => {
  line('MCP backlog checks over stdio, ' + new Date().toString()); line('');
  const S = startServer();
  await S.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'backlog', version: '1' } });
  S.notify('notifications/initialized', {});
  const call = async (name, args) => { try { return await S.request('tools/call', { name, arguments: args }); } catch (e) { return { error: { code: 0, message: String(e.message) } }; } };
  const ans = (args) => call('fire_answer', args);
  const run = async (name, fn) => { try { await fn(); } catch (e) { check(name, false, 'check threw: ' + (e && e.message)); } };

  // P1-1
  await run('P1-1 Greece "this month": names December 2025, says November 2026 not in record, period.fallback', async () => {
    const m = await ans({ place: 'Greece', period: 'this month' }), t = txt(m), p = sc(m).period || {};
    check('P1-1 Greece "this month": names December 2025, says November 2026 not in record, period.fallback', /December 2025/.test(t) && /November 2026/.test(t) && /(not|isn't|no data)/i.test(t) && (p.fallback === true || !!p.requested_unavailable), short(t) + ' | period=' + JSON.stringify(p));
  });
  await run('P1-1 Greece "this year"', async () => {
    const m = await ans({ place: 'Greece', period: 'this year' }), t = txt(m);
    check('P1-1 Greece "this year": names 2025 and says 2026 is not in the record', /2025/.test(t) && /2026/.test(t) && /(not|isn't|no data)/i.test(t), short(t));
  });
  // P1-2
  await run('P1-2 Argentina "this year"', async () => {
    const m = await ans({ place: 'Argentina', period: 'this year' }), t = txt(m);
    check('P1-2 Argentina "this year": no "twelve days", mentions January', !/twelve days/i.test(t) && /January/.test(t), short(t));
  });
  await run('P1-2 Argentina "latest"', async () => {
    const t = txt(await ans({ place: 'Argentina', period: 'latest' }));
    check('P1-2 Argentina "latest" still says twelve/12 days (preserve)', /twelve days|12 days/i.test(t), short(t));
  });
  // P1-3
  await run('P1-3 Greece 2023-08', async () => {
    const m = await ans({ place: 'Greece', period: '2023-08' }), t = txt(m), s = sc(m), cam = s.cameras !== undefined ? s.cameras : s.camera_agreement;
    check('P1-3 Greece 2023-08: no "agrees", cameras_agree false, cameras same_direction', !/agrees/i.test(t) && s.cameras_agree === false && cam === 'same_direction', 'agrees-in-text=' + /agrees/i.test(t) + ' cameras_agree=' + s.cameras_agree + ' cameras=' + JSON.stringify(cam));
  });
  await run('P1-3 Greece latest', async () => {
    const s = sc(await ans({ place: 'Greece', period: 'latest' }));
    check('P1-3 Greece latest (both verdicts absent): both_answers_must_travel_together false', s.both_answers_must_travel_together === false, s.both_answers_must_travel_together);
  });
  // P1-4
  await run('P1-4 Greece 2026-11 acting_now', async () => {
    const m = await ans({ place: 'Greece', period: '2026-11', acting_now: true }), t = txt(m);
    check('P1-4 Greece 2026-11 acting_now: isError and last line has "local authorities"', err(m) && /local authorities/.test(lastLine(t)), 'isError=' + err(m) + ' last=' + short(lastLine(t)));
  });
  await run('P1-4 Argentina acting_now', async () => {
    const m = await ans({ place: 'Argentina', acting_now: true }), t = txt(m);
    check('P1-4 Argentina acting_now success: last line has "local authorities"', !err(m) && /local authorities/.test(lastLine(t)), 'isError=' + err(m) + ' last=' + short(lastLine(t)));
  });
  await run('P1-4 how_sure Pakistan', async () => {
    const t = txt(await call('how_sure', { place: 'Pakistan' }));
    // The team lead's rule ("Full strength, no hedging", DAY_BRIEF.md) keeps NASA's caution in the how-sure tool, so it stays, said exactly once
    check('P1-4 how_sure Pakistan: the caution said exactly once', t.length > 0 && (t.match(/local authorities/g) || []).length === 1, short(t));
  });
  // P1-5
  await run('P1-5 report_sentence Aland', async () => {
    const t = txt(await call('report_sentence', { place: 'Åland Islands', period: 'latest' }));
    check('P1-5 report_sentence Aland Islands: no "Read MODIS\'s own count first"', t.length > 0 && !/Read MODIS['’]s own count first/.test(t), short(t));
  });
  // P2-1
  await run('P2-1 compare different dates', async () => {
    const t = txt(await call('compare', { first: { place: 'Argentina' }, second: { place: 'Greece' } }));
    check('P2-1 compare Argentina/Greece: first line flags different dates', /different (dates|months|periods)/i.test(firstLine(t)), short(firstLine(t)));
  });
  // P2-4
  await run('P2-4 Greece 2100', async () => {
    const m = await ans({ place: 'Greece', period: '2100' });
    check('P2-4 Greece 2100: isError (out of coverage)', err(m), 'isError=' + err(m) + ' ' + short(txt(m)));
  });
  await run('P2-4 Greece next year', async () => {
    const m = await ans({ place: 'Greece', period: 'next year' }), t = txt(m);
    check('P2-4 Greece "next year": not an error, text starts "Nothing about"', !err(m) && !m.error && /^Nothing about/.test(t.trim()), 'isError=' + err(m) + ' ' + short(t));
  });
  // P2-5
  await run('P2-5 misspelled key', async () => {
    const m = await ans({ place: 'Greece', periood: '2020' });
    check('P2-5 fire_answer periood: JSON-RPC -32602 mentioning "period"', !!(m.error && m.error.code === -32602 && /period/i.test(m.error.message || '')), m.error || short(txt(m)));
  });
  await run('P2-5 compare misspelled key', async () => {
    const m = await call('compare', { first: { place: 'Greece', periood: '2020' }, second: { place: 'Argentina' } });
    check('P2-5 compare first.periood: JSON-RPC -32602', !!(m.error && m.error.code === -32602), m.error || short(txt(m)));
  });
  await run('P2-5 period omitted', async () => {
    const m = await ans({ place: 'Greece' });
    check('P2-5 fire_answer period omitted: success', !m.error && !err(m) && txt(m).length > 0, m.error || ('isError=' + err(m) + ' ' + short(txt(m))));
  });
  // Persona round (second outside test): the record tools
  await run('Persona: record ranking names its measure', async () => {
    const m = await call('place_record', { place: 'United States', view: 'years' }), t = txt(m);
    check('Persona: US years says "had the most fire detected", not "burned most"; a tie carries into the next question', /had the most fire detected/.test(t) && !/burned most/.test(t) && /one of the two biggest years/.test(t), short(firstLine(t.split('\n').slice(1).join('\n'))));
  });
  await run('Persona: next question never repeats the call', async () => {
    const s = sc(await ans({ place: 'Åland Islands', period: 'last season' })), n = (s.next_questions || [])[0] || {};
    check('Persona: Åland last season does not offer the same fire_answer call again', !(n.tool === 'fire_answer' && /season/.test(String(n.arguments && n.arguments.period))), n);
  });
  await run('Persona: same place and dates under two spellings', async () => {
    const m = await call('compare', { first: { place: 'USA', period: '2020-09' }, second: { place: 'United States', period: 'September 2020' } });
    check('Persona: compare USA 2020-09 with United States September 2020 gives one answer', /same place and the same dates|both come to September 2020, so here is the one answer/.test(txt(m)) && sc(m).identical === true, short(firstLine(txt(m))));
  });
  await run('Persona: whole months of different lengths', async () => {
    const m = await call('compare', { first: { place: 'Argentina', period: '2020-01' }, second: { place: 'Argentina', period: '2020-02' } });
    check('Persona: January vs February 2020 labels whole-month totals of 31 and 29 days', /whole-month totals: 31 and 29 days/.test(txt(m)), short(txt(m)));
  });
  await run('Persona: Spanish month name', async () => {
    const m = await ans({ place: 'Argentina', period: 'noviembre de 2025' });
    check('Persona: "noviembre de 2025" reads as November 2025', !err(m) && sc(m).period && sc(m).period.month === '2025-11', sc(m).period && sc(m).period.month);
  });
  await run('Persona: a season across the new year', async () => {
    const t = txt(await ans({ place: 'Australia', period: 'season 2019-20' }));
    check('Persona: Australia "season 2019-20" answers April to December 2019 and says it stops at December 2019, then answers January 2020', /April to December/.test(t) && /stops at December 2019/.test(t) && /January 2020 was/.test(t), short(t));
  });
  await run('Persona: verdict basis exposed', async () => {
    const b = (sc(await ans({ place: 'Argentina', period: '2026-01' })).our_record || {}).verdict_basis;
    check('Persona: Argentina January 2026 exposes the verdict basis (rank among other years, how many years)', !!(b && /rank/.test(b.rule) && typeof b.rank_fraction === 'number' && b.other_years > 0), b);
  });

  await run('Persona: misspelled required key', async () => {
    const m = await call('fire_answer', { plase: 'Greece' });
    check('Persona: "plase" gets -32602 with "did you mean "place""', !!(m.error && m.error.code === -32602 && /did you mean "place"/.test(m.error.message)), m.error && m.error.message);
  });

  // Retest of build 3.1
  await run('R3.1-1 Greece "this year"', async () => {
    const m = await call('report_sentence', { place: 'Greece', period: 'this year' }), t = txt(m), s = sc(m);
    check('R3.1-1 report_sentence Greece "this year": says 2026 is not in the record, period_detail.fallback true', /2026/.test(t) && /(isn't|not) in/i.test(t) && ((s.period_detail && s.period_detail.fallback === true) || s.fallback === true), short(t) + ' | period_detail=' + JSON.stringify(s.period_detail));
  });
  await run('R3.1-2 Greece "this month"', async () => {
    const t = txt(await call('report_sentence', { place: 'Greece', period: 'this month' }));
    check('R3.1-2 report_sentence Greece "this month": names November 2026 and says not in the record', /November 2026/.test(t) && /(isn't|not) in/i.test(t), short(t));
  });
  await run('R3.1-3 Australia season fire_answer', async () => {
    const t = txt(await ans({ place: 'Australia', period: 'season 2019-20' }));
    check('R3.1-3 fire_answer Australia "season 2019-20": January 2020 with a verdict word', /January 2020[^.\n]*(busier|quieter|normal)/i.test(t), short(t));
  });
  await run('R3.1-4 Australia season report_sentence', async () => {
    const t = txt(await call('report_sentence', { place: 'Australia', period: 'season 2019-20' }));
    check('R3.1-4 report_sentence Australia "season 2019-20": mentions January 2020', /January 2020/.test(t), short(t));
  });
  await run('R3.1-5 Australia 2000', async () => {
    const m = await ans({ place: 'Australia', period: '2000' }), t = txt(m);
    check('R3.1-5 fire_answer Australia "2000": says the record starts in November 2000', /starts in November 2000/.test(t), 'isError=' + err(m) + ' ' + short(t));
  });
  await run('R3.1-6 place_record months 2000 next question', async () => {
    const s = sc(await call('place_record', { place: 'Australia', view: 'months', year: 2000 })), n = (s.next_questions || [])[0] || {};
    check('R3.1-6 place_record Australia months 2000: next question does not ask for year 1999', !!s.next_questions && !(n.arguments && n.arguments.year === 1999), n);
  });
  await run('R3.1-7 compare with unknown place', async () => {
    const m = await call('compare', { first: { place: 'Greece', period: '2023-08' }, second: { place: 'Atlantis', period: '2023-08' } }), t = txt(m);
    check('R3.1-7 compare Greece vs Atlantis: no JSON-RPC error, Greece verdict given, Atlantis said not in the record', !m.error && /Greece, August 2023: /.test(t) && /Atlantis/.test(t), m.error || short(t));
  });
  await run('R3.1-8 Argentina months 2026 November row', async () => {
    const rows = sc(await call('place_record', { place: 'Argentina', view: 'months', year: 2026 })).rows || [];
    const nov = rows.find(r => r.month === '2026-11'), oct = rows.find(r => r.month === '2026-10');
    check('R3.1-8 place_record Argentina months 2026: November from 2026-11-01 to 2026-11-12, complete false; October complete true', !!(nov && nov.from === '2026-11-01' && nov.to === '2026-11-12' && nov.complete === false && oct && oct.complete === true), { nov: nov, oct_complete: oct && oct.complete });
  });
  await run('R3.1-9 Argentina 2026-01 verdict basis', async () => {
    const m = await call('report_sentence', { place: 'Argentina', period: '2026-01' }), t = txt(m), b = sc(m).verdict_basis;
    check('R3.1-9 report_sentence Argentina 2026-01: verdict_basis with numeric rank_fraction, text says how many other years had less', !!(b && typeof b.rank_fraction === 'number') && (/other years had less/.test(t) || /of the \d+ other years/.test(t)), 'basis=' + JSON.stringify(b) + ' | ' + short(t));
  });
  await run('R3.1-10 Argentina today', async () => {
    const t = txt(await ans({ place: 'Argentina', period: 'today' }));
    check('R3.1-10 fire_answer Argentina "today": points to fire_now / NASA\'s 24-hour file / last 24 hours', /fire_now/.test(t) || /NASA['’]s 24-hour file/.test(t) || /last 24 hours/i.test(t), short(t));
  });
  await run('R3.1-11 Aland months 2025', async () => {
    const t = txt(await call('place_record', { place: 'Åland Islands', view: 'months', year: 2025 }));
    check('R3.1-11 place_record Åland Islands months 2025: no "August to August"', t.length > 0 && !/August to August/.test(t), short(t));
  });
  await run('R3.1-12 Congo ambiguous', async () => {
    const m = await ans({ place: 'Congo' }), t = txt(m), r = sc(m).refusal || {};
    // find_places "congo" shows: "Democratic Republic of the Congo" and "Republic of Congo"
    check('R3.1-12 fire_answer Congo: isError, refusal AMBIGUOUS_PLACE, names Congo and Democratic Republic of the Congo, not Togo or Tonga', err(m) && r.code === 'AMBIGUOUS_PLACE' && /Congo/.test(t) && /Democratic Republic of the Congo/.test(t) && !/Togo/.test(t) && !/Tonga/.test(t), 'isError=' + err(m) + ' code=' + r.code + ' ' + short(t));
  });
  await run('R3.1-13 serverInfo version', async () => {
    const m = await S.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'backlog', version: '1' } }), v = m && m.result && m.result.serverInfo && m.result.serverInfo.version;
    check('R3.1-13 initialize serverInfo.version is not 0.1.0', !!v && v !== '0.1.0', v);
  });
  await run('R3.1-14 Canada 2023 citation', async () => {
    const c = sc(await call('report_sentence', { place: 'Canada', period: '2023' })).citation;
    check('R3.1-14 report_sentence Canada 2023: citation.dataset is a string mentioning FIRMS', !!(c && typeof c.dataset === 'string' && /FIRMS/.test(c.dataset)), c);
  });

  // Retest of build 3.2
  for (const [x, y, tag] of [[{ place: 'Greece', period: 'this year' }, { place: 'Greece', period: '2025' }, 'this year first'], [{ place: 'Greece', period: '2025' }, { place: 'Greece', period: 'this year' }, '2025 first']]) {
    await run('R3.2-1 compare fallback, ' + tag, async () => {
      const t = txt(await call('compare', { first: x, second: y }));
      check('R3.2-1 compare Greece "this year" with "2025" (' + tag + '): one answer, and it says 2026 isn\'t in the record', /both come to 2025/.test(t) && /2026 isn't in it yet/.test(t), short(t));
    });
  }
  await run('R3.2-2 cross-year compare', async () => {
    const t = txt(await call('compare', { first: { place: 'Australia', period: 'season 2019-20' }, second: { place: 'Australia', period: 'season 2018-19' } }));
    check('R3.2-2 compare Australia seasons 2019-20 and 2018-19: both scope lines and "for the dates shown"', /stops at December 2019/.test(t) && /stops at December 2018/.test(t) && /for the dates shown/.test(t), short(t));
  });
  await run('R3.2-3 nonconsecutive season', async () => {
    const m = await ans({ place: 'Australia', period: 'season 2019-25' });
    check('R3.2-3 "season 2019-25" is not read (BAD_PERIOD)', err(m) && sc(m).refusal && sc(m).refusal.code === 'BAD_PERIOD', short(txt(m)));
  });
  await run('R3.2-4 partial first year in reports', async () => {
    const m = await call('report_sentence', { place: 'Australia', period: '2000' }), d = sc(m).period_detail || {};
    const a = sc(await ans({ place: 'Australia', period: '2000' })).period || {};
    check('R3.2-4 report Australia 2000: "starts in November 2000", complete false, from 2000-11-01; fire_answer agrees', /starts in November 2000/.test(txt(m)) && !/no data/.test(txt(m)) && d.complete === false && d.from === '2000-11-01' && a.complete === false, d);
  });
  await run('R3.2-5 fire_now quoted camera range', async () => {
    const m = await call('fire_now', { place: 'Argentina' }), n = (sc(m).nasa_last_24h || {}), q = n.quoted_camera_range || {};
    const hhmm = q.to_utc ? q.to_utc.slice(11, 16) : null;
    check('R3.2-5 fire_now Argentina: the range in the first line is the quoted camera\'s own', !!(q.camera && hhmm && firstLine(txt(m)).indexOf(hhmm + ' UTC') >= 0), { q, line: short(firstLine(txt(m))) });
  });
  await run('R3.2-6 report dates as fields', async () => {
    const d = sc(await call('report_sentence', { place: 'Argentina', period: 'latest' })).period_detail || {};
    check('R3.2-6 report Argentina latest: period_detail from 2026-11-01, to 2026-11-12, complete false', d.from === '2026-11-01' && d.to === '2026-11-12' && d.complete === false, d);
  });

  // Follow-up of build 3.3
  await run('F1 compare India Aug 2024 vs Aug 2023: MODIS own change, opposite ways', async () => {
    const m = await call('compare', { first: { place: 'India', period: '2024-08' }, second: { place: 'India', period: '2023-08' } }), t = txt(m), d = sc(m), mc = d.modis_comparison;
    const ln = t.split('\n').some(l => /MODIS alone/.test(l) && /MODIS[^.\n]*(more|fewer|%|times|same)/.test(l));
    check('F1 compare India 2024-08 vs 2023-08: MODIS-alone line gives MODIS\'s own change, says the series point opposite ways, modis_comparison numeric first/second', ln && /opposite/i.test(t) && !!mc && typeof mc.first === 'number' && typeof mc.second === 'number', 'line=' + ln + ' opposite=' + /opposite/i.test(t) + ' modis_comparison=' + JSON.stringify(mc));
  });
  await run('F2 report_sentence India 2023-08 short names MODIS verdict', async () => {
    const s = sc(await call('report_sentence', { place: 'India', period: '2023-08' }));
    check('F2 report_sentence India 2023-08: short form names MODIS\'s verdict word', typeof s.short === 'string' && /MODIS[^.]*(normal|busier|quieter)/.test(s.short), s.short);
  });
  await run('F3a place_record Anguilla years next question', async () => {
    const n = (sc(await call('place_record', { place: 'Anguilla', view: 'years' })).next_questions || [])[0] || {};
    check('F3a place_record Anguilla years: first next question is not place_record months', n.tool !== 'place_record' || !n.arguments || n.arguments.view !== 'months', n);
  });
  await run('F3b place_record Anguilla months refusal', async () => {
    const m = await call('place_record', { place: 'Anguilla', view: 'months' }), t = txt(m), r = sc(m).refusal || {};
    check('F3b place_record Anguilla months: no "NaN", refusal NO_USABLE_MONTHS', t.length > 0 && !/NaN/.test(t) && r.code === 'NO_USABLE_MONTHS', 'code=' + r.code + ' ' + short(t));
  });
  await run('F4 how_sure Anguilla', async () => {
    const m = await call('how_sure', { place: 'Anguilla' }), t = txt(m), n = (sc(m).next_questions || [])[0] || {};
    check('F4 how_sure Anguilla: does not say answers lead with our record; first next question is nasa_recent or fire_now', t.length > 0 && !/lead with our record/i.test(t) && (n.tool === 'nasa_recent' || n.tool === 'fire_now'), 'next=' + JSON.stringify(n) + ' ' + short(t));
  });
  await run('F5 Burkina Faso 2001 partial months', async () => {
    const t = txt(await ans({ place: 'Burkina Faso', period: '2001' }));
    check('F5 fire_answer Burkina Faso 2001: no "no data for", mentions month(s) with data', t.length > 0 && !/no data for/i.test(t) && /month/i.test(t), short(t));
  });
  await run('F6 report_sentence Burkina Faso 2023', async () => {
    const f = sc(await call('report_sentence', { place: 'Burkina Faso', period: '2023' })).full;
    check('F6 report_sentence Burkina Faso 2023: full has no "too little fire", says too few years', typeof f === 'string' && !/too little fire/i.test(f) && /too few/i.test(f), f);
  });
  await run('F7 compare Niger seasons direct comparison (MODIS leads both; Burkina Faso, repaired, no longer does)', async () => {
    const m = await call('compare', { first: { place: 'Niger', period: 'season 2024' }, second: { place: 'Niger', period: 'season 2025' } }), t = txt(m), dc = sc(m).direct_comparison;
    const bf = sc(await call('compare', { first: { place: 'Burkina Faso', period: 'season 2023-24' }, second: { place: 'Burkina Faso', period: 'season 2024-25' } })).direct_comparison;
    check('F7b compare Burkina Faso seasons after the repair: the direct comparison is on our record', !!bf && bf.source === 'our record', bf);
    check('F7 compare Niger seasons: direct_comparison.source "MODIS alone", text says "on MODIS" or "MODIS\'s own"', !!dc && dc.source === 'MODIS alone' && /on MODIS|MODIS['’]s own/.test(t), 'dc=' + JSON.stringify(dc) + ' ' + short(t));
  });
  await run('F8 Niger season 2025 row counts match verdict source', async () => {
    const rows = sc(await ans({ place: 'Niger', period: 'season 2025' })).season_months || [];
    const ms = rows.filter(r => r.verdict && r.verdict.from === 'MODIS alone'), bad = ms.filter(r => r.detections !== r.modis_alone);
    check('F8 Niger season 2025: there are MODIS-alone-verdict rows, and each has detections === modis_alone', rows.length > 0 && ms.length > 0 && bad.length === 0, { rows: rows.length, modis_rows: ms.length, bad: bad.map(r => ({ month: r.month, detections: r.detections, modis_alone: r.modis_alone })) });
  });
  await run('F9 compare Greece 2025 vs this year descriptor', async () => {
    const d = sc(await call('compare', { first: { place: 'Greece', period: '2025' }, second: { place: 'Greece', period: 'this year' } }));
    const fb = !!((d.first && d.first.period && d.first.period.fallback === true) || (d.second && d.second.period && d.second.period.fallback === true));
    check('F9 compare Greece 2025 vs "this year": data.second not null and a period.fallback true', d.second != null && fb, { second: d.second === undefined ? 'undefined' : d.second === null ? null : 'present', fallback: fb });
  });

  // The second-model check of the engine repair: test wording, and which record leads
  await run('W1 how_sure wording and leader', async () => {
    const al = await call('how_sure', { place: 'Algeria' }), gh = await call('how_sure', { place: 'Ghana' }), aa = await ans({ place: 'Algeria' });
    const t = txt(al) + '\n' + txt(gh);
    check('W1 how_sure says "each year left out in turn when learning its conversion numbers", never "held back and guessed"', /left out in turn when learning its conversion numbers/.test(t) && !/held back and guessed/.test(t), short(txt(gh)));
    check('W1 how_sure Algeria (twelve numbers, 27% miss) names MODIS as leader, as its answer does', /lead with MODIS alone/.test(txt(al)) && (sc(aa).verdict || {}).from === 'MODIS alone', short(lastLine(txt(al).split('\n\n')[0])));
  });

  // viirs_scale (the team lead: "Yes, build it"; method and numbers: round_SAT\reverse_join\REVERSE_JOIN.md, cross-checked by a second model family)
  await run('V1 Argentina 2005 on VIIRS scale', async () => {
    const m = await call('viirs_scale', { place: 'Argentina', period: '2005' }), t = txt(m), d = sc(m);
    check('V1 Argentina 2005: about 87,600 on VIIRS\'s scale (the research: 87,608), MODIS 27,097, said as an estimate (the page wording: a camera like VIIRS), never "VIIRS counted"', !err(m) && d.viirs_scale && Math.abs(d.viirs_scale.detections - 87608) <= 2 && d.modis_scale.detections === 27097 && /estimate of what a camera like VIIRS would have counted/.test(t) && !/VIIRS counted/.test(t), short(firstLine(t)));
  });
  await run('V2 Argentina 2020 own count', async () => {
    const d = sc(await call('viirs_scale', { place: 'Argentina', period: '2020' }));
    check('V2 Argentina 2020: 144,130 on VIIRS\'s scale and VIIRS\'s own 137,271 (the research\'s up-mirror and up-native)', Math.abs(d.viirs_scale.detections - 144130) <= 2 && d.viirs_own && d.viirs_own.detections === 137271, { up: d.viirs_scale && d.viirs_scale.detections, own: d.viirs_own });
  });
  await run('V3 November 2026 own count from NOAA-20', async () => {
    const d = sc(await call('viirs_scale', { place: 'Argentina', period: 'latest' }));
    check('V3 Argentina November 1-12, 2026: VIIRS\'s own count is NOAA-20 on S-NPP\'s scale, 2,256 (S-NPP stopped Nov 2)', d.viirs_own && d.viirs_own.detections === 2256 && /NOAA-20/.test(d.viirs_own.cameras[0]) && d.period.complete === false, d.viirs_own);
  });
  await run('V4 month verdict identical on both scales', async () => {
    const v = sc(await call('viirs_scale', { place: 'Argentina', period: '2005-08' })), a = sc(await ans({ place: 'Argentina', period: '2005-08' }));
    check('V4 Argentina August 2005: the comparison with a typical August is the same on both scales (one number per month cancels)', v.viirs_scale.compared_with_usual === a.our_record.compared_with_usual, { viirs: v.viirs_scale.compared_with_usual, modis: a.our_record.compared_with_usual });
  });
  await run('V5 refusals', async () => {
    const g = await call('viirs_scale', { place: 'Greenland', period: '2020' }), an = await call('viirs_scale', { place: 'Anguilla', period: '2020' });
    const gc = (sc(g).refusal || {}).code;
    check('V5 a worldwide-curve place has no VIIRS-scale number (NO_UPWARD_CONVERSION) or no usable month; Anguilla NO_USABLE_MONTHS', err(g) && (gc === 'NO_UPWARD_CONVERSION' || gc === 'NO_USABLE_MONTHS') && err(an) && (sc(an).refusal || {}).code === 'NO_USABLE_MONTHS', { greenland: gc, anguilla: (sc(an).refusal || {}).code });
  });
  await run('V7 a month whose conversion number is 0', async () => {
    const m = await call('viirs_scale', { place: 'Burkina Faso', period: '2020-07' }), y = await call('viirs_scale', { place: 'Burkina Faso', period: '2020' });
    check('V7 Burkina Faso July 2020: "no count on this scale" (NO_COUNT_ON_THIS_SCALE, never 0); 2020 gives no total on the VIIRS scale and names July, as the page does', err(m) && (sc(m).refusal || {}).code === 'NO_COUNT_ON_THIS_SCALE' && /has no total on VIIRS's scale: July 2020 has no count on this scale/.test(txt(y)) && sc(y).viirs_scale.detections === null && (sc(y).no_count_on_this_scale || []).indexOf('2020-07') >= 0, short(txt(y)));
  });
  await run('V6 weak and quiet places say so', async () => {
    const n = txt(await call('viirs_scale', { place: 'Niger', period: '2020' })), gr = txt(await call('viirs_scale', { place: 'Greece', period: '2005' }));
    check('V6 Niger (weak): says the scale-up is weak too; Greece (not busy): says going up comes out worse where months are small', /weak for Niger, and so is this scale-up/.test(n) && /going up comes out worse where months are small/.test(gr), short(gr));
  });

  // The afternoon word check of the page (shared wording): each case through the connector's own tools
  await run('C1 Burkina Faso 2025: the true reason', async () => {
    const t = txt(await ans({ place: 'Burkina Faso', period: '2025' })), c = txt(await call('compare', { first: { place: 'Burkina Faso', period: '2025' }, second: { place: 'Burkina Faso', period: '2024' } }));
    check('C1 Burkina Faso 2025: MODIS saw 6,272 "but there are not enough other years", never "too little" for that count; compare says "too few other years"', /MODIS[^\n]*6,272 fire detections, but there aren't enough other years with data to judge 2025/.test(t) && !/too little to judge: 6,272/.test(t) && /too few other years/.test(c) && !/Burkina Faso, 2025[^\n]*too little fire/.test(c), short(t));
  });
  await run('C2 Kuwait December 2025: a usual too small', async () => {
    const a = await ans({ place: 'Kuwait', period: 'December 2025' }), r = sc(await call('report_sentence', { place: 'Kuwait', period: 'December 2025' }));
    const c = txt(await call('compare', { first: { place: 'Kuwait', period: 'December 2025' }, second: { place: 'Kuwait', period: 'December 2024' } }));
    check('C2 Kuwait December 2025: "December is usually too quiet here for a reliable comparison" in fire_answer, the short report and compare; never "hardly any fire" for 20 detections', /December is usually too quiet here for a reliable comparison/.test(txt(a)) && !/hardly any fire/i.test(txt(a)) && /usually too quiet here for a reliable comparison/.test(r.short) && !/too little to call/.test(r.short) && /usually too quiet here/.test(c) && (sc(a).refusal || {}).code === 'USUAL_TOO_SMALL', short(r.short));
  });
  await run('C3 Saudi Arabia August 2005: a tie said as a tie', async () => {
    const t = txt(await ans({ place: 'Saudi Arabia', period: '2005-08' }));
    check('C3 Saudi Arabia August 2005: the least fire "tied with" another year, never "less than in any"', /tied with/.test(t) && !/less than in any/.test(t), short(firstLine(t)));
  });
  await run('C4 American Samoa November 2022: MODIS count shown once', async () => {
    const t = txt(await ans({ place: 'American Samoa', period: '2022-11' })), r = sc(await call('report_sentence', { place: 'American Samoa', period: '2022-11' }));
    check('C4 American Samoa November 2022: no count of ours, the MODIS 1 detection said, once, in fire_answer and in the report', (t.match(/MODIS/g) || []).length === 1 && /counted 1 fire detection/.test(t) && /MODIS[^.]*1 detection/.test(r.short), short(t));
  });
  await run('C5 Barbados November 2025: no MODIS count', async () => {
    const r = sc(await call('report_sentence', { place: 'Barbados', period: 'November 2025' }));
    check('C5 Barbados November 2025: never "read the MODIS count first" where MODIS has no count', !/Read MODIS['’]s own count first/.test(r.full + r.short) && /MODIS has no count of its own/.test(r.full), short(r.full));
  });
  await run('C6 VIIRS scale never says MODIS alone', async () => {
    const ts = [];
    for (const [pl, pe] of [['Argentina', '2005'], ['Argentina', '2022-08'], ['Kuwait', '2005'], ['Greece', '2005'], ['Burkina Faso', '2020']]) ts.push(txt(await call('viirs_scale', { place: pl, period: pe })));
    check('C6 viirs_scale: a converted MODIS count is never called "MODIS alone" or "on its own"', ts.every(t => !/MODIS alone|on its own/.test(t)), short(ts.find(t => /MODIS alone|on its own/.test(t)) || 'clean'));
  });
  await run('C7 VIIRS month floor on MODIS scale', async () => {
    const v = sc(await call('viirs_scale', { place: 'Greece', period: '2025-12' })), a = sc(await ans({ place: 'Greece', period: '2025-12' }));
    check('C7 Greece December 2025 (3 detections on the MODIS scale): no felt comparison on the VIIRS scale either, as on the page', v.viirs_scale.compared_with_usual === null && a.our_record.compared_with_usual === null, { viirs: v.viirs_scale.compared_with_usual, modis: a.our_record.compared_with_usual });
  });

  // Preserve
  await run('Preserve Argentina latest', async () => {
    const s = sc(await ans({ place: 'Argentina', period: 'latest' }));
    const o = s.our_record && s.our_record.detections, mo = s.modis_alone && s.modis_alone.detections;
    check('Preserve Argentina latest: our_record 550, modis_alone 757, cameras_agree false', o === 550 && mo === 757 && s.cameras_agree === false, { our: o, modis: mo, cameras_agree: s.cameras_agree });
  });
  // fire_answer with no period for Argentina latest: also try with period omitted (spec says latest)
  S.child.stdin.end();
  await new Promise(res => { S.child.on('close', res); setTimeout(res, 3000); });
  const pass = results.filter(Boolean).length, fail = results.length - pass;
  line(''); line('TOTAL: ' + pass + ' PASS, ' + fail + ' FAIL (' + results.length + ' checks)');
  fs.writeFileSync(path.join(__dirname, 'TEST_OUTPUT_BACKLOG.txt'), out.join('\n') + '\n', 'utf8');
  process.exitCode = fail ? 1 : 0;
})().catch(e => { line('FAIL the test run itself: ' + (e && e.stack || e)); fs.writeFileSync(path.join(__dirname, 'TEST_OUTPUT_BACKLOG.txt'), out.join('\n') + '\n', 'utf8'); process.exitCode = 1; });
