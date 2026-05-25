'use client';

import { useState, useEffect } from 'react';
import { fullSync, getAllRecords } from '../lib/storage';
import { isConfigured, fetchAll } from '../lib/db';
import { clearPin } from '../lib/pin';

import pkg from '../../package.json';

type Status = 'checking' | 'ok' | 'not_configured' | 'error';

export default function Settings({ pinHash }: { pinHash: string }) {
  const [status, setStatus] = useState<Status>('checking');
  const [errorMsg, setErrorMsg] = useState('');
  const [localCount, setLocalCount] = useState(0);
  const [cloudCount, setCloudCount] = useState<number | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncResult, setSyncResult] = useState('');

  useEffect(() => { checkStatus(); }, []);

  async function checkStatus() {
    setStatus('checking');
    setLocalCount(getAllRecords().length);

    if (!isConfigured()) {
      setStatus('not_configured');
      return;
    }
    try {
      const remote = await fetchAll(pinHash);
      setCloudCount(remote.length);
      setStatus('ok');
    } catch (e: any) {
      setErrorMsg(e?.message ?? String(e));
      setStatus('error');
    }
  }

  async function handleSync() {
    setSyncing(true); setSyncResult('');
    try {
      const { pulled, pushed } = await fullSync(pinHash);
      setSyncResult(`✅ ดึง ${pulled} รายการ • อัปโหลด ${pushed} รายการ`);
      await checkStatus();
    } catch (e: any) {
      setSyncResult(`❌ ${e?.message ?? 'ไม่สามารถ sync ได้'}`);
    }
    setSyncing(false);
  }

  function handleResetPin() {
    if (confirm('ลบ PIN บนอุปกรณ์นี้? ข้อมูล Local จะถูกลบด้วย (Cloud ยังอยู่)')) {
      clearPin(); localStorage.removeItem('cpap_records'); window.location.reload();
    }
  }

  return (
    <div className="mt-2 space-y-3">

      {/* sync status card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 overflow-hidden">
        <div className="px-4 pt-4 pb-3 border-b border-slate-800">
          <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">สถานะ Cloud Sync</p>
          <StatusRow status={status} errorMsg={errorMsg} localCount={localCount} cloudCount={cloudCount} />
        </div>

        {status === 'ok' && (
          <div className="px-4 py-3">
            <button onClick={handleSync} disabled={syncing}
              className="w-full rounded-xl bg-sky-500 py-3 text-sm font-bold text-white disabled:opacity-50 active:scale-[0.98] transition-transform">
              {syncing ? <span className="flex items-center justify-center gap-2"><Spin />กำลัง sync…</span> : '☁️ Sync ตอนนี้'}
            </button>
            {syncResult && <p className="mt-2 text-center text-xs text-slate-400">{syncResult}</p>}
          </div>
        )}

        {status === 'not_configured' && (
          <div className="px-4 py-4 space-y-3">
            <p className="text-sm text-amber-300 font-medium">⚠️ ยังไม่ได้ตั้งค่า Supabase</p>
            <SetupGuide />
          </div>
        )}

        {status === 'error' && (
          <div className="px-4 py-4 space-y-3">
            <p className="text-sm text-rose-300 font-medium">❌ เชื่อมต่อ Supabase ไม่ได้</p>
            <div className="rounded-xl bg-slate-800 px-3 py-2 text-xs text-rose-300 font-mono break-all">{errorMsg}</div>
            <p className="text-xs text-slate-500">ตรวจสอบ NEXT_PUBLIC_SUPABASE_URL และ NEXT_PUBLIC_SUPABASE_ANON_KEY บน Vercel แล้ว Redeploy</p>
            <button onClick={checkStatus} className="w-full rounded-xl border border-slate-700 py-2.5 text-sm text-slate-300 active:bg-slate-800">ลองใหม่</button>
          </div>
        )}

        {status === 'checking' && (
          <div className="flex items-center justify-center gap-2 py-4 text-sm text-slate-400">
            <Spin />กำลังตรวจสอบ…
          </div>
        )}
      </div>

      {/* local data card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4 space-y-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500">ข้อมูลบนอุปกรณ์นี้</p>
        <div className="flex items-center justify-between">
          <span className="text-sm text-slate-300">บันทึกทั้งหมด</span>
          <span className="text-2xl font-bold text-white">{localCount} คืน</span>
        </div>
      </div>

      {/* pin card */}
      <div className="rounded-2xl border border-slate-800 bg-slate-900 px-4 py-4">
        <p className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-3">PIN</p>
        <p className="text-xs text-slate-500 mb-3">การล็อกด้วย PIN ช่วยป้องกันไม่ให้คนอื่นกรอกข้อมูลแทน ใช้ PIN เดิมบนทุกอุปกรณ์เพื่อ sync ข้อมูล</p>
        <button onClick={handleResetPin}
          className="w-full rounded-xl border border-rose-500/30 py-2.5 text-sm text-rose-400 active:bg-rose-500/10 transition-colors">
          รีเซ็ต PIN บนอุปกรณ์นี้
        </button>
      </div>

      {/* version info */}
      <div className="pt-6 pb-2 text-center">
        <p className="text-[11px] font-medium text-slate-600 tracking-wider">SleepFlow v{pkg.version}</p>
      </div>
    </div>
  );
}

