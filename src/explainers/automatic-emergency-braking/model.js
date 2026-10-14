import * as THREE from 'three';
import { materials, rod } from '../../framework/parts.js';
import { beveledBox, tubeAlong } from '../../framework/geometry.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';
import {
  PERIOD,
  HALF_L,
  TYRE_R,
  DRIVER_X,
  frac,
  lerp,
  roadTexture,
  roadStrip,
  flatStrip,
  glowMat,
  noAO,
  buildCar,
} from '../../framework/vehicle.js';

// Automatic emergency braking on the shared road treadmill (framework/
// vehicle.js): the ego sedan's 77 GHz radar measures the car ahead by PITCH
// (FMCW: the echo is a late copy of a rising chirp, so the sent/echo pitch
// gap is the range, and a Doppler lift is the closing speed); the windshield
// camera recognises a pedestrian test dummy; time-to-collision drives a
// staged response, and the ESC hydraulic unit's own pump clamps all four
// calipers while the brake pedal never moves.
//
// SCALE: 1 unit = 1 m (see vehicle.js). Caliper/pads/ESC block/booster sized
//   from a mid-size sedan: disc Ø300 mm, ESC block ≈140 mm, booster Ø260 mm.
//
// MECHANISM (researched — TI/Rohde & Schwarz FMCW notes: 76-77 GHz long-range
// sweep ≈1 GHz, f_beat = 2·R·B/(c·T), Doppler 2v/λ with λ≈3.9 mm; AEB state
// machine OFF→FCW→partial→full, partial ≈3 m/s², full ≈0.5 s before impact
// (Veneroso 2023, Wikipedia "Collision avoidance system"); ESC pump builds
// pressure independently of the driver (Bosch-style ESC patents); pedestrian
// RCS ≈20 dB below a car (JRC 77 GHz pedestrian RCS library)).
//
// DISCLOSED EXAGGERATIONS / SIMPLIFICATIONS:
//   - the pitch chart is a drawing: chirp delay and Doppler lift are scaled
//     up enormously (a real 30 m echo is 200 ns late on a ~50 µs chirp).
//   - wavefronts drawn as discrete arcs; the real signal is continuous.
//   - TTC is the simple constant-speed kind (distance ÷ closing speed); stage
//     thresholds 2.6 / 2.0 / 1.6 / 0.8 s are representative, they vary by car.
//   - the dummy rides a low test platform, like real AEB targets; no engine.
//
// SCALARS (u ∈ [0,1), all seamless — road scroll is whole 12 m periods,
// wheel spin whole turns, dummy/stopped car re-spawn inside the road's faded
// ends):
//   setFollow(u) — radar laps: lead car breathing 12↔24 m, constant speed.
//   setAeb(u)    — the dummy steps out; warn → pre-fill → partial → full →
//                  stop → dummy clears → pull away.
//   setReveal(t) 0 sealed · 1 ghosted · 2 X-ray · setOverlay(mode) · setLabels

// --- layout ---------------------------------------------------------------------
const R_NEAR = 20;
const R_FAR = -70;
const R_FADE = 15;
const LENS = new THREE.Vector3(0, 1.31, -0.31);
const RADAR = new THREE.Vector3(0, 0.52, -2.13);
const FOV_HALF = (26 * Math.PI) / 180;

// follow lap (radar steps): 12 periods in 10 s
const F_PERIODS = 12;
const F_SPEED = (F_PERIODS * PERIOD) / 10; // 14.4 m/s ≈ 52 km/h
const GAP_MID = 18;
const GAP_AMP = 6;

// AEB lap
const T_AEB = 14; // seconds of story per lap (the step's lap duration)
const A_PERIODS = 9; // 108 m of road per lap
const V0 = 13.9; // 50 km/h
const PED_Z0 = -68; // dummy spawns inside the far fade
const D_WALK = 36; // nose→dummy distance when it steps out (TTC 2.6 s)
const PED_X0 = 2.35;
const PED_X1 = -3.6;
const PED_V = 0.9;
const CLEAR_X = -1.35; // dummy has cleared the car's path
const STAGE_TTC = [2.6, 2.0, 1.6, 0.8]; // warn · pre-fill · partial · full
const STAGE_DECEL = [0, 0, 0, 3, 9];
const STAGE_P = [0, 0, 0.12, 0.45, 1];
const STAGE_NAMES = ['', 'Warning', 'Pre-fill', 'Partial braking', 'Full braking'];
const CAR_Z_OFF = -14; // stopped reference car, further ahead in the next lane
const X_LEFT_LANE = -3.5;

const CYAN = new THREE.Color(0x5ad1ff);
const AMBER = new THREE.Color(0xffb02e);
const RED = new THREE.Color(0xff3b2f);
const BRAKE = new THREE.Color(0xff5a3c);
const IDLE = new THREE.Color(0x6b7380);
const STAGE_COL = [IDLE, AMBER, new THREE.Color(0xff8c2e), BRAKE, RED];

const fadeAt = (z) =>
  Math.pow(clamp01(Math.min((R_NEAR - z) / R_FADE, (z - R_FAR) / R_FADE)), 1.6);

