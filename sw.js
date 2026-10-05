const CONFIG = {"cachePrefix":"dusk-personal-","legacyCachePrefix":"dusk-study-pet-","required":["./index.html","./cet6-35.js","./atelier.js?v=29","./atelier.css?v=23","./sync-config.js"],"optional":["./dusk-pet.png","./lucide.min.js","./lucide-LICENSE.txt","./development.html","./development-log.json","./development.js?v=25","./development.css?v=25","./DEVELOPMENT.md","./ASSETS.md","./feedback-admin.html","./feedback-admin.css?v=1","./feedback-admin.js?v=1","./feedback-config.js?v=1","./feedback.js?v=2","./assets/fonts/Lora-LICENSE.txt","./assets/fonts/lora.woff2","./assets/fonts/Smiley-LICENSE.txt","./assets/fonts/smiley.woff2","./assets/fonts/WenKai-LICENSE.txt","./assets/fonts/wenkai.woff2","./assets/Motion-LICENSE.txt","./assets/motion.js","./assets/wallpapers/dusk-realm-concept.png","./assets/wallpapers/dusk-studio-concept.png","./share.html","./manifest.webmanifest"],"entries":["","index.html","share.html","development.html","feedback-admin.html"]};
const CACHE_NAME = "dusk-personal-2026.10.06.1-5b229fcf25b1";
const APP_SHELL = CONFIG.required.concat(CONFIG.optional);
const baseURL = new URL('./', self.location.href);

function acceptable(response, url) {
  if (!response.ok) return false;
  const type = response.headers.get('content-type') || '';
  const pathname = new URL(url).pathname;
  if (/\.js$/.test(pathname)) return /javascript/.test(type);
  if (/\.css$/.test(pathname)) return /text\/css/.test(type);
  if (/\.html$/.test(pathname) || pathname.endsWith('/')) return /text\/html/.test(type);
  return true;
}
async function precache(cache, entry, timeout) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), timeout);
  try {
    const request = new Request(new URL(entry, baseURL), {cache:'reload', signal:controller.signal});
    const response = await fetch(request);
    if (!acceptable(response, request.url)) throw new Error('Cache resource unavailable: '+entry);
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
      if (!acceptable(response, url)) return cached || response;
      const copy = response.clone();
      event.waitUntil(cache.put(request, copy));
      return response;
    } catch {return cached || Response.error();}
    finally {if (timer) clearTimeout(timer);}
  })());
});
