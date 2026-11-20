// 複習考島：Test One（Unit 1 – 3）
// 這座島沒有自己的單字，題目從 u1、u2、u3 抽。欄位說明見 islands/README.md 的「複習考島」。

const stages=[
 {id:'g1',chapter:'第一關',topic:'Unit 1',place:'考官・Unit 1',from:['u1'],hp:20,
  enemy:'Skeleton_Warrior',scale:1.25,enemyName:'Unit 1 考官',color:0x5ed0c9,
  desc:"只考 Unit 1：美勞用品，加上 How much / How many、a little / a few。",
  taunt:'Test One 第一關！<em>paintbrushes</em>、<em>tissues</em> 怎麼拼？<em>a little</em> 還是 <em>a few</em>？',
  hero:'勇者小隊集合！一人打一下，輪流接力！'},
 {id:'g2',chapter:'第二關',topic:'Unit 2',place:'考官・Unit 2',from:['u2'],hp:20,
  enemy:'Skeleton_Rogue',scale:1.25,enemyName:'Unit 2 考官',color:0xff7ad9,
  desc:'只考 Unit 2：夜市和五感，加上 It tastes… / They look…',
  taunt:'第二關換我！<em>stinky tofu</em>、<em>feel hard</em>，還有 <em>because it tastes</em>……你記得嗎？',
  hero:'答得越快，打得越痛！'},
 {id:'g3',chapter:'第三關',topic:'Unit 3',place:'考官・Unit 3',from:['u3'],hp:20,
  enemy:'Skeleton_Minion',scale:1.3,enemyName:'Unit 3 考官',color:0x8fe06b,
  desc:'只考 Unit 3：昨天做了什麼，加上過去式。',
  taunt:'第三關！<em>washed my hands</em>、<em>mopped the bathroom</em>、<em>drank juice</em>，過去式別寫錯！',
  hero:'連續答對 6 題，就讓你看看四人合體技！'},
 {id:'final',chapter:'最終關',topic:'Unit 1 – 3',place:'Test One 大魔王',label:'大魔王・三階段',boss:1,hp:42,charge:4,
  enemy:'Skeleton_Mage',scale:1.5,enemyName:'Test One 大魔王',color:0x5ed0c9,
  phases:[
   {from:['u1'],name:'Unit 1',color:0x5ed0c9,scale:1.5},
   {from:['u2'],name:'Unit 2',color:0xff7ad9,scale:1.65},
   {from:['u3'],name:'Unit 3',color:0xff5c5c,scale:1.8},
  ],
  desc:'三個階段，一個階段考一課。魔王會蓄力，蓄滿就放大招「考卷風暴」。',
  taunt:'我就是<em>Test One 大魔王</em>！三課的單字和句子，我分三個階段考你！',
  hero:'連續答對 3 題發動必殺技，就能打斷你的蓄力。大家上！'},
];

export default {
  id:'t1', review:true, from:['u1','u2','u3'],
  name:'Test One 試煉島', week:'複習考', klass:'', dates:'Unit 1 – 3',
  icon:'🌋', color:'#ff5c5c',
  rules:'<em>四人接力</em>：答對一題，換下一位勇者出招，小隊的愛心也多 3 顆。<br><em>快答加成</em>：在時間條跑完前答對，傷害 ＋1；答慢了也沒關係，不會扣分。<br>連續答對 3 題發動<em>必殺技</em>，連續答對 6 題發動<em>四人合體技</em>。',
  bossRules:'<br><em>魔王蓄力</em>：每出一題蓄一格，蓄滿 4 格放大招。發動必殺技或合體技可以把蓄力打斷。',
  stages,
};
