// 關卡島範本：複製整個 _template 資料夾，改名成島的代號（例：w12），再改下面的內容。
// 完整說明見 islands/README.md

const words=[
  // en 英文、zh 中文、pos 詞性、e 代表的 emoji、d 屬於哪一關（對應下面 stages 的 id）
  // 選填：opp 相反詞（要成對寫）、img 圖片檔名（放 img/xxx.webp，不用寫副檔名）
  {en:'big',zh:'大的',pos:'adj.',e:'🐘',d:'s1',opp:'small'},
  {en:'small',zh:'小的',pos:'adj.',e:'🐜',d:'s1',opp:'big'},
  {en:'apple',zh:'蘋果',pos:'n.',e:'🍎',d:'s2'},
];

// 意思太接近、不適合互相當干擾選項的單字（沒有就留空陣列）。一組寫一個陣列，裡面放英文（跟 en 一模一樣）：
//   const conflict=[['big','large'], ['feed','take care of']];
// 出 big 的選擇題時，large 就不會被拿來當錯的選項
const conflict=[];

// 每週片語（沒有就留空陣列）。ex 例句要完整、真的有用到這句片語，聽力題和排句子題會用它。
// 自動拆的句子不理想時加 sents:['要用的句子'] 直接指定（例如對話只用問句那一句）
const phrases=[
  {en:'be good at',zh:'擅長…',ex:'She is good at drawing.'},
];
const PH_ZH=phrases.map(p=>p.zh);   // 只是給下面 bossQ 的範例用的；bossQ 留空的話這行可以刪

// 手寫的片語題（選填，可以留空陣列）。遊戲本來就會從 phrases 自動出題，
// 這裡放自動出不來的：文法填空、情境對話、附中文的句子排列。p = 對應第幾句片語（從 0 算）
// kind:'mc' 選擇題（en:1 表示題目是英文句子）、kind:'order' 句子排列
const bossQ=[
  {p:0,kind:'mc',label:'片語意思',prompt:'be good at',say:'be good at',opts:[PH_ZH[0],'喜歡…','害怕…','忘記…'],a:PH_ZH[0],hint:'be good at ＝ 擅長…'},
  {p:0,kind:'mc',label:'句子填空',en:1,prompt:'She is good ___ drawing.',say:'She is good at drawing.',opts:['at','in','on','of'],a:'at',hint:'be good at ＋ 擅長的事。'},
  {p:0,kind:'order',label:'句子排列',words:['She','is','good','at','drawing.'],zh:'她很擅長畫畫。'},
];

// 關卡：id 對應單字的 d（取有意義的短名字，例如 'animals'；上線後不要改）。最後一關寫 boss:1，就是出綜合題的小王
// chapter 是第幾章、topic 是這一關的主題（兩個會一起顯示在選關畫面）、place 是地點名稱、enemyName 是怪物的名字，都可以自由發揮
// enemy 可用：骷髏 Skeleton_Minion、Skeleton_Rogue、Skeleton_Warrior、Skeleton_Mage（小王建議用這隻），
//   或可愛怪物 Alien、Alien_Tall、Cactus、Crab、Cyclops、Deer、Demon、Ghost、GreenDemon、Panda、Skull、Tree、Yeti、Bat、Bee、YellowDragon
// color 是那一關房間的燈光顏色；taunt 是怪物的話、hero 是勇者回的話，<em>單字</em> 會變色
const stages=[
 {id:'s1',chapter:'第一章',topic:'大小',place:'巨人走廊',enemy:'Skeleton_Minion',enemyName:'小兵',color:0xffa54a,
  taunt:'這裡什麼是<em>big</em>、什麼是<em>small</em>，你分得出來嗎？',
  hero:'當然分得出來！'},
 {id:'s2',chapter:'第二章',topic:'食物',place:'水果倉庫',enemy:'Skeleton_Rogue',enemyName:'偷吃盜賊',color:0x5ed0c9,
  taunt:'<em>apple</em> 都是我的！',
  hero:'還給大家！'},
 {id:'boss',chapter:'終章',topic:'綜合題',place:'骷髏法師王座',enemy:'Skeleton_Mage',enemyName:'骷髏法師王',color:0xb26bff,boss:1,
  taunt:'最後的封印是這一週<em>所有的單字</em>和<em>片語</em>！',
  hero:'我都練過了，放馬過來！'},
];

// 發音檔對照表。先留空物件就能玩（用瀏覽器語音）；
// 跑過 tools/make_audio.py 之後，把下面這行換成：import audio from './audio.js';（import 要移到檔案最上面）
const audio={};

export default {
  id:'w12',            // 島的代號，要跟資料夾名稱一樣；上線後不要改（存檔用它認關卡）
  name:'新島嶼',        // 島名
  week:'Week 12',      // 地圖上顯示在島名前面的標題。不是照週次教的話寫 'Unit 1'、'第一課' 都可以
  klass:'', dates:'11/16 – 11/20',   // dates：日期或範圍，選填，不需要就留空字串 ''。klass：班級，選填，會顯示在地圖的島名牌上。專案是公開的，不建議填真實的班級
  icon:'🏝️', color:'#5ed0c9',
  boss:{words:8, phrases:6},   // 小王綜合題：抽幾個單字、幾題片語。寫多了沒關係，單字不夠就全部出、片語出得了幾題就幾題（一句片語大約能變出 4 種問法）；沒有片語就寫 phrases:0
  words, conflict, phrases, bossQ, stages, audio,
  credits:'',          // 圖片出處（沒有用圖片就留空）
};
