'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import { SiteNav } from '@/components/nav/SiteNav';
import { allPhotosOf, expectedFolder } from '@/lib/photos';
import { photoBlocks } from '@/lib/photoBlocks';
import { humanSize, type Prepared } from '@/lib/resize';
import { prepareMany } from '@/lib/prepareMany';
import { type DroppedFile } from '@/lib/dropFiles';
import { readJsonFile, type CommitFile } from '@/lib/github';
import { BlockBoard, type BlockCount } from '@/components/arrange/BlockBoard';
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

/** รูปของทุกบล็อก อยู่ในหน้าเดียวกัน — สลับบล็อกแล้วรูปที่ลากมายังไม่ส่งต้องไม่หาย */
type Store = Record<string, Item[]>;

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

/** ชื่อไฟล์ซ้ำต้องไม่ทับของเดิม — ลำดับรูปยึดตามชื่อไฟล์ ทับแล้วเรียงเพี้ยน */
function freeName(name: string, taken: Set<string>): string {
  if (!taken.has(name)) return name;
  const dot = name.lastIndexOf('.');
  const stem = dot > 0 ? name.slice(0, dot) : name;
  const ext = dot > 0 ? name.slice(dot) : '';
  let n = 2;
  while (taken.has(`${stem}-${n}${ext}`)) n += 1;
  return `${stem}-${n}${ext}`;
}

/** รูปของบล็อกหนึ่ง: ของในรีโป ทับด้วยงานที่ค้างไว้ในเบราว์เซอร์ (ถ้ามี) */
function loadBlock(blockId: string): { items: Item[]; baseline: string } {
  const base: Item[] = allPhotosOf(blockId).map((p) => ({
    file: p.file,
    src: p.src,
    caption: p.caption ?? '',
    hidden: Boolean(p.hidden),
  }));
  // เทียบกับของในรีโปเสมอ ไม่ใช่ของที่ค้างไว้ — ปิดหน้าไปแล้วกลับมากดส่งต่อได้
  const baseline = JSON.stringify(toArrangeFile(base));

  let draft: ArrangeFile | null = null;
  try {
    const raw = localStorage.getItem(storageKey(blockId));
    if (raw) draft = JSON.parse(raw) as ArrangeFile;
  } catch {
    draft = null;
  }
  if (!draft) return { items: base, baseline };

  const byFile = new Map(base.map((i) => [i.file, i]));
  const ordered = draft.order.map((f) => byFile.get(f)).filter((i): i is Item => Boolean(i));
  const rest = base.filter((i) => !draft.order.includes(i.file));
  const hidden = new Set(draft.hidden);

  return {
    items: [...ordered, ...rest].map((i) => ({
      ...i,
      hidden: hidden.has(i.file),
      caption: draft.captions[i.file] ?? i.caption,
    })),
    baseline,
  };
}

