import * as THREE from 'three';
import { materials, studioPlinth } from '../../framework/parts.js';
import { beveledBox, gear, coil } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';

// 3D PRINTER (FDM) — an open-frame "bedslinger" desktop printer plus three
// macro inserts at bigger scales, each shown alone on its own steps:
//
//   A  the real printer, authored in mm, scale 0.005 u/mm (1 u = 200 mm).
//      X: toolhead slides along a 2020 gantry on a belt; Y: the bed slides
//      front-back on two rods with its own belt; Z: two lead screws lift the
//      gantry between layers (they stand still while a layer is drawn).
//   S  the slicer's view: the same 50 mm chess rook as a stack of slices,
//      scale 0.032 (25 slabs = every 10th of the real 250 layers).
//   B  the toolhead cut in half (back half kept, cut faces at z = 0), scale
//      1/30: MK8-style extruder (stepper, 9 mm drive gear with a ~7 mm
//      effective hobbed groove, spring-loaded 623 idler bearing) above an
//      E3D-V6-style hotend (finned ~22 mm heatsink, thin heat break, 20 x 16 x
//      11.5 mm heater block with cartridge + thermistor, brass 0.4 mm nozzle).
//   C  the nozzle tip at scale 0.5 (1 u = 2 mm): 0.45 x 0.2 mm beads, the part
//      sliding underneath as it really does on a bedslinger.
//
// DISCLOSED SIMPLIFICATIONS: the cutaways are sections, not a real teardown;
// step 4's colours are a thermal-camera false colour; the glow on fresh
// plastic in A and C marks heat (PLA does not visibly glow at 210 °C); the
// print bed sheet is shown lifted as an exploded view; the slice stack shows
// one slab per ten layers; motion in B and C is slowed far below real speed.
//
// LOOP CONTRACT (one lap function per step, all seamless):
//   print — the toolhead tours ONE closed layer path (perimeters + infill +
//           travel back to the start), so X/Y motors, belts and bed return to
//           their start; the hot trail is time-windowed on the same lap.
//   slice — the stack breathes open/closed and sways (cosine/sine, 1 cycle).
//   feed  — filament advances 30 drive-gear teeth (27.5 mm): the 24-tooth gear
//           turns 1.25 turns (a whole tooth count), the 8-ball idler turns
//           27.5/5 rad = 7 ball pitches, bite marks scroll 30 periods.
//   bead  — the part slides 6 texture periods (6 mm) under the fixed nozzle.
//   bed   — the lifted sheet bobs (cosine, 1 cycle).

const SA = 0.005;
const SS = 0.032;
const SB = 1 / 30;
const SC = 0.5;

// ---- printer layout (mm, A-local; origin on the plinth top) ----------------
const BED_TOP = 85; // PEI surface height
const PRINT_H = 24; // rook printed this far (120 layers)
const LAYER = 0.2;
const NOZ_Y = BED_TOP + PRINT_H + LAYER; // nozzle tip, drawing layer 121
const ZN = 30; // nozzle z (toolhead sits in front of the gantry)
const GY = 158; // gantry extrusion centre height
const BELT_Y = 196; // X belt ribbon centre height
const XP_R = 6.37; // GT2 20T pulley pitch radius
const XM_X = 172; // X motor / idler |x|
const LS_X = 198; // lead screw |x|
const LS_Z = -30;

// ---- rook (mm) -------------------------------------------------------------
const ROOK = [
  [15, 0], [15, 2.2], [14.3, 3], [13.6, 3.4], [13.6, 4.4], [12.4, 5.4], [11.4, 6.6], [11, 8],
  [9.6, 33], [10.4, 34], [11.6, 35], [11.6, 38], [12.4, 38.8], [12.4, 50],
];
const ROOK_IN = 8.6; // battlement cup inner radius
function rookR(y) {
  for (let i = 1; i < ROOK.length; i++) {
    const [r0, y0] = ROOK[i - 1];
    const [r1, y1] = ROOK[i];
    if (y <= y1) return y1 === y0 ? r1 : r0 + (r1 - r0) * ((y - y0) / (y1 - y0));
  }
  return ROOK[ROOK.length - 1][0];
}

// ---- hotend thermal profile (B-local mm; block top at y = 19) ---------------
function hotendT(y) {
  if (y <= 19) return 210;
  if (y <= 21.5) return 210 - (210 - 72) * smooth((y - 19) / 2.5);
  if (y <= 48) return 36 + 36 * Math.exp(-(y - 21.5) / 7);
  return 30 - 4 * clamp01((y - 48) / 30);
}
const IRON = [
  [0, [13, 6, 40]], [0.18, [60, 15, 117]], [0.38, [160, 31, 120]], [0.58, [226, 69, 44]],
  [0.76, [250, 128, 26]], [0.9, [255, 166, 46]], [1, [255, 188, 70]],
];
function iron(t) {
  const x = clamp01(t);
  for (let i = 1; i < IRON.length; i++) {
    if (x <= IRON[i][0]) {
      const [a, ca] = IRON[i - 1];
      const [b, cb] = IRON[i];
      const k = (x - a) / (b - a);
      return ca.map((c, j) => Math.round(c + (cb[j] - c) * k));
    }
  }
  return IRON[IRON.length - 1][1];
}
const TH_Y0 = -2;
const TH_Y1 = 102;

// ---------------------------------------------------------------- print path
// One layer of the rook at PRINT_H, in part-local mm (x, z): outer wall, inner
// wall, +45° rectilinear infill at 15 % (3 mm line spacing), travel home.
function buildPath() {
  const R = rookR(PRINT_H);
  const way = [];
  const add = (x, z, v, e) => way.push({ x, z, v, e });
  const r1 = R - 0.225;
  const r2 = R - 0.675;
  const ri = R - 1.0;
  const a0 = -0.75 * Math.PI;
  add(r1 * Math.cos(a0), r1 * Math.sin(a0), 1, false);
  for (let i = 1; i <= 120; i++) {
    const a = a0 + (TAU * i) / 120;
    add(r1 * Math.cos(a), r1 * Math.sin(a), 25, true);
  }
  add(r2 * Math.cos(a0), r2 * Math.sin(a0), 25, true);
  for (let i = 1; i <= 120; i++) {
    const a = a0 + (TAU * i) / 120;
    add(r2 * Math.cos(a), r2 * Math.sin(a), 35, true);
  }
  const d = [Math.SQRT1_2, Math.SQRT1_2];
  const n = [-Math.SQRT1_2, Math.SQRT1_2];
  let flip = false;
  let first = true;
  for (let c = -7.5; c <= 7.6; c += 3) {
    const L = Math.sqrt(Math.max(0, ri * ri - c * c));
    let p1 = [c * n[0] - L * d[0], c * n[1] - L * d[1]];
    let p2 = [c * n[0] + L * d[0], c * n[1] + L * d[1]];
    if (flip) [p1, p2] = [p2, p1];
    add(p1[0], p1[1], first ? 120 : 60, !first);
    add(p2[0], p2[1], 60, true);
    flip = !flip;
    first = false;
  }
  add(way[0].x, way[0].z, 150, false);
  const t = [0];
  for (let i = 1; i < way.length; i++) {
    const dx = way[i].x - way[i - 1].x;
    const dz = way[i].z - way[i - 1].z;
    t.push(t[i - 1] + Math.hypot(dx, dz) / way[i].v);
  }
  const T = t[t.length - 1];
  function at(time) {
    const tt = ((time % T) + T) % T;
    let lo = 0;
    let hi = t.length - 1;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (t[mid] <= tt) lo = mid;
      else hi = mid;
    }
    const k = (tt - t[lo]) / Math.max(1e-9, t[hi] - t[lo]);
    return {
      x: way[lo].x + (way[hi].x - way[lo].x) * k,
      z: way[lo].z + (way[hi].z - way[lo].z) * k,
      e: way[hi].e,
    };
  }
  return { at, T };
}
const PATH = buildPath();

// --------------------------------------------------------------------- laps
const BASE = {
  tp: 0, lift: 0, park: false, fanA: 0,
  gap: 0, sway: 0,
  feed: 0, fanB: 0, airB: 0, meltB: 0,
  scroll: 0, dotC: 0, airC: 0,
};
const LAPS = {
  print: (u) => ({ ...BASE, tp: u, fanA: TAU * 4 * u }),
  slice: (u) => ({ ...BASE, gap: (1 - Math.cos(TAU * u)) / 2, sway: 0.32 * Math.sin(TAU * u) }),
  feed: (u) => ({ ...BASE, feed: 30 * u, fanB: TAU * 6 * u, airB: 3 * u, meltB: 2 * u }),
  bead: (u) => ({ ...BASE, scroll: 6 * u, dotC: 3 * u, airC: 4 * u }),
  bed: (u) => ({ ...BASE, park: true, lift: 16 + 22 * ((1 - Math.cos(TAU * u)) / 2), fanA: TAU * 3 * u }),
};

// ----------------------------------------------------------------- textures
function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
function canvasTex(w, h, draw, { repeat = false, srgb = true } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  draw(c.getContext('2d'), w, h);
  const t = new THREE.CanvasTexture(c);
  if (srgb) t.colorSpace = THREE.SRGBColorSpace;
  if (repeat) t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  return t;
}
// tangent-space normal map from a wrapping height field H(x, y) (pixels)
function heightNormalTex(w, h, H, strength = 1) {
  const data = new Uint8Array(w * h * 4);
  const hv = new Float32Array(w * h);
  for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) hv[y * w + x] = H(x, y);
  const get = (x, y) => hv[((y + h) % h) * w + ((x + w) % w)];
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const dx = (get(x + 1, y) - get(x - 1, y)) * strength;
      const dy = (get(x, y + 1) - get(x, y - 1)) * strength;
      const l = Math.hypot(dx, dy, 1);
      const i = (y * w + x) * 4;
      data[i] = ((-dx / l) * 0.5 + 0.5) * 255;
      data[i + 1] = ((-dy / l) * 0.5 + 0.5) * 255;
      data[i + 2] = ((1 / l) * 0.5 + 0.5) * 255;
      data[i + 3] = 255;
    }
  }
  const t = new THREE.DataTexture(data, w, h);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.magFilter = THREE.LinearFilter;
  t.minFilter = THREE.LinearMipmapLinearFilter;
  t.generateMipmaps = true;
  t.needsUpdate = true;
  return t;
}

// layer-line ridges: one period per texture tile in v
const layerNormal = () =>
  heightNormalTex(4, 32, (x, y) => Math.abs(Math.sin((Math.PI * y) / 32)) * 2.2, 1);

function peiMaps(seed = 3) {
  const r = rng(seed);
  const N = 128;
  const hf = new Float32Array(N * N);
  for (let k = 0; k < 900; k++) {
    const cx = r() * N;
    const cy = r() * N;
    const rad = 1 + r() * 2.4;
    const amp = (r() - 0.3) * 1.6;
    for (let y = -4; y <= 4; y++) {
      for (let x = -4; x <= 4; x++) {
        const px = Math.floor(cx + x);
        const py = Math.floor(cy + y);
        const d = Math.hypot(px - cx, py - cy) / rad;
        if (d < 1) hf[((py + N) % N) * N + ((px + N) % N)] += amp * (1 - d * d);
      }
    }
  }
  const normal = heightNormalTex(N, N, (x, y) => hf[y * N + x], 0.9);
  const map = canvasTex(
    N,
    N,
    (g) => {
      for (let y = 0; y < N; y++) {
        for (let x = 0; x < N; x++) {
          const v = hf[y * N + x];
          const k = 0.9 + 0.12 * Math.tanh(v);
          g.fillStyle = `rgb(${Math.round(186 * k)},${Math.round(140 * k)},${Math.round(62 * k)})`;
          g.fillRect(x, y, 1, 1);
        }
      }
    },
    { repeat: true },
  );
  return { map, normal };
}

