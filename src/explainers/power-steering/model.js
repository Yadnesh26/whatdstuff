import * as THREE from 'three';
import { materials, rod, disc, studioPlinth, flowField } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, gear, chainPath, boltCircle } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, win, TAU } from '../../framework/motion.js';

// Hydraulic rack-and-pinion power steering on a display rig: steering wheel +
// column + intermediate shaft → rotary valve / pinion tower on the rack →
// rack with a power-cylinder section → tie rods → knuckles and two front
// tyres; a belt-driven vane pump with its reservoir feeds the valve through a
// pressure hose and takes oil back through a return hose.
//
// SCALE: 1 unit = 0.3 m. Every constant below is a real dimension / 0.3:
//   tyre 650 mm OD → TIRE_R 1.085 · track ≈ 1.55 m → tyre centres at ±2.6
//   rack bar Ø26 mm → RACK_R 0.043 · power-cylinder bore Ø40 mm → BORE_R 0.066
//   rack travel ±75 mm → ±0.25 (loops use AMP 0.22) · steering arm ≈ 140 mm
//   pinion 7 teeth, pitch radius 11 mm → PITCH_R 0.037
//   torsion bar Ø ≈ 8 mm → 0.014 radius, ≈ 115 mm long
//   steering wheel Ø380 mm → rim radius 0.6 · vane pump body Ø120 mm → 0.2
//
// MECHANISM (researched — rotary-valve patents US5427134A / EP0585259B1,
// pump data from Saab WIS): the input shaft reaches the pinion only through a
// torsion bar. Driver torque twists it; full assist at ≈3.5° of twist. The
// spool (input side) turning inside the sleeve (pinion side) re-meters an
// OPEN-CENTRE hydraulic bridge: centred, pump flow passes straight to return
// at a few bar; twisted, one cylinder line is fed pressure (up to ≈100 bar)
// and the other opened to return. 100 bar on the ≈726 mm² annulus ≈ 7.3 kN.
// As the rack catches up with the driver the twist unwinds and the valve
// recentres — a follow-up servo.
//
// DISCLOSED EXAGGERATIONS / SIMPLIFICATIONS:
//   - torsion-bar twist is DRAWN at TWIST_VIS × (3.5° reads as 14°) — the
//     input shaft/steering wheel carry the same drawn twist (invisible at the
//     wheel against ~390° of rotation).
//   - the valve spool/sleeve are shown as a magnified section insert (rotated
//     to face the viewer, drawn relative to the sleeve), not inside the tower.
//   - no engine (a lone crank pulley on a stand drives the belt), no
//     suspension (the knuckles stand on the tyres), and the steering wheel is
//     closer to the axle than in a real car.
//
// SCALARS:
//   setCycle(u) — THE canonical lap: turn left, hold, sweep to the right
//     lock, hold, return to centre. Rack, pinion, wheel, twist, pressures all
//     derive from it; pump turns PUMP_TURNS and the oil loop LOOP_LAPS whole
//     laps per lap → seamless.
//   setIdle(u) — wheel centred, pump running (the open-centre step).
//   setReveal(t) — 0 sealed · 1 housings hidden (metal can't ghost), boots
//     and hoses ghosted, oil visible.
//   setInsert(v) — magnified valve section on/off.
//   setLabels(mode) — 'exterior' | 'rack' | 'pump' | 'torsion' | 'valve' |
//     'cylinder' | false.

// --- layout -------------------------------------------------------------------
const PLINTH_H = 0.26;
const TIRE_R = 1.085;
const WHEEL_Y = PLINTH_H + TIRE_R; // tyre centre / kingpin height
const KP_X = 2.45; // kingpin |x|
const TIRE_OFF = 0.15; // tyre centre outboard of the kingpin
const RACK_Y = 1.45;
const RACK_Z = -0.45;
const RACK_R = 0.043;
const RACK_HALF = 1.45; // inner ball joint |x| at centre
const HOUSING_HALF = 1.15;
const TUBE_R = 0.062;
const CYL0 = -0.97; // power-cylinder section
const CYL1 = 0.07;
const CYL_R = 0.09;
const BORE_R = 0.066;
const PISTON_LOCAL = -0.45; // piston position on the rack (rack-local x)
const PISTON_W = 0.06;
const PIN_X = 0.75;
const PIN_TEETH = 7;
const PITCH_R = 0.037;
const TOOTH_H = 0.016;
const PIN_Z = RACK_Z + RACK_R + TOOTH_H / 2 + PITCH_R; // pinion in FRONT of the rack (visible)
const ARM = [-0.1, 0.105, -0.45]; // steering arm, right side (x mirrors)
const AMP = 0.22;
const TWIST_MAX = (3.5 * Math.PI) / 180;
const TWIST_VIS = 4;
const PUMP_TURNS = 10; // pump pulley 0.2 : crank 0.25 → crank 8 whole turns
const CRANK_RATIO = 0.8;
const LOOP_LAPS = 2;
const P_BASE = 0.06; // open-centre idle pressure fraction (≈6 bar)

const PUMP_C = new THREE.Vector3(-1.0, 0.95, -1.47);
const CRANK_C = new THREE.Vector3(-1.55, 0.6, -1.72);
const BELT_Z = -1.72;
const WHEEL_C = new THREE.Vector3(PIN_X, 3.0, -2.0); // steering-wheel hub
const COL_DIR = new THREE.Vector3(0, -0.45, 1).normalize(); // wheel → front
const U1 = WHEEL_C.clone().addScaledVector(COL_DIR, 1.0);
const U2 = new THREE.Vector3(PIN_X, 2.08, PIN_Z);

const HOT = new THREE.Color(0xff5a1f);
const DIM = new THREE.Color(0x5a1418);

// canonical lap: centre → left lock → hold → right lock → hold → centre
function steerF(u) {
  u = ((u % 1) + 1) % 1;
  return win(u, 0.04, 0.22) - 2 * win(u, 0.34, 0.66) + win(u, 0.78, 0.96);
}
function steerDF(u) {
  const e = 1e-4;
  return (steerF(u + e) - steerF(u - e)) / (2 * e);
}
let VMAX = 0;
for (let i = 0; i < 2000; i++) VMAX = Math.max(VMAX, Math.abs(steerDF(i / 2000)));

const _Y = new THREE.Vector3(0, 1, 0);
function alignY(obj, from, to) {
  const d = new THREE.Vector3().subVectors(to, from);
  const len = d.length();
  obj.position.copy(from);
  obj.quaternion.setFromUnitVectors(_Y, d.multiplyScalar(1 / len));
  return len;
}

