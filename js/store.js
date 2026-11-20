import { uid } from './format.js';

const KEY = 'hasenie-dlhov-v1';

export function loadState() {
  try {
    const raw = localStorage.getItem(KEY);
    if (!raw) return emptyState();
    return normalizeData(JSON.parse(raw));
  } catch {
    return emptyState();
  }
}

export function saveState(state) {
  const payload = {
    version: 1,
    creditors: state.creditors,
  };
  localStorage.setItem(KEY, JSON.stringify(payload));
}

export function emptyState() {
  return { version: 1, creditors: [] };
}

export function clearState() {
  localStorage.removeItem(KEY);
}

export function normalizeData(input) {
  const source = Array.isArray(input) ? { creditors: input } : input;
  if (!source || !Array.isArray(source.creditors)) {
    throw new Error('invalid');
  }
  const creditors = [];
  for (const item of source.creditors) {
    const creditor = normalizeCreditor(item);
    if (creditor) creditors.push(creditor);
    if (creditors.length >= 12) break;
  }
  return { version: 1, creditors };
}

function normalizeCreditor(c) {
  if (!c || typeof c !== 'object') return null;
  const name = typeof c.name === 'string' ? c.name.trim().slice(0, 40) : '';
  if (!name) return null;
  const totalCents = Math.round(Number(c.totalCents));
  if (!Number.isInteger(totalCents) || totalCents <= 0 || totalCents > 999_999_999) return null;
  const payments = Array.isArray(c.payments)
    ? c.payments.map(normalizePayment).filter(Boolean).slice(0, 500)
    : [];
  const note = typeof c.note === 'string' ? c.note.trim().slice(0, 280) : '';
  const dueDate = typeof c.dueDate === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(c.dueDate) ? c.dueDate : null;
  const createdAt = typeof c.createdAt === 'string' && c.createdAt ? c.createdAt : new Date().toISOString();
  const id = typeof c.id === 'string' && c.id.length <= 80 ? c.id : uid();
  return { id, name, totalCents, note, dueDate, createdAt, payments };
}

function normalizePayment(p) {
  if (!p || typeof p !== 'object') return null;
  const cents = Math.round(Number(p.cents));
  if (!Number.isInteger(cents) || cents <= 0 || cents > 999_999_999) return null;
  const at = typeof p.at === 'string' && p.at ? p.at : new Date().toISOString();
  const id = typeof p.id === 'string' && p.id ? p.id : uid();
  return { id, cents, at };
}

export function downloadBackup(state) {
  const payload = {
    app: 'hasenie-dlhov',
    version: 1,
    exportedAt: new Date().toISOString(),
    creditors: state.creditors,
  };
  const blob = new Blob([JSON.stringify(payload, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'hasenie-dlhov-zaloha.json';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1500);
}

export async function readBackupFile(file) {
  const text = await file.text();
  return normalizeData(JSON.parse(text));
}
