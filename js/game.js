import * as THREE from 'three';
import {GLTFLoader} from 'three/addons/loaders/GLTFLoader.js';
import * as SkeletonUtils from 'three/addons/utils/SkeletonUtils.js';
import {ISLANDS as RAW_ISLANDS} from '../islands/index.js';
import * as cloud from './cloud.js';

/* ================= 關卡島資料（islands/ 資料夾，一座島一個檔） ================= */
const ENEMY_MODELS=['Skeleton_Minion','Skeleton_Rogue','Skeleton_Warrior','Skeleton_Mage'];
// 可愛怪物：Quaternius 的 Cute Animated Monsters（CC0），由 tools/convert_monsters.py 轉成 assets/m/<名字>.glb，打到那一關才載入。
// h 是模型原本的高度，載入時把每一隻縮放成差不多一樣高；fly 是會飛的（沒有站著的待機動作，身體浮在半空）
const MONSTERS={Alien:{h:2.1},Alien_Tall:{h:2.1},Cactus:{h:2.2},Crab:{h:1.6},Cyclops:{h:1.7},Deer:{h:1.9},Demon:{h:1.6},Ghost:{h:1.4},GreenDemon:{h:1.6},Panda:{h:1.6},Skull:{h:1.6},Tree:{h:2.8},Yeti:{h:1.7},
  Bat:{h:1.8,fly:1},Bee:{h:1.9,fly:1},YellowDragon:{h:1.6,fly:1}};
// 遊戲裡叫的是骷髏的動作名稱，這裡對到怪物自己的動作
const MON_ALIAS={Idle_Combat:'Idle','1H_Melee_Attack_Chop':'Bite_Front',Hit_A:'HitRecieve',Death_A:'Death',Cheer:'Dance',Taunt:'No',Spawn_Ground_Skeletons:'Jump'};
const FLY_ALIAS={...MON_ALIAS,Idle_Combat:'Flying',Cheer:'Flying',Taunt:'Bite_Front',Spawn_Ground_Skeletons:'Flying'};
const fixEnemy=e=>ENEMY_MODELS.includes(e)||MONSTERS[e]?e:ENEMY_MODELS[0];
const tag=(o,isl)=>Object.defineProperty(o,'_isl',{value:isl,enumerable:false,configurable:true});   // 單字、片語記住自己是哪座島的（發音檔、圖片、圖鑑都跟著原本的島）
function normIsland(src){
  const isl={conflict:[],phrases:[],bossQ:[],audio:{},boss:{},icon:'🏝️',color:'#f2a03d',...src};
  isl.base='islands/'+isl.id+'/';
  isl.words.forEach(w=>tag(w,isl)); isl.phrases.forEach(p=>tag(p,isl)); isl.bossQ=isl.bossQ.map(q=>({...q,isl}));
  isl.stages=src.stages.map((s,i)=>({...s,idx:i+1,key:isl.id+'/'+s.id,enemy:fixEnemy(s.enemy),
    words:s.boss?[]:isl.words.filter(w=>w.d===s.id)}));
  isl.byEn=Object.fromEntries(isl.words.map(w=>[w.en,w]));
  return isl;
}
// 複習考島：沒有自己的單字，從 from 列的島借；每一關（或魔王的每個階段）可以再指定只考哪幾座
function normReview(src,byId){
  const pick=ids=>(ids||src.from||[]).map(id=>byId[id]).filter(Boolean), srcs=pick();
  const isl={boss:{},icon:'🌋',color:'#ff5c5c',...src,review:true,sources:srcs,audio:{},base:'islands/'+src.id+'/'};
  isl.words=srcs.flatMap(s=>s.words); isl.conflict=srcs.flatMap(s=>s.conflict); isl.phrases=srcs.flatMap(s=>s.phrases);
  isl.bossQ=srcs.flatMap(s=>s.bossQ.map(q=>({...q,p:q.p==null?null:isl.phrases.indexOf(s.phrases[q.p])})));
  isl.stages=src.stages.map((s,i)=>({...s,idx:i+1,key:isl.id+'/'+s.id,enemy:fixEnemy(s.enemy),words:[],exam:true,
    phases:(s.phases||[{from:s.from,name:''}]).map(ph=>({...ph,srcs:pick(ph.from)}))}));
  isl.byEn=Object.fromEntries(isl.words.map(w=>[w.en,w]));
  return isl;
}
const NORMAL={}; for(const s of RAW_ISLANDS) if(!s.review) NORMAL[s.id]=normIsland(s);
const ISLANDS=RAW_ISLANDS.map(s=>s.review?normReview(s,NORMAL):NORMAL[s.id]);
const islandById=id=>ISLANDS.find(x=>x.id===id);
// 錯題洞窟：不分單元的特別關卡。不在地圖的島裡、不算過關數；全部島的單字和片語都放進來當選項的來源，題目只出錯題本裡的
const MISS_ISL=(()=>{ const srcs=Object.values(NORMAL);
  const isl={id:'miss',miss:true,week:'特別關卡',name:'錯題洞窟',icon:'📕',color:'#8f7bff',boss:{},audio:{},base:'',sources:srcs};
  isl.words=srcs.flatMap(s=>s.words); isl.conflict=srcs.flatMap(s=>s.conflict); isl.phrases=srcs.flatMap(s=>s.phrases);
  isl.bossQ=srcs.flatMap(s=>s.bossQ.map(q=>({...q,p:q.p==null?null:isl.phrases.indexOf(s.phrases[q.p])})));
  isl.byEn=Object.fromEntries(isl.words.map(w=>[w.en,w]));
  isl.stages=[{idx:1,id:'cave',key:'miss/cave',miss:true,chapter:'不分單元',topic:'錯題複習',place:'錯題洞窟',enemy:'Skeleton_Mage',enemyName:'錯題收藏家',color:0x8f7bff,scale:1.25,words:[],
    taunt:'嘿嘿嘿…你答錯過的題目，我全部收藏起來了！想拿回去？再答一次給我看！',hero:'同樣的地方不會再錯第二次，把它們全部搶回來！'}];
  return isl; })();
const ROOMS=Math.max(5,...ISLANDS.map(x=>x.stages.length));
const SP_DMG=2, ALL_DMG=4;   // 第一招必殺技、四人合體技的傷害（一般攻擊是 1）；後面學到的招式傷害寫在 HEROES 的 moves
// 目前所在的島；切換時把這些變數換成那座島的資料
let ISL, WORDS, CONFLICT, PHRASES, BOSS_Q, STAGES, AUDIO, byEn;
function useIsland(id){
  ISL=id==='miss'?MISS_ISL:(islandById(id)||ISLANDS[ISLANDS.length-1]);
  WORDS=ISL.words; CONFLICT=ISL.conflict; PHRASES=ISL.phrases; BOSS_Q=ISL.bossQ; STAGES=ISL.stages; AUDIO=ISL.audio; byEn=ISL.byEn;
  return ISL;
}

// wear：一開始穿的裝備（換裝商城的商品代號，'' 是不裝備）；hue：衣服主色的色相，染色時用來算要轉幾度
// moves：每 10 級學一招（lv 是學會的等級，dmg 是傷害，heal 是發動後回幾顆心）。第一招就是原本的必殺技。
// 傷害最多到 4：一關的怪物血量就是題數，招式再強下去，一關答不到幾題就結束了
const HEROES=[
 {id:'Knight',name:'騎士',role:'盾劍守護',spColor:0xffe07a,attack:'1H_Melee_Attack_Chop',hue:352,wear:{main:'Knight/1H_Sword',off:'Knight/Round_Shield',hat:'Knight/Knight_Helmet',cape:'Knight/Knight_Cape',color:''},
  moves:[{lv:1,name:'聖光斬',en:'Holy Strike'},{lv:10,name:'十字聖劍',en:'Cross Slash',dmg:3},{lv:20,name:'聖劍光雨',en:'Sword Rain',dmg:3,heal:2},{lv:30,name:'王者審判',en:"King's Judgment",dmg:4,heal:2},{lv:40,name:'聖盾衝擊',en:'Aegis Crash',dmg:4,heal:2},{lv:50,name:'天使降臨',en:'Seraph Descent',dmg:4,heal:3,color:0xfff3c4}]},
 {id:'Mage',name:'法師',role:'魔法飛彈',spColor:0xc27bff,attack:'Spellcast_Shoot',ranged:1,hue:250,wear:{main:'Mage/2H_Staff',off:'',hat:'Mage/Mage_Hat',cape:'Mage/Mage_Cape',color:''},
  moves:[{lv:1,name:'流星火雨',en:'Meteor Rain'},{lv:10,name:'冰霜新星',en:'Frost Nova',dmg:3,color:0x8fe6ff},{lv:20,name:'雷霆風暴',en:'Thunder Storm',dmg:3,heal:2,color:0xfff27a},{lv:30,name:'超新星',en:'Supernova',dmg:4,heal:2},{lv:40,name:'重力黑洞',en:'Black Hole',dmg:4,heal:2,color:0x8a5cff},{lv:50,name:'元素洪流',en:'Elemental Flood',dmg:4,heal:3,color:0xfff27a}]},
 {id:'Rogue',name:'盜賊',role:'雙刀疾風',spColor:0x6ff0ff,attack:'1H_Melee_Attack_Chop',hue:160,wear:{main:'Rogue/Knife',off:'Rogue/Knife_Offhand',hat:'',cape:'Rogue/Rogue_Cape',color:''},
  moves:[{lv:1,name:'影分身連斬',en:'Shadow Flurry'},{lv:10,name:'飛刀亂舞',en:'Dagger Storm',dmg:3},{lv:20,name:'瞬影十字',en:'Phantom Cross',dmg:3,heal:2},{lv:30,name:'千刃風暴',en:'Thousand Blades',dmg:4,heal:2},{lv:40,name:'影舞',en:'Shadow Dance',dmg:4,heal:2},{lv:50,name:'月影一閃',en:'Moonlight Flash',dmg:4,heal:3,color:0xbfd4ff}]},
 {id:'Barbarian',name:'蠻族',role:'巨斧旋風',spColor:0xff7a3d,attack:'2H_Melee_Attack_Spin',hue:200,wear:{main:'Barbarian/2H_Axe',off:'',hat:'Barbarian/Barbarian_Hat',cape:'Barbarian/Barbarian_Cape',color:''},
  moves:[{lv:1,name:'旋風巨斧',en:'Cyclone Axe'},{lv:10,name:'大地震擊',en:'Earthquake',dmg:3},{lv:20,name:'狂戰連旋',en:'Berserker Spin',dmg:3,heal:2},{lv:30,name:'隕石墜擊',en:'Meteor Smash',dmg:4,heal:2},{lv:40,name:'火山爆發',en:'Volcano',dmg:4,heal:2,color:0xff5a2a},{lv:50,name:'泰坦之怒',en:"Titan's Wrath",dmg:4,heal:3}]},
 // 隱藏勇者（hidden.lv 是解鎖門檻）：上面四位都練到 Lv30 才會出現。模型是 KayKit Adventurers 2.0 的 Ranger，由 tools/build_ranger.py 組出來
 {id:'Ranger',name:'弓箭手',role:'百步穿楊',hidden:{lv:30},spColor:0x8dff7a,attack:'2H_Ranged_Shoot',ranged:1,arrow:1,hue:208,wear:{main:'',off:'Ranger/Bow',hat:'',cape:'Ranger/Ranger_Cape',color:''},
  moves:[{lv:1,name:'連珠箭',en:'Rapid Shot'},{lv:10,name:'箭雨',en:'Arrow Rain',dmg:3},{lv:20,name:'爆裂箭',en:'Burst Arrow',dmg:3,heal:2,color:0xffa24a},{lv:30,name:'流星神射',en:'Starfall Shot',dmg:4,heal:2,color:0xfff3a0},{lv:40,name:'追蹤箭陣',en:'Seeker Volley',dmg:4,heal:2},{lv:50,name:'鳳凰箭',en:'Phoenix Arrow',dmg:4,heal:3,color:0xff8a3d}]},
 // 第二位隱藏勇者（hidden.all：排在他前面的勇者全部都要到門檻）。模型是 KayKit 1.0 的 Rogue_Hooded，由 tools/build_assassin.py 組出來。
 // kin：他身上的武器、披風跟盜賊是同一批零件，換裝時直接用自己模型上的，不用跟盜賊借
 {id:'Assassin',name:'刺客',role:'暗影突襲',kin:'Rogue',hidden:{lv:50,all:1},spColor:0xb07bff,attack:'Dualwield_Melee_Attack_Chop',hue:160,wear:{main:'Rogue/Knife',off:'Rogue/Knife_Offhand',hat:'',cape:'Rogue/Rogue_Cape',color:'color/shadow'},
  moves:[{lv:1,name:'背刺',en:'Backstab'},{lv:10,name:'煙幕連擊',en:'Smoke Combo',dmg:3},{lv:20,name:'燕返',en:'Swallow Return',dmg:3,heal:2},{lv:30,name:'幻影軍團',en:'Phantom Legion',dmg:4,heal:2},{lv:40,name:'暗影束縛',en:'Shadow Bind',dmg:4,heal:2,color:0x8a5cff},{lv:50,name:'終焉一閃',en:'Final Flash',dmg:4,heal:3,color:0xffffff}]},
];
for(const h of HEROES) h.moves.forEach((m,i)=>{ m.i=i; m.dmg=m.dmg||SP_DMG; m.heal=m.heal||1; m.color=m.color||h.spColor; });

/* ================= 換裝商城的商品 =================
   裝備全部是角色模型裡本來就有的零件：代號是「哪個角色的模型/零件名稱」，四位勇者骨架一樣，所以可以互相借來穿。
   每位勇者一開始穿的那幾件（HEROES 的 wear）自己穿不用買，別的勇者要穿才要買；買了之後四位勇者都能穿。 */
const SLOTS=[['main','武器'],['off','副手'],['hat','帽子'],['cape','披風'],['color','配色']];
const gear=(hero,node,slot,name,icon,price)=>({id:hero+'/'+node,hero,node,slot,name,icon,price});
// 配色：hue 把衣服的主色轉到這個色相；metal [色相,飽和度,亮度倍率] 把灰色的金屬染色；dark 整體壓暗。膚色、頭髮、皮革不動
const DYES=[
 {id:'red',name:'烈焰紅',hue:352,price:120},{id:'orange',name:'陽光橘',hue:28,price:120},{id:'green',name:'森林綠',hue:140,price:120},
 {id:'blue',name:'海洋藍',hue:212,price:120},{id:'purple',name:'皇家紫',hue:266,price:120},{id:'pink',name:'櫻花粉',hue:322,price:120},
 {id:'ice',name:'冰晶戰甲',hue:195,metal:[195,.5,1.1],price:250},{id:'shadow',name:'暗影',hue:270,metal:[262,.3,.6],dark:.72,price:250},{id:'gold',name:'黃金戰甲',hue:40,metal:[44,.8,1.08],price:300},
];
const ITEMS=[
 gear('Knight','1H_Sword','main','騎士長劍','🗡️',80), gear('Knight','2H_Sword','main','雙手大劍','⚔️',150),
 gear('Mage','2H_Staff','main','法師法杖','🪄',80), gear('Mage','1H_Wand','main','小魔杖','✨',100),
 gear('Rogue','Knife','main','短刀','🔪',60), gear('Rogue','1H_Crossbow','main','單手弩','🔫',120), gear('Rogue','2H_Crossbow','main','重弩','🎯',150), gear('Rogue','Throwable','main','投擲瓶','🧪',90),
 gear('Barbarian','2H_Axe','main','雙手巨斧','🪓',100), gear('Barbarian','1H_Axe','main','單手斧','⛏️',80), gear('Barbarian','Mug','main','大木杯','🥤',120),
 gear('Knight','Round_Shield','off','圓盾','🛡️',80), gear('Knight','Badge_Shield','off','徽章盾','🛡️',120), gear('Knight','Rectangle_Shield','off','方盾','🛡️',120), gear('Knight','Spike_Shield','off','尖刺盾','🛡️',150),
 gear('Ranger','Bow','off','遊俠長弓','🏹',200), gear('Knight','1H_Sword_Offhand','off','副手劍','🗡️',100), gear('Mage','Spellbook','off','魔法書','📕',100), gear('Mage','Spellbook_open','off','打開的魔法書','📖',120),
 gear('Rogue','Knife_Offhand','off','副手短刀','🔪',60), gear('Barbarian','Barbarian_Round_Shield','off','蠻族木盾','🛡️',100), gear('Barbarian','1H_Axe_Offhand','off','副手斧','🪓',100),
 gear('Knight','Knight_Helmet','hat','騎士頭盔','🪖',150), gear('Mage','Mage_Hat','hat','巫師帽','🧙',150), gear('Barbarian','Barbarian_Hat','hat','熊熊帽','🐻',180),
 gear('Knight','Knight_Cape','cape','騎士披風','🦸',100), gear('Mage','Mage_Cape','cape','法師披風','🦸',100), gear('Rogue','Rogue_Cape','cape','盜賊披風','🦸',100), gear('Barbarian','Barbarian_Cape','cape','蠻族披風','🦸',100),
 {...gear('Ranger','Ranger_Cape','cape','遊俠披風','🦸',0),only:'Ranger'},   // 2.0 的披風是跟著骨架變形的，沒辦法借給別人穿
 ...DYES.map(d=>({id:'color/'+d.id,slot:'color',name:d.name,price:d.price,dye:d})),
];
const ITEM=Object.fromEntries(ITEMS.map(x=>[x.id,x]));

/* ================= 存檔 ================= */
// earned / spent：金幣賺到的總數、花掉的總數（兩個都只增不減，跨裝置合併才不會把花掉的金幣加回來）；owned：買過的商品；wear：每位勇者換掉的裝備
const blankSave=()=>({v:2,stars:{},seen:{},hero:0,lv:{},miss:{},earned:null,spent:0,owned:{},wear:{},wu:0,island:null,name:'',owner:null});
const STAR_COIN=8;   // 這個版本之前拿到的星星，每顆補發 8 金幣
let save=blankSave();
const SKEY='word-dungeon-v2', OLD_KEY='word-dungeon-w11';
function fixSave(x){ const b=blankSave(); const o=Object.assign(b,x||{});
  for(const k of ['stars','seen','lv','miss','owned','wear']) if(!o[k]||typeof o[k]!=='object') o[k]={};
  if(typeof o.earned!=='number'||!(o.earned>=0)) o.earned=Object.values(o.stars).reduce((n,v)=>n+(v|0),0)*STAR_COIN;   // 還沒有金幣的舊存檔：照星星數補發
  o.spent=Math.max(0,o.spent|0); o.wu=+o.wu||0;
  for(const k in o.miss){ const m=o.miss[k]; if(!m||typeof m!=='object'||!(m.n>0)) delete o.miss[k]; else { m.ok=m.ok|0; if(!m.ty||typeof m.ty!=='object') m.ty={}; } }
  if(o.island==='miss') o.island=null;
  o.hero=Math.max(0,Math.min(HEROES.length-1,o.hero|0)); o.name=typeof o.name==='string'?o.name.slice(0,12):''; o.v=2; return o; }
try{
  const s=JSON.parse(localStorage.getItem(SKEY)||'null');
  if(s) save=fixSave(s);
  else { // 舊版（只有 Week 11）的存檔搬過來：關卡與單字都加上島的代號
    const o=JSON.parse(localStorage.getItem(OLD_KEY)||'null');
    if(o){ const pre=k=>'w11/'+k, mv=m=>Object.fromEntries(Object.entries(m||{}).map(([k,v])=>[pre(k),v]));
      save=fixSave({stars:mv(o.stars),seen:mv(o.seen),hero:o.hero,lv:o.lv,island:'w11'}); localStorage.setItem(SKEY,JSON.stringify(save)); }
  }
}catch(e){}
useIsland(save.island);
const MAX_LV=50, RAINBOW_LV=30;   // 等級上限；Lv30 起腳下的光環變成會變色的彩虹
const lvOf=id=>Math.max(1,Math.min(MAX_LV,save.lv[id]|0));
// 愛心：Lv7 以前每兩級 +1（最多 8 顆），Lv15、25、35、45 各再 +1（最多 12 顆）
const heartsFor=lv=>5+Math.min(3,Math.floor((lv-1)/2))+(lv>=15?1:0)+(lv>=25?1:0)+(lv>=35?1:0)+(lv>=45?1:0);
// 稱號、腳下光環的顏色：[從第幾級開始, 稱號, 光環]
const TIERS=[[50,'創世',0xffffff],[45,'天神',0xffffff],[40,'霸主',0xffffff],[35,'無雙',0xffffff],[30,'至尊',0xffffff],[25,'永恆',0x9dff6a],[20,'星辰',0xfff3a0],[15,'神話',0xff6fb5],[10,'王者',0x4dfff0],[8,'傳奇',0xc77dff],[6,'英雄',0xff6a3d],[4,'精英',0xffc64a],[2,'勇敢',0x6fb8ff],[1,'見習',null]];
const tierOf=lv=>TIERS.find(t=>lv>=t[0])||TIERS[TIERS.length-1];
const rankOf=lv=>tierOf(lv)[1];
const auraOf=lv=>tierOf(lv)[2];
// 招式：等級到了才學得會
const movesOf=def=>def.moves.filter(m=>lvOf(def.id)>=m.lv);
// 隱藏勇者：要哪些勇者到幾級才開放。一般的只看沒有隱藏的那幾位；有 all 的要排在他前面的全部勇者都到。
// 不另外存旗標，直接看等級（等級只會增加）
const unlockNeeds=k=>HEROES.filter((h,j)=>j!==k&&(HEROES[k].hidden.all?j<k:!h.hidden));
const heroOpen=k=>!!HEROES[k]&&(!HEROES[k].hidden||unlockNeeds(k).every(h=>lvOf(h.id)>=HEROES[k].hidden.lv));
function fixHero(){ if(!heroOpen(save.hero)) save.hero=0; }
function persistLocal(){try{localStorage.setItem(SKEY,JSON.stringify(save));}catch(e){}}
function persist(){ persistLocal(); cloud.queueSave(); }
/* 錯題本：save.miss = { 'w11/low': {n:答錯幾次, ok:最近連續答對幾次, t:最後答錯的時間, u:最後更新的時間, ty:{題型:答錯幾次}} }
   片語的 key 多一個 ~（'w10/~think of'）。連續答對 MISS_OK 次算「已掌握」：不再進錯題洞窟，但紀錄留著給大人看。 */
const MISS_OK=2, MISS_MAX=10, MISS_MIN=5;   // 幾次算掌握、洞窟一次最多幾題、不到幾題時拿已掌握的來補
const TYPE_ZH={en2zh:'看英文選中文',zh2en:'看中文選英文',tf:'是非題',spell:'拼單字',blank:'補字母',arrange:'排片語',listen:'聽聲音選單字',listen2zh:'聽聲音選中文',listenSpell:'聽寫',pic:'看圖選字',opp:'相反詞'};
function missKeyOf(it,q){ if(it.w) return islOf(it.w).id+'/'+it.w.en; const p=q&&q.p!=null?PHRASES[q.p]:null; return p?islOf(p).id+'/~'+p.en:null; }
function noteWrong(it,q){ const k=missKeyOf(it,q); if(!k) return; const now=Date.now(), m=save.miss[k]||(save.miss[k]={n:0,ok:0,t:0,u:0,ty:{}});
  m.n++; m.ok=0; m.t=m.u=now; const ty=q.type||q.label; m.ty[ty]=(m.ty[ty]||0)+1; persist(); }
// 答對一次記一次；同一關裡答錯後馬上重考的那次不算。回傳 true 代表這一題剛好「掌握了」
function noteRight(it,q){ const k=missKeyOf(it,q), m=k&&save.miss[k]; if(!m||it.retry) return false; m.ok++; m.u=Date.now(); persist(); return m.ok===MISS_OK; }
// 把紀錄對回單字、片語（島的內容改過而找不到的就跳過），最常錯的排前面
function missEntries(){ const out=[];
  for(const k in save.miss){ const m=save.miss[k], i=k.indexOf('/'), isl=NORMAL[k.slice(0,i)], name=k.slice(i+1); if(!isl) continue;
    if(name[0]==='~'){ const p=isl.phrases.find(x=>x.en===name.slice(1)); if(p) out.push({k,m,p,isl}); } else { const w=isl.byEn[name]; if(w) out.push({k,m,w,isl}); } }
  return out.sort((a,b)=>b.m.n-a.m.n||b.m.t-a.m.t); }
const missActive=()=>missEntries().filter(x=>x.m.ok<MISS_OK);
const topType=m=>{ const t=Object.entries(m.ty||{}).sort((a,b)=>b[1]-a[1])[0]; return t?t[0]:null; };
// 錯題洞窟這一輪要出的題：還沒掌握的先出（錯越多次越優先），不到 MISS_MIN 題就拿以前最常錯、已經掌握的來補
function missItems(){ const all=missEntries(), act=shuffle(all.filter(x=>x.m.ok<MISS_OK)).sort((a,b)=>b.m.n-a.m.n).slice(0,MISS_MAX); if(!act.length) return [];
  const pad=all.filter(x=>x.m.ok>=MISS_OK).slice(0,Math.max(0,MISS_MIN-act.length));
  return shuffle([...act,...pad]).map((x,n)=>{ if(x.w) return {key:'m'+n,w:x.w,e:x.w.e,prefer:topType(x.m)};
    const k=PHRASES.indexOf(x.p), q=k<0?null:pickPhraseQs(1,[k])[0]; return q?{key:'m'+n,q,e:'📜'}:null; }).filter(Boolean); }   // 片語題要在錯題洞窟的島上才出得了

/* 金幣與穿著 */
const coins=()=>Math.max(0,(save.earned|0)-(save.spent|0));
function addCoins(n){ save.earned=(save.earned|0)+n; persist(); }
const clearCoins=(st,stars)=>(st.boss||st.exam?20:10)+5*stars;   // 過一關拿的金幣：小王、試煉多 10，每顆星再 +5
// 這位勇者穿得了嗎：自己本來就有的、或買過的
const canWear=(k,id)=>!id||(!!ITEM[id]&&(!ITEM[id].only||ITEM[id].only===HEROES[k].id)&&(HEROES[k].wear[ITEM[id].slot]===id||!!save.owned[id]));
// 這位勇者現在穿什麼（存檔裡只記有換掉的；商品被拿掉或沒買就退回預設）
function wearOf(k){ const def=HEROES[k], w={...def.wear}, m=save.wear[def.id]; if(m&&typeof m==='object') for(const [slot] of SLOTS){ const id=m[slot]; if(typeof id==='string'&&canWear(k,id)&&(!id||ITEM[id].slot===slot)) w[slot]=id; } return w; }
function setWear(k,slot,id){ const def=HEROES[k], m=save.wear[def.id]||(save.wear[def.id]={}); if(id===def.wear[slot]) delete m[slot]; else m[slot]=id; save.wu=Date.now(); persist(); }

