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
import {
  IconAlert,
  IconCheck,
  IconDown,
  IconPlus,
  IconRight,
  IconTarget,
  IconTrash,
} from '@/components/ui/icons';

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
        className="btn btn-dashed btn-sm mt-2"
      >
        <IconPlus className="h-3.5 w-3.5" />
        เพิ่มรายการ
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
    <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-primary bg-primary-soft p-2">
      <input
        autoFocus
        value={label}
        onChange={(e) => setLabel(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="ชื่อรายการใหม่"
        aria-label="ชื่อรายการใหม่"
        className="field h-9 min-w-0 flex-1 py-1"
      />
      <select
        value={unit}
        onChange={(e) => setUnit(e.target.value as UnitKey)}
        aria-label="หน่วยของรายการใหม่"
        className="field h-9 w-auto shrink-0 py-1"
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
        className="btn btn-primary"
      >
        เพิ่ม
      </button>
      <button
        onClick={() => {
          setOpen(false);
          setLabel('');
        }}
        className="btn btn-outline"
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
  /** ช่องที่รอโฟกัสหลังหัวข้อกางเสร็จ — ปุ่ม "ไปช่องว่างถัดไป" ใช้ */
  const [pendingFocus, setPendingFocus] = useState('');
  /** ข้อความสั้น ๆ ใต้แถบเครื่องมือ เช่น "เดือนนี้กรอกครบแล้ว" */
  const [jumpNote, setJumpNote] = useState('');

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
  /** ช่องที่ปุ่ม "ไปช่องว่างถัดไป" พาไปล่าสุด — กดปุ่มแล้วโฟกัสย้ายไปที่ปุ่ม
      ถ้าดูแค่ `document.activeElement` จะกลับไปเริ่มที่ช่องแรกทุกครั้ง ไม่เดินหน้าสักที */
  const lastJump = useRef('');

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

  /**
   * โฟกัสช่องหนึ่ง แล้ว**เลื่อนให้มาอยู่กลางจอ**
   * ปล่อยให้เบราว์เซอร์เลื่อนเองจะได้ช่องที่ติดขอบบนพอดี ซึ่งอยู่ใต้แถบเครื่องมือ
   * (`sticky top-12`) — กด "ไปที่ช่องนั้น" แล้วเหมือนไม่มีอะไรเกิดขึ้น
   */
  const focusCell = (k: string | undefined) => {
    if (!k) return false;
    const el = inputs.current.get(k);
    if (!el) return false;
    el.scrollIntoView({ block: 'center' });
    el.focus({ preventScroll: true });
    el.select();
    return true;
  };

  /**
   * ทุกแถวเรียงตามที่เห็นบนหน้า พร้อมหัวข้อที่มันสังกัด
   * ต่างจาก `navRows` ตรงที่รวมหัวข้อที่ย่อไว้ด้วย — ปุ่มไปช่องว่างต้องข้ามไปหัวข้อที่ย่อได้
   */
  const rowIndex = useMemo(
    () =>
      view.flatMap((s) =>
        s.blocks.flatMap((b) => b.rows.map((row) => ({ sectionKey: s.key, row }))),
      ),
    [view],
  );

  /** หัวข้อกางแล้วค่อยโฟกัส — ตอนกดปุ่ม `<input>` ของหัวข้อที่ย่ออยู่ยังไม่มีบนหน้า */
  useEffect(() => {
    if (!pendingFocus) return;
    if (focusCell(pendingFocus)) setPendingFocus('');
    // focusCell อ่านจาก ref ล้วน ๆ ไม่ต้องใส่เป็น dependency
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [pendingFocus, collapsed]);

  /**
   * ไปช่องที่ยังไม่กรอกช่องถัดไปของเดือนที่เลือก · วนกลับต้นเมื่อถึงท้ายหน้า
   *
   * ของเดิมรู้แค่ว่า "เดือนนี้กรอกไป 50 จาก 56" แต่ไม่มีทางรู้ว่าอีก 6 ช่องอยู่ตรงไหน
   * ต้องไล่สายตาผ่าน 13 หัวข้อหาช่องว่างเอง · งานตามเก็บของเดือนเก่าเจ็บที่สุดตรงนี้
   */
  const jumpToNextEmpty = () => {
    setJumpNote('');
    const n = rowIndex.length;
    if (!n) return;
    // เริ่มนับจากช่องที่โฟกัสอยู่ · ไม่ได้อยู่ในช่องไหน (เช่นเพิ่งกดปุ่มนี้) ก็นับจากช่องที่ไปล่าสุด
    const active = document.activeElement;
    const here =
      rowIndex.find(({ row }) => inputs.current.get(cellKey(row.blockId, row.rowKey, month)) === active)
        ?.row ?? null;
    const fromKey = here ? cellKey(here.blockId, here.rowKey, month) : lastJump.current;
    const from = rowIndex.findIndex(
      ({ row }) => cellKey(row.blockId, row.rowKey, month) === fromKey,
    );

    for (let step = 1; step <= n; step += 1) {
      const { sectionKey, row } = rowIndex[(from + step + n) % n];
      if (valueOf(row.blockId, row.rowKey, month, row.values[month]) !== null) continue;

      const k = cellKey(row.blockId, row.rowKey, month);
      lastJump.current = k;
      if (collapsed[sectionKey]) {
        setCollapsed((p) => ({ ...p, [sectionKey]: false }));
        setPendingFocus(k);
      } else {
        focusCell(k);
      }
      return;
    }
    setJumpNote(`${MONTHS[month]} กรอกครบทุกช่องแล้ว`);
  };

  // สลับเดือนแล้วข้อความของเดือนก่อนต้องหายไป ไม่งั้นค้างบอกผิดเดือน
  useEffect(() => setJumpNote(''), [month]);

  /**
   * แต่ละหัวข้อของเดือนที่เลือก มีกี่ช่องและยังว่างกี่ช่อง — หัวข้อที่ย่อไว้ก็ยังเห็นตัวเลขนี้
   * ต้องนับ `rows` ด้วย ไม่ใช่แค่ `left` · ตารางที่เพิ่งสร้างจาก /structure ยังไม่มีแถวเลย
   * ถ้าดูแค่ "ว่าง 0 ช่อง" จะขึ้นว่า "ครบแล้ว" ทั้งที่ยังไม่มีอะไรให้กรอก
   */
  const sectionFill = useMemo(() => {
    const out: Record<string, { rows: number; left: number }> = {};
    for (const s of view) {
      let rows = 0;
      let left = 0;
      for (const b of s.blocks)
        for (const r of b.rows) {
          rows += 1;
          if (valueOf(r.blockId, r.rowKey, month, r.values[month]) === null) left += 1;
        }
      out[s.key] = { rows, left };
    }
    return out;
  }, [view, month, valueOf]);

  /** เหลืออีกกี่ช่องในตารางเดียว */
  const blockLeft = (b: ViewBlock) =>
    b.rows.filter((r) => valueOf(r.blockId, r.rowKey, month, r.values[month]) === null).length;

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
      ? 'border-danger-ink bg-danger-soft text-danger-ink'
      : suspectKeys.has(k)
        ? 'border-warn-ink bg-warn-soft text-warn-ink'
        : k in edits
          ? 'border-primary bg-primary-soft'
          : future
            ? 'border-edge bg-surface-2 text-muted'
            : 'border-edge bg-surface';

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
        className={`w-full rounded-md border px-1.5 py-1 text-right font-mono text-sm tabular-nums transition focus:border-primary ${tone} ${
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

      <main id="main" className="mx-auto max-w-7xl px-4 py-6">
        <h1 className="text-2xl font-bold tracking-tight">กรอกตัวเลข</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">
          ทุกตาราง 12 เดือนในเด็ครวมอยู่ในหน้านี้หน้าเดียว · เลือกเดือนไหนก็กรอกได้
          ไม่ได้ล็อกไว้ที่เดือนของรอบเหมือนเดิม
        </p>

        {/* ---------- แถบเดือน: เลือกเดือน + เห็นทันทีว่าเดือนไหนค้าง ---------- */}
        <section className="card-pad mt-5">
          <div className="flex flex-wrap items-baseline justify-between gap-2">
            <h2 className="text-sm font-semibold">เลือกเดือนที่จะกรอก</h2>
            <p className="text-xs text-muted">
              ตัวเลขใต้ชื่อเดือนคือจำนวนช่องที่กรอกแล้วจาก {totalRows} ช่อง
            </p>
          </div>

          <div className="mt-3 grid grid-cols-4 gap-1.5 sm:grid-cols-6 lg:grid-cols-12">
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
                  className={`cursor-pointer rounded-lg border px-1 py-2 text-center transition hover:border-primary ${
                    active
                      ? 'border-primary bg-primary text-on-primary shadow-hair'
                      : future
                        ? 'border-edge bg-surface-2 text-muted'
                        : done
                          ? 'border-edge bg-primary-soft text-primary-ink'
                          : 'border-warn-ink/40 bg-warn-soft text-warn-ink'
                  }`}
                >
                  <span className="block text-xs font-semibold">
                    {MONTHS_SHORT[m]}
                    {m === monthIndex && <span className="ml-0.5" aria-hidden="true">•</span>}
                  </span>
                  <span className="block font-mono text-[11px] tabular-nums">
                    {perMonth[m]}/{totalRows}
                  </span>
                </button>
              );
            })}
          </div>

          <p className="mt-3 text-xs text-muted">
            <span className="text-primary">•</span> คือเดือนของรอบนี้ ({MONTHS[monthIndex]}) ·{' '}
            {behind.length === 0 ? (
              <span className="font-medium text-primary">ตั้งแต่ต้นปีถึงเดือนนี้กรอกครบแล้ว</span>
            ) : (
              <span className="font-medium text-warn-ink">
                ยังค้าง {behind.length} เดือน: {behind.map((m) => MONTHS_SHORT[m]).join(' ')}
              </span>
            )}
          </p>
        </section>

        {/* ---------- แถบเครื่องมือติดบนสุด ---------- */}
        <div className="sticky top-12 z-30 mt-4 flex flex-wrap items-center gap-3 rounded-xl2 border border-edge bg-surface px-3 py-2 shadow-hair">
          <div className="seg">
            {(['month', 'year'] as const).map((v) => (
              <button
                key={v}
                onClick={() => setMode(v)}
                aria-pressed={mode === v}
                className="seg-item"
              >
                {v === 'month' ? `เดือนเดียว (${MONTHS[month]})` : 'ทั้งปี 12 เดือน'}
              </button>
            ))}
          </div>

          <span className="text-sm">
            {MONTHS[month]}: กรอกแล้ว <b className="tabular-nums">{filledThis}</b>/{totalRows}
          </span>

          <div
            className="h-1.5 w-24 overflow-hidden rounded-full bg-surface-3"
            role="progressbar"
            aria-valuenow={Math.round((filledThis / Math.max(1, totalRows)) * 100)}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label={`${MONTHS[month]} กรอกแล้ว ${filledThis} จาก ${totalRows} ช่อง`}
          >
            <div
              className="h-full rounded-full bg-primary transition-all"
              style={{ width: `${Math.round((filledThis / Math.max(1, totalRows)) * 100)}%` }}
            />
          </div>

          {/* หาช่องที่ยังว่างให้เอง — ไม่ต้องไล่สายตาผ่าน 13 หัวข้อ */}
          <button
            onClick={jumpToNextEmpty}
            disabled={filledThis >= totalRows}
            className="btn btn-outline btn-sm"
          >
            <IconTarget className="h-3.5 w-3.5" />
            ไปช่องว่างถัดไป
          </button>

          <button
            onClick={() =>
              setCollapsed(
                Object.values(collapsed).some(Boolean)
                  ? {}
                  : Object.fromEntries(view.map((s) => [s.key, true])),
              )
            }
            className="btn btn-outline btn-sm"
          >
            {Object.values(collapsed).some(Boolean) ? 'กางทั้งหมด' : 'ย่อทั้งหมด'}
          </button>

          <button
            onClick={() => commitRef.current?.scrollIntoView({ behavior: 'smooth' })}
            disabled={changedCount === 0}
            className="btn btn-primary ml-auto"
          >
            แก้ไว้ {changedCount} รายการ · ไปที่ปุ่มส่ง
          </button>
        </div>

        {jumpNote && (
          <p className="note note-brand mt-3" role="status">
            {jumpNote}
          </p>
        )}

        <p className="mt-3 text-xs leading-relaxed text-muted">
          ช่องว่าง = ยังไม่กรอก · พิมพ์ <span className="font-mono">-</span> = ไม่มีรายการเดือนนั้นจริง ๆ
          (สไลด์จะขึ้น <span className="font-mono">-</span>) · <b>Enter</b> หรือ <b>ลูกศรขึ้น-ลง</b>{' '}
          ย้ายไปแถวถัดไป · <b>ลูกศรซ้าย-ขวา</b> ย้ายข้ามเดือน · <b>Esc</b> คืนค่าเดิมของช่องนั้น
        </p>

        {!token && (
          <p className="note note-warn mt-4">
            <b>ยังไม่ได้ใส่โทเคน</b> — ค่าที่เห็นเป็นของตอน build ล่าสุด
            ตัวเตือนตอนกำลังลบตัวเลขเดิมจึงอาจไม่ครบ
            <br />
            ใส่โทเคนในช่องท้ายหน้าแล้วกดออกจากช่อง หน้านี้จะดึงค่าล่าสุดจากรีโปมาให้เอง
          </p>
        )}

        {liveNote && (
          <p className="note note-warn mt-4" role="status">{liveNote}</p>
        )}

        {live && (
          <p className="note note-brand mt-4" role="status">
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
                className="flex w-full cursor-pointer items-center gap-2 rounded-lg border-b border-edge px-1 py-2 text-left transition hover:bg-surface-2"
              >
                <span className="text-muted">
                  {shut ? <IconRight className="h-4 w-4" /> : <IconDown className="h-4 w-4" />}
                </span>
                <span className="font-mono text-primary tabular-nums">{s.number}</span>
                <span className="text-base font-semibold sm:text-lg">{s.title}</span>

                {/* ย่อไว้ก็ยังรู้ว่าหัวข้อนี้ยังต้องกลับมาทำอีกไหม */}
                {sectionFill[s.key]?.rows > 0 &&
                  (sectionFill[s.key].left > 0 ? (
                    <span className="chip chip-warn ml-auto shrink-0">
                      {MONTHS_SHORT[month]} ยังว่าง {sectionFill[s.key].left} ช่อง
                    </span>
                  ) : (
                    <span className="chip chip-brand ml-auto shrink-0">
                      <IconCheck className="h-3.5 w-3.5" />
                      {MONTHS_SHORT[month]} ครบแล้ว
                    </span>
                  ))}
              </button>

              {!shut &&
                s.blocks.map((b) => (
                  <div key={b.blockId} className="mt-4">
                    <h3 className="flex flex-wrap items-center gap-2 text-sm font-medium text-muted">
                      {b.title}
                      {blockLeft(b) > 0 && (
                        <span className="chip chip-warn">ยังว่าง {blockLeft(b)}</span>
                      )}
                    </h3>

                    {mode === 'year' ? (
                      /* ---- ตารางทั้งปี: แถว × 12 เดือน ---- */
                      <div className="card mt-2 overflow-x-auto p-1">
                        <table className="w-full min-w-[62rem] border-collapse">
                          <thead>
                            <tr className="text-xs text-muted">
                              <th className="sticky left-0 z-10 w-56 bg-surface px-2 py-1.5 text-left font-medium">
                                รายการ
                              </th>
                              {ALL_MONTHS.map((m) => (
                                <th
                                  key={m}
                                  className={`px-1 py-1.5 text-center font-medium ${
                                    m === month ? 'rounded-t-md bg-primary-soft text-primary-ink' : ''
                                  }`}
                                >
                                  {MONTHS_SHORT[m]}
                                </th>
                              ))}
                              <th className="w-16 px-2 py-1.5 text-left font-medium">หน่วย</th>
                            </tr>
                          </thead>
                          <tbody>
                            {b.rows.map((r) => (
                              <tr key={r.rowKey} className="border-t border-edge/70 even:bg-surface-2/40">
                                <th
                                  scope="row"
                                  className="sticky left-0 z-10 bg-surface px-2 py-1 text-left text-sm font-normal"
                                >
                                  {r.label}
                                  {r.isNew && (
                                    <span className="chip chip-warn ml-1.5 text-[10px]">ใหม่</span>
                                  )}
                                  {r.note && (
                                    <span className="ml-1 text-xs text-warn-ink" title={r.note}>
                                      *
                                    </span>
                                  )}
                                </th>
                                {ALL_MONTHS.map((m) => (
                                  <td
                                    key={m}
                                    className={`px-0.5 py-0.5 ${m === month ? 'bg-primary-soft' : ''}`}
                                  >
                                    {renderCell(r, m)}
                                  </td>
                                ))}
                                <td className="px-2 py-1 text-xs text-muted">{r.unitLabel}</td>
                              </tr>
                            ))}
                          </tbody>
                        </table>
                      </div>
                    ) : (
                      /* ---- เดือนเดียว: รายการเดียวต่อบรรทัด อ่านง่ายกว่าและมีค่าเดือนก่อนให้เทียบ ---- */
                      <ul className="card mt-2 divide-y divide-edge px-3">
                        {b.rows.map((r) => {
                          const k = cellKey(r.blockId, r.rowKey, month);
                          const v = valueOf(r.blockId, r.rowKey, month, r.values[month]);
                          const prev =
                            month > 0
                              ? valueOf(r.blockId, r.rowKey, month - 1, r.values[month - 1])
                              : null;
                          return (
                            <li key={r.rowKey} className="flex flex-wrap items-center gap-2 py-2 transition hover:bg-surface-2/60">
                              <span className="min-w-0 max-w-[28rem] flex-1 text-sm">
                                {r.label}
                                {r.isNew && (
                                  <span className="chip chip-warn ml-1.5 text-[10px]">ใหม่</span>
                                )}
                                {r.note && (
                                  <span className="ml-1 text-xs text-warn-ink" title={r.note}>
                                    *
                                  </span>
                                )}
                              </span>

                              {month > 0 && (
                                <span className="w-28 shrink-0 text-right font-mono text-xs text-muted">
                                  {MONTHS_SHORT[month - 1]} {formatCell(prev, r.unit) || '—'}
                                </span>
                              )}

                              <span className="w-28 shrink-0">
                                {renderCell(r, month)}
                              </span>

                              <span className="w-16 shrink-0 text-xs text-muted">{r.unitLabel}</span>

                              <button
                                onClick={() => {
                                  const none = v !== 'none';
                                  setCell(r.blockId, r.rowKey, month, none ? 'none' : null);
                                  setText((p) => ({ ...p, [k]: none ? '-' : '' }));
                                }}
                                aria-pressed={v === 'none'}
                                className={`btn btn-sm ${
                                  v === 'none' ? 'btn-primary' : 'btn-outline'
                                }`}
                              >
                                ไม่มีรายการ
                              </button>

                              {/* ลบได้เฉพาะแถวที่ยังไม่ได้ส่ง — แถวเดิมมีข้อมูลย้อนหลังอยู่ ลบทิ้งไม่ได้จากหน้านี้ */}
                              {r.isNew && (
                                <button
                                  onClick={() => removeRow(r.blockId, r.rowKey)}
                                  className="btn btn-danger btn-sm"
                                  aria-label={`ลบ ${r.label}`}
                                >
                                  <IconTrash className="h-3.5 w-3.5" />
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
            <h2 className="border-b border-edge pb-1.5 text-lg font-semibold">ข้อความสรุป</h2>
            <p className="mt-2 text-sm leading-relaxed text-muted">
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
                  <h3 className="text-sm font-medium text-muted">
                    <span className="font-mono text-primary">{t.sectionNumber}</span> {t.title}
                  </h3>
                  <textarea
                    value={value}
                    onChange={(e) => setBodies((p) => ({ ...p, [t.blockId]: e.target.value }))}
                    rows={7}
                    placeholder="พิมพ์ข้อความที่จะขึ้นบนสไลด์…"
                    aria-label={`ข้อความสรุปของ ${t.title}`}
                    className={`field mt-2 leading-relaxed ${
                      over || wiping ? 'border-danger-ink bg-danger-soft text-danger-ink' : ''
                    }`}
                  />
                  <div className="mt-1 flex flex-wrap items-center gap-3 text-xs">
                    <span className={over ? 'font-semibold text-danger-ink' : 'text-muted'}>
                      {value.length.toLocaleString('en-US')} ตัวอักษร
                    </span>
                    {over && (
                      <span className="font-medium text-danger-ink" role="alert">
                        ยาวเกินหนึ่งสไลด์ — ย่อตัวอักษรจนเล็กสุดแล้วก็ยังไม่พอ
                        ส่วนที่เกินจะถูกตัดหายทั้งบนจอและใน PDF
                      </span>
                    )}
                    {wiping && (
                      <span className="font-medium text-danger-ink" role="alert">
                        กำลังลบข้อความเดิมทิ้งทั้งหมด
                      </span>
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
                        className="btn btn-outline btn-sm"
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
          <div className="mt-8 rounded-xl2 border border-warn-ink/40 bg-warn-soft p-4" role="status">
            <p className="flex items-center gap-2 font-semibold text-warn-ink">
              <IconAlert className="h-4 w-4" />
              ลองดูอีกที — ตัวเลข {suspect.length} ช่องดูผิดปกติ
            </p>
            <ul className="mt-2 space-y-1 text-sm text-warn-ink">
              {suspect.map((s) => (
                <li key={s.key}>
                  {s.label} · {MONTHS_SHORT[s.month]} · {s.why}{' '}
                  <button onClick={() => focusCell(s.key)} className="cursor-pointer underline underline-offset-2">
                    ไปที่ช่องนั้น
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-warn-ink">
              ถ้าตัวเลขถูกแล้วก็ส่งได้ตามปกติ — ตัวเตือนนี้ไม่ได้กันการส่ง
            </p>
          </div>
        )}

        {erasing.length > 0 && (
          <div className="mt-4 rounded-xl2 border border-danger-edge bg-danger-soft p-4" role="alert">
            <p className="flex items-center gap-2 font-semibold text-danger-ink">
              <IconAlert className="h-4 w-4" />
              ระวัง — กำลังลบตัวเลขเดิมทิ้ง {erasing.length} ช่อง
            </p>
            <ul className="mt-2 space-y-1 text-sm text-danger-ink">
              {erasing.map((e) => (
                <li key={e.key}>
                  {e.label} · {MONTHS_SHORT[e.month]} · เดิม{' '}
                  <b>{e.was.toLocaleString('en-US')}</b> → ว่าง{' '}
                  <button onClick={() => revertCell(e.key)} className="cursor-pointer underline underline-offset-2">
                    คืนค่าเดิม
                  </button>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-sm text-danger-ink">
              ถ้าตั้งใจว่าเดือนนั้นไม่มีรายการ ให้พิมพ์ <span className="font-mono">-</span>{' '}
              แทนการปล่อยว่าง
            </p>
          </div>
        )}

        <div ref={commitRef} className="scroll-mt-32">
          <CommitPanel
            count={changedCount ? 1 : 0}
            actionLabel={`ส่งที่แก้ไว้ ${changedCount} รายการ`}
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
