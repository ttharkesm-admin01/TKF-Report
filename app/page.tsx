import Link from 'next/link';
import { meta, sections, slides, blockCounts, BLOCK_LABEL, isImplemented } from '@/lib/deck';
import { countFilled, countRows, entrySections, monthIndex, monthsBehind } from '@/lib/entry';
import { allPhotosOf } from '@/lib/photos';
import { MONTHS_SHORT } from '@/shared/schema';
import { SiteNav } from '@/components/nav/SiteNav';

/**
 * หน้าแรก — เริ่มจาก "รอบนี้เหลือทำอะไร" ไม่ใช่สารบัญ
 *
 * ของเดิมหน้าแรกเปิดมาเป็นสารบัญกับตารางความคืบหน้าของ *โค้ด* ซึ่งเป็นเรื่องของคนทำระบบ
 * ไม่ใช่ของคนทำรายงาน · คนทำรายงานเปิดเว็บมาเพื่อตอบคำถามเดียว "ต้องทำอะไรต่อ"
 * จึงเอาการ์ดงานขึ้นก่อน แล้วดันสถานะของโค้ดลงไปอยู่ในส่วนที่พับเก็บไว้
 */

/** งานหลักของรอบหนึ่ง ๆ เรียงตามลำดับที่คนทำจริงทำ */
function TaskCard({
  href,
  title,
  detail,
  status,
  tone,
}: {
  href: '/edit' | '/arrange' | '/deck' | '/present';
  title: string;
  detail: string;
  status: string;
  tone: 'todo' | 'done';
}) {
  return (
    <Link
      href={href}
      className="flex flex-col rounded-lg border border-line bg-paper p-4 transition hover:border-brand hover:shadow-sm"
    >
      <span className="text-base font-semibold text-brand-deep">{title}</span>
      <span className="mt-1 flex-1 text-sm text-ink-soft">{detail}</span>
      <span
        className={`mt-3 self-start rounded px-2 py-1 text-xs font-medium ${
          tone === 'done' ? 'bg-brand-soft text-brand-deep' : 'bg-amber-100 text-amber-800'
        }`}
      >
        {status}
      </span>
    </Link>
  );
}

export default function Home() {
  const counts = blockCounts();
  const done = slides.filter((s) => isImplemented(s.block)).length;

  /* ---------- สถานะของรอบนี้ ---------- */
  const totalRows = countRows(entrySections);
  const filled = countFilled(entrySections, monthIndex);
  const behind = monthsBehind(entrySections);

  const photoBlocks = sections.flatMap((s) =>
    s.blocks.filter((b) => b.type === 'photo-grid' || b.type === 'photo-set' || b.type === 'scan'),
  );
  const photoCount = photoBlocks.reduce((n, b) => n + allPhotosOf(b.id).length, 0);

  return (
    <>
      <SiteNav />

      <main className="mx-auto max-w-5xl px-6 py-8">
        <p className="text-sm text-ink-soft">{meta.company}</p>
        <h1 className="mt-1 text-3xl font-bold text-brand-deep">{meta.site}</h1>
        <p className="mt-2 text-lg">
          รายงานผลการปฏิบัติงาน {meta.department}. {meta.departmentTitle} · ประจำเดือน{' '}
          <b>
            {meta.monthLabel} {meta.year}
          </b>
          {meta.status === 'draft' && (
            <span className="ml-2 rounded bg-accent px-2 py-0.5 align-middle text-xs font-semibold text-ink">
              ฉบับร่าง
            </span>
          )}
        </p>

        {/* ---------- รอบนี้เหลือทำอะไร ---------- */}
        <h2 className="mt-8 text-xl font-semibold">รอบนี้เหลือทำอะไร</h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TaskCard
            href="/edit"
            title="1 · กรอกตัวเลข"
            detail={`ตาราง 12 เดือนทุกอันรวมอยู่หน้าเดียว กรอกย้อนเดือนก่อน ๆ ได้ด้วย${
              behind.length ? ` · ยังค้าง ${behind.map((m) => MONTHS_SHORT[m]).join(' ')}` : ''
            }`}
            status={`${meta.monthLabel} กรอกแล้ว ${filled}/${totalRows} ช่อง`}
            tone={filled >= totalRows ? 'done' : 'todo'}
          />
          <TaskCard
            href="/arrange"
            title="2 · ลงรูป"
            detail="ลากรูปใส่ทีละบล็อก จัดลำดับ ซ่อนรูปที่ไม่เอา ใส่คำบรรยาย"
            status={photoCount ? `มีรูปแล้ว ${photoCount} ใบ` : 'ยังไม่มีรูปสักใบ'}
            tone={photoCount ? 'done' : 'todo'}
          />
          <TaskCard
            href="/deck"
            title="3 · ตรวจทั้งเล่ม"
            detail={`เลื่อนดูครบทุกหน้าก่อนนำเสนอ · สั่งพิมพ์เป็น PDF จากหน้านี้ได้เลย`}
            status={`${slides.length + 1} หน้า`}
            tone="done"
          />
          <TaskCard
            href="/present"
            title="4 · นำเสนอ"
            detail="เต็มจอ กดลูกศรเปลี่ยนหน้า ใช้ตอนประชุมจริง"
            status="พร้อมใช้"
            tone="done"
          />
        </div>

        <p className="mt-3 text-sm text-ink-soft">
          ต้องเพิ่ม/ลบตาราง เปลี่ยนชื่อหัวข้อ หรือสลับลำดับ ทำได้เองที่{' '}
          <Link href="/structure" className="text-brand underline">
            แก้โครงสร้าง
          </Link>{' '}
          — ทุกหน้าส่งเข้าระบบจากเบราว์เซอร์ได้เลย ไม่ต้องติดตั้งอะไร
        </p>

        {/* ---------- สารบัญ ---------- */}
        <h2 className="mt-10 border-b border-line pb-2 text-xl font-semibold">สารบัญ</h2>

        <ol className="mt-3 divide-y divide-line">
          {sections.map((s) => (
            <li key={s.key} className="flex items-baseline gap-3 py-2.5">
              <span className="w-14 shrink-0 font-mono font-semibold text-brand">{s.number}</span>
              <Link
                href={{ pathname: '/deck', hash: s.blocks[0]?.id }}
                className="flex-1 hover:underline"
              >
                {s.title}
              </Link>
              <span className="shrink-0 text-sm text-ink-soft">{s.blocks.length} บล็อก</span>
            </li>
          ))}
        </ol>

        <p className="mt-3 text-xs text-ink-soft">
          เลขหัวข้อสร้างจากลำดับใน <code className="font-mono">config/sections.json</code>{' '}
          ทุกครั้งที่เปิดหน้า — สลับลำดับแล้วเลขขยับตามเองทั้งเล่ม
        </p>

        {/* ---------- สถานะของระบบ: เรื่องของคนทำระบบ พับเก็บไว้ ---------- */}
        <details className="mt-10 rounded-lg border border-line bg-paper p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            สถานะของระบบ — {done} จาก {slides.length} บล็อกเรนเดอร์ได้จริงแล้ว
          </summary>

          <table className="mt-3 w-full text-sm">
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
        </details>
      </main>
    </>
  );
}
