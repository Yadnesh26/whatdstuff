import * as THREE from 'three';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';

// "How the Solar System Works" — the third subject in this library with no
// parts to machine. Every orbit here is solved rather than drawn: the planets
// ride real Kepler ellipses with the Sun at a focus, positioned each frame by
// solving Kepler's equation, so the perihelion speed-up you can see is the
// actual physics and not an eased tween.
//
// Reference facts (NASA planetary fact sheet; Wikipedia "List of
// gravitationally rounded objects of the Solar System", "Solar System",
// "Barycenter"; Bad Astronomy / Universe Today on the "vortex" model):
//   planet    a(AU)   period    e       incl    tilt     v(km/s)
//   Mercury   0.387   88 d      0.206   7.00°   0.03°    47.9
//   Venus     0.723   225 d     0.007   3.39°   177.4°   35.0
//   Earth     1.000   365.3 d   0.017   0.00°   23.44°   29.8
//   Mars      1.524   1.88 y    0.093   1.85°   25.19°   24.1
//   Jupiter   5.203   11.86 y   0.048   1.31°   3.13°    13.1
//   Saturn    9.537   29.45 y   0.054   2.48°   26.73°    9.7
//   Uranus    19.19   84.0 y    0.047   0.76°   97.77°    6.8
//   Neptune   30.07   164.8 y   0.009   1.77°   28.32°    5.4
//  - The Sun is 99.86% of the mass of the whole system. Jupiter is about
//    two-thirds of everything left over.
//  - Because of that, the Sun does not sit still: the Sun-Jupiter barycentre
//    is 742,370 km from the Sun's centre — 1.07 solar radii, so ~46,000 km
//    ABOVE the visible surface. Counting all four giants it reaches ~1.17
//    solar radii. Jupiter swings the Sun at about 12.5 m/s; Earth manages
//    0.09 m/s. That reflex wobble is how most exoplanets were found.
//  - The whole system orbits the galaxy at 230 km/s (720,000 km/h), one lap
//    per ~230 million years, from ~26,000 light years out. The orbital plane
//    is tipped about 60° to the plane of the galaxy — NOT 90°, which is the
//    error at the heart of the viral "vortex / helical solar system" video.
//  - Kepler: (1) orbits are ellipses with the Sun at one focus; (2) a planet
//    sweeps equal areas in equal times, so Mercury runs 58.98 km/s at
//    perihelion (46.0 Mkm) and 38.86 km/s at aphelion (69.8 Mkm); (3) T² ∝ a³.
//  - Starting mean anomalies below are the real J2000 values, so the opening
//    frame is a genuine snapshot of where the planets were on 1 Jan 2000.
//
// THREE DISCLOSED DISTORTIONS. A true-scale solar system cannot be drawn —
// at Neptune's orbit the Sun is a third of a pixel — so each compression is
// stated in the step copy rather than hidden:
//  1. DISTANCE is compressed as r = 0.90 * a^0.38. Order and the big gaps
//     survive; the ratios do not. Neptune is really 78x further out than
//     Mercury, and 5.2x further out here.
//  2. SIZE is compressed as the square root of the radius, and the Sun is
//     hand-set smaller still.
//     Drawn at the planets' own scale the Sun would be wider than Mercury's
//     whole orbit on this page.
//  3. SPEED. Real angular rates span 685:1 (Mercury against Neptune) — draw
//     that honestly and the outer half of the system is a still image. So the
//     model applies Kepler's third law to the COMPRESSED radii instead
//     (rate ∝ r_world^-1.5), which lands on a 12:1 spread. The ordering and
//     the lapping are true; the ratio is squeezed, and step 6 says so.

// ---------------------------------------------------------------------------
// scale maps — every distance in the scene comes out of these two functions
// ---------------------------------------------------------------------------
const orbitR = (aAU) => 0.9 * Math.pow(aAU, 0.38);
const bodyR = (rEarth) => 0.042 * Math.sqrt(rEarth);

const SUN_R = 0.28;
const CENTER_Y = 2.25;
const ACCENT = 0xffb454;

// The Sun's barycentric orbit, drawn at 1.07 solar radii — correct against the
// SUN, which is the memorable version of the fact. Against Jupiter's orbit the
// real offset is 1/1000th of this; step 8 says so out loud.
const SUN_OFFSET = SUN_R * 1.07;

// Belt: the real main belt runs 2.2-3.2 AU, which lands here at 1.13-1.30.
const BELT_IN = orbitR(2.2);
const BELT_OUT = orbitR(3.2);
const BELT_N = 520;

// Galactic flight. The direction of the Sun's travel sits ~60° out of the
// orbital plane (the galactic pole is 60° from the ecliptic pole) — the whole
// point of step 9, and the thing the "vortex" animation draws at 90°.
const FLIGHT_TILT = (60 * Math.PI) / 180;
const FLIGHT_DIR = new THREE.Vector3(
  Math.cos(FLIGHT_TILT),
  Math.sin(FLIGHT_TILT),
  0,
).normalize();
const TRAIL_N = 150;
const TRAIL_TIME = 0.10; // lap fractions of history held in the trail
const TRAIL_LEN = 5.0; // world units that history spans

