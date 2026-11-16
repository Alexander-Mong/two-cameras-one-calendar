/* slides.js: move between the seven slides (arrow keys, click); fill the addresses from this laptop's local/addresses.js. Pencil. */
(function () {
  'use strict';
  const sl = [...document.querySelectorAll('.sl')], count = document.querySelector('.count');
  let i = Math.max(0, Math.min(sl.length - 1, (+location.hash.slice(1) || 1) - 1));
  function show(k) { i = Math.max(0, Math.min(sl.length - 1, k)); sl.forEach((s, j) => s.classList.toggle('on', j === i)); count.textContent = (i + 1) + ' / ' + sl.length; try { history.replaceState(null, '', '#' + (i + 1)); } catch (e) {} }
  document.addEventListener('keydown', e => { if (['ArrowRight', 'PageDown', ' '].includes(e.key)) { e.preventDefault(); show(i + 1); } else if (['ArrowLeft', 'PageUp'].includes(e.key)) { e.preventDefault(); show(i - 1); } else if (e.key === 'Home') show(0); else if (e.key === 'End') show(sl.length - 1); });
  document.addEventListener('click', e => { if (e.target.closest('a')) return; show(e.clientX < innerWidth / 3 ? i - 1 : i + 1); });
  function addrs() { const B = window.StoryBeats || {}, bare = a => String(a || '').replace(/^[a-z]+:\/\//i, '').replace(/\/$/, '');
    const conn = B.connectorAddress ? bare(B.pageAddress).replace(/explore\.html$/, '') + '/connector.html' : '';
    const v = { pageAddress: bare(B.pageAddress), volunteerAddress: bare(B.volunteerAddress), connectorPage: conn.replace(/\/\//g, '/') };
    document.querySelectorAll('[data-addr]').forEach(el => { el.textContent = v[el.dataset.addr] || ''; }); }
  addrs(); setTimeout(addrs, 500); setTimeout(addrs, 1500);
  window.addEventListener('hashchange', () => { const k = (+location.hash.slice(1) || 1) - 1; if (k !== i) show(k); });
  show(i);
})();
