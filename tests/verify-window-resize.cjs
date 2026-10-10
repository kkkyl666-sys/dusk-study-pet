const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(path.resolve(__dirname,'../../方案预览/.tools/node_modules/playwright'));
const {buildRelease}=require('../build-release.cjs');
const files=buildRelease('personal');
const fixture={selectedCourses:[{name:'课程排版测试：信号与系统',teacher:'测试教师',room:'测试教学楼C102',day:1,periods:[1,2],weeks:[[1,17]],type:'major'}],
  days:Array.from({length:7},(_,i)=>({name:'星期'+i,date:'',line:'测试',tasks:[['19:00-20:00 长日程文字排版与滚动测试','英语','不应被截断的说明',null,'test-task-'+i]]})),
  checked:{},englishProgress:{},englishStart:'2026-09-18',appointments:[],englishAdjustments:[],changedAt:1};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.webmanifest':'application/manifest+json','.json':'application/json'};
(async()=>{
  let slowFull=true,failFull=false,requests=[];
  const server=http.createServer((req,res)=>{
    const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';requests.push(name);
    const send=()=>{if(!files[name])return res.writeHead(404).end();res.setHeader('Content-Type',mime[path.extname(name)]||'text/plain');res.end(files[name]);};
    if(/concept\.webp$/.test(name)) {
      if(failFull)return res.writeHead(503).end();
      if(slowFull){const timer=setTimeout(send,4000);res.on('close',()=>clearTimeout(timer));return;}
    }
    send();
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const url='http://127.0.0.1:'+server.address().port+'/';
  const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[];
  const watchdog=setTimeout(()=>{console.error('Test watchdog');browser.close();},90000);
  async function context(serviceWorkers='block') {
    const ctx=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai',serviceWorkers});
    await ctx.route('https://**',route=>route.abort());
    await ctx.addInitScript(data=>{
      if(localStorage.getItem('resize-seeded'))return;localStorage.setItem('resize-seeded','yes');
      localStorage.setItem('dusk-study-pet-full-state-v1',JSON.stringify(data));
      localStorage.setItem('dusk-study-pet-access-code-v1','test-only');
      localStorage.setItem('dusk-atelier-ui-v1',JSON.stringify({scene:'studio'}));
    },fixture);
    return ctx;
  }
  async function ready(p){await p.waitForFunction(()=>days.length===7&&!restoringResume&&document.querySelectorAll('.window-resize').length===24);}
  const shot=name=>path.resolve(__dirname,'../../方案预览/'+name+'.png');
  try {
    const ctx=await context(),p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto(url,{waitUntil:'domcontentloaded'});await ready(p);
    await p.waitForFunction(()=>document.querySelector('#atelierScene').naturalWidth>0&&document.querySelector('#atelierScene').dataset.quality==='preview',null,{timeout:2500});
    assert(!requests.some(n=>/concept\.png$/.test(n)));
    await p.waitForFunction(()=>document.querySelector('#atelierScene').dataset.quality==='full');
    await p.waitForFunction(()=>document.querySelector('.pet-img').naturalWidth>0);
    await p.locator('#atelierSettings').click();await p.locator('#atelierSceneSelect').selectOption('custom');
    await p.waitForFunction(()=>document.querySelector('#atelierScene').naturalWidth>0);
    await p.locator('#atelierWallpaperFile').setInputFiles({name:'test-scene.webp',mimeType:'image/webp',buffer:files['assets/wallpapers/dusk-realm-concept.webp']});
    await p.waitForFunction(()=>document.querySelector('#atelierScene').src.startsWith('blob:'));
    await p.locator('#atelierSceneSelect').selectOption('studio');await p.locator('#atelierSettingsClose').click();
    await p.waitForFunction(()=>document.querySelector('#atelierScene').dataset.quality==='full');
    const state=await p.evaluate(()=>localStorage.getItem('dusk-study-pet-full-state-v1'));
    for(const [selector,w,h] of [['main.atelier-window',780,600],['aside.atelier-window',320,440],['.atelier-planner',340,360]]) {
      for(const edge of ['n','s','e','w','nw','ne','sw','se']) {
        await p.evaluate(({selector,w,h})=>{const el=document.querySelector(selector);el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));Object.assign(el.style,{left:'350px',top:'180px',width:w+'px',height:h+'px'});},{selector,w,h});
        const before=await p.locator(selector).boundingBox(),handle=p.locator(selector+' [data-resize-edge='+edge+']'),box=await handle.boundingBox();
        const dx=edge.includes('w')?-35:edge.includes('e')?35:0,dy=edge.includes('n')?-25:edge.includes('s')?25:0;
        await p.mouse.move(box.x+box.width/2,box.y+box.height/2);await p.mouse.down();await p.mouse.move(box.x+box.width/2+dx,box.y+box.height/2+dy,{steps:5});await p.mouse.up();
        const after=await p.locator(selector).boundingBox();
        assert(Math.abs(after.width-before.width-Math.abs(dx))<2,selector+' width '+edge);
        assert(Math.abs(after.height-before.height-Math.abs(dy))<2,selector+' height '+edge);
        if(edge.includes('w'))assert(Math.abs(after.x-before.x-dx)<2);
        if(edge.includes('n'))assert(Math.abs(after.y-before.y-dy)<2);
      }
    }
    assert.equal(await p.evaluate(()=>localStorage.getItem('dusk-study-pet-full-state-v1')),state,'resizing cannot modify study records');
    for(const [selector,minWidth,minHeight] of [['main.atelier-window',380,220],['aside.atelier-window',210,275],['.atelier-planner',230,180]]) {
      await p.evaluate(selector=>{const el=document.querySelector(selector);el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));Object.assign(el.style,{left:'350px',top:'180px',width:'500px',height:'500px'});},selector);
      const corner=await p.locator(selector+' [data-resize-edge=se]').boundingBox();
      await p.mouse.move(corner.x+5,corner.y+5);await p.mouse.down();await p.mouse.move(360,190,{steps:8});await p.mouse.up();
      const small=await p.locator(selector).boundingBox();assert(Math.abs(small.width-minWidth)<2);assert(Math.abs(small.height-minHeight)<2);
      const body=selector.startsWith('main')?'.atelier-main-content':selector.startsWith('aside')?'.atelier-pet-content':'.planner-body';
      const title=await p.locator(selector+' .atelier-titlebar').boundingBox();
      await p.locator(selector+' '+body).evaluate(el=>el.scrollTop=1000);
      const fixed=await p.locator(selector+' .atelier-titlebar').boundingBox();assert.equal(title.y,fixed.y);
    }
    await p.evaluate(()=>{
      Object.assign(document.querySelector('aside.atelier-window').style,{left:'60px',top:'68px',width:'290px',height:'400px'});
      Object.assign(document.querySelector('.atelier-planner').style,{left:'65px',top:'510px',width:'330px',height:'350px'});
      document.querySelector('main.atelier-window').dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
    });
    await p.locator('.atelier-nav [data-atelier-view=englishView]').click();
    await p.locator('button[data-word-layout="list"]').click();
    const setWidth=width=>p.evaluate(width=>{const el=document.querySelector('main.atelier-window');Object.assign(el.style,{left:'500px',top:'66px',width:width+'px',height:'650px'});},width);
    const columns=()=>p.locator('#newWords').evaluate(el=>getComputedStyle(el).gridTemplateColumns.split(' ').length);
    await setWidth(780);assert.equal(await columns(),2);
    await setWidth(640);assert.equal(await columns(),1);
    await setWidth(780);assert.equal(await columns(),2);
    await p.screenshot({path:shot('窗口缩放-宽画夹')});
    await setWidth(380);assert.equal(await columns(),1);
    assert(await p.locator('.atelier-main-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'narrow words overflow');
    assert.equal(await p.locator('#newWords .word-card:visible').count(),10);
    const sound=await p.locator('#newWords .word-card:visible .sound-button').first().boundingBox();assert(sound.width>=36);
    await p.screenshot({path:shot('窗口缩放-窄画夹')});
    await p.locator('.atelier-nav [data-atelier-view=scheduleView]').click();
    assert(await p.locator('.daily-schedule').isVisible());assert(!await p.locator('.schedule-scroll').isVisible());
    await p.locator('[data-schedule-mode=week]').click();assert(await p.locator('.schedule-scroll').isVisible());
    assert(await p.locator('.atelier-main-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'schedule overflow outside its own scroller');
    await p.locator('.atelier-nav [data-atelier-view=editView]').click();
    await p.locator('.editor-card').first().locator('summary').click();
    assert(await p.locator('.atelier-main-content').evaluate(el=>el.scrollWidth<=el.clientWidth+1),'narrow editor overflow');
    await p.screenshot({path:shot('窗口缩放-窄编辑')});
    const handle=p.locator('main.atelier-window [data-resize-edge=e]');await handle.focus();await p.keyboard.press('Shift+ArrowRight');
    const saved=await p.locator('main.atelier-window').boundingBox();
    await p.reload({waitUntil:'domcontentloaded'});await ready(p);
    const restored=await p.locator('main.atelier-window').boundingBox();assert(Math.abs(saved.width-restored.width)<2);assert(Math.abs(saved.height-restored.height)<2);
    await p.locator('main [data-window-max]').click();assert(!await handle.isVisible());await p.locator('main [data-window-max]').click();
    await p.setViewportSize({width:900,height:600});
    await p.waitForFunction(()=>[...document.querySelectorAll('.atelier-window')].every(el=>{const r=el.getBoundingClientRect();return r.right<=innerWidth-7&&r.bottom<=innerHeight-79;}));
    for(const selector of ['main.atelier-window','aside.atelier-window','.atelier-planner']) {
      const box=await p.locator(selector).boundingBox();assert(box.x>=7&&box.y>=54&&box.x+box.width<=893&&box.y+box.height<=521,'window stays usable on a shorter screen: '+selector+' '+JSON.stringify(box));
    }
    await p.setViewportSize({width:1440,height:1000});
    failFull=true;await p.reload({waitUntil:'domcontentloaded'});await ready(p);await p.waitForFunction(()=>document.querySelector('#atelierScene').naturalWidth>0);
    assert.equal(await p.locator('#atelierScene').getAttribute('data-quality'),'preview');
    for(const width of [320,390,760]) {
      const marker=requests.length;await p.setViewportSize({width,height:844});await p.reload({waitUntil:'domcontentloaded'});await ready(p);
      await p.waitForFunction(()=>document.querySelector('#atelierMobileScene').naturalWidth>0);
      assert.equal(await p.locator('#atelierMobileScene').getAttribute('data-quality'),'preview','failed full wallpaper keeps compact fallback');
      assert.equal(await p.locator('.window-resize:visible').count(),0);
      assert(await p.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+1));
    }
    await p.setViewportSize({width:390,height:844});await p.screenshot({path:shot('窗口缩放-手机保持')});await ctx.close();
    slowFull=false;failFull=false;
    const cached=await context('allow'),warm=await cached.newPage();warm.on('pageerror',e=>errors.push(e.message));
    await warm.goto(url);await ready(warm);await warm.evaluate(()=>navigator.serviceWorker.ready);await warm.waitForFunction(()=>navigator.serviceWorker.controller);
    await warm.waitForFunction(async()=>{const keys=await caches.keys();return (await caches.open(keys.find(k=>k.startsWith('dusk-personal-')))).match('assets/wallpapers/dusk-studio-concept.webp');});
    slowFull=true;failFull=true;const marker=requests.length;
    await warm.reload({waitUntil:'domcontentloaded'});await ready(warm);await warm.waitForFunction(()=>document.querySelector('#atelierScene').dataset.quality==='full',null,{timeout:2500});
    assert(!requests.slice(marker).some(n=>/\.(webp|woff2)$/.test(n)),'warm images/fonts must come straight from current cache');
    const oldName=await warm.evaluate(async()=> (await caches.keys()).find(k=>k.startsWith('dusk-personal-')));
    const nextName=oldName+'-upgrade-test';
    // An image of the wrong scene has a valid MIME type but must not survive the checksum test.
    await warm.evaluate(async name=>{const cache=await caches.open(name),studio=await cache.match('assets/wallpapers/dusk-studio-concept.webp');await cache.put('assets/wallpapers/dusk-realm-concept.webp',studio);},oldName);
    files['sw.js']=Buffer.from(files['sw.js'].toString().replace(JSON.stringify(oldName),JSON.stringify(nextName)));
    const upgradeMarker=requests.length;await warm.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r.update()));
    await warm.waitForFunction(async names=>{const keys=await caches.keys();return keys.includes(names.next)&&!keys.includes(names.old);},{next:nextName,old:oldName});
    assert(!requests.slice(upgradeMarker).includes('assets/wallpapers/dusk-studio-concept.webp'),'unchanged wallpaper should be reused during upgrade');
    const realmHash=await warm.evaluate(async name=>{
      const response=await(await caches.open(name)).match('assets/wallpapers/dusk-realm-concept.webp');if(!response)return null;
      const bytes=await crypto.subtle.digest('SHA-256',await response.arrayBuffer());return Array.from(new Uint8Array(bytes),n=>n.toString(16).padStart(2,'0')).join('');
    },nextName);
    const expectedRealm=require('node:crypto').createHash('sha256').update(files['assets/wallpapers/dusk-realm-concept.webp']).digest('hex');
    assert(realmHash===null||realmHash===expectedRealm,'upgrade must never reuse the wrong scene bytes');
    await cached.setOffline(true);await warm.reload();await ready(warm);await warm.waitForFunction(()=>document.querySelector('#atelierScene').naturalWidth>0);
    await cached.close();assert.deepEqual(errors,[]);
    console.log('PASS: fast preview/full/failure fallback, WebP assets, all 8 resize directions on 3 windows, responsive 2/1 columns, narrow words/schedule/editor, keyboard resize, persistence, maximized/mobile disabled, warm cache-first and offline. Synthetic records only.');
  } finally {clearTimeout(watchdog);await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
