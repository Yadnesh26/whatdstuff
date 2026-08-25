import * as THREE from 'three';
import { materials, rod, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, boltCircle } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';

// A single-chip DLP projector, presented as a studio product shot: the sealed
// body first, then the lid lifts off to expose the whole optical train.
//
// MECHANISM (researched — TI "DMD 101" app note DLPA008B, ProjectorCentral's
// LCD-vs-DLP technology series, Firgelli's colour-wheel teardown):
//   A UHP arc lamp burns at the focus of an elliptical reflector, which
//   collects the light into a narrow cone. A square light-integrator ROD
//   bounces that cone off its own polished walls until the blotchy arc image
//   is smeared into an evenly-lit rectangle. The beam then crosses a spinning
//   COLOUR WHEEL — a glass disc of dichroic filter segments (R/G/B, often two
//   sets of three; the old white segment is dropped on home-theatre wheels
//   because it washes colour out) turning at 7,200–14,400 rpm, i.e. 2×–4× the
//   video frame rate. Downstream of the wheel the beam is never white again:
//   it is red, then green, then blue, in sequence, thousands of times a
//   second. A condenser and a fold mirror aim that beam onto the DMD.
//   The DMD (Digital Micromirror Device) is a CMOS chip carrying one hinged
//   aluminium mirror per pixel — 5.4–17 µm across, ~2 million of them on a
//   1080p chip. Each sits on a torsion hinge and is pulled electrostatically
//   to one of exactly two stable stops, ±12° (±17° on newer TRP parts).
//   Illumination arrives 2×12° = 24° off the chip's normal, so a mirror at
//   −12° reflects straight down the projection lens (bright pixel) and a
//   mirror at +12° throws its light 4×12° = 48° away, into a black LIGHT DUMP
//   (dark pixel). There is no dimming: grey comes from PWM — flipping the
//   mirror on and off thousands of times inside one colour flash, so the
//   duty cycle sets the brightness. Colour comes from time: the chip only
//   ever shows a red frame, then a green frame, then a blue frame, and the
//   viewer's eye fuses them into one full-colour image. (When your eye
//   fails to fuse them — a fast glance across the screen — you see the
//   "rainbow effect", which is the mechanism showing through.)
//
// PROPORTIONS (world units, 1 unit ≈ 130 mm). Every constant below derives
// from ONE consistent scale, so the silhouette ratios hold by construction:
//   body 2.30 × 0.78 × 1.70 units = 300 × 101 × 221 mm — a real compact
//   home projector's footprint (W:H:D = 2.95 : 1 : 2.18). Colour wheel
//   Ø 0.42 = 55 mm (real wheels are 40–80 mm). Reflector mouth Ø 0.35 =
//   45 mm. Projection lens Ø 0.44 = 57 mm. Throw ratio of the visible beam
//   cone ≈ 1.6, a standard-throw lens.
//
// THE MACRO-INSERT TRICK (same device as fiber-optics): a real DMD is a
// 0.47–0.95 inch chip whose mirrors are a fifth the width of a human hair —
// literally invisible at body scale. So the chip exists TWICE: as the real,
// correctly-sized part inside the body, and as a deliberately oversized macro
// insert floating above it, revealed only for the three chip steps, where
// the ±12° geometry, the hinge diagonal, and the two ray fans are true to
// scale relative to each other even though the absolute size is not.
//
// STATE SCALARS the whole pose is built from:
//   spin    — presentation turntable (rad; whole turns per lap)
//   reveal  — 0 sealed body / 1 lid lifted + walls ghosted
//   wheel   — colour-wheel angle (rad; whole turns per lap). The segment
//             under the beam, and therefore the colour of every optical
//             element downstream, is derived from this ONE number.
//   fan     — blower angle (rad; whole turns per lap)
//   pwm     — 0-1 mirror phase, used mod 1, so any lap is seamless
//   mode    — 'wave' (a slow binary ripple, for the structure step) or
//             'pwm' (true duty-cycle flipping)
//   channel — -1 monochrome / 0,1,2 = drive the mirrors from the R, G or B
//             separation of the image (step 7 syncs this to `wheel`)
//   beam    — 0-1 master opacity of every light path
//   macro   — 0 macro insert hidden / 1 shown
//   compose — show the "what your eye adds up" comparison patch

const frac = (x) => x - Math.floor(x);
const deg = THREE.MathUtils.degToRad;

// --- body-scale layout (body-local units, origin at the body's centre) ------
const PLINTH_H = 0.26;
const BODY_W = 2.3;
const BODY_H = 0.78;
const BODY_D = 1.7;
const FOOT_H = 0.06;
// body-local y = -0.45 is the underside of the feet, which stands on the
// plinth top — so the body group rides at plinth height + that offset
const BODY_Y = PLINTH_H + BODY_H / 2 + FOOT_H;
const BODY_Z = -0.1;
const FLOOR_Y = -BODY_H / 2 + 0.05; // top face of the chassis tray

// the optical axis of the lamp train: a straight run along +X across the
// middle of the body
const OPT_Y = -0.16;
const OPT_Z = 0.02;

const REFL_APEX_X = -0.95;
const REFL_DEPTH = 0.3;
const REFL_R = 0.175;
const ARC_X = -0.84; // the ellipse's near focus, about a third into the bowl
const ROD_X0 = -0.5;
const ROD_X1 = -0.2;
const WHEEL_X = -0.05;
const WHEEL_R = 0.21;
const WHEEL_OFFSET = 0.17; // how far the wheel's hub sits above the beam
const COND_X = 0.18;
const FOLD_X = 0.55;

// ±12° tilt ⇒ illumination must arrive 24° off the chip normal for the "on"
// state to reflect straight down the lens. That single number fixes where
// the fold mirror, the chip and the light dump can physically be.
const TILT_DEG = 12;
const TILT = deg(TILT_DEG);
const ILLUM_ANG = deg(2 * TILT_DEG); // 24°
const DUMP_ANG = deg(4 * TILT_DEG); // 48°
const FOLD_TO_DMD = 0.5;

// travel direction of the illumination beam: up and back, 24° off the chip's
// +Z normal
const ILLUM_DIR = new THREE.Vector3(0, Math.sin(ILLUM_ANG), -Math.cos(ILLUM_ANG));
const FOLD_P = new THREE.Vector3(FOLD_X, OPT_Y, OPT_Z);
const DMD_P = FOLD_P.clone().addScaledVector(ILLUM_DIR, FOLD_TO_DMD);
const DUMP_DIR = new THREE.Vector3(0, Math.sin(DUMP_ANG), Math.cos(DUMP_ANG));
const DUMP_P = DMD_P.clone().addScaledVector(DUMP_DIR, 0.4);

const LENS_Y = DMD_P.y;
const LENS_R = 0.22;
const LENS_Z0 = 0.42; // rear element, inside the body
const LENS_Z1 = 1.05; // front element, proud of the front face

// --- colour wheel -------------------------------------------------------------
// Six segments: two full sets of red / green / blue. Home-theatre wheels drop
// the clear "white" segment because it desaturates everything.
const SEG_HEX = [0xff2f2f, 0x2fe863, 0x3a72ff, 0xff2f2f, 0x2fe863, 0x3a72ff];
const SEG_NAMES = ['red', 'green', 'blue', 'red', 'green', 'blue'];
const SEG_COUNT = SEG_HEX.length;

// Which segment sits in the beam at wheel angle w. Derived, not guessed: the
// wheel's geometry is built with its axis along +X and its angular parameter
// θ landing at local (0, −r·sinθ, r·cosθ); the beam crosses the disc at
// (0, −r, 0), i.e. θ + w = π/2. See the build below.
function segmentAt(w) {
  const theta = frac((Math.PI / 2 - w) / TAU);
  return Math.floor(theta * SEG_COUNT) % SEG_COUNT;
}

// --- macro insert layout (insert-local units) --------------------------------
const MX = 14; // mirrors across the visible patch
const MY = 10;
const MPITCH = 0.082;
const MSIZE = 0.072;
const MARRAY_W = MX * MPITCH;
const MARRAY_H = MY * MPITCH;
// A DMD mirror hinges about its own DIAGONAL — the corner-to-corner torsion
// axis is the shape everyone recognises from a DMD micrograph.
const HINGE_AXIS = new THREE.Vector3(1, 1, 0).normalize();
// Same ±12° geometry as the real chip, re-derived in the insert's own frame:
// with the hinge on the (1,1,0) diagonal, tilt swings the mirror normal
// within the plane containing (1,−1,0), so illumination arrives from the
// upper-left and the two output fans separate by 48°.
const MAC_TILT_PLANE = new THREE.Vector3(1, -1, 0).normalize();
const MAC_ILLUM_DIR = MAC_TILT_PLANE.clone()
  .multiplyScalar(Math.sin(ILLUM_ANG))
  .add(new THREE.Vector3(0, 0, -Math.cos(ILLUM_ANG)))
  .normalize();
