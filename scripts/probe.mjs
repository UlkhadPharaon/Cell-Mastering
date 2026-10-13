// dev-only visual probe: screenshots each cell type, reports console errors
import { chromium } from '@playwright/test';
const b = await chromium.launch();
const p = await b.newPage({ viewport: { width: 1280, height: 800 } });
const errs = [];
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
p.on('pageerror', (e) => errs.push(String(e)));
await p.goto('http://localhost:5173', { waitUntil: 'networkidle' });
await p.waitForTimeout(1500);
for (const [i, name] of [['1','animal'],['2','plant'],['3','rbc']]) {
  await p.keyboard.press(i);
  await p.waitForTimeout(1200);
  await p.screenshot({ path: `shot-${name}.png` });
}
console.log('console errors:', errs.length ? errs : 'NONE');
await b.close();
