// Service worker: saves the app's files on the phone so it works offline.
//
// Each version is saved as one complete set ("box"). A new version is only
// used once every one of its files has arrived, so old and new files never
// mix. Until then the old version keeps working. Files are always served
// from the saved box (fast, and works with no signal), so a new version
// shows up the next time the app is opened after it has downloaded.
//
// Change VERSION with every release (the same number as on the Home screen),
// or phones won't notice the update.
const VERSION = '2.10';
const CACHE = `tennis-trainer-${VERSION}`;
const FILES = [
  './',
  'index.html',
  'style.css',
  'app.js',
  'manifest.json',
  'audio/wide.wav',
  'audio/body.wav',
  'media/keepawake.mp4',
  'icons/icon-180.png',
  'icons/icon-192.png',
  'icons/icon-512.png',
];

// The pose tracker for the camera is big (about 18 MB) and only changes with
// its own version, so it has its own box, kept from one app version to the next.
const TRACKER_CACHE = 'tennis-mediapipe-1.0.1';
const TRACKER_FILES = [
  'vendor/mediapipe/vision_bundle.mjs',
  'vendor/mediapipe/wasm/vision_wasm_internal.js',
  'vendor/mediapipe/wasm/vision_wasm_internal.wasm',
  'vendor/mediapipe/pose_landmarker_lite.task',
];

self.addEventListener('install', event => {
  event.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    // "?v=" makes GitHub send a fresh copy, never one it stored earlier.
    // If any file fails, the install fails and the old version stays in use.
    await Promise.all(FILES.map(async file => {
      const response = await fetch(`${file}?v=${VERSION}`, { cache: 'reload' });
      if (!response.ok) throw new Error(`Could not download ${file}: ${response.status}`);
      await cache.put(file, response);
    }));

    // Tracker files: reuse a copy saved by an earlier version if there is one.
    const tracker = await caches.open(TRACKER_CACHE);
    for (const file of TRACKER_FILES) {
      if (await tracker.match(file)) continue;
      const saved = await caches.match(file);
      if (saved) await tracker.put(file, saved);
      else await tracker.add(new Request(file, { cache: 'reload' }));
    }
    await self.skipWaiting();
  })());
});

// The new version is complete: throw away the boxes of older versions.
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    for (const name of await caches.keys()) {
      if (name !== CACHE && name !== TRACKER_CACHE) await caches.delete(name);
    }
    await self.clients.claim();
  })());
});

// Looks only in this version's boxes, never in a half-downloaded newer one.
// ignoreSearch: "index.html?fast=1" uses the same saved copy as "index.html".
async function findSaved(request) {
  for (const name of [CACHE, TRACKER_CACHE]) {
    const cache = await caches.open(name);
    const saved = await cache.match(request, { ignoreSearch: true });
    if (saved) return saved;
  }
  return null;
}

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;
  if (request.headers.has('range')) {
    event.respondWith(rangeResponse(request));
    return;
  }
  event.respondWith(findSaved(request).then(saved => saved || fetch(request)));
});

// iPhones load video in pieces ("bytes=0-1"), so cut the requested piece out
// of the saved copy. This keeps the keep-awake video working offline.
async function rangeResponse(request) {
  const saved = await findSaved(request);
  if (!saved) return fetch(request);
  const data = await saved.arrayBuffer();
  const [, startText, endText] = /bytes=(\d*)-(\d*)/.exec(request.headers.get('range')) || [];
  const start = Number(startText) || 0;
  const end = endText ? Math.min(Number(endText), data.byteLength - 1) : data.byteLength - 1;
  return new Response(data.slice(start, end + 1), {
    status: 206,
    headers: {
      'Content-Type': saved.headers.get('Content-Type') || 'video/mp4',
      'Content-Range': `bytes ${start}-${end}/${data.byteLength}`,
      'Content-Length': String(end - start + 1),
      'Accept-Ranges': 'bytes',
    },
  });
}
