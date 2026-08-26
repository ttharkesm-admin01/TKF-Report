/**
 * schema.ts — นิยามโครงข้อมูลกลาง
 * ใช้ร่วมกันทุกส่วน: หน้ากรอก · โหมดนำเสนอ · export PDF · ตัวคำนวณ
 *
 * กฎ: ห้ามมี logic การแสดงผลในไฟล์นี้ ให้เป็นแค่ type + ตารางค่าคงที่
 */

/* ------------------------------------------------------------------ */
/* หน่วยและการรวมค่า                                                    */
/* ------------------------------------------------------------------ */

/**
 * agg = วิธีคำนวณช่อง "รวม" ท้ายแถว
 *   sum  → บวกกัน           (กก. บาท ใบ ครั้ง)
 *   avg  → เฉลี่ย            (% อุณหภูมิ ppm คะแนน)
 *   none → ไม่มีช่องรวม      (ราคาต่อหน่วย — บวกแล้วไร้ความหมาย)
 *
 * ห้ามใช้ sum กับ % หรือ rate เด็ดขาด (ดู PROJECT.md กฎข้อ 6)
 */
export type Agg = 'sum' | 'avg' | 'none';

export interface UnitDef {
  label: string;      // ข้อความที่แสดงใต้หัวคอลัมน์ เช่น "( กก.)"
  decimals: number;
  agg: Agg;
  max?: number;       // ใช้กับ % เพื่อเตือนเมื่อกรอกเกิน
}

export const UNITS = {
  kg:      { label: 'กก.',        decimals: 0, agg: 'sum'  },
  unit:    { label: 'ใบ',         decimals: 0, agg: 'sum'  },
  baht:    { label: 'บาท',        decimals: 0, agg: 'sum'  },
  rate:    { label: 'บาท/หน่วย',  decimals: 2, agg: 'none' },
  percent: { label: '%',          decimals: 1, agg: 'avg', max: 100 },
  count:   { label: 'ครั้ง',      decimals: 0, agg: 'sum'  },
  person:  { label: 'คน',         decimals: 0, agg: 'sum'  },
  hour:    { label: 'ชม.',        decimals: 1, agg: 'sum'  },
  score:   { label: 'คะแนน',      decimals: 1, agg: 'avg'  },
  day:     { label: 'วัน',        decimals: 0, agg: 'sum'  },
} as const satisfies Record<string, UnitDef>;

export type UnitKey = keyof typeof UNITS;

/* ------------------------------------------------------------------ */
/* ค่าในช่อง — แยก "ไม่มีรายการ" ออกจาก "ยังไม่กรอก"                    */
/* ------------------------------------------------------------------ */

/**
 * number  → มีค่า
 * 'none'  → ไม่มีรายการเดือนนี้ · แสดง "-" · ไม่นับตอนหาค่าเฉลี่ย
 * null    → ยังไม่ได้กรอก · แสดงว่าง · ทำให้ validate ไม่ผ่าน
 *
 * ของเดิมใช้ "-" แทนทั้งสองกรณี จึงแยกไม่ออกว่า "ไม่มี" หรือ "ลืม"
 */
export type Cell = number | 'none' | null;

export const MONTHS = [
  'มกราคม', 'กุมภาพันธ์', 'มีนาคม', 'เมษายน', 'พฤษภาคม', 'มิถุนายน',
  'กรกฎาคม', 'สิงหาคม', 'กันยายน', 'ตุลาคม', 'พฤศจิกายน', 'ธันวาคม',
] as const;

export const MONTHS_SHORT = [
  'ม.ค.', 'ก.พ.', 'มี.ค.', 'เม.ย.', 'พ.ค.', 'มิ.ย.',
  'ก.ค.', 'ส.ค.', 'ก.ย.', 'ต.ค.', 'พ.ย.', 'ธ.ค.',
] as const;

/* ------------------------------------------------------------------ */
/* บล็อกเนื้อหา                                                        */
/* ------------------------------------------------------------------ */

export type BlockType =
  | 'cover'           // ปกคั่นหัวข้อ — สร้างอัตโนมัติจาก config
  | 'closing'         // ปิดท้าย — สร้างอัตโนมัติ
  | 'monthly-matrix'  // รายการ × 12 เดือน + รวม + เฉลี่ย
  | 'list-table'      // ตารางรายการทั่วไป ไม่มีมิติเดือน
  | 'chart'           // สร้างจาก monthly-matrix ตัวเดียวกัน ไม่กรอกซ้ำ
  | 'photo-grid'      // รูปจำนวนมาก จัดกริดอัตโนมัติ (งานสวน ซ่อมบำรุง)
  | 'photo-set'       // รูป 1–7 ใบ พร้อมคำบรรยาย
  | 'scan'            // ภาพเดียวเต็มหน้า (ฟอร์มสแกน ภาพแคป AppSheet)
  | 'text';           // ข้อความ / สรุป / ข้อเสนอ

