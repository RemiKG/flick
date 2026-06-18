/* Flick crayon library — hand-authored SVG, every mark placed by code.
   The anti-AI trick is threefold and mechanical:
     1) wax strokes wobble (feTurbulence + feDisplacementMap) so no line is vector-perfect,
     2) areas are filled with VISIBLE back-and-forth scribble that colours past the lines
        (a child crayoning, not a flat vector fill),
     3) the construction-paper TOOTH shows through every fill (multiply-noise).
   Everything is seed-locked (deterministic RNG) so it reproduces exactly. NOT a diffusion model. */
(function (root) {
  'use strict';

  const C = {
    paper:'#F6EFE0', paperHi:'#FCF8EE', paperLo:'#EEE5D1', paper2:'#E6DAC0', deckle:'#DBCDA9',
    ink:'#2C2620', ink72:'#4E463B', ink55:'#6D6455', ink40:'#928878', ink26:'#B8AE99',
    gold:'#E7A331', goldHi:'#F7C965', goldCore:'#C67F1B', goldInk:'#97610F', goldSoft:'#F2DFAC',
    pencil:'#9C9585', pencilHi:'#B6B0A1', pencilLo:'#726B5D',
    cSky:'#7FB6DA', cSkyLo:'#5E97BE', cGrass:'#7CA843', cGrassLo:'#5C8730',
    cSun:'#F4C43C', cSunHi:'#FBDD7C', cDragon:'#6FA85C', cDragon2:'#4C8A44',
    cFlame:'#EF8B39', cFlameHi:'#F7B267', cPlum:'#8C6BB1', cBerry:'#CE7090',
    cCocoa:'#9A6A40', cCloud:'#FBF4E6', cNight:'#3B4A6B'
  };

  /* deterministic RNG (xorshift) so every asset is reproducible / seed-locked */
  function rng(seed){ let s=(seed>>>0)||1; return ()=>{ s^=s<<13; s^=s>>>17; s^=s<<5; s>>>=0; return s/4294967296; }; }
  const f1 = n => (Math.round(n*10)/10);
  const jit = (r,a)=> (r()*2-1)*a;

  /* ---- shared <defs>: crayon filters, tooth textures, glow. Injected once per page. ---- */
  function defs(){
    return `<svg class="crayon-defs" width="0" height="0" style="position:absolute" aria-hidden="true"><defs>
      <!-- the crayon wobble for outlines/strokes: geometry jitter, soft -->
      <filter id="wax" x="-14%" y="-14%" width="128%" height="128%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.018 0.024" numOctaves="2" seed="4" result="w"/>
        <feDisplacementMap in="SourceGraphic" in2="w" scale="2.6" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="wax-fine" x="-10%" y="-10%" width="120%" height="120%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.03 0.04" numOctaves="2" seed="9" result="w"/>
        <feDisplacementMap in="SourceGraphic" in2="w" scale="1.5" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <filter id="wax-loose" x="-20%" y="-20%" width="140%" height="140%" color-interpolation-filters="sRGB">
        <feTurbulence type="fractalNoise" baseFrequency="0.012 0.02" numOctaves="2" seed="15" result="w"/>
        <feDisplacementMap in="SourceGraphic" in2="w" scale="4.6" xChannelSelector="R" yChannelSelector="G"/>
      </filter>
      <!-- paper TOOTH: fractal noise knocked into the fill as faint darker speckle (multiply) -->
      <filter id="tooth" x="-2%" y="-2%" width="104%" height="104%">
        <feTurbulence type="fractalNoise" baseFrequency="0.75 0.9" numOctaves="2" stitchTiles="stitch" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.16  0 0 0 0 0.13  0 0 0 0 0.09  0 0 0 0.5 0" result="c"/>
        <feComposite operator="in" in="c" in2="SourceGraphic" result="grain"/>
        <feMerge><feMergeNode in="SourceGraphic"/><feMergeNode in="grain"/></feMerge>
      </filter>
      <!-- SPECK: outputs ONLY dark tooth-speckle, shaped by the source alpha (overlay on a fill). -->
      <filter id="speck" x="-2%" y="-2%" width="104%" height="104%">
        <feTurbulence type="fractalNoise" baseFrequency="0.7 0.85" numOctaves="2" stitchTiles="stitch" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 0.14  0 0 0 0 0.11  0 0 0 0 0.07  0 0 0 0.85 0" result="c"/>
        <feComposite operator="in" in="c" in2="SourceGraphic"/>
      </filter>
      <!-- SPECK-LIGHT: waxy lighter tooth-shimmer (the crayon highlight catching the paper). -->
      <filter id="speck-hi" x="-2%" y="-2%" width="104%" height="104%">
        <feTurbulence type="fractalNoise" baseFrequency="0.6 0.8" numOctaves="2" stitchTiles="stitch" result="n"/>
        <feColorMatrix in="n" type="matrix" values="0 0 0 0 1  0 0 0 0 1  0 0 0 0 0.96  0 0 0 0.5 0" result="c"/>
        <feComposite operator="in" in="c" in2="SourceGraphic"/>
      </filter>
      <!-- a soft gold glow (the ONE allowed gradient family — it is light, the "alive" spark) -->
      <filter id="glow" x="-90%" y="-90%" width="280%" height="280%">
        <feGaussianBlur stdDeviation="6" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <filter id="glow-lg" x="-150%" y="-150%" width="400%" height="400%">
        <feGaussianBlur stdDeviation="15" result="b"/><feMerge><feMergeNode in="b"/><feMergeNode in="SourceGraphic"/></feMerge>
      </filter>
      <radialGradient id="gGlow" cx="50%" cy="50%" r="50%">
        <stop offset="0%" stop-color="${C.goldHi}" stop-opacity=".95"/>
        <stop offset="34%" stop-color="${C.gold}" stop-opacity=".55"/>
        <stop offset="100%" stop-color="${C.gold}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="gGlowSoft" cx="50%" cy="46%" r="56%">
        <stop offset="0%" stop-color="${C.goldHi}" stop-opacity=".42"/>
        <stop offset="55%" stop-color="${C.gold}" stop-opacity=".15"/>
        <stop offset="100%" stop-color="${C.gold}" stop-opacity="0"/>
      </radialGradient>
      <radialGradient id="vign" cx="50%" cy="44%" r="72%">
        <stop offset="60%" stop-color="#000" stop-opacity="0"/>
        <stop offset="100%" stop-color="#2a2114" stop-opacity=".14"/>
      </radialGradient>
    </defs></svg>`;
  }

  /* ============================ low-level marks ============================ */

  /* a wobbly hand path through points, as a smooth-ish polyline with jitter baked in */
  function wobblePath(pts, r, amp=1.2){
    let d = `M ${f1(pts[0][0]+jit(r,amp))} ${f1(pts[0][1]+jit(r,amp))}`;
    for(let i=1;i<pts.length;i++){
      const [x,y]=pts[i];
      d += ` L ${f1(x+jit(r,amp))} ${f1(y+jit(r,amp))}`;
    }
    return d;
  }

  /* a single crayon stroke along a path string. Draws 2–3 slightly offset passes for
     the over-pressed, waxy, doubled-edge look. filter=wax gives the wobble. */
  function stroke(d, {color=C.ink, w=6, seed=1, passes=2, op=1, cap='round', filter='wax'}={}){
    const r = rng(seed);
    let out = `<g filter="url(#${filter})">`;
    for(let i=0;i<passes;i++){
      const dx=jit(r,1.1), dy=jit(r,1.1), ww=w*(i===0?1:0.72+r()*0.3);
      out += `<path d="${d}" fill="none" stroke="${color}" stroke-width="${f1(ww)}"
        stroke-linecap="${cap}" stroke-linejoin="round" opacity="${op*(i===0?1:0.5+r()*0.3)}"
        transform="translate(${f1(dx)},${f1(dy)})"/>`;
    }
    return out+`</g>`;
  }
  function line(x1,y1,x2,y2,o={}){ return stroke(`M ${x1} ${y1} L ${x2} ${y2}`, o); }

  /* a wobbly closed blob outline (hand-drawn circle/oval). returns path d. */
  function blobD(cx,cy,rx,ry,r,wobble=0.10,n=18){
    let d=''; for(let i=0;i<=n;i++){
      const a=(i/n)*Math.PI*2, rr=1+jit(r,wobble);
      const x=cx+Math.cos(a)*rx*rr, y=cy+Math.sin(a)*ry*rr;
      d += (i===0?`M ${f1(x)} ${f1(y)}`:` L ${f1(x)} ${f1(y)}`);
    } return d+' Z';
  }

  /* build a dense serpentine crayon-sweep path across bbox at `angle`. gap<w => strokes overlap. */
  function serpentine(bbox, r, {angle=20, gap=7, overshoot=12}={}){
    const [bx,by,bw,bh]=bbox, cx=bx+bw/2, cy=by+bh/2;
    const diag=Math.hypot(bw,bh)/2 + overshoot;
    const rad=angle*Math.PI/180, ca=Math.cos(rad), sa=Math.sin(rad);