export function buildPowerSteering({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials ----------------------------------------------------------------
  const housingAl = materials.aluminum(0xb9bfc7);
  housingAl.roughness = 0.66;
  const rackChrome = materials.chrome(0xd4d9df);
  rackChrome.roughness = 0.4; // 0.24 blew a clipped streak along the bar in the rack step
  const steel = materials.steel(0xa9b0ba);
  steel.roughness = 0.42;
  const darkCast = materials.darkMetal(0x34383e);
  darkCast.roughness = 0.62;
  const standMat = materials.darkMetal(0x23262b);
  standMat.roughness = 0.6;
  const pumpPaint = materials.darkMetal(0x1e2024);
  pumpPaint.roughness = 0.5;
  const pulleyMat = materials.aluminum(0xaab0b8);
  pulleyMat.roughness = 0.55;
  const lineSteel = materials.darkMetal(0x464b53);
  lineSteel.roughness = 0.45;
  const tyreRubber = materials.rubber(0x17181b);
  const bootRubber = materials.rubber(0x141517);
  bootRubber.transparent = true;
  const hoseRubber = materials.rubber(0x121315);
  hoseRubber.transparent = true;
  const beltRubber = materials.rubber(0x101113);
  const wheelSteel = materials.aluminum(0xc6cbd1);
  wheelSteel.roughness = 0.52;
  const wheelGrip = materials.polymer(0x1a1b1e);
  const padPolymer = materials.polymer(0x202226);
  const reservoirMat = materials.polymer(0xd8d3c7);
  const capMat = materials.polymer(0x121316);
  const liner = new THREE.MeshStandardMaterial({ color: 0x17191c, roughness: 0.9, side: THREE.BackSide });
  const cavityMat = new THREE.MeshStandardMaterial({ color: 0x141518, roughness: 0.9 });
  const stripeMat = new THREE.MeshStandardMaterial({
    color: 0xff7a45,
    emissive: 0xff7a45,
    emissiveIntensity: 0.9,
    side: THREE.DoubleSide,
  });
  const markMat = stripeMat;
  // oil materials: colour driven by pressure every frame; depthWrite:false so a
  // faded one never punches holes (pre-flight #7)
  const oilMat = (opacity) =>
    new THREE.MeshStandardMaterial({
      color: DIM.clone(),
      emissive: DIM.clone(),
      emissiveIntensity: 0.9,
      roughness: 0.4,
      transparent: true,
      opacity,
      depthWrite: false,
    });
  function paintOil(mat, p) {
    mat.color.copy(DIM).lerp(HOT, p);
    mat.emissive.copy(DIM).lerp(HOT, p);
    mat.emissiveIntensity = 0.5 + 1.1 * p;
  }

  // --- plinth ---------------------------------------------------------------------
  const plinth = studioPlinth({ w: 6.6, h: PLINTH_H, d: 3.9 });
  plinth.position.z = -0.6;
  group.add(plinth);

  const housingMetal = []; // hidden outright on reveal (metal can't ghost)

  // ============================================================================
  //  RACK HOUSING + POWER CYLINDER + VALVE/PINION TOWER (fixed)
  // ============================================================================
  const housing = new THREE.Group();
  housing.position.set(0, RACK_Y, RACK_Z);
  group.add(housing);
  function xTube(r, x0, x1, mat, seg = 32) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, x1 - x0, seg), mat);
    m.rotation.z = Math.PI / 2;
    m.position.x = (x0 + x1) / 2;
    m.castShadow = true;
    return m;
  }
  const mainTube = xTube(TUBE_R, -HOUSING_HALF, HOUSING_HALF, housingAl);
  const cylTube = xTube(CYL_R, CYL0, CYL1, housingAl, 40);
  housing.add(mainTube, cylTube);
  housingMetal.push(mainTube, cylTube);
  // cylinder end collars + housing end lips
  for (const x of [CYL0, CYL1]) {
    const collar = xTube(CYL_R + 0.012, x - 0.025, x + 0.025, housingAl, 40);
    housing.add(collar);
    housingMetal.push(collar);
  }
  for (const s of [-1, 1]) {
    const lip = xTube(TUBE_R + 0.01, s * HOUSING_HALF - 0.03, s * HOUSING_HALF + 0.03, housingAl);
    lip.position.x = s * (HOUSING_HALF - 0.015);
    housing.add(lip);
    housingMetal.push(lip);
  }
  // line bosses on the cylinder ends
  for (const x of [CYL0 + 0.05, CYL1 - 0.05]) {
    const boss = rod(0.024, 0.05, housingAl, 14);
    boss.position.set(x, CYL_R - 0.01, 0);
    housing.add(boss);
    housingMetal.push(boss);
  }
  // mount clamps + posts down to the plinth
  for (const x of [-1.07, 0.4]) {
    const band = xTube(TUBE_R + 0.022, x - 0.045, x + 0.045, darkCast);
    housing.add(band);
    housingMetal.push(band);
    const post = rod(0.035, RACK_Y - TUBE_R - PLINTH_H, standMat, 16);
    post.position.set(x, PLINTH_H, RACK_Z);
    group.add(post);
    const foot = beveledBox(0.16, 0.03, 0.16, standMat, 0.01);
    foot.position.set(x, PLINTH_H + 0.015, RACK_Z);
    group.add(foot);
  }

  // valve / pinion tower
  const tower = lathe(
    [
      [0.001, 1.33],
      [0.095, 1.33],
      [0.098, 1.35],
      [0.098, 1.6],
      [0.118, 1.61],
      [0.118, 1.99],
      [0.1, 2.02],
      [0.04, 2.02],
      [0.04, 2.03],
      [0.001, 2.03],
    ],
    housingAl,
    40,
  );
  tower.position.set(PIN_X, 0, PIN_Z);
  group.add(tower);
  housingMetal.push(tower);
  const towerBolts = boltCircle(4, 0.105, 0.012, darkCast, 0.02);
  towerBolts.position.set(PIN_X, 2.02, PIN_Z);
  group.add(towerBolts);
  housingMetal.push(towerBolts);
  const PORTS = {
    press: new THREE.Vector3(0.7, 1.9, PIN_Z - 0.122),
    ret: new THREE.Vector3(0.82, 1.76, PIN_Z - 0.122),
    left: new THREE.Vector3(PIN_X - 0.122, 1.76, PIN_Z + 0.03),
    right: new THREE.Vector3(PIN_X - 0.122, 1.68, PIN_Z - 0.05),
  };
  for (const [k, p] of Object.entries(PORTS)) {
    const boss = rod(0.026, 0.04, housingAl, 14);
    if (k === 'press' || k === 'ret') boss.rotation.x = -Math.PI / 2; // +Y → -Z
    else boss.rotation.z = Math.PI / 2; // +Y → -X
    boss.position.copy(p).add(k === 'press' || k === 'ret' ? new THREE.Vector3(0, 0, 0.02) : new THREE.Vector3(0.02, 0, 0));
    group.add(boss);
    housingMetal.push(boss);
  }

  // ============================================================================
  //  RACK (slides along X) — bar, teeth, piston, inner ball joints
  // ============================================================================
  const rack = new THREE.Group();
  rack.position.set(0, RACK_Y, RACK_Z);
  group.add(rack);
  rack.add(xTube(RACK_R, -RACK_HALF, RACK_HALF, rackChrome, 28));
  // teeth on the front (+Z) face, where the pinion sits
  const pitch = (TAU * PITCH_R) / PIN_TEETH;
  const toothGeo = new THREE.BoxGeometry(pitch * 0.42, 0.05, TOOTH_H);
  for (let k = -11; k < 11; k++) {
    const t = new THREE.Mesh(toothGeo, steel);
    t.position.set(PIN_X + (k + 0.5) * pitch, 0, RACK_R + TOOTH_H / 2 - 0.004);
    rack.add(t);
  }
  const piston = xTube(BORE_R - 0.002, PISTON_LOCAL - PISTON_W / 2, PISTON_LOCAL + PISTON_W / 2, steel, 36);
  rack.add(piston);
  const pistonSeal = new THREE.Mesh(new THREE.TorusGeometry(BORE_R - 0.004, 0.006, 8, 36), bootRubber.clone());
  pistonSeal.material.transparent = false;
  pistonSeal.rotation.y = Math.PI / 2;
  pistonSeal.position.x = PISTON_LOCAL;
  rack.add(pistonSeal);
  for (const s of [-1, 1]) {
    const ball = new THREE.Mesh(new THREE.SphereGeometry(0.058, 20, 14), steel);
    ball.position.x = s * RACK_HALF;
    rack.add(ball);
  }

  // oil in the two cylinder chambers (annulus around the rack, scaled in X)
  const chamberGeo = new THREE.CylinderGeometry(BORE_R - 0.004, BORE_R - 0.004, 1, 32, 1, true);
  const chamberL = new THREE.Mesh(chamberGeo, oilMat(0.55));
  const chamberR = new THREE.Mesh(chamberGeo, oilMat(0.55));
  for (const c of [chamberL, chamberR]) {
    c.rotation.z = Math.PI / 2;
    housing.add(c);
  }

  // ============================================================================
  //  PINION + TORSION BAR + INPUT SHAFT (inside the tower)
  // ============================================================================
  const pinion = new THREE.Group();
  pinion.position.set(PIN_X, RACK_Y, PIN_Z);
  group.add(pinion);
  const pinionGear = gear({ teeth: PIN_TEETH, radius: PITCH_R + TOOTH_H / 2, thickness: 0.1, toothDepth: TOOTH_H }, steel);
  pinionGear.rotation.x = -Math.PI / 2; // shape XY → world XZ, extrusion → Y
  pinion.add(pinionGear);
  const pinStub = rod(0.026, 0.19, steel, 16);
  pinStub.position.y = -0.1;
  pinion.add(pinStub);
  const sleeveEnd = disc(0.075, 0.02, steel, 40); // pinion-side flange (sleeve end)
  sleeveEnd.position.y = 0.085;
  pinion.add(sleeveEnd);
  const pinMark = beveledBox(0.04, 0.024, 0.012, markMat, 0.004);
  pinMark.position.set(0.085, 0.085, 0);
  pinion.add(pinMark);

  const TB_Y0 = RACK_Y + 0.095;
  const TB_Y1 = 1.9;
  const TB_R = 0.014;
  const torsionBar = rod(TB_R, TB_Y1 - TB_Y0 + 0.02, steel, 16);
  torsionBar.position.set(PIN_X, TB_Y0 - 0.01, PIN_Z);
  group.add(torsionBar);
  // helical stripe: vertex positions rewritten each pose so the twist shows
  const STRIPE_N = 24;
  const stripeGeo = new THREE.BufferGeometry();
  const stripePos = new Float32Array((STRIPE_N + 1) * 2 * 3);
  stripeGeo.setAttribute('position', new THREE.BufferAttribute(stripePos, 3));
  const stripeIdx = [];
  for (let i = 0; i < STRIPE_N; i++) {
    const a = i * 2;
    stripeIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  stripeGeo.setIndex(stripeIdx);
  const stripe = new THREE.Mesh(stripeGeo, stripeMat);
  stripe.position.set(PIN_X, 0, PIN_Z);
  stripe.frustumCulled = false;
  group.add(stripe);
  function setStripe(base, twist) {
    const r = TB_R + 0.0012;
    for (let i = 0; i <= STRIPE_N; i++) {
      const f = i / STRIPE_N;
      const y = TB_Y0 + (TB_Y1 - TB_Y0) * f;
      const a = base + twist * f;
      for (let e = 0; e < 2; e++) {
        const b = a + (e ? 0.3 : -0.3);
        const o = (i * 2 + e) * 3;
        stripePos[o] = Math.cos(b) * r;
        stripePos[o + 1] = y;
        stripePos[o + 2] = -Math.sin(b) * r;
      }
    }
    stripeGeo.attributes.position.needsUpdate = true;
    stripeGeo.computeVertexNormals();
  }

  const input = new THREE.Group();
  input.position.set(PIN_X, TB_Y1 + 0.01, PIN_Z);
  group.add(input);
  const spoolEnd = disc(0.075, 0.02, steel, 40); // input-side flange (spool end)
  spoolEnd.position.y = -0.01;
  input.add(spoolEnd);
  const inMark = beveledBox(0.04, 0.024, 0.012, markMat, 0.004);
  inMark.position.set(0.085, 0, 0);
  input.add(inMark);
  const inShaft = rod(0.03, U2.y - (TB_Y1 + 0.01), steel, 18);
  input.add(inShaft);

  // ============================================================================
  //  STEERING COLUMN + INTERMEDIATE SHAFT + WHEEL
  // ============================================================================
  // intermediate shaft U2 → U1, spinning about its own axis
  const midShaft = new THREE.Group();
  const midLen = alignY(midShaft, U2, U1);
  group.add(midShaft);
  const midSpin = new THREE.Group();
  midShaft.add(midSpin);
  midSpin.add(rod(0.024, midLen, steel, 16));
  const midKey = beveledBox(0.012, midLen * 0.6, 0.05, darkCast, 0.004);
  midKey.position.set(0, midLen * 0.5, 0);
  midSpin.add(midKey);
  // universal joints: a yoke block + spider at each end
  const ujoints = [];
  for (const y of [0.02, midLen - 0.02]) {
    const uj = new THREE.Group();
    uj.position.y = y;
    const spiderA = rod(0.012, 0.1, steel, 10);
    spiderA.rotation.z = Math.PI / 2;
    spiderA.position.x = -0.05;
    const spiderB = rod(0.012, 0.1, steel, 10);
    spiderB.rotation.x = Math.PI / 2;
    spiderB.position.z = -0.05;
    const hubBlock = beveledBox(0.06, 0.06, 0.06, darkCast, 0.01);
    uj.add(spiderA, spiderB, hubBlock);
    midSpin.add(uj);
    ujoints.push(uj);
  }

  // upper column shroud (fixed) from the wheel down to U1
  const shroud = new THREE.Group();
  const shroudA = WHEEL_C.clone().addScaledVector(COL_DIR, 0.16);
  const shroudLen = alignY(shroud, shroudA, U1.clone().addScaledVector(COL_DIR, -0.05));
  group.add(shroud);
  const shroudBody = lathe(
    [
      [0.001, 0],
      [0.1, 0],
      [0.1, 0.24],
      [0.07, 0.3],
      [0.066, shroudLen],
      [0.001, shroudLen],
    ],
    padPolymer,
    32,
  );
  shroud.add(shroudBody);
  // stand post holding the column
  const colMount = WHEEL_C.clone().addScaledVector(COL_DIR, 0.42);
  const colPost = rod(0.04, colMount.y - 0.07 - PLINTH_H, standMat, 16);
  colPost.position.set(colMount.x, PLINTH_H, colMount.z);
  group.add(colPost);
  const colFoot = beveledBox(0.2, 0.03, 0.2, standMat, 0.01);
  colFoot.position.set(colMount.x, PLINTH_H + 0.015, colMount.z);
  group.add(colFoot);
  const colClamp = beveledBox(0.16, 0.1, 0.2, standMat, 0.02);
  colClamp.position.set(colMount.x, colMount.y - 0.07, colMount.z);
  group.add(colClamp);

  // steering wheel: holder Y axis points from the hub toward the driver
  const wheelHold = new THREE.Group();
  alignY(wheelHold, WHEEL_C, WHEEL_C.clone().addScaledVector(COL_DIR, -1));
  group.add(wheelHold);
  const wheelSpin = new THREE.Group();
  wheelHold.add(wheelSpin);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.6, 0.048, 18, 72), wheelGrip);
  rim.rotation.x = Math.PI / 2;
  rim.castShadow = true;
  wheelSpin.add(rim);
  for (const a of [Math.PI / 2 + Math.PI, Math.PI / 2 + Math.PI + (2 * Math.PI) / 3, Math.PI / 2 + Math.PI - (2 * Math.PI) / 3]) {
    const spoke = beveledBox(0.44, 0.03, 0.1, padPolymer, 0.012);
    spoke.position.set(Math.cos(a) * 0.36, 0.02, Math.sin(a) * 0.36);
    spoke.rotation.y = -a;
    wheelSpin.add(spoke);
  }
  const hubPad = lathe(
    [
      [0.001, 0.09],
      [0.13, 0.08],
      [0.17, 0.04],
      [0.17, -0.02],
      [0.001, -0.02],
    ],
    padPolymer,
    40,
  );
  wheelSpin.add(hubPad);
  const wheelMark = beveledBox(0.012, 0.02, 0.06, markMat, 0.004);
  wheelMark.position.set(0, 0.02, -0.6);
  wheelSpin.add(wheelMark);

  // ============================================================================
  //  FRONT CORNERS — knuckle, steering arm, wheel + tyre (pivot at kingpin)
  // ============================================================================
  function buildCorner(s) {
    const pivot = new THREE.Group();
    pivot.position.set(s * KP_X, WHEEL_Y, 0);
    group.add(pivot);
    const wheel = new THREE.Group();
    wheel.position.x = s * TIRE_OFF;
    pivot.add(wheel);
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.87, 0.215, 22, 72), tyreRubber);
    torus.rotation.y = Math.PI / 2;
    torus.castShadow = true;
    const tread = new THREE.Mesh(new THREE.CylinderGeometry(TIRE_R, TIRE_R, 0.36, 72, 1, true), tyreRubber);
    tread.rotation.z = Math.PI / 2;
    tread.castShadow = true;
    wheel.add(torus, tread);
    // tread grooves (four circumferential rings)
    for (const gx of [-0.12, -0.04, 0.04, 0.12]) {
      const groove = new THREE.Mesh(new THREE.TorusGeometry(TIRE_R + 0.001, 0.008, 6, 96), capMat);
      groove.rotation.y = Math.PI / 2;
      groove.position.x = gx;
      wheel.add(groove);
    }
    // wheel barrel: FrontSide metal + dark BackSide liner (no concave mirror)
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.68, 0.68, 0.36, 48, 1, true), wheelSteel);
    barrel.rotation.z = Math.PI / 2;
    const barrelLiner = new THREE.Mesh(new THREE.CylinderGeometry(0.675, 0.675, 0.36, 48, 1, true), liner);
    barrelLiner.rotation.z = Math.PI / 2;
    wheel.add(barrel, barrelLiner);
    // wheel face: disc with five windows + hub, on the outboard side
    const face = new THREE.Shape();
    face.absarc(0, 0, 0.69, 0, TAU, false);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU;
      const h = new THREE.Path();
      h.absarc(Math.cos(a) * 0.44, Math.sin(a) * 0.44, 0.13, 0, TAU, true);
      face.holes.push(h);
    }
    const faceMesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(face, { depth: 0.03, bevelEnabled: true, bevelThickness: 0.01, bevelSize: 0.01, bevelSegments: 1, curveSegments: 40 }),
      wheelSteel,
    );
    faceMesh.rotation.y = (s * Math.PI) / 2;
    faceMesh.position.x = s * 0.1;
    faceMesh.castShadow = true;
    wheel.add(faceMesh);
    const hubCap = lathe(
      [
        [0.001, 0.07],
        [0.1, 0.05],
        [0.16, 0],
        [0.001, 0],
      ],
      wheelSteel,
      32,
    );
    hubCap.rotation.z = (-s * Math.PI) / 2;
    hubCap.position.x = s * 0.13;
    wheel.add(hubCap);
    const lugs = boltCircle(5, 0.2, 0.022, steel, 0.05);
    lugs.rotation.z = (-s * Math.PI) / 2;
    lugs.position.x = s * 0.13;
    wheel.add(lugs);
    // brake disc + knuckle inside the barrel
    const rotor = disc(0.52, 0.05, materials.brushedSteel(0x9ea4ab), 48);
    rotor.rotation.z = Math.PI / 2;
    rotor.position.x = s * -0.06;
    rotor.material.roughness = 0.6;
    pivot.add(rotor);
    const knuckle = beveledBox(0.12, 0.46, 0.2, darkCast, 0.03);
    knuckle.position.x = s * -0.14;
    pivot.add(knuckle);
    // steering arm: knuckle → tie-rod end
    const tipLocal = new THREE.Vector3(s * ARM[0], ARM[1], ARM[2]);
    const armHold = new THREE.Group();
    const armLen = alignY(armHold, new THREE.Vector3(s * -0.14, 0.02, -0.06), tipLocal);
    const armBody = beveledBox(0.05, armLen, 0.07, darkCast, 0.015);
    armBody.position.y = armLen / 2;
    armHold.add(armBody);
    pivot.add(armHold);
    const tieEnd = new THREE.Mesh(new THREE.SphereGeometry(0.038, 16, 12), steel);
    tieEnd.position.copy(tipLocal);
    pivot.add(tieEnd);
    // tie rod (world frame, re-aimed every pose)
    const tie = new THREE.Group();
    group.add(tie);
    const tieRod = rod(0.022, 1, steel, 14);
    tie.add(tieRod);
    const tieSleeve = rod(0.032, 0.18, darkCast, 14); // adjuster sleeve near the outer end
    tie.add(tieSleeve);
    return { pivot, wheel, tie, tieRod, tieSleeve, tipLocal, s };
  }
  const corners = [buildCorner(-1), buildCorner(1)];
  // tie-rod length from the centred geometry
  const _tip = new THREE.Vector3();
  const _J = new THREE.Vector3();
  function tipAt(c, th, out) {
    const a = c.tipLocal;
    return out.set(
      c.pivot.position.x + a.x * Math.cos(th) + a.z * Math.sin(th),
      c.pivot.position.y + a.y,
      c.pivot.position.z - a.x * Math.sin(th) + a.z * Math.cos(th),
    );
  }
  for (const c of corners) {
    _J.set(c.s * RACK_HALF, RACK_Y, RACK_Z);
    c.L = tipAt(c, 0, _tip).distanceTo(_J);
  }
  function solveCorner(c, rackX) {
    _J.set(c.s * RACK_HALF + rackX, RACK_Y, RACK_Z);
    const f = (th) => tipAt(c, th, _tip).distanceTo(_J) - c.L;
    let lo = -0.9;
    let hi = 0.9;
    const flo = f(lo);
    for (let i = 0; i < 30; i++) {
      const mid = (lo + hi) / 2;
      if (Math.sign(f(mid)) === Math.sign(flo)) lo = mid;
      else hi = mid;
    }
    const th = (lo + hi) / 2;
    c.pivot.rotation.y = th;
    const tip = tipAt(c, th, new THREE.Vector3());
    const len = alignY(c.tie, _J, tip);
    c.tieRod.scale.y = len;
    c.tieSleeve.position.y = len - 0.3;
    return th;
  }

  // rubber boots (bellows) — housing end → tie rod, stretch with the rack
  const bootGeo = (() => {
    const prof = [[0.064, 0]];
    const n = 9;
    for (let i = 1; i < n; i++) prof.push([i % 2 ? 0.1 : 0.072, i / n]);
    prof.push([0.036, 0.97], [0.034, 1]);
    return new THREE.LatheGeometry(prof.map(([r, y]) => new THREE.Vector2(r, y)), 32);
  })();
  const boots = [-1, 1].map((s) => {
    const b = new THREE.Mesh(bootGeo, bootRubber);
    b.rotation.z = (-s * Math.PI) / 2; // +Y → ±X
    b.castShadow = true;
    housing.add(b);
    return { mesh: b, s };
  });

  // ============================================================================
  //  VANE PUMP + PULLEYS + BELT + RESERVOIR
  // ============================================================================
  const pump = new THREE.Group();
  pump.position.copy(PUMP_C);
  group.add(pump);
  const zTube = (r, z0, z1, mat, seg = 40) => {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, z1 - z0, seg), mat);
    m.rotation.x = Math.PI / 2;
    m.position.z = (z0 + z1) / 2;
    m.castShadow = true;
    return m;
  };
  // local z: front face at +0.17, pulley side at -0.25
  const FRONT = 0.17;
  pump.add(zTube(0.2, -0.17, FRONT - 0.055, pumpPaint));
  // cam ring (front section of the body) with its double-lobe bore
  const camR = (a) => 0.108 + 0.024 * Math.sin(a) ** 2;
  const camShape = new THREE.Shape();
  camShape.absarc(0, 0, 0.2, 0, TAU, false);
  const camHole = new THREE.Path();
  for (let i = 0; i <= 96; i++) {
    const a = -(i / 96) * TAU;
    const r = camR(a);
    if (i === 0) camHole.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else camHole.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  camShape.holes.push(camHole);
  const camRing = new THREE.Mesh(new THREE.ExtrudeGeometry(camShape, { depth: 0.05, bevelEnabled: false, curveSegments: 48 }), pumpPaint);
  camRing.position.z = FRONT - 0.055;
  pump.add(camRing);
  const cavity = disc(0.14, 0.01, cavityMat, 40);
  cavity.rotation.x = Math.PI / 2;
  cavity.position.z = FRONT - 0.055;
  pump.add(cavity);
  const pumpOil = new THREE.Mesh(new THREE.CircleGeometry(0.135, 48), oilMat(0.8));
  pumpOil.position.z = FRONT - 0.044;
  pump.add(pumpOil);
  const rotor = new THREE.Group();
  rotor.position.z = FRONT - 0.03;
  pump.add(rotor);
  const rotorDisc = disc(0.094, 0.045, steel, 40);
  rotorDisc.rotation.x = Math.PI / 2;
  rotor.add(rotorDisc);
  const rotorHub = disc(0.03, 0.05, darkCast, 20);
  rotorHub.rotation.x = Math.PI / 2;
  rotor.add(rotorHub);
  const VANES = 10;
  const vanes = [];
  for (let i = 0; i < VANES; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(1, 0.012, 0.042), steel);
    rotor.add(v);
    vanes.push({ mesh: v, a0: (i / VANES) * TAU });
  }
  // front cover (hidden on reveal) with bolts
  const cover = zTube(0.2, FRONT - 0.005, FRONT + 0.03, pumpPaint);
  pump.add(cover);
  const coverBolts = boltCircle(6, 0.165, 0.014, darkCast, 0.02);
  coverBolts.rotation.x = Math.PI / 2;
  coverBolts.position.z = FRONT + 0.035;
  pump.add(coverBolts);
  const coverParts = [cover, coverBolts];
  // outlet boss (+X side) and pump bracket
  const outlet = rod(0.03, 0.06, pumpPaint, 14);
  outlet.rotation.z = -Math.PI / 2;
  outlet.position.set(0.19, 0.03, 0.02);
  pump.add(outlet);
  const bracket = beveledBox(0.26, PUMP_C.y - 0.18 - PLINTH_H, 0.3, standMat, 0.02);
  bracket.position.set(0, -(PUMP_C.y - PLINTH_H) / 2 - 0.09, -0.02);
  pump.add(bracket);
  // pump shaft + pulley (belt plane)
  const pumpShaft = zTube(0.025, BELT_Z - PUMP_C.z - 0.03, -0.17, steel, 14);
  pump.add(pumpShaft);
  function pulley(r, holes) {
    const sh = new THREE.Shape();
    sh.absarc(0, 0, r, 0, TAU, false);
    for (let i = 0; i < holes; i++) {
      const a = (i / holes) * TAU;
      const h = new THREE.Path();
      h.absarc(Math.cos(a) * r * 0.55, Math.sin(a) * r * 0.55, r * 0.22, 0, TAU, true);
      sh.holes.push(h);
    }
    const m = new THREE.Mesh(
      new THREE.ExtrudeGeometry(sh, { depth: 0.05, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 1, curveSegments: 40 }),
      pulleyMat,
    );
    m.geometry.translate(0, 0, -0.025);
    m.castShadow = true;
    return m;
  }
  const pumpPulley = pulley(0.2, 3);
  pumpPulley.position.set(PUMP_C.x, PUMP_C.y, BELT_Z);
  group.add(pumpPulley);
  const crankPulley = pulley(0.25, 4);
  crankPulley.position.copy(CRANK_C);
  group.add(crankPulley);
  const crankStand = beveledBox(0.18, CRANK_C.y - PLINTH_H + 0.06, 0.18, standMat, 0.02);
  crankStand.position.set(CRANK_C.x, (CRANK_C.y + PLINTH_H + 0.06) / 2 - 0.03, CRANK_C.z - 0.14);
  group.add(crankStand);
  const crankShaft = zTube(0.03, CRANK_C.z - 0.2, CRANK_C.z + 0.03, steel, 14);
  crankShaft.position.x = CRANK_C.x;
  crankShaft.position.y = CRANK_C.y;
  group.add(crankShaft);
  // belt = convex hull of the two pulley circles (exactly the belt path)
  {
    const pts = [];
    for (const [c, r] of [
      [PUMP_C, 0.212],
      [CRANK_C, 0.262],
    ]) {
      for (let i = 0; i < 180; i++) {
        const a = (i / 180) * TAU;
        pts.push([c.x + Math.cos(a) * r, c.y + Math.sin(a) * r]);
      }
    }
    pts.sort((p, q) => p[0] - q[0] || p[1] - q[1]);
    const cross = (o, a, b) => (a[0] - o[0]) * (b[1] - o[1]) - (a[1] - o[1]) * (b[0] - o[0]);
    const lower = [];
    for (const p of pts) {
      while (lower.length >= 2 && cross(lower[lower.length - 2], lower[lower.length - 1], p) <= 0) lower.pop();
      lower.push(p);
    }
    const upper = [];
    for (let i = pts.length - 1; i >= 0; i--) {
      const p = pts[i];
      while (upper.length >= 2 && cross(upper[upper.length - 2], upper[upper.length - 1], p) <= 0) upper.pop();
      upper.push(p);
    }
    const hull = lower.slice(0, -1).concat(upper.slice(0, -1));
    const curve = new THREE.CatmullRomCurve3(hull.map(([x, y]) => new THREE.Vector3(x, y, 0)), true, 'centripetal');
    const belt = new THREE.Mesh(new THREE.TubeGeometry(curve, 240, 0.012, 6, true), beltRubber);
    belt.scale.z = 2.2;
    belt.position.z = BELT_Z;
    belt.castShadow = true;
    group.add(belt);
  }
  // reservoir on top of the pump
  const reservoir = lathe(
    [
      [0.001, 0.2],
      [0.05, 0.2],
      [0.05, 0.23],
      [0.12, 0.25],
      [0.125, 0.28],
      [0.125, 0.47],
      [0.11, 0.5],
      [0.001, 0.5],
    ],
    reservoirMat,
    40,
  );
  reservoir.position.set(0, 0, 0);
  pump.add(reservoir);
  const cap = lathe(
    [
      [0.001, 0.5],
      [0.07, 0.5],
      [0.07, 0.55],
      [0.06, 0.56],
      [0.001, 0.56],
    ],
    capMat,
    24,
  );
  pump.add(cap);
  const resInlet = rod(0.022, 0.05, reservoirMat, 12);
  resInlet.rotation.z = -Math.PI / 2;
  resInlet.position.set(0.12, 0.38, 0);
  pump.add(resInlet);

  // ============================================================================
  //  HOSES + CYLINDER LINES (+ glowing oil cores shown on reveal)
  // ============================================================================
  const v3 = (x, y, z) => [x, y, z];
  const pressPts = [
    v3(PUMP_C.x + 0.25, PUMP_C.y + 0.03, PUMP_C.z + 0.02),
    v3(-0.5, 1.02, -1.4),
    v3(0.05, 1.15, -1.22),
    v3(0.5, 1.5, -0.98),
    v3(0.7, 1.86, -0.8),
    v3(PORTS.press.x, PORTS.press.y, PORTS.press.z - 0.02),
  ];
  const retPts = [
    v3(PORTS.ret.x, PORTS.ret.y, PORTS.ret.z - 0.02),
    v3(0.85, 1.62, -0.86),
    v3(0.35, 1.5, -1.22),
    v3(-0.45, 1.46, -1.5),
    v3(PUMP_C.x + 0.15, PUMP_C.y + 0.38, PUMP_C.z),
  ];
  const suctionPts = [
    v3(PUMP_C.x + 0.15, PUMP_C.y + 0.38, PUMP_C.z),
    v3(PUMP_C.x, PUMP_C.y + 0.3, PUMP_C.z),
    v3(PUMP_C.x, PUMP_C.y + 0.1, PUMP_C.z),
    v3(PUMP_C.x + 0.12, PUMP_C.y + 0.03, PUMP_C.z + 0.02),
    pressPts[0],
  ];
  const lineLPts = [
    v3(PORTS.left.x - 0.02, PORTS.left.y, PORTS.left.z),
    v3(0.5, 1.72, -0.36),
    v3(0.25, 1.62, -0.4),
    v3(-0.4, 1.6, -0.4),
    v3(-0.84, 1.6, -0.43),
    v3(CYL0 + 0.05, RACK_Y + CYL_R + 0.02, RACK_Z),
  ];
  const lineRPts = [
    v3(PORTS.right.x - 0.02, PORTS.right.y, PORTS.right.z),
    v3(0.45, 1.66, -0.52),
    v3(0.2, 1.63, -0.52),
    v3(0.08, 1.6, -0.49),
    v3(CYL1 - 0.05, RACK_Y + CYL_R + 0.02, RACK_Z),
  ];
  const pressHose = tubeAlong(pressPts, 0.036, hoseRubber, { tubularSegments: 90, radialSegments: 14 });
  const retHose = tubeAlong(retPts, 0.036, hoseRubber, { tubularSegments: 90, radialSegments: 14 });
  const lineL = tubeAlong(lineLPts, 0.016, lineSteel, { tubularSegments: 80, radialSegments: 10 });
  const lineR = tubeAlong(lineRPts, 0.016, lineSteel, { tubularSegments: 60, radialSegments: 10 });
  group.add(pressHose, retHose, lineL, lineR);
  const coreMats = { press: oilMat(0.95), ret: oilMat(0.95), left: oilMat(0.95), right: oilMat(0.95) };
  const pressCore = tubeAlong(pressPts, 0.02, coreMats.press, { tubularSegments: 90, radialSegments: 10 });
  const retCore = tubeAlong(retPts, 0.02, coreMats.ret, { tubularSegments: 90, radialSegments: 10 });
  const lineLCore = tubeAlong(lineLPts, 0.013, coreMats.left, { tubularSegments: 80, radialSegments: 8 });
  const lineRCore = tubeAlong(lineRPts, 0.013, coreMats.right, { tubularSegments: 60, radialSegments: 8 });
  const cores = [pressCore, retCore, lineLCore, lineRCore];
  for (const c of cores) {
    c.castShadow = false;
    group.add(c);
  }

  // oil packets: one loop pump → valve → reservoir → pump, plus the two lines
  const loop = chainPath([pressPts, retPts, suctionPts], { tension: 0.5 });
  const LOOP_N = 46;
  const loopDots = flowField(LOOP_N, 0.04, { opacity: 0.95 });
  group.add(loopDots.mesh);
  const LINE_N = 9;
  const lineDotsL = flowField(LINE_N, 0.03, { opacity: 0.95 });
  const lineDotsR = flowField(LINE_N, 0.03, { opacity: 0.95 });
  group.add(lineDotsL.mesh, lineDotsR.mesh);
  const curveL = lineL.userData.curve;
  const curveR = lineR.userData.curve;

  // ============================================================================
  //  MAGNIFIED VALVE SECTION (insert)
  // ============================================================================
  const insert = new THREE.Group();
  insert.position.set(1.42, 2.42, -0.2);
  group.add(insert);
  const INS_CAM = new THREE.Vector3(1.9, 2.75, 2.3); // faces the valve step camera
  insert.lookAt(INS_CAM);
  const SLOT_S = (16 * Math.PI) / 180; // sleeve slot half-width
  const SLOT_P = (18.5 * Math.PI) / 180; // spool slot half-width
  const PITCH_A = Math.PI / 4;
  const inSlot = (a, centre0, half) => {
    const x = (((a - centre0) % PITCH_A) + PITCH_A) % PITCH_A;
    return x < half || x > PITCH_A - half;
  };
  function radialShape(rOuter, rInner, N = 720) {
    const sh = new THREE.Shape();
    for (let i = 0; i <= N; i++) {
      const a = (i / N) * TAU;
      const r = rOuter(a);
      if (i === 0) sh.moveTo(Math.cos(a) * r, Math.sin(a) * r);
      else sh.lineTo(Math.cos(a) * r, Math.sin(a) * r);
    }
    if (rInner) {
      const h = new THREE.Path();
      for (let i = 0; i <= N; i++) {
        const a = -(i / N) * TAU;
        const r = rInner(a);
        if (i === 0) h.moveTo(Math.cos(a) * r, Math.sin(a) * r);
        else h.lineTo(Math.cos(a) * r, Math.sin(a) * r);
      }
      sh.holes.push(h);
    }
    return sh;
  }
  const insMetal = materials.steel(0xb3bac3);
  insMetal.roughness = 0.5;
  const insSpoolMat = materials.steel(0xd0d5db);
  insSpoolMat.roughness = 0.4;
  const sleeveSec = new THREE.Mesh(
    new THREE.ExtrudeGeometry(
      radialShape(
        () => 0.36,
        (a) => (inSlot(a, 0, SLOT_S) ? 0.31 : 0.25),
      ),
      { depth: 0.04, bevelEnabled: false },
    ),
    insMetal,
  );
  insert.add(sleeveSec);
  const housingSec = new THREE.Mesh(
    new THREE.ExtrudeGeometry(
      radialShape(
        () => 0.44,
        () => 0.365,
        96,
      ),
      { depth: 0.04, bevelEnabled: false },
    ),
    materials.darkMetal(0x5d636b), // map-free: extruded UVs sample garbage (read as smoke)
  );
  insert.add(housingSec);
  const lensRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.45, 0.008, 8, 96),
    new THREE.MeshStandardMaterial({ color: 0xff7a45, emissive: 0xff7a45, emissiveIntensity: 1.2 }),
  );
  lensRing.position.z = 0.04;
  insert.add(lensRing);
  const backPlate = new THREE.Mesh(new THREE.CircleGeometry(0.44, 64), cavityMat);
  backPlate.position.z = -0.002;
  insert.add(backPlate);
  // sleeve-groove oil (A = left chamber at even slots, B = right at odd)
  const sectorGeo = (r0, r1, a0, a1) => new THREE.RingGeometry(r0, r1, 16, 1, a0, a1 - a0).translate(0, 0, 0.041);
  const oilA = oilMat(1);
  const oilB = oilMat(1);
  const oilP = oilMat(1);
  const oilR = oilMat(1);
  for (let k = 0; k < 8; k++) {
    const c = k * PITCH_A;
    const g = new THREE.RingGeometry(0.25, 0.31, 16, 1, c - SLOT_S, 2 * SLOT_S);
    g.translate(0, 0, 0.041);
    insert.add(new THREE.Mesh(g, k % 2 ? oilB : oilA));
  }
  const spool = new THREE.Group();
  insert.add(spool);
  const spoolSec = new THREE.Mesh(
    new THREE.ExtrudeGeometry(
      radialShape(
        (a) => (inSlot(a, PITCH_A / 2, SLOT_P) ? 0.19 : 0.247),
        () => 0.05,
      ),
      { depth: 0.046, bevelEnabled: false },
    ),
    insSpoolMat,
  );
  spool.add(spoolSec);
  for (let k = 0; k < 8; k++) {
    const c = PITCH_A / 2 + k * PITCH_A;
    spool.add(new THREE.Mesh(sectorGeo(0.19, 0.25, c - SLOT_P, c + SLOT_P).translate(0, 0, 0.006), k % 2 ? oilR : oilP));
  }
  const barSec = disc(0.042, 0.05, steel, 24);
  barSec.rotation.x = Math.PI / 2;
  barSec.position.z = 0.02;
  insert.add(barSec);
  // leader from the tower to the insert
  const leader = tubeAlong(
    [
      [PIN_X + 0.06, 1.95, PIN_Z + 0.06],
      [1.0, 2.15, -0.35],
      [insert.position.x - 0.2, insert.position.y - 0.2, insert.position.z + 0.05],
    ],
    0.006,
    new THREE.MeshStandardMaterial({ color: 0xff7a45, emissive: 0xff7a45, emissiveIntensity: 0.8, transparent: true, opacity: 0.6, depthWrite: false }),
  );
  leader.castShadow = false;
  group.add(leader);

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const labels = calloutSets(['exterior', 'rack', 'pump', 'torsion', 'valve', 'cylinder']);
  labels.add('exterior', wheelHold, 'Steering wheel', [0.6, 0.05, 0], 30, 56);
  labels.add('exterior', housing, 'Steering rack', [-0.5, CYL_R, 0], 70, 60);
  labels.add('exterior', pump, 'Power-steering pump', [0.2, -0.05, 0.1], -30, 60);
  labels.add('exterior', pump, 'Oil reservoir', [0.1, 0.45, 0], 60, 50);
  labels.add('exterior', corners[1].wheel, 'Front tyre', [0.2, 0.7, 0.6], 40, 50);

  labels.add('rack', group, 'Pinion — 7 teeth', [PIN_X, RACK_Y - 0.03, PIN_Z + PITCH_R], -40, 60);
  labels.add('rack', rack, 'Rack', [1.0, RACK_R, 0], 70, 60);
  labels.add('rack', corners[1].tie, 'Tie rod', [0, 0.5, 0], 60, 56);
  labels.add('rack', corners[1].pivot, 'Steering arm', [-0.12, 0.07, -0.26], 20, 60);

  labels.add('pump', rotor, 'Vane rotor', [0, 0.06, 0.03], 50, 60);
  labels.add('pump', pump, 'Cam ring', [0.17, -0.08, FRONT - 0.03], -20, 60);
  labels.add('pump', pump, 'Oil back to the reservoir', [0.12, 0.38, 0], 70, 56);
  labels.add('pump', pressHose, 'Pressure hose', [0.05, 1.15, -1.22], 60, 60);

  labels.add('torsion', input, 'Input shaft — from your wheel', [0, 0.12, 0.03], 25, 60);
  labels.add('torsion', torsionBar, 'Torsion bar', [TB_R, 1.72 - (TB_Y0 - 0.01), 0], -10, 70);
  labels.add('torsion', group, 'Pinion', [PIN_X + PITCH_R, RACK_Y - 0.02, PIN_Z + 0.02], -40, 60);
  const twistT = labels.add('torsion', group, 'Twist 0.0°', [PIN_X + 0.075, TB_Y1, PIN_Z], 10, 90);

  labels.add('valve', spool, 'Spool — turns with your wheel', [0.12, 0.17, 0.05], 30, 50);
  labels.add('valve', insert, 'Sleeve — turns with the pinion', [0.3, -0.18, 0.04], -20, 50);
  labels.add('valve', insert, 'Groove to the left chamber', [0.28, 0, 0.04], 10, 60);
  labels.add('valve', insert, 'Torsion bar', [0, 0, 0.05], 250, 40);

  labels.add('cylinder', rack, 'Piston — fixed to the rack', [PISTON_LOCAL, BORE_R, 0], 70, 60);
  labels.add('cylinder', housing, 'Left chamber', [CYL0 + 0.12, -BORE_R, 0], -60, 50);
  labels.add('cylinder', housing, 'Right chamber', [CYL1 - 0.12, -BORE_R, 0], -60, 50);
  const twistC = labels.add('cylinder', group, 'Twist 0.0°', [PIN_X, 1.8, PIN_Z + 0.02], 40, 60);
  const pressC = labels.add('cylinder', group, 'Pressure 0 bar', [-0.75, RACK_Y + CYL_R, RACK_Z], 80, 70);
  const readouts = { twist: [twistT, twistC], press: [pressC] };

  // ============================================================================
  //  POSE
  // ============================================================================
  const _p = new THREE.Vector3();
  const _t = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _col = new THREE.Color();
  const _hidden = new THREE.Vector3(0, -50, 0);
  let revealed = false;

  function placeDots(field, n, curve, phase, color, visibleUntil = 1) {
    for (let i = 0; i < n; i++) {
      const t = (((i / n + phase) % 1) + 1) % 1;
      if (!revealed || t > visibleUntil) {
        field.set(i, _hidden, _q.identity(), 0.0001);
        continue;
      }
      _p.copy(curve.getPointAt(t));
      _t.copy(curve.getTangentAt(t));
      _q.setFromUnitVectors(_Y, _t.normalize());
      const c = typeof color === 'function' ? color(t) : color;
      field.set(i, _p, _q, 1, c);
    }
    field.commit();
  }

  function pose(u, amp) {
    u = ((u % 1) + 1) % 1;
    const f = steerF(u);
    const rackX = amp * f;
    const drive = amp / AMP;
    const tw = Math.max(-1, Math.min(1, (0.9 * steerDF(u)) / VMAX + 0.2 * f)) * drive;

    // rack + boots
    rack.position.x = rackX;
    for (const b of boots) {
      const start = b.s * (HOUSING_HALF - 0.02);
      const end = b.s * (RACK_HALF + 0.06) + rackX;
      b.mesh.position.x = start;
      b.mesh.scale.y = Math.abs(end - start);
    }
    // pinion, torsion bar, input, column, wheel
    // tooth at local +x points −Z (into the rack) at π/2; contact on the −Z
    // side, so +rack travel turns the pinion NEGATIVE about Y and the input
    // leads it further the same way
    const pinAng = Math.PI / 2 - rackX / PITCH_R;
    const twistVis = tw * TWIST_MAX * TWIST_VIS;
    const inAng = pinAng - twistVis;
    pinion.rotation.y = pinAng;
    input.rotation.y = inAng;
    setStripe(pinAng, -twistVis);
    midSpin.rotation.y = inAng;
    wheelSpin.rotation.y = -inAng;
    // knuckles
    for (const c of corners) solveCorner(c, rackX);

    // hydraulics
    const pL = P_BASE + (1 - P_BASE) * Math.max(0, tw) ** 1.5;
    const pR = P_BASE + (1 - P_BASE) * Math.max(0, -tw) ** 1.5;
    const pSys = Math.max(pL, pR);
    paintOil(chamberL.material, pL);
    paintOil(chamberR.material, pR);
    paintOil(coreMats.left, pL);
    paintOil(coreMats.right, pR);
    paintOil(coreMats.press, pSys);
    paintOil(coreMats.ret, 0.02);
    paintOil(pumpOil.material, pSys * 0.8);
    paintOil(oilA, pL);
    paintOil(oilB, pR);
    paintOil(oilP, pSys);
    paintOil(oilR, 0.02);
    // chambers between cylinder ends and the piston faces
    const pistonX = PISTON_LOCAL + rackX;
    const l0 = CYL0 + 0.03;
    const l1 = pistonX - PISTON_W / 2;
    chamberL.position.x = (l0 + l1) / 2;
    chamberL.scale.y = l1 - l0;
    const r0 = pistonX + PISTON_W / 2;
    const r1 = CYL1 - 0.03;
    chamberR.position.x = (r0 + r1) / 2;
    chamberR.scale.y = r1 - r0;
    // valve section: spool turns against the sleeve (−twist feeds groove A)
    spool.rotation.z = -tw * ((12 * Math.PI) / 180);

    // pump + belt drive
    const pumpAng = u * PUMP_TURNS * TAU;
    rotor.rotation.z = -pumpAng;
    for (const v of vanes) {
      const aw = v.a0 - pumpAng; // world angle of this vane
      const tipR = camR(aw) - 0.003;
      const r0v = 0.06;
      v.mesh.scale.x = tipR - r0v;
      v.mesh.position.set(Math.cos(v.a0) * (r0v + tipR) / 2, Math.sin(v.a0) * (r0v + tipR) / 2, 0);
      v.mesh.rotation.z = v.a0;
    }
    pumpPulley.rotation.z = -pumpAng;
    crankPulley.rotation.z = -pumpAng * CRANK_RATIO;

    // oil packets
    const phase = u * LOOP_LAPS;
    const b0 = loop.bounds[0];
    const b1 = loop.bounds[1];
    placeDots(
      loopDots,
      LOOP_N,
      loop,
      phase,
      (t) => (t < b0 ? _col.copy(DIM).lerp(HOT, Math.max(0.35, pSys)) : _col.copy(DIM).lerp(HOT, 0.12)),
      b1,
    );
    placeDots(lineDotsL, LINE_N, curveL, rackX * 1.6, _col.copy(DIM).lerp(HOT, Math.max(0.3, pL)).clone());
    placeDots(lineDotsR, LINE_N, curveR, -rackX * 2.4, _col.copy(DIM).lerp(HOT, Math.max(0.3, pR)).clone());

    // live readouts
    const deg = Math.abs(tw) * 3.5;
    for (const r of readouts.twist) r.setText(`Torsion-bar twist ${deg.toFixed(1)}°`);
    for (const r of readouts.press) r.setText(`Pressure ${Math.round(pSys * 100)} bar`);
    return { rackX, tw };
  }

  const setCycle = (u) => pose(u, AMP);
  const setIdle = (u) => pose(u, 0);

  function setReveal(t) {
    revealed = clamp01(t) > 0.5;
    for (const m of housingMetal) m.visible = !revealed;
    for (const m of coverParts) m.visible = !revealed;
    lineL.visible = lineR.visible = !revealed;
    for (const c of cores) c.visible = revealed;
    chamberL.visible = chamberR.visible = revealed;
    loopDots.mesh.visible = lineDotsL.mesh.visible = lineDotsR.mesh.visible = revealed;
    // rubber ghosts (low specular) — boots and hoses become context shells
    bootRubber.opacity = revealed ? 0.16 : 1;
    bootRubber.depthWrite = !revealed;
    hoseRubber.opacity = revealed ? 0.22 : 1;
    hoseRubber.depthWrite = !revealed;
  }
  function setInsert(v) {
    insert.visible = !!v;
    leader.visible = !!v;
  }

  // initial: sealed, centred
  setReveal(0);
  setInsert(false);
  setCycle(0);
  labels.setLabels(false);

  return {
    group,
    setCycle,
    setIdle,
    setReveal,
    setInsert,
    setLabels: labels.setLabels,
    parts: { rack, pinion, input, rotor, spool, wheelSpin, leftCorner: corners[0].pivot, rightCorner: corners[1].pivot, insert },
  };
}
