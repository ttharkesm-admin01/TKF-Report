'use client';

import { useEffect, useState } from 'react';
import { commitFiles, repo, tokenPageUrl, type CommitFile, type CommitProgress } from '@/lib/github';

const TOKEN_KEY = 'github-token';

/**
 * ส่งรูปเข้ารีโป
 *
 * โทเคนเก็บไว้ในเบราว์เซอร์เครื่องนี้เท่านั้น ไม่ได้ส่งไปที่ไหนนอกจาก api.github.com
 * ใครเปิดเครื่องนี้ได้ก็อ่านได้ จึงควรใช้ fine-grained token
 * ที่จำกัดเฉพาะรีโปนี้ สิทธิ์ Contents เท่านั้น และตั้งวันหมดอายุไว้
 */
export function CommitPanel({
  files,
  message,
  disabled,
  onDone,
}: {
  files: CommitFile[];
  message: string;
  disabled?: boolean;
  onDone: () => void;
}) {
  const [token, setToken] = useState('');
  const [remember, setRemember] = useState(true);
  const [progress, setProgress] = useState<CommitProgress | null>(null);
  const [error, setError] = useState('');
  const [result, setResult] = useState<{ url: string } | null>(null);

  useEffect(() => {
    try {
      setToken(localStorage.getItem(TOKEN_KEY) ?? '');
    } catch {
      /* เบราว์เซอร์ปิด storage — พิมพ์โทเคนใหม่ทุกครั้งแทน */
    }
  }, []);

  async function send() {
    setError('');
    setResult(null);
    setProgress({ done: 0, total: 1, label: 'เริ่ม' });

    try {
      if (remember) localStorage.setItem(TOKEN_KEY, token);
      else localStorage.removeItem(TOKEN_KEY);
    } catch {
      /* ไม่เป็นไร */
    }

    try {
      const r = await commitFiles(token.trim(), message, files, setProgress);
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
    <section className="mt-8 rounded-lg border border-line p-5">
      <h2 className="text-lg font-semibold">ส่งเข้าระบบ</h2>
      <p className="mt-1 text-sm text-ink-soft">
        ส่งเข้ารีโป <span className="font-mono">{repo.owner}/{repo.repo}</span> บรานช์{' '}
        <span className="font-mono">{repo.branch}</span> แล้วเว็บจะ build ใหม่เองใน ~1 นาที
      </p>

      <label className="mt-4 block text-sm font-medium">
        GitHub Personal Access Token
        <input
          type="password"
          value={token}
          onChange={(e) => setToken(e.target.value)}
          placeholder="github_pat_..."
          className="mt-1 block w-full rounded border border-line px-3 py-2 font-mono text-sm"
        />
      </label>

      <label className="mt-2 flex items-center gap-2 text-sm text-ink-soft">
        <input
          type="checkbox"
          checked={remember}
          onChange={(e) => setRemember(e.target.checked)}
        />
        จำโทเคนไว้ในเบราว์เซอร์เครื่องนี้
      </label>

      <p className="mt-2 text-xs text-ink-soft">
        ยังไม่มีโทเคน?{' '}
        <a href={tokenPageUrl} target="_blank" rel="noreferrer" className="text-brand underline">
          สร้างที่นี่
        </a>{' '}
        — เลือก Repository access = เฉพาะ <span className="font-mono">{repo.repo}</span> ·
        Permissions → Contents = <b>Read and write</b> · ตั้งวันหมดอายุด้วย
      </p>

      <div className="mt-4 flex items-center gap-3">
        <button
          onClick={() => void send()}
          disabled={running || disabled || !token.trim() || files.length === 0}
          className="rounded bg-brand px-5 py-2.5 font-semibold text-white hover:bg-brand-deep disabled:opacity-40"
        >
          {running ? 'กำลังส่ง…' : `ส่ง ${files.length} ไฟล์`}
        </button>

        {progress && (
          <span className="text-sm text-ink-soft">
            {progress.label} · {pct}%
          </span>
        )}
      </div>

      {progress && (
        <div className="mt-3 h-2 overflow-hidden rounded bg-neutral-200">
          <div className="h-full bg-brand transition-all" style={{ width: `${pct}%` }} />
        </div>
      )}

      {error && (
        <p className="mt-3 rounded bg-red-50 px-3 py-2 text-sm text-red-700">{error}</p>
      )}

      {result && (
        <p className="mt-3 rounded bg-brand-soft px-3 py-2 text-sm">
          ส่งเรียบร้อย —{' '}
          <a href={result.url} target="_blank" rel="noreferrer" className="text-brand underline">
            ดู commit
          </a>{' '}
          · เว็บจะอัปเดตเองใน ~1 นาที
        </p>
      )}
    </section>
  );
}
