const CACHE_NAME = "dusk-study-pet-v22-word-layouts";
const APP_SHELL = ["./", "./index.html", "./dusk-pet.png", "./manifest.webmanifest", "./sync-config.js", "./cet6-35.js", "./experience.js?v=21", "./lucide.min.js", "./atelier.js?v=22", "./atelier.css?v=22", "./assets/motion.js", "./assets/fonts/smiley.woff2", "./assets/fonts/wenkai.woff2", "./assets/fonts/lora.woff2", "./assets/wallpapers/dusk-studio-concept.png", "./assets/wallpapers/dusk-realm-concept.png"];

self.addEventListener("install", event => {
  event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.addAll(APP_SHELL)));
  self.skipWaiting();
});

self.addEventListener("activate", event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith("dusk-study-pet-") && key !== CACHE_NAME).map(key => caches.delete(key)))));
  self.clients.claim();
});

self.addEventListener("fetch", event => {
  if (event.request.method !== "GET") return;
  const requestUrl = new URL(event.request.url);
  if (requestUrl.origin !== self.location.origin) {
    event.respondWith(fetch(event.request));
    return;
  }
  event.respondWith((async () => {
    const cached = await caches.match(event.request) || (event.request.mode === "navigate" ? await caches.match("./index.html") : null);
    const controller = new AbortController();
    // A cached launch should not wait indefinitely on a weak mobile connection.
    const timer = event.request.mode === "navigate" && cached ? setTimeout(() => controller.abort(), 4000) : null;
    try {
      const response = await fetch(event.request, { signal: controller.signal });
      if (response.ok) {
        const copy = response.clone();
        event.waitUntil(caches.open(CACHE_NAME).then(cache => cache.put(event.request, copy)));
      }
      return response;
    } catch { return cached || Response.error(); }
    finally { if (timer) clearTimeout(timer); }
  })());
});
