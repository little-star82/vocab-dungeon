// 關卡島：Unit 1 Let's Make…（美勞用品）
// 欄位說明見 islands/README.md

const words=[
 // 第一章：顏色＋材料
 {en:'silver stars',zh:'銀色星星',pos:'n.',e:'⭐',d:'craft'},
 {en:'brown tape',zh:'褐色膠帶',pos:'n.',e:'🟫',d:'craft'},
 {en:'purple yarn',zh:'紫色毛線',pos:'n.',e:'🧶',d:'craft'},
 {en:'red glitter',zh:'紅色亮粉',pos:'n.',e:'✨',d:'craft'},
 {en:'orange paint',zh:'橘色顏料',pos:'n.',e:'🎨',d:'craft'},
 {en:'gold stickers',zh:'金色貼紙',pos:'n.',e:'🌟',d:'craft'},
 {en:'green paper',zh:'綠色色紙',pos:'n.',e:'📗',d:'craft'},
 {en:'gray clay',zh:'灰色黏土',pos:'n.',e:'🪨',d:'craft'},
 // 第二章：文具工具
 {en:'tissues',zh:'面紙',pos:'n.',e:'🧻',d:'tools'},
 {en:'glue',zh:'膠水',pos:'n.',e:'🧴',d:'tools'},
 {en:'blue chalk',zh:'藍色粉筆',pos:'n.',e:'🖍️',d:'tools'},
 {en:'colored pencils',zh:'色鉛筆',pos:'n.',e:'✏️',d:'tools'},
 {en:'paintbrushes',zh:'水彩筆',pos:'n.',e:'🖌️',d:'tools'},
 {en:'staplers',zh:'訂書機',pos:'n.',e:'📎',d:'tools'},
 {en:'scissors',zh:'剪刀',pos:'n.',e:'✂️',d:'tools'},
 {en:'yellow straws',zh:'黃色吸管',pos:'n.',e:'🥤',d:'tools'},
 // 句型（課本 Grammar）
 {en:"What do you need?",zh:'你需要什麼？',pos:'句型',e:'❓',d:'grammar'},
 {en:"I need some blue chalk.",zh:'我需要一些藍色粉筆。',pos:'句型',e:'🖍️',d:'grammar'},
 {en:"How much purple yarn is there?",zh:'有多少紫色毛線？',pos:'句型',e:'🧶',d:'grammar'},
 {en:"There is a lot of purple yarn.",zh:'有很多紫色毛線。',pos:'句型',e:'🧶',d:'grammar'},
 {en:"There is only a little orange paint.",zh:'只有一點點橘色顏料。',pos:'句型',e:'🎨',d:'grammar'},
 {en:"How many silver stars are there?",zh:'有多少銀色星星？',pos:'句型',e:'⭐',d:'grammar'},
 {en:"There are a lot of silver stars.",zh:'有很多銀色星星。',pos:'句型',e:'🌟',d:'grammar'},
 {en:"There are only a few silver stars.",zh:'只有幾顆銀色星星。',pos:'句型',e:'✨',d:'grammar'},
 // 會話（課本 Conversation）
 {en:"Look at all these sticks.",zh:'看看這些攪拌棒。',pos:'會話',e:'🥢',d:'talk'},
 {en:"Let's make something with them.",zh:'我們用這些來做東西吧。',pos:'會話',e:'🛠️',d:'talk'},
 {en:"How about a picture frame?",zh:'做相框怎麼樣？',pos:'會話',e:'🖼️',d:'talk'},
 {en:"That sounds boring.",zh:'聽起來很無趣。',pos:'會話',e:'🥱',d:'talk'},
 {en:"It'll look cool after we decorate it.",zh:'等我們裝飾好就會看起來很酷。',pos:'會話',e:'😎',d:'talk'},
 {en:"How much stuff do you think we need?",zh:'妳認為我們需要多少材料？',pos:'會話',e:'🤔',d:'talk'},
];

const conflict=[['orange paint','paintbrushes'],['silver stars','gold stickers']];

const phrases=[
 {en:'need some',zh:'需要一些',ex:'What do you need? I need some blue chalk.',sents:['I need some blue chalk.']},
 {en:'how much',zh:'有多少（數不完的東西）',ex:'How much purple yarn is there? How much orange paint is there?'},
 {en:'how many',zh:'有多少（數得出來的東西）',ex:'How many silver stars are there?'},
 {en:'a lot of',zh:'很多',ex:'There is a lot of purple yarn. There are a lot of silver stars.'},
 {en:'only a little',zh:'只有一點點（數不完的東西）',ex:'There is only a little orange paint.'},
 {en:'only a few',zh:'只有幾個（數得出來的東西）',ex:'There are only a few silver stars.'},
];

