import Link from 'next/link';
import { meta, sections, slides, blockCounts, BLOCK_LABEL, isImplemented } from '@/lib/deck';
import { countFilled, countRows, entrySections, monthIndex, monthsBehind } from '@/lib/entry';
import { allPhotosOf } from '@/lib/photos';
import { MONTHS_SHORT } from '@/shared/schema';
import { SiteNav } from '@/components/nav/SiteNav';
import {
  IconBook,
  IconCheck,
  IconImage,
  IconPlay,
  IconRight,
  IconTable,
} from '@/components/ui/icons';

/**
 * หน้าแรก — เริ่มจาก "รอบนี้เหลือทำอะไร" ไม่ใช่สารบัญ
 *
 * ของเดิมหน้าแรกเปิดมาเป็นสารบัญกับตารางความคืบหน้าของ *โค้ด* ซึ่งเป็นเรื่องของคนทำระบบ
 * ไม่ใช่ของคนทำรายงาน · คนทำรายงานเปิดเว็บมาเพื่อตอบคำถามเดียว "ต้องทำอะไรต่อ"
 * จึงเอาการ์ดงานขึ้นก่อน แล้วดันสถานะของโค้ดลงไปอยู่ในส่วนที่พับเก็บไว้
 */

/** หลอดความคืบหน้า · บอกสถานะด้วยตัวเลขกำกับเสมอ ไม่ได้บอกด้วยสีอย่างเดียว */
function Meter({ value, total }: { value: number; total: number }) {
  const pct = total > 0 ? Math.round((value / total) * 100) : 0;
  return (
    <div
      className="h-1.5 w-full overflow-hidden rounded-full bg-surface-3"
      role="progressbar"
      aria-valuenow={pct}
      aria-valuemin={0}
      aria-valuemax={100}
      aria-label={`ความคืบหน้า ${pct}%`}
    >
      <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
    </div>
  );
}

