/* Written with AI coding assistants (Anthropic Claude), directed and reviewed by the team, Spark Squad. See AI_USE.md. */
/* song.js: show the player and the audio download only when media/song.m4a is there; otherwise one calm line. Never autoplays. */
(function () {
  'use strict';
  const player = document.getElementById('player'), dl = document.getElementById('dl-audio'), wait = document.getElementById('wait');
  fetch('media/song.m4a', { method: 'HEAD', cache: 'no-store' })
    .then(r => { if (!r.ok) throw new Error('missing'); player.hidden = false; dl.hidden = false; wait.hidden = true; })
    .catch(() => { player.hidden = true; dl.hidden = true; wait.hidden = false; });
})();
