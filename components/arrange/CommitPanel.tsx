'use client';

import { useEffect, useState } from 'react';
import { commitFiles, repo, tokenPageUrl, type CommitFile, type CommitProgress } from '@/lib/github';
import { setToken, useToken } from '@/lib/useToken';
import { IconCheck, IconUpload } from '@/components/ui/icons';

/**
 * ส่งรูปเข้ารีโป
 *
 * โทเคนเก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น ไม่ได้ส่งไปที่ไหนนอกจาก api.github.com
 * ใครเปิดเครื่องนี้ได้ก็อ่านได้ จึงควรใช้ fine-grained token
 * ที่จำกัดเฉพาะรีโปนี้ สิทธิ์ Contents เท่านั้น และตั้งวันหมดอายุไว้
 */
export function CommitPanel({
  count,
  getFiles,
  message,
  disabled,
  summary,
  onDone,
}: {
  /** จำนวนไฟล์ที่จะส่ง — ไว้โชว์บนปุ่มเท่านั้น */
  count: number;
  /**
   * ประกอบไฟล์ตอนกดส่ง ไม่ใช่ตอน render
   * หน้าที่ต้องอ่านของสดจาก GitHub ก่อนเขียนทับจะได้ทำตรงนี้ได้
   */
  getFiles: (token: string) => Promise<CommitFile[]>;
  message: string;
  disabled?: boolean;
  /** สรุปสั้น ๆ ว่ากำลังจะส่งอะไรไปบ้าง — แสดงเหนือปุ่ม */
  summary?: React.ReactNode;
  onDone: () => void;
}) {
  // โทเคนอยู่ที่ส่วนกลาง หน้าที่ครอบอยู่จะได้ดึงของสดจากรีโปทันทีที่พิมพ์เสร็จ
  const token = useToken();
  const [draft, setDraft] = useState(token);
  const [remember, setRemember] = useState(true);
  const [progress, setProgress] = useState<CommitProgress | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string } | null>(null);

  // โทเคนที่เก็บไว้ในเครื่องอ่านได้หลัง hydrate เท่านั้น
  useEffect(() => {
    setDraft((d) => (d ? d : token));
  }, [token]);

  /**
   * ประกาศให้ทั้งหน้ารู้ตอนพิมพ์เสร็จ ไม่ใช่ทุกตัวอักษร
   * โทเคนที่พิมพ์ค้างครึ่งเดียวยิงไปก็ได้ 401 กลับมาเปล่า ๆ
   */
  const publish = () => {
    if (draft.trim() !== token) setToken(draft.trim(), remember);
  };

  async function send() {
    setError('');
    setResult(null);
    setProgress({ done: 0, total: 1, label: 'เริ่ม' });

    const t = draft.trim();
    setToken(t, remember);

    try {
      // ประกอบไฟล์ตรงนี้ ไม่ใช่ตอน render — หน้าที่ต้องอ่านของสดจะได้อ่านก่อนเขียน
      setProgress({ done: 0, total: 1, label: 'อ่านข้อมูลปัจจุบัน' });
      const files = await getFiles(t);

      const r = await commitFiles(t, message, files, setProgress);
      setResult({ url: r.url });
      onDone();
    } catch (e) {
      setError(e instanceof Error ? e.message : 'ส่งไม่สำเร็จ');
    } finally {
      setProgress(null);
    }
  }

  const running = progress !== null;
  const pct = progress ? Math.round((progress.done / Math.max(1, progress.total)) * 100) : 0;

  return (
    <section className="card mt-8 p-5">
      <h2 className="text-lg font-semibold">ส่งเข้าระบบ</h2>
      <p className="mt-1 text-sm leading-relaxed text-muted">
        ส่งเข้ารีโป <span className="font-mono">{repo.owner}/{repo.repo}</span> บรานช์{' '}
        <span className="font-mono">{repo.branch}</span> แล้วเว็บจะ build ใหม่เองใน ~1 นาที
      </p>

      <label className="mt-4 block text-sm font-medium">
        GitHub Personal Access Token
        <input
          type="password"
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          onBlur={publish}
          placeholder="github_pat_..."
          autoComplete="off"
          className="field mt-1.5 font-mono"
        />
      </label>

      <label className="mt-3 flex cursor-pointer items-center gap-2 text-sm text-muted">
        <input
          type="checkbox"
          className="h-4 w-4 accent-[var(--ui-primary)]"
          checked={remember}
          onChange={(e) => {
            setRemember(e.target.checked);
            if (draft.trim()) setToken(draft.trim(), e.target.checked);
          }}
        />
        จำโทเคนไว้ในเบราว์เซอร์เครื่องนี้
      </label>

      <p className="mt-2 text-xs leading-relaxed text-muted">
        ยังไม่มีโทเคน?{' '}
        <a
          href={tokenPageUrl}
          target="_blank"
          rel="noreferrer"
          className="font-medium text-primary underline underline-offset-2"
        >
          สร้างที่นี่
        </a>{' '}
        — เลือก Repository access = เฉพาะ <span className="font-mono">{repo.repo}</span> ·
        Permissions → Contents = <b>Read and write</b> · ตั้งวันหมดอายุด้วย
      </p>

      {summary && (
        <p className="note note-warn mt-4" role="status">
          {summary}
        </p>
      )}

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => void send()}
          disabled={running || disabled || !draft.trim() || count === 0}
          className="btn btn-primary btn-lg font-semibold"
        >
          <IconUpload className="h-4 w-4" />
          {running ? 'กำลังส่ง…' : `ส่ง ${count} ไฟล์`}
        </button>

        {progress && (
          <span className="text-sm text-muted" role="status" aria-live="polite">
            {progress.label} · {pct}%
          </span>
        )}
      </div>

      {progress && (
        <div
          className="mt-3 h-1.5 overflow-hidden rounded-full bg-surface-3"
          role="progressbar"
          aria-valuenow={pct}
          aria-valuemin={0}
          aria-valuemax={100}
        >
          <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {error && (
        <p className="note note-danger mt-3" role="alert">
          {error}
        </p>
      )}

      {result && (
        <p className="note note-brand mt-3 flex flex-wrap items-center gap-1" role="status">
          <IconCheck className="h-4 w-4" />
          ส่งเรียบร้อย —{' '}
          <a
            href={result.url}
            target="_blank"
            rel="noreferrer"
            className="font-medium underline underline-offset-2"
          >
            ดู commit
          </a>{' '}
          · เว็บจะอัปเดตเองใน ~1 นาที
        </p>
      )}
    </section>
  );
}
