const CACHE_NAME = 'rhyme-lab-v1';
const ASSETS = [
  './',
  './index.html',
  './style.css',
  './app.js',
  './families.js',
  './manifest.json'
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(ASSETS))
  );
});

self.addEventListener('fetch', event => {
  // If it's an API call to datamuse, bypass cache and only use network (unless offline)
  if (event.request.url.includes('api.datamuse.com')) {
    event.respondWith(
      fetch(event.request).catch(() => {
        // Return a mock empty response to let app.js fall back to local dictionary
        return new Response(JSON.stringify([]), {
          headers: { 'Content-Type': 'application/json' }
        });
      })
    );
    return;
  }

  // Cache-first for local assets
  event.respondWith(
    caches.match(event.request).then(response => {
      return response || fetch(event.request);
    })
  );
});
