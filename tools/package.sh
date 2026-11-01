#!/usr/bin/env bash
# 打包《盲畫》給 itch.io 和 Newgrounds。在一般 Mac 上可直接跑（只用 bash、zip、perl）。
#
# 用法：
#   ./tools/package.sh [itch 遊戲頁網址] [Newgrounds 遊戲頁網址]
# 例如：
#   ./tools/package.sh https://xxx.itch.io/blind-draw https://www.newgrounds.com/portal/view/123456
#
# 產出（在 repo 的 dist/ 資料夾）：
#   blind-draw-itch-<版本>.zip         上傳到 itch.io（勾 This file will be played in the browser）
#   blind-draw-newgrounds-<版本>.zip   上傳到 Newgrounds
# 遊戲本體沒有 AI 圖，兩個 zip 只差在分享連結指向哪個遊戲頁。
set -euo pipefail

cd "$(dirname "$0")/.."
ROOT="$(pwd)"
VERSION="$(tr -d ' \n' < VERSION)"
PAGES_URL="https://mochachen1225-create.github.io/draw-to-guess/"
ITCH_URL="${1:-$PAGES_URL}"
NG_URL="${2:-$PAGES_URL}"

build() {
  local name="$1" game_url="$2"
  local tmp; tmp="$(mktemp -d)"
  cp index.html "$tmp/"
  mkdir -p "$tmp/js"
  cp js/*.js "$tmp/js/"
  # 在第一個 script 前插入網址設定：分享連結指向遊戲頁，房間邀請連結指向可以直接開的 GitHub Pages
  GAME_URL="$game_url" INVITE_URL="$PAGES_URL" perl -0pi -e \
    's{<script src="js/i18n\.js}{<script>window.GAME_URL="$ENV{GAME_URL}";window.INVITE_URL="$ENV{INVITE_URL}";</script>\n<script src="js/i18n.js}' \
    "$tmp/index.html"
  grep -q 'window.GAME_URL' "$tmp/index.html" || { echo "插入網址設定失敗" >&2; exit 1; }
  mkdir -p "$ROOT/dist"
  local out="$ROOT/dist/blind-draw-$name-$VERSION.zip"
  rm -f "$out"
  (cd "$tmp" && zip -qr "$out" index.html js)   # index.html 一定要在 zip 最外層
  rm -rf "$tmp"
  echo "✅ $out"
}

build itch "$ITCH_URL"
build newgrounds "$NG_URL"
echo "版本 $VERSION 打包完成。上傳前可以解壓縮，用 python3 -m http.server 打開 index.html 測一次。"
