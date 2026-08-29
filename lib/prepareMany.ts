/**
 * prepareMany.ts — ย่อรูปทีละใบพร้อมรายงานความคืบหน้า
 *
 * แยกออกมาจากตัวลากรูปเพราะตอนนี้มีที่ลากหลายที่ (การ์ดทุกใบบนกระดาน)
 * แต่ต้องย่อด้วยกติกาเดียวกันหมด · ใบที่ย่อไม่ผ่านไม่ทำให้ทั้งชุดล้ม แค่คืนชื่อกลับไปบอก
 */

import { prepareImage, type Prepared } from './resize';

export interface PreparedBatch {
  items: Prepared[];
  /** ชื่อไฟล์ที่ย่อไม่สำเร็จ — ไฟล์เสีย หรือไม่ใช่รูปจริงทั้งที่นามสกุลบอกว่าใช่ */
  failed: string[];
}

export async function prepareMany(
  files: File[],
  onProgress?: (done: number, total: number) => void,
): Promise<PreparedBatch> {
  const items: Prepared[] = [];
  const failed: string[] = [];

  for (const [i, f] of files.entries()) {
    onProgress?.(i + 1, files.length);
    try {
      items.push(await prepareImage(f));
    } catch {
      failed.push(f.name);
    }
  }

  return { items, failed };
}
