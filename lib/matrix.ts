/**
 * matrix.ts — ตัวคำนวณของตาราง 12 เดือน และกราฟที่สร้างจากตารางเดียวกัน
 *
 * ตัวเลขทุกตัวที่ขึ้นจอต้องผ่านไฟล์นี้ (PROJECT.md กฎข้อ 1 และ 6)
 * ห้ามคำนวณสด ๆ ในคอมโพเนนต์ และห้ามให้ Gemini คิดเอง
 */

import roundConfig from '@/config/round.json';
import {
  MONTHS_SHORT,
  UNITS,
  aggregate,
  isFilled,
  latestMonthIndex,
  type Cell,
  type MatrixBlock,
  type MatrixRow,
  type ChartBlock,
  type ListTableBlock,
  type PhotoGridBlock,
  type PhotoSetBlock,
  type ScanBlock,
  type TextBlock,
  type TrendFacts,
  type UnitKey,
} from '@/shared/schema';
import { findSlide, type DeckBlock } from './deck';

/* ------------------------------------------------------------------ */
/* อ่านบล็อกจาก config                                                  */
/* ------------------------------------------------------------------ */

export const asMatrix = (b: DeckBlock): MatrixBlock => b.raw as unknown as MatrixBlock;
export const asChart = (b: DeckBlock): ChartBlock => b.raw as unknown as ChartBlock;
export const asList = (b: DeckBlock): ListTableBlock => b.raw as unknown as ListTableBlock;
export const asPhotoGrid = (b: DeckBlock): PhotoGridBlock => b.raw as unknown as PhotoGridBlock;
export const asPhotoSet = (b: DeckBlock): PhotoSetBlock => b.raw as unknown as PhotoSetBlock;
export const asScan = (b: DeckBlock): ScanBlock => b.raw as unknown as ScanBlock;
export const asText = (b: DeckBlock): TextBlock => b.raw as unknown as TextBlock;

export function matrixById(id: string): MatrixBlock | undefined {
  const slide = findSlide(id);
  return slide && slide.block.type === 'monthly-matrix' ? asMatrix(slide.block) : undefined;
}

/* ------------------------------------------------------------------ */
/* มุมมองของตารางที่พร้อมเรนเดอร์                                        */
/* ------------------------------------------------------------------ */

export interface MatrixView {
  /** แถวที่แสดงบนหน้านี้ (ตารางยาวถูกหั่นเป็นหลายหน้า) */
  rows: MatrixRow[];
  /** แถวทั้งหมดที่มองเห็นได้ของบล็อก — ยอดรวมคำนวณจากชุดนี้เสมอ ไม่ใช่เฉพาะหน้านี้ */
  allRows: MatrixRow[];
  /** ดัชนีเดือนที่แสดง — ตัดเดือนที่ยังไม่ถึงออกเมื่อ hideFutureMonths */
  months: number[];
  monthLabels: string[];
  /** เดือนล่าสุดที่มีข้อมูล (-1 = ยังไม่มีเลย) ใช้ตีกรอบไฮไลต์ */
  latest: number;
  /** หน่วยร่วมของทุกแถว — null ถ้าปนกัน (จึงรวมท้ายคอลัมน์ไม่ได้) */
  sharedUnit: UnitKey | null;
  /** ค่ารวมท้ายแถว ตามกฎ agg ของหน่วย */
  rowTotals: Array<number | null>;
  /** แถวที่ไม่มีรายการเลยทั้งปี — ช่องรวมขึ้น "-" */
  rowAllNone: boolean[];
  /** ค่าเฉลี่ยท้ายแถว — มีเฉพาะหน่วยที่ agg = sum เท่านั้น */
  rowAverages: Array<number | null>;
  /** รวมท้ายคอลัมน์ทีละเดือน — null ทั้งแถวถ้าหน่วยปนกันหรือหน่วยห้ามรวม */
  columnTotals: Array<number | null> | null;
  grandTotal: number | null;
  showAverage: boolean;
  showRate: boolean;
  /** เชิงอรรถจากแถวที่ยังแสดงอยู่ */
  notes: Array<{ label: string; note: string }>;
}

