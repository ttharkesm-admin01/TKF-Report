import type { NextConfig } from 'next';

const nextConfig: NextConfig = {
  // เอาต์พุตเป็นไฟล์นิ่ง — เปิดจากที่โฮสต์ไหนก็ได้ ไม่ต้องมี Node บนเครื่องผู้ใช้
  // ถ้าภายหลังต้องมีหน้ากรอกข้อมูลที่เขียนกลับ ค่อยถอดบรรทัดนี้ออก
  output: 'export',
  images: { unoptimized: true },
  typedRoutes: true,
};

export default nextConfig;
