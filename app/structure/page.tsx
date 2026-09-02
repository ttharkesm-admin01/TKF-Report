'use client';

import { useCallback, useEffect, useState } from 'react';
import { SiteNav } from '@/components/nav/SiteNav';
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
import { IconDown, IconPlus, IconRefresh, IconTrash, IconUp } from '@/components/ui/icons';

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
      // ใส่โทเคนแล้ว useToken จะยิง load() ให้เอง ไม่ต้องกดโหลดใหม่
      setStatus('ยังไม่มีโทเคน — หน้านี้อ่านโครงสร้างสดจากรีโป จึงต้องมีโทเคนก่อน');
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
   * หน้านี้ไม่ได้เก็บงานค้างไว้ในเบราว์เซอร์เหมือน /edit — ปิดแท็บแล้วหายจริง
   * กำหนดคอลัมน์ตารางทีละอันใช้เวลาเป็นสิบนาที ปล่อยให้หายเงียบไม่ได้
   */
  useEffect(() => {
    if (!dirty) return;
    const warn = (e: BeforeUnloadEvent) => e.preventDefault();
    window.addEventListener('beforeunload', warn);
    return () => window.removeEventListener('beforeunload', warn);
  }, [dirty]);

  /** โหลดใหม่ = ทิ้งสิ่งที่แก้ไว้ทั้งหมด ต้องถามก่อน */
  const reload = () => {
    if (dirty && !confirm('โหลดใหม่แล้วสิ่งที่แก้ไว้แต่ยังไม่ได้ส่งจะหายทั้งหมด · จะโหลดใหม่ไหม?'))
      return;
    void load();
  };

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
      <>
      <SiteNav />
      <main id="main" className="mx-auto max-w-3xl px-4 py-8 sm:px-6">
        <h1 className="text-2xl font-bold tracking-tight">แก้โครงสร้างเด็ค</h1>
        <p className="note note-warn mt-3" role="status">
          {status || 'กำลังโหลด…'}
        </p>
        <p className="mt-3 text-sm leading-relaxed text-muted">
          ใส่โทเคนในกรอบ <b>ส่งเข้าระบบ</b> ข้างล่างแล้วกดออกจากช่อง
          หน้านี้จะโหลดโครงสร้างให้เองทันที ไม่ต้องกดอะไรอีก
        </p>
        <button onClick={() => void load()} className="btn btn-outline mt-3">
          <IconRefresh className="h-4 w-4" />
          โหลดใหม่
        </button>
        <CommitPanel count={0} getFiles={async () => []} message="" disabled onDone={() => {}} />
      </main>
      </>
    );
  }

  return (
    <>
      <SiteNav />
      <main id="main" className="mx-auto max-w-4xl px-4 py-8 sm:px-6">
      <h1 className="text-2xl font-bold tracking-tight">แก้โครงสร้างเด็ค</h1>
      <p className="mt-2 text-sm leading-relaxed text-muted">
        เพิ่ม ลบ เปลี่ยนชื่อ และสลับลำดับตารางได้จากหน้านี้ · ตารางรายการกำหนดคอลัมน์และแถวได้ด้วย
        <br />
        <b>ลำดับบล็อกคือลำดับสไลด์</b> · เลขหัวข้อ (2.1, 2.2…) มาจากลำดับหัวข้อ แก้ที่นี่ไม่ได้
      </p>

      {status && (
        <p className="note note-warn mt-3" role="status">
          {status}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3 text-sm">
        <button onClick={reload} className="btn btn-outline btn-sm">
          <IconRefresh className="h-3.5 w-3.5" />
          โหลดใหม่จากรีโป
        </button>
        {dirty && (
          <span className="chip chip-warn">
            มีการแก้ที่ยังไม่ได้ส่ง — ปิดหน้านี้แล้วหาย ต้องกดส่งก่อน
          </span>
        )}
      </div>

      {cfg.sections.map((s, si) => (
        <section key={s.key} className="mt-7">
          <h2 className="border-b border-edge pb-1.5 text-lg font-semibold">
            <span className="font-mono text-primary tabular-nums">
              {String(sectionsConfig.department)}.{si + 1}
            </span>{' '}
            {s.title}
          </h2>

          <ul className="mt-3 space-y-2">
            {s.blocks.map((b, bi) => {
              const rows = blockDataCount(b);
              return (
                <li key={b.id} className="card p-2.5 transition hover:border-edge-strong">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="chip chip-brand shrink-0">
                      {BLOCK_LABEL[b.type as BlockType] ?? b.type}
                    </span>

                    <input
                      value={b.title ?? ''}
                      onChange={(e) => setCfg(patchBlock(cfg, b.id, { title: e.target.value }))}
                      placeholder={b.type === 'cover' ? '(ปกใช้ชื่อหัวข้อเอง)' : 'ชื่อตาราง'}
                      disabled={b.type === 'cover' || b.type === 'closing'}
                      aria-label={`ชื่อของบล็อก ${b.id}`}
                      className="field h-8 min-w-0 flex-1 py-1"
                    />

                    <span className="shrink-0 font-mono text-[11px] text-muted">{b.id}</span>

                    <button
                      onClick={() => setCfg(moveBlock(cfg, b.id, -1))}
                      disabled={bi === 0}
                      aria-label={`เลื่อน ${b.title ?? b.id} ขึ้น`}
                      className="btn btn-outline btn-sm w-8 px-0"
                    >
                      <IconUp className="h-3.5 w-3.5" />
                    </button>
                    <button
                      onClick={() => setCfg(moveBlock(cfg, b.id, 1))}
                      disabled={bi === s.blocks.length - 1}
                      aria-label={`เลื่อน ${b.title ?? b.id} ลง`}
                      className="btn btn-outline btn-sm w-8 px-0"
                    >
                      <IconDown className="h-3.5 w-3.5" />
                    </button>

                    {b.type === 'list-table' && (
                      <button
                        onClick={() => setOpen(open === b.id ? null : b.id)}
                        aria-expanded={open === b.id}
                        className="btn btn-sm border border-primary text-primary"
                      >
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
                      aria-label={`ลบ ${b.title ?? b.id}`}
                      className="btn btn-danger btn-sm"
                    >
                      <IconTrash className="h-3.5 w-3.5" />
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
            <div className="mt-2 flex flex-wrap items-center gap-2 rounded-xl border border-primary bg-primary-soft p-2">
              <select
                value={newType}
                onChange={(e) => setNewType(e.target.value)}
                aria-label="ชนิดของบล็อกใหม่"
                className="field h-9 w-auto py-1"
              >
                {ADDABLE.map((a) => (
                  <option key={a.type} value={a.type}>{a.label}</option>
                ))}
              </select>
              <input
                autoFocus
                value={newTitle}
                onChange={(e) => setNewTitle(e.target.value)}
                placeholder="ชื่อตาราง"
                aria-label="ชื่อตารางใหม่"
                className="field h-9 min-w-0 flex-1 py-1"
              />
              <button
                disabled={!newTitle.trim()}
                onClick={() => {
                  setCfg(addBlock(cfg, s.key, newBlock(cfg, newType, newTitle.trim())));
                  setNewTitle('');
                  setAdding(null);
                }}
                className="btn btn-primary"
              >
                เพิ่ม
              </button>
              <button
                onClick={() => {
                  setAdding(null);
                  setNewTitle('');
                }}
                className="btn btn-outline"
              >
                ยกเลิก
              </button>
            </div>
          ) : (
            <button onClick={() => setAdding(s.key)} className="btn btn-dashed mt-2">
              <IconPlus className="h-4 w-4" />
              เพิ่มตารางในหัวข้อนี้
            </button>
          )}
        </section>
      ))}

      <CommitPanel
        count={dirty ? 1 : 0}
        getFiles={getFiles}
        actionLabel="ส่งโครงสร้างที่แก้ไว้"
        message="Update deck structure"
        disabled={!dirty}
        onDone={() => void load()}
      />
      </main>
    </>
  );
}
