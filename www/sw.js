const V='whalechat-v6';
const FILES=['./','index.html','style.css','app.js','db.js','brain.js','importer.js','vendor/marked.umd.js','vendor/purify.min.js','vendor/jszip.min.js','vendor/highlight.min.js','vendor/mammoth.browser.min.js','files.js','memory.js','vendor/pdfjs/pdf.min.mjs','vendor/pdfjs/pdf.worker.min.mjs','icon.svg','manifest.webmanifest'];
self.addEventListener('install',e=>{e.waitUntil(caches.open(V).then(c=>c.addAll(FILES)));self.skipWaiting();});
self.addEventListener('activate',e=>{e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k!==V).map(k=>caches.delete(k)))));self.clients.claim();});
self.addEventListener('fetch',e=>{const u=new URL(e.request.url);if(u.origin!==location.origin)return;e.respondWith(fetch(e.request).then(r=>{const c=r.clone();caches.open(V).then(x=>x.put(e.request,c));return r;}).catch(()=>caches.match(e.request)));});
