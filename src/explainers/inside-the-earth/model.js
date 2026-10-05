import * as THREE from 'three';
import { studioPlinth, materials } from '../../framework/parts.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';

// "What's inside the Earth" — the planet as a product shot: a globe on a
// pedestal, cut open to TRUE-SCALE layers, with the seismic evidence drawn on
// the cut face. See story.js for the angle and the sources.
//
// SCALE: globe radius R = 1.25 units = 6,371 km (1 unit ≈ 5,097 km). Every
// boundary below is a PREM radius over 6,371 — nothing is exaggerated on the
// globe, which is why the crust is a hair-thin rim. The one magnified view is
// the floating crust slab (×60), and step 3 says so.
//
//   inner core  1,221 km  -> 0.192 R
//   outer core  3,480 km  -> 0.546 R   (core-mantle boundary, 2,890 km deep)
//   660 km discontinuity  -> 0.896 R   (upper / lower mantle)
//   lithosphere ~100 km   -> 0.984 R
//   crust (drawn) ~35 km  -> 0.9945 R
//
// SEISMIC RAYS are not drawn by hand: buildRays() traces them through PREM
// (Dziewonski & Anderson 1981) Vp/Vs polynomials with Snell's law at every
// discontinuity and continuous bending in between. The shadow zones that
// come out match the textbook: direct P to ~98°, direct S to ~102°, S dies
// at the core-mantle boundary (Vs = 0 in liquid), PKP from ~145°, and P
// waves refracted by the faster inner core land at ~126-140°, INSIDE the P
// shadow — Inge Lehmann's 1936 evidence.
//
// CUT MODES (one scalar `mode`, snapped per step — the fly-to hides the pop):
//   'sealed' — a whole globe, spins about y
//   'octant' — the +x+y+z octant removed; three quarter-disc faces, the
//              uncut inner-core ball sitting in the notch
//   'half'   — the front (+z) hemisphere removed; one full disc face in the
//              z = 0 plane for the ray diagrams
//
// SEAMLESS LOOP: every timeline drives `flow` and/or `wave` 0 -> 1. Spin is
// one whole turn per lap; convection particles one whole loop; outer-core
// eddies two whole turns; field-line dots one whole lap. The quake (`wave`)
// starts from nothing at 0 and has fully faded by 1.
//
// DISCLOSED CHEATS
//  1. Convection, core flow and waves are sped up enormously (a mantle loop
//     is ~10^8 years; a P wave takes ~20 min to cross). Step hints say so.
//  2. Convection is drawn as two tidy cells; the real mantle is messier.
//  3. The magnetic field is an aligned dipole (the real axis tilts ~10°).
//  4. The borehole on the slab is drawn far wider than its ~23 cm bore.

export const R = 1.25;
export const C = new THREE.Vector3(0, 1.65, 0); // globe centre (rests on the pedestal rim)
const KM = R / 6371;
export const F = {
  inner: 1221.5 / 6371,
  cmb: 3480 / 6371,
  d660: 5711 / 6371,
  lith: 6271 / 6371,
  crust: 6336 / 6371,
};
const RI = F.inner * R;

// the crust slab: ×60, 130 km wide, 100 km deep
const SLAB_X = 60 * KM;
const SLAB_W = 130 * SLAB_X;
const SLAB_H = 100 * SLAB_X;
const SLAB_D = 0.26;
export const SLAB_C = new THREE.Vector3(1.97, 2.8, 0.42);
const SRC_A = (72 * Math.PI) / 180; // where the slab is "cut" from, on the z = 0 face rim

// ---------------------------------------------------------------------------
// PREM ray tracer (km, 2D: y up through the epicentre at the north pole)
// ---------------------------------------------------------------------------
const RE = 6371;
const PREM = [
  // [top radius, Vp(x), Vs(x)], x = r / 6371, deep -> shallow
  [1221.5, (x) => 11.2622 - 6.364 * x * x, (x) => 3.6678 - 4.4475 * x * x],
  [3480, (x) => 11.0487 - 4.0362 * x + 4.8023 * x * x - 13.5732 * x ** 3, () => 0],
  [3630, (x) => 15.3891 - 5.3181 * x + 5.5242 * x * x - 2.5514 * x ** 3, (x) => 6.9254 + 1.4672 * x - 2.0834 * x * x + 0.9783 * x ** 3],
  [5600, (x) => 24.952 - 40.4673 * x + 51.4832 * x * x - 26.6419 * x ** 3, (x) => 11.1671 - 13.7818 * x + 17.4575 * x * x - 9.2777 * x ** 3],
  [5701, (x) => 29.2766 - 23.6027 * x + 5.5242 * x * x - 2.5514 * x ** 3, (x) => 22.3459 - 17.2473 * x - 2.0834 * x * x + 0.9783 * x ** 3],
  [5771, (x) => 19.0957 - 9.8672 * x, (x) => 9.9839 - 4.9324 * x],
  [5971, (x) => 39.7027 - 32.6166 * x, (x) => 22.3512 - 18.5856 * x],
  [6151, (x) => 20.3926 - 12.2569 * x, (x) => 8.9496 - 4.4597 * x],
  [6346.6, (x) => 4.1875 + 3.9382 * x, (x) => 2.1519 + 2.3481 * x],
  [6356, () => 6.8, () => 3.9],
  [6371, () => 5.8, () => 3.2],
];
const premLayer = (r) => {
  for (let i = 0; i < PREM.length; i++) if (r < PREM[i][0]) return i;
  return PREM.length - 1;
};
const premV = (r, wave, i = premLayer(r)) => PREM[i][wave === 'P' ? 1 : 2](r / RE);

