/* Flick — 02 · Backstage. The pipeline IS the screen. The crew lights up in order,
   the fidelity meter ticks honestly, the shot that drifts gets drawn again. Every
   step is a real Qwen Cloud call (or the honest local fallback), streamed over SSE. */
(function (root) {
  'use strict';
  const F = root.Flick, S = root.Scene, Movie = root.Movie, C = root.Crayon.C;
  F.Screens = F.Screens || {};
  F.Screens.backstage = { render };

  const ROLES = [
    ['reader', 'The Reader', 'read_drawing', 'reader'],
    ['writer', 'The Writer', 'write_story', 'writer'],
    ['board', 'The Storyboarder', 'storyboard', 'board'],
    ['painter', 'The Set Painter', 'paint_set', 'painter'],
    ['camera', 'The Camera', 'roll_camera', 'camera'],
    ['critic', 'The Critic', 'check_fidelity', 'critic'],
    ['voice', 'The Voice', 'voice_line', 'voice'],
    ['cutter', 'The Cutter', 'cut_episode', 'cutter'],
  ];
  const MODEL = {};
  function modelFor(id) { const c = (F.config && F.config.models) || {}; return { reader: c.reader, writer: c.writer, board: c.storyboarder, painter: c.painter, camera: c.camera, critic: c.critic, voice: c.voice, cutter: 'ffmpeg' }[id] || ''; }

  async function render(view) {
    const id = F.currentRun || F.paramId();
    const el = document.createElement('div');
    el.className = 'screen scr-backstage';
    if (!id) {
      el.innerHTML = `<div class="h2">Backstage</div>
        <div class="lead" style="margin-top:8px;max-width:560px">The pipeline is the screen — but there's nothing rolling yet. Pin a drawing on the fridge and watch the crew make it.</div>
        <div style="margin-top:20px"><button class="btn gold" data-go="/">Pin a drawing →</button></div>`;
      view.appendChild(el);
      el.querySelector('[data-go]').onclick = () => F.go('/');
      return;
    }

    let flick = null;
    try { flick = await F.API.getFlick(id); } catch { }
    const nShots = (flick && flick.settings && flick.settings.shots) || 5;

    el.innerHTML = `
      <div class="main">
        <div class="left">
          <div class="head">
            <div class="h2">Backstage — watch the crew make it</div>
            <div class="status" id="status"><span class="golddot"></span>warming up…</div>
          </div>
          <div class="lead" style="font-size:17px;margin-top:4px;color:var(--ink-55)">The pipeline <b class="em">is</b> the screen. Every step is a real ${F.config && F.config.engineLive ? 'Qwen Cloud call' : 'call — offline preview until a Qwen key is added'}.</div>
          <div class="window stage-win" id="win">
            <div class="badge-post" id="rendering" style="left:auto;right:10px">${F.config && F.config.engineLive ? 'rendering · wan2.7-r2v · 720P' : 'local preview'}</div>
            <div class="cap"><span class="line" id="cap">reading the drawing…</span></div>
          </div>
          <div class="metric">
            <div>
              <div class="mlab">fidelity — does it still look like they drew it?</div>
              <div class="meter"><div class="val" id="fval">—</div></div>
            </div>
            <div class="fbox">
              <div class="meter"><div class="track"><div class="fill" id="ffill" style="width:0%"></div><div class="thr" id="fthr" style="left:80%"></div></div></div>
              <div class="redrew" id="redrew">the Critic checks every shot back against the drawing.</div>
            </div>
          </div>
          <div class="strip2" id="strip"></div>
        </div>
        <div class="right">
          <div class="rlab">The crew · a solo director running the whole team</div>
          <div class="crew" id="crew"></div>
        </div>
      </div>`;
    view.appendChild(el);

    // crew rail
    const crew = el.querySelector('#crew');
    crew.innerHTML = ROLES.map(([id2, nm, fn, kind]) => `
      <div class="role wait" id="role-${id2}">
        <div class="ic">${S.crewIcon(kind, 34)}</div>
        <div><div class="nm">${nm}</div><div class="fn">${fn} · ${modelFor(id2)}</div></div>
        <span class="st" id="st-${id2}">queued</span>
      </div>`).join('');

    // movie window (their drawing / the scene), paused until camera rolls
    const win = el.querySelector('#win');
    if (flick) mountWin(win, flick, 'reading the drawing…');
    // shot strip placeholders
    const strip = el.querySelector('#strip');
    renderStrip(strip, Array.from({ length: nShots }, (_, i) => ({ shot_no: i + 1, status: 'queued' })), flick);

    // ── stream ──
    const set = (id2, cls, st) => { const r = el.querySelector('#role-' + id2); if (r) { r.className = 'role ' + cls; el.querySelector('#st-' + id2).textContent = st; el.querySelector('#st-' + id2).className = 'st' + (cls !== 'wait' ? ' ok' : ''); } };
    const status = el.querySelector('#status');
    let shots = (flick && flick.shots) || [];
    let done = false;

    const es = F.API.stream(id, (e) => {
      switch (e.stage) {
        case 'reader': set('reader', e.status === 'done' ? 'done' : 'run', e.status === 'done' ? '✓ done' : 'reading…');
          if (e.status === 'done' && e.drawingSheet) { flick.drawingSheet = e.drawingSheet; cap(el, 'the reader named the hero — writing the story…'); mountWin(win, flick, null); } break;
        case 'writer': set('writer', e.status === 'done' ? 'done' : 'run', e.status === 'done' ? '✓ done' : 'writing…');
          if (e.status === 'done') { flick.story = e.story; cap(el, `“${e.title}” — laying the storyboard…`); } break;
        case 'board': set('board', e.status === 'done' ? 'done' : 'run', e.status === 'done' ? '✓ done' : 'boarding…');
          if (e.status === 'done') { shots = e.shots; flick.shots = shots; renderStrip(strip, shots, flick); } break;
        case 'painter': set('painter', e.status === 'done' ? 'done' : 'run', e.status === 'done' ? '✓ done' : 'painting…'); break;
        case 'camera':
          if (e.status === 'rolling') { set('camera', 'run', 'rolling…'); status.innerHTML = `<span class="golddot"></span>filming · shot ${e.shot} of ${shots.length}`; markShot(strip, e.shot, 'rolling'); cap(el, `the Camera is rolling shot ${e.shot}.`); winShot(win, flick, e.shot); }
          else if (e.status === 'done') { markShot(strip, e.shot, 'done', shotFid(shots, e.shot)); } break;
        case 'critic': set('critic', 'run', 'checking…'); setMeter(el, e.fidelity); markShotFid(shots, e.shot, e.fidelity); break;
        case 'redraw':
          if (e.status === 'running') { el.querySelector('#redrew').innerHTML = `shot ${e.shot} came back at <b class="lo">${(e.from||0).toFixed(2)}</b> — too smoothed → <b>drawing that one again…</b>`; markShot(strip, e.shot, 'redraw'); }
          else { el.querySelector('#redrew').innerHTML = `shot ${e.shot} came back at <b class="lo">${(e.from||0).toFixed(2)}</b> — too smoothed → <b>drew that one again</b> → ${(e.to||0).toFixed(2)}. We only re-draw the shot that drifts.`; setMeter(el, e.to); } break;
        case 'voice': set('voice', e.status === 'done' ? 'done' : 'run', e.status === 'done' ? '✓ done' : 'voicing…'); break;
        case 'cutter': set('cutter', e.status === 'done' ? 'done' : 'run', e.status === 'done' ? '✓ done' : 'cutting…');
          if (e.status === 'done') { set('camera', 'done', '✓ done'); set('critic', 'done', '✓ done'); } break;
        case 'ledger': if (e.ledger && typeof e.ledger.avgFidelity === 'number') setMeter(el, e.ledger.avgFidelity, true); break;
        case 'complete':
          done = true; flick = e.flick; status.innerHTML = `<span class="golddot"></span>done · it's alive`;
          cap(el, 'ready — step it off the fridge.');
          showComplete(el, flick); es.close(); break;
        case 'error': status.innerHTML = `<span class="pendot"></span>` + (e.message || 'something wobbled'); es.close(); break;
      }
    });
    F._teardown = () => { try { es.close(); } catch {} };
  }

  function mountWin(win, flick, capLine) {
    Movie.mountWindow(win, flick, { w: 830, h: 390, playing: false, allowVideo: false, spark: !!(flick.render && flick.render.night) });
    if (capLine) cap({ querySelector: (s) => win.querySelector(s) }, capLine, win);
    // re-add badge + cap holders
    if (!win.querySelector('.badge-post')) win.insertAdjacentHTML('beforeend', `<div class="badge-post" style="left:auto;right:10px">${F.config && F.config.engineLive ? 'rendering · wan2.7-r2v · 720P' : 'local preview'}</div>`);
    if (!win.querySelector('.cap')) win.insertAdjacentHTML('beforeend', `<div class="cap"><span class="line" id="cap">${capLine || ''}</span></div>`);
  }
  function winShot(win, flick, shotNo) {
    // render the scene for this shot (night per flick), playing to read as alive
    Movie.mountWindow(win, flick, { w: 830, h: 390, playing: true, allowVideo: false });
    win.insertAdjacentHTML('beforeend', `<div class="badge-post" style="left:auto;right:10px">${F.config && F.config.engineLive ? 'rendering · wan2.7-r2v · 720P' : 'local preview'}</div>`);
    win.insertAdjacentHTML('beforeend', `<div class="cap"><span class="line" id="cap">the Camera is rolling shot ${shotNo}.</span></div>`);
  }
  function cap(el, text, winEl) { const c = (winEl || document).querySelector ? (winEl ? winEl.querySelector('#cap') : el.querySelector('#cap')) : null; if (c) c.textContent = text; }

  function renderStrip(strip, shots, flick) {
    if (flick) F._flickForStrip = flick;
    strip.innerHTML = shots.map((s) => `
      <div class="shot2 ${s.status === 'queued' ? 'wait' : ''}" id="cell-${s.shot_no}">
        <svg viewBox="0 0 150 92" preserveAspectRatio="xMidYMid slice" class="cell-art"></svg>
        <div class="lb">shot ${s.shot_no}</div>
        <div class="sl"><svg width="26" height="26" viewBox="-13 -13 26 26">${S.seal(sealKind(s.status), 0, 0, 11)}</svg></div>
      </div>`).join('');
    shots.forEach((s) => { const cell = strip.querySelector('#cell-' + s.shot_no); if (!cell) return; const art = cell.querySelector('.cell-art');
      if (s.status === 'queued') art.innerHTML = `<rect width="150" height="92" fill="${C.paperLo}"/><g opacity=".5">${S.seal('wait', 75, 46, 10)}</g>`;
      else art.innerHTML = Movie.sceneSVG(flick || {}, 150, 92, { spark: false, motion: s.status === 'rolling', cloudN: 1 }); });
  }
  function markShot(strip, no, status, fid) {
    const cell = strip.querySelector('#cell-' + no); if (!cell) return;
    cell.classList.toggle('wait', false);
    cell.querySelector('.sl').innerHTML = `<svg width="26" height="26" viewBox="-13 -13 26 26">${S.seal(sealKind(status), 0, 0, 11)}</svg>`;
    const art = cell.querySelector('.cell-art');
    if (art && art.querySelector('rect')) art.innerHTML = Movie.sceneSVG(F._flickForStrip || {}, 150, 92, { spark: false, motion: true, cloudN: 1 });
  }
  function sealKind(status) { return status === 'done' ? 'kept' : status === 'rolling' ? 'rolling' : status === 'redraw' ? 'redraw' : 'wait'; }
  function shotFid(shots, no) { const s = shots.find((x) => x.shot_no === no); return s ? s.fidelity : null; }
  function markShotFid(shots, no, fid) { const s = shots.find((x) => x.shot_no === no); if (s) s.fidelity = fid; }

  function setMeter(el, v, soft) {
    if (typeof v !== 'number') return;
    const fval = el.querySelector('#fval'), ffill = el.querySelector('#ffill');
    fval.textContent = v.toFixed(2);
    fval.classList.toggle('redraw', v < 0.8);
    ffill.style.width = Math.round(v * 100) + '%';
  }

  function showComplete(el, flick) {
    const status = el.querySelector('#status');
    // swap the movie window to the finished flick (video if present) + a CTA
    const win = el.querySelector('#win');
    Movie.mountWindow(win, flick, { w: 830, h: 390, playing: true, caption: flick.story ? flick.story.title + ' — steps off the fridge.' : '' });
    if (!el.querySelector('#seeit')) {
      const cta = document.createElement('div');
      cta.style.marginTop = '16px';
      cta.innerHTML = `<button class="btn gold big" id="seeit">See it come off the fridge <span class="k">→</span></button>`;
      el.querySelector('.left').appendChild(cta);
      cta.querySelector('#seeit').onclick = () => F.go('/watch/' + flick.id);
    }
    setTimeout(() => { if (location.pathname.startsWith('/backstage')) F.go('/watch/' + flick.id); }, 2600);
  }
})(window);
