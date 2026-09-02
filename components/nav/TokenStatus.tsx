'use client';

import { useToken } from '@/lib/useToken';
import { IconCheck, IconKey } from '@/components/ui/icons';

/**
 * ป้ายบอกว่าเบราว์เซอร์นี้ต่อกับรีโปแล้วหรือยัง
 *
 * โทเคนเป็นประตูบานเดียวของทั้งเว็บ — ไม่มีโทเคนแปลว่า `/edit` เห็นค่าเก่าตอน build
 * `/structure` เปิดไม่ได้เลย และกดส่งไม่ได้สักหน้า · แต่ของเดิมไม่มีอะไรบอกสถานะนี้เลย
 * ต้องเลื่อนไปสุดหน้าถึงจะรู้ว่าเคยใส่ไว้หรือยัง
 *
 * กดแล้วพาไปที่ช่องโทเคนท้ายหน้าและโฟกัสให้เลย ไม่ต้องเลื่อนหาเอง
 */
export function TokenStatus() {
  const token = useToken();
  const ok = token.trim() !== '';

  return (
    <button
      onClick={() => {
        const el = document.getElementById('token-input');
        if (!el) return;
        el.scrollIntoView({ block: 'center' });
        el.focus({ preventScroll: true });
      }}
      title={ok ? 'ต่อกับรีโปแล้ว — กดเพื่อไปที่ช่องโทเคน' : 'ยังไม่ได้ใส่โทเคน — กดเพื่อไปที่ช่องโทเคน'}
      className={`chip h-8 shrink-0 cursor-pointer px-2 transition ${
        ok ? 'chip-brand' : 'chip-warn'
      }`}
    >
      {ok ? <IconCheck className="h-3.5 w-3.5" /> : <IconKey className="h-3.5 w-3.5" />}
      {/* จอแคบเหลือแค่ไอคอน — แถบเมนูสูง h-12 คงที่ ห้ามให้ตัดบรรทัด */}
      <span className="hidden sm:inline">{ok ? 'ต่อกับรีโปแล้ว' : 'ยังไม่ใส่โทเคน'}</span>
    </button>
  );
}
