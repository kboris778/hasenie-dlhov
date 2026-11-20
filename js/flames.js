/** Painterly flames, sparks, smoke, and a water/steam extinguish burst. */

const reducedQuery = window.matchMedia('(prefers-reduced-motion: reduce)');

export function prefersReducedMotion() {
  return reducedQuery.matches;
}

const flames = new Set();
let loopOn = false;
let last = 0;

export function createFlame(canvas) {
  const ctx = canvas.getContext('2d', { alpha: true });
  const flame = {
    canvas,
    ctx,
    w: 0,
    h: 0,
    time: 0,
    level: 1,
    levelTarget: 1,
    recoverAt: 0,
    extinguish: false,
    splash: 0,
    sparks: [],
    smokes: [],
    drops: [],
    steams: [],
    alive: true,
    dirty: true,
    resize,
    splashBurst,
    destroy,
    tick,
  };
  resize();
  flames.add(flame);
  ensureLoop();
  if (prefersReducedMotion()) tick(0.016);
  return flame;

  function resize() {
    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const w = canvas.clientWidth || 168;
    const h = canvas.clientHeight || 230;
    flame.w = w;
    flame.h = h;
    canvas.width = Math.max(1, Math.round(w * dpr));
    canvas.height = Math.max(1, Math.round(h * dpr));
    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    flame.dirty = true;
  }

  function splashBurst(extinguish) {
    flame.splash = 1;
    flame.extinguish = Boolean(extinguish);
    flame.levelTarget = extinguish ? 0 : 0.62;
    flame.recoverAt = extinguish ? 0 : flame.time + 0.42;
    flame.drops.length = 0;
    flame.steams.length = 0;
    if (prefersReducedMotion()) {
      flame.level = flame.levelTarget;
      flame.splash = 0;
      flame.dirty = true;
      tick(0.016);
      return;
    }
    const cx = flame.w * 0.5;
    for (let i = 0; i < 42; i += 1) {
      flame.drops.push({
        x: cx + (Math.random() - 0.5) * flame.w * 0.28,
        y: flame.h * (0.02 + Math.random() * 0.18),
        vx: (Math.random() - 0.5) * 28,
        vy: 40 + Math.random() * 90,
        r: 1.4 + Math.random() * 2.4,
        life: 0.55 + Math.random() * 0.45,
        age: Math.random() * 0.08,
      });
    }
  }

  function destroy() {
    flame.alive = false;
    flames.delete(flame);
  }

  function tick(dt) {
    if (!flame.alive) return;
    const reduced = prefersReducedMotion();
    if (!reduced) flame.time += dt;
    if (!flame.extinguish && flame.recoverAt && flame.time > flame.recoverAt) {
      flame.levelTarget = 1;
      flame.recoverAt = 0;
    }
    const follow = reduced ? 1 : Math.min(1, dt * (flame.extinguish ? 2.4 : 3.2));
    flame.level += (flame.levelTarget - flame.level) * follow;
    if (flame.splash > 0 && !reduced) flame.splash = Math.max(0, flame.splash - dt / 1.05);

    const k = Math.max(0, flame.level);
    if (!reduced && k > 0.04) emitAmbient(flame, dt, k);
    stepParticles(flame, dt);
    draw(flame);
  }
}

function ensureLoop() {
  if (loopOn) return;
  loopOn = true;
  last = performance.now();
  requestAnimationFrame(frame);
}

function frame(now) {
  const dt = Math.min(0.05, (now - last) / 1000);
  last = now;
  const reduced = prefersReducedMotion();
  for (const flame of flames) {
    if (reduced) {
      if (flame.dirty) flame.tick(0.016);
    } else {
      flame.tick(dt);
    }
  }
  if (flames.size === 0) {
    loopOn = false;
    return;
  }
  if (reduced && ![...flames].some((f) => f.dirty)) {
    loopOn = false;
    return;
  }
  requestAnimationFrame(frame);
}

