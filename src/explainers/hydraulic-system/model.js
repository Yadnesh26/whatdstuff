import * as THREE from 'three';
import { materials, studioPlinth, flowField } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, gear, coil, chainPath } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, profileTable, TAU } from '../../framework/motion.js';

// A small industrial hydraulic system on a display rig: a power pack (electric
// motor on a steel oil tank, gear pump, direct-acting relief valve with a
// gauge, a lever-operated open-centre spool valve, a return filter) feeding a
// double-acting cylinder through two hoses. The cylinder lifts a pinned steel
// boom carrying a one-tonne block — the layout of a log splitter or the boom
// of a small loader.
//
// SCALE: 1 unit = 0.5 m.
//   tank ≈ 650 × 300 × 420 mm (≈ 60 L) → 1.3 × 0.6 × 0.84
//   motor (≈4 kW, 4-pole: 12 L/min × 200 bar) Ø340 mm over the fins → MOTOR_R 0.17
//   gear pump: two 12-tooth gears, tip Ø55 mm, 11 mm face → GEAR_TIP 0.055,
//     GEAR_W 0.022 (2π·25·5·11 mm³ ≈ 8.6 cc/rev)
//   cylinder: 63 mm bore / 36 mm rod / 76 mm OD barrel → BORE_R 0.063,
//     ROD_R 0.036, BARREL_R 0.076; stroke ≈ 290 mm → ≈ 0.58
//   boom: pivot to load pin 1.11 m → 2.22; cylinder pin 0.6 m out; swings 0–32°
//   load: a tonne of lead, 500 × 420 × 420 mm → 1.0 × 0.84 × 0.84
//
// MECHANISM (researched — Power & Motion "Relief and unloading pressure
// controls", LibreTexts "Operation of a Hydraulic Power Unit", gear-pump
// references): a fixed-displacement gear pump makes FLOW — oil is carried in
// the tooth gaps around the OUTSIDE of both gears and expelled where the teeth
// re-mesh. Pressure is whatever the load resists with. The spool valve is an
// open-centre, parallel monoblock type (tandem centre: P→T open, A and B
// blocked in neutral), so the centred pump unloads at a few bar while the
// cylinder stays locked. A direct-acting poppet relief valve caps the system
// at 200 bar.
//   Cap area π·31.5² = 31.2 cm², annulus 31.2 − 10.2 = 21.0 cm².
//   70 bar × 31.2 cm² = 21.8 kN — what this boom + 1 t block needs at mid
//   stroke (load arm 1.11 m / cylinder arm ≈ 0.55 m ≈ 2.0, plus the boom).
//   200 bar × 31.2 cm² = 62 kN ≈ 6.3 t. Lowering is 31.2/21.0 ≈ 1.5× faster.
//
// SPOOL GEOMETRY (valve-local x, metres/0.5). Galleries T|A|P|C|C|P|B|T:
//   T ±[0.182,0.204]  A/B ±[0.140,0.162]  P ±[0.058,0.120]  C ±[0.011,0.033]
// Spool lands (neutral): ±[0.226,0.276] guide · ±[0.130,0.172] A/B lands ·
//   ±[0.022,0.075] core lands. Grooves between them. Shift ±0.03:
//   neutral  C_in→core groove→C_out (pump unloads), A and B covered.
//   left     core shut, P_L→A (lift), B→T_R.   right  core shut, P_R→B, A→T_L.
//
// DISCLOSED SIMPLIFICATIONS: pump gears slowed ~40×; relief-poppet lift drawn
// ~10× real; the section cut faces are drawn flat; the boom's own weight is
// folded into the quoted 70 bar.
//
// SCALARS / HANDLES:
//   setCycle(u)  — THE lap: centred → lift → stall on relief → centre/hold →
//                  lower → centre. Everything derives from it.
//   setWork(u)   — lift, hold, lower with no stall (the cylinder step).
//   setIdle(u)   — lever centred, boom held mid-air, pump unloading.
//   setRelief(u) — top of stroke: lift the last bit, stall, relief dumps,
//                  lower a little, repeat.
//   setReveal(t) — 0 sealed · 1 cutaway (tank front, pump cover, valve and
//                  cylinder sections, ghosted hoses, flow packets).
//   setLabels(mode) — 'exterior' | 'pump' | 'loop' | 'valve' | 'cylinder' |
//                  'relief' | false.

// --- layout ---------------------------------------------------------------------
const PLINTH_H = 0.26;
const TANK_X0 = -2.3;
const TANK_X1 = -1.0;
const TANK_Z = 0.42;
const TANK_Y0 = 0.31;
const TANK_Y1 = 0.91;
const LID_T = 0.03;
const LID = TANK_Y1 + LID_T; // 0.94
const WALL = 0.02;
const OIL_Y = 0.78;

const MX = -2.0; // motor/pump axis x (axis runs along z)
const MOTOR_Y = 1.16;
const MOTOR_R = 0.17;
const MOTOR_Z0 = -0.36;
const MOTOR_Z1 = 0.06;
const PUMP_Z0 = 0.16;
const PUMP_Z1 = 0.3;
const PUMP_HX = 0.09;
const PUMP_HY = 0.12;
const CAV_Z0 = 0.24; // gears ride at the front of a thick body
const CAV_Z1 = 0.28;
const GEAR_TIP = 0.055;
const TEETH = 12;
const GEAR_W = 0.022;
const CAV_R = GEAR_TIP + 0.002;
const PORT_H = 0.022; // pump port slot half-height
const PORT_X = 0.075;

const RV = new THREE.Vector3(-1.81, 1.11, 0.21); // relief block centre
const RV_HX = 0.075;
const RV_HY = 0.15;
const CART_X = -0.035; // relief cartridge axis (relief-local x)
const SEAT_Y = 0.078;

const DCV = new THREE.Vector3(-1.37, 1.09, 0.22); // spool valve centre
const DCV_HX = 0.28;
const DCV_HY = 0.1;
const SHIFT = 0.03;
const BORE_SP = 0.018;
const LEVER_PIVOT = new THREE.Vector2(0.35, 0.09);
const LEVER_ARM = 0.09; // pivot → clevis pin

const P0 = new THREE.Vector3(-0.35, 1.45, 0); // boom pivot
const C0 = new THREE.Vector3(0.25, 0.36, 0); // cylinder base pin
const PIN_R = 1.2; // boom-local cylinder pin
const PIN_OFF = -0.14;
const TIP_X = 2.22;
const TH0 = 0;
const TH1 = (32 * Math.PI) / 180;
const BARREL_R = 0.076;
const BORE_R = 0.063;
const ROD_R = 0.036;
const CAP_IN = 0.09;
const GLAND_IN = 0.73;
const PISTON_W = 0.05;

const PUMP_TURNS = 6; // whole pump turns per lap
const HOSE_K = 3; // hose-lengths of packet travel per full stroke

// --- pressure colour ------------------------------------------------------------
// 0 = tank / suction, 0.35 = 70 bar working, 1 = 200 bar relief
const C_LOW = new THREE.Color(0x8a5512);
const C_MID = new THREE.Color(0xffb02e);
const C_HIGH = new THREE.Color(0xff3418);
function pressureColor(p, out) {
  p = clamp01(p);
  if (p < 0.35) return out.copy(C_LOW).lerp(C_MID, p / 0.35);
  return out.copy(C_MID).lerp(C_HIGH, (p - 0.35) / 0.65);
}

// smooth keyframe track: [[u, v], …] sorted by u
function keys(u, k) {
  if (u <= k[0][0]) return k[0][1];
  for (let i = 1; i < k.length; i++) {
    if (u <= k[i][0]) {
      const [u0, v0] = k[i - 1];
      const [u1, v1] = k[i];
      return v0 + (v1 - v0) * (u1 > u0 ? smooth((u - u0) / (u1 - u0)) : 1);
    }
  }
  return k[k.length - 1][1];
}

// --- lap programs -----------------------------------------------------------------
// spool: −1 = lift (P→A), +1 = lower (P→B). ext: cylinder stroke 0..1.
// p: pump-side pressure (gauge), pA: lift side, pB: rod side, rel: relief open.
// vL: mean lift speed (stroke per lap-unit) — sets the return-flow scale.
const PROGRAMS = {
  cycle: {
    vL: 1 / 0.36,
    spool: [[0, 0], [0.06, 0], [0.1, -1], [0.58, -1], [0.62, 0], [0.68, 0], [0.72, 1], [0.96, 1], [1, 0]],
    ext: [[0, 0], [0.1, 0], [0.46, 1], [0.72, 1], [0.96, 0], [1, 0]],
    p: [[0, 0.03], [0.065, 0.03], [0.1, 0.37], [0.2, 0.35], [0.465, 0.35], [0.5, 1], [0.58, 1], [0.61, 0.03], [0.69, 0.03], [0.72, 0.08], [0.96, 0.08], [1, 0.03]],
    pA: [[0, 0.35], [0.465, 0.35], [0.5, 1], [0.58, 1], [0.61, 0.35], [0.7, 0.35], [0.72, 0.4], [0.96, 0.4], [0.99, 0.35], [1, 0.35]],
    pB: [[0, 0.04], [0.69, 0.04], [0.72, 0.08], [0.96, 0.08], [1, 0.04]],
    rel: [[0, 0], [0.485, 0], [0.505, 1], [0.58, 1], [0.6, 0], [1, 0]],
  },
  // the cylinder step: lift, centre the lever just short of the stop, hold,
  // lower. Never stalls on the relief (that's the next step's story).
  work: {
    vL: 0.92 / 0.36,
    spool: [[0, 0], [0.06, 0], [0.1, -1], [0.44, -1], [0.48, 0], [0.6, 0], [0.64, 1], [0.88, 1], [0.92, 0], [1, 0]],
    ext: [[0, 0], [0.1, 0], [0.46, 0.92], [0.64, 0.92], [0.88, 0], [1, 0]],
    p: [[0, 0.03], [0.065, 0.03], [0.1, 0.37], [0.2, 0.35], [0.44, 0.35], [0.48, 0.03], [0.61, 0.03], [0.64, 0.08], [0.88, 0.08], [0.92, 0.03], [1, 0.03]],
    pA: [[0, 0.35], [0.62, 0.35], [0.64, 0.4], [0.88, 0.4], [0.91, 0.35], [1, 0.35]],
    pB: [[0, 0.04], [0.61, 0.04], [0.64, 0.08], [0.88, 0.08], [0.92, 0.04], [1, 0.04]],
    rel: [[0, 0], [1, 0]],
  },
  idle: {
    vL: 1 / 0.36,
    spool: [[0, 0], [1, 0]],
    ext: [[0, 0.55], [1, 0.55]],
    p: [[0, 0.03], [1, 0.03]],
    pA: [[0, 0.35], [1, 0.35]],
    pB: [[0, 0.04], [1, 0.04]],
    rel: [[0, 0], [1, 0]],
  },
  relief: {
    vL: 0.35 / 0.1,
    spool: [[0, 0], [0.04, -1], [0.8, -1], [0.83, 0], [0.84, 0], [0.86, 1], [0.93, 1], [0.95, 0], [1, 0]],
    ext: [[0, 0.65], [0.04, 0.65], [0.14, 1], [0.86, 1], [0.93, 0.65], [1, 0.65]],
    p: [[0, 0.03], [0.005, 0.03], [0.04, 0.37], [0.1, 0.35], [0.14, 0.35], [0.17, 1], [0.8, 1], [0.83, 0.03], [0.845, 0.03], [0.86, 0.08], [0.93, 0.08], [0.95, 0.03], [1, 0.03]],
    pA: [[0, 0.35], [0.14, 0.35], [0.17, 1], [0.8, 1], [0.83, 0.35], [0.85, 0.35], [0.86, 0.4], [0.93, 0.4], [0.95, 0.35], [1, 0.35]],
    pB: [[0, 0.04], [0.845, 0.04], [0.86, 0.08], [0.93, 0.08], [0.95, 0.04], [1, 0.04]],
    rel: [[0, 0], [0.16, 0], [0.18, 1], [0.8, 1], [0.82, 0], [1, 0]],
  },
};

