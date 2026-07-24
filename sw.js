// ─────────────────────────────────────────────────────────────
//  SERVICE WORKER — app-shell offline (Hard requirement #10)
//
//  Firestore's persistent cache keeps the DATA offline. This
//  keeps the APP offline. Without it, network off = blank page
//  and the cached data has nothing to render it.
//
//  CACHE_NAME is derived from APP_VERSION, so bumping the version
//  invalidates the old shell automatically.
// ─────────────────────────────────────────────────────────────
import { CACHE_NAME } from './js/version.js';

const SHELL = [
  './',
  './index.html',
  './styles.css',
  './manifest.webmanifest',
  './vendor/mustache.mjs',
  './vendor/firebase.js',
  './js/version.js',
  './js/config.js',
  './js/fb.js',
  './js/util.js',
  './js/schema.js',
  './js/seed.js',
  './js/store.js',
  './js/render.js',
  './js/backup.js',
  './js/reformat-engine.js',
  './js/app.js',
  './js/sections/index.js',
  './js/ui/shell.js',
  './js/ui/formatted-box.js',
  './js/ui/auth.js',
  './js/ui/patients.js',
  './js/ui/patient-form.js',
  './js/ui/patient-detail.js',
  './js/ui/investigations.js',
  './js/ui/soap-editor.js',
  './js/ui/preview.js',
  './js/ui/settings.js',
  './js/ui/formats.js',
  './js/ui/stage.js',
  './js/ui/sidebyside.js',
  './js/ui/dpjp-registry.js',
  './js/ui/reformat.js',
  './js/ui/reminders.js',
];

self.addEventListener('install', (e) => {
  e.waitUntil((async () => {
    const cache = await caches.open(CACHE_NAME);
    // addAll is atomic — one 404 fails the whole install, which is
    // what we want: a partially cached shell is worse than none.
    await cache.addAll(SHELL);
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (e) => {
  e.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(
      keys.filter(k => k.startsWith('ptracker-') && k !== CACHE_NAME)
          .map(k => caches.delete(k))
    );
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (e) => {
  const url = new URL(e.request.url);

  // Never intercept Firebase network traffic — the SDK owns its
  // own offline queue and retry logic. Caching it would corrupt
  // sync state.
  if (url.origin !== self.location.origin) return;
  if (e.request.method !== 'GET') return;

  // Cache-first for the shell: instant cold start, no flash of
  // unstyled content, works with the radio off.
  e.respondWith((async () => {
    const cached = await caches.match(e.request);
    if (cached) return cached;
    try {
      const res = await fetch(e.request);
      if (res.ok) (await caches.open(CACHE_NAME)).put(e.request, res.clone());
      return res;
    } catch (err) {
      // Navigation request while offline and uncached → app shell.
      if (e.request.mode === 'navigate') {
        const fallback = await caches.match('./index.html');
        if (fallback) return fallback;
      }
      throw err;
    }
  })());
});
