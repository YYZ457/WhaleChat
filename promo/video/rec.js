const { chromium } = require('playwright');
const { spawn } = require('child_process');
const http = require('http'), fs = require('fs'), path = require('path');
const root = __dirname;
const mode = process.argv[2] || 'video';
const FPS = 30;
const srv = http.createServer((q, r) => {
  const f = path.join(root, decodeURIComponent(q.url.split('?')[0]));
  fs.readFile(f, (e, d) => { if (e) { r.writeHead(404); return r.end(); }
    const ext = path.extname(f); r.writeHead(200, { 'content-type': ext === '.html' ? 'text/html' : ext === '.css' ? 'text/css' : ext === '.woff2' ? 'font/woff2' : 'application/octet-stream' }); r.end(d); });
}).listen(8765);
(async () => {
  const b = await chromium.launch({ args: ['--no-proxy-server'] });
  const p = await b.newPage({ viewport: { width: 540, height: 960 }, deviceScaleFactor: mode === 'video' ? 2 : 1 });
  p.on('console', m => console.log('console:', m.text()));
  p.on('pageerror', e => console.log('ERR', e.message));
  await p.goto('http://localhost:8765/'+(process.env.PAGE||'index.html'));
  await p.evaluate(() => document.fonts.ready);
  await p.waitForTimeout(1500);
  await p.evaluate(() => document.fonts.ready);
  if (mode !== 'video') {
    const ts = mode.split(',').map(Number);
    for (const t of ts) { await p.evaluate(t => render(t), t); await p.screenshot({ path: path.join(root, `g-${t}.png`) }); }
  } else {
    const dur = await p.evaluate(() => DUR);
    const out = path.join(root, (process.env.OUT||'out.mp4'));
    const ff = spawn('ffmpeg', ['-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-', '-c:v', 'libx264', '-preset', 'slow', '-crf', '18', '-pix_fmt', 'yuv420p', '-movflags', '+faststart', out], { stdio: ['pipe', 'ignore', 'inherit'] });
    const N = Math.round(dur * FPS);
    for (let i = 0; i < N; i++) {
      await p.evaluate(t => render(t), i / FPS);
      const buf = await p.screenshot({ type: 'jpeg', quality: 95 });
      if (!ff.stdin.write(buf)) await new Promise(r => ff.stdin.once('drain', r));
      if (i % 150 === 0) console.log('frame', i, '/', N);
    }
    ff.stdin.end();
    await new Promise(r => ff.on('close', r));
  }
  await b.close(); srv.close();
})();