function StatusRow({ status, errorMsg, localCount, cloudCount }: { status: Status; errorMsg: string; localCount: number; cloudCount: number | null }) {
  if (status === 'checking') return <div className="flex items-center gap-2 text-sm text-slate-400"><Spin />ตรวจสอบการเชื่อมต่อ…</div>;
  if (status === 'not_configured') return (
    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-amber-400" /><span className="text-sm text-amber-300">ยังไม่ได้เชื่อมต่อ Cloud</span></div>
  );
  if (status === 'error') return (
    <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-rose-400" /><span className="text-sm text-rose-300">เชื่อมต่อไม่ได้</span></div>
  );
  return (
    <div className="space-y-2">
      <div className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full bg-emerald-400" /><span className="text-sm text-emerald-300">เชื่อมต่อ Supabase สำเร็จ</span></div>
      <div className="flex gap-4 text-xs text-slate-400 pl-4">
        <span>📱 Local: <strong className="text-white">{localCount}</strong></span>
        <span>☁️ Cloud: <strong className="text-white">{cloudCount ?? '…'}</strong></span>
        {cloudCount !== null && localCount !== cloudCount && (
          <span className="text-amber-400">⚠️ ข้อมูลไม่ตรงกัน กด Sync</span>
        )}
      </div>
    </div>
  );
}

function SetupGuide() {
  const [open, setOpen] = useState(false);
  return (
    <div>
      <button onClick={() => setOpen((o) => !o)} className="text-xs text-sky-400 underline">{open ? 'ซ่อนคำแนะนำ' : 'ดูวิธีตั้งค่า Supabase ▼'}</button>
      {open && (
        <ol className="mt-3 space-y-2 text-xs text-slate-400 list-decimal pl-4 leading-relaxed">
          <li>ไปที่ <strong className="text-slate-200">supabase.com</strong> → New project (ฟรี)</li>
          <li>เข้า <strong className="text-slate-200">SQL Editor</strong> แล้วรัน SQL นี้:
            <pre className="mt-1 rounded-lg bg-slate-800 p-2 text-[10px] text-emerald-300 whitespace-pre-wrap overflow-x-auto">{SQL}</pre>
          </li>
          <li>ไปที่ <strong className="text-slate-200">Settings → API</strong> คัดลอก URL และ anon key</li>
          <li>เปิด <strong className="text-slate-200">Vercel → Project → Settings → Environment Variables</strong> เพิ่ม:
            <div className="mt-1 rounded-lg bg-slate-800 p-2 text-[10px] font-mono text-sky-300 space-y-1">
              <div>NEXT_PUBLIC_SUPABASE_URL=https://xxx.supabase.co</div>
              <div>NEXT_PUBLIC_SUPABASE_ANON_KEY=eyJ...</div>
            </div>
          </li>
          <li>กด <strong className="text-slate-200">Redeploy</strong> → เปิดแอปใหม่ → กลับมาหน้านี้จะเห็นสีเขียว</li>
        </ol>
      )}
    </div>
  );
}

function Spin() {
  return <span className="h-4 w-4 animate-spin rounded-full border-2 border-slate-600 border-t-sky-400 inline-block" />;
}

const SQL = `CREATE TABLE cpap_records (
  pin_hash TEXT NOT NULL,
  date     TEXT NOT NULL,
  data     JSONB NOT NULL,
  saved_at TIMESTAMPTZ DEFAULT NOW(),
  PRIMARY KEY (pin_hash, date)
);
ALTER TABLE cpap_records ENABLE ROW LEVEL SECURITY;
CREATE POLICY "allow all" ON cpap_records
  FOR ALL USING (true);`;
