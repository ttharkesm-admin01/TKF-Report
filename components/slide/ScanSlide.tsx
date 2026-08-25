import { Slide, SlideFooter } from './Slide';
import { Zoomable } from '../Zoomable';
import { PhotoEmpty } from './PhotoEmpty';
import { photosOf } from '@/lib/photos';
import type { ScanBlock } from '@/shared/schema';
import type { DeckMeta, DeckSection } from '@/lib/deck';

/** ภาพเดียวเต็มหน้า — ฟอร์มสแกน ผังพื้นที่ ภาพแคปจากระบบอื่น */
export function ScanSlide({
  section,
  block,
  title,
  meta,
}: {
  section: DeckSection;
  block: ScanBlock;
  title: string;
  meta: DeckMeta;
}) {
  // ใช้รูปล่าสุดของบล็อกนี้ในรอบนี้ (เรียงตามชื่อไฟล์ ตัวท้ายคือใหม่สุด)
  const list = photosOf(block.id);
  const photo = list.length ? list[list.length - 1] : null;

  return (
    <Slide id={block.id}>
      <div className="flex h-full flex-col px-[3.5cqw] pt-[3cqw] pb-[6cqw]">
        <header className="flex items-baseline gap-[1.2cqw] border-b-[0.25cqw] border-brand pb-[1.2cqw]">
          <span className="text-[2.2cqw] font-bold text-brand">{section.number}</span>
          <h2 className="text-[2cqw] font-semibold">{title}</h2>
        </header>

        {photo ? (
          <div className="mt-[1.5cqw] flex min-h-0 flex-1 items-center justify-center">
            <Zoomable
              src={photo.src}
              alt={title}
              className="max-h-full max-w-full cursor-zoom-in object-contain"
            />
          </div>
        ) : (
          <div className="mt-[1.5cqw] flex min-h-0 flex-1 flex-col">
            <PhotoEmpty blockId={block.id} />
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
