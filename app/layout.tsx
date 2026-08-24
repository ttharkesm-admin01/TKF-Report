import type { Metadata } from 'next';
import { Sarabun } from 'next/font/google';
import { meta } from '@/lib/deck';
import './globals.css';

/**
 * ฟอนต์เดียวทั้งระบบ · next/font ดาวน์โหลดตอน build แล้วเสิร์ฟจากโดเมนตัวเอง
 * เครื่องผู้ใช้จึงไม่ต้องต่อ Google ตอนเปิดดู — สำคัญกับเครื่องบริษัทที่อาจถูกบล็อก
 */
const sarabun = Sarabun({
  subsets: ['thai', 'latin'],
  weight: ['300', '400', '600', '700'],
  variable: '--font-sarabun',
  display: 'swap',
});

export const metadata: Metadata = {
  title: `รายงานประจำเดือน ${meta.monthLabel} ${meta.year} · ${meta.departmentTitle}`,
  description: `${meta.site} · ${meta.company}`,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={sarabun.variable}>
      <body>{children}</body>
    </html>
  );
}
