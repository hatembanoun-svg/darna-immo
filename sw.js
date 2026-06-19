// sw.js – Darna Immo Service Worker
const CACHE_NAME = 'darna-immo-v2';

// الملفات التي يتم تخزينها للعمل بدون انترنت
const STATIC_ASSETS = [
  './',
  './index.html',
  './manifest.json',
  './assets/logo.png',
  'https://fonts.googleapis.com/css2?family=Cairo:wght@400;600;700;900&display=swap'
];

// ── Install: تخزين الملفات ──
self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
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

// ── Fetch ──
// قاعدة عامة:
// - Firebase / Google APIs: تذهب للشبكة مباشرة دائماً (بيانات حية، لا تُخزَّن).
// - باقي الملفات الثابتة (HTML/CSS/JS/الخطوط/الصور): Cache-first مع تحديث في الخلفية (stale-while-revalidate)
//   هذا يجعل فتح التطبيق فورياً حتى بدون انترنت، مع تحديث الكاش كل مرة تتوفر فيها الشبكة.
self.addEventListener('fetch', event => {
  const url = event.request.url;

  // اطلب من المتصفح تجاهل أي شيء ليس GET (مثل POST لـ Firestore)
  if (event.request.method !== 'GET') return;

  // Firebase و Google APIs تعمل دائماً من الشبكة مباشرة، بدون أي تدخل من الكاش
  if (
    url.includes('firestore.googleapis.com') ||
    url.includes('firebase') ||
    url.includes('googleapis.com/identitytoolkit') ||
    url.includes('securetoken') ||
    url.includes('gstatic.com/firebasejs')
  ) {
    return; // اترك المتصفح يتعامل مع الطلب مباشرة
  }

  event.respondWith(
    caches.open(CACHE_NAME).then(async cache => {
      const cached = await cache.match(event.request);

      // ابدأ طلب شبكة بالتوازي لتحديث الكاش (لا ننتظره إن وُجد كاش)
      const networkFetch = fetch(event.request)
        .then(response => {
          if (response && response.status === 200) {
            cache.put(event.request, response.clone());
          }
          return response;
        })
        .catch(() => null);

      // إن وُجدت نسخة في الكاش، أعطها فوراً (سرعة قصوى)
      if (cached) {
        networkFetch; // حدّث الكاش بالخلفية بدون انتظار
        return cached;
      }

      // إن لم توجد نسخة في الكاش، انتظر الشبكة
      const networkResponse = await networkFetch;
      if (networkResponse) return networkResponse;

      // فشلت الشبكة ولا يوجد كاش: ارجع للصفحة الرئيسية كحل أخير
      return cache.match('./index.html');
    })
  );
});
