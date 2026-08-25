'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { allPhotosOf, expectedFolder } from '@/lib/photos';
import { photoBlocks } from '@/lib/photoBlocks';

interface Item {
  file: string;
  src: string;
  caption: string;
  hidden: boolean;
}

const storageKey = (blockId: string) => `arrange:${blockId}`;

/** ไฟล์ที่จะเอาไปวางในโฟลเดอร์รูป */
function toArrangeFile(items: Item[]) {
  const captions: Record<string, string> = {};
  for (const i of items) if (i.caption.trim()) captions[i.file] = i.caption.trim();
  return {
    order: items.map((i) => i.file),
    hidden: items.filter((i) => i.hidden).map((i) => i.file),
    captions,
  };
}

export default function ArrangePage() {
  const [blockId, setBlockId] = useState(photoBlocks[0]?.id ?? '');
  const [items, setItems] = useState<Item[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [saved, setSaved] = useState('');

  const block = useMemo(() => photoBlocks.find((b) => b.id === blockId), [blockId]);

  // โหลดรูปของบล็อก แล้วทับด้วยงานที่ค้างไว้ในเบราว์เซอร์ (ถ้ามี)
  useEffect(() => {
    if (!blockId) return;
    const base: Item[] = allPhotosOf(blockId).map((p) => ({
      file: p.file,
      src: p.src,
      caption: p.caption ?? '',
      hidden: Boolean(p.hidden),
    }));

    let draft: ReturnType<typeof toArrangeFile> | null = null;
    try {
      const raw = localStorage.getItem(storageKey(blockId));
      if (raw) draft = JSON.parse(raw);
    } catch {
      draft = null;
    }

    if (!draft) {
      setItems(base);
      return;
    }

    const byFile = new Map(base.map((i) => [i.file, i]));
    const ordered = draft.order.map((f) => byFile.get(f)).filter((i): i is Item => Boolean(i));
    const rest = base.filter((i) => !draft!.order.includes(i.file));
    const hidden = new Set(draft.hidden);
    setItems(
      [...ordered, ...rest].map((i) => ({
        ...i,
        hidden: hidden.has(i.file),
        caption: draft!.captions[i.file] ?? i.caption,
      })),
    );
  }, [blockId]);

  // เก็บงานที่ทำค้างไว้ ปิดหน้าไปแล้วกลับมาต่อได้
  useEffect(() => {
    if (!blockId || !items.length) return;
    try {
      localStorage.setItem(storageKey(blockId), JSON.stringify(toArrangeFile(items)));
    } catch {
      /* เบราว์เซอร์ปิด storage อยู่ — ไม่เป็นไร แค่ไม่ได้เก็บงานค้าง */
    }
  }, [blockId, items]);

  const move = (from: number, to: number) =>
    setItems((prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });

  const patch = (i: number, p: Partial<Item>) =>
    setItems((prev) => prev.map((it, k) => (k === i ? { ...it, ...p } : it)));

  const download = () => {
    const blob = new Blob([JSON.stringify(toArrangeFile(items), null, 2) + '\n'], {
      type: 'application/json',
    });
    const a = document.createElement('a');
    a.href = URL.createObjectURL(blob);
    a.download = 'arrange.json';
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const copy = async () => {
    await navigator.clipboard.writeText(JSON.stringify(toArrangeFile(items), null, 2));
    setSaved('คัดลอกแล้ว');
    setTimeout(() => setSaved(''), 2000);
  };

  const resetToFilename = () => {
    setItems((prev) =>
      [...prev].sort((a, b) => a.file.localeCompare(b.file, 'en', { numeric: true })),
    );
  };

  const shown = items.filter((i) => !i.hidden).length;

  // เลขที่โชว์ต้องตรงกับเลขบนสไลด์จริง — รูปที่ซ่อนไม่กินเลข
  const slideNumbers = (() => {
    let n = 0;
    return items.map((i) => (i.hidden ? null : ++n));
  })();

  return (
    <main className="mx-auto max-w-6xl px-6 py-10">
      <Link href="/" className="text-brand hover:underline">
        ← สารบัญ
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-brand-deep">จัดรูป</h1>
      <p className="mt-2 text-sm text-ink-soft">
        ลากสลับตำแหน่ง ซ่อนรูปที่ไม่เอา พิมพ์คำบรรยาย แล้วกดบันทึกไฟล์
        <br />
        ปกติไม่ต้องมาหน้านี้เลย — ระบบเรียงตามชื่อไฟล์ให้อยู่แล้ว ใช้เมื่ออยากสลับบางรูปเท่านั้น
      </p>

      {/* ---------- เลือกบล็อก ---------- */}
      <label className="mt-6 block text-sm font-medium">
        บล็อกรูป
        <select
          value={blockId}
          onChange={(e) => setBlockId(e.target.value)}
          className="mt-1 block w-full rounded border border-line bg-white px-3 py-2 text-base"
        >
          {photoBlocks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.sectionNumber} · {b.title} ({b.id})
            </option>
          ))}
        </select>
      </label>

      {items.length === 0 ? (
        <div className="mt-8 rounded border border-dashed border-line px-6 py-10 text-center text-ink-soft">
          <p className="text-lg font-semibold">ยังไม่มีรูปในบล็อกนี้</p>
          <p className="mt-2 text-sm">
            วางไฟล์ที่ <span className="font-mono">{blockId && expectedFolder(blockId)}</span>{' '}
            แล้วสั่ง <span className="font-mono">npm run photos</span>
          </p>
        </div>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3">
            <button
              onClick={download}
              className="rounded bg-brand px-4 py-2 font-semibold text-white hover:bg-brand-deep"
            >
              บันทึกไฟล์ arrange.json
            </button>
            <button
              onClick={copy}
              className="rounded border border-brand px-4 py-2 font-semibold text-brand hover:bg-brand-soft"
            >
              คัดลอก JSON
            </button>
            <button
              onClick={resetToFilename}
              className="rounded border border-line px-4 py-2 text-ink-soft hover:bg-neutral-50"
            >
              เรียงตามชื่อไฟล์ใหม่
            </button>
            <span className="text-sm text-ink-soft">
              {shown} รูปขึ้นสไลด์
              {items.length - shown > 0 && ` · ซ่อน ${items.length - shown}`}
              {saved && <span className="ml-2 font-medium text-brand">{saved}</span>}
            </span>
          </div>

          <p className="mt-3 rounded bg-brand-soft px-4 py-3 text-sm">
            เอาไฟล์ที่ได้ไปวางที่{' '}
            <span className="font-mono">{expectedFolder(blockId)}arrange.json</span> แล้วสั่ง{' '}
            <span className="font-mono">npm run photos</span>
          </p>

          <ol
            className="mt-6 grid gap-3"
            style={{ gridTemplateColumns: `repeat(${block?.cols ?? 5}, minmax(0, 1fr))` }}
          >
            {items.map((it, i) => (
              <li
                key={it.file}
                draggable
                onDragStart={() => setDragFrom(i)}
                onDragOver={(e) => e.preventDefault()}
                onDrop={() => {
                  if (dragFrom !== null) move(dragFrom, i);
                  setDragFrom(null);
                }}
                className={`cursor-grab rounded border p-2 active:cursor-grabbing ${
                  it.hidden ? 'border-dashed border-line bg-neutral-50 opacity-50' : 'border-line'
                }`}
              >
                <div className="relative overflow-hidden rounded bg-neutral-100">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.src} alt={it.file} className="aspect-[4/3] w-full object-cover" />
                  <span className="absolute top-0 left-0 bg-black/60 px-1.5 text-xs text-white">
                    {slideNumbers[i] ?? '—'}
                  </span>
                </div>

                <p className="mt-1 truncate font-mono text-[11px] text-ink-soft" title={it.file}>
                  {it.file}
                </p>

                <div className="mt-1 flex items-center gap-1">
                  <button
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    className="rounded border border-line px-2 text-sm disabled:opacity-30"
                    aria-label="เลื่อนไปข้างหน้า"
                  >
                    ◀
                  </button>
                  <button
                    onClick={() => move(i, i + 1)}
                    disabled={i === items.length - 1}
                    className="rounded border border-line px-2 text-sm disabled:opacity-30"
                    aria-label="เลื่อนไปข้างหลัง"
                  >
                    ▶
                  </button>
                  <button
                    onClick={() => patch(i, { hidden: !it.hidden })}
                    className="ml-auto rounded border border-line px-2 text-xs"
                  >
                    {it.hidden ? 'เอากลับ' : 'ซ่อน'}
                  </button>
                </div>

                <input
                  value={it.caption}
                  onChange={(e) => patch(i, { caption: e.target.value })}
                  placeholder="คำบรรยาย"
                  className="mt-1 w-full rounded border border-line px-1.5 py-1 text-xs"
                />
              </li>
            ))}
          </ol>
        </>
      )}
    </main>
  );
}
