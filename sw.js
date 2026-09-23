/*
 * 碎片 · 思维收集 — Service Worker
 * 缓存应用外壳（主 HTML / manifest / 图标），实现离线可用与快速启动。
 * 策略：缓存优先，未命中时请求网络并回写缓存；导航请求网络失败时回退缓存外壳。
 * 注意：Service Worker 仅在 http(s) 或 localhost 下生效，file:// 直接打开时不会注册。
 */
'use strict';

var CACHE_NAME = 'fragments-v2';
var APP_SHELL = [
  './',
  './思维碎片收集工具.html',
  './manifest.webmanifest',
  './icon-512.png'
];

self.addEventListener('install', function (event) {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function (cache) { return cache.addAll(APP_SHELL); })
      .then(function () { return self.skipWaiting(); })
  );
});

self.addEventListener('activate', function (event) {
  event.waitUntil(
    caches.keys()
      .then(function (keys) {
        return Promise.all(
          keys.filter(function (key) { return key !== CACHE_NAME; })
              .map(function (key) { return caches.delete(key); })
        );
      })
      .then(function () { return self.clients.claim(); })
  );
});

self.addEventListener('fetch', function (event) {
  var request = event.request;
  if (request.method !== 'GET') return;

  // 导航请求：网络优先，离线时回退缓存外壳
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request)
        .then(function (response) {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
          return response;
        })
        .catch(function () {
          return caches.match(request).then(function (hit) {
            return hit || caches.match('./思维碎片收集工具.html') || caches.match('./');
          });
        })
    );
    return;
  }

  // 其余 GET：缓存优先，未命中则取网络并回写
  event.respondWith(
    caches.match(request).then(function (hit) {
      if (hit) return hit;
      return fetch(request).then(function (response) {
        if (response && response.ok && response.type === 'basic') {
          var copy = response.clone();
          caches.open(CACHE_NAME).then(function (cache) { cache.put(request, copy); });
        }
        return response;
      });
    })
  );
});