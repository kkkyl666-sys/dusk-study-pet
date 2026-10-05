const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(path.resolve(__dirname,'../../方案预览/.tools/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),reproduce=process.argv.includes('--reproduce');
const cacheName=fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const CACHE_NAME = "([^"]+)"/)[1];
const fixture={selectedCourses:[{name:'缓存测试课程',teacher:'测试',room:'T101',day:0,periods:[1,2],weeks:[[1,17]],type:'major'}],days:Array.from({length:7},(_,i)=>({name:'星期'+i,date:'',line:'测试',tasks:[]})),checked:{test:true},englishProgress:{},englishStart:'2026-09-18',changedAt:1};
(async()=>{
  let failAuxiliary=true,denyPage=false,denyWords=false;
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'};
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(failAuxiliary&&/^\/(share|demo|manifest-demo|papaparse|feedback|development|DEVELOPMENT)/.test(pathname))return res.writeHead(503).end('auxiliary unavailable');
    if(denyPage&&(pathname==='/'||pathname==='/index.html'))return res.writeHead(403).end('navigation denied');
    if(denyWords&&pathname==='/cet6-35.js')return res.writeHead(503).end('word resource unavailable');
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
    try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/json');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    await ctx.route('https://**',route=>route.abort());
    await ctx.addInitScript(data=>{
      localStorage.setItem('dusk-study-pet-full-state-v1',JSON.stringify(data));
      localStorage.setItem('dusk-study-pet-access-code-v1','test-only');
    },fixture);
    const p=await ctx.newPage();await p.goto(base+'/',{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>selectedCourses.length&&typeof validSnapshot==='function');
    if(reproduce){
      const ready=await p.evaluate(()=>Promise.race([navigator.serviceWorker.ready.then(()=>true),new Promise(r=>setTimeout(()=>r(false),2500))]));
      assert.equal(ready,false);
      console.log('REPRODUCED: unavailable share/inbox/journal resources prevent the personal worker from installing.');
      return;
    }
    await p.evaluate(()=>navigator.serviceWorker.ready.then(()=>true));
    await p.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    assert.equal(await p.evaluate(()=>selectedCourses[0].name),fixture.selectedCourses[0].name);
    denyPage=true;denyWords=true;
    await p.reload({waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>!restoringResume&&selectedCourses.length);
    assert.equal(await p.evaluate(()=>checked.test),true);
    assert.equal(await p.evaluate(()=>wordsFromLesson(englishLessons[34],34).length),10);
    await ctx.setOffline(true);await p.reload({waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>!restoringResume&&selectedCourses.length);
    assert.equal(await p.evaluate(()=>selectedCourses[0].name),fixture.selectedCourses[0].name);
    await ctx.setOffline(false);denyPage=false;denyWords=false;failAuxiliary=false;
    await p.goto(base+'/share.html',{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>window.shareTools&&!restoringResume);
    await p.waitForFunction(async name=>(await caches.open(name)).match('./share.html').then(Boolean),cacheName);
    await ctx.setOffline(true);await p.reload({waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>window.shareTools&&!restoringResume);
    assert.equal(await p.evaluate(()=>isDemo),true);assert.equal(await p.evaluate(()=>syncReady),false);
    await ctx.close();
    console.log('PASS: broken share/inbox/journal cannot prevent personal offline cache installation; HTTP 403 navigation and 503 vocabulary fall back to valid cache; personal records and all 350 words survive; separately visited share works offline without personal cloud access.');
  }finally{await browser.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
