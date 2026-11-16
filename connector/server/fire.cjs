// fire.cjs: the six tools' answers, read from the vendored engine and Readings (../vendor).
// Every number comes from HSEngine.query or Readings at run time; the only words typed here are glue and the plain refusals.
'use strict';
const path = require('path');
const VENDOR = path.resolve(__dirname, '..', 'vendor');
const BASE = path.join(VENDOR, 'parts', 'engine_and_data');
const E = require(path.join(BASE, 'engine', 'hs_engine.js'));
const R = require(path.join(VENDOR, 'js', 'readings.js'));
const WORLD = require(path.join(VENDOR, 'data', 'world_table.json'));

const MONTHS = R.MONTHS;
const cap1 = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const lower1 = (s) => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
const round = (v) => v === null || v === undefined || !isFinite(v) ? null : Math.round(v);
const round1 = (v) => v === null || v === undefined || !isFinite(v) ? null : Math.round(v * 10) / 10;

// a refusal the tools hand back plainly (not a crash): code + message + optional help
class Refusal extends Error { constructor(code, message, extra) { super(message); this.code = code; this.extra = extra || {}; } }

// ---------- the layer and per-place results, loaded once ----------
let layerP = null; const cache = new Map();
function layer() { if (!layerP) layerP = E.open({ base: BASE }); return layerP; }
async function result(file) {
  if (!cache.has(file)) cache.set(file, (async () => { const L = await layer(); const r = await E.query({ country: file }, L); await R.loadAvailability(L, r); return r; })());
  try { return await cache.get(file); } catch (e) { cache.delete(file); throw e; }
}

// ---------- places: NASA's file names, display names and a few everyday names ----------
const norm = (s) => String(s || '').normalize('NFD').replace(/[̀-ͯ]/g, '').toLowerCase().replace(/[_\-'’.,()]/g, ' ').replace(/^the\s+/, '').replace(/\s+/g, ' ').trim();
const ALIASES = new Map(Object.entries({ 'usa': 'United_States', 'us': 'United_States', 'united states of america': 'United_States', 'america': 'United_States', 'uk': 'United_Kingdom',
  'britain': 'United_Kingdom', 'great britain': 'United_Kingdom', 'russia': 'Russian_Federation', 'south korea': 'Republic_of_Korea', 'korea': 'Republic_of_Korea',
  'north korea': 'Dem_Rep_Korea', 'drc': 'Democratic_Republic_of_the_Congo', 'dr congo': 'Democratic_Republic_of_the_Congo', 'congo kinshasa': 'Democratic_Republic_of_the_Congo',
  'congo brazzaville': 'Republic_of_Congo', 'ivory coast': 'Cote_d_Ivoire', 'laos': 'Lao_PDR', 'eswatini': 'Swaziland', 'north macedonia': 'Macedonia_Former_Yugoslav_Republic_of',
  'burma': 'Myanmar', 'czechia': 'Czech_Republic', 'turkiye': 'Turkey', 'east timor': 'Timor-Leste', 'uae': 'United_Arab_Emirates', 'gambia': 'The_Gambia' }));
let placeIndex = null;
async function places() {
  if (placeIndex) return placeIndex;
  const L = await layer(), files = E.countries(L), byKey = new Map(), list = [];
  const rows = new Map(WORLD.rows.map(w => [w.file, w]));
  for (const f of files) {
    const name = R.displayName(f); list.push({ file: f, name, row: rows.get(f) || null });
    for (const k of [norm(f), norm(name), norm(name.replace(/\s*\([^)]*\)\s*$/, ''))]) if (k && !byKey.has(k)) byKey.set(k, f);
    const alias = /\(([^)]*)\)/.exec(name); if (alias && !byKey.has(norm(alias[1]))) byKey.set(norm(alias[1]), f);
  }
  for (const [k, f] of ALIASES) if (files.indexOf(f) >= 0 && !byKey.has(k)) byKey.set(k, f);
  placeIndex = { byKey, list, files };
  return placeIndex;
}
function distance(a, b) {
  const m = a.length, n = b.length, d = Array.from({ length: m + 1 }, (_, i) => [i].concat(new Array(n).fill(0)));
  for (let j = 1; j <= n; j++) d[0][j] = j;
  for (let i = 1; i <= m; i++) for (let j = 1; j <= n; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1));
  return d[m][n];
}
const MAX_NAME = 80, MAX_SUGGEST = 40;   // characters: longer names are refused before any lookup; suggestions only for short ones
async function suggest(q, k) {
  if (typeof q !== 'string' || q.length > MAX_SUGGEST) return [];
  const P = await places(), nq = norm(q);
  if (!nq || nq.length > MAX_SUGGEST) return [];
  const scored = P.list.map(p => { const n = norm(p.name); return { p, s: n.indexOf(nq) >= 0 || nq.indexOf(n) >= 0 ? 0 : distance(nq, n) }; });
  return scored.filter(x => x.s <= Math.max(2, Math.floor(nq.length / 3))).sort((a, b) => a.s - b.s || (a.p.name < b.p.name ? -1 : 1)).slice(0, k || 5).map(x => x.p.name);
}
async function resolvePlace(q) {
  if (typeof q !== 'string' || !q.trim()) throw new Refusal('BAD_REQUEST', 'Say which place: a country name, for example "Argentina".');
  if (q.length > MAX_NAME) throw new Refusal('BAD_REQUEST', 'That place name is too long (at most ' + MAX_NAME + ' characters).');
  const P = await places(), f = P.byKey.get(norm(q));
  if (f) return f;
  // the name is a whole word inside two to five place names ("Congo", "Guinea"): ask which one, naming only those
  const nq = norm(q), word = new RegExp('(^| )' + nq.replace(/[.*+?^${}()|[\]\\]/g, '\\$&') + '( |$)');
  const whole = nq.length >= 3 ? P.list.filter(p => word.test(norm(p.name))) : [];
  if (whole.length >= 2 && whole.length <= 5) throw new Refusal('AMBIGUOUS_PLACE', 'Which one? "' + q.trim().slice(0, MAX_NAME) + '" could be ' + whole.map(p => '"' + p.name + '"').join(' or ') + '.', { suggestions: whole.map(p => p.name) });
  const s = await suggest(q, 5);
  throw new Refusal('UNKNOWN_PLACE', 'There is no "' + q.trim().slice(0, MAX_NAME) + '" in this record. It covers ' + P.files.length + ' countries and territories by NASA\'s own names' +
    (s.length ? '; did you mean ' + s.map(x => '"' + x + '"').join(', ') + '?' : '; the find_places tool lists them.'), { suggestions: s });
}

// ---------- the future: a PERIOD in the future is refused (the team lead's ruling: no word check on the person's question) ----------
const FUTURE = /\b(next|tomorrow|coming|upcoming|future|forecasts?|forecasting|predict\w*)\b/i;
const isFuture = (e) => e && e.message === 'future' && e.label !== undefined;
// NASA's own caution and the pointer to local authorities: in the instructions, in how_sure, in a future-period refusal, and in an answer only when
// the assistant says the person is asking what to do right now, where to go, or what will happen (acting_now); never stacked onto every answer
const NASA_CAUTION = 'Due to the spatial resolution and other characteristics of these data, their use for tactical decision-making or informing about conditions at a local scale are not advised.';
const CAUTION = 'For decisions on the ground, right now, use local authorities and emergency services: this is a record of where satellites detected fire, not a live map. NASA\'s own caution about these data: "' + NASA_CAUTION + '"';
function futureLine(r) { const pos = r ? R.positions(r) : null; return 'Nothing about the future is certain, so there\'s no number for it here.' + (pos && pos.latestYm ? ' The newest dates for ' + R.inSentence(R.displayName(r.area.country)) + ' are ' + monthName(pos.latestYm) + '; ask fire_answer about the future for the patterns to watch.' : ''); }
// a period outside a place's record, said plainly: before it starts, after it ends, or in the future
// today's month (the test clock FIRE_CONNECTOR_NOW wins when set, so tests and NASA's tools share one clock)
function nowDate() { const t = process.env.FIRE_CONNECTOR_NOW ? new Date(process.env.FIRE_CONNECTOR_NOW) : new Date(); return isNaN(t) ? new Date() : t; }
function thisMonth() { const d = nowDate(); return d.getUTCFullYear() + '-' + String(d.getUTCMonth() + 1).padStart(2, '0'); }
const thisYear = () => nowDate().getUTCFullYear();
// how far ahead a period may be and still get "the patterns to watch": next year at most; beyond that, it is simply outside the record
function farFuture(sel) { const y = sel ? (sel.month ? +sel.month.slice(0, 4) : sel.year !== undefined ? sel.year : sel.season !== undefined ? sel.season : null) : null; return y !== null && y > thisYear() + 1; }
function coverageRefusal(r, place, sel) {
  const lo = sel && sel.month ? sel.month : sel && sel.year !== undefined ? sel.year + '-12' : sel && sel.season !== undefined ? sel.season + '-12' : null;
  const hi = sel && sel.month ? sel.month : sel && sel.year !== undefined ? sel.year + '-01' : sel && sel.season !== undefined ? sel.season + '-01' : null;
  const runs = ' ' + place + '\'s record runs from ' + monthName(r.record_starts) + ' to ' + monthName(r.record_ends) + '.';
  const extra = { place, record_starts: r.record_starts, record_ends: r.record_ends };
  if (hi && hi > thisMonth() && farFuture(sel)) return new Refusal('OUT_OF_COVERAGE', 'That\'s far past the record, which runs to ' + monthName(r.record_ends) + '. For what to watch in the coming season, ask about "next season".' + runs, extra);
  if (hi && hi > thisMonth()) return new FuturePeriod(futureLabel(null, sel));
  if (lo && lo < r.record_starts) return new Refusal('OUT_OF_COVERAGE', 'That is before the record starts: satellite fire detections are counted here only from ' + monthName(r.record_starts) + '.' + runs, extra);
  if (hi && hi > r.record_ends) return new Refusal('OUT_OF_COVERAGE', 'That is after ' + R.inSentence(place) + '\'s record ends: the newest month in it is ' + monthName(r.record_ends) + '.' + runs, extra);
  return new Refusal('OUT_OF_COVERAGE', 'Those dates are outside the record.' + runs, extra);
}

