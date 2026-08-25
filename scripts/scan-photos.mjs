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
 * ลำดับ การซ่อน และคำบรรยาย ใส่เพิ่มได้ที่ arrange.json ในโฟลเดอร์เดียวกัน
 * (หน้า /arrange บนเว็บสร้างไฟล์นี้ให้ ไม่ต้องพิมพ์เอง)
 *   {
 *     "order":    ["003.jpg", "001.jpg"],
 *     "hidden":   ["002.jpg"],
 *     "captions": { "003.jpg": "ตัดหญ้าหน้าอาคาร 1" }
 *   }
 * ไฟล์ที่ไม่ได้อยู่ใน order ต่อท้ายให้ตามชื่อไฟล์ — เพิ่มรูปใหม่จึงไม่ต้องจัดใหม่ทั้งชุด
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
    const onDisk = readdirSync(dir).filter((f) => IMAGE.test(f)).sort(natural);
    if (!onDisk.length) continue;

    let arrange = {};
    const arrangeFile = join(dir, 'arrange.json');
    if (existsSync(arrangeFile)) {
      try {
        arrange = JSON.parse(readFileSync(arrangeFile, 'utf8'));
      } catch {
        console.warn(`อ่าน ${arrangeFile} ไม่ได้ — ใช้ลำดับตามชื่อไฟล์แทน`);
      }
    }

    const captions = arrange.captions ?? {};
    const hidden = new Set(arrange.hidden ?? []);

    // ลำดับที่จัดไว้มาก่อน · ไฟล์ที่ยังไม่เคยจัด (เช่นรูปที่เพิ่งเพิ่ม) ต่อท้ายตามชื่อไฟล์
    const wanted = (arrange.order ?? []).filter((f) => onDisk.includes(f));
    const rest = onDisk.filter((f) => !wanted.includes(f));
    // รูปที่ซ่อนยังอยู่ในรายการ แค่ติดธงไว้ — หน้า /arrange จะได้เอากลับมาแสดงได้
    // ถ้าตัดทิ้งตรงนี้เลย ซ่อนแล้วจะไม่มีทางเลิกซ่อนจากหน้าเว็บอีก
    const ordered = [...wanted, ...rest];

    const missing = (arrange.order ?? []).filter((f) => !onDisk.includes(f));
    if (missing.length) {
      console.warn(`  ${blockId}: arrange.json อ้างไฟล์ที่ไม่มีอยู่ ${missing.length} ไฟล์ — ข้ามให้`);
    }

    blocks[blockId] = ordered.map((file) => ({
      src: `/photos/${roundDir}/${blockId}/${file}`,
      file,
      caption: captions[file] ?? null,
      hidden: hidden.has(file),
    }));
  }
}

const out = {
  _comment: 'ไฟล์นี้สร้างด้วย scripts/scan-photos.mjs ห้ามแก้มือ · รันใหม่ทุกครั้งที่เพิ่มรูป',
  round: roundDir,
  blocks,
};

writeFileSync('config/photos.json', JSON.stringify(out, null, 2) + '\n');

const shown = (a) => a.filter((p) => !p.hidden).length;
const total = Object.values(blocks).reduce((n, a) => n + shown(a), 0);
console.log(`รอบ ${roundDir} · ${Object.keys(blocks).length} บล็อก · ${total} รูป`);
for (const [id, list] of Object.entries(blocks)) {
  const h = list.length - shown(list);
  console.log(`  ${id}  ${shown(list)} รูป${h ? ` (ซ่อน ${h})` : ''}`);
}
if (!total) console.log(`ยังไม่มีรูป — วางไฟล์ไว้ที่ ${root}/<รหัสบล็อก>/`);