/** งานหลักของรอบหนึ่ง ๆ เรียงตามลำดับที่คนทำจริงทำ */
function TaskCard({
  href,
  step,
  title,
  detail,
  status,
  tone,
  Icon,
  meter,
}: {
  href: '/edit' | '/arrange' | '/deck' | '/present';
  step: number;
  title: string;
  detail: string;
  status: string;
  tone: 'todo' | 'done';
  Icon: (p: { className?: string }) => React.ReactElement;
  meter?: { value: number; total: number };
}) {
  return (
    <Link
      href={href}
      className="card group flex flex-col p-4 transition hover:-translate-y-0.5 hover:border-edge-strong hover:shadow-card"
    >
      <div className="flex items-center gap-2">
        <span className="grid h-8 w-8 place-items-center rounded-lg bg-primary-soft text-primary-ink">
          <Icon className="h-4 w-4" />
        </span>
        <span className="text-xs font-medium text-muted tabular-nums">ขั้นที่ {step}</span>
        <IconRight className="ml-auto h-4 w-4 text-muted transition group-hover:translate-x-0.5 group-hover:text-fg" />
      </div>

      <span className="mt-3 text-base font-semibold">{title}</span>
      <span className="mt-1 flex-1 text-sm leading-relaxed text-muted">{detail}</span>

      {meter && (
        <span className="mt-3 block">
          <Meter value={meter.value} total={meter.total} />
        </span>
      )}

      <span className={`chip mt-3 self-start ${tone === 'done' ? 'chip-brand' : 'chip-warn'}`}>
        {tone === 'done' && <IconCheck className="h-3.5 w-3.5" />}
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

      <main id="main" className="mx-auto max-w-5xl px-4 py-8 sm:px-6">
        {/* ---------- หัวเรื่อง ---------- */}
        <header className="card-pad">
          <p className="text-xs font-medium tracking-wide text-muted uppercase">{meta.company}</p>
          <h1 className="mt-1 text-2xl font-bold tracking-tight sm:text-3xl">{meta.site}</h1>
          <p className="mt-2 text-base leading-relaxed text-muted">
            รายงานผลการปฏิบัติงาน {meta.department}. {meta.departmentTitle} · ประจำเดือน{' '}
            <b className="text-fg">
              {meta.monthLabel} {meta.year}
            </b>
            {meta.status === 'draft' && (
              <span className="chip chip-warn ml-2 align-middle">ฉบับร่าง</span>
            )}
          </p>

          <dl className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
            {[
              { k: 'หัวข้อ', v: sections.length },
              { k: 'บล็อก', v: slides.length },
              { k: 'หน้าเด็ค', v: slides.length + 1 },
              { k: 'รูปที่ลงแล้ว', v: photoCount },
            ].map(({ k, v }) => (
              <div key={k} className="rounded-lg bg-surface-2 px-3 py-2">
                <dt className="text-xs text-muted">{k}</dt>
                <dd className="text-xl font-semibold tabular-nums">{v}</dd>
              </div>
            ))}
          </dl>
        </header>

        {/* ---------- รอบนี้เหลือทำอะไร ---------- */}
        <h2 className="mt-8 text-lg font-semibold">รอบนี้เหลือทำอะไร</h2>

        <div className="mt-3 grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
          <TaskCard
            href="/edit"
            step={1}
            Icon={IconTable}
            title="กรอกตัวเลข"
            detail={`ตาราง 12 เดือนทุกอันรวมอยู่หน้าเดียว กรอกย้อนเดือนก่อน ๆ ได้ด้วย${
              behind.length ? ` · ยังค้าง ${behind.map((m) => MONTHS_SHORT[m]).join(' ')}` : ''
            }`}
            status={`${meta.monthLabel} กรอกแล้ว ${filled}/${totalRows} ช่อง`}
            tone={filled >= totalRows ? 'done' : 'todo'}
            meter={{ value: filled, total: totalRows }}
          />
          <TaskCard
            href="/arrange"
            step={2}
            Icon={IconImage}
            title="ลงรูป"
            detail="ลากรูปใส่ทีละบล็อก จัดลำดับ ซ่อนรูปที่ไม่เอา ใส่คำบรรยาย"
            status={photoCount ? `มีรูปแล้ว ${photoCount} ใบ` : 'ยังไม่มีรูปสักใบ'}
            tone={photoCount ? 'done' : 'todo'}
          />
          <TaskCard
            href="/deck"
            step={3}
            Icon={IconBook}
            title="ตรวจทั้งเล่ม"
            detail="เลื่อนดูครบทุกหน้าก่อนนำเสนอ · สั่งพิมพ์เป็น PDF จากหน้านี้ได้เลย"
            status={`${slides.length + 1} หน้า`}
            tone="done"
          />
          <TaskCard
            href="/present"
            step={4}
            Icon={IconPlay}
            title="นำเสนอ"
            detail="เต็มจอ กดลูกศรเปลี่ยนหน้า ใช้ตอนประชุมจริง"
            status="พร้อมใช้"
            tone="done"
          />
        </div>

        <p className="mt-3 text-sm leading-relaxed text-muted">
          ต้องเพิ่ม/ลบตาราง เปลี่ยนชื่อหัวข้อ หรือสลับลำดับ ทำได้เองที่{' '}
          <Link href="/structure" className="font-medium text-primary underline underline-offset-2">
            แก้โครงสร้าง
          </Link>{' '}
          — ทุกหน้าส่งเข้าระบบจากเบราว์เซอร์ได้เลย ไม่ต้องติดตั้งอะไร
        </p>

        {/* ---------- สารบัญ ---------- */}
        <h2 className="mt-10 text-lg font-semibold">สารบัญ</h2>

        <ol className="card mt-3 divide-y divide-edge">
          {sections.map((s) => (
            <li key={s.key}>
              <Link
                href={{ pathname: '/deck', hash: s.blocks[0]?.id }}
                className="group flex items-center gap-3 px-4 py-3 transition hover:bg-surface-2"
              >
                <span className="w-12 shrink-0 font-mono text-sm font-semibold text-primary tabular-nums">
                  {s.number}
                </span>
                <span className="min-w-0 flex-1 text-sm group-hover:underline">{s.title}</span>
                <span className="chip chip-neutral shrink-0">{s.blocks.length} บล็อก</span>
                <IconRight className="h-4 w-4 shrink-0 text-muted transition group-hover:translate-x-0.5 group-hover:text-fg" />
              </Link>
            </li>
          ))}
        </ol>

        <p className="mt-3 text-xs leading-relaxed text-muted">
          เลขหัวข้อสร้างจากลำดับใน <code className="font-mono">config/sections.json</code>{' '}
          ทุกครั้งที่เปิดหน้า — สลับลำดับแล้วเลขขยับตามเองทั้งเล่ม
        </p>

        {/* ---------- สถานะของระบบ: เรื่องของคนทำระบบ พับเก็บไว้ ---------- */}
        <details className="card mt-10 p-4">
          <summary className="cursor-pointer text-sm font-semibold">
            สถานะของระบบ — {done} จาก {slides.length} บล็อกเรนเดอร์ได้จริงแล้ว
          </summary>

          <div className="mt-3 overflow-x-auto">
            <table className="w-full min-w-[26rem] text-sm">
              <thead>
                <tr className="border-b border-edge text-left text-xs text-muted">
                  <th className="py-2 font-medium">ชนิดบล็อก</th>
                  <th className="py-2 font-medium">จำนวน</th>
                  <th className="py-2 font-medium">ขั้นที่</th>
                  <th className="py-2 font-medium">สถานะ</th>
                </tr>
              </thead>
              <tbody>
                {counts.map((c) => (
                  <tr key={c.type} className="border-b border-edge/60 last:border-0">
                    <td className="py-2">{BLOCK_LABEL[c.type]}</td>
                    <td className="py-2 tabular-nums">{c.count}</td>
                    <td className="py-2 tabular-nums">{c.step}</td>
                    <td className="py-2">
                      {c.done ? (
                        <span className="chip chip-brand">
                          <IconCheck className="h-3.5 w-3.5" />
                          ทำแล้ว
                        </span>
                      ) : (
                        <span className="chip chip-neutral">รอทำ</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </main>
    </>
  );
}
