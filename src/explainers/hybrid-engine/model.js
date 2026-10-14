import * as THREE from 'three';
import { materials, rod } from '../../framework/parts.js';
import { beveledBox, tubeAlong, gear } from '../../framework/geometry.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';
import {
  PERIOD,
  TYRE_R,
  frac,
  roadTexture,
  roadStrip,
  glowMat,
  noAO,
  buildCar,
} from '../../framework/vehicle.js';

// Toyota-style power-split hybrid on the shared road treadmill (framework/
// vehicle.js). ONE planetary gearset joins three things:
//   carrier <- petrol engine        sun -> generator MG1        ring -> wheels
// and the traction motor MG2 is geared onto that same ring. There is no
// clutch, torque converter or gearbox: the ratio between engine and wheels is
// set by how fast MG1 spins.
//
// MECHANISM (researched — eahart.com PSD page, UVic THS model paper, Silicon
// Chip "Toyota's Hybrid Synergy Drive", Gen-2 Prius tooth counts):
//   sun 30 teeth · ring 78 teeth · 4 planets of 24 (30 + 2x24 = 78)
//   speed line (Willis):  Ns*ws + Nr*wr = (Ns+Nr)*wc   ->   ws = 3.6 wc - 2.6 wr
//   torque split of the ENGINE's torque:  ring 78/108 = 72.2%, sun 30/108 = 27.8%
//   MG1 start the engine and spins backwards when the engine is stopped
//   (carrier held: ws = -2.6 wr), the engine can stop completely, and regen
//   braking is MG2 acting as a generator.
// Every angle in the scene comes from the SAME two numbers (carrier turns and
// ring turns) through those formulas, so the gears, lever diagram and power
// flows can never disagree.
//
// DISCLOSED SIMPLIFICATIONS:
//   - gear speeds are slowed for legibility (ring 5 turns per 12 s lap), so the
//     ring-to-wheel ratio shown is not the real final drive.
//   - MG2 is drawn on its own axis meshing the ring's outer teeth (as in the
//     later Toyota transaxles) but WITHOUT its reduction planetary; the final
//     drive is a single gear pair into the differential.
//   - power numbers are relative, not kW. MG1/MG2 limits, engine start by MG1
//     and friction-brake blending are not modelled.
//   - gearset drawn ~2x real size so it reads (real ring ~Ø 20 cm).
//
// SCALARS: setLap(u) u in [0,1) — every lap is 12 s and seamless: ring 5 whole
// turns, carrier 0 or 10 whole turns (even => the 4-stroke repeats), road 12
// whole periods, wheels a whole number of turns. 5 and 10 differ by a multiple
// of 5, so the sun (3.6*10 - 2.6*5 = 23 turns) is whole too.
//   setMode(name): cruise | ev | charge | boost | regen | cycle
//   setReveal(0 sealed · 1 ghosted · 2 x-ray) · setFocus('none'|'psd')
//   setOverlay(show lever HUD, x, y, z) · setLabels(set)

// --- the gearset (real tooth counts) -------------------------------------------------
const S_T = 30;
const R_T = 78;
const P_T = 24;
const N_PL = 4;
const N_OUT = 96; // external teeth cut on the ring's outside (compound gear)
const N_PIN = 24; // MG2 pinion on the outer teeth
const N_DIFF = 48; // final-drive gear into the differential
const MR = 0.0022; // pitch radius per tooth (m)
const MOD = MR * 2;
const TOOTH_D = 2.25 * MOD;
const GEAR_T = 0.05;
const SUN_R = S_T * MR; // 0.066
const PL_R = P_T * MR; // 0.0528
const CARRIER_R = SUN_R + PL_R; // 0.1188
const RING_R = R_T * MR; // 0.1716
const OUT_R = N_OUT * MR; // 0.2112
const PHASE_K = (P_T - 1) * Math.PI;
const K_SPLIT_RING = R_T / (S_T + R_T); // 72.2% of engine torque to the ring
const K_SPLIT_SUN = S_T / (S_T + R_T); // 27.8% to the sun

// --- car-local layout (x right, y up, forward -z) -------------------------------------
const AZ = -1.62; // powertrain axis, ahead of the front axle
const AY = 0.55;
const X_PSD = 0;
const A_MG2 = 2.5; // MG2 pinion direction from the ring, in the gear's own frame
const A_DIFF = -2.35;
const dPin = (N_OUT + N_PIN) * MR;
const dDiff = (N_OUT + N_DIFF) * MR;
const MG2_Y = AY + dPin * Math.sin(A_MG2);
const MG2_Z = AZ - dPin * Math.cos(A_MG2);
const DIFF_Y = AY + dDiff * Math.sin(A_DIFF);
const DIFF_Z = AZ - dDiff * Math.cos(A_DIFF);

// --- the lap -------------------------------------------------------------------------
const T_LAP = 12;
const P_LAP = 12; // road periods per lap -> 144 m
const S_BAR = P_LAP * PERIOD;
const WHEEL_TURNS = Math.round(S_BAR / (TAU * TYRE_R));
const TR = 5; // ring turns per lap
const NS = 1200;

const AMBER = new THREE.Color(0xffa43a);
const BLUE = new THREE.Color(0x4aa3ff);
const GREEN = new THREE.Color(0x62d48a);
const ELEC = new THREE.Color(0x35d4ff);
const CHG = new THREE.Color(0x5dff9a);
const DIS = new THREE.Color(0xff8a3c);

function keyed(pts) {
  return (u) => {
    for (let i = 1; i < pts.length; i++) {
      if (u <= pts[i][0] || i === pts.length - 1) {
        const [u0, v0] = pts[i - 1];
        const [u1, v1] = pts[i];
        return v0 + (v1 - v0) * smooth((u - u0) / (u1 - u0));
      }
    }
    return pts[0][1];
  };
}

