import type { Analysis } from './analyze';

export type FormData = {
  usage: string; pressure: string; p90: string; ahi: string;
  snore: string; leak90: string; cai: string; apnea: string; hi: string;
};

export type DailyRecord = {
  id: string;           // YYYY-MM-DD (1 วัน 1 record)
  date: string;         // YYYY-MM-DD
  savedAt: string;      // ISO timestamp ล่าสุดที่บันทึก
  form: FormData;
  result: Analysis;
};

const KEY = 'cpap_records';

function load(): Record<string, DailyRecord> {
  try { return JSON.parse(localStorage.getItem(KEY) ?? '{}'); }
  catch { return {}; }
}

function save(db: Record<string, DailyRecord>) {
  localStorage.setItem(KEY, JSON.stringify(db));
}

export function upsertRecord(form: FormData, result: Analysis, date?: string): DailyRecord {
  const db = load();
  const d = date ?? today();
  const rec: DailyRecord = { id: d, date: d, savedAt: new Date().toISOString(), form, result };
  db[d] = rec;
  save(db);
  return rec;
}

export function getAllRecords(): DailyRecord[] {
  return Object.values(load()).sort((a, b) => b.date.localeCompare(a.date));
}

export function deleteRecord(date: string) {
  const db = load();
  delete db[date];
  save(db);
}

export function today(): string {
  return new Date().toLocaleDateString('sv-SE'); // YYYY-MM-DD
}

// ─── export helpers ──────────────────────────────────────────────────────────

export type ExportRange = 'day' | 'week' | 'month';

export function getRecordsForRange(range: ExportRange, anchor?: string): DailyRecord[] {
  const all = getAllRecords();
  const ref = anchor ? new Date(anchor) : new Date();
  ref.setHours(0, 0, 0, 0);

  if (range === 'day') {
    const d = ref.toLocaleDateString('sv-SE');
    return all.filter((r) => r.date === d);
  }
  if (range === 'week') {
    const dow = ref.getDay(); // 0=Sun
    const mon = new Date(ref); mon.setDate(ref.getDate() - ((dow + 6) % 7));
    const sun = new Date(mon); sun.setDate(mon.getDate() + 6);
    return all.filter((r) => r.date >= mon.toLocaleDateString('sv-SE') && r.date <= sun.toLocaleDateString('sv-SE'));
  }
  // month
  const ym = ref.toLocaleDateString('sv-SE').slice(0, 7);
  return all.filter((r) => r.date.startsWith(ym));
}

function fmt(d: string): string {
  return new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', calendar: 'gregory' });
}

function metricLine(form: FormData, result: Analysis): string {
  const lines: string[] = [];
  const LABELS: [keyof FormData, string, string][] = [
    ['usage',    'ระยะเวลาใช้งาน', 'ชม.'],
    ['ahi',      'AHI',            'ครั้ง/ชม.'],
    ['cai',      'CAI',            'ครั้ง/ชม.'],
    ['apnea',    'ดัชนีการหยุดหายใจ', 'ครั้ง/ชม.'],
    ['hi',       'HI',             'ครั้ง/ชม.'],
    ['snore',    'ดัชนีการกรน',    'ครั้ง/ชม.'],
    ['leak90',   'LEAK90',         'L/min'],
    ['pressure', 'ความดันเฉลี่ย',   'hPa'],
    ['p90',      'P90',            'hPa'],
  ];
  for (const [key, label, unit] of LABELS) {
    if (form[key].trim()) {
      const m = result.metrics.find((x) => x.label.startsWith(label.slice(0, 5)));
      const tag = m ? (m.status === 'alert' ? '⚠️' : m.status === 'warning' ? '🔶' : '✅') : '';
      lines.push(`  ${tag} ${label}: ${form[key]} ${unit}${m?.note ? ` — ${m.note}` : ''}`);
    }
  }
  return lines.join('\n');
}

function avgMetric(records: DailyRecord[], key: keyof FormData): string {
  const vals = records.map((r) => parseFloat(r.form[key])).filter((v) => !isNaN(v));
  if (!vals.length) return '-';
  return (vals.reduce((a, b) => a + b, 0) / vals.length).toFixed(1);
}

function overallEmoji(o: string) {
  return o === 'good' ? '🟢 ดี' : o === 'fair' ? '🟡 พอใช้' : o === 'poor' ? '🔴 ควรปรับ' : '⚪ ไม่ทราบ';
}

export function buildExportText(records: DailyRecord[], range: ExportRange): string {
  if (!records.length) return 'ไม่มีข้อมูลในช่วงเวลาที่เลือก';

  const rangeLabel = range === 'day' ? 'รายวัน' : range === 'week' ? 'รายสัปดาห์' : 'รายเดือน';
  const dateRange = records.length === 1
    ? fmt(records[0].date)
    : `${fmt(records[records.length - 1].date)} – ${fmt(records[0].date)}`;

  const lines: string[] = [
    '═══════════════════════════════════════',
    `รายงาน CPAP ${rangeLabel}`,
    `ช่วง: ${dateRange}`,
    `จำนวน: ${records.length} คืน`,
    '═══════════════════════════════════════',
    '',
  ];

  for (const rec of [...records].reverse()) {
    lines.push(`📅 ${fmt(rec.date)}  ${overallEmoji(rec.result.overall)}`);
    lines.push(metricLine(rec.form, rec.result));
    if (rec.result.summary) lines.push(`  สรุป: ${rec.result.summary}`);
    lines.push('');
  }

  if (records.length > 1) {
    lines.push('───────────────────────────────────────');
    lines.push(`สรุป${rangeLabel} (เฉลี่ย ${records.length} คืน)`);
    lines.push(`  ระยะเวลาใช้งานเฉลี่ย : ${avgMetric(records, 'usage')} ชม.`);
    lines.push(`  AHI เฉลี่ย           : ${avgMetric(records, 'ahi')} ครั้ง/ชม.`);
    lines.push(`  LEAK90 เฉลี่ย        : ${avgMetric(records, 'leak90')} L/min`);
    lines.push(`  CAI เฉลี่ย           : ${avgMetric(records, 'cai')} ครั้ง/ชม.`);
    const goodN = records.filter((r) => r.result.overall === 'good').length;
    lines.push(`  คืนที่ผลดี           : ${goodN}/${records.length} คืน`);
    lines.push('═══════════════════════════════════════');
  }

  return lines.join('\n');
}
