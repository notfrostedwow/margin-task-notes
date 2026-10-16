import { readdir, readFile, writeFile } from "node:fs/promises";
import { createHash } from "node:crypto";
const assets = (await readdir("dist/assets")).map((name) => `/assets/${name}`);
const index = await readFile("dist/index.html", "utf8");
const revision = createHash("sha256").update(index).digest("hex").slice(0, 12);
await writeFile(
  "dist/sw.js",
  `// Generated from this build; only this application's assets are cached.
const CACHE = 'margin-shell-${revision}';
const ASSETS = ${JSON.stringify(["/", "/index.html", "/mark.svg", ...assets])};
self.addEventListener('install', event => event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS))));
self.addEventListener('activate', event => event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(key => key.startsWith('margin-shell-') && key !== CACHE).map(key => caches.delete(key)))).then(() => self.clients.claim())));
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (ASSETS.includes(url.pathname)) event.respondWith(caches.match(url.pathname).then(cached => cached || fetch(event.request)));
});
`,
);
console.log(
  `Offline shell generated: ${assets.length + 3} local resources, revision ${revision}`,
);
