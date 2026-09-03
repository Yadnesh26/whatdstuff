import * as THREE from 'three';
import { materials, rod, disc, studioPlinth } from '../../framework/parts.js';
import { beveledBox, gear, boltCircle } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, TAU } from '../../framework/motion.js';

// A modern three-blade, upwind, horizontal-axis wind turbine of the ~4 MW
// onshore class (Vestas V150 / Siemens Gamesa SG145 territory), staged as a
// studio product shot on a plinth.
//
// MECHANISM (researched — US DOE "How a Wind Turbine Works", Wikipedia "Wind
// turbine design", Betz/tip-speed-ratio literature):
//   The blades are WINGS, not sails. Each section sees an apparent wind that
//   is the vector sum of the real wind (~12 m/s, axial) and its own motion
//   through the air (tangential, and far larger). That apparent wind produces
//   LIFT perpendicular to itself — mostly axial thrust into the tower, with a
//   smaller tangential slice that is the entire source of torque. Because the
//   blade's own speed grows with radius, the apparent wind arrives at a
//   shallower angle further out, which is why every blade is TWISTED: ~20 deg
//   of pitch at the root, a couple of degrees at the tip.
//   Blade lift/drag ratio reaches ~120 (a sailplane manages ~70). At the
//   design tip-speed ratio of 6-7 the tip runs ~80 m/s (~290 km/h) while the
//   rotor itself turns only 8-20 rpm.
//   Betz's law caps ANY open rotor at 59.3% of the wind's kinetic energy: take
//   more and the air would have to stop dead in the disc, which would block
//   the air behind it. Real rotors reach 45-50%. The slowed air leaving the
//   rotor must therefore spread out — the streamtube visibly EXPANDS
//   downstream, which is what the flow visual in step 3 draws.
//   The rotor's ~12 rpm is useless to a generator, so a gearbox steps it up
//   roughly 1:100 to ~1,500 rpm: a planetary first stage (fixed ring gear,
//   three planets on a carrier driven by the main shaft, output on the sun)
//   followed by two helical stages. The high-speed shaft carries a parking
//   brake disc into the generator — drawn here as the magnet-pole rotor of a
//   synchronous machine behind a full converter, the layout most new turbines
//   use — producing ~690 V, which goes through that converter, down a cable
//   inside the tower, into a step-up transformer at the base and to the grid.
//   Aiming is active: an anemometer and wind vane on the nacelle roof tell the
//   controller where the wind is, and yaw motors drive pinions around a big
//   ring gear on the tower top to keep the rotor square to it (power falls off
//   as cos^3 of the yaw error). Above the 25 m/s cut-out speed the pitch
//   system twists the blades edge-on — FEATHERING them — so they stop making
//   lift at all and the rotor coasts down.
//
// PROPORTIONS (all derived from one scale; ratios read off the V150 class):
//   hub height above ground H = 2.62 · rotor diameter = 1.35 * H (real
//   1.3-1.4) · blade length = 0.64 * H (real ~0.62) · tip clearance = 0.32 * H
//   (real ~0.29) · tower base dia = 0.044 * H · nacelle length = 0.13 * H.
//
// TWO SCALES, like fiber-optics: a true-proportion nacelle is 0.34 units long
// here, far too small to carry a premium macro shot, and shrinking the tower
// to fix that would wreck the silhouette. So the SAME drivetrain builder runs
// twice — once at true scale inside the nacelle, once at 5x as a floating
// cutaway insert that only appears for the drivetrain steps.
//
// SCALARS the pose is built from:
//   rotor      main-shaft angle (rad) — drives the whole drivetrain
//   reveal     0 sealed product / 1 covers ghosted + macro insert visible
//   flow       0-1 wind phase (wraps by construction)
//   windDir    wind direction (rad about the tower axis)
//   yaw        nacelle yaw angle (rad)
//   pitch      blade pitch added to the built-in twist (rad; ~1.4 = feathered)
//   sectionViz 0-1 the airfoil-section insert and its vector triangle
//   betz       0-1 the expanding streamtube surface
//   windViz    0-1 the wind streamline dots (own knob: mid-air dots read as
//              floating dust on any step that is not about the wind)
//   shellViz   0/1 the macro insert's nacelle cover (ghosted for the wide
//              drivetrain step, gone entirely for the two macro steps)
//   powerOn    0-1 the tower cable / transformer / grid current
//
// SEAMLESS LOOPS: `rotor` advances whole turns per lap and every geared part
// derives from it — sun = 3.5x (7 turns for 2), planets = -10/3 x (-6 2/3
// turns = exactly 120 tooth pitches on an 18-tooth planet, an invisible wrap),
// high-speed shaft = 7x (14 turns). `flow` is a 0-1 phase ridden with
// getPointAt. `yaw`/`windDir`/`pitch` are authored as periodic functions of
// the lap fraction, so their wrap is identical by construction.

const DEG = Math.PI / 180;

// ---- world layout (Y up, rotor axis along +Z, wind blowing toward -Z) -------
const PLINTH_H = 0.26;
const PED_H = 0.1; // concrete foundation pedestal
const BASE_Y = PLINTH_H + PED_H;
const TOWER_H = 2.45;
const TOWER_TOP = BASE_Y + TOWER_H; // 2.81
const TOWER_R0 = 0.058;
const TOWER_R1 = 0.035;

const NAC_L = 0.34;
const NAC_W = 0.115;
const NAC_H = 0.115;
const YAW_DECK_H = 0.012;
const HUB_Y = TOWER_TOP + YAW_DECK_H + NAC_H / 2; // 2.88
const TILT = 5 * DEG; // shaft tilt, nose up — keeps the tips off the tower

const ROTOR_R = 1.77;
const HUB_R = 0.1;
const BLADE_LEN = ROTOR_R - HUB_R;
const NOSE_Z = 0.245; // rotor plane, forward of the nacelle nose

const INSERT_POS = new THREE.Vector3(3.1, 1.55, 0);
const INSERT_S = 5; // macro nacelle scale

const SECTION_POS = new THREE.Vector3(1.5, 2.36, 0.95); // airfoil-section insert
const SECTION_CHORD = 0.46;

const ACCENT = 0x54c8e8;
const WARM = 0xffb454;

// ---- blade geometry ---------------------------------------------------------
// Spanwise stations for a real utility blade: a cylindrical root that blends
// into a fat structural airfoil at ~20% span (max chord), then a long taper to
// a thin, nearly untwisted tip.
//  s, chord, thickness ratio, roundness (1 = circular root), twist (rad), prebend
const STATIONS = [
  [0.0, 0.072, 1.0, 1.0, 22 * DEG, 0.0],
  [0.04, 0.078, 0.95, 0.9, 21 * DEG, 0.0],
  [0.1, 0.098, 0.62, 0.45, 19 * DEG, 0.0],
  [0.2, 0.105, 0.4, 0.05, 14 * DEG, 0.002],
  [0.3, 0.098, 0.32, 0.0, 9.5 * DEG, 0.005],
  [0.42, 0.086, 0.27, 0.0, 6.4 * DEG, 0.011],
  [0.55, 0.073, 0.23, 0.0, 4.4 * DEG, 0.02],
  [0.68, 0.06, 0.2, 0.0, 3.0 * DEG, 0.033],
  [0.8, 0.048, 0.18, 0.0, 2.1 * DEG, 0.048],
  [0.9, 0.037, 0.17, 0.0, 1.6 * DEG, 0.063],
  [0.96, 0.027, 0.16, 0.0, 1.3 * DEG, 0.073],
  [0.995, 0.013, 0.16, 0.0, 1.2 * DEG, 0.079],
  [1.0, 0.003, 0.16, 0.0, 1.2 * DEG, 0.08],
];

