import { Slide, SlideFooter } from './Slide';
import { formatNumber } from '@/lib/matrix';
import {
  MONTHS_SHORT,
  UNITS,
  type ListCell,
  type ListColumn,
  type ListTableBlock,
} from '@/shared/schema';
import type { DeckMeta, DeckSection, SlidePart } from '@/lib/deck';

type Row = Record<string, ListCell>;

const same = (a: ListCell, b: ListCell) => JSON.stringify(a ?? null) === JSON.stringify(b ?? null);

/**
 * จำนวนแถวที่ช่องนี้กินลงไป
 * 0 = ถูกรวมเข้ากับแถวบนแล้ว ไม่ต้องวาด · ตารางแผนงานต้นฉบับก็รวมช่องแบบนี้
 */
function spanOf(rows: Row[], index: number, col: ListColumn): number {
  if (!col.merge) return 1;
  const v = rows[index][col.key] ?? null;
  if (index > 0 && same(rows[index - 1][col.key] ?? null, v)) return 0;
  let n = 1;
  while (index + n < rows.length && same(rows[index + n][col.key] ?? null, v)) n += 1;
  return n;
}

/**
 * แถบช่วงเดือน 12 ช่อง
 * ต้นฉบับกาง 12 เดือน × 5 สัปดาห์ = 60 ช่อง กินความกว้างครึ่งสไลด์
 * ทั้งที่ทุกแถวบอกอย่างเดียวกันว่า "ทำตลอดปี" — 12 ช่องให้ความหมายเท่ากันในพื้นที่ 1 ใน 5
 */
function MonthBar({ range }: { range: [number, number] | null }) {
  // ความสูงกำหนดตายตัว — `h-full` ในช่องตารางไม่มีความสูงให้อ้างอิง แถบจะหายไปเฉย ๆ
  return (
    <div className="flex h-[1.1cqw] w-full">
      {MONTHS_SHORT.map((m, i) => {
        const on = range !== null && i + 1 >= range[0] && i + 1 <= range[1];
        return (
          <span
            key={m}
            title={m}
            className={`flex-1 border-r border-line/60 last:border-r-0 ${on ? 'bg-brand' : 'bg-neutral-100'}`}
          />
        );
      })}
    </div>
  );
}

/**
 * ตารางรายการทั่วไป (ไม่มีมิติเดือน) — โครงตารางมาจาก config ทั้งหมด
 * คอมโพเนนต์นี้ไม่รู้จักตารางไหนเป็นพิเศษ เพิ่มตารางใหม่จึงไม่ต้องแตะโค้ด
 */
