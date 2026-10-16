import * as THREE from 'three';
import { materials, studioPlinth } from '../../framework/parts.js';
import { beveledBox } from '../../framework/geometry.js';
import { clamp01, smooth, win, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A sound suppressor ("silencer") on a bare host barrel stub, product-shot
// staged on a charcoal plinth. CONCEPTUAL cutaway only: proportions are
// generically plausible (a tube roughly 4-5 diameters long, a big open blast
// chamber, a short stack of cone baffles, one hole per baffle on the bore line)
// and carry no stated measurements.
//
// Axis is +X, muzzle end to the right. The camera sits on +Z. Cutaway = the
// +Z (near) half is removed; flat "section" faces in warm bronze show where
// the metal was cut.
//
// ONE scalar drives everything: state.u (lap fraction 0..1). A lap is a single
// shot: bullet leaves the muzzle at T_S, the gas burst is released at T_S and
// lives for LIFE of a lap; bullet, gas, shock and heat are all zero or fully
// faded at the wrap, so the loop is seamless. Scene scalars (cut / can /
// compare / mach / gas / dcan) are pinned by every step's onEnter.
//
// Gas path (suppressed): 8 stages = blast chamber, five inter-baffle chambers,
// the last chamber, then the exit wisp. Inside a chamber each particle swirls
// around the bore line and bulges outward; at each baffle hole it is squeezed
// back to the centre. Positions are derived from the actual cone surfaces so a
// particle never passes through a baffle sheet.

// ---- generic proportions (model units, no real-world meaning) --------------
const RO = 0.46; // can outer radius
const RI = 0.4; // inner liner radius
const RC = RO + 0.012; // end-cap radius (a hair proud: reads as a seam)
const CAN_X0 = -0.3; // front face of the mount boss
const CAN_X1 = 4.2; // exit face of the front cap
const MUZZLE_X = 0.34; // barrel crown
const BORE = 0.105; // bore radius
const RB = 0.17; // barrel body radius
const TH = 0.14; // threaded muzzle radius
const HOST_X0 = -2.4; // where the barrel stub ends in the host block
const B_N = 6; // baffles
const B_X0 = 1.0; // first baffle back edge
const B_S = 0.5; // baffle pitch
const B_D = 0.34; // cone depth
const B_T = 0.05; // sheet thickness (axial)
const B_HOLE = 0.145; // baffle hole radius
const EX = 0.15; // exit hole radius
const FRONT_IN = 4.02; // inner face of the front cap

const Y0 = 1.3; // axis height above floor
const ZC = 1.9; // half separation in the compare step
const U0 = 0.04; // bullet starts moving
const T_S = 0.06; // bullet crosses the muzzle: gas released
const LIFE = 0.92; // gas lifetime as a lap fraction
const BARREL_DUR = 0.02;

const FLIGHT_END = 7.4;
const OUT_DEFAULT = 0.05; // exit cap -> end of the visible flight
const N_STAGE = 8;
const P_STAGE = 1.5;

// inverse of the stage curve: lifetime fraction at which a particle reaches sigma
const aOf = (sigma) => 1 - Math.pow(1 - clamp01(sigma / N_STAGE), 1 / P_STAGE);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const sheet = (r) => (B_D * (RI - Math.max(r, B_HOLE))) / (RI - B_HOLE);

// ---- gas path ----------------------------------------------------------------
// out = {x, r}; stage k in 0..7, fraction f in 0..1, rho in 0..1 per particle
function gasXR(k, f, rho, out) {
  if (k >= 7) {
    // the weak, slow wisp leaving the front cap
    out.x = CAN_X1 + 0.02 + 0.85 * (1 - (1 - f) * (1 - f));
    out.r = 0.05 + (0.04 + 0.2 * rho) * f;
    return out;
  }
  const rEff = 0.3 + 0.7 * rho;
  const rBase = 0.035 + 0.05 * rho;
  const Rk = k === 0 ? 0.36 : 0.335;
  const r = rBase + (Rk * rEff - rBase) * Math.pow(Math.sin(Math.PI * f), 0.7);
  let xp;
  let xn;
  if (k === 0) {
    xp = MUZZLE_X - 0.02;
    xn = B_X0 + sheet(r);
  } else {
    xp = B_X0 + (k - 1) * B_S + B_T + sheet(r);
    xn = k === B_N ? FRONT_IN : B_X0 + k * B_S + sheet(r);
  }
  out.x = xp + (xn - xp) * f;
  out.r = r;
  return out;
}

function heatColor(p, out) {
  // p: 1 = high pressure / hot, 0 = spent / cool
  if (p >= 0.6) {
    const t = (p - 0.6) / 0.4;
    out.setRGB(1.0, 0.42 + 0.48 * t, 0.1 + 0.5 * t);
  } else {
    const t = p / 0.6;
    out.setRGB(0.22 + 0.78 * t, 0.34 + 0.08 * t, 0.46 - 0.36 * t);
  }
  return out;
}

const _m = new THREE.Matrix4();
const _q = new THREE.Quaternion();
const _p = new THREE.Vector3();
const _s = new THREE.Vector3();
const _c = new THREE.Color();
const _xr = { x: 0, r: 0 };

function makeGas(N, kind, seed) {
  const R = rng(seed);
  const rho = new Float32Array(N);
  const phi0 = new Float32Array(N);
  const sgn = new Float32Array(N);
  const jit = new Float32Array(N);
  const size = new Float32Array(N);
  const dir = new Float32Array(N * 3);
  const jet = new Uint8Array(N);
  for (let i = 0; i < N; i++) {
    rho[i] = R();
    phi0[i] = R() * TAU;
    sgn[i] = R() < 0.82 ? 1 : -1;
    jit[i] = R() * 0.02;
    size[i] = 0.7 + 0.6 * R();
    jet[i] = i % 4 === 0 ? 1 : 0;
    // forward-biased unit-ish direction
    const th = R() * TAU;
    const z = R() * 2 - 1;
    const sq = Math.sqrt(1 - z * z);
    dir[i * 3] = z * 0.55 + 0.4;
    dir[i * 3 + 1] = sq * Math.cos(th);
    dir[i * 3 + 2] = sq * Math.sin(th);
  }
  const geo = new THREE.SphereGeometry(1, 7, 5);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
  });
  const mesh = new THREE.InstancedMesh(geo, mat, N);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  mesh.frustumCulled = false;
  for (let i = 0; i < N; i++) mesh.setColorAt(i, _c.setRGB(0, 0, 0));
  _q.identity();

  function hide(i) {
    _m.compose(_p.set(0, -50, 0), _q, _s.setScalar(0));
    mesh.setMatrixAt(i, _m);
  }

  function update(u, gain, halfDim, scale = 1) {
    for (let i = 0; i < N; i++) {
      const age = (((u - T_S - jit[i]) % 1) + 1) % 1;
      const a = age / LIFE;
      if (a >= 1 || gain < 0.001) {
        hide(i);
        continue;
      }
      const fade = smooth(a / 0.03) * (1 - smooth((a - 0.66) / 0.34));
      let x;
      let y;
      let z;
      let p;
      let sz;
      if (kind === 'sup') {
        const sigma = N_STAGE * (1 - Math.pow(1 - a, P_STAGE));
        const k = Math.min(7, Math.floor(sigma));
        const f = sigma - k;
        gasXR(k, f, rho[i], _xr);
        const phi = phi0[i] + sgn[i] * TAU * (1.1 * sigma);
        x = _xr.x;
        y = _xr.r * Math.cos(phi);
        z = _xr.r * Math.sin(phi);
        p = Math.pow(1 - sigma / N_STAGE, 1.5);
        sz = 0.021 * size[i] * (0.75 + 0.7 * p);
      } else {
        const e = 1 - Math.pow(1 - clamp01(a * 1.7), 3);
        const rr = Math.pow(rho[i], 0.55);
        const lenX = (jet[i] ? 4.2 : 2.9) * scale;
        const lat = (jet[i] ? 0.45 : 1.55) * scale;
        x = MUZZLE_X + 0.05 + dir[i * 3] * lenX * rr * e;
        y = dir[i * 3 + 1] * lat * rr * e + 0.5 * a * a;
        z = dir[i * 3 + 2] * lat * rr * e;
        p = Math.pow(1 - a, 1.9);
        sz = 0.05 * size[i] * (0.55 + 1.5 * Math.sqrt(a));
      }
      let b = fade * (0.28 + 0.72 * p) * gain;
      if (halfDim && z > 0) b *= 0.55; // front half is cut away: dim the stray side
      _m.compose(_p.set(x, y, z), _q, _s.setScalar(sz));
      mesh.setMatrixAt(i, _m);
      heatColor(p, _c).multiplyScalar(b);
      mesh.setColorAt(i, _c);
    }
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  return { mesh, update };
}

