import { getApiBase } from '../api/client';
import { promptDialog } from '../utils/dialogs';

export async function ensureOnlineJwt() {
  try {
    const t = localStorage.getItem('ptSales:authToken');
    if (t && t.toLowerCase() !== 'offline') return true;
  } catch {}
  let name = '';
  try {
    const raw = localStorage.getItem('ptSales:state');
    if (raw) {
      const st = JSON.parse(raw);
      name = st?.auth?.user?.name || '';
    }
  } catch {}
  const pin = await promptDialog(`Enter PIN for ${name || 'your user'} to authenticate`);
  if (!pin || !/^\d{4,6}$/.test(String(pin))) return false;
  const base = getApiBase();
  const res = await fetch(`${base}/api/auth/login`, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ username: name, pin }) });
  if (!res.ok) throw new Error(`HTTP ${res.status}`);
  const data = await res.json();
  if (data?.token) {
    try { localStorage.setItem('ptSales:authToken', data.token); } catch {}
    return true;
  }
  return false;
}

export async function reauthIf401(err) {
  const msg = String(err?.message || '');
  if (!msg.includes('401')) return false;
  try {
    const ok = await ensureOnlineJwt();
    return ok;
  } catch {
    return false;
  }
}
