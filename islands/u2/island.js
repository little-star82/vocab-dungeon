// 關卡島：Unit 2 The Night Market（夜市・五感）
// 欄位說明見 islands/README.md

const words=[
 // 第一章：看起來、聽起來
 {en:'look mean',zh:'看起來刻薄',pos:'ph.',e:'😠',d:'looks',opp:'look friendly'},
 {en:'look friendly',zh:'看起來親切',pos:'ph.',e:'😊',d:'looks',opp:'look mean'},
 {en:'sound loud',zh:'聽起來大聲',pos:'ph.',e:'📢',d:'looks',opp:'sound quiet'},
 {en:'sound quiet',zh:'聽起來小聲',pos:'ph.',e:'🤫',d:'looks',opp:'sound loud'},
 {en:'feel soft',zh:'摸起來軟軟的',pos:'ph.',e:'🧸',d:'looks',opp:'feel hard'},
 {en:'feel hard',zh:'摸起來硬硬的',pos:'ph.',e:'🧱',d:'looks',opp:'feel soft'},
 // 第二章：嚐起來、聞起來
 {en:'taste sweet',zh:'嚐起來有甜味',pos:'ph.',e:'🍬',d:'tastes'},
 {en:'taste salty',zh:'嚐起來有鹹味',pos:'ph.',e:'🧂',d:'tastes'},
 {en:'smell great',zh:'聞起來很香',pos:'ph.',e:'😋',d:'tastes',opp:'smell gross'},
 {en:'smell gross',zh:'聞起來噁心',pos:'ph.',e:'🤢',d:'tastes',opp:'smell great'},
 {en:'stinky tofu',zh:'臭豆腐',pos:'n.',e:'🧀',d:'tastes'},
 // 第三章：夜市
 {en:'bread',zh:'麵包',pos:'n.',e:'🍞',d:'market'},
 {en:'soup',zh:'湯',pos:'n.',e:'🍲',d:'market'},
 {en:'popcorn',zh:'爆米花',pos:'n.',e:'🍿',d:'market'},
 {en:'music',zh:'音樂',pos:'n.',e:'🎵',d:'market'},
 {en:'vendor',zh:'小販',pos:'n.',e:'🧑‍🍳',d:'market'},
];

const conflict=[['smell great','taste sweet']];

const phrases=[
 {en:'how does … taste',zh:'…嚐起來如何？',ex:'How does the soup taste? It tastes salty.',sents:['How does the soup taste?']},
 {en:'they look',zh:'他們看起來…',ex:'How do the vendors look? They look friendly.',sents:['They look friendly.']},
 {en:'do you like',zh:'你喜歡…嗎？',ex:'Do you like sweet bread? Yes, I like sweet bread.',sents:['Do you like sweet bread?']},
 {en:"don't like",zh:'不喜歡',ex:"Do you like loud music? No, I don't like loud music.",sents:["No, I don't like loud music."]},
 {en:'because it',zh:'因為它…',ex:"I don't like it because it feels hard.",sents:["I don't like it because it feels hard."]},
 {en:'tastes like',zh:'嚐起來像…',ex:'Because it tastes like an eraser!',sents:['Because it tastes like an eraser!']},
];

