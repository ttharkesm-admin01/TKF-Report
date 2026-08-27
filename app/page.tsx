import Link from 'next/link';
import { meta, sections, slides, blockCounts, BLOCK_LABEL, isImplemented } from '@/lib/deck';

/** หน้าแรก — สารบัญที่สร้างจาก config ทั้งหมด และสถานะว่าทำถึงไหนแล้ว */
export default function Home() {
  const counts = blockCounts();
  const done = slides.filter((s) => isImplemented(s.block)).length;

  return (
    <main className="mx-auto max-w-4xl px-6 py-12">
      <p className="text-sm text-ink-soft">{meta.company}</p>
      <h1 className="mt-1 text-3xl font-bold text-brand-deep">{meta.site}</h1>
      <p className="mt-2 text-lg">
        รายงานผลการปฏิบัติงาน {meta.department}. {meta.departmentTitle} ·{' '}
        ประจำเดือน {meta.monthLabel} {meta.year}
      </p>

      <div className="mt-6 flex gap-3">
        <Link
          href="/present"
          className="rounded bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-deep"
        >
          เริ่มนำเสนอ
        </Link>
        <Link
          href="/deck"
          className="rounded border border-brand px-5 py-2.5 font-semibold text-brand hover:bg-brand-soft"
        >
          ดูทั้งเล่ม / พิมพ์ PDF
        </Link>
        <Link
          href="/edit"
          className="rounded border border-line px-5 py-2.5 font-semibold text-ink-soft hover:bg-neutral-50"
        >
          กรอกตัวเลข
        </Link>
        <Link
          href="/arrange"
          className="rounded border border-line px-5 py-2.5 font-semibold text-ink-soft hover:bg-neutral-50"
        >
          ลงรูป
        </Link>
        <Link
          href="/structure"
          className="rounded border border-line px-5 py-2.5 font-semibold text-ink-soft hover:bg-neutral-50"
        >
          แก้โครงสร้าง
        </Link>
      </div>

      {/* ---------- สารบัญ ---------- */}
      <h2 className="mt-12 border-b border-line pb-2 text-xl font-semibold">สารบัญ</h2>
      <p className="mt-2 text-sm text-ink-soft">
        เลขหัวข้อสร้างจากลำดับใน <code className="font-mono">config/sections.json</code> ทุกครั้งที่เปิดหน้า
        — สลับลำดับในไฟล์แล้วเลขขยับตามเองทั้งเล่ม
      </p>

      <ol className="mt-4 divide-y divide-line">
        {sections.map((s) => (
          <li key={s.key} className="flex items-baseline gap-3 py-2.5">
            <span className="w-14 shrink-0 font-mono font-semibold text-brand">{s.number}</span>
            <Link href={{ pathname: '/deck', hash: s.blocks[0]?.id }} className="flex-1 hover:underline">
              {s.title}
            </Link>
            <span className="shrink-0 text-sm text-ink-soft">{s.blocks.length} บล็อก</span>
          </li>
        ))}
      </ol>

      {/* ---------- ความคืบหน้า ---------- */}
      <h2 className="mt-12 border-b border-line pb-2 text-xl font-semibold">ความคืบหน้า</h2>
      <p className="mt-2 text-sm text-ink-soft">
        {done} จาก {slides.length} บล็อกเรนเดอร์ได้จริงแล้ว ที่เหลือขึ้นเป็นช่องว่างที่บอกว่ารออยู่ขั้นไหน
      </p>

      <table className="mt-4 w-full text-sm">
        <thead>
          <tr className="border-b border-line text-left text-ink-soft">
            <th className="py-2 font-medium">ชนิดบล็อก</th>
            <th className="py-2 font-medium">จำนวน</th>
            <th className="py-2 font-medium">ขั้นที่</th>
            <th className="py-2 font-medium">สถานะ</th>
          </tr>
        </thead>
        <tbody>
          {counts.map((c) => (
            <tr key={c.type} className="border-b border-line/60">
              <td className="py-2">{BLOCK_LABEL[c.type]}</td>
              <td className="py-2 tabular-nums">{c.count}</td>
              <td className="py-2 tabular-nums">{c.step}</td>
              <td className="py-2">
                {c.done ? (
                  <span className="font-medium text-brand">ทำแล้ว</span>
                ) : (
                  <span className="text-ink-soft">รอทำ</span>
                )}
              </td>
            </tr>
          ))}
        </tbody>
      </table>
    </main>
  );
}
