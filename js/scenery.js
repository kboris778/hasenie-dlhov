/** Illustrated dusk meadow: sky is CSS, these layers are generated SVG. */

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a |= 0;
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

export function mountScenery(root) {
  root.querySelector('#hills').innerHTML = hillsSvg();
  root.querySelector('#forest').innerHTML = forestSvg();
  root.querySelector('#ground').innerHTML = groundSvg();
  root.querySelector('#foreground').innerHTML = foregroundSvg();
}

function hillsSvg() {
  return `
    <svg class="fill" viewBox="0 0 1200 360" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="hillMist" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#b7c6c6"/>
          <stop offset="1" stop-color="#8ea59a"/>
        </linearGradient>
        <linearGradient id="hillMid" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#7e9b8b"/>
          <stop offset="1" stop-color="#5d7c6c"/>
        </linearGradient>
      </defs>
      <path fill="url(#hillMist)" d="M0 210 C 140 150 220 176 340 150 C 480 118 560 168 700 142 C 860 112 980 160 1200 130 L1200 360 L0 360 Z"/>
      <path fill="url(#hillMid)" opacity="0.95" d="M0 250 C 160 200 280 236 430 210 C 600 180 760 230 920 196 C 1040 176 1120 210 1200 188 L1200 360 L0 360 Z"/>
    </svg>`;
}

function forestSvg() {
  return `
    <svg class="fill" viewBox="0 0 1200 460" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <path fill="#9aada8" d="M0 280 C 160 230 240 250 380 214 C 540 172 640 220 820 190 C 980 164 1080 210 1200 188 L1200 460 L0 460 Z"/>
      ${canopy(250, '#5f7f78', 78, 46)}
      ${canopy(292, '#2a4a3c', 64, 52)}
      ${pine(180, 360, 150, '#1d3d2e', '#3d6844', '#24180f')}
      ${pine(430, 368, 190, '#163528', '#3a6240', '#24180f')}
      ${pine(760, 364, 170, '#1a3a2c', '#3f6b48', '#24180f')}
      ${pine(1040, 370, 150, '#143022', '#345c3c', '#24180f')}
      ${canopy(330, '#173428', 70, 40)}
      <path fill="#10261c" d="M0 390 C 180 360 320 378 500 352 C 700 324 860 360 1200 340 L1200 460 L0 460 Z"/>
    </svg>`;
}

function canopy(base, color, step, rx) {
  let shapes = '';
  for (let x = -30; x <= 1240; x += step) {
    const ry = rx * (0.72 + ((x * 13) % 17) / 40);
    shapes += `<ellipse cx="${x}" cy="${base}" rx="${rx}" ry="${ry.toFixed(1)}" fill="${color}"/>`;
  }
  shapes += `<rect x="0" y="${base - 4}" width="1200" height="${460 - base + 4}" fill="${color}"/>`;
  return shapes;
}

function pine(x, ground, h, leaf, sun, trunk) {
  const w = h * 0.46;
  let out = `<rect x="${x - h * 0.025}" y="${ground - h * 0.16}" width="${h * 0.05}" height="${h * 0.18}" fill="${trunk}"/>`;
  for (let i = 0; i < 3; i += 1) {
    const yy = ground - h * (0.18 + i * 0.2);
    const ww = w * (1 - i * 0.22);
    const tip = yy - h * (0.34 - i * 0.02);
    const color = i === 2 ? sun : leaf;
    out += `<polygon points="${x},${tip} ${x - ww},${yy} ${x + ww * 0.92},${yy}" fill="${color}"/>`;
  }
  return out;
}

