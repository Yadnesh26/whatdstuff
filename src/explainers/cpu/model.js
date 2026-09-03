import * as THREE from 'three';
import { materials, studioPlinth } from '../../framework/parts.js';
import { beveledBox, tubeAlong } from '../../framework/geometry.js';
import { clamp01, smooth, win } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A desktop CPU, product-shot staged on a charcoal plinth: the sealed LGA
// package, its contact grid, the bare silicon die under the lid, the die's
// ring-bus floorplan — plus an enlarged macro insert floating above the die
// that shows the one thing you can never see on real silicon: an instruction
// walking the pipeline, one clock tick per station.
//
// Reference facts:
//  - Package: Intel's LGA1700 desktop package is 37.5 x 45 mm (1,687 mm^2)
//    with 1,700 gold contact PADS on its underside — the pins live in the
//    socket, not on the chip. Most of those 1,700 contacts are not data at
//    all; the majority carry power and ground, because a modern core pulls
//    over a hundred amps at under 1.5 V and no single contact could take it.
//  - Lid: a nickel-plated copper integrated heat spreader (IHS), soldered to
//    the die with an indium solder thermal interface. It is a heat path and
//    a crush guard, nothing electrical.
//  - Die: Raptor Lake's 8P+16E die is about 257 mm^2 — roughly 15% of the
//    package footprint it hides under.
//  - Floorplan (modelled here on the classic Intel quad-core ring-bus
//    desktop die, e.g. Skylake): a row of cores, an L3 cache SLICE beside
//    each core, a bidirectional ring bus threading every core and slice
//    together with a ring stop at each, a large integrated-GPU block filling
//    most of one end, and the system agent — memory controller and I/O —
//    along the far edge.
//  - Pipeline: the classic five stages are fetch, decode, execute, memory,
//    write-back. Because each stage is separate hardware, five instructions
//    can be in flight at once, one per station, each moving on one station
//    per clock tick. Real desktop cores run the same idea 14-20 stages deep
//    and issue several instructions per cycle.
//  - Clock: desktop parts boost to roughly 5-6 GHz. At 5 GHz one tick lasts
//    200 picoseconds; light travels about 6 cm in that time.
//  - Cache: about 4-5 cycles to answer from L1, ~14 from L2, ~40 from L3,
//    and hundreds from main memory. The loop below runs those as 32 : 9 : 3
//    : 1 round trips per lap — implied latencies of 4, 14, 43 and 128
//    cycles, the real ratio made watchable.
//  - The example add is 0011 + 0101 = 1000 (3 + 5 = 8), carries rippling
//    right to left exactly as a real adder resolves them.

// ---------------------------------------------------------------------------
// Proportions. ONE scale: 1 scene unit = 15 mm, so the 45 mm package is 3.0
// units long and the 37.5 mm package is 2.5 wide — the true 1.2 : 1 ratio.
// ---------------------------------------------------------------------------
const PKG_L = 3.0; // 45 mm, along X
const PKG_W = 2.5; // 37.5 mm, along Z
const SUB_H = 0.09; // substrate (PCB) thickness
const PAD_H = 0.012; // contact pad standoff

const IHS_L = 2.82;
const IHS_W = 2.3;
// The lid is ONE machined block plus a shallow raised plateau — see the build
// below for why it is solid rather than hollowed out over the die.
const IHS_SKIRT_H = 0.05; // the part of the block that stands beside the die
const IHS_PLATE_H = 0.075; // the flat lid over the die
const IHS_STEP_L = 2.62;
const IHS_STEP_W = 2.1;
const IHS_STEP_H = 0.03; // raised centre plateau — a shallow step, not a tier
const IHS_RECESS_Y = SUB_H + IHS_SKIRT_H;
// total package height = SUB_H + IHS_SKIRT_H + IHS_PLATE_H + IHS_STEP_H
// = 0.245 => 3.7 mm, against a 45 mm length: the real 8% tile

// 257 mm^2 at the real ~2.2 : 1 die aspect => 23.8 x 10.8 mm
const DIE_L = 1.59;
const DIE_W = 0.72;
const DIE_H = 0.035;
const DIE_TOP = SUB_H + DIE_H;
const FLOOR_Y = DIE_TOP + 0.004; // floorplan plates sit just proud of the die
const FLOOR_H = 0.008;

const PLINTH_H = 0.24;
const PKG_Y = PLINTH_H + PAD_H; // pkgGroup origin = substrate underside

// Die floorplan lanes (die-local X/Z, die centre at 0,0)
const DIE_HZ = DIE_W / 2;
const IGPU_X0 = -0.775;
const IGPU_X1 = -0.245;
const CORE_X0 = -0.215;
const CORE_W = 0.16;
const CORE_GAP = 0.025;
const CORE_N = 4;
const CORE_Z0 = -0.34;
const CORE_Z1 = -0.075;
const SLICE_Z0 = 0.075;
const SLICE_Z1 = 0.34;
const AGENT_X0 = 0.53;
const AGENT_X1 = 0.775;
const coreCx = (i) => CORE_X0 + CORE_W / 2 + i * (CORE_W + CORE_GAP);
const CORE_CZ = (CORE_Z0 + CORE_Z1) / 2;
const SLICE_CZ = (SLICE_Z0 + SLICE_Z1) / 2;
const HERO_CORE = 1; // the core the macro insert and the cache probes belong to

// Macro insert: the pipeline bench floating above the die
const BENCH_Y = 1.35; // world height of the bench base
const STATION_N = 5;
const STATION_PITCH = 0.52;
const STATION_W = 0.4;
const STATION_H = 0.26;
const STATION_D = 0.34;
// > STATION_N so packets fade in and out instead of teleporting, and ODD so a
// half-lap offset is not a permutation of the queue onto itself — with 8 the
// scene at 20% and 70% of a lap was pixel-identical and verify.mjs's motion
// probe (which samples exactly those two points) read the step as static.
const PACKET_N = 9;
const stationX = (i) => (i - (STATION_N - 1) / 2) * STATION_PITCH;
const STAGE_NAMES = ['Fetch', 'Decode', 'Execute', 'Memory', 'Write-back'];

