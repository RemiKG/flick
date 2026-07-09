/* Flick — shared chrome: the top bar (honest live readout), art defs injection,
   and REAL client-side palette sampling from an uploaded drawing (the Drawing
   Sheet's "palette sampled as hex from the actual crayon" — computed from the
   actual pixels, in the browser, with zero dependencies). */
(function (root) {
  'use strict';
  const K = root.Crayon, S = root.Scene, C = K.C;
  const F = (root.Flick = root.Flick || {});

  F.injectArt = function () {
    if (!document.querySelector('.crayon-defs')) document.body.insertAdjacentHTML('afterbegin', K.defs());
  };

  // the top bar — wordmark + tabs + the honest little readout
  F.topbar = function (active) {
    const cfg = F.config || {};
    const live = cfg.engineLive;
    const deploy = cfg.deployLabel || 'running locally';
    const dot = live ? '<span class="golddot"></span>' : '<span class="pendot"></span>';
    const engine = live
      ? `engine <b>qwen · ${(cfg.models && cfg.models.camera) || 'wan2.7-r2v'}</b>`
      : `<span class="off">engine offline · local preview</span>`;
    const tabs = [['Fridge', '/'], ['Backstage', '/backstage'], ['Toy box', '/toybox'], ['Booth', '/booth']];
    const el = document.createElement('div');
    el.className = 'topbar';
    el.innerHTML = `
      <div class="brand" data-go="/">${S.flickMark({ size: 30 })}</div>
      <div class="tabs">${tabs.map(([l, p]) => `<button class="tab ${routeMatch(p, active)?'on':''}" data-go="${p}">${l}</button>`).join('')}</div>
      <div class="spacer"></div>
      <div class="readout">
        <span class="r-hide"><b>free</b> · wan <b>${(cfg.wanFreeSeconds||50)}s</b>/model</span><span class="sep r-hide"></span>
        <span>${engine}</span><span class="sep"></span>
        ${dot}<span><b>${deploy}</b></span>
      </div>`;
    el.querySelectorAll('[data-go]').forEach((n) => n.addEventListener('click', () => F.go(n.dataset.go)));
    return el;
  };
  function routeMatch(p, active) { return p === active || (p === '/' && active === 'fridge') || (active && active.indexOf(p.slice(1)) === 0 && p !== '/'); }

  // REAL palette sampling from an uploaded image (canvas getImageData).
  F.samplePalette = function (img) {
    try {
      const cv = document.createElement('canvas');
      const w = cv.width = 64, h = cv.height = Math.max(1, Math.round(64 * img.naturalHeight / img.naturalWidth));
      const ctx = cv.getContext('2d', { willReadFrequently: true });
      ctx.drawImage(img, 0, 0, w, h);
      const data = ctx.getImageData(0, 0, w, h).data;
      const buckets = new Map(); let lum = 0, n = 0;
      for (let i = 0; i < data.length; i += 4) {
        const a = data[i + 3]; if (a < 40) continue;
        const r = data[i], g = data[i + 1], b = data[i + 2];
        // skip near-white paper so we sample the CRAYON, not the page
        if (r > 232 && g > 226 && b > 210) continue;
        lum += 0.2126 * r + 0.7152 * g + 0.0722 * b; n++;
        const key = (r >> 5 << 10) | (g >> 5 << 5) | (b >> 5);
        const e = buckets.get(key) || { r: 0, g: 0, b: 0, c: 0 };
        e.r += r; e.g += g; e.b += b; e.c++; buckets.set(key, e);
      }
      const top = [...buckets.values()].sort((a, b) => b.c - a.c).slice(0, 6)
        .map((e) => '#' + [e.r, e.g, e.b].map((v) => Math.round(v / e.c).toString(16).padStart(2, '0')).join(''));
      const avgLum = n ? lum / n : 200;
      return { palette: top.length ? top : ['#6FA85C', '#7FB6DA', '#F4C43C'], night: avgLum < 110, aspect: aspectOf(img.naturalWidth, img.naturalHeight) };
    } catch (e) { return { palette: ['#6FA85C', '#7FB6DA', '#F4C43C'], night: false, aspect: '16:9' }; }
  };
  function aspectOf(w, h) { const r = w / h; return r > 1.25 ? '16:9' : r < 0.8 ? '9:16' : '1:1'; }

  F.toast = function (msg) {
    let t = document.querySelector('.toast');
    if (!t) { t = document.createElement('div'); t.className = 'toast'; document.body.appendChild(t); }
    t.textContent = msg; t.classList.add('show');
    clearTimeout(F._toastT); F._toastT = setTimeout(() => t.classList.remove('show'), 2200);
  };

  F.footer = function () {
    const d = document.createElement('div'); d.className = 'foot-line';
    const cfg = F.config || {};
    const mirror = cfg.ephemeral && cfg.primaryUrl
      ? ` · hosted mirror (flicks last one session) — <a class="em" href="${cfg.primaryUrl}" target="_blank" rel="noopener" style="color:inherit">persistent toy box lives here →</a>`
      : '';
    d.innerHTML = 'running on ' + (cfg.deployLabel || 'Node') + ' · Qwen Cloud · wan2.7-r2v · MIT open source' + mirror + ' · <span class="em" style="cursor:pointer" data-go="/edges">what we won\'t fake →</span>';
    d.querySelector('[data-go]').addEventListener('click', () => F.go('/edges'));
    return d;
  };

  // crew icon glyph passthrough (used by several screens)
  F.crewIcon = (kind, s) => S.crewIcon(kind, s || 34);
})(window);
