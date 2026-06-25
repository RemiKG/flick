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
