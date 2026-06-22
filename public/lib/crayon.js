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
    const nLines=Math.ceil((diag*2)/gap);
    let pts=[];
    for(let i=0;i<=nLines;i++){
      const off=-diag + i*gap + jit(r,gap*0.22);
      const len=diag + jit(r,overshoot);
      const ox=-sa*off, oy=ca*off;
      let a=[cx+ox-ca*len, cy+oy-sa*len], b=[cx+ox+ca*len, cy+oy+sa*len];
      a=[a[0]+jit(r,2.6),a[1]+jit(r,2.6)]; b=[b[0]+jit(r,2.6),b[1]+jit(r,2.6)];
      if(i%2===0) pts.push(a,b); else pts.push(b,a);
    }
    let d=`M ${f1(pts[0][0])} ${f1(pts[0][1])}`;
    for(let i=1;i<pts.length;i++) d+=` L ${f1(pts[i][0])} ${f1(pts[i][1])}`;
    return d;
  }

  /* VISIBLE crayon scribble fill inside clipId — a child colouring back and forth, DENSE.
     Fat overlapping strokes in ONE direction (gap<w), ~90% coverage, tooth peeking through. */
  function scribble(clipId, bbox, {color=C.gold, seed=2, angle=20, gap=6.5, w=12, op=.94, overshoot=12}={}){
    const r=rng(seed);
    const d1=serpentine(bbox,r,{angle,gap,overshoot});
    const d2=serpentine(bbox,r,{angle:angle+jit(r,4), gap, overshoot}); // second pass fills valleys
    return `<g clip-path="url(#${clipId})"><g filter="url(#wax)">
      <path d="${d1}" fill="none" stroke="${color}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round" opacity="${op}"/>
      <path d="${d2}" fill="none" stroke="${color}" stroke-width="${f1(w*0.9)}" stroke-linecap="round" stroke-linejoin="round" opacity="${op*0.7}"/>
    </g></g>`;
  }

  /* SOLID crayon fill — the default for cartoon shapes. A filled waxy area with directional
     streaks (uneven pressure), a lighter catch and a darker press, and the paper tooth showing. */
  function crayonFill(clipId, bbox, {color=C.gold, seed=2, angle=18, streaks=true}={}){
    const r=rng(seed); const [bx,by,bw,bh]=bbox;
    const X=bx-6,Y=by-6,W=bw+12,H=bh+12;
    let str='';
    if(streaks){
      const rad=angle*Math.PI/180, ca=Math.cos(rad), sa=Math.sin(rad);
      const cx=bx+bw/2, cy=by+bh/2, diag=Math.hypot(bw,bh)/2+8;
      const n=Math.round(diag*2/12);
      for(let i=0;i<n;i++){
        const off=-diag+i*12+jit(r,4), ox=-sa*off, oy=ca*off, len=diag+jit(r,8);
        const dark=r()>.5;
        const col = dark? C.ink : '#ffffff';
        const opv = dark? (0.05+r()*0.06) : (0.06+r()*0.08);
        str+=`<path d="M ${f1(cx+ox-ca*len)} ${f1(cy+oy-sa*len)} L ${f1(cx+ox+ca*len)} ${f1(cy+oy+sa*len)}"
          fill="none" stroke="${col}" stroke-width="${f1(7+r()*7)}" stroke-linecap="round" opacity="${f1(opv)}"/>`;
      }
    }
    return `<g clip-path="url(#${clipId})">
      <rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="${color}"/>
      <g filter="url(#wax)">${str}</g>
      <rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="${color}" filter="url(#speck)" opacity=".7"/>
      <rect x="${X}" y="${Y}" width="${W}" height="${H}" fill="${color}" filter="url(#speck-hi)" opacity=".35"/>
    </g>`;
  }

  /* a big waxy area for skies/grounds: solid colour + broad wavy streaks + tooth */
  function waxArea(clipId, bbox, {color=C.cSky, streak=C.cSkyLo, seed=3}={}){
    const r=rng(seed); const [bx,by,bw,bh]=bbox; let s='';
    const n=Math.round(bh/24)+3;
    for(let i=0;i<n;i++){
      const y=by+(i/n)*bh+jit(r,6), op=0.10+r()*0.16;
      s+=`<path d="M ${bx-12} ${f1(y)} Q ${bx+bw/2} ${f1(y+jit(r,12))} ${bx+bw+12} ${f1(y+jit(r,7))}"
        fill="none" stroke="${streak}" stroke-width="${f1(9+r()*9)}" stroke-linecap="round" opacity="${f1(op)}"/>`;
    }
    return `<g clip-path="url(#${clipId})">
      <rect x="${bx-6}" y="${by-6}" width="${bw+12}" height="${bh+12}" fill="${color}"/>
      <g filter="url(#wax)">${s}</g>
      <rect x="${bx-6}" y="${by-6}" width="${bw+12}" height="${bh+12}" fill="${color}" filter="url(#speck)" opacity=".55"/>
    </g>`;
  }

  /* ============================ scrapbook atoms ============================ */

  /* a strip of translucent washi/masking tape, angle in deg, over a card corner. */
  function tape(x,y,w=92,h=32,angle=-16,seed=5){
    const r=rng(seed);
    // torn-ish ends (slight zigzag), semi-opaque warm cream so the paper below shows through
    const zig=(sign)=>{ let d=`M ${sign>0?w:0} 0`; const steps=4; for(let i=1;i<=steps;i++){ d+=` L ${f1((sign>0?w:0)+sign*jit(r,2.4))} ${f1(h*i/steps)}`;} return d; };
    return `<g transform="translate(${x},${y}) rotate(${angle})">
      <rect x="1" y="2" width="${w}" height="${h}" rx="1.5" fill="${C.ink}" opacity=".10"/>
      <rect x="0" y="0" width="${w}" height="${h}" rx="1.5" fill="${C.gold}" opacity=".34"/>
      <rect x="0" y="0" width="${w}" height="${h}" rx="1.5" fill="${C.goldSoft}" opacity=".5"/>
      <rect x="0" y="0" width="${w}" height="${h}" fill="${C.gold}" filter="url(#speck)" opacity=".4"/>
      <line x1="6" y1="6" x2="${w-6}" y2="6" stroke="#fff" stroke-width="2.4" opacity=".4"/>
      <line x1="8" y1="${h-6}" x2="${w-10}" y2="${h-6}" stroke="${C.goldCore}" stroke-width="1.6" opacity=".28"/>
    </g>`;
  }

  /* a slightly lopsided gold star sticker (the i-dot / the "kept" mark) */
  function star(cx,cy,rad=16,{seed=7,fill=C.gold,edge=C.goldCore,glow=false}={}){
    const r=rng(seed), pts=[];
    for(let i=0;i<10;i++){
      const a=-Math.PI/2 + i*Math.PI/5;
      const rr=(i%2===0?rad:rad*0.44)*(1+jit(r,0.06));
      pts.push([cx+Math.cos(a)*rr, cy+Math.sin(a)*rr + jit(r,0.6)]);
    }
    let d=`M ${f1(pts[0][0])} ${f1(pts[0][1])}`;
    for(let i=1;i<pts.length;i++) d+=` L ${f1(pts[i][0])} ${f1(pts[i][1])}`;
    d+=' Z';
    const g = glow ? `<circle cx="${cx}" cy="${cy}" r="${rad*1.7}" fill="url(#gGlow)"/>`:'';
    return `<g>${g}<g filter="url(#wax-fine)">
      <path d="${d}" fill="${fill}"/>
      <path d="${d}" fill="none" stroke="${edge}" stroke-width="2.4" stroke-linejoin="round"/>
      <path d="M ${cx-rad*0.3} ${cy-rad*0.28} q ${rad*0.2} ${-rad*0.16} ${rad*0.42} ${-rad*0.02}"
        fill="none" stroke="${C.goldHi}" stroke-width="2.2" stroke-linecap="round" opacity=".85"/>
    </g></g>`;
  }

  /* a pushpin / thumbtack holding a drawing to the fridge */
  function pushpin(cx,cy,{color=C.gold,seed=8}={}){
    return `<g filter="url(#wax-fine)">
      <ellipse cx="${cx+1}" cy="${cy+2}" rx="10" ry="9" fill="${C.ink}" opacity=".16"/>
      <circle cx="${cx}" cy="${cy}" r="9" fill="${color}"/>
      <circle cx="${cx}" cy="${cy}" r="9" fill="none" stroke="${C.goldCore}" stroke-width="2"/>
      <circle cx="${cx-3}" cy="${cy-3}" r="2.6" fill="${C.goldHi}"/>
    </g>`;
  }

  /* a wobbly hand-drawn divider rule */
  function rule(x1,y,x2,{color=C.ink26,seed=9,w=3}={}){
    const r=rng(seed), n=Math.max(6,Math.round((x2-x1)/40)), pts=[];
    for(let i=0;i<=n;i++) pts.push([x1+(x2-x1)*i/n, y+jit(r,2.2)]);
    return stroke(wobblePath(pts,r,0.6),{color,w,seed,passes:1,op:.8});
  }

  /* ============================ backgrounds ============================ */

  /* the calm cream sugar-paper surface: base + mottle + speckle + soft vignette + torn deckle */
  function sugarPaper(w,h,{seed=42,tone=C.paper,deckle=false}={}){
    const r=rng(seed); let flecks='';
    for(let i=0;i<Math.round(w*h/5200);i++){
      flecks+=`<circle cx="${f1(r()*w)}" cy="${f1(r()*h)}" r="${f1(0.5+r()*1.1)}"
        fill="${r()>.5?C.paper2:C.deckle}" opacity="${f1(0.10+r()*0.16)}"/>`;
    }
    let mottle='';
    for(let i=0;i<14;i++){
      mottle+=`<ellipse cx="${f1(r()*w)}" cy="${f1(r()*h)}" rx="${f1(70+r()*180)}" ry="${f1(50+r()*120)}"
        fill="${C.paper2}" opacity="${f1(0.05+r()*0.06)}"/>`;
    }
    const rim = deckle ? `<rect x="3" y="3" width="${w-6}" height="${h-6}" rx="10" fill="none"
        stroke="${C.deckle}" stroke-width="3" opacity=".5" filter="url(#wax-loose)"/>`:'';
    return `<svg width="${w}" height="${h}" viewBox="0 0 ${w} ${h}" xmlns="http://www.w3.org/2000/svg">
      <rect width="${w}" height="${h}" fill="${tone}"/>
      <g style="mix-blend-mode:multiply">${mottle}</g>
      ${flecks}
      <rect width="${w}" height="${h}" fill="url(#vign)"/>
      ${rim}
    </svg>`;
  }

  root.Crayon = {
    C, rng, defs, stroke, line, blobD, serpentine, scribble, crayonFill, waxArea,
    tape, star, pushpin, rule, sugarPaper, f1, jit, wobblePath
  };
})(window);
