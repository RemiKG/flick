/* Flick — the flick, watched. Four sub-views of one finished episode:
     Still ⇄ Alive (the money shot) · Off the fridge (the peel) · Drawing Sheet
     (the trust proof) · Send it (the keepsake). This is where "it's still theirs"
     is on screen, on the stranger's own drawing. */
(function (root) {
  'use strict';
  const F = root.Flick, K = root.Crayon, S = root.Scene, Movie = root.Movie, C = K.C;
  F.Screens = F.Screens || {};
  F.Screens.watch = { render };

  async function render(view) {
    const id = F.paramId();
    let flick;
    try { flick = await F.API.getFlick(id); } catch { }
    // ephemeral host (hosted mirror): the server copy may be gone — fall back to
    // the session copy saved when the run completed, so YOUR flick still plays.
    if (!flick) { try { flick = JSON.parse(sessionStorage.getItem('flick.last.' + id) || 'null'); } catch { } }
    if (!flick) {
      const cfg = F.config || {};
      const mirror = cfg.ephemeral && cfg.primaryUrl
        ? `<div class="lead" style="margin-top:10px;max-width:620px">This hosted mirror keeps flicks only for the session that made them. The persistent toy box runs on the Alibaba Cloud deployment: <a class="em" href="${cfg.primaryUrl}" target="_blank" rel="noopener">${cfg.primaryUrl.replace(/^https?:\/\//,'')}</a></div>` : '';
      view.innerHTML = `<div class="screen"><div class="h2">That flick isn't here.</div>${mirror}<div class="lead" style="margin-top:8px"><span class="em" style="cursor:pointer" data-go="/toybox">Open the toy box →</span></div></div>`;
      view.querySelector('[data-go]').onclick = () => F.go('/toybox'); return;
    }

    const el = document.createElement('div');
    el.className = 'screen scr-watch';
    const tabs = [['stillalive', 'Still ⇄ Alive'], ['offfridge', 'Off the fridge'], ['sheet', 'Drawing sheet'], ['send', 'Send it']];
    el.innerHTML = `<div class="subtabs">${tabs.map(([k, l], i) => `<button class="subtab ${i===0?'on':''}" data-tab="${k}">${l}</button>`).join('')}</div><div id="sub"></div>`;
    view.appendChild(el);
    const sub = el.querySelector('#sub');
    const show = (k) => { el.querySelectorAll('.subtab').forEach((b) => b.classList.toggle('on', b.dataset.tab === k)); teardown(); sub.innerHTML = ''; VIEWS[k](sub, flick); };
    el.querySelectorAll('.subtab').forEach((b) => b.onclick = () => show(b.dataset.tab));
    show('stillalive');
    F._teardown = teardown;
  }
  let _players = [];
  function teardown() { _players.forEach((p) => { try { p.pause(); } catch {} }); _players = []; }

  const VIEWS = { stillalive: stillAlive, offfridge: offFridge, sheet: sheet, send: send };

  function charName(flick) { const k = flick.drawingSheet && flick.drawingSheet.character_kind; return k && k !== 'drawing' && k !== 'other' ? k : 'drawing'; }
  function narration(flick) {
    const b = flick.story && flick.story.beats;
    return b && b.length ? b[b.length - 1].text : '…and it was warm, and it was theirs.';
  }

  // ── 04 · Still ⇄ Alive (the money shot) ──
  function stillAlive(sub, flick) {
    const fid = flick.ledger && flick.ledger.avgFidelity;
    sub.innerHTML = `
      <div class="sa-head">
        <div class="h1" style="font-size:clamp(24px,3.4vw,34px)">It moves. It talks. It's still theirs.</div>
        <div class="badge">● ${flick.mode === 'qwen' ? 'live' : 'local preview'} · fidelity ${fid ? fid.toFixed(2) : '—'} · same ${charName(flick)}</div>
      </div>
      <div class="narr">the same wonky drawing — <b>still</b>, and then <b>alive</b>. ${sig2(flick)}</div>
      <div class="sa-row">
        <div class="sa-col">
          <div class="clab">the drawing — exactly as photographed</div>
          <div class="stillCard" id="still"></div>
        </div>
        <div class="sa-col">
          <div class="clab"><span class="golddot"></span>the movie — the same ${charName(flick)}, moving</div>
          <div class="window" id="alive"></div>
        </div>
      </div>
      <div id="player"></div>`;
    Movie.stillCard(sub.querySelector('#still'), flick, { w: 620, h: 430 });
    const win = sub.querySelector('#alive');
    const post = flick.cutEngine === 'ffmpeg-post' ? 'local preview · deterministic post' : null;
    Movie.mountWindow(win, flick, { w: 620, h: 430, playing: true, caption: `“${narration(flick)}”`, playButton: true, playSize: 72, postBadge: post });
    wirePlay(win);
    const p = Movie.player(win, flick, { on: 2, autoplay: true }); _players.push(p);
    sub.querySelector('#player').appendChild(p.el);
  }
  function sig2(flick) {
    const s = (flick.drawingSheet && flick.drawingSheet.signatures) || [];
    if (s.length >= 2) return `${s[0]}. ${s[1]}.`;
    return 'same two-sized wings. same over-pressed green.';
  }

  // ── 03 · Off the fridge (the peel) ──
  function offFridge(sub, flick) {
    sub.innerHTML = `
      <div class="h2">Off the fridge</div>
      <div class="cap2">The still drawing holds — then it <b>peels off the page</b> and steps into its own movie.</div>
      <div class="window offwin" id="win"><div class="cap"><span class="line">${flick.story ? flick.story.title : 'a flick'} — steps off the fridge.</span></div></div>
      <div id="player"></div>`;
    const win = sub.querySelector('#win');
    const W = 1320, H = 496;
    const o = Movie.sceneOpts(flick, { dx: W * 0.60, dy: H * 0.55, ds: H * 0.82, spark: false, motion: true, cloudN: 2 });
    const px = 430;
    const src = flick.source && flick.source.imageUrl;
    const ghost = (o.char === 'photo' && src)
      ? `<image href="${src}" x="${px*0.16}" y="${H*0.12}" width="${px*0.7}" height="${H*0.7}" opacity=".3" preserveAspectRatio="xMidYMid meet"/>`
      : `<g opacity=".28">${charGlyph(o, px * 0.5, H * 0.42, H * 0.7, false)}</g>`;
    win.insertAdjacentHTML('afterbegin', `<svg viewBox="0 0 ${W} ${H}" preserveAspectRatio="xMidYMid slice">
      ${root.UI.movieScene(W, H, o)}
      <path d="M 0 0 L ${px} 0 Q ${px+30} ${H*0.5} ${px-20} ${H} L 0 ${H} Z" fill="${C.cCloud}"/>
      <path d="M ${px} 0 Q ${px+30} ${H*0.5} ${px-20} ${H}" fill="none" stroke="${C.ink26}" stroke-width="3" filter="url(#wax)"/>
      <path d="M ${px-20} ${H} q 70 -30 96 -96 q -60 20 -96 96 Z" fill="${C.paper2}" stroke="${C.ink26}" stroke-width="2" filter="url(#wax)"/>
      <text x="60" y="${H-40}" font-family="'Patrick Hand'" font-size="30" fill="${C.ink55}">${(flick.source && flick.source.title) || 'my drawing :)'}</text>
      ${ghost}
      <g class="mv-spark">${K.star(px-6,H*0.42,12,{seed:3,glow:true})}${K.star(px+70,H*0.36,9,{seed:4,glow:true})}${K.star(px+150,H*0.5,7,{seed:5,glow:true})}</g>
    </svg>`);
    const p = Movie.player(win, flick, { on: 1 }); _players.push(p);
    sub.querySelector('#player').appendChild(p.el);
    win.classList.add('playing');
  }
  function charGlyph(o, cx, cy, s, flame) {
    if (o.char === 'robot') return S.robot(cx, cy, s * 0.92, { seed: o.seed, color: o.charColor || C.cPlum });
    if (o.char === 'cat') return S.critter(cx, cy, s * 0.96, { seed: o.seed, color: o.charColor || C.cSun });
    return S.dragon(cx, cy, s, { seed: o.seed, flame });
  }

  // ── 05 · Drawing Sheet (the trust proof) ──
  function sheet(sub, flick) {
    const ds = flick.drawingSheet || {}; const led = flick.ledger || {};
    const redrawn = (flick.shots || []).filter((s) => (s.redraws || 0) > 0);
    const sigs = (ds.signatures || ['the wonky proportions', 'the colours they pressed', 'crayon that went past the lines']).slice(0, 5);
    const keptRows = sigs.map((g) => keptRow(g, keptDetail(g), true)).join('')
      + (redrawn.length ? keptRow(`shot ${redrawn[0].shot_no} started to smooth it`, `drew that one again → back to ${(redrawn[0].fidelity||flick.ledger.avgFidelity||0).toFixed(2)}`, false) : '');
    const c = document.createElement('div'); c.className = 'scr-sheet';
    c.innerHTML = `
      <div class="main">
        <div class="left">
          <div class="clab">the drawing you pinned</div>
          <div class="drawCard" id="draw"></div>
          <div class="stats" style="margin-top:18px">
            <div class="stat gold"><div class="n">${led.avgFidelity ? led.avgFidelity.toFixed(2) : '—'}</div><div class="k">avg fidelity</div></div>
            <div class="stat"><div class="n">${led.redrawn||0}<span class="u">/${led.shotsTotal||(flick.shots||[]).length}</span></div><div class="k">shots re-drawn</div></div>
            <div class="stat"><div class="n">0</div><div class="k">strangers' ${charName(flick)}s</div></div>
          </div>
        </div>
        <div class="right">
          <div class="h1" style="font-size:clamp(26px,3.6vw,38px)">It's still theirs.</div>
          <div class="neg">No smoothing. No “improving.” <b>No turning your kid's ${charName(flick)} into someone else's.</b></div>
          <div class="keptbox">${keptRows}</div>
          <div class="explain"><div style="flex:none">${S.crewIcon('critic', 40)}</div>
            <div>After every shot, <b>the Critic (${(F.config&&F.config.models&&F.config.models.critic)||'qwen3-vl'})</b> compares each frame back to your drawing on a fidelity rubric — <b>same character? same colours? same wonky proportions? did it get “improved”?</b> If a shot drifts below <b>${(flick.settings&&flick.settings.threshold)||0.8}</b>, Flick draws that one shot again — never the whole episode. <i>The model proposes; the Critic keeps it theirs.</i></div>
          </div>
        </div>
      </div>`;
    sub.appendChild(c);
    Movie.stillCard(c.querySelector('#draw'), flick, { w: 520, h: 430 });
  }
  const DETAILS = {
    'two different-sized wings': 'kept — the left one\'s bigger, just like the drawing',
    'the over-pressed green': 'kept — where they pressed too hard, it\'s darker',
    'two mismatched eyes': 'kept — one big, one small',
    'the scribbled flame': 'kept — still a scribble, not a render',
    'crayon that went past the lines': 'kept — we don\'t tidy it up',
  };
  function keptDetail(g) { return DETAILS[g] || 'kept — exactly as they drew it'; }
  function keptRow(g, s, kept) {
    return `<div class="kept ${kept?'':'loose'}"><div><div class="g">${g}</div><div class="s">${s}</div></div>
      <div class="seal"><svg width="30" height="30" viewBox="-14 -14 28 28">${S.seal(kept?'kept':'redraw',0,0,11)}</svg></div></div>`;
  }

  // ── 08 · Send it (the keepsake) ──
  function send(sub, flick) {
    const fid = flick.ledger && flick.ledger.avgFidelity;
    const url = location.origin + '/watch/' + flick.id;
    const c = document.createElement('div'); c.className = 'scr-send';
    c.innerHTML = `
      <div class="main">
        <div class="left">
          <div class="clab">what they'll get</div>
          <div class="share">
            <div class="window" id="win"></div>
            <div class="meta"><div class="t">${flick.story ? flick.story.title : 'a flick'}</div>
              <div class="m">a flick · ${(flick.meta&&flick.meta.seconds)||flick.settings.seconds}s · fidelity ${fid?fid.toFixed(2):'—'} · in ${(flick.child||'their')==='You'?'your':flick.child+'’s'} hand</div></div>
            <div class="urlbar"><span class="golddot"></span><span id="url">${url.replace(/^https?:\/\//,'')}</span><span class="copy" id="copy">copy</span></div>
          </div>
        </div>
        <div class="right">
          <div class="h1" style="font-size:clamp(26px,3.4vw,36px)">Send it to the one who'd cry.</div>
          <div class="lead" style="font-size:19px;margin-top:6px">Grandma's three time zones away. She's never seen the fridge.</div>
          <div style="margin-top:16px" class="recip">✎ to Grandma · reads it in <u>her own voice</u></div>
          <div class="msg">“you HAVE to see what ${flick.child&&flick.child!=='You'?flick.child:'they'} drew — I made it into a little movie, and it reads in <b>your</b> voice. press play. 💛”</div>
          <div class="voice"><div style="flex:none">${S.crewIcon('voice',38)}</div>
            <div>Clone a grandparent's voice from a <b>15-second clip</b> (<span style="font-family:var(--mono)">qwen-voice-enrollment</span>) — so the person who'd love it most is the one reading it aloud. Their copy is saved to the toy box; Qwen's links expire in a day, Flick keeps yours.</div></div>
          <div class="btnrow" style="margin-top:20px">
            <button class="btn gold big" id="sendit">Send it <span class="k">→</span></button>
            <button class="btn ghost" id="copylink">copy link</button>
            <button class="btn ghost" id="savemp4">save .mp4</button>
          </div>
          <div class="diff"><b>Soap</b> makes a video about you. <b>Fathom</b> makes one you send to a curious friend. <b>Flick</b> makes one you send to the person who'd cry to see it — <b>and it's still theirs.</b></div>
        </div>
      </div>`;
    sub.appendChild(c);
    const win = c.querySelector('#win');
    Movie.mountWindow(win, flick, { w: 628, h: 340, playing: true, playButton: true, playSize: 68 });
    wirePlay(win);
    const copy = () => { navigator.clipboard?.writeText(url).then(() => F.toast('Link copied 💛')).catch(() => F.toast(url)); };
    c.querySelector('#copy').onclick = copy; c.querySelector('#copylink').onclick = copy;
    c.querySelector('#sendit').onclick = () => {
      if (navigator.share) navigator.share({ title: flick.story ? flick.story.title : 'A flick', text: 'You HAVE to see this — it\'s still theirs.', url }).catch(() => {});
      else { copy(); F.toast('Link copied — send it to the one who\'d cry 💛'); }
    };
    c.querySelector('#savemp4').onclick = () => {
      if (flick.media && flick.media.videoUrl) { const a = document.createElement('a'); a.href = flick.media.videoUrl; a.download = (flick.story ? flick.story.title : 'flick') + '.mp4'; a.click(); F.toast('Saving your flick…'); }
      else F.toast('This example plays live — pin your own drawing to get a downloadable .mp4.');
    };
  }

  function wirePlay(win) { const b = win.querySelector('.playbtn'); if (b) b.onclick = () => { const playing = win.classList.toggle('playing'); const v = win.querySelector('video'); if (v) { playing ? v.play().catch(()=>{}) : v.pause(); } b.style.opacity = playing ? '0' : '1'; }; }
})(window);
