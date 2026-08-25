/**
 * deck.ts — แปลง config เป็นลำดับสไลด์
 *
 * ที่เดียวในระบบที่สร้าง "เลขหัวข้อ" — สร้างจากลำดับใน sections.json เท่านั้น
 * (PROJECT.md กฎข้อ 3) ห้ามมีสตริงเลขหัวข้อ hardcode ที่ไฟล์อื่นเด็ดขาด
 */

import sectionsConfig from '@/config/sections.json';
import photosConfig from '@/config/photos.json';
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

/** ตารางยาวถูกหั่นเป็นหลายหน้า — ส่วนนี้บอกว่าหน้านี้แสดงแถวไหนบ้าง */
export interface SlidePart {
  index: number;   // เริ่มที่ 1
  total: number;
  rowKeys: string[];
  /** true = หน้าสุดท้ายของบล็อกนี้ · แถวรวมกับบรรทัดสรุปขึ้นเฉพาะหน้านี้ */
  isLast: boolean;
}

/** สไลด์หนึ่งหน้า — ผูกกลับไปหาหัวข้อที่มันสังกัด */
export interface DeckSlide {
  /** ลำดับหน้าในเด็ค เริ่มที่ 1 */
  page: number;
  section: DeckSection;
  block: DeckBlock;
  /** มีเฉพาะตารางที่ยาวเกินหนึ่งหน้า */
  part?: SlidePart;
}

/**
 * แถวสูงสุดต่อหนึ่งหน้า — เกินกว่านี้ตัวหนังสือจะเล็กจนอ่านบนจอโปรเจกเตอร์ไม่ออก
 * ตารางที่ยาวกว่านี้หั่นเป็นหลายหน้าแทนการย่อตัวหนังสือลงไปเรื่อย ๆ
 * เลขนี้เผื่อฉลากภาษาไทยยาว ๆ ที่ตัดเป็น 2 บรรทัดไว้แล้ว · ตรวจด้วย scripts/check-overflow.mjs
 */
const MAX_ROWS_PER_SLIDE = 9;

interface RawMatrixRow {
  key: string;
  hideIfEmpty?: boolean;
  values: Array<number | 'none' | null>;
}

/** แถวที่จะได้ขึ้นจอจริง — ตัดแถวที่ตั้ง hideIfEmpty แล้วว่างทั้งปีออกก่อน */
function visibleRowKeys(block: RawBlock): string[] {
  const rows = (block.rows as RawMatrixRow[] | undefined) ?? [];
  return rows
    .filter((r) => !r.hideIfEmpty || r.values.some((v) => typeof v === 'number'))
    .map((r) => r.key);
}

/**
 * หั่นบล็อกเป็นหน้า ๆ · บล็อกทั่วไปได้หน้าเดียวเสมอ
 * monthly-matrix อ้างแถวด้วย key ของแถว · ที่เหลืออ้างด้วยลำดับเป็นสตริง
 */
function splitBlock(section: DeckSection, block: DeckBlock): DeckSlide[] {
  // นับเฉพาะรูปที่ไม่ได้ซ่อน — รูปที่ซ่อนไม่ควรดันให้เกิดหน้าใหม่
  const photoCount = (
    (photosConfig.blocks as Record<string, Array<{ hidden?: boolean }>>)[block.id] ?? []
  ).filter((p) => !p.hidden).length;
  const byIndex = (n: number) => Array.from({ length: n }, (_, i) => String(i));

  let keys: string[];
  let limit: number;

  switch (block.type) {
    case 'monthly-matrix':
      keys = visibleRowKeys(block.raw);
      limit = MAX_ROWS_PER_SLIDE;
      break;
    case 'list-table':
      keys = byIndex(((block.raw.rows as unknown[] | undefined) ?? []).length);
      limit = MAX_ROWS_PER_SLIDE;
      break;
    case 'photo-grid': {
      // กริดเต็มหนึ่งหน้าตามที่ config กำหนด · เกินกว่านั้นขึ้นหน้าใหม่เอง
      const l = block.raw.layout as { cols: number; rows: number; framesPerSlide: number };
      keys = byIndex(photoCount);
      limit = Math.max(1, l.cols * l.rows * l.framesPerSlide);
      break;
    }
    case 'photo-set':
      keys = byIndex(photoCount);
      limit = Math.max(1, (block.raw.max as number | undefined) ?? 7);
      break;
    default:
      return [{ page: 0, section, block }];
  }

  if (keys.length <= limit) return [{ page: 0, section, block }];

  const pages = Math.ceil(keys.length / limit);

  // ตารางเกลี่ยให้ทุกหน้าแถวใกล้เคียงกัน ดีกว่าปล่อยหน้าสุดท้ายเหลือแถวเดียว
  // แต่กริดรูปห้ามเกลี่ย — ต้องอัดเต็มหน้าตามจำนวนช่องที่ config กำหนด
  // ไม่งั้นกรอบย่อยหายไปหนึ่งกรอบและช่องรูปเพี้ยนขนาดกันคนละหน้า
  const per = block.type === 'photo-grid' ? limit : Math.ceil(keys.length / pages);

  return Array.from({ length: pages }, (_, i) => ({
    page: 0,
    section,
    block,
    part: {
      index: i + 1,
      total: pages,
      rowKeys: keys.slice(i * per, (i + 1) * per),
      isLast: i === pages - 1,
    },
  }));
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
export const IMPLEMENTED: ReadonlySet<BlockType> = new Set<BlockType>([
  'cover',
  'closing',
  'monthly-matrix',
  'chart',
  'list-table',
  'photo-grid',
  'photo-set',
  'scan',
]);

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
export const slides: DeckSlide[] = sections
  .flatMap((section) => section.blocks.flatMap((block) => splitBlock(section, block)))
  .map((s, i) => ({ ...s, page: i + 1 }));

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
