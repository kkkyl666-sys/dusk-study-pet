const assert = require('node:assert/strict');
const http = require('node:http');
const path = require('node:path');
const {chromium} = require(path.resolve(__dirname, '../../方案预览/.tools/node_modules/playwright'));
const {buildRelease} = require('../build-release.cjs');
const files = buildRelease('personal');
const fixture = {
  selectedCourses: [{name:'Test course', teacher:'Test', room:'C102', day:1, periods:[1,2], weeks:[[1,17]], type:'major'}],
  days: Array.from({length:7}, (_,i) => ({name:'Day '+i, date:'', line:'Test', tasks:[['Test task','英语','Test',null,'test-'+i]]})),
  checked:{}, englishProgress:{}, englishStart:'2026-09-18', appointments:[], englishAdjustments:[], changedAt:1
};
const mime = {'.html':'text/html','.js':'text/javascript','.css':'text/css','.webp':'image/webp','.png':'image/png','.woff2':'font/woff2','.json':'application/json','.webmanifest':'application/manifest+json'};
(async () => {
  const server = http.createServer((req,res) => {
    const name = new URL(req.url,'http://localhost').pathname.slice(1) || 'index.html';
    if (!files[name]) return res.writeHead(404).end();
    res.setHeader('Content-Type',mime[path.extname(name)] || 'text/plain'); res.end(files[name]);
  });
  await new Promise(r => server.listen(0,'127.0.0.1',r));
  const browser = await chromium.launch({channel:'msedge',headless:true});
  const errors = [];
  const watchdog = setTimeout(() => browser.close(),90000);
  try {
    const context = await browser.newContext({viewport:{width:390,height:844},timezoneId:'Asia/Shanghai',serviceWorkers:'block'});
    await context.route('https://**',route => route.abort());
    await context.addInitScript(data => {
      if (localStorage.getItem('review-seeded')) return;
      localStorage.setItem('review-seeded','yes');
      localStorage.setItem('dusk-study-pet-full-state-v1',JSON.stringify(data));
      localStorage.setItem('dusk-study-pet-access-code-v1','test-only');
    },fixture);
    const p = await context.newPage(); p.on('pageerror',e => errors.push(e.message));
    await p.clock.install({time:new Date('2026-10-06T12:00:00+08:00')});
    const ready = () => p.waitForFunction(() => days.length===7 && !restoringResume && document.querySelector('[data-word-layout="list"]'));
    await p.goto('http://127.0.0.1:'+server.address().port+'/',{waitUntil:'domcontentloaded'}); await ready();
    const count = async n => assert.equal(await p.locator('#reviewCount').textContent(),'今日待复习 '+n);
    await p.locator('[data-home-continue]').click();
    await p.locator('button[data-word-layout="list"]').click();
    const ids = await p.evaluate(() => reviewWords().map(w => w.id));
    assert.equal(ids.length,40); await count(40);
    const card = id => p.locator(`[data-word-card="${id}"]`);
    for (let i=0;i<19;i++) {
      await card(ids[i]).locator(i%2 ? '[data-forgot-word]' : '[data-remember-word]').click();
      await count(39-i);
      assert.equal(await p.evaluate(() => currentViewId()),'englishView');
      assert.equal(await card(ids[i]).locator('.word-actions').count(),0);
    }
    assert.deepEqual(await p.evaluate(() => reviewWords().map(w => w.id)),ids,'retain order and handled cards');
    assert.match(await p.locator('.home-start small').textContent(),/待复习 21 词/);
    assert.match(await p.locator('#tasks').textContent(),/21 个待复习/);
    await card(ids[18]).locator('[data-word-undo]').click(); await count(22);
    await card(ids[18]).locator('[data-remember-word]').click(); await count(21);
    await p.locator('#newWords [data-remember-word]').first().click(); await count(21);
    assert.equal(await p.locator('#newWords .word-card').count(),10,'new-word quota remains ten');
    await p.locator('button[data-word-layout="focus"]').click();
    await p.locator('[data-focus-group="review"]').click();
    assert.equal(await p.locator('#focusPosition').textContent(),'1 / 40');
    await count(21);
    await p.screenshot({path:path.resolve(__dirname,'../../方案预览/复习计数-剩余21.png')});
    await p.reload({waitUntil:'domcontentloaded'}); await ready(); await count(21);
    await p.locator('[data-atelier-view="englishView"]').click();
    await p.locator('button[data-word-layout="list"]').click();
    assert.equal(await p.locator('#reviewWords .word-card').count(),40);
    for (const id of ids.slice(19)) await card(id).locator('[data-remember-word]').click();
    await count(0); assert.equal(await p.evaluate(() => pendingReviewWords().length),0);

    // An extra word from yesterday must retain its completed feedback and undo.
    const extra = await p.evaluate(() => {
      englishProgress={remembered:{},forgotten:{}};
      const day=englishDayIndex()-2,word=wordsFromLesson(englishLessons[day],day)[0];
      englishProgress.forgotten[word.id]=englishDayIndex()-1;
      saveEnglish();renderEnglish();return word.id;
    });
    await count(41);
    await card(extra).locator('[data-forgot-word]').click(); await count(40);
    assert.match(await card(extra).locator('.word-status').textContent(),/明天加练/);
    await card(extra).locator('[data-word-undo]').click(); await count(41);
    await card(extra).locator('[data-remember-word]').click(); await count(40);
    await card(extra).locator('[data-word-undo]').click(); await count(41);
    await card(extra).locator('[data-forgot-word]').click(); await count(40);

    // A synthetic cloud snapshot recalculates, rather than decrementing a stored counter.
    await p.evaluate(() => {
      const data=snapshot(),id=reviewWords()[0].id;
      data.englishProgress={remembered:{[id]:englishDayIndex()},forgotten:{}};
      applySnapshot(data);
    });
    await count(39);
    await p.locator('#quizOptions [data-quiz-answer="false"]').first().click(); await count(39);
    assert.match(await p.locator('#quizResult').textContent(),/明天会自动加练/);
    await p.evaluate(() => {englishProgress={};renderEnglish();});
    await p.locator('#quizOptions [data-quiz-answer="false"]').first().click(); await count(39);
    assert.match(await p.locator('#quizResult').textContent(),/明天会自动加练/);
    await p.locator('#quizOptions [data-quiz-answer="false"]').first().click(); await count(39);
    await p.evaluate(() => {
      const day=englishDayIndex()-4,word=wordsFromLesson(englishLessons[day],day)[0];
      englishProgress={forgotten:{[word.id]:englishDayIndex()}};saveEnglish();renderEnglish();
    });
    await p.clock.setSystemTime(new Date('2026-10-07T03:59:00+08:00'));
    await p.evaluate(() => refreshCalendarNavigation()); await count(40);
    await p.clock.setSystemTime(new Date('2026-10-07T04:00:00+08:00'));
    await p.evaluate(() => refreshCalendarNavigation()); await count(41);
    assert.equal(await p.locator('#newWords .word-card').count(),10);
    await p.setViewportSize({width:1440,height:1000});
    await p.locator('button[data-word-layout="list"]').click(); await count(41);
    await p.screenshot({path:path.resolve(__dirname,'../../方案预览/复习计数-电脑次日加练.png')});
    assert.deepEqual(errors,[]);
    console.log('PASS: 40 -> 21, both marks, undo, stable order, new quota, reload, snapshot, quiz, 04:00, extra practice, mobile and desktop; synthetic data only');
  } finally {
    clearTimeout(watchdog); await browser.close(); await new Promise(r => server.close(r));
  }
})().catch(e => {console.error(e);process.exitCode=1;});
