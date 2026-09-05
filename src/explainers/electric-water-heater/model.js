import * as THREE from 'three';
import { materials, studioPlinth, rod } from '../../framework/parts.js';
import { beveledBox, tubeAlong, chainPath } from '../../framework/geometry.js';
import { clamp01, win, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A tall residential electric storage water heater (A.O. Smith / Rheem class),
// standing on a studio plinth.
//
// PROPORTIONS (real tall 40-gallon unit: 61.25 in x 18 in dia):
// H:D = 3.40 : 1. Model JACKET_H 2.435 / JACKET_D 0.71 = 3.43 : 1, so the
// silhouette holds. The wall sandwich is jacket sheet (0.355) / ~40 mm of
// foam (0.312-0.352) / glass-lined steel tank (0.297-0.310) at the same
// scale - real units run 25-50 mm of foam under a thin painted jacket.
//
// MECHANISM (researched):
//  - Cold enters the TOP and is carried by a plastic dip tube to ~150 mm off
//    the tank floor; hot is drawn from the very top. Both fittings are on top,
//    which only works because of the dip tube.
//  - The tank stratifies: hot water is ~1.6% less dense at 60 C than at 15 C,
//    so it floats on the incoming cold with a thin thermocline between them.
//    Output stays at full temperature until that boundary reaches the outlet.
//  - Two 4,500 W / 240 V screw-in elements (resistance wire in a copper
//    sheath). The UPPER thermostat is an SPDT master: on a cold tank it runs
//    the upper element only, then hands power down to the lower thermostat.
//    They are interlocked so both can never be live at once - peak draw is
//    4,500 W, and recovery is ~80 L/h at a 50 C rise.
//  - Both thermostats clamp to the OUTSIDE of the tank wall behind the access
//    panels and read the water through the steel. The upper one also carries
//    the ECO high limit (~85 C, manual reset).
//  - A magnesium anode rod corrodes preferentially (magnesium sits far below
//    steel on the galvanic series) and protects the bare steel exposed at
//    pinholes and weld seams in the glass lining.
//  - T&P relief valve: 150 psi / 210 F. Mineral sediment drops out of the
//    heated water and blankets the lower element - the popping and rumbling.
//
// SECTION: every shell (jacket, foam, tank, liner, water) exists in TWO
// forms - a complete one and one missing a 96 deg wedge centred on +Z, the
// direction every revealed step looks from. Swapping meshes rather than
// ghosting keeps us clear of the transmission/clearcoat/metal-opacity traps
// entirely; the camera flight covers the swap.
//
// STATE SCALARS (one pose fn):
//   reveal     0 sealed product -> 1 sectioned
//   spin       turntable angle (rad), whole turns per lap, sealed steps only
//   flow       water-circuit phase, whole cycles per lap
//   thermo     height of the cold layer, 0 (all hot) .. 1 (all cold)
//   upperHeat  0..1 upper element glow
//   lowerHeat  0..1 lower element glow
//   anodeWear  0 fresh rod .. 1 eaten rod
//   sediment   0/1 the mineral crust on the tank floor
//   ions       0/1 the anode ion stream

// --- one scale: the outside ------------------------------------------------
const PLINTH_H = 0.26;
const Y0 = PLINTH_H;
const JACKET_R = 0.355;
const JACKET_TOP = Y0 + 2.3; // 2.56 - where the shoulder starts
const CAP_TOP = Y0 + 2.435; // 2.695

// --- one scale: the wall sandwich ------------------------------------------
const FOAM_R_IN = 0.312;
const FOAM_R_OUT = 0.352;
const FOAM_Y0 = Y0 + 0.1;
const FOAM_Y1 = Y0 + 2.3;
const TANK_R = 0.31;
const LINER_R = 0.297;
const TB = 0.5; // tank cylinder bottom
const TT = 2.4; // tank cylinder top
const DOME_H = 0.15;

// --- one scale: what lives inside ------------------------------------------
const WATER_R = 0.288;
const SLABS = 18;
const DIP_X = 0.19; // cold inlet / dip tube (screen-right side)
const HOT_X = -0.19; // hot outlet
const DIP_BOTTOM = 0.64;
const ANODE_X = -0.11;
const ANODE_Z = 0.13;
const ANODE_R = 0.032;
const ANODE_Y0 = 0.86;
const ANODE_Y1 = 2.6;
const ELEM_UP_Y = 1.86;
const ELEM_LO_Y = 0.74;
const ELEM_AZ = (-48 * Math.PI) / 180; // screwed through the NEAR cut face
const STAT_AZ = (-44 * Math.PI) / 180; // just around the corner, above its element
const STAT_UP_Y = 2.04;
const STAT_LO_Y = 0.98;

// The 96 deg wedge, centred on +Z.
const CUT_HALF = (48 * Math.PI) / 180;
const KEEP_START = CUT_HALF;
const KEEP_LEN = TAU - 2 * CUT_HALF;

const COLD = new THREE.Color(0x2f7fd6);
const HOT = new THREE.Color(0xff5a3c);

// Lathe shell over an arc of azimuth. phi 0 is +Z and grows toward +X, the
// same convention CylinderGeometry uses, so full/cut pairs line up.
function shellArc(profile, material, phiStart, phiLength, segments = 64) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, segments, phiStart, phiLength), material);
  mesh.castShadow = true;
  return mesh;
}

