'use client';

import { useEffect, useMemo, useRef, useState } from 'react';
import Link from 'next/link';
import roundConfig from '@/config/round.json';
import { buildSections, type RawConfig } from '@/lib/deck';
import {
  buildEntrySections,
  countCells,
  entrySections,
  monthIndex,
  monthLabel,
  prevMonthLabel,
} from '@/lib/entry';
import { formatJsonFile } from '@/lib/jsonFormat';
import { UNITS, formatCell, type Cell, type UnitKey } from '@/shared/schema';
import { readJsonFile } from '@/lib/github';
import { useToken } from '@/lib/useToken';
import { CommitPanel } from '@/components/arrange/CommitPanel';

const STORAGE = `entry:${roundConfig.year}-${roundConfig.month}`;
const CONFIG_PATH = 'config/sections.json';

/** คีย์ของช่องหนึ่งช่อง */
const cellKey = (blockId: string, rowKey: string) => `${blockId}.${rowKey}`;

/** แถวที่ผู้ใช้เพิ่มเองจากหน้าเว็บ ยังไม่ได้อยู่ใน sections.json */
interface NewRow {
  key: string;
  label: string;
  unit: UnitKey;
}

interface Draft {
  edits: Record<string, Cell>;
  added: Record<string, NewRow[]>;
}

const UNIT_KEYS = Object.keys(UNITS) as UnitKey[];

/**
 * ปีหนึ่งมี 12 เดือนเสมอ แถวใหม่จึงเกิดมาพร้อมช่องครบ 12 ช่องได้เลย
 * ไม่ต้องถามใครว่าตารางกว้างเท่าไร
 */
const emptyYear = (): Cell[] => Array<Cell>(12).fill(null);

/** คีย์ `custom-N` ตัวแรกที่ยังว่างในชุดที่ให้มา */
function nextCustomKey(taken: ReadonlySet<string>): string {
  let n = 1;
  while (taken.has(`custom-${n}`)) n += 1;
  return `custom-${n}`;
}

/** ปุ่มเพิ่มรายการของตารางหนึ่งตาราง */
function AddRowForm({
  defaultUnit,
  onAdd,
}: {
  defaultUnit: UnitKey;
  onAdd: (label: string, unit: UnitKey) => void;
}) {
  const [open, setOpen] = useState(false);
  const [label, setLabel] = useState('');
  const [unit, setUnit] = useState<UnitKey>(defaultUnit);

  if (!open) {
    return (
      <button
        onClick={() => setOpen(true)}
        className="mt-2 rounded border border-dashed border-line px-3 py-1.5 text-sm text-ink-soft hover:border-brand hover:text-brand"
      >
        + เพิ่มรายการ
      </button>
    );
  }

  const submit = () => {
    const name = label.trim();
    if (!name) return;
    onAdd(name, unit);
    setLabel('');
    setOpen(false);
  };

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-brand bg-brand-soft/40 p-2">
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="ชื่อรายการใหม่"
        className="min-w-0 flex-1 rounded border border-line px-2 py-1 text-sm"
      />
      <select
        value={unit}
        onChange={(e) => setUnit(e.target.value as UnitKey)}
        className="shrink-0 rounded border border-line bg-white px-2 py-1 text-sm"
      >
        {UNIT_KEYS.map((u) => (
          <option key={u} value={u}>
            {UNITS[u].label}
          </option>
        ))}
      </select>
      <button
        onClick={submit}
        disabled={!label.trim()}
        className="shrink-0 rounded bg-brand px-3 py-1 text-sm font-semibold text-white disabled:opacity-40"
      >
        เพิ่ม
      </button>
      <button
        onClick={() => {
          setOpen(false);
          setLabel('');
        }}
        className="shrink-0 rounded border border-line px-3 py-1 text-sm text-ink-soft"
      >
        ยกเลิก
      </button>
    </div>
  );
}

