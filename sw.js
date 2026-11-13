const CACHE = 'seiko-offline-6'

const PRE_CACHE = [
  './',
  './index.html',
  './assets/app.js',
  './assets/app.css',
  './manifest.json',
  './logo-studio-seiko.png',
  './icon-192.png',
  './icon-512.png',
]

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(PRE_CACHE).catch(() => {}))
      .then(() => self.skipWaiting()),
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((chaves) => Promise.all(chaves.filter((chave) => chave !== CACHE).map((chave) => caches.delete(chave))))
      .then(() => self.clients.claim()),
  )
})

self.addEventListener('fetch', (event) => {
  const req = event.request
  if (req.method !== 'GET') return
  const url = new URL(req.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.includes('/api/')) return

  event.respondWith((async () => {
    const cache = await caches.open(CACHE)

    // Se é navegação (abrir a página no navegador)
    if (req.mode === 'navigate') {
      try {
        const controller = new AbortController()
        const timeoutId = setTimeout(() => controller.abort(), 2000)
        const res = await fetch(req, { signal: controller.signal })
        clearTimeout(timeoutId)
        if (res && res.ok) {
          cache.put(req, res.clone())
          return res
        }
      } catch {
        /* se der erro de rede ou timeout, usa o cache local */
      }
      const salvo = (await cache.match(req)) || (await cache.match('./index.html')) || (await cache.match('./'))
      if (salvo) return salvo
    }

    // Para arquivos estáticos (JS, CSS, imagens, manifest): Cache First com atualização em background
    const salvo = await cache.match(req)
    if (salvo) {
      fetch(req).then((res) => {
        if (res && res.ok) cache.put(req, res.clone())
      }).catch(() => {})
      return salvo
    }

    try {
      const res = await fetch(req)
      if (res && res.ok) cache.put(req, res.clone())
      return res
    } catch {
      if (req.mode === 'navigate') {
        const fallback = (await cache.match('./index.html')) || (await cache.match('./'))
        if (fallback) return fallback
      }
      return Response.error()
    }
  })())
})
