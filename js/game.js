import { initializeApp } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js";
import { getAuth, signInAnonymously } from "https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js";
import {
  getDatabase, ref, set, remove, get, push, onValue, onChildAdded, onDisconnect, goOnline, goOffline,
  serverTimestamp, query, orderByValue, endAt, limitToFirst, update
} from "https://www.gstatic.com/firebasejs/12.19.0/firebase-database.js";

const firebaseConfig = {
  apiKey: "AIzaSyDzdQ89Wo-MIpBJMt9x07Tdb7kTokFf-CI",
  authDomain: "blind-draw-69397.firebaseapp.com",
  databaseURL: "https://blind-draw-69397-default-rtdb.firebaseio.com",
  projectId: "blind-draw-69397",
  storageBucket: "blind-draw-69397.firebasestorage.app",
  messagingSenderId: "1013891427946",
  appId: "1:1013891427946:web:83d3dd937bab6e747f2413"
};

const VERSION = "2.1.0";
const CHANGES = [
  "新增題目包：🌎 西洋經典（萬聖節、聖誕節、童話怪物、世界地標）",
  "新增單人模式：電腦畫給你猜（而且畫得很爛）",
  "新增題目包：綜合、台灣味、動物、抽象、今日挑戰",
  "新增爆笑題：穿西裝的貓、阿嬤覺得你會冷…",
  "新增搞怪回合：手抖、左右顛倒、只能一筆、只有 5 秒",
  "猜的人可以按表情，畫家重播時才看得到",
  "支援英文版"
];
const ROUNDS = 10;
const TIME = { INTRO: 2500, WARN: 1700, MOD: 1200, PEEK: 2000, DRAW: 10000, FAST: 5000, REVEAL: 3500 };
const OLD_ROOM_MS = 2 * 60 * 60 * 1000;
const BASE_URL = location.origin + location.pathname;
// 打包到 itch／Newgrounds 時，遊戲跑在 iframe 裡，網址是平台的檔案主機：
// 分享用遊戲頁網址（GAME_URL），房間邀請連結用可以直接開的網址（INVITE_URL）
const SHARE_URL = window.GAME_URL || BASE_URL;
const INVITE_URL = window.INVITE_URL || BASE_URL;
const REACTS = ["😂", "🤔", "😱", "👍"];
const DAILY_EPOCH = Date.UTC(2026, 10, 1);

/* ================= 小工具 ================= */
const $ = s => document.querySelector(s);
const pick = (a, rng = Math.random) => a[Math.floor(rng() * a.length)];
const shuffle = (a, rng = Math.random) => { a = a.slice(); for (let i = a.length - 1; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [a[i], a[j]] = [a[j], a[i]]; } return a; };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const esc = s => String(s).replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const other = r => r === "A" ? "B" : "A";
const store = {
  get(k, d) { try { const v = localStorage.getItem(k); return v === null ? d : JSON.parse(v); } catch { return d; } },
  set(k, v) { try { localStorage.setItem(k, JSON.stringify(v)); } catch {} }
};
let screen = "home";
function show(id) {
  screen = id;
  document.querySelectorAll(".screen").forEach(el => el.classList.toggle("active", el.id === id));
  window.scrollTo(0, 0);
}
let toastTimer;
function toast(msg, ms = 2600) {
  const t = $("#toast"); t.textContent = msg; t.classList.add("show");
  clearTimeout(toastTimer); toastTimer = setTimeout(() => t.classList.remove("show"), ms);
}
function retrigger(el, cls) { el.classList.remove(cls); void el.offsetWidth; el.classList.add(cls); }
const withTimeout = (p, ms) => Promise.race([p, new Promise((_, rej) => setTimeout(() => rej(new Error("timeout")), ms))]);
function todayNo() {
  const d = new Date();
  return Math.floor((Date.UTC(d.getFullYear(), d.getMonth(), d.getDate()) - DAILY_EPOCH) / 86400000) + 1;
}

applyStatic();
if (LANG === "en") document.title = "Blind Draw";

/* ================= 音效 ================= */
const Snd = {
  ctx: null,
  muted: store.get("blind-draw-muted2", false),
  unlock() {
    if (!this.ctx) { const AC = window.AudioContext || window.webkitAudioContext; if (AC) this.ctx = new AC(); }
    if (this.ctx && this.ctx.state === "suspended") this.ctx.resume();
  },
  tone(f, d, { type = "sine", vol = .18, at = 0, to = null } = {}) {
    if (this.muted || !this.ctx) return;
    const c = this.ctx, t = c.currentTime + at;
    const o = c.createOscillator(), g = c.createGain();
    o.type = type; o.frequency.setValueAtTime(f, t);
    if (to) o.frequency.exponentialRampToValueAtTime(to, t + d);
    g.gain.setValueAtTime(.0001, t);
    g.gain.exponentialRampToValueAtTime(vol, t + .015);
    g.gain.exponentialRampToValueAtTime(.0001, t + d);
    o.connect(g).connect(c.destination); o.start(t); o.stop(t + d + .05);
  },
  tap() { this.tone(520, .08, { type: "triangle", vol: .1 }); },
  join() { [523, 659, 784].forEach((f, i) => this.tone(f, .18, { type: "triangle", at: i * .1 })); },
  peek() { this.tone(400, .3, { to: 900, vol: .12 }); },
  go() { this.tone(880, .1, { type: "square", vol: .1 }); this.tone(1320, .2, { type: "square", vol: .1, at: .1 }); },
  tick(n) { const f = { 3: 740, 2: 880, 1: 1040 }[n] || 800; this.tone(f, .13, { type: "square", vol: .14 }); this.tone(f / 2, .15, { type: "triangle", vol: .12 }); },
  buzz() { this.tone(220, .5, { type: "sawtooth", vol: .13, to: 110 }); },
  lock() { this.tone(660, .08, { type: "triangle", vol: .14 }); this.tone(990, .1, { type: "triangle", vol: .12, at: .07 }); },
  correct() { [784, 1047, 1319].forEach((f, i) => this.tone(f, .2, { type: "triangle", vol: .16, at: i * .09 })); },
  wrong() { this.tone(330, .4, { type: "triangle", vol: .16, to: 150 }); },
  boing() { this.tone(300, .25, { type: "sine", vol: .14, to: 700 }); this.tone(700, .2, { type: "sine", vol: .1, at: .2, to: 350 }); },
  pop() { this.tone(900, .06, { type: "triangle", vol: .08 }); },
  fanfare() { [523, 659, 784, 1047, 784, 1047].forEach((f, i) => this.tone(f, .22, { type: "triangle", vol: .15, at: i * .13 })); }
};
function vibrate(ms) { if (!Snd.muted && navigator.vibrate) try { navigator.vibrate(ms); } catch {} }
document.addEventListener("pointerdown", () => Snd.unlock(), { capture: true });
function renderMute() { $("#muteBtn").textContent = Snd.muted ? "🔇" : "🔊"; }
$("#muteBtn").addEventListener("click", e => {
  e.stopPropagation();
  Snd.muted = !Snd.muted; store.set("blind-draw-muted2", Snd.muted);
  renderMute(); Snd.tap();
});
$("#muteBtn").addEventListener("pointerdown", e => e.stopPropagation());
renderMute();