// ---------- periods: "latest", "this year", "last season", "2025", "2025-08", "August 2025", "season 2024" ----------
const MON = new Map(); MONTHS.forEach((m, i) => { MON.set(m.toLowerCase(), i + 1); MON.set(m.slice(0, 3).toLowerCase(), i + 1); }); MON.set('sept', 9);
// Spanish month names too (Argentina's record is the deepest), e.g. "noviembre de 2025"
['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio', 'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'].forEach((m, i) => MON.set(m, i + 1)); MON.set('setiembre', 9);
function parsePeriod(r, p) {
  if (p !== undefined && p !== null && String(p).length > 40) throw new Refusal('BAD_PERIOD', 'That period is too long to read (at most 40 characters).');
  const s = String(p === undefined || p === null ? 'latest' : p).trim().toLowerCase().replace(/\s+/g, ' ')
    .replace(/^([a-z]+) de (\d{4})$/, '$1 $2')                                   // "noviembre de 2025"
    // "season 2019-20" -> the season that starts in 2019; only when the second year follows the first ("season 2019-25" is not read)
    .replace(/^((?:fire )?season )?(\d{4})[-–\/](\d{2}|\d{4})( (?:fire )?season)?$/, (x, a, y, z, b) => (a || b) && (z.length === 2 ? +z === (+y + 1) % 100 : +z === +y + 1) ? 'season ' + y : x);
  const pos = R.positions(r);
  if (FUTURE.test(s)) throw new FuturePeriod(futureLabel(p, null));
  if (s === '' || /^(latest|now|today|latest month|this month|current|recent)$/.test(s)) return 'latest';
  if (/^(this year|year|year so far|so far this year|last full year|latest year)$/.test(s)) { if (!pos.year) throw new Refusal('OUT_OF_COVERAGE', 'This place has no year to show in this record.'); return pos.year; }
  if (/^(season|fire season|last season|last fire season|this season|this fire season|latest season)$/.test(s)) { if (!pos.season) throw new Refusal('NO_SEASON', 'This place has no finished fire season in this record.'); return pos.season; }
  let m;
  if ((m = /^(\d{4})-(\d{1,2})$/.exec(s))) { const mo = +m[2]; if (mo < 1 || mo > 12) throw badPeriod(p); return { month: m[1] + '-' + (mo < 10 ? '0' : '') + mo }; }
  if ((m = /^(\d{4})$/.exec(s))) return { year: +m[1] };
  if ((m = /^(?:(?:the )?(?:fire )?season(?: of| starting(?: in)?)? (\d{4})|(\d{4}) (?:fire )?season)$/.exec(s))) return { season: +(m[1] || m[2]) };
  if ((m = /^([a-z]+)\.? (\d{4})$/.exec(s)) && MON.has(m[1])) { const mo = MON.get(m[1]); return { month: m[2] + '-' + (mo < 10 ? '0' : '') + mo }; }
  throw badPeriod(p);
}
function badPeriod(p) { return new Refusal('BAD_PERIOD', 'I can\'t read the period "' + String(p).slice(0, 40) + '". Use "latest", "this year", "last season", a year like "2020", a month like "2020-09" or "September 2020", or "season 2020".'); }
function selName(sel) { return sel === 'latest' ? 'latest' : sel.month ? sel.month : sel.season !== undefined ? 'season ' + sel.season : String(sel.year); }