// ---------------------------------------------------------------------------
// the planets. `turns` = whole revolutions per lap (the seamless-loop
// contract), from rate ∝ r_world^-1.5 normalised to Neptune = 2. `slowTurns`
// is the same list scaled to Earth = 3, for the steps whose subject is a
// number on a pill rather than a speed — at the fast tempo Mercury crosses
// the frame 24 times a lap and nothing is readable.
//
// `spin` is turns of the body per lap: scaled for legibility, but the SIGNS
// are real — Venus and Uranus turn backwards.
// ---------------------------------------------------------------------------
const PLANETS = [
  {
    key: 'mercury',
    name: 'Mercury',
    a: 0.387,
    e: 0.2056,
    inc: 7.0,
    node: 48.3,
    peri: 29.1,
    m0: 174.8,
    rEarth: 0.3826,
    tilt: 0.03,
    turns: 24,
    slowTurns: 5,
    spin: 3,
    period: '88 days',
    au: '0.39', // short form for the callout pill
    spec: '88 d',
    speed: '47.9 km/s',
    kind: 'rock',
    tex: {
      seed: 11,
      colA: [0x8d, 0x86, 0x7b],
      colB: [0x56, 0x51, 0x4b],
      craters: 130,
      roughness: 0.95,
    },
  },
  {
    key: 'venus',
    name: 'Venus',
    a: 0.723,
    e: 0.0068,
    inc: 3.39,
    node: 76.7,
    peri: 54.9,
    m0: 50.4,
    rEarth: 0.9488,
    tilt: 177.4,
    turns: 17,
    slowTurns: 4,
    spin: -1,
    period: '225 days',
    au: '0.72', // short form for the callout pill
    spec: '225 d',
    speed: '35.0 km/s',
    kind: 'gas',
    tex: {
      seed: 23,
      colA: [0xe8, 0xd2, 0x9c],
      colB: [0xbe, 0x99, 0x60],
      bands: 7,
      swirl: 1.1,
      roughness: 0.9,
    },
  },
  {
    key: 'earth',
    name: 'Earth',
    a: 1.0,
    e: 0.0167,
    inc: 0.0,
    node: 0,
    peri: 102.9,
    m0: 357.5,
    rEarth: 1.0,
    tilt: 23.44,
    turns: 14,
    slowTurns: 3,
    spin: 12,
    period: '365.3 days',
    au: '1', // short form for the callout pill
    spec: '365 d',
    speed: '29.8 km/s',
    kind: 'earth',
    tex: { seed: 7, roughness: 0.72 },
    air: 0x6fb0ff,
  },
  {
    key: 'mars',
    name: 'Mars',
    a: 1.524,
    e: 0.0934,
    inc: 1.85,
    node: 49.6,
    peri: 286.5,
    m0: 19.4,
    rEarth: 0.532,
    tilt: 25.19,
    turns: 11,
    slowTurns: 2,
    spin: 11,
    period: '1.88 years',
    au: '1.52', // short form for the callout pill
    spec: '687 d',
    speed: '24.1 km/s',
    kind: 'rock',
    tex: {
      seed: 31,
      colA: [0xc2, 0x6b, 0x3e],
      colB: [0x82, 0x42, 0x28],
      craters: 55,
      caps: 0.1,
      roughness: 0.95,
    },
  },
  {
    key: 'jupiter',
    name: 'Jupiter',
    a: 5.203,
    e: 0.0484,
    inc: 1.31,
    node: 100.5,
    peri: 274.3,
    m0: 20.0,
    rEarth: 11.21,
    tilt: 3.13,
    turns: 5,
    slowTurns: 1,
    spin: 30,
    period: '11.9 years',
    au: '5.2', // short form for the callout pill
    spec: '11.9 yr',
    speed: '13.1 km/s',
    kind: 'gas',
    tex: {
      seed: 41,
      colA: [0xe4, 0xcd, 0xac],
      colB: [0xa8, 0x76, 0x4e],
      bands: 13,
      swirl: 2.4,
      spot: { u: 0.32, v: 0.63, rx: 0.055, ry: 0.028, col: [0xbb, 0x5c, 0x3c] },
      roughness: 0.9,
    },
  },
  {
    key: 'saturn',
    name: 'Saturn',
    a: 9.537,
    e: 0.0539,
    inc: 2.48,
    node: 113.7,
    peri: 338.7,
    m0: 317.0,
    rEarth: 9.449,
    tilt: 26.73,
    turns: 4,
    slowTurns: 1,
    spin: 28,
    period: '29.4 years',
    au: '9.5', // short form for the callout pill
    spec: '29.4 yr',
    speed: '9.7 km/s',
    kind: 'gas',
    rings: true,
    tex: {
      seed: 53,
      colA: [0xe9, 0xd7, 0xab],
      colB: [0xc0, 0xa4, 0x74],
      bands: 9,
      swirl: 1.3,
      roughness: 0.9,
    },
  },
  {
    key: 'uranus',
    name: 'Uranus',
    a: 19.19,
    e: 0.0472,
    inc: 0.76,
    node: 74.0,
    peri: 96.5,
    m0: 142.2,
    rEarth: 4.007,
    tilt: 97.77,
    turns: 3,
    slowTurns: 1,
    spin: -18,
    period: '84 years',
    au: '19.2', // short form for the callout pill
    spec: '84 yr',
    speed: '6.8 km/s',
    kind: 'gas',
    tex: {
      seed: 67,
      colA: [0xa6, 0xdf, 0xe4],
      colB: [0x79, 0xc0, 0xcd],
      bands: 4,
      swirl: 0.45,
      roughness: 0.85,
    },
  },
  {
    key: 'neptune',
    name: 'Neptune',
    a: 30.07,
    e: 0.0086,
    inc: 1.77,
    node: 131.8,
    peri: 273.2,
    m0: 259.9,
    rEarth: 3.883,
    tilt: 28.32,
    turns: 2,
    slowTurns: 1,
    spin: 20,
    period: '164.8 years',
    au: '30.1', // short form for the callout pill
    spec: '165 yr',
    speed: '5.4 km/s',
    kind: 'gas',
    tex: {
      seed: 79,
      colA: [0x4d, 0x7f, 0xd8],
      colB: [0x2b, 0x51, 0xa4],
      bands: 6,
      swirl: 0.8,
      spot: { u: 0.6, v: 0.62, rx: 0.045, ry: 0.024, col: [0x1b, 0x30, 0x6e] },
      roughness: 0.85,
    },
  },
];

// ---------------------------------------------------------------------------
// deterministic procedural texturing — the review screenshots have to be
// byte-identical run to run, so nothing here touches Math.random
// ---------------------------------------------------------------------------
function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1274126177);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// Value noise that WRAPS in x with period `px` — a sphere map whose seam
// doesn't line up is the one texture flaw you cannot miss on a rotating body.
function vnoise(x, y, px, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const h = (i, j) => hash2(((i % px) + px) % px, j, seed);
  const a = h(x0, y0);
  const b = h(x0 + 1, y0);
  const c = h(x0, y0 + 1);
  const d = h(x0 + 1, y0 + 1);
  const top = a + (b - a) * sx;
  const bot = c + (d - c) * sx;
  return top + (bot - top) * sy;
}

function fbm(x, y, px, seed, oct = 4) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise(x * f, y * f, px * f, seed + i * 101);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finishTexture(canvas) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// Banded atmosphere: latitude bands warped by wrapping noise, which is what
// turns a set of stripes into weather. `swirl` is how hard the bands shear.
function gasTexture(cfg) {
  const W = 768;
  const H = 384;
  const canvas = makeCanvas(W, H);
  const img = canvas.getContext('2d').createImageData(W, H);
  const d = img.data;
  const [ar, ag, ab] = cfg.colA;
  const [br, bg, bb] = cfg.colB;
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const warp = (fbm(u * 8, v * 5, 8, cfg.seed, 4) - 0.5) * cfg.swirl * 0.08;
      const band = 0.5 + 0.5 * Math.sin((v + warp) * Math.PI * cfg.bands * 2);
      const grain = fbm(u * 26, v * 14, 26, cfg.seed + 7, 4) - 0.5;
      let t = clamp01(band * 0.82 + grain * 0.4 + 0.09);
      // poles darken slightly on every gas giant
      t = clamp01(t + Math.pow(Math.abs(v - 0.5) * 2, 3) * 0.28);
      let r = ar + (br - ar) * t;
      let g = ag + (bg - ag) * t;
      let b = ab + (bb - ab) * t;
      if (cfg.spot) {
        const du = Math.abs(u - cfg.spot.u);
        const dv = v - cfg.spot.v;
        const q = Math.hypot(Math.min(du, 1 - du) / cfg.spot.rx, dv / cfg.spot.ry);
        const k = smooth(1 - q) * 0.9;
        r += (cfg.spot.col[0] - r) * k;
        g += (cfg.spot.col[1] - g) * k;
        b += (cfg.spot.col[2] - b) * k;
      }
      const o = (y * W + x) * 4;
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = 255;
    }
  }
  canvas.getContext('2d').putImageData(img, 0, 0);
  return finishTexture(canvas);
}

// Cratered rock. Craters are drawn after the base so their rims read as relief
// under the Sun's single light rather than as flat spots.
function rockTexture(cfg) {
  const W = 768;
  const H = 384;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  const [ar, ag, ab] = cfg.colA;
  const [br, bg, bb] = cfg.colB;
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const t = clamp01(fbm(u * 9, v * 6, 9, cfg.seed, 5) * 1.5 - 0.25);
      const o = (y * W + x) * 4;
      let r = ar + (br - ar) * t;
      let g = ag + (bg - ag) * t;
      let b = ab + (bb - ab) * t;
      if (cfg.caps) {
        const pole = clamp01((Math.abs(v - 0.5) * 2 - (1 - cfg.caps * 2)) / (cfg.caps * 2));
        const k = smooth(pole) * 0.85;
        r += (238 - r) * k;
        g += (243 - g) * k;
        b += (248 - b) * k;
      }
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < (cfg.craters ?? 0); i++) {
    const cx = hash2(i, 3, cfg.seed) * W;
    const cy = (0.12 + 0.76 * hash2(i, 5, cfg.seed + 3)) * H;
    const rad = (2 + 16 * Math.pow(hash2(i, 9, cfg.seed + 5), 3)) * (W / 768);
    const g = ctx.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad);
    g.addColorStop(0, 'rgba(0,0,0,0.30)');
    g.addColorStop(0.72, 'rgba(0,0,0,0.10)');
    g.addColorStop(0.88, 'rgba(255,255,255,0.16)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, TAU);
    ctx.fill();
  }
  return finishTexture(canvas);
}

