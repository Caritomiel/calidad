const CACHE_NAME = "estroktor-control-v8";
const ASSETS = [
  "./",
  "./index.html",
  "./styles.css",
  "./styles.css?v=8",
  "./app.js",
  "./app.js?v=8",
  "./manifest.webmanifest",
  "./manifest.webmanifest?v=8",
  "./icon.svg"
];

self.addEventListener("install", (event) => {
  event.waitUntil(caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS)));
});

self.addEventListener("activate", (event) => {
  event.waitUntil(
    caches.keys().then((keys) => Promise.all(
      keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
    ))
  );
});

self.addEventListener("fetch", (event) => {
  if (event.request.method !== "GET") return;
  event.respondWith(
    caches.match(event.request).then((cached) => cached || fetch(event.request))
  );
});