const ACCENT = 0x6ee7d0;
const CORE_COLOR = 0x6ee7d0;
const L3_COLOR = 0x4f9fe0;
const IGPU_COLOR = 0x8f7bd8;
const AGENT_COLOR = 0xe0a24a;
const PACKET_COLOR = 0x9ef5e2;
const HOT_COLOR = 0xfff0c4;

// The worked example: 0011 + 0101 = 1000
const REG_A = [0, 0, 1, 1];
const REG_B = [0, 1, 0, 1];
const REG_R = [1, 0, 0, 0];

const tri = (x) => 1 - Math.abs(1 - 2 * clamp01(x));
const frac = (x) => x - Math.floor(x);

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Crisp canvas-drawn text on a thin plane — used for the laser etch on the
// lid and for the station nameplates on the pipeline bench. Unlit on purpose:
// engraved lettering has to stay readable from every camera.
function textPlate(text, w, h, opts = {}) {
  const {
    color = '#dfe8f2',
    weight = 600,
    letter = 0,
    opacity = 1,
    align = 'center',
    font = '"Segoe UI", system-ui, sans-serif',
  } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.max(64, Math.round((1024 * h) / w));
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const px = Math.round(canvas.height * 0.56);
  ctx.font = `${weight} ${px}px ${font}`;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (letter && ctx.letterSpacing !== undefined) ctx.letterSpacing = `${letter}px`;
  ctx.fillText(text, align === 'center' ? canvas.width / 2 : 12, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.renderOrder = 3;
  return mesh;
}

// Substrate outline: a 3.0 x 2.5 rectangle with clipped corners and the two
// asymmetric keying notches that stop the chip going into the socket backwards.
function substrateGeometry() {
  const hx = PKG_L / 2;
  const hz = PKG_W / 2;
  const c = 0.07; // clipped corner
  const nW = 0.2;
  const nD = 0.055;
  const notches = [-0.62, 0.78]; // asymmetric, both on the same edge
  const s = new THREE.Shape();
  s.moveTo(-hx + c, -hz);
  for (const n of notches) {
    s.lineTo(n - nW / 2, -hz);
    s.lineTo(n - nW / 2 + 0.012, -hz + nD);
    s.lineTo(n + nW / 2 - 0.012, -hz + nD);
    s.lineTo(n + nW / 2, -hz);
  }
  s.lineTo(hx - c, -hz);
  s.lineTo(hx, -hz + c);
  s.lineTo(hx, hz - c);
  s.lineTo(hx - c, hz);
  s.lineTo(-hx + c, hz);
  s.lineTo(-hx, hz - c);
  s.lineTo(-hx, -hz + c);
  s.closePath();

  const bevel = 0.006;
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: SUB_H - bevel * 2,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 2,
    curveSegments: 2,
  });
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, bevel, 0);
  return geo;
}

// Closed rounded-rectangle path in the XZ plane — the ring bus, and the
// source of the ring traffic's positions.
function roundedRectPoints(cx, cz, w, d, r, seg = 5) {
  const pts = [];
  const hw = w / 2 - r;
  const hd = d / 2 - r;
  const corners = [
    [hw, hd, 0],
    [-hw, hd, Math.PI / 2],
    [-hw, -hd, Math.PI],
    [hw, -hd, -Math.PI / 2],
  ];
  for (const [x, z, a0] of corners) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + x + Math.cos(a) * r, 0, cz + z + Math.sin(a) * r]);
    }
  }
  return pts;
}

function emissivePlate(w, d, h, color, intensity = 0.55) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x11151a,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.2,
    roughness: 0.45,
  });
  const mesh = beveledBox(w, h, d, mat, 0.003);
  mesh.castShadow = false;
  return mesh;
}

function dotMesh(radius, color, intensity = 1.4) {
  const mat = materials.glow(color, intensity);
  mat.transparent = true;
  mat.opacity = 0;
  mat.depthWrite = false;
  mat.toneMapped = true;
  return new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), mat);
}

