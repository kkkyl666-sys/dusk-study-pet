const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const assert = require('node:assert/strict');
const {chromium} = require(path.resolve(__dirname, '../../方案预览/.tools/node_modules/playwright'));
const root = path.resolve(__dirname, '..');
const baseURL = process.argv.find(arg => arg.startsWith('https://'));
const reproduce = process.argv.includes('--reproduce');
const fixture = {
  selectedCourses: [{name: '同步测试课程', teacher: '测试', room: 'TEST101', day: 0, periods: [1, 2], weeks: [[1, 17]], type: 'major'}],
  days: ['星期一','星期二','星期三','星期四','星期五','星期六','星期日'].map(name => ({name, date: '', line: '测试安排', tasks: []})),
  checked: {'test-completion': true}, englishProgress: {remembered: {'test-word': '2026-10-04'}, forgotten: {}},
  englishStart: '2026-09-18', appointments: [], englishAdjustments: [], changedAt: Date.now()
};
const mime = {'.html':'text/html', '.js':'text/javascript', '.css':'text/css', '.webp':'image/webp', '.png':'image/png', '.woff2':'font/woff2'};
(async () => {
  const server = baseURL ? null : http.createServer((req, res) => {
    const pathname = decodeURIComponent(new URL(req.url, 'http://localhost').pathname);
    const file = path.resolve(root, '.' + (pathname === '/' ? '/index.html' : pathname));
    if (!file.startsWith(root + path.sep)) return res.writeHead(403).end();
    try {res.setHeader('Content-Type', mime[path.extname(file)] || 'application/json'); res.end(fs.readFileSync(file));}
    catch {res.writeHead(404).end();}
  });
  if (server) await new Promise(resolve => server.listen(0, '127.0.0.1', resolve));
  const url = baseURL || `http://127.0.0.1:${server.address().port}/`;
  const browser = await chromium.launch({channel:'msedge', headless:true});
  let writes = 0, runtimeRequests = 0, cloudMode = 'ok';
  try {
    const context = await browser.newContext({viewport:{width:390, height:844}, timezoneId:'Asia/Shanghai', serviceWorkers:'block'});
    await context.route('**/experience.js*', route => {runtimeRequests++; return route.abort();});
    await context.route('**/rest/v1/rpc/*', route => {
      if (route.request().url().endsWith('/pet_save')) {writes++; return route.fulfill({json:null});}
      if (cloudMode === 'offline') return route.abort();
      return route.fulfill({json:cloudMode === 'invalid' ? {selectedCourses:[]} : fixture});
    });
    await context.addInitScript(() => localStorage.setItem('dusk-study-pet-access-code-v1','test-only'));
    const page = await context.newPage(), errors = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.goto(url, {waitUntil:'domcontentloaded'});
    if (reproduce) {
      await page.locator('#privateGateLogin').click();
      await page.locator('#syncNowBtn').click();
      await page.waitForFunction(() => document.querySelector('#syncDialogText').textContent.includes('validSnapshot is not defined'));
      console.log('REPRODUCED: blocking experience.js produces the exact reported sync error.');
      assert.equal(writes,0);
      return;
    }
    await page.waitForFunction(() => typeof validSnapshot === 'function' && days.length === 7 && !restoringResume);
    assert.equal(runtimeRequests,0);
    assert.equal(await page.evaluate(() => document.body.classList.contains('private-wait')),false);
    assert.equal(await page.evaluate(() => selectedCourses[0].name),fixture.selectedCourses[0].name);
    assert.equal(await page.evaluate(() => checked['test-completion']),true);
    await page.locator('[data-home-sync]').click(); await page.locator('#syncNowBtn').click();
    await page.waitForFunction(() => !document.querySelector('#syncDialog').open);
    assert.equal(writes,0);
    cloudMode = 'invalid';
    await page.locator('[data-home-sync]').click(); await page.locator('#syncNowBtn').click();
    await page.waitForFunction(() => document.querySelector('#syncDialogText').textContent.includes('本机存档仍保留'));
    assert.equal(await page.evaluate(() => selectedCourses[0].name),fixture.selectedCourses[0].name);
    assert.equal(writes,0);
    await page.locator('#syncCloseBtn').click();
    cloudMode = 'offline'; await page.reload();
    await page.waitForFunction(() => days.length === 7 && !restoringResume);
    assert.equal(await page.evaluate(() => selectedCourses[0].name),fixture.selectedCourses[0].name);
    assert.equal(await page.evaluate(() => checked['test-completion']),true);
    assert.equal(await page.evaluate(() => englishProgress.remembered['test-word']),fixture.englishProgress.remembered['test-word']);
    cloudMode = 'ok'; await page.locator('[data-home-sync]').click(); await page.locator('#syncNowBtn').click();
    await page.waitForFunction(() => !document.querySelector('#syncDialog').open);
    assert.equal(writes,0); assert.deepEqual(errors,[]);
    await context.close();
    const fresh = await browser.newContext({viewport:{width:390,height:844},serviceWorkers:'block'});
    await fresh.route('**/experience.js*', route => {runtimeRequests++; return route.abort();});
    await fresh.route('**/rest/v1/rpc/*', route => {
      if(route.request().url().endsWith('/pet_save')) {writes++; return route.fulfill({json:null});}
      return route.fulfill({json:fixture});
    });
    const login = await fresh.newPage(); await login.goto(url, {waitUntil:'domcontentloaded'});
    await login.locator('#privateGateLogin').click(); await login.locator('#syncEmail').fill('test-only'); await login.locator('#syncLoginBtn').click();
    await login.waitForFunction(() => !document.body.classList.contains('private-wait') && !document.querySelector('#syncDialog').open);
    assert.equal(await login.evaluate(() => selectedCourses[0].name),fixture.selectedCourses[0].name);
    assert.equal(runtimeRequests,0); assert.equal(writes,0);
    await fresh.close();
    console.log('PASS: cold start, fresh unlock, manual sync, invalid remote rejection, offline local recovery and retry; runtime needs no separate request; no personal cloud writes (cloud mocked).');
  } finally {await browser.close(); if(server) await new Promise(resolve => server.close(resolve));}
})().catch(error => {console.error(error.message);process.exitCode=1;});
