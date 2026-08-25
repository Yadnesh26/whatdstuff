import * as THREE from 'three';
import { materials, rod, disc, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, bladeRing, gear, boltCircle } from '../../framework/geometry.js';
import { clamp01, win, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A bagless cyclonic UPRIGHT vacuum cleaner — generic, not a specific brand.
// Sealed product shot first, then the shell ghosts to expose one continuous
// air path: nozzle -> brush roll -> intake duct -> tangential bin inlet ->
// vortex -> shroud -> cone crown -> pre-motor filter -> impeller -> HEPA
// exhaust.
//
// PROPORTIONS. One scale constant S = 0.0022 units/mm, read off a real
// 1080 mm upright, so every ratio holds by construction:
//   overall height : cleaner-head width = 1080 : 280 = 3.86 : 1
//   head 280 W x 240 D x 78 H mm      ball diameter 244 mm
//   clear bin 200 dia x 240 H mm      cyclone crown 185 dia x 136 H mm
// The clear bin is deliberately the TALLEST single block of the body stack
// (0.528 vs 0.472 for the whole cyclone + filter tower above it), because on
// a real upright the bin is what your eye lands on first.
//
// MECHANISM (researched). Nothing here "sucks": the impeller throws air out
// of the machine, dropping the internal pressure roughly 20 kPa (~90 inches
// of water lift, ~3 psi) below atmospheric, and the outside atmosphere pushes
// 50-100 CFM in through the nozzle. A belt-driven brush roll at 1,000-3,500
// rpm beats carpet fibres so grit breaks loose into that stream. Dirty air
// enters the bin through a TANGENTIAL inlet, so it spirals: dust has too much
// inertia to follow the tight turn and is thrown against the wall, dropping
// out. Narrower cones downstream accelerate the air from ~45 to ~120 mph,
// generating over 79,000 g to strip out the fine stuff. A pre-motor filter
// protects the motor; a post-motor HEPA cleans the exhaust to 99.97% at
// 0.3 micron.
//
// STATE SCALARS (one pose function, one local state object):
//   reveal   - 0 sealed product -> 1 shell ghosted, mechanism shown
//   flow     - master phase clock; every dot is (flow + seed) % 1, so whole
//              cycles per lap keep the loop seamless
//   brush    - brush-roll angle (rad), whole turns per lap
//   impeller - motor impeller angle (rad), whole turns per lap
//   fill     - dust-pile height in the bin, 0..1 (pinned per step, never
//              tweened — a growing pile could not return to its start pose)

// --- one-scale layout --------------------------------------------------------
const S = 0.0022; // units per millimetre
const Y0 = 0.26; // plinth top

const HEAD_W = 280 * S; // 0.616
const HEAD_D = 240 * S; // 0.528
const HEAD_H = 78 * S; // 0.1716
const HEAD_Z = 0.455;
const HEAD_Y1 = Y0 + HEAD_H;
const SLOT_Z = HEAD_Z + HEAD_D * 0.5 - 0.12; // 0.599
const SLOT_W = 0.44;
const SLOT_D = 0.055;

const BRUSH_R = 0.062;
const BRUSH_CORE_R = 0.038;
const BRUSH_L = 0.5;
const BRUSH_Y = Y0 + 0.075;
const BRUSH_Z = 0.57;
const PULLEY_A = 0.047;
const PULLEY_B = (PULLEY_A * 2) / 3; // exact 3:2 so the belt loop stays seamless
const BELT_X = BRUSH_L / 2 + 0.031;

const BALL_R = 122 * S; // 0.2684
const BALL_Z = -0.1;
const BALL_Y = Y0 + BALL_R; // 0.5284
const HUB_R = 0.152;
const HUB_X = 0.228; // hub-cap centre along X
const HUB_FACE = 0.2515; // its outer face
const VENT_R = 0.085; // exhaust-slot ring radius on that face

const BIN_R = 100 * S; // 0.22
const BIN_H = 240 * S; // 0.528
const BIN_Y0 = 0.8;
const BIN_Y1 = BIN_Y0 + BIN_H; // 1.328
const BIN_Z = 0.12;
const INLET_Y = BIN_Y1 - 0.085; // 1.243
const PILE_MAX = 0.11;

const SHROUD_R = 0.1;
const SHROUD_Y0 = 0.93;
const SHROUD_Y1 = 1.26;

const CYC_R = 92 * S + 0.013; // 0.2154 cover radius
const CYC_Y0 = BIN_Y1;
const CYC_Y1 = CYC_Y0 + 0.3; // 1.628
const CONE_N = 7;
const CONE_RING = 0.15;
const CONE_TOP_R = 0.05;
const CONE_BOT_R = 0.016;
const CONE_H = 0.2;
const CONE_MIDY = 1.465;
const CONE_Y0 = CONE_MIDY - CONE_H / 2; // 1.365 apex plane
const CONE_Y1 = CONE_MIDY + CONE_H / 2; // 1.565
const PLATE_Y = CONE_Y0 - 0.008;

const FILT_R = 0.185;
const FILT_Y0 = CYC_Y1;
const FILT_Y1 = 1.8;
const FILT_MIDY = (FILT_Y0 + FILT_Y1) / 2;

const SPINE_Z = -0.16;
const WAND_R = 0.052;
const WAND_Y0 = 1.6;
const WAND_Y1 = 2.3;
const TOP_Y = Y0 + 1080 * S; // 2.636

const lerp = (a, b, t) => a + (b - a) * t;

// deterministic 0..1 hash, so dot start positions never move between runs
// (review-shots and verify.mjs both compare seeked poses across processes)
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Rounded-rect outline as raw points, so the same outline can be wound either
// way — an ExtrudeGeometry hole must run OPPOSITE its shape or the hole's side
// walls come out inside-out.
function roundedRectPts(w, d, r, seg = 5) {
  const hw = w / 2 - r;
  const hd = d / 2 - r;
  const pts = [];
  for (const [cx, cy, a0] of [
    [hw, hd, 0],
    [-hw, hd, Math.PI / 2],
    [-hw, -hd, Math.PI],
    [hw, -hd, -Math.PI / 2],
  ]) {
    for (let i = 0; i <= seg; i++) {
      const a = a0 + (i / seg) * (Math.PI / 2);
      pts.push([cx + Math.cos(a) * r, cy + Math.sin(a) * r]);
    }
  }
  return pts;
}

function fillPath(target, pts, reverse = false) {
  const p = reverse ? [...pts].reverse() : pts;
  target.moveTo(p[0][0], p[0][1]);
  for (let i = 1; i < p.length; i++) target.lineTo(p[i][0], p[i][1]);
  target.closePath();
  return target;
}

// Flat ring with real thickness, standing axis-up. Used wherever a plate has
// to have a genuine hole in it — flow packets pass THROUGH these, so a solid
// disc would swallow them (and read as a sealed floor air can't cross).
function annulus(outerR, innerR, h, mat, extraHoles = []) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, 0, TAU, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, innerR, 0, TAU, true);
  shape.holes.push(bore);
  for (const [hx, hy, hr] of extraHoles) {
    const p = new THREE.Path();
    p.absarc(hx, hy, hr, 0, TAU, true);
    shape.holes.push(p);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: h,
    bevelEnabled: false,
    curveSegments: 36,
  });
  geo.rotateX(-Math.PI / 2); // local +Z becomes +Y, local +Y becomes -Z
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