// ---------------------------------------------------------------------------
export function buildCpu({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  const plinth = studioPlinth({ w: 4.4, h: PLINTH_H, d: 3.2 });
  // the package is a flat tile, so the plinth fills much of frame and its
  // default sheen bloomed into a white flare beside the chip — knock it back
  plinth.material.roughness = 0.74;
  plinth.material.clearcoat = 0.22;
  group.add(plinth);

  const spinGroup = new THREE.Group();
  group.add(spinGroup);

  // =========================================================================
  // The package
  // =========================================================================
  const pkgGroup = new THREE.Group();
  pkgGroup.position.y = PKG_Y;
  spinGroup.add(pkgGroup);

  const substrateMat = materials.plastic(0x15311f);
  substrateMat.roughness = 0.62;
  const substrate = new THREE.Mesh(substrateGeometry(), substrateMat);
  substrate.castShadow = true;
  substrate.receiveShadow = true;
  pkgGroup.add(substrate);

  // --- 1,700 gold contacts, exactly: 44 x 40 grid minus a 10 x 6 keep-out
  const padMat = new THREE.MeshStandardMaterial({
    color: 0xd9b258,
    metalness: 1,
    roughness: 0.38,
  });
  const PAD_COLS = 44;
  const PAD_ROWS = 40;
  const padTransforms = [];
  const dummy = new THREE.Object3D();
  for (let i = 0; i < PAD_COLS; i++) {
    for (let j = 0; j < PAD_ROWS; j++) {
      if (i >= 17 && i <= 26 && j >= 17 && j <= 22) continue; // keep-out void
      padTransforms.push([(i - (PAD_COLS - 1) / 2) * 0.056, (j - (PAD_ROWS - 1) / 2) * 0.055]);
    }
  }
  const PAD_COUNT = padTransforms.length; // 1700
  const pads = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.019, 0.019, PAD_H, 10),
    padMat,
    PAD_COUNT,
  );
  padTransforms.forEach(([x, z], k) => {
    dummy.position.set(x, -PAD_H / 2, z);
    dummy.updateMatrix();
    pads.setMatrixAt(k, dummy.matrix);
  });
  pads.instanceMatrix.needsUpdate = true;
  pads.castShadow = false;
  pkgGroup.add(pads);

  // --- surface-mount capacitors around the die (only visible with the lid off)
  const capMat = materials.plastic(0x14161a);
  capMat.roughness = 0.5;
  const capGroup = new THREE.Group();
  for (const z of [-0.62, -0.52, 0.52, 0.62]) {
    for (let i = 0; i < 9; i++) {
      const x = -0.95 + i * 0.24 + (z > 0 ? 0.06 : 0);
      const cap = beveledBox(0.06, 0.018, 0.034, capMat, 0.005);
      cap.position.set(x, SUB_H + 0.009, z);
      capGroup.add(cap);
    }
  }
  pkgGroup.add(capGroup);

  // =========================================================================
  // The die and its floorplan
  // =========================================================================
  const dieGroup = new THREE.Group();
  dieGroup.position.y = SUB_H;
  pkgGroup.add(dieGroup);

  const siliconMat = new THREE.MeshStandardMaterial({
    color: 0x272d36,
    metalness: 0.55,
    roughness: 0.16,
  });
  const die = beveledBox(DIE_L, DIE_H, DIE_W, siliconMat, 0.004);
  die.position.y = DIE_H / 2;
  dieGroup.add(die);

  const floorGroup = new THREE.Group();
  floorGroup.position.y = FLOOR_Y - SUB_H;
  dieGroup.add(floorGroup);

  const place = (mesh, x0, x1, z0, z1) => {
    mesh.position.set((x0 + x1) / 2, 0, (z0 + z1) / 2);
    floorGroup.add(mesh);
    return mesh;
  };

  const igpu = place(
    emissivePlate(IGPU_X1 - IGPU_X0, DIE_HZ * 2 - 0.04, FLOOR_H, IGPU_COLOR, 0.32),
    IGPU_X0,
    IGPU_X1,
    -DIE_HZ + 0.02,
    DIE_HZ - 0.02,
  );
  // execution-unit grid on the iGPU, so it reads as an array not a slab
  for (let i = 0; i < 5; i++) {
    for (let j = 0; j < 7; j++) {
      const cell = beveledBox(0.086, 0.004, 0.083, materials.plastic(0x1a1f28), 0.002);
      cell.position.set(
        IGPU_X0 + 0.055 + i * 0.104,
        FLOOR_H / 2 + 0.002,
        -DIE_HZ + 0.055 + j * 0.093,
      );
      cell.castShadow = false;
      floorGroup.add(cell);
    }
  }

  const cores = [];
  const slices = [];
  const coreCaches = []; // [{ l1, l2 }] per core
  for (let i = 0; i < CORE_N; i++) {
    const cx = coreCx(i);
    const core = place(
      emissivePlate(CORE_W, CORE_Z1 - CORE_Z0, FLOOR_H, CORE_COLOR, 0.4),
      cx - CORE_W / 2,
      cx + CORE_W / 2,
      CORE_Z0,
      CORE_Z1,
    );
    cores.push(core);

    // inside the core: two L1 pads at the front, the L2 block behind them
    const l1 = emissivePlate(CORE_W * 0.5, 0.042, 0.006, 0xdff6ff, 0.1);
    l1.position.set(cx, FLOOR_H / 2 + 0.003, CORE_Z0 + 0.045);
    floorGroup.add(l1);
    const l2 = emissivePlate(CORE_W * 0.62, 0.06, 0.006, 0x9fd0ff, 0.07);
    l2.position.set(cx, FLOOR_H / 2 + 0.003, CORE_Z1 - 0.052);
    floorGroup.add(l2);
    coreCaches.push({ l1, l2 });

    const slice = place(
      emissivePlate(CORE_W, SLICE_Z1 - SLICE_Z0, FLOOR_H, L3_COLOR, 0.3),
      cx - CORE_W / 2,
      cx + CORE_W / 2,
      SLICE_Z0,
      SLICE_Z1,
    );
    slices.push(slice);
  }

  // system agent: memory controller + I/O along the far edge
  const imc = place(
    emissivePlate(AGENT_X1 - AGENT_X0, 0.33, FLOOR_H, AGENT_COLOR, 0.34),
    AGENT_X0,
    AGENT_X1,
    -0.34,
    -0.01,
  );
  const io = place(
    emissivePlate(AGENT_X1 - AGENT_X0, 0.31, FLOOR_H, AGENT_COLOR, 0.22),
    AGENT_X0,
    AGENT_X1,
    0.03,
    0.34,
  );

  // the ring bus: one closed loop threading every core and every L3 slice.
  // The corridor it runs down gets its own dim plate first — without it the
  // loop reads as a hole punched through the die.
  const ringCx = (CORE_X0 + coreCx(CORE_N - 1) + CORE_W / 2) / 2;
  const ringW = coreCx(CORE_N - 1) + CORE_W / 2 - CORE_X0 + 0.06;
  const corridor = emissivePlate(ringW + 0.04, 0.15, FLOOR_H, 0x2f6f7a, 0.16);
  corridor.position.set(ringCx, 0, 0);
  floorGroup.add(corridor);
  const ringMat = materials.glow(0xa8f0dd, 0.4);
  ringMat.metalness = 0.3;
  ringMat.roughness = 0.4;
  const ring = tubeAlong(roundedRectPoints(ringCx, 0, ringW, 0.115, 0.052), 0.0055, ringMat, {
    closed: true,
    tubularSegments: 220,
    radialSegments: 8,
    tension: 0.5,
  });
  ring.position.y = FLOOR_H / 2;
  ring.castShadow = false;
  floorGroup.add(ring);
  const ringCurve = ring.userData.curve;

  // ring stops — one per core and one per slice
  const ringStops = [];
  for (let i = 0; i < CORE_N; i++) {
    for (const z of [-0.058, 0.058]) {
      const stop = new THREE.Mesh(
        new THREE.BoxGeometry(0.02, 0.012, 0.02),
        materials.glow(0xd8fff2, 0.3),
      );
      stop.position.set(coreCx(i), FLOOR_H / 2, z);
      stop.castShadow = false;
      floorGroup.add(stop);
      ringStops.push(stop);
    }
  }

  const ringDots = [];
  // FIVE dots, not six: with six, a half-lap offset (which is what verify's
  // 20%/70% motion probe samples) is exactly a 3/6 rotation of the queue onto
  // itself, so the traffic reads as frozen at those two instants
  for (let i = 0; i < 5; i++) {
    const d = dotMesh(0.014, PACKET_COLOR, 1.5);
    d.position.y = FLOOR_H / 2;
    floorGroup.add(d);
    ringDots.push(d);
  }

  // =========================================================================
  // The lid
  // =========================================================================
  const ihsGroup = new THREE.Group();
  pkgGroup.add(ihsGroup);
  const ihsMat = materials.chrome(0xb9bfc6);
  // nickel plate is bright but NOT a mirror — 0.17 blew a 1077px white patch
  // at the finale camera's key-light angle; a big flat plate needs 0.42 before
  // the key stops smearing a soft white flare across half the lid.
  ihsMat.roughness = 0.42;

  // ONE machined block, not a skirt plus a plate: two boxes sharing a
  // footprint stacked four bright bevel lines at grazing angles and read as
  // lamination. The real lid is hollow underneath, but that hollow is only
  // ever inside the sealed package where nothing can see it — so the body is
  // solid and the die simply sits inside it while the lid is down.
  const IHS_BODY_H = IHS_SKIRT_H + IHS_PLATE_H;
  const ihsPlate = beveledBox(IHS_L, IHS_BODY_H, IHS_W, ihsMat, 0.014);
  ihsPlate.position.y = SUB_H + IHS_BODY_H / 2;
  ihsGroup.add(ihsPlate);
  const stepY = IHS_RECESS_Y + IHS_PLATE_H + IHS_STEP_H / 2;
  const ihsStep = beveledBox(IHS_STEP_L, IHS_STEP_H, IHS_STEP_W, ihsMat, 0.03);
  ihsStep.position.y = stepY;
  ihsGroup.add(ihsStep);

  // indium solder thermal interface, carried proud of the lid's underside
  // so it is what you see when the lid lifts away
  const tim = beveledBox(
    DIE_L + 0.06,
    0.016,
    DIE_W + 0.06,
    materials.steel(0xa9a2b0),
    0.004,
  );
  tim.position.y = SUB_H - 0.008; // proud of the lid's underside, so it shows when lifted
  ihsGroup.add(tim);

  // laser etch on the plateau
  const etch = textPlate('X7C4  ·  3P29A11  ·  MALAY', 1.34, 0.13, {
    color: '#0f1216',
    weight: 700,
    opacity: 0.62,
  });
  etch.rotation.x = -Math.PI / 2;
  etch.position.set(0, stepY + IHS_STEP_H / 2 + 0.002, -0.22);
  ihsGroup.add(etch);
  const etch2 = textPlate('SR9 3 6  ·  INTL PROCESSOR', 1.05, 0.1, {
    color: '#0f1216',
    weight: 500,
    opacity: 0.5,
  });
  etch2.rotation.x = -Math.PI / 2;
  etch2.position.set(0, stepY + IHS_STEP_H / 2 + 0.002, -0.02);
  ihsGroup.add(etch2);

  // =========================================================================
  // The cache ladder (die view, step 8): four probes racing from one core
  // =========================================================================
  const cacheGroup = new THREE.Group();
  pkgGroup.add(cacheGroup);

  // off-package main memory, drawn where it really is: outside the chip
  const dram = new THREE.Group();
  dram.position.set(1.45, 0.5, 0);
  dram.rotation.y = -0.6;
  cacheGroup.add(dram);
  const dramBoard = beveledBox(0.12, 0.42, 0.88, materials.plastic(0x16311f), 0.01);
  dram.add(dramBoard);
  for (let i = 0; i < 4; i++) {
    const chip = beveledBox(0.032, 0.14, 0.14, materials.plastic(0x101318), 0.006);
    chip.position.set(0.076, 0.05, -0.31 + i * 0.21);
    dram.add(chip);
  }
  const dramLabelPlate = textPlate('DRAM', 0.3, 0.09, { color: '#cfe0ee', opacity: 0.85 });
  dramLabelPlate.position.set(0.065, -0.14, 0);
  dramLabelPlate.rotation.y = Math.PI / 2;
  dram.add(dramLabelPlate);

  const heroCx = coreCx(HERO_CORE);
  const yTop = FLOOR_Y + FLOOR_H / 2 + 0.02;
  const coreAnchor = new THREE.Vector3(heroCx, yTop, CORE_CZ);
  const cacheTargets = [
    {
      name: 'L1',
      trips: 32,
      to: new THREE.Vector3(heroCx, yTop, CORE_Z0 + 0.045),
      lift: 0.1,
      color: 0xffffff,
    },
    {
      name: 'L2',
      trips: 9,
      to: new THREE.Vector3(heroCx, yTop, CORE_Z1 - 0.052),
      lift: 0.2,
      color: 0xbfe6ff,
    },
    {
      name: 'L3',
      trips: 3,
      to: new THREE.Vector3(heroCx, yTop, SLICE_CZ),
      lift: 0.34,
      color: L3_COLOR,
    },
    {
      name: 'DRAM',
      trips: 1,
      to: new THREE.Vector3(1.45, 0.5, 0),
      lift: 0.5,
      color: 0xffb45e,
    },
  ];
  const probes = cacheTargets.map((t) => {
    const mid = coreAnchor.clone().lerp(t.to, 0.5);
    mid.y += t.lift;
    const curve = new THREE.CatmullRomCurve3([coreAnchor.clone(), mid, t.to.clone()]);
    const trace = new THREE.Mesh(
      new THREE.TubeGeometry(curve, 40, 0.006, 6, false),
      materials.glow(t.color, 0.28),
    );
    trace.material.transparent = true;
    trace.material.opacity = 0.35;
    trace.material.depthWrite = false;
    trace.castShadow = false;
    cacheGroup.add(trace);
    const dot = dotMesh(t.name === 'DRAM' ? 0.038 : 0.03, t.color, 1.5);
    cacheGroup.add(dot);
    const marker = new THREE.Mesh(
      new THREE.SphereGeometry(0.026, 12, 10),
      materials.glow(t.color, 0.8),
    );
    marker.position.copy(t.to);
    marker.castShadow = false;
    cacheGroup.add(marker);
    return { ...t, curve, dot, marker, trace };
  });

  // =========================================================================
  // Macro insert: the pipeline bench floating above the hero core
  // =========================================================================
  const benchGroup = new THREE.Group();
  benchGroup.position.set(0, BENCH_Y, 0);
  spinGroup.add(benchGroup);

  const railMat = materials.brushedSteel(0x8f979f);
  railMat.roughness = 0.5;
  const rail = beveledBox(3.0, 0.045, 0.11, railMat, 0.014);
  rail.position.y = -0.03;
  benchGroup.add(rail);

  const stations = [];
  const stationPlates = [];
  const stationMats = [];
  for (let i = 0; i < STATION_N; i++) {
    const st = new THREE.Group();
    st.position.x = stationX(i);
    benchGroup.add(st);
    const bodyMat = materials.plastic(0x232830);
    bodyMat.roughness = 0.6;
    const body = beveledBox(STATION_W, STATION_H, STATION_D, bodyMat, 0.02);
    body.position.y = STATION_H / 2;
    st.add(body);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x11151a,
      emissive: ACCENT,
      emissiveIntensity: 0.35,
      metalness: 0.2,
      roughness: 0.4,
    });
    const top = beveledBox(STATION_W - 0.05, 0.014, STATION_D - 0.05, topMat, 0.004);
    top.position.y = STATION_H + 0.007;
    st.add(top);
    stationMats.push(topMat);
    const plate = textPlate(STAGE_NAMES[i], 0.36, 0.09, { color: '#e2edf5', weight: 600 });
    plate.position.set(0, STATION_H * 0.55, STATION_D / 2 + 0.004);
    st.add(plate);
    stations.push(st);
    stationPlates.push(plate);
  }

  // instruction packets riding the rail
  const packets = [];
  for (let i = 0; i < PACKET_N; i++) {
    const mat = materials.glow(PACKET_COLOR, 0.8);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    const p = beveledBox(0.12, 0.12, 0.12, mat, 0.022);
    p.castShadow = false;
    benchGroup.add(p);
    packets.push(p);
  }

  // the clock: one pillar behind the bench, fanning a tick out to every station
  const clockGroup = new THREE.Group();
  clockGroup.position.set(0, 0, -0.5);
  benchGroup.add(clockGroup);
  const clockPost = beveledBox(0.1, 0.5, 0.1, materials.darkMetal(0x30363e), 0.012);
  clockPost.position.y = 0.25;
  clockGroup.add(clockPost);
  const clockCoreMat = materials.glow(HOT_COLOR, 0.6);
  const clockCore = new THREE.Mesh(new THREE.TorusGeometry(0.115, 0.024, 14, 32), clockCoreMat);
  clockCore.rotation.x = Math.PI / 2;
  clockCore.position.y = 0.55;
  clockCore.castShadow = false;
  clockGroup.add(clockCore);
  const clockTreeMats = [];
  for (let i = 0; i < STATION_N; i++) {
    const from = new THREE.Vector3(0, 0.55, 0);
    const to = new THREE.Vector3(stationX(i), STATION_H + 0.02, 0.5);
    const mid = from.clone().lerp(to, 0.5);
    mid.y += 0.09;
    const c = new THREE.CatmullRomCurve3([from, mid, to]);
    const mat = materials.glow(HOT_COLOR, 0.5);
    mat.transparent = true;
    mat.opacity = 0.2;
    mat.depthWrite = false;
    const line = new THREE.Mesh(new THREE.TubeGeometry(c, 30, 0.005, 6, false), mat);
    line.castShadow = false;
    clockGroup.add(line);
    clockTreeMats.push(mat);
  }
  const clockPlate = textPlate('CLOCK', 0.3, 0.08, { color: '#ffe9bd', opacity: 0.9 });
  clockPlate.position.set(0, 0.09, 0.055);
  clockGroup.add(clockPlate);

  // scale link: four hairlines from the hero core on the die up to the bench,
  // so the viewer can see WHERE this blown-up diagram lives
  const linkMats = [];
  const linkGroup = new THREE.Group();
  spinGroup.add(linkGroup);
  {
    const cw = CORE_W / 2;
    const cd = (CORE_Z1 - CORE_Z0) / 2;
    const baseY = PKG_Y + FLOOR_Y + FLOOR_H / 2;
    const corners = [
      [-cw, -cd, -1.5, -0.16],
      [cw, -cd, 1.5, -0.16],
      [cw, cd, 1.5, 0.16],
      [-cw, cd, -1.5, 0.16],
    ];
    for (const [dx, dz, bx, bz] of corners) {
      const mat = materials.glow(ACCENT, 0.4);
      mat.transparent = true;
      mat.opacity = 0.16;
      mat.depthWrite = false;
      const c = new THREE.LineCurve3(
        new THREE.Vector3(heroCx + dx, baseY, CORE_CZ + dz),
        new THREE.Vector3(bx, BENCH_Y - 0.05, bz),
      );
      const line = new THREE.Mesh(new THREE.TubeGeometry(c, 2, 0.0035, 5, false), mat);
      line.castShadow = false;
      linkGroup.add(line);
      linkMats.push(mat);
    }
  }

  // -------------------------------------------------------------------------
  // Execute macro: register file + ALU, above the Execute station
  // -------------------------------------------------------------------------
  const microGroup = new THREE.Group();
  microGroup.position.set(0, 0.5, 0);
  benchGroup.add(microGroup);

  const BIT = 0.075;
  const BIT_GAP = 0.022;
  const regRows = [];
  const REG_LABELS = ['R1', 'R2', 'R3'];
  const REG_X = -0.62;
  const regFrame = beveledBox(0.44, 0.45, 0.14, materials.plastic(0x1c2129), 0.016);
  regFrame.position.set(REG_X, 0.16, -0.02);
  microGroup.add(regFrame);
  for (let r = 0; r < 3; r++) {
    const rowY = 0.33 - r * 0.14;
    const cells = [];
    for (let b = 0; b < 4; b++) {
      const mat = new THREE.MeshStandardMaterial({
        color: 0x171b21,
        emissive: ACCENT,
        emissiveIntensity: 0,
        metalness: 0.2,
        roughness: 0.45,
      });
      const cell = beveledBox(BIT, BIT, 0.05, mat, 0.008);
      cell.position.set(REG_X - 1.5 * (BIT + BIT_GAP) + b * (BIT + BIT_GAP), rowY, 0.06);
      cell.castShadow = false;
      microGroup.add(cell);
      cells.push(mat);
    }
    const tag = textPlate(REG_LABELS[r], 0.13, 0.075, { color: '#cfe0ee', opacity: 0.9 });
    tag.position.set(REG_X - 0.28, rowY, 0.062);
    microGroup.add(tag);
    regRows.push(cells);
  }

  // the classic notched-trapezoid ALU symbol, extruded
  const aluShape = new THREE.Shape();
  aluShape.moveTo(-0.19, 0.11);
  aluShape.lineTo(-0.05, 0.11);
  aluShape.lineTo(0, 0.045);
  aluShape.lineTo(0.05, 0.11);
  aluShape.lineTo(0.19, 0.11);
  aluShape.lineTo(0.11, -0.11);
  aluShape.lineTo(-0.11, -0.11);
  aluShape.closePath();
  const aluMat = new THREE.MeshStandardMaterial({
    color: 0x232a33,
    emissive: ACCENT,
    emissiveIntensity: 0.07,
    metalness: 0.35,
    roughness: 0.42,
  });
  const alu = new THREE.Mesh(
    new THREE.ExtrudeGeometry(aluShape, {
      depth: 0.085,
      bevelEnabled: true,
      bevelThickness: 0.007,
      bevelSize: 0.007,
      bevelSegments: 2,
    }),
    aluMat,
  );
  alu.position.set(0.13, 0.2, 0);
  alu.castShadow = true;
  microGroup.add(alu);
  const aluTag = textPlate('ALU', 0.16, 0.075, { color: '#e6f4ee', opacity: 0.95 });
  aluTag.position.set(0.13, 0.19, 0.1);
  microGroup.add(aluTag);

  // wires: R1 and R2 into the ALU, ALU result back down to R3
  const wireA = new THREE.CatmullRomCurve3([
    new THREE.Vector3(REG_X + 0.18, 0.33, 0.06),
    new THREE.Vector3(0.0, 0.44, 0.03),
    new THREE.Vector3(0.13 - 0.11, 0.32, 0.0),
  ]);
  const wireB = new THREE.CatmullRomCurve3([
    new THREE.Vector3(REG_X + 0.18, 0.19, 0.06),
    new THREE.Vector3(0.0, 0.26, 0.03),
    new THREE.Vector3(0.13 + 0.11, 0.32, 0.0),
  ]);
  const wireR = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.13, 0.08, 0.0),
    new THREE.Vector3(0.0, -0.02, 0.03),
    new THREE.Vector3(REG_X + 0.18, 0.05, 0.06),
  ]);
  const wireMats = [];
  for (const c of [wireA, wireB, wireR]) {
    const mat = materials.glow(PACKET_COLOR, 0.5);
    mat.transparent = true;
    mat.opacity = 0.22;
    mat.depthWrite = false;
    const w = new THREE.Mesh(new THREE.TubeGeometry(c, 40, 0.006, 6, false), mat);
    w.castShadow = false;
    microGroup.add(w);
    wireMats.push(mat);
  }
  const wireDots = [wireA, wireB, wireR].map((curve) => {
    const d = dotMesh(0.026, PACKET_COLOR, 1.6);
    microGroup.add(d);
    return { curve, dot: d };
  });

  // carry pips between the bit columns, rippling right to left
  const carries = [];
  for (let b = 0; b < 3; b++) {
    const mat = materials.glow(0xffc978, 1.4);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    const pip = new THREE.Mesh(new THREE.SphereGeometry(0.013, 10, 8), mat);
    pip.position.set(
      REG_X - 1.5 * (BIT + BIT_GAP) + (b + 0.5) * (BIT + BIT_GAP),
      0.26,
      0.07,
    );
    pip.castShadow = false;
    microGroup.add(pip);
    carries.push(mat);
  }

  // =========================================================================
  // Callouts
  // =========================================================================
  const labels = calloutSets(['package', 'pads', 'die', 'floorplan', 'pipeline', 'clock', 'execute', 'cache']);
  labels.add('package', ihsStep, 'Integrated heat spreader', [0.35, IHS_STEP_H / 2, -0.3], 52, 74);
  labels.add('package', substrate, 'Green substrate', [1.05, SUB_H, 0.85], -22, 88);

  labels.add('pads', pads, `${PAD_COUNT.toLocaleString()} gold contacts`, [0.6, -PAD_H, 0.5], 34, 92);
  // the notches are cut into the +z edge (the shape's -Y edge, which
  // ExtrudeGeometry's rotateX maps to +Z) — tipped up, that is the TOP edge.
  // They live on this step, not the hero: on a full turntable that one edge
  // faces away for half the lap and the leader lands on bare metal.
  labels.add('pads', substrate, 'Keying notch', [0.78, SUB_H * 0.5, 1.25], 118, 96);
  labels.add('pads', pads, 'Most are power and ground', [0.8, -PAD_H, -0.78], -20, 118);

  labels.add('die', die, 'The silicon die', [0.5, DIE_H, 0.12], 40, 74);
  labels.add('die', ihsPlate, 'Lid — soldered on with indium', [0.85, -0.05, 0.85], 22, 92);
  labels.add('die', capGroup, 'Smoothing capacitors', [0.85, 0.03, 0.62], -72, 84);

  labels.add('floorplan', cores[2], 'Core', [0, FLOOR_H, -0.06], 100, 60);
  labels.add('floorplan', slices[3], 'L3 cache slice', [0.02, FLOOR_H, 0.08], -58, 78);
  labels.add('floorplan', ring, 'Ring bus', [0.34, 0.03, 0.0], 40, 88);
  labels.add('floorplan', igpu, 'Integrated graphics', [0.06, FLOOR_H, -0.2], 68, 96);
  labels.add('floorplan', imc, 'Memory controller', [0.02, FLOOR_H, -0.06], -6, 94);

  labels.add('pipeline', stations[0], 'One instruction enters here', [0, STATION_H + 0.05, 0], 62, 82);
  labels.add('pipeline', stations[4], 'and its answer is filed here', [0, STATION_H + 0.05, 0], 44, 78);
  labels.add('pipeline', cores[HERO_CORE], 'All of this is one core', [0, FLOOR_H, 0], -62, 74);

  labels.add('clock', clockCore, 'Clock — one tick, one step', [0.1, 0.04, 0], 64, 82);
  labels.add('clock', stations[4], 'Five in flight at once', [0, STATION_H + 0.04, 0], -40, 88);

  labels.add('execute', regFrame, 'Register file', [0.05, 0.28, 0.1], 98, 76);
  labels.add('execute', alu, 'Arithmetic logic unit', [0.1, 0.14, 0.06], 34, 84);
  labels.add('execute', microGroup, 'Carries ripple right to left', [-0.55, 0.3, 0.12], 74, 120);

  labels.add('cache', probes[0].marker, 'L1 — about 4 cycles', [0, 0.02, -0.02], 40, 100);
  labels.add('cache', probes[1].marker, 'L2 — about 14', [0, 0.02, 0.02], 26, 62);
  labels.add('cache', probes[2].marker, 'L3 — about 40', [0, 0.02, 0.04], -34, 66);
  labels.add('cache', dram, 'Main memory — hundreds', [0.1, 0.28, 0], 40, 88);

  // =========================================================================
  // State + pose
  // =========================================================================
  const state = {
    view: 'pkg', // pkg | pads | reveal | die | bench | cache
    spin: 0, // turntable, radians
    flip: 0, // 0 = flat on the plinth, 1 = tipped up showing the contacts
    lid: 0, // 0 = sealed, 1 = lifted clear
    tick: 0, // pipeline clock, one whole number per station step
    ring: 0, // ring-bus traffic phase, whole laps
    probe: 0, // cache probe phase, whole laps
    alu: 0, // execute-stage phase, whole operations
    micro: false, // show the register-file / ALU macro
    clockLit: 0.25, // how loud the clock tree is — full only on the clock step
    corePulse: 0, // floorplan core activity phase
  };

  const FLIP_ANGLE = THREE.MathUtils.degToRad(-108);
  const FLIP_LIFT = 1.45;
  const stepPos = (p) => {
    // instructions hold at a station, then snap to the next on the clock edge
    const f = p - Math.floor(p);
    return Math.floor(p) + smooth(clamp01((f - 0.55) / 0.4));
  };

  function apply() {
    spinGroup.rotation.y = state.spin;

    // --- package pose
    pkgGroup.rotation.x = state.flip * FLIP_ANGLE;
    pkgGroup.position.y = PKG_Y + state.flip * FLIP_LIFT;
    ihsGroup.position.y = state.lid * 1.05;
    ihsGroup.rotation.z = state.lid * 0.035;

    const onDie =
      state.view === 'reveal' ||
      state.view === 'die' ||
      state.view === 'bench' ||
      state.view === 'cache';
    ihsGroup.visible = !onDie || state.view === 'reveal';
    floorGroup.visible = onDie;
    cacheGroup.visible = state.view === 'cache';
    benchGroup.visible = state.view === 'bench';
    linkGroup.visible = state.view === 'bench';
    microGroup.visible = state.view === 'bench' && state.micro;

    // --- die floorplan activity
    const pulse = state.corePulse;
    cores.forEach((c, i) => {
      const phase = frac(pulse - i * 0.12);
      c.material.emissiveIntensity = 0.32 + 0.42 * Math.pow(1 - phase, 3);
    });
    coreCaches.forEach(({ l1, l2 }, i) => {
      const phase = frac(pulse - i * 0.12);
      l1.material.emissiveIntensity = 0.09 + 0.34 * Math.pow(1 - phase, 4);
      l2.material.emissiveIntensity = 0.06 + 0.16 * Math.pow(1 - phase, 4);
    });
    slices.forEach((s, i) => {
      const phase = frac(pulse - 0.25 - i * 0.12);
      s.material.emissiveIntensity = 0.24 + 0.2 * Math.pow(1 - phase, 3);
    });

    ringDots.forEach((d, i) => {
      const t = frac(state.ring + i / ringDots.length);
      const p = ringCurve.getPointAt(t);
      d.position.set(p.x, FLOOR_H / 2 + 0.012, p.z);
      d.material.opacity = onDie ? 0.95 : 0;
    });
    ringStops.forEach((s, i) => {
      s.material.emissiveIntensity = 0.24 + 0.3 * Math.pow(1 - frac(state.ring * 6 - i * 0.1), 6);
    });

    // --- pipeline packets
    const benchOn = state.view === 'bench';
    for (let i = 0; i < PACKET_N; i++) {
      const raw = stepPos(state.tick - i);
      let d = ((raw % PACKET_N) + PACKET_N) % PACKET_N;
      if (d > STATION_N + 1.4) d -= PACKET_N; // the invisible return leg
      const p = packets[i];
      p.position.set(stationX(0) + d * STATION_PITCH, STATION_H + 0.08, 0);
      const fadeIn = clamp01((d + 0.85) / 0.6);
      const fadeOut = 1 - clamp01((d - (STATION_N - 1) - 0.25) / 0.6);
      p.material.opacity = benchOn ? clamp01(fadeIn * fadeOut) * 0.95 : 0;
      p.visible = p.material.opacity > 0.01;
      const settle = 1 - Math.abs(Math.sin(Math.PI * clamp01((raw - Math.floor(raw) - 0.55) / 0.4)));
      p.scale.setScalar(0.94 + 0.06 * settle);
    }

    // --- clock
    const edge = Math.pow(1 - frac(state.tick), 5);
    // the clock tree crosses the whole bench, so it stays a whisper except on
    // the step that is actually about it, and disappears behind the ALU macro
    clockGroup.visible = benchOn && !state.micro;
    clockCoreMat.emissiveIntensity = 0.2 + (0.25 + 1.5 * edge) * state.clockLit;
    clockTreeMats.forEach((m) => (m.opacity = 0.05 + (0.12 + 0.5 * edge) * state.clockLit));
    stationMats.forEach((m, i) => {
      const active = clamp01(1 - Math.abs(frac(state.tick) - 0.5) * 2);
      m.emissiveIntensity = 0.3 + 0.35 * edge + 0.1 * active * (i % 2 ? 1 : 0.6);
    });
    linkMats.forEach((m) => (m.opacity = benchOn ? 0.16 : 0));

    // --- execute macro
    if (microGroup.visible) {
      const u = frac(state.alu);
      const loadIn = win(u, 0.02, 0.22);
      const travel = win(u, 0.24, 0.5);
      const compute = win(u, 0.5, 0.66) * (1 - win(u, 0.82, 0.96));
      const result = win(u, 0.68, 0.86) * (1 - win(u, 0.92, 1.0));
      const clear = 1 - win(u, 0.9, 1.0);

      regRows[0].forEach((m, b) => {
        m.emissiveIntensity = REG_A[b] ? 1.15 * loadIn * clear : 0.02;
      });
      regRows[1].forEach((m, b) => {
        m.emissiveIntensity = REG_B[b] ? 1.15 * loadIn * clear : 0.02;
      });
      regRows[2].forEach((m, b) => {
        m.emissiveIntensity = REG_R[b] ? 1.25 * result : 0.02;
      });

      aluMat.emissiveIntensity = 0.06 + 0.5 * compute;
      carries.forEach((m, b) => {
        // carries resolve from the least significant column leftwards, and b
        // counts from the LEFT — so the rightmost gap (b = 2) has to fire first
        const k = carries.length - 1 - b;
        const w = win(u, 0.5 + k * 0.045, 0.57 + k * 0.045) * (1 - win(u, 0.74, 0.84));
        m.opacity = w * 0.95;
      });

      wireDots.forEach(({ curve, dot }, i) => {
        const t = i < 2 ? travel : win(u, 0.68, 0.84);
        const live = i < 2 ? travel > 0.001 && travel < 0.999 : t > 0.001 && t < 0.999;
        const p = curve.getPointAt(clamp01(t));
        dot.position.copy(p);
        dot.material.opacity = live ? 0.95 : 0;
      });
      wireMats.forEach((m, i) => {
        m.opacity = 0.16 + (i < 2 ? travel : result) * 0.4;
      });
    }

    // --- cache probes
    if (cacheGroup.visible) {
      probes.forEach((pr) => {
        const t = tri(frac(state.probe * pr.trips));
        const p = pr.curve.getPointAt(clamp01(t));
        pr.dot.position.copy(p);
        pr.dot.material.opacity = 0.95;
        pr.marker.material.emissiveIntensity = 0.5 + 0.9 * Math.pow(t, 6);
      });
    } else {
      probes.forEach((pr) => (pr.dot.material.opacity = 0));
    }
  }

  apply();

  return {
    group,
    parts: {
      pkgGroup,
      ihsGroup,
      dieGroup,
      floorGroup,
      benchGroup,
      microGroup,
      cacheGroup,
      packets,
      cores,
      padCount: PAD_COUNT,
    },
    setView(v) {
      state.view = v;
      apply();
    },
    setLabels: labels.setLabels,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
  };
}
