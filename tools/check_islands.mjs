#!/usr/bin/env node
// 檢查 islands/ 底下的關卡資料有沒有寫錯。改完題庫一定要跑一次：
//   node tools/check_islands.mjs
// 有「錯誤」會讓遊戲壞掉或出不了題，一定要修；「提醒」不修也能玩，看一下是不是故意的。
import {existsSync,readdirSync} from 'node:fs';
import {dirname,join} from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';

const ROOT=join(dirname(fileURLToPath(import.meta.url)),'..');
// 跟 js/game.js 的 ENEMY_MODELS、MONSTERS 同一份清單（那邊加了新怪物，這裡要跟著加）
const ENEMIES=['Skeleton_Minion','Skeleton_Rogue','Skeleton_Warrior','Skeleton_Mage',
  'Alien','Alien_Tall','Cactus','Crab','Cyclops','Deer','Demon','Ghost','GreenDemon','Panda','Skull','Tree','Yeti','Bat','Bee','YellowDragon'];

const errors=[], warns=[];
const err=(isl,msg)=>errors.push(`[${isl}] ${msg}`), warn=(isl,msg)=>warns.push(`[${isl}] ${msg}`);

let ISLANDS;
try{ ISLANDS=(await import(pathToFileURL(join(ROOT,'islands/index.js')).href)).ISLANDS; }
catch(e){ console.error('✗ islands/index.js 載不起來（通常是 import 的路徑打錯，或某個 island.js 有語法錯誤）：\n  '+(e&&e.message||e)); process.exit(1); }
if(!Array.isArray(ISLANDS)||!ISLANDS.length){ console.error('✗ islands/index.js 的 ISLANDS 是空的，至少要有一座島'); process.exit(1); }

