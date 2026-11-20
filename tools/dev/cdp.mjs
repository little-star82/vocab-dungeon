// 無頭 Chrome + CDP 的小工具：開遊戲、在頁面裡跑程式、截圖。給 tools/dev 底下的測試腳本用。
// 參數裡那幾個 disable-* 不能拿掉：少了它們，螢幕一關、畫面一被擋，頁面會變成「隱藏」，動畫停住、測試永遠跑不完。
import {spawn} from 'node:child_process';
import {mkdtempSync,writeFileSync} from 'node:fs';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
export const sleep=ms=>new Promise(r=>setTimeout(r,ms));
// 要測的網址。伺服器不在 8012 時用環境變數換掉：BASE='http://localhost:8013/?mock=T' node tools/dev/play.mjs …
// ?mock=T 會用假的登入和排行榜（資料存在瀏覽器裡），所以就算 CLOUD_ENABLED 是 false，畫面上還是看得到登入按鈕；要確認雲端真的關掉了，開不帶 ?mock 的網址
export const BASE=process.env.BASE||'http://localhost:8012/?mock=T';
export async function boot({width=390,height=844}={}){
  const port=9333+Math.floor(Math.random()*500), dir=mkdtempSync(join(tmpdir(),'wd-'));
  const chrome=spawn('/Applications/Google Chrome.app/Contents/MacOS/Google Chrome',['--headless=new','--use-angle=swiftshader','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','--mute-audio',
    '--disable-backgrounding-occluded-windows','--disable-renderer-backgrounding','--disable-background-timer-throttling','--disable-features=CalculateNativeWinOcclusion',
    '--autoplay-policy=no-user-gesture-required',`--remote-debugging-port=${port}`,`--user-data-dir=${dir}`,`--window-size=${width},${height}`,'about:blank'],{stdio:'ignore'});
  process.on('exit',()=>{ try{chrome.kill();}catch(e){} });
  let target; for(let i=0;i<60;i++){ await sleep(250); try{ const l=await (await fetch(`http://127.0.0.1:${port}/json`)).json(); target=l.find(t=>t.type==='page'); if(target) break; }catch(e){} }
  const ws=new WebSocket(target.webSocketDebuggerUrl); await new Promise(r=>ws.onopen=r);
  let id=0; const pend=new Map(), errs=[];
  ws.onmessage=m=>{ const d=JSON.parse(m.data); if(d.id&&pend.has(d.id)){ pend.get(d.id)(d); pend.delete(d.id); }
    if(d.method==='Runtime.exceptionThrown') errs.push(d.params.exceptionDetails.exception?.description||d.params.exceptionDetails.text);
    if(d.method==='Runtime.consoleAPICalled'&&d.params.type==='error') errs.push('console.error: '+d.params.args.map(a=>a.value||a.description).join(' ')); };
  const send=(method,params={})=>new Promise(r=>{ const i=++id; pend.set(i,r); ws.send(JSON.stringify({id:i,method,params})); });
  // 注意：expr 的值如果是 promise 會等它結束。要啟動一個「等人按按鈕」的流程，包成 (()=>{ ...; })() 不要回傳它
  const ev=async expr=>{ const r=await send('Runtime.evaluate',{expression:expr,awaitPromise:true,returnByValue:true}); if(r.result.exceptionDetails) throw new Error(r.result.exceptionDetails.exception?.description||JSON.stringify(r.result.exceptionDetails).slice(0,300)); return r.result.result.value; };
  await send('Runtime.enable'); await send('Page.enable'); await send('Emulation.setFocusEmulationEnabled',{enabled:true});
  const open=async(url=BASE)=>{ await send('Page.navigate',{url}); for(let i=0;i<120;i++){ await sleep(250); if(await ev(`!!document.getElementById('loader')&&document.getElementById('loader').hidden&&!!document.querySelector('#map')`).catch(()=>false)) return true; } return false; };
  // clip：{x,y,width,height}，只拍這一塊；scale 縮小存檔
  const snap=async(file,clip,scale=1)=>{ await sleep(300); const r=await send('Page.captureScreenshot',{format:'jpeg',quality:75,...(clip?{clip:{...clip,scale}}:{})}); writeFileSync(file,Buffer.from(r.result.data,'base64')); };
  const text=sel=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); return e?e.innerText.replace(/\\n+/g,' | ').slice(0,600):'(none)';})()`);
  const click=sel=>ev(`(()=>{const e=document.querySelector(${JSON.stringify(sel)}); if(!e) return 'NO '+${JSON.stringify(sel)}; e.click(); return 'ok';})()`);
  // 進某座島的某一關，等到第一題出現
  const enter=async(isl,stage)=>{ await ev(`(async()=>{ const sleep=ms=>new Promise(r=>setTimeout(r,ms)); document.querySelector('#map').click(); await sleep(300); document.querySelector('.node[data-id="${isl}"][data-i="${stage}"]').click(); await sleep(300); document.querySelector('#stageGo').click(); })()`);
    for(let t=0;t<100;t++){ await sleep(400); const st=await ev(`(()=>{const p=document.getElementById('panel'); const g=p.querySelector('#next')||p.querySelector('#fb #go'); if(g){g.click();return 'next';} return p.querySelector('.opt,.tile,.wtile')?'Q':'wait';})()`); if(st==='Q') return true; } return false; };
  // 地圖上有哪些島（照地圖由上到下）；normalOnly 只列一般的島，不含複習考島
  const islands=async(normalOnly=false)=>{ await ev(`document.querySelector('#map').click()`); await sleep(350);
    const sel=normalOnly?'.island:not(.exam) .node':'.node';
    const ids=await ev(`[...new Set([...document.querySelectorAll(${JSON.stringify(sel)})].map(n=>n.dataset.id))]`); await ev(`document.querySelector('#mapClose').click()`); await sleep(200); return ids; };
  const close=()=>{ console.log(errs.length?'PAGE ERRORS:\n'+[...new Set(errs)].join('\n'):'no page errors'); ws.close(); chrome.kill(); };
  return {send,ev,open,snap,text,click,enter,islands,close,errs,port};
}
// 自動作答：wrongAt 是要故意答錯的題號。要先 await b.ev(AUTO) 把它放進頁面
export const AUTO=`window.__auto = async (wrongAt=[], opt={}) => {
  const sleep=ms=>new Promise(r=>setTimeout(r,ms)); let n=0, log=[]; const seenTypes={};
  const t0=Date.now(); while(Date.now()-t0<(opt.maxMs||300000)){
    await sleep(100);
    const panel=document.getElementById('panel');
    const next=panel.querySelector('#next'); if(next){next.click();continue;}
    const go=panel.querySelector('#fb #go'); if(go){go.click();continue;}
    const lv=panel.querySelector('.lvup'); if(lv){ panel.querySelector('[data-i="0"]').click(); continue; }
    if(panel.querySelector('.stars')){ return {log, types:seenTypes, end: panel.innerText.replace(/\\n+/g,' | ').slice(0,200)}; }
    const fall=[...panel.querySelectorAll('button')].find(b=>b.textContent.includes('再挑戰一次')&&!panel.querySelector('.stars')); if(fall&&panel.innerText.includes('倒下')){ return {log, types:seenTypes, end:'DEFEATED: '+panel.innerText.replace(/\\n+/g,' | ').slice(0,80)}; }
    const q=window.__q, fb=panel.querySelector('#fb');
    if(q && fb && !fb.innerHTML && !q.__done){ q.__done=1; if(n===0) window.__firstQ=panel.innerText.replace(/\\n+/g,' | ').slice(0,200); const wrong=wrongAt.includes(n)||(opt.wrongRate&&Math.random()<opt.wrongRate); const st=window.__state(); const ty=q.type||q.label; seenTypes[ty]=(seenTypes[ty]||0)+1;
      log.push('#'+n+' '+ty+(wrong?' WRONG':'')+' hp'+st.ehp+'/'+st.ehpMax+' ♥'+st.hearts+' | '+document.getElementById('enemyName').textContent); n++;
      if(['spell','blank','listenSpell'].includes(q.type)){ const target=(q.w.sp||q.w.en).replace(/ /g,'').split(''); const slots=[...panel.querySelectorAll('#slots [data-s]')];
        if(slots.length!==target.length) log.push('  SLOT COUNT MISMATCH '+q.w.en);
        const need=slots.map((s,i)=>s.dataset.t?null:target[i]).filter(Boolean);
        let seq=need; if(wrong){ const decoy=[...panel.querySelectorAll('.tile')].find(b=>!need.includes(b.textContent)); seq=decoy?[decoy.textContent,...need.slice(1)]:(new Set(need).size>1?[...need.slice(1),need[0]]:need); }
        for(const ch of seq){ const t=[...panel.querySelectorAll('.tile:not(.used)')].find(b=>b.textContent===ch); if(!t){ log.push('  MISSING TILE '+ch+' for '+q.w.en); break; } t.click(); } }
      else if(q.kind==='order'||q.type==='arrange'){ const order=wrong?[...q.words].reverse():q.words; for(const w of order){ const t=[...panel.querySelectorAll('#tiles .wtile:not(.used)')].find(b=>b.textContent===w); if(!t){log.push('  MISSING WORD '+w);break;} t.click(); } panel.querySelector('#chk').click(); }
      else { const opts=[...panel.querySelectorAll('.opt')]; const b=(wrong?opts.find(o=>o.textContent!==q.a):opts.find(o=>o.textContent===q.a)); if(!b) log.push('  NO OPTION for '+q.a); else b.click(); }
    }
  }
  return {log, types:seenTypes, end:'TIMEOUT '+document.getElementById('panel').innerText.slice(0,120)};
};`;
