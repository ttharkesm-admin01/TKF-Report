/** รายชื่อบล็อกที่มีรูป — ใช้บนหน้าจัดรูป */
import { sections } from './deck';

export interface PhotoBlockInfo {
  id: string;
  title: string;
  sectionNumber: string;
  sectionTitle: string;
  type: 'photo-grid' | 'photo-set' | 'scan';
  /** จำนวนคอลัมน์ที่สไลด์จริงใช้ — จัดรูปบนหน้านี้จะได้เห็นเหมือนของจริง */
  cols: number;
}

export const photoBlocks: PhotoBlockInfo[] = sections.flatMap((s) =>
  s.blocks
    .filter((b) => b.type === 'photo-grid' || b.type === 'photo-set' || b.type === 'scan')
    .map((b) => {
      const layout = b.raw.layout as { cols: number } | undefined;
      return {
        id: b.id,
        title: b.title,
        sectionNumber: s.number,
        sectionTitle: s.title,
        type: b.type as PhotoBlockInfo['type'],
        cols: b.type === 'photo-grid' ? (layout?.cols ?? 5) : 4,
      };
    }),
);

/** เทียบชื่อโฟลเดอร์แบบไม่ถือสาช่องว่าง ขีดล่าง ตัวพิมพ์ใหญ่ */
const norm = (s: string): string =>
  s
    .trim()
    .toLowerCase()
    .replace(/[\s_]+/g, '-')
    .replace(/-+/g, '-');

/**
 * เดาว่าโฟลเดอร์ที่ลากมาเป็นรูปของบล็อกไหน
 *
 * ตรงรหัสบล็อกก่อน (`g-garden-r1`) · แล้วรหัสที่มีคำต่อท้าย (`g-garden-r1-รอบแรก`)
 * · สุดท้ายลองเทียบกับชื่อหัวข้อเต็ม · `null` = เดาไม่ออก ต้องให้ผู้ใช้เลือกเอง
 */
export function matchBlock(folder: string): string | null {
  const f = norm(folder);
  if (!f) return null;

  const byId = photoBlocks.find((b) => norm(b.id) === f);
  if (byId) return byId.id;

  const byPrefix = photoBlocks.find((b) => f.startsWith(norm(b.id) + '-'));
  if (byPrefix) return byPrefix.id;

  return photoBlocks.find((b) => norm(b.title) === f)?.id ?? null;
}
