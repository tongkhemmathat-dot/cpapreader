'use client';

import { useState, useEffect } from 'react';
import { analyzeLocal } from './lib/analyze';
import type { Analysis } from './lib/analyze';
import {
  upsertRecord, getAllRecords, deleteRecord, getRecordsForRange, buildExportText, today, pullFromCloud,
} from './lib/storage';
import type { DailyRecord, ExportRange, FormData } from './lib/storage';
import { isConfigured } from './lib/db';
import PinGate from './components/PinGate';

// ─── constants ────────────────────────────────────────────────────────────────

const FIELDS: { key: keyof FormData; label: string; unit: string; placeholder: string; desc: string }[] = [
  { key: 'usage',    label: 'ระยะเวลาใช้งาน',    unit: 'ชม.',       placeholder: 'เช่น 7.5',  desc: 'จำนวนชั่วโมงที่สวมหน้ากากในคืนนั้น ควร ≥ 4 ชม.' },
  { key: 'pressure', label: 'ความดันเฉลี่ย',      unit: 'hPa',       placeholder: 'เช่น 9.2',  desc: 'ความดันลมเฉลี่ยตลอดคืน' },
  { key: 'p90',      label: 'P90',               unit: 'hPa',       placeholder: 'เช่น 11.4', desc: 'ความดันที่เครื่องใช้จริง 90% ของเวลา' },
  { key: 'ahi',      label: 'AHI',               unit: 'ครั้ง/ชม.', placeholder: 'เช่น 2.1',  desc: 'ดัชนีหยุดหายใจรวม: <5 ปกติ, 5-14 เล็กน้อย, ≥15 ปานกลาง-รุนแรง' },
  { key: 'snore',    label: 'ดัชนีการกรน',       unit: 'ครั้ง/ชม.', placeholder: 'เช่น 5.0',  desc: 'จำนวนครั้งที่ตรวจพบเสียงกรนต่อชั่วโมง' },
  { key: 'leak90',   label: 'LEAK90',            unit: 'L/min',     placeholder: 'เช่น 18',   desc: 'การรั่วของหน้ากากที่ 90th percentile ควร < 24 L/min' },
  { key: 'cai',      label: 'CAI',               unit: 'ครั้ง/ชม.', placeholder: 'เช่น 0.3',  desc: 'ดัชนีหยุดหายใจแบบกลาง ควร < 1 ครั้ง/ชม.' },
  { key: 'apnea',    label: 'ดัชนีการหยุดหายใจ', unit: 'ครั้ง/ชม.', placeholder: 'เช่น 1.2',  desc: 'จำนวนครั้งที่หยุดหายใจสนิท' },
  { key: 'hi',       label: 'HI',                unit: 'ครั้ง/ชม.', placeholder: 'เช่น 0.9',  desc: 'ดัชนีหายใจตื้น ≥10 วินาที' },
];

const EMPTY: FormData = { usage: '', pressure: '', p90: '', ahi: '', snore: '', leak90: '', cai: '', apnea: '', hi: '' };

const OVERALL_STYLE: Record<string, string> = {
  good:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  fair:    'bg-amber-500/20  text-amber-300  border-amber-500/40',
  poor:    'bg-rose-500/20   text-rose-300   border-rose-500/40',
  unknown: 'bg-slate-500/20  text-slate-300  border-slate-500/40',
};

// ─── main page ────────────────────────────────────────────────────────────────

