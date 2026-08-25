'use client';

import { useEffect, useState } from 'react';

/**
 * รูปที่คลิกแล้วขยายเต็มจอ
 * ของเดิมทำไม่ได้เพราะเป็นภาพแคปหน้าจอที่แปะลงสไลด์ (PROJECT.md ข้อ 6)
 */
export function Zoomable({
  src,
  alt,
  className,
}: {
  src: string;
  alt: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);

  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.stopPropagation();
        setOpen(false);
      }
    };
    window.addEventListener('keydown', onKey, true);
    return () => window.removeEventListener('keydown', onKey, true);
  }, [open]);

  return (
    <>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={src}
        alt={alt}
        /* ห้ามใช้ loading="lazy" — หน้า /deck คือทางออก PDF
           รูปที่ยังไม่ถูกเลื่อนไปถึงจะไม่โหลด แล้วพิมพ์ออกมาเป็นช่องว่าง */
        loading="eager"
        decoding="sync"
        className={className}
        onClick={() => setOpen(true)}
      />
      {open && (
        <div
          className="no-print fixed inset-0 z-50 flex cursor-zoom-out items-center justify-center bg-black/85 p-6"
          onClick={() => setOpen(false)}
          role="dialog"
          aria-label={alt}
        >
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={src} alt={alt} className="max-h-full max-w-full object-contain" />
          <span className="absolute bottom-5 text-sm text-white/70">
            คลิกที่ไหนก็ได้ หรือกด Esc เพื่อปิด
          </span>
        </div>
      )}
    </>
  );
}
