'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { meta } from '@/lib/deck';

/**
 * แถบเมนูบนสุดของทุกหน้าที่ไม่ใช่เวทีสไลด์
 *
 * ของเดิมแต่ละหน้ามีแค่ลิงก์ "← สารบัญ" เดี่ยว ๆ จะข้ามจาก /edit ไป /arrange
 * ต้องเด้งกลับหน้าแรกก่อนเสมอ · เมนูเดียวกันทุกหน้าทำให้รู้ตลอดว่าอยู่ตรงไหน
 * และไปที่อื่นได้ในคลิกเดียว (หลักการ "visibility of system status" + "user control")
 */

const LINKS = [
  { href: '/', label: 'หน้าแรก' },
  { href: '/edit', label: 'กรอกตัวเลข' },
  { href: '/arrange', label: 'ลงรูป' },
  { href: '/structure', label: 'แก้โครงสร้าง' },
  { href: '/deck', label: 'ทั้งเล่ม' },
  { href: '/present', label: 'นำเสนอ' },
] as const;

export function SiteNav() {
  const path = usePathname();

  return (
    <nav className="no-print sticky top-0 z-40 border-b border-line bg-paper">
      {/* ความสูงคงที่ h-12 · แถบเครื่องมือของหน้า /edit ยึด top-12 ตามนี้
          ถ้าปล่อยให้ตัดบรรทัดได้ ความสูงจะเปลี่ยนตามความกว้างจอ แล้วเกิดช่องโหว่คั่นสองแถบ */}
      <div className="mx-auto flex h-12 max-w-7xl items-center gap-1 overflow-x-auto whitespace-nowrap px-4">
        <span className="mr-3 shrink-0 text-sm font-semibold text-brand-deep">
          รายงาน {meta.monthLabel} {meta.year}
        </span>

        {LINKS.map((l) => {
          const active = l.href === '/' ? path === '/' : path.startsWith(l.href);
          return (
            <Link
              key={l.href}
              href={l.href}
              aria-current={active ? 'page' : undefined}
              className={`shrink-0 rounded px-3 py-1.5 text-sm ${
                active
                  ? 'bg-brand text-white font-semibold'
                  : 'text-ink-soft hover:bg-brand-soft hover:text-brand-deep'
              }`}
            >
              {l.label}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}
