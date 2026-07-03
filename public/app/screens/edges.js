/* Flick — 09 · Honest edges. What we won't fake. Honesty is the moat: here's where
   Flick tells you the truth instead of bluffing. */
(function (root) {
  'use strict';
  const F = root.Flick, S = root.Scene;
  F.Screens = F.Screens || {};
  F.Screens.edges = { render };

  const CARDS = [
    ['critic', 'Fidelity is a spectrum', 'A very abstract scribble is genuinely hard to keep faithful. When the Critic can\'t hold it, Flick <b>says so</b> and offers “keep it looser” or “try again” — it never pretends a drifted render is theirs.'],
    ['camera', 'It takes a beat', 'Video is a real async render (~1–2 min). We show the story, storyboard and title instantly, play a still preview, and stream shots as they finish. <b>Latency is visible, not hidden.</b>'],
    ['board', 'Short by design', 'Free-tier Wan seconds are finite (~50s/model). Episodes are short on purpose, and we <b>re-draw only the shot that drifts</b> — the “quality under a token budget” the track grades.'],
    ['writer', 'Titles are drawn in edit', 'The title card, captions and the fridge frame are <b>deterministic post</b> — reliable and honest, not asked of a video model that can\'t spell. Disclosed, not passed off.'],
    ['reader', 'The risk is real', 'A live render can wobble; that\'s allowed, and we own it. What we protect is the one promise: <b>the character stays the child\'s.</b>'],
    ['cutter', 'Small-N numbers', 'The fidelity scores and second-counts are honest demonstrations from real runs — <b>not a benchmark.</b> We\'d rather under-claim than dress it up.'],
  ];

  function render(view) {
    const el = document.createElement('div');
    el.className = 'screen scr-edges';
    el.innerHTML = `
      <div class="h1" style="font-size:clamp(26px,3.6vw,38px)">What we won't fake.</div>
      <div class="lead" style="font-size:19px;color:var(--ink-55);margin-top:4px">Honesty is the moat. Here's where Flick tells you the truth instead of bluffing.</div>
      <div class="edge-grid">${CARDS.map((c) => `<div class="ec"><div class="ic">${S.crewIcon(c[0], 34)}</div><div class="t">${c[1]}</div><div class="b">${c[2]}</div></div>`).join('')}</div>
      <div class="close-block">
        <div class="l">What Flick will never do is swap in a stranger's ${'dragon'} and call it yours.</div>
        <div class="s">No smoothing. No “improving.” It moves, it talks — and it's still theirs.</div>
      </div>
      <div style="display:flex;justify-content:flex-end;align-items:flex-end;gap:14px;margin-top:10px">
        <div style="font-family:var(--hand);font-size:19px;color:var(--gold-ink);transform:rotate(-4deg)">still theirs. always.</div>
        <div style="width:130px" id="scr"></div>
      </div>`;
    view.appendChild(el);
    el.querySelector('#scr').innerHTML = S.scribbles('cheer', 130);
  }
})(window);
