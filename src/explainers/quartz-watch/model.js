import * as THREE from 'three';
import { materials, box, studioPlinth, chargeQueue } from '../../framework/parts.js';
import { beveledBox, coil as coilWind, gear, tubeAlong } from '../../framework/geometry.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';
import { smudgeMap } from '../../framework/textures.js';

// A quartz analog wristwatch, product-shot staged: a 40 mm steel case standing
// on its own curled leather strap, on a charcoal puck. The counterpart to the
// mechanical-watch explainer — same object class, opposite mechanism — and the
// whole story lives on the CASEBACK side (battery, crystal, chip, coil), so
// the two explainers never show the same shot.
//
// Reference facts (Wikipedia "Quartz clock" / "Lavet-type stepping motor";
// explainthatstuff's quartz clock teardown):
//  - The resonator is a TUNING FORK cut from a single crystal of quartz on a
//    particular crystal plane, a few mm long, sealed in a vacuum can ~2 x 6 mm.
//    Quartz is piezoelectric BOTH ways: voltage bends it, bending makes
//    voltage. The IC is an amplifier with the fork as its feedback filter, so
//    the loop self-sustains at the fork's own mechanical resonance.
//  - 32,768 Hz = 2^15: above human hearing, low enough for cheap low-power
//    counters, and a power of two so it halves cleanly down to 1 Hz.
//  - The divider is a chain of FIFTEEN flip-flops, each dividing by two.
//  - The motor is a LAVET-type stepper: a coil on a C-shaped steel stator
//    whose rotor bore carries two NOTCHES. That asymmetry sets the rotor's
//    rest positions and forces one direction of rotation. A two-pole permanent
//    magnet rotor ~1.4 mm across steps 180 degrees per pulse; pulses alternate
//    in polarity, so two pulses = one revolution = two seconds. The coil is
//    energised only a few milliseconds and inertia carries the rotor home.
//  - Gear train: rotor pinion -> fifth wheel -> seconds wheel = 30:1, turning
//    180 degrees a second into 6 degrees a second on the seconds hand.
//  - Accuracy ~6 ppm ~= 15 s/month; parabolic temperature coefficient
//    -0.035 ppm/degC^2, so worn near the body it sits near its turnover point.
//
// ---------------------------------------------------------------------------
// ONE SCALE: 1 mm = MM world units. Every constant below is derived from it,
// so the ratios hold by construction. Target ratios read off a real 40 mm
// three-hand quartz watch: case 40 mm dia x ~11 thick; movement 26 mm dia;
// SR626 cell 6.8 mm dia (26% of the movement); crystal can 2 x 6 mm; coil
// core 8 mm; rotor magnet 1.4 mm.
// ---------------------------------------------------------------------------
const MM = 0.0325;

const CY = 1.05; // watch centre height (the case rests on the strap curl)
const PUCK_TOP = 0.35;

const CASE_R = 20 * MM; // 0.650 — 40 mm case
const CASE_Z0 = -0.2;
const CASE_Z1 = 0.175; // 11.5 mm thick
const DIAL_R = 16 * MM; // 0.520
const GLASS_R = 16.8 * MM; // 0.546

const MOV_R = 13 * MM; // 0.4225 — 26 mm movement
const PLATE_T = 0.06;
const LIFT_Y = 1.3; // how far the movement rises out of the case
const LIFT_Z = 0.1;

// ONE lap = TICKS ticks (one watch-minute). Everything closes on a whole number:
// seconds hand 1 rev, rotor 30 revs, fifth wheel 5 revs, seconds wheel 1 rev,
// fork 60 flexes, coil polarity back to its starting sign (60 is even).

// Per-tick rotor swing: the real step takes a few milliseconds out of a whole
// second, so it must read as a SNAP with a tiny settle, not a sweep.
const STEP_U = 0.26;
const SETTLE_U = 0.4;
function stepPhase(f) {
  if (f >= SETTLE_U) return 1;
  if (f <= STEP_U) return smooth(clamp01(f / STEP_U));
  const g = (f - STEP_U) / (SETTLE_U - STEP_U);
  return 1 + 0.015 * Math.sin(g * TAU) * (1 - g); // one damped overshoot
}
// The coil is live only at the very head of each tick.
const PULSE_U = 0.14;

// --- movement layout, movement-local XY (caseback side is local -Z) ---------
// Gear-train modules chosen so meshing pairs share a module exactly:
//   stage 1  rotor pinion 10T (m 0.0045) -> fifth wheel 60T   = 6:1
//   stage 2  fifth pinion  12T (m 0.0040) -> seconds wheel 60T = 5:1
// Centre distances are the sums of the pitch radii, so the teeth interlock.
const M1 = 0.0045;
const M2 = 0.004;
const P_ROTOR = 5 * M1; // 0.0225
const P_FIFTH = 30 * M1; // 0.1350
const P_FIFTH_PIN = 6 * M2; // 0.0240
const P_SECONDS = 30 * M2; // 0.1200
const A1 = P_ROTOR + P_FIFTH; // 0.1575
const A2 = P_FIFTH_PIN + P_SECONDS; // 0.1440

const ROTOR = { x: 0.075, y: -0.292 }; // |ROTOR| = A1 + A2 = 0.3015
const RLEN = Math.hypot(ROTOR.x, ROTOR.y);
const FIFTH = { x: ROTOR.x * (1 - A1 / RLEN), y: ROTOR.y * (1 - A1 / RLEN) };

const EL = {
  batt: { x: 0.17, y: -0.14, r: 3.4 * MM }, // 0.1105 — 6.8 mm cell
  ic: { x: -0.03, y: 0.185 },
  xtal: { x: -0.23, y: 0.115 },
  coilX0: -0.325,
  coilX1: -0.085,
  coilY: -0.15,
};

