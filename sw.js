// OMR 토익 서비스 워커 — 앱 껍데기만 캐시한다. Supabase/Claude 요청은 항상 네트워크로.
// 앱 파일을 고치면 VERSION 을 올려야 폰에 새 버전이 깔린다.
const VERSION = 'omr-v3';
const SHELL = ['./', './index.html', './manifest.webmanifest', './data/seed.json',
  './icons/icon-180.png', './icons/icon-192.png', './icons/icon-512.png'];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(VERSION).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', e => {
  e.waitUntil(caches.keys().then(ks => Promise.all(ks.filter(k => k !== VERSION).map(k => caches.delete(k))))
    .then(() => self.clients.claim()));
});
self.addEventListener('fetch', e => {
  const url = new URL(e.request.url);
  if (e.request.method !== 'GET' || url.origin !== location.origin) return; // API·폰트는 건드리지 않음
  // 네트워크 우선, 실패하면 캐시 (오프라인에서도 앱이 열리게)
  e.respondWith(fetch(e.request).then(r => {
    const copy = r.clone(); caches.open(VERSION).then(c => c.put(e.request, copy)); return r;
  }).catch(() => caches.match(e.request).then(r => r || caches.match('./index.html'))));
});
