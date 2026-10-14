import * as THREE from 'three';
import { materials, rod } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, gear, coil } from '../../framework/geometry.js';
import { clamp01, win, profileTable, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';
import {
  PERIOD,
  DASH,
  LINE_W,
  X_DASH,
  X_EDGE_R,
  X_EDGE_L,
  ROAD_X0,
  ROAD_X1,
  ROAD_W,
  ROAD_NEAR,
  ROAD_FAR,
  FADE,
  HALF_L,
  HALF_W,
  TYRE_R,
  TYRE_W,
  TRACK_HALF,
  FRONT_AXLE,
  REAR_AXLE,
  WHEELBASE,
  ARCH_R,
  rng,
  frac,
  lerp,
  roadTexture,
  softRectTexture,
  roadStrip,
  flatStrip,
  glowMat,
  noAO,
  buildCar,
  G_YB,
  surfaceZ,
  bodyW,
} from '../../framework/vehicle.js';

// ADAS lane assist on a road "treadmill": a mid-size sedan holds its lane on
// a strip of two-lane road whose markings stream underneath it (the car stays
// put, the road texture scrolls). Under the ghosted body: the windshield
// camera behind the mirror, the 77 GHz front radar behind the badge, the ADAS
// controller, and the column-mounted EPS (torque sensor + worm drive) that
// steers the rack and front wheels. A second car ahead is the radar target.
//
// SCALE: 1 unit = 1 m.
//   car 4.6 L × 1.8 W × 1.45 H · wheelbase 2.7 · track 1.56 · tyre Ø0.64
//   lane 3.5 m · line 0.15 m · dashes 3 m paint + 9 m gap (12 m period)
//   steering wheel Ø0.38 · column-EPS worm wheel 30 teeth (1 tooth / worm turn)
//
// MECHANISM (researched — Transport Canada LKA page, Mobileye lane output
// spec (3rd-order polynomial: offset, heading, curvature), EPS overlay-torque
// patents US8170751 / US9688308 ("max torque, for example 3 Nm"), UN R79
// hands-on detection, Hella/Bosch 77 GHz radar notes):
//   camera finds marking edges row by row and fits a curve per lane line →
//   lateral offset + heading → projected line crossing → warning (LDW) or an
//   overlay-torque request to the EPS motor (LKA), capped ≈3 Nm; a column
//   torque sensor reads the driver's hands and a larger driver torque wins.
//   Radar (FMCW) gives range + closing speed; ACC holds a TIME gap.
//
// DISCLOSED EXAGGERATIONS / SIMPLIFICATIONS:
//   - drift yaw drawn YAW_VIS×, road-wheel steer STEER_VIS×, steering-wheel
//     angle SW_VIS× (true values are ~1° of yaw and a fraction of a degree
//     at the road wheels — invisible otherwise).
//   - the following gap is drawn ~15 m (a real 1.8 s gap at this speed is
//     ~25 m); torque-sensor twist is drawn large.
//   - the controller is a separate box; many cars run the lane software on
//     the camera module's own chip. No engine/suspension is modelled.
//
// SCALARS (each lap fn takes u ∈ [0,1); every one is seamless — road scroll
// and wheel spin advance whole 12 m periods / whole turns, all offsets,
// torques and gaps return to their u=0 value):
//   setCruise(u) · setDetect(u) · setDrift(u, 'warn'|'assist'|'override')
//   setFollow(u) · setRun(u)
//   setReveal(t) 0 sealed · 1 body ghosted · setLead(on) · setOverlay(mode)
//   setLabels(mode) — 'exterior' | 'hardware' | 'camera' | 'drift' | 'eps' |
//     'torque' | 'radar' | false

// --- layout ---------------------------------------------------------------------

const YAW_VIS = 3;
const STEER_VIS = 10;
const SW_VIS = 2;
const STEER_RATIO = 15;
const TWIST_PER_NM = (4 * Math.PI) / 180; // drawn sensor twist

const LENS = new THREE.Vector3(0, 1.31, -0.31); // car-local
const RADAR = new THREE.Vector3(0, 0.52, -2.13);
const HUB = new THREE.Vector3(-0.37, 0.93, -0.33); // steering-wheel hub
const COL = new THREE.Vector3(0, -0.382, -0.924).normalize(); // hub → firewall
const RACK_Y = 0.3;
const RACK_Z = -1.15;
const PINION_X = -0.37;
const WORM_TEETH = 30;
const GAP0 = 15;
const FOV_HALF = (26 * Math.PI) / 180; // 52° mono front camera
const ROW_D0 = 6;
const ROW_D1 = 34;
const NROWS = 14;

const CYAN = new THREE.Color(0x5ad1ff);
const AMBER = new THREE.Color(0xffb02e);

function bandTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 8;
  const g = c.getContext('2d');
  const gr = g.createLinearGradient(0, 0, 128, 0);
  gr.addColorStop(0, 'rgba(255,255,255,0)');
  gr.addColorStop(0.18, 'rgba(255,255,255,0.9)');
  gr.addColorStop(0.24, 'rgba(255,255,255,0.35)');
  gr.addColorStop(0.76, 'rgba(255,255,255,0.35)');
  gr.addColorStop(0.82, 'rgba(255,255,255,0.9)');
  gr.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = gr;
  g.fillRect(0, 0, 128, 8);
  return new THREE.CanvasTexture(c);
}

function laneIconTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 64;
  const g = c.getContext('2d');
  g.strokeStyle = '#fff';
  g.lineWidth = 5;
  g.lineCap = 'round';
  g.beginPath();
  g.moveTo(14, 58);
  g.lineTo(22, 6);
  g.moveTo(50, 58);
  g.lineTo(42, 6);
  g.stroke();
  g.fillStyle = '#fff';
  g.beginPath();
  g.roundRect(24, 26, 16, 24, 4);
  g.fill();
  return new THREE.CanvasTexture(c);
}

