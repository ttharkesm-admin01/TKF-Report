'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { meta } from '@/lib/deck';
import { ThemeToggle } from '@/components/ui/ThemeToggle';
import {
  IconBook,
  IconHome,
  IconImage,
  IconLayers,
  IconPlay,
  IconTable,
} from '@/components/ui/icons';

/**
 * แถบเมนูบนสุดของทุกหน้าที่ไม่ใช่เวทีสไลด์
 *
 * ของเดิมแต่ละหน้ามีแค่ลิงก์ "← สารบัญ" เดี่ยว ๆ จะข้ามจาก /edit ไป /arrange
 * ต้องเด้งกลับหน้าแรกก่อนเสมอ · เมนูเดียวกันทุกหน้าทำให้รู้ตลอดว่าอยู่ตรงไหน
 * และไปที่อื่นได้ในคลิกเดียว (หลักการ "visibility of system status" + "user control")
 */

const LINKS = [
  { href: '/', label: 'หน้าแรก', Icon: IconHome },
  { href: '/edit', label: 'กรอกตัวเลข', Icon: IconTable },
  { href: '/arrange', label: 'ลงรูป', Icon: IconImage },
  { href: '/structure', label: 'แก้โครงสร้าง', Icon: IconLayers },
  { href: '/deck', label: 'ทั้งเล่ม', Icon: IconBook },
  { href: '/present', label: 'นำเสนอ', Icon: IconPlay },
] as const;

export function SiteNav() {
  const path = usePathname();

  return (
    <>
      {/* ข้ามเมนูไปเนื้อหาเลย — คนที่ใช้แป้นพิมพ์อย่างเดียวไม่ต้องกด Tab ผ่านลิงก์ทุกอัน */}
      <a
        href="#main"
        className="no-print sr-only focus:not-sr-only focus:absolute focus:top-2 focus:left-2 focus:z-50 focus:rounded-lg focus:bg-primary focus:px-3 focus:py-2 focus:text-sm focus:font-semibold focus:text-on-primary"
      >
        ข้ามไปที่เนื้อหา
      </a>

      <nav className="no-print sticky top-0 z-40 border-b border-edge bg-surface">
        {/* ความสูงคงที่ h-12 · แถบเครื่องมือของหน้า /edit ยึด top-12 ตามนี้
            ถ้าปล่อยให้ตัดบรรทัดได้ ความสูงจะเปลี่ยนตามความกว้างจอ แล้วเกิดช่องโหว่คั่นสองแถบ
            พื้นต้องทึบด้วย โปร่งแสงแล้วเนื้อหาข้างหลังทะลุขึ้นมา */}
        <div className="mx-auto flex h-12 max-w-7xl items-center gap-2 px-3 sm:px-4">
          <Link
            href="/"
            className="hidden shrink-0 items-center gap-2 rounded-lg px-1 py-1 sm:flex"
            aria-label={`รายงานประจำเดือน ${meta.monthLabel} ${meta.year}`}
          >
            <span className="grid h-6 w-6 place-items-center rounded-md bg-primary text-[11px] font-bold text-on-primary">
              {meta.department}
            </span>
            <span className="text-sm font-semibold tracking-tight">
              {meta.monthLabel} {meta.year}
            </span>
          </Link>

          <div className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto whitespace-nowrap">
            {LINKS.map(({ href, label, Icon }) => {
              const active = href === '/' ? path === '/' : path.startsWith(href);
              return (
                <Link
                  key={href}
                  href={href}
                  aria-current={active ? 'page' : undefined}
                  className={`flex h-8 shrink-0 items-center gap-1.5 rounded-lg px-2.5 text-sm transition sm:px-3 ${
                    active
                      ? 'bg-primary font-semibold text-on-primary'
                      : 'text-muted hover:bg-surface-2 hover:text-fg'
                  }`}
                >
                  <Icon className="h-4 w-4 shrink-0" />
                  {label}
                </Link>
              );
            })}
          </div>

          <ThemeToggle />
        </div>
      </nav>
    </>
  );
}