// ---------- one answer (the core of tools 1 and 6) ----------
function rowOf(r, ym) { return ym ? r.monthly.find(x => x.ym === ym) || null : null; }
function verdictOf(f) {
  if (f.lead === 'ours') return { code: f.ours.word, words: R.say(f.ours.word), from: 'our record' };
  if (f.lead === 'modis') return { code: f.older.word, words: R.say(f.older.word), from: 'MODIS alone' };
  return null;
}
function noVerdictRefusal(f) {
  if (f.lead === 'ours' || f.lead === 'modis') return null;
  if (f.ours.value === null && !f.older) return { code: 'NO_DATA', message: 'There is no data for these dates, so there is no verdict.' };
  if (f.ours.fewYears) return { code: 'TOO_FEW_YEARS', message: 'Too few other years with data to compare with, so there is no verdict.' };
  if ((f.tooFew || f.ours.tooFew) && f.ours.why === 'usual') return { code: 'USUAL_TOO_SMALL', message: 'These dates are usually too quiet here for a reliable comparison, so there is no verdict.' };
  if (f.tooFew || f.ours.tooFew) return { code: 'TOO_LITTLE_FIRE', message: 'Too little fire to judge, so there is no verdict.' };
  if (f.ours.weak) return { code: 'RECORD_UNRELIABLE_HERE', message: 'Our record is unreliable here and MODIS gives no verdict of its own, so there is no verdict.' };
  return { code: 'NO_FAIR_ANSWER', message: 'No fair answer for these dates.' };
}
// the phrase that goes with a verdict: the felt ratio when it fits the verdict, else the rank said plainly (Readings' clash rule, when present)
function fits(word, fl) { return typeof R.feelFits === 'function' ? R.feelFits(word, fl) : true; }
function phrase(c, word, its) {
  if (!c || !c.feel) return null;
  if (!word || fits(word, c.feel)) return its ? R.itsFeel(c.feel.phrase) : c.feel.phrase;
  return (typeof R.rankWords === 'function' && R.rankWords(word, c.rank)) || null;
}
// how the two cameras' verdicts relate: 'same', 'same_direction' (both more, or both less, at different strength), 'different_direction',
// 'not_comparable' (one or both give no verdict), or null when MODIS has no count of its own. One status feeds the text and every flag.
const SEV = { 'much quieter': -2, 'quieter': -1, 'about usual': 0, 'busier': 1, 'much busier': 2 };
function agreement(f) {
  if (!f.older) return null;
  const a = f.ours && f.ours.word, b = f.older.word;
  if (!a || !b) return 'not_comparable';
  if (a === b || f.sameWord) return 'same';
  return Math.sign(SEV[a]) === Math.sign(SEV[b]) ? 'same_direction' : 'different_direction';
}
const mustTravel = (f) => { const g = agreement(f); return g === 'same_direction' || g === 'different_direction' || (g === 'not_comparable' && !!((f.ours && f.ours.word) || f.older.word)); };
function camera(c, label) {
  if (!c) return null;
  return { label, detections: round(c.value), detections_exact: c.value, usual: round1(c.typical), years_compared: c.years, verdict_code: c.word || null, verdict_words: R.say(c.word),
    compared_with_usual: phrase(c, c.word, false), percent_vs_usual: c.feel ? c.feel.pct : null, too_little_to_judge: !!c.tooFew,
    // what the verdict word rests on: where this count ranks among the other years for the same dates (the felt phrase is the ratio to the median)
    verdict_basis: c.word ? { rule: 'rank among the other years for the same dates', rank_fraction: typeof c.rankFraction === 'number' ? Math.round(c.rankFraction * 1000) / 1000 : null, other_years: c.years, usual_is: 'the median of those years' } : null,
    phrase_fits_verdict: c.feel && c.word ? fits(c.word, c.feel) : null, said_as: phrase(c, c.word, false) };
}
// ---------- the voice (the team lead, 11:18 and 11:20 AM; the delight pass, 11:40 AM) ----------
// A sentence first, said as a fact; at most the qualifiers that change the conclusion; one number worth remembering; the next question from the data.
// The unit is not repeated in every answer: it rides in the structured result, in how_sure and nasa_sources, and the instructions say it once.
const UNIT = 'A detection is one 5 km patch of ground where a satellite saw fire on one day, so one big fire counts many times.';
const ACT_LINE = 'For what to do right now, go by local authorities and emergency services: NASA advises against using these data for decisions on the ground.';
const side = (w) => w === 'much quieter' || w === 'quieter' ? -1 : w === 'busier' || w === 'much busier' ? 1 : 0;
const yOf = (ym) => +String(ym).slice(0, 4), moOf = (ym) => +String(ym).slice(5, 7);
function whenWords(f) {
  if (f.kind === 'month') return f.partial ? 'in ' + R.periodWords(f) : 'in ' + MONTHS[moOf(f.ym) - 1] + ' ' + yOf(f.ym);
  if (f.kind === 'yearSoFar') return 'so far this year' + (spanOf(f) ? ' (' + spanOf(f) + ')' : '');
  if (f.kind === 'year') return 'in ' + f.year;
  return 'in ' + R.periodWords(f);
}
// the dates inside a label such as "2026 so far (January 1 to November 12)"
function spanOf(f) { const m = /\(([^)]*\d[^)]*)\)/.exec(f.periodLabel || ''); return m ? m[1] : null; }
// "Argentina's", "the United States'": the place as the subject of a sentence
function possessive(f) { const n = cap1(f.placeIn); return /s$/.test(n) ? n + '\'' : n + '\'s'; }
function periodNoun(f) {
  if (f.kind === 'month') return f.partial ? R.periodWords(f) : MONTHS[moOf(f.ym) - 1] + ' ' + yOf(f.ym);
  if (f.kind === 'yearSoFar') return 'year so far';
  if (f.kind === 'year') return String(f.year);
  return f.year + ' fire season (' + f.season.span + ')';
}
// "almost exactly the usual amount of fire" when the ratio fits the verdict; else the rank ("less fire than all but 2 of the 24 other years")
function amount(c, word, its) {
  if (!c || !c.feel) return null;
  if (!word || fits(word, c.feel)) return R.amountOf(c.feel.phrase, its ? 'its' : undefined);
  return (typeof R.rankWords === 'function' && R.rankWords(word, c.rank)) || null;
}
// the one, two or zero qualifiers that change what a sensible person would conclude, each one sentence, said as a fact
function qualifiers(f) {
  const q = [];
  if (f.lead === 'modis') q.push('Our own record is weak for ' + f.placeIn + ', so this goes by MODIS.');
  else if (f.lead === 'ours' && f.older && !f.sameWord && f.older.word && side(f.older.word) !== side(f.ours.word)) {
    const pm = amount(f.older, f.older.word, true);
    q.push('The two cameras disagree here: MODIS, NASA\'s older camera, on its own calls it ' + lower1(R.say(f.older.word)) + (pm ? ', with ' + pm : '') + '.');
  }
  if (f.early) q.push(f.partial && f.kind === 'month' ? 'Early data: days 1 to ' + f.days + ' from NASA\'s rapid feed, set against the same days in other years.' : 'Early data: the newest months come from NASA\'s rapid feed, and the final numbers come later.');
  return q;
}
// a count worth remembering: two significant figures from 100 up ("about 13,000"), exact below
function memorable(v) {
  if (v === null || v === undefined || !isFinite(v)) return null;
  if (v < 100) return R.fmt(v);
  const p = Math.pow(10, Math.floor(Math.log10(v)) - 1);
  return 'about ' + (Math.round(v / p) * p).toLocaleString('en-US');
}
const fireDetections = (s) => s + ' fire detection' + (s === '1' ? '' : 's');
// a year or a season as a strip of bars, for any chat program: "J F M A M J J A S O N D" over "▂▂▂▁▁▁▂▅▃▂▁▁"
const BARS = '▁▂▃▄▅▆▇█';
function strip(values, letters) {
  const max = Math.max(0, ...values.filter(v => v !== null && isFinite(v)));
  const bar = values.map(v => v === null || !isFinite(v) ? '·' : max <= 0 ? BARS[0] : BARS[Math.min(7, Math.round(7 * v / max))]);
  return letters.join(' ') + '\n' + bar.join(' ');
}
// one next question, chosen from the data, with the call that answers it
// the next question never repeats the call just answered: an offer that resolves to the same dates becomes the year-by-year view
function nextQuestion(f, r, sel) {
  const n = nextQuestion0(f, r);
  if (sel && n.tool === 'fire_answer' && n.arguments.period !== undefined) {
    let same = false; try { same = selName(parsePeriod(r, n.arguments.period)) === selName(sel); } catch (e) { same = false; }
    if (same) return { text: 'Want to see ' + f.placeIn + ' year by year?', tool: 'place_record', arguments: { place: R.displayName(r.area.country), view: 'years' } };
  }
  return n;
}
function nextQuestion0(f, r) {
  const pos = R.positions(r), placeIn = f.placeIn, file = r.area.country;
  const q = (text, tool, args) => ({ text, tool, arguments: Object.assign({ place: R.displayName(file) }, args || {}) });
  if (f.lead === 'modis') return q('Want to know why our record is weak for ' + placeIn + '?', 'how_sure');
  if (f.lead === 'ours' && f.older && !f.sameWord && f.older.word && side(f.older.word) !== side(f.ours.word)) return q('Want to know why the two cameras split here?', 'how_sure');
  if (f.lead === 'none') return pos.season ? q('Want to see ' + placeIn + '\'s last fire season instead?', 'fire_answer', { period: 'last season' }) : q('Want to see ' + placeIn + ' year by year instead?', 'place_record', { view: 'years' });
  if (f.kind === 'month' && f.ym === pos.latestYm) {
    const ms = R.seasonMonths(r), now = new Date(), m0 = now.getUTCMonth() + 1;
    const soon = ms.length && [1, 2, 3].some(k => ((m0 - 1 + k) % 12) + 1 === ms[0]);
    if (soon) return q('Its fire season starts in ' + MONTHS[ms[0] - 1] + '. Want the patterns to watch for it?', 'fire_answer', { period: 'next season' });
    return pos.yearIsSoFar ? q('Want to see how the year so far compares?', 'fire_answer', { period: 'this year' }) : q('Want to see the last fire season?', 'fire_answer', { period: 'last season' });
  }
  if (f.kind === 'month') return q('Want the rest of ' + yOf(f.ym) + ' month by month?', 'place_record', { view: 'months', year: yOf(f.ym) });
  if (f.kind === 'season') {
    const big = (f.season.yms || []).map(ym => R.forPeriod(r, { month: ym })).filter(m => !m.refusal && m.ours.feel).sort((a, b) => Math.abs(Math.log(b.ours.feel.ratio)) - Math.abs(Math.log(a.ours.feel.ratio)))[0];
    if (big) return q('Want to see ' + MONTHS[moOf(big.ym) - 1] + ' ' + yOf(big.ym) + ' on its own?', 'fire_answer', { period: big.ym });
  }
  const y = f.kind === 'yearSoFar' ? yOf(pos.latestYm) : f.year;
  return q('Want ' + (f.kind === 'yearSoFar' ? 'this year' : String(y)) + ' month by month?', 'place_record', { view: 'months', year: y });
}
function voice(r, f, seasonMonths, actingNow, fallback) {
  const place = f.place, when = whenWords(f), has = f.partial || f.kind === 'yearSoFar' ? 'has had' : 'had', is = f.partial || f.kind === 'yearSoFar' ? 'is' : 'was';
  const out = [];
  let remember = null;
  // 1. a sentence that is the answer, said as a fact
  if (f.lead === 'ours' || f.lead === 'modis') {
    const w = f.lead === 'ours' ? f.ours.word : f.older.word, c = f.lead === 'ours' ? f.ours : f.older, am = amount(c, w, f.lead === 'modis');
    out.push(possessive(f) + ' ' + periodNoun(f) + ' ' + is + ' ' + lower1(R.say(w)) + (f.lead === 'modis' ? ', going by MODIS, NASA\'s older camera' : '') + (am ? ', with ' + am : '') + '.');
    remember = { value: c.value, said: memorable(c.value), camera: f.lead === 'ours' ? 'our record' : 'MODIS alone' };
  } else if (firstYearLine(r, f)) {
    out.push(firstYearLine(r, f));   // the record's first year is partial: say where it starts, not "no data"
  } else if (f.ours.value === null && f.kind === 'year' && monthsWithData(r, f.year) > 0) {
    // some months of the year have data and some don't: say so, never "no data"
    const n = monthsWithData(r, f.year);
    out.push(possessive(f) + ' ' + f.year + ' has data for ' + R.numberWord(n) + ' of its 12 months, so there\'s no whole-year answer. The month view has the ' + R.numberWord(n) + '.');
  } else if (f.ours.value === null) {
    out.push('We don\'t know: there\'s no data for ' + f.placeIn + ' ' + when + (f.older ? ', though MODIS on its own counted ' + fireDetections(R.fmt(f.older.value)) + '.' : '.'));
  } else if (f.ours.fewYears) {
    out.push(cap1(f.placeIn) + ' ' + has + ' ' + fireDetections(R.fmt(f.ours.value)) + ' ' + when + ', but too few other years have data to say what\'s usual, so there\'s no verdict.');
  } else if ((f.tooFew || f.ours.tooFew) && f.ours.why === 'usual') {
    // the count is fine, but the usual for these dates is too small to compare with (the page's afternoon word fix): never "hardly any fire"
    const nm = f.kind === 'month' && !f.partial ? MONTHS[moOf(f.ym) - 1] : 'this time of year';
    out.push(cap1(f.placeIn) + ' ' + has + ' ' + fireDetections(R.fmt(f.ours.value)) + ' ' + when + ', but ' + nm + ' is usually too quiet here for a reliable comparison (a usual of ' + R.fmt(f.ours.typical) + '), so there\'s no verdict.');
  } else if (f.tooFew || f.ours.tooFew) {
    const v = R.fmt(f.ours.value) === 'under 1' ? 'next to no fire' : fireDetections(R.fmt(f.ours.value));
    out.push(cap1(f.placeIn) + ' ' + has + ' hardly any fire ' + when + ': ' + v + (f.ours.typical === null || f.ours.years < 5 ? '' : ', against a usual ' + R.fmt(f.ours.typical)) + '. That\'s too little to call quiet or busy.');
  } else if (f.ours.weak) {
    out.push('There\'s no verdict for ' + f.placeIn + ' ' + when + ': our record is weak there, and MODIS on its own gives no clear answer.');
  } else out.push('There\'s no verdict for ' + f.placeIn + ' ' + when + '.');
  // 1b. asked for this month or this year, but the record stops earlier: say which dates these are, once
  if (fallback) out.push(fallback.line);
  // 2. at most the qualifiers that change the conclusion
  out.push(...qualifiers(f));
  // 3. MODIS saying the same, or pointing the same way at a different strength; what came before (a month only); a season's shape
  const g = agreement(f);
  if (f.lead === 'ours' && g === 'same') out.push('MODIS, NASA\'s older camera, on its own says the same.');
  else if (f.lead === 'ours' && g === 'same_direction') out.push('MODIS, NASA\'s older camera, on its own ' + (Math.abs(SEV[f.older.word]) > Math.abs(SEV[f.ours.word]) ? 'goes further' : 'reads it milder') + ': ' + lower1(R.say(f.older.word)) + '.');
  if (f.olderMissing) out.push('MODIS has no count of its own for these dates.');
  // MODIS's own reading when ours gives no verdict; its true reason when it gives none either (never "too little" for a count that isn't small);
  // skipped when the first line already gave MODIS's count (our record has no data there)
  else if (f.lead === 'none' && f.older && f.ours.value !== null) {
    const o = f.older, whenO = f.kind === 'month' ? 'it' : f.kind === 'season' ? 'this season' : String(f.year);
    out.push('MODIS, NASA\'s older camera, on its own ' + (o.word ? 'calls it ' + lower1(R.say(o.word)) + ': ' + fireDetections(R.fmt(o.value))
      : o.why === 'years' ? 'saw ' + fireDetections(R.fmt(o.value)) + ', but there aren\'t enough other years with data to judge ' + whenO
      : o.why === 'usual' ? 'saw ' + fireDetections(R.fmt(o.value)) + ' against a usual of ' + R.fmt(o.typical) + ', too few for a reliable comparison'
      : 'saw too little to judge: ' + fireDetections(R.fmt(o.value))) + '.');
  }
  const happening = f.kind === 'month' ? R.happeningLine(r, f) : null;
  if (happening) out.push(happening);
  if (seasonMonths && seasonMonths.length) {
    out.push('', strip(seasonMonths.map(m => m.refusal ? null : m.detections), seasonMonths.map(m => MONTHS[moOf(m.month) - 1].charAt(0))));
    const stand = seasonMonths.filter(m => !m.refusal && m.verdict && (m.verdict.code === 'much busier' || m.verdict.code === 'much quieter'));
    if (stand.length) out.push(stand.map(m => MONTHS[moOf(m.month) - 1] + ' ' + yOf(m.month) + (m.compared_with_usual ? ' had ' + m.compared_with_usual.replace(/ the usual$/, ' the usual fire').replace(/ than usual$/, ' fire than usual') : ' was ' + lower1(R.say(m.verdict.code)))).join('; ') + '.');
  }
  // 4. one number worth remembering
  if (remember && remember.said) out.push('', 'That\'s ' + fireDetections(remember.said) + (remember.camera === 'MODIS alone' ? ' on MODIS' : '') + ' ' + (f.partial && f.kind === 'month' ? 'in these ' + R.numberWord(f.days) + ' days' : f.kind === 'yearSoFar' && spanOf(f) ? 'from ' + spanOf(f) : when) + '.');
  // 5. the natural next question, never a warning
  const next = nextQuestion(f, r, f.sel || null);
  out.push('', next.text);
  // 6. only when the person asked what to do right now or where to go: one line, always the last
  if (actingNow === true) out.push('', ACT_LINE);
  return { text: out.join('\n').replace(/\n{3,}/g, '\n\n').trim(), next, remember };
}