export default function ArrangePage() {
  const [blockId, setBlockId] = useState(photoBlocks[0]?.id ?? '');
  const [store, setStore] = useState<Store>({});
  /** การจัดวางของแต่ละบล็อกในรีโป — เทียบเพื่อรู้ว่ามีอะไรเปลี่ยนจริงไหม */
  const [baseline, setBaseline] = useState<Record<string, string>>({});
  const [dragFrom, setDragFrom] = useState<number | null>(null);
  const [saved, setSaved] = useState('');
  /** ข้อความระหว่างย่อรูป และข้อความบอกไฟล์ที่ตกไป */
  const [busy, setBusy] = useState('');
  const [note, setNote] = useState('');

  const block = useMemo(() => photoBlocks.find((b) => b.id === blockId), [blockId]);
  const items = useMemo(() => store[blockId] ?? [], [store, blockId]);

  // โหลดทุกบล็อกทีเดียวตอนเปิดหน้า · localStorage อ่านได้หลัง hydrate เท่านั้น
  useEffect(() => {
    const nextStore: Store = {};
    const nextBase: Record<string, string> = {};
    for (const b of photoBlocks) {
      const loaded = loadBlock(b.id);
      nextStore[b.id] = loaded.items;
      nextBase[b.id] = loaded.baseline;
    }
    setStore(nextStore);
    setBaseline(nextBase);
  }, []);

  // เก็บงานที่ทำค้างไว้ ปิดหน้าไปแล้วกลับมาต่อได้ (เก็บได้แค่ลำดับ/คำบรรยาย ตัวรูปเก็บไม่ได้)
  const written = useRef<Record<string, string>>({});
  useEffect(() => {
    for (const [id, list] of Object.entries(store)) {
      if (!list.length) continue;
      const s = JSON.stringify(toArrangeFile(list));
      if (written.current[id] === s) continue;
      written.current[id] = s;
      try {
        localStorage.setItem(storageKey(id), s);
      } catch {
        /* เบราว์เซอร์ปิด storage อยู่ — ไม่เป็นไร แค่ไม่ได้เก็บงานค้าง */
      }
    }
  }, [store]);

  const setItems = (id: string, fn: (prev: Item[]) => Item[]) =>
    setStore((prev) => ({ ...prev, [id]: fn(prev[id] ?? []) }));

  const move = (from: number, to: number) =>
    setItems(blockId, (prev) => {
      if (to < 0 || to >= prev.length) return prev;
      const next = [...prev];
      const [x] = next.splice(from, 1);
      next.splice(to, 0, x);
      return next;
    });

  const patch = (i: number, p: Partial<Item>) =>
    setItems(blockId, (prev) => prev.map((it, k) => (k === i ? { ...it, ...p } : it)));

  /** รูปที่ย่อเสร็จแล้ว — ต่อท้ายหัวข้อที่ลากใส่ */
  const addPrepared = (id: string, prepared: Prepared[]) =>
    setStore((prev) => {
      const cur = prev[id] ?? [];
      const taken = new Set(cur.map((i) => i.file));
      const added: Item[] = [];
      for (const p of prepared) {
        const name = freeName(p.name, taken);
        taken.add(name);
        added.push({
          file: name,
          src: p.previewUrl,
          caption: '',
          hidden: false,
          pending: { ...p, name },
        });
      }
      return { ...prev, [id]: [...cur, ...added] };
    });

  /**
   * รับสิ่งที่ลากทิ้งบนการ์ด (หรือเลือกจากปุ่มบนการ์ด) แล้วย่อก่อนเก็บ
   * ลากโฟลเดอร์ทิ้งบนการ์ดก็ได้ — รูปข้างในทุกชั้นลงหัวข้อของการ์ดนั้นทั้งหมด
   */
  const takeFiles = async (id: string, dropped: DroppedFile[]) => {
    setNote('');
    const images = dropped.filter((d) => d.file.type.startsWith('image/'));
    const skipped = dropped.length - images.length;
    if (!images.length) {
      setNote('ไม่พบไฟล์รูปในสิ่งที่ลากมา');
      return;
    }

    // เปิดหัวข้อที่เพิ่งลากใส่ให้เลย จะได้เห็นว่ารูปลงจริงและจัดต่อได้ทันที
    setBlockId(id);
    const title = photoBlocks.find((b) => b.id === id)?.title ?? id;
    const { items: prepared, failed } = await prepareMany(images.map((d) => d.file), (done, total) =>
      setBusy(`กำลังย่อรูป ${done}/${total} · ${title}`),
    );
    setBusy('');

    const notes: string[] = [];
    if (skipped) notes.push(`ข้ามไฟล์ที่ไม่ใช่รูป ${skipped} ไฟล์`);
    if (failed.length) notes.push(`ย่อไม่สำเร็จ ${failed.length} ไฟล์: ${failed.slice(0, 3).join(', ')}`);
    setNote(notes.join(' · '));

    if (prepared.length) addPrepared(id, prepared);
  };

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
    setItems(blockId, (prev) =>
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

  /** บล็อกที่มีอะไรเปลี่ยนจริง — รูปใหม่ ลำดับขยับ ซ่อน หรือคำบรรยาย */
  const dirtyIds = useMemo(
    () =>
      photoBlocks
        .map((b) => b.id)
        .filter(
          (id) =>
            baseline[id] !== undefined &&
            store[id] &&
            JSON.stringify(toArrangeFile(store[id])) !== baseline[id],
        ),
    [store, baseline],
  );

  const counts: Record<string, BlockCount> = Object.fromEntries(
    photoBlocks.map((b) => {
      const list = store[b.id] ?? [];
      return [b.id, { total: list.length, pending: list.filter((i) => i.pending).length }];
    }),
  );

  const pendingAll = dirtyIds.flatMap((id) => (store[id] ?? []).filter((i) => i.pending));
  const pendingBytes = pendingAll.reduce((n, i) => n + i.pending!.blob.size, 0);
  const savedBytes = pendingAll.reduce(
    (n, i) => n + i.pending!.originalSize - i.pending!.blob.size,
    0,
  );
  /** รูปใหม่ทุกใบ + arrange.json ของทุกบล็อกที่แตะ */
  const fileCount = pendingAll.length + dirtyIds.length;

  // รูปที่ย่อไว้อยู่ในหน่วยความจำอย่างเดียว ปิดหน้าแล้วหาย — เตือนก่อน
  useEffect(() => {
    if (!pendingAll.length) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [pendingAll.length]);

  // ส่งรูปใหม่ไปพร้อม arrange.json เสมอ ลำดับกับคำบรรยายจะได้ไม่หลุดจากกัน
  // อ่าน arrange.json ตัวปัจจุบันก่อนเขียนทับ (CLAUDE.md กฎข้อ 4) — ตอนกดส่ง ไม่ใช่ตอน render
  const getFiles = async (token: string): Promise<CommitFile[]> => {
    const out: CommitFile[] = [];
    for (const id of dirtyIds) {
      const list = store[id] ?? [];
      const dir = expectedFolder(id);
      const live = await readJsonFile<ArrangeFile>(token, dir + 'arrange.json');
      for (const i of list) if (i.pending) out.push({ path: dir + i.file, content: i.pending.blob });
      out.push({
        path: dir + 'arrange.json',
        content: JSON.stringify(mergeArrange(live, toArrangeFile(list)), null, 2) + '\n',
      });
    }
    return out;
  };

  const message = (() => {
    const where = dirtyIds.length === 1 ? dirtyIds[0] : `${dirtyIds.length} blocks`;
    return pendingAll.length
      ? `Add ${pendingAll.length} photos to ${where}`
      : `Update photo arrangement for ${where}`;
  })();

  return (
    <>
      <SiteNav />
      <main id="main" className="mx-auto max-w-6xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">ลงรูป</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        ลากรูปทิ้งบนการ์ดของหัวข้อนั้นได้เลย · ลงหลายหัวข้อแล้วกดส่งทีเดียวได้
      </p>

      <div className="mt-6">
        <BlockBoard
          selected={blockId}
          counts={counts}
          busy={busy}
          onSelect={setBlockId}
          onFiles={(id, files) => void takeFiles(id, files)}
        />
      </div>

      {note && (
        <p className="note note-warn mt-4" role="alert">
          {note}
        </p>
      )}

      <h2 className="mt-8 border-t border-edge pt-6 text-lg font-semibold">
        {block ? `จัดรูป: ${block.title}` : 'จัดรูป'}
      </h2>
      <p className="mt-1 text-xs text-muted">
        ลงที่ <span className="font-mono break-all">{folder}</span>
      </p>

      {items.length === 0 ? (
        <p className="card mt-4 px-4 py-10 text-center text-muted">
          ยังไม่มีรูปในหัวข้อนี้ — ลากรูปทิ้งบนการ์ดข้างบน
        </p>
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
                <span className="ml-2 font-medium text-warn-ink">ใหม่ {pending.length} รูป</span>
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
        </>
      )}

      {/* ส่งทุกหัวข้อที่แตะไว้ในคอมมิตเดียว — ไม่ต้องกดส่งทีละหัวข้อ */}
      <CommitPanel
        count={fileCount}
        disabled={dirtyIds.length === 0}
        getFiles={getFiles}
        message={message}
        summary={
          dirtyIds.length > 0 ? (
            <>
              {dirtyIds.length} หัวข้อ · รูปใหม่ {pendingAll.length} ใบ
              {pendingAll.length > 0 && ` รวม ${humanSize(pendingBytes)}`}
              {/* ภาพสแกนที่เล็กอยู่แล้วอาจไม่ได้เล็กลง จึงบอกเฉพาะตอนที่ประหยัดจริง */}
              {savedBytes > 0 && ` (เล็กลง ${humanSize(savedBytes)})`}
            </>
          ) : null
        }
        onDone={() => {
          // ส่งไปแล้วไม่ต้องส่งซ้ำ · ตัวอย่างรูปยังดูได้จนกว่าจะปิดหน้า
          const nextStore: Store = {};
          const nextBase = { ...baseline };
          for (const [id, list] of Object.entries(store)) {
            nextStore[id] = list.map((i) => ({ ...i, pending: undefined }));
            nextBase[id] = JSON.stringify(toArrangeFile(nextStore[id]));
          }
          setStore(nextStore);
          setBaseline(nextBase);
        }}
      />
      </main>
    </>
  );
}
