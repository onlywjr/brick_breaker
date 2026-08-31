const CACHE_NAME = 'babymonster-game-v1';

// 1. 安裝階段：強制立即接管控制權
self.addEventListener('install', event => {
  self.skipWaiting();
});

// 2. 啟用階段：清除舊版本的快取（如果有更新的話）
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(cacheNames => {
      return Promise.all(
        cacheNames.map(cache => {
          if (cache !== CACHE_NAME) {
            return caches.delete(cache);
          }
        })
      );
    }).then(() => clients.claim())
  );
});

// 3. 攔截請求階段（核心離線邏輯）
self.addEventListener('fetch', event => {
  // 只處理 GET 請求
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then(cachedResponse => {
      // 如果手機裡已經有快取檔案，直接秒速讀取 (支援離線)
      if (cachedResponse) {
        return cachedResponse;
      }

      // 如果沒有快取，就透過網路下載
      return fetch(event.request).then(networkResponse => {
        // 確保下載成功，然後把檔案偷偷存進手機快取裡
        if (networkResponse && networkResponse.status === 200 && networkResponse.type === 'basic') {
          const responseToCache = networkResponse.clone();
          caches.open(CACHE_NAME).then(cache => {
            cache.put(event.request, responseToCache);
          });
        }
        return networkResponse;
      }).catch(() => {
        // 如果網路斷線，且是首頁請求，可以設定預設回傳什麼 (進階)
        console.log('處於離線狀態，且沒有對應快取檔案');
      });
    })
  );
});