// Each mode: car speed v(u), engine-on e(u), engine-speed breathing w(u), a
// charge bias, and the engine's turns per lap. Everything else is derived.
const MODES = {
  cruise: {
    v: () => 1,
    e: () => 1,
    w: (u) => 1 + 0.42 * Math.sin(TAU * u),
    bias: 0.1,
    tc: 10,
    name: 'ENGINE + GENERATOR',
  },
  ev: {
    v: keyed([[0, 0.8], [0.5, 1.15], [1, 0.8]]),
    e: () => 0,
    w: () => 1,
    bias: 0,
    tc: 0,
    name: 'ELECTRIC ONLY',
  },
  charge: {
    v: (u) => 1 + 0.04 * Math.sin(TAU * u),
    e: () => 1,
    w: (u) => 1 + 0.03 * Math.sin(TAU * u),
    bias: 0.55,
    tc: 10,
    name: 'CHARGING WHILE DRIVING',
  },
  boost: {
    v: keyed([[0, 0.65], [0.5, 1.45], [1, 0.65]]),
    e: () => 1,
    w: () => 1,
    bias: 0.05,
    tc: 10,
    name: 'FULL POWER',
  },
  regen: {
    v: keyed([[0, 1.3], [0.7, 0.55], [1, 1.3]]),
    e: () => 0,
    w: () => 1,
    bias: 0,
    tc: 0,
    name: 'REGENERATIVE BRAKING',
  },
  cycle: {
    v: keyed([[0, 0.5], [0.2, 1.0], [0.3, 1.05], [0.55, 1.5], [0.8, 1.3], [1, 0.5]]),
    e: keyed([[0, 0], [0.2, 0], [0.3, 1], [0.78, 1], [0.84, 0], [1, 0]]),
    w: () => 1,
    bias: 0.35,
    tc: 10,
    name: 'DRIVE CYCLE',
  },
};

const PE_MAX = 1.0;
const P_REGEN = 0.9;

// Simulate one lap at build time: speeds -> exact whole-turn angle tables ->
// power flows through the gearset's torque split.
function simulateMode(mode) {
  const M = MODES[mode];
  const v = new Float64Array(NS + 1);
  const e = new Float64Array(NS + 1);
  const pw = new Float64Array(NS + 1);
  const pe = new Float64Array(NS + 1);
  const wcRaw = new Float64Array(NS + 1);
  for (let i = 0; i <= NS; i++) {
    const u = i / NS;
    v[i] = M.v(u);
    e[i] = M.e(u);
  }
  for (let i = 0; i <= NS; i++) {
    const a = v[Math.min(NS, i + 1)];
    const b = v[Math.max(0, i - 1)];
    const dv = (a - b) / (Math.min(NS, i + 1) - Math.max(0, i - 1)) * NS; // per lap
    // wrap derivative so it's smooth at the seam
    const dvw = i === 0 || i === NS ? (v[1] - v[NS - 1]) / (2 / NS) : dv;
    pw[i] = 0.4 * v[i] * dvw + 0.25 * v[i] + 0.15 * v[i] ** 3;
    pe[i] = e[i] * Math.min(PE_MAX, Math.max(0.05, pw[i] + M.bias));
    wcRaw[i] = e[i] * (0.7 + 0.5 * (pe[i] / PE_MAX)) * M.w(i / NS);
  }
  const cum = (arr) => {
    const c = new Float64Array(NS + 1);
    for (let i = 0; i < NS; i++) c[i + 1] = c[i] + ((arr[i] + arr[i + 1]) / 2) / NS;
    return c;
  };
  const cv = cum(v);
  const cc = cum(wcRaw);
  const thR = new Float64Array(NS + 1);
  const thC = new Float64Array(NS + 1);
  const s = new Float64Array(NS + 1);
  const wheel = new Float64Array(NS + 1);
  const wrT = new Float64Array(NS + 1); // turns per lap
  const wcT = new Float64Array(NS + 1);
  for (let i = 0; i <= NS; i++) {
    thR[i] = (TAU * TR * cv[i]) / cv[NS];
    s[i] = (S_BAR * cv[i]) / cv[NS];
    wheel[i] = (TAU * WHEEL_TURNS * cv[i]) / cv[NS];
    wrT[i] = (TR * v[i]) / cv[NS];
    if (M.tc > 0) {
      thC[i] = (TAU * M.tc * cc[i]) / cc[NS];
      wcT[i] = (M.tc * wcRaw[i]) / cc[NS];
    }
  }
  // flows (relative units): + means the arrow's named direction
  const fEng = new Float64Array(NS + 1); // engine -> gearset
  const fSun = new Float64Array(NS + 1); // sun -> MG1 (mechanical, = MG1 electrical out)
  const fWheel = new Float64Array(NS + 1); // gearset/MG2 -> wheels (total)
  const fMg2 = new Float64Array(NS + 1); // inverter -> MG2 (electrical)
  const fBat = new Float64Array(NS + 1); // battery -> inverter
  const fMg1 = new Float64Array(NS + 1); // MG1 -> inverter
  for (let i = 0; i <= NS; i++) {
    const on = wcT[i] > 0.5 && e[i] > 0.02;
    const wsT = 3.6 * wcT[i] - 2.6 * wrT[i];
    const sunFlow = on ? K_SPLIT_SUN * pe[i] * (wsT / wcT[i]) : 0;
    const ringMech = on ? K_SPLIT_RING * pe[i] * (wrT[i] / wcT[i]) : 0;
    fEng[i] = on ? pe[i] : 0;
    fSun[i] = sunFlow;
    fMg1[i] = sunFlow;
    let p2 = pw[i] - ringMech;
    p2 = Math.max(p2, -P_REGEN);
    fMg2[i] = p2;
    fWheel[i] = ringMech + p2;
    fBat[i] = p2 - sunFlow;
  }
  return { M, NS, v, e, s, wheel, thR, thC, wrT, wcT, fEng, fSun, fWheel, fMg2, fBat, fMg1 };
}

