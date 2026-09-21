import * as THREE from 'three';
import { materials, studioPlinth } from '../../framework/parts.js';
import {
  beveledBox,
  tubeAlong,
  bladeRing,
  boltCircle,
  finStack,
  lathe,
} from '../../framework/geometry.js';
import { TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// An open-frame petrol genset (~3.5 kW class) — the orange box on every job
// site — product-shot staged on a charcoal plinth, with the alternator head
// modelled at teardown resolution because that is where the explainer lives.
//
// Reference facts (electricaleasy "AC synchronous generator: construction and
// working"; Britannica "electric generator — stator windings"; eCampusOntario
// PEG-3722 parts 1 & 3, alternator rotors and exciters):
//  - The ARMATURE — the winding that carries the output power — sits on the
//    STATOR, not the rotor. High voltage is far easier to insulate on a part
//    that never moves, and it keeps the full load current off the sliding
//    contacts. Only the low-power DC excitation goes through the slip rings.
//    This is the exact inverse of a brushed DC motor, where the commutator
//    carries everything.
//  - The rotor is an ELECTROMAGNET, not a permanent magnet: a salient 2-pole
//    laminated core with a field coil round its waist, fed DC through two
//    slip rings and two carbon brushes.
//  - SLIP RINGS ARE CONTINUOUS, where a commutator is a ring SPLIT into
//    segments. But do NOT draw the obvious conclusion: in a rotating-FIELD
//    machine like this one the rings are not in the output path at all, so
//    their continuity is not what makes the output AC. The output alternates
//    because a stationary coil sees a sweeping field — nothing commutates
//    anywhere. What the rings really buy is that the only sliding contact in
//    the machine carries the field current, not the load current.
//  - f = P·N/120. A 2-pole rotor must turn 3,000 rpm for 50 Hz, 3,600 rpm for
//    60 Hz — which is why a genset engine runs at one fixed speed and has a
//    mechanical governor holding it there.
//  - Excitation bootstraps off RESIDUAL magnetism in the rotor iron: a few
//    volts appear at the stator, get rectified back into the field, and the
//    thing pulls itself up by its own bootstraps in a fraction of a second.
//    Lose the residual field and the generator produces nothing until the
//    field is "flashed" from a battery.
//
// ---------------------------------------------------------------------------
// PROPORTIONS — ONE scale, 1 unit = 0.28 m, ratios read off a 610 x 460 x 510
// mm open-frame genset:  L 2.20 : W 1.64 : H 1.84  (0.75 and 0.84 of length,
// against a real 0.75 and 0.84).  The alternator head is 0.92 long x 0.63 dia
// = 258 x 176 mm against a real ~240 x 160 mm head.
//
// The crankshaft runs along X. The alternator, the control panel, the output
// cable and the scope all live at +X so the label-heavy end lands on the RIGHT
// of frame, clear of the text panel's left ~38%. The engine is the counterweight
// at -X.
// ---------------------------------------------------------------------------
const PLINTH_H = 0.26;
const AXIS_Y = 1.02; // crankshaft centreline above the floor

const FRAME_X = 1.1; // frame uprights
const FRAME_Z = 0.82;
const FRAME_Y0 = 0.32;
const FRAME_Y1 = 2.06;
const TUBE_R = 0.05;
const SKID_Y = 0.42; // top of the base rails the engine is isolated onto

// --- alternator head, axially -----------------------------------------------
const HOUSE_R = 0.315; // outer housing shell (dress)
const STATOR_OR = 0.285;
const STATOR_IR = 0.196;
const SLOT_OR = 0.248; // slot bottoms
// Air gap drawn at 0.020 (≈5 mm at this scale) against a real 0.5 mm. A
// truthful gap is two screen pixels: with rotor and stator both being grey
// laminated iron, the cutaway then reads as ONE solid drum and the whole
// "magnet inside a ring" idea disappears. The exaggeration is what makes the
// gap a thing you can see, which is the point of the step that names it.
const ROTOR_R = 0.176;
const STACK_X0 = 0.16;
const STACK_X1 = 0.46;
const STACK_L = STACK_X1 - STACK_X0;
const END_TURN = 0.055; // rotor field-coil bulge past the core

const PLATE_DE_X = 0.1; // drive-end bearing plate
const PLATE_RE_X = 0.56; // rear bearing plate
const FAN_X = 0.68;
// Small on purpose. At 0.235 the fan sat at almost exactly the radius of the
// stator's copper end-turn crown and blocked the bottom of it from every
// near-axial camera — and that crown, seen end-on, IS the "ring of copper".
const FAN_R = 0.15;
const RING_R = 0.085; // slip ring radius
const RING_A_X = 0.81;
const RING_B_X = 0.91;
const RING_W = 0.062;
const CAP_X = 1.0; // rear cap face (dress)
const PANEL_X = 1.055;

const SHAFT_R = 0.055;

const SLOTS = 12; // stator slots  → 12 coil sides, 6 coils
const SLOT_STEP = 360 / SLOTS;
const TOOTH_HALF = 7; // degrees of tooth face either side of a tooth centre
// A 60° wedge of the stator lifts out as a cutaway. Without it the rotor is
// invisible from every angle — a full laminated ring has no slit to look
// through. Both cuts land on TOOTH CENTRES, so the saw goes through iron and
// never through a slot full of copper.
//
// 60°, not 90°: at 90° the notch swallowed the ENTIRE near face of the ring,
// so from the camera that looked into it there was no stator left in front of
// the rotor at all and the rotor read as a bare spinning drum. At 60°, viewed
// from the middle of the notch, ring survives above and below the opening and
// the shot reads as a magnet sitting inside something.
const WEDGE_A0 = 0; // +Z, facing the viewer
const WEDGE_A1 = 60;
const WEDGE_MID = (WEDGE_A0 + WEDGE_A1) / 2;

const WARM = 0xff9a4d; // current one way
const COOL = 0x5aa8ff; // current the other way
const FIELD_BLUE = 0x86b9ff;
const ACCENT = 0x54c8e8;

const deg = (d) => (d * Math.PI) / 180;

// ---------------------------------------------------------------------------
// shape helpers. φ is measured about the X axis from +Z toward +Y:
//   p = (x, r·sinφ, r·cosφ).  A rotation of `a` about +X maps φ → φ − a.
// Shapes are authored in a (Z, Y) plane and extruded along X.
// ---------------------------------------------------------------------------
function extrudeAlongX(shape, len, material, bevel = 0.01) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: len,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 12,
  });
  geo.translate(0, 0, -len / 2);
  geo.rotateY(-Math.PI / 2); // shape x → world Z, shape y → world Y, depth → X
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

function sectorShape(rIn, rOut, centerDeg, spanDeg, segs = 24) {
  const a0 = deg(centerDeg - spanDeg / 2);
  const a1 = deg(centerDeg + spanDeg / 2);
  const s = new THREE.Shape();
  for (let i = 0; i <= segs; i++) {
    const a = a0 + ((a1 - a0) * i) / segs;
    const x = Math.cos(a) * rOut;
    const y = Math.sin(a) * rOut;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  for (let i = segs; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / segs;
    s.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
  }
  s.closePath();
  return s;
}

function ringShape(rIn, rOut) {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, 0, TAU, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rIn, 0, TAU, true);
  s.holes.push(hole);
  return s;
}

