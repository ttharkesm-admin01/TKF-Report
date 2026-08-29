'use client';

import { useEffect, useRef, useState } from 'react';
import { prepareImage, humanSize, MAX_EDGE, type Prepared } from '@/lib/resize';
import { entriesFromDrop, fromInput, readEntries, type DroppedFile } from '@/lib/dropFiles';
import { matchBlock, photoBlocks } from '@/lib/photoBlocks';
import { IconUpload } from '@/components/ui/icons';

/** รูปที่ย่อเสร็จแล้ว พร้อมบอกว่าจะลงบล็อกไหน */
export interface AddedGroup {
  blockId: string;
  items: Prepared[];
}

/** โฟลเดอร์หนึ่งอันที่ลากมา · `blockId` null = ยังเดาไม่ออกว่าเป็นของบล็อกไหน */
interface Group {
  folder: string;
  files: File[];
  blockId: string | null;
}

/**
 * ลากรูปใส่ตรงนี้ · ย่อให้เสร็จก่อนคืนออกไป ไม่มีรูปดิบหลุดเข้ารีโป
 *
 * ลาก**ทั้งโฟลเดอร์**ได้ · โฟลเดอร์ย่อยที่ชื่อตรงรหัสบล็อกจะถูกแจกเข้าบล็อกนั้นเอง
 * ที่เหลือค่อยเลือกเอาทีหลังทีเดียว ไม่ต้องกลับไปเลือกบล็อกทีละอันแล้วลากใหม่
 */
