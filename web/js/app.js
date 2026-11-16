// app.js: state (place, period, room), the engine opened once, one query per place, links, the bar and the place picker.
// The page never computes a number the engine returns; see js/readings.js.
(function () {
  'use strict';
  // THE working title: one constant, one file (the team lead has not chosen a name)
  const TITLE = 'Two Cameras, One Calendar';
  const DEFAULT_PLACE = 'Argentina';
  const RECORD_TABS = ['calendar', 'table', 'years', 'thisyear', 'world', 'sentence', 'ask', 'how'];
  const qs = new URLSearchParams(location.search);
  // ---------- THE UNIT SWITCH ("MODIS's scale / VIIRS's scale"), built Nov 14; shown since the team lead's ruling at 2:43 PM ----------
  // To hide it again: set UNIT_SWITCH = false (then ?units=1 still shows it for testing). Since Nov 15, 10 AM the page OPENS on VIIRS's scale
  // (to match the talk, whose charts are on Vee's scale); ?scale=modis opens it on MODIS's scale. A place that cannot switch shows MODIS's scale.
  const UNIT_SWITCH = true;   // turned on by the team lead, Nov 14, 2:43 PM ("Turn it on"); the page still opens on MODIS's scale
  const unitsOn = UNIT_SWITCH || qs.get('units') === '1';
  // ---------- THE STORY'S FULL SCREEN (team lead, 4:42 PM: "let try hiding them"): while the story is on screen the two top bars hide ----------
  // To undo: set HIDE_BARS_IN_STORY = false. To see the bars without leaving the story: rest the pointer on the very top edge of the
  // screen for about a second; they slide back and stay while the pointer is over them. Leaving the story (its own way out, Back,
  // a new address) brings them back. Phones (760 px wide or less) keep the bars: there the story scrolls like a page.
  const HIDE_BARS_IN_STORY = true;
  const still = qs.get('still') === '1' || (window.matchMedia && matchMedia('(prefers-reduced-motion: reduce)').matches);
  if (still) document.documentElement.classList.add('still');
  document.title = TITLE;
  document.getElementById('title').textContent = TITLE;

  const $ = (id) => document.getElementById(id);
  const rooms = { answer: $('room-answer'), story: $('room-story'), record: $('room-record') };
  const state = { L: null, place: qs.get('place') || DEFAULT_PLACE, result: null, argentina: null, cache: {}, req: 0, world: null, shapes: null,
    room: 'answer', storyN: 1, recordTab: 'calendar', storyMountedFor: null, fromGo: null, error: null, period: {}, scale: qs.get('scale') === 'modis' ? 'modis' : 'viirs' };

  function esc(s) { return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]); }
  function message(el, text) { el.innerHTML = '<div class="message" role="status">' + esc(text) + '</div>'; }

  // ---------- links ----------
  function parseHash() {
    const h = (location.hash || '#answer').slice(1), [room, sub] = h.split('/');
    if (room === 'story') return { room: 'story', n: Math.max(1, parseInt(sub, 10) || 1) };
    if (room === 'record') return { room: 'record', tab: RECORD_TABS.indexOf(sub) >= 0 ? sub : 'calendar' };
    const m = /^(\d{4}-(0[1-9]|1[0-2]))$/.exec(sub || '');
    // #answer/YYYY-MM opens that month on the answer; #answer/year and #answer/season are the switch's other two positions
    return { room: 'answer', ym: m ? m[1] : null, pos: sub === 'year' || sub === 'season' ? sub : 'month' };
  }
  function go(hash) { state.fromGo = hash; if (location.hash === hash) route(); else location.hash = hash; }

  // ---------- data ----------
  async function getJSON(url) { const r = await fetch(url); if (!r.ok) throw new Error('could not load ' + url + ' (' + r.status + ')'); return r.json(); }
  async function query(file) {
    if (state.cache[file]) return state.cache[file];
    // each camera's availability comes from the country file itself (a missing row is no count, never 0)
    const p = HSEngine.query({ country: file }, state.L).then(async (r) => { await Readings.loadAvailability(state.L, r); return r; });
    state.cache[file] = p;
    try { return await p; } catch (e) { delete state.cache[file]; throw e; }
  }
  function worldRow(file) { return state.world ? state.world.rows.find(r => r.file === file) : null; }

  async function setPlace(file, opts) {
    const token = ++state.req;
    state.place = file;
    $('place-name').textContent = Readings.displayName(file);
    const u = new URL(location.href); if (file === DEFAULT_PLACE) u.searchParams.delete('place'); else u.searchParams.set('place', file);
    history.replaceState(null, '', u.pathname + u.search + u.hash);
    let res = null, err = null;
    try { res = await query(file); } catch (e) { err = e; }
    if (token !== state.req) return;   // a newer choice arrived while this one loaded: the last choice wins
    state.result = res; state.error = err ? (err.message || String(err)) : null;
    state.storyMountedFor = null;
    render(opts && opts.keepScroll);
  }

  function ctx() {
    return { title: TITLE, engine: window.HSEngine, adapters: window.HSAdapters, layer: state.L, readings: window.Readings, result: shown(), place: state.place,
      argentina: state.argentina, world: state.world, shapes: state.shapes, still, go, answerSel: (parseHash().ym ? { month: parseHash().ym } : 'latest'), answerPos: parseHash().pos, setPlace: (f) => setPlace(f), error: state.error, period: state.period,
      loadShapes: async () => { if (!state.shapes) state.shapes = await getJSON('data/world_shapes.json'); return state.shapes; } };
  }

  // ---------- rooms ----------
  const narrow = window.matchMedia ? matchMedia('(max-width: 760px)') : null;
  function storyFull(room) {
    const on = HIDE_BARS_IN_STORY && room === 'story' && !(narrow && narrow.matches), root = document.documentElement;
    if (on === root.classList.contains('story-full')) return;
    root.classList.toggle('story-full', on); if (!on) root.classList.remove('bars-peek');
    window.dispatchEvent(new Event('resize'));   // the story refits to the room it now has
  }
  if (narrow && narrow.addEventListener) narrow.addEventListener('change', () => storyFull(state.room));
  // the one way to see the bars inside the story: the pointer rests on the top edge (6 px) for 900 ms; they hide again 1.5 s after it leaves
  let peekT = null, unpeekT = null;
  document.addEventListener('mousemove', (e) => {
    const root = document.documentElement; if (!root.classList.contains('story-full')) return;
    if (!root.classList.contains('bars-peek')) {
      if (e.clientY <= 6) { if (!peekT) peekT = setTimeout(() => { peekT = null; root.classList.add('bars-peek'); }, 900); }
      else if (peekT) { clearTimeout(peekT); peekT = null; }
      return;
    }
    const b = $('bar').getBoundingClientRect().bottom, u = $('units'), ub = u && !u.hidden ? u.getBoundingClientRect().bottom : b;
    if (e.clientY > Math.max(b, ub) + 24) { if (!unpeekT) unpeekT = setTimeout(() => { unpeekT = null; root.classList.remove('bars-peek'); }, 1500); }
    else if (unpeekT) { clearTimeout(unpeekT); unpeekT = null; }
  });
  function showRoom(room) {
    storyFull(room);
    for (const k in rooms) rooms[k].hidden = k !== room;
    for (const a of document.querySelectorAll('#tabs .tab')) { if (a.dataset.room === room) a.setAttribute('aria-current', 'page'); else a.removeAttribute('aria-current'); }
  }
  // the record the rooms read: today's (MODIS's scale), or the same record on VIIRS's scale when the switch is on and set there
  function shown() {
    if (!unitsOn || state.scale !== 'viirs' || !state.result) return state.result;
    return Readings.onScale(state.result, 'viirs') || state.result;
  }
  function drawUnits(h) {
    if (!unitsOn) return;
    const el = $('units'); if (!el) return;
    const chk = state.result ? Readings.scaleCheck(state.result) : { ok: false, why: null };
    const eff = chk.ok ? state.scale : 'modis';      // the scale showing here; the chosen one (state.scale) carries on to the next place
    const btn = (k) => '<button type="button" data-scale="' + k + '" aria-pressed="' + (eff === k) + '"' + (k === 'viirs' && !chk.ok ? ' disabled' : '') + '>' + esc(Readings.SCALE_NAMES[k]) + '</button>';
    const wr = worldRow(state.place), quiet = wr && wr.scored && !wr.busy;
    const lines = eff === 'viirs' ? ["This country's counts and charts are on VIIRS's scale: the same record, expressed in VIIRS's units. The world map and the method examples stay on MODIS's scale.", Readings.SCALE_PAST].concat(quiet ? ["Across quiet countries, going up is usually rougher: a month MODIS saw as empty stays empty."] : []).concat(h.room === 'record' && h.tab === 'world' ? ["The map's counts stay on MODIS's scale."] : []).concat(h.room === 'story' ? ["The story's history charts are on VIIRS's scale too; its tests are scored against MODIS's own counts."] : [])
      : !chk.ok && chk.why ? [chk.why] : ["Counts are on MODIS's scale, the older camera's units. Press VIIRS's scale to see them the way the newer camera counts."];
    el.hidden = false;
    el.innerHTML = '<div class="u-switch" role="group" aria-label="Which camera&#39;s units the counts are in">' + btn('modis') + btn('viirs') + '</div>' +
      '<p class="u-line">' + lines.map(esc).join(' ') + '</p>';
    for (const b of el.querySelectorAll('button[data-scale]')) b.addEventListener('click', () => { if (b.disabled || eff === b.dataset.scale) return; state.scale = b.dataset.scale; state.storyMountedFor = null; render(); });
  }
  function render() {
    const h = parseHash(); state.room = h.room; showRoom(h.room);
    if (!state.L) return;
    drawUnits(h);
    const c = ctx();
    try {
      if (h.room === 'answer') {
        if (state.error) return message(rooms.answer, 'Nothing to show here: ' + state.error + '.');
        window.Answer ? Answer.render(rooms.answer, c) : message(rooms.answer, 'The answer is being built.');
      } else if (h.room === 'record') {
        state.recordTab = h.tab;
        window.Record ? Record.render(rooms.record, c, h.tab) : message(rooms.record, 'The record is being built.');
      } else {
        const root = $('story-root');
        if (!window.Story || typeof Story.mount !== 'function') { message(root, 'The story is being built.'); return; }
        if (state.error) { message(root, 'Nothing to show here: ' + state.error + '.'); return; }
        const fromGo = state.fromGo === location.hash; state.fromGo = null;
        if (state.storyMountedFor !== state.place) {
          root.innerHTML = '';
          Story.mount(root, { engine: window.HSEngine, adapters: window.HSAdapters, layer: state.L, argentina: state.argentina, place: state.result,
            readings: window.Readings, go, still, worldTable: state.world });
          state.storyMountedFor = state.place;
          if (typeof Story.go === 'function') Story.go(h.n);
        } else if (!fromGo && typeof Story.go === 'function') Story.go(h.n);
      }
    } catch (e) {
      const el = h.room === 'story' ? $('story-root') : rooms[h.room];
      message(el, 'Something went wrong drawing this room: ' + (e && e.message || e) + '.');
      if (window.console) console.error(e);
    }
  }
  function route() { render(); }
  window.addEventListener('hashchange', route);

  // ---------- the place picker ----------
  const picker = $('picker'), pq = $('picker-q'), plist = $('picker-list'), pbtn = $('place-btn');
  function fillChoices(listEl, q, onPick) {
    const rows = state.world ? state.world.rows : [];
    const n = q.trim().toLowerCase();
    const hits = rows.filter(r => !n || r.name.toLowerCase().includes(n) || r.file.toLowerCase().includes(n))
      .sort((a, b) => (a.name.toLowerCase().startsWith(n) ? 0 : 1) - (b.name.toLowerCase().startsWith(n) ? 0 : 1) || a.name.localeCompare(b.name)).slice(0, n ? 30 : 235);
    listEl.innerHTML = hits.length ? hits.map(r => '<li><button type="button" data-file="' + esc(r.file) + '"><span>' + esc(r.name) + '</span><span class="cls">' +
      esc((window.RecordWorld && RecordWorld.CLASS_SAY[r.cls]) || state.world.classes[r.cls] || '') + '</span></button></li>').join('') : '<li class="note" style="padding:8px">No country by that name in this record.</li>';
    for (const b of listEl.querySelectorAll('button')) b.addEventListener('click', () => onPick(b.dataset.file));
  }
  function listKeys(input, listEl, onPick, onEscape) {
    input.addEventListener('keydown', (e) => {
      const first = listEl.querySelector('button');
      if (e.key === 'ArrowDown' && first) { e.preventDefault(); first.focus(); }
      else if (e.key === 'Enter' && first) { e.preventDefault(); onPick(first.dataset.file); }
      else if (e.key === 'Escape' && onEscape) onEscape();
    });
    listEl.addEventListener('keydown', (e) => {
      const bs = [...listEl.querySelectorAll('button')], i = bs.indexOf(document.activeElement);
      if (e.key === 'ArrowDown' && i < bs.length - 1) { e.preventDefault(); bs[i + 1].focus(); }
      else if (e.key === 'ArrowUp') { e.preventDefault(); if (i > 0) bs[i - 1].focus(); else input.focus(); }
      else if (e.key === 'Escape' && onEscape) onEscape();
    });
  }
  window.AppPicker = { fillChoices, listKeys };
  function openPicker() { picker.hidden = false; pbtn.setAttribute('aria-expanded', 'true'); pq.value = ''; fillChoices(plist, '', pick); pq.focus(); }
  function closePicker(focusBack) { picker.hidden = true; pbtn.setAttribute('aria-expanded', 'false'); if (focusBack) pbtn.focus(); }
  function pick(file) { closePicker(true); setPlace(file); }
  pbtn.addEventListener('click', () => picker.hidden ? openPicker() : closePicker(true));
  pq.addEventListener('input', () => fillChoices(plist, pq.value, pick));
  listKeys(pq, plist, pick, () => closePicker(true));
  document.addEventListener('click', (e) => { if (!picker.hidden && !picker.contains(e.target) && !pbtn.contains(e.target)) closePicker(false); });

  // ---------- start ----------
  (async function start() {
    showRoom(parseHash().room);
    try {
      state.L = await HSEngine.open({ base: 'parts/engine_and_data/' });
      const [arg, world] = await Promise.all([query('Argentina'), getJSON('data/world_table.json').catch(() => null)]);
      state.argentina = arg; state.world = world;
      if (world && !world.rows.some(r => r.file === state.place)) state.place = DEFAULT_PLACE;
      await setPlace(state.place);
    } catch (e) {
      for (const k of ['answer', 'record']) message(rooms[k], 'Nothing to show here: the record could not be opened (' + (e && e.message || e) + '). Serve this folder over http, for example: python -I tools\\serve.py 8840');
      message($('story-root'), 'Nothing to show here: the record could not be opened.');
    }
  })();
})();
