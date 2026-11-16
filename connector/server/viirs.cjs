/* Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md. */
// viirs.cjs: viirs_scale, the record read on the newer camera's scale ("what would VIIRS have counted in 2005?").
// The team lead's ruling (Nov 14, 2026, about 2:30 PM): "Yes, build it". Method: round_SAT\reverse_join\REVERSE_JOIN.md.
// Every month of our record divided by its own conversion number (S-NPP onto MODIS Aqua, learned 2012 to 2021) gives S-NPP's scale;
// from 2012 on VIIRS's own count is given beside it. Before 2012 every number is an estimate, never "VIIRS counted".
// The wording of these answers is a first version.
'use strict';
const fire = require('./fire.cjs');
const R = fire.R, MONTHS = R.MONTHS;

const WORLD = require(require('path').join(fire.VENDOR, 'data', 'world_table.json'));
const WORLD_ROW = (file) => WORLD.rows.find(w => w.file === file) || null;
const fmt = (n) => Math.round(n).toLocaleString('en-US');
const about = (n) => { if (n < 100) return fmt(n); const p = Math.pow(10, Math.floor(Math.log10(n)) - 2); return 'about ' + (Math.round(n / p) * p).toLocaleString('en-US'); };
const median = (a) => { if (!a.length) return null; const b = a.slice().sort((x, y) => x - y), k = b.length >> 1; return b.length % 2 ? b[k] : (b[k - 1] + b[k]) / 2; };
const moOf = (ym) => +ym.slice(5, 7), yOf = (ym) => +ym.slice(0, 4);
const monthName = (ym) => MONTHS[moOf(ym) - 1] + ' ' + yOf(ym);

// one month on S-NPP's scale: our record's value divided by that month-of-year's number; VIIRS's own count from 2012 where it has one
function upMonth(r, row) {
  const f = r.factors.SNPP.f[moOf(row.ym) - 1];
  const up = row.value === null || row.value === undefined || !(f > 0) ? null : row.value / f;
  // VIIRS's own count follows the camera that carried the month: NOAA-20 (put on S-NPP's scale) where it did, or where S-NPP was short
  // (S-NPP's science data stopped on Nov 2, 2026); S-NPP's own count otherwise
  const raw = row.raw || {}, g = r.factors.NOAA20_onto_SNPP, has = (v) => v !== null && v !== undefined;
  const noaa = has(raw.NOAA20) && g > 0 ? { camera: 'VIIRS on NOAA-20, put on S-NPP\'s scale', count: raw.NOAA20 * g } : null;
  const snpp = has(raw.SNPP) && !(row.short && row.short.SNPP) ? { camera: 'VIIRS on S-NPP', count: raw.SNPP } : null;
  const own = row.carrier === 'NOAA20' ? (noaa || snpp) : (snpp || noaa);
  return { ym: row.ym, up, own: yOf(row.ym) >= 2012 ? own : null, modis_scale: row.value, factor: f, partial: row.status === 'partial', zero_before: row.value === 0 && yOf(row.ym) < 2012 };
}

function parse(r, periodQ) {
  const s = String(periodQ === undefined || periodQ === null ? '' : periodQ).trim().toLowerCase();
  if (!s || s === 'latest') return { month: R.positions(r).latestYm };
  let m;
  if ((m = /^(\d{4})$/.exec(s))) return { year: +m[1] };
  const sel = fire.parsePeriod(r, periodQ);
  if (sel && sel.month) return { month: sel.month };
  if (sel && sel.year !== undefined) return { year: sel.year };
  throw new fire.Refusal('BAD_PERIOD', 'viirs_scale takes a year ("2005") or a month ("2005-08", "August 2005").');
}

