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
async function precache(cache, entry, timeout) {
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
    await Promise.allSettled(CONFIG.optional.map(entry => precache(cache, entry, 5000)));
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
    const controller = new AbortController();
    const timer = cached ? setTimeout(() => controller.abort(), 4000) : null;
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
