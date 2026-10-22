// Service worker: saves the app's files on the phone so it works offline.
//
// Files are served from the saved copy straight away (fast, and works with no
// signal), while a fresh copy is fetched in the background when online. So a
// new version shows up the next time the app is opened.
const CACHE = 'tennis-trainer';
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
  // Pose tracker for the Camera test (about 18 MB)
  'vendor/mediapipe/vision_bundle.mjs',
  'vendor/mediapipe/wasm/vision_wasm_internal.js',
  'vendor/mediapipe/wasm/vision_wasm_internal.wasm',
  'vendor/mediapipe/pose_landmarker_lite.task',
];

self.addEventListener('install', event => {
  event.waitUntil(
    caches.open(CACHE)
      .then(cache => cache.addAll(FILES.map(file => new Request(file, { cache: 'reload' }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', event => {
  event.waitUntil(self.clients.claim());
});

self.addEventListener('fetch', event => {
  const request = event.request;
  if (request.method !== 'GET' || !request.url.startsWith(self.location.origin)) return;
  if (request.headers.has('range')) {
    event.respondWith(rangeResponse(request));
    return;
  }

  event.respondWith(caches.open(CACHE).then(async cache => {
    // ignoreSearch: "index.html?fast=1" uses the same saved copy as "index.html".
    const saved = await cache.match(request, { ignoreSearch: true });
    const fresh = fetch(request, { cache: 'no-cache' })
      .then(response => {
        if (response.ok) cache.put(request.url.split('?')[0], response.clone());
        return response;
      })
      .catch(() => saved);
    if (saved) {
      event.waitUntil(fresh);   // update the saved copy in the background
      return saved;
    }
    return fresh;
  }));
});

// iPhones load video in pieces ("bytes=0-1"), so cut the requested piece out
// of the saved copy. This keeps the keep-awake video working offline.
async function rangeResponse(request) {
  const saved = await caches.match(request, { ignoreSearch: true });
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
