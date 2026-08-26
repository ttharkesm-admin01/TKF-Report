/**
 * jsonFormat.ts — เขียน JSON กลับเป็นไฟล์ให้คนอ่านรู้เรื่อง
 *
 * `JSON.stringify(x, null, 2)` จะกาง `values` ที่มี 12 ช่องออกเป็น 12 บรรทัด
 * `sections.json` จะยาวขึ้นสามเท่าและดู diff ไม่รู้เรื่อง
 * ตัวนี้คงแถวตัวเลขไว้ในบรรทัดเดียวเหมือนที่เขียนมือไว้แต่แรก
 */

type Json = null | boolean | number | string | Json[] | { [k: string]: Json };

const isPrimitive = (v: Json) =>
  v === null || typeof v === 'number' || typeof v === 'string' || typeof v === 'boolean';

export function formatJson(value: Json, indent = 0): string {
  const pad = '  '.repeat(indent);
  const padIn = '  '.repeat(indent + 1);

  if (Array.isArray(value)) {
    if (value.length === 0) return '[]';
    // แถวตัวเลขอยู่บรรทัดเดียว — อ่านง่ายกว่าและ diff ตรงจุดที่แก้จริง
    if (value.every(isPrimitive)) return `[${value.map((v) => JSON.stringify(v)).join(',')}]`;
    const items = value.map((v) => padIn + formatJson(v, indent + 1));
    return `[\n${items.join(',\n')}\n${pad}]`;
  }

  if (value && typeof value === 'object') {
    const keys = Object.keys(value);
    if (keys.length === 0) return '{}';

    const items = keys.map((k) => `${JSON.stringify(k)}: ${formatJson(value[k], indent + 1)}`);

    // ก้อนที่ข้างในไม่มีก้อนซ้อนอีก (แถวตาราง, คอลัมน์, layout) อยู่บรรทัดเดียว
    // เขียนแบบนี้เหมือนที่ไล่เขียนมือไว้แต่แรก · แก้ค่าทีหนึ่ง diff จึงมีบรรทัดเดียว
    // ไม่ใช่ทั้งไฟล์กลายเป็นสีแดงเพราะจัดรูปแบบใหม่หมด
    const flat = keys.every((k) => {
      const v = value[k];
      if (isPrimitive(v)) return true;
      return Array.isArray(v) && v.every(isPrimitive);
    });
    if (flat) return `{ ${items.join(', ')} }`;

    return `{\n${items.map((s) => padIn + s).join(',\n')}\n${pad}}`;
  }

  return JSON.stringify(value);
}

export const formatJsonFile = (value: Json): string => formatJson(value) + '\n';
