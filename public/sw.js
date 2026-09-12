/*
 * HUMAN service worker.
 *
 * Deliberately conservative. Gameplay is server-scored and the daily manifest
 * changes at midnight UTC, so nothing under /api or /play is ever served from
 * a cache — a stale run would be worse than no run. What it does do is make
 * the shell and the icons load instantly on a repeat visit, and show a real
 * page instead of a browser error when the network drops.
 */

const VERSION = 'human-v1';
const SHELL = ['/offline.html', '/icons/icon.svg', '/manifest.webmanifest'];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(VERSION).then((cache) => cache.addAll(SHELL)).then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key !== VERSION).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;
  if (url.pathname.startsWith('/api/')) return;

  // Navigations: network first, offline page as the fallback.
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(() => caches.match('/offline.html').then((cached) => cached ?? Response.error())),
    );
    return;
  }

  // Static assets: cache first, refresh in the background.
  if (url.pathname.startsWith('/_next/static/') || url.pathname.startsWith('/icons/')) {
    event.respondWith(
      caches.match(request).then((cached) => {
        const network = fetch(request)
          .then((response) => {
            if (response.ok) {
              const copy = response.clone();
              caches.open(VERSION).then((cache) => cache.put(request, copy));
            }
            return response;
          })
          .catch(() => cached);
        return cached ?? network;
      }),
    );
  }
});
