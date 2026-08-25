/**
 * photos.ts — รูปของแต่ละบล็อก
 *
 * ระบบอ่านรูปจาก config/photos.json ซึ่ง scripts/scan-photos.mjs สร้างจากโฟลเดอร์
 * **ไม่ผูกกับ Google Drive** — Drive เป็นแค่ทางเลือกหนึ่งในการพารูปมาลงโฟลเดอร์
 * ก๊อปเอง ซิงก์ลงมา หรือดูดผ่านสคริปต์ ปลายทางเหมือนกันหมด
 */

import photosConfig from '@/config/photos.json';

export interface Photo {
  src: string;
  file: string;
  caption: string | null;
  /** ซ่อนจากสไลด์ แต่ยังอยู่ในรายการเพื่อให้หน้า /arrange เอากลับมาได้ */
  hidden?: boolean;
}

const table = photosConfig.blocks as Record<string, Photo[]>;

/** รูปที่ขึ้นสไลด์จริง */
export const photosOf = (blockId: string): Photo[] =>
  (table[blockId] ?? []).filter((p) => !p.hidden);

/** รูปทั้งหมดรวมที่ซ่อนไว้ — ใช้เฉพาะหน้าจัดรูป */
export const allPhotosOf = (blockId: string): Photo[] => table[blockId] ?? [];

export const photoRound = photosConfig.round;

/** เลขกำกับรูปแบบเดิมในเด็ค: รอบที่ 1 รูปที่ 3 → "1 (3)" */
export const photoLabel = (round: number | undefined, indexInBlock: number): string =>
  round ? `${round} (${indexInBlock + 1})` : String(indexInBlock + 1);

/** โฟลเดอร์ที่ต้องเอารูปไปวาง — ใช้บอกผู้ใช้ตอนที่ยังไม่มีรูป */
export const expectedFolder = (blockId: string): string =>
  `public/photos/${photosConfig.round}/${blockId}/`;
