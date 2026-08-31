// Service worker mínimo, solo para cumplir el criterio de instalabilidad de Chrome
// ("Añadir a inicio" como app). No cachea nada a propósito -precios y disponibilidad
// de la carta tienen que llegar siempre frescos desde GitHub, nunca desde caché-.
self.addEventListener('install', () => self.skipWaiting());
self.addEventListener('activate', (event) => event.waitUntil(self.clients.claim()));
self.addEventListener('fetch', (event) => event.respondWith(fetch(event.request)));
