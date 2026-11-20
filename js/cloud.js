// 雲端：Google 登入、跨裝置存檔、排行榜（Firebase Auth + Firestore）
// 遊戲本體不直接碰 Firebase，只透過這支檔案；雲端掛掉時遊戲照樣能用本機存檔玩。
import {FIREBASE_CONFIG, CLOUD_ENABLED} from './firebase-config.js';

const SDK='https://www.gstatic.com/firebasejs/13.2.0/';
const isLocal=['localhost','127.0.0.1'].includes(location.hostname);
// 本機測試用的假後端：http://localhost:8000/?mock=A（A 換成別的字就是另一個帳號），資料存在 localStorage
const MOCK=isLocal?new URLSearchParams(location.search).get('mock'):null;

export const state={enabled:CLOUD_ENABLED||!!MOCK, user:null, failed:false};
let hooks=null, be=null, ready=null, timer=null, lastSave='', lastBoard='', lastPull=0;

/* ---------- 存檔合併：兩邊取比較好的那個，進度只會增加不會倒退 ---------- */
export function mergeSaves(local,remote){
  if(!remote) return {...local};
  const out={...local, stars:{...local.stars}, seen:{...(remote.seen||{}),...local.seen}, lv:{...local.lv}};
  for(const k in remote.stars||{}) out.stars[k]=Math.max(out.stars[k]||0,remote.stars[k]|0);
  for(const k in remote.lv||{}) out.lv[k]=Math.max(out.lv[k]||1,remote.lv[k]|0);
  // 錯題本：答錯次數取多的那邊，「連續答對幾次」跟著比較晚更新的那邊
  out.miss={...(remote.miss||{})};
  for(const k in local.miss||{}){ const x=local.miss[k], y=out.miss[k]; if(!y){ out.miss[k]=x; continue; }
    const newer=(x.u||0)>=(y.u||0)?x:y, ty={...(y.ty||{})}; for(const t in x.ty||{}) ty[t]=Math.max(ty[t]||0,x.ty[t]);
    out.miss[k]={n:Math.max(x.n|0,y.n|0),ok:newer.ok|0,t:Math.max(x.t||0,y.t||0),u:Math.max(x.u||0,y.u||0),ty}; }
  // 金幣：賺到的、花掉的各取大的那邊；買過的商品兩邊合起來；穿著跟著比較晚換的那邊
  out.earned=Math.max(local.earned|0,remote.earned|0); out.spent=Math.max(local.spent|0,remote.spent|0);
  out.owned={...(remote.owned||{}),...(local.owned||{})};
  if((remote.wu||0)>(local.wu||0)){ out.wear=remote.wear||{}; out.wu=remote.wu; }
  out.name=remote.name||local.name||'';
  const localEmpty=!Object.keys(local.stars||{}).length;
  if(localEmpty){ if(remote.hero!=null) out.hero=remote.hero; if(remote.island) out.island=remote.island; }
  return out;
}

/* ---------- 後端：Firebase ---------- */
async function firebaseBackend(){
  const [{initializeApp},A,F]=await Promise.all([import(SDK+'firebase-app.js'),import(SDK+'firebase-auth.js'),import(SDK+'firebase-firestore.js')]);
  const app=initializeApp(FIREBASE_CONFIG), auth=A.getAuth(app), db=F.getFirestore(app);
  const provider=new A.GoogleAuthProvider(); provider.setCustomParameters({prompt:'select_account'});
  return {
    onUser:cb=>A.onAuthStateChanged(auth,u=>cb(u?{uid:u.uid,email:u.email||''}:null)),
    signIn:()=>A.signInWithPopup(auth,provider),
    signOut:()=>A.signOut(auth),
    loadSave:async uid=>{ const d=await F.getDoc(F.doc(db,'saves',uid)); if(!d.exists()) return null; try{ return JSON.parse(d.data().data); }catch(e){ return null; } },
    writeSave:(uid,json)=>F.setDoc(F.doc(db,'saves',uid),{data:json,updatedAt:F.serverTimestamp()}),
    writeBoard:(uid,e)=>F.setDoc(F.doc(db,'board',uid),{...e,updatedAt:F.serverTimestamp()}),
    topBoard:async()=>{ const snap=await F.getDocs(F.query(F.collection(db,'board'),F.orderBy('cleared','desc'),F.limit(100)));
      return snap.docs.map(d=>{ const x=d.data(); return {uid:d.id,name:x.name,cleared:x.cleared,stars:x.stars,hero:x.hero,lv:x.lv,t:x.updatedAt?.toMillis?.()||0}; }); },
  };
}

