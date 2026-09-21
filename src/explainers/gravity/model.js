import * as THREE from 'three';
import { materials, studioPlinth, rod, disc } from '../../framework/parts.js';
import { beveledBox, lathe, coil, boltCircle } from '../../framework/geometry.js';
import { smooth, clamp01, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// ===========================================================================
//  HOW GRAVITY WORKS — a benchtop free-fall rig
// ===========================================================================
//
// The hero object is a real instrument, not a diagram: an evacuated drop
// column with an instrumented capsule inside it. The capsule carries an
// ordinary capacitive accelerometer — a proof mass slung between two pickoff
// plates — and that single part IS the equivalence principle in hardware. At
// rest on the bench the bench pushes the case up, the mass lags, the gap
// changes, the readout says 1.000 g. Released, case and mass fall together,
// the gap centres, and the readout says 0.000. Nothing about the Earth
// changed between those two frames.
//
// IMPLIED SCALE: 1 world unit = 32 cm. So the column is 61 cm of glass, the
// capsule is 14 cm long, and the two optical clock heads on the rail are
// 1.03 u = 33.0 cm apart — which is exactly the height difference NIST used
// in 2010 to measure gravitational time dilation across a lab bench.
//
// PROPORTION TARGETS (first render came back squat — a 2.7:1 column read as a
// blender jar, so these are now held deliberately slender):
//   column height : column diameter  = 1.90 : 0.49 = 3.9 : 1
//   column bore   : capsule diameter = 0.44 : 0.29 = 1.52 : 1
//   base width    : column height    = 1.05 : 1.90 = 0.55 : 1
//   clock separation                 = 1.03 u      = 33.0 cm exactly
//
// THE HONESTY CONSTRAINT (see story.js): no rubber sheet anywhere. The
// rubber-sheet demo explains gravity using gravity, and it shows curved
// SPACE — the component that contributes essentially nothing at walking
// speed. Every curvature visual here is the rate of TIME: the lattice is a
// stack of clock planes that packs together lower down. The model shows a
// ~15x spacing ratio where the real fractional difference over this column is
// gh/c^2 = 6.5e-17, so the exaggeration is ~10^17 and is stated on screen.

const PLINTH_H = 0.26;
const Y0 = PLINTH_H; // everything is built up from the plinth's top face

const ACCENT = 0xb8c6ff;
const WARM = 0xffc49a; // slow-time end of the lattice gradient

// --- base ------------------------------------------------------------------
const BASE_W = 1.05;
const BASE_H = 0.3;
const BASE_D = 0.78;

// --- column ----------------------------------------------------------------
const COL_R_IN = 0.22;
const COL_R_OUT = 0.245;
const COL_Y_LO = Y0 + BASE_H; // 0.56
const COL_Y_HI = Y0 + 2.2; // 2.46

// --- capsule ---------------------------------------------------------------
const CAP_R = 0.145;
const CAP_BODY = 0.28;
const CAP_DOME = 0.075;
const CAP_HALF = CAP_BODY / 2 + CAP_DOME; // 0.215
// The clamp hangs well below the column head, so the macro shot on the held
// capsule frames clean glass instead of the cap casting.
const CLAMP_Y = COL_Y_HI - 0.3; // 2.16
const CAP_TOP_Y = CLAMP_Y - CAP_HALF; // 1.945
const CAP_BOT_Y = COL_Y_LO + 0.04 + CAP_HALF; // 0.815
const CAP_TRAVEL = CAP_TOP_Y - CAP_BOT_Y; // 1.13

// --- accelerometer ---------------------------------------------------------
const PM_GAP = 0.062; // proof-mass centre to each pickoff plate
const PM_DEFL_1G = 0.024; // deflection at one g
const PM_DEFL_MAX = 0.045; // hard stops

// --- clock rail ------------------------------------------------------------
// On the -X side: step 5 views the heads from that bearing, so they sit in
// FRONT of the column rather than behind it.
const RAIL_X = -0.52;
const CLK_LO_Y = Y0 + 0.62;
const CLK_HI_Y = Y0 + 1.65; // 1.03 u above = 33.0 cm

// --- time-rate lattice -----------------------------------------------------
const LAT_LEVELS = 11;
const LAT_R = 1.55;
const LAT_R_IN = 0.34;
const LAT_Y_LO = Y0 + 0.02;
const LAT_Y_HI = Y0 + 2.66;

// --- projection station (worldline, then orbit) ----------------------------
const PROJ_X = 2.25;
const PROJ_Y = Y0 + 1.3;

// ===========================================================================
//  small helpers
// ===========================================================================

// An emissive instrument display. Redraws only when the text actually
// changes — this is called every frame from the pose function.
function displayPanel(w, h, { px = 512 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = Math.max(32, Math.round((px * h) / w));
  const ctx = canvas.getContext('2d');
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  const mesh = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: tex, toneMapped: false, transparent: true }),
  );
  let last = null;

  function draw(lines) {
    const key = lines.join('|');
    if (key === last) return;
    last = key;
    const W = canvas.width;
    const H = canvas.height;
    ctx.fillStyle = '#0a0c11';
    ctx.fillRect(0, 0, W, H);
    const lw = Math.max(2, W * 0.008);
    ctx.strokeStyle = 'rgba(184,198,255,0.22)';
    ctx.lineWidth = lw;
    ctx.strokeRect(lw, lw, W - lw * 2, H - lw * 2);
    const n = lines.length;
    lines.forEach((line, i) => {
      const big = i === n - 1 && n > 1;
      ctx.fillStyle = big ? '#dbe4ff' : 'rgba(184,198,255,0.72)';
      ctx.font = `${big ? 700 : 500} ${Math.round(H * (big ? 0.4 : 0.19))}px Consolas, monospace`;
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      const y = n === 1 ? H / 2 : H * (0.28 + (i * 0.56) / Math.max(1, n - 1));
      ctx.fillText(line, W / 2, y);
    });
    tex.needsUpdate = true;
  }

  draw(['']);
  return { mesh, draw };
}

