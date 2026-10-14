import * as THREE from 'three';
import { materials, rod, studioPlinth } from '../../framework/parts.js';
import { beveledBox, tubeAlong } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, win, TAU } from '../../framework/motion.js';

// ANTI-LOCK BRAKING — one wheel corner on a moving road (a treadmill belt), the
// ABS hydraulic unit and pedal beside it, and a floating grip-vs-slip chart.
//
// MECHANISM (researched, see story.js): a toothed tone ring turns with the hub
// past a magnetic pick-up; the computer reads pulse rate as wheel speed. When
// the wheel decelerates much faster than the car (slip past the peak of the grip
// curve, ~10-20 %), it works the modulator: INLET valve (normally open) closes =
// HOLD; OUTLET valve (normally closed) opens = RELEASE, dumping caliper fluid
// into a low-pressure ACCUMULATOR while a return PUMP sends it back toward the
// master cylinder (the pedal buzz); then both valves reset = REAPPLY. Up to ~15
// times a second per wheel. Rolling grip > sliding grip, and only a rolling
// wheel can steer.
//
// DISCLOSED SIMPLIFICATIONS: the modulator is drawn as a schematic with glass
// valve bodies so plungers are visible (a real one is a drilled aluminium
// block); the ABS cycle is slowed to ~1 s per cycle so it can be read; pad
// clearance is exaggerated; the grip curve is a stylised dry-road shape.
//
// SCALE: tyre R = 1.0 (so the belt can be a whole number of wheel turns).
// LOOP CONTRACT: every lap advances the belt by nb texture periods (P = 2π/3 m
// so 3 periods = one turn of an R=1 wheel) and the wheel by whole turns; the
// wheel angle table is rescaled to land on a whole turn.

const R = 1.0; // tyre radius
const BELT_Y = 0.262;
const WY = BELT_Y + R; // axle height
const AX = -2.2; // hero axle x
const P = TAU / 3; // belt texture period (m)
const BELT_W = 2.6;
const BELT_L = 6.4;
const TEETH = 24;
const SENSOR_PSI = Math.PI / 2; // sensor azimuth (atan2(z,y)) on the tone ring
const CAL_AZ = -0.7; // caliper azimuth from top toward -z
const PAD_GAP = 0.02;

// stylised dry-road grip curve: peak 1.0 at 15 % slip, 0.72 when locked
const PEAK = 0.15;
const LOCK_GRIP = 0.72;
function mu(s) {
  if (s <= PEAK) return Math.sin((Math.PI / 2) * (s / PEAK));
  return 1 - (1 - LOCK_GRIP) * smooth((s - PEAK) / (1 - PEAK));
}

// ---------------------------------------------------------------- lap tables
const N = 1200;
function buildLap({ nb, v, slip, steer = () => 0 }) {
  const cumB = new Float64Array(N + 1);
  const cumW = new Float64Array(N + 1);
  for (let i = 0; i < N; i++) {
    const u = (i + 0.5) / N;
    const vv = v(u);
    cumB[i + 1] = cumB[i] + vv / N;
    cumW[i + 1] = cumW[i] + ((1 - slip(u)) * vv) / N;
  }
  const rawTurns = ((nb * P) / TAU) * (cumW[N] / cumB[N]);
  const turns = Math.max(1, Math.round(rawTurns));
  const at = (cum, u) => {
    const x = clamp01(u) * N;
    const i = Math.min(N - 1, Math.floor(x));
    return cum[i] + (cum[i + 1] - cum[i]) * (x - i);
  };
  return {
    steer,
    belt: (u) => (nb * P * at(cumB, u)) / cumB[N],
    wheel: (u) => (turns * TAU * at(cumW, u)) / cumW[N],
  };
}

// ---- one ABS cycle (c in 0..1): reapply -> hold -> release -> dwell
const pCyc = (c) =>
  c < 0.4 ? 0.55 + 0.45 * smooth(c / 0.4) : c < 0.55 ? 1 : c < 0.8 ? 1 - 0.45 * smooth((c - 0.55) / 0.25) : 0.55;
function hyd(c) {
  const accFill = c < 0.55 ? 0 : c < 0.8 ? smooth((c - 0.55) / 0.25) : 1 - smooth((c - 0.8) / 0.15);
  return {
    p: pCyc(c),
    inletClosed: win(c, 0.4, 0.43) * (1 - win(c, 0.8, 0.83)),
    outletOpen: win(c, 0.55, 0.58) * (1 - win(c, 0.8, 0.83)),
    pumpOn: win(c, 0.55, 0.6) * (1 - win(c, 0.93, 0.97)),
    pumpAng: TAU * 6 * win(c, 0.55, 0.95),
    acc: accFill < 0 ? 0 : accFill,
    // fluid flow position toward the caliper (+) / back (-): returns to 0 each cycle
    flow: c < 0.4 ? smooth(c / 0.4) : c < 0.55 ? 1 : c < 0.8 ? 1 - smooth((c - 0.55) / 0.25) : 0,
    flowOp: Math.max(
      c < 0.4 ? Math.min(1, c * 10) * (1 - win(c, 0.34, 0.4)) : 0,
      c >= 0.55 && c < 0.8 ? win(c, 0.55, 0.6) * (1 - win(c, 0.74, 0.8)) : 0,
    ),
    relFlow: win(c, 0.55, 0.8),
    relOp: win(c, 0.55, 0.6) * (1 - win(c, 0.74, 0.8)),
    pumpFlow: win(c, 0.55, 0.95) * 2,
    pumpOp: win(c, 0.55, 0.6) * (1 - win(c, 0.9, 0.95)),
  };
}
const REST = hyd(0);

