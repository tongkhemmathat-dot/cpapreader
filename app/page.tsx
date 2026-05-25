'use client';

import { useState } from 'react';

type Metric = { label: string; value: string; note?: string };
type Analysis = {
  summary: string;
  overall: 'good' | 'fair' | 'poor' | 'unknown';
  metrics: Metric[];
  recommendations: string[];
};

type FormData = {
  usage: string;
  pressure: string;
  p90: string;
  ahi: string;
  snore: string;
  leak90: string;
  cai: string;
  apnea: string;
  hi: string;
};

const FIELDS: { key: keyof FormData; label: string; unit: string; placeholder: string }[] = [
  { key: 'usage',    label: 'ระยะเวลาใช้งาน',      unit: 'ชม.',      placeholder: 'เช่น 7.5' },
  { key: 'pressure', label: 'ความดันเฉลี่ย',         unit: 'cmH₂O',   placeholder: 'เช่น 9.2' },
  { key: 'p90',      label: 'P90',                   unit: 'cmH₂O',   placeholder: 'เช่น 11.4' },
  { key: 'ahi',      label: 'AHI',                   unit: 'ครั้ง/ชม.', placeholder: 'เช่น 2.1' },
  { key: 'snore',    label: 'ดัชนีการกรน',           unit: 'ครั้ง/ชม.', placeholder: 'เช่น 5.0' },
  { key: 'leak90',   label: 'LEAK90',                unit: 'L/min',   placeholder: 'เช่น 18' },
  { key: 'cai',      label: 'CAI',                   unit: 'ครั้ง/ชม.', placeholder: 'เช่น 0.3' },
  { key: 'apnea',    label: 'ดัชนีการหยุดหายใจ',    unit: 'ครั้ง/ชม.', placeholder: 'เช่น 1.2' },
  { key: 'hi',       label: 'HI',                    unit: 'ครั้ง/ชม.', placeholder: 'เช่น 0.9' },
];

const EMPTY: FormData = { usage: '', pressure: '', p90: '', ahi: '', snore: '', leak90: '', cai: '', apnea: '', hi: '' };

const OVERALL_STYLE: Record<string, string> = {
  good:    'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
  fair:    'bg-amber-500/20  text-amber-300  border-amber-500/40',
  poor:    'bg-rose-500/20   text-rose-300   border-rose-500/40',
  unknown: 'bg-slate-500/20  text-slate-300  border-slate-500/40',
};

export default function Home() {
  const [form, setForm] = useState<FormData>(EMPTY);
  const [loading, setLoading] = useState(false);
  const [error, setError]   = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);

  function handleChange(key: keyof FormData, value: string) {
    setForm((f) => ({ ...f, [key]: value }));
    setResult(null);
    setError(null);
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const filled = FIELDS.filter((f) => form[f.key].trim());
    if (!filled.length) { setError('กรุณากรอกค่าอย่างน้อย 1 ช่อง'); return; }

    setLoading(true);
    setError(null);
    setResult(null);
    try {
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ formData: form }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'การวิเคราะห์ล้มเหลว');
      setResult(json);
    } catch (err: any) {
      setError(err.message || 'เกิดข้อผิดพลาด');
    } finally {
      setLoading(false);
    }
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6 pb-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">CPAP Analyzer</h1>
        <p className="text-sm text-slate-400">กรอกค่าจากเครื่อง CPAP แล้วกดวิเคราะห์</p>
      </header>

      <form onSubmit={handleSubmit} className="space-y-3">
        <div className="grid grid-cols-2 gap-3">
          {FIELDS.map(({ key, label, unit, placeholder }) => (
            <div key={key} className="flex flex-col gap-1">
              <label className="text-xs text-slate-400">
                {label} <span className="text-slate-500">({unit})</span>
              </label>
              <input
                type="number"
                inputMode="decimal"
                step="any"
                placeholder={placeholder}
                value={form[key]}
                onChange={(e) => handleChange(key, e.target.value)}
                className="rounded-xl border border-slate-700 bg-slate-900 px-3 py-2.5 text-sm text-white placeholder-slate-600 focus:border-sky-500 focus:outline-none"
              />
            </div>
          ))}
        </div>

        {error && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
            {error}
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button
            type="submit"
            disabled={loading}
            className="flex-1 rounded-xl bg-sky-500 py-3 font-semibold text-white shadow-lg active:scale-[0.99] disabled:opacity-50"
          >
            {loading ? (
              <span className="flex items-center justify-center gap-2">
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                กำลังวิเคราะห์…
              </span>
            ) : 'วิเคราะห์ผล'}
          </button>
          <button
            type="button"
            onClick={() => { setForm(EMPTY); setResult(null); setError(null); }}
            className="rounded-xl border border-slate-700 bg-slate-800 px-4 py-3 text-sm text-slate-300 active:scale-[0.99]"
          >
            ล้าง
          </button>
        </div>
      </form>

      {result && (
        <section className="mt-6 space-y-4">
          <div className={`rounded-2xl border p-4 ${OVERALL_STYLE[result.overall] ?? OVERALL_STYLE.unknown}`}>
            <div className="text-xs uppercase tracking-wide opacity-70">สรุปผล</div>
            <div className="mt-1 text-base font-medium">{result.summary}</div>
          </div>

          {result.metrics?.length > 0 && (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">การประเมินค่าแต่ละรายการ</div>
              <ul className="divide-y divide-slate-800">
                {result.metrics.map((m, i) => (
                  <li key={i} className="flex items-baseline justify-between gap-3 py-2">
                    <span className="text-sm text-slate-300">{m.label}</span>
                    <span className="text-right">
                      <div className="font-semibold">{m.value}</div>
                      {m.note && <div className="text-xs text-slate-400">{m.note}</div>}
                    </span>
                  </li>
                ))}
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

          <p className="text-xs text-slate-500">
            * ไม่ใช่คำวินิจฉัยทางการแพทย์ ปรึกษาแพทย์เฉพาะทางก่อนปรับการใช้งาน
          </p>
        </section>
      )}
    </main>
  );
}
