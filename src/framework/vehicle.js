import * as THREE from 'three';
import { materials } from './parts.js';
import { beveledBox, lathe, tubeAlong } from './geometry.js';
import { clamp01, TAU } from './motion.js';

// Shared procedural road-vehicle kit: a mid-size sedan (lofted body,
// greenhouse, wheels, interior), a two-lane road "treadmill" whose texture
// scrolls under a stationary car, and overlay helpers for drawing data on top
// of a scene. Extracted from adas-lane-assist when automatic-emergency-braking
// needed the same car — generic parts only; anything one explainer needs
// (sensors, steering column, brakes) stays in that explainer's model.js.
//
// SCALE: 1 unit = 1 m. Car-local frame: forward −z, right +x, ground y = 0.
//   car 4.6 L × 1.8 W × 1.45 H · wheelbase 2.7 · track 1.56 · tyre Ø0.64
//   lane 3.5 m · line 0.15 m · dashes 3 m paint + 9 m gap (12 m period)

// --- layout ---------------------------------------------------------------------
export const PERIOD = 12;
export const DASH = 3;
export const LINE_W = 0.15;
export const X_DASH = -1.75;
export const X_EDGE_R = 1.75;
export const X_EDGE_L = -5.25;
export const ROAD_X0 = -6.25;
export const ROAD_X1 = 2.75;
export const ROAD_W = ROAD_X1 - ROAD_X0;
export const ROAD_NEAR = 18;
export const ROAD_FAR = -42;
export const FADE = 10;

export const HALF_L = 2.3;
export const HALF_W = 0.9;
export const TYRE_R = 0.32;
export const TYRE_W = 0.215;
export const TRACK_HALF = 0.78;
export const FRONT_AXLE = -1.4;
export const REAR_AXLE = 1.3;
export const WHEELBASE = REAR_AXLE - FRONT_AXLE;
export const ARCH_R = 0.4;
export const DRIVER_X = -0.37; // left-hand drive: driver's seat / wheel centre x

export function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}
export const frac = (x) => x - Math.floor(x);
export const lerp = (a, b, t) => a + (b - a) * t;