// Returns { pts: [[x, y, t]...], end: 'surface'|'cmb', delta (deg) }.
function traceRay(takeoffDeg, wave, depth = 10) {
  let x = 0;
  let y = RE - depth;
  const a0 = (takeoffDeg * Math.PI) / 180;
  let dx = Math.sin(a0);
  let dy = -Math.cos(a0);
  let t = 0;
  const pts = [[x, y, 0]];
  const ds = 3;
  for (let n = 0; n < 40000; n++) {
    const r = Math.hypot(x, y);
    const li = premLayer(r);
    const nx = x + dx * ds;
    const ny = y + dy * ds;
    const r2 = Math.hypot(nx, ny);
    if (r2 >= RE) {
      const b = x * dx + y * dy;
      const s = -b + Math.sqrt(b * b - (r * r - RE * RE));
      t += s / premV(r, wave, li);
      const ex = x + dx * s;
      const ey = y + dy * s;
      pts.push([ex, ey, t]);
      return { pts, end: 'surface', delta: (Math.atan2(ex, ey) * 180) / Math.PI };
    }
    const l2 = premLayer(r2);
    if (l2 !== li) {
      const rb = l2 > li ? PREM[li][0] : PREM[l2][0];
      const b = x * dx + y * dy;
      const disc = Math.max(b * b - (r * r - rb * rb), 0);
      const s = Math.max(0, Math.min(ds, l2 > li ? -b + Math.sqrt(disc) : -b - Math.sqrt(disc)));
      const hx = x + dx * s;
      const hy = y + dy * s;
      t += s / premV(r, wave, li);
      pts.push([hx, hy, t]);
      const ux = hx / rb;
      const uy = hy / rb;
      const dn = dx * ux + dy * uy;
      const v1 = premV(rb, wave, li);
      const v2 = premV(rb, wave, l2);
      if (v2 === 0) return { pts, end: 'cmb' }; // shear waves cannot enter liquid
      const tx = dx - dn * ux;
      const ty = dy - dn * uy;
      const st = Math.hypot(tx, ty);
      const sin2 = (st * v2) / v1;
      if (sin2 >= 1) {
        dx -= 2 * dn * ux;
        dy -= 2 * dn * uy;
      } else {
        const c2 = Math.sqrt(1 - sin2 * sin2) * Math.sign(dn);
        const k = st > 1e-12 ? sin2 / st : 0;
        dx = c2 * ux + tx * k;
        dy = c2 * uy + ty * k;
      }
      x = hx + dx * 0.01;
      y = hy + dy * 0.01;
      continue;
    }
    // continuous bending toward slower rock: d(dir)/ds = ∇u/u, u = 1/v
    const v = premV(r, wave, li);
    const g = -(premV(r + 0.5, wave, li) - premV(r - 0.5, wave, li)) / v;
    const ux = x / r;
    const uy = y / r;
    const dot = dx * ux + dy * uy;
    dx += ds * g * (ux - dot * dx);
    dy += ds * g * (uy - dot * dy);
    const nn = Math.hypot(dx, dy);
    dx /= nn;
    dy /= nn;
    t += ds / v;
    x = nx;
    y = ny;
    if (n % 6 === 0) pts.push([x, y, t]);
  }
  return { pts, end: 'none' };
}

// ---------------------------------------------------------------------------
// noise + canvas textures (generated once)
// ---------------------------------------------------------------------------
function hash2(ix, iy, seed) {
  let h = Math.imul(ix, 374761393) + Math.imul(iy, 668265263) + Math.imul(seed, 1274126177);
  h = (h ^ (h >>> 13)) >>> 0;
  h = Math.imul(h, 1274126177) >>> 0;
  return ((h ^ (h >>> 16)) >>> 0) / 4294967296;
}

