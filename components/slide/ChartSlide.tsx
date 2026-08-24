import { Slide, SlideFooter } from './Slide';
import { buildChartView, formatNumber } from '@/lib/matrix';
import { UNITS, type ChartBlock } from '@/shared/schema';
import type { DeckMeta, DeckSection } from '@/lib/deck';

/* ---------- เรขาคณิตของกราฟ · หน่วยเดียวกับ viewBox ---------- */
const W = 1000;
const H = 430;
const PAD = { top: 24, right: 16, bottom: 48, left: 84 };
const PLOT_W = W - PAD.left - PAD.right;
const PLOT_H = H - PAD.top - PAD.bottom;

const BAR_MAX = 24; // แท่งบาง ๆ ไม่เต็มช่อง เหลือที่ให้หายใจ
const BAR_GAP = 2; // ช่องว่างสีพื้นระหว่างแท่ง แทนการตีเส้นขอบ
const RADIUS = 4; // มนเฉพาะปลายบน ฐานตัดตรงติดเส้นศูนย์

/** ไม้บรรทัดแกนตั้งที่ลงตัวสวย ๆ */
function niceTicks(max: number, count = 4): number[] {
  if (max <= 0) return [0];
  const raw = max / count;
  const mag = 10 ** Math.floor(Math.log10(raw));
  const step = [1, 2, 2.5, 5, 10].map((m) => m * mag).find((s) => s >= raw) ?? mag * 10;
  const top = Math.ceil(max / step) * step;
  return Array.from({ length: Math.round(top / step) + 1 }, (_, i) => i * step);
}

/** แท่งปลายบนมน ฐานเหลี่ยม */
function barPath(x: number, y: number, w: number, h: number): string {
  const r = Math.min(RADIUS, w / 2, h);
  const base = y + h;
  return `M${x},${base} L${x},${y + r} Q${x},${y} ${x + r},${y} L${x + w - r},${y} Q${x + w},${y} ${x + w},${y + r} L${x + w},${base} Z`;
}

/**
 * กราฟแท่งกลุ่ม — สร้างจาก monthly-matrix ตัวเดียวกัน ไม่มีการกรอกตัวเลขซ้ำ
 * ตัวเลขเต็มอยู่ในตารางต้นทางซึ่งวางไว้หน้าก่อนหน้าเสมอ จึงไม่ต้องติดป้ายทุกแท่ง
 */
