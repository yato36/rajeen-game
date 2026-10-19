/*
 * يوم راجين: يخلي اللعبة تشتغل بدون نت بعد أول فتحة.
 * vite.config.ts يعبّي القائمة والنسخة وقت البناء ويطلعه dist/sw.js.
 * الصفحة (index.html) دايم من النت أول عشان التحديثات توصل، والباقي (ملفاته فيها بصمة) من المحفوظ.
 */
const VERSION = 'ed29d76a0852';
const CACHE = `rajeen-${VERSION}`;
const FONTS = 'rajeen-fonts';
const PRECACHE = ["./","assets/index-CUt715hU.js","index.html","icons/apple-touch-icon.png","icons/favicon-64.png","icons/icon-192.png","icons/icon-512.png","icons/icon-maskable-512.png","manifest.webmanifest"];
const FONT_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];
/** السيرفر ممكن يرسل Vary: Origin، وطلب السكربت فيه Origin وطلب الحفظ لا، فنتجاهلها */
const MATCH = { ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(PRECACHE))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) => Promise.all(keys.filter((key) => key.startsWith('rajeen-') && key !== CACHE && key !== FONTS).map((key) => caches.delete(key))))
      .then(() => self.clients.claim()),
  );
});

// الصفحة ترسل الخطوط اللي تحمّلت قبل ما يشتغل هذا، عشان تنحفظ من أول مرة
self.addEventListener('message', (event) => {
  if (!event.data || event.data.type !== 'cache' || !Array.isArray(event.data.urls)) return;
  event.waitUntil(
    caches.open(FONTS).then((cache) =>
      Promise.all(event.data.urls.map((url) => (url.includes('fonts.googleapis.com') ? cacheFontCss(cache, url) : cache.add(url)).catch(() => undefined))),
    ),
  );
});

/** ملف خط Tajawal (CSS) والخطوط اللي داخله (woff2) */
async function cacheFontCss(cache, url) {
  const response = await fetch(url);
  if (!response.ok) return;
  await cache.put(url, response.clone());
  const css = await response.text();
  const files = [...css.matchAll(/url\((https:[^)]+)\)/g)].map((match) => match[1]);
  await Promise.all(files.map((file) => cache.add(file).catch(() => undefined)));
}

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;
  const url = new URL(request.url);
  if (FONT_HOSTS.includes(url.hostname)) {
    event.respondWith(fromCacheThenRefresh(request));
    return;
  }
  if (url.origin !== self.location.origin) return;
  event.respondWith(request.mode === 'navigate' ? networkFirst(request) : cacheFirst(request));
});

/** الصفحة: من النت ونحفظها، ولو ما فيه نت من المحفوظ */
async function networkFirst(request) {
  const cache = await caches.open(CACHE);
  try {
    const response = await fetch(request);
    if (response.ok) cache.put(request, response.clone());
    return response;
  } catch {
    return (await cache.match(request, MATCH)) || (await cache.match('./', MATCH)) || (await cache.match('index.html', MATCH)) || Response.error();
  }
}

/** ملفات اللعبة: من المحفوظ، وإذا ما انحفظت نجيبها ونحفظها */
async function cacheFirst(request) {
  const cache = await caches.open(CACHE);
  const cached = await cache.match(request, MATCH);
  if (cached) return cached;
  const response = await fetch(request);
  if (response.ok) cache.put(request, response.clone());
  return response;
}

/** الخط: من المحفوظ على طول، ونحدّثه من النت بالخلفية */
async function fromCacheThenRefresh(request) {
  const cache = await caches.open(FONTS);
  const cached = await cache.match(request, MATCH);
  const refresh = fetch(request)
    .then((response) => {
      if (response.ok || response.type === 'opaque') cache.put(request, response.clone());
      return response;
    })
    .catch(() => undefined);
  return cached || (await refresh) || Response.error();
}
