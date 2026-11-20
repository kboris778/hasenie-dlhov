import { isOverdue, paidCents, remainingCents } from './format.js';

/**
 * Larger remaining debts stand in the foreground. Smaller ones, then cold pits,
 * step back toward the forest. Screen rows are spaced so name labels stay apart;
 * perspective scale and a slight inward drift sell the distance.
 * Labels scale only a little and sit just above each flame, kept clear of the far row.
 */

const SLOTS = [
  { x: 0.32, y: 0.83 },
  { x: 0.74, y: 0.79 },
  { x: 0.22, y: 0.745 },
  { x: 0.78, y: 0.71 },
  { x: 0.34, y: 0.67 },
  { x: 0.78, y: 0.635 },
  { x: 0.2, y: 0.6 },
  { x: 0.76, y: 0.575 },
  { x: 0.32, y: 0.55 },
  { x: 0.68, y: 0.535 },
  { x: 0.46, y: 0.52 },
  { x: 0.62, y: 0.5 },
];

const PICKS = {
  1: [0],
  2: [0, 10],
  3: [0, 5, 10],
  4: [0, 1, 6, 10],
  5: [0, 1, 4, 7, 10],
  6: [0, 1, 2, 5, 8, 10],
  7: [0, 1, 2, 4, 6, 8, 10],
  8: [0, 1, 2, 4, 5, 7, 9, 10],
  9: [0, 1, 2, 3, 5, 6, 8, 10, 11],
  10: [0, 1, 2, 3, 5, 6, 8, 9, 10, 11],
  11: [0, 1, 2, 3, 4, 5, 6, 7, 9, 10, 11],
  12: [0, 1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11],
};

const LABEL_W = 152;
const LABEL_H = 42;

export function layoutCreditors(creditors, viewport) {
  const list = creditors.slice(0, 12);
  const maxRemaining = list.reduce((max, creditor) => Math.max(max, remainingCents(creditor)), 0);
  const ranked = list
    .map((creditor, index) => ({ creditor, index }))
    .sort((a, b) => {
      const ra = remainingCents(a.creditor);
      const rb = remainingCents(b.creditor);
      if (ra !== rb) return rb - ra;
      if (a.creditor.createdAt !== b.creditor.createdAt) return a.creditor.createdAt < b.creditor.createdAt ? -1 : 1;
      return a.index - b.index;
    });

  const picks = PICKS[ranked.length] || PICKS[12];
  const items = ranked.map((entry, rank) => {
    const slot = ranked.length === 1 ? { x: 0.5, y: 0.78 } : SLOTS[picks[rank]];
    return { creditor: entry.creditor, x: slot.x, y: slot.y };
  });

  relax(items, viewport, maxRemaining);

  return items
    .map((item) => decorate(item, maxRemaining))
    .sort((a, b) => a.zIndex - b.zIndex);
}

function decorate(item, maxRemaining) {
  const rem = remainingCents(item.creditor);
  const pit = rem <= 0;
  const projected = project(item.x, item.y);
  const t = !pit && maxRemaining > 0 ? rem / maxRemaining : 0;
  const debtScale = pit ? 1 : 0.58 + 0.9 * t;
  const visualScale = pit
    ? 0.78 + 0.08 * (1 - projected.z)
    : Math.min(1.42, Math.max(0.5, projected.pScale * debtScale));
  const labelScale = 0.94 + 0.06 * (1 - projected.z);
  const glow = pit ? 0.2 : (0.62 + 0.95 * Math.max(t, 0.25)) * (0.82 + 0.55 * projected.z);
  const pool = pit ? 0.28 : (0.75 + 1.15 * t) * (1.05 - 0.15 * projected.z);
  const tree = pit ? 0.06 : (0.28 + 0.95 * projected.z) * (0.5 + 0.65 * Math.max(t, 0.25));
  return {
    id: item.creditor.id,
    name: item.creditor.name,
    total: item.creditor.totalCents,
    remaining: rem,
    paid: Math.min(item.creditor.totalCents, paidCents(item.creditor)),
    pit,
    overdue: isOverdue(item.creditor),
    xPct: projected.xPct,
    yPct: projected.yPct,
    z: projected.z,
    pScale: projected.pScale,
    debtScale,
    visualScale,
    labelScale,
    labelLift: labelLiftFor(pit, visualScale),
    glow,
    pool,
    tree,
    zIndex: Math.round((1 - projected.z) * 100) + 2,
  };
}

export function project(x, y) {
  const yPct = clamp(y, 0.36, 0.86);
  const depth = clamp((0.84 - yPct) / (0.84 - 0.38), 0, 1);
  const xPct = clamp(0.5 + (x - 0.5) * (1 - 0.06 * depth), 0.14, 0.86);
  const pScale = 1 - 0.46 * depth;
  return { xPct, yPct, pScale, z: depth };
}

function labelLiftFor(pit, visualScale) {
  if (pit) return 104;
  const tip = 142 * visualScale;
  return Math.min(230, tip + 10);
}

function relax(items, viewport, maxRemaining) {
  const w = viewport?.w || 390;
  const h = viewport?.h || 844;
  const origin = items.map((item) => item.x);
  for (let iter = 0; iter < 16; iter += 1) {
    let moved = false;
    for (let i = 0; i < items.length; i += 1) {
      for (let j = i + 1; j < items.length; j += 1) {
        const A = labelBounds(items[i], w, h, maxRemaining);
        const B = labelBounds(items[j], w, h, maxRemaining);
        const overlapX = Math.min(A.r, B.r) - Math.max(A.l, B.l);
        const overlapY = Math.min(A.b, B.b) - Math.max(A.t, B.t);
        if (overlapX > 1 && overlapY > 1) {
          const dir = items[j].x >= items[i].x ? 1 : -1;
          const push = Math.min(0.04, overlapX / w * 0.45 + 0.004);
          items[i].x -= dir * push;
          items[j].x += dir * push;
          moved = true;
        }
      }
    }
    for (let i = 0; i < items.length; i += 1) {
      items[i].x = clamp(items[i].x, origin[i] - 0.08, origin[i] + 0.08);
    }
    if (!moved) break;
  }
}

function labelBounds(item, w, h, maxRemaining) {
  const projected = project(item.x, item.y);
  const rem = remainingCents(item.creditor);
  const pit = rem <= 0;
  const t = !pit && maxRemaining > 0 ? rem / maxRemaining : 0;
  const debtScale = pit ? 1 : 0.58 + 0.9 * t;
  const visualScale = pit
    ? 0.78 + 0.08 * (1 - projected.z)
    : Math.min(1.42, Math.max(0.5, projected.pScale * debtScale));
  const labelScale = 0.94 + 0.06 * (1 - projected.z);
  const lift = labelLiftFor(pit, visualScale);
  const baseX = projected.xPct * w;
  const baseY = projected.yPct * h;
  const half = (LABEL_W * labelScale) / 2 + 6;
  const bottom = baseY - lift;
  return { l: baseX - half, r: baseX + half, t: bottom - LABEL_H * labelScale, b: bottom };
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}
