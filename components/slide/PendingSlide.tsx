import { Slide, SlideFooter } from './Slide';
import { BLOCK_LABEL, type DeckBlock, type DeckMeta, type DeckSection } from '@/lib/deck';

/**
 * บล็อกที่ยังไม่ได้ทำ — ขึ้นเป็นช่องว่างที่บอกว่าคืออะไรและรออยู่ขั้นไหน
 * ทำแบบนี้เพื่อให้เปิดดูเด็คได้ครบทั้งเล่มตั้งแต่วันแรก และเห็นงานที่เหลือ
 * ไม่ใช่หน้าหายไปเฉย ๆ
 */
export function PendingSlide({
  section,
  block,
  meta,
}: {
  section: DeckSection;
  block: DeckBlock;
  meta: DeckMeta;
}) {
  return (
    <Slide id={block.id}>
      <div className="flex h-full flex-col px-[5cqw] pt-[4cqw] pb-[7cqw]">
        <header className="flex items-baseline gap-[1.5cqw] border-b-[0.25cqw] border-brand pb-[1.5cqw]">
          <span className="text-[2.6cqw] font-bold text-brand">{section.number}</span>
          <h2 className="text-[2.4cqw] font-semibold text-ink">{block.title}</h2>
        </header>

        <div className="mt-[3cqw] flex flex-1 flex-col items-center justify-center rounded-[1cqw] border-[0.3cqw] border-dashed border-line text-center">
          <p className="text-[2.4cqw] font-semibold text-ink-soft">{BLOCK_LABEL[block.type]}</p>
          <p className="mt-[1cqw] text-[1.6cqw] text-ink-soft">
            ยังไม่ได้ทำ · อยู่ในขั้นที่ {block.buildStep} ของ docs/PROJECT.md
          </p>
          <p className="mt-[2cqw] font-mono text-[1.3cqw] text-ink-soft opacity-70">
            {block.type} · {block.id} · mode: {block.mode}
          </p>
        </div>
      </div>

      <SlideFooter left={`${section.number} ${section.title}`} right={`${meta.monthLabel} ${meta.year}`} />
    </Slide>
  );
}
