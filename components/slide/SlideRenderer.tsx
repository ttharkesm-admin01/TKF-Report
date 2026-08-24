import { CoverSlide } from './CoverSlide';
import { ClosingSlide } from './ClosingSlide';
import { MatrixSlide } from './MatrixSlide';
import { ChartSlide } from './ChartSlide';
import { PendingSlide } from './PendingSlide';
import { asChart, asMatrix } from '@/lib/matrix';
import { meta, type DeckSlide } from '@/lib/deck';

/**
 * เลือกตัวเรนเดอร์ตามชนิดบล็อก
 * เพิ่มชนิดใหม่ = เพิ่ม case ที่นี่ + ใส่ชื่อชนิดลงใน IMPLEMENTED ที่ lib/deck.ts
 */
export function SlideRenderer({ slide }: { slide: DeckSlide }) {
  const { section, block, part } = slide;

  switch (block.type) {
    case 'cover':
      return <CoverSlide section={section} meta={meta} blockId={block.id} />;
    case 'closing':
      return <ClosingSlide meta={meta} blockId={block.id} />;
    case 'monthly-matrix':
      return (
        <MatrixSlide
          section={section}
          block={asMatrix(block)}
          title={block.title}
          meta={meta}
          part={part}
        />
      );
    case 'chart':
      return (
        <ChartSlide section={section} block={asChart(block)} title={block.title} meta={meta} />
      );
    default:
      return <PendingSlide section={section} block={block} meta={meta} />;
  }
}