// One closed section contour, traversed leading edge -> upper -> trailing edge
// -> lower -> back. `round` blends the NACA-ish airfoil toward a circle so the
// same vertex count can describe both the cylindrical root and the thin tip.
// Returns [chordCoord, normalCoord] in chord fractions.
function sectionContour(thickRatio, camber, round, n = 22) {
  const p = 0.4;
  const half = (x) =>
    5 *
    thickRatio *
    (0.2969 * Math.sqrt(x) - 0.126 * x - 0.3516 * x * x + 0.2843 * x ** 3 - 0.1015 * x ** 4);
  const mid = (x) =>
    x < p
      ? (camber / (p * p)) * (2 * p * x - x * x)
      : (camber / (1 - p) ** 2) * (1 - 2 * p + 2 * p * x - x * x);
  const pts = [];
  for (let i = 0; i <= n; i++) {
    const x = 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
    pts.push([x, mid(x) + half(x), +1]);
  }
  for (let i = n - 1; i >= 1; i--) {
    const x = 0.5 - 0.5 * Math.cos((Math.PI * i) / n);
    pts.push([x, mid(x) - half(x), -1]);
  }
  // pitch axis at 30% chord on the airfoil, dead centre on the round root
  const axis = 0.5 + (0.3 - 0.5) * (1 - round);
  return pts.map(([x, y, side]) => {
    const circle = side * Math.sqrt(Math.max(0, 0.25 - (x - 0.5) ** 2));
    const ny = y + (circle - y) * round;
    // LE at +X (the blade travels toward +X); camber bulges toward -Z, the
    // suction side, which is the direction the lift vector points
    return [axis - x, -ny];
  });
}

