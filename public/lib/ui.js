/* Flick UI helpers — the calm cream chrome + reusable movie/still scenes shared by screens.
   Keeps every screen consistent and lean. Depends on crayon.js + scene.js. */
(function (root) {
  'use strict';
  const K = root.Crayon, S = root.Scene, C = K.C, f1=K.f1;

  /* the top bar: wordmark + tabs + the honest little readout */
  function topbar(active){
    const tabs=[['Fridge','fridge'],['Backstage','backstage'],['Toy box','toybox'],['Booth','booth']];
    const t = tabs.map(([lbl,id])=>`<div class="tab ${id===active?'on':''}">${lbl}</div>`).join('');
    return `<div class="topbar">
      <div class="brand">${S.flickMark({size:34})}</div>
      <div class="tabs">${t}</div>
      <div class="spacer"></div>
      <div class="readout">
        <span><b>free</b> · wan <b>42s</b> left</span><span class="sep"></span>
        <span>engine <b>qwen · wan2.7-r2v</b></span><span class="sep"></span>
        <span class="golddot" style="margin-right:6px"></span><span><b>on Alibaba Cloud</b></span>
      </div>
    </div>`;
  }

  /* the ALIVE movie scene (the child's world, moving). Returns inner SVG for a <svg wxh>.
     Animatable parts are wrapped in classed groups (.mv-char/.mv-cloud/.mv-stars/.mv-spark)
     so movie.js can bring the window to life with CSS — adding the classes does NOT change
     the static render (mockup-faithful). char='photo' + photoHref animates a stranger's OWN
     uploaded drawing over the crayon set (the honest offline "it's still theirs"). */
  function movieScene(w,h,{night=false,seed=21,dx=null,dy=null,ds=null,spark=true,motion=true,cloudN=2,char='dragon',charColor=null,photoHref=null}={}){
    const skyH=Math.round(h*0.68), sky=Scene.uid('sky'), grd=Scene.uid('grd');
    dx = dx==null? w*0.42 : dx; dy = dy==null? h*0.54 : dy; ds = ds==null? h*0.86 : ds;
    let b=[`<defs><clipPath id="${sky}"><rect x="0" y="0" width="${w}" height="${skyH}"/></clipPath>
      <clipPath id="${grd}"><rect x="0" y="${skyH}" width="${w}" height="${h-skyH}"/></clipPath></defs>`];
    if(night){
      b.push(K.waxArea(sky,[0,0,w,skyH],{color:C.cNight,streak:'#2f3c5c',seed:31}));
      b.push(`<g class="mv-stars">${S.starsField(w,skyH,Math.round(w/40),{seed:5})}</g>`);
      b.push(S.moon(w*0.86,h*0.16,h*0.06,{seed:13}));
    } else {
      b.push(K.waxArea(sky,[0,0,w,skyH],{color:C.cSky,streak:C.cSkyLo,seed:31}));
      b.push(`<g class="mv-sun">${S.sunFace(w*0.85,h*0.18,h*0.058,{seed:7})}</g>`);
      for(let i=0;i<cloudN;i++) b.push(`<g class="mv-cloud" style="--ci:${i}">${S.cloud(w*(0.16+i*0.28),h*(0.16+i*0.05),h*0.06,{seed:5+i})}</g>`);
    }
    b.push(S.hill(w,skyH+h*0.04,h*0.22,{seed:9,color:night?C.cGrassLo:C.cGrass}));
    b.push(K.waxArea(grd,[0,skyH+2,w,h-skyH],{color:night?C.cGrassLo:C.cGrass,streak:night?'#4a6f26':C.cGrassLo,seed:33}));
    b.push(S.grassBlades(skyH+h*0.06,w,{seed:11,n:Math.round(w/12)}));
    if(motion){ b.push(K.stroke(`M ${f1(dx-ds*0.5)} ${f1(dy)} q ${f1(ds*0.2)} ${-ds*0.05} ${f1(ds*0.4)} ${-ds*0.02}`,{color:'#ffffff',w:h*0.02,seed:44,passes:1,op:.45}));
      b.push(K.stroke(`M ${f1(dx-ds*0.52)} ${f1(dy+ds*0.09)} q ${f1(ds*0.24)} ${-ds*0.02} ${f1(ds*0.44)} 0`,{color:'#ffffff',w:h*0.015,seed:45,passes:1,op:.35})); }
    let charSvg;
    if(char==='photo' && photoHref){
      const pw=ds*0.92, ph=ds*0.86;
      charSvg=`<image href="${photoHref}" x="${f1(dx-pw/2)}" y="${f1(dy-ph/2)}" width="${f1(pw)}" height="${f1(ph)}" preserveAspectRatio="xMidYMid meet"/>`;
    }
    else if(char==='robot') charSvg=S.robot(dx,dy,ds*0.92,{seed,color:charColor||C.cPlum});
    else if(char==='cat') charSvg=S.critter(dx,dy,ds*0.96,{seed,color:charColor||C.cSun});
    else charSvg=S.dragon(dx,dy,ds,{seed});
    b.push(`<g class="mv-char" style="transform-box:fill-box;transform-origin:50% 70%">${charSvg}</g>`);
    if(spark) b.push(`<g class="mv-spark">${K.star(dx-ds*0.36,dy-ds*0.34,h*0.03,{seed:3,glow:true})}</g>`);
    return b.join('');
  }

  /* the STILL drawing (as photographed on the fridge). Inner SVG for a <svg wxh>. */
  function stillScene(w,h,{seed=21,label='my dragon :)'}={}){
    let b=[`<rect x="0" y="0" width="${w}" height="${h}" fill="${C.cCloud}"/>`];
    b.push(S.dragon(w*0.48,h*0.5,h*0.82,{seed}));
    if(label) b.push(`<text x="${f1(w*0.08)}" y="${f1(h*0.88)}" font-family="'Patrick Hand'" font-size="${f1(h*0.075)}" fill="${C.ink55}">${label}</text>`);
    return b.join('');
  }

  /* a player scrubber with hand-drawn beat markers. Returns HTML. */
  function player({beats=['pin','peel','it moves','the moon','home'], on=2, time='0:28 / 0:47'}={}){
    const dots = beats.map((bl,i)=>`<div style="display:flex;flex-direction:column;align-items:center;gap:3px">
      <span class="${i===on?'golddot':'pendot'}"></span>
      <span style="font-family:var(--mono);font-size:9.5px;color:${i===on?'var(--gold-ink)':'var(--ink-40)'}">${bl}</span></div>`).join('');
    const pct = Math.round((on/(beats.length-1))*100);
    return `<div style="display:flex;align-items:center;gap:16px">
      <div style="width:44px;height:44px;border-radius:50%;background:var(--gold);border:2px solid var(--gold-core);
        display:flex;align-items:center;justify-content:center;box-shadow:var(--glow-sm)">
        <svg width="18" height="18"><rect x="3" y="2" width="4" height="14" rx="1" fill="#3a2708"/><rect x="11" y="2" width="4" height="14" rx="1" fill="#3a2708"/></svg></div>
      <div style="flex:1">
        <div class="slider" style="height:8px"><div class="fill" style="width:${pct}%"></div>
          <div class="knob" style="left:${pct}%;width:18px;height:18px"></div></div>
        <div style="display:flex;justify-content:space-between;margin-top:9px">${dots}</div>
      </div>
      <div style="font-family:var(--mono);font-size:13px;color:var(--ink-55)">${time}</div>
    </div>`;
  }

  /* a small movie-window card (frame + optional caption). Returns HTML wrapping an <svg id=..>. */
  function windowCard(id,w,h,capLine){
    return `<div class="window" style="width:${w}px;height:${h}px">
      <svg id="${id}" width="${w}" height="${h}" viewBox="0 0 ${w} ${h}"></svg>
      ${capLine?`<div class="cap"><span class="line">${capLine}</span></div>`:''}
    </div>`;
  }

  root.UI = { topbar, movieScene, stillScene, player, windowCard };
})(window);
