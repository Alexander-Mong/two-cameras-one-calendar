// now.cjs: fire_now, one answer for "is it burning right now, and is that normal?": NASA's 24-hour file (nasa.cjs) together with the
// 26-year record's answer for the same place (fire.cjs). The delight pass, item 1.
'use strict';
const fire = require('./fire.cjs');
const nasa = require('./nasa.cjs');
const SRC = require('./nasa_sources.json');
const R = fire.R;

const NASA_NAME = new Map(SRC.countries.map(c => [c.file, c.name]));
const SAY_CAM = new Map([['MODIS', 'MODIS'], ['VIIRS NOAA-20', 'VIIRS on NOAA-20'], ['VIIRS NOAA-21', 'VIIRS on NOAA-21'], ['VIIRS S-NPP', 'VIIRS on S-NPP']]);
const MONTHS = R.MONTHS;
const LIVE_MAP = ['https', '://', SRC.host, SRC.live_map_path].join('');   // built from the host: no full web address in the files
const nowMs = () => process.env.FIRE_CONNECTOR_NOW && isFinite(Date.parse(process.env.FIRE_CONNECTOR_NOW)) ? Date.parse(process.env.FIRE_CONNECTOR_NOW) : Date.now();
function ago(iso) {
  const mins = Math.round((nowMs() - Date.parse(iso)) / 60000);
  if (!isFinite(mins)) return null; if (mins < 90) return 'about ' + Math.max(1, mins) + ' minutes ago';
  const h = Math.round(mins / 60); return h < 48 ? 'about ' + h + ' hours ago' : 'about ' + Math.round(h / 24) + ' days ago';
}
const lower1 = (s) => s ? s.charAt(0).toLowerCase() + s.slice(1) : s;
const SHORT = (iso) => iso.slice(11, 16) + ' UTC ' + new Date(iso).toLocaleDateString('en-US', { month: 'short', day: 'numeric', timeZone: 'UTC' });
const cap1 = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

