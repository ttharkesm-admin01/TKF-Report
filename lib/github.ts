/**
 * github.ts — commit ไฟล์เข้ารีโปตรงจากเบราว์เซอร์
 *
 * GitHub REST API เปิด CORS ให้เรียกจากหน้าเว็บได้ เว็บนิ่งบน GitHub Pages
 * จึงส่งรูปเข้ารีโปได้เองโดยไม่ต้องมีเซิร์ฟเวอร์ของเราเลย
 * (เป็นวิธีเดียวกับที่ Decap / Sveltia CMS ใช้)
 *
 * ใช้ Git Data API ไม่ใช่ Contents API เพราะ Contents API commit ได้ทีละไฟล์
 * รูป 300 ใบจะกลายเป็น 300 commit · ทางนี้ได้ commit เดียวจบ
 */

import repoConfig from '@/config/repo.json';

const API = 'https://api.github.com';

export const repo = repoConfig;

export interface CommitFile {
  /** เส้นทางจากรากรีโป เช่น public/photos/2569-07/g-garden-r1/001.jpg */
  path: string;
  /** เนื้อไฟล์ · Blob สำหรับรูป · string สำหรับไฟล์ข้อความ */
  content: Blob | string;
}

async function gh<T>(token: string, path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(API + path, {
    ...init,
    headers: {
      Accept: 'application/vnd.github+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
      ...(init?.body ? { 'Content-Type': 'application/json' } : {}),
      ...init?.headers,
    },
  });

  if (!res.ok) {
    const body = await res.text();
    // ข้อความจาก GitHub เป็นภาษาอังกฤษล้วน แปลเคสที่เจอบ่อยให้เข้าใจง่าย
    if (res.status === 401) throw new Error('โทเคนไม่ถูกต้องหรือหมดอายุแล้ว');
    if (res.status === 403 || res.status === 404) {
      throw new Error(
        `โทเคนไม่มีสิทธิ์เขียนรีโป ${repo.owner}/${repo.repo} — ตรวจว่าเลือกรีโปนี้และให้สิทธิ์ Contents: Read and write แล้ว`,
      );
    }
    throw new Error(`GitHub ตอบ ${res.status}: ${body.slice(0, 200)}`);
  }

  return res.json() as Promise<T>;
}

/** Blob → base64 (ไม่มี prefix data:) */
function toBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const r = new FileReader();
    r.onerror = () => reject(new Error('อ่านไฟล์ไม่สำเร็จ'));
    r.onload = () => resolve(String(r.result).split(',')[1] ?? '');
    r.readAsDataURL(blob);
  });
}

/** ยิงหลายงานพร้อมกันแบบจำกัดจำนวน — ยิงรวดเดียว 300 งาน GitHub จะปฏิเสธ */
async function mapLimit<T, R>(
  items: T[],
  limit: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const out: R[] = new Array(items.length);
  let next = 0;
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, async () => {
      for (;;) {
        const i = next++;
        if (i >= items.length) return;
        out[i] = await fn(items[i], i);
      }
    }),
  );
  return out;
}

export interface CommitProgress {
  done: number;
  total: number;
  label: string;
}

/**
 * commit ไฟล์ทั้งชุดเป็น commit เดียว
 * ขั้นตอน: อัปโหลดเนื้อไฟล์ทีละก้อน → ประกอบเป็นต้นไม้ → สร้าง commit → ขยับ branch
 */