// ---- geometry helpers --------------------------------------------------------
const SECTION_MAT = new THREE.MeshStandardMaterial({
  color: 0xe0b571,
  roughness: 0.5,
  metalness: 0.25,
  side: THREE.DoubleSide,
});

// profile: [[r, x], ...] closed polygon. Returns {full, half, sec} where half
// keeps only the far (-Z) side and sec is the flat cut face on z = 0.
function revolved(profile, mat, { seg = 72, cast = true } = {}) {
  const pts = [];
  for (let i = 0; i <= profile.length; i++) {
    const [r, x] = profile[i % profile.length];
    pts.push(new THREE.Vector2(r, x), new THREE.Vector2(r, x)); // dup = hard edge
  }
  const mk = (phiStart, phiLen, s) => {
    const g = new THREE.LatheGeometry(pts, s, phiStart, phiLen);
    g.rotateZ(-Math.PI / 2); // lathe Y axis -> +X
    const m = new THREE.Mesh(g, mat);
    m.castShadow = cast;
    return m;
  };
  const full = mk(0, TAU, seg);
  const half = mk(Math.PI / 2, Math.PI, Math.round(seg / 2));
  half.visible = false;
  const sec = sectionFaces(profile);
  sec.visible = false;
  return { full, half, sec };
}