// Open-ended tube along the motor axis. FrontSide culls the far wall, so it
// reads solid from outside and never shows a concave metal interior.
function tubeShell(radius, len, material, segs = 64) {
  const geo = new THREE.CylinderGeometry(radius, radius, len, segs, 1, true);
  geo.rotateZ(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// The stator BORE profile between two tooth centres: wide tooth faces at the
// bore radius, separated by slots that flare out to SLOT_OR — the shape that
// lets a winding be dropped in from the inside. Walked counter-clockwise.
function borePoints(a0, a1) {
  const pts = [];
  const at = (r, d) => pts.push([Math.cos(deg(d)) * r, Math.sin(deg(d)) * r]);
  const arc = (r, d0, d1, n = 4) => {
    for (let i = 0; i <= n; i++) at(r, d0 + ((d1 - d0) * i) / n);
  };
  arc(STATOR_IR, a0, a0 + TOOTH_HALF); // leading half tooth face
  let c = a0;
  while (c + SLOT_STEP <= a1) {
    at(SLOT_OR, c + TOOTH_HALF); // out into the slot
    at(SLOT_OR, c + SLOT_STEP - TOOTH_HALF); // across its bottom
    c += SLOT_STEP;
    if (c >= a1) {
      arc(STATOR_IR, c - TOOTH_HALF, c); // trailing half tooth face
      break;
    }
    arc(STATOR_IR, c - TOOTH_HALF, c + TOOTH_HALF);
  }
  return pts;
}

// One angular sector of the stator lamination: outer arc out at STATOR_OR,
// back along the toothed bore. A0=0,A1=360 gives the whole ring.
function statorSector(a0, a1) {
  const s = new THREE.Shape();
  const n = Math.max(10, Math.round((a1 - a0) / 3));
  for (let i = 0; i <= n; i++) {
    const d = a0 + ((a1 - a0) * i) / n;
    const x = Math.cos(deg(d)) * STATOR_OR;
    const y = Math.sin(deg(d)) * STATOR_OR;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  const bore = borePoints(a0, a1);
  for (let i = bore.length - 1; i >= 0; i--) s.lineTo(bore[i][0], bore[i][1]);
  s.closePath();
  return s;
}

// The salient 2-pole rotor: two arc pole shoes at +Y and -Y joined by a narrow
// waist, the classic dumbbell cross-section. The field coil wraps the waist and
// the shoes overhang it — which is exactly what pole shoes are for.
const POLE_HALF = 56; // degrees of arc per pole shoe
const WAIST_HALF = 0.088; // half-width of the waist, in Z
function rotorShape() {
  const pts = [];
  const push = (r, d) => pts.push([Math.cos(deg(d)) * r, Math.sin(deg(d)) * r]);
  for (const c of [90, 270]) {
    // 44 samples, not 20: at close range the pole face is the thing the eye
    // lands on and a visibly polygonal arc is the CG giveaway.
    for (let i = 0; i <= 44; i++) push(ROTOR_R, c - POLE_HALF + ((2 * POLE_HALF) * i) / 44);
    // shoulder down onto the waist, then along it to the next shoe
    const yEnd = Math.sin(deg(c + POLE_HALF)) * ROTOR_R;
    const xEnd = Math.cos(deg(c + POLE_HALF)) * ROTOR_R;
    const sgn = Math.sign(xEnd) || 1;
    pts.push([sgn * WAIST_HALF, yEnd * 0.72]);
    pts.push([sgn * WAIST_HALF, -yEnd * 0.72]);
  }
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 0, SHAFT_R + 0.004, 0, TAU, true);
  s.holes.push(bore);
  return s;
}

// One turn of the field coil: a rounded racetrack in the X–Z plane encircling
// the waist, at height y and standing off the waist by d.
function fieldLoopPoints(y, d) {
  const h = STACK_L / 2;
  return [
    [-h, y, -d],
    [-h - END_TURN, y, -d * 0.6],
    [-h - END_TURN, y, d * 0.6],
    [-h, y, d],
    [h, y, d],
    [h + END_TURN, y, d * 0.6],
    [h + END_TURN, y, -d * 0.6],
    [h, y, -d],
  ];
}

// Rounded-rectangle sample points in the XY plane at a fixed Z — the roll frame.
function roundedRectPoints(x0, x1, y0, y1, rc, z) {
  const out = [];
  const corner = (cx, cy, a0, a1) => {
    for (let i = 0; i <= 5; i++) {
      const a = a0 + ((a1 - a0) * i) / 5;
      out.push([cx + Math.cos(a) * rc, cy + Math.sin(a) * rc, z]);
    }
  };
  corner(x1 - rc, y0 + rc, -Math.PI / 2, 0);
  corner(x1 - rc, y1 - rc, 0, Math.PI / 2);
  corner(x0 + rc, y1 - rc, Math.PI / 2, Math.PI);
  corner(x0 + rc, y0 + rc, Math.PI, Math.PI * 1.5);
  return out;
}

// Glowing beads riding a curve. `march` walks them round (DC); `jiggle` shoves
// the whole queue back and forth about a rest position (AC — mains electrons
// really do only shuffle a fraction of a millimetre either way).
function beadStream(curve, count, color, size = 0.02) {
  const geo = new THREE.SphereGeometry(size, 10, 8);
  const group = new THREE.Group();
  const dots = [];
  for (let i = 0; i < count; i++) {
    const mat = materials.glow(color, 1.4);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false; // never punch holes in the cable behind
    const dot = new THREE.Mesh(geo, mat);
    group.add(dot);
    dots.push(dot);
  }
  return {
    group,
    dots,
    set(offset, strength, tint) {
      dots.forEach((dot, i) => {
        const t = (((i / count + offset) % 1) + 1) % 1;
        dot.position.copy(curve.getPointAt(t));
        if (tint) dot.material.color.copy(tint);
        // fade at both tips so beads arrive and leave instead of popping
        dot.material.opacity = strength * 0.8 * Math.min(1, Math.sin(Math.PI * t) * 3);
      });
    },
  };
}

// Arrow with a real shaft, centred on its anchor and pointing +Y before
// orienting. A bare cone at this scale reads as a speck.
// `glow` is emissive and the stage runs bloom over it: above ~1.0 these stop
// being blue arrows and become white shards.
function vizArrow(color, len = 0.2, intensity = 1.0) {
  const g = new THREE.Group();
  const mat = materials.glow(color, intensity);
  mat.transparent = true;
  mat.opacity = 0;
  mat.depthWrite = false;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, len, 10), mat);
  shaft.position.y = -len * 0.3;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.046, 0.1, 14), mat);
  head.position.y = len * 0.5;
  g.add(shaft, head);
  g.userData.mat = mat;
  return g;
}

function orientAlong(obj, dir) {
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
}

