'use client';

import { useRef, useState } from 'react';
import { prepareImage, humanSize, MAX_EDGE, type Prepared } from '@/lib/resize';

/** ลากรูปใส่ตรงนี้ · ย่อให้เสร็จก่อนคืนออกไป ไม่มีรูปดิบหลุดเข้ารีโป */
export function PhotoDrop({
  existingNames,
  onAdd,
}: {
  existingNames: string[];
  onAdd: (items: Prepared[]) => void;
}) {
  const [over, setOver] = useState(false);
  const [busy, setBusy] = useState('');
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  async function accept(fileList: FileList | null) {
    if (!fileList?.length) return;
    setError('');

    const files = [...fileList].filter((f) => f.type.startsWith('image/'));
    const skipped = fileList.length - files.length;
    if (!files.length) {
      setError('ไม่พบไฟล์รูปในสิ่งที่ลากมา');
      return;
    }

    // ชื่อซ้ำต้องไม่ทับของเดิม — ลำดับรูปยึดตามชื่อไฟล์ ทับแล้วเรียงเพี้ยน
    const taken = new Set(existingNames);
    const out: Prepared[] = [];

    for (const [i, f] of files.entries()) {
      setBusy(`กำลังย่อรูป ${i + 1}/${files.length}`);
      try {
        const p = await prepareImage(f);
        let name = p.name;
        if (taken.has(name)) {
          const dot = name.lastIndexOf('.');
          const stem = dot > 0 ? name.slice(0, dot) : name;
          const ext = dot > 0 ? name.slice(dot) : '';
          let n = 2;
          while (taken.has(`${stem}-${n}${ext}`)) n += 1;
          name = `${stem}-${n}${ext}`;
        }
        taken.add(name);
        out.push({ ...p, name });
      } catch (e) {
        setError(`${f.name}: ${e instanceof Error ? e.message : 'ย่อไม่สำเร็จ'}`);
      }
    }

    setBusy('');
    if (skipped) setError(`ข้ามไฟล์ที่ไม่ใช่รูป ${skipped} ไฟล์`);
    if (out.length) onAdd(out);
    if (inputRef.current) inputRef.current.value = '';
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setOver(true);
      }}
      onDragLeave={() => setOver(false)}
      onDrop={(e) => {
        e.preventDefault();
        setOver(false);
        void accept(e.dataTransfer.files);
      }}
      onClick={() => inputRef.current?.click()}
      className={`cursor-pointer rounded-lg border-2 border-dashed px-6 py-8 text-center transition ${
        over ? 'border-brand bg-brand-soft' : 'border-line bg-white hover:bg-neutral-50'
      }`}
    >
      <input
        ref={inputRef}
        type="file"
        accept="image/*"
        multiple
        className="hidden"
        onChange={(e) => void accept(e.target.files)}
      />

      {busy ? (
        <p className="text-lg font-semibold text-brand">{busy}</p>
      ) : (
        <>
          <p className="text-lg font-semibold">ลากรูปมาวางตรงนี้</p>
          <p className="mt-1 text-sm text-ink-soft">หรือคลิกเพื่อเลือกไฟล์ · เลือกทีเดียวหลายร้อยใบได้</p>
          <p className="mt-2 text-xs text-ink-soft">
            ย่อให้อัตโนมัติเหลือด้านยาว {MAX_EDGE}px (ยังอ่านวันที่บนรูปออก) ·
            ภาพสแกน PNG ที่เล็กกว่า {humanSize(1_000_000)} เก็บไว้อย่างเดิม
          </p>
        </>
      )}

      {error && <p className="mt-3 text-sm text-red-600">{error}</p>}
    </div>
  );
}
