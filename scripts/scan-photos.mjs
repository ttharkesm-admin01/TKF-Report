/**
 * สร้างรายการรูปจากโฟลเดอร์ → config/photos.json
 *
 * ระบบไม่ได้ผูกกับ Google Drive · รูปมาจากโฟลเดอร์ธรรมดา
 * ใครจะก๊อปใส่เอง ให้ Drive ซิงก์ลงมา หรือเขียนสคริปต์ดูดมาทีหลังก็ได้
 * ปลายทางเหมือนกันหมดคือไฟล์ในโฟลเดอร์นี้
 *
 *   public/photos/<ปี>-<เดือน>/<รหัสบล็อก>/*.jpg
 *   public/photos/2569-07/g-garden-r1/IMG_0001.jpg
 *
 * คำบรรยายใส่เพิ่มได้ที่ captions.json ในโฟลเดอร์เดียวกัน
 *   { "IMG_0001.jpg": "ตัดหญ้าหน้าอาคาร 1" }
 *
 *   node scripts/scan-photos.mjs
 */
import { readdirSync, readFileSync, writeFileSync, existsSync, statSync } from 'node:fs';
import { join } from 'node:path';

const round = JSON.parse(readFileSync('config/round.json', 'utf8'));
const roundDir = `${round.year}-${String(round.month).padStart(2, '0')}`;
const root = join('public', 'photos', roundDir);

const IMAGE = /\.(jpe?g|png|webp|gif)$/i;

/** เรียงตามชื่อไฟล์แบบที่คนอ่านคาดหวัง — 2 มาก่อน 10 ไม่ใช่ตามรหัสตัวอักษร */
const natural = new Intl.Collator('en', { numeric: true, sensitivity: 'base' }).compare;

const blocks = {};

if (existsSync(root)) {
  for (const blockId of readdirSync(root)) {
    const dir = join(root, blockId);
    if (!statSync(dir).isDirectory()) continue;

    // วันที่พิมพ์อยู่บนตัวรูป ไม่ใช่ EXIF จึงเรียงตามชื่อไฟล์ (PROJECT.md ข้อ 6)
    const files = readdirSync(dir).filter((f) => IMAGE.test(f)).sort(natural);
    if (!files.length) continue;

    let captions = {};
    const capFile = join(dir, 'captions.json');
    if (existsSync(capFile)) {
      try {
        captions = JSON.parse(readFileSync(capFile, 'utf8'));
      } catch {
        console.warn(`อ่าน ${capFile} ไม่ได้ — ข้ามคำบรรยายของบล็อกนี้`);
      }
    }

    blocks[blockId] = files.map((file) => ({
      src: `/photos/${roundDir}/${blockId}/${file}`,
      file,
      caption: captions[file] ?? null,
    }));
  }
}

const out = {
  _comment: 'ไฟล์นี้สร้างด้วย scripts/scan-photos.mjs ห้ามแก้มือ · รันใหม่ทุกครั้งที่เพิ่มรูป',
  round: roundDir,
  blocks,
};

writeFileSync('config/photos.json', JSON.stringify(out, null, 2) + '\n');

const total = Object.values(blocks).reduce((n, a) => n + a.length, 0);
console.log(`รอบ ${roundDir} · ${Object.keys(blocks).length} บล็อก · ${total} รูป`);
for (const [id, list] of Object.entries(blocks)) console.log(`  ${id}  ${list.length} รูป`);
if (!total) console.log(`ยังไม่มีรูป — วางไฟล์ไว้ที่ ${root}/<รหัสบล็อก>/`);
