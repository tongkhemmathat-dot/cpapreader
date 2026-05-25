# CPAP Analyzer (Aeonmed AS100A)

PWA สำหรับถ่ายรูปหน้าจอเครื่อง CPAP แล้วให้ Claude vision วิเคราะห์ผล

## รันบนเครื่อง

```bash
npm install
cp .env.example .env.local   # ใส่ ANTHROPIC_API_KEY
npm run dev
```

เปิด `http://localhost:3000` — บน iPhone ในวง LAN เดียวกันให้เข้า `http://<ip-เครื่อง>:3000`

## Deploy บน Vercel (วิธีที่ง่ายที่สุด)

1. Push โค้ดขึ้น GitHub
2. ไปที่ [vercel.com/new](https://vercel.com/new) → Import repo
3. ตั้งค่า Environment Variable: `ANTHROPIC_API_KEY`
4. Deploy → ได้ URL `https://xxx.vercel.app`
5. บน iPhone เปิดด้วย Safari → กดปุ่ม Share → **Add to Home Screen** → ใช้เหมือนแอปได้เลย

## วิธีใช้

1. เปิดแอป → กด "ถ่ายรูปหน้าจอ CPAP"
2. iOS จะเปิดกล้องให้ ถ่ายภาพหน้าจอ Aeonmed AS100A ที่แสดงผลสรุป
3. รอประมาณ 5-15 วินาที จะได้ผลวิเคราะห์ AHI, leak, ชั่วโมงใช้งาน พร้อมคำแนะนำ

## ไอคอนแอป (ทำเพิ่มทีหลังก็ได้)

วาง `icon-192.png` กับ `icon-512.png` ไว้ใน `public/` เพื่อให้ปุ่ม Add to Home Screen มีไอคอนสวย

## ข้อจำกัด

- ความแม่นยำขึ้นกับคุณภาพภาพ — ถ่ายตรง ๆ ไม่เอียง แสงพอดี
- ไม่ใช่อุปกรณ์การแพทย์ ใช้ดูแนวโน้มเบื้องต้นเท่านั้น