/* ================= 首頁選項：題目包、開燈 / 關燈 ================= */
let litMode = store.get("blind-draw-lit2", false);
let themeKey = THEMES[store.get("blind-draw-theme", "mix")] ? store.get("blind-draw-theme", "mix") : "mix";
const modeName = lit => lit ? T("💡 開燈畫") : T("🌙 關燈畫");
const themeName = k => `${THEMES[k].icon} ${W(THEMES[k].name)}`;
function renderModes() {
  document.querySelectorAll(".mode button").forEach(b => b.classList.toggle("on", (b.dataset.lit === "1") === litMode));
}
document.querySelectorAll(".mode button").forEach(b => b.addEventListener("click", () => {
  litMode = b.dataset.lit === "1"; store.set("blind-draw-lit2", litMode);
  Snd.tap(); renderModes();
}));
function renderThemes() {
  const box = $("#themes"); box.innerHTML = "";
  Object.keys(THEMES).forEach(k => {
    const b = document.createElement("button");
    b.className = "theme" + (k === themeKey ? " on" : "");
    b.textContent = themeName(k);
    b.addEventListener("click", () => { themeKey = k; store.set("blind-draw-theme", k); Snd.tap(); renderThemes(); });
    box.appendChild(b);
  });
  const info = $("#dailyInfo");
  if (themeKey === "daily") {
    const done = store.get("blind-draw-daily", {});
    info.textContent = done.n === todayNo()
      ? T("今日挑戰 #{0}：你今天拿了 {1} 分，再玩分數不會變喔", todayNo(), done.score)
      : T("今日挑戰 #{0}：今天全世界都是同一組題目！", todayNo());
    info.hidden = false;
  } else info.hidden = true;
}
renderModes(); renderThemes();

$("#howBtn").addEventListener("click", () => { $("#howCard").hidden = !$("#howCard").hidden; Snd.tap(); });
$("#langBtn").textContent = LANG === "en" ? "中文" : "English";
$("#langBtn").addEventListener("click", () => setLang(LANG === "en" ? "zh" : "en"));
$("#verBtn").textContent = `v${VERSION} ${T("🆕 更新了什麼")}`;
$("#changes").innerHTML = `<ul>${CHANGES.map(c => `<li>${esc(T(c))}</li>`).join("")}</ul>`;
$("#verBtn").addEventListener("click", () => { $("#changes").hidden = !$("#changes").hidden; });

/* ================= 畫布 ================= */
const PAPER = "#fffdf7", PEN = "#2a2320";
function fitCanvas(cv) {
  const r = cv.getBoundingClientRect();
  const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
  cv.width = Math.max(1, Math.round(r.width * dpr));
  cv.height = Math.max(1, Math.round(r.height * dpr));
}
function penStyle(ctx) {
  ctx.lineWidth = ctx.canvas.width * .03;
  ctx.lineCap = "round"; ctx.lineJoin = "round";
  ctx.strokeStyle = PEN; ctx.fillStyle = PEN;
}
function drawSeg(ctx, a, b) {
  const Wd = ctx.canvas.width, H = ctx.canvas.height;
  if (!a) { ctx.beginPath(); ctx.arc(b.x * Wd, b.y * H, ctx.lineWidth / 2, 0, Math.PI * 2); ctx.fill(); }
  else { ctx.beginPath(); ctx.moveTo(a.x * Wd, a.y * H); ctx.lineTo(b.x * Wd, b.y * H); ctx.stroke(); }
}
function drawAll(ctx, strokes, upTo = Infinity) {
  ctx.fillStyle = PAPER; ctx.fillRect(0, 0, ctx.canvas.width, ctx.canvas.height);
  penStyle(ctx);
  for (const s of strokes) {
    if (!s) continue;
    let prev = null;
    for (const p of s) { if (p.t > upTo) break; drawSeg(ctx, prev, p); prev = p; }
  }
}
const encodePts = pts => pts.map(p => `${Math.round(p.x * 1000)},${Math.round(p.y * 1000)},${p.t}`).join(";");
const decodePts = str => String(str).split(";").map(s => { const [x, y, t] = s.split(",").map(Number); return { x: x / 1000, y: y / 1000, t }; })
  .filter(p => Number.isFinite(p.x) && Number.isFinite(p.y) && Number.isFinite(p.t));
function floatEmoji(container, e) {
  const el = document.createElement("div");
  el.className = "floaty"; el.textContent = REACTS[e] || "❓";
  el.style.left = (15 + Math.random() * 70) + "%";
  container.appendChild(el);
  setTimeout(() => el.remove(), 1700);
}

/* ================= Firebase（要連線玩時才連，首頁和單人模式不佔連線數） ================= */
const app = initializeApp(firebaseConfig);
let auth = null, db = null, uid = null, fbReady = null;
let offset = 0;
let connected = false, connWaiters = [];
const serverNow = () => mode === "solo" ? Date.now() : Date.now() + offset;

async function ensureOnline() {
  if (!fbReady) {
    fbReady = (async () => {
      auth = getAuth(app); db = getDatabase(app);
      onValue(ref(db, ".info/serverTimeOffset"), s => { offset = s.val() || 0; });
      onValue(ref(db, ".info/connected"), s => {
        connected = !!s.val();
        if (connected) { connWaiters.forEach(f => f()); connWaiters = []; }
        $("#netWarn").hidden = connected || !code;
        if (connected && code) armPresence();
      });
      const cred = await withTimeout(signInAnonymously(auth), 12000);
      uid = cred.user.uid;
    })().catch(e => { fbReady = null; throw e; });
  }
  await fbReady;
  goOnline(db);
  if (!connected) await withTimeout(new Promise(res => connWaiters.push(res)), 10000);
}
// 連不上時顯示原因：設定問題（匿名登入沒開、網域沒授權）跟人太多分開講，才知道要修哪裡
function showBusy(err) {
  const c = String((err && (err.code || err.message)) || "");
  let why = "";
  if (/admin-restricted|operation-not-allowed|ADMIN_ONLY/i.test(c)) why = T("原因：Firebase 的「匿名登入」還沒開啟");
  else if (/unauthorized-domain|api-key|invalid-api/i.test(c)) why = T("原因：Firebase 設定有問題（{0}）", c);
  else if (/network/i.test(c)) why = T("原因：網路連不上");
  else if (c) why = T("原因：{0}", c);
  $("#busyWhy").textContent = why; $("#busyWhy").hidden = !why;
  $("#busy").hidden = false;
}
$("#busyClose").addEventListener("click", () => { $("#busy").hidden = true; });
$("#busySolo").addEventListener("click", () => { $("#busy").hidden = true; startSolo(); });

/* ================= 狀態 ================= */
let mode = "duo";                      // duo：兩人連線；solo：電腦畫給你猜
let code = null, me = null, isHost = false;
let st = null, game = null, curRound = -1, curPhase = null, endedGame = null;
let rounds = [];
let deck = null;
const advanced = new Set();
let unsubs = [], roundUnsubs = [];
let partnerHere = false, partnerLostAt = 0;
let readyState = {};
let leaving = false, partnerLeft = false, starting = false;
let lastBeep = null;

const roomRef = () => ref(db, `rooms/${code}`);
const R = p => ref(db, `rooms/${code}/${p}`);
const inRoom = () => mode === "duo" && !!code;

const params = new URLSearchParams(location.search);
if (/^\d{4}$/.test(params.get("room") || "")) $("#codeInput").value = params.get("room");

function armPresence() {
  if (!inRoom() || !me) return;
  const p = R("presence/" + me);
  set(p, true).catch(() => {});
  onDisconnect(p).remove().catch(() => {});
  // 遊戲結束後，任何一方離線就刪除整個房間
  if (st && st.phase === "end") {
    onDisconnect(roomRef()).remove().catch(() => {});
    onDisconnect(ref(db, `ages/${code}`)).remove().catch(() => {});
  }
}

async function cleanupOldRooms() {
  try {
    // ages/ 只記房號和建立時間，用來找出超過 2 小時的舊房間
    const cutoff = serverNow() - OLD_ROOM_MS - 60000;
    const snap = await withTimeout(get(query(ref(db, "ages"), orderByValue(), endAt(cutoff), limitToFirst(50))), 6000);
    const jobs = [];
    snap.forEach(c => { jobs.push(remove(ref(db, `rooms/${c.key}`)).catch(() => {}).then(() => remove(c.ref)).catch(() => {})); });
    await Promise.all(jobs);
  } catch (e) { console.warn("cleanup", e); }
}