const ids=new Set(), byId={};
for(const isl of ISLANDS){
  const id=isl&&isl.id;
  if(!id||!/^[a-z0-9_-]+$/.test(id)){ err(String(id),'id 要用小寫英文、數字、底線或連字號'); continue; }
  if(ids.has(id)) err(id,'id 重複了'); ids.add(id); byId[id]=isl;
  if(!existsSync(join(ROOT,'islands',id,'island.js'))) err(id,`id 要跟資料夾同名：找不到 islands/${id}/island.js`);
  for(const k of ['name','week','icon','color']) if(!isl[k]) warn(id,`沒有填 ${k}`);
  if(isl.klass) warn(id,`klass 填了「${isl.klass}」。專案如果是公開的，不建議放真實的班級`);
  const stages=isl.stages||[];
  if(!stages.length){ err(id,'stages 是空的'); continue; }
  const sids=stages.map(s=>s.id);
  if(new Set(sids).size!==sids.length) err(id,'stages 裡有重複的 id');
  stages.forEach((s,i)=>{
    for(const k of ['id','chapter','place','enemyName','taunt','hero']) if(!s[k]) err(id,`第 ${i+1} 關沒有填 ${k}`);
    if(typeof s.color!=='number') err(id,`第 ${i+1} 關的 color 要寫成數字，例如 0xffa54a`);
    if(s.enemy&&!ENEMIES.includes(s.enemy)) warn(id,`第 ${i+1} 關的 enemy「${s.enemy}」不在清單裡，遊戲會換成骷髏小兵`);
  });

  if(isl.review){   // 複習考島：跟別的島借題
    const pos=ISLANDS.indexOf(isl);
    for(const f of isl.from||[]){ const j=ISLANDS.findIndex(x=>x.id===f); if(j<0) err(id,`from 裡的「${f}」不在 index.js 的清單裡`); else if(ISLANDS[j].review) err(id,`from 不能指到另一座複習考島「${f}」`); else if(j>pos) warn(id,`「${f}」排在這座複習考島後面，地圖順序可能不對`); }
    if(!(isl.from||[]).length) err(id,'複習考島要寫 from（考哪幾座島）');
    stages.forEach((s,i)=>{ if(!(s.hp>0)) err(id,`第 ${i+1} 關要寫 hp（怪物幾滴血）`);
      for(const f of [...(s.from||[]),...(s.phases||[]).flatMap(p=>p.from||[])]) if(!(isl.from||[]).includes(f)) err(id,`第 ${i+1} 關用到「${f}」，但它不在這座島的 from 裡`); });
    continue;
  }

  // 一般的島
  const words=isl.words||[], phrases=isl.phrases||[], bossQ=isl.bossQ||[];
  const normal=stages.filter(s=>!s.boss), bosses=stages.filter(s=>s.boss);
  if(bosses.length>1) err(id,'一座島只能有一關 boss:1');
  if(bosses.length&&!stages[stages.length-1].boss) err(id,'boss:1 的關卡要放在 stages 的最後一個');
  if(!bosses.length) warn(id,'沒有小王關（最後一關加 boss:1 就會出綜合題）');
  if(!normal.length) err(id,'至少要有一關不是小王的關卡');
  if(words.length<4) err(id,`只有 ${words.length} 個單字。選擇題要 4 個選項，整座島至少要 4 個單字`);
  if(new Set(words.map(w=>w.zh)).size<4) err(id,'不同的中文意思不到 4 個，選擇題湊不出選項');
  const seen=new Set();
  words.forEach((w,i)=>{
    for(const k of ['en','zh','pos','e','d']) if(!w[k]) err(id,`第 ${i+1} 個單字（${w.en||'?'}）沒有填 ${k}`);
    if(w.d&&!normal.some(s=>s.id===w.d)) err(id,`單字「${w.en}」的 d:'${w.d}' 對不到任何一關（小王關不放單字）`);
    const key=w.d+'|'+w.en; if(seen.has(key)) warn(id,`「${w.en}」在同一關出現兩次`); seen.add(key);
    if(w.opp&&!words.some(x=>x.en===w.opp&&x.opp===w.en)) warn(id,`「${w.en}」的相反詞 opp:'${w.opp}' 沒有成對寫回來`);
    if(w.img&&!existsSync(join(ROOT,'islands',id,'img',w.img+'.webp'))) err(id,`單字「${w.en}」的圖片 img/${w.img}.webp 不存在`);
  });
  for(const s of normal){ const n=words.filter(w=>w.d===s.id).length; if(!n) err(id,`關卡「${s.id}」沒有任何單字`); else if(n<4) warn(id,`關卡「${s.id}」只有 ${n} 個單字。能玩，但一關建議至少 4 個、理想是 6～10 個`); }
  phrases.forEach((p,i)=>{ for(const k of ['en','zh']) if(!p[k]) err(id,`第 ${i+1} 句片語沒有填 ${k}`);
    if(!p.ex&&!p.sents) warn(id,`片語「${p.en}」沒有例句 ex，聽句子、排句子的題型出不來`); });
  bossQ.forEach((q,i)=>{ const at=`bossQ 第 ${i+1} 題`;
    if(q.p!=null&&!phrases[q.p]) err(id,`${at} 的 p:${q.p} 超出 phrases 的範圍（從 0 算）`);
    if(q.kind==='mc'){ if(!Array.isArray(q.opts)||q.opts.length<2) err(id,`${at} 沒有 opts`); else if(!q.opts.includes(q.a)) err(id,`${at} 的答案 a 不在 opts 裡`); if(!q.prompt) err(id,`${at} 沒有 prompt`); }
    else if(q.kind==='order'){ if(!Array.isArray(q.words)||q.words.length<2) err(id,`${at} 的 words 要是陣列（一個字一格）`); }
    else err(id,`${at} 的 kind 要是 'mc' 或 'order'`); });
  const b=isl.boss||{};
  if(bosses.length&&(b.phrases??6)>0&&!phrases.length&&!bossQ.length) warn(id,'沒有片語也沒有 bossQ，小王只會出單字題。把 boss 寫成 {words:10, phrases:0} 比較清楚');
  for(const [text,file] of Object.entries(isl.audio||{})) if(!existsSync(join(ROOT,'islands',id,'audio',file))){ err(id,`發音檔 audio/${file}（${text}）不存在`); break; }
}

// 資料夾還在、但沒有列進 index.js 的島：遊戲裡看不到，可是檔案會跟著專案一起公開、一起部署
for(const d of readdirSync(join(ROOT,'islands'),{withFileTypes:true})) if(d.isDirectory()&&d.name!=='_template'&&!ids.has(d.name)&&existsSync(join(ROOT,'islands',d.name,'island.js')))
  warn(d.name,`islands/${d.name}/ 沒有列進 index.js。不要用的話把整個資料夾刪掉（示範的島 w08～w12、r0911 不在授權範圍內，要換題庫就要刪）`);

for(const w of warns) console.log('提醒 '+w);
for(const e of errors) console.log('錯誤 '+e);
const sum=ISLANDS.map(i=>`${i.id}（${i.review?'複習考':(i.words||[]).length+' 字'}、${(i.stages||[]).length} 關）`).join('、');
console.log(`\n${errors.length?'✗':'✓'} ${ISLANDS.length} 座島：${sum}\n  錯誤 ${errors.length} 個、提醒 ${warns.length} 個`);
process.exit(errors.length?1:0);