// --- the AEB lap, simulated once at build time --------------------------------------
// Constant-speed TTC drives a latching stage; each stage sets a deceleration
// and a brake-pressure target (first-order rise, τ 0.12 s). After the stop the
// brakes hold until the dummy clears, then a smoothstep pull-away sized so the
// lap covers EXACTLY A_PERIODS road periods and ends back at V0.
function simulateAeb() {
  const dt = 0.002;
  const N = Math.round(T_AEB / dt);
  const S = new Float64Array(N + 1);
  const V = new Float64Array(N + 1);
  const ST = new Uint8Array(N + 1);
  const TTC = new Float64Array(N + 1);
  const P = new Float64Array(N + 1);
  const PX = new Float64Array(N + 1);
  const DEC = new Float64Array(N + 1);
  const tWalk = (-HALF_L - PED_Z0 - D_WALK) / V0;
  const pedX = (t) => (t < tWalk ? PED_X0 : Math.max(PED_X1, PED_X0 - PED_V * (t - tWalk)));
  let s = 0;
  let v = V0;
  let stage = 0;
  let p = 0;
  let tStop = -1;
  let tHold = -1;
  let i = 0;
  for (; i <= N; i++) {
    const t = i * dt;
    const x = pedX(t);
    const d = -HALF_L - (PED_Z0 + s);
    const threat = t >= tWalk && x > CLEAR_X && d > 0;
    const ttc = threat && v > 0.05 ? d / v : Infinity;
    if (tStop < 0) {
      for (let k = 0; k < 4; k++) if (ttc <= STAGE_TTC[k]) stage = Math.max(stage, k + 1);
    }
    const a = tStop < 0 ? STAGE_DECEL[stage] : 0;
    const pTarget = tStop < 0 ? STAGE_P[stage] : 1;
    p += (pTarget - p) * (1 - Math.exp(-dt / 0.12));
    S[i] = s;
    V[i] = v;
    ST[i] = stage;
    TTC[i] = ttc;
    P[i] = p;
    PX[i] = x;
    DEC[i] = v > 0 ? a : 0;
    v = Math.max(0, v - a * dt);
    s += v * dt;
    if (tStop < 0 && v === 0 && stage > 0) tStop = t;
    if (tStop >= 0 && x <= CLEAR_X) {
      tHold = t + 0.4;
      i++;
      break;
    }
  }
  // hold, release, pull away. The lap must end at V0 having covered EXACTLY
  // A_PERIODS road periods, so the hold length is solved from the distance
  // left: a smoothstep ramp over 85% of the remaining time, then cruise.
  const sHold = s;
  const Dr = A_PERIODS * PERIOD - sHold;
  const RAMP = 0.85;
  const R = Dr / (V0 * (1 - RAMP / 2));
  if (T_AEB - R < tHold) console.warn('[aeb] pull-away does not fit the lap', { R, Dr, tHold });
  tHold = Math.max(tHold, T_AEB - R);
  const ta = RAMP * (T_AEB - tHold);
  for (; i <= N; i++) {
    const t = i * dt;
    const held = t < tHold;
    const r = held ? 0 : (t - tHold) / ta;
    const vNow = held ? 0 : r >= 1 ? V0 : V0 * smooth(r);
    p += ((held ? 1 : 0) - p) * (1 - Math.exp(-dt / 0.12));
    S[i] = s;
    V[i] = vNow;
    ST[i] = held ? 4 : 0;
    TTC[i] = Infinity;
    P[i] = p;
    PX[i] = pedX(t);
    DEC[i] = held ? 0 : -(V0 * 6 * clamp01(r) * (1 - clamp01(r))) / ta; // accel squats the nose
    s += vNow * dt;
  }
  // tiny integration residue → scale onto the exact period count
  const k = (A_PERIODS * PERIOD) / S[N];
  for (let j = 0; j <= N; j++) S[j] *= k;
  return { dt, N, S, V, ST, TTC, P, PX, DEC, tWalk, tStop, tHold };
}

function brakeIconTexture() {
  const c = document.createElement('canvas');
  c.width = 128;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#fff';
  g.font = 'bold 40px Arial Black, Arial, sans-serif';
  g.textAlign = 'center';
  g.textBaseline = 'middle';
  g.fillText('BRAKE!', 64, 34);
  return new THREE.CanvasTexture(c);
}

