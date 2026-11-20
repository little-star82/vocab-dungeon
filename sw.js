// 單字地下城的 service worker：讓遊戲可以「加到主畫面」當 App 開，玩過的內容沒網路也能玩。
//
// 快取規則
// - 程式（網頁、js、關卡島的資料）：先連網路拿最新的，4 秒內連不上才用上次存的。所以平常部署新版，重開就是新的。
// - 素材（3D 模型、發音檔、圖片、圖示）：先用存的，同時在背景更新，下次開就是新的。
// - 外部的固定檔案（three.js、Firebase SDK、字型）：存過就一直用。
// - Google 登入、雲端存檔的連線：完全不碰，直接走網路。
//
// 改了這支檔案的快取規則時，把 VERSION 加一，舊的快取會自動清掉。
const VERSION='wd-v1', CODE=VERSION+'-code', ASSET=VERSION+'-asset';
const SHELL=['./','index.html','js/game.js','js/cloud.js','js/firebase-config.js','islands/index.js','manifest.webmanifest','icons/icon-192.png'];
const CDN_HOSTS=['cdn.jsdelivr.net','www.gstatic.com','fonts.googleapis.com','fonts.gstatic.com'];
const NET_TIMEOUT=4000;

self.addEventListener('install',e=>{
  // 先把外殼存起來；個別檔案抓不到不影響安裝
  e.waitUntil(caches.open(CODE).then(c=>Promise.all(SHELL.map(u=>c.add(new Request(u,{cache:'reload'})).catch(()=>{})))).then(()=>self.skipWaiting()));
});
self.addEventListener('activate',e=>{
  e.waitUntil(caches.keys().then(ks=>Promise.all(ks.filter(k=>k.startsWith('wd-')&&!k.startsWith(VERSION)).map(k=>caches.delete(k)))).then(()=>self.clients.claim()));
});

const isCode=(req,url)=>req.mode==='navigate'||/\/$|\.(html|js|webmanifest)$/.test(url.pathname);
const save=(cache,key,res)=>{ if(res&&(res.ok||res.type==='opaque')) cache.put(key,res.clone()).catch(()=>{}); return res; };

// 先網路、後快取。網路太慢（超過 NET_TIMEOUT）而且手上有舊的，就先給舊的，網路的回來了再存起來
async function networkFirst(req,key){
  const cache=await caches.open(CODE), net=fetch(req).then(res=>save(cache,key,res));
  const old=await cache.match(key);
  if(!old) return net;
  net.catch(()=>{});
  return Promise.race([net.catch(()=>old), new Promise(r=>setTimeout(()=>r(old),NET_TIMEOUT))]);
}
// 先給快取，同時在背景更新
async function staleWhileRevalidate(req,key,e){
  const cache=await caches.open(ASSET), old=await cache.match(key);
  const net=fetch(req).then(res=>save(cache,key,res));
  if(!old) return net;
  e.waitUntil(net.catch(()=>{})); return old;
}
async function cacheFirst(req){
  const cache=await caches.open(ASSET), old=await cache.match(req);
  return old||fetch(req).then(res=>save(cache,req,res));
}
// 發音檔是用 <audio> 播的，Safari 會要求「只給我第幾到第幾個位元組」。快取裡存的是整個檔，這裡切出它要的那一段
async function ranged(req,url,e){
  const full=await staleWhileRevalidate(new Request(url.href),url.href,e);
  const m=/bytes=(\d*)-(\d*)/.exec(req.headers.get('range')||''); if(!m||!full.ok) return full;
  const buf=await full.arrayBuffer(), size=buf.byteLength;
  let start=m[1]===''?Math.max(0,size-Number(m[2])):Number(m[1]), end=m[1]!==''&&m[2]!==''?Math.min(Number(m[2]),size-1):size-1;
  if(start>=size) return new Response(null,{status:416,headers:{'Content-Range':`bytes */${size}`}});
  return new Response(buf.slice(start,end+1),{status:206,statusText:'Partial Content',headers:{'Content-Type':full.headers.get('Content-Type')||'audio/mpeg','Content-Range':`bytes ${start}-${end}/${size}`,'Content-Length':String(end-start+1),'Accept-Ranges':'bytes'}});
}

self.addEventListener('fetch',e=>{
  const req=e.request; if(req.method!=='GET') return;
  const url=new URL(req.url); if(url.protocol!=='http:'&&url.protocol!=='https:') return;
  if(url.origin===self.location.origin){
    if(url.pathname.startsWith('/__/')) return;                      // Firebase 登入用的路徑
    if(req.headers.has('range')){ e.respondWith(ranged(req,url,e)); return; }
    if(isCode(req,url)){ e.respondWith(networkFirst(req,req.mode==='navigate'?new Request(url.origin+url.pathname):req)); return; }   // 網頁本身不看網址後面的參數
    e.respondWith(staleWhileRevalidate(req,req,e)); return;
  }
  if(CDN_HOSTS.includes(url.hostname)){ e.respondWith(url.hostname==='fonts.googleapis.com'?staleWhileRevalidate(req,req,e):cacheFirst(req)); return; }
  // 其他（Google 登入、Firestore…）不處理，直接走網路
});
