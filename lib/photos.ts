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
}

const table = photosConfig.blocks as Record<string, Photo[]>;

export const photosOf = (blockId: string): Photo[] => table[blockId] ?? [];

export const photoRound = photosConfig.round;

/** เลขกำกับรูปแบบเดิมในเด็ค: รอบที่ 1 รูปที่ 3 → "1 (3)" */
export const photoLabel = (round: number | undefined, indexInBlock: number): string =>
  round ? `${round} (${indexInBlock + 1})` : String(indexInBlock + 1);

/** โฟลเดอร์ที่ต้องเอารูปไปวาง — ใช้บอกผู้ใช้ตอนที่ยังไม่มีรูป */
export const expectedFolder = (blockId: string): string =>
  `public/photos/${photosConfig.round}/${blockId}/`;
