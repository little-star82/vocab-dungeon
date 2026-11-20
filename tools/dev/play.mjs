// 自動打完一關，印出結果。先在專案根目錄開伺服器：python3 tools/dev/server.py 8012
// 用法：node tools/dev/play.mjs [島] [第幾關] [故意答錯的題號,用逗號分開]   沒寫島就用地圖上最新的那一座
// 環境變數：LV=30（開打前把所有勇者設成這個等級）、HERO=4（選第幾位勇者，從 0 算）、RATE=0.2（每題有兩成機率故意答錯）
import {boot,sleep,AUTO} from './cdp.mjs';
let [isl='',stage='1',wrongCsv='']=process.argv.slice(2);
setTimeout(()=>{ console.log('TIMEOUT watchdog: 330 秒沒跑完，強制結束'); process.exit(2); },330000);
const b=await boot(); await b.open(); await b.ev(AUTO);
const map=await b.islands(); console.log('MAP 地圖上的島：',map.join('、')); if(!isl) isl=map[0];
if(!map.includes(isl)){ console.log(`地圖上沒有「${isl}」這座島`); b.close(); process.exit(1); }
if(process.env.LV) await b.ev(`window.__gen.setAll(${+process.env.LV})`);
if(process.env.HERO){ await b.ev(`document.querySelectorAll('.hero-btn')[${+process.env.HERO}].click()`); await sleep(400); }
const wrongAt=JSON.stringify(wrongCsv?wrongCsv.split(',').map(Number):[]);
const res=await b.ev(`(async()=>{ const sleep=ms=>new Promise(r=>setTimeout(r,ms)); document.querySelector('#map').click(); await sleep(300); document.querySelector('.node[data-id="${isl}"][data-i="${stage}"]').click(); await sleep(300); document.querySelector('#stageGo').click(); const r=await window.__auto(${wrongAt},{wrongRate:${+process.env.RATE||0}}); r.asked=r.log.filter(x=>x[0]==='#').length; r.wrong=r.log.filter(x=>/ WRONG /.test(x)).length; r.first=r.log[0]; r.q1=window.__firstQ; const s=window.__state(); r.hero=s.hero; r.lv=JSON.stringify(s.save.lv); r.stars=JSON.stringify(s.save.stars); r.miss=Object.keys(s.save.miss).length; return r; })()`);
const bad=res.log.filter(x=>/MISSING|MISMATCH|NO OPTION/.test(x)); if(bad.length) console.log(bad.join('\n'));
console.log('Q1 第一題的畫面：',res.q1); console.log('ASKED',res.asked,'題，答錯',res.wrong,'次 |',res.first); console.log('END',res.end); console.log('hero',res.hero,'lv',res.lv,'stars',res.stars,'miss',res.miss);
b.close(); process.exit(0);
