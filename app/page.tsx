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

type Item = {
  id: string;
  name: string;
  previewUrl: string;
  origKB: number;
  sentKB: number;
  status: 'compressing' | 'analyzing' | 'done' | 'error';
  result?: Analysis;
  error?: string;
};

const MAX_DIM = 1280;
const QUALITY = 0.75;
const MAX_CONCURRENCY = 1;

export default function Home() {
  const [items, setItems] = useState<Item[]>([]);
  const cameraRef = useRef<HTMLInputElement>(null);
  const browseRef = useRef<HTMLInputElement>(null);

  async function onFiles(e: React.ChangeEvent<HTMLInputElement>) {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (!files.length) return;

    const newItems: Item[] = files.map((f) => ({
      id: crypto.randomUUID(),
      name: f.name,
      previewUrl: URL.createObjectURL(f),
      origKB: Math.round(f.size / 1024),
      sentKB: 0,
      status: 'compressing',
    }));
    setItems((prev) => [...newItems, ...prev]);

    const queue = files.map((file, i) => ({ file, id: newItems[i].id }));
    const workers = Array.from({ length: Math.min(MAX_CONCURRENCY, queue.length) }, async () => {
      while (queue.length) {
        const job = queue.shift();
        if (!job) break;
        await processOne(job.file, job.id);
      }
    });
    await Promise.all(workers);
  }

  async function processOne(file: File, id: string) {
    try {
      const compressed = await compressImage(file, MAX_DIM, QUALITY);
      const sentKB = Math.round((compressed.base64.length * 3) / 4 / 1024);
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, sentKB, status: 'analyzing' } : it)));

      const res = await fetch('/api/analyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ imageBase64: compressed.base64, mediaType: compressed.mediaType }),
      });
      const json = await res.json();
      if (!res.ok) throw new Error(json.error || 'การวิเคราะห์ล้มเหลว');
      setItems((prev) => prev.map((it) => (it.id === id ? { ...it, status: 'done', result: json } : it)));
    } catch (err: any) {
      setItems((prev) =>
        prev.map((it) => (it.id === id ? { ...it, status: 'error', error: err.message || 'error' } : it)),
      );
    }
  }

  function removeItem(id: string) {
    setItems((prev) => {
      const it = prev.find((x) => x.id === id);
      if (it) URL.revokeObjectURL(it.previewUrl);
      return prev.filter((x) => x.id !== id);
    });
  }

  function clearAll() {
    items.forEach((it) => URL.revokeObjectURL(it.previewUrl));
    setItems([]);
  }

  return (
    <main className="mx-auto max-w-xl px-4 py-6 pb-36">
      <header className="mb-4 flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">CPAP Analyzer</h1>
          <p className="text-sm text-slate-400">วิเคราะห์หน้าจอ Aeonmed AS100A ได้หลายรูปพร้อมกัน</p>
        </div>
        {items.length > 0 && (
          <button onClick={clearAll} className="text-xs text-slate-400 underline">ล้างทั้งหมด</button>
        )}
      </header>

      {items.length === 0 && (
        <div className="rounded-2xl border border-dashed border-slate-700 p-8 text-center text-sm text-slate-400">
          กดปุ่มด้านล่างเพื่อถ่ายรูปหรือเลือกหลายรูปจากคลังภาพ
        </div>
      )}

      <div className="space-y-4">
        {items.map((it) => (
          <ItemCard key={it.id} item={it} onRemove={() => removeItem(it.id)} />
        ))}
      </div>

      <div className="fixed inset-x-0 bottom-0 border-t border-slate-800 bg-slate-950/90 p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)] backdrop-blur">
        <div className="mx-auto flex max-w-xl gap-2">
          <input ref={cameraRef} type="file" accept="image/*" capture="environment" className="hidden" onChange={onFiles} />
          <input ref={browseRef} type="file" accept="image/*" multiple className="hidden" onChange={onFiles} />
          <button
            onClick={() => cameraRef.current?.click()}
            className="flex-1 rounded-xl bg-sky-500 px-4 py-3 font-semibold text-white shadow-lg active:scale-[0.99]"
          >
            📷 ถ่ายรูป
          </button>
          <button
            onClick={() => browseRef.current?.click()}
            className="flex-1 rounded-xl border border-slate-600 bg-slate-800 px-4 py-3 font-semibold text-slate-100 active:scale-[0.99]"
          >
            🖼️ เลือกหลายรูป
          </button>
        </div>
      </div>
    </main>
  );
}

