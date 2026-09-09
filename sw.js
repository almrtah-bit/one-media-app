const CACHE_NAME = 'onemedia-pwa-v2';

// قائمة الملفات الأساسية المراد تخزينها للعمل السريع ودعم وضع الأوفلاين
const ASSETS_TO_CACHE = [
    './',
    './index.html',
    './manifest.json',
    './assets/css/styles.css',
    './app.js',
    './assets/icons/icon-192.png',
    './assets/icons/icon-512.png'
];

// 1. تثبيت الـ Service Worker وحفظ ملفات النظام الأساسية
self.addEventListener('install', (event) => {
    event.waitUntil(
        caches.open(CACHE_NAME).then((cache) => {
            console.log('✅ [Service Worker] Caching assets');
            return cache.addAll(ASSETS_TO_CACHE);
        })
    );
    self.skipWaiting();
});

// 2. تفعيل الـ Service Worker وتنظيف ذاكرة التخزين القديمة عند التحديث
self.addEventListener('activate', (event) => {
    event.waitUntil(
        caches.keys().then((cacheNames) => {
            return Promise.all(
                cacheNames.map((cache) => {
                    if (cache !== CACHE_NAME) {
                        console.log('🧹 [Service Worker] Deleting old cache:', cache);
                        return caches.delete(cache);
                    }
                })
            );
        })
    );
    self.clients.claim();
});

// 3. الاستجابة لطلبات التصفح (تخزين جلب الملفات للسرعة وتجاوز مشاكل الأوفلاين)
self.addEventListener('fetch', (event) => {
    // تجاهل طلبات Firebase الخارجية حتى لا تتأثر المزامنة المباشرة
    if (event.request.url.includes('firebase') || event.request.url.includes('gstatic.com')) {
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) {
                return cachedResponse;
            }
            
            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || networkResponse.status !== 200 || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });

                return networkResponse;
            });
        }).catch(() => {
            if (event.request.mode === 'navigate') {
                return caches.match('./index.html');
            }
        })
    );
});