function absLap(K, nb) {
  const W0 = 0.12;
  const W1 = 0.74;
  const v = (u) =>
    u < W0 ? 1 : u < W1 ? 1 - 0.6 * win(u, W0, W1) : u < 0.82 ? 0.4 : 0.4 + 0.6 * win(u, 0.82, 1);
  const pBase = (u) => win(u, 0.05, W0) * (1 - win(u, W1, 0.82));
  const cOf = (u) => (u >= W0 && u < W1 ? (((u - W0) / (W1 - W0)) * K) % 1 : 0);
  const env = (u) => win(u, 0.09, 0.14) * (1 - win(u, 0.74, 0.79));
  const slip = (u) => {
    const c = cOf(u);
    const pl = (pCyc((((c - 0.1) % 1) + 1) % 1) - 0.55) / 0.45;
    return env(u) * (0.1 + 0.1 * pl);
  };
  const tab = buildLap({ nb, v, slip });
  return (u) => {
    const c = cOf(u);
    const h = hyd(c);
    const e = env(u);
    const pb = pBase(u);
    return {
      belt: tab.belt(u),
      wheel: tab.wheel(u),
      slip: slip(u),
      steer: 0,
      pBase: pb,
      ...h,
      p: pb * h.p,
      inletClosed: h.inletClosed * e,
      outletOpen: h.outletOpen * e,
      pumpOn: h.pumpOn * e,
      acc: h.acc * e,
      flow: h.flow * e,
      flowOp: h.flowOp * e,
      relOp: h.relOp * e,
      pumpOp: h.pumpOp * e,
    };
  };
}

function senseLap() {
  const v = (u) => 1 - 0.65 * Math.sin(Math.PI * u) ** 2;
  const tab = buildLap({ nb: 3, v, slip: () => 0 });
  return (u) => ({ ...REST, belt: tab.belt(u), wheel: tab.wheel(u), slip: 0, steer: 0, pBase: 0, p: 0 });
}

const slipProfile = (u) =>
  u < 0.18 ? 0.15 * smooth(u / 0.18)
  : u < 0.38 ? 0.15
  : u < 0.58 ? 0.15 + 0.85 * smooth((u - 0.38) / 0.2)
  : u < 0.72 ? 1
  : u < 0.88 ? 1 - 0.85 * smooth((u - 0.72) / 0.16)
  : 0.15 * (1 - smooth((u - 0.88) / 0.12));
function slipLap() {
  const tab = buildLap({ nb: 9, v: () => 1, slip: slipProfile });
  return (u) => ({ ...REST, belt: tab.belt(u), wheel: tab.wheel(u), slip: slipProfile(u), steer: 0, pBase: 0, p: slipProfile(u) > 0.01 ? 1 : 0 });
}

function steerLap() {
  const tab = buildLap({ nb: 6, v: () => 1, slip: () => 0 });
  return (u) => ({
    ...REST,
    belt: tab.belt(u),
    wheel: tab.wheel(u),
    slip: 0,
    steer: 0.38 * Math.sin(TAU * u),
    pBase: 0,
    p: 0,
  });
}

const LAPS = {
  abs3: absLap(3, 6),
  abs4: absLap(4, 6),
  abs6: absLap(6, 6),
  sense: senseLap(),
  slip: slipLap(),
  steer: steerLap(),
};

// ------------------------------------------------------------------- textures
function roadTex() {
  const W = 640;
  const H = 512; // one belt period (2.09 m) tall, 2.6 m wide -> square-ish px
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const g = c.getContext('2d');
  g.fillStyle = '#2b2d31';
  g.fillRect(0, 0, W, H);
  let s = 7;
  const rnd = () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
  for (let i = 0; i < 26000; i++) {
    const light = rnd() < 0.55;
    const vv = light ? 78 + ((rnd() * 70) | 0) : 12 + ((rnd() * 14) | 0);
    g.fillStyle = `rgba(${vv},${vv},${vv + 3},${light ? 0.4 : 0.55})`;
    const sz = 1 + rnd() * 2.6;
    g.fillRect(rnd() * W, rnd() * H, sz, sz);
  }
  const px = W / BELT_W;
  g.fillStyle = '#e4e2da';
  const lw = 0.14 * px;
  g.fillRect(0.05 * px, 0, lw, H);
  g.fillRect(W - 0.05 * px - lw, 0, lw, H);
  // dashed lane lines either side of the wheel path
  for (const xc of [BELT_W / 2 - 1.0, BELT_W / 2 + 1.0]) {
    g.fillRect(xc * px - lw / 2, 0, lw, H * 0.42);
  }
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.wrapS = THREE.ClampToEdgeWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.anisotropy = 8;
  t.repeat.set(1, BELT_L / P);
  return t;
}