// 進度統計（主選單、地圖、排行榜共用）
const starsOf=st=>save.stars[st.key]||0;
const islandStars=isl=>isl.stages.reduce((n,st)=>n+starsOf(st),0);
const islandCleared=isl=>isl.stages.filter(st=>starsOf(st)>0).length;
function progress(){ let cleared=0,stars=0,total=0; for(const isl of ISLANDS){ cleared+=islandCleared(isl); stars+=islandStars(isl); total+=isl.stages.length; } return {cleared,stars,total}; }

/* ================= 聲音 ================= */
let muted=false, actx=null;
function ac(){ if(!actx){try{actx=new (window.AudioContext||window.webkitAudioContext)(); }catch(e){}} if(actx&&actx.state==='suspended') actx.resume(); return actx;}
addEventListener('pointerdown',()=>ac(),{passive:true});
function tone(f,dur=.15,type='sine',vol=.12,delay=0,slide=0){
  if(muted) return; const c=ac(); if(!c) return; const t=c.currentTime+delay;
  const o=c.createOscillator(), g=c.createGain(); o.type=type; o.frequency.setValueAtTime(f,t); if(slide) o.frequency.exponentialRampToValueAtTime(Math.max(40,f+slide),t+dur);
  g.gain.setValueAtTime(0.0001,t); g.gain.exponentialRampToValueAtTime(vol,t+.015); g.gain.exponentialRampToValueAtTime(0.0001,t+dur);
  o.connect(g).connect(c.destination); o.start(t); o.stop(t+dur+.05);
}
function noise(dur=.18,vol=.18,delay=0){
  if(muted) return; const c=ac(); if(!c) return; const t=c.currentTime+delay;
  const b=c.createBuffer(1,c.sampleRate*dur,c.sampleRate), d=b.getChannelData(0); for(let i=0;i<d.length;i++) d[i]=(Math.random()*2-1)*(1-i/d.length);
  const s=c.createBufferSource(); s.buffer=b; const f=c.createBiquadFilter(); f.type='bandpass'; f.frequency.value=1800; const g=c.createGain(); g.gain.value=vol;
  s.connect(f).connect(g).connect(c.destination); s.start(t);
}
const SFX={
  ok(){tone(660,.12,'triangle',.14);tone(880,.12,'triangle',.14,.08);tone(1320,.2,'triangle',.12,.16);},
  no(){tone(220,.28,'sawtooth',.08,0,-90);},
  hit(){noise(.16,.22);tone(180,.12,'square',.06,0,-80);},
  hurt(){noise(.2,.18);tone(140,.25,'sawtooth',.07,0,-60);},
  magic(){tone(500,.4,'sine',.1,0,900);},
  tap(){tone(520,.05,'triangle',.06);},
  win(){[523,659,784,1046].forEach((f,i)=>tone(f,.25,'triangle',.13,i*.12));tone(1046,.6,'triangle',.1,.5);},
  spawn(){tone(90,.6,'sawtooth',.06,0,60);noise(.5,.08);},
};
const synth=('speechSynthesis' in window)?window.speechSynthesis:null; let enVoice=null;
function pickVoice(){ if(!synth) return; const vs=synth.getVoices()||[];
  enVoice=vs.find(v=>/en[-_]US/i.test(v.lang)&&/Samantha|Google US|Jenny|Aria|Allison|Ava/i.test(v.name))||vs.find(v=>/en[-_]US/i.test(v.lang))||vs.find(v=>/^en/i.test(v.lang))||null;}
if(synth){pickVoice(); try{synth.addEventListener('voiceschanged',pickVoice);}catch(e){}}
const abuf={};
function audioKey(t,isl=ISL){ const A=isl.audio; if(A[t]) return t; const k=t.replace(/sb\./g,'somebody').replace(/sth\./g,'something').replace(/…/g,'').trim(); return A[k]?k:null; }
const clipUrl=(k,isl=ISL)=>isl.base+'audio/'+isl.audio[k];
async function loadClip(k,isl=ISL){ const id=isl.id+'|'+k; if(abuf[id]) return abuf[id]; const c=ac(); if(!c) return null;
  abuf[id]=fetch(clipUrl(k,isl)).then(r=>r.arrayBuffer()).then(b=>new Promise((res,rej)=>c.decodeAudioData(b,res,rej))).catch(()=>{delete abuf[id];return null;});
  return abuf[id]; }
let curSrc=null, player=null, htmlAudioOK=true;
try{ if(navigator.audioSession) navigator.audioSession.type='playback'; }catch(e){}
function getPlayer(){ if(!player){ player=new Audio(); player.preload='auto'; player.addEventListener('error',()=>{htmlAudioOK=false;}); } return player; }
addEventListener('pointerdown',function unlock(){ removeEventListener('pointerdown',unlock); const first=Object.keys(AUDIO)[0]; if(!first) return;
  const p=getPlayer(); p.src=clipUrl(first); p.muted=true;
  p.play().then(()=>{p.pause();p.currentTime=0;p.muted=false;}).catch(()=>{p.muted=false;}); },{passive:true});
function synthSay(t){ if(!synth) return; try{synth.cancel(); const u=new SpeechSynthesisUtterance(t.replace(/sb's/g,"somebody's").replace(/sb\./g,'somebody').replace(/sth\./g,'something').replace(/…/g,'')); u.lang='en-US'; if(enVoice) u.voice=enVoice; u.rate=.82; synth.speak(u);}catch(e){} }
async function webAudioSay(k,isl){ const c=ac(); const buf=await loadClip(k,isl); if(!buf||!c) return false; try{ if(curSrc) curSrc.stop(); }catch(e){}
  const src=c.createBufferSource(); src.buffer=buf; src.connect(c.destination); src.start(); curSrc=src; return true; }
async function say(t,isl=ISL){ if(muted) return; const k=audioKey(t,isl); if(!k){ synthSay(t); return; }
  if(htmlAudioOK){ const p=getPlayer(); try{ p.muted=false; p.src=clipUrl(k,isl); await p.play(); return; }catch(e){ if(e&&e.name==='NotSupportedError') htmlAudioOK=false; } }
  if(await webAudioSay(k,isl)) return; synthSay(t); }

/* ================= 3D 基礎 ================= */
const canvas=document.getElementById('scene');
const renderer=new THREE.WebGLRenderer({canvas,antialias:true,powerPreference:'high-performance'});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping; renderer.toneMappingExposure=1.15;
renderer.shadowMap.enabled=true; renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();
scene.background=new THREE.Color(0x0c0b12); scene.fog=new THREE.Fog(0x0c0b12,16,46);
const camera=new THREE.PerspectiveCamera(48,1,.1,140);
scene.add(new THREE.HemisphereLight(0x9aa6ff,0x3a2414,.75));
const sun=new THREE.DirectionalLight(0xfff0dd,1.1); sun.position.set(6,14,8); sun.castShadow=true;
sun.shadow.mapSize.set(1024,1024); Object.assign(sun.shadow.camera,{left:-9,right:9,top:9,bottom:-9,near:1,far:40}); sun.shadow.bias=-.0008;
scene.add(sun,sun.target);
const roomLight=new THREE.PointLight(0xffa54a,38,22,1.6); roomLight.position.set(0,5,0); scene.add(roomLight);
const heroLight=new THREE.PointLight(0xffe2b0,14,9,1.8); scene.add(heroLight);

const CZ=i=>-i*18;   // 0 入口，1 之後一關一個房間
const LAST_Z=CZ(ROOMS)-10;

function glowTex(inner,outer){const c=document.createElement('canvas');c.width=c.height=128;const g=c.getContext('2d');const r=g.createRadialGradient(64,64,0,64,64,64);r.addColorStop(0,inner);r.addColorStop(.35,outer);r.addColorStop(1,'rgba(0,0,0,0)');g.fillStyle=r;g.fillRect(0,0,128,128);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;}
const FLAME_TEX=glowTex('rgba(255,250,220,1)','rgba(255,140,40,.8)');
const SPARK_TEX=glowTex('rgba(255,255,255,1)','rgba(255,190,90,.7)');
const MAGIC_TEX=glowTex('rgba(255,255,255,1)','rgba(170,110,255,.8)');
const flames=[];
function addFlame(x,y,z,s=1.1){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:FLAME_TEX,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));m.position.set(x,y,z);m.scale.setScalar(s);m.userData.base=s;m.userData.ph=Math.random()*10;scene.add(m);flames.push(m);return m;}

// 漂浮塵埃
{const n=260,g=new THREE.BufferGeometry(),p=new Float32Array(n*3);for(let i=0;i<n;i++){p[i*3]=(Math.random()-.5)*16;p[i*3+1]=Math.random()*6;p[i*3+2]=16-Math.random()*(16-LAST_Z);}
 g.setAttribute('position',new THREE.BufferAttribute(p,3));
 const dust=new THREE.Points(g,new THREE.PointsMaterial({map:SPARK_TEX,size:.09,color:0xffd9a0,transparent:true,opacity:.55,depthWrite:false,blending:THREE.AdditiveBlending}));dust.name='dust';scene.add(dust);}

/* ================= 載入素材 ================= */
const loader=new GLTFLoader();
const CHAR_FILES=['Knight','Mage','Rogue','Barbarian','Ranger','Assassin','Skeleton_Minion','Skeleton_Rogue','Skeleton_Warrior','Skeleton_Mage'];
const PROP_FILES=['floor_tile_large','wall','wall_arched','torch_mounted','pillar_decorated','barrel_large','chest_gold','banner_patternA_red','banner_patternB_blue','crates_stacked','column','candle_triple','coin_stack_large','sword_shield_gold','rubble_large','keg_decorated'];
const G={}, P={};
async function loadAll(){
  const total=CHAR_FILES.length+PROP_FILES.length; let done=0;
  const tick=()=>{done++;document.getElementById('loadFill').style.width=(done/total*100)+'%';};
  // 自己把 JSON + base64 組回 GLB 再交給 loader.parse，避免頁面安全規則擋掉 data: 讀取
  const enc=new TextEncoder();
  const lp=async url=>{
    let r; for(let t=0;t<3;t++){ try{ r=await fetch(url); if(r.ok) break; }catch(e){ if(t===2) throw e; } await sleep(400); }
    if(!r||!r.ok) throw new Error(url+' HTTP '+(r&&r.status));
    const j=await r.json(); const uri=j.buffers[0].uri; delete j.buffers[0].uri;
    const s=atob(uri.slice(uri.indexOf(',')+1)); const bin=new Uint8Array(s.length); for(let i=0;i<s.length;i++) bin[i]=s.charCodeAt(i);
    let js=enc.encode(JSON.stringify(j)); const jl=Math.ceil(js.length/4)*4, bl=Math.ceil(bin.length/4)*4;
    const out=new Uint8Array(12+8+jl+8+bl); const dv=new DataView(out.buffer);
    dv.setUint32(0,0x46546C67,true); dv.setUint32(4,2,true); dv.setUint32(8,out.length,true);
    dv.setUint32(12,jl,true); dv.setUint32(16,0x4E4F534A,true); out.fill(0x20,20,20+jl); out.set(js,20);
    const o=20+jl; dv.setUint32(o,bl,true); dv.setUint32(o+4,0x004E4942,true); out.set(bin,o+8);
    const g=await loader.parseAsync(out.buffer,''); tick(); return g;
  };
  await Promise.all([
    ...CHAR_FILES.map(async n=>{G[n]=await lp('assets/'+n+'.json');}),
    ...PROP_FILES.map(async n=>{P[n]=(await lp('assets/d/'+n+'.json')).scene;}),
  ]);
}

/* 靜態場景：用 InstancedMesh 鋪地城 */
function place(name,list,{cast=false}={}){
  const src=P[name]; src.updateMatrixWorld(true); const meshes=[]; src.traverse(o=>{if(o.isMesh) meshes.push(o);});
  const M=new THREE.Matrix4(),q=new THREE.Quaternion(),e=new THREE.Euler(),v=new THREE.Vector3(),s=new THREE.Vector3();
  for(const m of meshes){
    const im=new THREE.InstancedMesh(m.geometry,m.material,list.length);
    list.forEach((t,i)=>{e.set(0,t.ry||0,0);q.setFromEuler(e);v.set(t.x,t.y||0,t.z);s.setScalar(t.s||1);M.compose(v,q,s).multiply(m.matrixWorld);im.setMatrixAt(i,M);});
    im.instanceMatrix.needsUpdate=true; im.receiveShadow=true; im.castShadow=cast; im.frustumCulled=false; scene.add(im);
  }
}
function buildDungeon(){
  const floor=[]; for(let z=16;z>=LAST_Z+2;z-=4) for(const x of [-6,-2,2,6]) floor.push({x,z});
  place('floor_tile_large',floor);
  const wallsL=[],wallsR=[],arch=[];
  for(let z=16;z>=LAST_Z+2;z-=4){ const a=((z/4)|0)%3===0; (a?arch:wallsL).push({x:-8.5,z,ry:Math.PI/2}); (a?arch:wallsR).push({x:8.5,z,ry:-Math.PI/2}); }
  place('wall',[...wallsL,...wallsR]); place('wall_arched',arch);
  place('wall',[{x:-6,z:LAST_Z-.5},{x:6,z:LAST_Z-.5},{x:-2,z:LAST_Z-.5},{x:2,z:LAST_Z-.5}]);
  const torches=[],pillars=[],bannersR=[],bannersB=[],barrels=[],crates=[],candles=[],kegs=[],columns=[],rubble=[];
  for(let i=0;i<=ROOMS;i++){
    const z=CZ(i);
    for(const dz of [-5,5]){ torches.push({x:-8,y:2.2,z:z+dz,ry:Math.PI/2},{x:8,y:2.2,z:z+dz,ry:-Math.PI/2});
      addFlame(-7.55,2.95,z+dz); addFlame(7.55,2.95,z+dz); }
    pillars.push({x:-6.9,z:z+9},{x:6.9,z:z+9});
    (i%2?bannersB:bannersR).push({x:-8.35,y:.2,z,ry:Math.PI/2},{x:8.35,y:.2,z,ry:-Math.PI/2});
    barrels.push({x:-6.6,z:z+2.4,s:.8},{x:6.8,z:z-1.6,s:.75});
    crates.push({x:6.5,z:z+3.2,ry:.4,s:.8});
    if(i%2===0) kegs.push({x:-6.4,z:z-3.4,ry:Math.PI/2,s:.8}); else rubble.push({x:-6.2,z:z-3.2,ry:Math.PI/2,s:.5});
    candles.push({x:-1.8,z:z-5.4},{x:1.9,z:z-5.2});
    columns.push({x:-3.2,z:z-5.6},{x:3.2,z:z-5.6});
  }
  place('torch_mounted',torches); place('pillar_decorated',pillars,{cast:true});
  place('banner_patternA_red',bannersR); place('banner_patternB_blue',bannersB);
  place('barrel_large',barrels,{cast:true}); place('crates_stacked',crates,{cast:true}); place('keg_decorated',kegs);
  place('rubble_large',rubble); place('candle_triple',candles); place('column',columns);
  for(const c of candles) addFlame(c.x+.05,1.05,c.z,.45);
  const rooms=Array.from({length:ROOMS},(_,i)=>i+1);
  place('chest_gold',rooms.map(i=>({x:0,z:CZ(i)-6.4})),{cast:true});
  place('coin_stack_large',rooms.map(i=>({x:-1.4,z:CZ(i)-6.8,s:.6})));
  place('sword_shield_gold',[{x:0,y:2.4,z:LAST_Z+.05,s:1.3}]);
}

/* ================= 角色 ================= */
class Actor{
  constructor(gltf,{clone=false,idle='Idle',hide=[],alias={}}={}){
    this.root=clone?SkeletonUtils.clone(gltf.scene):gltf.scene;
    this.root.traverse(o=>{ if(hide.includes(o.name)) o.visible=false; if(o.isMesh){o.castShadow=true;o.frustumCulled=false;} });
    this.mixer=new THREE.AnimationMixer(this.root); this.clips={}; for(const c of gltf.animations) this.clips[c.name.split('|').pop()]=c;   // Blender 轉出來的動作名稱前面會多一段骨架的名字
    this.alias=alias; this.idle=idle; this.cur=null; this.tok=0; scene.add(this.root); this.play(idle);
  }
  play(name,{once=false,fade=.18,ts=1,hold=false}={}){
    const clip=this.clips[this.alias[name]||name]; if(!clip) return Promise.resolve();
    const a=this.mixer.clipAction(clip), prev=this.cur;
    a.enabled=true; a.reset(); a.setEffectiveTimeScale(ts); a.setEffectiveWeight(1);
    a.setLoop(once?THREE.LoopOnce:THREE.LoopRepeat,Infinity); a.clampWhenFinished=true;
    if(prev&&prev!==a){prev.fadeOut(fade); a.fadeIn(fade);} a.play(); this.cur=a;
    const tok=++this.tok; if(!once) return Promise.resolve();
    const ms=Math.max(120,clip.duration/ts*1000-fade*1000);
    return new Promise(r=>setTimeout(()=>{ if(tok===this.tok&&!hold) this.play(this.idle); r(); },ms));
  }
  get pos(){return this.root.position;}
}
const RING_TEX=(()=>{const c=document.createElement('canvas');c.width=c.height=256;const g=c.getContext('2d');const r=g.createRadialGradient(128,128,60,128,128,128);r.addColorStop(0,'rgba(255,255,255,0)');r.addColorStop(.62,'rgba(255,255,255,.9)');r.addColorStop(.72,'rgba(255,255,255,.35)');r.addColorStop(1,'rgba(255,255,255,0)');g.fillStyle=r;g.fillRect(0,0,256,256);const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;})();
const rings=[];
function addRing(actor){const m=new THREE.Mesh(new THREE.PlaneGeometry(2.6,2.6),new THREE.MeshBasicMaterial({map:RING_TEX,transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,color:0xffffff}));m.rotation.x=-Math.PI/2;m.position.y=.04;m.visible=false;actor.root.add(m);actor.ring=m;rings.push(m);}
function applyLevelLook(k){const h=heroes[k];if(!h)return;const lv=lvOf(HEROES[k].id);h.root.scale.setScalar(1+Math.min(.2,(lv-1)*.025));const col=auraOf(lv);h.ring.visible=!!col;if(col)h.ring.material.color.setHex(col);h.ring.userData.rainbow=lv>=RAINBOW_LV;h.ring.scale.setScalar(lv>=MAX_LV?1.4:1);}
/* 換裝：把選中的零件顯示出來。自己模型上的零件切換顯示就好；別的勇者的零件複製一份掛到同一根骨頭上 */
const SLOT_BONE={main:'handslotr',off:'handslotl',hat:'head',cape:'chest'};   // three.js 載入時會把骨頭名稱裡的點拿掉（handslot.r → handslotr）
function initGear(k){ const h=heroes[k], def=HEROES[k]; h.gear={}; h.bone={}; h.borrow={};
  for(const it of ITEMS) if(it.hero===def.id||it.hero===def.kin){ const o=h.root.getObjectByName(it.node); if(o) h.gear[it.node]=o; }
  for(const slot in SLOT_BONE) h.bone[slot]=h.root.getObjectByName(SLOT_BONE[slot]);
  h.root.traverse(o=>{ if(o.isSkinnedMesh&&!h.mat) h.mat=o.material; }); h.map0=h.mat.map; h.dyed={};
  h.lend=h.mat.clone(); h.lend.map=h.map0; }   // 借給別人的零件用原本的顏色，不跟著這位勇者染色
function applyWear(k,w=wearOf(k)){ const h=heroes[k], def=HEROES[k]; if(!h||!h.gear) return;
  const own=x=>!!x.node&&(x.hero===def.id||x.hero===def.kin)&&!!h.gear[x.node];   // 這件零件自己的模型上就有
  for(const slot in SLOT_BONE){ const id=w[slot], it=ITEM[id];
    for(const x of ITEMS) if(x.slot===slot&&own(x)) h.gear[x.node].visible=(x.id===id);
    if(h.borrow[slot]){ h.borrow[slot].removeFromParent(); h.borrow[slot]=null; }
    if(it&&!own(it)){ const src=heroes[HEROES.findIndex(x=>x.id===it.hero)], o=src&&src.gear[it.node], bone=h.bone[slot];
      if(o&&bone){ const c=o.clone(); c.visible=true; c.traverse(m=>{ if(m.isMesh) m.material=src.lend; }); bone.add(c); h.borrow[slot]=c; } } }
  const dye=ITEM[w.color]&&ITEM[w.color].dye; h.mat.map=dye?(h.dyed[dye.id]||(h.dyed[dye.id]=dyeTexture(h.map0,dye,def.hue))):h.map0; h.mat.needsUpdate=true;
}
// 染色：把貼圖畫到畫布上，一個一個像素換顏色。貼圖本身只是幾十格色票，所以 512 就夠
function dyeTexture(map,dye,base){
  const N=512, c=document.createElement('canvas'); c.width=c.height=N; const g=c.getContext('2d',{willReadFrequently:true}); g.drawImage(map.image,0,0,N,N);
  const im=g.getImageData(0,0,N,N), d=im.data;
  for(let i=0;i<d.length;i+=4){ const r=d[i]/255, gr=d[i+1]/255, b=d[i+2]/255, mx=Math.max(r,gr,b), mn=Math.min(r,gr,b); let l=(mx+mn)/2, s=0, h=0;
    if(mx!==mn){ const df=mx-mn; s=l>.5?df/(2-mx-mn):df/(mx+mn); h=mx===r?(gr-b)/df+(gr<b?6:0):mx===gr?(b-r)/df+2:(r-gr)/df+4; h*=60; }
    if(s<.16){ if(dye.metal){ h=dye.metal[0]; s=dye.metal[1]; l=Math.min(1,l*dye.metal[2]); } if(dye.dark) l*=dye.dark; }   // 灰、白、黑：金屬
    else if(!(h>=8&&h<=42)){                                                                       // 8°–42° 是膚色、頭髮、皮革，不動
      // 衣服：主色轉到指定的色相；跟主色不同色的部分（例如法師的披風）往同一個色系靠攏，只留三成的差距，才不會冒出不搭的顏色
      if(dye.hue!=null){ const off=((h-base+540)%360)-180; h=(dye.hue+off*.3+360)%360; }
      if(dye.dark) l*=dye.dark; }
    const q=l<.5?l*(1+s):l+s-l*s, p2=2*l-q, f=t=>{ t=((t%1)+1)%1; return t<1/6?p2+(q-p2)*6*t:t<.5?q:t<2/3?p2+(q-p2)*(2/3-t)*6:p2; }, hh=h/360;
    d[i]=f(hh+1/3)*255; d[i+1]=f(hh)*255; d[i+2]=f(hh-1/3)*255; }
  g.putImageData(im,0,0);
  const t=new THREE.CanvasTexture(c); t.flipY=map.flipY; t.colorSpace=map.colorSpace; t.wrapS=map.wrapS; t.wrapT=map.wrapT; t.magFilter=map.magFilter; t.minFilter=map.minFilter; t.channel=map.channel; t.needsUpdate=true; return t;
}
let shieldOn=false;
let heroes=[], hero=null, heroDef=HEROES[save.hero]||HEROES[0], enemies={};

/* ================= 小工具 ================= */
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const tweens=[];
function tween(ms,fn,ease=k=>k<.5?2*k*k:1-Math.pow(-2*k+2,2)/2){return new Promise(r=>tweens.push({t0:performance.now(),ms,fn,ease,r}));}
const shuffle=a=>{a=a.slice();for(let i=a.length-1;i>0;i--){const j=Math.random()*(i+1)|0;[a[i],a[j]]=[a[j],a[i]];}return a;};
const $=id=>document.getElementById(id);
const panel=$('panel');
const esc=s=>String(s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));

/* 粒子 */
const parts=[];
function burst(pos,{n=16,tex=SPARK_TEX,color=0xffffff,speed=4,size=.35,life=650}={}){
  for(let i=0;i<n;i++){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));
    m.position.copy(pos); m.scale.setScalar(size*(.6+Math.random()*.8));
    const v=new THREE.Vector3((Math.random()-.5),(Math.random()*.9+.2),(Math.random()-.5)).normalize().multiplyScalar(speed*(.5+Math.random()*.7));
    scene.add(m); parts.push({m,v,t0:performance.now(),life});}
}
function floater(text,worldPos,hurt=false){
  const v=worldPos.clone().project(camera); const r=canvas.getBoundingClientRect();
  const el=document.createElement('div'); el.className='dmg'+(hurt?' hurt':''); el.textContent=text;
  el.style.left=((v.x+1)/2*r.width)+'px'; el.style.top=((1-v.y)/2*r.height)+'px';
  $('floaters').appendChild(el); setTimeout(()=>el.remove(),1000);
}
let shake=0;
function flashRed(){const f=$('flash');f.classList.add('on');setTimeout(()=>f.classList.remove('on'),260);}
async function fadeOut(){$('fade').style.opacity=1;await sleep(470);}
async function fadeIn(){$('fade').style.opacity=0;await sleep(300);}

