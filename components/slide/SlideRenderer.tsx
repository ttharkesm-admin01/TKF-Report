import { CoverSlide } from './CoverSlide';
import { ClosingSlide } from './ClosingSlide';
import { PendingSlide } from './PendingSlide';
import { meta, type DeckSlide } from '@/lib/deck';

/**
 * เลือกตัวเรนเดอร์ตามชนิดบล็อก
 * เพิ่มชนิดใหม่ = เพิ่ม case ที่นี่ + ถอดชื่อออกจาก IMPLEMENTED ใน lib/deck.ts
 */
export function SlideRenderer({ slide }: { slide: DeckSlide }) {
  const { section, block } = slide;

  switch (block.type) {
    case 'cover':
      return <CoverSlide section={section} meta={meta} blockId={block.id} />;
    case 'closing':
      return <ClosingSlide meta={meta} blockId={block.id} />;
    default:
      return <PendingSlide section={section} block={block} meta={meta} />;
  }
}