export function ListTableSlide({
  section,
  block,
  title,
  meta,
  part,
}: {
  section: DeckSection;
  block: ListTableBlock;
  title: string;
  meta: DeckMeta;
  part?: SlidePart;
}) {
  const columns = block.columns ?? [];
  const allRows = block.rows ?? [];
  const rows = part ? part.rowKeys.map((k) => allRows[Number(k)]).filter(Boolean) : allRows;

  const header = (
    <header className="flex items-baseline gap-[1.2cqw] border-b-[0.25cqw] border-brand pb-[1.2cqw]">
      <span className="text-[2.2cqw] font-bold text-brand">{section.number}</span>
      <h2 className="text-[2cqw] font-semibold">{title}</h2>
      {part && part.total > 1 && (
        <span className="ml-auto text-[1.4cqw] text-ink-soft">
          หน้า {part.index}/{part.total}
        </span>
      )}
    </header>
  );

  // ยังไม่ได้กำหนดคอลัมน์ใน config — บอกให้ชัดว่าต้องไปเติมที่ไหน
  // ต่างจาก "ยังไม่ได้กรอกข้อมูล" ซึ่งโครงตารางมีแล้วแต่ยังไม่มีเนื้อ
  if (columns.length === 0) {
    return (
      <Slide id={block.id}>
        <div className="flex h-full flex-col px-[3.5cqw] pt-[3cqw] pb-[6cqw]">
          {header}
          <div className="mt-[3cqw] flex flex-1 flex-col items-center justify-center rounded-[1cqw] border-[0.3cqw] border-dashed border-line text-center">
            <p className="text-[2.2cqw] font-semibold text-ink-soft">ยังไม่ได้กำหนดคอลัมน์</p>
            <p className="mt-[1cqw] text-[1.5cqw] text-ink-soft">
              เติม <span className="font-mono">columns</span> และ{' '}
              <span className="font-mono">rows</span> ให้บล็อกนี้ใน{' '}
              <span className="font-mono">config/sections.json</span>
            </p>
            <p className="mt-[1.6cqw] font-mono text-[1.3cqw] text-ink-soft opacity-70">
              list-table · {block.id} · mode: {block.mode}
            </p>
          </div>
        </div>
        <SlideFooter
          left={`${section.number} ${section.title}`}
          right={`${meta.monthLabel} ${meta.year}`}
        />
      </Slide>
    );
  }

  const hasMerge = columns.some((c) => c.merge);
  const rowCount = rows.length || 1;

  // ตารางที่รวมช่องเป็นแผนงานแถวสั้น ๆ บรรทัดเดียว จึงไม่ต้องเผื่อการตัดบรรทัดมาก
  const linesPerRow = hasMerge ? 1.05 : 1.6;
  const fontCqw = Math.min(1.75, Math.max(0.8, (41.7 / (rowCount * linesPerRow + 2)) * 0.62));

  return (
    <Slide id={part && part.index > 1 ? `${block.id}-${part.index}` : block.id}>
      <div className="flex h-full flex-col px-[3.5cqw] pt-[3cqw] pb-[6cqw]">
        {header}

        <div className="mt-[1.6cqw]">
          <table
            className="w-full border-collapse"
            style={{ fontSize: `${fontCqw}cqw` }}
          >
            <thead>
              <tr className="bg-brand text-white">
                {columns.map((c) => (
                  <th
                    key={c.key}
                    className="border border-line px-[0.8cqw] py-[0.5cqw] text-left font-semibold"
                    style={c.width ? { width: `${c.width}%` } : undefined}
                  >
                    {c.label}
                    {c.unit && (
                      <span className="ml-[0.4cqw] font-normal opacity-80">
                        ({UNITS[c.unit].label})
                      </span>
                    )}
                  </th>
                ))}
              </tr>
            </thead>

            <tbody>
              {rows.map((r, ri) => (
                // ตารางที่มีช่องรวมไม่ใส่แถบสลับสี — ลายจะขัดกับขอบเขตของกลุ่ม
                <tr key={ri} className={hasMerge ? '' : 'even:bg-brand-soft/50'}>
                  {columns.map((c) => {
                    // ช่องที่ถูกรวมเข้ากับแถวบน ไม่ต้องวาดซ้ำ
                    const span = spanOf(rows, ri, c);
                    if (span === 0) return null;

                    const v = r[c.key] ?? null;

                    if (c.kind === 'months') {
                      return (
                        <td key={c.key} rowSpan={span} className="border border-line px-[0.4cqw] align-middle">
                          <MonthBar range={Array.isArray(v) ? v : null} />
                        </td>
                      );
                    }

                    const numeric = typeof v === 'number';
                    return (
                      <td
                        key={c.key}
                        rowSpan={span}
                        className={`border border-line px-[0.6cqw] ${hasMerge ? 'py-[0.15cqw]' : 'py-[0.4cqw]'} leading-tight ${
                          numeric ? 'text-right tabular-nums' : 'text-left'
                        } ${span > 1 ? 'align-middle' : ''}`}
                      >
                        {/* null = ยังไม่กรอก แสดงว่าง · ไม่ยุบรวมกับ "ไม่มีรายการ" */}
                        {v === null
                          ? ''
                          : numeric && c.unit
                            ? formatNumber(v, UNITS[c.unit].decimals)
                            : String(v)}
                      </td>
                    );
                  })}
                </tr>
              ))}
            </tbody>
          </table>

          {rows.length === 0 && (
            <p className="mt-[1.5cqw] rounded-[0.5cqw] border border-dashed border-line px-[1.2cqw] py-[1.5cqw] text-center text-[1.4cqw] text-ink-soft">
              โครงตารางพร้อมแล้ว · ยังไม่ได้กรอกข้อมูล (mode: {block.mode})
            </p>
          )}
        </div>
      </div>

      <SlideFooter
        left={`${section.number} ${section.title}`}
        right={`${meta.monthLabel} ${meta.year}`}
      />
    </Slide>
  );
}
