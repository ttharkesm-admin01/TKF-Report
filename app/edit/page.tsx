'use client';

import { useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import sectionsConfig from '@/config/sections.json';
import roundConfig from '@/config/round.json';
import { entrySections, monthIndex, monthLabel, prevMonthLabel, totalCells } from '@/lib/entry';
import { formatJsonFile } from '@/lib/jsonFormat';
import { formatCell, type Cell } from '@/shared/schema';
import { CommitPanel } from '@/components/arrange/CommitPanel';

const STORAGE = `entry:${roundConfig.year}-${roundConfig.month}`;

/** คีย์ของช่องหนึ่งช่อง */
const cellKey = (blockId: string, rowKey: string) => `${blockId}.${rowKey}`;

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
  const [text, setText] = useState<Record<string, string>>({});
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE);
      if (raw) {
        const saved = JSON.parse(raw) as Record<string, Cell>;
        setEdits(saved);
        setText(
          Object.fromEntries(
            Object.entries(saved).map(([k, v]) => [k, typeof v === 'number' ? String(v) : '']),
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
      localStorage.setItem(STORAGE, JSON.stringify(edits));
    } catch {
      /* ไม่เป็นไร */
    }
  }, [edits, loaded]);

  const valueOf = (blockId: string, rowKey: string, fallback: Cell): Cell => {
    const k = cellKey(blockId, rowKey);
    return k in edits ? edits[k] : fallback;
  };

  const setCell = (blockId: string, rowKey: string, v: Cell) =>
    setEdits((p) => ({ ...p, [cellKey(blockId, rowKey)]: v }));

  const filled = useMemo(() => {
    let n = 0;
    for (const s of entrySections)
      for (const b of s.blocks)
        for (const r of b.rows) if (valueOf(b.blockId, r.rowKey, r.current) !== null) n += 1;
    return n;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [edits]);

  /** ประกอบ sections.json ใหม่โดยแตะเฉพาะช่องของเดือนนี้ */
  const nextConfig = useMemo(() => {
    const clone = JSON.parse(JSON.stringify(sectionsConfig)) as typeof sectionsConfig;
    for (const section of clone.sections as Array<{ blocks: Array<Record<string, unknown>> }>) {
      for (const block of section.blocks) {
        if (block.type !== 'monthly-matrix') continue;
        const rows = block.rows as Array<{ key: string; values: Cell[] }> | undefined;
        if (!rows) continue;
        for (const row of rows) {
          const k = cellKey(block.id as string, row.key);
          if (k in edits) row.values[monthIndex] = edits[k];
        }
      }
    }
    return clone;
  }, [edits]);

  const changedCount = Object.keys(edits).length;

  const commitList = changedCount
    ? [{ path: 'config/sections.json', content: formatJsonFile(nextConfig as never) }]
    : [];

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
      </p>

      <p className="mt-4 rounded bg-brand-soft px-4 py-2.5 text-sm">
        กรอกแล้ว <b>{filled}</b> จาก {totalCells} ช่อง
        {changedCount > 0 && <> · แก้ในรอบนี้ {changedCount} ช่อง</>}
      </p>

      {entrySections.map((s) => (
        <section key={s.key} className="mt-8">
          <h2 className="border-b border-line pb-1.5 text-lg font-semibold">
            <span className="font-mono text-brand">{s.number}</span> {s.title}
          </h2>

          {s.blocks.map((b) => (
            <div key={b.blockId} className="mt-4">
              <h3 className="text-sm font-medium text-ink-soft">{b.title}</h3>

              <ul className="mt-2 divide-y divide-line">
                {b.rows.map((r) => {
                  const k = cellKey(b.blockId, r.rowKey);
                  const v = valueOf(b.blockId, r.rowKey, r.current);
                  const isNone = v === 'none';
                  return (
                    <li key={r.rowKey} className="flex flex-wrap items-center gap-2 py-2">
                      <span className="min-w-0 flex-1 text-sm">
                        {r.label}
                        {r.note && (
                          <span className="ml-1 text-xs text-accent" title={r.note}>
                            *
                          </span>
                        )}
                      </span>

                      {prevMonthLabel && (
                        <span className="w-28 shrink-0 text-right font-mono text-xs text-ink-soft">
                          {prevMonthLabel} {formatCell(r.previous, r.unit) || '—'}
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
                        className="w-28 shrink-0 rounded border border-line px-2 py-1 text-right font-mono text-sm tabular-nums disabled:bg-neutral-100"
                      />

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
                    </li>
                  );
                })}
              </ul>
            </div>
          ))}
        </section>
      ))}

      <CommitPanel
        files={commitList}
        message={`Fill ${monthLabel} ${roundConfig.year} figures (${changedCount} cells)`}
        disabled={changedCount === 0}
        onDone={() => {
          setEdits({});
          setText({});
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