// The one planet everybody can grade at a glance, so it gets its own pass:
// ocean, continent, desert, ice, and a thin cloud layer painted on top.
function earthTexture(cfg) {
  const W = 1024;
  const H = 512;
  const canvas = makeCanvas(W, H);
  const img = canvas.getContext('2d').createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const lat = Math.abs(v - 0.5) * 2;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const land = fbm(u * 7, v * 5, 7, cfg.seed, 5);
      const detail = fbm(u * 24, v * 16, 24, cfg.seed + 13, 4);
      let r;
      let g;
      let b;
      if (land > 0.52) {
        const dry = clamp01((detail - 0.4) * 2.4) * clamp01(1.5 - lat * 3.2);
        const green = [0x33, 0x6b, 0x3c];
        const sand = [0xb9, 0x9d, 0x67];
        r = green[0] + (sand[0] - green[0]) * dry;
        g = green[1] + (sand[1] - green[1]) * dry;
        b = green[2] + (sand[2] - green[2]) * dry;
        const shelf = clamp01((land - 0.52) * 9);
        r *= 0.72 + 0.28 * shelf;
        g *= 0.72 + 0.28 * shelf;
        b *= 0.72 + 0.28 * shelf;
      } else {
        const deep = clamp01((0.52 - land) * 4);
        r = 0x2f - 0x18 * deep;
        g = 0x6d - 0x33 * deep;
        b = 0xa8 - 0x38 * deep;
      }
      const ice = smooth(clamp01((lat - 0.82) / 0.14));
      r += (240 - r) * ice;
      g += (246 - g) * ice;
      b += (252 - b) * ice;
      const cloud = clamp01((fbm(u * 11, v * 7, 11, cfg.seed + 31, 5) - 0.5) * 3.1);
      const k = cloud * 0.62;
      r += (255 - r) * k;
      g += (255 - g) * k;
      b += (255 - b) * k;
      const o = (y * W + x) * 4;
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = 255;
    }
  }
  canvas.getContext('2d').putImageData(img, 0, 0);
  return finishTexture(canvas);
}

