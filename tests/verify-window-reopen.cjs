const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path');
const {chromium}=require(path.resolve(__dirname,'../../方案预览/.tools/node_modules/playwright'));
const {buildRelease}=require('../build-release.cjs');
const editions={personal:buildRelease('personal'),share:buildRelease('share')};
const fixture={selectedCourses:[{name:'Test',teacher:'Test',room:'T101',day:0,periods:[1,2],weeks:[[1,17]],type:'major'}],
  days:Array.from({length:7},(_,i)=>({name:'Day '+i,date:'',line:'Test',tasks:[]})),checked:{},englishProgress:{},englishStart:'2026-09-18',appointments:[],englishAdjustments:[],changedAt:1};
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.json':'application/json','.webmanifest':'application/manifest+json'};
(async()=>{
  const server=http.createServer((req,res)=>{
    const parts=new URL(req.url,'http://localhost').pathname.slice(1).split('/'),files=editions[parts.shift()],name=parts.join('/')||'index.html';
    if(!files?.[name])return res.writeHead(404).end();
    res.setHeader('Content-Type',mime[path.extname(name)]||'text/plain');res.end(files[name]);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const errors=[],watchdog=setTimeout(()=>browser.close(),90000);
  try{
    for(const edition of Object.keys(editions)){
      const ctx=await browser.newContext({viewport:{width:1440,height:1000},timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
      await ctx.route('https://**',route=>route.abort());
      await ctx.addInitScript(({edition,fixture})=>{
        if(localStorage.getItem('reopen-seeded'))return;localStorage.setItem('reopen-seeded','yes');
        localStorage.setItem((edition==='share'?'dusk-demo-v1:':'')+'dusk-study-pet-full-state-v1',JSON.stringify(fixture));
        if(edition==='personal')localStorage.setItem('dusk-study-pet-access-code-v1','test-only');
      },{edition,fixture});
      const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
      await p.clock.install({time:new Date('2026-10-06T12:00:00+08:00')});
      const ready=()=>p.waitForFunction(()=>days.length===7&&!restoringResume&&document.querySelectorAll('.window-resize').length===24);
      await p.goto('http://127.0.0.1:'+server.address().port+'/'+edition+'/',{waitUntil:'domcontentloaded'});await ready();
      await p.waitForFunction(()=>document.querySelector('.pet-img').naturalWidth>0);
      const selectors={study:'main.atelier-window',pet:'aside.atelier-window',planner:'.atelier-planner'};
      const defaults={};for(const [id,selector]of Object.entries(selectors))defaults[id]=await p.locator(selector).boundingBox();
      const before=await p.evaluate(()=>JSON.stringify(snapshot()));
      async function enlarge(id){
        await p.locator(selectors[id]).evaluate((el,id)=>{
          el.dispatchEvent(new PointerEvent('pointerdown',{bubbles:true}));
          Object.assign(el.style,{left:id==='study'?'400px':'80px',top:'80px',width:id==='study'?'650px':'560px',height:'650px'});
        },id);
      }
      for(const [id,selector]of Object.entries(selectors)){
        await enlarge(id);
        await p.locator(selector+' [data-window-min]').click();
        assert(!await p.locator(selector).isVisible());
        if(id==='study')await p.locator('.atelier-nav [data-atelier-view="scheduleView"]').click();
        else await p.locator('#atelierPetRestore').click();
        const actual=await p.locator(selector).boundingBox();
        assert(Math.abs(actual.width-defaults[id].width)<1,id+' default width');
        assert(Math.abs(actual.height-defaults[id].height)<1,id+' default height');
        assert.equal(actual.x,id==='study'?400:80,'keep dragged position');
        assert.equal(actual.y,Math.max(55,Math.min(80,1000-80-defaults[id].height)),'keep position within visible bounds');
      }
      // Ordinary tab switches do not reset an open window.
      await enlarge('study');await p.locator('.atelier-nav [data-atelier-view="englishView"]').click();
      assert.equal((await p.locator(selectors.study).boundingBox()).width,650);
      await p.locator('main [data-window-max]').click();await p.locator('main [data-window-min]').click();
      await p.locator('.atelier-nav [data-atelier-view="homeView"]').click();
      assert(!await p.locator(selectors.study).evaluate(el=>el.classList.contains('maximized')));
      assert.equal((await p.locator(selectors.study).boundingBox()).width,defaults.study.width);
      // The small-window toggle and a restart after minimizing obey the same rule.
      await enlarge('study');await enlarge('planner');await p.locator('#atelierPetRestore').click();await p.locator('#modeBtn').click();
      assert(!await p.locator(selectors.study).isVisible());await p.locator('#modeBtn').click();
      assert.equal((await p.locator(selectors.study).boundingBox()).width,defaults.study.width);
      assert.equal((await p.locator(selectors.planner).boundingBox()).width,defaults.planner.width);
      await enlarge('pet');await p.locator('aside [data-window-min]').click();
      await p.reload({waitUntil:'domcontentloaded'});await ready();
      assert.equal((await p.locator(selectors.pet).boundingBox()).width,defaults.pet.width);
      assert.equal((await p.locator(selectors.pet).boundingBox()).height,defaults.pet.height);
      let previousHeight=0;
      for(const width of [265,560,800]){
        await enlarge('pet');await p.locator(selectors.pet).evaluate((el,width)=>el.style.width=width+'px',width);
        const frame=await p.locator('aside .pet-frame').boundingBox(),img=await p.locator('aside .pet-img').boundingBox();
        assert(Math.abs(frame.width/frame.height-4/3)<.01,'constant portrait frame aspect');
        assert(frame.height>previousHeight,'portrait grows vertically with width');previousHeight=frame.height;
        assert(Math.abs(img.height-(frame.height-10))<1,'image fills proportional frame');
        assert.equal(await p.locator('aside .pet-img').evaluate(el=>getComputedStyle(el).objectFit),'cover','image pixels must not stretch');
        await p.screenshot({path:path.resolve(__dirname,'../../方案预览/窗口重开-夕-'+width+'-'+edition+'.png')});
      }
      assert(previousHeight>250,'no fixed portrait height cap');
      assert.equal(await p.evaluate(()=>JSON.stringify(snapshot())),before,'window controls do not edit study data');
      for(const width of [900,390,760,1440]){
        await p.setViewportSize({width,height:900});
        if(width<=760){assert(!await p.locator('aside .window-resize').first().isVisible());assert.equal((await p.locator('aside .pet-frame').boundingBox()).width>100,true);}
      }
      await ctx.close();console.log('PASS '+edition+': minimize/reopen default size, position, tab-switch retention, maximized/small-window/restart, proportional portrait, mobile and unchanged study data');
    }
    assert.deepEqual(errors,[]);
  }finally{clearTimeout(watchdog);await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