/** แถวที่ทุกช่องเป็น "ไม่มีรายการ" — ช่องรวมต้องขึ้น "-" ไม่ใช่ว่าง มิฉะนั้นดูเหมือนลืมกรอก */
const allNone = (r: MatrixRow) => r.values.some((c) => c === 'none') && !r.values.some(isFilled);

/**
 * แถวที่ตั้ง hideIfEmpty แล้วไม่มีข้อมูลเลยทั้งปีจะถูกซ่อน
 * แก้ปัญหาแถว "-" ยาว 12 ช่องที่กินพื้นที่ฟรี (PROJECT.md ข้อ 2.6)
 */
const hasAnyValue = (r: MatrixRow) => r.values.some(isFilled);

export function buildMatrixView(block: MatrixBlock, rowKeys?: string[]): MatrixView {
  const allRows = block.rows.filter((r) => !r.hideIfEmpty || hasAnyValue(r));
  const rows = rowKeys ? allRows.filter((r) => rowKeys.includes(r.key)) : allRows;

  // ช่วงเดือนและยอดรวมยึดจากทั้งบล็อก ไม่ใช่เฉพาะแถวที่หน้านี้แสดง
  // ไม่งั้นหน้า 2 ของตารางเดียวกันจะกางคอลัมน์เดือนไม่เท่าหน้า 1
  const latest = latestMonthIndex(allRows);

  // ตัดคอลัมน์เดือนที่ยังไม่ถึงออก ตัวหนังสือที่เหลือจึงใหญ่ขึ้นทันที
  // (PROJECT.md ข้อ 2.7) · ถ้ายังไม่มีข้อมูลเลยให้กางถึงเดือนของรอบที่ทำอยู่
  // เพื่อให้เห็นช่องว่างที่ยังไม่ได้กรอก ไม่ใช่ซ่อนจนไม่รู้ว่าลืม
  const through = block.hideFutureMonths ? Math.max(latest, roundConfig.month - 1) : 11;
  const months = Array.from({ length: through + 1 }, (_, i) => i);

  const units = new Set(allRows.map((r) => r.unit));
  const sharedUnit = units.size === 1 ? [...units][0] : null;
  const sharedAgg = sharedUnit ? UNITS[sharedUnit].agg : null;

  const rowTotals = rows.map((r) => aggregate(r));
  const rowAllNone = rows.map(allNone);

  const rowAverages = rows.map((r) => {
    if (UNITS[r.unit].agg !== 'sum') return null;
    const nums = r.values.filter(isFilled);
    return nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : null;
  });

  // รวมท้ายคอลัมน์ทำได้ต่อเมื่อทุกแถวหน่วยเดียวกัน — % และราคาต่อหน่วยรวมกันไม่ได้
  const columnTotals =
    sharedAgg === 'sum' || sharedAgg === 'avg'
      ? months.map((m) => {
          const nums = allRows.map((r) => r.values[m]).filter(isFilled);
          if (!nums.length) return null;
          const sum = nums.reduce((a, b) => a + b, 0);
          return sharedAgg === 'avg' ? sum / nums.length : sum;
        })
      : null;

  const grandTotal =
    columnTotals === null
      ? null
      : (() => {
          const nums = allRows.map(aggregate).filter((v): v is number => v !== null);
          if (!nums.length) return null;
          const sum = nums.reduce((a, b) => a + b, 0);
          return sharedAgg === 'avg' ? sum / nums.length : sum;
        })();

  return {
    rows,
    allRows,
    months,
    monthLabels: months.map((m) => MONTHS_SHORT[m]),
    latest,
    sharedUnit,
    rowTotals,
    rowAllNone,
    rowAverages,
    columnTotals,
    grandTotal,
    showAverage: Boolean(block.showAverageColumn) && sharedAgg === 'sum',
    showRate: rows.some((r) => typeof r.rate === 'number'),
    notes: rows
      .filter((r): r is MatrixRow & { note: string } => Boolean(r.note))
      .map((r) => ({ label: r.label, note: r.note })),
  };
}

/* ------------------------------------------------------------------ */
/* บรรทัดสรุปที่อัปเดตตามตารางเสมอ                                       */
/* ------------------------------------------------------------------ */

/**
 * ข้อเท็จจริงล้วน ๆ ที่โค้ดคำนวณเสร็จแล้ว
 * ขั้นที่ 6 จะส่ง object นี้ให้ Gemini เรียบเรียงเป็นภาษาสวย — แต่ห้ามแก้ตัวเลข
 */