// z-stack (movement-local). Dial side is +Z, caseback side -Z.
const Z = {
  plate: -0.03,
  wheels: 0.018,
  bridge: 0.042,
  motion: 0.058,
  dial: 0.082,
  hourH: 0.098,
  minH: 0.108,
  secH: 0.118,
  pcb: -0.075,
  stator: -0.072,
  ic: -0.092,
  coil: -0.1,
  xtal: -0.108,
  batt: -0.112,
};

// A leather strap: overlapping beveled slabs along a curve, so it reads as one
// continuous band rather than a link bracelet.
function strapRun(pts, width, thick, mat, stitchMat, group, segs) {
  const curve = new THREE.CatmullRomCurve3(pts.map((p) => new THREE.Vector3(...p)));
  const segLen = curve.getLength() / segs;
  const axis = new THREE.Vector3(0, 0, 1);
  for (let i = 0; i < segs; i++) {
    const u = (i + 0.5) / segs;
    const slab = beveledBox(width, thick, segLen * 1.4, mat, thick * 0.4);
    slab.position.copy(curve.getPointAt(u));
    slab.quaternion.setFromUnitVectors(axis, curve.getTangentAt(u).normalize());
    slab.castShadow = i % 2 === 0;
    slab.receiveShadow = true;
    group.add(slab);
    if (i % 3 === 0) {
      for (const sx of [-1, 1]) {
        const stitch = box(width * 0.05, thick * 0.3, segLen * 0.6, stitchMat);
        stitch.position.set(sx * width * 0.37, thick * 0.42, 0);
        slab.add(stitch);
      }
    }
  }
}

