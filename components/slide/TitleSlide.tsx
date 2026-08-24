import { Slide } from './Slide';
import type { DeckMeta } from '@/lib/deck';

/** ปกเล่ม — หน้าแรกสุด สร้างจาก config ทั้งหมด */
export function TitleSlide({ meta }: { meta: DeckMeta }) {
  return (
    <Slide id="title">
      <div className="flex h-full flex-col justify-center bg-brand-deep px-[8cqw] text-white">
        <p className="text-[2cqw] font-light opacity-85">{meta.company}</p>
        <h1 className="mt-[1.5cqw] text-[5.2cqw] leading-tight font-bold">{meta.site}</h1>

        <div className="mt-[3cqw] h-[0.35cqw] w-[26cqw] bg-accent" />

        <p className="mt-[3cqw] text-[3.4cqw] font-semibold">
          รายงานผลการปฏิบัติงาน {meta.department}. {meta.departmentTitle}
        </p>
        <p className="mt-[1.2cqw] text-[2.4cqw] font-light opacity-90">
          ประจำเดือน {meta.monthLabel} {meta.year}
        </p>

        <p className="mt-[5cqw] text-[1.7cqw] font-light opacity-80">{meta.owner}</p>
      </div>

      {meta.status !== 'done' && (
        <div className="no-print absolute top-[3cqw] right-[3cqw] rounded-full bg-accent px-[2cqw] py-[0.8cqw] text-[1.4cqw] font-semibold text-ink">
          ฉบับร่าง
        </div>
      )}
    </Slide>
  );
}
