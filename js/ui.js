import {
  formatDate,
  formatEuro,
  formatStamp,
  isOverdue,
  meadowStatus,
  paidCents,
  percentExtinguished,
  remainingCents,
} from './format.js';
import { createFlame, prefersReducedMotion } from './flames.js';

const PIT_MARKUP = `
  <svg class="pit-svg" viewBox="0 0 170 100" aria-hidden="true">
    <ellipse cx="85" cy="78" rx="64" ry="14" fill="rgba(20,12,6,0.28)"/>
    <ellipse cx="85" cy="70" rx="46" ry="12" fill="#3c322a"/>
    <ellipse cx="85" cy="68" rx="34" ry="8" fill="#241910"/>
    <g fill="#6d675f" stroke="#3c3832" stroke-width="1">
      <ellipse cx="28" cy="72" rx="13" ry="9" transform="rotate(-18 28 72)"/>
      <ellipse cx="48" cy="56" rx="11" ry="8" transform="rotate(-8 48 56)"/>
      <ellipse cx="74" cy="48" rx="12" ry="8"/>
      <ellipse cx="102" cy="50" rx="11" ry="8" transform="rotate(8 102 50)"/>
      <ellipse cx="128" cy="60" rx="12" ry="9" transform="rotate(14 128 60)"/>
      <ellipse cx="140" cy="76" rx="12" ry="8" transform="rotate(20 140 76)"/>
      <ellipse cx="112" cy="86" rx="12" ry="8"/>
      <ellipse cx="78" cy="90" rx="13" ry="7"/>
      <ellipse cx="46" cy="84" rx="12" ry="8" transform="rotate(-12 46 84)"/>
    </g>
    <g>
      <ellipse cx="40" cy="66" rx="5" ry="3" fill="rgba(255,255,255,0.18)"/>
      <ellipse cx="96" cy="46" rx="4" ry="2" fill="rgba(255,255,255,0.16)"/>
      <ellipse cx="132" cy="70" rx="4" ry="2.2" fill="rgba(255,255,255,0.14)"/>
    </g>
    <rect x="48" y="64" width="74" height="8" rx="4" fill="#1a120e" transform="rotate(-14 85 68)"/>
    <rect x="54" y="66" width="64" height="7" rx="3.5" fill="#2c1c14" transform="rotate(16 86 70)"/>
    <rect x="78" y="60" width="28" height="6" rx="3" fill="#3a2418" transform="rotate(-36 92 63)"/>
    <ellipse cx="96" cy="69" rx="5" ry="2.3" fill="#ff6a2a"/>
    <ellipse cx="96" cy="69" rx="2" ry="1" fill="#ffe0b0"/>
  </svg>
  <i class="wisp w1"></i>
  <i class="wisp w2"></i>
`;