// 手寫題：特別練 Test One 錯過的地方（a little / a few、much / a lot of、is / are）
const bossQ=[
 {p:4,kind:'mc',label:'句子填空',en:1,prompt:'How much red glitter is there?\nThere is ___ red glitter.',say:'There is only a little red glitter.',opts:['only a little','only a few','many','a few'],a:'only a little',hint:'glitter 亮粉數不完，用 a little。是 There is only a little，only 要放在 a little 前面。'},
 {p:4,kind:'order',label:'句子排列',words:['There','is','only','a','little','red','glitter.'],zh:'只有一點點紅色亮粉。'},
 {p:5,kind:'mc',label:'句子填空',en:1,prompt:'How many gold stickers are there?\nThere are ___ gold stickers.',say:'There are only a few gold stickers.',opts:['only a few','only a little','much','a little'],a:'only a few',hint:'stickers 貼紙可以一張一張數，用 a few。'},
 {p:5,kind:'order',label:'句子排列',words:['There','are','only','a','few','gold','stickers.'],zh:'只有幾張金色貼紙。'},
 {p:1,kind:'mc',label:'much 還是 many？',en:1,prompt:'How ___ purple yarn is there?',say:'How much purple yarn is there?',opts:['much','many'],a:'much',hint:'yarn 毛線數不完 → How much。'},
 {p:2,kind:'mc',label:'much 還是 many？',en:1,prompt:'How ___ silver stars are there?',say:'How many silver stars are there?',opts:['many','much'],a:'many',hint:'stars 可以一顆一顆數（有 s）→ How many。'},
 {p:3,kind:'mc',label:'句子填空',en:1,prompt:'Do Chuck and Paul have ___ ice cream?',say:'Do Chuck and Paul have much ice cream?',opts:['much','a lot of'],a:'much',hint:'問句、否定句用 much。'},
 {p:3,kind:'mc',label:'句子填空',en:1,prompt:'Yes, they have ___ ice cream.',say:'Yes, they have a lot of ice cream.',opts:['a lot of','much'],a:'a lot of',hint:'肯定句說「很多」用 a lot of。'},
 {p:3,kind:'mc',label:'is 還是 are？',en:1,prompt:'There ___ a lot of purple yarn.',say:'There is a lot of purple yarn.',opts:['is','are'],a:'is',hint:'yarn 數不完，當單數 → There is。'},
 {p:3,kind:'mc',label:'is 還是 are？',en:1,prompt:'There ___ a lot of silver stars.',say:'There are a lot of silver stars.',opts:['are','is'],a:'are',hint:'stars 是很多顆 → There are。'},
 {p:0,kind:'mc',label:'情境對話',en:1,prompt:'A: What do you need?\nB: ______',say:'What do you need? I need some blue chalk.',opts:['I need some blue chalk.','There is a lot of glue.','It tastes salty.','I need a blue chalks.'],a:'I need some blue chalk.',hint:'What do you need? → I need some …'},
];

const stages=[
 {id:'craft',chapter:'第一章',topic:'彩色材料',place:'亂七八糟美勞教室',enemy:'Bee',enemyName:'亮粉蜜蜂',color:0xffa54a,
  taunt:'嗡嗡～我把<em>red glitter</em>和<em>silver stars</em>撒得到處都是！你叫得出它們的英文嗎？',
  hero:'當然！我一個一個把它們收回來！'},
 {id:'tools',chapter:'第二章',topic:'文具工具',place:'文具櫃迷宮',enemy:'Skeleton_Rogue',enemyName:'偷文具盜賊',color:0x5ed0c9,
  taunt:'<em>scissors</em>、<em>glue</em>、<em>paintbrushes</em>……全部被我偷走啦！',
  hero:'說出它們的英文，就能把文具拿回來！'},
 {id:'grammar',chapter:'第三章',topic:'句型',place:'句型工坊',enemy:'Cyclops',enemyName:'數數獨眼怪',color:0xffd25e,
  taunt:'<em>How much</em>？<em>How many</em>？我只有一隻眼睛，數不清楚啦！你幫我說說看！',
  hero:'There are <em>a lot of</em> silver stars！'},
 {id:'talk',chapter:'第四章',topic:'會話',place:'做相框的桌子',enemy:'Tree',enemyName:'攪拌棒樹精',color:0x8fe06b,
  taunt:'<em>Look at all these sticks.</em> 這些攪拌棒都是我的樹枝！',
  hero:'<em>Let\'s make something with them!</em>'},
 {id:'boss',chapter:'終章',topic:'綜合題',place:'骷髏法師王座',enemy:'Skeleton_Mage',enemyName:'骷髏法師王',color:0xb26bff,boss:1,
  taunt:'<em>How much</em>？<em>How many</em>？<em>a little</em> 還是 <em>a few</em>？我最會讓人搞混了！',
  hero:'數不完用 much、a little，數得出來用 many、a few，我記住了！'},
];

const audio={};

export default {
  id:'u1', name:'美勞島', week:'Unit 1', klass:'', dates:"Let's Make…",
  icon:'🎨', color:'#5ed0c9',
  boss:{words:12, phrases:8},
  words, conflict, phrases, bossQ, stages, audio,
  credits:'',
};
