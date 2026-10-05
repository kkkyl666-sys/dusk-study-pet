const fs=require('node:fs'),path=require('node:path'),http=require('node:http'),assert=require('node:assert/strict');
const {chromium}=require(path.resolve(__dirname,'../../方案预览/.tools/node_modules/playwright'));
const root=path.resolve(__dirname,'..'),reproduce=process.argv.includes('--reproduce');
const fixture={selectedCourses:[{name:'启动测试课程',teacher:'测试',room:'T101',day:0,periods:[1,2],weeks:[[1,17]],type:'major'}],days:['星期一','星期二','星期三','星期四','星期五','星期六','星期日'].map(name=>({name,date:'',line:'测试',tasks:[]})),checked:{'test-only':true},englishProgress:{remembered:{},forgotten:{}},englishStart:'2026-09-18',changedAt:Date.now()};
(async()=>{
 const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.png':'image/png','.woff2':'font/woff2'};
 const server=http.createServer((req,res)=>{const url=new URL(req.url,'http://localhost'),file=path.resolve(root,'.'+(url.pathname==='/'?'/index.html':decodeURIComponent(url.pathname)));if(!file.startsWith(root+path.sep))return res.writeHead(403).end();try{res.setHeader('Content-Type',mime[path.extname(file)]||'application/json');res.end(fs.readFileSync(file));}catch{res.writeHead(404).end();}});
 await new Promise(r=>server.listen(0,'127.0.0.1',r));const base='http://127.0.0.1:'+server.address().port;
 const browser=await chromium.launch({channel:'msedge',headless:true});let release;
 try{
  const ctx=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  const hold=new Promise(r=>release=r);let writes=0;
  await ctx.route('**/lucide.min.js',async route=>{await hold;await route.continue().catch(()=>{});});
  await ctx.route('**/rest/v1/rpc/*',route=>{if(route.request().url().endsWith('pet_save')){writes++;return route.fulfill({json:null});}return route.fulfill({json:fixture});});
  const page=await ctx.newPage();if(reproduce)await page.addInitScript(()=>localStorage.setItem('dusk-study-pet-access-code-v1','test-only'));
  await page.goto(base+'/',{waitUntil:'commit'});await page.waitForFunction(()=>typeof pullOrPushCloudState==='function');
  await page.locator('#privateGateLogin').click();
  if(reproduce){
   await page.locator('#syncNowBtn').click();await page.waitForFunction(()=>document.querySelector('#syncDialogText').textContent.includes('validSnapshot is not defined'));
   console.log('REPRODUCED: stalled icon library still prevents the previously inlined runtime from initializing; early sync reports validSnapshot is not defined.');
  }else{
   assert.equal(await page.evaluate(()=>typeof validSnapshot),'function');
   await page.locator('#syncEmail').fill('test-only');await page.locator('#syncLoginBtn').click();
   await page.waitForFunction(()=>!document.querySelector('#syncDialog').open&&!document.body.classList.contains('private-wait'));
   assert.equal(await page.evaluate(()=>selectedCourses[0].name),fixture.selectedCourses[0].name);assert.equal(writes,0);
   assert.ok(await page.locator('#appRevision').innerText());
   console.log('PASS: first unlock works while the optional icon request remains stalled.');
  }
  release();
  if(!reproduce){
   await page.locator('#atelierSettings').click();
   await page.evaluate(()=>Object.defineProperty(navigator,'share',{configurable:true,value:async data=>{window.testSharedURL=data.url;}}));
   await page.locator('#atelierDemoLink').click();
   assert.equal(await page.evaluate(()=>window.testSharedURL),'https://kkkyl666-sys.github.io/dusk-study-pet/share.html');
   await page.screenshot({path:path.resolve(__dirname,'../../方案预览/启动修复-手机版本.png')});
  }
  await ctx.close();
  const share=await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
  await share.route('**/demo-config.js*',route=>route.abort());
  await share.route('**/rest/v1/rpc/*',route=>{throw Error('Share must never call personal cloud');});
  await share.addInitScript(()=>localStorage.setItem('dusk-study-pet-full-state-v1','personal-sentinel'));
  const p=await share.newPage();await p.goto(base+'/share.html',{waitUntil:'domcontentloaded'});
  if(reproduce){assert.equal(await p.evaluate(()=>isDemo),false);assert.equal(await p.evaluate(()=>document.body.classList.contains('private-wait')),true);console.log('REPRODUCED: missing demo-config makes share misidentify itself as personal.');}
  else{
   await p.waitForFunction(()=>window.shareTools&&!restoringResume);assert.equal(await p.evaluate(()=>isDemo),true);assert.equal(await p.evaluate(()=>syncReady),false);
   assert.equal(await p.evaluate(()=>document.body.classList.contains('private-wait')),false);
   assert.equal(await p.evaluate(()=>localStorage.getItem('dusk-study-pet-full-state-v1')),'personal-sentinel');
   assert.equal(await p.locator('#privateGate').isVisible(),false);assert.equal(await p.locator('#demoURL').inputValue(),'https://kkkyl666-sys.github.io/dusk-study-pet/share.html');
   console.log('PASS: share bootstrap has no separate request; no personal gate, cloud or storage access; share output is canonical HTTPS URL.');
  }
  await share.close();
 }finally{release?.();await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e.message);process.exitCode=1;});