/** โหมดการเติมข้อมูล */
export type FillMode =
  | 'manual'   // กรอกเอง ว่างทุกรอบ
  | 'carry'    // ยกค่าจากรอบก่อน + ติดธง "ยังไม่ยืนยัน"
  | 'import'   // ดูดจากไฟล์/ชีตตาม mapping ที่จำไว้
  | 'auto';    // ระบบสร้างเอง ไม่มีใครกรอก

export type Frequency = 'monthly' | 'twice-monthly' | 'quarterly' | 'annual' | 'on-event';

/* ------------------------------------------------------------------ */

export interface MatrixRow {
  key: string;
  label: string;
  unit: UnitKey;
  /** ซ่อนแถวนี้ถ้าไม่มีข้อมูลเลยทั้งปี — แก้ปัญหาแถว "-" ยาว 12 ช่อง */
  hideIfEmpty?: boolean;
  /** เป้าหมายเทียบผล */
  target?: number;
  targetDirection?: 'lower_better' | 'higher_better';
  /** ราคาต่อหน่วย (ถ้ามี) ใช้คำนวณคอลัมน์ราคาเฉลี่ย */
  rate?: number;
  /** เชิงอรรถ เช่น "ก.พ. บอยเลอร์หยุดซ่อม" — auditor มักถาม */
  note?: string;
  values: Cell[];   // ยาว 12 เสมอ
}

export interface MatrixBlock {
  type: 'monthly-matrix';
  id: string;
  title: string;
  mode: FillMode;
  rows: MatrixRow[];
  /** ซ่อนคอลัมน์เดือนที่ยังไม่ถึง — ทำให้ตัวหนังสือใหญ่ขึ้นทันที */
  hideFutureMonths: boolean;
  /** ไฮไลต์กรอบแดงที่เดือนล่าสุดที่มีข้อมูล (เลื่อนเองทุกเดือน) */
  highlightLatest: boolean;
  /** true = มีแถวรวมท้ายตาราง */
  showTotalRow: boolean;
  showAverageColumn?: boolean;
}

export interface ChartBlock {
  type: 'chart';
  id: string;
  title: string;
  mode: 'auto';
  /** อ้าง MatrixBlock.id — ห้ามกรอกตัวเลขซ้ำ */
  sourceBlockId: string;
  rowKeys?: string[];          // เลือกเฉพาะบางแถว ไม่ระบุ = ทุกแถว
  chartType: 'bar' | 'grouped-bar' | 'line';
  /** การ์ดสรุปมุมขวาบน เช่น รวม / น้ำหนักเฉลี่ย / ราคาเฉลี่ย */
  summaryCards?: Array<{ label: string; compute: 'total' | 'average' | 'priceAverage' }>;
}

export interface PhotoGridBlock {
  type: 'photo-grid';
  id: string;
  title: string;
  mode: 'manual';
  round?: number;              // รอบที่ 1 หรือ 2 — ใช้ตั้งเลขกำกับ "1 (n)"
  serviceDate?: string;        // "3-5 กรกฎาคม 2569"
  driveFolderId: string;
  sort: 'filename' | 'manual'; // filename เป็นค่าเริ่มต้น (วันที่อยู่บนตัวรูป ไม่ใช่ EXIF)
  layout: { cols: number; rows: number; framesPerSlide: number }; // ค่าเดิม 5 × 7 × 3
}

export interface PhotoSetBlock {
  type: 'photo-set';
  id: string;
  title: string;
  mode: 'manual';
  max: number;                 // 1–7 · ระบบเลือกการจัดวางตามจำนวนจริง
  captions: boolean;
  /** true = จับคู่ก่อนทำ-หลังทำ (งานซ่อมบำรุง) */
  beforeAfter?: boolean;
}

export interface ScanBlock {
  type: 'scan';
  id: string;
  title: string;
  mode: 'manual' | 'import';
  driveFolderId?: string;      // ดึงภาพล่าสุดของเดือนนั้น (เช่นภาพแคป AppSheet)
}

