const PIN_KEY = 'cpap_pin_hash';
const SALT = 'cpap-aeonmed-2025';

export async function hashPin(pin: string): Promise<string> {
  const buf = await crypto.subtle.digest(
    'SHA-256',
    new TextEncoder().encode(pin + SALT),
  );
  return Array.from(new Uint8Array(buf)).map((b) => b.toString(16).padStart(2, '0')).join('');
}

export function getSavedHash(): string | null {
  try { return localStorage.getItem(PIN_KEY); } catch { return null; }
}

export function saveHash(hash: string) {
  localStorage.setItem(PIN_KEY, hash);
}

export function clearPin() {
  localStorage.removeItem(PIN_KEY);
}

export function hasPinSet(): boolean {
  return !!getSavedHash();
}
