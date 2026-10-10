import { readdir, readFile, writeFile } from 'node:fs/promises';
import { createHash } from 'node:crypto';
import { join } from 'node:path';

const files = [];
async function walk(directory) {
  for (const entry of await readdir(directory, { withFileTypes: true })) {
    const path = join(directory, entry.name);
    if (entry.isDirectory()) await walk(path);
    else if (entry.name !== 'sw.js') files.push(path.replaceAll('\\', '/'));
  }
}
await walk('dist');
const digest = createHash('sha256');
for (const file of files.sort()) digest.update(await readFile(file));
const version = digest.digest('hex').slice(0, 16);
const assets = files.map((file) => '/' + file.slice(5));
const source = `// Generated from the production assets. No personal data is cached here.
const CACHE = 'daily-ops-shell-${version}';
const ASSETS = ${JSON.stringify(assets)};
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(ASSETS)));
  // Updates activate after the previous app's tabs close; no forced reload.
});
self.addEventListener('activate', event => {
  event.waitUntil((async () => {
    const keys = await caches.keys();
    await Promise.all(keys.filter(key => key.startsWith('daily-ops-shell-') && key !== CACHE).map(key => caches.delete(key)));
    await self.clients.claim();
  })());
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (event.request.method !== 'GET' || url.origin !== self.location.origin) return;
  if (event.request.mode === 'navigate') {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match('/index.html')) || fetch(event.request)));
    return;
  }
  if (ASSETS.includes(url.pathname)) {
    event.respondWith(caches.open(CACHE).then(async cache => (await cache.match(url.pathname)) || fetch(event.request)));
  }
});
`;
await writeFile('dist/sw.js', source);
console.log(`Offline shell generated: ${assets.length} assets, version ${version}.`);
