export type Overall = 'good' | 'fair' | 'poor' | 'unknown';
export type Metric = { label: string; value: string; status: 'normal' | 'warning' | 'alert'; note: string };
export type Analysis = { overall: Overall; summary: string; metrics: Metric[]; recommendations: string[] };

type FormData = { usage: string; pressure: string; p90: string; ahi: string; snore: string; leak90: string; cai: string; apnea: string; hi: string };

// ─── thresholds ────────────────────────────────────────────────────────────
const n = (v: string) => parseFloat(v);
const has = (v: string) => v.trim() !== '' && !isNaN(parseFloat(v));

function evalUsage(v: number): Metric {
  if (v >= 7) return { label: 'ระยะเวลาใช้งาน', value: `${v} ชม.`, status: 'normal',
    note: `ดีเยี่ยม — สวมหน้ากากครบ ${v} ชม. ร่างกายได้รับออกซิเจนอย่างเพียงพอตลอดคืน` };
  if (v >= 4) return { label: 'ระยะเวลาใช้งาน', value: `${v} ชม.`, status: 'normal',
    note: 'เพียงพอตามเกณฑ์มาตรฐาน (≥4 ชม.) — พยายามเพิ่มให้ถึง 7 ชม. เพื่อผลลัพธ์ที่ดีขึ้น' };
  if (v >= 2) return { label: 'ระยะเวลาใช้งาน', value: `${v} ชม.`, status: 'warning',
    note: `น้อยกว่าเกณฑ์ ${v} ชม. — การรักษาไม่สมบูรณ์ ร่างกายยังมีภาวะหยุดหายใจในช่วงที่ถอดหน้ากาก` };
  return { label: 'ระยะเวลาใช้งาน', value: `${v} ชม.`, status: 'alert',
    note: `น้อยมาก (${v} ชม.) — ตรวจสอบว่าหน้ากากไม่สบาย มีเสียงรบกวน หรือสายรัดแน่นเกินไป` };
}

function evalAHI(v: number): Metric {
  if (v < 5)  return { label: 'AHI', value: `${v} ครั้ง/ชม.`, status: 'normal',
    note: `CPAP ทำงานได้ดีมาก — หยุดหายใจเฉลี่ยเพียง ${v} ครั้ง/ชม. ทางเดินหายใจเปิดโล่งแทบตลอดคืน` };
  if (v < 15) return { label: 'AHI', value: `${v} ครั้ง/ชม.`, status: 'warning',
    note: `OSA เล็กน้อย — ความดันอาจยังไม่พอ ลองตรวจสอบว่าหน้ากากรั่วหรือนอนตะแคงเพิ่มช่วยได้` };
  if (v < 30) return { label: 'AHI', value: `${v} ครั้ง/ชม.`, status: 'alert',
    note: `OSA ปานกลาง — ยังหยุดหายใจบ่อย ควรปรึกษาแพทย์เพื่อปรับช่วงความดัน (Pmin/Pmax)` };
  return             { label: 'AHI', value: `${v} ครั้ง/ชม.`, status: 'alert',
    note: `OSA รุนแรง — การรักษาด้วยความดันปัจจุบันไม่เพียงพอ ต้องพบแพทย์เพื่อปรับการตั้งค่า` };
}

function evalCAI(v: number): Metric {
  if (v < 1)  return { label: 'CAI', value: `${v} ครั้ง/ชม.`, status: 'normal',
    note: 'สมองส่งสัญญาณสั่งหายใจปกติ ไม่พบการหยุดหายใจจากระบบประสาทส่วนกลาง' };
  if (v < 5)  return { label: 'CAI', value: `${v} ครั้ง/ชม.`, status: 'warning',
    note: `สูงกว่าปกติ — อาจเป็น Treatment-Emergent Central Apnea (TECA) ที่เกิดจากความดัน CPAP สูงเกินไป` };
  return             { label: 'CAI', value: `${v} ครั้ง/ชม.`, status: 'alert',
    note: `สูงมาก — อาจต้องเปลี่ยนเป็น BiPAP/ASV หรือตรวจหาสาเหตุอื่น เช่น หัวใจล้มเหลว ควรพบแพทย์` };
}

function evalLeak90(v: number): Metric {
  if (v < 10) return { label: 'LEAK90', value: `${v} L/min`, status: 'normal',
    note: 'หน้ากากกระชับดีเยี่ยม การรั่วน้อยมาก ความดันลมส่งถึงทางเดินหายใจได้เต็มที่' };
  if (v < 24) return { label: 'LEAK90', value: `${v} L/min`, status: 'normal',
    note: `รั่วอยู่ในเกณฑ์ยอมรับ (${v} L/min < 24) — ความดันยังคงมีประสิทธิภาพ` };
  if (v < 40) return { label: 'LEAK90', value: `${v} L/min`, status: 'warning',
    note: `รั่วปานกลาง — ลองปรับสายรัด เปลี่ยน cushion หรือใช้ chin strap ถ้าปากอ้า` };
  return             { label: 'LEAK90', value: `${v} L/min`, status: 'alert',
    note: `รั่วมาก — ความดันที่ส่งถึงทางเดินหายใจลดลงมาก ตรวจสอบขนาดหน้ากากและหัวต่อทุกจุด` };
}

