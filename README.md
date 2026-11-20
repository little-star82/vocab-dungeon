# 單字地下城

國小英文每週單字的 3D 地下城闖關遊戲。純前端、沒有 build，一週的單字是一座「關卡島」，之後每週加一座。

- 正式網址：https://vocab.dada3c.tw
- 原始碼：https://github.com/dada3c/vocab-dungeon （MIT 授權，關卡內容除外，見最下面的「授權」）
- Vercel 原始網址：https://vocab-dungeon-peach.vercel.app

## 玩法

- **關卡島地圖**：每座島上一關一個節點，點節點就能挑戰，過關的可以重玩拿三顆星
- **小王綜合題**：每座島最後一關，這座島每一章的單字加上片語題混在一起考。小王的血比較厚（要答的題數約 1.4 倍），還會蓄力放大招，連續答對 3 題發動必殺技可以打斷
- **複習考島**：跟前幾週的島借題的試煉關卡。四位勇者接力出招、答得快傷害加成、連續 6 題發動四人合體技；最終關的大魔王分三個階段，還會蓄力放大招
- **隨機出題**：範圍固定是那座島的單字和片語，但題型、選項、缺的字母、抽到的句子每次都不一樣。單字有 11 種題型，片語會自動變出 5 種問法，另外可以手寫句子填空和情境對話
- **必殺技**：連續答對 3 題發動，傷害是一般攻擊的 2 倍；答錯的題目一定會再考一次
- **怪物血量**：照勇者的強度調整，等級再高，一關還是要答跟單字數差不多的題數（以前等級高了只要答一半）
- **等級與招式**：每過一關升一級，最高 Lv50。每位勇者有 6 招，Lv1、10、20、30、40、50 各學一招（傷害 2 / 3 / 3 / 4 / 4 / 4，後面的招式回比較多愛心；傷害最多到 4，再高一關就答不到幾題）；學會的招式從最新的開始輪流放。Lv15、25、35、45 愛心上限各 ＋1，Lv30 起腳下是彩虹光環
- **隱藏勇者**：兩位，沒解鎖前在主選單只看得到黑影和「？？？」。**弓箭手**：騎士、法師、盜賊、蠻族四位都練到 Lv30 才現身，用弓箭遠距離攻擊。**刺客**：前面五位（含弓箭手）全部練到 Lv50 才現身，戴兜帽、拿雙刀。兩位都從 Lv1 開始練、各有自己的六招。解鎖條件直接看等級，沒有另外存旗標
- **可愛怪物**：除了骷髏，還有 16 隻怪物（雪怪、螃蟹、仙人掌、幽靈、小飛龍…）守在 20 個關卡裡，打到那一關才載入；小王和複習考的考官維持骷髏
- **錯題洞窟**：答錯的單字和片語會記進錯題本（不分單元），主選單和地圖上都能進洞窟複習。同一題連續答對 2 次算掌握，就不再出現；錯題本會列出每一題錯幾次、最常錯在哪種題型。洞窟是複習用的，不算過關數、勇者也不會升級（只給金幣）
- **換裝商城**：過關和進錯題洞窟會拿到金幣（一般關 10、小王和試煉 20，每顆星再 +5；洞窟 10，每掌握一題再 +10）。主選單的「👕 換裝」可以試穿、購買武器、副手、帽子、披風和配色，買了之後四位勇者都能穿。商品全部是 KayKit 角色模型裡本來就有的零件，四位勇者骨架相同所以能互穿；配色是用程式改貼圖上的色票。這個版本之前拿到的星星，每顆補發 8 金幣
- **加到主畫面（PWA）**：手機可以把遊戲加到主畫面，點圖示全螢幕打開。Android 和電腦的 Chrome 按主選單的「📲 加到主畫面」會跳安裝視窗；iPhone 要從瀏覽器的分享選單選「加入主畫面」，按鈕會顯示步驟。玩過的內容沒網路也能玩，進度先存在裝置上，有網路再同步
- **Google 登入**：進度存在雲端，換裝置接著玩；沒登入也能玩，進度存在這台裝置
- **排行榜**：比誰過的關卡多，過關數一樣比星星。只顯示自己取的暱稱

## 結構

| 路徑 | 內容 |
|---|---|
| `index.html` | 版面與樣式 |
| `js/game.js` | 遊戲本體（3D 場景、出題、戰鬥、地圖、圖鑑、排行榜畫面） |
| `js/cloud.js` | Google 登入、雲端存檔、排行榜（Firebase） |
| `js/firebase-config.js` | Firebase 網頁設定與雲端功能總開關 `CLOUD_ENABLED` |
| `islands/` | 關卡島資料，一座島一個資料夾。**新增關卡看 [islands/README.md](islands/README.md)** |
| `assets/` | 共用的 3D 模型（角色、地城場景） |
| `manifest.webmanifest`、`icons/` | PWA 設定與 App 圖示（圖示是遊戲裡的騎士截圖） |
| `sw.js` | service worker：快取規則，讓遊戲可以加到主畫面、沒網路也能玩 |
| `tools/build_ranger.py`、`tools/build_assassin.py` | 組出兩位隱藏勇者的模型（`assets/Ranger.json`、`assets/Assassin.json`），來源和用法寫在各自的檔案開頭 |
| `tools/convert_monsters.py` | 用 Blender 把 Quaternius 的怪物包從 FBX 轉成 `assets/m/*.glb` |
| `tools/dev/` | 測試工具：本機伺服器、無頭 Chrome 驅動、自動打完一關、檢查每一招和每一隻怪物。用法寫在各檔案開頭 |
| `tools/check_islands.mjs` | 檢查題庫有沒有寫錯（對不到關卡的單字、缺欄位、找不到的圖片和發音檔） |
| `AGENTS.md` | 給 AI 程式助理看的說明：怎麼把題庫換成自己的 |
| `tools/make_audio.py` | 幫一座島產生發音檔（Kokoro 語音合成），用法見 islands/README.md |
| `firestore.rules` | Firestore 安全規則 |

