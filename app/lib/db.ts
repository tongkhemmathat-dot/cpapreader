import { createClient } from '@supabase/supabase-js';
import type { DailyRecord } from './storage';

function getClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key);
}

export async function syncUpsert(pinHash: string, record: DailyRecord): Promise<void> {
  const sb = getClient(); if (!sb) return;
  await sb.from('cpap_records').upsert({ pin_hash: pinHash, date: record.date, data: record, saved_at: record.savedAt }, { onConflict: 'pin_hash,date' });
}

export async function syncDelete(pinHash: string, date: string): Promise<void> {
  const sb = getClient(); if (!sb) return;
  await sb.from('cpap_records').delete().eq('pin_hash', pinHash).eq('date', date);
}

export async function fetchAll(pinHash: string): Promise<DailyRecord[]> {
  const sb = getClient(); if (!sb) return [];
  const { data, error } = await sb.from('cpap_records').select('data').eq('pin_hash', pinHash).order('date', { ascending: false });
  if (error || !data) return [];
  return data.map((r: any) => r.data as DailyRecord);
}

export function isConfigured(): boolean {
  return !!(process.env.NEXT_PUBLIC_SUPABASE_URL && process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY);
}
