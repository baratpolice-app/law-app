// Simple cache-first service worker so the app shell (and the last-synced
// question data, which the app already stores in localStorage) still opens
// with no internet connection. The app's own "সিঙ্ক করুন" button is what
// pulls fresh questions from your Google Sheet when online.

var CACHE_NAME = "exam-app-shell-v3";
var APP_SHELL = [
  "./",
  "./index.html",
  "./practice.html",
  "./mock.html",
  "./history.html",
  "./profile.html",
  "./settings.html",
  "./leaderboard.html",
  "./quiz.html",
  "./result.html",
  "./app.js",
  "./styles.css",
  "./manifest.json",
  "./icon-192.png",
  "./icon-512.png",
  "./icon-512-maskable.png"
];

self.addEventListener("install", function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME).then(function (cache) {
      return cache.addAll(APP_SHELL);
    })
  );
  self.skipWaiting();
});

self.addEventListener("activate", function (event) {
  event.waitUntil(
    caches.keys().then(function (keys) {
      return Promise.all(
        keys
          .filter(function (key) { return key !== CACHE_NAME; })
          .map(function (key) { return caches.delete(key); })
      );
    })
  );
  self.clients.claim();
});

self.addEventListener("fetch", function (event) {
  // Only handle same-origin GET requests (the app's own files).
  // Requests to script.google.com (the sync) always go to the network.
  if (event.request.method !== "GET" || !event.request.url.startsWith(self.location.origin)) {
    return;
  }
  event.respondWith(
    caches.match(event.request).then(function (cached) {
      var network = fetch(event.request)
        .then(function (response) {
          if (response && response.ok) {
            var copy = response.clone();
            caches.open(CACHE_NAME).then(function (cache) { cache.put(event.request, copy); });
          }
          return response;
        })
        .catch(function () { return cached; });
      return cached || network;
    })
  );
});