/* ================= 建立 / 加入 ================= */
$("#createBtn").addEventListener("click", async () => {
  Snd.tap();
  const btn = $("#createBtn"); btn.disabled = true; btn.textContent = T("連線中…");
  const done = () => { btn.disabled = false; btn.textContent = T("✏️ 建立房間（兩人）"); };
  try { await ensureOnline(); } catch (e) { console.warn(e); done(); showBusy(e); return; }
  await cleanupOldRooms();
  let made = null, lastErr = null;
  for (let i = 0; i < 12 && !made; i++) {
    const c = String(1000 + Math.floor(Math.random() * 9000));
    try {
      await withTimeout(update(ref(db), { [`rooms/${c}`]: { host: uid, createdAt: serverTimestamp() }, [`ages/${c}`]: serverTimestamp() }), 8000);
      made = c;
    } catch (e) { lastErr = e; if (e.message === "timeout") break; }
  }
  done();
  if (!made) {
    if (lastErr && lastErr.message === "timeout") { showBusy(lastErr); return; }
    const denied = /permission/i.test(String(lastErr && (lastErr.code || lastErr.message)));
    toast(denied ? T("建立房間失敗：資料庫拒絕寫入（請確認 Firebase 安全規則已發布）") : T("建立房間失敗：{0}", lastErr ? lastErr.message : "?"), 6000);
    return;
  }
  mode = "duo"; code = made; me = "A"; isHost = true;
  enterRoom();
  $("#codeDisplay").textContent = code;
  $("#lobbyHost").hidden = false; $("#lobbyGuest").hidden = true;
  $("#lobbyStatus").innerHTML = `${esc(T("等待玩家 B 加入"))}<span class="dots"></span>`;
  $("#lobbyRole").textContent = T("你是玩家 A・{0}・{1}", themeName(themeKey), modeName(litMode));
  show("lobby");
});

$("#codeInput").addEventListener("input", e => { e.target.value = e.target.value.replace(/\D/g, "").slice(0, 4); });
$("#codeInput").addEventListener("keydown", e => { if (e.key === "Enter") $("#joinBtn").click(); });
$("#joinBtn").addEventListener("click", async () => {
  Snd.tap();
  const c = $("#codeInput").value.trim();
  if (!/^\d{4}$/.test(c)) { toast(T("請輸入 4 位數字的房間代碼")); return; }
  const btn = $("#joinBtn"); btn.disabled = true;
  try { await ensureOnline(); } catch (e) { console.warn(e); btn.disabled = false; showBusy(e); return; }
  try { await withTimeout(set(ref(db, `rooms/${c}/guest`), uid), 8000); }
  catch (e) {
    btn.disabled = false;
    if (e.message === "timeout") showBusy(e); else toast(T("找不到這個房間，或房間已經滿了 🙈"));
    return;
  }
  btn.disabled = false;
  if (params.has("room")) history.replaceState(null, "", BASE_URL);
  mode = "duo"; code = c; me = "B"; isHost = false;
  enterRoom();
  $("#guestCode").textContent = code;
  $("#lobbyHost").hidden = true; $("#lobbyGuest").hidden = false;
  $("#lobbyStatus").innerHTML = `${esc(T("等待遊戲開始"))}<span class="dots"></span>`;
  $("#lobbyRole").textContent = T("你是玩家 B");
  show("lobby");
});

$("#shareCodeBtn").addEventListener("click", async () => {
  const url = `${INVITE_URL}?room=${code}`;
  const text = T("來玩《盲畫》！房間代碼：{0}", code);
  if (navigator.share) { try { await navigator.share({ text, url }); } catch {} return; }
  try { await navigator.clipboard.writeText(`${text}\n${url}`); toast(T("已複製邀請文字，貼給朋友吧！")); }
  catch { toast(T("房間代碼是 {0}", code)); }
});

$("#cancelBtn").addEventListener("click", () => { Snd.tap(); leaveRoom(); });
$("#homeBtn").addEventListener("click", () => { Snd.tap(); leaveRoom(); });
$("#ovBtn").addEventListener("click", () => { Snd.tap(); $("#overlay").hidden = true; leaveRoom(); });
$("#soloBtn").addEventListener("click", () => { Snd.tap(); startSolo(); });

function resetGameState() {
  leaving = false; partnerLeft = false; partnerHere = false; partnerLostAt = 0;
  st = null; game = null; curRound = -1; curPhase = null; endedGame = null; rounds = []; readyState = {};
}
function enterRoom() {
  resetGameState();
  armPresence();
  unsubs.push(onValue(R("createdAt"), s => { if (!s.exists()) roomGone(); }, () => roomGone()));
  unsubs.push(onValue(R("presence"), s => {
    const v = s.val() || {};
    const was = partnerHere;
    partnerHere = !!v[other(me)];
    if (partnerHere && !was) onPartnerArrive();
    if (!partnerHere && was) partnerLostAt = Date.now();
  }, () => {}));
  unsubs.push(onValue(R("state"), s => onState(s.val()), () => {}));
  unsubs.push(onValue(R("ready"), s => { readyState = s.val() || {}; onReady(); }, () => {}));
  requestWakeLock();
}

function teardown() {
  unsubs.forEach(f => f()); unsubs = [];
  roundUnsubs.forEach(f => f()); roundUnsubs = [];
  stopDrawing();
  $("#blackout").hidden = true;
  document.body.classList.remove("urgent");
  if (inRoom()) { onDisconnect(roomRef()).cancel().catch(() => {}); onDisconnect(ref(db, `ages/${code}`)).cancel().catch(() => {}); }
  code = null; me = null; isHost = false; st = null; game = null; curRound = -1; curPhase = null;
  $("#netWarn").hidden = true;
  releaseWakeLock();
}

async function leaveRoom() {
  leaving = true;
  const c = mode === "duo" ? code : null;
  teardown();
  rounds = [];
  mode = "duo";
  show("home"); renderThemes();
  if (c && db) {
    await update(ref(db), { [`rooms/${c}`]: null, [`ages/${c}`]: null }).catch(() => {});
    goOffline(db);   // 回到首頁就斷線，把連線名額讓給別人
  }
}

function roomGone() {
  if (leaving || !inRoom()) return;
  if (screen === "result" || screen === "gallery") {
    partnerLeft = true;
    teardown();
    if (db) goOffline(db);
    renderAgain();
    return;
  }
  teardown();
  rounds = [];
  if (db) goOffline(db);
  show("home");
  toast(T("房間已關閉，對方離開了 👋"), 3500);
}

function onPartnerArrive() {
  if (!st) {
    Snd.join();
    if (isHost) {
      $("#lobbyStatus").textContent = T("玩家 B 加入了！準備開始 🎉");
      setTimeout(() => { if (!st && partnerHere && code) startGame(); }, 1200);
    }
  }
}

