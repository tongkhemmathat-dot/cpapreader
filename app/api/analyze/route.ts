import { NextRequest, NextResponse } from 'next/server';
import Anthropic from '@anthropic-ai/sdk';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยวิเคราะห์ข้อมูลจากหน้าจอเครื่อง CPAP รุ่น Aeonmed AS100A
เครื่องนี้แสดงค่าทั่วไป เช่น:
- Usage time / ชั่วโมงการใช้งาน
- AHI (Apnea-Hypopnea Index) ครั้ง/ชม.
- Leak rate (ค่ารั่วของหน้ากาก) L/min
- Pressure (ความดัน) cmH2O — อาจมี Auto/CPAP mode, Pmin/Pmax, P95
- SpO2 (ถ้ามี)
- วันที่/Session
อ่านค่าจากภาพให้ครบและประเมินผล ใช้เกณฑ์: AHI <5 ดี, 5-15 ปานกลาง, >15 ไม่ดี / Leak <24 L/min ปกติ / Usage >=4 ชม.ต่อคืน

ตอบเป็น JSON ที่ valid เท่านั้น (ห้ามมี markdown code fence) ตาม schema:
{
  "summary": "สรุปภาษาไทย 1-2 ประโยค",
  "overall": "good" | "fair" | "poor" | "unknown",
  "metrics": [{ "label": "ชื่อค่า", "value": "ตัวเลข+หน่วย", "note": "ความหมาย (optional)" }],
  "recommendations": ["คำแนะนำสั้น ๆ ภาษาไทย"],
  "raw_readings": { "key": "value ดิบที่อ่านได้" }
}

ถ้าภาพไม่ใช่หน้าจอ CPAP หรืออ่านไม่ออก ให้ overall="unknown" และอธิบายใน summary`;

export async function POST(req: NextRequest) {
  try {
    const { imageBase64, mediaType } = await req.json();
    if (!imageBase64) return NextResponse.json({ error: 'missing imageBase64' }, { status: 400 });

    const apiKey = process.env.ANTHROPIC_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'ANTHROPIC_API_KEY ยังไม่ได้ตั้งค่า' }, { status: 500 });

    const client = new Anthropic({ apiKey });

    const msg = await client.messages.create({
      model: 'claude-opus-4-7',
      max_tokens: 1500,
      system: SYSTEM_PROMPT,
      messages: [
        {
          role: 'user',
          content: [
            {
              type: 'image',
              source: { type: 'base64', media_type: mediaType || 'image/jpeg', data: imageBase64 },
            },
            { type: 'text', text: 'วิเคราะห์ภาพหน้าจอ CPAP นี้ ตอบเป็น JSON ตาม schema เท่านั้น' },
          ],
        },
      ],
    });

    const text = msg.content
      .filter((b): b is Anthropic.TextBlock => b.type === 'text')
      .map((b) => b.text)
      .join('\n')
      .trim();

    const cleaned = text.replace(/^```(?:json)?\s*|\s*```$/g, '').trim();
    let parsed;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      return NextResponse.json(
        { error: 'โมเดลตอบกลับไม่ใช่ JSON ที่อ่านได้', raw: text },
        { status: 502 },
      );
    }
    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || 'internal error' }, { status: 500 });
  }
}