// Loft the stations into one closed blade skin. Span runs along +Y from the
// root, chord along X, thickness along Z. Twist is applied here as "leading
// edge toward upwind (+Z)" — the same sign convention the pitch bearing uses.
function bladeGeometry() {
  const rings = STATIONS.map(([s, chord, thick, round, twist, bend]) => {
    const contour = sectionContour(thick, 0.05 * (1 - round), round);
    const ct = Math.cos(twist);
    const st = Math.sin(twist);
    return contour.map(([u0, n0]) => {
      const u = u0 * chord;
      const nz = n0 * chord;
      return [u * ct - nz * st, HUB_R + s * BLADE_LEN, u * st + nz * ct + bend];
    });
  });
  const n = rings[0].length;
  const pos = [];
  const uvs = [];
  const idx = [];
  rings.forEach((ring, ri) => {
    ring.forEach(([x, y, z], pi) => {
      pos.push(x, y, z);
      uvs.push(pi / n, STATIONS[ri][0]);
    });
  });
  for (let ri = 0; ri < rings.length - 1; ri++) {
    for (let pi = 0; pi < n; pi++) {
      const pn = (pi + 1) % n;
      const a = ri * n + pi;
      const b = ri * n + pn;
      const c = (ri + 1) * n + pi;
      const d = (ri + 1) * n + pn;
      idx.push(a, c, b, b, c, d);
    }
  }
  // root cap, so the blade never shows a raw open end inside the hub
  const capIdx = pos.length / 3;
  pos.push(0, HUB_R, 0);
  uvs.push(0.5, 0);
  for (let pi = 0; pi < n; pi++) idx.push(capIdx, (pi + 1) % n, pi);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// ---- small local helpers ----------------------------------------------------
// Ring gear with teeth pointing INWARD — the fixed outer member of a planetary
// set. geometry.js's gear() only cuts external teeth.
function internalRing(teeth, pitchR, thickness, material) {
  const depth = ((TAU * pitchR) / teeth) * 0.45;
  const tipR = pitchR - depth / 2;
  const rootR = pitchR + depth / 2;
  const shape = new THREE.Shape();
  shape.absarc(0, 0, pitchR * 1.22, 0, TAU, false);
  const hole = new THREE.Path();
  const step = TAU / teeth;
  for (let i = 0; i < teeth; i++) {
    const c = i * step;
    const pts = [
      [rootR, c - step * 0.26],
      [tipR, c - step * 0.12],
      [tipR, c + step * 0.12],
      [rootR, c + step * 0.26],
      [rootR, c + step / 2],
    ];
    pts.forEach(([r, a], k) => {
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0 && k === 0) hole.moveTo(x, y);
      else hole.lineTo(x, y);
    });
  }
  hole.closePath();
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.12,
    bevelSize: thickness * 0.1,
    bevelSegments: 1,
    curveSegments: 24,
  });
  geo.translate(0, 0, -thickness / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// Open-ended drum with a sector missing, axis along +Z — the cutaway shell for
// the gearbox and generator housings. DoubleSide on bare metal would show a
// concave mirror through the cut, so these stay FrontSide over a dark liner.
// CylinderGeometry's theta starts at +Z and the rotateX below swings that to
// -Y, so a gap authored at theta 0 opens DOWNWARD, into the bedplate, where
// nobody can see it. theta = PI/2 is the direction that survives the rotation
// as world +X — the camera side — which is where every cutaway here wants it.
function sectorDrum(radius, length, gapRad, mat, gapCenter = Math.PI / 2) {
  const geo = new THREE.CylinderGeometry(
    radius,
    radius,
    length,
    48,
    1,
    true,
    gapCenter + gapRad / 2,
    TAU - gapRad,
  );
  geo.rotateX(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

// Shaft-and-head vector arrow built along +Y, so aim() can point it anywhere.
function vector(color, length, thickness) {
  const g = new THREE.Group();
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const shaftLen = length * 0.76;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(thickness, thickness, shaftLen, 12), mat);
  shaft.position.y = shaftLen / 2;
  const head = new THREE.Mesh(new THREE.ConeGeometry(thickness * 2.6, length - shaftLen, 14), mat);
  head.position.y = shaftLen + (length - shaftLen) / 2;
  g.add(shaft, head);
  g.userData.mat = mat;
  return g;
}

const UP = new THREE.Vector3(0, 1, 0);
function aim(group, x, y, z) {
  group.quaternion.setFromUnitVectors(UP, new THREE.Vector3(x, y, z).normalize());
}

export function buildWindTurbine({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials -------------------------------------------------------------
  // Blades, nacelle cover and tower are moulded glass-fibre / painted steel:
  // near-zero metalness, so they can genuinely GHOST on reveal (metal cannot).
  const gelcoat = (color) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.04,
      roughness: 0.44,
      clearcoat: 0.34,
      clearcoatRoughness: 0.3,
    });
  const bladeMat = gelcoat(0xd6dade);
  bladeMat.side = THREE.DoubleSide; // paper-thin tip sections
  const shellMat = gelcoat(0xd2d7dd);
  const towerMat = gelcoat(0xc6ccd2);
  const hubMat = gelcoat(0xd6dade);

  const linerMat = new THREE.MeshStandardMaterial({
    color: 0x22252b,
    roughness: 0.92,
    metalness: 0.1,
  });
  const housingMat = materials.aluminum(0x939aa2);
  housingMat.roughness = 0.72;
  housingMat.normalScale.set(0.18, 0.18);
  const castMat = materials.aluminum(0x7f868e);
  castMat.roughness = 0.78;
  castMat.normalScale.set(0.18, 0.18);
  // map-free on purpose: at the insert's 5x scale the shared brushed maps
  // stretch into coarse black ribbing on every cylinder
  const shaftMat = new THREE.MeshPhysicalMaterial({
    color: 0x9aa2ac,
    metalness: 1,
    roughness: 0.33,
  });
  const gearMat = materials.steel(0xa8b0ba); // map-free: extruded gears have ad-hoc UVs
  gearMat.roughness = 0.34;
  const gearMatDark = materials.steel(0x7a828c);
  gearMatDark.roughness = 0.4;
  // the sun is the part the whole step is about — a brighter steel so it never
  // reads as a fourth planet
  const sunMat = materials.steel(0xdfe4ea);
  sunMat.roughness = 0.24;
  const copperMat = new THREE.MeshPhysicalMaterial({
    color: 0xb9722f,
    metalness: 1,
    roughness: 0.42,
  });
  const boltMat = materials.darkMetal(0x51575f);
  // rotor magnets: muted, matte, painted-steel reds and blues — the saturated
  // plastic of the first pass read as a toy next to the machined parts
  const magnetNorth = materials.paintedMetal(0x3a5480);
  magnetNorth.clearcoat = 0.1;
  magnetNorth.roughness = 0.62;
  const magnetSouth = materials.paintedMetal(0x8a4038);
  magnetSouth.clearcoat = 0.1;
  magnetSouth.roughness = 0.62;
  const concreteMat = new THREE.MeshStandardMaterial({
    color: 0x8d9095,
    roughness: 0.92,
    metalness: 0.03,
  });

  // --- staging ---------------------------------------------------------------
  group.add(studioPlinth());
  const pedestal = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.36, PED_H, 40), concreteMat);
  pedestal.position.y = PLINTH_H + PED_H / 2;
  pedestal.receiveShadow = true;
  pedestal.castShadow = true;
  group.add(pedestal);

  // =========================================================================
  // TOWER
  // =========================================================================
  const tower = new THREE.Group();
  tower.position.y = BASE_Y;
  group.add(tower);

  const towerShell = new THREE.Mesh(
    new THREE.CylinderGeometry(TOWER_R1, TOWER_R0, TOWER_H, 44, 1, true),
    towerMat,
  );
  towerShell.position.y = TOWER_H / 2;
  towerShell.castShadow = true;
  towerShell.receiveShadow = true;
  tower.add(towerShell);
  // dark inner liner: a FrontSide-only shell shows the studio HDRI straight
  // through its far wall from any low camera
  const towerLiner = new THREE.Mesh(
    new THREE.CylinderGeometry(TOWER_R1 * 0.96, TOWER_R0 * 0.96, TOWER_H, 32, 1, true),
    linerMat.clone(),
  );
  towerLiner.material.side = THREE.BackSide;
  towerLiner.position.y = TOWER_H / 2;
  tower.add(towerLiner);

  // flange rings mark the three bolted tower sections
  [0.0, 0.33, 0.66].forEach((f) => {
    const r = TOWER_R0 + (TOWER_R1 - TOWER_R0) * f;
    const ring = new THREE.Mesh(new THREE.CylinderGeometry(r * 1.09, r * 1.09, 0.012, 40), towerMat);
    ring.position.y = f * TOWER_H + 0.006;
    ring.castShadow = true;
    tower.add(ring);
  });
  const baseFlange = new THREE.Mesh(
    new THREE.CylinderGeometry(TOWER_R0 * 1.24, TOWER_R0 * 1.24, 0.018, 44),
    castMat,
  );
  baseFlange.position.y = 0.009;
  tower.add(baseFlange);
  const baseBolts = boltCircle(20, TOWER_R0 * 1.14, 0.006, boltMat, 0.01);
  baseBolts.position.y = 0.02;
  tower.add(baseBolts);
  const door = beveledBox(0.05, 0.09, 0.012, linerMat, 0.006);
  door.position.set(0, 0.078, TOWER_R0 * 0.96);
  tower.add(door);

  // Power cable running down inside the tower. depthTest off so it reads as an
  // x-ray hint of the conductor instead of vanishing inside the shell — and it
  // only ever exists on screen while `powerOn` lifts it above zero.
  const cableCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, TOWER_H - 0.02, 0),
    new THREE.Vector3(0.012, TOWER_H * 0.6, 0.008),
    new THREE.Vector3(-0.01, TOWER_H * 0.25, -0.006),
    new THREE.Vector3(0.0, 0.05, 0.02),
    new THREE.Vector3(0.5, 0.02, 0.36),
  ]);
  const cableMat = new THREE.MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  });
  const cable = new THREE.Mesh(new THREE.TubeGeometry(cableCurve, 70, 0.005, 8), cableMat);
  cable.renderOrder = 3;
  tower.add(cable);
  const cableDots = [];
  for (let i = 0; i < 7; i++) {
    const m = new THREE.MeshBasicMaterial({
      color: 0xdff4ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
      depthTest: false,
    });
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), m);
    d.renderOrder = 4;
    d.userData.seed = i / 7;
    cableDots.push(d);
    tower.add(d);
  }

  // step-up transformer at the foot of the tower
  const transformer = new THREE.Group();
  transformer.position.set(0.62, PLINTH_H, 0.42);
  group.add(transformer);
  const tank = beveledBox(0.2, 0.17, 0.15, materials.paintedMetal(0x6c757e), 0.012);
  tank.position.y = 0.095;
  transformer.add(tank);
  for (let i = 0; i < 3; i++) {
    const bush = new THREE.Mesh(
      new THREE.CylinderGeometry(0.012, 0.016, 0.055, 14),
      materials.plastic(0xb9b2a4),
    );
    bush.position.set(-0.055 + i * 0.055, 0.2, 0);
    transformer.add(bush);
  }
  const radiator = beveledBox(0.02, 0.12, 0.13, castMat, 0.004);
  radiator.position.set(-0.108, 0.095, 0);
  transformer.add(radiator);

  const gridCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0.06, 0.2, 0),
    new THREE.Vector3(0.5, 0.32, -0.1),
    new THREE.Vector3(1.0, 0.26, -0.25),
    new THREE.Vector3(1.5, 0.34, -0.4),
  ]);
  const gridMat = new THREE.MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const gridLine = new THREE.Mesh(new THREE.TubeGeometry(gridCurve, 50, 0.0035, 6), gridMat);
  transformer.add(gridLine);
  const gridDots = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.MeshBasicMaterial({
      color: 0xdff4ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const d = new THREE.Mesh(new THREE.SphereGeometry(0.009, 8, 6), m);
    d.userData.seed = i / 5;
    gridDots.push(d);
    transformer.add(d);
  }

  // =========================================================================
  // DRIVETRAIN — built twice: true scale inside the nacelle, 5x as the insert
  // =========================================================================
  // Gear train (tooth counts chosen so a whole-turn lap wraps invisibly):
  //   ring 60 (fixed) · planets 18 · sun 24  ->  60 = 24 + 2*18, and the
  //   assembly condition (60+24)/3 = 28 is an integer, so three equally spaced
  //   planets genuinely mesh. Carrier in, sun out: 1 + 60/24 = 3.5.
  //   Helical stage 2: wheel 40 / pinion 20 = 2. Shown total 7:1 — a real box
  //   is three stages at ~100:1, which at any watchable rotor speed would
  //   render the output shaft as a featureless blur.
  const Z_RING = 60;
  const Z_PLANET = 18;
  const Z_SUN = 24;
  const RATIO_1 = 1 + Z_RING / Z_SUN; // 3.5
  const RATIO_2 = 2;
  const SUN_PITCH = 0.016;
  const PLANET_PITCH = SUN_PITCH * (Z_PLANET / Z_SUN); // 0.012
  const RING_PITCH = SUN_PITCH + 2 * PLANET_PITCH; // 0.040
  const CARRIER_R = SUN_PITCH + PLANET_PITCH; // 0.028
  const AXIS_LOW = -0.012; // main-shaft height inside the nacelle
  const AXIS_HIGH = 0.018; // high-speed / generator axis, offset up
  const GEAR_T = 0.014;
  const CUT_GAP = 1.5; // sector cutaway, opening toward +X (the camera side)
  const GEN_GAP = 2.4; // the generator needs a wider slot to show its poles

  function buildDrivetrain() {
    const dt = new THREE.Group();

    // --- bedplate -----------------------------------------------------------
    const bed = beveledBox(NAC_W * 0.82, 0.012, NAC_L * 0.9, castMat, 0.004);
    bed.position.set(0, -NAC_H / 2 + 0.014, -0.01);
    dt.add(bed);

    // --- main shaft on its bearing -----------------------------------------
    const mainShaftGroup = new THREE.Group();
    mainShaftGroup.position.set(0, AXIS_LOW, 0);
    dt.add(mainShaftGroup);
    const mainShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.008, 0.1, 28), shaftMat);
    mainShaft.rotation.x = Math.PI / 2;
    mainShaft.position.z = 0.085;
    mainShaft.castShadow = true;
    mainShaftGroup.add(mainShaft);
    const rotorFlange = disc(0.032, 0.01, shaftMat, 32);
    rotorFlange.rotation.x = Math.PI / 2;
    rotorFlange.position.z = 0.163;
    mainShaftGroup.add(rotorFlange);

    const bearing = new THREE.Group();
    bearing.position.set(0, AXIS_LOW, 0.112);
    dt.add(bearing);
    const bearingHouse = new THREE.Mesh(
      new THREE.CylinderGeometry(0.031, 0.031, 0.03, 30),
      castMat,
    );
    bearingHouse.rotation.x = Math.PI / 2;
    bearing.add(bearingHouse);
    const bearingFoot = beveledBox(0.062, 0.05, 0.03, castMat, 0.005);
    bearingFoot.position.y = -0.026;
    bearing.add(bearingFoot);

    // --- gearbox ------------------------------------------------------------
    const gbox = new THREE.Group();
    gbox.position.set(0, AXIS_LOW, 0.012);
    dt.add(gbox);

    const gboxShell = sectorDrum(0.05, 0.09, CUT_GAP, castMat);
    gboxShell.position.z = 0.005;
    gbox.add(gboxShell);
    const gboxLiner = sectorDrum(0.0485, 0.088, CUT_GAP, linerMat);
    gboxLiner.material = linerMat.clone();
    gboxLiner.material.side = THREE.BackSide;
    gboxLiner.position.z = 0.005;
    gbox.add(gboxLiner);
    const gboxRear = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.006, 40), castMat);
    gboxRear.rotation.x = Math.PI / 2;
    gboxRear.position.z = -0.043;
    gbox.add(gboxRear);

    const ringGear = internalRing(Z_RING, RING_PITCH, GEAR_T, gearMatDark);
    ringGear.position.z = 0.03;
    gbox.add(ringGear);

    // carrier: an open three-arm spider on the front face, so the planets stay
    // visible down the axis instead of hiding behind a solid plate
    const carrier = new THREE.Group();
    carrier.position.z = 0.03;
    gbox.add(carrier);
    const carrierHub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.007, 0.007, 0.026, 20),
      gearMatDark,
    );
    carrierHub.rotation.x = Math.PI / 2;
    carrierHub.position.z = 0.016;
    carrier.add(carrierHub);
    const planets = [];
    for (let i = 0; i < 3; i++) {
      const a = (i * TAU) / 3;
      const arm = beveledBox(CARRIER_R, 0.008, 0.007, gearMatDark, 0.002);
      arm.position.set((Math.cos(a) * CARRIER_R) / 2, (Math.sin(a) * CARRIER_R) / 2, 0.022);
      arm.rotation.z = a;
      carrier.add(arm);
      const pin = new THREE.Mesh(new THREE.CylinderGeometry(0.004, 0.004, 0.03, 12), gearMatDark);
      pin.rotation.x = Math.PI / 2;
      pin.position.set(Math.cos(a) * CARRIER_R, Math.sin(a) * CARRIER_R, 0.01);
      carrier.add(pin);
      const pl = gear(
        { teeth: Z_PLANET, radius: PLANET_PITCH * 1.09, thickness: GEAR_T, holeR: 0.004 },
        gearMat,
      );
      pl.position.set(Math.cos(a) * CARRIER_R, Math.sin(a) * CARRIER_R, 0);
      carrier.add(pl);
      planets.push(pl);
    }

    const sunGroup = new THREE.Group();
    sunGroup.position.z = 0.03;
    gbox.add(sunGroup);
    const sun = gear(
      { teeth: Z_SUN, radius: SUN_PITCH * 1.06, thickness: GEAR_T, holeR: 0.005 },
      sunMat,
    );
    sunGroup.add(sun);
    const sunShaft = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0075, 0.0075, 0.062, 18),
      shaftMat,
    );
    sunShaft.rotation.x = Math.PI / 2;
    sunShaft.position.z = -0.031;
    sunGroup.add(sunShaft);
    // the stage-2 wheel rides the same shaft as the sun
    const stage2Wheel = gear(
      { teeth: 40, radius: 0.021, thickness: 0.011, holeR: 0.0075, cutouts: 5 },
      gearMat,
    );
    stage2Wheel.position.z = -0.055;
    sunGroup.add(stage2Wheel);

    const pinionGroup = new THREE.Group();
    pinionGroup.position.set(0, AXIS_HIGH - AXIS_LOW, 0.03);
    gbox.add(pinionGroup);
    const stage2Pinion = gear({ teeth: 20, radius: 0.0108, thickness: 0.011, holeR: 0.004 }, gearMat);
    stage2Pinion.position.z = -0.055;
    pinionGroup.add(stage2Pinion);

    // --- high-speed shaft + parking brake ----------------------------------
    const hsGroup = new THREE.Group();
    hsGroup.position.set(0, AXIS_HIGH, 0);
    dt.add(hsGroup);
    const hsShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.007, 0.007, 0.075, 18), shaftMat);
    hsShaft.rotation.x = Math.PI / 2;
    hsShaft.position.z = -0.05;
    hsGroup.add(hsShaft);
    const brakeDisc = new THREE.Mesh(
      new THREE.CylinderGeometry(0.021, 0.021, 0.004, 40),
      gearMatDark,
    );
    brakeDisc.rotation.x = Math.PI / 2;
    brakeDisc.position.z = -0.058;
    hsGroup.add(brakeDisc);
    const brakeHoles = boltCircle(8, 0.014, 0.0028, linerMat, 0.006);
    brakeHoles.rotation.x = Math.PI / 2;
    brakeHoles.position.z = -0.058;
    hsGroup.add(brakeHoles);
    const caliper = beveledBox(0.012, 0.03, 0.016, materials.paintedMetal(0xc25a2e), 0.003);
    caliper.position.set(0, AXIS_HIGH + 0.026, -0.058);
    dt.add(caliper);

    // --- generator ----------------------------------------------------------
    const genGroup = new THREE.Group();
    genGroup.position.set(0, AXIS_HIGH, -0.108);
    dt.add(genGroup);
    const genShell = sectorDrum(0.038, 0.085, GEN_GAP, housingMat);
    genGroup.add(genShell);
    const genLiner = sectorDrum(0.0368, 0.083, GEN_GAP, linerMat);
    genLiner.material = linerMat.clone();
    genLiner.material.side = THREE.BackSide;
    genGroup.add(genLiner);
    const genEndRear = new THREE.Mesh(
      new THREE.CylinderGeometry(0.038, 0.038, 0.008, 36),
      housingMat,
    );
    genEndRear.rotation.x = Math.PI / 2;
    genEndRear.position.z = -0.0465;
    genGroup.add(genEndRear);
    for (let i = 0; i < 9; i++) {
      const a = -Math.PI / 2 - 0.78 + i * 0.195; // opposite the +X cutaway
      const fin = beveledBox(0.004, 0.012, 0.07, housingMat, 0.001);
      fin.position.set(Math.cos(a) * 0.042, Math.sin(a) * 0.042, 0);
      fin.rotation.z = a;
      genGroup.add(fin);
    }

    // stator: laminated ring with copper bars and end-windings
    const statorCore = sectorDrum(0.03, 0.044, GEN_GAP, gearMatDark);
    genGroup.add(statorCore);
    const statorCoils = [];
    for (let i = 0; i < 12; i++) {
      const a = (i * TAU) / 12;
      // the cut opens on +X (a = 0): drop the bars inside it, or the near side
      // of the winding fences the magnet poles off from the camera
      const off = Math.abs(((a + Math.PI) % TAU) - Math.PI);
      if (off < GEN_GAP / 2) continue;
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.005, 0.008, 0.05), copperMat);
      bar.position.set(Math.cos(a) * 0.0255, Math.sin(a) * 0.0255, 0);
      bar.rotation.z = a;
      genGroup.add(bar);
      const glowMat = new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const glow = new THREE.Mesh(new THREE.SphereGeometry(0.005, 10, 8), glowMat);
      glow.position.set(Math.cos(a) * 0.0255, Math.sin(a) * 0.0255, 0.03);
      genGroup.add(glow);
      statorCoils.push({ a, mat: glowMat });
    }
    const endWinding = new THREE.Mesh(
      new THREE.TorusGeometry(0.0255, 0.005, 10, 40, TAU - GEN_GAP),
      copperMat,
    );
    endWinding.rotation.z = GEN_GAP / 2; // arc starts at +X, so swing the gap onto it
    endWinding.position.z = 0.03;
    genGroup.add(endWinding);

    // rotor: four salient poles on the high-speed shaft
    const genRotor = new THREE.Group();
    genGroup.add(genRotor);
    const rotorBody = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 24), shaftMat);
    rotorBody.rotation.x = Math.PI / 2;
    genRotor.add(rotorBody);
    for (let i = 0; i < 4; i++) {
      const a = (i * TAU) / 4;
      const pole = beveledBox(
        0.017,
        0.009,
        0.054,
        i % 2 ? magnetNorth : magnetSouth,
        0.002,
      );
      pole.position.set(Math.cos(a) * 0.0155, Math.sin(a) * 0.0155, 0);
      pole.rotation.z = a;
      genRotor.add(pole);
    }

    // converter cabinet behind the generator
    const converter = beveledBox(0.075, 0.06, 0.03, materials.paintedMetal(0x5f666e), 0.005);
    converter.position.set(0, 0.0, -0.152);
    dt.add(converter);

    // roof cooler
    const cooler = beveledBox(0.07, 0.016, 0.075, castMat, 0.004);
    cooler.position.set(0, NAC_H / 2 + 0.009, -0.06);
    dt.add(cooler);

    // --- yaw deck -----------------------------------------------------------
    const yawDeck = new THREE.Group();
    yawDeck.position.y = -NAC_H / 2 - YAW_DECK_H / 2;
    dt.add(yawDeck);
    const yawRing = gear(
      { teeth: 44, radius: 0.05, thickness: YAW_DECK_H, holeR: 0.032 },
      gearMatDark,
    );
    yawRing.rotation.x = -Math.PI / 2;
    yawDeck.add(yawRing);
    const yawPinions = [];
    for (let i = 0; i < 2; i++) {
      const a = i ? 0.9 : -0.9;
      const yd = new THREE.Group();
      yd.position.set(Math.sin(a) * 0.058, 0.004, Math.cos(a) * 0.058);
      yawDeck.add(yd);
      const motor = new THREE.Mesh(
        new THREE.CylinderGeometry(0.009, 0.009, 0.03, 16),
        materials.paintedMetal(0x4a5058),
      );
      motor.position.y = 0.026;
      yd.add(motor);
      const pin = gear({ teeth: 11, radius: 0.0135, thickness: 0.01, holeR: 0.003 }, gearMat);
      pin.rotation.x = -Math.PI / 2;
      yd.add(pin);
      yawPinions.push(pin);
    }

    return {
      group: dt,
      mainShaftGroup,
      carrier,
      planets,
      sunGroup,
      pinionGroup,
      hsGroup,
      genRotor,
      statorCoils,
      yawPinions,
      gbox,
      genGroup,
      converter,
      bearing,
    };
  }

  // =========================================================================
  // NACELLE + ROTOR (true scale, on the tower)
  // =========================================================================
  const yawGroup = new THREE.Group();
  yawGroup.position.y = TOWER_TOP;
  group.add(yawGroup);

  const yawBearing = new THREE.Mesh(
    new THREE.CylinderGeometry(TOWER_R1 * 1.5, TOWER_R1 * 1.5, YAW_DECK_H, 36),
    castMat,
  );
  yawBearing.position.y = YAW_DECK_H / 2;
  yawGroup.add(yawBearing);

  const tiltGroup = new THREE.Group();
  tiltGroup.position.y = YAW_DECK_H + NAC_H / 2;
  tiltGroup.rotation.x = -TILT;
  yawGroup.add(tiltGroup);

  const drive = buildDrivetrain();
  tiltGroup.add(drive.group);

  // nacelle cover — a rounded, slightly tapered composite shell
  const nacelleShell = new THREE.Group();
  tiltGroup.add(nacelleShell);
  const shellBody = beveledBox(NAC_W, NAC_H, NAC_L * 0.88, shellMat, 0.024);
  shellBody.position.z = -0.01;
  shellBody.receiveShadow = true;
  nacelleShell.add(shellBody);
  const shellNose = new THREE.Mesh(
    new THREE.CylinderGeometry(NAC_W * 0.42, NAC_W * 0.5, 0.05, 26),
    shellMat,
  );
  shellNose.rotation.x = Math.PI / 2;
  shellNose.position.z = NAC_L * 0.44 - 0.006;
  shellNose.castShadow = true;
  nacelleShell.add(shellNose);
  const shellTail = new THREE.Mesh(
    new THREE.CylinderGeometry(NAC_W * 0.34, NAC_W * 0.48, 0.045, 24),
    shellMat,
  );
  shellTail.rotation.x = -Math.PI / 2;
  shellTail.position.z = -NAC_L * 0.44 - 0.004;
  shellTail.castShadow = true;
  nacelleShell.add(shellTail);

  // anemometer + wind vane on the roof, behind the cooler
  const metMast = new THREE.Group();
  metMast.position.set(0, NAC_H / 2 + 0.018, -NAC_L * 0.42);
  tiltGroup.add(metMast);
  metMast.add(rod(0.004, 0.05, materials.darkMetal(0x555b63)));
  const anemo = new THREE.Group();
  anemo.position.y = 0.052;
  metMast.add(anemo);
  for (let i = 0; i < 3; i++) {
    const a = (i * TAU) / 3;
    const armMesh = new THREE.Mesh(
      new THREE.CylinderGeometry(0.0018, 0.0018, 0.03, 8),
      materials.darkMetal(0x6a7079),
    );
    armMesh.rotation.z = Math.PI / 2;
    armMesh.position.set(Math.cos(a) * 0.015, 0, Math.sin(a) * 0.015);
    armMesh.rotation.y = -a;
    anemo.add(armMesh);
    const cup = new THREE.Mesh(
      new THREE.SphereGeometry(0.006, 12, 8, 0, Math.PI),
      materials.plastic(0x2c3138),
    );
    cup.position.set(Math.cos(a) * 0.03, 0, Math.sin(a) * 0.03);
    cup.rotation.set(Math.PI / 2, -a + Math.PI / 2, 0);
    anemo.add(cup);
  }
  const vane = new THREE.Group();
  vane.position.set(0.035, 0.03, 0);
  metMast.add(vane);
  const vaneArm = new THREE.Mesh(
    new THREE.CylinderGeometry(0.0018, 0.0018, 0.045, 8),
    materials.darkMetal(0x6a7079),
  );
  vaneArm.rotation.x = Math.PI / 2;
  vane.add(vaneArm);
  const vaneFin = beveledBox(0.002, 0.018, 0.026, materials.plastic(0x2c3138), 0.001);
  vaneFin.position.z = -0.026;
  vane.add(vaneFin);
  const vaneMast = rod(0.0035, 0.03, materials.darkMetal(0x555b63));
  vaneMast.position.set(0.035, 0.0, 0);
  metMast.add(vaneMast);

  // --- rotor ----------------------------------------------------------------
  const rotorGroup = new THREE.Group();
  rotorGroup.position.z = NOSE_Z;
  tiltGroup.add(rotorGroup);

  const spinner = new THREE.Mesh(new THREE.SphereGeometry(HUB_R, 30, 20), hubMat);
  spinner.scale.z = 1.25;
  spinner.castShadow = true;
  rotorGroup.add(spinner);
  const spinnerNose = new THREE.Mesh(new THREE.SphereGeometry(HUB_R * 0.62, 24, 16), hubMat);
  spinnerNose.position.z = HUB_R * 0.95;
  spinnerNose.scale.z = 1.5;
  rotorGroup.add(spinnerNose);
  const hubBack = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 24), castMat);
  hubBack.rotation.x = Math.PI / 2;
  hubBack.position.z = -0.09;
  rotorGroup.add(hubBack);

  const bladeGeo = bladeGeometry();
  const bladePitchGroups = [];
  for (let i = 0; i < 3; i++) {
    const arm = new THREE.Group();
    arm.rotation.z = (i * TAU) / 3;
    rotorGroup.add(arm);
    // pitch bearing: a visible flanged collar at the blade root
    const pitchRing = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.016, 28), castMat);
    pitchRing.position.y = HUB_R * 0.92;
    arm.add(pitchRing);
    const pitchGroup = new THREE.Group();
    arm.add(pitchGroup);
    const blade = new THREE.Mesh(bladeGeo, bladeMat);
    blade.castShadow = true;
    pitchGroup.add(blade);
    bladePitchGroups.push(pitchGroup);
  }

  // =========================================================================
  // WIND — streamlines inside an expanding streamtube (Betz)
  // =========================================================================
  const windGroup = new THREE.Group();
  windGroup.position.set(0, HUB_Y, 0);
  group.add(windGroup);

  // radius multiplier along the tube: the air slows through the disc, so the
  // tube it occupies must widen downstream to carry the same mass flow
  const TUBE_Z = 1.4;
  const tubeR = (z) => {
    const t = clamp01((TUBE_Z - z) / 2.3); // 0 far upstream -> 1 well downstream
    const e = t * t * (3 - 2 * t);
    return 0.8 + e * 0.56;
  };

  const streamMat = new THREE.MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const streamProfile = [];
  for (let i = 0; i <= 24; i++) {
    const z = -TUBE_Z + (i / 24) * 2 * TUBE_Z;
    streamProfile.push(new THREE.Vector2(ROTOR_R * tubeR(z), z));
  }
  const streamTubeGeo = new THREE.LatheGeometry(streamProfile, 56, 0, TAU);
  streamTubeGeo.rotateX(Math.PI / 2);
  windGroup.add(new THREE.Mesh(streamTubeGeo, streamMat));

  const streamDots = [];
  const STREAM_LINES = [
    [0.34, 0.3],
    [0.34, 1.9],
    [0.34, 3.5],
    [0.34, 5.1],
    [0.68, 0.9],
    [0.68, 2.5],
    [0.68, 4.1],
    [0.68, 5.7],
    [0.94, 0.0],
    [0.94, 1.55],
    [0.94, 3.1],
    [0.94, 4.65],
  ];
  STREAM_LINES.forEach(([fr, az], ci) => {
    const pts = [];
    for (let i = 0; i <= 18; i++) {
      const z = TUBE_Z - (i / 18) * 2 * TUBE_Z;
      const r = ROTOR_R * fr * tubeR(z);
      pts.push(new THREE.Vector3(Math.cos(az) * r, Math.sin(az) * r, z));
    }
    const curve = new THREE.CatmullRomCurve3(pts);
    for (let i = 0; i < 7; i++) {
      const m = new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0,
        depthWrite: false,
      });
      const d = new THREE.Mesh(new THREE.SphereGeometry(0.023, 8, 6), m);
      d.userData = { curve, seed: (i / 7 + ci * 0.083) % 1, mat: m };
      windGroup.add(d);
      streamDots.push(d);
    }
  });

  // =========================================================================
  // AIRFOIL SECTION INSERT (step 2) — an oversized cross-section of the blade
  // at ~70% span, with the vector triangle that makes the lift
  // =========================================================================
  const sectionGroup = new THREE.Group();
  sectionGroup.position.copy(SECTION_POS);
  sectionGroup.rotation.z = -Math.PI / 2; // local +Y (span) -> world +X
  sectionGroup.visible = false;
  group.add(sectionGroup);

  const secContour = sectionContour(0.2, 0.05, 0);
  const secShape = new THREE.Shape();
  secContour.forEach(([u, n], i) => {
    const x = u * SECTION_CHORD;
    const y = n * SECTION_CHORD;
    if (i === 0) secShape.moveTo(x, y);
    else secShape.lineTo(x, y);
  });
  secShape.closePath();
  const secMat = gelcoat(0xdfe3e7);
  secMat.transparent = true;
  secMat.opacity = 0;
  secMat.depthWrite = false;
  const secGeo = new THREE.ExtrudeGeometry(secShape, {
    depth: 0.1,
    bevelEnabled: true,
    bevelThickness: 0.006,
    bevelSize: 0.006,
    bevelSegments: 2,
    curveSegments: 8,
  });
  // drawn in X (chord) / Y (thickness) — rotate so thickness runs along Z and
  // the extrusion runs along the span (+Y), matching a real blade section
  secGeo.rotateX(-Math.PI / 2);
  secGeo.translate(0, -0.05, 0);
  const sectionMesh = new THREE.Mesh(secGeo, secMat);
  sectionMesh.rotation.y = -3.6 * DEG; // the blade's own twist at 70% span
  sectionGroup.add(sectionMesh);

  const V_WIND = 0.09; // 12 m/s
  const V_BLADE = 0.63; // 7x the wind — drawn to scale, because the copy says so
  const secArrows = {
    wind: vector(0x9fb4c4, V_WIND, 0.011),
    motion: vector(0xd8dee4, V_BLADE, 0.011),
    apparent: vector(WARM, 0.44, 0.013),
    lift: vector(ACCENT, 0.4, 0.014),
  };
  Object.values(secArrows).forEach((a) => sectionGroup.add(a));
  // wind: axial, blowing toward -Z, arriving from upwind of the section
  secArrows.wind.position.set(-0.46, 0, 0.34);
  aim(secArrows.wind, 0, 0, -1);
  // blade motion: tangential, toward +X. At true scale it dwarfs the wind —
  // which IS the point of the step
  secArrows.motion.position.set(-0.3, 0, 0.13);
  aim(secArrows.motion, 1, 0, 0);
  // apparent wind = wind - blade motion: 8 degrees off the rotor plane, and it
  // arrives at the leading edge
  const APP = new THREE.Vector3(-V_BLADE, 0, -V_WIND).normalize();
  secArrows.apparent.position
    .copy(APP.clone().multiplyScalar(-0.44))
    .add(new THREE.Vector3(0.14, 0, 0.0));
  aim(secArrows.apparent, APP.x, APP.y, APP.z);
  // lift: perpendicular to the apparent wind, toward the suction side — mostly
  // thrust, with the thin tangential slice that actually turns the rotor
  secArrows.lift.position.set(0.0, 0, -0.075);
  aim(secArrows.lift, V_WIND, 0, -V_BLADE);

  // =========================================================================
  // MACRO NACELLE INSERT (steps 4-6) — the same drivetrain at 5x
  // =========================================================================
  const insert = new THREE.Group();
  insert.position.copy(INSERT_POS);
  insert.scale.setScalar(INSERT_S);
  insert.visible = false;
  group.add(insert);

  const insertDrive = buildDrivetrain();
  insert.add(insertDrive.group);
  const insertShellMat = shellMat.clone();
  insertShellMat.transparent = true;
  insertShellMat.depthWrite = false;
  const insertShellParts = [];
  const insertShellBody = beveledBox(NAC_W, NAC_H, NAC_L * 0.88, insertShellMat, 0.024);
  insertShellBody.position.z = -0.01;
  insert.add(insertShellBody);
  insertShellParts.push(insertShellBody);
  const insertShellNose = new THREE.Mesh(
    new THREE.CylinderGeometry(NAC_W * 0.42, NAC_W * 0.5, 0.05, 26),
    insertShellMat,
  );
  insertShellNose.rotation.x = Math.PI / 2;
  insertShellNose.position.z = NAC_L * 0.44 - 0.006;
  insert.add(insertShellNose);
  insertShellParts.push(insertShellNose);
  const insertShellTail = new THREE.Mesh(
    new THREE.CylinderGeometry(NAC_W * 0.34, NAC_W * 0.48, 0.045, 24),
    insertShellMat,
  );
  insertShellTail.rotation.x = -Math.PI / 2;
  insertShellTail.position.z = -NAC_L * 0.44 - 0.004;
  insert.add(insertShellTail);
  insertShellParts.push(insertShellTail);
  // a stub of main shaft leaving the insert toward the (absent) rotor
  const insertStub = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.07, 24), shaftMat);
  insertStub.rotation.x = Math.PI / 2;
  insertStub.position.set(0, AXIS_LOW, 0.21);
  insert.add(insertStub);
  const insertTowerTop = new THREE.Mesh(
    new THREE.CylinderGeometry(TOWER_R1, TOWER_R1 * 1.06, 0.09, 30),
    towerMat,
  );
  insertTowerTop.position.y = -NAC_H / 2 - YAW_DECK_H - 0.043;
  insert.add(insertTowerTop);

  // =========================================================================
  // CALLOUTS
  // =========================================================================
  const labels = calloutSets([
    'anatomy',
    'blade',
    'rotor',
    'nacelle',
    'gearbox',
    'generator',
    'control',
    'grid',
  ]);

  // Callouts on the rotor ride a SPINNING parent, so they sweep the screen
  // every lap. Anchoring them close in — 35% span rather than out at the tip —
  // keeps that sweep small enough that no pill ever swings under the text
  // panel (the label-visibility gate's failure mode).
  labels.add('anatomy', bladePitchGroups[0], 'Blade', [0.05, HUB_R + 0.35 * BLADE_LEN, 0], 35, 70);
  labels.add('anatomy', rotorGroup, 'Hub', [0.06, 0.02, 0.12], 60, 66);
  labels.add('anatomy', tiltGroup, 'Nacelle', [0.02, 0.05, -0.1], 40, 88);
  labels.add('anatomy', tower, 'Tower', [0.05, TOWER_H * 0.45, 0.03], -25, 78);
  labels.add('anatomy', group, 'Foundation', [0.26, PLINTH_H + 0.06, 0.2], -30, 76);

  // The section insert reads on screen as: local +X = down, local +Z = left.
  // Every leader below is aimed to the RIGHT so no pill can drift under the
  // text panel.
  labels.add('blade', sectionGroup, 'Wind — 12 m/s', [-0.46, 0, 0.28], 22, 96);
  labels.add('blade', sectionGroup, 'Blade motion — 7× faster', [0.33, 0, 0.13], -24, 108);
  labels.add('blade', sectionGroup, 'Apparent wind', [0.52, 0, 0.05], -40, 80);
  labels.add('blade', sectionGroup, 'Lift', [0.06, 0, -0.44], 18, 56);

  labels.add('rotor', windGroup, 'Slowed air spreads out', [0, ROTOR_R * 0.95, -1.05], 18, 92);
  labels.add('rotor', windGroup, 'The disc can take 59.3% at most', [0, ROTOR_R * 0.4, 0.3], 40, 100);

  labels.add('nacelle', insertDrive.bearing, 'Main shaft', [0.0, 0.036, 0.0], 65, 74);
  labels.add('nacelle', insertDrive.gbox, 'Gearbox', [0.0, 0.052, 0.0], 95, 70);
  labels.add('nacelle', insertDrive.hsGroup, 'Parking brake', [0.02, 0.03, -0.058], 30, 82);
  labels.add('nacelle', insertDrive.genGroup, 'Generator', [0.0, 0.042, -0.02], 120, 74);
  labels.add('nacelle', insertDrive.converter, 'Converter', [0.0, -0.034, 0.0], -60, 76);

  labels.add('gearbox', insertDrive.gbox, 'Ring gear — bolted still', [0.0, 0.046, 0.03], 105, 86);
  labels.add('gearbox', insertDrive.carrier, 'Planet gears', [0.028, -0.028, 0.012], -50, 78);
  labels.add('gearbox', insertDrive.gbox, 'Sun gear — the output', [0.016, -0.006, 0.046], -18, 92);
  labels.add('gearbox', insertDrive.hsGroup, 'High-speed shaft — 1,500 rpm', [0.0, 0.026, -0.03], 35, 104);

  labels.add('generator', insertDrive.genGroup, 'Magnet poles', [0.0155, 0.0, 0.01], -28, 84);
  labels.add('generator', insertDrive.genGroup, 'Stator windings — 690 V', [0.006, 0.0255, 0.02], 52, 68);

  labels.add('control', metMast, 'Anemometer & wind vane', [0.0, 0.062, 0], 62, 96);
  labels.add('control', bladePitchGroups[0], 'Pitch bearing', [0.042, 0.095, 0], 48, 120);
  labels.add('control', yawGroup, 'Yaw ring & drives', [0.052, -0.006, 0.018], -26, 128);

  labels.add('grid', tower, 'Cable down the tower', [0.05, TOWER_H * 0.55, 0.03], -22, 88);
  labels.add('grid', transformer, 'Step-up transformer', [0.02, 0.24, 0.0], 55, 88);

  // =========================================================================
  // POSE
  // =========================================================================
  const state = {
    rotor: 0,
    reveal: 0,
    flow: 0,
    windDir: 0,
    yaw: 0,
    pitch: 0,
    sectionViz: 0,
    betz: 0,
    powerOn: 0,
    windViz: 0,
    shellViz: 1,
  };

  const tmpVec = new THREE.Vector3();

  function poseDrivetrain(d, theta) {
    d.mainShaftGroup.rotation.z = -theta;
    d.carrier.rotation.z = -theta;
    d.planets.forEach((p) => {
      p.rotation.z = theta * (Z_RING / Z_PLANET);
    });
    d.sunGroup.rotation.z = -theta * RATIO_1;
    d.pinionGroup.rotation.z = theta * RATIO_1 * RATIO_2;
    d.hsGroup.rotation.z = theta * RATIO_1 * RATIO_2;
    d.genRotor.rotation.z = theta * RATIO_1 * RATIO_2;
    // induced EMF in each stator bar: brightest as a rotor pole sweeps past it,
    // two pole pairs, so the electrical angle is twice the mechanical one
    const elec = theta * RATIO_1 * RATIO_2 * 2;
    d.statorCoils.forEach(({ a, mat }) => {
      mat.opacity = state.powerOn * (0.1 + Math.abs(Math.cos(a * 2 - elec)) * 0.8);
    });
    d.yawPinions.forEach((p) => {
      p.rotation.y = state.yaw * 9;
    });
  }

  function apply() {
    // --- rotor + blades
    rotorGroup.rotation.z = -state.rotor;
    // the vane points into the wind, so in nacelle-local terms it sits at the
    // yaw ERROR — the visible thing the controller is chasing
    vane.rotation.y = state.windDir - state.yaw;
    anemo.rotation.y = state.flow * TAU * 6; // 6 whole turns per lap
    bladePitchGroups.forEach((g) => {
      g.rotation.y = -state.pitch;
    });
    yawGroup.rotation.y = state.yaw;

    poseDrivetrain(drive, state.rotor);
    poseDrivetrain(insertDrive, state.rotor);

    // --- reveal: covers ghost away, the macro insert appears
    const r = state.reveal;
    shellMat.transparent = r > 0.001;
    shellMat.opacity = 1 - r * 0.9;
    shellMat.depthWrite = r < 0.5;
    shellMat.clearcoat = 0.34 * (1 - r); // a coat renders at full strength however low the opacity
    insertShellMat.opacity = 1 - r * 0.88;
    insertShellMat.clearcoat = 0.34 * (1 - r);
    insert.visible = r > 0.5;
    insertShellParts.forEach((m) => {
      m.visible = state.shellViz > 0.5;
    });

    // --- wind
    windGroup.rotation.y = state.windDir;
    const windAlive = state.windViz;
    streamMat.opacity = state.betz * 0.03;
    streamDots.forEach((d) => {
      const t = (d.userData.seed + state.flow) % 1;
      d.userData.curve.getPointAt(t, tmpVec);
      d.position.copy(tmpVec);
      const fade = Math.min(1, t * 6) * Math.min(1, (1 - t) * 6);
      d.userData.mat.opacity = windAlive * fade * 0.85;
      // air leaving the rotor has given up its energy — dimmer, and spread wide
      d.userData.mat.color.setHex(t > 0.5 ? 0x3f7d92 : ACCENT);
      d.scale.setScalar(t > 0.5 ? 1.15 : 1);
    });

    // --- airfoil section insert
    const sv = state.sectionViz;
    sectionGroup.visible = sv > 0.01;
    secMat.opacity = sv * 0.96;
    Object.values(secArrows).forEach((a) => {
      a.userData.mat.opacity = sv * 0.92;
    });

    // --- power path
    cableMat.opacity = state.powerOn * 0.5;
    gridMat.opacity = state.powerOn * 0.45;
    cableDots.forEach((d) => {
      const t = (d.userData.seed + state.flow * 2) % 1;
      cableCurve.getPointAt(t, tmpVec);
      d.position.copy(tmpVec);
      d.material.opacity = state.powerOn * Math.min(1, t * 8) * Math.min(1, (1 - t) * 8);
    });
    gridDots.forEach((d) => {
      const t = (d.userData.seed + state.flow * 2) % 1;
      gridCurve.getPointAt(t, tmpVec);
      d.position.copy(tmpVec);
      d.material.opacity = state.powerOn * Math.min(1, t * 8) * Math.min(1, (1 - t) * 8);
    });
  }
  apply();

  return {
    group,
    parts: {
      rotorGroup,
      yawGroup,
      bladePitch: bladePitchGroups[0],
      carrier: insertDrive.carrier,
      sun: insertDrive.sunGroup,
      hs: insertDrive.hsGroup,
      genRotor: insertDrive.genRotor,
    },
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
  };
}
