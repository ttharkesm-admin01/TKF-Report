/**
 * ไอคอนเส้น เขียนเป็น SVG ในโค้ด ไม่ใช้ emoji และไม่พึ่งไลบรารีภายนอก
 *
 * เหตุผลที่ไม่ใช้ emoji หรืออักขระอย่าง ▲ ◀ : หน้าตาเปลี่ยนไปตามเครื่องและฟอนต์
 * บนเครื่องบริษัทที่ฟอนต์ไม่ครบจะกลายเป็นกล่องสี่เหลี่ยม · เส้น SVG คมเท่ากันทุกเครื่อง
 * ทุกตัวรับสีจาก `currentColor` จึงเปลี่ยนตามข้อความรอบ ๆ เองทั้งโหมดสว่างและมืด
 */

type Props = { className?: string };

const base = 'h-4 w-4 shrink-0';

function Svg({ className, children }: Props & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth={1.75}
      strokeLinecap="round"
      strokeLinejoin="round"
      aria-hidden="true"
      focusable="false"
      className={className ?? base}
    >
      {children}
    </svg>
  );
}

export const IconHome = (p: Props) => (
  <Svg {...p}><path d="M3 10.5 12 3l9 7.5" /><path d="M5.5 9.5V20h13V9.5" /></Svg>
);

export const IconTable = (p: Props) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="16" rx="2" /><path d="M3 9.5h18M9 9.5V20" /></Svg>
);

export const IconImage = (p: Props) => (
  <Svg {...p}><rect x="3" y="4.5" width="18" height="15" rx="2" /><circle cx="8.5" cy="10" r="1.5" /><path d="m4 17 4.5-4.5 3.5 3.5 3-2.5 5 4" /></Svg>
);

export const IconLayers = (p: Props) => (
  <Svg {...p}><path d="m12 3 9 5-9 5-9-5 9-5Z" /><path d="m3 13 9 5 9-5" /></Svg>
);

export const IconBook = (p: Props) => (
  <Svg {...p}>
    <path d="M4 4.5h6a2 2 0 0 1 2 2V20a2 2 0 0 0-2-2H4Z" />
    <path d="M20 4.5h-6a2 2 0 0 0-2 2V20a2 2 0 0 1 2-2h6Z" />
  </Svg>
);

export const IconPlay = (p: Props) => (
  <Svg {...p}><path d="M8 5.5v13l10-6.5-10-6.5Z" /></Svg>
);

export const IconSun = (p: Props) => (
  <Svg {...p}><circle cx="12" cy="12" r="4" /><path d="M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4" /></Svg>
);

export const IconMoon = (p: Props) => (
  <Svg {...p}><path d="M20 14.5A8 8 0 0 1 9.5 4 8.5 8.5 0 1 0 20 14.5Z" /></Svg>
);

export const IconMonitor = (p: Props) => (
  <Svg {...p}><rect x="3" y="4" width="18" height="12" rx="2" /><path d="M9 20h6M12 16v4" /></Svg>
);

export const IconPrint = (p: Props) => (
  <Svg {...p}><path d="M7 9V3h10v6" /><rect x="3" y="9" width="18" height="7" rx="2" /><path d="M7 14h10v7H7z" /></Svg>
);

export const IconPlus = (p: Props) => (
  <Svg {...p}><path d="M12 5v14M5 12h14" /></Svg>
);

export const IconTrash = (p: Props) => (
  <Svg {...p}><path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13" /></Svg>
);

export const IconUp = (p: Props) => <Svg {...p}><path d="m6 14 6-6 6 6" /></Svg>;
export const IconDown = (p: Props) => <Svg {...p}><path d="m6 10 6 6 6-6" /></Svg>;
export const IconLeft = (p: Props) => <Svg {...p}><path d="m14 6-6 6 6 6" /></Svg>;
export const IconRight = (p: Props) => <Svg {...p}><path d="m10 6 6 6-6 6" /></Svg>;

export const IconEye = (p: Props) => (
  <Svg {...p}><path d="M2 12s3.5-6 10-6 10 6 10 6-3.5 6-10 6-10-6-10-6Z" /><circle cx="12" cy="12" r="2.5" /></Svg>
);

export const IconEyeOff = (p: Props) => (
  <Svg {...p}><path d="M4 4l16 16" /><path d="M9.5 5.5A9.6 9.6 0 0 1 12 5.2c6.5 0 10 6 10 6a17 17 0 0 1-3.3 3.9" /><path d="M6.3 7.7A16.7 16.7 0 0 0 2 11.2s3.5 6 10 6a9.7 9.7 0 0 0 3.9-.8" /></Svg>
);

export const IconRefresh = (p: Props) => (
  <Svg {...p}><path d="M20 11a8 8 0 1 0-.7 4.5" /><path d="M20 5v6h-6" /></Svg>
);

export const IconUpload = (p: Props) => (
  <Svg {...p}><path d="M12 16V4m0 0L7.5 8.5M12 4l4.5 4.5" /><path d="M4 16v2.5A1.5 1.5 0 0 0 5.5 20h13a1.5 1.5 0 0 0 1.5-1.5V16" /></Svg>
);

export const IconCheck = (p: Props) => <Svg {...p}><path d="m5 12.5 4.5 4.5L19 7" /></Svg>;

export const IconAlert = (p: Props) => (
  <Svg {...p}><path d="M12 4.5 21 19.5H3L12 4.5Z" /><path d="M12 10v4M12 17h.01" /></Svg>
);

export const IconExpand = (p: Props) => (
  <Svg {...p}><path d="M9 4H4v5M15 20h5v-5M4 15v5h5M20 9V4h-5" /></Svg>
);

export const IconKey = (p: Props) => (
  <Svg {...p}><circle cx="8" cy="8" r="4" /><path d="m11 11 8 8m-3-3 2-2m-4 4 2-2" /></Svg>
);

/** เป้า — ใช้กับปุ่ม "ไปช่องว่างถัดไป" ที่หน้า /edit */
export const IconTarget = (p: Props) => (
  <Svg {...p}><circle cx="12" cy="12" r="8" /><circle cx="12" cy="12" r="3" /></Svg>
);
