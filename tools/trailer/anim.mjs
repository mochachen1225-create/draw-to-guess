import { chromium } from '/opt/node22/lib/node_modules/playwright/index.mjs';
import fs from 'fs';
const D = process.argv[2];
const b = await chromium.launch(); const p = await b.newPage({ viewport: { width: 360, height: 640 }, deviceScaleFactor: 3 });
for (const lang of ['en', 'zh']) for (const [scene, dur] of [['intro', 3.0], ['end', 3.4]]) {
  await p.goto(`file://${D}/anim.html?lang=${lang}&scene=${scene}`); await p.evaluate(() => document.fonts.ready); await p.waitForTimeout(200);
  const dir = `${D}/raw/${lang}-${scene}`; fs.mkdirSync(dir, { recursive: true });
  const n = Math.round(dur * 30);
  for (let i = 0; i < n; i++) { await p.evaluate(t => render(t), i / 30); await p.screenshot({ path: `${dir}/${String(i).padStart(4, '0')}.jpg`, type: 'jpeg', quality: 90 }); }
}
await b.close(); console.log('anim done');