export function buildGenerator({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  group.add(studioPlinth({ w: 3.9, h: PLINTH_H, d: 2.1 }));

  // `shaker` carries everything bolted to the machine, so the whole genset can
  // buzz on its feet the way a running one actually does. The plinth, the
  // cable and the scope stay outside it.
  const shaker = new THREE.Group();
  group.add(shaker);

  // --- materials -------------------------------------------------------------
  const bodyMat = materials.paintedMetal(0xc0452a); // safety orange tank & panel
  const frameMat = materials.paintedMetal(0x2a2e34);
  frameMat.roughness = 0.5;
  // Deliberately duller than the alternator. The engine is the biggest mass in
  // every macro frame; at a brighter finish it out-shouted the subject sitting
  // right next to it.
  const engineMat = materials.aluminum(0x868d94);
  engineMat.roughness = 0.72; // large curved castings go near-chrome otherwise
  const sumpMat = materials.grimyAluminum(0x8f959c);
  const polyMat = materials.polymer(0x1d2024);
  const mufflerMat = materials.heatBluedSteel('v');
  const rubberMat = materials.rubber(0x141619);
  const steelPlain = new THREE.MeshPhysicalMaterial({
    color: 0xa9b0b9,
    metalness: 1,
    roughness: 0.42,
  });
  const shaftMat = new THREE.MeshPhysicalMaterial({
    color: 0xb4bbc3,
    metalness: 1,
    roughness: 0.4, // roughness, not envMapIntensity, is the anti-glare knob
  });
  // Laminated iron: map-free, because extruded shapes carry ad-hoc UVs. Rotor
  // and stator get DIFFERENT tones on purpose — at the same grey the two read
  // as a single drum and the cutaway shows nothing.
  const lamMat = new THREE.MeshPhysicalMaterial({
    color: 0x7e868f,
    metalness: 0.92,
    roughness: 0.56,
  });
  const rotorLamMat = new THREE.MeshPhysicalMaterial({
    color: 0x4e545c,
    metalness: 0.9,
    roughness: 0.62,
  });
  const carbonMat = new THREE.MeshPhysicalMaterial({
    color: 0x141416,
    metalness: 0.06,
    roughness: 0.95,
  });
  const brassMat = new THREE.MeshPhysicalMaterial({ color: 0xb08d4a, metalness: 1, roughness: 0.3 });
  const insulMat = new THREE.MeshPhysicalMaterial({
    color: 0x141518,
    metalness: 0,
    roughness: 0.78,
  });
  const copperMat = (color = 0xd08a45) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.85,
      roughness: 0.4,
      clearcoat: 0.12, // high coat specular swamps the emissive polarity tint
      emissive: new THREE.Color(WARM),
      emissiveIntensity: 0,
    });

  // =========================================================================
  // BASE SKID — two channel rails with the engine rubber-mounted onto them.
  // This is what the machine still stands on once the roll frame comes off,
  // which is why it lives outside `dress`.
  // =========================================================================
  for (const sz of [-0.4, 0.4]) {
    const rail = beveledBox(2.04, 0.12, 0.11, frameMat, 0.02);
    rail.position.set(0, SKID_Y - 0.06, sz);
    rail.receiveShadow = true;
    shaker.add(rail);
  }
  for (const mx of [-0.86, -0.28]) {
    for (const mz of [-0.4, 0.4]) {
      const iso = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.085, 0.2, 18), rubberMat);
      iso.position.set(mx, SKID_Y + 0.1, mz);
      shaker.add(iso);
    }
  }
  // rear foot under the alternator, so the drum is not cantilevered in mid-air
  const altFoot = beveledBox(0.2, 0.34, 0.5, frameMat, 0.03);
  altFoot.position.set(0.58, SKID_Y + 0.17, 0);
  shaker.add(altFoot);

  // =========================================================================
  // ENGINE — deliberately a silhouette, not a teardown. It is the muscle;
  // four-stroke-engine already owns the inside of it.
  // =========================================================================
  const engine = new THREE.Group();
  shaker.add(engine);

  // Map-free: the cast normal/roughness maps tile across a box this size and
  // read as a perforated speaker grille rather than an aluminium casting.
  const crankMat = engineMat.clone();
  crankMat.normalMap = null;
  crankMat.roughnessMap = null;
  crankMat.roughness = 0.68;
  const crankcase = beveledBox(0.8, 0.76, 0.84, crankMat, 0.08);
  crankcase.position.set(-0.56, AXIS_Y, 0);
  engine.add(crankcase);
  const sump = beveledBox(0.74, 0.2, 0.78, sumpMat, 0.05);
  sump.position.set(-0.56, AXIS_Y - 0.44, 0);
  engine.add(sump);

  // Cylinder: inclined toward -Z, mostly buried under the tank with only the
  // head and rocker cover out in the open beside it — which is exactly how
  // much of a genset's cylinder you can actually see.
  const cyl = new THREE.Group();
  cyl.position.set(-0.56, AXIS_Y + 0.16, -0.28);
  orientAlong(cyl, new THREE.Vector3(0, Math.sin(deg(55)), -Math.cos(deg(55))));
  engine.add(cyl);
  const fins = finStack(
    { count: 4, size: 0.215, thickness: 0.05, gap: 0.07, shape: 'square', taper: 0.14 },
    engineMat,
  );
  fins.position.y = 0.06;
  cyl.add(fins);
  const head = beveledBox(0.4, 0.2, 0.4, engineMat, 0.05);
  head.position.y = 0.54;
  cyl.add(head);
  const rocker = beveledBox(0.28, 0.12, 0.28, polyMat, 0.04);
  rocker.position.y = 0.66;
  cyl.add(rocker);

  // Recoil starter — the pull-start face is the most recognisable thing on the
  // whole machine, so it gets real detail: a dished cover, a spiral rib, the
  // cord and the grip.
  const recoilCover = lathe(
    [
      [0.0, 0.0],
      [0.3, 0.0],
      [0.33, 0.03],
      [0.33, 0.09],
      [0.26, 0.13],
      [0.12, 0.15],
      [0.0, 0.15],
    ],
    polyMat,
    40,
  );
  recoilCover.rotation.z = Math.PI / 2; // lathe axis +Y → -X, facing away
  recoilCover.position.set(-0.94, AXIS_Y, 0);
  engine.add(recoilCover);
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6;
    const vane = beveledBox(0.02, 0.03, 0.2, materials.polymer(0x15181c), 0.006);
    vane.position.set(-1.07, AXIS_Y + Math.sin(a) * 0.17, Math.cos(a) * 0.17);
    vane.rotation.x = -a;
    engine.add(vane);
  }
  const recoilBoss = new THREE.Mesh(
    new THREE.CylinderGeometry(0.075, 0.095, 0.06, 20).rotateZ(-Math.PI / 2),
    polyMat,
  );
  recoilBoss.position.set(-1.11, AXIS_Y, 0);
  engine.add(recoilBoss);
  const pullCord = tubeAlong(
    [
      [-1.06, AXIS_Y + 0.3, 0.1],
      [-1.18, AXIS_Y + 0.24, 0.26],
      [-1.24, AXIS_Y + 0.02, 0.33],
    ],
    0.013,
    rubberMat,
    { tubularSegments: 24, radialSegments: 8 },
  );
  engine.add(pullCord);
  const pullGrip = new THREE.Mesh(new THREE.CylinderGeometry(0.052, 0.052, 0.17, 16), polyMat);
  pullGrip.position.set(-1.25, AXIS_Y - 0.04, 0.34);
  pullGrip.rotation.x = 0.4;
  engine.add(pullGrip);

  // muffler on the exhaust side, under the tank overhang
  const muffler = new THREE.Mesh(
    new THREE.CylinderGeometry(0.16, 0.16, 0.46, 28).rotateZ(-Math.PI / 2),
    mufflerMat,
  );
  muffler.castShadow = true;
  muffler.position.set(-0.66, 1.3, -0.62);
  engine.add(muffler);
  // The shield is an open half-cylinder, so it MUST be double-sided — but on
  // its OWN material. Setting .side on the shared steelPlain turned every
  // steel part in the scene double-sided and lit their concave interiors.
  const shieldMat = steelPlain.clone();
  shieldMat.side = THREE.DoubleSide;
  shieldMat.roughness = 0.75; // its specular was throwing grey bokeh discs
  const shield = new THREE.Mesh(
    new THREE.CylinderGeometry(0.185, 0.185, 0.38, 28, 1, true, deg(-30), deg(240)).rotateZ(
      -Math.PI / 2,
    ),
    shieldMat,
  );
  shield.position.set(-0.66, 1.3, -0.62);
  engine.add(shield);
  const tailpipe = tubeAlong(
    [
      [-0.46, 1.3, -0.62],
      [-0.32, 1.26, -0.68],
      [-0.24, 1.18, -0.76],
    ],
    0.05,
    mufflerMat,
    { tubularSegments: 24, radialSegments: 12 },
  );
  engine.add(tailpipe);
  const EXHAUST_MOUTH = new THREE.Vector3(-0.24, 1.16, -0.78);

  const airbox = beveledBox(0.38, 0.3, 0.34, polyMat, 0.06);
  airbox.position.set(-0.4, 1.3, 0.48);
  engine.add(airbox);
  const airboxLid = beveledBox(0.32, 0.05, 0.28, materials.polymer(0x15181c), 0.02);
  airboxLid.position.set(-0.4, 1.47, 0.48);
  engine.add(airboxLid);
  const intake = tubeAlong(
    [
      [-0.44, 1.24, 0.32],
      [-0.5, 1.3, 0.16],
      [-0.56, 1.36, -0.04],
    ],
    0.055,
    polyMat,
    { tubularSegments: 20, radialSegments: 10 },
  );
  engine.add(intake);

  // exhaust puffs — three, riding one shared phase out of the tailpipe
  const puffMat = new THREE.MeshBasicMaterial({
    color: 0x9aa4b0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const puffs = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), puffMat.clone());
    engine.add(p);
    puffs.push(p);
  }

  // =========================================================================
  // ALTERNATOR — the subject. Structure stays; the housing is dress.
  // =========================================================================
  const alt = new THREE.Group();
  shaker.add(alt);

  // The DRIVE-end plate is real structure and stays. The REAR one lifts off
  // with the housing: left in place it sits directly in front of the rear
  // copper end-turn crown, and that crown seen end-on is the single most
  // legible thing in the whole explainer.
  const platePlain = extrudeAlongX(ringShape(0.13, 0.3), 0.055, steelPlain, 0.014);
  platePlain.position.set(PLATE_DE_X + 0.02, AXIS_Y, 0);
  alt.add(platePlain);
  const bellBolts = boltCircle(6, 0.25, 0.03, steelPlain, 0.028);
  bellBolts.rotation.z = Math.PI / 2; // ring lies in the YZ plane, axis +X
  bellBolts.position.set(PLATE_DE_X + 0.05, AXIS_Y, 0);
  alt.add(bellBolts);

  const bearingHubs = [];
  for (const px of [PLATE_DE_X - 0.05, PLATE_RE_X + 0.05]) {
    const hub = extrudeAlongX(ringShape(0.062, 0.12), 0.1, steelPlain, 0.016);
    hub.position.set(px, AXIS_Y, 0);
    alt.add(hub);
    bearingHubs.push(hub);
  }


  // --- stator: laminated core + 12 slot bars + two end-turn crowns ----------
  const stator = new THREE.Group();
  stator.position.y = AXIS_Y;
  alt.add(stator);
  // The wedge and everything wound inside it lift out together.
  const statorWedge = new THREE.Group();
  stator.add(statorWedge);

  const LAM_N = 9;
  const lamSlice = (STACK_L - 0.02) / LAM_N;
  const mainShape = statorSector(WEDGE_A1, 360);
  const wedgeShape = statorSector(WEDGE_A0, WEDGE_A1);
  for (let i = 0; i < LAM_N; i++) {
    const lx = STACK_X0 + lamSlice / 2 + i * (lamSlice + 0.0025);
    const main = extrudeAlongX(mainShape, lamSlice, lamMat, 0.003);
    main.position.x = lx;
    stator.add(main);
    const wedge = extrudeAlongX(wedgeShape, lamSlice, lamMat, 0.003);
    wedge.position.x = lx;
    statorWedge.add(wedge);
  }

  const coilMats = [];
  const slotAngles = [];
  for (let k = 0; k < SLOTS; k++) {
    const beta = k * SLOT_STEP + SLOT_STEP / 2; // slot centre, between two teeth
    slotAngles.push(beta);
    const mat = copperMat();
    coilMats.push(mat);
    const host = beta > WEDGE_A0 && beta < WEDGE_A1 ? statorWedge : stator;

    // Copper sits FLUSH with the bore rather than recessed behind a slot
    // wedge. Recessed is what a real stator does and it is completely
    // invisible: the bore then reads as plain iron and the copy's "iron teeth
    // packed with copper wire" has nothing on screen to point at.
    const bar = extrudeAlongX(
      sectorShape(STATOR_IR + 0.001, SLOT_OR - 0.004, beta, SLOT_STEP * 0.4, 10),
      STACK_L + 0.01,
      mat,
      0.004,
    );
    bar.position.set((STACK_X0 + STACK_X1) / 2, 0, 0);
    host.add(bar);

    // End turns skew toward the next slot at both ends — the slanted woven
    // crown every wound stator has. Same skew direction on both ends. These
    // crowns are the only stator copper visible from outside, so they are
    // built chunky: thin ones let the rotor's field coil read as "the copper".
    const rMid = (STATOR_IR + SLOT_OR) / 2 + 0.008;
    for (const [endX, sgn] of [
      [STACK_X0, -1],
      [STACK_X1, 1],
    ]) {
      const pt = (dd, rr, xx) => [xx, Math.sin(deg(beta + dd)) * rr, Math.cos(deg(beta + dd)) * rr];
      const turn = tubeAlong(
        [
          pt(0, rMid, endX + sgn * 0.006),
          pt(8, rMid + 0.01, endX + sgn * 0.055),
          pt(20, rMid + 0.015, endX + sgn * 0.095),
          pt(32, rMid + 0.008, endX + sgn * 0.07),
          pt(40, rMid - 0.002, endX + sgn * 0.01),
        ],
        0.03,
        mat,
        { tubularSegments: 26, radialSegments: 8 },
      );
      host.add(turn);
    }
  }

  // --- rotor: everything that turns ----------------------------------------
  const rotor = new THREE.Group();
  rotor.position.y = AXIS_Y;
  alt.add(rotor);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(SHAFT_R, SHAFT_R, 1.32, 24).rotateZ(-Math.PI / 2),
    shaftMat,
  );
  shaft.castShadow = true;
  shaft.position.x = 0.32;
  rotor.add(shaft);

  // Exposed crankshaft between the two machines, with the coupling that joins
  // them. Bolted flush the way a real genset is, there is no shaft to see at
  // all — and "two machines, one shaft" is a claim the picture has to make.
  const coupling = new THREE.Mesh(
    new THREE.CylinderGeometry(0.105, 0.105, 0.13, 28).rotateZ(-Math.PI / 2),
    steelPlain,
  );
  coupling.castShadow = true;
  coupling.position.x = -0.06;
  rotor.add(coupling); // turns with the shaft, so its bolts read as motion
  for (let i = 0; i < 4; i++) {
    const ca = (i * TAU) / 4 + deg(45);
    const cbolt = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.017, 0.16, 8), brassMat);
    cbolt.rotation.z = Math.PI / 2;
    cbolt.position.set(-0.06, Math.sin(ca) * 0.07, Math.cos(ca) * 0.07);
    rotor.add(cbolt);
  }

  const rotorGeoShape = rotorShape();
  const rLamN = 7;
  const rSlice = (STACK_L - 0.016) / rLamN;
  const poleMats = [];
  for (let i = 0; i < rLamN; i++) {
    const slice = extrudeAlongX(rotorGeoShape, rSlice, rotorLamMat.clone(), 0.003);
    slice.position.x = STACK_X0 + rSlice / 2 + i * (rSlice + 0.0027);
    slice.material.emissive = new THREE.Color(FIELD_BLUE);
    slice.material.emissiveIntensity = 0;
    poleMats.push(slice.material);
    rotor.add(slice);
  }

  // field coil round the waist: 6 rows x 3 stand-offs, every turn clear of the
  // waist iron and tucked under the pole-shoe overhang
  const fieldMatCu = copperMat(0xc98a4a);
  const coilCentreX = (STACK_X0 + STACK_X1) / 2;
  // Two stand-offs, not three: at three the coil grew as wide as the pole
  // shoes and became the biggest lump of copper on screen, which made the
  // ROTOR read as "the windings" and left the stator looking like bare iron.
  for (const cy of [-0.082, -0.041, 0, 0.041, 0.082]) {
    for (const d of [0.104, 0.132]) {
      const loop = tubeAlong(
        fieldLoopPoints(cy, d).map(([px, py, pz]) => [px + coilCentreX, py, pz]),
        0.0125,
        fieldMatCu,
        { tubularSegments: 64, radialSegments: 8, closed: true, tension: 0.5 },
      );
      rotor.add(loop);
    }
  }

  // cooling fan, outboard of the rear bearing
  const fanMat = materials.polymer(0x24282e);
  const fan = bladeRing(
    {
      blades: 12,
      hubR: 0.06,
      span: 0.09,
      chord: 0.075,
      chordTip: 0.062,
      camber: 0.06,
      twist: 0.55,
      twistTip: 0.4,
      hubDepth: 0.08,
      hubMaterial: fanMat,
    },
    fanMat,
  );
  fan.group.rotation.y = Math.PI / 2; // ring axis +Z → +X
  fan.group.position.x = FAN_X;
  rotor.add(fan.group);

  // slip rings — CONTINUOUS. Nothing here is split; that is the whole point.
  const ringMats = [];
  for (const rx of [RING_A_X, RING_B_X]) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0xc59a52,
      metalness: 1,
      roughness: 0.34,
      emissive: new THREE.Color(ACCENT),
      emissiveIntensity: 0,
    });
    ringMats.push(mat);
    const ring = new THREE.Mesh(
      new THREE.CylinderGeometry(RING_R, RING_R, RING_W, 40).rotateZ(-Math.PI / 2),
      mat,
    );
    ring.castShadow = true;
    ring.position.x = rx;
    rotor.add(ring);
  }
  const ringInsul = new THREE.Mesh(
    new THREE.CylinderGeometry(RING_R - 0.014, RING_R - 0.014, 0.2, 32).rotateZ(-Math.PI / 2),
    insulMat,
  );
  ringInsul.position.x = (RING_A_X + RING_B_X) / 2;
  rotor.add(ringInsul);
  // the two leads running forward from the rings into the field coil
  for (const [rx, sgnZ] of [
    [RING_A_X, 1],
    [RING_B_X, -1],
  ]) {
    const lead = tubeAlong(
      [
        [rx, Math.sin(deg(sgnZ > 0 ? 20 : 200)) * RING_R, Math.cos(deg(sgnZ > 0 ? 20 : 200)) * RING_R],
        [0.66, sgnZ * 0.052, sgnZ * 0.075],
        [0.54, sgnZ * 0.06, sgnZ * 0.1],
        [STACK_X1 + END_TURN * 0.8, sgnZ * 0.07, sgnZ * 0.14],
      ],
      0.014,
      fieldMatCu,
      { tubularSegments: 30, radialSegments: 8 },
    );
    rotor.add(lead);
  }

  // brush gear — stationary, so it lives on `alt`, not `rotor`
  const brushes = [];
  // Brushes come straight down onto the top of the rings: rings below, carbon
  // above, which is the one arrangement that reads instantly side-on.
  const brushBridge = beveledBox(0.26, 0.07, 0.1, insulMat, 0.016);
  brushBridge.position.set((RING_A_X + RING_B_X) / 2, AXIS_Y + RING_R + 0.19, 0);
  alt.add(brushBridge);
  for (const [rx, bz] of [
    [RING_A_X, 0],
    [RING_B_X, 0],
  ]) {
    const holder = beveledBox(0.075, 0.11, 0.075, insulMat, 0.012);
    holder.position.set(rx, AXIS_Y + RING_R + 0.1, bz);
    alt.add(holder);
    const block = beveledBox(0.055, 0.075, 0.055, carbonMat, 0.008);
    block.position.set(rx, AXIS_Y + RING_R + 0.036, bz);
    alt.add(block);
    brushes.push(block);
  }

  // --- the air gap, drawn ---------------------------------------------------
  // A hairline ring sitting exactly at gap radius on the exposed rear face.
  // The step named for the gap has to be able to point AT something: even
  // exaggerated, a 5 mm slot between two grey irons is not findable on its own.
  const gapMat = materials.glow(ACCENT, 1.0);
  gapMat.transparent = true;
  gapMat.opacity = 0;
  gapMat.depthWrite = false;
  const gapRing = new THREE.Mesh(
    new THREE.TorusGeometry((ROTOR_R + STATOR_IR) / 2, 0.009, 8, 96),
    gapMat,
  );
  gapRing.rotation.y = Math.PI / 2; // torus axis +Z → +X
  gapRing.position.set(STACK_X1 + 0.012, AXIS_Y, 0);
  alt.add(gapRing);

  // --- rotor field arrows: flux leaving N, entering S, riding the rotor -----
  // Placed OUTBOARD of the stack, not across the air gap: at gap radius they
  // were buried inside the stator iron for the whole of its 300° and only
  // poked out through the cutaway.
  const fieldArrows = [];
  for (const [poleDeg, dir] of [
    [90, 1],
    [270, -1],
  ]) {
    for (const off of [-20, 20]) {
      const a = poleDeg + off;
      const ar = vizArrow(FIELD_BLUE, 0.115, 0.8);
      const rr = ROTOR_R + 0.048;
      ar.position.set(
        STACK_X1 + 0.075,
        Math.sin(deg(a)) * rr,
        Math.cos(deg(a)) * rr,
      );
      // outward at the north pole, inward at the south
      orientAlong(ar, new THREE.Vector3(0, Math.sin(deg(a)) * dir, Math.cos(deg(a)) * dir));
      rotor.add(ar);
      fieldArrows.push(ar);
    }
  }

  // --- drag arrows: the reaction torque, opposing rotation ------------------
  const dragArrows = [];
  for (const poleDeg of [90, 270]) {
    for (const off of [-34, 34]) {
      const a = poleDeg + off;
      // Outboard of the rear face and just PROUD of the rotor, so they stand
      // in open air: this is the payoff of the whole explainer and it has to
      // read from a camera that is not perfectly square to the shaft.
      const ar = vizArrow(0xff7a4d, 0.24, 1.25);
      const rr = ROTOR_R + 0.02;
      ar.position.set(STACK_X1 + 0.05, Math.sin(deg(a)) * rr, Math.cos(deg(a)) * rr);
      // rotation about +X carries φ → φ − a, i.e. the surface moves toward
      // DECREASING φ. The reaction shoves the other way: toward increasing φ.
      orientAlong(ar, new THREE.Vector3(0, Math.cos(deg(a)), -Math.sin(deg(a))));
      rotor.add(ar);
      dragArrows.push(ar);
    }
  }

  // =========================================================================
  // DRESS — the sealed skin. Metal cannot be ghosted convincingly, so this
  // whole group is hidden outright on reveal and the camera flight covers it.
  // =========================================================================
  const dress = new THREE.Group();
  shaker.add(dress);

  // The roll frame is dress too. It looks right in the hero and the finale,
  // but it is a cage: every macro camera that gets close to the alternator has
  // a tube crossing the lens. Taking it off with the covers leaves the two
  // machines standing clean on their skid.
  for (const fz of [FRAME_Z, -FRAME_Z]) {
    const loop = tubeAlong(
      roundedRectPoints(-FRAME_X, FRAME_X, FRAME_Y0, FRAME_Y1, 0.24, fz),
      TUBE_R,
      frameMat,
      { tubularSegments: 180, radialSegments: 12, closed: true, tension: 0.5 },
    );
    dress.add(loop);
  }
  for (const cx of [-FRAME_X + 0.24, FRAME_X - 0.24]) {
    for (const cy of [FRAME_Y0, FRAME_Y1]) {
      const cross = new THREE.Mesh(
        new THREE.CylinderGeometry(TUBE_R * 0.9, TUBE_R * 0.9, FRAME_Z * 2, 14).rotateX(
          Math.PI / 2,
        ),
        frameMat,
      );
      cross.castShadow = true;
      cross.position.set(cx, cy, 0);
      dress.add(cross);
    }
  }
  for (const fx of [-0.82, 0.82]) {
    for (const fz of [-FRAME_Z, FRAME_Z]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.09, 20), rubberMat);
      foot.position.set(fx, PLINTH_H + 0.045, fz);
      foot.receiveShadow = true;
      dress.add(foot);
    }
  }

  // rear bearing end plate — bolts to the housing, comes off with it
  const rearPlate = extrudeAlongX(ringShape(0.13, 0.3), 0.055, steelPlain, 0.014);
  rearPlate.position.set(PLATE_RE_X, AXIS_Y, 0);
  dress.add(rearPlate);

  // Coupling shroud: the guard over the exposed shaft. Sealed, you would never
  // see the join between the two machines — which is exactly the point of
  // taking it off.
  const shroudMat = engineMat.clone();
  shroudMat.color.setHex(0x767d85);
  shroudMat.roughness = 0.78;
  const shroud = new THREE.Mesh(
    new THREE.CylinderGeometry(HOUSE_R, 0.42, 0.32, 40, 1, true).rotateZ(-Math.PI / 2),
    shroudMat,
  );
  shroud.castShadow = true;
  shroud.position.set(-0.1, AXIS_Y, 0);
  dress.add(shroud);
  const shroudBolts = boltCircle(6, 0.38, 0.034, steelPlain, 0.03);
  shroudBolts.rotation.z = Math.PI / 2;
  shroudBolts.position.set(-0.25, AXIS_Y, 0);
  dress.add(shroudBolts);

  // alternator housing, in three shells with two louvre bands between
  for (const [x0, x1] of [
    [0.06, 0.16],
    [0.26, 0.6],
    [0.76, CAP_X],
  ]) {
    const shell = tubeShell(HOUSE_R, x1 - x0, steelPlain);
    shell.position.set((x0 + x1) / 2, AXIS_Y, 0);
    dress.add(shell);
  }
  for (const [x0, x1] of [
    [0.16, 0.26],
    [0.6, 0.76],
  ]) {
    // own material: setting .side on the shared insulMat flipped every dark
    // insulator in the scene inside out
    const linerMat = insulMat.clone();
    linerMat.side = THREE.BackSide; // a dark inner wall, never a mirror
    const liner = tubeShell(HOUSE_R - 0.022, x1 - x0, linerMat);
    liner.position.set((x0 + x1) / 2, AXIS_Y, 0);
    dress.add(liner);
    for (let i = 0; i < 26; i++) {
      const a = (i * TAU) / 26;
      const louvre = new THREE.Mesh(
        new THREE.BoxGeometry(x1 - x0 - 0.006, 0.03, 0.028),
        steelPlain,
      );
      louvre.position.set(
        (x0 + x1) / 2,
        AXIS_Y + Math.sin(a) * (HOUSE_R - 0.012),
        Math.cos(a) * (HOUSE_R - 0.012),
      );
      louvre.rotation.x = -a;
      dress.add(louvre);
    }
  }
  const capFace = extrudeAlongX(ringShape(0.075, HOUSE_R), 0.05, steelPlain, 0.014);
  capFace.position.set(CAP_X + 0.02, AXIS_Y, 0);
  dress.add(capFace);

  // Fuel tank on top — nearly the full plan area of the frame, sitting right
  // under the top rails. A small tank leaves the frame looking like an empty
  // cage, which is the opposite of how a packed genset reads.
  const tank = beveledBox(1.54, 0.42, 1.16, bodyMat, 0.07);
  tank.position.set(-0.2, 1.74, 0);
  dress.add(tank);
  const tankSeam = new THREE.Mesh(
    new THREE.BoxGeometry(1.55, 0.024, 1.17),
    materials.paintedMetal(0x8f3320),
  );
  tankSeam.position.set(-0.2, 1.7, 0);
  dress.add(tankSeam);
  const filler = new THREE.Mesh(new THREE.CylinderGeometry(0.115, 0.12, 0.075, 28), polyMat);
  filler.castShadow = true;
  filler.position.set(-0.34, 1.97, 0.16);
  dress.add(filler);
  const fuelGauge = new THREE.Mesh(
    new THREE.CylinderGeometry(0.065, 0.065, 0.03, 24),
    materials.polymer(0x14171a),
  );
  fuelGauge.position.set(0.24, 1.96, 0);
  dress.add(fuelGauge);

  // control panel on the +X end face — sockets pointing at the camera
  const panel = beveledBox(0.04, 0.84, 0.9, bodyMat, 0.02);
  panel.position.set(PANEL_X, 1.04, 0);
  dress.add(panel);
  const panelInset = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.7, 0.76), polyMat);
  panelInset.position.set(PANEL_X + 0.026, 1.04, 0);
  dress.add(panelInset);

  const socketPositions = [
    [0.92, -0.2],
    [0.92, 0.2],
  ];
  for (const [sy, sz] of socketPositions) {
    const bezel = new THREE.Mesh(
      new THREE.CylinderGeometry(0.115, 0.115, 0.035, 28).rotateZ(-Math.PI / 2),
      polyMat,
    );
    bezel.position.set(PANEL_X + 0.04, sy, sz);
    dress.add(bezel);
    const well = new THREE.Mesh(
      new THREE.CylinderGeometry(0.088, 0.088, 0.02, 28).rotateZ(-Math.PI / 2),
      insulMat,
    );
    well.position.set(PANEL_X + 0.05, sy, sz);
    dress.add(well);
    for (let i = 0; i < 3; i++) {
      const a = deg(90 + i * 120);
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.05, 0.02), insulMat);
      pin.position.set(PANEL_X + 0.055, sy + Math.sin(a) * 0.045, sz + Math.cos(a) * 0.045);
      pin.rotation.x = -a;
      dress.add(pin);
    }
  }
  // breaker toggle, key switch and a little analogue voltmeter
  const breaker = beveledBox(0.05, 0.1, 0.05, polyMat, 0.012);
  breaker.position.set(PANEL_X + 0.045, 1.24, -0.26);
  dress.add(breaker);
  const keySwitch = new THREE.Mesh(
    new THREE.CylinderGeometry(0.055, 0.055, 0.04, 20).rotateZ(-Math.PI / 2),
    polyMat,
  );
  keySwitch.position.set(PANEL_X + 0.04, 1.24, 0.28);
  dress.add(keySwitch);
  const meterBezel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.1, 0.1, 0.03, 28).rotateZ(-Math.PI / 2),
    polyMat,
  );
  meterBezel.position.set(PANEL_X + 0.04, 1.26, 0.02);
  dress.add(meterBezel);
  const meterFace = new THREE.Mesh(
    new THREE.CylinderGeometry(0.082, 0.082, 0.012, 28).rotateZ(-Math.PI / 2),
    new THREE.MeshPhysicalMaterial({ color: 0xdfe3e8, metalness: 0, roughness: 0.5 }),
  );
  meterFace.position.set(PANEL_X + 0.052, 1.26, 0.02);
  dress.add(meterFace);
  const needle = new THREE.Mesh(
    new THREE.BoxGeometry(0.008, 0.072, 0.008),
    new THREE.MeshBasicMaterial({ color: 0xb3402c }),
  );
  needle.geometry.translate(0, 0.036, 0);
  needle.position.set(PANEL_X + 0.06, 1.235, 0.02);
  dress.add(needle);

  // =========================================================================
  // OUTPUT CABLE + PLUG — off the near socket, down onto the plinth.
  // =========================================================================
  const cable = tubeAlong(
    [
      [PANEL_X + 0.07, 0.92, -0.2],
      [1.32, 0.78, -0.34],
      [1.5, 0.5, -0.5],
      [1.62, PLINTH_H + 0.05, -0.56],
      [1.86, PLINTH_H + 0.04, -0.44],
    ],
    0.036,
    rubberMat,
    { tubularSegments: 60, radialSegments: 12 },
  );
  group.add(cable);
  const plugBody = beveledBox(0.16, 0.12, 0.2, polyMat, 0.03);
  plugBody.position.set(1.94, PLINTH_H + 0.06, -0.42);
  plugBody.rotation.y = -0.4;
  group.add(plugBody);
  const outFlow = beadStream(cable.userData.curve, 9, ACCENT, 0.024);
  group.add(outFlow.group);

  // DC excitation lead: from a small regulator block on the frame to the brush
  // bridge. Beads here MARCH — it is the one genuinely direct current in the
  // machine, and the contrast with the jiggling AC output is the point.
  // Mounted low on the skid, not up on the housing: routed over the top it
  // laid a red cable straight across every macro shot of the alternator.
  // On the FAR side: routed up the near side it laid a red bar straight across
  // the slip rings in the one step that is about the slip rings.
  const avr = beveledBox(0.18, 0.26, 0.14, polyMat, 0.025);
  avr.position.set(0.98, SKID_Y + 0.3, -0.44);
  shaker.add(avr);
  const dcLead = tubeAlong(
    [
      [0.98, SKID_Y + 0.43, -0.42],
      [0.95, 1.1, -0.34],
      [0.9, AXIS_Y + 0.32, -0.18],
      [(RING_A_X + RING_B_X) / 2, AXIS_Y + RING_R + 0.2, -0.05],
    ],
    0.016,
    materials.polymer(0x6d241d),
    { tubularSegments: 40, radialSegments: 10 },
  );
  shaker.add(dcLead);
  const dcFlow = beadStream(dcLead.userData.curve, 6, 0xffb454, 0.018);
  shaker.add(dcFlow.group);

  // =========================================================================
  // BENCH SCOPE — the one non-machine object in frame. It exists so the
  // "one turn = one cycle" claim is something you can watch, not just read.
  // =========================================================================
  const scope = new THREE.Group();
  scope.position.set(1.5, PLINTH_H, 0.52);
  scope.rotation.y = 0.62; // screen faces +X and +Z, toward the step-5 camera
  group.add(scope);
  const scopeTilt = new THREE.Group();
  scopeTilt.rotation.x = -0.26; // and tips its face up toward the lens
  scope.add(scopeTilt);

  const scopeBody = beveledBox(0.56, 0.34, 0.2, materials.polymer(0x202429), 0.035);
  scopeBody.position.set(0, 0.18, 0);
  scopeTilt.add(scopeBody);
  const scopeFoot = beveledBox(0.5, 0.06, 0.26, materials.polymer(0x1a1d21), 0.02);
  scopeFoot.position.set(0, 0.03, 0.03);
  scope.add(scopeFoot);
  // A pure-black panel reads as a hole punched in the plinth on the steps where
  // the trace is off. A slate face in a brushed bezel reads as an instrument.
  const screen = new THREE.Mesh(
    new THREE.BoxGeometry(0.44, 0.26, 0.012),
    new THREE.MeshPhysicalMaterial({ color: 0x0d141a, metalness: 0.1, roughness: 0.5 }),
  );
  screen.position.set(0, 0.2, 0.104);
  scopeTilt.add(screen);
  // Rough and dark on purpose. At 0.3 roughness this bezel turned into a
  // mirror of the key light at raking angles and blew to clipped white, which
  // the explainer's own step cameras never hit but the video's closer
  // auto-framed ones did: the scope read as a glowing white rectangle even on
  // the steps where its trace is switched off.
  const bezelMat = materials.brushedSteel(0x6f767e);
  bezelMat.roughness = 0.62;
  const bezel = new THREE.Mesh(new THREE.BoxGeometry(0.49, 0.31, 0.014), bezelMat);
  bezel.position.set(0, 0.2, 0.099);
  scopeTilt.add(bezel);
  for (const kx of [-0.16, 0, 0.16]) {
    const knob = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.03, 0.03, 18), polyMat);
    knob.rotation.x = Math.PI / 2;
    knob.position.set(kx, 0.045, 0.105);
    scopeTilt.add(knob);
  }

  const gridMat = new THREE.MeshBasicMaterial({
    color: 0x2b4a58,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  for (let i = -2; i <= 2; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.004, 0.22, 0.004), gridMat);
    v.position.set(i * 0.095, 0.2, 0.111);
    scopeTilt.add(v);
  }
  for (let i = -1; i <= 1; i++) {
    const h = new THREE.Mesh(new THREE.BoxGeometry(0.4, 0.004, 0.004), gridMat);
    h.position.set(0, 0.2 + i * 0.07, 0.111);
    scopeTilt.add(h);
  }

  // Two full wavelengths across the screen, so "the wave" reads as a wave.
  const TRACE_W = 0.4;
  const TRACE_A = 0.078;
  const traceMat = materials.glow(ACCENT, 1.3);
  traceMat.transparent = true;
  traceMat.opacity = 0;
  traceMat.depthWrite = false;
  const tracePts = [];
  for (let i = 0; i <= 96; i++) {
    const u = i / 96;
    tracePts.push([(u - 0.5) * TRACE_W, 0.2 + Math.sin(u * 2 * TAU) * TRACE_A, 0.115]);
  }
  const trace = tubeAlong(tracePts, 0.008, traceMat, { tubularSegments: 160, radialSegments: 6 });
  trace.castShadow = false;
  scopeTilt.add(trace);
  const beadMat = materials.glow(0xffffff, 1.6);
  beadMat.transparent = true;
  beadMat.opacity = 0;
  beadMat.depthWrite = false;
  const scopeBead = new THREE.Mesh(new THREE.SphereGeometry(0.019, 12, 10), beadMat);
  scopeTilt.add(scopeBead);

  // =========================================================================
  // LABELS
  // =========================================================================
  const labels = calloutSets(['exterior', 'inside', 'rotorSet', 'induct', 'wave', 'rings', 'load']);

  labels.add('exterior', dress, 'Fuel tank', [-0.24, 1.98, 0.3], 104, 62);
  // leaders lean RIGHT out of the machine: the engine sits at -X, so anything
  // pointing left off it lands under the text panel
  labels.add('exterior', engine, 'Petrol engine', [-0.58, 1.2, 0.42], -18, 86);
  labels.add('exterior', shaker, 'Alternator head', [0.42, AXIS_Y + HOUSE_R, 0.14], 74, 76);
  labels.add('exterior', dress, 'Control panel', [PANEL_X + 0.06, 0.92, 0.2], 22, 88);
  labels.add('exterior', shaker, 'Roll frame', [FRAME_X - 0.3, FRAME_Y1, 0.82], 46, 66);

  // Step 2 shows the machine opened but the stator still WHOLE, so the rotor
  // is not visible yet and must not be labelled here.
  labels.add('inside', alt, 'The alternator', [0.31, AXIS_Y + 0.02, STATOR_OR], 26, 96);
  labels.add('inside', rotor, 'Crankshaft', [-0.06, 0.115, 0.05], 112, 80);
  labels.add('inside', alt, 'Cooling fan', [FAN_X, AXIS_Y + FAN_R, 0.02], 62, 70);
  labels.add('inside', alt, 'Slip rings', [RING_B_X, AXIS_Y - RING_R, 0.02], -48, 86);

  // Every internal anchor sits on a REAR face. The cameras for these steps look
  // in near-axially from the rear quarter; anchors buried mid-stack or on the
  // drive end point at metal the viewer cannot see.
  const gapY = Math.sin(deg(WEDGE_MID)) * ((ROTOR_R + STATOR_IR) / 2);
  const gapZ = Math.cos(deg(WEDGE_MID)) * ((ROTOR_R + STATOR_IR) / 2);
  labels.add('rotorSet', rotor, 'Field coil', [STACK_X1 + END_TURN, 0.0, 0.11], 8, 92);
  // stationary anchor pointing at the rotor face through the notch: a label
  // riding a pole tip spends half of every turn behind the stator
  labels.add('rotorSet', alt, 'Rotor core', [STACK_X1 - 0.04, AXIS_Y + 0.07, 0.1], 96, 78);
  labels.add('rotorSet', alt, 'Air gap', [STACK_X1 + 0.005, AXIS_Y + gapY, gapZ], 34, 96);

  // Anchored on stator that SURVIVES the cutaway — inside the wedge's arc
  // these pointed at the hole where the iron used to be.
  labels.add('induct', alt, 'Stator winding', [STACK_X1 + 0.07, AXIS_Y - 0.104, 0.222], -20, 92);
  // up on the stator's shoulder, so the three labels do not all pile into the
  // bottom-right corner
  labels.add('induct', alt, 'Laminated core', [0.36, AXIS_Y + 0.281, -0.05], 110, 76);
  labels.add('induct', rotor, 'Rotor pole', [STACK_X1 - 0.02, ROTOR_R - 0.02, 0.0], 70, 78);

  labels.add('wave', scope, 'One turn, one cycle', [0, 0.42, 0.1], 66, 74);
  // on the shaft between the two machines, not out on the engine — at this
  // camera the engine itself sits behind the text panel
  labels.add('wave', shaker, '3,000 rpm, held there', [-0.02, AXIS_Y + 0.34, 0.12], 62, 80);

  labels.add('rings', alt, 'Slip rings — continuous', [RING_B_X, AXIS_Y - RING_R, 0.02], -52, 92);
  labels.add('rings', alt, 'Carbon brushes', [RING_A_X, AXIS_Y + RING_R + 0.09, 0.06], 52, 78);
  labels.add('rings', shaker, 'DC field supply', [0.8, AXIS_Y + 0.34, 0.25], 34, 86);

  labels.add('load', rotor, 'Reaction torque', [0.31, 0.0, ROTOR_R - 0.02], 12, 96);
  labels.add('load', group, 'Current out', [1.36, 0.78, -0.34], 18, 88);

  // =========================================================================
  // POSE / STATE — one object, one apply(), every part derived from it.
  // =========================================================================
  const state = {
    spin: 0, // rotor angle, radians about +X. WHOLE turns per loop lap.
    reveal: 0, // 0 sealed · 1 skin off
    cut: 0, // 0 stator whole · 1 the 90° wedge lifted out
    run: 0, // 0..1 engine running (vibration, exhaust)
    excite: 0, // 0..1 field energised
    load: 0, // 0..1 how hard the socket is being pulled on
    flow: 0, // 0..1 DC bead / exhaust phase. WHOLE laps.
    fieldViz: 0,
    dragViz: 0,
    scopeViz: 0,
    gapViz: 0,
    coilGain: 1, // per-step boost for the stator polarity tint
  };

  const warmCol = new THREE.Color(WARM);
  const coolCol = new THREE.Color(COOL);
  const scratch = new THREE.Color();
  const accentCol = new THREE.Color(ACCENT);
  const loadCol = new THREE.Color(0xff8a4a);

  function apply() {
    rotor.rotation.x = state.spin;

    // Metal cannot be ghosted — the skin comes off outright, and so does the
    // stator wedge.
    dress.visible = state.reveal < 0.5;
    statorWedge.visible = state.cut < 0.5;

    // A running single-cylinder genset visibly buzzes on its rubber feet.
    // Driven off `spin` so it stays periodic with the loop.
    // ~4 mm at this scale. A single-cylinder set on rubber isolators really
    // does shake this much, and at 0.005 the shake was sub-pixel: the sealed
    // steps, whose only other sign of life vents on the occluded side, read as
    // frozen stills.
    const buzz = state.run * 0.013;
    shaker.position.y = Math.sin(state.spin * 2) * buzz;
    shaker.position.z = Math.cos(state.spin * 3) * buzz * 0.6;
    shaker.rotation.x = Math.sin(state.spin * 2) * buzz * 0.5;

    // --- the whole of the electrical story, in four lines -------------------
    // The north pole sits at φ = 90° − spin. A coil at φ = β links flux
    // ∝ cos((90° − spin) − β), so its EMF ∝ sin of the same angle: ZERO when
    // the pole points straight at it, PEAK when the pole is edge-on. Opposite
    // sides of the bore come out opposite, because they are the two sides of
    // the same coil.
    const poleAngle = Math.PI / 2 - state.spin;
    for (let k = 0; k < SLOTS; k++) {
      const emf = Math.sin(poleAngle - deg(slotAngles[k]));
      const mag = Math.abs(emf);
      scratch.copy(emf >= 0 ? warmCol : coolCol);
      coilMats[k].emissive.copy(scratch);
      // Kept low on purpose: pushed harder, the blue half of the cycle turns
      // the copper mauve and it stops reading as copper at all. The polarity
      // needs to be a TINT on metal, not a light source.
      coilMats[k].emissiveIntensity =
        state.excite * mag * (0.26 + 0.5 * state.load) * state.coilGain;
    }
    gapMat.opacity = state.gapViz * 0.9;

    // The rotor's own field is DC — steady while excited, and it is what the
    // slip rings are for.
    fieldMatCu.emissive.copy(accentCol);
    fieldMatCu.emissiveIntensity = state.excite * 0.16;
    for (const m of poleMats) m.emissiveIntensity = state.excite * state.fieldViz * 0.16;
    for (const m of ringMats) m.emissiveIntensity = state.excite * 0.18;

    for (const ar of fieldArrows) ar.userData.mat.opacity = state.fieldViz * state.excite * 0.62;

    // Reaction torque: present only under load, and pulsating at twice line
    // frequency — which is exactly why single-phase gensets thrum.
    const pulse = 0.35 + 0.65 * Math.sin(state.spin) ** 2;
    for (const ar of dragArrows) ar.userData.mat.opacity = state.dragViz * state.load * pulse;

    // Output: AC. The beads do not march — they shuffle back and forth about
    // a rest position, which is what mains current actually does.
    const out = Math.cos(state.spin);
    outFlow.set(0.5 + out * 0.1, state.excite * (0.25 + 0.75 * state.load), loadCol);
    // DC excitation: these DO march, steadily, one direction.
    dcFlow.set(state.flow, state.excite);

    // scope
    const traceOn = state.scopeViz * state.excite;
    traceMat.opacity = traceOn * 0.95;
    gridMat.opacity = traceOn * 0.5;
    beadMat.opacity = traceOn;
    const u = (((state.spin / TAU / 2) % 1) + 1) % 1; // two wavelengths per pass
    scopeBead.position.set(
      (u - 0.5) * TRACE_W,
      0.2 + Math.sin(u * 2 * TAU) * TRACE_A,
      0.121,
    );
    needle.rotation.x = deg(-46 + 92 * (state.excite * (1 - state.load * 0.22)));

    // exhaust
    puffs.forEach((p, i) => {
      const t = (((state.flow * 2 + i / 3) % 1) + 1) % 1;
      p.position.set(
        EXHAUST_MOUTH.x - t * 0.06,
        EXHAUST_MOUTH.y + t * 0.34,
        EXHAUST_MOUTH.z - t * 0.24,
      );
      p.scale.setScalar(1 + t * 2.6);
      // Only while the machine is sealed. Behind the focal plane of the macro
      // steps these blew up into grey blobs that read as debris on the machine
      // — and the sealed steps are exactly where a visible sign of life is
      // wanted, since nothing else out here moves.
      p.material.opacity = state.run * (1 - state.reveal) * 0.42 * Math.sin(Math.PI * t) ** 1.5;
    });
  }
  apply();

  return {
    group,
    state,
    parts: {
      rotor,
      stator,
      statorWedge,
      alt,
      dress,
      brushes,
      dragArrows,
      fieldArrows,
      scopeBead,
      fan,
    },
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
  };
}
