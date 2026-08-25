import { Slide, SlideFooter } from './Slide';
import { Zoomable } from '../Zoomable';
import { PhotoEmpty } from './PhotoEmpty';
import { photosOf } from '@/lib/photos';
import type { PhotoSetBlock } from '@/shared/schema';
import type { DeckMeta, DeckSection, SlidePart } from '@/lib/deck';

/** จำนวนรูปกำหนดการจัดวาง — ไม่ต้องตั้งค่าเอง */
function columnsFor(count: number): number {
  if (count <= 1) return 1;
  if (count <= 2) return 2;
  if (count <= 4) return 2;
  if (count <= 6) return 3;
  return 4;
}

/** รูป 1–7 ใบพร้อมคำบรรยาย · จับคู่ก่อนทำ-หลังทำได้ */
export function PhotoSetSlide({
  section,
  block,
  title,
  meta,
  part,
}: {
  section: DeckSection;
  block: PhotoSetBlock;
  title: string;
  meta: DeckMeta;
  part?: SlidePart;
}) {
  const all = photosOf(block.id);
  const photos = part ? part.rowKeys.map((k) => all[Number(k)]).filter(Boolean) : all;

  // งานซ่อมบำรุงเรียงเป็นคู่ ก่อนทำ-หลังทำ จึงบังคับ 2 คอลัมน์ให้คู่อยู่บรรทัดเดียวกัน
  const cols = block.beforeAfter ? 2 : columnsFor(photos.length);

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

        {photos.length === 0 ? (
          <div className="mt-[1.5cqw] flex min-h-0 flex-1 flex-col">
            <PhotoEmpty blockId={block.id} />
          </div>
        ) : (
          <div
            className="mt-[1.5cqw] grid min-h-0 flex-1 gap-[1.2cqw]"
            style={{ gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))` }}
          >
            {photos.map((p, i) => (
              <figure key={p.file} className="flex min-h-0 flex-col">
                <div className="flex min-h-0 flex-1 items-center justify-center overflow-hidden rounded-[0.5cqw] bg-neutral-100">
                  <Zoomable
                    src={p.src}
                    alt={p.caption ?? `${title} รูปที่ ${i + 1}`}
                    className="max-h-full max-w-full cursor-zoom-in object-contain"
                  />
                </div>
                {block.captions && (
                  <figcaption className="mt-[0.4cqw] shrink-0 text-center text-[1.1cqw] leading-tight text-ink-soft">
                    {p.caption ?? ''}
                  </figcaption>
                )}
              </figure>
            ))}
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