// --- textures -----------------------------------------------------------------------
// --- textures -----------------------------------------------------------------------
export function roadTexture() {
  const W = 1024;
  const H = 1366;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const pxm = W / ROAD_W;
  const X = (x) => (x - ROAD_X0) * pxm;
  g.fillStyle = '#2c2e32';
  g.fillRect(0, 0, W, H);
  // shoulders a touch lighter and coarser
  g.fillStyle = '#323438';
  g.fillRect(0, 0, X(X_EDGE_L), H);
  g.fillRect(X(X_EDGE_R), 0, W - X(X_EDGE_R), H);
  // polished wheel tracks in both lanes
  for (const lc of [X_DASH - 1.75, 0]) {
    for (const s of [-0.78, 0.78]) {
      const x0 = X(lc + s - 0.32);
      const x1 = X(lc + s + 0.32);
      const gr = g.createLinearGradient(x0, 0, x1, 0);
      gr.addColorStop(0, 'rgba(0,0,0,0)');
      gr.addColorStop(0.5, 'rgba(10,11,13,0.32)');
      gr.addColorStop(1, 'rgba(0,0,0,0)');
      g.fillStyle = gr;
      g.fillRect(x0, 0, x1 - x0, H);
    }
  }
  const r = rng(11);
  for (let i = 0; i < 70000; i++) {
    const light = r() < 0.55;
    const v = light ? 70 + ((r() * 60) | 0) : 12 + ((r() * 12) | 0);
    g.fillStyle = `rgba(${v},${v},${v + 3},${light ? 0.35 : 0.5})`;
    const sz = 1 + r() * 2.2;
    g.fillRect(r() * W, r() * H, sz, sz);
  }
  // markings (paint), then wear speckle over them
  g.fillStyle = '#e6e4dc';
  const lw = LINE_W * pxm;
  g.fillRect(X(X_EDGE_L) - lw / 2, 0, lw, H);
  g.fillRect(X(X_EDGE_R) - lw / 2, 0, lw, H);
  // dash occupies texture v ∈ [0, DASH/PERIOD) → bottom rows of the canvas
  g.fillRect(X(X_DASH) - lw / 2, H * (1 - DASH / PERIOD), lw, H * (DASH / PERIOD));
  for (let i = 0; i < 9000; i++) {
    const xs = [X_EDGE_L, X_EDGE_R, X_DASH][i % 3];
    const x = X(xs) + (r() - 0.5) * lw;
    const y = i % 3 === 2 ? H * (1 - DASH / PERIOD) + r() * H * (DASH / PERIOD) : r() * H;
    g.fillStyle = `rgba(40,42,46,${0.25 + r() * 0.35})`;
    g.fillRect(x, y, 1 + r() * 2, 1 + r() * 2);
  }
  // soft edge into the studio floor
  for (const [x0, x1] of [
    [0, 0.35 * pxm],
    [W, W - 0.35 * pxm],
  ]) {
    const gr = g.createLinearGradient(x0, 0, x1, 0);
    gr.addColorStop(0, 'rgba(12,13,15,0.85)');
    gr.addColorStop(1, 'rgba(12,13,15,0)');
    g.fillStyle = gr;
    g.fillRect(Math.min(x0, x1), 0, Math.abs(x1 - x0), H);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.ClampToEdgeWrapping;
  tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

export function softRectTexture({ w = 128, h = 256, inset = 34, blur = 16, alpha = 0.6 } = {}) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const g = c.getContext('2d');
  g.filter = `blur(${blur}px)`;
  g.fillStyle = `rgba(0,0,0,${alpha})`;
  g.fillRect(inset, inset, w - inset * 2, h - inset * 2);
  return new THREE.CanvasTexture(c);
}


export function roadStrip(z0, z1, segs, alphaAt, mat) {
  const pos = [];
  const uv = [];
  const col = [];
  const idx = [];
  for (let i = 0; i <= segs; i++) {
    const z = lerp(z0, z1, i / segs);
    const a = alphaAt(z);
    for (const [x, u] of [
      [ROAD_X0, 0],
      [ROAD_X1, 1],
    ]) {
      pos.push(x, 0, z);
      uv.push(u, -z / PERIOD);
      col.push(1, 1, 1, a);
    }
  }
  for (let i = 0; i < segs; i++) {
    const a = i * 2;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const m = new THREE.Mesh(geo, mat);
  m.receiveShadow = true;
  return m;
}

// flat strip on the road from (0,0,0) to (0,0,-1), width 1 — scale to size
export function flatStrip(mat) {
  const geo = new THREE.PlaneGeometry(1, 1);
  geo.translate(0, 0.5, 0);
  geo.rotateX(-Math.PI / 2);
  return new THREE.Mesh(geo, mat);
}

export function glowMat(color, opacity = 1, additive = true) {
  return new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    blending: additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    side: THREE.DoubleSide,
    toneMapped: false,
  });
}

// The stage's GTAO (and DoF) passes re-render every mesh with
// scene.overrideMaterial to build their depth/normal buffers. Translucent
// overlays drawn there turn into solid walls: a view-cone tent darkens the
// whole road inside it. Skip the draw whenever an override material is
// active — model-local, the shared stage stays untouched.
export function noAO(root) { // also: overlays don't count as label occluders
  root.traverse((o) => {
    if (!o.isMesh) return;
    o.userData.noOcclude = true; // a glow overlay never hides a callout
    o.onBeforeRender = (r, scene, cam, geo) => {
      if (!scene.overrideMaterial) return;
      o.userData._dc = geo.drawRange.count;
      geo.drawRange.count = 0;
    };
    o.onAfterRender = (r, scene, cam, geo) => {
      if (o.userData._dc === undefined) return;
      geo.drawRange.count = o.userData._dc;
      o.userData._dc = undefined;
    };
  });
}

