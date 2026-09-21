import * as THREE from 'three';
import { materials, disc, rod, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, boltCircle } from '../../framework/geometry.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A spinning multi-beam time-of-flight lidar, modelled on the Velodyne
// HDL-64E — the one that sat on every DARPA Urban Challenge roof, and still
// the clearest teaching object because every part of it is mechanical.
//
// SCALE: 1 world unit = 10 cm (the real unit is 8" OD x 10" tall).
//   head diameter   8"    -> 2.00u      (R = 1.0)
//   stationary base       -> 0.55u
//   rotating head         -> 1.75u
//   dome cap              -> 0.20u
//   total height   10"    -> 2.50u      (H:D = 1.25:1, matches the reference)
//
// Because 1u = 10 cm, the NANOSECOND RULER is drawn at true scale: light
// covers 30 cm in 1 ns, so the ruler bar is exactly 3.00u long and the
// ±2 cm accuracy notch is exactly 0.20u. Nothing about the timing story is
// faked.
//
// ONE deliberate compression, disclosed in the step copy: the target stands
// 4.2u = 42 cm away, standing in for the 100 m a real return comes from.
// Distance is compressed; TIME is not.
//
// ONE pose function, `set()`, drives everything from ONE state object.

const PLINTH_H = 0.26;

// --- sensor body -----------------------------------------------------------
const R = 1.0; // head radius
const BASE_H = 0.55;
const HEAD_H = 1.75;
const CAP_H = 0.2;
const Y0 = PLINTH_H; // the sensor stands on the plinth
const HEAD_Y = Y0 + BASE_H + 0.03; // 0.84 — rotating head origin
const OPTIC_Y = HEAD_H * 0.52; // 0.91 local — the optical axis height
const EMIT_H = HEAD_Y + OPTIC_Y; // 1.75 world — beam origin height

const WIN_HALF = THREE.MathUtils.degToRad(55); // the window is a 110° sector
const WIN_Y0 = 0.4;
const WIN_Y1 = HEAD_H - 0.32;

// --- optics ----------------------------------------------------------------
const EMIT_X = -0.33;
const EMIT_Z = 0.98;
const RECV_X = 0.34;
const RECV_Z = 0.9;
const RECV_R = 0.3;

// --- the fan ---------------------------------------------------------------
const BEAMS = 64;
const FAN_TOP = 0; // top beam, level with the optical axis
const FAN_SPAN = THREE.MathUtils.degToRad(26.8); // 26.8° vertical field of view
const MAX_BEAM = 9.6;

// --- the scene the cloud describes -----------------------------------------
const POST_Z = 4.2;
const PLATE_Y = EMIT_H; // the target plate sits on the optical axis
const AZIMUTHS = 180; // cloud sample columns per revolution
const CLOUD_STEP = 3; // every 3rd beam gets a drawn ring (22 of the 64)

// --- the nanosecond ruler (TRUE scale) -------------------------------------
const NS_LEN = 3.0; // 1 ns of light travel = 30 cm = 3.00u
const ACC_LEN = 0.2; // ±2 cm of range = 0.20u = 130 ps of clock

// A smooth bump: 0 at both ends, 1 in the middle. Used for one-shot events
// inside a looping phase, so the lap wraps to an identical pose.
const bump = (u, a, b) => {
  const t = (u - a) / (b - a);
  return t <= 0 || t >= 1 ? 0 : Math.sin(Math.PI * t);
};

