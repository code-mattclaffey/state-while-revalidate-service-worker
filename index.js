/*

  @author Matt Claffey

*/

const cachePages = ['/offline', '/', '/?utm_source=homescreen&utm_medium=pwa']
const cacheFiles = []

// Update the version when making changes and pushing up
const cacheName = 'website-cache-v1.0.0'

function onInstall(event) {
  console.log('WORKER: installing')

  event.waitUntil(
    caches
      .open(cacheName)
      .then((cache) => {
        const cacheUrls = cachePages.concat(cacheFiles)
        return cache.addAll(cacheUrls.map((url) => new Request(url, { mode: 'cors' })))
      })
      .then(() => {
        console.log('WORKER: installed')
      })
      .catch((error) => {
        console.error(error)
      }),
  )

  return self.skipWaiting()
}

function onActivate(event) {
  console.log('WORKER: activating')

  const cacheWhitelist = [cacheName]

  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheWhitelist.indexOf(cacheName) === -1) {
            return caches.delete(cacheName)
          }
        }),
      )
    }),
  )

  return self.clients.claim()
}

// https://gist.github.com/surma/eb441223daaedf880801ad80006389f1 stale while revalidate example
function onFetch(event) {
  if (event.request.method !== 'GET') {
    return
  }

  const cached = caches.match(event.request)
  const fetched = fetch(event.request)
  const fetchedCopy = fetched.then((resp) => resp.clone())

  event.respondWith(
    Promise.race([fetched])
      .then((resp) => resp)
      .catch(() => {
        new Response(null, { status: 404 })

        return Promise.all([cached]).then((response) => {
          if (response[0]) {
            return response[0]
          }

          if (event.request.mode === 'navigate') {
            return caches.match('/offline')
          }
        })
      }),
  )

  // Update the cache with the version we fetched
  event.waitUntil(
    Promise.all([fetchedCopy, caches.open(cacheName), cached])
      .then((promises) => {
        const response = promises[0]
        const cache = promises[1]
        const doesExistInCache = promises[2]

        if (doesExistInCache) {
          return cache.put(event.request, response)
        }

        return
      })
      .catch(function (error) {
        console.error(error)
      }),
  )
}

self.addEventListener('install', onInstall)

self.addEventListener('activate', onActivate)

self.addEventListener('fetch', onFetch)