// Flat radial face closing a sectioned shell at azimuth phi. Without these the
// cut edges read as paper-thin sheet instead of a wall with a cross-section -
// and the whole point of step 2 is that the wall HAS a cross-section.
function cutFace(rIn, rOut, y0, y1, phi, material) {
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(rOut - rIn, y1 - y0), material);
  const rm = (rIn + rOut) / 2;
  mesh.rotation.y = phi - Math.PI / 2;
  mesh.position.set(Math.sin(phi) * rm, (y0 + y1) / 2, Math.cos(phi) * rm);
  return mesh;
}

// Dome profile points: rim -> apex (up) or apex -> rim (down), so profiles
// always read bottom -> top and LatheGeometry normals come out facing outward.
function domeUp(r, y, h, n = 8) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    out.push([r * Math.cos(a), y + h * Math.sin(a)]);
  }
  return out;
}
function domeDown(r, y, h, n = 8) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const a = (i / n) * (Math.PI / 2);
    out.push([r * Math.sin(a), y - h * Math.cos(a)]);
  }
  return out;
}

const azPoint = (az, r, y) => new THREE.Vector3(Math.sin(az) * r, y, Math.cos(az) * r);

export function buildWaterHeater({ scene }) {
  const root = new THREE.Group();
  scene.add(root);
  root.add(studioPlinth({ w: 1.55, d: 1.55 }));
  // Everything below hangs off `group`, which is the machine ALONE: the
  // turntable spin has to turn the heater on its plinth, not the plinth with
  // it. `root` is what the framework frames and orbits.
  const group = new THREE.Group();
  root.add(group);

  // --- materials -----------------------------------------------------------
  const jacketMat = materials.paintedMetal(0xd0d5da);
  jacketMat.roughness = 0.5;
  jacketMat.side = THREE.DoubleSide; // sheet steel: the cut shell shows its back
  const jacketCutMat = jacketMat.clone();
  const capMat = materials.polymer(0x2c3037);
  const capCutMat = capMat.clone();
  capCutMat.side = THREE.DoubleSide;
  const panelMat = materials.paintedMetal(0xbcc2c9);
  panelMat.roughness = 0.52;
  const trimMat = materials.polymer(0x14161a);
  const seamMat = materials.polymer(0x8b9199);
  const gasketMat = materials.polymer(0x3d424a);
  const decalMat = materials.polymer(0x1b1e23);
  decalMat.side = THREE.DoubleSide;

  // Rigid polyurethane foam: cream, completely matte, no specular at all.
  const foamMat = new THREE.MeshPhysicalMaterial({
    color: 0xdcc79c,
    metalness: 0,
    roughness: 0.98,
    sheen: 0.35,
    sheenColor: new THREE.Color(0xfff3d8),
  });

  // Bare steel tank shell. roughnessMap MULTIPLIES, so push roughness up or a
  // 2 m cylinder turns into a softbox mirror.
  const tankMat = materials.brushedSteel(0xb4bac2);
  tankMat.roughness = 0.62;
  const tankCutMat = tankMat.clone();
  tankCutMat.side = THREE.DoubleSide;

  // Vitreous enamel fused to the inside of the steel: dark, glassy, and only
  // ever seen from INSIDE the tank, so it renders BackSide - never a concave
  // metal mirror.
  const linerMat = new THREE.MeshPhysicalMaterial({
    color: 0x16323d,
    metalness: 0.06,
    roughness: 0.34,
    clearcoat: 0.25,
    clearcoatRoughness: 0.3,
    side: THREE.BackSide,
  });

  const copperMat = new THREE.MeshPhysicalMaterial({
    color: 0xb87333,
    metalness: 1,
    roughness: 0.4,
  });
  const elemUpMat = copperMat.clone();
  const elemLoMat = copperMat.clone();
  elemUpMat.emissive = new THREE.Color(0xff5a1e);
  elemLoMat.emissive = new THREE.Color(0xff5a1e);
  elemUpMat.emissiveIntensity = 0;
  elemLoMat.emissiveIntensity = 0;

  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xb5913f,
    metalness: 1,
    roughness: 0.34,
  });
  const dipMat = materials.polymer(0xe4e8ec);
  const anodeMat = new THREE.MeshPhysicalMaterial({
    color: 0x9aa1a8,
    metalness: 0.8,
    roughness: 0.66,
  });
  const anodeSpentMat = anodeMat.clone();
  anodeSpentMat.color.set(0xa39a8c);
  anodeSpentMat.roughness = 0.85;
  const statMat = materials.polymer(0x1d2026);
  const statFaceMat = materials.polymer(0xcfd4da);
  const clipMat = materials.brushedSteel(0xaeb5bd);
  clipMat.roughness = 0.55;
  const ecoMat = new THREE.MeshStandardMaterial({
    color: 0xd23a2a,
    emissive: 0x6a1208,
    emissiveIntensity: 0.6,
    roughness: 0.45,
  });
  const sedimentMat = new THREE.MeshPhysicalMaterial({
    color: 0xbfa87e,
    metalness: 0,
    roughness: 0.96,
  });

  // ==========================================================================
  //  OUTER SHELL - the complete product (reveal 0)
  // ==========================================================================
  const jacketProfile = [
    [0.0, Y0],
    [0.33, Y0],
    [0.33, Y0 + 0.04],
    [JACKET_R, Y0 + 0.09],
    [JACKET_R, JACKET_TOP],
  ];
  const capProfile = [
    [JACKET_R, JACKET_TOP],
    [0.352, JACKET_TOP + 0.04],
    [0.3, JACKET_TOP + 0.095],
    [0.21, CAP_TOP - 0.01],
    [0.0, CAP_TOP],
  ];

  const shellFull = new THREE.Group();
  group.add(shellFull);
  shellFull.add(shellArc(jacketProfile, jacketMat, 0, TAU));
  shellFull.add(shellArc(capProfile, capMat, 0, TAU));

  const shellCut = new THREE.Group();
  group.add(shellCut);
  shellCut.add(shellArc(jacketProfile, jacketCutMat, KEEP_START, KEEP_LEN));
  shellCut.add(shellArc(capProfile, capCutMat, KEEP_START, KEEP_LEN));

  // rolled seam: a real jacket is two shells crimped together, and the line it
  // leaves is most of what saves the sealed shot from being a blank cylinder
  const seamProfile = [
    [0.3575, 1.336],
    [0.3575, 1.35],
  ];
  shellFull.add(shellArc(seamProfile, seamMat, 0, TAU));
  shellCut.add(shellArc(seamProfile, seamMat, KEEP_START, KEEP_LEN));

  // Access panels, screwed to the jacket directly over the elements. Curved
  // patches that follow the jacket, not flat plates stuck on a cylinder.
  const PANEL_AZ = (-44 * Math.PI) / 180;
  const PANEL_HALF = (22 * Math.PI) / 180;
  function accessPanel(yLo, yHi) {
    const g = new THREE.Group();
    g.add(
      shellArc(
        [
          [0.3555, yLo - 0.018],
          [0.3555, yHi + 0.018],
        ],
        gasketMat,
        PANEL_AZ - PANEL_HALF - 0.035,
        (PANEL_HALF + 0.035) * 2,
        30,
      ),
    );
    g.add(
      shellArc(
        [
          [0.358, yLo],
          [0.36, yLo + 0.02],
          [0.36, yHi - 0.02],
          [0.358, yHi],
        ],
        panelMat,
        PANEL_AZ - PANEL_HALF,
        PANEL_HALF * 2,
        28,
      ),
    );
    for (const [az, y] of [
      [PANEL_AZ - PANEL_HALF * 0.7, yLo + 0.05],
      [PANEL_AZ + PANEL_HALF * 0.7, yHi - 0.05],
    ]) {
      const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.012, 14), trimMat);
      screw.rotation.z = Math.PI / 2;
      screw.rotation.y = -az;
      screw.position.copy(azPoint(az, 0.362, y));
      g.add(screw);
    }
    return g;
  }
  shellFull.add(accessPanel(1.86, 2.16));
  shellFull.add(accessPanel(0.72, 1.02));

  // Rating plate - the sticker every one of these wears.
  shellFull.add(
    shellArc(
      [
        [0.357, 1.28],
        [0.357, 1.66],
      ],
      decalMat,
      (-28 * Math.PI) / 180,
      (30 * Math.PI) / 180,
      24,
    ),
  );

  // ==========================================================================
  //  FITTINGS - always visible, sealed or sectioned
  // ==========================================================================
  const fittings = new THREE.Group();
  group.add(fittings);

  function nipple(x, collarColor) {
    const g = new THREE.Group();
    const body = rod(0.045, 0.2, brassMat, 18);
    body.position.set(x, CAP_TOP - 0.03, 0);
    g.add(body);
    const collar = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.058, 0.03, 20),
      materials.polymer(collarColor),
    );
    collar.position.set(x, CAP_TOP + 0.1, 0);
    g.add(collar);
    const pipe = tubeAlong(
      [
        [x, CAP_TOP + 0.16, 0],
        [x, CAP_TOP + 0.3, 0],
        [x * 1.35, CAP_TOP + 0.42, 0],
      ],
      0.036,
      copperMat,
      { tubularSegments: 30, radialSegments: 14 },
    );
    g.add(pipe);
    return g;
  }
  fittings.add(nipple(DIP_X, 0x2b5fb0));
  fittings.add(nipple(HOT_X, 0xa8322a));

  // Anode plug: a hex head, the only sign from outside that the rod is there.
  const anodePlug = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.05, 6), brassMat);
  anodePlug.position.set(ANODE_X, CAP_TOP - 0.005, ANODE_Z);
  fittings.add(anodePlug);

  // T&P relief valve on the flank, with its discharge tube run down the side.
  const TP_AZ = (-100 * Math.PI) / 180;
  const tpBody = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.05, 0.17, 18), brassMat);
  tpBody.rotation.z = Math.PI / 2;
  tpBody.rotation.y = TP_AZ;
  tpBody.position.copy(azPoint(TP_AZ, 0.42, 2.24));
  fittings.add(tpBody);
  const tpLever = beveledBox(0.13, 0.022, 0.05, materials.polymer(0x8d1f17), 0.008);
  tpLever.rotation.z = 0.28;
  tpLever.rotation.y = TP_AZ;
  tpLever.position.copy(azPoint(TP_AZ, 0.455, 2.33));
  fittings.add(tpLever);
  const tpTop = azPoint(TP_AZ, 0.465, 2.19);
  const tpFoot = azPoint(TP_AZ, 0.45, 0.44);
  fittings.add(
    tubeAlong(
      [
        [tpTop.x, 2.19, tpTop.z],
        [tpTop.x, 2.0, tpTop.z],
        [tpFoot.x, 1.2, tpFoot.z],
        [tpFoot.x, 0.44, tpFoot.z],
      ],
      0.03,
      copperMat,
      { tubularSegments: 40, radialSegments: 12 },
    ),
  );

  // Drain valve at the floor of the tank, on the front.
  const drainBody = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.036, 0.1, 16), brassMat);
  drainBody.rotation.x = Math.PI / 2;
  drainBody.position.set(0, Y0 + 0.16, 0.4);
  fittings.add(drainBody);
  const drainWheel = new THREE.Mesh(new THREE.TorusGeometry(0.048, 0.012, 8, 22), trimMat);
  drainWheel.position.set(0, Y0 + 0.16, 0.46);
  fittings.add(drainWheel);

  // ==========================================================================
  //  GUTS - only ever seen sectioned (reveal 1)
  // ==========================================================================
  const guts = new THREE.Group();
  group.add(guts);

  // foam: a closed cross-section, so the wedge edge shows real thickness
  const foamProfile = [
    [FOAM_R_IN, FOAM_Y0],
    [FOAM_R_OUT, FOAM_Y0],
    [FOAM_R_OUT, FOAM_Y1],
    [FOAM_R_IN, FOAM_Y1],
    [FOAM_R_IN, FOAM_Y0],
  ];
  guts.add(shellArc(foamProfile, foamMat, KEEP_START, KEEP_LEN));
  const foamFaceMat = foamMat.clone();
  foamFaceMat.side = THREE.DoubleSide;
  guts.add(cutFace(FOAM_R_IN, FOAM_R_OUT, FOAM_Y0, FOAM_Y1, KEEP_START, foamFaceMat));
  guts.add(cutFace(FOAM_R_IN, FOAM_R_OUT, FOAM_Y0, FOAM_Y1, -CUT_HALF, foamFaceMat));

  // tank: steel outside, enamel inside, domed both ends
  const tankProfile = [
    ...domeDown(TANK_R, TB, DOME_H),
    [TANK_R, TB],
    [TANK_R, TT],
    ...domeUp(TANK_R, TT, DOME_H),
  ];
  const linerProfile = [
    ...domeDown(LINER_R, TB, DOME_H * 0.94),
    [LINER_R, TB],
    [LINER_R, TT],
    ...domeUp(LINER_R, TT, DOME_H * 0.94),
  ];
  guts.add(shellArc(tankProfile, tankCutMat, KEEP_START, KEEP_LEN));
  guts.add(shellArc(linerProfile, linerMat, KEEP_START, KEEP_LEN));
  const tankFaceMat = tankMat.clone();
  tankFaceMat.side = THREE.DoubleSide;
  const enamelEdgeMat = new THREE.MeshPhysicalMaterial({
    color: 0x1c3c49,
    metalness: 0.05,
    roughness: 0.25,
    clearcoat: 0.6,
    side: THREE.DoubleSide,
  });
  for (const phi of [KEEP_START, -CUT_HALF]) {
    guts.add(
      cutFace(LINER_R + 0.004, TANK_R, TB - DOME_H * 0.7, TT + DOME_H * 0.7, phi, tankFaceMat),
    );
    guts.add(
      cutFace(LINER_R, LINER_R + 0.004, TB - DOME_H * 0.7, TT + DOME_H * 0.7, phi, enamelEdgeMat),
    );
  }

  // water: 18 stacked bands, each its own colour, plus domed caps. Plain
  // transparent (never transmission) - the dip tube, rod and elements all sit
  // INSIDE this and have to stay visible through it.
  const waterGroup = new THREE.Group();
  guts.add(waterGroup);
  const slabH = (TT - TB) / SLABS;
  const slabs = [];
  for (let i = 0; i < SLABS; i++) {
    const mat = new THREE.MeshPhysicalMaterial({
      color: COLD.clone(),
      emissive: COLD.clone(),
      emissiveIntensity: 0.28,
      metalness: 0,
      roughness: 0.14,
      transparent: true,
      opacity: 0.34,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const bandY0 = TB + i * slabH;
    const band = new THREE.Mesh(
      new THREE.CylinderGeometry(WATER_R, WATER_R, slabH, 48, 1, true, KEEP_START, KEEP_LEN),
      mat,
    );
    band.position.y = bandY0 + slabH / 2;
    waterGroup.add(band);
    for (const phi of [KEEP_START, -CUT_HALF]) {
      waterGroup.add(cutFace(0, WATER_R, bandY0, bandY0 + slabH, phi, mat));
    }
    slabs.push(mat);
  }
  waterGroup.add(
    shellArc(domeUp(WATER_R, TT, DOME_H * 0.8), slabs[SLABS - 1], KEEP_START, KEEP_LEN, 48),
  );
  waterGroup.add(shellArc(domeDown(WATER_R, TB, DOME_H * 0.8), slabs[0], KEEP_START, KEEP_LEN, 48));

  // dip tube: hangs off the cold inlet, ends a hand's width off the floor
  const dipTube = tubeAlong(
    [
      [DIP_X, CAP_TOP - 0.02, 0],
      [DIP_X, 2.2, 0],
      [DIP_X, 1.2, 0],
      [DIP_X, DIP_BOTTOM, 0],
    ],
    0.027,
    dipMat,
    { tubularSegments: 60, radialSegments: 14 },
  );
  guts.add(dipTube);

  // anode rod: fresh and eaten versions, swapped by anodeWear
  const anodeFreshGroup = new THREE.Group();
  const anodeFresh = rod(ANODE_R, ANODE_Y1 - ANODE_Y0, anodeMat, 20);
  anodeFresh.position.set(ANODE_X, ANODE_Y0, ANODE_Z);
  const anodeTipCap = new THREE.Mesh(new THREE.SphereGeometry(ANODE_R, 18, 12), anodeMat);
  anodeTipCap.position.set(ANODE_X, ANODE_Y0, ANODE_Z);
  anodeFreshGroup.add(anodeFresh, anodeTipCap);
  guts.add(anodeFreshGroup);

  const spentPts = [];
  for (let i = 0; i <= 26; i++) {
    const u = i / 26;
    const y = ANODE_Y0 + u * (ANODE_Y1 - ANODE_Y0);
    // pitted, and eaten worst near the bottom, which has spent the longest in
    // the hottest, most aggressive water
    const pit = 0.5 + 0.5 * Math.sin(u * 37 + 1.3) * Math.sin(u * 13 + 0.4);
    const rr = ANODE_R * (0.42 + 0.34 * pit) * (0.62 + 0.38 * u);
    spentPts.push([Math.max(0.008, rr), y]);
  }
  spentPts.push([ANODE_R * 0.92, ANODE_Y1]);
  const anodeSpent = shellArc(spentPts, anodeSpentMat, 0, TAU, 26);
  anodeSpent.position.set(ANODE_X, 0, ANODE_Z);
  guts.add(anodeSpent);

  // elements: a copper hairpin screwed straight through the tank wall
  function element(y, mat) {
    const g = new THREE.Group();
    const inward = new THREE.Vector3(-Math.sin(ELEM_AZ), 0, -Math.cos(ELEM_AZ));
    const base = azPoint(ELEM_AZ, TANK_R - 0.01, y);
    // The hairpin folds in the VERTICAL plane - one leg above the other, the
    // way the terminals stack on a real screw-in element. Folded sideways it
    // pointed its two legs straight down the view axis and read as one rod.
    const at = (a, dy) => [base.x + inward.x * a, y + dy, base.z + inward.z * a];
    const off = 0.032;
    g.add(
      tubeAlong(
        [
          at(0.01, off),
          at(0.1, off),
          at(0.2, off * 0.92),
          at(0.25, 0),
          at(0.2, -off * 0.92),
          at(0.1, -off),
          at(0.01, -off),
        ],
        0.02,
        mat,
        { tubularSegments: 90, radialSegments: 12, tension: 0.4 },
      ),
    );
    // screw-in flange + terminal block, outside the tank wall
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.062, 0.062, 0.024, 6), brassMat);
    flange.rotation.z = Math.PI / 2;
    flange.rotation.y = -ELEM_AZ;
    flange.position.copy(azPoint(ELEM_AZ, TANK_R + 0.006, y));
    g.add(flange);
    const term = beveledBox(0.07, 0.05, 0.03, materials.polymer(0x1a1c21), 0.006);
    term.rotation.y = ELEM_AZ;
    term.position.copy(azPoint(ELEM_AZ, TANK_R + 0.032, y));
    g.add(term);
    return g;
  }
  const upperElement = element(ELEM_UP_Y, elemUpMat);
  const lowerElement = element(ELEM_LO_Y, elemLoMat);
  guts.add(upperElement, lowerElement);

  // thermostats: clipped to the OUTSIDE of the tank wall, in a foam pocket
  function thermostat(y, withEco) {
    const g = new THREE.Group();
    g.position.copy(azPoint(STAT_AZ, TANK_R + 0.026, y));
    g.rotation.y = STAT_AZ;
    g.add(beveledBox(0.1, 0.15, 0.045, statMat, 0.008));
    const face = beveledBox(0.07, 0.09, 0.012, statFaceMat, 0.005);
    face.position.set(0, -0.02, 0.028);
    g.add(face);
    const dial = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.01, 16), trimMat);
    dial.rotation.x = Math.PI / 2;
    dial.position.set(0, -0.02, 0.036);
    g.add(dial);
    if (withEco) {
      const eco = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.012, 16), ecoMat);
      eco.rotation.x = Math.PI / 2;
      eco.position.set(0, 0.045, 0.032);
      g.add(eco);
    }
    // the spring clip that holds it flat against the bare steel
    const clip = beveledBox(0.13, 0.02, 0.02, clipMat, 0.005);
    clip.position.set(0, 0.078, 0);
    g.add(clip);
    return g;
  }
  const upperStat = thermostat(STAT_UP_Y, true);
  const lowerStat = thermostat(STAT_LO_Y, false);
  guts.add(upperStat, lowerStat);

  // sediment: the mineral crust that settles over the lower element
  const sedimentGroup = new THREE.Group();
  guts.add(sedimentGroup);
  const crust = new THREE.Mesh(
    new THREE.CylinderGeometry(
      WATER_R * 0.97,
      WATER_R * 0.8,
      0.1,
      40,
      1,
      false,
      KEEP_START,
      KEEP_LEN,
    ),
    sedimentMat,
  );
  crust.position.y = TB - 0.03;
  sedimentGroup.add(crust);
  for (let i = 0; i < 9; i++) {
    const az = -CUT_HALF + ((i + 0.5) / 9) * (CUT_HALF * 2);
    const rr = 0.05 + (((i * 37) % 100) / 100) * 0.2;
    const lump = new THREE.Mesh(new THREE.SphereGeometry(0.026 + (i % 3) * 0.008, 12, 9), sedimentMat);
    lump.scale.y = 0.42;
    lump.position.copy(azPoint(az, rr, TB + 0.016));
    sedimentGroup.add(lump);
  }

  // anode ion stream: what "sacrificial" actually looks like
  const ionGroup = new THREE.Group();
  guts.add(ionGroup);
  const ionGeo = new THREE.SphereGeometry(0.012, 8, 7);
  const ions = [];
  const ION_N = 16;
  for (let i = 0; i < ION_N; i++) {
    const im = materials.glow(0x9fe8ff, 1.4);
    im.transparent = true;
    im.depthWrite = false;
    const dot = new THREE.Mesh(ionGeo, im);
    ionGroup.add(dot);
    const az = -CUT_HALF * 0.8 + ((i % 8) / 7) * CUT_HALF * 1.6;
    ions.push({
      mesh: dot,
      seed: i / ION_N,
      dx: Math.sin(az),
      dz: Math.cos(az),
      y: ANODE_Y0 + 0.15 + (((i * 53) % 100) / 100) * (ANODE_Y1 - ANODE_Y0 - 0.4),
    });
  }

  // ==========================================================================
  //  THE WATER CIRCUIT - one continuous path: in at the top, down the dip
  //  tube, across the floor, up the tank, out the top
  // ==========================================================================
  const circuit = chainPath([
    [
      [DIP_X * 1.35, CAP_TOP + 0.46, 0],
      [DIP_X, CAP_TOP + 0.22, 0],
      [DIP_X, CAP_TOP - 0.06, 0],
    ],
    [
      [DIP_X, CAP_TOP - 0.06, 0],
      [DIP_X, DIP_BOTTOM + 0.02, 0],
    ],
    [
      [DIP_X, DIP_BOTTOM - 0.02, 0],
      [DIP_X - 0.06, TB - 0.06, 0.04],
      [0.1, TB - 0.09, 0.12],
      [0.02, TB + 0.02, 0.21],
    ],
    [
      [0.02, TB + 0.02, 0.21],
      [0.015, 1.4, 0.22],
      [0.02, TT + 0.02, 0.19],
    ],
    [
      [0.02, TT + 0.02, 0.19],
      [HOT_X, CAP_TOP - 0.02, 0.04],
      [HOT_X, CAP_TOP + 0.24, 0],
      [HOT_X * 1.35, CAP_TOP + 0.46, 0],
    ],
  ]);
  const PACKETS = 22;
  const packetGroup = new THREE.Group();
  group.add(packetGroup);
  const packetGeo = new THREE.SphereGeometry(0.022, 10, 8);
  const packets = [];
  for (let i = 0; i < PACKETS; i++) {
    const pm = materials.glow(0x2f7fd6, 1.4);
    pm.transparent = true;
    pm.depthWrite = false;
    const dot = new THREE.Mesh(packetGeo, pm);
    packetGroup.add(dot);
    packets.push({ mesh: dot, seed: i / PACKETS });
  }

  // marker the thermocline callout rides, so the label tracks the boundary
  const thermoMarker = new THREE.Object3D();
  thermoMarker.position.set(0.02, TB, 0.2);
  guts.add(thermoMarker);

  // ==========================================================================
  //  CALLOUTS
  // ==========================================================================
  const labels = calloutSets([
    'exterior',
    'tank',
    'dip',
    'strat',
    'elements',
    'thermostat',
    'anode',
  ]);

  labels.add('exterior', group, 'Cold in', [DIP_X, CAP_TOP + 0.34, 0], 16, 100);
  labels.add('exterior', group, 'Hot out', [HOT_X, CAP_TOP + 0.34, 0], 92, 86);
  labels.add(
    'exterior',
    group,
    'T&P relief valve',
    [Math.sin(TP_AZ) * 0.47, 2.3, Math.cos(TP_AZ) * 0.47],
    34,
    126,
  );
  labels.add(
    'exterior',
    group,
    'Element access panel',
    [Math.sin(PANEL_AZ) * 0.362, 2.02, Math.cos(PANEL_AZ) * 0.362],
    -30,
    100,
  );
  labels.add('exterior', group, 'Drain valve', [0, Y0 + 0.16, 0.46], -34, 92);

  labels.add(
    'tank',
    group,
    'Painted steel jacket',
    [Math.sin(1.4) * JACKET_R, 2.0, Math.cos(1.4) * JACKET_R],
    34,
    96,
  );
  labels.add(
    'tank',
    group,
    'Foam insulation',
    [Math.sin(-CUT_HALF) * 0.332, 1.62, Math.cos(-CUT_HALF) * 0.332],
    26,
    104,
  );
  labels.add(
    'tank',
    group,
    'Glass-lined steel tank',
    [Math.sin(-CUT_HALF) * 0.303, 1.2, Math.cos(-CUT_HALF) * 0.303],
    18,
    112,
  );

  labels.add('dip', dipTube, 'Dip tube', [DIP_X, 1.55, 0], 24, 92);
  labels.add('dip', group, 'Cold dumped at the floor', [0.02, TB - 0.06, 0.1], -28, 108);
  labels.add('dip', group, 'Hot drawn off the top', [0.02, TT - 0.02, 0.19], 46, 104);

  labels.add('strat', thermoMarker, 'Thermocline', [0, 0, 0], 14, 104);
  labels.add('strat', group, 'Hot — 60 °C', [0.04, 2.2, 0.22], 40, 92);
  labels.add('strat', group, 'Cold — 15 °C', [0.04, 0.72, 0.22], -32, 92);

  labels.add('elements', upperElement, 'Upper element — 4,500 W', [-0.14, ELEM_UP_Y, 0.1], 30, 124);
  labels.add('elements', lowerElement, 'Lower element — 4,500 W', [-0.14, ELEM_LO_Y, 0.1], -26, 124);
  labels.add(
    'elements',
    group,
    'Screwed through the wall',
    [Math.sin(ELEM_AZ) * (TANK_R + 0.04), ELEM_UP_Y - 0.34, Math.cos(ELEM_AZ) * (TANK_R + 0.04)],
    -12,
    104,
  );

  labels.add('thermostat', upperStat, 'Upper thermostat', [0, 0.02, 0.05], 34, 108);
  labels.add('thermostat', upperStat, 'ECO — trips at 85 °C', [0, 0.05, 0.05], 8, 116);
  labels.add('thermostat', lowerStat, 'Lower thermostat', [0, 0, 0.05], -26, 108);

  labels.add('anode', group, 'Magnesium anode rod', [ANODE_X, 1.75, ANODE_Z], 32, 108);
  labels.add(
    'anode',
    group,
    'Glass lining',
    [Math.sin(-CUT_HALF) * 0.3, 1.15, Math.cos(-CUT_HALF) * 0.3],
    12,
    100,
  );
  labels.add('anode', group, 'Sediment', [0.06, TB - 0.03, 0.14], -34, 96);

  // ==========================================================================
  //  POSE
  // ==========================================================================
  const state = {
    reveal: 0,
    spin: 0,
    flow: 0,
    thermo: 0,
    upperHeat: 0,
    lowerHeat: 0,
    anodeWear: 0,
    sediment: 0,
    ions: 0,
  };

  const tmpColor = new THREE.Color();
  const coldCopper = new THREE.Color(0x8a5730);
  const hotCopper = new THREE.Color(0xff9d54);

  function paintWater() {
    for (let i = 0; i < SLABS; i++) {
      const h = (i + 0.5) / SLABS;
      // sharp but not stepped: a real thermocline is a few centimetres thick
      const mix = clamp01(win(h, state.thermo - 0.06, state.thermo + 0.06));
      tmpColor.copy(COLD).lerp(HOT, mix);
      slabs[i].color.copy(tmpColor);
      slabs[i].emissive.copy(tmpColor);
    }
    thermoMarker.position.y = TB + clamp01(state.thermo) * (TT - TB);
  }

  function placePackets() {
    const revealed = state.reveal > 0.5;
    for (const { mesh, seed } of packets) {
      const t = (state.flow + seed) % 1;
      const p = circuit.getPointAt(t);
      mesh.position.copy(p);
      // cold on the way down and across the floor, warming as it rises past
      // the elements
      const warm = clamp01(win(t, 0.52, 0.86));
      tmpColor.copy(COLD).lerp(HOT, warm);
      mesh.material.color.copy(tmpColor);
      mesh.material.emissive.copy(tmpColor);
      // sealed: only the packets outside the jacket can honestly be seen
      mesh.visible = revealed || p.y > CAP_TOP + 0.02;
    }
  }

  function placeIons() {
    for (const { mesh, seed, dx, dz, y } of ions) {
      const u = (state.flow * 3 + seed) % 1;
      const d = 0.05 + u * 0.2;
      mesh.position.set(ANODE_X + dx * d, y, ANODE_Z + dz * d);
      mesh.material.opacity = Math.sin(Math.PI * u) * 0.85;
    }
  }

  function apply() {
    group.rotation.y = state.spin;

    const revealed = state.reveal > 0.5;
    shellFull.visible = !revealed;
    shellCut.visible = revealed;
    guts.visible = revealed;

    paintWater();
    placePackets();
    placeIons();

    elemUpMat.emissiveIntensity = state.upperHeat * 3;
    elemUpMat.color.copy(coldCopper).lerp(hotCopper, clamp01(state.upperHeat));
    elemLoMat.emissiveIntensity = state.lowerHeat * 3;
    elemLoMat.color.copy(coldCopper).lerp(hotCopper, clamp01(state.lowerHeat));
    ecoMat.emissiveIntensity = 0.4 + 0.5 * Math.max(state.upperHeat, state.lowerHeat);

    const eaten = state.anodeWear > 0.5;
    anodeFreshGroup.visible = revealed && !eaten;
    anodeSpent.visible = revealed && eaten;
    sedimentGroup.visible = revealed && state.sediment > 0.5;
    ionGroup.visible = revealed && state.ions > 0.5;
  }
  apply();

  return {
    group: root,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
    parts: {
      shell: shellFull,
      section: shellCut,
      guts,
      water: waterGroup,
      dipTube,
      anode: anodeFreshGroup,
      upperElement,
      lowerElement,
      upperStat,
      lowerStat,
      packets: packetGroup,
      ions: ionGroup,
      sediment: sedimentGroup,
    },
  };
}