function beltTex() {
  return canvasTex(
    32,
    8,
    (g, w, h) => {
      g.fillStyle = '#15161a';
      g.fillRect(0, 0, w, h);
      g.fillStyle = '#2c2e33';
      g.fillRect(0, 0, w * 0.45, h);
    },
    { repeat: true },
  );
}

function leadScrewTex() {
  // 4-start Tr8x8: four helical stripes per 8 mm of length
  return canvasTex(
    64,
    64,
    (g, w, h) => {
      g.fillStyle = '#7f868f';
      g.fillRect(0, 0, w, h);
      g.strokeStyle = '#d7dce2';
      g.lineWidth = 6;
      for (let k = -4; k < 8; k++) {
        g.beginPath();
        g.moveTo(0, (k * h) / 4);
        g.lineTo(w, (k * h) / 4 + h);
        g.stroke();
      }
    },
    { repeat: true },
  );
}

function heaterTraceTex() {
  // a serpentine copper trace under black solder mask (235 mm square bed)
  const W = 1024;
  const mmPx = W / 235;
  const draw = (g, emissive) => {
    g.fillStyle = emissive ? '#000' : '#141619';
    g.fillRect(0, 0, W, W);
    g.strokeStyle = emissive ? '#fff' : '#3b2b22';
    g.lineWidth = 3.4 * mmPx;
    g.lineCap = 'round';
    g.beginPath();
    const x0 = 14 * mmPx;
    const x1 = W - 14 * mmPx;
    let y = 14 * mmPx;
    const step = 7.4 * mmPx;
    g.moveTo(x0, y);
    let right = true;
    while (y + step < W - 14 * mmPx) {
      g.lineTo(right ? x1 : x0, y);
      g.arc(right ? x1 : x0, y + step / 2, step / 2, -Math.PI / 2, Math.PI / 2, !right);
      y += step;
      right = !right;
    }
    g.lineTo(right ? x1 : x0, y);
    g.stroke();
    if (!emissive) {
      g.fillStyle = '#c9cdd2';
      g.font = `${7 * mmPx}px sans-serif`;
      g.fillText('24V  HEATBED', 16 * mmPx, W - 4 * mmPx);
    }
  };
  return {
    map: canvasTex(W, W, (g) => draw(g, false)),
    emissive: canvasTex(W, W, (g) => draw(g, true)),
  };
}

function rookTopTex() {
  // the previous layer as seen from above: two wall loops and -45° infill
  const R = rookR(PRINT_H);
  const W = 512;
  const px = W / (2 * R);
  return canvasTex(W, W, (g) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, W, W);
    g.save();
    g.beginPath();
    g.arc(W / 2, W / 2, R * px, 0, TAU);
    g.clip();
    g.fillStyle = '#3a1404';
    g.fillRect(0, 0, W, W);
    g.lineCap = 'round';
    g.strokeStyle = '#e8681c';
    g.lineWidth = 0.4 * px;
    for (const r of [R - 0.225, R - 0.675]) {
      g.beginPath();
      g.arc(W / 2, W / 2, r * px, 0, TAU);
      g.stroke();
    }
    const ri = R - 1.0;
    for (let c = -7.5; c <= 7.6; c += 3) {
      const L = Math.sqrt(Math.max(0, ri * ri - c * c));
      // -45° lines: direction (1,-1)/√2, offset along (1,1)/√2
      const cx = W / 2 + c * Math.SQRT1_2 * px;
      const cy = W / 2 + c * Math.SQRT1_2 * px;
      g.beginPath();
      g.moveTo(cx - L * Math.SQRT1_2 * px, cy + L * Math.SQRT1_2 * px);
      g.lineTo(cx + L * Math.SQRT1_2 * px, cy - L * Math.SQRT1_2 * px);
      g.stroke();
    }
    g.restore();
  });
}

function lcdTex() {
  return canvasTex(256, 160, (g, w, h) => {
    g.fillStyle = '#06121f';
    g.fillRect(0, 0, w, h);
    g.fillStyle = '#9fd6ff';
    g.font = 'bold 20px sans-serif';
    g.fillText('rook.gcode', 14, 32);
    g.font = '16px sans-serif';
    g.fillText('Nozzle  210 / 210 °C', 14, 64);
    g.fillText('Bed       60 / 60 °C', 14, 88);
    g.fillText('Layer 121 / 250', 14, 112);
    g.fillStyle = '#18324a';
    g.fillRect(14, 126, w - 28, 14);
    g.fillStyle = '#ff7a1a';
    g.fillRect(14, 126, (w - 28) * 0.48, 14);
  });
}

function thermalTex() {
  const H = 512;
  return canvasTex(4, H, (g) => {
    for (let py = 0; py < H; py++) {
      const y = TH_Y1 - ((TH_Y1 - TH_Y0) * py) / (H - 1);
      const [r, gg, b] = iron((hotendT(y) - 25) / (215 - 25));
      g.fillStyle = `rgb(${r},${gg},${b})`;
      g.fillRect(0, py, 4, 1);
    }
  });
}

function biteTex() {
  // one bite mark per drive-gear tooth pitch, on the gear side (u -> 1 = -x)
  return canvasTex(
    64,
    32,
    (g, w, h) => {
      g.fillStyle = '#ff7a1a';
      g.fillRect(0, 0, w, h);
      g.fillStyle = 'rgba(90,26,0,0.92)';
      g.beginPath();
      g.moveTo(w, h * 0.22);
      g.lineTo(w * 0.66, h * 0.46);
      g.lineTo(w, h * 0.7);
      g.closePath();
      g.fill();
      g.fillStyle = 'rgba(255,190,140,0.5)';
      g.fillRect(w * 0.7, h * 0.7, w * 0.3, h * 0.05);
    },
    { repeat: true },
  );
}

function beadMaps() {
  // extruded-line surface: fine ripple across the line + mottling (1 mm tile)
  const r = rng(11);
  const N = 128;
  const ph = Array.from({ length: 6 }, () => r() * TAU);
  const H = (x, y) =>
    0.5 * Math.sin((TAU * x * 4) / N + ph[0]) +
    0.25 * Math.sin((TAU * x * 9) / N + ph[1] + 0.6 * Math.sin((TAU * y) / N)) +
    0.15 * Math.sin((TAU * (x * 3 + y * 2)) / N + ph[2]);
  const normal = heightNormalTex(N, 32, (x, y) => H(x, (y * N) / 32), 0.5);
  const map = canvasTex(
    N,
    32,
    (g) => {
      for (let y = 0; y < 32; y++) {
        for (let x = 0; x < N; x++) {
          const k = 0.93 + 0.07 * H(x, (y * N) / 32);
          g.fillStyle = `rgb(${Math.round(255 * Math.min(1, k))},${Math.round(118 * k)},${Math.round(30 * k)})`;
          g.fillRect(x, y, 1, 1);
        }
      }
    },
    { repeat: true },
  );
  return { map, normal };
}

// 1-D heat ramp along a bead: u in [0,1] maps x in [x0, x1]; fn(x) -> 0..1
function heatRampTex(x0, x1, fn) {
  const W = 256;
  return canvasTex(W, 2, (g) => {
    for (let i = 0; i < W; i++) {
      const x = x0 + ((x1 - x0) * i) / (W - 1);
      const e = clamp01(fn(x));
      // fresh-melt yellow -> orange -> dark as it cools
      const r = Math.round(255 * Math.min(1, e * 1.6));
      const gg = Math.round(200 * Math.pow(e, 1.5));
      const b = Math.round(90 * Math.pow(e, 3));
      g.fillStyle = `rgb(${r},${gg},${b})`;
      g.fillRect(i, 0, 1, 2);
    }
  });
}

// ------------------------------------------------------------- geometry kit
// Half-section of a lathe-turned part: the profile [[r, y], ...] is a CLOSED
// counter-clockwise polygon in the (r, y) half-plane; the back half (z <= 0)
// is revolved and both cut faces (x = ±r, z = 0) are capped.
function sectionLathe(profile, mat, capMat, segs = 40) {
  const g = new THREE.Group();
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  pts.push(pts[0].clone());
  const shell = new THREE.Mesh(new THREE.LatheGeometry(pts, segs, Math.PI / 2, Math.PI), mat);
  shell.castShadow = true;
  shell.receiveShadow = true;
  g.add(shell);
  for (const s of [1, -1]) {
    const shape = new THREE.Shape(profile.map(([r, y]) => new THREE.Vector2(s * r, y)));
    const cap = new THREE.Mesh(new THREE.ShapeGeometry(shape), capMat);
    cap.position.z = 0.002;
    g.add(cap);
  }
  return g;
}

