import { formatEuro, parseEuroToCents, remainingCents, uid } from './format.js';
import { pokeFlames, prefersReducedMotion } from './flames.js';
import { layoutCreditors } from './layout.js';
import { mountScenery } from './scenery.js';
import { clearState, downloadBackup, loadState, readBackupFile, saveState } from './store.js';
import { createUI } from './ui.js';

const state = {
  data: loadState(),
  sheet: null,
  splash: null,
  pending: null,
};

const ui = createUI({
  open,
  close,
  add,
  edit,
  pay,
  payAll,
  confirm,
  export: exportBackup,
  importFile,
  refresh,
});

mountScenery(document);
render();
setupParallax();
registerWorker();

function render() {
  const splash = state.splash;
  state.splash = null;
  ui.render({
    data: state.data,
    sheet: state.sheet,
    splash,
    placed: layoutCreditors(state.data.creditors, viewport()),
  });
}

function refresh() {
  render();
}

function viewport() {
  return { w: window.innerWidth, h: window.innerHeight };
}

function open(sheet) {
  if (sheet?.type === 'add' && state.data.creditors.length >= 12) {
    ui.toast('Na lúku sa zmestí najviac 12 ohňov.');
    return;
  }
  state.sheet = sheet;
  render();
}

function close() {
  state.sheet = null;
  state.pending = null;
  render();
}

function add(fields) {
  if (state.data.creditors.length >= 12) return 'Na lúku sa zmestí najviac 12 ohňov.';
  const parsed = readCreditorFields(fields);
  if (parsed.error) return parsed.error;
  state.data.creditors.push({
    id: uid(),
    name: parsed.name,
    totalCents: parsed.totalCents,
    note: parsed.note,
    dueDate: parsed.dueDate,
    createdAt: new Date().toISOString(),
    payments: [],
  });
  persist();
  state.sheet = null;
  ui.toast('Oheň sa zapálil.');
  render();
  return null;
}

function edit(id, fields) {
  const creditor = find(id);
  if (!creditor) return 'Dlh sa nenašiel.';
  const parsed = readCreditorFields(fields);
  if (parsed.error) return parsed.error;
  const paid = creditor.payments.reduce((sum, payment) => sum + payment.cents, 0);
  if (parsed.totalCents < paid) {
    return `Nová suma je menšia než už zaplatených ${formatEuro(paid)}.`;
  }
  const before = remainingCents(creditor);
  creditor.name = parsed.name;
  creditor.totalCents = parsed.totalCents;
  creditor.note = parsed.note;
  creditor.dueDate = parsed.dueDate;
  const after = remainingCents(creditor);
  persist();
  state.sheet = null;
  if (after < before) state.splash = { id, extinguish: after === 0 };
  ui.toast('Zmeny sú uložené.');
  render();
  return null;
}

function pay(id, raw) {
  const creditor = find(id);
  if (!creditor) return 'Dlh sa nenašiel.';
  const rem = remainingCents(creditor);
  if (rem <= 0) return 'Tento dlh je už splatený.';
  if (!String(raw || '').trim()) return 'Zadajte sumu.';
  const cents = parseEuroToCents(String(raw));
  if (cents == null) return 'Suma nie je platná. Použite napríklad 25 alebo 25,50.';
  if (cents > rem) return `To je viac, než zostáva (${formatEuro(rem)}).`;
  return commitPayment(creditor, cents);
}

function payAll(id) {
  const creditor = find(id);
  if (!creditor) return 'Dlh sa nenašiel.';
  const rem = remainingCents(creditor);
  if (rem <= 0) return 'Tento dlh je už splatený.';
  return commitPayment(creditor, rem);
}

function commitPayment(creditor, cents) {
  creditor.payments.push({ id: uid(), cents, at: new Date().toISOString() });
  const extinguish = remainingCents(creditor) === 0;
  persist();
  state.sheet = null;
  state.splash = { id: creditor.id, extinguish };
  ui.toast(extinguish ? 'Dlh je splatený. Zostalo len ohnisko.' : 'Platba započítaná. Oheň sa zmenšil.');
  render();
  return null;
}