// value noise that wraps in x with period px (no seam on the turning globe)
function vnoise(x, y, px, seed) {
  const x0 = Math.floor(x);
  const y0 = Math.floor(y);
  const fx = x - x0;
  const fy = y - y0;
  const sx = fx * fx * (3 - 2 * fx);
  const sy = fy * fy * (3 - 2 * fy);
  const h = (i, j) => hash2(((i % px) + px) % px, j, seed);
  const top = h(x0, y0) + (h(x0 + 1, y0) - h(x0, y0)) * sx;
  const bot = h(x0, y0 + 1) + (h(x0 + 1, y0 + 1) - h(x0, y0 + 1)) * sx;
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

function finishTexture(canvas, wrap = false) {
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  if (wrap) tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// oceans, continents, deserts, ice caps, a cloud deck — not real geography
function earthTexture() {
  const W = 1024;
  const H = 512;
  const seed = 17;
  const canvas = makeCanvas(W, H);
  const img = canvas.getContext('2d').createImageData(W, H);
  const d = img.data;
  for (let y = 0; y < H; y++) {
    const v = y / (H - 1);
    const lat = Math.abs(v - 0.5) * 2;
    for (let x = 0; x < W; x++) {
      const u = x / W;
      const land = fbm(u * 6, v * 4.5, 6, seed, 5);
      const detail = fbm(u * 24, v * 16, 24, seed + 13, 4);
      let r;
      let g;
      let b;
      if (land > 0.515) {
        const dry = clamp01((detail - 0.42) * 2.6) * clamp01(1.4 - Math.abs(lat - 0.3) * 3.4);
        r = 0x3a + (0xb9 - 0x3a) * dry;
        g = 0x62 + (0x98 - 0x62) * dry;
        b = 0x34 + (0x62 - 0x34) * dry;
        const k = 0.74 + 0.26 * clamp01((land - 0.515) * 9);
        r *= k;
        g *= k;
        b *= k;
      } else {
        const deep = clamp01((0.515 - land) * 4);
        r = 0x1d - 0x0e * deep;
        g = 0x52 - 0x24 * deep;
        b = 0x8f - 0x2c * deep;
      }
      const ice = smooth(clamp01((lat - 0.8) / 0.12));
      r += (232 - r) * ice;
      g += (240 - g) * ice;
      b += (248 - b) * ice;
      const cloud = clamp01((fbm(u * 14, v * 9, 14, seed + 31, 5) - 0.55) * 4) * 0.55;
      r += (245 - r) * cloud;
      g += (247 - g) * cloud;
      b += (250 - b) * cloud;
      const o = (y * W + x) * 4;
      d[o] = r;
      d[o + 1] = g;
      d[o + 2] = b;
      d[o + 3] = 255;
    }
  }
  canvas.getContext('2d').putImageData(img, 0, 0);
  return finishTexture(canvas, true);
}

// Colour of the cut face at radius fraction f (sRGB 0-255) + emissive weight.
const lerp = (a, b, t) => a + (b - a) * t;
const mix3 = (c0, c1, t) => [lerp(c0[0], c1[0], t), lerp(c0[1], c1[1], t), lerp(c0[2], c1[2], t)];
function layerColour(f, n) {
  if (f > F.crust) return { c: mix3([0x8a, 0x7a, 0x68], [0xa8, 0x98, 0x82], n), e: 0 };
  if (f > F.lith) return { c: mix3([0x4e, 0x3e, 0x33], [0x62, 0x4e, 0x40], n), e: 0 };
  if (f > F.cmb) {
    // cooler, browner near the top; red-hot toward the core
    const t = (f - F.cmb) / (F.lith - F.cmb);
    const base = mix3([0xb0, 0x34, 0x18], [0x5c, 0x2c, 0x1f], Math.pow(t, 0.7));
    return { c: mix3(base, mix3(base, [0x2a, 0x10, 0x08], 0.35), n * 0.6), e: 0.4 * Math.pow(1 - t, 2.6) };
  }
  if (f > F.inner) {
    const t = (f - F.inner) / (F.cmb - F.inner);
    const base = mix3([0xff, 0xae, 0x3a], [0xf0, 0x6a, 0x16], t);
    return { c: mix3(base, [0xff, 0xd0, 0x70], n * 0.35), e: 0.62 };
  }
  const t = f / F.inner;
  return { c: mix3([0xff, 0xef, 0xc4], [0xff, 0xd2, 0x86], t), e: 0.8 };
}

// The cross-section disc: colour map + emissive map, radially symmetric
// (the quarter faces sample whichever quadrant their UVs land on).
function faceTextures() {
  const S = 1024;
  const cc = makeCanvas(S, S);
  const ec = makeCanvas(S, S);
  const ci = cc.getContext('2d').createImageData(S, S);
  const ei = ec.getContext('2d').createImageData(S, S);
  const rad = S / 2;
  for (let y = 0; y < S; y++) {
    for (let x = 0; x < S; x++) {
      const dx = x + 0.5 - rad;
      const dy = y + 0.5 - rad;
      const f = Math.hypot(dx, dy) / rad;
      const o = (y * S + x) * 4;
      if (f > 1.002) {
        ci.data[o + 3] = 0;
        ei.data[o + 3] = 255;
        continue;
      }
      const ang = Math.atan2(dy, dx);
      // grain: fine speckle everywhere, radial streaks in the flowing layers
      const n =
        0.6 * fbm((x / S) * 40, (y / S) * 40, 1e6, 7, 3) +
        0.4 * fbm(f * 30, ((ang + Math.PI) / TAU) * 64, 64, 11, 3);
      const { c, e } = layerColour(Math.min(f, 1), n);
      let dark = 1;
      // boundary hairlines so each layer reads as a layer
      for (const [b, w, k] of [
        [F.cmb, 2.2, 0.45],
        [F.d660, 1.4, 0.8],
        [F.lith, 1.2, 0.75],
        [F.crust, 1.0, 0.7],
      ]) {
        const dpx = Math.abs(f - b) * rad;
        if (dpx < w) dark = Math.min(dark, lerp(k, 1, dpx / w));
      }
      ci.data[o] = c[0] * dark;
      ci.data[o + 1] = c[1] * dark;
      ci.data[o + 2] = c[2] * dark;
      ci.data[o + 3] = 255;
      const ev = e * (0.85 + 0.3 * n) * dark;
      ei.data[o] = Math.min(255, c[0] * ev);
      ei.data[o + 1] = Math.min(255, c[1] * ev);
      ei.data[o + 2] = Math.min(255, c[2] * ev);
      ei.data[o + 3] = 255;
    }
  }
  cc.getContext('2d').putImageData(ci, 0, 0);
  ec.getContext('2d').putImageData(ei, 0, 0);
  return { map: finishTexture(cc), emissiveMap: finishTexture(ec) };
}

// crust slab, front face: km coords x 0..130, depth 0..100
function slabTexture() {
  const W = 1040;
  const H = 800;
  const c = makeCanvas(W, H);
  const ctx = c.getContext('2d');
  const X = (km) => (km / 130) * W;
  const Y = (km) => (km / 100) * H;
  // Moho depth along x: 35 km continent, thinning over the margin to the
  // ocean floor's 4 + 7 km
  const moho = (x) => lerp(35, 11, smooth((x - 58) / 30));
  const sea = (x) => lerp(0, 4, smooth((x - 66) / 18));
  // mantle lid, with a hotter, softer asthenosphere at the bottom
  const g = ctx.createLinearGradient(0, 0, 0, H);
  g.addColorStop(0, '#5b4638');
  g.addColorStop(0.82, '#6a4232');
  g.addColorStop(1, '#8e4426');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, W, H);
  // crust
  ctx.beginPath();
  ctx.moveTo(0, 0);
  for (let x = 0; x <= 130; x += 1) ctx.lineTo(X(x), Y(sea(x)));
  for (let x = 130; x >= 0; x -= 1) ctx.lineTo(X(x), Y(moho(x)));
  ctx.closePath();
  const cg = ctx.createLinearGradient(0, 0, 0, Y(35));
  cg.addColorStop(0, '#a89880');
  cg.addColorStop(1, '#7e6f60');
  ctx.fillStyle = cg;
  ctx.fill();
  // oceanic crust reads darker (basalt)
  ctx.save();
  ctx.clip();
  ctx.fillStyle = 'rgba(40,44,52,0.55)';
  ctx.fillRect(X(78), 0, W, H);
  ctx.restore();
  // ocean water
  ctx.beginPath();
  ctx.moveTo(X(66), 0);
  for (let x = 66; x <= 130; x += 1) ctx.lineTo(X(x), Y(sea(x)));
  ctx.lineTo(W, 0);
  ctx.closePath();
  ctx.fillStyle = '#1d5a92';
  ctx.fill();
  // grain
  for (let i = 0; i < 9000; i++) {
    const h = hash2(i, 3, 5);
    const k = hash2(i, 9, 5);
    ctx.fillStyle = k < 0.5 ? 'rgba(0,0,0,0.13)' : 'rgba(255,240,220,0.08)';
    ctx.fillRect(h * W, hash2(i, 7, 5) * H, 2, 2);
  }
  // Moho: a crisp pale line
  ctx.strokeStyle = 'rgba(255,226,180,0.85)';
  ctx.lineWidth = 3;
  ctx.beginPath();
  for (let x = 0; x <= 130; x += 1) ctx[x ? 'lineTo' : 'moveTo'](X(x), Y(moho(x)));
  ctx.stroke();
  // depth ticks every 10 km on the right edge
  ctx.fillStyle = 'rgba(255,255,255,0.55)';
  for (let k = 10; k < 100; k += 10) ctx.fillRect(W - (k % 50 ? 18 : 34), Y(k) - 1.5, 40, 3);
  return finishTexture(c);
}

// Rebuild a partial SphereGeometry's UVs so the equirectangular texture
// stays anchored to phi/theta (three's default stretches it over the range).
function partialSphere(r, phiStart, phiLen, thetaStart, thetaLen, ws = 128, hs = 64) {
  const g = new THREE.SphereGeometry(r, ws, hs, phiStart, phiLen, thetaStart, thetaLen);
  const uv = g.attributes.uv;
  for (let i = 0; i < uv.count; i++) {
    const u = uv.getX(i);
    const v = 1 - uv.getY(i);
    uv.setXY(i, (phiStart + u * phiLen) / TAU, 1 - (thetaStart + v * thetaLen) / Math.PI);
  }
  return g;
}

// thin cylinder between two points
function strut(a, b, radius, mat) {
  const len = a.distanceTo(b);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(radius, radius, len, 6, 1), mat);
  m.position.copy(a).add(b).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), b.clone().sub(a).normalize());
  return m;
}

