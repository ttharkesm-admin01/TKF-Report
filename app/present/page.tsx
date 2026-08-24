'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { TitleSlide } from '@/components/slide/TitleSlide';
import { SlideRenderer } from '@/components/slide/SlideRenderer';
import { meta, slides } from '@/lib/deck';

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

  return (
    <main className="flex min-h-screen flex-col bg-neutral-900">
      <div className="flex flex-1 items-center justify-center p-4">
        {/* กว้างสุดเท่าที่ยังเห็นเต็ม 16:9 ในจอ */}
        <div className="w-full max-w-[min(100vw-2rem,calc((100vh-6rem)*16/9))]">
          {current ? <SlideRenderer slide={current} /> : <TitleSlide meta={meta} />}
        </div>
      </div>

      <nav className="flex items-center justify-between gap-4 bg-neutral-800 px-5 py-3 text-sm text-neutral-300">
        <Link href="/" className="hover:text-white">
          ← สารบัญ
        </Link>

        <span className="truncate">
          {current ? `${current.section.number} ${current.section.title}` : 'ปกเล่ม'}
        </span>

        <span className="flex items-center gap-3">
          <button onClick={() => go(-1)} disabled={index === 0} className="px-2 disabled:opacity-30">
            ◀
          </button>
          <span className="tabular-nums">
            {index + 1} / {total}
          </span>
          <button
            onClick={() => go(1)}
            disabled={index === total - 1}
            className="px-2 disabled:opacity-30"
          >
            ▶
          </button>
        </span>
      </nav>
    </main>
  );
}
