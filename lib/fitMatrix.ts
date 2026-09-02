/**
 * fitMatrix.ts — เลือกขนาดตัวอักษรและความกว้างคอลัมน์ของตาราง 12 เดือน
 *
 * ## ปัญหาที่แก้
 *
 * ตารางเดือนกว้าง 14–18 คอลัมน์ ยัดอยู่ในสไลด์ 16:9 ที่ความสูงตายตัว
 * ของเดิมเดาขนาดตัวอักษรจาก "จำนวนแถว × 1.6 บรรทัด" อย่างเดียว แล้วปล่อยให้
 * เบราว์เซอร์แบ่งความกว้างคอลัมน์เอง (`table-layout: auto`) — ซึ่งพังเป็นวงจร:
 *
 *   ตัวอักษรใหญ่ → คอลัมน์ตัวเลขกินที่ → คอลัมน์ฉลากถูกบีบเหลือ 90px
 *   → ฉลากไทยตัดคำละบรรทัด แถวสูงขึ้น 5 เท่า → ตารางล้นออกนอกสไลด์
 *
 * วัดจริงจากเด็คปัจจุบัน: `m-op` สูง 72cqw ทั้งที่สไลด์มีที่ให้ 38cqw
 * ครึ่งตารางหายไปเฉย ๆ ทั้งบนจอและใน PDF โดยไม่มี error อะไรเลย
 *
 * ## วิธีแก้
 *
 * ล็อกความกว้างคอลัมน์เอง (`table-layout: fixed` + `<colgroup>`) แล้วไล่ลองขนาด
 * ตัวอักษรจากใหญ่ไปเล็ก เลือกอันแรกที่ผ่านทั้งสองข้อ:
 *
 *   1. **กว้างพอ** — ทุกคอลัมน์กว้างพอใส่ข้อความที่ยาวที่สุดของตัวเอง
 *      และคอลัมน์ฉลากยังเหลือไม่น้อยกว่า 20% ของตาราง
 *   2. **สูงพอ** — ความสูงตารางที่ประเมินได้ ยังไม่เกินที่ว่างใต้หัวสไลด์
 *
 * ทุกอย่างคำนวณจากตัวเลขล้วน ๆ ไม่ต้องวัดในเบราว์เซอร์ ผลจึงตรงกันทั้งตอน
 * เรนเดอร์บนเซิร์ฟเวอร์และบนจอ (ไม่มี hydration mismatch) และเหมือนกันตอนพิมพ์ PDF
 *
 * ค่าคงที่ทุกตัวมาจากการ**วัดฟอนต์ Sarabun จริงในเบราว์เซอร์** ไม่ได้เดา
 * ถ้าเปลี่ยนฟอนต์หรือเปลี่ยน padding ในสไลด์ ต้องวัดใหม่ (ดู skill `verify`)
 *
 * **วิธีตรวจว่าโมเดลยังตรง**: ใส่ `data-fit={heightCqw}` ชั่วคราวบน `<table>` ใน
 * `MatrixSlide.tsx` แล้วเทียบกับความสูงจริงในเบราว์เซอร์ · ค่าที่ประเมินต้อง
 * **ไม่ต่ำกว่า**ของจริงทุกสไลด์ · ประเมินขาดเมื่อไรคือตารางจะล้นโดยไม่มีใครรู้
 */

/* ---------- ค่าคงที่ที่วัดมาจากของจริง ---------- */

/** ความกว้างตัวอักษรเทียบกับขนาดฟอนต์ · Sarabun: เลขกับพยัญชนะไทยกว้างเท่ากัน */
const EM_CHAR = 0.55;
/** วรรค จุลภาค มหัพภาค วงเล็บ — แคบกว่าตัวอักษรราวครึ่งหนึ่ง */
const EM_PUNCT = 0.3;
/** สระบน-ล่างและวรรณยุกต์ไทยลอยทับตัวก่อนหน้า ไม่กินความกว้างเลย */
const THAI_COMBINING = /[ัิ-ฺ็-๎]/g;

/** ระยะบรรทัดของช่องทั่วไป (ไม่ได้ใส่คลาส leading-*) */
const LINE_NORMAL = 1.55;
/** ระยะบรรทัดของช่องฉลากที่ใส่ `leading-tight` */
const LINE_TIGHT = 1.25;

/** สไลด์กว้าง 100cqw · ในสไลด์เว้นขอบซ้าย-ขวาข้างละ 3.5cqw */
const TABLE_W = 93;
/** เส้นขอบตาราง 1px ต่อคอลัมน์ ≈ 0.1cqw ที่ความกว้างสไลด์จริง */
const BORDER = 0.1;

/** ฉลากไทยตัดคำได้ ปลายบรรทัดจึงเหลือที่ว่างเสมอ — คิดว่าใช้ได้จริง 92% */
const WRAP_FILL = 0.92;

