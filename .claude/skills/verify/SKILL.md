---
name: verify
description: พิสูจน์ว่าการแก้ไขในโปรเจกต์ TKF-Report ทำงานจริง — ตรวจสไลด์ล้นกรอบ ดูภาพที่เรนเดอร์จริง และทดสอบหน้า /edit กับ /arrange โดยไม่ต้องใช้โทเคน GitHub จริง ใช้ทุกครั้งหลังแก้เลย์เอาต์สไลด์ ตัวคำนวณ หรือหน้าที่ commit เข้ารีโป
---

# ตรวจงานในโปรเจกต์นี้

**สไลด์เป็นกรอบตายตัว 16:9 เนื้อหาที่ล้นถูกตัดหายเงียบ ๆ ไม่มี error**
`npm run build` ผ่านไม่ได้แปลว่าสไลด์ถูก · ต้องตรวจเพิ่มเสมอ

## 1. ตรวจล้นกรอบ (บังคับหลังแก้เลย์เอาต์ทุกครั้ง)

```bash
rm -rf .next out && npx next build
(npx --yes serve@14 out -l 4173 &) ; sleep 4
node scripts/check-overflow.mjs http://localhost:4173
```

ต้องได้ `ทุกสไลด์อยู่ในกรอบ` · ถ้าฟ้อง มันบอกหน้า รหัสบล็อก และ element ที่ล้นให้

ตัวตรวจนับสองแบบ: element ที่ตกขอบ `.slide` (ซึ่ง `overflow:hidden`) และ element
ที่มีกรอบตัดเนื้อหาตัวเอง · **`leading-none` กับตัวอักษรใหญ่ทำให้ฟ้องผิดได้**
เพราะ glyph สูงกว่า line box — ถ้าเจอให้ขยาย line-height ไม่ใช่ปิดตัวตรวจ

**เจอเลย์เอาต์ล้น ให้วัดจริงในเบราว์เซอร์ก่อน ห้ามเดาสูตรแล้ว build ใหม่**
สูตรความสูงแถวตารางเคยเดาผิดสองรอบติดกันเพราะไม่ได้วัด ฉลากภาษาไทยตัดบรรทัดไม่เท่ากัน
`$$eval` อ่าน `scrollHeight` / `getBoundingClientRect()` ของ element จริงถูกกว่าเดาเสมอ

## 2. ดูภาพจริง — ตัวตรวจไม่จับทุกอย่าง

ตัวตรวจบอกว่าไม่ล้น แต่ **กริดรูปเคยพังโดยผ่านตัวตรวจมาแล้ว** (ช่องยืดจนรูปโดนครอบตัด
และตัวแบ่งหน้าเกลี่ยรูปจนกรอบหายไปหนึ่งกรอบ) ต้องแคปมาดูด้วยตา

```js
// วางสคริปต์ไว้ที่ราก repo — playwright-core อยู่ใน node_modules ที่นั่น
import { chromium } from 'playwright-core';
const b = await chromium.launch({ executablePath: '/opt/pw-browsers/chromium' });
const p = await b.newPage({ viewport: { width: 1400, height: 900 } });
await p.goto('http://localhost:4173/deck', { waitUntil: 'networkidle' });
await p.locator('#m-waste').screenshot({ path: 'shot.png' });   // เจาะดูทีละสไลด์ด้วย id ของบล็อก
await p.pdf({ path: 'deck.pdf', printBackground: true, preferCSSPageSize: true });
await b.close();
```

PDF ต้องได้หน้าขนาด **960 × 540 pt** · ตรวจได้ด้วย
`re.findall(rb'/MediaBox \[([^\]]+)\]', pdf_bytes)`

## 3. ทดสอบหน้าที่ commit เข้ารีโป โดยไม่ใช้โทเคนจริง

`/edit` กับ `/arrange` ยิง GitHub API ตรง ๆ · ดักด้วย `page.route()` แล้วตอบเอง
จะได้ตรวจทั้งวงจรโดยไม่แตะรีโปจริง **และอ่าน blob ที่มันส่งเพื่อดูว่าเขียนไฟล์ถูกไหม**