function emitAmbient(flame, dt, k) {
  const cx = flame.w * 0.5;
  const base = flame.h * 0.8;
  const height = flame.h * 0.58 * (0.35 + 0.65 * k);
  const sparks = (10 + 16 * k) * dt;
  if (Math.random() < sparks) {
    flame.sparks.push({
      x: cx + (Math.random() - 0.5) * flame.w * 0.16 * k,
      y: base - height * (0.15 + Math.random() * 0.45),
      vx: (Math.random() - 0.5) * 16,
      vy: -28 - Math.random() * 46,
      life: 0.35 + Math.random() * 0.55,
      age: 0,
      r: 0.8 + Math.random() * 1.5,
    });
  }
  if (flame.smokes.length < 16 && Math.random() < dt * (2.2 + k)) {
    flame.smokes.push({
      x: cx + (Math.random() - 0.5) * 18,
      y: base - height * (0.72 + Math.random() * 0.2),
      vx: (Math.random() - 0.5) * 8,
      vy: -12 - Math.random() * 12,
      r: 7 + Math.random() * 12,
      life: 1.5 + Math.random() * 1.3,
      age: 0,
    });
  }
  if (flame.sparks.length > 48) flame.sparks.splice(0, flame.sparks.length - 48);
}

function stepParticles(flame, dt) {
  const base = flame.h * 0.8;
  for (const p of flame.sparks) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy -= 8 * dt;
  }
  flame.sparks = flame.sparks.filter((p) => p.age < p.life);

  for (const p of flame.smokes) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.r += 8 * dt;
  }
  flame.smokes = flame.smokes.filter((p) => p.age < p.life);

  for (const p of flame.drops) {
    p.age += dt;
    p.vy += 280 * dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    if (p.y > base && p.vy > 0) {
      spawnSteam(flame, p.x, base);
      p.age = p.life;
    }
  }
  flame.drops = flame.drops.filter((p) => p.age < p.life);

  for (const p of flame.steams) {
    p.age += dt;
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.r += 16 * dt;
  }
  flame.steams = flame.steams.filter((p) => p.age < p.life);
}

function spawnSteam(flame, x, y) {
  for (let i = 0; i < 3; i += 1) {
    flame.steams.push({
      x: x + (Math.random() - 0.5) * 10,
      y: y - Math.random() * 6,
      vx: (Math.random() - 0.5) * 18,
      vy: -20 - Math.random() * 30,
      r: 4 + Math.random() * 6,
      life: 0.45 + Math.random() * 0.45,
      age: 0,
    });
  }
}

function draw(flame) {
  const { ctx, w, h } = flame;
  ctx.clearRect(0, 0, w, h);
  drawSmoke(ctx, flame.smokes);
  drawLogs(ctx, w, h, flame.time);
  drawFlameBody(ctx, w, h, flame.time, Math.max(0, flame.level));
  drawSparks(ctx, flame.sparks);
  if (flame.splash > 0) drawWater(ctx, w, h, flame);
  flame.dirty = flame.splash > 0 || flame.levelTarget !== flame.level || !prefersReducedMotion();
  if (prefersReducedMotion() && Math.abs(flame.level - flame.levelTarget) < 0.01 && flame.splash <= 0) {
    flame.dirty = false;
  }
}