function compile(prog) {
  const wrap = (u) => ((u % 1) + 1) % 1;
  const f = (k) => (u) => keys(wrap(u), prog[k]);
  const P = {
    spool: f('spool'),
    ext: f('ext'),
    p: f('p'),
    pA: f('pA'),
    pB: f('pB'),
    rel: f('rel'),
  };
  const dExt = (u) => (keys(Math.min(1, u + 1e-3), prog.ext) - keys(Math.max(0, u - 1e-3), prog.ext)) / 2e-3;
  // return line: open-centre core flow + whatever the cylinder pushes out
  // (lifting: rod side 21/31 of pump flow; lowering: cap side ×1.5)
  const ret = (u) => {
    const core = (1 - Math.abs(P.spool(u))) * (1 - P.rel(u));
    const v = dExt(u) / prog.vL;
    return 0.02 + core + (v > 0 ? 0.67 * v : -v);
  };
  const integ = (fn) => {
    let a = 0;
    for (let i = 0; i < 400; i++) a += fn((i + 0.5) / 400) / 400;
    return a;
  };
  const lapsOf = (fn) => Math.max(1, Math.round(integ(fn) * 4));
  P.retT = profileTable(ret, lapsOf(ret));
  const pressRate = (u) => 0.02 + (1 - P.rel(u));
  P.pressT = profileTable(pressRate, lapsOf(pressRate));
  const dumpRate = (u) => P.rel(u);
  P.dumpT = integ(dumpRate) > 0.01 ? profileTable((u) => 0.001 + dumpRate(u), lapsOf(dumpRate)) : null;
  // flow paths through the valve section (rates in pump-flow units)
  const vn = (u) => dExt(u) / prog.vL;
  P.rates = {
    core: (u) => (1 - Math.abs(P.spool(u))) * (1 - P.rel(u)),
    aIn: (u) => Math.max(0, vn(u)),
    bRet: (u) => 0.67 * Math.max(0, vn(u)),
    bIn: (u) => Math.max(0, -vn(u)) / 1.5,
    aRet: (u) => Math.max(0, -vn(u)),
  };
  P.tables = {};
  for (const [k, fn] of Object.entries(P.rates)) {
    P.tables[k] = integ(fn) > 0.01 ? profileTable((u) => 0.001 + fn(u), lapsOf(fn)) : null;
  }
  return P;
}

const _Y = new THREE.Vector3(0, 1, 0);

