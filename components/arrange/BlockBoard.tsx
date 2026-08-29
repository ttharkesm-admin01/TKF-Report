'use client';

import { useRef, useState } from 'react';
import { photoBlocks } from '@/lib/photoBlocks';
import { entriesFromDrop, fromInput, readEntries, type DroppedFile } from '@/lib/dropFiles';
import { IconImage, IconUpload } from '@/components/ui/icons';

export interface BlockCount {
  total: number;
  /** ที่ลากเข้ามาแล้วแต่ยังไม่ได้ส่งเข้ารีโป */
  pending: number;
}

/**
 * กระดานหัวข้อรูป — **ลากรูปทิ้งบนการ์ดไหน รูปลงหัวข้อนั้น**
 *
 * ของเดิมเป็นดรอปดาว 22 บรรทัด ต้องเลือกหัวข้อก่อนถึงจะลากได้ และไม่มีทางรู้ว่า
 * หัวข้อไหนยังไม่มีรูปนอกจากกดไล่ดูทีละอัน · กระดานบอกทั้งสองอย่างในหน้าจอเดียว
 *
 * ลากโฟลเดอร์ทิ้งบนการ์ดก็ได้ — รูปในโฟลเดอร์นั้นทุกชั้นลงหัวข้อของการ์ดที่ทิ้ง
 */
export function BlockBoard({
  selected,
  counts,
  busy,
  onSelect,
  onFiles,
}: {
  selected: string;
  counts: Record<string, BlockCount>;
  /** ข้อความระหว่างย่อรูป · ว่าง = ไม่ได้ทำอะไรอยู่ */
  busy: string;
  onSelect: (blockId: string) => void;
  onFiles: (blockId: string, files: DroppedFile[]) => void;
}) {
  const [over, setOver] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  /** การ์ดที่กดปุ่มเลือกไฟล์ไว้ — ช่องเลือกไฟล์มีตัวเดียวใช้ร่วมกันทุกการ์ด */
  const pickFor = useRef('');

  const withPhotos = photoBlocks.filter((b) => (counts[b.id]?.total ?? 0) > 0).length;

  const drop = (blockId: string) => (e: React.DragEvent) => {
    e.preventDefault();
    setOver('');
    // ต้องคว้า entry ออกมาก่อน await ตัวแรก ไม่งั้น dataTransfer ว่างไปแล้ว
    const entries = entriesFromDrop(e.dataTransfer);
    const loose = [...e.dataTransfer.files].map((file) => ({ file, folder: '' }));
    void (async () => {
      onFiles(blockId, entries.length ? await readEntries(entries) : loose);
    })();
  };

  return (
    <section aria-labelledby="board-heading">
      <div className="flex flex-wrap items-baseline gap-x-3 gap-y-1">
        <h2 id="board-heading" className="text-lg font-semibold">
          หัวข้อรูป
        </h2>
        {/* บอกความคืบหน้าของทั้งรอบในบรรทัดเดียว — ของเดิมต้องกดดรอปดาวไล่ดูทีละหัวข้อ */}
        <span className="chip chip-neutral tabular-nums">
          มีรูปแล้ว {withPhotos}/{photoBlocks.length} หัวข้อ
        </span>
        <p className="w-full text-sm text-muted sm:w-auto">
          ลากรูปหรือทั้งโฟลเดอร์ทิ้งบนการ์ดได้เลย · คลิกการ์ดเพื่อจัดลำดับข้างล่าง
        </p>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => {
          if (e.target.files?.length && pickFor.current) {
            onFiles(pickFor.current, fromInput(e.target.files));
          }
          e.target.value = '';
        }}
      />

      {/* กริดเดียวต่อเนื่อง ไม่ขึ้นแถวใหม่ตามหัวข้อใหญ่ — 13 หัวข้อใหญ่แยกแถวทำให้กระดานยาว
          เกินสองจอ ทั้งที่การ์ดจริงมีแค่ 22 ใบ · เลขหัวข้อย้ายไปอยู่บนการ์ดแทน */}
      <ul className="mt-3 grid gap-2 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
        {photoBlocks.map((b) => {
          const c = counts[b.id] ?? { total: 0, pending: 0 };
          const isOver = over === b.id;
          const isOn = selected === b.id;
          return (
            <li key={b.id}>
              <div
                role="button"
                tabIndex={0}
                aria-pressed={isOn}
                aria-label={`${b.sectionNumber} ${b.title} — ${c.total ? `${c.total} รูป` : 'ยังไม่มีรูป'} · คลิกเพื่อจัดหัวข้อนี้ หรือลากรูปมาวาง`}
                onClick={() => onSelect(b.id)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter' || e.key === ' ') {
                    e.preventDefault();
                    onSelect(b.id);
                  }
                }}
                onDragOver={(e) => {
                  e.preventDefault();
                  setOver(b.id);
                }}
                onDragLeave={(e) => {
                  // เลื่อนเข้าไปในลูกของการ์ดก็นับเป็น dragleave ของการ์ด ต้องกันไว้
                  if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setOver('');
                }}
                onDrop={drop(b.id)}
                className={`flex h-full cursor-pointer flex-col rounded-xl border-2 px-2.5 py-2 transition ${
                  isOver
                    ? 'border-primary bg-primary-soft'
                    : isOn
                      ? 'border-primary bg-surface'
                      : c.pending
                        ? 'border-warn-ink/50 bg-surface'
                        : 'border-dashed border-edge-strong bg-surface hover:border-primary hover:bg-surface-2'
                }`}
              >
                <p className="text-sm leading-snug font-medium">
                  <span className="mr-1 font-mono text-xs text-muted">{b.sectionNumber}</span>
                  {b.title}
                </p>
                <p className="font-mono text-[11px] break-all text-muted">{b.id}</p>

                <div className="mt-auto flex items-center justify-between gap-2 pt-1.5">
                  <span className={`text-xs ${c.pending ? 'font-medium text-warn-ink' : 'text-muted'}`}>
                    {c.total ? `${c.total} รูป` : 'ยังไม่มีรูป'}
                    {c.pending > 0 && ` · ใหม่ ${c.pending}`}
                  </span>

                  <button
                    onClick={(e) => {
                      e.stopPropagation();
                      pickFor.current = b.id;
                      inputRef.current?.click();
                    }}
                    className="btn btn-outline btn-sm"
                    aria-label={`เลือกไฟล์รูปสำหรับ ${b.title}`}
                  >
                    <IconUpload className="h-3.5 w-3.5" />
                    เลือกไฟล์
                  </button>
                </div>
              </div>
            </li>
          );
        })}
      </ul>

      {busy && (
        <p className="note note-brand mt-4 flex items-center gap-2" role="status" aria-live="polite">
          <IconImage className="h-4 w-4" />
          {busy}
        </p>
      )}
    </section>
  );
}
