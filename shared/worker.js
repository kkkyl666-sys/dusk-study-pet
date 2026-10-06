const CONFIG = /*APP_WORKER_CONFIG*/;
const CACHE_NAME = /*APP_CACHE_NAME*/;
const APP_SHELL = CONFIG.required.concat(CONFIG.optional);
const baseURL = new URL('./', self.location.href);

async function acceptable(response, url) {
  if (!response.ok) return false;
  const type = response.headers.get('content-type') || '';
  const pathname = new URL(url).pathname;
  if (/\.js$/.test(pathname)) return /javascript/.test(type);
  if (/\.css$/.test(pathname)) return /text\/css/.test(type);
  if (/\.(webp|png)$/.test(pathname)) return /image\//.test(type);
  if (/\.woff2$/.test(pathname)) return /font\/|application\/(font|octet-stream)/.test(type);
  if (/\.html$/.test(pathname) || pathname.endsWith('/')) {
    if (!/text\/html/.test(type)) return false;
    const relative=pathname.slice(baseURL.pathname.length);
    if (['','index.html','share.html'].includes(relative)) {
      const body=await response.clone().text();
      return body.includes('id="experience-runtime"') && body.includes('id="app-target"') ||
        relative === 'share.html' && body.includes('id="backup"');
    }
  }
  return true;
}
async function reuseAsset(cache, entry, oldCaches) {
  const expected=CONFIG.assets?.[entry];
  if (!expected) return false;
  for (const old of oldCaches) {
    const response=await old.match(new URL(entry,baseURL));
    if (!response || !await acceptable(response,new URL(entry,baseURL))) continue;
    const digest=await crypto.subtle.digest('SHA-256',await response.clone().arrayBuffer());
    const hash=Array.from(new Uint8Array(digest),byte=>byte.toString(16).padStart(2,'0')).join('');
    if (hash===expected) {await cache.put(new URL(entry,baseURL),response);return true;}
  }
  return false;
}
async function precache(cache, entry, timeout, oldCaches=[]) {
  if (await reuseAsset(cache,entry,oldCaches)) return;
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const request = new Request(new URL(entry, baseURL), {cache:'reload', signal:controller.signal});
    const response = await fetch(request);
    if (!await acceptable(response, request.url)) throw new Error('Cache resource unavailable: '+entry);
    await cache.put(request, response);
  } finally {clearTimeout(timer);}
}
self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // Only this edition's launch resources are required. Other pages are independent.
    await Promise.all(CONFIG.required.map(entry => precache(cache, entry, 10000)));
    const oldKeys=(await caches.keys()).filter(key=>key!==CACHE_NAME &&
      (key.startsWith(CONFIG.cachePrefix) || CONFIG.legacyCachePrefix && key.startsWith(CONFIG.legacyCachePrefix)));
    const oldCaches=await Promise.all(oldKeys.map(key=>caches.open(key)));
    // Limit speculative downloads so wallpaper and visible text do not compete with every asset.
    const queue=CONFIG.optional.slice(), deadline=Date.now()+8000;
    await Promise.all(Array.from({length:4},async()=>{
      while(queue.length && Date.now()<deadline) {
        const entry=queue.shift();
        try {await precache(cache,entry,Math.min(5000,deadline-Date.now()),oldCaches);} catch {}
      }
    }));
    await self.skipWaiting();
  })());
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key !== CACHE_NAME &&
      (key.startsWith(CONFIG.cachePrefix) || CONFIG.legacyCachePrefix && key.startsWith(CONFIG.legacyCachePrefix)))
      .map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const request = event.request, url = new URL(request.url);
  if (request.method !== 'GET' || url.origin !== baseURL.origin || !url.pathname.startsWith(baseURL.pathname)) return;
  event.respondWith((async () => {
    const cache = await caches.open(CACHE_NAME);
    const clean = new URL(url); clean.search = ''; clean.hash = '';
    const relative = clean.pathname.slice(baseURL.pathname.length);
    const alias = CONFIG.entries.includes(relative) ? './'+(relative || 'index.html') : null;
    const cached = await cache.match(request) || (request.mode === 'navigate' && alias ? await cache.match(alias) : null);
    // Images/fonts are immutable within this content-hashed release. No network wait on reopen.
    if (cached && CONFIG.assets?.['./'+relative]) return cached;
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), cached ? 4000 : 12000);
    try {
      const response = await fetch(request, {signal:controller.signal});
      if (!await acceptable(response, url)) return cached || response;
      const copy = response.clone();
      event.waitUntil(cache.put(request, copy));
      return response;
    } catch {return cached || Response.error();}
    finally {if (timer) clearTimeout(timer);}
  })());
});
