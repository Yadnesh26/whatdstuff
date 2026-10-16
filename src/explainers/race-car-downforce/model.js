import * as THREE from 'three';
import { materials } from '../../framework/parts.js';
import { beveledBox, tubeAlong } from '../../framework/geometry.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';
import { noAO } from '../../framework/vehicle.js';

// A generic ground-effect single-seater (2022-25 rules shape, no team livery)
// standing still on a wind-tunnel rolling road while smoke streams past it.
//
// SCALE: 1 unit = 1 m. Nose points +x, so the air travels -x. y up, z lateral.
//   length 5.6 · width 2.0 · height ~1.0 · wheelbase 3.6 · tyre Ø0.72
//   front tyre 0.305 wide, rear 0.405 · front wing span 1.9 · rear wing 1.0
//   floor: inlet just behind the front wheels, throat under the cockpit,
//   diffuser kicking up from just ahead of the rear axle to behind it
//
// ONE pose function: set({ turns, ... }). `turns` is cumulative wheel turns;
// the belt, the wheels and every smoke particle derive from it, and each
// particle stream advances a whole number of particle slots per wheel turn,
// so any integer number of turns per lap wraps seamlessly by construction.

const R = 0.36; // tyre radius
const FRONT_X = 1.75;
const REAR_X = -1.85;
const FRONT_Z = 0.82;
const REAR_Z = 0.8;
const BELT_Y = 0.0125; // top of the rolling-road belt; the car stands on it
const BELT_TILE = Math.PI * R; // two belt texture tiles per wheel turn

// ---- the floor's underside: inlet -> throat -> diffuser ---------------------
const FLOOR_LE = 1.22;
const FLOOR_TE = -2.32;
const THROAT_Y = 0.075;
function roofY(x) {
  if (x > 0.2) return THROAT_Y + (0.24 - THROAT_Y) * smooth((x - 0.2) / (FLOOR_LE - 0.2));
  if (x > -1.2) return THROAT_Y;
  const u = clamp01((-1.2 - x) / (-1.2 - FLOOR_TE));
  return THROAT_Y + (0.36 - THROAT_Y) * (u * u * 0.55 + u * 0.45);
}
function floorHalfW(x) {
  return 0.72 - 0.17 * smooth((-1.2 - x) / 0.3);
}
// relative air speed under the floor (1 = free stream)
function floorF(x) {
  if (x > 0.1) return 1.05 + 0.75 * smooth((FLOOR_LE - x) / (FLOOR_LE - 0.1));
  if (x > -1.2) return 1.8 - 0.2 * smooth((0.1 - x) / 1.3);
  return 1.6 - 0.62 * smooth((-1.2 - x) / (-1.2 - FLOOR_TE));
}

// ---- pressure colour: cp = 1 - f^2 (Bernoulli, outside the boundary layer) --
const WARM = new THREE.Color(0xff7a3d);
const COLD = new THREE.Color(0x2f7dff);
const NEUTRAL = new THREE.Color(0xdde4ec);
function pressureColor(cp, out = new THREE.Color()) {
  if (cp >= 0) return out.copy(NEUTRAL).lerp(WARM, Math.min(1, cp / 0.45));
  return out.copy(NEUTRAL).lerp(COLD, Math.min(1, -cp / 1.4));
}

// ---- geometry helpers -------------------------------------------------------
const cat = (p0, p1, p2, p3, t) =>
  0.5 *
  (2 * p1 + (-p0 + p2) * t + (2 * p0 - 5 * p1 + 4 * p2 - p3) * t * t + (-p0 + 3 * p1 - 3 * p2 + p3) * t * t * t);

// Lofted body along x through superellipse sections {x, w, yb, yt, taper, p, zc}.
// taper narrows the section toward its top (engine covers, airbox).
function loftX(sections, { radial = 36, sub = 8 } = {}) {
  const keys = ['x', 'w', 'yb', 'yt', 'taper', 'p', 'zc'];
  const S = sections.map((s) => ({ taper: 0, p: 2.6, zc: 0, ...s }));
  const rings = [];
  const n = S.length;
  for (let i = 0; i < n - 1; i++) {
    for (let k = 0; k < sub; k++) {
      const t = k / sub;
      const r = {};
      for (const key of keys) {
        r[key] = cat(S[Math.max(0, i - 1)][key], S[i][key], S[i + 1][key], S[Math.min(n - 1, i + 2)][key], t);
      }
      rings.push(r);
    }
  }
  rings.push(S[n - 1]);
  const pos = [];
  const uv = [];
  const idx = [];
  rings.forEach((r, ri) => {
    const cy = (r.yb + r.yt) / 2;
    const hy = (r.yt - r.yb) / 2;
    const e = 2 / r.p;
    for (let j = 0; j < radial; j++) {
      const th = (j / radial) * TAU;
      const s = Math.sin(th);
      const c = Math.cos(th);
      const y = cy + hy * Math.sign(s) * Math.abs(s) ** e;
      const h = clamp01((y - r.yb) / Math.max(1e-4, r.yt - r.yb));
      const z = r.zc + r.w * Math.sign(c) * Math.abs(c) ** e * (1 - r.taper * h * h);
      pos.push(r.x, y, z);
      uv.push(ri / (rings.length - 1), j / radial);
    }
  });
  for (let ri = 0; ri < rings.length - 1; ri++) {
    for (let j = 0; j < radial; j++) {
      const a = ri * radial + j;
      const b = ri * radial + ((j + 1) % radial);
      const c = a + radial;
      const d = b + radial;
      idx.push(a, c, b, b, c, d);
    }
  }
  // pole caps at both ends
  for (const [ri, flip] of [
    [0, false],
    [rings.length - 1, true],
  ]) {
    const r = rings[ri];
    const pole = pos.length / 3;
    pos.push(r.x + (flip ? -0.004 : 0.004), (r.yb + r.yt) / 2, r.zc);
    uv.push(ri === 0 ? 0 : 1, 0.5);
    for (let j = 0; j < radial; j++) {
      const a = ri * radial + j;
      const b = ri * radial + ((j + 1) % radial);
      if (flip) idx.push(pole, a, b);
      else idx.push(pole, b, a);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Inverted NACA-4 style section: leading edge at the origin, trailing edge at
// (-chord, 0), camber bulging DOWN (the suction side faces the road).
function airfoilShape(chord, thick = 0.12, camber = 0.07, pc = 0.4, n = 28) {
  const up = [];
  const lo = [];
  for (let i = 0; i <= n; i++) {
    const x = 0.5 * (1 - Math.cos((i / n) * Math.PI));
    const yt = 5 * thick * (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1036 * x ** 4);
    const yc = x < pc ? (camber / pc ** 2) * (2 * pc * x - x * x) : (camber / (1 - pc) ** 2) * (1 - 2 * pc + 2 * pc * x - x * x);
    up.push([-x * chord, -(yc - yt) * chord]);
    lo.push([-x * chord, -(yc + yt) * chord]);
  }
  const shape = new THREE.Shape();
  shape.moveTo(up[n][0], up[n][1]);
  for (let i = n - 1; i >= 0; i--) shape.lineTo(up[i][0], up[i][1]);
  for (let i = 1; i <= n; i++) shape.lineTo(lo[i][0], lo[i][1]);
  shape.closePath();
  return shape;
}
function wingGeo(chord, span, opts) {
  const geo = new THREE.ExtrudeGeometry(airfoilShape(chord, opts?.thick, opts?.camber), {
    depth: span,
    bevelEnabled: false,
    curveSegments: 4,
  });
  geo.translate(0, 0, -span / 2);
  geo.computeVertexNormals();
  return geo;
}

// A pressure skin: the same geometry, drawn over the part in vertex colours.
// Colour comes from the WORLD-space normal — faces looking up carry the higher
// pressure on an inverted wing, faces looking down the low.
function pressureSkin(mesh, colorAt) {
  mesh.updateMatrix();
  const nm = new THREE.Matrix3().getNormalMatrix(mesh.matrix);
  const geo = mesh.geometry.clone();
  const nrm = geo.attributes.normal;
  const p = geo.attributes.position;
  const col = new Float32Array(nrm.count * 3);
  const v = new THREE.Vector3();
  const c = new THREE.Color();
  for (let i = 0; i < nrm.count; i++) {
    v.fromBufferAttribute(nrm, i).applyMatrix3(nm).normalize();
    colorAt(v, new THREE.Vector3().fromBufferAttribute(p, i), c);
    col.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    polygonOffset: true,
    polygonOffsetFactor: -2,
    polygonOffsetUnits: -2,
    toneMapped: false,
  });
  const skin = new THREE.Mesh(geo, mat);
  skin.scale.setScalar(1.004);
  mesh.add(skin);
  return skin;
}
const wingColor = (n, p, c) => {
  // up-facing faces: high pressure; down-facing: strong suction
  const cp = n.y >= 0 ? 0.5 * n.y : 1.6 * n.y;
  return pressureColor(cp, c);
};

function strut(a, b, r, mat) {
  const A = new THREE.Vector3(...a);
  const B = new THREE.Vector3(...b);
  const len = A.distanceTo(B);
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
  m.position.copy(A).add(B).multiplyScalar(0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), B.clone().sub(A).normalize());
  m.castShadow = true;
  return m;
}

// flat plate in the x-y plane from an outline, extruded along z
function plate(points, thickness, mat) {
  const s = new THREE.Shape();
  s.moveTo(points[0][0], points[0][1]);
  for (const p of points.slice(1)) s.lineTo(p[0], p[1]);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.3,
    bevelSize: thickness * 0.3,
    bevelSegments: 1,
    curveSegments: 6,
  });
  geo.translate(0, 0, -thickness / 2);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