// --- canvas HUD: the lever diagram + battery state ---------------------------------------
function makeHud() {
  const W = 640;
  const H = 440;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mat = new THREE.SpriteMaterial({
    map: tex,
    transparent: true,
    depthWrite: false,
    depthTest: false,
    toneMapped: false,
  });
  const sprite = new THREE.Sprite(mat);
  sprite.scale.set(2.0, 2.0 * (H / W), 1);
  sprite.renderOrder = 30;
  sprite.userData.noOcclude = true;
  const css = (col) => `#${col.getHexString()}`;
  const XS = 110;
  const XR = 530;
  const XC = XS + (R_T / (S_T + R_T)) * (XR - XS);
  const Y0 = 190;
  const K = 2.4;
  function draw(st) {
    g.clearRect(0, 0, W, H);
    g.fillStyle = 'rgba(14,16,20,0.80)';
    g.beginPath();
    g.roundRect(6, 6, W - 12, H - 12, 22);
    g.fill();
    g.strokeStyle = 'rgba(79,209,165,0.55)';
    g.lineWidth = 3;
    g.stroke();
    g.fillStyle = '#e8eaf0';
    g.font = '700 30px "Segoe UI", Arial, sans-serif';
    g.textAlign = 'left';
    g.fillText(st.title, 30, 50);
    // zero line
    g.strokeStyle = 'rgba(255,255,255,0.28)';
    g.lineWidth = 2;
    g.setLineDash([8, 8]);
    g.beginPath();
    g.moveTo(60, Y0);
    g.lineTo(W - 60, Y0);
    g.stroke();
    g.setLineDash([]);
    g.fillStyle = 'rgba(255,255,255,0.45)';
    g.font = '600 18px "Segoe UI", Arial, sans-serif';
    g.textAlign = 'right';
    g.fillText('stopped', W - 14, Y0 - 8);
    // rails
    g.strokeStyle = 'rgba(255,255,255,0.18)';
    g.lineWidth = 2;
    for (const x of [XS, XC, XR]) {
      g.beginPath();
      g.moveTo(x, 78);
      g.lineTo(x, 304);
      g.stroke();
    }
    const yS = Y0 - Math.max(-48, Math.min(48, st.ws)) * K;
    const yC = Y0 - Math.max(-48, Math.min(48, st.wc)) * K;
    const yR = Y0 - Math.max(-48, Math.min(48, st.wr)) * K;
    // the lever: one straight line through all three speeds
    g.strokeStyle = '#f4f6fa';
    g.lineWidth = 5;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(XS, yS);
    g.lineTo(XR, yR);
    g.stroke();
    const dot = (x, y, col) => {
      g.fillStyle = col;
      g.beginPath();
      g.arc(x, y, 15, 0, TAU);
      g.fill();
      g.strokeStyle = '#0e1014';
      g.lineWidth = 4;
      g.stroke();
    };
    dot(XS, yS, css(BLUE));
    dot(XR, yR, css(GREEN));
    dot(XC, yC, css(AMBER));
    g.font = '700 21px "Segoe UI", Arial, sans-serif';
    g.textAlign = 'center';
    g.fillStyle = css(BLUE);
    g.fillText('GENERATOR', XS, 332);
    g.fillStyle = css(AMBER);
    g.fillText('ENGINE', XC, 332);
    g.fillStyle = css(GREEN);
    g.fillText('WHEELS', XR, 332);
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.font = '600 17px "Segoe UI", Arial, sans-serif';
    g.fillText('sun · 30 teeth', XS, 354);
    g.fillText('carrier', XC, 354);
    g.fillText('ring · 78 teeth', XR, 354);
    // battery line
    let btxt = 'Battery idle';
    let bcol = '#9aa3b0';
    if (st.bat > 0.06) {
      btxt = 'Battery discharging';
      bcol = css(DIS);
    } else if (st.bat < -0.06) {
      btxt = 'Battery charging';
      bcol = css(CHG);
    }
    g.textAlign = 'left';
    g.fillStyle = bcol;
    g.font = '700 24px "Segoe UI", Arial, sans-serif';
    g.fillText(btxt, 30, 388);
    g.textAlign = 'center';
    g.fillStyle = '#e8eaf0';
    g.font = '600 20px "Segoe UI", Arial, sans-serif';
    g.fillText('generator = 3.6 × engine − 2.6 × wheels', W / 2, 420);
    tex.needsUpdate = true;
  }
  return { sprite, draw };
}

// --- geometry helpers ---------------------------------------------------------------------
// cylinder along +X from x0 (radius r0) to x1 (radius r1)
function cylX(r0, r1, x0, x1, mat, seg = 32, open = false) {
  const geo = new THREE.CylinderGeometry(r1, r0, x1 - x0, seg, 1, open);
  geo.rotateZ(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, 0);
  const m = new THREE.Mesh(geo, mat);
  m.castShadow = true;
  return m;
}

function toothPath(path, teeth, tipR, rootR, halfTip, halfRoot) {
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const c = i * step;
    const pts = [
      [rootR, c - halfRoot],
      [tipR, c - halfTip],
      [tipR, c + halfTip],
      [rootR, c + halfRoot],
      [rootR, c + step / 2],
    ];
    pts.forEach(([r, a], k) => {
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0 && k === 0) path.moveTo(x, y);
      else path.lineTo(x, y);
    });
  }
  path.closePath();
}

