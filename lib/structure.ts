/**
 * structure.ts — แก้โครงสร้างเด็ค (เพิ่ม/ลบ/เปลี่ยนชื่อตาราง) บนก้อน config ดิบ
 *
 * แยกออกจากคอมโพเนนต์เพื่อให้ทดสอบและอ่านง่าย
 * ทุกฟังก์ชัน **ไม่แก้ของเดิม** คืนก้อนใหม่เสมอ ปุ่มย้อนกลับจึงทำได้ตรงไปตรงมา
 */

import type { ListColumn } from '@/shared/schema';

export type RawBlock = Record<string, unknown> & { type: string; id: string; title?: string };
export interface RawSection {
  key: string;
  title: string;
  frequency: string;
  blocks: RawBlock[];
}
export interface RawConfig {
  sections: RawSection[];
  [k: string]: unknown;
}

export const clone = <T,>(v: T): T => JSON.parse(JSON.stringify(v)) as T;

/** ชนิดบล็อกที่เพิ่มใหม่จากหน้าเว็บได้ · ชนิดรูปเพิ่มแล้วไม่มีประโยชน์ถ้าไม่มีรูป */
export const ADDABLE = [
  { type: 'list-table', label: 'ตารางรายการ' },
  { type: 'monthly-matrix', label: 'ตาราง 12 เดือน' },
  { type: 'photo-set', label: 'ชุดรูป' },
  { type: 'scan', label: 'ภาพเต็มหน้า' },
] as const;

const allIds = (cfg: RawConfig) => new Set(cfg.sections.flatMap((s) => s.blocks.map((b) => b.id)));

/** id ที่ยังไม่ถูกใช้ · ตั้งจากชนิดเพื่อให้เดาที่มาได้ตอนอ่าน config */
export function freeBlockId(cfg: RawConfig, type: string): string {
  const taken = allIds(cfg);
  const stem = type === 'monthly-matrix' ? 'm' : type === 'list-table' ? 't' : 'p';
  let n = 1;
  while (taken.has(`${stem}-new-${n}`)) n += 1;
  return `${stem}-new-${n}`;
}

/** บล็อกเปล่าของแต่ละชนิด — ค่าตั้งต้นให้เรนเดอร์ได้ทันทีโดยไม่ต้องแก้ไฟล์ */
export function newBlock(cfg: RawConfig, type: string, title: string): RawBlock {
  const id = freeBlockId(cfg, type);
  switch (type) {
    case 'monthly-matrix':
      return {
        type,
        id,
        title,
        mode: 'manual',
        hideFutureMonths: true,
        highlightLatest: true,
        showTotalRow: true,
        rows: [],
      };
    case 'list-table':
      return { type, id, title, mode: 'manual', columns: [], rows: [] };
    case 'photo-set':
      return { type, id, title, mode: 'manual', max: 6, captions: true };
    default:
      return { type, id, title, mode: 'manual' };
  }
}

export function addBlock(cfg: RawConfig, sectionKey: string, block: RawBlock): RawConfig {
  const next = clone(cfg);
  next.sections.find((s) => s.key === sectionKey)?.blocks.push(block);
  return next;
}

export function removeBlock(cfg: RawConfig, blockId: string): RawConfig {
  const next = clone(cfg);
  for (const s of next.sections) s.blocks = s.blocks.filter((b) => b.id !== blockId);
  return next;
}

export function patchBlock(cfg: RawConfig, blockId: string, patch: Partial<RawBlock>): RawConfig {
  const next = clone(cfg);
  for (const s of next.sections)
    for (let i = 0; i < s.blocks.length; i += 1)
      if (s.blocks[i].id === blockId) s.blocks[i] = { ...s.blocks[i], ...patch };
  return next;
}

/** เลื่อนบล็อกขึ้น/ลงภายในหัวข้อเดียวกัน — ลำดับบล็อกคือลำดับสไลด์ */
export function moveBlock(cfg: RawConfig, blockId: string, delta: number): RawConfig {
  const next = clone(cfg);
  for (const s of next.sections) {
    const i = s.blocks.findIndex((b) => b.id === blockId);
    if (i < 0) continue;
    const j = i + delta;
    if (j < 0 || j >= s.blocks.length) return cfg;
    [s.blocks[i], s.blocks[j]] = [s.blocks[j], s.blocks[i]];
  }
  return next;
}

export const findBlock = (cfg: RawConfig, blockId: string): RawBlock | undefined =>
  cfg.sections.flatMap((s) => s.blocks).find((b) => b.id === blockId);

/** คีย์คอลัมน์ใหม่ที่ไม่ชนของเดิม */
export function freeColumnKey(columns: ListColumn[]): string {
  const taken = new Set(columns.map((c) => c.key));
  let n = 1;
  while (taken.has(`col${n}`)) n += 1;
  return `col${n}`;
}

/**
 * บล็อกนี้มีข้อมูลอยู่ไหม — ใช้เตือนก่อนลบ
 * ลบบล็อกที่มีตัวเลขทั้งปีอยู่คือลบข้อมูลย้อนหลังทิ้ง ไม่ใช่แค่เอาสไลด์ออก
 */
export function blockDataCount(block: RawBlock): number {
  const rows = block.rows as unknown[] | undefined;
  if (!Array.isArray(rows)) return 0;
  if (block.type === 'monthly-matrix') {
    return (rows as Array<{ values?: unknown[] }>).reduce(
      (n, r) => n + (r.values ?? []).filter((v) => typeof v === 'number').length,
      0,
    );
  }
  return rows.length;
}
