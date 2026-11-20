// 拍幾張成果圖：主選單（全員指定等級）、指定關卡的戰鬥畫面。
// 用法：node tools/dev/shots.mjs <資料夾> <等級> <島> <第幾關>
import {boot,sleep} from './cdp.mjs';
import {mkdirSync} from 'node:fs';
let [OUT='/tmp/shots',LV='50',ISL='',STAGE='1']=process.argv.slice(2); mkdirSync(OUT,{recursive:true});
setTimeout(()=>{ console.log('TIMEOUT watchdog'); process.exit(2); },200000);
const b=await boot(); console.log('loaded',await b.open());
await b.ev(`window.__gen.setAll(${+LV})`); await sleep(500); await b.snap(OUT+'/home.jpg',null,.7);
console.log('heroes:',await b.text('.heroes'));
if(!ISL) ISL=(await b.islands(true))[0];
if(await b.enter(ISL,STAGE)){ await sleep(400); await b.snap(OUT+'/battle.jpg',null,.7); console.log('enemy:',await b.text('#enemyName'));
  await b.ev(`(()=>{ window.__atk=window.__gen.attack(); })()`); await sleep(650); await b.snap(OUT+'/hit.jpg',null,.7); await sleep(800); }
b.close(); process.exit(0);
