// Firebase 專案 vocab-dungeon-dada3c 的網頁設定。
// 這些值本來就是公開的（瀏覽器一定看得到），真正的保護在 firestore.rules。
export const FIREBASE_CONFIG={
  apiKey:'AIzaSyADIOit8Cs8m5XZVYy7nU0y36uej-5Fh8w',
  authDomain:'vocab-dungeon-dada3c.firebaseapp.com',
  projectId:'vocab-dungeon-dada3c',
  storageBucket:'vocab-dungeon-dada3c.firebasestorage.app',
  messagingSenderId:'28055868011',
  appId:'1:28055868011:web:06cbeb35a55bd6aba0972e',
};
// Google 登入與排行榜的總開關。false 時遊戲照常能玩，只是沒有登入按鈕、排行榜不開放。
export const CLOUD_ENABLED=false;
