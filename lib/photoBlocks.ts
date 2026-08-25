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
