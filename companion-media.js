(() => {
  const art=window.DUSK_ART, jobs=new Map(), ready=new Map(), last={};
  const praiseKey=appStorageKey('dusk-praise-chance-v1');
  const angerLines=['哼，心思又飘到画外了？','下笔倒快，看清了么？','这笔画歪了，再看一眼。','别急着落笔，先看清楚。','啧，又把两个意思弄混了。','眼睛在这儿，心思呢？','收收神，这个词还没画好。','哼，重来。这次认真些。'];
  const praiseLines=['嗯，这一笔还算漂亮。','记得不错，倒没白费功夫。','今天这幅画，有点样子了。','哼，看来你确实用心了。','这一回，准你得意一下。','不错。下一笔也稳着些。'];
  function pickRandom(items,key,rng=Math.random){
    const pool=items.filter(x=>x!==last[key]);
    const result=(pool.length?pool:items)[Math.floor(rng()*(pool.length||items.length))];
    last[key]=result;return result;
  }
  function prepare(src){
    if(ready.has(src))return Promise.resolve(ready.get(src));
    if(jobs.has(src))return jobs.get(src);
    const job=new Promise(resolve=>{
      const img=new Image();img.decoding='async';img.fetchPriority='low';let finished=false;
      const finish=value=>{if(finished)return;finished=true;clearTimeout(timeout);img.onload=img.onerror=null;if(value)ready.set(src,value);jobs.delete(src);resolve(value);};
      const timeout=setTimeout(()=>finish(null),5000);
      img.onload=async()=>{try{await img.decode();finish(img);}catch{finish(null);}};
      img.onerror=()=>finish(null);img.src=src;
    });jobs.set(src,job);return job;
  }
  async function scene(kind){
    const source=pickRandom(art[kind],kind);
    // Exhaust the local pool on a bad resource; never start a blank timed scene.
    for(const src of [source,...art[kind].filter(x=>x!==source),'assets/dusk-sword.webp']){
      const img=await prepare(src);if(img)return img;
    }
    return null;
  }
  function nextPraise(chance,roll){
    const hit=roll<chance/100;
    return {hit,chance:hit?15:Math.min(100,chance+10)};
  }
  function drawPraise(){
    let chance;try{chance=Number(localStorage.getItem(praiseKey));}catch{}
    if(!Number.isInteger(chance)||chance<15||chance>100)chance=15;
    const result=nextPraise(chance,Math.random());
    try{localStorage.setItem(praiseKey,String(result.chance));}catch{}
    return result.hit;
  }
  // Warm decoded feedback images one at a time, after the visible scene has started loading.
  function warm(){
    const queue=[...art.anger,...art.praise];
    const step=async()=>{if(document.hidden){setTimeout(step,2000);return;}const src=queue.shift();if(!src)return;await prepare(src);setTimeout(step,150);};
    setTimeout(step,1500);
    navigator.storage?.persist?.().catch(()=>{});
    const cacheMedia=()=>navigator.serviceWorker?.controller?.postMessage({type:'WARM_MEDIA'});
    navigator.serviceWorker?.ready.then(()=>{setTimeout(cacheMedia,2500);}).catch(()=>{});
    navigator.serviceWorker?.addEventListener('controllerchange',()=>setTimeout(cacheMedia,2500));
  }
  window.DuskMedia={art,prepare,scene,pickRandom,nextPraise,drawPraise,line:kind=>pickRandom(kind==='anger'?angerLines:praiseLines,kind+'-line')};
  warm();
})();