// Closed external-tangent belt loop around two pulleys, drawn in the plane
// x = px so it hangs off the end of the brush roll like the real thing.
function beltPoints(px, cA, rA, cB, rB) {
  const dy = cB[0] - cA[0];
  const dz = cB[1] - cA[1];
  const L = Math.hypot(dy, dz);
  const th = Math.atan2(dz, dy);
  const a = Math.acos(clamp01((rA - rB) / L));
  const pts = [];
  const arc = (c, r, from, to, n) => {
    for (let i = 0; i <= n; i++) {
      const ang = from + (to - from) * (i / n);
      pts.push([px, c[0] + Math.cos(ang) * r, c[1] + Math.sin(ang) * r]);
    }
  };
  arc(cA, rA, th + a, th - a + TAU, 12); // long way round the driven pulley
  arc(cB, rB, th - a, th + a, 7); // short way round the drive pulley
  return pts;
}

export function buildVacuum({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials ------------------------------------------------------------
  const ACCENT = 0xb340cf;
  const bodyMat = materials.polymer(0x3c4149);
  const bodyMat2 = materials.polymer(0x2b2f35);
  const ductMat = materials.polymer(0x474d56);
  const accentMat = materials.paintedMetal(ACCENT);
  accentMat.roughness = 0.5;
  accentMat.clearcoat = 0.5;
  const nickelMat = materials.aluminum(0xb7bec6);
  nickelMat.roughness = 0.55;
  // the soleplate is moulded grey polymer, NOT metal: as aluminium it turned
  // into a mirror the moment the head camera dropped to floor level
  const soleMat = materials.polymer(0x32363d);
  soleMat.roughness = 0.85;
  const rubberMat = materials.rubber(0x1a1c20);
  const gripMat = materials.rubber(0x24272c);
  // nylon bristles — dark and matte. Saturated accent-coloured strips read as
  // gear teeth at any distance; a real brush roll is nearly black.
  const bristleMat = materials.polymer(0x2e323a);
  bristleMat.roughness = 0.92;
  bristleMat.clearcoat = 0;

  // The bin has VISIBLE CONTENTS (dust, the vortex, the shroud), so it must be
  // plain transparent plastic: real transmission glass only samples opaque
  // geometry and would delete everything inside it.
  const clearMat = new THREE.MeshPhysicalMaterial({
    color: 0xd6e6ff,
    metalness: 0,
    roughness: 0.06,
    transparent: true,
    opacity: 0.28,
    side: THREE.DoubleSide,
    depthWrite: false,
    clearcoat: 0,
  });
  const meshMat = new THREE.MeshPhysicalMaterial({
    color: 0xaeb6bd,
    metalness: 0,
    roughness: 0.62,
    transparent: true,
    opacity: 0.26,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const coneMat = new THREE.MeshPhysicalMaterial({
    color: 0xc8d4e2,
    metalness: 0,
    roughness: 0.16,
    transparent: true,
    opacity: 0.32,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  // filter media is paper/polypropylene — barely metallic, or the studio HDRI
  // turns the pleats into turbine blades
  const filterMat = materials.paintedMetal(0xf0ecdd);
  filterMat.metalness = 0.04;
  filterMat.roughness = 0.82;
  filterMat.clearcoat = 0.08;
  filterMat.side = THREE.DoubleSide;
  const hepaMat = materials.paintedMetal(0xe6eaee);
  hepaMat.metalness = 0.04;
  hepaMat.roughness = 0.84;
  hepaMat.clearcoat = 0.06;
  hepaMat.side = THREE.DoubleSide;
  const dustMat = materials.rubber(0x4a3e2e);
  dustMat.roughness = 1;
  const motorMat = materials.brushedSteel(0xb0b7be);
  motorMat.roughness = 0.7;
  const impellerMat = materials.brushedSteel(0xc4cbd2);
  impellerMat.roughness = 0.68;

  group.add(studioPlinth({ w: 3.0, d: 2.15 }));

  const ghosts = []; // outer skin: fades back on reveal
  const internals = []; // mechanism: hidden until revealed

  // Ghosting floor per mesh. A shell that fades ALL the way out takes the
  // machine's silhouette with it — the cleaner head became a brush roll
  // floating over a plate. Parts whose outline still has to read (the head
  // rim, the ducts the flow packets travel inside) keep a visible floor.
  const ghost = (mesh, floor = 0.06) => {
    mesh.userData.ghostFloor = floor;
    ghosts.push(mesh);
    return mesh;
  };

  // ==========================================================================
  //  CLEANER HEAD
  // ==========================================================================
  const headGroup = new THREE.Group();
  group.add(headGroup);

  // soleplate with a REAL suction slot cut through it (a solid plate the brush
  // roll sweeps past is the classic fake)
  const soleShape = fillPath(new THREE.Shape(), roundedRectPts(HEAD_W, HEAD_D, 0.05));
  const slotHole = new THREE.Path();
  const sw = SLOT_W / 2;
  const sd = SLOT_D / 2;
  const soy = -(SLOT_Z - HEAD_Z); // shape's local +y maps to world -z
  slotHole.moveTo(-sw, soy - sd); // wound opposite the outline, as holes must be
  slotHole.lineTo(-sw, soy + sd);
  slotHole.lineTo(sw, soy + sd);
  slotHole.lineTo(sw, soy - sd);
  slotHole.closePath();
  soleShape.holes.push(slotHole);
  const soleGeo = new THREE.ExtrudeGeometry(soleShape, {
    depth: 0.014,
    bevelEnabled: false,
    curveSegments: 8,
  });
  soleGeo.rotateX(-Math.PI / 2);
  const sole = new THREE.Mesh(soleGeo, soleMat);
  sole.position.set(0, Y0 + 0.003, HEAD_Z);
  sole.castShadow = true;
  headGroup.add(sole);
  for (const sz of [-1, 1]) {
    const lip = beveledBox(SLOT_W + 0.016, 0.008, 0.009, nickelMat, 0.003);
    lip.position.set(0, Y0 + 0.018, SLOT_Z + sz * (SLOT_D / 2 + 0.006));
    headGroup.add(lip);
  }

  // perimeter rim — keeps the head's outline readable even ghosted
  const rimOuter = roundedRectPts(HEAD_W, HEAD_D, 0.05);
  const rimInner = roundedRectPts(HEAD_W - 0.055, HEAD_D - 0.055, 0.04);
  const rimShape = fillPath(new THREE.Shape(), rimOuter);
  rimShape.holes.push(fillPath(new THREE.Path(), rimInner, true));
  const rimGeo = new THREE.ExtrudeGeometry(rimShape, {
    depth: HEAD_H - 0.008,
    bevelEnabled: false,
    curveSegments: 8,
  });
  rimGeo.rotateX(-Math.PI / 2);
  const headRim = new THREE.Mesh(rimGeo, bodyMat2.clone());
  headRim.position.set(0, Y0 + 0.014, HEAD_Z);
  headRim.castShadow = true;
  headGroup.add(headRim);
  ghost(headRim, 0.3);

  // top cover — the part that really gets out of the way
  const headShell = beveledBox(HEAD_W - 0.06, HEAD_H - 0.036, HEAD_D - 0.06, bodyMat.clone(), 0.025);
  headShell.position.set(0, Y0 + 0.026 + (HEAD_H - 0.036) / 2, HEAD_Z);
  headGroup.add(headShell);
  ghost(headShell, 0.05);

  const bumper = beveledBox(HEAD_W * 0.99, 0.026, 0.03, rubberMat, 0.011);
  bumper.position.set(0, Y0 + 0.034, HEAD_Z + HEAD_D / 2 - 0.006);
  headGroup.add(bumper);
  const bumperInlay = beveledBox(HEAD_W * 0.86, 0.008, 0.012, accentMat, 0.003);
  bumperInlay.position.set(0, Y0 + 0.04, HEAD_Z + HEAD_D / 2 + 0.006);
  headGroup.add(bumperInlay);

  // duct neck rising out of the head's back shoulder
  const neck = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.078, 0.1, 24), bodyMat2.clone());
  neck.position.set(0.08, HEAD_Y1 - 0.02, HEAD_Z - 0.14);
  headGroup.add(neck);
  ghost(neck, 0.1);

  for (const sx of [-1, 1]) {
    const wheel = disc(0.048, 0.026, rubberMat, 24);
    wheel.rotation.z = Math.PI / 2;
    wheel.position.set(sx * (HEAD_W / 2 - 0.026), Y0 + 0.048, HEAD_Z - HEAD_D / 2 + 0.055);
    headGroup.add(wheel);
  }

  // --- brush roll (revealed) -------------------------------------------------
  // rotation.z lays the core along X and is set ONCE; the spin rides
  // rotation.x, which Euler XYZ order applies AFTER it — i.e. about the core's
  // own axis. Putting the spin on .y instead would swing the whole roll.
  const brushGroup = new THREE.Group();
  brushGroup.position.set(0, BRUSH_Y, BRUSH_Z);
  brushGroup.rotation.z = Math.PI / 2;
  headGroup.add(brushGroup);
  internals.push(brushGroup);

  const brushCore = new THREE.Mesh(
    new THREE.CylinderGeometry(BRUSH_CORE_R, BRUSH_CORE_R, BRUSH_L, 26),
    materials.polymer(0x33373d),
  );
  brushCore.castShadow = true;
  brushGroup.add(brushCore);

  // four helical bristle strips: fine and dense, because chunky blocks read as
  // gear teeth. The helix is why a brush roll hums instead of hammering.
  const tuftGeo = new THREE.BoxGeometry(BRUSH_R - BRUSH_CORE_R + 0.004, 0.007, 0.008);
  const tuftR = BRUSH_CORE_R + (BRUSH_R - BRUSH_CORE_R) / 2;
  for (let row = 0; row < 4; row++) {
    for (let i = 0; i < 54; i++) {
      const u = i / 53;
      const ang = (row / 4) * TAU + u * 1.5; // 1.5 rad of helical lead
      const tuft = new THREE.Mesh(tuftGeo, bristleMat);
      tuft.position.set(Math.cos(ang) * tuftR, (u - 0.5) * (BRUSH_L - 0.03), Math.sin(ang) * tuftR);
      tuft.rotation.y = -ang;
      brushGroup.add(tuft);
    }
  }

  for (const sy of [-1, 1]) {
    const cap = new THREE.Mesh(
      new THREE.CylinderGeometry(BRUSH_CORE_R + 0.006, BRUSH_CORE_R, 0.018, 20),
      nickelMat,
    );
    cap.position.y = sy * (BRUSH_L / 2 - 0.009);
    brushGroup.add(cap);
  }
  // driven pulley on the +X end of the roll (brush-local +Y maps to world -X,
  // so it sits on the negative side of the local axis)
  const pulleyA = new THREE.Mesh(new THREE.CylinderGeometry(PULLEY_A, PULLEY_A, 0.02, 20), nickelMat);
  pulleyA.position.y = -(BRUSH_L / 2 + 0.02);
  brushGroup.add(pulleyA);
  for (let i = 0; i < 5; i++) {
    // spokes, so the pulley's rotation is legible instead of a smooth blur
    const spoke = beveledBox(0.011, 0.014, PULLEY_A * 1.7, nickelMat, 0.003);
    spoke.rotation.y = (i / 5) * Math.PI;
    spoke.position.y = -(BRUSH_L / 2 + 0.02);
    brushGroup.add(spoke);
  }

  // small dedicated brush motor + toothed belt: modern uprights drive the roll
  // from its own motor in the head rather than off the suction motor
  const brushMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.085, 20), motorMat);
  brushMotor.rotation.z = Math.PI / 2;
  brushMotor.position.set(0.215, Y0 + 0.098, BRUSH_Z - 0.15);
  headGroup.add(brushMotor);
  internals.push(brushMotor);

  const pulleyB = new THREE.Mesh(new THREE.CylinderGeometry(PULLEY_B, PULLEY_B, 0.018, 16), nickelMat);
  pulleyB.rotation.z = Math.PI / 2;
  pulleyB.position.set(BELT_X, Y0 + 0.098, BRUSH_Z - 0.15);
  headGroup.add(pulleyB);
  internals.push(pulleyB);

  const belt = tubeAlong(
    beltPoints(BELT_X, [BRUSH_Y, BRUSH_Z], PULLEY_A, [Y0 + 0.098, BRUSH_Z - 0.15], PULLEY_B),
    0.008,
    rubberMat,
    { closed: true, tubularSegments: 140, radialSegments: 8, tension: 0.9 },
  );
  headGroup.add(belt);
  internals.push(belt);

  // ==========================================================================
  //  YOKE + BALL (the suction motor lives inside the ball)
  // ==========================================================================
  const yoke = beveledBox(0.24, 0.15, 0.18, bodyMat2.clone(), 0.03);
  yoke.position.set(0, Y0 + 0.075, 0.135);
  group.add(yoke);
  ghost(yoke, 0.08);

  const ballShell = new THREE.Mesh(
    new THREE.SphereGeometry(BALL_R, 56, 36),
    materials.polymer(0x40454d),
  );
  ballShell.position.set(0, BALL_Y, BALL_Z);
  ballShell.castShadow = true;
  group.add(ballShell);
  ghost(ballShell, 0.05);

  const ballBand = new THREE.Mesh(new THREE.TorusGeometry(BALL_R * 0.995, 0.021, 12, 64), accentMat);
  ballBand.rotation.y = Math.PI / 2;
  ballBand.position.set(0, BALL_Y, BALL_Z);
  group.add(ballBand);

  // exhaust: a proper wheel hub on each side with the vent slots cut FLAT into
  // its face. Slots modelled as radial fins standing off the sphere read as a
  // spiked gear from any distance.
  // The hub caps are OUTER SKIN, so they ghost with the rest of the shell —
  // left opaque they sit directly in front of the impeller and bury the one
  // part step 6 is about. The slots keep the highest floor of the three so the
  // vent pattern still reads once the cap behind it has gone translucent.
  const slotMat = materials.rubber(0x0e1013);
  for (const sx of [-1, 1]) {
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(HUB_R * 0.94, HUB_R, 0.048, 40),
      nickelMat.clone(),
    );
    hub.rotation.z = Math.PI / 2;
    hub.position.set(sx * HUB_X, BALL_Y, BALL_Z);
    group.add(hub);
    ghost(hub, 0.2);
    const hubFace = new THREE.Mesh(
      new THREE.CylinderGeometry(HUB_R * 0.9, HUB_R * 0.9, 0.01, 40),
      bodyMat2.clone(),
    );
    hubFace.rotation.z = Math.PI / 2;
    hubFace.position.set(sx * (HUB_FACE + 0.001), BALL_Y, BALL_Z);
    group.add(hubFace);
    ghost(hubFace, 0.16);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * TAU;
      const slot = beveledBox(0.012, 0.062, 0.014, slotMat, 0.004);
      slot.rotation.x = a;
      slot.position.set(
        sx * (HUB_FACE + 0.005),
        BALL_Y + Math.cos(a) * VENT_R,
        BALL_Z + Math.sin(a) * VENT_R,
      );
      group.add(slot);
      ghost(slot, 0.4);
    }
  }

  // --- suction motor + impeller (revealed) -----------------------------------
  const motorGroup = new THREE.Group();
  motorGroup.position.set(0, BALL_Y, BALL_Z);
  group.add(motorGroup);
  internals.push(motorGroup);

  const motorCan = new THREE.Mesh(new THREE.CylinderGeometry(0.088, 0.088, 0.24, 30), motorMat);
  motorCan.rotation.z = Math.PI / 2;
  motorCan.position.x = -0.055;
  motorGroup.add(motorCan);
  const motorRibs = boltCircle(10, 0.088, 0.008, nickelMat, 0.23);
  motorRibs.rotation.z = Math.PI / 2;
  motorRibs.position.x = -0.055;
  motorGroup.add(motorRibs);
  // end bell — the can has to emerge past the HEPA pack or the step's own
  // "universal motor" callout has nothing to point at
  const endBell = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.082, 0.028, 26), nickelMat);
  endBell.rotation.z = Math.PI / 2;
  endBell.position.x = -0.188;
  motorGroup.add(endBell);

  // volute scroll around the impeller — inner face clears the blade tips
  const scroll = new THREE.Mesh(new THREE.TorusGeometry(0.145, 0.032, 14, 40), nickelMat);
  scroll.rotation.y = Math.PI / 2;
  scroll.position.x = 0.098;
  motorGroup.add(scroll);

  const impeller = bladeRing(
    {
      blades: 11,
      hubR: 0.028,
      span: 0.082,
      chord: 0.05,
      chordTip: 0.056,
      camber: 0.13,
      twist: 0.62,
      twistTip: 0.44,
      hubDepth: 0.03,
      hubMaterial: nickelMat,
    },
    impellerMat,
  );
  impeller.group.rotation.y = Math.PI / 2; // ring axis +Z re-aimed along +X
  impeller.group.position.x = 0.098;
  motorGroup.add(impeller.group);

  // post-motor HEPA: a pleated annulus wrapped round the motor can, which the
  // exhaust passes through on its way to the hub-cap slots
  const postHepa = gear(
    { teeth: 40, radius: 0.172, thickness: 0.11, toothDepth: 0.036, holeR: 0.098 },
    hepaMat,
  );
  postHepa.rotation.y = Math.PI / 2;
  postHepa.position.x = -0.075;
  motorGroup.add(postHepa);

  // ==========================================================================
  //  CHASSIS NECK (ball -> bin)
  // ==========================================================================
  const neckCol = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.185, 0.17, 32), bodyMat.clone());
  neckCol.position.set(0, 0.735, 0.04);
  group.add(neckCol);
  ghost(neckCol, 0.07);

  // ==========================================================================
  //  CLEAR BIN + FIRST-STAGE CYCLONE
  // ==========================================================================
  const binWall = new THREE.Mesh(new THREE.CylinderGeometry(BIN_R, BIN_R, BIN_H, 56, 1, true), clearMat);
  binWall.position.set(0, (BIN_Y0 + BIN_Y1) / 2, BIN_Z);
  group.add(binWall);

  // rims and stiffening ribs, so the clear bin has an outline instead of
  // disappearing into a gap between two dark blocks
  for (const ry of [BIN_Y0 + 0.012, BIN_Y1 - 0.012]) {
    const rim = new THREE.Mesh(new THREE.TorusGeometry(BIN_R + 0.002, 0.011, 10, 56), nickelMat);
    rim.rotation.x = Math.PI / 2;
    rim.position.set(0, ry, BIN_Z);
    group.add(rim);
  }
  for (let i = 0; i < 3; i++) {
    const a = -0.5 + (i / 3) * TAU;
    const strut = beveledBox(0.016, BIN_H - 0.03, 0.016, bodyMat2, 0.005);
    strut.position.set(
      Math.cos(a) * (BIN_R + 0.004),
      (BIN_Y0 + BIN_Y1) / 2,
      BIN_Z + Math.sin(a) * (BIN_R + 0.004),
    );
    group.add(strut);
  }

  const binBase = new THREE.Mesh(
    new THREE.CylinderGeometry(BIN_R + 0.008, BIN_R + 0.008, 0.042, 48),
    bodyMat2.clone(),
  );
  binBase.position.set(0, BIN_Y0 + 0.021, BIN_Z);
  group.add(binBase);

  const binLid = new THREE.Mesh(
    new THREE.CylinderGeometry(BIN_R + 0.008, BIN_R + 0.008, 0.038, 48),
    bodyMat.clone(),
  );
  binLid.position.set(0, BIN_Y1 - 0.019, BIN_Z);
  group.add(binLid);

  const catchTab = beveledBox(0.05, 0.034, 0.022, accentMat, 0.009);
  catchTab.position.set(-0.06, BIN_Y1 - 0.019, BIN_Z + BIN_R * 0.94);
  group.add(catchTab);

  // dust pile — banked against the wall the way cyclone dust actually settles.
  // Visible through the clear bin at EVERY reveal, because that is genuinely
  // what the sealed product looks like.
  const pileGroup = new THREE.Group();
  pileGroup.position.set(0, BIN_Y0 + 0.042, BIN_Z);
  group.add(pileGroup);
  pileGroup.add(
    lathe(
      [
        [0, 0],
        [BIN_R - 0.012, 0],
        [BIN_R - 0.016, 0.55],
        [BIN_R * 0.62, 0.9],
        [0, 1],
      ],
      dustMat,
      40,
    ),
  );

  // shroud: the perforated wall the air has to turn inward through, which the
  // dust cannot follow
  const shroud = new THREE.Mesh(
    new THREE.CylinderGeometry(SHROUD_R, SHROUD_R, SHROUD_Y1 - SHROUD_Y0, 36, 1, true),
    meshMat,
  );
  shroud.position.set(0, (SHROUD_Y0 + SHROUD_Y1) / 2, BIN_Z);
  group.add(shroud);
  internals.push(shroud);
  for (let i = 0; i < 30; i++) {
    const a = (i / 30) * TAU;
    const rib = beveledBox(0.006, SHROUD_Y1 - SHROUD_Y0 - 0.02, 0.006, nickelMat, 0.002);
    rib.position.set(
      Math.cos(a) * SHROUD_R,
      (SHROUD_Y0 + SHROUD_Y1) / 2,
      BIN_Z + Math.sin(a) * SHROUD_R,
    );
    group.add(rib);
    internals.push(rib);
  }
  const shroudCap = new THREE.Mesh(
    new THREE.CylinderGeometry(SHROUD_R + 0.006, SHROUD_R + 0.006, 0.014, 32),
    nickelMat,
  );
  shroudCap.position.set(0, SHROUD_Y0 - 0.007, BIN_Z);
  group.add(shroudCap);
  internals.push(shroudCap);

  // tangential inlet nozzle: enters on the +X wall aimed along -Z. That offset
  // is the entire reason the air spirals instead of just filling the bin.
  const inletBox = beveledBox(0.058, 0.072, 0.125, bodyMat2.clone(), 0.013);
  inletBox.position.set(BIN_R - 0.012, INLET_Y, BIN_Z + 0.07);
  group.add(inletBox);
  const inletLip = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.008, 8, 28), nickelMat);
  inletLip.rotation.x = Math.PI / 2;
  inletLip.rotation.z = Math.PI / 2;
  inletLip.position.set(BIN_R - 0.012, INLET_Y, BIN_Z + 0.132);
  group.add(inletLip);

  // ==========================================================================
  //  CYCLONE CONE CROWN (second stage)
  // ==========================================================================
  const cycGroup = new THREE.Group();
  group.add(cycGroup);

  const riser = new THREE.Mesh(new THREE.CylinderGeometry(0.095, 0.095, 0.05, 28, 1, true), nickelMat);
  riser.position.set(0, BIN_Y1 + 0.005, BIN_Z);
  cycGroup.add(riser);
  internals.push(riser);

  const cones = [];
  const dropHoles = [];
  for (let i = 0; i < CONE_N; i++) {
    const a = (i / CONE_N) * TAU;
    const cx = Math.cos(a) * CONE_RING;
    const cz = BIN_Z + Math.sin(a) * CONE_RING;
    const cone = new THREE.Mesh(
      new THREE.CylinderGeometry(CONE_TOP_R, CONE_BOT_R, CONE_H, 20, 1, true),
      coneMat,
    );
    cone.position.set(cx, CONE_MIDY, cz);
    cycGroup.add(cone);
    internals.push(cone);
    // vortex finder: the little tube each cone's clean air escapes up through
    const finder = new THREE.Mesh(
      new THREE.CylinderGeometry(0.017, 0.017, 0.07, 14, 1, true),
      nickelMat,
    );
    finder.position.set(cx, CONE_Y1 - 0.018, cz);
    cycGroup.add(finder);
    internals.push(finder);
    cones.push({ x: cx, z: cz });
    dropHoles.push([cx, -Math.sin(a) * CONE_RING, 0.026]); // shape-local y = -world z
  }

  // the plate the cones stand on: a bore in the middle for air coming UP out of
  // the shroud, and one hole under each cone apex for fine dust dropping DOWN
  const dropPlate = annulus(CYC_R - 0.012, 0.098, 0.013, bodyMat2.clone(), dropHoles);
  dropPlate.position.set(0, PLATE_Y, BIN_Z);
  cycGroup.add(dropPlate);
  internals.push(dropPlate);

  // plenum roof — a ring, not a disc: the cleaned air leaves through its bore
  const plenumCap = annulus(CYC_R - 0.012, 0.1, 0.04, bodyMat2.clone());
  plenumCap.position.set(0, CONE_Y1 + 0.018, BIN_Z);
  cycGroup.add(plenumCap);
  internals.push(plenumCap);

  // opaque outer cover — this is what keeps step 1 a sealed product
  const cycCover = new THREE.Mesh(
    new THREE.CylinderGeometry(CYC_R, CYC_R, CYC_Y1 - CYC_Y0, 48, 1, true),
    bodyMat.clone(),
  );
  cycCover.position.set(0, (CYC_Y0 + CYC_Y1) / 2, BIN_Z);
  group.add(cycCover);
  ghost(cycCover, 0.05);

  const cycRing = new THREE.Mesh(new THREE.TorusGeometry(CYC_R + 0.004, 0.013, 10, 56), accentMat);
  cycRing.rotation.x = Math.PI / 2;
  cycRing.position.set(0, CYC_Y0 + 0.028, BIN_Z);
  group.add(cycRing);

  // ==========================================================================
  //  PRE-MOTOR FILTER
  // ==========================================================================
  const filtHousing = new THREE.Mesh(
    new THREE.CylinderGeometry(FILT_R, FILT_R * 0.96, FILT_Y1 - FILT_Y0, 44, 1, true),
    bodyMat.clone(),
  );
  filtHousing.position.set(0, FILT_MIDY, BIN_Z);
  group.add(filtHousing);
  ghost(filtHousing, 0.05);

  const filtTop = new THREE.Mesh(
    new THREE.CylinderGeometry(FILT_R * 0.96, FILT_R * 0.7, 0.05, 40),
    bodyMat2.clone(),
  );
  filtTop.position.set(0, FILT_Y1 + 0.02, BIN_Z);
  group.add(filtTop);

  // gear()'s tooth profile makes an excellent accordion pleat pack
  const preFilter = gear(
    {
      teeth: 34,
      radius: FILT_R - 0.022,
      thickness: FILT_Y1 - FILT_Y0 - 0.028,
      toothDepth: 0.042,
      holeR: 0.05,
    },
    filterMat,
  );
  preFilter.rotation.x = -Math.PI / 2;
  preFilter.position.set(0, FILT_MIDY, BIN_Z);
  cycGroup.add(preFilter);
  internals.push(preFilter);

  // ==========================================================================
  //  DUCTWORK — the air path, drawn as real bent pipe. Both ducts keep a
  //  visible ghost floor so the packets inside plainly ride INSIDE a pipe.
  // ==========================================================================
  const intakeDuct = tubeAlong(
    [
      [0.0, Y0 + 0.045, 0.6],
      [0.02, Y0 + 0.075, 0.44],
      [0.08, Y0 + 0.1, 0.3],
      [0.17, 0.44, 0.26],
      [0.24, 0.62, 0.26],
      [0.27, 0.86, 0.28],
      [0.28, 1.06, 0.28],
      [0.27, 1.2, 0.24],
      [0.24, INLET_Y, 0.16],
      [0.2, INLET_Y, 0.05],
    ],
    0.038,
    ductMat.clone(),
    { tubularSegments: 150, radialSegments: 18 },
  );
  group.add(intakeDuct);
  ghost(intakeDuct, 0.24);
  const intakeCurve = intakeDuct.userData.curve;

  const returnDuct = tubeAlong(
    [
      [0.0, 1.76, 0.12],
      [-0.12, 1.72, 0.16],
      [-0.24, 1.56, 0.18],
      [-0.29, 1.3, 0.16],
      [-0.3, 1.05, 0.12],
      [-0.27, 0.84, 0.04],
      [-0.17, 0.66, -0.05],
      [-0.02, 0.55, -0.1],
    ],
    0.036,
    ductMat.clone(),
    { tubularSegments: 140, radialSegments: 16 },
  );
  group.add(returnDuct);
  ghost(returnDuct, 0.24);
  const returnCurve = returnDuct.userData.curve;

  // ==========================================================================
  //  WAND, SPINE & HANDLE
  // ==========================================================================
  const wand = rod(WAND_R, WAND_Y1 - WAND_Y0, nickelMat, 28);
  wand.position.set(0, WAND_Y0, SPINE_Z);
  group.add(wand);

  const wandCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.072, 0.082, 0.1, 24),
    bodyMat2.clone(),
  );
  wandCollar.position.set(0, WAND_Y0 + 0.05, SPINE_Z);
  group.add(wandCollar);

  const wandBracket = beveledBox(0.1, 0.24, 0.11, bodyMat.clone(), 0.02);
  wandBracket.position.set(0, 1.7, SPINE_Z + 0.035);
  group.add(wandBracket);

  // cord hook — the detail that stops the wand reading as a bare rod
  const cordHook = beveledBox(0.09, 0.03, 0.075, bodyMat2.clone(), 0.012);
  cordHook.position.set(0, 2.02, SPINE_Z + 0.055);
  group.add(cordHook);

  const grip = tubeAlong(
    [
      [0, 2.22, SPINE_Z],
      [0, 2.44, SPINE_Z + 0.005],
      [0, 2.58, SPINE_Z + 0.075],
      [0, TOP_Y, SPINE_Z + 0.2],
      [0, 2.55, SPINE_Z + 0.3],
      [0, 2.4, SPINE_Z + 0.29],
      [0, 2.3, SPINE_Z + 0.17],
      [0, 2.25, SPINE_Z + 0.04],
    ],
    0.036,
    gripMat,
    { tubularSegments: 110, radialSegments: 14, tension: 0.5 },
  );
  group.add(grip);

  const trigger = beveledBox(0.05, 0.075, 0.028, accentMat, 0.01);
  trigger.position.set(0, 2.44, SPINE_Z + 0.31);
  group.add(trigger);

  const gripCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(0.064, 0.056, 0.08, 20),
    bodyMat2.clone(),
  );
  gripCollar.position.set(0, 2.24, SPINE_Z);
  group.add(gripCollar);

  // ==========================================================================
  //  FLOW VISUALISATION
  // ==========================================================================
  function makeDots(count, color, size, { always = false } = {}) {
    const geo = new THREE.SphereGeometry(size, 10, 8);
    const g = new THREE.Group();
    const dots = [];
    for (let i = 0; i < count; i++) {
      const mat = materials.glow(color, 1.15);
      mat.transparent = true;
      mat.opacity = 0;
      mat.depthWrite = false; // anything that fades to 0 must not punch holes
      const mesh = new THREE.Mesh(geo, mat);
      g.add(mesh);
      dots.push({ mesh, seed: i / count, h1: hash(i + 1), h2: hash(i + 41) });
    }
    group.add(g);
    if (!always) internals.push(g);
    return dots;
  }

  const GRIT = 0x9a7d55;
  const FINE = 0xb9a98e;
  const AIR = 0x8fe0f0;

  const roomDots = makeDots(16, GRIT, 0.013, { always: true });
  const intakeDots = makeDots(15, GRIT, 0.012);
  const vortexDust = makeDots(14, GRIT, 0.012);
  const vortexAir = makeDots(10, AIR, 0.011);
  const coneDust = makeDots(8, FINE, 0.009);
  const coneAir = makeDots(8, AIR, 0.009);
  const returnDots = makeDots(12, AIR, 0.011);
  const exhaustDots = makeDots(12, AIR, 0.011, { always: true });

  let globalFlow = 0;
  let pileH = 0.045;
  const tmp = new THREE.Vector3();

  function placeRoom() {
    roomDots.forEach(({ mesh, seed, h1, h2 }) => {
      const t = (globalFlow + seed) % 1;
      const sx = (h1 - 0.5) * 0.72;
      const sz = 0.84 + h2 * 0.55;
      const e = t * t; // accelerates as it enters the low-pressure zone
      mesh.position.set(
        lerp(sx, sx * 0.18, e),
        Y0 + 0.011 + Math.sin(e * Math.PI) * 0.018,
        lerp(sz, SLOT_Z, e),
      );
      mesh.material.opacity = clamp01(win(t, 0, 0.08) * (1 - win(t, 0.84, 0.98))) * 0.95;
    });
  }

  function placeOnCurve(dots, curve, rate, jitter) {
    dots.forEach(({ mesh, seed, h1, h2 }) => {
      const t = (globalFlow * rate + seed) % 1;
      curve.getPointAt(t, tmp);
      mesh.position.set(
        tmp.x + (h1 - 0.5) * jitter,
        tmp.y + (h2 - 0.5) * jitter,
        tmp.z + (h1 + h2 - 1) * jitter * 0.5,
      );
      mesh.material.opacity = clamp01(win(t, 0, 0.06) * (1 - win(t, 0.92, 1))) * 0.95;
    });
  }

  function placeVortex() {
    // heavy grit: too much inertia to turn, so it hugs the wall the whole way
    // down and lands on the pile
    vortexDust.forEach(({ mesh, seed, h1 }) => {
      const t = (globalFlow + seed) % 1;
      const ang = h1 * TAU + t * TAU * 2.4;
      const r = BIN_R - 0.026 - h1 * 0.008;
      let y = lerp(INLET_Y - 0.02, BIN_Y0 + 0.14, win(t, 0, 0.68));
      y = lerp(y, BIN_Y0 + 0.05 + pileH * (0.4 + 0.4 * h1), win(t, 0.66, 0.92));
      mesh.position.set(Math.cos(ang) * r, y, BIN_Z + Math.sin(ang) * r);
      mesh.material.opacity = clamp01(win(t, 0, 0.06) * (1 - win(t, 0.88, 0.99))) * 0.95;
    });
    // light air: spirals down, then turns in through the shroud and rises
    vortexAir.forEach(({ mesh, seed, h1 }) => {
      const t = (globalFlow + seed) % 1;
      const ang = h1 * TAU + t * TAU * 2.4;
      const r = lerp(BIN_R - 0.04, SHROUD_R * 0.5, win(t, 0.42, 0.72));
      let y = lerp(INLET_Y - 0.02, SHROUD_Y0 + 0.06, win(t, 0, 0.5));
      y = lerp(y, PLATE_Y + 0.02, win(t, 0.6, 1));
      mesh.position.set(Math.cos(ang) * r, y, BIN_Z + Math.sin(ang) * r);
      mesh.material.opacity = clamp01(win(t, 0, 0.06) * (1 - win(t, 0.9, 1))) * 0.9;
    });
  }

  function placeCones() {
    const coneR = (u) => lerp(CONE_TOP_R, CONE_BOT_R, u); // u: 0 top -> 1 apex
    // fine dust: spun onto the cone wall, slid to the apex, dropped into the bin
    coneDust.forEach(({ mesh, seed, h1 }, i) => {
      const c = cones[i % CONE_N];
      const t = (globalFlow + seed) % 1;
      const u = win(t, 0, 0.55);
      const fall = win(t, 0.55, 0.95);
      const ang = h1 * TAU + t * TAU * 3;
      const r = coneR(u) * 0.78 * (1 - fall * 0.75);
      const y = lerp(lerp(CONE_Y1 - 0.02, CONE_Y0 + 0.012, u), BIN_Y0 + 0.06 + pileH, fall);
      mesh.position.set(c.x + Math.cos(ang) * r, y, c.z + Math.sin(ang) * r);
      mesh.material.opacity = clamp01(win(t, 0, 0.08) * (1 - win(t, 0.88, 1))) * 0.95;
    });
    // clean air: down the cone wall, back up the middle, out the vortex finder,
    // then inward across the plenum and up into the pre-motor filter
    coneAir.forEach(({ mesh, seed, h1 }, i) => {
      const c = cones[(i + 3) % CONE_N];
      const t = (globalFlow + seed) % 1;
      const u = win(t, 0, 0.5);
      const up = win(t, 0.5, 0.82);
      const exit = win(t, 0.82, 1);
      const ang = h1 * TAU + t * TAU * 3;
      const r = lerp(coneR(u) * 0.7, 0.012, up);
      const y = lerp(lerp(CONE_Y1 - 0.03, CONE_Y0 + 0.04, u), CONE_Y1 + 0.045, up);
      mesh.position.set(
        lerp(c.x + Math.cos(ang) * r, 0, exit),
        lerp(y, FILT_MIDY + 0.02, exit),
        lerp(c.z + Math.sin(ang) * r, BIN_Z, exit),
      );
      mesh.material.opacity = clamp01(win(t, 0, 0.08) * (1 - win(t, 0.9, 1))) * 0.9;
    });
  }

  function placeExhaust() {
    exhaustDots.forEach(({ mesh, seed, h1, h2 }, i) => {
      const t = (globalFlow * 2 + seed) % 1;
      const sx = i % 2 === 0 ? 1 : -1;
      const a = h1 * TAU;
      const spread = VENT_R + t * 0.1;
      mesh.position.set(
        sx * (HUB_FACE + 0.02 + t * 0.32),
        BALL_Y + Math.cos(a) * spread + t * 0.06,
        BALL_Z + Math.sin(a) * spread + (h2 - 0.5) * 0.04,
      );
      mesh.material.opacity = clamp01(win(t, 0, 0.12) * (1 - win(t, 0.4, 1))) * 0.55;
    });
  }

  // ==========================================================================
  //  CALLOUTS
  // ==========================================================================
  const labels = calloutSets(['exterior', 'path', 'head', 'cyclone', 'filter', 'motor']);

  labels.add('exterior', group, 'Cleaner head', [0.2, HEAD_Y1, HEAD_Z + 0.14], 26, 76);
  labels.add('exterior', group, 'Clear dust bin', [0.17, 1.0, BIN_Z + 0.14], -16, 82);
  labels.add('exterior', group, 'Cyclone pack', [0.16, CONE_MIDY, BIN_Z + 0.15], 22, 78);
  labels.add('exterior', group, 'Wand & grip', [0.03, 2.42, SPINE_Z + 0.3], 18, 74);
  labels.add('exterior', group, 'Ball — motor inside', [0.2, BALL_Y + 0.1, BALL_Z + 0.12], -44, 90);

  labels.add('path', group, 'Suction slot', [0.12, Y0 + 0.018, SLOT_Z], -32, 86);
  labels.add('path', group, 'Intake duct', [0.275, 0.95, 0.28], 10, 72);
  labels.add('path', group, 'Tangential inlet', [0.21, INLET_Y, BIN_Z + 0.04], 34, 86);
  labels.add('path', group, 'Pre-motor filter', [0.14, FILT_MIDY, BIN_Z + 0.1], 30, 76);
  labels.add('path', group, 'Return duct', [-0.3, 1.1, 0.13], 25, 92);
  labels.add('path', group, 'Suction motor', [0.11, BALL_Y, BALL_Z + 0.09], -50, 84);

  labels.add('head', group, 'Brush roll', [0.13, BRUSH_Y + BRUSH_R, BRUSH_Z], 48, 76);
  labels.add('head', group, 'Drive belt', [BELT_X, Y0 + 0.14, BRUSH_Z - 0.09], 24, 70);
  labels.add('head', group, 'Soleplate', [0.21, Y0 + 0.012, HEAD_Z - 0.1], -38, 76);
  labels.add('head', group, 'Suction slot', [-0.04, Y0 + 0.026, SLOT_Z], -78, 72);

  labels.add('cyclone', group, 'Tangential inlet', [0.2, INLET_Y, BIN_Z + 0.03], 38, 80);
  labels.add('cyclone', group, 'Dust thrown to the wall', [BIN_R - 0.02, 1.1, BIN_Z + 0.05], 4, 98);
  labels.add('cyclone', group, 'Shroud — air turns in here', [SHROUD_R * 0.8, 1.19, BIN_Z + 0.04], 64, 94);
  labels.add('cyclone', group, 'Dust drops out', [0.13, BIN_Y0 + 0.1, BIN_Z + 0.12], -34, 90);

  labels.add('filter', group, 'Fine-dust cones', [0.16, CONE_MIDY + 0.03, BIN_Z + 0.09], 24, 80);
  labels.add('filter', group, 'Vortex finder', [CONE_RING * 0.75, CONE_Y1 + 0.01, BIN_Z + 0.05], 58, 74);
  labels.add('filter', group, 'Pre-motor filter', [0.14, FILT_MIDY, BIN_Z + 0.1], 26, 78);

  labels.add('motor', group, 'Impeller', [0.14, BALL_Y + 0.05, BALL_Z + 0.04], 44, 74);
  labels.add('motor', group, 'Universal motor', [-0.15, BALL_Y - 0.02, BALL_Z + 0.07], -56, 80);
  labels.add('motor', group, 'Post-motor HEPA', [0.0, BALL_Y + 0.17, BALL_Z + 0.05], 76, 80);
  labels.add('motor', group, 'Exhaust vents', [HUB_FACE, BALL_Y - 0.07, BALL_Z + 0.04], -24, 82);

  // ==========================================================================
  //  POSE
  // ==========================================================================
  const state = { reveal: 0, flow: 0, brush: 0, impeller: 0, fill: 0.45 };

  function apply() {
    globalFlow = state.flow;
    pileH = 0.012 + clamp01(state.fill) * PILE_MAX;

    brushGroup.rotation.x = -state.brush;
    pulleyB.rotation.x = -state.brush * (PULLEY_A / PULLEY_B); // exactly 3:2
    impeller.group.rotation.z = -state.impeller;
    pileGroup.scale.y = pileH;

    placeRoom();
    placeOnCurve(intakeDots, intakeCurve, 1, 0.016);
    placeVortex();
    placeCones();
    placeOnCurve(returnDots, returnCurve, 1, 0.014);
    placeExhaust();

    const r = clamp01(state.reveal);
    for (const m of ghosts) {
      const mat = m.material;
      const floor = m.userData.ghostFloor ?? 0.06;
      mat.transparent = r > 0.02;
      mat.opacity = 1 - r * (1 - floor);
      mat.depthWrite = r < 0.4;
      mat.clearcoat = r > 0.5 ? 0 : 0.15; // coat specular ignores opacity
    }
    // the clear bin stays clear at every reveal; it just gets further out of
    // the way once the mechanism is the subject
    clearMat.opacity = 0.28 - r * 0.15;
    for (const o of internals) o.visible = r > 0.5;
  }
  apply();

  return {
    group,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
    parts: {
      brush: brushGroup,
      impeller: impeller.group,
      head: headGroup,
      cyclone: cycGroup,
      motor: motorGroup,
      pile: pileGroup,
    },
  };
}