export function buildHydraulicSystem({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // ============================================================================
  //  MATERIALS
  // ============================================================================
  const paint = (hex, coat = 0.35) => {
    const m = materials.paintedMetal(hex);
    m.clearcoat = coat;
    m.clearcoatRoughness = 0.32;
    m.roughness = 0.5;
    return m;
  };
  const tankPaint = paint(0x4d5864);
  const motorPaint = paint(0x2b5d93);
  const boomPaint = paint(0xd2a024, 0.3);
  const cylPaint = paint(0x1d2025, 0.3);
  const filterPaint = paint(0x2b5d93);
  const valveCast = materials.darkMetal(0x33373d); // map-free: extrude/box UVs
  valveCast.roughness = 0.55;
  const castAl = materials.steel(0x7c838b); // pump body: darker than the gears so they read
  castAl.roughness = 0.6;
  const pumpCut = new THREE.MeshStandardMaterial({ color: 0xc8ccd1, metalness: 0.3, roughness: 0.62 });
  const bellAl = materials.aluminum(0xb6bcc4);
  bellAl.roughness = 0.62;
  const steel = materials.steel(0xb0b7c0);
  steel.roughness = 0.42;
  const darkSteel = materials.darkMetal(0x3a3f46);
  darkSteel.roughness = 0.5;
  const frameSteel = materials.darkMetal(0x2c3036);
  frameSteel.roughness = 0.6;
  // dark steel gears against a light machined case face, so the tooth
  // profiles read as silhouettes (and against the amber oil pockets)
  const gearSteel = new THREE.MeshStandardMaterial({ color: 0x59626d, metalness: 0.85, roughness: 0.42 });
  const spoolSteel = materials.steel(0xd2d7dc);
  spoolSteel.roughness = 0.3;
  const chromeRod = materials.chrome(0xdfe3e8);
  chromeRod.roughness = 0.22;
  const brass = new THREE.MeshStandardMaterial({ color: 0xc9a45a, metalness: 1, roughness: 0.38 });
  const blackPoly = materials.polymer(0x16171a);
  const hoseRubber = materials.rubber(0x15161a);
  hoseRubber.transparent = true;
  const liner = new THREE.MeshStandardMaterial({ color: 0x2b3036, roughness: 0.92 });
  const linerBack = new THREE.MeshStandardMaterial({ color: 0x25292e, roughness: 0.92, side: THREE.BackSide });
  const cutFace = new THREE.MeshStandardMaterial({ color: 0xbfc5cc, metalness: 0.45, roughness: 0.5 });
  const holeMat = new THREE.MeshStandardMaterial({ color: 0x0d0e10, roughness: 0.9 });
  const tankOil = new THREE.MeshStandardMaterial({
    color: 0xb07418,
    emissive: 0x3a2204,
    roughness: 0.25,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
  });
  // pressure-coloured oil; depthWrite:false so a faded one never punches holes
  const oilMat = (opacity = 1) =>
    new THREE.MeshStandardMaterial({
      color: C_LOW.clone(),
      emissive: C_LOW.clone(),
      emissiveIntensity: 0.6,
      roughness: 0.4,
      transparent: opacity < 1,
      opacity,
      depthWrite: opacity >= 1,
    });
  const _c = new THREE.Color();
  function paintOil(mat, p) {
    pressureColor(p, _c);
    mat.color.copy(_c);
    mat.emissive.copy(_c);
    mat.emissiveIntensity = 0.35 + 0.85 * clamp01(p);
  }

  // helpers ---------------------------------------------------------------------
  const v3 = (x, y, z) => new THREE.Vector3(x, y, z);
  function zCyl(r, z0, z1, mat, seg = 40) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, z1 - z0, seg), mat);
    m.rotation.x = Math.PI / 2;
    m.position.z = (z0 + z1) / 2;
    m.castShadow = true;
    return m;
  }
  function yCyl(r, y0, y1, mat, seg = 32) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, y1 - y0, seg), mat);
    m.position.y = (y0 + y1) / 2;
    m.castShadow = true;
    return m;
  }
  // cylinder along +x; `half` keeps only the back (−z) half as an open shell
  function xCyl(r, x0, x1, mat, { seg = 40, half = false } = {}) {
    const geo = half
      ? new THREE.CylinderGeometry(r, r, x1 - x0, seg, 1, true, Math.PI / 2, Math.PI)
      : new THREE.CylinderGeometry(r, r, x1 - x0, seg);
    const m = new THREE.Mesh(geo, mat);
    m.rotation.z = -Math.PI / 2;
    m.position.x = (x0 + x1) / 2;
    m.castShadow = true;
    return m;
  }
  function rect(x0, x1, y0, y1, mat, z = 0.001) {
    const m = new THREE.Mesh(new THREE.PlaneGeometry(x1 - x0, y1 - y0), mat);
    m.position.set((x0 + x1) / 2, (y0 + y1) / 2, z);
    return m;
  }
  function hexNut(r, h, mat) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, 6), mat);
    m.castShadow = true;
    return m;
  }

  const sealed = []; // visible only when sealed
  const cutaway = []; // visible only when revealed

  // ============================================================================
  //  PLINTH + RIG FRAME
  // ============================================================================
  const plinth = studioPlinth({ w: 5.1, h: PLINTH_H, d: 1.8 });
  plinth.position.x = -0.12;
  group.add(plinth);

  // ============================================================================
  //  OIL TANK
  // ============================================================================
  const TW = TANK_X1 - TANK_X0;
  const TH = TANK_Y1 - TANK_Y0;
  const TD = TANK_Z * 2;
  const TCX = (TANK_X0 + TANK_X1) / 2;
  const TCY = (TANK_Y0 + TANK_Y1) / 2;
  const tank = new THREE.Group();
  group.add(tank);
  const wall = (w, h, d, x, y, z) => {
    const m = beveledBox(w, h, d, tankPaint, 0.008);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    tank.add(m);
    return m;
  };
  wall(TW, TH, WALL, TCX, TCY, -TANK_Z + WALL / 2);
  const wFront = wall(TW, TH, WALL, TCX, TCY, TANK_Z - WALL / 2);
  wall(WALL, TH, TD, TANK_X0 + WALL / 2, TCY, 0);
  wall(WALL, TH, TD, TANK_X1 - WALL / 2, TCY, 0);
  wall(TW, WALL, TD, TCX, TANK_Y0 + WALL / 2, 0);
  sealed.push(wFront);
  // matte primer liners on the inside faces (seen only in the cutaway)
  const lin = (w, h, d, x, y, z) => {
    const m = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), liner);
    m.position.set(x, y, z);
    m.receiveShadow = true;
    tank.add(m);
  };
  lin(TW - 2 * WALL, TH - WALL, 0.002, TCX, TCY + WALL / 2, -TANK_Z + WALL + 0.001);
  lin(0.002, TH - WALL, TD - 2 * WALL, TANK_X0 + WALL + 0.001, TCY + WALL / 2, 0);
  lin(0.002, TH - WALL, TD - 2 * WALL, TANK_X1 - WALL - 0.001, TCY + WALL / 2, 0);
  lin(TW - 2 * WALL, 0.002, TD - 2 * WALL, TCX, TANK_Y0 + WALL + 0.001, 0);
  lin(TW - 2 * WALL, 0.002, TD - 2 * WALL, TCX, TANK_Y1 - 0.001, 0);
  // skids
  for (const z of [-0.3, 0.3]) {
    const s = beveledBox(TW + 0.06, 0.05, 0.08, frameSteel, 0.01);
    s.position.set(TCX, PLINTH_H + 0.025, z);
    tank.add(s);
  }
  // lid + bolts
  const lidPlate = beveledBox(TW + 0.04, LID_T, TD + 0.04, tankPaint, 0.008);
  lidPlate.position.set(TCX, TANK_Y1 + LID_T / 2, 0);
  tank.add(lidPlate);
  {
    const boltGeo = new THREE.CylinderGeometry(0.011, 0.011, 0.012, 6);
    const pts = [];
    for (let i = 0; i < 9; i++) {
      const x = TANK_X0 + 0.02 + (i / 8) * (TW - 0.04);
      pts.push([x, -TANK_Z - 0.0], [x, TANK_Z]);
    }
    for (let i = 1; i < 5; i++) {
      const z = -TANK_Z + (i / 5) * TD;
      pts.push([TANK_X0 - 0.0, z], [TANK_X1, z]);
    }
    const inst = new THREE.InstancedMesh(boltGeo, steel, pts.length);
    const m4 = new THREE.Matrix4();
    pts.forEach(([x, z], i) => {
      m4.makeTranslation(x, LID + 0.006, z);
      inst.setMatrixAt(i, m4);
    });
    inst.castShadow = true;
    tank.add(inst);
  }
  // front-wall dress: level/temperature gauge, nameplate, drain plug
  const frontDress = new THREE.Group();
  tank.add(frontDress);
  sealed.push(frontDress);
  {
    const fz = TANK_Z + 0.004;
    const frame = beveledBox(0.07, 0.36, 0.02, darkSteel, 0.008);
    frame.position.set(-1.22, 0.62, fz + 0.006);
    frontDress.add(frame);
    const glass = new THREE.Mesh(new THREE.PlaneGeometry(0.036, 0.3), holeMat);
    glass.position.set(-1.22, 0.62, fz + 0.0165);
    frontDress.add(glass);
    const level = new THREE.Mesh(
      new THREE.PlaneGeometry(0.03, OIL_Y - 0.47),
      new THREE.MeshStandardMaterial({ color: 0xffa52a, emissive: 0xb86a10, emissiveIntensity: 0.6, roughness: 0.3 }),
    );
    level.position.set(-1.22, (0.47 + OIL_Y) / 2, fz + 0.017);
    frontDress.add(level);
    for (const y of [0.45, 0.79]) {
      const b = hexNut(0.016, 0.02, steel);
      b.rotation.x = Math.PI / 2;
      b.position.set(-1.22, y, fz + 0.02);
      frontDress.add(b);
    }
    const plate = beveledBox(0.26, 0.13, 0.006, materials.steel(0xc9ced4), 0.003);
    plate.material.roughness = 0.5;
    plate.position.set(-1.95, 0.7, fz + 0.003);
    frontDress.add(plate);
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.22, 0.02), new THREE.MeshStandardMaterial({ color: 0x2b5d93, roughness: 0.5 }));
    stripe.position.set(-1.95, 0.74, fz + 0.0065);
    frontDress.add(stripe);
    const drain = hexNut(0.022, 0.03, steel);
    drain.rotation.x = Math.PI / 2;
    drain.position.set(-1.6, 0.37, fz + 0.015);
    frontDress.add(drain);
  }
  // clean-out cover on the right wall
  {
    const cover = beveledBox(0.014, 0.3, 0.46, tankPaint, 0.01);
    cover.position.set(TANK_X1 + 0.007, 0.6, 0);
    tank.add(cover);
    for (let i = 0; i < 10; i++) {
      const a = (i / 10) * TAU;
      const b = hexNut(0.011, 0.012, steel);
      b.rotation.z = Math.PI / 2;
      b.position.set(TANK_X1 + 0.019, 0.6 + Math.sin(a) * 0.12, Math.cos(a) * 0.2);
      tank.add(b);
    }
  }
  // tank interior: oil, baffle
  const oilVol = new THREE.Mesh(
    new THREE.BoxGeometry(TW - 2 * WALL - 0.006, OIL_Y - TANK_Y0 - WALL, TD - 2 * WALL - 0.006),
    tankOil,
  );
  oilVol.position.set(TCX, (TANK_Y0 + WALL + OIL_Y) / 2, 0);
  oilVol.renderOrder = 2;
  tank.add(oilVol);
  cutaway.push(oilVol);
  const baffle = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.42, 0.58), liner);
  baffle.position.set(-1.98, TANK_Y0 + WALL + 0.21, -0.11);
  tank.add(baffle);

  // ============================================================================
  //  MOTOR + BELL HOUSING
  // ============================================================================
  const motor = new THREE.Group();
  motor.position.set(MX, MOTOR_Y, 0);
  group.add(motor);
  motor.add(zCyl(MOTOR_R - 0.012, MOTOR_Z0, MOTOR_Z1, motorPaint, 64));
  {
    const L = MOTOR_Z1 - MOTOR_Z0 - 0.05;
    const ribGeo = new THREE.BoxGeometry(0.03, 0.009, L);
    const ribs = [];
    for (let i = 0; i < 28; i++) {
      const a = (i / 28) * TAU;
      if (Math.sin(a) < -0.8) continue; // clear the feet
      if (Math.sin(a) > 0.93) continue; // clear the terminal box
      ribs.push(a);
    }
    const inst = new THREE.InstancedMesh(ribGeo, motorPaint, ribs.length);
    const m4 = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const zAx = v3(0, 0, 1);
    ribs.forEach((a, i) => {
      q.setFromAxisAngle(zAx, a);
      m4.compose(v3(Math.cos(a) * (MOTOR_R - 0.003), Math.sin(a) * (MOTOR_R - 0.003), (MOTOR_Z0 + MOTOR_Z1) / 2), q, v3(1, 1, 1));
      inst.setMatrixAt(i, m4);
    });
    inst.castShadow = true;
    motor.add(inst);
  }
  motor.add(zCyl(MOTOR_R + 0.004, MOTOR_Z1 - 0.025, MOTOR_Z1, motorPaint, 64)); // D-end shield
  motor.add(zCyl(MOTOR_R + 0.004, MOTOR_Z0, MOTOR_Z0 + 0.025, motorPaint, 64)); // N-end shield
  // fan cowl + grille
  motor.add(zCyl(MOTOR_R + 0.006, -0.44, MOTOR_Z0, motorPaint, 64));
  {
    const grille = new THREE.Mesh(new THREE.CircleGeometry(MOTOR_R - 0.004, 48), holeMat);
    grille.position.z = -0.4405;
    grille.rotation.y = Math.PI;
    motor.add(grille);
    for (let i = 1; i <= 4; i++) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry((i / 4.4) * MOTOR_R, 0.004, 6, 48), darkSteel);
      ring.position.z = -0.442;
      motor.add(ring);
    }
  }
  // terminal box, cable gland, feet, lifting eye
  {
    const tb = beveledBox(0.13, 0.075, 0.15, motorPaint, 0.012);
    tb.position.set(0, MOTOR_R + 0.03, -0.14);
    motor.add(tb);
    const tbLid = beveledBox(0.135, 0.012, 0.155, motorPaint, 0.005);
    tbLid.position.set(0, MOTOR_R + 0.072, -0.14);
    motor.add(tbLid);
    const gland = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.04, 16), blackPoly);
    gland.rotation.z = Math.PI / 2;
    gland.position.set(0.085, MOTOR_R + 0.03, -0.14);
    motor.add(gland);
    for (const z of [-0.27, -0.01]) {
      const foot = beveledBox(0.34, 0.07, 0.075, motorPaint, 0.01);
      foot.position.set(0, -(MOTOR_Y - LID) + 0.035, z);
      motor.add(foot);
    }
  }
  // bell housing (motor flange → pump flange), lathe along z
  {
    const bell = lathe(
      [
        [0.158, 0],
        [0.158, 0.018],
        [0.14, 0.024],
        [0.088, 0.08],
        [0.088, 0.09],
        [0.104, 0.092],
        [0.104, 0.1],
        [0.0, 0.1],
      ],
      bellAl,
      48,
    );
    bell.rotation.x = Math.PI / 2;
    bell.position.z = MOTOR_Z1;
    motor.add(bell);
  }

  // ============================================================================
  //  GEAR PUMP (gears in the XY plane, axis along z, face toward the camera)
  // ============================================================================
  const pump = new THREE.Group();
  pump.position.set(MX, MOTOR_Y, 0);
  group.add(pump);
  const gTop = gear({ teeth: TEETH, radius: GEAR_TIP, thickness: GEAR_W }, gearSteel);
  const GC = gTop.userData.pitchR; // centre offset: gears mesh on their pitch circles
  const depth = Math.min(0.18 * GEAR_TIP, ((TAU * GEAR_TIP) / TEETH) * 0.45);
  const ROOT_R = GEAR_TIP - depth;
  const STEP = TAU / TEETH;
  {
    const back = beveledBox(PUMP_HX * 2, PUMP_HY * 2, CAV_Z0 - PUMP_Z0, castAl, 0.008);
    back.position.z = (PUMP_Z0 + CAV_Z0) / 2;
    pump.add(back);
  }
  // figure-eight cavity with inlet/outlet slots
  function cavityPath(path) {
    const dy = PORT_H - GC;
    const xi = Math.sqrt(CAV_R * CAV_R - dy * dy);
    const a0 = Math.atan2(dy, xi);
    path.moveTo(PORT_X, PORT_H);
    path.lineTo(xi, PORT_H);
    path.absarc(0, GC, CAV_R, a0, Math.PI - a0, false);
    path.lineTo(-PORT_X, PORT_H);
    path.lineTo(-PORT_X, -PORT_H);
    path.lineTo(-xi, -PORT_H);
    path.absarc(0, -GC, CAV_R, Math.PI + a0, TAU - a0, false);
    path.lineTo(PORT_X, -PORT_H);
    path.closePath();
    return path;
  }
  {
    const outline = new THREE.Shape();
    const r = 0.012;
    const hx = PUMP_HX;
    const hy = PUMP_HY;
    outline.moveTo(-hx + r, -hy);
    outline.lineTo(hx - r, -hy);
    outline.quadraticCurveTo(hx, -hy, hx, -hy + r);
    outline.lineTo(hx, hy - r);
    outline.quadraticCurveTo(hx, hy, hx - r, hy);
    outline.lineTo(-hx + r, hy);
    outline.quadraticCurveTo(-hx, hy, -hx, hy - r);
    outline.lineTo(-hx, -hy + r);
    outline.quadraticCurveTo(-hx, -hy, -hx + r, -hy);
    outline.holes.push(cavityPath(new THREE.Path()));
    const body = new THREE.Mesh(
      new THREE.ExtrudeGeometry(outline, { depth: CAV_Z1 - CAV_Z0, bevelEnabled: false, curveSegments: 40 }),
      castAl,
    );
    body.position.z = CAV_Z0;
    body.castShadow = true;
    pump.add(body);
    // cavity oil: the figure-eight behind the gears + the two port slots
    const cavOilMat = oilMat(1);
    paintOil(cavOilMat, 0.12);
    const cavOil = new THREE.Mesh(new THREE.ShapeGeometry(cavityPath(new THREE.Shape()), 40), cavOilMat);
    cavOil.position.z = CAV_Z0 + 0.002;
    pump.add(cavOil);
    cutaway.push(cavOil);
  }
  const inletOilMat = oilMat(1);
  paintOil(inletOilMat, 0.05);
  const outletOilMat = oilMat(1);
  {
    const inl = rect(-PORT_X, -0.028, -PORT_H, PORT_H, inletOilMat, CAV_Z0 + 0.003);
    const outl = rect(0.028, PORT_X, -PORT_H, PORT_H, outletOilMat, CAV_Z0 + 0.003);
    pump.add(inl, outl);
    cutaway.push(inl, outl);
  }
  const gBot = gear({ teeth: TEETH, radius: GEAR_TIP, thickness: GEAR_W }, gearSteel);
  const GEAR_Z = (CAV_Z0 + CAV_Z1) / 2;
  gTop.position.set(0, GC, GEAR_Z);
  gBot.position.set(0, -GC, GEAR_Z);
  pump.add(gTop, gBot);
  for (const g of [gTop, gBot]) {
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, GEAR_W + 0.012, 24), darkSteel);
    hub.rotation.x = Math.PI / 2;
    g.add(hub);
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.009, GEAR_W + 0.016, 16), spoolSteel);
    shaft.rotation.x = Math.PI / 2;
    g.add(shaft);
    const key = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.01, GEAR_W + 0.017), darkSteel);
    key.position.y = 0.011;
    g.add(key);
  }
  // oil pockets riding in the tooth gaps
  const pocketMat = new THREE.MeshStandardMaterial({
    color: 0xffb02e,
    emissive: 0xffa020,
    emissiveIntensity: 0.9,
    roughness: 0.4,
  });
  const pockets = [];
  {
    const halfTip = STEP * 0.12;
    const halfRoot = STEP * 0.26;
    const shape = new THREE.Shape();
    const ar0 = halfRoot;
    const ar1 = STEP - halfRoot;
    const at0 = halfTip;
    const at1 = STEP - halfTip;
    const P = (r, a) => [Math.cos(a) * r, Math.sin(a) * r];
    shape.moveTo(...P(ROOT_R, ar0));
    for (let k = 1; k <= 6; k++) shape.lineTo(...P(ROOT_R, ar0 + ((ar1 - ar0) * k) / 6));
    shape.lineTo(...P(GEAR_TIP, at1));
    shape.lineTo(...P(CAV_R - 0.0015, at1));
    for (let k = 1; k <= 6; k++) shape.lineTo(...P(CAV_R - 0.0015, at1 - ((at1 - at0) * k) / 6));
    shape.lineTo(...P(GEAR_TIP, at0));
    shape.closePath();
    const pg = new THREE.ShapeGeometry(shape);
    for (const [g, sign] of [
      [gTop, 1],
      [gBot, -1],
    ]) {
      for (let i = 0; i < TEETH; i++) {
        const m = new THREE.Mesh(pg, pocketMat);
        m.rotation.z = i * STEP;
        m.position.z = GEAR_W / 2 + GEAR_W * 0.15 + 0.0008; // just proud of the face + bevel
        g.add(m);
        pockets.push({ m, g, sign, c: i * STEP + STEP / 2 });
        cutaway.push(m);
      }
    }
  }
  // front cover (hidden in the cutaway) + bolts
  const pumpCover = new THREE.Group();
  pump.add(pumpCover);
  sealed.push(pumpCover);
  {
    const cov = beveledBox(PUMP_HX * 2, PUMP_HY * 2, PUMP_Z1 - CAV_Z1, castAl, 0.01);
    cov.position.z = (CAV_Z1 + PUMP_Z1) / 2;
    pumpCover.add(cov);
    for (const [x, y] of [
      [-0.064, -0.094],
      [0.064, -0.094],
      [-0.064, 0.094],
      [0.064, 0.094],
    ]) {
      const b = hexNut(0.011, 0.012, steel);
      b.rotation.x = Math.PI / 2;
      b.position.set(x, y, PUMP_Z1 + 0.005);
      pumpCover.add(b);
    }
  }
  // cavity-face cut plate ring so the opened pump face reads as machined
  {
    const ring = new THREE.Shape();
    ring.moveTo(-PUMP_HX, -PUMP_HY);
    ring.lineTo(PUMP_HX, -PUMP_HY);
    ring.lineTo(PUMP_HX, PUMP_HY);
    ring.lineTo(-PUMP_HX, PUMP_HY);
    ring.closePath();
    ring.holes.push(cavityPath(new THREE.Path()));
    const face = new THREE.Mesh(new THREE.ShapeGeometry(ring, 40), pumpCut);
    face.position.z = CAV_Z1 + 0.0005;
    pump.add(face);
    cutaway.push(face);
  }
  // port bosses + fittings
  for (const s of [-1, 1]) {
    const boss = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.022, 24), castAl);
    boss.rotation.z = Math.PI / 2;
    boss.position.set(s * (PUMP_HX + 0.009), 0, GEAR_Z);
    pump.add(boss);
    const fit = hexNut(0.022, 0.022, steel);
    fit.rotation.z = Math.PI / 2;
    fit.position.set(s * (PUMP_HX + 0.03), 0, GEAR_Z);
    pump.add(fit);
  }

  // ============================================================================
  //  SUCTION LINE, RETURN FILTER, BREATHER, IN-TANK PIPES
  // ============================================================================
  const pipeR = 0.022;
  const PUMP_W = pump.position.clone().add(v3(0, 0, GEAR_Z)); // pump centre (world)
  const suctionPts = [
    [-2.22, 0.5, PUMP_W.z],
    [-2.22, 0.94, PUMP_W.z],
    [-2.22, 1.1, PUMP_W.z],
    [-2.19, 1.155, PUMP_W.z],
    [MX - PUMP_HX - 0.04, MOTOR_Y, PUMP_W.z],
  ];
  const suction = tubeAlong(suctionPts, pipeR, steel, { tubularSegments: 60, radialSegments: 14, tension: 0.2 });
  group.add(suction);
  const strainer = new THREE.Group();
  strainer.position.set(-2.22, 0.44, PUMP_W.z);
  group.add(strainer);
  {
    const body = yCyl(0.045, -0.07, 0.06, new THREE.MeshStandardMaterial({ color: 0x55595f, metalness: 0.6, roughness: 0.6 }));
    strainer.add(body);
    for (let i = 0; i < 6; i++) {
      const band = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.003, 6, 32), darkSteel);
      band.rotation.x = Math.PI / 2;
      band.position.y = -0.06 + i * 0.022;
      strainer.add(band);
    }
    const cap = yCyl(0.048, -0.08, -0.068, darkSteel);
    strainer.add(cap);
  }
  // return filter (tank-top) — bowl, head, inlet
  const FILTER = v3(-1.2, LID, -0.24);
  {
    const bowl = yCyl(0.072, LID, LID + 0.2, filterPaint, 40);
    bowl.position.x = FILTER.x;
    bowl.position.z = FILTER.z;
    group.add(bowl);
    const head = yCyl(0.08, LID + 0.2, LID + 0.24, bellAl, 40);
    head.position.x = FILTER.x;
    head.position.z = FILTER.z;
    group.add(head);
    const ind = yCyl(0.018, LID + 0.24, LID + 0.265, new THREE.MeshStandardMaterial({ color: 0x3fae5a, roughness: 0.4 }));
    ind.position.x = FILTER.x + 0.04;
    ind.position.z = FILTER.z;
    group.add(ind);
    const flange = yCyl(0.1, LID, LID + 0.012, tankPaint, 40);
    flange.position.x = FILTER.x;
    flange.position.z = FILTER.z;
    group.add(flange);
  }
  // filler-breather
  {
    const neck = yCyl(0.035, LID, LID + 0.05, steel, 24);
    neck.position.set(-1.52, neck.position.y, -0.3);
    group.add(neck);
    const capB = yCyl(0.05, LID + 0.05, LID + 0.09, blackPoly, 24);
    capB.position.set(-1.52, capB.position.y, -0.3);
    group.add(capB);
  }
  const retInPts = [
    [FILTER.x, LID, FILTER.z],
    [FILTER.x, 0.52, FILTER.z],
  ];
  const retIn = tubeAlong(retInPts, pipeR, steel, { tubularSegments: 8, radialSegments: 14 });
  group.add(retIn);
  const diffuser = yCyl(0.032, 0.42, 0.53, darkSteel, 20);
  diffuser.position.x = FILTER.x;
  diffuser.position.z = FILTER.z;
  group.add(diffuser);

  // ============================================================================
  //  RELIEF VALVE BLOCK + GAUGE
  // ============================================================================
  const relief = new THREE.Group();
  relief.position.copy(RV);
  group.add(relief);
  const rvSolid = beveledBox(RV_HX * 2, RV_HY * 2, 0.18, valveCast, 0.01);
  relief.add(rvSolid);
  sealed.push(rvSolid);
  const rvBack = beveledBox(RV_HX * 2, RV_HY * 2, 0.09, valveCast, 0.008);
  rvBack.position.z = -0.045;
  relief.add(rvBack);
  cutaway.push(rvBack);
  {
    const cf = rect(-RV_HX + 0.003, RV_HX - 0.003, -RV_HY + 0.003, RV_HY - 0.003, cutFace, 0.0005);
    relief.add(cf);
    cutaway.push(cf);
    const pad = beveledBox(RV_HX * 2 + 0.01, RV.y - RV_HY - LID, 0.16, frameSteel, 0.004);
    pad.position.y = -RV_HY - (RV.y - RV_HY - LID) / 2;
    relief.add(pad);
  }
  const rvPumpMat = oilMat(1);
  const rvDumpMat = oilMat(1);
  const rvDrainMat = oilMat(1);
  paintOil(rvDrainMat, 0.02);
  {
    const parts = [
      rect(-RV_HX + 0.003, 0.03, 0.04, 0.06, rvPumpMat),
      rect(CART_X - 0.008, CART_X + 0.008, 0.06, SEAT_Y, rvPumpMat),
      rect(CART_X - 0.022, CART_X + 0.022, SEAT_Y, 0.11, rvDumpMat),
      rect(CART_X + 0.022, 0.061, 0.084, 0.1, rvDumpMat),
      rect(0.045, 0.061, -RV_HY + 0.003, 0.1, rvDumpMat),
      rect(CART_X - 0.016, CART_X + 0.016, 0.11, RV_HY - 0.003, rvDrainMat),
    ];
    const port = new THREE.Mesh(new THREE.CircleGeometry(0.009, 20), holeMat);
    port.position.set(0.018, 0.05, 0.0015);
    parts.push(port);
    for (const m of parts) {
      relief.add(m);
      cutaway.push(m);
    }
  }
  // cartridge above the block: sealed solid / cutaway half-shell
  const cartSolid = new THREE.Group();
  relief.add(cartSolid);
  sealed.push(cartSolid);
  {
    const hx = hexNut(0.03, 0.03, steel);
    hx.position.set(CART_X, RV_HY + 0.015, 0);
    cartSolid.add(hx);
    const body = yCyl(0.024, RV_HY + 0.03, 0.25, steel, 28);
    body.position.x = CART_X;
    cartSolid.add(body);
  }
  {
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(0.024, 0.024, 0.25 - RV_HY, 28, 1, true, Math.PI / 2, Math.PI),
      steel,
    );
    shell.position.set(CART_X, (RV_HY + 0.25) / 2, 0);
    const shellIn = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0225, 0.0225, 0.25 - RV_HY, 28, 1, true, Math.PI / 2, Math.PI),
      linerBack,
    );
    shellIn.position.copy(shell.position);
    relief.add(shell, shellIn);
    cutaway.push(shell, shellIn);
    for (const s of [-1, 1]) {
      const edge = rect(CART_X + s * 0.023 - 0.0015, CART_X + s * 0.023 + 0.0015, RV_HY, 0.25, cutFace, 0);
      relief.add(edge);
      cutaway.push(edge);
    }
  }
  // poppet, spring, adjusting screw + locknut (always present; inside the
  // solid cartridge they are simply hidden)
  const poppet = new THREE.Group();
  relief.add(poppet);
  {
    const cone = new THREE.Mesh(new THREE.ConeGeometry(0.014, 0.02, 24), steel);
    cone.rotation.x = Math.PI;
    cone.position.y = 0.006;
    cone.castShadow = true;
    poppet.add(cone);
    const stem = yCyl(0.0055, 0.016, 0.034, steel, 14);
    poppet.add(stem);
    const seat = yCyl(0.013, 0.032, 0.036, darkSteel, 20);
    poppet.add(seat);
  }
  poppet.position.x = CART_X;
  const SPRING_L = 0.12;
  const spring = coil({ turns: 7, radius: 0.0115, length: SPRING_L, wireRadius: 0.0022, segmentsPerTurn: 20 }, materials.steel(0x9ea6ae)).mesh;
  spring.position.x = CART_X;
  relief.add(spring);
  const SPRING_TOP = 0.244;
  const adjuster = new THREE.Group();
  adjuster.position.x = CART_X;
  relief.add(adjuster);
  {
    const screw = yCyl(0.013, SPRING_TOP, 0.315, darkSteel, 20);
    adjuster.add(screw);
    const nut = hexNut(0.022, 0.016, steel);
    nut.position.y = 0.265;
    adjuster.add(nut);
    const knob = yCyl(0.022, 0.3, 0.33, blackPoly, 24);
    adjuster.add(knob);
    const disc0 = yCyl(0.013, SPRING_TOP - 0.004, SPRING_TOP, steel, 20);
    adjuster.add(disc0);
  }
  // gauge on a stem
  const GAUGE = v3(RV.x + 0.06, 1.5, RV.z + 0.05);
  const GAUGE_R = 0.07;
  {
    const stem = tubeAlong(
      [
        [GAUGE.x, RV.y + RV_HY, RV.z],
        [GAUGE.x, GAUGE.y - GAUGE_R - 0.03, RV.z],
        [GAUGE.x, GAUGE.y - GAUGE_R - 0.005, RV.z + 0.04],
      ],
      0.009,
      steel,
      { tubularSegments: 20, radialSegments: 10 },
    );
    group.add(stem);
    const sock = hexNut(0.016, 0.03, brass);
    sock.position.set(GAUGE.x, GAUGE.y - GAUGE_R - 0.012, GAUGE.z - 0.005);
    group.add(sock);
  }
  const gauge = new THREE.Group();
  gauge.position.copy(GAUGE);
  group.add(gauge);
  const needle = new THREE.Group();
  {
    const caseM = zCyl(GAUGE_R, -0.03, 0.006, materials.chrome(0xcfd5db), 48);
    caseM.material.roughness = 0.3;
    gauge.add(caseM);
    const bezel = new THREE.Mesh(new THREE.TorusGeometry(GAUGE_R - 0.002, 0.005, 10, 48), caseM.material);
    bezel.position.z = 0.006;
    gauge.add(bezel);
    const cv = document.createElement('canvas');
    cv.width = cv.height = 512;
    const g = cv.getContext('2d');
    g.fillStyle = '#ebe7dc';
    g.fillRect(0, 0, 512, 512);
    const cx = 256;
    const cy = 256;
    const ang = (bar) => ((-135 + (270 * bar) / 250) * Math.PI) / 180;
    // red band 200–250
    g.strokeStyle = '#d4301c';
    g.lineWidth = 26;
    g.beginPath();
    g.arc(cx, cy, 200, ang(200) - Math.PI / 2, ang(250) - Math.PI / 2);
    g.stroke();
    g.strokeStyle = '#1b1c1f';
    for (let b = 0; b <= 250; b += 10) {
      const a = ang(b);
      const major = b % 50 === 0;
      const r0 = major ? 168 : 186;
      g.lineWidth = major ? 7 : 3;
      g.beginPath();
      g.moveTo(cx + Math.sin(a) * r0, cy - Math.cos(a) * r0);
      g.lineTo(cx + Math.sin(a) * 214, cy - Math.cos(a) * 214);
      g.stroke();
      if (major) {
        g.fillStyle = '#1b1c1f';
        g.font = 'bold 44px Arial';
        g.textAlign = 'center';
        g.textBaseline = 'middle';
        g.fillText(String(b), cx + Math.sin(a) * 128, cy - Math.cos(a) * 128);
      }
    }
    g.font = 'bold 40px Arial';
    g.fillText('bar', cx, cy + 112);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    tex.anisotropy = 4;
    const face = new THREE.Mesh(new THREE.CircleGeometry(GAUGE_R - 0.006, 48), new THREE.MeshStandardMaterial({ map: tex, roughness: 0.65 }));
    face.position.z = 0.0065;
    gauge.add(face);
    needle.position.z = 0.009;
    gauge.add(needle);
    const nGeo = new THREE.BoxGeometry(0.004, 0.058, 0.002);
    nGeo.translate(0, 0.022, 0);
    const nm = new THREE.Mesh(nGeo, new THREE.MeshStandardMaterial({ color: 0x141416, roughness: 0.5 }));
    needle.add(nm);
    const hubN = zCyl(0.006, 0.008, 0.012, darkSteel, 16);
    gauge.add(hubN);
    const glass = new THREE.Mesh(new THREE.CircleGeometry(GAUGE_R - 0.004, 48), materials.glass(0xffffff, 0.1));
    glass.position.z = 0.014;
    gauge.add(glass);
  }
  function setGauge(p) {
    const bar = p * 200;
    needle.rotation.z = -((-135 + (270 * bar) / 250) * Math.PI) / 180;
  }

  // ============================================================================
  //  SPOOL VALVE (monoblock, open centre) + LEVER
  // ============================================================================
  const dcv = new THREE.Group();
  dcv.position.copy(DCV);
  group.add(dcv);
  const dcvSolid = beveledBox(DCV_HX * 2, DCV_HY * 2, 0.18, valveCast, 0.012);
  dcv.add(dcvSolid);
  sealed.push(dcvSolid);
  const dcvBack = beveledBox(DCV_HX * 2, DCV_HY * 2, 0.09, valveCast, 0.01);
  dcvBack.position.z = -0.045;
  dcv.add(dcvBack);
  cutaway.push(dcvBack);
  {
    const cf = rect(-DCV_HX + 0.004, DCV_HX - 0.004, -DCV_HY + 0.004, DCV_HY - 0.004, cutFace, 0.0005);
    dcv.add(cf);
    cutaway.push(cf);
    const pad = beveledBox(0.5, DCV.y - DCV_HY - LID, 0.16, frameSteel, 0.005);
    pad.position.y = -DCV_HY - (DCV.y - DCV_HY - LID) / 2;
    dcv.add(pad);
    // left end cap (centring spring housing)
    const capL = xCyl(0.042, -DCV_HX - 0.05, -DCV_HX + 0.002, valveCast, { seg: 32 });
    dcv.add(capL);
    const dome = new THREE.Mesh(new THREE.SphereGeometry(0.042, 24, 12, 0, TAU, 0, Math.PI / 2), valveCast);
    dome.rotation.z = Math.PI / 2;
    dome.position.x = -DCV_HX - 0.05;
    dcv.add(dome);
    // body bolts (through-bolts at the corners, on the face)
    for (const [x, y] of [
      [-0.25, 0.075],
      [0.25, 0.075],
      [-0.25, -0.075],
      [0.25, -0.075],
    ]) {
      const b = hexNut(0.011, 0.01, steel);
      b.rotation.x = Math.PI / 2;
      b.position.set(x, y, 0.093);
      dcvSolid.add(b);
    }
  }
  // section oil (nets): pump · A · B · tank
  const netPump = oilMat(1);
  const netA = oilMat(1);
  const netB = oilMat(1);
  const netT = oilMat(1);
  paintOil(netT, 0.02);
  {
    const GH = 0.034; // gallery half-height
    const gal = (x0, x1, mat) => rect(x0, x1, -GH, GH, mat);
    const parts = [
      gal(-0.204, -0.182, netT),
      gal(0.182, 0.204, netT),
      gal(-0.162, -0.14, netA),
      gal(0.14, 0.162, netB),
      gal(-0.12, -0.058, netPump),
      gal(0.058, 0.12, netPump),
      gal(-0.033, -0.011, netPump),
      gal(0.011, 0.033, netT),
      // risers
      rect(-0.159, -0.143, GH, DCV_HY - 0.004, netA),
      rect(0.143, 0.159, GH, DCV_HY - 0.004, netB),
      rect(-0.097, -0.081, GH, 0.073, netPump),
      rect(0.081, 0.097, GH, 0.073, netPump),
      rect(-0.03, -0.014, GH, 0.073, netPump),
      rect(-0.097, 0.097, 0.057, 0.073, netPump), // parallel / inlet channel
      rect(-0.201, -0.185, -0.073, -GH, netT),
      rect(0.185, 0.201, -0.073, -GH, netT),
      rect(0.014, 0.03, -0.073, -GH, netT),
      rect(-0.201, 0.201, -0.073, -0.057, netT), // tank channel
    ];
    const pin = new THREE.Mesh(new THREE.CircleGeometry(0.0085, 20), holeMat);
    pin.position.set(-0.022, 0.065, 0.0015);
    const pout = new THREE.Mesh(new THREE.CircleGeometry(0.0085, 20), holeMat);
    pout.position.set(0.12, -0.065, 0.0015);
    parts.push(pin, pout);
    for (const m of parts) {
      dcv.add(m);
      cutaway.push(m);
    }
  }
  // spool: core + lands + groove oil (groove oil only shows in the cutaway)
  const spool = new THREE.Group();
  dcv.add(spool);
  const grooveMats = { core: oilMat(1), ap: oilMat(1), pb: oilMat(1), tl: oilMat(1), tr: oilMat(1) };
  paintOil(grooveMats.tl, 0.02);
  paintOil(grooveMats.tr, 0.02);
  {
    spool.add(xCyl(0.0085, -DCV_HX + 0.004, LEVER_PIVOT.x, spoolSteel, { seg: 20 }));
    for (const [a, b] of [
      [-0.276, -0.226],
      [-0.172, -0.13],
      [-0.075, -0.022],
      [0.022, 0.075],
      [0.13, 0.172],
      [0.226, 0.276],
    ]) {
      spool.add(xCyl(BORE_SP - 0.0004, a, b, spoolSteel, { seg: 32 }));
    }
    for (const [a, b, k] of [
      [-0.226, -0.172, 'tl'],
      [-0.13, -0.075, 'ap'],
      [-0.022, 0.022, 'core'],
      [0.075, 0.13, 'pb'],
      [0.172, 0.226, 'tr'],
    ]) {
      const g = xCyl(BORE_SP - 0.0008, a, b, grooveMats[k], { seg: 28 });
      g.castShadow = false;
      spool.add(g);
      cutaway.push(g);
    }
    const clevis = beveledBox(0.03, 0.03, 0.028, steel, 0.004);
    clevis.position.x = LEVER_PIVOT.x;
    spool.add(clevis);
  }
  // seal plate + lever bracket at the right end
  {
    const sealP = xCyl(0.03, DCV_HX, DCV_HX + 0.015, darkSteel, { seg: 24 });
    dcv.add(sealP);
    for (const z of [-0.022, 0.022]) {
      const ch = beveledBox(0.09, 0.05, 0.008, darkSteel, 0.003);
      ch.position.set(DCV_HX + 0.045, LEVER_PIVOT.y + 0.005, z);
      dcv.add(ch);
    }
  }
  const lever = new THREE.Group();
  lever.position.set(LEVER_PIVOT.x, LEVER_PIVOT.y, 0);
  dcv.add(lever);
  {
    const bar = beveledBox(0.026, LEVER_ARM + 0.06, 0.018, steel, 0.005);
    bar.position.y = -LEVER_ARM / 2 + 0.01;
    lever.add(bar);
    const handle = yCyl(0.012, 0.03, 0.4, steel, 16);
    lever.add(handle);
    const knob = new THREE.Mesh(new THREE.CapsuleGeometry(0.026, 0.07, 6, 16), blackPoly);
    knob.position.y = 0.43;
    knob.castShadow = true;
    lever.add(knob);
    const pivotPin = zCyl(0.01, -0.035, 0.035, darkSteel, 12);
    lever.add(pivotPin);
  }
  // port fittings on top (A, B) and on the back (pump in, tank out)
  for (const x of [-0.151, 0.151]) {
    const f = hexNut(0.021, 0.035, steel);
    f.position.set(x, DCV_HY + 0.0175, 0);
    dcv.add(f);
  }
  for (const [x, y] of [
    [-0.022, 0.065],
    [0.12, -0.065],
  ]) {
    const f = hexNut(0.019, 0.03, steel);
    f.rotation.x = Math.PI / 2;
    f.position.set(x, y, -0.105);
    dcv.add(f);
  }

  // ============================================================================
  //  HARD LINES: pump → relief → valve, valve → filter, relief → tank
  // ============================================================================
  const lineMat = materials.steel(0xaab1ba);
  lineMat.roughness = 0.45;
  lineMat.transparent = true;
  const pressPts = [
    [MX + PUMP_HX + 0.03, MOTOR_Y, PUMP_W.z],
    [RV.x - 0.02, RV.y + 0.05, RV.z + 0.02],
    [RV.x + 0.018, RV.y + 0.05, RV.z - 0.03],
    [RV.x + 0.02, RV.y + 0.05, 0.06],
    [-1.6, 1.155, 0.045],
    [DCV.x - 0.022, DCV.y + 0.065, 0.06],
    [DCV.x - 0.022, DCV.y + 0.065, DCV.z - 0.09],
  ];
  const pressLine = tubeAlong(pressPts.slice(2), pipeR * 0.9, lineMat, { tubularSegments: 60, radialSegments: 12, tension: 0.3 });
  group.add(pressLine);
  const pressCurve = new THREE.CatmullRomCurve3(pressPts.map((p) => v3(...p)), false, 'catmullrom', 0.3);
  const retPts = [
    [DCV.x + 0.12, DCV.y - 0.065, DCV.z - 0.09],
    [DCV.x + 0.12, DCV.y - 0.065, 0.04],
    [-1.22, 1.07, -0.08],
    [FILTER.x, 1.08, FILTER.z + 0.08],
    [FILTER.x, 1.08, FILTER.z + 0.05],
  ];
  const retLine = tubeAlong(retPts, pipeR * 0.9, lineMat, { tubularSegments: 50, radialSegments: 12, tension: 0.3 });
  group.add(retLine);
  const retCurve = new THREE.CatmullRomCurve3(
    [...retPts, [FILTER.x, 1.0, FILTER.z], [FILTER.x, 0.75, FILTER.z], [FILTER.x, 0.5, FILTER.z]].map((p) => v3(...p)),
    false,
    'catmullrom',
    0.3,
  );
  const dumpPts = [
    [RV.x + 0.053, RV.y - RV_HY, RV.z],
    [RV.x + 0.053, LID, RV.z],
    [RV.x + 0.053, 0.56, RV.z],
  ];
  const dumpLine = tubeAlong(dumpPts, pipeR * 0.8, steel, { tubularSegments: 10, radialSegments: 12 });
  group.add(dumpLine);
  const dumpCurve = new THREE.CatmullRomCurve3(
    [[RV.x + 0.053, RV.y + 0.09, RV.z + 0.02], [RV.x + 0.053, RV.y - 0.05, RV.z + 0.02], ...dumpPts.slice(1)].map((p) => v3(...p)),
    false,
    'catmullrom',
    0.1,
  );
  const suctionCurve = suction.userData.curve;

  // ============================================================================
  //  BOOM RIG: base frame, post, boom, load
  // ============================================================================
  {
    const base = beveledBox(1.26, 0.06, 0.5, frameSteel, 0.012);
    base.position.set(-0.1, PLINTH_H + 0.03, 0);
    base.receiveShadow = true;
    group.add(base);
    for (const [x, z] of [
      [-0.66, -0.2],
      [-0.66, 0.2],
      [0.46, -0.2],
      [0.46, 0.2],
    ]) {
      const b = hexNut(0.02, 0.02, steel);
      b.position.set(x, PLINTH_H + 0.07, z);
      group.add(b);
    }
    // post (box section) with gussets
    const postTop = P0.y - 0.06;
    const post = beveledBox(0.17, postTop - (PLINTH_H + 0.06), 0.15, frameSteel, 0.012);
    post.position.set(P0.x, (postTop + PLINTH_H + 0.06) / 2, 0);
    group.add(post);
    for (const s of [-1, 1]) {
      const sh = new THREE.Shape();
      sh.moveTo(0, 0);
      sh.lineTo(0.2, 0);
      sh.lineTo(0, 0.32);
      sh.closePath();
      const gus = new THREE.Mesh(new THREE.ExtrudeGeometry(sh, { depth: 0.02, bevelEnabled: false }), frameSteel);
      gus.castShadow = true;
      gus.position.set(P0.x + s * 0.085, PLINTH_H + 0.06, -0.01);
      gus.scale.x = s;
      group.add(gus);
    }
    // pivot cheeks
    for (const z of [-0.082, 0.082]) {
      const cheek = beveledBox(0.17, 0.22, 0.024, frameSteel, 0.008);
      cheek.position.set(P0.x, P0.y - 0.04, z);
      group.add(cheek);
      const boss = zCyl(0.07, z - 0.012, z + 0.012, frameSteel, 32);
      boss.position.x = P0.x;
      boss.position.y = P0.y;
      group.add(boss);
    }
    const pin = zCyl(0.028, -0.115, 0.115, steel, 20);
    pin.position.set(P0.x, P0.y, 0);
    group.add(pin);
    // cylinder base lugs
    for (const z of [-0.048, 0.048]) {
      const lug = beveledBox(0.11, 0.11, 0.02, frameSteel, 0.006);
      lug.position.set(C0.x, C0.y - 0.01, z);
      group.add(lug);
    }
    const bpin = zCyl(0.02, -0.07, 0.07, steel, 16);
    bpin.position.set(C0.x, C0.y, 0);
    group.add(bpin);
  }
  const boom = new THREE.Group();
  boom.position.copy(P0);
  group.add(boom);
  {
    const beam = beveledBox(TIP_X + 0.2, 0.2, 0.13, boomPaint, 0.02);
    beam.position.x = (TIP_X + 0.2) / 2 - 0.1;
    boom.add(beam);
    boom.add(zCyl(0.075, -0.07, 0.07, boomPaint, 32));
    for (const z of [-0.045, 0.045]) {
      const lug = beveledBox(0.18, 0.16, 0.018, boomPaint, 0.006);
      lug.position.set(PIN_R, -0.13, z);
      boom.add(lug);
    }
    const rpin = zCyl(0.02, -0.065, 0.065, steel, 16);
    rpin.position.set(PIN_R, PIN_OFF, 0);
    boom.add(rpin);
    for (const z of [-0.035, 0.035]) {
      const tl = beveledBox(0.13, 0.14, 0.016, boomPaint, 0.005);
      tl.position.set(TIP_X, -0.11, z);
      boom.add(tl);
    }
    const tpin = zCyl(0.018, -0.055, 0.055, steel, 16);
    tpin.position.set(TIP_X, -0.13, 0);
    boom.add(tpin);
    // stencil stripe
    const stripe = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.03), new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.6 }));
    stripe.position.set(1.75, 0.04, 0.0655);
    boom.add(stripe);
  }
  const load = new THREE.Group();
  load.position.set(TIP_X, -0.13, 0);
  boom.add(load);
  {
    // a real tonne: a cast lead-grey block 500 x 420 x 420 mm (0.088 m3,
    // a tonne of lead) hung from a shackle
    for (const z of [-0.02, 0.02]) {
      const link = beveledBox(0.06, 0.16, 0.014, steel, 0.004);
      link.position.set(0, -0.07, z);
      load.add(link);
    }
    const blockMat = materials.darkMetal(0x4a4f56);
    blockMat.roughness = 0.72;
    blockMat.metalness = 0.55;
    const BLK = { w: 1.0, h: 0.84, d: 0.84 };
    const block = beveledBox(BLK.w, BLK.h, BLK.d, blockMat, 0.04);
    block.position.y = -0.16 - BLK.h / 2;
    load.add(block);
    const lugB = beveledBox(0.16, 0.06, 0.05, blockMat, 0.01);
    lugB.position.y = -0.14;
    load.add(lugB);
    const eye = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.012, 10, 24), steel);
    eye.position.y = -0.12;
    load.add(eye);
    const plate = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.16), new THREE.MeshStandardMaterial({ color: 0xd2a024, roughness: 0.5 }));
    plate.position.set(0, -0.16 - BLK.h / 2, BLK.d / 2 + 0.001);
    load.add(plate);
    const band = new THREE.Mesh(new THREE.PlaneGeometry(0.34, 0.035), new THREE.MeshStandardMaterial({ color: 0x1c1d20, roughness: 0.6 }));
    band.position.set(0, -0.16 - BLK.h / 2 - 0.03, BLK.d / 2 + 0.002);
    load.add(band);
  }

  // ============================================================================
  //  HYDRAULIC CYLINDER (local +x along its axis, origin at the base pin)
  // ============================================================================
  const cyl = new THREE.Group();
  cyl.position.copy(C0);
  group.add(cyl);
  const cylSolid = new THREE.Group();
  cyl.add(cylSolid);
  sealed.push(cylSolid);
  const cylCut = new THREE.Group();
  cyl.add(cylCut);
  cutaway.push(cylCut);
  {
    cyl.add(zCyl(0.042, -0.035, 0.035, steel, 24)); // base eye
    const neck = beveledBox(0.06, 0.06, 0.06, steel, 0.008);
    neck.position.x = 0.035;
    cyl.add(neck);
    cylSolid.add(xCyl(0.08, 0.035, CAP_IN, cylPaint, { seg: 40 }));
    cylSolid.add(xCyl(BARREL_R, 0.06, 0.78, cylPaint, { seg: 48 }));
    cylSolid.add(xCyl(0.072, 0.78, 0.84, steel, { seg: 40 }));
    // cutaway halves + cut faces
    cylCut.add(xCyl(0.08, 0.035, CAP_IN, cylPaint, { seg: 40, half: true }));
    cylCut.add(xCyl(BARREL_R, 0.06, 0.78, cylPaint, { seg: 48, half: true }));
    cylCut.add(xCyl(BORE_R + 0.001, CAP_IN, GLAND_IN, linerBack, { seg: 48, half: true }));
    cylCut.add(xCyl(0.072, 0.78, 0.84, steel, { seg: 40, half: true }));
    for (const s of [-1, 1]) {
      cylCut.add(rect(CAP_IN, 0.78, s * (BORE_R + BARREL_R) / 2 - 0.0065, s * (BORE_R + BARREL_R) / 2 + 0.0065, cutFace, 0));
      cylCut.add(rect(GLAND_IN, 0.84, s * 0.054 - 0.017, s * 0.054 + 0.017, cutFace, 0));
    }
    cylCut.add(rect(0.035, CAP_IN, -0.08, 0.08, cutFace, 0));
    // ports on the back (−z) side
    for (const x of [0.14, 0.7]) {
      const boss = zCyl(0.022, -BARREL_R - 0.018, -BARREL_R + 0.01, steel, 16);
      boss.position.x = x;
      cyl.add(boss);
      const f = hexNut(0.018, 0.02, steel);
      f.rotation.x = Math.PI / 2;
      f.position.set(x, 0, -BARREL_R - 0.028);
      cyl.add(f);
    }
  }
  // oil chambers: half-cylinder + flat cut face, scaled per frame
  function chamber(mat) {
    const g = new THREE.Group();
    const half = new THREE.Mesh(new THREE.CylinderGeometry(BORE_R, BORE_R, 1, 40, 1, true, Math.PI / 2, Math.PI), mat);
    half.rotation.z = -Math.PI / 2;
    const flat = new THREE.Mesh(new THREE.PlaneGeometry(1, BORE_R * 2), mat);
    flat.position.z = -0.0005;
    g.add(half, flat);
    cylCut.add(g);
    return g;
  }
  const capOilMat = oilMat(1);
  const rodOilMat = oilMat(0.82);
  const capOil = chamber(capOilMat);
  const rodOil = chamber(rodOilMat);
  // rod + piston (move together)
  const rodG = new THREE.Group();
  cyl.add(rodG);
  let ROD_LEN = 0;
  const pistonParts = new THREE.Group();
  rodG.add(pistonParts);
  {
    pistonParts.add(xCyl(BORE_R - 0.001, -PISTON_W / 2, PISTON_W / 2, steel, { seg: 40 }));
    for (const x of [-0.013, 0.013]) pistonParts.add(xCyl(BORE_R - 0.0005, x - 0.004, x + 0.004, materials.rubber(0x1a1b1e), { seg: 40 }));
  }
  const rodMesh = xCyl(ROD_R, 0, 1, chromeRod, { seg: 32 });
  rodG.add(rodMesh);
  const rodEye = zCyl(0.042, -0.03, 0.03, steel, 24);
  rodG.add(rodEye);

  // geometry of the linkage
  const pinWorld = (th, out = new THREE.Vector3()) =>
    out.set(
      P0.x + PIN_R * Math.cos(th) - PIN_OFF * Math.sin(th),
      P0.y + PIN_R * Math.sin(th) + PIN_OFF * Math.cos(th),
      0,
    );
  const _pin = new THREE.Vector3();
  const L_MIN = pinWorld(TH0, _pin).sub(C0).length();
  ROD_LEN = L_MIN - 0.12;
  rodMesh.scale.y = ROD_LEN;
  rodMesh.position.x = ROD_LEN / 2;
  rodEye.position.x = ROD_LEN;

  // ============================================================================
  //  HOSES (rebuilt as the cylinder swings; ghosted rubber + pressure core)
  // ============================================================================
  const HOSE_R = 0.026;
  const hoseFixed = {
    A: [
      [DCV.x - 0.151, DCV.y + DCV_HY + 0.035, DCV.z],
      [DCV.x - 0.151, DCV.y + DCV_HY + 0.13, DCV.z - 0.02],
      [-1.43, 1.44, 0.04],
      [-1.05, 1.37, -0.13],
      [-0.8, 0.95, -0.28],
      [-0.62, 0.48, -0.36],
      [-0.2, 0.37, -0.36],
    ],
    B: [
      [DCV.x + 0.151, DCV.y + DCV_HY + 0.035, DCV.z],
      [DCV.x + 0.151, DCV.y + DCV_HY + 0.12, DCV.z - 0.02],
      [-1.12, 1.41, 0.05],
      [-0.9, 1.28, -0.17],
      [-0.68, 0.85, -0.42],
      [-0.5, 0.46, -0.48],
      [0.2, 0.5, -0.42],
    ],
  };
  const hoseCoreMat = { A: oilMat(1), B: oilMat(1) };
  const hoses = {};
  for (const k of ['A', 'B']) {
    const outer = new THREE.Mesh(new THREE.BufferGeometry(), hoseRubber);
    outer.castShadow = true;
    const core = new THREE.Mesh(new THREE.BufferGeometry(), hoseCoreMat[k]);
    group.add(outer, core);
    cutaway.push(core);
    hoses[k] = { outer, core, curve: null, key: '' };
  }
  function cylLocalToWorld(x, y, z, phi, out) {
    return out.set(C0.x + x * Math.cos(phi) - y * Math.sin(phi), C0.y + x * Math.sin(phi) + y * Math.cos(phi), z);
  }
  function updateHoses(phi) {
    const ends = {
      A: [
        cylLocalToWorld(0.14, 0, -BARREL_R - 0.2, phi, new THREE.Vector3()),
        cylLocalToWorld(0.14, 0, -BARREL_R - 0.04, phi, new THREE.Vector3()),
      ],
      B: [
        cylLocalToWorld(0.7, 0, -BARREL_R - 0.22, phi, new THREE.Vector3()),
        cylLocalToWorld(0.7, 0, -BARREL_R - 0.04, phi, new THREE.Vector3()),
      ],
    };
    const key = phi.toFixed(4);
    for (const k of ['A', 'B']) {
      const h = hoses[k];
      if (h.key === key) continue;
      h.key = key;
      const pts = [...hoseFixed[k].map((p) => v3(...p)), ...ends[k]];
      h.curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.5);
      h.outer.geometry.dispose();
      h.outer.geometry = new THREE.TubeGeometry(h.curve, 90, HOSE_R, 12, false);
      h.core.geometry.dispose();
      h.core.geometry = new THREE.TubeGeometry(h.curve, 90, HOSE_R * 0.55, 8, false);
    }
  }

  // ============================================================================
  //  FLOW PACKETS
  // ============================================================================
  const streams = {
    suction: { curve: suctionCurve, n: 9, field: flowField(9, 0.04) },
    press: { curve: pressCurve, n: 11, field: flowField(11, 0.04) },
    ret: { curve: retCurve, n: 12, field: flowField(12, 0.04) },
    dump: { curve: dumpCurve, n: 7, field: flowField(7, 0.04) },
    hoseA: { curve: null, n: 22, field: flowField(22, 0.045) },
    hoseB: { curve: null, n: 22, field: flowField(22, 0.045) },
  };
  for (const s of Object.values(streams)) {
    group.add(s.field.mesh);
    cutaway.push(s.field.mesh);
  }
  // packets through the valve section itself (valve-local, just proud of the cut)
  const VZ = 0.024;
  const poly = (pts) => chainPath(pts.slice(1).map((p, i) => [[...pts[i], VZ], [...p, VZ]]));
  const valveStreams = {
    core: { curve: poly([[-0.022, 0.065], [-0.022, 0], [0.022, 0], [0.022, -0.065], [0.12, -0.065]]), n: 9 },
    aIn: { curve: poly([[-0.022, 0.065], [-0.089, 0.065], [-0.089, 0], [-0.151, 0], [-0.151, 0.1]]), n: 9 },
    bRet: { curve: poly([[0.151, 0.1], [0.151, 0], [0.193, 0], [0.193, -0.065], [0.12, -0.065]]), n: 8 },
    bIn: { curve: poly([[-0.022, 0.065], [0.089, 0.065], [0.089, 0], [0.151, 0], [0.151, 0.1]]), n: 9 },
    aRet: { curve: poly([[-0.151, 0.1], [-0.151, 0], [-0.193, 0], [-0.193, -0.065], [0.12, -0.065]]), n: 11 },
  };
  for (const s of Object.values(valveStreams)) {
    s.field = flowField(s.n, 0.03);
    dcv.add(s.field.mesh);
    cutaway.push(s.field.mesh);
  }
  const _p = new THREE.Vector3();
  const _t = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _hid = new THREE.Vector3(0, -50, 0);
  const _sc = new THREE.Color();
  function placeStream(s, phase, p, fade = 1) {
    pressureColor(Math.max(0.1, p), _sc);
    for (let i = 0; i < s.n; i++) {
      const t = (((i / s.n + phase) % 1) + 1) % 1;
      if (!s.curve || fade < 0.05) {
        s.field.set(i, _hid, _q.identity(), 0.0001);
        continue;
      }
      _p.copy(s.curve.getPointAt(t));
      _t.copy(s.curve.getTangentAt(t)).normalize();
      _q.setFromUnitVectors(_Y, _t);
      s.field.set(i, _p, _q, fade, _sc);
    }
    s.field.commit();
  }

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const labels = calloutSets(['exterior', 'pump', 'loop', 'valve', 'cylinder', 'relief']);
  labels.add('exterior', motor, 'Electric motor', [MOTOR_R + 0.01, 0.06, -0.25], 75, 80);
  labels.add('exterior', tank, 'Oil tank', [-1.5, 0.55, TANK_Z], -110, 48);
  labels.add('exterior', lever, 'Control lever', [0, 0.45, 0.02], 60, 50);
  labels.add('exterior', gauge, 'Pressure gauge', [0, GAUGE_R, 0], 60, 50);
  labels.add('exterior', cyl, 'Hydraulic cylinder', [0.45, BARREL_R, 0.04], -20, 60);
  labels.add('exterior', boom, 'Boom', [1.55, 0.08, 0.06], 70, 50);
  labels.add('exterior', load, '1-tonne load', [0.5, -0.45, 0.3], -10, 50);

  labels.add('pump', pump, 'Gear pump — 12 teeth each', [0.07, GC + 0.04, CAV_Z1], 40, 60);
  labels.add('pump', pump, 'Oil rides round the outside', [0, GC + CAV_R - 0.004, CAV_Z1 + 0.01], 95, 46);
  labels.add('pump', pump, 'From the tank', [-0.06, 0, CAV_Z1], 200, 50);
  labels.add('pump', pump, 'Out to the valve', [0.06, 0, CAV_Z1], -20, 60);
  labels.add('pump', group, 'Suction pipe', [-2.2, 1.05, PUMP_W.z + pipeR], -60, 60);

  labels.add('loop', lever, 'Lever centred', [0, 0.45, 0.02], 60, 46);
  const gaugeLoop = labels.add('loop', gauge, 'Gauge 6 bar', [GAUGE_R * 0.7, GAUGE_R * 0.7, 0.01], 50, 50);
  labels.add('loop', dcv, 'Straight through to the tank', [0.022, -0.05, 0.002], -60, 60);
  labels.add('loop', dcv, 'Port A shut — oil locked in', [-0.151, 0.06, 0.002], 70, 70);

  labels.add('valve', spool, 'Spool', [-0.1, BORE_SP, 0.01], 105, 52);
  labels.add('valve', dcv, 'From the pump', [-0.06, 0.065, 0.002], 80, 90);
  labels.add('valve', dcv, 'Port A — to lift', [-0.151, DCV_HY - 0.02, 0.002], 60, 50);
  labels.add('valve', dcv, 'Port B — to lower', [0.151, DCV_HY - 0.02, 0.002], 60, 60);
  labels.add('valve', dcv, 'Back to the tank', [0.15, -0.065, 0.002], -60, 50);

  labels.add('cylinder', pistonParts, 'Piston', [0, BORE_R, 0.01], 120, 50);
  const capLbl = labels.add('cylinder', capOil, 'Lift side 70 bar', [0, 0, 0.01], -20, 60);
  const rodLbl = labels.add('cylinder', rodOil, 'Rod side 8 bar', [0, 0, 0.01], 30, 70);
  labels.add('cylinder', rodMesh, 'Rod', [0, 0, ROD_R], -40, 50);

  labels.add('relief', poppet, 'Poppet', [0.014, 0.004, 0.01], -10, 70);
  labels.add('relief', spring, 'Spring — set to 200 bar', [0.012, 0, 0.012], 20, 70);
  labels.add('relief', relief, 'Dump to tank', [0.053, -0.08, 0.002], -20, 60);
  const gaugeRel = labels.add('relief', gauge, 'Gauge 6 bar', [GAUGE_R * 0.7, GAUGE_R * 0.7, 0.01], 30, 50);

  // ============================================================================
  //  POSE
  // ============================================================================
  const PROG = {
    cycle: compile(PROGRAMS.cycle),
    work: compile(PROGRAMS.work),
    idle: compile(PROGRAMS.idle),
    relief: compile(PROGRAMS.relief),
  };
  let revealed = false;

  function pose(P, u) {
    u = ((u % 1) + 1) % 1;
    const sN = P.spool(u);
    const e = P.ext(u);
    const ps = P.p(u);
    const pa = P.pA(u);
    const pb = P.pB(u);
    const rl = P.rel(u);

    // boom + load
    const th = TH0 + (TH1 - TH0) * e;
    boom.rotation.z = th;
    load.rotation.z = -th;
    // cylinder
    pinWorld(th, _pin);
    const dx = _pin.x - C0.x;
    const dy = _pin.y - C0.y;
    const phi = Math.atan2(dy, dx);
    const L = Math.hypot(dx, dy);
    cyl.rotation.z = phi;
    const xp = L - ROD_LEN; // piston centre
    rodG.position.x = xp;
    const c0 = CAP_IN;
    const c1 = xp - PISTON_W / 2;
    capOil.position.x = (c0 + c1) / 2;
    capOil.scale.x = Math.max(0.001, c1 - c0);
    const r0 = xp + PISTON_W / 2;
    const r1 = GLAND_IN;
    rodOil.position.x = (r0 + r1) / 2;
    rodOil.scale.x = Math.max(0.001, r1 - r0);
    updateHoses(phi);

    // spool + lever
    const s = sN * SHIFT;
    spool.position.x = s;
    // clevis pin sits LEVER_ARM below the pivot: rotating the lever by α puts
    // it at pivot.x + ARM·sinα, which must equal the spool end (pivot.x + s)
    lever.rotation.z = Math.asin(s / LEVER_ARM);

    // relief poppet + spring
    const lift = 0.009 * rl;
    poppet.position.y = SEAT_Y + lift;
    const sb = SEAT_Y + lift + 0.036;
    spring.position.y = (sb + SPRING_TOP) / 2;
    spring.scale.y = (SPRING_TOP - sb) / SPRING_L;

    // pump gears (top turns clockwise seen from the front)
    const ga = u * PUMP_TURNS * TAU;
    gTop.rotation.z = -ga;
    gBot.rotation.z = ga + STEP / 2;
    for (const pk of pockets) {
      const wa = pk.c + pk.g.rotation.z;
      const sy = Math.sin(wa) * pk.sign;
      pk.m.visible = revealed && sy > -0.42;
    }

    // pressures → colours
    paintOil(outletOilMat, ps);
    paintOil(rvPumpMat, ps);
    paintOil(rvDumpMat, 0.02 + 0.28 * rl);
    paintOil(netPump, ps);
    paintOil(netA, pa);
    paintOil(netB, pb);
    paintOil(grooveMats.core, ps * (1 - Math.abs(sN)) + 0.02 * Math.abs(sN));
    paintOil(grooveMats.ap, ps);
    paintOil(grooveMats.pb, ps);
    paintOil(hoseCoreMat.A, pa);
    paintOil(hoseCoreMat.B, pb);
    paintOil(capOilMat, pa);
    paintOil(rodOilMat, pb);
    setGauge(ps);

    // packets
    placeStream(streams.suction, u * 4, 0.02);
    placeStream(streams.press, P.pressT.at(u) / TAU, ps);
    placeStream(streams.ret, P.retT.at(u) / TAU, 0.03);
    placeStream(streams.dump, P.dumpT ? P.dumpT.at(u) / TAU : 0, 0.25, P.dumpT ? clamp01(rl * 3) : 0);
    streams.hoseA.curve = hoses.A.curve;
    streams.hoseB.curve = hoses.B.curve;
    placeStream(streams.hoseA, e * HOSE_K, pa);
    placeStream(streams.hoseB, -e * HOSE_K * 0.67, pb);
    const vp = { core: ps, aIn: pa, bRet: pb, bIn: pb, aRet: 0.15 };
    for (const [k, vs] of Object.entries(valveStreams)) {
      const T = P.tables[k];
      placeStream(vs, T ? T.at(u) / TAU : 0, vp[k], T ? clamp01(P.rates[k](u) * 2.5) : 0);
    }

    // live readouts
    const bar = (p) => `${Math.round((p * 200) / 2) * 2} bar`;
    gaugeLoop.setText(`Gauge ${bar(ps)}`);
    gaugeRel.setText(`Gauge ${bar(ps)}`);
    capLbl.setText(`Lift side ${bar(pa)}`);
    rodLbl.setText(`Rod side ${bar(pb)}`);
    return { e, ps };
  }

  const setCycle = (u) => pose(PROG.cycle, u);
  const setWork = (u) => pose(PROG.work, u);
  const setIdle = (u) => pose(PROG.idle, u);
  const setRelief = (u) => pose(PROG.relief, u);

  function setReveal(t) {
    revealed = clamp01(t) > 0.5;
    for (const o of sealed) o.visible = !revealed;
    for (const o of cutaway) o.visible = revealed;
    hoseRubber.opacity = revealed ? 0.2 : 1;
    hoseRubber.depthWrite = !revealed;
    lineMat.opacity = revealed ? 0.35 : 1;
    lineMat.depthWrite = !revealed;
  }

  setReveal(0);
  setCycle(0);
  labels.setLabels(false);

  return {
    group,
    setCycle,
    setWork,
    setIdle,
    setRelief,
    setReveal,
    setLabels: labels.setLabels,
    parts: { boom, cyl, rod: rodG, spool, lever, gTop, gBot, poppet, needle, load },
  };
}
