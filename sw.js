// sw.js – Darna Immo Service Worker
const CACHE_NAME = 'darna-immo-v1';

// الملفات التي يتم تخزينها للعمل بدون انترنت
const STATIC_ASSETS = [
  './sakan-dz.html',
  './manifest.json',
  './assets/logo.png',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap'
];

// ── Install: تخزين الملفات ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => {
      return cache.addAll(STATIC_ASSETS);
    })
  );
  self.skipWaiting();
});

// ── Activate: حذف الكاش القديم ──
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(
        keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// ── Fetch: Network first ثم الكاش ──
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // Firebase و Google APIs تعمل دائماً من الشبكة
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('googleapis.com/identitytoolkit') ||
    url.includes('securetoken')
  ) {
    return; // لا تتدخل، اتركها للشبكة مباشرة
  }

  event.respondWith(
    fetch(event.request)
      .then(response => {
        // احفظ نسخة في الكاش إذا الطلب ناجح
        if (response && response.status === 200 && response.type !== 'opaque') {
          const clone = response.clone();
          caches.open(CACHE_NAME).then(cache => cache.put(event.request, clone));
        }
        return response;
      })
      .catch(() => {
        // إذا الشبكة فشلت، ارجع من الكاش
        return caches.match(event.request).then(cached => {
          if (cached) return cached;
          // إذا ما في شيء في الكاش، ارجع الصفحة الرئيسية
          return caches.match('./sakan-dz.html');
        });
      })
  );
});