// ---------- the future (the team lead, 11:25 AM): "nothing is certain, but here are the patterns to watch" ----------
// A future period is answered from the record: when the fire season runs and peaks, how this year and the last season compare with usual,
// what the big years looked like. Never a number, a date or a verdict for the future period itself.
class FuturePeriod extends Error { constructor(label) { super('future'); this.label = label; } }
function futureLabel(p, sel) {
  const s = String(p === undefined || p === null ? '' : p).trim().toLowerCase();
  if (/next season|coming season|upcoming season|next fire season/.test(s)) return 'next season';
  if (/next year/.test(s)) return 'next year';
  if (/next month/.test(s)) return 'next month';
  if (/tomorrow/.test(s)) return 'tomorrow';
  if (sel && sel.month) return monthName(sel.month);
  if (sel && sel.year !== undefined) return String(sel.year);
  if (sel && sel.season !== undefined) return 'the ' + sel.season + ' fire season';
  return 'what comes next';
}
// the month a place's fire is usually highest: the median of its finished months, month by month
function peakMonth(r) {
  const by = Array.from({ length: 12 }, () => []);
  for (const x of r.monthly) if (x.status === 'final' && x.value !== null) by[+x.ym.slice(5, 7) - 1].push(x.value);
  const med = by.map(a => { if (!a.length) return -1; const b = a.slice().sort((u, v) => u - v), k = b.length >> 1; return b.length % 2 ? b[k] : (b[k - 1] + b[k]) / 2; });
  let best = 0; med.forEach((m, i) => { if (m > med[best]) best = i; });
  return med[best] > 0 ? best + 1 : null;
}
// one period said in a clause: "far quieter than normal, about half the usual fire" / going by MODIS / too little to call
function clauseFor(f) {
  if (!f || f.refusal) return null;
  if (f.lead === 'ours' || f.lead === 'modis') {
    const w = f.lead === 'ours' ? f.ours.word : f.older.word, c = f.lead === 'ours' ? f.ours : f.older;
    const am = c.feel && fits(w, c.feel) ? c.feel.phrase.replace(/ the usual$/, ' the usual fire').replace(/ than usual$/, ' fire than usual') : null;
    return lower1(R.say(w)) + (am ? ', ' + am : '') + (f.lead === 'modis' ? ' (going by MODIS)' : '');
  }
  if (f.tooFew || f.ours.tooFew) return 'too little fire to call';
  return null;
}
async function patterns(file, r, label) {
  const place = R.displayName(file), placeIn = R.inSentence(place), pos = R.positions(r), sc = R.score(r);
  const weak = sc.rule === 'one' || sc.rule === 'curve';
  const ms = R.seasonMonths(r), pk = peakMonth(r);
  const out = ['Nothing about ' + label + ' is certain, but here are the patterns to watch.'];
  const data = { kind: 'patterns_to_watch', place, place_file: file, asked: label, season: null, peak_month: pk ? MONTHS[pk - 1] : null, this_year: null, last_season: null, big_years: [], weak_record: weak };
  if (ms.length) { data.season = { from: MONTHS[ms[0] - 1], to: MONTHS[ms[ms.length - 1] - 1] };
    out.push(possessive({ placeIn }) + ' fire ' + (ms.length === 1 ? 'is usually highest ' + seasonSpan(ms) : 'season usually runs ' + seasonSpan(ms) + (pk ? ', and it\'s usually highest in ' + MONTHS[pk - 1] : '')) + (sparse(r) ? ', though it has very little fire in any month' : '') + '.'); }
  if (weak) out.push('Our own record is weak for ' + placeIn + ', so this goes by MODIS.');
  const fy = pos.year ? R.forPeriod(r, pos.year) : null, fs = pos.season ? R.forPeriod(r, pos.season) : null;
  const cy = clauseFor(fy), cs = clauseFor(fs);
  if (cy) { data.this_year = { period: fy.periodLabel, verdict: verdictOf(fy), said: cy, early_data: !!fy.early };
    const was = (c) => c === 'too little fire to call' ? 'had too little fire to call quiet or busy' : 'was ' + c;
    out.push((fy.kind === 'yearSoFar' ? (cy === 'too little fire to call' ? 'This year has had too little fire so far to call' : 'This year is running ' + cy + ' so far') : fy.year + ' ' + was(cy)) + (cs ? ', and the last season (' + fs.periodLabel + ') ' + was(cs) : '') + '.'); }
  else if (cs) out.push('The last season (' + fs.periodLabel + ') ' + (cs === 'too little fire to call' ? 'had too little fire to call quiet or busy' : 'was ' + cs) + '.');
  if (cs) data.last_season = { period: fs.periodLabel, verdict: verdictOf(fs), said: cs };
  if (!weak) {
    const big = R.yearly(r).filter(t => t.complete && t.ours !== null && t.typical).map(t => ({ year: t.year, total: t.ours, usual: t.typical, fl: R.feel(t.ours, t.typical) }))
      .filter(t => t.fl && t.fl.ratio >= 1.42).sort((a, b) => b.total - a.total).slice(0, 2);
    data.big_years = big.map(t => ({ year: t.year, detections: round(t.total), usual: round(t.usual), compared_with_usual: t.fl.phrase }));
    if (big.length) out.push('The big years, like ' + big.map(t => t.year).join(' and ') + ', came in at ' + (big.length === 1 || big[0].fl.phrase === big[1].fl.phrase ? big[0].fl.phrase : big[0].fl.phrase + ' and ' + big[1].fl.phrase) + '.');
  }
  if (!cy && !cs && !data.big_years.length) {
    const last = R.yearly(r).filter(t => t.complete && t.ours !== null).pop();
    out.push(cap1(placeIn) + ' has very little fire' + (last ? ': ' + R.fmt(last.ours) + ' detections in all of ' + last.year : '') + '.');
  }
  const nq = { text: 'Want the latest month\'s answer for ' + placeIn + '?', tool: 'fire_answer', arguments: { place, period: 'latest' } };
  data.next_questions = [nq]; data.unit = UNIT;
  out.push('', nq.text);
  return { text: out.join('\n'), data };
}

