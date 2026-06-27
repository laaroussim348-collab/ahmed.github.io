// Service Worker minimal — uniquement requis pour que Chrome/Brave considèrent
// cette page comme une PWA installable. On ne met rien en cache de façon agressive
// ici (l'app a besoin de toujours charger les dernières tuiles satellite et la
// dernière version du KML synchronisé), on se contente de laisser passer les requêtes
// normalement vers le réseau.
self.addEventListener('install', (event) => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', (event) => {
  event.respondWith(fetch(event.request));
});
