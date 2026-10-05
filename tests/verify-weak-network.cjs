const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(path.resolve(__dirname,'../../方案预览/.tools/node_modules/playwright'));
const root=path.resolve(__dirname,'..');
(async()=>{
  let failedAssets=0;
  let serveCurrentWorker=false;
  const currentCache=fs.readFileSync(path.join(root,'sw.js'),'utf8').match(/const CACHE_NAME = "([^"]+)"/)[1];
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'};
  const server=http.createServer((req,res)=>{
    const pathname=decodeURIComponent(new URL(req.url,'http://localhost').pathname);
    if(pathname==='/seed.html'){res.setHeader('Content-Type','text/html');return res.end('<!doctype html><title>Worker upgrade test</title>');}
    if(pathname==='/sw.js'&&!serveCurrentWorker){
      res.setHeader('Content-Type','text/javascript');res.setHeader('Cache-Control','no-store');
      return res.end(`self.addEventListener('install',e=>e.waitUntil(caches.open('dusk-study-pet-test-old').then(c=>c.put('./index.html',new Response('old-shell'))).then(()=>self.skipWaiting())));self.addEventListener('activate',e=>e.waitUntil(self.clients.claim()));self.addEventListener('fetch',e=>e.respondWith(fetch(e.request)));self.addEventListener('message',e=>e.ports[0]?.postMessage('old'));`);
    }
    if (/\.(woff2|png)$/.test(pathname)) {failedAssets++;return res.writeHead(503).end();}
    const file=path.resolve(root,'.'+(pathname==='/'?'/index.html':pathname));
    if(!file.startsWith(root+path.sep))return res.writeHead(403).end();
    try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/json');const source=fs.readFileSync(file);res.end(pathname==='/sw.js'?source+"\nself.addEventListener('message',e=>e.ports[0]?.postMessage(CACHE_NAME));":source);}catch{res.writeHead(404).end();}
  });
  await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
  const browser=await chromium.launch({channel:'msedge',headless:true});
  try{
    const ctx=await browser.newContext({viewport:{width:390,height:844}});
    await ctx.route('https://**',route=>route.abort());
    const p=await ctx.newPage();await p.goto(base+'/seed.html');
    await p.evaluate(async()=>{await navigator.serviceWorker.register('./sw.js');await navigator.serviceWorker.ready;});
    await p.waitForFunction(()=>navigator.serviceWorker.controller!==null);
    assert.ok(await p.evaluate(()=>caches.has('dusk-study-pet-test-old')));
    serveCurrentWorker=true;
    await p.goto(base+'/share.html',{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>window.shareTools&&!restoringResume);
    assert.ok(failedAssets>0);
    const remembered=await p.evaluate(()=>{
      const word=lessonForToday().words[0];
      englishProgress.remembered ||= {};
      englishProgress.remembered[word.id]=englishDayIndex();
      cacheCommittedState();return {id:word.id,date:englishProgress.remembered[word.id]};
    });
    await p.evaluate(async()=>{const registration=await navigator.serviceWorker.getRegistration();await registration.update();});
    await p.waitForFunction(async name=>{
      const registration=await navigator.serviceWorker.getRegistration();
      return registration.active?.state==='activated'&&registration.active===navigator.serviceWorker.controller&&(await caches.has(name))&&!(await caches.has('dusk-study-pet-test-old'));
    },currentCache);
    const controllerVersion=await p.evaluate(()=>new Promise(resolve=>{const channel=new MessageChannel();channel.port1.onmessage=e=>resolve(e.data);navigator.serviceWorker.controller.postMessage('version',[channel.port2]);}));
    assert.equal(controllerVersion,currentCache);
    await p.reload({waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>window.shareTools&&!restoringResume);
    await ctx.setOffline(true);await p.reload({waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>window.shareTools&&!restoringResume);
    assert.equal(await p.evaluate(()=>isDemo),true);assert.equal(await p.evaluate(()=>syncReady),false);
    assert.equal(await p.evaluate(id=>englishProgress.remembered[id],remembered.id),remembered.date);
    await p.goto(base+'/?v=offline-test',{waitUntil:'domcontentloaded'});
    assert.equal(await p.evaluate(()=>isDemo),false);assert.equal(await p.locator('#privateGate').isVisible(),true);
    await p.goto(base+'/share.html?v=offline-test',{waitUntil:'domcontentloaded'});
    await p.waitForFunction(()=>window.shareTools&&!restoringResume);
    assert.equal(await p.evaluate(()=>isDemo),true);
    await ctx.close();
    const fresh=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await fresh.route('**/rest/v1/rpc/*',route=>route.abort());
    const login=await fresh.newPage();await login.goto(base+'/',{waitUntil:'domcontentloaded'});
    await login.locator('#privateGateLogin').click();await login.locator('#syncEmail').fill('test-only');await login.locator('#syncLoginBtn').click();
    await login.waitForFunction(()=>document.querySelector('#syncDialogText').textContent.includes('当前网络无法连接云端'));
    assert.equal(await login.evaluate(()=>localStorage.getItem('dusk-study-pet-access-code-v1')),null);
    await fresh.close();
    console.log('PASS: existing worker upgrades despite optional asset failures; offline share entry/progress survive; private/share navigation remain isolated; blocked cloud shows a network error, not an invalid-code accusation. No real cloud writes.');
  }finally{await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
