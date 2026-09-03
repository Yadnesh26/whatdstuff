import * as THREE from 'three';
import { materials, rod, studioPlinth } from '../../framework/parts.js';
import { beveledBox, gear, boltCircle, tubeAlong } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { smooth, win, profileTable, TAU } from '../../framework/motion.js';

// A longitudinal 3-speed automatic (Simpson gearset, TorqueFlite/C4 class),
// presented as a studio product shot on a charcoal plinth.
//
// PROPORTIONS FIRST (real box: ~900 mm nose-to-yoke, bellhousing face
// ~ø420 mm, torque converter ~ø300 mm, main case ~ø230 mm, pan ~100 mm deep):
//   overall length : bell ø = 2.15 : 1 · converter ø = 0.71 × bell ø ·
//   case ø = 0.55 × bell ø.  One world unit == 270 mm, and every constant
//   below is derived from that one scale so the ratios hold by construction.
//
// REAL NUMBERS — the Simpson set: TWO planetary gearsets sharing ONE sun.
// Tooth counts sun 36 / ring 72 / four planets of 18 (36 + 2x18 = 72, the
// identity every planetary must satisfy). Every ratio falls out of S/R = 0.5:
//   1st = 2 + S/R = 2.50 : 1   (rear carrier held; the sun runs BACKWARDS)
//   2nd = 1 + S/R = 1.50 : 1   (sun held by the kickdown band)
//   3rd = 1.00 : 1             (two members driven -> the set locks solid)
//   rev = R / S  = 2.00 : 1    (sun driven, rear carrier held, output flips)
// Real boxes land at 2.45-2.55 / 1.45-1.55 / 1.00 / 2.00-2.20 — this set is
// the clean-arithmetic version of exactly that hardware.
//
// APPLIED ELEMENTS (the real TorqueFlite table, see APPLIED below):
//   1st  forward clutch + one-way roller clutch
//   2nd  forward clutch + kickdown band
//   3rd  forward clutch + direct clutch
//   R    direct clutch  + low/reverse band
//
// KINEMATICS. The WHOLE gear train is determined by two angles — the sun (ts)
// and the output / front carrier (tc). Everything else is DERIVED from the two
// planetary constraints rather than tabulated:
//   front set:  S*ts + R*tr = (S+R)*tc    ->  tr  = [(S+R)tc - S*ts] / R
//   rear set:   S*ts + R*tc = (S+R)*trc   ->  trc = [S*ts + R*tc] / (S+R)
// (the rear RING is the front CARRIER — they are one member, the output.)
// That is why a shift can crossfade ts and tc freely: the ring and the rear
// carrier follow exactly, so the gears cannot drift out of mesh mid-change.
//
// MESH PHASING. For external gears A,B with B at line-of-centres angle a,
// tooth-meets-gap holds for all time iff
//     N_A(a - t_A) + N_B(a + PI - t_B) == PI   (mod 2PI)
// so a planet's own angle is fully determined by the carrier and the sun:
//     tp = [ (S+P)*a - S*ts + (P-1)PI ] / P                   [PLANET_PHASE]
// Differentiating gives wp = wc(1+S/P) - ws*S/P — the textbook planet rate —
// so ONE formula serves both the pose and the kinematics. The matching
// derivation for the INTERNAL ring mesh is satisfied automatically provided
// (S+R)/planets is an integer (108/4 = 27 OK) and P is even (18 OK): exactly
// the two conditions that let four equally-spaced planets physically assemble.
//
// SEAMLESS LOOPS. Gears carry no unique marks, so a pose repeats whenever each
// wheel advances a WHOLE number of TEETH; the visible odd-order features are
// the four carrier arms, the two-eared output yoke, 20 turbine blades, 24
// impeller blades and 12 stator vanes. Every timeline states its input turns
// per lap, checked against this table (turns per input turn):
//   mode   ts     tc      tr     trc    fPlanet rPlanet  -> whole-lap input
//   N     -2      0       1     -2/3      4       2       multiple of 3
//   1     -0.8    0.4     1      0        2.8     1.6     multiple of 5
//   2      0      2/3     1      4/9      2       4/3     multiple of 9
//   3      1      1       1      1        1       1       any integer
//   R      1     -0.5   -1.25    0       -3.5    -2       any integer
// The converter adds its own: turbine turns x 20 must be whole, impeller x 24
// likewise — which is why every loop hands the impeller a whole+half turn
// count (half x 24 = 12, half x 4 cover lugs = 2, both integers).

// --- planetary tooth set -----------------------------------------------------
const S_T = 36;
const R_T = 72;
const P_T = 18;
const N_PL = 4;
const MODULE_R = 0.00375; // pitch radius per tooth
const MOD = MODULE_R * 2; // metric module == addendum
const SUN_R = S_T * MODULE_R; // 0.135
const RING_R = R_T * MODULE_R; // 0.270
const PL_R = P_T * MODULE_R; // 0.0675
const CARRIER_R = SUN_R + PL_R; // 0.2025
const RING_OUT = RING_R + 0.05; // 0.320 — annulus outside radius
const GEAR_T = 0.115;
const TOOTH_D = 2.25 * MOD;

// --- axial layout (engine end at -X) -----------------------------------------
const AX = 1.3; // driveline axis height above the floor
const BELL_X0 = -1.62;
const BELL_X1 = -0.8;
const BELL_R = 0.78;
const CONV_X = -1.2;
const CONV_R = 0.555;
const FACE_X = CONV_X - 0.212; // machined lock-up friction face on the cover
const PUMP_X = -0.86;
const CASE_X0 = -0.8;
const CASE_X1 = 0.99;
const CASE_R = 0.44;
const DRUM_R = 0.375; // direct-clutch drum == sun driving shell
const RCL_R = 0.285; // forward-clutch retainer
const ANN_R = 0.155; // annulus driving hub
const SUN_TUBE_R = 0.105;
const OUT_R = 0.075;
const FP_X = 0.13; // front planetary centre
const RP_X = 0.4925; // rear planetary centre
const SUN_WEB_X = 0.24; // where the sun shell reaches in to the sun
const LR_X0 = 0.66; // low-reverse drum
const LR_X1 = 0.88;
const LR_R = 0.348;
const TAIL_X1 = 1.62;
const YOKE_X = 1.76;
const PAN_X0 = -0.62;
const PAN_X1 = 0.6;
const PAN_GAP = 0.95; // half-angle of the case's open bottom (rad)
const PAN_RAIL_Y = AX - CASE_R * Math.cos(PAN_GAP); // 1.046
const PAN_HALF_Z = CASE_R * Math.sin(PAN_GAP); // 0.351
const PAN_Y0 = 0.62;
const VB_Y = 0.95; // valve body centre height

const ACCENT = 0xff8f6b;
const LOCK_TRAVEL = 0.012;

// --- per-member identity -----------------------------------------------------
// Every shaft in a real box is the same steel, and that is exactly the problem:
// five concentric members render as one silver caterpillar. Each MEMBER (a
// rigid assembly that always turns as one) gets a quarter-saturated tint, so a
// drum and the gear it drives read as the same thing even half a metre apart.
// Kept close to base steel on purpose — at full saturation the box reads as
// moulded plastic, a worse lie than the one this fixes. No warm gold in the
// set: the applied-element highlight is a warm accent glow, and a gold drum at
// rest was confusable with a held one.
const TINT = {
  input: 0xc2c8d0, // input shaft + forward-clutch retainer — neutral, always drives
  sun: 0xa9a0c4, // sun shell, both sun gears — muted violet
  annulus: 0x9cbfa6, // forward-clutch output, front ring gear — sage
  output: 0xc9a08e, // front carrier, rear ring, output shaft — copper rose
  reaction: 0x86b0bc, // rear carrier, low-reverse drum — teal, the held member
};

// --- helpers -----------------------------------------------------------------

// Map-free gear steel. Extruded gear geometry has ad-hoc UVs, so a roughnessMap
// would sample garbage texels — these carry no maps at all.
function gearSteel(color, roughness = 0.32) {
  return new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness });
}

// Same, but a drum wall you can see the inside of: DoubleSide with the
// roughness pushed up so a concave metal surface never renders as a mirror.
function drumSteel(color, roughness = 0.5) {
  return new THREE.MeshPhysicalMaterial({
    color,
    metalness: 1,
    roughness,
    side: THREE.DoubleSide,
  });
}

