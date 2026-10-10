const assert=require('node:assert/strict'),http=require('node:http'),path=require('node:path');
const {chromium}=require('../../方案预览/.tools/node_modules/playwright');
const {buildRelease}=require('../build-release.cjs');
(async()=>{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 try{for(const edition of ['personal','share']){
  const files=buildRelease(edition),counts={};
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2'};
  const server=http.createServer((req,res)=>{const n=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';counts[n]=(counts[n]||0)+1;res.setHeader('Content-Type',mime[path.extname(n)]||'application/json');res.end(files[n]);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const c=await browser.newContext({viewport:{width:390,height:844}});
  try{
   const p=await c.newPage();await p.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});
   await p.evaluate(async()=>{await navigator.serviceWorker.ready;});
   await p.waitForFunction(()=>navigator.serviceWorker.controller);
   await p.evaluate(()=>navigator.serviceWorker.controller.postMessage({type:'WARM_MEDIA'}));
   const paths=JSON.parse(files['companion-art.json']);
   const media=[...paths.anger,...paths.praise,...paths.wallpapers.flatMap(x=>[x.file,x.preview])];
   let complete=false;for(let i=0;i<300;i++){
    complete=await p.evaluate(async media=>{const cache=await caches.open((await caches.keys()).find(x=>x.startsWith(window.PET_APP.edition==='share'?'dusk-share-':'dusk-personal-')));for(const src of media)if(!await cache.match(new URL(src,location.href)))return false;return true;},media);
    if(complete)break;await p.waitForTimeout(200);
   }assert(complete,'all artwork cached before offline test');
   const imageCounts=()=>JSON.stringify(Object.fromEntries(Object.entries(counts).filter(([n])=>/\.(png|webp)$/.test(n))));
   const before=imageCounts();await c.setOffline(true);await p.reload({waitUntil:'domcontentloaded'});
   await p.waitForFunction(()=>window.DuskMedia);
   const missing=await p.evaluate(async media=>{const missing=[];for(const src of media)if(!(await DuskMedia.prepare(src))?.naturalWidth)missing.push(src);return missing;},media);assert.deepEqual(missing,[]);
   assert.equal(imageCounts(),before,'cached offline reopen sends no image requests');
   await c.setOffline(false);const old=imageCounts();
   assert(await p.evaluate(async media=>{for(const src of media)if(!(await DuskMedia.prepare(src))?.naturalWidth)return false;return true;},media));
   assert.equal(imageCounts(),old,'warm image re-use sends no downloads');
   console.log('PASS '+edition+': all 34 new image variants cached; offline reopen decodes all; no repeat downloads');
  }finally{await c.close();server.closeAllConnections();await new Promise(r=>server.close(r));}
 }}finally{await browser.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
