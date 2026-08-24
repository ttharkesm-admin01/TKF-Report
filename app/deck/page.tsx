import Link from 'next/link';
import { TitleSlide } from '@/components/slide/TitleSlide';
import { SlideRenderer } from '@/components/slide/SlideRenderer';
import { meta, slides } from '@/lib/deck';

/**
 * ทั้งเล่มเรียงต่อกัน — หน้านี้คือทางออก PDF
 * กด Ctrl+P แล้วเลือก "แนวนอน" + "กราฟิกพื้นหลัง" ได้ไฟล์หน้าตาตรงกับที่นำเสนอ
 */
export default function DeckPage() {
  return (
    <main className="mx-auto max-w-6xl px-4 py-8 print:max-w-none print:p-0">
      <div className="no-print mb-6 flex items-center justify-between">
        <Link href="/" className="text-brand hover:underline">
          ← สารบัญ
        </Link>
        <p className="text-sm text-ink-soft">
          {slides.length + 1} หน้า · พิมพ์ด้วย Ctrl+P → แนวนอน → เปิด &ldquo;กราฟิกพื้นหลัง&rdquo;
        </p>
      </div>

      <div className="flex flex-col gap-8 print:gap-0">
        <TitleSlide meta={meta} />
        {slides.map((s) => (
          <SlideRenderer key={s.block.id} slide={s} />
        ))}
      </div>
    </main>
  );
}
