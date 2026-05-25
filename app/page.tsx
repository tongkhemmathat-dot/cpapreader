'use client';

import { useState, useRef } from 'react';

type Metric = { label: string; value: string; note?: string };
type Analysis = {
  summary: string;
  overall: 'good' | 'fair' | 'poor' | 'unknown';
  metrics: Metric[];
  recommendations: string[];
  raw_readings?: Record<string, string>;
};

export default function Home() {
  const [preview, setPreview] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [result, setResult] = useState<Analysis | null>(null);
  const cameraRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLInputElement>(null);

  async function onFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setError(null);
    setResult(null);

    const reader = new FileReader();
    reader.onload = () => setPreview(reader.result as string);
    reader.readAsDataURL(file);

    setLoading(true);
    try {
      const compressed = await compressImage(file, 1600, 0.85);
      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: compressed.base64, mediaType: compressed.mediaType }),
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

  const overallColor: Record<string, string> = {
    good: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    fair: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    poor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    unknown: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  };

  return (
    <main className="mx-auto max-w-xl px-4 py-6 pb-32">
      <header className="mb-6">
        <h1 className="text-2xl font-bold">CPAP Analyzer</h1>
        <p className="text-sm text-slate-400">ถ่ายรูปหน้าจอเครื่อง Aeonmed AS100A เพื่อวิเคราะห์ผล</p>
      </header>

      {preview && (
        <div className="mb-4 overflow-hidden rounded-2xl border border-slate-700">
          <img src={preview} alt="preview" className="w-full" />
        </div>
      )}

      {loading && (
        <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4 text-center">
          <div className="mx-auto mb-2 h-6 w-6 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
          <p className="text-sm text-slate-300">กำลังวิเคราะห์ภาพ…</p>
        </div>
      )}

      {error && (
        <div className="mb-4 rounded-2xl border border-rose-500/40 bg-rose-500/10 p-4 text-sm text-rose-200">
          {error}
        </div>
      )}

      {result && (
        <section className="space-y-4">
          <div className={`rounded-2xl border p-4 ${overallColor[result.overall] ?? overallColor.unknown}`}>
            <div className="text-xs uppercase tracking-wide opacity-70">สรุปผล</div>
            <div className="mt-1 text-base font-medium">{result.summary}</div>
          </div>

          {result.metrics?.length > 0 && (
            <div className="rounded-2xl border border-slate-700 bg-slate-900/60 p-4">
              <div className="mb-2 text-xs uppercase tracking-wide text-slate-400">ค่าที่อ่านได้</div>
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
            * คำแนะนำเพื่อข้อมูลเบื้องต้นเท่านั้น ไม่ใช่คำวินิจฉัยทางการแพทย์ ปรึกษาแพทย์เฉพาะทางก่อนปรับการใช้งาน
          </p>
        </section>
      )}

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/90 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2">
          <input
            ref={cameraRef}
            type="file"
            accept="image/*"
            capture="environment"
            className="hidden"
            onChange={onFile}
          />
          <input
            ref={browseRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={onFile}
          />
          <button
            onClick={() => cameraRef.current?.click()}
            disabled={loading}
            className="flex-1 rounded-xl bg-sky-500 px-4 py-3 font-semibold text-white shadow-lg active:scale-[0.99] disabled:opacity-50"
          >
            📷 ถ่ายรูป
          </button>
          <button
            onClick={() => browseRef.current?.click()}
            disabled={loading}
            className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 font-semibold text-slate-100 active:scale-[0.99] disabled:opacity-50"
          >
            🖼️ เลือกจากคลัง
          </button>
        </div>
      </div>
    </main>
  );
}

async function compressImage(file: File, maxDim: number, quality: number): Promise<{ base64: string; mediaType: string }> {
  const bitmap = await createImageBitmap(file);
  const scale = Math.min(1, maxDim / Math.max(bitmap.width, bitmap.height));
  const w = Math.round(bitmap.width * scale);
  const h = Math.round(bitmap.height * scale);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d')!;
  ctx.drawImage(bitmap, 0, 0, w, h);
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', quality)!);
  const buf = await blob.arrayBuffer();
  const base64 = btoa(String.fromCharCode(...new Uint8Array(buf)));
  return { base64, mediaType: 'image/jpeg' };
}
