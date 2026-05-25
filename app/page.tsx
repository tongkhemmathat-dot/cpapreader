'use client';

import { useState, useEffect } from 'react';
import { analyzeLocal } from './lib/analyze';
import type { Analysis, Metric } from './lib/analyze';
import {
  upsertRecord, getAllRecords, deleteRecord, getRecordsForRange, buildExportText, today, fullSync,
} from './lib/storage';
import type { DailyRecord, ExportRange, FormData } from './lib/storage';
import { isConfigured } from './lib/db';
import PinGate from './components/PinGate';
import Settings from './components/Settings';

// ─── field config ─────────────────────────────────────────────────────────────

const FIELDS: { key: keyof FormData; label: string; unit: string; placeholder: string; desc: string }[] = [
  { key: 'usage',    label: 'ใช้งาน',      unit: 'ชม.',       placeholder: '7.5',  desc: 'ชั่วโมงที่สวมหน้ากากในคืนนั้น ควร ≥ 4 ชม.' },
  { key: 'ahi',      label: 'AHI',         unit: '/ชม.',      placeholder: '2.1',  desc: 'ดัชนีหยุดหายใจรวม: <5 ปกติ • 5-14 เล็กน้อย • ≥15 ปานกลาง-รุนแรง' },
  { key: 'pressure', label: 'ความดันเฉลี่ย', unit: 'hPa',      placeholder: '9.2',  desc: 'ความดันลมเฉลี่ยตลอดคืน (1 hPa ≈ 1 cmH₂O)' },
  { key: 'p90',      label: 'P90',         unit: 'hPa',       placeholder: '11.4', desc: 'ความดันที่เครื่องใช้จริง 90% ของเวลา' },
  { key: 'cai',      label: 'CAI',         unit: '/ชม.',      placeholder: '0.3',  desc: 'การหยุดหายใจจากสมอง (central) ควร < 1' },
  { key: 'apnea',    label: 'การหยุดหายใจ', unit: '/ชม.',      placeholder: '1.2',  desc: 'จำนวนครั้งที่หยุดหายใจสนิท' },
  { key: 'hi',       label: 'HI',          unit: '/ชม.',      placeholder: '0.9',  desc: 'ดัชนีหายใจตื้น ≥10 วินาที' },
  { key: 'snore',    label: 'การกรน',      unit: '/ชม.',      placeholder: '5.0',  desc: 'จำนวนครั้งที่ตรวจพบเสียงกรน' },
  { key: 'leak90',   label: 'LEAK90',      unit: 'L/min',     placeholder: '18',   desc: 'การรั่วของหน้ากากที่ 90th percentile ควร < 24' },
];

const EMPTY: FormData = { usage: '', pressure: '', p90: '', ahi: '', snore: '', leak90: '', cai: '', apnea: '', hi: '' };

// ─── root ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function handleUnlock(hash: string) {
    setPinHash(hash);
    if (isConfigured()) {
      setSyncing(true);
      await fullSync(hash).catch(() => {});
      setSyncing(false);
    }
  }

  if (!pinHash) return <PinGate onUnlock={handleUnlock} />;
  if (syncing) return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-3 bg-[#0b1220]">
      <div className="h-8 w-8 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
      <p className="text-sm text-slate-400">กำลังซิงค์ข้อมูล…</p>
    </div>
  );
  return <App pinHash={pinHash} />;
}

// ─── app shell ────────────────────────────────────────────────────────────────