async function viirsScale(placeQ, periodQ) {
  const file = await fire.resolvePlace(placeQ), place = R.displayName(file), placeIn = R.inSentence(place), r = await fire.result(file);
  if (!R.positions(r).latestYm) throw new fire.Refusal('NO_USABLE_MONTHS', cap1(placeIn) + ' has no month with usable data in this record, so there is nothing to put on VIIRS\'s scale.');
  const sn = r.factors && r.factors.SNPP;
  if (!sn || !Array.isArray(sn.f) || sn.mode === 'none' || sn.f.every(x => !(x > 0)))
    throw new fire.Refusal('NO_UPWARD_CONVERSION', cap1(placeIn) + ' is put on MODIS\'s scale with a curve shared by the whole world, which only runs one way, so there is no VIIRS-scale number for it. fire_answer has its answer on MODIS\'s scale.', { place });
  const sel = parse(r, periodQ), sc = R.score(r), weak = sc.rule === 'one' || (sc.rule === 'twelve' && sc.typicalPct > 25);
  const rows = r.monthly.filter(x => sel.month ? x.ym === sel.month : yOf(x.ym) === sel.year);
  if (sel.month && sel.month >= r.record_starts && sel.month <= r.record_ends && !(sn.f[moOf(sel.month) - 1] > 0))
    throw new fire.Refusal('NO_COUNT_ON_THIS_SCALE', monthName(sel.month) + ' has no count on VIIRS\'s scale: ' + placeIn + '\'s conversion number for ' + MONTHS[moOf(sel.month) - 1] + ' is 0, so nothing can be scaled up. fire_answer has that month on MODIS\'s scale.', { place });
  if (!rows.length || rows.every(x => x.value === null || x.value === undefined))
    throw new fire.Refusal('OUT_OF_COVERAGE', (sel.month ? monthName(sel.month) : String(sel.year)) + ' is outside ' + placeIn + '\'s record, which runs from ' + monthName(r.record_starts) + ' to ' + monthName(r.record_ends) + '.', { place });
  const ups = rows.map(x => upMonth(r, x));
  const missing = ups.filter(u => u.up === null).length, partial = ups.some(u => u.partial);
  const noFactor = ups.filter(u => !(u.factor > 0)).map(u => u.ym);   // months with no count on this scale (a conversion number of 0)
  if (sel.month && noFactor.length) throw new fire.Refusal('NO_COUNT_ON_THIS_SCALE', monthName(sel.month) + ' has no count on VIIRS\'s scale: ' + placeIn + '\'s conversion number for ' + MONTHS[moOf(sel.month) - 1] + ' is 0, so nothing can be scaled up. fire_answer has that month on MODIS\'s scale.', { place });
  const total = ups.reduce((a, u) => a + (u.up || 0), 0), modisScale = ups.reduce((a, u) => a + (u.modis_scale || 0), 0);
  const label = sel.month ? (partial && r.current ? MONTHS[moOf(sel.month) - 1] + ' 1–' + r.current.days + ', ' + yOf(sel.month) : monthName(sel.month)) : String(sel.year);
  const wholeYear = !sel.month && rows.length === 12 && !missing && !partial;   // a year with a 0-number month is not whole on this scale
  // the usual on VIIRS's scale: the same dates in every other year, each scaled up the same way (one number per month cancels in a month's comparison)
  let usual = null, usualModis = null;
  if (sel.month && !partial) {
    const others = r.monthly.filter(x => moOf(x.ym) === moOf(sel.month) && x.ym !== sel.month && x.status !== 'partial' && x.value !== null && x.value !== undefined).map(x => upMonth(r, x).up);
    usual = others.length >= 5 ? median(others) : null;
    const othersM = r.monthly.filter(x => moOf(x.ym) === moOf(sel.month) && x.ym !== sel.month && x.status !== 'partial' && x.value !== null && x.value !== undefined).map(x => x.value);
    usualModis = othersM.length >= 5 ? median(othersM) : null;
  } else if (wholeYear) {
    const byY = new Map(); for (const x of r.monthly) { if (x.status === 'partial' || x.value === null || x.value === undefined) continue; const y = yOf(x.ym); if (!byY.has(y)) byY.set(y, []); byY.get(y).push(upMonth(r, x).up); }
    const tots = [...byY.entries()].filter(([y, a]) => y !== sel.year && a.length === 12 && a.every(v => v !== null)).map(([, a]) => a.reduce((s, v) => s + v, 0));
    usual = tots.length >= 5 ? median(tots) : null;
    const byYM = new Map(); for (const x of r.monthly) { if (x.status === 'partial' || x.value === null || x.value === undefined) continue; const y = yOf(x.ym); byYM.set(y, (byYM.get(y) || []).concat([x.value])); }
    const totsM = [...byYM.entries()].filter(([y, a]) => y !== sel.year && a.length === 12).map(([, a]) => a.reduce((t, v) => t + v, 0));
    usualModis = totsM.length >= 5 ? median(totsM) : null;
  }
  const feel = usual !== null && usualModis !== null && modisScale >= R.TOO_FEW && usualModis >= R.TOO_FEW ? R.feel(total, usual) : null;   // the floor on MODIS's scale, as on the page
  const counted = ups.filter(u => u.up !== null), before2012 = ups.filter(u => yOf(u.ym) < 2012).length, ownSum = counted.length && counted.every(u => u.own) ? counted.reduce((a, u) => a + u.own.count, 0) : null;
  const terra = rows.some(x => x.carrier === 'Terra'), zeros = ups.filter(u => u.zero_before).length;

  const out = [];
  // a year with a month that has no count on this scale: no total (as on the page), and that month named
  const noTotal = !sel.month && noFactor.length > 0;
  if (noTotal) out.push(possessive(placeIn) + ' ' + label + ' has no total on VIIRS\'s scale: ' + noFactor.map(monthName).join(' and ') + (noFactor.length === 1 ? ' has' : ' have') + ' no count on this scale (' + (noFactor.length === 1 ? 'its conversion number is' : 'their conversion numbers are') + ' 0). Ask for any other month of ' + label + ' by name.');
  else out.push(possessive(placeIn) + ' ' + label + ' on VIIRS\'s scale: ' + about(total) + ' fire detections' + (missing ? ' (from the ' + R.numberWord(rows.length - missing) + ' months with data)' : '') + '.');
  if (before2012) out.push(before2012 === ups.length
    ? 'That\'s an estimate of what a camera like VIIRS would have counted: VIIRS started in 2012, so MODIS\'s ' + fmt(modisScale) + ' were scaled up month by month with ' + placeIn + '\'s own conversion numbers, learned on 2012 to 2021.'
    : 'Its months before 2012 are an estimate of what a camera like VIIRS would have counted, scaled up from MODIS with ' + placeIn + '\'s own conversion numbers, learned on 2012 to 2021.');
  if (ownSum !== null && !noTotal) out.push('VIIRS\'s own count for ' + (sel.month ? 'that month' : missing ? 'the same months' : 'that year') + ': ' + fmt(ownSum) + ' (' + [...new Set(counted.map(u => u.own.camera))].join(' and ') + '); on MODIS\'s scale, our record has ' + fmt(modisScale) + '.');
  if (feel) out.push('Against a typical ' + (sel.month ? MONTHS[moOf(sel.month) - 1] : 'year') + ' on the same scale (' + about(usual) + '), that\'s ' + feel.phrase + '.');
  if (weak) out.push('Our record is weak for ' + placeIn + ', and so is this scale-up: where our record is weak for a place, MODIS\'s own count leads.');
  else if (sc.typicalPct !== null && sc.typicalPct !== undefined) {
    // the reverse-join test: busy places convert as well going up as going down; quiet places come out worse going up (a month MODIS saw as empty stays empty)
    const busy = !!(WORLD_ROW(file) || {}).busy;
    out.push((busy ? 'The conversion holds about as well going up as going down: in' : 'In') + ' past tests here, with each year left out in turn when learning its conversion numbers, a typical month landed within about ' + Math.round(sc.typicalPct) + '%' +
      (busy ? '.' : ' going down; going up comes out worse where months are small, because a month MODIS saw as empty stays empty.'));
  }
  if (terra) out.push('Before mid-2002 this stacks two conversions (MODIS on Terra onto Aqua, then onto VIIRS).');
  if (zeros) out.push(cap1(R.numberWord(zeros)) + ' of its months had no MODIS detections, and those stay at zero on any scale.');
  if (partial) out.push('Early data: these days come from NASA\'s rapid feed and can still change.');
  const nq = { text: 'Want ' + placeIn + '\'s answer for those dates on MODIS\'s scale?', tool: 'fire_answer', arguments: { place, period: sel.month || String(sel.year) } };
  out.push('', nq.text);
  return { text: out.join('\n'), data: {
    kind: 'viirs_scale', place, place_file: file, period: { label, month: sel.month || null, year: sel.month ? yOf(sel.month) : sel.year, complete: !partial && !missing && (sel.month ? true : rows.length === 12) },
    no_count_on_this_scale: noFactor,
    viirs_scale: { detections: noTotal ? null : Math.round(total), detections_exact: noTotal ? null : total, no_total_reason: noTotal ? 'a month with no count on this scale' : null, scale: 'VIIRS on S-NPP', estimate_months_before_2012: before2012, usual: usual === null ? null : Math.round(usual), compared_with_usual: feel ? feel.phrase : null, percent_vs_usual: feel ? feel.pct : null },
    modis_scale: { detections: Math.round(modisScale), detections_exact: modisScale },
    viirs_own: ownSum === null ? null : { detections: Math.round(ownSum), cameras: [...new Set(counted.map(u => u.own.camera))] },
    months: ups.map(u => ({ month: u.ym, viirs_scale: u.up === null ? null : Math.round(u.up), modis_scale: u.modis_scale === null ? null : Math.round(u.modis_scale), conversion_number: Math.round(u.factor * 10000) / 10000, viirs_own: u.own ? Math.round(u.own.count) : null, estimate: yOf(u.ym) < 2012 })),
    method: 'each month of our record divided by that month-of-year\'s conversion number (S-NPP onto MODIS Aqua, learned 2012 to 2021); before 2012 an estimate, never a VIIRS count',
    weak_record: weak, typical_miss_pct: sc.typicalPct === null || sc.typicalPct === undefined ? null : Math.round(sc.typicalPct * 10) / 10, unit: fire.UNIT, next_questions: [nq] } };
}
const cap1 = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;
const possessive = (p) => { const n = cap1(p); return /s$/.test(n) ? n + '\'' : n + '\'s'; };