const MAC_OFF_DIR = MAC_TILT_PLANE.clone()
  .multiplyScalar(Math.sin(DUMP_ANG))
  .add(new THREE.Vector3(0, 0, Math.cos(DUMP_ANG)))
  .normalize();
const MAC_SRC = MAC_ILLUM_DIR.clone().multiplyScalar(-0.95); // where illumination comes from
const MAC_LENS = new THREE.Vector3(0, 0, 0.82); // "on" light goes straight out +Z
// pushed well out: at 0.8 the dump crowded the lens ring in screen space and
// the two destinations stopped reading as two different places
const MAC_DUMP = MAC_OFF_DIR.clone().multiplyScalar(1.1);
// One ray per sampled mirror is the whole visualisation — an earlier pass
// drew the three ray BUNDLES as fat translucent tubes and they read as
// coloured slabs blocking the chip, not as light.
// Ten, not eighteen: past about a dozen the two fans stop reading as rays
// and start reading as a spray of straws laid over the chip.
const SAMPLE_COUNT = 7;

const PWM_EDGE = 0.05; // softness of a mirror's slam between its two stops

// deterministic per-mirror PWM phase offset — real mirrors are not in step
const seedAt = (i) => frac(Math.sin(i * 12.9898 + 78.233) * 43758.5453);

// The test image the chip is asked to draw: a warm highlight upper-left, a
// cool one lower-right, over a gentle gradient. Abstract on purpose — a
// recognisable picture at 14×10 mirrors would just read as mush.
function imageRGB(col, row) {
  const u = col / (MX - 1);
  const v = row / (MY - 1);
  const ax = u - 0.3;
  const ay = v - 0.66;
  const warm = Math.exp(-(ax * ax + ay * ay) * 13);
  const bx = u - 0.76;
  const by = v - 0.3;
  const cool = Math.exp(-(bx * bx + by * by) * 16);
  // Low floors on purpose: lift them and every channel carries some of every
  // other, which turns the composite panel into pastel mush and kills the
  // whole point of showing three separations side by side.
  return [
    clamp01(0.04 + 0.92 * warm + 0.1 * cool + 0.1 * u),
    clamp01(0.04 + 0.42 * warm + 0.5 * cool + 0.08 * v),
    clamp01(0.05 + 0.06 * warm + 0.92 * cool + 0.16 * (1 - u)),
  ];
}
function dutyAt(col, row, channel) {
  const [r, g, b] = imageRGB(col, row);
  if (channel === 0) return r;
  if (channel === 1) return g;
  if (channel === 2) return b;
  return 0.3 * r + 0.6 * g + 0.1 * b; // luminance, for the mono steps
}

// A mirror is ON while its PWM phase is inside its duty window. Analytic, so
// seeking the timeline anywhere gives the same pose — no per-frame state.
function onValue(u, duty) {
  const d = Math.min(Math.max(duty, 0.05), 0.93);
  return clamp01(Math.min(smooth(u / PWM_EDGE), 1 - smooth((u - d) / PWM_EDGE)));
}

// --- small builders ----------------------------------------------------------
const UP = new THREE.Vector3(0, 1, 0);

// A light beam drawn as a (possibly tapered) open tube between two points.
function beamMesh(a, b, r0, r1, mat, seg = 14) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const len = dir.length();
  const geo = new THREE.CylinderGeometry(r1, r0, len, seg, 1, true);
  geo.translate(0, len / 2, 0);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.position.copy(a);
  mesh.quaternion.setFromUnitVectors(UP, dir.normalize());
  return mesh;
}
function beamMaterial(hex, opacity) {
  return new THREE.MeshBasicMaterial({
    color: hex,
    transparent: true,
    opacity,
    depthWrite: false, // a faded beam must never punch a hole through glass
    side: THREE.DoubleSide,
  });
}
// A simple lens element: a sphere squashed along its axis reads as a real
// biconvex blank once it is sitting in a retaining ring.
function lensElement(radius, thickness, mat, axis = 'z') {
  const mesh = new THREE.Mesh(new THREE.SphereGeometry(radius, 28, 18), mat);
  if (axis === 'z') mesh.scale.set(1, 1, thickness / (radius * 2));
  else mesh.scale.set(thickness / (radius * 2), 1, 1);
  return mesh;
}
// Rounded face plate with a real circular hole punched through it — a
// projector's front bezel, so the lens barrel passes through an actual
// opening rather than sitting on a solid disc.
function holedPlate(w, h, depth, holeR, holeX, holeY, mat) {
  const rr = 0.06;
  const s = new THREE.Shape();
  s.moveTo(-w / 2 + rr, -h / 2);
  s.lineTo(w / 2 - rr, -h / 2);
  s.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + rr);
  s.lineTo(w / 2, h / 2 - rr);
  s.quadraticCurveTo(w / 2, h / 2, w / 2 - rr, h / 2);
  s.lineTo(-w / 2 + rr, h / 2);
  s.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - rr);
  s.lineTo(-w / 2, -h / 2 + rr);
  s.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + rr, -h / 2);
  const hole = new THREE.Path();
  hole.absarc(holeX, holeY, holeR, 0, TAU, true);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
    curveSegments: 20,
  });
  geo.translate(0, 0, -depth / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}
// Recessed louvre panel — the vent grilles down each flank.
function ventPanel(width, height, slats, mat, darkMat) {
  const g = new THREE.Group();
  const back = beveledBox(0.012, height, width, darkMat, 0.004);
  g.add(back);
  const slatH = height / slats;
  for (let i = 0; i < slats; i++) {
    const s = beveledBox(0.02, slatH * 0.45, width * 0.96, mat, 0.005);
    s.position.set(0.012, -height / 2 + (i + 0.5) * slatH, 0);
    g.add(s);
  }
  return g;
}

