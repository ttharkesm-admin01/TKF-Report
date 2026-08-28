'use client';

import { useEffect, useMemo, useState } from 'react';
import { SiteNav } from '@/components/nav/SiteNav';
import { allPhotosOf, expectedFolder } from '@/lib/photos';
import { photoBlocks } from '@/lib/photoBlocks';
import { humanSize, type Prepared } from '@/lib/resize';
import { readJsonFile, type CommitFile } from '@/lib/github';
import { PhotoDrop } from '@/components/arrange/PhotoDrop';
import { CommitPanel } from '@/components/arrange/CommitPanel';
import { IconEye, IconEyeOff, IconLeft, IconRight } from '@/components/ui/icons';

interface Item {
  file: string;
  src: string;
  caption: string;
  hidden: boolean;
  /** มีค่า = เพิ่งลากเข้ามา ยังไม่ได้ส่งเข้ารีโป */
  pending?: Prepared;
}

const storageKey = (blockId: string) => `arrange:${blockId}`;

/** ไฟล์ที่จะเอาไปวางในโฟลเดอร์รูป */
interface ArrangeFile {
  order: string[];
  hidden: string[];
  captions: Record<string, string>;
}

function toArrangeFile(items: Item[]): ArrangeFile {
  const captions: Record<string, string> = {};
  for (const i of items) if (i.caption.trim()) captions[i.file] = i.caption.trim();
  return {
    order: items.map((i) => i.file),
    hidden: items.filter((i) => i.hidden).map((i) => i.file),
    captions,
  };
}

/**
 * รวมสิ่งที่จัดไว้บนหน้านี้เข้ากับ arrange.json **ตัวปัจจุบันในรีโป**
 *
 * เว็บเป็นไฟล์นิ่ง รายการรูปที่หน้านี้เห็นจึงเป็นภาพนิ่งของตอน build
 * ถ้าเขียนทับทั้งก้อน รูปที่คนอื่นเพิ่งส่งไป (ยังไม่ทัน build) จะหลุดจาก `order`
 * ตัวไฟล์รูปยังอยู่ในรีโป แต่**คำบรรยายหายและใบที่ซ่อนไว้จะโผล่กลับ**
 *
 * กติกา: ไฟล์ที่หน้านี้เห็น ใช้ความเห็นของหน้านี้ · ไฟล์ที่ไม่เคยเห็น คงของเดิมไว้ทุกอย่าง
 */
function mergeArrange(live: ArrangeFile | null, mine: ArrangeFile): ArrangeFile {
  if (!live) return mine;

  const known = new Set(mine.order);
  const extra = (live.order ?? []).filter((f) => !known.has(f));

  const captions = { ...mine.captions };
  for (const f of extra) {
    const c = live.captions?.[f];
    if (c) captions[f] = c;
  }

  return {
    order: [...mine.order, ...extra],
    hidden: [...mine.hidden, ...(live.hidden ?? []).filter((f) => !known.has(f))],
    captions,
  };
}

