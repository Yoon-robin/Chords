// 오프라인 지원: 페이지는 네트워크 우선(새 버전 바로 반영), 해시가 붙은 에셋은 캐시 우선
const CACHE = 'chordbook-v2';
const SHELL = ['./', './index.html', './icon.svg', './app-icon.svg', './manifest.webmanifest'];

self.addEventListener('install', (e) => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then((c) => c.addAll(SHELL)));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

// 첫 방문에는 워커가 뜨기 전에 받은 파일이 캐시에 없으므로, 페이지가 목록을 보내 주면 담아 둔다
self.addEventListener('message', (e) => {
  if (e.data?.type !== 'cache' || !Array.isArray(e.data.urls)) return;
  const urls = e.data.urls.filter((u) => typeof u === 'string' && new URL(u).origin === self.location.origin);
  e.waitUntil(caches.open(CACHE).then((c) => Promise.all(urls.map((u) => c.add(u).catch(() => undefined)))));
});

self.addEventListener('fetch', (e) => {
  const req = e.request;
  if (req.method !== 'GET' || new URL(req.url).origin !== self.location.origin) return;

  if (req.mode === 'navigate') {
    e.respondWith(
      fetch(req)
        .then((res) => {
          const copy = res.clone();
          void caches.open(CACHE).then((c) => c.put('./index.html', copy));
          return res;
        })
        .catch(() => caches.match('./index.html')),
    );
    return;
  }

  e.respondWith(
    caches.match(req).then(
      (hit) =>
        hit ||
        fetch(req).then((res) => {
          if (res.ok) {
            const copy = res.clone();
            void caches.open(CACHE).then((c) => c.put(req, copy));
          }
          return res;
        }),
    ),
  );
});
