'use client';

import { IconPrint } from '@/components/ui/icons';

/** ปุ่มพิมพ์ · ทางออก PDF ของทั้งเล่ม — ตั้งขนาดหน้ากระดาษไว้แล้วใน globals.css */
export function PrintButton() {
  return (
    <button onClick={() => window.print()} className="btn btn-primary">
      <IconPrint className="h-4 w-4" />
      พิมพ์ / บันทึกเป็น PDF
    </button>
  );
}