export function createUI(handlers) {
  const overlay = document.getElementById('overlay');
  const firesEl = document.getElementById('fires');
  const labelsEl = document.getElementById('labels');
  const groundLights = document.getElementById('ground-lights');
  const treeLights = document.getElementById('tree-lights');
  const empty = document.getElementById('empty');
  const fab = document.getElementById('fab');
  const statusLine = document.getElementById('status-line');
  const metrics = document.getElementById('metrics');
  const remainEl = document.getElementById('remain');
  const paidEl = document.getElementById('paid');
  const pctEl = document.getElementById('pct');
  const totalLine = document.getElementById('total-line');
  const bar = document.getElementById('bar');
  const toastEl = document.getElementById('toast');
  const nodes = new Map();
  let sheetKey = '';
  let toastTimer = 0;
  const shown = { remain: null, paid: null };

  document.getElementById('settings-btn').addEventListener('click', () => handlers.open({ type: 'settings' }));
  fab.addEventListener('click', () => handlers.open({ type: 'add' }));
  document.getElementById('empty-add').addEventListener('click', () => handlers.open({ type: 'add' }));
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape' && sheetKey) handlers.close();
  });

  function toast(message) {
    toastEl.textContent = message;
    toastEl.classList.add('show');
    clearTimeout(toastTimer);
    toastTimer = setTimeout(() => toastEl.classList.remove('show'), 2800);
  }

  function render(model) {
    renderHud(model.data.creditors);
    renderFires(model);
    const key = sheetIdentity(model.sheet);
    if (key !== sheetKey) {
      sheetKey = key;
      renderSheet(model);
    }
  }

  function renderHud(creditors) {
    const emptyMeadow = creditors.length === 0;
    metrics.hidden = emptyMeadow;
    statusLine.textContent = emptyMeadow
      ? 'Zatiaľ tu nehorí žiadny oheň.'
      : meadowStatus(creditors);
    empty.hidden = !emptyMeadow;
    fab.hidden = emptyMeadow;
    fab.classList.toggle('is-full', creditors.length >= 12);
    fab.setAttribute('aria-label', creditors.length >= 12 ? 'Lúka je plná, najviac 12 ohňov' : 'Pridať veriteľa');

    if (emptyMeadow) return;
    const remain = creditors.reduce((s, c) => s + remainingCents(c), 0);
    const paid = creditors.reduce((s, c) => s + Math.min(c.totalCents, paidCents(c)), 0);
    const total = creditors.reduce((s, c) => s + c.totalCents, 0);
    const pct = percentExtinguished(creditors);
    tweenMoney(remainEl, shown.remain, remain);
    tweenMoney(paidEl, shown.paid, paid);
    shown.remain = remain;
    shown.paid = paid;
    pctEl.textContent = `${pct} %`;
    bar.style.width = `${pct}%`;
    document.getElementById('bar-track').setAttribute('aria-valuenow', String(pct));
    totalLine.textContent = `Celkovo ${formatEuro(total)}`;
  }

  function renderFires(model) {
    const placed = model.placed;
    const seen = new Set();
    for (const item of placed) {
      seen.add(item.id);
      let node = nodes.get(item.id);
      if (!node) {
        node = createFireNode(item.id);
        nodes.set(item.id, node);
        firesEl.appendChild(node.el);
        labelsEl.appendChild(node.anchor);
        groundLights.appendChild(node.pool);
        treeLights.appendChild(node.tree);
        node.flame = createFlame(node.canvas);
        requestAnimationFrame(() => node.flame.resize());
      }
      updateFireNode(node, item, model.splash);
    }
    for (const [id, node] of nodes) {
      if (!seen.has(id)) {
        nodes.delete(id);
        retire(node);
      }
    }
  }

  function createFireNode(id) {
    const el = document.createElement('div');
    el.className = 'fire no-move';
    el.dataset.id = id;
    el.innerHTML = `
      <span class="halo"></span>
      <span class="visual">
        <canvas></canvas>
        <span class="hot"></span>
        <span class="pit">${PIT_MARKUP}</span>
      </span>
    `;
    const anchor = document.createElement('div');
    anchor.className = 'label-anchor no-move';
    const label = document.createElement('button');
    label.type = 'button';
    label.className = 'label';
    label.innerHTML = '<span class="label-name"></span><span class="label-amt"></span><span class="sr-only overdue-note"></span>';
    anchor.appendChild(label);
    const pool = document.createElement('span');
    pool.className = 'pool';
    const scorch = document.createElement('span');
    scorch.className = 'scorch';
    pool.appendChild(scorch);
    const tree = document.createElement('span');
    tree.className = 'tree-light';
    const open = () => handlers.open({ type: 'detail', id });
    label.addEventListener('click', open);
    el.querySelector('.hot').addEventListener('click', open);
    requestAnimationFrame(() => {
      el.classList.remove('no-move');
      anchor.classList.remove('no-move');
    });
    return {
      el,
      anchor,
      pool,
      tree,
      canvas: el.querySelector('canvas'),
      halo: el.querySelector('.halo'),
      visual: el.querySelector('.visual'),
      label,
      name: label.querySelector('.label-name'),
      amt: label.querySelector('.label-amt'),
      overdue: label.querySelector('.overdue-note'),
      flame: null,
      holdUntil: 0,
    };
  }

  function updateFireNode(node, item, splash) {
    const el = node.el;
    el.style.left = `${item.xPct * 100}%`;
    el.style.top = `${item.yPct * 100}%`;
    el.style.zIndex = String(item.zIndex);
    node.anchor.style.left = `${item.xPct * 100}%`;
    node.anchor.style.top = `${item.yPct * 100}%`;
    el.dataset.remaining = String(item.remaining);
    el.dataset.total = String(item.total);
    el.dataset.scale = item.visualScale.toFixed(3);
    el.dataset.depth = item.z.toFixed(3);
    el.dataset.name = item.name;
    node.halo.style.transform = `translateX(-50%) scale(${item.glow})`;
    node.visual.style.transform = `translateX(-50%) scale(${item.visualScale})`;
    node.label.style.transform = `translateX(-50%) scale(${item.labelScale})`;
    node.label.style.bottom = `${item.labelLift}px`;
    node.name.textContent = item.name;
    node.amt.textContent = item.pit ? 'Splatené ✓' : `${formatEuro(item.remaining)} z ${formatEuro(item.total)}`;
    node.label.classList.toggle('is-paid', item.pit);
    node.label.classList.toggle('is-overdue', item.overdue && !item.pit);
    node.overdue.textContent = item.overdue && !item.pit ? 'Po splatnosti' : '';
    const sat = (0.78 + 0.24 * (1 - item.z)).toFixed(3);
    const bri = (1.06 - 0.08 * item.z).toFixed(3);
    node.visual.style.filter = item.pit ? 'none' : `saturate(${sat}) brightness(${bri})`;

    node.pool.style.left = `${item.xPct * 100}%`;
    node.pool.style.top = `${item.yPct * 100}%`;
    node.pool.style.transform = `translate(-50%, -42%) scale(${item.pool})`;
    node.pool.classList.toggle('is-pit', item.pit);
    node.tree.style.left = `${item.xPct * 100}%`;
    node.tree.style.opacity = item.pit ? '0' : String(Math.min(0.95, item.tree));
    node.tree.style.transform = `translateX(-50%) scale(${(0.7 + Math.min(item.tree, 1.3)).toFixed(3)})`;

    if (splash && splash.id === item.id && node.flame) {
      node.flame.splashBurst(splash.extinguish);
      spawnRipple(node.pool);
      if (splash.extinguish && !prefersReducedMotion()) node.holdUntil = performance.now() + 820;
    }
    const showPit = item.pit && !(node.holdUntil && performance.now() < node.holdUntil);
    node.visual.classList.toggle('is-pit', showPit);
    el.dataset.state = showPit ? 'pit' : 'burning';
    if (item.pit && node.holdUntil && performance.now() < node.holdUntil && !node.pitTimer) {
      const wait = node.holdUntil - performance.now() + 40;
      node.pitTimer = setTimeout(() => {
        node.pitTimer = 0;
        handlers.refresh();
      }, wait);
    }
  }

  function retire(node) {
    node.el.classList.add('leaving');
    node.anchor.classList.add('leaving');
    node.pool.classList.add('leaving');
    node.tree.remove();
    node.flame?.destroy();
    const delay = prefersReducedMotion() ? 0 : 280;
    setTimeout(() => {
      node.el.remove();
      node.anchor.remove();
      node.pool.remove();
    }, delay);
  }

  function renderSheet(model) {
    const sheet = model.sheet;
    if (!sheet) {
      overlay.hidden = true;
      overlay.innerHTML = '';
      return;
    }
    overlay.hidden = false;
    overlay.innerHTML = '';
    const backdrop = el('button', 'backdrop');
    backdrop.type = 'button';
    backdrop.setAttribute('aria-label', 'Zavrieť');
    backdrop.addEventListener('click', () => handlers.close());
    const dialog = el('div', 'sheet');
    dialog.setAttribute('role', 'dialog');
    dialog.setAttribute('aria-modal', 'true');
    dialog.setAttribute('aria-labelledby', 'sheet-title');
    const creditor = sheet.id ? model.data.creditors.find((c) => c.id === sheet.id) : null;
    if (sheet.type === 'add') buildForm(dialog, null);
    else if (sheet.type === 'edit' && creditor) buildForm(dialog, creditor);
    else if (sheet.type === 'detail' && creditor) buildDetail(dialog, creditor);
    else if (sheet.type === 'settings') buildSettings(dialog);
    else if (sheet.type === 'confirm') buildConfirm(dialog, sheet, model);
    else {
      overlay.hidden = true;
      return;
    }
    overlay.append(backdrop, dialog);
    trapFocus(dialog);
    requestAnimationFrame(() => {
      const target = dialog.querySelector('[data-autofocus], input, textarea, button');
      target?.focus();
    });
  }

  function buildForm(dialog, creditor) {
    dialog.append(sheetHead(creditor ? 'Upraviť dlh' : 'Nový oheň', creditor ? 'Zmeňte meno, sumu alebo poznámku.' : 'Každý veriteľ dostane vlastný oheň na lúke.'));
    const form = el('form', 'sheet-scroll');
    form.append(
      field('Meno veriteľa', input('text', 'name', creditor?.name || '', 'napr. Peter', true)),
      field('Celková suma', input('text', 'amount', creditor ? eurosInput(creditor.totalCents) : '', 'napr. 1 200', true, 'decimal')),
      field('Poznámka', area('note', creditor?.note || '', 'Voliteľné')),
      field('Dátum splatnosti', input('date', 'due', creditor?.dueDate || '', '', false)),
      errorLine(),
    );
    const actions = el('div', 'sheet-actions');
    const save = el('button', 'btn btn-ember', creditor ? 'Uložiť zmeny' : 'Zapáliť oheň');
    save.type = 'submit';
    actions.append(save);
    form.append(actions);
    form.addEventListener('submit', (e) => {
      e.preventDefault();
      const data = Object.fromEntries(new FormData(form));
      const err = creditor ? handlers.edit(creditor.id, data) : handlers.add(data);
      if (err) showError(err);
    });
    dialog.append(form);
  }

  function buildDetail(dialog, creditor) {
    const rem = remainingCents(creditor);
    const paid = Math.min(creditor.totalCents, paidCents(creditor));
    const pit = rem <= 0;
    const head = sheetHead(creditor.name, pit ? 'Oheň je uhasený.' : 'Ťuknutím na splátku oheň zmenšíte.');
    dialog.append(head);
    const scroll = el('div', 'sheet-scroll');
    const hero = el('div', 'hero-block');
    const amount = el('p', 'hero-amount', pit ? 'Splatené' : formatEuro(rem));
    const sub = el('p', 'hero-sub', pit ? `Zaplatené ${formatEuro(paid)}` : `zostáva z ${formatEuro(creditor.totalCents)}`);
    hero.append(amount, sub);
    if (!pit) {
      const mini = el('div', 'mini-bar');
      const fill = el('span');
      fill.style.width = `${Math.round((paid / creditor.totalCents) * 100)}%`;
      mini.append(fill);
      hero.append(mini);
    }
    scroll.append(hero);
    if (creditor.note) scroll.append(noteBlock(creditor.note));
    if (creditor.dueDate) {
      const due = el('p', `due ${isOverdue(creditor) ? 'is-overdue' : ''}`);
      due.textContent = isOverdue(creditor)
        ? `Po splatnosti · ${formatDate(creditor.dueDate)}`
        : `Splatnosť ${formatDate(creditor.dueDate)}`;
      scroll.append(due);
    }
    scroll.append(el('h3', 'section-title', 'História platieb'));
    const list = el('ul', 'history');
    const payments = [...creditor.payments].sort((a, b) => (a.at < b.at ? 1 : -1));
    if (!payments.length) list.append(el('li', 'history-empty', 'Zatiaľ bez platieb.'));
    for (const payment of payments) {
      const li = el('li', 'history-row');
      li.append(el('span', '', formatStamp(payment.at)), el('strong', '', formatEuro(payment.cents)));
      list.append(li);
    }
    scroll.append(list);
    dialog.append(scroll);

    const actions = el('div', 'sheet-actions');
    if (!pit) {
      const payRow = el('div', 'pay-row');
      const amountInput = input('text', 'pay', '', 'Suma v €', false, 'decimal');
      amountInput.dataset.autofocus = 'true';
      amountInput.setAttribute('aria-label', 'Suma splátky');
      const partial = el('button', 'btn btn-water', 'Zaplatiť časť');
      partial.type = 'button';
      partial.addEventListener('click', () => {
        const err = handlers.pay(creditor.id, amountInput.value);
        if (err) showError(err);
      });
      payRow.append(amountInput, partial);
      const full = el('button', 'btn btn-ember', `Splatiť celé · ${formatEuro(rem)}`);
      full.type = 'button';
      full.addEventListener('click', () => {
        const err = handlers.payAll(creditor.id);
        if (err) showError(err);
      });
      actions.append(payRow, errorLine(), full);
    }
    const row = el('div', 'btn-row');
    const edit = el('button', 'btn btn-ghost', 'Upraviť');
    edit.type = 'button';
    edit.addEventListener('click', () => handlers.open({ type: 'edit', id: creditor.id }));
    const del = el('button', 'btn btn-danger', 'Odstrániť');
    del.type = 'button';
    del.addEventListener('click', () => handlers.open({ type: 'confirm', kind: 'delete', id: creditor.id }));
    row.append(edit, del);
    actions.append(row);
    dialog.append(actions);
  }

  function buildSettings(dialog) {
    dialog.append(sheetHead('Nastavenia', 'Dlhy zostávajú len v tomto prehliadači. Zálohu si viete odniesť ako JSON.'));
    const body = el('div', 'sheet-scroll settings-body');
    const exp = el('button', 'btn btn-ghost', 'Exportovať zálohu');
    exp.type = 'button';
    exp.addEventListener('click', () => handlers.export());
    const imp = el('button', 'btn btn-ghost', 'Importovať zálohu');
    imp.type = 'button';
    const file = document.createElement('input');
    file.type = 'file';
    file.accept = 'application/json,.json';
    file.hidden = true;
    imp.addEventListener('click', () => file.click());
    file.addEventListener('change', () => {
      const picked = file.files?.[0];
      file.value = '';
      if (!picked) return;
      if (picked.size > 2_000_000) {
        toast('Súbor je príliš veľký.');
        return;
      }
      handlers.importFile(picked);
    });
    const wipe = el('button', 'btn btn-danger', 'Vymazať všetky údaje');
    wipe.type = 'button';
    wipe.addEventListener('click', () => handlers.open({ type: 'confirm', kind: 'wipe' }));
    body.append(exp, imp, file, wipe);
    dialog.append(body);
  }

  function buildConfirm(dialog, sheet, model) {
    let title = 'Potvrdiť';
    let text = '';
    let danger = 'Potvrdiť';
    if (sheet.kind === 'delete') {
      const creditor = model.data.creditors.find((c) => c.id === sheet.id);
      title = 'Odstrániť dlh';
      text = creditor
        ? `Naozaj odstrániť dlh „${creditor.name}“? Zmizne oheň aj história platieb.`
        : 'Tento dlh sa už nenašiel.';
      danger = 'Odstrániť';
    } else if (sheet.kind === 'wipe') {
      title = 'Vymazať všetko';
      text = 'Naozaj vymazať všetky dlhy z tohto zariadenia? Zálohu si predtým môžete exportovať.';
      danger = 'Vymazať';
    } else if (sheet.kind === 'import') {
      title = 'Nahradiť údaje';
      text = 'Záloha nahradí dlhy, ktoré sú teraz na lúke. Tento krok sa nedá vrátiť inak než ďalšou zálohou.';
      danger = 'Nahradiť';
    }
    dialog.append(sheetHead(title, text));
    const actions = el('div', 'sheet-actions');
    const row = el('div', 'btn-row');
    const cancel = el('button', 'btn btn-ghost', 'Zrušiť');
    cancel.type = 'button';
    cancel.addEventListener('click', () => handlers.close());
    const ok = el('button', 'btn btn-danger', danger);
    ok.type = 'button';
    ok.dataset.autofocus = 'true';
    ok.addEventListener('click', () => handlers.confirm(sheet));
    row.append(cancel, ok);
    actions.append(row);
    dialog.append(actions);
  }

  return { render, toast };
}

