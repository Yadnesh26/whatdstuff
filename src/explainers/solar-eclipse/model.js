import * as THREE from 'three';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';

// "How a Solar Eclipse Works" — a shadow, measured. Nothing on Earth here is
// painted dark: every surface point of the Earth (and of its atmosphere, and
// of the Moon) computes, per fragment, how much of the Sun's DISC it can still
// see past the occluder — the exact overlap area of two circles. The umbra,
// the antumbra's ring of fire and the soft penumbral gradient all fall out of
// that one function, so the shadow on the globe is geometry, not a decal.
//
// Reference facts (Wikipedia "Solar eclipse"; NASA TP-1999-209484; derived
// umbra length L = R_moon · d_SM / (R_sun − R_moon)):
//   Earth radius 6,371 km · Moon radius 1,737.4 km (0.2727 Earth)
//   Moon distance 356,500 (perigee) · 384,400 (mean) · 406,700 (apogee) km
//   umbra length at 1 AU ≈ 373,300 km — SHORTER than the 378,000 km from the
//   Moon to the nearest ground at mean distance, which is why annular
//   eclipses (33.2%) outnumber total ones (26.7%)
//   Moon's orbit tilted 5.14° to the ecliptic · Earth's axis 23.44°
//   path of totality ≤ 267 km wide · umbra ground speed ≥ ~1,700 km/h
//
// THE ONE DISCLOSED DISTORTION, and how it is kept honest. A true-scale
// Sun–Moon–Earth line cannot be drawn (the Sun would be 23,000 units away),
// so the Moon's distance is fixed at 6 units and the Sun is brought in to
// 60 — ten lunar distances instead of 389. Instead of drawing the Sun at some
// arbitrary size, its radius is SOLVED so that the umbra's length relative to
// the Moon's distance is the real ratio (373,300 / 378,000). That one
// constraint keeps every shadow fact in the scene true by construction: the
// Sun and Moon still look the same size from the ground, the umbra still only
// reaches at the near half of the Moon's orbit, and the spot it makes is
// still ~4% of an Earth radius across. The same solve runs again at true
// Earth–Moon scale for the "why not every month" step.

const PI = Math.PI;
const deg = (x) => (x * PI) / 180;

const R_EARTH_KM = 6371;
const R_MOON_KM = 1737.4;
const D_MEAN_KM = 384400;
const D_PERI_KM = 356500;
const D_APO_KM = 406700;
const UMBRA_KM = 373300;

const K_MOON = R_MOON_KM / R_EARTH_KM; // 0.2727
const REACH = UMBRA_KM / (D_MEAN_KM - R_EARTH_KM); // 0.9875 — the whole story in one number

const SUN_X = -60;
const D_MEAN = 6;
const D_NEAR = (D_MEAN * D_PERI_KM) / D_MEAN_KM; // 5.565
const D_FAR = (D_MEAN * D_APO_KM) / D_MEAN_KM; // 6.348
const RE_DRAWN = 1;
const RE_TRUE = (D_MEAN * R_EARTH_KM) / D_MEAN_KM; // 0.0994 — Earth at its real size for this orbit

const INC = deg(5.14);
const AXIAL = deg(23.44);
const ACCENT = 0xffcf6b;

// Sizes for a given Earth radius, with the Sun solved from the umbra ratio.
function scaleFor(re) {
  const rm = re * K_MOON;
  const L = (D_MEAN - re) * REACH;
  const rs = rm + (rm * (-SUN_X - D_MEAN)) / L;
  return { re, rm, rs };
}
const SCALE_DRAWN = scaleFor(RE_DRAWN); // rs ≈ 3.25
const SCALE_TRUE = scaleFor(RE_TRUE); // rs ≈ 0.278 → 0.53° from Earth, the real value

// ---------------------------------------------------------------------------
// the ground view. A separate set: a Sun of radius 1 seen from ~9 units, a
// Moon disc of radius MOON_K, a corona plane and a glare quad. It lives in its
// own group so the camera can frame it like a telephoto shot.
// ---------------------------------------------------------------------------
export const SKY_C = [0, 2.0, -11];
const MOON_K = 1.035; // apparent Moon/Sun size ratio for a good (not extreme) total
const JAG = 0.012; // lunar valley depth, radius fraction — exaggerated ~10x so beads read
const K_MIN = MOON_K * (1 - JAG);
const S_END = 2.6; // moon offset (sun radii) at lap start/end — well clear of the disc
const HORIZON = -0.2; // sin of the horizon's elevation in the dome

// ---------------------------------------------------------------------------
// noise + texture helpers (canvas, generated once)
// ---------------------------------------------------------------------------
function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1274126177);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// value noise that wraps in x with period px — a sphere map seam is the one
// flaw you cannot miss on a turning globe
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

function vnoise3(x, y, z, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const z0 = Math.floor(z);
  const sx = ((t) => t * t * (3 - 2 * t))(x - x0);
  const sy = ((t) => t * t * (3 - 2 * t))(y - y0);
  const sz = ((t) => t * t * (3 - 2 * t))(z - z0);
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

function makeCanvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  return c;
}

function finishTexture(canvas, wrap = true) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (wrap) tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 4;
  return tex;
}

// ocean, land, desert, ice, and a cloud deck painted over the top
function earthTexture() {
  const W = 1024;
  const H = 512;
  const seed = 41;
  const canvas = makeCanvas(W, H);
  const img = canvas.getContext('2d').createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const lat = Math.abs(v - 0.5) * 2;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const land = fbm(u * 7, v * 5, 7, seed, 5);
      const detail = fbm(u * 24, v * 16, 24, seed + 13, 4);
      let r;
      let g;
      let b;
      if (land > 0.53) {
        const dry = clamp01((detail - 0.4) * 2.4) * clamp01(1.5 - lat * 3.2);
        r = 0x35 + (0xb6 - 0x35) * dry;
        g = 0x66 + (0x9a - 0x66) * dry;
        b = 0x3a + (0x66 - 0x3a) * dry;
        const shelf = clamp01((land - 0.53) * 9);
        const k = 0.72 + 0.28 * shelf;
        r *= k;
        g *= k;
        b *= k;
      } else {
        const deep = clamp01((0.53 - land) * 4);
        r = 0x1f - 0x10 * deep;
        g = 0x55 - 0x26 * deep;
        b = 0x94 - 0x30 * deep;
      }
      const ice = smooth(clamp01((lat - 0.8) / 0.14));
      r += (236 - r) * ice;
      g += (243 - g) * ice;
      b += (250 - b) * ice;
      const cloud = clamp01((fbm(u * 16, v * 10, 16, seed + 31, 5) - 0.54) * 4.2);
      const k = cloud * 0.6;
      r += (250 - r) * k;
      g += (251 - g) * k;
      b += (253 - b) * k;
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

// highlands, dark maria, and craters with bright rims
function moonTexture() {
  const W = 768;
  const H = 384;
  const seed = 7;
  const canvas = makeCanvas(W, H);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const grain = fbm(u * 26, v * 13, 26, seed, 4);
      const mare = smooth(clamp01((fbm(u * 4, v * 3, 4, seed + 50, 4) - 0.52) * 7));
      let c = 150 + 60 * (grain - 0.5);
      c *= 1 - 0.42 * mare;
      const o = (y * W + x) * 4;
      d[o] = c * 1.0;
      d[o + 1] = c * 0.98;
      d[o + 2] = c * 0.95;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  for (let i = 0; i < 170; i++) {
    const cx = hash2(i, 3, seed) * W;
    const cy = (0.1 + 0.8 * hash2(i, 5, seed + 3)) * H;
    const rad = 2 + 15 * Math.pow(hash2(i, 9, seed + 5), 3);
    const g = ctx.createRadialGradient(cx, cy, rad * 0.2, cx, cy, rad);
    g.addColorStop(0, 'rgba(0,0,0,0.28)');
    g.addColorStop(0.72, 'rgba(0,0,0,0.10)');
    g.addColorStop(0.88, 'rgba(255,255,255,0.18)');
    g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g;
    ctx.beginPath();
    ctx.arc(cx, cy, rad, 0, TAU);
    ctx.fill();
  }
  return finishTexture(canvas);
}

// granulation + limb darkening — the limb darkening is real, and it is what
// stops a bright disc reading as a flat sticker
function sunTexture() {
  const W = 512;
  const H = 256;
  const canvas = makeCanvas(W, H);
  const img = canvas.getContext('2d').createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const theta = v * PI;
    const st = Math.sin(theta);
    const ct = Math.cos(theta);
    for (let x = 0; x < W; x++) {
      const phi = (x / W) * TAU;
      const dx = st * Math.cos(phi);
      const dz = st * Math.sin(phi);
      const cell = fbm3(dx * 22, ct * 22, dz * 22, 3, 3);
      const coarse = fbm3(dx * 6, ct * 6, dz * 6, 17, 2);
      const k = clamp01(0.8 + 0.22 * cell + 0.12 * (coarse - 0.5));
      const o = (y * W + x) * 4;
      d[o] = 255 * k;
      d[o + 1] = 236 * k;
      d[o + 2] = 196 * k;
      d[o + 3] = 255;
    }
  }
  canvas.getContext('2d').putImageData(img, 0, 0);
  return finishTexture(canvas);
}