function App({ pinHash }: { pinHash: string }) {
  const [tab, setTab] = useState<'form' | 'history' | 'settings'>('form');
  const [form, setForm] = useState<FormData>(EMPTY);
  const [result, setResult] = useState<Analysis | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [saved, setSaved] = useState(false);
  const [records, setRecords] = useState<DailyRecord[]>([]);
  const [isKeyboardOpen, setIsKeyboardOpen] = useState(false);

  useEffect(() => { setRecords(getAllRecords()); }, [tab]);

  useEffect(() => {
    const handleFocusIn = (e: FocusEvent) => {
      if ((e.target as HTMLElement).tagName === 'INPUT') setIsKeyboardOpen(true);
    };
    const handleFocusOut = () => setIsKeyboardOpen(false);
    window.addEventListener('focusin', handleFocusIn);
    window.addEventListener('focusout', handleFocusOut);
    return () => {
      window.removeEventListener('focusin', handleFocusIn);
      window.removeEventListener('focusout', handleFocusOut);
    };
  }, []);

  function handleChange(key: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setResult(null); setSaved(false); setError(null);
  }

  function handleClear() {
    setForm(EMPTY); setResult(null); setSaved(false); setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!FIELDS.some((f) => form[f.key].trim())) { setError('กรุณากรอกค่าอย่างน้อย 1 ช่อง'); return; }
    setError(null); setSaved(false);
    setResult(analyzeLocal(form));
    setTimeout(() => document.getElementById('result-anchor')?.scrollIntoView({ behavior: 'smooth' }), 80);
  }

  function handleSave() {
    if (!result) return;
    upsertRecord(form, result, pinHash);
    setSaved(true); setRecords(getAllRecords());
  }

  function loadRecord(rec: DailyRecord) {
    setForm(rec.form); setResult(rec.result); setSaved(true); setTab('form');
    setTimeout(() => window.scrollTo({ top: 0, behavior: 'smooth' }), 80);
  }

  return (
    <div className="safe-top flex min-h-screen flex-col bg-[#0b1220]">
      {/* scrollable content */}
      <div className="flex-1 overflow-y-auto pb-24">
        {/* header */}
        <div className="px-5 pt-4 pb-2">
          <h1 className="text-xl font-bold tracking-tight">CPAP Analyzer</h1>
          <p className="text-xs text-slate-500">{new Date().toLocaleDateString('th-TH', { weekday: 'long', day: 'numeric', month: 'long', calendar: 'gregory' })}</p>
        </div>

        <div className="px-4">
          {tab === 'form' && (
            <FormTab form={form} error={error} result={result} saved={saved}
              onChange={handleChange} onClear={handleClear} onSubmit={handleSubmit} onSave={handleSave} />
          )}
          {tab === 'history' && (
            <HistoryTab records={records} pinHash={pinHash}
              onLoad={loadRecord} onDelete={(d) => { deleteRecord(d, pinHash); setRecords(getAllRecords()); }} />
          )}
          {tab === 'settings' && <Settings pinHash={pinHash} />}
        </div>
      </div>

      {/* bottom tab bar */}
      <nav className={`safe-bottom fixed inset-x-0 bottom-0 border-t border-white/10 bg-black/60 backdrop-blur-2xl supports-[backdrop-filter]:bg-black/40 transition-transform duration-300 ${isKeyboardOpen ? 'translate-y-full' : 'translate-y-0'}`}>
        <div className="mx-auto flex max-w-xl">
          <TabBtn active={tab === 'form'} onClick={() => setTab('form')} icon="✏️" label="บันทึก" />
          <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon="📊" label={`ประวัติ${records.length ? ` ${records.length}` : ''}`} />
          <TabBtn active={tab === 'settings'} onClick={() => setTab('settings')} icon="⚙️" label="ตั้งค่า" />
        </div>
      </nav>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label }: { active: boolean; onClick: () => void; icon: string; label: string }) {
  return (
    <button onClick={onClick}
      className={`flex flex-1 flex-col items-center gap-0.5 py-3 text-xs font-medium transition-colors ${active ? 'text-sky-400' : 'text-slate-500'}`}>
      <span className="text-xl leading-none">{icon}</span>
      {label}
    </button>
  );
}

// ─── form tab ─────────────────────────────────────────────────────────────────