async function fireNow(placeQ, actingNow) {
  const file = await fire.resolvePlace(placeQ);   // refuses an unknown place plainly, before any fetch
  const place = R.displayName(file), placeIn = R.inSentence(place);
  const nasaName = NASA_NAME.get(file) || null;
  // the live part and the historical part run on their own: one failing never takes the other down
  const history = (async () => { try { const r = await fire.result(file); return { r, rec: await fire.answer(place, 'latest') }; } catch (e) { return { err: e }; } })();
  const [nasaRes, hist] = await Promise.all([nasaName ? nasa.call('nasa_recent', { place: nasaName }) : Promise.resolve(null), history]);
  const out = [];
  // 1. what NASA's 24-hour file shows, as a fact (one camera's count: MODIS and VIIRS counts are never added)
  let nasaData = null, seen = null, newestAny = null, quoted = null;
  if (!nasaName) out.push('We don\'t have a box around ' + placeIn + ' for NASA\'s recent files, so there\'s no count from NASA\'s 24-hour file here; nasa_recent takes a box of latitude and longitude.');
  else if (nasaRes.isError) out.push('We don\'t know what\'s burning in ' + placeIn + ' this hour: ' + lower1(nasaRes.content[0].text.replace(/^We don't know( right now)?: /, '')));
  else {
    nasaData = nasaRes.structuredContent;
    const nBoxes = nasaData.coverage && Array.isArray(nasaData.coverage.boxes) ? nasaData.coverage.boxes.length : 1;
    const boxWords = nBoxes > 1 ? 'in the ' + (['', 'one', 'two', 'three', 'four', 'five'][nBoxes] || nBoxes) + ' boxes around ' + place + ', which take in nearby areas' : 'in the box around ' + place + ', which takes in nearby areas';
    const all = nasaData.cameras || [];
    const cams = all.filter(c => c.detections > 0).sort((a, b) => b.detections - a.detections);
    const withNew = all.filter(c => c.newest_utc).sort((a, b) => Date.parse(b.newest_utc) - Date.parse(a.newest_utc));
    if (withNew.length) newestAny = { camera: withNew[0].camera, utc: withNew[0].newest_utc };
    if (cams.length) {
      const lead = cams[0], when = lead.newest_utc ? ago(lead.newest_utc) : null;
      const within = Number.isInteger(lead.within_window_before_fetch) ? lead.within_window_before_fetch : null;
      seen = { camera: lead.camera, detections: lead.detections, within_window_before_fetch: within, newest_utc: lead.newest_utc || null };
      const wl = nasaData.window_label || 'NASA\'s 24-hour file', span = lead.oldest_utc && lead.newest_utc ? ', observed between ' + SHORT(lead.oldest_utc) + ' and ' + SHORT(lead.newest_utc) : '';
      if (lead.oldest_utc && lead.newest_utc) quoted = { camera: lead.camera, from_utc: lead.oldest_utc, to_utc: lead.newest_utc };
      // the file's count, then the exact 24 hours before the fetch: NASA's file can hold older observations
      const hrs = nasaData.trailing_window && nasaData.trailing_window.hours, before = hrs === 168 ? 'the 7 days' : 'the ' + hrs + ' hours';
      const trail = within !== null && hrs ? '; ' + (within === lead.detections ? 'all of them' : within === 0 ? 'none of them' : within.toLocaleString('en-US') + ' of them') + ' in ' + before + ' before it was fetched' : '';
      out.push(wl + ' shows fire ' + lead.detections.toLocaleString('en-US') + ' times ' + boxWords + ' (' + (SAY_CAM.get(lead.camera) || lead.camera) + ')' + span + trail + '.' + (when ? ' The newest was ' + when + '.' : ''));
    } else out.push((nasaData.window_label || 'NASA\'s 24-hour file') + ' shows no fire ' + boxWords.replace(/, which takes? in nearby areas$/, '') + '.');
  }
  // 2. is that normal? Only the 26-year record says, and only for dates it covers
  let r = null, rec = null, next = null, histNote = null;
  if (hist.err) {
    histNote = hist.err.code || 'error';
    out.push('Our 26-year record has no usable month for ' + place + ', so there\'s no "normal" to compare with.');
    if (nasaName) next = { text: 'Want the last 7 days of NASA\'s fire detections around ' + place + '?', tool: 'nasa_recent', arguments: { place: nasaName, window: '7d' } };
  } else {
    r = hist.r; rec = hist.rec;
    const pos = R.positions(r);
    if (r.current) {
      const first = rec.text.split('\n')[0];
      out.push('On the 26-year record, ' + first.replace(/^The /, 'the '));
      for (const q of (rec.data.qualifiers || [])) out.push(q);
      const nq = (rec.data.next_questions || [])[0];
      if (nq && nq.tool !== 'fire_now') next = nq;
    } else {
      const ms = R.seasonMonths(r), m0 = new Date(nowMs()).getUTCMonth() + 1, inSeason = ms.indexOf(m0) >= 0;
      const ends = MONTHS[+pos.latestYm.slice(5, 7) - 1] + ' ' + pos.latestYm.slice(0, 4);
      out.push((seen ? 'Whether that\'s a lot for this time of year, we don\'t know: our 26-year record for ' + placeIn + ' runs to ' + ends + '.' : 'Our 26-year record for ' + placeIn + ' runs to ' + ends + ', so it doesn\'t cover now.') +
        (ms.length ? ' Its fire season usually runs from ' + MONTHS[ms[0] - 1] + ' to ' + MONTHS[ms[ms.length - 1] - 1] + (inSeason ? ', and we\'re in it now.' : ', and we\'re outside it now.') : ''));
      if (actingNow !== true) next = { text: 'Want the patterns to watch for ' + placeIn + '\'s next season?', tool: 'fire_answer', arguments: { place, period: 'next season' } };
    }
  }
  if (actingNow === true && next && next.tool === 'fire_answer' && /season/i.test(JSON.stringify(next.arguments || {}))) next = null;   // asked about now: no future season
  // 3. the next question (never fire_now again), then, when acting now, the authorities line LAST
  if (next && actingNow !== true) out.push('', next.text);
  if (actingNow === true) out.push('', fire.ACT_LINE + ' NASA\'s live map shows these same detections: ' + LIVE_MAP);
  return { text: out.join('\n'), data: { kind: 'fire_now', place, place_file: file, nasa_last_24h: nasaData ? { seen, newest_any: newestAny, cameras: nasaData.cameras, box: nasaData.box, window_label: nasaData.window_label || null, observed_from_utc: nasaData.observed_from_utc || null, observed_to_utc: nasaData.observed_to_utc || null, quoted_camera_range: quoted, trailing_window: nasaData.trailing_window || null, coverage_mode: nasaData.coverage_mode || null, coverage: nasaData.coverage || null, files: (nasaData.files || []).map(f => ({ camera: f.camera, nasa_last_updated: f.nasa_last_updated, fetched_utc: f.fetched_utc, rows_in_file: f.rows_in_file })) } : null,
    nasa_note: !nasaName ? 'no box for this place' : nasaRes && nasaRes.isError ? (nasaRes.structuredContent && nasaRes.structuredContent.refusal ? nasaRes.structuredContent.refusal.code : 'error') : null,
    record: rec ? rec.data : null, record_note: histNote, record_is_current: !!(r && r.current), next_questions: next && actingNow !== true ? [next] : [], unit: fire.UNIT, nasa_unit: 'A NASA detection is one satellite pass seeing fire in one spot. NASA\'s recent counts are not on the 26-year record\'s scale; "normal" comes only from the record.' } };
}

const TOOL = { name: 'fire_now', title: 'Is it burning right now, and is that normal?',
  description: 'One answer for "now": what NASA\'s satellites saw in and around a country, from NASA\'s file labeled 24h (straight from NASA FIRMS; NASA updates it through the day, so its observations can be older than 24 hours; the answer also says how many came in the 24 hours before the file was fetched), together with the 26-year record\'s answer for the same place: whether its latest dates are normal, or, where the record ends earlier, when its fire season runs.',
  inputSchema: { type: 'object', additionalProperties: false, properties: {
    place: { type: 'string', minLength: 1, maxLength: 80, description: 'A country or territory, by its everyday name. For a city, park or province, use its country and say so ("Córdoba is in Argentina; here\'s Argentina").' },
    acting_now: { type: 'boolean', description: 'Set true only when the person is asking what to do right now or where to go; the answer then ends with one line pointing to local authorities and NASA\'s live map.' } }, required: ['place'] } };

module.exports = { fireNow, TOOL };
