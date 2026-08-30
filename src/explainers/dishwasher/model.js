import * as THREE from 'three';
import { materials, rod, disc, arrow, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, boltCircle } from '../../framework/geometry.js';
import { clamp01, smooth, win, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A built-in dishwasher: a sealed stainless product shot whose cabinet skin
// lifts away to expose the tub, the racks, and the whole water circuit living
// in the 15 cm of space underneath it.
//
// PROPORTIONS (a real 600 x 850 x 600 mm built-in => 1 : 1.42 : 1):
//   CAB_W 1.46 : CAB_H 2.07 : CAB_D 1.46  =  1 : 1.42 : 1.
//   One model unit = 0.41 m. The interior stack is derived from a real 62 cm
//   tub, so every height below is a measured centimetre count x 0.0255:
//     tub floor 0 · lower arm 2.5 · lower rack 6 · plate top 32 ·
//     upper arm 36 · upper rack 39 · glass top 51 · ceiling 62.
//   Lower spray arm span / tub width = 1.10 / 1.315 = 0.84 (real ~0.88).
//
// MECHANISM (researched): a dishwasher NEVER fills. The inlet valve puts about
// two litres in the sump — a well in the tub floor — and that is all the water
// there ever is at one time. A centrifugal circulation pump under the tub
// sucks from the sump through a filter, drives the water past a flow-through
// heater (55-60 C main wash, 65-71 C sanitise) and up a duct on the back wall
// to two spray arms. The arms have NO motor: their nozzles are angled
// tangentially and the reaction to the jets spins them, exactly like a lawn
// sprinkler, at roughly 30-60 rpm. Water hits the dishes, falls back down,
// strains through the filter into the sump, and goes round again — the same
// two litres, hundreds of times. Detergent is held behind a sprung flap on the
// inner door, released mid-wash when a wax motor retracts its latch. A
// separate drain pump ejects the dirty water through a hose that must rise in
// a high loop above the tub so waste cannot siphon back in. Rinse aid — a
// surfactant — kills the water's surface tension so it sheets off instead of
// beading, and the last hot rinse leaves the dishes hotter than the stainless
// walls, so the remaining moisture condenses on the tub and runs down.
// Total: ~11 L a cycle, against up to 100 L for the same load by hand.
//
// The two spray blades are deliberately UNEQUAL (real arms carry different
// nozzle counts per blade). A perfectly 2-fold-symmetric arm returns an
// identical pose every half turn, which makes any whole-turn loop hash the
// same at verify.mjs's 0.2/0.7 sample points and read as frozen.
//
// STATE SCALARS (one pose fn, `set({...})`):
//   reveal   0 sealed cabinet -> 1 skin gone, right tub wall cut away
//   door     0 shut -> 1 dropped to horizontal
//   rackOut  0 stowed -> 1 both racks rolled out over the open door
//   water    sump level, 0 dry -> 1 the ~2 L working charge
//   armLo/armUp   spray-arm angles (rad) — whole turns per lap
//   impeller / drainSpin  pump rotor angles (rad) — whole turns per lap
//   flow     phase clock for every dot trail and droplet — whole cycles/lap
//   jets     0 -> 1 spray cones + falling droplets + wet floor film
//   heat     flow-through heater emissive ramp
//   disp     0 -> 1 detergent flap swings open, wax-motor plunger retracts
//   thrust   0 -> 1 reaction-force arrows riding the lower arm
//   fillVis  0 -> 1 inlet trail from the valve into the sump
//   drainVis 0 -> 1 drain trail through the pump and up the high loop
//   steam    0 -> 1 condensation beads on the tub wall + sheeting on a glass

// --- one-scale layout --------------------------------------------------------
const PLINTH_H = 0.26;
const CAB_W = 1.46;
const CAB_H = 2.07;
const CAB_D = 1.46;
const CAB_Y0 = PLINTH_H; // 0.26
const CAB_Y1 = CAB_Y0 + CAB_H; // 2.33
const HALF_W = CAB_W / 2; // 0.73
const FRONT_Z = CAB_D / 2; // 0.73
const BACK_Z = -CAB_D / 2; // -0.73

const SKIN = 0.03; // cabinet sheet thickness
const WALL = 0.055; // cabinet skin -> tub gap
const TUB_HW = HALF_W - WALL; // 0.675 outer half-width of the tub
const TUB_T = 0.035; // tub panel thickness
const TUB_IN = TUB_HW - TUB_T / 2; // 0.6575 inner face
const TUB_BACK = BACK_Z + WALL; // -0.675
const TUB_FRONT = FRONT_Z - 0.045; // 0.685 tub mouth
const TUB_MID_Z = (TUB_FRONT + TUB_BACK) / 2; // 0.005
const TUB_DEPTH = TUB_FRONT - TUB_BACK; // 1.36
const FLOOR_Y = 0.7; // top face of the tub floor
const FLOOR_T = 0.04;
const CEIL_Y = 2.28;

const SUMP_R = 0.2;
const SUMP_Y = 0.585; // sump floor
const SUMP_Z = -0.02;

const KICK_H = 0.22;
const DOOR_Y0 = CAB_Y0 + KICK_H; // 0.48 — hinge line
const DOOR_H = CAB_Y1 - DOOR_Y0; // 1.85
const DOOR_FACE = -0.062; // inner-liner face, in door-local z

// interior stack, all derived from the 62 cm reference tub
const ARM_LO_Y = 0.775;
const RACK_LO_Y = 0.85;
const ARM_UP_Y = 1.62;
const RACK_UP_Y = 1.7;
const HEAD_Y = 2.22;
const ARM_LO_R = 0.55;
const ARM_UP_R = 0.46;
const PLATE_R = 0.33;
const PLATE_Z = [-0.34, -0.17, 0.0, 0.17, 0.34];

// Under-tub bay: y 0.30 (base pan) to 0.66 (underside of the tub floor). The
// whole bay is laid out for a camera in FRONT of the machine: the wash pump
// sits at the front-right with its volute cut open toward +Z, its motor
// outboard of it (never between the volute and the lens), and the heater runs
// across the front of the bay one step further back.
const PUMP_X = 0.3;
const PUMP_Y = 0.46;
const PUMP_Z = 0.24;
const PUMP_R = 0.125;
const HEAT_Y = 0.44;
const HEAT_Z = 0.1;
const HEAT_X0 = 0.2; // inlet end
const HEAT_X1 = -0.3; // outlet end
const DRAIN_X = -0.34;
const DRAIN_Y = 0.42;
const DRAIN_Z = 0.22;
const VALVE = new THREE.Vector3(0.52, 0.4, -0.58);

const UP = new THREE.Vector3(0, 1, 0);

// Deterministic jitter — same load, same droplets, every render, so the
// review screenshots are comparable run to run.
let seedN = 90210;
const rnd = () => {
  seedN = (seedN * 16807) % 2147483647;
  return seedN / 2147483647;
};

// Open lathe/cylinder shells are surfaces, not solids: from inside a volute or
// a sump bowl you are looking at their BACK faces, which vanish on FrontSide.
const dbl = (mat) => {
  const m = mat.clone();
  m.side = THREE.DoubleSide;
  return m;
};

// The framework's brushed/cast maps are CACHED AND SHARED, and default to one
// repeat across whatever they are put on. On an appliance panel a metre and a
// half across that stretches each brush stroke into a smear the size of your
// hand — the panels read as corrugated plastic, not steel. Clone the maps for
// this explainer only (never mutate the shared ones) and tile them down to a
// real grain. `roughnessMap` MULTIPLIES base roughness (texels ~0.5), so the
// base value is raised to land near the 0.4 an appliance skin actually has.
const grain = (mat, tiles, roughness) => {
  for (const key of ['roughnessMap', 'normalMap']) {
    if (!mat[key]) continue;
    const tex = mat[key].clone();
    tex.repeat.set(tiles, tiles);
    tex.needsUpdate = true;
    mat[key] = tex;
  }
  if (mat.normalScale) mat.normalScale.set(0.22, 0.22);
  mat.roughness = roughness;
  return mat;
};

// A flat plate with a real circular hole punched through it (rule: an opening a
// moving part passes through must be an actual hole, not a painted disc).
// Extruded geometry gets ad-hoc UVs, so callers pass a map-free material.
function holedPlate(w, d, holeR, holeX, holeZ, thickness, material) {
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2, -d / 2);
  shape.lineTo(w / 2, -d / 2);
  shape.lineTo(w / 2, d / 2);
  shape.lineTo(-w / 2, d / 2);
  shape.closePath();
  const hole = new THREE.Path();
  hole.absarc(holeX, -holeZ, holeR, 0, TAU, true);
  shape.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 36,
  });
  geo.rotateX(-Math.PI / 2); // shape plane XY -> XZ, extrusion along +Y
  const mesh = new THREE.Mesh(geo, material);
  mesh.receiveShadow = true;
  return mesh;
}