/* ================= 出題 ================= */
// 最近玩過的詞記在這支手機上，下一局優先抽沒玩過的
const SEEN_KEY = "blind-draw-seen", SEEN_MAX = 400;
let seenWords = store.get(SEEN_KEY, []);
if (!Array.isArray(seenWords)) seenWords = [];
function markSeen(w) {
  seenWords = seenWords.filter(x => x !== w); seenWords.push(w);
  if (seenWords.length > SEEN_MAX) seenWords = seenWords.slice(-SEEN_MAX);
  store.set(SEEN_KEY, seenWords);
}
function buildDeck(tk, { solo = false } = {}) {
  const th = THEMES[tk];
  // 今日挑戰：用日期當種子，全世界同一組；只出單人也畫得出來（有 emoji）的題目
  const rng = th.seeded ? mulberry32(todayNo() * 7919 + 13) : Math.random;
  const needEmoji = solo || th.seeded;
  const seen = th.seeded ? new Set() : new Set(seenWords);
  const used = new Set(), usedGroups = new Set(), out = [];
  const ok = w => !needEmoji || !!EMOJI[w];
  const fresh = list => { const l = shuffle(list, rng); return l.find(w => !used.has(w) && !seen.has(w) && ok(w)) || l.find(w => !used.has(w) && ok(w)); };
  const add = (lv, cat, word, pool) => {
    used.add(word);
    const others = shuffle([...new Set(pool.filter(x => x !== word))], rng).slice(0, 3);
    out.push({ lv, cat, word, opts: shuffle([word, ...others], rng) });
  };
  const tagged = groups => th.tag ? groups.filter(g => g.t.split(" ").includes(th.tag)) : groups;
  const fromGroups = (lv, cat, groups) => {
    let open = shuffle(tagged(groups), rng).filter(g => !usedGroups.has(g) && fresh(g.w));
    if (!open.length) open = shuffle(groups, rng).filter(g => !usedGroups.has(g) && fresh(g.w));
    if (!open.length) open = shuffle(groups, rng).filter(g => fresh(g.w));
    const g = open.find(g => g.w.some(w => !seen.has(w))) || open[0];
    usedGroups.add(g);
    add(lv, cat, fresh(g.w), g.w);
  };
  const cats = () => th.cat ? [th.cat, ...shuffle(CONCRETE.filter(c => c !== th.cat), rng)] : shuffle(CONCRETE, rng);
  const catWithWord = () => cats().find(c => fresh(WORDS[c]));
  th.plan.forEach(lv => {
    if (th.allAbstract && lv === "簡單") {
      // 抽象包的簡單題：干擾選項來自別組，意思差很多
      const groups = shuffle(MOODS, rng).filter(g => !usedGroups.has(g) && fresh(g.w));
      const g = groups[0]; usedGroups.add(g);
      add(lv, "抽象", fresh(g.w), groups.slice(1, 4).map(x => pick(x.w, rng)));
    } else if (lv === "簡單") {
      const cat = catWithWord();
      // 西洋經典給外國玩家：干擾選項不放台灣在地的詞
      const others = CONCRETE.filter(c => c !== cat && !(th.tag === "world" && c === "台灣味"));
      add(lv, cat, fresh(WORDS[cat]), shuffle(others, rng).slice(0, 3).map(c => pick(WORDS[c], rng)));
    } else if (lv === "普通") {
      const cat = catWithWord();
      add(lv, cat, fresh(WORDS[cat]), WORDS[cat]);
    } else if (lv === "困難") fromGroups(lv, "長得很像", LOOKALIKE);
    else if (lv === "爆笑") fromGroups(lv, "爆笑", FUNNY);
    else fromGroups(lv, "抽象", MOODS);
  });
  // 搞怪回合：挑兩題（不會是前兩題）
  const keys = shuffle(Object.keys(MODS), rng);
  shuffle([2, 3, 4, 5, 6, 7, 8, 9], rng).slice(0, 2).forEach((r, i) => { out[r].mod = keys[i]; });
  return out;
}
function roundState(r, g, t0) {
  const d = deck[r];
  return { phase: "play", g, round: r, t0, word: d.word, cat: d.cat, lv: d.lv, opts: d.opts, lit: litMode, th: themeKey, mod: d.mod || "" };
}

/* ================= 遊戲流程（兩人時由玩家 A 主持；單人時自己主持） ================= */
async function startGame() {
  if (!isHost || starting) return;
  starting = true;
  try {
    deck = buildDeck(themeKey);
    const g = Date.now();
    await remove(R("ready")).catch(() => {});
    await set(R("state"), roundState(0, g, serverNow() + 1200));
  } catch (e) { console.error(e); toast(T("開始遊戲失敗，請重試")); }
  starting = false;
}
function startSolo() {
  if (inRoom()) return;
  teardown();
  mode = "solo"; me = "B"; isHost = true; code = null;
  resetGameState();
  deck = buildDeck(themeKey, { solo: true });
  requestWakeLock();
  onState(roundState(0, Date.now(), Date.now() + 600));
}
async function advance() {
  const r = st.round, g = st.g;
  advanced.add(g + ":" + r);
  const next = r + 1 < ROUNDS ? roundState(r + 1, g, serverNow() + 300) : { phase: "end", g, th: st.th };
  if (mode === "solo") { onState(next); return; }
  ["strokes", "answers", "fin", "reacts"].forEach(k => remove(R(`${k}/${r}`)).catch(() => {}));
  try { await set(R("state"), next); }
  catch (e) { console.error(e); advanced.delete(g + ":" + r); }
}

function onState(v) {
  st = v;
  if (!v) return;
  if (v.g !== game) {
    game = v.g; rounds = []; curRound = -1; curPhase = null; shareFile = null;
    partnerLeft = false;
    if (inRoom()) {
      // 新的一局：取消「結束後離線就刪房間」，重新掛上在線狀態
      onDisconnect(ref(db, `ages/${code}`)).cancel().catch(() => {});
      onDisconnect(roomRef()).cancel().then(armPresence).catch(() => {});
    }
  }
  if (v.phase === "play") { if (screen !== "game") show("game"); tick(); }
  else if (v.phase === "end") endGame();
}

const drawDur = s => s.mod === "fast" ? TIME.FAST : TIME.DRAW;
const firstAbstract = s => (THEMES[s.th] || THEMES.mix).plan.indexOf("抽象");
function timeline(s) {
  const intro = TIME.INTRO + (s.round === firstAbstract(s) && !(THEMES[s.th] || {}).allAbstract ? TIME.WARN : 0) + (s.mod ? TIME.MOD : 0);
  const peek = s.t0 + intro, draw = peek + TIME.PEEK;
  let end = draw + drawDur(s);
  // 猜的人一送出答案，這題就提早結束
  const rd = rounds[s.round];
  if (rd && rd.g === s.g && rd.pick !== null && rd.ms !== null) end = Math.min(end, draw + rd.ms + 500);
  return { peek, draw, end, rev: end + TIME.REVEAL, dur: drawDur(s) };
}
function phaseOf(now, tl) {
  return now < tl.peek ? "intro" : now < tl.draw ? "peek" : now < tl.end ? "draw" : now < tl.rev ? "reveal" : "done";
}
let tlCur = null;

function tick() {
  if (!st || st.phase !== "play" || (mode === "duo" && !code)) { document.body.classList.remove("urgent"); return; }
  const now = serverNow();
  const tl = timeline(st);
  tlCur = tl;
  const ph = phaseOf(now, tl);
  if (st.round !== curRound || ph !== curPhase) enterPhase(st.round, ph);
  if (mode === "solo" && ph === "draw") feedBot(rounds[curRound], now - tl.draw);
  updateTimers(now, tl, ph);
  if (mode === "duo") {
    const lost = !partnerHere && partnerLostAt && Date.now() - partnerLostAt > 6000;
    if (lost && $("#overlay").hidden) { $("#ovText").textContent = T("對方好像斷線了 😢 等待重新連線中…"); $("#overlay").hidden = false; }
    if (!lost && !$("#overlay").hidden) $("#overlay").hidden = true;
  }
  if (isHost && ph === "done" && !advanced.has(st.g + ":" + st.round)) advance();
}
setInterval(tick, 50);

