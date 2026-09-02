'use client';

/**
 * กระโดดไปหัวข้อในเล่ม
 *
 * เด็คยาว 60 หน้าเรียงต่อกันหน้าเดียว · ของเดิมจะไปหัวข้อกลางเล่มต้องเลื่อนเมาส์เอา
 * หรือย้อนกลับไปกดสารบัญที่หน้าแรกแล้วเข้ามาใหม่ · ตอนตรวจก่อนนำเสนอต้องเด้งไปมาบ่อย
 */
export function DeckJump({
  sections,
}: {
  /** หัวข้อทั้งเล่ม พร้อม id ของสไลด์แรกในหัวข้อนั้น */
  sections: Array<{ key: string; number: string; title: string; anchor: string }>;
}) {
  return (
    <label className="flex min-w-0 items-center gap-2 text-sm text-muted">
      ไปที่หัวข้อ
      <select
        // เลือกแล้วคืนค่ากลับเป็นช่องว่างเสมอ — เลือกหัวข้อเดิมซ้ำก็ยังกระโดดได้
        value=""
        onChange={(e) => {
          document.getElementById(e.target.value)?.scrollIntoView({ block: 'start' });
          e.target.value = '';
        }}
        className="field h-9 w-auto max-w-[18rem] min-w-0 py-1"
      >
        <option value="">เลือกหัวข้อ…</option>
        <option value="title">ปกเล่ม</option>
        {sections.map((s) => (
          <option key={s.key} value={s.anchor}>
            {s.number} {s.title}
          </option>
        ))}
      </select>
    </label>
  );
}
