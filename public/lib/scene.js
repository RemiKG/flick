/* Flick scene library — the brand marks, the mascot Scribbles, and the child's crayon world
   (the dragon, the sun-with-a-face, the hill). All built on crayon.js primitives; every mark
   placed by code, seed-locked. This is what fills the "movie window" and the cover. NOT AI. */
(function (root) {
  'use strict';
  const K = root.Crayon, C = K.C, f1 = K.f1, jit = K.jit;
  let _id = 0; const uid = p => `${p}${(_id++).toString(36)}`;

  /* fill a closed path `d` (with known bbox) as a solid crayon shape + wobbly outline */
  function fillShape(d, bbox, {color=C.gold, seed=1, angle=16, outline=C.ink, ow=5, streaks=true}={}){
    const id = uid('cl');
    return `<clipPath id="${id}"><path d="${d}"/></clipPath>
      ${K.crayonFill(id,bbox,{color,seed,angle,streaks})}
      ${ow>0?`<path d="${d}" fill="none" stroke="${outline}" stroke-width="${ow}" stroke-linejoin="round" stroke-linecap="round" filter="url(#wax)"/>`:''}`;
  }

  /* ======================= SEALS (little stamps for crew/shots) ======================= */
  function seal(kind, x, y, s=22){
    const g = (inner)=>`<g transform="translate(${x},${y})">${inner}</g>`;
    if(kind==='kept')    return g(`${K.star(0,0,s,{seed:3,glow:true})}`);
    if(kind==='rolling') return g(`<g filter="url(#wax-fine)">
        <circle r="${s}" fill="${C.ink}"/><circle r="${s}" fill="none" stroke="${C.goldHi}" stroke-width="2.5"/>
        <circle r="${s*0.28}" fill="${C.goldHi}"/>
        ${[0,1,2,3,4].map(i=>{const a=i/5*6.283; return `<circle cx="${f1(Math.cos(a)*s*0.6)}" cy="${f1(Math.sin(a)*s*0.6)}" r="${s*0.14}" fill="${C.paper}"/>`}).join('')}
      </g>`);
    if(kind==='redraw')  return g(`<g filter="url(#wax-fine)">
        <circle r="${s}" fill="none" stroke="${C.pencil}" stroke-width="3"/>
        <path d="M ${-s*0.5} ${-s*0.2} A ${s*0.55} ${s*0.55} 0 1 1 ${-s*0.6} ${s*0.35}" fill="none" stroke="${C.pencil}" stroke-width="3" stroke-linecap="round"/>
        <path d="M ${-s*0.62} ${s*0.1} l ${s*0.1} ${s*0.35} l ${s*0.32} ${-s*0.16}" fill="none" stroke="${C.pencil}" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"/>
      </g>`);
    if(kind==='wait')    return g(`<circle r="${s*0.7}" fill="none" stroke="${C.pencil}" stroke-width="2.5" stroke-dasharray="3 4"/>`);
    return '';
  }

  /* ======================= CREW ICONS (34px, in a role row) ======================= */
  function crewIcon(role, s=34){
    const w=v=>`filter="url(#wax-fine)"`, ink=C.ink, gold=C.gold;
    const wrap = inner => `<svg width="${s}" height="${s}" viewBox="0 0 34 34">${inner}</svg>`;
    const P = { // each in a 34x34 box
      reader:  `<g ${w()}><rect x="7" y="5" width="20" height="24" rx="3" fill="${C.paperHi}" stroke="${ink}" stroke-width="2"/>
        <line x1="10" y1="11" x2="24" y2="11" stroke="${C.ink40}" stroke-width="2"/><line x1="10" y1="16" x2="21" y2="16" stroke="${C.ink40}" stroke-width="2"/>
        <circle cx="21" cy="21" r="7" fill="none" stroke="${gold}" stroke-width="2.6"/><line x1="26" y1="26" x2="31" y2="31" stroke="${gold}" stroke-width="3" stroke-linecap="round"/></g>`,
      writer:  `<g ${w()}><path d="M8 26 L22 8 L27 12 L13 30 L7 31 Z" fill="${C.gold}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/><path d="M20 10 L25 14" stroke="${ink}" stroke-width="2"/><path d="M7 31 l3 -6" stroke="${ink}" stroke-width="2"/></g>`,
      board:   `<g ${w()}>${[0,1].map(r=>[0,1].map(c=>`<rect x="${6+c*12}" y="${6+r*12}" width="10" height="10" rx="2" fill="${c+r===0?C.gold:C.paperHi}" stroke="${ink}" stroke-width="2"/>`).join('')).join('')}</g>`,
      painter: `<g ${w()}><rect x="6" y="20" width="16" height="9" rx="4" fill="${C.cSky}" stroke="${ink}" stroke-width="2"/><rect x="20" y="8" width="7" height="16" rx="3" fill="${C.gold}" stroke="${ink}" stroke-width="2" transform="rotate(20 23 16)"/></g>`,
      camera:  `<g ${w()}><rect x="5" y="7" width="17" height="20" rx="3" fill="${C.ink}"/><polygon points="4,10 4,24 8,20 8,14" fill="none"/><path d="M6 7 l4 5 M12 7 l4 5 M18 7 l3 5" stroke="${C.goldHi}" stroke-width="1.6"/><circle cx="26" cy="17" r="6" fill="${C.gold}" stroke="${C.paper}" stroke-width="2"/></g>`,
      critic:  `<g ${w()}><circle cx="15" cy="15" r="9" fill="${C.paperHi}" stroke="${ink}" stroke-width="2.2"/>${K.star(15,15,5,{seed:2})}<line x1="22" y1="22" x2="30" y2="30" stroke="${gold}" stroke-width="3.4" stroke-linecap="round"/></g>`,
      voice:   `<g ${w()}><path d="M9 14 h5 l6 -5 v16 l-6 -5 h-5 z" fill="${C.gold}" stroke="${ink}" stroke-width="2" stroke-linejoin="round"/><path d="M24 11 q4 6 0 12" fill="none" stroke="${ink}" stroke-width="2.2" stroke-linecap="round"/></g>`,
      cutter:  `<g ${w()}><circle cx="10" cy="22" r="4.5" fill="none" stroke="${ink}" stroke-width="2.2"/><circle cx="20" cy="24" r="4.5" fill="none" stroke="${ink}" stroke-width="2.2"/><line x1="12" y1="19" x2="30" y2="6" stroke="${gold}" stroke-width="2.6" stroke-linecap="round"/><line x1="17" y1="20" x2="30" y2="10" stroke="${ink}" stroke-width="2.6" stroke-linecap="round"/></g>`
    };
    return wrap(P[role]||'');
  }

  /* ======================= THE WORDMARK — "Flick" ======================= */
  /* One clean "Flick" set in Fredoka (legible, well-kerned), given a gentle wax wobble.
     Two puns land EXACTLY via canvas measureText: the F's top arm becomes a striped film-
     clapper; the dot of the i becomes a lopsided gold star. Fonts must be loaded first. */
  let _mctx=null;
  function measure(str, font){ if(!_mctx){ _mctx=document.createElement('canvas').getContext('2d'); } _mctx.font=font; return _mctx.measureText(str).width; }
  function flickMark({size=120, reverse=false, star=true, seed=6}={}){
    const col = reverse ? C.paper : C.ink, s=size;
    const font = `700 ${s}px 'Fredoka', sans-serif`;
    const pad = s*0.12, baseY = s*0.83, cap = s*0.70, capTop = baseY - cap;
    const wF=measure('F',font), wFl=measure('Fl',font), wFli=measure('Fli',font), wAll=measure('Flick',font);
    const word = `<text x="${f1(pad)}" y="${f1(baseY)}" font-family="'Fredoka', sans-serif" font-weight="700"
      font-size="${s}" fill="${col}">Flick</text>`;
    // --- the clapper on the F's top arm ---
    const armX0 = pad - s*0.015, armX1 = pad + wF*0.96;   // span of the F top arm
    const armY = capTop - s*0.015, armH = s*0.155, aLen = armX1-armX0;
    const nS = 6;
    let stripes='';
    for(let i=0;i<nS;i++){ const x=armX0 + aLen*i/nS;
      stripes+=`<path d="M ${f1(x)} ${f1(armY)} l ${f1(-armH*0.42)} ${f1(armH)} l ${f1(aLen/nS*0.62)} 0 l ${f1(armH*0.42)} ${f1(-armH)} z"
        fill="${i%2? (reverse?C.ink:C.paper) : col}"/>`; }
    const clapper = `<g filter="url(#wax-fine)" transform="rotate(-4 ${f1(armX0)} ${f1(armY+armH)})">
      <rect x="${f1(armX0)}" y="${f1(armY)}" width="${f1(aLen)}" height="${f1(armH)}" rx="2" fill="${col}"/>
      <g>${stripes}</g>
      <circle cx="${f1(armX0)}" cy="${f1(armY+armH+ s*0.02)}" r="${f1(s*0.045)}" fill="${reverse?C.paper:C.gold}"/>
      <circle cx="${f1(armX0)}" cy="${f1(armY+armH+ s*0.02)}" r="${f1(s*0.045)}" fill="none" stroke="${col}" stroke-width="1.5"/>
    </g>`;
    // the clap "gap" line between the clapper and the slate
    const gap = `<path d="M ${f1(armX0)} ${f1(armY+armH+s*0.03)} L ${f1(armX1)} ${f1(armY+armH+s*0.005)}"
      stroke="${reverse?C.ink:C.paper}" stroke-width="${f1(s*0.02)}" opacity=".0"/>`;
    // --- the i-dot star (i center = midpoint of the 'Fl'→'Fli' advance) ---
    const iCx = pad + (wFl+wFli)/2;
    const starEl = star ? K.star(iCx, capTop - s*0.02, s*0.088, {seed, glow:!reverse}) : '';
    const W = pad*2 + wAll, H = s;
    return `<svg width="${f1(W)}" height="${f1(H)}" viewBox="0 0 ${f1(W)} ${f1(H)}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
      <g filter="url(#wax-fine)">${word}</g>
      ${clapper}${starEl}
    </svg>`;
  }

  /* the app-icon mark: a little crayon film-clapper with a gold star, in a rounded paper tile */
  function clapperIcon({size=200, tile=true, seed=5}={}){
    const s=size, m=s*0.5;
    const tileEl = tile ? `<rect x="${s*0.06}" y="${s*0.06}" width="${s*0.88}" height="${s*0.88}" rx="${s*0.2}"
      fill="${C.paperHi}" stroke="${C.ink}" stroke-width="${s*0.03}" filter="url(#wax)"/>` : '';
    const cw=s*0.56, ch=s*0.20, cx=s*0.22, cy=s*0.42;
    const stripes=(()=>{let o='';const n=5;for(let i=0;i<n;i++){o+=`<path d="M ${f1(cw*i/n)} 0 l ${f1(-ch*0.5)} ${f1(ch)} l ${f1(cw/n*0.6)} 0 l ${f1(ch*0.5)} ${f1(-ch)} z" fill="${i%2?C.paper:C.ink}"/>`;}return o;})();
    return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg">
      ${tileEl}
      <g filter="url(#wax)">
        <rect x="${cx}" y="${cy}" width="${cw}" height="${s*0.34}" rx="${s*0.04}" fill="${C.ink}"/>
      </g>
      <g transform="translate(${cx},${cy}) rotate(-12)" filter="url(#wax-fine)">
        <rect x="0" y="${-ch}" width="${cw}" height="${ch}" rx="2" fill="${C.ink}"/>
        <g transform="translate(0,${-ch})">${stripes}</g>
      </g>
      ${K.star(s*0.62, s*0.64, s*0.11, {seed, glow:true})}
    </svg>`;
  }

  /* ======================= THE MASCOT — "Scribbles" ======================= */
  /* a lopsided child-drawn cat-dog: mismatched eyes, one bent ear, a scrawl tail.
     poses: 'host' (paw up, come see) · 'project' (holds a reel, beam) · 'cheer' (it's alive!) */
  function scribbles(pose='host', size=280, {seed=12}={}){
    const s=size, r=K.rng(seed);
    const cx=s*0.5, cy=s*0.56;
    const bodyRx=s*0.26, bodyRy=s*0.28;
    const bodyD=K.blobD(cx,cy,bodyRx,bodyRy,K.rng(seed+1),0.12,20);
    const headRx=s*0.22, headRy=s*0.20, hy=cy-s*0.26;
    const headD=K.blobD(cx,hy,headRx,headRy,K.rng(seed+2),0.10,20);
    // ears: one pointy (cat), one bent/floppy (dog) — mismatched
    const earL=`<path d="M ${f1(cx-headRx*0.7)} ${f1(hy-headRy*0.55)} l ${f1(-s*0.03)} ${f1(-s*0.14)} l ${f1(s*0.10)} ${f1(s*0.05)} z"
      fill="${C.cCocoa}" stroke="${C.ink}" stroke-width="${s*0.016}" stroke-linejoin="round" filter="url(#wax)"/>`;
    const earR=`<path d="M ${f1(cx+headRx*0.5)} ${f1(hy-headRy*0.7)} q ${f1(s*0.10)} ${f1(-s*0.10)} ${f1(s*0.14)} ${f1(s*0.02)} q ${f1(-s*0.02)} ${f1(s*0.08)} ${f1(-s*0.10)} ${f1(s*0.07)} z"
      fill="${C.cCocoa}" stroke="${C.ink}" stroke-width="${s*0.016}" stroke-linejoin="round" filter="url(#wax)"/>`;
    // tail: a loose crayon scrawl spiral
    const tx=cx+bodyRx*0.9, ty=cy+bodyRy*0.4;
    const tail=K.stroke(`M ${f1(tx)} ${f1(ty)} q ${f1(s*0.14)} ${f1(-s*0.02)} ${f1(s*0.16)} ${f1(-s*0.14)} q ${f1(-s*0.01)} ${f1(-s*0.12)} ${f1(-s*0.12)} ${f1(-s*0.10)} q ${f1(-s*0.06)} ${f1(s*0.02)} ${f1(-s*0.01)} ${f1(s*0.08)}`,
      {color:C.cCocoa,w:s*0.028,seed:seed+7,passes:2,cap:'round'});
    // legs (stubby)
    const legs=[[cx-s*0.12,cy+bodyRy*0.85],[cx+s*0.10,cy+bodyRy*0.9]].map((p,i)=>
      K.line(p[0],p[1],p[0]+jit(r,4),p[1]+s*0.12,{color:C.cCocoa,w:s*0.05,seed:seed+20+i,passes:1})).join('');
    const feet=[[cx-s*0.12,cy+bodyRy*0.85+s*0.12],[cx+s*0.10,cy+bodyRy*0.9+s*0.12]].map(p=>
      `<ellipse cx="${f1(p[0])}" cy="${f1(p[1])}" rx="${s*0.05}" ry="${s*0.03}" fill="${C.cCocoa}" stroke="${C.ink}" stroke-width="${s*0.014}" filter="url(#wax)"/>`).join('');
    // an arm = a thick crayon stroke shoulder->paw with a little paw pad at the end
    const arm=(sx,sy,mx,my,px,py,sd)=> K.stroke(`M ${f1(sx)} ${f1(sy)} Q ${f1(mx)} ${f1(my)} ${f1(px)} ${f1(py)}`,{color:C.cCocoa,w:s*0.05,seed:sd,passes:2})
      + `<circle cx="${f1(px)}" cy="${f1(py)}" r="${s*0.035}" fill="${C.cCocoa}" stroke="${C.ink}" stroke-width="${s*0.013}" filter="url(#wax-fine)"/>`;
    const shL=[cx-bodyRx*0.72, cy-bodyRy*0.12], shR=[cx+bodyRx*0.72, cy-bodyRy*0.12];
    let arms='', extraFront='', extraBack='';
    if(pose==='host'){
      arms = arm(shL[0],shL[1], shL[0]-s*0.06,shL[1]+s*0.06, cx-bodyRx*0.9,cy+bodyRy*0.35, seed+30)   // left down
           + arm(shR[0],shR[1], shR[0]+s*0.12,shR[1]-s*0.10, cx+bodyRx*1.05,hy-headRy*0.4, seed+31);  // right waving up
    } else if(pose==='project'){
      extraBack = `<path d="M ${f1(cx)} ${f1(cy-s*0.48)} L ${f1(cx-s*0.30)} ${f1(cy-s*0.05)} L ${f1(cx+s*0.30)} ${f1(cy-s*0.05)} Z" fill="url(#gGlowSoft)"/>`;
      arms = arm(shL[0],shL[1], cx-s*0.20,cy-s*0.26, cx-s*0.12,cy-s*0.44, seed+30)
           + arm(shR[0],shR[1], cx+s*0.20,cy-s*0.26, cx+s*0.12,cy-s*0.44, seed+31);
      extraFront = seal('rolling',cx,cy-s*0.50,s*0.085);   // the reel held up over the head
    } else if(pose==='cheer'){
      arms = arm(shL[0],shL[1], cx-s*0.16,cy-s*0.20, cx-s*0.20,cy-s*0.34, seed+30)
           + arm(shR[0],shR[1], cx+s*0.16,cy-s*0.20, cx+s*0.20,cy-s*0.34, seed+31);
      extraFront = K.star(cx-s*0.24,cy-s*0.36,s*0.055,{seed:seed+40,glow:true}) + K.star(cx+s*0.24,cy-s*0.36,s*0.05,{seed:seed+41,glow:true});
    }
    // eyes depend on pose (cheer = happy star-ish); two DIFFERENT sizes always
    const eL=`<circle cx="${f1(cx-headRx*0.36)}" cy="${f1(hy-headRy*0.05)}" r="${s*0.034}" fill="${C.ink}"/>`;
    const eR=`<circle cx="${f1(cx+headRx*0.34)}" cy="${f1(hy)}" r="${s*0.05}" fill="${C.ink}"/>`;
    const eLhi=`<circle cx="${f1(cx-headRx*0.36+2)}" cy="${f1(hy-headRy*0.05-2)}" r="${s*0.011}" fill="${C.paper}"/>`;
    const eRhi=`<circle cx="${f1(cx+headRx*0.34+3)}" cy="${f1(hy-3)}" r="${s*0.016}" fill="${C.paper}"/>`;
    const nose=`<path d="M ${f1(cx-s*0.022)} ${f1(hy+headRy*0.26)} l ${f1(s*0.044)} 0 l ${f1(-s*0.022)} ${f1(s*0.03)} z" fill="${C.cBerry}" stroke="${C.ink}" stroke-width="1.4"/>`;
    const smile= pose==='cheer'
      ? K.stroke(`M ${f1(cx-s*0.08)} ${f1(hy+headRy*0.34)} q ${f1(s*0.08)} ${f1(s*0.13)} ${f1(s*0.17)} 0`,{color:C.ink,w:s*0.017,seed:seed+9,passes:1})
      : K.stroke(`M ${f1(cx-s*0.07)} ${f1(hy+headRy*0.40)} q ${f1(s*0.07)} ${f1(s*0.08)} ${f1(s*0.15)} ${f1(-s*0.01)}`,{color:C.ink,w:s*0.016,seed:seed+9,passes:1});
    const cheek=`<circle cx="${f1(cx-headRx*0.62)}" cy="${f1(hy+headRy*0.3)}" r="${s*0.03}" fill="${C.cBerry}" opacity=".5"/><circle cx="${f1(cx+headRx*0.62)}" cy="${f1(hy+headRy*0.3)}" r="${s*0.03}" fill="${C.cBerry}" opacity=".5"/>`;
    const bboxBody=[cx-bodyRx,cy-bodyRy,bodyRx*2,bodyRy*2];
    const bboxHead=[cx-headRx,hy-headRy,headRx*2,headRy*2];
    return `<svg width="${s}" height="${s}" viewBox="0 0 ${s} ${s}" xmlns="http://www.w3.org/2000/svg" style="overflow:visible">
      ${extraBack}
      ${tail}${legs}${feet}
      ${earL}${earR}
      ${fillShape(bodyD,bboxBody,{color:C.cCocoa,seed:seed+50,angle:18,ow:s*0.018})}
      <ellipse cx="${cx}" cy="${f1(cy+bodyRy*0.18)}" rx="${bodyRx*0.55}" ry="${bodyRy*0.46}" fill="${C.paperHi}" opacity=".42" filter="url(#wax)"/>
      ${arms}
      ${fillShape(headD,bboxHead,{color:C.cCocoa,seed:seed+51,angle:-14,ow:s*0.018})}
      ${cheek}${eL}${eR}${eLhi}${eRhi}${nose}${smile}
      ${extraFront}
    </svg>`;
  }

  /* ======================= THE CHILD'S WORLD (cartoon content) ======================= */
  function sunFace(cx,cy,rad,{seed=7,face=true}={}){
    const d=K.blobD(cx,cy,rad,rad,K.rng(seed),0.06,24);
    let rays=''; const n=11;
    for(let i=0;i<n;i++){ const a=i/n*6.283+jit(K.rng(seed+i),0.1); const r1=rad*1.12,r2=rad*(1.42+K.rng(seed+i)()*0.12);
      rays+=K.line(cx+Math.cos(a)*r1,cy+Math.sin(a)*r1,cx+Math.cos(a)*r2,cy+Math.sin(a)*r2,{color:C.cSun,w:rad*0.11,seed:seed+i,passes:1}); }
    const eyes=face?`<circle cx="${f1(cx-rad*0.34)}" cy="${f1(cy-rad*0.12)}" r="${rad*0.10}" fill="${C.ink}"/>
      <circle cx="${f1(cx+rad*0.34)}" cy="${f1(cy-rad*0.12)}" r="${rad*0.10}" fill="${C.ink}"/>
      ${K.stroke(`M ${f1(cx-rad*0.3)} ${f1(cy+rad*0.28)} q ${f1(rad*0.3)} ${f1(rad*0.34)} ${f1(rad*0.62)} 0`,{color:C.ink,w:rad*0.06,seed:seed+3,passes:1})}
      <circle cx="${f1(cx-rad*0.5)}" cy="${f1(cy+rad*0.18)}" r="${rad*0.12}" fill="${C.cFlame}" opacity=".45"/>
      <circle cx="${f1(cx+rad*0.5)}" cy="${f1(cy+rad*0.18)}" r="${rad*0.12}" fill="${C.cFlame}" opacity=".45"/>`:'';
    return `<g>${rays}${fillShape(d,[cx-rad,cy-rad,rad*2,rad*2],{color:C.cSun,seed,angle:14,ow:rad*0.07})}${eyes}</g>`;
  }
  function cloud(cx,cy,s,{seed=5,color=C.cCloud}={}){
    const d=`M ${f1(cx-s)} ${f1(cy)} q ${f1(-s*0.1)} ${f1(-s*0.7)} ${f1(s*0.5)} ${f1(-s*0.5)} q ${f1(s*0.2)} ${f1(-s*0.55)} ${f1(s*0.75)} ${f1(-s*0.12)} q ${f1(s*0.55)} ${f1(-s*0.15)} ${f1(s*0.5)} ${f1(s*0.45)} q ${f1(s*0.35)} ${f1(s*0.25)} ${f1(-s*0.05)} ${f1(s*0.35)} Z`;
    return fillShape(d,[cx-s,cy-s*0.8,s*2,s*1.2],{color,seed,angle:8,ow:s*0.05,streaks:false});
  }
  function hill(w,groundY,h,{seed=9,color=C.cGrass}={}){
    const r=K.rng(seed); let top=`M -10 ${f1(groundY+40)} L -10 ${f1(groundY)}`;
    const n=8; for(let i=0;i<=n;i++){ const x=(w+20)*i/n-10; const y=groundY - h*Math.sin(i/n*Math.PI)*0.6 + jit(r,10); top+=` L ${f1(x)} ${f1(y)}`; }
    top+=` L ${w+10} ${f1(groundY+40)} Z`;
    return fillShape(top,[-10,groundY-h,w+20,h+50],{color,seed,angle:-8,ow:5});
  }
  function grassBlades(y,w,{seed=11,color=C.cGrassLo,n=40}={}){
    const r=K.rng(seed); let o='';
    for(let i=0;i<n;i++){ const x=r()*w; const hh=8+r()*14; o+=K.line(x,y,x+jit(r,4),y-hh,{color,w:3,seed:seed+i,passes:1}); }
    return `<g filter="url(#wax)">${o}</g>`;
  }
  function moon(cx,cy,rad,{seed=13}={}){
    const d=K.blobD(cx,cy,rad,rad,K.rng(seed),0.05,20);
    return `<g>${fillShape(d,[cx-rad,cy-rad,rad*2,rad*2],{color:C.cSunHi,seed,angle:12,ow:rad*0.08,streaks:false})}
      <circle cx="${f1(cx+rad*0.3)}" cy="${f1(cy-rad*0.2)}" r="${rad*0.16}" fill="${C.cCocoa}" opacity=".25"/></g>`;
  }
  function starsField(w,h,n,{seed=17}={}){
    const r=K.rng(seed); let o='';
    for(let i=0;i<n;i++) o+=K.star(r()*w,r()*h*0.6,3+r()*4,{seed:seed+i});
    return o;
  }

  /* THE HERO: the wonky green dragon — two different-sized wings, over-pressed green,
     a scribbled flame, mismatched eyes. THE child's character. */
  function dragon(cx,cy,s,{seed=21,flame=true,face=true}={}){
    const r=K.rng(seed);
    const bodyD=K.blobD(cx,cy,s*0.34,s*0.30,K.rng(seed+1),0.14,20);
    const headCx=cx+s*0.30, headCy=cy-s*0.22;
    const headD=K.blobD(headCx,headCy,s*0.22,s*0.20,K.rng(seed+2),0.12,20);
    const tailD=`M ${f1(cx-s*0.30)} ${f1(cy+s*0.04)} q ${f1(-s*0.30)} ${f1(-s*0.02)} ${f1(-s*0.34)} ${f1(-s*0.24)} q ${f1(s*0.02)} ${f1(-s*0.12)} ${f1(s*0.12)} ${f1(-s*0.06)}`;
    const tail=K.stroke(tailD,{color:C.cDragon,w:s*0.10,seed:seed+3,passes:2});
    // two DIFFERENT-sized webbed wings on the back (the signature "two-sized wings")
    // a webbed wing: a wide triangle (base->tip leading edge) with scalloped trailing web
    const batWing=(bx,by,len,dir,fingers,tilt)=>{
      const tipx=bx+Math.cos(tilt)*len*dir, tipy=by-Math.sin(tilt)*len;
      // trailing base point (spread out from the base so the wing reads WIDE, not blade-like)
      const spx=bx+dir*len*0.62, spy=by+len*0.04;
      let d=`M ${f1(bx)} ${f1(by)} Q ${f1(bx+(tipx-bx)*0.4-dir*len*0.14)} ${f1(by-len*0.6)} ${f1(tipx)} ${f1(tipy)}`;
      for(let i=1;i<=fingers;i++){ const t=i/fingers; const px=tipx+(spx-tipx)*t, py=tipy+(spy-tipy)*t;
        d+=` Q ${f1(px+dir*len*0.02)} ${f1(py+len*0.16)} ${f1(px)} ${f1(py)}`; }
      return d+` L ${f1(bx)} ${f1(by)} Z`;
    };
    const wingBigD=batWing(cx-s*0.08, cy-s*0.16, s*0.42, -1, 3, 0.92);   // big, splays up-left
    const wingSmD =batWing(cx+s*0.14, cy-s*0.17, s*0.26,  1, 2, 1.02);   // small, up-right
    // legs
    const legs=[[cx-s*0.14,cy+s*0.26],[cx+s*0.06,cy+s*0.28]].map((p,i)=>
      K.line(p[0],p[1],p[0]+jit(r,4),p[1]+s*0.12,{color:C.cDragon2,w:s*0.06,seed:seed+10+i,passes:1})).join('');
    // flame from mouth (scribbled orange)
    let fl='';
    if(flame){ const fx=headCx+s*0.20, fy=headCy+s*0.02;
      const flD=`M ${f1(fx)} ${f1(fy-s*0.05)} q ${f1(s*0.18)} ${f1(-s*0.02)} ${f1(s*0.26)} ${f1(s*0.05)} q ${f1(-s*0.06)} ${f1(s*0.05)} ${f1(-s*0.16)} ${f1(s*0.05)} q ${f1(s*0.06)} ${f1(s*0.04)} ${f1(-s*0.02)} ${f1(s*0.08)} q ${f1(-s*0.12)} ${f1(-s*0.02)} ${f1(-s*0.08)} ${f1(-s*0.13)} Z`;
      fl=fillShape(flD,[fx-4,fy-s*0.10,s*0.30,s*0.24],{color:C.cFlame,seed:seed+30,angle:6,ow:s*0.02,streaks:false});
    }
    // face: mismatched eyes + smile + horn
    let fc='';
    if(face){ fc=`<circle cx="${f1(headCx+s*0.02)}" cy="${f1(headCy-s*0.04)}" r="${s*0.045}" fill="${C.ink}"/>
      <circle cx="${f1(headCx+s*0.13)}" cy="${f1(headCy-s*0.02)}" r="${s*0.03}" fill="${C.ink}"/>
      <circle cx="${f1(headCx+s*0.03)}" cy="${f1(headCy-s*0.05)}" r="${s*0.014}" fill="${C.paper}"/>
      ${K.stroke(`M ${f1(headCx+s*0.02)} ${f1(headCy+s*0.09)} q ${f1(s*0.09)} ${f1(s*0.04)} ${f1(s*0.16)} ${f1(-s*0.01)}`,{color:C.ink,w:s*0.02,seed:seed+9,passes:1})}
      <path d="M ${f1(headCx-s*0.04)} ${f1(headCy-s*0.18)} l ${f1(s*0.03)} ${f1(-s*0.09)} l ${f1(s*0.05)} ${f1(s*0.07)} z" fill="${C.cSun}" stroke="${C.ink}" stroke-width="${s*0.015}" filter="url(#wax)"/>`; }
    return `<g>
      ${tail}${legs}${fl}
      ${fillShape(wingBigD,[cx-s*0.52,cy-s*0.62,s*0.60,s*0.52],{color:C.cDragon2,seed:seed+40,angle:-24,ow:s*0.02})}
      ${fillShape(wingSmD,[cx+s*0.06,cy-s*0.52,s*0.34,s*0.40],{color:C.cDragon2,seed:seed+42,angle:24,ow:s*0.02})}
      ${fillShape(bodyD,[cx-s*0.34,cy-s*0.30,s*0.68,s*0.60],{color:C.cDragon,seed:seed+41,angle:16,ow:s*0.025})}
      <ellipse cx="${f1(cx-s*0.02)}" cy="${f1(cy+s*0.10)}" rx="${s*0.19}" ry="${s*0.13}" fill="${C.cDragon2}" opacity=".32" filter="url(#wax)"/>
      ${fillShape(headD,[headCx-s*0.22,headCy-s*0.20,s*0.44,s*0.40],{color:C.cDragon,seed:seed+43,angle:-12,ow:s*0.025})}
      ${fc}
    </g>`;
  }

  /* a wonky child-drawn ROBOT — boxy body, antenna, mismatched bolt-eyes */
  function robot(cx,cy,s,{seed=51,color=C.cPlum}={}){
    const bw=s*0.44,bh=s*0.40, hw=s*0.34,hh=s*0.28, hy=cy-s*0.10;
    const bodyD=`M ${f1(cx-bw/2)} ${f1(cy+s*0.02)} q 0 ${f1(-bh*0.1)} ${f1(bw*0.08)} ${f1(-bh*0.1)} L ${f1(cx+bw/2-bw*0.08)} ${f1(cy-bh+s*0.02)} q ${f1(bw*0.08)} 0 ${f1(bw*0.08)} ${f1(bh*0.1)} L ${f1(cx+bw/2)} ${f1(cy+bh*0.4)} q 0 ${f1(bh*0.1)} ${f1(-bw*0.08)} ${f1(bh*0.1)} L ${f1(cx-bw/2+bw*0.08)} ${f1(cy+bh*0.5)} q ${f1(-bw*0.08)} 0 ${f1(-bw*0.08)} ${f1(-bh*0.1)} Z`;
    const headD=K.blobD(cx,hy-hh*0.6,hw/2,hh/2,K.rng(seed+2),0.05,4);
    const legs=[[cx-s*0.12,cy+s*0.42],[cx+s*0.12,cy+s*0.42]].map((p,i)=>K.line(p[0],p[1],p[0],p[1]+s*0.12,{color:C.ink72,w:s*0.05,seed:seed+i,passes:1})).join('');
    const arms=K.line(cx-bw/2,cy-s*0.06,cx-bw/2-s*0.12,cy+s*0.02,{color:C.ink72,w:s*0.045,seed:seed+5,passes:1})
      + K.line(cx+bw/2,cy-s*0.06,cx+bw/2+s*0.12,cy-s*0.10,{color:C.ink72,w:s*0.045,seed:seed+6,passes:1});
    const ant=K.line(cx-s*0.05,hy-hh*1.1,cx-s*0.08,hy-hh*1.5,{color:C.ink72,w:s*0.03,seed:seed+7,passes:1})+K.star(cx-s*0.08,hy-hh*1.55,s*0.05,{seed:seed+8,glow:true});
    return `<g>${legs}${arms}${ant}
      ${fillShape(bodyD,[cx-bw/2,cy-bh,bw,bh*1.5],{color,seed:seed+10,angle:14,ow:s*0.022})}
      ${fillShape(headD,[cx-hw/2,hy-hh,hw,hh],{color,seed:seed+11,angle:-10,ow:s*0.022})}
      <circle cx="${f1(cx-hw*0.22)}" cy="${f1(hy-hh*0.6)}" r="${s*0.045}" fill="${C.ink}"/>
      <circle cx="${f1(cx+hw*0.22)}" cy="${f1(hy-hh*0.6)}" r="${s*0.03}" fill="${C.ink}"/>
      <rect x="${f1(cx-s*0.08)}" y="${f1(hy-hh*0.15)}" width="${s*0.16}" height="${s*0.05}" rx="2" fill="none" stroke="${C.ink}" stroke-width="${s*0.016}" filter="url(#wax)"/>
      <ellipse cx="${f1(cx)}" cy="${f1(cy+s*0.04)}" rx="${bw*0.28}" ry="${bh*0.24}" fill="${C.paperHi}" opacity=".3" filter="url(#wax)"/></g>`;
  }
  /* a wonky child-drawn CAT — round body, triangle ears, whiskers */
  function critter(cx,cy,s,{seed=61,color=C.cSun}={}){
    const bodyD=K.blobD(cx,cy+s*0.04,s*0.30,s*0.30,K.rng(seed+1),0.12,18);
    const hy=cy-s*0.22, headD=K.blobD(cx,hy,s*0.24,s*0.21,K.rng(seed+2),0.10,18);
    const ear=(ex,dir)=>`<path d="M ${f1(cx+ex)} ${f1(hy-s*0.12)} l ${f1(dir*s*0.02)} ${f1(-s*0.13)} l ${f1(dir*s*0.11)} ${f1(s*0.06)} z" fill="${color}" stroke="${C.ink}" stroke-width="${s*0.016}" stroke-linejoin="round" filter="url(#wax)"/>`;
    const tail=K.stroke(`M ${f1(cx+s*0.26)} ${f1(cy+s*0.14)} q ${f1(s*0.20)} ${f1(-s*0.04)} ${f1(s*0.16)} ${f1(-s*0.22)}`,{color,w:s*0.06,seed:seed+3,passes:2});
    const legs=[[cx-s*0.1,cy+s*0.3],[cx+s*0.1,cy+s*0.31]].map((p,i)=>K.line(p[0],p[1],p[0],p[1]+s*0.1,{color,w:s*0.05,seed:seed+i,passes:1})).join('');
    const wh=`<g filter="url(#wax-fine)" stroke="${C.ink55}" stroke-width="${s*0.01}">
      <line x1="${f1(cx-s*0.06)}" y1="${f1(hy+s*0.04)}" x2="${f1(cx-s*0.22)}" y2="${f1(hy+s*0.02)}"/>
      <line x1="${f1(cx-s*0.06)}" y1="${f1(hy+s*0.07)}" x2="${f1(cx-s*0.22)}" y2="${f1(hy+s*0.09)}"/>
      <line x1="${f1(cx+s*0.06)}" y1="${f1(hy+s*0.04)}" x2="${f1(cx+s*0.22)}" y2="${f1(hy+s*0.02)}"/>
      <line x1="${f1(cx+s*0.06)}" y1="${f1(hy+s*0.07)}" x2="${f1(cx+s*0.22)}" y2="${f1(hy+s*0.09)}"/></g>`;
    return `<g>${tail}${legs}${ear(-s*0.14,-1)}${ear(s*0.14,1)}
      ${fillShape(bodyD,[cx-s*0.3,cy-s*0.26,s*0.6,s*0.6],{color,seed:seed+10,angle:16,ow:s*0.02})}
      ${fillShape(headD,[cx-s*0.24,hy-s*0.21,s*0.48,s*0.42],{color,seed:seed+11,angle:-12,ow:s*0.02})}
      ${wh}
      <circle cx="${f1(cx-s*0.08)}" cy="${f1(hy-s*0.01)}" r="${s*0.032}" fill="${C.ink}"/>
      <circle cx="${f1(cx+s*0.08)}" cy="${f1(hy)}" r="${s*0.045}" fill="${C.ink}"/>
      <path d="M ${f1(cx-s*0.02)} ${f1(hy+s*0.04)} l ${f1(s*0.04)} 0 l ${f1(-s*0.02)} ${f1(s*0.03)} z" fill="${C.cBerry}" stroke="${C.ink}" stroke-width="1"/>
      ${K.stroke(`M ${f1(cx-s*0.05)} ${f1(hy+s*0.09)} q ${f1(s*0.05)} ${f1(s*0.05)} ${f1(s*0.1)} 0`,{color:C.ink,w:s*0.014,seed:seed+9,passes:1})}</g>`;
  }

  root.Scene = { uid, fillShape, seal, crewIcon, flickMark, clapperIcon, scribbles,
    sunFace, cloud, hill, grassBlades, moon, starsField, dragon, robot, critter };
})(window);
