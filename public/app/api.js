/* Flick — the client API. Relative URLs ONLY (same origin as the server); no
   hardcoded host or port ever reaches the browser. */
(function (root) {
  'use strict';
  async function j(url, opts) {
    const res = await fetch(url, opts);
    if (!res.ok) { let e; try { e = (await res.json()).error; } catch {} throw new Error(e || `HTTP ${res.status}`); }
    return res.json();
  }
  const API = {
    config: () => j('/api/config'),
    listFlicks: () => j('/api/flicks'),
    getFlick: (id) => j('/api/flicks/' + encodeURIComponent(id)),
    createFlick: (body) => j('/api/flicks', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify(body) }),
    redraw: (id, shot) => j('/api/flicks/' + encodeURIComponent(id) + '/redraw', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ shot }) }),
    // SSE progress. onEvent(evt); returns the EventSource so callers can close it.
    stream(id, onEvent) {
      const es = new EventSource('/api/flicks/' + encodeURIComponent(id) + '/stream');
      es.onmessage = (m) => { try { onEvent(JSON.parse(m.data)); } catch {} };
      es.onerror = () => { /* server closes the stream on complete; that's fine */ };
      return es;
    },
  };
  root.API = API;
  (root.Flick = root.Flick || {}).API = API;
})(window);