function groundSvg() {
  const rng = mulberry32(7);
  const grass = [];
  for (let i = 0; i < 220; i += 1) {
    const x = rng() * 1200;
    const y = 150 + rng() * 620;
    const depth = (y - 150) / 620;
    const h = (6 + depth * 22) * (0.6 + rng());
    const lean = (rng() - 0.4) * (4 + depth * 8);
    const colors = ['#2f6d30', '#3e8a38', '#67a84a', '#245c2c'];
    const color = colors[Math.floor(rng() * colors.length)];
    grass.push(blade(x, y, h, lean, color, 0.7 + depth * 0.8));
  }
  const specks = [];
  for (let i = 0; i < 110; i += 1) {
    const x = rng() * 1200;
    const y = 160 + rng() * 280;
    const palette = ['#f4e27a', '#f7f3ea', '#d4566a', '#6d8ed6'];
    specks.push(`<circle cx="${x.toFixed(1)}" cy="${y.toFixed(1)}" r="${(1 + rng() * 1.6).toFixed(2)}" fill="${palette[i % 4]}" opacity="0.85"/>`);
  }
  return `
    <svg class="fill" viewBox="0 0 1200 820" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      <defs>
        <linearGradient id="meadowFill" x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stop-color="#d5e2a0"/>
          <stop offset="0.16" stop-color="#a9cb6b"/>
          <stop offset="0.42" stop-color="#67a845"/>
          <stop offset="1" stop-color="#2f7a34"/>
        </linearGradient>
        <radialGradient id="sunPatch" cx="0.22" cy="0.55" r="0.55">
          <stop offset="0" stop-color="#e7f3a4" stop-opacity="0.55"/>
          <stop offset="1" stop-color="#e7f3a4" stop-opacity="0"/>
        </radialGradient>
      </defs>
      <path fill="url(#meadowFill)" d="M0 120 C 180 70 280 130 460 96 C 680 54 820 120 1200 80 L1200 820 L0 820 Z"/>
      <path fill="#12331d" opacity="0.18" d="M0 128 C 200 86 320 140 520 108 C 760 70 940 130 1200 96 L1200 168 C 900 150 700 120 480 150 C 260 180 140 140 0 170 Z"/>
      <ellipse cx="280" cy="460" rx="340" ry="180" fill="url(#sunPatch)"/>
      <path d="M430 820 C 470 620 500 420 560 150 L 640 150 C 690 430 760 640 860 820 Z" fill="#e4efb0" opacity="0.28"/>
      ${grass.join('')}
      ${specks.join('')}
    </svg>`;
}

function foregroundSvg() {
  const rng = mulberry32(99);
  const parts = [];
  for (let i = 0; i < 90; i += 1) {
    const x = rng() * 1200;
    const y = 150 + rng() * 70;
    const h = 28 + rng() * 48;
    const lean = (rng() - 0.35) * 16;
    parts.push(blade(x, y, h, lean, rng() > 0.5 ? '#1f5c28' : '#3d8a34', 1.4 + rng()));
  }
  const flowers = [
    [120, 150, 'daisy', 7],
    [210, 168, 'poppy', 6],
    [300, 142, 'butter', 6],
    [460, 172, 'daisy', 8],
    [640, 156, 'corn', 6],
    [760, 176, 'poppy', 7],
    [880, 148, 'daisy', 7],
    [1020, 170, 'butter', 6],
    [540, 188, 'corn', 5],
    [160, 188, 'poppy', 5],
  ];
  for (const [x, y, kind, s] of flowers) {
    parts.push(flower(x + rng() * 20, y, kind, s));
  }
  return `
    <svg class="fill" viewBox="0 0 1200 220" preserveAspectRatio="xMidYMax slice" aria-hidden="true">
      ${parts.join('')}
    </svg>`;
}

function blade(x, y, h, lean, color, width) {
  const x2 = x + lean;
  const xm = x + lean * 0.35;
  return `<path d="M ${x.toFixed(1)} ${y.toFixed(1)} Q ${xm.toFixed(1)} ${(y - h).toFixed(1)} ${x2.toFixed(1)} ${(y - h * 0.92).toFixed(1)}" stroke="${color}" stroke-width="${width.toFixed(2)}" fill="none" stroke-linecap="round"/>`;
}

function flower(x, y, kind, s) {
  if (kind === 'daisy') {
    let petals = '';
    for (let i = 0; i < 8; i += 1) {
      const a = (i / 8) * Math.PI * 2;
      const px = x + Math.cos(a) * s * 0.9;
      const py = y + Math.sin(a) * s * 0.55;
      petals += `<ellipse cx="${px.toFixed(1)}" cy="${py.toFixed(1)}" rx="${(s * 0.48).toFixed(1)}" ry="${(s * 0.22).toFixed(1)}" fill="#fffaf3" transform="rotate(${((a * 180) / Math.PI).toFixed(1)} ${px.toFixed(1)} ${py.toFixed(1)})"/>`;
    }
    return `<g>${petals}<circle cx="${x}" cy="${y}" r="${s * 0.32}" fill="#f0c14b"/></g>`;
  }
  if (kind === 'poppy') {
    return `<g><circle cx="${x}" cy="${y}" r="${s}" fill="#d64545"/><circle cx="${x}" cy="${y}" r="${s * 0.28}" fill="#2a140c"/></g>`;
  }
  if (kind === 'corn') {
    return `<g><circle cx="${x}" cy="${y}" r="${s * 0.9}" fill="#4d6ec4"/><circle cx="${x}" cy="${y}" r="${s * 0.28}" fill="#dfe6fb"/></g>`;
  }
  return `<g><circle cx="${x}" cy="${y}" r="${s}" fill="#f2c84a"/><circle cx="${x - s * 0.2}" cy="${y - s * 0.2}" r="${s * 0.25}" fill="#fff3c4" opacity="0.8"/></g>`;
}