```js
let blob = null;
await p.route('**://api.github.com/**', async (route) => {
  const r = route.request(), u = new URL(r.url()).pathname, m = r.method();
  if (m === 'GET' && u.includes('/git/ref/heads/'))  return route.fulfill({ json: { object: { sha: 'BASE' } } });
  if (m === 'GET' && u.includes('/git/commits/'))    return route.fulfill({ json: { tree: { sha: 'T0' } } });
  if (m === 'POST' && u.endsWith('/git/blobs'))      { blob = r.postDataJSON(); return route.fulfill({ json: { sha: 'B1' } }); }
  if (m === 'POST' && u.endsWith('/git/trees'))      return route.fulfill({ json: { sha: 'T1' } });
  if (m === 'POST' && u.endsWith('/git/commits'))    return route.fulfill({ json: { sha: 'C1', html_url: 'https://x/c' } });
  return route.fulfill({ json: {} });                 // PATCH refs
});
// ...กรอกฟอร์ม แล้วรอ
await p.waitForSelector('text=ส่งเรียบร้อย');
const txt = blob.encoding === 'utf-8' ? blob.content : Buffer.from(blob.content, 'base64').toString();
```

**ต้องตรวจว่าแถวที่ไม่ได้แตะยังเหมือนเดิมทุกตัว** ไม่ใช่แค่แถวที่แก้ถูก

### ตรวจการส่งหลายครั้ง — ต้องใช้รีโปจำลองที่ "จำ" ได้

ตัวจำลองข้างบนตอบค่าคงที่ทุกครั้ง จึงจับบั๊กที่โผล่**ตอนส่งครั้งที่สอง**ไม่ได้เลย
ซึ่งเป็นบั๊กที่เคยลบข้อมูลจริงมาแล้ว — ต้องให้ตัวจำลองเก็บสถานะไว้ด้วย

```js
let serverConfig = JSON.parse(readFileSync('config/sections.json', 'utf8'));
let lastBlob = null;
// GET  /contents/config/sections.json → ตอบ serverConfig ตัวปัจจุบัน (raw JSON ไม่ใช่ก้อนห่อ)
// POST /git/blobs                     → เก็บ lastBlob ไว้
// PATCH /git/refs/...                 → serverConfig = JSON.parse(lastBlob)   ← commit จริง
```

แล้วไล่: ส่ง#1 กรอกตาราง A → ส่ง#2 กรอกตาราง B → **ค่าของ A ต้องยังอยู่**

เคสที่ต้องลองทุกครั้งที่แตะหน้าที่เขียนไฟล์กลับ:

1. ส่งสองครั้งติดกันคนละตาราง — ครั้งหลังต้องไม่ลบของครั้งแรก
2. กดส่งซ้ำโดยไม่แก้อะไร — ปุ่มควรเป็น `ส่ง 0 ไฟล์` และกดไม่ได้
3. ตั้งค่าในรีโปจำลองให้**ต่างจากที่ฝังมาตอน build** แล้วเปิดหน้า
   (`p.addInitScript(() => localStorage.setItem('github-token', 'seeded'))`)
   — หน้าเว็บต้องแสดงค่าของรีโป ไม่ใช่ค่าที่ฝังมา

## 4. รูปทดสอบ (ยังไม่มีรูปจริงในรีโป)

สร้าง PNG เองด้วย `zlib` + `struct` ใน Python — ไม่มี PIL และไม่มี ImageMagick ในเครื่องนี้
สร้าง 120 ใบเพื่อทดสอบการหั่นหน้าของ `photo-grid` (เกิน 105 ใบต้องขึ้นหน้าใหม่)

**ลบรูปทดสอบทิ้งก่อน commit เสมอ** แล้วรัน `npm run photos` ให้ `config/photos.json` กลับเป็นว่าง

## เช็กลิสต์ก่อนบอกว่าเสร็จ

- [ ] `npx tsc --noEmit` ผ่าน
- [ ] `npx next build` ผ่าน
- [ ] `node scripts/check-overflow.mjs` ขึ้น "ทุกสไลด์อยู่ในกรอบ"
- [ ] แคปสไลด์ที่แก้มาดูด้วยตาจริง
- [ ] ถ้าแตะตัวคำนวณ — ตรวจตัวเลขซ้ำด้วย Python จาก `config/sections.json` ตรง ๆ
- [ ] ลบไฟล์ทดสอบและสคริปต์ชั่วคราวที่รากรีโปแล้ว
