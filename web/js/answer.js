// answer.js: room 1, the first screen (VOICE_AND_COPY_0704.md section 1; it wins over DESIGN.md).
// Every word with a number in it comes from Readings.screen / Readings.seriesFor (which read the engine);
// nothing is computed here except bar heights for drawing. Measured numbers are shown at once; only bars move (and not with motion off).
(function (root) {
  'use strict';
  const esc = (s) => String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
  const cap = (s) => s ? s.charAt(0).toUpperCase() + s.slice(1) : s;

  // the verdict words in gold inside the big line: "About normal for early November." -> "<em>About normal</em> for early November."
  function bigLine(text, f) {
    const R = root.Readings, code = f.lead === 'ours' ? f.ours.word : f.lead === 'modis' ? f.older.word : null, w = code ? R.say(code) : null;
    if (!w) return esc(text);
    const i = text.toLowerCase().indexOf(w.toLowerCase());
    return i < 0 ? esc(text) : esc(text.slice(0, i)) + '<em>' + esc(text.slice(i, i + w.length)) + '</em>' + esc(text.slice(i + w.length));
  }

  // the label, the caption, the key name and the buttons come from Readings.screen (one home, also read by tools/walk_places.cjs)
  function picture(f, ser, R, sc) {
    const vals = []; for (const s of ser) { if (s.ours !== null) vals.push(s.ours); if (s.older !== null) vals.push(s.older); }
    const typical = f.lead === 'modis' ? null : f.ours.typical;
    if (typical !== null && typical !== undefined) vals.push(typical);
    const max = Math.max(1, ...vals) * 1.08;   // room above the tallest bar for its year
    const h = (v) => (100 * v / max).toFixed(2) + '%';
    const tall = ser.filter(s => s.ours !== null && !s.judged).sort((a, b) => b.ours - a.ours).slice(0, 2).map(s => s.year);
    const bars = ser.map((s, i) => {
      const cls = 'b' + (s.judged ? ' judged' : '') + (s.ours === null ? ' nodata' : '');
      const name = s.judged || tall.indexOf(s.year) >= 0 ? '<span class="yname' + (s.judged ? ' gold' : '') + '" style="bottom:calc(' + h(s.ours || 0) + ' + 4px)">' + s.year + '</span>' : '';
      return '<button type="button" class="' + cls + '" data-i="' + i + '" aria-label="' + esc(s.year + ': ' + (s.ours === null ? 'no data' : R.detections(s.ours) + ' on our record') + (s.older !== null ? '; MODIS alone ' + R.fmt(s.older) : '')) + '">' +
        '<span class="fill" data-h="' + (s.ours === null ? '' : h(s.ours)) + '" style="height:' + (s.ours === null ? '6px' : h(s.ours)) + '"></span>' +
        (s.older !== null ? '<span class="tick" style="bottom:' + h(s.older) + '"></span>' : '') + name + '</button>';
    }).join('');
    const typ = typical !== null && typical !== undefined ? '<span class="typline" style="bottom:' + h(typical) + '"></span>' : '';
    const hasOlder = ser.some(s => s.older !== null);
    const first = ser.length ? ser[0].year : '', last = ser.length ? ser[ser.length - 1].year : '';
    return '<figure class="a-fig"><div class="bars" role="group" aria-label="' + esc(sc.caption) + ' Each bar can be selected.">' + bars + typ + '</div>' +
      '<div class="axis"><span>' + first + '</span><span>' + last + '</span></div>' +
      '<figcaption>' + esc(sc.caption) + '</figcaption>' +
      '<ul class="key"><li><i class="k-grey"></i>' + esc(sc.keyOurs) + '</li>' +
      (typical !== null && typical !== undefined ? '<li><i class="k-typ"></i>usual</li>' : '') +
      (hasOlder ? '<li><i class="k-tick"></i>MODIS alone</li>' : '') + '</ul>' +
      '<p class="readout" aria-live="polite"></p></figure>';
  }

  // the period picker: "another month ▾" opens a year and a month; Show sets #answer/YYYY-MM
  function monthPicker(r, R, chosen) {
    const months = r.monthly.filter(x => x.value !== null || x.status === 'partial').map(x => x.ym);
    if (!months.length) return '';
    const ys = [...new Set(months.map(x => +x.slice(0, 4)))].reverse();
    const pick = chosen && months.indexOf(chosen) >= 0 ? chosen : months[months.length - 1];
    const label = chosen ? R.MONTHS[+chosen.slice(5, 7) - 1] + ' ' + chosen.slice(0, 4) : 'another month';
    return '<div class="a-other"><button type="button" class="a-other-btn"' + (chosen ? ' aria-current="true"' : '') + ' aria-expanded="false" aria-controls="a-other-pop">' + esc(label) + ' <b aria-hidden="true">▾</b></button>' +
      '<div class="a-other-pop" id="a-other-pop" role="group" aria-label="Choose a year and a month" hidden>' +
      '<label><span class="sr-only">Year</span><select class="a-oy">' + ys.map(y => '<option' + (y === +pick.slice(0, 4) ? ' selected' : '') + '>' + y + '</option>').join('') + '</select></label>' +
      '<label><span class="sr-only">Month</span><select class="a-om"></select></label>' +
      '<button type="button" class="btn a-ogo">Show ▸</button></div></div>' +
      (chosen ? '<a class="a-now" href="#answer">Back to now</a>' : '');
  }
  function wirePicker(el, r, R, chosen, go) {
    const btn = el.querySelector('.a-other-btn'); if (!btn) return;
    const pop = el.querySelector('.a-other-pop'), ys = el.querySelector('.a-oy'), ms = el.querySelector('.a-om'), gob = el.querySelector('.a-ogo');
    const months = r.monthly.filter(x => x.value !== null || x.status === 'partial').map(x => x.ym);
    let want = chosen || months[months.length - 1];
    const fill = () => { const y = ys.value, here = months.filter(m => m.slice(0, 4) === y);
      if (here.indexOf(want) < 0) want = here.find(m => m.slice(5, 7) === want.slice(5, 7)) || here[here.length - 1];
      ms.innerHTML = here.map(m => '<option value="' + m + '"' + (m === want ? ' selected' : '') + '>' + R.MONTHS[+m.slice(5, 7) - 1] + '</option>').join(''); };
    fill();
    ys.addEventListener('change', fill); ms.addEventListener('change', () => { want = ms.value; });
    const close = () => { pop.hidden = true; btn.setAttribute('aria-expanded', 'false'); };
    btn.addEventListener('click', () => { const open = pop.hidden; pop.hidden = !open; btn.setAttribute('aria-expanded', String(open)); if (open) ys.focus(); });
    gob.addEventListener('click', () => { close(); go('#answer/' + ms.value); });
    pop.addEventListener('keydown', (e) => { if (e.key === 'Escape') { close(); btn.focus(); } else if (e.key === 'Enter' && e.target.tagName === 'SELECT') { e.preventDefault(); gob.click(); } });
  }

  function render(el, ctx) {
    const R = root.Readings, r = ctx.result;
    const pos = R.positions(r), which = ctx.answerPos || 'month';
    const isPast = which === 'month' && !!ctx.answerSel && ctx.answerSel !== 'latest' && !(pos.month && ctx.answerSel.month === pos.month.month);
    const sel = which === 'month' ? (isPast ? ctx.answerSel : pos.month || 'latest') : pos[which] || pos.month || 'latest';
    const s = R.screen(r, sel), f = s.f;
    if (s.refusal) { el.innerHTML = '<div class="answer"><div class="a-head"><p class="eyebrow">' + esc(R.displayName(ctx.place)) + '</p><div class="message">' + esc(s.refusal) + '</div>' +
      '<div class="btns">' + (isPast ? '<a class="btn primary" href="#answer">Back to now</a>' : '') + '<a class="btn" href="#record/world">Pick another country ▸</a></div></div></div>'; return; }
    const ser = R.seriesFor(r, sel);
    const sw = [['month', '#answer', s.switchLabels.month, !!pos.month], ['year', '#answer/year', s.switchLabels.year, !!pos.year], ['season', '#answer/season', s.switchLabels.season, !!pos.season]];
    const switcher = '<div class="a-when"><nav class="a-switch" aria-label="Which stretch of time">' + sw.map(([k, href, label, ok]) => ok
      ? '<a href="' + href + '"' + (k === which && !isPast ? ' aria-current="true"' : '') + '>' + esc(label) + '</a>'
      : '<span class="off" aria-disabled="true" title="Not enough of this place\'s record for this">' + esc(label) + '</span>').join('') + '</nav>' +
      monthPicker(r, R, isPast ? f.ym : null) + '</div>';
    const tag = f.early ? '<button type="button" class="tag" aria-expanded="false" title="' + esc(s.earlyTip) + '">EARLY DATA</button><span class="tag-tip" hidden>' + esc(s.earlyTip) + '</span>' : '';
    const why = '<a href="#story/1">Why? ▸</a>';
    let modis = '';
    if (s.modis) modis = '<p class="a-modis' + (s.modis.agree ? ' agree' : '') + '">' + esc(s.modis.text) + (s.modis.agree ? '' : ' ' + why) + '</p>';
    const weak = s.weak ? '<p class="a-weak">' + esc(s.weak) + ' <a href="#story/5">Here\'s why ▸</a></p>' : '';
    el.innerHTML = '<div class="answer fade-in' + (f.lead === 'none' || f.lead === 'weak' ? ' quiet' : '') + '">' +
      '<div class="a-head">' +
        '<div class="a-top"><p class="eyebrow">' + esc(s.label) + '</p>' + tag + '</div>' +
        switcher +
        (s.past ? '<p class="a-past">' + esc(s.past) + '</p>' : '') +
        '<p class="a-q">' + esc(s.question) + '</p>' +
        '<h1 class="a-big">' + bigLine(s.answer, f) + '</h1>' +
        weak +
        (r.unit && R.scaleNote(r, sel) ? '<p class="note">' + esc(R.scaleNote(r, sel)) + '</p>' : '') +
        (s.felt ? '<p class="a-felt">' + esc(s.felt) + '</p>' : '') +
        (s.tooLittle ? '<p class="a-felt">' + esc(s.tooLittle) + '</p>' : '') +
      '</div>' +
      '<div class="a-pic">' + picture(f, ser, R, s) + '</div>' +
      '<div class="a-rest">' +
        modis +
        (s.happening ? '<p class="a-happening">' + esc(s.happening) + '</p>' : '') +
        '<div class="a-small"><p>' + esc(s.small) + '</p><p>' + esc(s.unit) + '</p><p><a href="#record/how">' + esc(s.sure) + '</a></p></div>' +
        '<div class="btns"><a class="btn primary" href="#story/1">' + esc(s.buttons[0]) + '</a><a class="btn" href="#record/calendar">' + esc(s.buttons[1]) + '</a></div>' +
      '</div></div>';
    wirePicker(el, r, R, isPast ? f.ym : null, ctx.go);
    // the EARLY DATA tag opens its note on tap (the title gives it on hover)
    const tb = el.querySelector('.tag'), tt = el.querySelector('.tag-tip');
    if (tb) tb.addEventListener('click', () => { const open = tt.hidden; tt.hidden = !open; tb.setAttribute('aria-expanded', String(open)); });
    // tap and keyboard path to every bar's values
    const out = el.querySelector('.readout');
    for (const b of el.querySelectorAll('.bars .b')) {
      const show = () => { const x = ser[+b.dataset.i];
        for (const y of el.querySelectorAll('.bars .b.sel')) y.classList.remove('sel'); b.classList.add('sel');
        out.textContent = x.year + ': ' + (x.ours === null ? 'no data' : R.detections(x.ours) + ' on our record') + (x.older !== null ? '; MODIS alone counted ' + R.fmt(x.older) : '') + '.'; };
      b.addEventListener('click', show); b.addEventListener('focus', show);
    }
    if (!ctx.still) {
      const fills = [...el.querySelectorAll('.bars .fill[data-h]')].filter(x => x.dataset.h);
      for (const x of fills) x.style.height = '0';
      requestAnimationFrame(() => requestAnimationFrame(() => { for (const x of fills) x.style.height = x.dataset.h; }));
    }
  }
  root.Answer = { render, UNIT_LINE: root.Readings ? root.Readings.UNIT_SENTENCE : '' };
})(window);