/**
 * เผื่อความกว้างไว้ 6% เสมอ · ประเมินขาดแล้วเจ็บกว่าประเมินเกินมาก —
 * ขาดไปนิดเดียวหัวตารางก็ตัดเป็นสองบรรทัด ตารางสูงขึ้นเกินที่คำนวณไว้ทั้งแผง
 *
 * มาจากสองทางรวมกัน วัดจริงทั้งคู่:
 *  · หัวตารางกับแถวรวมเป็น `font-semibold` ซึ่งกว้างกว่าตัวปกติ ~3%
 *  · ตัวอักษรไทยแต่ละตัวกว้างไม่เท่ากัน ค่าเฉลี่ย 0.55em พลาดได้ถึง ~3%
 *    (เช่น "หน่วย" โมเดลได้ 2.20em ของจริง 2.36em)
 */
const WIDTH_SAFETY = 1.06;

/** คอลัมน์ฉลากต้องไม่แคบกว่านี้ ไม่งั้นตัดคำละบรรทัดจนแถวสูงพรวด */
const LABEL_MIN = TABLE_W * 0.20;
/** และไม่ต้องกว้างเกินนี้ ที่เหลือคืนให้คอลัมน์ตัวเลขหายใจ */
const LABEL_MAX = TABLE_W * 0.42;

/** ใหญ่สุดที่ยอมให้ · เท่ากับของเดิม ตารางสั้น ๆ จะได้หน้าตาไม่เปลี่ยน */
const FONT_MAX = 1.75;
/** เล็กสุดที่ยังอ่านออกตอนพิมพ์ (0.9cqw ของกระดาษ 13.3 นิ้ว ≈ 8.6pt) */
const FONT_MIN = 0.9;
const FONT_STEP = 0.025;

/* ---------- ตัวช่วย ---------- */

/** ความกว้างของข้อความ หน่วยเป็น em (คูณด้วยขนาดฟอนต์แล้วได้ cqw) */
function textEm(s: string): number {
  let w = 0;
  for (const ch of s.replace(THAI_COMBINING, '')) {
    w += /[\p{L}\p{N}]/u.test(ch) ? EM_CHAR : EM_PUNCT;
  }
  return w;
}

/** ข้อความยาว ๆ วางในกล่องกว้าง `boxCqw` จะกินกี่บรรทัด */
function wrapLines(s: string, boxCqw: number, fontCqw: number): number {
  if (!s) return 1;
  const usable = boxCqw * WRAP_FILL;
  if (usable <= 0) return 1;
  return Math.max(1, Math.ceil((textEm(s) * WIDTH_SAFETY * fontCqw) / usable));
}

/* ---------- ข้อมูลเข้า-ออก ---------- */

export interface FitColumn {
  /** ข้อความทุกช่องของคอลัมน์นี้ รวมหัวตาราง — เอาไว้หาอันที่ยาวที่สุด */
  texts: string[];
  /** ระยะเว้นซ้าย+ขวาในช่อง หน่วย cqw */
  padCqw: number;
}

export interface FitInput {
  /** คอลัมน์ทั้งหมด · ตัวแรกคือคอลัมน์ฉลาก ซึ่งเป็นตัวเดียวที่ยอมให้ตัดหลายบรรทัด */
  columns: FitColumn[];
  /** ฉลากของแต่ละแถว เรียงตามที่จะเรนเดอร์ */
  labels: string[];
  /** มีแถว "รวม" ปิดท้ายไหม */
  totalRow: boolean;
  /** ที่ว่างสำหรับตาราง หน่วย cqw (หักหัวสไลด์และข้อความใต้ตารางออกแล้ว) */
  availCqw: number;
}

export interface FitResult {
  fontCqw: number;
  /** ความกว้างแต่ละคอลัมน์เป็น % ของตาราง · รวมกันได้ 100 พอดี */
  widthsPct: number[];
  /** ความสูงตารางที่ประเมินได้ · เกิน availCqw = ยัดไม่ลงแม้ตอนตัวอักษรเล็กสุด */
  heightCqw: number;
}

/* ---------- ตัวคำนวณ ---------- */

/** ความกว้างที่คอลัมน์หนึ่งต้องการ (cqw) ถ้าไม่ยอมให้ตัดบรรทัด */
const needCqw = (c: FitColumn, font: number) =>
  Math.max(...c.texts.map(textEm), 0) * WIDTH_SAFETY * font + c.padCqw + BORDER;

