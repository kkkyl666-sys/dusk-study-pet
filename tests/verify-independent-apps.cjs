const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(path.resolve(__dirname,'../../方案预览/.tools/node_modules/playwright'));
const {buildRelease}=require('../build-release.cjs');
const {buildEntry}=require('../build-entry.cjs');
const target=require('../app-targets.cjs');
const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2','.json':'application/json','.webmanifest':'application/manifest+json'};
const fixture={selectedCourses:[{name:'独立缓存测试',teacher:'测试',room:'T101',day:0,periods:[1,2],weeks:[[1,17]],type:'major'}],days:Array.from({length:7},(_,i)=>({name:'星期'+i,date:'',line:'测试',tasks:[]})),checked:{isolation:true},englishProgress:{},englishStart:'2026-09-18',appointments:[],englishAdjustments:[],changedAt:1};
(async()=>{
  const personal=buildRelease('personal'),share=buildRelease('share');
  const originalPersonal=Buffer.from(personal['index.html']);
  buildEntry('share');assert.deepEqual(personal['index.html'],originalPersonal);
  assert(!share['sync-config.js']);assert(!share['feedback-admin.html']);assert(!share['index.html'].toString().includes('sync-config.js'));
  assert(!personal['demo.js']);assert(!personal['share-tools.js']);
  const workerName=files=>files['sw.js'].toString().match(/const CACHE_NAME = "([^"]+)"/)[1];
  const personalName=workerName(personal),shareName=workerName(share);
  assert.notEqual(personalName,shareName);
  let broken='share',denyHTML=false,denyWords=false;const requests=[];
  const server=http.createServer((req,res)=>{
    const u=new URL(req.url,'http://localhost'),isPersonal=u.pathname.startsWith('/dusk-study-pet/'),isShare=u.pathname.startsWith('/dusk-handbook/');
    if(!isPersonal&&!isShare)return res.writeHead(404).end();
    const edition=isPersonal?'personal':'share';requests.push({edition,path:u.pathname});
    if(edition===broken)return res.writeHead(503).end('unavailable edition');
    const name=u.pathname.slice((isPersonal?'/dusk-study-pet/':'/dusk-handbook/').length)||'index.html';
    if(denyHTML&&name==='index.html')return res.writeHead(403).end('blocked navigation');
    if(denyWords&&name==='cet6-35.js')return res.writeHead(503).end('unavailable words');
    const data=(isPersonal?personal:share)[name];
    if(!data)return res.writeHead(404).end();
    res.setHeader('Content-Type',mime[path.extname(name)]||'text/plain');res.end(data);
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'msedge',headless:true});const errors=[];
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Shanghai'});
    await ctx.route('https://**',route=>route.abort());
    await ctx.addInitScript(data=>{
      if(localStorage.getItem('isolation-seeded'))return;
      localStorage.setItem('isolation-seeded','yes');
      localStorage.setItem('dusk-study-pet-full-state-v1',JSON.stringify(data));
      localStorage.setItem('dusk-study-pet-access-code-v1','test-only');
      localStorage.setItem('dusk-demo-v1:dusk-study-pet-full-state-v1',JSON.stringify({...data,selectedCourses:[{...data.selectedCourses[0],name:'旧分享记录'}],shareCalendar:'2026-09-07'}));
    },fixture);
    const p=await ctx.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.goto(base+'/dusk-study-pet/');await p.waitForFunction(()=>selectedCourses.length&&!restoringResume);
    await p.evaluate(()=>navigator.serviceWorker.ready);await p.waitForFunction(()=>navigator.serviceWorker.controller);
    const oldPersonal=await p.evaluate(()=>localStorage.getItem('dusk-study-pet-full-state-v1'));
    assert.equal(requests.filter(r=>r.edition==='share').length,0);
    denyHTML=true;denyWords=true;await p.reload();await p.waitForFunction(()=>selectedCourses.length&&!restoringResume);
    assert.equal(await p.evaluate(()=>checked.isolation),true);
    assert.equal(await p.evaluate(()=>wordsFromLesson(englishLessons[34],34).length),10);
    denyHTML=false;denyWords=false;broken='personal';
    const s=await ctx.newPage();s.on('pageerror',e=>errors.push(e.message));
    const marker=requests.length;
    await s.goto(base+'/dusk-handbook/');await s.waitForFunction(()=>window.shareTools&&!restoringResume);
    await s.evaluate(()=>navigator.serviceWorker.ready);await s.waitForFunction(()=>navigator.serviceWorker.controller);
    assert.equal(await s.evaluate(()=>selectedCourses[0].name),'旧分享记录');
    assert.equal(await s.evaluate(()=>syncReady),false);
    assert(!requests.slice(marker).some(r=>r.edition==='personal'));
    assert.equal(await s.evaluate(()=>localStorage.getItem('dusk-study-pet-full-state-v1')),oldPersonal);
    await s.locator('.atelier-nav [data-atelier-view=englishView]').click();
    await s.locator('#newWords .word-card:visible [data-remember-word]').first().click();
    const shareState=await s.evaluate(()=>localStorage.getItem('dusk-demo-v1:dusk-study-pet-full-state-v1'));
    assert.equal(await s.evaluate(()=>localStorage.getItem('dusk-study-pet-full-state-v1')),oldPersonal);
    for(const width of [320,390,760,1440]){
      await s.setViewportSize({width,height:width>760?1000:844});
      assert(await s.evaluate(()=>document.documentElement.scrollWidth<=innerWidth+2));
    }
    await s.setViewportSize({width:390,height:844});
    await s.screenshot({path:path.resolve(__dirname,'../../方案预览/独立分享-手机.png')});
    const shareNext=shareName+'-test-upgrade';
    share['sw.js']=Buffer.from(share['sw.js'].toString().replace(JSON.stringify(shareName),JSON.stringify(shareNext)));
    await s.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r.update()));
    await s.waitForFunction(async names=>{
      const keys=await caches.keys();return keys.includes(names.next)&&!keys.includes(names.old)&&keys.includes(names.personal);
    },{next:shareNext,old:shareName,personal:personalName});
    assert.equal(await s.evaluate(()=>localStorage.getItem('dusk-demo-v1:dusk-study-pet-full-state-v1')),shareState);
    broken=null;
    const personalNext=personalName+'-test-upgrade';
    personal['sw.js']=Buffer.from(personal['sw.js'].toString().replace(JSON.stringify(personalName),JSON.stringify(personalNext)));
    await p.evaluate(()=>navigator.serviceWorker.getRegistration().then(r=>r.update()));
    await p.waitForFunction(async names=>{
      const keys=await caches.keys();return keys.includes(names.next)&&!keys.includes(names.old)&&keys.includes(names.share);
    },{next:personalNext,old:personalName,share:shareNext});
    await ctx.setOffline(true);await p.reload();await s.reload();
    await p.waitForFunction(()=>selectedCourses.length&&!restoringResume);await s.waitForFunction(()=>window.shareTools&&!restoringResume);
    assert.equal(await p.evaluate(()=>selectedCourses[0].name),fixture.selectedCourses[0].name);
    assert.equal(await s.evaluate(()=>selectedCourses[0].name),'旧分享记录');
    assert.equal(await s.evaluate(()=>localStorage.getItem('dusk-demo-v1:dusk-study-pet-full-state-v1')),shareState);
    const registrations=await s.evaluate(async()=> (await navigator.serviceWorker.getRegistrations()).map(r=>r.scope));
    assert.equal(registrations.length,2);
    await ctx.setOffline(false);await p.goto(base+'/dusk-study-pet/share.html');
    await p.locator('#backup').click();
    assert((await p.locator('#status').innerText()).includes('原记录未改变'));
    assert.equal(await p.locator('a').getAttribute('href'),target.share.url);
    assert.deepEqual(errors,[]);
    await ctx.close();
    console.log('PASS: independent release bundles, separate worker scopes/cache cleanup, cross-edition outages and updates, HTTP error fallback, legacy share records, word progress, backup bridge, 320/390/760/1440 layout and offline restart. No real cloud reads or writes.');
  }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