// Flat ribbon along a 2D polyline, non-indexed so drawRange can grow it
// segment by segment (6 vertices per segment).
function ribbon(points, width, z) {
  const n = points.length;
  const pos = new Float32Array((n - 1) * 18);
  const nrm = [];
  for (let i = 0; i < n; i++) {
    const a = points[Math.max(0, i - 1)];
    const b = points[Math.min(n - 1, i + 1)];
    const tx = b[0] - a[0];
    const ty = b[1] - a[1];
    const l = Math.hypot(tx, ty) || 1;
    nrm.push([(-ty / l) * width * 0.5, (tx / l) * width * 0.5]);
  }
  for (let i = 0; i < n - 1; i++) {
    const p = points[i];
    const q = points[i + 1];
    const np = nrm[i];
    const nq = nrm[i + 1];
    const v = [
      [p[0] + np[0], p[1] + np[1]],
      [p[0] - np[0], p[1] - np[1]],
      [q[0] + nq[0], q[1] + nq[1]],
      [q[0] - nq[0], q[1] - nq[1]],
    ];
    const tri = [v[0], v[1], v[2], v[2], v[1], v[3]];
    tri.forEach((pt, k) => pos.set([pt[0], pt[1], z], i * 18 + k * 3));
  }
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  // explicit +z normals: GTAO's normal pass reads them, and a missing
  // attribute there turns the whole ribbon into a dark occlusion smear
  const nz = new Float32Array(pos.length);
  for (let i = 2; i < nz.length; i += 3) nz[i] = 1;
  g.setAttribute('normal', new THREE.BufferAttribute(nz, 3));
  return g;
}

