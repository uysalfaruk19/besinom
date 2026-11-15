// Besinom çevrimdışı önbelleği (yalnız web; iOS uygulamasında dosyalar zaten pakette).
// İlke: ağ varsa her zaman güncel dosya (ağ önce), ağ yoksa son kaydedilen kopya.
// Sağlık verisi önbelleğe alınmaz: yalnız aynı kökenden GET ile gelen uygulama dosyaları saklanır, /api/ hiç saklanmaz.
const SURUM = 'besinom-v1';
// Bu liste scripts/kontrol.mjs tarafından denetlenir: her dosya www/ içinde bulunmalı.
const DOSYALAR = [
  '/besinai-css/app-v4.css',
  '/besinai-css/besinai-mobile.css',
  '/besinai-css/tabbar.css',
  '/besinai-js/besinai-safety.js',
  '/besinai-js/besinai-v4-core.js',
  '/besinai-js/besinai-data.js',
  '/besinai-js/besinai-engine.js',
  '/besinai-js/besinai-menu.js',
  '/besinai-js/besinai-feedback.js',
  '/besinai-js/besinai-core.js',
  '/besinai-js/besinai-ai.js',
  '/besinai-js/besinai-app.js',
  '/besinai-js/besinai-tabbar.js',
  '/besinai-data/tarifler.txt',
  '/besinai-brand.svg',
  '/besinai-icon-180.png',
  '/besinai-icon-192.png',
  '/besinai-manifest.webmanifest',
];

self.addEventListener('install', (e) => {
  const sayfa = new URL(self.registration.scope).pathname;
  // Biri bulunamazsa kurulum düşmesin diye her dosya ayrı eklenir.
  e.waitUntil(caches.open(SURUM).then((c) => Promise.allSettled([sayfa, ...DOSYALAR].map((u) => c.add(u)))).then(() => self.skipWaiting()));
});

self.addEventListener('activate', (e) => {
  e.waitUntil(caches.keys().then((ks) => Promise.all(ks.filter((k) => k !== SURUM).map((k) => caches.delete(k)))).then(() => self.clients.claim()));
});

self.addEventListener('fetch', (e) => {
  const r = e.request;
  const u = new URL(r.url);
  if (r.method !== 'GET' || u.origin !== self.location.origin || u.pathname.startsWith('/api/')) return;
  e.respondWith(
    fetch(r)
      .then((yanit) => {
        if (yanit.ok && yanit.type === 'basic') {
          const kopya = yanit.clone();
          caches.open(SURUM).then((c) => c.put(r, kopya));
        }
        return yanit;
      })
      .catch(async () => {
        // tarifler.txt?v=... gibi sürüm parametreli istekler parametresiz kopyayla da karşılanır.
        const hit = (await caches.match(r)) || (await caches.match(r, { ignoreSearch: true }));
        if (hit) return hit;
        if (r.mode === 'navigate') return caches.match(new URL(self.registration.scope).pathname);
        return Response.error();
      })
  );
});
