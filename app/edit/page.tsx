'use client';

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import roundConfig from '@/config/round.json';
import { buildSections, type RawConfig } from '@/lib/deck';
import {
  buildEntrySections,
  buildTextEntries,
  entrySections,
  monthIndex,
  rowRange,
  type EntryRow,
  textEntries,
  type EntrySection,
} from '@/lib/entry';
import { fitBody, parseBody } from '@/lib/text';
import { formatJsonFile } from '@/lib/jsonFormat';
import {
  MONTHS,
  MONTHS_SHORT,
  UNITS,
  formatCell,
  type Cell,
  type UnitKey,
} from '@/shared/schema';
import { readJsonFile } from '@/lib/github';
import { useToken } from '@/lib/useToken';
import { CommitPanel } from '@/components/arrange/CommitPanel';
import { SiteNav } from '@/components/nav/SiteNav';

/**
 * งานค้างเก็บทั้งปีในกุญแจเดียว — ของเดิมแยกตามเดือนของรอบ
 * เพราะหน้านี้แก้ได้แค่เดือนเดียว ตอนนี้แก้ได้ทั้ง 12 เดือนแล้วจึงรวมเป็นก้อนเดียว
 */
const STORAGE = `entry:${roundConfig.year}`;
const LEGACY_STORAGE = `entry:${roundConfig.year}-${roundConfig.month}`;
const CONFIG_PATH = 'config/sections.json';

/** คีย์ของช่องหนึ่งช่อง — ตาราง · แถว · เดือน */
const cellKey = (blockId: string, rowKey: string, month: number) =>
  `${blockId}.${rowKey}.${month}`;

/** เดือนของคีย์ · เลขเดือนอยู่หลังจุดตัวสุดท้ายเสมอ */
const monthOfKey = (k: string) => Number(k.slice(k.lastIndexOf('.') + 1));

/** แถวที่ผู้ใช้เพิ่มเองจากหน้าเว็บ ยังไม่ได้อยู่ใน sections.json */
interface NewRow {
  key: string;
  label: string;
  unit: UnitKey;
}

interface Draft {
  edits: Record<string, Cell>;
  added: Record<string, NewRow[]>;
  /** ข้อความของบล็อก `text` ที่พิมพ์ค้างไว้ · คีย์เป็น blockId */
  bodies?: Record<string, string>;
}

const UNIT_KEYS = Object.keys(UNITS) as UnitKey[];
const ALL_MONTHS = Array.from({ length: 12 }, (_, i) => i);

/** ปีหนึ่งมี 12 เดือนเสมอ แถวใหม่จึงเกิดมาพร้อมช่องครบ 12 ช่องได้เลย */
const emptyYear = (): Cell[] => Array<Cell>(12).fill(null);

/** เพดานของหน่วย (มีเฉพาะ %) — UNITS เป็น union ตัวตรง ๆ จึงหยิบผ่านตัวช่วยนี้ */
const unitMax = (u: UnitKey): number | undefined => (UNITS[u] as { max?: number }).max;

/** คีย์ `custom-N` ตัวแรกที่ยังว่างในชุดที่ให้มา */
function nextCustomKey(taken: ReadonlySet<string>): string {
  let n = 1;
  while (taken.has(`custom-${n}`)) n += 1;
  return `custom-${n}`;
}

/**
 * ข้อความที่พิมพ์ในช่อง → ค่าที่เก็บจริง
 * ว่าง = ยังไม่กรอก · `-` = ไม่มีรายการ · ที่เหลือเป็นตัวเลข
 *
 * รับ `-` เพราะในตารางทั้งปีไม่มีที่ให้วางปุ่ม "ไม่มีรายการ" ทีละช่อง
 * และคนที่เคยกรอก Excel พิมพ์ `-` อยู่แล้วเป็นนิสัย
 */
function parseCell(text: string): Cell {
  const t = text.trim().replace(/,/g, '');
  if (t === '') return null;
  if (t === '-') return 'none';
  const n = Number(t);
  return Number.isFinite(n) ? n : null;
}

/** ค่าที่เก็บ → ข้อความในช่อง */
function cellText(v: Cell): string {
  if (v === null) return '';
  if (v === 'none') return '-';
  return String(v);
}

/* ------------------------------------------------------------------ */

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

/* ------------------------------------------------------------------ */

/** แถวหนึ่งที่พร้อมแสดง — รวมแถวที่ผู้ใช้เพิ่งเพิ่มซึ่งยังไม่อยู่ใน config */
type ViewRow = EntryRow & { isNew: boolean };
interface ViewBlock {
  blockId: string;
  title: string;
  rows: ViewRow[];
  /** คีย์แถวที่มีอยู่จริงในรีโปแล้ว — ใช้ตั้งคีย์ของแถวใหม่ไม่ให้ชน */
  existingKeys: string[];
}
interface ViewSection {
  key: string;
  number: string;
  title: string;
  blocks: ViewBlock[];
}

