const CACHE_NAME = 'masterdex-cache-v22';
const STATIC_ASSETS = [
    './index.html',
    './styles.css',
    './app.js',
    './api.js',
    './modal.js',
    './manifest.json',
    './masterball.png',
    'https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css'
];

self.addEventListener('install', (event) => {
    self.skipWaiting(); // Force the waiting service worker to become the active service worker
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('Opened cache');
            return cache.addAll(STATIC_ASSETS);
        })
    );
});

self.addEventListener('fetch', (event) => {
    // Para APIs da pokeapi, tentamos a rede primeiro e guardamos no cache. Se falhar, usamos o cache.
    if (event.request.url.includes('pokeapi.co') || event.request.url.includes('githubusercontent.com')) {
        event.respondWith(
            caches.open(CACHE_NAME).then(async (cache) => {
                try {
                    const response = await fetch(event.request);
                    cache.put(event.request, response.clone());
                    return response;
                } catch (err) {
                    const cachedResponse = await cache.match(event.request);
                    if (cachedResponse) return cachedResponse;
                    throw err;
                }
            })
        );
    } else {
        // Para arquivos estáticos, Cache First. Se não tiver no cache, busca na rede e guarda.
        event.respondWith(
            caches.match(event.request).then((response) => {
                return response || fetch(event.request).then((fetchRes) => {
                    return caches.open(CACHE_NAME).then((cache) => {
                        cache.put(event.request, fetchRes.clone());
                        return fetchRes;
                    });
                });
            })
        );
    }
});

self.addEventListener('activate', (event) => {
    event.waitUntil(
        clients.claim(), // Claim all clients immediately to use the new SW
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cacheName) => {
                    if (cacheName !== CACHE_NAME) {
                        return caches.delete(cacheName);
                    }
                })
            );
        })
    );
});