// --- car body ---------------------------------------------------------------------------
// plan half-width: superellipse in z — blunt rounded nose, squarer tail
export function bodyW(z) {
  const zn = Math.min(1, Math.abs(z) / HALF_L);
  const p = z < 0 ? 4.5 : 6;
  return HALF_W * Math.pow(Math.max(0, 1 - Math.pow(zn, p)), 1 / p);
}

function tableFn(tab) {
  return (z) => {
    if (z <= tab[0][0]) return tab[0][1];
    for (let i = 0; i < tab.length - 1; i++) {
      if (z <= tab[i + 1][0]) {
        const t = (z - tab[i][0]) / (tab[i + 1][0] - tab[i][0]);
        return lerp(tab[i][1], tab[i + 1][1], t);
      }
    }
    return tab[tab.length - 1][1];
  };
}

// sample a piecewise-linear table on a fine grid and smooth it → smooth fn
function smoothFn(tab, z0, z1, passes = 24) {
  const N = 400;
  const raw = tableFn(tab);
  let a = Array.from({ length: N + 1 }, (_, i) => raw(lerp(z0, z1, i / N)));
  for (let p = 0; p < passes; p++) {
    const b = a.slice();
    for (let i = 1; i < N; i++) b[i] = (a[i - 1] + 2 * a[i] + a[i + 1]) / 4;
    a = b;
  }
  return (z) => {
    const f = clamp01((z - z0) / (z1 - z0)) * N;
    const i = Math.min(N - 1, Math.floor(f));
    return lerp(a[i], a[i + 1], f - i);
  };
}

const bodyTop = smoothFn(
  [
    [-2.3, 0.5],
    [-2.26, 0.62],
    [-2.15, 0.7],
    [-1.9, 0.76],
    [-1.4, 0.82],
    [-0.95, 0.93],
    [-0.8, 0.97],
    [1.4, 0.99],
    [1.55, 1.01],
    [2.05, 1.0],
    [2.22, 0.95],
    [2.3, 0.8],
  ],
  -HALF_L,
  HALF_L,
  10,
);
const bodyBot = smoothFn(
  [
    [-2.3, 0.38],
    [-2.2, 0.27],
    [-2.0, 0.21],
    [-1.8, 0.2],
    [1.9, 0.2],
    [2.15, 0.26],
    [2.3, 0.42],
  ],
  -HALF_L,
  HALF_L,
  10,
);
const archAt = (z) => {
  let y = 0;
  for (const az of [FRONT_AXLE, REAR_AXLE]) {
    const dz = z - az;
    if (Math.abs(dz) < ARCH_R) y = Math.max(y, TYRE_R + Math.sqrt(ARCH_R * ARCH_R - dz * dz));
  }
  return y;
};
const CAB0 = -0.88;
const CAB1 = 1.4;

function bodyHalfProfile(yb, yt, w) {
  const hp = [];
  const h = yt - yb;
  const rb = Math.min(0.07, w * 0.5, h * 0.3);
  const rt = Math.min(0.16, w * 0.6, h * 0.45);
  const wb = w * 0.95;
  const crown = 0.025 * Math.min(1, w / HALF_W);
  for (let k = 0; k <= 2; k++) hp.push([((wb - rb) * k) / 2, yb, 'bot']);
  for (let k = 1; k <= 4; k++) {
    const a = -Math.PI / 2 + ((Math.PI / 2) * k) / 4;
    hp.push([wb - rb + rb * Math.cos(a), yb + rb + rb * Math.sin(a), 'side']);
  }
  for (let k = 1; k <= 3; k++) {
    const t = k / 3;
    hp.push([lerp(wb, w, t), lerp(yb + rb, yt - rt, t), 'side']);
  }
  for (let k = 1; k <= 6; k++) {
    const a = ((Math.PI / 2) * k) / 6;
    hp.push([w - rt + rt * Math.cos(a), yt - rt + rt * Math.sin(a), k >= 5 ? 'top' : 'shoulder']);
  }
  for (let k = 1; k <= 4; k++) {
    const x = (w - rt) * (1 - k / 4);
    const xn = w > 1e-4 ? x / w : 0;
    hp.push([x, yt + crown * (1 - xn * xn), 'top']);
  }
  return hp; // 20 points, bottom-centre → top-centre (x ≥ 0)
}