export interface ListColumn {
  key: string;
  label: string;
  unit?: UnitKey;
  width?: number;      // เปอร์เซ็นต์ของความกว้างตาราง
  /**
   * รวมช่องที่ค่าเหมือนกันและอยู่ติดกันเป็นช่องเดียว
   * ตารางแผนงานต้นฉบับใช้ช่องรวมแบบนี้ ("ที่", "ผู้รับผิดชอบ") จึงอ่านง่ายและสั้นลงมาก
   */
  merge?: boolean;
  /**
   * 'months' = แถบช่วงเดือน 12 ช่อง · ค่าในแถวเป็น [เดือนเริ่ม, เดือนจบ] (1–12)
   * ของเดิมกาง 12 เดือน × 5 สัปดาห์ = 60 ช่อง กินพื้นที่ครึ่งสไลด์
   * เพื่อบอกแค่ว่า "ทำทั้งปี" — ย่อเหลือ 12 ช่องได้ความหมายเท่าเดิม
   */
  kind?: 'text' | 'months';
}

/** ค่าในช่องตารางรายการ · คู่ตัวเลขใช้กับคอลัมน์ชนิด months */
export type ListCell = string | number | null | [number, number];

export interface ListTableBlock {
  type: 'list-table';
  id: string;
  title: string;
  mode: FillMode;
  columns: ListColumn[];
  rows: Array<Record<string, ListCell>>;
  /** แถวต่อหนึ่งหน้า — ตารางแถวสั้น ๆ ใส่ได้มากกว่าค่าเริ่มต้น */
  rowsPerSlide?: number;
}

export interface TextBlock {
  type: 'text';
  id: string;
  title: string;
  mode: 'manual';
  body: string;
}

export type Block =
  | MatrixBlock | ChartBlock | PhotoGridBlock
  | PhotoSetBlock | ScanBlock | ListTableBlock | TextBlock;

/* ------------------------------------------------------------------ */
/* หัวข้อและรอบรายงาน                                                  */
/* ------------------------------------------------------------------ */

export interface SectionConfig {
  /** ห้ามใส่เลขหัวข้อที่นี่ — เลขสร้างจากลำดับใน sections.json */
  key: string;
  title: string;
  frequency: Frequency;
  carryForward?: boolean;
  blocks: Block[];
}

export type RoundStatus = 'draft' | 'done';

export interface Round {
  id: string;
  year: number;            // พ.ศ. เช่น 2569
  month: number;           // 1–12
  status: RoundStatus;
  createdFromRoundId?: string;   // ตัวที่ทำให้ "สร้างจากรอบก่อน" ทำงาน
  sections: SectionConfig[];
}

/* ------------------------------------------------------------------ */
/* ตัวช่วยคำนวณ — ตัวเลขทุกตัวต้องผ่านตรงนี้ ห้ามให้ Gemini คิดเอง       */
/* ------------------------------------------------------------------ */

export const isFilled = (c: Cell): c is number => typeof c === 'number';

/** เดือนล่าสุดที่มีข้อมูล (0-indexed) · คืน -1 ถ้ายังไม่มีเลย */
export function latestMonthIndex(rows: MatrixRow[]): number {
  let last = -1;
  for (const r of rows) {
    r.values.forEach((v, i) => {
      if (v !== null && i > last) last = i;
    });
  }
  return last;
}

/** รวมท้ายแถวตามกฎของหน่วย */
export function aggregate(row: MatrixRow): number | null {
  const unit = UNITS[row.unit];
  const nums = row.values.filter(isFilled);
  if (unit.agg === 'none' || nums.length === 0) return null;
  const total = nums.reduce((a, b) => a + b, 0);
  return unit.agg === 'avg' ? total / nums.length : total;
}

export function formatCell(v: Cell, unit: UnitKey): string {
  if (v === null) return '';
  if (v === 'none') return '-';
  return v.toLocaleString('en-US', {
    minimumFractionDigits: UNITS[unit].decimals,
    maximumFractionDigits: UNITS[unit].decimals,
  });
}

/**
 * ข้อเท็จจริงที่ส่งให้ Gemini เรียบเรียงเป็นบรรทัดสรุป
 * Gemini ได้รับเฉพาะ object นี้ และห้ามคำนวณหรือเพิ่มตัวเลขใหม่
 */
export interface TrendFacts {
  period: string;                 // "ม.ค.–ก.ค. 2569"
  total: number;
  unitLabel: string;
  top?: { label: string; value: number; share: number };
  latest?: { month: string; value: number; changePct: number | null };
  notes?: string[];
}
