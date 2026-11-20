// 檢查錯題洞窟：先種幾筆錯題，進洞窟打完，確認題數等於錯題數、不升級、有給金幣。
// 先開伺服器：python3 tools/dev/server.py 8012
import {boot,sleep,AUTO} from './cdp.mjs';
setTimeout(()=>{ console.log('TIMEOUT watchdog'); process.exit(2); },200000);
const b=await boot(); console.log('loaded',await b.open()); await b.ev(AUTO);
const IDS=(await b.islands(true)).slice(0,3);   // 從地圖上最新的幾座島各拿幾個字當錯題
console.log('seed:',await b.ev(`(()=>{ const g=window.__gen, s=window.__state().save, now=Date.now(); let n=0;
  for(const id of ${JSON.stringify(IDS)}){ g.use(id); g.WORDS.slice(0,2).forEach(w=>{ s.miss[id+'/'+w.en]={n:2,ok:0,t:now-(n++)*1000,u:now,ty:{spell:1}}; }); if(g.PHRASES[0]) s.miss[id+'/~'+g.PHRASES[0].en]={n:3,ok:0,t:now,u:now,ty:{}}; }
  g.use(s.island||'w12'); return Object.keys(s.miss).length+' 筆'; })()`));
await b.click('#miss'); await sleep(400); await b.click('#missGo'); await sleep(300);
const r=await b.ev(`(async()=>{ const r=await window.__auto([1]); const s=window.__state(); r.lv=JSON.stringify(s.save.lv); r.hp=s.ehpMax; r.asked=r.log.filter(x=>x[0]==='#').length; r.first=r.log[0]; return r; })()`);
console.log('ASKED',r.asked,'題 |',r.first); console.log('END',r.end); console.log('lv',r.lv,'（洞窟不該升級）');
b.close(); process.exit(0);
