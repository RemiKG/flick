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
      if (!/^image\//.test(f.type)) { F.toast('That doesn\'t look like an image — try a photo of a drawing.'); return; }
      const reader = new FileReader();
      reader.onload = () => {
        const dataUrl = reader.result;
        const img = new Image();
        img.onload = () => {
          const hints = F.samplePalette(img);
          hints.char = 'photo';
          F._pending = { image: dataUrl, hints, title: (f.name || '').replace(/\.[^.]+$/, '').slice(0, 40) || 'my drawing' };
          composer.classList.add('filled');
          drop.innerHTML = `<img class="preview" src="${dataUrl}" alt="your drawing"><div class="big" style="margin-top:12px">Pinned — ready to roll</div><div class="sub">press “Make a flick”, or tap to choose another</div>`;
          make.disabled = false;
        };
        img.src = dataUrl;
      };
      reader.readAsDataURL(f);
    }

    make.addEventListener('click', async () => {
      if (!F._pending) return;
      make.disabled = true; make.textContent = 'rolling…';
      try {
        const settings = Object.assign({}, F.settings, { title: F._pending.title });
        const res = await F.API.createFlick({ image: F._pending.image, hints: F._pending.hints, settings, child: F.settings.child || 'You' });
        F.currentRun = res.id;
        F.go('/backstage');
      } catch (e) { F.toast('Could not start: ' + e.message); make.disabled = false; make.innerHTML = 'Make a flick <span class="k">→</span>'; }
    });

    // ── toy box (examples) ──
    try {
      const { examples } = await F.API.listFlicks();
      const pick = pickTrio(examples);
      const toy = el.querySelector('#toy');
      toy.innerHTML = pick.map((f, i) => `
        <div class="ep">
          <div class="window win" data-id="${f.id}" style="cursor:pointer"><svg id="ep${i}" viewBox="0 0 210 118" preserveAspectRatio="xMidYMid slice"></svg></div>
          <div class="meta">
            <div class="tagcap">example</div>
            <div class="t">${f.story ? f.story.title : f.id}</div>
            <div class="m">${(f.meta && f.meta.seconds) || f.settings.seconds}s · fidelity ${fmtFid(f.ledger)}</div>
            <div class="ask" data-ask="1">ask your own →</div>
          </div>
        </div>`).join('');
      pick.forEach((f, i) => { document.getElementById('ep' + i).innerHTML = Movie.sceneSVG(f, 210, 118, { spark: false, motion: false, cloudN: 1 }); });
      toy.querySelectorAll('.win').forEach((w) => w.addEventListener('click', () => F.go('/watch/' + w.dataset.id)));
      toy.querySelectorAll('[data-ask]').forEach((a) => a.addEventListener('click', () => file.click()));
    } catch (e) { el.querySelector('#toy').innerHTML = `<div class="lead" style="color:var(--ink-40)">toy box unavailable</div>`; }
  }

  function pickTrio(examples) {
    const byChar = (c) => examples.find((e) => (e.render && e.render.char) === c);
    const trio = [byChar('dragon'), byChar('robot'), byChar('cat')].filter(Boolean);
    for (const e of examples) { if (trio.length >= 3) break; if (!trio.includes(e)) trio.push(e); }
    return trio.slice(0, 3);
  }
  function fmtFid(l) { return l && typeof l.avgFidelity === 'number' ? l.avgFidelity.toFixed(2) : '—'; }
})(window);