export function buildQuartzWatch({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials ------------------------------------------------------------
  // Map-free metal. The brushedSteel/aluminum presets carry a brushed
  // roughness AND normal map; at the 0.9-2.0 unit camera distances this
  // explainer films at, one texel covers a whole part and every steel piece
  // reads as scratched hair (battery, crystal can and case band all failed
  // that way on the first render). Plain physical metal is correct at this
  // scale.
  const metal = (color, roughness) =>
    new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness });
  const caseSteel = metal(0xc9ced6, 0.34);
  const bezelSteel = metal(0xd2d7de, 0.4);
  const darkMat = materials.rubber(0x14161a); // dark interiors — never a mirror
  const linerMat = darkMat.clone();
  linerMat.side = THREE.BackSide;
  const dialMat = materials.paintedMetal(0x121a24);
  const indexMat = metal(0xdfe4ea, 0.3);
  const handMat = metal(0xe3e8ee, 0.26);
  const accentMat = materials.paintedMetal(0x7ad7f0);
  const lumeMat = materials.plastic(0xe9f2e2);

  // Real quartz movements are built on a white/ivory plastic mainplate — the
  // single best thing about filming one, because every tiny brass and steel
  // part reads against it.
  const plateMat = materials.polymer(0xc9c0ac);
  plateMat.roughness = 0.94;
  plateMat.clearcoat = 0; // white albedo + coat specular is what blew the macro steps
  const spacerMat = materials.polymer(0x24272c);
  spacerMat.side = THREE.BackSide;
  const pcbMat = materials.polymer(0x14312a);
  pcbMat.roughness = 0.6;
  const goldMat = new THREE.MeshPhysicalMaterial({
    color: 0xcda54a,
    metalness: 1,
    roughness: 0.32,
  });
  const epoxyMat = materials.polymer(0x0e1013);
  const cellMat = metal(0xccd2d9, 0.5);
  const cellFace = metal(0xb9bfc7, 0.42);
  const cellRim = metal(0x9aa1aa, 0.46);
  const canMat = metal(0xc2c9d2, 0.28);
  const insertCanMat = canMat.clone();
  insertCanMat.side = THREE.DoubleSide;
  const copperMat = new THREE.MeshPhysicalMaterial({
    color: 0x99552a,
    metalness: 1,
    roughness: 0.62,
  });
  const yokeMat = metal(0xaeb6c0, 0.56);
  // Extruded gear teeth have ad-hoc UVs — map-free materials only here.
  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xc9a24a,
    metalness: 1,
    roughness: 0.38,
  });
  const pinionMat = new THREE.MeshPhysicalMaterial({
    color: 0xb2b8c0,
    metalness: 1,
    roughness: 0.55, // tiny and highly curved: near-chrome would bloom
  });
  const quartzMat = new THREE.MeshPhysicalMaterial({
    color: 0xdfe7ee,
    metalness: 0,
    roughness: 0.22,
    clearcoat: 0.5,
    clearcoatRoughness: 0.2,
  });
  const leatherMat = materials.rubber(0x3b2b21);
  const stitchMat = materials.rubber(0xa8916d);
  const railMat = materials.polymer(0x1d2329);

  // ==========================================================================
  // MOVEMENT — one group, lifted out of the case and turned over by
  // `reveal` / `flip`. Everything that keeps time lives in here.
  // ==========================================================================
  const movement = new THREE.Group();
  movement.position.set(0, CY, 0);
  group.add(movement);

  const plate = new THREE.Mesh(
    new THREE.CylinderGeometry(MOV_R, MOV_R, PLATE_T, 72).rotateX(Math.PI / 2),
    plateMat,
  );
  plate.position.z = Z.plate;
  plate.castShadow = true;
  plate.receiveShadow = true;
  movement.add(plate);

  // ---------- caseback side: board, battery, chip, crystal, motor -----------
  const pcb = beveledBox(0.44, 0.4, 0.014, pcbMat, 0.01);
  pcb.position.set(-0.15, 0.15, Z.pcb);
  movement.add(pcb);
  for (let i = 0; i < 8; i++) {
    const pad = box(0.05, 0.014, 0.004, goldMat);
    pad.position.set(-0.33 + (i % 4) * 0.062, 0.02 + Math.floor(i / 4) * 0.05, Z.pcb - 0.009);
    movement.add(pad);
  }
  // the rate trimmer, turned a sixth of a turn per second-a-day of correction
  const trimmer = new THREE.Mesh(
    new THREE.CylinderGeometry(0.028, 0.028, 0.016, 16).rotateX(Math.PI / 2),
    goldMat,
  );
  trimmer.position.set(-0.32, 0.25, Z.pcb - 0.012);
  movement.add(trimmer);

  // battery: silver-oxide button cell under a steel clamp
  const cell = new THREE.Mesh(
    new THREE.CylinderGeometry(EL.batt.r, EL.batt.r, 0.085, 40).rotateX(Math.PI / 2),
    cellMat,
  );
  cell.position.set(EL.batt.x, EL.batt.y, Z.batt);
  cell.castShadow = true;
  movement.add(cell);
  const cellTop = new THREE.Mesh(
    new THREE.CylinderGeometry(EL.batt.r * 0.72, EL.batt.r * 0.72, 0.002, 40).rotateX(
      Math.PI / 2,
    ),
    cellFace,
  );
  cellTop.position.set(EL.batt.x, EL.batt.y, Z.batt - 0.043);
  movement.add(cellTop);
  const cellSkirt = new THREE.Mesh(
    new THREE.CylinderGeometry(EL.batt.r * 1.03, EL.batt.r * 1.03, 0.026, 40).rotateX(
      Math.PI / 2,
    ),
    cellRim,
  );
  cellSkirt.position.set(EL.batt.x, EL.batt.y, Z.batt - 0.028);
  movement.add(cellSkirt);
  const clampBar = beveledBox(0.26, 0.036, 0.012, yokeMat, 0.005);
  clampBar.position.set(EL.batt.x - 0.02, EL.batt.y + 0.02, Z.batt - 0.048);
  clampBar.rotation.z = 0.62;
  movement.add(clampBar);
  const clampFoot = box(0.045, 0.03, 0.03, yokeMat);
  clampFoot.position.set(EL.batt.x - 0.14, EL.batt.y + 0.115, Z.batt - 0.035);
  movement.add(clampFoot);

  // the chip: a blob of black epoxy, exactly as it appears in a real movement
  const ic = beveledBox(0.13, 0.13, 0.026, epoxyMat, 0.012);
  ic.position.set(EL.ic.x, EL.ic.y, Z.ic);
  movement.add(ic);

  // Quartz crystal can — 2 x 6 mm, axis along local Y. METAL: hidden outright
  // on the crystal step (metal cannot be ghosted), never faded.
  const xtalCan = new THREE.Group();
  xtalCan.position.set(EL.xtal.x, EL.xtal.y, Z.xtal);
  const canBody = new THREE.Mesh(new THREE.CylinderGeometry(1 * MM, 1 * MM, 5.4 * MM, 24), canMat);
  const canDome = new THREE.Mesh(new THREE.SphereGeometry(1 * MM, 20, 12), canMat);
  canDome.position.y = 2.7 * MM;
  const canBase = new THREE.Mesh(
    new THREE.CylinderGeometry(1.05 * MM, 1.05 * MM, 0.6 * MM, 24),
    epoxyMat,
  );
  canBase.position.y = -2.9 * MM;
  xtalCan.add(canBody, canDome, canBase);
  for (const sx of [-1, 1]) {
    const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.14 * MM, 0.14 * MM, 1.4 * MM, 8), goldMat);
    pin.position.set(sx * 0.4 * MM, -3.6 * MM, 0);
    xtalCan.add(pin);
  }
  movement.add(xtalCan);

  // ---------- the Lavet stepping motor -------------------------------------
  const motor = new THREE.Group();
  movement.add(motor);

  const coilLen = EL.coilX1 - EL.coilX0;
  const coilMid = (EL.coilX0 + EL.coilX1) / 2;
  const coilCore = box(coilLen + 0.06, 0.026, 0.026, yokeMat);
  coilCore.position.set(coilMid, EL.coilY, Z.coil);
  motor.add(coilCore);
  // ~30 visible turns standing in for the real ten thousand of 20-micron wire
  const winding = coilWind(
    {
      turns: 24,
      radius: 0.042,
      length: coilLen * 0.84,
      wireRadius: 0.0038,
      segmentsPerTurn: 10,
    },
    copperMat,
  ).mesh;
  winding.rotation.z = Math.PI / 2;
  winding.position.set(coilMid, EL.coilY, Z.coil);
  motor.add(winding);
  for (const sx of [-1, 1]) {
    const cheek = new THREE.Mesh(
      new THREE.CylinderGeometry(0.05, 0.05, 0.012, 28).rotateZ(Math.PI / 2),
      epoxyMat,
    );
    cheek.position.set(coilMid + sx * coilLen * 0.45, EL.coilY, Z.coil);
    motor.add(cheek);
  }

  // Stator yoke: flat steel, the coil core at one end, a bored seat for the
  // rotor at the other, with two notches that decide which way it swings.
  function yokeBar(ax, ay, bx, by, w) {
    const len = Math.hypot(bx - ax, by - ay);
    const bar = beveledBox(len, w, 0.014, yokeMat, 0.005);
    bar.position.set((ax + bx) / 2, (ay + by) / 2, Z.stator);
    bar.rotation.z = Math.atan2(by - ay, bx - ax);
    return bar;
  }
  motor.add(yokeBar(EL.coilX1, EL.coilY, ROTOR.x, ROTOR.y, 0.062));
  motor.add(yokeBar(EL.coilX0, EL.coilY, -0.31, -0.36, 0.062));
  motor.add(yokeBar(-0.31, -0.36, ROTOR.x, ROTOR.y, 0.062));

  // the bored seat: an annulus, with two notches bitten out of the bore
  const seatShape = new THREE.Shape();
  seatShape.absarc(0, 0, 0.076, 0, TAU, false);
  const seatBore = new THREE.Path();
  seatBore.absarc(0, 0, 0.043, 0, TAU, true); // magnet 0.036 + a real air gap
  seatShape.holes.push(seatBore);
  const seat = new THREE.Mesh(
    new THREE.ExtrudeGeometry(seatShape, {
      depth: 0.014,
      bevelEnabled: true,
      bevelThickness: 0.003,
      bevelSize: 0.002,
      bevelSegments: 1,
      curveSegments: 24,
    }),
    yokeMat,
  );
  seat.position.set(ROTOR.x, ROTOR.y, Z.stator - 0.007);
  motor.add(seat);
  const notches = [];
  for (const na of [0.72, 0.72 + Math.PI]) {
    const notch = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 10), darkMat);
    notch.position.set(ROTOR.x + Math.cos(na) * 0.046, ROTOR.y + Math.sin(na) * 0.046, Z.stator);
    motor.add(notch);
    notches.push(notch);
  }

  // Rotor: a two-pole permanent magnet 1.4 mm across, on a staff carrying its
  // pinion through the plate to the dial side.
  const rotor = new THREE.Group();
  rotor.position.set(ROTOR.x, ROTOR.y, 0);
  motor.add(rotor);
  const magR = 0.036; // drawn a touch generous so 1.4 mm reads at all
  for (const [poleStart, poleColor] of [
    [0, 0xb4453c],
    [Math.PI, 0x4d5f7d],
  ]) {
    // a hair of angular clearance: coincident cut faces on the two halves
    // z-fought into stripes right across the magnet
    const half = new THREE.Mesh(
      new THREE.CylinderGeometry(
        magR,
        magR,
        0.05,
        24,
        1,
        false,
        poleStart + 0.02,
        Math.PI - 0.04,
      ).rotateX(Math.PI / 2),
      materials.paintedMetal(poleColor),
    );
    half.position.z = Z.stator - 0.004;
    rotor.add(half);
  }
  const rotorStaff = new THREE.Mesh(
    new THREE.CylinderGeometry(0.008, 0.008, 0.2, 10).rotateX(Math.PI / 2),
    pinionMat,
  );
  rotorStaff.position.z = -0.01;
  rotor.add(rotorStaff);
  const rotorPinion = gear(
    { teeth: 10, radius: P_ROTOR * 1.03, thickness: 0.022, holeR: 0.007 },
    pinionMat,
  );
  rotorPinion.position.z = Z.wheels;
  rotor.add(rotorPinion);

  // Field arcs: the coil is live only a few milliseconds per second, so these
  // flash on at the pulse and vanish. That absence IS the battery-life point.
  const fieldArcs = [];
  for (const fa of [0.72 + Math.PI / 2, 0.72 - Math.PI / 2]) {
    const arcMat = materials.glow(0x7ad7f0, 0.85);
    arcMat.transparent = true;
    arcMat.opacity = 0;
    arcMat.depthWrite = false;
    const arc = new THREE.Mesh(new THREE.TorusGeometry(0.092, 0.008, 8, 28, 1.5), arcMat);
    arc.position.set(ROTOR.x, ROTOR.y, Z.stator - 0.012);
    arc.rotation.z = fa - 0.75;
    motor.add(arc);
    fieldArcs.push(arc);
  }

  // coil leads back to the board
  motor.add(
    tubeAlong(
      [
        [EL.coilX0 - 0.02, EL.coilY + 0.05, Z.coil],
        [EL.coilX0 - 0.05, EL.coilY + 0.16, Z.pcb - 0.01],
        [-0.3, 0.02, Z.pcb - 0.01],
      ],
      0.005,
      goldMat,
    ),
  );

  // the current path: cell -> chip -> crystal -> coil -> rotor
  const flowCurve = new THREE.CatmullRomCurve3(
    [
      [EL.batt.x, EL.batt.y + EL.batt.r * 0.8, Z.batt - 0.03],
      [0.02, 0.09, Z.pcb - 0.02],
      [EL.ic.x, EL.ic.y - 0.02, Z.ic - 0.02],
      [EL.xtal.x + 0.03, EL.xtal.y - 0.02, Z.pcb - 0.022],
      [-0.3, 0.0, Z.pcb - 0.022],
      [EL.coilX0 - 0.03, EL.coilY + 0.06, Z.coil - 0.03],
      [coilMid, EL.coilY - 0.055, Z.coil - 0.035],
      [ROTOR.x - 0.05, ROTOR.y - 0.045, Z.stator - 0.03],
    ].map((p) => new THREE.Vector3(...p)),
  );
  const flow = chargeQueue(flowCurve, 7, 0x7ad7f0, { size: 0.011, spacing: 0.075 });
  movement.add(flow.group);

  // ---------- dial side: the gear train ------------------------------------
  function trainWheel(pos, teeth, pitch, pinionTeeth, pinionPitch) {
    const g = new THREE.Group();
    g.position.set(pos.x, pos.y, 0);
    const wheel = gear(
      { teeth, radius: pitch * 1.03, thickness: 0.012, holeR: pitch * 0.1, cutouts: 5 },
      brassMat,
    );
    wheel.position.z = Z.wheels;
    g.add(wheel);
    if (pinionTeeth) {
      const pin = gear(
        { teeth: pinionTeeth, radius: pinionPitch * 1.03, thickness: 0.022, holeR: 0.008 },
        pinionMat,
      );
      pin.position.z = Z.wheels + 0.018;
      g.add(pin);
    }
    const arbor = new THREE.Mesh(
      new THREE.CylinderGeometry(0.008, 0.008, 0.14, 10).rotateX(Math.PI / 2),
      pinionMat,
    );
    arbor.position.z = Z.wheels;
    g.add(arbor);
    movement.add(g);
    return g;
  }
  const fifth = trainWheel(FIFTH, 60, P_FIFTH, 12, P_FIFTH_PIN);
  const secondsWheel = trainWheel({ x: 0, y: 0 }, 60, P_SECONDS, 0, 0);

  // Motion works: the coaxial stack under the dial that gears the seconds down
  // to the minute and hour hands. Held static — at 60:1 and 720:1 they move 6
  // and 0.5 degrees per lap, invisible, and pinning them keeps the loop
  // seamless.
  const cannon = new THREE.Mesh(
    new THREE.CylinderGeometry(0.03, 0.03, 0.05, 20).rotateX(Math.PI / 2),
    pinionMat,
  );
  cannon.position.z = Z.motion;
  movement.add(cannon);
  const hourWheel = gear(
    { teeth: 48, radius: 0.082, thickness: 0.01, holeR: 0.032, cutouts: 4 },
    brassMat,
  );
  hourWheel.position.z = Z.motion + 0.012;
  movement.add(hourWheel);
  const minuteWheel = gear(
    { teeth: 42, radius: 0.072, thickness: 0.01, holeR: 0.012, cutouts: 3 },
    brassMat,
  );
  minuteWheel.position.set(-0.152, 0.048, Z.motion + 0.012);
  movement.add(minuteWheel);

  // ---------- dial + hands (ride the movement; hidden while it is open) -----
  const dress = new THREE.Group();
  movement.add(dress);
  const dial = new THREE.Mesh(
    new THREE.CylinderGeometry(DIAL_R, DIAL_R, 0.01, 72).rotateX(Math.PI / 2),
    dialMat,
  );
  dial.position.z = Z.dial;
  dress.add(dial);
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12;
    const long = i % 3 === 0;
    const index = beveledBox(long ? 0.05 : 0.032, long ? 0.115 : 0.078, 0.014, indexMat, 0.005);
    const rr = DIAL_R - (long ? 0.082 : 0.068);
    index.position.set(Math.sin(a) * rr, Math.cos(a) * rr, Z.dial + 0.008);
    index.rotation.z = -a;
    dress.add(index);
    const lume = box(long ? 0.034 : 0.021, long ? 0.075 : 0.05, 0.005, lumeMat);
    lume.position.set(Math.sin(a) * rr, Math.cos(a) * rr, Z.dial + 0.017);
    lume.rotation.z = -a;
    dress.add(lume);
  }
  for (let i = 0; i < 60; i++) {
    if (i % 5 === 0) continue;
    const a = (i * TAU) / 60;
    const minTick = box(0.007, 0.022, 0.004, indexMat);
    minTick.position.set(
      Math.sin(a) * (DIAL_R - 0.022),
      Math.cos(a) * (DIAL_R - 0.022),
      Z.dial + 0.008,
    );
    minTick.rotation.z = -a;
    dress.add(minTick);
  }
  function watchHand(w, len, tail, mat, z) {
    const h = beveledBox(w, len + tail, 0.008, mat, 0.004);
    h.geometry.translate(0, (len - tail) / 2, 0);
    h.position.z = z;
    dress.add(h);
    return h;
  }
  const hourHand = watchHand(0.056, 0.3, 0.055, handMat, Z.hourH);
  hourHand.rotation.z = -((10 + 9 / 60) / 12) * TAU;
  const minuteHand = watchHand(0.04, 0.44, 0.06, handMat, Z.minH);
  minuteHand.rotation.z = -(9 / 60) * TAU;
  for (const [hand, w, len] of [
    [hourHand, 0.03, 0.2],
    [minuteHand, 0.02, 0.32],
  ]) {
    const inlay = box(w, len, 0.005, lumeMat);
    inlay.position.set(0, len * 0.5 + 0.03, 0.005);
    hand.add(inlay);
  }
  const secondsHand = watchHand(0.012, 0.485, 0.115, accentMat, Z.secH);
  // the cap has to clear the glass inner face at CASE_Z1 - 0.039 = 0.136
  const handCap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.026, 0.026, 0.02, 20).rotateX(Math.PI / 2),
    accentMat,
  );
  handCap.position.z = Z.secH + 0.006;
  dress.add(handCap);

  // ==========================================================================
  // CASE — band, spacer, bezel, glass, caseback, lugs, crown (the frame)
  // ==========================================================================
  const watchCase = new THREE.Group();
  watchCase.position.set(0, CY, 0);
  group.add(watchCase);

  const bandProfile = [
    [CASE_R * 0.93, CASE_Z0],
    [CASE_R * 0.99, CASE_Z0 + 0.03],
    [CASE_R, CASE_Z0 + 0.16],
    [CASE_R * 0.985, CASE_Z1 - 0.09],
    [GLASS_R + 0.014, CASE_Z1 - 0.008],
    [GLASS_R, CASE_Z1 - 0.008],
    [GLASS_R, CASE_Z1 - 0.05],
    [MOV_R + 0.02, CASE_Z1 - 0.065],
    [MOV_R + 0.02, CASE_Z0 + 0.02],
    [CASE_R * 0.93, CASE_Z0],
  ].map(([r, z]) => new THREE.Vector2(r, z));
  const bandGeo = new THREE.LatheGeometry(bandProfile, 96);
  bandGeo.rotateX(Math.PI / 2);
  const band = new THREE.Mesh(bandGeo, caseSteel);
  band.castShadow = true;
  band.receiveShadow = true;
  watchCase.add(band);

  const bezel = new THREE.Mesh(new THREE.TorusGeometry(GLASS_R + 0.03, 0.026, 14, 96), bezelSteel);
  bezel.position.z = CASE_Z1 - 0.02;
  watchCase.add(bezel);

  // Dark spacer ring: fills the gap between the 26 mm movement and the 40 mm
  // case, and keeps the concave case interior from acting as a curved mirror
  // once the movement is lifted out.
  const spacer = new THREE.Mesh(
    new THREE.CylinderGeometry(MOV_R + 0.019, MOV_R + 0.019, 0.33, 64, 1, true).rotateX(
      Math.PI / 2,
    ),
    spacerMat,
  );
  spacer.position.z = -0.02;
  watchCase.add(spacer);
  const caseFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(MOV_R + 0.018, MOV_R + 0.018, 0.012, 48).rotateX(Math.PI / 2),
    darkMat,
  );
  caseFloor.position.z = -0.178;
  watchCase.add(caseFloor);

  // Flat mineral glass — real refractive, with the faint smudge haze any worn
  // watch has. Nothing transparent sits behind it (the dial is opaque).
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xe4edff,
    metalness: 0,
    roughness: 0.04,
    transmission: 1,
    thickness: 0.05,
    ior: 1.52,
    transparent: false,
    iridescence: 0.05,
    iridescenceIOR: 1.3,
    iridescenceThicknessRange: [120, 420],
    clearcoat: 0.22,
    clearcoatRoughness: 0.3,
    clearcoatRoughnessMap: smudgeMap(),
  });
  const glass = new THREE.Mesh(
    new THREE.CylinderGeometry(GLASS_R, GLASS_R, 0.026, 72).rotateX(Math.PI / 2),
    glassMat,
  );
  glass.position.z = CASE_Z1 - 0.026;
  watchCase.add(glass);

  const caseback = new THREE.Group();
  const backPlate = new THREE.Mesh(
    new THREE.CylinderGeometry(CASE_R * 0.94, CASE_R * 0.9, 0.036, 64).rotateX(Math.PI / 2),
    caseSteel,
  );
  caseback.add(backPlate);
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6 + 0.4;
    const screw = new THREE.Mesh(
      new THREE.CylinderGeometry(0.026, 0.026, 0.016, 12).rotateX(Math.PI / 2),
      bezelSteel,
    );
    screw.position.set(Math.cos(a) * CASE_R * 0.78, Math.sin(a) * CASE_R * 0.78, -0.016);
    caseback.add(screw);
  }
  caseback.position.z = CASE_Z0;
  watchCase.add(caseback);

  for (const sy of [1, -1]) {
    const lug = beveledBox(0.28, 0.15, 0.12, caseSteel, 0.03);
    lug.position.set(0, sy * CASE_R * 0.99, -0.06);
    lug.rotation.x = sy * 0.12;
    watchCase.add(lug);
    const barPin = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.012, 0.3, 10).rotateZ(Math.PI / 2),
      bezelSteel,
    );
    barPin.position.set(0, sy * CASE_R * 1.03, -0.09);
    watchCase.add(barPin);
  }

  // crown at 3 o'clock — on a quartz watch it only sets the hands
  const crownStem = new THREE.Mesh(
    new THREE.CylinderGeometry(0.022, 0.022, 0.09, 12).rotateZ(Math.PI / 2),
    bezelSteel,
  );
  crownStem.position.set(CASE_R + 0.03, 0, -0.02);
  watchCase.add(crownStem);
  const crown = new THREE.Mesh(
    new THREE.CylinderGeometry(0.07, 0.07, 0.075, 24).rotateZ(Math.PI / 2),
    bezelSteel,
  );
  crown.position.set(CASE_R + 0.11, 0, -0.02);
  watchCase.add(crown);
  for (let i = 0; i < 10; i++) {
    const a = (i * TAU) / 10;
    const ridge = box(0.078, 0.012, 0.012, caseSteel);
    ridge.position.set(CASE_R + 0.11, Math.cos(a) * 0.071, -0.02 + Math.sin(a) * 0.071);
    ridge.rotation.x = -a;
    watchCase.add(ridge);
  }

  // ==========================================================================
  // STRAP + PUCK — the watch stands on its own curled strap. No wrist, no arm.
  // ==========================================================================
  const puck = new THREE.Mesh(
    new THREE.CylinderGeometry(1.06, 1.1, 0.09, 64),
    materials.polymer(0x1a1d22),
  );
  puck.position.set(0, PUCK_TOP - 0.045, -0.2);
  puck.receiveShadow = true;
  puck.castShadow = true;
  group.add(puck);

  const strapGroup = new THREE.Group();
  group.add(strapGroup);
  strapRun(
    [
      [0, CY - CASE_R * 1.02, -0.08],
      [0, CY - CASE_R - 0.045, 0.04],
      [0, PUCK_TOP + 0.045, 0.24],
      [0, PUCK_TOP + 0.032, 0.52],
      [0, PUCK_TOP + 0.085, 0.76],
    ],
    0.3,
    0.05,
    leatherMat,
    stitchMat,
    strapGroup,
    12,
  );
  strapRun(
    [
      [0, CY + CASE_R * 1.02, -0.1],
      [0, CY + CASE_R + 0.14, -0.38],
      [0, CY + 0.3, -0.74],
      [0, CY - 0.36, -0.88],
      [0, PUCK_TOP + 0.07, -0.74],
      [0, PUCK_TOP + 0.04, -0.54],
    ],
    0.3,
    0.05,
    leatherMat,
    stitchMat,
    strapGroup,
    16,
  );

  group.add(studioPlinth({ w: 3.8, d: 2.6 }));

  // ==========================================================================
  // MACRO INSERT A — the tuning fork, about five times life size.
  // The fork inside a 2 mm can is below any honest camera's reach, so it gets
  // a deliberately oversized stand-in with a callout back to the real can.
  // ==========================================================================
  const forkInsert = new THREE.Group();
  forkInsert.position.set(0.66, 2.58, 0.36);
  forkInsert.rotation.set(-0.06, -0.38, 0);
  group.add(forkInsert);

  const FORK_L = 0.62;
  const TINE_W = 0.082;
  const TINE_T = 0.036;
  const forkBase = beveledBox(0.266, 0.15, TINE_T * 1.15, quartzMat, 0.014);
  forkBase.position.y = -FORK_L * 0.5;
  forkInsert.add(forkBase);

  function buildTine(sign) {
    const root = new THREE.Group();
    root.position.set(sign * 0.092, -FORK_L * 0.44, 0);
    const half = FORK_L * 0.45;
    const lower = beveledBox(TINE_W, half, TINE_T, quartzMat, 0.01);
    lower.geometry.translate(0, half / 2, 0);
    const upperPivot = new THREE.Group();
    upperPivot.position.y = half;
    const upper = beveledBox(TINE_W, half, TINE_T, quartzMat, 0.01);
    upper.geometry.translate(0, half / 2, 0);
    upperPivot.add(upper);
    root.add(lower, upperPivot);
    // gold electrodes plated down the faces
    for (const sz of [-1, 1]) {
      const lowerEl = box(TINE_W * 0.5, half * 0.9, 0.004, goldMat);
      lowerEl.position.set(0, half * 0.5, (sz * TINE_T) / 2);
      root.add(lowerEl);
      const upperEl = box(TINE_W * 0.5, half * 0.85, 0.004, goldMat);
      upperEl.position.set(0, half * 0.5, (sz * TINE_T) / 2);
      upperPivot.add(upperEl);
    }
    forkInsert.add(root);
    return { root, upperPivot };
  }
  const tineL = buildTine(-1);
  const tineR = buildTine(1);

  // Motion ghosts: two static copies at full deflection, faint, so the eye
  // reads a blur rather than a slow wobble. depthWrite off — a material that
  // can fade must never punch holes through anything behind it.
  for (const gs of [-1, 1]) {
    const ghostMat = quartzMat.clone();
    ghostMat.transparent = true;
    ghostMat.opacity = 0.07;
    ghostMat.clearcoat = 0; // coat specular ignores opacity and reads solid
    ghostMat.depthWrite = false;
    for (const sx of [-1, 1]) {
      const arm = beveledBox(TINE_W, FORK_L * 0.9, TINE_T, ghostMat, 0.01);
      arm.geometry.translate(0, (FORK_L * 0.9) / 2, 0);
      arm.position.set(sx * 0.092, -FORK_L * 0.44, 0);
      arm.rotation.z = -sx * gs * 0.075;
      forkInsert.add(arm);
    }
  }

  // Cut-away can behind the fork, with a dark liner so the concave metal
  // interior never turns into a mirror.
  const insertCan = new THREE.Group();
  forkInsert.add(insertCan);
  // thetaStart PI/2 keeps the SHELL on the far side (three puts theta 0 at
  // +Z), so the cut-away opens toward the camera instead of hiding the fork
  const insertShell = new THREE.Mesh(
    new THREE.CylinderGeometry(0.15, 0.15, FORK_L * 1.5, 32, 1, true, Math.PI / 2, Math.PI),
    insertCanMat,
  );
  insertShell.position.set(0, -FORK_L * 0.12, -0.02);
  insertCan.add(insertShell);
  const insertLiner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.146, 0.146, FORK_L * 1.5, 32, 1, true, Math.PI / 2, Math.PI),
    linerMat,
  );
  insertLiner.position.copy(insertShell.position);
  insertCan.add(insertLiner);
  const insertBase = new THREE.Mesh(new THREE.CylinderGeometry(0.155, 0.155, 0.05, 32), epoxyMat);
  insertBase.position.set(0, -FORK_L * 0.87, -0.02);
  insertCan.add(insertBase);

  // charge running up one electrode as the other discharges
  const forkFlow = [];
  for (const sx of [-1, 1]) {
    const dotMat = materials.glow(0x7ad7f0, 2.0);
    dotMat.transparent = true;
    dotMat.opacity = 0;
    dotMat.depthWrite = false;
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), dotMat);
    dot.position.set(sx * 0.092, 0, TINE_T * 0.7);
    forkInsert.add(dot);
    forkFlow.push(dot);
  }

  // ==========================================================================
  // MACRO INSERT B — the divider ladder.
  // Eight rungs, each running at exactly half the rate of the one above it.
  // The top rungs are a blur; the bottom one flashes once per tick. That IS
  // the mechanism, filmed as a bench readout rather than drawn as a diagram.
  // ==========================================================================
  const ladder = new THREE.Group();
  ladder.position.set(0.86, 2.28, 0.3);
  ladder.rotation.set(-0.05, -0.42, 0);
  group.add(ladder);
  ladder.add(beveledBox(0.72, 0.56, 0.03, materials.polymer(0x0d1014), 0.02));
  const ROWS = 8;
  const rungs = [];
  for (let i = 0; i < ROWS; i++) {
    const rowMat = materials.glow(0x7ad7f0, 0.2);
    rowMat.transparent = true;
    rowMat.opacity = 0.9;
    const bar = box(0.5, 0.024, 0.008, rowMat);
    bar.position.set(-0.04, 0.225 - i * 0.062, 0.021);
    ladder.add(bar);
    rungs.push(bar);
    const rail = box(0.56, 0.032, 0.006, railMat);
    rail.position.set(-0.04, 0.225 - i * 0.062, 0.015);
    ladder.add(rail);
  }

  // ==========================================================================
  // CALLOUTS
  // ==========================================================================
  const labels = calloutSets(['dial', 'movement', 'crystal', 'divider', 'motor', 'train']);
  const L = labels.add;

  L('dial', handCap, 'Seconds hand', [0, 0, 0.02], 55, 66);
  L('dial', watchCase, 'Mineral glass', [0.42, -0.33, 0.16], -30, 60);
  L('dial', watchCase, 'Crown', [CASE_R + 0.11, 0, -0.02], 12, 54);

  L('movement', cell, 'Battery', [0, -0.05, -0.05], 200, 64);
  L('movement', xtalCan, 'Quartz crystal', [0, 0.09, -0.02], 68, 66);
  L('movement', ic, 'Integrated circuit', [0.02, 0.06, -0.02], 40, 62);
  L('movement', winding, 'Coil', [0, -0.05, -0.05], -48, 58);
  L('movement', rotor, 'Rotor', [0, -0.05, -0.05], -96, 58);

  L('crystal', forkInsert, 'Quartz tuning fork', [0, 0.34, 0.05], 58, 66);
  L('crystal', tineR.upperPivot, 'Gold electrodes', [0.05, 0.12, 0.03], 18, 60);
  L('crystal', insertCan, 'Vacuum can', [-0.14, -0.34, -0.02], -128, 62);

  L('divider', rungs[0], '32,768 a second in', [0.24, 0.02, 0.01], 32, 62);
  L('divider', rungs[ROWS - 1], 'One a second out', [0.24, -0.02, 0.01], -28, 62);
  L('divider', ic, 'Fifteen halvings inside', [0.02, 0.05, -0.02], 48, 66);

  L('motor', winding, 'Coil', [0, 0.05, -0.05], 128, 58);
  L('motor', notches[0], 'Notch in the yoke', [0.01, 0.02, -0.02], 104, 62);
  L('motor', rotor, 'Rotor magnet', [0, -0.055, -0.05], -96, 66);
  L('motor', seat, 'Steel stator', [0.02, -0.062, -0.02], -100, 62);

  L('train', rotor, 'Rotor pinion, 10 teeth', [0, 0, 0.06], -68, 118);
  L('train', fifth, 'Fifth wheel, 60 teeth', [0.09, -0.06, 0.05], -22, 132);
  L('train', secondsWheel, 'Seconds wheel', [0.08, 0.08, 0.05], 46, 124);
  L('train', minuteWheel, 'Minute wheel', [-0.04, 0.05, 0.05], 132, 104);

  // ==========================================================================
  // POSE — ONE scalar drives the machine; everything else is pinned per step
  // ==========================================================================
  const state = { tick: 0, flip: 0, reveal: 0, dress: 1, insert: 0, fieldViz: 0 };

  function apply() {
    const tick = state.tick;
    const n = Math.floor(tick);
    const f = tick - n;
    const pos = n + stepPhase(f); // continuous tick position, carrying the snap

    // the rotor: half a turn per tick, always the same way round
    rotor.rotation.z = -pos * Math.PI;
    // 6:1 then 5:1 — the seconds wheel turns once per 60 ticks
    fifth.rotation.z = (pos * Math.PI) / 6;
    secondsWheel.rotation.z = (-pos * Math.PI) / 30;
    secondsHand.rotation.z = (-pos * Math.PI) / 30;

    // the coil is live only at the head of each tick, alternating polarity
    const live = state.fieldViz * Math.max(0, 1 - f / PULSE_U);
    const forward = n % 2 === 0;
    fieldArcs.forEach((arc, i) => {
      const warm = (i === 0) === forward;
      arc.visible = state.fieldViz > 0;
      arc.material.opacity = live * 0.38;
      arc.material.color.setHex(warm ? 0xff9a5c : 0x7ad7f0);
      arc.material.emissive.setHex(warm ? 0xff9a5c : 0x7ad7f0);
    });
    winding.material.emissive.setRGB(live * 0.14, live * 0.065, live * 0.018);

    // current beads: one pass per tick, so a lap is exactly 60 passes
    flow.setFront((tick % 1) * 1.55, state.reveal > 0.5);

    // The fork: one flex per tick on screen — slowed roughly thirty thousand
    // times from the real 32,768 a second.
    const flex = Math.cos(TAU * tick) * 0.055;
    tineL.root.rotation.z = flex;
    tineL.upperPivot.rotation.z = flex;
    tineR.root.rotation.z = -flex;
    tineR.upperPivot.rotation.z = -flex;
    forkFlow.forEach((dot, i) => {
      const sgn = i === 0 ? 1 : -1;
      const v = Math.max(0, sgn * Math.cos(TAU * tick));
      dot.material.opacity = v * 0.9;
      dot.position.y = -0.1 + v * 0.34;
    });

    // Divider ladder: rung i runs at 2^(ROWS-1-i) flashes per tick. Anything
    // above about eight a tick is drawn as a steady glow — which is honestly
    // what it looks like.
    rungs.forEach((bar, i) => {
      const rate = Math.pow(2, ROWS - 1 - i);
      const v =
        rate > 8
          ? 0.62 + 0.06 * Math.sin(TAU * tick * 4)
          : Math.sin(TAU * tick * rate) > 0
            ? 1
            : 0.06;
      bar.material.emissiveIntensity = 0.25 + v * 2.6;
      bar.material.opacity = 0.35 + v * 0.65;
    });

    // --- pinned presentation state ------------------------------------------
    const lifted = state.reveal > 0.5;
    movement.position.set(0, CY + (lifted ? LIFT_Y : 0), lifted ? LIFT_Z : 0);
    movement.rotation.set(lifted ? -0.1 : 0, state.flip > 0.5 ? Math.PI : 0, 0);
    dress.visible = state.dress > 0.5;
    caseback.visible = !lifted;

    // The crystal can is METAL — hidden outright on the crystal step, never
    // ghosted; the oversized stand-in takes its place in frame.
    xtalCan.visible = state.insert !== 1;
    forkInsert.visible = state.insert === 1;
    ladder.visible = state.insert === 2;
  }
  apply();

  return {
    group,
    state,
    parts: { movement, rotor, fifth, secondsWheel, secondsHand, forkInsert, ladder, caseback },
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setTick(tick) {
      state.tick = tick;
      apply();
    },
    setLabels: labels.setLabels,
  };
}
