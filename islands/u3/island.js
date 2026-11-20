// 關卡島：Unit 3 What Did You Do?（過去式）
// 欄位說明見 islands/README.md

const words=[
 // 第一章：在家做的事
 {en:'yesterday',zh:'昨天',pos:'adv.',e:'📅',d:'home'},
 {en:'washed my hands',zh:'洗我的手',pos:'ph.',e:'🧼',d:'home'},
 {en:'made breakfast',zh:'做早餐',pos:'ph.',e:'🍳',d:'home'},
 {en:'mopped the bathroom',zh:'拖浴室地板',pos:'ph.',e:'🧽',d:'home'},
 {en:'got up early',zh:'早起',pos:'ph.',e:'⏰',d:'home'},
 {en:'cleaned his bedroom',zh:'打掃他的臥房',pos:'ph.',e:'🛏️',d:'home'},
 {en:'cut his fingernails',zh:'剪他的指甲',pos:'ph.',e:'💅',d:'home'},
 {en:'drank juice',zh:'喝果汁',pos:'ph.',e:'🧃',d:'home'},
 // 第二章：休閒和學習
 {en:'this morning',zh:'今天早上',pos:'ph.',e:'🌅',d:'fun'},
 {en:'played the piano',zh:'彈鋼琴',pos:'ph.',e:'🎹',d:'fun'},
 {en:'studied for the test',zh:'準備考試',pos:'ph.',e:'📝',d:'fun'},
 {en:'drew dinosaurs',zh:'畫恐龍',pos:'ph.',e:'🦕',d:'fun'},
 {en:'read a story',zh:'閱讀故事',pos:'ph.',e:'📖',d:'fun',say:'red a story'},
 {en:'watched television',zh:'看電視',pos:'ph.',e:'📺',d:'fun'},
 {en:'hugged her father',zh:'擁抱她的爸爸',pos:'ph.',e:'🤗',d:'fun'},
 {en:'went to bed late',zh:'晚睡',pos:'ph.',e:'🌙',d:'fun'},
 // 第三章：動詞過去式（課本 p.84）
 {en:'cleaned',zh:'打掃了（clean 的過去式）',pos:'v.',e:'🧹',d:'past'},
 {en:'cut',zh:'剪了（cut 的過去式，一樣）',pos:'v.',e:'✂️',d:'past'},
 {en:'drew',zh:'畫了（draw 的過去式）',pos:'v.',e:'✏️',d:'past'},
 {en:'drank',zh:'喝了（drink 的過去式）',pos:'v.',e:'🥤',d:'past'},
 {en:'got',zh:'得到了；起床了（get 的過去式）',pos:'v.',e:'🛎️',d:'past'},
 {en:'went',zh:'去了（go 的過去式）',pos:'v.',e:'🚶',d:'past'},
 {en:'hugged',zh:'擁抱了（hug 的過去式）',pos:'v.',e:'🫂',d:'past'},
 {en:'made',zh:'做了（make 的過去式）',pos:'v.',e:'🥞',d:'past'},
 {en:'mopped',zh:'拖了地（mop 的過去式）',pos:'v.',e:'🪣',d:'past'},
 {en:'played',zh:'玩了；彈了（play 的過去式）',pos:'v.',e:'🎮',d:'past'},
 {en:'read',zh:'讀了（read 的過去式，唸 red）',pos:'v.',e:'📚',d:'past',say:'red'},
 {en:'studied',zh:'讀書了（study 的過去式）',pos:'v.',e:'📒',d:'past'},
 {en:'washed',zh:'洗了（wash 的過去式）',pos:'v.',e:'🫧',d:'past'},
 {en:'watched',zh:'看了（watch 的過去式）',pos:'v.',e:'👀',d:'past'},
];

const conflict=[['yesterday','this morning'],
 ['cleaned','cleaned his bedroom'],['cut','cut his fingernails'],['drew','drew dinosaurs'],['drank','drank juice'],
 ['got','got up early'],['went','went to bed late'],['hugged','hugged her father'],['made','made breakfast'],
 ['mopped','mopped the bathroom'],['played','played the piano'],['read','read a story'],['studied','studied for the test'],
 ['washed','washed my hands'],['watched','watched television']];

const phrases=[
 {en:'what did … do',zh:'…做了什麼？',ex:'What did Paul do yesterday? He mopped the bathroom yesterday.',sents:['What did Paul do yesterday?','What did the girls do this morning?']},
 {en:'every day',zh:'每天',ex:'Does Susie watch television every day? Yes, she watches television every day.'},
 {en:"don't … every day",zh:'沒有每天…',ex:"Do the girls drink juice every day? No, they don't drink juice every day.",sents:["No, they don't drink juice every day."]},
 {en:'who went',zh:'誰去了…？',ex:'Who went to bed late yesterday? Alice went to bed late yesterday.',sents:['Who went to bed late yesterday?']},
 {en:'after school',zh:'放學後',ex:'Hey, Chuck. What did you do yesterday after school?',sents:['What did you do yesterday after school?']},
 {en:'last night',zh:'昨晚',ex:'Why, what did you do last night?',sents:['What did you do last night?']},
];