// road strip with world-locked UVs (v = −z / PERIOD) and per-vertex alpha
// --- main build ---------------------------------------------------------------------
export function buildAdasLaneAssist({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  // road frame: road, lead car and every road-locked overlay. Normally
  // identity; in car-frame mode (the in-cabin macro steps) it carries the
  // inverse of the ego car's motion so the car holds still under a fixed
  // macro camera while the road drifts — the same relative motion.
  const worldG = new THREE.Group();
  group.add(worldG);
  const labels = calloutSets(['exterior', 'hardware', 'camera', 'drift', 'eps', 'torque', 'radar']);

  // --- road ---------------------------------------------------------------------------
  const roadTex = roadTexture();
  const roadMat = new THREE.MeshStandardMaterial({
    map: roadTex,
    roughness: 0.9,
    metalness: 0,
  });
  const roadFadeMat = roadMat.clone();
  roadFadeMat.map = roadTex;
  roadFadeMat.vertexColors = true;
  roadFadeMat.transparent = true;
  const roadMain = roadStrip(ROAD_NEAR - FADE, ROAD_FAR + FADE, 4, () => 1, roadMat);
  const fadeAt = (z) =>
    Math.pow(clamp01(Math.min((ROAD_NEAR - z) / FADE, (z - ROAD_FAR) / FADE)), 1.6);
  const roadNear = roadStrip(ROAD_NEAR, ROAD_NEAR - FADE, 24, fadeAt, roadFadeMat);
  const roadFar = roadStrip(ROAD_FAR + FADE, ROAD_FAR, 24, fadeAt, roadFadeMat);
  roadNear.renderOrder = roadFar.renderOrder = -1;
  for (const m of [roadMain, roadNear, roadFar]) {
    m.position.y = 0.003;
    m.userData.noOcclude = true;
    worldG.add(m);
  }

  // --- cars ----------------------------------------------------------------------------
  const ego = buildCar({ paintColor: 0x9c1a22, interior: true });
  group.add(ego.root);
  const lead = buildCar({ paintColor: 0x3a3f47, interior: false });
  worldG.add(lead.root);

  // --- ADAS hardware (ego, car-local) -------------------------------------------------------
  const blackPoly = materials.polymer(0x16181b);
  const camBody = beveledBox(0.15, 0.07, 0.11, blackPoly, 0.02);
  camBody.position.set(0, LENS.y, LENS.z + 0.07);
  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0x06080c,
    metalness: 0,
    roughness: 0.05,
    clearcoat: 1,
    iridescence: 0.5,
    iridescenceThicknessRange: [200, 500],
  });
  const lens = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.022, 0.03, 28), lensMat);
  lens.rotation.x = Math.PI / 2 + 0.07;
  lens.position.copy(LENS).add(new THREE.Vector3(0, 0, 0.005));
  const mirrorStalk = rod(0.008, 0.16, blackPoly);
  mirrorStalk.position.set(0, 1.26, -0.14);
  const mirrorBody = beveledBox(0.25, 0.07, 0.035, blackPoly, 0.015);
  mirrorBody.position.set(0, 1.25, -0.12);
  ego.root.add(camBody, lens, mirrorStalk, mirrorBody);

  const radarGroup = new THREE.Group();
  radarGroup.position.copy(RADAR);
  const radarBox = beveledBox(0.12, 0.1, 0.05, materials.polymer(0x2a2d33), 0.012);
  const radome = beveledBox(0.105, 0.085, 0.008, materials.polymer(0x3d424a), 0.003);
  radome.position.z = -0.027;
  radarGroup.add(radarBox, radome);
  const patchMat = new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 1, roughness: 0.35 });
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 3; j++) {
      const p = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.002), patchMat);
      p.position.set(-0.03 + i * 0.02, -0.02 + j * 0.02, -0.032);
      radarGroup.add(p);
    }
  }
  ego.root.add(radarGroup);

  const ctrlMat = materials.aluminum(0xaab1ba);
  ctrlMat.roughness = 0.7;
  const controller = beveledBox(0.2, 0.05, 0.15, ctrlMat, 0.012);
  controller.position.set(0.3, 0.64, -0.72);
  for (let k = 0; k < 6; k++) {
    const fin = beveledBox(0.17, 0.012, 0.006, ctrlMat, 0.002);
    fin.position.set(0, 0.03, -0.06 + k * 0.024);
    controller.add(fin);
  }
  const connector = beveledBox(0.06, 0.03, 0.03, blackPoly, 0.006);
  connector.position.set(-0.08, 0, -0.08);
  controller.add(connector);
  ego.root.add(controller);

  const wireMat = materials.polymer(0x101113);
  const wirePts = {
    cam: [
      [0.0, LENS.y, LENS.z + 0.13],
      [0.05, 1.22, -0.25],
      [0.14, 1.02, -0.5],
      [0.24, 0.8, -0.62],
      [0.24, 0.68, -0.79],
    ],
    radar: [
      [0.0, 0.52, -2.1],
      [0.12, 0.6, -1.85],
      [0.3, 0.74, -1.35],
      [0.34, 0.72, -0.95],
      [0.32, 0.66, -0.81],
    ],
    eps: [
      [0.2, 0.645, -0.72],
      [0.05, 0.62, -0.7],
      [-0.06, 0.62, -0.72],
      [-0.14, 0.64, -0.74],
    ],
  };
  const wires = Object.values(wirePts).map((p) => {
    const t = tubeAlong(p, 0.007, wireMat, { tubularSegments: 48, radialSegments: 8 });
    ego.root.add(t);
    return t;
  });
  const dataDotMat = glowMat(CYAN, 1, false);
  const dataDots = [];
  for (const w of wires) {
    for (let k = 0; k < 3; k++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), dataDotMat);
      d.userData.curve = w.userData.curve;
      d.userData.k = k;
      ego.root.add(d);
      dataDots.push(d);
    }
  }

  // --- steering chain: wheel → column (torque sensor, worm EPS) → shaft → rack -------------
  const colFrame = new THREE.Group();
  {
    const yAx = COL.clone().negate(); // toward the driver
    const xAx = new THREE.Vector3(1, 0, 0);
    const zAx = new THREE.Vector3().crossVectors(xAx, yAx);
    colFrame.quaternion.setFromRotationMatrix(new THREE.Matrix4().makeBasis(xAx, yAx, zAx));
    colFrame.position.copy(HUB);
  }
  ego.root.add(colFrame);
  // local: +y toward the driver, −y down the column, −z = 12 o'clock on the wheel
  const swMat = materials.rubber(0x1d1f23);
  swMat.roughness = 0.7;
  const shaftMat = materials.steel(0xb5bcc5);
  shaftMat.roughness = 0.38;
  const colIn = new THREE.Group(); // wheel side of the torsion element
  const colOut = new THREE.Group(); // EPS / pinion side
  colFrame.add(colIn, colOut);
  const rim = new THREE.Mesh(new THREE.TorusGeometry(0.19, 0.017, 14, 64), swMat);
  rim.rotation.x = Math.PI / 2;
  colIn.add(rim);
  const stripe = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.0185, 10, 8, 0.12),
    new THREE.MeshStandardMaterial({ color: 0xe8ecf2, roughness: 0.5 }),
  );
  stripe.rotation.x = Math.PI / 2;
  stripe.rotation.z = -Math.PI / 2 - 0.06; // centred on 12 o'clock (local −z)
  colIn.add(stripe);
  const hubMesh = new THREE.Mesh(new THREE.CylinderGeometry(0.065, 0.075, 0.06, 32), swMat);
  hubMesh.position.y = -0.02;
  colIn.add(hubMesh);
  for (const a of [Math.PI / 2, -Math.PI / 2, 0]) {
    // spokes at 3, 9 and 6 o'clock (local ±x, +z)
    const sp = beveledBox(0.13, 0.018, 0.04, swMat, 0.008);
    sp.position.set(Math.sin(a) * 0.125, -0.012, Math.cos(a) * 0.125);
    sp.rotation.y = a + Math.PI / 2;
    colIn.add(sp);
  }
  const upperShaft = rod(0.013, 0.32, shaftMat);
  upperShaft.position.y = -0.36;
  colIn.add(upperShaft);
  const shroud = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.042, 0.22, 24), blackPoly);
  shroud.position.y = -0.17;
  colFrame.add(shroud);

  const sensorMat = materials.aluminum(0xc0c6ce);
  sensorMat.roughness = 0.55;
  const markMat = new THREE.MeshBasicMaterial({ color: CYAN, toneMapped: false });
  const collarIn = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.034, 32), sensorMat);
  collarIn.position.y = -0.305;
  const tabIn = beveledBox(0.014, 0.034, 0.024, markMat, 0.003);
  tabIn.position.set(0, -0.305, -0.048);
  colIn.add(collarIn, tabIn);
  const collarOut = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.034, 32), sensorMat);
  collarOut.position.y = -0.352;
  const tabOut = beveledBox(0.014, 0.034, 0.024, markMat, 0.003);
  tabOut.position.set(0, -0.352, -0.048);
  const torsion = rod(0.006, 0.04, shaftMat);
  torsion.position.y = -0.35;
  colOut.add(collarOut, tabOut, torsion);
  const sensorRingMat = glowMat(CYAN, 0.9, false);
  for (const [grp, y] of [
    [colIn, -0.305 + 0.019],
    [colOut, -0.352 - 0.019],
  ]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.043, 0.004, 8, 40), sensorRingMat);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = y;
    grp.add(ring);
    noAO(ring);
  }
  const sensorAnchor = new THREE.Object3D();
  sensorAnchor.position.set(0.045, -0.33, -0.02);
  colFrame.add(sensorAnchor);
  const lowerShaft = rod(0.013, 0.26, shaftMat);
  lowerShaft.position.y = -0.62;
  colOut.add(lowerShaft);
  const wheelGear = gear(
    { teeth: WORM_TEETH, radius: 0.066, thickness: 0.026, holeR: 0.014, cutouts: 5 },
    materials.polymer(0xd9d2bf),
  );
  wheelGear.rotation.x = Math.PI / 2;
  wheelGear.position.y = -0.45;
  colOut.add(wheelGear);
  const wormR = 0.017;
  const wormZ = wheelGear.userData.pitchR + wormR;
  const wormSpin = new THREE.Group();
  wormSpin.position.set(0.0, -0.45, wormZ);
  colFrame.add(wormSpin);
  const worm = coil(
    { turns: 5, radius: wormR, length: 0.08, wireRadius: 0.006, segmentsPerTurn: 20 },
    materials.steel(0xc3c9d1),
  );
  worm.mesh.rotation.z = -Math.PI / 2;
  const wormCore = rod(0.012, 0.11, shaftMat);
  wormCore.rotation.z = -Math.PI / 2;
  wormCore.position.x = -0.055;
  wormSpin.add(worm.mesh, wormCore);
  const motorMat = materials.aluminum(0x9ea6b0);
  motorMat.roughness = 0.6;
  const motor = new THREE.Group();
  motor.position.set(0.07, -0.45, wormZ);
  const can = rod(0.042, 0.13, motorMat, 32);
  can.rotation.z = -Math.PI / 2;
  const cap = rod(0.044, 0.025, blackPoly, 32);
  cap.rotation.z = -Math.PI / 2;
  cap.position.x = 0.13;
  const bandMat = new THREE.MeshStandardMaterial({
    color: 0x0d2733,
    emissive: CYAN,
    emissiveIntensity: 0,
    roughness: 0.4,
  });
  const band = rod(0.0435, 0.012, bandMat, 32);
  band.rotation.z = -Math.PI / 2;
  band.position.x = 0.05;
  motor.add(can, cap, band);
  colFrame.add(motor);

  // intermediate shaft → pinion → rack → tie rods → steering arms
  const colEnd = HUB.clone().addScaledVector(COL, 0.62);
  const pinionTop = new THREE.Vector3(PINION_X, RACK_Y + 0.12, RACK_Z);
  const ishaft = rod(0.012, 1, shaftMat);
  {
    const d = new THREE.Vector3().subVectors(pinionTop, colEnd);
    ishaft.scale.y = d.length();
    ishaft.position.copy(colEnd);
    ishaft.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
  }
  const joint1 = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 12), shaftMat);
  joint1.position.copy(colEnd);
  ego.root.add(ishaft, joint1);
  const rackAl = materials.aluminum(0xb4bac2);
  rackAl.roughness = 0.62;
  const rackHousing = rod(0.032, 1.0, rackAl, 24);
  rackHousing.rotation.z = Math.PI / 2;
  rackHousing.position.set(0.5, RACK_Y, RACK_Z);
  const pinionTower = rod(0.04, 0.12, rackAl, 24);
  pinionTower.position.set(PINION_X, RACK_Y - 0.01, RACK_Z);
  ego.root.add(rackHousing, pinionTower);
  const rackBar = rod(0.013, 1.24, materials.chrome(0xd2d7dd), 16);
  rackBar.rotation.z = Math.PI / 2;
  rackBar.position.set(0.62, RACK_Y, RACK_Z);
  ego.root.add(rackBar);
  const bootMat = materials.rubber(0x121315);
  for (const s of [-1, 1]) {
    const prof = [];
    for (let k = 0; k <= 12; k++) prof.push([0.026 + (k % 2 ? 0.012 : 0), (k / 12) * 0.11]);
    const boot = lathe(prof, bootMat, 24);
    boot.rotation.z = s > 0 ? -Math.PI / 2 : Math.PI / 2;
    boot.position.set(s * 0.5, RACK_Y, RACK_Z);
    ego.root.add(boot);
  }
  const tieRods = [];
  const armTips = [];
  const ARM_LOCAL = 0.25;
  ego.steerPivots.forEach((pivot, i) => {
    const s = i === 0 ? -1 : 1;
    const knuckle = beveledBox(0.05, 0.16, 0.06, discMat(), 0.01);
    knuckle.position.set(-s * 0.13, 0, 0);
    const arm = rod(0.012, 1, shaftMat);
    const tip = new THREE.Vector3(-s * 0.1, 0, ARM_LOCAL);
    const from = new THREE.Vector3(-s * 0.13, 0, 0);
    const d = new THREE.Vector3().subVectors(tip, from);
    arm.scale.y = d.length();
    arm.position.copy(from);
    arm.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), d.normalize());
    pivot.add(knuckle, arm);
    armTips.push(tip);
    const tr = rod(0.011, 1, shaftMat);
    ego.root.add(tr);
    tieRods.push(tr);
  });
  function discMat() {
    const m = materials.darkMetal(0x2c2f34);
    m.roughness = 0.6;
    return m;
  }

  // warning lamp on the instrument cluster
  const lampMat = new THREE.MeshBasicMaterial({
    map: laneIconTexture(),
    color: AMBER,
    transparent: true,
    opacity: 0.15,
    depthWrite: false,
    toneMapped: false,
  });
  const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.07, 0.07), lampMat);
  lamp.position.set(HUB.x, 0.975, -0.535);
  lamp.rotation.x = -0.25;
  const haloMat = glowMat(AMBER, 0);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), haloMat);
  halo.position.copy(lamp.position);
  ego.root.add(lamp, halo);

  // --- overlays ----------------------------------------------------------------------------
  const ov = {
    detect: new THREE.Group(),
    lines: new THREE.Group(),
    drift: new THREE.Group(),
    torque: new THREE.Group(),
    radar: new THREE.Group(),
    gap: new THREE.Group(),
  };
  for (const g of Object.values(ov)) worldG.add(g);
  const lensW = LENS.clone(); // car sits at the origin, unrotated, while detecting

  // camera view: frustum walls + ground footprint with scan rows
  {
    const pos = [];
    const col = [];
    const nearHW = ROW_D0 * Math.tan(FOV_HALF);
    const farHW = ROW_D1 * Math.tan(FOV_HALF);
    const zN = lensW.z - ROW_D0;
    const zF = lensW.z - ROW_D1;
    for (const s of [-1, 1]) {
      pos.push(lensW.x, lensW.y, lensW.z, s * nearHW, 0.02, zN, s * farHW, 0.02, zF);
      col.push(0.35, 0.82, 1, 0.12, 0.35, 0.82, 1, 0.07, 0.35, 0.82, 1, 0);
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 4));
    const walls = new THREE.Mesh(
      geo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        side: THREE.DoubleSide,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    ov.detect.add(walls);
    // footprint grid
    const nu = 24;
    const nv = 16;
    const fp = [];
    const fc = [];
    const fi = [];
    for (let i = 0; i <= nv; i++) {
      const d = lerp(ROW_D0, ROW_D1, i / nv);
      const hw = d * Math.tan(FOV_HALF);
      for (let j = 0; j <= nu; j++) {
        const x = lerp(-hw, hw, j / nu);
        const onRoad = clamp01(1 - Math.max(ROAD_X0 - x, x - ROAD_X1, 0) / 1.5);
        const a = 0.13 * Math.pow(1 - (d - ROW_D0) / (ROW_D1 - ROW_D0), 0.8) * (0.2 + 0.8 * onRoad);
        fp.push(x, 0.018, lensW.z - d);
        fc.push(0.35 * a, 0.82 * a, a, 1);
      }
    }
    for (let i = 0; i < nv; i++) {
      for (let j = 0; j < nu; j++) {
        const a = i * (nu + 1) + j;
        fi.push(a, a + 1, a + nu + 1, a + 1, a + nu + 2, a + nu + 1);
      }
    }
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute('position', new THREE.Float32BufferAttribute(fp, 3));
    fgeo.setAttribute('color', new THREE.Float32BufferAttribute(fc, 4));
    fgeo.setIndex(fi);
    const foot = new THREE.Mesh(
      fgeo,
      new THREE.MeshBasicMaterial({
        vertexColors: true,
        transparent: true,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    ov.detect.add(foot);
  }
  const rowD = Array.from({ length: NROWS }, (_, i) => ROW_D0 * Math.pow(ROW_D1 / ROW_D0, i / (NROWS - 1)));
  const rowGeo = new THREE.BufferGeometry();
  {
    const p = [];
    for (const d of rowD) {
      const hw = d * Math.tan(FOV_HALF);
      p.push(Math.max(-hw, ROAD_X0 + 0.2), 0.022, lensW.z - d, Math.min(hw, ROAD_X1 - 0.2), 0.022, lensW.z - d);
    }
    rowGeo.setAttribute('position', new THREE.Float32BufferAttribute(p, 3));
    rowGeo.setAttribute('color', new THREE.Float32BufferAttribute(new Float32Array(NROWS * 2 * 3), 3));
  }
  const rows = new THREE.LineSegments(
    rowGeo,
    new THREE.LineBasicMaterial({
      vertexColors: true,
      transparent: true,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    }),
  );
  ov.detect.add(rows);
  const PT_X = [X_DASH - LINE_W / 2, X_DASH + LINE_W / 2, X_EDGE_R - LINE_W / 2, X_EDGE_R + LINE_W / 2];
  const points = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.055, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xbff0ff, toneMapped: false }),
    NROWS * PT_X.length,
  );
  points.frustumCulled = false;
  ov.detect.add(points);
  // label anchors for the camera set
  const ptAnchor = new THREE.Object3D();
  ptAnchor.position.set(X_EDGE_R + LINE_W / 2, 0.03, lensW.z - rowD[5]);
  ov.detect.add(ptAnchor);

  // fitted lane lines (also used by the run step)
  const fitMat = glowMat(CYAN, 0.95, false);
  const fitLines = [X_DASH, X_EDGE_R].map((x) => {
    const t = tubeAlong(
      [
        [x, 0.03, lensW.z - ROW_D0],
        [x, 0.03, lensW.z - ROW_D1],
      ],
      0.045,
      fitMat,
      { tubularSegments: 60, radialSegments: 8 },
    );
    t.castShadow = false;
    ov.lines.add(t);
    return t;
  });
  const fitIndexCount = fitLines[0].geometry.index.count;
  const fitAnchor = new THREE.Object3D();
  fitAnchor.position.set(X_DASH, 0.04, lensW.z - 15);
  ov.lines.add(fitAnchor);

  // drift: lane centre, car axis, offset arrow, heading ray, crossing marker
  const centreLine = flatStrip(glowMat(CYAN, 0.55, false));
  centreLine.scale.set(0.05, 1, 36);
  centreLine.position.set(0, 0.016, 4);
  ov.drift.add(centreLine);
  const axisLine = flatStrip(glowMat(0xffffff, 0.75, false));
  axisLine.scale.set(0.04, 1, 5.6);
  axisLine.position.set(0, 0.02, 3.2);
  ego.root.add(axisLine);
  const rayMat = glowMat(AMBER, 0.85, false);
  const ray = flatStrip(rayMat);
  ray.position.set(0, 0.022, -HALF_L - 0.02);
  ego.root.add(ray);
  const offsetArrow = new THREE.Group();
  const arrowMat = glowMat(0xffffff, 0.95, false);
  const arrowShaft = new THREE.Mesh(new THREE.PlaneGeometry(1, 0.07).rotateX(-Math.PI / 2), arrowMat);
  const headShape = new THREE.Shape();
  headShape.moveTo(0, 0);
  headShape.lineTo(-0.2, 0.11);
  headShape.lineTo(-0.2, -0.11);
  headShape.closePath();
  const arrowHead = new THREE.Mesh(new THREE.ShapeGeometry(headShape).rotateX(-Math.PI / 2), arrowMat);
  offsetArrow.add(arrowShaft, arrowHead);
  offsetArrow.position.set(0, 0.024, 2.9);
  ov.drift.add(offsetArrow);
  const offsetAnchor = new THREE.Object3D();
  offsetArrow.add(offsetAnchor);
  const crossMat = glowMat(AMBER, 1, false);
  const crossMark = new THREE.Mesh(new THREE.RingGeometry(0.2, 0.28, 40).rotateX(-Math.PI / 2), crossMat);
  ov.drift.add(crossMark);

  // torque arrows on the wheel rim (colFrame local, wheel plane = xz)
  function arcArrow(radius, color) {
    const N = 48;
    const span = (110 * Math.PI) / 180;
    const pts = [];
    for (let k = 0; k <= N; k++) {
      const a = (k / N) * span;
      pts.push([Math.sin(a) * radius, 0.035, -Math.cos(a) * radius]);
    }
    const mat = glowMat(color, 0.95, false);
    const tube = tubeAlong(pts, 0.009, mat, { tubularSegments: N, radialSegments: 8 });
    tube.castShadow = false;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.022, 0.05, 14), mat);
    const g = new THREE.Group();
    g.add(tube, head);
    return { g, tube, head, radius, span, count: tube.geometry.index.count, N };
  }
  const assistArrow = arcArrow(0.235, CYAN);
  const driverArrow = arcArrow(0.27, 0xffffff);
  colFrame.add(assistArrow.g, driverArrow.g);
  const _tmpV = new THREE.Vector3();
  // dir −1 = clockwise from the driver's seat (turn right), +1 = left
  function setArc(arr, frac01, dir) {
    const f = clamp01(frac01);
    arr.g.visible = f > 0.02;
    if (!arr.g.visible) return;
    arr.g.scale.x = dir < 0 ? 1 : -1; // mirror for a left-hand turn
    const segs = Math.max(1, Math.round(f * arr.N));
    arr.tube.geometry.setDrawRange(0, Math.round((segs / arr.N) * arr.count));
    const a = (segs / arr.N) * arr.span;
    arr.head.position.set(Math.sin(a) * arr.radius, 0.035, -Math.cos(a) * arr.radius);
    _tmpV.set(Math.cos(a), 0, Math.sin(a));
    arr.head.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), _tmpV);
  }
  const assistAnchor = new THREE.Object3D();
  assistAnchor.position.set(0.215, 0.035, -0.215); // just outside the rim
  assistArrow.g.add(assistAnchor);
  const driverAnchor = new THREE.Object3D();
  driverAnchor.position.set(0.25, 0.035, -0.1);
  driverArrow.g.add(driverAnchor);

  // radar: wavefronts out + echoes back, gap band, fusion marks
  const WAVES = 5;
  const waveGeo = new THREE.CylinderGeometry(1, 1, 0.04, 32, 1, true, Math.PI - 0.15, 0.3); // ±9° long-range beam
  const echoGeo = new THREE.CylinderGeometry(1, 1, 0.04, 32, 1, true, -0.2, 0.4);
  const outWaves = [];
  const echoWaves = [];
  for (let k = 0; k < WAVES; k++) {
    const o = new THREE.Mesh(waveGeo, glowMat(CYAN, 0.6));
    const e = new THREE.Mesh(echoGeo, glowMat(0xd9f4ff, 0.5));
    ov.radar.add(o, e);
    outWaves.push(o);
    echoWaves.push(e);
  }
  const bandMatGap = new THREE.MeshBasicMaterial({
    color: CYAN,
    alphaMap: bandTexture(),
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    toneMapped: false,
  });
  const gapBand = flatStrip(bandMatGap);
  gapBand.position.y = 0.015;
  ov.gap.add(gapBand);
  const gapAnchor = new THREE.Object3D();
  ov.gap.add(gapAnchor);
  const beamAnchor = new THREE.Object3D(); // on the outgoing beam, just ahead of the radar
  ov.radar.add(beamAnchor);
  // camera bounding brackets on the lead car (car-local, follows it)
  const brackets = new THREE.Group();
  {
    const bm = glowMat(CYAN, 0.95, false);
    const hx = 1.0;
    const hy = 0.8;
    const hz = 2.45;
    const L = 0.38;
    for (const sx of [-1, 1]) {
      for (const sy of [-1, 1]) {
        for (const sz of [-1, 1]) {
          const c = new THREE.Vector3(sx * hx, 0.78 + sy * hy, sz * hz);
          for (const [ax, dir] of [
            ['x', -sx],
            ['y', -sy],
            ['z', -sz],
          ]) {
            const r = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, L, 6), bm);
            r.position.copy(c);
            r.position[ax] += (dir * L) / 2;
            if (ax === 'x') r.rotation.z = Math.PI / 2;
            if (ax === 'z') r.rotation.x = Math.PI / 2;
            brackets.add(r);
          }
        }
      }
    }
  }
  lead.root.add(brackets);
  const camBoxAnchor = new THREE.Object3D();
  camBoxAnchor.position.set(1.0, 1.58, 2.45);
  brackets.add(camBoxAnchor);
  const radarMark = new THREE.Group();
  {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.16, 0.014, 8, 40), glowMat(0xffffff, 0.95, false));
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 14, 10), glowMat(0xffffff, 1, false));
    radarMark.add(ring, dot);
    radarMark.position.set(0, 0.52, HALF_L + 0.06);
  }
  lead.root.add(radarMark);

  for (const g of Object.values(ov)) noAO(g);
  noAO(brackets);
  noAO(radarMark);
  noAO(assistArrow.g);
  noAO(driverArrow.g);
  for (const m of [axisLine, ray, lamp, halo, ...dataDots]) noAO(m);

  // --- labels --------------------------------------------------------------------------
  const camAnchor = new THREE.Object3D();
  camAnchor.position.set(0, LENS.y + 0.03, LENS.z + 0.07);
  ego.root.add(camAnchor);
  const radarAnchor = new THREE.Object3D();
  radarAnchor.position.set(0, 0.56, -2.29);
  ego.root.add(radarAnchor);
  labels.add('exterior', camAnchor, 'Windshield camera', [0, 0, 0], 70, 70);
  labels.add('exterior', radarAnchor, 'Front radar, behind the badge', [0, 0, 0], -30, 60);
  labels.add('hardware', camBody, 'Camera + image chip', [0, 0.04, 0], 70, 60);
  labels.add('hardware', radarGroup, 'Radar · 77 GHz', [0, 0.05, 0], 40, 60);
  labels.add('hardware', controller, 'ADAS controller', [0, 0.03, 0], 15, 70);
  labels.add('hardware', motor, 'EPS motor', [0.07, 0, 0], -30, 60);
  labels.add('hardware', rackHousing, 'Steering rack', [0, 0.35, 0], -60, 50);
  labels.add('camera', ptAnchor, 'Edge points: paint vs asphalt', [0, 0, 0], 30, 70);
  labels.add('camera', fitAnchor, 'Fitted lane line', [0, 0, 0], 60, 60);
  labels.add('camera', camAnchor, 'Camera', [0, 0, 0], 70, 50);
  labels.add('drift', offsetAnchor, 'Offset from lane centre', [0, 0, 0], -50, 50);
  labels.add('drift', crossMark, 'Predicted line crossing', [0, 0, 0], 60, 60);
  labels.add('drift', lamp, 'Warning lamp', [0, 0.03, 0], 40, 70);
  labels.add('eps', motor, 'EPS motor', [0.1, 0, 0], -20, 60);
  labels.add('eps', wheelGear, 'Worm gear', [0.06, 0, 0], -70, 55);
  labels.add('eps', assistAnchor, 'Extra torque, capped ≈3 Nm', [0, 0, 0], 30, 60);
  labels.add('torque', sensorAnchor, 'Torque sensor', [0, 0, 0], 55, 75);
  labels.add('torque', assistAnchor, 'Assist · ≈3 Nm', [0, 0, 0], 50, 50);
  labels.add('torque', driverAnchor, 'Your hands · more', [0, 0, 0], -10, 60);
  labels.add('radar', beamAnchor, 'Radar · 77 GHz', [0, 0, 0], 20, 60);
  labels.add('radar', gapAnchor, 'Time gap', [0, 0, 0], 20, 60);
  labels.add('radar', camBoxAnchor, 'Camera: “it’s a car”', [0, 0, 0], 50, 50);
  labels.add('radar', radarMark, 'Echo: range + speed', [0, 0, 0], 20, 60);

  // --- lap math ----------------------------------------------------------------------------
  function makeLap(periods, rate) {
    const prof = profileTable(rate, periods);
    const D = periods * PERIOD;
    const turns = Math.round(D / (TAU * TYRE_R));
    return {
      s: (u) => (prof.at(u) / TAU) * PERIOD,
      v: (u) => (rate(u) * prof.k * PERIOD) / TAU, // metres per lap-unit
      wheel: (u) => (prof.at(u) / (periods * TAU)) * turns * TAU,
      wheelPerM: (turns * TAU) / D,
    };
  }
  const one = () => 1;
  const LAPS = {
    cruise: makeLap(8, one),
    detect: makeLap(6, one),
    drift: makeLap(10, one),
    follow: makeLap(10, (u) => 1 - 0.3 * (win(u, 0.2, 0.4) - win(u, 0.62, 0.9))),
  };
  const DRIFT = {
    warn: (u) => -0.7 * (win(u, 0.05, 0.42) - win(u, 0.5, 0.85)),
    assist: (u) => -0.62 * (win(u, 0.05, 0.42) - win(u, 0.46, 0.92)),
    override: (u) => -0.88 * (win(u, 0.04, 0.5) - win(u, 0.86, 0.99)),
  };
  const gapOf = (u) => GAP0 - 5 * (win(u, 0.08, 0.32) - win(u, 0.48, 0.82));
  const wrap = (u) => ((u % 1) + 1) % 1;
  function deriv(fn, u, e = 1e-3) {
    return (fn(wrap(u + e)) - fn(wrap(u - e))) / (2 * e);
  }

  // --- pose -----------------------------------------------------------------------------
  const state = {
    overlay: 'none',
    lead: false,
    carFrame: false,
  };
  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _v = new THREE.Vector3();
  const _w = new THREE.Vector3();

  // st: { s, wheel, x, yaw (true rad), steer (true road-wheel rad), assistT,
  //       driverT (Nm, + = left), lamp 0..1, buzz, gap, leadWheel, u }
  const carM = new THREE.Matrix4();
  const _p = new THREE.Vector3();
  const _s1 = new THREE.Vector3(1, 1, 1);
  const _Yax = new THREE.Vector3(0, 1, 0);
  // car-local point → road frame (independent of which group is moving)
  const carPoint = (x, y, z) => new THREE.Vector3(x, y, z).applyMatrix4(carM);
  function apply(st) {
    roadTex.offset.y = frac(st.s / PERIOD);
    // ego (or, in car-frame mode, the road under it)
    _q.setFromAxisAngle(_Yax, st.yaw * YAW_VIS);
    carM.compose(_p.set(st.x, 0, 0), _q, _s1);
    if (state.carFrame) {
      ego.root.position.set(0, 0, 0);
      ego.root.rotation.set(0, 0, 0);
      new THREE.Matrix4().copy(carM).invert().decompose(worldG.position, worldG.quaternion, _w);
    } else {
      ego.root.position.set(st.x, 0, 0);
      ego.root.rotation.set(0, st.yaw * YAW_VIS, 0);
      worldG.position.set(0, 0, 0);
      worldG.quaternion.identity();
    }
    for (const sp of ego.spins) sp.rotation.x = -st.wheel;
    const dv = st.steer * STEER_VIS;
    for (const p of ego.steerPivots) p.rotation.y = dv;
    const swTrue = st.steer * STEER_RATIO;
    const sw = swTrue * SW_VIS + (st.buzz || 0);
    const twist = (st.driverT || 0) * TWIST_PER_NM;
    colIn.rotation.y = sw;
    colOut.rotation.y = sw - twist;
    wormSpin.rotation.x = -(sw - twist) * WORM_TEETH;
    // rack follows the drawn road-wheel angle through the steering arms
    const shift = ARM_LOCAL * Math.sin(dv);
    rackBar.position.x = 0.62 + shift;
    ego.steerPivots.forEach((pivot, i) => {
      const s = i === 0 ? -1 : 1;
      const tip = armTips[i].clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), dv).add(pivot.position);
      const inner = new THREE.Vector3(s * 0.62 + shift, RACK_Y, RACK_Z);
      const d = _v.subVectors(tip, inner);
      tieRods[i].position.copy(inner);
      tieRods[i].scale.y = d.length();
      tieRods[i].quaternion.setFromUnitVectors(_w.set(0, 1, 0), d.normalize());
    });
    // torque arrows + motor glow
    const aT = st.assistT || 0;
    const dT = st.driverT || 0;
    const showT = state.overlay === 'assist' || state.overlay === 'torque';
    setArc(assistArrow, showT ? Math.abs(aT) / 3 * 0.55 : 0, Math.sign(aT) || -1);
    setArc(driverArrow, state.overlay === 'torque' ? Math.abs(dT) / 5 * 0.95 : 0, Math.sign(dT) || 1);
    bandMat.emissiveIntensity = (Math.abs(aT) / 3) * 2.2;
    // warning lamp
    const lampOn = st.lamp || 0;
    lampMat.opacity = 0.12 + 0.88 * lampOn;
    haloMat.opacity = 0.75 * lampOn;
    // lead car
    const gap = st.gap ?? GAP0;
    lead.root.position.set(0, 0, -2 * HALF_L - gap);
    for (const sp of lead.spins) sp.rotation.x = -(st.leadWheel ?? st.wheel);
    group.updateMatrixWorld(true);

    if (state.overlay === 'drift' || state.overlay === 'assist') poseDrift(st);
    if (state.overlay === 'detect') poseDetect(st);
    if (state.overlay === 'radar' || state.overlay === 'run') poseRadar(st, gap);
    if (state.overlay === 'hardware') poseData(st.u);
  }

  function poseDetect(st) {
    const ph = frac(st.u * 2);
    const shown = clamp01((ph - 0.02) / 0.33) * NROWS;
    const grow = win(ph, 0.3, 0.6);
    const fade = 1 - win(ph, 0.86, 0.98);
    const off = frac(st.s / PERIOD);
    const colors = rowGeo.attributes.color;
    for (let i = 0; i < NROWS; i++) {
      const k = Math.exp(-((i - shown) ** 2) / 1.5);
      const b = (0.12 + 0.88 * k * (shown < NROWS ? 1 : 0)) * fade;
      for (const e of [0, 1]) colors.setXYZ(i * 2 + e, 0.35 * b, 0.82 * b, b);
      const z = lensW.z - rowD[i];
      const dashOn = frac(-z / PERIOD + off) < DASH / PERIOD;
      PT_X.forEach((x, j) => {
        const paint = j < 2 ? dashOn : true;
        const vis = i < shown && paint && fade > 0.05;
        const sc = vis ? (1 + rowD[i] / 14) * fade : 0;
        _m.compose(_v.set(x, 0.035, z), _q.identity(), _w.setScalar(sc));
        points.setMatrixAt(i * PT_X.length + j, _m);
      });
    }
    colors.needsUpdate = true;
    points.instanceMatrix.needsUpdate = true;
    const n = Math.round(grow * 60);
    for (const t of fitLines) t.geometry.setDrawRange(0, Math.round((n / 60) * fitIndexCount));
    fitMat.opacity = 0.95 * fade;
  }

  function poseDrift(st) {
    const x = st.x;
    const yawV = st.yaw * YAW_VIS;
    // offset arrow behind the car, lane centre → car centreline
    const len = Math.abs(x);
    offsetArrow.visible = len > 0.06;
    const dir = Math.sign(x) || 1;
    arrowShaft.scale.x = Math.max(0.01, len - 0.18);
    arrowShaft.position.x = (dir * (len - 0.18)) / 2;
    arrowHead.position.x = dir * len;
    arrowHead.rotation.y = dir > 0 ? 0 : Math.PI;
    offsetAnchor.position.set((dir * len) / 2, 0, 0);
    // heading ray from the nose to the line it is aimed at
    const nose = carPoint(0, 0.022, -HALF_L - 0.02);
    const hx = -Math.sin(yawV);
    const lineX = hx < 0 ? X_DASH + LINE_W / 2 : X_EDGE_R - LINE_W / 2;
    let L = Math.abs(hx) > 1e-4 ? (lineX - nose.x) / hx : Infinity;
    const MAXL = 32;
    const hit = L > 0 && L < MAXL;
    if (!hit) L = MAXL;
    ray.scale.set(0.06, 1, L);
    rayMat.opacity = hit ? 0.9 : 0.35;
    crossMark.visible = hit;
    if (hit) crossMark.position.set(lineX, 0.026, nose.z - L * Math.cos(yawV));
    const near = hit ? clamp01(1 - (L - 6) / 20) : 0;
    crossMat.color.copy(AMBER).lerp(new THREE.Color(0xff5a3c), near);
  }

  function poseRadar(st, gap) {
    const R = carPoint(RADAR.x, RADAR.y, RADAR.z);
    const T = new THREE.Vector3(0, 0.52, -HALF_L - gap);
    const dist = R.distanceTo(T);
    const aim = Math.atan2(-(T.x - R.x), -(T.z - R.z));
    const radarOn = state.overlay === 'radar' || state.overlay === 'run';
    for (let k = 0; k < WAVES; k++) {
      const p = frac(st.u * 8 + k / WAVES);
      const o = outWaves[k];
      o.visible = radarOn;
      o.position.copy(R);
      o.rotation.y = aim;
      o.scale.set(Math.max(0.05, p * dist), 1, Math.max(0.05, p * dist));
      o.material.opacity = 0.95 * Math.sin(Math.PI * p);
      const q = frac(st.u * 8 + k / WAVES + 0.5 / WAVES);
      const e = echoWaves[k];
      e.visible = radarOn;
      e.position.copy(T);
      e.rotation.y = aim;
      e.scale.set(Math.max(0.05, q * dist), 1, Math.max(0.05, q * dist));
      e.material.opacity = 0.75 * Math.sin(Math.PI * q);
    }
    beamAnchor.position.copy(R).lerp(T, 2.2 / dist);
    const noseZ = carPoint(0, 0, -HALF_L).z;
    gapBand.position.set(0, 0.015, noseZ - 0.15);
    gapBand.scale.set(1.7, 1, Math.max(0.1, noseZ - 0.3 - (-HALF_L - gap)));
    gapAnchor.position.set(0.85, 0.02, noseZ - 0.15 - gapBand.scale.z * 0.55);
    const tight = clamp01((GAP0 - 1.5 - gap) / 2.5);
    bandMatGap.color.copy(CYAN).lerp(AMBER, tight * 0.75);
  }

  function poseData(u) {
    for (const d of dataDots) {
      const t = frac(u * 4 + d.userData.k / 3);
      d.position.copy(d.userData.curve.getPointAt(t));
    }
  }

  // per-lap state builders ------------------------------------------------------------
  function kinematics(lap, yFn, u) {
    const v = lap.v(u);
    const dy = deriv(yFn, u);
    const yaw = -dy / v;
    const dyaw = deriv((w) => -deriv(yFn, w) / lap.v(w), u, 2e-3);
    const kappa = dyaw / v;
    return { x: yFn(u), yaw, steer: Math.atan(WHEELBASE * kappa) };
  }

  function setCruise(u) {
    const lap = LAPS.cruise;
    const yFn = (w) => 0.05 * Math.sin(TAU * w);
    apply({ u, s: lap.s(u), wheel: lap.wheel(u), ...kinematics(lap, yFn, u) });
  }
  function setDetect(u) {
    const lap = LAPS.detect;
    apply({ u, s: lap.s(u), wheel: lap.wheel(u), x: 0, yaw: 0, steer: 0 });
  }
  function setDrift(u, mode = 'warn') {
    const lap = LAPS.drift;
    const yFn = DRIFT[mode];
    const k = kinematics(lap, yFn, u);
    const st = { u, s: lap.s(u), wheel: lap.wheel(u), ...k };
    if (mode === 'warn') {
      st.lamp = win(u, 0.28, 0.31) - win(u, 0.62, 0.66);
      st.buzz = st.lamp * 0.035 * Math.sin(u * TAU * 70);
    } else if (mode === 'assist') {
      st.assistT = -3 * (win(u, 0.36, 0.44) - win(u, 0.86, 0.96));
    } else {
      st.assistT = -3 * (win(u, 0.06, 0.12) - win(u, 0.38, 0.46));
      st.driverT = 5 * (win(u, 0.3, 0.4) - win(u, 0.84, 0.88)) - 1.5 * (win(u, 0.88, 0.9) - win(u, 0.96, 0.99));
    }
    apply(st);
  }
  function setFollow(u) {
    const lap = LAPS.follow;
    const gap = gapOf(u);
    apply({
      u,
      s: lap.s(u),
      wheel: lap.wheel(u),
      x: 0,
      yaw: 0,
      steer: 0,
      gap,
      leadWheel: lap.wheel(u) + (gap - gapOf(0)) * lap.wheelPerM,
    });
  }
  function setRun(u) {
    const lap = LAPS.follow;
    const gap = gapOf(u);
    const yFn = DRIFT.assist;
    apply({
      u,
      s: lap.s(u),
      wheel: lap.wheel(u),
      ...kinematics(lap, yFn, u),
      assistT: -3 * (win(u, 0.36, 0.44) - win(u, 0.86, 0.96)),
      gap,
      leadWheel: lap.wheel(u) + (gap - gapOf(0)) * lap.wheelPerM,
    });
  }

  // --- layers ---------------------------------------------------------------------------
  // 0 sealed · 1 body ghosted · 2 X-ray (body and cabin gone, for the
  // in-cabin macro shots where a ghost shell would fill the lens with haze)
  function setReveal(t) {
    const r = t > 0.5;
    const xray = t > 1.5;
    ego.body.visible = ego.green.visible = !xray;
    for (const m of ego.paintExtras) m.visible = !xray;
    for (const m of ego.cabinMeshes) m.visible = !xray;
    lamp.visible = halo.visible = !xray;
    for (const m of [camBody, lens, mirrorStalk, mirrorBody, wires[0]]) m.visible = !xray;
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
  }
  function setCarFrame(on) {
    state.carFrame = !!on;
  }
  function setLead(on) {
    state.lead = !!on;
    lead.root.visible = !!on;
  }
  // 'none' | 'hardware' | 'detect' | 'drift' | 'assist' | 'torque' | 'radar' | 'run'
  function setOverlay(mode) {
    state.overlay = mode || 'none';
    const m = state.overlay;
    ov.detect.visible = m === 'detect';
    // the drift numbers are computed against the camera's fitted lines, so
    // they stay on screen there too — the crossing ring lands ON one
    ov.lines.visible = m === 'detect' || m === 'run' || m === 'drift';
    ov.drift.visible = m === 'drift' || m === 'assist';
    axisLine.visible = ray.visible = m === 'drift' || m === 'assist';
    ov.radar.visible = m === 'radar' || m === 'run';
    ov.gap.visible = m === 'radar' || m === 'run';
    brackets.visible = radarMark.visible = m === 'radar';
    for (const d of dataDots) d.visible = m === 'hardware';
    if (m !== 'detect') {
      for (const t of fitLines) t.geometry.setDrawRange(0, Infinity);
      fitMat.opacity = 0.9;
    }
    if (m !== 'assist' && m !== 'torque') {
      setArc(assistArrow, 0, -1);
      setArc(driverArrow, 0, 1);
    }
  }

  // initial: sealed, cruising, no overlays
  setReveal(0);
  setLead(false);
  setOverlay('none');
  setCruise(0);
  labels.setLabels(false);

  return {
    group,
    setCruise,
    setDetect,
    setDrift,
    setFollow,
    setRun,
    setReveal,
    setLead,
    setCarFrame,
    setOverlay,
    setLabels: labels.setLabels,
    parts: { car: ego.root, lead: lead.root, colIn, colOut, wormSpin, rackBar, steer: ego.steerPivots[0] },
  };
}
