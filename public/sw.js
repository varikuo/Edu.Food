// Service worker: приложение устанавливается на телефон и открывается без сети.
// Стратегии простые и предсказуемые:
//   • навигация (HTML) — сеть, при обрыве последняя сохранённая оболочка;
//   • статика сборки (/assets, иконки, фото) — из кеша, фоном обновляем;
//   • /api — только сеть, данные о меню и порциях никогда не кешируем.
const VERSION = 'edufood-v1'
const SHELL = `${VERSION}-shell`
const ASSETS = `${VERSION}-assets`
const SHELL_URL = '/index.html'

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(SHELL)
      .then((cache) => cache.addAll([SHELL_URL, '/manifest.webmanifest', '/icons/icon-192.png']))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => !key.startsWith(VERSION)).map((key) => caches.delete(key)))
      )
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  const { request } = event
  if (request.method !== 'GET') return

  const url = new URL(request.url)
  if (url.origin !== self.location.origin) return
  if (url.pathname.startsWith('/api/')) return // данные всегда свежие

  // Переход по адресу: сначала сеть, иначе оболочка из кеша
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then((response) => {
          const copy = response.clone()
          caches.open(SHELL).then((cache) => cache.put(SHELL_URL, copy))
          return response
        })
        .catch(() => caches.match(SHELL_URL).then((hit) => hit ?? Response.error()))
    )
    return
  }

  // Статика: отдаём из кеша сразу, обновление — в фоне
  event.respondWith(
    caches.match(request).then((hit) => {
      const network = fetch(request)
        .then((response) => {
          if (response.ok) {
            const copy = response.clone()
            caches.open(ASSETS).then((cache) => cache.put(request, copy))
          }
          return response
        })
        .catch(() => hit ?? Response.error())

      return hit ?? network
    })
  )
})
