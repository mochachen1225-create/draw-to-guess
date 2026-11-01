# 《盲畫 Blind Draw》上架資料

上架前請再看一次 itch.io 編輯頁的實際欄位：平台規定會變，這份是 2026/11 整理的。

## 基本資料

| 欄位 | 內容 |
|---|---|
| Title | Blind Draw（盲畫） |
| Project URL | `blind-draw` → https://mocha-cat-team.itch.io/blind-draw |
| Short description / tagline | Draw with your screen blacked out. Your friend guesses. Nobody wins, everybody laughs. |
| Classification | Games |
| Kind of project | HTML |
| Release status | Released |
| Pricing | No payments（免費） |
| Genre | Party |
| Tags | drawing, party-game, multiplayer, co-op, local-multiplayer, mobile, funny, cute, doodle, short |
| Languages | English, Chinese (Traditional) |
| Inputs | Touchscreen, Mouse |
| Accessibility | One button? 否；Subtitles 不適用 |

## 上傳與嵌入（itch）

1. 在 Mac 上執行打包：`./tools/package.sh`（itch 網址已內建；Newgrounds 上架後再加第二個參數），產出在 `dist/`
2. Uploads：上傳 `blind-draw-itch-<版本>.zip`，勾 **This file will be played in the browser**
3. Embed options：
   - Viewport dimensions：**420 × 860**
   - 勾 **Mobile friendly**，Orientation 選 **Portrait**
   - 勾 **Fullscreen button**
   - 不勾 Automatically start on page load（讓玩家點了才開始，iPhone 的聲音才會解鎖）
4. 之後每週六用 butler 傳到 `帳號/blind-draw:html5`。第一次用 butler 上傳後，到 Uploads 把新的 html5 檔勾「played in the browser」，再刪掉手動上傳的 zip

## AI 揭露（Edit game → AI disclosure，照實勾）

| 類別 | 勾選 | 說明 |
|---|---|---|
| Graphics | **Yes** | 封面和宣傳圖用 Flow／Gemini 生成。遊戲裡的畫面全部是程式畫的 |
| Sound | No | 音效是程式即時合成，沒有用生成式 AI 產生音檔 |
| Text and dialogue | **Yes** | 英文翻譯和部分文案由 AI 協助 |
| Code | **Yes** | 程式由 AI 協助撰寫 |

> 請 Katie 最後確認一次。Newgrounds 版的封面和圖示要用程式畫的版本（`promo/newgrounds/`），不放 AI 圖。

## 頁面文案（英文，itch 主要）

> **Draw it blind. Guess it live. Laugh at the replay.**
>
> One of you sees a prompt for 2 seconds, then the screen goes black. Draw it with your finger — you can't see a single line. Your friend watches the strokes appear in real time and has to pick the right answer before time runs out.
>
> The best part comes at the end: the gallery replays every drawing stroke by stroke, so the artist finally sees what they made. It is never what they thought.
>
> **How to play**
> - 2 players, 2 phones (or a phone and a computer). One creates a room, the other enters the 4-digit code
> - 10 rounds, you take turns drawing. It's co-op: you score together
> - Rounds get harder: silly prompts ("Cat in a suit"), look-alike options, and finally things you can't really draw ("Monday", "Left on read")
> - Twist rounds: shaky hands, mirror mode, one stroke only, 5 seconds
> - Tap 😂🤔😱👍 while guessing — the artist sees your reactions in the replay
>
> **No friend nearby?** Play **Solo**: the computer draws for you. Badly. On purpose.
>
> **Daily challenge**: everyone in the world gets the same 10 prompts each day. Share your 🟩🟥 result.
>
> Prompt packs: Mix · Taiwan · Animals · Abstract · Daily
> Prefer to see your lines? Switch to **Lights on** mode.
>
> No sign-up, no ads, no personal data. Works in your phone's browser. English / 中文.

## 頁面文案（中文，社群用）

> **閉著眼睛畫，用心電感應猜。**
>
> 畫家看題目 2 秒，螢幕就全黑，只能憑感覺用手指畫；另一個人看著線條一筆一筆出現，要在時間內猜出答案。最後的畫廊會重播每一張作品，畫家這時才第一次看到自己畫了什麼。
>
> - 兩支手機就能玩，免下載、免登入，合作拚分數
> - 越後面越難：爆笑題（穿西裝的貓）、長得很像的選項，最後是根本畫不出來的「星期一」「已讀不回」
> - 搞怪回合：手抖、左右顛倒、只能一筆、只有 5 秒
> - 沒有朋友在旁邊？單人模式讓電腦畫給你猜（故意畫很爛）
> - 今日挑戰：全世界每天同一組題目，可以分享 🟩🟥 成績

## 一句話介紹

- 中：閉著眼睛畫、用心電感應猜的雙人塗鴉小遊戲，也能單人看電腦亂畫。
- 英：A two-player doodle game where you draw with your screen blacked out — or watch the computer draw badly on purpose.

## 素材清單

| 用途 | 檔案 | 尺寸 | AI |
|---|---|---|---|
| itch 封面 | `promo/itch/cover.png` | 630×500（實際 1260×1000） | 是（Flow） |
| itch 截圖 ×6 | `promo/itch/screenshot-en-*.png`、`screenshot-zh-*.png` | 1080×1350 | 否（遊戲實機） |
| 橫式主視覺 | `promo/itch/banner.png` | 1920×1080 | 是（Gemini） |
| Newgrounds 圖示 | `promo/newgrounds/icon.png` | 1920×1080 | 否（程式畫） |
| 試玩廣告 | `promo/trailer-en.mp4`、`trailer-zh.mp4` | 1080×1920 | 部分（Flow 鏡頭） |

## Newgrounds

- 上傳 `blind-draw-newgrounds-<版本>.zip`，Embed **420 × 860**，勾 Touchscreen friendly
- 圖示用 `promo/newgrounds/icon.png`（程式畫，沒有 AI）
- 分級：沒有暴力、色情、毒品，選 None → 預期 E
- 作者的話：同英文文案再口語一點，結尾問大家最好笑的一張畫了什麼

## 宣傳紀錄

（發過的文案記在這裡，之後照著改寫）