function glowTexture(inner, outer) {
  const S = 256;
  const canvas = makeCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const q = Math.hypot(x / (S - 1) - 0.5, y / (S - 1) - 0.5) * 2;
      const core = Math.exp(-Math.pow(q / inner, 2.2)) * 0.5;
      const halo = Math.exp(-Math.pow(q / outer, 1.6)) * 0.3;
      const edge = smooth(clamp01((1 - q) / 0.2));
      const o = (y * S + x) * 4;
      d[o] = 255;
      d[o + 1] = 222 - 40 * q;
      d[o + 2] = 170 - 90 * q;
      d[o + 3] = clamp01((core + halo) * edge) * 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTexture(canvas, false);
}

// The corona, painted in units of the Sun's radius: the plane spans ±CORONA_R.
// Helmet streamers are broad and long near the equator, polar plumes short
// and fine, and the whole thing falls off steeply — it is a million times
// fainter than the disc, which is why only totality shows it. The pink tufts
// at the limb are prominences, which really are that colour (hydrogen-alpha).
const CORONA_R = 4.2;
function coronaTexture() {
  const S = 640;
  const canvas = makeCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  // streamer strength as a periodic function of position angle
  const lobes = [];
  for (let i = 0; i < 14; i++) {
    lobes.push({ a: hash2(i, 1, 91) * TAU, w: 0.05 + 0.16 * hash2(i, 2, 91), s: 0.4 + 0.6 * hash2(i, 3, 91) });
  }
  const angDist = (a, b) => {
    let x = Math.abs(a - b) % TAU;
    return x > PI ? TAU - x : x;
  };
  const tilt = deg(18);
  const proms = [
    { a: deg(38), h: 0.075, w: 0.07 },
    { a: deg(152), h: 0.055, w: 0.05 },
    { a: deg(221), h: 0.09, w: 0.06 },
    { a: deg(305), h: 0.05, w: 0.08 },
  ];
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px = ((x + 0.5) / S - 0.5) * 2 * CORONA_R;
      const py = (0.5 - (y + 0.5) / S) * 2 * CORONA_R;
      const r = Math.hypot(px, py);
      const o = (y * S + x) * 4;
      if (r < 0.97) {
        d[o] = d[o + 1] = d[o + 2] = d[o + 3] = 0;
        continue;
      }
      const a = Math.atan2(py, px);
      // equatorial belt, tipped a little off horizontal
      const eq = Math.exp(-Math.pow(Math.sin(a - tilt), 2) / 0.22);
      let st = 0.22 + 0.5 * eq;
      for (const l of lobes) {
        const dd = angDist(a, l.a);
        st += l.s * 0.5 * Math.exp(-(dd * dd) / (2 * l.w * l.w)) * (0.4 + 0.6 * eq);
      }
      st = Math.min(1.4, st);
      // fine radial striation (plumes and rays)
      const fine = 0.78 + 0.22 * vnoise(((a + PI) / TAU) * 180, r * 0.6, 180, 23);
      const fall = Math.pow(Math.max(r, 1), -(2.9 - 1.5 * Math.min(1, st)));
      const inner = Math.exp(-(r - 1) / 0.07) * 0.9;
      let I = (fall * st * fine * 0.95 + inner) * smooth(clamp01((r - 0.97) / 0.04));
      I *= smooth(clamp01((CORONA_R - r) / 0.9));
      let pr = 0;
      for (const p of proms) {
        const dd = angDist(a, p.a);
        const lateral = Math.exp(-(dd * dd) / (2 * p.w * p.w * 0.25));
        const height = clamp01(1 - (r - 1) / p.h);
        pr = Math.max(pr, lateral * height * (0.7 + 0.3 * vnoise(a * 60, r * 40, 377, 5)));
      }
      const R = clamp01(I * 1.0 + pr * 1.0);
      const G = clamp01(I * 0.97 + pr * 0.32);
      const B = clamp01(I * 0.95 + pr * 0.45);
      d[o] = 255 * R;
      d[o + 1] = 255 * G;
      d[o + 2] = 255 * B;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTexture(canvas, false);
}

// diamond-ring flare: a hot core and a few thin diffraction spikes
function glareTexture() {
  const S = 256;
  const canvas = makeCanvas(S, S);
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(S, S);
  const d = img.data;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const px = (x + 0.5) / S - 0.5;
      const py = (y + 0.5) / S - 0.5;
      const q = Math.hypot(px, py) * 2;
      const a = Math.atan2(py, px);
      const core = Math.exp(-Math.pow(q / 0.07, 2)) * 1.0 + Math.exp(-q / 0.16) * 0.45;
      const spikes = Math.pow(Math.abs(Math.cos(a * 2 + 0.3)), 90) * Math.exp(-q / 0.45) * 0.55;
      const I = clamp01((core + spikes) * smooth(clamp01((1 - q) / 0.25)));
      const o = (y * S + x) * 4;
      d[o] = 255 * I;
      d[o + 1] = 250 * I;
      d[o + 2] = 238 * I;
      d[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  return finishTexture(canvas, false);
}

// Monotone time warp: `weight(x)` is how much of the lap to spend per unit x
// on x∈[0,1]; returns x(u) with x(0)=0, x(1)=1. Used where the physics runs at
// one speed but the interesting part is a sliver of it (totality is ~2% of an
// eclipse; the shadow is on Earth for ~1% of a month).
function warpTable(weight, N = 2048) {
  const cum = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) cum[i + 1] = cum[i] + (weight(i / N) + weight((i + 1) / N)) / 2;
  const tot = cum[N];
  for (let i = 0; i <= N; i++) cum[i] /= tot;
  return (u) => {
    const x = clamp01(u);
    let lo = 1;
    let hi = N;
    while (lo < hi) {
      const m = (lo + hi) >> 1;
      if (cum[m] < x) lo = m + 1;
      else hi = m;
    }
    const span = Math.max(cum[lo] - cum[lo - 1], 1e-12);
    return (lo - 1 + (x - cum[lo - 1]) / span) / N;
  };
}

// Area of overlap of two discs (radii r1, r2, centres d apart).
function discOverlap(r1, r2, d) {
  if (d >= r1 + r2) return 0;
  if (d <= Math.abs(r1 - r2)) return PI * Math.min(r1, r2) ** 2;
  const a = Math.acos(clamp((d * d + r1 * r1 - r2 * r2) / (2 * d * r1)));
  const b = Math.acos(clamp((d * d + r2 * r2 - r1 * r1) / (2 * d * r2)));
  const k = (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2);
  return r1 * r1 * a + r2 * r2 * b - 0.5 * Math.sqrt(Math.max(k, 0));
}
function clamp(x) {
  return Math.max(-1, Math.min(1, x));
}