export function buildLidar({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  group.add(studioPlinth({ w: 2.6, h: PLINTH_H, d: 2.6 }));

  const labels = calloutSets(['exterior', 'internal', 'beam', 'ruler', 'detect', 'fan', 'cloud']);
  const accent = 0x6cf0a0;

  // ── materials ─────────────────────────────────────────────────────────────
  // Matte black polymer everywhere on the skin: no clearcoat, so it actually
  // disappears when ghosted (the mixer-grinder lesson). Metal lives INSIDE,
  // where it never needs ghosting — it simply switches on.
  const shellMat = materials.polymer(0x191c21);
  shellMat.roughness = 0.62;
  const shellTrim = materials.polymer(0x101215);
  shellTrim.roughness = 0.5;
  const baseMat = materials.polymer(0x1d2026);
  baseMat.roughness = 0.58;

  // Smoked window. PLAIN transparent glass, never opticalGlass: emissive beam
  // geometry lives directly behind it, and the transmission pass would eat it.
  const windowMat = new THREE.MeshPhysicalMaterial({
    color: 0x0a0d11,
    roughness: 0.12,
    metalness: 0,
    transparent: true,
    opacity: 0.62,
    depthWrite: false,
    side: THREE.DoubleSide,
  });

  const alu = materials.aluminum(0x8f979f);
  alu.roughness = 0.55;
  const steelMat = materials.brushedSteel(0xa8b0b8);
  steelMat.roughness = 0.45;
  const pcbMat = materials.plastic(0x12301f);
  pcbMat.roughness = 0.75;
  const propMat = materials.polymer(0x2c3038);
  propMat.roughness = 0.85;
  // dead weight, deliberately dull: it must not out-shine the optics
  const massMat = materials.paintedMetal(0x40464e);
  massMat.roughness = 0.72;
  massMat.clearcoat = 0;

  const glowMat = (color, opacity, intensity = 2.4) => {
    const m = materials.glow(color, intensity);
    m.transparent = true;
    m.opacity = opacity;
    m.depthWrite = false;
    return m;
  };

  const shellFadeable = [shellMat, shellTrim, baseMat];
  for (const m of shellFadeable) {
    m.transparent = true;
    m.opacity = 1;
  }

  // ── stationary base ───────────────────────────────────────────────────────
  const baseGroup = new THREE.Group();
  baseGroup.position.y = Y0;
  group.add(baseGroup);

  const baseBody = lathe(
    [
      [1.06, 0],
      [1.06, 0.07],
      [1.0, 0.1],
      [1.0, BASE_H - 0.08],
      [0.97, BASE_H],
    ],
    baseMat,
    56,
  );
  baseBody.receiveShadow = true;
  baseGroup.add(baseBody);

  // cooling ribs around the base — the real unit is covered in them
  for (let i = 0; i < 44; i++) {
    const a = (i / 44) * TAU;
    const rib = beveledBox(0.034, BASE_H - 0.3, 0.026, shellTrim, 0.008);
    rib.position.set(Math.cos(a) * 0.985, (BASE_H - 0.3) / 2 + 0.13, Math.sin(a) * 0.985);
    rib.rotation.y = -a;
    baseGroup.add(rib);
  }
  baseGroup.add(boltCircle(8, 0.86, 0.05, steelMat, 0.035));

  // power and data out the back
  const gland = rod(0.11, 0.34, steelMat, 20);
  gland.rotation.x = Math.PI / 2;
  gland.position.set(0, 0.24, -1.0);
  baseGroup.add(gland);
  const cable = rod(0.075, 0.5, materials.rubber(0x15171b), 16);
  cable.rotation.x = Math.PI / 2 + 0.35;
  cable.position.set(0, 0.24, -1.32);
  baseGroup.add(cable);

  // ── the mechanism inside the base: motor + bearing ────────────────────────
  const drive = new THREE.Group();
  drive.position.y = Y0;
  group.add(drive);
  const motorBody = disc(0.34, 0.3, alu, 28);
  motorBody.position.y = 0.2;
  drive.add(motorBody);
  const motorCan = disc(0.3, 0.1, steelMat, 28);
  motorCan.position.y = 0.4;
  drive.add(motorCan);
  const bearing = new THREE.Mesh(new THREE.TorusGeometry(0.8, 0.032, 10, 48), alu);
  bearing.rotation.x = Math.PI / 2;
  bearing.position.y = BASE_H - 0.02;
  drive.add(bearing);
  const beltRing = new THREE.Mesh(new THREE.TorusGeometry(0.5, 0.03, 10, 40), materials.rubber());
  beltRing.rotation.x = Math.PI / 2;
  beltRing.position.y = 0.42;
  drive.add(beltRing);

  // ── rotating head ─────────────────────────────────────────────────────────
  const headGroup = new THREE.Group();
  headGroup.position.y = HEAD_Y;
  group.add(headGroup);

  // The skin is a 250° sector; the missing 110° is the window.
  const skin = new THREE.Mesh(
    new THREE.CylinderGeometry(R, R, HEAD_H - 0.02, 64, 1, true, WIN_HALF, TAU - WIN_HALF * 2),
    shellMat,
  );
  skin.material.side = THREE.DoubleSide;
  skin.position.y = HEAD_H / 2;
  skin.castShadow = true;
  headGroup.add(skin);

  // full-circle frame rings top and bottom, so the window reads as a pane set
  // into a structural head rather than a missing wall
  for (const [y, h] of [
    [0.09, 0.18],
    [HEAD_H - 0.09, 0.18],
  ]) {
    const ring = disc(R + 0.012, h, shellTrim, 64);
    ring.position.y = y;
    headGroup.add(ring);
  }

  // a solid back panel, so you never see straight through the open head
  const backPanel = new THREE.Mesh(
    new THREE.CylinderGeometry(
      R - 0.03,
      R - 0.03,
      HEAD_H - 0.2,
      48,
      1,
      true,
      WIN_HALF,
      TAU - WIN_HALF * 2,
    ),
    shellTrim,
  );
  backPanel.material.side = THREE.DoubleSide;
  backPanel.position.y = HEAD_H / 2;
  headGroup.add(backPanel);

  // Machined trim framing the window pane. Without it the head renders as a
  // featureless tube and the window is invisible at hero distance.
  const trimMat = materials.aluminum(0x6f767e);
  trimMat.roughness = 0.62;
  for (const y of [WIN_Y0 - 0.035, WIN_Y1 + 0.035]) {
    const arc = new THREE.Mesh(
      new THREE.CylinderGeometry(
        R + 0.02,
        R + 0.02,
        0.055,
        48,
        1,
        true,
        -WIN_HALF - 0.05,
        WIN_HALF * 2 + 0.1,
      ),
      trimMat,
    );
    arc.material.side = THREE.DoubleSide;
    arc.position.y = y;
    headGroup.add(arc);
  }
  for (const s of [-1, 1]) {
    const jamb = beveledBox(0.07, WIN_Y1 - WIN_Y0 + 0.13, 0.05, trimMat, 0.016);
    const a = s * (WIN_HALF + 0.02);
    jamb.position.set(Math.sin(a) * (R + 0.01), (WIN_Y0 + WIN_Y1) / 2, Math.cos(a) * (R + 0.01));
    jamb.rotation.y = a;
    headGroup.add(jamb);
  }
  // maker plate on the back of the head
  const plateBack = beveledBox(0.44, 0.16, 0.03, trimMat, 0.01);
  plateBack.position.set(0, HEAD_H * 0.72, -(R + 0.005));
  headGroup.add(plateBack);

  const windowPane = new THREE.Mesh(
    new THREE.CylinderGeometry(
      R + 0.008,
      R + 0.008,
      WIN_Y1 - WIN_Y0,
      48,
      1,
      true,
      -WIN_HALF,
      WIN_HALF * 2,
    ),
    windowMat,
  );
  windowPane.position.y = (WIN_Y0 + WIN_Y1) / 2;
  headGroup.add(windowPane);

  const faceMat = materials.polymer(0x0b0d10);
  faceMat.roughness = 0.9;
  const apertureMat = materials.polymer(0x05070a);
  apertureMat.roughness = 0.35;
  const faceplate = new THREE.Group();
  faceplate.position.y = (WIN_Y0 + WIN_Y1) / 2;
  headGroup.add(faceplate);
  const facePanel = beveledBox(1.62, WIN_Y1 - WIN_Y0 - 0.04, 0.07, faceMat, 0.02);
  facePanel.position.z = 0.6;
  faceplate.add(facePanel);
  const emitSlot = beveledBox(0.6, 0.92, 0.03, apertureMat, 0.015);
  emitSlot.position.set(EMIT_X, 0, 0.645);
  faceplate.add(emitSlot);
  const recvHole = new THREE.Mesh(
    new THREE.CylinderGeometry(RECV_R + 0.03, RECV_R + 0.03, 0.03, 32),
    apertureMat,
  );
  recvHole.rotation.x = Math.PI / 2;
  recvHole.position.set(RECV_X, 0, 0.645);
  faceplate.add(recvHole);

  const cap = lathe(
    [
      [R + 0.012, 0],
      [R, 0.04],
      [0.88, CAP_H * 0.7],
      [0.6, CAP_H],
      [0, CAP_H + 0.05],
    ],
    shellMat,
    56,
  );
  cap.position.y = HEAD_H;
  cap.castShadow = true;
  headGroup.add(cap);

  // ── internals (they only exist once the shell is opened) ──────────────────
  const internals = new THREE.Group();
  headGroup.add(internals);

  // Two emitter blocks of 32 laser diodes each, mechanically aimed at fixed
  // vertical angles — the whole trick of the HDL-64E.
  const emitterBlocks = [];
  const diodeMat = glowMat(0xff5a44, 0.15, 3.0);
  for (let b = 0; b < 2; b++) {
    const blk = new THREE.Group();
    blk.position.set(EMIT_X, OPTIC_Y + (b === 0 ? 0.24 : -0.24), 0.52);
    blk.rotation.x = b === 0 ? 0.06 : -0.16; // upper block aims level, lower aims down
    internals.add(blk);
    emitterBlocks.push(blk);

    const body = beveledBox(0.56, 0.4, 0.3, alu, 0.03);
    blk.add(body);
    const heatsink = beveledBox(0.5, 0.34, 0.1, steelMat, 0.02);
    heatsink.position.z = -0.21;
    blk.add(heatsink);
    for (let i = 0; i < 32; i++) {
      const col = i % 8;
      const row = (i / 8) | 0;
      const d = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.02, 8), diodeMat);
      d.rotation.x = Math.PI / 2;
      d.position.set(-0.21 + col * 0.06, 0.1 - row * 0.066, 0.155);
      blk.add(d);
    }
    const lens = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.36, 0.04), windowMat);
    lens.position.z = 0.28;
    blk.add(lens);
  }

  // receive optic: a big lens, a barrel, and the detector board behind it
  const recvBarrel = new THREE.Mesh(
    new THREE.CylinderGeometry(RECV_R + 0.04, RECV_R + 0.04, 0.2, 32, 1, true),
    alu,
  );
  recvBarrel.rotation.x = Math.PI / 2;
  recvBarrel.position.set(RECV_X, OPTIC_Y, RECV_Z - 0.16);
  internals.add(recvBarrel);

  const lensMat = new THREE.MeshPhysicalMaterial({
    color: 0x14303f,
    roughness: 0.06,
    metalness: 0,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
  });
  const lensRim = new THREE.Mesh(new THREE.TorusGeometry(RECV_R + 0.02, 0.035, 10, 36), alu);
  lensRim.rotation.x = Math.PI / 2;
  lensRim.position.set(RECV_X, OPTIC_Y, RECV_Z - 0.09);
  internals.add(lensRim);
  const recvLens = new THREE.Mesh(
    new THREE.SphereGeometry(RECV_R, 28, 16, 0, TAU, 0, Math.PI / 2),
    lensMat,
  );
  recvLens.rotation.x = Math.PI / 2;
  recvLens.scale.y = 0.35;
  recvLens.position.set(RECV_X, OPTIC_Y, RECV_Z - 0.08);
  internals.add(recvLens);

  const board = beveledBox(0.84, 0.62, 0.04, pcbMat, 0.01);
  board.position.set(RECV_X, OPTIC_Y, RECV_Z - 0.66);
  internals.add(board);
  for (let i = 0; i < 16; i++) {
    const chip = beveledBox(0.04, 0.04, 0.016, i % 2 ? steelMat : alu, 0.005);
    chip.position.set(
      RECV_X - 0.3 + (i % 4) * 0.2,
      OPTIC_Y + 0.18 - ((i / 4) | 0) * 0.12,
      RECV_Z - 0.63,
    );
    internals.add(chip);
  }
  // the detector itself — an emissive strip that lights when a return lands
  const apdGlow = glowMat(accent, 0.0, 2.0);
  const detector = beveledBox(0.34, 0.12, 0.05, apdGlow, 0.012);
  detector.position.set(RECV_X, OPTIC_Y, RECV_Z - 0.58);
  const detSeat = beveledBox(0.42, 0.2, 0.04, alu, 0.012);
  detSeat.position.set(RECV_X, OPTIC_Y, RECV_Z - 0.62);
  internals.add(detSeat);
  internals.add(detector);

  // counterweight filling the rear of the head — why it spins smoothly
  const counterweight = new THREE.Mesh(
    new THREE.CylinderGeometry(
      R - 0.12,
      R - 0.12,
      1.18,
      40,
      1,
      false,
      Math.PI * 0.55,
      Math.PI * 0.9,
    ),
    massMat,
  );
  counterweight.position.y = OPTIC_Y;
  internals.add(counterweight);
  const cwFace = new THREE.Mesh(
    new THREE.CylinderGeometry(R - 0.34, R - 0.34, 1.02, 32, 1, false, Math.PI * 0.62, Math.PI * 0.76),
    massMat,
  );
  cwFace.position.y = OPTIC_Y;
  internals.add(cwFace);

  const hub = rod(0.085, HEAD_H - 0.34, shellTrim, 16);
  hub.position.y = 0.14;
  internals.add(hub);

  // ── the target, and the scene the cloud describes ─────────────────────────
  const post = new THREE.Group();
  post.position.set(0, 0, POST_Z);
  group.add(post);
  const postStem = rod(0.075, PLATE_Y - 0.36, steelMat, 16);
  post.add(postStem);
  const postFoot = disc(0.28, 0.05, propMat, 24);
  postFoot.position.y = 0.025;
  post.add(postFoot);
  const plate = beveledBox(0.92, 0.72, 0.06, propMat, 0.02);
  plate.position.set(0, PLATE_Y, -0.06);
  post.add(plate);
  // the spot the diverging beam paints on the plate
  const spotMat = glowMat(accent, 0, 1.2);
  const spot = new THREE.Mesh(new THREE.CircleGeometry(0.13, 28), spotMat);
  spot.position.set(0, PLATE_Y, -0.1);
  spot.rotation.y = Math.PI;
  post.add(spot);

  const props = new THREE.Group();
  group.add(props);
  for (const [w, h, d, x, z] of [
    [1.9, 0.9, 1.2, -5.2, 2.7],
    [1.3, 1.6, 1.3, 4.6, -3.3],
    [1.2, 2.1, 1.2, -3.6, -5.0],
    [7.0, 0.32, 0.7, 0.6, -6.2],
    [1.1, 0.7, 3.2, 6.1, 2.3],
    [1.6, 1.15, 1.6, 2.4, 6.4],
    [0.9, 1.4, 0.9, -6.6, -1.4],
  ]) {
    const p = beveledBox(w, h, d, propMat, 0.03);
    p.position.set(x, h / 2, z);
    p.receiveShadow = true;
    props.add(p);
  }

  // ── the 64-beam fan ───────────────────────────────────────────────────────
  // All beam geometry lives in head space, so the fan sweeps with the head.
  const beamGeo = new THREE.CylinderGeometry(1, 1.9, 1, 7, 1, true);
  beamGeo.translate(0, 0.5, 0); // origin at the emitting end
  const beamMat = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.075,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const beamMesh = new THREE.InstancedMesh(beamGeo, beamMat, BEAMS);
  beamMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  beamMesh.frustumCulled = false;
  headGroup.add(beamMesh);

  const beamOrigin = new THREE.Vector3(EMIT_X, OPTIC_Y, EMIT_Z);
  const beamDirs = [];
  const beamLens = [];
  for (let i = 0; i < BEAMS; i++) {
    const el = FAN_TOP - (i / (BEAMS - 1)) * FAN_SPAN;
    beamDirs.push(new THREE.Vector3(0, Math.sin(el), Math.cos(el)));
    // each beam runs until it meets the floor, capped at the drawn range
    beamLens.push(el < -0.001 ? Math.min(MAX_BEAM, EMIT_H / -Math.sin(el)) : MAX_BEAM);
  }

  // ── the single measured round trip ────────────────────────────────────────
  const shot = new THREE.Group();
  headGroup.add(shot);

  const emitPt = new THREE.Vector3(EMIT_X, OPTIC_Y, EMIT_Z);
  const hitPt = new THREE.Vector3(0, OPTIC_Y, POST_Z - 0.12);
  const recvPt = new THREE.Vector3(RECV_X, OPTIC_Y, RECV_Z);
  const outDir = hitPt.clone().sub(emitPt);
  const outLen = outDir.length();
  outDir.normalize();
  const inDir = recvPt.clone().sub(hitPt);
  const inLen = inDir.length();
  inDir.normalize();

  const alignTo = (mesh, from, dir, len) => {
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    mesh.position.copy(from).addScaledVector(dir, len / 2);
  };

  const pathMat = new THREE.MeshBasicMaterial({
    color: accent,
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const outPath = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.032, outLen, 10, 1, true),
    pathMat,
  );
  alignTo(outPath, emitPt, outDir, outLen);
  shot.add(outPath);

  const inPathMat = pathMat.clone();
  inPathMat.opacity = 0.09;
  const inPath = new THREE.Mesh(
    new THREE.CylinderGeometry(0.032, 0.012, inLen, 10, 1, true),
    inPathMat,
  );
  alignTo(inPath, hitPt, inDir, inLen);
  shot.add(inPath);

  // the outbound pulse — one 5 ns flash
  const packetMat = glowMat(accent, 1, 2.1);
  const packet = new THREE.Mesh(new THREE.SphereGeometry(0.05, 16, 12), packetMat);
  shot.add(packet);

  // the return: three faint dots, because that is honestly what comes back
  const echoMat = glowMat(accent, 0.55, 2.0);
  const echoes = [];
  for (let i = 0; i < 3; i++) {
    const e = new THREE.Mesh(new THREE.SphereGeometry(0.03, 10, 8), echoMat);
    shot.add(e);
    echoes.push(e);
  }

  // the avalanche: one photon multiplied into a measurable spike of charge
  const avalancheMat = glowMat(accent, 0, 3.0);
  const avalanche = new THREE.Group();
  avalanche.position.set(RECV_X, OPTIC_Y, RECV_Z - 0.61);
  headGroup.add(avalanche);
  const sparks = [];
  for (let i = 0; i < 22; i++) {
    const s = new THREE.Mesh(new THREE.SphereGeometry(0.019, 8, 6), avalancheMat);
    const a = (i / 22) * TAU * 2.4;
    s.userData.dir = new THREE.Vector3(
      Math.cos(a),
      Math.sin(a),
      (i % 5) * 0.14 - 0.28,
    ).normalize();
    avalanche.add(s);
    sparks.push(s);
  }

  // ── the nanosecond ruler — drawn at TRUE scale ────────────────────────────
  const ruler = new THREE.Group();
  ruler.position.set(EMIT_X, OPTIC_Y - 0.44, EMIT_Z);
  headGroup.add(ruler);
  const railMat = materials.plastic(0xd8dee6);
  railMat.roughness = 0.6;
  const rail = beveledBox(0.04, 0.035, NS_LEN, railMat, 0.012);
  rail.position.z = NS_LEN / 2;
  ruler.add(rail);
  for (let i = 0; i <= 10; i++) {
    const tick = beveledBox(0.02, 0.02, 0.012, railMat, 0.004);
    tick.scale.x = i === 0 || i === 10 ? 7 : 3.4;
    tick.position.set(0, 0.03, (i / 10) * NS_LEN);
    ruler.add(tick);
  }
  const notch = beveledBox(0.1, 0.055, ACC_LEN, glowMat(accent, 1, 3.4), 0.014);
  notch.position.set(0, 0.095, NS_LEN - ACC_LEN / 2);
  ruler.add(notch);

  // ── the point cloud ───────────────────────────────────────────────────────
  // Every point is a real ray cast at build time: 56 azimuth columns × 64
  // beams, intersected against the props and the floor. Nothing is placed by
  // hand, so the concentric ground rings — and the shadows the blocks cast
  // into the cloud — come out correct.
  const CLOUD_N = AZIMUTHS * Math.ceil(BEAMS / CLOUD_STEP);
  const cloudMat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const cloudMesh = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.034, 6, 4),
    cloudMat,
    CLOUD_N,
  );
  cloudMesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cloudMesh.frustumCulled = false;
  group.add(cloudMesh);

  const cloudPts = [];
  const cloudAz = [];
  const cloudCol = [];
  {
    const caster = new THREE.Raycaster();
    caster.far = MAX_BEAM + 2;
    const targets = [props, post];
    const origin = new THREE.Vector3();
    const dir = new THREE.Vector3();
    const near = new THREE.Color(accent);
    const far = new THREE.Color(0x2f6fd0);
    group.updateMatrixWorld(true);
    for (let a = 0; a < AZIMUTHS; a++) {
      const phi = (a / AZIMUTHS) * TAU;
      const ca = Math.cos(phi);
      const sa = Math.sin(phi);
      origin.set(EMIT_X * ca + EMIT_Z * sa, EMIT_H, -EMIT_X * sa + EMIT_Z * ca);
      for (let i = 0; i < BEAMS; i += CLOUD_STEP) {
        const d = beamDirs[i];
        dir.set(d.z * sa, d.y, d.z * ca).normalize();
        let dist = Infinity;
        if (dir.y < -0.001) dist = -origin.y / dir.y; // the floor
        caster.set(origin, dir);
        const hits = caster.intersectObjects(targets, true);
        if (hits.length && hits[0].distance < dist) dist = hits[0].distance;
        cloudAz.push(a / AZIMUTHS);
        if (!Number.isFinite(dist) || dist > MAX_BEAM) {
          cloudPts.push(null);
          cloudCol.push(new THREE.Color(0x000000));
          continue;
        }
        cloudPts.push(origin.clone().addScaledVector(dir, dist));
        cloudCol.push(near.clone().lerp(far, clamp01(dist / MAX_BEAM)));
      }
    }
  }

  // ── callouts ──────────────────────────────────────────────────────────────
  labels.add('exterior', headGroup, 'Rotating head', [0.35, HEAD_H - 0.32, 0.72], 40, 74);
  labels.add('exterior', headGroup, 'Smoked window', [0.62, OPTIC_Y + 0.3, 0.8], 20, 92);
  labels.add('exterior', baseGroup, 'Stationary base', [0.72, 0.28, 0.58], -35, 82);
  labels.add('exterior', baseGroup, 'Power + Ethernet', [0.2, 0.26, -1.15], -70, 74);

  labels.add('internal', emitterBlocks[0], '32 laser diodes', [0.12, 0.24, 0.2], 60, 86);
  labels.add('internal', emitterBlocks[1], 'A second block of 32', [0.12, -0.26, 0.2], -60, 96);
  labels.add('internal', internals, 'Receive lens', [RECV_X + 0.3, OPTIC_Y + 0.24, RECV_Z - 0.1], 30, 84);
  labels.add('internal', internals, 'Detector board', [RECV_X + 0.3, OPTIC_Y - 0.32, RECV_Z - 0.56], -30, 88);
  labels.add('internal', internals, 'Counterweight', [0.45, OPTIC_Y + 0.34, -0.72], 70, 80);
  labels.add('internal', drive, 'Spin motor', [0.4, 0.28, 0.1], -25, 78);

  labels.add('beam', shot, 'One 5 ns pulse out', [EMIT_X + 0.16, OPTIC_Y + 0.3, EMIT_Z + 1.0], 80, 70);
  labels.add('beam', post, 'Target — 42 cm here, 100 m in life', [0.5, PLATE_Y + 0.5, -0.1], 40, 92);
  labels.add('beam', shot, 'Echo lands on the lens', [RECV_X + 0.34, OPTIC_Y - 0.34, RECV_Z + 1.1], -40, 92);

  labels.add('ruler', ruler, '1 ns of flight = 30 cm', [0.14, 0.1, NS_LEN * 0.3], 55, 88);
  labels.add('ruler', ruler, '±2 cm = 130 ps of clock', [0.12, 0.2, NS_LEN - ACC_LEN / 2], 55, 104);
  labels.add('detect', internals, 'Avalanche photodiode', [RECV_X + 0.26, OPTIC_Y + 0.05, RECV_Z - 0.61], 20, 96);
  labels.add('detect', internals, 'Receive lens', [RECV_X + 0.3, OPTIC_Y + 0.26, RECV_Z - 0.1], 35, 84);
  labels.add('detect', shot, 'A few photons come home', [RECV_X + 0.46, OPTIC_Y + 0.14, RECV_Z + 0.18], 30, 96);

  labels.add('fan', headGroup, '64 beams, a 26.8° fan', [0.6, OPTIC_Y - 0.85, 1.8], 30, 96);
  labels.add('fan', emitterBlocks[1], 'Each laser at a fixed angle', [0.24, -0.12, 0.3], -55, 100);

  labels.add('cloud', group, 'One dot = one round trip', [3.1, 0.04, 3.1], 35, 96);
  labels.add('cloud', group, '900 rpm · 1.3 M points/s', [0.55, HEAD_Y + HEAD_H + 0.3, 0.3], 55, 84);

  // ── pose ──────────────────────────────────────────────────────────────────
  const S = {
    spin: 0, // head yaw, radians
    reveal: 0, // 0 sealed, 1 opened up
    pulse: 0, // 0..1, one out-and-back round trip
    fan: 0, // 0 = no beams, 1 = all 64
    cloud: 0, // 0 = no cloud, 1 = live rolling cloud
    fire: -1, // 0..1 sweeps the firing highlight down the fan; <0 = off
    shot: 0, // the single-beam demo (path, packet, echo, avalanche)
    ruler: 0, // the nanosecond scale bar
    post: 0, // the target post
    scene: 0, // the surrounding blocks
  };

  const _m = new THREE.Matrix4();
  const _q = new THREE.Quaternion();
  const _v = new THREE.Vector3();
  const _s = new THREE.Vector3();
  const _c = new THREE.Color();
  const _up = new THREE.Vector3(0, 1, 0);
  const _away = new THREE.Vector3(0, -99, 0);

  function hideInstance(mesh, i) {
    _m.compose(_away, _q.identity(), _s.setScalar(0.0001));
    mesh.setMatrixAt(i, _m);
  }

  function set(next = {}) {
    Object.assign(S, next);
    pose();
  }

  function pose() {
    headGroup.rotation.y = S.spin;

    // Reveal: the polymer skin fades out, the internals switch on. No metal
    // is ever ghosted — the guts simply become visible.
    const r = clamp01(S.reveal);
    const skinOpacity = 1 - 0.94 * r;
    for (const m of shellFadeable) {
      m.opacity = skinOpacity;
      m.depthWrite = r < 0.4;
    }
    windowMat.opacity = 0.62 - 0.5 * r;
    internals.visible = r > 0.05;
    faceplate.visible = r <= 0.05; // the optics themselves take over on reveal
    drive.visible = r > 0.05;

    post.visible = S.post > 0.5 || S.scene > 0.5;
    props.visible = S.scene > 0.5;
    ruler.visible = S.ruler > 0.5;

    // ── the fan ──
    const shown = S.fan <= 0.001 ? 0 : Math.round(1 + S.fan * (BEAMS - 1));
    beamMesh.visible = shown > 0;
    if (shown > 0) {
      for (let i = 0; i < BEAMS; i++) {
        if (i >= shown) {
          hideInstance(beamMesh, i);
          continue;
        }
        _q.setFromUnitVectors(_up, beamDirs[i]);
        _v.copy(beamOrigin);
        _s.set(0.006, beamLens[i], 0.006);
        _m.compose(_v, _q, _s);
        beamMesh.setMatrixAt(i, _m);
        // the blocks fire in sequence, so a bright band runs down the fan.
        // The distance wraps, so fire = 1 is the same pose as fire = 0.
        const gap = Math.abs(i / (BEAMS - 1) - S.fire);
        const near = S.fire < 0 ? 0 : 1 - clamp01(Math.min(gap, 1 - gap) * 9);
        _c.setHex(accent).multiplyScalar(0.45 + near * 1.35);
        beamMesh.setColorAt(i, _c);
      }
      beamMesh.instanceMatrix.needsUpdate = true;
      if (beamMesh.instanceColor) beamMesh.instanceColor.needsUpdate = true;
    }

    // ── the single measured round trip ──
    const on = S.shot > 0.5;
    shot.visible = on;
    const p = S.pulse - Math.floor(S.pulse);
    // 0.00–0.42 out · 0.42–0.50 at the target · 0.50–0.92 back · then dark
    const outT = clamp01(p / 0.42);
    const backT = clamp01((p - 0.5) / 0.42);
    const outbound = p < 0.44;
    const inbound = p >= 0.5 && p < 0.94;

    packet.visible = on && outbound;
    if (packet.visible) {
      packet.position.copy(emitPt).addScaledVector(outDir, outT * outLen);
      // the pulse spreads as it travels — 2 mrad of divergence, exaggerated
      // so the spot it paints is legible
      packet.scale.setScalar(1 + outT * 0.55);
    }

    const flash = bump(p, 0.4, 0.58);
    spotMat.opacity = on ? flash * 0.9 : 0;
    spot.scale.setScalar(0.7 + flash * 0.5);

    echoes.forEach((e, i) => {
      e.visible = on && inbound;
      if (!e.visible) return;
      const t = clamp01(backT - i * 0.05);
      e.position.copy(hitPt).addScaledVector(inDir, t * inLen);
      e.position.x += (i - 1) * 0.045;
      e.position.y += i % 2 ? 0.05 : -0.04;
    });
    echoMat.opacity = on ? 0.5 : 0;

    // the avalanche fires as the echo lands, and is gone before the lap wraps
    const av = bump(p, 0.9, 1.0);
    avalanche.visible = on && av > 0.01;
    avalancheMat.opacity = av * 0.9;
    const spread = 0.05 + smooth(clamp01((p - 0.9) / 0.1)) * 0.3;
    for (const s of sparks) s.position.copy(s.userData.dir).multiplyScalar(spread);
    apdGlow.opacity = Math.max(av * 0.85, inbound ? 0.12 : 0);

    // the diodes light as they fire — 20,000 times a second in life
    diodeMat.opacity = p < 0.12 ? 0.95 : 0.15;

    // ── the cloud ──
    cloudMesh.visible = S.cloud > 0.5;
    if (cloudMesh.visible) {
      const phase = (((S.spin / TAU) % 1) + 1) % 1;
      for (let k = 0; k < CLOUD_N; k++) {
        const pt = cloudPts[k];
        if (!pt) {
          hideInstance(cloudMesh, k);
          continue;
        }
        // Age since the head last swept this column. Points fade out behind
        // the sweep, so the lap wraps with no 1 → 0 snap.
        const age = (((phase - cloudAz[k]) % 1) + 1) % 1;
        const life =
          age < 0.03 ? age / 0.03 : age > 0.82 ? clamp01((0.97 - age) / 0.15) : 1;
        if (life <= 0.01) {
          hideInstance(cloudMesh, k);
          continue;
        }
        _m.compose(pt, _q.identity(), _s.setScalar(0.55 + life * 0.55));
        cloudMesh.setMatrixAt(k, _m);
        _c.copy(cloudCol[k]).multiplyScalar(0.25 + life * 0.75);
        cloudMesh.setColorAt(k, _c);
      }
      cloudMesh.instanceMatrix.needsUpdate = true;
      if (cloudMesh.instanceColor) cloudMesh.instanceColor.needsUpdate = true;
    }
  }

  set({});

  return {
    group,
    set,
    setLabels: labels.setLabels,
    parts: {
      head: headGroup,
      internals,
      emitterBlocks,
      detector,
      counterweight,
      bearing,
      beltRing,
      beams: beamMesh,
      cloud: cloudMesh,
      packet,
      ruler,
      post,
      drive,
    },
  };
}