function sectionFaces(profile) {
  const g = new THREE.Group();
  for (const sign of [1, -1]) {
    const shape = new THREE.Shape();
    profile.forEach(([r, x], i) => (i ? shape.lineTo(x, sign * r) : shape.moveTo(x, sign * r)));
    const m = new THREE.Mesh(new THREE.ShapeGeometry(shape), SECTION_MAT);
    m.position.z = 0.003;
    g.add(m);
  }
  return g;
}

function tube(radius, x0, x1, mat, { seg = 72, back = false } = {}) {
  const len = x1 - x0;
  const mk = (thStart, thLen, s) => {
    const g = new THREE.CylinderGeometry(radius, radius, len, s, 1, true, thStart, thLen);
    g.rotateZ(-Math.PI / 2);
    g.translate((x0 + x1) / 2, 0, 0);
    const m = new THREE.Mesh(g, mat);
    m.castShadow = !back;
    return m;
  };
  const full = mk(0, TAU, seg);
  const half = mk(Math.PI / 2, Math.PI, Math.round(seg / 2));
  half.visible = false;
  return { full, half, sec: new THREE.Object3D() };
}

// ---- the model ---------------------------------------------------------------
export function buildSilencer({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const plinth = studioPlinth({ w: 10.6, h: 0.2, d: 4.6 });
  plinth.position.x = 0.5;
  group.add(plinth);

  const labels = calloutSets(['exterior', 'internal', 'gas', 'bare', 'compare', 'crack']);

  // materials -----------------------------------------------------------------
  const barrelMat = materials.brushedSteel(0x4a5059);
  barrelMat.roughness = 0.6;
  barrelMat.side = THREE.DoubleSide;
  const shellMat = materials.brushedSteel(0x7b828b);
  shellMat.roughness = 0.52;
  const capMat = materials.brushedSteel(0xa5acb5);
  capMat.roughness = 0.5;
  capMat.side = THREE.DoubleSide;
  const linerMat = new THREE.MeshStandardMaterial({
    color: 0x0e0f12,
    roughness: 0.95,
    metalness: 0.1,
    side: THREE.BackSide,
  });
  const hostMat = materials.polymer(0x23262c);
  const standMat = materials.polymer(0x2b2f36);
  const bulletMat = new THREE.MeshStandardMaterial({
    color: 0xd08a42,
    metalness: 1,
    roughness: 0.28,
    emissive: 0x6a2a00,
    emissiveIntensity: 0.55,
  });
  const bulletProfile = [
    [0, -0.14],
    [0.07, -0.14],
    [0.088, -0.105],
    [0.088, 0.03],
    [0.07, 0.085],
    [0.04, 0.125],
    [0, 0.15],
  ];
  const bulletGeo = (() => {
    const pts = [];
    bulletProfile.forEach(([r, x]) => pts.push(new THREE.Vector2(r, x)));
    const g = new THREE.LatheGeometry(pts, 24);
    g.rotateZ(-Math.PI / 2);
    return g;
  })();

  const baffleMats = [];
  const cuts = []; // {full, half, sec} entries toggled by cut

  const sphereGeo = new THREE.SphereGeometry(1, 28, 18);
  const addMat = (color, op) =>
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: op,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
    });

  function makeRig({ withCan, seed }) {
    const g = new THREE.Group();
    group.add(g);

    // host block + barrel (hollow: the bore shows in the cutaway) -------------
    const host = beveledBox(1.25, 0.9, 0.62, hostMat, 0.1);
    host.position.set(HOST_X0 - 0.5, -0.12, 0);
    g.add(host);

    const bp = [[BORE, HOST_X0 - 0.1], [RB, HOST_X0 - 0.1], [RB, -0.34], [TH, -0.34]];
    for (let i = 0; i < 7; i++) {
      const x = -0.28 + i * 0.08;
      bp.push([TH, x], [TH + 0.014, x + 0.018], [TH + 0.014, x + 0.04], [TH, x + 0.058]);
    }
    bp.push([TH, 0.3], [TH - 0.02, MUZZLE_X], [BORE, MUZZLE_X]);
    const barrel = revolved(bp, barrelMat, { seg: 56 });
    g.add(barrel.full, barrel.half, barrel.sec);
    cuts.push(barrel);

    // cradle stands -------------------------------------------------------------
    const standH = Y0 - 0.2 - RB + 0.02;
    const s1 = beveledBox(0.55, standH, 0.8, standMat, 0.06);
    s1.position.set(-1.25, -Y0 + 0.2 + standH / 2, 0);
    g.add(s1);

    let canGroup = null;
    if (withCan) {
      canGroup = new THREE.Group();
      g.add(canGroup);
      const s2 = beveledBox(0.6, Y0 - 0.2 - RC + 0.02, 0.9, standMat, 0.06);
      s2.position.set(1.0, -Y0 + 0.2 + (Y0 - 0.2 - RC + 0.02) / 2, 0);
      const s3 = s2.clone();
      s3.position.x = 3.3;
      canGroup.add(s2, s3);

      const shell = tube(RO, 0.18, FRONT_IN, shellMat);
      const liner = tube(RI, 0.18, FRONT_IN, linerMat, { back: true });
      canGroup.add(shell.full, shell.half, liner.half);
      cuts.push(shell);
      cuts.push({ full: new THREE.Object3D(), half: liner.half, sec: new THREE.Object3D() });
      const wall = sectionFaces([[RI, 0.18], [RO, 0.18], [RO, FRONT_IN], [RI, FRONT_IN]]);
      wall.visible = false;
      canGroup.add(wall);
      cuts.push({ full: new THREE.Object3D(), half: new THREE.Object3D(), sec: wall });

      const rear = revolved(
        [[0.156, -0.3], [0.26, -0.3], [0.26, -0.14], [RC - 0.05, -0.14], [RC, -0.09], [RC, 0.18], [0.156, 0.18]],
        capMat,
      );
      const front = revolved(
        [[EX, FRONT_IN], [RC, FRONT_IN], [RC, 4.14], [RC - 0.05, CAN_X1], [EX + 0.04, CAN_X1], [EX, 4.16]],
        capMat,
      );
      canGroup.add(rear.full, rear.half, rear.sec, front.full, front.half, front.sec);
      cuts.push(rear, front);

      const ro = RI - 0.004;
      for (let i = 0; i < B_N; i++) {
        const x0 = B_X0 + i * B_S;
        const m = materials.brushedSteel(0xd2d8df);
        m.roughness = 0.5;
        m.emissive = new THREE.Color(0xff5a14);
        m.emissiveIntensity = 0;
        baffleMats.push(m);
        const b = revolved(
          [[ro, x0], [B_HOLE, x0 + B_D], [B_HOLE, x0 + B_D + B_T], [ro, x0 + B_T]],
          m,
          { seg: 64, cast: false },
        );
        b.full.userData.baffle = i;
        canGroup.add(b.full, b.half, b.sec);
        cuts.push(b);
      }
    }

    const bullet = new THREE.Mesh(bulletGeo, bulletMat);
    bullet.scale.setScalar(1.15);
    bullet.castShadow = false;
    g.add(bullet);

    const gasSup = withCan ? makeGas(380, 'sup', seed) : null;
    const gasBare = makeGas(320, 'bare', seed + 17);
    if (gasSup) g.add(gasSup.mesh);
    g.add(gasBare.mesh);

    const shock = new THREE.Mesh(sphereGeo, addMat(0xffd9a6, 0));
    shock.renderOrder = 2;
    const flash = new THREE.Mesh(sphereGeo, addMat(0xfff0c4, 0));
    flash.renderOrder = 3;
    g.add(shock, flash);

    return { g, canGroup, bullet, gasSup, gasBare, shock, flash };
  }

  const rigA = makeRig({ withCan: true, seed: 11 });
  const rigB = makeRig({ withCan: false, seed: 29 });
  rigB.g.visible = false;

  // Mach wavelets + cone (rig A only) ------------------------------------------
  const MACH = 2.0;
  const wavelets = [];
  for (let j = 0; j < 8; j++) {
    const w = new THREE.Mesh(sphereGeo, addMat(0xaee0ff, 0));
    w.renderOrder = 1;
    w.userData.xj = CAN_X1 + 0.35 + 0.5 * j;
    wavelets.push(w);
    rigA.g.add(w);
  }
  const coneH = 1.9;
  const coneGeo = new THREE.ConeGeometry(coneH * Math.tan(Math.asin(1 / MACH)), coneH, 40, 1, true);
  coneGeo.rotateZ(-Math.PI / 2);
  coneGeo.translate(-coneH / 2, 0, 0);
  const machCone = new THREE.Mesh(coneGeo, addMat(0xcfeaff, 0));
  machCone.renderOrder = 1;
  rigA.g.add(machCone);

  // callouts ----------------------------------------------------------------------
  const A = rigA.g;
  const B = rigB.g;
  labels.add('exterior', A, 'Suppressor tube', [2.2, RC, 0], 70, 70);
  labels.add('exterior', A, 'Mount', [-0.2, 0.26, 0], 110, 62);
  labels.add('exterior', A, 'Barrel', [-1.5, RB, 0], 115, 70);
  labels.add('exterior', A, 'Exit hole', [CAN_X1, 0.0, 0.04], 25, 70);

  labels.add('internal', A, 'Blast chamber', [0.62, 0.25, 0], 80, 64);
  labels.add('internal', A, 'Baffle stack', [2.55, 0.28, 0], 80, 74);
  labels.add('internal', A, 'Mount', [-0.12, 0.2, 0], 115, 60);
  labels.add('internal', A, 'Centre line', [3.78, 0.0, 0], -30, 70);

  labels.add('gas', A, 'Hot, high-pressure gas', [0.6, 0.22, 0], 80, 68);
  labels.add('gas', A, 'Baffle', [2.0 + 0.2, 0.3, 0], 75, 78);
  labels.add('gas', A, 'Cooler, slower gas', [4.55, 0.1, 0], 30, 62);

  labels.add('bare', A, 'Muzzle blast', [MUZZLE_X + 1.1, 0.5, 0], 55, 70);

  labels.add('compare', B, 'Bare muzzle: about 160 dB', [MUZZLE_X + 0.1, 0.3, 0], 70, 70);
  labels.add('compare', A, 'Suppressed: about 130 dB', [CAN_X1 + 0.2, 0.1, 0], 60, 70);

  labels.add('crack', A, 'Sonic crack', [5.7, 0.9, 0], 60, 70);
  labels.add('crack', A, 'Gas wisp', [CAN_X1 + 0.55, 0.12, 0], -40, 68);

  // pose ---------------------------------------------------------------------------
  const state = { u: 0, cut: 0, can: 1, compare: 0, mach: 0, gas: 1, dcan: 0.05, out: OUT_DEFAULT, burst: 1 };

  function bulletX(u) {
    if (u < U0) return -99;
    if (u < T_S) return HOST_X0 + 0.05 + (MUZZLE_X - HOST_X0 - 0.05) * ((u - U0) / BARREL_DUR);
    if (u < T_S + state.dcan) return MUZZLE_X + (CAN_X1 - MUZZLE_X) * ((u - T_S) / state.dcan);
    return CAN_X1 + ((u - T_S - state.dcan) / state.out) * (FLIGHT_END - CAN_X1);
  }

  function applyRig(rig, { canVis, gain, shockAmp, flashAmp, exitAt, cutOn, halfDim }) {
    const u = state.u;
    const age = (((u - T_S) % 1) + 1) % 1;
    const xb = bulletX(u);
    rig.bullet.visible = xb > -50 && xb < FLIGHT_END;
    rig.bullet.position.set(xb, 0, 0);

    if (rig.gasSup) {
      rig.gasSup.mesh.visible = canVis && gain > 0;
      if (canVis) rig.gasSup.update(u, gain, halfDim);
    }
    const bareOn = !canVis;
    rig.gasBare.mesh.visible = bareOn && gain > 0;
    if (bareOn) rig.gasBare.update(u, gain, false, state.burst);

    // shock shell (the bang) + flash
    const s = clamp01(age / 0.45);
    const R = shockAmp * 3.0 * state.burst * (1 - Math.pow(1 - s, 3)) + 0.05;
    rig.shock.position.set(exitAt, 0.0, 0);
    rig.shock.scale.set(R * 0.9, R * 0.7, R * 0.7);
    rig.shock.material.opacity = (s < 1 ? 0.2 * Math.pow(1 - s, 2) : 0) * Math.pow(shockAmp, 0.5) * (gain > 0 ? 1 : 0);
    const sf = clamp01(age / 0.07);
    rig.flash.position.set(exitAt + 0.15 * flashAmp, 0, 0);
    const fr = 0.45 * flashAmp * Math.sin(Math.PI * Math.min(1, sf)) + 0.001;
    rig.flash.scale.setScalar(fr);
    rig.flash.material.opacity = sf < 1 ? 0.8 * flashAmp : 0;
  }

  function apply() {
    const u = state.u;
    const c = clamp01(state.compare);

    rigA.g.position.set(0, Y0, -ZC * c);
    rigB.g.position.set((CAN_X1 - MUZZLE_X) * c, Y0, ZC * c);
    rigB.g.visible = c > 0.001;

    const canVis = state.can > 0.5;
    rigA.canGroup.visible = canVis;

    const cutOn = state.cut > 0.5;
    for (const p of cuts) {
      p.full.visible = !cutOn;
      p.half.visible = cutOn;
      p.sec.visible = cutOn;
    }
    // loose parts of cutable that are sections of the always-on-wall: handled above

    // rig A: with can => tiny wisp-scale shock at the exit, no flash;
    //        without can => the full bare burst from the muzzle
    applyRig(rigA, {
      canVis,
      gain: state.gas,
      shockAmp: canVis ? 0.1 : 1.0,
      flashAmp: canVis ? 0 : 1,
      exitAt: canVis ? CAN_X1 + 0.1 : MUZZLE_X + 0.1,
      cutOn,
      halfDim: cutOn,
    });
    if (rigB.g.visible) {
      applyRig(rigB, {
        canVis: false,
        gain: state.gas,
        shockAmp: 1.0,
        flashAmp: 1,
        exitAt: MUZZLE_X + 0.1,
        cutOn: false,
        halfDim: false,
      });
    }

    // baffle heat: warms as the gas front passes, then bleeds off to zero by the wrap
    const tt = (((u - T_S) % 1) + 1) % 1;
    baffleMats.forEach((m, i) => {
      const tk = LIFE * aOf(i + 1.0);
      const h = smooth((tt - tk) / 0.04) * (1 - smooth((tt - 0.5) / 0.42));
      m.emissiveIntensity = canVis ? 0.85 * h * state.gas : 0;
    });

    // Mach wavelets: a sphere per point the bullet passed, growing at 1/M of its speed
    const xb = bulletX(u) > -50 ? bulletX(u) : -99;
    const fadeAll = 1 - win(u, 0.8, 0.97);
    const mOn = state.mach > 0.001 && canVis;
    wavelets.forEach((w) => {
      const r = (xb - w.userData.xj) / MACH;
      if (!mOn || r <= 0.01 || r > 1.4) {
        w.visible = false;
        return;
      }
      w.visible = true;
      w.position.set(w.userData.xj, 0, 0);
      w.scale.setScalar(r);
      w.material.opacity = 0.12 * state.mach * (1 - r / 1.4) * fadeAll;
    });
    const coneOn = mOn && xb > CAN_X1 + 0.05 && xb < FLIGHT_END;
    machCone.visible = coneOn;
    if (coneOn) {
      machCone.position.set(xb, 0, 0);
      machCone.material.opacity = 0.04 * state.mach;
    }
  }
  apply();

  return {
    group,
    state,
    setLabels: labels.setLabels,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    parts: { rigA: rigA.g, rigB: rigB.g, plinth },
  };
}