// Saturn's rings, as a 1-D radial profile: faint C ring, bright B ring, the
// Cassini division, then A ring — the structure that makes them read as rings
// rather than as a disc.
function ringTexture() {
  const W = 512;
  const canvas = makeCanvas(W, 4);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, 4);
  const d = img.data;
  const bandAt = (t) => {
    // t: 0 at the inner edge, 1 at the outer
    if (t < 0.2) return 0.16 + 0.1 * Math.sin(t * 60); // C ring
    if (t < 0.62) return 0.62 + 0.24 * Math.sin(t * 90); // B ring
    if (t < 0.7) return 0.06; // Cassini division
    if (t < 0.96) return 0.42 + 0.16 * Math.sin(t * 120); // A ring
    return 0.0;
  };
  for (let x = 0; x < W; x++) {
    const t = x / (W - 1);
    const a = clamp01(bandAt(t)) * 255;
    const shade = 0.78 + 0.22 * Math.sin(t * 41);
    for (let y = 0; y < 4; y++) {
      const o = (y * W + x) * 4;
      d[o] = 0xe4 * shade;
      d[o + 1] = 0xd6 * shade;
      d[o + 2] = 0xb6 * shade;
      d[o + 3] = a;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// Solar granulation. Kept deliberately low-contrast: the material colour is
// already above 1.0 so it can pass the bloom threshold, and a high-contrast
// map on top of that clips to flat white.
// Granulation, sampled in 3D. A 2-D equirect noise converges at the poles and
// drew a visible starburst on the Sun's face in every top-down step; sampling
// the noise along the surface DIRECTION instead is isotropic everywhere and
// has no seam to hide.
function vnoise3(x, y, z, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const fx = x - x0;
  const fy = y - y0;
  const fz = z - z0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const sz = fz * fz * (3 - 2 * fz);
  const h = (i, j, k) => hash2(i + k * 3121, j, seed + k * 977);
  const lerp = (a, b, t) => a + (b - a) * t;
  const c00 = lerp(h(x0, y0, z0), h(x0 + 1, y0, z0), sx);
  const c10 = lerp(h(x0, y0 + 1, z0), h(x0 + 1, y0 + 1, z0), sx);
  const c01 = lerp(h(x0, y0, z0 + 1), h(x0 + 1, y0, z0 + 1), sx);
  const c11 = lerp(h(x0, y0 + 1, z0 + 1), h(x0 + 1, y0 + 1, z0 + 1), sx);
  return lerp(lerp(c00, c10, sy), lerp(c01, c11, sy), sz);
}

function fbm3(x, y, z, seed, oct = 3) {
  let sum = 0;
  let amp = 0.5;
  let f = 1;
  let norm = 0;
  for (let i = 0; i < oct; i++) {
    sum += amp * vnoise3(x * f, y * f, z * f, seed + i * 131);
    norm += amp;
    amp *= 0.5;
    f *= 2;
  }
  return sum / norm;
}

function sunTexture() {
  const W = 768;
  const H = 384;
  const canvas = makeCanvas(W, H);
  const img = canvas.getContext('2d').createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const theta = v * Math.PI;
    const st = Math.sin(theta);
    const ct = Math.cos(theta);
    for (let x = 0; x < W; x++) {
      const phi = (x / W) * TAU;
      const dx = st * Math.cos(phi);
      const dy = ct;
      const dz = st * Math.sin(phi);
      const cell = fbm3(dx * 26, dy * 26, dz * 26, 3, 3);
      const coarse = fbm3(dx * 7, dy * 7, dz * 7, 17, 2);
      const k = 0.76 + 0.26 * cell + 0.14 * (coarse - 0.5);
      // limb darkening — real, and it stops the disc reading as a flat sticker
      const limb = 1 - 0.26 * Math.pow(Math.abs(v - 0.5) * 2, 2);
      const o = (y * W + x) * 4;
      d[o] = 255 * clamp01(k * limb);
      d[o + 1] = 232 * clamp01(k * limb) * 0.98;
      d[o + 2] = 186 * clamp01(k * limb) * 0.92;
      d[o + 3] = 255;
    }
  }
  canvas.getContext('2d').putImageData(img, 0, 0);
  return finishTexture(canvas);
}

function glowTexture() {
  const S = 256;
  const canvas = makeCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  // Written per pixel rather than with canvas gradient stops: four stops on a
  // halo this size banded into visible concentric rings on the close shots.
  // The disc's own edge lands at q ~ 0.55, so most of the energy sits just
  // inside and outside that — a limb glow, not a fog bank over the planets.
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const q = Math.hypot(x / (S - 1) - 0.5, y / (S - 1) - 0.5) * 2;
      const core = Math.exp(-Math.pow(q / 0.30, 2.2)) * 0.42;
      const halo = Math.exp(-Math.pow(q / 0.52, 1.6)) * 0.30;
      const edge = smooth(clamp01((1 - q) / 0.22));
      const o = (y * S + x) * 4;
      d[o] = 255;
      d[o + 1] = 212 - 46 * q;
      d[o + 2] = 160 - 96 * q;
      d[o + 3] = clamp01((core + halo) * edge) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// ---------------------------------------------------------------------------
// the sky. `space: true` strips the studio sweep and the shadow floor, which
// would both be nonsense here; this replaces them with the actual backdrop of
// the subject. The Milky Way band is not decoration — step 9 is about the
// system's angle to it.
// ---------------------------------------------------------------------------
const SKY_VERT = /* glsl */ `
varying vec3 vDir;
void main() {
  vDir = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAG = /* glsl */ `
precision highp float;
varying vec3 vDir;
uniform float uStars;
uniform float uBand;

vec3 hash33(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}

float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = 0.0;
  for (int dx = 0; dx < 2; dx++) {
    for (int dy = 0; dy < 2; dy++) {
      for (int dz = 0; dz < 2; dz++) {
        vec3 o = vec3(float(dx), float(dy), float(dz));
        float h = hash33(i + o).x;
        vec3 w = mix(1.0 - f, f, o);
        n += h * w.x * w.y * w.z;
      }
    }
  }
  return n;
}

vec3 starLayer(vec3 d, float scale, float density, float bright) {
  vec3 q = d * scale;
  vec3 c = floor(q);
  vec3 f = q - c;
  vec3 h = hash33(c + 17.0);
  if (h.x > density) return vec3(0.0);
  vec3 sp = vec3(0.25) + 0.5 * h;
  float dd = length(f - sp);
  float s = smoothstep(0.19, 0.0, dd);
  float mag = pow(fract(h.y * 7.31), 3.0);
  vec3 tint = mix(vec3(0.74, 0.83, 1.00), vec3(1.00, 0.87, 0.68), h.z);
  return tint * s * s * mag * bright;
}

void main() {
  vec3 d = normalize(vDir);
  vec3 col = vec3(0.0035, 0.0045, 0.0090);
  col += starLayer(d, 120.0, 0.050, 2.2);
  col += starLayer(d, 260.0, 0.034, 1.1);
  col += starLayer(d, 540.0, 0.024, 0.5);
  // the galactic plane, 60 degrees off the orbital plane (which is y = 0)
  vec3 bandN = normalize(vec3(-0.866, 0.5, 0.0));
  float b = dot(d, bandN);
  float band = exp(-(b * b) / (2.0 * 0.105 * 0.105));
  float mottle = vnoise3(d * 14.0) * 0.45 + vnoise3(d * 38.0) * 0.35 + vnoise3(d * 90.0) * 0.20;
  col += vec3(0.038, 0.045, 0.074) * band * (0.12 + 0.88 * mottle) * uBand;
  gl_FragColor = vec4(col * uStars, 1.0);
}
`;

// ---------------------------------------------------------------------------
// orbital mechanics
// ---------------------------------------------------------------------------

// Kepler's equation, M = E - e sin E, by Newton. Four iterations is exact to
// float precision for every eccentricity in this system (worst case is
// Mercury's 0.206).
function eccAnomaly(M, e) {
  let E = M + e * Math.sin(M);
  for (let i = 0; i < 4; i++) {
    E -= (E - e * Math.sin(E) - M) / (1 - e * Math.cos(E));
  }
  return E;
}

// Radial free fall, solved rather than faked: r = r0 cos²θ with time
// t ∝ θ + sinθ cosθ. Inverted once into a table so the dropped body in step 2
// accelerates the way a real one does — barely moving, then all at once.
const FALL_TABLE = (() => {
  const N = 256;
  const th = new Float64Array(N + 1);
  const tt = new Float64Array(N + 1);
  for (let i = 0; i <= N; i++) {
    const t = (i / N) * (Math.PI / 2);
    th[i] = t;
    tt[i] = (t + Math.sin(t) * Math.cos(t)) / (Math.PI / 2);
  }
  return (u) => {
    const x = clamp01(u);
    let lo = 1;
    let hi = N;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (tt[m] < x) lo = m + 1;
      else hi = m;
    }
    const span = Math.max(tt[lo] - tt[lo - 1], 1e-9);
    const f = (x - tt[lo - 1]) / span;
    const t = th[lo - 1] + (th[lo] - th[lo - 1]) * f;
    return Math.cos(t) * Math.cos(t);
  };
})();

export function buildSolarSystem({ scene, stage }) {
  const disposables = [];
  const track = (x) => {
    disposables.push(x);
    return x;
  };

  // --- sky (in the scene, NOT under root: the player's hero bob moves root,
  // and a sky that bobs with the subject is not a sky) ---------------------
  const skyUniforms = { uStars: { value: 1 }, uBand: { value: 1 } };
  const skyMat = track(
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
      fog: false,
    }),
  );
  const sky = new THREE.Mesh(track(new THREE.SphereGeometry(60, 32, 20)), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  scene.add(sky);

  const root = new THREE.Group();
  root.position.set(0, CENTER_Y, 0);
  scene.add(root);

  const labels = calloutSets([
    'orbit',
    'inner',
    'outer',
    'ellipse',
    'kepler',
    'disk',
    'wobble',
    'flight',
  ]);

  // -------------------------------------------------------------------------
  // the Sun. Everything about it lives under sunPivot, which is what moves in
  // the barycentre step — including its light, so the terminators on the
  // planets swing with it.
  // -------------------------------------------------------------------------
  const sunPivot = new THREE.Group();
  root.add(sunPivot);

  const sunMap = track(sunTexture());
  const sunMat = track(
    new THREE.MeshBasicMaterial({
      map: sunMap,
      // Above 1.0 on purpose: the stage's bloom threshold is 2.2, and ACES
      // tone-maps this back to a warm yellow rather than to clipped white.
      color: new THREE.Color(2.3, 1.58, 0.74),
      toneMapped: true,
    }),
  );
  const sun = new THREE.Mesh(track(new THREE.SphereGeometry(SUN_R, 64, 48)), sunMat);
  sunPivot.add(sun);

  const glowMap = track(glowTexture());
  const coronaMat = track(
    new THREE.MeshBasicMaterial({
      map: glowMap,
      color: 0xffc067,
      transparent: true,
      opacity: 0.7,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      side: THREE.DoubleSide,
    }),
  );
  // NOT a THREE.Sprite, and this is the one non-obvious thing in the file.
  // GTAOPass renders a depth/normal prepass with scene.overrideMaterial, which
  // throws away a sprite's billboarding — the corona came back as a 2-unit
  // world-space quad lying across the scene, and the AO pass then painted its
  // silhouette solid black over half the solar system. Points and lines are
  // excluded from that prepass; sprites are not. So the halo is a plain quad
  // aimed at the camera by hand in updateAnchors(), which the prepass renders
  // as what it is: a flat surface facing the viewer, i.e. unoccluded.
  const corona = new THREE.Mesh(
    track(new THREE.PlaneGeometry(SUN_R * 4.6, SUN_R * 4.6)),
    coronaMat,
  );
  corona.frustumCulled = false;
  sunPivot.add(corona);

  // The one light in this explainer, and the subject itself: without it every
  // planet is lit from all sides by the studio environment and the day/night
  // terminator — the single most recognisable thing about a lit sphere in
  // space — disappears. decay = 0 rather than the physical inverse square:
  // true falloff leaves Neptune at 1/900th of Earth's illumination, i.e. black.
  const sunLight = new THREE.PointLight(0xfff1d6, 2.1, 0, 0);
  sunPivot.add(sunLight);

  // -------------------------------------------------------------------------
  // orbits + planets. No nested pivot groups: each orbit's plane rotation is
  // baked into one matrix, so the ring geometry, the planet position and the
  // trail history all come out of the same three lines of maths.
  // -------------------------------------------------------------------------
  const deg = (x) => (x * Math.PI) / 180;
  const tmpV = new THREE.Vector3();

  const planets = PLANETS.map((p) => {
    const aW = orbitR(p.a);
    const bW = aW * Math.sqrt(1 - p.e * p.e);
    const rW = bodyR(p.rEarth);

    // node about Y, then inclination about the node line, then the argument
    // of perihelion back about the orbit normal
    const mat = new THREE.Matrix4()
      .makeRotationY(deg(p.node))
      .multiply(new THREE.Matrix4().makeRotationX(deg(p.inc)))
      .multiply(new THREE.Matrix4().makeRotationY(deg(p.peri)));

    // ellipse in the orbit plane, Sun at the focus (origin)
    const at = (E, out) => out.set(aW * (Math.cos(E) - p.e), 0, -bW * Math.sin(E)).applyMatrix4(mat);

    const pts = [];
    for (let i = 0; i < 220; i++) pts.push(at((i / 220) * TAU, new THREE.Vector3()));
    const curve = new THREE.CatmullRomCurve3(pts, true, 'centripetal', 0.5);
    const ringGeo = track(new THREE.TubeGeometry(curve, 300, 0.0032, 5, true));
    // One material per orbit, not one shared by the inner four: a step that
    // shows a single planet has to be able to fade the other seven rings
    // independently, and a shared material means the last one written wins.
    const lineMat = track(
      new THREE.MeshBasicMaterial({
        color: p.a < 3 ? 0x60789e : 0x7d93b8,
        transparent: true,
        opacity: 0.34,
        depthWrite: false,
      }),
    );
    const ring = new THREE.Mesh(ringGeo, lineMat);
    ring.renderOrder = -1;
    root.add(ring);

    const holder = new THREE.Group();
    root.add(holder);
    const tiltGroup = new THREE.Group();
    tiltGroup.rotation.z = deg(p.tilt);
    holder.add(tiltGroup);

    const map = track(
      p.kind === 'earth'
        ? earthTexture(p.tex)
        : p.kind === 'gas'
          ? gasTexture(p.tex)
          : rockTexture(p.tex),
    );
    const bodyMat = track(
      new THREE.MeshStandardMaterial({
        map,
        roughness: p.tex.roughness,
        metalness: 0,
        // The studio environment is a fill light here, nothing more — at full
        // strength it washes the night side out and the terminator goes flat.
        envMapIntensity: 0.14,
      }),
    );
    const body = new THREE.Mesh(track(new THREE.SphereGeometry(rW, 48, 36)), bodyMat);
    tiltGroup.add(body);

    let air = null;
    if (p.air) {
      // Fresnel shell — a rim of atmosphere that brightens toward the limb.
      const airMat = track(
        new THREE.ShaderMaterial({
          uniforms: { uColor: { value: new THREE.Color(p.air) }, uK: { value: 1 } },
          vertexShader: /* glsl */ `
            varying vec3 vN; varying vec3 vV;
            void main() {
              vN = normalize(normalMatrix * normal);
              vec4 mv = modelViewMatrix * vec4(position, 1.0);
              vV = normalize(-mv.xyz);
              gl_Position = projectionMatrix * mv;
            }`,
          fragmentShader: /* glsl */ `
            uniform vec3 uColor; uniform float uK;
            varying vec3 vN; varying vec3 vV;
            void main() {
              float f = pow(1.0 - max(dot(normalize(vN), normalize(vV)), 0.0), 2.6);
              gl_FragColor = vec4(uColor, f * 0.9 * uK);
            }`,
          transparent: true,
          depthWrite: false,
          blending: THREE.AdditiveBlending,
          side: THREE.BackSide,
        }),
      );
      air = new THREE.Mesh(track(new THREE.SphereGeometry(rW * 1.12, 32, 24)), airMat);
      tiltGroup.add(air);
    }

    let rings = null;
    if (p.rings) {
      const inner = rW * 1.35;
      const outer = rW * 2.3;
      const g = track(new THREE.RingGeometry(inner, outer, 190, 6));
      // RingGeometry's default UVs map to a square; remap u to the RADIAL
      // fraction so the 1-D band profile lands where it should.
      const pos = g.attributes.position;
      const uv = g.attributes.uv;
      for (let i = 0; i < pos.count; i++) {
        const rr = Math.hypot(pos.getX(i), pos.getY(i));
        uv.setXY(i, clamp01((rr - inner) / (outer - inner)), 0.5);
      }
      const ringMap = track(ringTexture());
      const ringsMat = track(
        new THREE.MeshBasicMaterial({
          map: ringMap,
          transparent: true,
          side: THREE.DoubleSide,
          depthWrite: false,
        }),
      );
      rings = new THREE.Mesh(g, ringsMat);
      rings.rotation.x = Math.PI / 2;
      tiltGroup.add(rings);
    }

    // Ring points in root-local space, sampled once, for the label anchors:
    // the orbit never rotates, so this list is static for the life of the page.
    const anchorPts = [];
    for (let i = 0; i < 72; i++) anchorPts.push(at((i / 72) * TAU, new THREE.Vector3()));

    return { ...p, aW, bW, rW, mat, at, ring, holder, tiltGroup, body, air, rings, anchorPts };
  });

  const byKey = Object.fromEntries(planets.map((p) => [p.key, p]));

  // -------------------------------------------------------------------------
  // the asteroid belt — real gap, real shear: a rock's turn count comes from
  // the same rate law the planets use, so the inner belt genuinely laps the
  // outer belt over a loop.
  // -------------------------------------------------------------------------
  const rockGeo = track(new THREE.IcosahedronGeometry(1, 0));
  const rockMat = track(
    new THREE.MeshStandardMaterial({
      color: 0x8a8175,
      roughness: 0.95,
      metalness: 0,
      envMapIntensity: 0.14,
    }),
  );
  const belt = new THREE.InstancedMesh(rockGeo, rockMat, BELT_N);
  belt.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  belt.frustumCulled = false;
  root.add(belt);

  const rocks = [];
  for (let i = 0; i < BELT_N; i++) {
    const t = hash2(i, 1, 909);
    // density peaks mid-belt, thins at both edges — as the real belt does
    const r = BELT_IN + (BELT_OUT - BELT_IN) * (0.5 - 0.5 * Math.cos(Math.PI * t));
    const law = 11.8815 * Math.pow(r, -1.5);
    rocks.push({
      r,
      inc: (hash2(i, 2, 909) - 0.5) * deg(20),
      node: hash2(i, 3, 909) * TAU,
      phase: hash2(i, 4, 909),
      turns: Math.max(8, Math.min(10, Math.round(law))),
      slowTurns: 2,
      size: (0.0016 + 0.0042 * Math.pow(hash2(i, 5, 909), 2.2)) * 1.0,
      tumble: 3 + Math.floor(hash2(i, 6, 909) * 4),
      axis: new THREE.Vector3(
        hash2(i, 7, 909) - 0.5,
        hash2(i, 8, 909) - 0.5,
        hash2(i, 9, 909) - 0.5,
      ).normalize(),
    });
  }

  // -------------------------------------------------------------------------
  // step 2 props: the two forces on Earth, and a body dropped with no
  // sideways speed at all
  // -------------------------------------------------------------------------
  function makeArrow(color) {
    const g = new THREE.Group();
    const mat = track(
      new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false }),
    );
    const shaft = new THREE.Mesh(track(new THREE.CylinderGeometry(0.011, 0.011, 1, 12)), mat);
    shaft.position.y = 0.5;
    const head = new THREE.Mesh(track(new THREE.ConeGeometry(0.032, 0.09, 16)), mat);
    head.position.y = 1;
    g.add(shaft, head);
    return { group: g, mat };
  }
  const gravArrow = makeArrow(0xff9a5e);
  const velArrow = makeArrow(0x7fd4ff);
  const arrowRig = new THREE.Group();
  arrowRig.add(gravArrow.group, velArrow.group);
  root.add(arrowRig);

  const fallerMat = track(
    new THREE.MeshStandardMaterial({
      color: 0xb9c2d0,
      roughness: 0.8,
      metalness: 0,
      envMapIntensity: 0.14,
      transparent: true,
      opacity: 1,
      depthWrite: false,
    }),
  );
  const faller = new THREE.Mesh(track(new THREE.SphereGeometry(0.034, 24, 18)), fallerMat);
  root.add(faller);

  const fallLineMat = track(
    new THREE.LineBasicMaterial({
      color: 0xff9a5e,
      transparent: true,
      opacity: 0.5,
      depthWrite: false,
    }),
  );
  const FALL_R0 = orbitR(2.9);
  // Chosen against step 2's camera bearing (az 78) so the drop happens low and
  // right, in open frame — not behind the text panel, and not along the same
  // screen line as Earth and its two force arrows.
  const FALL_ANG = deg(-35);
  const fallLineGeo = track(
    new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(FALL_R0, 0, 0),
      new THREE.Vector3(SUN_R * 0.9, 0, 0),
    ]),
  );
  const fallLine = new THREE.Line(fallLineGeo, fallLineMat);
  fallLine.rotation.y = FALL_ANG;
  root.add(fallLine);

  // -------------------------------------------------------------------------
  // step 5 props: two equal-area sweeps on Mercury's ellipse. Built from the
  // MEAN anomaly, so the two wedges cover the same slice of time — Kepler's
  // second law then guarantees the areas match, without anything being tuned.
  // -------------------------------------------------------------------------
  const mercury = byKey.mercury;
  function sweepGeometry(m0, m1) {
    const N = 40;
    const verts = [0, 0, 0];
    const p = new THREE.Vector3();
    for (let i = 0; i <= N; i++) {
      const M = m0 + (m1 - m0) * (i / N);
      mercury.at(eccAnomaly(M, mercury.e), p);
      verts.push(p.x, p.y, p.z);
    }
    const idx = [];
    for (let i = 1; i <= N; i++) idx.push(0, i, i + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(verts, 3));
    g.setIndex(idx);
    g.computeVertexNormals();
    return g;
  }
  const SWEEP_DT = 0.085; // of one orbit, in each wedge
  const sweepMat = track(
    new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const sweepNear = new THREE.Mesh(track(sweepGeometry(-SWEEP_DT * TAU * 0.5, SWEEP_DT * TAU * 0.5)), sweepMat);
  const sweepFar = new THREE.Mesh(
    track(sweepGeometry(Math.PI - SWEEP_DT * TAU * 0.5, Math.PI + SWEEP_DT * TAU * 0.5)),
    sweepMat,
  );
  root.add(sweepNear, sweepFar);

  // The geometry that makes "off-centre" checkable rather than asserted: the
  // major axis, and a ring on the ellipse's actual centre. With the Sun pulled
  // down toward its true proportion (sunScale) the gap between that ring and
  // the Sun is the eccentricity, drawn at full size.
  const aidMat = track(
    new THREE.MeshBasicMaterial({
      color: 0x9fb6e0,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  const ellipseCentre = new THREE.Vector3(-mercury.aW * mercury.e, 0, 0).applyMatrix4(mercury.mat);
  const centreRingGeo = track(new THREE.RingGeometry(0.028, 0.036, 40));
  centreRingGeo.rotateX(-Math.PI / 2);
  centreRingGeo.applyMatrix4(mercury.mat);
  centreRingGeo.translate(ellipseCentre.x, ellipseCentre.y, ellipseCentre.z);
  const centreRing = new THREE.Mesh(centreRingGeo, aidMat);
  root.add(centreRing);

  const axisA = new THREE.Vector3();
  const axisB = new THREE.Vector3();
  mercury.at(0, axisA);
  mercury.at(Math.PI, axisB);
  const axisGeo = track(
    new THREE.TubeGeometry(new THREE.LineCurve3(axisA, axisB), 1, 0.0022, 5, false),
  );
  const majorAxis = new THREE.Mesh(axisGeo, aidMat);
  root.add(majorAxis);

  // -------------------------------------------------------------------------
  // step 8 props: the barycentre, and the little circle the Sun runs round it
  // -------------------------------------------------------------------------
  const baryMat = track(
    new THREE.MeshBasicMaterial({
      color: 0xfff0d0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    }),
  );
  const baryGroup = new THREE.Group();
  const crossArm = (rot) => {
    const m = new THREE.Mesh(track(new THREE.BoxGeometry(0.15, 0.009, 0.009)), baryMat);
    m.rotation.y = rot;
    return m;
  };
  baryGroup.add(crossArm(0), crossArm(Math.PI / 2));
  baryGroup.renderOrder = 5;
  root.add(baryGroup);

  const sunPathMat = track(
    new THREE.LineBasicMaterial({ color: 0xffc067, transparent: true, opacity: 0, depthWrite: false }),
  );
  const sunPathPts = [];
  for (let i = 0; i <= 128; i++) {
    const a = (i / 128) * TAU;
    sunPathPts.push(new THREE.Vector3(Math.cos(a) * SUN_OFFSET, 0, Math.sin(a) * SUN_OFFSET));
  }
  const sunPath = new THREE.Line(track(new THREE.BufferGeometry().setFromPoints(sunPathPts)), sunPathMat);
  root.add(sunPath);

  // -------------------------------------------------------------------------
  // step 9 props: the helical wake. Each trail is the planet's own history —
  // where it was τ ago, offset by how far the system has travelled since.
  // -------------------------------------------------------------------------
  // FOUR planets, not eight. All eight drawn at once was a ball of wool; these
  // four are the argument — a tight helix, a looser one, a lazy one, and the
  // Sun's own path, which is the straight line they are all wound around.
  const TRAIL_KEYS = new Set(['mercury', 'earth', 'jupiter', 'neptune']);
  const trails = [...planets.filter((p) => TRAIL_KEYS.has(p.key)), { key: 'sun', sun: true }].map((p) => {
    const pos = new Float32Array(TRAIL_N * 3);
    const col = new Float32Array(TRAIL_N * 3);
    const TINT = {
      mercury: 0xb9b2a4,
      earth: 0x8fd8ff,
      jupiter: 0xe8cfa6,
      neptune: 0x6f97ee,
    };
    const base = new THREE.Color(p.sun ? 0xffb454 : TINT[p.key]);
    for (let i = 0; i < TRAIL_N; i++) {
      const k = Math.pow(1 - i / (TRAIL_N - 1), 1.6);
      col[i * 3] = base.r * k;
      col[i * 3 + 1] = base.g * k;
      col[i * 3 + 2] = base.b * k;
    }
    const geo = track(new THREE.BufferGeometry());
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    const mat = track(
      new THREE.LineBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const line = new THREE.Line(geo, mat);
    line.frustumCulled = false;
    line.visible = false;
    root.add(line);
    return { planet: p.sun ? null : p, line, geo, mat };
  });

  // -------------------------------------------------------------------------
  // labels. Spec pills hang off the ORBIT, not off the planet: the number is
  // a property of the orbit, and a pill riding a body that laps the frame
  // twenty times a loop cannot be read.
  // -------------------------------------------------------------------------
  const anchor = (parent) => {
    const o = new THREE.Object3D();
    parent.add(o);
    return o;
  };
  const ringAnchors = Object.fromEntries(planets.map((p) => [p.key, anchor(root)]));

  // Screen direction, in degrees (0 = frame right, 90 = up), at which each
  // orbit's anchor is taken — and the direction its pill then hangs. All four
  // pills that are ever on together are pushed into four different bands of
  // the RIGHT half of the frame: the text panel owns the left ~38%.
  const AIM = {
    mercury: 106,
    venus: 74,
    earth: -74,
    mars: -106,
    jupiter: 104,
    saturn: 76,
    uranus: -76,
    neptune: -82,
    belt: 90,
  };
  // The leader then runs to the RIGHT so the pill grows into open frame. Taken
  // at the extreme RIGHT of an orbit instead, a 280px pill overflows the edge,
  // the declutter pass mirrors it left, and the text lands across the Sun.
  const LEAD = {
    mercury: 26,
    venus: 22,
    earth: -22,
    mars: -26,
    jupiter: 26,
    saturn: 22,
    uranus: -22,
    neptune: -26,
    belt: 30,
  };
  // Mercury's orbit is the one that hugs the Sun, so its pill needs a long
  // enough leader to clear the disc.
  const LEAD_LEN = {
    mercury: 104,
    venus: 66,
    earth: 62,
    mars: 58,
    jupiter: 62,
    saturn: 58,
    uranus: 58,
    neptune: 58,
    belt: 58,
  };
  // The belt has no single orbit, so it gets a circle of its own to aim at.
  const beltAim = { anchorPts: [] };
  for (let i = 0; i < 72; i++) {
    const a = (i / 72) * TAU;
    const rr = (BELT_IN + BELT_OUT) * 0.5;
    beltAim.anchorPts.push(new THREE.Vector3(Math.cos(a) * rr, 0, Math.sin(a) * rr));
  }
  const aSun = anchor(sunPivot);
  const aBary = anchor(root);
  const aEarth = anchor(byKey.earth.holder);
  const aGrav = anchor(arrowRig);
  const aVel = anchor(arrowRig);
  const aFall = anchor(faller);
  const aPeri = anchor(root);
  const aApo = anchor(root);
  const aCentre = anchor(root);
  const aSweepNear = anchor(root);
  const aSweepFar = anchor(root);
  const aBelt = anchor(root);
  const aFlight = anchor(root);
  const aHelix = anchor(root);

  aCentre.position.copy(ellipseCentre);
  mercury.at(0, tmpV);
  aPeri.position.copy(tmpV);
  mercury.at(Math.PI, tmpV);
  aApo.position.copy(tmpV);
  mercury.at(eccAnomaly(SWEEP_DT * TAU * 0.36, mercury.e), tmpV);
  aSweepNear.position.copy(tmpV).multiplyScalar(0.55);
  mercury.at(eccAnomaly(Math.PI + SWEEP_DT * TAU * 0.36, mercury.e), tmpV);
  aSweepFar.position.copy(tmpV).multiplyScalar(0.55);

  // Three, and pushed into three different bands of the frame: anchored close
  // together on one planet, the declutter pass stacks them into a column.
  labels.add('orbit', aVel, 'Sideways speed · 30 km/s', [0, 0, 0], 72, 74);
  labels.add('orbit', aGrav, 'Gravity pulls it in', [0, 0, 0], -58, 78);
  labels.add('orbit', aFall, 'No sideways speed', [0, 0.04, 0], -46, 104);

  for (const p of planets) {
    const set = p.a < 3 ? 'inner' : 'outer';
    labels.add(set, ringAnchors[p.key], `${p.name} · ${p.au} AU · ${p.spec}`, [0, 0, 0], LEAD[p.key], LEAD_LEN[p.key]);
  }
  labels.add('outer', aBelt, 'Asteroid belt · 2.2–3.2 AU', [0, 0, 0], LEAD.belt, LEAD_LEN.belt);

  // Three, not five: at five the pills stacked into one unreadable column down
  // the middle of the ellipse. The Sun's own position and the equal-area
  // wedges are both visible without being named.
  labels.add('ellipse', aPeri, 'Perihelion · 46 Mkm · 59 km/s', [0, 0, 0], -86, 130);
  labels.add('ellipse', aApo, 'Aphelion · 70 Mkm · 39 km/s', [0, 0, 0], 86, 120);
  labels.add('ellipse', aCentre, 'Centre of the ellipse', [0, 0, 0], 92, 214);

  labels.add('kepler', ringAnchors.mercury, 'Mercury · 88 days', [0, 0, 0], LEAD.mercury, 54);
  labels.add('kepler', ringAnchors.neptune, 'Neptune · 164.8 years', [0, 0, 0], LEAD.neptune, 54);

  // Edge-on, an orbit projects to a LINE through the Sun, and the extreme point
  // of that line in any screen direction is one of its two ends — for Neptune,
  // 3 units out, that is off-frame or under the panel depending on the lap. So
  // these two ride their planets, and they are the two whose orbits are small
  // enough to stay in shot: Mercury (the most tilted) and Mars.
  const aMercBody = anchor(byKey.mercury.holder);
  const aMarsBody = anchor(byKey.mars.holder);
  labels.add('disk', aMercBody, 'Mercury · tilted 7.0°', [0, 0, 0], 44, 124);
  labels.add('disk', aMarsBody, 'Mars · tilted 1.9°', [0, 0, 0], -38, 112);

  labels.add('wobble', aSun, 'The Sun, moving', [0, 0, 0], 96, 58);
  labels.add('wobble', aBary, 'The barycentre', [0, 0, 0], -40, 92);
  // On the planet, not on its orbit: aimed at the orbit this one landed on the
  // topmost point of Jupiter's ellipse, which projects right next to the Sun.
  const aJup = anchor(byKey.jupiter.holder);
  labels.add('wobble', aJup, 'Jupiter · the one doing this', [0, 0.1, 0], 28, 58);

  labels.add('flight', aFlight, '230 km/s through the galaxy', [0, 0, 0], 30, 66);
  labels.add('flight', aHelix, 'Every orbit is really a helix', [0, 0, 0], -32, 70);

  // -------------------------------------------------------------------------
  // one state object, one pose function
  // -------------------------------------------------------------------------
  const S = {
    phase: 0,
    slow: 1, // use the readable turn set
    only: null, // key of the ONE planet to show, or null for the group flags
    sunScale: 1, // 1 = the drawn Sun; < 1 pulls it toward its true proportion
    rings: 1, // orbit lines
    beltOn: 1,
    innerOn: 1, // the four inner planets + their orbit lines
    outerOn: 1,
    arrows: 0,
    faller: 0,
    sweep: 0,
    wobble: 0,
    corona: 1,
    flight: 0,
    stars: 1,
    band: 1,
  };

  // Anchors whose true position sits inside or behind geometry. They are
  // re-derived from these bases every frame and slid partway toward the camera:
  // a point moved along its own view ray projects to the same pixel, but the
  // framework stops fading the pill to 32% for being "occluded".
  const baseBary = new THREE.Vector3();
  const baseHelix = new THREE.Vector3();
  const baseFlight = new THREE.Vector3();
  const sunDir = new THREE.Vector3();
  const jupDir = new THREE.Vector3();
  const posA = new THREE.Vector3();
  const posB = new THREE.Vector3();
  const mtx = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const UP = new THREE.Vector3(0, 1, 0);

  const turnsOf = (p) => (S.slow > 0.5 ? p.slowTurns : p.turns);

  // Where planet `p` sits at lap fraction `ph`, in root-local space.
  function posAt(p, ph, out) {
    const M = deg(p.m0) + TAU * turnsOf(p) * ph;
    return p.at(eccAnomaly(M, p.e), out);
  }

  const dummy = new THREE.Object3D();

  function apply() {
    const p = S.phase;

    // --- the Sun's own orbit around the barycentre -------------------------
    // Physically it is Jupiter that does most of this, so the offset is taken
    // straight from Jupiter's direction: the Sun is always on the far side.
    posAt(byKey.jupiter, p, jupDir);
    jupDir.y = 0;
    if (jupDir.lengthSq() < 1e-8) jupDir.set(1, 0, 0);
    jupDir.normalize();
    sunDir.copy(jupDir).multiplyScalar(-SUN_OFFSET * S.wobble);
    sunPivot.position.copy(sunDir);
    sun.rotation.y = p * TAU * 6;
    sun.scale.setScalar(S.sunScale);
    aSun.position.set(0, SUN_R * S.sunScale + 0.06, 0);
    coronaMat.opacity = 0.7 * S.corona;
    corona.scale.setScalar(Math.max(0.001, S.corona * S.sunScale));
    corona.visible = S.corona > 0.002;
    sunPathMat.opacity = 0.55 * S.wobble;
    sunPath.visible = S.wobble > 0.002;
    baryMat.opacity = 0.9 * S.wobble;
    baryGroup.visible = S.wobble > 0.002;
    baseBary.set(0, 0, 0);

    // --- planets ------------------------------------------------------------
    for (const pl of planets) {
      const on = S.only ? (pl.key === S.only ? 1 : 0) : pl.a < 3 ? S.innerOn : S.outerOn;
      const vis = on > 0.002;
      pl.holder.visible = vis;
      pl.ring.visible = vis && S.rings > 0.002;
      pl.ring.material.opacity = 0.34 * S.rings * on;
      if (!vis) continue;
      posAt(pl, p, posA);
      pl.holder.position.copy(posA);
      pl.body.rotation.y = p * TAU * pl.spin;
      if (pl.rings) pl.rings.material.opacity = on;
      if (pl.air) pl.air.material.uniforms.uK.value = on;
    }

    // --- belt ---------------------------------------------------------------
    belt.visible = S.beltOn > 0.002;
    if (belt.visible) {
      const slow = S.slow > 0.5;
      for (let i = 0; i < BELT_N; i++) {
        const r = rocks[i];
        const ang = TAU * (r.phase + (slow ? r.slowTurns : r.turns) * p);
        const x = Math.cos(ang) * r.r;
        const z0 = -Math.sin(ang) * r.r;
        const y = z0 * Math.sin(r.inc);
        const z = z0 * Math.cos(r.inc);
        dummy.position.set(
          x * Math.cos(r.node) + z * Math.sin(r.node),
          y,
          -x * Math.sin(r.node) + z * Math.cos(r.node),
        );
        dummy.quaternion.setFromAxisAngle(r.axis, TAU * r.tumble * p);
        dummy.scale.setScalar(r.size);
        dummy.updateMatrix();
        belt.setMatrixAt(i, dummy.matrix);
      }
      belt.instanceMatrix.needsUpdate = true;
    }

    // --- step 2: the two forces, and the body that was not given any --------
    const armed = S.arrows > 0.002;
    arrowRig.visible = armed;
    if (armed) {
      posAt(byKey.earth, p, posA);
      arrowRig.position.copy(posA);
      // gravity: straight at the Sun
      posB.copy(sunPivot.position).sub(posA).normalize();
      quat.setFromUnitVectors(UP, posB);
      gravArrow.group.quaternion.copy(quat);
      gravArrow.group.scale.set(1, 0.42, 1);
      // velocity: the tangent, taken from the orbit a hair further on
      posAt(byKey.earth, p + 0.0006, posB);
      posB.sub(posA).normalize();
      quat.setFromUnitVectors(UP, posB);
      velArrow.group.quaternion.copy(quat);
      velArrow.group.scale.set(1, 0.38, 1);
      gravArrow.mat.opacity = S.arrows;
      velArrow.mat.opacity = S.arrows;
      // pills hang off the far end of each arrow, in arrowRig-local space
      aGrav.position.copy(sunPivot.position).sub(posA).normalize().multiplyScalar(0.34);
      posAt(byKey.earth, p + 0.0006, posB);
      aVel.position.copy(posB).sub(posA).normalize().multiplyScalar(0.32);
    }

    // The dropped body: three falls a lap, each one fading up and back down to
    // zero inside its own window so the wrap stays invisible.
    const fallOn = S.faller > 0.002;
    faller.visible = fallOn;
    fallLine.visible = fallOn;
    if (fallOn) {
      const u = (p * 3) % 1;
      const drop = FALL_TABLE(clamp01(u / 0.86));
      const r = SUN_R * 0.9 + (FALL_R0 - SUN_R * 0.9) * drop;
      faller.position.set(Math.cos(FALL_ANG) * r, 0, -Math.sin(FALL_ANG) * r);
      const fade = smooth(clamp01(u / 0.08)) * smooth(clamp01((1 - u) / 0.12));
      fallerMat.opacity = fade * S.faller;
      fallLineMat.opacity = 0.6 * fade * S.faller;
    }

    // --- step 5: equal areas ------------------------------------------------
    sweepMat.opacity = 0.22 * S.sweep;
    sweepNear.visible = S.sweep > 0.002;
    sweepFar.visible = sweepNear.visible;
    aidMat.opacity = 0.6 * S.sweep;
    centreRing.visible = sweepNear.visible;
    majorAxis.visible = sweepNear.visible;

    // --- step 9: the helical wake ------------------------------------------
    const flying = S.flight > 0.002;
    for (const t of trails) {
      t.line.visible = flying;
      if (!flying) continue;
      t.mat.opacity = S.flight;
      const arr = t.geo.attributes.position.array;
      for (let i = 0; i < TRAIL_N; i++) {
        const lag = (i / (TRAIL_N - 1)) * TRAIL_TIME;
        if (t.planet) posAt(t.planet, p - lag, posA);
        else posA.set(0, 0, 0);
        const back = (lag / TRAIL_TIME) * TRAIL_LEN;
        arr[i * 3] = posA.x - FLIGHT_DIR.x * back;
        arr[i * 3 + 1] = posA.y - FLIGHT_DIR.y * back;
        arr[i * 3 + 2] = posA.z - FLIGHT_DIR.z * back;
      }
      t.geo.attributes.position.needsUpdate = true;
      t.geo.computeBoundingSphere();
    }
    baseFlight.copy(FLIGHT_DIR).multiplyScalar(2.0);
    posAt(byKey.earth, p, posA);
    baseHelix.copy(posA).addScaledVector(FLIGHT_DIR, -TRAIL_LEN * 0.5);

    skyUniforms.uStars.value = S.stars;
    skyUniforms.uBand.value = S.band;

    updateAnchors();
  }

  // --- per-frame label aiming ------------------------------------------------
  // Same technique as the atom's ring labels: the extreme point of the orbit in
  // a chosen SCREEN direction, so a pill always names a stretch of orbit the
  // viewer can see and never drifts under the text panel.
  const camRight = new THREE.Vector3();
  const camUp = new THREE.Vector3();
  const seek = new THREE.Vector3();
  const world = new THREE.Vector3();

  // Same trick for an anchor parented to a MOVING part: edge-on, Mercury spends
  // part of every lap silhouetted against the Sun, and its pill was dimming to
  // 32% for being "behind" it.
  function liftChild(target, holder, offsetY, toward) {
    holder.getWorldPosition(world);
    world.y += offsetY;
    world.lerp(stage.camera.position, toward);
    target.position.copy(world.sub(holder.getWorldPosition(seek)));
  }

  function liftTo(target, base, toward) {
    world.copy(base);
    root.localToWorld(world);
    world.lerp(stage.camera.position, toward);
    target.position.copy(root.worldToLocal(world));
  }

  function aimAtOrbit(target, pl, dirDeg, toward = 0.35) {
    const rad = deg(dirDeg);
    seek.copy(camRight).multiplyScalar(Math.cos(rad)).addScaledVector(camUp, Math.sin(rad));
    let best = -Infinity;
    for (const q of pl.anchorPts) {
      const s = q.dot(seek);
      if (s > best) {
        best = s;
        world.copy(q);
      }
    }
    root.localToWorld(world);
    if (toward) world.lerp(stage.camera.position, toward);
    target.position.copy(root.worldToLocal(world));
  }

  // Called from apply() as well as from the tick: the verification and
  // screenshot tools pause the timeline, seek it and measure in ONE
  // synchronous block, so an anchor that only re-aimed on tick would be
  // measured at the previous pose.
  function updateAnchors() {
    const cam = stage.camera;
    root.updateMatrixWorld(true);
    camRight.set(1, 0, 0).applyQuaternion(cam.quaternion);
    camUp.set(0, 1, 0).applyQuaternion(cam.quaternion);
    corona.quaternion.copy(cam.quaternion);
    for (const pl of planets) aimAtOrbit(ringAnchors[pl.key], pl, AIM[pl.key]);
    aimAtOrbit(aBelt, beltAim, AIM.belt);
    liftChild(aMercBody, byKey.mercury.holder, 0.02, 0.5);
    liftChild(aMarsBody, byKey.mars.holder, -0.02, 0.5);
    liftTo(aBary, baseBary, 0.35);
    liftTo(aHelix, baseHelix, 0.3);
    liftTo(aFlight, baseFlight, 0.3);
  }

  // Everything here that is atmosphere rather than substance: the corona plane
  // alone was enough to fade four pills to 32% on the step where the arrows
  // live, because label-layout treats any mesh between pill and camera as an
  // occluder.
  for (const o of [sky, corona, belt, sweepNear, sweepFar, centreRing, majorAxis, fallLine, sunPath, baryGroup]) {
    o.traverse ? o.traverse((c) => (c.userData.noOcclude = true)) : (o.userData.noOcclude = true);
  }
  for (const pl of planets) pl.ring.userData.noOcclude = true;
  for (const t of trails) t.line.userData.noOcclude = true;

  const stopTick = stage.onTick(updateAnchors);

  apply();

  return {
    group: root,
    parts: {
      sun: sunPivot,
      planets: Object.fromEntries(planets.map((p) => [p.key, p.holder])),
      belt,
      arrows: arrowRig,
      faller,
      trails: trails.map((t) => t.line),
    },
    set(patch) {
      Object.assign(S, patch);
      apply();
    },
    setLabels: labels.setLabels,
    dispose() {
      stopTick();
      scene.remove(root);
      scene.remove(sky);
      for (const d of disposables) d.dispose?.();
      root.traverse((o) => {
        o.geometry?.dispose?.();
        if (o.material) {
          if (Array.isArray(o.material)) o.material.forEach((m) => m.dispose());
          else o.material.dispose();
        }
      });
    },
  };
}
