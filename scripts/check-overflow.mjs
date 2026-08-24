/**
 * ตรวจว่าสไลด์ไหนมีเนื้อหาล้นกรอบ
 *
 * สไลด์เป็นกรอบตายตัว 16:9 · เนื้อหาที่ล้นจะถูกตัดหายเงียบ ๆ ไม่มี error
 * และหน้าที่พิมพ์ออกมาก็จะขาดข้อมูลโดยไม่มีใครรู้ สคริปต์นี้จึงจับให้เห็นก่อน
 *
 *   npm run build && npx serve out -l 4173
 *   node scripts/check-overflow.mjs [http://localhost:4173]
 */
import { chromium } from 'playwright-core';

const base = process.argv[2] ?? 'http://localhost:4173';
const exe = process.env.CHROMIUM_PATH ?? '/opt/pw-browsers/chromium';

const browser = await chromium.launch({ executablePath: exe });
const page = await browser.newPage({ viewport: { width: 1400, height: 900 } });
await page.goto(`${base}/deck`, { waitUntil: 'networkidle' });

const bad = await page.$$eval('.slide', (slides) =>
  slides
    .map((s, i) => {
      const box = s.getBoundingClientRect();
      let worst = 0;
      let where = '';
      const note = (over, el) => {
        if (over > worst) {
          worst = Math.round(over);
          where =
            el.tagName.toLowerCase() +
            '.' +
            (el.className || '').toString().split(' ').slice(0, 3).join('.');
        }
      };

      for (const el of s.querySelectorAll('*')) {
        // 1) ตกขอบสไลด์ — .slide เป็น overflow:hidden ส่วนที่เกินหายแน่นอน
        const r = el.getBoundingClientRect();
        if (r.width || r.height) {
          note(Math.max(0, r.bottom - box.bottom, r.right - box.right, box.top - r.top), el);
        }
        // 2) ถูกกรอบที่ตัดเนื้อหาของตัวเองตัด
        const ov = getComputedStyle(el).overflow;
        if (ov !== 'visible') {
          note(Math.max(el.scrollHeight - el.clientHeight, el.scrollWidth - el.clientWidth), el);
        }
      }
      return { page: i + 1, id: s.id, overflowPx: worst, where };
    })
    .filter((r) => r.overflowPx > 1),
);

await browser.close();

if (bad.length === 0) {
  console.log('ทุกสไลด์อยู่ในกรอบ');
  process.exit(0);
}

console.error(`ล้นกรอบ ${bad.length} สไลด์:`);
for (const b of bad) console.error(`  หน้า ${b.page}  #${b.id}  เกิน ${b.overflowPx}px  ที่ ${b.where}`);
process.exit(1);
