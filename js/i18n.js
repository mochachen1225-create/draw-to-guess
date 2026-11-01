// 語言：玩家選過就照選的；在 itch.io、Newgrounds 上預設英文；其他看瀏覽器語言
const LANG = (() => {
  try { const s = localStorage.getItem("blind-draw-lang"); if (s === "zh" || s === "en") return s; } catch {}
  if (/(^|\.)(itch\.io|itch\.zone|hwcdn\.net|newgrounds\.com|ungrounded\.net)$/.test(location.hostname)) return "en";
  return /^zh/i.test(navigator.language || "") ? "zh" : "en";
})();
document.documentElement.lang = LANG === "en" ? "en" : "zh-Hant";

// 介面字串：中文原文當 key，英文對照放在 i18n.en.js；{0}、{1} 是參數
const I18N = { en: {} };
function T(s, ...a) {
  const r = LANG === "en" ? (I18N.en[s] ?? s) : s;
  return r.replace(/\{(\d+)\}/g, (m, i) => (a[+i] !== undefined ? a[+i] : m));
}
// 題目和資料標籤：英文對照在 words.en.js
function W(w) { return LANG === "en" && typeof EN_WORDS !== "undefined" ? (EN_WORDS[w] || w) : w; }

// HTML 裡標了 data-t 的元素整段換成英文；data-tp 是 placeholder
function applyStatic() {
  if (LANG !== "en") return;
  document.querySelectorAll("[data-t]").forEach(el => { el.innerHTML = T(el.innerHTML.trim()); });
  document.querySelectorAll("[data-tp]").forEach(el => { el.placeholder = T(el.dataset.tp); });
}
function setLang(l) {
  try { localStorage.setItem("blind-draw-lang", l); } catch {}
  location.reload();
}