function confirm(sheet) {
  if (sheet.kind === 'delete' && sheet.id) {
    state.data.creditors = state.data.creditors.filter((c) => c.id !== sheet.id);
    persist();
    state.sheet = null;
    ui.toast('Dlh bol odstránený.');
    render();
    return;
  }
  if (sheet.kind === 'wipe') {
    state.data = { version: 1, creditors: [] };
    state.pending = null;
    try {
      clearState();
    } catch {
      ui.toast('Údaje sa nepodarilo vymazať.');
    }
    state.sheet = null;
    ui.toast('Lúka je opäť prázdna.');
    render();
    return;
  }
  if (sheet.kind === 'import' && state.pending) {
    state.data = state.pending;
    state.pending = null;
    persist();
    state.sheet = null;
    ui.toast('Údaje boli nahradené zálohou.');
    render();
  }
}

function exportBackup() {
  try {
    downloadBackup(state.data);
    ui.toast('Záloha sa sťahuje.');
  } catch {
    ui.toast('Zálohu sa nepodarilo vytvoriť.');
  }
}

async function importFile(file) {
  try {
    state.pending = await readBackupFile(file);
    state.sheet = { type: 'confirm', kind: 'import' };
    render();
  } catch {
    ui.toast('Súbor sa nepodarilo načítať. Skontrolujte JSON zálohu.');
  }
}

function find(id) {
  return state.data.creditors.find((c) => c.id === id);
}

function readCreditorFields(fields) {
  const name = String(fields.name || '').trim();
  if (!name) return { error: 'Zadajte meno veriteľa.' };
  if (name.length > 40) return { error: 'Meno môže mať najviac 40 znakov.' };
  if (!String(fields.amount || '').trim()) return { error: 'Zadajte sumu.' };
  const totalCents = parseEuroToCents(String(fields.amount));
  if (totalCents == null) return { error: 'Suma nie je platná. Použite napríklad 1 200 alebo 25,50.' };
  const note = String(fields.note || '').trim();
  if (note.length > 280) return { error: 'Poznámka môže mať najviac 280 znakov.' };
  const due = String(fields.due || '').trim();
  const dueDate = due && /^\d{4}-\d{2}-\d{2}$/.test(due) ? due : null;
  return { name, totalCents, note, dueDate };
}

function persist() {
  try {
    saveState(state.data);
  } catch {
    ui.toast('Údaje sa nepodarilo uložiť.');
  }
}

let resizeTimer = 0;
let lastWidth = window.innerWidth;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(() => {
    const widthChanged = window.innerWidth !== lastWidth;
    lastWidth = window.innerWidth;
    if (!widthChanged && state.sheet) return;
    pokeFlames();
    render();
  }, 140);
});

if (window.visualViewport) {
  const syncKeyboard = () => {
    const overlap = Math.max(0, window.innerHeight - window.visualViewport.height - window.visualViewport.offsetTop);
    document.documentElement.style.setProperty('--kb', `${overlap}px`);
  };
  window.visualViewport.addEventListener('resize', syncKeyboard);
  window.visualViewport.addEventListener('scroll', syncKeyboard);
}

document.addEventListener('visibilitychange', () => {
  if (!document.hidden) pokeFlames();
});

function setupParallax() {
  if (prefersReducedMotion()) return;
  const world = document.querySelector('.world');
  let cx = 0;
  let cy = 0;
  let tx = 0;
  let ty = 0;
  window.addEventListener('pointermove', (event) => {
    if (event.pointerType === 'touch') return;
    tx = (event.clientX / window.innerWidth - 0.5) * 2;
    ty = (event.clientY / window.innerHeight - 0.5) * 2;
  }, { passive: true });
  window.addEventListener('deviceorientation', (event) => {
    if (event.gamma == null) return;
    tx = Math.max(-1, Math.min(1, event.gamma / 28));
    ty = Math.max(-1, Math.min(1, ((event.beta || 0) - 40) / 35));
  });
  const step = () => {
    cx += (tx - cx) * 0.05;
    cy += (ty - cy) * 0.05;
    world.style.setProperty('--px', cx.toFixed(4));
    world.style.setProperty('--py', cy.toFixed(4));
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

function registerWorker() {
  if (!('serviceWorker' in navigator)) return;
  if (location.protocol === 'file:') return;
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('sw.js').catch(() => {});
  });
}