function evalSnore(v: number): Metric {
  if (v < 1)  return { label: 'ดัชนีการกรน', value: `${v} ครั้ง/ชม.`, status: 'normal',
    note: 'แทบไม่มีการกรน — ความดัน CPAP เปิดทางเดินหายใจได้สมบูรณ์' };
  if (v < 5)  return { label: 'ดัชนีการกรน', value: `${v} ครั้ง/ชม.`, status: 'normal',
    note: 'กรนเล็กน้อย — อยู่ในเกณฑ์ยอมรับ ทางเดินหายใจเปิดได้เกือบสมบูรณ์' };
  if (v < 15) return { label: 'ดัชนีการกรน', value: `${v} ครั้ง/ชม.`, status: 'warning',
    note: 'กรนบ่อย — ทางเดินหายใจส่วนบนยังแคบอยู่ ลองปรับท่านอนหรือเพิ่มความดันขั้นต่ำ' };
  return             { label: 'ดัชนีการกรน', value: `${v} ครั้ง/ชม.`, status: 'alert',
    note: 'กรนมาก — ความดัน CPAP ยังไม่พอเปิดทางเดินหายใจ หรือหน้ากากรั่วทำให้ประสิทธิภาพลด' };
}

function evalApnea(v: number): Metric {
  if (v < 1)  return { label: 'ดัชนีการหยุดหายใจ (AI)', value: `${v} ครั้ง/ชม.`, status: 'normal',
    note: 'แทบไม่มีการหยุดหายใจสนิท — CPAP ป้องกันการอุดกั้นทางเดินหายใจได้ดีมาก' };
  if (v < 5)  return { label: 'ดัชนีการหยุดหายใจ (AI)', value: `${v} ครั้ง/ชม.`, status: 'warning',
    note: `หยุดหายใจสนิท ${v} ครั้ง/ชม. — อาจเกิดช่วงนอนหงาย หรือ REM sleep ที่ต้องการความดันสูงกว่า` };
  return             { label: 'ดัชนีการหยุดหายใจ (AI)', value: `${v} ครั้ง/ชม.`, status: 'alert',
    note: 'หยุดหายใจสนิทบ่อย — ทางเดินหายใจถูกกีดขวางซ้ำ ๆ ต้องปรับความดันหรือตรวจสอบหน้ากาก' };
}

function evalHI(v: number): Metric {
  if (v < 5)  return { label: 'HI', value: `${v} ครั้ง/ชม.`, status: 'normal',
    note: 'หายใจตื้นน้อยมาก — ออกซิเจนในเลือดคงที่ตลอดคืน ร่างกายพักผ่อนได้เต็มที่' };
  if (v < 15) return { label: 'HI', value: `${v} ครั้ง/ชม.`, status: 'warning',
    note: `หายใจตื้น ${v} ครั้ง/ชม. — ออกซิเจนในเลือดอาจลดต่ำลงซ้ำ ๆ ส่งผลให้ตื่นนอนไม่สดชื่น` };
  return             { label: 'HI', value: `${v} ครั้ง/ชม.`, status: 'alert',
    note: 'หายใจตื้นบ่อยมาก — เทียบเท่า OSA ระดับปานกลาง ควรปรับ pressure support หรือปรึกษาแพทย์' };
}

function evalPressure(p: number, p90: number | null): Metric[] {
  const out: Metric[] = [];
  out.push({ label: 'ความดันเฉลี่ย', value: `${p} hPa`, status: 'normal',
    note: `ความดันที่เครื่องใช้จริงเฉลี่ยตลอดคืน — สะท้อนความต้องการโดยรวมของทางเดินหายใจ` });
  if (p90 !== null) {
    const diff = +(p90 - p).toFixed(1);
    if (diff > 4) {
      out.push({ label: 'P90', value: `${p90} hPa`, status: 'warning',
        note: `สูงกว่าเฉลี่ย ${diff} hPa — มีช่วงที่ต้องการความดันสูงมาก อาจเป็นช่วง REM หรือนอนหงาย พิจารณาเพิ่ม Pmax` });
    } else if (diff > 2) {
      out.push({ label: 'P90', value: `${p90} hPa`, status: 'normal',
        note: `สูงกว่าเฉลี่ย ${diff} hPa — เครื่องปรับความดันขึ้นบ้างตามความต้องการ ยังอยู่ในเกณฑ์ดี` });
    } else {
      out.push({ label: 'P90', value: `${p90} hPa`, status: 'normal',
        note: `ใกล้เคียงค่าเฉลี่ย (ต่างกัน ${diff} hPa) — ทางเดินหายใจคงที่ตลอดคืน ไม่ต้องการความดันสูงเป็นพิเศษ` });
    }
  }
  return out;
}