// The ring gear is a COMPOUND gear: internal teeth (78) mesh the planets, and
// external teeth (96) cut on its rim carry the drive out to MG2 and the wheels.
function compoundRing(material) {
  const stepO = TAU / N_OUT;
  const stepI = TAU / R_T;
  const shape = new THREE.Shape();
  toothPath(shape, N_OUT, OUT_R + MOD, OUT_R + MOD - TOOTH_D, stepO * 0.12, stepO * 0.26);
  const hole = new THREE.Path();
  toothPath(hole, R_T, RING_R - MOD, RING_R + 1.25 * MOD, stepI * 0.26, stepI * 0.13);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: GEAR_T,
    bevelEnabled: true,
    bevelThickness: GEAR_T * 0.1,
    bevelSize: 0.002,
    bevelSegments: 1,
    curveSegments: 64,
  });
  geo.translate(0, 0, -GEAR_T / 2);
  geo.rotateY(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

function axialGear(teeth, pitchR, thickness, material, holeR = 0) {
  const g = gear({ teeth, radius: pitchR + MOD, thickness, toothDepth: TOOTH_D, holeR }, material);
  g.rotation.y = Math.PI / 2;
  return g;
}

// ring of N magnet blocks on a rotor so its spin can be seen
function rotorMagnets(group, x0, x1, r, n, matA, matB) {
  for (let i = 0; i < n; i++) {
    const a = (i * TAU) / n;
    const m = beveledBox(x1 - x0, 0.03, 0.034, i % 2 ? matA : matB, 0.006);
    m.position.set((x0 + x1) / 2, Math.sin(a) * (r + 0.004), -Math.cos(a) * (r + 0.004));
    m.rotation.x = a;
    m.userData.magnet = true;
    group.add(m);
  }
}

// --- main build -------------------------------------------------------------------------------
export function buildHybridEngine({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  const labels = calloutSets(['inside', 'psd', 'lever', 'ev', 'charge', 'boost', 'regen']);
  const SIMS = Object.fromEntries(Object.keys(MODES).map((k) => [k, simulateMode(k)]));

  // --- road --------------------------------------------------------------------------------
  const R_NEAR = 20;
  const R_FAR = -70;
  const R_FADE = 15;
  const fadeAt = (z) => Math.pow(clamp01(Math.min((R_NEAR - z) / R_FADE, (z - R_FAR) / R_FADE)), 1.6);
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshStandardMaterial({ map: roadTex, roughness: 0.9, metalness: 0 });
  const roadFadeMat = roadMat.clone();
  roadFadeMat.vertexColors = true;
  roadFadeMat.transparent = true;
  const roadMain = roadStrip(R_NEAR - R_FADE, R_FAR + R_FADE, 4, () => 1, roadMat);
  const roadNear = roadStrip(R_NEAR, R_NEAR - R_FADE, 30, fadeAt, roadFadeMat);
  const roadFar = roadStrip(R_FAR + R_FADE, R_FAR, 30, fadeAt, roadFadeMat);
  roadNear.renderOrder = roadFar.renderOrder = -1;
  for (const m of [roadMain, roadNear, roadFar]) {
    m.position.y = 0.003;
    m.userData.noOcclude = true;
    group.add(m);
  }

  // --- the car ----------------------------------------------------------------------------------
  const ego = buildCar({ paintColor: 0x2f7d6b, interior: true });
  group.add(ego.root);
  const pt = new THREE.Group(); // the whole powertrain, car-local
  ego.root.add(pt);

  // materials. Housings are plain transparent plastic-like stuff so they can
  // ghost (metal can't): `shells` fade together in setFocus.
  const shells = [];
  const shellMat = (color, base) => {
    const m = new THREE.MeshStandardMaterial({
      color,
      roughness: 0.55,
      metalness: 0.15,
      transparent: true,
      opacity: base,
      depthWrite: base > 0.5,
      side: THREE.FrontSide,
    });
    m.userData.base = base;
    shells.push(m);
    return m;
  };
  const gearMat = (color, rough = 0.38) =>
    new THREE.MeshStandardMaterial({ color, metalness: 0.75, roughness: rough });
  const sunMat = gearMat(0x3e8de0);
  const carrierMat = gearMat(0xe0922f);
  const planetMat = gearMat(0xd7dbe2, 0.35);
  const ringMat = gearMat(0x4fb877);
  const steel = materials.darkMetal(0x8d949c);
  steel.roughness = 0.45;
  const darkSteel = gearMat(0x4a4f57, 0.5);
  const copper = new THREE.MeshStandardMaterial({ color: 0xc57a42, metalness: 1, roughness: 0.32 });
  const cableMat = new THREE.MeshStandardMaterial({ color: 0xff7a1c, roughness: 0.5, metalness: 0.1 });
  const magA = gearMat(0x2e6fd0, 0.4);
  const magB = gearMat(0xd04a3a, 0.4);

  // ====================================================== PETROL ENGINE ======
  // Transverse inline-4: 95 mm bore pitch, 85 mm stroke, 130 mm rod; the
  // crank axis IS the powertrain axis (x). Block and head are ghost shells.
  const engine = new THREE.Group();
  pt.add(engine);
  const ENG_X0 = -0.6;
  const ENG_X1 = -0.22;
  const CYL_X = [0, 1, 2, 3].map((k) => ENG_X0 + 0.0475 + k * 0.095);
  const blockMat = shellMat(0x7d8794, 0.5);
  const headMat = shellMat(0x667080, 0.55);
  const block = beveledBox(ENG_X1 - ENG_X0, 0.34, 0.34, blockMat, 0.02);
  block.position.set((ENG_X0 + ENG_X1) / 2, 0.57, AZ);
  const head = beveledBox(ENG_X1 - ENG_X0, 0.12, 0.3, headMat, 0.02);
  head.position.set((ENG_X0 + ENG_X1) / 2, 0.8, AZ);
  const cover = beveledBox(ENG_X1 - ENG_X0 - 0.02, 0.05, 0.22, shellMat(0x3a4048, 0.8), 0.015);
  cover.position.set((ENG_X0 + ENG_X1) / 2, 0.885, AZ);
  const pan = beveledBox(ENG_X1 - ENG_X0 - 0.04, 0.09, 0.26, shellMat(0x555d68, 0.6), 0.02);
  pan.position.set((ENG_X0 + ENG_X1) / 2, 0.355, AZ);
  engine.add(block, head, cover, pan);
  // exhaust (front, -z) and intake (rear) manifolds
  const exhaustMat = new THREE.MeshStandardMaterial({ color: 0x8a5a3c, metalness: 0.8, roughness: 0.5 });
  const exhaustPipes = [];
  for (const x of CYL_X) {
    exhaustPipes.push(
      tubeAlong(
        [
          [x, 0.8, AZ - 0.15],
          [x, 0.78, AZ - 0.23],
          [(ENG_X0 + ENG_X1) / 2, 0.74, AZ - 0.27],
        ],
        0.014,
        exhaustMat,
        { tubularSegments: 14, radialSegments: 8 },
      ),
    );
  }
  const exhaustRail = cylX(0.02, 0.02, ENG_X0 + 0.02, ENG_X1 - 0.02, exhaustMat, 12);
  exhaustRail.position.set(0, 0.74, AZ - 0.27);
  const intake = beveledBox(ENG_X1 - ENG_X0 - 0.06, 0.07, 0.07, steel, 0.02);
  intake.position.set((ENG_X0 + ENG_X1) / 2, 0.82, AZ + 0.2);
  engine.add(...exhaustPipes, exhaustRail, intake);

  // crankshaft (spins with the carrier) + rods + pistons + combustion glow
  const CR = 0.0425;
  const ROD_L = 0.13;
  const PH = [0, Math.PI, Math.PI, 0]; // 1-3-4-2 flat-plane crank
  const FIRE = [0, 3 * Math.PI, Math.PI, 2 * Math.PI]; // firing angles, 0-4pi
  const crank = new THREE.Group();
  crank.position.set(0, AY, AZ);
  engine.add(crank);
  crank.add(cylX(0.02, 0.02, ENG_X0 - 0.01, ENG_X1 + 0.02, steel, 18));
  const pistons = [];
  const rods = [];
  const glows = [];
  const pistonMat = materials.aluminum(0xcfd5dc);
  pistonMat.roughness = 0.45;
  const rodMat = gearMat(0xa5acb5, 0.4);
  const glowCore = new THREE.MeshBasicMaterial({
    color: 0xffa23a,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    toneMapped: false,
    blending: THREE.AdditiveBlending,
  });
  for (let k = 0; k < 4; k++) {
    const x = CYL_X[k];
    const web = beveledBox(0.012, 0.06, 0.02, steel, 0.004);
    web.position.set(x - 0.02, CR * 0.5 * Math.cos(PH[k]), CR * 0.5 * Math.sin(PH[k]));
    web.rotation.x = PH[k] - Math.PI / 2 + Math.PI / 2; // long axis (y) points along the throw
    const pin = cylX(0.013, 0.013, x - 0.016, x + 0.016, steel, 12);
    pin.position.set(0, CR * Math.cos(PH[k]), CR * Math.sin(PH[k]));
    crank.add(web, pin);
    const piston = new THREE.Group();
    piston.add(rod(0.037, 0.06, pistonMat, 24));
    piston.children[0].position.y = -0.03;
    piston.position.set(x, 0.72, AZ);
    engine.add(piston);
    pistons.push(piston);
    const rr = rod(0.007, ROD_L, rodMat, 10);
    const rodG = new THREE.Group();
    rodG.add(rr);
    engine.add(rodG);
    rods.push(rodG);
    const gl = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), glowCore.clone());
    gl.position.set(x, 0.775, AZ);
    gl.userData.noOcclude = true;
    engine.add(gl);
    glows.push(gl);
  }
  for (const gl of glows) noAO(gl);

  // ====================================================== CARRIER MEMBER ======
  // engine shaft + damper + the carrier spider + four planet pins (amber)
  const carrierM = new THREE.Group();
  carrierM.position.set(X_PSD, AY, AZ);
  pt.add(carrierM);
  carrierM.add(cylX(0.02, 0.02, ENG_X1, -0.05, carrierMat, 18));
  const damper = cylX(0.075, 0.075, ENG_X1 + 0.005, ENG_X1 + 0.06, darkSteel, 40);
  const damperRim = cylX(0.092, 0.092, ENG_X1 + 0.022, ENG_X1 + 0.045, steel, 48);
  carrierM.add(damper, damperRim);
  carrierM.add(cylX(0.034, 0.034, -0.065, -0.04, carrierMat, 24));
  for (let i = 0; i < N_PL; i++) {
    const pa = (i * TAU) / N_PL;
    const arm = beveledBox(0.016, CARRIER_R + 0.02 - 0.03, 0.03, carrierMat, 0.005);
    const r = (CARRIER_R + 0.02 + 0.03) / 2;
    arm.position.set(-0.052, r * Math.sin(pa), -r * Math.cos(pa));
    arm.rotation.x = pa - Math.PI / 2; // long axis (Y) points radially outward
    carrierM.add(arm);
  }
  // amber carrier ring on the front face joins the four pin ends, so the
  // carrier reads as one amber part in front of the grey planets
  const carrierRing = new THREE.Mesh(new THREE.TorusGeometry(CARRIER_R, 0.008, 10, 64), carrierMat);
  carrierRing.rotation.y = Math.PI / 2;
  carrierRing.position.x = 0.05;
  carrierM.add(carrierRing);
  for (let i = 0; i < N_PL; i++) {
    const pa = (i * TAU) / N_PL;
    const cap = cylX(0.017, 0.017, 0.042, 0.056, carrierMat, 16);
    cap.position.set(0, CARRIER_R * Math.sin(pa), -CARRIER_R * Math.cos(pa));
    carrierM.add(cap);
  }
  const planets = [];
  for (let i = 0; i < N_PL; i++) {
    const pa = (i * TAU) / N_PL;
    const holder = new THREE.Group();
    holder.position.set(0, CARRIER_R * Math.sin(pa), -CARRIER_R * Math.cos(pa));
    const spin = new THREE.Group();
    spin.add(axialGear(P_T, PL_R, GEAR_T, planetMat, 0.01));
    holder.add(spin, cylX(0.009, 0.009, -0.055, 0.045, steel, 12));
    carrierM.add(holder);
    planets.push(spin);
  }

  // ========================================================== SUN + MG1 ======
  const dressPsd = [];
  const sunM = new THREE.Group();
  sunM.position.set(X_PSD, AY, AZ);
  pt.add(sunM);
  sunM.add(axialGear(S_T, SUN_R, GEAR_T, sunMat, 0.012));
  sunM.add(cylX(0.022, 0.022, 0.02, 0.3, sunMat, 18));
  const rotor1 = cylX(0.07, 0.07, 0.09, 0.25, darkSteel, 36);
  sunM.add(rotor1);
  rotorMagnets(sunM, 0.1, 0.24, 0.07, 8, magA, magB);
  const dressPsd0 = true; // (list is filled below once the coils exist)
  // MG1 static: ghostable housing + copper end windings
  const mg1Mat = shellMat(0x8f98a5, 0.55);
  const mg1Housing = cylX(0.125, 0.125, 0.07, 0.27, mg1Mat, 40);
  pt.add(mg1Housing);
  mg1Housing.position.set(0, AY, AZ);
  const mg1Coils = [];
  dressPsd.push(rotor1);
  sunM.children.forEach((c) => c.userData.magnet && dressPsd.push(c));
  for (const x of [0.085, 0.255]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.016, 10, 40), copper);
    t.rotation.y = Math.PI / 2;
    t.position.set(x, AY, AZ);
    pt.add(t);
    mg1Coils.push(t);
    dressPsd.push(t);
  }

  // ======================================================== RING (compound) ======
  const ringM = new THREE.Group();
  ringM.position.set(X_PSD, AY, AZ);
  pt.add(ringM);
  ringM.add(compoundRing(ringMat));

  // ================================================== MG2 + final drive ======
  const pinionM = new THREE.Group();
  pinionM.position.set(X_PSD, MG2_Y, MG2_Z);
  pt.add(pinionM);
  pinionM.add(axialGear(N_PIN, N_PIN * MR, GEAR_T, ringMat, 0.01));
  pinionM.add(cylX(0.02, 0.02, 0.02, 0.28, ringMat, 16));
  const rotor2 = cylX(0.06, 0.06, 0.07, 0.25, darkSteel, 32);
  pinionM.add(rotor2);
  dressPsd.push(rotor2);
  rotorMagnets(pinionM, 0.08, 0.24, 0.06, 8, magA, magB);
  pinionM.children.forEach((c) => c.userData.magnet && dressPsd.push(c));
  const mg2Mat = shellMat(0x8f98a5, 0.55);
  const mg2Housing = cylX(0.108, 0.108, 0.06, 0.27, mg2Mat, 40);
  mg2Housing.position.set(0, MG2_Y, MG2_Z);
  pt.add(mg2Housing);
  for (const x of [0.07, 0.26]) {
    const t = new THREE.Mesh(new THREE.TorusGeometry(0.086, 0.014, 10, 36), copper);
    t.rotation.y = Math.PI / 2;
    t.position.set(x, MG2_Y, MG2_Z);
    pt.add(t);
    dressPsd.push(t);
  }

  const diffM = new THREE.Group();
  diffM.position.set(X_PSD, DIFF_Y, DIFF_Z);
  pt.add(diffM);
  diffM.add(axialGear(N_DIFF, N_DIFF * MR, GEAR_T, ringMat, 0.04));
  const diffCase = cylX(0.062, 0.062, -0.07, 0.07, darkSteel, 28);
  diffM.add(diffCase);
  const diffEnd = [-1, 1].map((s) => {
    const c = cylX(0.04, 0.04, s * 0.07, s * 0.12, steel, 20);
    diffM.add(c);
    return c;
  });
  // half-shafts out to the front wheels
  for (const [a, b] of [[-0.74, -0.12], [0.12, 0.74]]) {
    const hs = cylX(0.014, 0.014, a, b, steel, 12);
    hs.position.set(0, DIFF_Y, DIFF_Z);
    pt.add(hs);
  }

  // ======================================================== ELECTRICS ======
  const inverterMat = materials.aluminum(0xa7afb9);
  inverterMat.roughness = 0.5;
  const INV = new THREE.Vector3(0.22, 0.93, -1.2);
  const inverter = beveledBox(0.46, 0.1, 0.3, inverterMat, 0.02);
  inverter.position.copy(INV);
  pt.add(inverter);
  for (let i = 0; i < 9; i++) {
    const fin = beveledBox(0.004, 0.022, 0.26, inverterMat, 0.001);
    fin.position.set(INV.x - 0.19 + i * 0.0475, INV.y + 0.06, INV.z);
    pt.add(fin);
  }
  // battery pack behind the rear seat: ghost case + 14 stick modules
  const BAT = new THREE.Vector3(0, 0.52, 1.58);
  const batCaseMat = shellMat(0x2b3138, 0.35);
  const batCase = beveledBox(0.84, 0.3, 0.42, batCaseMat, 0.03);
  batCase.position.copy(BAT);
  pt.add(batCase);
  const batModMat = new THREE.MeshStandardMaterial({
    color: 0x1f6f55,
    roughness: 0.5,
    metalness: 0.3,
    emissive: 0x2dbf8a,
    emissiveIntensity: 0.0,
  });
  for (let i = 0; i < 14; i++) {
    const m = beveledBox(0.047, 0.24, 0.34, batModMat, 0.01);
    m.position.set(BAT.x - 0.39 + i * 0.06, BAT.y, BAT.z);
    pt.add(m);
  }
  // orange high-voltage cables (also the paths the packets ride)
  const cBat = [
    [0.18, 0.46, 1.38],
    [0.24, 0.2, 0.85],
    [0.27, 0.19, -0.3],
    [0.3, 0.25, -0.92],
    [0.33, 0.62, -1.02],
    [0.3, 0.88, -1.1],
  ];
  const cMg1 = [
    [0.1, 0.89, -1.3],
    [0.12, 0.8, -1.5],
    [0.15, 0.67, -1.62],
  ];
  const cMg2 = [
    [0.3, 0.88, -1.3],
    [0.31, 0.84, -1.35],
    [0.27, 0.78, -1.4],
    [0.2, 0.75, -1.4],
  ];
  const cableBat = tubeAlong(cBat, 0.016, cableMat, { tubularSegments: 60, radialSegments: 10 });
  const cableMg1 = tubeAlong(cMg1, 0.013, cableMat, { tubularSegments: 24, radialSegments: 8 });
  const cableMg2 = tubeAlong(cMg2, 0.013, cableMat, { tubularSegments: 24, radialSegments: 8 });
  pt.add(cableBat, cableMg1, cableMg2);
  // translucent shells must stay out of the AO pass (they'd become solid walls)
  for (const sh of [block, head, cover, pan, mg1Housing, mg2Housing, batCase]) noAO(sh);

  // ============================================== power packets (flow) ======
  const V3 = (p) => new THREE.Vector3(...p);
  const curveOf = (pts) => new THREE.CatmullRomCurve3(pts.map(V3));
  const FLOW = {
    eng: { curve: curveOf([[-0.3, AY, AZ], [-0.06, AY, AZ]]), color: AMBER }, // + = engine -> gearset
    sun: { curve: curveOf([[0.025, AY, AZ], [0.2, AY, AZ]]), color: BLUE }, // + = sun -> MG1
    wl: { curve: curveOf([[-0.1, DIFF_Y + 0.04, DIFF_Z], [-0.72, DIFF_Y + 0.04, DIFF_Z]]), color: GREEN },
    wr: { curve: curveOf([[0.1, DIFF_Y + 0.04, DIFF_Z], [0.72, DIFF_Y + 0.04, DIFF_Z]]), color: GREEN },
    bat: { curve: curveOf(cBat), color: ELEC }, // + = battery -> inverter
    mg1: { curve: curveOf(cMg1.slice().reverse()), color: ELEC }, // + = MG1 -> inverter
    mg2: { curve: curveOf(cMg2), color: ELEC }, // + = inverter -> MG2
  };
  const pktGeo = new THREE.SphereGeometry(0.011, 10, 8);
  const PK = 7;
  for (const f of Object.values(FLOW)) {
    f.mat = glowMat(f.color, 1, false);
    f.mesh = [];
    for (let k = 0; k < PK; k++) {
      const m = new THREE.Mesh(pktGeo, f.mat);
      m.visible = false;
      noAO(m);
      pt.add(m);
      f.mesh.push(m);
    }
  }
  // cumulative phase tables so direction reversals are smooth and the lap closes
  const RATE = 3.0; // packet-path cycles per lap at full flow
  const flowKey = { eng: 'fEng', sun: 'fSun', wl: 'fWheel', wr: 'fWheel', bat: 'fBat', mg1: 'fMg1', mg2: 'fMg2' };
  const flowScale = { eng: 1, sun: 1, wl: 0.5, wr: 0.5, bat: 1, mg1: 1, mg2: 1 };
  for (const sim of Object.values(SIMS)) {
    sim.phase = {};
    for (const key of Object.keys(FLOW)) {
      const arr = sim[flowKey[key]];
      const ph = new Float64Array(NS + 1);
      const g = (f) => {
        const x = f * flowScale[key];
        return Math.sign(x) * Math.min(1, Math.abs(x) / 1.1) ** 0.75 * RATE;
      };
      for (let i = 0; i < NS; i++) ph[i + 1] = ph[i] + ((g(arr[i]) + g(arr[i + 1])) / 2) / NS;
      const drift = ph[NS] - Math.round(ph[NS]);
      for (let i = 0; i <= NS; i++) ph[i] -= drift * (i / NS);
      sim.phase[key] = ph;
    }
  }

  // --- HUD ---------------------------------------------------------------------------------------
  const hud = makeHud();
  group.add(hud.sprite);
  // screen-fixed: re-placed in front of whatever camera renders it, top-right
  // on landscape, top-centre on portrait, so no per-step camera maths
  const _f = new THREE.Vector3();
  const _r = new THREE.Vector3();
  const _u = new THREE.Vector3();
  hud.sprite.onBeforeRender = (renderer, sc, cam) => {
    if (sc.overrideMaterial) return;
    const d = 3;
    const vh = 2 * d * Math.tan((cam.fov * Math.PI) / 360);
    const vw = vh * cam.aspect;
    const wide = cam.aspect > 1.2;
    const w = wide ? 0.31 * vw : 0.86 * vw;
    hud.sprite.scale.set(w, (w * 440) / 640, 1);
    cam.getWorldDirection(_f);
    _r.setFromMatrixColumn(cam.matrixWorld, 0);
    _u.setFromMatrixColumn(cam.matrixWorld, 1);
    const cx = wide ? 0.64 : 0;
    const cy = wide ? 0.5 * vh - 0.5 * ((w * 440) / 640) - 0.03 * vh : 0.5 * vh - 0.5 * ((w * 440) / 640) - 0.08 * vh;
    hud.sprite.position.copy(cam.position).addScaledVector(_f, d).addScaledVector(_r, cx * vw * 0.5).addScaledVector(_u, cy);
    hud.sprite.updateMatrixWorld();
  };

  // --- sensors / extras that live on the shell ----------------------------------------------------
  // (nothing: this car has no radar. The powertrain group is hidden when sealed.)

  // --- labels -----------------------------------------------------------------------------------------
  const anchor = (x, y, z) => {
    const a = new THREE.Object3D();
    a.position.set(x, y, z);
    ego.root.add(a);
    return a;
  };
  const aEngine = anchor(-0.4, 0.88, AZ + 0.02);
  const aMg1 = anchor(0.17, AY + 0.12, AZ + 0.02);
  const aMg2 = anchor(0.17, MG2_Y + 0.1, MG2_Z);
  const aPsd = anchor(0, AY + 0.17, AZ - 0.05);
  const aInv = anchor(0.3, INV.y + 0.07, INV.z);
  const aBat = anchor(0.3, BAT.y + 0.15, BAT.z);
  const aSun = anchor(0.0, AY + 0.045, AZ + 0.03);
  const aCar = anchor(0.056, AY, AZ - CARRIER_R);
  const aPlanet = anchor(0.0, AY + 0.12, AZ);
  const aRing = anchor(0.0, AY - 0.185, AZ - 0.12);
  const aDiff = anchor(0.0, DIFF_Y - 0.07, DIFF_Z + 0.02);
  labels.add('inside', aEngine, 'Petrol engine', [0, 0, 0], 25, 60);
  labels.add('inside', aMg1, 'Generator MG1', [0, 0, 0], 250, 60);
  labels.add('inside', aMg2, 'Traction motor MG2', [0, 0, 0], 100, 40);
  labels.add('inside', aPsd, 'Planetary gearset', [0, 0, 0], 310, 60);
  labels.add('inside', aInv, 'Inverter', [0, 0, 0], 30, 70);
  labels.add('inside', aBat, 'Battery', [0, 0, 0], 60, 50);
  labels.add('psd', aSun, 'Sun gear · 30 teeth → MG1', [0, 0, 0], 30, 70);
  labels.add('psd', aCar, 'Carrier ← engine', [0, 0, 0], 200, 60);
  labels.add('psd', aPlanet, 'Four planet gears', [0, 0, 0], 80, 60);
  labels.add('psd', aRing, 'Ring gear · 78 teeth → wheels', [0, 0, 0], -40, 80);
  labels.add('lever', aSun, 'Generator speed sets the ratio', [0, 0, 0], 30, 70);
  labels.add('ev', aEngine, 'Engine: stopped', [0, 0, 0], 300, 60);
  labels.add('ev', aMg1, 'MG1: spinning backwards', [0, 0, 0], 250, 60);
  labels.add('ev', aMg2, 'MG2 pushes the ring', [0, 0, 0], 100, 45);
  labels.add('charge', aEngine, 'Engine running', [0, 0, 0], 300, 60);
  labels.add('charge', aMg1, 'MG1 generating', [0, 0, 0], 250, 60);
  labels.add('charge', aBat, 'Battery charging', [0, 0, 0], 60, 50);
  labels.add('boost', aEngine, 'Engine pushing', [0, 0, 0], 300, 60);
  labels.add('boost', aMg2, 'MG2 pushing too', [0, 0, 0], 100, 45);
  labels.add('boost', aBat, 'Battery', [0, 0, 0], 60, 50);
  labels.add('regen', aMg2, 'MG2 as generator', [0, 0, 0], 100, 45);
  labels.add('regen', aBat, 'Battery', [0, 0, 0], 60, 50);
  labels.add('regen', aDiff, 'Wheels drive MG2', [0, 0, 0], 330, 50);

  // --- pose -------------------------------------------------------------------------------------------------
  const state = { mode: 'cruise', hud: false, hudTitle: '', focus: 'none', reveal: 0 };
  const sample = (arr, x, i, f) => arr[i] + (arr[i + 1] - arr[i]) * f;
  const WHEELS = ego.spins;

  function apply(u) {
    const sim = SIMS[state.mode];
    const x = (u % 1) * NS;
    const i = Math.min(NS - 1, Math.floor(x));
    const f = x - i;
    const S = (a) => sample(a, x, i, f);
    roadTex.offset.y = frac(S(sim.s) / PERIOD);
    for (const sp of WHEELS) sp.rotation.x = -S(sim.wheel);

    const tr = S(sim.thR);
    const tc = S(sim.thC);
    const ts = ((S_T + R_T) * tc - R_T * tr) / S_T; // Willis: Ns ts + Nr tr = (Ns+Nr) tc
    carrierM.rotation.x = tc;
    sunM.rotation.x = ts;
    ringM.rotation.x = tr;
    crank.rotation.x = tc;
    for (let k = 0; k < N_PL; k++) {
      const pa = (k * TAU) / N_PL;
      planets[k].rotation.x = ((S_T + P_T) * (tc + pa) - S_T * ts + PHASE_K) / P_T - tc;
    }
    // external meshes: B = [(Na+Nb) a - Na ta + (Nb-1) PI] / Nb
    const tPin = ((N_OUT + N_PIN) * A_MG2 - N_OUT * tr + (N_PIN - 1) * Math.PI) / N_PIN;
    const tDiff = ((N_OUT + N_DIFF) * A_DIFF - N_OUT * tr + (N_DIFF - 1) * Math.PI) / N_DIFF;
    pinionM.rotation.x = tPin;
    diffM.rotation.x = tDiff;

    // pistons / rods / combustion
    const on = S(sim.e) > 0.5 && S(sim.wcT) > 0.5;
    for (let k = 0; k < 4; k++) {
      const phi = tc + PH[k];
      const py = AY + CR * Math.cos(phi);
      const pz = AZ + CR * Math.sin(phi);
      const yp = AY + CR * Math.cos(phi) + Math.sqrt(ROD_L * ROD_L - (CR * Math.sin(phi)) ** 2);
      pistons[k].position.y = yp;
      const dy = yp - py;
      const dz = AZ - pz;
      const rg = rods[k];
      rg.position.set(CYL_X[k], py, pz);
      // the rod is built along +Y from its base: aiming it at the piston pin
      // is a plain rotation about X
      rg.rotation.x = Math.atan2(dz, dy);
      let cyc = (tc - FIRE[k]) % (2 * TAU);
      if (cyc < 0) cyc += 2 * TAU;
      const span = 0.7 * Math.PI;
      const glow = on && cyc < span ? (1 - cyc / span) ** 1.6 : 0;
      glows[k].material.opacity = 0.85 * glow;
      glows[k].visible = glow > 0.01;
    }

    // power flows
    const bat = S(sim.fBat);
    for (const [key, fl] of Object.entries(FLOW)) {
      const val = S(sim[flowKey[key]]) * flowScale[key];
      const mag = Math.abs(val);
      const vis = mag > 0.04 && state.reveal > 0.5 && state.focus !== 'psd';
      const phase = S(sim.phase[key]);
      fl.mat.opacity = clamp01(mag / 0.18);
      for (let k = 0; k < PK; k++) {
        const m = fl.mesh[k];
        m.visible = vis;
        if (!vis) continue;
        const t = frac(phase + k / PK);
        m.position.copy(fl.curve.getPointAt(clamp01(t)));
        const fade = Math.sin(Math.PI * t) ** 0.5;
        m.scale.setScalar(0.5 + 0.9 * fade);
      }
    }
    // battery pack glow: green charging, amber discharging
    batModMat.emissive.copy(bat < 0 ? CHG : DIS);
    batModMat.emissiveIntensity = clamp01(Math.abs(bat) / 0.9) * 0.9;
    // MG2 / MG1 rotors glow slightly when working
    // HUD
    if (state.hud) {
      const wsT = 3.6 * S(sim.wcT) - 2.6 * S(sim.wrT);
      hud.draw({
        title: state.hudTitle,
        ws: wsT,
        wc: S(sim.wcT),
        wr: S(sim.wrT),
        bat,
      });
    }
  }

  // --- layers ------------------------------------------------------------------------------------------------
  // 0 sealed · 1 body ghosted · 2 X-ray (body + cabin gone)
  function setReveal(t) {
    const r = t > 0.5;
    const xray = t > 1.5;
    state.reveal = t;
    const p = ego.paint;
    p.transparent = r;
    p.opacity = r ? 0.09 : 1;
    p.depthWrite = !r;
    p.clearcoat = r ? 0 : 0.5;
    p.needsUpdate = true;
    ego.glass.opacity = r ? 0.05 : ego.glass.userData.baseOpacity;
    ego.cabin.opacity = r ? 0.1 : 1;
    ego.cabin.depthWrite = !r;
    ego.cabin.transparent = r;
    ego.cabin.needsUpdate = true;
    for (const m of ego.shellExtras) m.visible = !r;
    ego.body.visible = ego.green.visible = !xray;
    for (const m of ego.paintExtras) m.visible = !xray;
    for (const m of ego.cabinMeshes) m.visible = !xray;
    pt.visible = r;
  }
  // 'none' · 'psd': ghost the housings so the gearset and rotors read
  function setFocus(mode) {
    state.focus = mode;
    for (const d of dressPsd) d.visible = mode !== 'psd';
    for (const m of shells) {
      const base = m.userData.base;
      m.opacity = mode === 'psd' ? Math.min(base, 0.1) : base;
      m.depthWrite = m.opacity > 0.5;
      m.needsUpdate = true;
    }
  }
  function setMode(name) {
    state.mode = SIMS[name] ? name : 'cruise';
    state.hudTitle = MODES[state.mode].name;
  }
  function setOverlay(on, pos) {
    state.hud = !!on;
    hud.sprite.visible = !!on;
    if (pos) hud.sprite.position.set(...pos);
  }
  function setLap(u) {
    apply(u);
  }

  setReveal(0);
  setFocus('none');
  setOverlay(false);
  setMode('cruise');
  apply(0);
  labels.setLabels(false);

  return {
    group,
    setLap,
    setMode,
    setReveal,
    setFocus,
    setOverlay,
    setLabels: labels.setLabels,
    parts: { car: ego.root, engine, carrierM, sunM, ringM, pinionM, planets, pistons, sims: SIMS, apply },
  };
}