const CH_W = 1024;
const CH_H = 640;
const CX0 = 120;
const CX1 = 960;
const CY0 = 540; // grip 0
const CY1 = 120; // grip 1.1
const chartX = (s) => CX0 + (CX1 - CX0) * s;
const chartY = (m) => CY0 + (CY1 - CY0) * (m / 1.1);
function chartTex() {
  const c = document.createElement('canvas');
  c.width = CH_W;
  c.height = CH_H;
  const g = c.getContext('2d');
  g.fillStyle = 'rgba(14,17,22,0.88)';
  g.beginPath();
  g.roundRect(0, 0, CH_W, CH_H, 36);
  g.fill();
  g.strokeStyle = 'rgba(255,255,255,0.16)';
  g.lineWidth = 3;
  g.stroke();
  // sweet-spot band 10-20 %
  g.fillStyle = 'rgba(79,209,197,0.22)';
  g.fillRect(chartX(0.1), CY1 - 30, chartX(0.2) - chartX(0.1), CY0 - CY1 + 30);
  g.strokeStyle = 'rgba(255,255,255,0.5)';
  g.lineWidth = 4;
  g.beginPath();
  g.moveTo(CX0, CY1 - 50);
  g.lineTo(CX0, CY0);
  g.lineTo(CX1 + 20, CY0);
  g.stroke();
  // curve
  g.strokeStyle = '#8fd3ff';
  g.lineWidth = 9;
  g.lineJoin = 'round';
  g.beginPath();
  for (let i = 0; i <= 200; i++) {
    const s = i / 200;
    const x = chartX(s);
    const y = chartY(mu(s));
    if (i === 0) g.moveTo(x, y);
    else g.lineTo(x, y);
  }
  g.stroke();
  g.fillStyle = '#e8eaf0';
  g.font = '600 40px system-ui, Segoe UI, sans-serif';
  g.textAlign = 'left';
  g.fillText('GRIP', CX0 + 16, 86);
  g.textAlign = 'center';
  g.fillText('WHEEL SLIP', (CX0 + CX1) / 2, CH_H - 34);
  g.font = '500 32px system-ui, Segoe UI, sans-serif';
  g.fillStyle = '#4fd1c5';
  g.fillText('ABS HOLDS HERE', chartX(0.15) + 96, CY1 - 6);
  g.fillStyle = '#c9cdd6';
  g.textAlign = 'left';
  g.fillText('rolling', CX0 - 6, CY0 + 44);
  g.textAlign = 'right';
  g.fillText('locked', CX1 + 24, CY0 + 44);
  g.fillStyle = '#ff7a6b';
  g.fillText('slides', CX1 + 10, chartY(LOCK_GRIP) - 26);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

// ===================================================================== MODEL
export function buildAntiLockBraking({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials ---------------------------------------------------------------
  const ironRotor = materials.brushedSteel(0xb7bcc3);
  ironRotor.roughness = 0.55;
  const ironDark = materials.darkMetal(0x3a3f47);
  const calRed = materials.paintedMetal(0xb3232a);
  const chromePart = materials.chrome(0xd6dbe1);
  chromePart.roughness = 0.22;
  const alloy = materials.aluminum(0xc0c6cd);
  alloy.roughness = 0.55;
  const faceAlloy = materials.aluminum(0xd0d5da);
  faceAlloy.roughness = 0.58;
  const tireRubber = materials.rubber(0x17181b);
  const padFriction = new THREE.MeshPhysicalMaterial({ color: 0x2e2a26, metalness: 0.1, roughness: 0.9 });
  const standMat = materials.darkMetal(0x24272c);
  const hubGrimy = materials.grimyAluminum(0x9aa0a8);
  const steel = materials.steel(0x8a929d);
  const copper = new THREE.MeshStandardMaterial({
    color: 0xb06a3c,
    metalness: 0.8,
    roughness: 0.4,
    emissive: 0x000000,
  });
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xbfe3ff,
    roughness: 0.1,
    metalness: 0,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    clearcoat: 0,
  });
  const ecuMat = materials.paintedMetal(0x22262b);
  const pipeMat = () =>
    new THREE.MeshStandardMaterial({
      color: 0x353a42,
      metalness: 0.6,
      roughness: 0.4,
      emissive: 0xff3a2a,
      emissiveIntensity: 0,
    });
  const pipeMC = pipeMat();
  const pipeCal = pipeMat();
  const pipeRel = pipeMat();
  const pipePump = pipeMat();
  const wireMatIn = new THREE.MeshStandardMaterial({ color: 0x2a2d33, emissive: 0x56d4ff, emissiveIntensity: 0, roughness: 0.6 });
  const wireMatOut = new THREE.MeshStandardMaterial({ color: 0x2a2d33, emissive: 0xffb23c, emissiveIntensity: 0, roughness: 0.6 });
  const sensorMat = new THREE.MeshStandardMaterial({ color: 0x1a1d22, emissive: 0x56d4ff, emissiveIntensity: 0, roughness: 0.5 });
  const sensorCable = new THREE.MeshStandardMaterial({ color: 0x23262b, emissive: 0x56d4ff, emissiveIntensity: 0, roughness: 0.6 });

  // --- plinth + road --------------------------------------------------------------
  const plinth = studioPlinth({ w: 8.8, d: 6.9 });
  plinth.position.x = -0.2;
  group.add(plinth);

  const beltTex = roadTex();
  const belt = new THREE.Mesh(
    new THREE.PlaneGeometry(BELT_W, BELT_L),
    new THREE.MeshStandardMaterial({ map: beltTex, roughness: 0.92, metalness: 0 }),
  );
  belt.rotation.x = -Math.PI / 2;
  belt.position.set(AX, BELT_Y, 0);
  belt.receiveShadow = true;
  group.add(belt);

  // --- wheel factory -----------------------------------------------------------------
  // centred on its own origin, axis along X, outboard face at +X, tyre R = 1.0
  function makeWheel() {
    const g = new THREE.Group();
    const metal = [];
    const tire = [];
    const torus = new THREE.Mesh(new THREE.TorusGeometry(0.83, 0.17, 18, 56), tireRubber);
    torus.rotation.y = Math.PI / 2;
    torus.castShadow = true;
    const tread = new THREE.Mesh(new THREE.CylinderGeometry(R, R, 0.27, 56, 1, true), tireRubber);
    tread.rotation.z = Math.PI / 2;
    tread.castShadow = true;
    g.add(torus, tread);
    tire.push(torus, tread);
    const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.66, 0.66, 0.3, 40, 1, true), alloy);
    barrel.rotation.z = Math.PI / 2;
    const liner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.655, 0.655, 0.3, 40, 1, true),
      new THREE.MeshStandardMaterial({ color: 0x1a1c1f, roughness: 0.9, side: THREE.BackSide }),
    );
    liner.rotation.z = Math.PI / 2;
    g.add(barrel, liner);
    metal.push(barrel, liner);
    const lip = new THREE.Mesh(new THREE.RingGeometry(0.5, 0.7, 48), faceAlloy);
    lip.material = faceAlloy.clone();
    lip.material.side = THREE.DoubleSide;
    lip.rotation.y = Math.PI / 2;
    lip.position.x = 0.15;
    g.add(lip);
    metal.push(lip);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.4;
      const spoke = beveledBox(0.05, 0.56, 0.17, faceAlloy, 0.014);
      spoke.position.set(0.15, Math.cos(a) * 0.36, Math.sin(a) * 0.36);
      spoke.rotation.x = a - Math.PI / 2;
      g.add(spoke);
      metal.push(spoke);
    }
    const hubDisc = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.06, 28), faceAlloy);
    hubDisc.rotation.z = Math.PI / 2;
    hubDisc.position.x = 0.16;
    g.add(hubDisc);
    metal.push(hubDisc);
    for (let i = 0; i < 5; i++) {
      const a = (i / 5) * TAU + 0.1;
      const lug = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.04, 6), chromePart);
      lug.rotation.z = Math.PI / 2;
      lug.position.set(0.2, Math.cos(a) * 0.12, Math.sin(a) * 0.12);
      g.add(lug);
      metal.push(lug);
    }
    return { g, metal, tire };
  }

  // --- patch factory (contact patch glow) ----------------------------------------------
  const patchGeo = new THREE.CircleGeometry(1, 28);
  function makePatch() {
    const m = new THREE.Mesh(
      patchGeo,
      new THREE.MeshBasicMaterial({
        color: 0x4fd1c5,
        transparent: true,
        opacity: 0.6,
        depthWrite: false,
        blending: THREE.AdditiveBlending,
        toneMapped: false,
      }),
    );
    m.rotation.x = -Math.PI / 2;
    m.scale.set(0.2, 0.42, 1);
    m.renderOrder = 2;
    return m;
  }
  const GREEN = new THREE.Color(0x3ee08f);
  const RED = new THREE.Color(0xff4630);

  // ============================================================================
  //  HERO CORNER — knuckle, rotor, tone ring, sensor, caliper, wheel
  // ============================================================================
  const heroCorner = new THREE.Group(); // hidden during the steering step
  group.add(heroCorner);

  const column = beveledBox(0.3, WY - 0.2, 0.3, standMat, 0.04);
  column.position.set(-3.95, 0.26 + (WY - 0.2) / 2 - 0.03, 0);
  heroCorner.add(column);
  const arm = rod(0.07, 1.4, standMat, 16);
  arm.rotation.z = -Math.PI / 2;
  arm.position.set(-3.95, WY, 0);
  heroCorner.add(arm);
  const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.3, 0.06, 36), standMat);
  knuckle.rotation.z = Math.PI / 2;
  knuckle.position.set(AX - 0.33, WY, 0);
  heroCorner.add(knuckle);

  const rotor = new THREE.Group();
  rotor.position.set(AX, WY, 0);
  heroCorner.add(rotor);
  for (const sx of [-1, 1]) {
    const plate = new THREE.Mesh(new THREE.CylinderGeometry(0.5, 0.5, 0.016, 56), ironRotor);
    plate.rotation.z = Math.PI / 2;
    plate.position.x = sx * 0.022;
    plate.castShadow = true;
    rotor.add(plate);
  }
  const vaneRing = new THREE.Mesh(new THREE.CylinderGeometry(0.47, 0.47, 0.03, 40, 1, true), ironDark);
  vaneRing.rotation.z = Math.PI / 2;
  rotor.add(vaneRing);
  const hat = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.12, 32), ironRotor);
  hat.rotation.z = Math.PI / 2;
  hat.position.x = 0.07;
  rotor.add(hat);
  const hubBody = new THREE.Mesh(new THREE.CylinderGeometry(0.15, 0.15, 0.3, 28), hubGrimy);
  hubBody.rotation.z = Math.PI / 2;
  hubBody.position.x = -0.15;
  rotor.add(hubBody);

  // tone ring: toothed wheel on the hub, inboard of the rotor
  const toneBody = new THREE.Mesh(new THREE.CylinderGeometry(0.25, 0.25, 0.07, 48), ironDark);
  toneBody.rotation.z = Math.PI / 2;
  toneBody.position.x = -0.17;
  rotor.add(toneBody);
  const toneMat = materials.steel(0xaab2bd);
  const toothGeo = new THREE.BoxGeometry(0.07, 0.05, 0.072);
  for (let i = 0; i < TEETH; i++) {
    const a = (i / TEETH) * TAU;
    const t = new THREE.Mesh(toothGeo, toneMat);
    t.position.set(-0.17, Math.cos(a) * 0.265, Math.sin(a) * 0.265);
    t.rotation.x = a - Math.PI / 2;
    t.castShadow = true;
    rotor.add(t);
  }

  // sensor (stationary, bracketed off the knuckle), facing the teeth
  const sensorG = new THREE.Group();
  sensorG.position.set(AX - 0.17, WY, 0);
  heroCorner.add(sensorG);
  const sensorBody = rod(0.04, 0.24, ironDark, 14);
  sensorBody.rotation.x = Math.PI / 2; // +Y -> +Z
  sensorBody.position.z = 0.31;
  sensorG.add(sensorBody);
  const sensorTip = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 14), sensorMat);
  sensorTip.rotation.x = Math.PI / 2;
  sensorTip.position.z = 0.305;
  sensorG.add(sensorTip);
  const bracket = beveledBox(0.2, 0.05, 0.06, steel, 0.012);
  bracket.position.set(-0.08, 0, 0.52);
  sensorG.add(bracket);

  // caliper (fixed azimuth, pads clamp with pressure)
  const calAssembly = new THREE.Group();
  calAssembly.position.set(AX, WY, 0);
  calAssembly.rotation.x = CAL_AZ;
  heroCorner.add(calAssembly);
  const calHousing = beveledBox(0.1, 0.24, 0.46, calRed, 0.03);
  calHousing.position.set(-0.13, 0.48, 0);
  const calBridge = beveledBox(0.4, 0.07, 0.46, calRed, 0.025);
  calBridge.position.set(0.02, 0.585, 0);
  const calFinger = beveledBox(0.06, 0.2, 0.46, calRed, 0.02);
  calFinger.position.set(0.12, 0.48, 0);
  calAssembly.add(calHousing, calBridge, calFinger);
  const padIn = beveledBox(0.025, 0.2, 0.34, padFriction, 0.006);
  const padOut = beveledBox(0.025, 0.2, 0.34, padFriction, 0.006);
  padIn.position.y = padOut.position.y = 0.46;
  calAssembly.add(padIn, padOut);

  // hero wheel (the removable skin)
  const heroWheel = makeWheel();
  heroWheel.g.position.set(AX + 0.12, WY, 0);
  group.add(heroWheel.g);

  const heroPatch = makePatch();
  heroPatch.position.set(AX + 0.12, BELT_Y + 0.006, 0);
  group.add(heroPatch);

  // ============================================================================
  //  STEERING PAIR (step 6): ABS wheel (rolls) vs locked wheel (slides)
  // ============================================================================
  const steerPair = new THREE.Group();
  group.add(steerPair);
  function makeSteerWheel(x) {
    const yaw = new THREE.Group();
    yaw.position.set(x, WY, 0);
    const w = makeWheel();
    yaw.add(w.g);
    const patch = makePatch();
    patch.position.set(0.0, -R + 0.006, 0);
    yaw.add(patch);
    steerPair.add(yaw);
    return { yaw, spin: w.g, patch };
  }
  const wheelAbs = makeSteerWheel(AX - 0.6);
  const wheelLock = makeSteerWheel(AX + 0.6);

  // arrows lying on the road, pointing along -Z at yaw 0
  function roadArrow(color, len, width, opacity = 1) {
    const g = new THREE.Group();
    const mat = new THREE.MeshBasicMaterial({ color, transparent: true, opacity, depthWrite: false, toneMapped: false });
    const shaft = new THREE.Mesh(new THREE.BoxGeometry(width, 0.02, len), mat);
    shaft.position.z = -len / 2;
    const head = new THREE.Mesh(new THREE.ConeGeometry(width * 1.9, width * 3.4, 4), mat);
    head.rotation.x = -Math.PI / 2; // +Y -> -Z
    head.rotation.y = Math.PI / 4;
    head.position.z = -len - width * 1.4;
    g.add(shaft, head);
    return g;
  }
  const travelAbs = roadArrow(0x3ee08f, 1.5, 0.07);
  const travelLock = roadArrow(0xff4630, 1.5, 0.07);
  const pointAbs = roadArrow(0xffffff, 1.0, 0.03, 0.55);
  const pointLock = roadArrow(0xffffff, 1.0, 0.03, 0.55);
  for (const [a, w] of [
    [travelAbs, wheelAbs],
    [travelLock, wheelLock],
    [pointAbs, wheelAbs],
    [pointLock, wheelLock],
  ]) {
    a.position.set(w.yaw.position.x, BELT_Y + 0.02, -0.4);
    steerPair.add(a);
  }
  pointAbs.position.y += 0.012;
  pointLock.position.y += 0.012;

  // ============================================================================
  //  ABS HYDRAULIC UNIT (schematic with glass valve bodies) + PEDAL
  // ============================================================================
  const M = new THREE.Group();
  M.position.set(1.5, BELT_Y, 0.3);
  group.add(M);
  const modBase = beveledBox(3.4, 0.1, 1.3, standMat, 0.03);
  modBase.position.set(-0.2, 0.05, 0);
  M.add(modBase);

  const PIPE_R = 0.026;
  const mkPipe = (pts, mat) => {
    const t = tubeAlong(pts, PIPE_R, mat, { tubularSegments: 90, radialSegments: 10, tension: 0.2 });
    M.add(t);
    return t;
  };
  const Y0 = 0.9; // main line height

  // inlet valve (horizontal at y=Y0): housing x .25 -> .8, seat at x=.45
  const inletHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.55, 28), glassMat);
  inletHousing.rotation.z = Math.PI / 2;
  inletHousing.position.set(0.525, Y0, 0);
  M.add(inletHousing);
  for (const x of [0.25, 0.8]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.025, 28), steel);
    cap.rotation.z = Math.PI / 2;
    cap.position.set(x, Y0, 0);
    M.add(cap);
  }
  const inletSeat = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.11, 24), steel);
  inletSeat.material = steel.clone();
  inletSeat.material.side = THREE.DoubleSide;
  inletSeat.rotation.y = Math.PI / 2;
  inletSeat.position.set(0.45, Y0, 0);
  M.add(inletSeat);
  const inletPlunger = new THREE.Group();
  inletPlunger.position.set(0.6, Y0, 0);
  {
    const stem = rod(0.04, 0.22, chromePart, 14);
    stem.rotation.z = -Math.PI / 2;
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), chromePart);
    inletPlunger.add(stem, tip);
  }
  M.add(inletPlunger);
  const inletCoil = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.22, 32), copper.clone());
  inletCoil.rotation.z = Math.PI / 2;
  inletCoil.position.set(0.66, Y0, 0);
  M.add(inletCoil);

  // outlet valve (vertical at x=-.25, centre y=.5): seat at y=.5, plunger from below
  const OX = -0.25;
  const outletHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.115, 0.55, 28), glassMat);
  outletHousing.position.set(OX, 0.5, 0);
  M.add(outletHousing);
  for (const y of [0.225, 0.775]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.125, 0.125, 0.025, 28), steel);
    cap.position.set(OX, y, 0);
    M.add(cap);
  }
  const outletSeat = new THREE.Mesh(new THREE.RingGeometry(0.03, 0.11, 24), steel);
  outletSeat.material = steel.clone();
  outletSeat.material.side = THREE.DoubleSide;
  outletSeat.rotation.x = Math.PI / 2;
  outletSeat.position.set(OX, 0.55, 0);
  M.add(outletSeat);
  const outletPlunger = new THREE.Group();
  outletPlunger.position.set(OX, 0.5, 0);
  {
    const stem = rod(0.04, 0.22, chromePart, 14);
    stem.rotation.z = Math.PI; // extends -Y
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), chromePart);
    outletPlunger.add(stem, tip);
  }
  M.add(outletPlunger);
  const outletCoil = new THREE.Mesh(new THREE.CylinderGeometry(0.185, 0.185, 0.22, 32), copper.clone());
  outletCoil.position.set(OX, 0.37, 0);
  M.add(outletCoil);

  // accumulator: glass cylinder, spring-loaded piston
  const ACX = -0.9;
  const accHousing = new THREE.Mesh(new THREE.CylinderGeometry(0.18, 0.18, 0.55, 30), glassMat);
  accHousing.position.set(ACX, 0.425, 0);
  M.add(accHousing);
  for (const y of [0.15, 0.7]) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.19, 0.19, 0.025, 30), steel);
    cap.position.set(ACX, y, 0);
    M.add(cap);
  }
  const accPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 30), chromePart);
  M.add(accPiston);
  const helix = [];
  for (let i = 0; i <= 120; i++) {
    const a = (i / 120) * TAU * 6;
    helix.push([Math.cos(a) * 0.1, i / 120, Math.sin(a) * 0.1]);
  }
  const spring = tubeAlong(helix, 0.012, materials.steel(0xcfd5dc), { tubularSegments: 160, radialSegments: 6, tension: 0.5 });
  M.add(spring);

  // return pump: body + eccentric + piston
  const pumpBody = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.5, 24), glassMat);
  pumpBody.rotation.z = Math.PI / 2;
  pumpBody.position.set(0.35, 0.2, 0);
  M.add(pumpBody);
  const motor = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.3, 28), standMat);
  motor.rotation.z = Math.PI / 2;
  motor.position.set(0.74, 0.2, 0);
  M.add(motor);
  const pumpPiston = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.16, 18), chromePart);
  pumpPiston.rotation.z = Math.PI / 2;
  M.add(pumpPiston);
  const ecc = new THREE.Group();
  ecc.position.set(0.9, 0.2, 0);
  {
    const disc = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.12, 0.03, 24), steel);
    disc.rotation.z = Math.PI / 2;
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.05, 12), copper);
    knob.rotation.z = Math.PI / 2;
    knob.position.set(0.03, 0.07, 0);
    ecc.add(disc, knob);
  }
  M.add(ecc);

  // ECU
  const ecu = beveledBox(0.5, 0.8, 0.9, ecuMat, 0.04);
  ecu.position.set(-1.6, 0.5, 0);
  M.add(ecu);
  const ledMat = new THREE.MeshStandardMaterial({ color: 0x123c38, emissive: 0x4fd1c5, emissiveIntensity: 0.2 });
  const led = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.07, 0.34), ledMat);
  led.position.set(-1.34, 0.68, 0);
  M.add(led);
  const ecuFins = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.5, 0.6), materials.aluminum(0x7a828c));
  ecuFins.position.set(-1.34, 0.36, 0);
  M.add(ecuFins);

  // pipes (M-local) — main line from master cylinder, caliper feed, release, pump
  const MCX = 2.2;
  mkPipe([[MCX, 0.4, 0.1], [MCX, 0.7, 0.1], [MCX - 0.2, Y0, 0.05], [1.4, Y0, 0], [0.95, Y0, 0], [0.8, Y0, 0]], pipeMC);
  mkPipe([[0.25, Y0, 0], [-0.05, Y0, 0], [OX, Y0, 0]], pipeCal);
  mkPipe([[OX, Y0, 0], [OX, 0.78, 0]], pipeCal);
  mkPipe([[OX, 0.225, 0], [OX, 0.2, 0], [-0.4, 0.19, 0], [-0.72, 0.19, 0]], pipeRel);
  const pumpPath = mkPipe(
    [[-0.9, 0.14, 0], [-0.9, 0.1, 0], [-0.6, 0.11, 0], [-0.1, 0.11, 0], [0.0, 0.2, 0]],
    pipePump,
  );
  const pumpOut = mkPipe([[0.6, 0.2, 0], [0.97, 0.2, 0], [0.97, 0.55, 0], [0.97, Y0, 0]], pipePump);
  // wires ECU -> coils
  const wireIn = tubeAlong(
    [[-1.4, 0.9, 0.1], [-1.3, 1.3, 0.1], [0.0, 1.32, 0.1], [0.66, 1.3, 0.05], [0.66, 1.1, 0.0]],
    0.012,
    wireMatIn,
    { tubularSegments: 70, radialSegments: 6, tension: 0.3 },
  );
  M.add(wireIn);
  const wireOut = tubeAlong(
    [[-1.36, 0.28, 0.28], [-0.9, 0.3, 0.45], [-0.5, 0.35, 0.3], [OX - 0.05, 0.37, 0.19]],
    0.012,
    wireMatOut,
    { tubularSegments: 60, radialSegments: 6, tension: 0.3 },
  );
  M.add(wireOut);

  // brake line to the caliper (built in world space; shares pipeCal)
  group.updateMatrixWorld(true);
  const calInletW = calAssembly.localToWorld(new THREE.Vector3(-0.17, 0.52, 0.12));
  const jW = M.localToWorld(new THREE.Vector3(OX, Y0, 0));
  const calLine = tubeAlong(
    [
      [jW.x, jW.y, jW.z],
      [jW.x - 0.5, jW.y + 0.45, jW.z - 0.1],
      [-0.7, 1.75, -0.2],
      [-1.8, calInletW.y + 0.28, calInletW.z + 0.12],
      [calInletW.x - 0.02, calInletW.y + 0.04, calInletW.z + 0.02],
      [calInletW.x, calInletW.y, calInletW.z],
    ],
    PIPE_R,
    pipeCal,
    { tubularSegments: 140, radialSegments: 10, tension: 0.4 },
  );
  group.add(calLine);
  // sensor cable to the ECU
  const sensW = sensorG.localToWorld(new THREE.Vector3(-0.15, 0, 0.55));
  const ecuW = M.localToWorld(new THREE.Vector3(-1.8, 0.45, 0.1));
  const cableTube = tubeAlong(
    [
      [sensW.x, sensW.y, sensW.z],
      [sensW.x - 0.1, sensW.y - 0.5, sensW.z + 0.3],
      [sensW.x - 0.3, BELT_Y + 0.1, 1.0],
      [-2.9, BELT_Y + 0.05, 1.2],
      [ecuW.x - 0.4, ecuW.y - 0.1, ecuW.z + 0.3],
      [ecuW.x, ecuW.y, ecuW.z],
    ],
    0.016,
    sensorCable,
    { tubularSegments: 140, radialSegments: 6, tension: 0.4 },
  );
  group.add(cableTube);

  // flow dots on three curves (caliper feed, release path, pump return)
  function flowDots(curve, n, color, size = 0.036) {
    const g = new THREE.Group();
    const dots = [];
    for (let i = 0; i < n; i++) {
      const m = materials.glow(color, 1.6);
      m.transparent = true;
      m.opacity = 0;
      m.depthWrite = false;
      const d = new THREE.Mesh(new THREE.SphereGeometry(size, 10, 8), m);
      g.add(d);
      dots.push(d);
    }
    return {
      g,
      set(S, op) {
        dots.forEach((d, i) => {
          const t = (((S + i / n) % 1) + 1) % 1;
          d.position.copy(curve.getPointAt(t));
          d.material.opacity = op;
        });
      },
    };
  }
  const calCurve = calLine.userData.curve;
  const flowCal = flowDots(calCurve, 6, 0xff5a46);
  group.add(flowCal.g);
  const relCurve = new THREE.CatmullRomCurve3(
    [new THREE.Vector3(OX, 0.78, 0), new THREE.Vector3(OX, 0.3, 0), new THREE.Vector3(OX, 0.19, 0), new THREE.Vector3(-0.4, 0.19, 0), new THREE.Vector3(-0.72, 0.19, 0)],
    false,
    'catmullrom',
    0.2,
  );
  const flowRel = flowDots(relCurve, 4, 0xff5a46, 0.034);
  M.add(flowRel.g);
  const pumpCurve = new THREE.CatmullRomCurve3(
    [
      new THREE.Vector3(-0.9, 0.14, 0),
      new THREE.Vector3(-0.6, 0.11, 0),
      new THREE.Vector3(0.0, 0.2, 0),
      new THREE.Vector3(0.55, 0.2, 0),
      new THREE.Vector3(0.97, 0.2, 0),
      new THREE.Vector3(0.97, Y0, 0),
    ],
    false,
    'catmullrom',
    0.2,
  );
  const flowPump = flowDots(pumpCurve, 6, 0xffb23c, 0.034);
  M.add(flowPump.g);

  // pedal + master cylinder (scaled up so it reads beside the wheel)
  const pedalUnit = new THREE.Group();
  pedalUnit.position.set(1.95, 0, 0.1);
  pedalUnit.scale.setScalar(1.5);
  M.add(pedalUnit);
  const pedalBase = beveledBox(0.34, 0.05, 0.3, standMat, 0.015);
  pedalBase.position.y = 0.025;
  pedalUnit.add(pedalBase);
  const pedalPivot = new THREE.Group();
  pedalPivot.position.set(0.0, 0.06, 0);
  pedalUnit.add(pedalPivot);
  const pedalArm = beveledBox(0.05, 0.42, 0.09, steel, 0.012);
  pedalArm.position.set(0, 0.21, 0);
  const pedalFoot = beveledBox(0.16, 0.05, 0.22, materials.rubber(0x101113), 0.012);
  pedalFoot.position.set(0, 0.42, 0);
  pedalPivot.add(pedalArm, pedalFoot);
  const mc = rod(0.07, 0.36, alloy, 20);
  mc.rotation.z = -Math.PI / 2;
  mc.position.set(0.08, 0.14, 0);
  pedalUnit.add(mc);
  const pushrod = rod(0.02, 0.12, chromePart, 10);
  pushrod.rotation.z = -Math.PI / 2;
  pushrod.position.set(-0.04, 0.14, 0);
  pedalUnit.add(pushrod);
  const reservoir = rod(
    0.055,
    0.1,
    new THREE.MeshPhysicalMaterial({ color: 0xf4f1e8, roughness: 0.5, transparent: true, opacity: 0.85, depthWrite: false }),
    16,
  );
  reservoir.position.set(0.28, 0.2, 0);
  pedalUnit.add(reservoir);

  // ============================================================================
  //  CHART
  // ============================================================================
  const chart = new THREE.Group();
  chart.position.set(0.4, 2.35, -0.3);
  chart.rotation.y = 0.45;
  group.add(chart);
  const chartPlane = new THREE.Mesh(
    new THREE.PlaneGeometry(2.4, 1.5),
    new THREE.MeshBasicMaterial({ map: chartTex(), transparent: true, depthWrite: false, toneMapped: false }),
  );
  chart.add(chartPlane);
  const marker = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 18, 14),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  );
  marker.position.z = 0.02;
  chart.add(marker);
  const markerHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.085, 18, 14),
    new THREE.MeshBasicMaterial({ color: 0x4fd1c5, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false }),
  );
  markerHalo.position.z = 0.02;
  chart.add(markerHalo);
  const chartPx = (px) => ((px - CH_W / 2) / CH_W) * 2.4;
  const chartPy = (py) => ((CH_H / 2 - py) / CH_H) * 1.5;

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const labels = calloutSets(['exterior', 'sense', 'slip', 'valves', 'pulse', 'steer']);
  labels.add('exterior', group, 'Tyre', [AX + 0.4, WY + 0.95, 0.4], 40, 60);
  labels.add('exterior', group, 'Moving road', [AX + 0.2, BELT_Y, 1.5], -20, 60);

  labels.add('sense', rotor, 'Tone ring — 24 teeth', [-0.17, 0.3, 0.1], 25, 60);
  labels.add('sense', sensorG, 'Wheel-speed sensor', [0, 0, 0.36], 15, 70);
  labels.add('sense', group, 'Cable to the ABS computer', [sensW.x - 0.3, BELT_Y + 0.15, 1.0], -25, 64);

  labels.add('slip', chart, 'Grip peak', [chartPx(chartX(0.15)), chartPy(chartY(1.0)), 0.03], 60, 54);
  labels.add('slip', group, 'Contact patch', [AX + 0.12, BELT_Y, 0.2], -30, 60);

  labels.add('valves', M, 'Inlet valve', [0.5, Y0 + 0.2, 0.0], 55, 60);
  labels.add('valves', M, 'Outlet valve', [OX + 0.1, 0.55, 0.1], 25, 60);
  labels.add('valves', M, 'Accumulator', [ACX, 0.28, 0.17], -25, 56);
  labels.add('valves', M, 'Return pump', [0.5, 0.12, 0.12], 15, 60);

  labels.add('pulse', M, 'Brake pedal', [1.95, 0.7, 0.1], 40, 60);
  labels.add('pulse', M, 'ABS computer', [-1.6, 0.92, 0.1], 55, 60);

  labels.add('steer', group, 'ABS wheel: rolling', [AX - 0.6, WY + 1.0, 0.1], 40, 66);
  labels.add('steer', group, 'Locked wheel: sliding', [AX + 0.6, WY + 1.0, 0.1], 20, 66);

  // ============================================================================
  //  POSE
  // ============================================================================
  const tmpC = new THREE.Color();
  function setPatchColor(patch, s) {
    tmpC.copy(GREEN).lerp(RED, smooth((s - 0.25) / 0.45));
    patch.material.color.copy(tmpC);
  }
  function apply(st) {
    // road + spin
    beltTex.offset.y = st.belt / BELT_L;
    rotor.rotation.x = -st.wheel;
    heroWheel.g.rotation.x = -st.wheel;
    // sensor pulse: bright when a tooth is under the pick-up
    const tooth = smooth((Math.cos(TEETH * (st.wheel + SENSOR_PSI)) + 0.2) / 1.0);
    const sig = st.wheel > 0 ? tooth : 0;
    sensorMat.emissiveIntensity = 0.1 + 2.4 * sig;
    sensorCable.emissiveIntensity = 0.1 + 1.4 * sig;
    // caliper
    const t = clamp01(st.p);
    padIn.position.x = -(0.0425 + PAD_GAP * (1 - t));
    padOut.position.x = 0.0425 + PAD_GAP * (1 - t);
    // contact patch colour
    setPatchColor(heroPatch, st.slip);
    marker.position.set(chartPx(chartX(st.slip)), chartPy(chartY(mu(st.slip))), 0.02);
    markerHalo.position.copy(marker.position);
    markerHalo.material.color.copy(tmpC.copy(GREEN).lerp(RED, smooth((st.slip - 0.25) / 0.45)));
    // pedal + master cylinder
    const kick = st.pBase * (0.3 - 0.07 * st.pumpOn);
    pedalPivot.rotation.z = -kick;
    pushrod.position.x = -0.04 + kick * 0.2;
    // valves
    inletPlunger.position.x = 0.6 - 0.135 * st.inletClosed;
    outletPlunger.position.y = 0.36 + 0.14 * (1 - st.outletOpen);
    inletCoil.material.emissive.setHex(0x56d4ff);
    inletCoil.material.emissiveIntensity = 1.6 * st.inletClosed;
    outletCoil.material.emissive.setHex(0xffb23c);
    outletCoil.material.emissiveIntensity = 1.6 * st.outletOpen;
    wireMatIn.emissiveIntensity = 1.6 * st.inletClosed;
    wireMatOut.emissiveIntensity = 1.6 * st.outletOpen;
    ledMat.emissiveIntensity = 0.25 + 1.5 * Math.max(st.inletClosed, st.outletOpen);
    // accumulator
    const py = 0.19 + 0.3 * st.acc;
    accPiston.position.set(ACX, py, 0);
    spring.position.set(ACX, py + 0.02, 0);
    spring.scale.y = Math.max(0.05, 0.69 - 0.02 - py);
    // pump
    ecc.rotation.x = st.pumpAng;
    pumpPiston.position.set(0.35 + 0.05 * Math.sin(st.pumpAng), 0.2, 0);
    // pipe glow = pressure
    pipeMC.emissiveIntensity = 1.3 * st.pBase;
    pipeCal.emissiveIntensity = 1.3 * st.p;
    pipeRel.emissiveIntensity = 1.3 * st.p * st.outletOpen;
    pipePump.emissiveIntensity = 1.0 * st.pumpOn;
    flowCal.set(st.flow, st.flowOp);
    flowRel.set(st.relFlow, st.relOp);
    flowPump.set(st.pumpFlow, st.pumpOp);
    // steering pair
    wheelAbs.yaw.rotation.y = st.steer;
    wheelAbs.spin.rotation.x = -st.wheel;
    wheelLock.yaw.rotation.y = st.steer;
    wheelLock.spin.rotation.x = 0;
    travelAbs.rotation.y = st.steer;
    pointAbs.rotation.y = st.steer;
    pointLock.rotation.y = st.steer;
    travelLock.rotation.y = 0;
    const lockedS = 1;
    setPatchColor(wheelAbs.patch, 0.1);
    setPatchColor(wheelLock.patch, lockedS);
  }

  function setLap(name, u) {
    apply(LAPS[name](((u % 1) + 1) % 1));
  }

  // --- layers ------------------------------------------------------------------------
  // wheel: tyre + alloy on/off; corner: stand/rotor/caliper/tone ring; mod: ABS
  // unit + pedal + lines; chart; steer: the pair; patch: hero contact patch
  function setView({ wheel = true, corner = true, mod = false, chart: ch = false, steer = false, patch = false }) {
    for (const m of [...heroWheel.metal, ...heroWheel.tire]) m.visible = wheel && !steer;
    heroCorner.visible = corner && !steer;
    M.visible = mod;
    pedalUnit.visible = mod;
    calLine.visible = mod && corner && !steer;
    flowCal.g.visible = mod && corner && !steer;
    cableTube.visible = corner && !steer && mod;
    chart.visible = ch;
    steerPair.visible = steer;
    heroPatch.visible = patch && !steer;
  }

  setView({});
  setLap('abs4', 0.05);
  labels.setLabels(false);

  return {
    group,
    setLap,
    setView,
    setLabels: labels.setLabels,
    parts: { rotor, heroWheel: heroWheel.g, calAssembly, padIn, padOut, pedalPivot, inletPlunger, outletPlunger, accPiston, ecc, wheelAbs: wheelAbs.yaw, wheelLock: wheelLock.yaw, marker },
  };
}
