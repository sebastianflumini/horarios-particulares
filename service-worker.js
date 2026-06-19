// Service worker for "Horarios Particulares" — enables offline use and installability.
// No data ever passes through here: it only caches the static app files (HTML/CSS/JS/icons
// and the 3 CDN libraries). All schedules/payments stay in the browser's localStorage on
// whichever device opens the app — this file does not sync or transmit any of that data.

var CACHE_NAME = "horarios-particulares-v2";
var PRECACHE_URLS = [
  "./",
  "./index.html",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "https://cdnjs.cloudflare.com/ajax/libs/xlsx/0.18.5/xlsx.full.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js",
  "https://cdnjs.cloudflare.com/ajax/libs/jspdf-autotable/3.8.2/jspdf.plugin.autotable.min.js"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return Promise.all(
        PRECACHE_URLS.map(function (url) {
          return cache.add(url).catch(function () {
            /* ignore individual failures, e.g. first install while offline */
          });
        })
      );
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) {
            return key !== CACHE_NAME;
          })
          .map(function (key) {
            return caches.delete(key);
          })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  if (event.request.method !== "GET") return;

  var isHtmlRequest =
    event.request.mode === "navigate" ||
    event.request.url.indexOf("index.html") !== -1;

  if (isHtmlRequest) {
    // Network-first for the app shell: always try to fetch the latest index.html
    // so updates show up immediately. Falls back to the cached copy only when
    // there's no network (offline use), so the app keeps working without wifi/datos.
    event.respondWith(
      fetch(event.request)
        .then(function (response) {
          if (response && response.status === 200) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, copy);
            });
          }
          return response;
        })
        .catch(function () {
          return caches.match(event.request).then(function (cached) {
            return cached || caches.match("./index.html");
          });
        })
    );
    return;
  }

  // Cache-first for static assets (icons, manifest, CDN libraries) — these rarely
  // change, so we serve them instantly from cache and only hit the network the
  // first time or when missing.
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      if (cached) return cached;

      return fetch(event.request)
        .then(function (response) {
          if (response && response.status === 200) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) {
              cache.put(event.request, copy);
            });
          }
          return response;
        })
        .catch(function () {});
    })
  );
});