/* 被封印的單字光球 */
let orbs=[];
function makeOrbTex(emoji,label){
  const c=document.createElement('canvas');c.width=256;c.height=256;const g=c.getContext('2d');
  const r=g.createRadialGradient(128,110,10,128,110,110);r.addColorStop(0,'rgba(255,240,200,.95)');r.addColorStop(.55,'rgba(242,160,61,.55)');r.addColorStop(1,'rgba(242,160,61,0)');
  g.fillStyle=r;g.beginPath();g.arc(128,110,110,0,7);g.fill();
  g.font='92px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif';g.textAlign='center';g.textBaseline='middle';g.fillText(emoji,128,104);
  if(label){g.font='700 30px Fredoka, sans-serif';g.fillStyle='#fff';g.strokeStyle='rgba(0,0,0,.65)';g.lineWidth=6;g.strokeText(label,128,212);g.fillText(label,128,212);}
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
function clearOrbs(){for(const o of orbs) scene.remove(o.m); orbs=[];}
function makeOrbs(items,center){
  clearOrbs(); const n=items.length;
  items.forEach((it,i)=>{const m=new THREE.Sprite(new THREE.SpriteMaterial({map:makeOrbTex(it.e,''),transparent:true,depthWrite:false}));
    m.scale.setScalar(1.15); scene.add(m); orbs.push({m,key:it.key,a:i/n*Math.PI*2,c:center.clone(),free:false});});
}
async function freeOrb(key){
  const o=orbs.find(o=>o.key===key&&!o.free); if(!o) return; o.free=true;
  const from=o.m.position.clone(), to=hero.pos.clone().add(new THREE.Vector3(0,3.2,0));
  await tween(650,k=>{o.m.position.lerpVectors(from,to,k);o.m.position.y+=Math.sin(k*Math.PI)*1.5;o.m.scale.setScalar(1.15+k*.6);o.m.material.opacity=1-k*.85;});
  burst(to,{n:10,size:.3,speed:2.5}); scene.remove(o.m);
}

/* ================= 鏡頭 ================= */
let camMode='select', panelH=0;
const camPos=new THREE.Vector3(0,4,14), camLook=new THREE.Vector3(0,1.4,0);
function camTargets(){
  const asp=camera.aspect, k=THREE.MathUtils.clamp(.78/asp,1,1.85);
  if(camMode==='select'){ const z=CZ(0), far=heroes.length>5?1.2:1; return [new THREE.Vector3(0,(3.2+k*.9)*far,z+8.6*k*far),new THREE.Vector3(0,1.3,z-.5)]; }   // 六個人站一排，鏡頭拉遠一點才裝得下
  if(camMode==='dress'){ const z=CZ(0)+.5; return [new THREE.Vector3(0,2.2+k*.3,z+4.3*k),new THREE.Vector3(0,1.3,z)]; }
  if(camMode==='chase'){ const p=hero.pos; return [new THREE.Vector3(1.2,3.6+k*.4,p.z+6.4*k),new THREE.Vector3(0,1.6,p.z-5)]; }
  const hz=hero.pos.z, ez=currentEnemy?currentEnemy.pos.z:hz-5.5, mid=(hz+ez)/2;
  if(team) return [new THREE.Vector3(Math.min(5.6,3.3*k),4.6+k*1.5,hz+7.2*k),new THREE.Vector3(-.9,1.1,mid+.2)];   // 試煉模式：鏡頭拉遠、往左帶，四個人都看得到
  return [new THREE.Vector3(Math.min(6.4,3.9*k),3.6+k*1.3,hz+5.4*k),new THREE.Vector3(0,1.2,mid+.3)];
}
function resize(){
  const w=canvas.clientWidth,h=canvas.clientHeight; renderer.setSize(w,h,false);
  camera.aspect=w/h; camera.fov=w<h?56:46;
  const off=Math.min(panelH*.5,h*.3); camera.setViewOffset(w,h,0,off,w,h); camera.updateProjectionMatrix();
}
new ResizeObserver(()=>{panelH=panel.getBoundingClientRect().height;resize();}).observe(panel);
addEventListener('resize',resize);

/* ================= 主迴圈 ================= */
const clock=new THREE.Clock();
const reduce=matchMedia('(prefers-reduced-motion: reduce)').matches;
function loop(){
  const dt=Math.min(clock.getDelta(),.05), now=performance.now(), t=now/1000;
  for(const h of heroes) h.mixer.update(dt); for(const k in enemies) enemies[k].mixer.update(dt);
  for(let i=tweens.length-1;i>=0;i--){const w=tweens[i];const k=Math.min(1,(now-w.t0)/w.ms);w.fn(w.ease(k));if(k>=1){tweens.splice(i,1);w.r();}}
  for(let i=parts.length-1;i>=0;i--){const p=parts[i];const k=(now-p.t0)/p.life;if(k>=1){scene.remove(p.m);p.m.material.dispose();parts.splice(i,1);continue;}
    p.v.y-=9*dt;p.m.position.addScaledVector(p.v,dt);p.m.material.opacity=1-k;}
  rings.forEach((r,i)=>{if(!r.visible)return;r.rotation.z=t*.8;r.material.opacity=.55+.25*Math.sin(t*3+i);if(r.userData.rainbow)r.material.color.setHSL((t*.25+i*.2)%1,1,.65);});
  for(const f of flames){f.scale.setScalar(f.userData.base*(.85+.15*Math.sin(t*13+f.userData.ph)+.08*Math.sin(t*29+f.userData.ph)));}
  roomLight.intensity=34+4*Math.sin(t*7.3)+2*Math.sin(t*17);
  orbs.forEach((o,i)=>{ if(o.free) return; o.a+=dt*.5; const r=2.4; o.m.position.set(o.c.x+Math.cos(o.a)*r,o.c.y+.35*Math.sin(t*2+i),o.c.z+Math.sin(o.a)*r*.6); });
  if(camMode==='dress'&&hero) hero.root.rotation.y=DEV&&window.__rot!=null?window.__rot:Math.sin(t*.7)*2.6;   // 試穿：慢慢左右轉，正面背面都看得到
  if(hero){heroLight.position.set(hero.pos.x+1,hero.pos.y+3,hero.pos.z+2);sun.position.set(hero.pos.x+6,14,hero.pos.z+8);sun.target.position.copy(hero.pos);}
  const [tp,tl]=camTargets(); const s=1-Math.pow(.025,dt);
  camPos.lerp(tp,s); camLook.lerp(tl,s);
  camera.position.copy(camPos);
  if(shake>0&&!reduce){camera.position.x+=(Math.random()-.5)*shake;camera.position.y+=(Math.random()-.5)*shake;shake*=.86;if(shake<.01)shake=0;}
  camera.lookAt(camLook);
  renderer.render(scene,camera);
  requestAnimationFrame(loop);
}

/* ================= HUD ================= */
let hearts=5, maxHearts=5, ehp=0, ehpMax=0, combo=0, hitDmg=1, hitFast=false, charge=0, chargeMax=0, team=null, currentEnemy=null;
if(['localhost','127.0.0.1'].includes(location.hostname)) window.__state=()=>({hearts,maxHearts,ehp,ehpMax,combo,hitDmg,charge,chargeMax,team:team?team.turn:null,hero:heroDef.id,busy,save});
function hudStage(text){$('stageChip').innerHTML=text;}
function updateBars(){
  $('hearts').textContent=maxHearts>8?'❤ '+Math.max(0,hearts)+' / '+maxHearts:'❤'.repeat(Math.max(0,hearts))+'♡'.repeat(Math.max(0,maxHearts-hearts));   // 超過 8 顆排不下，改顯示數字
  $('enemyNum').textContent=ehp+'/'+ehpMax; $('enemyFill').style.width=(ehpMax?ehp/ehpMax*100:0)+'%';
  const pips=combo%3; const sp=$('spMeter');
  if(sp) sp.innerHTML=`必殺 <i class="${pips>=1?'on':''}"></i><i class="${pips>=2?'on':''}"></i><i></i>${shieldOn?'<span class="shield">🛡 護盾</span>':''}`;
  const cm=$('chargeMeter'); if(cm) cm.innerHTML=chargeMax?'蓄力 '+[...Array(chargeMax)].map((_,k)=>`<i class="${k<charge?'on':''}"></i>`).join(''):'';
  $('comboTag').textContent=team&&combo%6===5?'再答對一題發動四人合體技！':pips===2?(team?'再答對一題發動必殺技！':'再答對一題發動「'+nextMove(heroDef).name+'」！'):(combo>=2?combo+' COMBO!':'');
}
$('soundBtn').onclick=()=>{muted=!muted;$('soundBtn').textContent=muted?'🔇':'🔊';if(muted&&synth)synth.cancel();};
$('bookBtn').onclick=()=>openBook();
$('homeBtn').onclick=()=>{ SFX.tap(); goHome(); };

/* ================= 面板 ================= */
function setPanel(html){panel.innerHTML='<div class="sheet">'+html+'</div>';return panel.firstElementChild;}
function dialog(speaker,text,{enemy=false,btn='繼續'}={}){
  return new Promise(res=>{const el=setPanel(`<span class="speaker${enemy?' enemy':''}">${esc(speaker)}</span><div class="say">${text}</div><button class="cta" id="next">${btn} ▸</button>`);
    el.querySelector('#next').onclick=()=>{SFX.tap();res();};});
}
function choice(title,text,btns){
  return new Promise(res=>{const el=setPanel(`<span class="speaker">${esc(title)}</span><div class="say">${text}</div><div class="row">${btns.map((b,i)=>`<button class="${i===0?'cta ember':'ghost'}" data-i="${i}">${esc(b)}</button>`).join('')}</div>`);
    el.querySelectorAll('button').forEach(b=>b.onclick=()=>{SFX.tap();res(+b.dataset.i);});});
}

/* 單字表上的特殊寫法：glove(s)、play football / play soccer、give … a bath、face (clock)
   sayOf：要唸什麼（可用 say 欄位指定）；spellOf：要拼什麼（可用 sp 欄位指定，寫法太特殊就不出拼字題） */
const sayOf=w=>w.say||w.en.replace(/\(s\)/g,'s').replace(/\([^)]*\)/g,' ').replace(/\s*\/\s*/g,', ').replace(/…/g,' ').replace(/\s+/g,' ').trim();
function spellOf(w){ const s=w.sp||w.en; return /^[A-Za-z' -]+$/.test(s)?s:null; }
const islOf=w=>(w&&w._isl)||ISL;
const canHear=w=>!muted&&(!!audioKey(sayOf(w),islOf(w))||!!(synth&&enVoice));   // 沒有發音檔、裝置也沒有英文語音時不出聽力題

/* ================= 題目產生 =================
   範圍固定是這座島的單字和片語，但每次玩的題型、選項、缺的字母、抽到的句子都重新隨機。 */
// 干擾選項：同一關和別關的字混著抽，每次組合都不一樣
function distractors(w,n,field){
  const bad=new Set([w.en]); CONFLICT.forEach(g=>{if(g.includes(w.en)) g.forEach(x=>bad.add(x));});
  const ok=x=>!bad.has(x.en), mine=islOf(w), pick=f=>shuffle(WORDS.filter(x=>ok(x)&&f(x)));
  const same=pick(x=>x.d===w.d&&islOf(x)===mine), other=pick(x=>x.d!==w.d&&islOf(x)===mine), far=pick(x=>islOf(x)!==mine);   // far：複習考島才有，別週的字排最後
  const pool=[...shuffle([...same.slice(0,4),...other.slice(0,3)]),...same.slice(4),...other.slice(3),...far];
  const out=[]; for(const x of pool){ const v=x[field]; if(!out.includes(v)&&v!==w[field]) out.push(v); if(out.length>=n) break; } return out;
}
const LISTEN_TYPES=new Set(['listen','listen2zh','listenSpell']), SPELL_TYPES=new Set(['spell','blank','listenSpell']);
function wordTypes(w){
  const types=['en2zh','zh2en','tf'], sp=spellOf(w), nWords=sp?sp.split(' ').length:0, nLetters=sp?sp.replace(/ /g,'').length:0;
  const letters=sp&&nWords<=2&&nLetters<=14;   // 用字母拼：最多兩個字、14 個字母
  if(letters) types.push('spell','blank');
  if(sp&&nWords>=2) types.push('arrange');     // 兩個字以上的片語：把字排出來
  if(canHear(w)){ types.push('listen','listen2zh'); if(letters) types.push('listenSpell'); }
  if(w.img) types.push('pic');
  if(w.opp&&WORDS.filter(x=>x.opp&&x.en!==w.en&&x.en!==w.opp).length>=2) types.push('opp');   // 其他相反詞不夠當選項時就不出這種題
  return types;
}
// used：這一關各題型已經出過幾次。優先挑還沒出過的題型，一關裡的題型才會分散；avoid：答錯重考時換一種題型
function makeQ(w,avoid,used={},prefer){   // prefer：錯題洞窟用，這個字最常錯的題型，六成機率直接出這一型
  let types=wordTypes(w); if(types.length>1&&avoid) types=types.filter(x=>x!==avoid);
  const least=Math.min(...types.map(x=>used[x]||0));
  // 有照片的字，三次裡大約一次直接出看圖題（照片是最直覺的記法），其餘照「最少出過的題型」輪
  const type=prefer&&types.includes(prefer)&&Math.random()<.6?prefer:types.includes('pic')&&Math.random()<.35?'pic':shuffle(types.filter(x=>(used[x]||0)===least))[0];
  used[type]=(used[type]||0)+1;
  const mcEn=label=>({type,label,w,opts:shuffle([w.en,...distractors(w,3,'en')]),a:w.en,en:1});
  const mcZh=label=>({type,label,w,opts:shuffle([w.zh,...distractors(w,3,'zh')]),a:w.zh});
  if(type==='en2zh') return mcZh('看英文 → 選中文');
  if(type==='listen2zh') return mcZh('聽聲音 → 選中文');
  if(type==='zh2en') return mcEn('看中文 → 選英文');
  if(type==='pic') return mcEn('看圖 → 選單字');
  if(type==='listen') return mcEn('聽聲音 → 選單字');
  if(type==='tf'){ const wrong=distractors(w,1,'zh')[0], truth=!wrong||Math.random()<.5;
    return {type,label:'是非題：意思對不對？',w,shown:truth?w.zh:wrong,opts:['⭕ 對','❌ 不對'],a:truth?'⭕ 對':'❌ 不對'}; }
  if(type==='opp'){ const pool=shuffle(WORDS.filter(x=>x.opp&&x.en!==w.en&&x.en!==w.opp).map(x=>x.en)).slice(0,3);
    return {type,label:'找出相反詞 ↔',w,opts:shuffle([w.opp,...pool]),a:w.opp,en:1}; }
  if(type==='arrange'){ const words=spellOf(w).split(' '), mine=new Set(words.map(x=>x.toLowerCase()));
    // 混兩個別的片語裡的字進來當干擾
    const toks=f=>[...new Set(WORDS.map(spellOf).filter(s=>s&&f(s)).flatMap(s=>s.split(' ')).filter(x=>!mine.has(x.toLowerCase())))];
    let bank=toks(s=>s.includes(' ')); if(bank.length<2) bank=toks(()=>true);   // 島上多字詞太少時，改拿一般單字當干擾
    return {type,label:'排出片語',w,words,tiles:[...words,...shuffle(bank).slice(0,2)]}; }
  if(type==='blank') return {type,label:'補上缺的字母',w};
  if(type==='listenSpell') return {type,label:'聽聲音 → 拼出單字',w};
  return {type:'spell',label:'拼出單字',w};
}

/* 片語題：除了島上自己寫的 bossQ，也從 phrases 自動變出好幾種問法 */
const canHearText=(list,isl)=>list.filter(s=>!muted&&(!!audioKey(s,isl||ISL)||!!(synth&&enVoice)));
const PH_SKIP=new Set(["one's",'sb.','sth.','…','the','a','an','be','is','to','+','ving']);
// get first (second) place → get first place：括號裡的替換字不算在片語裡
const phTokens=p=>p.en.replace(/\([^)]*\)/g,' ').replace(/…/g,' ').split(/\s+/).filter(Boolean);
const phKeys=p=>phTokens(p).filter(x=>!PH_SKIP.has(x.toLowerCase())).map(x=>x.toLowerCase());
// 例句拆成一句一句：Mr. / O.K. 不當句尾，對話開頭的人名（Polly:、A:）拿掉，只留真的有用到這句片語的句子。
// 片語資料有寫 sents 就直接用。
function phSentences(p,maxWords=18){
  if(p.sents) return p.sents.filter(x=>x.split(' ').length<=maxWords);
  const keys=phKeys(p), need=Math.max(1,Math.ceil(keys.length/2));
  return (p.ex||'').replace(/\b(Mr|Mrs|Ms|Dr|O\.K|a\.m|p\.m)\./g,'$1\u0001').replace(/(^|[.!?]\s+)[A-Z][A-Za-z]*:\s*/g,'$1').split(/(?<=[.!?])\s+/)
    .map(x=>x.replace(/\u0001/g,'.').trim()).filter(x=>{ const n=x.split(' ').length, low=x.toLowerCase();
      return n>=4&&n<=maxWords&&keys.filter(k=>low.includes(k)).length>=need; });
}
function phraseVariants(k){
  const p=PHRASES[k], isl=islOf(p), clean=phTokens(p).join(' '), out=[];
  // 干擾選項：別句片語，再加上放在單字裡的片語（pos 是 ph.）
  const seenEn=new Set([p.en]), others=[...PHRASES.filter((_,j)=>j!==k),...WORDS.filter(w=>w.pos==='ph.')].filter(x=>!seenEn.has(x.en)&&seenEn.add(x.en)&&x.zh!==p.zh);
  const base={p:k,review:p.en,sayAfter:clean,isl};
  const three=f=>shuffle(others).slice(0,3).map(x=>x[f]);
  if(others.length>=2){
    out.push({...base,kind:'mc',label:'片語意思',prompt:p.en,say:clean,opts:shuffle([p.zh,...three('zh')]),a:p.zh,hint:`${p.en} ＝ ${p.zh}`});
    out.push({...base,kind:'mc',label:'看中文 → 選片語',pz:1,oen:1,prompt:p.zh,opts:shuffle([p.en,...three('en')]),a:p.en,hint:`${p.en} ＝ ${p.zh}`});
    for(const s of canHearText(shuffle(phSentences(p)).slice(0,1),isl))
      out.push({...base,kind:'mc',label:'聽句子 → 用了哪個片語？',listen:1,oen:1,prompt:p.en,say:s,opts:shuffle([p.en,...three('en')]),a:p.en,hint:`句子是：${s}`});
  }
  // 片語填空：挖掉片語裡的一個字，干擾選項用別句片語的字
  const toks=phTokens(p), keys=toks.map((x,i)=>i).filter(i=>!PH_SKIP.has(toks[i].toLowerCase()));
  const mine=new Set(toks.map(x=>x.toLowerCase())), bank=[...new Set(others.flatMap(o=>phTokens(o)).filter(x=>/^[A-Za-z']+$/.test(x)&&!PH_SKIP.has(x.toLowerCase())&&!mine.has(x.toLowerCase())))];
  if(keys.length&&bank.length>=2){ const i=shuffle(keys)[0];
    out.push({...base,kind:'mc',label:'片語填空',en:1,quiet:1,prompt:toks.map((x,j)=>j===i?'___':x).join(' ')+'\n（'+p.zh+'）',opts:shuffle([toks[i],...shuffle(bank).slice(0,3)]),a:toks[i],hint:`${p.en} ＝ ${p.zh}`}); }
  // 聽句子排順序（太長的句子不排，最多 10 個字）
  for(const s of canHearText(shuffle(phSentences(p,10)).slice(0,1),isl))
    out.push({...base,kind:'order',label:'聽句子 → 排出來',words:s.split(' '),zh:'用到的片語：'+p.zh,say:s,listen:1});
  return out;
}
// 抽 n 題片語題：每句片語先各抽一題，再從剩下的補滿；同一句片語不會重複同一種問法
function pickPhraseQs(n,idxs){   // idxs：只從這幾句片語出（複習考的某一關只考某一週時用）
  const all=!idxs; idxs=idxs||PHRASES.map((_,k)=>k);
  const hand=BOSS_Q.map(q=>q.opts?{...q,opts:shuffle(q.opts)}:{...q});
  const byP=idxs.map(k=>shuffle([...hand.filter(q=>q.p===k),...phraseVariants(k)]));
  const rest=all?shuffle(hand.filter(q=>q.p==null||!PHRASES[q.p])):[], picked=[], sig=q=>(q.p??'x')+'|'+q.label+'|'+(q.prompt||q.zh||'');
  const take=q=>{ if(picked.length<n&&q&&!picked.some(x=>sig(x)===sig(q))) picked.push(q); };
  for(const list of shuffle(byP)) take(list.shift());
  const pool=shuffle([...byP.flat(),...rest]); for(const q of pool) take(q);
  return picked;
}

// 片語題答錯要重考時，同一句片語換一種問法（沒有別種問法就把選項重新洗牌）
function altPhraseQ(q){
  const fresh={...q}; delete fresh._sh; if(fresh.opts) fresh.opts=shuffle(fresh.opts);
  if(q.p==null||!PHRASES[q.p]) return fresh;
  const alts=[...BOSS_Q.filter(x=>x.p===q.p).map(x=>x.opts?{...x,opts:shuffle(x.opts)}:{...x}),...phraseVariants(q.p)].filter(x=>x.label!==q.label);
  return shuffle(alts)[0]||fresh;
}

const pic=(w,big)=>w.img?`<img class="photo${big?' big':''}" src="${islOf(w).base}img/${w.img}.webp" alt="">`:`<span class="emo"${big?' style="font-size:72px"':''}>${w.e}</span>`;
const DEV=['localhost','127.0.0.1'].includes(location.hostname);
if(DEV) window.__gen={enemy:async name=>{ await ensureEnemy(name); const e=enemyOf(name), old=currentEnemy; if(old&&old!==e){ e.pos.copy(old.pos); e.root.scale.copy(old.root.scale); e.root.rotation.y=0; old.root.visible=false; } e.root.visible=true; currentEnemy=e; e.play(e.idle); return Object.keys(e.clips).join(','); },eplay:(n,o)=>currentEnemy.play(n,o||{once:true}),arrow:ms=>arrowFly(bowTip(hero),currentEnemy.pos.clone().add(new THREE.Vector3(0,1.4,0)),{ms}),attack:()=>{hitDmg=1;return heroAttack();},coins:n=>{save.earned=(save.spent|0)+n;persist();},wear:(k,w)=>applyWear(k,{...wearOf(k),...w}),wearOf:k=>wearOf(k),vis:k=>[...Object.entries(heroes[k].gear).filter(x=>x[1].visible).map(x=>x[0]),...Object.values(heroes[k].borrow).filter(Boolean).map(o=>'+'+o.name),heroes[k].mat.map===heroes[k].map0?'原色':'染色'].join(','),ITEMS,setLv:(id,lv)=>{save.lv[id]=lv;heroes.forEach((_,k)=>applyLevelLook(k));if(atHome){placeSelectLineup();hero=heroes[save.hero];hero.pos.z=CZ(0)+.5;renderHome();}},setAll:lv=>{HEROES.forEach(h=>{save.lv[h.id]=lv;});heroes.forEach((_,k)=>applyLevelLook(k));if(atHome){placeSelectLineup();hero=heroes[save.hero];hero.pos.z=CZ(0)+.5;renderHome();}},special:async i=>{const m=heroDef.moves[i];hitDmg=m.dmg;await heroSpecial(m);},levelUp:()=>levelUp(),missItems:()=>missItems(),missEntries:()=>missEntries(),ask:(q,c)=>ask(q,c),use:id=>useIsland(id),wordTypes,sayOf,spellOf,makeQ,pickPhraseQs,phraseVariants,phSentences,get PHRASES(){return PHRASES},get WORDS(){return WORDS}};
const SPK=(huge,label='唸出來')=>`<button class="speak${huge?' huge':''}" id="spk" aria-label="${label}">🔊</button>`;
let lastFast=false;   // 上一題是不是在時間條跑完前答對（試煉模式的快答加成）
function ask(q,count,fastMs=0){
  if(DEV) window.__q=q;
  return new Promise(res=>{
    const w=q.w, A=q.isl||islOf(w); let html=`<div class="qhead"><span class="qtype">${esc(q.label)}</span><span class="qcount">${count}</span></div>`;
    if(fastMs) html+=`<div class="fastbar" aria-hidden="true"><span>⚡ 快答加成</span><b><i style="animation-duration:${fastMs}ms"></i></b></div>`;
    if(q.kind==='mc'){
      const body=q.listen?'':q.pz?`<div class="big-zh">${esc(q.prompt)}</div>`:q.en?`<div class="sent">${esc(q.prompt)}</div>`:`<div class="big-en">${esc(q.prompt)}</div>`;
      html+=`<div class="prompt">${body}${q.quiet||q.pz||!q.say?'':SPK(q.listen,q.listen?'再聽一次':'唸出來')}</div>`;
    } else if(q.kind==='order') html+=`<div class="prompt"><div class="big-zh">${esc(q.zh)}</div>${q.say?SPK(0,'再聽一次'):''}</div>`;
    else if(q.type==='en2zh') html+=`<div class="prompt"><div class="big-en">${esc(w.en)}</div><span class="pos">${w.pos}</span>${SPK()}</div>`;
    else if(q.type==='zh2en') html+=`<div class="prompt">${pic(w)}<div class="big-zh">${esc(w.zh)}</div><span class="pos">${w.pos}</span></div>`;
    else if(q.type==='pic') html+=`<div class="prompt">${pic(w,1)}</div>`;
    else if(LISTEN_TYPES.has(q.type)) html+=`<div class="prompt">${SPK(1,'再聽一次')}</div>`;
    else if(q.type==='tf') html+=`<div class="prompt"><div class="big-en">${esc(w.en)}</div><span class="big-en" style="color:var(--edge)">＝</span><div class="big-zh">${esc(q.shown)}</div><span class="big-en" style="color:var(--edge)">？</span>${SPK()}</div>`;
    else if(q.type==='opp') html+=`<div class="prompt"><span class="emo">${w.e}</span><div class="big-en">${esc(w.en)}</div><span class="big-en" style="color:var(--edge)">↔ ?</span></div>`;
    else html+=`<div class="prompt">${pic(w)}<div class="big-zh">${esc(w.zh)}</div>${SPK()}</div>`;   // spell、blank、arrange

    const spellMode=SPELL_TYPES.has(q.type), orderMode=q.kind==='order'||q.type==='arrange';
    const target=spellMode?spellOf(w):'', T=orderMode?(q.tiles||q.words):[];
    if(spellMode){
      // blank：隨機留一半左右的字母當提示，另外混兩個不在單字裡的字母；其他拼字題全部自己拼
      const chars=target.split(''), idxs=chars.map((c,i)=>c===' '?-1:i).filter(i=>i>=0);
      const hide=q.type==='blank'?shuffle(idxs).slice(0,Math.max(1,Math.min(idxs.length-1,Math.round(idxs.length*.45)))):idxs, hs=new Set(hide);
      const pool=idxs.filter(i=>hs.has(i)).map(i=>chars[i]);
      if(q.type==='blank') pool.push(...shuffle('abcdefghijklmnopqrstuvwxyz'.split('').filter(c=>!target.toLowerCase().includes(c))).slice(0,2));
      let sh=shuffle(pool); if(new Set(pool).size>1) while(sh.join('')===pool.join('')) sh=shuffle(pool);
      // 一個字包成一組，兩個字的單字（guinea pig）換行時不會從字中間斷開
      const slot=(c,i)=>hs.has(i)?'<span class="slot" data-s></span>':`<span class="slot fixed" data-s data-t="fixed">${esc(c)}</span>`;
      const longest=Math.max(...target.split(' ').map(x=>x.length));   // 最長的那個字決定格子大小，盡量一個字排一行
      html+=`<div class="slots${longest>=10?' xlong':longest>=8?' long':''}" id="slots"><span class="sw">${chars.map((c,i)=>c===' '?'</span><span class="sw">':slot(c,i)).join('')}</span></div>
      <div class="tiles" id="tiles">${sh.map((c,i)=>`<button class="tile" data-i="${i}">${c}</button>`).join('')}</div>`;
      q._sh=sh;
    } else if(orderMode){ let sh=shuffle(T.map((x,i)=>i)); if(T.length>1) while(sh.every((x,i)=>x===i)) sh=shuffle(sh); q._sh=sh;
      html+=`<div class="sentence" id="sent"></div><div class="tiles" id="tiles">${sh.map(i=>`<button class="wtile" data-i="${i}">${esc(T[i])}</button>`).join('')}</div>
      <div class="row"><button class="ghost" id="clr">清除重排</button><button class="cta" id="chk" disabled>確定</button></div>`;
    } else html+=`<div class="opts${q.opts.length===2?' two':''}">${q.opts.map(o=>`<button class="opt${q.en||q.oen?' en':''}${o.length>18?' long':''}">${esc(o)}</button>`).join('')}</div>`;
    html+=`<div id="fb"></div>`;
    const el=setPanel(html);
    const sayText=q.say||(w?sayOf(w):'');
    const spk=el.querySelector('#spk'); if(spk) spk.onclick=()=>say(sayText,A);
    const t0=performance.now();
    if(LISTEN_TYPES.has(q.type)||q.listen||(q.kind==='mc'&&q.en&&!q.quiet)) setTimeout(()=>say(sayText,A),250);

    let locked=false;
    const finish=(ok)=>{ if(locked) return; locked=true;
      lastFast=!!(ok&&fastMs&&performance.now()-t0<=fastMs); const bar=el.querySelector('.fastbar'); if(bar) bar.classList.add(lastFast?'hit':'stop');
      const fb=el.querySelector('#fb');
      const aw=(q.type==='opp')?byEn[q.a]:w;
      const ans=aw?`<span class="en">${aw.e} ${esc(aw.en)}</span> <small>${aw.pos}</small>　${esc(aw.zh)}`:(q.kind==='order'?`<span class="en">${esc(q.words.join(' '))}</span>`:`<span class="en">${esc(q.a)}</span>`);
      if(ok){ SFX.ok(); fb.innerHTML=`<div class="feedback ok">${lastFast?'⚡ 神速！':'答對了！'}${ans}</div>`; say(aw?sayOf(aw):(q.sayAfter||q.say||q.words?.join(' ')||q.a),aw?islOf(aw):A); setTimeout(()=>res(true),1050); }
      else { SFX.no(); const hint=q.hint?`<br>${esc(q.hint)}`:''; fb.innerHTML=`<div class="feedback no">正確答案是：${ans}${hint}</div><button class="cta" id="go" style="margin-top:8px">記住了，繼續 ▸</button>`;
        say(aw?sayOf(aw):(q.sayAfter||q.say||(q.words||[]).join(' ')),aw?islOf(aw):A);
        fb.querySelector('#go').onclick=()=>{SFX.tap();res(false);}; fb.scrollIntoView({block:'nearest'}); }
    };
    if(spellMode){
      const slots=[...el.querySelectorAll('[data-s]')], filled=[];
      el.querySelectorAll('.tile').forEach(b=>b.onclick=()=>{ if(locked||b.classList.contains('used')) return; SFX.tap();
        const idx=slots.findIndex(s=>!s.dataset.t); if(idx<0) return; slots[idx].textContent=b.textContent; slots[idx].dataset.t=b.dataset.i; b.classList.add('used');
        if(slots.every(s=>s.dataset.t)){ const word=slots.map(s=>s.textContent).join(''); const ok=word===target.replace(/ /g,''); el.querySelector('#slots').classList.add(ok?'ok':'no'); finish(ok); }});
      slots.forEach(s=>s.onclick=()=>{ if(locked||!s.dataset.t||s.dataset.t==='fixed') return; const t=el.querySelector(`.tile[data-i="${s.dataset.t}"]`); t.classList.remove('used'); s.textContent=''; delete s.dataset.t; });
    } else if(orderMode){
      const sent=el.querySelector('#sent'), chk=el.querySelector('#chk'); const placed=[];
      const render=()=>{ sent.innerHTML=placed.map((i,p)=>`<button class="wtile" data-p="${p}">${esc(T[i])}</button>`).join(''); chk.disabled=placed.length!==q.words.length;
        sent.querySelectorAll('button').forEach(b=>b.onclick=()=>{ if(locked) return; const i=placed.splice(+b.dataset.p,1)[0]; el.querySelector(`#tiles [data-i="${i}"]`).classList.remove('used'); render(); }); };
      el.querySelectorAll('#tiles .wtile').forEach(b=>b.onclick=()=>{ if(locked||b.classList.contains('used')||placed.length>=q.words.length) return; SFX.tap(); placed.push(+b.dataset.i); b.classList.add('used'); render(); });
      el.querySelector('#clr').onclick=()=>{ if(locked) return; placed.length=0; el.querySelectorAll('#tiles .wtile').forEach(b=>b.classList.remove('used')); render(); };
      chk.onclick=()=>{ if(locked) return; const ok=placed.map(i=>T[i]).join(' ')===q.words.join(' '); sent.style.borderColor=ok?'var(--moss)':'var(--blood)'; finish(ok); };
    } else {
      el.querySelectorAll('.opt').forEach(b=>b.onclick=()=>{ if(locked) return; const ok=b.textContent===q.a;
        el.querySelectorAll('.opt').forEach(x=>{x.disabled=true; if(x.textContent===q.a) x.classList.add('ok');}); if(!ok) b.classList.add('no'); finish(ok); });
    }
  });
}

/* ================= 戰鬥演出 ================= */
const ENEMY_OFF=5.6;
function heroSpot(i){return new THREE.Vector3(0,0,CZ(i)+2.8);}
function enemySpot(i){return new THREE.Vector3(0,0,CZ(i)+2.8-ENEMY_OFF-(STAGES[i-1]?.boss?.6:0));}
async function heroAttack(){
  const e=currentEnemy, h=hero, z0=h.pos.z;
  const chest=e.pos.clone().add(new THREE.Vector3(0,1.4*e.root.scale.y,0));
  if(heroDef.arrow){
    h.play(heroDef.attack,{once:true,ts:1.25}); bowDraw(h,400); await sleep(420); twang();
    await arrowFly(bowTip(h),chest,{ms:170}); burst(chest,{n:20,speed:5}); impact(chest); await sleep(240); h.play('Idle');
  } else if(heroDef.ranged){
    h.play(heroDef.attack,{once:true,ts:1.15}); await sleep(520); SFX.magic();
    const orb=new THREE.Sprite(new THREE.SpriteMaterial({map:MAGIC_TEX,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true})); orb.scale.setScalar(1.1); scene.add(orb);
    const from=h.pos.clone().add(new THREE.Vector3(.3,1.8,-.6));
    await tween(330,k=>{orb.position.lerpVectors(from,chest,k);orb.scale.setScalar(1+Math.sin(k*20)*.2);if(Math.random()<.5)burst(orb.position,{n:1,tex:MAGIC_TEX,speed:.6,size:.25,life:300});},k=>k);
    scene.remove(orb); burst(chest,{n:22,tex:MAGIC_TEX,color:0xffffff,speed:5}); impact(chest);
  } else {
    const zt=e.pos.z+1.9;
    const atk=h.play(heroDef.attack,{once:true,ts:1.2});
    await tween(260,k=>{h.pos.z=z0+(zt-z0)*k;});
    await sleep(heroDef.id==='Barbarian'?260:170); impact(chest); burst(chest,{n:20,speed:5});
    await atk; h.play('Idle'); await tween(320,k=>{h.pos.z=zt+(z0-zt)*k;});
  }
}
/* 弓箭：箭是模型裡附的那一支，要射的時候複製一份出來飛 */
let arrowProto=null;
const twang=()=>{ tone(520,.09,'triangle',.09,0,-260); noise(.05,.05); };
const bowTip=h=>h.pos.clone().add(new THREE.Vector3(.15,1.45*h.root.scale.y,-.8));
function arrowFly(from,to,{ms=200,glow=0,size=1.4}={}){ if(!arrowProto) return Promise.resolve();
  const a=arrowProto.clone(); a.visible=true; a.scale.setScalar(size); a.position.copy(from); a.lookAt(to); scene.add(a);
  const g=glow?spSprite(SPARK_TEX,glow,1.3):null;
  return tween(ms,q=>{ a.position.lerpVectors(from,to,q); if(g) g.position.copy(a.position); },q=>q).then(()=>{ scene.remove(a); if(g){ scene.remove(g); g.material.dispose(); } }); }
// 拉弓：弓的模型有一個「拉弦」的變形，拉滿再放掉
function bowDraw(h,ms){ const b=h.gear&&h.gear.Bow; if(!b||!b.visible||!b.morphTargetInfluences) return;
  tween(ms,q=>{b.morphTargetInfluences[0]=q;}).then(()=>tween(80,q=>{b.morphTargetInfluences[0]=1-q;})); }
function banner(title,sub,color){const old=$('special');if(old)old.remove();const d=document.createElement('div');d.id='special';const c='#'+color.toString(16).padStart(6,'0');d.style.setProperty('--sp',c);d.innerHTML=`✦ ${esc(title)} ✦<small>${esc(sub)}</small>`;document.body.appendChild(d);setTimeout(()=>d.remove(),1600);
  const f=$('spFlash');f.style.background=`radial-gradient(circle at 50% 40%, ${c}88, transparent 70%)`;f.style.transition='none';f.style.opacity=1;requestAnimationFrame(()=>{f.style.transition='opacity .9s';f.style.opacity=0;});}
function spSprite(tex,color,size){const m=new THREE.Sprite(new THREE.SpriteMaterial({map:tex,color,blending:THREE.AdditiveBlending,depthWrite:false,transparent:true}));m.scale.setScalar(size);scene.add(m);return m;}
function bigHit(at,label='必殺！',color=heroDef.spColor){SFX.hit();noise(.4,.25);tone(90,.5,'sawtooth',.1,0,-40);shake=.9;currentEnemy.play('Hit_A',{once:true,ts:1});floater(label+' −'+hitDmg,at);burst(at,{n:40,color,speed:7,size:.5,life:900});}
/* 招式特效的積木：光環、光柱、光球、刀光、閃電、飛行物。每一招都用這幾樣拼出來 */
const fxMat=(color,opacity)=>new THREE.MeshBasicMaterial({color,transparent:true,opacity,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
const fxDone=m=>{scene.remove(m);m.geometry.dispose();m.material.dispose();};
const V3=(x,y,z)=>new THREE.Vector3(x,y,z);
function fxRing(at,color,{to=6,ms=650,w=.4}={}){const m=new THREE.Mesh(new THREE.RingGeometry(.5,.5+w,40),fxMat(color,.9));m.rotation.x=-Math.PI/2;m.position.set(at.x,.08,at.z);scene.add(m);
  const o0=to>7?.5:.9;   // 很大的光環淡一點
  return tween(ms,q=>{m.scale.setScalar(1+q*(to-1));m.material.opacity=o0*(1-q);}).then(()=>fxDone(m));}
function fxPillar(at,color,{r=.9,h=10,ms=700,grow=.6,op=.75}={}){if(r>1.2)op*=.6;const m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,h,24,1,true),fxMat(color,op));m.position.set(at.x,h/2,at.z);scene.add(m);
  return tween(ms,q=>{m.scale.set(1+q*grow,1,1+q*grow);m.material.opacity=op*(1-q);}).then(()=>fxDone(m));}
function fxOrb(at,color,{to=3,ms=500,op=.7}={}){if(to>4)op*=.55;const m=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),fxMat(color,op));m.position.copy(at);m.scale.setScalar(.2);scene.add(m);
  return tween(ms,q=>{m.scale.setScalar(.2+q*to);m.material.opacity=op*(1-q*q);}).then(()=>fxDone(m));}
// 刀光：一道面向鏡頭的細長光，rot 是傾斜角度
function fxSlash(at,color,rot,{len=3.6,ms=240}={}){const m=new THREE.Mesh(new THREE.PlaneGeometry(len,.26),fxMat(color,1));m.position.copy(at);m.quaternion.copy(camera.quaternion);m.rotateZ(rot);scene.add(m);
  return tween(ms,q=>{m.scale.set(.15+q*1.05,1+(1-q)*1.6,1);m.material.opacity=1-q*q;}).then(()=>fxDone(m));}
// 閃電：從天上打下來的細光柱，閃兩下
function fxBolt(at,color){const m=new THREE.Mesh(new THREE.CylinderGeometry(.16,.06,12,6,1,true),fxMat(color,1));m.position.set(at.x+(Math.random()-.5)*.4,6,at.z);m.rotation.z=(Math.random()-.5)*.2;scene.add(m);
  return tween(260,q=>{m.material.opacity=(q<.3||(q>.5&&q<.75))?1:.25;m.scale.x=m.scale.z=1+Math.random()*.8;},q=>q).then(()=>fxDone(m));}
function fxBeam(from,to,color,{r=.2,ms=380}={}){const d=to.clone().sub(from),m=new THREE.Mesh(new THREE.CylinderGeometry(r,r,d.length(),10,1,true),fxMat(color,1));m.position.copy(from).addScaledVector(d,.5);m.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),d.clone().normalize());scene.add(m);
  return tween(ms,q=>{m.scale.set(1+q*2.5,1,1+q*2.5);m.material.opacity=1-q;}).then(()=>fxDone(m));}
function fxFly(tex,color,from,to,{ms=300,size=.9,arc=0,side=0}={}){const m=spSprite(tex,color,size);
  return tween(ms,q=>{m.position.lerpVectors(from,to,q);m.position.y+=Math.sin(q*Math.PI)*arc;m.position.x+=Math.sin(q*Math.PI)*side;},q=>q).then(()=>{scene.remove(m);m.material.dispose();});}
// 招式中間的小段傷害演出（真正扣血的是最後那一下 bigHit）
function tick(at,color,{n=14,sh=.4}={}){SFX.hit();shake=sh;currentEnemy.play('Hit_A',{once:true,ts:1.5});burst(at,{n,color,speed:5,size:.35});}

/* 每位勇者的招式演出，順序跟 HEROES 的 moves 一樣（第 1 招、Lv10、Lv20、Lv30）。
   參數：e 怪物、h 勇者、z0 勇者原本站的位置、zt 貼到怪物面前的位置、col 招式顏色、chest 怪物胸口 */
const SPECIALS={
 Knight:[
  // 聖光斬：跳劈＋一道光柱
  async({e,h,z0,zt,col,chest})=>{ h.play('1H_Melee_Attack_Chop',{once:true,ts:1});
    await tween(240,q=>{h.pos.z=z0+(zt-z0)*q;h.pos.y=Math.sin(q*Math.PI)*1.2;});
    fxPillar(e.pos,col); bigHit(chest,'必殺！',col); await sleep(700);
    h.play('Idle'); await tween(300,q=>{h.pos.z=zt+(z0-zt)*q;}); },
  // 十字聖劍：衝上去左右各砍一刀，兩道光交叉成十字
  async({e,h,z0,zt,col,chest})=>{ await tween(200,q=>{h.pos.z=z0+(zt-z0)*q;});
    for(const r of [Math.PI/4,-Math.PI/4]){ h.play('1H_Melee_Attack_Chop',{once:true,ts:1.9}); await sleep(170); fxSlash(chest,col,r); tick(chest,col); await sleep(210); }
    fxSlash(chest,0xffffff,Math.PI/4,{len:5.2,ms:420}); fxSlash(chest,0xffffff,-Math.PI/4,{len:5.2,ms:420}); fxRing(e.pos,col,{to:5}); bigHit(chest,'必殺！',col); await sleep(450);
    h.play('Idle'); await tween(300,q=>{h.pos.z=zt+(z0-zt)*q;}); },
  // 聖劍光雨：舉劍召喚，六道光劍從天上插下來圍住怪物
  async({e,h,col,chest})=>{ h.play('Spellcast_Shoot',{once:true,ts:.9}); await sleep(350);
    for(let k=0;k<6;k++){ const a=k/6*Math.PI*2, at=V3(e.pos.x+Math.cos(a)*1.3,0,e.pos.z+Math.sin(a)); fxPillar(at,col,{r:.16,h:9,ms:420,grow:1.5,op:1});
      burst(V3(at.x,.3,at.z),{n:8,color:col,speed:3,size:.3}); tone(880+k*90,.12,'triangle',.07); if(k%2) tick(chest,col,{n:8,sh:.3}); await sleep(120); }
    await sleep(150); fxPillar(e.pos,0xffffff,{r:.7,h:12,ms:800,grow:1.2}); fxRing(e.pos,col,{to:6}); bigHit(chest,'必殺！',col); await sleep(600); },
  // 王者審判：高高跳起，金色巨柱從天而降，三圈光環往外炸
  async({e,h,z0,zt,col,chest})=>{ h.play('2H_Melee_Attack_Spin',{once:true,ts:.9});
    await tween(420,q=>{h.pos.z=z0+(zt-z0)*q;h.pos.y=Math.sin(q*Math.PI*.5)*3.2;},q=>q);
    fxPillar(e.pos,col,{r:1.5,h:14,ms:1100,grow:.9,op:.85}); await sleep(120);
    await tween(160,q=>{h.pos.y=3.2*(1-q);},q=>q*q); h.play('1H_Melee_Attack_Chop',{once:true,ts:1.4});
    bigHit(chest,'必殺！',col); fxOrb(chest,0xffffff,{to:3.5,ms:500});
    for(let k=0;k<3;k++){ fxRing(e.pos,k%2?0xffffff:col,{to:7+k*2,ms:700,w:.5}); shake=.8; noise(.25,.2); await sleep(170); }
    await sleep(350); h.play('Idle'); await tween(320,q=>{h.pos.z=zt+(z0-zt)*q;}); },
  // 聖盾衝擊（Lv40）：舉起一面六角形的光盾，整個人撞上去
  async({e,h,z0,zt,col,chest})=>{ const sh=new THREE.Mesh(new THREE.CircleGeometry(1.5,6),fxMat(col,.5)); sh.position.copy(h.pos).add(V3(0,1.3,-1)); scene.add(sh);
    h.play('1H_Melee_Attack_Chop',{once:true,ts:.8}); tone(220,.5,'sawtooth',.08,0,500);
    await tween(350,q=>{ sh.scale.setScalar(.3+q*.9); sh.material.opacity=.4+.4*q; });
    await tween(190,q=>{ h.pos.z=z0+(zt-z0)*q; sh.position.z=h.pos.z-1; },q=>q*q); fxDone(sh);
    fxOrb(chest,0xffffff,{to:3.4,ms:450,op:.9}); noise(.5,.3); bigHit(chest,'必殺！',col);
    for(let k=0;k<3;k++){ fxRing(e.pos,k%2?0xffffff:col,{to:6+k*2.5,ms:650,w:.6}); shake=.9; await sleep(140); }
    await sleep(320); h.play('Idle'); await tween(300,q=>{h.pos.z=zt+(z0-zt)*q;}); },
  // 天使降臨（Lv50）：背後展開光之翼飛起來，八道光柱圍住怪物，最後一劍劈下
  async({e,h,z0,zt,col,chest})=>{ h.play('Cheer',{once:true,ts:1.4});
    for(let k=0;k<3;k++) for(const d of [-1,1]) fxSlash(h.pos.clone().add(V3(d*(.9+k*.45),2+k*.35,.2)),k?col:0xffffff,d*(.5+k*.25),{len:2.4,ms:900});
    tone(523,.9,'sine',.07,0,520); await tween(500,q=>{h.pos.y=q*2.6;},q=>q);
    for(let k=0;k<8;k++){ const a=k/8*Math.PI*2, at=V3(e.pos.x+Math.cos(a)*1.6,0,e.pos.z+Math.sin(a)*1.2); fxPillar(at,k%2?0xffffff:col,{r:.2,h:11,ms:450,grow:1.6,op:1}); tone(880+k*70,.1,'triangle',.06); if(k%2) tick(chest,col,{n:8,sh:.3}); await sleep(80); }
    h.play('1H_Melee_Attack_Chop',{once:true,ts:1.2}); await tween(200,q=>{h.pos.y=2.6*(1-q);h.pos.z=z0+(zt-z0)*q;},q=>q*q);
    fxSlash(chest,0xffffff,Math.PI/2,{len:7,ms:520}); fxSlash(chest,col,0,{len:7,ms:520}); fxPillar(e.pos,col,{r:1.7,h:15,ms:1100,grow:1,op:.9}); fxOrb(chest,0xffffff,{to:5,ms:650,op:.95}); noise(.6,.35); bigHit(chest,'必殺！',col);
    for(let k=0;k<4;k++){ fxRing(e.pos,k%2?0xffffff:col,{to:7+k*2.5,ms:750,w:.6}); shake=1; await sleep(140); }
    await sleep(350); h.play('Idle'); await tween(320,q=>{h.pos.z=zt+(z0-zt)*q;}); },
 ],
 Mage:[
  // 流星火雨：七顆流星從天上砸下來
  async({h,col,chest})=>{ h.play('Spellcast_Shoot',{once:true}); await sleep(350);
    for(let k=0;k<7;k++){ const m=spSprite(MAGIC_TEX,col,1.3); const to=chest.clone().add(V3((Math.random()-.5)*2.2,-.6+Math.random(),(Math.random()-.5)*1.6)); const from=to.clone().add(V3(-3+Math.random()*2,9,2));
      tween(380,q=>{m.position.lerpVectors(from,to,q);},q=>q*q).then(()=>{scene.remove(m);burst(to,{n:14,color:col,speed:5,size:.4});SFX.hit();shake=.4;}); SFX.magic(); await sleep(130); }
    await sleep(420); bigHit(chest,'必殺！',col); },
  // 冰霜新星：冰球在怪物身上凝結，然後整圈炸開
  async({e,h,col,chest})=>{ h.play('Spellcast_Shoot',{once:true}); await sleep(380); SFX.magic();
    fxOrb(chest,col,{to:1.2,ms:300,op:.9}); await sleep(260);
    for(let k=0;k<2;k++){ fxRing(e.pos,k?0xffffff:col,{to:6+k*2,ms:600,w:.6}); await sleep(120); }
    fxOrb(chest,0xffffff,{to:3.2,ms:520}); burst(chest,{n:36,color:col,speed:8,size:.4,life:800}); tone(1400,.3,'triangle',.08,0,-900); bigHit(chest,'必殺！',col); await sleep(550); },
  // 雷霆風暴：五道閃電輪流劈下來，最後一道最大
  async({e,h,col,chest})=>{ h.play('Spellcast_Shoot',{once:true,ts:.8}); await sleep(320);
    for(let k=0;k<5;k++){ const at=V3(e.pos.x+(Math.random()-.5)*2.4,0,e.pos.z+(Math.random()-.5)*1.6); fxBolt(at,col); noise(.12,.18); tone(160,.14,'sawtooth',.08,0,-90);
      burst(V3(at.x,.4,at.z),{n:8,color:col,speed:4,size:.3}); if(k%2===0) tick(chest,col,{n:8,sh:.35}); await sleep(150); }
    fxBolt(e.pos,0xffffff); fxBolt(e.pos,col); fxRing(e.pos,col,{to:6}); noise(.4,.3); bigHit(chest,'必殺！',col); await sleep(550); },
  // 超新星：頭上聚出一顆星星，丟出去之後整個房間都是爆炸
  async({e,h,col,chest})=>{ h.play('Spellcast_Shoot',{once:true,ts:.7}); const up=h.pos.clone().add(V3(0,3.4,-.4)), star=spSprite(MAGIC_TEX,col,.4); star.position.copy(up);
    tone(300,.6,'sine',.08,0,600); await tween(700,q=>{star.scale.setScalar(.4+q*2.6); if(Math.random()<.6) burst(up,{n:1,tex:MAGIC_TEX,color:col,speed:2,size:.3,life:350});});
    SFX.magic(); await tween(260,q=>{star.position.lerpVectors(up,chest,q);},q=>q*q); scene.remove(star); star.material.dispose();
    fxOrb(chest,0xffffff,{to:5,ms:700,op:.95}); fxOrb(chest,col,{to:7,ms:900,op:.6}); fxPillar(e.pos,col,{r:1.2,h:14,ms:900,grow:1}); bigHit(chest,'必殺！',col);
    for(let k=0;k<3;k++){ fxRing(e.pos,k%2?col:0xffffff,{to:8+k*2,ms:750,w:.6}); burst(chest,{n:20,tex:MAGIC_TEX,color:col,speed:9,size:.5,life:900}); shake=.9; await sleep(160); }
    await sleep(450); },
  // 重力黑洞（Lv40）：怪物身上開一個黑洞，光點全部被吸進去，最後往外炸開
  async({e,h,col,chest})=>{ h.play('Spellcast_Shoot',{once:true,ts:.7}); await sleep(380); SFX.magic();
    const hole=new THREE.Mesh(new THREE.SphereGeometry(1,20,14),new THREE.MeshBasicMaterial({color:0x0a0514,transparent:true,opacity:.92})); hole.position.copy(chest); hole.scale.setScalar(.1); scene.add(hole);
    tone(180,1.1,'sawtooth',.07,0,-120);
    await tween(900,q=>{ hole.scale.setScalar(.1+q*1.15); e.root.rotation.y=q*Math.PI*4;
      if(Math.random()<.8){ const a=Math.random()*Math.PI*2; fxFly(MAGIC_TEX,col,chest.clone().add(V3(Math.cos(a)*3.2,(Math.random()-.3)*2,Math.sin(a)*2)),chest,{ms:260,size:.45}); } });
    e.root.rotation.y=0; await tween(140,q=>{hole.scale.setScalar(1.25*(1-q)+.05);}); fxDone(hole);
    fxOrb(chest,0xffffff,{to:4.2,ms:560,op:.95}); fxOrb(chest,col,{to:6,ms:800,op:.6}); noise(.6,.35); tone(60,.7,'sawtooth',.13,0,-25); bigHit(chest,'必殺！',col);
    for(let k=0;k<3;k++){ fxRing(e.pos,k%2?0xffffff:col,{to:7+k*2,ms:700,w:.6}); shake=.9; await sleep(150); } await sleep(380); },
  // 元素洪流（Lv50）：火、冰、雷三顆光球在頭上轉，一顆一顆砸過去，最後合在一起
  async({e,h,col,chest})=>{ h.play('Spellcast_Shoot',{once:true,ts:.6}); const up=h.pos.clone().add(V3(0,3.2,-.3)), cols=[0xff7a3d,0x8fe6ff,0xfff27a], orbs=cols.map(c=>spSprite(MAGIC_TEX,c,.3));
    tone(260,.9,'sine',.07,0,700);
    await tween(750,q=>orbs.forEach((o,i)=>{ const a=q*Math.PI*4+i*2.094; o.position.set(up.x+Math.cos(a)*1.1,up.y+Math.sin(a*1.3)*.25,up.z+Math.sin(a)*.5); o.scale.setScalar(.3+q*1.1); }));
    for(let i=0;i<3;i++){ const o=orbs[i], from=o.position.clone(); SFX.magic(); await tween(170,q=>{o.position.lerpVectors(from,chest,q);},q=>q*q); scene.remove(o); o.material.dispose();
      if(i===0){ fxOrb(chest,cols[0],{to:3,ms:420,op:.9}); burst(chest,{n:24,color:cols[0],speed:7,size:.45}); }
      if(i===1){ fxRing(e.pos,cols[1],{to:6,ms:560,w:.6}); fxOrb(chest,cols[1],{to:2.6,ms:420,op:.8}); }
      if(i===2){ for(let b=0;b<3;b++) fxBolt(V3(e.pos.x+(b-1)*.8,0,e.pos.z),cols[2]); noise(.3,.3); }
      tick(chest,cols[i],{n:12,sh:.6}); await sleep(160); }
    fxPillar(e.pos,0xffffff,{r:1.5,h:15,ms:1000,grow:1.1,op:.9}); fxOrb(chest,0xffffff,{to:6,ms:750,op:.95}); noise(.7,.35); tone(50,.9,'sawtooth',.14,0,-20); bigHit(chest,'必殺！',col);
    for(let k=0;k<4;k++){ fxRing(e.pos,cols[k%3],{to:8+k*2,ms:760,w:.6}); burst(chest,{n:16,tex:MAGIC_TEX,color:cols[k%3],speed:9,size:.5,life:900}); shake=1; await sleep(140); } await sleep(420); },
 ],
 Rogue:[
  // 影分身連斬：瞬移到三個位置各砍一刀
  async({e,h,z0,col,chest})=>{
    for(const [dx,dz] of [[-1.3,1.4],[1.3,1.4],[0,1.7]]){ burst(h.pos.clone().add(V3(0,1,0)),{n:12,color:col,speed:2,size:.4,life:500}); h.pos.set(e.pos.x+dx,0,e.pos.z+dz);
      h.root.rotation.y=Math.atan2(e.pos.x-h.pos.x,e.pos.z-h.pos.z); h.play('1H_Melee_Attack_Chop',{once:true,ts:1.8}); await sleep(230); tick(chest,col,{n:16,sh:.45}); await sleep(200); }
    bigHit(chest,'必殺！',col); await sleep(300); h.pos.set(0,0,z0); h.root.rotation.y=Math.PI; h.play('Idle'); burst(h.pos.clone().add(V3(0,1,0)),{n:12,color:col,speed:2,size:.4}); },
  // 飛刀亂舞：五把飛刀左右畫弧線飛過去
  async({h,col,chest})=>{ const from=h.pos.clone().add(V3(0,1.5,-.5));
    for(let k=0;k<5;k++){ h.play('1H_Melee_Attack_Chop',{once:true,ts:2.2}); tone(1200,.06,'square',.05,0,400);
      fxFly(SPARK_TEX,col,from,chest.clone().add(V3((Math.random()-.5)*.6,(Math.random()-.5)*.8,0)),{ms:240,size:.7,arc:.6,side:(k%2?1:-1)*(1+k*.25)}).then(()=>tick(chest,col,{n:8,sh:.3})); await sleep(130); }
    await sleep(330); fxSlash(chest,0xffffff,0,{len:5,ms:380}); bigHit(chest,'必殺！',col); await sleep(400); h.play('Idle'); },
  // 瞬影十字：瞬移到左、右、前、後各砍一刀，最後留下一個十字
  async({e,h,z0,col,chest})=>{
    for(const [dx,dz,r] of [[-1.5,.4,Math.PI/2.2],[1.5,.4,-Math.PI/2.2],[0,1.8,0],[0,-1.3,Math.PI/2]]){ burst(h.pos.clone().add(V3(0,1,0)),{n:10,color:col,speed:2,size:.35,life:400});
      h.pos.set(e.pos.x+dx,0,e.pos.z+dz); h.root.rotation.y=Math.atan2(e.pos.x-h.pos.x,e.pos.z-h.pos.z); h.play('1H_Melee_Attack_Chop',{once:true,ts:2}); await sleep(150); fxSlash(chest,col,r); tick(chest,col); await sleep(150); }
    h.pos.set(0,0,z0); h.root.rotation.y=Math.PI; h.play('Idle'); fxSlash(chest,0xffffff,Math.PI/2,{len:5.5,ms:420}); fxSlash(chest,0xffffff,0,{len:5.5,ms:420}); bigHit(chest,'必殺！',col); await sleep(450); },
  // 千刃風暴：人消失，十二道刀光從四面八方砍過去
  async({e,h,col,chest})=>{ burst(h.pos.clone().add(V3(0,1,0)),{n:24,color:col,speed:3,size:.4}); h.root.visible=false; await sleep(200);
    for(let k=0;k<12;k++){ fxSlash(chest.clone().add(V3((Math.random()-.5)*.8,(Math.random()-.5),0)),k%3?col:0xffffff,Math.random()*Math.PI,{len:3+Math.random()*2,ms:200});
      tone(900+Math.random()*600,.05,'square',.05); if(k%2) tick(chest,col,{n:6,sh:.35}); await sleep(75); }
    h.root.visible=true; burst(h.pos.clone().add(V3(0,1,0)),{n:16,color:col,speed:2.5,size:.4}); fxRing(e.pos,col,{to:7}); fxOrb(chest,col,{to:3,ms:450}); bigHit(chest,'必殺！',col); await sleep(500); },
  // 影舞（Lv40）：繞著怪物瞬移六個位置，每到一處砍一刀
  async({e,h,z0,col,chest})=>{
    for(let k=0;k<6;k++){ const a=k/6*Math.PI*2+.5; burst(h.pos.clone().add(V3(0,1,0)),{n:8,color:col,speed:2,size:.3,life:350}); h.pos.set(e.pos.x+Math.sin(a)*1.7,0,e.pos.z+Math.cos(a)*1.5);
      h.root.rotation.y=Math.atan2(e.pos.x-h.pos.x,e.pos.z-h.pos.z); h.play('1H_Melee_Attack_Chop',{once:true,ts:2.4}); await sleep(95); fxSlash(chest,k%2?0xffffff:col,a,{len:4,ms:220}); tick(chest,col,{n:8,sh:.4}); tone(1000+k*120,.05,'square',.05); await sleep(95); }
    h.pos.set(0,0,z0); h.root.rotation.y=Math.PI; h.play('Idle'); await sleep(120);
    for(let k=0;k<6;k++) fxSlash(chest,0xffffff,k/6*Math.PI,{len:5.5,ms:460});
    fxRing(e.pos,col,{to:7,w:.6}); bigHit(chest,'必殺！',col); await sleep(480); },
  // 月影一閃（Lv50）：月亮升起，人消失，一道刀光從上劈到下，停一拍才爆開
  async({e,h,z0,col,chest})=>{ const moon=spSprite(SPARK_TEX,0xdfe9ff,.5); moon.position.copy(e.pos).add(V3(0,5.2,-1.5)); tone(660,.8,'sine',.07,0,-200);
    h.play('Cheer',{once:true,ts:1.6}); await tween(600,q=>{moon.scale.setScalar(.5+q*4.5);});
    burst(h.pos.clone().add(V3(0,1,0)),{n:20,color:col,speed:3,size:.4}); h.root.visible=false; await sleep(260);
    fxSlash(chest,0xffffff,Math.PI/2-.25,{len:9,ms:700}); tone(1800,.1,'square',.06); await sleep(380);
    h.pos.set(0,0,e.pos.z-1.6); h.root.rotation.y=0; h.root.visible=true; h.play('1H_Melee_Attack_Chop',{once:true,ts:1.6});   // 人已經站在怪物背後
    for(let k=0;k<5;k++){ fxSlash(chest.clone().add(V3((Math.random()-.5)*.8,(Math.random()-.5),0)),k%2?col:0xffffff,Math.random()*Math.PI,{len:4,ms:240}); tick(chest,col,{n:8,sh:.45}); await sleep(70); }
    fxPillar(e.pos,0xdfe9ff,{r:1.3,h:14,ms:900,grow:1}); fxOrb(chest,0xffffff,{to:4.5,ms:600,op:.95}); noise(.5,.3); bigHit(chest,'必殺！',col);
    for(let k=0;k<3;k++){ fxRing(e.pos,k%2?0xffffff:col,{to:7+k*2.5,ms:720,w:.6}); shake=.9; await sleep(140); }
    await tween(400,q=>{moon.material.opacity=1-q;}); scene.remove(moon); moon.material.dispose();
    burst(h.pos.clone().add(V3(0,1,0)),{n:12,color:col,speed:2,size:.35}); h.pos.set(0,0,z0); h.root.rotation.y=Math.PI; h.play('Idle'); await sleep(150); },
 ],
 Barbarian:[
  // 旋風巨斧：衝過去轉一圈，地上一圈震波
  async({e,h,z0,zt,col,chest})=>{ h.play('2H_Melee_Attack_Spin',{once:true,ts:1.3}); await tween(420,q=>{h.pos.z=z0+(zt-z0)*q;});
    fxRing(V3(e.pos.x,0,e.pos.z+1),col,{to:6}); bigHit(chest,'必殺！',col); await sleep(650);
    h.play('Idle'); await tween(300,q=>{h.pos.z=zt+(z0-zt)*q;}); },
  // 大地震擊：跳起來往地上砸，三圈震波
  async({e,h,z0,zt,col,chest})=>{ h.play('2H_Melee_Attack_Spin',{once:true,ts:1.1}); await tween(380,q=>{h.pos.z=z0+(zt-z0)*q;h.pos.y=Math.sin(q*Math.PI)*2.2;},q=>q);
    h.pos.y=0; noise(.5,.3); tone(60,.6,'sawtooth',.12,0,-25); bigHit(chest,'必殺！',col);
    for(let k=0;k<3;k++){ fxRing(h.pos,k%2?0xffffff:col,{to:6+k*2.5,ms:650,w:.55}); burst(V3(e.pos.x,.2,e.pos.z),{n:12,color:0xc9a27a,speed:5,size:.4}); shake=.9; await sleep(150); }
    await sleep(300); h.play('Idle'); await tween(300,q=>{h.pos.z=zt+(z0-zt)*q;}); },
  // 狂戰連旋：衝過去連轉三圈
  async({e,h,z0,zt,col,chest})=>{ await tween(240,q=>{h.pos.z=z0+(zt-z0)*q;});
    for(let k=0;k<3;k++){ h.play('2H_Melee_Attack_Spin',{once:true,ts:2.1}); await sleep(200); fxRing(h.pos,col,{to:4+k,ms:420,w:.5}); tick(chest,col,{sh:.5}); await sleep(230); }
    fxRing(e.pos,0xffffff,{to:7}); bigHit(chest,'必殺！',col); await sleep(380); h.play('Idle'); await tween(300,q=>{h.pos.z=zt+(z0-zt)*q;}); },
  // 隕石墜擊：跳到看不見的高空，帶著火焰砸下來
  async({e,h,z0,zt,col,chest})=>{ h.play('Cheer',{once:true,ts:2}); await tween(350,q=>{h.pos.y=q*9;h.pos.z=z0+(zt-z0)*q*.5;},q=>q*q); await sleep(350);
    h.pos.z=zt; h.play('2H_Melee_Attack_Spin',{once:true,ts:1.2}); tone(500,.4,'sawtooth',.08,0,-420);
    await tween(260,q=>{h.pos.y=9*(1-q); burst(h.pos.clone().add(V3(0,1.5,0)),{n:2,color:col,speed:2,size:.6,life:400});},q=>q*q); h.pos.y=0;
    noise(.6,.35); tone(50,.8,'sawtooth',.14,0,-20); fxPillar(e.pos,col,{r:1.4,h:12,ms:900,grow:1}); fxOrb(chest,0xffe9a0,{to:4.5,ms:600,op:.9}); bigHit(chest,'必殺！',col);
    for(let k=0;k<4;k++){ fxRing(h.pos,k%2?0xffffff:col,{to:6+k*2.5,ms:700,w:.6}); burst(V3(e.pos.x,.2,e.pos.z),{n:14,color:0xff9a4a,speed:7,size:.5,life:900}); shake=1; await sleep(140); }
    await sleep(380); h.play('Idle'); await tween(320,q=>{h.pos.z=zt+(z0-zt)*q;}); },
  // 火山爆發（Lv40）：跳起來砸地，怪物腳下一圈火柱輪流噴出來
  async({e,h,z0,zt,col,chest})=>{ h.play('2H_Melee_Attack_Spin',{once:true,ts:1}); await tween(360,q=>{h.pos.z=z0+(zt-z0)*q;h.pos.y=Math.sin(q*Math.PI)*2;},q=>q); h.pos.y=0;
    noise(.5,.3); tone(55,.8,'sawtooth',.13,0,-20); fxRing(h.pos,col,{to:6,w:.6}); shake=.9;
    for(let k=0;k<7;k++){ const a=k/7*Math.PI*2, r=k<6?1.5:0, at=V3(e.pos.x+Math.cos(a)*r,0,e.pos.z+Math.sin(a)*r*.8); fxPillar(at,k%2?0xffd27a:col,{r:.35,h:7,ms:520,grow:1.2,op:.95});
      burst(V3(at.x,.3,at.z),{n:10,color:0xff9a4a,speed:6,size:.45,life:800}); tone(120+k*25,.15,'sawtooth',.08); if(k%2===0) tick(chest,col,{n:8,sh:.5}); await sleep(95); }
    fxPillar(e.pos,col,{r:1.5,h:13,ms:950,grow:1,op:.9}); fxOrb(chest,0xffe9a0,{to:4.4,ms:600,op:.9}); noise(.6,.35); bigHit(chest,'必殺！',col);
    for(let k=0;k<3;k++){ burst(chest,{n:18,color:0xff7a3d,speed:9,size:.5,life:900}); fxRing(e.pos,k%2?0xffffff:col,{to:7+k*2.5,ms:700,w:.6}); shake=1; await sleep(140); }
    await sleep(340); h.play('Idle'); await tween(300,q=>{h.pos.z=zt+(z0-zt)*q;}); },
  // 泰坦之怒（Lv50）：整個人變成兩倍大，走過去連踩三下，打完才縮回來
  async({e,h,z0,zt,col,chest})=>{ const s0=h.root.scale.x; h.play('Cheer',{once:true,ts:1.3}); tone(110,.8,'sawtooth',.09,0,-50);
    await tween(600,q=>{ h.root.scale.setScalar(s0*(1+q*1.1)); if(Math.random()<.5) burst(h.pos.clone().add(V3((Math.random()-.5)*2,.2,(Math.random()-.5)*2)),{n:1,color:col,speed:2,size:.4,life:400}); });
    h.play('2H_Melee_Attack_Spin',{once:true,ts:.95}); await tween(380,q=>{h.pos.z=z0+(zt+.4-z0)*q;});
    for(let k=0;k<3;k++){ noise(.4,.3); tone(50,.5,'sawtooth',.13,0,-18); fxRing(h.pos,k%2?0xffffff:col,{to:8+k*2,ms:600,w:.7}); tick(chest,col,{n:14,sh:.9}); burst(V3(e.pos.x,.2,e.pos.z),{n:14,color:0xc9a27a,speed:7,size:.5}); await sleep(230); }
    fxPillar(e.pos,col,{r:1.6,h:14,ms:1000,grow:1,op:.9}); fxOrb(chest,0xffffff,{to:5,ms:650,op:.95}); bigHit(chest,'必殺！',col); shake=1.1;
    await sleep(420); h.play('Idle'); await tween(380,q=>{ h.root.scale.setScalar(s0*(2.1-q*1.1)); h.pos.z=zt+.4+(z0-zt-.4)*q; }); h.root.scale.setScalar(s0); },
 ],
 Ranger:[
  // 連珠箭：一口氣連射五箭
  async({h,col,chest})=>{
    for(let k=0;k<5;k++){ h.play('2H_Ranged_Shoot',{once:true,ts:2.6}); bowDraw(h,90); await sleep(110); twang();
      arrowFly(bowTip(h),chest.clone().add(V3((Math.random()-.5)*.7,(Math.random()-.5)*.8,0)),{ms:150,glow:col}).then(()=>tick(chest,col,{n:8,sh:.3})); await sleep(110); }
    await sleep(320); bigHit(chest,'必殺！',col); await sleep(380); h.play('Idle'); },
  // 箭雨：往天上射一箭，十二支箭從天上落下來
  async({e,h,col,chest})=>{ h.play('2H_Ranged_Aiming',{once:true,ts:1.3}); bowDraw(h,420); await sleep(450); twang();
    await arrowFly(bowTip(h),V3(e.pos.x,10,e.pos.z+1.5),{ms:260,glow:col}); await sleep(200);
    for(let k=0;k<12;k++){ const at=V3(e.pos.x+(Math.random()-.5)*2.8,.25,e.pos.z+(Math.random()-.5)*2);
      arrowFly(V3(at.x-.8,9,at.z+1.2),at,{ms:240}).then(()=>{ burst(at,{n:6,color:col,speed:3,size:.3}); tone(700+Math.random()*300,.05,'square',.04); if(k%3===0) tick(chest,col,{n:8,sh:.35}); }); await sleep(70); }
    await sleep(380); fxRing(e.pos,col,{to:6}); bigHit(chest,'必殺！',col); await sleep(450); h.play('Idle'); },
  // 爆裂箭：蓄力一支發光的箭，射中之後爆炸
  async({e,h,col,chest})=>{ h.play('2H_Ranged_Aiming',{once:true,ts:.85}); bowDraw(h,700); const tip=bowTip(h), glow=spSprite(SPARK_TEX,col,.3); glow.position.copy(tip);
    tone(300,.7,'sine',.08,0,700); await tween(700,q=>{ glow.scale.setScalar(.3+q*1.6); if(Math.random()<.5) burst(tip,{n:1,color:col,speed:1.5,size:.25,life:300}); }); scene.remove(glow); glow.material.dispose();
    h.play('2H_Ranged_Shoot',{once:true,ts:1.3}); twang(); await arrowFly(tip,chest,{ms:160,glow:col,size:1.8});
    fxOrb(chest,col,{to:3.8,ms:520,op:.9}); fxOrb(chest,0xffffff,{to:2.3,ms:360}); noise(.5,.3); tone(70,.6,'sawtooth',.12,0,-30); bigHit(chest,'必殺！',col);
    for(let k=0;k<2;k++){ fxRing(e.pos,k?0xffffff:col,{to:6+k*2.5,ms:650,w:.55}); burst(chest,{n:18,color:col,speed:8,size:.45,life:800}); shake=.9; await sleep(150); }
    await sleep(380); h.play('Idle'); },
  // 流星神射：往後跳到半空中，一道光箭貫穿怪物
  async({e,h,z0,col,chest})=>{ h.play('Jump_Full_Short',{once:true,ts:1.1});
    await tween(400,q=>{ h.pos.y=Math.sin(q*Math.PI*.5)*2.8; h.pos.z=z0+q*1.3; },q=>q);
    h.play('2H_Ranged_Shoot',{once:true,ts:1.2}); bowDraw(h,160); await sleep(180); twang(); const tip=bowTip(h);
    fxBeam(tip,chest,col,{r:.22,ms:420}); fxBeam(tip,chest,0xffffff,{r:.09,ms:520});
    for(let k=0;k<5;k++) arrowFly(tip,chest.clone().add(V3((k-2)*.45,(Math.random()-.5)*.6,0)),{ms:140,glow:col});
    await sleep(150); fxPillar(e.pos,col,{r:1.3,h:13,ms:900,grow:1}); fxOrb(chest,0xffffff,{to:4.6,ms:620,op:.95}); noise(.6,.35); tone(55,.8,'sawtooth',.13,0,-20); bigHit(chest,'必殺！',col);
    for(let k=0;k<3;k++){ fxRing(e.pos,k%2?0xffffff:col,{to:7+k*2.5,ms:720,w:.6}); burst(chest,{n:18,color:col,speed:9,size:.5,life:900}); shake=1; await sleep(150); }
    await tween(300,q=>{ h.pos.y=2.8*(1-q); h.pos.z=z0+1.3*(1-q); },q=>q*q); await sleep(200); h.play('Idle'); },
  // 追蹤箭陣（Lv40）：先往天上射三箭，接著十支箭從四面八方飛回來
  async({e,h,col,chest})=>{ h.play('2H_Ranged_Aiming',{once:true,ts:1.2}); bowDraw(h,420); await sleep(440); twang();
    for(let k=0;k<3;k++) arrowFly(bowTip(h),V3(e.pos.x+(k-1)*2.5,8,e.pos.z+2),{ms:260,glow:col});
    await sleep(380);
    for(let k=0;k<10;k++){ const a=k/10*Math.PI*2; arrowFly(V3(e.pos.x+Math.cos(a)*4.5,4+Math.random()*2.5,e.pos.z+Math.sin(a)*3.2+.5),chest,{ms:230,glow:k%2?col:0xffffff}).then(()=>tick(chest,col,{n:6,sh:.35})); tone(800+k*60,.05,'square',.04); await sleep(75); }
    await sleep(330); fxOrb(chest,col,{to:3.4,ms:480,op:.9}); fxRing(e.pos,col,{to:7,w:.6}); bigHit(chest,'必殺！',col); await sleep(450); h.play('Idle'); },
  // 鳳凰箭（Lv50）：蓄力到整把弓都在燒，一支大箭帶著一對火翅膀飛出去
  async({e,h,col,chest})=>{ h.play('2H_Ranged_Aiming',{once:true,ts:.7}); bowDraw(h,850); const tip=bowTip(h), glow=spSprite(SPARK_TEX,col,.3); glow.position.copy(tip); tone(240,.9,'sine',.08,0,900);
    await tween(850,q=>{ glow.scale.setScalar(.3+q*2.2); for(const d of [-1,1]) if(Math.random()<.5) burst(tip.clone().add(V3(d*(.4+q*1.2),.2+q*.6,0)),{n:1,color:q>.5?0xffd27a:col,speed:1.5,size:.35,life:350}); });
    h.play('2H_Ranged_Shoot',{once:true,ts:1.2}); twang(); tone(900,.5,'sawtooth',.07,0,-600);
    const wings=[-1,1].map(d=>{ const m=new THREE.Mesh(new THREE.PlaneGeometry(2.6,.5),fxMat(col,.9)); scene.add(m); return [m,d]; }), fly=arrowFly(tip,chest,{ms:300,glow:0xffd27a,size:2.4});
    await tween(300,q=>{ const p=tip.clone().lerp(chest,q); glow.position.copy(p);
      wings.forEach(([m,d])=>{ m.position.copy(p).add(V3(d*1.2,.3+Math.sin(q*18)*.25,.3)); m.quaternion.copy(camera.quaternion); m.rotateZ(d*(.5+Math.sin(q*18)*.3)); });
      if(Math.random()<.8) burst(p,{n:1,color:0xff7a3d,speed:1.5,size:.5,life:400}); },q=>q);
    await fly; wings.forEach(([m])=>fxDone(m)); scene.remove(glow); glow.material.dispose();
    fxPillar(e.pos,col,{r:1.6,h:15,ms:1100,grow:1.1,op:.9}); fxOrb(chest,0xffe9a0,{to:5.5,ms:700,op:.95}); noise(.7,.35); tone(50,.9,'sawtooth',.14,0,-20); bigHit(chest,'必殺！',col);
    for(let k=0;k<4;k++){ fxRing(e.pos,k%2?0xffd27a:col,{to:8+k*2.5,ms:760,w:.6}); burst(chest,{n:18,color:k%2?0xffd27a:0xff5a2a,speed:9,size:.5,life:900}); shake=1; await sleep(140); }
    await sleep(420); h.play('Idle'); },
 ],
 Assassin:[
  // 背刺（Lv1）：人不見了，下一秒出現在怪物背後
  async({e,h,z0,col,chest})=>{ burst(h.pos.clone().add(V3(0,1,0)),{n:16,color:col,speed:2.5,size:.4,life:450}); h.root.visible=false; await sleep(220);
    h.pos.set(e.pos.x,0,e.pos.z-1.5); h.root.rotation.y=0; h.root.visible=true; burst(h.pos.clone().add(V3(0,1,0)),{n:10,color:col,speed:2,size:.35}); h.play('Dualwield_Melee_Attack_Stab',{once:true,ts:1.5}); await sleep(260);
    fxSlash(chest,0xffffff,.3,{len:4.5,ms:300}); bigHit(chest,'必殺！',col); await sleep(420);
    burst(h.pos.clone().add(V3(0,1,0)),{n:10,color:col,speed:2,size:.35}); h.pos.set(0,0,z0); h.root.rotation.y=Math.PI; h.play('Idle'); },
  // 煙幕連擊（Lv10）：先丟一團煙，衝進去雙刀連砍四下
  async({e,h,z0,zt,col,chest})=>{ for(let k=0;k<3;k++) burst(V3(e.pos.x+(k-1)*.9,1,e.pos.z+.8),{n:14,color:0x9aa0b4,speed:1.6,size:.9,life:900});
    tone(200,.3,'sawtooth',.05,0,-100); noise(.3,.15); await tween(200,q=>{h.pos.z=z0+(zt-z0)*q;});
    for(let k=0;k<4;k++){ h.play(k%2?'Dualwield_Melee_Attack_Slice':'Dualwield_Melee_Attack_Chop',{once:true,ts:2.2}); await sleep(120); fxSlash(chest,k%2?0xffffff:col,(k%2?1:-1)*(.4+k*.2),{len:3.6,ms:220}); tick(chest,col,{n:10,sh:.4}); await sleep(120); }
    bigHit(chest,'必殺！',col); await sleep(360); h.play('Idle'); await tween(280,q=>{h.pos.z=zt+(z0-zt)*q;}); },
  // 燕返（Lv20）：從怪物身上穿過去、折回來、再穿過去
  async({e,h,z0,col,chest})=>{ const far=e.pos.z-2;
    for(let k=0;k<3;k++){ const a=h.pos.z, b=k%2?z0:far; h.root.rotation.y=b<a?Math.PI:0; h.play('Dualwield_Melee_Attack_Slice',{once:true,ts:2}); tone(1400,.08,'square',.05,0,-600);
      await tween(150,q=>{h.pos.z=a+(b-a)*q;},q=>q); fxSlash(chest,k%2?0xffffff:col,(k-1)*.5,{len:5,ms:300}); tick(chest,col,{n:12,sh:.5}); await sleep(130); }
    fxRing(e.pos,col,{to:6}); bigHit(chest,'必殺！',col); await sleep(380); burst(h.pos.clone().add(V3(0,1,0)),{n:10,color:col,speed:2,size:.35}); h.pos.set(0,0,z0); h.root.rotation.y=Math.PI; h.play('Idle'); },
  // 幻影軍團（Lv30）：八個影子圍住怪物，一個接一個撲上去
  async({e,h,col,chest})=>{ h.play('Cheer',{once:true,ts:1.8}); const ghosts=[];
    for(let k=0;k<8;k++){ const a=k/8*Math.PI*2, g=spSprite(MAGIC_TEX,col,.2); g.position.set(e.pos.x+Math.cos(a)*2.4,1.2,e.pos.z+Math.sin(a)*1.8); ghosts.push(g); tween(260,q=>{g.scale.set(.2+q*.9,.2+q*1.9,1);}); tone(500+k*60,.06,'triangle',.05); await sleep(60); }
    await sleep(220);
    for(let k=0;k<8;k++){ const g=ghosts[k], from=g.position.clone(); tween(140,q=>{g.position.lerpVectors(from,chest,q);},q=>q*q).then(()=>{ scene.remove(g); g.material.dispose(); fxSlash(chest,k%2?0xffffff:col,k/8*Math.PI*2,{len:4.2,ms:240}); tick(chest,col,{n:6,sh:.4}); }); await sleep(70); }
    await sleep(300); fxOrb(chest,col,{to:3.6,ms:500,op:.85}); fxRing(e.pos,col,{to:7,w:.6}); bigHit(chest,'必殺！',col); await sleep(480); h.play('Idle'); },
  // 暗影束縛（Lv40）：三圈影子從外面往怪物收緊，綁住之後衝上去連刺
  async({e,h,z0,zt,col,chest})=>{ h.play('Spellcast_Shoot',{once:true,ts:.9}); await sleep(320); tone(140,.9,'sawtooth',.07,0,-60);
    for(let k=0;k<3;k++){ const m=new THREE.Mesh(new THREE.RingGeometry(.5,.9,40),fxMat(k%2?0xffffff:col,.9)); m.rotation.x=-Math.PI/2; m.position.set(e.pos.x,.1+k*.6,e.pos.z); scene.add(m);
      tween(520,q=>{m.scale.setScalar(7*(1-q)+.9);m.material.opacity=.3+.6*q;}).then(()=>fxDone(m)); await sleep(130); }
    await sleep(300); h.play('Dualwield_Melee_Attack_Stab',{once:true,ts:1.4}); await tween(180,q=>{h.pos.z=z0+(zt-z0)*q;},q=>q*q);
    for(let k=0;k<5;k++){ fxSlash(chest,k%2?0xffffff:col,k*.63,{len:4.6,ms:260}); tick(chest,col,{n:8,sh:.5}); await sleep(70); }
    fxOrb(chest,col,{to:4.6,ms:620,op:.9}); fxPillar(e.pos,col,{r:1.4,h:13,ms:900,grow:1}); noise(.5,.3); bigHit(chest,'必殺！',col);
    for(let k=0;k<3;k++){ fxRing(e.pos,k%2?0xffffff:col,{to:7+k*2.5,ms:700,w:.6}); shake=.9; await sleep(140); }
    await sleep(320); h.play('Idle'); await tween(300,q=>{h.pos.z=zt+(z0-zt)*q;}); },
  // 終焉一閃（Lv50）：人影一閃已經站在怪物背後，畫面只留一道白線；停一拍，刀光才一口氣全部爆出來
  async({e,h,z0,chest})=>{ const pu=0xb07bff; h.play('Dualwield_Melee_Attack_Slice',{once:true,ts:.6}); tone(90,.9,'sawtooth',.08,0,60);
    await tween(700,()=>{ if(Math.random()<.6) burst(h.pos.clone().add(V3((Math.random()-.5)*1.6,.3+Math.random()*2,(Math.random()-.5))),{n:1,color:pu,speed:1,size:.4,life:350}); });
    h.pos.set(0,0,e.pos.z-2); h.root.rotation.y=Math.PI; h.play('Idle'); tone(2200,.12,'square',.07);
    fxSlash(chest,0xffffff,0,{len:12,ms:900}); fxBeam(V3(0,1.2,z0),V3(0,1.2,e.pos.z-2),0xffffff,{r:.06,ms:700});
    await sleep(750);
    for(let k=0;k<9;k++){ fxSlash(chest.clone().add(V3((Math.random()-.5),(Math.random()-.5)*1.2,0)),k%2?pu:0xffffff,Math.random()*Math.PI,{len:3.5+Math.random()*2.5,ms:230}); if(k%2) tick(chest,pu,{n:8,sh:.5}); tone(900+Math.random()*900,.05,'square',.05); await sleep(55); }
    fxPillar(e.pos,0xffffff,{r:1.7,h:15,ms:1100,grow:1.1,op:.95}); fxOrb(chest,0xffffff,{to:6,ms:760,op:.95}); fxOrb(chest,pu,{to:8,ms:950,op:.55}); noise(.7,.4); tone(45,1,'sawtooth',.15,0,-18); bigHit(chest,'必殺！',pu);
    for(let k=0;k<4;k++){ fxRing(e.pos,k%2?0xffffff:pu,{to:8+k*2.5,ms:780,w:.65}); burst(chest,{n:18,color:k%2?0xffffff:pu,speed:9,size:.5,life:900}); shake=1.1; await sleep(140); }
    await sleep(380); burst(h.pos.clone().add(V3(0,1,0)),{n:12,color:pu,speed:2,size:.35}); h.pos.set(0,0,z0); },
 ],
};
// 這一關每位勇者已經放過幾次必殺技。學到的招式從最新的開始輪流放：新招式一定看得到，舊招式也不會消失
let spUsed={};
function nextMove(def,take){ const list=movesOf(def).reverse(), n=spUsed[def.id]||0; if(take) spUsed[def.id]=n+1; return list[n%list.length]; }
async function heroSpecial(mv=heroDef.moves[0]){
  const e=currentEnemy,h=hero,z0=h.pos.z,x0=h.pos.x,col=mv.color;
  const chest=e.pos.clone().add(V3(0,1.4*e.root.scale.y,0));
  banner(mv.name,mv.en,col); SFX.win(); h.play('Cheer',{once:true,ts:1.6}); burst(h.pos.clone().add(V3(0,.2,0)),{n:30,color:col,speed:4,size:.4,life:900}); await sleep(650);
  const size=h.root.scale.x;
  await SPECIALS[heroDef.id][mv.i]({e,h,z0,zt:e.pos.z+1.9,col,chest});
  h.pos.set(x0,0,z0); h.root.rotation.y=Math.PI; h.root.visible=true; h.root.scale.setScalar(size); e.root.rotation.y=0;
  await specialReward(mv.heal);
}
// 必殺技、合體技的獎勵：回愛心（Lv20、Lv30 的招式回 2 顆）＋護盾
async function specialReward(heal=1){
  await sleep(250); const h=hero;
  const hp=h.pos.clone().add(new THREE.Vector3(0,2.4*h.root.scale.y,0));
  const got=Math.min(heal,maxHearts-hearts); if(got>0){hearts+=got;floater('+'+got+' ❤',hp);}
  shieldOn=true; setTimeout(()=>floater('🛡 護盾',hp.clone().add(new THREE.Vector3(0,.5,0))),350);
  burst(h.pos.clone().add(new THREE.Vector3(0,1,0)),{n:18,color:0x7dffa0,speed:2.5,size:.35,life:800}); updateBars();
}
function impact(at){ SFX.hit(); shake=.35; currentEnemy.play('Hit_A',{once:true,ts:1.2}); floater((hitFast?'⚡ ':'')+(combo>=2?combo+' COMBO ':'')+'−'+hitDmg,at); }
// 勇者挨打：有護盾就擋掉。回傳有沒有擋下來
function heroHit(){
  const h=hero, up=h.pos.clone().add(new THREE.Vector3(0,2.2,0));
  if(shieldOn){ shieldOn=false; tone(880,.15,'triangle',.12); noise(.15,.12); shake=.25; burst(h.pos.clone().add(new THREE.Vector3(0,1.3,-.6)),{n:22,color:0x7fc8ff,speed:4,size:.4}); floater('🛡 擋下了！',up); return true; }
  SFX.hurt(); shake=.5; flashRed(); h.play('Hit_A',{once:true}); floater('-1 ❤',up,true); return false;
}
async function enemyAttack(){
  const e=currentEnemy, h=hero, z0=e.pos.z, zt=h.pos.z-1.8;
  e.play('1H_Melee_Attack_Chop',{once:true,ts:1.1});
  await tween(260,k=>{e.pos.z=z0+(zt-z0)*k;});
  await sleep(220);
  const blocked=heroHit();
  await sleep(250); await tween(300,k=>{e.pos.z=zt+(z0-zt)*k;}); e.play(e.idle);
  return blocked;
}

/* ================= 試煉模式（複習考島） =================
   四人接力出招、快答加成、連續 6 題四人合體技；魔王分階段，還會蓄力放大招。 */
const TEAM_HEARTS=3;   // 四個人一起打，小隊的愛心比單人多 3 顆
const BENCH=[[-1.8,.3],[-3.0,-.9],[-1.9,-2.1]];   // 還沒輪到的三位勇者站的位置（相對於出招的位置）
function teamSetup(i){
  const base=heroSpot(i), cap=save.hero, rest=HEROES.map((_,k)=>k).filter(k=>k!==cap&&!HEROES[k].hidden).slice(0,3);   // 一隊四個人：隊長加三位一般勇者
  rest.forEach((k,n)=>{ const h=heroes[k]; h.root.visible=true; h.pos.set(BENCH[n][0],0,base.z+BENCH[n][1]); h.root.rotation.y=Math.PI; h.play('Cheer',{once:true});
    burst(h.pos.clone().add(new THREE.Vector3(0,1,0)),{n:14,color:HEROES[k].spColor,speed:2.5,size:.4,life:800}); });
  team={order:[cap,...rest],turn:0}; SFX.spawn();
}
function teamReset(){ if(team){ heroes.forEach((h,k)=>{h.root.visible=(k===save.hero);h.pos.y=0;}); } team=null; charge=0; chargeMax=0; hero=heroes[save.hero]||hero; heroDef=HEROES[save.hero]; }
// 換下一位勇者上場：跟場上的勇者交換位置
async function teamNext(){
  team.turn++; const k=team.order[team.turn%team.order.length], cur=hero, nxt=heroes[k]; if(nxt===cur) return;
  const a=cur.pos.clone(), b=nxt.pos.clone(); tone(700,.08,'triangle',.08);
  await tween(230,q=>{ cur.pos.lerpVectors(a,b,q); nxt.pos.lerpVectors(b,a,q); cur.pos.y=nxt.pos.y=Math.sin(q*Math.PI)*.6; });
  cur.pos.copy(b); nxt.pos.copy(a); hero=nxt; heroDef=HEROES[k]; $('heroName').textContent='小隊・'+heroDef.name;
}
// 四人合體技：三位近戰一起衝上去、法師在後面放魔法，四種顏色一起炸開
async function teamSpecial(){
  const e=currentEnemy, chest=e.pos.clone().add(new THREE.Vector3(0,1.4*e.root.scale.y,0)), ids=team.order, home=ids.map(k=>heroes[k].pos.clone()), gold=0xffd27a;
  banner('四人合體技','All-Out Attack',gold); SFX.win();
  ids.forEach(k=>{ const h=heroes[k]; h.play('Cheer',{once:true,ts:1.8}); burst(h.pos.clone().add(new THREE.Vector3(0,.3,0)),{n:14,color:HEROES[k].spColor,speed:3,size:.4,life:800}); });
  await sleep(620);
  // 近戰的圍住怪物（左、右、正面），遠距離的留在原地出招
  const spots=[[-1.3,1.6],[1.3,1.6],[0,2.1],[0,2.6]], to={}; let n=0;
  ids.forEach(k=>{ if(!HEROES[k].ranged){ const p=spots[n++]; to[k]=new THREE.Vector3(e.pos.x+p[0],0,e.pos.z+p[1]); } heroes[k].play(HEROES[k].attack,{once:true,ts:1.25}); });
  const go=(q,back)=>ids.forEach((k,j)=>{ if(!to[k]) return; const h=heroes[k]; h.pos.lerpVectors(back?to[k]:home[j],back?home[j]:to[k],q); h.pos.y=Math.sin(q*Math.PI)*.8; });
  await tween(300,q=>go(q,false));
  for(const k of [...ids.filter(k=>to[k]),...ids.filter(k=>!to[k])]){ const d=HEROES[k];
    if(d.arrow){ twang(); arrowFly(bowTip(heroes[k]),chest,{ms:140,glow:d.spColor}); }
    burst(chest,{n:18,tex:d.ranged&&!d.arrow?MAGIC_TEX:SPARK_TEX,color:d.spColor,speed:6,size:.45,life:800}); SFX.hit(); if(d.ranged&&!d.arrow) SFX.magic(); shake=.5; e.play('Hit_A',{once:true,ts:1.6}); await sleep(150); }
  const pil=new THREE.Mesh(new THREE.CylinderGeometry(1.3,1.3,12,28,1,true),new THREE.MeshBasicMaterial({color:gold,transparent:true,opacity:.8,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  pil.position.copy(e.pos).add(new THREE.Vector3(0,6,0)); scene.add(pil); bigHit(chest,'合體技！');
  await tween(750,q=>{pil.scale.set(1+q*.8,1,1+q*.8);pil.material.opacity=.8*(1-q);}); scene.remove(pil);
  ids.forEach(k=>heroes[k].play('Idle')); await tween(320,q=>go(q,true)); ids.forEach((k,j)=>heroes[k].pos.copy(home[j]));
  await specialReward();
}
/* ===== 難度 =====
   怪物的血不再等於題數：勇者的招式越強，怪物的血跟著變多，目標是「一關大約要答跟單字數一樣多的題」。
   dmgPerQ：平均每答對一題扣多少血（每三題有一題是必殺技；Lv10 起必殺技傷害 3，Lv30 起 4） */
const dmgPerQ=lv=>lv>=30?2:lv>=10?5/3:4/3;
const BOSS_MORE=1.4;       // 小王要答的題數是綜合題題數的幾倍（最多照 16 題算）
const BOSS_CHARGE=5;    // 小王每出幾題放一次大招。連續答對三題發動必殺技可以打斷，所以全對的話不會被打到；答錯讓連擊斷掉才會吃到
// 魔王大招：蓄力滿了就放，護盾擋得住。回傳有沒有擋下來。複習考的魔王丟考卷，島上的小王丟骷髏頭
const stormTex={};
async function bossStorm(exam){
  const e=currentEnemy, h=hero, icon=exam?'📝':'💀'; banner(exam?'考卷風暴':'骷髏咒語',exam?'Exam Storm':'Bone Curse',0xb26bff); SFX.spawn(); e.play('Taunt',{once:true,ts:1.3}); await sleep(650);
  const paperTex=stormTex[icon]||(stormTex[icon]=makeOrbTex(icon,''));
  const from=e.pos.clone().add(new THREE.Vector3(0,1.6*e.root.scale.y,0)), to=h.pos.clone().add(new THREE.Vector3(0,1.3,0));
  const papers=[...Array(7)].map(()=>{ const m=new THREE.Sprite(new THREE.SpriteMaterial({map:paperTex,transparent:true,depthWrite:false})); m.scale.setScalar(.95); scene.add(m); return m; });
  await tween(620,q=>papers.forEach((m,n)=>{ const k=Math.min(1,Math.max(0,q*1.6-n*.09)); m.position.lerpVectors(from,to,k); m.position.x+=Math.sin((k+n)*5)*.9*(1-k); m.position.y+=Math.sin(k*Math.PI)*1.3; m.material.opacity=k>0?1:0; }),q=>q);
  papers.forEach(m=>scene.remove(m)); noise(.3,.2);
  const blocked=heroHit(); await sleep(450); e.play(e.idle); return blocked;
}
// 魔王換階段：變大、換顏色
async function phaseShift(ph,k){
  const e=currentEnemy, s0=e.root.scale.x, s1=ph.scale||s0, col=ph.color||0xb26bff;
  banner('第 '+(k+1)+' 階段',ph.name||'',col); SFX.spawn(); e.play('Taunt',{once:true}); roomLight.color.setHex(col);
  burst(e.pos.clone().add(new THREE.Vector3(0,1.2,0)),{n:36,tex:MAGIC_TEX,color:col,speed:5,size:.5,life:1000});
  await tween(700,q=>e.root.scale.setScalar(s0+(s1-s0)*q)); await sleep(600);
}
// 試煉的出題機：從這一階段的島一直抽單字（抽完重洗），中間穿插片語題
function examDrawer(st){
  const decks=st.phases.map(()=>[]); let n=0;
  return k=>{ const srcs=st.phases[k].srcs, idxs=PHRASES.map((p,j)=>srcs.includes(islOf(p))?j:-1).filter(j=>j>=0);
    const nW=srcs.reduce((s,x)=>s+x.words.length,0);   // 一句片語算兩個單字的份量：片語少的那一週就少出一點，免得一直重複
    if(idxs.length&&Math.random()<2*idxs.length/(nW+2*idxs.length)){ const q=pickPhraseQs(1,idxs)[0]; if(q) return {key:'p'+(n++),q,e:'📜'}; }
    if(!decks[k].length) decks[k]=shuffle(srcs.flatMap(s=>s.words));
    const w=decks[k].pop(); return {key:w.en,w,e:w.e}; };
}
// 快答的時間：選擇題短、要拼要排的題目長
function fastMsFor(q){
  if(q.kind==='order'||q.type==='arrange') return 5000+1600*q.words.length;
  if(SPELL_TYPES.has(q.type)) return 5000+800*(spellOf(q.w)||'').replace(/ /g,'').length;
  if(q.kind==='mc') return q.listen||q.en?11000:8000;
  return LISTEN_TYPES.has(q.type)?8500:7000;
}

/* ================= 關卡流程 ================= */
let busy=false, runId=0, heroAt=0;
async function moveHeroTo(i){
  const target=heroSpot(i);
  if(heroAt!==i-1||Math.abs(hero.pos.z-heroSpot(i-1).z)>.5){ await fadeOut(); hero.pos.copy(heroSpot(Math.max(0,i-1))); hero.root.rotation.y=Math.PI; camMode='chase'; const [tp,tl]=camTargets(); camPos.copy(tp); camLook.copy(tl); await fadeIn(); }
  camMode='chase'; hero.root.rotation.y=Math.PI; hero.play('Running_A');
  const z0=hero.pos.z, d=Math.abs(target.z-z0);
  await tween(d/6.5*1000,k=>{hero.pos.z=z0+(target.z-z0)*k;},k=>k);
  hero.play('Idle'); heroAt=i;
}
// 怪物用到才載入；載不到（例如離線又沒玩過這一關）就退回骷髏小兵
const enemyLoads={};
function ensureEnemy(name){ if(enemies[name]||!MONSTERS[name]) return Promise.resolve();
  return enemyLoads[name]||(enemyLoads[name]=loader.loadAsync('assets/m/'+name+'.glb').then(g=>{ const m=MONSTERS[name], box=new THREE.Group();
      g.scene.scale.setScalar(2.35/m.h); if(m.fly) g.scene.position.y=.5; box.add(g.scene);
      // 地城的燈偏橘，藍色、綠色的怪物會被照得很暗；讓貼圖自己帶一點亮度，顏色才看得出來
      g.scene.traverse(o=>{ if(o.isMesh){ const old=o.material; o.material=new THREE.MeshStandardMaterial({map:old.map,roughness:.85,metalness:0,emissive:0xffffff,emissiveMap:old.map,emissiveIntensity:.4,side:THREE.DoubleSide}); old.dispose(); } });
      const e=new Actor({scene:box,animations:g.animations},{idle:'Idle_Combat',alias:m.fly?FLY_ALIAS:MON_ALIAS}); e.root.visible=false; enemies[name]=e; })
    .catch(err=>{ console.warn('[enemy] 載不到 '+name+'，改用骷髏小兵',err); delete enemyLoads[name]; })); }
const enemyOf=name=>enemies[name]||enemies[ENEMY_MODELS[0]];
function prepareEnemy(i){
  const st=STAGES[i-1];
  for(const k in enemies) enemies[k].root.visible=false;
  const e=enemyOf(st.enemy); e.root.scale.setScalar(st.scale||(st.boss?1.45:1)); e.pos.copy(enemySpot(i)); e.root.rotation.y=0; e.root.visible=true; currentEnemy=e; return e;
}
async function spawnEnemy(i){
  const e=prepareEnemy(i); SFX.spawn(); burst(e.pos.clone().add(new THREE.Vector3(0,.3,0)),{n:26,tex:MAGIC_TEX,speed:3,size:.5,life:900});
  await e.play('Spawn_Ground_Skeletons',{once:true}); e.play('Taunt',{once:true});
}

// 小王綜合題：這座島每一章平均抽單字，再加片語題（每句片語至少一題），全部混在一起出
function bossItems(){
  const nW=ISL.boss.words??8, nP=ISL.boss.phrases??6;
  const groups=STAGES.filter(s=>!s.boss).map(s=>shuffle(s.words)), ws=[];
  while(ws.length<nW&&groups.some(g=>g.length)) for(const g of groups){ if(ws.length>=nW) break; const w=g.pop(); if(w) ws.push(w); }
  return shuffle([...ws.map(w=>({key:w.en,w,e:w.e})),...pickPhraseQs(nP).map((q,k)=>({key:'b'+k,q,e:'📜'}))]);
}
async function runStage(i){
  busy=true; const my=++runId; const dead=()=>my!==runId;
  const st=STAGES[i-1], exam=!!st.exam, cave=!!st.miss;
  teamReset();
  $('hud').hidden=false; $('battleBars').hidden=true; setPanel(`<div class="say">勇者正前往 <b>${esc(st.place)}</b>…</div>`);
  hudStage(`<b>${ISL.week}・${st.chapter}</b> ${st.place}`);
  roomLight.color.setHex(st.color); roomLight.position.set(0,5,CZ(i)-1);
  for(const k in enemies) enemies[k].root.visible=false; clearOrbs();
  const loading=ensureEnemy(st.enemy);   // 走過去的路上順便把這一關的怪物載進來
  await moveHeroTo(i); if(dead()) return;
  camMode='battle';
  await loading; if(dead()) return;
  await spawnEnemy(i); if(dead()) return;
  if(exam){ teamSetup(i); await sleep(450); if(dead()) return; }
  await dialog(st.enemyName,st.taunt,{enemy:true}); if(dead()) return;
  if(exam&&ISL.rules){ await dialog('試煉規則',ISL.rules+(st.charge?ISL.bossRules||'':''),{btn:'知道了'}); if(dead()) return; }
  // 小王的規則：還沒打贏過才講，免得每次都要多按一下
  if(st.boss&&!exam&&!starsOf(st)){ await dialog('小王的規則',`小王的血比較厚，要答比較多題。牠還會<em>蓄力</em>：每出一題蓄一格，蓄滿 ${BOSS_CHARGE} 格就放大招，扣一顆心。<br>連續答對 3 題發動<em>必殺技</em>，可以把蓄力打斷；必殺技給的護盾也擋得住大招。`,{btn:'知道了'}); if(dead()) return; }
  await dialog(exam?'勇者小隊':heroDef.name,st.hero,{btn:'開戰'}); if(dead()) return;

  // 戰鬥
  const phases=exam?st.phases:null, draw=exam?examDrawer(st):null; let phaseK=0;
  const items = exam ? [] : cave ? missItems() : st.boss ? bossItems() : shuffle(st.words).map(w=>({key:w.en,w,e:w.e}));
  if(cave&&!items.length){ busy=false; return goHome(); }
  if(!exam) makeOrbs(items,currentEnemy.pos.clone().add(new THREE.Vector3(0,2.9,0)));
  // 血量照勇者的強度算（錯題洞窟不調：有幾題錯題就幾滴血）
  const per=dmgPerQ(lvOf(heroDef.id));
  ehpMax=cave?items.length:exam?Math.round(st.hp*per/(4/3)):st.boss?Math.round(Math.min(items.length,16)*BOSS_MORE*per):Math.round(items.length*per);
  maxHearts=heartsFor(lvOf(heroDef.id))+(exam?TEAM_HEARTS:0); hearts=maxHearts; combo=0; shieldOn=false; ehp=ehpMax; chargeMax=st.charge||(st.boss&&!exam?BOSS_CHARGE:0); charge=0;
  // 第一輪的題目出完、怪物還沒倒：再抽一輪（同一個字會換一種題型）
  const askedAs={}; let pool=[];
  const more=exam?()=>draw(phaseK):cave?null:()=>{ if(!pool.length) pool=st.boss?bossItems():shuffle(st.words).map(w=>({key:w.en,w,e:w.e})); const it=pool.pop(); return it.w?{...it,last:askedAs[it.w.en]}:it; };
  let mistakes=0, wrongWords=new Set(); const mastered=[]; spUsed={};
  const enemyLabel=()=>st.enemyName+(phases&&phases.length>1?'・'+phases[phaseK].name:'');
  $('heroName').textContent=exam?'小隊・'+heroDef.name:heroDef.name+' Lv'+lvOf(heroDef.id); $('enemyName').textContent=enemyLabel(); $('battleBars').hidden=false; updateBars();
  let queue=items.slice(), done=0, attacks=0; const usedTypes={};
  const fallen=async()=>{ hero.play('Death_A',{once:true,hold:true}); currentEnemy.play('Cheer');
    const c=await choice(exam?'勇者小隊倒下了…':'勇者倒下了…',exam?'別擔心，複習考可以一直重來。答錯的題目多看一眼，再挑戰一次！':'別擔心，答錯的單字會再出現一次。深呼吸，再挑戰一次吧！',['再挑戰一次','回到主選單']);
    hero.play('Idle'); busy=false; if(c===0) return runStage(i); return goHome(); };
  while(ehp>0&&(more||queue.length)){
    // 答錯的題目一定要再答對一次：怪物剩的血只夠打這些題目時，就只出這些
    const retries=queue.filter(x=>x.retry); if(retries.length&&retries.length>=ehp) queue=retries;
    if(!queue.length) queue.push(more());
    const it=queue.shift();
    const q=it.q?it.q:makeQ(it.w,it.last,usedTypes,it.retry?null:it.prefer); if(it.w) askedAs[it.w.en]=q.type;
    const ok=await ask(q,`第 ${done+1} 題`,exam?fastMsFor(q):0); if(dead()) return;
    let broke=false;
    if(ok){ combo++; const all=exam&&combo%6===0, sp=!all&&combo%3===0; hitFast=exam&&lastFast;
      // 必殺技、合體技、快答都會加傷害，但不會跳過還沒重答的錯題
      updateBars(); if(team&&attacks++>0){ await teamNext(); if(dead()) return; }
      const mv=sp?nextMove(heroDef,true):null, pending=queue.filter(x=>x.retry).length; hitDmg=Math.max(1,Math.min((all?ALL_DMG:sp?mv.dmg:1)+(hitFast?1:0),ehp-pending));
      if(all) await teamSpecial(); else if(sp) await heroSpecial(mv); else await heroAttack(); if(dead()) return;
      done++; ehp=Math.max(0,ehp-hitDmg);
      if(noteRight(it,q)){ mastered.push(it.w?it.w.en:(q.p!=null&&PHRASES[q.p]?PHRASES[q.p].en:q.review||q.prompt)); floater('✅ 掌握了！',hero.pos.clone().add(new THREE.Vector3(0,2.9,0))); }
      if((all||sp)&&chargeMax){ if(charge>0) floater('蓄力被打斷！',currentEnemy.pos.clone().add(new THREE.Vector3(0,2.6*currentEnemy.root.scale.y,0))); charge=0; broke=true; }
      updateBars(); if(!exam) freeOrb(it.key); if(it.w){save.seen[islOf(it.w).id+'/'+it.w.en]=1;persist();}
      // 魔王換階段：血量每掉一段，換考下一週
      if(phases&&phases.length>1&&ehp>0){ const k=Math.min(phases.length-1,Math.floor((ehpMax-ehp)/(ehpMax/phases.length)));
        if(k!==phaseK){ phaseK=k; queue=queue.filter(x=>x.retry); await phaseShift(phases[k],k); if(dead()) return; $('enemyName').textContent=enemyLabel(); } }
    } else { combo=0; mistakes++; wrongWords.add(it.w?it.w.en:(it.q.review||it.q.prompt||it.q.zh)); noteWrong(it,q); updateBars(); const blocked=await enemyAttack(); if(dead()) return; if(!blocked) hearts--; updateBars();
      if(exam) while(queue.length<2) queue.push(draw(phaseK));   // 重考的題目隔兩題再出
      queue.splice(Math.min(2,queue.length),0,{...it,q:it.q?altPhraseQ(it.q):undefined,last:q.type,retry:1});
      if(hearts<=0) return fallen(); }
    // 魔王蓄力：每出一題蓄一格，蓄滿放大招；剛被必殺技打斷的那一題不蓄
    if(chargeMax&&ehp>0&&!broke){ charge++; updateBars();
      if(charge>=chargeMax){ const blocked=await bossStorm(exam); if(dead()) return; charge=0; if(!blocked) hearts--; updateBars(); if(hearts<=0) return fallen(); } }
  }
  // 勝利：怪物倒下，這一關剩下的單字也一起救回來
  combo=0; charge=0; chargeMax=0; updateBars(); clearOrbs();
  for(const w of st.words) save.seen[islOf(w).id+'/'+w.en]=1;
  currentEnemy.play('Death_A',{once:true,hold:true}); SFX.win(); hero.root.rotation.y=Math.PI; (team?heroes:[hero]).forEach(h=>h.play('Cheer'));
  burst(currentEnemy.pos.clone().add(new THREE.Vector3(0,1,0)),{n:40,speed:6,size:.45,life:1100});
  // 試煉題數多，兩顆星的門檻跟著放寬
  const stars=mistakes===0?3:mistakes<=(exam?Math.max(3,Math.round(done*.2)):st.boss?3:2)?2:1; if(!cave) save.stars[st.key]=Math.max(save.stars[st.key]||0,stars); persist();   // 錯題洞窟不算過關數
  const gain=cave?10+10*mastered.length:clearCoins(st,stars); addCoins(gain);   // 錯題洞窟：過關 10，每掌握一題再 +10
  const coinLine=`<div class="coinline">💰 ＋${gain} 金幣<small>現在有 ${coins()}，可以去換裝商城逛逛</small></div>`;
  await sleep(900); $('battleBars').hidden=true; shieldOn=false;
  if(team){ const c=heroes[save.hero]; if(hero!==c){ const a=hero.pos.clone(); hero.pos.copy(c.pos); c.pos.copy(a); } teamReset(); hero.play('Cheer'); }   // 隊長回到中間領獎
  if(!cave){ await levelUp(); if(dead()) return; }   // 錯題洞窟是複習用的，不給等級
  const next=i<STAGES.length;
  const wrongList=[...wrongWords];
  if(cave){ const left=missActive().length;
    const c=await choiceRaw(`<span class="speaker">錯題洞窟 掃蕩完成！</span>
     <div class="stars" aria-label="${stars} 顆星">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
     <div class="stats"><div><b>${done}</b>題答對</div><div><b>${mistakes}</b>答錯</div><div><b>${mastered.length}</b>題掌握了</div></div>
     ${mastered.length?`<div class="say" style="font-size:14px">這次掌握了：<em>${mastered.map(esc).join('、')}</em></div>`:''}
     ${wrongList.length?`<div class="say" style="font-size:14px">要再複習：<em>${wrongList.map(esc).join('、')}</em></div>`:''}
     <div class="note">${left?`錯題本裡還有 ${left} 題沒掌握。同一題連續答對 ${MISS_OK} 次就會從洞窟消失。`:'錯題本全部清空了，太厲害了！'}</div>${coinLine}`,left?['再複習一輪','主選單','錯題本']:['回主選單','錯題本']);
    busy=false; if(left&&c===0) return runStage(1); await goHome(); if(c===(left?2:1)) openMiss(); return; }
  const body=`<span class="speaker">${exam?(st.boss?esc(st.enemyName)+'被打倒了！':esc(st.enemyName)+'認輸了！'):st.boss?'小王被打倒了！':esc(st.place)+' 解放！'}</span>
   <div class="stars" aria-label="${stars} 顆星">${'★'.repeat(stars)}${'☆'.repeat(3-stars)}</div>
   <div class="stats"><div><b>${done}</b>${st.boss&&!exam?'綜合題答對':'題答對'}</div><div><b>${mistakes}</b>答錯</div><div><b>${hearts}</b>剩餘愛心</div></div>
   ${wrongList.length?`<div class="say" style="font-size:14px">要再複習：<em>${wrongList.map(esc).join('、')}</em></div>`:'<div class="say" style="font-size:15px">全部一次答對，太厲害了！</div>'}${coinLine}`;
  if(next){ const c=await choiceRaw(body,[`前往${STAGES[i].chapter}・${STAGES[i].place}`,'主選單']); busy=false; if(c===0) return runStage(i+1); return goHome(); }
  await ending(body);
}
async function levelUp(){
  const id=heroDef.id, k=save.hero, before=lvOf(id);
  if(before>=MAX_LV){ await choiceRaw(`<div class="lvup">MAX LEVEL</div><div class="say" style="text-align:center">${esc(heroDef.name)}已經是最高等級 Lv${MAX_LV}「${rankOf(MAX_LV)}${esc(heroDef.name)}」了！</div>`,['繼續']); return; }
  const wasOpen=HEROES.map((_,j)=>heroOpen(j));
  const after=before+1; save.lv[id]=after; persist();
  const hb=heartsFor(before), ha=heartsFor(after), rb=rankOf(before), ra=rankOf(after), ab=auraOf(before), aa=auraOf(after);
  // 升級演出
  SFX.win(); [784,988,1175,1568].forEach((f,i)=>tone(f,.18,'square',.06,.5+i*.09));
  const col=aa||0xffd27a; let pil=new THREE.Mesh(new THREE.CylinderGeometry(1,1,8,24,1,true),new THREE.MeshBasicMaterial({color:col,transparent:true,opacity:.6,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}));
  pil.position.copy(hero.pos).add(new THREE.Vector3(0,4,0)); scene.add(pil);
  for(let i=0;i<3;i++) setTimeout(()=>burst(hero.pos.clone().add(new THREE.Vector3(0,.5+i,0)),{n:20,color:col,speed:3.5,size:.4,life:900}),i*200);
  tween(1400,q=>{pil.material.opacity=.6*(1-q);pil.scale.set(1-q*.5,1,1-q*.5);}).then(()=>scene.remove(pil));
  applyLevelLook(k); hero.play('Cheer');
  const learned=heroDef.moves.find(m=>m.lv===after), perks=[];
  if(learned) perks.push(`<div class="newmove">🔥 學會新招式：<b>${esc(learned.name)}</b><small>${esc(learned.en)}・傷害 ${learned.dmg}${learned.heal>1?'・回 '+learned.heal+' 顆心':''}</small></div>`);
  if(ra!==rb) perks.push(`<div>⚔️ 稱號：${rb}${esc(heroDef.name)} → <b>${ra}${esc(heroDef.name)}</b></div>`);
  if(ha>hb) perks.push(`<div>❤ 愛心上限：${hb} → <b>${ha}</b></div>`);
  if(after===RAINBOW_LV) perks.push(`<div>✨ 腳下光環變成彩虹了！</div>`);
  else if(after===MAX_LV) perks.push(`<div>✨ 腳下的彩虹光環變得更大了！</div>`);
  else if(aa&&aa!==ab) perks.push(`<div>✨ 腳下光環${ab?'變色了':'出現了'}！</div>`);
  if(after<=9) perks.push(`<div>💪 角色變得更高大了</div>`);
  if(!perks.length) perks.push(`<div>💪 ${ra}${esc(heroDef.name)}又更強了</div>`);
  if(after<MAX_LV){ // 預告下一個會拿到的東西：新招式或愛心
    const up=[...Array(MAX_LV-after)].map((_,j)=>after+1+j), nm=heroDef.moves.find(m=>m.lv>after), nh=up.find(l=>heartsFor(l)>ha);
    const tip=nm&&(!nh||nm.lv<=nh)?`再升 ${nm.lv-after} 級（Lv${nm.lv}）學會新招式「${esc(nm.name)}」`:nh?`升到 Lv${nh} 愛心上限再 +1`:'';
    if(tip) perks.push(`<div style="opacity:.7;font-weight:500">${tip}</div>`); }
  if(learned) banner(learned.name,'New Skill',learned.color);
  await choiceRaw(`<div class="lvup">LEVEL UP!</div><div class="lvline">${esc(heroDef.name)}　Lv${before} → <span style="color:#b5770f">Lv${after}</span></div><div class="perks">${perks.join('')}</div>`,['太棒了！']);
  // 這一級剛好讓哪位隱藏勇者開放了
  for(let j=0;j<HEROES.length;j++) if(!wasOpen[j]&&heroOpen(j)){ const r=HEROES[j], n=unlockNeeds(j).length;
    SFX.win(); [523,659,784,1047,1319].forEach((f,i)=>tone(f,.2,'square',.06,i*.1)); banner('隱藏勇者 現身','Secret Hero',r.spColor);
    await choiceRaw(`<div class="lvup" style="font-size:34px">？？？ → ${esc(r.name)}</div><div class="say" style="text-align:center">${n} 位勇者全部練到 Lv${r.hidden.lv} 了！<br>傳說中的隱藏勇者 <em>${esc(r.name)}</em> 加入隊伍。<br>回主選單就能選他，他會從 Lv1 開始練，有自己的 ${r.moves.length} 招。</div>`,['去看看！']); }
}
function choiceRaw(body,btns){return new Promise(res=>{const el=setPanel(body+`<div class="row">${btns.map((b,i)=>`<button class="${i===0?'cta ember':'ghost'}" data-i="${i}" style="${i===0?'flex:2 1 0':''}">${esc(b)}</button>`).join('')}</div>`);el.querySelectorAll('[data-i]').forEach(b=>b.onclick=()=>{SFX.tap();res(+b.dataset.i);});});}
async function ending(body){
  await choiceRaw(body,['繼續']);
  const total=islandStars(ISL), left=STAGES.length-islandCleared(ISL);
  if(ISL.review){ await dialog('單字王國',(left?'複習考大魔王被打倒了！不過還有 <em>'+left+' 關</em>考官沒挑戰，記得回地圖把他們也打敗。':'三週的試煉全部通過！<em>'+esc(ISL.dates)+'</em> 的單字和片語都難不倒你，複習考加油！')+'<br>勇者小隊在這座島一共拿到 <em>'+total+' / '+STAGES.length*3+'</em> 顆星。',{btn:'領取試煉徽章'}); }
  else await dialog('單字王國',(left?esc(ISL.name)+'的小王被打倒了！不過島上還有 <em>'+left+' 關</em>沒過，記得回地圖把那些單字也救回來。':esc(ISL.name)+'被偷走的單字都回家了，這座島重新亮了起來！')
    +'<br>勇者 '+esc(heroDef.name)+' 在這座島一共拿到 <em>'+total+' / '+STAGES.length*3+'</em> 顆星。',{btn:'領取勇者稱號'});
  const c=await choice(ISL.review?'🏅 試煉勇者小隊':'🏅 '+ISL.week+' 單字勇者','新的單字表出現時，地圖上會多一座新的關卡島。現在可以回地圖挑關卡再練，把每一關都拿到三顆星！',['回關卡島地圖','打開單字圖鑑']);
  busy=false; await goHome(); if(c===1) openBook(); else openMap();
}

/* ================= 主選單 / 選角 ================= */
function placeSelectLineup(){
  const n=heroes.length, gap=6.2/(n-1), x0=-3.1;   // 人越多站得越擠，總寬度固定，手機才不會被切到
  heroes.forEach((h,k)=>{ h.root.visible=true; h.pos.set(x0+k*gap,0,CZ(0)-.6-(k%2?.35:0)); h.root.rotation.y=0; h.play('Idle');   // 前後錯開一點，才不會互相擋住
    if(HEROES[k].hidden){ const open=heroOpen(k); h.mat.color.setHex(open?0xffffff:0x06060b); if(!open) h.ring.visible=false; else applyLevelLook(k); } });   // 還沒解鎖的隱藏勇者只看得到黑影
}
function selectHero(k){
  if(!heroOpen(k)) return;
  save.hero=k; persist(); heroDef=HEROES[k]; hero=heroes[k];
  heroes.forEach((h,j)=>{h.pos.z=CZ(0)-.6-(j%2?.35:0)+(j===k?1.3:0);}); hero.play('Cheer',{once:true});
}
let atHome=false;
async function goHome(){
  busy=false; runId++; clearOrbs(); closeLayers(); teamReset(); if(synth) synth.cancel();
  if(ISL.miss) useIsland(save.island);   // 從錯題洞窟出來，回到原本那座島
  await fadeOut();
  for(const k in enemies) enemies[k].root.visible=false; currentEnemy=null;
  $('hud').hidden=true; camMode='select'; placeSelectLineup(); hero=heroes[save.hero]; heroDef=HEROES[save.hero];
  hero.pos.z=CZ(0)+.5; roomLight.color.setHex(0xffb35c); roomLight.position.set(0,5,CZ(0)); heroAt=0;
  const [tp,tl]=camTargets(); camPos.copy(tp); camLook.copy(tl);
  await fadeIn(); renderHome();
}
// 「繼續冒險」要去哪：先看目前這座島，過完了就找最新一座還沒過完的島
function nextTarget(){
  const firstOpen=isl=>isl.stages.findIndex(st=>!starsOf(st));
  const order=[ISL,...ISLANDS.slice().reverse().filter(x=>x!==ISL)];
  for(const isl of order){ const k=firstOpen(isl); if(k>=0) return [isl,k+1]; }
  return [ISLANDS[ISLANDS.length-1],1];
}
function acctLabel(){
  if(!cloud.state.enabled) return '';
  const u=cloud.state.user;
  return `<button class="acct${u?' on':''}" id="acct">${u?'☁ '+esc(save.name||'已登入'):'<b>G</b> 登入存進度'}</button>`;
}
/* 加到主畫面（PWA）：Android / 電腦的 Chrome 會給「可以安裝」事件，直接跳安裝視窗；iPhone 沒有這個事件，只能教使用者從分享選單加 */
const STANDALONE=matchMedia('(display-mode: standalone)').matches||navigator.standalone===true;   // 已經是從主畫面開的
const IS_IOS=/iPad|iPhone|iPod/.test(navigator.userAgent)||(navigator.platform==='MacIntel'&&navigator.maxTouchPoints>1);
const canInstall=()=>!STANDALONE&&!cloud.inAppBrowser()&&(!!window.__installEvt||IS_IOS);
addEventListener('installready',()=>{ if(atHome) renderHome(); });
async function installApp(){
  const e=window.__installEvt;
  if(e){ e.prompt(); try{ await e.userChoice; }catch(err){} window.__installEvt=null; if(atHome) renderHome(); return; }
  const L=showLayer('acctLayer',`<div class="sheet book-sheet"><div class="qhead"><span class="speaker">📲 加到主畫面</span></div>
    <div class="say" style="font-size:15px">把單字地下城放到主畫面，之後點圖示就能全螢幕打開，像一般的 App 一樣。</div>
    <ol class="steps"><li>點瀏覽器的<em>分享</em>按鈕（方框加一個往上的箭頭）</li><li>往下滑，選<em>加入主畫面</em></li><li>點右上角的<em>加入</em></li></ol>
    <div class="note">主畫面版的進度可能跟瀏覽器分開存。有用 Google 登入的話，在主畫面版再登入一次，進度就會回來。</div>
    <button class="cta" id="acctClose">知道了</button></div>`);
  L.querySelector('#acctClose').onclick=()=>{SFX.tap();L.hidden=true;};
}
function renderHome(){
  atHome=true; fixHero();
  const [nIsl,ni]=nextTarget(), pg=progress(), fresh=pg.cleared===0, nMiss=missActive().length;
  const el=setPanel(`<div class="home-top"><div class="wordmark"><span class="en">Word Dungeon</span><span class="zh">單字地下城</span><span class="meta">${ISLANDS.length} 座關卡島 · 已過 ${pg.cleared} / ${pg.total} 關 · ★ ${pg.stars}</span></div>${acctLabel()}</div>
   <div class="say" style="font-size:15px">骷髏法師把每一週的單字封印在一座座<em>關卡島</em>上。選一位勇者，答對題目把單字救回來！連續答對 3 題會發動<em>必殺技</em>，傷害加倍；勇者最高 Lv${MAX_LV}，每升 10 級學會一招<em>新招式</em>。</div>
   <div class="heroes" role="group" aria-label="選擇勇者" style="grid-template-columns:repeat(${HEROES.length},1fr)">${HEROES.map((h,k)=>heroOpen(k)?`<button class="hero-btn" data-k="${k}" aria-pressed="${k===save.hero}">${h.name}<small>Lv${lvOf(h.id)}</small></button>`
     :`<button class="hero-btn locked" data-k="${k}" aria-pressed="false" aria-label="隱藏勇者，還沒解鎖">？？？<small>🔒</small></button>`).join('')}</div>
   <div class="moves" id="moves" aria-label="招式"></div>
   <div class="go-row"><button class="cta ember two" id="go">${fresh?'開始冒險':'繼續冒險'} ▸<small>${esc(nIsl.week)}・${esc(nIsl.stages[ni-1].chapter)} ${esc(nIsl.stages[ni-1].place)}</small></button>
     <button class="ghost shop-btn" id="shop">👕 換裝<small>💰 ${coins()}</small></button></div>
   <div class="row three${cloud.state.enabled?' four':''}"><button class="ghost" id="map">🗺 關卡島</button><button class="ghost${nMiss?' hot':''}" id="miss">📕 錯題${nMiss?`<b class="badge">${nMiss}</b>`:''}</button><button class="ghost" id="book">📖 圖鑑</button>${cloud.state.enabled?'<button class="ghost" id="rank">🏆 排行榜</button>':''}</div>
   ${canInstall()?'<button class="textbtn" id="install">📲 加到主畫面，像 App 一樣全螢幕玩</button>':''}`);
  const showMoves=()=>{ const h=HEROES[save.hero], lv=lvOf(h.id); el.querySelector('#moves').innerHTML=`<span>${esc(h.role)}</span>`+h.moves.map(m=>lv>=m.lv?`<b>${esc(m.name)}</b>`:`<i>🔒 Lv${m.lv}</i>`).join(''); };
  showMoves();
  el.querySelectorAll('.hero-btn').forEach(b=>b.onclick=()=>{ac();SFX.tap();const k=+b.dataset.k;
    if(!heroOpen(k)){ const need=unlockNeeds(k), lv=HEROES[k].hidden.lv; el.querySelector('#moves').innerHTML=`<span>🔒 隱藏勇者</span><i>${need.length} 位勇者都練到 Lv${lv} 才會現身（目前 ${need.filter(h=>lvOf(h.id)>=lv).length} / ${need.length}）</i>`; return; }
    selectHero(k);el.querySelectorAll('.hero-btn').forEach(x=>x.setAttribute('aria-pressed',x===b));showMoves();});
  el.querySelector('#go').onclick=()=>{ac();SFX.tap();startAt(nIsl.id,ni);};
  el.querySelector('#map').onclick=()=>{ac();SFX.tap();openMap();};
  el.querySelector('#book').onclick=()=>{ac();SFX.tap();openBook();};
  el.querySelector('#miss').onclick=()=>{ac();SFX.tap();openMiss();};
  el.querySelector('#shop').onclick=()=>{ac();SFX.tap();openShop();};
  const ins=el.querySelector('#install'); if(ins) ins.onclick=()=>{ac();SFX.tap();installApp();};
  const rk=el.querySelector('#rank'); if(rk) rk.onclick=()=>{ac();SFX.tap();openRank();};
  const a=el.querySelector('#acct'); if(a) a.onclick=()=>{ac();SFX.tap();openAccount();};
}
async function startAt(islandId,i){
  if(synth){try{synth.speak(new SpeechSynthesisUtterance(''));}catch(e){}}  // iOS 需要使用者點擊後才能發聲
  atHome=false; closeLayers(); useIsland(islandId); if(!ISL.miss){ save.island=ISL.id; persist(); }
  heroes.forEach((h,k)=>{h.root.visible=(k===save.hero);}); hero=heroes[save.hero]; heroDef=HEROES[save.hero];
  if(i===1){ hero.root.rotation.y=Math.PI; heroAt=0; hero.pos.copy(heroSpot(0)); }
  else heroAt=-1;
  runStage(i);
}

/* ================= 換裝商城 =================
   在主選單的場景裡直接試穿：鏡頭拉近到選中的勇者，下面的面板換成商品列。沒買的商品點了只是試穿，離開就脫掉。 */
let shop=null;   // {slot:現在看哪一類, pick:正在試穿、還沒買的商品}
const hueNear=(a,b)=>{ const d=Math.abs(a-b)%360; return Math.min(d,360-d)<25; };
const dyeCss=d=>d.dark?'background:linear-gradient(135deg,#6a55a0,#16121f)':`background:linear-gradient(135deg,hsl(${d.metal?d.metal[0]:d.hue} 85% 64%),hsl(${d.metal?d.metal[0]:d.hue} 75% 38%))`;
// 這位勇者在這一類看得到的商品。跟自己原本顏色幾乎一樣的染色不列出來
function shopList(k,slot){ const def=HEROES[k];
  const secret=x=>{ const j=HEROES.findIndex(h=>h.id===x.hero); return j>=0&&!heroOpen(j); };   // 還沒現身的隱藏勇者，他的東西也先不賣
  return [{id:'',name:slot==='color'?'原本的顏色':'不裝備',icon:slot==='color'?'🎨':'🚫'},...ITEMS.filter(x=>x.slot===slot&&!secret(x)&&(!x.only||x.only===def.id)&&!(x.dye&&x.dye.hue!=null&&!x.dye.metal&&hueNear(x.dye.hue,def.hue)))]; }
function shopHero(k){ save.hero=k; persist(); heroDef=HEROES[k]; hero=heroes[k]; heroes.forEach((h,j)=>{h.root.visible=(j===k);}); hero.pos.set(0,0,CZ(0)+.5); hero.play('Idle'); }
function openShop(){ fixHero(); atHome=false; shop={slot:'main',pick:null}; camMode='dress'; shopHero(save.hero); renderShop(); }
function closeShop(){ const k=save.hero; shop=null; applyWear(k); camMode='select'; placeSelectLineup(); hero=heroes[k]; heroDef=HEROES[k]; hero.pos.z=CZ(0)+.5; renderHome(); }
function renderShop(keep){
  const k=save.hero, w=wearOf(k), slot=shop.slot, pick=shop.pick?ITEM[shop.pick]:null, old=panel.querySelector('.shop-items'), sx=keep&&old?old.scrollLeft:0, have=coins();
  const card=x=>{ const trying=!!pick&&pick.id===x.id, worn=!pick&&w[slot]===x.id, free=canWear(k,x.id);
    return `<button class="item${worn?' worn':''}${trying?' try':''}" data-id="${esc(x.id)}"><span class="ic">${x.dye?`<i class="dye" style="${dyeCss(x.dye)}"></i>`:x.icon}</span><b>${esc(x.name)}</b><small>${worn?'穿著中':trying?'試穿中':free?(x.id?'已擁有':'免費'):'💰 '+x.price}</small></button>`; };
  const el=setPanel(`<div class="qhead"><span class="speaker">👕 換裝商城</span><span class="coin">💰 ${have}</span></div>
   <div class="heroes" style="grid-template-columns:repeat(${HEROES.filter((_,j)=>heroOpen(j)).length},1fr)">${HEROES.map((h,j)=>heroOpen(j)?`<button class="hero-btn slim" data-k="${j}" aria-pressed="${j===k}">${h.name}</button>`:'').join('')}</div>
   <div class="tabs">${SLOTS.map(([id,name])=>`<button class="tab" data-slot="${id}" aria-pressed="${id===slot}">${name}</button>`).join('')}</div>
   <div class="shop-items">${shopList(k,slot).map(card).join('')}</div>
   ${pick?`<button class="cta ember" id="buy"${have<pick.price?' disabled':''}>${have<pick.price?`還差 ${pick.price-have} 金幣才能買「${esc(pick.name)}」`:`購買「${esc(pick.name)}」 💰 ${pick.price}`}</button>`
     :`<div class="note">點商品就能試穿。買了之後四位勇者都能穿；過關、進錯題洞窟都會拿到金幣。</div>`}
   <button class="ghost" id="shopClose">完成</button>`);
  const strip=el.querySelector('.shop-items'); strip.scrollLeft=sx;
  if(!keep){ const cur=strip.querySelector('.worn'); if(cur) strip.scrollLeft=Math.max(0,cur.offsetLeft-strip.clientWidth/2+cur.offsetWidth/2); }
  el.querySelectorAll('.hero-btn').forEach(b=>b.onclick=()=>{ SFX.tap(); const old=save.hero; shop.pick=null; applyWear(old); shopHero(+b.dataset.k); renderShop(); });
  el.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{ SFX.tap(); shop.pick=null; applyWear(k); shop.slot=b.dataset.slot; renderShop(); });
  el.querySelectorAll('.item').forEach(b=>b.onclick=()=>{ ac(); SFX.tap(); const id=b.dataset.id;
    if(canWear(k,id)){ shop.pick=null; setWear(k,slot,id); applyWear(k); hero.play('Cheer',{once:true}); }
    else { shop.pick=id; applyWear(k,{...wearOf(k),[slot]:id}); }
    renderShop(true); });
  const buy=el.querySelector('#buy'); if(buy) buy.onclick=()=>{ if(!pick||coins()<pick.price) return; ac();
    save.spent=(save.spent|0)+pick.price; save.owned[pick.id]=1; shop.pick=null; setWear(k,slot,pick.id); applyWear(k);
    tone(1318,.08,'square',.06); tone(1760,.16,'square',.06,.08); hero.play('Cheer',{once:true}); burst(hero.pos.clone().add(new THREE.Vector3(0,1.2,0)),{n:26,color:0xffd27a,speed:3.5,size:.4,life:900});
    renderShop(true); };
  el.querySelector('#shopClose').onclick=()=>{ SFX.tap(); closeShop(); };
}

/* ================= 浮層（地圖、圖鑑、排行榜、帳號共用） ================= */
const LAYERS=['mapLayer','bookLayer','rankLayer','acctLayer','missLayer'];
function closeLayers(){ for(const id of LAYERS) $(id).hidden=true; }
function showLayer(id,html){ const L=$(id); L.innerHTML=html; L.hidden=false; L.scrollTop=0; return L; }

/* ================= 關卡島地圖 ================= */
// 一座島一塊陸地，島上一關一個節點（第 1 關在最下面，小王在最上面）；最新的島排最上面。
// 版面全部由關卡數算出來，新增一座島不用調座標。
const NODE_GAP=98, NODE_TOP=64, NODE_BOTTOM=96;
const DECO=['🌴','🌲','🪨','🌴','🍄','🌳','⛺','🌵'], DECO_EXAM=['🔥','🪨','🌋','🔥','⚔️','🪨'];
function islandBlock(isl,order){
  const n=isl.stages.length, H=NODE_TOP+(n-1)*NODE_GAP+NODE_BOTTOM, c=islandCleared(isl), nextK=isl.stages.findIndex(st=>!starsOf(st));
  const pos=isl.stages.map((s,k)=>({x:s.boss?50:(k%2?70:30),y:NODE_TOP+(n-1-k)*NODE_GAP}));
  let trail=`M${pos[0].x},${pos[0].y}`; for(let k=1;k<n;k++){ const p=pos[k-1],q=pos[k],my=(p.y+q.y)/2; trail+=` C${p.x},${my} ${q.x},${my} ${q.x},${q.y}`; }
  // 裝飾擺在節點的另一側，不擋路
  const deco=pos.map((p,k)=>isl.stages[k].boss?'':`<span class="deco" style="left:${p.x<50?78+(k%2)*6:14+(k%2)*6}%;top:${p.y+4+((k+order)%3)*8}px">${(isl.review?DECO_EXAM:DECO)[(k+order*3)%(isl.review?DECO_EXAM:DECO).length]}</span>`).join('');
  const nodes=isl.stages.map((s,k)=>{ const st=starsOf(s), p=pos[k], cls=(s.boss?' boss':'')+(st?' cleared':'')+(k===nextK?' next':'');
    return `<button class="node${cls}" data-id="${esc(isl.id)}" data-i="${k+1}" style="left:${p.x}%;top:${p.y}px" aria-label="${esc(s.chapter+' '+s.place)}，${st?st+' 顆星':'還沒過關'}">
      ${k===nextK?'<i class="here">下一關</i>':''}<span class="dot">${s.boss?'💀':k+1}</span>
      <span class="lbl">${esc(s.label||(s.boss?'小王・綜合題':s.place))}<small>${'★'.repeat(st)}${'☆'.repeat(3-st)}</small></span></button>`; }).join('');
  return `<section class="island${isl.id===ISL.id?' cur':''}${isl.review?' exam':''}" style="--c:${esc(isl.color)}">
    <div class="isl-banner"><span class="ic">${esc(isl.icon)}</span><span class="nm"><b>${esc(isl.week)}</b>${esc(isl.name)}<small>${esc([isl.klass,isl.dates].filter(Boolean).join(' · '))}</small></span>
      <span class="prog">${c===n?'👑 ':''}${c} / ${n} 關<small>★ ${islandStars(isl)} / ${n*3}</small></span></div>
    <div class="land" style="height:${H}px"><svg class="trail" viewBox="0 0 100 ${H}" preserveAspectRatio="none" aria-hidden="true"><path d="${trail}"/></svg>${deco}${nodes}</div>
  </section>`;
}
function openMap(){
  const L=$('mapLayer'); L.classList.remove('has-sheet');
  const blocks=ISLANDS.slice().reverse().map((isl,k)=>islandBlock(isl,k)).join('<div class="sea-gap" aria-hidden="true"><span>⛵</span></div>');
  showLayer('mapLayer',`<div class="map-head"><div><span class="en">Level Islands</span><h2>關卡島地圖</h2></div><div class="map-btns"><button class="chip" id="mapMiss">📕 錯題洞窟${missActive().length?' '+missActive().length:''}</button><button class="chip" id="mapClose">✕ 返回</button></div></div>
   <div class="map-world">
     <div class="soon"><span class="fog">?</span><span class="plate"><b>下一座島</b><small>新的單字表出現時開放</small></span></div>
     <div class="sea-gap" aria-hidden="true"><span>🐋</span></div>
     ${blocks}
     <div class="map-foot">點島上的圓圈就能挑戰那一關，過關的可以重玩拿三顆星。</div>
   </div>
   <div id="isleSheet"></div>`);
  L.querySelector('#mapClose').onclick=()=>{SFX.tap();L.hidden=true;};
  L.querySelector('#mapMiss').onclick=()=>{SFX.tap();openMiss();};
  L.querySelectorAll('.node').forEach(b=>b.onclick=()=>{SFX.tap();openStage(b.dataset.id,+b.dataset.i);});
  const tgt=L.querySelector('.island.cur .node.next')||L.querySelector('.node.next')||L.querySelector('.island.cur'); if(tgt) tgt.scrollIntoView({block:'center'});
}
function openStage(id,i){
  const isl=islandById(id), s=isl&&isl.stages[i-1]; if(!s) return; const box=$('isleSheet'), L=$('mapLayer'), st=starsOf(s);
  ensureEnemy(s.enemy);   // 點開關卡就先載怪物，按開始的時候比較不用等
  const closeSheet=()=>{ box.innerHTML=''; L.classList.remove('has-sheet'); L.querySelectorAll('.node.sel').forEach(x=>x.classList.remove('sel')); };
  closeSheet();
  box.innerHTML=`<div class="sheet"><div class="qhead"><span class="speaker">${esc(isl.icon)} ${esc(isl.week)}・${esc(isl.name)}</span><span class="qcount">${esc(s.chapter)}・${esc(s.topic)}</span></div>
   <div class="stage-title"><b>${esc(s.place)}</b><span class="s">${'★'.repeat(st)}${'☆'.repeat(3-st)}</span></div>
   ${s.exam?`<div class="say" style="font-size:15px">對手是 <em>${esc(s.enemyName)}</em>。${esc(s.desc||'')}</div>
   <div class="note">試煉模式：怪物有 ${s.hp} 滴血，題目會一直出到打倒為止。四人接力出招、答得快傷害 ＋1、連續 6 題發動四人合體技${s.charge?'；魔王會蓄力放大招，用必殺技可以打斷':''}。</div>`
   :`<div class="say" style="font-size:15px">${s.boss?`小王 <em>${esc(s.enemyName)}</em> 出<em>綜合題</em>：這座島每一章的單字${isl.phrases.length?'，加上片語題，':'和片語'}全部混在一起考。小王的血比較厚，還會蓄力放大招。`
     :`守關的是 <em>${esc(s.enemyName)}</em>。這一關有 ${s.words.length} 個單字：<em>${esc(s.words.map(w=>w.en).join(', '))}</em>`}</div>`}
   <button class="cta ember" id="stageGo">${st?'再挑戰一次':'開始挑戰'} ▸</button>
   <div class="row"><button class="ghost" id="isleBook">📖 ${isl.review?'考試範圍的圖鑑':'這座島的圖鑑'}</button><button class="ghost" id="isleClose">關閉</button></div></div>`;
  box.querySelector('#stageGo').onclick=()=>{ac();SFX.tap();startAt(isl.id,i);};
  box.querySelector('#isleBook').onclick=()=>{SFX.tap();openBook(isl.id);};
  box.querySelector('#isleClose').onclick=()=>{SFX.tap();closeSheet();};
  L.classList.add('has-sheet'); const btn=L.querySelector(`.node[data-id="${isl.id}"][data-i="${i}"]`);
  if(btn){ btn.classList.add('sel'); btn.scrollIntoView({block:'start',behavior:reduce?'auto':'smooth'}); }
}

/* ================= 單字圖鑑 ================= */
function openBook(id){
  if(!id&&ISL.miss) return openMiss();   // 在錯題洞窟裡按圖鑑，看的是錯題本
  const B=islandById(id)||ISL, days=B.stages.filter(s=>!s.boss), seen=w=>save.seen[islOf(w).id+'/'+w.en];
  if(B.review){   // 複習考島沒有自己的單字，指到考試範圍的那幾座島
    const tabs=`<div class="tabs">${ISLANDS.slice().reverse().map(x=>`<button class="tab" data-id="${esc(x.id)}" aria-pressed="${x===B}">${esc(x.icon)} ${esc(x.week)}</button>`).join('')}</div>`;
    const L=showLayer('bookLayer',`<div class="sheet book-sheet"><div class="qhead"><span class="speaker">單字圖鑑・${esc(B.week)} ${esc(B.name)}</span><span class="qcount">${B.words.filter(seen).length} / ${B.words.length} 已救回</span></div>${tabs}
      <div class="say" style="font-size:15px">複習考的範圍是下面這幾座島的單字和片語，點進去就能看、能聽。</div>
      <div class="stages">${B.sources.map(x=>`<button class="stage-btn" data-id="${esc(x.id)}"><span class="d">${esc(x.icon)}<br>${esc(x.week)}</span><span>${esc(x.name)}<br><small>${x.words.length} 個單字${x.phrases.length?'、'+x.phrases.length+' 句片語':''}</small></span><span class="s">${x.words.filter(seen).length} / ${x.words.length}</span></button>`).join('')}</div>
      <button class="cta" id="closeBook">關閉圖鑑</button></div>`);
    L.querySelectorAll('.tab,.stage-btn').forEach(b=>b.onclick=()=>{SFX.tap();openBook(b.dataset.id);});
    L.querySelector('#closeBook').onclick=()=>{SFX.tap();L.hidden=true;};
    return;
  }
  const tabs=ISLANDS.length>1?`<div class="tabs">${ISLANDS.slice().reverse().map(x=>`<button class="tab" data-id="${esc(x.id)}" aria-pressed="${x===B}">${esc(x.icon)} ${esc(x.week)}</button>`).join('')}</div>`:'';
  const L=showLayer('bookLayer',`<div class="sheet book-sheet"><div class="qhead"><span class="speaker">單字圖鑑・${esc(B.week)} ${esc(B.name)}</span><span class="qcount">${B.words.filter(seen).length} / ${B.words.length} 已救回</span></div>${tabs}
   ${days.map(s=>`<div class="book-day">${esc(s.chapter)} ${esc(s.topic)}・${esc(s.place)}</div><div class="book">${s.words.map(w=>`<div class="card${seen(w)?'':' locked'}"><span class="e">${w.img?`<img src="${B.base}img/${w.img}.webp" alt="">`:w.e}</span><span class="t"><b>${esc(w.en)}</b><span>${w.pos} ${esc(w.zh)}</span></span><button class="speak" data-say="${esc(sayOf(w))}" aria-label="唸 ${esc(w.en)}">🔊</button></div>`).join('')}</div>`).join('')}
   ${B.phrases.length?`<div class="book-day">Weekly Phrases 每週片語</div>${B.phrases.map(p=>`<div class="phr"><div><b>${esc(p.en)}</b><span>${esc(p.zh)}</span><i>${esc(p.ex)}</i></div><button class="speak" data-say="${esc(p.ex)}" aria-label="唸例句">🔊</button></div>`).join('')}`:''}
   <div class="credits">${B.credits?esc(B.credits):''}3D 角色與場景：KayKit by Kay Lousberg（CC0）；可愛怪物：Quaternius（CC0）。</div>
   <button class="cta" id="closeBook">關閉圖鑑</button></div>`);
  L.querySelectorAll('[data-say]').forEach(b=>b.onclick=()=>say(b.dataset.say,B));
  L.querySelectorAll('.tab').forEach(b=>b.onclick=()=>{SFX.tap();openBook(b.dataset.id);});
  L.querySelector('#closeBook').onclick=()=>{SFX.tap();L.hidden=true;};
}

/* ================= 錯題本（錯題洞窟的入口） ================= */
function openMiss(){
  const all=missEntries(), act=all.filter(x=>x.m.ok<MISS_OK), ok=all.filter(x=>x.m.ok>=MISS_OK), total=all.reduce((n,x)=>n+x.m.n,0), nGo=Math.min(MISS_MAX,Math.max(act.length,Math.min(MISS_MIN,all.length)));
  const row=x=>{ const o=x.w||x.p, ty=topType(x.m), done=x.m.ok>=MISS_OK;
    return `<li class="${done?'done':''}" data-say="${esc(x.w?sayOf(x.w):phTokens(x.p).join(' '))}" data-isl="${esc(x.isl.id)}"><span class="no">${x.w?esc(x.w.e):'📜'}</span>
      <span class="who"><b>${esc(o.en)}</b><small>${esc(o.zh)}</small><small>${esc(x.isl.week)}${ty?'・最常錯在「'+esc(TYPE_ZH[ty]||ty)+'」':''}</small></span>
      <span class="pts">錯 <b>${x.m.n}</b> 次<small>${done?'✓ 已掌握':'再答對 '+(MISS_OK-x.m.ok)+' 次'}</small></span></li>`; };
  const L=showLayer('missLayer',`<div class="sheet book-sheet"><div class="qhead"><span class="speaker">📕 錯題洞窟</span><span class="qcount">特別關卡・不分單元</span></div>
   <div class="say" style="font-size:15px">答錯過的單字和片語都會記在這裡，不分哪一週。進洞窟把它們再答一次；同一題<em>連續答對 ${MISS_OK} 次</em>就算掌握，之後不會再出現在洞窟裡。洞窟是複習用的，勇者不會升級。</div>
   <div class="stats"><div><b>${act.length}</b>待複習</div><div><b>${ok.length}</b>已掌握</div><div><b>${total}</b>累計答錯次數</div></div>
   ${busy?'':act.length?`<button class="cta ember two" id="missGo">進洞窟複習 ▸<small>這一輪 ${nGo} 題・錯最多次的先出</small></button>`
     :`<div class="note">${all.length?'錯題全部掌握了！之後再答錯，洞窟會重新打開。':'目前沒有錯題。在關卡裡答錯的題目會自動記到這裡。'}</div>`}
   ${act.length?`<div class="book-day">待複習・錯越多次排越前面</div><ol class="rank miss">${act.map(row).join('')}</ol>`:''}
   ${ok.length?`<div class="book-day">已經掌握</div><ol class="rank miss">${ok.map(row).join('')}</ol>`:''}
   <button class="cta" id="missClose">關閉</button></div>`);
  L.querySelector('#missClose').onclick=()=>{SFX.tap();L.hidden=true;};
  L.querySelectorAll('[data-say]').forEach(b=>b.onclick=()=>say(b.dataset.say,NORMAL[b.dataset.isl]));
  const go=L.querySelector('#missGo'); if(go) go.onclick=()=>{ac();SFX.tap();startAt('miss',1);};
}

/* ================= 排行榜 ================= */
async function openRank(){
  const shell=body=>`<div class="sheet book-sheet"><div class="qhead"><span class="speaker">🏆 排行榜</span><span class="qcount">過關數最多的勇者</span></div>${body}<button class="cta" id="closeRank">關閉</button></div>`;
  const bind=L=>{ L.querySelector('#closeRank').onclick=()=>{SFX.tap();L.hidden=true;}; const g=L.querySelector('#rankLogin'); if(g) g.onclick=()=>{SFX.tap();openAccount();}; const r=L.querySelector('#rankRetry'); if(r) r.onclick=()=>{SFX.tap();openRank();}; };
  if(!cloud.state.enabled){ bind(showLayer('rankLayer',shell('<div class="say" style="font-size:15px">排行榜還沒開放。</div>'))); return; }
  bind(showLayer('rankLayer',shell('<div class="say" style="font-size:15px;text-align:center">正在翻排行榜…</div>')));
  let rows; try{ rows=await cloud.fetchBoard(); }catch(e){ console.error(e);
    bind(showLayer('rankLayer',shell('<div class="say" style="font-size:15px">排行榜讀不到，請確認網路後再試一次。</div><button class="ghost" id="rankRetry">重新整理</button>'))); return; }
  if($('rankLayer').hidden) return;
  const me=cloud.state.user?.uid, pg=progress(), medal=['🥇','🥈','🥉'];
  const list=rows.length?`<ol class="rank">${rows.map((r,k)=>`<li class="${r.uid===me?'me':''}"><span class="no">${medal[k]||k+1}</span><span class="who"><b>${esc(r.name)}</b><small>${esc((HEROES.find(h=>h.id===r.hero)||HEROES[0]).name)} Lv${r.lv|0}${r.uid===me?' · 你':''}</small></span><span class="pts"><b>${r.cleared|0}</b> 關<small>★ ${r.stars|0}</small></span></li>`).join('')}</ol>`
    :'<div class="say" style="font-size:15px;text-align:center">還沒有人上榜，第一名等你來拿！</div>';
  let foot;
  if(!me) foot=`<div class="note">登入 Google 之後，你的過關數就會出現在排行榜上，換手機、平板也能接著玩。</div><button class="cta ember" id="rankLogin">登入上榜</button>`;
  else if(!pg.cleared) foot=`<div class="note">過了第一關就會上榜。</div>`;
  else if(!rows.some(r=>r.uid===me)) foot=`<div class="note">你目前過了 ${pg.cleared} 關，還沒進前 ${rows.length} 名，再加油！</div>`;
  else foot=`<div class="note">排名看過關數，過關數一樣就比星星。只會顯示暱稱。</div>`;
  bind(showLayer('rankLayer',shell(list+foot+'<button class="ghost" id="rankRetry">重新整理</button>')));
}

/* ================= 帳號（Google 登入、暱稱） ================= */
const randomName=()=>['勇敢','閃電','機智','快樂','神秘','無敵'][Math.random()*6|0]+HEROES[save.hero].name+(100+Math.random()*900|0);
function openAccount(msg){
  if(!cloud.state.enabled) return;
  const u=cloud.state.user, sheet=body=>`<div class="sheet book-sheet"><div class="qhead"><span class="speaker">☁ 存進度與排行榜</span></div>${body}</div>`;
  if(!u){
    const inapp=cloud.inAppBrowser();
    const L=showLayer('acctLayer',sheet(`<div class="say" style="font-size:15px">用 Google 登入之後，過關紀錄會存在雲端，換手機、平板、電腦都能接著玩，也能參加排行榜。</div>
      <div class="note">排行榜只會顯示你自己取的暱稱，不會顯示 Google 姓名或信箱。</div>
      ${inapp?`<div class="feedback no">你現在是在 ${esc(inapp)} 裡面開的網頁，Google 不讓這種視窗登入。請點右上角選單，改用 Safari 或 Chrome 開啟。</div>`:''}
      ${msg?`<div class="feedback no">${esc(msg)}</div>`:''}
      <button class="cta gbtn" id="gLogin"><b>G</b> 使用 Google 登入</button>
      ${inapp==='LINE'?'<a class="ghost linkbtn" id="openExt" href="#">改用瀏覽器開啟</a>':''}
      <button class="ghost" id="acctClose">先不要</button>`));
    L.querySelector('#acctClose').onclick=()=>{SFX.tap();L.hidden=true;};
    const ext=L.querySelector('#openExt'); if(ext){ const url=new URL(location.href); url.searchParams.set('openExternalBrowser','1'); ext.href=url.href; }
    L.querySelector('#gLogin').onclick=async e=>{ SFX.tap(); const b=e.currentTarget; b.disabled=true; b.textContent='正在開啟 Google 登入…';
      try{ await cloud.signIn(); }catch(err){ console.error(err); openAccount(cloud.errorText(err)); } };
    return;
  }
  const first=!save.name;
  const L=showLayer('acctLayer',sheet(`<div class="say" style="font-size:15px">${first?'登入成功！先幫自己取一個排行榜暱稱。':'已登入，進度會自動存到雲端。'}</div>
    <div class="note">登入帳號：${esc(u.email||'Google 帳號')}（只有你自己看得到）</div>
    <label class="field"><span>排行榜暱稱（最多 12 個字，不要用真實姓名）</span><input id="nick" maxlength="12" autocomplete="off" value="${esc(save.name||randomName())}"></label>
    ${msg?`<div class="feedback no">${esc(msg)}</div>`:''}
    <button class="cta ember" id="nickSave">${first?'用這個暱稱開始':'儲存暱稱'}</button>
    <div class="row"><button class="ghost" id="acctOut">登出</button>${first?'':'<button class="ghost" id="acctClose">關閉</button>'}</div>`));
  const done=()=>{ L.hidden=true; if(atHome) renderHome(); };
  L.querySelector('#nickSave').onclick=()=>{ SFX.tap(); const v=L.querySelector('#nick').value.trim().replace(/\s+/g,' ').slice(0,12);
    if(!v){ openAccount('暱稱不能空白。'); return; } save.name=v; persist(); cloud.flush(); done(); };
  const c=L.querySelector('#acctClose'); if(c) c.onclick=()=>{SFX.tap();done();};
  L.querySelector('#acctOut').onclick=async()=>{ SFX.tap(); await cloud.signOut(); L.hidden=true; };
}
// 雲端 → 遊戲：登入、登出、別的裝置有新進度時，把存檔換掉並重畫畫面
function applySave(next){
  save=fixSave(next); persistLocal();
  heroes.forEach((_,k)=>applyWear(k)); fixHero();
  if(!busy){ useIsland(save.island); heroes.forEach((_,k)=>applyLevelLook(k)); if(atHome){ placeSelectLineup(); hero=heroes[save.hero]; heroDef=HEROES[save.hero]; hero.pos.z=CZ(0)+.5; renderHome(); } }
}
function boardEntry(){ const pg=progress(), h=HEROES[save.hero]; return {name:save.name,cleared:pg.cleared,stars:pg.stars,hero:h.id,lv:lvOf(h.id)}; }

/* ================= 啟動 ================= */
async function start(){
  try{ await loadAll(); }catch(err){ $('loadMsg').textContent='素材載入失敗，請重新整理頁面。（'+(err&&err.message||err)+'）'; console.error(err); return; }
  $('loadMsg').textContent='點亮火把中…';
  buildDungeon();
  heroes=HEROES.map(h=>new Actor(G[h.id],{idle:'Idle'})); heroes.forEach((h,k)=>{addRing(h);applyLevelLook(k);initGear(k);}); heroes.forEach((_,k)=>applyWear(k));
  arrowProto=G.Ranger.scene.getObjectByName('Arrow'); if(arrowProto){ arrowProto.removeFromParent(); arrowProto.visible=false; }   // 箭的原型：平常不顯示，要射的時候複製
  fixHero();
  for(const m of ENEMY_MODELS){ const e=new Actor(G[m],{idle:'Idle_Combat'}); e.root.visible=false; enemies[m]=e; }
  placeSelectLineup(); hero=heroes[save.hero]; heroDef=HEROES[save.hero]; hero.pos.z=CZ(0)+.5;
  panelH=0; resize(); const [tp,tl]=camTargets(); camPos.copy(tp); camLook.copy(tl);
  requestAnimationFrame(loop);
  renderHome();
  setTimeout(()=>{$('loader').style.transition='opacity .5s';$('loader').style.opacity=0;setTimeout(()=>$('loader').hidden=true,520);},150);
  cloud.init({
    getSave:()=>save, blankSave, fixSave, applySave, boardEntry,
    onUser:(u,{needName})=>{ if(atHome) renderHome(); if(u&&needName&&!busy) openAccount(); else if(!$('acctLayer').hidden) $('acctLayer').hidden=true; },
  });
}
start();