function beltTexture() {
  const W = 512;
  const H = 256;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2d31';
  g.fillRect(0, 0, W, H);
  let s = 7;
  const r = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 9000; i++) {
    const v = 40 + ((r() * 40) | 0);
    g.fillStyle = `rgba(${v},${v},${v + 4},0.35)`;
    g.fillRect(r() * W, r() * H, 1 + r() * 2, 1);
  }
  // long grain along the belt's travel
  for (let y = 0; y < H; y += 3) {
    g.fillStyle = `rgba(0,0,0,${0.05 + r() * 0.08})`;
    g.fillRect(0, y, W, 1);
  }
  // two transverse splice seams per tile — what makes the belt read as moving
  for (const x of [W * 0.18, W * 0.68]) {
    g.fillStyle = 'rgba(150,155,165,0.32)';
    g.fillRect(x, 0, 3, H);
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(x + 3, 0, 2, H);
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// ---- smoke streams ----------------------------------------------------------
// A stream: control points [x, y, f] at a fixed z (f = local speed / free
// stream). Particles leave the start at equal time intervals, so they bunch
// where the air is slow and spread where it is fast — the true picture of a
// smoke rake. `alt` (same count) is a second shape the stream can morph to.
const N_PER = 30;
function makeStream(pts, z, alt) {
  const build = (P) => {
    const curve = new THREE.CatmullRomCurve3(P.map(([x, y, , pz]) => new THREE.Vector3(x, y, pz ?? z)), false, 'centripetal');
    const M = 320;
    const L = curve.getLength();
    // arc-length fraction of each control point
    const lens = curve.getLengths(M * 4);
    const uCtl = P.map((_, i) => lens[Math.round((i / (P.length - 1)) * M * 4)] / L);
    const fAt = (u) => {
      for (let i = 0; i < P.length - 1; i++) {
        if (u <= uCtl[i + 1]) {
          const t = (u - uCtl[i]) / Math.max(1e-6, uCtl[i + 1] - uCtl[i]);
          return P[i][2] + (P[i + 1][2] - P[i][2]) * smooth(t);
        }
      }
      return P[P.length - 1][2];
    };
    return { curve, L, fAt };
  };
  const A = build(pts);
  const B = alt ? build(alt) : null;
  const M = 400;
  const tau = new Float64Array(M + 1);
  for (let j = 0; j < M; j++) {
    const f = (A.fAt(j / M) + A.fAt((j + 1) / M)) / 2;
    tau[j + 1] = tau[j] + (A.L / M) / f;
  }
  const T = tau[M];
  // phase advance per wheel turn, quantised to whole particle slots
  const perTurn = Math.max(1, Math.round(((TAU * R) / T) * N_PER)) / N_PER;
  const uAt = (phi) => {
    const target = phi * T;
    let lo = 0;
    let hi = M;
    while (hi - lo > 1) {
      const mid = (lo + hi) >> 1;
      if (tau[mid] <= target) lo = mid;
      else hi = mid;
    }
    return (lo + (target - tau[lo]) / Math.max(1e-9, tau[hi] - tau[lo])) / M;
  };
  return { A, B, perTurn, uAt, z };
}

export function buildRaceCar({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // ---- rolling road --------------------------------------------------------
  const BELT_L = 9.2;
  const BELT_W = 2.9;
  const beltTex = beltTexture();
  beltTex.repeat.set(BELT_L / BELT_TILE, 3);
  const beltMat = new THREE.MeshPhysicalMaterial({ map: beltTex, roughness: 0.82, metalness: 0 });
  const belt = new THREE.Mesh(new THREE.PlaneGeometry(BELT_L, BELT_W), beltMat);
  belt.rotation.x = -Math.PI / 2;
  belt.position.y = BELT_Y;
  belt.receiveShadow = true;
  group.add(belt);
  const frameMat = materials.brushedSteel(0x8a9099);
  frameMat.roughness = 0.7;
  const frameH = 0.03;
  for (const sz of [-1, 1]) {
    const rail = beveledBox(BELT_L + 0.24, frameH, 0.12, frameMat, 0.012);
    rail.position.set(0, frameH / 2, sz * (BELT_W / 2 + 0.06));
    rail.receiveShadow = true;
    group.add(rail);
    const roller = beveledBox(0.12, frameH, BELT_W, frameMat, 0.012);
    roller.position.set(sz * (BELT_L / 2 + 0.06), frameH / 2, 0);
    group.add(roller);
  }

  const car = new THREE.Group();
  car.position.y = BELT_Y;
  group.add(car);

  // ---- materials -----------------------------------------------------------
  const bodyMat = new THREE.MeshPhysicalMaterial({
    color: 0x1e2228,
    metalness: 0.2,
    roughness: 0.4,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2,
  });
  const liveryMat = new THREE.MeshPhysicalMaterial({
    color: 0x2a9fd4,
    metalness: 0.15,
    roughness: 0.38,
    clearcoat: 0.55,
    clearcoatRoughness: 0.2,
  });
  const carbonMat = new THREE.MeshPhysicalMaterial({
    color: 0x16181c,
    metalness: 0.1,
    roughness: 0.48,
    clearcoat: 0.35,
    clearcoatRoughness: 0.3,
  });
  const floorMat = carbonMat.clone();
  // near-side (z > 0) wing endplates: faded on the wing steps so the profile
  // (two elements, the slot, the pressure colours) can be seen side-on
  const plateMat = carbonMat.clone();
  floorMat.side = THREE.DoubleSide;
  const darkMat = materials.polymer(0x0b0c0e);
  const tyreMat = materials.rubber(0x17181b);
  tyreMat.roughness = 0.88;
  const nearTyreMat = tyreMat.clone();
  const stripeMat = materials.polymer(0xd8c24a);
  const rimMat = materials.aluminum(0x3a3d43);
  rimMat.roughness = 0.6;
  const coverMat = carbonMat.clone();
  const steelMat = materials.brushedSteel(0x9aa1aa);
  steelMat.roughness = 0.5;
  const haloMat = materials.brushedSteel(0x5c6168);
  haloMat.roughness = 0.45;
  const helmetMat = new THREE.MeshPhysicalMaterial({ color: 0xe9ecef, roughness: 0.3, clearcoat: 0.5 });
  const visorMat = materials.polymer(0x08090b);
  visorMat.roughness = 0.2;
  const lightMat = new THREE.MeshStandardMaterial({ color: 0x400000, emissive: 0xff2a1a, emissiveIntensity: 2.2 });

  // body materials that fade on the cutaway step (all non-metal)
  const ghostMats = [bodyMat, liveryMat, carbonMat, darkMat, helmetMat, visorMat];
  for (const m of ghostMats) m.userData.coat = m.clearcoat;

  // ---- monocoque, nose, engine cover --------------------------------------
  const body = new THREE.Group();
  car.add(body);
  const mono = new THREE.Mesh(
    loftX([
      { x: 2.86, w: 0.035, yb: 0.2, yt: 0.24 },
      { x: 2.6, w: 0.08, yb: 0.18, yt: 0.3 },
      { x: 2.1, w: 0.13, yb: 0.17, yt: 0.4 },
      { x: 1.6, w: 0.18, yb: 0.17, yt: 0.5 },
      { x: 1.1, w: 0.25, yb: 0.24, yt: 0.58 },
      { x: 0.55, w: 0.29, yb: 0.2, yt: 0.6 },
      { x: 0.1, w: 0.31, yb: 0.11, yt: 0.63, taper: 0.2 },
      { x: -0.18, w: 0.31, yb: 0.1, yt: 0.98, taper: 0.8 },
      { x: -0.65, w: 0.3, yb: 0.1, yt: 0.82, taper: 0.64 },
      { x: -1.2, w: 0.22, yb: 0.12, yt: 0.6, taper: 0.45 },
      { x: -1.7, w: 0.14, yb: 0.22, yt: 0.47, taper: 0.3 },
      { x: -2.1, w: 0.09, yb: 0.34, yt: 0.43 },
      { x: -2.32, w: 0.04, yb: 0.36, yt: 0.41 },
    ]),
    bodyMat,
  );
  mono.castShadow = true;
  body.add(mono);

  // livery: a stripe down the nose and a shark fin on the engine cover
  const noseStripe = new THREE.Mesh(
    loftX([
      { x: 2.84, w: 0.02, yb: 0.235, yt: 0.245 },
      { x: 2.3, w: 0.05, yb: 0.375, yt: 0.385 },
      { x: 1.6, w: 0.07, yb: 0.5, yt: 0.51 },
      { x: 1.15, w: 0.08, yb: 0.577, yt: 0.587 },
    ], { radial: 16, sub: 6 }),
    liveryMat,
  );
  noseStripe.scale.set(1, 1.008, 1);
  body.add(noseStripe);
  const fin = plate(
    [
      [-0.35, 0.9],
      [-1.75, 0.56],
      [-1.75, 0.47],
      [-0.6, 0.78],
    ],
    0.012,
    liveryMat,
  );
  body.add(fin);

  // cockpit opening, driver helmet, halo, airbox mouth
  const cockpit = new THREE.Mesh(new THREE.CircleGeometry(1, 40), darkMat);
  cockpit.rotation.x = -Math.PI / 2;
  cockpit.scale.set(0.34, 0.2, 1);
  cockpit.position.set(0.32, 0.615, 0);
  body.add(cockpit);
  const helmet = new THREE.Mesh(new THREE.SphereGeometry(0.125, 28, 20), helmetMat);
  helmet.position.set(0.12, 0.7, 0);
  helmet.castShadow = true;
  body.add(helmet);
  const visor = new THREE.Mesh(new THREE.SphereGeometry(0.127, 28, 10, -0.9, 1.8, 1.25, 0.42), visorMat);
  visor.position.copy(helmet.position);
  body.add(visor);
  const airbox = new THREE.Mesh(new THREE.CircleGeometry(1, 28), darkMat);
  airbox.rotation.y = Math.PI / 2;
  airbox.scale.set(0.05, 0.065, 1);
  airbox.position.set(-0.08, 0.9, 0);
  body.add(airbox);
  const halo = new THREE.Group();
  body.add(halo);
  halo.add(
    tubeAlong(
      [
        [0.02, 0.8, -0.24],
        [0.3, 0.83, -0.2],
        [0.5, 0.82, 0],
        [0.3, 0.83, 0.2],
        [0.02, 0.8, 0.24],
      ],
      0.022,
      haloMat,
      { tubularSegments: 48, radialSegments: 10 },
    ),
  );
  halo.add(strut([0.66, 0.6, 0], [0.5, 0.82, 0], 0.02, haloMat));
  for (const sz of [-1, 1]) halo.add(strut([0.02, 0.8, 0.24 * sz], [-0.05, 0.62, 0.27 * sz], 0.022, haloMat));
  // mirrors
  for (const sz of [-1, 1]) {
    const m = beveledBox(0.06, 0.05, 0.13, bodyMat, 0.012);
    m.position.set(0.62, 0.72, 0.43 * sz);
    body.add(m);
    body.add(strut([0.62, 0.6, 0.3 * sz], [0.62, 0.7, 0.4 * sz], 0.008, carbonMat));
  }

  // sidepods, sitting on the floor
  for (const sz of [-1, 1]) {
    const pod = new THREE.Mesh(
      loftX(
        [
          { x: 0.78, w: 0.15, yb: roofY(0.78) + 0.012, yt: 0.5, zc: 0.5 * sz, p: 3.2 },
          { x: 0.55, w: 0.2, yb: roofY(0.55) + 0.012, yt: 0.56, zc: 0.52 * sz, p: 3.2 },
          { x: 0.0, w: 0.21, yb: roofY(0.0) + 0.012, yt: 0.55, zc: 0.52 * sz, p: 3 },
          { x: -0.6, w: 0.17, yb: roofY(-0.6) + 0.012, yt: 0.45, zc: 0.48 * sz, p: 2.8 },
          { x: -1.1, w: 0.1, yb: roofY(-1.1) + 0.012, yt: 0.32, zc: 0.4 * sz },
          { x: -1.42, w: 0.04, yb: roofY(-1.42) + 0.012, yt: 0.22, zc: 0.3 * sz },
        ],
        { radial: 40 },
      ),
      bodyMat,
    );
    pod.castShadow = true;
    body.add(pod);
    const inlet = new THREE.Mesh(new THREE.CircleGeometry(1, 32), darkMat);
    inlet.rotation.y = Math.PI / 2;
    inlet.scale.set(0.13, 0.15, 1);
    inlet.position.set(0.785, 0.36, 0.5 * sz);
    body.add(inlet);
    // a blue stripe along the pod shoulder
    const sh = new THREE.Mesh(
      loftX(
        [
          { x: 0.6, w: 0.03, yb: 0.553, yt: 0.562, zc: 0.62 * sz },
          { x: 0.0, w: 0.04, yb: 0.548, yt: 0.556, zc: 0.62 * sz },
          { x: -0.6, w: 0.035, yb: 0.44, yt: 0.448, zc: 0.55 * sz },
        ],
        { radial: 12, sub: 6 },
      ),
      liveryMat,
    );
    body.add(sh);
  }

  // rain light
  const rainLight = beveledBox(0.03, 0.05, 0.1, lightMat, 0.008);
  rainLight.position.set(-2.33, 0.385, 0);
  body.add(rainLight);

  // ---- floor: tunnel roof, fences, diffuser -------------------------------
  const floor = new THREE.Group();
  car.add(floor);
  const NX = 90;
  const NZ = 24;
  function floorGrid(dy) {
    const pos = [];
    const idx = [];
    for (let i = 0; i <= NX; i++) {
      const x = FLOOR_LE + (FLOOR_TE - FLOOR_LE) * (i / NX);
      const hw = floorHalfW(x);
      for (let j = 0; j <= NZ; j++) {
        const z = -hw + (2 * hw * j) / NZ;
        pos.push(x, roofY(x) + dy, z);
      }
    }
    for (let i = 0; i < NX; i++) {
      for (let j = 0; j < NZ; j++) {
        const a = i * (NZ + 1) + j;
        idx.push(a, a + 1, a + NZ + 1, a + 1, a + NZ + 2, a + NZ + 1);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }
  const floorSheet = new THREE.Mesh(floorGrid(0), floorMat);
  floorSheet.castShadow = true;
  floorSheet.receiveShadow = true;
  floor.add(floorSheet);

  // the underside in pressure colour (deep blue at the throat)
  const fsGeo = floorGrid(-0.004);
  {
    const p = fsGeo.attributes.position;
    const col = new Float32Array(p.count * 3);
    const c = new THREE.Color();
    for (let i = 0; i < p.count; i++) {
      const f = floorF(p.getX(i));
      pressureColor(1 - f * f, c);
      col.set([c.r, c.g, c.b], i * 3);
    }
    fsGeo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  }
  const floorSkin = new THREE.Mesh(
    fsGeo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      side: THREE.DoubleSide,
      toneMapped: false,
    }),
  );
  floor.add(floorSkin);

  // fences: the tunnel walls. Their lower edge runs a few cm off the road under
  // the floor and rises with the diffuser roof at the back.
  const fenceBottom = (x) => Math.max(0.035, roofY(x) - 0.17);
  const fences = [];
  for (const zz of [-1, -0.55, -0.14, 0.14, 0.55, 1]) {
    const pts = [];
    const S = 50;
    const xs = [];
    for (let i = 0; i <= S; i++) xs.push(FLOOR_LE - 0.02 + (FLOOR_TE - FLOOR_LE + 0.02) * (i / S));
    const zAt = (x) => zz * (Math.abs(zz) === 1 ? floorHalfW(x) : 0.55);
    for (const x of xs) pts.push([x, roofY(x) + 0.006]);
    for (const x of xs.slice().reverse()) pts.push([x, Math.min(roofY(x) - 0.01, fenceBottom(x))]);
    // outer edges follow the floor's taper; build as a plate per straight run
    const f = plate(pts, 0.012, carbonMat);
    f.position.z = zAt(0);
    if (Math.abs(zz) === 1) {
      // shear the outer fence inward behind -1.2 by bending vertices
      const pa = f.geometry.attributes.position;
      for (let i = 0; i < pa.count; i++) pa.setZ(i, pa.getZ(i) + zAt(pa.getX(i)) - zAt(0));
      f.geometry.computeVertexNormals();
    }
    floor.add(f);
    fences.push({ mesh: f, z: zz });
  }
  // the plank skid-block down the middle
  const plank = beveledBox(2.4, 0.012, 0.22, materials.polymer(0x3b2f23), 0.004);
  plank.position.set(-0.5, THROAT_Y - 0.01, 0);
  floor.add(plank);
  ghostMats.push(plank.material);
  plank.material.userData.coat = plank.material.clearcoat;
  // floor-edge wing ahead of the rear tyres
  for (const sz of [-1, 1]) {
    const w = new THREE.Mesh(wingGeo(0.22, 0.12, { camber: 0.06 }), carbonMat);
    w.rotation.y = 0;
    w.rotation.z = -0.25;
    w.position.set(-1.2, 0.14, 0.66 * sz);
    floor.add(w);
  }

  // ---- front wing ----------------------------------------------------------
  const frontWing = new THREE.Group();
  car.add(frontWing);
  const fwSkins = [];
  const fwMain = new THREE.Mesh(wingGeo(0.26, 1.88, { camber: 0.07 }), carbonMat);
  fwMain.position.set(2.86, 0.09, 0);
  fwMain.rotation.z = -0.05;
  fwMain.castShadow = true;
  frontWing.add(fwMain);
  fwSkins.push(pressureSkin(fwMain, wingColor));
  const fwFlaps = [];
  for (const sz of [-1, 1]) {
    for (const [chord, lx, ly, aoa] of [
      [0.17, 2.64, 0.122, 0.26],
      [0.13, 2.5, 0.17, 0.48],
    ]) {
      const fl = new THREE.Mesh(wingGeo(chord, 0.74, { camber: 0.08 }), liveryMat);
      fl.position.set(lx, ly, 0.565 * sz);
      fl.rotation.z = -aoa;
      fl.castShadow = true;
      frontWing.add(fl);
      fwFlaps.push(fl);
      fwSkins.push(pressureSkin(fl, wingColor));
    }
  }
  for (const sz of [-1, 1]) {
    const ep = plate(
      [
        [2.9, 0.04],
        [2.32, 0.05],
        [2.28, 0.28],
        [2.5, 0.3],
        [2.9, 0.16],
      ],
      0.014,
      sz > 0 ? plateMat : carbonMat,
    );
    ep.position.z = 0.945 * sz;
    if (sz > 0) ep.userData.noOcclude = true; // fades on the wing steps
    frontWing.add(ep);
    // nose pylons
    const py = plate(
      [
        [2.78, 0.1],
        [2.55, 0.1],
        [2.5, 0.19],
        [2.75, 0.215],
      ],
      0.01,
      carbonMat,
    );
    py.position.z = 0.05 * sz;
    frontWing.add(py);
  }

  // ---- rear wing -----------------------------------------------------------
  const rearWing = new THREE.Group();
  car.add(rearWing);
  const rwSkins = [];
  const rwMain = new THREE.Mesh(wingGeo(0.3, 0.98, { camber: 0.075, thick: 0.15 }), carbonMat);
  rwMain.position.set(-2.12, 0.8, 0);
  rwMain.rotation.z = -0.17;
  rwMain.castShadow = true;
  rearWing.add(rwMain);
  rwSkins.push(pressureSkin(rwMain, wingColor));
  // the flap pivots about its TRAILING edge (the real DRS hinge), so opening it
  // lifts the leading edge and widens the slot
  const FLAP_C = 0.2;
  const FLAP_AOA = 0.66;
  const FLAP_LE = new THREE.Vector3(-2.37, 0.872, 0);
  const flapTE = FLAP_LE.clone().add(new THREE.Vector3(-FLAP_C * Math.cos(FLAP_AOA), FLAP_C * Math.sin(FLAP_AOA), 0));
  const flapPivot = new THREE.Group();
  flapPivot.position.copy(flapTE);
  rearWing.add(flapPivot);
  const rwFlap = new THREE.Mesh(wingGeo(FLAP_C, 0.98, { camber: 0.06, thick: 0.15 }), liveryMat);
  rwFlap.position.copy(FLAP_LE).sub(flapTE);
  rwFlap.rotation.z = -FLAP_AOA;
  rwFlap.castShadow = true;
  flapPivot.add(rwFlap);
  rwSkins.push(pressureSkin(rwFlap, wingColor));
  for (const sz of [-1, 1]) {
    const ep = plate(
      [
        [-2.02, 0.5],
        [-2.04, 0.92],
        [-2.3, 1.04],
        [-2.66, 1.04],
        [-2.66, 0.6],
        [-2.4, 0.42],
      ],
      0.014,
      plateMat,
    );
    ep.position.z = 0.497 * sz;
    ep.userData.noOcclude = true; // both fade on the rear-wing step
    rearWing.add(ep);
  }
  const swan = plate(
    [
      [-2.15, 0.4],
      [-2.08, 0.62],
      [-2.18, 0.79],
      [-2.26, 0.79],
      [-2.22, 0.6],
      [-2.28, 0.4],
    ],
    0.02,
    carbonMat,
  );
  rearWing.add(swan);
  const beam = new THREE.Mesh(wingGeo(0.15, 0.86, { camber: 0.06 }), carbonMat);
  beam.position.set(-2.18, 0.49, 0);
  beam.rotation.z = -0.22;
  rearWing.add(beam);

  // ---- wheels + suspension --------------------------------------------------
  const wheels = [];
  const nearParts = []; // metal on the near (z > 0) side: hidden on the cutaway
  function wheel(x, z, width) {
    const g = new THREE.Group();
    g.position.set(x, R, z);
    const near = z > 0;
    const spin = new THREE.Group();
    g.add(spin);
    const hw = width / 2;
    const prof = [
      [0.232, -hw + 0.01],
      [0.3, -hw],
      [0.345, -hw + 0.012],
      [R, -hw + 0.05],
      [R, hw - 0.05],
      [0.345, hw - 0.012],
      [0.3, hw],
      [0.232, hw - 0.01],
    ].map(([r, y]) => new THREE.Vector2(r, y));
    const tyre = new THREE.Mesh(new THREE.LatheGeometry(prof, 64), near ? nearTyreMat : tyreMat);
    tyre.rotation.x = Math.PI / 2;
    tyre.castShadow = true;
    spin.add(tyre);
    // sidewall marking: two arcs per side, so the turn reads
    for (const side of [-1, 1]) {
      for (const a0 of [0, Math.PI]) {
        const arc = new THREE.Mesh(new THREE.RingGeometry(0.29, 0.315, 24, 1, a0, 1.6), stripeMat);
        arc.position.z = side * (hw + 0.001);
        if (side < 0) arc.rotation.y = Math.PI;
        spin.add(arc);
        if (near) ghostSidewalls.push(arc);
      }
    }
    // rim + wheel cover with five bolts
    const rim = new THREE.Mesh(new THREE.CylinderGeometry(0.232, 0.232, width - 0.03, 40, 1, true), rimMat);
    rim.rotation.x = Math.PI / 2;
    spin.add(rim);
    for (const side of [-1, 1]) {
      const cover = new THREE.Mesh(new THREE.CircleGeometry(0.232, 40), coverMat);
      cover.position.z = side * (hw - 0.02);
      if (side < 0) cover.rotation.y = Math.PI;
      spin.add(cover);
      const nut = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.035, 0.03, 6), steelMat);
      nut.rotation.x = Math.PI / 2;
      nut.position.z = side * (hw - 0.005);
      spin.add(nut);
      for (let k = 0; k < 5; k++) {
        const a = (k / 5) * TAU;
        const dot = new THREE.Mesh(new THREE.CircleGeometry(0.012, 10), steelMat);
        dot.position.set(Math.cos(a) * 0.15, Math.sin(a) * 0.15, side * (hw - 0.018));
        if (side < 0) dot.rotation.y = Math.PI;
        spin.add(dot);
      }
    }
    if (near) nearParts.push(rim, ...spin.children.filter((c) => c.material === coverMat || c.material === steelMat));
    car.add(g);
    wheels.push({ g, spin, near });
    return g;
  }
  const ghostSidewalls = [];
  wheel(FRONT_X, FRONT_Z, 0.305);
  wheel(FRONT_X, -FRONT_Z, 0.305);
  wheel(REAR_X, REAR_Z, 0.405);
  wheel(REAR_X, -REAR_Z, 0.405);

  // wishbones: chassis pick-ups to the upright
  const susp = new THREE.Group();
  car.add(susp);
  for (const sz of [-1, 1]) {
    const arms = [];
    const fz = (FRONT_Z - 0.17) * sz;
    arms.push(
      strut([FRONT_X + 0.25, 0.46, 0.14 * sz], [FRONT_X, 0.5, fz], 0.016, steelMat),
      strut([FRONT_X - 0.3, 0.44, 0.17 * sz], [FRONT_X, 0.5, fz], 0.016, steelMat),
      strut([FRONT_X + 0.25, 0.25, 0.15 * sz], [FRONT_X, 0.22, fz], 0.016, steelMat),
      strut([FRONT_X - 0.3, 0.27, 0.19 * sz], [FRONT_X, 0.22, fz], 0.016, steelMat),
      strut([FRONT_X - 0.05, 0.53, 0.18 * sz], [FRONT_X, 0.36, fz], 0.012, steelMat), // track rod
    );
    const rz = (REAR_Z - 0.22) * sz;
    arms.push(
      strut([REAR_X + 0.3, 0.42, 0.13 * sz], [REAR_X, 0.5, rz], 0.016, steelMat),
      strut([REAR_X - 0.25, 0.42, 0.1 * sz], [REAR_X, 0.5, rz], 0.016, steelMat),
      strut([REAR_X + 0.3, 0.3, 0.13 * sz], [REAR_X, 0.22, rz], 0.016, steelMat),
      strut([REAR_X - 0.25, 0.36, 0.09 * sz], [REAR_X, 0.22, rz], 0.016, steelMat),
    );
    for (const a of arms) {
      susp.add(a);
      if (sz > 0) nearParts.push(a);
    }
  }

  // ---- smoke ---------------------------------------------------------------
  // Stream shapes are hand-authored around this body, not simulated: they
  // follow the real topology (upwash off both wings, acceleration under the
  // front wing and through the floor throat, slow spread out of the diffuser).
  const streamDefs = { over: [], front: [], rear: [], floor: [] };
  for (const z of [0.0, 0.22]) {
    streamDefs.over.push(
      makeStream(
        [
          [4.4, 0.42, 1],
          [3.2, 0.42, 0.95],
          [2.4, 0.5, 1.05],
          [1.4, 0.74, 1.15],
          [0.5, 0.98, 1.2],
          [-0.2, 1.17, 1.25],
          [-1.1, 1.02, 1.1],
          [-1.9, 1.12, 1.0],
          [-2.5, 1.3, 0.95],
          [-3.4, 1.55, 1],
          [-4.4, 1.7, 1],
        ],
        z,
      ),
    );
  }
  for (const z of [-0.62, 0.62]) {
    streamDefs.over.push(
      makeStream(
        [
          [4.4, 0.52, 1],
          [2.6, 0.52, 1],
          [1.3, 0.74, 1.05],
          [0.3, 0.72, 1.15],
          [-0.6, 0.62, 1.1],
          [-1.4, 0.5, 1.0],
          [-2.2, 0.38, 0.95],
          [-3.2, 0.5, 1],
          [-4.4, 0.62, 1],
        ],
        z,
      ),
    );
  }
  for (const z of [-0.52, -0.3, 0.3, 0.52]) {
    // over the wing: slows onto the high-pressure top, flung up off the flaps
    streamDefs.front.push(
      makeStream(
        [
          [4.4, 0.27, 1],
          [3.3, 0.27, 0.95],
          [2.88, 0.27, 0.85],
          [2.6, 0.32, 0.8],
          [2.36, 0.42, 0.9],
          [2.0, 0.6, 1.0],
          [1.4, 0.8, 1.0],
          [0.6, 0.92, 1],
        ],
        z,
      ),
    );
    // under the wing: squeezed against the road, fast and low-pressure
    streamDefs.front.push(
      makeStream(
        [
          [4.4, 0.1, 1],
          [3.3, 0.085, 1.05],
          [2.86, 0.045, 1.5],
          [2.65, 0.045, 1.55],
          [2.4, 0.12, 1.25],
          [2.1, 0.3, 1.05],
          [1.5, 0.48, 1],
          [0.6, 0.6, 1],
        ],
        z,
      ),
    );
  }
  for (const z of [-0.36, -0.14, 0.14, 0.36]) {
    // the alt shapes are DRS-open: almost no upwash
    streamDefs.rear.push(
      makeStream(
        [
          [-0.6, 0.98, 1.05],
          [-1.5, 0.92, 1.0],
          [-2.05, 0.92, 0.8],
          [-2.35, 1.05, 0.85],
          [-2.75, 1.32, 0.95],
          [-3.5, 1.68, 1],
          [-4.4, 1.95, 1],
        ],
        z,
        [
          [-0.6, 0.98, 1.05],
          [-1.5, 0.94, 1.0],
          [-2.05, 0.93, 0.95],
          [-2.35, 1.0, 0.97],
          [-2.75, 1.07, 1.0],
          [-3.5, 1.15, 1],
          [-4.4, 1.2, 1],
        ],
      ),
    );
    streamDefs.rear.push(
      makeStream(
        [
          [-0.9, 0.72, 1],
          [-1.6, 0.7, 1.05],
          [-2.1, 0.74, 1.45],
          [-2.45, 0.83, 1.35],
          [-2.85, 1.08, 1.1],
          [-3.5, 1.4, 1],
          [-4.4, 1.62, 1],
        ],
        z,
        [
          [-0.9, 0.72, 1],
          [-1.6, 0.7, 1.02],
          [-2.1, 0.74, 1.15],
          [-2.45, 0.8, 1.1],
          [-2.85, 0.88, 1.02],
          [-3.5, 0.96, 1],
          [-4.4, 1.0, 1],
        ],
      ),
    );
  }
  for (const z of [-0.47, -0.3, -0.12, 0.12, 0.3, 0.47]) {
    const P = [
      [2.3, 0.22, 1],
      [1.6, 0.2, 1.0],
      [1.25, 0.17, floorF(1.25)],
      [0.6, roofY(0.6) - 0.03, floorF(0.6)],
      [0.0, 0.055, floorF(0.0)],
      [-0.7, 0.055, floorF(-0.7)],
      [-1.3, 0.065, floorF(-1.3)],
      [-1.8, roofY(-1.8) - 0.06, floorF(-1.8)],
      [-2.3, roofY(-2.3) - 0.07, floorF(-2.3)],
      // out of the diffuser the stream fans out and slows below free stream
      [-2.85, 0.4, 0.85, z * 1.25],
      [-3.5, 0.55, 0.9, z * 1.45],
      [-4.2, 0.66, 1, z * 1.55],
    ];
    streamDefs.floor.push(makeStream(P, z));
  }

  const smoke = {};
  const smokeGeo = new THREE.SphereGeometry(1, 8, 6);
  const lineMats = [];
  for (const [key, defs] of Object.entries(streamDefs)) {
    const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.92, depthWrite: false, toneMapped: false });
    const mesh = new THREE.InstancedMesh(smokeGeo, mat, defs.length * N_PER);
    mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    mesh.frustumCulled = false;
    const c = new THREE.Color();
    for (let i = 0; i < defs.length * N_PER; i++) mesh.setColorAt(i, c);
    const g = new THREE.Group();
    g.add(mesh);
    // the streamline itself, faint, in pressure colour
    const lines = [];
    for (const d of defs) {
      const mk = (curve) => new THREE.TubeGeometry(curve, 160, 0.0045, 5, false);
      const geo = mk(d.A.curve);
      const n = geo.attributes.position.count;
      const col = new Float32Array(n * 3);
      for (let i = 0; i < n; i++) {
        const u = Math.floor(i / 6) / 160;
        pressureColor(1 - d.A.fAt(u) ** 2, c);
        // fade both ends into the studio
        const e = Math.min(1, u / 0.08, (1 - u) / 0.12);
        col.set([c.r * e, c.g * e, c.b * e], i * 3);
      }
      geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
      if (d.B) {
        geo.morphAttributes.position = [mk(d.B.curve).attributes.position];
      }
      const lm = new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        opacity: 0.32,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      });
      lineMats.push(lm);
      const line = new THREE.Mesh(geo, lm);
      line.frustumCulled = false;
      if (d.B) line.morphTargetInfluences = [0];
      g.add(line);
      lines.push(line);
    }
    car.add(g);
    noAO(g);
    smoke[key] = { defs, mesh, group: g, lines };
  }

  const _p = new THREE.Vector3();
  const _p2 = new THREE.Vector3();
  const _t = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _m = new THREE.Matrix4();
  const _s = new THREE.Vector3();
  const _c = new THREE.Color();
  const Z = new THREE.Vector3(0, 0, 1);
  function poseSmoke(key, turns, drs) {
    const { defs, mesh } = smoke[key];
    let k = 0;
    for (const d of defs) {
      const shift = turns * d.perTurn;
      for (let i = 0; i < N_PER; i++, k++) {
        let phi = (i / N_PER + shift) % 1;
        if (phi < 0) phi += 1;
        const u = d.uAt(phi);
        d.A.curve.getPointAt(u, _p);
        d.A.curve.getTangentAt(u, _t);
        let f = d.A.fAt(u);
        if (d.B && drs > 0) {
          d.B.curve.getPointAt(u, _p2);
          _p.lerp(_p2, drs);
          d.B.curve.getTangentAt(u, _p2);
          _t.lerp(_p2, drs).normalize();
          f += (d.B.fAt(u) - f) * drs;
        }
        const e = Math.min(1, u / 0.06, (1 - u) / 0.1);
        const sc = 0.0105 * Math.max(0, e);
        _q.setFromUnitVectors(Z, _t);
        _s.set(sc, sc, sc * (2 + 2.6 * f));
        _m.compose(_p, _q, _s);
        mesh.setMatrixAt(k, _m);
        mesh.setColorAt(k, pressureColor(1 - f * f, _c));
      }
    }
    mesh.instanceMatrix.needsUpdate = true;
    mesh.instanceColor.needsUpdate = true;
  }

  // ---- force arrows --------------------------------------------------------
  function forceArrow(color, emissive) {
    const g = new THREE.Group();
    const mat = new THREE.MeshStandardMaterial({
      color,
      emissive,
      emissiveIntensity: 0.55,
      roughness: 0.35,
      metalness: 0,
      transparent: true,
      opacity: 0.95,
    });
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.075, 0.18, 24), mat);
    head.rotation.x = Math.PI;
    head.position.y = 0.09;
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 1, 16), mat);
    g.add(head, shaft);
    const top = new THREE.Group();
    g.add(top);
    for (const m of [head, shaft]) m.userData.noOcclude = true;
    g.visible = false;
    car.add(g);
    return {
      g,
      top,
      setLength(L) {
        const s = Math.max(0.001, L - 0.18);
        shaft.scale.y = s;
        shaft.position.y = 0.18 + s / 2;
        top.position.y = L;
      },
    };
  }
  const ACC = 0x4fd1ff;
  const arrows = {
    weight: forceArrow(0xd9dde3, 0x30343a),
    total: forceArrow(ACC, 0x1d6f8f),
    front: forceArrow(ACC, 0x1d6f8f),
    floor: forceArrow(ACC, 0x1d6f8f),
    rear: forceArrow(ACC, 0x1d6f8f),
  };
  arrows.weight.g.position.set(1.25, 0.565, 0);
  arrows.total.g.position.set(-0.75, 0.8, 0);
  arrows.front.g.position.set(2.62, 0.33, 0.56);
  arrows.floor.g.position.set(-0.2, 0.555, 0.52);
  arrows.rear.g.position.set(-2.16, 0.84, -0.15);

  // ---- callouts ------------------------------------------------------------
  const labels = calloutSets(['exterior', 'speed', 'front', 'rear', 'floor', 'diffuser', 'split']);
  labels.add('exterior', fwMain, 'Front wing', [-0.12, 0.012, 0.85], 25, 60);
  labels.add('exterior', rearWing, 'Rear wing', [-2.25, 0.95, 0.3], 70, 60);
  labels.add('exterior', car, 'Floor', [0.2, roofY(0.2) + 0.01, 0.72], -60, 60);
  labels.add('exterior', car, 'Sidepod', [0.1, 0.5, 0.66], 60, 70);

  labels.add('speed', arrows.weight.top, 'Weight ≈ 800 kg', [0, 0.02, 0], -15, 50);
  const liveLabel = labels.add('speed', arrows.total.top, 'Downforce', [0, 0.02, 0], 35, 60);

  labels.add('front', car, 'High pressure', [2.7, 0.108, 0.62], 80, 80);
  labels.add('front', car, 'Low pressure', [2.62, 0.045, 0.6], -60, 60);
  labels.add('front', car, 'Air turned upward', [2.1, 0.55, 0.42], 60, 60);

  labels.add('rear', rwMain, 'Main plane', [-0.15, -0.005, 0.5], -40, 60);
  labels.add('rear', rwFlap, 'Flap', [-0.1, 0.0, 0.5], 20, 70);
  labels.add('rear', car, 'Slot', [-2.4, 0.875, 0.42], -10, 70);
  // rides the top rear stream, so it still points at the air when the flap opens
  const upAnchor = new THREE.Object3D();
  car.add(upAnchor);
  const upLabel = labels.add('rear', upAnchor, 'Air thrown upward', [0, 0, 0], 70, 50);

  labels.add('floor', car, 'Venturi tunnel', [0.9, 0.18, 0.55], 70, 60);
  labels.add('floor', car, 'Throat', [-0.5, THROAT_Y - 0.004, 0.36], 60, 70);
  labels.add('floor', car, 'Road = tunnel floor', [-0.3, 0.0, 0.5], -60, 50);

  labels.add('diffuser', car, 'Diffuser', [-2.31, roofY(-2.31) - 0.02, 0.3], 60, 80);
  labels.add('diffuser', car, 'Strakes', [-2.25, 0.13, -0.3], 210, 60);
  labels.add('diffuser', car, 'Back to normal pressure', [-3.3, 0.52, 0.55], 150, 60);

  labels.add('split', arrows.front.top, 'Front wing ≈ 25%', [0, 0.02, 0], 60, 40);
  labels.add('split', arrows.floor.top, 'Floor ≈ 55%', [0, 0.02, 0], 60, 40);
  labels.add('split', arrows.rear.top, 'Rear wing ≈ 20%', [0, 0.02, 0], 70, 50);

  // ---- pose ---------------------------------------------------------------
  const state = {
    turns: 0,
    smoke: { over: 0, front: 0, rear: 0, floor: 0 },
    pressure: 0, // wing + floor pressure skins
    ghost: 1, // body opacity (1 = solid)
    cutaway: 0, // near-side wheels / fence out of the way
    skin: 0, // floor underside pressure colour without the cutaway
    plates: 1, // near endplate opacity
    drs: 0,
    kmh: 250,
    arrows: false, // false | 'speed' | 'front' | 'rear' | 'split'
  };

  function setGhost(o) {
    const solid = o >= 0.999;
    for (const m of ghostMats) {
      m.transparent = !solid;
      m.opacity = o;
      m.depthWrite = solid;
      m.clearcoat = solid ? m.userData.coat : 0;
    }
    halo.visible = solid;
    helmet.visible = visor.visible = o > 0.5;
  }

  function apply() {
    const s = state;
    const ang = s.turns * TAU;
    for (const w of wheels) w.spin.rotation.z = -ang;
    beltTex.offset.x = ((s.turns * 2) % 1 + 1) % 1;

    for (const key of Object.keys(smoke)) {
      const on = s.smoke[key] > 0;
      smoke[key].group.visible = on;
      if (on) {
        poseSmoke(key, s.turns, key === 'rear' ? s.drs : 0);
        for (const l of smoke[key].lines) if (l.morphTargetInfluences) l.morphTargetInfluences[0] = s.drs;
      }
    }

    flapPivot.rotation.z = 0.5 * s.drs;
    {
      const d = smoke.rear.defs[2];
      d.A.curve.getPointAt(0.6, _p);
      d.B.curve.getPointAt(0.6, _p2);
      upAnchor.position.copy(_p.lerp(_p2, s.drs));
      upLabel.setText(s.drs > 0.5 ? 'Flap open: air leaves flat' : 'Air thrown upward');
    }

    const pv = s.pressure;
    for (const sk of [...fwSkins, ...rwSkins]) {
      sk.material.opacity = 0.85 * pv;
      sk.visible = pv > 0.001;
    }
    const fsk = Math.max(s.cutaway, s.skin);
    floorSkin.material.opacity = 0.9 * fsk;
    floorSkin.visible = fsk > 0.001;

    setGhost(s.ghost);
    const cut = s.cutaway > 0.5;
    nearTyreMat.transparent = cut;
    nearTyreMat.opacity = cut ? 0.12 : 1;
    nearTyreMat.depthWrite = !cut;
    for (const a of ghostSidewalls) a.visible = !cut;
    for (const p of nearParts) p.visible = !cut;
    fences.forEach(({ mesh, z }) => (mesh.visible = !(cut && z === 1)));
    floorMat.transparent = cut;
    floorMat.opacity = cut ? 0.4 : 1;
    floorMat.depthWrite = !cut;
    floorMat.clearcoat = cut ? 0 : 0.35;
    const pl = s.plates;
    plateMat.transparent = pl < 0.999;
    plateMat.opacity = pl;
    plateMat.depthWrite = pl >= 0.999;
    plateMat.clearcoat = pl < 0.999 ? 0 : 0.35;

    // downforce ~ v^2, 800 kg at 200 km/h
    const df = 800 * (s.kmh / 200) ** 2;
    for (const a of Object.values(arrows)) a.g.visible = false;
    if (s.arrows === 'speed') {
      arrows.weight.g.visible = true;
      arrows.total.g.visible = true;
      arrows.weight.setLength(0.8);
      arrows.total.setLength(Math.max(0.2, df / 1000));
      const kg = Math.round(df / 10) * 10;
      liveLabel.setText(`Downforce ${kg.toLocaleString('en-US')} kg · ${Math.round(s.kmh)} km/h`);
    } else if (s.arrows) {
      const k = 1.8 / 1000; // units per kg
      const sh = { front: 0.25, floor: 0.55, rear: 0.2 };
      for (const key of ['front', 'floor', 'rear']) {
        if (s.arrows !== 'split' && s.arrows !== key) continue;
        let L = df * sh[key] * k;
        if (key === 'rear') L *= 1 - 0.6 * s.drs;
        arrows[key].g.visible = true;
        arrows[key].setLength(Math.max(0.22, L));
      }
    }
  }
  apply();

  return {
    group,
    state,
    parts: { car, body, floor, frontWing, rearWing, flapPivot, wheels: wheels.map((w) => w.spin), smoke, arrows },
    set(partial) {
      if (partial.smoke) partial = { ...partial, smoke: { ...state.smoke, ...partial.smoke } };
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
  };
}