function measure(input: FitInput, font: number) {
  const { columns, labels, totalRow } = input;

  // คอลัมน์อื่นห้ามตัดบรรทัด จึงกินความกว้างตามข้อความที่ยาวที่สุดของตัวเอง
  const others = columns.slice(1).map((c) => needCqw(c, font));
  const otherW = others.reduce((a, b) => a + b, 0);

  // คอลัมน์ฉลากเอาแค่พอใส่ฉลากที่ยาวที่สุดในบรรทัดเดียว แต่ไม่ต่ำกว่าขั้นต่ำ
  // ที่เหลือคืนให้คอลัมน์ตัวเลขไปเฉลี่ยกัน · ไม่งั้นตารางแถวเดียวจะได้คอลัมน์แรกโล่งครึ่งหน้า
  const labelWant = needCqw(columns[0], font);
  const labelW = Math.min(LABEL_MAX, TABLE_W - otherW, Math.max(LABEL_MIN, labelWant));
  const slack = TABLE_W - otherW - labelW;

  const labelBox = labelW - columns[0].padCqw - BORDER;
  const bodyLines = labels.map((l) => wrapLines(l, labelBox, font));

  // ความสูงแถว = ช่องที่สูงที่สุดในแถวนั้น · ฉลากใช้ leading-tight ช่องอื่นใช้ปกติ
  const rowH = (lines: number) =>
    Math.max(font * LINE_NORMAL, lines * font * LINE_TIGHT) + 0.7 + BORDER;

  const headH = font * LINE_NORMAL + 1.0 + BORDER;
  const totalH = totalRow ? font * LINE_NORMAL + 0.8 + BORDER : 0;
  const heightCqw = headH + bodyLines.reduce((a, l) => a + rowH(l), 0) + totalH;

  return { labelW, otherW, others, slack, heightCqw };
}

/**
 * เลือกขนาดตัวอักษรที่ใหญ่ที่สุดที่ยังใส่ได้ทั้งกว้างและสูง
 * ไล่จากใหญ่ลงเล็กทีละ 0.025cqw — ราว 35 รอบ ไม่มีผลกับเวลาเรนเดอร์
 */
export function fitMatrix(input: FitInput): FitResult {
  const steps = Math.round((FONT_MAX - FONT_MIN) / FONT_STEP);
  let font = FONT_MIN;
  let m = measure(input, FONT_MIN);

  // เดินจากใหญ่ลงเล็ก หยุดที่อันแรกที่ผ่าน · ไม่ผ่านสักอันก็ใช้ค่าเล็กสุดที่เตรียมไว้
  for (let i = 0; i <= steps; i += 1) {
    const f = FONT_MAX - i * FONT_STEP;
    const cand = measure(input, f);
    // กว้างเกินจนคอลัมน์ฉลากเหลือไม่ถึงขั้นต่ำ = ตัดคำละบรรทัดแน่ ๆ ข้ามไป
    if (TABLE_W - cand.otherW < LABEL_MIN) continue;
    if (cand.heightCqw > input.availCqw) continue;
    font = f;
    m = cand;
    break;
  }

  // แจกที่ว่างที่เหลือให้คอลัมน์อื่นตามส่วน — ตัวเลขจะได้ไม่ชิดเส้นเกินไป
  const share = m.others.reduce((a, b) => a + b, 0);
  const widths = [
    m.labelW,
    ...m.others.map((w) => w + (share > 0 ? (m.slack * w) / share : 0)),
  ];
  const sum = widths.reduce((a, b) => a + b, 0);

  return {
    fontCqw: font,
    widthsPct: widths.map((w) => (w / sum) * 100),
    heightCqw: m.heightCqw,
  };
}

/* ---------- ที่ว่างในสไลด์ ---------- */

/** ความสูงในกรอบเนื้อหาของสไลด์ (56.25cqw − ขอบบน 3 − ขอบล่าง 6 − เส้นขอบ) */
const CONTENT_H = 47.07;
/** หัวสไลด์ (เลขหัวข้อ + ชื่อ + เส้นคาด) สูงคงที่ ไม่ขึ้นกับขนาดตัวอักษรในตาราง */
const HEADER_H = 4.67;
/** ระยะห่างระหว่างหัวสไลด์กับตาราง (`mt-[1.6cqw]`) */
const GAP_H = 1.6;

/** ความสูงของบรรทัดสรุปใต้ตาราง (`mt-[1cqw] text-[1.35cqw] leading-snug`) */
export function summaryHeight(sentence: string): number {
  return 1.0 + wrapLines(sentence, TABLE_W, 1.35) * 1.35 * 1.375;
}

/** ความสูงของเชิงอรรถหนึ่งบรรทัด (`mt-[0.5cqw] text-[1.1cqw] leading-snug`) */
export function noteHeight(text: string): number {
  return 0.5 + wrapLines(text, TABLE_W, 1.1) * 1.1 * 1.375;
}

/** ที่ว่างที่เหลือให้ตาราง เมื่อรู้แล้วว่าข้อความใต้ตารางกินไปเท่าไร */
export function availableForTable(tailCqw: number): number {
  // 0.4 คือ `mt-[0.4cqw]` ของกล่องข้อความใต้ตาราง
  return CONTENT_H - HEADER_H - GAP_H - (tailCqw > 0 ? tailCqw + 0.4 : 0);
}
