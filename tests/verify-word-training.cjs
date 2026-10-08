const assert=require('node:assert/strict');
const http=require('node:http');
const path=require('node:path');
const {chromium}=require(path.resolve(__dirname,'../../方案预览/.tools/node_modules/playwright'));
const {buildRelease}=require('../build-release.cjs');
const edition=process.argv[2]||'personal';
const files=buildRelease(edition);
const data={selectedCourses:[{name:'Synthetic',teacher:'Test',room:'C102',day:1,periods:[1,2],weeks:[[1,17]],type:'major'}],days:Array.from({length:7},(_,i)=>({name:'Day '+i,date:'',line:'Test',tasks:[['Test','英语','',null,'task-'+i]]})),checked:{},englishProgress:{},englishStart:'2026-09-18',appointments:[],englishAdjustments:[],changedAt:1};
(async()=>{
  const mime={'.html':'text/html','.js':'text/javascript','.css':'text/css','.json':'application/json','.webmanifest':'application/manifest+json'};
  const server=http.createServer((req,res)=>{const name=new URL(req.url,'http://localhost').pathname.slice(1)||'index.html';if(!files[name])return res.writeHead(404).end();res.setHeader('Content-Type',mime[path.extname(name)]||'application/octet-stream');res.end(files[name]);});
  await new Promise(r=>server.listen(0,'127.0.0.1',r));
  const browser=await chromium.launch({channel:'msedge',headless:true});
  const errors=[];
  const watchdog=setTimeout(()=>browser.close(),120000);
  try{
    const c=await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
    await c.route('https://**',r=>r.abort());
    await c.addInitScript(({data,edition})=>{if(localStorage.getItem('training-test'))return;localStorage.setItem('training-test','1');const prefix=edition==='share'?'dusk-demo-v1:':'';localStorage.setItem(prefix+'dusk-study-pet-full-state-v1',JSON.stringify(data));if(edition==='personal')localStorage.setItem('dusk-study-pet-access-code-v1','test-only');},{data,edition});
    const p=await c.newPage();p.on('pageerror',e=>errors.push(e.message));
    await p.clock.install({time:new Date('2026-10-08T12:00:00+08:00')});
    const ready=()=>p.waitForFunction(()=>days.length===7&&!restoringResume&&document.querySelector('#wordTraining'));
    await p.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'});await ready();
    const open=async()=>{await p.locator('button[data-atelier-view="englishView"]').click();await p.locator('[data-word-layout="training"]').click();};
    await open();
    const word=()=>p.locator('.training-word-row h3').textContent();
    const click=a=>p.locator(`#wordTraining [data-training="${a}"]`).click();
    const answer=async correct=>{const index=await p.evaluate(correct=>englishProgress.trainingV1.options.findIndex(x=>x.correct===correct),correct);await p.locator(`#wordTraining [data-option="${index}"]`).click();};
    const first=await word();
    assert.equal(await p.locator('.training-options button').count(),4);
    assert.equal(await p.locator('[data-training="next"]').isDisabled(),true);
    await answer(false);assert.match(await p.locator('.training-prompt').textContent(),/明天加练/);
    const firstId=await p.evaluate(()=>englishProgress.trainingV1.feedback.id);
    await p.clock.runFor(3000);assert.equal(await word(),first,'wrong waits for explanation');
    await p.reload({waitUntil:'domcontentloaded'});await ready();await open();assert.equal(await word(),first);assert.match(await p.locator('.training-prompt').textContent(),/明天加练/);
    await click('continue');
    const second=await word();await answer(true);await p.clock.runFor(1900);assert.equal(await word(),second);await p.clock.runFor(150);assert.notEqual(await word(),second,'advance after 2 sec');
    const saved=await p.evaluate(()=>JSON.stringify(englishProgress));
    await click('previous');await p.clock.runFor(2200);assert.equal(await word(),second);assert.equal(await p.evaluate(()=>JSON.stringify(englishProgress)),saved,'history read only');await click('return');
    await answer(true);await click('next');await answer(true);await click('next');
    assert.equal(await word(),first,'retry after three intervening answers');
    await answer(true);
    assert.equal(await p.evaluate(id=>englishProgress.forgotten[id]===englishDayIndex(),firstId),true,'retry keeps tomorrow');
    await click('undo');assert.equal(await p.locator('.training-options button').count(),4);await answer(true);await click('next');
    await click('details');assert.equal(await p.locator('#wordDetailDialog').isVisible(),true);await p.locator('#trainingReturn').click();await answer(true);assert.match(await p.locator('.training-prompt').textContent(),/已看提示/);await click('next');
    await click('review');const before=await p.evaluate(()=>pendingReviewWords().length);await answer(true);assert.equal(await p.evaluate(()=>pendingReviewWords().length),before-1);await click('undo');assert.equal(await p.evaluate(()=>pendingReviewWords().length),before);
    // Snapshot restoration exercises the existing cloud/backup boundary without real network writes.
    await p.evaluate(()=>{const s=structuredClone(snapshot());applySnapshot(s);});
    assert.equal(await p.locator('.training-options button').count(),4);
    await p.locator('[data-word-layout="list"]').click();assert.equal(await p.locator('#wordTraining').isVisible(),false);assert.equal(await p.locator('#newWords .word-card').count(),10);await p.locator('[data-word-layout="training"]').click();
    for(const size of [{width:320,height:700},{width:390,height:844},{width:1440,height:1000}]){
      await p.setViewportSize(size);await open();await p.screenshot({path:path.resolve(__dirname,`../../方案预览/正式背词-${edition}-${size.width}.png`)});
      assert.equal(await p.locator('.training-options button').count(),4);
      assert.equal(await p.evaluate(()=>document.documentElement.scrollWidth>innerWidth+1),false,'no horizontal overflow');
    }
    await p.clock.setSystemTime(new Date('2026-10-09T03:59:00+08:00'));await p.evaluate(()=>refreshCalendarNavigation());assert.equal(await p.evaluate(()=>englishProgress.trainingV1.key.endsWith(':20')),true);
    await p.clock.setSystemTime(new Date('2026-10-09T04:00:00+08:00'));await p.evaluate(()=>refreshCalendarNavigation());assert.equal(await p.evaluate(()=>englishProgress.trainingV1.key.endsWith(':21')),true);
    assert.equal(await p.evaluate(id=>reviewWords().some(w=>w.id===id),firstId),true,'forgotten word next day');
    await p.evaluate(()=>{englishProgress={remembered:{[lessonForToday().words[0].id]:englishDayIndex()}};saveEnglish();renderEnglish();});
    await click('new');
    assert.equal(await word(),await p.evaluate(()=>lessonForToday().words[1].word),'legacy completion skipped, order unchanged');
    assert.equal(await p.evaluate(()=>englishProgress.trainingV1.events.length),0,'no fabricated old quiz scores');
    await answer(true);await click('details');await p.clock.runFor(2500);
    assert.equal(await p.evaluate(()=>englishProgress.trainingV1.feedback!==null),true,'dialog pauses auto');
    await p.locator('#trainingReturn').click();await p.clock.runFor(2050);
    assert.equal(await p.evaluate(()=>englishProgress.trainingV1.feedback===null),true,'closing resumes auto');
    for(let i=0;i<8;i++){await answer(true);await click('next');}
    assert.match(await p.locator('.training-complete').textContent(),/今日新词已完成/);
    assert.equal(await p.evaluate(()=>lessonForToday().words.every(wordHandled)),true);
    assert.equal(await p.locator('#wordTraining .completion-quote').count(),1,'daily quote retained');
    assert.deepEqual(errors,[]);console.log('PASS '+edition+': grading, 2s, reload, history, spacing, retry, hints, undo, snapshot, list, viewport, 04:00; synthetic only');
  }finally{clearTimeout(watchdog);await browser.close();await new Promise(r=>server.close(r));}
})().catch(e=>{console.error(e);process.exitCode=1;});
