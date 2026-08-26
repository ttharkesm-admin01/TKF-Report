'use client';

/**
 * useToken.ts — โทเคน GitHub ที่ทั้งหน้าใช้ร่วมกัน
 *
 * เดิมโทเคนอยู่ใน state ของ `CommitPanel` ซึ่งอยู่ท้ายหน้า ตัวหน้าเองจึงเห็นแค่
 * ค่าที่เคยเก็บไว้ใน localStorage ตอน mount · ใครเพิ่งพิมพ์โทเคนครั้งแรก
 * หน้าจะไม่มีทางรู้ และไม่ได้ดึงของสดจากรีโปมาเทียบเลยทั้งรอบ
 * ผลคือตัวเตือน "กำลังลบตัวเลขเดิม" เทียบกับค่าตอน build แล้วเงียบทั้งที่ควรฟ้อง
 *
 * ย้ายมาไว้ที่เดียวแล้วให้ทุกคนมาสมัครรับฟัง · พิมพ์โทเคนเสร็จ หน้าดึงของสดเอง
 */

import { useSyncExternalStore } from 'react';
import { TOKEN_KEY } from './github';

/** null = ยังไม่เคยอ่านจาก localStorage */
let cache: string | null = null;
const subscribers = new Set<() => void>();

function snapshot(): string {
  if (cache !== null) return cache;
  try {
    cache = localStorage.getItem(TOKEN_KEY) ?? '';
  } catch {
    cache = '';
  }
  return cache;
}

/**
 * ตั้งโทเคนที่ใช้อยู่
 * `remember` false = ใช้ได้ในหน้านี้จนกว่าจะปิด แต่ไม่เก็บลงเครื่อง
 */
export function setToken(value: string, remember: boolean): void {
  cache = value;
  try {
    if (remember && value) localStorage.setItem(TOKEN_KEY, value);
    else localStorage.removeItem(TOKEN_KEY);
  } catch {
    /* เบราว์เซอร์ปิด storage — ใช้ในหน่วยความจำอย่างเดียว */
  }
  for (const notify of subscribers) notify();
}

function subscribe(onChange: () => void): () => void {
  subscribers.add(onChange);
  return () => {
    subscribers.delete(onChange);
  };
}

/** ตอน prerender ยังไม่มี localStorage — คืนค่าว่างไว้ก่อนแล้วค่อยอัปเดตตอน hydrate */
const serverSnapshot = () => '';

export const useToken = (): string =>
  useSyncExternalStore(subscribe, snapshot, serverSnapshot);
