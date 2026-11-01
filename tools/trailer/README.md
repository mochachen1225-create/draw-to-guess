# 試玩廣告（直式 1080×1920，中英兩版）

- `anim.html`：片頭／片尾動畫（程式畫的蒙眼鉛筆、歪貓、笑翻機器人，沒有 AI 圖）。`?lang=en|zh&scene=intro|end`，`render(t)` 畫第 t 秒
- `anim.mjs`：用 Playwright 一格一格截圖（30fps，360×640 × 3 倍）→ `raw/<lang>-intro|end/`
- `build.py`：把遊戲連拍、Flow 鏡頭、字卡、配樂剪成 `promo/trailer-<lang>.mp4`
  - 遊戲畫面用 400×800、deviceScaleFactor 2.4 連拍（`raw/<lang>-blind|guess|replay|solo/` 加 `times.json`），靜態圖 `raw/<lang>-peek.png`、`<lang>-twist.png`
  - 需要 `huninn.ttf`、`couch.mp4`（art-inbox 的沙發鏡頭）、`music.mp3`（art-inbox/music）放在同一個資料夾
  - 配樂取 13～22 秒＋40～59.4 秒：9 秒的靜音對到「螢幕變黑」，10.5 秒爆開對到線條出現，25 秒進片尾
- 轉場：真人鏡頭切進遊戲畫面用 xfade「zoomin」，切回真人用「fade」，遊戲畫面之間短暫交叉淡化；每段的表定開始時間不變，轉場跨在交界前後各一半
- 用法：`python3 build.py <素材資料夾> en|zh <輸出.mp4>`（需要 ffmpeg）

AI 素材：沙發鏡頭（Flow）、配樂（Gemini）。遊戲畫面與片頭片尾是程式畫的。
