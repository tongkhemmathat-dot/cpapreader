'use client';

import { useState, useEffect } from 'react';
import { hashPin, getSavedHash, saveHash, clearPin, hasPinSet } from '../lib/pin';

type Props = { onUnlock: (hash: string) => void };
type Mode = 'enter' | 'create' | 'confirm';

export default function PinGate({ onUnlock }: Props) {
  const [mode, setMode] = useState<Mode>('enter');
  const [pin, setPin] = useState('');
  const [first, setFirst] = useState('');
  const [error, setError] = useState('');
  const [shake, setShake] = useState(false);

  useEffect(() => { setMode(hasPinSet() ? 'enter' : 'create'); }, []);

  function triggerShake(msg: string) {
    setError(msg); setShake(true); setPin('');
    setTimeout(() => setShake(false), 500);
  }

  async function handleDigit(d: string) {
    const next = pin + d;
    if (next.length > 4) return;
    setPin(next); setError('');
    if (next.length < 4) return;

    // 4 digits entered
    if (mode === 'enter') {
      const hash = await hashPin(next);
      const saved = getSavedHash();
      if (hash === saved) { onUnlock(hash); }
      else { triggerShake('PIN ไม่ถูกต้อง'); }

    } else if (mode === 'create') {
      setFirst(next); setPin(''); setMode('confirm');

    } else if (mode === 'confirm') {
      if (next === first) {
        const hash = await hashPin(next);
        saveHash(hash); onUnlock(hash);
      } else {
        triggerShake('PIN ไม่ตรงกัน ลองใหม่');
        setMode('create'); setFirst('');
      }
    }
  }

  function handleDel() { setPin((p) => p.slice(0, -1)); setError(''); }

  function handleForgot() {
    if (confirm('ลบ PIN และข้อมูลบน device นี้? (ข้อมูลใน Cloud ยังคงอยู่)')) {
      clearPin(); localStorage.removeItem('cpap_records'); setMode('create'); setPin(''); setFirst('');
    }
  }

  const title = mode === 'enter' ? 'ใส่ PIN' : mode === 'create' ? 'ตั้ง PIN ใหม่ (4 หลัก)' : 'ยืนยัน PIN อีกครั้ง';

  return (
    <div className="flex min-h-screen flex-col items-center justify-center px-8 bg-[#0b1220]">
      <div className="mb-8 text-center">
        <div className="text-4xl mb-2">🫁</div>
        <h1 className="text-xl font-bold text-white">CPAP Analyzer</h1>
        <p className="mt-1 text-sm text-slate-400">{title}</p>
      </div>

      {/* dots */}
      <div className={`flex gap-4 mb-8 ${shake ? 'animate-shake' : ''}`}>
        {[0, 1, 2, 3].map((i) => (
          <div key={i} className={`h-4 w-4 rounded-full border-2 transition-colors ${
            i < pin.length ? 'bg-sky-400 border-sky-400' : 'border-slate-600 bg-transparent'
          }`} />
        ))}
      </div>

      {error && <p className="mb-4 text-sm text-rose-400">{error}</p>}

      {/* numpad */}
      <div className="grid grid-cols-3 gap-3 w-60">
        {['1','2','3','4','5','6','7','8','9','','0','⌫'].map((d, i) => (
          d === '' ? <div key={i} /> :
          d === '⌫' ? (
            <button key={i} onClick={handleDel}
              className="h-16 rounded-2xl bg-slate-800 text-xl text-slate-300 active:scale-95 transition-transform">
              ⌫
            </button>
          ) : (
            <button key={i} onClick={() => handleDigit(d)}
              className="h-16 rounded-2xl bg-slate-800 text-xl font-semibold text-white active:scale-95 active:bg-slate-700 transition-all">
              {d}
            </button>
          )
        ))}
      </div>

      {mode === 'enter' && (
        <button onClick={handleForgot} className="mt-8 text-xs text-slate-500 underline">
          ลืม PIN?
        </button>
      )}

      <style>{`.animate-shake{animation:shake .4s ease-in-out}@keyframes shake{0%,100%{transform:translateX(0)}20%,60%{transform:translateX(-8px)}40%,80%{transform:translateX(8px)}}`}</style>
    </div>
  );
}