function fullRing(hp) {
  const ring = hp.map(([x, y, t]) => [x, y, t]);
  for (let k = hp.length - 2; k >= 1; k--) ring.push([-hp[k][0], hp[k][1], hp[k][2]]);
  return ring;
}

function buildBodyGeometry() {
  const zs = [];
  const NS = 150;
  for (let i = 0; i <= NS; i++) zs.push(lerp(-HALF_L, HALF_L, i / NS));
  for (const az of [FRONT_AXLE, REAR_AXLE]) {
    for (const s of [-1, 1]) {
      zs.push(az + s * (ARCH_R - 0.002), az + s * (ARCH_R + 0.002));
    }
  }
  zs.sort((a, b) => a - b);
  const rings = zs.map((z) => {
    const w = bodyW(z);
    const yt = bodyTop(z);
    const yb = Math.min(yt - 0.2, Math.max(bodyBot(z), archAt(z)));
    return fullRing(bodyHalfProfile(yb, yt, w));
  });
  const R = rings[0].length;
  const pos = [];
  const uv = [];
  rings.forEach((ring, i) => {
    ring.forEach(([x, y], j) => {
      pos.push(x, y, zs[i]);
      uv.push(j / R, i / (zs.length - 1));
    });
  });
  const idx = [];
  for (let i = 0; i < zs.length - 1; i++) {
    const inCab = zs[i] > CAB0 && zs[i + 1] < CAB1;
    for (let j = 0; j < R; j++) {
      const jn = (j + 1) % R;
      if (inCab && rings[i][j][2] === 'top' && rings[i][jn][2] === 'top') continue; // cabin opening
      const a = i * R + j;
      const b = i * R + jn;
      const c = (i + 1) * R + j;
      const d = (i + 1) * R + jn;
      idx.push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// greenhouse: windshield / roof / rear window / side glass in one loft,
// faces sorted into paint (roof, pillars), glass and black trim (B-pillar)
const GZ0 = -0.97;
const GZ1 = 1.47;
const greenTop = smoothFn(
  [
    [GZ0, 0.95],
    [-0.15, 1.42],
    [0.2, 1.455],
    [0.75, 1.43],
    [GZ1, 0.96],
  ],
  GZ0,
  GZ1,
  6,
);
export const G_YB = 0.94;

function greenHalfProfile(yt) {
  const hp = [];
  const h = Math.max(0, yt - G_YB);
  const wb = 0.8;
  const wt = 0.64;
  const r = Math.min(0.1, h * 0.5);
  const xTop = lerp(wb, wt, h > 1e-4 ? clamp01((h - r) / h) : 1);
  for (let k = 0; k <= 3; k++) {
    const t = k / 3;
    hp.push([lerp(wb, xTop, t), lerp(G_YB, yt - r, t), 'side']);
  }
  for (let k = 1; k <= 4; k++) {
    const a = ((Math.PI / 2) * k) / 4;
    hp.push([xTop - r + r * Math.cos(a), yt - r + r * Math.sin(a), 'arc']);
  }
  for (let k = 1; k <= 4; k++) {
    const x = (xTop - r) * (1 - k / 4);
    hp.push([x, yt + 0.02 * (1 - (x / wt) ** 2) * Math.min(1, h * 4), 'top']);
  }
  return hp;
}

function buildGreenhouseGeometry() {
  const NS = 90;
  const zs = Array.from({ length: NS + 1 }, (_, i) => lerp(GZ0, GZ1, i / NS));
  // open ring: right sill → over the roof → left sill (no floor)
  const rings = zs.map((z) => {
    const hp = greenHalfProfile(greenTop(z));
    const ring = hp.slice();
    for (let k = hp.length - 2; k >= 0; k--) ring.push([-hp[k][0], hp[k][1], hp[k][2]]);
    return ring;
  });
  const R = rings[0].length;
  const pos = [];
  const uv = [];
  rings.forEach((ring, i) =>
    ring.forEach(([x, y], j) => {
      pos.push(x, y, zs[i]);
      uv.push(j / R, i / NS);
    }),
  );
  const lists = [[], [], []]; // paint, glass, trim
  for (let i = 0; i < NS; i++) {
    const zc = (zs[i] + zs[i + 1]) / 2;
    for (let j = 0; j < R - 1; j++) {
      const t0 = rings[i][j][2];
      const t1 = rings[i][j + 1][2];
      let m;
      if (t0 === 'top' && t1 === 'top') m = zc > -0.13 && zc < 0.8 ? 0 : 1;
      else if (t0 === 'arc' || t1 === 'arc') m = 0;
      else if (zc < -0.6 || zc > 0.86) m = 0;
      else if (zc > 0.13 && zc < 0.23) m = 2;
      else m = 1;
      const a = i * R + j;
      const b = i * R + j + 1;
      const c = (i + 1) * R + j;
      const d = (i + 1) * R + j + 1;
      lists[m].push(a, b, c, b, d, c);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  const all = [];
  lists.forEach((l, m) => {
    geo.addGroup(all.length, l.length, m);
    all.push(...l);
  });
  geo.setIndex(all);
  geo.computeVertexNormals();
  return geo;
}

// nose/tail surface z at a given |x| (for seating lights flush)
export function surfaceZ(x, front) {
  let lo = 0;
  let hi = HALF_L;
  for (let k = 0; k < 30; k++) {
    const m = (lo + hi) / 2;
    if (bodyW(front ? -m : m) > x) lo = m;
    else hi = m;
  }
  return front ? -lo : lo;
}

function buildWheel(side, rimMat, tyreMat, discMat) {
  // side: +1 right (outer face +x), −1 left
  const g = new THREE.Group();
  const tyre = lathe(
    [
      [0.215, -0.1],
      [0.27, -0.108],
      [0.303, -0.102],
      [0.317, -0.086],
      [TYRE_R, -0.045],
      [TYRE_R, 0.045],
      [0.317, 0.086],
      [0.303, 0.102],
      [0.27, 0.108],
      [0.215, 0.1],
    ],
    tyreMat,
    56,
  );
  tyre.rotation.z = Math.PI / 2;
  g.add(tyre);
  // tread grooves
  for (const dx of [-0.04, 0.04]) {
    const groove = new THREE.Mesh(new THREE.TorusGeometry(TYRE_R - 0.001, 0.006, 6, 64), discMat);
    groove.rotation.y = Math.PI / 2;
    groove.position.x = dx;
    g.add(groove);
  }
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.215, 0.215, 0.19, 40, 1, true), rimMat);
  barrel.rotation.z = Math.PI / 2;
  g.add(barrel);
  const face = side * 0.07;
  const brake = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.022, 36), discMat);
  brake.rotation.z = Math.PI / 2;
  brake.position.x = -side * 0.01;
  g.add(brake);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.07, 0.05, 24), rimMat);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = face;
  g.add(hub);
  for (let k = 0; k < 5; k++) {
    const a = (k / 5) * TAU;
    const sp = beveledBox(0.03, 0.17, 0.045, rimMat, 0.01);
    sp.position.set(face - side * 0.005, Math.cos(a) * 0.125, Math.sin(a) * 0.125);
    sp.rotation.x = -a;
    g.add(sp);
  }
  const lip = new THREE.Mesh(new THREE.TorusGeometry(0.212, 0.011, 8, 48), rimMat);
  lip.rotation.y = Math.PI / 2;
  lip.position.x = face;
  g.add(lip);
  g.traverse((o) => o.isMesh && (o.castShadow = true));
  return g;
}

