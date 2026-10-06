const CONFIG = {"cachePrefix":"dusk-personal-","legacyCachePrefix":"dusk-study-pet-","required":["./index.html","./cet6-35.js","./atelier.js?v=30","./atelier.css?v=24","./sync-config.js"],"optional":["./dusk-pet.png","./lucide.min.js","./lucide-LICENSE.txt","./development.html","./development-log.json","./development.js?v=25","./development.css?v=25","./DEVELOPMENT.md","./ASSETS.md","./feedback-admin.html","./feedback-admin.css?v=1","./feedback-admin.js?v=1","./feedback-config.js?v=1","./feedback.js?v=2","./assets/dusk-pet.webp","./assets/Motion-LICENSE.txt","./assets/motion.js","./assets/wallpapers/dusk-realm-concept-preview.webp","./assets/wallpapers/dusk-realm-concept.webp","./assets/wallpapers/dusk-studio-concept-preview.webp","./assets/wallpapers/dusk-studio-concept.webp","./share.html","./manifest.webmanifest","./assets/fonts/Lora-LICENSE.txt","./assets/fonts/lora.woff2","./assets/fonts/Smiley-LICENSE.txt","./assets/fonts/smiley.woff2","./assets/fonts/WenKai-LICENSE.txt","./assets/fonts/wenkai.woff2"],"assets":{"./dusk-pet.png":"9aadf875aa5c2f060729aec4670330031267e3afe3fdcfe0039b2ac5efb12e74","./assets/dusk-pet.webp":"158457f71c08487e343bfdd49f54cbfc5e11755157c2d6bec06cf2e8159fe49b","./assets/fonts/lora.woff2":"7bbfe9f3c9e9d6d07e17da4d5229a42b042cc2e16024993cb687dc08cc762557","./assets/fonts/smiley.woff2":"4895e7a5b72753b7d4bf090581fbc4375e0ec53484944f369a584588f1eeaf08","./assets/fonts/wenkai.woff2":"013fa90e3e7c3b30aeb0a5311ef92d9aee0d3def5817bc27c357198796d34306","./assets/wallpapers/dusk-realm-concept-preview.webp":"0c30b48f523e481b200381fdf58f8aec9c3845d02fb1c06ea950b080ef8d67be","./assets/wallpapers/dusk-realm-concept.webp":"90b97f5424b8217d330caab44f7a0a5704c892edfdeb6f2582389f397f40d5ae","./assets/wallpapers/dusk-studio-concept-preview.webp":"a3ea1f6d3193e3c09be6a738e8134a1ac6a02e5765ea6f4dec65a01abdae531a","./assets/wallpapers/dusk-studio-concept.webp":"40c9df9301075b39afa9c983f783ab367caf9513bed9e77c7b546bb14a75d892"},"entries":["","index.html","share.html","development.html","feedback-admin.html"]};
const CACHE_NAME = "dusk-personal-2026.10.06.2-b5d261ad04d6";
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
