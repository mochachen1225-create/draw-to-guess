// 單人模式的電腦畫家：把 emoji 畫在小畫布上，找出輪廓和顏色交界，
// 描成一筆一筆的線，再故意「畫爛」（整體歪掉、越畫越偏、手抖、漏掉幾筆）。
// 回傳 [[{x, y, t}, …], …]，x、y 是 0～1，t 是第幾毫秒畫到。

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6D2B79F5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function splitEmoji(str) {
  if (typeof Intl !== "undefined" && Intl.Segmenter) {
    return [...new Intl.Segmenter(undefined, { granularity: "grapheme" }).segment(str)].map(s => s.segment);
  }
  return Array.from(str);
}

function traceEmoji(str) {
  const N = 150;
  const cv = document.createElement("canvas"); cv.width = cv.height = N;
  const x = cv.getContext("2d", { willReadFrequently: true });
  const parts = splitEmoji(str);
  // 一個 emoji 畫大大的；兩個是「主角 + 配件」；三個排成一排
  const layouts = {
    1: [[.5, .52, 112]],
    2: [[.42, .58, 88], [.74, .3, 60]],
    3: [[.18, .5, 58], [.5, .5, 58], [.82, .5, 58]]
  };
  const lay = layouts[Math.min(parts.length, 3)] || layouts[1];
  x.textAlign = "center"; x.textBaseline = "middle";
  parts.slice(0, 3).forEach((p, i) => {
    const [cx, cy, size] = lay[i];
    x.font = `${size}px "Apple Color Emoji","Segoe UI Emoji","Noto Color Emoji",sans-serif`;
    x.fillText(p, cx * N, cy * N);
  });
  const d = x.getImageData(0, 0, N, N).data;
  const A = (i, j) => (i < 0 || j < 0 || i >= N || j >= N) ? 0 : d[(j * N + i) * 4 + 3];
  const L = (i, j) => { const k = (j * N + i) * 4; return .3 * d[k] + .59 * d[k + 1] + .11 * d[k + 2]; };
  const edge = new Uint8Array(N * N);
  let count = 0;
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (A(i, j) < 80) continue;
    const outline = A(i - 1, j) < 80 || A(i + 1, j) < 80 || A(i, j - 1) < 80 || A(i, j + 1) < 80;
    const inner = (i + 1 < N && A(i + 1, j) >= 80 && Math.abs(L(i, j) - L(i + 1, j)) > 42) ||
                  (j + 1 < N && A(i, j + 1) >= 80 && Math.abs(L(i, j) - L(i, j + 1)) > 42);
    if (outline || inner) { edge[j * N + i] = 1; count++; }
  }
  if (count < 40) return null;   // 這台手機畫不出這個 emoji
  // 把相連的邊緣點串成線：每次往還沒走過的鄰居走，盡量維持原本的方向
  const dirs = [[1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1], [0, -1], [1, -1]];
  const strokes = [];
  for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
    if (!edge[j * N + i]) continue;
    const path = [[i, j]]; edge[j * N + i] = 0;
    let ci = i, cj = j, last = 0;
    for (;;) {
      let found = -1;
      for (let k = 0; k < 8; k++) {
        const dd = (last + k) % 8, ni = ci + dirs[dd][0], nj = cj + dirs[dd][1];
        if (ni >= 0 && nj >= 0 && ni < N && nj < N && edge[nj * N + ni]) { found = dd; break; }
      }
      if (found < 0) break;
      ci += dirs[found][0]; cj += dirs[found][1]; last = found;
      edge[cj * N + ci] = 0; path.push([ci, cj]);
    }
    if (path.length >= 6) strokes.push(path);
  }
  strokes.sort((a, b) => b.length - a.length);
  // 平滑一下（前後各 2 點取平均）再抽稀，線才不會鋸齒狀
  const smooth = s => s.map((_, k) => {
    const a = s.slice(Math.max(0, k - 2), k + 3);
    return [a.reduce((t, p) => t + p[0], 0) / a.length, a.reduce((t, p) => t + p[1], 0) / a.length];
  });
  return strokes.slice(0, 40).map(s => smooth(s).filter((_, k, arr) => k % 4 === 0 || k === arr.length - 1).map(([i, j]) => [i / N, j / N]));
}

function botDrawing(emojiStr, { mod = "", dur = 10000, rng = Math.random } = {}) {
  let strokes = traceEmoji(emojiStr);
  if (!strokes) {
    // 備用：亂畫一團
    strokes = [Array.from({ length: 30 }, (_, k) => [.5 + .3 * Math.cos(k / 2) * rng(), .5 + .3 * Math.sin(k / 3) * rng()])];
  }
  const R = (a) => (rng() - .5) * 2 * a;
  const scale = .82 + rng() * .25, rot = R(.16), ox = R(.05), oy = R(.05);
  const shake = mod === "shaky" ? .02 : .003;
  let out = [];
  strokes.forEach((s, n) => {
    if (n > 3 && rng() < .12) return;                 // 漏畫幾筆
    const drift = .015 + n * .003;                     // 看不到畫面，越畫越偏
    const dx = R(drift), dy = R(drift);
    out.push(s.map(([px, py]) => {
      let u = (px - .5) * scale, v = (py - .5) * scale;
      [u, v] = [u * Math.cos(rot) - v * Math.sin(rot), u * Math.sin(rot) + v * Math.cos(rot)];
      let X = .5 + u * .9 + ox + dx + R(shake), Y = .5 + v * .9 * .75 + oy + dy + R(shake);
      if (mod === "mirror") X = 1 - X;
      return [Math.min(1, Math.max(0, X)), Math.min(1, Math.max(0, Y))];
    }));
  });
  if (mod === "oneline") out = [out.flat()];
  // 時間：從 0.3 秒開始，畫到時間的八成左右，每筆之間停一下
  const total = out.reduce((s, a) => s + a.length, 0) || 1;
  const pause = 140, avail = Math.max(1000, dur * .8 - 300 - pause * out.length);
  const dt = avail / total;
  let t = 300;
  return out.map(s => {
    const res = s.map(([X, Y]) => { t += dt; return { x: Math.round(X * 1000) / 1000, y: Math.round(Y * 1000) / 1000, t: Math.round(t) }; });
    t += pause;
    return res;
  });
}
