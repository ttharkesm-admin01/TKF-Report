'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { TitleSlide } from '@/components/slide/TitleSlide';
import { SlideRenderer } from '@/components/slide/SlideRenderer';
import { meta, slides } from '@/lib/deck';
import { IconExpand, IconHome, IconLeft, IconRight } from '@/components/ui/icons';

/** โหมดนำเสนอ — ทีละหน้า เลื่อนด้วยลูกศร / Space / PageUp-PageDown */
export default function PresentPage() {
  // หน้า 0 คือปกเล่ม จากนั้นเป็นสไลด์ตาม config
  const total = slides.length + 1;
  const [index, setIndex] = useState(0);

  const go = useCallback(
    (delta: number) => setIndex((i) => Math.min(total - 1, Math.max(0, i + delta))),
    [total],
  );

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowRight':
        case 'ArrowDown':
        case 'PageDown':
        case ' ':
          e.preventDefault();
          go(1);
          break;
        case 'ArrowLeft':
        case 'ArrowUp':
        case 'PageUp':
          e.preventDefault();
          go(-1);
          break;
        case 'Home':
          e.preventDefault();
          setIndex(0);
          break;
        case 'End':
          e.preventDefault();
          setIndex(total - 1);
          break;
        case 'f':
          if (document.fullscreenElement) void document.exitFullscreen();
          else void document.documentElement.requestFullscreen();
          break;
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [go, total]);

  const current = index === 0 ? null : slides[index - 1];

  const toggleFullscreen = () => {
    if (document.fullscreenElement) void document.exitFullscreen();
    else void document.documentElement.requestFullscreen();
  };

  return (
    <main className="flex min-h-screen flex-col bg-neutral-950">
      {/* หลอดบอกว่าอยู่หน้าที่เท่าไรของทั้งเล่ม — เห็นจากท้ายห้องประชุมได้ */}
      <div
        className="h-1 bg-white/10"
        role="progressbar"
        aria-valuenow={index + 1}
        aria-valuemin={1}
        aria-valuemax={total}
      >
        <div
          className="h-full bg-brand transition-all"
          style={{ width: `${((index + 1) / total) * 100}%` }}
        />
      </div>

      <div className="flex flex-1 items-center justify-center p-4">
        {/* กว้างสุดเท่าที่ยังเห็นเต็ม 16:9 ในจอ */}
        <div className="w-full max-w-[min(100vw-2rem,calc((100vh-6rem)*16/9))]">
          {current ? <SlideRenderer slide={current} /> : <TitleSlide meta={meta} />}
        </div>
      </div>

      <nav className="flex items-center justify-between gap-3 border-t border-white/10 bg-neutral-900 px-3 py-2.5 text-sm text-neutral-300 sm:px-5">
        <Link
          href="/"
          className="flex h-9 shrink-0 items-center gap-1.5 rounded-lg px-2 transition hover:bg-white/10 hover:text-white"
        >
          <IconHome className="h-4 w-4" />
          <span className="hidden sm:inline">สารบัญ</span>
        </Link>

        <span className="min-w-0 flex-1 truncate text-center">
          {current ? `${current.section.number} ${current.section.title}` : 'ปกเล่ม'}
        </span>

        <span className="flex shrink-0 items-center gap-1">
          <button
            onClick={toggleFullscreen}
            aria-label="เต็มจอ (กด f ก็ได้)"
            title="เต็มจอ (f)"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg transition hover:bg-white/10 hover:text-white"
          >
            <IconExpand className="h-4 w-4" />
          </button>
          <button
            onClick={() => go(-1)}
            disabled={index === 0}
            aria-label="หน้าก่อน"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <IconLeft className="h-4 w-4" />
          </button>
          <span className="px-1 tabular-nums" aria-live="polite">
            {index + 1} / {total}
          </span>
          <button
            onClick={() => go(1)}
            disabled={index === total - 1}
            aria-label="หน้าถัดไป"
            className="grid h-9 w-9 cursor-pointer place-items-center rounded-lg transition hover:bg-white/10 hover:text-white disabled:opacity-30 disabled:hover:bg-transparent"
          >
            <IconRight className="h-4 w-4" />
          </button>
        </span>
      </nav>
    </main>
  );
}