// thin ribbon polyline in a chart plane, updated per frame (capacity in segments)
function ribbonLine(capacity, width, mat) {
  const pos = new Float32Array(capacity * 4 * 3);
  const idx = [];
  for (let k = 0; k < capacity; k++) {
    const a = k * 4;
    idx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setIndex(idx);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.frustumCulled = false;
  function set(segs) {
    const n = Math.min(capacity, segs.length);
    for (let k = 0; k < n; k++) {
      const [x0, y0, x1, y1] = segs[k];
      let dx = x1 - x0;
      let dy = y1 - y0;
      const L = Math.hypot(dx, dy) || 1;
      const nx = (-dy / L) * width * 0.5;
      const ny = (dx / L) * width * 0.5;
      // extend each end by half a width so joints overlap without gaps
      dx = (dx / L) * width * 0.5;
      dy = (dy / L) * width * 0.5;
      const o = k * 12;
      pos.set([x0 - dx + nx, y0 - dy + ny, 0, x0 - dx - nx, y0 - dy - ny, 0, x1 + dx + nx, y1 + dy + ny, 0, x1 + dx - nx, y1 + dy - ny, 0], o);
    }
    geo.setDrawRange(0, n * 6);
    geo.attributes.position.needsUpdate = true;
  }
  return { mesh, set };
}

// --- main build ---------------------------------------------------------------------
export function buildAutomaticEmergencyBraking({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  const labels = calloutSets(['exterior', 'radar', 'echo', 'doppler', 'detect', 'stages', 'esc']);
  const SIM = simulateAeb();

  // --- road ---------------------------------------------------------------------------
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

  // --- cars ----------------------------------------------------------------------------
  const ego = buildCar({ paintColor: 0x2c5f8a, interior: true });
  group.add(ego.root);
  const lead = buildCar({ paintColor: 0x3a3f47, interior: false });
  group.add(lead.root);
  const parked = buildCar({ paintColor: 0xb9bdc4, interior: false });
  parked.root.position.x = X_LEFT_LANE;
  group.add(parked.root);
  // the reference car fades with the road ends, like the dummy
  const fadeMats = new Set();
  parked.root.traverse((o) => {
    if (!o.isMesh) return;
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    o.material = ms.map((m) => {
      const c = m.clone();
      c.transparent = true;
      c.userData.baseOpacity = m.opacity ?? 1;
      fadeMats.add(c);
      return c;
    });
    if (o.material.length === 1) o.material = o.material[0];
  });

  // --- sensors (ego, car-local) ---------------------------------------------------------
  const blackPoly = materials.polymer(0x16181b);
  const camBody = beveledBox(0.15, 0.07, 0.11, blackPoly, 0.02);
  camBody.position.set(0, LENS.y, LENS.z + 0.07);
  const lens = new THREE.Mesh(
    new THREE.CylinderGeometry(0.019, 0.022, 0.03, 28),
    new THREE.MeshPhysicalMaterial({ color: 0x06080c, roughness: 0.05, clearcoat: 1, iridescence: 0.5 }),
  );
  lens.rotation.x = Math.PI / 2 + 0.07;
  lens.position.copy(LENS).add(new THREE.Vector3(0, 0, 0.005));
  const mirrorBody = beveledBox(0.25, 0.07, 0.035, blackPoly, 0.015);
  mirrorBody.position.set(0, 1.25, -0.12);
  const mirrorStalk = rod(0.008, 0.16, blackPoly);
  mirrorStalk.position.set(0, 1.26, -0.14);
  ego.root.add(camBody, lens, mirrorBody, mirrorStalk);

  const radarGroup = new THREE.Group();
  radarGroup.position.copy(RADAR);
  radarGroup.add(beveledBox(0.12, 0.1, 0.05, materials.polymer(0x2a2d33), 0.012));
  {
    const radome = beveledBox(0.105, 0.085, 0.008, materials.polymer(0x3d424a), 0.003);
    radome.position.z = -0.027;
    radarGroup.add(radome);
    const patchMat = new THREE.MeshStandardMaterial({ color: 0xc9a14a, metalness: 1, roughness: 0.35 });
    for (let i = 0; i < 4; i++) {
      for (let j = 0; j < 3; j++) {
        const pch = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.012, 0.002), patchMat);
        pch.position.set(-0.03 + i * 0.02, -0.02 + j * 0.02, -0.032);
        radarGroup.add(pch);
      }
    }
  }
  ego.root.add(radarGroup);

  // --- brakes: calipers + pads on all four wheels ----------------------------------------
  const caliperMat = new THREE.MeshPhysicalMaterial({
    color: 0xb3241c,
    metalness: 0.2,
    roughness: 0.45,
    clearcoat: 0.4,
    emissive: BRAKE,
    emissiveIntensity: 0,
  });
  const padMat = materials.darkMetal(0x4a4d52);
  padMat.roughness = 0.8;
  const calipers = [];
  const pads = [];
  const caliperInboard = []; // car-local point where the brake line lands
  ego.pivots.forEach((pivot, i) => {
    const side = i % 2 === 0 ? -1 : 1; // FL, FR, RL, RR
    const discX = -side * 0.01;
    const a = Math.PI / 4; // top-rear of the disc
    const holder = new THREE.Group();
    holder.position.set(discX, Math.sin(a) * 0.13, Math.cos(a) * 0.13);
    holder.rotation.x = -(Math.PI / 2 - a);
    const body = beveledBox(0.075, 0.07, 0.11, caliperMat, 0.018);
    holder.add(body);
    const pIn = beveledBox(0.008, 0.05, 0.085, padMat, 0.003);
    const pOut = pIn.clone();
    holder.add(pIn, pOut);
    pivot.add(holder);
    calipers.push(body);
    pads.push([pIn, pOut]);
    caliperInboard.push(new THREE.Vector3(-side * 0.06, 0.13, 0.11));
  });

  // brighter discs so the clamp reads (the shared wheel's disc is dark)
  const discSteel = materials.steel(0xa7aeb7);
  discSteel.roughness = 0.45;
  ego.spins.forEach((sp) =>
    sp.traverse((o) => {
      if (o.isMesh && o.geometry.type === 'CylinderGeometry' && o.geometry.parameters.radiusTop === 0.15) o.material = discSteel;
    }),
  );

  // --- ESC hydraulic unit, booster + master cylinder, lines, pedal -------------------------
  const escAl = materials.aluminum(0xb7bdc5);
  escAl.roughness = 0.6;
  const esc = new THREE.Group();
  esc.position.set(0.42, 0.62, -1.28);
  const escBlock = beveledBox(0.15, 0.12, 0.13, escAl, 0.012);
  esc.add(escBlock);
  // pump motor sticks out rearward from the block (axis +z)
  const pumpMotor = new THREE.Group();
  const motorCan = rod(0.045, 0.1, materials.darkMetal(0x2a2d32), 28);
  motorCan.rotation.x = Math.PI / 2;
  pumpMotor.add(motorCan);
  const motorCap = new THREE.Group(); // spinning end cap with a stripe
  motorCap.position.set(0, 0, 0.105);
  motorCap.add(new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.01, 24).rotateX(Math.PI / 2), escAl));
  const motorStripe = beveledBox(0.012, 0.06, 0.012, new THREE.MeshBasicMaterial({ color: 0xe8ecf2 }), 0.003);
  motorStripe.position.set(0, 0.012, 0.006);
  motorCap.add(motorStripe);
  pumpMotor.add(motorCap);
  pumpMotor.position.set(0, -0.01, 0.065);
  esc.add(pumpMotor);
  const coilMat = new THREE.MeshStandardMaterial({ color: 0x1b1d21, roughness: 0.5, emissive: BRAKE, emissiveIntensity: 0 });
  const valveCoils = [];
  for (let i = 0; i < 4; i++) {
    for (let j = 0; j < 2; j++) {
      const c = rod(0.014, 0.035, coilMat, 16);
      c.position.set(-0.045 + i * 0.03, 0.06, -0.03 + j * 0.06);
      esc.add(c);
      valveCoils.push(c);
    }
  }
  const ecuCover = beveledBox(0.13, 0.03, 0.12, blackPoly, 0.01);
  ecuCover.position.set(0.0, 0.09, 0.0);
  esc.add(ecuCover);
  ego.root.add(esc);
  // you can see the front-left caliper between the spokes, so that rim must
  // not count as a label occluder (the tyre still does)
  ego.spins[0].traverse((o) => {
    if (o.isMesh && o.material !== ego.spins[0].children[0].children[0].material) o.userData.noOcclude = true;
  });

  const booster = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.12, 40), materials.steel(0x6d737c));
  booster.rotation.x = Math.PI / 2;
  booster.position.set(DRIVER_X, 0.72, -0.98);
  const mc = rod(0.03, 0.2, escAl, 24);
  mc.rotation.x = -Math.PI / 2;
  mc.position.set(DRIVER_X, 0.72, -1.04);
  const reservoir = beveledBox(0.1, 0.06, 0.07, new THREE.MeshStandardMaterial({ color: 0xd8d2b8, roughness: 0.5, transparent: true, opacity: 0.85 }), 0.02);
  reservoir.position.set(DRIVER_X, 0.79, -1.14);
  ego.root.add(booster, mc, reservoir);

  // pedal: pivot under the dash, pad in the footwell — it never moves
  const pedal = new THREE.Group();
  pedal.position.set(DRIVER_X + 0.06, 0.74, -0.74);
  const pedalArm = rod(0.012, 0.32, escAl);
  pedalArm.rotation.x = Math.PI - 0.35;
  const pedalPad = beveledBox(0.08, 0.1, 0.02, materials.rubber(0x1a1b1e), 0.008);
  pedalPad.position.set(0, -0.3, 0.1);
  pedalPad.rotation.x = -0.35;
  pedal.add(pedalArm, pedalPad);
  ego.root.add(pedal);

  const lineMat = materials.steel(0x9aa2ad);
  lineMat.roughness = 0.35;
  const brakeLines = [];
  const lineTo = (pts) => {
    const t = tubeAlong(pts, 0.006, lineMat, { tubularSegments: 64, radialSegments: 8 });
    ego.root.add(t);
    brakeLines.push(t);
    return t;
  };
  const escOut = (dx) => [0.42 + dx, 0.6, -1.36];
  // master cylinder → ESC (two circuits)
  lineTo([[DRIVER_X, 0.72, -1.15], [-0.1, 0.7, -1.3], [0.3, 0.64, -1.32], [0.36, 0.62, -1.28]]);
  lineTo([[DRIVER_X + 0.02, 0.7, -1.12], [-0.05, 0.66, -1.22], [0.3, 0.6, -1.22], [0.36, 0.6, -1.24]]);
  const wheelPos = ego.pivots.map((p) => p.position.clone());
  const calLine = (i) => wheelPos[i].clone().add(caliperInboard[i]).toArray();
  // ESC → front calipers
  lineTo([escOut(-0.04), [0.1, 0.5, -1.45], [-0.45, 0.48, -1.38], calLine(0)]);
  lineTo([escOut(0.04), [0.6, 0.5, -1.4], calLine(1)]);
  // ESC → rear calipers along the floor
  lineTo([escOut(-0.02), [0.2, 0.22, -1.1], [-0.25, 0.2, 0.2], [-0.55, 0.3, 1.25], calLine(2)]);
  lineTo([escOut(0.02), [0.3, 0.22, -1.1], [0.3, 0.2, 0.2], [0.55, 0.3, 1.25], calLine(3)]);
  // pressure packets riding ESC → caliper lines
  const packetMat = glowMat(BRAKE, 1, false);
  const packets = [];
  for (const line of brakeLines.slice(2)) {
    for (let k = 0; k < 4; k++) {
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.014, 10, 8), packetMat);
      d.userData = { curve: line.userData.curve, k };
      ego.root.add(d);
      packets.push(d);
    }
  }

  // dash lamp
  const lampMat = new THREE.MeshBasicMaterial({
    map: brakeIconTexture(),
    color: RED,
    transparent: true,
    opacity: 0.1,
    depthWrite: false,
    toneMapped: false,
  });
  const lamp = new THREE.Mesh(new THREE.PlaneGeometry(0.1, 0.05), lampMat);
  lamp.position.set(DRIVER_X, 0.975, -0.535);
  lamp.rotation.x = -0.25;
  const haloMat = glowMat(RED, 0);
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.16, 16, 12), haloMat);
  halo.position.copy(lamp.position);
  ego.root.add(lamp, halo);

  // --- the pedestrian test dummy on its low platform --------------------------------------
  const ped = new THREE.Group();
  group.add(ped);
  const fabric = new THREE.MeshPhysicalMaterial({ color: 0x3d4148, roughness: 0.95, transparent: true });
  const headMat = new THREE.MeshPhysicalMaterial({ color: 0x9aa1aa, roughness: 0.85, transparent: true });
  const platMat = new THREE.MeshPhysicalMaterial({ color: 0x1d1f23, roughness: 0.7, metalness: 0.3, transparent: true });
  const pedMats = [fabric, headMat, platMat];
  const platform = beveledBox(0.95, 0.06, 0.6, platMat, 0.025);
  platform.position.y = 0.03;
  ped.add(platform);
  const figure = new THREE.Group(); // faces −z in its own frame; ped is turned to walk −x
  ped.add(figure);
  const pelvis = beveledBox(0.3, 0.16, 0.18, fabric, 0.05);
  pelvis.position.y = 0.95;
  const torso = beveledBox(0.36, 0.52, 0.2, fabric, 0.07);
  torso.position.y = 1.3;
  const neck = rod(0.04, 0.08, headMat);
  neck.position.y = 1.56;
  const head = new THREE.Mesh(new THREE.SphereGeometry(0.105, 24, 18), headMat);
  head.scale.set(0.95, 1.15, 1);
  head.position.y = 1.72;
  figure.add(pelvis, torso, neck, head);
  const limb = (r, len, mat) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len - 2 * r, 6, 14), mat);
    m.position.y = -len / 2;
    return m;
  };
  const legs = [];
  const arms = [];
  for (const s of [-1, 1]) {
    const hip = new THREE.Group();
    hip.position.set(s * 0.09, 0.9, 0);
    hip.add(limb(0.065, 0.86, fabric));
    const foot = beveledBox(0.09, 0.05, 0.22, fabric, 0.02);
    foot.position.set(0, -0.84, -0.05);
    hip.add(foot);
    figure.add(hip);
    legs.push(hip);
    const sh = new THREE.Group();
    sh.position.set(s * 0.215, 1.5, 0);
    sh.add(limb(0.045, 0.62, fabric));
    figure.add(sh);
    arms.push(sh);
  }
  ped.rotation.y = Math.PI / 2; // facing −x: about to cross from the right kerb
  ped.traverse((o) => o.isMesh && (o.castShadow = true));
  // camera bounding brackets on the dummy (ped-local)
  const pedBox = new THREE.Group();
  {
    const bm = glowMat(CYAN, 0.95, false);
    const hx = 0.42;
    const hz = 0.42;
    const L = 0.22;
    for (const sx of [-1, 1]) {
      for (const sz of [-1, 1]) {
        for (const sy of [0, 1]) {
          const c = new THREE.Vector3(sx * hx, sy ? 1.92 : 0.02, sz * hz);
          for (const [ax, dir] of [
            ['x', -sx],
            ['y', sy ? -1 : 1],
            ['z', -sz],
          ]) {
            const r = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, L, 6), bm);
            r.position.copy(c);
            r.position[ax] += (dir * L) / 2;
            if (ax === 'x') r.rotation.z = Math.PI / 2;
            if (ax === 'z') r.rotation.x = Math.PI / 2;
            pedBox.add(r);
          }
        }
      }
    }
  }
  ped.add(pedBox);
  const pedBoxAnchor = new THREE.Object3D();
  pedBoxAnchor.position.set(0, 1.95, 0);
  pedBox.add(pedBoxAnchor);

  // --- overlays ------------------------------------------------------------------------
  const ov = {
    waves: new THREE.Group(),
    chart: new THREE.Group(),
    ring: new THREE.Group(),
    detect: new THREE.Group(),
  };
  for (const g of Object.values(ov)) group.add(g);

  // radar wavefronts out / echoes back
  const WAVES = 5;
  const waveGeo = new THREE.CylinderGeometry(1, 1, 0.04, 32, 1, true, Math.PI - 0.15, 0.3);
  const echoGeo = new THREE.CylinderGeometry(1, 1, 0.04, 32, 1, true, -0.2, 0.4);
  const outWaves = [];
  const echoWaves = [];
  for (let k = 0; k < WAVES; k++) {
    const o = new THREE.Mesh(waveGeo, glowMat(CYAN, 0.6));
    const e = new THREE.Mesh(echoGeo, glowMat(AMBER, 0.5));
    ov.waves.add(o, e);
    outWaves.push(o);
    echoWaves.push(e);
  }

  // pitch-over-time chart: a dark card standing beside the road ahead
  const CW = 2.7;
  const CH = 1.35;
  const chart = ov.chart;
  chart.position.set(4.3, 1.1, -7.2);
  chart.lookAt(new THREE.Vector3(9, 2.4, 6)); // faces the radar steps' camera family
  const card = new THREE.Mesh(
    new THREE.PlaneGeometry(CW + 0.5, CH + 0.55),
    new THREE.MeshBasicMaterial({ color: 0x0b0f16, transparent: true, opacity: 0.78, depthWrite: false, side: THREE.DoubleSide }),
  );
  card.position.set(CW / 2, CH / 2 + 0.05, -0.01);
  chart.add(card);
  const axisMat = glowMat(0x8a94a3, 0.9, false);
  const axisX = new THREE.Mesh(new THREE.PlaneGeometry(CW + 0.1, 0.018), axisMat);
  axisX.position.set(CW / 2, 0, 0);
  const axisY = new THREE.Mesh(new THREE.PlaneGeometry(0.018, CH + 0.1), axisMat);
  axisY.position.set(0, CH / 2, 0);
  chart.add(axisX, axisY);
  const sentLine = ribbonLine(12, 0.045, glowMat(CYAN, 1, false));
  const echoLine = ribbonLine(12, 0.045, glowMat(AMBER, 1, false));
  sentLine.mesh.position.z = 0.01;
  echoLine.mesh.position.z = 0.012;
  chart.add(sentLine.mesh, echoLine.mesh);
  const beatBar = new THREE.Group(); // double-headed arrow spanning the pitch gap
  const beatMat = glowMat(0xffffff, 0.95, false);
  const beatShaft = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 1), beatMat);
  const headGeo = new THREE.ShapeGeometry(
    new THREE.Shape([new THREE.Vector2(-0.07, 0), new THREE.Vector2(0.07, 0), new THREE.Vector2(0, 0.1)]),
  );
  const headTop = new THREE.Mesh(headGeo, beatMat);
  const headBot = new THREE.Mesh(headGeo, beatMat);
  headBot.rotation.z = Math.PI;
  beatBar.add(beatShaft, headTop, headBot);
  chart.add(beatBar);
  const beatAnchor = new THREE.Object3D();
  chart.add(beatAnchor);
  const sentAnchor = new THREE.Object3D();
  const echoAnchor = new THREE.Object3D();
  chart.add(sentAnchor, echoAnchor);
  const axisAnchor = new THREE.Object3D();
  axisAnchor.position.set(0, CH, 0);
  chart.add(axisAnchor);
  const TC = CW / 3; // three chirps across the card

  // time-to-collision ring
  const ring = ov.ring;
  ring.position.set(2.2, 2.3, -5.5);
  ring.lookAt(new THREE.Vector3(9, 3.2, 5));
  const RING_MAX = 3.0; // seconds full-scale
  const ringBack = new THREE.Mesh(new THREE.RingGeometry(0.62, 0.7, 96), glowMat(0x2a3140, 0.8, false));
  const ringGeo = new THREE.RingGeometry(0.6, 0.72, 96, 1, Math.PI / 2, -TAU);
  const ringMat = glowMat(AMBER, 1, false);
  const ringFill = new THREE.Mesh(ringGeo, ringMat);
  ringFill.position.z = 0.005;
  const ringDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.6, 64),
    new THREE.MeshBasicMaterial({ color: 0x0b0f16, transparent: true, opacity: 0.72, depthWrite: false }),
  );
  ringDisc.position.z = -0.005;
  ring.add(ringDisc, ringBack, ringFill);
  const tickAnchors = STAGE_TTC.map((s, k) => {
    // clockwise from 12 o'clock: fraction s / RING_MAX of a turn
    const a = Math.PI / 2 - (s / RING_MAX) * TAU;
    const tick = new THREE.Mesh(new THREE.PlaneGeometry(0.035, 0.24), glowMat(STAGE_COL[k + 1], 1, false));
    tick.position.set(Math.cos(a) * 0.66, Math.sin(a) * 0.66, 0.01);
    tick.rotation.z = a - Math.PI / 2;
    ring.add(tick);
    const an = new THREE.Object3D();
    an.position.set(Math.cos(a) * 0.82, Math.sin(a) * 0.82, 0);
    ring.add(an);
    return an;
  });
  const ringCentre = new THREE.Object3D();
  ringCentre.position.set(0, 0.74, 0); // live readout sits on top of the ring
  ring.add(ringCentre);

  // detection overlays: camera cone to the dummy, radar blips, predicted path
  const coneGeo = new THREE.BufferGeometry();
  coneGeo.setAttribute('position', new THREE.Float32BufferAttribute(new Float32Array(9 * 2), 3));
  coneGeo.setAttribute(
    'color',
    new THREE.Float32BufferAttribute([0.35, 0.82, 1, 0.14, 0.35, 0.82, 1, 0, 0.35, 0.82, 1, 0, 0.35, 0.82, 1, 0.14, 0.35, 0.82, 1, 0, 0.35, 0.82, 1, 0], 4),
  );
  const cone = new THREE.Mesh(
    coneGeo,
    new THREE.MeshBasicMaterial({ vertexColors: true, transparent: true, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, toneMapped: false }),
  );
  cone.frustumCulled = false;
  ov.detect.add(cone);
  const pedBlipMat = glowMat(AMBER, 0.5);
  const pedBlip = new THREE.Mesh(new THREE.SphereGeometry(0.09, 14, 10), pedBlipMat);
  const carBlipMat = glowMat(AMBER, 0.95);
  const carBlip = new THREE.Mesh(new THREE.SphereGeometry(0.32, 18, 12), carBlipMat);
  ov.detect.add(pedBlip, carBlip);
  const pathMat = glowMat(AMBER, 0.75, false);
  const path = flatStrip(pathMat);
  path.rotation.y = Math.PI / 2; // strip runs −x
  ov.detect.add(path);
  const pathAnchor = new THREE.Object3D();
  ov.detect.add(pathAnchor);

  for (const g of Object.values(ov)) noAO(g);
  noAO(pedBox);
  for (const m of [lamp, halo, ...packets]) noAO(m);

  // --- labels --------------------------------------------------------------------------
  const camAnchor = new THREE.Object3D();
  camAnchor.position.set(0, LENS.y + 0.03, LENS.z + 0.07);
  ego.root.add(camAnchor);
  const badgeAnchor = new THREE.Object3D();
  badgeAnchor.position.set(0, 0.56, -2.29);
  ego.root.add(badgeAnchor);
  labels.add('exterior', badgeAnchor, 'Radar, behind the badge', [0, 0, 0], -30, 60);
  labels.add('exterior', camAnchor, 'Windshield camera', [0, 0, 0], 70, 60);
  labels.add('radar', radarGroup, 'Radar · 77 GHz', [0, 0.06, 0], 40, 60);
  labels.add('radar', sentAnchor, 'Sent (blue): a note rising in pitch', [0, 0, 0], 40, 50);
  labels.add('radar', axisAnchor, 'Pitch', [0, 0, 0], 120, 30);
  labels.add('echo', sentAnchor, 'Sent (blue)', [0, 0, 0], 40, 40);
  labels.add('echo', echoAnchor, 'Echo (orange): same note, late', [0, 0, 0], -30, 50);
  labels.add('echo', beatAnchor, 'Pitch gap = distance', [0, 0, 0], 20, 60);
  labels.add('doppler', echoAnchor, 'Echo (orange) lifted by Doppler', [0, 0, 0], -30, 50);
  labels.add('doppler', beatAnchor, 'Pitch gap = distance', [0, 0, 0], 20, 60);
  const ttcLabel = labels.add('doppler', ringCentre, 'Time to collision', [0, 0, 0], 20, 70);
  labels.add('detect', camAnchor, 'Windshield camera', [0, 0, 0], 70, 50);
  labels.add('detect', pedBoxAnchor, 'Camera: “pedestrian”', [0, 0, 0], 40, 50);
  labels.add('detect', pedBlip, 'Weak radar echo', [0, 0, 0], -40, 55);
  labels.add('detect', carBlip, 'Car: strong echo', [0, 0, 0], 50, 50);
  labels.add('detect', pathAnchor, 'Predicted path', [0, 0, 0], -60, 50);
  const stageLabel = labels.add('stages', ringCentre, 'Time to collision', [0, 0, 0], 80, 40);
  // fanned radially outward from each tick (screen degrees)
  ['Warn 2.6 s', 'Pre-fill 2.0 s', 'Partial 1.6 s', 'Full 0.8 s'].forEach((t, k) =>
    labels.add('stages', tickAnchors[k], t, [0, 0, 0], [150, 205, 255, -15][k], 38),
  );
  labels.add('stages', lamp, 'BRAKE! warning', [0, 0.03, 0], 60, 60);
  labels.add('esc', escBlock, 'ESC unit: its own pump', [0, 0.08, 0], 40, 60);
  labels.add('esc', motorCap, 'Pump motor', [0, 0, 0], -40, 50);
  labels.add('esc', valveCoils[6], 'Valves', [0, 0.03, 0], 70, 45);
  // the caliper hides inside the tyre from above; label where its line enters
  const calLineAnchor = new THREE.Object3D();
  calLineAnchor.position.copy(brakeLines[2].userData.curve.getPointAt(0.72)); // clear of the tyre
  ego.root.add(calLineAnchor);
  labels.add('esc', calLineAnchor, 'Fluid to the caliper', [0, 0, 0], -50, 50);
  labels.add('esc', pedalPad, 'Brake pedal: untouched', [0, 0, 0], -120, 50);

  // --- pose ----------------------------------------------------------------------------
  const state = { overlay: 'none' };
  const _v = new THREE.Vector3();
  const _w = new THREE.Vector3();
  const F_TURNS = Math.round((F_PERIODS * PERIOD) / (TAU * TYRE_R));
  const A_TURNS = Math.round((A_PERIODS * PERIOD) / (TAU * TYRE_R));
  const radarW = RADAR.clone(); // ego never moves sideways here
  const lensW = LENS.clone();

  function setFade(mats, a) {
    for (const m of mats) {
      m.opacity = (m.userData.baseOpacity ?? 1) * a;
      m.depthWrite = a > 0.99;
      m.visible = a > 0.01;
    }
  }

  // st: { u, s, wheel, decel, pressure, stage, ttc, threat, pedX, pedZ, walk,
  //       gap, closing, leadWheel }
  function apply(st) {
    roadTex.offset.y = frac(st.s / PERIOD);
    for (const sp of ego.spins) sp.rotation.x = -st.wheel;
    // nose dives under braking (drawn ~0.7° at 9 m/s²)
    ego.root.rotation.x = -(st.decel || 0) * 0.0014;
    // brakes
    const p = st.pressure || 0;
    caliperMat.emissiveIntensity = p * 1.6;
    coilMat.emissiveIntensity = p > 0.02 && p < 0.98 ? 1.4 : p * 0.4;
    const gap = 0.012 * (1 - clamp01(p / 0.12)); // pads travel to the disc at pre-fill
    pads.forEach(([pin, pout]) => {
      pin.position.x = -(0.0145 + gap);
      pout.position.x = 0.0145 + gap;
    });
    motorCap.rotation.z = st.pumpAngle || 0;
    for (const d of packets) {
      const on = p > 0.03 && (state.overlay === 'esc' || state.overlay === 'stages');
      d.visible = on;
      if (on) d.position.copy(d.userData.curve.getPointAt(frac((st.u || 0) * 20 + d.userData.k / 4)));
    }
    packetMat.opacity = clamp01(p * 3);
    const lampOn = st.stage >= 1 ? 1 : 0;
    lampMat.opacity = 0.1 + 0.9 * lampOn;
    // the halo only helps the far road shots; in the ESC close-up it would
    // sit over the unit as a red blob
    haloMat.opacity = state.overlay === 'esc' ? 0 : 0.7 * lampOn;
    // lead car
    const g = st.gap ?? GAP_MID;
    lead.root.position.set(0, 0, -2 * HALF_L - g);
    for (const sp of lead.spins) sp.rotation.x = -(st.leadWheel ?? st.wheel);
    // dummy + reference car
    if (st.pedZ !== undefined) {
      ped.position.set(st.pedX, 0, st.pedZ);
      const a = fadeAt(st.pedZ);
      setFade(pedMats, a);
      const sw = st.walk || 0;
      legs[0].rotation.x = sw * 0.42;
      legs[1].rotation.x = -sw * 0.42;
      arms[0].rotation.x = -sw * 0.3;
      arms[1].rotation.x = sw * 0.3;
      const cz = st.pedZ + CAR_Z_OFF;
      parked.root.position.z = cz;
      setFade(fadeMats, fadeAt(cz));
    }
    group.updateMatrixWorld(true);
    if (state.overlay === 'radar' || state.overlay === 'echo' || state.overlay === 'doppler') {
      poseWaves(st, g);
      poseChart(st, g);
    }
    if (state.overlay === 'doppler') poseRing(st.leadTtc, st.closing > 0.3 ? 1 : 0, ttcLabel);
    if (state.overlay === 'stages' || state.overlay === 'run') poseRing(st.ttc, st.stage, stageLabel, st);
    if (state.overlay === 'detect') poseDetect(st);
  }

  function poseWaves(st, g) {
    const R = radarW;
    const T = _v.set(0, 0.52, -HALF_L - g);
    const dist = R.distanceTo(T);
    for (let k = 0; k < WAVES; k++) {
      const p = frac(st.u * 10 + k / WAVES);
      const o = outWaves[k];
      o.position.copy(R);
      o.scale.set(Math.max(0.05, p * dist), 1, Math.max(0.05, p * dist));
      o.material.opacity = 0.95 * Math.sin(Math.PI * p);
      const q = frac(st.u * 10 + (k + 0.5) / WAVES);
      const e = echoWaves[k];
      e.position.copy(T);
      e.scale.set(Math.max(0.05, q * dist), 1, Math.max(0.05, q * dist));
      e.material.opacity = (state.overlay === 'radar' ? 0.45 : 0.8) * Math.sin(Math.PI * q);
    }
  }

  function poseChart(st, g) {
    // sawtooth scrolls left: whole chirps per lap (10 per follow lap)
    const ph = frac(st.u * 10);
    const tau = (g / 30) * 0.42 * TC; // drawn delay, proportional to range
    const showEcho = state.overlay !== 'radar';
    const lift = state.overlay === 'doppler' ? clamp01((st.closing || 0) / 4) * 0.16 - clamp01(-(st.closing || 0) / 4) * 0.16 : 0;
    const saw = (delay, dy) => {
      const segs = [];
      for (let k = -1; k <= 4; k++) {
        const x0 = (k - ph) * TC + delay;
        const x1 = x0 + TC;
        const a = Math.max(0, x0);
        const b = Math.min(CW, x1);
        if (b <= a) continue;
        const ya = ((a - x0) / TC) * CH + dy;
        const yb = ((b - x0) / TC) * CH + dy;
        segs.push([a, clampY(ya), b, clampY(yb)]);
        if (x1 < CW && x1 > 0) segs.push([x1, clampY(CH + dy), x1, clampY(dy)]); // reset drop
      }
      return segs;
    };
    const clampY = (y) => Math.min(CH + 0.1, Math.max(-0.05, y));
    sentLine.set(saw(0, 0));
    echoLine.mesh.visible = showEcho;
    if (showEcho) echoLine.set(saw(tau, lift));
    // beat bracket at the chirp nearest the card's middle where both ramps overlap
    let best = null;
    for (let k = -1; k <= 4; k++) {
      const x0 = (k - ph) * TC + tau; // echo ramp start
      const xa = Math.max(x0, 0.08);
      const xb = Math.min((k + 1 - ph) * TC, CW - 0.08);
      if (xb - xa < 0.12) continue;
      const xm = (xa + xb) / 2;
      if (!best || Math.abs(xm - CW * 0.55) < Math.abs(best - CW * 0.55)) best = xm;
    }
    const bh = (tau / TC) * CH - lift;
    beatBar.visible = showEcho && best !== null && bh > 0.05;
    if (beatBar.visible) {
      const k0 = Math.floor(best / TC + ph);
      const ySent = ((best - (k0 - ph) * TC) / TC) * CH;
      const yEcho = ySent - bh;
      beatShaft.scale.y = Math.max(0.01, bh - 0.2);
      beatShaft.position.set(0, (ySent + yEcho) / 2, 0);
      headTop.position.set(0, ySent - 0.1, 0);
      headBot.position.set(0, yEcho + 0.1, 0);
      beatBar.position.set(best, 0, 0.014);
      beatAnchor.position.set(best + 0.04, (ySent + yEcho) / 2, 0);
    }
    const onSaw = (x, delay, dy) => ((((x - delay) / TC + ph) % 1) + 1) % 1 * CH + dy;
    sentAnchor.position.set(CW * 0.2, onSaw(CW * 0.2, 0, 0), 0);
    const xe = CW * 0.82;
    echoAnchor.position.set(xe, Math.min(CH, onSaw(xe, tau, lift)), 0);
  }

  function poseRing(ttc, stage, label, st) {
    const live = isFinite(ttc) && ttc > 0;
    const f = live ? clamp01(ttc / RING_MAX) : 1;
    ringFill.geometry.setDrawRange(0, Math.round(f * 96) * 6);
    const col = state.overlay === 'doppler' ? (live ? CYAN : IDLE) : STAGE_COL[Math.min(4, stage || 0)];
    ringMat.color.copy(col);
    ringMat.opacity = live || stage ? 1 : 0.45;
    let txt;
    if (state.overlay === 'doppler') txt = live ? `Time to collision ${ttc.toFixed(1)} s` : 'Opening: no collision course';
    else if (st && st.stopped) txt = 'Stopped';
    else if (live) txt = `${ttc.toFixed(1)} s · ${STAGE_NAMES[stage] || 'tracking'}`;
    else txt = 'No collision course';
    label.setText(txt);
  }

  function poseDetect(st) {
    // view cone from the lens to the dummy's silhouette
    const P = _w.set(st.pedX, 0, st.pedZ);
    const d = lensW.distanceTo(P);
    const a = fadeAt(st.pedZ);
    cone.visible = a > 0.05 && d < 55;
    if (cone.visible) {
      const hw = Math.max(0.6, d * Math.tan(FOV_HALF) * 0.18);
      const pos = coneGeo.attributes.position;
      const zF = st.pedZ;
      pos.setXYZ(0, lensW.x, lensW.y, lensW.z);
      pos.setXYZ(1, st.pedX - hw, 0.02, zF);
      pos.setXYZ(2, st.pedX + hw, 0.02, zF);
      pos.setXYZ(3, lensW.x, lensW.y, lensW.z);
      pos.setXYZ(4, st.pedX - hw, 2.0, zF);
      pos.setXYZ(5, st.pedX + hw, 2.0, zF);
      pos.needsUpdate = true;
      coneGeo.computeBoundingSphere();
    }
    pedBox.visible = a > 0.3;
    // radar returns: the dummy flickers weakly, the car glows steadily
    pedBlip.position.set(st.pedX, 1.0, st.pedZ + 0.25);
    pedBlipMat.opacity = a * (0.25 + 0.2 * Math.abs(Math.sin(st.u * 90)));
    const cz = st.pedZ + CAR_Z_OFF;
    carBlip.position.set(X_LEFT_LANE, 0.6, cz + HALF_L + 0.1);
    carBlipMat.opacity = 0.9 * fadeAt(cz);
    // predicted path across the lane while it is a threat
    const showPath = st.walking && st.pedX > CLEAR_X;
    path.visible = showPath;
    if (showPath) {
      const len = st.pedX - PED_X1;
      path.position.set(st.pedX, 0.02, st.pedZ);
      path.scale.set(0.12, 1, len);
      pathAnchor.position.set(st.pedX - len * 0.45, 0.03, st.pedZ);
    }
  }

  // --- lap functions -------------------------------------------------------------------
  function setFollow(u) {
    const s = u * F_PERIODS * PERIOD;
    const gap = GAP_MID + GAP_AMP * Math.cos(TAU * u);
    const closing = ((GAP_AMP * TAU) / 10) * Math.sin(TAU * u); // m/s, + = closing
    const wheel = (s / (F_PERIODS * PERIOD)) * F_TURNS * TAU;
    const perM = (F_TURNS * TAU) / (F_PERIODS * PERIOD);
    apply({
      u,
      s,
      wheel,
      gap,
      closing,
      leadTtc: closing > 0.3 ? gap / closing : Infinity,
      leadWheel: wheel + (gap - (GAP_MID + GAP_AMP)) * perM,
    });
  }

  function setAeb(u) {
    const t = frac(u) * T_AEB;
    const i = Math.min(SIM.N, Math.round(t / SIM.dt));
    const s = SIM.S[i];
    const walking = t >= SIM.tWalk && SIM.PX[i] > PED_X1;
    const walkEnv = clamp01((t - SIM.tWalk) / 0.3) * clamp01((PED_X1 - SIM.PX[i]) / -0.3);
    apply({
      u,
      s,
      wheel: (s / (A_PERIODS * PERIOD)) * A_TURNS * TAU,
      decel: SIM.DEC[i],
      pressure: SIM.P[i],
      stage: SIM.ST[i],
      ttc: SIM.TTC[i],
      stopped: SIM.V[i] === 0,
      pumpAngle: u * 160 * TAU, // whole turns per lap
      pedX: SIM.PX[i],
      pedZ: PED_Z0 + s,
      walk: walking ? walkEnv * Math.sin((t - SIM.tWalk) * TAU * 0.9) : 0,
      walking,
    });
  }

  // --- layers --------------------------------------------------------------------------
  // 0 sealed · 1 body ghosted · 2 X-ray (body + cabin gone, for the macro)
  function setReveal(t) {
    const r = t > 0.5;
    const xray = t > 1.5;
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
    for (const m of [camBody, lens, mirrorBody, mirrorStalk]) m.visible = !xray;
    lamp.visible = halo.visible = !xray;
  }
  // 'none' | 'radar' | 'echo' | 'doppler' | 'detect' | 'stages' | 'esc' | 'run'
  // also decides which actors are on the road: the lead car belongs to the
  // radar laps, the dummy + reference car to the AEB laps.
  function setOverlay(mode) {
    const m = mode || 'none';
    state.overlay = m;
    const follow = m === 'none' || m === 'radar' || m === 'echo' || m === 'doppler';
    lead.root.visible = follow;
    ped.visible = parked.root.visible = !follow;
    ov.waves.visible = m === 'radar' || m === 'echo' || m === 'doppler';
    ov.chart.visible = ov.waves.visible;
    ov.ring.visible = m === 'doppler' || m === 'stages' || m === 'run';
    // the ring sits by the chart for the radar step, over the bonnet for AEB
    if (m === 'doppler') ring.position.set(1.4, 3.1, -12.5);
    else ring.position.set(2.0, 1.75, -3.6);
    ov.detect.visible = m === 'detect';
    pedBox.visible = m === 'detect';
    for (const d of packets) d.visible = false;
  }

  setReveal(0);
  setOverlay('none');
  setFollow(0);
  labels.setLabels(false);

  return {
    group,
    setFollow,
    setAeb,
    setReveal,
    setOverlay,
    setLabels: labels.setLabels,
    parts: { car: ego.root, lead: lead.root, ped, esc, calipers, sim: SIM },
  };
}
