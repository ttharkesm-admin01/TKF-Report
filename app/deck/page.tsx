import { SiteNav } from '@/components/nav/SiteNav';
import { TitleSlide } from '@/components/slide/TitleSlide';
import { SlideRenderer } from '@/components/slide/SlideRenderer';
import { meta, sections, slides } from '@/lib/deck';
import { PrintButton } from '@/components/deck/PrintButton';
import { DeckJump } from '@/components/deck/DeckJump';

/**
 * ทั้งเล่มเรียงต่อกัน — หน้านี้คือทางออก PDF
 * กด Ctrl+P แล้วเลือก "แนวนอน" + "กราฟิกพื้นหลัง" ได้ไฟล์หน้าตาตรงกับที่นำเสนอ
 */
export default function DeckPage() {
  // หัวข้อที่มีบล็อกจริงเท่านั้นถึงจะมี anchor ให้กระโดดไป
  const jumps = sections
    .filter((s) => s.blocks.length > 0)
    .map((s) => ({ key: s.key, number: s.number, title: s.title, anchor: s.blocks[0].id }));

  return (
    <>
      <SiteNav />
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 print:max-w-none print:p-0">
      {/* ติดบนสุดใต้เมนู — เลื่อนดูถึงหน้าที่ 50 แล้วยังกดพิมพ์หรือกระโดดหัวข้อได้ทันที */}
      <div className="no-print sticky top-12 z-30 mb-6 flex flex-wrap items-center justify-between gap-3 rounded-xl2 border border-edge bg-surface p-3">
        <p className="text-sm text-muted">
          <b className="text-fg tabular-nums">{slides.length + 1}</b> หน้า · พิมพ์แล้วเลือก
          แนวนอน → เปิด &ldquo;กราฟิกพื้นหลัง&rdquo;
        </p>
        <DeckJump sections={jumps} />
        <PrintButton />
      </div>

      {/* เงาใต้สไลด์มีเฉพาะบนจอ · @media print ถอดให้เองใน globals.css */}
      <div className="flex flex-col gap-8 print:gap-0">
        <TitleSlide meta={meta} />
        {slides.map((s) => (
          <SlideRenderer key={s.page} slide={s} />
        ))}
      </div>
      </main>
    </>
  );
}
