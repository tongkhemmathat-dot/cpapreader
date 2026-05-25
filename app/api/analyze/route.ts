import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยวิเคราะห์ข้อมูลจากเครื่อง CPAP รุ่น Aeonmed AS100A
คุณจะได้รับข้อความดิบที่ OCR อ่านได้จากหน้าจอเครื่อง ซึ่งอาจมีตัวอักษรเบี้ยวหรือสัญลักษณ์แปลกปน

ค่าที่ต้องหาจากข้อความ:
- Usage time / ชั่วโมงการใช้งาน
- AHI (Apnea-Hypopnea Index) ครั้ง/ชม.
- Leak rate L/min
- Pressure cmH2O (อาจมี Pmin/Pmax/P95/CPAP mode)
- SpO2 (ถ้ามี)
- วันที่/Session

เกณฑ์ประเมิน: AHI <5 ดี, 5-15 ปานกลาง, >15 ไม่ดี / Leak <24 L/min ปกติ / Usage >=4 ชม.

ตอบเป็น JSON valid เท่านั้น (ห้ามมี markdown code fence):
{
  "summary": "สรุปภาษาไทย 1-2 ประโยค",
  "overall": "good" | "fair" | "poor" | "unknown",
  "metrics": [{ "label": "ชื่อค่า", "value": "ตัวเลข+หน่วย", "note": "ความหมาย (optional)" }],
  "recommendations": ["คำแนะนำสั้น ๆ ภาษาไทย"],
  "raw_readings": { "key": "value ดิบที่อ่านได้" }
}

ถ้าข้อความ OCR อ่านไม่ออกหรือไม่ใช่ข้อมูล CPAP ให้ overall="unknown" และอธิบายใน summary`;

const FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-1.5-flash', 'gemini-1.5-flash-8b'];

export async function POST(req: NextRequest) {
  try {
    const { ocrText } = await req.json();
    if (!ocrText?.trim()) return NextResponse.json({ error: 'missing ocrText' }, { status: 400 });

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY ยังไม่ได้ตั้งค่า' }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = `ข้อความ OCR จากหน้าจอ CPAP:\n\`\`\`\n${ocrText}\n\`\`\`\nวิเคราะห์และตอบเป็น JSON ตาม schema เท่านั้น`;

    let text = '';
    let lastError: any;

    for (const modelName of FALLBACK_MODELS) {
      const model = genAI.getGenerativeModel({ model: modelName, systemInstruction: SYSTEM_PROMPT });
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await model.generateContent(prompt);
          text = result.response.text().trim();
          break;
        } catch (e: any) {
          lastError = e;
          const is429 = e?.status === 429 || e?.message?.includes('429') || e?.message?.includes('quota');
          if (is429 && attempt === 0) { await new Promise((r) => setTimeout(r, 4000)); continue; }
          break;
        }
      }
      if (text) break;
    }

    if (!text) {
      const is429 = lastError?.status === 429 || lastError?.message?.includes('429') || lastError?.message?.includes('quota');
      return NextResponse.json(
        { error: is429 ? 'เกินโควต้า API กรุณารอสักครู่แล้วลองใหม่' : 'เกิดข้อผิดพลาด กรุณาลองใหม่' },
        { status: is429 ? 429 : 500 },
      );
    }

    const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    let parsed;
    try { parsed = JSON.parse(cleaned); }
    catch { return NextResponse.json({ error: 'โมเดลตอบกลับไม่ใช่ JSON', raw: text }, { status: 502 }); }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || 'internal error' }, { status: 500 });
  }
}
