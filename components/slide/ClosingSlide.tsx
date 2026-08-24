import { Slide } from './Slide';
import type { DeckMeta } from '@/lib/deck';

/** ปิดท้าย — สร้างอัตโนมัติเช่นกัน */
export function ClosingSlide({ meta, blockId }: { meta: DeckMeta; blockId: string }) {
  return (
    <Slide id={blockId}>
      <div className="flex h-full flex-col items-center justify-center bg-brand text-center text-white">
        <p className="text-[6cqw] font-bold">ขอบคุณครับ / ค่ะ</p>
        <div className="mt-[3cqw] h-[0.3cqw] w-[18cqw] bg-accent" />
        <p className="mt-[3cqw] text-[2.2cqw] font-light">
          รายงานประจำเดือน {meta.monthLabel} {meta.year}
        </p>
        <p className="mt-[1cqw] text-[1.8cqw] font-light opacity-90">
          {meta.department}. {meta.departmentTitle} · {meta.site}
        </p>
        <p className="mt-[4cqw] text-[1.6cqw] font-light opacity-80">{meta.owner}</p>
      </div>
    </Slide>
  );
}
