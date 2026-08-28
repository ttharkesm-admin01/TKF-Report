import { Slide, SlideFooter } from './Slide';
import { parseBody, fitBody } from '@/lib/text';
import type { TextBlock } from '@/shared/schema';
import type { DeckMeta, DeckSection } from '@/lib/deck';

/**
 * ข้อความล้วน — สรุป ข้อเสนอ ข้อสังเกตท้ายหัวข้อ
 *
 * เป็นชนิดเดียวที่เนื้อหาไม่ได้มาจากตารางหรือรูป ผู้ใช้พิมพ์เองที่หน้า `/edit`
 * ตัวอักษรหดตามความยาวเพื่อไม่ให้ล้นกรอบ (ดู `bodyScale`)
 */
export function TextSlide({
  section,
  block,
  title,
  meta,
}: {
  section: DeckSection;
  block: TextBlock;
  title: string;
  meta: DeckMeta;
}) {
  const parts = parseBody(block.body ?? '');
  const fit = fitBody(parts);

  return (
    <Slide id={block.id}>
      <div className="flex h-full flex-col px-[5cqw] pt-[4cqw] pb-[7cqw]">
        <header className="flex items-baseline gap-[1.5cqw] border-b-[0.25cqw] border-brand pb-[1.5cqw]">
          <span className="text-[2.6cqw] font-bold text-brand">{section.number}</span>
          <h2 className="text-[2.4cqw] font-semibold text-ink">{title}</h2>
        </header>

        {parts.length > 0 ? (
          <div
            className="mt-[2.5cqw] flex min-h-0 flex-1 flex-col overflow-hidden"
            // ย่อจนเล็กสุดแล้วยังไม่พอ — ติดป้ายไว้ให้ตัวตรวจกับคนไล่ปัญหาเห็นว่ารู้ตัว
            data-body-overflow={fit.overflow ? 'true' : undefined}
            style={{ fontSize: fit.size, gap: '1.2cqw' }}
          >
            {parts.map((p, i) =>
              p.kind === 'para' ? (
                <p key={i} className="shrink-0 leading-[1.6] text-ink">
                  {p.text}
                </p>
              ) : (
                <ul key={i} className="flex shrink-0 flex-col gap-[0.6cqw]">
                  {p.items.map((item, j) => (
                    <li key={j} className="flex gap-[1cqw] leading-[1.6] text-ink">
                      <span className="shrink-0 text-brand">•</span>
                      <span className="min-w-0">{item}</span>
                    </li>
                  ))}
                </ul>
              ),
            )}
          </div>
        ) : (
          <div className="mt-[2.5cqw] flex min-h-0 flex-1 flex-col items-center justify-center rounded-[1cqw] border-[0.3cqw] border-dashed border-line text-center">
            <p className="text-[2.2cqw] font-semibold text-ink-soft">ยังไม่ได้พิมพ์ข้อความ</p>
            <p className="mt-[1cqw] text-[1.5cqw] text-ink-soft">
              พิมพ์ได้ที่หน้า <span className="font-mono">/edit</span> ท้ายหน้า
            </p>
          </div>
        )}
      </div>

      <SlideFooter
        left={`${section.number} ${section.title}`}
        right={`${meta.monthLabel} ${meta.year}`}
      />
    </Slide>
  );
}
