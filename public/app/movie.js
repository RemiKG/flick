/* Flick — the movie window comes alive. Three honest render modes:
     • video  — a real MP4 (Qwen r2v when live, or the deterministic ffmpeg reel of
                the stranger's OWN drawing offline). A <video> with a real timeline.
     • scene  — the crayon world animated with CSS (breathe/bob/step-off-the-fridge),
                the mockup look, for our illustrative characters.
     • photo  — a stranger's uploaded drawing gently animated over the crayon set.
   Nothing here fabricates a Qwen result; offline previews are labelled as such. */
(function (root) {
  'use strict';
  const K = root.Crayon, S = root.Scene, UI = root.UI, C = K.C;
  const BEATS = ['pin', 'peel', 'it moves', 'the moon', 'home'];

  function sceneOpts(flick, extra) {
    const r = flick.render || {};
    const night = r.night != null ? r.night : !!(flick.drawingSheet && flick.drawingSheet.night);
    const seed = r.seed || flick.seed || 21;
    let char = r.char || (flick.drawingSheet && flick.drawingSheet.character_kind) || 'dragon';
    if (!['dragon', 'cat', 'robot', 'photo'].includes(char)) char = 'dragon';
    const photoHref = char === 'photo' ? (flick.source && flick.source.imageUrl) : null;
    return Object.assign({ night, seed, char, charColor: r.charColor || null, cloudN: r.cloudN != null ? r.cloudN : 2, photoHref }, extra || {});
  }

  // inner SVG string for a movie scene at a given size
  function sceneSVG(flick, w, h, extra) {
    return UI.movieScene(w, h, sceneOpts(flick, extra));
  }

  // Fill a .window element with the right mode. Returns { kind, video? }.
  function mountWindow(win, flick, opts) {
    opts = opts || {};
    const w = opts.w || 640, h = opts.h || 360;
    const media = flick.media || {};
    win.classList.add('window');
    let inner = '', kind = 'scene';
    // only a GENUINE Qwen render plays as a <video>; the offline ffmpeg zoom-reel
    // ('ffmpeg-post') is downloadable but on screen we show the animated crayon scene
    // (their own drawing, moving) — never the pixelated raw zoom.
    const realVideo = media.videoUrl && flick.cutEngine !== 'ffmpeg-post';
    if ((realVideo || opts.forceVideo) && opts.allowVideo !== false) {
      kind = 'video';
      const poster = media.thumbUrl ? ` poster="${media.thumbUrl}"` : '';
      inner = `<video class="mv-video" src="${media.videoUrl}"${poster} muted playsinline loop preload="metadata"></video>`;
    } else {
      const o = sceneOpts(flick, { spark: opts.spark !== false, motion: opts.motion !== false });
      kind = o.char === 'photo' && o.photoHref ? 'photo' : 'scene';
      inner = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice">${UI.movieScene(w, h, o)}</svg>`;
    }
    const badge = (opts.postBadge) ? `<div class="badge-post">${opts.postBadge}</div>` : '';
    const cap = opts.caption ? `<div class="cap"><span class="line">${opts.caption}</span></div>` : '';
    const play = opts.playButton ? `<button class="playbtn" aria-label="play">${playSVG(opts.playSize || 82)}</button>` : '';
    win.innerHTML = inner + badge + cap + play;
    if (opts.playing) startPlaying(win, kind);
    return { kind, video: win.querySelector('video'), playBtn: win.querySelector('.playbtn') };
  }

  function startPlaying(win, kind) {
    win.classList.add('playing');
    const v = win.querySelector('video');
    if (v) { v.play().catch(() => {}); }
    const b = win.querySelector('.playbtn'); if (b) b.style.opacity = '0';   // reveal the moving art
  }
  function stopPlaying(win) {
    win.classList.remove('playing');
    const v = win.querySelector('video');
    if (v) { try { v.pause(); } catch {} }
    const b = win.querySelector('.playbtn'); if (b) b.style.opacity = '1';
  }

  function playSVG(size) {
    const s = size, r = s * 0.44;
    return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}"><circle cx="${s/2}" cy="${s/2}" r="${r}" fill="${C.paperHi}" stroke="${C.ink}" stroke-width="4" opacity=".93"/>
      <path d="M ${s*0.42} ${s*0.32} L ${s*0.42} ${s*0.68} L ${s*0.7} ${s*0.5} Z" fill="${C.goldCore}"/></svg>`;
  }

  // the still card (left of the money shot): the drawing exactly as photographed
  function stillCard(el, flick, opts) {
    opts = opts || {};
    const w = opts.w || 620, h = opts.h || 430;
    const src = flick.source && flick.source.imageUrl;
    let inner;
    if (src && (!flick.render || flick.render.char === 'photo')) {
      const label = 'my drawing :)';
      inner = `<img src="${src}" alt="the drawing" style="width:100%;height:100%;object-fit:contain;background:${C.cCloud}">
        <div style="position:absolute;left:5%;bottom:5%;font-family:'Patrick Hand';font-size:${h*0.07}px;color:${C.ink55}">${label}</div>`;
    } else {
      const o = sceneOpts(flick, { motion: false, spark: false });
      // a static "drawing" of the character on cream paper with the child's label
      const label = (flick.source && flick.source.title) || 'my drawing :)';
      inner = `<svg viewBox="0 0 ${w} ${h}" preserveAspectRatio="xMidYMid slice" style="background:${C.cCloud}">
        <rect width="${w}" height="${h}" fill="${C.cCloud}"/>
        ${charAt(o, w * 0.5, h * 0.52, h * 0.8)}
        <text x="${w*0.07}" y="${h*0.9}" font-family="'Patrick Hand'" font-size="${h*0.075}" fill="${C.ink55}">${label}</text>
      </svg>`;
    }
    el.innerHTML = inner + `<div class="pins"><svg viewBox="0 0 ${w} ${h}" style="width:100%;height:100%;overflow:visible">${K.pushpin(w*0.1,h*0.07)}${K.pushpin(w*0.9,h*0.07)}</svg></div>`;
  }

  function charAt(o, cx, cy, s) {
    if (o.char === 'robot') return S.robot(cx, cy, s * 0.92, { seed: o.seed, color: o.charColor || C.cPlum });
    if (o.char === 'cat') return S.critter(cx, cy, s * 0.96, { seed: o.seed, color: o.charColor || C.cSun });
    return S.dragon(cx, cy, s, { seed: o.seed });
  }

  // interactive player. Binds to a .window element (video timeline or CSS loop).
  function player(win, flick, opts) {
    opts = opts || {};
    const beats = opts.beats || BEATS;
    const total = (flick.settings && flick.settings.seconds) || (flick.meta && flick.meta.seconds) || 47;
    let on = opts.on != null ? opts.on : 2;
    let playing = false;
    const el = document.createElement('div');
    el.className = 'player';
    el.innerHTML = `
      <button class="pp" aria-label="play/pause">${ppIcon(false)}</button>
      <div class="mid">
        <div class="track"><div class="fill"></div><div class="knob"></div></div>
        <div class="beats">${beats.map((b, i) => `<div class="beat ${i===on?'on':''}" data-i="${i}"><span class="golddot" style="${i===on?'':'background:var(--pencil);opacity:.7'}"></span><span class="lbl">${b}</span></div>`).join('')}</div>
      </div>
      <div class="time">${fmt(total*on/(beats.length-1))} / ${fmt(total)}</div>`;
    const fill = el.querySelector('.fill'), knob = el.querySelector('.knob'), pp = el.querySelector('.pp'), timeEl = el.querySelector('.time');
    const v = win.querySelector('video');

    function setPct(p) { fill.style.width = (p*100)+'%'; knob.style.left = (p*100)+'%'; }
    function setBeat(i, seek) {
      on = Math.max(0, Math.min(beats.length-1, i));
      el.querySelectorAll('.beat').forEach((b, bi) => { b.classList.toggle('on', bi===on); const d=b.querySelector('.golddot'); d.style.background = bi===on?'var(--gold)':'var(--pencil)'; d.style.opacity = bi===on?'1':'.7'; });
      const p = on/(beats.length-1); setPct(p);
      timeEl.textContent = fmt(total*p) + ' / ' + fmt(total);
      if (v && seek && v.duration) v.currentTime = v.duration * p;
      if (!v && (beats[on]==='peel' || beats[on]==='it moves')) { win.classList.remove('stepoff'); void win.offsetWidth; win.classList.add('stepoff'); }
    }
    function play() { playing = true; pp.innerHTML = ppIcon(true); startPlaying(win); }
    function pause() { playing = false; pp.innerHTML = ppIcon(false); stopPlaying(win); }
    pp.onclick = () => (playing ? pause() : play());
    el.querySelectorAll('.beat').forEach((b) => b.onclick = () => setBeat(+b.dataset.i, true));
    el.querySelector('.track').onclick = (e) => { const rect = e.currentTarget.getBoundingClientRect(); const p = (e.clientX-rect.left)/rect.width; setBeat(Math.round(p*(beats.length-1)), true); };
    if (v) { v.addEventListener('timeupdate', () => { if (v.duration) { const p=v.currentTime/v.duration; setPct(p); timeEl.textContent = fmt((flick.settings?.seconds||total)*p)+' / '+fmt(total); } }); }
    setBeat(on, false);
    if (opts.autoplay) play();
    return { el, play, pause, setBeat };
  }
  function ppIcon(playing) {
    return playing
      ? `<svg width="18" height="18"><rect x="3" y="2" width="4" height="14" rx="1" fill="#3a2708"/><rect x="11" y="2" width="4" height="14" rx="1" fill="#3a2708"/></svg>`
      : `<svg width="18" height="18"><path d="M4 2 L4 16 L15 9 Z" fill="#3a2708"/></svg>`;
  }
  function fmt(sec) { sec = Math.max(0, Math.round(sec)); const m = Math.floor(sec/60), s = sec%60; return m+':' + String(s).padStart(2,'0'); }

  root.Movie = { mountWindow, stillCard, player, sceneSVG, sceneOpts, startPlaying, stopPlaying, playSVG, BEATS };
})(window);
