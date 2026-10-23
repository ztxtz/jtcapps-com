'use strict';
const track=document.getElementById('highlight-track');
if(track){
  const cards=Array.from(track.children),prev=document.getElementById('highlight-prev'),next=document.getElementById('highlight-next'),position=document.getElementById('highlight-position');
  let index=0,frame=null,pageScrollFrame=null;
  const stopPageScroll=()=>{
    if(pageScrollFrame!==null)cancelAnimationFrame(pageScrollFrame);
    pageScrollFrame=null;
  };
  const scrollToHighlights=()=>{
    stopPageScroll();
    const section=document.getElementById('highlights');
    const margin=parseFloat(getComputedStyle(section).scrollMarginTop)||0;
    const from=scrollY,to=Math.max(0,Math.min(document.documentElement.scrollHeight-innerHeight,from+section.getBoundingClientRect().top-margin));
    if(matchMedia('(prefers-reduced-motion: reduce)').matches){scrollTo({top:to,behavior:'instant'});return;}
    const start=performance.now(),duration=900;
    const step=now=>{
      const progress=Math.min(1,(now-start)/duration);
      const eased=progress<.5?4*progress**3:1-(-2*progress+2)**3/2;
      scrollTo({top:from+(to-from)*eased,behavior:'instant'});
      pageScrollFrame=progress<1?requestAnimationFrame(step):null;
    };
    pageScrollFrame=requestAnimationFrame(step);
  };
  ['wheel','touchstart','pointerdown','popstate'].forEach(type=>addEventListener(type,stopPageScroll,{passive:true}));
  addEventListener('keydown',event=>{
    if(['ArrowUp','ArrowDown','PageUp','PageDown','Home','End','Escape',' '].includes(event.key))stopPageScroll();
  });
  const setExpanded=(card,expanded)=>{
    const button=card.querySelector('[data-inline-screen]'),visual=card.querySelector('.highlight-visual'),full=card.querySelector('.highlight-native-view');
    const overview=visual.firstElementChild;
    card.classList.toggle('is-expanded',expanded);full.hidden=!expanded;overview.hidden=expanded;
    button.setAttribute('aria-expanded',String(expanded));button.textContent=expanded?'×':'+';
    button.setAttribute('aria-label',`${expanded?'Close full':'View full'} ${full.querySelector('img').alt.split(',')[0].replace('Unfeast ','')} screen`);
  };
  const collapseAll=()=>cards.forEach(card=>setExpanded(card,false));
  const update=()=>{
    const target=track.scrollLeft+track.clientWidth/2;
    const oldIndex=index;
    index=cards.reduce((best,card,i)=>Math.abs(card.offsetLeft-track.offsetLeft+card.offsetWidth/2-target)<Math.abs(cards[best].offsetLeft-track.offsetLeft+cards[best].offsetWidth/2-target)?i:best,0);
    if(index!==oldIndex)cards.forEach((card,i)=>{if(i!==index)setExpanded(card,false)});
    prev.disabled=index===0;next.disabled=index===cards.length-1;position.textContent=`${String(index+1).padStart(2,'0')} / ${String(cards.length).padStart(2,'0')}`;frame=null;
  };
  const goTo=(target,instant=false)=>{
    collapseAll();target=Math.max(0,Math.min(cards.length-1,target));
    const left=cards[target].offsetLeft-track.offsetLeft-(track.clientWidth-cards[target].offsetWidth)/2;
    track.scrollTo({left,behavior:instant||matchMedia('(prefers-reduced-motion: reduce)').matches?'instant':'smooth'});
    if(instant)update();
  };
  track.addEventListener('keydown',event=>{
    if(event.key==='Escape'){
      const expanded=cards.find(card=>card.classList.contains('is-expanded'));
      if(expanded){event.preventDefault();setExpanded(expanded,false);expanded.querySelector('[data-inline-screen]').focus({preventScroll:true})}
      return;
    }
    if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
    if(event.target!==track&&!event.target.closest('[data-inline-screen]'))return;
    event.preventDefault();
    const target=event.key==='Home'?0:event.key==='End'?cards.length-1:index+(event.key==='ArrowRight'?1:-1);
    goTo(target,true);
  });
  prev.addEventListener('click',()=>goTo(index-1));next.addEventListener('click',()=>goTo(index+1));
  document.querySelectorAll('[data-highlight]').forEach(link=>link.addEventListener('click',event=>{
    if(event.defaultPrevented||event.button!==0||event.metaKey||event.ctrlKey||event.shiftKey||event.altKey)return;
    event.preventDefault();
    // Select the horizontal card first, then animate only the page scroll.
    goTo(Number(link.dataset.highlight),true);
    if(location.hash!==link.hash)history.pushState(null,'',link.hash);
    scrollToHighlights();
  }));
  cards.forEach(card=>{
    const button=card.querySelector('[data-inline-screen]');
    button.addEventListener('click',()=>{const expanded=button.getAttribute('aria-expanded')!=='true';collapseAll();setExpanded(card,expanded)});
  });
  track.addEventListener('scroll',()=>{if(frame===null)frame=requestAnimationFrame(update)},{passive:true});
  addEventListener('resize',update);update();
}
const hero=document.querySelector('.studio-hero'),product=document.querySelector('.hero-product-button');
if(hero&&product){
  const reduce=matchMedia('(prefers-reduced-motion: reduce)');let scheduled=false;
  const orient=()=>{scheduled=false;if(reduce.matches)return;const box=hero.getBoundingClientRect();if(box.bottom<=0||box.top>innerHeight)return;const progress=Math.max(0,Math.min(1,-box.top/(box.height*.75)));product.style.setProperty('--product-tilt',`${-10+progress*7}deg`);product.style.setProperty('--product-y',`${-progress*24}px`)};
  addEventListener('scroll',()=>{if(!scheduled&&!reduce.matches){scheduled=true;requestAnimationFrame(orient)}},{passive:true});
  reduce.addEventListener('change',()=>{if(reduce.matches){product.style.removeProperty('--product-tilt');product.style.removeProperty('--product-y')}else orient()});orient();
}
