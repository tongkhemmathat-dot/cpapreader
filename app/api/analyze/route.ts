import { NextRequest, NextResponse } from 'next/server';
import { GoogleGenerativeAI } from '@google/generative-ai';

export const runtime = 'nodejs';
export const maxDuration = 60;

const SYSTEM_PROMPT = `คุณเป็นผู้ช่วยวิเคราะห์ผล CPAP ให้คนไข้ทั่วไปเข้าใจง่าย
ใช้เกณฑ์มาตรฐาน AASM:
- AHI: <5 = ปกติดี, 5-14 = เล็กน้อย, 15-29 = ปานกลาง, ≥30 = รุนแรง
- CAI: <1 = ปกติ (>1 อาจเป็น central apnea หรือ treatment-emergent)
- Leak90: <24 L/min = ปกติ, ≥24 = มีการรั่วสูง
- Usage: ≥4 ชม./คืน = สม่ำเสมอ
- Snore index: ควรต่ำ ถ้าสูงอาจต้องปรับความดันหรือหน้ากาก
- P90: ความดันที่ใช้จริง 90% ของเวลา ควรไม่เกิน Pmax ที่ตั้งไว้

ตอบเป็น JSON valid เท่านั้น (ห้ามมี markdown code fence):
{
  "summary": "สรุปภาษาไทย 2-3 ประโยค บอกผลโดยรวมและจุดเด่นที่สำคัญ",
  "overall": "good" | "fair" | "poor" | "unknown",
  "metrics": [
    { "label": "ชื่อค่า", "value": "ค่าที่กรอก + หน่วย", "note": "ประเมินว่าปกติ/ต่ำ/สูง + ความหมายสั้น ๆ" }
  ],
  "recommendations": ["คำแนะนำเฉพาะเจาะจงจากค่าที่ผิดปกติ ถ้าทุกค่าปกติให้ชมและบอกให้รักษาพฤติกรรมเดิม"]
}`;

const FALLBACK_MODELS = ['gemini-2.0-flash', 'gemini-2.0-flash-lite'];

type FormData = {
  usage?: string; pressure?: string; p90?: string; ahi?: string;
  snore?: string; leak90?: string; cai?: string; apnea?: string; hi?: string;
};

function buildPrompt(f: FormData): string {
  const lines = [
    f.usage    && `ระยะเวลาใช้งาน: ${f.usage} ชม.`,
    f.pressure && `ความดันเฉลี่ย: ${f.pressure} hPa`,
    f.p90      && `P90: ${f.p90} hPa`,
    f.ahi      && `AHI: ${f.ahi} ครั้ง/ชม.`,
    f.snore    && `ดัชนีการกรน: ${f.snore} ครั้ง/ชม.`,
    f.leak90   && `LEAK90: ${f.leak90} L/min`,
    f.cai      && `CAI: ${f.cai} ครั้ง/ชม.`,
    f.apnea    && `ดัชนีการหยุดหายใจ: ${f.apnea} ครั้ง/ชม.`,
    f.hi       && `HI: ${f.hi} ครั้ง/ชม.`,
  ].filter(Boolean);

  return `ค่าจากเครื่อง CPAP คืนนี้:\n${lines.join('\n')}\n\nวิเคราะห์และตอบเป็น JSON ตาม schema เท่านั้น`;
}

export async function POST(req: NextRequest) {
  try {
    const { formData } = await req.json() as { formData: FormData };
    if (!formData || !Object.values(formData).some((v) => v?.trim())) {
      return NextResponse.json({ error: 'กรุณากรอกค่าอย่างน้อย 1 ช่อง' }, { status: 400 });
    }

    const apiKey = process.env.GEMINI_API_KEY;
    if (!apiKey) return NextResponse.json({ error: 'GEMINI_API_KEY ยังไม่ได้ตั้งค่า' }, { status: 500 });

    const genAI = new GoogleGenerativeAI(apiKey);
    const prompt = buildPrompt(formData);

    let text = '';
    let lastError: any;

    for (const modelName of FALLBACK_MODELS) {
      const model = genAI.getGenerativeModel({
        model: modelName,
        systemInstruction: SYSTEM_PROMPT,
        generationConfig: { responseMimeType: 'application/json' },
      });
      let success = false;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          const result = await model.generateContent(prompt);
          text = result.response.text().trim();
          success = true;
          break;
        } catch (e: any) {
          lastError = e;
          const msg = e?.message ?? '';
          const is429 = e?.status === 429 || msg.includes('429') || msg.includes('quota') || msg.includes('RESOURCE_EXHAUSTED');
          const is404 = e?.status === 404 || msg.includes('404') || msg.includes('not found');
          if (is404) break; // model ไม่มี ไม่ต้อง retry
          if (is429) {
            await new Promise((r) => setTimeout(r, (attempt + 1) * 5000));
            continue;
          }
          break;
        }
      }
      if (success) break;
    }

    if (!text) {
      const is429 = lastError?.status === 429 || lastError?.message?.includes('429') || lastError?.message?.includes('quota');
      return NextResponse.json(
        { error: is429 ? 'เกินโควต้า API กรุณารอสักครู่แล้วลองใหม่' : `เกิดข้อผิดพลาด: ${lastError?.message}` },
        { status: is429 ? 429 : 500 },
      );
    }

    let parsed;
    try { parsed = JSON.parse(text); }
    catch { return NextResponse.json({ error: 'โมเดลตอบกลับไม่ใช่ JSON', raw: text.slice(0, 300) }, { status: 502 }); }

    return NextResponse.json(parsed);
  } catch (err: any) {
    console.error(err);
    return NextResponse.json({ error: err.message || 'internal error' }, { status: 500 });
  }
}