function ItemCard({ item, onRemove }: { item: Item; onRemove: () => void }) {
  const overallColor: Record<string, string> = {
    good: 'bg-emerald-500/20 text-emerald-300 border-emerald-500/40',
    fair: 'bg-amber-500/20 text-amber-300 border-amber-500/40',
    poor: 'bg-rose-500/20 text-rose-300 border-rose-500/40',
    unknown: 'bg-slate-500/20 text-slate-300 border-slate-500/40',
  };

  return (
    <article className="overflow-hidden rounded-2xl border border-slate-700 bg-slate-900/60">
      <div className="relative">
        <img src={item.previewUrl} alt={item.name} className="max-h-64 w-full object-contain bg-black" />
        <button
          onClick={onRemove}
          className="absolute right-2 top-2 rounded-full bg-black/60 px-2 py-1 text-xs text-white"
        >
          ✕
        </button>
        <div className="absolute left-2 top-2 rounded-full bg-black/60 px-2 py-1 text-[10px] text-slate-200">
          {item.origKB}KB → {item.sentKB || '…'}KB
        </div>
      </div>

      <div className="p-4">
        {(item.status === 'compressing' || item.status === 'analyzing') && (
          <div className="flex items-center gap-2 text-sm text-slate-300">
            <div className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400" />
            {item.status === 'compressing' ? 'กำลังลดขนาดรูป…' : 'กำลังวิเคราะห์…'}
          </div>
        )}

        {item.status === 'error' && (
          <div className="rounded-xl border border-rose-500/40 bg-rose-500/10 p-3 text-sm text-rose-200">
            {item.error}
          </div>
        )}

        {item.status === 'done' && item.result && (
          <div className="space-y-3">
            <div className={`rounded-xl border p-3 ${overallColor[item.result.overall] ?? overallColor.unknown}`}>
              <div className="text-[10px] uppercase tracking-wide opacity-70">สรุปผล</div>
              <div className="mt-0.5 text-sm font-medium">{item.result.summary}</div>
            </div>

            {item.result.metrics?.length > 0 && (
              <div className="rounded-xl border border-slate-700 p-3">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">ค่าที่อ่านได้</div>
                <ul className="divide-y divide-slate-800">
                  {item.result.metrics.map((m, i) => (
                    <li key={i} className="flex items-baseline justify-between gap-3 py-1.5">
                      <span className="text-xs text-slate-300">{m.label}</span>
                      <span className="text-right">
                        <div className="text-sm font-semibold">{m.value}</div>
                        {m.note && <div className="text-[10px] text-slate-400">{m.note}</div>}
                      </span>
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {item.result.recommendations?.length > 0 && (
              <div className="rounded-xl border border-slate-700 p-3">
                <div className="mb-1 text-[10px] uppercase tracking-wide text-slate-400">คำแนะนำ</div>
                <ul className="list-disc space-y-0.5 pl-5 text-xs text-slate-200">
                  {item.result.recommendations.map((r, i) => <li key={i}>{r}</li>)}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
    </article>
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
  bitmap.close?.();
  const blob: Blob = await new Promise((res) => canvas.toBlob((b) => res(b!), 'image/jpeg', quality)!);
  const base64 = await blobToBase64(blob);
  return { base64, mediaType: 'image/jpeg' };
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result as string;
      resolve(result.split(',')[1] ?? '');
    };
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}
