import type { ReactNode } from 'react';

/** กรอบสไลด์ 16:9 — ทุกสไลด์ต้องผ่านตัวนี้ ขนาดตัวหนังสือข้างในใช้หน่วย cqw */
export function Slide({ id, children }: { id?: string; children: ReactNode }) {
  return (
    // scroll-mt เผื่อความสูงของแถบเมนูที่ติดอยู่บนสุด — ลิงก์จากสารบัญจะได้ไม่ตกใต้แถบ
    <section id={id} className="slide scroll-mt-16 rounded-lg border border-line shadow-md print:rounded-none">
      {children}
    </section>
  );
}

/** แถบท้ายสไลด์ที่เหมือนกันทุกหน้า */
export function SlideFooter({ left, right }: { left: string; right: string }) {
  return (
    <div className="absolute inset-x-0 bottom-0 flex items-center justify-between border-t border-line px-[4cqw] py-[1.4cqw] text-[1.5cqw] text-ink-soft">
      <span>{left}</span>
      <span>{right}</span>
    </div>
  );
}
