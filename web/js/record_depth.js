// record_depth.js: the monthly record's picture (VOICE_AND_COPY_0704.md section 4): one year in front as twelve gold bars, the earlier years
// standing behind it in depth, and a "laid over each other" view. Hand-made SVG, no outside code. Ideas and some geometry from the practice
// builds in ..\work\demo_B\ (Stack) and ..\work\wild_E\ (ridges).
// It only draws numbers it is handed (from the engine via the adapters and Readings); nothing is computed here but positions.
(function (root) {
  'use strict';
  const NS = 'http://www.w3.org/2000/svg';
  const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec'];
  const C = { gold: '#ffcd79', glow: '#ffdda3', blue: '#7a99bc', edge: '#7693a5', dim: '#a5b2c2', paper: '#f4edda', rule: '#2c3d50', rule2: '#3d5064' };
  function el(tag, attrs, parent) { const e = document.createElementNS(NS, tag); for (const k in attrs) e.setAttribute(k, attrs[k]); if (parent) parent.appendChild(e); return e; }
  function txt(parent, x, y, s, attrs) { const t = el('text', Object.assign({ x, y }, attrs || {}), parent); t.textContent = s; return t; }
  function clear(svg) { while (svg.firstChild) svg.removeChild(svg.firstChild); }
  function size(svg) { const r = svg.getBoundingClientRect(); return [Math.max(280, Math.round(r.width) || 800), Math.max(200, Math.round(r.height) || 360)]; }
  function nice(max) { if (!(max > 0)) return [1, [0, 1]]; const p = Math.pow(10, Math.floor(Math.log10(max))), m = max / p;
    const st = (m <= 1.5 ? 0.25 : m <= 3 ? 0.5 : m <= 6 ? 1 : 2) * p; const ticks = [0]; while (ticks[ticks.length - 1] < max * 0.999) ticks.push(ticks.length * st); return [ticks[ticks.length - 1], ticks]; }
  const short = (t) => t >= 1000 ? (+(t / 1000).toFixed(1)) + 'k' : t >= 10 || t === 0 ? String(Math.round(t)) : String(+t.toFixed(2));
  // a step outline of twelve months. A missing month BREAKS the outline (it is a gap, never a drawn zero): each run of months with data
  // is its own piece. closed: a filled silhouette down to the floor; open: just the top line (the dashed usual).
  function stepPath(v, open) {
    const runs = []; let cur = null;
    v.forEach((x, i) => { if (x === null || x === undefined) { cur = null; return; } if (!cur) runs.push(cur = []); cur.push([i, x]); });
    return runs.map(run => { const a = run[0][0], z = run[run.length - 1][0] + 1;
      let d = open ? 'M' + a + ',' + run[0][1] : 'M' + a + ',0L' + a + ',' + run[0][1];
      run.forEach(([i, y], j) => { if (j) d += 'L' + i + ',' + y; d += 'L' + (i + 1) + ',' + y; });
      return d + (open ? '' : 'L' + z + ',0Z'); }).join('');
  }

  // ---------- stacked in depth ----------
  // data: { years: [{ y, v[12], modis[12], early[12] }], usualFor(y) -> [12], max, label(y) }
  class Depth {
    constructor(svg, opts) { this.svg = svg; this.o = opts || {}; this.pos = null; this.target = null; this.raf = null; this.acc = 0; this.bind(); }
    setData(d, year) { this.d = d; this.ys = d.years.map(q => q.y); this.minY = this.ys[0]; this.maxY = this.ys[this.ys.length - 1];
      this.target = this.pos = Math.max(this.minY, Math.min(this.maxY, year)); this.build(); this.frame(); }
    geom() { const [W, H] = size(this.svg), phone = W < 560;
      const L = phone ? 40 : 52, R = phone ? 44 : 70, B = phone ? 40 : 44, depth = phone ? 5 : 8, stepY = phone ? 15 : 21;
      const T = 12 + depth * stepY; return { W, H, L, R, B, T, ph: H - T - B, pw: W - L - R, depth, stepY, phone }; }
    build() {
      const svg = this.svg, d = this.d; clear(svg); const g = this.g = this.geom();
      svg.setAttribute('viewBox', '0 0 ' + g.W + ' ' + g.H);
      const [top, ticks] = nice(d.max); this.top = top; this.k = g.ph / top;
      const axis = el('g', {}, svg);
      for (const t of ticks) { const y = g.T + g.ph - t * this.k; el('line', { x1: g.L - 3, x2: g.L + 4, y1: y, y2: y, stroke: C.rule2, 'stroke-width': 1 }, axis);
        txt(axis, g.L - 6, y + 4, short(t), { 'font-size': g.phone ? 11 : 13, fill: C.dim, 'text-anchor': 'end', 'font-family': 'Consolas, monospace' }); }
      this.gLayers = el('g', {}, svg); this.gTop = el('g', {}, svg); this.gAxis = el('g', {}, svg);
      MON.forEach((m, i) => txt(this.gAxis, g.L + (i + 0.5) / 12 * g.pw, g.H - B_(g) , g.phone ? m[0] : m, { 'font-size': g.phone ? 12 : 14, fill: C.dim, 'text-anchor': 'middle', 'font-family': 'Consolas, monospace' }));
      this.gEarly = el('g', {}, svg);
      this.layers = d.years.map(yr => {
        const grp = el('g', {}, this.gLayers);
        const ghost = el('path', { d: stepPath(yr.v), fill: 'rgba(118,147,165,0.10)', stroke: C.edge, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke', 'stroke-linejoin': 'round' }, grp);
        const bars = el('g', {}, grp);
        yr.v.forEach((v, i) => { if (v === null || v === undefined) return;
          const r = el('rect', { x: i + 0.12, y: 0, width: 0.76, height: Math.max(0, v), fill: yr.early[i] ? 'url(#d-early)' : C.gold, 'data-i': i, class: 'dbar' }, bars);
          r.addEventListener('click', (e) => { e.stopPropagation(); if (yr.y === this.target && this.o.onMonth) this.o.onMonth(yr.y, i); }); });
        const ticks = el('g', {}, grp);
        yr.modis.forEach((v, i) => { if (v === null || v === undefined) return; el('line', { x1: i + 0.08, x2: i + 0.92, y1: v, y2: v, stroke: C.blue, 'stroke-width': 3, 'vector-effect': 'non-scaling-stroke' }, ticks); });
        const base = el('line', { x1: 0, x2: 12, y1: 0, y2: 0, stroke: C.rule2, 'stroke-width': 1, 'vector-effect': 'non-scaling-stroke' }, grp);
        const lab = txt(this.gTop, 0, 0, this.d.label(yr.y), { 'font-size': g.phone ? 11 : 13, fill: C.dim, 'font-family': 'Consolas, monospace', class: 'dlab' });
        lab.addEventListener('click', (e) => { e.stopPropagation(); this.goto(yr.y); });
        return { yr, grp, ghost, bars, ticks, base, lab };
      });
      // the hatched fill for early-data months, and the usual month (dashed) on the front row
      const defs = el('defs', {}, svg), pat = el('pattern', { id: 'd-early', width: 6, height: 6, patternUnits: 'userSpaceOnUse', patternTransform: 'rotate(45)' }, defs);
      el('rect', { width: 6, height: 6, fill: '#ffcd7988' }, pat); el('rect', { width: 3, height: 6, fill: C.gold }, pat);
      this.usual = el('path', { d: '', fill: 'none', stroke: C.paper, 'stroke-width': 2, 'stroke-dasharray': '6 4', 'vector-effect': 'non-scaling-stroke', opacity: 0.8 }, this.gTop);
      this.setFront(this.target);
    }
    setFront(y) {
      const u = this.d.usualFor(y); this.usual.setAttribute('d', u ? stepPath(u, true) : '');
      clear(this.gEarly); const g = this.g, yr = this.d.years.find(q => q.y === y);
      if (yr) { const idx = yr.early.map((e, i) => e ? i : -1).filter(i => i >= 0);
        if (idx.length) { const x0 = g.L + idx[0] / 12 * g.pw + 4, x1 = g.L + (idx[idx.length - 1] + 1) / 12 * g.pw - 4, yy = g.H - (g.phone ? 8 : 10);
          el('line', { x1: x0, x2: x1, y1: yy - (g.phone ? 11 : 13), y2: yy - (g.phone ? 11 : 13), stroke: C.glow, 'stroke-width': 1 }, this.gEarly);
          txt(this.gEarly, (x0 + x1) / 2, yy, g.phone ? 'EARLY' : 'EARLY DATA', { 'font-size': g.phone ? 10 : 12, fill: C.glow, 'text-anchor': 'middle', 'font-family': 'Consolas, monospace', 'letter-spacing': 1 }); }
        // a month that isn't over yet says so beside its bar: "days 1 to 12"
        (yr.partial || []).forEach((days, i) => { if (!days || yr.v[i] === null || yr.v[i] === undefined) return;
          const top = Math.max(yr.v[i], yr.modis[i] || 0), x = i === 11 ? g.L + g.pw - 2 : i === 0 ? g.L + 2 : g.L + (i + 0.5) / 12 * g.pw, yTop = g.T + g.ph - top * this.k - 8;
          txt(this.gEarly, x, Math.max(g.T + 10, yTop), 'days 1 to ' + days, { 'font-size': g.phone ? 10 : 12, fill: C.glow, 'text-anchor': i === 11 ? 'end' : i === 0 ? 'start' : 'middle', 'font-family': 'Consolas, monospace', class: 'dpartial' }); }); }
    }
    goto(y, instant) { y = Math.max(this.minY, Math.min(this.maxY, Math.round(y))); if (y === this.target && !instant) return;
      this.target = y; this.setFront(y); if (this.o.onYear) this.o.onYear(y);
      if (instant || this.o.still) { this.pos = y; this.frame(); } else this.animate(); }
    animate() { if (this.raf) return; let last = performance.now();
      const step = (t) => { const dt = Math.min(64, t - last); last = t; const a = 1 - Math.exp(-dt / 110);
        this.pos += (this.target - this.pos) * a; const done = Math.abs(this.target - this.pos) < 0.003; if (done) this.pos = this.target;
        this.frame(); this.raf = done ? null : requestAnimationFrame(step); };
      this.raf = requestAnimationFrame(step); }
    frame() {
      if (!this.layers) return; const g = this.g, p = this.pos, k = this.k;
      for (const ly of this.layers) {
        const dd = p - ly.yr.y;   // > 0: behind the front year (earlier); < 0: a later year, slid out toward you
        let off, sx, op, show = true;
        if (dd >= 0) { off = -dd * g.stepY; sx = 1 - 0.035 * dd; op = dd < 1 ? 1 - 0.55 * dd : Math.max(0, 0.45 - 0.045 * (dd - 1)); if (dd > g.depth + 0.6) show = false; }
        else { off = -dd * 46; sx = 1 - 0.035 * dd; op = Math.max(0, 1 + dd * 1.8); if (op <= 0.01) show = false; }
        ly.grp.setAttribute('visibility', show ? 'visible' : 'hidden');
        ly.lab.setAttribute('visibility', show && dd > 0.5 && dd < g.depth + 0.5 ? 'visible' : 'hidden');
        if (!show) continue;
        const cx = g.L + g.pw / 2, base = g.T + g.ph + off, w = g.pw * sx;
        ly.grp.setAttribute('transform', 'translate(' + (cx - w / 2) + ',' + base + ') scale(' + (w / 12) + ',' + (-k * (dd > 0 ? sx : 1)) + ')');
        const front = Math.max(0, 1 - Math.abs(dd) * 1.4);
        ly.bars.setAttribute('opacity', front.toFixed(3)); ly.ticks.setAttribute('opacity', front.toFixed(3));
        ly.ghost.setAttribute('opacity', (op * (1 - front * 0.85)).toFixed(3)); ly.base.setAttribute('opacity', op.toFixed(3));
        ly.lab.setAttribute('x', g.L + g.pw + 8); ly.lab.setAttribute('y', base + 4); ly.lab.setAttribute('opacity', Math.min(1, op * 1.8).toFixed(3));
        ly.z = dd;
      }
      const order = this.layers.filter(l => l.grp.getAttribute('visibility') === 'visible').sort((a, b) => b.z - a.z);
      for (const l of order) this.gLayers.appendChild(l.grp);
      this.usual.setAttribute('transform', 'translate(' + g.L + ',' + (g.T + g.ph) + ') scale(' + (g.pw / 12) + ',' + (-k) + ')');
    }
    bind() {
      const svg = this.svg;
      svg.addEventListener('wheel', (e) => { if (!this.d) return; const dir = e.deltaY > 0 ? -1 : 1;   // scrolling down walks back in time
        if ((dir < 0 && this.target <= this.minY) || (dir > 0 && this.target >= this.maxY)) return;
        e.preventDefault(); this.acc += Math.abs(e.deltaY) >= 50 ? 80 * Math.sign(e.deltaY) : e.deltaY;
        while (Math.abs(this.acc) >= 80) { this.goto(this.target - Math.sign(this.acc)); this.acc -= 80 * Math.sign(this.acc); } }, { passive: false });
      let sw = null;
      svg.addEventListener('pointerdown', (e) => { sw = { x: e.clientX, y: e.clientY }; });
      svg.addEventListener('pointerup', (e) => { if (!sw) return; const dx = e.clientX - sw.x, dy = e.clientY - sw.y; sw = null;
        if (Math.abs(dx) > 40 && Math.abs(dx) > Math.abs(dy)) this.goto(this.target + (dx < 0 ? 1 : -1)); });
      svg.addEventListener('pointercancel', () => { sw = null; });
    }
  }
  function B_(g) { return g.phone ? 22 : 24; }

  // ---------- laid over each other ----------
  // every year as a thin line on one flat chart; the chosen year gold and thick; the usual year dashed
  function overlay(svg, d, year, onPick) {
    clear(svg); const [W, H] = size(svg), phone = W < 560;
    const L = phone ? 40 : 52, R = phone ? 12 : 70, T = 16, B = phone ? 40 : 44, pw = W - L - R, ph = H - T - B;
    svg.setAttribute('viewBox', '0 0 ' + W + ' ' + H);
    const [top, ticks] = nice(d.max), k = ph / top, X = (i) => L + (i + 0.5) / 12 * pw, Y = (v) => T + ph - v * k;
    for (const t of ticks) { el('line', { x1: L, x2: L + pw, y1: Y(t), y2: Y(t), stroke: C.rule }, svg); txt(svg, L - 6, Y(t) + 4, short(t), { 'font-size': phone ? 11 : 13, fill: C.dim, 'text-anchor': 'end', 'font-family': 'Consolas, monospace' }); }
    MON.forEach((m, i) => txt(svg, X(i), H - B_({ phone }), phone ? m[0] : m, { 'font-size': phone ? 12 : 14, fill: C.dim, 'text-anchor': 'middle', 'font-family': 'Consolas, monospace' }));
    const runs = (v) => { const out = []; let cur = []; v.forEach((x, i) => { if (x === null || x === undefined) { if (cur.length) out.push(cur); cur = []; } else cur.push([X(i), Y(x)]); }); if (cur.length) out.push(cur); return out; };
    const pathOf = (v) => runs(v).map(r => r.map((p, j) => (j ? 'L' : 'M') + p[0].toFixed(1) + ',' + p[1].toFixed(1)).join('')).join('');
    const g0 = el('g', {}, svg);
    for (const yr of d.years) { if (yr.y === year) continue;
      const dd = pathOf(yr.v);
      el('path', { d: dd, fill: 'none', stroke: C.edge, 'stroke-width': 1.2, opacity: 0.38, 'stroke-linejoin': 'round' }, g0);
      const hit = el('path', { d: dd, fill: 'none', stroke: 'transparent', 'stroke-width': 10, class: 'ohit' }, g0);
      const t = el('title', {}, hit); t.textContent = d.label(yr.y) + ' (tap to bring it forward)';
      hit.addEventListener('click', () => onPick(yr.y)); }
    const u = d.usualFor(year); if (u) el('path', { d: pathOf(u), fill: 'none', stroke: C.paper, 'stroke-width': 2, 'stroke-dasharray': '6 4', opacity: 0.85 }, svg);
    const fr = d.years.find(q => q.y === year);
    if (fr) { el('path', { d: pathOf(fr.v), fill: 'none', stroke: C.gold, 'stroke-width': 4, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' }, svg);
      fr.v.forEach((v, i) => { if (v !== null && v !== undefined) el('circle', { cx: X(i), cy: Y(v), r: fr.early[i] ? 4 : 4.5, fill: fr.early[i] ? 'none' : C.gold, stroke: C.gold, 'stroke-width': 2 }, svg); }); }
    // name the two busiest years at their peak month, so the big ones can be found
    const placed = [];
    for (const yy of d.biggest || []) { if (yy === year) continue; const yr = d.years.find(q => q.y === yy); if (!yr) continue;
      let bi = -1; yr.v.forEach((v, i) => { if (v !== null && (bi < 0 || v > yr.v[bi])) bi = i; });
      if (bi < 0) continue; let ly = Y(yr.v[bi]) + 4; const lx = X(bi) + 8;
      for (const q of placed) if (Math.abs(q[0] - lx) < 40 && Math.abs(q[1] - ly) < 14) ly = q[1] + 15;
      placed.push([lx, ly]); txt(svg, lx, ly, String(yy), { 'font-size': phone ? 11 : 13, fill: C.dim, 'font-family': 'Consolas, monospace' }); }
  }

  root.RecordDepth = { Depth, overlay, stepPath };
})(window);