async function answer(placeQ, periodQ, actingNow, noPatterns) {
  const file = await resolvePlace(placeQ), r = await result(file);
  const future = async (e) => { if (noPatterns) throw new Refusal('FORECAST_NOT_OFFERED', futureLine(r)); const pt = await patterns(file, r, e.label);
    if (actingNow === true) { pt.text += '\n\n' + ACT_LINE; pt.data.acting_now_line = ACT_LINE; }
    return { text: pt.text, data: pt.data, f: null, r, file, sel: null, patterns: true }; };
  let sel;
  try { sel = parsePeriod(r, periodQ); } catch (e) { if (isFuture(e)) return future(e); throw e; }
  const sc = R.screen(r, sel), f = sc.f;
  if (f.refusal) {
    if (f.refusal.code === 'OUT_OF_COVERAGE') { const e = coverageRefusal(r, f.place, sel); if (isFuture(e)) return future(e); throw e; }
    throw new Refusal(f.refusal.code, cap1(f.refusal.message) + '.', { place: f.place, record_starts: r.record_starts, record_ends: r.record_ends });
  }
  const verdict = verdictOf(f), nov = noVerdictRefusal(f);
  // a season: each of its months with its own answer (the season can read about normal while one month burned far above it)
  let seasonMonths = null;
  if (f.kind === 'season' && f.season && f.season.yms) {
    seasonMonths = f.season.yms.map(ym => { const p = R.monthPanel(r, ym); if (p.refusal) return { month: ym, refusal: p.refusal };
      // the row's count, usual and phrase come from the same series as its verdict (MODIS alone where MODIS leads); both series are kept, labeled
      const m = p.f, lc = m.lead === 'modis' ? m.older : m.ours;
      return { month: ym, label: m.periodLabel, verdict: verdictOf(m), source: m.lead === 'modis' ? 'MODIS alone' : 'our record', detections: round(lc.value), usual: round1(lc.typical), compared_with_usual: phrase(lc, lc.word, m.lead === 'modis'), says: p.say,
        our_record: { detections: round(m.ours.value), usual: round1(m.ours.typical), verdict_code: m.ours.word || null }, modis_alone: m.older ? round(m.older.value) : null, modis_usual: m.older ? round1(m.older.typical) : null, modis_says: p.modis || null, early_data: !!m.early }; });
  }
  const fallback = fallbackFor(r, f, periodQ);
  f.sel = sel;   // the dates just answered, so the next question never repeats them
  const v = voice(r, f, seasonMonths, actingNow, fallback), text = v.text;
  const data = {
    place: f.place, place_file: file, period: { asked: periodQ === undefined ? 'latest' : periodQ, resolved: selName(sel), kind: f.kind, label: f.periodLabel, words: sc.periodWords, month: f.ym, year: f.year, season: f.season ? { start: f.season.start, end: f.season.end } : null,
      fallback: !!fallback, fallback_line: fallback ? fallback.line : null, requested_unavailable: fallback ? fallback.requested : null, record_ends: r.record_ends, ...periodSpan(r, f) },
    season_months: seasonMonths, verdict, refusal: nov, early_data: !!f.early,
    our_record: Object.assign(camera(f.ours, 'our ' + f.recordYears + '-year record: MODIS and VIIRS on one scale'), { unreliable_here: !!f.ours.weak }),
    modis_alone: camera(f.older, 'MODIS, NASA\'s older camera, counted on its own'), modis_note: f.olderMissing ? 'MODIS has no count of its own for these dates.' : !f.older ? 'MODIS is counted on its own only from 2022 on.' : null,
    cameras: agreement(f), cameras_agree: agreement(f) === 'same' ? true : agreement(f) === null || agreement(f) === 'not_comparable' ? null : false, both_answers_must_travel_together: !!(f.older && mustTravel(f)),
    record_years: f.recordYears, record_runs: { from: r.record_starts, to: r.record_ends },
    qualifiers: qualifiers(f), number_to_remember: v.remember, next_questions: [v.next], unit: UNIT, acting_now_line: actingNow === true ? ACT_LINE : null, source: 'NASA FIRMS (MODIS and VIIRS active fire detections)'
  };
  return { text, data, f, r, file, sel };
}
function monthName(ym) { return ym ? MONTHS[+ym.slice(5, 7) - 1] + ' ' + ym.slice(0, 4) : ym; }

// ---------- the dates an answer covers, as fields: from, to (ISO days), and complete (the record holds every day of the period) ----------
const lastDayOf = (ym) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
const dayOf = (ym, d) => ym + '-' + String(d).padStart(2, '0');
function periodSpan(r, f) {
  let a, b, complete = true;
  if (f.kind === 'month') { a = dayOf(f.ym, 1); b = dayOf(f.ym, f.partial && f.days ? f.days : lastDayOf(f.ym)); complete = !f.partial; }
  else if (f.kind === 'yearSoFar') { const cur = r.current ? r.current.ym : R.positions(r).latestYm; a = f.year + '-01-01'; b = dayOf(cur, r.current ? r.current.days : lastDayOf(cur)); complete = false; }
  else if (f.kind === 'year') {
    const first = (f.year + '-01') < r.record_starts ? r.record_starts : f.year + '-01', last = (f.year + '-12') > r.record_ends ? r.record_ends : f.year + '-12';
    a = dayOf(first, 1); b = dayOf(last, lastDayOf(last)); complete = first === f.year + '-01' && last === f.year + '-12';
  } else if (f.season && f.season.yms) { const ys = f.season.yms; a = dayOf(ys[0], 1); b = dayOf(ys[ys.length - 1], lastDayOf(ys[ys.length - 1])); complete = !f.partial; }
  return { from: a || null, to: b || null, complete };
}
// how many months of a year hold usable data in our record
function monthsWithData(r, y) { return r.monthly.filter(x => +x.ym.slice(0, 4) === y && x.value !== null && x.value !== undefined).length; }
// the record's first year is partial (it starts in November 2000): one line for every tool, never "no data"
function firstYearLine(r, f) {
  if (f.kind !== 'year' || f.year !== +r.record_starts.slice(0, 4) || r.record_starts.slice(5, 7) === '01') return null;
  return cap1(f.placeIn) + '\'s record starts in ' + monthName(r.record_starts) + ', so ' + f.year + ' has no full-year answer. ' + MONTHS[+r.record_starts.slice(5, 7) - 1] + ' to December ' + f.year + ' are in the month view.';
}

// ---------- when the dates answered are not quite the dates asked: one shared line for every tool (fire_answer, report_sentence, compare) ----------
// "this month" / "this year" past the record's end; "today" (the record is monthly; NASA's 24-hour file is fire_now's);
// a season across the new year ("2019-20") where the record's season ends in December: the months after it, each with its own answer
function fallbackFor(r, f, periodQ) {
  const askedS = String(periodQ === undefined || periodQ === null ? '' : periodQ).trim().toLowerCase().replace(/\s+/g, ' ');
  const lines = []; let requested = null;
  if (/^(this month|now|today|right now|current)$/.test(askedS) && f.kind === 'month' && f.ym < thisMonth()) {
    requested = /today|now/.test(askedS) ? 'today (' + monthName(thisMonth()) + ')' : monthName(thisMonth());
    lines.push('That\'s the newest month in ' + f.placeIn + '\'s record: ' + monthName(thisMonth()) + ' isn\'t in it yet.');
  } else if (/^(this year|year so far|so far this year)$/.test(askedS) && f.kind === 'year' && f.year < thisYear()) {
    requested = String(thisYear());
    lines.push('That\'s the newest full year in ' + f.placeIn + '\'s record: ' + thisYear() + ' isn\'t in it yet.');
  }
  if (/^(today|now|right now)$/.test(askedS)) { requested = requested || 'today'; lines.push('This record goes month by month; for today, fire_now has NASA\'s 24-hour file.'); }
  if (f.kind === 'season' && f.season && f.season.yms && /\d{4}\s*[-–\/]\s*\d{2,4}/.test(askedS)) {
    const yms = f.season.yms, endY = +yms[yms.length - 1].slice(0, 4), m0 = +yms[0].slice(5, 7);
    if (endY === +yms[0].slice(0, 4)) {
      requested = String(periodQ);
      // the months of the next year before the record's season starts again (at most three), each answered on its own
      const after = [];
      for (let mo = 1; mo < Math.min(m0, 4); mo++) {
        const ym = (endY + 1) + '-0' + mo;
        if (ym > r.record_ends) break;
        const c = clauseFor(R.forPeriod(r, { month: ym }));
        if (c) after.push(MONTHS[mo - 1] + ' ' + (endY + 1) + ' was ' + c);
      }
      lines.push('Our record\'s fire season for ' + f.placeIn + ' runs ' + f.season.span + ', so it stops at December ' + endY + (after.length ? '. After it: ' + after.join('; ') + '.' : '.'));
    }
  }
  return lines.length ? { requested, used: f.periodLabel, line: lines.join(' ') } : null;
}

