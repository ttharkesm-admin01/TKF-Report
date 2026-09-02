import { Slide, SlideFooter } from './Slide';
import { buildMatrixView, buildTrendFacts, summarySentence, formatNumber } from '@/lib/matrix';
import {
  availableForTable,
  fitMatrix,
  noteHeight,
  summaryHeight,
  type FitColumn,
} from '@/lib/fitMatrix';
import { UNITS, formatCell } from '@/shared/schema';
import type { MatrixBlock } from '@/shared/schema';
import type { DeckMeta, DeckSection, SlidePart } from '@/lib/deck';

/** ระยะเว้นซ้าย+ขวาในช่อง หน่วย cqw — ต้องตรงกับคลาส `px-[…]` ข้างล่าง */
const PAD_LABEL = 1.6;
const PAD_UNIT = 0.8;
const PAD_MONTH = 0.6;
const PAD_AGG = 1.0;

/**
 * ตาราง 12 เดือน — ตารางจริง ไม่ใช่รูป หัวหน้าจึงลากคลุมคัดลอกได้ (PROJECT.md กฎข้อ 2)
 *
 * ความกว้างคอลัมน์และขนาดตัวอักษรมาจาก `lib/fitMatrix.ts` ไม่ได้ปล่อยให้เบราว์เซอร์
 * เกลี่ยเอง · เหตุผลอยู่ในหัวไฟล์นั้น (ปล่อยแล้วคอลัมน์ฉลากถูกบีบจนตารางล้นสไลด์)
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

  const latestCol = v.months.indexOf(v.latest);
  const showTotal = v.rowTotals.some((t) => t !== null);
  const showTotalRow = Boolean(block.showTotalRow && onLastPart && v.columnTotals);

  /* ---------- ข้อความทุกช่อง เตรียมไว้ก่อนหนึ่งชุด ----------
     ใช้ทั้งวัดขนาดและเรนเดอร์จากชุดเดียวกัน ถ้าแยกกันเขียนสองที่แล้ววันหนึ่ง
     แก้ที่เดียว ตัววัดจะวัดข้อความที่ไม่มีอยู่จริง แล้วตารางล้นเงียบ ๆ อีกรอบ */
  const cellText = v.rows.map((r) => v.months.map((m) => formatCell(r.values[m], r.unit)));

  const totalText = v.rows.map((r, ri) =>
    v.rowTotals[ri] === null
      ? v.rowAllNone[ri]
        ? '-'
        : ''
      : formatNumber(v.rowTotals[ri]!, UNITS[r.unit].decimals),
  );

  const avgText = v.rows.map((r, ri) =>
    v.rowAverages[ri] === null ? '' : formatNumber(v.rowAverages[ri]!, UNITS[r.unit].decimals),
  );

  const rateText = v.rows.map((r) =>
    typeof r.rate === 'number' ? formatNumber(r.rate, UNITS.rate.decimals) : '-',
  );

  const colTotalText =
    showTotalRow && v.columnTotals
      ? v.columnTotals.map((t) =>
          t === null ? '' : formatNumber(t, UNITS[v.sharedUnit!].decimals),
        )
      : v.months.map(() => '');

  const grandText =
    showTotalRow && v.grandTotal !== null
      ? formatNumber(v.grandTotal, UNITS[v.sharedUnit!].decimals)
      : '';

  const summary = onLastPart && facts && v.sharedUnit ? summarySentence(facts, v.sharedUnit) : '';

  /* ---------- ขนาดที่ใส่ลงสไลด์ได้จริง ---------- */

  const tailCqw =
    (summary ? summaryHeight(`สรุป · ${summary}`) : 0) +
    v.notes.reduce((a, n) => a + noteHeight(`* ${n.label} — ${n.note}`), 0);

  const columns: FitColumn[] = [
    { texts: ['รายการ', ...v.rows.map((r) => r.label)], padCqw: PAD_LABEL },
    { texts: ['หน่วย', ...v.rows.map((r) => UNITS[r.unit].label)], padCqw: PAD_UNIT },
    ...v.months.map((_, mi) => ({
      texts: [v.monthLabels[mi], ...cellText.map((row) => row[mi]), colTotalText[mi]],
      padCqw: PAD_MONTH,
    })),
    ...(showTotal ? [{ texts: ['รวม', ...totalText, grandText], padCqw: PAD_AGG }] : []),
    ...(v.showAverage ? [{ texts: ['เฉลี่ย', ...avgText], padCqw: PAD_AGG }] : []),
    ...(v.showRate ? [{ texts: ['ราคา/หน่วย', ...rateText], padCqw: PAD_AGG }] : []),
  ];

  const fit = fitMatrix({
    columns,
    labels: v.rows.map((r) => r.label),
    totalRow: showTotalRow,
    availCqw: availableForTable(tailCqw),
  });

  const fontCqw = fit.fontCqw;

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
            className="w-full table-fixed border-collapse tabular-nums"
            style={{ fontSize: `${fontCqw}cqw` }}
          >
            {/* ล็อกความกว้างเอง — ปล่อยให้เบราว์เซอร์เกลี่ยแล้วคอลัมน์ฉลากโดนบีบ
                จนฉลากไทยตัดคำละบรรทัด แถวสูงพรวดและตารางล้นออกนอกสไลด์ */}
            <colgroup>
              {fit.widthsPct.map((w, i) => (
                <col key={i} style={{ width: `${w.toFixed(3)}%` }} />
              ))}
            </colgroup>

            <thead>
              <tr className="bg-brand text-white">
                <th className="border border-line px-[0.8cqw] py-[0.5cqw] text-left font-semibold">
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
                      {cellText[ri][i]}
                    </td>
                  ))}

                  {showTotal && (
                    <td className="border border-line px-[0.5cqw] py-[0.35cqw] text-right font-semibold">
                      {totalText[ri]}
                    </td>
                  )}
                  {v.showAverage && (
                    <td className="border border-line px-[0.5cqw] py-[0.35cqw] text-right">
                      {avgText[ri]}
                    </td>
                  )}
                  {v.showRate && (
                    <td className="border border-line px-[0.5cqw] py-[0.35cqw] text-right">
                      {rateText[ri]}
                    </td>
                  )}
                </tr>
              ))}

              {showTotalRow && (
                <tr className="bg-brand-deep font-semibold text-white">
                  <td className="border border-line px-[0.8cqw] py-[0.4cqw] text-left" colSpan={2}>
                    {/* ตารางที่หั่นหลายหน้า: ยอดนี้เป็นของทั้งตาราง ไม่ใช่แค่แถวบนหน้านี้ */}
                    {part && part.total > 1 ? 'รวมทั้งตาราง' : 'รวม'}
                  </td>
                  {colTotalText.map((t, i) => (
                    <td key={i} className="border border-line px-[0.3cqw] py-[0.4cqw] text-right">
                      {t}
                    </td>
                  ))}
                  {showTotal && (
                    <td className="border border-line px-[0.5cqw] py-[0.4cqw] text-right">
                      {grandText}
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
          {summary && (
            <p className="mt-[1cqw] text-[1.35cqw] leading-snug text-ink">
              <span className="font-semibold text-brand">สรุป · </span>
              {summary}
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
