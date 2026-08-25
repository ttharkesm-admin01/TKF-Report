import type { NextConfig } from 'next';

// GitHub Pages เสิร์ฟที่ /<ชื่อรีโป> ไม่ใช่รากโดเมน
// ตอน dev ในเครื่องไม่ต้องตั้ง ปล่อยว่างไว้ URL จะได้สั้นเหมือนเดิม
const basePath = process.env.PAGES_BASE_PATH ?? '';

const nextConfig: NextConfig = {
  basePath,
  // รูปใน public/ ต้องเติมคำนำหน้าเองเพราะเราใช้ <img> ธรรมดา ไม่ใช่ next/image
  env: { NEXT_PUBLIC_BASE_PATH: basePath },
  // เอาต์พุตเป็นไฟล์นิ่ง — เปิดจากที่โฮสต์ไหนก็ได้ ไม่ต้องมี Node บนเครื่องผู้ใช้
  // ถ้าภายหลังต้องมีหน้ากรอกข้อมูลที่เขียนกลับ ค่อยถอดบรรทัดนี้ออก
  output: 'export',
  images: { unoptimized: true },
  typedRoutes: true,
};

export default nextConfig;
