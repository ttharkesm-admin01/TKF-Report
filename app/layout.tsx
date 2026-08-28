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

/**
 * ทาโหมดสีตั้งแต่ก่อนวาดหน้า — ถ้ารอ React จะเห็นจอขาวแวบหนึ่งก่อนเปลี่ยนเป็นมืด
 * ไม่ได้เลือกไว้ = ปล่อยตามค่าของเครื่อง (prefers-color-scheme)
 */
const THEME_SCRIPT = `try{var t=localStorage.getItem('tkf-theme');if(t==='dark'||t==='light')document.documentElement.setAttribute('data-theme',t)}catch(e){}`;

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="th" className={sarabun.variable} suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: THEME_SCRIPT }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