// back half of a straight cylinder along y, with UVs for a scrolling texture
// (u: 0 at +x .. 1 at -x around the back, v: y / period) and its cut face
function halfCylinder(r, y0, y1, mat, capMat, period = 1, ny = 60, nt = 16) {
  const g = new THREE.Group();
  const pos = [];
  const uv = [];
  const idx = [];
  for (let j = 0; j <= ny; j++) {
    const y = y0 + ((y1 - y0) * j) / ny;
    for (let i = 0; i <= nt; i++) {
      const th = Math.PI / 2 + (Math.PI * i) / nt;
      pos.push(r * Math.sin(th), y, r * Math.cos(th));
      uv.push(i / nt, y / period);
    }
  }
  for (let j = 0; j < ny; j++) {
    for (let i = 0; i < nt; i++) {
      const a = j * (nt + 1) + i;
      const b = a + nt + 1;
      idx.push(a, b, a + 1, a + 1, b, b + 1);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const body = new THREE.Mesh(geo, mat);
  body.castShadow = true;
  g.add(body);
  const capGeo = new THREE.PlaneGeometry(2 * r, y1 - y0, 1, 1);
  {
    const p = capGeo.attributes.position;
    const cu = capGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) cu.setXY(i, (1 - p.getX(i) / r) / 2, (p.getY(i) + (y0 + y1) / 2) / period);
  }
  const cap = new THREE.Mesh(capGeo, capMat);
  cap.position.set(0, (y0 + y1) / 2, 0.002);
  g.add(cap);
  return { g, body, cap };
}

// stadium bead cross-section (z, y) around its centre: flat top/bottom,
// semicircular sides of radius h/2
function stadium(w, h, n = 8) {
  const r = h / 2;
  const c = w / 2 - r;
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / n;
    pts.push([c + r * Math.cos(a), r * Math.sin(a)]);
  }
  for (let i = 0; i <= n; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / n;
    pts.push([-c + r * Math.cos(a), r * Math.sin(a)]);
  }
  return pts;
}
// a printed line running along x from x0 to x1. uv.u = x / period (scrolls),
// uv1.u = (x - x0) / (x1 - x0) (fixed heat ramp). `nose` rounds the x1 end.
function beadGeo(x0, x1, w, h, { period = 1, nose = 0, nx = 90 } = {}) {
  const prof = stadium(w, h);
  const m = prof.length;
  const pos = [];
  const uv = [];
  const uv1 = [];
  const idx = [];
  for (let ix = 0; ix <= nx; ix++) {
    const x = x0 + ((x1 - x0) * ix) / nx;
    let s = 1;
    if (nose > 0 && x > x1 - nose) s = Math.sqrt(Math.max(0, 1 - ((x - (x1 - nose)) / nose) ** 2));
    for (let j = 0; j <= m; j++) {
      const [pz, py] = prof[j % m];
      pos.push(x, py * Math.max(s, 0.35), pz * s);
      uv.push(x / period, j / m);
      uv1.push((x - x0) / (x1 - x0), j / m);
    }
  }
  for (let ix = 0; ix < nx; ix++) {
    for (let j = 0; j < m; j++) {
      const a = ix * (m + 1) + j;
      const b = a + m + 1;
      idx.push(a, a + 1, b, a + 1, b + 1, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('uv1', new THREE.Float32BufferAttribute(uv1, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}
// flat stadium cap facing +x (a cut through a bead)
function beadCap(w, h, mat) {
  const shape = new THREE.Shape(stadium(w, h).map(([z, y]) => new THREE.Vector2(-z, y)));
  const geo = new THREE.ShapeGeometry(shape);
  geo.rotateY(Math.PI / 2);
  return new THREE.Mesh(geo, mat);
}

// 20 x 20 (or 20 x 40) V-slot profile, extruded `len` along z, centred
function vslot(len, mat, tall = false) {
  const w = 20;
  const h = tall ? 40 : 20;
  const s = new THREE.Shape();
  // outline with a 6 mm-wide, 4 mm-deep slot centred on every 20 mm of face
  const pts = [];
  const hw = w / 2;
  const hh = h / 2;
  const faceSlots = (a0, a1) => {
    const res = [];
    for (let c = a0 + 10; c < a1; c += 20) res.push(c);
    return res;
  };
  // bottom edge, left -> right
  pts.push([-hw, -hh]);
  for (const c of faceSlots(-hw, hw)) pts.push([c - 3, -hh], [c - 3, -hh + 4], [c + 3, -hh + 4], [c + 3, -hh]);
  pts.push([hw, -hh]);
  for (const c of faceSlots(-hh, hh)) pts.push([hw, c - 3], [hw - 4, c - 3], [hw - 4, c + 3], [hw, c + 3]);
  pts.push([hw, hh]);
  for (const c of faceSlots(-hw, hw).reverse()) pts.push([c + 3, hh], [c + 3, hh - 4], [c - 3, hh - 4], [c - 3, hh]);
  pts.push([-hw, hh]);
  for (const c of faceSlots(-hh, hh).reverse()) pts.push([-hw, c + 3], [-hw + 4, c + 3], [-hw + 4, c - 3], [-hw, c - 3]);
  pts.forEach(([x, y], i) => (i ? s.lineTo(x, y) : s.moveTo(x, y)));
  s.closePath();
  for (let c = -hh + 10; c < hh; c += 20) {
    const hole = new THREE.Path();
    hole.absarc(0, c, 2.1, 0, TAU, true);
    s.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: len,
    bevelEnabled: true,
    bevelThickness: 0.6,
    bevelSize: 0.5,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geo.translate(0, 0, -len / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  return mesh;
}

// closed belt loop around two pulleys (centres ±half along local x, radius r),
// in the local XY plane, ribbon width along local z. uv.u = arc length / 2 mm.
function beltLoop(half, r, width, mat) {
  const pts = [];
  const N = 40;
  for (let i = 0; i <= 20; i++) pts.push([-half + (2 * half * i) / 20, -r, 0, -1]);
  for (let i = 1; i <= N; i++) {
    const a = -Math.PI / 2 + (Math.PI * i) / N;
    pts.push([half + r * Math.cos(a), r * Math.sin(a), Math.cos(a), Math.sin(a)]);
  }
  for (let i = 1; i <= 20; i++) pts.push([half - (2 * half * i) / 20, r, 0, 1]);
  for (let i = 1; i <= N; i++) {
    const a = Math.PI / 2 + (Math.PI * i) / N;
    pts.push([-half + r * Math.cos(a), r * Math.sin(a), Math.cos(a), Math.sin(a)]);
  }
  const pos = [];
  const uv = [];
  const idx = [];
  let s = 0;
  for (let i = 0; i < pts.length; i++) {
    if (i) s += Math.hypot(pts[i][0] - pts[i - 1][0], pts[i][1] - pts[i - 1][1]);
    const [x, y] = pts[i];
    pos.push(x, y, -width / 2, x, y, width / 2);
    uv.push(s / 2, 0, s / 2, 1);
  }
  for (let i = 0; i < pts.length - 1; i++) {
    const a = i * 2;
    idx.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

function cylZ(r, len, mat, seg = 28) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.rotation.x = Math.PI / 2;
  m.castShadow = true;
  return m;
}
function cylX(r, len, mat, seg = 28) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.rotation.z = Math.PI / 2;
  m.castShadow = true;
  return m;
}
function cylY(r, len, mat, seg = 28) {
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.castShadow = true;
  return m;
}

// NEMA 17 stepper: black stack between two aluminium end caps, axis along +z
function stepper(depth, black, alu, shaftMat, shaftLen = 22) {
  const g = new THREE.Group();
  const cap = 7;
  const front = beveledBox(42, 42, cap, alu, 2.4);
  front.position.z = depth / 2 - cap / 2;
  const back = beveledBox(42, 42, cap, alu, 2.4);
  back.position.z = -depth / 2 + cap / 2;
  const mid = beveledBox(41, 41, depth - 2 * cap, black, 1.5);
  g.add(front, back, mid);
  const boss = cylZ(11, 2, alu, 32);
  boss.position.z = depth / 2 + 1;
  g.add(boss);
  const shaft = cylZ(2.5, shaftLen, shaftMat, 16);
  shaft.position.z = depth / 2 + shaftLen / 2;
  g.add(shaft);
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const screw = cylZ(1.6, 1, shaftMat, 10);
    screw.position.set(sx * 15.5, sy * 15.5, depth / 2 + 0.3);
    g.add(screw);
  }
  return g;
}

// axial fan: frame plates with a round opening + spinning blades, axis +z
function axialFan(size, depth, frameMat, bladeMat, blades = 7) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  const hs = size / 2;
  s.moveTo(-hs, -hs);
  s.lineTo(hs, -hs);
  s.lineTo(hs, hs);
  s.lineTo(-hs, hs);
  s.closePath();
  const hole = new THREE.Path();
  hole.absarc(0, 0, hs * 0.92, 0, TAU, true);
  s.holes.push(hole);
  const plateGeo = new THREE.ExtrudeGeometry(s, { depth: depth * 0.18, bevelEnabled: false, curveSegments: 24 });
  for (const z of [-depth / 2, depth / 2 - depth * 0.18]) {
    const p = new THREE.Mesh(plateGeo, frameMat);
    p.position.z = z;
    p.castShadow = true;
    g.add(p);
  }
  for (const [sx, sy] of [[1, 1], [1, -1], [-1, 1], [-1, -1]]) {
    const post = beveledBox(size * 0.12, size * 0.12, depth, frameMat, 0.6);
    post.position.set(sx * hs * 0.94, sy * hs * 0.94, 0);
    g.add(post);
  }
  const rotor = new THREE.Group();
  const hub = cylZ(size * 0.2, depth * 0.6, bladeMat, 24);
  rotor.add(hub);
  for (let i = 0; i < blades; i++) {
    const a = (i / blades) * TAU;
    const pivot = new THREE.Group();
    pivot.rotation.z = a;
    const blade = beveledBox(size * 0.28, size * 0.16, depth * 0.08, bladeMat, 0.4);
    blade.position.x = size * 0.33;
    blade.rotation.x = 0.55;
    pivot.add(blade);
    rotor.add(pivot);
  }
  g.add(rotor);
  // central strut holding the motor hub
  const strut = beveledBox(size * 0.9, size * 0.05, depth * 0.12, frameMat, 0.3);
  strut.rotation.z = Math.PI / 4;
  strut.position.z = -depth / 2 + depth * 0.06;
  g.add(strut);
  return { g, rotor };
}

// =============================================================================
export function buildPrinter({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // ---------------------------------------------------------------- materials
  const PLA = 0xff6d16;
  const pla = new THREE.MeshPhysicalMaterial({
    color: PLA,
    roughness: 0.42,
    metalness: 0,
    sheen: 0.35,
    sheenColor: new THREE.Color(0xffb070),
    sheenRoughness: 0.5,
  });
  const plaLayers = pla.clone();
  plaLayers.normalMap = layerNormal();
  plaLayers.normalScale = new THREE.Vector2(0.6, 0.6);
  const extrusionMat = new THREE.MeshStandardMaterial({ color: 0x1d2025, metalness: 0.55, roughness: 0.42 });
  const blackPlastic = materials.polymer(0x1a1c20);
  const greyPlastic = materials.polymer(0x2b2f36);
  const accentPlastic = materials.polymer(0xff7a1a);
  accentPlastic.roughness = 0.55;
  const motorBlack = new THREE.MeshStandardMaterial({ color: 0x17181b, metalness: 0.3, roughness: 0.55 });
  const motorAlu = new THREE.MeshStandardMaterial({ color: 0xb4bac2, metalness: 0.9, roughness: 0.38 });
  const rodMat = new THREE.MeshStandardMaterial({ color: 0xd8dde3, metalness: 1, roughness: 0.18 });
  const steelMat = new THREE.MeshStandardMaterial({ color: 0x9aa2ad, metalness: 0.9, roughness: 0.35 });
  const brass = new THREE.MeshStandardMaterial({ color: 0xb4832f, metalness: 1, roughness: 0.34 });
  const aluBlock = new THREE.MeshStandardMaterial({ color: 0xbfc5cc, metalness: 0.95, roughness: 0.42 });
  const rubber = materials.rubber(0x141518);
  const sockMat = new THREE.MeshStandardMaterial({ color: 0x3a3d42, metalness: 0, roughness: 0.85 });
  const beltMat = new THREE.MeshStandardMaterial({ map: beltTex(), roughness: 0.8, metalness: 0, side: THREE.DoubleSide });
  const beltMatY = beltMat.clone();
  beltMatY.map = beltTex();
  const screwTex = leadScrewTex();
  screwTex.repeat.set(1, 364 / 8);
  const screwMat = new THREE.MeshStandardMaterial({ map: screwTex, metalness: 0.9, roughness: 0.35 });
  // cut faces of the B/C sections: flat, bright, slightly less metallic
  const cutAlu = new THREE.MeshStandardMaterial({ color: 0xe1e5ea, metalness: 0.55, roughness: 0.32, side: THREE.DoubleSide });
  const cutBrass = new THREE.MeshStandardMaterial({ color: 0xd2a253, metalness: 0.6, roughness: 0.3, side: THREE.DoubleSide });
  const cutSteel = new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.55, roughness: 0.34, side: THREE.DoubleSide });
  const ptfe = new THREE.MeshStandardMaterial({ color: 0xf2f2ee, metalness: 0, roughness: 0.5, side: THREE.DoubleSide });
  const melt = new THREE.MeshPhysicalMaterial({
    color: 0xff7a1a,
    emissive: 0xff5a00,
    emissiveIntensity: 0.25,
    roughness: 0.18,
    clearcoat: 0.6,
    clearcoatRoughness: 0.2,
    side: THREE.DoubleSide,
  });
  const brassS = brass.clone();
  brassS.side = THREE.DoubleSide;
  const aluS = aluBlock.clone();
  aluS.side = THREE.DoubleSide;
  const steelS = steelMat.clone();
  steelS.side = THREE.DoubleSide;
  const plaS = pla.clone();
  plaS.side = THREE.DoubleSide;
  const plaCut = new THREE.MeshStandardMaterial({ color: 0xffa060, roughness: 0.6, side: THREE.DoubleSide });

  // =========================================================================
  //  A — THE PRINTER
  // =========================================================================
  const plinth = studioPlinth({ w: 3.1, d: 2.9 });
  group.add(plinth);
  const A = new THREE.Group();
  A.scale.setScalar(SA);
  A.position.y = 0.26;
  group.add(A);

  // --- base: rubber feet + 40x40 rails (two stacked 20-slot rows) ----------
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = cylY(12, 8, rubber, 24);
      foot.position.set(sx * 200, 4, sz * 195);
      A.add(foot);
    }
  }
  for (const sz of [-1, 1]) {
    const r = vslot(480, extrusionMat, true);
    r.rotation.y = Math.PI / 2;
    r.position.set(0, 28, sz * 195);
    A.add(r);
  }
  for (const sx of [-1, 1]) {
    const r = vslot(350, extrusionMat, true);
    r.position.set(sx * 200, 28, 0);
    A.add(r);
  }
  // control box with LCD + knob, front right
  const lcdBox = new THREE.Group();
  lcdBox.position.set(150, 40, 228);
  lcdBox.rotation.x = -0.32;
  A.add(lcdBox);
  const lcdBody = beveledBox(96, 58, 22, blackPlastic, 4);
  lcdBox.add(lcdBody);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(66, 41),
    new THREE.MeshStandardMaterial({ color: 0x000000, emissive: 0xffffff, emissiveMap: lcdTex(), emissiveIntensity: 0.55, roughness: 0.3 }),
  );
  screen.position.set(-10, 0, 11.2);
  lcdBox.add(screen);
  const knob = cylZ(8, 9, accentPlastic, 24);
  knob.position.set(34, -8, 14);
  lcdBox.add(knob);

  // --- uprights, top bar ----------------------------------------------------
  for (const sx of [-1, 1]) {
    const up = vslot(472, extrusionMat, true);
    up.rotation.x = Math.PI / 2;
    up.position.set(sx * 230, 8 + 236, -30);
    A.add(up);
  }
  const topBar = vslot(480, extrusionMat);
  topBar.rotation.y = Math.PI / 2;
  topBar.position.set(0, 490, -30);
  A.add(topBar);
  for (const sx of [-1, 1]) {
    const corner = beveledBox(22, 24, 44, blackPlastic, 3);
    corner.position.set(sx * 230, 490, -30);
    A.add(corner);
  }

  // --- Z: motors at the base, lead screws, top bearings --------------------
  const leadScrews = [];
  for (const sx of [-1, 1]) {
    const zm = stepper(40, motorBlack, motorAlu, steelMat);
    zm.rotation.x = -Math.PI / 2; // shaft up
    zm.position.set(sx * LS_X, 48 + 20, LS_Z);
    A.add(zm);
    const coup = cylY(9, 25, aluBlock, 20);
    coup.position.set(sx * LS_X, 100, LS_Z);
    A.add(coup);
    const ls = cylY(4, 364, screwMat, 20);
    ls.position.set(sx * LS_X, 112 + 182, LS_Z);
    A.add(ls);
    leadScrews.push(ls);
    const brg = beveledBox(26, 12, 22, blackPlastic, 2);
    brg.position.set(sx * LS_X, 474, LS_Z);
    A.add(brg);
  }

  // --- Y: rods, belt, motor at the back -------------------------------------
  for (const sx of [-1, 1]) {
    const rod = cylZ(4, 400, rodMat, 18);
    rod.position.set(sx * 60, 60, 0);
    A.add(rod);
    for (const sz of [-1, 1]) {
      const holder = beveledBox(22, 20, 14, blackPlastic, 2);
      holder.position.set(sx * 60, 58, sz * 195);
      A.add(holder);
    }
  }
  const yBelt = beltLoop(218, XP_R, 6, beltMatY);
  // local x -> world z (motor end at -z), local y -> world y, width -> world x
  yBelt.rotation.y = Math.PI / 2;
  yBelt.position.set(0, 58, -18);
  A.add(yBelt);
  const yMotor = stepper(34, motorBlack, motorAlu, steelMat);
  yMotor.rotation.y = -Math.PI / 2; // shaft toward -x
  yMotor.position.set(29, 58, -236);
  A.add(yMotor);
  const yPulley = gear({ teeth: 20, radius: 7.2, thickness: 7, toothDepth: 0.9 }, aluBlock);
  yPulley.rotation.y = Math.PI / 2;
  const yPulleyG = new THREE.Group();
  yPulleyG.position.set(0, 58, -236);
  yPulleyG.add(yPulley);
  A.add(yPulleyG);
  const yIdler = cylX(7, 8, aluBlock, 24);
  yIdler.position.set(0, 58, 200);
  A.add(yIdler);
  const yIdlerMount = beveledBox(24, 22, 12, blackPlastic, 2);
  yIdlerMount.position.set(0, 50, 204);
  A.add(yIdlerMount);

  // --- bed carriage (moves along z) -----------------------------------------
  const bed = new THREE.Group();
  A.add(bed);
  const carriage = beveledBox(214, 6, 214, aluBlock, 2);
  carriage.position.y = 71;
  bed.add(carriage);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const lm = cylZ(7.5, 24, steelMat, 20);
      lm.position.set(sx * 60, 60, sz * 70);
      bed.add(lm);
      const spring = coil({ turns: 5, radius: 4.2, length: 8, wireRadius: 0.7 }, steelMat).mesh;
      spring.position.set(sx * 100, 78, sz * 100);
      bed.add(spring);
      const knobB = cylY(10, 6, accentPlastic, 24);
      knobB.position.set(sx * 100, 64, sz * 100);
      bed.add(knobB);
    }
  }
  const clampY = beveledBox(18, 6, 14, blackPlastic, 1.5);
  clampY.position.set(0, 66, 0);
  bed.add(clampY);
  const heatbed = beveledBox(235, 2, 235, new THREE.MeshStandardMaterial({ color: 0x141619, roughness: 0.6 }), 1);
  heatbed.position.y = 83;
  bed.add(heatbed);
  const trace = heaterTraceTex();
  const traceMat = new THREE.MeshStandardMaterial({
    map: trace.map,
    emissiveMap: trace.emissive,
    emissive: 0xff6a1a,
    emissiveIntensity: 0,
    roughness: 0.45,
    metalness: 0.1,
  });
  const tracePlane = new THREE.Mesh(new THREE.PlaneGeometry(233, 233), traceMat);
  tracePlane.rotation.x = -Math.PI / 2;
  tracePlane.position.y = 84.05;
  bed.add(tracePlane);

  // the removable steel sheet + the part on it (lifts in the bed step)
  const sheet = new THREE.Group();
  bed.add(sheet);
  const sheetSteel = beveledBox(235, 0.9, 235, steelMat, 0.4);
  sheetSteel.position.y = 84.5;
  sheet.add(sheetSteel);
  const pei = peiMaps(5);
  pei.map.repeat.set(9, 9);
  pei.normal.repeat.set(9, 9);
  const peiMat = new THREE.MeshStandardMaterial({
    map: pei.map,
    normalMap: pei.normal,
    normalScale: new THREE.Vector2(0.8, 0.8),
    metalness: 0.35,
    roughness: 0.62,
  });
  const peiTop = new THREE.Mesh(new THREE.PlaneGeometry(234, 234), peiMat);
  peiTop.rotation.x = -Math.PI / 2;
  peiTop.position.y = 85.0;
  peiTop.receiveShadow = true;
  sheet.add(peiTop);
  const tab = beveledBox(40, 0.9, 14, steelMat, 0.4);
  tab.position.set(0, 84.5, 122);
  sheet.add(tab);

  // the half-printed rook (120 layers), with layer-line ridges
  const rookProf = [new THREE.Vector2(0, 0)];
  for (const [r, y] of ROOK) if (y < PRINT_H) rookProf.push(new THREE.Vector2(r, y));
  rookProf.push(new THREE.Vector2(rookR(PRINT_H), PRINT_H));
  const rookGeo = new THREE.LatheGeometry(rookProf, 72);
  {
    const p = rookGeo.attributes.position;
    const uv = rookGeo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, 0.5, p.getY(i) / LAYER);
  }
  const rook = new THREE.Mesh(rookGeo, plaLayers);
  rook.position.y = BED_TOP;
  rook.castShadow = true;
  rook.receiveShadow = true;
  sheet.add(rook);
  const rookTop = new THREE.Mesh(
    new THREE.CircleGeometry(rookR(PRINT_H), 72),
    new THREE.MeshStandardMaterial({ map: rookTopTex(), roughness: 0.5, color: 0xffffff }),
  );
  rookTop.rotation.x = -Math.PI / 2;
  rookTop.position.y = BED_TOP + PRINT_H + 0.01;
  sheet.add(rookTop);

  // the hot trail: fresh plastic of the layer being drawn, last ~1.1 s of path
  const TRAIL = 110;
  const trailMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const trail = new THREE.InstancedMesh(new THREE.BoxGeometry(1, 1, 1), trailMat, TRAIL);
  trail.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  trail.frustumCulled = false;
  for (let i = 0; i < TRAIL; i++) trail.setColorAt(i, new THREE.Color(0xffffff));
  sheet.add(trail);

  // --- X gantry (static height while a layer is drawn) ----------------------
  // everything the lead screws lift: gantry, X motor + belt, toolhead
  const zStage = new THREE.Group();
  A.add(zStage);
  const gantry = vslot(410, extrusionMat);
  gantry.rotation.y = Math.PI / 2;
  gantry.position.set(0, GY, -10);
  zStage.add(gantry);
  for (const sx of [-1, 1]) {
    const zb = beveledBox(44, 64, 8, blackPlastic, 2.5);
    zb.position.set(sx * 221, GY, -6);
    zStage.add(zb);
    const nut = beveledBox(18, 14, 26, blackPlastic, 2);
    nut.position.set(sx * LS_X, GY - 22, -22);
    zStage.add(nut);
    const brassNut = cylY(7, 10, brass, 20);
    brassNut.position.set(sx * LS_X, GY - 33, LS_Z);
    zStage.add(brassNut);
  }
  // X motor (shaft down) + pulley, idler on the right, belt loop on top
  const xMount = beveledBox(48, 3, 48, aluBlock, 1);
  xMount.position.set(-XM_X, BELT_Y + 6, -10);
  zStage.add(xMount);
  const xMotor = stepper(38, motorBlack, motorAlu, steelMat, 14);
  xMotor.rotation.x = Math.PI / 2; // shaft toward -y
  xMotor.position.set(-XM_X, BELT_Y + 7.5 + 19, -10);
  zStage.add(xMotor);
  const xPulleyG = new THREE.Group();
  xPulleyG.position.set(-XM_X, BELT_Y, -10);
  zStage.add(xPulleyG);
  const xPulley = gear({ teeth: 20, radius: 7.2, thickness: 7, toothDepth: 0.9 }, aluBlock);
  xPulley.rotation.x = Math.PI / 2;
  xPulleyG.add(xPulley);
  const xIdler = cylY(7, 8, aluBlock, 24);
  xIdler.position.set(XM_X, BELT_Y, -10);
  zStage.add(xIdler);
  const xIdlerMount = beveledBox(26, 4, 26, blackPlastic, 1.2);
  xIdlerMount.position.set(XM_X, BELT_Y + 6, -10);
  zStage.add(xIdlerMount);
  const xBelt = beltLoop(XM_X, XP_R, 6, beltMat);
  xBelt.rotation.x = -Math.PI / 2; // loop in the horizontal plane, width up
  xBelt.position.set(0, BELT_Y, -10);
  zStage.add(xBelt);

  // --- toolhead (moves along x) ---------------------------------------------
  const tool = new THREE.Group();
  zStage.add(tool);
  const plate = beveledBox(62, 120, 5, aluBlock, 1.5);
  plate.position.set(0, 186, 2.5);
  tool.add(plate);
  for (const sx of [-1, 1]) {
    for (const wy of [GY + 21.5, GY - 21.5]) {
      const vw = cylZ(11.5, 6, blackPlastic, 28);
      vw.position.set(sx * 20, wy, -10);
      tool.add(vw);
      const axle = cylZ(2.5, 16, steelMat, 10);
      axle.position.set(sx * 20, wy, -4);
      tool.add(axle);
    }
  }
  const beltClamp = beveledBox(18, 8, 8, blackPlastic, 1.5);
  beltClamp.position.set(0, BELT_Y, -1);
  tool.add(beltClamp);
  // extruder motor behind the plate, drive gear on its shaft inside the housing
  const eMotor = stepper(26, motorBlack, motorAlu, steelMat);
  eMotor.position.set(-4.4, 221, -14);
  tool.add(eMotor);
  const housing = beveledBox(46, 50, 44, blackPlastic, 4);
  housing.position.set(0, 211, 27);
  tool.add(housing);
  const lever = beveledBox(12, 34, 6, accentPlastic, 2);
  lever.position.set(17, 214, 50);
  tool.add(lever);
  const inlet = cylY(4, 8, brass, 16);
  inlet.position.set(0, 240, ZN);
  tool.add(inlet);
  // shroud with the hotend fan on its face
  const shroud = beveledBox(50, 58, 46, greyPlastic, 5);
  shroud.position.set(0, 157.2, ZN);
  tool.add(shroud);
  const fanA = axialFan(40, 10, blackPlastic, blackPlastic);
  fanA.g.position.set(0, 160, ZN + 28);
  tool.add(fanA.g);
  const grille = new THREE.Mesh(new THREE.TorusGeometry(15, 0.8, 8, 40), steelMat);
  grille.position.set(0, 160, ZN + 33.5);
  tool.add(grille);
  const grilleBar = beveledBox(32, 1.4, 1.4, steelMat, 0.3);
  grilleBar.position.set(0, 160, ZN + 33.5);
  tool.add(grilleBar);
  const grilleBar2 = grilleBar.clone();
  grilleBar2.rotation.z = Math.PI / 2;
  tool.add(grilleBar2);
  // part-cooling blower + duct aimed at the nozzle tip
  const blower = beveledBox(16, 40, 40, blackPlastic, 3);
  blower.position.set(34, 152, ZN);
  tool.add(blower);
  const duct = beveledBox(10, 30, 18, blackPlastic, 2.5);
  duct.position.set(24, 124, ZN);
  duct.rotation.z = -0.65;
  tool.add(duct);
  // hotend below the shroud: silicone sock over the block, brass nozzle
  const sock = beveledBox(23, 13, 19, sockMat, 3);
  sock.position.set(4, NOZ_Y + 13.3, ZN);
  tool.add(sock);
  const nozzleA = new THREE.Mesh(
    new THREE.LatheGeometry([[0.2, 0], [0.5, 0], [3.2, 4], [3.2, 4.2], [4, 4.2], [4, 7.5], [3, 7.5]].map(([r, y]) => new THREE.Vector2(r, y)), 6 * 4),
    brass,
  );
  nozzleA.position.set(0, NOZ_Y, ZN);
  nozzleA.castShadow = true;
  tool.add(nozzleA);
  const cable = new THREE.Mesh(
    new THREE.TubeGeometry(
      new THREE.CatmullRomCurve3([
        new THREE.Vector3(20, 236, 20),
        new THREE.Vector3(26, 262, 0),
        new THREE.Vector3(10, 290, -40),
      ]),
      20,
      3,
      8,
    ),
    blackPlastic,
  );
  tool.add(cable);

  // --- spool on the top bar + filament to the extruder ----------------------
  const spool = new THREE.Group();
  spool.position.set(-120, 615, -30);
  A.add(spool);
  const post = cylY(6, 112, blackPlastic, 16);
  post.position.set(-120, 558, -72);
  A.add(post);
  const postFoot = beveledBox(18, 10, 56, blackPlastic, 2.5);
  postFoot.position.set(-120, 505, -50);
  A.add(postFoot);
  const axleS = cylZ(4, 80, blackPlastic, 16);
  axleS.position.z = -12;
  spool.add(axleS);
  {
    const s = new THREE.Shape();
    s.absarc(0, 0, 100, 0, TAU, false);
    const hub = new THREE.Path();
    hub.absarc(0, 0, 27, 0, TAU, true);
    s.holes.push(hub);
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * TAU + Math.PI / 6;
      const w = new THREE.Path();
      w.absarc(Math.cos(a) * 52, Math.sin(a) * 52, 16, 0, TAU, true);
      s.holes.push(w);
    }
    const fg = new THREE.ExtrudeGeometry(s, { depth: 3, bevelEnabled: true, bevelThickness: 0.8, bevelSize: 0.8, bevelSegments: 1, curveSegments: 32 });
    for (const z of [-34.5, 31.5]) {
      const f = new THREE.Mesh(fg, blackPlastic);
      f.position.z = z;
      f.castShadow = true;
      spool.add(f);
    }
    const wound = cylZ(80, 62, pla, 64);
    spool.add(wound);
    const hubC = cylZ(28, 64, greyPlastic, 32);
    spool.add(hubC);
  }
  const guide = beveledBox(20, 14, 16, blackPlastic, 2);
  guide.position.set(-60, 507, -30);
  A.add(guide);
  const filaMat = pla.clone();
  let filaMesh = null;
  let filaTx = null;
  function setFilament(tx, zl) {
    const key = tx + zl * 1000;
    if (filaTx !== null && Math.abs(key - filaTx) < 0.05) return;
    filaTx = key;
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(-118, 536, -30),
      new THREE.Vector3(-60, 507, -30),
      new THREE.Vector3(-30 + tx * 0.3, 420 + zl * 0.3, -6),
      new THREE.Vector3(tx, 300 + zl, ZN),
      new THREE.Vector3(tx, 244 + zl, ZN),
    ]);
    const geo = new THREE.TubeGeometry(curve, 64, 1.7, 8, false);
    if (filaMesh) {
      filaMesh.geometry.dispose();
      filaMesh.geometry = geo;
    } else {
      filaMesh = new THREE.Mesh(geo, filaMat);
      A.add(filaMesh);
    }
  }

  // =========================================================================
  //  S — THE SLICER'S STACK
  // =========================================================================
  const S = new THREE.Group();
  S.scale.setScalar(SS);
  S.position.set(0, 0.42, 0);
  group.add(S);
  const Sspin = new THREE.Group();
  S.add(Sspin);
  const SLABS = 25;
  const SLAB_T = 1.4;
  const HI = 12;
  const slabs = [];
  const sliceMat = pla.clone();
  sliceMat.roughness = 0.5;
  const notchHalf = Math.asin(2.6 / 12.4);
  function sliceShapes(ym) {
    const r = rookR(ym);
    if (ym < 43) {
      const s = new THREE.Shape();
      s.absarc(0, 0, r, 0, TAU, false);
      return [s];
    }
    if (ym < 44.5) {
      const s = new THREE.Shape();
      s.absarc(0, 0, r, 0, TAU, false);
      const h = new THREE.Path();
      h.absarc(0, 0, ROOK_IN, 0, TAU, true);
      s.holes.push(h);
      return [s];
    }
    const res = [];
    for (let k = 0; k < 4; k++) {
      const c = (k * Math.PI) / 2 + Math.PI / 4;
      const hs = Math.PI / 4 - notchHalf;
      const s = new THREE.Shape();
      s.absarc(0, 0, r, c - hs, c + hs, false);
      s.absarc(0, 0, ROOK_IN, c + hs, c - hs, true);
      s.closePath();
      res.push(s);
    }
    return res;
  }
  for (let k = 0; k < SLABS; k++) {
    const ym = 2 * k + 1;
    const geo = new THREE.ExtrudeGeometry(sliceShapes(ym), {
      depth: SLAB_T,
      bevelEnabled: true,
      bevelThickness: 0.12,
      bevelSize: 0.12,
      bevelSegments: 1,
      curveSegments: 40,
    });
    geo.rotateX(-Math.PI / 2);
    const m = new THREE.Mesh(geo, sliceMat);
    m.castShadow = true;
    m.receiveShadow = true;
    Sspin.add(m);
    slabs.push(m);
  }
  // the lit layer: wall loops + infill as glowing lines, a ghost of its slab,
  // and the cutting plane
  const hiG = new THREE.Group();
  hiG.rotation.x = 0.62; // tip the slice's top toward the camera
  Sspin.add(hiG);
  const pathGlow = new THREE.MeshStandardMaterial({ color: 0xff8a2a, emissive: 0xff6a10, emissiveIntensity: 1.1, roughness: 0.4 });
  {
    const R = rookR(2 * HI + 1);
    for (const rr of [R - 0.225, R - 0.675]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(rr, 0.28, 8, 120), pathGlow);
      ring.rotation.x = Math.PI / 2;
      ring.position.y = SLAB_T / 2;
      hiG.add(ring);
    }
    const ri = R - 1.0;
    for (let c = -7.5; c <= 7.6; c += 3) {
      const L = Math.sqrt(Math.max(0, ri * ri - c * c));
      const ln = beveledBox(2 * L, 0.5, 0.6, pathGlow, 0.15);
      ln.position.set(-c * Math.SQRT1_2, SLAB_T / 2, c * Math.SQRT1_2);
      ln.rotation.y = -Math.PI / 4;
      hiG.add(ln);
    }
    const ghost = new THREE.Mesh(
      new THREE.CylinderGeometry(R, R, SLAB_T, 72),
      new THREE.MeshStandardMaterial({ color: 0xff8a40, transparent: true, opacity: 0.16, depthWrite: false, roughness: 0.6 }),
    );
    ghost.position.y = SLAB_T / 2;
    hiG.add(ghost);
  }
  slabs[HI].visible = false;
  const cutPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(44, 44),
    new THREE.MeshBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.07, depthWrite: false, side: THREE.DoubleSide }),
  );
  cutPlane.rotation.x = -Math.PI / 2;
  S.add(cutPlane);
  const cutEdge = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.PlaneGeometry(44, 44)),
    new THREE.LineBasicMaterial({ color: 0x8fd3ff, transparent: true, opacity: 0.45 }),
  );
  cutEdge.rotation.x = -Math.PI / 2;
  S.add(cutEdge);
  // anchors that ride the slabs
  const islandAnchor = new THREE.Group();
  islandAnchor.position.set(Math.cos(Math.PI / 4) * 10.5, 0, Math.sin(Math.PI / 4) * 10.5);
  Sspin.add(islandAnchor);
  const lowAnchor = new THREE.Group();
  lowAnchor.position.set(11, 0, 9);
  Sspin.add(lowAnchor);

  // =========================================================================
  //  B — THE TOOLHEAD, CUT IN HALF
  // =========================================================================
  const B = new THREE.Group();
  B.scale.setScalar(SB);
  B.position.set(0, 0.35, 0);
  group.add(B);
  const thermalMeshes = [];
  const regT = (root) => root.traverse((o) => o.isMesh && thermalMeshes.push(o));

  // nozzle (brass): cone tip, threads into the block, 2 mm bore, 0.4 mm hole
  const NOZ_PROF = [
    [0.2, 0], [0.5, 0], [3.2, 4], [3.2, 7.5], [3.0, 7.5], [3.0, 13], [1.0, 13], [1.0, 1.6], [0.2, 0.9],
  ];
  const nozB = sectionLathe(NOZ_PROF, brassS, cutBrass);
  B.add(nozB);
  regT(nozB);
  const hexB = new THREE.Mesh(new THREE.CylinderGeometry(4.04, 4.04, 3.3, 3, 1, false, Math.PI / 2, Math.PI), brassS);
  hexB.position.y = 4 + 1.65;
  B.add(hexB);
  for (const s of [1, -1]) {
    const hc = new THREE.Mesh(new THREE.PlaneGeometry(0.84, 3.3), cutBrass);
    hc.position.set(s * 3.62, 4 + 1.65, 0.002);
    B.add(hc);
    thermalMeshes.push(hc);
  }
  thermalMeshes.push(hexB);
  // heat break: threads into the block, a thin neck, threads into the heatsink
  const HB_PROF = [[1.0, 13], [3.0, 13], [3.0, 19], [1.5, 19], [1.5, 21.5], [3.5, 21.5], [3.5, 33.5], [1.0, 33.5]];
  const hbB = sectionLathe(HB_PROF, steelS, cutSteel);
  B.add(hbB);
  regT(hbB);
  // heatsink: 10 fins, groove-mount collar on top
  const hsProf = [[3.5, 21.5]];
  for (let i = 0; i < 10; i++) {
    const y0 = 21.5 + 2.2 * i;
    hsProf.push([11.15, y0], [11.15, y0 + 1.0], [5, y0 + 1.0], [5, y0 + 2.2]);
  }
  hsProf.pop();
  hsProf.push([5, 42.3], [8, 42.3], [8, 44.5], [6, 44.5], [6, 46.2], [8, 46.2], [8, 48], [2.0, 48], [2.0, 33.5], [3.5, 33.5]);
  const hsB = sectionLathe(hsProf, aluS, cutAlu, 56);
  B.add(hsB);
  regT(hsB);
  // heater block halves either side of the nozzle/heat-break thread column
  {
    const depth = 8;
    const left = new THREE.Shape();
    left.moveTo(-6, 7.5);
    left.lineTo(-3, 7.5);
    left.lineTo(-3, 19);
    left.lineTo(-6, 19);
    left.closePath();
    const right = new THREE.Shape();
    right.moveTo(3, 7.5);
    right.lineTo(14, 7.5);
    right.lineTo(14, 19);
    right.lineTo(3, 19);
    right.closePath();
    const hc = new THREE.Path();
    hc.absarc(9, 14.4, 3.05, 0, TAU, true);
    right.holes.push(hc);
    const ht = new THREE.Path();
    ht.absarc(9, 9.6, 1.55, 0, TAU, true);
    right.holes.push(ht);
    for (const sh of [left, right]) {
      const geo = new THREE.ExtrudeGeometry(sh, { depth, bevelEnabled: false, curveSegments: 24 });
      geo.translate(0, 0, -depth);
      const m = new THREE.Mesh(geo, [cutAlu, aluS]);
      m.castShadow = true;
      B.add(m);
      thermalMeshes.push(m);
    }
  }
  // heater cartridge: Ø6 steel sheath, MgO filling, nichrome coil
  const cartG = new THREE.Group();
  cartG.position.set(9, 14.4, 0);
  B.add(cartG);
  {
    const body = cylZ(3, 12, steelS, 28);
    body.position.z = -6;
    cartG.add(body);
    thermalMeshes.push(body);
    const face = new THREE.Mesh(new THREE.CircleGeometry(2.9, 28), new THREE.MeshStandardMaterial({ color: 0xeceae2, roughness: 0.8 }));
    face.position.z = 0.01;
    cartG.add(face);
    const sheathRing = new THREE.Mesh(new THREE.RingGeometry(2.6, 3.0, 32), cutSteel);
    sheathRing.position.z = 0.02;
    cartG.add(sheathRing);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const dot = new THREE.Mesh(new THREE.CircleGeometry(0.32, 10), new THREE.MeshStandardMaterial({ color: 0xc08050, metalness: 0.8, roughness: 0.35 }));
      dot.position.set(Math.cos(a) * 1.6, Math.sin(a) * 1.6, 0.03);
      cartG.add(dot);
    }
    const leadsGeo = new THREE.CylinderGeometry(0.5, 0.5, 18, 8);
    for (const dx of [-0.9, 0.9]) {
      const lead = new THREE.Mesh(leadsGeo, new THREE.MeshStandardMaterial({ color: 0x8a1c1c, roughness: 0.6 }));
      lead.rotation.x = Math.PI / 2;
      lead.position.set(dx, 0, -21);
      cartG.add(lead);
    }
  }
  // thermistor: glass bead in a Ø3 cartridge
  const thermG = new THREE.Group();
  thermG.position.set(9, 9.6, 0);
  B.add(thermG);
  {
    const body = cylZ(1.5, 10, steelS, 20);
    body.position.z = -5;
    thermG.add(body);
    thermalMeshes.push(body);
    const face = new THREE.Mesh(new THREE.CircleGeometry(1.42, 20), new THREE.MeshStandardMaterial({ color: 0x2a2c30, roughness: 0.5 }));
    face.position.z = 0.01;
    thermG.add(face);
    const bead = new THREE.Mesh(new THREE.CircleGeometry(0.55, 16), new THREE.MeshStandardMaterial({ color: 0x8a6a2a, roughness: 0.3 }));
    bead.position.z = 0.02;
    thermG.add(bead);
  }
  // PTFE liner from the heat break up into the extruder outlet
  const ptfeB = sectionLathe([[1.0, 33.5], [2.0, 33.5], [2.0, 57], [1.0, 57]], ptfe, ptfe, 24);
  B.add(ptfeB);
  regT(ptfeB);
  const coupler = sectionLathe([[2.05, 51], [4.5, 51], [4.5, 53], [3.6, 53], [3.6, 58], [2.05, 58]], brassS, cutBrass, 24);
  B.add(coupler);
  regT(coupler);

  // filament: plain above the gear, bite-marked below it, melt from y 17 down
  const GEAR_Y = 72;
  const PITCH = (TAU * 3.5) / 24; // tooth pitch at the 7 mm effective diameter
  const filaTop = halfCylinder(0.875, GEAR_Y, 98, plaS, plaCut, 10, 20);
  B.add(filaTop.g);
  regT(filaTop.g);
  const bite = biteTex();
  const biteMat = new THREE.MeshStandardMaterial({ map: bite, roughness: 0.45, side: THREE.DoubleSide });
  const filaLow = halfCylinder(0.875, 17, GEAR_Y, biteMat, biteMat, PITCH, 160);
  B.add(filaLow.g);
  regT(filaLow.g);
  const meltB = sectionLathe(
    [[0, -0.5], [0.2, -0.5], [0.2, 0.9], [1.0, 1.6], [1.0, 17.4], [0, 17.4]],
    melt,
    melt,
    24,
  );
  B.add(meltB);
  regT(meltB);

  // extruder: stepper behind, 24-tooth hobbed drive gear (groove cut at z=0)
  const motorAluDark = new THREE.MeshStandardMaterial({ color: 0x5c626b, metalness: 0.85, roughness: 0.5 });
  const motorB = stepper(34, motorBlack, motorAluDark, steelMat, 9.5);
  motorB.position.set(-4.375, GEAR_Y, -10 - 17);
  B.add(motorB);
  regT(motorB);
  const gearG = new THREE.Group();
  gearG.position.set(-4.375, GEAR_Y, 0);
  B.add(gearG);
  {
    const flange = cylZ(4.5, 4.3, steelMat, 40);
    flange.position.z = -1.2 - 2.15;
    gearG.add(flange);
    const groove = gear({ teeth: 24, radius: 3.62, thickness: 1.2, toothDepth: 0.38 }, cutSteel);
    groove.position.z = -0.6;
    gearG.add(groove);
    const shaft = cylZ(2.5, 6, steelMat, 16);
    shaft.position.z = -8;
    gearG.add(shaft);
  }
  regT(gearG);
  // idler: 623 bearing (10 mm OD) on a spring-loaded lever, half-sectioned
  const BR = 5;
  const bearG = new THREE.Group();
  bearG.position.set(0.875 + BR - 0.1, GEAR_Y, 0);
  B.add(bearG);
  {
    const ring = (r0, r1) => {
      const s = new THREE.Shape();
      s.absarc(0, 0, r1, 0, TAU, false);
      const h = new THREE.Path();
      h.absarc(0, 0, r0, 0, TAU, true);
      s.holes.push(h);
      const geo = new THREE.ExtrudeGeometry(s, { depth: 2, bevelEnabled: false, curveSegments: 32 });
      geo.translate(0, 0, -2);
      return new THREE.Mesh(geo, [cutSteel, steelS]);
    };
    bearG.add(ring(4.0, BR), ring(1.5, 2.5));
    const ballGeo = new THREE.SphereGeometry(0.72, 14, 10, Math.PI, Math.PI);
    const ballCap = new THREE.CircleGeometry(0.72, 14);
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * TAU;
      const b = new THREE.Mesh(ballGeo, steelS);
      b.position.set(Math.cos(a) * 3.25, Math.sin(a) * 3.25, -1);
      bearG.add(b);
      const c = new THREE.Mesh(ballCap, cutSteel);
      c.position.set(Math.cos(a) * 3.25, Math.sin(a) * 3.25, 0.002);
      bearG.add(c);
    }
  }
  regT(bearG);
  const idlerG = new THREE.Group();
  B.add(idlerG);
  {
    const pin = cylZ(1.5, 8, steelMat, 12);
    pin.position.set(bearG.position.x, GEAR_Y, -5);
    idlerG.add(pin);
    const arm = beveledBox(9, 40, 4, greyPlastic, 1.2);
    arm.position.set(bearG.position.x + 1.5, GEAR_Y + 4, -7);
    idlerG.add(arm);
    const pivot = cylZ(2.2, 10, steelMat, 12);
    pivot.position.set(bearG.position.x + 1.5, GEAR_Y - 13, -6);
    idlerG.add(pivot);
    const post2 = beveledBox(6, 8, 6, greyPlastic, 1);
    post2.position.set(24, GEAR_Y + 19, -7);
    idlerG.add(post2);
    const spring = coil({ turns: 6, radius: 2.4, length: 14, wireRadius: 0.4 }, steelMat).mesh;
    spring.rotation.z = Math.PI / 2;
    spring.position.set(bearG.position.x + 1.5 + 4.5 + 7, GEAR_Y + 19, -7);
    idlerG.add(spring);
  }
  regT(idlerG);
  // housing: motor plate behind, inlet guide above the gear (cut)
  const inletB = sectionLathe([[1.0, 82], [3.2, 82], [3.2, 90], [2.2, 94], [1.0, 92]], aluS, cutAlu, 24);
  B.add(inletB);
  regT(inletB);
  const outletB = sectionLathe([[2.05, 58], [3.6, 58], [3.6, 60], [1.1, 62.5], [1.0, 62.5], [1.0, 60]], aluS, cutAlu, 24);
  B.add(outletB);
  regT(outletB);

  // heatsink fan on the left, blowing +x through the fins
  const fanB = axialFan(30, 10, blackPlastic, greyPlastic);
  fanB.g.rotation.y = Math.PI / 2; // axis +z -> +x
  fanB.g.position.set(-21, 32, -4);
  B.add(fanB.g);

  // air and melt flow dots
  const AIRB = 27;
  const airMat = new THREE.MeshBasicMaterial({ color: 0x9fd8ff, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false });
  const airB = new THREE.InstancedMesh(new THREE.SphereGeometry(0.34, 10, 8), airMat, AIRB);
  airB.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  airB.frustumCulled = false;
  B.add(airB);
  const MELTN = 18;
  const meltDotMat = new THREE.MeshBasicMaterial({ color: 0xfff0b0, toneMapped: false });
  const meltDots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.22, 10, 8), meltDotMat, MELTN);
  meltDots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  meltDots.frustumCulled = false;
  B.add(meltDots);
  const jit = rng(21);
  const meltJ = Array.from({ length: MELTN }, () => (jit() * 2 - 1) * 0.8);
  const airJ = Array.from({ length: AIRB }, () => [(jit() * 2 - 1) * 0.3, jit()]);

  // thermal false colour: one shared material, uv1.v = height in B mm
  const thermTex = thermalTex();
  thermTex.channel = 1;
  const thermMat = new THREE.MeshStandardMaterial({
    color: 0x2c2c32,
    emissive: 0xffffff,
    emissiveMap: thermTex,
    emissiveIntensity: 0.78,
    roughness: 0.6,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  B.updateMatrixWorld(true);
  const invB = new THREE.Matrix4().copy(B.matrixWorld).invert();
  const tmpM = new THREE.Matrix4();
  const tmpV = new THREE.Vector3();
  for (const m of thermalMeshes) {
    m.geometry = m.geometry.clone();
    tmpM.multiplyMatrices(invB, m.matrixWorld);
    const p = m.geometry.attributes.position;
    const arr = new Float32Array(p.count * 2);
    for (let i = 0; i < p.count; i++) {
      tmpV.fromBufferAttribute(p, i).applyMatrix4(tmpM);
      arr[i * 2] = 0.5;
      arr[i * 2 + 1] = (tmpV.y - TH_Y0) / (TH_Y1 - TH_Y0);
    }
    m.geometry.setAttribute('uv1', new THREE.BufferAttribute(arr, 2));
    m.userData.mat0 = m.material;
  }

  // =========================================================================
  //  C — THE NOZZLE TIP, MACRO
  // =========================================================================
  const C = new THREE.Group();
  C.scale.setScalar(SC);
  C.position.set(0, 1.0, 0);
  group.add(C);
  const W = 0.45;
  const Hh = LAYER;
  const LOW = 5;
  const X0 = -9;
  const XCUT = 1.6;
  const TIP = (LOW + 1) * Hh; // nozzle tip height = top of the new bead
  const bm = beadMaps();
  const beadCool = new THREE.MeshStandardMaterial({
    map: bm.map,
    normalMap: bm.normal,
    normalScale: new THREE.Vector2(0.5, 0.5),
    roughness: 0.48,
    side: THREE.DoubleSide,
  });
  const seamTex = heatRampTex(X0, XCUT, (x) => (x < 0 ? Math.exp(x / 1.3) : Math.exp(-x / 0.35)) * 0.75);
  seamTex.channel = 1;
  const beadSeam = beadCool.clone();
  beadSeam.emissiveMap = seamTex;
  beadSeam.emissive = new THREE.Color(0xffffff);
  beadSeam.emissiveIntensity = 1.0;
  const hotTex = heatRampTex(X0, 0.25, (x) => Math.exp(Math.min(0, x) / 1.8));
  hotTex.channel = 1;
  const beadHot = beadCool.clone();
  beadHot.emissiveMap = hotTex;
  beadHot.emissive = new THREE.Color(0xffffff);
  beadHot.emissiveIntensity = 1.6;
  const capMatC = new THREE.MeshStandardMaterial({ color: 0xff8a3a, roughness: 0.62, side: THREE.DoubleSide });
  const lowerGeo = beadGeo(X0, XCUT, W, Hh);
  for (let i = 0; i < LOW; i++) {
    for (const z of [0, -0.42]) {
      const mat = i === LOW - 1 && z === 0 ? beadSeam : beadCool;
      const m = new THREE.Mesh(lowerGeo, mat);
      m.position.set(0, Hh / 2 + i * Hh, z);
      m.castShadow = true;
      m.receiveShadow = true;
      C.add(m);
      const cap = beadCap(W, Hh, capMatC);
      cap.position.set(XCUT + 0.001, Hh / 2 + i * Hh, z);
      C.add(cap);
    }
  }
  const newBead = new THREE.Mesh(beadGeo(X0, 0.25, W, Hh, { nose: 0.22 }), beadHot);
  newBead.position.set(0, Hh / 2 + LOW * Hh, 0);
  newBead.castShadow = true;
  C.add(newBead);
  // sheet: PEI skin on spring steel, cut at XCUT
  const peiC = peiMaps(9);
  const peiCMat = new THREE.MeshStandardMaterial({
    map: peiC.map,
    normalMap: peiC.normal,
    normalScale: new THREE.Vector2(0.9, 0.9),
    metalness: 0.3,
    roughness: 0.6,
  });
  const sheetTop = new THREE.Mesh(new THREE.PlaneGeometry(XCUT - X0, 2.4), peiCMat);
  {
    const uv = sheetTop.geometry.attributes.uv;
    const p = sheetTop.geometry.attributes.position;
    for (let i = 0; i < p.count; i++) uv.setXY(i, (p.getX(i) + (XCUT + X0) / 2) / 2, (p.getY(i) + 1.2) / 2);
  }
  sheetTop.rotation.x = -Math.PI / 2;
  sheetTop.position.set((XCUT + X0) / 2, 0.0005, -0.2);
  sheetTop.receiveShadow = true;
  C.add(sheetTop);
  const peiSkin = new THREE.Mesh(
    new THREE.BoxGeometry(XCUT - X0, 0.06, 2.4),
    new THREE.MeshStandardMaterial({ color: 0xb98a3c, roughness: 0.6, metalness: 0.3 }),
  );
  peiSkin.position.set((XCUT + X0) / 2, -0.031, -0.2);
  C.add(peiSkin);
  const steelSkin = new THREE.Mesh(new THREE.BoxGeometry(XCUT - X0, 0.5, 2.4), cutSteel);
  steelSkin.position.set((XCUT + X0) / 2, -0.06 - 0.25, -0.2);
  C.add(steelSkin);
  // nozzle tip + melt, half-sectioned
  const nozC = new THREE.Group();
  nozC.position.y = TIP;
  C.add(nozC);
  const brassC = new THREE.MeshStandardMaterial({ color: 0x8c6427, metalness: 1, roughness: 0.42, side: THREE.DoubleSide });
  const cutBrassC = new THREE.MeshStandardMaterial({ color: 0xa57c3a, metalness: 0.6, roughness: 0.38, side: THREE.DoubleSide });
  nozC.add(sectionLathe(NOZ_PROF.slice(0, 3).concat([[3.2, 6], [1.0, 6], [1.0, 1.6], [0.2, 0.9]]), brassC, cutBrassC, 48));
  nozC.add(sectionLathe([[0, -0.04], [0.2, -0.04], [0.2, 0.9], [1.0, 1.6], [1.0, 6], [0, 6]], melt, melt, 24));
  // flow dots down the bore and out of the hole
  const DOTC = 16;
  const dotsC = new THREE.InstancedMesh(new THREE.SphereGeometry(0.055, 10, 8), meltDotMat, DOTC);
  dotsC.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  dotsC.frustumCulled = false;
  C.add(dotsC);
  const dotCJ = Array.from({ length: DOTC }, () => (jit() * 2 - 1) * 0.75);
  // part-cooling duct + air streaks onto the fresh bead
  const ductC = new THREE.Group();
  ductC.position.set(-3.6, 3.0, -1.4);
  C.add(ductC);
  const ductDir = new THREE.Vector3(-1.0, TIP + 0.1, 0.0).sub(ductC.position).normalize();
  {
    const mouth = beveledBox(1.4, 0.55, 1.8, blackPlastic, 0.1);
    mouth.position.x = -0.6;
    ductC.add(mouth);
    ductC.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), ductDir);
  }
  const AIRC = 34;
  const airCMat = new THREE.MeshBasicMaterial({ color: 0xa8dcff, transparent: true, opacity: 0.55, depthWrite: false, toneMapped: false });
  const airC = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 10, 6), airCMat, AIRC);
  airC.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  airC.frustumCulled = false;
  C.add(airC);
  const airCJ = Array.from({ length: AIRC }, () => [(jit() * 2 - 1) * 0.5, (jit() * 2 - 1) * 0.3]);

  // =========================================================================
  //  CALLOUTS
  // =========================================================================
  const labels = calloutSets(['exterior', 'slice', 'extruder', 'hotend', 'bead', 'motion', 'bed']);
  labels.add('exterior', spool, 'Filament spool', [40, 60, 34], 30, 60);
  labels.add('exterior', tool, 'Extruder', [16, 228, 50], 25, 70);
  labels.add('exterior', tool, 'Hotend', [4, NOZ_Y + 13, ZN + 10.5], 10, 80);
  labels.add('exterior', sheet, 'Print bed', [90, BED_TOP, 90], -20, 60);

  labels.add('slice', hiG, 'One layer: 2 walls + 15% infill', [rookR(25) * 0.7, SLAB_T, rookR(25) * 0.7], -15, 80);
  labels.add('slice', islandAnchor, 'Battlements: 4 separate islands', [0, SLAB_T, 0], 30, 70);
  labels.add('slice', lowAnchor, 'Slices (1 in 10 shown)', [0, SLAB_T / 2, 0], -40, 80);

  labels.add('extruder', motorB, 'Stepper motor', [18, -16, 17.5], -20, 64);
  labels.add('extruder', gearG, 'Drive gear', [-2.5, 2.5, 0.2], 70, 70);
  labels.add('extruder', bearG, 'Idler bearing', [3.2, -2.5, 0.2], -20, 60);
  labels.add('extruder', idlerG, 'Tension spring', [bearG.position.x + 11, GEAR_Y + 21, -7], 30, 60);
  labels.add('extruder', B, 'Bite marks', [-0.6, 66, 0.3], -60, 80);

  labels.add('hotend', fanB.g, 'Heatsink fan', [-15.5, 9, 0], 60, 50);
  labels.add('hotend', B, 'Heatsink · ~40 °C', [10.5, 38, 0.2], 20, 64);
  labels.add('hotend', B, 'Heat break', [1.5, 20.3, 0.2], 10, 80);
  labels.add('hotend', cartG, 'Heater cartridge', [2.5, 1.5, 0.1], 25, 64);
  labels.add('hotend', thermG, 'Thermistor', [1.2, -0.6, 0.1], 15, 56);
  labels.add('hotend', B, 'Nozzle · 210 °C', [1.0, 0.6, 0.2], -45, 90);

  labels.add('bead', nozC, 'Nozzle · 0.4 mm hole', [1.5, 1.6, -0.45], 25, 70);
  labels.add('bead', newBead, 'New bead · 0.2 mm tall', [-1.7, 0, W / 2], -70, 110);
  labels.add('bead', C, 'Fused seam', [-0.7, TIP - Hh, 0.3], -30, 80);
  labels.add('bead', C, 'Layers below', [XCUT, Hh * 2, 0], -35, 100);
  labels.add('bead', C, 'Part-cooling air', [-2.7, 2.45, -0.95], 95, 60);

  labels.add('motion', xPulleyG, 'X motor + belt', [0, 20, 22], 60, 60);
  labels.add('motion', A, 'Y belt moves the bed', [0, 58, 208], -25, 60);
  labels.add('motion', A, 'Z lead screw (still)', [LS_X, 360, LS_Z], 20, 60);
  labels.add('motion', tool, 'Toolhead', [25, 190, ZN + 20], 30, 60);

  labels.add('bed', sheet, 'Steel sheet, PEI coated', [112, BED_TOP, 105], -35, 80);
  labels.add('bed', bed, 'Heater trace · 60 °C', [40, 84.1, 100], -35, 80);
  labels.add('bed', sheet, 'First layer, gripped', [12, BED_TOP + 0.5, 12], 65, 90);

  // =========================================================================
  //  POSE
  // =========================================================================
  const dummy = new THREE.Object3D();
  const cHot = new THREE.Color(1.6, 1.05, 0.45);
  const cCool = new THREE.Color(0.85, 0.27, 0.05);
  const tmpC = new THREE.Color();
  const TRAIL_T = 1.1;
  let thermal = false;

  function apply(st) {
    // ---- A: one layer of the rook
    const PARK_TX = -110;
    const PARK_BZ = 60;
    let tx;
    let bz;
    if (st.park) {
      tx = PARK_TX;
      bz = PARK_BZ;
    } else {
      const p = PATH.at(st.tp * PATH.T);
      tx = p.x;
      bz = ZN - p.z;
    }
    tool.position.x = tx;
    const zl = st.park ? 70 : 0;
    zStage.position.y = zl;
    bed.position.z = bz;
    sheet.position.y = st.lift;
    xPulleyG.rotation.y = -tx / XP_R;
    beltMat.map.offset.x = tx / 2;
    yPulleyG.rotation.x = (bz - ZN) / XP_R;
    beltMatY.map.offset.x = -(bz - ZN) / 2;
    fanA.rotor.rotation.z = st.fanA;
    setFilament(tx, zl);
    // trail of fresh plastic in rook-local coordinates
    let n = 0;
    if (!st.park) {
      const t0 = st.tp * PATH.T;
      let prev = PATH.at(t0);
      for (let k = 1; k <= TRAIL; k++) {
        const cur = PATH.at(t0 - (k / TRAIL) * TRAIL_T);
        const len = Math.hypot(cur.x - prev.x, cur.z - prev.z);
        if (prev.e && len > 1e-4) {
          dummy.position.set((cur.x + prev.x) / 2, BED_TOP + PRINT_H + 0.11, (cur.z + prev.z) / 2);
          dummy.rotation.set(0, -Math.atan2(prev.z - cur.z, prev.x - cur.x), 0);
          dummy.scale.set(len + 0.05, 0.22, 0.5);
        } else {
          dummy.scale.set(0, 0, 0);
        }
        dummy.updateMatrix();
        trail.setMatrixAt(k - 1, dummy.matrix);
        tmpC.copy(cHot).lerp(cCool, Math.pow(k / TRAIL, 0.6));
        trail.setColorAt(k - 1, tmpC);
        prev = cur;
        n++;
      }
    }
    for (let k = n; k < TRAIL; k++) {
      dummy.scale.set(0, 0, 0);
      dummy.updateMatrix();
      trail.setMatrixAt(k, dummy.matrix);
    }
    trail.instanceMatrix.needsUpdate = true;
    if (trail.instanceColor) trail.instanceColor.needsUpdate = true;

    // ---- S: breathe + sway
    const gap = 0.4 + 1.2 * st.gap;
    for (let k = 0; k < SLABS; k++) slabs[k].position.y = k * (SLAB_T + gap);
    const yHi = HI * (SLAB_T + gap);
    hiG.position.set(30, yHi + 4, 6);
    cutPlane.position.y = yHi + SLAB_T / 2;
    cutEdge.position.y = cutPlane.position.y;
    islandAnchor.position.y = (SLABS - 1) * (SLAB_T + gap);
    lowAnchor.position.y = 2 * (SLAB_T + gap);
    Sspin.rotation.y = st.sway;

    // ---- B: feed
    const feedMM = st.feed * PITCH;
    gearG.rotation.z = -feedMM / 3.5;
    bearG.rotation.z = feedMM / BR;
    bite.offset.y = st.feed;
    fanB.rotor.rotation.z = st.fanB;
    for (let i = 0; i < AIRB; i++) {
      const gapI = i % 9;
      const p = (((Math.floor(i / 9) / 3 + gapI * 0.137 + st.airB) % 1) + 1) % 1;
      const x = -15 + 29 * p;
      const fade = Math.sin(Math.PI * p);
      dummy.position.set(x, 23.1 + 2.2 * gapI + airJ[i][0], 0.5);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.set(1.6 * fade, 0.8 * fade, 0.8 * fade);
      dummy.updateMatrix();
      airB.setMatrixAt(i, dummy.matrix);
    }
    airB.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < MELTN; i++) {
      const p = (((i / MELTN + st.meltB) % 1) + 1) % 1;
      let y;
      let rb;
      if (p < 0.82) {
        y = 17 - (17 - 1.6) * (p / 0.82);
        rb = 1.0;
      } else {
        const q = (p - 0.82) / 0.18;
        y = 1.6 - 2.4 * q;
        rb = y > 0.9 ? 0.2 + 0.8 * ((y - 0.9) / 0.7) : 0.2;
      }
      const s = y < 0 ? clamp01(1 + y / 0.8) : 1;
      dummy.position.set(meltJ[i] * rb * 0.8, y, 0.12);
      dummy.scale.setScalar(s * (rb < 0.5 ? 0.7 : 1));
      dummy.updateMatrix();
      meltDots.setMatrixAt(i, dummy.matrix);
    }
    meltDots.instanceMatrix.needsUpdate = true;

    // ---- C: the part slides -x under the nozzle
    bm.map.offset.x = st.scroll;
    bm.normal.offset.x = st.scroll;
    peiC.map.offset.x = st.scroll / 2;
    peiC.normal.offset.x = st.scroll / 2;
    for (let i = 0; i < DOTC; i++) {
      const p = (((i / DOTC + st.dotC) % 1) + 1) % 1;
      let x;
      let y;
      let s = 1;
      if (p < 0.78) {
        y = 4.6 - (4.6 - 1.6) * (p / 0.78);
        x = dotCJ[i] * 0.75;
        if (y < 2.3) x *= 0.2 + 0.8 * clamp01((y - 0.9) / 1.4);
      } else {
        const q = (p - 0.78) / 0.22;
        y = 1.6 - 1.6 * Math.min(1, q * 1.4) - 0.1 * Math.max(0, q * 1.4 - 1);
        x = dotCJ[i] * 0.15 * (1 - q) - 0.9 * Math.max(0, q - 0.55);
        s = 1 - smooth((q - 0.6) / 0.4);
      }
      dummy.position.set(x, TIP + y, 0.03);
      dummy.rotation.set(0, 0, 0);
      dummy.scale.setScalar(Math.max(0, s));
      dummy.updateMatrix();
      dotsC.setMatrixAt(i, dummy.matrix);
    }
    dotsC.instanceMatrix.needsUpdate = true;
    const aStart = ductC.position;
    const aEnd = new THREE.Vector3(-1.1, TIP + 0.12, 0.0);
    for (let i = 0; i < AIRC; i++) {
      const p = (((i / AIRC + st.airC) % 1) + 1) % 1;
      const [ja, jb] = airCJ[i];
      dummy.position.set(
        aStart.x + (aEnd.x - aStart.x) * p - 0.8 * Math.max(0, p - 0.8) * 5 + ja * 0.4,
        aStart.y + (aEnd.y - aStart.y) * Math.min(1, p / 0.85) + jb * 0.5 * (1 - p),
        aStart.z + (aEnd.z - aStart.z) * p + ja * 1.2 * (1 - p) + 0.35 * Math.max(0, p - 0.8) * 5 * Math.sign(ja),
      );
      dummy.quaternion.setFromUnitVectors(new THREE.Vector3(1, 0, 0), ductDir);
      const f = Math.sin(Math.PI * p);
      dummy.scale.set(0.38 * f, 0.045 * f, 0.045 * f);
      dummy.updateMatrix();
      airC.setMatrixAt(i, dummy.matrix);
    }
    airC.instanceMatrix.needsUpdate = true;
  }

  function setLap(name, u) {
    apply(LAPS[name](((u % 1) + 1) % 1));
  }

  // which insert is on stage + per-step looks
  function setView({ scene: sc = 'A', thermal: th = false, heat = false } = {}) {
    // hidden inserts stay in the graph, so also opt their meshes out of the
    // callout occlusion raycast (it checks each mesh's own .visible only)
    for (const [k, g] of [['A', plinth], ['A', A], ['S', S], ['B', B], ['C', C]]) {
      const on = k === sc;
      g.visible = on;
      g.traverse((o) => {
        if (o.isMesh) o.userData.noOcclude = !on;
      });
    }
    traceMat.emissiveIntensity = heat ? 1.1 : 0;
    trail.visible = !heat;
    if (th !== thermal) {
      thermal = th;
      for (const m of thermalMeshes) m.material = th ? thermMat : m.userData.mat0;
    }
    airB.visible = true;
    meltDots.visible = true;
  }

  setView({});
  setLap('print', 0.1);
  labels.setLabels(false);

  return {
    group,
    setLap,
    setView,
    setLabels: labels.setLabels,
    parts: { tool, bed, sheet, gearG, bearG, Sspin, newBead, rook, xPulleyG, yPulleyG },
  };
}
