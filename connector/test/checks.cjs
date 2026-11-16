// checks.cjs: the tool checks both front ends must pass (stdio in run_tests.cjs, HTTP in run_http_tests.cjs). Expected values are read here,
// independently, from the vendored engine and Readings (../vendor).
'use strict';
const path = require('path');
const ROOT = path.resolve(__dirname, '..'), VENDOR = path.join(ROOT, 'vendor'), BASE = path.join(VENDOR, 'parts', 'engine_and_data');
const E = require(path.join(BASE, 'engine', 'hs_engine.js')), R = require(path.join(VENDOR, 'js', 'readings.js'));
const FIRE = require(path.join(ROOT, 'server', 'fire.cjs')), UNIT = FIRE.UNIT, FIRE_NASA = require(path.join(ROOT, 'server', 'nasa.cjs'));
const near = (a, b, tol) => a !== null && a !== undefined && b !== null && b !== undefined && Math.abs(a - b) <= (tol === undefined ? 1e-9 : tol);
const r1 = (v) => v === null || v === undefined ? null : Math.round(v * 10) / 10;

// client: { request(method, params) -> full JSON-RPC response, notify(method, params) }; line(text); check(name, ok, got)
async function runChecks(client, line, check) {
  const L = await E.open({ base: BASE }), cache = {};
  const eng = async (c) => { if (!cache[c]) { cache[c] = await E.query({ country: c }, L); await R.loadAvailability(L, cache[c]); } return cache[c]; };
  const call = (name, args) => client.request('tools/call', { name, arguments: args });
  const textOf = (m) => m && m.result && m.result.content && m.result.content[0] ? m.result.content[0].text : '';
  const allText = [];
  const refused = (m, code) => m.result && m.result.isError === true && m.result.structuredContent && m.result.structuredContent.refusal && m.result.structuredContent.refusal.code === code;

  // ---------- protocol ----------
  line('== Protocol');
  const init = await client.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'tests', version: '1' } });
  check('initialize: protocol version 2025-06-18 echoed, tools capability, server name', init.result && init.result.protocolVersion === '2025-06-18' && init.result.capabilities.tools && init.result.serverInfo.name === 'nasa-fire-record', init.result && init.result.protocolVersion);
  const ins = (init.result && init.result.instructions) || '';
  check('initialize: instructions say call a fire a fire, the count fact once, both answers, no forecasting, early data', /call a fire a fire|"fire", "fires", "burning" and "active fire" are the right words/.test(ins) && /not a count of separate fires/.test(ins) && /pass both on/.test(ins) && /nothing about it is certain, then the patterns to watch/.test(ins) && /early data/.test(ins), ins.length + ' characters');
  await client.notify('notifications/initialized');
  const old = await client.request('initialize', { protocolVersion: '1999-01-01', capabilities: {}, clientInfo: { name: 'x', version: '1' } });
  check('initialize with an unknown version: answers with its own newest (2025-06-18)', old.result && old.result.protocolVersion === '2025-06-18', old.result && old.result.protocolVersion);
  const ping = await client.request('ping', {});
  check('ping: empty result', ping.result && Object.keys(ping.result).length === 0);
  const list = await client.request('tools/list', {});
  const names = (list.result.tools || []).map(t => t.name);
  check('tools/list: eleven tools (fire_now, the six record tools, viirs_scale, NASA\'s three)', names.join(',') === 'fire_now,fire_answer,place_record,how_sure,report_sentence,find_places,compare,viirs_scale,nasa_recent,nasa_archive,nasa_sources', names.join(','));
  check('tools/list: every tool has a description and an object input schema', list.result.tools.every(t => t.description && t.inputSchema && t.inputSchema.type === 'object'));
  const nm = await client.request('no/such/method', {});
  check('unknown method: JSON-RPC error -32601', nm.error && nm.error.code === -32601, nm.error);
  const nt = await call('no_such_tool', {});
  check('unknown tool: JSON-RPC error -32602', nt.error && nt.error.code === -32602, nt.error);

  // ---------- per place ----------
  for (const P of ['Argentina', 'Ghana', 'Greece']) {
    line(''); line('== ' + P);
    const r = await eng(P), f = R.forPeriod(r, 'latest'), sc = R.screen(r, 'latest');
    const a = await call('fire_answer', { place: P }), d = a.result.structuredContent, t = textOf(a); allText.push(t);
    check(P + ' fire_answer latest: not an error, period ' + f.periodLabel, a.result.isError === false && d.period.label === f.periodLabel, d.period.label);
    check(P + ' fire_answer: our record = engine value ' + R.fmt(f.ours.value) + ', usual ' + R.fmt(f.ours.typical), near(d.our_record.detections_exact, f.ours.value) && d.our_record.detections === Math.round(f.ours.value) && d.our_record.usual === r1(f.ours.typical), d.our_record.detections + ' / ' + d.our_record.usual);
    check(P + ' fire_answer: MODIS alone = ' + (f.older ? R.fmt(f.older.value) + ', usual ' + R.fmt(f.older.typical) : 'none'), f.older ? d.modis_alone && d.modis_alone.detections === Math.round(f.older.value) && d.modis_alone.usual === r1(f.older.typical) : d.modis_alone === null, d.modis_alone && (d.modis_alone.detections + ' / ' + d.modis_alone.usual));
    const expV = f.lead === 'ours' ? { code: f.ours.word, from: 'our record' } : f.lead === 'modis' ? { code: f.older.word, from: 'MODIS alone' } : null;
    check(P + ' fire_answer: verdict ' + (expV ? '"' + expV.code + '" from ' + expV.from : 'none'), expV ? d.verdict && d.verdict.code === expV.code && d.verdict.from === expV.from && d.verdict.words === R.say(expV.code) : d.verdict === null, d.verdict);
    const LEADS = { 'much busier': 'Yes, far busier than normal', 'busier': 'Yes, busier than normal', 'about usual': 'About normal', 'quieter': 'No, quieter than normal', 'much quieter': 'No, far quieter than normal' };
    const first = t.split('\n')[0];
    check(P + ' fire_answer: starts with a sentence that is the answer (' + (expV ? '"' + P + '\'s ... ' + R.say(expV.code).toLowerCase() + '"' : 'no verdict') + ')', first.indexOf(P) === 0 && !/^[A-Z][a-z]+: /.test(first) && (expV ? first.indexOf(' ' + R.say(expV.code).toLowerCase()) > 0 : /hardly any fire|no verdict|We don't know/.test(first)), first);
    const disagree = f.lead === 'ours' && f.older && !f.sameWord && f.older.word && Math.sign(['much quieter','quieter','about usual','busier','much busier'].indexOf(f.older.word) - 2) !== Math.sign(['much quieter','quieter','about usual','busier','much busier'].indexOf(f.ours.word) - 2);
    if (f.older) check(P + ' fire_answer: MODIS\'s own answer is in the text' + (disagree ? ' as the one qualifier "The two cameras disagree"' : ''), (disagree ? /The two cameras disagree here: MODIS/.test(t) : /MODIS/.test(t)) && d.cameras_agree === (f.ours.word && f.older.word ? !!f.sameWord : null), d.cameras_agree);
    if (f.lead === 'modis') check(P + ' fire_answer: says once that our record is weak here and this goes by MODIS', t.split('Our own record is weak for').length === 2 && d.our_record.unreliable_here === true, d.qualifiers);
    check(P + ' fire_answer: early data flag = ' + f.early + (f.early ? ', and the text says "Early data"' : ''), d.early_data === f.early && (!f.early || /Early data/.test(t)), d.early_data);
    check(P + ' fire_answer: the unit rides in the structured result, not repeated in the text (said once per conversation)', t.indexOf(UNIT) < 0 && d.unit === UNIT && UNIT.split('. ').length === 1, d.unit);
    if (expV) check(P + ' fire_answer: one number worth remembering (' + (d.number_to_remember && d.number_to_remember.said) + ')', !!(d.number_to_remember && t.indexOf('That\'s ' + d.number_to_remember.said + ' fire detection') >= 0) && (t.match(/\b\d{1,3}(?:,\d{3})+\b|\b(?!(?:19|20)\d{2}\b)\d{3,}\b/g) || []).length <= 2, (t.match(/\b\d{1,3}(?:,\d{3})+\b|\b(?!(?:19|20)\d{2}\b)\d{3,}\b/g) || []).join(' '));
    check(P + ' fire_answer: ends on one next question chosen from the data, with the call that answers it', !!(d.next_questions && d.next_questions.length === 1 && t.trim().split('\n').pop() === d.next_questions[0].text && names.indexOf(d.next_questions[0].tool) >= 0), d.next_questions && d.next_questions[0].text);
    if (f.lead === 'none' && (f.tooFew || f.ours.tooFew)) check(P + ' fire_answer: too little fire: no verdict, refusal TOO_LITTLE_FIRE, said flatly', d.verdict === null && d.refusal && d.refusal.code === 'TOO_LITTLE_FIRE' && /too little to call quiet or busy/.test(t), d.refusal);
    const pos = R.positions(r), fy = R.forPeriod(r, pos.year);
    const ay = await call('fire_answer', { place: P, period: 'this year' }), dy = ay.result.structuredContent; allText.push(textOf(ay));
    check(P + ' fire_answer "this year": ' + fy.periodLabel + ', our record ' + R.fmt(fy.ours.value), near(dy.our_record.detections_exact, fy.ours.value) && dy.period.label === fy.periodLabel && dy.period.kind === fy.kind, dy.period.label + ' / ' + dy.our_record.detections);
    const ys = R.yearly(r), py = await call('place_record', { place: P, view: 'years' }), rows = py.result.structuredContent.rows; allText.push(textOf(py));
    check(P + ' place_record years: ' + ys.length + ' rows, each whole year = engine total, MODIS alone from 2022 only', rows.length === ys.length && ys.every((y, i) => rows[i].year === y.year && rows[i].detections === (y.ours === null ? null : Math.round(y.ours)) && (y.year < 2022 ? rows[i].modis_alone === null : rows[i].modis_alone === (y.olderOwn === null ? null : Math.round(y.olderOwn)))), rows.length);
    const yl = R.yearsLine(r); if (yl) check(P + ' place_record years: the busiest-years line from Readings, naming its measure', textOf(py).indexOf(yl.replace('burned most', 'had the most fire detected')) >= 0, yl);   // the connector says what "most" measures (most fire detected)
    const ly = +String(pos.latestYm).slice(0, 4), pm = await call('place_record', { place: P, view: 'months', year: ly }), mrows = pm.result.structuredContent.rows; allText.push(textOf(pm));
    const expM = r.monthly.filter(x => x.ym.slice(0, 4) === String(ly));
    check(P + ' place_record months ' + ly + ': ' + expM.length + ' months, each = engine value and Readings\' verdict', mrows.length === expM.length && expM.every((x, i) => { const pf = R.forPeriod(r, { month: x.ym }); const panel = R.monthPanel(r, x.ym);
      return mrows[i].month === x.ym && mrows[i].detections === (pf.ours.value === null ? null : Math.round(pf.ours.value)) && mrows[i].says === panel.say; }), mrows.length);
    const s = R.score(r), hs = await call('how_sure', { place: P }), hd = hs.result.structuredContent; allText.push(textOf(hs));
    check(P + ' how_sure: rule "' + s.rule + '", typical miss ' + (s.typicalPct === null ? 'none' : s.typicalPct.toFixed(1) + '%') + ', ' + s.months + ' months tested', hd.rule === s.rule && hd.typical_miss_pct === r1(s.typicalPct) && hd.months_tested === s.months, hd.rule + ' / ' + hd.typical_miss_pct + ' / ' + hd.months_tested);
    check(P + ' how_sure: answers lead with ' + (s.rule === 'twelve' ? 'our record' : 'MODIS alone'), s.rule === 'twelve' ? hd.answers_lead_with === 'our record' : /^MODIS alone/.test(hd.answers_lead_with), hd.answers_lead_with);
    const rs = await call('report_sentence', { place: P }), rd = rs.result.structuredContent; allText.push(textOf(rs));
    // the connector starts from the page's sentences and adds only what they leave out (MODIS's verdict when the cameras point opposite ways, a date fallback, the rank basis)
    check(P + ' report_sentence: short starts with Readings.shortSentence, full with Readings.sentence (fixes for this period applied)', rd.short.indexOf(R.shortSentence(r, 'latest').split('. ')[0]) === 0 && rd.full.indexOf(R.sentence(r, 'latest').split(': ')[0]) === 0, rd.short);
    const fp = await call('find_places', { query: P.toLowerCase() }), fd = fp.result.structuredContent;
    check(P + ' find_places "' + P.toLowerCase() + '": found, record to ' + R.positions(r).latestYm, fd.places.some(p => p.file === P && p.latest_month === R.positions(r).latestYm), fd.total);
    const cp = await call('compare', { first: { place: P }, second: { place: 'Argentina', period: 'latest' } }), cd = cp.result.structuredContent; allText.push(textOf(cp));
    const arg = R.forPeriod(await eng('Argentina'), 'latest');
    if (P === 'Argentina') check(P + ' compare with itself (same place, same dates): one answer, said once', cd.identical === true && cd.second !== null && near(cd.first.our_record.detections_exact, f.ours.value), textOf(cp).split('\n')[0]);
    else check(P + ' compare with Argentina: both sides = engine values', near(cd.first.our_record.detections_exact, f.ours.value) && near(cd.second.our_record.detections_exact, arg.ours.value) && cd.same_place === false, cd.first.our_record.detections + ' vs ' + cd.second.our_record.detections);
  }

  // ---------- unknown place ----------
  line(''); line('== Unknown place ("Atlantis")');
  for (const [tool, args] of [['fire_answer', { place: 'Atlantis' }], ['place_record', { place: 'Atlantis' }], ['how_sure', { place: 'Atlantis' }], ['report_sentence', { place: 'Atlantis' }]]) {
    const m = await call(tool, args); allText.push(textOf(m));
    check(tool + ' Atlantis: refused plainly (isError, UNKNOWN_PLACE, says what to do)', refused(m, 'UNKNOWN_PLACE') && /no "Atlantis" in this record/.test(textOf(m)) && /find_places/.test(textOf(m)), textOf(m));
  }
  // compare keeps the side that has an answer and says why the other has none (the second outside retest)
  const cAt = await call('compare', { first: { place: 'Atlantis' }, second: { place: 'Argentina' } });
  check('compare Atlantis with Argentina: Argentina\'s answer kept, Atlantis refused plainly beside it, no comparison', cAt.result.isError === false && /^Argentina, /.test(textOf(cAt)) && /no "Atlantis" in this record/.test(textOf(cAt)) && cAt.result.structuredContent.first_refusal.code === 'UNKNOWN_PLACE' && cAt.result.structuredContent.direct_comparison === null, textOf(cAt));
  const fa = await call('find_places', { query: 'Atlantis' });
  check('find_places Atlantis: no match, not an error', fa.result.isError === false && fa.result.structuredContent.total === 0, textOf(fa));
  const typo = await call('fire_answer', { place: 'Argentia' });
  check('fire_answer "Argentia": refused with a suggestion of Argentina', typo.result.isError && typo.result.structuredContent.suggestions.indexOf('Argentina') >= 0, textOf(typo));
  const alias = await call('fire_answer', { place: 'USA', period: '2024' });
  check('fire_answer "USA": an everyday name finds United States', alias.result.isError === false && alias.result.structuredContent.place_file === 'United_States', alias.result.structuredContent.place);
  const mon = await call('fire_answer', { place: 'Monaco' });
  check('fire_answer Monaco: no usable month, refused plainly', refused(mon, 'NO_USABLE_MONTHS'), textOf(mon));
  const bad = await call('fire_answer', { place: 'Argentina', period: 'blue moon' });
  check('fire_answer "blue moon": a period it cannot read, refused with how to write one', refused(bad, 'BAD_PERIOD') && /September 2020/.test(textOf(bad)), textOf(bad));

  // ---------- hard cases ----------
  line(''); line('== Hard cases');
  const ar = await eng('Argentina');
  // the team lead's ruling: no word check on the person's question; only a PERIOD in the future is refused
  const ins2 = ((await client.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'tests', version: '1' } })).result.instructions) || '';
  check('instructions keep the rule: the future as patterns to watch, never a number for it; for acting now, local authorities; NASA\'s caution word for word', /never give a number, a date or a verdict for the future/.test(ins2) && /send people to their local authorities and emergency services/.test(ins2) && /use for tactical decision-making or informing about conditions at a local scale are not advised/.test(ins2), ins2.length + ' characters');
  const tools2 = (await client.request('tools/list', {})).result.tools;
  check('no tool takes a free-text question any more (nothing to word-check)', tools2.every(t => !('question' in (t.inputSchema.properties || {}))));
  const f2020 = R.forPeriod(ar, { year: 2020 });
  for (const q of ['Was 2020 a big year for smoke in Argentina?', 'Will you show me how 2020 compared with the usual?']) {
    const m = await call('fire_answer', { place: 'Argentina', period: '2020' }); allText.push(textOf(m));   // no question field any more (unknown keys are refused); the same call a client makes for this question
    check('a fair question gets its answer ("' + q + '"): Argentina 2020, ' + R.fmt(f2020.ours.value) + ' detections, "' + f2020.ours.word + '"', m.result.isError === false && near(m.result.structuredContent.our_record.detections_exact, f2020.ours.value) && m.result.structuredContent.verdict.code === f2020.ours.word, textOf(m).split('\n')[0]);
  }
  const safe2 = await call('fire_answer', { place: 'should I evacuate Corrientes' });
  check('a sentence in the place field: an unknown place, refused plainly', refused(safe2, 'UNKNOWN_PLACE'), textOf(safe2));
  // the future (the team lead, 11:25 AM): answered with "nothing is certain, but here are the patterns to watch", never a number, date or verdict for it
  const isPatterns = (m) => m.result && m.result.isError === false && m.result.structuredContent.kind === 'patterns_to_watch' && !('verdict' in m.result.structuredContent) && /^Nothing about .+ is certain, but here are the patterns to watch\.$/.test(textOf(m).split('\n')[0]);
  const fA = await call('fire_answer', { place: 'Argentina', period: 'next season' }), tA2 = textOf(fA); allText.push(tA2);
  const aYear = R.forPeriod(ar, R.positions(ar).year), aSeason = R.forPeriod(ar, R.positions(ar).season), aMs = R.seasonMonths(ar);
  check('Argentina "next season": patterns to watch, from the record: season ' + R.MONTHS[aMs[0] - 1] + ' to ' + R.MONTHS[aMs[aMs.length - 1] - 1] + ', this year "' + aYear.ours.word + '", last season "' + aSeason.ours.word + '", big years 2020 and 2003',
    isPatterns(fA) && tA2.indexOf('from ' + R.MONTHS[aMs[0] - 1] + ' to ' + R.MONTHS[aMs[aMs.length - 1] - 1]) >= 0 && tA2.indexOf('This year is running ' + R.say(aYear.ours.word).toLowerCase()) >= 0 && tA2.indexOf('was ' + R.say(aSeason.ours.word).toLowerCase()) >= 0 && /The big years, like 2020 and 2003, came in at about double the usual/.test(tA2), tA2.split('\n').slice(1, 3).join(' | '));
  const fAu = await call('fire_answer', { place: 'Australia', period: '2027' }); allText.push(textOf(fAu));
  check('Australia 2027 (a year after the record ends): patterns to watch, not a refusal', isPatterns(fAu) && fAu.result.structuredContent.big_years.length > 0, textOf(fAu).split('\n')[0]);
  const fG = await call('fire_answer', { place: 'Niger', period: 'next year' }); allText.push(textOf(fG));
  check('Niger "next year" (weak record): patterns lead with MODIS and give no big years from our record', isPatterns(fG) && /Our own record is weak for Niger, so this goes by MODIS/.test(textOf(fG)) && fG.result.structuredContent.big_years.length === 0 && /going by MODIS/.test(textOf(fG)), textOf(fG).split('\n')[3]);
  const fM = await call('fire_answer', { place: 'Malta', period: 'next year' }); allText.push(textOf(fM));
  check('Malta "next year" (too little fire): patterns say so plainly', isPatterns(fM) && /too little fire to call|very little fire/.test(textOf(fM)), textOf(fM).split('\n').slice(1, 3).join(' | '));
  const fT = await call('fire_answer', { place: 'Greece', period: 'tomorrow' }), fD2 = await call('fire_answer', { place: 'Argentina', period: '2026-12' });
  check('"tomorrow" and December 2026 (after the record, in the future): patterns too', isPatterns(fT) && isPatterns(fD2), textOf(fD2).split('\n')[0]);
  const futNums = [tA2, textOf(fAu), textOf(fG), textOf(fM)].join('\n');
  check('patterns never give a number, a date or a verdict FOR the future period (no "will", no "expect", no future year with a count)', !/\bwill\b|\bexpect|\b2027\b.*\d{2,}|next (year|season) (will|is going)/i.test(futNums.replace(/^Nothing about .*$/gm, '')));
  const fut4 = await call('compare', { first: { place: 'Argentina' }, second: { place: 'Greece', period: 'next year' } });
  check('compare with a future period: no counts set against the future, said flatly (the present side kept)', fut4.result.isError === false && /Nothing about the future is certain/.test(textOf(fut4)) && fut4.result.structuredContent.second_refusal.code === 'FORECAST_NOT_OFFERED' && fut4.result.structuredContent.direct_comparison === null, textOf(fut4));
  // extras (the team lead: "Add both"): the wrong-way glued counts, and a season's months
  const yA = R.yearly(ar), prA = (await call('place_record', { place: 'Argentina', view: 'years' })), rowsA = prA.result.structuredContent.rows, tA = textOf(prA);
  const g = (y) => rowsA.find(x => x.year === y);
  check('place_record years: glued as-is from 2022 = Readings.yearly newerAsIs (Argentina 2022: ' + R.fmt(yA.find(y => y.year === 2022).newerAsIs) + '), none before 2022',
    yA.every(y => { const rw = g(y.year); return y.year < 2022 ? rw.glued_unadjusted_wrong_way === null : rw.glued_unadjusted_wrong_way === (y.newerAsIs === null || y.newerAsIs === undefined ? null : Math.round(y.newerAsIs)); }) && g(2022).glued_unadjusted_wrong_way === 89310, g(2022).glued_unadjusted_wrong_way);
  check('place_record years: the glued counts are labelled the wrong way, with why (2022 at 89,310 against 2020 at 45,295; 26,952 on one scale)', /WRONG way to join the cameras/.test(tA) && /2022 would read 89,310 detections, against 45,295 for 2020/.test(tA) && tA.indexOf(R.gluedCaption(ar)) >= 0, (prA.result.structuredContent.glued_note || '').slice(0, 120));
  const au = await eng('Australia'), fS = R.forPeriod(au, { season: 2019 }), ymsS = R.seasonYms(au, 2019);
  const sA = await call('fire_answer', { place: 'Australia', period: 'season 2019' }), sd = sA.result.structuredContent; allText.push(textOf(sA));
  check('fire_answer season: Australia 2019 (' + fS.periodLabel + ') reads "' + fS.ours.word + '" overall, and lists its ' + ymsS.length + ' months, each with Readings\' own answer',
    sd.verdict.code === fS.ours.word && sd.season_months.length === ymsS.length && ymsS.every((ym, k) => { const pm = R.monthPanel(au, ym); return sd.season_months[k].month === ym && sd.season_months[k].says === pm.say && sd.season_months[k].detections === Math.round(pm.f.ours.value); }), sd.season_months.length);
  const dec = sd.season_months.find(m => m.month === '2019-12'), fD = R.forPeriod(au, { month: '2019-12' });
  check('Australia December 2019 inside that season: "' + fD.ours.word + '", ' + (fD.ours.feel ? fD.ours.feel.phrase : '') + ' (' + R.fmt(fD.ours.value) + ' against ' + R.fmt(fD.ours.typical) + ')', dec && dec.verdict.code === fD.ours.word && dec.compared_with_usual === (fD.ours.feel && fD.ours.feel.phrase) && /December 2019 had about three times/.test(textOf(sA)), dec && dec.says);
  const nonSeason = await call('fire_answer', { place: 'Argentina' });
  check('a month answer carries no season list', nonSeason.result.structuredContent.season_months === null);
  // before the record starts, after it ends
  const pre = await call('fire_answer', { place: 'Argentina', period: '2000-10' });
  check('October 2000 (one month before the record): refused, says the record starts November 2000', refused(pre, 'OUT_OF_COVERAGE') && /before the record starts/.test(textOf(pre)) && /November 2000/.test(textOf(pre)), textOf(pre));
  const pre2 = await call('report_sentence', { place: 'Greece', period: '1999' });
  check('report_sentence 1999: refused the same way', refused(pre2, 'OUT_OF_COVERAGE') && /before the record starts/.test(textOf(pre2)), textOf(pre2));
  const post = await call('fire_answer', { place: 'Ghana', period: '2026-03' });
  check('Ghana March 2026 (past, but after its record ends): refused, names the newest month (December 2025)', refused(post, 'OUT_OF_COVERAGE') && /after Ghana's record ends/.test(textOf(post)) && /December 2025/.test(textOf(post)), textOf(post));
  const pm = await call('place_record', { place: 'Argentina', view: 'months', year: 1998 });
  check('place_record months 1998: refused', refused(pm, 'OUT_OF_COVERAGE'), textOf(pm));
  // almost no fire
  const mal = await eng('Malta'), fm = R.forPeriod(mal, 'latest');
  const ma = await call('fire_answer', { place: 'Malta' }), md = ma.result.structuredContent; allText.push(textOf(ma));
  check('Malta (almost no fire, ' + R.fmt(fm.ours.value) + ' detections): no verdict, said flatly', ma.result.isError === false && md.verdict === null && md.refusal && /^TOO_/.test(md.refusal.code) && /too little to call quiet or busy|too few other years|We don't know/.test(textOf(ma)), md.refusal && md.refusal.code);
  // MODIS has no count of its own
  const alb = await eng('Albania'), fa24 = R.forPeriod(alb, { year: 2024 });
  const al = await call('fire_answer', { place: 'Albania', period: '2024' }), ad = al.result.structuredContent; allText.push(textOf(al));
  check('Albania 2024 (' + R.fmt(fa24.ours.value) + ' detections, MODIS has no full-year count): our count given, MODIS "no count", never 0', fa24.olderMissing && near(ad.our_record.detections_exact, fa24.ours.value) && ad.modis_alone === null && /no count of its own/.test(ad.modis_note) && /MODIS has no count of its own/.test(textOf(al)) && !/MODIS alone: 0/.test(textOf(al)), ad.modis_note);
  const pt = await call('fire_answer', { place: 'Portugal' });
  check('Portugal latest month: MODIS has no count for these dates, said in words', /MODIS has no count of its own/.test(textOf(pt)) && pt.result.structuredContent.modis_alone === null, pt.result.structuredContent.modis_note);
  // the two cameras disagree
  const fl = R.forPeriod(ar, 'latest');
  const dis = await call('fire_answer', { place: 'Argentina' }), dd = dis.result.structuredContent, dt = textOf(dis);
  check('cameras disagree (Argentina, Nov 1–12, 2026): our "' + fl.ours.word + '" and MODIS "' + fl.older.word + '" both in the first lines, flagged to travel together', fl.ours.word !== fl.older.word && dd.cameras_agree === false && dd.both_answers_must_travel_together === true &&
    /about normal/.test(dt.split('\n')[0]) && /MODIS, NASA's older camera/.test(dt.split('\n\n')[0]) && dd.modis_alone.verdict_code === fl.older.word, dd.our_record.verdict_code + ' / ' + dd.modis_alone.verdict_code);
  const disC = await call('compare', { first: { place: 'Argentina' }, second: { place: 'Argentina', period: '2025-11' } });
  check('cameras disagree, in compare: the one-line answer still carries MODIS\'s own verdict', /MODIS alone: busier than normal/.test(textOf(disC).split('\n')[0]), textOf(disC).split('\n')[0]);
  // the clash rule (verdict from rank, phrase from ratio): when they would clash, the rank is said instead
  if (typeof R.feelFits === 'function') {
    const f15 = R.forPeriod(ar, { year: 2015 }), fits = R.feelFits(f15.ours.word, f15.ours.feel);
    const y15 = await call('fire_answer', { place: 'Argentina', period: '2015' }), t15 = textOf(y15); allText.push(t15);
    check('clash rule, Argentina 2015 ("' + f15.ours.word + '", ratio ' + f15.ours.feel.ratio.toFixed(2) + '): phrase_fits_verdict = ' + fits + '; text and structured field both give ' + (fits ? 'the ratio' : 'the rank'), y15.result.structuredContent.our_record.phrase_fits_verdict === fits && (fits || (t15.indexOf(R.rankWords(f15.ours.word, f15.ours.rank)) >= 0 && y15.result.structuredContent.our_record.compared_with_usual === R.rankWords(f15.ours.word, f15.ours.rank))), y15.result.structuredContent.our_record.compared_with_usual);
    const c15 = await call('compare', { first: { place: 'Argentina', period: '2015' }, second: { place: 'Argentina', period: '2020' } });
    check('clash rule in compare: no "about three-quarters" beside "far quieter"; the rank instead', !/far quieter than normal \(about three-quarters/.test(textOf(c15)) && (fits || textOf(c15).indexOf(R.rankWords(f15.ours.word, f15.ours.rank)) >= 0), textOf(c15).split('\n')[0]);
  } else line('(the vendored Readings has no clash rule: clash checks skipped)');
  // a past month and a season, against the engine
  const sep = await call('fire_answer', { place: 'Argentina', period: 'September 2020' }), fs20 = R.forPeriod(ar, { month: '2020-09' }); allText.push(textOf(sep));
  check('Argentina "September 2020": engine value ' + R.fmt(fs20.ours.value) + ', one answer before 2022 (no MODIS-alone line)', near(sep.result.structuredContent.our_record.detections_exact, fs20.ours.value) && sep.result.structuredContent.modis_alone === null, sep.result.structuredContent.our_record.detections);
  const sea = await call('fire_answer', { place: 'Argentina', period: 'last season' }), fse = R.forPeriod(ar, R.positions(ar).season); allText.push(textOf(sea));
  check('Argentina "last season": ' + fse.periodLabel + ', engine value ' + R.fmt(fse.ours.value), sea.result.structuredContent.period.label === fse.periodLabel && near(sea.result.structuredContent.our_record.detections_exact, fse.ours.value), sea.result.structuredContent.period.label);

  // ---------- the second family's review (CONNECTOR_REVIEW.md), one check per fault; each failed on the 11:09 build ----------
  line(''); line('== Review fixes');
  // (1) only declared tools, only known places
  for (const n of ['constructor', 'toString', '__proto__', 'hasOwnProperty']) {
    const m = await call(n, { text: 'made up', data: {} });
    check('undeclared tool "' + n + '": -32602, never run', !!(m.error && m.error.code === -32602 && !m.result), m.error || m.result);
  }
  for (const n of ['constructor', '__proto__', 'toString']) {
    const m = await call('fire_answer', { place: n });
    check('place "' + n + '": an unknown place, refused plainly (no internal error)', refused(m, 'UNKNOWN_PLACE'), textOf(m));
  }
  const cper = await call('fire_answer', { place: 'Argentina', period: 'constructor 2020' });
  check('period "constructor 2020": a period it cannot read, not a month', refused(cper, 'BAD_PERIOD'), textOf(cper));
  // (2) ids, notifications, parameters, batches
  for (const [label, id] of [['null', null], ['true', true], ['an object', {}], ['an array', [1]], ['1.5', 1.5]]) {
    const m = await client.raw({ jsonrpc: '2.0', id, method: 'ping' });
    check('id ' + label + ': -32600 Invalid Request, answered with id null', !!(m && m.error && m.error.code === -32600 && m.id === null), m);
  }
  const sid = await client.raw({ jsonrpc: '2.0', id: 'abc-1', method: 'ping' });
  check('a string id is fine and echoed', !!(sid && sid.id === 'abc-1' && sid.result), sid);
  for (const method of ['ping', 'tools/list', 'tools/call', 'no/such/method']) {
    const m = await client.raw({ jsonrpc: '2.0', method, params: {} });
    check('notification "' + method + '" (no id): no reply at all', m === null, m);
  }
  for (const [label, name, args] of [['fire_answer with no place', 'fire_answer', {}], ['fire_answer with place 5', 'fire_answer', { place: 5 }],
    ['fire_answer with period 2020 as a number', 'fire_answer', { place: 'Argentina', period: 2020 }], ['place_record with year "2020" as text', 'place_record', { place: 'Argentina', view: 'months', year: '2020' }],
    ['place_record with view "decades"', 'place_record', { place: 'Argentina', view: 'decades' }], ['find_places with query 5', 'find_places', { query: 5 }],
    ['compare without a second', 'compare', { first: { place: 'Argentina' } }], ['compare with second.place missing', 'compare', { first: { place: 'Argentina' }, second: {} }],
    ['acting_now as text', 'fire_answer', { place: 'Argentina', acting_now: 'yes' }], ['arguments as a list', 'fire_answer', ['Argentina']]]) {
    const m = await call(name, args);
    check(label + ': -32602 Invalid params, nothing run', !!(m.error && m.error.code === -32602), m.error || (m.result && m.result.content[0].text));
  }
  const i1 = await client.raw({ jsonrpc: '2.0', id: 50, method: 'initialize' });
  check('initialize with no params: -32602', !!(i1 && i1.error && i1.error.code === -32602), i1 && (i1.error || 'answered'));
  const i2 = await client.raw({ jsonrpc: '2.0', id: 51, method: 'initialize', params: { protocolVersion: 5, capabilities: {}, clientInfo: { name: 'x', version: '1' } } });
  check('initialize with a numeric protocolVersion: -32602', !!(i2 && i2.error && i2.error.code === -32602), i2 && (i2.error || 'answered'));
  const bt = await client.raw([{ jsonrpc: '2.0', id: 61, method: 'ping' }, { jsonrpc: '2.0', id: 62, method: 'ping' }]);
  check('a batch under protocol 2025-06-18 (or no negotiated version): one -32600 error, not an array of answers', !!(bt && !Array.isArray(bt) && bt.error && bt.error.code === -32600), bt);
  // (3) limits before any work
  let t0 = Date.now();
  const longP = await call('fire_answer', { place: 'x'.repeat(50000) });
  const msP = Date.now() - t0;
  check('a 50,000-character place name: -32602 at once (' + msP + ' ms, under 1,000)', !!(longP.error && longP.error.code === -32602) && msP < 1000, longP.error);
  t0 = Date.now();
  const longQ = await call('find_places', { query: 'guinea'.repeat(8000) });
  check('a 48,000-character search: -32602 at once (' + (Date.now() - t0) + ' ms)', !!(longQ.error && longQ.error.code === -32602) && Date.now() - t0 < 1000, longQ.error);
  const p41 = await call('fire_answer', { place: 'Argentinaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaaa' });
  check('a long unknown name inside the limit: refused plainly, quickly', refused(p41, 'UNKNOWN_PLACE'), textOf(p41));
  // (4) both cameras in compare; direct counts only for like spans with reliable data; the clash rule in structured fields too
  const kh = R.forPeriod(await eng('Cambodia'), { month: '2024-07' });
  const cK = await call('compare', { first: { place: 'Cambodia', period: '2024-07' }, second: { place: 'Argentina' } }), cKt = textOf(cK).split('\n').find(l => /^Cambodia, /.test(l)) || '';   // Cambodia's line (a "Different dates" line now comes first)
  check('compare, Cambodia July 2024 (our record: no verdict; MODIS: "' + (kh.older && kh.older.word) + '"): MODIS\'s answer kept', kh.lead !== 'ours' && kh.older && kh.older.word && cKt.indexOf('MODIS alone: ' + R.say(kh.older.word).toLowerCase()) >= 0, cKt);
  const cU = await call('compare', { first: { place: 'Argentina', period: '2020' }, second: { place: 'Argentina', period: '2020-01' } });
  check('compare, Argentina 2020 against January 2020 (unlike spans): no direct ratio', cU.result.structuredContent.direct_comparison === null && !/On our record, .* had .* detections/.test(textOf(cU)), textOf(cU).split('\n')[2]);
  const cW = await call('compare', { first: { place: 'Niger', period: '2025' }, second: { place: 'Niger', period: '2020' } });
  check('compare, Niger 2025 against 2020 (weak record): no direct ratio', cW.result.structuredContent.direct_comparison === null && !/On our record, .* had .* detections/.test(textOf(cW)), textOf(cW).split('\n')[2]);
  const cL = await call('compare', { first: { place: 'Argentina', period: '2020' }, second: { place: 'Argentina', period: '2025' } });
  check('compare, Argentina 2020 against 2025 (like spans, reliable): the direct ratio stays (about twice)', cL.result.structuredContent.direct_comparison !== null && /about twice the second/.test(textOf(cL)), textOf(cL).split('\n')[2]);
  if (typeof R.feelFits === 'function') {
    let clashes = 0, n = 0;
    for (let y = 2001; y <= 2025; y++) {
      const fy = R.forPeriod(ar, { year: y }); if (fy.refusal) continue;
      const m = await call('fire_answer', { place: 'Argentina', period: String(y) }), d2 = m.result.structuredContent;
      for (const [c, got] of [[fy.ours, d2.our_record], [fy.older, d2.modis_alone]]) {
        if (!c || !c.feel || !c.word) continue; n++;
        const want = R.feelFits(c.word, c.feel) ? c.feel.phrase : R.rankWords(c.word, c.rank);
        if (got.compared_with_usual !== want) clashes++;
      }
    }
    check('structured fields follow the clash rule too: Argentina 2001–2025, ' + n + ' verdict/phrase pairs, 0 where the phrase contradicts the verdict', clashes === 0 && n > 20, clashes + ' of ' + n);
  }
  // (5) place_record labels and weak-record reasons
  const yr = await call('place_record', { place: 'Argentina' }), yrt = textOf(yr), y26 = yr.result.structuredContent.rows.find(x => x.year === 2026);
  check('place_record years, Argentina 2026: "through October (finished months only)", not "so far"', y26.so_far_through === '2026-10' && /11,389 detections through October \(finished months only/.test(yrt) && !/11,389 detections so far/.test(yrt), yrt.split('\n').find(l => /^2026/.test(l)));
  const gm = await call('place_record', { place: 'Niger', view: 'months', year: 2025 }), gy = await call('place_record', { place: 'Niger' });
  check('place_record months, Niger 2025: says once why our record is unreliable', textOf(gm).split('unreliable for Niger').length === 2 && !!gm.result.structuredContent.weak_record, gm.result.structuredContent.weak_record);
  check('place_record years, Niger: says why our record is unreliable', /unreliable for Niger/.test(textOf(gy)) && !!gy.result.structuredContent.weak_record, gy.result.structuredContent.weak_record);
  // after the engine repair (Nov 14, 2 PM): Ghana is on twelve numbers and its record holds up; answers there lead with our record
  const gT = await call('how_sure', { place: 'Ghana' }), gD = await call('fire_answer', { place: 'Ghana', period: 'December 2025' });
  check('Ghana after the repair: how_sure says "This holds up" (about 14%) and answers lead with our record; December 2025 comes from our record', /^This holds up: .*within about 14%/.test(textOf(gT)) && gT.result.structuredContent.answers_lead_with === 'our record' && gD.result.structuredContent.verdict.from === 'our record' && gD.result.structuredContent.verdict.code === 'much quieter', textOf(gT).split(String.fromCharCode(10))[0]);
  const ic = await call('place_record', { place: 'Iceland', view: 'months', year: 2015 });
  check('place_record months, Iceland 2015: a missing count reads "no data", never "no data detections"', /\[no data/.test(textOf(ic)) && !/no data detections/.test(textOf(ic)), textOf(ic).split('\n').find(l => /no data/.test(l)));

  // ---------- full strength, no hedging (the team lead, 11:18 and 11:20 AM) ----------
  line(''); line('== Voice: answer first, call a fire a fire, no hedging');
  const HEDGE = /\b(may|might|could|possibly|appears?|seems?)\b|important to note|please be aware|keep in mind|\bI can['’]t\b|as an AI/i;
  const HEDGE_LC = /\b(may|might|could|possibly|appears?|seems?)\b|important to note|please be aware|keep in mind|\bI can['’]t\b|as an AI/;   // "May" the month is fine
  const ins3 = ((await client.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'tests', version: '1' } })).result.instructions) || '';
  const toolText = (await client.request('tools/list', {})).result.tools.map(t => t.description + ' ' + JSON.stringify(t.inputSchema)).join(' ');
  check('instructions and tool descriptions never discourage the word "fire"', !/never "fires"|say "detections"|not "fires"|avoid (the word )?"?fires?|don't call it a fire|not call it a fire/i.test(ins3 + ' ' + toolText), (ins3.match(/never "fires"|say "detections"/i) || [''])[0]);
  check('instructions tell the assistant to call a fire a fire and never refuse or lecture about it', /"fire", "fires", "burning" and "active fire" are the right words/.test(ins3) && /Never refuse, hedge or lecture/.test(ins3));
  check('instructions carry no sentence telling the assistant to add caveats or disclaimers', !/(add|include|append|attach) (a |any |the )?(caveat|disclaimer|warning)s?\b(?! to ordinary)|always (mention|remind|warn)|remind (the user|people)/i.test(ins3), ins3.length + ' characters');
  check('instructions and tool descriptions use no hedge words', !HEDGE_LC.test(ins3 + ' ' + toolText), ((ins3 + ' ' + toolText).match(HEDGE_LC) || [''])[0]);
  check('NASA\'s caution, word for word, once in the instructions', ins3.split(FIRE.NASA_CAUTION).length === 2);
  const plain = await call('fire_answer', { place: 'Australia', period: '2019-12' }), act = await call('fire_answer', { place: 'Australia', period: '2019-12', acting_now: true });
  check('an ordinary answer carries no safety or forecast caveat', textOf(plain).indexOf(FIRE.ACT_LINE) < 0 && !/local authorities|NASA advises|not advised|forecast/.test(textOf(plain)), textOf(plain).split('\n').pop());
  check('a request about acting now (acting_now): the answer first, then ONE line pointing to local authorities', textOf(act).split('\n')[0] === textOf(plain).split('\n')[0] && textOf(act).split(FIRE.ACT_LINE).length === 2, FIRE.ACT_LINE);
  const hsA = await call('how_sure', { place: 'Argentina' });
  check('how_sure carries NASA\'s caution word for word, and states a strong result as strong ("This holds up")', textOf(hsA).indexOf(FIRE.NASA_CAUTION) >= 0 && /^This holds up: /.test(textOf(hsA)), textOf(hsA).split('\n')[0].slice(0, 60));
  const aus = await call('fire_answer', { place: 'Australia', period: 'December 2019' });
  check('a strong result is said as strong: "Australia\'s December 2019 was far busier than normal, with about three times the usual amount of fire."', textOf(aus).split('\n')[0] === 'Australia\'s December 2019 was far busier than normal, with about three times the usual amount of fire.', textOf(aus).split('\n')[0]);
  // every answer template, every place: no hedge words; at most two qualifiers; ends on the next question, never a warning
  const L2 = await E.open({ base: BASE }), every = E.countries(L2);
  let calls = 0, hedges = [], tooMany = [], badEnds = [];
  for (const P of every) {
    for (const [name, args] of [['fire_now', { place: P }], ['fire_answer', { place: P }], ['fire_answer', { place: P, period: 'this year' }], ['fire_answer', { place: P, period: 'last season' }],
      ['report_sentence', { place: P }], ['how_sure', { place: P }], ['place_record', { place: P }]]) {
      const m = await call(name, args); calls++;
      const t2 = textOf(m);
      if (HEDGE_LC.test(t2)) hedges.push(name + ' ' + P + ': ' + (t2.match(HEDGE_LC) || [''])[0]);
      if (name === 'fire_answer' && m.result && !m.result.isError) {
        const q = t2.split('\n').filter(l => /^(The two cameras disagree|Early data:|Our own record is weak)/.test(l)).length;
        if (q > 2) tooMany.push(P + ' ' + (args.period || 'latest') + ': ' + q);
        const last = t2.trim().split('\n').pop();
        if (!/\?$/.test(last) || /local authorities|caution|advise/.test(last)) badEnds.push(P + ': ' + last);
      }
    }
  }
  check('hedge-word scan over every answer template for all ' + every.length + ' places (' + calls + ' calls): zero hits', hedges.length === 0, hedges.slice(0, 3));
  check('qualifier sentences per answer: never more than two (cameras disagree / early data / weak record)', tooMany.length === 0, tooMany.slice(0, 3));
  check('every answer ends by offering the natural next question, never a warning', badEnds.length === 0, badEnds.slice(0, 3));

  // ---------- NASA-direct tools, wired in (NASA_DIRECT.md); fire_now; the rest of the delight pass ----------
  // These suites run the server with FIRE_CONNECTOR_NASA_FIXTURES (NASA's saved South America files) and a fixed clock: no network.
  line(''); line('== NASA-direct tools and fire_now');
  const insN = ((await client.request('initialize', { protocolVersion: '2025-06-18', capabilities: {}, clientInfo: { name: 'tests', version: '1' } })).result.instructions) || '';
  check('instructions carry NASA\'s paragraph and the fire_now guidance (call fire_now for "right now"; the unit once per conversation; city to country)', insN.indexOf(FIRE_NASA.INSTRUCTIONS) >= 0 && /call fire_now/.test(insN) && /once in a conversation/.test(insN) && /Córdoba is in Argentina/.test(insN), insN.length + ' characters');
  const nr = await call('nasa_recent', { place: 'Argentina' }), nrd = nr.result && nr.result.structuredContent;
  check('nasa_recent through the connector: NASA\'s own counts per camera for Argentina (from the saved files)', !!(nr.result && nr.result.isError === false && nrd.cameras.length >= 2 && nrd.cameras.every(c => Number.isInteger(c.detections))), nrd && nrd.cameras.map(c => c.camera + ' ' + c.detections).join(', '));
  const ns = await call('nasa_sources', {});
  check('nasa_sources through the connector: NASA\'s caution word for word and the live map', !!(ns.result && !ns.result.isError && textOf(ns).indexOf(FIRE.NASA_CAUTION) >= 0 && /firms\.modaps\.eosdis\.nasa\.gov\/map/.test(textOf(ns))), textOf(ns).slice(0, 60));
  const na = await call('nasa_archive', { place: 'Greece', from: '2025-08-01', to: '2025-08-05' });
  check('nasa_archive with no key on this connector: says how a person gets their own key', !!(na.result && na.result.isError && na.result.structuredContent.refusal.code === 'NEEDS_KEY' && /FIRMS_MAP_KEY/.test(textOf(na))), textOf(na).slice(0, 80));
  for (const [label, name, args] of [['nasa_recent with an argument it doesn\'t take', 'nasa_recent', { place: 'Argentina', extra: 1 }], ['nasa_recent with a 3-number box', 'nasa_recent', { box: [1, 2, 3] }],
    ['nasa_recent with a text box', 'nasa_recent', { box: 'north of here' }], ['nasa_recent with window "1y"', 'nasa_recent', { place: 'Argentina', window: '1y' }], ['nasa_recent with a 50,000-character place', 'nasa_recent', { place: 'y'.repeat(50000) }],
    ['nasa_archive without dates', 'nasa_archive', { place: 'Greece' }], ['nasa_sources with an argument', 'nasa_sources', { a: 1 }], ['fire_now with no place', 'fire_now', {}], ['fire_now with place 5', 'fire_now', { place: 5 }]]) {
    const m = await call(name, args);
    check(label + ': -32602 Invalid params, nothing fetched', !!(m.error && m.error.code === -32602), m.error || (m.result && m.result.content[0].text));
  }
  for (const n of ['constructor', '__proto__']) { const m = await call('nasa_recent', { place: n }); check('nasa_recent place "' + n + '": an unknown place, refused plainly', !!(m.result && m.result.isError && m.result.structuredContent.refusal.code === 'UNKNOWN_PLACE'), textOf(m).slice(0, 60)); }
  // fire_now: NASA's last 24 hours and the record's answer, one camera's count (never MODIS plus VIIRS), "normal" only from the record
  const fnA = await call('fire_now', { place: 'Argentina' }), fdA = fnA.result.structuredContent, ftA = textOf(fnA);
  const maxCam = nrd.cameras.slice().sort((a, b) => b.detections - a.detections)[0];
  const recFirst = textOf(await call('fire_answer', { place: 'Argentina' })).split('\n')[0];
  // the observed fact first, with its real scope (the box around the country takes in nearby areas): the persona round's fix
  check('fire_now Argentina: the observed fact first ("NASA\'s 24-hour file shows fire N times in the box around Argentina, which takes in nearby areas (camera), observed between two UTC times; M of them in the 24 hours before it was fetched") with one camera\'s count in the file (' + maxCam.camera + ' ' + maxCam.detections + ', ' + maxCam.within_window_before_fetch + ' in the 24 hours before the fetch), then the record\'s answer for early November',
    fdA.kind === 'fire_now' && /^NASA's 24-hour file shows fire [\d,]+ times in the box around Argentina, which takes in nearby areas \([^)]+\), observed between \d\d[:]\d\d UTC \w+ \d+ and \d\d[:]\d\d UTC \w+ \d+; ([\d,]+|all|none) of them in the 24 hours before it was fetched\./.test(ftA) && fdA.nasa_last_24h.seen.detections === maxCam.detections && fdA.nasa_last_24h.seen.within_window_before_fetch === maxCam.within_window_before_fetch && ftA.indexOf(maxCam.detections.toLocaleString('en-US') + ' times') > 0 && ftA.indexOf('On the 26-year record, ' + recFirst) >= 0, ftA.split('\n').slice(0, 2).join(' | '));
  check('fire_now Argentina: the newest detection said as time ("about N hours ago"), the record\'s qualifiers kept (cameras split, early data), and a next question last', /[Tt]he newest (was )?about \d+ (hours|minutes) ago/.test(ftA) && /The two cameras disagree here/.test(ftA) && /Early data/.test(ftA) && ftA.trim().split('\n').pop() === fdA.next_questions[0].text, fdA.next_questions[0].text);
  const fnC = await call('fire_now', { place: 'Chile' }), ftC = textOf(fnC);
  check('fire_now Chile (record ends December 2025): NASA\'s count, then "we don\'t know" whether that\'s a lot, and when its season runs; no verdict for now', !fnC.result.isError && /we don't know: our 26-year record for Chile runs to December 2025/.test(ftC) && /fire season usually runs from/.test(ftC) && !/normal/.test(ftC.split('\n').slice(1).join(' ').replace(/Want.*$/, '')), ftC.split('\n')[1]);
  const fnR = await call('fire_now', { place: 'Reunion' });
  check('fire_now Réunion (no box for NASA\'s files): says so plainly and still gives what the record knows', !fnR.result.isError && /no count from NASA's 24-hour file here/.test(textOf(fnR)) && /runs to/.test(textOf(fnR)), textOf(fnR).split('\n')[0]);
  const fnU = await call('fire_now', { place: 'Atlantis' });
  check('fire_now Atlantis: an unknown place, refused before any fetch', refused(fnU, 'UNKNOWN_PLACE'), textOf(fnU).slice(0, 60));
  const fnX = await call('fire_now', { place: 'Argentina', acting_now: true });
  check('fire_now acting_now: the answer first, then one line with local authorities and NASA\'s live map', textOf(fnX).split('\n')[0] === ftA.split('\n')[0] && textOf(fnX).indexOf(FIRE.ACT_LINE) >= 0 && /firms\.modaps\.eosdis\.nasa\.gov\/map/.test(textOf(fnX)) && ftA.indexOf(FIRE.ACT_LINE) < 0, '');
  allText.push(ftA, ftC, textOf(fnR));
  // delight: the strip, places the way people say them
  const st = await call('place_record', { place: 'Argentina', view: 'months', year: 2020 }), std = st.result.structuredContent;
  check('place_record months: the year as a strip of bars any chat program shows (J F M A M J J A S O N D, then 12 bars; August 2020 the tallest)', /^J F M A M J J A S O N D\n(\S ){11}\S$/.test(std.strip) && std.strip.split('\n')[1].split(' ')[7] === '█' && textOf(st).indexOf(std.strip) >= 0, std.strip.split('\n')[1]);
  const se = await call('fire_answer', { place: 'Australia', period: 'season 2019' });
  check('fire_answer season: the season as a strip, and the months that stood out (December 2019, about three times the usual)', /^A M J J A S O N D$/m.test(textOf(se)) && /December 2019 had about three times the usual fire/.test(textOf(se)), textOf(se).split('\n').slice(2, 5).join(' | '));
  const tl = (await client.request('tools/list', {})).result.tools;
  check('every place argument tells the assistant to turn a city, park or province into its country, and to say so', tl.filter(t => t.inputSchema.properties && t.inputSchema.properties.place && !/^nasa_/.test(t.name)).every(t => /Córdoba is in Argentina/.test(t.inputSchema.properties.place.description)));

  // ---------- wording guards ----------
  line(''); line('== Wording guards over all ' + allText.length + ' texts returned');
  const joined = allText.join('\n');
  check('no number is called "fires" (e.g. "550 fires")', !/\b\d[\d,]*\s+(?:individual\s+)?fires\b/i.test(joined), (joined.match(/\b\d[\d,]*\s+fires\b/i) || [''])[0]);
  check('no hectares, no acres, no forecast claims ("will burn", "we expect", "forecast" other than "doesn\'t forecast" and "no forecast")', !/hectare|acre|will burn|we expect/i.test(joined) && !/forecast/i.test(joined.replace(/doesn't forecast|no forecast/g, '')));
  check('no safety advice beyond pointing to local authorities ("evacuate", "stay safe")', !/evacuat|stay safe/i.test(joined));
  check('no machine path or stack trace in any text', !/[A-Za-z]:\\|\/home\/|\/var\/|\bat .*\.cjs:\d+/.test(joined));
  check('no hedge words in any text returned (may, might, could, possibly, appears, seems, important to note, please be aware, keep in mind, I can\'t, as an AI)', !HEDGE_LC.test(joined), (joined.match(HEDGE_LC) || [''])[0]);
}
module.exports = { runChecks };
