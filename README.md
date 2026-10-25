# 盲畫

兩人連線的手機網頁小遊戲。畫家看題目 2 秒後開始畫（關燈模式螢幕全黑，看不到自己的線）；另一人看著線條即時出現，從 4 個選項猜答案。兩人合作，10 題越來越難。

👉 https://mochachen1225-create.github.io/draw-to-guess/

- 整個遊戲只有一個檔案：`index.html`
- 即時同步：Firebase Realtime Database（新加坡），匿名驗證，不收集個人資料
- 完整的設計、資料結構、規則說明與開發過程：見 [開發紀錄.md](開發紀錄.md)

## 更新安全規則

改到資料庫存的欄位時，要把 `database.rules.json` 重新貼到 Firebase：

1. [Firebase 主控台](https://console.firebase.google.com) → `blind-draw` 專案
2. 「Realtime Database」→「規則」(Rules) 分頁
3. 刪掉原本內容，貼上 `database.rules.json` 的完整內容，按「發布」(Publish)

## GitHub Pages

Settings → Pages → Source 選「Deploy from a branch」，選有 `index.html` 的分支、資料夾 `/ (root)`，按 Save。