function updateTimers(now, tl, ph) {
  let rem = tl.dur;
  if (ph === "draw") rem = tl.end - now;
  else if (ph === "reveal" || ph === "done") rem = 0;
  const secs = Math.ceil(rem / 1000);
  const timer = $("#timer"), num = $("#timerNum"), bt = $("#btimer");
  const txt = String(Math.max(0, secs));
  if (num.textContent !== txt) { num.textContent = txt; bt.textContent = txt; }
  timer.style.setProperty("--p", clamp(rem / tl.dur, 0, 1));
  const urgent = ph === "draw" && secs <= 3;
  timer.classList.toggle("urgent", urgent);
  bt.classList.toggle("urgent", urgent);
  $("#blackout").classList.toggle("urgent", urgent);
  document.body.classList.toggle("urgent", urgent);
  if (urgent && secs >= 1 && lastBeep !== secs) {
    lastBeep = secs;
    Snd.tick(secs); vibrate(40);
    retrigger(num, "pop"); retrigger(bt, "pop");
  }
}

const isDrawer = rd => rd.drawer === me;
const label = r => mode === "solo" ? (r === "A" ? T("🤖 電腦") : T("你")) : T("玩家 {0}", r);
const correctIdx = rd => rd.opts.indexOf(rd.word);
const scoreOf = rd => rd.pick !== null && rd.pick === correctIdx(rd) ? Math.max(10, Math.round(100 - 90 * rd.ms / rd.dur)) : 0;
const totalScore = () => rounds.reduce((s, rd) => s + (rd && rd.revealed ? scoreOf(rd) : 0), 0);
const modTag = m => MODS[m] ? `${MODS[m].icon} ${W(MODS[m].name)}` : "";

function startRound(r) {
  roundUnsubs.forEach(f => f()); roundUnsubs = [];
  const opts = Array.isArray(st.opts) ? st.opts : Object.values(st.opts || {});
  const rd = rounds[r] = {
    g: st.g, word: st.word, cat: st.cat, lv: st.lv, lit: !!st.lit, mod: st.mod || "", opts, dur: drawDur(st),
    drawer: mode === "solo" ? "A" : (r % 2 === 0 ? "A" : "B"), sel: null, pick: null, ms: null,
    strokes: [], reacts: [], revealed: false
  };
  curRound = r; lastBeep = null;
  markSeen(rd.word);
  const cv = $("#gcv");
  requestAnimationFrame(() => { fitCanvas(cv); drawAll(cv.getContext("2d"), rd.strokes); });
  if (mode === "solo") {
    rd.bot = botDrawing(EMOJI[rd.word] || "❓", { mod: rd.mod, dur: rd.dur });
    rd.botFed = rd.bot.map(() => 0);
  } else {
    if (!isDrawer(rd)) {
      roundUnsubs.push(onChildAdded(R("strokes/" + r), s => addChunk(r, s.val()), () => {}));
      roundUnsubs.push(onValue(R("fin/" + r), s => {
        if (s.val() && curRound === r && curPhase === "draw" && rd.pick === null) {
          $("#underMsg").textContent = T("✏️ 畫家說畫好了！選好答案按送出");
          Snd.tap();
        }
      }, () => {}));
    } else {
      // 畫家即時看到對方按的表情（看不到畫，但看得到對方在笑）
      roundUnsubs.push(onChildAdded(R("reacts/" + r), s => {
        const v = s.val(); if (!v || typeof v.e !== "number") return;
        rd.reacts.push({ e: v.e, t: v.t });
        if (curRound === r) floatEmoji($("#blackout").hidden ? $("#stage") : $("#blackout"), v.e);
      }, () => {}));
    }
    roundUnsubs.push(onValue(R("answers/" + r), s => {
      const v = s.val();
      if (v && rd.pick === null) { rd.pick = v.pick; rd.ms = v.ms; if (curRound === r && curPhase === "reveal") renderReveal(false); }
    }, () => {}));
  }
  const box = $("#opts"); box.innerHTML = "";
  if (!isDrawer(rd)) {
    rd.opts.forEach((o, i) => {
      const b = document.createElement("button");
      b.className = "opt"; b.textContent = W(o); b.disabled = true;
      b.addEventListener("click", () => choose(r, i));
      box.appendChild(b);
    });
  }
  $("#sendBtn").hidden = isDrawer(rd); $("#sendBtn").disabled = true;
  $("#reacts").hidden = isDrawer(rd);
  $("#roundNo").textContent = T("第 {0} / {1} 題", r + 1, ROUNDS);
  $("#modChip").textContent = modTag(rd.mod); $("#modChip").hidden = !rd.mod;
  const chip = $("#roleChip");
  chip.textContent = isDrawer(rd) ? T("✏️ 你是畫家") : T("👀 換你猜");
  chip.classList.toggle("draw", isDrawer(rd));
}

// 單人模式：照時間把電腦的線一點一點畫出來
function feedBot(rd, elapsed) {
  if (!rd || !rd.bot) return;
  const ctx = $("#gcv").getContext("2d"); penStyle(ctx);
  rd.bot.forEach((s, i) => {
    let k = rd.botFed[i];
    if (k >= s.length || s[k].t > elapsed) return;
    const arr = rd.strokes[i] || (rd.strokes[i] = []);
    while (k < s.length && s[k].t <= elapsed) { drawSeg(ctx, arr[arr.length - 1] || null, s[k]); arr.push(s[k]); k++; }
    rd.botFed[i] = k;
  });
}

function enterPhase(r, ph) {
  if (r !== curRound || !rounds[r]) startRound(r);
  curPhase = ph;
  const rd = rounds[r];
  const drawer = isDrawer(rd);
  const msg = $("#stageMsg"), under = $("#underMsg"), banner = $("#banner");
  banner.hidden = true;
  $("#scoreNow").textContent = totalScore();

  if (ph === "intro") {
    $("#blackout").hidden = true;
    const th = THEMES[st.th] || THEMES.mix;
    const warn = r === firstAbstract(st) && !th.allAbstract
      ? `<div class="warn">${esc(T("⚠️ 抽象題來了！"))}<br>${esc(T("接下來是「畫不出來」的東西 😈"))}</div>` : "";
    const hardNote = rd.lv === "困難" && rounds[r - 1]?.lv !== "困難" ? `<div class="sub">${esc(T("選項開始長得很像了 👀"))}</div>` : "";
    const mod = rd.mod ? `<div class="warn mod">${esc(T("搞怪回合！"))} ${esc(modTag(rd.mod))}<br><small>${esc(W(MODS[rd.mod].desc))}</small></div>` : "";
    const sub = mode === "solo" ? T("🤖 電腦是畫家") : drawer ? T("準備好你的手指") : T("{0} 是畫家", label(other(me)));
    msg.innerHTML = `<div class="sub">${esc(T("第 {0} 題", r + 1))}・${esc(mode === "solo" ? themeName(st.th) : modeName(rd.lit))}</div>
      <div class="lv${rd.lv === "簡單" ? "" : " hard"}">${esc(W(LV_BADGE[rd.lv] || rd.lv))}</div>
      <div class="big">${esc(drawer ? T("✏️ 換你畫了！") : T("👀 換你猜了！"))}</div>${warn}${mod}${hardNote}
      <div class="sub">${esc(sub)}</div>`;
    msg.hidden = false;
    under.textContent = "";
    if (warn || mod) { vibrate(80); Snd.boing(); }
  } else if (ph === "peek") {
    Snd.peek();
    if (drawer) {
      const hint = rd.mod === "oneline" ? T("只能一筆！手指離開螢幕就結束")
        : rd.lit ? T("2 秒後開始畫，畫完可以按「畫好了」") : T("2 秒後螢幕變黑，憑感覺用手指畫出來！");
      msg.innerHTML = `<div class="sub">${esc(T("你的題目是"))}（${esc(W(LV_BADGE[rd.lv] || rd.lv))}）</div><div class="word">${esc(W(rd.word))}</div>
        <div class="peekbar"><i></i></div><div class="sub">${esc(hint)}</div>${rd.mod ? `<div class="sub">${esc(modTag(rd.mod))}</div>` : ""}`;
    } else {
      msg.innerHTML = `<div class="big bounce">${mode === "solo" ? "🤖" : "🙈"}</div><div class="mid">${esc(mode === "solo" ? T("電腦正在偷看題目…") : T("畫家正在偷看題目…"))}</div>
        <div class="sub">${esc(T("線條會一筆一筆出現，看懂了就搶答，越快分數越高！"))}</div>`;
    }
    msg.hidden = false;
  } else if (ph === "draw") {
    Snd.go();
    if (drawer) {
      msg.innerHTML = `<div class="mid">${esc(T("🖤 畫畫中…"))}</div>`; msg.hidden = false;
      const bo = $("#blackout");
      bo.classList.toggle("lit", rd.lit);
      $("#bhint").textContent = rd.mod === "oneline" ? T("只能一筆！✍️") : rd.lit ? T("開始畫！✏️") : T("憑感覺畫！✏️");
      retrigger($("#bhint"), "fade");
      $("#bwait").hidden = true; $("#doneBtn").hidden = false;
      bo.hidden = false;
      startDrawing(r);
    } else {
      msg.hidden = true;
      $("#opts").querySelectorAll(".opt").forEach(b => { b.disabled = rd.pick !== null; });
      $("#sendBtn").disabled = rd.sel === null || rd.pick !== null;
      under.textContent = rd.pick === null ? T("選好答案按送出，越快分數越高！") : "";
    }
  } else if (ph === "reveal") {
    if (drawer) { stopDrawing(); $("#blackout").hidden = true; }
    // 時間到但選了沒送出：直接幫忙送出
    else if (rd.pick === null && rd.sel !== null) submitAnswer(r, rd.dur);
    if (mode === "solo") feedBot(rd, Infinity);
    document.body.classList.remove("urgent");
    Snd.buzz();
    rd.revealed = true;
    renderReveal(true);
  } else if (ph === "done") {
    $("#underMsg").textContent = r + 1 < ROUNDS ? T("下一題準備中…") : T("計算分數中…");
  }
}

