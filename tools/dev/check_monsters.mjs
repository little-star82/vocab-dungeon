// 檢查怪物：進一關之後把怪物換成每一隻可愛怪物，看待機、攻擊、挨打、倒下，並截圖。
// 先開伺服器：python3 tools/dev/server.py 8012
// 用法：node tools/dev/check_monsters.mjs <截圖要放的資料夾>
import {boot,sleep} from './cdp.mjs';
import {mkdirSync} from 'node:fs';
const OUT=process.argv[2]||'/tmp/monsters'; mkdirSync(OUT,{recursive:true});
setTimeout(()=>{ console.log('TIMEOUT watchdog'); process.exit(2); },400000);
const NAMES=['Alien','Alien_Tall','Cactus','Crab','Cyclops','Deer','Demon','Ghost','GreenDemon','Panda','Skull','Tree','Yeti','Bat','Bee','YellowDragon'];
const b=await boot(); console.log('loaded',await b.open());
if(!await b.enter((await b.islands(true))[0],1)){ console.log('進不了關卡'); process.exit(1); }
const F={x:0,y:60,width:500,height:340}; let n=0;
for(const name of NAMES){
  const clips=await b.ev(`window.__gen.enemy(${JSON.stringify(name)})`); await sleep(500);
  await b.snap(`${OUT}/${String(n).padStart(2,'0')}_${name}.jpg`,F,.6);
  const acts=[]; for(const a of ['1H_Melee_Attack_Chop','Hit_A','Taunt','Cheer','Spawn_Ground_Skeletons','Death_A']){ await b.ev(`(()=>{ window.__gen.eplay(${JSON.stringify(a)}); })()`); await sleep(260); acts.push(a.split('_')[0]); }
  await b.snap(`${OUT}/${String(n).padStart(2,'0')}_${name}_dead.jpg`,F,.6); n++;
  console.log(name.padEnd(13),clips);
}
// 換回原本的怪物之後，打一下看傷害數字的位置
await b.ev(`window.__gen.enemy('Yeti')`); await b.ev(`(()=>{ window.__atk=window.__gen.attack(); })()`); await sleep(600); await b.snap(`${OUT}/zz_hit.jpg`,F,.6); await sleep(900);
b.close(); process.exit(0);