export async function commitFiles(
  token: string,
  message: string,
  files: CommitFile[],
  onProgress?: (p: CommitProgress) => void,
): Promise<{ sha: string; url: string }> {
  const { owner, repo: name, branch } = repo;
  const base = `/repos/${owner}/${name}`;

  const report = (done: number, total: number, label: string) =>
    onProgress?.({ done, total, label });

  report(0, files.length + 3, 'อ่านสถานะบรานช์');
  const ref = await gh<{ object: { sha: string } }>(token, `${base}/git/ref/heads/${branch}`);
  const headSha = ref.object.sha;

  const headCommit = await gh<{ tree: { sha: string } }>(
    token,
    `${base}/git/commits/${headSha}`,
  );

  // อัปโหลดเนื้อไฟล์ทีละก้อน ยังไม่ผูกกับ commit ใด
  let uploaded = 0;
  const blobs = await mapLimit(files, 4, async (f) => {
    const isText = typeof f.content === 'string';
    const body = isText
      ? { content: f.content as string, encoding: 'utf-8' }
      : { content: await toBase64(f.content as Blob), encoding: 'base64' };

    const blob = await gh<{ sha: string }>(token, `${base}/git/blobs`, {
      method: 'POST',
      body: JSON.stringify(body),
    });

    uploaded += 1;
    report(uploaded, files.length + 3, `ส่งไฟล์ ${uploaded}/${files.length}`);
    return { path: f.path, mode: '100644' as const, type: 'blob' as const, sha: blob.sha };
  });

  report(files.length + 1, files.length + 3, 'ประกอบต้นไม้ไฟล์');
  const tree = await gh<{ sha: string }>(token, `${base}/git/trees`, {
    method: 'POST',
    body: JSON.stringify({ base_tree: headCommit.tree.sha, tree: blobs }),
  });

  report(files.length + 2, files.length + 3, 'สร้าง commit');
  const commit = await gh<{ sha: string; html_url: string }>(token, `${base}/git/commits`, {
    method: 'POST',
    body: JSON.stringify({ message, tree: tree.sha, parents: [headSha] }),
  });

  report(files.length + 3, files.length + 3, 'ขยับบรานช์');
  await gh(token, `${base}/git/refs/heads/${branch}`, {
    method: 'PATCH',
    body: JSON.stringify({ sha: commit.sha }),
  });

  return { sha: commit.sha, url: commit.html_url };
}

/** ลิงก์สร้างโทเคนที่เลือกสิทธิ์ให้เสร็จแล้ว */
export const tokenPageUrl = 'https://github.com/settings/personal-access-tokens/new';

/** ที่เก็บโทเคนในเบราว์เซอร์ — ใช้ร่วมกันทุกหน้า */
export const TOKEN_KEY = 'github-token';

export const storedToken = (): string => {
  try {
    return localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    return '';
  }
};

/**
 * อ่านไฟล์ตัวปัจจุบันจากบรานช์ — **ไม่ใช่** ตัวที่ฝังมาตอน build
 *
 * เว็บเป็นไฟล์นิ่ง `config/sections.json` ที่ import เข้ามาจึงเป็นภาพนิ่งของตอน build
 * ถ้าเอาตัวนั้นมาเป็นฐานแล้วเขียนทับ ข้อมูลที่คนอื่น (หรือตัวเราเองเมื่อกี้) ส่งไป
 * ระหว่างที่เว็บยังไม่ build ใหม่ จะหายไปเงียบ ๆ — ต้องอ่านของสดตอนจะเขียนเสมอ
 *
 * คืน null ถ้ายังไม่มีไฟล์นั้นในรีโป
 */
export async function readJsonFile<T>(token: string, path: string): Promise<T | null> {
  const { owner, repo: name, branch } = repo;
  const url = `/repos/${owner}/${name}/contents/${path}?ref=${encodeURIComponent(branch)}`;

  const res = await fetch(API + url, {
    headers: {
      Accept: 'application/vnd.github.raw+json',
      Authorization: `Bearer ${token}`,
      'X-GitHub-Api-Version': '2022-11-28',
    },
  });

  if (res.status === 404) return null;
  if (res.status === 401) throw new Error('โทเคนไม่ถูกต้องหรือหมดอายุแล้ว');
  if (!res.ok) throw new Error(`อ่าน ${path} จาก GitHub ไม่ได้ (${res.status})`);

  return JSON.parse(await res.text()) as T;
}