export function buildDishwasher({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  const plinth = studioPlinth({ w: 3.2, h: PLINTH_H, d: 2.0 });
  group.add(plinth);

  // ============================================================================
  //  MATERIALS
  // ============================================================================
  const skinMat = grain(materials.brushedSteel(0xc7ced6), 13, 0.8);
  const doorMat = grain(materials.brushedSteel(0xccd2d9), 15, 0.76);
  const tubMat = grain(materials.brushedSteel(0x9ea6ae), 11, 0.96);
  // map-free steel for extruded/lathed parts (ad-hoc UVs sample map garbage)
  // the tub floor is a big flat plate seen from BELOW in the pump steps — at
  // high metalness it becomes a sky-blue mirror across the whole frame
  const tubFlat = new THREE.MeshPhysicalMaterial({
    color: 0x8b9199,
    metalness: 0.6,
    roughness: 0.9,
  });
  const tubFlat2 = dbl(tubFlat);
  const frameMat = materials.paintedMetal(0x2b3037);
  frameMat.roughness = 0.62;
  frameMat.clearcoat = 0.16;
  const trimMat = materials.polymer(0x14171b);
  const armMat = materials.polymer(0x2b3138);
  const rackMat = materials.polymer(0x4e565f);
  rackMat.roughness = 0.44;
  const basketMat = materials.polymer(0x363d46);
  const filterMat = materials.polymer(0x1d2126);
  const filterMat2 = dbl(filterMat);
  const meshMat = materials.polymer(0x596069);
  const pumpMat = materials.polymer(0x30363e);
  const impMat = materials.polymer(0x8d959f);
  const pumpMat2 = dbl(pumpMat);
  const motorMat = materials.paintedMetal(0x4b525c);
  motorMat.roughness = 0.55;
  const pipeMat = materials.polymer(0x333a42);
  const pipeMat2 = dbl(pipeMat);
  const hoseMat = materials.rubber(0x1b1e23);
  const valveMat = materials.aluminum(0x9aa3ad);
  valveMat.roughness = 0.52;

  const ceramicMat = new THREE.MeshPhysicalMaterial({
    color: 0xcfccc3,
    metalness: 0.02,
    roughness: 0.34,
    clearcoat: 0.18,
    clearcoatRoughness: 0.3,
    side: THREE.DoubleSide,
  });
  const cutleryMat = materials.brushedSteel(0xc2c8d0);
  cutleryMat.roughness = 0.44;
  // plain transparent glass, NOT opticalGlass: the spray droplets and flow dots
  // behind these are transparent, and a transmission pass would delete them
  const glassMat = new THREE.MeshPhysicalMaterial({
    color: 0xcfe2f0,
    metalness: 0,
    roughness: 0.1,
    transparent: true,
    opacity: 0.12,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const waterMat = new THREE.MeshPhysicalMaterial({
    color: 0x63c7dd,
    metalness: 0,
    roughness: 0.12,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const filmMat = new THREE.MeshPhysicalMaterial({
    color: 0x8fd9e6,
    metalness: 0,
    roughness: 0.08,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  // heater: deliberately LOW specular so the emissive tint actually reaches the
  // pixel — a glossy metal swamps any emissive colour with its own highlight
  const heaterMat = new THREE.MeshStandardMaterial({
    color: 0xb6bcc3,
    metalness: 0.3,
    roughness: 0.52,
    emissive: 0xff6a1e,
    emissiveIntensity: 0,
  });
  const jetMat = new THREE.MeshBasicMaterial({
    color: 0xa8e8f4,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const dropMat = (color = 0x9fe4f2) => {
    const m = materials.glow(color, 1.2);
    m.transparent = true;
    m.opacity = 0;
    m.depthWrite = false;
    return m;
  };
  const ledMat = materials.glow(0x5ecfd8, 1.4);

  const skinHide = []; // steel skin — metal never ghosts cleanly, so it hides
  const tubHide = []; // the cutaway quadrant: right wall, front frame, front flange
  const inletShow = []; // supply plumbing — on screen only while it is filling
  const drainShow = []; // waste plumbing — on screen only while it is draining

  // ============================================================================
  //  CHASSIS — the frame that survives the cutaway
  // ============================================================================
  const basePan = beveledBox(CAB_W - 0.02, 0.05, CAB_D - 0.02, frameMat, 0.012);
  basePan.position.set(0, CAB_Y0 + 0.025, 0);
  basePan.receiveShadow = true;
  group.add(basePan);

  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const post = beveledBox(0.05, CAB_H - 0.06, 0.05, frameMat, 0.01);
      post.position.set(sx * (HALF_W - 0.035), CAB_Y0 + CAB_H / 2, sz * (FRONT_Z - 0.035));
      group.add(post);
      if (sz > 0) tubHide.push(post); // front pair: part of the cutaway quadrant
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = rod(0.028, 0.06, frameMat, 12);
      foot.position.set(sx * (HALF_W - 0.1), CAB_Y0 - 0.055, sz * (FRONT_Z - 0.12));
      group.add(foot);
      const pad = disc(0.045, 0.02, trimMat, 16);
      pad.position.set(foot.position.x, CAB_Y0 - 0.065, foot.position.z);
      group.add(pad);
    }
  }

  // ============================================================================
  //  CABINET SKIN — hidden on reveal
  // ============================================================================
  for (const sx of [-1, 1]) {
    const p = beveledBox(SKIN, CAB_H, CAB_D, skinMat, 0.008);
    p.position.set(sx * (HALF_W - SKIN / 2), CAB_Y0 + CAB_H / 2, 0);
    group.add(p);
    skinHide.push(p);
  }

  const topPanel = beveledBox(CAB_W, SKIN, CAB_D, skinMat, 0.008);
  topPanel.position.set(0, CAB_Y1 - SKIN / 2, 0);
  group.add(topPanel);
  skinHide.push(topPanel);

  const backPanel = beveledBox(CAB_W - 0.04, CAB_H - 0.04, SKIN, skinMat, 0.008);
  backPanel.position.set(0, CAB_Y0 + CAB_H / 2, BACK_Z + SKIN / 2);
  group.add(backPanel);
  skinHide.push(backPanel);

  const ratingPlate = beveledBox(0.24, 0.15, 0.004, trimMat, 0.004);
  ratingPlate.position.set(-0.26, 1.62, BACK_Z + 0.032);
  group.add(ratingPlate);
  skinHide.push(ratingPlate);
  for (const y of [0.62, 2.02]) {
    const rib = beveledBox(CAB_W - 0.14, 0.03, 0.008, skinMat, 0.004);
    rib.position.set(0, y, BACK_Z + 0.034);
    group.add(rib);
    skinHide.push(rib);
  }

  // toe kick under the door, with the drying vent slot
  const kick = beveledBox(CAB_W - 0.04, KICK_H - 0.03, 0.028, doorMat, 0.01);
  kick.position.set(0, CAB_Y0 + KICK_H / 2, FRONT_Z - 0.02);
  group.add(kick);
  skinHide.push(kick);
  const vent = beveledBox(0.34, 0.02, 0.012, trimMat, 0.004);
  vent.position.set(0.2, CAB_Y0 + KICK_H / 2, FRONT_Z - 0.004);
  group.add(vent);
  skinHide.push(vent);

  // ============================================================================
  //  TUB — the +X wall is the cutaway quadrant
  // ============================================================================
  const tubGroup = new THREE.Group();
  group.add(tubGroup);

  const tubFloor = holedPlate(
    2 * TUB_HW,
    TUB_DEPTH,
    SUMP_R,
    0,
    SUMP_Z - TUB_MID_Z,
    FLOOR_T,
    tubFlat,
  );
  tubFloor.position.set(0, FLOOR_Y - FLOOR_T, TUB_MID_Z);
  tubGroup.add(tubFloor);

  const tubBackWall = beveledBox(2 * TUB_HW, CEIL_Y - FLOOR_Y, TUB_T, tubMat, 0.008);
  tubBackWall.position.set(0, (CEIL_Y + FLOOR_Y) / 2, TUB_BACK + TUB_T / 2);
  tubGroup.add(tubBackWall);

  const tubCeiling = beveledBox(2 * TUB_HW, TUB_T, TUB_DEPTH, tubMat, 0.008);
  tubCeiling.position.set(0, CEIL_Y - TUB_T / 2, TUB_MID_Z);
  tubGroup.add(tubCeiling);

  for (const sx of [-1, 1]) {
    const w = beveledBox(TUB_T, CEIL_Y - FLOOR_Y, TUB_DEPTH, tubMat, 0.008);
    w.position.set(sx * (TUB_HW - TUB_T / 2), (CEIL_Y + FLOOR_Y) / 2, TUB_MID_Z);
    tubGroup.add(w);
    if (sx > 0) tubHide.push(w);
  }

  // tub mouth flange — frames the cutaway once the door is gone
  for (const sx of [-1, 1]) {
    const f = beveledBox(0.05, CEIL_Y - FLOOR_Y + 0.06, 0.03, tubMat, 0.008);
    f.position.set(sx * (TUB_HW + 0.01), (CEIL_Y + FLOOR_Y) / 2, TUB_FRONT + 0.015);
    tubGroup.add(f);
    if (sx > 0) tubHide.push(f);
  }
  for (const y of [CEIL_Y + 0.02, FLOOR_Y - 0.03]) {
    const f = beveledBox(2 * TUB_HW + 0.12, 0.05, 0.03, tubMat, 0.008);
    f.position.set(0, y, TUB_FRONT + 0.015);
    tubGroup.add(f);
  }

  // ============================================================================
  //  SUMP, FILTER, LOWER-ARM SPIGOT
  // ============================================================================
  const sumpWell = lathe(
    [
      [0, SUMP_Y],
      [SUMP_R - 0.02, SUMP_Y],
      [SUMP_R - 0.01, SUMP_Y + 0.02],
      [SUMP_R, FLOOR_Y - 0.01],
      [SUMP_R + 0.012, FLOOR_Y],
    ],
    tubFlat2,
    40,
  );
  sumpWell.position.set(0, 0, SUMP_Z);
  tubGroup.add(sumpWell);

  const sumpShell = lathe(
    [
      [SUMP_R + 0.012, FLOOR_Y],
      [SUMP_R + 0.014, SUMP_Y + 0.01],
      [SUMP_R * 0.6, SUMP_Y - 0.055],
      [0, SUMP_Y - 0.07],
    ],
    pumpMat2,
    36,
  );
  sumpShell.position.set(0, 0, SUMP_Z);
  group.add(sumpShell);

  const sumpSpout = rod(0.055, 0.14, pumpMat, 18);
  sumpSpout.rotation.z = -Math.PI / 2; // +Y -> +X
  sumpSpout.position.set(0.1, SUMP_Y - 0.02, SUMP_Z);
  group.add(sumpSpout);

  // suction elbow down to the pump eye
  const suctionPipe = tubeAlong(
    [
      [0.16, SUMP_Y - 0.02, SUMP_Z],
      [0.27, 0.52, 0.06],
      [0.25, 0.47, 0.18],
      [0.17, PUMP_Y, PUMP_Z],
    ],
    0.05,
    pipeMat,
    { tubularSegments: 30, radialSegments: 14 },
  );
  group.add(suctionPipe);

  // coarse strainer: a ring of radial slats around the arm spigot
  const coarse = new THREE.Group();
  coarse.position.set(0, FLOOR_Y - 0.012, SUMP_Z);
  tubGroup.add(coarse);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    const slat = beveledBox(0.09, 0.012, 0.02, filterMat, 0.004);
    slat.position.set(Math.cos(a) * 0.145, 0, Math.sin(a) * 0.145);
    slat.rotation.y = -a;
    coarse.add(slat);
  }
  const coarseRim = lathe(
    [
      [SUMP_R - 0.015, 0],
      [SUMP_R - 0.005, 0.008],
      [SUMP_R - 0.005, 0.022],
      [SUMP_R - 0.02, 0.026],
    ],
    filterMat2,
    36,
  );
  coarse.add(coarseRim);

  // fine mesh cylinder — 30 vertical wires, so the trapped food reads through it
  const fineFilter = new THREE.Group();
  fineFilter.position.set(0, 0, SUMP_Z);
  tubGroup.add(fineFilter);
  for (let i = 0; i < 18; i++) {
    const a = (i / 18) * TAU;
    const wire = rod(0.006, 0.105, meshMat, 6);
    wire.position.set(Math.cos(a) * 0.098, SUMP_Y + 0.01, Math.sin(a) * 0.098);
    fineFilter.add(wire);
  }
  for (const y of [SUMP_Y + 0.012, SUMP_Y + 0.108]) {
    const hoop = new THREE.Mesh(new THREE.TorusGeometry(0.098, 0.006, 8, 40), meshMat);
    hoop.rotation.x = Math.PI / 2;
    hoop.position.y = y;
    fineFilter.add(hoop);
  }
  for (let i = 0; i < 6; i++) {
    const a = rnd() * TAU;
    const s = new THREE.Mesh(
      new THREE.SphereGeometry(0.013 + rnd() * 0.008, 8, 6),
      materials.polymer(i % 2 ? 0x6b5a2e : 0x4d5c33),
    );
    s.scale.set(1, 0.55, 1.4);
    s.position.set(Math.cos(a) * 0.09, SUMP_Y + 0.025 + rnd() * 0.055, Math.sin(a) * 0.09);
    fineFilter.add(s);
  }

  const spigot = rod(0.052, 0.09, armMat, 20);
  spigot.position.set(0, FLOOR_Y - 0.015, SUMP_Z);
  tubGroup.add(spigot);

  // ============================================================================
  //  SPRAY ARMS — no motor: angled nozzles, jet reaction does the spinning
  // ============================================================================
  const jetGeo = (() => {
    const g = new THREE.ConeGeometry(0.03, 0.48, 12, 1, true);
    g.rotateX(Math.PI); // apex to -Y so the point sits on the nozzle
    g.translate(0, 0.48 / 2 + 0.03, 0);
    return g;
  })();
  const jetGeoShort = (() => {
    const g = new THREE.ConeGeometry(0.026, 0.22, 12, 1, true);
    g.rotateX(Math.PI);
    g.translate(0, 0.22 / 2 + 0.026, 0);
    return g;
  })();

  function addNozzle(parent, pos, dir, short = false) {
    const n = new THREE.Group();
    n.position.copy(pos);
    n.quaternion.setFromUnitVectors(UP, dir.clone().normalize());
    parent.add(n);
    n.add(rod(0.014, 0.028, armMat, 10));
    n.add(new THREE.Mesh(short ? jetGeoShort : jetGeo, jetMat));
    return n;
  }

  // A two-bladed spray arm with deliberately UNEQUAL blades. Every nozzle leans
  // the same rotational way (+Z in blade-local terms), so the reaction to the
  // jets drives rotation.y upward — no motor anywhere near it.
  function sprayArm({ span, tilt, nozzles, shortSpan, shortNozzles, hubR = 0.062, short = false }) {
    const g = new THREE.Group();
    g.add(
      lathe(
        [
          [0, 0.03],
          [hubR * 0.8, 0.032],
          [hubR, 0.02],
          [hubR, -0.02],
          [hubR * 0.7, -0.03],
          [0, -0.03],
        ],
        armMat,
        28,
      ),
    );
    [
      [1, span, nozzles],
      [-1, shortSpan, shortNozzles],
    ].forEach(([sign, len, list]) => {
      const blade = new THREE.Group();
      blade.rotation.y = sign > 0 ? 0 : Math.PI;
      g.add(blade);
      const body = beveledBox(len - hubR * 0.4, 0.046, 0.1, armMat, 0.016);
      body.position.set(hubR * 0.4 + (len - hubR * 0.4) / 2, 0, 0);
      blade.add(body);
      const cap = new THREE.Mesh(new THREE.SphereGeometry(0.05, 14, 10), armMat);
      cap.scale.set(0.5, 0.46, 1);
      cap.position.set(len, 0, 0);
      blade.add(cap);
      const rib = beveledBox(len - hubR, 0.014, 0.03, armMat, 0.006);
      rib.position.set(hubR + (len - hubR) / 2, 0.028, 0);
      blade.add(rib);
      list.forEach(([r, spread]) => {
        const d = new THREE.Vector3(
          Math.sin(spread),
          Math.cos(spread) * Math.cos(tilt),
          Math.cos(spread) * Math.sin(tilt),
        );
        addNozzle(blade, new THREE.Vector3(r, 0.023, 0), d, short);
      });
      if (sign > 0) g.userData.longBlade = blade;
    });
    return g;
  }

  const armLo = sprayArm({
    span: ARM_LO_R,
    shortSpan: ARM_LO_R * 0.78,
    tilt: 0.42, // 24 deg of tangential lean — this is the whole engine
    nozzles: [
      [0.17, 0.0],
      [0.28, 0.1],
      [0.39, 0.18],
      [0.5, 0.32],
    ],
    shortNozzles: [
      [0.19, 0.06],
      [0.3, 0.16],
      [0.4, 0.3],
    ],
  });
  armLo.position.set(0, ARM_LO_Y, SUMP_Z);
  tubGroup.add(armLo);

  const armUp = sprayArm({
    span: ARM_UP_R,
    shortSpan: ARM_UP_R * 0.76,
    tilt: 0.4,
    hubR: 0.055,
    short: true,
    nozzles: [
      [0.16, 0.0],
      [0.28, 0.14],
      [0.4, 0.28],
    ],
    shortNozzles: [
      [0.2, 0.1],
      [0.33, 0.24],
    ],
  });
  armUp.position.set(0, ARM_UP_Y, 0.02);
  tubGroup.add(armUp);

  // ceiling shower head — the third level on modern machines
  const headGroup = new THREE.Group();
  headGroup.position.set(0, HEAD_Y, 0.02);
  tubGroup.add(headGroup);
  headGroup.add(
    lathe(
      [
        [0, 0.03],
        [0.075, 0.03],
        [0.09, 0.01],
        [0.085, -0.018],
        [0, -0.022],
      ],
      armMat,
      28,
    ),
  );
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    addNozzle(
      headGroup,
      new THREE.Vector3(Math.cos(a) * 0.055, -0.022, Math.sin(a) * 0.055),
      new THREE.Vector3(Math.cos(a) * 0.42, -1, Math.sin(a) * 0.42),
      true,
    );
  }

  // reaction-thrust arrows — parented to the arm so they stay tangential
  const thrustParts = [];
  [
    [1, armLo.children[1]],
    [-1, armLo.children[2]],
  ].forEach(([sign, blade]) => {
    const len = sign > 0 ? 0.44 : 0.34;
    const shaft = rod(0.013, 0.16, dropMat(0x5ecfd8), 10);
    shaft.material.emissiveIntensity = 1.0;
    shaft.rotation.x = -Math.PI / 2; // +Y -> -Z, the way the blade is pushed
    shaft.position.set(len, 0.1, 0.1);
    blade.add(shaft);
    const head = arrow(0x5ecfd8, 0.14);
    head.rotation.x = -Math.PI / 2;
    head.position.set(len, 0.1, -0.13);
    blade.add(head);
    thrustParts.push(shaft, head);
  });

  // ============================================================================
  //  RACKS
  // ============================================================================
  function wireRack({ w, d, spacingX, spacingZ }) {
    const g = new THREE.Group();
    const wire = (len, axis, cx, y, cz) => {
      const m = rod(0.011, len, rackMat, 8);
      if (axis === 'x') {
        m.rotation.z = -Math.PI / 2;
        m.position.set(cx - len / 2, y, cz);
      } else {
        m.rotation.x = Math.PI / 2;
        m.position.set(cx, y, cz - len / 2);
      }
      g.add(m);
    };
    for (const y of [0, 0.15]) {
      for (const sz of [-1, 1]) wire(w, 'x', 0, y, sz * (d / 2));
      for (const sx of [-1, 1]) wire(d, 'z', sx * (w / 2), y, 0);
    }
    for (const sx of [-1, 1])
      for (const sz of [-1, 1]) {
        const r = rod(0.011, 0.15, rackMat, 8);
        r.position.set(sx * (w / 2), 0, sz * (d / 2));
        g.add(r);
      }
    const nx = Math.round(w / spacingX);
    for (let i = 1; i < nx; i++) wire(d, 'z', -w / 2 + i * spacingX, 0, 0);
    const nz = Math.round(d / spacingZ);
    for (let i = 1; i < nz; i++) wire(w, 'x', 0, 0, -d / 2 + i * spacingZ);
    return g;
  }

  const rackLo = wireRack({ w: 1.18, d: 1.12, spacingX: 0.17, spacingZ: 0.19 });
  rackLo.position.set(0, RACK_LO_Y, TUB_MID_Z);
  tubGroup.add(rackLo);

  for (const z of [...PLATE_Z.map((v) => v - 0.085), PLATE_Z[4] + 0.085]) {
    for (let i = 0; i < 5; i++) {
      const t = rod(0.0095, 0.155, rackMat, 8);
      t.position.set(-0.34 + i * 0.17, 0, z);
      t.rotation.x = -0.12;
      rackLo.add(t);
    }
  }

  const plateProfile = [
    [0, 0],
    [PLATE_R * 0.55, 0.004],
    [PLATE_R * 0.78, 0.016],
    [PLATE_R * 0.95, 0.036],
    [PLATE_R, 0.046],
    [PLATE_R - 0.009, 0.046],
    [PLATE_R * 0.93, 0.034],
    [PLATE_R * 0.75, 0.006],
    [PLATE_R * 0.5, -0.004],
    [0, -0.008],
  ];
  PLATE_Z.forEach((z, i) => {
    const p = lathe(plateProfile, ceramicMat, 44);
    p.position.set(-0.02 + (i % 2 ? 0.03 : -0.03), PLATE_R + 0.035, z);
    p.rotation.x = -Math.PI / 2 + 0.1; // plate axis swings from +Y to -Z
    p.rotation.z = 0.09;
    rackLo.add(p);
  });

  for (const bx of [-0.44, 0.44]) {
    const bowl = lathe(
      [
        [0, 0],
        [0.06, 0.004],
        [0.12, 0.05],
        [0.15, 0.105],
        [0.15, 0.118],
        [0.139, 0.112],
        [0.111, 0.058],
        [0.052, 0.012],
        [0, 0.008],
      ],
      ceramicMat,
      36,
    );
    bowl.position.set(bx, 0.16, -0.42);
    bowl.rotation.x = Math.PI - 0.3; // face-down, as they must be loaded
    bowl.rotation.z = bx < 0 ? 0.18 : -0.18;
    rackLo.add(bowl);
  }

  // cutlery basket, front-left corner of the lower rack
  const basket = new THREE.Group();
  basket.position.set(-0.36, 0.01, 0.38);
  rackLo.add(basket);
  const BW = 0.3;
  const BD = 0.24;
  for (const sx of [-1, 1])
    for (const sz of [-1, 1]) {
      const p = rod(0.011, 0.21, basketMat, 8);
      p.position.set(sx * (BW / 2), 0, sz * (BD / 2));
      basket.add(p);
    }
  for (const y of [0.03, 0.11, 0.2]) {
    for (const sz of [-1, 1]) {
      const b = rod(0.009, BW, basketMat, 8);
      b.rotation.z = -Math.PI / 2;
      b.position.set(BW / 2, y, sz * (BD / 2));
      basket.add(b);
    }
    for (const sx of [-1, 1]) {
      const b = rod(0.009, BD, basketMat, 8);
      b.rotation.x = Math.PI / 2;
      b.position.set(sx * (BW / 2), y, BD / 2);
      basket.add(b);
    }
  }
  for (let i = 0; i < 5; i++) {
    const b = rod(0.009, BD, basketMat, 8);
    b.rotation.x = Math.PI / 2;
    b.position.set(-BW / 2 + (i + 1) * (BW / 6), 0.02, BD / 2);
    basket.add(b);
  }
  for (let i = 0; i < 5; i++) {
    const handle = rod(0.011, 0.2, cutleryMat, 8);
    handle.position.set(-0.11 + (i % 4) * 0.073, 0.03, -0.06 + Math.floor(i / 4) * 0.1);
    handle.rotation.z = (rnd() - 0.5) * 0.16;
    handle.rotation.x = (rnd() - 0.5) * 0.16;
    basket.add(handle);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.026, 12, 8), cutleryMat);
    head.scale.set(0.62, 1, 0.22);
    head.position.copy(handle.position);
    head.position.y += 0.215;
    head.rotation.copy(handle.rotation);
    basket.add(head);
  }

  const rackUp = wireRack({ w: 1.14, d: 1.06, spacingX: 0.17, spacingZ: 0.19 });
  rackUp.position.set(0, RACK_UP_Y, TUB_MID_Z);
  tubGroup.add(rackUp);
  for (const z of [-0.34, -0.16, 0.16, 0.34]) {
    for (let i = 0; i < 4; i++) {
      const t = rod(0.0085, 0.1, rackMat, 8);
      t.position.set(-0.3 + i * 0.2, 0, z);
      t.rotation.x = 0.1;
      rackUp.add(t);
    }
  }

  const glassProfile = [
    [0, 0],
    [0.052, 0.004],
    [0.056, 0.02],
    [0.049, 0.12],
    [0.046, 0.24],
    [0.048, 0.27],
    [0.043, 0.27],
    [0.041, 0.238],
    [0.044, 0.12],
    [0.05, 0.022],
    [0, 0.016],
  ];
  const GLASS_POS = [
    [-0.44, -0.28],
    [-0.2, -0.28],
    [0.2, -0.28],
    [0.44, -0.28],
    [0.32, 0.26],
    [0.5, 0.26],
  ];
  const featureGlass = [];
  GLASS_POS.forEach(([gx, gz], i) => {
    const gl = lathe(glassProfile, glassMat, 30);
    gl.rotation.x = Math.PI; // rim down, as they must be loaded
    gl.position.set(gx, 0.28, gz);
    rackUp.add(gl);
    if (i === 4) featureGlass.push(gl);
  });
  for (const [mx, mz] of [
    [-0.46, 0.26],
    [-0.2, 0.26],
    [0.0, 0.26],
  ]) {
    const mug = lathe(
      [
        [0, 0],
        [0.055, 0.004],
        [0.058, 0.02],
        [0.055, 0.19],
        [0.058, 0.205],
        [0.052, 0.205],
        [0.049, 0.19],
        [0.052, 0.02],
        [0, 0.014],
      ],
      ceramicMat,
      28,
    );
    mug.rotation.x = Math.PI;
    mug.position.set(mx, 0.21, mz);
    rackUp.add(mug);
    const handle = new THREE.Mesh(
      new THREE.TorusGeometry(0.042, 0.011, 8, 20, Math.PI * 1.2),
      ceramicMat,
    );
    handle.position.set(mx + 0.058, 0.105, mz);
    handle.rotation.z = -0.4;
    rackUp.add(handle);
  }

  for (const y of [RACK_LO_Y - 0.02, RACK_UP_Y - 0.02]) {
    for (const sx of [-1, 1]) {
      const rail = beveledBox(0.02, 0.026, TUB_DEPTH - 0.1, trimMat, 0.006);
      rail.position.set(sx * (TUB_IN - 0.012), y, TUB_MID_Z);
      tubGroup.add(rail);
    }
  }

  // ============================================================================
  //  DOOR — hinged at the floor line, carrying the dispensers on its liner
  // ============================================================================
  const doorPivot = new THREE.Group();
  doorPivot.position.set(0, DOOR_Y0, FRONT_Z);
  group.add(doorPivot);

  const doorSkinMesh = beveledBox(CAB_W, DOOR_H, 0.035, doorMat, 0.012);
  doorSkinMesh.position.set(0, DOOR_H / 2, 0.018);
  doorPivot.add(doorSkinMesh);
  skinHide.push(doorSkinMesh);

  const doorLiner = beveledBox(CAB_W - 2 * WALL, DOOR_H - 0.05, 0.028, tubMat, 0.01);
  doorLiner.position.set(0, DOOR_H / 2, DOOR_FACE);
  doorPivot.add(doorLiner);

  const doorSeal = beveledBox(CAB_W - 0.06, DOOR_H - 0.02, 0.016, hoseMat, 0.006);
  doorSeal.position.set(0, DOOR_H / 2, -0.03);
  doorPivot.add(doorSeal);

  const handleBar = rod(0.026, 1.06, doorMat, 16);
  handleBar.rotation.z = -Math.PI / 2; // +Y -> +X, running from its origin
  handleBar.position.set(-0.53, DOOR_H - 0.1, 0.105);
  doorPivot.add(handleBar);
  skinHide.push(handleBar);
  for (const sx of [-1, 1]) {
    const stub = rod(0.02, 0.07, doorMat, 12);
    stub.rotation.x = Math.PI / 2; // +Y -> +Z, out to the bar
    stub.position.set(sx * 0.5, DOOR_H - 0.1, 0.037);
    doorPivot.add(stub);
    skinHide.push(stub);
  }

  const controlStrip = beveledBox(CAB_W - 0.1, 0.11, 0.006, trimMat, 0.004);
  controlStrip.position.set(0, DOOR_H - 0.28, 0.038);
  doorPivot.add(controlStrip);
  skinHide.push(controlStrip);
  const leds = [];
  for (let i = 0; i < 5; i++) {
    const l = new THREE.Mesh(new THREE.SphereGeometry(0.011, 10, 8), ledMat.clone());
    l.position.set(-0.24 + i * 0.12, DOOR_H - 0.28, 0.043);
    doorPivot.add(l);
    skinHide.push(l);
    leds.push(l);
  }

  // --- dispensers on the inner liner ------------------------------------------
  // Everything here sits on the RIGHT half of the door: with the door dropped
  // flat the composition puts the panel over screen-left, and a dispenser on
  // the left half of the door lands underneath it.
  const DX = 0.22; // dispenser centre, door-local x
  const DZ = DOOR_FACE - 0.026; // the moulding stands proud of the liner
  const dispHousing = beveledBox(0.36, 0.32, 0.026, materials.polymer(0x2f353d), 0.01);
  dispHousing.position.set(DX, 0.79, DZ);
  doorPivot.add(dispHousing);

  // main-wash well: a floor plus four rim walls, so it reads as a cup you
  // could drop a tablet into rather than a painted rectangle
  const cupFloor = beveledBox(0.23, 0.17, 0.008, materials.polymer(0x14171b), 0.004);
  cupFloor.position.set(DX, 0.74, DZ - 0.017);
  doorPivot.add(cupFloor);
  for (const [w, h, dx, dy] of [
    [0.25, 0.014, 0, 0.092],
    [0.25, 0.014, 0, -0.092],
    [0.014, 0.17, 0.125, 0],
    [0.014, 0.17, -0.125, 0],
  ]) {
    const wall = beveledBox(w, h, 0.032, materials.polymer(0x3d444d), 0.004);
    wall.position.set(DX + dx, 0.74 + dy, DZ - 0.033);
    doorPivot.add(wall);
  }

  const tab = beveledBox(0.1, 0.055, 0.026, materials.polymer(0xe6e3dc), 0.008);
  tab.position.set(DX, 0.735, DZ - 0.034);
  doorPivot.add(tab);

  const preCup = beveledBox(0.15, 0.075, 0.024, materials.polymer(0x14171b), 0.006);
  preCup.position.set(DX - 0.02, 0.895, DZ - 0.016);
  doorPivot.add(preCup);

  // the flap hinges on the far rim, so it swings clear instead of standing
  // between the cup and every camera that looks down at the open door
  const flapPivot = new THREE.Group();
  flapPivot.position.set(DX, 0.652, DZ - 0.05);
  doorPivot.add(flapPivot);
  const flap = beveledBox(0.25, 0.185, 0.012, materials.polymer(0x464e58), 0.006);
  flap.position.set(0, 0.093, 0);
  flapPivot.add(flap);
  const flapLip = beveledBox(0.09, 0.016, 0.022, materials.polymer(0x646d78), 0.005);
  flapLip.position.set(0, 0.182, -0.014);
  flapPivot.add(flapLip);

  const waxBody = rod(0.026, 0.075, materials.polymer(0x8a3d2e), 14);
  waxBody.rotation.z = Math.PI / 2; // +Y -> -X, pointing at the catch
  waxBody.position.set(DX + 0.185, 0.855, DZ - 0.03);
  doorPivot.add(waxBody);
  const latch = beveledBox(0.075, 0.018, 0.018, cutleryMat, 0.005);
  latch.position.set(DX + 0.075, 0.855, DZ - 0.03);
  doorPivot.add(latch);

  const rinseCap = lathe(
    [
      [0, 0.012],
      [0.05, 0.012],
      [0.058, 0.004],
      [0.058, -0.014],
      [0, -0.014],
    ],
    materials.polymer(0x3a424c),
    28,
  );
  rinseCap.rotation.x = -Math.PI / 2;
  rinseCap.position.set(0.52, 0.79, DOOR_FACE - 0.024);
  doorPivot.add(rinseCap);
  const rinseSlot = beveledBox(0.055, 0.012, 0.008, materials.polymer(0x6d7681), 0.003);
  rinseSlot.position.set(0.52, 0.79, DOOR_FACE - 0.038);
  doorPivot.add(rinseSlot);
  const rinseRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.068, 0.007, 8, 30),
    materials.polymer(0x2b3138),
  );
  rinseRing.position.set(0.52, 0.79, DOOR_FACE - 0.024);
  doorPivot.add(rinseRing);

  // ============================================================================
  //  UNDER-TUB: circulation pump, flow-through heater, drain pump, valve
  // ============================================================================
  // The volute is a HALF shell whose missing half faces the camera, and the
  // motor sits OUTBOARD of it along +X. Put the motor between the volute and
  // the lens and the impeller — the whole point of that step — is just a
  // cylinder you cannot see into.
  for (const [r, h] of [
    [PUMP_R, 0.12],
    [PUMP_R + 0.012, 0.04],
  ]) {
    const shell = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, h, 36, 1, true, Math.PI / 2, Math.PI),
      pumpMat2,
    );
    shell.rotation.z = Math.PI / 2; // axis along X
    shell.position.set(PUMP_X, PUMP_Y, PUMP_Z);
    group.add(shell);
  }

  const eyePlate = lathe(
    [
      [0.05, 0],
      [PUMP_R, 0],
      [PUMP_R, 0.014],
      [0.05, 0.014],
    ],
    pumpMat2,
    36,
  );
  eyePlate.rotation.z = Math.PI / 2; // +Y -> -X, the sump side
  eyePlate.position.set(PUMP_X - 0.06, PUMP_Y, PUMP_Z);
  group.add(eyePlate);
  const eyeMouth = rod(0.05, 0.06, pumpMat, 20);
  eyeMouth.rotation.z = Math.PI / 2;
  eyeMouth.position.set(PUMP_X - 0.06, PUMP_Y, PUMP_Z);
  group.add(eyeMouth);

  const backPlateP = disc(PUMP_R, 0.016, pumpMat, 36);
  backPlateP.rotation.z = Math.PI / 2;
  backPlateP.position.set(PUMP_X + 0.066, PUMP_Y, PUMP_Z);
  group.add(backPlateP);

  const motorCan = lathe(
    [
      [0, 0],
      [0.095, 0.008],
      [0.1, 0.03],
      [0.1, 0.2],
      [0.094, 0.222],
      [0, 0.23],
    ],
    motorMat,
    30,
  );
  motorCan.rotation.z = -Math.PI / 2; // +Y -> +X, outboard of the volute
  motorCan.position.set(PUMP_X + 0.074, PUMP_Y, PUMP_Z);
  group.add(motorCan);
  const motorRibs = boltCircle(6, 0.099, 0.009, motorMat, 0.16);
  motorRibs.rotation.z = -Math.PI / 2;
  motorRibs.position.set(PUMP_X + 0.11, PUMP_Y, PUMP_Z);
  group.add(motorRibs);

  // mount carries the orientation, the child carries the spin — a single Euler
  // cannot do both (the outer term would rotate about the wrong axis)
  const impellerMount = new THREE.Group();
  impellerMount.position.set(PUMP_X, PUMP_Y, PUMP_Z);
  impellerMount.rotation.z = Math.PI / 2;
  group.add(impellerMount);
  const impeller = new THREE.Group();
  impellerMount.add(impeller);
  impeller.add(
    lathe(
      [
        [0, 0.03],
        [0.03, 0.032],
        [0.045, 0.02],
        [0.045, -0.03],
        [0, -0.034],
      ],
      motorMat,
      24,
    ),
  );
  const impBack = disc(PUMP_R - 0.024, 0.01, impMat, 32);
  impBack.position.y = -0.036;
  impeller.add(impBack);
  for (let i = 0; i < 7; i++) {
    const a = (i / 7) * TAU;
    const vane = beveledBox(0.08, 0.056, 0.012, impMat, 0.004);
    vane.position.set(Math.cos(a) * 0.064, -0.004, Math.sin(a) * 0.064);
    vane.rotation.y = -a + 0.55; // backward-curved, like a real wash impeller
    impeller.add(vane);
  }

  // volute throat -> flow-through heater, which runs across the FRONT of the
  // bay where nothing else can get in front of it
  const throat = tubeAlong(
    [
      [PUMP_X, PUMP_Y + PUMP_R - 0.02, PUMP_Z],
      [PUMP_X - 0.02, PUMP_Y + PUMP_R + 0.03, PUMP_Z - 0.05],
      [HEAT_X0 + 0.05, HEAT_Y + 0.07, HEAT_Z + 0.02],
      [HEAT_X0, HEAT_Y, HEAT_Z],
    ],
    0.045,
    pipeMat,
    { tubularSegments: 30, radialSegments: 14 },
  );
  group.add(throat);

  const heaterBody = rod(0.055, HEAT_X0 - HEAT_X1, heaterMat, 24);
  heaterBody.rotation.z = Math.PI / 2; // +Y -> -X
  heaterBody.position.set(HEAT_X0, HEAT_Y, HEAT_Z);
  group.add(heaterBody);
  const heaterFins = boltCircle(8, 0.06, 0.008, heaterMat, 0.34);
  heaterFins.rotation.z = Math.PI / 2;
  heaterFins.position.set(HEAT_X0 - 0.08, HEAT_Y, HEAT_Z);
  group.add(heaterFins);
  for (const x of [HEAT_X0 - 0.012, HEAT_X1 + 0.012]) {
    const collar = lathe(
      [
        [0.048, 0],
        [0.07, 0],
        [0.07, 0.024],
        [0.048, 0.024],
      ],
      pipeMat2,
      24,
    );
    collar.rotation.z = Math.PI / 2;
    collar.position.set(x, HEAT_Y, HEAT_Z);
    group.add(collar);
  }

  const towerFeed = tubeAlong(
    [
      [HEAT_X1, HEAT_Y, HEAT_Z],
      [HEAT_X1 - 0.1, HEAT_Y + 0.07, HEAT_Z - 0.2],
      [HEAT_X1 + 0.02, HEAT_Y + 0.17, HEAT_Z - 0.5],
      [-0.12, 0.7, -0.66],
      [0.0, 0.79, -0.7],
    ],
    0.04,
    pipeMat,
    { tubularSegments: 44, radialSegments: 14 },
  );
  group.add(towerFeed);

  const loFeed = tubeAlong(
    [
      [HEAT_X1 + 0.02, HEAT_Y + 0.01, HEAT_Z - 0.01],
      [-0.2, HEAT_Y + 0.08, HEAT_Z - 0.06],
      [-0.08, 0.53, -0.04],
      [0.0, 0.56, SUMP_Z],
    ],
    0.036,
    pipeMat,
    { tubularSegments: 34, radialSegments: 14 },
  );
  group.add(loFeed);

  // back-wall duct feeding the upper arm and the ceiling head
  const tower = beveledBox(0.17, ARM_UP_Y - 0.79, 0.06, tubMat, 0.014);
  tower.position.set(0, (ARM_UP_Y + 0.79) / 2, TUB_BACK + TUB_T + 0.028);
  tubGroup.add(tower);
  const towerElbow = tubeAlong(
    [
      [0, ARM_UP_Y - 0.03, TUB_BACK + TUB_T + 0.03],
      [0, ARM_UP_Y, TUB_BACK + 0.22],
      [0, ARM_UP_Y, -0.14],
      [0, ARM_UP_Y, 0.02],
    ],
    0.033,
    armMat,
    { tubularSegments: 36, radialSegments: 14 },
  );
  tubGroup.add(towerElbow);
  const headFeed = beveledBox(0.06, HEAD_Y - ARM_UP_Y, 0.05, armMat, 0.012);
  headFeed.position.set(0, (HEAD_Y + ARM_UP_Y) / 2, TUB_BACK + TUB_T + 0.03);
  tubGroup.add(headFeed);
  const headElbow = tubeAlong(
    [
      [0, HEAD_Y - 0.03, TUB_BACK + TUB_T + 0.03],
      [0, HEAD_Y + 0.01, TUB_BACK + 0.22],
      [0, HEAD_Y + 0.01, 0.02],
    ],
    0.026,
    armMat,
    { tubularSegments: 30, radialSegments: 12 },
  );
  tubGroup.add(headElbow);

  // --- drain pump + the high loop ---------------------------------------------
  const drainVolute = lathe(
    [
      [0, 0],
      [0.086, 0.004],
      [0.09, 0.02],
      [0.09, 0.086],
      [0.084, 0.102],
      [0, 0.106],
    ],
    motorMat,
    28,
  );
  drainVolute.rotation.z = Math.PI / 2; // +Y -> -X
  drainVolute.position.set(DRAIN_X + 0.05, DRAIN_Y, DRAIN_Z);
  group.add(drainVolute);
  const drainMotor = lathe(
    [
      [0, 0],
      [0.07, 0.006],
      [0.074, 0.024],
      [0.074, 0.16],
      [0.068, 0.175],
      [0, 0.18],
    ],
    pumpMat,
    26,
  );
  drainMotor.rotation.z = -Math.PI / 2;
  drainMotor.position.set(DRAIN_X + 0.05, DRAIN_Y, DRAIN_Z);
  group.add(drainMotor);
  const drainMount = new THREE.Group();
  drainMount.position.set(DRAIN_X - 0.005, DRAIN_Y, DRAIN_Z);
  drainMount.rotation.z = Math.PI / 2;
  group.add(drainMount);
  const drainImpeller = new THREE.Group();
  drainMount.add(drainImpeller);
  for (let i = 0; i < 5; i++) {
    const a = (i / 5) * TAU;
    const v = beveledBox(0.06, 0.04, 0.01, motorMat, 0.003);
    v.position.set(Math.cos(a) * 0.044, 0, Math.sin(a) * 0.044);
    v.rotation.y = -a + 0.4;
    drainImpeller.add(v);
  }

  const drainIn = tubeAlong(
    [
      [-0.1, SUMP_Y - 0.03, SUMP_Z],
      [-0.24, 0.5, SUMP_Z + 0.08],
      [-0.36, 0.45, DRAIN_Z - 0.04],
      [-0.4, DRAIN_Y, DRAIN_Z],
    ],
    0.038,
    pipeMat,
    { tubularSegments: 30, radialSegments: 14 },
  );
  group.add(drainIn);

  // The high loop is real and it matters, but it is also a metre of black hose
  // draped across the composition — so it is on screen only while draining.
  const drainHose = tubeAlong(
    [
      [DRAIN_X - 0.02, DRAIN_Y + 0.09, DRAIN_Z],
      [-0.36, 0.46, -0.1],
      [-0.08, 0.5, -0.5],
      [0.42, 0.58, -0.78],
      [0.86, 0.8, -0.86],
      [0.98, 1.3, -0.84],
      [0.9, 1.72, -0.7],
      [0.66, 1.68, -0.54],
      [0.66, 1.2, -0.66],
      [0.8, 0.66, -0.88],
      [0.98, 0.4, -0.98],
    ],
    0.038,
    hoseMat,
    { tubularSegments: 120, radialSegments: 12, tension: 0.4 },
  );
  group.add(drainHose);
  drainShow.push(drainHose);

  // --- inlet valve + fill tube ---------------------------------------------
  const valveBody = beveledBox(0.11, 0.1, 0.13, valveMat, 0.014);
  valveBody.position.copy(VALVE);
  group.add(valveBody);
  inletShow.push(valveBody);
  const valveCoil = rod(0.045, 0.08, materials.polymer(0x2a2f36), 18);
  valveCoil.position.set(VALVE.x, VALVE.y + 0.05, VALVE.z);
  group.add(valveCoil);
  inletShow.push(valveCoil);

  const inletHose = tubeAlong(
    [
      [VALVE.x, VALVE.y, VALVE.z - 0.07],
      [VALVE.x + 0.15, VALVE.y - 0.05, VALVE.z - 0.25],
      [VALVE.x + 0.5, VALVE.y - 0.1, VALVE.z - 0.32],
      [VALVE.x + 0.78, VALVE.y - 0.12, VALVE.z - 0.26],
    ],
    0.034,
    hoseMat,
    { tubularSegments: 40, radialSegments: 12 },
  );
  group.add(inletHose);
  inletShow.push(inletHose);

  const fillTube = tubeAlong(
    [
      [VALVE.x, VALVE.y + 0.09, VALVE.z + 0.02],
      [VALVE.x - 0.02, 0.6, VALVE.z + 0.12],
      [0.42, 0.74, -0.4],
      [0.3, 0.78, -0.26],
    ],
    0.03,
    pipeMat,
    { tubularSegments: 34, radialSegments: 12 },
  );
  group.add(fillTube);
  inletShow.push(fillTube);

  // ============================================================================
  //  WATER
  // ============================================================================
  const sumpWater = disc(SUMP_R - 0.014, 1, waterMat, 40);
  sumpWater.position.set(0, SUMP_Y, SUMP_Z);
  tubGroup.add(sumpWater);

  // The two litres do not sit neatly inside the well — they pool out across
  // the floor around it. That sheet is also the only part of the charge a
  // camera above the racks can see, since a well 11 cm deep is invisible from
  // any angle shallower than about 16 degrees.
  const floorPool = lathe(
    [
      [0.46, 0],
      [0.45, 0.011],
      [0.4, 0.017],
      [0.3, 0.02],
      [SUMP_R + 0.015, 0.02],
    ],
    waterMat,
    48,
  );
  floorPool.position.set(0, FLOOR_Y + 0.004, SUMP_Z);
  tubGroup.add(floorPool);

  const floorFilm = new THREE.Mesh(
    new THREE.PlaneGeometry(2 * TUB_IN - 0.03, TUB_DEPTH - 0.06),
    filmMat,
  );
  floorFilm.rotation.x = -Math.PI / 2;
  floorFilm.position.set(0, FLOOR_Y + 0.004, TUB_MID_Z);
  tubGroup.add(floorFilm);

  // ============================================================================
  //  FLOW DOTS — one phase clock, six trails
  // ============================================================================
  function dotTrail(points, count, color, size, parent = group) {
    const curve = new THREE.CatmullRomCurve3(
      points.map((p) => new THREE.Vector3(...p)),
      false,
      'catmullrom',
      0.32,
    );
    const geo = new THREE.SphereGeometry(size, 10, 8);
    const g = new THREE.Group();
    const dots = [];
    for (let i = 0; i < count; i++) {
      const d = new THREE.Mesh(geo, dropMat(color));
      g.add(d);
      dots.push(d);
    }
    parent.add(g);
    function place(phase, vis) {
      dots.forEach((d, i) => {
        const t = (((phase + i / count) % 1) + 1) % 1;
        d.position.copy(curve.getPointAt(t));
        d.material.opacity = vis * clamp01(win(t, 0, 0.07) * (1 - win(t, 0.92, 1)));
      });
    }
    place(0, 0);
    return { place };
  }

  // Every trail rides the OUTSIDE of its pipe run, never the true centreline —
  // packets drawn down a pipe's axis are inside opaque plastic and never render.
  const suctionDots = dotTrail(
    [
      [0.2, SUMP_Y - 0.03, SUMP_Z + 0.05],
      [0.31, 0.52, 0.08],
      [0.29, 0.47, 0.2],
      [0.2, 0.47, 0.29],
    ],
    5,
    0x7fe0f0,
    0.026,
  );

  const pressDots = dotTrail(
    [
      [PUMP_X + 0.02, PUMP_Y + PUMP_R - 0.01, PUMP_Z + 0.06],
      [PUMP_X - 0.04, PUMP_Y + PUMP_R + 0.05, PUMP_Z - 0.02],
      [HEAT_X0 - 0.02, HEAT_Y + 0.04, HEAT_Z + 0.06],
      [-0.06, HEAT_Y + 0.04, HEAT_Z + 0.06],
      [HEAT_X1 + 0.02, HEAT_Y + 0.04, HEAT_Z + 0.05],
      [HEAT_X1 - 0.08, HEAT_Y + 0.12, HEAT_Z - 0.2],
      [-0.24, 0.68, -0.5],
      [-0.04, 0.8, -0.68],
    ],
    7,
    0x8fe6f2,
    0.028,
  );

  const towerDots = dotTrail(
    [
      [0.055, 0.82, TUB_BACK + TUB_T + 0.062],
      [0.055, 1.3, TUB_BACK + TUB_T + 0.062],
      [0.05, ARM_UP_Y - 0.04, TUB_BACK + TUB_T + 0.062],
      [0.035, ARM_UP_Y + 0.036, -0.3],
      [0.02, ARM_UP_Y + 0.036, 0.0],
    ],
    6,
    0x8fe6f2,
    0.026,
    tubGroup,
  );

  const loFeedDots = dotTrail(
    [
      [HEAT_X1 + 0.02, HEAT_Y + 0.05, HEAT_Z + 0.03],
      [-0.2, 0.54, HEAT_Z - 0.06],
      [-0.07, 0.57, -0.03],
      [0.0, 0.62, SUMP_Z],
      [0.0, ARM_LO_Y - 0.02, SUMP_Z],
    ],
    6,
    0x8fe6f2,
    0.026,
  );

  const drainDots = dotTrail(
    [
      [-0.12, SUMP_Y - 0.06, SUMP_Z + 0.05],
      [-0.26, 0.47, 0.1],
      [-0.4, 0.42, 0.21],
      [-0.35, 0.51, 0.24],
      [-0.38, 0.49, -0.1],
      [-0.1, 0.53, -0.5],
      [0.42, 0.61, -0.79],
      [0.88, 0.83, -0.87],
      [1.01, 1.3, -0.85],
      [0.93, 1.75, -0.7],
      [0.66, 1.71, -0.52],
      [0.63, 1.2, -0.65],
      [0.78, 0.66, -0.88],
      [0.99, 0.4, -0.99],
    ],
    10,
    0x74b7cf,
    0.028,
  );

  const inletDots = dotTrail(
    [
      [1.28, 0.28, VALVE.z - 0.26],
      [1.0, 0.29, VALVE.z - 0.3],
      [0.68, 0.35, VALVE.z - 0.24],
      [0.56, 0.44, VALVE.z - 0.06],
      [0.53, 0.62, VALVE.z + 0.14],
      [0.44, 0.77, -0.4],
      [0.28, 0.81, -0.24],
      [0.06, SUMP_Y + 0.08, SUMP_Z],
    ],
    8,
    0x9fe4f2,
    0.026,
  );

  // ============================================================================
  //  FALLING SPRAY, CONDENSATION, RINSE-AID SHEETING
  // ============================================================================
  const fallGeo = new THREE.SphereGeometry(0.013, 8, 6);
  const falling = [];
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(fallGeo, dropMat());
    m.scale.set(0.62, 2.4, 0.62);
    tubGroup.add(m);
    falling.push({
      mesh: m,
      seed: i / 22,
      x: (rnd() - 0.5) * 1.16,
      z: TUB_MID_Z + (rnd() - 0.5) * 1.02,
      top: 1.5 + rnd() * 0.55,
    });
  }

  const beadGeo = new THREE.SphereGeometry(0.023, 8, 6);
  const beads = [];
  for (let i = 0; i < 22; i++) {
    const m = new THREE.Mesh(beadGeo, dropMat(0x63cfe4));
    m.scale.set(1.05, 1.15, 0.6);
    tubGroup.add(m);
    const side = i % 2 ? 1 : -1;
    beads.push({
      mesh: m,
      seed: rnd(),
      x: side * (0.18 + rnd() * 0.42),
      z: TUB_BACK + TUB_T + 0.012,
      top: 1.15 + rnd() * 1.0,
    });
  }
  const sheet = [];
  for (let i = 0; i < 10; i++) {
    const m = new THREE.Mesh(beadGeo, dropMat(0x7fdcee));
    m.scale.set(0.7, 2.0, 0.7);
    tubGroup.add(m);
    sheet.push({ mesh: m, seed: i / 10 });
  }

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const labels = calloutSets(['exterior', 'load', 'soap', 'water', 'pump', 'arms', 'drain', 'dry']);

  // Leader rule (learned the hard way): label-layout.js flips any pill that
  // would overflow the FRAME to the other side of its anchor, and on these
  // right-of-centre framings the other side is under the text panel. So every
  // pill below is short and authored to grow rightward wherever it can.
  labels.add('exterior', group, 'Door handle', [0.34, CAB_Y1 - 0.14, FRONT_Z + 0.12], 22, 62);
  labels.add('exterior', group, 'Control panel', [0.14, CAB_Y1 - 0.32, FRONT_Z + 0.05], 8, 76);
  labels.add('exterior', group, 'Stainless door', [0.45, 1.32, FRONT_Z + 0.03], -18, 66);
  labels.add('exterior', group, 'Toe kick + vent', [0.24, CAB_Y0 + 0.11, FRONT_Z + 0.03], -32, 62);

  labels.add('load', rackUp, 'Upper rack — glasses', [0.34, 0.3, 0.06], 36, 58);
  labels.add('load', rackLo, 'Lower rack — plates', [0.3, 0.36, -0.04], 14, 62);
  labels.add('load', basket, 'Cutlery basket', [0.12, 0.22, 0.1], -34, 58);
  labels.add('load', doorPivot, 'Door drops flat', [0.52, 0.34, DOOR_FACE - 0.02], -30, 62);

  labels.add('soap', doorPivot, 'Main-wash cup', [0.22, 0.7, DOOR_FACE - 0.07], -40, 66);
  labels.add('soap', doorPivot, 'Pre-wash cup', [0.16, 0.9, DOOR_FACE - 0.05], 34, 62);
  labels.add('soap', doorPivot, 'Wax-motor latch', [0.35, 0.855, DOOR_FACE - 0.05], 16, 60);
  labels.add('soap', doorPivot, 'Rinse-aid cap', [0.56, 0.79, DOOR_FACE - 0.05], -18, 58);

  labels.add('water', tubGroup, 'Sump — about 2 litres', [0.2, SUMP_Y + 0.05, SUMP_Z + 0.1], -22, 78);
  labels.add('water', tubGroup, 'Filter over the drain', [0.05, FLOOR_Y + 0.05, SUMP_Z + 0.16], 34, 66);
  labels.add('water', group, 'Inlet valve', [0.56, 0.46, -0.55], 26, 58);
  labels.add('water', rackUp, 'Dishes never sit in it', [0.34, 0.14, 0.12], 28, 62);

  labels.add('pump', group, 'Impeller — 2800 rpm', [PUMP_X, PUMP_Y + 0.05, PUMP_Z + 0.11], 34, 60);
  labels.add('pump', group, 'Volute housing', [PUMP_X - 0.06, PUMP_Y - PUMP_R, PUMP_Z + 0.05], -48, 62);
  labels.add('pump', group, 'Flow-through heater', [HEAT_X0 - 0.18, HEAT_Y - 0.05, HEAT_Z + 0.04], -34, 80);
  labels.add('pump', group, 'Wash motor', [PUMP_X + 0.18, PUMP_Y - 0.08, PUMP_Z + 0.02], -30, 48);

  labels.add('arms', armLo, 'Nozzles tipped sideways', [0.44, 0.07, 0.04], 40, 74);
  labels.add('arms', armLo, 'Jet kicks the arm round', [0.44, 0.12, -0.16], -22, 62);
  labels.add('arms', tubGroup, 'Hub bearing — no motor', [0.1, ARM_LO_Y + 0.02, SUMP_Z + 0.13], -40, 70);
  labels.add('arms', tubGroup, 'Upper arm, same trick', [0.26, ARM_UP_Y + 0.06, 0.1], 26, 46);

  labels.add('drain', group, 'Drain pump', [-0.24, DRAIN_Y - 0.02, DRAIN_Z + 0.07], -38, 70);
  labels.add('drain', group, 'High loop — no backflow', [0.95, 1.72, -0.7], 18, 60);
  labels.add('drain', tubGroup, 'Food trapped on the mesh', [0.13, SUMP_Y + 0.06, SUMP_Z + 0.12], -30, 86);

  labels.add('dry', tubGroup, 'Condensate on the wall', [0.24, 1.42, TUB_BACK + 0.06], -26, 54);
  labels.add('dry', tubGroup, 'Rinse aid: it sheets off', [0.34, RACK_UP_Y + 0.26, 0.3], 24, 56);
  labels.add('dry', tubGroup, 'No fan, no towel', [0.28, 2.08, -0.1], 32, 48);

  // ============================================================================
  //  POSE
  // ============================================================================
  // Everything except the plinth hangs off `body`, so the closing step can turn
  // the machine on the block the way a product film would, without the block
  // itself sliding around underneath it.
  const body = new THREE.Group();
  for (const child of [...group.children]) if (child !== plinth) body.add(child);
  group.add(body);

  const state = {
    reveal: 0,
    door: 0,
    rackOut: 0,
    water: 0,
    armLo: 0,
    armUp: 0,
    impeller: 0,
    drainSpin: 0,
    flow: 0,
    jets: 0,
    heat: 0,
    disp: 0,
    thrust: 0,
    fillVis: 0,
    drainVis: 0,
    steam: 0,
    spin: 0,
    rackLoVis: 1,
  };

  const heaterCold = new THREE.Color(0xb6bcc3);
  const heaterHot = new THREE.Color(0xff8a3a);

  function placeFalling() {
    const vis = clamp01(state.jets);
    for (const f of falling) {
      const t = (((state.flow * 3 + f.seed) % 1) + 1) % 1;
      f.mesh.position.set(f.x, f.top - (f.top - FLOOR_Y - 0.02) * (t * t * 0.6 + t * 0.4), f.z);
      f.mesh.scale.y = 1.5 + 2.2 * t;
      f.mesh.material.opacity = vis * 0.6 * clamp01(win(t, 0, 0.12) * (1 - win(t, 0.86, 1)));
    }
  }

  function placeBeads() {
    const vis = clamp01(state.steam);
    for (const b of beads) {
      const t = (((state.flow + b.seed) % 1) + 1) % 1;
      const drop = smooth(clamp01((t - 0.25) / 0.6));
      b.mesh.position.set(b.x, b.top - (b.top - FLOOR_Y - 0.05) * drop, b.z);
      b.mesh.scale.y = 1 + 2.6 * drop;
      b.mesh.material.opacity = vis * clamp01(win(t, 0, 0.14) * (1 - win(t, 0.9, 1)));
    }
    // rinse-aid sheeting: a continuous film running off the featured glass,
    // which is exactly what you do NOT get without the surfactant
    const gl = featureGlass[0];
    for (const s of sheet) {
      const t = (((state.flow * 3 + s.seed) % 1) + 1) % 1;
      const a = -0.5 + s.seed * 2.4; // biased to the camera-facing side
      s.mesh.position.set(
        gl.position.x + Math.cos(a) * 0.05,
        RACK_UP_Y + 0.29 - 0.31 * t,
        rackUp.position.z + gl.position.z + Math.sin(a) * 0.05,
      );
      s.mesh.scale.y = 1.4 + 2.6 * t;
      s.mesh.material.opacity = vis * 0.9 * clamp01(win(t, 0, 0.1) * (1 - win(t, 0.82, 1)));
    }
  }

  function apply() {
    const r = clamp01(state.reveal);
    const d = clamp01(state.door);
    const jets = clamp01(state.jets);

    armLo.rotation.y = state.armLo;
    armUp.rotation.y = state.armUp;
    impeller.rotation.y = state.impeller;
    drainImpeller.rotation.y = state.drainSpin;

    doorPivot.rotation.x = d * (Math.PI / 2);
    const slide = clamp01(state.rackOut) * d;
    rackLo.position.z = TUB_MID_Z + slide * 0.95;
    rackUp.position.z = TUB_MID_Z + slide * 0.82;

    // detergent flap swings out of the door plane; the wax plunger goes first
    flapPivot.rotation.x = -clamp01(state.disp) * 1.75;
    latch.position.x = DX + 0.075 + clamp01(state.disp) * 0.05;
    tab.visible = d > 0.15;

    const w = clamp01(state.water);
    const depth = 0.006 + w * 0.1;
    sumpWater.scale.y = depth;
    sumpWater.position.y = SUMP_Y + depth / 2;
    floorPool.visible = w > 0.2;
    floorPool.scale.set(0.5 + 0.5 * w, 1, 0.5 + 0.5 * w);
    waterMat.opacity = w > 0.01 ? 0.14 + 0.5 * w : 0;
    filmMat.opacity = jets * 0.22;

    const h = clamp01(state.heat);
    heaterMat.emissiveIntensity = h * 1.5;
    heaterMat.color.copy(heaterCold).lerp(heaterHot, h * 0.75);

    jetMat.opacity = jets * 0.28;
    // programme chase on the control strip — 3 whole cycles a lap
    leds.forEach((l, i) => {
      const k = Math.max(0, Math.cos((i / 5) * TAU - state.flow * TAU * 3));
      l.material.emissiveIntensity = 0.3 + 2.2 * k * k;
    });
    for (const p of thrustParts) p.material.opacity = clamp01(state.thrust) * 0.95;

    suctionDots.place(state.flow, jets);
    pressDots.place((state.flow * 3) % 1, jets);
    towerDots.place((state.flow * 3) % 1, jets);
    loFeedDots.place((state.flow * 3) % 1, jets);
    drainDots.place(state.flow, clamp01(state.drainVis));
    inletDots.place(state.flow, clamp01(state.fillVis));
    placeFalling();
    placeBeads();

    for (const m of skinHide) m.visible = r < 0.5;
    for (const m of tubHide) m.visible = r < 0.5;
    // supply and waste plumbing appear only during the phase they serve —
    // otherwise a metre of black hose sits across every other composition
    for (const m of inletShow) m.visible = r >= 0.5 && state.fillVis > 0.01;
    for (const m of drainShow) m.visible = r >= 0.5 && state.drainVis > 0.01;
    // the spray-arm step slides the lower rack out of the way, exactly as you
    // would to look at the arm — otherwise the rack and plates bury it
    rackLo.visible = state.rackLoVis > 0.5;
    // with the skin gone and the door shut there is nothing to see through the
    // door, so drop it entirely — steel cannot be ghosted
    doorPivot.visible = !(r >= 0.5 && d < 0.5);
    body.rotation.y = state.spin;
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
      armLo,
      armUp,
      impeller,
      drainImpeller,
      doorPivot,
      flapPivot,
      rackLo,
      rackUp,
      sumpWater,
      tubGroup,
    },
  };
}
