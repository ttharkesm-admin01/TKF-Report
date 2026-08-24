/**
 * deck.ts — แปลง config เป็นลำดับสไลด์
 *
 * ที่เดียวในระบบที่สร้าง "เลขหัวข้อ" — สร้างจากลำดับใน sections.json เท่านั้น
 * (PROJECT.md กฎข้อ 3) ห้ามมีสตริงเลขหัวข้อ hardcode ที่ไฟล์อื่นเด็ดขาด
 */

import sectionsConfig from '@/config/sections.json';
import roundConfig from '@/config/round.json';
import { MONTHS, type BlockType, type Frequency } from '@/shared/schema';

/* ---------- รูปร่างของ config ตามที่อ่านจากไฟล์ ---------- */

interface RawBlock {
  type: string;
  id: string;
  title?: string;
  mode?: string;
  [key: string]: unknown;
}

interface RawSection {
  key: string;
  title: string;
  frequency: string;
  blocks: RawBlock[];
}

/* ---------- ผลลัพธ์ที่หน้าเว็บใช้ ---------- */

export interface DeckBlock {
  /** id จาก config — ใช้เป็น anchor ของสไลด์ */
  id: string;
  type: BlockType;
  title: string;
  mode: string;
  /** ขั้นที่เท่าไรใน PROJECT.md ข้อ 8 ที่ทำให้บล็อกนี้ใช้งานได้จริง */
  buildStep: number;
  raw: RawBlock;
}

export interface DeckSection {
  key: string;
  /** เช่น "2.3" — สร้างจากลำดับ ห้ามเขียนมือ */
  number: string;
  title: string;
  frequency: Frequency;
  blocks: DeckBlock[];
}

export interface DeckMeta {
  department: string;
  departmentTitle: string;
  site: string;
  company: string;
  owner: string;
  monthLabel: string;
  year: number;
  status: string;
}

/** สไลด์หนึ่งหน้า — ผูกกลับไปหาหัวข้อที่มันสังกัด */
export interface DeckSlide {
  /** ลำดับหน้าในเด็ค เริ่มที่ 1 */
  page: number;
  section: DeckSection;
  block: DeckBlock;
}

/**
 * บล็อกแต่ละชนิดพร้อมใช้งานจริงเมื่อทำถึงขั้นไหน (PROJECT.md ข้อ 8)
 * ใช้แสดงบนบล็อกที่ยังไม่ได้ทำ ให้เห็นว่าเหลืออะไรและอยู่ในลำดับไหน
 */
const BUILD_STEP: Record<BlockType, number> = {
  cover: 1,
  closing: 1,
  'photo-grid': 2,
  'photo-set': 3,
  scan: 3,
  'monthly-matrix': 4,
  chart: 4,
  'list-table': 5,
  text: 6,
};

/** ชนิดที่ระบบเรนเดอร์ได้เต็มรูปแบบแล้ว — ที่เหลือขึ้นเป็นช่องว่างรอทำ */
export const IMPLEMENTED: ReadonlySet<BlockType> = new Set<BlockType>(['cover', 'closing']);

export const isImplemented = (b: DeckBlock): boolean => IMPLEMENTED.has(b.type);

/** ชื่อบล็อกไว้แสดงบนช่องว่างรอทำ */
export const BLOCK_LABEL: Record<BlockType, string> = {
  cover: 'ปกหัวข้อ',
  closing: 'ปิดท้าย',
  'monthly-matrix': 'ตาราง 12 เดือน',
  'list-table': 'ตารางรายการ',
  chart: 'กราฟ',
  'photo-grid': 'กริดรูป',
  'photo-set': 'ชุดรูปพร้อมคำบรรยาย',
  scan: 'ภาพเต็มหน้า',
  text: 'ข้อความ',
};

function toBlockType(t: string): BlockType {
  if (t in BUILD_STEP) return t as BlockType;
  throw new Error(`sections.json: ไม่รู้จักบล็อกชนิด "${t}" — เพิ่มใน BlockType ที่ shared/schema.ts ก่อน`);
}

export const meta: DeckMeta = {
  department: sectionsConfig.department,
  departmentTitle: sectionsConfig.departmentTitle,
  site: sectionsConfig.site,
  company: sectionsConfig.company,
  owner: sectionsConfig.owner,
  monthLabel: MONTHS[roundConfig.month - 1],
  year: roundConfig.year,
  status: roundConfig.status,
};

export const sections: DeckSection[] = (sectionsConfig.sections as RawSection[]).map(
  (s, i): DeckSection => ({
    key: s.key,
    // ← เลขหัวข้อเกิดตรงนี้ที่เดียว
    number: `${sectionsConfig.department}.${i + 1}`,
    title: s.title,
    frequency: s.frequency as Frequency,
    blocks: s.blocks.map((b): DeckBlock => {
      const type = toBlockType(b.type);
      return {
        id: b.id,
        type,
        // ปกกับปิดท้ายไม่มี title ใน config เพราะระบบสร้างข้อความเอง
        title: b.title ?? s.title,
        mode: b.mode ?? 'manual',
        buildStep: BUILD_STEP[type],
        raw: b,
      };
    }),
  }),
);

/** เด็คทั้งเล่มเรียงเป็นหน้า ๆ */
export const slides: DeckSlide[] = sections.flatMap((section) =>
  section.blocks.map((block) => ({ page: 0, section, block })),
).map((s, i) => ({ ...s, page: i + 1 }));

export const findSlide = (blockId: string): DeckSlide | undefined =>
  slides.find((s) => s.block.id === blockId);

/** นับบล็อกแยกตามชนิด ใช้บนหน้าสารบัญเพื่อดูว่าเหลืออะไร */
export function blockCounts(): Array<{ type: BlockType; count: number; step: number; done: boolean }> {
  const tally = new Map<BlockType, number>();
  for (const s of slides) tally.set(s.block.type, (tally.get(s.block.type) ?? 0) + 1);
  return [...tally.entries()]
    .map(([type, count]) => ({ type, count, step: BUILD_STEP[type], done: IMPLEMENTED.has(type) }))
    .sort((a, b) => a.step - b.step || b.count - a.count);
}
