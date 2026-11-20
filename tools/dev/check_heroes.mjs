// 檢查勇者：隱藏勇者的鎖與解鎖、每位勇者的每一招都放一次（看有沒有錯誤），並截圖。
// 先開伺服器：python3 tools/dev/server.py 8012
// 用法：node tools/dev/check_heroes.mjs <截圖要放的資料夾> [只測這幾位勇者的編號,用逗號分開]
import {boot,sleep} from './cdp.mjs';
import {mkdirSync} from 'node:fs';
const OUT=process.argv[2]||'/tmp/heroes'; mkdirSync(OUT,{recursive:true});
const ONLY=process.argv[3]?process.argv[3].split(',').map(Number):null;
setTimeout(()=>{ console.log('TIMEOUT watchdog'); process.exit(2); },560000);
const b=await boot(); console.log('loaded',await b.open());
const TOP={x:0,y:40,width:500,height:330}, FIGHT={x:0,y:60,width:500,height:340};
// 1. 一開始：隱藏勇者是鎖的
console.log('heroes:',await b.text('.heroes'));
for(const k of await b.ev(`[...document.querySelectorAll('.hero-btn.locked')].map(x=>+x.dataset.k)`)){ await b.ev(`document.querySelector('.hero-btn[data-k="${k}"]').click()`); await sleep(150); console.log(' locked',k,'→',await b.text('#moves')); }
await b.snap(OUT+'/00_locked.jpg',TOP,.7);
// 2. 四位一般勇者 Lv30：只開第一位隱藏勇者
await b.ev(`['Knight','Mage','Rogue','Barbarian'].forEach(h=>window.__gen.setLv(h,30))`); await sleep(300); console.log('4×Lv30:',await b.text('.heroes'));
// 3. 前五位 Lv49 → 最後一位升到 50，第二位隱藏勇者現身
await b.ev(`(()=>{ const g=window.__gen; ['Mage','Rogue','Barbarian','Ranger'].forEach(h=>g.setLv(h,50)); g.setLv('Knight',49); })()`); await sleep(300); console.log('before last:',await b.text('.heroes'));
await b.ev(`(()=>{ window.__lv=window.__gen.levelUp(); })()`); await sleep(900); console.log('lvup:',(await b.text('#panel')).slice(0,260));
await b.click('#panel [data-i="0"]'); await sleep(700); console.log('unlock:',await b.text('#panel')); await b.snap(OUT+'/01_unlock.jpg',null,.6);
await b.click('#panel [data-i="0"]'); await sleep(300); await b.click('#homeBtn'); await sleep(1500);
await b.ev(`window.__gen.setAll(50)`); await sleep(400); console.log('all 50:',await b.text('.heroes')); await b.snap(OUT+'/02_home_all.jpg',null,.6);
const N=await b.ev(`document.querySelectorAll('.hero-btn').length`);
const ISL=(await b.islands(true))[0];   // 用地圖上最新的一座一般的島來測
// 4. 每位勇者：換裝畫面看一眼，再進關卡把每一招放一次
for(let k=0;k<N;k++){ if(ONLY&&!ONLY.includes(k)) continue;
  await b.ev(`document.querySelectorAll('.hero-btn')[${k}].click()`); await sleep(500); console.log(`hero ${k}:`,await b.text('#moves'));
  await b.click('#shop'); await sleep(500); await b.ev(`window.__rot=.5`); await b.snap(`${OUT}/h${k}_front.jpg`,TOP,.6); await b.ev(`window.__rot=2.7`); await b.snap(`${OUT}/h${k}_back.jpg`,TOP,.6);
  console.log('  vis:',await b.ev(`window.__gen.vis(${k})`)); await b.click('#shopClose'); await sleep(500);
  if(!await b.enter(ISL,1)){ console.log('  !! 進不了關卡'); continue; }
  console.log('  hud:',await b.text('#heroName'),await b.text('#hearts'));
  const n=6;   // 每位勇者六招
  for(let i=0;i<n;i++){
    await b.ev(`(()=>{ window.__spDone=false; window.__spErr=null; window.__gen.special(${i}).then(()=>window.__spDone=true).catch(e=>{ window.__spErr=String(e&&e.stack||e); window.__spDone=true; }); })()`);
    await sleep(1150); const nm=await b.ev(`(document.getElementById('special')||{}).innerText||''`);
    if(i>=4||k===N-1){ await b.snap(`${OUT}/h${k}_m${i}_a.jpg`,FIGHT,.6); await sleep(300); await b.snap(`${OUT}/h${k}_m${i}_b.jpg`,FIGHT,.6); }
    for(let t=0;t<80;t++){ if(await b.ev('window.__spDone')) break; await sleep(200); }
    const err=await b.ev('window.__spErr'); console.log(`  move ${i}`,nm.replace(/\n/g,' / '),err?'ERR '+err.slice(0,200):'ok');
  }
  await b.click('#homeBtn'); await sleep(1600);
}
b.close(); process.exit(0);