export function PhotoDrop({
  currentBlockId,
  onAdd,
}: {
  /** ไฟล์ที่ลากมาเดี่ยว ๆ (ไม่ได้อยู่ในโฟลเดอร์) ลงบล็อกนี้ */
  currentBlockId: string;
  onAdd: (groups: AddedGroup[]) => void;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  /** โฟลเดอร์ที่เดาไม่ออก รอให้ผู้ใช้ชี้ว่าเป็นของบล็อกไหน */
  const [assign, setAssign] = useState<Group[] | null>(null);
  const fileRef = useRef<HTMLInputElement>(null);
  const folderRef = useRef<HTMLInputElement>(null);

  // `webkitdirectory` ไม่มีใน type ของ React จึงต้องใส่เอง · ใส่ครั้งเดียวตอน mount
  // ห้ามใส่ผ่าน ref callback แบบ inline — React จะถอด/ใส่ ref ใหม่ทุกครั้งที่หน้า render
  // แล้วช่องไฟล์ที่ถือรายการทั้งโฟลเดอร์อยู่ทำให้แท็บดับทั้งแท็บ (เจอมาแล้วตอนทดสอบ)
  useEffect(() => {
    folderRef.current?.setAttribute('webkitdirectory', '');
    folderRef.current?.setAttribute('directory', '');
  }, []);

  /** จัดกลุ่มตามโฟลเดอร์ แล้วเดาบล็อกให้ทุกกลุ่ม */
  function group(dropped: DroppedFile[]): Group[] {
    const groups = new Map<string, File[]>();
    for (const d of dropped) {
      const key = d.folder;
      const list = groups.get(key);
      if (list) list.push(d.file);
      else groups.set(key, [d.file]);
    }

    return [...groups].map(([folder, files]) => ({
      folder,
      // ลำดับที่ระบบไฟล์คืนมาไม่แน่นอน — เรียงตามชื่อไว้ก่อน ให้ผลเหมือนกันทุกครั้ง
      files: files.sort((a, b) => a.name.localeCompare(b.name, 'en', { numeric: true })),
      blockId: folder ? matchBlock(folder) : currentBlockId,
    }));
  }

  async function accept(dropped: DroppedFile[]) {
    setError('');
    if (!dropped.length) return;

    const images = dropped.filter((d) => d.file.type.startsWith('image/'));
    const skipped = dropped.length - images.length;
    if (!images.length) {
      setError('ไม่พบไฟล์รูปในสิ่งที่ลากมา');
      return;
    }
    if (skipped) setError(`ข้ามไฟล์ที่ไม่ใช่รูป ${skipped} ไฟล์`);

    const groups = group(images);
    // เดาได้ครบก็ลงมือย่อเลย ไม่ต้องถามอะไรอีก
    if (groups.every((g) => g.blockId)) await process(groups);
    else setAssign(groups);
  }

  /** ย่อรูปทุกกลุ่มที่มีปลายทางแล้ว */
  async function process(groups: Group[]) {
    const todo = groups.filter((g) => g.blockId);
    const total = todo.reduce((n, g) => n + g.files.length, 0);
    if (!total) return;

    const out: AddedGroup[] = [];
    const failed: string[] = [];
    let done = 0;

    for (const g of todo) {
      const items: Prepared[] = [];
      for (const f of g.files) {
        done += 1;
        setBusy(`กำลังย่อรูป ${done}/${total}${g.folder ? ` · ${g.folder}` : ''}`);
        try {
          items.push(await prepareImage(f));
        } catch {
          failed.push(f.name);
        }
      }
      if (items.length) out.push({ blockId: g.blockId as string, items });
    }

    setBusy('');
    if (failed.length) setError(`ย่อไม่สำเร็จ ${failed.length} ไฟล์: ${failed.slice(0, 3).join(', ')}`);
    if (out.length) onAdd(out);
    if (fileRef.current) fileRef.current.value = '';
    if (folderRef.current) folderRef.current.value = '';
  }

  function onDrop(e: React.DragEvent) {
    e.preventDefault();
    setOver(false);
    // ต้องคว้า entry ออกมาก่อน await ตัวแรก ไม่งั้น dataTransfer ว่างไปแล้ว
    const entries = entriesFromDrop(e.dataTransfer);
    const loose = [...e.dataTransfer.files].map((file) => ({ file, folder: '' }));
    void (async () => {
      const dropped = entries.length ? await readEntries(entries) : loose;
      await accept(dropped);
    })();
  }

  const totalIn = (g: Group[]) => g.reduce((n, x) => n + x.files.length, 0);

  return (
    <div>
      <div
        onDragOver={(e) => {
          e.preventDefault();
          setOver(true);
        }}
        onDragLeave={() => setOver(false)}
        onDrop={onDrop}
        onClick={() => fileRef.current?.click()}
        role="button"
        tabIndex={0}
        onKeyDown={(e) => {
          // ลากไม่ได้ก็ต้องกดจากคีย์บอร์ดได้ — กล่องนี้เป็น div ไม่ใช่ปุ่มจริง
          if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            fileRef.current?.click();
          }
        }}
        className={`cursor-pointer rounded-xl2 border-2 border-dashed px-6 py-10 text-center transition ${
          over
            ? 'border-primary bg-primary-soft'
            : 'border-edge-strong bg-surface hover:border-primary hover:bg-surface-2'
        }`}
      >
        <input
          ref={fileRef}
          type="file"
          accept="image/*"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void accept(fromInput(e.target.files));
          }}
        />
        <input
          ref={folderRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => {
            if (e.target.files) void accept(fromInput(e.target.files));
          }}
        />

        {busy ? (
          <p className="text-lg font-semibold text-primary" role="status">
            {busy}
          </p>
        ) : (
          <>
            <IconUpload className="mx-auto h-8 w-8 text-muted" />
            <p className="mt-2 text-lg font-semibold">ลากรูปหรือทั้งโฟลเดอร์มาวางตรงนี้</p>
            <p className="mt-1 text-sm text-muted">
              โฟลเดอร์ย่อยที่ชื่อตรงรหัสบล็อก จะแยกลงบล็อกนั้นให้เอง — ลากทีเดียวได้ทั้งรอบ
            </p>

            <div className="mt-3 flex flex-wrap items-center justify-center gap-2">
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  fileRef.current?.click();
                }}
                className="btn btn-outline btn-sm"
              >
                เลือกไฟล์รูป
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.stopPropagation();
                  folderRef.current?.click();
                }}
                className="btn btn-outline btn-sm"
              >
                เลือกทั้งโฟลเดอร์
              </button>
            </div>

            <p className="mt-2 text-xs text-muted">
              ย่อให้อัตโนมัติเหลือด้านยาว {MAX_EDGE}px (ยังอ่านวันที่บนรูปออก) ·
              ภาพสแกน PNG ที่เล็กกว่า {humanSize(1_000_000)} เก็บไว้อย่างเดิม
            </p>
          </>
        )}

        {error && (
          <p className="mt-3 text-sm text-danger-ink" role="alert">
            {error}
          </p>
        )}
      </div>

      {assign && (
        <section className="card mt-4 p-5">
          <h2 className="text-base font-semibold">โฟลเดอร์ไหนเป็นของหัวข้อไหน</h2>
          <p className="mt-1 text-sm leading-relaxed text-muted">
            เดาจากชื่อโฟลเดอร์ไม่ออก {assign.filter((g) => !g.blockId).length} อัน ·
            เลือกให้ครั้งเดียวแล้วลงพร้อมกันทั้งหมด
            <br />
            ครั้งหน้าตั้งชื่อโฟลเดอร์เป็น<span className="font-mono"> รหัสบล็อก </span>
            เช่น <span className="font-mono">g-garden-r1</span> จะไม่ต้องเลือกอีก
          </p>

          <ul className="mt-4 grid gap-2">
            {assign.map((g, i) => (
              <li key={g.folder || '(ไฟล์เดี่ยว)'} className="flex flex-wrap items-center gap-2">
                <span className="min-w-0 flex-1 truncate font-mono text-sm" title={g.folder}>
                  {g.folder || 'ไฟล์ที่ลากมาเดี่ยว ๆ'}
                </span>
                <span className="chip chip-neutral tabular-nums">{g.files.length} รูป</span>
                <select
                  value={g.blockId ?? ''}
                  aria-label={`หัวข้อของโฟลเดอร์ ${g.folder || 'ไฟล์ที่ลากมาเดี่ยว ๆ'}`}
                  onChange={(e) =>
                    setAssign((prev) =>
                      (prev ?? []).map((x, k) =>
                        k === i ? { ...x, blockId: e.target.value || null } : x,
                      ),
                    )
                  }
                  className="field w-full text-sm sm:w-96"
                >
                  <option value="">— ไม่ลง ข้ามโฟลเดอร์นี้ —</option>
                  {photoBlocks.map((b) => (
                    <option key={b.id} value={b.id}>
                      {b.sectionNumber} · {b.title} ({b.id})
                    </option>
                  ))}
                </select>
              </li>
            ))}
          </ul>

          <div className="mt-4 flex flex-wrap items-center gap-3">
            <button
              onClick={() => {
                const groups = assign;
                setAssign(null);
                void process(groups);
              }}
              disabled={!assign.some((g) => g.blockId)}
              className="btn btn-primary"
            >
              ลงรูปตามนี้ ({totalIn(assign.filter((g) => g.blockId))} รูป)
            </button>
            <button onClick={() => setAssign(null)} className="btn btn-quiet">
              ยกเลิก
            </button>
          </div>
        </section>
      )}
    </div>
  );
}
