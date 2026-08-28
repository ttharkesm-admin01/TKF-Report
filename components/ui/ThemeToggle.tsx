'use client';

import { useEffect, useState } from 'react';
import { IconMonitor, IconMoon, IconSun } from '@/components/ui/icons';

/**
 * สลับโหมดสว่าง–มืด · สามค่า: ตามเครื่อง / สว่าง / มืด
 *
 * ค่าที่เลือกเก็บใน localStorage แล้วสคริปต์เล็ก ๆ ใน `layout.tsx` ทาให้ตั้งแต่ก่อนวาดหน้า
 * (ไม่งั้นเปิดหน้ามาจะเห็นขาวแวบหนึ่งก่อนเปลี่ยนเป็นมืด)
 *
 * สไลด์ไม่เปลี่ยนตามโหมด — สไลด์คือหน้ากระดาษที่ต้องพิมพ์ออก PDF ได้เหมือนเดิม
 */

export const THEME_KEY = 'tkf-theme';

type Mode = 'system' | 'light' | 'dark';

const NEXT: Record<Mode, Mode> = { system: 'light', light: 'dark', dark: 'system' };
const LABEL: Record<Mode, string> = { system: 'ตามเครื่อง', light: 'สว่าง', dark: 'มืด' };

function apply(mode: Mode) {
  const el = document.documentElement;
  if (mode === 'system') el.removeAttribute('data-theme');
  else el.setAttribute('data-theme', mode);
}

export function ThemeToggle() {
  // เริ่มที่ 'system' เสมอ ค่าจริงอ่านหลัง hydrate — ไม่งั้นเซิร์ฟเวอร์กับเบราว์เซอร์วาดไม่ตรงกัน
  const [mode, setMode] = useState<Mode>('system');

  useEffect(() => {
    try {
      const saved = localStorage.getItem(THEME_KEY);
      if (saved === 'light' || saved === 'dark') setMode(saved);
    } catch {
      /* เบราว์เซอร์ปิด storage อยู่ — ใช้ค่าตามเครื่องไป */
    }
  }, []);

  const change = () => {
    const next = NEXT[mode];
    setMode(next);
    apply(next);
    try {
      if (next === 'system') localStorage.removeItem(THEME_KEY);
      else localStorage.setItem(THEME_KEY, next);
    } catch {
      /* ไม่ได้เก็บก็ยังใช้ได้ในหน้านี้ */
    }
  };

  const Icon = mode === 'dark' ? IconMoon : mode === 'light' ? IconSun : IconMonitor;

  return (
    <button
      type="button"
      onClick={change}
      title={`โหมดสี: ${LABEL[mode]} (กดเพื่อเปลี่ยนเป็น ${LABEL[NEXT[mode]]})`}
      aria-label={`โหมดสี: ${LABEL[mode]} · กดเพื่อเปลี่ยนเป็น ${LABEL[NEXT[mode]]}`}
      className="btn btn-quiet h-8 w-8 px-0"
    >
      <Icon />
    </button>
  );
}
