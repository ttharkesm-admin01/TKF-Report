import { expectedFolder } from '@/lib/photos';

/** ยังไม่มีรูป — บอกให้ชัดว่าต้องเอาไปวางที่ไหนและสั่งอะไรต่อ */
export function PhotoEmpty({ blockId }: { blockId: string }) {
  return (
    <div className="flex flex-1 flex-col items-center justify-center rounded-[1cqw] border-[0.3cqw] border-dashed border-line text-center">
      <p className="text-[2.2cqw] font-semibold text-ink-soft">ยังไม่มีรูป</p>
      <p className="mt-[1cqw] text-[1.5cqw] text-ink-soft">
        วางไฟล์ไว้ที่ <span className="font-mono">{expectedFolder(blockId)}</span>
      </p>
      <p className="mt-[0.6cqw] text-[1.5cqw] text-ink-soft">
        แล้วสั่ง <span className="font-mono">npm run photos</span>
      </p>
    </div>
  );
}