function renderReveal(withSound) {
  const rd = rounds[curRound];
  if (!rd) return;
  const drawer = isDrawer(rd);
  const ci = correctIdx(rd), sc = scoreOf(rd);
  const ok = rd.pick !== null && rd.pick === ci;
  const result = rd.pick === null ? `<span class="result-bad">${esc(T("⏰ 沒有作答"))}</span>`
    : ok ? `<span class="result-ok">${esc(T("🎉 答對了！+{0}", sc))}</span>` : `<span class="result-bad">${esc(T("😵 猜錯了"))}</span>`;
  $("#scoreNow").textContent = totalScore();
  if (drawer) {
    const g = rd.pick === null ? T("（沒作答）") : W(rd.opts[rd.pick]);
    $("#stageMsg").innerHTML = `<div class="mid">${result}</div><div class="sub">${esc(T("題目"))}</div><div class="word">${esc(W(rd.word))}</div>
      <div class="sub">${esc(T("{0} 猜：", label(other(me))))}<b>${esc(g)}</b></div>
      <div class="sub">${esc(rd.lit ? T("到畫廊可以看重播 🎬") : T("你畫了什麼？到畫廊才揭曉 🤭"))}</div>`;
    $("#stageMsg").hidden = false;
    $("#underMsg").textContent = "";
  } else {
    $("#sendBtn").hidden = true;
    $("#opts").querySelectorAll(".opt").forEach((b, i) => {
      b.disabled = true;
      b.classList.toggle("right", i === ci);
      b.classList.toggle("wrong", i === rd.pick && !ok);
    });
    const banner = $("#banner"); banner.innerHTML = result; banner.hidden = false;
    $("#underMsg").textContent = T("答案是「{0}」", W(rd.word));
  }
  if (withSound) {
    setTimeout(() => { ok ? Snd.correct() : Snd.wrong(); }, 350);
    if (ok) vibrate(30);
  }
}

function choose(r, i) {
  const rd = rounds[r];
  if (!rd || curRound !== r || curPhase !== "draw" || rd.pick !== null) return;
  rd.sel = i;
  Snd.tap();
  $("#opts").querySelectorAll(".opt").forEach((b, j) => b.classList.toggle("picked", j === i));
  $("#sendBtn").disabled = false;
}
function submitAnswer(r, forcedMs) {
  const rd = rounds[r];
  if (!rd || rd.pick !== null || rd.sel === null) return;
  rd.pick = rd.sel;
  rd.ms = forcedMs ?? Math.round(clamp(serverNow() - tlCur.draw, 0, rd.dur));
  if (inRoom()) set(R("answers/" + r), { pick: rd.pick, ms: rd.ms }).catch(() => {});
  Snd.lock(); vibrate(20);
  $("#opts").querySelectorAll(".opt").forEach(b => { b.disabled = true; });
  $("#sendBtn").disabled = true;
  $("#underMsg").textContent = T("已送出「{0}」！", W(rd.opts[rd.pick]));
}
$("#sendBtn").addEventListener("click", () => { if (curPhase === "draw") submitAnswer(curRound); });

// 猜的人按表情：自己看到飄起來，畫家即時看到，重播時也會出現
$("#reacts").querySelectorAll("button").forEach((b, e) => b.addEventListener("click", () => {
  const rd = rounds[curRound];
  if (!rd || !["peek", "draw", "reveal"].includes(curPhase) || rd.reacts.length >= 40) return;
  const t = Math.round(clamp(serverNow() - tlCur.draw, 0, 20000));
  rd.reacts.push({ e, t });
  floatEmoji($("#stage"), e); Snd.pop();
  if (inRoom()) push(R("reacts/" + curRound), { e, t }).catch(() => {});
}));

function addChunk(r, v) {
  const rd = rounds[r];
  if (!rd || !v || typeof v.s !== "number") return;
  const pts = decodePts(v.p);
  if (!pts.length) return;
  const arr = rd.strokes[v.s] || (rd.strokes[v.s] = []);
  let prev = arr[arr.length - 1] || null;
  arr.push(...pts);
  if (r === curRound) {
    const ctx = $("#gcv").getContext("2d");
    penStyle(ctx);
    for (const p of pts) { drawSeg(ctx, prev, p); prev = p; }
  }
}