// A complete car. Returns its root (car-local frame: forward −z, right +x)
// plus the materials/parts the pose needs.
export function buildCar({ paintColor, interior }) {
  const root = new THREE.Group();
  const paint = new THREE.MeshPhysicalMaterial({
    color: paintColor,
    metalness: 0.1,
    roughness: 0.42,
    clearcoat: 0.5,
    clearcoatRoughness: 0.3,
    side: THREE.DoubleSide,
  });
  // tinted, reflective glass: at 0.55 a plain dark tint read as an open roof
  // from above (the cabin showed through as a black box)
  const glass = new THREE.MeshPhysicalMaterial({
    color: 0x1a2430,
    metalness: 0,
    roughness: 0.06,
    clearcoat: 1,
    clearcoatRoughness: 0.05,
    transparent: true,
    opacity: 0.86,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  glass.userData.baseOpacity = glass.opacity; // models restore this on re-seal
  const trim = materials.polymer(0x0e0f11);
  trim.roughness = 0.4;
  const rimMat = materials.aluminum(0xc3c8ce);
  rimMat.roughness = 0.5;
  const tyreMat = materials.rubber(0x151618);
  const discMat = materials.darkMetal(0x2c2f34);
  discMat.roughness = 0.6;

  const body = new THREE.Mesh(buildBodyGeometry(), paint);
  body.castShadow = true;
  root.add(body);
  const green = new THREE.Mesh(buildGreenhouseGeometry(), [paint, glass, trim]);
  green.castShadow = true;
  root.add(green);

  const shellExtras = []; // hidden on reveal
  const paintExtras = []; // painted add-ons, hidden with the body in X-ray
  // bright window-line trim along both sills
  const trimChrome = materials.chrome(0xc9ced4);
  trimChrome.roughness = 0.3;
  for (const s of [-1, 1]) {
    const pts = [];
    for (let k = 0; k <= 16; k++) {
      const z = lerp(-0.62, 1.2, k / 16);
      pts.push([s * 0.805, G_YB + 0.03, z]);
    }
    const t = tubeAlong(pts, 0.009, trimChrome, { tubularSegments: 32, radialSegments: 8 });
    root.add(t);
    shellExtras.push(t);
  }

  // wheel-well liners
  for (const az of [FRONT_AXLE, REAR_AXLE]) {
    const liner = beveledBox(1.26, 0.5, 0.78, trim, 0.05);
    liner.position.set(0, 0.47, az);
    root.add(liner);
    shellExtras.push(liner);
  }
  // grille, lower intake, badge
  const zg = surfaceZ(0.42, true);
  const grille = beveledBox(0.84, 0.17, 0.08, trim, 0.03);
  grille.position.set(0, 0.5, zg + 0.035);
  root.add(grille);
  const intake = beveledBox(1.1, 0.1, 0.08, trim, 0.03);
  intake.position.set(0, 0.32, surfaceZ(0.55, true) + 0.05);
  root.add(intake);
  const badge = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 32), materials.chrome());
  badge.rotation.x = Math.PI / 2;
  badge.position.set(0, 0.52, zg - 0.01);
  root.add(badge);
  shellExtras.push(grille, intake, badge);
  // lights
  const headMat = new THREE.MeshStandardMaterial({
    color: 0xc9d1dc,
    emissive: 0xdfe8ff,
    emissiveIntensity: 0.16,
    roughness: 0.2,
  });
  const tailMat = new THREE.MeshStandardMaterial({
    color: 0x7a0c10,
    emissive: 0xff2a2a,
    emissiveIntensity: 1.1,
    roughness: 0.3,
  });
  for (const s of [-1, 1]) {
    // light bars hug the plan curve of the nose / tail, sunk half into it
    const strip = (x0, x1, y, front, r, mat) => {
      const pts = [];
      for (let k = 0; k <= 8; k++) {
        const x = lerp(x0, x1, k / 8);
        pts.push([s * x, y, surfaceZ(x, front) + (front ? 0.012 : -0.012)]);
      }
      const t = tubeAlong(pts, r, mat, { tubularSegments: 24, radialSegments: 10 });
      return t;
    };
    const head = strip(0.38, 0.74, 0.64, true, 0.028, headMat);
    const tail = strip(0.42, 0.8, 0.86, false, 0.026, tailMat);
    root.add(head, tail);
    // mirrors
    const mirror = beveledBox(0.08, 0.1, 0.17, paint, 0.035);
    paintExtras.push(mirror);
    mirror.position.set(s * 0.95, 1.02, -0.72);
    root.add(mirror);
    const handleF = beveledBox(0.02, 0.025, 0.14, materials.chrome(), 0.008);
    handleF.position.set(s * (bodyW(-0.15) + 0.004), 0.86, -0.15);
    const handleR = handleF.clone();
    handleR.position.z = 0.8;
    handleR.position.x = s * (bodyW(0.8) + 0.004);
    root.add(handleF, handleR);
    shellExtras.push(head, tail, handleF, handleR);
  }

  // interior (visible through the glass)
  const cabin = materials.polymer(0x1b1d21);
  cabin.transparent = true;
  const dash = beveledBox(1.62, 0.2, 0.42, cabin, 0.06);
  dash.position.set(0, 0.84, -0.68);
  root.add(dash);
  const parts = { dash };
  const cabinMeshes = [dash];
  if (interior) {
    const hood = beveledBox(0.36, 0.08, 0.16, cabin, 0.03);
    hood.position.set(DRIVER_X, 0.97, -0.62);
    root.add(hood);
    const floor = beveledBox(1.56, 0.04, 2.3, cabin, 0.02);
    floor.position.set(0, 0.3, 0.2);
    root.add(floor);
    for (const s of [-1, 1]) {
      const door = beveledBox(0.03, 0.48, 2.25, cabin, 0.012);
      door.position.set(s * 0.8, 0.66, 0.25);
      root.add(door);
      const cushion = beveledBox(0.5, 0.12, 0.5, cabin, 0.05);
      cushion.position.set(s * 0.37, 0.44, 0.17);
      const back = beveledBox(0.5, 0.62, 0.12, cabin, 0.05);
      back.position.set(s * 0.37, 0.78, 0.47);
      back.rotation.x = 0.2;
      const rest = beveledBox(0.26, 0.16, 0.09, cabin, 0.04);
      rest.position.set(s * 0.37, 1.17, 0.56);
      root.add(cushion, back, rest);
    }
    const bench = beveledBox(1.4, 0.12, 0.45, cabin, 0.05);
    bench.position.set(0, 0.44, 0.98);
    const benchBack = beveledBox(1.4, 0.52, 0.12, cabin, 0.05);
    benchBack.position.set(0, 0.74, 1.24);
    benchBack.rotation.x = 0.3;
    root.add(bench, benchBack, hood);
    parts.hood = hood;
    root.traverse((o) => o.isMesh && o.material === cabin && !cabinMeshes.includes(o) && cabinMeshes.push(o));
  }

  // wheels
  const steerPivots = [];
  const pivots = []; // all four (FL, FR, RL, RR) — non-spinning wheel carriers
  const spins = [];
  for (const az of [FRONT_AXLE, REAR_AXLE]) {
    for (const s of [-1, 1]) {
      const pivot = new THREE.Group();
      pivot.position.set(s * TRACK_HALF, TYRE_R, az);
      const spin = new THREE.Group();
      spin.add(buildWheel(s, rimMat, tyreMat, discMat));
      pivot.add(spin);
      root.add(pivot);
      pivots.push(pivot);
      spins.push(spin);
      if (az === FRONT_AXLE) steerPivots.push(pivot);
    }
  }

  // contact shadow decal
  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 5.3),
    new THREE.MeshBasicMaterial({ map: softRectTexture(), transparent: true, depthWrite: false }),
  );
  shadow.rotation.x = -Math.PI / 2;
  shadow.position.y = 0.006;
  shadow.renderOrder = 1;
  shadow.userData.noOcclude = true;
  root.add(shadow);

  root.traverse((o) => {
    if (o.isMesh && o !== shadow) o.castShadow = true;
  });
  noAO(shadow);
  return { root, body, green, paint, glass, trim, cabin, shellExtras, paintExtras, cabinMeshes, steerPivots, pivots, spins, parts };
}

