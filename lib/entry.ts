/**
 * entry.ts — รายการช่องที่ต้องกรอกของทั้งปี
 *
 * ทั้งเด็คมีตาราง 12 เดือน 9 ตาราง · ไฟล์นี้รวบแถวของทุกตารางมาไว้ที่เดียว
 * หน้ากรอกจะได้เป็นหน้าเดียวจบ ไม่ต้องเปิดไล่ทีละตารางเหมือนตอนทำ Excel หลายไฟล์
 *
 * **ส่งค่าไปทั้ง 12 ช่อง ไม่ใช่เฉพาะเดือนของรอบ** — เดือนที่แล้วกรอกตกไว้
 * ต้องตามเก็บได้จากหน้าเดียวกัน ไม่ใช่ต้องรอให้ถึงรอบนั้นใหม่ปีหน้า
 */

import roundConfig from '@/config/round.json';
import { MONTHS, MONTHS_SHORT, UNITS, isFilled, type Cell, type UnitKey } from '@/shared/schema';
import { sections, type DeckSection } from './deck';

/** ดัชนีเดือนของรอบที่ทำอยู่ (0-11) */
export const monthIndex = roundConfig.month - 1;
export const monthLabel = MONTHS[monthIndex];

/** ชื่อเดือนไว้ขึ้นหัวคอลัมน์ · ตัวเต็มไว้ใช้ตอนโหมดเดือนเดียว */
export { MONTHS, MONTHS_SHORT };

export interface EntryRow {
  blockId: string;
  rowKey: string;
  label: string;
  unit: UnitKey;
  unitLabel: string;
  /** ค่าทั้ง 12 เดือน — ยาว 12 เสมอ */
  values: Cell[];
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

/** เติมให้ครบ 12 ช่องเสมอ — config เก่าที่แถวสั้นกว่านั้นจะได้ไม่ทำหน้าพัง */
const twelve = (v: Cell[] | undefined): Cell[] =>
  Array.from({ length: 12 }, (_, i) => v?.[i] ?? null);

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
              values: twelve(r.values),
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

/** เดินทุกแถวของทุกตารางในลำดับที่แสดงบนหน้า */
export function* eachRow(list: EntrySection[]): Generator<EntryRow> {
  for (const s of list) for (const b of s.blocks) for (const r of b.rows) yield r;
}

/** จำนวนแถวทั้งหมด = จำนวนช่องที่ต้องกรอกของหนึ่งเดือน */
export function countRows(list: EntrySection[]): number {
  let n = 0;
  for (const _ of eachRow(list)) n += 1;
  return n;
}

/** นับช่องที่มีค่าแล้วของเดือนหนึ่ง · `'none'` (ไม่มีรายการ) นับว่ากรอกแล้ว */
export function countFilled(list: EntrySection[], month: number): number {
  let n = 0;
  for (const r of eachRow(list)) if (r.values[month] !== null) n += 1;
  return n;
}

/**
 * เดือนที่ยังกรอกไม่ครบ นับตั้งแต่ต้นปีถึงเดือนของรอบนี้
 * เดือนข้างหน้ายังไม่ถึงกำหนด ไม่ถือว่าค้าง
 */
export function monthsBehind(list: EntrySection[], upTo = monthIndex): number[] {
  const total = countRows(list);
  const out: number[] = [];
  for (let m = 0; m <= upTo; m += 1) if (countFilled(list, m) < total) out.push(m);
  return out;
}

/** ค่าเฉพาะที่กรอกเป็นตัวเลขจริงของแถวหนึ่ง — ใช้หาช่วงปกติเพื่อเตือนตอนกรอกผิดหลัก */
export function rowRange(values: Cell[]): { min: number; max: number } | null {
  const nums = values.filter(isFilled);
  if (nums.length < 3) return null;
  return { min: Math.min(...nums), max: Math.max(...nums) };
}
