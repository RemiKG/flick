/* Flick — 01 · The Fridge. Pin a drawing. Press play. One composer, one button,
   the toy box to the side, Scribbles peeking in. This is where a stranger's real
   drawing enters the real pipeline. */
(function (root) {
  'use strict';
  const F = root.Flick, K = root.Crayon, S = root.Scene, Movie = root.Movie, C = K.C;
  F.Screens = F.Screens || {};

  F.Screens.fridge = { render };

  async function render(view) {
    const el = document.createElement('div');
    el.className = 'screen scr-fridge';
    el.innerHTML = `
      <div class="main">
        <div class="left">
          <div class="kick">The fridge was the gallery. Now it's the cinema.</div>
          <div class="h1" style="margin-top:6px">Pin a drawing.<br>Press play.</div>
          <div class="hook">Snap what's on your fridge. A little projectionist gives it a story, films it as a real cartoon, and reads it aloud — and every frame <b>still looks like they drew it.</b></div>
          <div class="composer2" id="composer" tabindex="0" role="button" aria-label="Pin a drawing">
            <div class="tapeC" id="tp1" style="left:-6px; top:-14px;"></div>
            <div class="tapeC" id="tp2" style="right:24px; top:-16px;"></div>
            <div class="drop" id="drop">
              <svg class="dropArt" id="dropArt" viewBox="0 0 150 150"></svg>
              <div class="big">Pin a drawing</div>
              <div class="sub">drop it here, or take a photo — any drawing works</div>
            </div>
            <input type="file" id="file" accept="image/*" capture="environment" hidden>
          </div>
          <div class="btnrow">
            <button class="btn gold big" id="make" disabled>Make a flick <span class="k">→</span></button>
            <div class="fine">a doodle · a napkin · your kid's dragon — no account, no app store.</div>
          </div>
        </div>
        <div class="right">
          <div class="rlab">Or peek at the toy box</div>
          <div class="toy" id="toy"><div class="lead" style="color:var(--ink-40)">loading…</div></div>
        </div>
      </div>
      <div class="scribbles" id="scr"></div>`;
    view.appendChild(el);

    el.querySelector('#dropArt').innerHTML = S.dragon(78, 80, 150, { seed: 21 });
    el.querySelector('#tp1').innerHTML = `<svg width="120" height="46" style="overflow:visible">${K.tape(0, 0, 110, 34, -12, 5)}</svg>`;
    el.querySelector('#tp2').innerHTML = `<svg width="120" height="46" style="overflow:visible">${K.tape(0, 0, 110, 34, 10, 6)}</svg>`;
    el.querySelector('#scr').innerHTML = S.scribbles('host', 150);

    // ── composer wiring: drop / click / file → data URL → real palette sample ──
    const composer = el.querySelector('#composer'), file = el.querySelector('#file'), make = el.querySelector('#make'), drop = el.querySelector('#drop');
    F._pending = null;
    composer.addEventListener('click', () => file.click());
    composer.addEventListener('keydown', (e) => { if (e.key === 'Enter' || e.key === ' ') file.click(); });
    composer.addEventListener('dragover', (e) => { e.preventDefault(); composer.classList.add('drag'); });
    composer.addEventListener('dragleave', () => composer.classList.remove('drag'));
    composer.addEventListener('drop', (e) => { e.preventDefault(); composer.classList.remove('drag'); const f = e.dataTransfer.files[0]; if (f) handleFile(f); });
    file.addEventListener('change', () => { if (file.files[0]) handleFile(file.files[0]); });

    function handleFile(f) {