function sheetIdentity(sheet) {
  if (!sheet) return '';
  return `${sheet.type}:${sheet.kind || ''}:${sheet.id || ''}`;
}

function sheetHead(title, sub) {
  const head = el('div', 'sheet-head');
  const handle = el('div', 'handle');
  const h = el('h2', 'sheet-title', title);
  h.id = 'sheet-title';
  head.append(handle, h);
  if (sub) head.append(el('p', 'sheet-sub', sub));
  return head;
}

function field(label, control) {
  const wrap = el('label', 'field');
  wrap.append(el('span', '', label), control);
  return wrap;
}

function input(type, name, value, placeholder, autofocus, mode) {
  const node = document.createElement('input');
  node.type = type;
  node.name = name;
  node.value = value;
  if (placeholder) node.placeholder = placeholder;
  if (autofocus) node.dataset.autofocus = 'true';
  if (mode) node.inputMode = mode;
  node.autocomplete = 'off';
  if (type === 'text') node.maxLength = name === 'name' ? 40 : 20;
  return node;
}

function area(name, value, placeholder) {
  const node = document.createElement('textarea');
  node.name = name;
  node.value = value;
  node.placeholder = placeholder;
  node.rows = 3;
  node.maxLength = 280;
  return node;
}

function errorLine() {
  const node = el('p', 'form-error');
  node.id = 'form-error';
  node.hidden = true;
  return node;
}