/* ================= 畫家：盲畫 ================= */
let drawing = false, drawRound = -1, activePid = null, curStroke = null, pending = [], flushTimer = null;
function startDrawing(r) {
  drawing = true; drawRound = r; activePid = null; curStroke = null; pending = [];
  clearInterval(flushTimer); flushTimer = setInterval(flush, 80);
  if (rounds[r]?.lit) requestAnimationFrame(() => { const cv = $("#dcv"); fitCanvas(cv); drawAll(cv.getContext("2d"), rounds[r].strokes); });
}
function stopDrawing() {
  if (drawing) flush();
  drawing = false; activePid = null; curStroke = null;
  clearInterval(flushTimer); flushTimer = null;
}
function addPoint(ev) {
  if (!curStroke) return;
  const rd = rounds[drawRound];
  const rect = $("#bbox").getBoundingClientRect();
  let x = clamp((ev.clientX - rect.left) / rect.width, 0, 1);
  let y = clamp((ev.clientY - rect.top) / rect.height, 0, 1);
  // 搞怪回合：手抖、左右顛倒
  if (rd.mod === "shaky") { x = clamp(x + (Math.random() - .5) * .035, 0, 1); y = clamp(y + (Math.random() - .5) * .035, 0, 1); }
  if (rd.mod === "mirror") x = 1 - x;
  const t = Math.round(clamp(serverNow() - tlCur.draw, 0, rd.dur));
  const pts = curStroke.pts, last = pts[pts.length - 1];
  if (last && rd.mod !== "shaky" && Math.hypot(x - last.x, y - last.y) < .004) return;
  const p = { x: Math.round(x * 1000) / 1000, y: Math.round(y * 1000) / 1000, t };
  pts.push(p);
  if (rd.lit) { const ctx = $("#dcv").getContext("2d"); penStyle(ctx); drawSeg(ctx, last || null, p); }
  let e = pending[pending.length - 1];
  if (!e || e.s !== curStroke.s || e.pts.length >= 150) { e = { s: curStroke.s, pts: [] }; pending.push(e); }
  e.pts.push(p);
}
function flush() {
  if (!pending.length || !inRoom()) return;
  const batch = pending; pending = [];
  for (const e of batch) if (e.pts.length) push(R("strokes/" + drawRound), { s: e.s, p: encodePts(e.pts) }).catch(() => {});
}
const bo = $("#blackout");
bo.addEventListener("pointerdown", e => {
  e.preventDefault();
  if (!drawing || activePid !== null) return;
  const rd = rounds[drawRound]; if (!rd || rd.strokes.length >= 400) return;
  activePid = e.pointerId;
  try { bo.setPointerCapture(e.pointerId); } catch {}
  curStroke = { s: rd.strokes.length, pts: [] };
  rd.strokes.push(curStroke.pts);
  addPoint(e);
});
bo.addEventListener("pointermove", e => {
  if (!drawing || e.pointerId !== activePid) return;
  const evs = e.getCoalescedEvents ? e.getCoalescedEvents() : [];
  (evs.length ? evs : [e]).forEach(addPoint);
});
const endStroke = e => {
  if (e.pointerId !== activePid) return;
  activePid = null; curStroke = null;
  if (rounds[drawRound]?.mod === "oneline") finishDrawing();   // 只能一筆：手指離開就結束
};
bo.addEventListener("pointerup", endStroke);
bo.addEventListener("pointercancel", endStroke);
bo.addEventListener("touchmove", e => e.preventDefault(), { passive: false });
function finishDrawing() {
  if (!drawing) return;
  const r = drawRound;
  stopDrawing();
  Snd.lock();
  if (inRoom()) set(R("fin/" + r), true).catch(() => {});
  $("#doneBtn").hidden = true; $("#bwait").hidden = false;
}
$("#doneBtn").addEventListener("pointerdown", e => e.stopPropagation());
$("#doneBtn").addEventListener("click", finishDrawing);

/* ================= 結算 ================= */
function commentFor(total) {
  if (total >= 800) return mode === "solo" ? T("你跟電腦心靈相通，有點可怕 🤖💞") : T("你們是心靈相通的畫家 💞");
  if (total >= 600) return T("默契好到可以去上綜藝節目了 📺");
  if (total >= 400) return T("有點默契，也有點靈異 👻");
  if (total >= 200) return T("這是抽象派吧 🎨");
  if (total > 0) return T("畢卡索看了都說讚（看不懂的那種）🖼️");
  return T("你們確定是在玩同一個遊戲嗎？🤔");
}
const squares = () => rounds.map(rd => rd.pick === null ? "⬜" : scoreOf(rd) > 0 ? "🟩" : "🟥").join("");
function endGame() {
  if (endedGame === game) return;
  endedGame = game;
  stopDrawing();
  roundUnsubs.forEach(f => f()); roundUnsubs = [];
  $("#blackout").hidden = true; $("#overlay").hidden = true;
  document.body.classList.remove("urgent");
  rounds.forEach(rd => { if (rd) rd.revealed = true; });
  const total = totalScore();
  const correct = rounds.filter(rd => rd && scoreOf(rd) > 0).length;
  if (st.th === "daily") {
    const done = store.get("blind-draw-daily", {});
    if (done.n !== todayNo()) store.set("blind-draw-daily", { n: todayNo(), score: total, sq: squares() });
  }
  $("#resultTheme").textContent = themeName(st.th || "mix") + (st.th === "daily" ? ` #${todayNo()}` : "");
  $("#finalCorrect").textContent = T("答對 {0} / {1} 題", correct, ROUNDS);
  $("#finalSquares").textContent = squares();
  $("#finalComment").textContent = commentFor(total);
  readyState = {};
  renderAgain();
  show("result");
  Snd.fanfare();
  armPresence();
  const el = $("#finalScore"), t0 = performance.now();
  (function count(now) {
    const k = clamp((now - t0) / 1200, 0, 1);
    el.textContent = Math.round(total * (1 - Math.pow(1 - k, 3)));
    if (k < 1) requestAnimationFrame(count);
  })(t0);
  buildShareImage(total, correct).catch(e => console.warn("share image", e));
}

$("#againBtn").addEventListener("click", () => {
  Snd.tap();
  if (mode === "solo") { startSolo(); return; }
  if (!code || partnerLeft) return;
  set(R("ready/" + me), true).catch(() => {});
});
function onReady() {
  renderAgain();
  if (isHost && readyState.A && readyState.B && st && st.phase === "end") startGame();
}
function renderAgain() {
  const btn = $("#againBtn"), s = $("#againStatus");
  $("#modeResult").hidden = mode === "solo" || !isHost || partnerLeft || !code;
  if (mode === "solo") { btn.disabled = false; btn.textContent = T("🔁 再玩一局"); s.textContent = ""; return; }
  if (partnerLeft || !code) { btn.disabled = true; s.textContent = T("對方已經離開房間了，畫廊還能看到你關掉網頁為止"); return; }
  const mine = !!readyState[me], theirs = !!readyState[other(me)];
  btn.disabled = mine;
  btn.textContent = mine ? T("⏳ 等待對方…") : T("🔁 再玩一局");
  s.textContent = theirs && !mine ? T("{0} 想再玩一局！", label(other(me))) : mine ? T("對方按下「再玩一局」就會開始") : "";
}

/* ================= 畫廊（重播，表情也會跟著飄出來） ================= */
let gi = 0, speed = 1, replayRaf = null;
$("#galleryBtn").addEventListener("click", () => { Snd.tap(); show("gallery"); showCard(0); });
$("#galBack").addEventListener("click", () => { cancelAnimationFrame(replayRaf); show("result"); });
$("#galPrev").addEventListener("click", () => showCard((gi - 1 + rounds.length) % rounds.length));
$("#galNext").addEventListener("click", () => showCard((gi + 1) % rounds.length));
$("#galReplay").addEventListener("click", () => startReplay());
$("#speedBtn").addEventListener("click", () => { speed = speed === 1 ? 2 : 1; $("#speedBtn").textContent = speed + "x"; startReplay(); });

