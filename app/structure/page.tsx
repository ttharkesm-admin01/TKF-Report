'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import sectionsConfig from '@/config/sections.json';
import { readJsonFile } from '@/lib/github';
import { useToken } from '@/lib/useToken';
import { formatJsonFile } from '@/lib/jsonFormat';
import {
  ADDABLE,
  addBlock,
  blockDataCount,
  moveBlock,
  newBlock,
  patchBlock,
  removeBlock,
  type RawBlock,
  type RawConfig,
} from '@/lib/structure';
import { BLOCK_LABEL } from '@/lib/deck';
import type { BlockType } from '@/shared/schema';
import { ListTableEditor } from '@/components/structure/ListTableEditor';
import { CommitPanel } from '@/components/arrange/CommitPanel';

const CONFIG_PATH = 'config/sections.json';

export default function StructurePage() {
  /** ของสดจากรีโป · null = ยังไม่ได้โหลด */
  const [base, setBase] = useState<string | null>(null);
  const [cfg, setCfg] = useState<RawConfig | null>(null);
  const [status, setStatus] = useState('');
  const [open, setOpen] = useState<string | null>(null);
  const [adding, setAdding] = useState<string | null>(null);
  const [newType, setNewType] = useState<string>(ADDABLE[0].type);
  const [newTitle, setNewTitle] = useState('');

  const token = useToken();

  const load = useCallback(async () => {
    if (!token) {
      setStatus('ยังไม่มีโทเคน — ใส่ในกรอบล่างสุดแล้วกดโหลดใหม่');
      return;
    }
    setStatus('กำลังโหลดของสดจาก GitHub…');
    try {
      const live = await readJsonFile<RawConfig>(token, CONFIG_PATH);
      if (!live) {
        setStatus('ไม่พบไฟล์ในรีโป');
        return;
      }
      // เก็บข้อความต้นฉบับไว้เทียบตอนส่ง — จะได้รู้ว่ามีคนแก้แทรกระหว่างที่เราเปิดค้างไว้ไหม
      setBase(JSON.stringify(live));
      setCfg(live);
      setStatus('');
    } catch (e) {
      setStatus(e instanceof Error ? e.message : 'โหลดไม่สำเร็จ');
    }
  }, [token]);

  // โทเคนมาถึงเมื่อไร (พิมพ์ในกรอบล่างสุด) หน้าดึงของสดเองทันที ไม่ต้องกดโหลดใหม่
  useEffect(() => {
    void load();
  }, [load]);

  const dirty = cfg !== null && base !== null && JSON.stringify(cfg) !== base;

  /**
   * อ่านของสดอีกครั้งตอนกดส่ง ถ้ามีคนแก้แทรกให้หยุดไว้ก่อน
   * หน้านี้เขียนทั้งไฟล์ ไม่ใช่แค่ช่องเดียว การทับกันจึงเสียหายกว่าหน้า /edit มาก
   */
  const getFiles = async (token: string) => {
    const live = await readJsonFile<RawConfig>(token, CONFIG_PATH);
    if (live && JSON.stringify(live) !== base) {
      throw new Error('มีคนแก้ไฟล์นี้ระหว่างที่หน้านี้เปิดค้างอยู่ — กดโหลดใหม่แล้วทำอีกครั้ง');
    }
    return [{ path: CONFIG_PATH, content: formatJsonFile(cfg as never) }];
  };

  if (!cfg) {
    return (
      <main className="mx-auto max-w-3xl px-6 py-10">
        <Link href="/" className="text-brand hover:underline">← สารบัญ</Link>
        <h1 className="mt-3 text-2xl font-bold text-brand-deep">แก้โครงสร้างเด็ค</h1>
        <p className="mt-3 rounded bg-amber-50 px-4 py-3 text-sm text-amber-800">
          {status || 'กำลังโหลด…'}
        </p>
        <button onClick={() => void load()}
          className="mt-3 rounded border border-brand px-4 py-2 text-sm font-semibold text-brand">
          โหลดใหม่
        </button>
        <CommitPanel count={0} getFiles={async () => []} message="" disabled onDone={() => {}} />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-4xl px-6 py-10">
      <Link href="/" className="text-brand hover:underline">← สารบัญ</Link>
      <h1 className="mt-3 text-2xl font-bold text-brand-deep">แก้โครงสร้างเด็ค</h1>
      <p className="mt-2 text-sm text-ink-soft">
        เพิ่ม ลบ เปลี่ยนชื่อ และสลับลำดับตารางได้จากหน้านี้ · ตารางรายการกำหนดคอลัมน์และแถวได้ด้วย
        <br />
        <b>ลำดับบล็อกคือลำดับสไลด์</b> · เลขหัวข้อ (2.1, 2.2…) มาจากลำดับหัวข้อ แก้ที่นี่ไม่ได้
      </p>

      {status && (
        <p className="mt-3 rounded bg-amber-50 px-4 py-2.5 text-sm text-amber-800">{status}</p>
      )}

      <div className="mt-4 flex items-center gap-3 text-sm">
        <button onClick={() => void load()}
          className="rounded border border-line px-3 py-1.5 text-ink-soft hover:bg-neutral-50">
          โหลดใหม่จากรีโป
        </button>
        {dirty && <span className="font-medium text-accent">มีการแก้ที่ยังไม่ได้ส่ง</span>}
      </div>

      {cfg.sections.map((s, si) => (
        <section key={s.key} className="mt-7">
          <h2 className="border-b border-line pb-1.5 text-lg font-semibold">
            <span className="font-mono text-brand">
              {String(sectionsConfig.department)}.{si + 1}
            </span>{' '}
            {s.title}
          </h2>

          <ul className="mt-3 space-y-2">
            {s.blocks.map((b, bi) => {
              const rows = blockDataCount(b);
              return (
                <li key={b.id} className="rounded border border-line p-2.5">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="shrink-0 rounded bg-brand-soft px-2 py-0.5 text-xs font-medium text-brand-deep">
                      {BLOCK_LABEL[b.type as BlockType] ?? b.type}
                    </span>

                    <input
                      value={b.title ?? ''}
                      onChange={(e) => setCfg(patchBlock(cfg, b.id, { title: e.target.value }))}
                      placeholder={b.type === 'cover' ? '(ปกใช้ชื่อหัวข้อเอง)' : 'ชื่อตาราง'}
                      disabled={b.type === 'cover' || b.type === 'closing'}
                      className="min-w-0 flex-1 rounded border border-line px-2 py-1 text-sm disabled:bg-neutral-100"
                    />

                    <span className="shrink-0 font-mono text-[11px] text-ink-soft">{b.id}</span>

                    <button onClick={() => setCfg(moveBlock(cfg, b.id, -1))} disabled={bi === 0}
                      className="rounded border border-line px-2 text-sm disabled:opacity-30">▲</button>
                    <button onClick={() => setCfg(moveBlock(cfg, b.id, 1))} disabled={bi === s.blocks.length - 1}
                      className="rounded border border-line px-2 text-sm disabled:opacity-30">▼</button>

                    {b.type === 'list-table' && (
                      <button onClick={() => setOpen(open === b.id ? null : b.id)}
                        className="rounded border border-brand px-2 py-1 text-xs font-medium text-brand">
                        {open === b.id ? 'ปิด' : 'แก้ตาราง'}
                      </button>
                    )}

                    <button
                      onClick={() => {
                        const warn = rows
                          ? `ตารางนี้มีข้อมูลอยู่ ${rows} ${b.type === 'monthly-matrix' ? 'ช่อง' : 'แถว'}\n`
                          : '';
                        if (confirm(`${warn}ลบ "${b.title ?? b.id}" ออกจากเด็ค?`))
                          setCfg(removeBlock(cfg, b.id));
                      }}
                      className="rounded border border-line px-2 py-1 text-xs text-red-600 hover:bg-red-50"
                    >
                      ลบ
                    </button>
                  </div>

                  {open === b.id && b.type === 'list-table' && (
                    <ListTableEditor
                      block={b}
                      onChange={(patch) => setCfg(patchBlock(cfg, b.id, patch))}
                    />
                  )}
                </li>
              );
            })}
          </ul>

          {adding === s.key ? (
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded border border-brand bg-brand-soft/40 p-2">
              <select value={newType} onChange={(e) => setNewType(e.target.value)}
                className="rounded border border-line bg-white px-2 py-1 text-sm">
                {ADDABLE.map((a) => (
                  <option key={a.type} value={a.type}>{a.label}</option>
                ))}
              </select>
              <input autoFocus value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
                placeholder="ชื่อตาราง" className="min-w-0 flex-1 rounded border border-line px-2 py-1 text-sm" />
              <button
                disabled={!newTitle.trim()}
                onClick={() => {
                  setCfg(addBlock(cfg, s.key, newBlock(cfg, newType, newTitle.trim())));
                  setNewTitle('');
                  setAdding(null);
                }}
                className="rounded bg-brand px-3 py-1 text-sm font-semibold text-white disabled:opacity-40"
              >
                เพิ่ม
              </button>
              <button onClick={() => { setAdding(null); setNewTitle(''); }}
                className="rounded border border-line px-3 py-1 text-sm text-ink-soft">ยกเลิก</button>
            </div>
          ) : (
            <button onClick={() => setAdding(s.key)}
              className="mt-2 rounded border border-dashed border-line px-3 py-1.5 text-sm text-ink-soft hover:border-brand hover:text-brand">
              + เพิ่มตารางในหัวข้อนี้
            </button>
          )}
        </section>
      ))}

      <CommitPanel
        count={dirty ? 1 : 0}
        getFiles={getFiles}
        message="Update deck structure"
        disabled={!dirty}
        onDone={() => void load()}
      />
    </main>
  );
}