function showError(message) {
  const node = document.getElementById('form-error');
  if (!node) return;
  node.hidden = !message;
  node.textContent = message || '';
}

function noteBlock(text) {
  const node = el('p', 'note-block');
  node.textContent = text;
  return node;
}

function eurosInput(cents) {
  const whole = cents % 100 === 0;
  const value = cents / 100;
  return whole ? String(value) : value.toFixed(2).replace('.', ',');
}

function el(tag, className, text) {
  const node = document.createElement(tag);
  if (className) node.className = className;
  if (text != null) node.textContent = text;
  return node;
}

function spawnRipple(pool) {
  const ripple = document.createElement('i');
  ripple.className = 'ripple';
  pool.appendChild(ripple);
  ripple.addEventListener('animationend', () => ripple.remove());
}

const tweens = new WeakMap();

function tweenMoney(node, from, to) {
  if (from == null || prefersReducedMotion() || from === to) {
    node.textContent = formatEuro(to);
    return;
  }
  const prev = tweens.get(node);
  if (prev) cancelAnimationFrame(prev.frame);
  const start = performance.now();
  const job = { frame: 0 };
  const step = (now) => {
    const t = Math.min(1, (now - start) / 700);
    const eased = 1 - (1 - t) ** 3;
    node.textContent = formatEuro(Math.round(from + (to - from) * eased));
    if (t < 1) job.frame = requestAnimationFrame(step);
  };
  job.frame = requestAnimationFrame(step);
  tweens.set(node, job);
}

function trapFocus(dialog) {
  dialog.addEventListener('keydown', (e) => {
    if (e.key !== 'Tab') return;
    const items = [...dialog.querySelectorAll('button, input, textarea, select')].filter((item) => !item.disabled && !item.hidden && item.offsetParent !== null);
    if (!items.length) return;
    const first = items[0];
    const last = items[items.length - 1];
    if (e.shiftKey && document.activeElement === first) {
      e.preventDefault();
      last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
      e.preventDefault();
      first.focus();
    }
  });
}