## 本機執行

```bash
python3 -m http.server 8000
```

開 http://localhost:8000 。要測登入和排行榜但不想動到正式資料，網址加 `?mock=A`：會用假的登入和存在瀏覽器裡的假資料，`A` 換成別的字就是另一個帳號。

## 部署

- **網站**：Vercel 專案 `vocab-dungeon`，連 GitHub repo，push 到 `main` 自動上線
- **DNS**：台灣固網代管，`vocab` CNAME → `a8615cc1da1e5059.vercel-dns-017.com`
- **後端**：Firebase 專案 `vocab-dungeon-dada3c`（Auth 的 Google 登入＋Firestore，asia-east1）
- **Google 登入的授權網域**：`vocab.dada3c.tw`、`localhost`。換網址或多一個網址時，要到 Firebase console 的 Authentication → 設定 → 授權網域加上去，否則登入會被擋

改了 `firestore.rules` 要另外部署：

```bash
npx firebase-tools deploy --only firestore
```

## 把題庫換成自己的（交給 AI 做）

題庫全部在 `islands/` 資料夾，換掉它就是你自己的單字遊戲，遊戲程式不用改。

最省事的做法是交給 AI 程式助理（Claude Code、Codex、Cursor 都可以）。把這個專案抓下來，在專案資料夾裡開 AI，貼這段話，後面接上你的單字表（文字或照片都行）：

```text
請先讀這個專案的 AGENTS.md，照裡面「把題庫換成使用者自己的」的步驟做。
我不需要登入和排行榜。
我的單字表如下：

（在這裡貼上單字表）
```

[AGENTS.md](AGENTS.md) 裡寫了它該問你什麼、要改哪些檔案、最容易寫錯的地方，還有改完怎麼檢查。想自己動手的話，照 [islands/README.md](islands/README.md) 做，改完跑 `node tools/check_islands.mjs` 檢查。

## 想自己架一份

程式可以直接拿去用，但雲端的部分要換成你自己的：

1. 到 [Firebase console](https://console.firebase.google.com/) 開一個專案，啟用 Authentication 的 Google 登入和 Firestore
2. 把 `js/firebase-config.js` 換成你專案的網頁設定，`.firebaserc` 的專案代號也換掉
3. `firebase.json` 的 Google 登入設定裡補上你自己的 `supportEmail`，再 `npx firebase-tools deploy --only firestore`
4. 在 Authentication → 設定 → 授權網域，加上你的網址
5. 整個資料夾丟到任何靜態主機（Vercel、Netlify、GitHub Pages）就能跑

不想要登入和排行榜的話，把 `js/firebase-config.js` 的 `CLOUD_ENABLED` 改成 `false`，遊戲會只用瀏覽器的本機存檔，上面幾步都可以跳過。

關卡內容在 `islands/`，照 [islands/README.md](islands/README.md) 換成你自己的單字表。

## 素材來源

全部是 CC0（可免費商用、不用標示作者）：

| 素材 | 作者 | 用在哪 |
|---|---|---|
| KayKit Adventurers 1.0 | Kay Lousberg | 騎士、法師、盜賊、蠻族、刺客（Rogue_Hooded），以及所有勇者的動作 |
| KayKit Adventurers 2.0 | Kay Lousberg | 弓箭手的模型、弓、箭 |
| KayKit Skeletons、Dungeon | Kay Lousberg | 骷髏怪物、地城場景 |
| Cute Animated Monsters | Quaternius | 16 隻可愛怪物 |

## PWA 與快取

`sw.js` 的規則：

| 類型 | 作法 | 結果 |
|---|---|---|
| 程式（網頁、js、關卡島資料） | 先連網路，4 秒連不上才用上次存的 | 部署新版後重開就是新的 |
| 素材（3D 模型、發音檔、圖片） | 先用存的，背景更新 | 開得快；換了檔案要開第二次才會看到 |
| three.js、Firebase SDK、字型 | 存過就一直用 | 網址帶版號，不會過期 |
| Google 登入、雲端存檔 | 不經過 service worker | 一定走網路 |

- 改了 `sw.js` 的快取規則，把裡面的 `VERSION` 加一，舊快取會自動清掉。平常新增關卡、改程式都不用動它。
- 本機開發預設不註冊 service worker（免得看到舊檔）；要在本機測，網址加 `?sw`。
- 離線能玩的是「開過的內容」：沒進過的島，發音檔還沒存下來，離線時會改用裝置內建的語音。

## 雲端資料

| 集合 | 內容 | 誰能讀寫 |
|---|---|---|
| `saves/{uid}` | 存檔（星星、圖鑑、等級、錯題本、金幣、買過的商品、穿著、暱稱） | 只有本人 |
| `board/{uid}` | 排行榜：暱稱、過關數、星星、勇者、等級 | 任何人可讀，只能寫自己那筆 |

排行榜不存信箱、不存 Google 姓名。存檔合併的規則是「兩邊取比較好的」，所以進度只會增加不會倒退。

## 授權

- **程式**：MIT，見 [LICENSE](LICENSE)
- **3D 模型**：KayKit（Kay Lousberg）與 Quaternius 的 CC0 素材，見上面的「素材來源」
- **發音檔**：用開源語音模型 Kokoro-82M 合成
- **單字、片語和例句**（`islands/` 底下的關卡內容）：整理自學校的每週單字講義，**不在 MIT 授權範圍內**，僅供這個遊戲的示範。要拿這個專案去用，請換成你自己的內容
