import { Slide, SlideFooter } from './Slide';
import { Zoomable } from '../Zoomable';
import { PhotoEmpty } from './PhotoEmpty';
import { photoLabel, photosOf } from '@/lib/photos';
import type { PhotoGridBlock } from '@/shared/schema';
import type { DeckMeta, DeckSection, SlidePart } from '@/lib/deck';

/**
 * กริดรูปจำนวนมาก (งานสวน ตัดหญ้าทั้งโรงงาน)
 *
 * ของเดิม: โหลดรูปจากอัลบั้ม → รวมเป็น PDF → แคปหน้าจอ → ครอป → วางในสไลด์ → ใส่เลขมือ
 * ของใหม่: วางไฟล์ในโฟลเดอร์ → สั่ง npm run photos → จบ
 * เลขกำกับกับการขึ้นหน้าใหม่ระบบทำให้เอง
 */
export function PhotoGridSlide({
  section,
  block,
  title,
  meta,
  part,
}: {
  section: DeckSection;
  block: PhotoGridBlock;
  title: string;
  meta: DeckMeta;
  part?: SlidePart;
}) {
  const all = photosOf(block.id);
  const startIndex = part ? Number(part.rowKeys[0] ?? 0) : 0;
  const photos = part ? part.rowKeys.map((k) => all[Number(k)]).filter(Boolean) : all;

  const { cols, rows, framesPerSlide } = block.layout;
  const perFrame = cols * rows;

  // หั่นรูปของหน้านี้ออกเป็นกรอบย่อยตามที่ config กำหนด
  // กรอบที่ไม่มีรูปยังต้องกินที่เท่าเดิม ช่องรูปทุกหน้าจะได้ขนาดเท่ากัน
  const frames = Array.from({ length: framesPerSlide }, (_, f) =>
    photos.slice(f * perFrame, (f + 1) * perFrame),
  );

  return (
    <Slide id={part && part.index > 1 ? `${block.id}-${part.index}` : block.id}>
      <div className="flex h-full flex-col px-[3cqw] pt-[2.5cqw] pb-[6cqw]">
        <header className="flex items-baseline gap-[1.2cqw] border-b-[0.25cqw] border-brand pb-[1cqw]">
          <span className="text-[2.2cqw] font-bold text-brand">{section.number}</span>
          <h2 className="text-[1.9cqw] font-semibold">{title}</h2>
          {block.serviceDate && (
            <span className="text-[1.3cqw] text-ink-soft">· {block.serviceDate}</span>
          )}
          <span className="ml-auto text-[1.3cqw] text-ink-soft">
            {part && part.total > 1 ? `หน้า ${part.index}/${part.total} · ` : ''}
            {all.length} รูป
          </span>
        </header>

        {photos.length === 0 ? (
          <div className="mt-[1.5cqw] flex min-h-0 flex-1 flex-col">
            <PhotoEmpty blockId={block.id} />
          </div>
        ) : (
          <div className="mt-[1.2cqw] flex min-h-0 flex-1 gap-[1.2cqw]">
            {frames.map((frame, fi) => (
              <div
                key={fi}
                className="grid min-h-0 flex-1 gap-[0.35cqw]"
                style={{
                  // กำหนดทั้งหลักและแถวตายตัว ช่องจึงพอดีกรอบเสมอ
                  // ไม่พึ่ง aspect-ratio ซึ่งยืดจนล้นเมื่อจำนวนแถวเยอะ
                  gridTemplateColumns: `repeat(${cols}, minmax(0, 1fr))`,
                  gridTemplateRows: `repeat(${rows}, minmax(0, 1fr))`,
                }}
              >
                {frame.map((p, i) => {
                  const n = startIndex + fi * perFrame + i;
                  return (
                    <div
                      key={p.file}
                      className="relative min-h-0 overflow-hidden rounded-[0.2cqw] bg-neutral-100"
                    >
                      <Zoomable
                        src={p.src}
                        alt={`${title} ${photoLabel(block.round, n)}`}
                        className="h-full w-full cursor-zoom-in object-cover"
                      />
                      {/* เลขกำกับตามรอบและลำดับ — ระบบใส่ให้ ไม่ต้องพิมพ์เอง */}
                      <span className="absolute bottom-0 left-0 bg-black/55 px-[0.25cqw] text-[0.65cqw] leading-tight text-white">
                        {photoLabel(block.round, n)}
                      </span>
                    </div>
                  );
                })}
              </div>
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