// ---------- tool: place_record (by year, or by month for one year) ----------
// a season of one month is said as one month; a place whose usual peak month has under 16 detections is said to have very little fire
function seasonSpan(ms) { return ms.length === 1 ? 'in ' + MONTHS[ms[0] - 1] : 'from ' + MONTHS[ms[0] - 1] + ' to ' + MONTHS[ms[ms.length - 1] - 1]; }
function sparse(r) {
  const pk = peakMonth(r); if (!pk) return true;
  const v = r.monthly.filter(x => x.status === 'final' && x.value !== null && +x.ym.slice(5, 7) === pk).map(x => x.value).sort((a, b) => a - b);
  return !v.length || v[v.length >> 1] < R.TOO_FEW;
}
// why a year has no whole-year total: the record starts in it, it is still running, or some of its months have no data
// the last finished month of a running year (the unfinished month is not in the yearly sum)
function throughMonth(r, y) {
  if (!r.current || y !== +r.current.ym.slice(0, 4)) return null;
  const mo = +r.current.ym.slice(5, 7) - 1; return mo >= 1 ? y + '-' + String(mo).padStart(2, '0') : null;
}
function partNote(r, y) {
  if (y === +r.record_starts.slice(0, 4)) return ' (the record starts in ' + MONTHS[+r.record_starts.slice(5, 7) - 1] + ')';
  if (r.current && y === +r.current.ym.slice(0, 4)) { const t = throughMonth(r, y); return t ? ' through ' + MONTHS[+t.slice(5, 7) - 1] + ' (finished months only; ' + MONTHS[+r.current.ym.slice(5, 7) - 1] + ' 1–' + r.current.days + ' is in the month view)' : ' so far'; }
  return ' (some months have no data, so no whole-year total)';
}
// a place with no month of usable data (Anguilla, Bermuda, Monaco ...): one plain refusal, and NASA's own recent files as the way on
function noUsable(r) { return !R.positions(r).latestYm; }
const RECENT_NEXT = (place) => ({ text: 'Want NASA\'s own recent files for ' + R.inSentence(place) + ' (the 7-day file)?', tool: 'nasa_recent', arguments: { place, window: '7d' } });
function noUsableRefusal(r, place) {
  return new Refusal('NO_USABLE_MONTHS', cap1(R.inSentence(place)) + ' has no month with usable data in this record, so there\'s no history to show. NASA\'s own recent files still cover it: nasa_recent has them.', { place, next_questions: [RECENT_NEXT(place)] });
}
async function record(placeQ, view, yearQ) {
  const file = await resolvePlace(placeQ), r = await result(file), place = R.displayName(file);
  if (noUsable(r)) throw noUsableRefusal(r, place);
  const v = String(view || 'years').toLowerCase();
  if (/^year/.test(v)) {
    const ys = R.yearly(r);
    const rows = ys.map(t => ({ year: t.year, complete: t.complete, detections: round(t.ours), detections_so_far: round(t.soFar), so_far_through: t.complete ? null : throughMonth(r, t.year), modis_alone: t.year < 2022 || t.olderOwn === null ? null : round(t.olderOwn), usual_whole_year: round(t.typical),
      glued_unadjusted_wrong_way: t.year < 2022 || t.newerAsIs === null || t.newerAsIs === undefined ? null : round(t.newerAsIs) }));
    const lines = [place + ', every year in our ' + R.recordYears(r) + '-year record:'];
    // say what "most" measures: the most fire detected, not the most land burned
    const yl0 = R.yearsLine(r), yl = yl0 ? yl0.replace(/\bburned most\b/, 'had the most fire detected') : yl0; if (yl) lines.push(yl);
    const tie = !!(yl && /too close/.test(yl));
    const last = ys[ys.length - 1]; const ysay = last ? R.yearSay(r, last.year) : null;
    if (ysay && ysay.line) lines.push(ysay.line + (ysay.modis ? ' ' + ysay.modis.text : '') + (ysay.f.early ? ' (Early data.)' : ''));
    if (ysay && ysay.weak) lines.push(ysay.weak);   // why our record is unreliable here, said once
    lines.push('');
    for (const t of rows) lines.push(t.year + ': ' + (t.complete ? R.detections(t.detections) : t.detections_so_far !== null ? R.detections(t.detections_so_far) + partNote(r, t.year) : 'no whole year') + (t.modis_alone !== null ? ' (MODIS alone: ' + R.fmt(t.modis_alone) + ')' : '') + (t.glued_unadjusted_wrong_way !== null ? ' [glued as-is, the wrong way: ' + R.fmt(t.glued_unadjusted_wrong_way) + ']' : ''));
    // why the wrong way is shown: the jump a plain join makes is the camera, not the fire
    const g22 = rows.find(t => t.year === 2022), before = rows.filter(t => t.year < 2022 && t.complete && t.detections !== null).sort((a, b) => b.detections - a.detections)[0];
    let glued = null;
    if (g22 && g22.glued_unadjusted_wrong_way !== null && before) {
      glued = 'The numbers in [brackets] are the WRONG way to join the cameras, shown only so you can see why we don\'t: from 2022 the newer VIIRS camera\'s counts simply added on, without putting them on MODIS\'s scale. That way, 2022 would read ' + R.fmt(g22.glued_unadjusted_wrong_way) +
        ' detections, against ' + R.fmt(before.detections) + ' for ' + before.year + ', the biggest whole year before it; on one scale, 2022 has ' + R.fmt(g22.detections) + '. ' + R.gluedCaption(r);
      lines.push('', glued);
    }
    const topY = rows.filter(t => t.complete && t.detections !== null).sort((a, b) => b.detections - a.detections)[0];
    const nq = topY ? { text: 'Want ' + topY.year + ', ' + (tie ? 'one of the two biggest years here' : 'the biggest year here') + ', month by month?', tool: 'place_record', arguments: { place, view: 'months', year: topY.year } } : { text: 'Want this year month by month?', tool: 'place_record', arguments: { place, view: 'months' } };
    lines.push('', 'MODIS alone is given from 2022, when our record switched to VIIRS.', '', nq.text);
    return { text: lines.join('\n'), data: { place, place_file: file, view: 'years', busiest_years_line: yl, weak_record: ysay && ysay.weak || null, glued_note: glued, rows, unit: UNIT, next_questions: [nq] } };
  }
  if (!/^month/.test(v)) throw new Refusal('BAD_REQUEST', 'view is "years" or "months".');
  const latestYear = +String(R.positions(r).latestYm).slice(0, 4);
  const y = yearQ === undefined || yearQ === null || yearQ === '' ? latestYear : +yearQ;
  if (!Number.isInteger(y) || y < +r.record_starts.slice(0, 4) || y > +r.record_ends.slice(0, 4))
    throw new Refusal('OUT_OF_COVERAGE', y + ' is outside ' + place + '\'s record, which runs from ' + monthName(r.record_starts) + ' to ' + monthName(r.record_ends) + '.');
  const rows = [], lines = []; let weakSaid = null;
  const seasonMs = R.seasonMonths(r);
  if (seasonMs.length) lines.push(place + ' burns most ' + seasonSpan(seasonMs) + (sparse(r) ? ', though it has very little fire in any month' : '') + '.');
  lines.push(place + ', ' + y + ', month by month:');
  for (let mo = 1; mo <= 12; mo++) {
    const ym = y + '-' + (mo < 10 ? '0' : '') + mo;
    if (ym < r.record_starts || ym > r.record_ends) continue;
    const p = R.monthPanel(r, ym);
    if (p.refusal) { rows.push({ month: ym, refusal: p.refusal }); continue; }
    const f = p.f;
    if (p.weak && !weakSaid) weakSaid = p.weak;
    const lastDay = f.partial && f.days ? f.days : new Date(Date.UTC(y, mo, 0)).getUTCDate();
    rows.push({ month: ym, from: ym + '-01', to: ym + '-' + String(lastDay).padStart(2, '0'), complete: !f.partial, verdict_basis: f.ours.word ? camera(f.ours, '').verdict_basis : null, label: f.periodLabel, detections: round(f.ours.value), usual: round1(f.ours.typical), verdict: verdictOf(f), says: p.say, weak_record: !!p.weak, modis_alone: f.older ? round(f.older.value) : null, modis_usual: f.older ? round1(f.older.typical) : null, modis_says: p.modis || null, early_data: !!f.early });
    lines.push(MONTHS[mo - 1] + (f.partial ? ' (days 1 to ' + f.days + ')' : '') + ': ' + p.say + (p.modis ? ' ' + p.modis : '') + ' [' + (f.ours.value === null ? 'no data' : R.detections(f.ours.value)) + (f.older ? '; MODIS alone ' + R.fmt(f.older.value) : f.olderMissing ? '; MODIS: no data' : '') + ']' + (f.early ? ' Early data.' : ''));
  }
  if (weakSaid) lines.splice(seasonMs.length ? 1 : 0, 0, weakSaid);   // why our record is unreliable here, once, before the months
  const vals = []; for (let mo = 1; mo <= 12; mo++) { const rw = rows.find(x => x.month === y + '-' + String(mo).padStart(2, '0')); vals.push(rw && !rw.refusal ? rw.detections : null); }
  const at = lines.findIndex(l => / month by month:$/.test(l));
  lines.splice(at + 1, 0, strip(vals, MONTHS.map(m => m.charAt(0))), '');
  const big = rows.filter(x => !x.refusal && x.verdict && x.verdict.code === 'much busier')[0];
  // the next question stays inside the record: the year before, or else the year after, or else every year
  const firstY = +r.record_starts.slice(0, 4), lastY = +r.record_ends.slice(0, 4), other = y - 1 >= firstY ? y - 1 : y + 1 <= lastY ? y + 1 : null;
  const nq = big ? { text: 'Want ' + monthName(big.month) + ' on its own?', tool: 'fire_answer', arguments: { place, period: big.month } }
    : other !== null ? { text: 'Want ' + other + ' month by month?', tool: 'place_record', arguments: { place, view: 'months', year: other } } : { text: 'Want ' + place + ' year by year?', tool: 'place_record', arguments: { place, view: 'years' } };
  lines.push('', nq.text);
  return { text: lines.join('\n'), data: { place, place_file: file, view: 'months', year: y, weak_record: weakSaid, strip: strip(vals, MONTHS.map(m => m.charAt(0))), rows, unit: UNIT, next_questions: [nq] } };
}

// ---------- tool: trust (how far to trust our record in this place) ----------
async function trust(placeQ) {
  const file = await resolvePlace(placeQ), r = await result(file), place = R.displayName(file), placeIn = R.inSentence(place), s = R.score(r);
  if (noUsable(r)) {
    const nq0 = RECENT_NEXT(place);
    return { text: 'There\'s no record to trust for ' + placeIn + ': no month has usable data, so no answer here leads with our record.\n\n' + nq0.text, data: { place, place_file: file, rule: null, answers_lead_with: null, no_usable_months: true, unit: UNIT, caution: CAUTION, next_questions: [nq0] } };
  }
  const row = WORLD.rows.find(w => w.file === file) || null, cls = row ? row.cls : null;
  let line, lead;
  // the test's wording (the second-model check of the engine repair): only the conversion numbers are learned without the year being tested
  // which record leads follows the weak-record rule: a typical miss over 25% (or one number) means MODIS's own count leads, as in every answer
  if (s.rule === 'twelve') {
    const weak = s.typicalPct > 25;
    line = (weak ? 'Weak here: ' : s.typicalPct <= 15 ? 'This holds up: ' : 'Fair: ') + 'in past tests in ' + placeIn + ', with each year left out in turn when learning its conversion numbers, our record landed within about ' + Math.round(s.typicalPct) + '% of MODIS\'s own count in a typical month, over ' + s.months + ' months' + (s.oneInTenPct !== null ? '; one month in ten missed by more than ' + Math.round(s.oneInTenPct) + '%.' : '.');
    lead = weak ? 'MODIS alone, where MODIS has a count' : 'our record';
  }
  else if (s.rule === 'one') { line = R.weakPlain(r, null, true) + ' (' + s.months + ' months tested.)'; lead = 'MODIS alone, where MODIS has a count'; }
  else if (s.rule === 'curve') { line = R.weakPlain(r, null, true) + ' There is no fair test score for ' + placeIn + '.'; lead = 'MODIS alone, where MODIS has a count'; }
  else { line = 'There is no fair test score for ' + placeIn + ': too few months to leave out and test.'; lead = 'our record, with no test score behind it'; }
  if (cls === 'quiet') line += ' ' + cap1(placeIn) + ' has too little fire in most months for the test to mean much.';
  // which record leads is the weak-record rule's call, never the amount of fire: said after the test, as its own sentence
  if (s.rule === 'twelve' && s.typicalPct > 25) line += ' Our record is weak here, and where our record is weak for a place, MODIS\'s own count leads.';
  if (r.current) line += ' ' + R.partialLine(r);
  const nq = { text: 'Want the latest answer for ' + placeIn + '?', tool: 'fire_answer', arguments: { place, period: 'latest' } };
  const text = line + '\nAnswers for ' + placeIn + ' lead with ' + lead + '.\n\nHow we count: ' + UNIT + '\n\n' + CAUTION + '\n\n' + nq.text;
  return { text, data: { caution: CAUTION, unit: UNIT, next_questions: [nq], place, place_file: file, rule: s.rule, typical_miss_pct: round1(s.typicalPct), one_in_ten_miss_pct: round1(s.oneInTenPct), months_tested: s.months, trust_class: cls, trust_class_words: cls ? WORLD.classes[cls] : null, answers_lead_with: lead } };
}

