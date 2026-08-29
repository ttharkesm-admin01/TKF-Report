/**
 * dropFiles.ts — ดึงไฟล์ออกจากสิ่งที่ผู้ใช้ลากมา **รวมถึงทั้งโฟลเดอร์**
 *
 * เหตุผลที่ต้องมี: บล็อกรูปมี 22 อัน ของเดิมต้องเลือกบล็อก → ลากรูป → กดส่ง
 * วนแบบนั้น 22 รอบต่อหนึ่งรอบรายงาน · ถ้าลากโฟลเดอร์แม่ที่ข้างในแยกโฟลเดอร์ย่อย
 * ตามรหัสบล็อกไว้แล้วได้ทีเดียว งานทั้งรอบจบในการลากครั้งเดียวและคอมมิตเดียว
 *
 * `dataTransfer.items` ใช้ได้แค่ในจังหวะที่ตัวจัดการ drop ยังทำงานอยู่ — พอ `await`
 * ตัวแรกผ่านไปมันจะว่างเปล่า จึงต้องคว้า entry ออกมาก่อนแบบ sync (`entriesFromDrop`)
 * แล้วค่อยเดินอ่านทีหลัง (`readEntries`)
 */

export interface DroppedFile {
  file: File;
  /** ชื่อโฟลเดอร์ที่ไฟล์นั้นอยู่ · `''` = ลากไฟล์เดี่ยว ๆ ไม่ได้อยู่ในโฟลเดอร์ */
  folder: string;
}

/** เอาชื่อโฟลเดอร์ที่ใกล้ตัวไฟล์ที่สุด — ลากโฟลเดอร์แม่มา ชั้นในสุดคือรหัสบล็อก */
function parentFolder(path: string): string {
  const parts = path.split('/').filter(Boolean);
  return parts.length > 1 ? parts[parts.length - 2] : '';
}

/** ต้องเรียกแบบ sync ในตัวจัดการ drop ก่อน await ตัวแรกเสมอ */
export function entriesFromDrop(dt: DataTransfer): FileSystemEntry[] {
  const out: FileSystemEntry[] = [];
  for (let i = 0; i < dt.items.length; i += 1) {
    const item = dt.items[i];
    if (item.kind !== 'file') continue;
    const entry = item.webkitGetAsEntry?.();
    if (entry) out.push(entry);
  }
  return out;
}

/** เดินเข้าไปในโฟลเดอร์ทุกชั้นแล้วคืนไฟล์ทั้งหมด */
export async function readEntries(entries: FileSystemEntry[]): Promise<DroppedFile[]> {
  const out: DroppedFile[] = [];

  const walk = async (entry: FileSystemEntry): Promise<void> => {
    if (entry.isFile) {
      const file = await new Promise<File | null>((resolve) =>
        (entry as FileSystemFileEntry).file(
          (f) => resolve(f),
          () => resolve(null),
        ),
      );
      if (file) out.push({ file, folder: parentFolder(entry.fullPath) });
      return;
    }
    if (!entry.isDirectory) return;

    // readEntries คืนมาทีละชุด (Chrome ชุดละ 100) ต้องเรียกซ้ำจนได้ชุดว่างถึงจะครบ
    const reader = (entry as FileSystemDirectoryEntry).createReader();
    for (;;) {
      const batch = await new Promise<FileSystemEntry[]>((resolve) =>
        reader.readEntries(
          (b) => resolve(b),
          () => resolve([]),
        ),
      );
      if (!batch.length) return;
      for (const child of batch) await walk(child);
    }
  };

  for (const entry of entries) await walk(entry);
  return out;
}

/** ไฟล์จาก `<input type="file">` · เลือกทั้งโฟลเดอร์ (`webkitdirectory`) ก็ได้เส้นทางมาด้วย */
export function fromInput(list: FileList): DroppedFile[] {
  return [...list].map((file) => ({
    file,
    folder: parentFolder(file.webkitRelativePath || file.name),
  }));
}

/** เบราว์เซอร์ที่ไม่รู้จัก entry API — ยังลากไฟล์เดี่ยวได้ แค่ลากโฟลเดอร์ไม่ได้ */
export const canReadFolders = (): boolean =>
  typeof DataTransferItem !== 'undefined' && 'webkitGetAsEntry' in DataTransferItem.prototype;
