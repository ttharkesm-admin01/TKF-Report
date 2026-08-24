import { Slide, SlideFooter } from './Slide';
import type { DeckSection, DeckMeta } from '@/lib/deck';

/**
 * ปกคั่นหัวข้อ — สร้างอัตโนมัติ 100% ไม่มีใครต้องกรอกอะไร
 * เลขหัวข้อรับมาจาก lib/deck.ts ซึ่งสร้างจากลำดับใน sections.json
 */
export function CoverSlide({
  section,
  meta,
  blockId,
}: {
  section: DeckSection;
  meta: DeckMeta;
  blockId: string;
}) {
  return (
    <Slide id={blockId}>
      <div className="flex h-full flex-col justify-center bg-brand-soft pl-[10cqw] pr-[6cqw]">
        {/* แถบเขียวซ้าย */}
        <div className="absolute inset-y-0 left-0 w-[3.5cqw] bg-brand" />

        <p className="text-[1.9cqw] font-light tracking-wide text-brand-deep">
          {meta.department}. {meta.departmentTitle}
        </p>

        <div className="mt-[2.5cqw] flex items-baseline gap-[3cqw]">
          <span className="text-[9cqw] leading-none font-bold text-brand">{section.number}</span>
          <h1 className="text-[4.4cqw] leading-tight font-semibold text-ink">{section.title}</h1>
        </div>

        <div className="mt-[3cqw] h-[0.3cqw] w-[22cqw] bg-accent" />

        <p className="mt-[2.5cqw] text-[2cqw] text-ink-soft">{meta.site}</p>
      </div>

      <SlideFooter
        left={`${meta.site} · ${meta.company}`}
        right={`ประจำเดือน ${meta.monthLabel} ${meta.year}`}
      />
    </Slide>
  );
}