// ---------- tool: report sentence ----------
// what to cite: NASA's dataset, the team's derived series, and which copy of the record answered (COPIED.txt, written by sync_vendor.cjs)
// only the copy's date and time (the line also names a folder and a script, which never go into a response)
const COPIED = (() => { try { const m = /\((\d{4}-\d{2}-\d{2}T[\d:.]+Z)\)/.exec(require('fs').readFileSync(path.join(VENDOR, 'COPIED.txt'), 'utf8')); return m ? 'record copied ' + m[1] : null; } catch (e) { return null; } })();
const CITATION = Object.freeze({
  dataset: 'NASA FIRMS active fire detections: MODIS Collection 6.1 (Terra and Aqua) and VIIRS 375 m Collection 2 (S-NPP, NOAA-20, NOAA-21)',
  dataset_home: ['https', '://', require('./nasa_sources.json').host, '/'].join(''),   // built from the host: no full web address in the code
  derived_series: 'A 26-year monthly record of fire detections per country, MODIS and VIIRS put on one scale; built at NASA Space Apps 2026 by team Spark Squad (prototype; not reviewed by an outside expert)',
  record_copy: COPIED
});
async function sentence(placeQ, periodQ) {
  const file = await resolvePlace(placeQ), r = await result(file);
  let sel; try { sel = parsePeriod(r, periodQ); } catch (e) { if (isFuture(e)) throw new Refusal('FORECAST_NOT_OFFERED', futureLine(r)); throw e; }
  const f = R.forPeriod(r, sel);
  if (f.refusal && f.refusal.code === 'OUT_OF_COVERAGE') { const e = coverageRefusal(r, f.place, sel); if (isFuture(e)) throw new Refusal('FORECAST_NOT_OFFERED', futureLine(r)); throw e; }
  if (f.refusal) throw new Refusal(f.refusal.code, cap1(f.refusal.message) + '.', { record_starts: r.record_starts, record_ends: r.record_ends });
  let short = R.shortSentence(r, sel), full = R.sentence(r, sel);
  // the page's sentence, made to fit what this period actually holds
  const noModis = !f.older || f.olderMissing;
  const fix = (s) => {
    if (f.ours.why === 'usual') s = s.replace(/^Hardly any fire was detected across (.+?) in (.+?): (.+?), too little to call it quiet or busy./, (x, pl, wh) => cap1(pl) + ' had ' + R.detections(f.ours.value) + ' in ' + wh + ', but ' + (f.kind === 'month' && !f.partial ? MONTHS[moOf(f.ym) - 1] : 'this time of year') + ' is usually too quiet here for a reliable comparison (a usual of ' + R.fmt(f.ours.typical) + ').');
    if (noModis) s = s.replace(/ ?Read MODIS['’]s own count first\./g, ' MODIS has no count of its own for these dates.');
    // a year so far: the early-data note belongs to its newest days, not to the whole total
    if (f.kind === 'yearSoFar' && r.current) s = s.replace(/\b\w+ days of early data\. In past tests, [^.]*\./i, 'Its newest days (' + MONTHS[+r.current.ym.slice(5, 7) - 1] + ' 1 to ' + r.current.days + ') are early data.');
    // both cameras point the same way at different strengths: that is not a disagreement
    const g = agreement(f);
    if (g === 'same_direction') s = s.replace(/The two disagree:/, SEV[f.ours.word] > 0 ? 'Both saw more fire than usual:' : 'Both saw less fire than usual:');
    // too few comparable years is not "too little fire": say the real reason, the same one the short form gives
    if (f.ours.fewYears && !(f.ours.value !== null && f.ours.value < R.TOO_FEW)) s = s.replace(/: too little fire to judge\./, ': too few other years with data to compare with, so no verdict.').replace(/Both counts are too small to judge\./, 'There are too few other years with data to judge either count.');
    return s.replace(/\s{2,}/g, ' ');
  };
  short = fix(short); full = fix(full);
  // the two cameras point opposite ways: the short form names MODIS's verdict too, so a quoted short sentence never hides the split
  if (agreement(f) === 'different_direction' && f.older && f.older.word && short.toLowerCase().indexOf(R.say(f.older.word).toLowerCase()) < 0)
    short += ' On its own, MODIS reads it ' + lower1(R.say(f.older.word)) + '.';
  // the record's first year is partial: the same line fire_answer gives, never "no data"
  const fy = firstYearLine(r, f);
  if (fy) { short = fy; full = fy; }
  // the dates answered are not quite the dates asked: the same line fire_answer gives, so a quoted sentence never hides it
  const fb = fallbackFor(r, f, periodQ);
  if (fb) { short += ' ' + fb.line; full += ' ' + fb.line; }
  // the verdict rests on rank among other years; when the ratio to the median reads differently, say the rank
  const lc = f.lead === 'modis' ? f.older : f.ours, lw = lc && lc.word;
  if (lw && lc.feel && !fits(lw, lc.feel) && typeof R.rankWords === 'function') { const rw = R.rankWords(lw, lc.rank); if (rw) full += ' The verdict goes by rank: ' + rw + '.'; }
  const basis = lc && lw ? camera(lc, '').verdict_basis : null;
  return { text: 'Short:\n' + short + '\n\nFull, with the numbers:\n' + full, data: { place: f.place, place_file: file, period: selName(sel),
    period_detail: { asked: periodQ === undefined ? 'latest' : periodQ, resolved: selName(sel), label: f.periodLabel, fallback: !!fb, fallback_line: fb ? fb.line : null, requested_unavailable: fb ? fb.requested : null, record_ends: r.record_ends, ...periodSpan(r, f) },
    short, full, early_data: !!f.early, verdict_basis: basis, citation: CITATION } };
}

// ---------- tool: find places ----------
async function find(q, limit) {
  const P = await places(), lim = Math.max(1, Math.min(+limit || 25, 300));
  let hits;
  if (q && String(q).trim()) {
    if (String(q).length > MAX_NAME) throw new Refusal('BAD_REQUEST', 'That search is too long (at most ' + MAX_NAME + ' characters).');
    const nq = norm(q), exact = P.byKey.get(nq);
    hits = P.list.filter(p => norm(p.name).indexOf(nq) >= 0 || norm(p.file).indexOf(nq) >= 0 || p.file === exact);
    if (!hits.length) { const s = await suggest(q, 8); hits = P.list.filter(p => s.indexOf(p.name) >= 0); }
  } else hits = P.list.slice();
  const out = hits.slice(0, lim).map(p => ({ name: p.name, file: p.file, latest_month: p.row ? p.row.latest : null, latest_month_unfinished: p.row ? !!p.row.partial : null, trust_class: p.row ? p.row.cls : null, trust_class_words: p.row ? WORLD.classes[p.row.cls] : null }));
  const head = q && String(q).trim() ? (hits.length ? hits.length + ' match' + (hits.length === 1 ? '' : 'es') + ' for "' + String(q).slice(0, MAX_NAME) + '"' : 'No place matches "' + String(q).slice(0, MAX_NAME) + '"') : P.list.length + ' places in this record';
  const text = head + (hits.length > lim ? ' (first ' + lim + ' shown)' : '') + ':\n' + out.map(p => p.name + (p.latest_month ? ' (record to ' + monthName(p.latest_month) + (p.latest_month_unfinished ? ', unfinished' : '') + '; ' + p.trust_class_words + ')' : '')).join('\n');
  return { text, data: { query: q || null, total: hits.length, places: out } };
}

// "the first about twice the second", "the first about 40% of the second", "the first about 16% more"
function ratioWords(x) {
  if (x === null || !isFinite(x)) return '';
  const p = Math.round(100 * (x - 1));
  return x >= 1.95 ? ': the first about ' + (Math.round(x) === 2 ? 'twice' : R.numberWord(Math.round(x)) + ' times') + ' the second' : x > 0 && x <= 0.51 ? ': the first about ' + Math.round(100 * x) + '% of the second' : p === 0 ? ': about the same' : ': the first about ' + Math.abs(p) + '% ' + (p > 0 ? 'more' : 'fewer');
}
// MODIS's reason for no verdict, in the page's month-panel words: never "too little fire" for a count that isn't small
function olderWhy(o) { return o.why === 'years' ? 'too few other years to judge' : o.why === 'usual' ? 'usually too quiet here to judge' : 'too little fire to judge'; }
// ---------- tool: compare two answers (two places, or two periods of one place) ----------
function oneLine(a) {
  const f = a.f, pw = a.data.period.label;
  let s;
  const paren = (x) => /\(/.test(x) ? ', ' + x : ' (' + x + ')';
  const po = phrase(f.ours, f.ours.word, false), pm = f.older ? phrase(f.older, f.older.word, true) : null;
  if (f.lead === 'ours') s = f.place + ', ' + pw + ': ' + lower1(R.say(f.ours.word)) + (po ? paren(po) : '') + (f.older && !f.sameWord ? '; MODIS alone: ' + (f.older.word ? lower1(R.say(f.older.word)) : olderWhy(f.older)) + (pm ? paren(pm) : '') : f.older ? '; MODIS alone says the same' : '');
  else if (f.lead === 'modis') s = f.place + ', ' + pw + ': ' + lower1(R.say(f.older.word)) + ', going by MODIS alone' + (pm ? paren(pm) : '') + '; our record is unreliable there';
  else {
    s = f.place + ', ' + pw + ': no verdict from our record (' + lower1(a.data.refusal ? a.data.refusal.message.replace(/, so there is no verdict\.$/, '').replace(/\.$/, '') : 'no fair answer') + ')';
    // MODIS's own answer travels even when ours has none
    if (f.older) s += '; MODIS alone: ' + (f.older.word ? lower1(R.say(f.older.word)) + (pm ? paren(pm) : '') : olderWhy(f.older));
    else if (f.olderMissing) s += '; MODIS has no count of its own for these dates';
  }
  return s + (f.early ? ' [early data]' : '') + '.';
}
async function compare(first, second, acting) {
  if (!first || !second) throw new Refusal('BAD_REQUEST', 'Give two things to compare: first {place, period} and second {place, period}.');
  // each side on its own: when one side has no answer, the other still comes back, with the reason for the missing one
  const oneSide = async (x) => { try { return { ok: await answer(x.place, x.period, false, true) }; } catch (e) { if (e instanceof Refusal) return { err: e }; throw e; } };
  const [sa, sb] = await Promise.all([oneSide(first), oneSide(second)]);
  if (sa.err || sb.err) {
    if (sa.err && sb.err) throw new Refusal(sa.err.code, 'First: ' + sa.err.message + '\nSecond: ' + sb.err.message, { first_refusal: { code: sa.err.code, message: sa.err.message }, second_refusal: { code: sb.err.code, message: sb.err.message } });
    const good = sa.ok || sb.ok, bad = sa.err || sb.err;
    const t = oneLine(good) + '\nNo comparison, because the ' + (sa.err ? 'first' : 'second') + ' side has no answer: ' + bad.message + (acting === true ? '\n\n' + ACT_LINE : '');
    return { text: t, data: { compared: false, first: sa.ok ? sa.ok.data : null, second: sb.ok ? sb.ok.data : null, first_refusal: sa.err ? { code: sa.err.code, message: sa.err.message } : null, second_refusal: sb.err ? { code: sb.err.code, message: sb.err.message } : null, direct_comparison: null, acting_now_line: acting === true ? ACT_LINE : null, unit: UNIT, next_questions: good.data.next_questions } };
  }
  const a = sa.ok, b = sb.ok;
  const same = a.file === b.file, lines = [];
  // the same place and the same dates under two spellings ("USA, 2020-09" and "United States, September 2020"): one answer, said once
  if (same && a.sel && b.sel && selName(a.sel) === selName(b.sel)) {
    // whichever side was asked as a fallback ("this year" when 2026 isn't in the record) carries its line, in either order
    const fbs = [a, b].map(x => x.data.period.fallback_line).filter(Boolean).filter((l, i, arr) => arr.indexOf(l) === i);
    const both = '"' + a.data.period.asked + '" and "' + b.data.period.asked + '"';
    const t = (a.data.period.asked === b.data.period.asked ? 'Those are the same place and the same dates, so here is the one answer:' : 'For ' + a.f.placeIn + ', ' + both + ' both come to ' + a.data.period.label + ', so here is the one answer:') + '\n' +
      (fbs.length && !a.data.period.fallback_line ? a.text.replace(/\n/, '\n' + fbs.join(' ') + '\n') : a.text);
    return { text: acting === true ? t + '\n\n' + ACT_LINE : t, data: { same_place: true, same_dates: true, identical: true, first: a.data, second: b.data, direct_comparison: null, acting_now_line: acting === true ? ACT_LINE : null, unit: UNIT, next_questions: a.data.next_questions } };
  }
  // different dates on the two sides: said first, before anything is set side by side
  const la = a.data.period.label, lb = b.data.period.label, sameDates = la === lb;
  if (!same && !sameDates) lines.push('Different dates: ' + a.f.place + '\'s ' + (first.period ? '' : 'newest ') + 'answer is for ' + la + ', ' + b.f.place + '\'s for ' + lb + '.');
  lines.push(oneLine(a), oneLine(b));
  // a side answered for other dates than asked (a fallback, or a season that stops at December): its line, once, after the answers
  const scoped = [a, b].filter(x => x.data.period.fallback_line);
  for (const x of scoped) lines.push(x.f.place + ' ("' + x.data.period.asked + '"): ' + x.data.period.fallback_line);
  const ra = a.f.ours.feel ? a.f.ours.feel.ratio : null, rb = b.f.ours.feel ? b.f.ours.feel.ratio : null;
  // counts side by side only for one place, the same kind of whole span, no unfinished month or year, and a reliable record with enough fire on both sides
  const reliable = (f) => f.lead === 'ours' && !f.ours.weak && !f.ours.tooFew && f.ours.value !== null && f.ours.value >= R.TOO_FEW && !f.partial;
  const like = same && a.f.kind === b.f.kind && a.f.kind !== 'yearSoFar' && reliable(a.f) && reliable(b.f);
  let direct = null;
  // MODIS's own counts on both sides (same place, same kind of whole span, both with enough fire): the same-source comparison
  const modisOk = (f) => f.older && f.older.value !== null && f.older.value >= R.TOO_FEW && !f.partial;
  const modisLike = same && a.f.kind === b.f.kind && a.f.kind !== 'yearSoFar' && modisOk(a.f) && modisOk(b.f);
  const xm = modisLike && b.f.older.value > 0 ? a.f.older.value / b.f.older.value : null;
  const modisCmp = xm === null ? null : { first: round(a.f.older.value), second: round(b.f.older.value), ratio: xm, source: 'MODIS alone' };
  // where our record is weak on both sides and MODIS leads both, MODIS's own counts are the comparison
  const modisDirect = !like && modisLike && a.f.lead === 'modis' && b.f.lead === 'modis';
  const lengthOf = (x) => x.f.partial && x.f.kind === 'month' ? R.numberWord(x.f.days) + ' days' : x.f.kind === 'yearSoFar' ? 'part of a year' : 'a whole ' + (x.f.kind === 'month' ? 'month' : x.f.kind);
  if (same && !like && !modisDirect) lines.push('The counts aren\'t set side by side: ' + (a.f.kind !== b.f.kind || a.f.partial !== b.f.partial ? la + ' covers ' + lengthOf(a) + ' and ' + lb + ' covers ' + lengthOf(b) : a.f.partial || b.f.partial ? 'both are unfinished' : 'our record has no solid verdict for at least one of them') + '. The two answers above say it.');
  if (like) {
    {
      const x = b.f.ours.value > 0 ? a.f.ours.value / b.f.ours.value : null, p = x === null ? null : Math.round(100 * (x - 1));
      const how = x === null ? '' : x >= 1.95 ? ': the first about ' + (Math.round(x) === 2 ? 'twice' : R.numberWord(Math.round(x)) + ' times') + ' the second' : x > 0 && x <= 0.51 ? ': the first about ' + (Math.round(100 * x)) + '% of the second' : p === 0 ? ': about the same' : ': the first about ' + Math.abs(p) + '% ' + (p > 0 ? 'more' : 'fewer');
      // whole months of different lengths: say so, so the ratio is read as month totals
      const daysIn = (ym) => new Date(Date.UTC(+ym.slice(0, 4), +ym.slice(5, 7), 0)).getUTCDate();
      const da = a.f.kind === 'month' ? daysIn(a.f.ym) : null, db = b.f.kind === 'month' ? daysIn(b.f.ym) : null;
      const lens = da && db && da !== db ? ' (whole-month totals: ' + da + ' and ' + db + ' days)' : '';
      lines.push('On our record, ' + a.data.period.label + ' had ' + R.detections(a.f.ours.value) + ' and ' + b.data.period.label + ' had ' + R.detections(b.f.ours.value) + how + lens + (scoped.length ? ', for the dates shown' : '') + '.');
      direct = { first: round(a.f.ours.value), second: round(b.f.ours.value), ratio: x, source: 'our record', measure: 'whole-period totals on our record', days: da && db ? [da, db] : null };
      // MODIS on its own went the other way: said plainly, with its own counts
      if (xm !== null && x !== null && Math.abs(x - 1) > 0.1 && Math.abs(xm - 1) > 0.1 && Math.sign(x - 1) !== Math.sign(xm - 1))
        lines.push('MODIS alone went the opposite way: ' + a.data.period.label + ' had ' + R.fmt(a.f.older.value) + ' and ' + b.data.period.label + ' had ' + R.fmt(b.f.older.value) + ratioWords(xm) + '. The two series point opposite ways here.');
    }
  } else if (modisDirect) {
    lines.push('On MODIS\'s own count, which leads both answers here, ' + a.data.period.label + ' had ' + R.detections(a.f.older.value) + ' and ' + b.data.period.label + ' had ' + R.detections(b.f.older.value) + ratioWords(xm) + (scoped.length ? ', for the dates shown' : '') + '.');
    direct = Object.assign({ measure: 'whole-period totals on MODIS alone (our record is weak here)' }, modisCmp);
  } else if (!same) lines.push('Each one is set against its own usual for those dates.');
  const nq = a.f.kind === 'year' || a.f.kind === 'month' ? { text: 'Want ' + a.f.year + ' in ' + a.f.placeIn + ' month by month?', tool: 'place_record', arguments: { place: a.f.place, view: 'months', year: a.f.year } } : { text: 'Want the latest answer for ' + a.f.placeIn + '?', tool: 'fire_answer', arguments: { place: a.f.place } };
  lines.push('', nq.text);
  if (acting === true) lines.push('', ACT_LINE);   // always the last line
  return { text: lines.join('\n'), data: { same_place: same, same_dates: sameDates, first_dates: la, second_dates: lb, direct_comparison: direct, modis_comparison: modisCmp, first: a.data, second: b.data, first_vs_its_usual: ra, second_vs_its_usual: rb, acting_now_line: acting === true ? ACT_LINE : null, unit: UNIT, next_questions: [nq] } };
}

module.exports = { memorable, strip, FuturePeriod, patterns, CAUTION, NASA_CAUTION, UNIT, ACT_LINE, answer, record, trust, sentence, find, compare, Refusal, resolvePlace, parsePeriod, result, R, E, VENDOR };