export function buildTrendFacts(block: MatrixBlock, view: MatrixView): TrendFacts | null {
  if (view.sharedUnit === null || view.grandTotal === null || view.latest < 0) return null;

  const unit = UNITS[view.sharedUnit];
  const period = `${MONTHS_SHORT[0]}–${MONTHS_SHORT[view.latest]} ${roundConfig.year}`;

  // แถวที่มากที่สุด + สัดส่วน
  let top: TrendFacts['top'];
  if (view.allRows.length > 1 && unit.agg === 'sum' && view.grandTotal > 0) {
    let bestIndex = -1;
    let bestValue = -Infinity;
    view.allRows.map(aggregate).forEach((v, i) => {
      if (v !== null && v > bestValue) {
        bestValue = v;
        bestIndex = i;
      }
    });
    if (bestIndex >= 0) {
      top = {
        label: view.allRows[bestIndex].label,
        value: bestValue,
        share: (bestValue / view.grandTotal) * 100,
      };
    }
  }

  // เดือนล่าสุดเทียบเดือนก่อนหน้า
  let latestFact: TrendFacts['latest'];
  if (view.columnTotals) {
    const idx = view.months.indexOf(view.latest);
    const now = idx >= 0 ? view.columnTotals[idx] : null;
    if (now !== null) {
      const prev = idx > 0 ? view.columnTotals[idx - 1] : null;
      latestFact = {
        month: MONTHS_SHORT[view.latest],
        value: now,
        changePct: prev !== null && prev !== 0 ? ((now - prev) / prev) * 100 : null,
      };
    }
  }

  return {
    period,
    total: view.grandTotal,
    unitLabel: unit.label,
    top,
    latest: latestFact,
    notes: view.notes.map((n) => `${n.label}: ${n.note}`),
  };
}

const fmt = (v: number, decimals: number) =>
  v.toLocaleString('en-US', { minimumFractionDigits: decimals, maximumFractionDigits: decimals });

/**
 * ประโยคสรุปที่โค้ดประกอบเอง — เป็น fallback บังคับตาม PROJECT.md กฎข้อ 1
 * ต่อให้ไม่มี Gemini หรือ API ล่ม บรรทัดนี้ก็ยังขึ้นและยังตรงกับตารางเสมอ
 * เพราะช่วงเดือนคำนวณจากข้อมูลจริง ไม่ใช่ข้อความที่พิมพ์ค้างไว้ (PROJECT.md ข้อ 2.5)
 */
export function summarySentence(facts: TrendFacts, unitKey: UnitKey): string {
  const d = UNITS[unitKey].decimals;
  const parts = [`${facts.period} รวม ${fmt(facts.total, d)} ${facts.unitLabel}`];

  if (facts.top) {
    parts.push(`${facts.top.label}มากที่สุด ${fmt(facts.top.value, d)} ${facts.unitLabel} (${facts.top.share.toFixed(1)}%)`);
  }

  if (facts.latest) {
    const change =
      facts.latest.changePct === null
        ? ''
        : facts.latest.changePct >= 0
          ? ` เพิ่มขึ้น ${facts.latest.changePct.toFixed(1)}% จากเดือนก่อน`
          : ` ลดลง ${Math.abs(facts.latest.changePct).toFixed(1)}% จากเดือนก่อน`;
    parts.push(`${facts.latest.month} ${fmt(facts.latest.value, d)} ${facts.unitLabel}${change}`);
  }

  return parts.join(' · ');
}

/* ------------------------------------------------------------------ */
/* กราฟ — สร้างจากตารางเดียวกัน ไม่กรอกตัวเลขซ้ำ                          */
/* ------------------------------------------------------------------ */

export interface ChartSeries {
  key: string;
  label: string;
  color: string;
  /** ค่าตามเดือนที่แสดง · null = ไม่มีค่า (ไม่วาดแท่ง) */
  values: Array<number | null>;
  rate?: number;
}

export interface ChartView {
  monthLabels: string[];
  series: ChartSeries[];
  max: number;
  unitKey: UnitKey;
  unitLabel: string;
  cards: Array<{ label: string; value: string }>;
  sourceTitle: string;
}

