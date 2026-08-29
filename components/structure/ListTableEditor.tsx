'use client';

import type { ListCell, ListColumn } from '@/shared/schema';
import { freeColumnKey, type RawBlock } from '@/lib/structure';
import { IconDown, IconLeft, IconPlus, IconRight, IconTrash, IconUp } from '@/components/ui/icons';

type Row = Record<string, ListCell>;

const KINDS = [
  { value: 'text', label: 'ข้อความ / ตัวเลข' },
  { value: 'months', label: 'แถบ 12 เดือน' },
] as const;

/** แก้คอลัมน์และแถวของตารางรายการ — ทั้งหมดเก็บลง config ไม่มีอะไร hardcode ในโค้ด */
export function ListTableEditor({
  block,
  onChange,
}: {
  block: RawBlock;
  onChange: (patch: Partial<RawBlock>) => void;
}) {
  const columns = (block.columns as ListColumn[] | undefined) ?? [];
  const rows = (block.rows as Row[] | undefined) ?? [];

  const setColumns = (c: ListColumn[]) => onChange({ columns: c });
  const setRows = (r: Row[]) => onChange({ rows: r });

  const patchCol = (i: number, p: Partial<ListColumn>) =>
    setColumns(columns.map((c, k) => (k === i ? { ...c, ...p } : c)));

  const addColumn = () =>
    setColumns([...columns, { key: freeColumnKey(columns), label: 'คอลัมน์ใหม่' }]);

  const removeColumn = (i: number) => {
    const gone = columns[i].key;
    setColumns(columns.filter((_, k) => k !== i));
    // ทิ้งค่าของคอลัมน์ที่ลบออกจากทุกแถวด้วย ไม่งั้นเหลือค้างในไฟล์แบบมองไม่เห็น
    setRows(
      rows.map((r) => {
        const next = { ...r };
        delete next[gone];
        return next;
      }),
    );
  };

  const moveColumn = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= columns.length) return;
    const next = [...columns];
    [next[i], next[j]] = [next[j], next[i]];
    setColumns(next);
  };

  const addRow = () => setRows([...rows, Object.fromEntries(columns.map((c) => [c.key, null]))]);

  /** แถวที่ยังไม่ได้กรอกอะไรเลย ลบทิ้งไม่มีอะไรเสียหาย */
  const rowIsEmpty = (r: Row) =>
    Object.values(r).every((v) => v === null || (!Array.isArray(v) && String(v).trim() === ''));

  const removeRow = (i: number) => {
    // ปุ่มลบอยู่ติดกับปุ่มเลื่อน กดพลาดได้ง่าย · แถวหนึ่งคือข้อมูลทั้งบรรทัด ไม่ใช่ช่องเดียว
    if (!rowIsEmpty(rows[i]) && !confirm(`ลบแถวที่ ${i + 1} ทั้งแถวออกจากตาราง?`)) return;
    setRows(rows.filter((_, k) => k !== i));
  };
  const moveRow = (i: number, d: number) => {
    const j = i + d;
    if (j < 0 || j >= rows.length) return;
    const next = [...rows];
    [next[i], next[j]] = [next[j], next[i]];
    setRows(next);
  };
  const setCell = (i: number, key: string, v: ListCell) =>
    setRows(rows.map((r, k) => (k === i ? { ...r, [key]: v } : r)));

  return (
    <div className="mt-3 rounded-xl border border-edge bg-surface-2 p-3">
      {/* ---------- คอลัมน์ ---------- */}
      <p className="text-sm font-medium">คอลัมน์</p>
      {columns.length === 0 && (
        <p className="mt-1 text-xs text-muted">
          ยังไม่มีคอลัมน์ — ตารางนี้จะขึ้นเป็นช่องว่างบนสไลด์จนกว่าจะเพิ่ม
        </p>
      )}

      <ul className="mt-2 space-y-1.5">
        {columns.map((c, i) => (
          <li key={c.key} className="flex flex-wrap items-center gap-1.5 text-sm">
            <input
              value={c.label}
              onChange={(e) => patchCol(i, { label: e.target.value })}
              placeholder="ชื่อคอลัมน์"
              aria-label="ชื่อคอลัมน์"
              className="field h-8 min-w-0 flex-1 py-1"
            />
            <select
              value={c.kind ?? 'text'}
              onChange={(e) => patchCol(i, { kind: e.target.value as ListColumn['kind'] })}
              aria-label="ชนิดของคอลัมน์"
              className="field h-8 w-auto px-1.5 py-1 text-xs"
            >
              {KINDS.map((k) => (
                <option key={k.value} value={k.value}>
                  {k.label}
                </option>
              ))}
            </select>
            <input
              type="number"
              min={3}
              max={60}
              value={c.width ?? ''}
              onChange={(e) =>
                patchCol(i, { width: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="กว้าง%"
              aria-label="ความกว้างคอลัมน์ เป็นเปอร์เซ็นต์"
              className="field h-8 w-20 px-1.5 py-1 text-xs"
            />
            <label
              className="flex cursor-pointer items-center gap-1 text-xs text-muted"
              title="รวมช่องที่ค่าซ้ำกันติดกัน"
            >
              <input
                type="checkbox"
                className="h-3.5 w-3.5 accent-[var(--ui-primary)]"
                checked={Boolean(c.merge)}
                onChange={(e) => patchCol(i, { merge: e.target.checked || undefined })}
              />
              รวมช่อง
            </label>
            <button
              onClick={() => moveColumn(i, -1)}
              disabled={i === 0}
              aria-label={`เลื่อนคอลัมน์ ${c.label} ไปทางซ้าย`}
              className="btn btn-outline btn-sm w-8 px-0"
            >
              <IconLeft className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => moveColumn(i, 1)}
              disabled={i === columns.length - 1}
              aria-label={`เลื่อนคอลัมน์ ${c.label} ไปทางขวา`}
              className="btn btn-outline btn-sm w-8 px-0"
            >
              <IconRight className="h-3.5 w-3.5" />
            </button>
            <button
              onClick={() => removeColumn(i)}
              aria-label={`ลบคอลัมน์ ${c.label}`}
              className="btn btn-danger btn-sm"
            >
              <IconTrash className="h-3.5 w-3.5" />
              ลบ
            </button>
          </li>
        ))}
      </ul>

      <button onClick={addColumn} className="btn btn-dashed btn-sm mt-2">
        <IconPlus className="h-3.5 w-3.5" />
        เพิ่มคอลัมน์
      </button>

      {/* ---------- แถว ---------- */}
      {columns.length > 0 && (
        <>
          <p className="mt-4 text-sm font-medium">แถว ({rows.length})</p>
          <div className="mt-2 overflow-x-auto rounded-lg border border-edge">
            <table className="w-full min-w-[560px] border-collapse text-xs">
              <thead>
                <tr className="bg-primary text-on-primary">
                  <th className="w-28 border border-edge px-1 py-1.5">ลำดับ</th>
                  {columns.map((c) => (
                    <th key={c.key} className="border border-edge px-1.5 py-1.5 text-left">
                      {c.label}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {rows.map((r, i) => (
                  <tr key={i} className="even:bg-surface-2/60">
                    <td className="border border-edge px-1 py-1 whitespace-nowrap">
                      {/* ปุ่มไอคอนล้วนต้องไม่เล็กกว่า 24px — ของเดิม 22x14 กดพลาดง่าย
                          และปุ่มที่กดพลาดคือปุ่มลบทั้งแถว */}
                      <span className="flex items-center gap-0.5">
                        <button
                          onClick={() => moveRow(i, -1)}
                          disabled={i === 0}
                          aria-label={`เลื่อนแถวที่ ${i + 1} ขึ้น`}
                          className="btn btn-quiet btn-sm w-7 px-0"
                        >
                          <IconUp className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => moveRow(i, 1)}
                          disabled={i === rows.length - 1}
                          aria-label={`เลื่อนแถวที่ ${i + 1} ลง`}
                          className="btn btn-quiet btn-sm w-7 px-0"
                        >
                          <IconDown className="h-3.5 w-3.5" />
                        </button>
                        <button
                          onClick={() => removeRow(i)}
                          aria-label={`ลบแถวที่ ${i + 1}`}
                          className="btn btn-quiet btn-sm w-7 px-0 text-danger-ink"
                        >
                          <IconTrash className="h-3.5 w-3.5" />
                        </button>
                      </span>
                    </td>
                    {columns.map((c) => {
                      const v = r[c.key] ?? null;
                      if (c.kind === 'months') {
                        const range = Array.isArray(v) ? v : [1, 12];
                        return (
                          <td key={c.key} className="border border-edge px-1.5 py-1">
                            <span className="flex items-center gap-1">
                              <input
                                type="number"
                                min={1}
                                max={12}
                                value={range[0]}
                                aria-label={`${c.label} เดือนเริ่ม`}
                                onChange={(e) => setCell(i, c.key, [Number(e.target.value), range[1]])}
                                className="field w-14 px-1 py-1 text-xs"
                              />
                              <span aria-hidden="true">–</span>
                              <input
                                type="number"
                                min={1}
                                max={12}
                                value={range[1]}
                                aria-label={`${c.label} เดือนจบ`}
                                onChange={(e) => setCell(i, c.key, [range[0], Number(e.target.value)])}
                                className="field w-14 px-1 py-1 text-xs"
                              />
                            </span>
                          </td>
                        );
                      }
                      return (
                        <td key={c.key} className="border border-edge px-1.5 py-1">
                          <input
                            value={v === null ? '' : String(v)}
                            aria-label={`${c.label} แถวที่ ${i + 1}`}
                            onChange={(e) => setCell(i, c.key, e.target.value || null)}
                            className="field w-full min-w-24 px-1 py-1 text-xs"
                          />
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <button onClick={addRow} className="btn btn-dashed btn-sm mt-2">
            <IconPlus className="h-3.5 w-3.5" />
            เพิ่มแถว
          </button>

          <label className="mt-3 flex flex-wrap items-center gap-2 text-xs text-muted">
            แถวต่อหนึ่งหน้า
            <input
              type="number" min={1} max={40}
              value={(block.rowsPerSlide as number | undefined) ?? ''}
              onChange={(e) =>
                onChange({ rowsPerSlide: e.target.value ? Number(e.target.value) : undefined })
              }
              placeholder="9"
              className="field h-8 w-16 px-1.5 py-1 text-xs"
            />
            <span>เกินกว่านี้ขึ้นหน้าใหม่ · ว่างไว้ = 9</span>
          </label>
        </>
      )}
    </div>
  );
}
