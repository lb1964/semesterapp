const CACHE_NAME = 'semesterklockan-v1';

// Kritiska filer och externa CDN-resurser som bygger upp gränssnittet
const ASSETS_TO_CACHE = [
  './',
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
  'https://cdn.tailwindcss.com',
  'https://cdn.jsdelivr.net/npm/canvas-confetti@1.6.0/dist/confetti.browser.min.js',
  'https://fonts.googleapis.com/css2?family=Roboto:wght@300;400;500;700;900&family=Plus+Jakarta+Sans:wght@600;700;800&display=swap',
  'https://fonts.googleapis.com/css2?family=Material+Symbols+Rounded:opsz,wght,FILL,GRAD@24,400,1,0'
];

// Installation: Förhandscacha App Shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // Använd catch så att en enskild resurs (t.ex. saknad ikon i utvecklingsmiljö) inte avbryter registreringen
      return Promise.allSettled(
        ASSETS_TO_CACHE.map((url) =>
          cache.add(url).catch((err) => console.warn(`Kunde inte förhandscacha: ${url}`, err))
        )
      );
    }).then(() => self.skipWaiting())
  );
});

// Aktivering: Rensa äldre cacheversioner
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.map((key) => {
          if (key !== CACHE_NAME) {
            return caches.delete(key);
          }
        })
      );
    }).then(() => self.clients.claim())
  );
});

// Fetch: Strategisk hämtning beroende på typ av anrop
self.addEventListener('fetch', (event) => {
  const requestUrl = new URL(event.request.url);

  // Ignorera anrop som inte är GET
  if (event.request.method !== 'GET') return;

  // 1. Externa dynamiska API-anrop (Väder & Valuta): Network-First
  if (
    requestUrl.hostname.includes('open-meteo.com') ||
    requestUrl.hostname.includes('er-api.com')
  ) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response && response.status === 200) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // 2. Statiska tillgångar, CDN & HTML: Stale-While-Revalidate / Cache-First
  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Hämta en uppdaterad version i bakgrunden för Google Fonts/stilar vid nätverksåtkomst
        fetch(event.request)
          .then((networkResponse) => {
            if (networkResponse && networkResponse.status === 200) {
              caches.open(CACHE_NAME).then((cache) => cache.put(event.request, networkResponse));
            }
          })
          .catch(() => {});
        return cachedResponse;
      }

      // Om resursen inte fanns i cache, hämta via nätverk och spara
      return fetch(event.request).then((networkResponse) => {
        if (!networkResponse || networkResponse.status !== 200) {
          return networkResponse;
        }
        const clone = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
        return networkResponse;
      });
    })
  );
});
