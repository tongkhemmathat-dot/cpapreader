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
  { key: 'apnea',    label: 'จำนวนครั้งหยุดหายใจ', unit: '/ชม.',      placeholder: '1.2',  desc: 'จำนวนครั้งที่หยุดหายใจสนิท' },
  { key: 'hi',       label: 'HI',          unit: '/ชม.',      placeholder: '0.9',  desc: 'ดัชนีหายใจตื้น ≥10 วินาที' },
  { key: 'snore',    label: 'การกรน',      unit: '/ชม.',      placeholder: '5.0',  desc: 'จำนวนครั้งที่ตรวจพบเสียงกรน' },
  { key: 'leak90',   label: 'LEAK90',      unit: 'L/min',     placeholder: '18',   desc: 'การรั่วของหน้ากากที่ 90th percentile ควร < 24' },
];

const EMPTY: FormData = { usage: '', pressure: '', p90: '', ahi: '', snore: '', leak90: '', cai: '', apnea: '', hi: '' };

// ─── root ─────────────────────────────────────────────────────────────────────

export default function Home() {
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  // ─── Auto-Refresh Logic (iOS PWA) ──────────────────────────────────────────
  // ตรวจจับเมื่อผู้ใช้เปิดแอปขึ้นมาใหม่ (Wake up) หากขึ้นวันใหม่แล้วให้รีเฟรชแอป
  // เพื่อล้างฟอร์มเก่าและอัปเดตสถิติให้เป็นปัจจุบัน
  useEffect(() => {
    let lastActiveDate = new Date().toDateString();

    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        const currentDate = new Date().toDateString();
        // ถ้าระหว่างที่พับแอปทิ้งไว้แล้วข้ามวัน ให้จับรีเฟรชหน้าเลย
        if (currentDate !== lastActiveDate) {
          window.location.reload();
        }
      } else {
        // อัปเดต state ของเวลาตอนแอปถูกพับเก็บ
        lastActiveDate = new Date().toDateString();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, []);

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
    <div className="flex min-h-[100dvh] flex-col items-center justify-center gap-5 bg-black">
      <div className="h-12 w-12 animate-spin rounded-full border-[4px] border-white/10 border-t-sky-500" />
      <p className="text-[15px] font-medium text-slate-400 tracking-wide">กำลังซิงค์ข้อมูล…</p>
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
    <div className="safe-top flex min-h-[100dvh] flex-col bg-black selection:bg-sky-500/30">
      {/* scrollable content */}
      <div className="flex-1 overflow-y-auto pb-32">
        {/* header */}
        <div className="px-6 pt-8 pb-6">
          <h1 className="text-[36px] font-extrabold tracking-tight text-transparent bg-clip-text bg-gradient-to-br from-sky-400 via-indigo-400 to-purple-500">
            SleepFlow
          </h1>
          <p className="mt-1.5 text-[14px] font-medium text-slate-400 capitalize-first">
            บันทึกผล CPAP • {new Date().toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' })}
          </p>
        </div>

        <div className="px-5">
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
      <nav className={`safe-bottom fixed inset-x-0 bottom-0 border-t border-white/10 bg-black/70 backdrop-blur-2xl supports-[backdrop-filter]:bg-black/40 transition-transform duration-300 z-50 ${isKeyboardOpen ? 'translate-y-full' : 'translate-y-0'}`}>
        <div className="mx-auto flex max-w-xl px-2">
          <TabBtn active={tab === 'form'} onClick={() => setTab('form')} icon="✏️" label="บันทึก" />
          <TabBtn active={tab === 'history'} onClick={() => setTab('history')} icon="📊" label="ประวัติ" badge={records.length} />
          <TabBtn active={tab === 'settings'} onClick={() => setTab('settings')} icon="⚙️" label="ตั้งค่า" />
        </div>
      </nav>
    </div>
  );
}

function TabBtn({ active, onClick, icon, label, badge }: { active: boolean; onClick: () => void; icon: string; label: string; badge?: number }) {
  return (
    <button onClick={onClick}
      className={`relative flex flex-1 flex-col items-center justify-center gap-1.5 py-3.5 transition-colors ${active ? 'text-sky-400' : 'text-slate-500'}`}>
      <span className={`text-[24px] leading-none transition-transform duration-200 ${active ? 'scale-110 drop-shadow-[0_0_12px_rgba(56,189,248,0.4)]' : 'scale-100 grayscale-[0.6] opacity-70'}`}>{icon}</span>
      <span className="text-[11px] font-semibold tracking-wide">{label}</span>
      
      {!!badge && badge > 0 && (
        <span className="absolute top-2.5 right-[28%] flex h-[18px] min-w-[18px] items-center justify-center rounded-full bg-sky-500 px-1.5 text-[10px] font-bold text-white ring-2 ring-black">
          {badge}
        </span>
      )}
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
      <form onSubmit={onSubmit}>
        <div className="grid grid-cols-2 gap-4">
          {FIELDS.map(({ key, label, unit, placeholder, desc }) => (
            <div key={key} className="relative flex flex-col rounded-[24px] border border-white/10 bg-white/[0.04] p-4 transition-colors focus-within:border-sky-500/50 focus-within:bg-sky-500/[0.03] hover:bg-white/[0.06]">
              <div className="flex items-center justify-between mb-2">
                <label htmlFor={key} className="text-[14px] font-semibold tracking-wide text-slate-400">{label}</label>
                <button type="button" onClick={() => setOpenDesc(openDesc === key ? null : key)}
                  className="flex h-8 w-8 items-center justify-center rounded-full bg-white/5 text-[14px] font-bold text-slate-400 active:bg-white/20 active:scale-95 transition-all">
                  ?
                </button>
              </div>
              
              <div className={`overflow-hidden transition-all duration-300 ease-in-out ${openDesc === key ? 'max-h-24 opacity-100 mb-3' : 'max-h-0 opacity-0 mb-0'}`}>
                <p className="text-[12px] leading-relaxed text-sky-200/90 bg-sky-500/10 rounded-[16px] p-3">{desc}</p>
              </div>
              
              <div className="flex items-baseline gap-1.5 mt-auto pt-1">
                <input
                  id={key} type="number" inputMode="decimal" step="any" placeholder={placeholder}
                  value={form[key]} onChange={(e) => onChange(key, e.target.value)}
                  className="w-full bg-transparent text-[30px] font-bold text-white placeholder-white/10 focus:outline-none"
                />
                <span className="shrink-0 text-[14px] font-medium text-slate-500">{unit}</span>
              </div>
            </div>
          ))}
        </div>

        {error && (
          <div className="mt-5 rounded-[20px] border border-rose-500/30 bg-rose-500/10 px-5 py-4 text-[14.5px] font-medium text-rose-300 backdrop-blur-sm">
            {error}
          </div>
        )}

        <div className="mt-8 flex flex-col gap-3">
          <button type="submit"
            className="w-full rounded-[24px] bg-gradient-to-r from-sky-500 to-indigo-500 py-4.5 text-[18px] font-bold text-white shadow-[0_8px_24px_rgba(56,189,248,0.25)] active:scale-[0.98] transition-transform">
            วิเคราะห์ผลลัพธ์
          </button>
          <button type="button" onClick={onClear}
            className="w-full rounded-[24px] py-4 text-[15px] font-semibold text-slate-500 active:text-slate-300 active:bg-white/5 transition-colors">
            ล้างข้อมูล
          </button>
        </div>
      </form>

      <div id="result-anchor" className="h-4" />
      {result && <ResultCard result={result} saved={saved} onSave={onSave} />}
    </>
  );
}

// ─── result card ─────────────────────────────────────────────────────────────

const OVERALL_BG: Record<string, string> = {
  good:    'bg-gradient-to-br from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
  fair:    'bg-gradient-to-br from-amber-500/20  to-amber-500/5  border-amber-500/30',
  poor:    'bg-gradient-to-br from-rose-500/20   to-rose-500/5   border-rose-500/30',
  unknown: 'bg-gradient-to-br from-slate-500/20  to-slate-500/5  border-slate-500/30',
};
const OVERALL_TEXT: Record<string, string> = {
  good: 'text-emerald-400', fair: 'text-amber-400', poor: 'text-rose-400', unknown: 'text-slate-400',
};
const OVERALL_LABEL: Record<string, string> = {
  good: 'ผลดีเยี่ยม', fair: 'พอใช้', poor: 'ควรปรับปรุง', unknown: 'ไม่ทราบ',
};
const OVERALL_ICON: Record<string, string> = {
  good: '🟢', fair: '🟡', poor: '🔴', unknown: '⚪',
};

function ResultCard({ result, saved, onSave }: { result: Analysis; saved: boolean; onSave: () => void }) {
  const bg = OVERALL_BG[result.overall] ?? OVERALL_BG.unknown;
  const txt = OVERALL_TEXT[result.overall] ?? OVERALL_TEXT.unknown;
  const icon = OVERALL_ICON[result.overall] ?? OVERALL_ICON.unknown;

  return (
    <section className="space-y-4 pb-4 animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* overall banner */}
      <div className={`relative overflow-hidden rounded-[24px] border p-5 ${bg} backdrop-blur-md`}>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-[22px]">{icon}</span>
              <h2 className={`text-[19px] font-bold tracking-wide ${txt}`}>{OVERALL_LABEL[result.overall]}</h2>
            </div>
            <p className="text-[14px] text-slate-300 leading-relaxed font-medium">{result.summary}</p>
          </div>
          <button onClick={onSave} disabled={saved}
            className={`shrink-0 rounded-[16px] px-5 py-3 text-[14px] font-bold transition-all active:scale-95 ${
              saved ? 'bg-white/5 text-slate-500 ring-1 ring-white/5' : 'bg-white/10 text-white ring-1 ring-white/20 active:bg-white/20 shadow-lg'}`}>
            {saved ? 'บันทึกแล้ว' : 'บันทึก'}
          </button>
        </div>
      </div>

      {/* metrics grid */}
      {result.metrics?.length > 0 && (
        <div className="space-y-2.5 pt-3">
          <h3 className="px-2 text-[12px] font-bold uppercase tracking-widest text-slate-500">ผลวิเคราะห์แต่ละค่า</h3>
          <div className="grid grid-cols-1 gap-2.5">
            {result.metrics.map((m, i) => <MetricRow key={i} metric={m} />)}
          </div>
        </div>
      )}

      {/* recommendations */}
      {result.recommendations?.length > 0 && (
        <div className="space-y-2.5 pt-3">
          <h3 className="px-2 text-[12px] font-bold uppercase tracking-widest text-slate-500">คำแนะนำ</h3>
          <div className="space-y-2.5">
            {result.recommendations.map((r, i) => (
              <div key={i} className="flex gap-4 rounded-[20px] border border-white/5 bg-white/[0.03] px-4.5 py-4">
                <span className="mt-0.5 text-[18px] opacity-90">💡</span>
                <p className="text-[14.5px] font-medium text-slate-200 leading-relaxed">{r}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      <div className="pt-3 px-2">
        <p className="text-[11px] font-medium text-slate-600">* ไม่ใช่อุปกรณ์ทางการแพทย์ โปรดพิจารณาร่วมกับคำแนะนำของแพทย์</p>
      </div>
    </section>
  );
}

function MetricRow({ metric: m }: { metric: Metric }) {
  const [open, setOpen] = useState(false);
  
  const statusConfig = {
    alert:   { color: 'text-rose-400',    bg: 'bg-rose-500/10',    border: 'border-rose-500/20' },
    warning: { color: 'text-amber-400',   bg: 'bg-amber-500/10',   border: 'border-amber-500/20' },
    normal:  { color: 'text-emerald-400', bg: 'bg-emerald-500/10', border: 'border-emerald-500/20' },
  };
  const conf = statusConfig[m.status];

  return (
    <button onClick={() => setOpen((o) => !o)} 
      className={`w-full text-left rounded-[20px] border ${conf.border} bg-white/[0.02] p-4.5 active:bg-white/[0.04] transition-colors`}>
      <div className="flex items-center justify-between gap-3">
        <span className="text-[14px] font-semibold text-slate-300">{m.label}</span>
        <div className={`flex items-center gap-2 rounded-[12px] ${conf.bg} px-3 py-1.5`}>
          <span className={`text-[14px] font-bold ${conf.color}`}>{m.value}</span>
        </div>
      </div>
      
      <div className={`overflow-hidden transition-all duration-300 ease-in-out ${open ? 'max-h-32 mt-3.5 opacity-100' : 'max-h-0 opacity-0'}`}>
        <p className="text-[13px] font-medium text-slate-400 leading-relaxed border-t border-white/5 pt-3.5">{m.note}</p>
      </div>
      {!open && <p className="mt-2 text-[12px] font-medium text-slate-500 truncate">{m.note}</p>}
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

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric' });

  return (
    <div className="space-y-4 animate-in fade-in duration-300">
      {/* sync row */}
      <div className="flex items-center justify-between rounded-[20px] border border-white/10 bg-white/[0.04] px-5 py-4">
        <div className={`flex items-center gap-3 text-[14px] font-medium ${synced ? 'text-emerald-400' : 'text-slate-500'}`}>
          <span className={`h-2.5 w-2.5 rounded-full ${synced ? 'bg-emerald-400 shadow-[0_0_8px_rgba(52,211,153,0.6)]' : 'bg-slate-600'}`} />
          {synced ? (syncStatus !== 'idle' ? syncMsg : 'Cloud Sync เปิดใช้งาน') : 'บันทึกในเครื่องเท่านั้น'}
        </div>
        {synced && (
          <button onClick={handleSync} disabled={syncStatus === 'syncing'}
            className="flex items-center gap-1.5 rounded-[14px] bg-white/10 px-3.5 py-2 text-[13px] font-bold text-white active:scale-95 disabled:opacity-50 transition-all">
            {syncStatus === 'syncing'
              ? <><span className="h-4 w-4 animate-spin rounded-full border-2 border-white/20 border-t-white" /> ซิงค์...</>
              : '☁️ ซิงค์'}
          </button>
        )}
      </div>

      {/* record list */}
      {records.length === 0 ? (
        <div className="rounded-[24px] border border-dashed border-white/10 bg-white/[0.02] py-16 text-center">
          <p className="text-slate-400 text-[15px] font-medium">ยังไม่มีข้อมูลที่บันทึก</p>
          <p className="text-slate-500 text-[13px] mt-2">กรอกผลในหน้าแรกแล้วกดบันทึก</p>
        </div>
      ) : (
        <div className="space-y-3">
          {records.map((rec) => (
            <div key={rec.id} className="rounded-[24px] border border-white/10 bg-white/[0.04] overflow-hidden">
              <button onClick={() => onLoad(rec)} className="flex w-full items-center gap-4 px-5 py-5 active:bg-white/[0.06] transition-colors">
                <span className="text-[26px] drop-shadow-md shrink-0">{OVERALL_ICON[rec.result.overall] ?? '⚪'}</span>
                <div className="flex-1 text-left min-w-0">
                  <div className="text-[15.5px] font-bold text-white tracking-wide truncate">{fmtDate(rec.date)}</div>
                  <div className="text-[13px] font-medium text-slate-400 mt-1 truncate">{rec.result.summary}</div>
                </div>
                <div className="text-right shrink-0">
                  {rec.form.ahi && <div className="text-[15.5px] font-bold text-sky-400">AHI {rec.form.ahi}</div>}
                  {rec.form.usage && <div className="text-[12px] font-medium text-slate-500 mt-1">{rec.form.usage} ชม.</div>}
                </div>
              </button>
              
              {/* Delete state */}
              {confirmDel === rec.date ? (
                <div className="flex border-t border-white/10 bg-rose-500/10">
                  <button onClick={() => setConfirmDel(null)}
                    className="flex-1 py-3.5 text-[14px] font-semibold text-slate-400 active:bg-white/5">ยกเลิก</button>
                  <button onClick={() => { onDelete(rec.date); setConfirmDel(null); }}
                    className="flex-1 py-3.5 text-[14px] font-bold text-rose-400 active:bg-rose-500/20 border-l border-white/10">ยืนยันลบ</button>
                </div>
              ) : (
                <button onClick={() => setConfirmDel(rec.date)}
                  className="flex w-full items-center justify-center border-t border-white/5 py-3 text-[12.5px] font-semibold text-slate-500 active:bg-white/5 transition-colors">
                  ลบข้อมูลนี้
                </button>
              )}
            </div>
          ))}
        </div>
      )}

      {/* export */}
      <div className="rounded-[24px] border border-white/10 bg-white/[0.04] p-5 space-y-5 mt-8">
        <h3 className="text-[12px] font-bold uppercase tracking-widest text-slate-500">ดาวน์โหลดข้อมูล (.txt)</h3>
        <div className="flex gap-2.5">
          {(['day', 'week', 'month'] as ExportRange[]).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`flex-1 rounded-[16px] py-3 text-[14px] font-bold transition-all ${
                range === r 
                  ? 'bg-sky-500 text-white shadow-[0_0_12px_rgba(56,189,248,0.3)] ring-1 ring-white/20' 
                  : 'bg-white/5 text-slate-400 active:bg-white/10'
              }`}>
              {r === 'day' ? 'วันนี้' : r === 'week' ? '7 วัน' : '30 วัน'}
            </button>
          ))}
        </div>
        <button onClick={handleExport}
          className="w-full rounded-[16px] bg-white/10 py-4 text-[15px] font-bold text-white active:scale-[0.98] transition-all ring-1 ring-white/10">
          {exported ? '✓ ดาวน์โหลดเรียบร้อย' : '⬇️ ดาวน์โหลดไฟล์'}
        </button>
        <p className="text-center text-[12.5px] font-medium text-slate-500">
          นำไฟล์ไปวางใน ChatGPT / Claude เพื่อให้ AI สรุปแนวโน้มให้
        </p>
      </div>
    </div>
  );
}
