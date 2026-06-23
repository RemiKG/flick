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