// ---------------------------------------------------------------------------
export function buildEarth({ scene }) {
  const root = new THREE.Group();
  scene.add(root);

  // --- staging: plinth + a short cast pedestal the globe rests in ----------
  const plinth = studioPlinth({ w: 3.6, h: 0.26, d: 3.0 });
  root.add(plinth);
  const PED_R = 0.6; // rim radius the sphere rests on
  const pedTop = C.y - Math.sqrt(R * R - PED_R * PED_R);
  const pedMat = materials.paintedMetal(0x2a2c31);
  pedMat.roughness = 0.78;
pedMat.clearcoat = 0;
  const ped = new THREE.Mesh(
    new THREE.LatheGeometry(
      [
        new THREE.Vector2(0.0, 0.26),
        new THREE.Vector2(0.78, 0.26),
        new THREE.Vector2(0.8, 0.285),
        new THREE.Vector2(0.7, 0.33),
        new THREE.Vector2(0.64, pedTop - 0.03),
        new THREE.Vector2(PED_R + 0.03, pedTop),
        new THREE.Vector2(PED_R - 0.02, pedTop + 0.004),
        new THREE.Vector2(0.0, pedTop - 0.06),
      ],
      72,
    ),
    pedMat,
  );
  ped.castShadow = true;
  ped.receiveShadow = true;
  root.add(ped);

  const globe = new THREE.Group();
  globe.position.copy(C);
  root.add(globe);

  const earthMap = earthTexture();
  const surfMat = new THREE.MeshStandardMaterial({ map: earthMap, roughness: 0.62, metalness: 0 });

  // sealed globe (spins) + a thin fresnel atmosphere
  const sealed = new THREE.Group();
  globe.add(sealed);
  const sealedMesh = new THREE.Mesh(new THREE.SphereGeometry(R, 128, 64), surfMat);
  sealedMesh.castShadow = true;
  sealed.add(sealedMesh);
  const atmo = new THREE.Mesh(
    new THREE.SphereGeometry(R * 1.022, 96, 48),
    new THREE.ShaderMaterial({
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      uniforms: { uColor: { value: new THREE.Color(0x6fb2ff) } },
      vertexShader: /* glsl */ `
        varying vec3 vN; varying vec3 vV;
        void main() {
          vec4 mv = modelViewMatrix * vec4(position, 1.0);
          vN = normalize(normalMatrix * normal);
          vV = normalize(-mv.xyz);
          gl_Position = projectionMatrix * mv;
        }`,
      fragmentShader: /* glsl */ `
        uniform vec3 uColor; varying vec3 vN; varying vec3 vV;
        void main() {
          float f = pow(1.0 - max(dot(vN, vV), 0.0), 3.0);
          gl_FragColor = vec4(uColor * f * 0.55, 1.0);
        }`,
    }),
  );
  sealed.add(atmo);

  // cut-face material, shared by every face
  const faceTex = faceTextures();
  const faceMat = new THREE.MeshStandardMaterial({
    map: faceTex.map,
    emissiveMap: faceTex.emissiveMap,
    emissive: 0xffffff,
    emissiveIntensity: 1.1,
    roughness: 0.82,
    metalness: 0,
  });

  // inner-core ball — uncut, sits in the octant notch
  const coreMat = new THREE.MeshStandardMaterial({
    color: 0xffd894,
    emissive: 0xffb04a,
    emissiveIntensity: 0.9,
    roughness: 0.35,
    metalness: 0.2,
  });
  const coreBall = new THREE.Mesh(new THREE.SphereGeometry(RI, 64, 32), coreMat);

  // --- octant cut ----------------------------------------------------------
  const octant = new THREE.Group();
  globe.add(octant);
  octant.add(new THREE.Mesh(partialSphere(R, Math.PI, 1.5 * Math.PI, 0, Math.PI / 2, 128, 32), surfMat));
  octant.add(new THREE.Mesh(partialSphere(R, 0, TAU, Math.PI / 2, Math.PI / 2, 128, 32), surfMat));
  octant.children.forEach((m) => (m.castShadow = true));
  // face frames: each quarter disc in its own frame (local xy = face plane)
  const faceFrames = [
    { start: 0, rot: new THREE.Euler(0, 0, 0) }, // z = 0 plane, normal +z
    { start: Math.PI / 2, rot: new THREE.Euler(0, Math.PI / 2, 0) }, // x = 0, normal +x
    { start: 1.5 * Math.PI, rot: new THREE.Euler(-Math.PI / 2, 0, 0) }, // y = 0, normal +y
  ].map(({ start, rot }) => {
    const fr = new THREE.Group();
    fr.rotation.copy(rot);
    fr.userData.start = start;
    fr.add(new THREE.Mesh(new THREE.CircleGeometry(R * 0.9995, 96, start, Math.PI / 2), faceMat));
    octant.add(fr);
    return fr;
  });
  octant.add(coreBall);

  // --- half cut (front hemisphere removed) ---------------------------------
  const half = new THREE.Group();
  globe.add(half);
  const halfShell = new THREE.Mesh(partialSphere(R, Math.PI, Math.PI, 0, Math.PI, 128, 64), surfMat);
  halfShell.castShadow = true;
  half.add(halfShell);
  half.add(new THREE.Mesh(new THREE.CircleGeometry(R * 0.9995, 160), faceMat));
  // a glow disc over the inner core, pulsed when the copy is about it
  const coreGlowMat = new THREE.MeshBasicMaterial({
    color: 0xffc070,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    blending: THREE.AdditiveBlending,
  });
  const coreGlow = new THREE.Mesh(new THREE.CircleGeometry(RI * 1.02, 64), coreGlowMat);
  coreGlow.position.z = 0.004;
  half.add(coreGlow);

  // point on the z = 0 face (either cut mode), radius fraction f, angle a°
  const facePt = (f, aDeg, z = 0.012) => {
    const a = (aDeg * Math.PI) / 180;
    return new THREE.Vector3(f * R * Math.cos(a), f * R * Math.sin(a), z);
  };

  // --- mantle convection (octant, z = 0 face) ------------------------------
  // Two cells share a hot upwelling at 45°; cool rock sinks at ~4° and ~86°.
  const CELLS = [
    { ac: 22.5, sigma: 1 },
    { ac: 67.5, sigma: -1 },
  ];
  const CELL_W = 18;
  const CELL_FM = 0.765;
  const CELL_FH = 0.175;
  const PER_CELL = 37; // not a divisor-friendly count: review-shots seeks at 30%/60%, and 40 aliased to a frozen-looking frame
  const cellPt = (cell, s, z = 0.014) => {
    const a = cell.ac + cell.sigma * CELL_W * Math.cos(TAU * s);
    const f = CELL_FM + CELL_FH * Math.sin(TAU * s);
    return facePt(f, a, z);
  };
  const convect = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.017, 10, 8),
    new THREE.MeshBasicMaterial({ toneMapped: false }),
    CELLS.length * PER_CELL,
  );
  octant.add(convect);
  const convectPaths = new THREE.Group();
  const pathMat = new THREE.MeshBasicMaterial({ color: 0xffc27a, transparent: true, opacity: 0.22, depthWrite: false });
  for (const cell of CELLS) {
    const pts = [];
    for (let k = 0; k <= 96; k++) pts.push(cellPt(cell, k / 96, 0.008));
    const curve = new THREE.CatmullRomCurve3(pts, true);
    convectPaths.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 128, 0.005, 5, true), pathMat));
  }
  octant.add(convectPaths);
  const hot = new THREE.Color(0xffb35c);
  const cold = new THREE.Color(0x4a2620);
  const tmpC = new THREE.Color();
  const tmpM = new THREE.Matrix4();

  // --- outer-core eddies (octant, all three faces) -------------------------
  const EDDY_A = [24, 66];
  const EDDY_F = (F.inner + F.cmb) / 2 + 0.01;
  const PER_EDDY = 20;
  const eddies = faceFrames.map((fr) => {
    const im = new THREE.InstancedMesh(
      new THREE.SphereGeometry(0.019, 8, 6),
      new THREE.MeshBasicMaterial({ color: 0xfff0c0, toneMapped: false }),
      EDDY_A.length * PER_EDDY,
    );
    fr.add(im);
    return im;
  });

  // --- magnetic field (dipole lines + flowing dots) ------------------------
  const field = new THREE.Group();
  globe.add(field);
  const fieldMat = new THREE.MeshBasicMaterial({ color: 0x8cc4ff, transparent: true, opacity: 0.42, depthWrite: false });
  const fieldCurves = [];
  for (let k = 0; k < 8; k++) {
    const az = ((k + 0.5) / 8) * TAU;
    for (const Lf of [1.5, 2.15]) {
      const L = Lf * R;
      const th0 = Math.asin(Math.sqrt((R * 1.01) / L));
      const pts = [];
      for (let i = 0; i <= 80; i++) {
        // south -> north: the field outside runs from the southern hemisphere to the northern
        const th = Math.PI - th0 - ((Math.PI - 2 * th0) * i) / 80;
        const r = L * Math.sin(th) ** 2;
        pts.push(new THREE.Vector3(r * Math.sin(th) * Math.cos(az), r * Math.cos(th), r * Math.sin(th) * Math.sin(az)));
      }
      const curve = new THREE.CatmullRomCurve3(pts);
      fieldCurves.push({ curve, az, L });
      field.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 96, 0.0055, 5, false), fieldMat));
    }
  }
  const DOTS_PER_LINE = 3;
  const fieldDots = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.02, 8, 6),
    new THREE.MeshBasicMaterial({ color: 0xcfe6ff, toneMapped: false, transparent: true }),
    fieldCurves.length * DOTS_PER_LINE,
  );
  field.add(fieldDots);

  // --- seismic rays (half mode) -------------------------------------------
  const rays = new THREE.Group();
  half.add(rays);
  // flush with the face: GTAO renders every mesh into its depth pass, so a
  // raised ribbon grows a dark occlusion halo. polygonOffset keeps it on top.
  const RAY_Z = 0.0012;
  const T_MAX = 1560; // s — the grazing S wave lands at ~1540 s
  const rayMats = {
    P: new THREE.MeshBasicMaterial({ color: 0xffa640, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    S: new THREE.MeshBasicMaterial({ color: 0x57d8ff, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -2, polygonOffsetUnits: -4 }),
    hi: new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false, toneMapped: false, polygonOffset: true, polygonOffsetFactor: -3, polygonOffsetUnits: -6 }),
  };
  const tipGeo = new THREE.SphereGeometry(0.02, 10, 8);
  const rayList = [];
  function addRay(takeoff, wave, kind, group, side) {
    const tr = traceRay(takeoff, wave);
    // resample to ~35 km steps, mirrored for the left side
    const pts = [];
    let last = null;
    for (const [x, y, t] of tr.pts) {
      if (last && Math.hypot(x - last[0], y - last[1]) < 35) continue;
      pts.push([side * x * KM, y * KM, t]);
      last = [x, y];
    }
    const end = tr.pts[tr.pts.length - 1];
    pts.push([side * end[0] * KM, end[1] * KM, end[2]]);
    const width = kind === 'hi' ? 0.03 : 0.02;
    const mesh = new THREE.Mesh(ribbon(pts, width, RAY_Z), rayMats[kind]);
    mesh.geometry.setDrawRange(0, 0);
    const tip = new THREE.Mesh(tipGeo, rayMats[kind]);
    tip.scale.setScalar(kind === 'hi' ? 1.3 : 1);
    group.add(mesh, tip);
    const r = { pts, mesh, tip, end: tr.end, delta: tr.delta, wave };
    rayList.push(r);
    return r;
  }
  // X-ray set: direct P + PKP through the core; direct S + S dying at the CMB
  const xray = new THREE.Group();
  rays.add(xray);
  const lehmann = new THREE.Group();
  rays.add(lehmann);
  const xrayRays = [];
  for (const side of [1, -1]) {
    for (const a of [13.6, 17, 21, 26]) xrayRays.push(addRay(a, 'P', 'P', xray, side));
    for (const a of [7.5, 10, 12.5]) xrayRays.push(addRay(a, 'P', 'P', xray, side));
    for (const a of [14.2, 17.5, 21.5, 26.5]) xrayRays.push(addRay(a, 'S', 'S', xray, side));
    for (const a of [6, 9.5, 12.5]) xrayRays.push(addRay(a, 'S', 'S', xray, side));
  }
  // Lehmann set: P only, plus the inner-core refractions that land in the shadow
  const lehmannRays = [];
  for (const side of [1, -1]) {
    for (const a of [13.6, 17, 22]) lehmannRays.push(addRay(a, 'P', 'P', lehmann, side));
    for (const a of [8, 10.5, 12.5]) lehmannRays.push(addRay(a, 'P', 'P', lehmann, side));
    for (const a of [5.6, 6.0]) lehmannRays.push(addRay(a, 'P', 'hi', lehmann, side));
  }

  // shadow-zone arcs on the rim. Δ is measured from the north pole toward +x.
  const arcMat = new THREE.MeshBasicMaterial({ color: 0xff5a4e, transparent: true, opacity: 0.9, toneMapped: false });
  const rimArc = (d0, d1) => {
    // torus arcs start on +x and run counter-clockwise: polar φ = 90° - Δ
    const p0 = 90 - Math.max(d0, d1);
    const len = Math.abs(d1 - d0);
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(R * 1.016, 0.017, 8, 96, (len * Math.PI) / 180),
      arcMat,
    );
    m.rotation.z = (p0 * Math.PI) / 180;
    return m;
  };
  const sShadow = rimArc(103, 257);
  const pShadow = new THREE.Group();
  pShadow.add(rimArc(103, 142), rimArc(-142, -103));
  half.add(sShadow, pShadow);

  // the quake itself: a flash at the north pole
  const quakeMat = new THREE.MeshBasicMaterial({ color: 0xffe2a8, transparent: true, depthWrite: false, toneMapped: false });
  const quake = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), quakeMat);
  quake.position.set(0, R - 10 * KM, RAY_Z);
  half.add(quake);
  const quakeRingMat = new THREE.MeshBasicMaterial({ color: 0xffd08a, transparent: true, depthWrite: false, toneMapped: false });
  const quakeRing = new THREE.Mesh(new THREE.RingGeometry(0.9, 1, 48), quakeRingMat);
  quakeRing.position.copy(quake.position);
  half.add(quakeRing);

  // --- the ×60 crust slab --------------------------------------------------
  const slab = new THREE.Group();
  slab.position.copy(SLAB_C);
  root.add(slab);
  const slabFront = new THREE.MeshStandardMaterial({ map: slabTexture(), roughness: 0.85 });
  const slabSide = new THREE.MeshStandardMaterial({ color: 0x4a3a30, roughness: 0.9 });
  const slabTop = new THREE.MeshStandardMaterial({ color: 0x3f6a3a, roughness: 0.9 });
  const slabBox = new THREE.Mesh(new THREE.BoxGeometry(SLAB_W, SLAB_H, SLAB_D), [
    slabSide,
    slabSide,
    slabTop,
    slabSide,
    slabFront,
    slabSide,
  ]);
  slab.add(slabBox);
  // ocean strip on top (right-hand part)
  const oceanTop = new THREE.Mesh(
    new THREE.PlaneGeometry(SLAB_W * (54 / 130), SLAB_D),
    new THREE.MeshStandardMaterial({ color: 0x1f5d96, roughness: 0.3 }),
  );
  oceanTop.rotation.x = -Math.PI / 2;
  oceanTop.position.set(SLAB_W * (0.5 - 27 / 130), SLAB_H / 2 + 0.002, 0);
  slab.add(oceanTop);
  const slabPt = (xKm, dKm, z = SLAB_D / 2 + 0.004) =>
    new THREE.Vector3((xKm / 130 - 0.5) * SLAB_W, (0.5 - dKm / 100) * SLAB_H, z);
  // the Kola borehole: 12.3 km, at the slab's scale
  const boreMat = new THREE.MeshBasicMaterial({ color: 0xfff1d6, toneMapped: false });
  const bore = strut(slabPt(25, 0, SLAB_D / 2 + 0.008), slabPt(25, 12.262, SLAB_D / 2 + 0.008), 0.011, boreMat);
  // dark sheath so the pale shaft separates from the pale granite
  const sheath = strut(slabPt(25, -0.3, SLAB_D / 2 + 0.003), slabPt(25, 12.6, SLAB_D / 2 + 0.003), 0.019, new THREE.MeshBasicMaterial({ color: 0x1a120c }));
  slab.add(sheath, bore);
  const rig = new THREE.Mesh(new THREE.ConeGeometry(0.018, 0.06, 4), materials.paintedMetal(0xc8c2b4));
  rig.position.copy(slabPt(25, 0, SLAB_D / 2 - 0.02)).add(new THREE.Vector3(0, 0.03, 0));
  slab.add(rig);
  // projection lines from the true-scale patch on the globe rim to the slab
  const projMat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, depthWrite: false });
  const proj = new THREE.Group();
  root.add(proj);
  {
    const n = new THREE.Vector3(Math.cos(SRC_A), Math.sin(SRC_A), 0);
    const t = new THREE.Vector3(-Math.sin(SRC_A), Math.cos(SRC_A), 0);
    const hw = 65 * KM;
    const dep = 100 * KM;
    const ps = C.clone().add(n.clone().multiplyScalar(R)).add(new THREE.Vector3(0, 0, 0.004));
    // patch corners: left/right follow -t/+t (t points toward smaller x)
    const pTL = ps.clone().addScaledVector(t, hw);
    const pTR = ps.clone().addScaledVector(t, -hw);
    const pBL = pTL.clone().addScaledVector(n, -dep);
    const pBR = pTR.clone().addScaledVector(n, -dep);
    const w = (v) => slab.localToWorld(v.clone());
    slab.updateMatrixWorld(true);
    const sTL = w(slabPt(0, 0));
    const sTR = w(slabPt(130, 0));
    const sBL = w(slabPt(0, 100));
    const sBR = w(slabPt(130, 100));
    for (const [a, b] of [
      [pTL, sTL],
      [pTR, sTR],
      [pBL, sBL],
      [pBR, sBR],
    ])
      proj.add(strut(a, b, 0.0032, projMat));
    for (const [a, b] of [
      [pTL, pTR],
      [pTR, pBR],
      [pBR, pBL],
      [pBL, pTL],
    ])
      proj.add(strut(a, b, 0.0035, projMat));
    proj.userData.src = ps;
  }

  // --- callouts ------------------------------------------------------------
  const labels = calloutSets(['exterior', 'layers', 'crust', 'mantle', 'waves', 'core', 'inner']);
  const anchor = (parent, v) => {
    const o = new THREE.Object3D();
    o.position.copy(v);
    parent.add(o);
    return o;
  };
  // exterior — on the static globe frame so it doesn't ride the spin
  labels.add('exterior', globe, 'Crust · all we’ve touched', new THREE.Vector3(0.3, 0.72, 0.62).normalize().multiplyScalar(R), 45, 60);

  labels.add('layers', octant, 'Crust', facePt(0.999, 40), 30, 70);
  labels.add('layers', octant, 'Upper mantle', facePt(0.94, 28), 18, 70);
  labels.add('layers', octant, 'Lower mantle', facePt(0.72, 20), 5, 80);
  labels.add('layers', octant, 'Outer core · liquid', facePt(0.37, 12), -15, 90);
  labels.add('layers', octant, 'Inner core · solid', new THREE.Vector3(1, 0.45, 1).normalize().multiplyScalar(RI), -35, 95);

  labels.add('crust', slab, 'Kola borehole · 12.3 km', slabPt(30, 12.262), 115, 90);
  labels.add('crust', slab, 'Continental crust · ~35 km', slabPt(40, 24), -20, 50);
  labels.add('crust', slab, 'Moho', slabPt(50, 35.3), -60, 45);
  labels.add('crust', slab, 'Oceanic crust · ~7 km', slabPt(112, 7.5), 110, 55);
  labels.add('crust', slab, 'Mantle', slabPt(100, 70), -20, 40);
  labels.add('crust', globe, 'Crust at true scale', facePt(0.997, (SRC_A * 180) / Math.PI - 8, 0.03), 62, 80);

  labels.add('mantle', octant, 'Hot rock rising', facePt(0.8, 45, 0.02), 40, 70);
  labels.add('mantle', octant, 'Cool rock sinking', facePt(0.84, 5, 0.02), -15, 60);
  labels.add('mantle', octant, 'Core–mantle boundary · 2,890 km', facePt(F.cmb, 28, 0.02), -40, 80);

  // wave labels sit on specific right-hand rays at points they reach early
  const rayAt = (r, tSec) => {
    const p = r.pts.find((q) => q[2] >= tSec) ?? r.pts[r.pts.length - 1];
    return new THREE.Vector3(p[0], p[1], RAY_Z);
  };
  const xP = xrayRays.find((r) => r.wave === 'P');
  const xS = xrayRays.filter((r) => r.wave === 'S' && r.pts[0] && r.end === 'surface')[2];
  const xSdead = xrayRays.filter((r) => r.wave === 'S' && r.end === 'cmb')[2]; // right side, 12.5°
  labels.add('waves', half, 'Earthquake', quake.position.clone(), 40, 55);
  labels.add('waves', half, 'P wave', rayAt(xrayRays[2], 170), 12, 135);
  labels.add('waves', half, 'S wave', rayAt(xS, 300), 2, 140);
  labels.add('waves', half, 'S waves die here', rayAt(xSdead, 1e9), -22, 125);
  labels.add('waves', half, 'S-wave shadow zone', new THREE.Vector3(R * 1.016 * Math.sin(2.6), R * 1.016 * Math.cos(2.6), 0), -30, 60);
  void xP;

  labels.add('core', octant, 'Liquid iron, churning', facePt(EDDY_F, EDDY_A[0], 0.02), 80, 175);
  {
    // the outer line whose loop swings toward screen-right from the step camera (az ~40°)
    const fc = fieldCurves.find((c) => c.L > 2 * R && Math.abs(c.az - (7.5 / 8) * TAU) < 1e-6) ?? fieldCurves[0];
    labels.add('core', field, 'Magnetic field', fc.curve.getPointAt(0.5), 20, 50);
  }

  const hiRight = lehmannRays.find((r) => r.pts.length && r === lehmannRays[6]);
  {
    // where the highlighted ray grazes the inner core
    let best = hiRight.pts[0];
    for (const p of hiRight.pts) if (Math.hypot(p[0], p[1]) < Math.hypot(best[0], best[1])) best = p;
    labels.add('inner', half, 'Bent by the inner core', new THREE.Vector3(best[0], best[1], RAY_Z), -25, 110);
    const end = hiRight.pts[hiRight.pts.length - 1];
    labels.add('inner', half, 'Lands in the P-wave shadow', new THREE.Vector3(end[0], end[1], RAY_Z), -30, 55);
  }
  labels.add('inner', half, 'Inner core · ~5,400 °C', new THREE.Vector3(RI * 0.5, RI * 0.55, 0.01), 35, 120);

  // --- pose ---------------------------------------------------------------
  const state = {
    mode: 'sealed',
    spin: 0, // sealed-globe turns
    flow: 0, // lap phase for particles
    wave: 0, // quake lap phase
    rays: 'none', // 'none' | 'xray' | 'lehmann'
    slab: 0,
    convect: 0,
    swirl: 0,
    field: 0,
    glow: 0, // inner-core pulse (0/1 enables it)
  };

  function apply() {
    const s = state;
    sealed.visible = s.mode === 'sealed';
    octant.visible = s.mode === 'octant';
    half.visible = s.mode === 'half';
    sealed.rotation.y = s.spin * TAU;

    slab.visible = proj.visible = s.slab > 0;

    // convection
    convect.visible = convectPaths.visible = s.convect > 0;
    if (convect.visible) {
      let i = 0;
      for (const cell of CELLS) {
        for (let k = 0; k < PER_CELL; k++) {
          const u = (k / PER_CELL + s.flow) % 1;
          tmpM.makeTranslation(cellPt(cell, u));
          convect.setMatrixAt(i, tmpM);
          // hottest just after the bottom of the loop, coolest after the top
          const heat = 0.5 + 0.5 * Math.cos(TAU * (u + 0.12));
          convect.setColorAt(i, tmpC.copy(cold).lerp(hot, heat));
          i++;
        }
      }
      convect.instanceMatrix.needsUpdate = true;
      convect.instanceColor.needsUpdate = true;
    }

    // outer-core eddies: two whole turns per lap, neighbours counter-rotate
    for (const [fi, im] of eddies.entries()) {
      im.visible = s.swirl > 0 && s.mode === 'octant';
      if (!im.visible) continue;
      const start = faceFrames[fi].userData.start;
      let i = 0;
      EDDY_A.forEach((aDeg, e) => {
        const a = start + (aDeg * Math.PI) / 180;
        const cx = EDDY_F * R * Math.cos(a);
        const cy = EDDY_F * R * Math.sin(a);
        const dir = e % 2 ? -1 : 1;
        for (let k = 0; k < PER_EDDY; k++) {
          const rr = (0.035 + 0.085 * ((k * 7) % PER_EDDY) / PER_EDDY) * R;
          const th = (k / PER_EDDY) * TAU * 3.0 + dir * 2 * TAU * s.flow;
          tmpM.makeTranslation(cx + rr * Math.cos(th), cy + rr * Math.sin(th), 0.012);
          im.setMatrixAt(i++, tmpM);
        }
      });
      im.instanceMatrix.needsUpdate = true;
    }

    // field
    field.visible = s.field > 0;
    if (field.visible) {
      let i = 0;
      for (const fc of fieldCurves) {
        for (let k = 0; k < DOTS_PER_LINE; k++) {
          const u = (k / DOTS_PER_LINE + s.flow) % 1;
          tmpM.makeTranslation(fc.curve.getPointAt(u));
          fieldDots.setMatrixAt(i++, tmpM);
        }
      }
      fieldDots.instanceMatrix.needsUpdate = true;
    }

    // inner core pulse
    const pulse = s.glow > 0 ? 0.5 + 0.5 * Math.sin(TAU * s.flow * 2) : 0;
    coreMat.emissiveIntensity = 0.9 + 0.5 * pulse;
    coreGlowMat.opacity = s.glow > 0 ? 0.12 + 0.2 * pulse : 0;

    // rays: grow by travel time, fade out before the wrap
    rays.visible = s.rays !== 'none';
    xray.visible = s.rays === 'xray';
    lehmann.visible = s.rays === 'lehmann';
    sShadow.visible = s.rays === 'xray';
    pShadow.visible = s.rays === 'lehmann';
    const w = s.wave;
    const fade = 1 - smooth((w - 0.8) / 0.16);
    for (const m of Object.values(rayMats)) m.opacity = fade;
    const flash = w < 0.02 ? w / 0.02 : Math.max(0, 1 - (w - 0.02) / 0.2);
    quake.visible = quakeRing.visible = rays.visible && flash > 0.001;
    quakeMat.opacity = flash;
    quake.scale.setScalar(0.6 + 0.8 * flash);
    const ringR = 0.02 + 0.5 * smooth(clamp01(w / 0.2));
    quakeRing.scale.setScalar(ringR);
    quakeRingMat.opacity = flash * 0.8;
    if (rays.visible) {
      const tau = (w / 0.72) * T_MAX;
      const list = s.rays === 'xray' ? xrayRays : lehmannRays;
      for (const r of list) {
        const pts = r.pts;
        let k = 0;
        while (k < pts.length - 1 && pts[k + 1][2] <= tau) k++;
        r.mesh.geometry.setDrawRange(0, k * 6);
        const arrived = k >= pts.length - 1;
        if (arrived) {
          const e = pts[pts.length - 1];
          r.tip.position.set(e[0], e[1], RAY_Z + 0.002);
          // an S ray that died at the core keeps a marker where it stopped
          r.tip.visible = r.end === 'cmb';
        } else {
          const a = pts[k];
          const b = pts[k + 1];
          const f = clamp01((tau - a[2]) / (b[2] - a[2] || 1));
          r.tip.position.set(lerp(a[0], b[0], f), lerp(a[1], b[1], f), RAY_Z + 0.002);
          r.tip.visible = tau > 0;
        }
      }
    }
  }
  apply();

  return {
    group: root,
    state,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
    parts: { globe, sealed, octant, half, coreBall, slab, field, rays, convect, quake },
  };
}
