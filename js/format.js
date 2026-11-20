/** Slovak copy, euro formatting, and small pure helpers. */

export function uid() {
  if (typeof crypto !== 'undefined' && crypto.randomUUID) return crypto.randomUUID();
  return `id-${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 8)}`;
}

export function formatEuro(cents) {
  const value = (Number(cents) || 0) / 100;
  const whole = Math.round(value * 100) % 100 === 0;
  return new Intl.NumberFormat('sk-SK', {
    style: 'currency',
    currency: 'EUR',
    minimumFractionDigits: whole ? 0 : 2,
    maximumFractionDigits: 2,
  }).format(value);
}

export function formatDate(iso) {
  if (!iso) return '';
  const [y, m, d] = iso.split('-').map(Number);
  if (!y || !m || !d) return '';
  return new Intl.DateTimeFormat('sk-SK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(new Date(y, m - 1, d));
}

export function formatStamp(iso) {
  const dt = new Date(iso);
  if (Number.isNaN(dt.getTime())) return '';
  return new Intl.DateTimeFormat('sk-SK', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  }).format(dt);
}

export function todayISO() {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

/** Accepts Slovak comma decimals and spaces as thousands separators. */
export function parseEuroToCents(raw) {
  if (typeof raw !== 'string') return null;
  let s = raw.trim().replace(/\u00a0/g, '').replace(/\s/g, '');
  if (!s) return null;
  if (s.includes(',') && s.includes('.')) return null;
  s = s.replace(',', '.');
  if (!/^\d+(\.\d{1,2})?$/.test(s)) return null;
  const cents = Math.round(Number(s) * 100);
  if (!Number.isFinite(cents) || cents <= 0 || cents > 999_999_999) return null;
  return cents;
}

export function paidCents(creditor) {
  return (creditor.payments || []).reduce((sum, p) => sum + p.cents, 0);
}

export function remainingCents(creditor) {
  return Math.max(0, creditor.totalCents - paidCents(creditor));
}

export function isOverdue(creditor) {
  if (!creditor.dueDate || remainingCents(creditor) <= 0) return false;
  return creditor.dueDate < todayISO();
}

export function meadowStatus(creditors) {
  if (!creditors.length) return 'Každý dlh je oheň. Splatením ho uhasíte.';
  const burning = creditors.filter((c) => remainingCents(c) > 0).length;
  const pits = creditors.length - burning;
  if (burning === 0) return 'Všetky ohne sú uhasené. Lúka je opäť tichá.';
  const burn = burningPhrase(burning);
  if (!pits) return burn;
  return `${burn} · ${pitPhrase(pits)}`;
}

function burningPhrase(n) {
  if (n === 1) return '1 oheň horí';
  if (n >= 2 && n <= 4) return `${n} ohne horia`;
  return `${n} ohňov horí`;
}

function pitPhrase(n) {
  if (n === 1) return '1 ohnisko';
  if (n >= 2 && n <= 4) return `${n} ohniská`;
  return `${n} ohnísk`;
}

export function percentExtinguished(creditors) {
  const total = creditors.reduce((s, c) => s + c.totalCents, 0);
  const paid = creditors.reduce((s, c) => s + Math.min(c.totalCents, paidCents(c)), 0);
  if (total <= 0) return 0;
  const p = (paid / total) * 100;
  if (p > 0 && p < 1) return 1;
  if (p > 99 && p < 100) return 99;
  return Math.round(p);
}

export function sumCents(creditors, pick) {
  return creditors.reduce((s, c) => s + pick(c), 0);
}
