# 盲畫

兩人連線的手機網頁小遊戲。畫家看題目 2 秒後螢幕全黑，憑感覺用手指畫 10 秒；另一人看著線條即時出現，從 4 個選項搶答。兩人合作，10 題一起拚高分。

- 整個遊戲只有一個檔案：`index.html`
- 即時同步：Firebase Realtime Database（新加坡機房）
- 匿名驗證：玩家看不到登入畫面，也不收集任何個人資料

## Firebase 安全規則

規則在 `database.rules.json`。更新方式：

1. 打開 [Firebase 主控台](https://console.firebase.google.com) → 選 `blind-draw` 專案
2. 左側選單「Realtime Database」→ 上方「規則」(Rules) 分頁
3. 把編輯框裡的內容**全部刪掉**，貼上 `database.rules.json` 的完整內容
4. 按「發布」(Publish)

規則做了這些事：

- 只有登入（匿名）的玩家能讀寫，而且只能碰 `rooms/` 底下的資料
- 一個房間只有建立者（玩家 A）和加入者（玩家 B）讀得到、寫得進去
- 房間代碼必須是 4 位數字；每筆線條資料最多 3000 字元，每題最多 400 筆畫
- 題目、選項、答案都有格式和長度限制，不允許多塞其他欄位
- 超過 2 小時的舊房間，任何玩家建立新房間時都可以順手刪掉

## 資料什麼時候刪除

| 資料 | 刪除時機 |
|---|---|
| 每題的線條座標、作答 | 該題揭曉後馬上刪除 |
| 玩家在線狀態 | 玩家離線時（onDisconnect） |
| 整個房間 | 結算畫面時任一人離開或關掉網頁；或按「回首頁」/「離開房間」 |
| 被丟著沒人管的房間 | 超過 2 小時，下一個人建房時清掉 |
| 畫廊 | 只存在兩支手機的記憶體，關掉網頁就消失 |

## GitHub Pages

Settings → Pages → Build and deployment → Source 選 **Deploy from a branch**，Branch 選有 `index.html` 的分支、資料夾選 `/ (root)`，按 Save。約 1 分鐘後網址會出現在同一頁上方。
