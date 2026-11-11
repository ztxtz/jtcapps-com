/* Deterministic timeline shared by the browser and behavior tests. No app-specific coordinates. */
(function (root) {
  'use strict';
  const clamp = x => Math.max(0, Math.min(1, x));
  const smooth = x => { x=clamp(x); return x*x*(3-2*x); };
  const mix = (a,b,t) => a+(b-a)*t;
  function camera(keys,p) {
    let right=keys.findIndex(k=>k.at>p); if(right<0)right=keys.length-1;
    const a=keys[Math.max(0,right-1)],b=keys[right],t=smooth((p-a.at)/Math.max(.00001,b.at-a.at));
    const box=k=>k.highlight||{x:0,y:0,w:1,h:1,strength:0};
    const ah=box(a),bh=box(b),highlight={};
    for(const key of ['x','y','w','h','strength']) highlight[key]=mix(ah[key]??.9,bh[key]??.9,t);
    return {zoom:mix(a.zoom,b.zoom,t),focus:mix(a.focus_y,b.focus_y,t),rotation:mix(a.rotation||0,b.rotation||0,t),highlight};
  }
  function sample(cfg,raw,ready) {
    const p=clamp(raw); let requested=0,shown=p;
    cfg.screens.forEach((s,i)=>{if(p>=s.at)requested=i;});
    const pending=ready[requested]?-1:requested;
    if(pending>=0)shown=Math.max(0,cfg.screens[pending].at-.000001);
    const opacity=cfg.screens.map((s,i)=>i===0?(ready[0]?1:0):(ready[i]?smooth((shown-s.at)/Math.max(.00001,s.fade)):0));
    let selected=0;for(let i=1;i<opacity.length;i++)if(opacity[i]>=.5)selected=i;
    let copy=0;
    const alphas=cfg.beats.map((beat,i)=>{
      const prev=i? (cfg.beats[i-1].at+beat.at)/2:0;
      const next=i<cfg.beats.length-1?(beat.at+cfg.beats[i+1].at)/2:1;
      const fade=Math.min(.025,(next-prev)/3);
      // Finish fading the previous copy before revealing the next; never stack two readable headlines.
      const a=(i?smooth((shown-prev)/fade):1)*(i<cfg.beats.length-1?1-smooth((shown-next+fade)/fade):1);
      return a;
    });
    for(let i=1;i<alphas.length;i++)if(alphas[i]>alphas[copy])copy=i;
    return {p:shown,selected,pending,opacity,copy,alphas,camera:camera(cfg.camera,shown)};
  }
  function nearest(positions,left) {return positions.reduce((best,x,i)=>Math.abs(x-left)<Math.abs(positions[best]-left)?i:best,0);}
  const api={clamp,smooth,mix,camera,sample,nearest};
  if(typeof module!=='undefined'&&module.exports)module.exports=api;
  root.StoryTimeline=api;
})(typeof globalThis==='undefined'?this:globalThis);