function drawSmoke(ctx, smokes) {
  for (const p of smokes) {
    const t = p.age / p.life;
    ctx.beginPath();
    ctx.fillStyle = `rgba(92, 84, 78, ${0.16 * (1 - t)})`;
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawLogs(ctx, w, h, time) {
  const y = h * 0.8;
  const cx = w * 0.5;
  const flicker = 0.85 + 0.15 * Math.sin(time * 6);
  ctx.save();
  roundedLog(ctx, cx - w * 0.16, y - 2, w * 0.42, 11, -0.42, '#3a2416');
  roundedLog(ctx, cx - w * 0.02, y + 1, w * 0.4, 10, 0.38, '#24160f');
  ctx.fillStyle = `rgba(255, 150, 50, ${0.35 * flicker})`;
  ctx.beginPath();
  ctx.ellipse(cx, y + 1, 14, 5, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function roundedLog(ctx, x, y, length, thick, angle, color) {
  ctx.save();
  ctx.translate(x, y);
  ctx.rotate(angle);
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(-length / 2, -thick / 2, length, thick, thick);
  ctx.fill();
  ctx.fillStyle = 'rgba(255,255,255,0.08)';
  ctx.fillRect(-length / 2 + 3, -thick / 2 + 1, length - 6, 2);
  ctx.restore();
}

function drawFlameBody(ctx, w, h, time, k) {
  if (k < 0.03) return;
  const cx = w * 0.5;
  const base = h * 0.78;
  const height = h * 0.6 * (0.22 + 0.78 * k);
  const width = w * 0.2 * (0.45 + 0.55 * k);
  const sway = Math.sin(time * 2.4) * width * 0.35;

  ctx.save();
  const glow = ctx.createRadialGradient(cx, base - height * 0.35, 4, cx, base - height * 0.2, height * 0.85);
  glow.addColorStop(0, `rgba(255, 214, 120, ${0.45 * k})`);
  glow.addColorStop(0.45, `rgba(255, 120, 30, ${0.18 * k})`);
  glow.addColorStop(1, 'rgba(255, 80, 0, 0)');
  ctx.fillStyle = glow;
  ctx.beginPath();
  ctx.ellipse(cx + sway * 0.2, base - height * 0.32, width * 1.7, height * 0.62, 0, 0, Math.PI * 2);
  ctx.fill();

  const tongues = [
    { ph: 0.2, lean: 0, hm: 1, wm: 1, hot: 0.15 },
    { ph: 1.7, lean: -0.55, hm: 0.86, wm: 0.72, hot: 0.35 },
    { ph: 2.8, lean: 0.6, hm: 0.74, wm: 0.62, hot: 0.5 },
    { ph: 4.1, lean: -0.15, hm: 0.58, wm: 0.4, hot: 0.8 },
  ];

  tongues.forEach((tongue, index) => {
    const s = Math.sin(time * (2.6 + index * 0.35) + tongue.ph);
    const s2 = Math.sin(time * (4.4 + index * 0.2) + tongue.ph * 1.4);
    const th = height * tongue.hm * (0.9 + 0.1 * s2);
    const tw = width * tongue.wm * (0.92 + 0.08 * s);
    const tipX = cx + sway * 0.8 + tongue.lean * width + s * tw * 0.45;
    const grad = ctx.createLinearGradient(tipX, base - th, cx, base + 4);
    if (tongue.hot > 0.7) {
      grad.addColorStop(0, 'rgba(255, 255, 236, 0.05)');
      grad.addColorStop(0.18, 'rgba(255, 248, 210, 0.95)');
      grad.addColorStop(0.48, 'rgba(255, 196, 70, 0.95)');
      grad.addColorStop(1, 'rgba(255, 120, 20, 0)');
    } else if (tongue.hot > 0.3) {
      grad.addColorStop(0, 'rgba(255, 236, 170, 0)');
      grad.addColorStop(0.2, 'rgba(255, 176, 48, 0.95)');
      grad.addColorStop(0.62, 'rgba(240, 78, 16, 0.9)');
      grad.addColorStop(1, 'rgba(140, 24, 0, 0)');
    } else {
      grad.addColorStop(0, 'rgba(255, 190, 80, 0)');
      grad.addColorStop(0.22, 'rgba(255, 122, 28, 0.9)');
      grad.addColorStop(0.7, 'rgba(176, 32, 8, 0.72)');
      grad.addColorStop(1, 'rgba(90, 12, 0, 0)');
    }
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - tw * 0.95, base);
    ctx.bezierCurveTo(
      cx - tw * 1.25, base - th * 0.28,
      tipX - tw * 0.18, base - th * 0.62,
      tipX, base - th,
    );
    ctx.bezierCurveTo(
      tipX + tw * 0.2, base - th * 0.58,
      cx + tw * 1.15, base - th * 0.26,
      cx + tw * 0.9, base,
    );
    ctx.closePath();
    ctx.fill();
  });

  const coreH = height * 0.42 * (0.92 + 0.08 * Math.sin(time * 7.5));
  const core = ctx.createRadialGradient(cx, base - 6, 2, cx, base - coreH * 0.3, coreH);
  core.addColorStop(0, 'rgba(255,255,245,0.95)');
  core.addColorStop(0.4, `rgba(255, 210, 90, ${0.75 * k})`);
  core.addColorStop(1, 'rgba(255, 140, 20, 0)');
  ctx.fillStyle = core;
  ctx.beginPath();
  ctx.ellipse(cx + sway * 0.15, base - coreH * 0.28, width * 0.32, coreH * 0.48, 0, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(120, 180, 255, ${0.18 * k})`;
  ctx.beginPath();
  ctx.ellipse(cx, base - 2, width * 0.28, 7, 0, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawSparks(ctx, sparks) {
  for (const p of sparks) {
    const t = 1 - p.age / p.life;
    ctx.beginPath();
    ctx.fillStyle = `rgba(255, ${200 + Math.floor(40 * t)}, 140, ${t})`;
    ctx.arc(p.x, p.y, p.r * t, 0, Math.PI * 2);
    ctx.fill();
  }
}

function drawWater(ctx, w, h, flame) {
  const base = h * 0.8;
  const cx = w * 0.5;
  const s = flame.splash;
  if (s > 0.45) {
    ctx.save();
    ctx.globalAlpha = (s - 0.45) * 1.3;
    const grad = ctx.createLinearGradient(cx, h * 0.05, cx, base);
    grad.addColorStop(0, 'rgba(232, 246, 255, 0)');
    grad.addColorStop(0.2, 'rgba(186, 224, 255, 0.15)');
    grad.addColorStop(0.7, 'rgba(120, 190, 230, 0.45)');
    grad.addColorStop(1, 'rgba(80, 160, 210, 0.05)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.moveTo(cx - 10, h * 0.02);
    ctx.bezierCurveTo(cx - 22, h * 0.3, cx + 6, h * 0.5, cx - 4, base);
    ctx.bezierCurveTo(cx + 16, h * 0.55, cx + 18, h * 0.25, cx + 8, h * 0.02);
    ctx.fill();
    ctx.restore();
  }

  for (const p of flame.drops) {
    const t = 1 - p.age / p.life;
    ctx.beginPath();
    ctx.fillStyle = `rgba(210, 236, 255, ${0.85 * t})`;
    ctx.ellipse(p.x, p.y, p.r * 0.72, p.r * 1.35, 0, 0, Math.PI * 2);
    ctx.fill();
  }
  for (const p of flame.steams) {
    const t = p.age / p.life;
    ctx.beginPath();
    ctx.fillStyle = `rgba(245, 248, 250, ${0.45 * (1 - t)})`;
    ctx.arc(p.x, p.y, p.r, 0, Math.PI * 2);
    ctx.fill();
  }
  if (s > 0) {
    ctx.beginPath();
    ctx.strokeStyle = `rgba(200, 230, 255, ${0.45 * s})`;
    ctx.lineWidth = 2;
    ctx.ellipse(cx, base + 2, 18 + (1 - s) * 36, 7 + (1 - s) * 8, 0, 0, Math.PI * 2);
    ctx.stroke();
  }
}

export function pokeFlames() {
  for (const flame of flames) {
    flame.resize();
    flame.dirty = true;
  }
  ensureLoop();
}

reducedQuery.addEventListener?.('change', () => {
  pokeFlames();
});
