const { chromium } = require('playwright');const http=require('http'),fs=require('fs'),path=require('path');
const srv=http.createServer((q,r)=>{fs.readFile(path.join(__dirname,decodeURIComponent(q.url)),(e,d)=>{if(e){r.writeHead(404);return r.end()}r.end(d)})}).listen(8766);
(async()=>{const b=await chromium.launch({args:['--no-proxy-server']});const p=await b.newPage({viewport:{width:540,height:720},deviceScaleFactor:2});
await p.goto('http://localhost:8766/cover.html');await p.evaluate(()=>document.fonts.ready);await p.waitForTimeout(1500);
await p.screenshot({path:path.join(__dirname,'cover.png')});await b.close();srv.close()})();