export default function ArrangePage() {
  const [blockId, setBlockId] = useState(photoBlocks[0]?.id ?? '');
  const [items, setItems] = useState<Item[]>([]);
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [saved, setSaved] = useState('');
  /** การจัดวางตอนเปิดบล็อกนี้ — เทียบเพื่อรู้ว่ามีอะไรเปลี่ยนจริงไหม */
  const [baseline, setBaseline] = useState('');

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

    const settle = (next: Item[]) => {
      setItems(next);
      setBaseline(JSON.stringify(toArrangeFile(next)));
    };

    if (!draft) {
      settle(base);
      return;
    }

    const byFile = new Map(base.map((i) => [i.file, i]));
    const ordered = draft.order.map((f) => byFile.get(f)).filter((i): i is Item => Boolean(i));
    const rest = base.filter((i) => !draft!.order.includes(i.file));
    const hidden = new Set(draft.hidden);
    settle(
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

  const addPrepared = (added: Prepared[]) =>
    setItems((prev) => [
      ...prev,
      ...added.map((p) => ({
        file: p.name,
        src: p.previewUrl,
        caption: '',
        hidden: false,
        pending: p,
      })),
    ]);

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

  const resetToFilename = () =>
    setItems((prev) =>
      [...prev].sort((a, b) => a.file.localeCompare(b.file, 'en', { numeric: true })),
    );

  const shown = items.filter((i) => !i.hidden).length;
  const pending = items.filter((i) => i.pending);

  // เลขที่โชว์ต้องตรงกับเลขบนสไลด์จริง — รูปที่ซ่อนไม่กินเลข
  const slideNumbers = (() => {
    let n = 0;
    return items.map((i) => (i.hidden ? null : ++n));
  })();

  const folder = blockId ? expectedFolder(blockId) : '';

  const arrangePath = folder + 'arrange.json';
  const current = JSON.stringify(toArrangeFile(items));
  /** ไม่มีรูปใหม่และลำดับก็ไม่ขยับ = ไม่มีอะไรต้องส่ง */
  const dirty = pending.length > 0 || (Boolean(baseline) && current !== baseline);
  const fileCount = dirty ? pending.length + 1 : 0;

  // ส่งรูปใหม่ไปพร้อม arrange.json เสมอ ลำดับกับคำบรรยายจะได้ไม่หลุดจากกัน
  // อ่าน arrange.json ตัวปัจจุบันก่อนเขียนทับ (CLAUDE.md กฎข้อ 4) — ตอนกดส่ง ไม่ใช่ตอน render
  const getFiles = async (token: string): Promise<CommitFile[]> => {
    if (!items.length) return [];
    const liveArrange = await readJsonFile<ArrangeFile>(token, arrangePath);
    return [
      ...pending.map((i) => ({ path: folder + i.file, content: i.pending!.blob })),
      {
        path: arrangePath,
        content: JSON.stringify(mergeArrange(liveArrange, toArrangeFile(items)), null, 2) + '\n',
      },
    ];
  };

  const pendingBytes = pending.reduce((n, i) => n + i.pending!.blob.size, 0);
  const savedBytes = pending.reduce((n, i) => n + i.pending!.originalSize - i.pending!.blob.size, 0);

  return (
    <>
      <SiteNav />
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">ลงรูป</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        ลากรูปใส่ จัดลำดับ ซ่อนรูปที่ไม่เอา ใส่คำบรรยาย แล้วกดส่งเข้าระบบ
      </p>

      <label className="mt-6 block text-sm font-medium">
        บล็อกรูป
        <select
          value={blockId}
          onChange={(e) => setBlockId(e.target.value)}
          className="field mt-1.5 text-base"
        >
          {photoBlocks.map((b) => (
            <option key={b.id} value={b.id}>
              {b.sectionNumber} · {b.title} ({b.id})
            </option>
          ))}
        </select>
      </label>

      <p className="mt-2 text-xs text-muted">
        ลงที่ <span className="font-mono break-all">{folder}</span>
      </p>

      <div className="mt-4">
        <PhotoDrop existingNames={items.map((i) => i.file)} onAdd={addPrepared} />
      </div>

      {items.length === 0 ? (
        <p className="card mt-8 px-4 py-10 text-center text-muted">ยังไม่มีรูปในบล็อกนี้</p>
      ) : (
        <>
          <div className="mt-5 flex flex-wrap items-center gap-3 text-sm">
            <button onClick={resetToFilename} className="btn btn-outline">
              เรียงตามชื่อไฟล์ใหม่
            </button>
            <button onClick={download} className="btn btn-outline">
              บันทึก arrange.json
            </button>
            <button onClick={copy} className="btn btn-outline">
              คัดลอก JSON
            </button>
            <span className="text-muted" role="status">
              {shown} รูปขึ้นสไลด์
              {items.length - shown > 0 && ` · ซ่อน ${items.length - shown}`}
              {pending.length > 0 && (
                <span className="ml-2 font-medium text-warn-ink">
                  ใหม่ {pending.length} รูป · รวม {humanSize(pendingBytes)}
                  {/* ภาพสแกนที่เล็กอยู่แล้วอาจไม่ได้เล็กลง จึงบอกเฉพาะตอนที่ประหยัดจริง */}
                  {savedBytes > 0 && ` (เล็กลง ${humanSize(savedBytes)})`}
                </span>
              )}
              {saved && <span className="ml-2 font-medium text-primary">{saved}</span>}
            </span>
          </div>

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
                className={`cursor-grab rounded-xl border bg-surface p-2 transition active:cursor-grabbing ${
                  it.hidden
                    ? 'border-dashed border-edge opacity-50'
                    : it.pending
                      ? 'border-warn-ink/60 shadow-hair'
                      : 'border-edge hover:border-edge-strong hover:shadow-hair'
                }`}
              >
                <div className="relative overflow-hidden rounded-lg bg-surface-2">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src={it.src} alt={it.file} className="aspect-[4/3] w-full object-cover" />
                  <span className="absolute top-1 left-1 rounded-md bg-black/70 px-1.5 text-xs font-medium text-white tabular-nums">
                    {slideNumbers[i] ?? '—'}
                  </span>
                  {it.pending && (
                    <span className="absolute top-1 right-1 rounded-md bg-accent px-1.5 text-xs font-semibold text-ink">
                      ใหม่
                    </span>
                  )}
                </div>

                <p className="mt-1.5 truncate font-mono text-[11px] text-muted" title={it.file}>
                  {it.file}
                </p>

                {/* ลากสลับได้ แต่ต้องมีปุ่มด้วย — เมาส์ลากไม่ได้ทุกคนและคีย์บอร์ดลากไม่ได้เลย */}
                <div className="mt-1.5 flex items-center gap-1">
                  <button
                    onClick={() => move(i, i - 1)}
                    disabled={i === 0}
                    className="btn btn-outline btn-sm w-8 px-0"
                    aria-label={`เลื่อน ${it.file} ไปข้างหน้า`}
                  >
                    <IconLeft className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => move(i, i + 1)}
                    disabled={i === items.length - 1}
                    className="btn btn-outline btn-sm w-8 px-0"
                    aria-label={`เลื่อน ${it.file} ไปข้างหลัง`}
                  >
                    <IconRight className="h-3.5 w-3.5" />
                  </button>
                  <button
                    onClick={() => patch(i, { hidden: !it.hidden })}
                    aria-pressed={it.hidden}
                    className="btn btn-outline btn-sm ml-auto"
                  >
                    {it.hidden ? (
                      <IconEye className="h-3.5 w-3.5" />
                    ) : (
                      <IconEyeOff className="h-3.5 w-3.5" />
                    )}
                    {it.hidden ? 'เอากลับ' : 'ซ่อน'}
                  </button>
                </div>

                <input
                  value={it.caption}
                  onChange={(e) => patch(i, { caption: e.target.value })}
                  placeholder="คำบรรยาย"
                  aria-label={`คำบรรยายของ ${it.file}`}
                  className="field mt-1.5 px-2 py-1 text-xs"
                />
              </li>
            ))}
          </ol>

          <CommitPanel
            count={fileCount}
            disabled={!dirty}
            getFiles={getFiles}
            message={
              pending.length
                ? `Add ${pending.length} photos to ${blockId}`
                : `Update photo arrangement for ${blockId}`
            }
            onDone={() => {
              // ส่งไปแล้วไม่ต้องส่งซ้ำ · ตัวอย่างรูปยังดูได้จนกว่าจะปิดหน้า
              setItems((prev) => {
                const next = prev.map((i) => ({ ...i, pending: undefined }));
                setBaseline(JSON.stringify(toArrangeFile(next)));
                return next;
              });
            }}
          />
        </>
      )}
      </main>
    </>
  );
}