/* ---------- 後端：本機假資料（只有 localhost 加 ?mock= 才會用到） ---------- */
function mockBackend(){
  const KEY='mock-cloud', UKEY='mock-user';
  const db=()=>{ try{ return JSON.parse(localStorage.getItem(KEY))||{saves:{},board:{}}; }catch(e){ return {saves:{},board:{}}; } };
  const put=d=>localStorage.setItem(KEY,JSON.stringify(d));
  let cb=()=>{};
  const cur=()=>{ const id=localStorage.getItem(UKEY); return id?{uid:'mock-'+id,email:id+'@test.local'}:null; };
  return {
    onUser:f=>{ cb=f; setTimeout(()=>cb(cur()),50); },
    signIn:async()=>{ localStorage.setItem(UKEY,MOCK); cb(cur()); },
    signOut:async()=>{ localStorage.removeItem(UKEY); cb(null); },
    loadSave:async uid=>{ const s=db().saves[uid]; return s?JSON.parse(s):null; },
    writeSave:async(uid,json)=>{ const d=db(); d.saves[uid]=json; put(d); },
    writeBoard:async(uid,e)=>{ const d=db(); d.board[uid]={...e,t:Date.now()}; put(d); },
    topBoard:async()=>Object.entries(db().board).map(([uid,x])=>({uid,...x})),
  };
}

/* ---------- 同步 ---------- */
async function pull(){
  const uid=state.user.uid, raw=await be.loadSave(uid), remote=raw&&hooks.fixSave?hooks.fixSave(raw):raw; lastPull=Date.now();   // fixSave：舊版的雲端存檔在這裡補上新欄位（例如照星星補發金幣）
  let local=hooks.getSave();
  // 這台裝置上留著別的帳號的進度：不混進來，改用雲端那份
  if(local.owner&&local.owner!==uid) local={...hooks.blankSave(),hero:local.hero};
  const merged=mergeSaves(local,remote); merged.owner=uid;
  if(JSON.stringify(merged)!==JSON.stringify(hooks.getSave())) hooks.applySave(merged);
  await push();
}
async function push(){
  if(!state.user||!be) return;
  const uid=state.user.uid, json=JSON.stringify(hooks.getSave()), jobs=[];
  if(json!==lastSave) jobs.push(be.writeSave(uid,json).then(()=>{lastSave=json;}));
  const e=hooks.boardEntry();
  if(e.name&&e.cleared>0){ const bj=JSON.stringify(e); if(bj!==lastBoard) jobs.push(be.writeBoard(uid,e).then(()=>{lastBoard=bj;})); }
  await Promise.all(jobs);
}
// 遊戲每次存檔都會呼叫；攢 2.5 秒一起寫，避免每答一題就寫一次
export function queueSave(){ if(!state.user) return; clearTimeout(timer); timer=setTimeout(()=>push().catch(e=>console.warn('[cloud] 存檔失敗',e)),2500); }
export function flush(){ clearTimeout(timer); return push().catch(e=>console.warn('[cloud] 存檔失敗',e)); }

async function onUserChange(u){
  const was=state.user; state.user=u; lastSave=''; lastBoard='';
  if(!u){ if(was) hooks.applySave({...hooks.blankSave(),hero:hooks.getSave().hero}); hooks.onUser(null,{}); return; }
  try{ await pull(); }catch(e){ console.warn('[cloud] 讀取雲端進度失敗',e); }
  hooks.onUser(u,{needName:!hooks.getSave().name});
}

export function init(h){
  hooks=h; if(!state.enabled) return;
  ready=(MOCK?Promise.resolve(mockBackend()):firebaseBackend()).then(b=>{ be=b; be.onUser(u=>onUserChange(u)); })
    .catch(e=>{ state.failed=true; console.warn('[cloud] 雲端功能載入失敗，改用本機存檔',e); });
  document.addEventListener('visibilitychange',()=>{
    if(!state.user) return;
    if(document.hidden) flush();
    else if(Date.now()-lastPull>60000) pull().catch(e=>console.warn('[cloud] 同步失敗',e));   // 回到畫面時順便收別台裝置的新進度
  });
}
const need=async()=>{ await ready; if(!be) throw Object.assign(new Error('cloud unavailable'),{code:'cloud/unavailable'}); };
export async function signIn(){ await need(); await be.signIn(); }
export async function signOut(){ await need(); await flush(); await be.signOut(); }
export async function fetchBoard(){
  await need(); const rows=await be.topBoard();
  return rows.filter(r=>r.name&&r.cleared>0).sort((a,b)=>b.cleared-a.cleared||b.stars-a.stars||a.t-b.t).slice(0,50);
}

/* ---------- 給畫面用的小工具 ---------- */
export function inAppBrowser(){ const ua=navigator.userAgent||'';
  if(/Line\//i.test(ua)) return 'LINE'; if(/FBAN|FBAV|FB_IAB/i.test(ua)) return 'Facebook'; if(/Instagram/i.test(ua)) return 'Instagram'; if(/MicroMessenger/i.test(ua)) return '微信'; return ''; }
export function errorText(err){ const c=err&&err.code||'';
  if(c==='auth/popup-blocked') return '瀏覽器擋住了登入視窗，請允許彈出視窗後再試一次。';
  if(c==='auth/popup-closed-by-user'||c==='auth/cancelled-popup-request') return '登入視窗被關掉了，再按一次就可以。';
  if(c==='auth/network-request-failed'||c==='cloud/unavailable') return '網路連不上，請確認網路後再試一次。';
  if(c==='auth/operation-not-allowed') return 'Google 登入還沒開通，請稍後再試。';
  if(c==='auth/unauthorized-domain') return '這個網址還沒被允許使用 Google 登入。';
  return '登入沒有成功，請再試一次。'; }
