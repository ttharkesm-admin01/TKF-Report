/**
 * entry.ts — รายการช่องที่ต้องกรอกของรอบนี้
 *
 * ทั้งเด็คมีตาราง 12 เดือน 9 ตาราง · แต่ละเดือนกรอกแค่ **คอลัมน์เดียว** ของแต่ละแถว
 * ไฟล์นี้รวบช่องเหล่านั้นจากทุกหัวข้อมาไว้ที่เดียว หน้ากรอกจะได้เป็นหน้าเดียวจบ
 * ไม่ต้องเปิดไล่ทีละตารางเหมือนตอนทำ Excel หลายไฟล์
 */

import roundConfig from '@/config/round.json';
import { MONTHS, MONTHS_SHORT, UNITS, type Cell, type UnitKey } from '@/shared/schema';
import { sections, type DeckSection } from './deck';

/** ดัชนีเดือนของรอบที่ทำอยู่ (0-11) */
export const monthIndex = roundConfig.month - 1;
export const monthLabel = MONTHS[monthIndex];
export const prevMonthLabel = monthIndex > 0 ? MONTHS_SHORT[monthIndex - 1] : null;

export interface EntryRow {
  blockId: string;
  rowKey: string;
  label: string;
  unit: UnitKey;
  unitLabel: string;
  /** ค่าที่กรอกไว้แล้วของเดือนนี้ */
  current: Cell;
  /** ค่าของเดือนก่อน ไว้เทียบว่ากรอกผิดหลักหรือเปล่า */
  previous: Cell;
  note?: string;
}

export interface EntryBlock {
  blockId: string;
  title: string;
  rows: EntryRow[];
}

export interface EntrySection {
  key: string;
  number: string;
  title: string;
  blocks: EntryBlock[];
}

/**
 * ประกอบรายการช่องกรอกจากหัวข้อชุดหนึ่ง
 *
 * รับ `list` เป็นพารามิเตอร์เพื่อให้หน้า `/edit` ป้อน**ของสดจากรีโป**เข้ามาได้
 * ไม่ใช่ผูกกับภาพนิ่งตอน build ตัวเดียว (CLAUDE.md กฎข้อ 4)
 */
export function buildEntrySections(list: DeckSection[]): EntrySection[] {
  return list
  .map((s) => ({
    key: s.key,
    number: s.number,
    title: s.title,
    blocks: s.blocks
      .filter((b) => b.type === 'monthly-matrix')
      .map((b) => {
        const rows = (b.raw.rows as Array<{
          key: string;
          label: string;
          unit: UnitKey;
          note?: string;
          values: Cell[];
        }>) ?? [];
        return {
          blockId: b.id,
          title: b.title,
          rows: rows.map((r) => ({
            blockId: b.id,
            rowKey: r.key,
            label: r.label,
            unit: r.unit,
            unitLabel: UNITS[r.unit].label,
            current: r.values[monthIndex] ?? null,
            previous: monthIndex > 0 ? (r.values[monthIndex - 1] ?? null) : null,
            note: r.note,
          })),
        };
      })
      .filter((b) => b.rows.length > 0),
  }))
  .filter((s) => s.blocks.length > 0);
}

/** ช่องกรอกตามภาพนิ่งตอน build — ใช้เป็นค่าตั้งต้นก่อนของสดจะมาถึง */
export const entrySections: EntrySection[] = buildEntrySections(sections);

export const countCells = (list: EntrySection[]): number =>
  list.reduce((n, s) => n + s.blocks.reduce((m, b) => m + b.rows.length, 0), 0);

export const totalCells = countCells(entrySections);

/* ------------------------------------------------------------------ */
/* บล็อกข้อความ                                                        */
/* ------------------------------------------------------------------ */

export interface TextEntry {
  blockId: string;
  sectionNumber: string;
  sectionTitle: string;
  title: string;
  /** ข้อความที่บันทึกไว้แล้ว */
  body: string;
}

/**
 * รวมบล็อก `text` ทั้งเด็คมาไว้ที่เดียว เหมือนที่ทำกับช่องตัวเลข
 *
 * ข้อความไม่ได้แยกตามเดือนเหมือนตาราง — บล็อกหนึ่งมี `body` เดียว
 * ขึ้นรอบใหม่จึงเป็นการ**พิมพ์ทับของเดือนก่อน** ไม่ใช่เติมคอลัมน์ใหม่
 * หน้ากรอกต้องบอกให้ชัด ไม่งั้นผู้ใช้นึกว่าของเดือนก่อนยังอยู่
 */
export function buildTextEntries(list: DeckSection[]): TextEntry[] {
  const out: TextEntry[] = [];
  for (const s of list) {
    for (const b of s.blocks) {
      if (b.type !== 'text') continue;
      out.push({
        blockId: b.id,
        sectionNumber: s.number,
        sectionTitle: s.title,
        title: b.title,
        body: typeof b.raw.body === 'string' ? b.raw.body : '',
      });
    }
  }
  return out;
}

/** บล็อกข้อความตามภาพนิ่งตอน build — ใช้เป็นค่าตั้งต้นก่อนของสดจะมาถึง */
export const textEntries: TextEntry[] = buildTextEntries(sections);