/**
 * ข้อความที่พิมพ์ในช่อง → ค่าที่เก็บจริง
 * ว่าง = ยังไม่กรอก · ปุ่ม "ไม่มีรายการ" = 'none' · ที่เหลือเป็นตัวเลข
 */
function parseCell(text: string): Cell {
  const t = text.trim().replace(/,/g, '');
  if (t === '') return null;
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

export default function EditPage() {
  // เก็บเฉพาะช่องที่แก้ ไม่ใช่ทั้ง config — กันเผลอทับส่วนอื่นของไฟล์
  const [edits, setEdits] = useState<Record<string, Cell>>({});
  const [added, setAdded] = useState<Record<string, NewRow[]>>({});
  const [text, setText] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  /** sections.json ตัวปัจจุบันในรีโป — null = ยังไม่ได้ดึง หรือดึงไม่ได้ */
  const [live, setLive] = useState<RawConfig | null>(null);
  const [liveNote, setLiveNote] = useState('');
  /** ขยับเลขนี้เพื่อสั่งดึงของสดใหม่ เช่นหลังส่งสำเร็จ */
  const [reload, setReload] = useState(0);
  /**
   * คีย์แถวที่เพิ่งส่งไปในเซสชันนี้ · GitHub แคช contents API ได้ราวหนึ่งนาที
   * ดึงของสดทันทีหลังส่งจึงอาจยังไม่เห็นแถวที่เพิ่งเพิ่ม — จำไว้เองกันคีย์ชนซ้ำ
   */
  const [sentKeys, setSentKeys] = useState<Record<string, string[]>>({});

  const token = useToken();
  /** คีย์ที่ getFiles เพิ่งเขียนลงไปจริง — onDone หยิบไปจำต่อ กันรอบหน้าตั้งคีย์ซ้ำ */
  const pendingKeys = useRef<Record<string, string[]>>({});

  /**
   * ดึงของสดตั้งแต่เปิดหน้า ไม่ใช่แค่ตอนกดส่ง (CLAUDE.md กฎข้อ 4)
   * เว็บเป็นไฟล์นิ่ง ค่าที่ฝังมาจึงเก่าได้ถึงหนึ่งรอบ build — ถ้าหน้ายืนบนค่าเก่า
   * ตัวเตือน "กำลังลบตัวเลขเดิม" จะเทียบผิดฐาน และคีย์แถวใหม่จะชนของที่มีอยู่แล้ว
   */
  useEffect(() => {
    if (!token) {
      setLive(null);
      setLiveNote('');
      return;
    }
    let cancelled = false;
    readJsonFile<RawConfig>(token, CONFIG_PATH)
      .then((cfg) => {
        if (cancelled) return;
        if (cfg) {
          setLive(cfg);
          setLiveNote('');
        } else {
          setLiveNote(`ไม่พบ ${CONFIG_PATH} ในรีโป — ค่าที่เห็นเป็นของตอน build ล่าสุด`);
        }
      })
      .catch((e: unknown) => {
        if (cancelled) return;
        const why = e instanceof Error ? e.message : '';
        setLiveNote(`ดึงข้อมูลล่าสุดจาก GitHub ไม่ได้ — ค่าที่เห็นเป็นของตอน build ล่าสุด${why ? ` (${why})` : ''}`);
      });
    return () => {
      cancelled = true;
    };
  }, [token, reload]);

  /**
   * รายการช่องที่แสดงบนหน้า — ประกอบจากของสดถ้าดึงได้ ไม่งั้นใช้ค่าตอน build
   * ประกอบจากของสดทั้งก้อน ไม่ใช่เอาของสดมาทาบเฉพาะค่า เพราะ **คีย์แถว** ก็ต้องสดด้วย
   */
  const view = useMemo(
    () => (live ? buildEntrySections(buildSections(live)) : entrySections),
    [live],
  );

  const totalCells = useMemo(() => countCells(view), [view]);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw) as Draft | Record<string, Cell>;
        // งานค้างที่เก็บไว้ก่อนมีปุ่มเพิ่มรายการเป็นแค่ก้อน edits เปล่า ๆ
        const draft: Draft =
          parsed && typeof parsed === 'object' && 'edits' in parsed
            ? (parsed as Draft)
            : { edits: parsed as Record<string, Cell>, added: {} };
        setEdits(draft.edits ?? {});
        setAdded(draft.added ?? {});
        setText(
          Object.fromEntries(
            Object.entries(draft.edits ?? {}).map(([k, v]) => [
              k,
              typeof v === 'number' ? String(v) : '',
            ]),
          ),
        );
      }
    } catch {
      /* เบราว์เซอร์ปิด storage — กรอกใหม่ทุกครั้งแทน */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ edits, added } satisfies Draft));
    } catch {
      /* ไม่เป็นไร */
    }
  }, [edits, added, loaded]);

  const valueOf = (blockId: string, rowKey: string, fallback: Cell): Cell => {
    const k = cellKey(blockId, rowKey);
    return k in edits ? edits[k] : fallback;
  };

  const setCell = (blockId: string, rowKey: string, v: Cell) =>
    setEdits((p) => ({ ...p, [cellKey(blockId, rowKey)]: v }));

  /**
   * คีย์ที่ยังไม่ถูกใช้ในตารางนี้
   * รวมสามทาง: แถวที่เห็นอยู่ (สดถ้าดึงได้) · แถวที่เพิ่งเพิ่มแต่ยังไม่ส่ง · แถวที่ส่งไปแล้วเซสชันนี้
   */
  function freeKey(blockId: string, existing: string[]): string {
    return nextCustomKey(
      new Set([
        ...existing,
        ...(added[blockId] ?? []).map((r) => r.key),
        ...(sentKeys[blockId] ?? []),
      ]),
    );
  }

  const addRow = (blockId: string, row: NewRow) =>
    setAdded((p) => ({ ...p, [blockId]: [...(p[blockId] ?? []), row] }));

  const removeRow = (blockId: string, key: string) => {
    setAdded((p) => ({ ...p, [blockId]: (p[blockId] ?? []).filter((r) => r.key !== key) }));
    setEdits((p) => {
      const next = { ...p };
      delete next[cellKey(blockId, key)];
      return next;
    });
  };

  const filled = useMemo(() => {
    let n = 0;
    for (const s of view)
      for (const b of s.blocks)
        for (const r of b.rows) if (valueOf(b.blockId, r.rowKey, r.current) !== null) n += 1;
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits, view]);

  /**
   * ประกอบ sections.json ใหม่โดยแตะเฉพาะช่องของเดือนนี้
   * `base` ต้องเป็นไฟล์**ตัวปัจจุบันในรีโป** ไม่ใช่ตัวที่ฝังมาตอน build
   * ไม่งั้นจะเขียนทับสิ่งที่คนอื่นเพิ่งส่งไปโดยไม่รู้ตัว
   */
  const applyTo = (base: RawConfig) => {
    const clone = JSON.parse(JSON.stringify(base)) as RawConfig;
    const usedKeys: Record<string, string[]> = {};

    for (const section of clone.sections as unknown as Array<{
      blocks: Array<Record<string, unknown>>;
    }>) {
      for (const block of section.blocks) {
        if (block.type !== 'monthly-matrix') continue;
        const rows = block.rows as Array<Record<string, unknown>> | undefined;
        if (!rows) continue;
        const id = block.id as string;

        for (const row of rows) {
          const k = cellKey(id, row.key as string);
          if (k in edits) (row.values as Cell[])[monthIndex] = edits[k];
        }

        // แถวที่เพิ่มจากหน้าเว็บต่อท้ายตาราง พร้อมช่องครบ 12 เดือน
        const taken = new Set(rows.map((r) => r.key as string));
        for (const nr of added[id] ?? []) {
          // ตาข่ายกันคีย์ชน — ของสดอาจมี custom-N ตัวนั้นอยู่แล้วโดยที่หน้ายังไม่เห็น
          // ปล่อยให้ชนแปลว่าสองแถวใช้คีย์เดียวกันตลอดไป แก้ช่องเดียวเขียนลงทั้งคู่
          const key = taken.has(nr.key) ? nextCustomKey(taken) : nr.key;
          taken.add(key);
          (usedKeys[id] ??= []).push(key);

          const values = emptyYear();
          const k = cellKey(id, nr.key);
          if (k in edits) values[monthIndex] = edits[k];
          rows.push({ key, label: nr.label, unit: nr.unit, values });
        }
      }
    }
    return { clone, usedKeys };
  };

  const addedCount = Object.values(added).reduce((n, a) => n + a.length, 0);
  const changedCount = Object.keys(edits).length + addedCount;

  /**
   * ช่องที่เคยมีตัวเลขอยู่แล้วแต่กำลังจะกลายเป็นว่าง
   * เผลอกด Backspace ทีเดียวก็ลบข้อมูลย้อนหลังหายได้ และเดิมไม่มีอะไรเตือน
   */
  const erasing = useMemo(() => {
    const out: Array<{ blockId: string; rowKey: string; label: string; was: number }> = [];
    for (const s of view)
      for (const b of s.blocks)
        for (const r of b.rows) {
          const k = cellKey(b.blockId, r.rowKey);
          if (!(k in edits)) continue;
          if (typeof r.current === 'number' && edits[k] === null) {
            out.push({ blockId: b.blockId, rowKey: r.rowKey, label: r.label, was: r.current });
          }
        }
    return out;
  }, [edits, view]);

  const isErasing = (blockId: string, rowKey: string) =>
    erasing.some((e) => e.blockId === blockId && e.rowKey === rowKey);

  /** เรียกตอนกดส่งเท่านั้น — อ่านของสดก่อน แล้วค่อยทาบสิ่งที่แก้ลงไป */
  const getFiles = async (t: string) => {
    const current = await readJsonFile<RawConfig>(t, CONFIG_PATH);
    // อ่านไม่เจอแล้วถอยไปใช้ค่าตอน build = ย้อนทั้งไฟล์กลับไปหนึ่งรอบ build เงียบ ๆ
    // ยอมให้ส่งไม่สำเร็จดีกว่ากลบงานของคนอื่น
    if (!current) {
      throw new Error(
        `อ่าน ${CONFIG_PATH} จากรีโปไม่ได้ — ยกเลิกการส่ง ไม่งั้นจะเขียนทับด้วยข้อมูลเก่าตอน build`,
      );
    }
    const { clone, usedKeys } = applyTo(current);
    pendingKeys.current = usedKeys;
    return [{ path: CONFIG_PATH, content: formatJsonFile(clone as never) }];
  };

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/" className="text-brand hover:underline">
        ← สารบัญ
      </Link>
      <h1 className="mt-3 text-2xl font-bold text-brand-deep">
        กรอกตัวเลขเดือน {monthLabel} {roundConfig.year}
      </h1>
      <p className="mt-2 text-sm text-ink-soft">
        ทุกตารางในเด็ครวมอยู่ในหน้านี้หน้าเดียว · เดือนหนึ่งกรอกช่องเดียวต่อแถว
        <br />
        ช่องว่าง = ยังไม่กรอก · กด <b>ไม่มีรายการ</b> เมื่อเดือนนี้ไม่มีรายการนั้นจริง ๆ
        (สไลด์จะขึ้น <span className="font-mono">-</span> แทนที่จะปล่อยว่าง)
        <br />
        มีรายการใหม่ที่ยังไม่มีในตาราง กด <b>+ เพิ่มรายการ</b> ท้ายตารางนั้นได้เลย
        ระบบเปิดช่องให้ครบ 12 เดือนเอง
      </p>

      {!token && (
        <p className="mt-4 rounded bg-amber-50 px-4 py-2.5 text-sm text-amber-800">
          <b>ยังไม่ได้ใส่โทเคน</b> — ค่าที่เห็นเป็นของตอน build ล่าสุด
          ตัวเตือนตอนกำลังลบตัวเลขเดิมจึงอาจไม่ครบ
          <br />
          ใส่โทเคนในช่องท้ายหน้าแล้วกดออกจากช่อง หน้านี้จะดึงค่าล่าสุดจากรีโปมาให้เอง
        </p>
      )}

      {liveNote && (
        <p className="mt-4 rounded bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{liveNote}</p>
      )}

      {live && (
        <p className="mt-4 rounded bg-brand-soft px-4 py-2.5 text-sm text-ink-soft">
          ค่าที่เห็นเป็น<b>ของล่าสุดในรีโป</b>แล้ว ไม่ต้องรอเว็บ build ใหม่
        </p>
      )}

      <p className="mt-4 rounded bg-brand-soft px-4 py-2.5 text-sm">
        กรอกแล้ว <b>{filled}</b> จาก {totalCells} ช่อง
        {Object.keys(edits).length > 0 && <> · แก้ในรอบนี้ {Object.keys(edits).length} ช่อง</>}
        {addedCount > 0 && (
          <span className="font-medium text-accent"> · เพิ่มรายการใหม่ {addedCount} รายการ</span>
        )}
      </p>

      {view.map((s) => (
        <section key={s.key} className="mt-8">
          <h2 className="border-b border-line pb-1.5 text-lg font-semibold">
            <span className="font-mono text-brand">{s.number}</span> {s.title}
          </h2>

          {s.blocks.map((b) => (
            <div key={b.blockId} className="mt-4">
              <h3 className="text-sm font-medium text-ink-soft">{b.title}</h3>

              <ul className="mt-2 divide-y divide-line">
                {[
                  ...b.rows.map((r) => ({ ...r, isNew: false })),
                  // แถวที่เพิ่งเพิ่มต่อท้าย ยังไม่มีค่าเดือนก่อนให้เทียบ
                  ...(added[b.blockId] ?? []).map((nr) => ({
                    blockId: b.blockId,
                    rowKey: nr.key,
                    label: nr.label,
                    unit: nr.unit,
                    unitLabel: UNITS[nr.unit].label,
                    current: null as Cell,
                    previous: null as Cell,
                    note: undefined as string | undefined,
                    isNew: true,
                  })),
                ].map((r) => {
                  const k = cellKey(b.blockId, r.rowKey);
                  const v = valueOf(b.blockId, r.rowKey, r.current);
                  const isNone = v === 'none';
                  return (
                    <li key={r.rowKey} className="flex flex-wrap items-center gap-2 py-2">
                      <span className="min-w-0 flex-1 text-sm">
                        {r.label}
                        {r.isNew && (
                          <span className="ml-1.5 rounded bg-accent px-1.5 py-0.5 text-[10px] font-semibold text-ink">
                            ใหม่
                          </span>
                        )}
                        {r.note && (
                          <span className="ml-1 text-xs text-accent" title={r.note}>
                            *
                          </span>
                        )}
                      </span>

                      {prevMonthLabel && (
                        <span className="w-28 shrink-0 text-right font-mono text-xs text-ink-soft">
                          {r.isNew ? '' : `${prevMonthLabel} ${formatCell(r.previous, r.unit) || '—'}`}
                        </span>
                      )}

                      <input
                        inputMode="decimal"
                        disabled={isNone}
                        value={isNone ? '' : (text[k] ?? (typeof v === 'number' ? String(v) : ''))}
                        onChange={(e) => {
                          setText((p) => ({ ...p, [k]: e.target.value }));
                          setCell(b.blockId, r.rowKey, parseCell(e.target.value));
                        }}
                        placeholder="—"
                        className={`w-28 shrink-0 rounded border px-2 py-1 text-right font-mono text-sm tabular-nums disabled:bg-neutral-100 ${
                          isErasing(b.blockId, r.rowKey)
                            ? 'border-red-500 bg-red-50'
                            : 'border-line'
                        }`}
                      />

                      {isErasing(b.blockId, r.rowKey) && (
                        <span className="shrink-0 text-xs font-medium text-red-600">
                          กำลังลบ {formatCell(r.current, r.unit)}
                        </span>
                      )}

                      <span className="w-16 shrink-0 text-xs text-ink-soft">{r.unitLabel}</span>

                      <button
                        onClick={() => {
                          setCell(b.blockId, r.rowKey, isNone ? null : 'none');
                          if (!isNone) setText((p) => ({ ...p, [k]: '' }));
                        }}
                        className={`shrink-0 rounded border px-2 py-1 text-xs ${
                          isNone
                            ? 'border-brand bg-brand text-white'
                            : 'border-line text-ink-soft hover:bg-neutral-50'
                        }`}
                      >
                        ไม่มีรายการ
                      </button>

                      {/* ลบได้เฉพาะแถวที่ยังไม่ได้ส่ง — แถวเดิมมีข้อมูลย้อนหลังอยู่ ลบทิ้งไม่ได้จากหน้านี้ */}
                      {r.isNew && (
                        <button
                          onClick={() => removeRow(b.blockId, r.rowKey)}
                          className="shrink-0 rounded border border-line px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                          aria-label={`ลบ ${r.label}`}
                        >
                          ลบ
                        </button>
                      )}
                    </li>
                  );
                })}
              </ul>

              <AddRowForm
                defaultUnit={b.rows[0]?.unit ?? 'baht'}
                onAdd={(label, unit) =>
                  addRow(b.blockId, {
                    key: freeKey(b.blockId, b.rows.map((r) => r.rowKey)),
                    label,
                    unit,
                  })
                }
              />
            </div>
          ))}
        </section>
      ))}

      {erasing.length > 0 && (
        <div className="mt-8 rounded border-2 border-red-500 bg-red-50 p-4">
          <p className="font-semibold text-red-700">
            ระวัง — กำลังลบตัวเลขเดิมทิ้ง {erasing.length} ช่อง
          </p>
          <ul className="mt-2 space-y-1 text-sm text-red-700">
            {erasing.map((e) => (
              <li key={`${e.blockId}.${e.rowKey}`}>
                {e.label} · เดิม <b>{e.was.toLocaleString('en-US')}</b> → ว่าง
              </li>
            ))}
          </ul>
          <p className="mt-2 text-sm text-red-700">
            ถ้าไม่ได้ตั้งใจ ให้พิมพ์ตัวเลขเดิมกลับเข้าไป · ถ้าตั้งใจว่าเดือนนี้ไม่มีรายการ
            ให้กด <b>ไม่มีรายการ</b> แทนการปล่อยว่าง
          </p>
        </div>
      )}

      <CommitPanel
        count={changedCount ? 1 : 0}
        getFiles={getFiles}
        message={`Fill ${monthLabel} ${roundConfig.year} figures (${changedCount} cells)`}
        disabled={changedCount === 0}
        onDone={() => {
          // จำคีย์ที่เพิ่งส่งไว้ก่อน — ของสดรอบหน้าอาจยังไม่ทันเห็นแถวเหล่านี้
          setSentKeys((p) => {
            const next = { ...p };
            for (const [id, keys] of Object.entries(pendingKeys.current)) {
              next[id] = [...(next[id] ?? []), ...keys];
            }
            return next;
          });
          // ต้องล้าง added ด้วย ไม่งั้นกดส่งซ้ำจะเขียนแถวนั้นกลับเป็นว่างทั้ง 12 เดือน
          setEdits({});
          setAdded({});
          setText({});
          // ดึงของสดใหม่ทันที ผู้ใช้จะได้เห็นผลโดยไม่ต้องรอเว็บ build ใหม่
          setReload((n) => n + 1);
          try {
            localStorage.removeItem(STORAGE);
          } catch {
            /* ไม่เป็นไร */
          }
        }}
      />
    </main>
  );
}
