/* Habumi: one real habit, one continuous camera. Native pixels remain unchanged. */
'use strict';
(() => {
  const T=window.StoryTimeline,clamp=T.clamp,smooth=T.smooth,mix=T.mix;
  document.documentElement.classList.add('story-ready');
  const phase=(p,a,b)=>smooth((p-a)/(b-a));
  const cfg={"screens":[{"id":"today","at":0,"point":0,"fade":0},{"id":"done","at":0.295,"point":0.35,"fade":0.045},{"id":"journal","at":0.48,"point":0.56,"fade":0.035},{"id":"insights","at":0.735,"point":0.93,"fade":0.035}],"beats":[{"at":0},{"at":0.2},{"at":0.35},{"at":0.56},{"at":0.8}],"camera":[{"at":0,"zoom":1,"focus_y":0.5,"rotation":-3},{"at":0.14,"zoom":1,"focus_y":0.5,"highlight":{"x":0.03482587064676617,"y":0.4462242562929062,"w":0.9303482587064676,"h":0.07093821510297482,"strength":0}},{"at":0.23,"zoom":2.05,"focus_y":0.4816933638443936,"highlight":{"x":0.03482587064676617,"y":0.4462242562929062,"w":0.9303482587064676,"h":0.07093821510297482,"strength":0.8}},{"at":0.35,"zoom":2.05,"focus_y":0.4816933638443936,"highlight":{"x":0.03482587064676617,"y":0.4462242562929062,"w":0.9303482587064676,"h":0.07093821510297482,"strength":0.8}},{"at":0.4,"zoom":1,"focus_y":0.5,"highlight":{"x":0.03482587064676617,"y":0.4462242562929062,"w":0.9303482587064676,"h":0.07093821510297482,"strength":0}},{"at":0.515,"zoom":1,"focus_y":0.5},{"at":0.56,"zoom":2.25,"focus_y":0.2242562929061785},{"at":0.63,"zoom":2.25,"focus_y":0.2242562929061785},{"at":0.675,"zoom":1,"focus_y":0.5},{"at":0.82,"zoom":1,"focus_y":0.5,"highlight":{"x":0.03482587064676617,"y":0.47292143401983217,"w":0.9303482587064676,"h":0.32341723874904654,"strength":0}},{"at":0.91,"zoom":2.15,"focus_y":0.5522501906941266,"highlight":{"x":0.03482587064676617,"y":0.47292143401983217,"w":0.9303482587064676,"h":0.32341723874904654,"strength":0.65}},{"at":0.96,"zoom":2.15,"focus_y":0.5522501906941266,"highlight":{"x":0.03482587064676617,"y":0.47292143401983217,"w":0.9303482587064676,"h":0.32341723874904654,"strength":0.65}},{"at":1,"zoom":1,"focus_y":0.5,"highlight":{"x":0.03482587064676617,"y":0.47292143401983217,"w":0.9303482587064676,"h":0.32341723874904654,"strength":0}}]};
  const journey=document.querySelector('.journey'),pin=journey.querySelector('.journey-pin'),canvas=journey.querySelector('.journey-canvas'),phone=journey.querySelector('.journey-phone'),actions=journey.querySelector('.journey-actions');
  const controls=journey.querySelector('.journey-controls'),hero=journey.querySelector('.hero-photo'),heroImage=hero.querySelector('img'),siteHeader=document.querySelector('.site-nav');
  const screenWindow=journey.querySelector('.phone-screen'),aperture=journey.querySelector('.journey-aperture');
  const feedback=journey.querySelector('.journey-feedback'),feedbackText=feedback.querySelector('p'),retryScreen=feedback.querySelector('button');
  const anchors=[...journey.querySelectorAll('[data-at]')],buttons=[...journey.querySelectorAll('[data-point]')],copies=[...journey.querySelectorAll('[data-copy]')],screens=[...journey.querySelectorAll('.app-screen')];
  // Safari's browser bars can leave a portrait iPhone with less than700 CSS pixels.
  // Keep that portrait story scroll-driven; reserve the short-window fallback for
  // genuinely short/landscape windows and retain the measured text-fit safeguard.
  const preference=matchMedia('(prefers-reduced-motion: reduce)'),shortWindow=matchMedia('(min-width:900px) and (max-height:699px), (max-height:499px)'),narrowPortrait=matchMedia('(max-width:360px) and (max-height:699px) and (orientation:portrait)'),motion=document.getElementById('motion-control'),status=journey.querySelector('.journey-status');
  const photoQuad=[[719.9544805777948,144.5107067419669],[993.1689793779582,126.93879838579613],[1036.2872106014715,731.8540855915014],[758.1428724417343,747.0857407262491]];
  const cameraX=[{at:0,v:.70},{at:.40,v:.70},{at:.475,v:.29},{at:.675,v:.29},{at:.73,v:.70},{at:1,v:.70}];
  let frame=null,userReduce=false,manual=0,current=0,firstLayout=true,seekTarget=null,focusPending=false,copyHeights=[],retryCount=0,lastWidth=0,lastHeight=0,contentTight=false,mobileCopyTop=100,siteHeaderHeight=81;
  const failed=new Set(),decoded=new WeakSet(),reduced=()=>preference.matches||userReduce,staticMode=()=>reduced()||shortWindow.matches||narrowPortrait.matches||contentTight;
  const set=(node,name,value)=>{if(node.style.getPropertyValue(name)!==value)node.style.setProperty(name,value);};
  const scrollSpan=()=>Math.max(1,journey.offsetHeight-pin.clientHeight);
  function track(keys,p){let i=keys.findIndex(k=>k.at>p);if(i<0)return keys.at(-1).v;const a=keys[Math.max(0,i-1)],b=keys[i];return mix(a.v,b.v,smooth((p-a.at)/Math.max(.00001,b.at-a.at)));}
  function layout(){
    copyHeights=copies.map(n=>Math.ceil(n.lastElementChild.getBoundingClientRect().bottom-n.getBoundingClientRect().top));
    const mobile=innerWidth<900,maxCopy=Math.max(...copyHeights),actionHeight=actions.offsetHeight,controlHeight=controls.offsetHeight;
    mobileCopyTop=parseFloat(getComputedStyle(copies[0]).top)||100;
    siteHeaderHeight=siteHeader.offsetHeight;
    const needed=mobile?mobileCopyTop+maxCopy+actionHeight+controlHeight+170:innerHeight*.29+maxCopy+actionHeight+controlHeight+10;
    contentTight=needed>innerHeight;
    const expanded=mobile?mobileCopyTop+maxCopy+actionHeight+controlHeight+130+Math.min(168,innerWidth*.48)*(2622/1206):(maxCopy+actionHeight+controlHeight+30)/.71;
    journey.classList.toggle('is-static',staticMode());
    set(journey,'--static-height',Math.ceil(Math.max(600,innerHeight,(contentTight||(mobile&&staticMode()))?expanded:0))+'px');
    set(journey,'--hero-copy-height',copyHeights[0]+'px');
    set(journey,'--controls-height',controls.getBoundingClientRect().height+'px');
    const span=scrollSpan();lastWidth=pin.clientWidth;lastHeight=pin.clientHeight;
    anchors.forEach(a=>a.style.top=(staticMode()?0:Number(a.dataset.at)*span)+'px');
    if(firstLayout){firstLayout=false;const a=anchors.find(a=>'#'+a.id===location.hash);if(a){manual=+a.dataset.at;if(!staticMode())scrollTo({top:journey.offsetTop+manual*span,behavior:'instant'});}}
    schedule();
  }
  function render(){
    frame=null;if(document.hidden)return;
    if(seekTarget!==null&&Math.abs(scrollY-seekTarget)<1)seekTarget=null;
    renderDetails();const rect=journey.getBoundingClientRect(),active=rect.top<innerHeight&&rect.bottom>0;
    journey.classList.toggle('is-active',active&&!staticMode());if(!active)return;
    const p=staticMode()?manual:clamp(-rect.top/scrollSpan());current=p;
    const state=T.sample(cfg,p,screens.map(i=>decoded.has(i))),shown=state.p;
    const staticShot=state.selected===0?(shown>=.105?.23:0):[0,.35,.56,.93][state.selected];
    const camera=staticMode()?T.camera(cfg.camera,staticShot):state.camera;
    const mobile=innerWidth<900,W=pin.clientWidth,H=pin.clientHeight,dpr=devicePixelRatio||1,aspect=2622/1206;
    const intro=1-phase(p,.055,.085),heroTop=mobile?mobileCopyTop:H*.235;
    const copyHeight=track(cfg.beats.map((b,i)=>({at:b.at,v:copyHeights[i]||180})),p);
    const actionHeight=actions.offsetHeight;
    const top=mobile?heroTop+copyHeight+26+intro*(actionHeight+17):100;
    const bottom=H-controls.offsetHeight-(mobile?43:48);
    const originalBase=Math.max(1,Math.min(1206/dpr*.94,mobile?Math.min(250,W*.6):Math.min(338,H*.68/aspect),(bottom-top-44)/aspect));
    const bridgeHeight=Math.max(copyHeights[5]||77,copyHeights[6]||77),bridgeFloor=siteHeaderHeight+16+bridgeHeight+24;
    const bridgeWeight=mobile?0:Math.max(phase(shown,.35,.40)*(1-phase(shown,.515,.56)),phase(shown,.63,.675)*(1-phase(shown,.77,.82)));
    const base=mix(originalBase,Math.min(originalBase,Math.max(1,bottom-bridgeFloor)/aspect),bridgeWeight);
    const kind=shown<.40?'reading':shown<.675?'journal':'insights';
    const crop=({"reading":{"t":0.38443935926773454,"b":0.4736842105263158,"l":0.03482587064676617,"r":0.03482587064676612},"journal":{"t":0.06864988558352403,"b":0.620137299771167,"l":0.024875621890547265,"r":0.02487562189054726},"insights":{"t":0.2990083905415713,"b":0.19450800915331812,"l":0.03482587064676617,"r":0.03482587064676612}})[kind];
    const macro=phase(camera.zoom,1.3,1.95);
    const limit=mobile?(W-32)/(1-crop.l-crop.r):W*.49;
    const macroWidth=Math.min(limit,1206/dpr,Math.max(1,bottom-top-24)/(aspect*(1-crop.t-crop.b)));
    const desiredWidth=mobile?mix(base*camera.zoom,macroWidth,macro):base*camera.zoom;
    const width=Math.floor(Math.min(desiredWidth,1206/dpr,limit)*dpr)/dpr,height=width*aspect;
    const cx=mobile?W/2:W*track(cameraX,shown);
    const readingLift=mobile&&kind==='reading'?60*macro:0;
    let cy=mobile?(top+bottom)/2-readingLift:mix(H*.49,(bridgeFloor+bottom)/2,bridgeWeight);
    const focus=camera.focus,angle=(staticMode()?0:camera.rotation)*Math.PI/180;
    if(mobile&&macro>0){const excerptTop=cy+height*(crop.t-focus),excerptHeight=height*(1-crop.t-crop.b);const fittedTop=Math.max(top+12,Math.min(excerptTop,bottom-excerptHeight-12));cy+=(fittedTop-excerptTop)*macro;}
    const flat=[[0,0],[width,0],[width,height],[0,height]].map(([x,y])=>{const dx=x-width/2,dy=y-height*focus;return[cx+dx*Math.cos(angle)-dy*Math.sin(angle),cy+dx*Math.sin(angle)+dy*Math.cos(angle)];});
    set(journey,'--bridge-x',cx.toFixed(2)+'px');set(journey,'--bridge-top',Math.max(siteHeaderHeight+16,flat[0][1]-bridgeHeight-24).toFixed(2)+'px');
    const quadCenter=[photoQuad.reduce((n,q)=>n+q[0],0)/4,photoQuad.reduce((n,q)=>n+q[1],0)/4];
    const avgPhotoWidth=(Math.hypot(photoQuad[1][0]-photoQuad[0][0],photoQuad[1][1]-photoQuad[0][1])+Math.hypot(photoQuad[2][0]-photoQuad[3][0],photoQuad[2][1]-photoQuad[3][1]))/2;
    const photoScale=base/avgPhotoWidth,px=(mobile?W/2:W*.70)-quadCenter[0]*photoScale,py=(mobile?(top+bottom)/2:H*.49)-quadCenter[1]*photoScale;
    const photoReady=decoded.has(heroImage)&&decoded.has(screens[0]);
    const detach=staticMode()||!photoReady?1:phase(shown,.125,.20),photoAlpha=staticMode()||!photoReady?0:1-phase(shown,.055,.12);
    const from=photoQuad.map(([x,y])=>{const dx=x-quadCenter[0],dy=y-quadCenter[1],len=Math.hypot(dx,dy);return[px+(x+dx/len*8)*photoScale,py+(y+dy/len*8)*photoScale];});
    const destination=from.map((q,i)=>[mix(q[0],flat[i][0],detach),mix(q[1],flat[i][1],detach)]);
    set(phone,'--raster-width',width.toFixed(4)+'px');
    const flatMode=detach===1&&Math.abs(angle)<.000001;phone.classList.toggle('is-flat',flatMode);
    if(flatMode){phone.style.left=(Math.round(flat[0][0]*dpr)/dpr)+'px';phone.style.top=(Math.round(flat[0][1]*dpr)/dpr)+'px';phone.style.transform='none';}
    else{const matrix=projective(width,height,destination);phone.style.left='0px';phone.style.top='0px';if(matrix)phone.style.transform='matrix3d('+matrix.map(v=>+v.toFixed(10)).join(',')+')';}
    const bezel=(1-photoAlpha)*(1-phase(camera.zoom,1.08,1.3));
    set(journey,'--frame-alpha',String(bezel));set(journey,'--screen-radius-x',mix(8.5,11,detach)+'%');set(journey,'--screen-radius-y',mix(3.9,5.1,detach)+'%');
    const inset=[crop.t,crop.r,crop.b,crop.l].map(n=>(n*macro*100).toFixed(5)+'%'),radius=(mobile?18:24)*macro;
    screenWindow.style.clipPath='inset('+inset.join(' ')+' round '+radius+'px)';
    aperture.style.inset=inset.join(' ');aperture.style.borderRadius=radius+'px';aperture.style.opacity=macro;
    journey.dataset.crop=JSON.stringify({kind,macro,...crop});
    set(journey,'--camera-top',top.toFixed(2)+'px');set(journey,'--camera-bottom',(H-bottom).toFixed(2)+'px');
    set(hero,'--photo-alpha',photoAlpha.toFixed(6));hero.style.width=(1536*photoScale).toFixed(3)+'px';hero.style.height=(1024*photoScale).toFixed(3)+'px';hero.style.transform='translate3d('+px.toFixed(3)+'px,'+py.toFixed(3)+'px,0)';
    set(journey,'--photo-alpha',photoAlpha.toFixed(6));set(journey,'--light-x',((p-.5)*60).toFixed(3)+'px');
    const h=camera.highlight;for(const k of ['x','y','w','h'])set(journey,'--emphasis-'+k,(h[k]*100)+'%');set(journey,'--emphasis',String(staticMode()?0:h.strength*(1-macro)));
    set(journey,'--warmth',(clamp((camera.zoom-1)/1.5)*.35).toFixed(5));set(journey,'--journey-progress',p.toFixed(6));
    const ci=staticMode()||mobile?(state.selected===0&&shown>=.105?1:[0,2,3,4][state.selected]):shown<.105?0:shown<.3175?1:shown<.40?2:shown<.515?5:shown<.675?3:shown<.77?6:4;
    copies.forEach((n,i)=>{set(n,'--copy-alpha',i===ci?'1':'0');n.setAttribute('aria-hidden',String(i!==ci));});
    // Match-cut between genuine screens while the camera holds the whole phone.
    // Motion supplies continuity; a paused frame always contains one complete, legible UI.
    screens.forEach((n,i)=>{
      const visible=i===state.selected&&decoded.has(n);
      n.style.opacity=visible?'1':'0';
      n.style.clipPath='none';
      n.setAttribute('aria-hidden',String(i!==state.selected));
    });
    buttons.forEach((b,i)=>b.setAttribute('aria-pressed',String(i===state.selected)));
    set(journey,'--intro',String(intro));actions.inert=p>.07;actions.setAttribute('aria-hidden',String(p>.07));
    const names=['Today','Reading completed','Journal','Insights'];
    const label=state.pending>=0?(failed.has(state.pending)?names[state.pending]+' preview could not load.':('Loading '+names[state.pending]+'…')):names[state.selected];
    if(status.textContent!==label)status.textContent=label;
    feedback.hidden=state.pending<0;retryScreen.hidden=state.pending<0||!failed.has(state.pending);
    feedbackText.textContent=label;retryScreen.dataset.screen=String(state.pending);
    feedback.classList.toggle('is-error',state.pending>=0&&failed.has(state.pending));
    const activeCopy=copies[ci];
    if((focusPending&&seekTarget===null)||copies.some((n,i)=>i!==ci&&n.contains(document.activeElement))){
      focusPending=false;const heading=activeCopy.querySelector('h2');heading.tabIndex=-1;heading.focus({preventScroll:true});
    }
    journey.dataset.screen=cfg.screens[state.selected].id;journey.dataset.progress=p.toFixed(6);journey.dataset.copy=String(ci);journey.dataset.photo=photoAlpha.toFixed(6);journey.dataset.nativePixels=(width*dpr).toFixed(2);
  }
  function schedule(){if(frame===null&&!document.hidden)frame=requestAnimationFrame(render);}
  function seek(p,animate=true,focus=false){manual=p;focusPending=focus;if(staticMode()){seekTarget=null;schedule();}else{seekTarget=journey.offsetTop+p*scrollSpan();scrollTo({top:seekTarget,behavior:animate?'smooth':'instant'});if(!animate)seekTarget=null;}}
  function interruptSeek(){if(seekTarget!==null){seekTarget=null;focusPending=false;scrollTo({top:scrollY,behavior:'instant'});}}
  ['wheel','touchstart','pointerdown'].forEach(type=>addEventListener(type,interruptSeek,{passive:true}));
  addEventListener('pointerdown',()=>document.documentElement.classList.remove('keyboard-input'),{passive:true});
  addEventListener('keydown',event=>{if(['PageDown','PageUp',' ','ArrowDown','ArrowUp'].includes(event.key))interruptSeek();});
  addEventListener('keydown',event=>{if(['Tab','Enter',' '].includes(event.key))document.documentElement.classList.add('keyboard-input');});
  function chooseScreen(button){history.replaceState(null,'','#'+cfg.screens[buttons.indexOf(button)].id);seek(+button.dataset.point);}
  buttons.forEach((button,i)=>{button.addEventListener('click',()=>chooseScreen(button));button.addEventListener('keydown',event=>{const targets={Home:0,End:buttons.length-1,ArrowRight:(i+1)%buttons.length,ArrowLeft:(i+buttons.length-1)%buttons.length};if(event.key in targets){event.preventDefault();const b=buttons[targets[event.key]];b.focus({preventScroll:true});chooseScreen(b);}});});
  function showAvailability(animate=true){
    const availability=document.getElementById('download');
    availability.open=true;availability.scrollIntoView({behavior:animate&&!reduced()?'smooth':'instant',block:'start'});
    availability.querySelector('summary').focus({preventScroll:true});
  }
  document.querySelectorAll('a[href^="#"]').forEach(link=>link.addEventListener('click',event=>{const hash=link.getAttribute('href'),a=anchors.find(a=>'#'+a.id===hash);document.querySelector('.mobile-menu').open=false;if(hash==='#download'){event.preventDefault();history.pushState(null,'',hash);showAvailability();}else if(a||hash==='#hero'||hash==='#top'){event.preventDefault();history.pushState(null,'',hash);seek(a?+a.dataset.at:0,true,true);if(staticMode())journey.scrollIntoView({behavior:'instant'});}}));
  function historySeek(){if(location.hash==='#download'){showAvailability(false);return;}const a=anchors.find(a=>'#'+a.id===location.hash);if(a||['#hero','#top'].includes(location.hash))seek(a?+a.dataset.at:0,false,true);}
  addEventListener('popstate',historySeek);addEventListener('hashchange',historySeek);
  function setupMotion(){document.documentElement.classList.toggle('motion-reduced',reduced());motion.setAttribute('aria-pressed',String(reduced()));layout();}
  motion.addEventListener('click',()=>{manual=current;userReduce=!reduced();setupMotion();if(!staticMode())seek(manual,false);});
  preference.addEventListener('change',()=>{manual=current;setupMotion();});shortWindow.addEventListener('change',()=>{manual=current;layout();});narrowPortrait.addEventListener('change',()=>{manual=current;layout();});
  function resizeLayout(){if(pin.clientWidth!==lastWidth||pin.clientHeight!==lastHeight)layout();else schedule();}
  addEventListener('scroll',schedule,{passive:true});addEventListener('resize',resizeLayout);
  addEventListener('pageshow',event=>{
    layout();
    // Reloads resolve a chapter after Safari's own scroll restoration. Back/forward keeps its saved position.
    const navigation=performance.getEntriesByType('navigation')[0];
    if(!event.persisted&&navigation?.type!=='back_forward'&&location.hash)requestAnimationFrame(()=>requestAnimationFrame(historySeek));
  });
  document.addEventListener('visibilitychange',schedule);
  addEventListener('pagehide',()=>{if(frame!==null)cancelAnimationFrame(frame);frame=null;});
  function watchImage(image,index){
    async function decode(){try{await image.decode();decoded.add(image);if(index>=0)failed.delete(index);}catch{if(index>=0)failed.add(index);}schedule();}
    image.addEventListener('load',decode);image.addEventListener('error',()=>{decoded.delete(image);if(index>=0)failed.add(index);schedule();});
    if(image.complete&&image.naturalWidth)decode();else if(image.complete&&index>=0)failed.add(index);
  }
  screens.forEach(watchImage);watchImage(heroImage,-1);
  function reloadImage(image){const url=new URL(image.src);url.searchParams.set('preview_retry',String(++retryCount));decoded.delete(image);image.loading='eager';image.src=url.href;}
  retryScreen.addEventListener('click',()=>{const index=Number(retryScreen.dataset.screen);if(index<0)return;failed.delete(index);reloadImage(screens[index]);if(heroImage.complete&&!heroImage.naturalWidth)reloadImage(heroImage);buttons[index].focus({preventScroll:true});schedule();});
  const appearanceCard=document.querySelector('.appearance-card');
  const appearanceImages=[document.getElementById('appearance-image'),document.getElementById('appearance-dark')];
  let appearanceRequest=0;
  const appearanceStatus=document.getElementById('appearance-status'),appearanceRetry=document.getElementById('appearance-retry');
  let appearanceButton=document.querySelector('[data-appearance="light"]');
  async function showAppearance(button,retry=false){
    const request=++appearanceRequest,dark=button.dataset.appearance==='dark';
    const retryFocused=document.activeElement===appearanceRetry;
    appearanceButton=button;appearanceImages[dark?1:0].loading='eager';
    if(retry)reloadImage(appearanceImages[dark?1:0]);
    appearanceStatus.className='preview-status';appearanceRetry.hidden=true;
    appearanceStatus.textContent=`Loading ${dark?'dark':'light'} appearance`;
    try{await appearanceImages[dark?1:0].decode();}catch{if(request===appearanceRequest){appearanceStatus.textContent='Preview could not load.';appearanceStatus.classList.add('is-error');appearanceRetry.hidden=false;}return;}
    if(request!==appearanceRequest)return;
    appearanceCard.classList.toggle('is-dark',dark);
    appearanceImages.forEach((image,index)=>image.setAttribute('aria-hidden',String(index!==(dark?1:0))));
    document.querySelectorAll('[data-appearance]').forEach(other=>other.setAttribute('aria-pressed',String(other===button)));
    appearanceStatus.textContent=`${dark?'Dark':'Light'} appearance selected`;appearanceStatus.className='sr-only';
    if(retryFocused)button.focus({preventScroll:true});
  }
  document.querySelectorAll('[data-appearance]').forEach(button=>button.addEventListener('click',()=>showAppearance(button)));
  appearanceRetry.addEventListener('click',()=>showAppearance(appearanceButton,true));
  const detailTrack=document.getElementById('detail-track'),detailPrev=document.getElementById('detail-prev'),detailNext=document.getElementById('detail-next');
  const detailCards=[...document.querySelectorAll('.detail-card')];
  let detailFrame=null,detailIndex=0,requestedDetail=null;
  function detailPositions(){
    const max=Math.max(0,detailTrack.scrollWidth-detailTrack.clientWidth);
    const start=detailCards[0].offsetLeft;
    return detailCards.map(card=>Math.min(max,card.offsetLeft-start));
  }
  function detailControls(index){
    document.getElementById('detail-position').textContent=`${String(index+1).padStart(2,'0')} / ${String(detailCards.length).padStart(2,'0')}`;
    detailPrev.disabled=index===0;detailNext.disabled=index===detailCards.length-1;
  }
  function detailSelection(){
    detailFrame=null;
    const positions=detailPositions(),left=detailTrack.scrollLeft;
    const nearest=positions.reduce((best,value,index)=>Math.abs(value-left)<Math.abs(positions[best]-left)?index:best,0);
    if(requestedDetail!==null&&Math.abs(left-positions[requestedDetail])<2)requestedDetail=null;
    if(requestedDetail===null)detailIndex=nearest;
    detailControls(requestedDetail??detailIndex);
  }
  function selectDetail(index){
    requestedDetail=Math.max(0,Math.min(detailCards.length-1,index));
    detailControls(requestedDetail);
    detailTrack.scrollTo({left:detailPositions()[requestedDetail],behavior:reduced()?'auto':'smooth'});
  }
  detailPrev.addEventListener('click',()=>selectDetail((requestedDetail??detailIndex)-1));
  detailNext.addEventListener('click',()=>selectDetail((requestedDetail??detailIndex)+1));
  detailTrack.addEventListener('scroll',()=>{if(detailFrame===null&&!document.hidden)detailFrame=requestAnimationFrame(detailSelection);},{passive:true});
  ['pointerdown','wheel'].forEach(event=>detailTrack.addEventListener(event,()=>{requestedDetail=null;},{passive:true}));
  detailTrack.addEventListener('keydown',event=>{
    if(event.target!==detailTrack)return;
    const index=requestedDetail??detailIndex;
    const targets={Home:0,End:detailCards.length-1,ArrowLeft:index-1,ArrowRight:index+1};
    if(event.key in targets){event.preventDefault();selectDetail(targets[event.key]);}
  });
  function renderDetails(){
    document.querySelectorAll('.trust-scene,.studio-finale').forEach(section=>{const r=section.getBoundingClientRect();if(r.top>=innerHeight||r.bottom<=0)return;set(section,'--arrival',String(reduced()?1:smooth(clamp((innerHeight-r.top)/(innerHeight*.65)))));});
    detailCards.forEach(card=>{
      const rect=card.getBoundingClientRect();
      if(reduced()){card.style.setProperty('--detail-arrival','1');return;}
      if(rect.top>=innerHeight||rect.bottom<=0)return;
      card.style.setProperty('--detail-arrival',smooth(clamp((innerHeight-rect.top)/(innerHeight*.65))).toFixed(4));
    });
  }
  addEventListener('resize',()=>{requestedDetail=null;detailSelection();});detailSelection();
  addEventListener('pagehide',()=>{if(detailFrame!==null)cancelAnimationFrame(detailFrame);detailFrame=null;});
  const menu=document.querySelector('.mobile-menu');menu.querySelectorAll('a').forEach(link=>link.addEventListener('click',()=>{menu.open=false;}));
  menu.addEventListener('keydown',event=>{if(event.key==='Escape'&&menu.open){menu.open=false;menu.querySelector('summary').focus();}});

  // Fit unmodified native PNGs to photographic displays. No generated UI or pixel repainting.
  function projective(w,h,quad){
    const corners=[[0,0],[w,0],[w,h],[0,h]],rows=[];
    for(let i=0;i<4;i++){const [x,y]=corners[i],[u,v]=quad[i];rows.push([x,y,1,0,0,0,-u*x,-u*y,u],[0,0,0,x,y,1,-v*x,-v*y,v]);}
    for(let c=0;c<8;c++){let pivot=c;for(let r=c+1;r<8;r++)if(Math.abs(rows[r][c])>Math.abs(rows[pivot][c]))pivot=r;[rows[c],rows[pivot]]=[rows[pivot],rows[c]];const d=rows[c][c];if(Math.abs(d)<1e-10)return null;for(let k=c;k<9;k++)rows[c][k]/=d;for(let r=0;r<8;r++)if(r!==c){const f=rows[r][c];for(let k=c;k<9;k++)rows[r][k]-=f*rows[c][k];}}
    const [a,b,c,d,e,f,g,hp]=rows.map(r=>r[8]);return [a,d,0,g,b,e,0,hp,0,0,1,0,c,f,0,1];
  }
  document.querySelectorAll('.photo-world').forEach(world=>{
    const plate=world.querySelector('.photo-plate'),ui=world.querySelector('.photo-ui'),quad=JSON.parse(world.dataset.quad);
    function fit(){
      const viewport=world.parentElement;
      world.style.width=Math.max(viewport.clientWidth,viewport.clientHeight*1.5)+'px';
      if(!plate.complete||!plate.naturalWidth||!ui.complete||!ui.naturalWidth)return;
      const scale=world.clientWidth/1536;
      const center=[quad.reduce((n,p)=>n+p[0],0)/4,quad.reduce((n,p)=>n+p[1],0)/4];
      // Corners are measured on the glass, not on the outside of the phone.
      // Only cover the antialiased chroma edge; a generic expansion crosses the bezel.
      const overscan=Number(world.dataset.overscan||0);
      const q=quad.map(([x,y])=>{
        const dx=x-center[0],dy=y-center[1],len=Math.hypot(dx,dy);
        return [(x+dx/len*overscan)*scale,(y+dy/len*overscan)*scale];
      });
      const width=(Math.hypot(q[1][0]-q[0][0],q[1][1]-q[0][1])+Math.hypot(q[2][0]-q[3][0],q[2][1]-q[3][1]))/2;
      const height=width*ui.naturalHeight/ui.naturalWidth;
      ui.style.setProperty('--photo-screen-width',width+'px');
      ui.style.setProperty('--photo-screen-height',height+'px');
      ui.style.setProperty('--photo-source-scale',scale);
      const m=projective(width,height,q);
      if(!m)return;
      ui.style.transform='matrix3d('+m.join(',')+')';
      world.classList.add('is-composited');
    }
    plate.addEventListener('load',fit);ui.addEventListener('load',fit);new ResizeObserver(fit).observe(world.parentElement);fit();
  });
  if(document.fonts)document.fonts.ready.then(layout);
  const copySizer=new ResizeObserver(layout);copies.forEach(copy=>copySizer.observe(copy));
  setupMotion();
})();