function FormTab({ form, error, result, saved, onChange, onClear, onSubmit, onSave }: {
  form: FormData; error: string | null; result: Analysis | null; saved: boolean;
  onChange: (k: keyof FormData, v: string) => void;
  onClear: () => void;
  onSubmit: (e: React.FormEvent) => void;
  onSave: () => void;
}) {
  const [openDesc, setOpenDesc] = useState<string | null>(null);

  return (
    <>
      <form onSubmit={onSubmit} className="mt-2 space-y-2">
        <div className="grid grid-cols-2 gap-2">
          {FIELDS.map(({ key, label, unit, placeholder, desc }) => (
            <div key={key} className="rounded-2xl border border-slate-800 bg-slate-900 p-3">
              <div className="flex items-center justify-between mb-1">
                <span className="text-xs font-semibold text-slate-300">{label}</span>
                <button type="button" onClick={() => setOpenDesc(openDesc === key ? null : key)}
                  className="text-[10px] text-slate-600 active:text-slate-400">ⓘ</button>
              </div>
              {openDesc === key && (
                <p className="mb-2 text-[11px] leading-snug text-slate-500 border-b border-slate-800 pb-2">{desc}</p>
              )}
              <div className="flex items-baseline gap-1">
                <input
                  type="number" inputMode="decimal" step="any" placeholder={placeholder}
                  value={form[key]} onChange={(e) => onChange(key, e.target.value)}
                  className="w-full bg-transparent text-xl font-bold text-white placeholder-slate-700 focus:outline-none"
                />
                <span className="shrink-0 text-xs text-slate-500">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-2xl border border-rose-500/30 bg-rose-500/10 px-4 py-3 text-sm text-rose-300">{error}</div>
        )}

        <div className="flex gap-2 pt-1">
          <button type="submit"
            className="flex-1 rounded-2xl bg-sky-500 py-4 text-base font-bold text-white shadow-lg shadow-sky-900/40 active:scale-[0.98] transition-transform">
            วิเคราะห์ผล
          </button>
          <button type="button" onClick={onClear}
            className="rounded-2xl border border-slate-700 bg-slate-800/80 px-5 py-4 text-sm font-medium text-slate-400 active:scale-[0.98] transition-transform">
            ล้าง
          </button>
        </div>
      </form>

      <div id="result-anchor" />
      {result && <ResultCard result={result} saved={saved} onSave={onSave} />}
    </>
  );
}

// ─── result card ─────────────────────────────────────────────────────────────

const OVERALL_BG: Record<string, string> = {
  good:    'bg-emerald-500/15 border-emerald-500/30',
  fair:    'bg-amber-500/15  border-amber-500/30',
  poor:    'bg-rose-500/15   border-rose-500/30',
  unknown: 'bg-slate-700/40  border-slate-600/30',
};
const OVERALL_TEXT: Record<string, string> = {
  good: 'text-emerald-300', fair: 'text-amber-300', poor: 'text-rose-300', unknown: 'text-slate-300',
};
const OVERALL_LABEL: Record<string, string> = {
  good: '🟢 ผลดี', fair: '🟡 พอใช้', poor: '🔴 ควรปรับ', unknown: '⚪ ไม่ทราบ',
};

function ResultCard({ result, saved, onSave }: { result: Analysis; saved: boolean; onSave: () => void }) {
  const bg = OVERALL_BG[result.overall] ?? OVERALL_BG.unknown;
  const txt = OVERALL_TEXT[result.overall] ?? OVERALL_TEXT.unknown;

  return (
    <section className="mt-4 space-y-3 pb-4">
      {/* overall banner */}
      <div className={`rounded-2xl border p-4 ${bg}`}>
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className={`text-lg font-bold ${txt}`}>{OVERALL_LABEL[result.overall]}</div>
            <p className="mt-1 text-sm text-slate-300 leading-relaxed">{result.summary}</p>
          </div>
          <button onClick={onSave} disabled={saved}
            className={`shrink-0 rounded-xl px-4 py-2.5 text-sm font-semibold transition-all active:scale-95 ${
              saved ? 'bg-slate-700/60 text-slate-500' : 'bg-white/15 text-white active:bg-white/25'}`}>
            {saved ? '✓ บันทึก' : '💾 บันทึก'}
          </button>
        </div>
      </div>

      {/* metrics grid */}
      {result.metrics?.length > 0 && (
        <div className="space-y-1.5">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">ผลแต่ละค่า</p>
          <div className="grid grid-cols-1 gap-1.5">
            {result.metrics.map((m, i) => <MetricRow key={i} metric={m} />)}
          </div>
        </div>
      )}

      {/* recommendations */}
      {result.recommendations?.length > 0 && (
        <div className="space-y-1.5">
          <p className="px-1 text-xs font-semibold uppercase tracking-wider text-slate-500">คำแนะนำ</p>
          <div className="space-y-2">
            {result.recommendations.map((r, i) => (
              <div key={i} className="flex gap-3 rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
                <span className="mt-0.5 text-base">💡</span>
                <p className="text-sm text-slate-200 leading-relaxed">{r}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <p className="px-1 text-[11px] text-slate-600">* ไม่ใช่คำวินิจฉัยทางการแพทย์ ปรึกษาแพทย์ก่อนปรับการใช้งาน</p>
    </section>
  );
}

function MetricRow({ metric: m }: { metric: Metric }) {
  const [open, setOpen] = useState(false);
  const left = m.status === 'alert' ? 'border-l-rose-400' : m.status === 'warning' ? 'border-l-amber-400' : 'border-l-emerald-400';
  const valColor = m.status === 'alert' ? 'text-rose-300' : m.status === 'warning' ? 'text-amber-300' : 'text-emerald-300';

  return (
    <button onClick={() => setOpen((o) => !o)} className={`w-full text-left rounded-2xl border border-slate-800 bg-slate-900 border-l-4 ${left} px-4 py-3 active:bg-slate-800 transition-colors`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-sm text-slate-300 font-medium">{m.label}</span>
        <span className={`text-base font-bold ${valColor}`}>{m.value}</span>
      </div>
      {open && <p className="mt-2 text-xs text-slate-400 leading-relaxed border-t border-slate-800 pt-2">{m.note}</p>}
      {!open && <p className="mt-0.5 text-xs text-slate-600 truncate">{m.note}</p>}
    </button>
  );
}

// ─── history tab ─────────────────────────────────────────────────────────────

function HistoryTab({ records, pinHash, onLoad, onDelete }: {
  records: DailyRecord[]; pinHash: string;
  onLoad: (r: DailyRecord) => void; onDelete: (d: string) => void;
}) {
  const synced = isConfigured();
  const [syncStatus, setSyncStatus] = useState<'idle' | 'syncing' | 'done' | 'error'>('idle');
  const [syncMsg, setSyncMsg] = useState('');
  const [range, setRange] = useState<ExportRange>('week');
  const [exported, setExported] = useState(false);
  const [confirmDel, setConfirmDel] = useState<string | null>(null);

  async function handleSync() {
    setSyncStatus('syncing');
    try {
      const { pulled, pushed } = await fullSync(pinHash);
      setSyncMsg(`↓${pulled} ↑${pushed} รายการ`);
      setSyncStatus('done');
      window.location.reload();
    } catch {
      setSyncMsg('ไม่สามารถ sync ได้');
      setSyncStatus('error');
    }
    setTimeout(() => setSyncStatus('idle'), 3000);
  }

  function handleExport() {
    const recs = getRecordsForRange(range);
    const text = buildExportText(recs, range);
    const label = range === 'day' ? today() : range === 'week' ? `week-${today()}` : today().slice(0, 7);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cpap-${label}.txt`; a.click();
    URL.revokeObjectURL(url);
    setExported(true); setTimeout(() => setExported(false), 2000);
  }

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', calendar: 'gregory' });
  const overallIcon: Record<string, string> = { good: '🟢', fair: '🟡', poor: '🔴', unknown: '⚪' };

  return (
    <div className="mt-2 space-y-4">
      {/* sync row */}
      <div className="flex items-center justify-between rounded-2xl border border-slate-800 bg-slate-900 px-4 py-3">
        <div className={`flex items-center gap-2 text-xs ${synced ? 'text-emerald-400' : 'text-slate-500'}`}>
          <span className={`h-2 w-2 rounded-full ${synced ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          {synced ? (syncStatus !== 'idle' ? syncMsg : 'Cloud sync') : 'Local only'}
        </div>
        {synced && (
          <button onClick={handleSync} disabled={syncStatus === 'syncing'}
            className="flex items-center gap-1.5 rounded-xl bg-slate-800 px-3 py-1.5 text-xs font-medium text-slate-300 active:scale-95 disabled:opacity-50 transition-all">
            {syncStatus === 'syncing'
              ? <><span className="h-3 w-3 animate-spin rounded-full border border-slate-600 border-t-sky-400" />กำลัง sync</>
              : '☁️ Sync'}
          </button>
        )}
      </div>

      {/* record list */}
      {records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 py-12 text-center">
          <p className="text-slate-500 text-sm">ยังไม่มีข้อมูลที่บันทึก</p>
          <p className="text-slate-600 text-xs mt-1">กรอกผลแล้วกด 💾 บันทึก</p>
        </div>
      ) : (
        <div className="space-y-2">
          {records.map((rec) => (
            <div key={rec.id} className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
              <button onClick={() => onLoad(rec)} className="flex w-full items-center gap-3 px-4 py-3.5 active:bg-slate-800 transition-colors">
                <span className="text-xl">{overallIcon[rec.result.overall] ?? '⚪'}</span>
                <div className="flex-1 text-left">
                  <div className="text-sm font-semibold text-slate-200">{fmtDate(rec.date)}</div>
                  <div className="text-xs text-slate-500 mt-0.5 line-clamp-1">{rec.result.summary}</div>
                </div>
                <div className="text-right shrink-0">
                  {rec.form.ahi && <div className="text-sm font-bold text-slate-300">AHI {rec.form.ahi}</div>}
                  {rec.form.usage && <div className="text-xs text-slate-500">{rec.form.usage} ชม.</div>}
                </div>
              </button>
              {confirmDel === rec.date ? (
                <div className="flex border-t border-slate-800">
                  <button onClick={() => setConfirmDel(null)}
                    className="flex-1 py-2.5 text-xs text-slate-400 active:bg-slate-800">ยกเลิก</button>
                  <button onClick={() => { onDelete(rec.date); setConfirmDel(null); }}
                    className="flex-1 py-2.5 text-xs font-semibold text-rose-400 active:bg-slate-800 border-l border-slate-800">ลบ</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDel(rec.date)}
                  className="flex w-full items-center justify-center border-t border-slate-800 py-2 text-xs text-slate-600 active:bg-slate-800 transition-colors">
                  ลบ
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* export */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 p-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">Export เป็น .txt</p>
        <div className="flex gap-2">
          {(['day', 'week', 'month'] as ExportRange[]).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`flex-1 rounded-xl py-2.5 text-sm font-medium transition-colors ${range === r ? 'bg-sky-500 text-white' : 'border border-slate-700 text-slate-400 active:bg-slate-800'}`}>
              {r === 'day' ? 'วันนี้' : r === 'week' ? 'สัปดาห์' : 'เดือน'}
            </button>
          ))}
        </div>
        <button onClick={handleExport}
          className="w-full rounded-xl bg-slate-700 py-3 text-sm font-semibold text-white active:bg-slate-600 transition-colors">
          {exported ? '✓ ดาวน์โหลดแล้ว' : '⬇️ ดาวน์โหลด .txt'}
        </button>
        <p className="text-[11px] text-slate-600">นำไปวางใน ChatGPT / Claude เพื่อวิเคราะห์แนวโน้ม</p>
      </div>
    </div>
  );
}