const PLACE = { type: 'string', minLength: 1, maxLength: 80, description: 'A country or territory, by its everyday name ("Argentina"). For a city, park or province, use its country and say so ("Córdoba is in Argentina; here\'s Argentina").' };
const TOOL = { name: 'viirs_scale', title: 'The record on VIIRS\'s scale (what would VIIRS have counted?)',
  description: 'A place\'s year or month on the newer VIIRS camera\'s scale: our record scaled up month by month with that place\'s own conversion numbers (learned 2012 to 2021), with VIIRS\'s own count beside it from 2012 on, and how it compares with a typical year or month on the same scale. Before 2012 every number is an estimate of what a camera like VIIRS would have counted, never a VIIRS count. Places converted with the worldwide curve have no VIIRS-scale number.',
  inputSchema: { type: 'object', additionalProperties: false, properties: { place: PLACE, period: { type: 'string', maxLength: 40, description: 'A year ("2005") or a month ("2005-08", "August 2005"). Default: the newest month.' } }, required: ['place'] },
  annotations: { readOnlyHint: true, destructiveHint: false, idempotentHint: true, openWorldHint: false } };
const INSTRUCTIONS = 'For "what would VIIRS have counted?" or numbers on today\'s camera\'s scale, call viirs_scale. Before 2012 say "an estimate of what a camera like VIIRS would have counted", never "VIIRS counted"; a verdict for a month is the same on either scale.';

module.exports = { viirsScale, TOOL, INSTRUCTIONS, upMonth };
