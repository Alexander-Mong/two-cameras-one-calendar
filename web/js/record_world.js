// record_world.js: the record's world tab. The map is the place picker AND the picture of where the join can be trusted ("Name a country").
// Classes are carried by pattern or outline as well as color; a search box does the same as a tap, by name (the keyboard path).
// Scores come from data/world_table.json (built by tools/build_tables.cjs from the engine).
(function (root) {
  'use strict';
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const TOP = 840, BOTTOM = -580;   // tenths of a degree: the map shows 84 N to 58 S (Antarctica is in the search box)
  const ORDER = ['p10', 'p15', 'p25', 'p25plus', 'one', 'noscore', 'quiet', 'nodata'];
  const DEFS = '<defs>' +
    '<pattern id="pat-p15" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#b9ad90"/><path d="M0 5H10" stroke="#060e19" stroke-width="1.6"/></pattern>' +
    '<pattern id="pat-p25" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#7e7866"/><circle cx="5" cy="5" r="2" fill="#060e19"/></pattern>' +
    '<pattern id="pat-p25plus" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#4d4a40"/><path d="M0 0L10 10M10 0L0 10" stroke="#060e19" stroke-width="1.4"/></pattern>' +
    '<pattern id="pat-one" width="10" height="10" patternUnits="userSpaceOnUse"><rect width="10" height="10" fill="#3a2016"/><path d="M-2 12L12 -2" stroke="#ff7541" stroke-width="2.4"/></pattern>' +
    '<pattern id="pat-quiet" width="12" height="12" patternUnits="userSpaceOnUse"><rect width="12" height="12" fill="#112537"/><circle cx="6" cy="6" r="1.4" fill="#a5b2c2"/></pattern>' +
    '</defs>';
  const swatch = (cls) => '<svg class="sw" width="26" height="16" viewBox="0 0 26 16" aria-hidden="true"><rect x="1" y="1" width="24" height="14" ' + fillOf(cls) + '/></svg>';
  function fillOf(cls) {
    return { p10: 'fill="#e9dfc4" stroke="#7693a5"', p15: 'fill="url(#pat-p15)" stroke="#7693a5"', p25: 'fill="url(#pat-p25)" stroke="#7693a5"', p25plus: 'fill="url(#pat-p25plus)" stroke="#7693a5"',
      one: 'fill="url(#pat-one)" stroke="#ff7541"', noscore: 'fill="#112537" stroke="#a5b2c2" stroke-dasharray="2 2"', quiet: 'fill="url(#pat-quiet)" stroke="#7693a5"', nodata: 'fill="#112537" stroke="#7693a5"' }[cls];
  }
  // the class names in plain words (the world table keeps its own codes and labels)
  const CLASS_SAY = { p10: 'within 10%', p15: '10 to 15%', p25: '15 to 25%', p25plus: 'more than 25%', one: 'one number for the year: unreliable', noscore: 'no fair score', quiet: 'too quiet to compare', nodata: 'no usable month' };
  function pathOf(rings) { return rings.map(r => 'M' + r.map(([x, y]) => (x + 1800) + ' ' + (TOP - y)).join('L') + 'Z').join(''); }

  async function render(p, ctx) {
    const R = root.Readings, w = ctx.world;
    if (!w) { p.innerHTML = '<div class="message">Nothing to show here: the world table did not load.</div>'; return; }
    p.innerHTML = '<div class="head-row"><h2>Where can you <em>trust this?</em></h2></div><p class="loading">Drawing the map…</p>';
    let shapes; try { shapes = await ctx.loadShapes(); } catch (e) { shapes = null; }
    if (!p.isConnected) return;
    const rowOf = {}; for (const r of w.rows) rowOf[r.file] = r;
    const paths = shapes ? shapes.shapes.slice().sort((a, b) => (a.file === ctx.place) - (b.file === ctx.place)).map(s => { const r = rowOf[s.file]; if (!r) return '';
      return '<path class="c-' + r.cls + (s.file === ctx.place ? ' chosen' : '') + '" data-file="' + esc(s.file) + '" d="' + pathOf(s.rings) + '"><title>' + esc(r.name) + ': ' + esc(CLASS_SAY[r.cls] || w.classes[r.cls]) + '</title></path>'; }).join('') : '';
    const chosenPath = shapes ? shapes.shapes.find(s => s.file === ctx.place) : null;
    const counts = w.summary.class_counts;
    const s = w.summary;
    // the legend at exact size (fix round, item 7): counts are country files
    const item = (c, text) => counts[c] ? '<li>' + swatch(c) + text + '</li>' : '';
    const legend = '<li style="grid-column:1/-1;color:var(--dim)">Busy countries with twelve monthly numbers (' + s.busy_twelve + '), by how far our record usually missed MODIS:</li>' +
      item('p10', 'within 10% <span class="dim">(' + (counts.p10 || 0) + ')</span>') + item('p15', '10 to 15% <span class="dim">(' + (counts.p15 || 0) + ')</span>') +
      item('p25', '15 to 25% <span class="dim">(' + (counts.p25 || 0) + ')</span>') + item('p25plus', 'more than 25% <span class="dim">(' + (counts.p25plus || 0) + ')</span>') +
      '<li style="grid-column:1/-1;color:var(--dim)">Every other country file:</li>' +
      item('one', 'one number for the whole year: weak; MODIS leads when it can judge <span class="dim">(' + counts.one + (s.one_busy ? ', ' + s.one_busy + ' of them busy' : '') + ')</span>') +
      item('noscore', 'no fair score: ' + s.noscore_unscored + ' couldn\'t be tested, ' + s.noscore_curve + ' use the curve shared by the whole world') +
      item('quiet', 'scored, but too quiet to compare (under 50 detections in a typical month) <span class="dim">(' + counts.quiet + ')</span>') +
      item('nodata', 'no usable month <span class="dim">(' + counts.nodata + ')</span>');
    p.innerHTML = '<div class="head-row"><h2>Where can you <em>trust this?</em></h2><span class="note">How close our record came to MODIS\'s own count, each year left out in turn when learning its conversion numbers. Tap a country.</span></div>' +
      '<div class="world"><div>' +
      (shapes ? '<svg class="map" viewBox="0 0 3600 ' + (TOP - BOTTOM) + '" role="img" aria-label="World map of how far the join missed in each country; use the search box to choose a country by name">' + DEFS + paths +
        '</svg>' : '<div class="message">The map outlines did not load; the search box still works.</div>') +
      '<ul class="legend">' + legend + '</ul><p class="note" style="margin-top:6px">Counts are country files, including a few too small to draw.</p>' +
      '<p class="note" style="margin-top:10px">Of the ' + s.busy + ' busiest countries, ' + s.within10 + ' land within 10% of MODIS, ' +
        s.within15 + ' within 15% and ' + s.within25 + ' within 25%; the one in the middle, about ' + Math.round(s.middle_busy_pct) + '% (' + s.middle_busy_pct.toFixed(1) + '%).' +
        (s.failing.length ? ' The ' + R.numberWord(s.failing.length) + ' that missed worst all use one number for the whole year.' : '') + ' (' + s.files + ' country files; ' + s.scored + ' could be tested.)</p>' +
      '<p class="note">"Busiest": a typical tested month of 50 detections or more. Outlines: Natural Earth, simplified; some small islands and overseas regions are drawn with their country, or found by name in the search box.</p></div>' +
      '<aside><div class="search"><label class="note" for="w-q">Find a country by name</label><input id="w-q" type="search" autocomplete="off" placeholder="Type a country name"></div>' +
      '<ul class="choices" id="w-list" style="max-height:220px"></ul><div class="side" id="w-side" style="margin-top:12px" aria-live="polite"></div></aside></div>';
    const side = p.querySelector('#w-side');
    side.innerHTML = info(rowOf[ctx.place], w, R);
    const pick = (file) => { if (file !== ctx.place) ctx.setPlace(file); };
    for (const el of p.querySelectorAll('.map path')) el.addEventListener('click', () => pick(el.dataset.file));
    const q = p.querySelector('#w-q'), list = p.querySelector('#w-list');
    if (root.AppPicker) { const fill = () => root.AppPicker.fillChoices(list, q.value, pick); q.addEventListener('input', fill); root.AppPicker.listKeys(q, list, pick, null); list.innerHTML = '<li class="note" style="padding:6px 2px">Type to list matching countries.</li>'; }
  }
  function info(r, w, R) {
    if (!r) return '<p>Choose a country on the map or by name.</p>';
    const per = r.period, inS = R.inSentence(r.name);
    let h = '<h3 class="wrap">' + esc(r.name) + '</h3><p style="margin:0 0 8px">' + swatch(r.cls) + esc(CLASS_SAY[r.cls] || w.classes[r.cls]) + '</p>';
    if (r.refused) { h += '<p class="why">There\'s no month with usable data for ' + esc(inS) + ' in this record.</p>'; return h; }
    // what happened first, the counts second, then how far to trust it
    if (per) {
      const weakHere = r.rule === 'one' || r.rule === 'curve' || r.rule === 'none' || (r.rule === 'twelve' && r.typical_pct !== null && r.typical_pct > 25);   // the answer screen's rule (Readings.weakLine)
      const lead = per.word ? 'ours' : weakHere && per.older && per.older.word ? 'modis' : 'none';
      const fo = R.feel(per.ours, per.typical), fm = per.older ? R.feel(per.older.value, per.older.typical) : null;
      let said;
      if (lead === 'ours') said = R.say(per.word) + (fo ? ': ' + R.amountOf(fo.phrase) : '');
      else if (lead === 'modis') said = R.say(per.older.word) + ', going by MODIS' + (fm ? ': ' + R.amountOf(fm.phrase, 'its') : '');
      else said = (per.tooFew ? 'Too little fire to judge on our record' : 'No fair verdict from our record') + (per.older && per.older.word ? '. MODIS alone reads ' + R.say(per.older.word).toLowerCase() : '');
      h += '<p class="mm-verdict' + (lead === 'none' ? ' nil' : '') + '" style="margin:0">' + esc(per.label) + ': ' + esc(said.charAt(0).toLowerCase() + said.slice(1)) + '.</p>';
      h += '<p class="why">' + esc(R.detections(per.ours)) + ' on our record' + (per.typical === null ? '' : '; ' + esc(R.fmt(per.typical)) + ' is usual') +
        (per.older ? '. MODIS alone: ' + esc(R.fmt(per.older.value)) + (per.older.typical !== null && per.older.typical !== undefined ? '; its usual is ' + esc(R.fmt(per.older.typical)) : '') : per.olderMissing ? '. MODIS has no count of its own for these dates' : '') + '.</p>';
    }
    if (r.typical_pct !== null) h += '<p style="margin:8px 0 0">' + (r.rule === 'one' ? 'Our record uses one number for the whole year here. ' : '') + 'In past years it usually landed within about ' + Math.round(r.typical_pct) + '% of MODIS; one month in ten was off by ' + Math.round(r.one_in_ten_pct) + '% or more (' + r.months + ' months tested).</p>';
    else if (r.rule === 'curve') h += '<p style="margin:8px 0 0">No fair test score here: our record uses the curve shared by the whole world, which saw those years.</p>';
    else h += '<p style="margin:8px 0 0">No fair test score here: too few months could be tested.</p>';
    if (per) h += '<div class="btns" style="margin-top:10px"><a class="btn" href="#answer">See its answer ▸</a><a class="btn quiet" href="#record/calendar">Month by month ▸</a></div>';
    return h;
  }
  root.RecordWorld = { render, CLASS_SAY };
})(window);