export function buildProjector({ scene }) {
  const sceneGroup = new THREE.Group();
  scene.add(sceneGroup);
  const group = new THREE.Group(); // the presentation turntable
  sceneGroup.add(group);

  group.add(studioPlinth({ w: 3.6, h: PLINTH_H, d: 2.2 }));

  // ==========================================================================
  //  MATERIALS
  // ==========================================================================
  // The shell is matte moulded polymer, not painted metal: polymer's low
  // clearcoat is the one shell material that actually ghosts (a full coat
  // renders at full strength no matter what the opacity says).
  const shellMat = materials.polymer(0x24272d);
  const shellTopMat = materials.polymer(0x2a2e35);
  const trayMat = materials.aluminum(0x6e757e);
  trayMat.roughness = 0.82; // roughnessMap MULTIPLIES this — lower reads as wet
  const chassisMat = materials.paintedMetal(0x16181c);
  chassisMat.roughness = 0.6;
  const footMat = materials.rubber(0x0e0f11);
  const barrelMat = materials.brushedSteel(0x9fa6b0);
  barrelMat.roughness = 0.44;
  const ringMat = materials.rubber(0x1a1c20);
  const bezelMat = materials.chrome(0xc9ced6);
  bezelMat.roughness = 0.22;
  // The reflector really is a concave metal bowl, so it cannot be dodged the
  // way a casing liner can — but a mirror-smooth interior would blow out. A
  // real cold-mirror reflector is a dichroic coating on a rough substrate
  // anyway, so roughness stays high enough to read as a bowl, not a lens.
  // A pure metal bowl aimed away from the key light renders as a black hole —
  // it has no diffuse term to catch ambient with. Dropping metalness and
  // carrying a low warm emissive (the bowl really is full of lamp light) is
  // what makes it read as a reflector instead of a shadow.
  const reflectorMat = new THREE.MeshPhysicalMaterial({
    color: 0xb8c1cc,
    metalness: 0.82,
    roughness: 0.3,
    emissive: 0xffdcae,
    emissiveIntensity: 0.09, // enough to read as lit, not enough to flatten it
    side: THREE.DoubleSide,
  });
  const quartzMat = materials.glass(0xf2f6ff, 0.24);
  const rodGlassMat = materials.glass(0xe8f1ff, 0.34);
  const condenserMat = materials.glass(0xd8e6ff, 0.26);
  // Deliberately NOT materials.opticalGlass. True transmission costs a full
  // extra render of the scene into a transmission target on every frame, and
  // this scene is already the heaviest in the library — for one lens element
  // that is a few percent of frame area, and which sits behind an opaque
  // chrome bezel from most angles, that trade is not worth it. Plain tinted
  // glass with the bezel doing the work reads the same and also sidesteps the
  // transmission pass's habit of erasing the transparent beam behind it.
  const frontElementMat = materials.glass(0xe6efff, 0.3);
  frontElementMat.roughness = 0.05;
  const innerElementMat = materials.glass(0xdce8ff, 0.22);
  const foldMirrorMat = new THREE.MeshPhysicalMaterial({
    color: 0xdfe4ea,
    metalness: 1,
    roughness: 0.13,
    side: THREE.DoubleSide,
  });
  const dumpMat = materials.rubber(0x08090b);
  const pcbMat = new THREE.MeshStandardMaterial({ color: 0x1e3a2c, roughness: 0.64, metalness: 0.12 });
  const heatsinkMat = materials.aluminum(0xa8afb8);
  heatsinkMat.roughness = 0.55;
  const psuMat = materials.brushedSteel(0x8b929b);
  psuMat.roughness = 0.6;
  const motorMat = materials.darkMetal(0x2a2d33);
  const wheelHubMat = materials.chrome(0xbcc3cb);
  wheelHubMat.roughness = 0.3;
  const boltMat = materials.darkMetal(0x40454c);
  const bracketMat = materials.darkMetal(0x30343a); // optical-bench collars + posts
  const mountMat = materials.darkMetal(0x33373e); // lens mount flange, foot, leg
  const ledMat = materials.glow(0x63ff9c, 1.3);

  // The active surface of a DMD is a dense diffraction grating — it flares
  // into rainbow colour at grazing angles. Iridescence is exactly that.
  const dmdFaceMat = new THREE.MeshPhysicalMaterial({
    color: 0x8f96a2,
    metalness: 1,
    roughness: 0.16,
    iridescence: 0.85,
    iridescenceIOR: 1.9,
    iridescenceThicknessRange: [180, 640],
  });
  // real DMD packages are black ceramic — a pale one swamps the mirrors
  const packageMat = new THREE.MeshPhysicalMaterial({ color: 0x1f2228, metalness: 0.1, roughness: 0.7 });
  const goldMat = new THREE.MeshPhysicalMaterial({ color: 0xe0b566, metalness: 1, roughness: 0.3 });

  // ==========================================================================
  //  BODY — chassis (always visible) + shell (lifts and ghosts on reveal)
  // ==========================================================================
  const body = new THREE.Group();
  body.position.set(0, BODY_Y, BODY_Z);
  group.add(body);

  const chassis = new THREE.Group();
  body.add(chassis);

  const tray = beveledBox(BODY_W - 0.06, 0.05, BODY_D - 0.06, trayMat, 0.014);
  tray.position.y = FLOOR_Y - 0.025;
  tray.receiveShadow = true;
  chassis.add(tray);
  const trayRim = beveledBox(BODY_W - 0.02, 0.06, BODY_D - 0.02, chassisMat, 0.016);
  trayRim.position.y = FLOOR_Y - 0.075;
  chassis.add(trayRim);

  for (const [fx, fz] of [
    [-0.92, -0.66],
    [0.92, -0.66],
    [-0.92, 0.62],
    [0.92, 0.62],
  ]) {
    const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.09, 0.075, FOOT_H, 20), footMat);
    foot.position.set(fx, -BODY_H / 2 - FOOT_H / 2, fz);
    foot.castShadow = true;
    chassis.add(foot);
  }
  // the front height-adjust foot every projector has, screwed out a little
  const adjFoot = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 16), materials.darkMetal(0x33373d));
  adjFoot.position.set(0, -BODY_H / 2 - 0.025, 0.72);
  chassis.add(adjFoot);

  // --- the shell: lid + four walls, all one liftable/ghostable group --------
  const shell = new THREE.Group();
  body.add(shell);
  const shellDim = []; // meshes that fade on reveal

  const lid = beveledBox(BODY_W, 0.09, BODY_D, shellTopMat, 0.05);
  lid.position.y = BODY_H / 2 - 0.045;
  shell.add(lid);
  shellDim.push(lid);

  const wallY = (FLOOR_Y + (BODY_H / 2 - 0.09)) / 2;
  const wallH = BODY_H / 2 - 0.09 - FLOOR_Y;
  const wallLeft = beveledBox(0.05, wallH, BODY_D, shellMat, 0.018);
  wallLeft.position.set(-BODY_W / 2 + 0.025, wallY, 0);
  const wallRight = wallLeft.clone();
  wallRight.position.x = BODY_W / 2 - 0.025;
  const wallBack = beveledBox(BODY_W - 0.1, wallH, 0.05, shellMat, 0.018);
  wallBack.position.set(0, wallY, -BODY_D / 2 + 0.025);
  shell.add(wallLeft, wallRight, wallBack);
  shellDim.push(wallLeft, wallRight, wallBack);

  const frontPlate = holedPlate(BODY_W - 0.02, wallH + 0.06, 0.05, LENS_R + 0.05, FOLD_X, LENS_Y, shellMat);
  frontPlate.position.set(0, wallY, BODY_D / 2 - 0.025);
  shell.add(frontPlate);
  shellDim.push(frontPlate);

  // vents: intake down the left flank, exhaust down the right
  const intake = ventPanel(0.5, wallH * 0.72, 7, shellMat, materials.rubber(0x0a0b0d));
  intake.position.set(-BODY_W / 2 - 0.004, wallY, -0.36);
  intake.rotation.y = Math.PI;
  shell.add(intake);
  const exhaust = ventPanel(0.44, wallH * 0.72, 7, shellMat, materials.rubber(0x0a0b0d));
  exhaust.position.set(BODY_W / 2 + 0.004, wallY, 0.28);
  shell.add(exhaust);
  intake.traverse((o) => o.isMesh && shellDim.push(o));
  exhaust.traverse((o) => o.isMesh && shellDim.push(o));

  // lamp-door panel on the lid, with its captive screw — the one part of a
  // projector a user is ever meant to open
  const lampDoor = beveledBox(0.62, 0.02, 0.5, materials.polymer(0x1d2026), 0.012);
  lampDoor.position.set(-0.72, BODY_H / 2 + 0.005, 0.16);
  shell.add(lampDoor);
  shellDim.push(lampDoor);
  const doorScrew = new THREE.Mesh(new THREE.CylinderGeometry(0.028, 0.028, 0.022, 12), boltMat);
  doorScrew.position.set(-0.72, BODY_H / 2 + 0.022, -0.02);
  shell.add(doorScrew);
  shellDim.push(doorScrew);

  // control cluster + status LEDs on the lid
  const btnMat = materials.polymer(0x3a4049);
  const btnGeo = new THREE.CylinderGeometry(0.038, 0.04, 0.018, 18);
  for (let i = 0; i < 5; i++) {
    const btn = new THREE.Mesh(btnGeo, btnMat);
    btn.position.set(0.44 + i * 0.11, BODY_H / 2 + 0.004, -0.6);
    shell.add(btn);
    shellDim.push(btn);
  }
  const powerLed = new THREE.Mesh(new THREE.SphereGeometry(0.02, 12, 10), ledMat);
  powerLed.position.set(0.3, BODY_H / 2 + 0.004, -0.6);
  shell.add(powerLed);
  // IR receiver window on the front plate
  const irWindow = beveledBox(0.1, 0.05, 0.014, materials.rubber(0x101216), 0.006);
  irWindow.position.set(-0.62, LENS_Y - 0.02, BODY_D / 2 + 0.006);
  shell.add(irWindow);
  shellDim.push(irWindow);

  // ==========================================================================
  //  OPTICAL TRAIN — lamp → integrator → colour wheel → condenser → fold
  // ==========================================================================
  const optics = new THREE.Group();
  chassis.add(optics);

  // --- lamp module: elliptical reflector + UHP arc capsule ------------------
  const lampModule = new THREE.Group();
  lampModule.position.set(REFL_APEX_X, OPT_Y, OPT_Z);
  optics.add(lampModule);

  // Radius must keep FLARING all the way to the mouth. An earlier profile
  // levelled off over its last third and the whole part read as a plain
  // cylinder rather than as a bowl.
  const reflProfile = [
    [0.02, 0],
    [0.05, 0.018],
    [0.08, 0.048],
    [0.108, 0.088],
    [0.132, 0.14],
    [0.155, 0.205],
    [REFL_R, REFL_DEPTH],
  ];
  // Sector cutaway, the same convention as the jet-engine casings: a closed
  // bowl's own near wall hides the arc burning at its focus from every angle
  // that also shows the beam leaving the mouth. The wedge is cut toward the
  // camera side (up and +Z) so the step-3 camera looks straight in at the arc.
  // Solid from 20° to 280°; the missing 100° opens on (+Y, +Z).
  const REFL_PHI0 = deg(20);
  const REFL_PHI_LEN = deg(260);
  function reflShell(profile, mat) {
    const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
    const geo = new THREE.LatheGeometry(pts, 40, REFL_PHI0, REFL_PHI_LEN);
    geo.rotateZ(-Math.PI / 2); // lathe axis Y → +X, mouth faces +X
    const mesh = new THREE.Mesh(geo, mat);
    mesh.castShadow = true;
    return mesh;
  }
  const reflector = reflShell(reflProfile, reflectorMat);
  lampModule.add(reflector);
  // dark backing shell, so from outside the lamp reads as a housing
  const reflBack = reflShell(
    reflProfile.map(([r, y]) => [r + 0.014, y]),
    materials.polymer(0x15171b),
  );
  reflBack.material.side = THREE.DoubleSide;
  lampModule.add(reflBack);

  const arcCapsule = new THREE.Mesh(new THREE.SphereGeometry(0.055, 20, 14), quartzMat);
  arcCapsule.scale.set(1.5, 1, 1);
  arcCapsule.position.x = ARC_X - REFL_APEX_X;
  lampModule.add(arcCapsule);
  const arcSeal = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.16, 12), quartzMat);
  arcSeal.rotation.z = Math.PI / 2;
  arcSeal.position.x = ARC_X - REFL_APEX_X - 0.11;
  lampModule.add(arcSeal);
  // the arc itself — a 1 mm gap between two tungsten electrodes
  const arcGlow = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 12), materials.glow(0xfff2d0, 2.4));
  arcGlow.scale.set(1.8, 1, 1);
  arcGlow.position.x = ARC_X - REFL_APEX_X;
  lampModule.add(arcGlow);
  const arcHalo = new THREE.Mesh(
    new THREE.SphereGeometry(0.052, 16, 12),
    beamMaterial(0xffeec4, 0.22),
  );
  arcHalo.position.x = ARC_X - REFL_APEX_X;
  lampModule.add(arcHalo);
  for (const s of [-1, 1]) {
    const electrode = new THREE.Mesh(new THREE.CylinderGeometry(0.009, 0.014, 0.06, 10), materials.darkMetal(0x6a6f76));
    electrode.rotation.z = Math.PI / 2;
    electrode.position.x = ARC_X - REFL_APEX_X + s * 0.05;
    lampModule.add(electrode);
  }
  // the wire bail every replaceable lamp cartridge is lifted out by
  const bail = new THREE.Mesh(new THREE.TorusGeometry(0.13, 0.011, 8, 28, Math.PI), materials.brushedSteel(0xa5acb5));
  bail.position.set(0.12, 0.15, 0);
  bail.rotation.y = Math.PI / 2;
  lampModule.add(bail);

  // --- light integrator rod ------------------------------------------------
  const rodLen = ROD_X1 - ROD_X0;
  const integrator = beveledBox(rodLen, 0.09, 0.09, rodGlassMat, 0.006);
  integrator.position.set((ROD_X0 + ROD_X1) / 2, OPT_Y, OPT_Z);
  optics.add(integrator);
  // slim collars, not blocks: fatter mounts swallowed the glass rod entirely
  for (const rx of [ROD_X0 + 0.015, ROD_X1 - 0.015]) {
    const collar = beveledBox(0.022, 0.115, 0.115, bracketMat, 0.006);
    collar.position.set(rx, OPT_Y, OPT_Z);
    optics.add(collar);
  }
  const rodPost = rod(0.02, Math.abs(OPT_Y - 0.09 - FLOOR_Y), bracketMat, 10);
  rodPost.position.set((ROD_X0 + ROD_X1) / 2, FLOOR_Y, OPT_Z);
  optics.add(rodPost);

  // --- colour wheel ---------------------------------------------------------
  const wheelPivot = new THREE.Group();
  wheelPivot.position.set(WHEEL_X, OPT_Y + WHEEL_OFFSET, OPT_Z);
  optics.add(wheelPivot);
  const wheelDisc = new THREE.Group(); // this is what spins
  wheelPivot.add(wheelDisc);

  const segMeshes = [];
  for (let k = 0; k < SEG_COUNT; k++) {
    const geo = new THREE.CylinderGeometry(
      WHEEL_R,
      WHEEL_R,
      0.014,
      26,
      1,
      false,
      (k * TAU) / SEG_COUNT,
      TAU / SEG_COUNT,
    );
    geo.rotateZ(-Math.PI / 2); // disc axis → +X, so θ lands at (0, −r sinθ, r cosθ)
    const mat = new THREE.MeshPhysicalMaterial({
      color: SEG_HEX[k],
      metalness: 0.1,
      roughness: 0.12,
      transparent: true,
      opacity: 0.46, // a dichroic filter is coated GLASS, not painted plastic
      depthWrite: false,
      side: THREE.DoubleSide,
      emissive: SEG_HEX[k],
      emissiveIntensity: 0.13,
    });
    const seg = new THREE.Mesh(geo, mat);
    wheelDisc.add(seg);
    segMeshes.push(seg);
  }
  const wheelRim = new THREE.Mesh(new THREE.TorusGeometry(WHEEL_R, 0.009, 8, 44), materials.darkMetal(0x4a5058));
  wheelRim.rotation.y = Math.PI / 2;
  wheelDisc.add(wheelRim);
  const wheelHub = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.03, 20), wheelHubMat);
  wheelHub.rotation.z = Math.PI / 2;
  wheelDisc.add(wheelHub);
  const wheelBalance = boltCircle(3, 0.038, 0.008, boltMat, 0.014);
  wheelBalance.rotation.z = Math.PI / 2;
  wheelBalance.position.x = -0.02;
  wheelDisc.add(wheelBalance);

  const wheelMotor = new THREE.Mesh(new THREE.CylinderGeometry(0.075, 0.075, 0.12, 22), motorMat);
  wheelMotor.rotation.z = Math.PI / 2;
  wheelMotor.position.x = -0.09;
  wheelPivot.add(wheelMotor);
  const motorPost = rod(0.022, Math.abs(OPT_Y + WHEEL_OFFSET - FLOOR_Y) - 0.08, bracketMat, 10);
  motorPost.position.set(WHEEL_X - 0.09, FLOOR_Y, OPT_Z);
  optics.add(motorPost);
  // the index sensor that tells the electronics which segment is in the beam
  const wheelSensor = beveledBox(0.05, 0.04, 0.03, materials.polymer(0x101216), 0.006);
  wheelSensor.position.set(WHEEL_X + 0.06, OPT_Y + WHEEL_OFFSET + WHEEL_R - 0.02, OPT_Z);
  optics.add(wheelSensor);

  // --- condenser + fold mirror ---------------------------------------------
  const condenser = lensElement(0.13, 0.05, condenserMat, 'x');
  condenser.position.set(COND_X, OPT_Y, OPT_Z);
  optics.add(condenser);
  const condRing = new THREE.Mesh(new THREE.TorusGeometry(0.132, 0.012, 8, 30), materials.darkMetal(0x3a3f46));
  condRing.rotation.y = Math.PI / 2;
  condRing.position.set(COND_X, OPT_Y, OPT_Z);
  optics.add(condRing);

  // The fold mirror's normal must bisect the incoming (+X) and outgoing
  // (ILLUM_DIR) rays — computed, not eyeballed, so the 24° geometry survives.
  const foldNormal = ILLUM_DIR.clone().sub(new THREE.Vector3(1, 0, 0)).normalize();
  const foldMirror = new THREE.Mesh(new THREE.BoxGeometry(0.26, 0.22, 0.012), foldMirrorMat);
  foldMirror.position.copy(FOLD_P);
  foldMirror.lookAt(FOLD_P.clone().add(foldNormal));
  optics.add(foldMirror);
  const foldBack = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.26, 0.02), materials.darkMetal(0x2c3037));
  foldBack.position.copy(FOLD_P).addScaledVector(foldNormal, -0.016);
  foldBack.quaternion.copy(foldMirror.quaternion);
  optics.add(foldBack);
  const foldPost = rod(0.022, Math.abs(FOLD_P.y - 0.14 - FLOOR_Y), bracketMat, 10);
  foldPost.position.set(FOLD_P.x, FLOOR_Y, FOLD_P.z);
  optics.add(foldPost);

  // ==========================================================================
  //  DMD BOARD + LIGHT DUMP
  // ==========================================================================
  const dmdBoard = new THREE.Group();
  dmdBoard.position.copy(DMD_P);
  chassis.add(dmdBoard);

  const dmdPcb = beveledBox(0.42, 0.36, 0.02, pcbMat, 0.008);
  dmdPcb.position.z = -0.045;
  dmdBoard.add(dmdPcb);
  // at body scale the package needs its real metal lid to read at all — the
  // macro insert is where the black ceramic body gets its close-up
  const dmdPackage = beveledBox(0.24, 0.2, 0.05, materials.brushedSteel(0xa9b0b9), 0.008);
  dmdPackage.position.z = -0.008;
  dmdBoard.add(dmdPackage);
  // the real active area is 16:9 and tiny — that IS the point of the macro
  const dmdFace = beveledBox(0.16, 0.09, 0.008, dmdFaceMat, 0.002);
  dmdFace.position.z = 0.021;
  dmdBoard.add(dmdFace);
  const dmdWindow = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.14, 0.006), materials.glass(0xe8f0ff, 0.14));
  dmdWindow.position.z = 0.03;
  dmdBoard.add(dmdWindow);
  for (const s of [-1, 1]) {
    const clip = beveledBox(0.03, 0.2, 0.03, materials.brushedSteel(0xa2a9b2), 0.006);
    clip.position.set(s * 0.14, 0, 0.01);
    dmdBoard.add(clip);
  }
  const dmdSink = new THREE.Group();
  dmdSink.position.z = -0.08;
  dmdBoard.add(dmdSink);
  const sinkBase = beveledBox(0.34, 0.3, 0.03, heatsinkMat, 0.006);
  dmdSink.add(sinkBase);
  for (let i = 0; i < 9; i++) {
    const fin = beveledBox(0.02, 0.3, 0.14, heatsinkMat, 0.004);
    fin.position.set(-0.15 + i * 0.0375, 0, -0.085);
    dmdSink.add(fin);
  }
  dmdBoard.add(dmdSink);

  const dumpBlock = new THREE.Group();
  dumpBlock.position.copy(DUMP_P);
  chassis.add(dumpBlock);
  const dumpBody = beveledBox(0.26, 0.1, 0.22, dumpMat, 0.012);
  dumpBlock.add(dumpBody);
  for (let i = 0; i < 7; i++) {
    const rib = beveledBox(0.24, 0.016, 0.016, dumpMat, 0.004);
    rib.position.set(0, -0.05, -0.09 + i * 0.03);
    dumpBlock.add(rib);
  }

  // ==========================================================================
  //  PROJECTION LENS
  // ==========================================================================
  const lensGroup = new THREE.Group();
  lensGroup.position.set(FOLD_X, LENS_Y, 0);
  chassis.add(lensGroup);

  // mount flange + bracket: without it the barrel reads as floating loose
  // beside the chassis as soon as the shell ghosts back
  const mountFlange = new THREE.Mesh(new THREE.TorusGeometry(LENS_R + 0.055, 0.03, 10, 36), mountMat);
  mountFlange.position.z = LENS_Z0 + 0.03;
  lensGroup.add(mountFlange);
  const mountFoot = beveledBox(0.34, 0.06, 0.2, mountMat, 0.012);
  mountFoot.position.set(0, -LENS_R - 0.05, LENS_Z0 + 0.05);
  lensGroup.add(mountFoot);
  const mountLeg = rod(0.028, Math.abs(LENS_Y - LENS_R - 0.06 - FLOOR_Y), mountMat, 12);
  mountLeg.position.set(FOLD_X, FLOOR_Y, LENS_Z0 + 0.05);
  chassis.add(mountLeg);

  const barrelLen = LENS_Z1 - LENS_Z0;
  const barrelGeo = new THREE.CylinderGeometry(LENS_R, LENS_R, barrelLen, 40, 1, true);
  barrelGeo.rotateX(Math.PI / 2);
  const barrel = new THREE.Mesh(barrelGeo, barrelMat);
  barrel.position.z = (LENS_Z0 + LENS_Z1) / 2;
  barrel.castShadow = true;
  lensGroup.add(barrel);
  // dark rough liner: never leave a concave metal interior looking down a tube
  const linerGeo = new THREE.CylinderGeometry(LENS_R - 0.012, LENS_R - 0.012, barrelLen - 0.01, 40, 1, true);
  linerGeo.rotateX(Math.PI / 2);
  const liner = new THREE.Mesh(linerGeo, new THREE.MeshStandardMaterial({ color: 0x0b0c0e, roughness: 0.95, side: THREE.BackSide }));
  liner.position.z = (LENS_Z0 + LENS_Z1) / 2;
  lensGroup.add(liner);

  const focusRing = new THREE.Mesh(new THREE.CylinderGeometry(LENS_R + 0.03, LENS_R + 0.03, 0.11, 48, 1, true), ringMat);
  focusRing.rotation.x = Math.PI / 2;
  focusRing.position.z = 0.95;
  lensGroup.add(focusRing);
  for (let i = 0; i < 36; i++) {
    const a = (i * TAU) / 36;
    const knurl = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.09, 0.012), ringMat);
    knurl.position.set(Math.cos(a) * (LENS_R + 0.032), Math.sin(a) * (LENS_R + 0.032), 0.95);
    knurl.rotation.z = a;
    lensGroup.add(knurl);
  }
  const frontBezel = new THREE.Mesh(new THREE.TorusGeometry(LENS_R - 0.005, 0.018, 10, 44), bezelMat);
  frontBezel.position.z = LENS_Z1 - 0.01;
  lensGroup.add(frontBezel);

  const frontElement = lensElement(LENS_R - 0.03, 0.09, frontElementMat, 'z');
  frontElement.position.z = LENS_Z1 - 0.05;
  lensGroup.add(frontElement);
  for (const [ez, er] of [
    [0.52, LENS_R - 0.05],
    [0.72, LENS_R - 0.04],
  ]) {
    const el = lensElement(er, 0.07, innerElementMat, 'z');
    el.position.z = ez;
    lensGroup.add(el);
    const spacer = new THREE.Mesh(new THREE.TorusGeometry(er + 0.012, 0.01, 8, 30), materials.darkMetal(0x26292e));
    spacer.position.z = ez;
    lensGroup.add(spacer);
  }

  // ==========================================================================
  //  COOLING + POWER (greebles that make it read as a real machine)
  // ==========================================================================
  const blower = new THREE.Group();
  // back-left corner, well clear of the lamp: parked at the front it sat
  // directly between the step-3/4 cameras and the reflector
  blower.position.set(-0.82, -0.22, -0.38);
  chassis.add(blower);
  const cageTop = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.012, 28), materials.polymer(0x2b2f35));
  cageTop.position.y = 0.08;
  const cageBottom = cageTop.clone();
  cageBottom.position.y = -0.08;
  const cageSpin = new THREE.Group();
  blower.add(cageSpin);
  cageSpin.add(cageTop, cageBottom);
  const vaneMat = materials.polymer(0x3b4048); // shared: 22 vanes, one material
  const vaneGeo = new THREE.BoxGeometry(0.03, 0.15, 0.012);
  for (let i = 0; i < 22; i++) {
    const a = (i * TAU) / 22;
    const vane = new THREE.Mesh(vaneGeo, vaneMat);
    vane.position.set(Math.cos(a) * 0.155, 0, Math.sin(a) * 0.155);
    vane.rotation.y = -a + 0.5;
    cageSpin.add(vane);
  }
  const blowerHousing = new THREE.Mesh(new THREE.TorusGeometry(0.185, 0.03, 8, 30), materials.polymer(0x22252a));
  blowerHousing.rotation.x = Math.PI / 2;
  blower.add(blowerHousing);

  const psu = beveledBox(0.5, 0.24, 0.34, psuMat, 0.016);
  psu.position.set(-0.3, -0.2, -0.55);
  chassis.add(psu);
  const ballast = beveledBox(0.3, 0.16, 0.26, materials.darkMetal(0x2e3238), 0.012);
  ballast.position.set(0.15, -0.24, -0.62);
  chassis.add(ballast);
  const capMat = materials.darkMetal(0x1f2227);
  const capGeo = new THREE.CylinderGeometry(0.028, 0.028, 0.08, 14);
  for (let i = 0; i < 4; i++) {
    const cap = new THREE.Mesh(capGeo, capMat);
    cap.position.set(-0.46 + i * 0.07, -0.04, -0.55);
    chassis.add(cap);
  }
  const inletSocket = beveledBox(0.14, 0.11, 0.06, materials.polymer(0x141619), 0.008);
  inletSocket.position.set(-0.85, -0.16, -BODY_D / 2 + 0.05);
  chassis.add(inletSocket);
  const hdmiPort = beveledBox(0.13, 0.05, 0.05, materials.brushedSteel(0x9aa1aa), 0.006);
  hdmiPort.position.set(-0.6, -0.16, -BODY_D / 2 + 0.05);
  chassis.add(hdmiPort);

  // ==========================================================================
  //  LIGHT PATH — one chain of beam segments, white before the wheel and
  //  the wheel's current colour after it
  // ==========================================================================
  const P_ARC = new THREE.Vector3(ARC_X, OPT_Y, OPT_Z);
  const P_ROD0 = new THREE.Vector3(ROD_X0, OPT_Y, OPT_Z);
  const P_ROD1 = new THREE.Vector3(ROD_X1, OPT_Y, OPT_Z);
  const P_WHEEL = new THREE.Vector3(WHEEL_X, OPT_Y, OPT_Z);
  const P_COND = new THREE.Vector3(COND_X, OPT_Y, OPT_Z);
  const P_LENS_REAR = new THREE.Vector3(FOLD_X, LENS_Y, LENS_Z0);

  const whiteMats = [];
  const colourMats = [];
  const beams = new THREE.Group();
  chassis.add(beams);

  function addBeam(a, b, r0, r1, hex, opacity, bucket) {
    const mat = beamMaterial(hex, opacity);
    mat.userData.base = opacity;
    const mesh = beamMesh(a, b, r0, r1, mat);
    beams.add(mesh);
    bucket.push(mat);
    return mesh;
  }
  // Kept deliberately thin and faint. Fatter tubes stop reading as light and
  // start reading as white plastic ducting bolted between the components.
  addBeam(P_ARC, P_ROD0, 0.055, 0.038, 0xfff3d8, 0.13, whiteMats);
  addBeam(P_ROD0, P_ROD1, 0.03, 0.03, 0xfff6e4, 0.18, whiteMats);
  addBeam(P_ROD1, P_WHEEL, 0.038, 0.038, 0xfff3d8, 0.15, whiteMats);
  addBeam(P_WHEEL, P_COND, 0.038, 0.038, 0xffffff, 0.2, colourMats);
  addBeam(P_COND, FOLD_P, 0.038, 0.036, 0xffffff, 0.2, colourMats);
  addBeam(FOLD_P, DMD_P, 0.036, 0.042, 0xffffff, 0.22, colourMats);

  const onBeamMat = beamMaterial(0xffffff, 0.24);
  const onBeam = beamMesh(DMD_P, P_LENS_REAR, 0.042, 0.05, onBeamMat);
  beams.add(onBeam);
  const offBeamMat = beamMaterial(0x7d838c, 0.16);
  const offBeam = beamMesh(DMD_P, DUMP_P, 0.038, 0.038, offBeamMat);
  beams.add(offBeam);

  // The beam leaving the lens. ONE cone carrying a per-vertex alpha ramp, not
  // a stack of shells at stepped opacities: stacked shells put a hard seam at
  // every boundary, which rendered as concentric bands across the beam. It is
  // WARM WHITE, not the wheel's instantaneous colour — by the time the light
  // is in the room the eye has already fused the sequence, which is exactly
  // what step 7 is about.
  const THROW_Z0 = 1.06;
  const THROW_Z1 = 2.7;
  const throwGeo = new THREE.CylinderGeometry(0.72, 0.19, THROW_Z1 - THROW_Z0, 48, 24, true);
  throwGeo.rotateX(Math.PI / 2); // cylinder axis +Y → +Z, wide end forward
  throwGeo.translate(0, 0, (THROW_Z0 + THROW_Z1) / 2);
  {
    const pos = throwGeo.attributes.position;
    const rgba = [];
    for (let i = 0; i < pos.count; i++) {
      const t = clamp01((pos.getZ(i) - THROW_Z0) / (THROW_Z1 - THROW_Z0));
      rgba.push(1, 1, 1, Math.pow(1 - t, 1.7));
    }
    throwGeo.setAttribute('color', new THREE.Float32BufferAttribute(rgba, 4));
  }
  const throwMat = new THREE.MeshBasicMaterial({
    color: 0xfff4de,
    vertexColors: true, // itemSize 4 ⇒ three reads the alpha channel too
    transparent: true,
    opacity: 0.16,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  throwMat.userData.base = 0.16;
  const throwCone = new THREE.Mesh(throwGeo, throwMat);
  throwCone.position.set(FOLD_X, LENS_Y, 0);
  chassis.add(throwCone);

  // ==========================================================================
  //  MACRO INSERT — the DMD, blown up until the mechanism is visible
  // ==========================================================================
  const macro = new THREE.Group();
  macro.position.set(0.6, 2.02, 0.12);
  // Turned well off-axis on purpose. The "on" ray fan leaves along the chip's
  // own normal, so a camera square to the array would be looking straight
  // down that fan with the lens marker parked over the mirrors. Viewed at
  // ~40° instead, the fan and its lens sit to one side AND the mirror tilt
  // reads as tilt rather than as a flat grid.
  macro.rotation.set(0.14, 0.72, 0);
  group.add(macro);

  const macPackage = beveledBox(MARRAY_W + 0.34, MARRAY_H + 0.34, 0.12, packageMat, 0.02);
  macPackage.position.z = -0.09;
  macro.add(macPackage);
  const macDie = beveledBox(MARRAY_W + 0.1, MARRAY_H + 0.1, 0.04, new THREE.MeshPhysicalMaterial({ color: 0x2b3038, metalness: 0.35, roughness: 0.5 }), 0.008);
  macDie.position.z = -0.025;
  macro.add(macDie);
  // gold bond wires along two edges of the die — the giveaway that this is a
  // packaged silicon chip and not a mirror tile
  for (let i = 0; i < 16; i++) {
    const t = -0.5 + (i + 0.5) / 16;
    for (const s of [-1, 1]) {
      const wire = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.006, 6, 14, Math.PI), goldMat);
      wire.position.set(t * MARRAY_W, s * (MARRAY_H / 2 + 0.1), -0.01);
      wire.rotation.set(Math.PI / 2, 0, 0);
      macro.add(wire);
    }
  }

  // the CMOS memory cell under every mirror — a dark grid the mirrors sit on
  const cellGeo = new THREE.PlaneGeometry(MPITCH * 0.94, MPITCH * 0.94);
  const cellMat = new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.82, metalness: 0.2 });
  const cells = new THREE.InstancedMesh(cellGeo, cellMat, MX * MY);
  const macMirrorGeo = new THREE.BoxGeometry(MSIZE, MSIZE, 0.006);
  // Not a perfect mirror: at the oblique angle these are viewed from, chrome
  // reflects the dark studio surround and the array goes black. Backing off
  // metalness and roughening it keeps every mirror legible as a mirror.
  const macMirrorMat = new THREE.MeshPhysicalMaterial({ color: 0xeff2f6, metalness: 0.82, roughness: 0.24 });
  const mirrors = new THREE.InstancedMesh(macMirrorGeo, macMirrorMat, MX * MY);
  mirrors.castShadow = true;
  // Per-mirror instance colour, driven from the SAME on/off value as the
  // tilt. A mirror aimed at the lens is a mirror you are looking down the
  // light of; one aimed at the dump is not. Without it the ±12° swing is a
  // few degrees of shading and the mechanism is invisible at any sane
  // viewing angle — this is what makes the array read at a glance.
  {
    const seed = new THREE.Color(0xffffff);
    for (let i = 0; i < MX * MY; i++) mirrors.setColorAt(i, seed);
  }
  // the torsion hinge post each mirror pivots on, visible in the gaps
  const postGeo = new THREE.CylinderGeometry(0.006, 0.008, 0.026, 6);
  postGeo.rotateX(Math.PI / 2);
  const posts = new THREE.InstancedMesh(postGeo, materials.darkMetal(0x565c65), MX * MY);
  macro.add(cells, posts, mirrors);

  const mirrorPos = [];
  {
    const m = new THREE.Matrix4();
    for (let r = 0; r < MY; r++) {
      for (let c = 0; c < MX; c++) {
        const i = r * MX + c;
        const px = -MARRAY_W / 2 + (c + 0.5) * MPITCH;
        const py = -MARRAY_H / 2 + (r + 0.5) * MPITCH;
        mirrorPos.push(new THREE.Vector3(px, py, 0.028));
        m.makeTranslation(px, py, 0.001);
        cells.setMatrixAt(i, m);
        m.makeTranslation(px, py, 0.014);
        posts.setMatrixAt(i, m);
      }
    }
    cells.instanceMatrix.needsUpdate = true;
    posts.instanceMatrix.needsUpdate = true;
  }

  // --- the two destinations the light can go: lens, or black hole ----------
  const macLens = new THREE.Group();
  macLens.position.copy(MAC_LENS);
  macro.add(macLens);
  const macLensRing = new THREE.Mesh(new THREE.TorusGeometry(0.17, 0.024, 12, 36), bezelMat);
  macLens.add(macLensRing);
  const macLensGlass = new THREE.Mesh(new THREE.CircleGeometry(0.17, 32), materials.glass(0xdbe8ff, 0.18));
  macLens.add(macLensGlass);

  const macDump = new THREE.Group();
  macDump.position.copy(MAC_DUMP);
  macDump.lookAt(new THREE.Vector3(0, 0, 0));
  macro.add(macDump);
  // A true light dump is matte black, which against a dark studio surround is
  // an invisible hole where a labelled part should be. Anodised charcoal with
  // a machined aluminium collar keeps it findable while still reading as the
  // thing that swallows light.
  const macDumpMat = materials.rubber(0x1d2126);
  const macDumpBody = beveledBox(0.34, 0.28, 0.1, macDumpMat, 0.012);
  macDump.add(macDumpBody);
  for (let i = 0; i < 6; i++) {
    const rib = beveledBox(0.32, 0.018, 0.05, macDumpMat, 0.005);
    rib.position.set(0, -0.12 + i * 0.048, 0.06);
    macDump.add(rib);
  }
  const macDumpCollar = new THREE.Mesh(new THREE.TorusGeometry(0.2, 0.018, 8, 4), materials.brushedSteel(0x8d949d));
  macDumpCollar.rotation.z = Math.PI / 4;
  macDumpCollar.position.z = 0.05;
  macDump.add(macDumpCollar);

  // --- macro rays: one per sampled mirror, so a single pixel's light can be
  // followed all the way to whichever destination its bit chose --------------
  const SAMPLES = Array.from({ length: SAMPLE_COUNT }, (_, k) => (k * 19 + 24) % (MX * MY));
  const sampleRays = SAMPLES.map((i) => {
    const p = mirrorPos[i];
    const inMat = beamMaterial(0xfff2d8, 0.3);
    const onMat = beamMaterial(0xffffff, 0.5);
    const offMat = beamMaterial(0x6d7684, 0.34);
    const inRay = beamMesh(p.clone().addScaledVector(MAC_ILLUM_DIR, -0.48), p, 0.005, 0.005, inMat, 6);
    const onRay = beamMesh(p, MAC_LENS.clone(), 0.005, 0.005, onMat, 6);
    const offRay = beamMesh(p, MAC_DUMP.clone(), 0.005, 0.005, offMat, 6);
    macro.add(inRay, onRay, offRay);
    return { index: i, inMat, onMat, offMat };
  });

  // --- "what your eye adds up" comparison patch ---------------------------
  const composite = new THREE.Group();
  composite.position.set(0, MARRAY_H / 2 + 0.38, 0.05);
  macro.add(composite);
  const compBack = beveledBox(MARRAY_W * 0.9 + 0.08, MARRAY_H * 0.9 + 0.08, 0.03, materials.polymer(0x121418), 0.01);
  composite.add(compBack);
  const compGeo = new THREE.PlaneGeometry(MPITCH * 0.86, MPITCH * 0.86);
  const compMesh = new THREE.InstancedMesh(compGeo, new THREE.MeshBasicMaterial(), MX * MY);
  composite.add(compMesh);
  {
    const m = new THREE.Matrix4();
    const col = new THREE.Color();
    for (let r = 0; r < MY; r++) {
      for (let c = 0; c < MX; c++) {
        const i = r * MX + c;
        m.makeTranslation(
          (-MARRAY_W / 2 + (c + 0.5) * MPITCH) * 0.9,
          (-MARRAY_H / 2 + (r + 0.5) * MPITCH) * 0.9,
          0.018,
        );
        compMesh.setMatrixAt(i, m);
        const [r0, g0, b0] = imageRGB(c, r);
        col.setRGB(r0, g0, b0);
        compMesh.setColorAt(i, col);
      }
    }
    compMesh.instanceMatrix.needsUpdate = true;
    compMesh.instanceColor.needsUpdate = true;
  }

  // ==========================================================================
  //  CALLOUTS
  // ==========================================================================
  const labels = calloutSets(['exterior', 'optics', 'lamp', 'wheel', 'chip', 'tilt', 'colour']);

  labels.add('exterior', lensGroup, 'Projection lens', [0, LENS_R + 0.02, 0.98], 55, 84);
  labels.add('exterior', shell, 'Focus ring', [FOLD_X + LENS_R, LENS_Y - 0.12, 0.95], -35, 78);
  // both aimed up-and-right: these two sit on the left of the composed frame,
  // and a left-leaning leader carries the pill into the text panel
  labels.add('exterior', shell, 'Exhaust vent', [BODY_W / 2, wallY, 0.28], 42, 96);
  labels.add('exterior', shell, 'Lamp door', [-0.72, BODY_H / 2 + 0.03, 0.16], 68, 92);
  labels.add('exterior', chassis, 'Adjustable foot', [0, -BODY_H / 2 - 0.04, 0.72], -32, 122);

  // The lamp end of the train projects into the text panel's left third on
  // every wide shot, so these two leaders reach RIGHT and long to carry their
  // pills clear of it (verify.mjs's label-visibility gate enforces this).
  labels.add('optics', lampModule, 'Arc lamp + reflector', [0.2, 0.2, 0], 24, 150);
  labels.add('optics', optics, 'Integrator rod', [(ROD_X0 + ROD_X1) / 2, OPT_Y + 0.07, OPT_Z], 44, 124);
  labels.add('optics', wheelPivot, 'Colour wheel', [0, WHEEL_R - 0.03, 0], 70, 80);
  labels.add('optics', optics, 'Fold mirror', [FOLD_P.x, FOLD_P.y - 0.09, FOLD_P.z], -50, 82);
  labels.add('optics', dmdBoard, 'DMD chip', [0, 0.14, 0.02], 75, 88);
  labels.add('optics', lensGroup, 'Projection lens', [0, LENS_R - 0.02, LENS_Z1 - 0.06], 25, 92);

  labels.add('lamp', lampModule, 'Arc gap — about 1 mm', [ARC_X - REFL_APEX_X, 0.07, 0], 80, 82);
  labels.add('lamp', lampModule, 'Elliptical reflector', [0.2, -0.12, 0.06], -50, 88);
  labels.add('lamp', optics, 'Integrator rod — evens the beam out', [(ROD_X0 + ROD_X1) / 2, OPT_Y - 0.06, OPT_Z], -40, 96);

  labels.add('wheel', wheelPivot, 'Dichroic filter segments', [0.03, WHEEL_R - 0.04, 0.02], 65, 96);
  labels.add('wheel', wheelPivot, 'Brushless spindle', [-0.11, -0.02, 0], -18, 128);
  labels.add('wheel', optics, 'Beam is one colour at a time', [COND_X - 0.08, OPT_Y - 0.04, OPT_Z], -40, 104);

  labels.add('chip', macro, 'One mirror = one pixel', [MARRAY_W * 0.06, MARRAY_H * 0.3, 0.06], 88, 74);
  labels.add('chip', macro, 'Torsion hinge on the diagonal', [MARRAY_W * 0.3, -MARRAY_H * 0.04, 0.05], -22, 96);
  labels.add('chip', macro, 'CMOS memory cell underneath', [MARRAY_W * 0.12, -MARRAY_H * 0.36, 0.01], -68, 96);
  labels.add('chip', macro, 'Gold bond wires', [-MARRAY_W * 0.22, MARRAY_H / 2 + 0.1, 0], 132, 70);

  labels.add('tilt', macro, '−12° — straight down the lens', [MARRAY_W * 0.1, MARRAY_H * 0.3, 0.06], 62, 96);
  labels.add('tilt', macLens, 'Projection lens', [0, 0.2, 0], 65, 74);
  labels.add('tilt', macDump, 'Light dump — +12° ends here', [0, -0.16, 0.06], -60, 92);

  labels.add('colour', macro, 'Mirrors drawing one colour separation', [MARRAY_W * 0.18, -MARRAY_H * 0.2, 0.06], -35, 104);
  labels.add('colour', composite, 'What your eye adds up', [0, MARRAY_H * 0.36 + 0.05, 0.02], 70, 86);

  // ==========================================================================
  //  POSE
  // ==========================================================================
  const state = {
    spin: 0,
    reveal: 0,
    wheel: 0,
    fan: 0,
    pwm: 0,
    mode: 'pwm',
    channel: -1,
    beam: 1,
    macroOn: 0,
    compose: false,
  };

  const _mat = new THREE.Matrix4();
  const _rot = new THREE.Matrix4();
  const _col = new THREE.Color();
  // instanceColor is a plain float attribute, so an "on" value above 1 is
  // legal and is what actually makes a mirror aimed at the lens read as lit
  // rather than as merely a paler grey square
  const _onCol = new THREE.Color();
  const ON_GAIN = 1.7;
  const _offCol = new THREE.Color(0x23272d);
  const _mirrorCol = new THREE.Color();
  const sampleOn = new Float32Array(SAMPLES.length);
  let onFrac = 0.5;

  // `channel: 'auto'` locks the mirrors to whichever colour separation the
  // wheel is currently passing — the single scalar that ties the two halves
  // of the mechanism together for the colour step.
  function activeChannel() {
    return state.channel === 'auto' ? segmentAt(state.wheel) % 3 : state.channel;
  }

  // one mirror's on-value — the single source of truth for BOTH its tilt and
  // its brightness, so the two can never disagree
  function onAt(c, r, i, channel) {
    // 'wave': a slow binary ripple sweeping the array on the diagonal — still
    // only ever two states, just legible one mirror at a time
    if (state.mode === 'wave') return onValue(frac(state.pwm + c * 0.045 + r * 0.03), 0.5);
    return onValue(frac(state.pwm + seedAt(i)), dutyAt(c, r, channel));
  }

  function applyMirrors() {
    const channel = activeChannel();
    if (state.channel === 'auto') _onCol.copy(_col);
    else _onCol.setHex(0xfff6e6);
    _onCol.multiplyScalar(ON_GAIN);

    // Five of the eight steps hide the macro insert outright. Re-composing 140
    // instance matrices and re-uploading both instance buffers every frame for
    // an object nobody can see was by far the most expensive thing in this
    // scene; the body-scale beams only need `onFrac`, which a coarse sample
    // gives for a fraction of the cost.
    if (state.macroOn <= 0.5) {
      let coarse = 0;
      let n = 0;
      for (let i = 0; i < MX * MY; i += 7, n++) coarse += onAt(i % MX, (i / MX) | 0, i, channel);
      onFrac = coarse / n;
      return;
    }

    let sum = 0;
    for (let r = 0; r < MY; r++) {
      for (let c = 0; c < MX; c++) {
        const i = r * MX + c;
        const on = onAt(c, r, i, channel);
        sum += on;
        _rot.makeRotationAxis(HINGE_AXIS, TILT * (1 - 2 * on));
        _mat.copy(_rot);
        const p = mirrorPos[i];
        _mat.setPosition(p.x, p.y, p.z);
        mirrors.setMatrixAt(i, _mat);
        _mirrorCol.copy(_offCol).lerp(_onCol, on);
        mirrors.setColorAt(i, _mirrorCol);
      }
    }
    mirrors.instanceMatrix.needsUpdate = true;
    mirrors.instanceColor.needsUpdate = true;
    onFrac = sum / (MX * MY);
    for (let k = 0; k < SAMPLES.length; k++) {
      const i = SAMPLES[k];
      sampleOn[k] = onAt(i % MX, Math.floor(i / MX), i, channel);
    }
  }

  function apply() {
    group.rotation.y = state.spin;

    // --- reveal: lift the shell clear and ghost its walls -----------------
    const rv = clamp01(state.reveal);
    shell.position.y = rv * 0.5;
    // The four walls stay as a ghost so the product's silhouette survives the
    // teardown; the LID goes entirely. A lifted-but-still-drawn lid hangs
    // across the top of every internal shot and its underside reads as an
    // opaque slab no matter how far the opacity is pushed.
    lid.visible = rv < 0.5;
    const shellOpacity = 1 - rv * 0.7;
    for (const m of shellDim) {
      const mat = m.material;
      if (mat.userData.baseCoat === undefined) mat.userData.baseCoat = mat.clearcoat ?? 0;
      mat.transparent = rv > 0.02;
      mat.opacity = shellOpacity;
      mat.depthWrite = rv < 0.35;
      // coat specular ignores opacity — a ghosted panel keeps reading solid
      // until the clearcoat is zeroed outright
      mat.clearcoat = rv > 0.35 ? 0 : mat.userData.baseCoat;
      // and a ghosted panel still casts a FULLY OPAQUE shadow, which lands
      // across the internals as a dark trapezoid that looks like geometry
      m.castShadow = rv < 0.35;
    }
    powerLed.material.emissiveIntensity = 1.3 * (1 - rv * 0.7);

    // --- colour wheel -----------------------------------------------------
    wheelDisc.rotation.x = state.wheel;
    cageSpin.rotation.y = state.fan;
    const seg = segmentAt(state.wheel);
    const hex = SEG_HEX[seg];
    _col.setHex(hex);

    // --- mirrors ----------------------------------------------------------
    applyMirrors();

    // --- beams ------------------------------------------------------------
    const b = clamp01(state.beam);
    for (const mat of whiteMats) mat.opacity = mat.userData.base * b;
    for (const mat of colourMats) {
      mat.color.copy(_col);
      mat.opacity = mat.userData.base * b;
    }
    onBeamMat.color.copy(_col);
    onBeamMat.opacity = 0.24 * b * (0.25 + 0.75 * onFrac);
    offBeamMat.opacity = 0.18 * b * (0.25 + 0.75 * (1 - onFrac));
    throwMat.opacity = throwMat.userData.base * b;
    dmdFaceMat.emissive.copy(_col);
    dmdFaceMat.emissiveIntensity = 0.35 * b * onFrac;
    arcGlow.material.emissiveIntensity = 2.1 * (0.35 + 0.65 * b);
    reflectorMat.emissiveIntensity = 0.09 * (0.3 + 0.7 * b);

    // --- macro insert -----------------------------------------------------
    const on = state.macroOn > 0.5;
    macro.visible = on;
    composite.visible = on && state.compose;
    if (on) {
      // The rays only take the wheel's colour on the step that is ABOUT
      // colour. On the structure and tilt steps a chip washed entirely red
      // (or entirely blue) reads as a colour claim the copy isn't making yet.
      const tinted = state.channel === 'auto';
      for (let k = 0; k < SAMPLES.length; k++) {
        const v = sampleOn[k];
        const rays = sampleRays[k];
        if (tinted) {
          rays.inMat.color.copy(_col);
          rays.onMat.color.copy(_col);
        } else {
          rays.inMat.color.setHex(0xfff2d8);
          rays.onMat.color.setHex(0xfff6e6);
        }
        rays.onMat.opacity = 0.04 + 0.46 * v;
        rays.offMat.opacity = 0.05 + 0.4 * (1 - v);
      }
    }
  }

  apply();
  labels.setLabels(false);

  return {
    group: sceneGroup,
    state,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
    // which primary is in the beam right now — used by the video/narration
    // layer and handy when debugging the wheel's angular registration
    segmentName: (w) => SEG_NAMES[segmentAt(w)],
    parts: { body, shell, chassis, optics, wheelDisc, macro, mirrors, lensGroup, dmdBoard, cageSpin },
  };
}