// ---------------------------------------------------------------------------
// shaders
// ---------------------------------------------------------------------------
const SHADOW_GLSL = /* glsl */ `
const float PI_ = 3.14159265;
float discOverlap(float r1, float r2, float d) {
  if (d >= r1 + r2) return 0.0;
  if (d <= abs(r1 - r2)) { float r = min(r1, r2); return PI_ * r * r; }
  float r1s = r1 * r1;
  float r2s = r2 * r2;
  float a = acos(clamp((d * d + r1s - r2s) / (2.0 * d * r1), -1.0, 1.0));
  float b = acos(clamp((d * d + r2s - r1s) / (2.0 * d * r2), -1.0, 1.0));
  float k = (-d + r1 + r2) * (d + r1 - r2) * (d - r1 + r2) * (d + r1 + r2);
  return r1s * a + r2s * b - 0.5 * sqrt(max(k, 0.0));
}
// Fraction of the Sun's disc visible from P with one occluding sphere. Angles
// from the cross product, not acos(dot): at true scale they are ~0.005 rad and
// acos loses them to float precision.
float sunSeen(vec3 P, vec3 sunPos, float sunR, vec3 occPos, float occR) {
  vec3 toS = sunPos - P;
  float dS = length(toS);
  vec3 s = toS / dS;
  vec3 toO = occPos - P;
  float dO = length(toO);
  vec3 o = toO / dO;
  if (dO > dS || dot(o, s) <= 0.0) return 1.0;
  float a = asin(clamp(sunR / dS, 0.0, 1.0));
  float b = asin(clamp(occR / dO, 0.0, 1.0));
  float c = asin(clamp(length(cross(o, s)), 0.0, 1.0));
  return 1.0 - discOverlap(a, b, c) / (PI_ * a * a);
}
`;

const BODY_VERT = /* glsl */ `
varying vec3 vWP;
varying vec3 vWN;
varying vec2 vUv;
void main() {
  vUv = uv;
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  vWN = normalize(mat3(modelMatrix) * normal);
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;

const EARTH_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uSunPos;
uniform float uSunR;
uniform vec3 uOccPos;
uniform float uOccR;
varying vec3 vWP;
varying vec3 vWN;
varying vec2 vUv;
${SHADOW_GLSL}
void main() {
  vec3 N = normalize(vWN);
  vec3 L = normalize(uSunPos - vWP);
  vec3 V = normalize(cameraPosition - vWP);
  vec3 alb = texture2D(uMap, vUv).rgb;
  float ndl = dot(N, L);
  float vis = sunSeen(vWP, uSunPos, uSunR, uOccPos, uOccR);
  float lit = smoothstep(-0.04, 0.18, ndl) * max(ndl, 0.0) * 0.85 + smoothstep(-0.04, 0.06, ndl) * 0.08;
  // vis is the true fraction of sunlight; the display curve below only
  // steepens it (an exposure choice, like any eclipse photo) — otherwise the
  // penumbra's 30-60% dimming vanishes into the tone curve's shoulder
  float shade = pow(vis, 2.0);
  vec3 col = alb * lit * shade * 1.15 + alb * 0.004;
  float ocean = smoothstep(0.04, 0.14, alb.b - alb.r);
  vec3 H = normalize(L + V);
  col += vec3(1.0, 0.94, 0.84) * pow(max(dot(N, H), 0.0), 60.0) * 0.35 * ocean * shade * step(0.0, ndl);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const MOON_FRAG = /* glsl */ `
