/* Flick — 06 · The Booth. Direct the show: genuine control AND the whole pipeline
   made legible (nothing hidden behind magic). Settings persist and steer the next
   flick; the tool surface is the real MCP/Skill loop; the ledger is live. */
(function (root) {
  'use strict';
  const F = root.Flick, Movie = root.Movie, C = root.Crayon.C;
  F.Screens = F.Screens || {};
  F.Screens.booth = { render };

  const TOOLS = ['read_drawing', 'write_story', 'storyboard', 'paint_set', 'roll_camera', 'check_fidelity', 'voice_line', 'cut_episode'];

  async function render(view) {
    const st = F.settings;
    const el = document.createElement('div');
    el.className = 'screen scr-booth';
    el.innerHTML = `
      <div class="main">
        <div class="left">
          <div class="h2">The Booth — direct the show</div>
          <div class="lead" style="font-size:17px;color:var(--ink-55);margin:2px 0 14px">Genuine control — and the whole pipeline, <b class="em">nothing hidden behind magic.</b></div>

          <div class="ctl">
            <div class="top"><div class="lbl">The story</div><div class="sub" style="margin:0">give the projectionist a mood</div></div>
            ${segment('mood', ['a bedtime story', 'an adventure', 'a bit silly', 'gentle'], st.mood)}
          </div>
          <div class="grid2">
            <div class="ctl">
              <div class="top"><div class="lbl">Length</div><div class="val" id="lenVal">${st.seconds}s · ${st.shots} shots</div></div>
              ${slider('len', pct(st.seconds, 20, 60))}
              <div class="sub">shorter keeps it snappy · longer = a bigger story</div>
            </div>
            <div class="ctl">
              <div class="top"><div class="lbl">Video-second budget</div><div class="val" id="budVal">${Math.min(st.seconds, 50)} / ${(F.config&&F.config.wanFreeSeconds)||50}s free</div></div>
              ${slider('bud', pct(Math.min(st.seconds,50), 10, 50))}
              <div class="sub" id="budSub">only the shot that drifts is re-filmed</div>
            </div>
            <div class="ctl">
              <div class="top"><div class="lbl">Fidelity threshold</div><div class="val" id="thrVal">${st.threshold.toFixed(2)}</div></div>
              ${slider('thr', pct(st.threshold, 0.5, 0.95))}
              <div class="sub">below this, draw the shot again</div>
            </div>
            <div class="ctl">
              <div class="top"><div class="lbl">If a shot won't hold</div></div>
              ${segment('drift', [['keep it looser','looser'],['try again','again']], st.onDrift)}
              <div class="sub">never a silent fake — you choose, honestly</div>
            </div>
          </div>
          <div class="grid2">
            <div class="ctl">
              <div class="top"><div class="lbl">Narration voice</div></div>
              ${segment('voice', [['storybook','storybook'],['your voice','clone'],['off','off']], st.voice)}
              <div class="sub">clone a grandparent's voice — a 15s clip (qwen-voice-enrollment)</div>
            </div>
            <div class="ctl">
              <div class="top"><div class="lbl">Shape</div></div>
              ${segment('aspect', ['16:9','9:16','1:1'], st.aspect)}
              <div class="sub">9:16 for phones · 16:9 for the big screen</div>
            </div>
          </div>
          <div class="ctl">
            <div class="top"><div class="lbl">Re-draw one shot</div><div class="val">targeted · ~3s only</div></div>
            <div class="shotchips" id="chips"><div class="sub" style="margin:0">make a flick first, then re-draw any shot here.</div></div>
          </div>
        </div>
        <div class="right">
          <div class="rlab">The tool surface · custom Skill + MCP</div>
          <div class="tools">${TOOLS.map((t,i)=>`<span class="fn">${t}</span>${i<TOOLS.length-1?'<span class="arrow"> → </span>':''}`).join('')}
            <div style="margin-top:8px"><span class="ok">// each a real ${F.config&&F.config.engineLive?'Qwen Cloud call':'call · offline until a key is added'} · mountable over SSE</span></div></div>
          <div style="font-family:var(--hand);font-size:16px;color:var(--gold-ink);margin:10px 2px 0">MCP → make one by texting a photo of the fridge to a bot.</div>
          <div class="rlab" style="margin-top:22px">The ledger · latest episode</div>
          <div class="stats" id="ledger" style="flex-wrap:wrap;gap:11px"><div class="sub">no flick yet.</div></div>
        </div>
      </div>`;
    view.appendChild(el);

    wireSegments(el);
    wireSliders(el);
    await loadLedgerAndChips(el);
  }

  // ── segments ──
  function segment(name, opts, val) {
    const items = opts.map((o) => Array.isArray(o) ? o : [o, o]);
    return `<div class="segment" data-seg="${name}">${items.map(([lbl, v]) => `<div class="opt ${v===val?'on':''}" data-v="${v}">${lbl}</div>`).join('')}</div>`;
  }
  function wireSegments(el) {
    el.querySelectorAll('[data-seg]').forEach((seg) => {
      const name = seg.dataset.seg;
      seg.querySelectorAll('.opt').forEach((opt) => opt.onclick = () => {
        seg.querySelectorAll('.opt').forEach((o) => o.classList.remove('on')); opt.classList.add('on');
        const v = opt.dataset.v;
        if (name === 'mood') F.settings.mood = v;
        else if (name === 'drift') F.settings.onDrift = v;
        else if (name === 'voice') F.settings.voice = v;
        else if (name === 'aspect') F.settings.aspect = v;
        F.saveSettings();
      });
    });
  }

  // ── sliders ──
  function slider(name, p) { return `<div class="sl" data-sl="${name}"><div class="fl" style="width:${p}%"></div><div class="kn" style="left:${p}%"></div></div>`; }
  function pct(v, lo, hi) { return Math.round(((v - lo) / (hi - lo)) * 100); }
  function fromPct(p, lo, hi) { return lo + (p / 100) * (hi - lo); }
  function wireSliders(el) {
    el.querySelectorAll('[data-sl]').forEach((sl) => {
      const name = sl.dataset.sl;
      const set = (clientX) => {
        const rect = sl.getBoundingClientRect();
        let p = Math.max(0, Math.min(100, ((clientX - rect.left) / rect.width) * 100));
        sl.querySelector('.fl').style.width = p + '%'; sl.querySelector('.kn').style.left = p + '%';
        apply(el, name, p);
      };
      let dragging = false;
      sl.addEventListener('pointerdown', (e) => { dragging = true; sl.setPointerCapture(e.pointerId); set(e.clientX); });
      sl.addEventListener('pointermove', (e) => { if (dragging) set(e.clientX); });
      sl.addEventListener('pointerup', () => { dragging = false; F.saveSettings(); });
    });
  }
  function apply(el, name, p) {
    const st = F.settings;
    if (name === 'len') { st.seconds = Math.round(fromPct(p, 20, 60)); st.shots = Math.max(3, Math.min(6, Math.round(st.seconds / 10))); el.querySelector('#lenVal').textContent = `${st.seconds}s · ${st.shots} shots`; }
    else if (name === 'bud') { const b = Math.round(fromPct(p, 10, 50)); const free = (F.config && F.config.wanFreeSeconds) || 50; el.querySelector('#budVal').textContent = `${b} / ${free}s free`; const saved = Math.max(0, Math.round((1 - 1 / st.shots) * 100)); el.querySelector('#budSub').textContent = `~${saved}% saved vs re-filming the whole episode`; }
    else if (name === 'thr') { st.threshold = Math.round(fromPct(p, 0.5, 0.95) * 100) / 100; el.querySelector('#thrVal').textContent = st.threshold.toFixed(2); }
  }

  // ── ledger + re-draw chips (from the latest flick) ──
  async function loadLedgerAndChips(el) {
    let flick = null;
    try {
      if (F.currentRun) flick = await F.API.getFlick(F.currentRun);
      if (!flick || flick.status !== 'ready') { const { kept } = await F.API.listFlicks(); flick = kept.find((f) => f.status === 'ready') || kept[0]; }
    } catch {}
    if (!flick) return;
    const l = flick.ledger || {};
    el.querySelector('#ledger').innerHTML = `
      <div class="stat gold"><div class="n">${l.avgFidelity?l.avgFidelity.toFixed(2):'—'}</div><div class="k">avg fidelity</div></div>
      <div class="stat"><div class="n">${l.redrawn||0}<span class="u">/${l.shotsTotal||(flick.shots||[]).length}</span></div><div class="k">re-drawn</div></div>
      <div class="stat"><div class="n">${l.wanSecondsUsed||0}<span class="u">s</span></div><div class="k">wan used</div></div>
      <div class="stat"><div class="n">${l.endToEndMs?fmtDur(l.endToEndMs):'—'}</div><div class="k">end-to-end</div></div>`;

    const chips = el.querySelector('#chips');
    const shots = flick.shots || [];
    if (shots.length) {
      chips.innerHTML = shots.map((s, i) => `<div class="sc ${i===1?'sel':''}" data-shot="${s.shot_no}"><svg viewBox="0 0 74 46" preserveAspectRatio="xMidYMid slice"></svg></div>`).join('');
      chips.querySelectorAll('.sc').forEach((c) => { c.querySelector('svg').innerHTML = Movie.sceneSVG(flick, 74, 46, { spark: false, motion: false, cloudN: 0 });
        c.onclick = async () => {
          chips.querySelectorAll('.sc').forEach((x) => x.classList.remove('sel')); c.classList.add('sel');
          F.toast('re-drawing shot ' + c.dataset.shot + '…');
          try { const r = await F.API.redraw(flick.id, +c.dataset.shot); flick.ledger = r.ledger; el.querySelector('#ledger').querySelector('.stat.gold .n').textContent = r.ledger.avgFidelity ? r.ledger.avgFidelity.toFixed(2) : '—'; F.toast('shot ' + c.dataset.shot + ' re-drawn → ' + (r.shot.fidelity||0).toFixed(2)); }
          catch (e) { F.toast('re-draw failed: ' + e.message); }
        };
      });
    }
  }
  function fmtDur(ms) { const s = Math.round(ms / 1000); return Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'); }
})(window);
