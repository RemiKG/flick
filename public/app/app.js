/* Flick — bootstrap, state, and the tiny client router. One origin, relative
   routes: / (Fridge) · /backstage · /toybox · /booth · /watch/:id · /edges. */
(function (root) {
  'use strict';
  const F = (root.Flick = root.Flick || {});

  // ── settings (the Booth persists here; used for the next flick) ──
  const DEFAULTS = { mood: 'a bedtime story', shots: 5, seconds: 47, threshold: 0.8, onDrift: 'again', voice: 'storybook', aspect: '9:16' };
  try { F.settings = Object.assign({}, DEFAULTS, JSON.parse(localStorage.getItem('flick.settings') || '{}')); }
  catch { F.settings = Object.assign({}, DEFAULTS); }
  F.saveSettings = function () { try { localStorage.setItem('flick.settings', JSON.stringify(F.settings)); } catch {} };

  // ── navigation ──
  F.go = function (path, opts) {
    opts = opts || {};
    if (opts.replace) history.replaceState({}, '', path); else history.pushState({}, '', path);
    F.render();
    if (!opts.keepScroll) window.scrollTo(0, 0);
  };
  window.addEventListener('popstate', () => F.render());

  // ── render the current route ──
  F.render = function () {
    const view = document.getElementById('view');
    const tb = document.getElementById('topbar');
    const path = location.pathname.replace(/\/+$/, '') || '/';
    let active = 'fridge', screen;
    if (path === '/' || path === '') { active = 'fridge'; screen = F.Screens.fridge; }
    else if (path.startsWith('/backstage')) { active = 'backstage'; screen = F.Screens.backstage; }
    else if (path.startsWith('/toybox')) { active = 'toybox'; screen = F.Screens.toybox; }
    else if (path.startsWith('/booth')) { active = 'booth'; screen = F.Screens.booth; }
    else if (path.startsWith('/watch/')) { active = 'watch'; screen = F.Screens.watch; }
    else if (path.startsWith('/edges')) { active = 'edges'; screen = F.Screens.edges; }
    else { active = 'fridge'; screen = F.Screens.fridge; }

    // rebuild topbar
    tb.innerHTML = ''; tb.appendChild(F.topbar(active));
    // teardown previous screen (close SSE/video)
    if (F._teardown) { try { F._teardown(); } catch {} F._teardown = null; }
    view.innerHTML = '';
    try { screen.render(view, { path }); } catch (e) { view.innerHTML = `<div class="screen"><div class="h2">Something wobbled.</div><div class="lead">${e.message}</div></div>`; console.error(e); }
    // footer
    if (!document.querySelector('.foot-line') && (active === 'fridge')) document.getElementById('app').appendChild(F.footer());
  };

  F.paramId = function () { const m = location.pathname.match(/\/watch\/([a-z0-9-]+)/i); return m ? m[1] : null; };

  // ── boot ──
  async function boot() {
    F.injectArt();
    try { await Promise.all([
      document.fonts.load("700 40px 'Fredoka'"), document.fonts.load("400 22px 'Patrick Hand'"),
      document.fonts.load("800 14px 'Nunito'"), document.fonts.load("400 13px 'Space Mono'"),
    ]); } catch {}
    try { F.config = await F.API.config(); } catch { F.config = { engineLive: false, deployLabel: 'running locally', wanFreeSeconds: 50, models: {} }; }
    F.render();
  }
  boot();
})(window);