export default function Home() {
  const [pinHash, setPinHash] = useState<string | null>(null);
  const [syncing, setSyncing] = useState(false);

  async function handleUnlock(hash: string) {
    setPinHash(hash);
    if (isConfigured()) {
      setSyncing(true);
      await pullFromCloud(hash).catch(() => {});
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

function App({ pinHash }: { pinHash: string }) {
  const [tab, setTab] = useState<'form' | 'history'>('form');
  const [form, setForm] = useState<FormData>(EMPTY);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const [saved, setSaved] = useState(false);
  const [records, setRecords] = useState<DailyRecord[]>([]);

  useEffect(() => { setRecords(getAllRecords()); }, [tab]);

  function handleChange(key: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setResult(null); setSaved(false); setError(null);
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!FIELDS.some((f) => form[f.key].trim())) { setError('กรุณากรอกค่าอย่างน้อย 1 ช่อง'); return; }
    setError(null); setSaved(false);
    setResult(analyzeLocal(form));
  }

  function handleSave() {
    if (!result) return;
    upsertRecord(form, result, pinHash);
    setSaved(true);
    setRecords(getAllRecords());
  }

  function loadRecord(rec: DailyRecord) {
    setForm(rec.form); setResult(rec.result); setSaved(true); setTab('form');
  }

  function handleDelete(date: string) {
    deleteRecord(date, pinHash); setRecords(getAllRecords());
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6 pb-8">
      {/* header */}
      <header className="mb-5">
        <h1 className="text-2xl font-bold">CPAP Analyzer</h1>
        <p className="text-sm text-slate-400">วิเคราะห์ผล CPAP รายวัน และติดตามแนวโน้ม</p>
      </header>

      {/* tabs */}
      <div className="mb-5 flex rounded-xl border border-slate-700 bg-slate-900 p-1">
        {(['form', 'history'] as const).map((t) => (
          <button key={t} onClick={() => setTab(t)}
            className={`flex-1 rounded-lg py-2 text-sm font-medium transition-colors ${tab === t ? 'bg-sky-500 text-white' : 'text-slate-400 hover:text-slate-200'}`}>
            {t === 'form' ? '📋 บันทึกผล' : `📊 ประวัติ (${records.length})`}
          </button>
        ))}
      </div>

      {tab === 'form' ? (
        <FormTab form={form} error={error} result={result} saved={saved}
          onChange={handleChange} onSubmit={handleSubmit} onSave={handleSave} />
      ) : (
        <HistoryTab records={records} pinHash={pinHash} onLoad={loadRecord} onDelete={handleDelete} />
      )}
    </main>
  );
}

// ─── form tab ─────────────────────────────────────────────────────────────────

function FormTab({ form, error, result, saved, onChange, onSubmit, onSave }: {
  form: FormData; error: string | null; result: Analysis | null; saved: boolean;
  onChange: (k: keyof FormData, v: string) => void;
  onSubmit: (e: React.FormEvent) => void;
  onSave: () => void;
}) {
  return (
    <>
      <form onSubmit={onSubmit} className="space-y-3">
        <div className="grid grid-cols-1 gap-3 sm:grid-cols-2">
          {FIELDS.map(({ key, label, unit, placeholder, desc }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs font-medium text-slate-300">
                {label} <span className="text-slate-500">({unit})</span>
              </label>
              <p className="text-[11px] leading-snug text-slate-500">{desc}</p>
              <input type="number" inputMode="decimal" step="any" placeholder={placeholder}
                value={form[key]} onChange={(e) => onChange(key, e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none" />
            </div>
          ))}
        </div>

        {error && <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">{error}</div>}

        <div className="flex gap-2 pt-1">
          <button type="submit"
            className="flex-1 rounded-xl bg-sky-500 py-3 font-semibold text-white shadow-lg active:scale-[0.99]">
            วิเคราะห์ผล
          </button>
          <button type="button" onClick={() => { onChange('usage', ''); }}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-300 active:scale-[0.99]"
            onClickCapture={(e) => { e.stopPropagation(); (['usage','pressure','p90','ahi','snore','leak90','cai','apnea','hi'] as (keyof FormData)[]).forEach((k) => onChange(k, '')); }}>
            ล้าง
          </button>
        </div>
      </form>

      {result && <ResultCard result={result} saved={saved} onSave={onSave} />}
    </>
  );
}

// ─── result card ─────────────────────────────────────────────────────────────

function ResultCard({ result, saved, onSave }: { result: Analysis; saved: boolean; onSave: () => void }) {
  return (
    <section className="mt-6 space-y-4">
      <div className={`rounded-2xl border p-4 ${OVERALL_STYLE[result.overall] ?? OVERALL_STYLE.unknown}`}>
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="text-xs uppercase tracking-wide opacity-70">สรุปผล</div>
            <div className="mt-1 text-base font-medium">{result.summary}</div>
          </div>
          <button onClick={onSave} disabled={saved}
            className={`shrink-0 rounded-xl px-3 py-2 text-xs font-semibold transition-colors ${saved ? 'bg-slate-700 text-slate-400 cursor-default' : 'bg-white/20 text-white hover:bg-white/30 active:scale-95'}`}>
            {saved ? '✓ บันทึกแล้ว' : '💾 บันทึก'}
          </button>
        </div>
      </div>

      {result.metrics?.length > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">การประเมินค่าแต่ละรายการ</div>
          <ul className="divide-y divide-slate-800">
            {result.metrics.map((m, i) => {
              const dot = m.status === 'alert' ? 'bg-rose-400' : m.status === 'warning' ? 'bg-amber-400' : 'bg-emerald-400';
              const noteColor = m.status === 'alert' ? 'text-rose-300' : m.status === 'warning' ? 'text-amber-300' : 'text-slate-400';
              return (
                <li key={i} className="flex items-start justify-between gap-3 py-2">
                  <div className="flex items-center gap-2 pt-0.5">
                    <span className={`mt-1 h-2 w-2 shrink-0 rounded-full ${dot}`} />
                    <span className="text-sm text-slate-300">{m.label}</span>
                  </div>
                  <span className="text-right">
                    <div className="font-semibold">{m.value}</div>
                    <div className={`text-xs ${noteColor}`}>{m.note}</div>
                  </span>
                </li>
              );
            })}
          </ul>
        </div>
      )}

      {result.recommendations?.length > 0 && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
          <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">คำแนะนำ</div>
          <ul className="list-disc space-y-1 pl-5 text-sm text-slate-200">
            {result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
          </ul>
        </div>
      )}

      <p className="text-xs text-slate-500">* ไม่ใช่คำวินิจฉัยทางการแพทย์ ปรึกษาแพทย์เฉพาะทางก่อนปรับการใช้งาน</p>
    </section>
  );
}

// ─── history tab ─────────────────────────────────────────────────────────────

function HistoryTab({ records, pinHash, onLoad, onDelete }: {
  records: DailyRecord[];
  pinHash: string;
  onLoad: (r: DailyRecord) => void;
  onDelete: (date: string) => void;
}) {
  const synced = isConfigured();
  const [range, setRange] = useState<ExportRange>('week');
  const [exported, setExported] = useState(false);

  function handleExport() {
    const recs = getRecordsForRange(range);
    const text = buildExportText(recs, range);
    const label = range === 'day' ? today() : range === 'week' ? `week-${today()}` : today().slice(0, 7);
    const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `cpap-${label}.txt`; a.click();
    URL.revokeObjectURL(url);
    setExported(true);
    setTimeout(() => setExported(false), 2000);
  }

  const overallDot: Record<string, string> = {
    good: 'bg-emerald-400', fair: 'bg-amber-400', poor: 'bg-rose-400', unknown: 'bg-slate-400',
  };

  const fmtDate = (d: string) => new Date(d).toLocaleDateString('th-TH', { day: 'numeric', month: 'short', year: 'numeric', calendar: 'gregory' });

  return (
    <div className="space-y-4">
      {/* export section */}
      <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
        <div className="mb-3 text-xs uppercase tracking-wide text-slate-400">Export เป็น .txt</div>
        <div className="flex gap-2 mb-3">
          {(['day', 'week', 'month'] as ExportRange[]).map((r) => (
            <button key={r} onClick={() => setRange(r)}
              className={`flex-1 rounded-lg py-2 text-xs font-medium transition-colors ${range === r ? 'bg-sky-500 text-white' : 'border border-slate-700 text-slate-400'}`}>
              {r === 'day' ? 'วันนี้' : r === 'week' ? 'สัปดาห์นี้' : 'เดือนนี้'}
            </button>
          ))}
        </div>
        <button onClick={handleExport}
          className="w-full rounded-xl bg-slate-700 py-2.5 text-sm font-semibold text-white active:scale-[0.99] hover:bg-slate-600 transition-colors">
          {exported ? '✓ ดาวน์โหลดแล้ว' : '⬇️ ดาวน์โหลด .txt'}
        </button>
        <p className="mt-2 text-[11px] text-slate-500">นำไฟล์ไปวางใน ChatGPT / Claude เพื่อวิเคราะห์แนวโน้มต่อได้เลย</p>
        <div className={`mt-2 flex items-center gap-1.5 text-[11px] ${synced ? 'text-emerald-400' : 'text-slate-500'}`}>
          <span className={`h-1.5 w-1.5 rounded-full ${synced ? 'bg-emerald-400' : 'bg-slate-600'}`} />
          {synced ? 'ซิงค์ข้ามอุปกรณ์ด้วย PIN เดิม' : 'Local only — เพิ่ม Supabase env เพื่อ sync'}
        </div>
      </div>

      {/* record list */}
      {records.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-500">
          ยังไม่มีข้อมูลที่บันทึก<br />กรอกผลและกด 💾 บันทึก
        </div>
      ) : (
        <ul className="space-y-2">
          {records.map((rec) => (
            <li key={rec.id} className="flex items-center gap-3 rounded-2xl border border-slate-700 bg-slate-900/60 px-4 py-3">
              <span className={`h-3 w-3 shrink-0 rounded-full ${overallDot[rec.result.overall] ?? 'bg-slate-400'}`} />
              <button onClick={() => onLoad(rec)} className="flex-1 text-left">
                <div className="text-sm font-medium text-slate-200">{fmtDate(rec.date)}</div>
                <div className="text-xs text-slate-500 truncate">{rec.result.summary}</div>
              </button>
              {rec.form.ahi && <span className="shrink-0 text-xs text-slate-400">AHI {rec.form.ahi}</span>}
              <button onClick={() => onDelete(rec.date)}
                className="shrink-0 rounded-lg px-2 py-1 text-xs text-slate-500 hover:text-rose-400 transition-colors">✕</button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
