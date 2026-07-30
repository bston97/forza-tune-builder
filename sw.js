/* FH6 Tune Builder service worker — network-first so a push always wins,
   cache as the offline fallback. The whole app is one self-contained file with
   no external requests, so once the shell is cached it works with no signal at
   all: useful when the phone is sat next to a console rather than on wifi. */
var CACHE = "fh6-tune-v1";
var SHELL = ["./", "./index.html", "./manifest.json",
             "./icon-192.png", "./icon-512.png", "./apple-touch-icon.png", "./favicon-32.png"];

self.addEventListener("install", function (e) {
  e.waitUntil(
    caches.open(CACHE)
      .then(function (c) { return c.addAll(SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener("activate", function (e) {
  e.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(keys.map(function (k) {
          return k === CACHE ? null : caches.delete(k);
        }));
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener("fetch", function (e) {
  if (e.request.method !== "GET") return;
  e.respondWith(
    fetch(e.request)
      .then(function (res) {
        // Only cache same-origin successes; an opaque or errored response
        // would otherwise poison the offline copy.
        if (res && res.ok && new URL(e.request.url).origin === self.location.origin) {
          var copy = res.clone();
          caches.open(CACHE).then(function (c) { c.put(e.request, copy); });
        }
        return res;
      })
      .catch(function () {
        return caches.match(e.request).then(function (hit) {
          // Navigations that miss the cache still need something to render.
          return hit || (e.request.mode === "navigate" ? caches.match("./index.html") : undefined);
        });
      })
  );
});