// ─── main ────────────────────────────────────────────────────────────────────
export function analyzeLocal(f: FormData): Analysis {
  const metrics: Metric[] = [];
  const recommendations: string[] = [];

  if (has(f.usage))    metrics.push(evalUsage(n(f.usage)));
  if (has(f.ahi))      metrics.push(evalAHI(n(f.ahi)));
  if (has(f.cai))      metrics.push(evalCAI(n(f.cai)));
  if (has(f.apnea))    metrics.push(evalApnea(n(f.apnea)));
  if (has(f.hi))       metrics.push(evalHI(n(f.hi)));
  if (has(f.snore))    metrics.push(evalSnore(n(f.snore)));
  if (has(f.leak90))   metrics.push(evalLeak90(n(f.leak90)));

  const pressureMetrics = has(f.pressure)
    ? evalPressure(n(f.pressure), has(f.p90) ? n(f.p90) : null)
    : has(f.p90) ? [{ label: 'P90', value: `${f.p90} hPa`, status: 'normal' as const, note: 'ความดันที่ใช้จริง 90% ของเวลา' }]
    : [];
  metrics.push(...pressureMetrics);

  if (!metrics.length) return { overall: 'unknown', summary: 'ไม่มีข้อมูลเพียงพอสำหรับการวิเคราะห์', metrics: [], recommendations: [] };

  // ─── recommendations ─────────────────────────────────────────────────────
  const alerts  = metrics.filter((m) => m.status === 'alert');
  const warnings = metrics.filter((m) => m.status === 'warning');

  if (has(f.usage) && n(f.usage) < 4)
    recommendations.push('พยายามสวมหน้ากากให้ได้อย่างน้อย 4 ชั่วโมงต่อคืน เพื่อประสิทธิผลของการรักษา');
  if (has(f.ahi) && n(f.ahi) >= 5)
    recommendations.push('AHI สูงกว่าเกณฑ์ ลองตรวจสอบว่าหน้ากากรั่วหรือไม่ และแจ้งแพทย์เพื่อปรับความดัน');
  if (has(f.cai) && n(f.cai) >= 1)
    recommendations.push('CAI สูง อาจเกิด treatment-emergent central apnea (TECA) ควรแจ้งแพทย์');
  if (has(f.leak90) && n(f.leak90) >= 24)
    recommendations.push('หน้ากากรั่ว ลองปรับสายรัดให้กระชับขึ้น หรือเปลี่ยน cushion ถ้าชำรุด');
  if (has(f.snore) && n(f.snore) >= 5)
    recommendations.push('กรนบ่อย ความดันอาจยังไม่เพียงพอ พิจารณาขยับช่วง pressure ขึ้น');
  if (!recommendations.length)
    recommendations.push('ค่าทุกอย่างอยู่ในเกณฑ์ดี รักษาพฤติกรรมและความสม่ำเสมอในการใช้เครื่องไว้');

  // ─── overall ─────────────────────────────────────────────────────────────
  let overall: Overall = 'good';
  if (alerts.length >= 1) overall = 'poor';
  else if (warnings.length >= 1) overall = 'fair';

  // ─── summary ─────────────────────────────────────────────────────────────
  const ahiVal = has(f.ahi) ? n(f.ahi) : null;
  const usageVal = has(f.usage) ? n(f.usage) : null;

  let summary = '';
  if (overall === 'good') {
    summary = 'ผลการรักษาคืนนี้อยู่ในเกณฑ์ดี';
    if (ahiVal !== null) summary += ` AHI ${ahiVal} ครั้ง/ชม. ซึ่งอยู่ในช่วงปกติ`;
    if (usageVal !== null) summary += ` ใช้งาน ${usageVal} ชม.`;
  } else if (overall === 'fair') {
    summary = 'ผลการรักษาอยู่ในเกณฑ์พอใช้ มีบางค่าที่ควรติดตาม';
    if (warnings.length) summary += ` (${warnings.map((m) => m.label).join(', ')})`;
  } else {
    summary = 'พบค่าผิดปกติที่ควรได้รับการดูแล';
    if (alerts.length) summary += ` โดยเฉพาะ ${alerts.map((m) => m.label).join(', ')}`;
    summary += ' ควรปรึกษาแพทย์หรือช่างเทคนิค CPAP';
  }

  return { overall, summary, metrics, recommendations };
}
