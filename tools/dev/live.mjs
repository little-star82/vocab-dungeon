// 上線後的冒煙測試：開正式站，看主選單、進一關、確認題目出得來、怪物的模型有載到。
// 正式站沒有測試用的掛鉤（window.__gen 只在 localhost 有），所以只能看畫面上的字和載入了哪些檔案。
// 用法：node tools/dev/live.mjs [島] [第幾關] [截圖檔]
import {boot,sleep} from './cdp.mjs';
const [isl='w10',stage='4',shot='']=process.argv.slice(2);
setTimeout(()=>{ console.log('TIMEOUT watchdog'); process.exit(2); },150000);
const b=await boot(), U='https://vocab.dada3c.tw/?t='+Date.now();
console.log('loaded',await b.open(U)); await sleep(1200); console.log('reload',await b.open(U)); await sleep(600);   // 第二次載入確定拿到新版（service worker 是先連網路）
console.log('heroes:',await b.text('.heroes'));
console.log('entered:',await b.enter(isl,stage),'| enemy:',await b.text('#enemyName'),'| hp:',await b.text('#enemyNum'),'| stage:',await b.text('#stageChip'));
console.log('question:',(await b.text('#panel')).slice(0,90));
console.log('models loaded:',await b.ev(`performance.getEntriesByType('resource').map(r=>r.name.split('/').pop().split('?')[0]).filter(n=>/\\.glb$|Assassin|Ranger/.test(n)).join(', ')`));
if(shot) await b.snap(shot,null,.7);
b.close(); process.exit(0);