// 手寫題：特別練 Test One 錯過的地方（過去式、Who 問句、人名要大寫、every day）
const bossQ=[
 {p:0,kind:'mc',label:'過去式填空',en:1,prompt:'My brother ___ (paint) a picture yesterday.',say:'My brother painted a picture yesterday.',opts:['painted','paint','paints','painting'],a:'painted',hint:'yesterday 是昨天 → 動詞用過去式，paint 加 ed → painted。'},
 {p:0,kind:'mc',label:'過去式填空',en:1,prompt:'He ___ (mop) the bathroom yesterday.',say:'He mopped the bathroom yesterday.',opts:['mopped','moped','mops','mop'],a:'mopped',hint:'mop 短母音，要多一個 p 再加 ed → mopped（moped 是別的字）。'},
 {p:0,kind:'mc',label:'過去式填空',en:1,prompt:'They ___ (draw) dinosaurs this morning.',say:'They drew dinosaurs this morning.',opts:['drew','drawed','draws','draw'],a:'drew',hint:'draw 是不規則動詞 → drew。'},
 {p:0,kind:'mc',label:'過去式填空',en:1,prompt:'I ___ (wash) my hands this morning.',say:'I washed my hands this morning.',opts:['washed','wash','washes','washd'],a:'washed',hint:'this morning 已經過去了 → washed（加 ed）。'},
 {p:3,kind:'order',label:'句子排列',words:['Paul','watched','television','yesterday.'],zh:'Paul 昨天看了電視。'},
 {p:3,kind:'mc',label:'人名要大寫',en:1,prompt:'Who watched television yesterday?',say:'Who watched television yesterday? Paul watched television yesterday.',opts:['Paul watched television yesterday.','paul watched television yesterday.','Paul watch television yesterday.','Paul watches television yesterday.'],a:'Paul watched television yesterday.',hint:'人名第一個字母要大寫，yesterday 要用過去式 watched。'},
 {p:2,kind:'order',label:'句子排列',words:['No,','they',"don't",'draw','dinosaurs','every','day.'],zh:'不，他們沒有每天畫恐龍。'},
 {p:2,kind:'mc',label:'句子填空',en:1,prompt:'Do Chuck and Susie draw dinosaurs every day?\nNo, they ___ draw dinosaurs every day.',say:"No, they don't draw dinosaurs every day.",opts:["don't","doesn't","didn't","aren't"],a:"don't",hint:"they 用 don't；every day 是每天的習慣，不用過去式。"},
 {p:1,kind:'mc',label:'watch 還是 watches？',en:1,prompt:'Yes, she ___ television every day.',say:'Yes, she watches television every day.',opts:['watches','watch','watched','watchs'],a:'watches',hint:'she 是第三人稱單數，watch 加 es → watches。'},
 {p:5,kind:'mc',label:'會話理解',prompt:'Chuck 昨晚做了什麼？',say:'Last night I watched two movies on television.',opts:['用電視看了兩部電影','準備考試','很早就睡了','彈鋼琴'],a:'用電視看了兩部電影',hint:'Last night I watched two movies on television.'},
 {p:5,kind:'mc',label:'會話理解',prompt:'Alice 昨晚為什麼很晚睡？',say:"Oh, I studied for today's test!",opts:['她在準備今天的考試','她在看電影','她在畫恐龍','她在打掃房間'],a:'她在準備今天的考試',hint:"Oh, I studied for today's test!"},
];

const stages=[
 {id:'home',chapter:'第一章',topic:'家事和早晨',place:'忙碌的家',enemy:'Skeleton_Minion',enemyName:'懶惰小兵',color:0xffa54a,
  taunt:'我昨天什麼都沒做！你呢？你昨天<em>mopped the bathroom</em>了嗎？',
  hero:'我昨天<em>got up early</em>，還<em>made breakfast</em>喔！'},
 {id:'fun',chapter:'第二章',topic:'休閒和學習',place:'放學後的遊戲室',enemy:'YellowDragon',enemyName:'愛看電視小飛龍',color:0x6fb8ff,
  taunt:'我昨天<em>watched television</em>看到很晚，<em>went to bed late</em>！嘿嘿～',
  hero:'我昨天<em>studied for the test</em>，今天一定考得好！'},
 {id:'past',chapter:'第三章',topic:'過去式',place:'時光倒流塔',enemy:'Skeleton_Warrior',enemyName:'時間守衛',color:0x8fe06b,
  taunt:'<em>draw</em> 變成什麼？<em>go</em> 變成什麼？說不出過去式，就別想回到昨天！',
  hero:'draw → <em>drew</em>，go → <em>went</em>，簡單！'},
 {id:'boss',chapter:'終章',topic:'綜合題',place:'骷髏法師王座',enemy:'Skeleton_Mage',enemyName:'骷髏法師王',color:0xb26bff,boss:1,
  taunt:'<em>yesterday</em> 要用過去式，<em>every day</em> 不用！還有人名要大寫！看你會不會掉進陷阱！',
  hero:'Paul watched television yesterday！我不會再錯了！'},
];

const audio={};

export default {
  id:'u3', name:'昨天島', week:'Unit 3', klass:'', dates:'What Did You Do?',
  icon:'⏳', color:'#8fe06b',
  boss:{words:8, phrases:8},
  words, conflict, phrases, bossQ, stages, audio,
  credits:'',
};
