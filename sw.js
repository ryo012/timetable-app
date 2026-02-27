// ============================================================
//  時間割マネージャー - Service Worker
//  戦略: Cache First（アプリシェル）+ Network First（GAS API）
//  GitHub Pages パス: /timetable-app/sw.js
// ============================================================

const CACHE_NAME = 'timetable-v3';

// キャッシュするアプリシェルのリソース
const APP_SHELL = [
  '/timetable-app/',
  '/timetable-app/index.html',
];

// CDNリソース（外部URL）
const CDN_RESOURCES = [
  'https://unpkg.com/react@18/umd/react.production.min.js',
  'https://unpkg.com/react-dom@18/umd/react-dom.production.min.js',
  'https://unpkg.com/@babel/standalone/babel.min.js',
  'https://cdn.tailwindcss.com',
];

// インストール時にアプリシェルをキャッシュ
self.addEventListener('install', (event) => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      // ローカルリソースをキャッシュ
      cache.addAll(APP_SHELL).catch((e) => console.warn('[SW] App shell cache failed:', e));
      // CDNリソースをキャッシュ（失敗しても続行）
      CDN_RESOURCES.forEach((url) => {
        cache.add(url).catch(() => {});
      });
    })
  );
});

// アクティベート時に古いキャッシュを削除
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key))
      )
    ).then(() => self.clients.claim())
  );
});

// フェッチ処理
self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // GAS APIへのリクエストはキャッシュしない（常にネットワーク）
  if (url.hostname.includes('script.google.com') || url.hostname.includes('googleusercontent.com')) {
    return;
  }

  // index.html: Network First（常に最新を取得）、失敗時はキャッシュ
  if (url.pathname.endsWith('/') || url.pathname.endsWith('/index.html')) {
    event.respondWith(
      fetch(event.request)
        .then((response) => {
          if (response.ok) {
            const clone = response.clone();
            caches.open(CACHE_NAME).then((cache) => cache.put(event.request, clone));
          }
          return response;
        })
        .catch(() => caches.match(event.request))
    );
    return;
  }

  // CDNリソース: Stale-While-Revalidate（キャッシュを即返しつつバックグラウンドで更新）
  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      cache.match(event.request).then((cached) => {
        const networkFetch = fetch(event.request).then((response) => {
          if (response.ok) cache.put(event.request, response.clone());
          return response;
        }).catch(() => {});

        return cached || networkFetch;
      })
    )
  );
});
