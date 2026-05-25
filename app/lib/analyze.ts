export type Overall = 'good' | 'fair' | 'poor' | 'unknown';
export type Metric = { label: string; value: string; status: 'normal' | 'warning' | 'alert'; note: string };
export type Analysis = { overall: Overall; summary: string; metrics: Metric[]; recommendations: string[] };

type FormData = { usage: string; pressure: string; p90: string; ahi: string; snore: string; leak90: string; cai: string; apnea: string; hi: string };

// ─── thresholds ────────────────────────────────────────────────────────────
const n = (v: string) => parseFloat(v);
const has = (v: string) => v.trim() !== '' && !isNaN(parseFloat(v));

function evalUsage(v: number): Metric {
  if (v >= 7) return { label: 'ระยะเวลาใช้งาน', value: `${v} ชม.`, status: 'normal', note: 'ดีเยี่ยม (≥7 ชม.)' };
  if (v >= 4) return { label: 'ระยะเวลาใช้งาน', value: `${v} ชม.`, status: 'normal', note: 'เพียงพอ (≥4 ชม.)' };
  if (v >= 2) return { label: 'ระยะเวลาใช้งาน', value: `${v} ชม.`, status: 'warning', note: 'น้อยกว่าเกณฑ์ (<4 ชม.) — ควรสวมนานขึ้น' };
  return { label: 'ระยะเวลาใช้งาน', value: `${v} ชม.`, status: 'alert', note: 'น้อยมาก (<2 ชม.) — ตรวจสอบว่าหน้ากากสบายพอไหม' };
}

function evalAHI(v: number): Metric {
  if (v < 5)  return { label: 'AHI', value: `${v} ครั้ง/ชม.`, status: 'normal',  note: 'ปกติ — การรักษาได้ผลดี (<5)' };
  if (v < 15) return { label: 'AHI', value: `${v} ครั้ง/ชม.`, status: 'warning', note: 'เล็กน้อย (5-14) — อาจต้องปรับความดัน' };
  if (v < 30) return { label: 'AHI', value: `${v} ครั้ง/ชม.`, status: 'alert',   note: 'ปานกลาง (15-29) — ควรปรึกษาแพทย์' };
  return             { label: 'AHI', value: `${v} ครั้ง/ชม.`, status: 'alert',   note: 'รุนแรง (≥30) — ต้องปรับการรักษาด่วน' };
}

function evalCAI(v: number): Metric {
  if (v < 1)  return { label: 'CAI', value: `${v} ครั้ง/ชม.`, status: 'normal',  note: 'ปกติ (<1)' };
  if (v < 5)  return { label: 'CAI', value: `${v} ครั้ง/ชม.`, status: 'warning', note: 'สูงกว่าปกติ (1-4) — อาจเป็น treatment-emergent' };
  return             { label: 'CAI', value: `${v} ครั้ง/ชม.`, status: 'alert',   note: 'สูงมาก (≥5) — ควรแจ้งแพทย์' };
}

function evalLeak90(v: number): Metric {
  if (v < 24) return { label: 'LEAK90', value: `${v} L/min`, status: 'normal',  note: 'ปกติ (<24 L/min)' };
  if (v < 40) return { label: 'LEAK90', value: `${v} L/min`, status: 'warning', note: 'รั่วปานกลาง (24-39) — ปรับสายรัดหรือหมอนรองหน้ากาก' };
  return             { label: 'LEAK90', value: `${v} L/min`, status: 'alert',   note: 'รั่วมาก (≥40) — ตรวจสอบหน้ากากและหัวต่อ' };
}

function evalSnore(v: number): Metric {
  if (v < 1)  return { label: 'ดัชนีการกรน', value: `${v} ครั้ง/ชม.`, status: 'normal',  note: 'แทบไม่มีการกรน' };
  if (v < 5)  return { label: 'ดัชนีการกรน', value: `${v} ครั้ง/ชม.`, status: 'normal',  note: 'กรนเล็กน้อย อยู่ในเกณฑ์ยอมรับ' };
  if (v < 15) return { label: 'ดัชนีการกรน', value: `${v} ครั้ง/ชม.`, status: 'warning', note: 'กรนบ่อย — อาจต้องเพิ่มความดัน' };
  return             { label: 'ดัชนีการกรน', value: `${v} ครั้ง/ชม.`, status: 'alert',   note: 'กรนมาก — ทางเดินหายใจยังถูกกีดขวาง' };
}

function evalApnea(v: number): Metric {
  if (v < 1)  return { label: 'ดัชนีการหยุดหายใจ (AI)', value: `${v} ครั้ง/ชม.`, status: 'normal',  note: 'ปกติ (<1)' };
  if (v < 5)  return { label: 'ดัชนีการหยุดหายใจ (AI)', value: `${v} ครั้ง/ชม.`, status: 'warning', note: 'สูงเล็กน้อย (1-4)' };
  return             { label: 'ดัชนีการหยุดหายใจ (AI)', value: `${v} ครั้ง/ชม.`, status: 'alert',   note: 'สูง (≥5) — หยุดหายใจสนิทบ่อย' };
}

function evalHI(v: number): Metric {
  if (v < 5)  return { label: 'HI', value: `${v} ครั้ง/ชม.`, status: 'normal',  note: 'ปกติ (<5)' };
  if (v < 15) return { label: 'HI', value: `${v} ครั้ง/ชม.`, status: 'warning', note: 'สูงเล็กน้อย (5-14) — หายใจตื้นบ่อย' };
  return             { label: 'HI', value: `${v} ครั้ง/ชม.`, status: 'alert',   note: 'สูง (≥15) — ควรปรึกษาแพทย์' };
}

function evalPressure(p: number, p90: number | null): Metric[] {
  const out: Metric[] = [];
  out.push({ label: 'ความดันเฉลี่ย', value: `${p} hPa`, status: 'normal', note: 'ค่าอ้างอิงความดันทั้งคืน' });
  if (p90 !== null) {
    const diff = p90 - p;
    const diffStatus = diff > 4 ? 'warning' : 'normal';
    const diffNote = diff > 4 ? `P90 สูงกว่าเฉลี่ย ${diff.toFixed(1)} hPa — มีช่วงที่ต้องการความดันสูงกว่าปกติ` : `P90 สูงกว่าเฉลี่ย ${diff.toFixed(1)} hPa — อยู่ในระดับดี`;
    out.push({ label: 'P90', value: `${p90} hPa`, status: diffStatus, note: diffNote });
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