// 手寫題：特別練 Test One 錯過的地方（because it tastes、It / They、tastes 要加 s）
const bossQ=[
 {p:4,kind:'order',label:'句子排列',words:['I','like','the','popcorn','because','it','tastes','sweet.'],zh:'我喜歡這個爆米花，因為它嚐起來甜甜的。'},
 {p:4,kind:'mc',label:'拼字檢查',en:1,prompt:'I like the popcorn ___ it tastes sweet.',say:'I like the popcorn because it tastes sweet.',opts:['because','becuase','becase','beacuse'],a:'because',hint:'because 的拼法：b-e-c-a-u-s-e。'},
 {p:4,kind:'mc',label:'taste 還是 tastes？',en:1,prompt:'I like the popcorn because it ___ sweet.',say:'I like the popcorn because it tastes sweet.',opts:['tastes','taste','tasty','tasted'],a:'tastes',hint:'主詞是 it（單數），動詞要加 s → it tastes。'},
 {p:4,kind:'mc',label:'It 還是 They？',en:1,prompt:'I like the bread. ___ feels soft.',say:'I like the bread. It feels soft.',opts:['It','They'],a:'It',hint:'bread 是一個東西 → It feels soft。'},
 {p:4,kind:'mc',label:'It 還是 They？',en:1,prompt:'I like the cookies. ___ feel soft.',say:'I like the cookies. They feel soft.',opts:['They','It'],a:'They',hint:'cookies 是很多個 → They feel soft（feel 不加 s）。'},
 {p:1,kind:'mc',label:'看圖回答',en:1,prompt:'How do the vendors look?\n（小販皺著眉頭在大叫 😠）',say:'How do the vendors look? They look mean.',opts:['They look mean.','They look friendly.','It looks mean.','They looks mean.'],a:'They look mean.',hint:'vendors 是很多人 → They look …；生氣大叫是 mean。'},
 {p:0,kind:'mc',label:'情境對話',en:1,prompt:'A: How does the soup taste?\nB: ______',say:'How does the soup taste? It tastes salty.',opts:['It tastes salty.','It taste salty.','They taste salty.','It sounds salty.'],a:'It tastes salty.',hint:'soup 是一碗 → It tastes …'},
 {p:3,kind:'mc',label:'情境對話',en:1,prompt:'A: Do you like loud music?\nB: No, ______',say:"Do you like loud music? No, I don't like loud music.",opts:["I don't like loud music.","I like loud music.","I doesn't like loud music.","it tastes loud."],a:"I don't like loud music.",hint:"No 開頭要用否定：I don't like …"},
 {p:5,kind:'mc',label:'會話理解',prompt:'Tim 為什麼不想吃熱狗？',say:'Because it tastes like an eraser!',opts:['因為它嚐起來像橡皮擦','因為它聞起來很香','因為它太燙了','因為他不餓'],a:'因為它嚐起來像橡皮擦',hint:'Because it tastes like an eraser! 因為它嚐起來像橡皮擦！'},
];

const stages=[
 {id:'looks',chapter:'第一章',topic:'看・聽・摸',place:'夜市入口',enemy:'Ghost',enemyName:'吵鬧小幽靈',color:0xff7ad9,
  taunt:'嘿嘿！我讓夜市一下<em>sound loud</em>、一下<em>sound quiet</em>，你分得清楚嗎？',
  hero:'看起來、聽起來、摸起來，我全都會說！'},
 {id:'tastes',chapter:'第二章',topic:'嚐・聞',place:'臭豆腐巷',enemy:'GreenDemon',enemyName:'臭臭綠魔',color:0x8fe06b,
  taunt:'這條巷子的<em>stinky tofu</em>是我的地盤！它到底<em>smell great</em>還是<em>smell gross</em>？',
  hero:'聞起來臭臭，吃起來香香！'},
 {id:'market',chapter:'第三章',topic:'夜市攤販',place:'夜市大街',enemy:'Panda',enemyName:'貪吃貓熊',color:0xffa54a,scale:1.15,
  taunt:'<em>popcorn</em>、<em>bread</em>、<em>soup</em>……夜市的東西我全部吃光光！',
  hero:'說對它們的英文，就叫<em>vendor</em>再做一份！'},
 {id:'boss',chapter:'終章',topic:'綜合題',place:'骷髏法師王座',enemy:'Skeleton_Mage',enemyName:'骷髏法師王',color:0xb26bff,boss:1,
  taunt:'It <em>tastes</em>？They <em>look</em>？<em>because</em> 怎麼拼？答錯就留在夜市吧！',
  hero:'一個東西用 It、很多個用 They，我都記住了！'},
];

const audio={};

export default {
  id:'u2', name:'夜市島', week:'Unit 2', klass:'', dates:'The Night Market',
  icon:'🏮', color:'#ff7ad9',
  boss:{words:8, phrases:8},
  words, conflict, phrases, bossQ, stages, audio,
  credits:'',
};
