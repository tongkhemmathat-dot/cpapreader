# CPAP Analyzer

PWA สำหรับบันทึกและวิเคราะห์ผลจากการใช้งานเครื่อง CPAP ประจำวัน 

## ฟีเจอร์

- 📝 **กรอกข้อมูลเองง่าย ๆ:** กรอกค่า Usage, AHI, Pressure, LEAK90 ฯลฯ ได้โดยตรง
- ⚡ **วิเคราะห์ผลทันที:** ระบบมีเกณฑ์ประเมิน (Local Analysis) ทันทีไม่ต้องรอ API
- 🔒 **ความเป็นส่วนตัวสูง:** ตั้งรหัส PIN 4 หลักก่อนเข้าใช้งาน
- 📊 **บันทึกประวัติ:** ดูประวัติย้อนหลัง บันทึกลงเครื่อง (Local Storage)
- ☁️ **Cloud Sync (Optional):** ซิงค์ข้อมูลข้ามอุปกรณ์ผ่าน Supabase
- ⬇️ **Export ข้อมูล:** โหลดเป็นไฟล์ `.txt` เพื่อนำไปถาม ChatGPT / Claude ต่อได้

## รันบนเครื่อง

```bash
npm install
npm run dev
```

เปิด `http://localhost:3000` — บนมือถือในวง LAN เดียวกันให้เข้า `http://<ip-เครื่อง>:3000`

## Deploy บน Vercel (วิธีที่ง่ายที่สุด)

1. Push โค้ดขึ้น GitHub
2. ไปที่ [vercel.com/new](https://vercel.com/new) → Import repo
3. (Optional) ตั้งค่า Environment Variable สำหรับ Supabase (ถ้าต้องการใช้ระบบ Sync ข้ามอุปกรณ์)
   - `NEXT_PUBLIC_SUPABASE_URL`
   - `NEXT_PUBLIC_SUPABASE_ANON_KEY`
4. Deploy → ได้ URL `https://xxx.vercel.app`
5. บน iPhone เปิดด้วย Safari → กดปุ่ม Share → **Add to Home Screen** → ใช้เป็นแอปพลิเคชันได้เลย

## ไอคอนแอป

สามารถวาง `icon-192.png` กับ `icon-512.png` ไว้ในโฟลเดอร์ `public/` เพื่อให้ปุ่ม Add to Home Screen มีไอคอนสวยงาม

## ข้อจำกัด

- ไม่ใช่อุปกรณ์หรือแอปพลิเคชันทางการแพทย์ ใช้สำหรับดูแนวโน้มเบื้องต้นเท่านั้น โปรดปรึกษาแพทย์หากมีอาการผิดปกติ