// Lathe about the X axis. Profile is [[radius, x], ...] and MUST run -X -> +X,
// or the surface normals come out inside-out. `phi` sweeps a partial
// revolution — a half-lathe is how the converter gets sectioned.
function axialLathe(profile, material, segments = 64, phiStart = 0, phiLength = TAU) {
  const geo = new THREE.LatheGeometry(
    profile.map(([r, x]) => new THREE.Vector2(r, x)),
    segments,
    phiStart,
    phiLength,
  );
  geo.rotateZ(-Math.PI / 2); // +Y axis -> +X axis
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// Cylinder or cone about the X axis between x0 and x1.
function axialCyl(rAtX1, rAtX0, x0, x1, material, o = {}) {
  const geo = new THREE.CylinderGeometry(
    rAtX1,
    rAtX0,
    x1 - x0,
    o.seg ?? 56,
    1,
    o.open ?? false,
    o.thetaStart ?? 0,
    o.thetaLength ?? TAU,
  );
  geo.rotateZ(-Math.PI / 2);
  geo.translate((x0 + x1) / 2, 0, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// Flat annulus standing in the YZ plane — a plate, a clutch disc, a carrier web.
function annulus(rInner, rOuter, x, thickness, material) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, rOuter, 0, TAU, false);
  if (rInner > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, rInner, 0, TAU, true);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.2,
    bevelSize: Math.min(0.004, thickness * 0.25),
    bevelSegments: 1,
    curveSegments: 56,
  });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateY(Math.PI / 2);
  geo.translate(x, 0, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// INTERNAL (annulus) gear — teeth point INWARD from a solid rim. The toolkit's
// gear() only makes external wheels, and a ring gear is the one part of a
// planetary set you cannot fake: the rim is a disc and the tooth profile is its
// hole. Tooth half-widths are the INVERSE of gear()'s (fat at the inner tip,
// narrow at the outer root) so ring tooth and planet gap are roughly
// complementary and the mesh reads closed rather than sloppy.
function ringGear({ teeth, pitchR, mod, thickness, outerR }, material) {
  const tipR = pitchR - mod; // tips point inward
  const rootR = pitchR + 1.25 * mod;
  const step = TAU / teeth;
  const halfTip = step * 0.26;
  const halfRoot = step * 0.13;

  const shape = new THREE.Shape();
  shape.absarc(0, 0, outerR, 0, TAU, false);
  const hole = new THREE.Path();
  for (let i = 0; i < teeth; i++) {
    const c = i * step;
    const pts = [
      [rootR, c - halfRoot],
      [tipR, c - halfTip],
      [tipR, c + halfTip],
      [rootR, c + halfRoot],
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
    bevelThickness: thickness * 0.1,
    bevelSize: 0.003,
    bevelSegments: 1,
    curveSegments: 64,
  });
  geo.translate(0, 0, -thickness / 2);
  geo.rotateY(Math.PI / 2); // gear plane -> YZ, axis +X
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// External gear standing in the YZ plane with its axis along +X.
function axialGear(teeth, pitchR, thickness, material, holeR = 0) {
  const g = gear({ teeth, radius: pitchR + MOD, thickness, toothDepth: TOOTH_D, holeR }, material);
  g.rotation.y = Math.PI / 2;
  return g;
}

// Axial position of a lathe profile at a given radius — used to make converter
// blades follow the bowl they are welded into.
function profileX(profile, r) {
  const p = [...profile].sort((a, b) => a[0] - b[0]);
  if (r <= p[0][0]) return p[0][1];
  for (let i = 1; i < p.length; i++) {
    if (r <= p[i][0]) {
      const t = (r - p[i - 1][0]) / (p[i][0] - p[i - 1][0] || 1);
      return p[i - 1][1] + (p[i][1] - p[i - 1][1]) * t;
    }
  }
  return p[p.length - 1][1];
}

// Curved vane ring for the torque converter. A converter blade is NOT a fan
// blade at a fixed axial station — it is a thin stamping welded into a spun
// bowl, so its root follows the bowl's own curve and its tip stops at the
// torus centre-plane. Building it with a fixed chord is what made the first
// pass grow spikes straight out through the shell. `stations` is
// [[radius, xAtShell, xAtMouth], ...] running inward -> outward.
function vaneRing({ count, stations, camber }, material) {
  const nS = stations.length;
  const nC = 8;
  const pos = [];
  const uvs = [];
  const idx = [];
  for (let i = 0; i < nS; i++) {
    const [r, xb, xf] = stations[i];
    for (let j = 0; j <= nC; j++) {
      const t = j / nC;
      pos.push(xb + (xf - xb) * t, r, camber * (xf - xb) * Math.sin(Math.PI * t));
      uvs.push(t, i / (nS - 1));
    }
  }
  const row = nC + 1;
  for (let i = 0; i < nS - 1; i++) {
    for (let j = 0; j < nC; j++) {
      const a = i * row + j;
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  material.side = THREE.DoubleSide; // thin stamping, both faces visible
  const grp = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const m = new THREE.Mesh(geo, material);
    m.rotation.x = (i * TAU) / count;
    m.castShadow = true;
    grp.add(m);
  }
  return grp;
}

// A continuous stream of glowing packets riding a curve. Unlike a charge queue
// this never has a head or a tail, so the phase can advance forever: one whole
// phase step per lap and the loop is seamless.
function flowStream(curve, count, size = 0.02) {
  const mat = materials.glow(ACCENT, 1.7);
  mat.transparent = true;
  mat.opacity = 0;
  mat.depthWrite = false;
  const geo = new THREE.SphereGeometry(size, 8, 6);
  const group = new THREE.Group();
  const dots = [];
  for (let i = 0; i < count; i++) {
    const d = new THREE.Mesh(geo, mat);
    group.add(d);
    dots.push(d);
  }
  function set(phase, amount) {
    mat.opacity = amount;
    if (amount <= 0.001) return;
    for (let i = 0; i < count; i++) {
      const t = (((phase + i / count) % 1) + 1) % 1;
      dots[i].position.copy(curve.getPointAt(t));
    }
  }
  return { group, set, mat };
}

// shortest signed difference, for crossfading two angles through a shift
const wrapPi = (a) => Math.atan2(Math.sin(a), Math.cos(a));

// --- gear-train state --------------------------------------------------------
// Only the SUN and the OUTPUT are tabulated; every other member is derived.
// Values are turns per input turn.
const MODE = {
  // TRUE neutral: no clutch is applied, so NOTHING drives the gear train. The
  // engine spins the converter and both clutch drums and stops there — every
  // gear behind them just sits. (An earlier pass reused the stalled-Drive row
  // below for neutral, which spun the sun at twice input speed with no clutch
  // holding anything: a real kinematic lie, not a simplification.)
  N: { s: 0, c: 0 },
  // Drive, held on the brakes — the converter-stall condition. The forward
  // clutch IS applied so the ring is driven, but the car holds the carrier, so
  // the sun is forced backwards at twice the ring's speed. This is the state
  // first gear is built out of, and the one the planetary step demonstrates.
  D0: { s: -2, c: 0 },
  1: { s: -0.8, c: 0.4 },
  2: { s: 0, c: 2 / 3 },
  3: { s: 1, c: 1 },
  R: { s: 1, c: -0.5 },
};

// Which element holds or couples in each gear — the real TorqueFlite table.
// `sprag` is the one-way roller clutch that holds the rear carrier in Drive;
// the low-reverse band does the same job in reverse, where the load can try to
// drive the carrier backwards and a one-way clutch would simply let go.
const APPLIED = {
  N: {},
  D0: { fwd: 1 },
  1: { fwd: 1, sprag: 1 },
  2: { fwd: 1, kick: 1 },
  3: { fwd: 1, direct: 1 },
  R: { direct: 1, low: 1 },
};

// Kept SHORT on purpose: this is one pill on one line near the top of frame,
// and the longest string here decides whether it fits between the text panel
// and the right edge. What is holding is shown by the accent glow, not spelt out.
const READOUT = {
  N: 'Neutral · nothing held',
  D0: 'Drive, stalled · carrier held by the car',
  1: '1st · 2.50 : 1',
  2: '2nd · 1.50 : 1',
  3: '3rd · 1.00 : 1',
  R: 'Reverse · 2.00 : 1',
};

export function buildTransmission({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // ---------------------------------------------------------------- materials
  // roughnessMap MULTIPLIES the base value (map texels average ~0.5), so every
  // mapped preset here is set far higher than it looks: a cast case at a
  // nominal 0.66 lands near 0.33 and turns a big curved flank into a softbox
  // mirror. These numbers are the ones that stopped clipping.
  const cast = materials.aluminum(0x99a1a9);
  cast.roughness = 1;
  cast.normalScale.set(0.55, 0.55); // cast texture, deliberately stronger than the preset
  const castDark = materials.aluminum(0x8d959d);
  castDark.roughness = 1;
  const caseWall = materials.aluminum(0x99a1a9);
  caseWall.roughness = 1;
  caseWall.normalScale.set(0.55, 0.55);
  caseWall.side = THREE.DoubleSide;
  const bellLiner = new THREE.MeshPhysicalMaterial({
    color: 0x3b4046,
    metalness: 0.55,
    roughness: 0.92,
    side: THREE.BackSide,
  });
  // map-free on purpose: brushedMap across a big flat pan striped it like a
  // radiator core, which is exactly what an oil pan must not look like
  const stamped = gearSteel(0x8a9199, 0.5);
  const convSteel = materials.brushedSteel(0xb2bac4);
  convSteel.roughness = 0.92;
  const convCut = drumSteel(0xaab2bc, 0.6); // sectioned shells: map-free, two-sided
  const bowlSteel = drumSteel(0x9aa2ac, 0.72); // impeller bowl, seen from inside
  const vaneSteel = gearSteel(0x9fa7b1, 0.62);
  const blackPoly = materials.polymer(0x1d2024);
  const copper = gearSteel(0xb87333, 0.45);
  const pistonMat = gearSteel(0xb9a08c, 0.55);
  const hardSteel = gearSteel(0xc6ccd4, 0.36);
  const pinMat = gearSteel(0x9aa2ac, 0.46);
  const planetMat = gearSteel(0xbfc6ce, 0.36);

  // Each glowing element needs its OWN material instance, or applying one band
  // lights the other.
  const frictionFwd = materials.polymer(0x53412f);
  const frictionDirect = materials.polymer(0x53412f);
  const frictionLock = materials.polymer(0x53412f);
  for (const m of [frictionFwd, frictionDirect, frictionLock]) m.roughness = 0.9;
  const bandKickMat = drumSteel(0x555c64, 0.6);
  const bandLowMat = drumSteel(0x555c64, 0.6);
  const rollerMat = gearSteel(0xcbd1d8, 0.22);

  const mSun = gearSteel(TINT.sun);
  const mAnn = gearSteel(TINT.annulus);
  const mOut = gearSteel(TINT.output);
  const sSun = gearSteel(TINT.sun, 0.44);
  const sAnn = gearSteel(TINT.annulus, 0.44);
  const sOut = gearSteel(TINT.output, 0.44);
  const sReact = gearSteel(TINT.reaction, 0.44);
  const sIn = gearSteel(TINT.input, 0.44);
  const dSun = drumSteel(TINT.sun, 0.46);
  const dOut = drumSteel(TINT.output, 0.46);
  const dReact = drumSteel(TINT.reaction, 0.46);
  const dIn = drumSteel(TINT.input, 0.46);

  const glowMats = [frictionFwd, frictionDirect, bandKickMat, bandLowMat, rollerMat];
  for (const m of glowMats) {
    m.emissive = new THREE.Color(ACCENT);
    m.emissiveIntensity = 0;
  }

  // ------------------------------------------------------------------ staging
  group.add(studioPlinth({ w: 4.3, h: 0.26, d: 2.1 }));
  const cradleMat = materials.paintedMetal(0x24272c);
  cradleMat.clearcoat = 0.4;
  cradleMat.clearcoatRoughness = 0.35;
  for (const [cx, cw, ctop] of [
    [-1.34, 0.46, AX - BELL_R * 0.86],
    [1.2, 0.3, AX - 0.3],
  ]) {
    const h = ctop - 0.26;
    const block = beveledBox(cw, h, 0.62, cradleMat, 0.03);
    block.position.set(cx, 0.26 + h / 2, 0);
    block.receiveShadow = true;
    group.add(block);
  }

  // -------------------------------------------------------- rotating members
  // Each member turns as ONE rigid thing; rotation.x is its only freedom.
  const inputMember = new THREE.Group();
  const sunMember = new THREE.Group();
  const annMember = new THREE.Group();
  const outMember = new THREE.Group();
  const reactMember = new THREE.Group();
  const impMember = new THREE.Group();
  const turbMember = new THREE.Group();
  const statorMember = new THREE.Group();
  const pumpOuter = new THREE.Group();
  pumpOuter.position.y = 0.019; // gerotor eccentricity — it spins about ITS centre
  const trainRoot = new THREE.Group();
  trainRoot.position.y = AX;
  trainRoot.add(
    inputMember,
    sunMember,
    annMember,
    outMember,
    reactMember,
    impMember,
    turbMember,
    statorMember,
    pumpOuter,
  );
  group.add(trainRoot);

  const staticRoot = new THREE.Group(); // case-fixed hardware, at axis height
  staticRoot.position.y = AX;
  group.add(staticRoot);

  const caseMeshes = [];
  const addCase = (m, parent = staticRoot) => {
    parent.add(m);
    caseMeshes.push(m);
    return m;
  };

  // ====================================================== TORQUE CONVERTER ===
  // Cover + impeller shell are ONE welded member driven by the engine. The
  // turbine sits inside it driving the input shaft; the stator sits between
  // their inner mouths on a one-way clutch.
  // Every shell here exists TWICE: the real full surface of revolution that
  // turns with its member, and a static half used for the sectioned steps. A
  // converter shell is a featureless spun bowl, so a half that never rotates is
  // indistinguishable from a cut through one that does — and it is the only way
  // to see the three wheels at all, since each bowl completely encloses its own
  // blades.
  const HALF_PHI = [Math.PI / 2, Math.PI]; // keeps the -Z half, away from camera
  const COVER_PROFILE = [
    [0.09, CONV_X - 0.229],
    [0.2, CONV_X - 0.228],
    [0.36, CONV_X - 0.222],
    [0.44, CONV_X - 0.205],
    [0.52, CONV_X - 0.158],
    [0.553, CONV_X - 0.078],
    [0.555, CONV_X - 0.02],
  ];
  const TURB_PROFILE = [
    [0.1, CONV_X - 0.155],
    [0.2, CONV_X - 0.162],
    [0.36, CONV_X - 0.15],
    [0.47, CONV_X - 0.105],
    [0.525, CONV_X - 0.03],
    [0.53, CONV_X + 0.02],
  ];
  const coverDome = axialLathe(COVER_PROFILE, convSteel);
  const coverRim = axialCyl(CONV_R, CONV_R, CONV_X - 0.03, CONV_X + 0.04, convSteel);
  const coverFace = annulus(0.155, 0.365, FACE_X, 0.012, hardSteel);
  const coverLugs = boltCircle(4, 0.44, 0.05, convSteel, 0.05);
  coverLugs.rotation.z = Math.PI / 2; // ring lies in YZ, bolt axes along X
  coverLugs.position.x = CONV_X - 0.2;
  // the impeller bowl is DoubleSide: once the front is sectioned away we are
  // looking straight into its inner face
  const IMP_PROFILE = [
    [0.555, CONV_X + 0.02],
    [0.545, CONV_X + 0.08],
    [0.48, CONV_X + 0.17],
    [0.36, CONV_X + 0.225],
    [0.2, CONV_X + 0.238],
    [0.1, CONV_X + 0.235],
  ];
  const impShell = axialLathe(IMP_PROFILE, bowlSteel);
  // Both wheels' blades run from their own shell to the torus centre-plane —
  // the surface halfway between the two bowls — so they exactly fill the
  // doughnut and neither can poke through the other's shell.
  const midX = (r) => (profileX(IMP_PROFILE, r) + profileX(TURB_PROFILE, r)) / 2;
  const bladeStations = (profile, rIn, rOut, n = 7) =>
    Array.from({ length: n }, (_, i) => {
      const r = rIn + ((rOut - rIn) * i) / (n - 1);
      return [r, profileX(profile, r), midX(r)];
    });
  // The three wheels sit inches apart facing each other, so they need to read
  // apart at a glance: the impeller darker (it is the far one, on the engine),
  // the turbine light in the input member's own tint, the stator cool — it is
  // the reaction member, the one thing in there that stands still.
  const impVanes = vaneRing(
    { count: 24, stations: bladeStations(IMP_PROFILE, 0.15, 0.5), camber: 0.45 },
    gearSteel(0x8b929b, 0.62),
  );
  const pumpDrive = axialCyl(0.085, 0.085, CONV_X + 0.225, PUMP_X + 0.075, sIn);
  impMember.add(coverDome, coverRim, coverFace, coverLugs, impShell, impVanes, pumpDrive);

  const coverDomeHalf = axialLathe(COVER_PROFILE, convCut, 40, ...HALF_PHI);
  const coverRimHalf = axialCyl(CONV_R, CONV_R, CONV_X - 0.03, CONV_X + 0.04, convCut, {
    open: true,
    thetaStart: Math.PI / 2,
    thetaLength: Math.PI,
  });
  const turbShellHalf = axialLathe(TURB_PROFILE, convCut, 40, ...HALF_PHI);
  staticRoot.add(coverDomeHalf, coverRimHalf, turbShellHalf);

  const turbShell = axialLathe(TURB_PROFILE, gearSteel(0xa8b0ba, 0.62));
  const turbVanes = vaneRing(
    { count: 20, stations: bladeStations(TURB_PROFILE, 0.15, 0.5), camber: -0.45 },
    gearSteel(0xc9cfd6, 0.6),
  );
  const turbHub = axialCyl(0.088, 0.088, CONV_X - 0.16, CONV_X + 0.06, sIn);
  const lockPiston = annulus(0.15, 0.355, CONV_X - 0.171, 0.022, pistonMat);
  const lockFriction = annulus(0.17, 0.345, CONV_X - 0.192, 0.012, frictionLock);
  turbMember.add(turbShell, turbVanes, turbHub, lockPiston, lockFriction);
  turbVanes.traverse((o) => {
    if (o.isMesh) o.userData.noOcclude = true;
  });

  const statorHub = axialCyl(0.115, 0.115, CONV_X - 0.055, CONV_X + 0.055, gearSteel(0x9098a2, 0.5));
  const statorVanes = vaneRing(
    {
      count: 12,
      stations: [0.115, 0.145, 0.175, 0.205].map((r) => [r, CONV_X - 0.05, CONV_X + 0.05]),
      camber: 0.55,
    },
    gearSteel(0x9fb4bb, 0.58),
  );
  statorMember.add(statorHub, statorVanes);
  statorMember.traverse((o) => {
    if (o.isMesh) o.userData.noOcclude = true;
  });

  // Fluid: one closed cross-section loop, revolved. Each packet carries a phase
  // ALONG the loop and an azimuth AROUND the axis, so the oil genuinely
  // corkscrews the way it does in a real converter instead of sliding round a
  // flat ring.
  const LOOP = new THREE.CatmullRomCurve3(
    [
      [0.15, 0.2],
      [0.17, 0.36],
      [0.11, 0.46],
      [-0.01, 0.49],
      [-0.1, 0.45],
      [-0.13, 0.33],
      [-0.11, 0.19],
      [-0.05, 0.135],
      [0.04, 0.125],
      [0.11, 0.14],
    ].map(([dx, r]) => new THREE.Vector3(CONV_X + dx, r, 0)),
    true,
    'catmullrom',
    0.4,
  );
  const FLUID_AZ = 5;
  const FLUID_PER_AZ = 6;
  const fluidMat = materials.glow(ACCENT, 1.7);
  fluidMat.transparent = true;
  fluidMat.opacity = 0;
  fluidMat.depthWrite = false;
  const fluidDots = [];
  const fluidGeo = new THREE.SphereGeometry(0.02, 10, 8);
  for (let a = 0; a < FLUID_AZ; a++) {
    for (let k = 0; k < FLUID_PER_AZ; k++) {
      const d = new THREE.Mesh(fluidGeo, fluidMat);
      d.userData.az = (a * TAU) / FLUID_AZ;
      d.userData.p = k / FLUID_PER_AZ;
      fluidDots.push(d);
      trainRoot.add(d);
    }
  }

  // ============================================================== OIL PUMP ===
  // Internal-gear pump on the converter hub: a 10-tooth inner rotor driving a
  // 12-tooth outer. It makes line pressure whenever the ENGINE turns.
  addCase(
    axialLathe(
      [
        [0.1, PUMP_X - 0.062],
        [0.42, PUMP_X - 0.06],
        [0.44, PUMP_X - 0.03],
      ],
      castDark,
    ),
  );
  addCase(
    axialLathe(
      [
        [0.16, PUMP_X + 0.075],
        [0.44, PUMP_X + 0.078],
      ],
      castDark,
    ),
  );
  const pumpInner = axialGear(10, 0.085, 0.055, gearSteel(0xb4bcc6, 0.3), 0.05);
  pumpInner.position.x = PUMP_X + 0.01;
  impMember.add(pumpInner);
  const pumpOuterRotor = ringGear(
    { teeth: 12, pitchR: 0.104, mod: 0.017, thickness: 0.055, outerR: 0.15 },
    gearSteel(0xa8b0ba, 0.34),
  );
  pumpOuterRotor.position.x = PUMP_X + 0.01;
  pumpOuter.add(pumpOuterRotor);

  // ========================================================= CLUTCH DRUMS ===
  // Radially NESTED, the way a real box packs them: the forward-clutch retainer
  // sits inside the direct-clutch drum, and the direct clutch's steel plates
  // spline to the outside of that same retainer.
  const inputShaft = axialCyl(0.05, 0.05, CONV_X - 0.16, -0.78, sIn);
  const rcBack = axialLathe(
    [
      [0.05, -0.818],
      [0.26, -0.82],
      [0.285, -0.79],
    ],
    sIn,
  );
  // Drum WALLS come in two versions: the real full cylinder that turns with its
  // member, and a static half-shell used for the cutaway step. A drum wall is a
  // featureless turned surface, so a half that never rotates is visually
  // identical to a cut through one that does — and it lets the camera see the
  // pack inside without ghosting metal.
  const HALF = { open: true, thetaStart: Math.PI / 2, thetaLength: Math.PI };
  const rcWall = axialCyl(RCL_R, RCL_R, -0.79, -0.46, dIn, { open: true });
  const rcWallHalf = axialCyl(RCL_R, RCL_R, -0.79, -0.46, dIn, HALF);
  staticRoot.add(rcWallHalf);
  inputMember.add(inputShaft, rcBack, rcWall);

  // Direct-clutch drum / sun driving shell: one long cup that reaches over the
  // whole front planetary and hooks the sun from BETWEEN the two gearsets —
  // the only route that clears the forward clutch's own output. That tunnel is
  // exactly what hides the front gearset in a real teardown, so it lifts off
  // (setShell) whenever a step needs to see the planetary.
  const fcDrum = axialCyl(DRUM_R, DRUM_R, -0.8, -0.42, dSun, { open: true });
  const fcDrumHalf = axialCyl(DRUM_R, DRUM_R, -0.8, -0.42, dSun, HALF);
  staticRoot.add(fcDrumHalf);
  const sunTunnel = axialCyl(DRUM_R, DRUM_R, -0.42, SUN_WEB_X - 0.02, dSun, { open: true });
  const fcBulkhead = annulus(0.175, DRUM_R - 0.005, -0.44, 0.026, sSun);
  const sunWeb = axialLathe(
    [
      [DRUM_R, SUN_WEB_X - 0.02],
      [DRUM_R, SUN_WEB_X + 0.002],
      [0.2, SUN_WEB_X + 0.024],
      [SUN_TUBE_R, SUN_WEB_X + 0.026],
    ],
    sSun,
  );
  const sunTube = axialCyl(SUN_TUBE_R, SUN_TUBE_R, 0.07, 0.55, sSun);
  const sunFront = axialGear(S_T, SUN_R, GEAR_T, mSun, SUN_TUBE_R);
  sunFront.position.x = FP_X;
  const sunRear = axialGear(S_T, SUN_R, GEAR_T, mSun, SUN_TUBE_R);
  sunRear.position.x = RP_X;
  sunMember.add(fcDrum, sunTunnel, fcBulkhead, sunWeb, sunTube, sunFront, sunRear);

  // clutch packs — friction plates on one member, steels on the other
  const fcFriction = [];
  const fcSteel = [];
  const rcFriction = [];
  const rcSteel = [];
  for (let i = 0; i < 5; i++) {
    const x = -0.74 + i * 0.048;
    const f = annulus(0.292, DRUM_R - 0.008, x, 0.014, frictionDirect);
    sunMember.add(f);
    fcFriction.push(f);
    const s = annulus(0.288, DRUM_R - 0.012, x + 0.024, 0.011, hardSteel);
    inputMember.add(s);
    fcSteel.push(s);

    const rf = annulus(0.168, RCL_R - 0.01, x, 0.014, frictionFwd);
    annMember.add(rf);
    rcFriction.push(rf);
    const rs = annulus(0.164, RCL_R - 0.014, x + 0.024, 0.011, hardSteel);
    inputMember.add(rs);
    rcSteel.push(rs);
  }
  const fcPiston = annulus(0.235, DRUM_R - 0.006, -0.478, 0.03, pistonMat);
  sunMember.add(fcPiston);
  const rcPiston = annulus(0.13, RCL_R - 0.008, -0.775, 0.03, pistonMat);
  inputMember.add(rcPiston);

  // forward clutch output -> the front ring gear
  const annHub = axialCyl(ANN_R, ANN_R, -0.46, 0.03, sAnn);
  const annFlare = axialLathe(
    [
      [ANN_R, 0.028],
      [0.24, 0.045],
      [RING_OUT, 0.068],
      [RING_OUT, 0.075],
    ],
    sAnn,
  );
  const ringFront = ringGear(
    { teeth: R_T, pitchR: RING_R, mod: MOD, thickness: GEAR_T, outerR: RING_OUT },
    mAnn,
  );
  ringFront.position.x = FP_X;
  annMember.add(annHub, annFlare, ringFront);

  // A planet carrier is a SPIDER, not a disc — a hub with one arm per planet
  // pin and a big open window between each pair. That is how a real carrier is
  // made (it has to be, or there would be no way to see or oil the planets),
  // and it is the only reason the camera can look into either gearset at all:
  // the first pass used a solid plate and it walled the whole set off.
  function carrierSpider(x, thickness, rHub, rIn, rOut, material) {
    const grp = new THREE.Group();
    grp.add(annulus(rHub, rIn, x, thickness, material));
    for (let i = 0; i < N_PL; i++) {
      const pa = (i * TAU) / N_PL;
      const arm = beveledBox(thickness, rOut - rIn + 0.03, 0.075, material, 0.008);
      const r = (rIn + rOut) / 2 - 0.012;
      arm.position.set(x, r * Math.sin(pa), -r * Math.cos(pa));
      arm.rotation.x = pa - Math.PI / 2; // its long axis points radially outward
      grp.add(arm);
    }
    return grp;
  }

  // ======================================================== OUTPUT MEMBER ===
  // Front carrier + rear ring gear + output shaft are ONE part: the carrier is
  // splined to the shaft, and so is the rear annulus.
  outMember.add(
    annulus(0.178, 0.228, FP_X - 0.075, 0.016, sOut), // open-front carrier ring
    carrierSpider(FP_X + 0.075, 0.024, OUT_R + 0.004, 0.115, 0.235, sOut),
    axialCyl(OUT_R, OUT_R, FP_X + 0.06, TAIL_X1 + 0.02, sOut),
  );
  const ringRear = ringGear(
    { teeth: R_T, pitchR: RING_R, mod: MOD, thickness: GEAR_T, outerR: RING_OUT },
    mOut,
  );
  ringRear.position.x = RP_X;
  outMember.add(
    ringRear,
    axialCyl(RING_OUT, RING_OUT, RP_X + 0.055, 0.61, dOut, { open: true }),
    axialLathe(
      [
        [RING_OUT, 0.608],
        [0.24, 0.632],
        [OUT_R + 0.02, 0.662],
      ],
      sOut,
    ),
    axialCyl(0.14, 0.16, TAIL_X1 + 0.02, TAIL_X1 + 0.08, sOut),
  );
  for (const s of [1, -1]) {
    const ear = beveledBox(0.16, 0.075, 0.13, sOut, 0.02);
    ear.position.set(YOKE_X - 0.07, 0, s * 0.13);
    outMember.add(ear);
  }

  // ================================================== REAR CARRIER MEMBER ===
  reactMember.add(
    carrierSpider(RP_X - 0.078, 0.022, 0.115, 0.15, 0.235, sReact),
    carrierSpider(RP_X + 0.108, 0.022, 0.09, 0.13, 0.235, sReact),
    axialLathe(
      [
        [0.235, RP_X + 0.115],
        [0.31, LR_X0 - 0.02],
        [LR_R, LR_X0],
      ],
      sReact,
    ),
    axialCyl(LR_R, LR_R, LR_X0, LR_X1, dReact, { open: true }),
    annulus(0.16, LR_R, LR_X1, 0.022, sReact),
    axialCyl(0.16, 0.16, LR_X1, 0.95, sReact),
  );

  // ===================================================== PLANET ASSEMBLIES ===
  // Four planets per set, each on a holder at the carrier radius. The holder's
  // angular frame carries a -PI/2 offset so it matches the gear meshes (which
  // sit in the YZ plane via rotation.y = PI/2); [PLANET_PHASE] is written in
  // that same frame, and the offset cancels out of the formula.
  function makePlanets(carrier, x) {
    const spinners = [];
    for (let i = 0; i < N_PL; i++) {
      const pa = (i * TAU) / N_PL;
      const holder = new THREE.Group();
      holder.position.set(x, CARRIER_R * Math.sin(pa), -CARRIER_R * Math.cos(pa));
      const spin = new THREE.Group();
      spin.add(axialGear(P_T, PL_R, GEAR_T, planetMat, 0.026));
      holder.add(spin, axialCyl(0.024, 0.024, -0.105, 0.105, pinMat, { seg: 14 }));
      carrier.add(holder);
      spinners.push(spin);
    }
    return spinners;
  }
  const frontPlanets = makePlanets(outMember, FP_X);
  const rearPlanets = makePlanets(reactMember, RP_X);

  // ========================================================== ROLLER CLUTCH ==
  // The one-way clutch that holds the rear carrier in Drive: twelve rollers
  // wedged between the carrier's inner race and a boss cast into the case.
  staticRoot.add(axialCyl(0.205, 0.205, 0.88, 0.95, drumSteel(0x8d959d, 0.7), { open: true }));
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12;
    const r = axialCyl(0.019, 0.019, 0.888, 0.942, rollerMat, { seg: 12 });
    r.position.set(0, 0.182 * Math.cos(a), 0.182 * Math.sin(a));
    r.rotation.x = a + 0.35;
    staticRoot.add(r);
  }

  // ================================================================== BANDS ==
  // A steel strap wrapping a drum, pulled tight by a hydraulic servo on the
  // case roof. The gap in the strap faces up, where the servo strut lands.
  function makeBand(x0, x1, radius, mat) {
    const gapHalf = 0.42;
    const start = 1.5 * Math.PI + gapHalf;
    const arc = { open: true, thetaStart: start, thetaLength: TAU - 2 * gapHalf, seg: 48 };
    // matching half-arc, so the band does not sit in front of the pack when a
    // step cuts the drum away
    const cutArc = { open: true, thetaStart: Math.PI / 2, thetaLength: Math.PI, seg: 32 };
    const mid = (x0 + x1) / 2;
    const grp = new THREE.Group();
    const full = new THREE.Group();
    const half = new THREE.Group();
    full.add(
      axialCyl(radius, radius, x0, x1, mat, arc),
      axialCyl(radius + 0.012, radius + 0.012, mid - 0.016, mid + 0.016, mat, arc),
    );
    half.add(
      axialCyl(radius, radius, x0, x1, mat, cutArc),
      axialCyl(radius + 0.012, radius + 0.012, mid - 0.016, mid + 0.016, mat, cutArc),
    );
    half.visible = false;
    grp.add(full, half);
    const anchor = beveledBox(x1 - x0, 0.05, 0.05, gearSteel(0x777f87, 0.6), 0.01);
    anchor.position.set(mid, radius + 0.03, -0.075);
    const strut = beveledBox(x1 - x0 - 0.03, 0.05, 0.05, gearSteel(0x777f87, 0.6), 0.01);
    strut.position.set(mid, radius + 0.03, 0.075);
    grp.add(anchor, strut);
    // A band is a strap a few millimetres thick with a bit of small hardware on
    // top. Counting any of it as an occluder dims its own callout and every
    // label for the drum it wraps — flag the whole group AFTER the anchor and
    // strut are in it, or they stay occluders.
    grp.traverse((o) => {
      if (o.isMesh) o.userData.noOcclude = true;
    });
    staticRoot.add(grp);

    const servoY = CASE_R + 0.1;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.17, 24), cast);
    body.position.set(mid, servoY, 0.075);
    body.castShadow = true;
    addCase(body);
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.1, 0.03, 24), castDark);
    cap.position.set(mid, servoY + 0.09, 0.075);
    addCase(cap);
    const rodMesh = rod(0.026, servoY - radius - 0.03, hardSteel);
    rodMesh.position.set(mid, radius + 0.03, 0.075);
    rodMesh.userData.noOcclude = true; // thin push-rod, same class as the strut
    staticRoot.add(rodMesh);

    strut.userData.y0 = strut.position.y;
    return { grp, full, half, strut, rod: rodMesh };
  }
  const kickBand = makeBand(-0.72, -0.56, DRUM_R + 0.013, bandKickMat);
  const lowBand = makeBand(0.7, 0.84, LR_R + 0.013, bandLowMat);

  // ================================================================== CASE ===
  // The bellhousing is a genuine open bell — you see the converter's front
  // cover through the mouth. Its inside gets a dark BackSide liner (inset so it
  // cannot z-fight) so the cavity never renders as a polished concave mirror.
  const bellProfile = [
    [BELL_R, BELL_X0],
    [BELL_R, BELL_X0 + 0.05],
    [0.74, BELL_X0 + 0.075],
    [0.7, BELL_X0 + 0.16],
    [0.62, BELL_X0 + 0.34],
    [0.53, BELL_X0 + 0.6],
    [0.47, BELL_X1],
  ];
  addCase(axialLathe(bellProfile, cast));
  addCase(axialLathe(bellProfile.map(([r, x]) => [r - 0.012, x]), bellLiner, 48));
  addCase(annulus(BELL_R - 0.055, BELL_R, BELL_X0 + 0.012, 0.024, castDark));
  const bellBolts = boltCircle(10, BELL_R - 0.03, 0.028, castDark, 0.03);
  bellBolts.rotation.z = Math.PI / 2;
  bellBolts.position.x = BELL_X0 + 0.03;
  addCase(bellBolts);

  // main case: full round outside the pan opening, open-bottomed over it
  addCase(axialCyl(CASE_R, 0.47, CASE_X0, PAN_X0, cast));
  addCase(axialCyl(CASE_R, CASE_R, PAN_X1, CASE_X1, cast));
  const panArc = { open: true, thetaStart: Math.PI / 2 + PAN_GAP, thetaLength: TAU - 2 * PAN_GAP };
  addCase(axialCyl(CASE_R, CASE_R, PAN_X0, PAN_X1, caseWall, panArc));
  for (const rx of [-0.5, -0.15, 0.2, 0.55]) {
    addCase(axialCyl(CASE_R + 0.016, CASE_R + 0.016, rx - 0.02, rx + 0.02, caseWall, panArc));
  }
  for (const s of [1, -1]) {
    const rail = addCase(beveledBox(PAN_X1 - PAN_X0 + 0.08, 0.03, 0.07, cast, 0.008));
    rail.position.set((PAN_X0 + PAN_X1) / 2, PAN_RAIL_Y - AX, s * (PAN_HALF_Z + 0.02));
  }
  addCase(
    axialLathe(
      [
        [CASE_R, CASE_X1 - 0.02],
        [0.42, CASE_X1 + 0.03],
        [0.33, CASE_X1 + 0.2],
        [0.24, CASE_X1 + 0.45],
        [0.185, TAIL_X1 - 0.05],
        [0.17, TAIL_X1],
      ],
      cast,
    ),
  );
  const tailPad = addCase(beveledBox(0.3, 0.06, 0.26, cast, 0.02));
  tailPad.position.set(CASE_X1 + 0.34, 0.3, 0);

  // oil pan
  const panBody = addCase(
    beveledBox(PAN_X1 - PAN_X0, PAN_RAIL_Y - PAN_Y0, PAN_HALF_Z * 2, stamped, 0.05),
    group,
  );
  panBody.position.set((PAN_X0 + PAN_X1) / 2, (PAN_RAIL_Y + PAN_Y0) / 2, 0);
  const panFlange = addCase(
    beveledBox(PAN_X1 - PAN_X0 + 0.06, 0.022, PAN_HALF_Z * 2 + 0.06, stamped, 0.008),
    group,
  );
  panFlange.position.set((PAN_X0 + PAN_X1) / 2, PAN_RAIL_Y - 0.012, 0);
  const boltGeo = new THREE.CylinderGeometry(0.017, 0.017, 0.026, 6);
  for (let i = 0; i < 7; i++) {
    const bx = PAN_X0 + 0.06 + (i * (PAN_X1 - PAN_X0 - 0.12)) / 6;
    for (const s of [1, -1]) {
      const b = addCase(new THREE.Mesh(boltGeo, castDark), group);
      b.position.set(bx, PAN_RAIL_Y + 0.004, s * (PAN_HALF_Z + 0.022));
    }
  }
  // dipstick tube + cooler lines — the details that say "car part"
  addCase(
    tubeAlong(
      [
        [PAN_X1 - 0.1, PAN_RAIL_Y - 0.06, PAN_HALF_Z + 0.02],
        [PAN_X1 + 0.06, AX - 0.1, CASE_R + 0.06],
        [PAN_X1 + 0.02, AX + 0.42, CASE_R + 0.1],
        [PAN_X1 - 0.06, AX + 0.6, CASE_R + 0.02],
      ],
      0.022,
      gearSteel(0x9aa2ac, 0.42),
    ),
    group,
  );
  for (const [dy, dz] of [
    [0.16, -0.3],
    [-0.02, -0.34],
  ]) {
    addCase(
      tubeAlong(
        [
          [CASE_X0 + 0.12, AX + dy, dz],
          [BELL_X0 + 0.5, AX + dy + 0.08, dz - 0.22],
          [BELL_X0 + 0.14, AX + dy + 0.06, dz - 0.3],
        ],
        0.026,
        gearSteel(0x8e959d, 0.4),
      ),
      group,
    );
  }

  // ============================================================ VALVE BODY ===
  const vbGrp = new THREE.Group();
  group.add(vbGrp);
  const vbPlate = beveledBox(1.06, 0.075, 0.58, castDark, 0.012);
  vbPlate.position.set(0, VB_Y, 0);
  const vbSep = beveledBox(1.08, 0.012, 0.6, gearSteel(0xa8b0ba, 0.4), 0.004);
  vbSep.position.set(0, VB_Y - 0.046, 0);
  vbGrp.add(vbPlate, vbSep);
  for (let i = 0; i < 4; i++) {
    const bz = -0.21 + i * 0.14;
    const bore = beveledBox(0.72, 0.03, 0.052, gearSteel(0x6e757d, 0.7), 0.006);
    bore.position.set(-0.05, VB_Y + 0.045, bz);
    const spool = new THREE.Mesh(
      new THREE.CylinderGeometry(0.019, 0.019, 0.5, 16),
      hardSteel,
    );
    spool.rotation.z = Math.PI / 2;
    spool.position.set(-0.09 + (i % 2) * 0.05, VB_Y + 0.052, bz);
    vbGrp.add(bore, spool);
  }
  for (let i = 0; i < 3; i++) {
    const sx = -0.44 + i * 0.12;
    const body = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.13, 20), blackPoly);
    body.rotation.x = Math.PI / 2;
    body.position.set(sx, VB_Y + 0.07, 0.28);
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.05, 20), copper);
    band.rotation.x = Math.PI / 2;
    band.position.set(sx, VB_Y + 0.07, 0.29);
    vbGrp.add(body, band);
  }
  // The copy calls this a maze milled into aluminium, so the maze has to be on
  // a face the camera can actually see. The spool bores lie on the top deck,
  // hidden under the gear train from any angle that also frames the pan — so
  // the passages and the bore plugs go on the pan-side flank as well.
  const chanMat = gearSteel(0x5c636b, 0.85);
  const PASSAGES = [
    [-0.42, 0.02, 0.5],
    [-0.05, 0.024, 0.62],
    [0.3, -0.012, 0.4],
    [-0.2, -0.026, 0.66],
    [0.34, 0.026, 0.3],
  ];
  for (const [cx, cy, len] of PASSAGES) {
    const run = beveledBox(len, 0.014, 0.012, chanMat, 0.004);
    run.position.set(cx, VB_Y + cy, 0.293);
    vbGrp.add(run);
  }
  for (const [cx, cy] of [
    [-0.17, 0.02],
    [0.1, -0.012],
    [0.24, 0.024],
  ]) {
    const jog = beveledBox(0.014, 0.05, 0.012, chanMat, 0.004);
    jog.position.set(cx, VB_Y + cy, 0.293);
    vbGrp.add(jog);
  }
  for (let i = 0; i < 4; i++) {
    const plug = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.022, 14), hardSteel);
    plug.rotation.x = Math.PI / 2;
    plug.position.set(-0.4 + i * 0.26, VB_Y - 0.002, 0.292);
    vbGrp.add(plug);
  }

  const filter = beveledBox(0.62, 0.055, 0.36, blackPoly, 0.02);
  filter.position.set(-0.02, PAN_Y0 + 0.085, 0);
  const filterNeck = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, 0.12, 16),
    gearSteel(0x8e959d, 0.6),
  );
  filterNeck.position.set(-0.28, PAN_Y0 + 0.15, 0);
  vbGrp.add(filter, filterNeck);

  // hydraulic circuit: suction -> pump -> valve body -> the element commanded
  const feeds = {};
  function feedTube(key, points) {
    const t = tubeAlong(points, 0.019, gearSteel(0x8a919a, 0.5));
    // a 5 mm pipe threading over the case should not dim the callout for
    // whatever it happens to cross in front of
    t.userData.noOcclude = true;
    vbGrp.add(t);
    const s = flowStream(t.userData.curve, 8, 0.021);
    vbGrp.add(s.group);
    feeds[key] = s;
  }
  feedTube('suction', [
    [-0.28, PAN_Y0 + 0.16, 0.02],
    [-0.62, PAN_Y0 + 0.34, 0.04],
    [PUMP_X + 0.02, AX - 0.38, 0.07],
    [PUMP_X + 0.03, AX - 0.2, 0.09],
  ]);
  feedTube('line', [
    [PUMP_X + 0.03, AX - 0.2, -0.09],
    [PUMP_X + 0.12, AX - 0.44, -0.17],
    [-0.55, VB_Y + 0.11, -0.22],
    [-0.28, VB_Y + 0.09, -0.24],
  ]);
  feedTube('direct', [
    [-0.34, VB_Y + 0.07, -0.12],
    [-0.5, AX - 0.3, -0.18],
    [-0.63, AX - 0.04, -0.32],
    [-0.63, AX + 0.18, -0.34],
  ]);
  feedTube('fwd', [
    [-0.13, VB_Y + 0.07, -0.04],
    [-0.3, AX - 0.34, -0.12],
    [-0.55, AX - 0.1, -0.22],
    [-0.66, AX + 0.02, -0.24],
  ]);
  feedTube('kick', [
    [-0.3, VB_Y + 0.07, 0.17],
    [-0.55, AX - 0.2, 0.31],
    [-0.68, AX + 0.3, 0.25],
    [-0.64, AX + CASE_R + 0.02, 0.075],
  ]);
  feedTube('low', [
    [0.32, VB_Y + 0.07, 0.17],
    [0.6, AX - 0.2, 0.31],
    [0.76, AX + 0.28, 0.26],
    [0.77, AX + CASE_R + 0.02, 0.075],
  ]);

  // ================================================================ LABELS ===
  // Every callout is anchored to a NON-rotating parent at a fixed point on the
  // part it names: a pill riding a drum at five turns a second is unreadable.
  const labels = calloutSets([
    'exterior',
    'internal',
    'converter',
    'lockup',
    'planet',
    'clutch',
    'hydraulic',
    'ratios',
    'drive',
  ]);
  const A = (set, text, offset, dir, len) => labels.add(set, staticRoot, text, offset, dir, len);
  const G = (set, text, offset, dir, len) => labels.add(set, group, text, offset, dir, len);

  // Leader direction matters more than it looks: a pill whose leader points
  // LEFT (any dir between 90 and 270) hangs its text to the left of the anchor,
  // and on this machine — which is long, and reads left-to-right from the
  // engine end — that walks it straight under the text panel. Every dir here is
  // inside (-90, 90) so the text always grows away from the panel.
  A('exterior', 'Bellhousing', [BELL_X0 + 0.3, 0.58, 0.3], 58, 62);
  A('exterior', 'Transmission case', [0.16, CASE_R - 0.02, 0.22], 74, 60);
  G('exterior', 'Oil pan', [0.3, PAN_Y0 + 0.08, 0.3], -56, 60);
  A('exterior', 'Extension housing', [1.34, 0.17, 0.11], 40, 62);
  A('exterior', 'Output yoke', [YOKE_X - 0.09, 0.05, 0.15], 18, 56);
  G('exterior', 'Dipstick tube', [PAN_X1 - 0.06, AX + 0.58, CASE_R + 0.02], 72, 50);

  A('internal', 'Torque converter', [CONV_X - 0.06, 0.48, 0.24], 52, 70);
  A('internal', 'Oil pump', [PUMP_X, 0.38, 0.16], 76, 62);
  A('internal', 'Direct clutch drum', [-0.66, DRUM_R - 0.02, 0.12], 86, 58);
  A('internal', 'Forward clutch', [-0.3, RCL_R - 0.03, 0.1], 58, 64);
  A('internal', 'Front planetary set', [FP_X, RING_OUT - 0.02, 0.09], 72, 56);
  A('internal', 'Rear planetary set', [RP_X, RING_OUT, 0.09], 48, 58);
  A('internal', 'Low-reverse drum', [(LR_X0 + LR_X1) / 2, LR_R - 0.03, 0.12], 34, 58);
  A('internal', 'Output shaft', [1.24, -OUT_R, 0.05], -34, 52);
  G('internal', 'Valve body', [0.12, VB_Y - 0.03, 0.28], -44, 60);

  // anchored on the impeller's own SHELL rim, the part of it you can actually
  // see past the turbine from the engine end
  A('converter', 'Impeller — engine side', [CONV_X + 0.03, 0.3, 0.46], 34, 64);
  A('converter', 'Turbine — gearbox side', [CONV_X - 0.09, 0.42, 0.24], 84, 86);
  A('converter', 'Stator', [CONV_X + 0.02, 0.12, 0.06], 24, 58);
  const flowLabel = A('converter', 'Oil, circulating', [CONV_X + 0.02, 0.54, 0.05], 66, 54);
  A('converter', 'Input shaft', [CONV_X - 0.12, 0.105, 0.03], -24, 58);

  A('lockup', 'Lock-up clutch', [CONV_X - 0.185, 0.3, 0.18], 46, 62);
  A('lockup', 'Front cover — bolted to the engine', [CONV_X - 0.2, 0.44, 0.1], 80, 70);
  A('lockup', 'Turbine', [CONV_X - 0.09, -0.4, 0.12], -50, 56);

  A('planet', 'Sun gear · 36 teeth', [FP_X, 0.06, 0.12], -18, 70);
  A('planet', 'Planet gear · 18 teeth ×4', [FP_X, CARRIER_R, 0.05], 64, 64);
  A('planet', 'Planet carrier', [FP_X + 0.07, 0.21, 0.12], 26, 60);
  A('planet', 'Ring gear · 72 teeth', [FP_X, RING_OUT - 0.01, 0.04], 80, 54);

  A('clutch', 'Friction plates', [-0.74, DRUM_R - 0.04, 0.12], 62, 66);
  A('clutch', 'Steel plates', [-0.524, 0.3, 0.15], 40, 64);
  A('clutch', 'Apply piston', [-0.478, 0.16, 0.31], 12, 60);
  // the band's UPPER cut edge — the only band geometry a sectioned drum leaves
  // visible, since the strap wraps the OUTSIDE of the far wall
  A('clutch', 'Kickdown band', [-0.7, 0.396, 0], 78, 62);
  A('clutch', 'Servo', [-0.64, CASE_R + 0.16, 0.075], 80, 48);

  A('hydraulic', 'Oil pump', [PUMP_X, 0.34, 0.12], 56, 60);
  G('hydraulic', 'Valve body', [0.1, VB_Y + 0.06, 0.26], 56, 60);
  G('hydraulic', 'Shift solenoids', [-0.32, VB_Y + 0.09, 0.3], 40, 58);
  G('hydraulic', 'Filter', [0.06, PAN_Y0 + 0.1, 0.14], -50, 56);

  const ratioLabel = A('ratios', '1st', [0.24, CASE_R + 0.28, 0], 38, 72);
  const driveLabel = A('drive', '1st', [0.24, CASE_R + 0.28, 0], 38, 72);
  A('drive', 'Rear carrier', [0.865, 0.33, 0.1], 34, 58);
  A('drive', 'Output', [1.05, OUT_R + 0.02, 0.04], 145, 58);
  A('ratios', 'Sun', [0.35, 0.115, 0], -34, 58);
  A('ratios', 'Rear carrier', [0.865, 0.33, 0.1], 34, 58);
  // this one sits near the right edge, so its pill deliberately hangs LEFT
  A('ratios', 'Output', [1.05, OUT_R + 0.02, 0.04], 145, 58);

  // ============================================================ POSE STATE ===
  const state = {
    eng: 0, // impeller / cover angle (rad)
    in: 0, // turbine / input shaft angle
    s: 0, // sun angle
    c: 0, // front carrier == output angle
    stator: 0,
    flow: 0, // converter circulation phase
    flowAmt: 0,
    lock: 0, // lock-up clutch engaged
    apply: { fwd: 0, direct: 0, kick: 0, low: 0, sprag: 0 },
    atf: 0, // hydraulic packet phase
    atfOn: 0,
  };

  // rest positions, so the pose function can offset from them
  for (const p of [...fcFriction, ...fcSteel, ...rcFriction, ...rcSteel, fcPiston, rcPiston, lockPiston, lockFriction]) {
    p.userData.x0 = p.position.x;
  }

  const PHASE_K = (P_T - 1) * Math.PI;

  function applyPose() {
    impMember.rotation.x = state.eng;
    inputMember.rotation.x = state.in;
    turbMember.rotation.x = state.in;
    statorMember.rotation.x = state.stator;
    pumpOuter.rotation.x = state.eng * (10 / 12);

    const ts = state.s;
    const tc = state.c;
    // DERIVED members — the two planetary constraints, so nothing can drift
    const tr = ((S_T + R_T) * tc - S_T * ts) / R_T; // front ring
    const trc = (S_T * ts + R_T * tc) / (S_T + R_T); // rear carrier

    sunMember.rotation.x = ts;
    annMember.rotation.x = tr;
    outMember.rotation.x = tc;
    reactMember.rotation.x = trc;

    // [PLANET_PHASE] — one formula for pose AND kinematics
    for (let i = 0; i < N_PL; i++) {
      const pa = (i * TAU) / N_PL;
      frontPlanets[i].rotation.x =
        ((S_T + P_T) * (tc + pa) - S_T * ts + PHASE_K) / P_T - tc;
      rearPlanets[i].rotation.x =
        ((S_T + P_T) * (trc + pa) - S_T * ts + PHASE_K) / P_T - trc;
    }

    // clutch packs close; the plates stack up against the pressure plate
    const squeeze = (plates, amount, dir) => {
      for (let i = 0; i < plates.length; i++) {
        plates[i].position.x = plates[i].userData.x0 + dir * amount * 0.014 * (plates.length - i);
      }
    };
    squeeze(fcFriction, state.apply.direct, -1);
    squeeze(fcSteel, state.apply.direct, -1);
    squeeze(rcFriction, state.apply.fwd, 1);
    squeeze(rcSteel, state.apply.fwd, 1);
    fcPiston.position.x = fcPiston.userData.x0 - state.apply.direct * 0.02;
    rcPiston.position.x = rcPiston.userData.x0 + state.apply.fwd * 0.02;

    // bands tighten a fraction and their servo rods push down
    for (const [band, amt] of [
      [kickBand, state.apply.kick],
      [lowBand, state.apply.low],
    ]) {
      const k = 1 - amt * 0.022;
      band.grp.scale.set(1, k, k);
      band.rod.scale.y = 1 - amt * 0.1;
      band.strut.position.y = band.strut.userData.y0 - amt * 0.018;
    }

    lockPiston.position.x = lockPiston.userData.x0 - state.lock * LOCK_TRAVEL;
    lockFriction.position.x = lockFriction.userData.x0 - state.lock * LOCK_TRAVEL;

    // applied elements glow — the stage bloom turns emissive into a real
    // highlight, so the viewer never has to hunt for what is holding
    frictionFwd.emissiveIntensity = state.apply.fwd * 1.1;
    frictionDirect.emissiveIntensity = state.apply.direct * 1.1;
    bandKickMat.emissiveIntensity = state.apply.kick * 0.28;
    bandLowMat.emissiveIntensity = state.apply.low * 0.28;
    rollerMat.emissiveIntensity = state.apply.sprag * 1.4;

    // converter oil
    fluidMat.opacity = state.flowAmt;
    if (state.flowAmt > 0.001) {
      for (const d of fluidDots) {
        const pt = LOOP.getPointAt((((d.userData.p + state.flow) % 1) + 1) % 1);
        const az = d.userData.az + state.eng * 0.25;
        d.position.set(pt.x, pt.y * Math.cos(az), pt.y * Math.sin(az));
      }
    }

    // hydraulics — only the circuits actually commanded carry oil
    const live = {
      suction: state.atfOn,
      line: state.atfOn,
      direct: state.atfOn * state.apply.direct,
      fwd: state.atfOn * state.apply.fwd,
      kick: state.atfOn * state.apply.kick,
      low: state.atfOn * state.apply.low,
    };
    for (const k of Object.keys(feeds)) feeds[k].set(state.atf, live[k] ?? 0);
  }

  // ============================================================== DRIVERS ====
  function setApplied(mode, amount = 1) {
    const t = APPLIED[mode] ?? {};
    for (const k of Object.keys(state.apply)) state.apply[k] = (t[k] ?? 0) * amount;
  }

  // Steady state in one gear. `turns` = INPUT turns per lap — check it against
  // the seamlessness table in the header. `slip` is how much further the
  // impeller goes than the turbine; always a whole+half, so x24 blades lands.
  function steady(mode, turns, slip = 0.5) {
    return (u) => {
      u = ((u % 1) + 1) % 1;
      const a = u * turns * TAU;
      state.in = a;
      state.eng = a + u * slip * TAU;
      state.s = MODE[mode].s * a;
      state.c = MODE[mode].c * a;
      state.stator = 0;
      state.flow = u * 6;
      state.flowAmt = 0;
      state.lock = slip === 0 ? 1 : 0;
      state.atf = u * 4;
      state.atfOn = 0;
      setApplied(mode);
      applyPose();
    };
  }

  // ---- converter: launch, then let go ---------------------------------------
  // Impeller steady at 10 turns/lap. The turbine climbs off stall to nearly
  // matched and eases back, integrating to exactly 6 turns (x20 blades, and a
  // multiple of 3 for neutral's rear carrier). The stator is HELD while the oil
  // comes back the wrong way, and freewheels once it stops doing that.
  const convTurb = profileTable((t) => 0.1 + 0.9 * Math.sin(Math.PI * t) ** 1.4, 6);
  const convStator = profileTable((t) => Math.max(0, Math.sin(Math.PI * t) - 0.55), 1);
  function setConverter(u) {
    u = ((u % 1) + 1) % 1;
    state.eng = u * 10 * TAU;
    const inA = convTurb.at(u);
    state.in = inA;
    state.s = MODE.D0.s * inA;
    state.c = 0;
    state.stator = convStator.at(u);
    state.flow = u * 24;
    state.flowAmt = 1;
    state.lock = 0;
    state.atfOn = 0;
    setApplied('D0');
    applyPose();
    flowLabel.setText(u < 0.34 ? 'Oil, hitting the turbine hard' : 'Oil, circulating');
  }

  // ---- lock-up: slip, clamp, cruise, release --------------------------------
  // Impeller 12 turns, turbine 11 — the missing turn IS the slip, and all of it
  // happens before the clutch clamps.
  const lockTurb = profileTable((t) => (t < 0.42 ? 0.8 + 0.48 * t : 1), 11);
  function setLockup(u) {
    u = ((u % 1) + 1) % 1;
    state.eng = u * 12 * TAU;
    const inA = lockTurb.at(u);
    state.in = inA;
    state.s = inA;
    state.c = inA;
    state.stator = 0;
    state.flow = u * 9;
    state.flowAmt = 0.9 - 0.75 * win(u, 0.4, 0.56);
    state.lock = win(u, 0.4, 0.56) * (1 - win(u, 0.9, 0.99));
    state.atfOn = 0;
    setApplied('3');
    applyPose();
  }

  // ---- the gear walk --------------------------------------------------------
  // Shared by the planetary bench, the ratio walk and the finale. Pose comes
  // from ONE cumulative input angle: each mode contributes its (sun, carrier)
  // factors, and a change crossfades those two the short way round — the ring
  // and the rear carrier are derived from them, so the mesh stays exact right
  // through the shift.
  function gearWalk({ gears, turns, shiftFrac, rate = () => 1, slip = 0.5, atf = 1 }) {
    const span = 1 / gears.length;
    const table = profileTable(rate, turns);
    return (u) => {
      u = ((u % 1) + 1) % 1;
      const gi = Math.min(gears.length - 1, Math.floor(u / span));
      const g = gears[gi];
      const prev = gears[(gi - 1 + gears.length) % gears.length];
      const lu = (u - gi * span) / span;
      const shifting = lu < shiftFrac;
      const m = shifting ? lu / shiftFrac : 1;
      const a = table.at(u);

      const now = MODE[g];
      if (shifting) {
        const was = MODE[prev];
        const k = smooth(m);
        state.s = was.s * a + wrapPi(now.s * a - was.s * a) * k;
        state.c = was.c * a + wrapPi(now.c * a - was.c * a) * k;
      } else {
        state.s = now.s * a;
        state.c = now.c * a;
      }
      state.in = a;
      state.eng = a + u * slip * TAU;
      state.stator = 0;
      state.flow = u * 8;
      state.flowAmt = 0;
      state.lock = slip === 0 ? 1 : 0;
      state.atf = u * 7;
      state.atfOn = atf;
      // the old element lets go, nothing holds across the middle, the new one
      // takes up — snapping it instead put a lighting pop on the lap boundary
      const carrying = shifting && m < 0.5 ? prev : g;
      setApplied(carrying, shifting ? Math.abs(m * 2 - 1) : 1);
      applyPose();
      ratioLabel.setText(READOUT[carrying]);
      driveLabel.setText(READOUT[carrying]);
    };
  }

  // Planetary bench: 2nd (sun held) -> 3rd (locked) -> stalled Drive (carrier
  // stopped by the car, so the sun spins backwards). Nine input turns: D0's
  // rear carrier runs at -2/3 and its four arms need a multiple of 3, and 2nd
  // needs a multiple of 9.
  const setPlanetDemo = gearWalk({
    gears: ['2', '3', 'D0'],
    turns: 9,
    shiftFrac: 0.2,
    slip: 0,
    atf: 0,
  });

  // Bench walk: constant input speed, 1 -> 2 -> 3 -> R, 12 input turns per lap.
  // Reverse is the last segment, so the wrap has to land R's factors: sun x36,
  // ring -1.25 x72 = -90, front planets -3.5 x18 = -63, carrier -0.5 x4 = -2 —
  // all integers for any whole turn count.
  const setRatios = gearWalk({ gears: ['1', '2', '3', 'R'], turns: 12, shiftFrac: 0.24 });

  // Finale: the car accelerating. Road speed climbs the whole way, so the
  // ENGINE is what steps — revs dipping at every change, then building again.
  // The tail brakes back to the opening speed so the wrap has no pop.
  const RUN_SHIFT = 0.2;
  const RUN_TAIL = 0.13;
  const runOut = (u) => {
    const a = 0.42;
    const b = 1;
    if (u < 1 - RUN_TAIL) return a + (b - a) * (u / (1 - RUN_TAIL));
    return b - (b - a) * smooth((u - (1 - RUN_TAIL)) / RUN_TAIL);
  };
  const RUN_GEARS = ['1', '2', '3'];
  const setRun = gearWalk({
    gears: RUN_GEARS,
    turns: 15,
    shiftFrac: RUN_SHIFT,
    rate: (u) => {
      const gi = Math.min(2, Math.floor(u * 3));
      const lu = (u * 3) % 1;
      const revs = runOut(u) / MODE[RUN_GEARS[gi]].c;
      if (lu >= RUN_SHIFT) return revs;
      const from = runOut(u) / MODE[RUN_GEARS[(gi + 2) % 3]].c;
      return from + (revs - from) * smooth(lu / RUN_SHIFT);
    },
  });

  // Clutch macro: 2nd gear steady with the elements releasing and re-applying,
  // so you can watch a pack actually close. Nine input turns (2nd needs /9).
  const steady2 = steady('2', 9);
  function setClutchDemo(u) {
    u = ((u % 1) + 1) % 1;
    steady2(u);
    state.apply.fwd = win(u, 0.16, 0.32) * (1 - win(u, 0.74, 0.9));
    state.apply.kick = win(u, 0.42, 0.58) * (1 - win(u, 0.74, 0.9));
    state.atf = u * 5;
    state.atfOn = 1;
    applyPose();
  }

  // Hydraulics: first gear steady at 10 input turns (1st needs a multiple of 5),
  // oil running the whole lap so the circuit reads as permanently live.
  const steady1 = steady('1', 10);
  function setHydraulics(u) {
    u = ((u % 1) + 1) % 1;
    steady1(u);
    state.atf = u * 6;
    state.atfOn = 1;
    applyPose();
  }

  // ---------------------------------------------------------------- switches
  function setCase(on) {
    for (const m of caseMeshes) m.visible = on;
    // the hydraulics live inside the pan; with the case on they would poke
    // through it, and there is nothing to see anyway
    vbGrp.visible = !on;
    if (!on) for (const c of labels.sets.exterior) c.visible = false;
  }
  // the sun driving shell's long tunnel over the front planetary
  function setShell(on) {
    sunTunnel.visible = on;
    sunWeb.visible = on;
  }
  // cut the near half off the two clutch drums (and the band round the outer
  // one) so the camera can see a pack close
  function setCut(on) {
    fcDrum.visible = !on;
    fcDrumHalf.visible = on;
    // the drum's rear bulkhead spans the same radii as the piston it hides
    fcBulkhead.visible = !on;
    rcWall.visible = !on;
    rcWallHalf.visible = on;
    for (const b of [kickBand, lowBand]) {
      b.full.visible = !on;
      b.half.visible = on;
    }
  }
  // 0 = whole converter · 1 = sectioned, lock-up clutch on show · 2 = front
  // cover lifted right off, all three wheels visible
  function setConvCut(level) {
    const whole = level === 0;
    coverDome.visible = whole;
    coverRim.visible = whole;
    coverLugs.visible = whole;
    turbShell.visible = whole;
    coverDomeHalf.visible = level === 1;
    coverRimHalf.visible = !whole;
    turbShellHalf.visible = !whole;
    coverFace.visible = level < 2;
    lockPiston.visible = level < 2;
    lockFriction.visible = level < 2;
  }
  function setLabels(mode) {
    labels.setLabels(mode);
  }

  setCase(true);
  setShell(true);
  setCut(false);
  setConvCut(0);
  setLabels(false);
  steady('3', 8, 0)(0);

  return {
    group,
    steady,
    setConverter,
    setLockup,
    setPlanetDemo,
    setClutchDemo,
    setHydraulics,
    setRatios,
    setRun,
    setCase,
    setShell,
    setCut,
    setConvCut,
    setLabels,
    // exposed for verification probes
    parts: {
      inputMember,
      sunMember,
      annMember,
      outMember,
      reactMember,
      impMember,
      turbMember,
      frontPlanets,
      rearPlanets,
      kickBand: kickBand.grp,
      lowBand: lowBand.grp,
    },
  };
}
