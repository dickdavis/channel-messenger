/* global self, caches */

const CACHE_NAME = 'channel-messenger-v2'
const PRECACHE_URLS = ['/']

function clientMatchesUrl (clientUrl, targetUrl) {
  try {
    const parsed = new URL(clientUrl)
    return parsed.pathname + parsed.search === targetUrl
  } catch (e) {
    return false
  }
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(() => self.skipWaiting())
  )
})

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(
        keys
          .filter((key) => key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      ))
      .then(() => self.clients.claim())
  )
})

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return
  const url = new URL(event.request.url)
  if (url.pathname.startsWith('/api/')) return

  event.respondWith(
    fetch(event.request)
      .then((response) => {
        const clone = response.clone()
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone))
        return response
      })
      .catch(() => caches.match(event.request))
  )
})

self.addEventListener('push', (event) => {
  if (!event.data) return

  let data
  try {
    data = event.data.json()
  } catch (e) {
    return
  }

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        const sessionUrl = data.url || '/'
        const isFocused = clients.some(function (client) {
          return client.visibilityState === 'visible' &&
            clientMatchesUrl(client.url, sessionUrl)
        })
        if (isFocused) return

        return self.registration.showNotification(data.title || 'New message', {
          body: data.body || '',
          icon: '/favicon.png',
          data: { url: sessionUrl },
          tag: sessionUrl
        })
      })
  )
})

self.addEventListener('notificationclick', (event) => {
  event.notification.close()
  const url = (event.notification.data && event.notification.data.url) || '/'

  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true })
      .then((clients) => {
        if (clients.length > 0) {
          const exact = clients.find(function (c) {
            return clientMatchesUrl(c.url, url)
          })
          if (exact) return exact.focus()
          return clients[0].navigate(url).then(function (c) { if (c) return c.focus() })
        }
        return self.clients.openWindow(url)
      })
  )
})
