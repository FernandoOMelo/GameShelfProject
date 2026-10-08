// Service worker do GameShelf (ADR-015). Arquivo estático, sem bundler: tudo que ele precisa está aqui.
// Só funciona em contexto seguro (HTTPS ou localhost); em HTTP na rede local o navegador não o registra.
const VERSION = 'gameshelf-v1';
const SHELL = ['/', '/manifest.webmanifest', '/icon-192.png', '/icon-512.png'];

self.addEventListener('install', (event) => {
  event.waitUntil(caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return; // escritas nunca são interceptadas: a fila offline fica no app
  const url = new URL(request.url);
  if (url.origin !== self.location.origin || url.pathname === '/sw.js') return;

  if (url.pathname.startsWith('/api/')) {
    if (url.pathname.startsWith('/api/backup')) return; // arquivos grandes e sensíveis: sempre da rede
    event.respondWith(networkFirst(request, request, true));
  } else if (request.mode === 'navigate') {
    event.respondWith(networkFirst(request, '/', false)); // SPA: qualquer rota cai no index.html em cache
  } else if (url.pathname.startsWith('/assets/') || url.pathname.startsWith('/media/') || SHELL.includes(url.pathname)) {
    event.respondWith(cacheFirst(request));
  }
});

// Rede primeiro: dados atualizados quando há conexão; a última resposta guardada quando não há.
async function networkFirst(request, cacheKey, isApi) {
  const cache = await caches.open(VERSION);
  try {
    const response = await fetch(request);
    if (response.status === 200) await cache.put(cacheKey, response.clone());
    return response;
  } catch {
    const cached = await cache.match(cacheKey);
    if (cached) return cached;
    return isApi
      ? new Response(JSON.stringify({ error: 'Sem conexão e sem dados guardados para esta consulta.' }), { status: 503, headers: { 'content-type': 'application/json' } })
      : Response.error();
  }
}

// Arquivos com hash no nome (assets) e mídia são imutáveis: cache primeiro.
async function cacheFirst(request) {
  const cache = await caches.open(VERSION);
  const cached = await cache.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.status === 200) await cache.put(request, response.clone());
  return response;
}