export default function EditPage() {
  // เก็บเฉพาะช่องที่แก้ ไม่ใช่ทั้ง config — กันเผลอทับส่วนอื่นของไฟล์
  const [edits, setEdits] = useState<Record<string, Cell>>({});
  const [added, setAdded] = useState<Record<string, NewRow[]>>({});
  const [text, setText] = useState<Record<string, string>>({});
  /** ข้อความที่พิมพ์ค้าง · คีย์เป็น blockId — บล็อก `text` มีชุดเดียว ไม่แยกตามเดือน */
  const [bodies, setBodies] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  /** 'month' = ทีละเดือน (งานประจำรอบ) · 'year' = ตารางทั้งปี (ตามเก็บของเก่า) */
  const [mode, setMode] = useState<'month' | 'year'>('month');
  /** เดือนที่กำลังโฟกัส — ตั้งต้นที่เดือนของรอบ แต่ย้อนไปเดือนไหนก็ได้ */
  const [month, setMonth] = useState(monthIndex);
  const [collapsed, setCollapsed] = useState<Record<string, boolean>>({});

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
  /** ช่องกรอกทุกช่องบนหน้า — ใช้ย้ายโฟกัสด้วยลูกศรแบบสเปรดชีต */
  const inputs = useRef(new Map<string, HTMLInputElement>());
  const commitRef = useRef<HTMLDivElement>(null);

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
        setLiveNote(
          `ดึงข้อมูลล่าสุดจาก GitHub ไม่ได้ — ค่าที่เห็นเป็นของตอน build ล่าสุด${why ? ` (${why})` : ''}`,
        );
      });
    return () => {
      cancelled = true;
    };
  }, [token, reload]);

  /**
   * รายการช่องที่แสดงบนหน้า — ประกอบจากของสดถ้าดึงได้ ไม่งั้นใช้ค่าตอน build
   * ประกอบจากของสดทั้งก้อน ไม่ใช่เอาของสดมาทาบเฉพาะค่า เพราะ **คีย์แถว** ก็ต้องสดด้วย
   */
  const base: EntrySection[] = useMemo(
    () => (live ? buildEntrySections(buildSections(live)) : entrySections),
    [live],
  );

  /* ---------- งานค้างในเบราว์เซอร์ ---------- */

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE) ?? localStorage.getItem(LEGACY_STORAGE);
      if (raw) {
        const parsed = JSON.parse(raw) as Draft | Record<string, Cell>;
        // งานค้างที่เก็บไว้ก่อนมีปุ่มเพิ่มรายการเป็นแค่ก้อน edits เปล่า ๆ
        const draft: Draft =
          parsed && typeof parsed === 'object' && 'edits' in parsed
            ? (parsed as Draft)
            : { edits: parsed as Record<string, Cell>, added: {} };

        // คีย์รุ่นก่อนไม่มีเลขเดือนต่อท้าย เพราะกรอกได้เดือนเดียว — เติมให้เป็นเดือนของรอบ
        const migrated: Record<string, Cell> = {};
        for (const [k, v] of Object.entries(draft.edits ?? {})) {
          migrated[Number.isInteger(monthOfKey(k)) ? k : `${k}.${monthIndex}`] = v;
        }

        setEdits(migrated);
        setAdded(draft.added ?? {});
        setBodies(draft.bodies ?? {});
        setText(Object.fromEntries(Object.entries(migrated).map(([k, v]) => [k, cellText(v)])));
      }
    } catch {
      /* เบราว์เซอร์ปิด storage — กรอกใหม่ทุกครั้งแทน */
    }
    setLoaded(true);
  }, []);

  useEffect(() => {
    if (!loaded) return;
    try {
      localStorage.setItem(STORAGE, JSON.stringify({ edits, added, bodies } satisfies Draft));
      localStorage.removeItem(LEGACY_STORAGE);
    } catch {
      /* ไม่เป็นไร */
    }
  }, [edits, added, bodies, loaded]);

  /* ---------- ค่าในช่อง ---------- */

  const valueOf = useCallback(
    (blockId: string, rowKey: string, m: number, fallback: Cell): Cell => {
      const k = cellKey(blockId, rowKey, m);
      return k in edits ? edits[k] : fallback;
    },
    [edits],
  );

  const setCell = (blockId: string, rowKey: string, m: number, v: Cell) =>
    setEdits((p) => ({ ...p, [cellKey(blockId, rowKey, m)]: v }));

  /** ทิ้งสิ่งที่แก้ในช่องนี้ กลับไปใช้ค่าที่อยู่ในรีโป (กด Esc) */
  const revertCell = (k: string) => {
    setEdits((p) => {
      const next = { ...p };
      delete next[k];
      return next;
    });
    setText((p) => {
      const next = { ...p };
      delete next[k];
      return next;
    });
  };

  /* ---------- รายการที่จะแสดง ---------- */

  /** แถวใน config + แถวที่เพิ่งเพิ่ม เรียงตามลำดับที่จะเรนเดอร์จริง */
  const view: ViewSection[] = useMemo(
    () =>
      base.map((s) => ({
        key: s.key,
        number: s.number,
        title: s.title,
        blocks: s.blocks.map((b) => ({
          blockId: b.blockId,
          title: b.title,
          existingKeys: b.rows.map((r) => r.rowKey),
          rows: [
            ...b.rows.map((r) => ({ ...r, isNew: false })),
            ...(added[b.blockId] ?? []).map((nr) => ({
              blockId: b.blockId,
              rowKey: nr.key,
              label: nr.label,
              unit: nr.unit,
              unitLabel: UNITS[nr.unit].label,
              values: emptyYear(),
              isNew: true,
            })),
          ],
        })),
      })),
    [base, added],
  );

  /** บล็อกข้อความ — ประกอบจากของสดเช่นเดียวกับช่องตัวเลข (CLAUDE.md กฎข้อ 4) */
  const textView = useMemo(
    () => (live ? buildTextEntries(buildSections(live)) : textEntries),
    [live],
  );

  /** ข้อความที่พิมพ์แล้วต่างจากของในรีโปจริง ๆ · พิมพ์แล้วลบกลับเท่าเดิมไม่นับว่าแก้ */
  const changedBodies = useMemo(
    () => textView.filter((t) => t.blockId in bodies && bodies[t.blockId] !== t.body),
    [bodies, textView],
  );

  const flatRows: ViewRow[] = useMemo(
    () => view.flatMap((s) => s.blocks.flatMap((b) => b.rows)),
    [view],
  );

  const totalRows = flatRows.length;

  /* ---------- ความคืบหน้ารายเดือน ---------- */

  /**
   * กรอกครบกี่ช่องในแต่ละเดือน — แถบนี้คือคำตอบว่า "เดือนไหนยังค้าง"
   * ของเดิมหน้ากรอกเห็นแค่เดือนของรอบ เดือนที่ตกไปจึงไม่มีอะไรบอกเลย
   */
  const perMonth = useMemo(
    () =>
      ALL_MONTHS.map((m) => {
        let n = 0;
        for (const r of flatRows) if (valueOf(r.blockId, r.rowKey, m, r.values[m]) !== null) n += 1;
        return n;
      }),
    [flatRows, valueOf],
  );

  /* ---------- ตารางนำทางด้วยคีย์บอร์ด ---------- */

  const shownMonths = mode === 'year' ? ALL_MONTHS : [month];

  /**
   * แถวที่ "มองเห็นจริง" — หัวข้อที่ย่อไว้ไม่มี `<input>` อยู่บนหน้า
   * ถ้าเอา flatRows ทั้งก้อนมาทำผังนำทาง ลูกศรจะเล็งไปยังช่องที่ไม่มีตัวตน
   * แล้วโฟกัสค้างอยู่ที่เดิม กลายเป็นทางตันตรงรอยต่อของหัวข้อที่ย่อ
   */
  const navRows = useMemo(
    () => view.filter((s) => !collapsed[s.key]).flatMap((s) => s.blocks.flatMap((b) => b.rows)),
    [view, collapsed],
  );

  /** ผังช่อง [แถว][คอลัมน์] ตามที่ตาเห็น — ลูกศรเดินบนผังนี้ */
  const grid = useMemo(
    () => navRows.map((r) => shownMonths.map((m) => cellKey(r.blockId, r.rowKey, m))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [navRows, mode, month],
  );

  const pos = useMemo(() => {
    const map = new Map<string, [number, number]>();
    grid.forEach((row, r) => row.forEach((k, c) => map.set(k, [r, c])));
    return map;
  }, [grid]);

  const focusCell = (k: string | undefined) => {
    if (!k) return false;
    const el = inputs.current.get(k);
    if (!el) return false;
    el.focus();
    el.select();
    return true;
  };

  /**
   * ลูกศรเดินระหว่างช่องแบบสเปรดชีต · Enter ลงแถวถัดไป · Esc คืนค่าเดิม
   * ซ้าย-ขวาย้ายช่องเฉพาะตอนเคอร์เซอร์อยู่สุดข้อความแล้ว ไม่งั้นแก้ตัวเลขกลางคำไม่ได้
   */
  const onKey = (e: React.KeyboardEvent<HTMLInputElement>, k: string) => {
    const p = pos.get(k);
    if (!p) return;
    const [r, c] = p;
    const el = e.currentTarget;
    const atStart = el.selectionStart === 0 && el.selectionEnd === 0;
    const atEnd = el.selectionStart === el.value.length && el.selectionEnd === el.value.length;
    const last = grid[r]?.length ? grid[r].length - 1 : 0;

    let target: string | undefined;
    if (e.key === 'Enter' || e.key === 'ArrowDown') target = grid[r + 1]?.[c];
    else if (e.key === 'ArrowUp') target = grid[r - 1]?.[c];
    else if (e.key === 'ArrowRight' && atEnd) target = grid[r][c + 1] ?? grid[r + 1]?.[0];
    else if (e.key === 'ArrowLeft' && atStart) target = grid[r][c - 1] ?? grid[r - 1]?.[last];
    else if (e.key === 'Escape') {
      revertCell(k);
      return;
    } else return;

    if (focusCell(target)) e.preventDefault();
  };

  /* ---------- เพิ่ม / ลบแถว ---------- */

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
      for (const m of ALL_MONTHS) delete next[cellKey(blockId, key, m)];
      return next;
    });
  };

  /* ---------- ตัวเตือน ---------- */

  /**
   * ช่องที่เคยมีตัวเลขอยู่แล้วแต่กำลังจะกลายเป็นว่าง
   * เผลอกด Backspace ทีเดียวก็ลบข้อมูลย้อนหลังหายได้ และเดิมไม่มีอะไรเตือน
   */
  const erasing = useMemo(() => {
    const out: Array<{ key: string; label: string; month: number; was: number }> = [];
    for (const r of flatRows)
      for (const m of ALL_MONTHS) {
        const k = cellKey(r.blockId, r.rowKey, m);
        if (!(k in edits)) continue;
        if (typeof r.values[m] === 'number' && edits[k] === null) {
          out.push({ key: k, label: r.label, month: m, was: r.values[m] as number });
        }
      }
    return out;
  }, [edits, flatRows]);

  const erasingKeys = useMemo(() => new Set(erasing.map((e) => e.key)), [erasing]);

  /**
   * ตัวเลขที่ "น่าจะพิมพ์ผิดหลัก" — เกิน 100% หรือห่างจากเดือนอื่นในแถวเดียวกันเกิน 5 เท่า
   * ไม่ได้ห้ามส่ง แค่ชวนให้มองอีกที · ตรวจตอนกรอกดีกว่าไปเจอตอนขึ้นสไลด์แล้ว
   */
  const suspect = useMemo(() => {
    const out: Array<{ key: string; label: string; month: number; why: string }> = [];
    for (const r of flatRows) {
      const max = unitMax(r.unit);
      for (const m of ALL_MONTHS) {
        const k = cellKey(r.blockId, r.rowKey, m);
        if (!(k in edits)) continue;
        const v = edits[k];
        if (typeof v !== 'number') continue;
        if (max !== undefined && v > max) {
          out.push({ key: k, label: r.label, month: m, why: `เกิน ${max}${UNITS[r.unit].label}` });
          continue;
        }
        // เทียบกับเดือนอื่นในแถวเดียวกัน — ต้องมีของเทียบอย่างน้อย 3 เดือน
        const others = r.values.map((c, i) => (i === m ? null : c));
        const range = rowRange(others);
        if (!range || v === 0) continue;
        if (v > range.max * 5 || v * 5 < range.min) {
          out.push({ key: k, label: r.label, month: m, why: 'ต่างจากเดือนอื่นมาก' });
        }
      }
    }
    return out;
  }, [edits, flatRows]);

  const suspectKeys = useMemo(() => new Set(suspect.map((s) => s.key)), [suspect]);

  /* ---------- ส่งเข้ารีโป ---------- */

  /**
   * ประกอบ sections.json ใหม่โดยแตะเฉพาะช่องที่แก้จริง
   * `cfg` ต้องเป็นไฟล์**ตัวปัจจุบันในรีโป** ไม่ใช่ตัวที่ฝังมาตอน build
   * ไม่งั้นจะเขียนทับสิ่งที่คนอื่นเพิ่งส่งไปโดยไม่รู้ตัว
   */
  const applyTo = (cfg: RawConfig) => {
    const clone = JSON.parse(JSON.stringify(cfg)) as RawConfig;
    const usedKeys: Record<string, string[]> = {};

    for (const section of clone.sections as unknown as Array<{
      blocks: Array<Record<string, unknown>>;
    }>) {
      for (const block of section.blocks) {
        if (block.type === 'text') {
          const id = block.id as string;
          if (id in bodies) block.body = bodies[id];
          continue;
        }
        if (block.type !== 'monthly-matrix') continue;
        const rows = block.rows as Array<Record<string, unknown>> | undefined;
        if (!rows) continue;
        const id = block.id as string;

        for (const row of rows) {
          for (const m of ALL_MONTHS) {
            const k = cellKey(id, row.key as string, m);
            if (!(k in edits)) continue;
            const values = row.values as Cell[];
            // config เก่าที่แถวสั้นกว่า 12 ช่อง — เติมให้ครบก่อนเขียน ไม่งั้นได้ช่องโหว่
            while (values.length < 12) values.push(null);
            values[m] = edits[k];
          }
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
          for (const m of ALL_MONTHS) {
            const k = cellKey(id, nr.key, m);
            if (k in edits) values[m] = edits[k];
          }
          rows.push({ key, label: nr.label, unit: nr.unit, values });
        }
      }
    }
    return { clone, usedKeys };
  };

  const addedCount = Object.values(added).reduce((n, a) => n + a.length, 0);
  const cellCount = Object.keys(edits).length + addedCount;
  const changedCount = cellCount + changedBodies.length;

  /** เดือนที่ถูกแตะในรอบการแก้นี้ — ใช้เขียนข้อความ commit ให้ตรงกับของจริง */
  const touchedMonths = useMemo(() => {
    const s = new Set<number>();
    for (const k of Object.keys(edits)) {
      const m = monthOfKey(k);
      if (Number.isInteger(m) && m >= 0 && m < 12) s.add(m);
    }
    return [...s].sort((a, b) => a - b);
  }, [edits]);

  /** ข้อความ commit — ตัวเลขกับข้อความนับคนละหน่วย และตัวเลขอาจกินหลายเดือน */
  const commitMessage = (() => {
    const parts: string[] = [];
    if (cellCount) {
      parts.push(
        touchedMonths.length > 1
          ? `${cellCount} cells across ${touchedMonths.length} months`
          : `${cellCount} cells`,
      );
    }
    if (changedBodies.length) parts.push(`${changedBodies.length} texts`);
    const when = touchedMonths.length === 1 ? `${MONTHS[touchedMonths[0]]} ` : '';
    return `Fill ${when}${roundConfig.year} figures (${parts.join(', ')})`;
  })();

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

  /* ---------- ช่องกรอกหนึ่งช่อง ---------- */

  /**
   * เขียนเป็นฟังก์ชันคืน JSX ไม่ใช่คอมโพเนนต์ย่อย — คอมโพเนนต์ที่ประกาศในตัวหน้า
   * จะเป็น "ชนิดใหม่" ทุกครั้งที่หน้า render ทำให้ React ถอด `<input>` ทิ้งแล้วสร้างใหม่
   * โฟกัสหลุดทุกตัวอักษรที่พิมพ์ · ฟังก์ชันธรรมดาไม่มีปัญหานี้เพราะกลายเป็น JSX ตรง ๆ
   */
  const renderCell = (row: ViewRow, m: number) => {
    const k = cellKey(row.blockId, row.rowKey, m);
    const v = valueOf(row.blockId, row.rowKey, m, row.values[m]);
    const shown = text[k] ?? cellText(v);
    const isRound = m === monthIndex;
    const future = m > monthIndex;

    const tone = erasingKeys.has(k)
      ? 'border-red-500 bg-red-50'
      : suspectKeys.has(k)
        ? 'border-amber-500 bg-amber-50'
        : k in edits
          ? 'border-brand bg-brand-soft/50'
          : future
            ? 'border-line bg-neutral-50 text-ink-soft'
            : 'border-line';

    return (
      <input
        ref={(el) => {
          if (el) inputs.current.set(k, el);
          else inputs.current.delete(k);
        }}
        inputMode="decimal"
        value={shown}
        aria-label={`${row.label} เดือน${MONTHS[m]}`}
        onChange={(e) => {
          setText((p) => ({ ...p, [k]: e.target.value }));
          setCell(row.blockId, row.rowKey, m, parseCell(e.target.value));
        }}
        onKeyDown={(e) => onKey(e, k)}
        onFocus={(e) => e.currentTarget.select()}
        placeholder={future ? '' : '—'}
        className={`w-full rounded border px-1.5 py-1 text-right font-mono text-sm tabular-nums outline-none focus:border-brand focus:ring-2 focus:ring-brand/30 ${tone} ${
          isRound ? 'font-semibold' : ''
        }`}
      />
    );
  };

  /* ---------- หน้าเว็บ ---------- */

  const filledThis = perMonth[month];
  const behind = ALL_MONTHS.filter((m) => m <= monthIndex && perMonth[m] < totalRows);

  return (
    <>
      <SiteNav />

      <main className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="text-2xl font-bold text-brand-deep">กรอกตัวเลข</h1>
        <p className="mt-1 text-sm text-ink-soft">
          ทุกตาราง 12 เดือนในเด็ครวมอยู่ในหน้านี้หน้าเดียว · เลือกเดือนไหนก็กรอกได้
          ไม่ได้ล็อกไว้ที่เดือนของรอบเหมือนเดิม
        </p>

        {/* ---------- แถบเดือน: เลือกเดือน + เห็นทันทีว่าเดือนไหนค้าง ---------- */}
        <section className="mt-5 rounded-lg border border-line bg-paper p-3">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">เลือกเดือนที่จะกรอก</h2>
            <p className="text-xs text-ink-soft">
              ตัวเลขใต้ชื่อเดือนคือจำนวนช่องที่กรอกแล้วจาก {totalRows} ช่อง
            </p>
          </div>

          <div className="mt-2 grid grid-cols-6 gap-1.5 sm:grid-cols-12">
            {ALL_MONTHS.map((m) => {
              const done = perMonth[m] >= totalRows;
              const active = m === month;
              // เดือนที่ยังไม่ถึงกำหนดไม่ใช่ของค้าง — ทาสีเหลืองจะกลายเป็นเตือนลวง
              const future = m > monthIndex;
              return (
                <button
                  key={m}
                  onClick={() => setMonth(m)}
                  aria-pressed={active}
                  className={`rounded border px-1 py-1.5 text-center transition ${
                    active
                      ? 'border-brand bg-brand text-white'
                      : future
                        ? 'border-line bg-neutral-50 text-ink-soft hover:border-brand'
                        : done
                          ? 'border-line bg-brand-soft text-brand-deep hover:border-brand'
                          : 'border-amber-400 bg-amber-50 text-amber-800 hover:border-brand'
                  }`}
                >
                  <span className="block text-xs font-semibold">
                    {MONTHS_SHORT[m]}
                    {m === monthIndex && <span className="ml-0.5">•</span>}
                  </span>
                  <span className="block font-mono text-[11px] tabular-nums">
                    {perMonth[m]}/{totalRows}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-2 text-xs text-ink-soft">
            <span className="text-brand-deep">•</span> คือเดือนของรอบนี้ ({MONTHS[monthIndex]}) ·{' '}
            {behind.length === 0 ? (
              <span className="font-medium text-brand">ตั้งแต่ต้นปีถึงเดือนนี้กรอกครบแล้ว</span>
            ) : (
              <span className="font-medium text-amber-700">
                ยังค้าง {behind.length} เดือน: {behind.map((m) => MONTHS_SHORT[m]).join(' ')}
              </span>
            )}
          </p>
        </section>

        {/* ---------- แถบเครื่องมือติดบนสุด ---------- */}
        <div className="sticky top-12 z-30 mt-4 flex flex-wrap items-center gap-3 rounded-lg border border-line bg-paper px-3 py-2 shadow-sm">
          <div className="flex overflow-hidden rounded border border-line">
            {(['month', 'year'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setMode(v)}
                aria-pressed={mode === v}
                className={`px-3 py-1.5 text-sm ${
                  mode === v ? 'bg-brand font-semibold text-white' : 'text-ink-soft hover:bg-brand-soft'
                }`}
              >
                {v === 'month' ? `เดือนเดียว (${MONTHS[month]})` : 'ทั้งปี 12 เดือน'}
              </button>
            ))}
          </div>

          <span className="text-sm">
            {MONTHS[month]}: กรอกแล้ว <b className="tabular-nums">{filledThis}</b>/{totalRows}
          </span>

          <div className="h-2 w-24 overflow-hidden rounded bg-neutral-200">
            <div
              className="h-full bg-brand transition-all"
              style={{ width: `${Math.round((filledThis / Math.max(1, totalRows)) * 100)}%` }}
            />
          </div>

          <button
            onClick={() =>
              setCollapsed(
                Object.values(collapsed).some(Boolean)
                  ? {}
                  : Object.fromEntries(view.map((s) => [s.key, true])),
              )
            }
            className="rounded border border-line px-3 py-1.5 text-sm text-ink-soft hover:bg-neutral-50"
          >
            {Object.values(collapsed).some(Boolean) ? 'กางทั้งหมด' : 'ย่อทั้งหมด'}
          </button>

          <button
            onClick={() => commitRef.current?.scrollIntoView({ behavior: 'smooth' })}
            disabled={changedCount === 0}
            className="ml-auto rounded bg-brand px-4 py-1.5 text-sm font-semibold text-white disabled:opacity-40"
          >
            แก้ไว้ {changedCount} รายการ · ไปที่ปุ่มส่ง
          </button>
        </div>

        <p className="mt-3 text-xs text-ink-soft">
          ช่องว่าง = ยังไม่กรอก · พิมพ์ <span className="font-mono">-</span> = ไม่มีรายการเดือนนั้นจริง ๆ
          (สไลด์จะขึ้น <span className="font-mono">-</span>) · <b>Enter</b> หรือ <b>ลูกศรขึ้น-ลง</b>{' '}
          ย้ายไปแถวถัดไป · <b>ลูกศรซ้าย-ขวา</b> ย้ายข้ามเดือน · <b>Esc</b> คืนค่าเดิมของช่องนั้น
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

        {/* ---------- ตารางกรอก ---------- */}
        {view.map((s) => {
          const shut = collapsed[s.key];
          return (
            <section key={s.key} id={`sec-${s.key}`} className="mt-6 scroll-mt-32">
              <button
                onClick={() => setCollapsed((p) => ({ ...p, [s.key]: !p[s.key] }))}
                aria-expanded={!shut}
                className="flex w-full items-center gap-2 border-b border-line pb-1.5 text-left"
              >
                <span className="w-4 text-ink-soft">{shut ? '▸' : '▾'}</span>
                <span className="font-mono text-brand">{s.number}</span>
                <span className="text-lg font-semibold">{s.title}</span>
              </button>

              {!shut &&
                s.blocks.map((b) => (
                  <div key={b.blockId} className="mt-4">
                    <h3 className="text-sm font-medium text-ink-soft">{b.title}</h3>

                    {mode === 'year' ? (
                      /* ---- ตารางทั้งปี: แถว × 12 เดือน ---- */
                      <div className="mt-2 overflow-x-auto">
                        <table className="w-full min-w-[62rem] border-collapse">
                          <thead>
                            <tr className="text-xs text-ink-soft">
                              <th className="sticky left-0 z-10 w-56 bg-paper px-2 py-1 text-left font-medium">
                                รายการ
                              </th>
                              {ALL_MONTHS.map((m) => (
                                <th
                                  key={m}
                                  className={`px-1 py-1 text-center font-medium ${
                                    m === month ? 'rounded-t bg-brand-soft text-brand-deep' : ''
                                  }`}
                                >
                                  {MONTHS_SHORT[m]}
                                </th>
                              ))}
                              <th className="w-16 px-2 py-1 text-left font-medium">หน่วย</th>
                            </tr>
                          </thead>
                          <tbody>
                            {b.rows.map((r) => (
                              <tr key={r.rowKey} className="border-t border-line/60">
                                <th
                                  scope="row"
                                  className="sticky left-0 z-10 bg-paper px-2 py-1 text-left text-sm font-normal"
                                >
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
                                </th>
                                {ALL_MONTHS.map((m) => (
                                  <td
                                    key={m}
                                    className={`px-0.5 py-0.5 ${m === month ? 'bg-brand-soft/60' : ''}`}
                                  >
                                    {renderCell(r, m)}
                                  </td>
                                ))}
                                <td className="px-2 py-1 text-xs text-ink-soft">{r.unitLabel}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* ---- เดือนเดียว: รายการเดียวต่อบรรทัด อ่านง่ายกว่าและมีค่าเดือนก่อนให้เทียบ ---- */
                      <ul className="mt-2 divide-y divide-line">
                        {b.rows.map((r) => {
                          const k = cellKey(r.blockId, r.rowKey, month);
                          const v = valueOf(r.blockId, r.rowKey, month, r.values[month]);
                          const prev =
                            month > 0
                              ? valueOf(r.blockId, r.rowKey, month - 1, r.values[month - 1])
                              : null;
                          return (
                            <li key={r.rowKey} className="flex flex-wrap items-center gap-2 py-2">
                              <span className="min-w-0 max-w-[28rem] flex-1 text-sm">
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

                              {month > 0 && (
                                <span className="w-28 shrink-0 text-right font-mono text-xs text-ink-soft">
                                  {MONTHS_SHORT[month - 1]} {formatCell(prev, r.unit) || '—'}
                                </span>
                              )}

                              <span className="w-28 shrink-0">
                                {renderCell(r, month)}
                              </span>

                              <span className="w-16 shrink-0 text-xs text-ink-soft">
                                {r.unitLabel}
                              </span>

                              <button
                                onClick={() => {
                                  const none = v !== 'none';
                                  setCell(r.blockId, r.rowKey, month, none ? 'none' : null);
                                  setText((p) => ({ ...p, [k]: none ? '-' : '' }));
                                }}
                                className={`shrink-0 rounded border px-2 py-1 text-xs ${
                                  v === 'none'
                                    ? 'border-brand bg-brand text-white'
                                    : 'border-line text-ink-soft hover:bg-neutral-50'
                                }`}
                              >
                                ไม่มีรายการ
                              </button>

                              {/* ลบได้เฉพาะแถวที่ยังไม่ได้ส่ง — แถวเดิมมีข้อมูลย้อนหลังอยู่ ลบทิ้งไม่ได้จากหน้านี้ */}
                              {r.isNew && (
                                <button
                                  onClick={() => removeRow(r.blockId, r.rowKey)}
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
                    )}

                    <AddRowForm
                      defaultUnit={b.rows[0]?.unit ?? 'baht'}
                      onAdd={(label, unit) =>
                        addRow(b.blockId, { key: freeKey(b.blockId, b.existingKeys), label, unit })
                      }
                    />
                  </div>
                ))}
            </section>
          );
        })}

        {/* ---------- ข้อความสรุป: บล็อก `text` ---------- */}
        {textView.length > 0 && (
          <section className="mt-10">
            <h2 className="border-b border-line pb-1.5 text-lg font-semibold">ข้อความสรุป</h2>
            <p className="mt-2 text-sm text-ink-soft">
              ต่างจากตาราง — ข้อความมีชุดเดียว ไม่ได้แยกตามเดือน{' '}
              <b>พิมพ์ที่นี่คือพิมพ์ทับของเดือนก่อน</b>
              <br />
              เว้นบรรทัดว่างคั่น = ขึ้นย่อหน้าใหม่ · ขึ้นต้นบรรทัดด้วย{' '}
              <span className="font-mono">-</span> = หัวข้อย่อย
            </p>

            {textView.map((t) => {
              const value = t.blockId in bodies ? bodies[t.blockId] : t.body;
              const over = fitBody(parseBody(value)).overflow;
              const wiping = t.body.trim() !== '' && value.trim() === '';
              const changed = t.blockId in bodies && value !== t.body;
              return (
                <div key={t.blockId} className="mt-4">
                  <h3 className="text-sm font-medium text-ink-soft">
                    <span className="font-mono text-brand">{t.sectionNumber}</span> {t.title}
                  </h3>
                  <textarea
                    value={value}
                    onChange={(e) => setBodies((p) => ({ ...p, [t.blockId]: e.target.value }))}
                    rows={7}
                    placeholder="พิมพ์ข้อความที่จะขึ้นบนสไลด์…"
                    className={`mt-2 w-full rounded border px-3 py-2 text-sm leading-relaxed ${
                      over || wiping ? 'border-red-500 bg-red-50' : 'border-line'
                    }`}
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                    <span className={over ? 'font-semibold text-red-600' : 'text-ink-soft'}>
                      {value.length.toLocaleString('en-US')} ตัวอักษร
                    </span>
                    {over && (
                      <span className="font-medium text-red-600">
                        ยาวเกินหนึ่งสไลด์ — ย่อตัวอักษรจนเล็กสุดแล้วก็ยังไม่พอ
                        ส่วนที่เกินจะถูกตัดหายทั้งบนจอและใน PDF
                      </span>
                    )}
                    {wiping && (
                      <span className="font-medium text-red-600">กำลังลบข้อความเดิมทิ้งทั้งหมด</span>
                    )}
                    {changed && (
                      <button
                        onClick={() =>
                          setBodies((p) => {
                            const next = { ...p };
                            delete next[t.blockId];
                            return next;
                          })
                        }
                        className="rounded border border-line px-2 py-0.5 text-ink-soft hover:bg-neutral-50"
                      >
                        คืนค่าเดิม
                      </button>
                    )}
                  </div>
                </div>
              );
            })}
          </section>
        )}

        {/* ---------- สรุปสิ่งที่ต้องมองอีกที ---------- */}
        {suspect.length > 0 && (
          <div className="mt-8 rounded border-2 border-amber-500 bg-amber-50 p-4">
            <p className="font-semibold text-amber-800">
              ลองดูอีกที — ตัวเลข {suspect.length} ช่องดูผิดปกติ
            </p>
            <ul className="mt-2 space-y-1 text-sm text-amber-800">
              {suspect.map((s) => (
                <li key={s.key}>
                  {s.label} · {MONTHS_SHORT[s.month]} · {s.why}{' '}
                  <button onClick={() => focusCell(s.key)} className="underline">
                    ไปที่ช่องนั้น
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-amber-800">
              ถ้าตัวเลขถูกแล้วก็ส่งได้ตามปกติ — ตัวเตือนนี้ไม่ได้กันการส่ง
            </p>
          </div>
        )}

        {erasing.length > 0 && (
          <div className="mt-4 rounded border-2 border-red-500 bg-red-50 p-4">
            <p className="font-semibold text-red-700">
              ระวัง — กำลังลบตัวเลขเดิมทิ้ง {erasing.length} ช่อง
            </p>
            <ul className="mt-2 space-y-1 text-sm text-red-700">
              {erasing.map((e) => (
                <li key={e.key}>
                  {e.label} · {MONTHS_SHORT[e.month]} · เดิม{' '}
                  <b>{e.was.toLocaleString('en-US')}</b> → ว่าง{' '}
                  <button onClick={() => revertCell(e.key)} className="underline">
                    คืนค่าเดิม
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-red-700">
              ถ้าตั้งใจว่าเดือนนั้นไม่มีรายการ ให้พิมพ์ <span className="font-mono">-</span>{' '}
              แทนการปล่อยว่าง
            </p>
          </div>
        )}

        <div ref={commitRef} className="scroll-mt-32">
          <CommitPanel
            count={changedCount ? 1 : 0}
            getFiles={getFiles}
            message={commitMessage}
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
              setBodies({});
              // ดึงของสดใหม่ทันที ผู้ใช้จะได้เห็นผลโดยไม่ต้องรอเว็บ build ใหม่
              setReload((n) => n + 1);
              try {
                localStorage.removeItem(STORAGE);
              } catch {
                /* ไม่เป็นไร */
              }
            }}
          />
        </div>
      </main>
    </>
  );
}
