/* Flick — 07 · The Toy Box. Every flick kept as a pinned little movie. A light
   Series Bible per child — the same character comes back looking like itself,
   episode after episode. A season per kid. Examples are clearly separated. */
(function (root) {
  'use strict';
  const F = root.Flick, K = root.Crayon, Movie = root.Movie;
  F.Screens = F.Screens || {};
  F.Screens.toybox = { render };

  async function render(view) {
    const el = document.createElement('div');
    el.className = 'screen scr-toybox';
    el.innerHTML = `<div class="head"><div class="h2">The toy box</div>
      <div class="lead" style="color:var(--ink-55)">every flick, kept. <b class="em">The fridge never had this much room.</b></div>
      <div class="stats" id="stats"></div></div><div id="body"></div>`;
    view.appendChild(el);

    let data;
    try { data = await F.API.listFlicks(); } catch { el.querySelector('#body').innerHTML = `<div class="empty-toy">the toy box is offline.</div>`; return; }
    const { kept, examples, stats } = data;
    el.querySelector('#stats').innerHTML = `
      <div class="stat gold"><div class="n">${stats.kept}</div><div class="k">flicks kept</div></div>
      <div class="stat"><div class="n">${stats.watchedMin ?? 0}<span class="u">min</span></div><div class="k">watched</div></div>
      <div class="stat"><div class="n">${stats.avgFidelity ? stats.avgFidelity.toFixed(2) : '—'}</div><div class="k">avg fidelity</div></div>`;

    const body = el.querySelector('#body');
    if (!kept.length && !examples.length) { body.innerHTML = `<div class="empty-toy">No flicks yet. Pin a drawing — the fridge is waiting.</div>`; return; }

    // group kept by child (a season per kid)
    const groups = new Map();
    kept.forEach((f) => { const k = f.child || 'You'; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(f); });
    const ordered = [...groups.entries()].sort((a, b) => b[1].length - a[1].length);

    let html = '';
    ordered.forEach(([child, flicks]) => {
      flicks.sort((a, b) => (a.series?.episode || 99) - (b.series?.episode || 99));
      const hasSeries = flicks.some((f) => f.series);
      const label = child === 'You' ? 'Your toy box' : `${child}'s toy box · a season, one child`;
      html += `<div class="rlab">${label}<span class="bar"></span>${hasSeries ? '<span class="series">series bible · same characters</span>' : ''}</div>
        <div class="shelf">${flicks.map((f) => card(f)).join('')}</div>`;
      if (hasSeries) html += `<div class="bible">Each child gets a light <b>Series Bible</b> — so the same character comes back looking like itself, episode after episode. A season per kid.</div>`;
    });
    if (examples.length) {
      html += `<div class="rlab" style="margin-top:26px">Examples — try the engine on these<span class="bar"></span></div>
        <div class="shelf">${examples.map((f) => card(f, true)).join('')}</div>`;
    }
    body.innerHTML = html;

    // render the movie windows + wire actions
    [...kept, ...examples].forEach((f) => {
      const svg = body.querySelector('#win-' + f.id);
      if (svg) svg.innerHTML = Movie.sceneSVG(f, 308, 174, { spark: false, motion: false });
    });
    body.querySelectorAll('[data-watch]').forEach((n) => n.onclick = () => F.go('/watch/' + n.dataset.watch));
    body.querySelectorAll('[data-ask]').forEach((n) => n.onclick = () => F.go('/'));
    body.querySelectorAll('[data-send]').forEach((n) => n.onclick = () => F.go('/watch/' + n.dataset.send));
  }

  function card(f, example) {
    const seedChar = (f.id.charCodeAt(f.id.length - 1) % 20);
    const tag = example
      ? `<span class="series pencil">example</span>`
      : (f.series ? `<span class="series">episode ${f.series.episode}</span>` : '');
    const meta = `${(f.meta && f.meta.seconds) || f.settings.seconds}s${f.meta && f.meta.day ? ' · ' + f.meta.day : ''}`;
    const fid = f.ledger && typeof f.ledger.avgFidelity === 'number' ? f.ledger.avgFidelity.toFixed(2) : '—';
    const acts = example ? `<span data-ask="${f.id}">ask your own →</span>`
      : `<span data-watch="${f.id}">re-watch</span> · <span data-send="${f.id}">send</span> · <span data-watch="${f.id}">go deeper</span>`;
    return `<div class="card2">
      <div class="tp"><svg width="120" height="40" style="overflow:visible">${K.tape(0,0,110,32,-8,seedChar)}</svg></div>
      <div class="win" data-watch="${f.id}"><svg id="win-${f.id}" viewBox="0 0 308 174" preserveAspectRatio="xMidYMid slice"></svg></div>
      <div style="display:flex;align-items:center;gap:8px;margin-top:10px">${tag}<div class="t">${f.story ? f.story.title : f.id}</div></div>
      <div class="m">${meta} <span class="golddot" style="width:6px;height:6px"></span> fidelity ${fid}</div>
      <div class="acts">${acts}</div>
    </div>`;
  }
})(window);