export function ChartSlide({
  section,
  block,
  title,
  meta,
}: {
  section: DeckSection;
  block: ChartBlock;
  title: string;
  meta: DeckMeta;
}) {
  const v = buildChartView(block);

  if (!v) {
    return (
      <Slide id={block.id}>
        <div className="flex h-full items-center justify-center text-[1.8cqw] text-ink-soft">
          หาตารางต้นทาง &ldquo;{block.sourceBlockId}&rdquo; ไม่เจอ
        </div>
      </Slide>
    );
  }

  const ticks = niceTicks(v.max);
  const yMax = ticks[ticks.length - 1] || 1;
  const yOf = (val: number) => PAD.top + PLOT_H - (val / yMax) * PLOT_H;

  const groups = v.monthLabels.length;
  const groupW = PLOT_W / groups;
  const band = groupW * 0.78;
  const slot = band / v.series.length;
  const barW = Math.max(3, Math.min(BAR_MAX, slot - BAR_GAP));

  // ติดป้ายตัวเลขเฉพาะตอนที่แท่งไม่แน่น — ที่เหลือให้แกนกับตารางหน้าก่อนทำหน้าที่
  const labelEveryBar = groups * v.series.length <= 16;
  const decimals = UNITS[v.unitKey].decimals;

  return (
    <Slide id={block.id}>
      <div className="flex h-full flex-col px-[3.5cqw] pt-[3cqw] pb-[6cqw]">
        <header className="flex items-baseline gap-[1.2cqw] border-b-[0.25cqw] border-brand pb-[1.2cqw]">
          <span className="text-[2.2cqw] font-bold text-brand">{section.number}</span>
          <h2 className="text-[2cqw] font-semibold">{title}</h2>
        </header>

        {v.cards.length > 0 && (
          <div className="mt-[1.2cqw] flex gap-[1.2cqw]">
            {v.cards.map((c) => (
              <div key={c.label} className="rounded-[0.6cqw] bg-brand-soft px-[1.4cqw] py-[0.8cqw]">
                <p className="text-[1.1cqw] text-ink-soft">{c.label}</p>
                <p className="text-[1.8cqw] font-semibold text-brand-deep">{c.value}</p>
              </div>
            ))}
          </div>
        )}

        <div className="mt-[1cqw] min-h-0 flex-1">
          <svg viewBox={`0 0 ${W} ${H}`} className="h-full w-full" role="img"
               aria-label={`กราฟแท่ง ${title} หน่วย ${v.unitLabel} · ตัวเลขเต็มอยู่ในตาราง ${v.sourceTitle}`}>
            {/* เส้นกริดบาง ทึบ สีเหลื่อมพื้นนิดเดียว ไม่แย่งสายตาจากแท่ง */}
            {ticks.map((t) => (
              <g key={t}>
                <line
                  x1={PAD.left}
                  x2={W - PAD.right}
                  y1={yOf(t)}
                  y2={yOf(t)}
                  stroke="#e5e5e5"
                  strokeWidth={1}
                />
                <text
                  x={PAD.left - 8}
                  y={yOf(t) + 4}
                  textAnchor="end"
                  fontSize={13}
                  fill="#5c5c5c"
                  style={{ fontVariantNumeric: 'tabular-nums' }}
                >
                  {formatNumber(t, 0)}
                </text>
              </g>
            ))}

            <text x={PAD.left - 8} y={PAD.top - 9} textAnchor="end" fontSize={12} fill="#5c5c5c">
              {v.unitLabel}
            </text>

            {v.monthLabels.map((label, gi) => {
              const x0 = PAD.left + gi * groupW + (groupW - band) / 2;
              return (
                <g key={label}>
                  {v.series.map((s, si) => {
                    const val = s.values[gi];
                    if (val === null || val <= 0) return null;
                    const x = x0 + si * slot + (slot - barW) / 2;
                    const y = yOf(val);
                    const h = PAD.top + PLOT_H - y;
                    return (
                      <g key={s.key}>
                        <path d={barPath(x, y, barW, h)} fill={s.color} />
                        {labelEveryBar && (
                          <text
                            x={x + barW / 2}
                            y={y - 5}
                            textAnchor="middle"
                            fontSize={11}
                            fill="#1a1a1a"
                            style={{ fontVariantNumeric: 'tabular-nums' }}
                          >
                            {formatNumber(val, decimals)}
                          </text>
                        )}
                      </g>
                    );
                  })}
                  <text
                    x={PAD.left + gi * groupW + groupW / 2}
                    y={PAD.top + PLOT_H + 22}
                    textAnchor="middle"
                    fontSize={14}
                    fill="#1a1a1a"
                  >
                    {label}
                  </text>
                </g>
              );
            })}

            <line
              x1={PAD.left}
              x2={W - PAD.right}
              y1={PAD.top + PLOT_H}
              y2={PAD.top + PLOT_H}
              stroke="#d9d9d9"
              strokeWidth={1}
            />
          </svg>
        </div>

        {/* ป้ายชุดข้อมูลมีเสมอเมื่อมีตั้งแต่ 2 ชุด — สีอย่างเดียวบอกตัวตนไม่ได้ */}
        <div className="mt-[0.6cqw] flex shrink-0 flex-wrap items-center gap-x-[2cqw] gap-y-[0.4cqw]">
          {v.series.map((s) => (
            <span key={s.key} className="flex items-center gap-[0.6cqw] text-[1.25cqw]">
              <span
                className="inline-block h-[1cqw] w-[1cqw] rounded-[0.2cqw]"
                style={{ background: s.color }}
              />
              {s.label}
            </span>
          ))}
          <span className="ml-auto text-[1.05cqw] text-ink-soft">ตัวเลขเต็มอยู่ในตารางหน้าก่อน</span>
        </div>
      </div>

      <SlideFooter
        left={`${section.number} ${section.title}`}
        right={`${meta.monthLabel} ${meta.year}`}
      />
    </Slide>
  );
}
