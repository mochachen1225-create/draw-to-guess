# 盲畫 Blind Draw

手機網頁塗鴉小遊戲，中英雙語。畫家看題目 2 秒後開始畫（關燈模式螢幕全黑，看不到自己的線）；另一人看著線條即時出現，從 4 個選項猜答案。可以兩人連線合作，也可以單人跟電腦玩（電腦會畫得很爛）。

A phone-browser doodle game. Draw a prompt with your screen blacked out while a friend guesses — or play solo against a computer that draws badly on purpose. Chinese and English.

👉 https://mochachen1225-create.github.io/draw-to-guess/

- 題目包：綜合、台灣味、動物、抽象、今日挑戰（全世界同一組題目）
- 搞怪回合、爆笑組合題、即時表情、畫廊重播、分享圖
- 即時同步：Firebase Realtime Database，匿名驗證，不收集個人資料；單人模式完全不連網
- 完整的設計、資料結構、規則說明與開發過程：見 [開發紀錄.md](開發紀錄.md)

## 更新安全規則

改到資料庫存的欄位時，要把 `database.rules.json` 重新貼到 Firebase：

1. [Firebase 主控台](https://console.firebase.google.com) → `blind-draw` 專案
2. 「Realtime Database」→「規則」(Rules) 分頁
3. 刪掉原本內容，貼上 `database.rules.json` 的完整內容，按「發布」(Publish)

## GitHub Pages

Settings → Pages → Source 選「Deploy from a branch」，選有 `index.html` 的分支、資料夾 `/ (root)`，按 Save。
