import { Slide, SlideFooter } from './Slide';
import { buildMatrixView, buildTrendFacts, summarySentence, formatNumber } from '@/lib/matrix';
import { UNITS, formatCell } from '@/shared/schema';
import type { MatrixBlock } from '@/shared/schema';
import type { DeckMeta, DeckSection, SlidePart } from '@/lib/deck';

/**
 * ตาราง 12 เดือน — ตารางจริง ไม่ใช่รูป หัวหน้าจึงลากคลุมคัดลอกได้ (PROJECT.md กฎข้อ 2)
 */
export function MatrixSlide({
  section,
  block,
  title,
  meta,
  part,
}: {
  section: DeckSection;
  block: MatrixBlock;
  title: string;
  meta: DeckMeta;
  part?: SlidePart;
}) {
  const v = buildMatrixView(block, part?.rowKeys);
  const facts = buildTrendFacts(block, v);

  // แถวรวมกับบรรทัดสรุปเป็นยอดของทั้งตาราง จึงขึ้นเฉพาะหน้าสุดท้าย
  const onLastPart = !part || part.isLast;

  // ตัวหนังสือย่อ-ขยายตามจำนวนแถว ตารางยาวจึงยังอยู่ในหน้าเดียวโดยไม่ล้น
  const rowCount = v.rows.length + (block.showTotalRow && onLastPart ? 1 : 0);
  // เผื่อฉลากภาษาไทยยาว ๆ กินสองบรรทัด (คิดที่ 1.6 บรรทัดต่อแถว)
  // และเผื่อที่ให้บรรทัดสรุปกับเชิงอรรถด้วย ไม่งั้นมันจะดันตารางตกขอบ
  const extraLines =
    (onLastPart ? 1.8 : 0) + (part && part.total > 1 ? 0 : 0) + v.notes.length * 1.5;
  const lineBudget = rowCount * 1.6 + 2 + extraLines;
  const fontCqw = Math.min(1.75, Math.max(1.05, (41.7 / lineBudget) * 0.62));

  const latestCol = v.months.indexOf(v.latest);
  const showTotal = v.rowTotals.some((t) => t !== null);

  return (
    <Slide id={part && part.index > 1 ? `${block.id}-${part.index}` : block.id}>
      <div className="flex h-full flex-col px-[3.5cqw] pt-[3cqw] pb-[6cqw]">
        <header className="flex items-baseline gap-[1.2cqw] border-b-[0.25cqw] border-brand pb-[1.2cqw]">
          <span className="text-[2.2cqw] font-bold text-brand">{section.number}</span>
          <h2 className="text-[2cqw] font-semibold">{title}</h2>
          {part && part.total > 1 && (
            <span className="ml-auto text-[1.4cqw] text-ink-soft">
              หน้า {part.index}/{part.total}
            </span>
          )}
        </header>

        {/* ตารางกินความสูงตามจริง · ที่ว่างที่เหลือตกอยู่ท้ายสไลด์
            บรรทัดสรุปจึงเกาะอยู่ใต้ตารางเสมอ ไม่ลอยไปติดขอบล่าง */}
        <div className="mt-[1.6cqw]">
          <table
            className="w-full border-collapse tabular-nums"
            style={{ fontSize: `${fontCqw}cqw` }}
          >
            <thead>
              <tr className="bg-brand text-white">
                <th className="w-[26%] border border-line px-[0.8cqw] py-[0.5cqw] text-left font-semibold">
                  รายการ
                </th>
                <th className="border border-line px-[0.4cqw] py-[0.5cqw] font-semibold">หน่วย</th>
                {v.monthLabels.map((m, i) => (
                  <th
                    key={m}
                    className="border border-line px-[0.3cqw] py-[0.5cqw] font-semibold"
                    style={
                      block.highlightLatest && i === latestCol
                        ? { background: '#c0392b' }
                        : undefined
                    }
                  >
                    {m}
                  </th>
                ))}
                {showTotal && (
                  <th className="border border-line px-[0.5cqw] py-[0.5cqw] font-semibold">รวม</th>
                )}
                {v.showAverage && (
                  <th className="border border-line px-[0.5cqw] py-[0.5cqw] font-semibold">เฉลี่ย</th>
                )}
                {v.showRate && (
                  <th className="border border-line px-[0.5cqw] py-[0.5cqw] font-semibold">
                    ราคา/หน่วย
                  </th>
                )}
              </tr>
            </thead>

            <tbody>
              {v.rows.map((r, ri) => (
                <tr key={r.key} className="even:bg-brand-soft/50">
                  <td className="border border-line px-[0.8cqw] py-[0.35cqw] text-left leading-tight">
                    {r.label}
                    {r.note && <sup className="ml-[0.3cqw] font-bold text-accent">*</sup>}
                  </td>
                  <td className="border border-line px-[0.4cqw] py-[0.35cqw] text-center text-ink-soft">
                    {UNITS[r.unit].label}
                  </td>

                  {v.months.map((m, i) => (
                    <td
                      key={m}
                      className="border border-line px-[0.3cqw] py-[0.35cqw] text-right"
                      style={
                        block.highlightLatest && i === latestCol
                          ? { outline: '0.18cqw solid #c0392b', outlineOffset: '-0.18cqw' }
                          : undefined
                      }
                    >
                      {formatCell(r.values[m], r.unit)}
                    </td>
                  ))}

                  {showTotal && (
                    <td className="border border-line px-[0.5cqw] py-[0.35cqw] text-right font-semibold">
                      {v.rowTotals[ri] === null
                        ? v.rowAllNone[ri]
                          ? '-'
                          : ''
                        : formatNumber(v.rowTotals[ri]!, UNITS[r.unit].decimals)}
                    </td>
                  )}
                  {v.showAverage && (
                    <td className="border border-line px-[0.5cqw] py-[0.35cqw] text-right">
                      {v.rowAverages[ri] === null
                        ? ''
                        : formatNumber(v.rowAverages[ri]!, UNITS[r.unit].decimals)}
                    </td>
                  )}
                  {v.showRate && (
                    <td className="border border-line px-[0.5cqw] py-[0.35cqw] text-right">
                      {typeof r.rate === 'number'
                        ? formatNumber(r.rate, UNITS.rate.decimals)
                        : '-'}
                    </td>
                  )}
                </tr>
              ))}

              {block.showTotalRow && onLastPart && v.columnTotals && (
                <tr className="bg-brand-deep font-semibold text-white">
                  <td className="border border-line px-[0.8cqw] py-[0.4cqw] text-left" colSpan={2}>
                    {/* ตารางที่หั่นหลายหน้า: ยอดนี้เป็นของทั้งตาราง ไม่ใช่แค่แถวบนหน้านี้ */}
                    {part && part.total > 1 ? 'รวมทั้งตาราง' : 'รวม'}
                  </td>
                  {v.columnTotals.map((t, i) => (
                    <td key={i} className="border border-line px-[0.3cqw] py-[0.4cqw] text-right">
                      {t === null ? '' : formatNumber(t, UNITS[v.sharedUnit!].decimals)}
                    </td>
                  ))}
                  {showTotal && (
                    <td className="border border-line px-[0.5cqw] py-[0.4cqw] text-right">
                      {v.grandTotal === null
                        ? ''
                        : formatNumber(v.grandTotal, UNITS[v.sharedUnit!].decimals)}
                    </td>
                  )}
                  {v.showAverage && <td className="border border-line" />}
                  {v.showRate && <td className="border border-line" />}
                </tr>
              )}
            </tbody>
          </table>
        </div>

        <div className="mt-[0.4cqw]">
          {/* บรรทัดสรุปคำนวณจากตารางทุกครั้งที่เรนเดอร์ จึงเก่าไม่ได้ */}
          {onLastPart && facts && v.sharedUnit && (
            <p className="mt-[1cqw] text-[1.35cqw] leading-snug text-ink">
              <span className="font-semibold text-brand">สรุป · </span>
              {summarySentence(facts, v.sharedUnit)}
            </p>
          )}

          {v.notes.map((n) => (
            <p key={n.label} className="mt-[0.5cqw] text-[1.1cqw] leading-snug text-ink-soft">
              <span className="font-bold text-accent">*</span> {n.label} — {n.note}
            </p>
          ))}
        </div>
      </div>

      <SlideFooter
        left={`${section.number} ${section.title}`}
        right={`${meta.monthLabel} ${meta.year}`}
      />
    </Slide>
  );
}