// A flat band whose spine is rewritten every frame. Cheaper and better
// looking than rebuilding a TubeGeometry: PlaneGeometry already gives two
// rows of vertices, so we just move them.
function ribbonMesh(segs, material, halfWidth) {
  const geo = new THREE.PlaneGeometry(1, 1, segs, 1);
  const mesh = new THREE.Mesh(geo, material);
  const pos = geo.attributes.position;
  const p = new THREE.Vector3();
  const nrm = new THREE.Vector3();

  function update(fn) {
    for (let i = 0; i <= segs; i++) {
      fn(i / segs, p, nrm);
      pos.setXYZ(i, p.x + nrm.x * halfWidth, p.y + nrm.y * halfWidth, p.z + nrm.z * halfWidth);
      pos.setXYZ(
        segs + 1 + i,
        p.x - nrm.x * halfWidth,
        p.y - nrm.y * halfWidth,
        p.z - nrm.z * halfWidth,
      );
    }
    pos.needsUpdate = true;
    geo.computeBoundingSphere();
  }

  return { mesh, update };
}

// The whole drop cycle, one complete cycle per lap so the loop is seamless.
// Returns the capsule height, the PROPER acceleration the capsule actually
// experiences (which is what an accelerometer reads), the clamp jaw opening
// and the lift-carriage height.
//
// The arrest figure is not invented: free fall covers 93% of the travel in
// 0.275 of a lap and the catch kills that speed in 0.055, a deceleration
// about five times the fall — so the readout spikes to roughly six g.
function dropCycle(u) {
  let capY = CAP_TOP_Y;
  let accelG = 1;
  let jaw = 0;

  if (u < 0.15) {
    // held at the top, clamp closed
  } else if (u < 0.175) {
    jaw = smooth((u - 0.15) / 0.025);
  } else if (u < 0.45) {
    // free fall — quadratic in time, and the accelerometer reads nothing
    const s = (u - 0.175) / 0.275;
    capY = CAP_TOP_Y - 0.93 * CAP_TRAVEL * s * s;
    accelG = 0;
    jaw = 1;
  } else if (u < 0.505) {
    // the catch cradle arrests it
    const s = (u - 0.45) / 0.055;
    capY = CAP_TOP_Y - CAP_TRAVEL * (0.93 + 0.07 * (1 - (1 - s) * (1 - s)));
    accelG = 1 + 5.4 * Math.sin(Math.PI * s);
    jaw = 1;
  } else if (u < 0.605) {
    capY = CAP_BOT_Y;
    jaw = 1;
  } else if (u < 0.95) {
    // the carriage hoists it back — a real lift, not a fade
    const s = (u - 0.605) / 0.345;
    capY = CAP_BOT_Y + CAP_TRAVEL * smooth(s);
    accelG = 1 + 0.5 * Math.sin(TAU * s);
    jaw = 1;
  } else {
    jaw = 1 - smooth((u - 0.95) / 0.05);
  }

  // the carriage: parked up top, drops to meet the capsule, hoists it back
  let carY = CAP_TOP_Y;
  if (u < 0.5) carY = CAP_TOP_Y;
  else if (u < 0.605) carY = CAP_TOP_Y - CAP_TRAVEL * smooth((u - 0.5) / 0.105);
  else if (u < 0.95) carY = capY;

  return { capY, accelG, jaw, carY };
}

