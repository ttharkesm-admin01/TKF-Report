/**
 * resize.ts — ย่อรูปในเบราว์เซอร์ก่อนส่งเข้ารีโป
 *
 * เหตุผลที่ต้องย่อ (PROJECT.md กฎข้อ 5 + ปัญหาไฟล์ 161 MB ในข้อ 2):
 * รูปจากมือถือใบละ 3–5 MB · รอบละ 200–300 ใบ · เดือนละ 2 รอบ
 * ถ้าเข้า git ดิบ ๆ รีโปจะพังภายในสองเดือน
 *
 * ย่อแล้วยังต้อง**อ่านวันที่ที่พิมพ์อยู่บนตัวรูปออก** จึงไม่ลงต่ำกว่า 1200px
 */

/** ด้านยาวสุดหลังย่อ · ต่ำกว่านี้วันที่บนรูปเริ่มอ่านไม่ออก */
export const MAX_EDGE = 1200;
export const JPEG_QUALITY = 0.7;

/** PNG เล็ก ๆ ปล่อยไว้อย่างนั้น — ภาพสแกนกับภาพแคปหน้าจอแปลงเป็น JPEG แล้วตัวหนังสือแตก */
const KEEP_PNG_UNDER = 1_000_000;

export interface Prepared {
  /** ชื่อไฟล์ที่จะใช้จริงในรีโป */
  name: string;
  blob: Blob;
  /** ไว้แสดงตัวอย่างบนหน้าจอ */
  previewUrl: string;
  originalSize: number;
}

/** ชื่อไฟล์ต้องเรียงได้และไม่มีอักขระที่ทำ URL พัง */
function safeName(name: string, ext?: string): string {
  const base = name
    .replace(/^.*[\\/]/, '')
    .replace(/\.[^.]+$/, '')
    .replace(/[^\w.-]+/g, '_')
    .slice(0, 80);
  return ext ? `${base}.${ext}` : name.replace(/^.*[\\/]/, '');
}

const encode = (canvas: HTMLCanvasElement, type: string, q?: number): Promise<Blob> =>
  new Promise((res, rej) =>
    canvas.toBlob((b) => (b ? res(b) : rej(new Error('เข้ารหัสรูปไม่สำเร็จ'))), type, q),
  );

export async function prepareImage(file: File): Promise<Prepared> {
  const isPng = file.type === 'image/png';

  // ต้องถอดรูปออกมาดูก่อนถึงจะรู้ขนาดจริง — ดูแค่ขนาดไฟล์ไม่พอ
  // PNG พื้นสีเรียบ 4000px บีบอัดแล้วอาจไม่ถึง 100 KB แต่ยังกว้าง 4000px อยู่ดี
  const bitmap = await createImageBitmap(file, { imageOrientation: 'from-image' });
  const longEdge = Math.max(bitmap.width, bitmap.height);

  // ภาพสแกน/ภาพแคปที่พอดีอยู่แล้ว ส่งต่อทั้งอย่างนั้น ไม่แตะ
  if (isPng && longEdge <= MAX_EDGE && file.size <= KEEP_PNG_UNDER) {
    bitmap.close();
    return {
      name: safeName(file.name),
      blob: file,
      previewUrl: URL.createObjectURL(file),
      originalSize: file.size,
    };
  }

  const scale = Math.min(1, MAX_EDGE / longEdge);
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);

  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('เบราว์เซอร์นี้วาด canvas ไม่ได้');

  // ทาพื้นขาวก่อนเสมอ · ถ้าต้นฉบับมีส่วนโปร่งใสแล้วออกเป็น JPEG
  // ส่วนโปร่งใสจะกลายเป็นสีดำสนิท
  ctx.fillStyle = '#ffffff';
  ctx.fillRect(0, 0, w, h);
  ctx.drawImage(bitmap, 0, 0, w, h);
  bitmap.close();

  const jpeg = await encode(canvas, 'image/jpeg', JPEG_QUALITY);

  // PNG ที่เข้ามามักเป็นภาพสแกนหรือภาพแคปที่มีตัวหนังสือ แปลงเป็น JPEG แล้วขอบอักษรแตก
  // จึงลองเข้ารหัสทั้งสองแบบแล้วเลือกอันที่เล็กกว่า —
  // ภาพตัวหนังสือ PNG จะชนะเอง ส่วนรูปถ่ายที่บังเอิญเป็น PNG จะตกไปเป็น JPEG
  if (isPng) {
    const png = await encode(canvas, 'image/png');
    if (png.size <= jpeg.size) {
      return {
        name: safeName(file.name, 'png'),
        blob: png,
        previewUrl: URL.createObjectURL(png),
        originalSize: file.size,
      };
    }
  }

  return {
    name: safeName(file.name, 'jpg'),
    blob: jpeg,
    previewUrl: URL.createObjectURL(jpeg),
    originalSize: file.size,
  };
}

/** ไบต์ → ข้อความอ่านง่าย */
export const humanSize = (n: number): string =>
  n >= 1_000_000 ? `${(n / 1_000_000).toFixed(1)} MB` : `${Math.round(n / 1000)} KB`;