/**
 * ลำดับสีชุดข้อมูล — ตายตัว ห้ามวนซ้ำและห้ามสลับตามอันดับ
 * ชุดนี้ผ่านการตรวจ CVD/คอนทราสต์แล้ว (ΔE ตาบอดสีต่ำสุด 9.1 · สายตาปกติ 19.6)
 * สามสีมีคอนทราสต์ต่ำกว่า 3:1 บนพื้นขาว จึงต้องมีตารางกำกับเสมอ —
 * ซึ่งมีอยู่แล้วเพราะกราฟทุกอันวางถัดจากตารางต้นทางของมันใน sections.json
 */
const SERIES_COLORS = ['#2a78d6', '#eb6834', '#1baf7a', '#eda100', '#e87ba4'] as const;

/** เกินจำนวนสีที่ตรวจผ่านแล้วให้ยุบเป็น "อื่น ๆ" ห้ามสร้างสีใหม่เอง */
export const MAX_SERIES = SERIES_COLORS.length;

export function buildChartView(chart: ChartBlock): ChartView | null {
  const source = matrixById(chart.sourceBlockId);
  if (!source) return null;

  const view = buildMatrixView(source);
  if (view.sharedUnit === null) return null;

  const picked = chart.rowKeys
    ? view.allRows.filter((r) => chart.rowKeys!.includes(r.key))
    : view.allRows;

  const head = picked.slice(0, MAX_SERIES);
  const tail = picked.slice(MAX_SERIES);

  const series: ChartSeries[] = head.map((r, i) => ({
    key: r.key,
    label: r.label,
    color: SERIES_COLORS[i],
    values: view.months.map((m) => (isFilled(r.values[m]) ? (r.values[m] as number) : null)),
    rate: r.rate,
  }));

  // ชุดที่เกินโควตาสีถูกยุบรวมเป็นก้อนเดียว ไม่ใช่ตัดทิ้งเงียบ ๆ
  if (tail.length) {
    series.push({
      key: '__other',
      label: `อื่น ๆ (${tail.length} รายการ)`,
      color: '#8a8a8a',
      values: view.months.map((m) => {
        const nums = tail.map((r) => r.values[m]).filter(isFilled);
        return nums.length ? nums.reduce((a, b) => a + b, 0) : null;
      }),
    });
  }

  const max = Math.max(
    0,
    ...series.flatMap((s) => s.values.filter((v): v is number => v !== null)),
  );

  const unit = UNITS[view.sharedUnit];
  const d = unit.decimals;

  const cards = (chart.summaryCards ?? []).map((c) => {
    switch (c.compute) {
      case 'total':
        return { label: c.label, value: `${fmt(view.grandTotal ?? 0, d)} ${unit.label}` };
      case 'average': {
        const nums = picked
          .filter((r) => UNITS[r.unit].agg === 'sum')
          .map((r) => {
            const ns = r.values.filter(isFilled);
            return ns.length ? ns.reduce((a, b) => a + b, 0) / ns.length : null;
          })
          .filter((v): v is number => v !== null);
        const avg = nums.length ? nums.reduce((a, b) => a + b, 0) / nums.length : 0;
        return { label: c.label, value: `${fmt(avg, d)} ${unit.label}` };
      }
      case 'priceAverage': {
        // ราคาเฉลี่ยถ่วงน้ำหนักด้วยปริมาณ — ห้ามเอาราคาต่อหน่วยมาบวกแล้วหาร
        // (PROJECT.md กฎข้อ 6) เพราะรายการที่ขายน้อยจะถ่วงผลเท่ารายการที่ขายมาก
        let value = 0;
        let qty = 0;
        picked.forEach((r) => {
          if (typeof r.rate !== 'number') return;
          const t = aggregate(r);
          if (t === null) return;
          value += t * r.rate;
          qty += t;
        });
        return {
          label: c.label,
          value: qty > 0 ? `${fmt(value / qty, UNITS.rate.decimals)} ${UNITS.rate.label}` : '—',
        };
      }
    }
  });

  return {
    monthLabels: view.monthLabels,
    series,
    max,
    unitKey: view.sharedUnit,
    unitLabel: unit.label,
    cards,
    sourceTitle: source.title,
  };
}

export { fmt as formatNumber };
export type { Cell };