function showCard(i) {
  if (!rounds.length) return;
  gi = i; Snd.tap();
  const rd = rounds[i];
  if (!rd) return;
  $("#galIdx").textContent = `${i + 1} / ${rounds.length}`;
  const who = mode === "solo" ? T("🤖 電腦畫") : T("{0} 畫", label(rd.drawer)) + (isDrawer(rd) ? T("（你畫的！）") : "");
  $("#galTitle").textContent = `${T("第 {0} 題", i + 1)}・${who}・${W(LV_BADGE[rd.lv] || "")}${rd.mod ? "・" + modTag(rd.mod) : ""}`;
  $("#galWord").textContent = W(rd.word);
  const ok = scoreOf(rd) > 0;
  $("#galGuess").textContent = rd.pick === null ? T("⏰ 沒作答") : `${W(rd.opts[rd.pick])} ${ok ? "✅ +" + scoreOf(rd) : "❌"}`;
  $("#galGuess").style.color = ok ? "var(--green)" : "var(--red)";
  requestAnimationFrame(() => { fitCanvas($("#galcv")); startReplay(); });
}
function startReplay() {
  cancelAnimationFrame(replayRaf);
  const rd = rounds[gi]; if (!rd) return;
  const ctx = $("#galcv").getContext("2d");
  const ts = rd.strokes.flat().filter(Boolean).map(p => p.t);
  const prog = $("#galProg");
  if (!ts.length) {
    drawAll(ctx, []);
    ctx.fillStyle = "#b9aaa2"; ctx.font = `${ctx.canvas.width * .06}px Huninn, sans-serif`; ctx.textAlign = "center";
    ctx.fillText(T("（畫家什麼都沒畫到 😶）"), ctx.canvas.width / 2, ctx.canvas.height / 2);
    prog.style.width = "100%";
    return;
  }
  const from = Math.max(0, Math.min(...ts) - 300), to = Math.max(...ts, ...rd.reacts.map(r => r.t)) + 300;
  const start = performance.now();
  const shown = new Set();
  const frame = now => {
    const tt = from + (now - start) * speed;
    drawAll(ctx, rd.strokes, tt);
    rd.reacts.forEach((r, k) => { if (r.t <= tt && !shown.has(k)) { shown.add(k); floatEmoji($("#galStage"), r.e); } });
    prog.style.width = clamp((tt - from) / (to - from), 0, 1) * 100 + "%";
    if (tt < to) replayRaf = requestAnimationFrame(frame);
  };
  replayRaf = requestAnimationFrame(frame);
}

/* ================= 分享拼圖 ================= */
let shareFile = null, shareUrl = null;
async function buildShareImage(total, correct) {
  shareFile = null;
  try { await document.fonts.load("40px Huninn"); } catch {}
  // 正方形 1080x1080：上面標題、中間 5x2 作品、下面網址
  const Wd = 1080, H = 1080, cols = 5, pad = 36, gap = 18, tileW = 186, tileH = 248, labelH = 74, headH = 250, rowGap = 22;
  const c = document.createElement("canvas"); c.width = Wd; c.height = H;
  const x = c.getContext("2d");
  const F = (size, bold) => `${bold ? "bold " : ""}${size}px Huninn, "PingFang TC", "Noto Sans TC", sans-serif`;
  x.fillStyle = "#fdf6e6"; x.fillRect(0, 0, Wd, H);
  x.strokeStyle = "#dbe7f3"; x.lineWidth = 2;
  for (let yy = 40; yy < H; yy += 44) { x.beginPath(); x.moveTo(0, yy); x.lineTo(Wd, yy); x.stroke(); }
  x.textAlign = "center"; x.fillStyle = "#3a2e2a";
  const title = T("盲畫") + (st.th === "daily" ? ` #${todayNo()}` : "") + (mode === "solo" ? " 🤖" : "");
  x.font = F(LANG === "en" ? 80 : 96, true); x.fillText(title, Wd / 2, 110);
  x.font = F(40); x.fillText(T("合作分數 {0} / 1000・答對 {1} 題", total, correct), Wd / 2, 172, Wd - 2 * pad);
  x.font = F(36); x.fillStyle = "#e0566f"; x.fillText(commentFor(total), Wd / 2, 226, Wd - 2 * pad);
  const gridW = cols * tileW + (cols - 1) * gap, left = (Wd - gridW) / 2;
  const tile = document.createElement("canvas"); tile.width = tileW * 2; tile.height = tileH * 2;
  const tx = tile.getContext("2d");
  rounds.forEach((rd, i) => {
    if (!rd) return;
    const col = i % cols, row = Math.floor(i / cols);
    const ox = left + col * (tileW + gap), oy = headH + row * (tileH + labelH + rowGap);
    drawAll(tx, rd.strokes);
    x.save();
    x.fillStyle = "#3a2e2a"; roundRect(x, ox + 4, oy + 4, tileW, tileH, 16); x.fill();
    roundRect(x, ox, oy, tileW, tileH, 16); x.clip(); x.drawImage(tile, ox, oy, tileW, tileH);
    x.restore();
    x.lineWidth = 3.5; x.strokeStyle = "#3a2e2a"; roundRect(x, ox, oy, tileW, tileH, 16); x.stroke();
    const ok = scoreOf(rd) > 0;
    const guessTxt = rd.pick === null ? T("沒作答") : W(rd.opts[rd.pick]);
    x.textAlign = "left";
    x.fillStyle = "#8a7a72"; x.font = F(23); x.fillText(T("題：{0}", W(rd.word)), ox + 2, oy + tileH + 32, tileW);
    x.fillStyle = ok ? "#2f9e67" : "#e04848"; x.font = F(25, true);
    x.fillText(T("猜：{0}", guessTxt) + (ok ? " ✅" : " ❌"), ox + 2, oy + tileH + 64, tileW);
  });
  x.textAlign = "center"; x.fillStyle = "#3a2e2a"; x.font = F(30);
  x.fillText(T("閉著眼睛畫，你猜得出來嗎？一起來玩 👇"), Wd / 2, H - 70, Wd - 2 * pad);
  x.font = F(28); x.fillStyle = "#4a7fc0"; x.fillText(SHARE_URL, Wd / 2, H - 28, Wd - 72);
  const blob = await new Promise(res => c.toBlob(res, "image/png"));
  if (!blob) return;
  shareFile = new File([blob], "blind-draw.png", { type: "image/png" });
  if (shareUrl) URL.revokeObjectURL(shareUrl);
  shareUrl = URL.createObjectURL(blob);
}
function roundRect(x, l, t, w, h, r) {
  x.beginPath(); x.moveTo(l + r, t); x.arcTo(l + w, t, l + w, t + h, r); x.arcTo(l + w, t + h, l, t + h, r);
  x.arcTo(l, t + h, l, t, r); x.arcTo(l, t, l + w, t, r); x.closePath();
}
function shareText() {
  const head = st.th === "daily" ? T("盲畫 今日挑戰 #{0}", todayNo()) + (mode === "solo" ? " 🤖" : "") : T("盲畫") + (mode === "solo" ? " 🤖" : "");
  return `${head}\n${squares()}\n${T("{0} 分・答對 {1}/10", totalScore(), rounds.filter(rd => scoreOf(rd) > 0).length)}\n${SHARE_URL}`;
}
$("#shareBtn").addEventListener("click", async () => {
  Snd.tap();
  if (!shareFile) { toast(T("圖片準備中，請再按一次 🙏")); return; }
  const text = shareText();
  if (navigator.canShare && navigator.canShare({ files: [shareFile] })) {
    try { await navigator.share({ files: [shareFile], text }); return; } catch (e) { if (e && e.name === "AbortError") return; }
  }
  $("#shareImg").src = shareUrl; $("#shareDl").href = shareUrl;
  $("#shareOverlay").hidden = false;
});
$("#copyBtn").addEventListener("click", async () => {
  Snd.tap();
  try { await navigator.clipboard.writeText(shareText()); toast(T("成績已複製，貼到群組吧！")); }
  catch { toast(shareText(), 5000); }
});
$("#shareClose").addEventListener("click", () => { $("#shareOverlay").hidden = true; });

/* ================= 螢幕常亮 ================= */
let wakeLock = null;
async function requestWakeLock() { try { wakeLock = await navigator.wakeLock?.request("screen"); } catch {} }
function releaseWakeLock() { try { wakeLock?.release(); } catch {} wakeLock = null; }
document.addEventListener("visibilitychange", () => { if (document.visibilityState === "visible" && (code || mode === "solo")) requestWakeLock(); });
window.addEventListener("resize", () => {
  if (screen === "game" && rounds[curRound]) { const cv = $("#gcv"); fitCanvas(cv); drawAll(cv.getContext("2d"), rounds[curRound].strokes); }
});