uniform sampler2D uMap;
uniform vec3 uSunPos;
uniform float uSunR;
uniform vec3 uOccPos;
uniform float uOccR;
uniform float uShine;
varying vec3 vWP;
varying vec3 vWN;
varying vec2 vUv;
${SHADOW_GLSL}
void main() {
  vec3 N = normalize(vWN);
  vec3 L = normalize(uSunPos - vWP);
  vec3 alb = texture2D(uMap, vUv).rgb;
  float ndl = dot(N, L);
  float vis = sunSeen(vWP, uSunPos, uSunR, uOccPos, uOccR);
  vec3 col = alb * smoothstep(-0.03, 0.12, ndl) * max(ndl, 0.0) * vis * 1.6;
  // earthshine: sunlight bounced off Earth, the faint grey you can see on the
  // dark part of a crescent Moon — and the only light on a new Moon's face
  float e = max(dot(N, normalize(uOccPos - vWP)), 0.0);
  col += alb * vec3(0.55, 0.68, 1.0) * e * uShine;
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

const AIR_FRAG = /* glsl */ `
uniform vec3 uSunPos;
uniform float uSunR;
uniform vec3 uOccPos;
uniform float uOccR;
uniform float uK;
varying vec3 vWP;
varying vec3 vWN;
${SHADOW_GLSL}
void main() {
  vec3 N = normalize(vWN);
  vec3 V = normalize(cameraPosition - vWP);
  vec3 L = normalize(uSunPos - vWP);
  float f = pow(1.0 - max(dot(N, V), 0.0), 2.6);
  float lit = smoothstep(-0.3, 0.35, dot(N, L));
  float vis = sunSeen(vWP, uSunPos, uSunR, uOccPos, uOccR);
  gl_FragColor = vec4(vec3(0.32, 0.58, 1.0) * f * lit * vis * uK, 1.0);
}
`;

const CONE_VERT = /* glsl */ `
varying vec3 vN;
varying vec3 vV;
void main() {
  vN = normalize(normalMatrix * normal);
  vec4 mv = modelViewMatrix * vec4(position, 1.0);
  vV = normalize(-mv.xyz);
  gl_Position = projectionMatrix * mv;
}
`;
const CONE_FRAG = /* glsl */ `
uniform vec3 uColor;
uniform float uAlpha;
varying vec3 vN;
varying vec3 vV;
void main() {
  float f = 1.0 - abs(dot(normalize(vN), normalize(vV)));
  float a = uAlpha * (0.22 + 0.78 * pow(f, 2.2));
  gl_FragColor = vec4(uColor, a);
}
`;

// The sky. In space: stars and a faint Milky Way. On the ground: a day sky
// with an aureole round the Sun, dimming with the visible fraction of the
// disc into the real colours of totality — deep blue overhead and a sunset on
// EVERY horizon (you are looking out of the shadow at lit air 100 km away),
// over a dark ridge line.
const SKY_GLSL = /* glsl */ `
uniform float uStars;
uniform float uGround;
uniform float uDay;
uniform vec3 uSunDir;
uniform float uHorizon;

vec3 hash33(vec3 p) {
  p = vec3(dot(p, vec3(127.1, 311.7, 74.7)),
           dot(p, vec3(269.5, 183.3, 246.1)),
           dot(p, vec3(113.5, 271.9, 124.6)));
  return fract(sin(p) * 43758.5453);
}
float hash1(float n) { return fract(sin(n) * 43758.5453); }
float noise1(float x) {
  float i = floor(x);
  float f = fract(x);
  f = f * f * (3.0 - 2.0 * f);
  return mix(hash1(i), hash1(i + 1.0), f);
}
float vnoise3(vec3 p) {
  vec3 i = floor(p);
  vec3 f = fract(p);
  f = f * f * (3.0 - 2.0 * f);
  float n = 0.0;
  for (int dx = 0; dx < 2; dx++)
  for (int dy = 0; dy < 2; dy++)
  for (int dz = 0; dz < 2; dz++) {
    vec3 o = vec3(float(dx), float(dy), float(dz));
    vec3 w = mix(1.0 - f, f, o);
    n += hash33(i + o).x * w.x * w.y * w.z;
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
  float s = smoothstep(0.19, 0.0, length(f - sp));
  float mag = pow(fract(h.y * 7.31), 3.0);
  vec3 tint = mix(vec3(0.74, 0.83, 1.0), vec3(1.0, 0.87, 0.68), h.z);
  return tint * s * s * mag * bright;
}
vec3 stars(vec3 d) {
  vec3 col = starLayer(d, 120.0, 0.05, 2.2);
  col += starLayer(d, 260.0, 0.034, 1.1);
  col += starLayer(d, 540.0, 0.024, 0.5);
  return col;
}
vec3 skyColor(vec3 d, float withStars) {
  vec3 space = vec3(0.0035, 0.0045, 0.009);
  if (uGround < 0.5) {
    vec3 bandN = normalize(vec3(0.3, 0.8, -0.52));
    float b = dot(d, bandN);
    float band = exp(-(b * b) / (2.0 * 0.11 * 0.11));
    float mottle = vnoise3(d * 14.0) * 0.5 + vnoise3(d * 38.0) * 0.3 + vnoise3(d * 90.0) * 0.2;
    space += vec3(0.034, 0.04, 0.066) * band * (0.12 + 0.88 * mottle);
    return space + stars(d) * uStars * withStars;
  }
  float h = d.y - uHorizon;
  float hh = max(h, 0.0);
  float az = atan(d.z, d.x);
  // a deep, filtered-photo blue rather than a hazy noon: the hero title and
  // the step panel sit over this sky and need the contrast
  vec3 zen = vec3(0.035, 0.11, 0.32);
  vec3 hor = vec3(0.26, 0.38, 0.58);
  vec3 day = mix(hor, zen, pow(clamp(hh * 1.5, 0.0, 1.0), 0.55));
  float mu = max(dot(d, uSunDir), 0.0);
  day += vec3(1.0, 0.93, 0.8) * (pow(mu, 60.0) * 0.24 + pow(mu, 8.0) * 0.04);
  vec3 dark = mix(vec3(0.05, 0.065, 0.11), vec3(0.008, 0.012, 0.03), clamp(hh * 2.4, 0.0, 1.0));
  dark += vec3(1.0, 0.5, 0.2) * exp(-hh / 0.04) * 0.5;
  dark += vec3(0.7, 0.42, 0.38) * exp(-hh / 0.13) * 0.1;
  vec3 col = mix(dark, day, uDay);
  col += stars(d) * uStars * withStars * smoothstep(0.02, 0.2, hh);
  float ridge = 0.01 + 0.03 * noise1(az * 6.0 + 3.0) + 0.012 * noise1(az * 21.0 + 1.0) + 0.004 * noise1(az * 70.0);
  vec3 ground = mix(vec3(0.004, 0.005, 0.007), vec3(0.035, 0.045, 0.035), uDay);
  col = mix(ground, col, smoothstep(ridge - 0.0015, ridge + 0.0015, h));
  return col;
}
`;

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
${SKY_GLSL}
void main() {
  gl_FragColor = vec4(skyColor(normalize(vDir), 1.0), 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// The Moon seen from the ground. It is the SKY colour, not black: in daylight
// the new Moon is invisible, because the air between you and it is lit just
// like the air beside it. Only where it sits over the Sun's disc is it dark —
// the view through an eclipse filter. That is also what makes the loop seam
// invisible: the Moon enters and leaves unseen.
const SKYMOON_VERT = /* glsl */ `
varying vec3 vWP;
void main() {
  vec4 wp = modelMatrix * vec4(position, 1.0);
  vWP = wp.xyz;
  gl_Position = projectionMatrix * viewMatrix * wp;
}
`;
const SKYMOON_FRAG = /* glsl */ `
precision highp float;
varying vec3 vWP;
uniform vec3 uDiscC;
uniform float uDiscR;
${SKY_GLSL}
void main() {
  vec3 d = normalize(vWP - cameraPosition);
  vec3 col = skyColor(d, 0.0);
  float inside = 1.0 - smoothstep(uDiscR * 0.994, uDiscR * 1.004, length(vWP - uDiscC));
  col = mix(col, col * 0.05 + vec3(0.004, 0.004, 0.006), inside * uDay);
  gl_FragColor = vec4(col, 1.0);
  #include <tonemapping_fragment>
  #include <colorspace_fragment>
}
`;

// GTAO renders a depth/normal prepass with scene.overrideMaterial, which draws
// every mesh as an opaque surface — including the camera-facing effect planes
// (corona, glare, the sky-coloured Moon disc, shadow cones). Against black
// space that was invisible; against the daylight sky it painted their
// rectangles and the Moon's full outline dark. Emptying the draw range for
// the prepass only, from the mesh's own hooks, keeps this out of stage.js.
function skipInPrepass(mesh) {
  const before = mesh.onBeforeRender;
  mesh.onBeforeRender = function (r, sc, c, geo, mat, grp) {
    before.call(this, r, sc, c, geo, mat, grp);
    if (sc.overrideMaterial) {
      this.userData.savedRange = [geo.drawRange.start, geo.drawRange.count];
      geo.setDrawRange(0, 0);
    }
  };
  mesh.onAfterRender = function (r, sc, c, geo) {
    const d = this.userData.savedRange;
    if (d) {
      geo.setDrawRange(d[0], d[1]);
      this.userData.savedRange = null;
    }
  };
}

// ---------------------------------------------------------------------------
export function buildSolarEclipse({ scene, stage }) {
  const disposables = [];
  const track = (x) => {
    disposables.push(x);
    return x;
  };

  // --- sky dome: in the scene, not the root (the hero bob moves the root),
  // re-centred on the camera every frame so it behaves as a true backdrop ---
  const skyUniforms = {
    uStars: { value: 1 },
    uGround: { value: 0 },
    uDay: { value: 1 },
    uSunDir: { value: new THREE.Vector3(0, 0, -1) },
    uHorizon: { value: HORIZON },
  };
  const skyMat = track(
    new THREE.ShaderMaterial({
      uniforms: skyUniforms,
      vertexShader: SKY_VERT,
      fragmentShader: SKY_FRAG,
      side: THREE.BackSide,
      depthTest: false,
      depthWrite: false,
    }),
  );
  const sky = new THREE.Mesh(track(new THREE.SphereGeometry(80, 48, 32)), skyMat);
  sky.renderOrder = -10;
  sky.frustumCulled = false;
  sky.onBeforeRender = (r, s, cam) => {
    sky.position.copy(cam.position);
    sky.updateMatrixWorld();
  };
  scene.add(sky);

  const root = new THREE.Group();
  scene.add(root);

  const labels = calloutSets(['sky', 'lineup', 'cones', 'distance', 'track', 'nodes', 'finale']);
  const noOcc = [];

  const sunMap = track(sunTexture());

  // =========================================================================
  // SPACE: Earth at the origin, Moon on its orbit, Sun at x = −60
  // =========================================================================
  const sys = new THREE.Group();
  root.add(sys);

  const SUN_POS = new THREE.Vector3(SUN_X, 0, 0);
  const sunMat = track(
    new THREE.MeshBasicMaterial({ map: sunMap, color: new THREE.Color(2.3, 1.62, 0.82) }),
  );
  const sun = new THREE.Mesh(track(new THREE.SphereGeometry(1, 64, 48)), sunMat);
  sun.position.copy(SUN_POS);
  sys.add(sun);
  const sunGlowMat = track(
    new THREE.MeshBasicMaterial({
      map: track(glowTexture(0.3, 0.52)),
      color: 0xffc36e,
      transparent: true,
      opacity: 0.75,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  // a camera-facing quad, NOT a THREE.Sprite: GTAO's override-material
  // prepass throws away sprite billboarding (see solar-system's note)
  const sunGlow = new THREE.Mesh(track(new THREE.PlaneGeometry(4.6, 4.6)), sunGlowMat);
  sunGlow.position.copy(SUN_POS);
  sys.add(sunGlow);
  noOcc.push(sunGlow);

  // Earth: pivot → axial tilt → daily spin → globe
  const earthTilt = new THREE.Group();
  earthTilt.rotation.z = AXIAL; // north pole leaning toward the Sun: a June eclipse
  sys.add(earthTilt);
  const earthSpin = new THREE.Group();
  earthTilt.add(earthSpin);

  const earthUniforms = {
    uMap: { value: track(earthTexture()) },
    uSunPos: { value: SUN_POS },
    uSunR: { value: SCALE_DRAWN.rs },
    uOccPos: { value: new THREE.Vector3() },
    uOccR: { value: SCALE_DRAWN.rm },
  };
  const earthMat = track(
    new THREE.ShaderMaterial({ uniforms: earthUniforms, vertexShader: BODY_VERT, fragmentShader: EARTH_FRAG }),
  );
  const earth = new THREE.Mesh(track(new THREE.SphereGeometry(1, 128, 80)), earthMat);
  earthSpin.add(earth);

  const airUniforms = {
    uSunPos: { value: SUN_POS },
    uSunR: earthUniforms.uSunR,
    uOccPos: earthUniforms.uOccPos,
    uOccR: earthUniforms.uOccR,
    uK: { value: 1 },
  };
  const airMat = track(
    new THREE.ShaderMaterial({
      uniforms: airUniforms,
      vertexShader: BODY_VERT,
      fragmentShader: AIR_FRAG,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const air = new THREE.Mesh(track(new THREE.SphereGeometry(1.028, 96, 64)), airMat);
  earthTilt.add(air);
  noOcc.push(air);

  const moonUniforms = {
    uMap: { value: track(moonTexture()) },
    uSunPos: { value: SUN_POS },
    uSunR: earthUniforms.uSunR,
    uOccPos: { value: new THREE.Vector3(0, 0, 0) },
    uOccR: { value: 1 },
    uShine: { value: 0.05 },
  };
  const moonMat = track(
    new THREE.ShaderMaterial({ uniforms: moonUniforms, vertexShader: BODY_VERT, fragmentShader: MOON_FRAG }),
  );
  const moon = new THREE.Mesh(track(new THREE.SphereGeometry(1, 64, 48)), moonMat);
  sys.add(moon);

  // a ring drawn round the Moon at true scale, where it is three pixels wide
  const markerMat = track(
    new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.85, depthWrite: false, depthTest: false }),
  );
  const moonMarker = new THREE.Mesh(track(new THREE.RingGeometry(0.2, 0.228, 64)), markerMat);
  moonMarker.renderOrder = 6;
  sys.add(moonMarker);
  noOcc.push(moonMarker);

  // --- the shadow volumes ----------------------------------------------------
  function coneMat(color, alpha) {
    return track(
      new THREE.ShaderMaterial({
        uniforms: { uColor: { value: new THREE.Color(color) }, uAlpha: { value: alpha } },
        vertexShader: CONE_VERT,
        fragmentShader: CONE_FRAG,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
      }),
    );
  }
  const coneRig = new THREE.Group();
  sys.add(coneRig);
  const umbraMat = coneMat(0x6f86c9, 0.55);
  const antumbraMat = coneMat(0xffb35c, 0.5);
  const penumbraMat = coneMat(0x9fb0cc, 0.16);
  const umbra = new THREE.Mesh(new THREE.BufferGeometry(), umbraMat);
  const antumbra = new THREE.Mesh(new THREE.BufferGeometry(), antumbraMat);
  const penumbra = new THREE.Mesh(new THREE.BufferGeometry(), penumbraMat);
  umbra.renderOrder = 3;
  antumbra.renderOrder = 3;
  penumbra.renderOrder = 2;
  coneRig.add(penumbra, umbra, antumbra);
  noOcc.push(umbra, antumbra, penumbra);

  function setFrustum(mesh, r0, r1, h) {
    mesh.geometry.dispose();
    if (h <= 1e-4) {
      mesh.geometry = new THREE.BufferGeometry();
      mesh.visible = false;
      return;
    }
    const g = new THREE.CylinderGeometry(Math.max(r1, 1e-4), Math.max(r0, 1e-4), h, 72, 1, true);
    g.translate(0, h / 2, 0);
    mesh.geometry = g;
    mesh.visible = true;
  }

  // --- rays: straight lines from the Sun's edges past the Moon's edges ------
  const rayGeo = track(new THREE.CylinderGeometry(1, 1, 1, 8, 1, true).translate(0, 0.5, 0));
  function makeRay(color, opacity) {
    const mat = track(
      new THREE.MeshBasicMaterial({
        color,
        transparent: true,
        opacity,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
      }),
    );
    const m = new THREE.Mesh(rayGeo, mat);
    m.renderOrder = 4;
    m.frustumCulled = false;
    sys.add(m);
    noOcc.push(m);
    return m;
  }
  const rayUmbra = [makeRay(0xffe2a8, 0.75), makeRay(0xffe2a8, 0.75)];
  const rayPen = [makeRay(0xffd08a, 0.42), makeRay(0xffd08a, 0.42)];
  const sight = [makeRay(ACCENT, 0.9), makeRay(ACCENT, 0.9)];

  const UPY = new THREE.Vector3(0, 1, 0);
  const tmpQ = new THREE.Quaternion();
  function placeRay(mesh, from, dir, len, thick) {
    mesh.position.copy(from);
    tmpQ.setFromUnitVectors(UPY, dir);
    mesh.quaternion.copy(tmpQ);
    mesh.scale.set(thick, len, thick);
  }

  // --- step 6 aids: the ecliptic, the tilted orbit, the line of nodes -------
  const aids = new THREE.Group();
  sys.add(aids);
  const eclMat = track(
    new THREE.MeshBasicMaterial({ color: 0x5b6f93, transparent: true, opacity: 0.1, depthWrite: false, side: THREE.DoubleSide }),
  );
  const ecliptic = new THREE.Mesh(track(new THREE.CircleGeometry(7.4, 96)), eclMat);
  ecliptic.rotation.x = -PI / 2;
  aids.add(ecliptic);
  const eclEdgeMat = track(new THREE.MeshBasicMaterial({ color: 0x8397bb, transparent: true, opacity: 0.4, depthWrite: false }));
  const eclEdge = new THREE.Mesh(track(new THREE.TorusGeometry(D_MEAN, 0.012, 6, 160)), eclEdgeMat);
  eclEdge.rotation.x = PI / 2;
  aids.add(eclEdge);
  const orbitHolder = new THREE.Group();
  aids.add(orbitHolder);
  const orbitMat = track(new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.7, depthWrite: false }));
  const orbitRing = new THREE.Mesh(track(new THREE.TorusGeometry(D_MEAN, 0.016, 6, 200)), orbitMat);
  orbitRing.rotation.x = PI / 2;
  orbitHolder.add(orbitRing);
  const nodeMat = track(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false }));
  const nodeLine = new THREE.Mesh(track(new THREE.CylinderGeometry(0.012, 0.012, D_MEAN * 2.3, 6)), nodeMat);
  nodeLine.rotation.z = PI / 2; // along local x
  orbitHolder.add(nodeLine);
  aids.traverse((o) => noOcc.push(o));

  // --- path of totality: precomputed for the track step ---------------------
  // (built below, once the track geometry helpers exist)

  // --- anchors (Object3Ds the callouts hang off, moved in apply) -----------
  const anchor = () => {
    const o = new THREE.Object3D();
    sys.add(o);
    return o;
  };
  const aSun = anchor();
  const aMoon = anchor();
  const aObserver = anchor();
  const aSightMid = anchor();
  const aUmbra = anchor();
  const aPen = anchor();
  const aRay = anchor();
  const aTip = anchor();
  const aSpot = anchor();
  const aSpotPen = anchor();
  const aPath = anchor();
  const aTilt = anchor();
  const aNode = anchor();
  const aShadow = anchor();
  const aEarthTrue = anchor();
  const aDist = anchor();

  labels.add('lineup', aSun, 'Sun · ~400× wider than the Moon', [0, 0, 0], 60, 40);
  labels.add('lineup', aSightMid, '…and ~400× farther away', [0, 0, 0], 70, 46);
  labels.add('lineup', aMoon, 'Moon · the same 0.5° from the ground', [0, 0, 0], -60, 56);

  labels.add('cones', aUmbra, 'Umbra · the Sun fully hidden', [0, 0, 0], 60, 62);
  labels.add('cones', aPen, 'Penumbra · the Sun partly hidden', [0, 0, 0], -60, 58);
  labels.add('cones', aRay, 'Light from opposite edges of the Sun', [0, 0, 0], 70, 40);
  labels.add('cones', aMoon, 'Moon', [0, 0, 0], 110, 40);

  const cDist = labels.add('distance', aDist, 'Moon · 384,400 km', [0, 0, 0], 80, 64);
  const cTip = labels.add('distance', aTip, 'Umbra reaches the ground · total', [0, 0, 0], 65, 70);

  labels.add('track', aSpot, 'Umbra · at most 267 km wide', [0, 0, 0], 40, 80);
  labels.add('track', aSpotPen, 'Penumbra · partial eclipse, 6,400+ km', [0, 0, 0], -30, 70);
  labels.add('track', aPath, 'Path of totality', [0, 0, 0], -65, 70);

  labels.add('nodes', aTilt, "Moon's orbit · tilted 5.1°", [0, 0, 0], 70, 44);
  labels.add('nodes', aNode, 'Line of nodes', [0, 0, 0], -70, 40);
  labels.add('nodes', aShadow, "Moon's shadow", [0, 0, 0], 110, 50);
  labels.add('nodes', aEarthTrue, 'Earth · true size', [0, 0, 0], -60, 46);

  // =========================================================================
  // GROUND VIEW
  // =========================================================================
  const sv = new THREE.Group();
  sv.position.set(...SKY_C);
  // local x/y = screen right/up for the ground-view cameras, which sit in +z
  sv.lookAt(SKY_C[0], SKY_C[1] - 1.2, SKY_C[2] + 9);
  root.add(sv);

  const svSun = new THREE.Mesh(
    track(new THREE.SphereGeometry(1, 64, 48)),
    track(new THREE.MeshBasicMaterial({ map: sunMap, color: new THREE.Color(2.25, 1.9, 1.45) })),
  );
  sv.add(svSun);

  const coronaMat = track(
    new THREE.MeshBasicMaterial({
      map: track(coronaTexture()),
      color: new THREE.Color(2.4, 2.3, 2.2),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const corona = new THREE.Mesh(track(new THREE.PlaneGeometry(CORONA_R * 2, CORONA_R * 2)), coronaMat);
  corona.renderOrder = 5;
  sv.add(corona);

  // the lunar limb: a disc whose edge is notched by valleys (periodic noise in
  // position angle). Beads are sunlight through those notches — not a sprite.
  const skyMoonGeo = (() => {
    const N = 1440;
    const pos = [0, 0, 0];
    const phases = [];
    for (let k = 0; k < 26; k++) phases.push({ n: 30 + Math.floor(hash2(k, 4, 61) * 140), p: hash2(k, 6, 61) * TAU, a: 0.5 + hash2(k, 8, 61) });
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      let v = 0;
      for (const ph of phases) v += ph.a * Math.sin(ph.n * a + ph.p);
      v /= 6;
      const notch = smooth(clamp01((v - 0.25) / 0.7));
      const r = MOON_K * (1 - JAG * notch);
      pos.push(Math.cos(a) * r, Math.sin(a) * r, 0);
    }
    const idx = [];
    for (let i = 1; i <= N; i++) idx.push(0, i, i + 1 > N ? 1 : i + 1);
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setIndex(idx);
    return g;
  })();
  track(skyMoonGeo);
  const skyMoonUniforms = {
    ...skyUniforms,
    uDiscC: { value: new THREE.Vector3() },
    uDiscR: { value: 1 },
  };
  const skyMoonMat = track(
    new THREE.ShaderMaterial({
      uniforms: skyMoonUniforms,
      vertexShader: SKYMOON_VERT,
      fragmentShader: SKYMOON_FRAG,
      transparent: true,
      depthTest: false,
      depthWrite: false,
      side: THREE.DoubleSide,
    }),
  );
  const skyMoon = new THREE.Mesh(skyMoonGeo, skyMoonMat);
  skyMoon.renderOrder = 10;
  skyMoon.frustumCulled = false;
  sv.add(skyMoon);

  const glareMat = track(
    new THREE.MeshBasicMaterial({
      map: track(glareTexture()),
      color: new THREE.Color(3.2, 3.1, 2.9),
      transparent: true,
      opacity: 0,
      depthTest: false,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const glare = new THREE.Mesh(track(new THREE.PlaneGeometry(1.6, 1.6)), glareMat);
  glare.renderOrder = 20;
  sv.add(glare);

  // Venus — usually the first "star" out in totality, since it sits near the Sun
  const venusMat = track(
    new THREE.MeshBasicMaterial({
      map: track(glowTexture(0.08, 0.2)),
      color: new THREE.Color(4.5, 4.4, 4.1),
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    }),
  );
  const venus = new THREE.Mesh(track(new THREE.PlaneGeometry(0.9, 0.9)), venusMat);
  venus.position.set(3.4, -1.25, 0);
  sv.add(venus);
  noOcc.push(corona, skyMoon, glare, venus);

  const aCorona = new THREE.Object3D();
  aCorona.position.set(1.45, 1.35, 0.2);
  sv.add(aCorona);
  const aLimb = new THREE.Object3D();
  skyMoon.add(aLimb);
  aLimb.position.set(0.72 * MOON_K, -0.72 * MOON_K, 0.2);
  const aHorizon = new THREE.Object3D();
  root.add(aHorizon);

  labels.add('sky', aCorona, 'Corona · seen only in totality', [0, 0, 0], 40, 60);
  labels.add('sky', aLimb, 'Moon · invisible until it covers the Sun', [0, 0, 0], -35, 56);
  labels.add('finale', aCorona, 'Corona', [0, 0, 0], 40, 56);
  labels.add('finale', venus, 'Venus · stars at midday', [0, 0, 0], 20, 46);
  labels.add('finale', aHorizon, 'Sunset on every horizon', [0, 0, 0], 60, 60);

  for (const o of noOcc) o.userData.noOcclude = true;
  sky.userData.noOcclude = true;

  // =========================================================================
  // pose
  // =========================================================================
  const S = {
    view: 'space', // 'sky' | 'space'
    program: 'lineup', // lineup | cones | distance | track | nodes
    phase: 0,
    cones: 0,
    rays: 0,
    sight: 0,
    aids: 0,
    trail: 0,
  };

  // sky-view lap: the Moon's offset across the disc, lingering at totality
  const skyWarp = warpTable((x) => {
    const s = S_END * (1 - 2 * x);
    return 0.1 + 2.4 * Math.exp(-((s / 0.06) ** 2));
  });
  const PATH_ANG = deg(14); // the Moon's track across the disc, entering upper right
  const pathDir = new THREE.Vector2(Math.cos(PATH_ANG), Math.sin(PATH_ANG));

  // track-step lap: one synodic month, with the eclipse taking most of it
  const trackWarp = warpTable((t) => 0.03 + Math.exp(-(((t - 0.5) / 0.035) ** 2)));
  const TRACK_NODE = PI - 0.62; // node 36° off the Sun line → path at mid-northern latitudes
  const TRACK_SPIN0 = deg(-128);
  const TRACK_TURNS = 3; // Earth turns per month here: keeps shadow:ground speed ≈ 2:1, the real ratio
  // The lap starts with the penumbra already arriving, not in the fast
  // between-eclipses stretch: a step entry (or a video cut) should open on the
  // shadow, not on a globe spinning with nothing on it. Still seamless — the
  // warp is continuous across u = 0/1.
  const TRACK_LEAD = 0.2;

  const qTilt = new THREE.Quaternion();
  const nodeAxis = new THREE.Vector3();
  function moonAt(theta, D, omega, inc, out) {
    out.set(D * Math.cos(theta), 0, -D * Math.sin(theta));
    if (inc) {
      nodeAxis.set(Math.cos(omega), 0, -Math.sin(omega));
      qTilt.setFromAxisAngle(nodeAxis, inc);
      out.applyQuaternion(qTilt);
    }
    return out;
  }

  // --- precompute the path of totality in Earth-fixed coordinates ------------
  const qAxial = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 0, 1), AXIAL);
  const qSpin = new THREE.Quaternion();
  const vA = new THREE.Vector3();
  const vB = new THREE.Vector3();
  const vC = new THREE.Vector3();
  const vD = new THREE.Vector3();

  // where the shadow axis (Sun centre → Moon centre, continued) meets a sphere
  function axisHit(M, R, out) {
    vD.copy(M).sub(SUN_POS).normalize();
    const b = M.dot(vD);
    const c = M.lengthSq() - R * R;
    const disc = b * b - c;
    if (disc < 0) return null;
    const tHit = -b - Math.sqrt(disc);
    if (tHit < 0) return null;
    return out.copy(M).addScaledVector(vD, tHit);
  }

  const pathPts = [];
  const pathT = [];
  for (let i = 0; i <= 600; i++) {
    const t = 0.44 + (0.12 * i) / 600;
    moonAt(PI + TAU * (t - 0.5), D_NEAR, TRACK_NODE, INC, vA);
    if (!axisHit(vA, RE_DRAWN, vB)) continue;
    qSpin.setFromAxisAngle(UPY, TRACK_SPIN0 + TAU * TRACK_TURNS * t);
    const q = qAxial.clone().multiply(qSpin).invert();
    pathPts.push(vB.clone().applyQuaternion(q).multiplyScalar(1.0));
    pathT.push(t);
  }
  const PATH_SEG = 400;
  const pathGeo = track(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(pathPts), PATH_SEG, 0.014, 8, false),
  );
  const pathMat = track(
    new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.6, depthWrite: false }),
  );
  const path = new THREE.Mesh(pathGeo, pathMat);
  path.renderOrder = 1;
  earthSpin.add(path);
  noOcc.push(path);
  path.userData.noOcclude = true;
  for (const o of noOcc) if (o.isMesh) skipInPrepass(o);
  const T0 = pathT[0];
  const T1 = pathT[pathT.length - 1];
  // lap fraction at which the path ends, so the trail can fade over the fast part
  let U_END = 1;
  for (let i = 0; i <= 1000; i++) {
    if (trackWarp(i / 1000) >= T1) {
      U_END = i / 1000;
      break;
    }
  }

  const M = new THREE.Vector3();
  const axis = new THREE.Vector3();
  const w = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const camDir = new THREE.Vector3();
  const svInv = new THREE.Quaternion();
  const cam = stage.camera;

  // per-program derived state, shared with the per-frame view update
  const live = { re: 1, rm: 1, rs: 1, M: new THREE.Vector3(), skyOffset: new THREE.Vector2(), glare: 0, horizonSet: false };

  function applySpace() {
    const u = S.phase;
    const sc = S.program === 'nodes' ? SCALE_TRUE : SCALE_DRAWN;
    live.re = sc.re;
    live.rm = sc.rm;
    live.rs = sc.rs;

    let theta = PI;
    let D = D_MEAN;
    let omega = 0;
    let inc = 0;
    let spin = TAU * u;
    if (S.program === 'cones') D = D_NEAR;
    else if (S.program === 'distance') {
      D = (D_NEAR + D_FAR) / 2 - ((D_FAR - D_NEAR) / 2) * Math.sin(TAU * u);
    } else if (S.program === 'track') {
      const t = trackWarp((u + TRACK_LEAD) % 1);
      theta = PI + TAU * (t - 0.5);
      D = D_NEAR;
      omega = TRACK_NODE;
      inc = INC;
      spin = TRACK_SPIN0 + TAU * TRACK_TURNS * t;
      // path of totality: grows while the umbra is down, fades over the fast part
      // trail stops a little behind the spot so the spot itself stays clear
      const k = clamp01((t - T0 - 0.0012) / (T1 - T0));
      const segs = Math.floor(k * PATH_SEG);
      path.geometry.setDrawRange(0, segs * 8 * 6);
      pathMat.opacity = 0.5 * S.trail * (1 - smooth((((u + TRACK_LEAD) % 1) - U_END) / 0.12));
      path.visible = S.trail > 0 && segs > 0 && pathMat.opacity > 0.003;
    } else if (S.program === 'nodes') {
      // Twelve new moons a lap while the node line turns once against the Sun —
      // one eclipse year (really 11.74 months) with BOTH nodes passing the Sun
      // line: at u = 0.5 and at the wrap. Half a turn would not loop: turning
      // the node line 180° swaps ascending for descending and tips the orbit
      // the other way.
      theta = PI + 12 * TAU * u;
      omega = PI - TAU * (u - 0.5);
      inc = INC;
      spin = TAU * u;
    }
    if (S.program !== 'track') path.visible = false;

    moonAt(theta, D, omega, inc, M);
    live.M.copy(M);

    earth.scale.setScalar(sc.re);
    air.scale.setScalar(sc.re);
    air.visible = true;
    earthSpin.rotation.y = spin;
    moon.scale.setScalar(sc.rm);
    moon.position.copy(M);
    moon.rotation.y = theta + PI; // tidally locked: one face toward Earth
    sun.scale.setScalar(sc.rs);
    sunGlow.scale.setScalar(sc.rs);
    moonMarker.visible = S.program === 'nodes';
    moonMarker.position.copy(M);

    earthUniforms.uSunR.value = sc.rs;
    earthUniforms.uOccPos.value.copy(M);
    earthUniforms.uOccR.value = sc.rm;
    moonUniforms.uOccR.value = sc.re;
    // earthshine is real but faint; the lineup looks at the Moon's night side
    // head-on, where it is the only thing showing the Moon is there at all
    moonUniforms.uShine.value = S.program === 'lineup' ? 0.6 : S.program === 'nodes' ? 0.08 : 0.05;

    // --- shadow geometry ---------------------------------------------------
    axis.copy(M).sub(SUN_POS);
    const dSM = axis.length();
    axis.divideScalar(dSM);
    const L = (sc.rm * dSM) / (sc.rs - sc.rm); // umbra length
    const umbraSlope = (sc.rs - sc.rm) / dSM;
    const penSlope = (sc.rs + sc.rm) / dSM;
    // draw each cone to the plane through Earth's centre — the globe hides the
    // part inside it — or a fixed length when the shadow points elsewhere
    const toEarth = -M.dot(axis);
    const len = toEarth > 0.5 ? toEarth : D_MEAN;
    coneRig.visible = S.cones > 0.002;
    if (coneRig.visible) {
      coneRig.position.copy(M);
      tmpQ.setFromUnitVectors(UPY, axis);
      coneRig.quaternion.copy(tmpQ);
      setFrustum(penumbra, sc.rm, sc.rm + len * penSlope, len);
      if (L >= len) {
        setFrustum(umbra, sc.rm, sc.rm - len * umbraSlope, len);
        setFrustum(antumbra, 0, 0, 0);
      } else {
        setFrustum(umbra, sc.rm, 0, L);
        antumbra.position.set(0, L, 0);
        setFrustum(antumbra, 0, (len - L) * umbraSlope, len - L);
      }
      const nodesBoost = S.program === 'nodes' ? 1.6 : 1;
      umbraMat.uniforms.uAlpha.value = 0.55 * S.cones * nodesBoost;
      antumbraMat.uniforms.uAlpha.value = 0.5 * S.cones;
      penumbraMat.uniforms.uAlpha.value = 0.16 * S.cones * nodesBoost;
    }

    // --- anchors -------------------------------------------------------------
    aSun.position.copy(SUN_POS);
    aMoon.position.copy(M).add(tmp.set(0, sc.rm * 1.05, 0));
    // the umbra tip, or where it meets the ground if it gets there
    const surf = axisHit(M, sc.re, vC);
    const reaches = !!surf && M.distanceTo(vC) < L;
    if (reaches) aTip.position.copy(vC).addScaledVector(axis, -0.06);
    else aTip.position.copy(M).addScaledVector(axis, L);
    if (S.program === 'distance') {
      const km = Math.round((D / D_MEAN) * D_MEAN_KM / 100) * 100;
      cDist.setText(`Moon · ${km.toLocaleString('en-US')} km`);
      cTip.setText(reaches ? 'Umbra reaches the ground · total' : 'Umbra falls short · ring of fire');
    }
    aUmbra.position.copy(M).addScaledVector(axis, Math.min(L, len) * 0.45);
    aDist.position.copy(M).addScaledVector(axis, len * 0.7);
    aPen.position.copy(M).addScaledVector(axis, len * 0.72);
    // on the ground (track): the umbra's centre and a point in the penumbra
    if (S.program === 'track') {
      if (surf) {
        aSpot.position.copy(vC).add(tmp.set(0, 0.07, 0.03)).normalize().multiplyScalar(1.004);
        aSpotPen.position.copy(vC).add(tmp.set(0.05, -0.42, 0.22)).normalize().multiplyScalar(1.004);
      }
      // a point partway back along the path already drawn
      const t = trackWarp((u + TRACK_LEAD) % 1);
      const k = clamp01((t - T0) / (T1 - T0));
      const i = Math.max(0, Math.min(pathPts.length - 1, Math.floor(k * pathPts.length * 0.55)));
      aPath.position.copy(pathPts[i]).applyQuaternion(qSpin.setFromAxisAngle(UPY, spin)).applyQuaternion(qAxial);
    }
    if (S.program === 'nodes') {
      // max-latitude point of the tilted orbit, the node, the shadow, Earth
      moonAt(omega + PI / 2, D_MEAN, omega, inc, tmp);
      if (tmp.y < 0) moonAt(omega - PI / 2, D_MEAN, omega, inc, tmp);
      aTilt.position.copy(tmp);
      moonAt(omega, D_MEAN, omega, 0, tmp);
      if (tmp.x > 0) tmp.negate();
      aNode.position.copy(tmp);
      aShadow.position.copy(M).addScaledVector(axis, Math.min(L, len) * 0.8);
      aEarthTrue.position.set(0, -sc.re, 0);
      orbitHolder.rotation.set(0, 0, 0);
      nodeAxis.set(Math.cos(omega), 0, -Math.sin(omega));
      orbitHolder.quaternion.setFromAxisAngle(nodeAxis, inc).multiply(tmpQ.setFromAxisAngle(UPY, omega));
    }
    aids.visible = S.aids > 0.002;
    aEarthTrue.visible = true;
  }

  // sky-view pose from the lap
  function applySky() {
    const x = skyWarp(S.phase);
    const s = S_END * (1 - 2 * x);
    live.skyOffset.set(pathDir.x * s, pathDir.y * s);
    skyMoon.position.set(live.skyOffset.x, live.skyOffset.y, 0.02);
    const as = Math.abs(s);
    // analytic visible fraction of the Sun, mean lunar radius
    const f = 1 - discOverlap(1, MOON_K * (1 - JAG * 0.5), as) / PI;
    const day = Math.pow(clamp01(f), 0.4);
    skyUniforms.uDay.value = day;
    skyUniforms.uStars.value = 1 - smooth(day / 0.14);
    coronaMat.opacity = 1 - smooth(f / 0.005);
    // Baily's beads → diamond ring: the last light, through the deepest valleys
    const gap = as - (K_MIN - 1);
    const g = smooth(gap / 0.006) * (1 - smooth((as - 0.05) / 0.035));
    live.glare = g;
    glareMat.opacity = g;
    glare.visible = g > 0.003;
    if (as > 1e-5) glare.position.set((-live.skyOffset.x / as) * 0.99, (-live.skyOffset.y / as) * 0.99, 0.05);
    glare.scale.setScalar(0.7 + 1.6 * g);
    venusMat.opacity = 1 - smooth(day / 0.12);
    skyMoonUniforms.uDiscR.value = 1;
  }

  function apply() {
    const skyMode = S.view === 'sky';
    sys.visible = !skyMode;
    sv.visible = skyMode;
    skyUniforms.uGround.value = skyMode ? 1 : 0;
    if (skyMode) applySky();
    else {
      skyUniforms.uDay.value = 0;
      skyUniforms.uStars.value = 1;
      applySpace();
    }
    updateView();
  }

  // Everything that depends on where the camera is: billboards, the sky's sun
  // direction, and the rays — which are drawn in the plane through the shadow
  // axis that faces the viewer, the only plane in which "two lines from
  // opposite edges of the Sun" reads as the textbook diagram.
  const worldPos = new THREE.Vector3();
  function updateView() {
    root.updateMatrixWorld(true);
    if (S.view === 'sky') {
      sv.getWorldQuaternion(svInv).invert();
      const q = tmpQ.copy(svInv).multiply(cam.quaternion);
      corona.quaternion.copy(q);
      skyMoon.quaternion.copy(q);
      glare.quaternion.copy(q);
      venus.quaternion.copy(q);
      svSun.getWorldPosition(worldPos);
      skyUniforms.uSunDir.value.copy(worldPos).sub(cam.position).normalize();
      skyMoonUniforms.uDiscC.value.copy(worldPos);
      // the horizon label sits on the dome's horizon, low and to the right
      tmp.set(1, 0, 0).applyQuaternion(cam.quaternion);
      tmp2.set(0, 0, -1).applyQuaternion(cam.quaternion);
      tmp2.y = 0;
      tmp2.normalize().addScaledVector(tmp, 0.3).normalize();
      tmp2.y = HORIZON + 0.035;
      aHorizon.position.copy(cam.position).addScaledVector(tmp2.normalize(), 30);
      root.worldToLocal(aHorizon.position);
      return;
    }
    sunGlow.quaternion.copy(cam.quaternion);
    tmp.copy(cam.position).sub(SUN_POS).normalize();
    aSun.position.copy(SUN_POS).addScaledVector(tmp, live.rs * 1.05).add(tmp2.set(0, live.rs * 0.55, 0));
    moonMarker.quaternion.copy(cam.quaternion);

    const Mw = live.M;
    axis.copy(Mw).sub(SUN_POS).normalize();
    camDir.copy(Mw).sub(cam.position).normalize();
    w.crossVectors(axis, camDir);
    if (w.lengthSq() < 1e-8) w.set(0, 1, 0);
    w.normalize();
    // keep "+w" pointing up the screen so the labelled ray is the upper one
    if (w.y < 0) w.negate();

    const showRays = S.rays > 0.002;
    const endX = 1.6; // rays run on past Earth's centre plane
    const thick = S.program === 'nodes' ? 0.004 : 0.011;
    for (let i = 0; i < 2; i++) {
      const sgn = i === 0 ? 1 : -1;
      // umbra edge: Sun top limb → Moon top limb
      const a0 = tmp.copy(SUN_POS).addScaledVector(w, sgn * live.rs);
      const a1 = tmp2.copy(Mw).addScaledVector(w, sgn * live.rm);
      let dir = vA.copy(a1).sub(a0).normalize();
      let len = (endX - a0.x) / Math.max(dir.x, 1e-3);
      placeRay(rayUmbra[i], a0, dir, len, thick);
      rayUmbra[i].visible = showRays;
      rayUmbra[i].material.opacity = 0.75 * S.rays;
      // penumbra edge: Sun top limb → Moon bottom limb
      const b1 = tmp2.copy(Mw).addScaledVector(w, -sgn * live.rm);
      dir = vA.copy(b1).sub(a0).normalize();
      len = (endX - a0.x) / Math.max(dir.x, 1e-3);
      placeRay(rayPen[i], a0, dir, len, thick * 0.8);
      rayPen[i].visible = showRays;
      rayPen[i].material.opacity = 0.42 * S.rays;
    }
    // label on the upper umbra ray, just before it reaches the Moon
    aRay.position.copy(SUN_POS).addScaledVector(w, live.rs);
    vA.copy(Mw).addScaledVector(w, live.rm).sub(aRay.position);
    aRay.position.addScaledVector(vA, 0.93);

    // sight lines: from the ground under the Moon, past its two edges, on to the Sun
    const showSight = S.sight > 0.002;
    const O = vB.copy(Mw).normalize().multiplyScalar(live.re);
    for (let i = 0; i < 2; i++) {
      const sgn = i === 0 ? 1 : -1;
      const through = tmp.copy(Mw).addScaledVector(w, sgn * live.rm);
      const dir = vA.copy(through).sub(O).normalize();
      const len = (SUN_X - O.x) / Math.min(dir.x, -1e-3);
      placeRay(sight[i], O, dir, len, 0.005);
      sight[i].visible = showSight;
      sight[i].material.opacity = 0.9 * S.sight;
    }
    aObserver.position.copy(O);
    aSightMid.position.copy(O).addScaledVector(vA, ((SUN_X - O.x) / Math.min(vA.x, -1e-3)) * 0.3);
  }

  const stopTick = stage.onTick(updateView);

  apply();

  return {
    group: root,
    parts: { earth: earthSpin, moon, sun, cones: coneRig, skyMoon, corona, path },
    set(patch) {
      Object.assign(S, patch);
      apply();
    },
    setLabels: labels.setLabels,
    dispose() {
      stopTick();
      scene.remove(root);
      scene.remove(sky);
      for (const m of [umbra, antumbra, penumbra]) m.geometry.dispose();
      for (const d of disposables) d.dispose?.();
    },
  };
}