// ===========================================================================
//  build
// ===========================================================================
export function buildGravity({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const matBase = materials.aluminum(0x9fa7b2);
  matBase.roughness = 0.62;
  // the column head: darker anodised aluminium. A bright turned cap up there
  // reads as a kitchen appliance lid, which is exactly how the first pass came
  // back looking.
  const matHead = materials.aluminum(0x6f7681);
  matHead.roughness = 0.72;
  const matRail = materials.brushedSteel(0xb6bdc7);
  matRail.roughness = 0.55;
  // Map-free machined metal for the small parts. The cast roughness/normal
  // maps are scaled for large housings; on a 17 cm clock head they read as
  // coarse grey speckle at macro range.
  const matMachined = new THREE.MeshPhysicalMaterial({
    color: 0x8a919c,
    metalness: 1,
    roughness: 0.42,
  });
  const matDark = materials.polymer(0x1d2027);
  const matShell = materials.paintedMetal(0xd6dae2);
  // polished tungsten — it has to read as the one solid thing in there
  const matMass = materials.chrome(0xb9c0cb);
  matMass.roughness = 0.18;
  const matSpring = materials.brushedSteel(0xa9b0ba);
  // lifted off near-black: seen through the shell at macro range the first
  // pass's 0x2a2f38 plates vanished into the haze
  const matPlate = materials.polymer(0x3f4653);
  matPlate.emissive = new THREE.Color(ACCENT);
  matPlate.emissiveIntensity = 0.18;

  // TRAP #1: the column is PLAIN transparent glass, never opticalGlass. The
  // transmission pass only samples opaque geometry, and the lattice, the
  // worldline ribbon and the orbit band behind this tube are all transparent
  // — a transmissive column would erase every one of them.
  const matGlass = new THREE.MeshPhysicalMaterial({
    color: 0xc4d6f5,
    metalness: 0,
    roughness: 0.09,
    transparent: true,
    opacity: 0.13,
    side: THREE.DoubleSide,
    depthWrite: false,
  });

  const holoMat = (color = ACCENT) =>
    new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

  const holoLine = (color = ACCENT) =>
    new THREE.LineBasicMaterial({
      color,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      toneMapped: false,
    });

  group.add(studioPlinth({ w: 3.0, h: PLINTH_H, d: 1.7 }));

  const shellSoft = []; // ghost on reveal
  const shellHide = []; // metal — hidden outright (trap #3)
  const internals = []; // hidden until revealed

  // -------------------------------------------------------------------------
  //  BASE — the instrument block the column stands on
  // -------------------------------------------------------------------------
  const baseBlock = beveledBox(BASE_W, BASE_H, BASE_D, matBase, 0.026);
  baseBlock.position.y = Y0 + BASE_H / 2;
  baseBlock.receiveShadow = true;
  group.add(baseBlock);

  const baseSkirt = beveledBox(BASE_W + 0.08, 0.032, BASE_D + 0.08, matDark, 0.01);
  baseSkirt.position.y = Y0 + 0.016;
  group.add(baseSkirt);

  const baseFace = beveledBox(0.64, 0.17, 0.02, matDark, 0.007);
  baseFace.position.set(-0.14, Y0 + 0.155, BASE_D / 2 + 0.005);
  group.add(baseFace);

  const dispG = displayPanel(0.58, 0.14);
  dispG.mesh.position.set(-0.14, Y0 + 0.155, BASE_D / 2 + 0.019);
  group.add(dispG.mesh);

  const basePort = rod(0.038, 0.14, matRail, 16);
  basePort.rotation.z = -Math.PI / 2;
  basePort.position.set(BASE_W / 2, Y0 + 0.15, 0.14);
  group.add(basePort);
  const basePortCap = disc(0.052, 0.018, matDark, 20);
  basePortCap.rotation.z = Math.PI / 2;
  basePortCap.position.set(BASE_W / 2 + 0.14, Y0 + 0.15, 0.14);
  group.add(basePortCap);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = rod(0.045, 0.028, matDark, 16);
      foot.position.set(sx * (BASE_W / 2 - 0.1), Y0 - 0.001, sz * (BASE_D / 2 - 0.1));
      group.add(foot);
    }
  }

  // -------------------------------------------------------------------------
  //  COLUMN — the evacuated drop tube
  // -------------------------------------------------------------------------
  const colH = COL_Y_HI - COL_Y_LO;

  const colGlass = new THREE.Mesh(
    new THREE.CylinderGeometry(COL_R_OUT, COL_R_OUT, colH, 56, 1, true),
    matGlass,
  );
  colGlass.position.y = COL_Y_LO + colH / 2;
  group.add(colGlass);

  const colGlassIn = new THREE.Mesh(
    new THREE.CylinderGeometry(COL_R_IN, COL_R_IN, colH, 56, 1, true),
    matGlass,
  );
  colGlassIn.position.y = COL_Y_LO + colH / 2;
  group.add(colGlassIn);

  // Faded right down on reveal. Looking at the accelerometer through the
  // capsule shell AND two column walls turned the macro step into fog; the
  // tube is not the subject once the shell is open.
  const columnGlass = [colGlass, colGlassIn];

  // flanges top and bottom — no flat cut faces anywhere
  for (const fy of [COL_Y_LO, COL_Y_HI]) {
    const yBase = fy === COL_Y_LO ? fy : fy - 0.08;
    const flange = lathe(
      [
        [COL_R_IN, 0],
        [0.32, 0],
        [0.34, 0.018],
        [0.34, 0.06],
        [0.32, 0.08],
        [COL_R_OUT + 0.008, 0.08],
        [COL_R_IN, 0.066],
      ],
      matRail,
      48,
    );
    flange.position.y = yBase;
    group.add(flange);
    const bolts = boltCircle(8, 0.285, 0.017, matRail, 0.022);
    bolts.position.y = yBase + 0.08;
    group.add(bolts);
  }

  // three tie rods running the column height — reads as lab hardware and
  // gives the eye a fixed ruler to measure the fall against
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.4;
    const tie = rod(0.014, colH + 0.02, matRail, 12);
    tie.position.set(Math.cos(a) * 0.315, COL_Y_LO, Math.sin(a) * 0.315);
    group.add(tie);
  }

  // a low machined head, not a dome
  const colCap = lathe(
    [
      [0, 0.115],
      [0.1, 0.11],
      [0.22, 0.078],
      [0.31, 0.03],
      [0.34, 0],
    ],
    matHead,
    48,
  );
  colCap.position.y = COL_Y_HI;
  group.add(colCap);

  // -------------------------------------------------------------------------
  //  RELEASE CLAMP, CATCH CRADLE, LIFT CARRIAGE
  // -------------------------------------------------------------------------
  const clampGroup = new THREE.Group();
  clampGroup.position.y = CLAMP_Y;
  group.add(clampGroup);
  const clampJaws = [];
  for (const side of [-1, 1]) {
    const jaw = beveledBox(0.16, 0.045, 0.085, matRail, 0.01);
    jaw.userData.side = side;
    clampGroup.add(jaw);
    clampJaws.push(jaw);
  }

  const cradle = lathe(
    [
      [0.08, 0.075],
      [0.155, 0.018],
      [0.17, 0],
      [0.08, 0],
    ],
    matDark,
    36,
  );
  cradle.position.y = COL_Y_LO + 0.02;
  group.add(cradle);

  const carriage = new THREE.Group();
  const carRing = new THREE.Mesh(new THREE.TorusGeometry(0.175, 0.013, 10, 40), matRail);
  carRing.rotation.x = Math.PI / 2;
  carriage.add(carRing);
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.4;
    const shoe = beveledBox(0.042, 0.034, 0.042, matDark, 0.008);
    shoe.position.set(Math.cos(a) * 0.195, 0, Math.sin(a) * 0.195);
    carriage.add(shoe);
  }
  group.add(carriage);

  const cable = rod(0.005, 1, matRail, 8);
  group.add(cable);

  // -------------------------------------------------------------------------
  //  CAPSULE — sealed shell, then the accelerometer inside it
  // -------------------------------------------------------------------------
  const capsule = new THREE.Group();
  group.add(capsule);

  const capBody = new THREE.Mesh(new THREE.CylinderGeometry(CAP_R, CAP_R, CAP_BODY, 40), matShell);
  capsule.add(capBody);
  shellSoft.push(capBody);

  for (const s of [1, -1]) {
    const dome = lathe(
      [
        [0, CAP_DOME],
        [CAP_R * 0.5, CAP_DOME * 0.86],
        [CAP_R * 0.85, CAP_DOME * 0.52],
        [CAP_R, 0],
      ],
      matShell,
      40,
    );
    dome.scale.y = s;
    dome.position.y = (s * CAP_BODY) / 2;
    capsule.add(dome);
    shellSoft.push(dome);
  }

  for (const by of [-0.085, 0.085]) {
    const band = new THREE.Mesh(new THREE.TorusGeometry(CAP_R + 0.004, 0.008, 8, 40), matRail);
    band.rotation.x = Math.PI / 2;
    band.position.y = by;
    capsule.add(band);
    shellHide.push(band);
  }
  const capLamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.015, 14, 10),
    new THREE.MeshBasicMaterial({ color: ACCENT, toneMapped: false }),
  );
  capLamp.position.set(0, 0.105, CAP_R - 0.008);
  capsule.add(capLamp);
  shellHide.push(capLamp);

  // --- the accelerometer ---------------------------------------------------
  const pmGroup = new THREE.Group();
  capsule.add(pmGroup);

  // The frame the plates are bolted to — this is the part the bench pushes.
  // Built as rings and posts rather than a solid can: a closed case hid the
  // proof mass from every camera in the first pass, and the mechanism being
  // legible matters more than the housing being complete.
  const pmFrame = new THREE.Group();
  pmGroup.add(pmFrame);
  for (const s of [1, -1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.1, 0.007, 8, 30), matPlate);
    ring.rotation.x = Math.PI / 2;
    ring.position.y = s * 0.1;
    pmFrame.add(ring);
  }
  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + 0.9;
    const post = rod(0.008, 0.2, matPlate, 10);
    post.position.set(Math.cos(a) * 0.1, -0.1, Math.sin(a) * 0.1);
    pmFrame.add(post);
  }
  internals.push(pmFrame);

  const pmPlates = [];
  for (const s of [1, -1]) {
    const plate = disc(0.088, 0.012, matPlate, 32);
    plate.position.y = s * PM_GAP;
    pmGroup.add(plate);
    internals.push(plate);
    pmPlates.push(plate);
  }

  const pmMass = new THREE.Mesh(new THREE.CylinderGeometry(0.068, 0.068, 0.044, 30), matMass);
  pmGroup.add(pmMass);
  internals.push(pmMass);
  const pmMassRim = new THREE.Mesh(new THREE.TorusGeometry(0.068, 0.006, 8, 32), matRail);
  pmMassRim.rotation.x = Math.PI / 2;
  pmMass.add(pmMassRim);

  const pmSprings = [];
  for (const s of [1, -1]) {
    const sp = coil(
      { turns: 4, radius: 0.036, length: 0.042, wireRadius: 0.005, segmentsPerTurn: 18 },
      matSpring,
    );
    pmGroup.add(sp.mesh);
    internals.push(sp.mesh);
    pmSprings.push({ mesh: sp.mesh, side: s });
  }

  // the gap that is actually being measured — brightens with the deflection
  const gapGlow = new THREE.Mesh(new THREE.RingGeometry(0.07, 0.088, 40), holoMat());
  gapGlow.rotation.x = -Math.PI / 2;
  pmGroup.add(gapGlow);
  internals.push(gapGlow);

  // -------------------------------------------------------------------------
  //  CLOCK RAIL — two optical clock heads, 33.0 cm apart
  // -------------------------------------------------------------------------
  const rail = beveledBox(0.06, CLK_HI_Y - CLK_LO_Y + 0.58, 0.06, matRail, 0.012);
  rail.position.set(RAIL_X, (CLK_LO_Y + CLK_HI_Y) / 2 - 0.06, 0);
  group.add(rail);
  const railFoot = beveledBox(0.18, 0.035, 0.18, matDark, 0.009);
  railFoot.position.set(RAIL_X, Y0 + BASE_H + 0.017, 0);
  group.add(railFoot);

  const clockHeads = [];
  for (const [cy, tag] of [
    [CLK_LO_Y, 'lo'],
    [CLK_HI_Y, 'hi'],
  ]) {
    const head = new THREE.Group();
    head.position.set(RAIL_X, cy, 0);
    group.add(head);

    const body = beveledBox(0.17, 0.14, 0.22, matMachined, 0.018);
    body.position.x = -0.12;
    head.add(body);

    // the interrogation window, facing up out of the head
    const win = disc(
      0.034,
      0.012,
      new THREE.MeshBasicMaterial({
        color: tag === 'hi' ? 0xdfe7ff : 0xffc79a,
        toneMapped: false,
      }),
      24,
    );
    win.position.set(-0.12, 0.072, 0);
    head.add(win);

    // display on the -X face, square to step 5's camera bearing
    const disp = displayPanel(0.15, 0.075, { px: 300 });
    disp.mesh.position.set(-0.208, 0.005, 0);
    disp.mesh.rotation.y = -Math.PI / 2;
    head.add(disp.mesh);

    clockHeads.push({ head, disp, tag });
  }

  // The amplified beat display: two dot trains running down at 12 and 13 slots
  // per lap, so the upper clock's train gains exactly one slot on the lower
  // one every lap. Both counts are whole numbers, so the wrap is invisible.
  // Labelled on screen as amplified — the true rate difference is 3.6e-17 and
  // could never be drawn at any honest scale.
  const beatGroup = new THREE.Group();
  beatGroup.position.set(RAIL_X - 0.3, (CLK_LO_Y + CLK_HI_Y) / 2, 0.06);
  group.add(beatGroup);
  const beatDots = [];
  for (let r = 0; r < 2; r++) {
    for (let i = 0; i < 12; i++) {
      const dot = new THREE.Mesh(
        new THREE.SphereGeometry(0.013, 10, 8),
        new THREE.MeshBasicMaterial({
          color: r === 0 ? WARM : ACCENT,
          transparent: true,
          opacity: 0,
          toneMapped: false,
          blending: THREE.AdditiveBlending,
          depthWrite: false,
        }),
      );
      beatGroup.add(dot);
      beatDots.push({ mesh: dot, row: r, i });
    }
  }

  // -------------------------------------------------------------------------
  //  TIME-RATE LATTICE — a stack of clock planes, not a rubber sheet
  // -------------------------------------------------------------------------
  //
  // First pass drew these as wireframe circles plus spokes plus verticals, and
  // it read as a birdcage around the rig. Planes have to look like PLANES: each
  // level is now a faint additive sheet with a bright rim, and there are no
  // vertical members at all. Seen near edge-on the stack reads as what it is —
  // sheets of equal clock time, crowding together lower down.
  const latGroup = new THREE.Group();
  group.add(latGroup);

  const latLevels = [];
  for (let i = 0; i < LAT_LEVELS; i++) {
    const t = i / (LAT_LEVELS - 1);
    const color = new THREE.Color(WARM).lerp(new THREE.Color(ACCENT), t);
    const level = new THREE.Group();

    const sheetGeo = new THREE.RingGeometry(LAT_R_IN, LAT_R, 72, 1);
    sheetGeo.rotateX(-Math.PI / 2);
    const sheetMat = holoMat(color);
    level.add(new THREE.Mesh(sheetGeo, sheetMat));

    const rimPts = [];
    for (let k = 0; k < 96; k++) {
      const a = (k / 96) * TAU;
      rimPts.push(Math.cos(a) * LAT_R, 0, Math.sin(a) * LAT_R);
    }
    const rimGeo = new THREE.BufferGeometry();
    rimGeo.setAttribute('position', new THREE.Float32BufferAttribute(rimPts, 3));
    const rimMat = holoLine(color);
    level.add(new THREE.LineLoop(rimGeo, rimMat));

    latGroup.add(level);
    latLevels.push({ level, sheetMat, rimMat, t });
  }

  // -------------------------------------------------------------------------
  //  PROJECTION STATION — worldline, then orbit, in the same spot
  // -------------------------------------------------------------------------
  const projGroup = new THREE.Group();
  projGroup.position.set(PROJ_X, PROJ_Y, 0);
  group.add(projGroup);

  // --- worldline -----------------------------------------------------------
  const wlGroup = new THREE.Group();
  projGroup.add(wlGroup);

  const wlBack = new THREE.Mesh(
    new THREE.PlaneGeometry(2.5, 1.55),
    new THREE.MeshBasicMaterial({
      color: 0x0b0e14,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
      toneMapped: false,
    }),
  );
  wlGroup.add(wlBack);

  const wlFrameMat = holoLine();
  wlGroup.add(
    new THREE.LineSegments(
      new THREE.EdgesGeometry(new THREE.PlaneGeometry(2.5, 1.55)),
      wlFrameMat,
    ),
  );

  const WL_HW = 1.1; // half width = two seconds of time
  const WL_BASE = -0.52; // the ground line in panel coords
  const WL_SAG = 0.86; // exaggerated apex height

  const wlRibMat = holoMat(0xdfe7ff);
  const wlRib = ribbonMesh(72, wlRibMat, 0.016);
  wlGroup.add(wlRib.mesh);

  // the ball itself, riding its own worldline left to right through time
  const wlBall = new THREE.Mesh(
    new THREE.SphereGeometry(0.045, 18, 14),
    new THREE.MeshBasicMaterial({
      color: 0xffffff,
      toneMapped: false,
      transparent: true,
      opacity: 0,
    }),
  );
  wlGroup.add(wlBall);

  // two rival paths — every nearby path ages LESS than the real one
  const wlRivals = [];
  for (const k of [0.55, 1.5]) {
    const rp = [];
    for (let i = 0; i <= 48; i++) {
      const t = i / 48;
      rp.push(-WL_HW + 2 * WL_HW * t, WL_BASE + WL_SAG * k * 4 * t * (1 - t), 0);
    }
    const rgeo = new THREE.BufferGeometry();
    rgeo.setAttribute('position', new THREE.Float32BufferAttribute(rp, 3));
    const rmat = holoLine();
    const rline = new THREE.Line(rgeo, rmat);
    wlGroup.add(rline);
    wlRivals.push({ line: rline, mat: rmat });
  }

  const wlAxGeo = new THREE.BufferGeometry();
  wlAxGeo.setAttribute(
    'position',
    new THREE.Float32BufferAttribute(
      [-WL_HW, WL_BASE, 0, WL_HW, WL_BASE, 0, -WL_HW, WL_BASE, 0, -WL_HW, 0.68, 0],
      3,
    ),
  );
  const wlAxMat = holoLine();
  wlGroup.add(new THREE.LineSegments(wlAxGeo, wlAxMat));

  const wlDisp = displayPanel(0.86, 0.24, { px: 420 });
  wlDisp.mesh.position.set(0.68, -0.63, 0.01);
  wlGroup.add(wlDisp.mesh);

  // --- orbit ---------------------------------------------------------------
  const orbGroup = new THREE.Group();
  orbGroup.rotation.x = -0.42;
  projGroup.add(orbGroup);

  const orbPlanetMat = new THREE.MeshPhysicalMaterial({
    color: 0x4a5468,
    metalness: 0.1,
    roughness: 0.52,
    transparent: true,
    opacity: 0,
  });
  const orbPlanet = new THREE.Mesh(new THREE.SphereGeometry(0.32, 40, 28), orbPlanetMat);
  orbGroup.add(orbPlanet);

  // An unmarked dark sphere at this distance is indistinguishable from a flat
  // disc. Three great circles give it an axis and a near/far side.
  const orbGridMat = holoLine();
  for (let i = 0; i < 3; i++) {
    const gpts = [];
    for (let k = 0; k <= 72; k++) {
      const a = (k / 72) * TAU;
      gpts.push(Math.cos(a) * 0.322, Math.sin(a) * 0.322, 0);
    }
    const ggeo = new THREE.BufferGeometry();
    ggeo.setAttribute('position', new THREE.Float32BufferAttribute(gpts, 3));
    const gline = new THREE.Line(ggeo, orbGridMat);
    if (i === 0) gline.rotation.x = Math.PI / 2;
    else gline.rotation.y = (i - 1) * (Math.PI / 2);
    orbGroup.add(gline);
  }

  const orbHaloMat = holoMat();
  orbGroup.add(new THREE.Mesh(new THREE.SphereGeometry(0.35, 36, 24), orbHaloMat));

  const ORB_R = 0.86;
  const orbRibMat = holoMat(0xdfe7ff);
  const orbRib = ribbonMesh(96, orbRibMat, 0.014);
  orbGroup.add(orbRib.mesh);

  // a bright bead rather than a tiny steel capsule — at this distance a lit
  // metal part just disappears against the hologram
  const orbProbe = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false }),
  );
  orbProbe.visible = false;
  orbGroup.add(orbProbe);

  // ===========================================================================
  //  CALLOUTS
  // ===========================================================================
  const labels = calloutSets(['exterior', 'internal', 'field', 'clocks', 'world', 'orbit']);

  labels.add('exterior', group, 'Evacuated drop column', [0, COL_Y_LO + 1.15, 0.26], 34, 66);
  labels.add('exterior', clampGroup, 'Release clamp', [0, 0.04, 0.09], 64, 56);
  labels.add('exterior', cradle, 'Catch cradle', [0, 0.02, 0.17], -36, 62);
  const lblReadout = labels.add(
    'exterior',
    group,
    'Readout · 1.000 g',
    [-0.14, Y0 + 0.155, 0.44],
    -30,
    74,
  );

  labels.add('internal', pmMass, 'Proof mass', [0.07, 0.015, 0.05], 26, 62);
  labels.add('internal', pmPlates[0], 'Capacitive pickoff plates', [0.02, 0.02, 0.08], 58, 78);
  labels.add('internal', pmSprings[1].mesh, 'Suspension springs', [-0.04, 0, 0.06], -126, 70);
  labels.add('internal', pmFrame, 'Frame — pushed up by the bench', [0, 0.12, 0.12], 70, 100);

  labels.add('field', latLevels[7].level, 'Planes of equal clock time', [1.05, 0, 0.35], 30, 78);
  labels.add('field', latLevels[1].level, 'Packed tighter = time runs slower', [0.9, 0, 0.55], -42, 90);
  labels.add('field', group, 'Vertical spacing exaggerated ~1e17x', [0, LAT_Y_HI + 0.16, 0], 74, 56);
  labels.add('field', group, 'Earth · 5.97e24 kg, 6371 km down', [0, Y0 - 0.04, 0.46], -48, 78);

  labels.add('clocks', clockHeads[1].head, 'Upper clock · +33 cm', [-0.2, 0.08, 0.1], 42, 72);
  labels.add('clocks', clockHeads[0].head, 'Lower clock · reference', [-0.2, -0.08, 0.1], -36, 74);
  labels.add('clocks', beatGroup, 'Rate gap 3.6e-17, amplified', [0, 0.22, 0], 18, 96);

  // Panel-local +X maps exactly to camera-right (the projection yaws to face
  // the camera), so anything anchored at negative local x lands under the text
  // panel. Every label on this panel stays on the positive side.
  labels.add('world', wlGroup, 'Time across · height up', [0.45, 0.68, 0], 30, 58);
  labels.add('world', wlGroup, 'The path that ages most · +0.4 fs', [0.08, 0.44, 0], 58, 78);
  labels.add('world', wlRivals[1].line, 'Every other path ages less', [0.5, 0.12, 0], 34, 70);

  labels.add('orbit', orbProbe, 'Still reading 0.000 g', [0, 0.09, 0], 44, 66);
  labels.add('orbit', orbGroup, 'Same straight path, more sideways speed', [0, -1.0, 0], -40, 88);

  // ===========================================================================
  //  POSE — one state object, one apply()
  // ===========================================================================
  const state = {
    spin: 0, // turntable, radians
    drop: 0, // drop-cycle phase 0..1 (one whole cycle per lap)
    selftest: 0, // self-test dither phase, whole cycles per lap
    dither: 0, // self-test dither amplitude in g (0 = self-test off)
    reveal: 0, // 0 sealed, 1 accelerometer exposed
    lattice: 0, // time-rate lattice opacity
    sag: 0, // 0 flat spacetime, 1 fully compressed toward the mass
    clocks: 0, // clock-head displays + beat train
    beat: 0, // beat-train phase, whole cycles per lap
    worldline: 0, // worldline projection opacity
    wlPhase: 0, // the ball's run along its worldline, whole runs per lap
    scale: 0, // 0 exaggerated, 1 true proportions (the arc goes straight)
    orbit: 0, // 0 hidden, 1 closed orbit
    orbitPhase: 0, // whole turns per lap
    projYaw: 0, // projection faces the active camera
  };

  function apply() {
    group.rotation.y = state.spin;

    // --- the drop, the accelerometer, the readout --------------------------
    const cyc = dropCycle(state.drop);
    const capY = cyc.capY;
    const carY = cyc.carY;
    const jaw = cyc.jaw;

    // The electrostatic self-test: a test voltage nudges the proof mass so you
    // can see the pickoff is alive without moving the instrument. Real
    // capacitive accelerometers all have this. It is ADDITIVE on top of
    // whatever the capsule is really doing — never a mode that overrides the
    // drop, or a stale amplitude would silently freeze the whole rig.
    const accelG = cyc.accelG + state.dither * Math.sin(TAU * state.selftest);

    capsule.position.y = capY;
    // The carriage grips the capsule's TOP. Centred on carY it drew its ring
    // straight through the middle of the accelerometer in the macro step.
    carriage.position.y = carY + CAP_HALF + 0.03;

    const cableTop = COL_Y_HI - 0.02;
    const cableFoot = carY + CAP_HALF + 0.03;
    cable.position.y = cableFoot;
    cable.scale.y = Math.max(0.001, cableTop - cableFoot);

    for (const j of clampJaws) j.position.x = j.userData.side * (0.09 + 0.09 * jaw);

    // Deflection is the physics: the mass lags the case by mg/k, and reads
    // zero only when nothing is pushing the case at all.
    const defl = Math.max(-PM_DEFL_MAX, Math.min(PM_DEFL_MAX, -accelG * PM_DEFL_1G));
    pmMass.position.y = defl;
    for (const sp of pmSprings) {
      const anchor = sp.side * (PM_GAP - 0.01);
      sp.mesh.position.y = (anchor + defl) / 2;
      sp.mesh.scale.y = Math.max(0.2, Math.abs(anchor - defl) / 0.042);
    }
    gapGlow.position.y = defl - 0.5 * PM_GAP;
    gapGlow.material.opacity = state.reveal * (0.1 + 0.45 * clamp01(Math.abs(accelG) / 1.6));

    dispG.draw(['PROPER ACCEL', `${accelG.toFixed(3)} g`]);
    const lblEl = lblReadout.element?.querySelector('.callout-text');
    if (lblEl) lblEl.textContent = `Readout · ${accelG.toFixed(3)} g`;

    // --- reveal ------------------------------------------------------------
    const r = state.reveal;
    for (const m of shellSoft) {
      const mat = m.material;
      mat.transparent = r > 0.01;
      mat.opacity = 1 - 0.93 * r; // a white shell must reach ~0.07 (trap #3)
      mat.depthWrite = r < 0.5; // trap #7
      mat.clearcoat = r > 0.35 ? 0 : 1; // trap #2 — coat ignores opacity
    }
    for (const m of shellHide) m.visible = r < 0.5; // trap #3 — metal cannot ghost
    for (const m of internals) m.visible = r > 0.06;
    for (const m of columnGlass) m.material.opacity = 0.13 * (1 - 0.82 * r);

    // --- lattice -----------------------------------------------------------
    latGroup.visible = state.lattice > 0.002;
    if (latGroup.visible) {
      const span = LAT_Y_HI - LAT_Y_LO;
      const expo = 1 + 0.95 * state.sag;
      for (let i = 0; i < LAT_LEVELS; i++) {
        const u = i / (LAT_LEVELS - 1);
        const lv = latLevels[i];
        lv.level.position.y = LAT_Y_LO + span * Math.pow(u, expo);
        // the packed lower planes brighten as they crowd — that IS the signal
        const boost = 1 + 0.7 * (1 - lv.t) * state.sag;
        lv.sheetMat.opacity = state.lattice * 0.021 * boost;
        lv.rimMat.opacity = state.lattice * 0.27 * boost;
      }
    }

    // --- clocks ------------------------------------------------------------
    const ck = state.clocks;
    for (const c of clockHeads) {
      c.disp.mesh.visible = ck > 0.02;
      if (ck > 0.02) {
        c.disp.draw(c.tag === 'hi' ? ['UPPER +33cm', '+3.6e-17'] : ['LOWER  REF', '0.0e+00']);
      }
    }
    beatGroup.visible = ck > 0.02;
    if (beatGroup.visible) {
      for (const d of beatDots) {
        // 12 slots/lap against 13 slots/lap: the upper train gains exactly one
        // slot per lap, and each dot fades in and out along its run so the
        // wrap-around never pops.
        const raw = (d.i + state.beat * (d.row === 1 ? 13 : 12)) % 12;
        d.mesh.position.set(0, 0.42 - (raw / 12) * 0.84, d.row * 0.07 - 0.035);
        d.mesh.material.opacity = ck * 0.9 * Math.sin(Math.PI * (raw / 12));
      }
    }

    // --- worldline ---------------------------------------------------------
    projGroup.rotation.y = state.projYaw;
    const wv = state.worldline;
    wlGroup.visible = wv > 0.002;
    if (wlGroup.visible) {
      // At true proportions two seconds of time is 6e8 metres wide and the
      // ball rises five. The arc does not flatten because we cheated — it
      // flattens because that is what it actually looks like.
      const sag = WL_SAG * (1 - state.scale) ** 2;
      wlRib.update((t, p, n) => {
        const x = -WL_HW + 2 * WL_HW * t;
        const y = WL_BASE + sag * 4 * t * (1 - t);
        p.set(x, y, 0);
        const dydx = (sag * 4 * (1 - 2 * t)) / (2 * WL_HW);
        n.set(-dydx, 1, 0).normalize();
      });
      const bt = state.wlPhase % 1;
      wlBall.position.set(-WL_HW + 2 * WL_HW * bt, WL_BASE + sag * 4 * bt * (1 - bt), 0.02);
      wlBall.material.opacity = wv;
      wlRibMat.opacity = wv * 0.95;
      wlBack.material.opacity = wv * 0.5;
      wlFrameMat.opacity = wv * 0.3;
      wlAxMat.opacity = wv * 0.35;
      for (const rv of wlRivals) rv.mat.opacity = wv * 0.32 * (1 - state.scale);
      wlDisp.draw(
        state.scale > 0.55
          ? ['RADIUS OF CURVATURE', '0.97 light-years']
          : ['EXTRA AGEING', '+0.4 fs'],
      );
    }

    // --- orbit -------------------------------------------------------------
    const ov = state.orbit;
    orbGroup.visible = ov > 0.002;
    if (orbGroup.visible) {
      const sweep = 0.16 + 0.84 * ov; // an arc that closes into a full ring
      orbRib.update((t, p, n) => {
        const a = -Math.PI / 2 + (t - 0.5) * TAU * sweep;
        p.set(Math.cos(a) * ORB_R, Math.sin(a) * ORB_R, 0);
        n.set(Math.cos(a), Math.sin(a), 0);
      });
      orbRibMat.opacity = ov * 0.95;
      orbPlanetMat.opacity = ov;
      // a solid sphere must write depth or it renders flat and the ring in
      // front of it punches straight through
      orbPlanetMat.depthWrite = ov > 0.5;
      orbHaloMat.opacity = ov * 0.12;
      orbGridMat.opacity = ov * 0.3;
      orbProbe.visible = ov > 0.35;
      const pa = -Math.PI / 2 + (state.orbitPhase % 1) * TAU;
      orbProbe.position.set(Math.cos(pa) * ORB_R, Math.sin(pa) * ORB_R, 0);
    }
  }

  apply();

  return {
    group,
    state,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
    parts: {
      capsule,
      proofMass: pmMass,
      carriage,
      clampJaw: clampJaws[0],
      lattice: latGroup,
      worldline: wlRib.mesh,
      orbitProbe: orbProbe,
      projection: projGroup,
    },
  };
}
