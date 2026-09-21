import * as THREE from 'three';
import { materials, disc, rod, studioPlinth, flowField } from '../../framework/parts.js';
import { beveledBox, tubeAlong } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, TAU } from '../../framework/motion.js';

// Five cellular generations on ONE cell site, staged as a product shot: a
// galvanised triangular lattice mast with three sector mounts, a base station
// cabinet at its foot, three handsets on the bench in front of it — and, beside
// the site, the two instruments that make "why it got faster" visible: a
// logarithmic SPECTRUM RAIL carrying the channel block, and an ACCESS PANEL
// showing how that channel gets divided between the three users.
//
// MECHANISM (researched — every number below is from a cited source):
//   2G / GSM (1991). Digital voice. A 200 kHz carrier, GMSK at 1 bit per
//   symbol = 270.833 kbit/s gross, cut into EIGHT TDMA timeslots. A phone owns
//   one slot and is silent for the other seven: about 9.6 kbit/s of user data.
//   [ETSI GSM 05.01; tutorialspoint GSM specification]
//   3G / UMTS-WCDMA (2001). Turns abolished. A 5 MHz carrier — 25x wider —
//   with a 3.84 Mcps chip rate. Every user transmits across the whole channel
//   at the same instant; they are separated by orthogonal variable spreading
//   factor (OVSF) codes plus a PN scrambling code, so multiplying the mush by
//   one code makes that user's bits fall out while everyone else averages to
//   nothing. [electronics-notes WCDMA; ScienceDirect OVSF / channelization]
//   4G / LTE (2009). Turns come back, tiny. OFDMA partitions a 20 MHz channel
//   orthogonally in BOTH time and frequency: a resource block is 12
//   subcarriers of 15 kHz across 0.5 ms, and the scheduler re-deals the tiles
//   every millisecond. Plus 2x2/4x4 MIMO.
//   5G NR (2019). Up to 100 MHz per sub-6 carrier, 400 MHz in mmWave. The big
//   lever is the antenna: a 64T64R massive-MIMO array (4 rows x 16 columns of
//   cross-polarised elements = 64 transceivers) phases its elements into a
//   narrow per-user beam — half the width and +3 dB over 32T32R — so the SAME
//   tile can be handed to several users at once on separate beams. Measured
//   3.4x downlink and 8.9x uplink sector throughput against 8T8R.
//   [Samsung "Massive MIMO for New Radio" white paper; RF Wireless 8T8R vs
//   64T64R]
//   6G (not a product). 3GPP Release 21 targets the initial 6G specifications
//   by end-2028, ASN.1 freeze no earlier than March 2029, commercial service
//   around 2030. Bands under study: upper mid-band 6.4-7.125 GHz, cmWave
//   7-15 GHz, sub-THz 100-300 GHz. Integrated Sensing and Communication is a
//   confirmed Rel-21 theme, and the architecture is AI-native by design.
//   [3GPP "The SA1 road to 6G"; IEEE ComSoc on Rel-20/21]
//
//   THE THROUGH-LINE: none of this made radio faster. Capacity is bandwidth x
//   bits-per-symbol x parallel spatial streams; each generation bought more of
//   one or more of those three, and changed the multiple-access scheme that
//   decides whose turn it is.
//
// STAGING NOTE (disclosed simplification): the site is a SCALE MODEL. The
// mast, the handsets and the two instruments are not to one common scale, and
// the spectrum rail is LOGARITHMIC — one tick is ten times the last — because
// 200 kHz and 400 MHz cannot share a linear axis. Both facts are stated in
// frame. 1G is named in the copy but not modelled.
//
// SCALARS the pose is built from:
//   setGen(i)       0..4 — which generation's hardware is bolted on (2G..6G).
//                   Swaps the hero panel on all three sectors, the remote radio
//                   heads, and the width of the channel block on the rail.
//   setBench(on)    the spectrum rail + channel block
//   setAccess(mode) 'slots' | 'codes' | 'grid' | 'layers' | 'layers6' | false
//   setBlocks(on)   the levers step: all five channel widths stacked at once
//   setConst(level) false hidden, 0..3 a fixed constellation, 'cycle' loops
//   setBeams(mode)  'sector' | 'narrow' | 'sense' | false
//   setPhones(on)   the three handsets and their packet flows
//   setPhase(u)     master 0-1 loop phase. Wraps mod 1: the timeslot pointer
//                   (8 whole steps a lap), the scheduler head (16 columns), the
//                   code read-head (16 chips), packet flows (2 whole laps), the
//                   sensing sweep (one whole sine), the constellation cycle (4)
//                   and the finale's generation cycle (5) ALL complete an
//                   integer count per lap, so frame 0 and frame 1 are identical.
//   setLabels(mode) 'site'|'turns'|'codes'|'grid'|'alphabet'|'beam'|'levers'|
//                   'sense'|'run'|false
//
// PROPORTIONS — the mast is the ruler. Target ratios, held by construction:
//   mast height : base width  = 2.42 : 0.54  (4.5:1 — it must read as a mast,
//   not a pylon) · GSM panel height : mast height = 0.95 : 2.42 (0.39) · AAU
//   height : GSM panel height = 0.52 : 0.95 (0.55 — the 5G box is visibly
//   SHORTER and fatter, which is the real silhouette change) · cabinet height
//   : mast height = 0.82 : 2.42 (0.34).

const PLINTH_H = 0.24;

// --- mast --------------------------------------------------------------------
const MAST_X = 1.65;
const MAST_Z = -0.45;
const MAST_H = 2.42;
const MAST_BAYS = 6;
const BAY_H = MAST_H / MAST_BAYS;
const LEG_R0 = 0.27;
const LEG_R1 = 0.16;
const LEG_RAD = 0.024;
const BRACE_RAD = 0.013;
const LEG_AZ = [Math.PI / 2, Math.PI / 2 + TAU / 3, Math.PI / 2 + (2 * TAU) / 3];
const legRadiusAt = (y) => LEG_R0 + (LEG_R1 - LEG_R0) * clamp01(y / MAST_H);

// --- sectors -----------------------------------------------------------------
const SECTOR_AZ = [0, TAU / 3, (2 * TAU) / 3]; // sector 0 faces +Z — the hero
const MOUNT_Z = 0.32; // stand-off from the mast axis, in sector-local space

// --- cabinet -----------------------------------------------------------------
const CAB_X = 2.52;
const CAB_Z = -0.02;
const CAB_W = 0.58;
const CAB_H = 0.82;
const CAB_D = 0.46;

// --- handsets ----------------------------------------------------------------
const PHONE_X = [0.15, 0.95, 1.75];
const PHONE_Z = 1.08;
const PHONE_H = 0.33;
const PHONE_TILT = -0.26;

// --- spectrum rail (LOGARITHMIC: one decade per DEC units) --------------------
const BX0 = -2.2; // 100 kHz
const DEC = 0.6; // x per decade
const BENCH_Z = -1.18;
const RAIL_TOP = 0.05;
const BLOCK_H = 0.17;
const BLOCK_D = 0.3;
const decadesTo = (hz) => DEC * Math.log10(hz / 1e5);
// channel width per generation, in rail units
const GEN_W = [decadesTo(2e5), decadesTo(5e6), decadesTo(2e7), decadesTo(1e8), decadesTo(1e9)];
const MMW_W = decadesTo(4e8); // 5G mmWave carrier — the pale extension block

// --- access panel -------------------------------------------------------------
const AP_X = -0.72;
const AP_Y = 1.02;
const AP_Z = BENCH_Z - 0.08;
const AP_W = 1.76;
const AP_H = 0.86;
const IN_W = 1.6; // usable inner area
const IN_H = 0.7;
const COLS = 16; // time
const ROWS = 12; // frequency
const TILE_W = IN_W / COLS;
const TILE_H = IN_H / ROWS;
const SLOTS = 8;
const CHIPS = 16;
const FACE_Z = 0.026;

// --- constellation ------------------------------------------------------------
const CN_X = 0.98;
const CN_Y = 0.62;
const CN_Z = BENCH_Z + 0.04;
const CN_S = 0.46; // side of the point field
const CN_MAX = 256;
const QAM_NAME = [
  'QPSK · 2 bits',
  '16-QAM · 4 bits',
  '64-QAM · 6 bits',
  '256-QAM · 8 bits',
];

// --- colour -------------------------------------------------------------------
const ACCENT = 0x57d0ff;
const USER = [0x57d0ff, 0xffb347, 0xc58bff];
const GEN_TINT = [0x5c6672, 0x4d97b4, 0x4fb8dc, 0x57d0ff, 0xb6ecff];
const GEN_NAME = [
  '2G · 200 kHz · 8 turns',
  '3G · 5 MHz · codes',
  '4G · 20 MHz · tiles',
  '5G · 100 MHz · 64 beams',
  '6G · in study · it senses too',
];

// Straight strut between two points — the lattice primitive.
function strut(a, b, r, mat, seg = 8) {
  const pa = new THREE.Vector3(...a);
  const pb = new THREE.Vector3(...b);
  const dir = new THREE.Vector3().subVectors(pb, pa);
  const len = dir.length();
  const m = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, seg), mat);
  m.position.copy(pa).addScaledVector(dir, 0.5);
  m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize());
  m.castShadow = true;
  return m;
}

// A flat emissive quad — every readout on the two instruments is one of these.
function quad(w, h, color, opacity = 1) {
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false, // a faded readout must never punch a hole through glass
    side: THREE.DoubleSide,
  });
  return new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
}

// Cone with its APEX at the origin, opening toward +Z — so lookAt(worldTarget)
// aims the beam (Object3D.lookAt points local +Z at the target for meshes).
function beamCone(halfAngleDeg, length, color, opacity) {
  const r = Math.tan((halfAngleDeg * Math.PI) / 180) * length;
  const geo = new THREE.ConeGeometry(r, length, 28, 1, true);
  geo.rotateX(-Math.PI / 2);
  geo.translate(0, 0, length / 2);
  const mat = new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    depthWrite: false,
    side: THREE.DoubleSide,
    blending: THREE.AdditiveBlending,
  });
  return new THREE.Mesh(geo, mat);
}

export function buildNetwork({ scene }) {
  const sceneGroup = new THREE.Group();
  scene.add(sceneGroup);
  // Darker than the stock charcoal: this plinth is unusually broad (the site
  // AND two instruments stand on it), so its lit top face fills the hero's text
  // column and drags white copy down to near-background contrast.
  sceneGroup.add(studioPlinth({ w: 6.0, h: PLINTH_H, d: 3.8, color: 0x131519 }));

  // Everything below is authored with y=0 at the plinth's top face.
  const rig = new THREE.Group();
  rig.position.y = PLINTH_H;
  sceneGroup.add(rig);
  // world-space helper: lookAt() wants world coordinates, the rest is rig-local
  const world = (x, y, z) => new THREE.Vector3(x, y + PLINTH_H, z);

  const labels = calloutSets([
    'site',
    'turns',
    'codes',
    'grid',
    'alphabet',
    'beam',
    'levers',
    'sense',
    'run',
  ]);

  // ==========================================================================
  //  MATERIALS
  //  Every steel/aluminium preset carries a roughnessMap that MULTIPLIES base
  //  roughness (map texels ~0.5), so bases sit high on purpose — a 0.3 base
  //  renders near-chrome and clips to white on anything large and flat.
  // ==========================================================================
  const galv = materials.grimyAluminum(0x9aa2ab);
  galv.roughness = 0.95;
  const galvDark = materials.grimyAluminum(0x7d848d);
  galvDark.roughness = 1.0;
  const radomeWhite = materials.polymer(0xd7d9d3);
  const radomeGrey = materials.polymer(0xb7babb);
  const aauShell = materials.polymer(0x4a4f57);
  const aauFin = materials.aluminum(0x8d949c);
  aauFin.roughness = 0.9;
  const patchMat = materials.paintedMetal(0x2a5f77);
  patchMat.roughness = 0.6;
  const cabMat = materials.paintedMetal(0x767c85);
  cabMat.clearcoat = 0.4;
  cabMat.clearcoatRoughness = 0.42;
  const louvreMat = materials.polymer(0x51575f);
  louvreMat.roughness = 0.84;
  const benchMat = materials.brushedSteel(0xa8afb8);
  benchMat.roughness = 1.0;
  const tickMat = materials.brushedSteel(0xd2d8de);
  tickMat.roughness = 0.75;
  const plateMat = materials.polymer(0x14171c);
  plateMat.roughness = 0.88;
  const phoneMat = materials.polymer(0x101318);
  const conduitMat = materials.polymer(0x1a1d22);

  // ==========================================================================
  //  MAST — triangular galvanised lattice, 6 braced bays, tapering 0.54 -> 0.32
  // ==========================================================================
  const mast = new THREE.Group();
  mast.position.set(MAST_X, 0, MAST_Z);
  rig.add(mast);

  const legPt = (i, y) => {
    const r = legRadiusAt(y);
    return [Math.cos(LEG_AZ[i]) * r, y, Math.sin(LEG_AZ[i]) * r];
  };

  for (let b = 0; b < MAST_BAYS; b++) {
    const y0 = b * BAY_H;
    const y1 = (b + 1) * BAY_H;
    for (let i = 0; i < 3; i++) {
      mast.add(strut(legPt(i, y0), legPt(i, y1), LEG_RAD, galv, 10));
      const j = (i + 1) % 3;
      // horizontal at the bay top, plus a diagonal that alternates direction
      // bay to bay so the bracing reads as a real zigzag, not a row of Ns
      mast.add(strut(legPt(i, y1), legPt(j, y1), BRACE_RAD, galvDark, 6));
      if (b % 2 === 0) mast.add(strut(legPt(i, y0), legPt(j, y1), BRACE_RAD, galvDark, 6));
      else mast.add(strut(legPt(j, y0), legPt(i, y1), BRACE_RAD, galvDark, 6));
    }
  }
  // base feet + ground horizontals
  for (let i = 0; i < 3; i++) {
    const j = (i + 1) % 3;
    mast.add(strut(legPt(i, 0), legPt(j, 0), BRACE_RAD, galvDark, 6));
    const foot = disc(0.075, 0.03, galvDark, 20);
    const p = legPt(i, 0);
    foot.position.set(p[0], 0.015, p[2]);
    mast.add(foot);
  }
  // head platform + lightning finial
  const headDeck = disc(LEG_R1 + 0.05, 0.016, galvDark, 3);
  headDeck.position.y = MAST_H + 0.01;
  headDeck.rotation.y = Math.PI / 6;
  mast.add(headDeck);
  const finial = rod(0.011, 0.3, galv, 10);
  finial.position.y = MAST_H;
  mast.add(finial);

  // feeder bundle: cabinet -> up the front leg -> the head
  const conduit = tubeAlong(
    [
      [CAB_X - MAST_X, 0.06, CAB_Z - MAST_Z],
      [0.09, 0.1, legRadiusAt(0) + 0.045],
      [0.05, 0.9, legRadiusAt(0.9) + 0.038],
      [0.04, 1.9, legRadiusAt(1.9) + 0.038],
      [0.02, MAST_H - 0.14, legRadiusAt(MAST_H) + 0.032],
    ],
    0.023,
    conduitMat,
    { tubularSegments: 64, radialSegments: 10 },
  );
  mast.add(conduit);

  // ==========================================================================
  //  SECTOR PANELS — five generations of hardware, one visible at a time.
  //  Built per sector so the whole site changes era together.
  // ==========================================================================
  function mountPole(yBottom, yTop) {
    const g = new THREE.Group();
    const pole = rod(0.019, yTop - yBottom, galv, 10);
    pole.position.set(0, yBottom, MOUNT_Z);
    g.add(pole);
    for (const y of [yBottom + 0.1, yTop - 0.12]) {
      g.add(strut([0, y, legRadiusAt(y)], [0, y, MOUNT_Z], 0.012, galvDark, 6));
    }
    return g;
  }

  // The tall thin radome every 2G/3G/4G sector antenna lives in.
  function panelSlim(mat, w, h, cy, band) {
    const g = new THREE.Group();
    g.add(mountPole(cy - h / 2 - 0.08, cy + h / 2 + 0.08));
    const body = beveledBox(w, h, 0.075, mat, 0.028);
    body.position.set(0, cy, MOUNT_Z + 0.056);
    g.add(body);
    for (const s of [-1, 1]) {
      const cap = beveledBox(w * 0.96, 0.028, 0.082, galvDark, 0.01);
      cap.position.set(0, cy + (s * h) / 2, MOUNT_Z + 0.056);
      g.add(cap);
    }
    // the painted band every vendor puts near the connector end
    const stripe = beveledBox(w * 0.99, 0.022, 0.078, materials.paintedMetal(band), 0.006);
    stripe.position.set(0, cy - h / 2 + 0.11, MOUNT_Z + 0.058);
    g.add(stripe);
    // feeder pigtails out of the bottom
    for (const dx of [-w * 0.2, w * 0.2]) {
      const pig = rod(0.011, 0.13, conduitMat, 8);
      pig.position.set(dx, cy - h / 2 - 0.13, MOUNT_Z + 0.056);
      g.add(pig);
    }
    return g;
  }

  // A grid of nx x ny patch elements — what makes a massive-MIMO array look
  // like a massive-MIMO array.
  function patchGrid(nx, ny, w, h) {
    const pw = (w / nx) * 0.72;
    const ph = (h / ny) * 0.72;
    const im = new THREE.InstancedMesh(
      new THREE.BoxGeometry(pw, ph, 0.012),
      patchMat,
      nx * ny,
    );
    im.frustumCulled = false;
    const m = new THREE.Matrix4();
    let k = 0;
    for (let iy = 0; iy < ny; iy++) {
      for (let ix = 0; ix < nx; ix++) {
        m.makeTranslation(-w / 2 + (ix + 0.5) * (w / nx), -h / 2 + (iy + 0.5) * (h / ny), 0);
        im.setMatrixAt(k++, m);
      }
    }
    im.instanceMatrix.needsUpdate = true;
    return im;
  }

  // An active antenna unit: short, fat, patch-faced, finned at the back.
  function panelArray(nx, ny, w, h, cy, shellMat) {
    const g = new THREE.Group();
    g.add(mountPole(cy - h / 2 - 0.14, cy + h / 2 + 0.16));
    const d = 0.17;
    const body = beveledBox(w, h, d, shellMat, 0.022);
    body.position.set(0, cy, MOUNT_Z + d / 2);
    g.add(body);
    const face = patchGrid(nx, ny, w * 0.86, h * 0.86);
    face.position.set(0, cy, MOUNT_Z + d + 0.006);
    g.add(face);
    const finCount = 9;
    for (let i = 0; i < finCount; i++) {
      const fin = beveledBox(w * 0.9, 0.014, 0.09, aauFin, 0.004);
      fin.position.set(
        0,
        cy - h * 0.42 + (i * (h * 0.84)) / (finCount - 1),
        MOUNT_Z - 0.078,
      );
      g.add(fin);
    }
    return g;
  }

  function buildSectorPanels() {
    return [
      // 2G GSM: the tall thin white panel that went up in the nineties
      panelSlim(radomeWhite, 0.17, 0.95, 1.9, 0x3d4550),
      // 3G: deliberately the SAME silhouette — nothing outside the box changed
      panelSlim(radomeWhite, 0.18, 0.95, 1.9, 0x8a5a24),
      // 4G: wider cross-polarised array, and the radio head moves up the mast
      panelSlim(radomeGrey, 0.29, 0.98, 1.88, 0x2a5f77),
      // 5G: a 16 x 4 = 64-element active antenna unit — short, fat, finned
      panelArray(16, 4, 0.44, 0.52, 2.02, aauShell),
      // 6G: a denser 16 x 16 sensing tile for the upper mid-band
      panelArray(16, 16, 0.36, 0.36, 2.06, materials.polymer(0x33373e)),
    ];
  }

  const sectors = [];
  for (let s = 0; s < 3; s++) {
    const sec = new THREE.Group();
    sec.rotation.y = SECTOR_AZ[s];
    mast.add(sec);
    const variants = buildSectorPanels();
    variants.forEach((v) => {
      v.visible = false;
      sec.add(v);
    });
    // remote radio head, strapped to the mast from 4G onward
    const rru = beveledBox(0.17, 0.27, 0.12, materials.paintedMetal(0x5d636b), 0.016);
    rru.position.set(0, 1.4, legRadiusAt(1.4) + 0.085);
    rru.visible = false;
    sec.add(rru);
    sectors.push({ group: sec, variants, rru });
  }
  const heroSector = sectors[0];

  // ==========================================================================
  //  BASE STATION CABINET
  // ==========================================================================
  const cabinet = new THREE.Group();
  cabinet.position.set(CAB_X, 0, CAB_Z);
  rig.add(cabinet);
  const pad = beveledBox(CAB_W + 0.16, 0.035, CAB_D + 0.16, galvDark, 0.01);
  pad.position.y = 0.017;
  cabinet.add(pad);
  const cabBody = beveledBox(CAB_W, CAB_H, CAB_D, cabMat, 0.022);
  cabBody.position.y = 0.035 + CAB_H / 2;
  cabinet.add(cabBody);
  const cabRoof = beveledBox(CAB_W + 0.06, 0.035, CAB_D + 0.06, cabMat, 0.012);
  cabinet.add(cabRoof);
  cabRoof.position.y = 0.035 + CAB_H + 0.017;
  for (let i = 0; i < 7; i++) {
    const lv = beveledBox(CAB_W * 0.62, 0.011, 0.01, louvreMat, 0.003);
    lv.position.set(0, 0.36 + i * 0.04, CAB_D / 2 + 0.003);
    lv.rotation.x = -0.28;
    cabinet.add(lv);
  }
  const handle = beveledBox(0.02, 0.1, 0.03, galv, 0.006);
  handle.position.set(CAB_W * 0.3, 0.035 + CAB_H * 0.55, CAB_D / 2 + 0.018);
  cabinet.add(handle);

  // ==========================================================================
  //  HANDSETS — three abstract users, each with its own colour
  // ==========================================================================
  const phones = [];
  const phoneGroup = new THREE.Group();
  rig.add(phoneGroup);
  PHONE_X.forEach((px, i) => {
    const g = new THREE.Group();
    g.position.set(px, 0, PHONE_Z);
    g.rotation.y = -0.24 + i * 0.22;
    const puck = disc(0.095, 0.022, galvDark, 28);
    puck.position.y = 0.011;
    g.add(puck);
    const slab = new THREE.Group();
    slab.position.y = 0.022;
    slab.rotation.x = PHONE_TILT;
    const body = beveledBox(0.175, PHONE_H, 0.022, phoneMat, 0.012);
    body.position.y = PHONE_H / 2;
    slab.add(body);
    const screen = quad(0.146, PHONE_H - 0.05, USER[i], 0.5);
    screen.position.set(0, PHONE_H / 2, 0.013);
    slab.add(screen);
    g.add(slab);
    // what the beams aim at: the top of the screen
    const tip = new THREE.Object3D();
    tip.position.set(0, PHONE_H * 0.82, 0.02);
    slab.add(tip);
    phoneGroup.add(g);
    phones.push({ group: g, screen, tip });
  });

  // ==========================================================================
  //  SPECTRUM RAIL — logarithmic, one decade per major tick
  // ==========================================================================
  const bench = new THREE.Group();
  rig.add(bench);
  const rail = beveledBox(3.12, RAIL_TOP, 0.36, benchMat, 0.014);
  rail.position.set(BX0 + 1.46, RAIL_TOP / 2, BENCH_Z);
  bench.add(rail);
  for (let k = 0; k <= 5; k++) {
    const t = beveledBox(0.015, 0.024, 0.36, tickMat, 0.005);
    t.position.set(BX0 + k * DEC, RAIL_TOP + 0.011, BENCH_Z);
    bench.add(t);
    if (k === 5) continue;
    const minorBase = 1e5 * 10 ** k;
    for (let d = 2; d <= 9; d++) {
      const mt = beveledBox(0.007, 0.012, 0.12, galvDark, 0.002);
      mt.position.set(BX0 + decadesTo(minorBase * d), RAIL_TOP + 0.006, BENCH_Z - 0.11);
      bench.add(mt);
    }
  }

  // The channel block: unit geometry whose LEFT edge sits at local x = 0, so a
  // single scale.x carries the whole "how wide is the channel" story.
  function blockMesh(color, opacity, capOpacity) {
    const g = new THREE.Group();
    const bg = new THREE.BoxGeometry(1, BLOCK_H, BLOCK_D);
    bg.translate(0.5, 0, 0);
    const bm = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    g.add(new THREE.Mesh(bg, bm));
    const cg = new THREE.BoxGeometry(1, 0.014, BLOCK_D);
    cg.translate(0.5, BLOCK_H / 2, 0);
    const cm = new THREE.MeshBasicMaterial({
      color,
      transparent: true,
      opacity: capOpacity,
      depthWrite: false,
    });
    g.add(new THREE.Mesh(cg, cm));
    g.userData.mats = [bm, cm];
    return g;
  }

  const channel = blockMesh(ACCENT, 0.2, 0.9);
  channel.position.set(BX0, RAIL_TOP + BLOCK_H / 2, BENCH_Z);
  bench.add(channel);
  const mmwave = blockMesh(0x9ae4ff, 0.11, 0.45);
  mmwave.position.set(BX0 + GEN_W[3], RAIL_TOP + BLOCK_H / 2, BENCH_Z);
  mmwave.scale.x = MMW_W - GEN_W[3];
  bench.add(mmwave);

  // the levers step: all five widths at once, as a staircase
  const stack = new THREE.Group();
  bench.add(stack);
  GEN_W.forEach((w, i) => {
    const b = blockMesh(GEN_TINT[i], 0.42, 1.0);
    b.position.set(BX0, RAIL_TOP + 0.06 + i * 0.115, BENCH_Z);
    b.scale.set(w, 0.4, 0.62);
    stack.add(b);
  });

  // ==========================================================================
  //  ACCESS PANEL — how the channel gets divided between the three users
  // ==========================================================================
  const access = new THREE.Group();
  access.position.set(AP_X, AP_Y, AP_Z);
  rig.add(access);
  access.add(beveledBox(AP_W, AP_H, 0.036, plateMat, 0.016));
  for (const sx of [-1, 1]) {
    const railV = beveledBox(0.026, AP_H + 0.04, 0.05, benchMat, 0.008);
    railV.position.set((sx * (AP_W + 0.026)) / 2, 0, 0);
    access.add(railV);
  }
  for (const sy of [-1, 1]) {
    const railH = beveledBox(AP_W + 0.08, 0.026, 0.05, benchMat, 0.008);
    railH.position.set(0, (sy * (AP_H + 0.026)) / 2, 0);
    access.add(railH);
  }
  // two stand posts down to the bench, parented to the panel so they hide with it
  for (const sx of [-1, 1]) {
    const postLen = AP_Y - AP_H / 2 - RAIL_TOP;
    const post = rod(0.017, postLen, benchMat, 10);
    post.position.set(sx * (AP_W / 2 - 0.14), -AP_H / 2 - postLen, 0.06);
    access.add(post);
  }

  // --- 2G: eight timeslots, exactly one lit -----------------------------------
  const slotGroup = new THREE.Group();
  slotGroup.position.z = FACE_Z;
  access.add(slotGroup);
  const slotH = (IN_H - 0.02 * (SLOTS - 1)) / SLOTS;
  const slotBars = [];
  for (let i = 0; i < SLOTS; i++) {
    const bar = quad(IN_W * 0.95, slotH, 0xffffff, 0.12);
    bar.position.set(0, IN_H / 2 - slotH / 2 - i * (slotH + 0.02), 0);
    slotGroup.add(bar);
    slotBars.push(bar);
  }

  // --- 3G: three code rows running at once, plus their sum --------------------
  const codeGroup = new THREE.Group();
  codeGroup.position.z = FACE_Z;
  access.add(codeGroup);
  const chipGeo = new THREE.BoxGeometry(IN_W / CHIPS - 0.014, 0.05, 0.016);
  const CODE_Y = [0.255, 0.115, -0.025, -0.225];
  // A spreading code is FIXED — it does not change chip to chip. What moves is
  // the read head sweeping all three rows at once.
  const CODE_SIGN = [
    [1, 1, -1, 1, -1, -1, 1, -1, 1, 1, -1, -1, -1, 1, 1, -1],
    [1, -1, -1, -1, 1, 1, 1, -1, -1, 1, -1, 1, 1, -1, 1, 1],
    [1, 1, 1, -1, -1, 1, -1, 1, -1, -1, 1, 1, -1, -1, 1, -1],
  ];
  const codeRows = [];
  for (let r = 0; r < 4; r++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.92,
      depthWrite: false,
    });
    const im = new THREE.InstancedMesh(chipGeo, mat, CHIPS);
    im.frustumCulled = false;
    im.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    const c0 = new THREE.Color(r < 3 ? USER[r] : 0xe6edf5);
    for (let c = 0; c < CHIPS; c++) im.setColorAt(c, c0);
    codeGroup.add(im);
    codeRows.push(im);
  }

  // --- 4G/5G/6G: the time-frequency tile grid, 1 to 4 stacked layers ----------
  const gridLayers = [];
  const tileGeo = new THREE.BoxGeometry(TILE_W * 0.88, TILE_H * 0.8, 0.012);
  for (let L = 0; L < 4; L++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0xffffff,
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    });
    const im = new THREE.InstancedMesh(tileGeo, mat, COLS * ROWS);
    im.frustumCulled = false;
    const m = new THREE.Matrix4();
    const c0 = new THREE.Color(0x222833);
    let k = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        m.makeTranslation(
          -IN_W / 2 + (c + 0.5) * TILE_W,
          -IN_H / 2 + (r + 0.5) * TILE_H,
          FACE_Z + L * 0.075,
        );
        im.setMatrixAt(k, m);
        im.setColorAt(k, c0);
        k++;
      }
    }
    im.instanceMatrix.needsUpdate = true;
    im.instanceColor.needsUpdate = true;
    access.add(im);
    gridLayers.push(im);
  }
  // The NOW marker — a real bar that physically travels across the panel. Every
  // access mode needs a moving referent, and an opacity ramp alone is not one.
  const markerMat = new THREE.MeshBasicMaterial({
    color: 0xf2f7ff,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const markerV = new THREE.Mesh(new THREE.BoxGeometry(0.018, IN_H + 0.05, 0.022), markerMat);
  const markerH = new THREE.Mesh(new THREE.BoxGeometry(IN_W + 0.06, 0.014, 0.022), markerMat);
  markerV.position.z = FACE_Z + 0.3;
  markerH.position.z = FACE_Z + 0.3;
  access.add(markerV, markerH);

  // which user owns tile (col, row): three contiguous frequency chunks that
  // rotate one user per column — what an LTE scheduler's output looks like
  const owner = (c, r) => (c + Math.floor(r / 4)) % 3;

  // ==========================================================================
  //  CONSTELLATION PLATE — the second lever, bits per symbol
  // ==========================================================================
  const constel = new THREE.Group();
  constel.position.set(CN_X, CN_Y, CN_Z);
  rig.add(constel);
  constel.add(beveledBox(0.66, 0.66, 0.03, plateMat, 0.014));
  const cnFrame = beveledBox(0.7, 0.7, 0.018, benchMat, 0.008);
  cnFrame.position.z = -0.014;
  constel.add(cnFrame);
  // stand runs from the bench (rig y = 0.026) up to the plate's bottom edge
  const cnStandLen = CN_Y - 0.026 - 0.33;
  const cnStand = rod(0.02, cnStandLen, benchMat, 10);
  cnStand.position.set(0, -CN_Y + 0.026, 0.02);
  constel.add(cnStand);
  const cnBase = disc(0.13, 0.026, benchMat, 28);
  cnBase.position.set(0, -CN_Y + 0.013, 0.02);
  constel.add(cnBase);
  for (const rot of [0, Math.PI / 2]) {
    const ax = beveledBox(0.56, 0.006, 0.008, galvDark, 0.002);
    ax.rotation.z = rot;
    ax.position.z = 0.018;
    constel.add(ax);
  }

  const cnPoints = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.013, 10, 8),
    new THREE.MeshBasicMaterial({ color: ACCENT }),
    CN_MAX,
  );
  cnPoints.frustumCulled = false;
  cnPoints.position.z = 0.032;
  constel.add(cnPoints);
  const cnNoise = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.0255, 12, 10),
    new THREE.MeshBasicMaterial({
      color: 0xbcd6ea,
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
    }),
    CN_MAX,
  );
  cnNoise.frustumCulled = false;
  cnNoise.position.z = 0.032;
  constel.add(cnNoise);
  // Point layouts are rewritten only when the LEVEL changes, never per frame.
  let cnLevel = -1;
  const _cm = new THREE.Matrix4();
  function layoutConstellation(level) {
    if (level === cnLevel) return;
    cnLevel = level;
    const n = 2 ** (level + 1);
    const step = CN_S / n;
    let k = 0;
    for (let j = 0; j < n; j++) {
      for (let i = 0; i < n; i++) {
        _cm.makeTranslation(-CN_S / 2 + (i + 0.5) * step, -CN_S / 2 + (j + 0.5) * step, 0);
        cnPoints.setMatrixAt(k, _cm);
        cnNoise.setMatrixAt(k, _cm);
        k++;
      }
    }
    _cm.makeScale(0, 0, 0);
    for (; k < CN_MAX; k++) {
      cnPoints.setMatrixAt(k, _cm);
      cnNoise.setMatrixAt(k, _cm);
    }
    cnPoints.instanceMatrix.needsUpdate = true;
    cnNoise.instanceMatrix.needsUpdate = true;
  }
  // Where a point sits for a given level — shared by the layout and the cursor.
  function constPoint(level, k) {
    const n = 2 ** (level + 1);
    const step = CN_S / n;
    const i = k % n;
    const j = Math.floor(k / n) % n;
    return [-CN_S / 2 + (i + 0.5) * step, -CN_S / 2 + (j + 0.5) * step];
  }
  // A cursor hopping point to point: one hop is one symbol, and at 256-QAM that
  // one hop carries eight bits instead of two.
  const cursorMat = new THREE.MeshBasicMaterial({
    color: 0xfff1cf,
    transparent: true,
    opacity: 0.95,
    depthWrite: false,
  });
  const cursor = new THREE.Mesh(new THREE.TorusGeometry(0.042, 0.0075, 8, 36), cursorMat);
  cursor.position.z = 0.046;
  constel.add(cursor);

  layoutConstellation(0);

  // ==========================================================================
  //  BEAMS + PACKET FLOW
  // ==========================================================================
  const beams = new THREE.Group();
  rig.add(beams);
  // apex: the face of the hero sector's panel (rig-local)
  const APEX = new THREE.Vector3(MAST_X, 1.95, MAST_Z + MOUNT_Z + 0.12);

  const sectorBeam = beamCone(20, 2.2, ACCENT, 0.016);
  sectorBeam.position.copy(APEX);
  beams.add(sectorBeam);
  sectorBeam.lookAt(world(1.2, 0.42, PHONE_Z + 0.22));

  const narrowBeams = phones.map((p, i) => {
    const c = beamCone(2.8, 3.0, USER[i], 0.15);
    c.position.copy(APEX);
    beams.add(c);
    return c;
  });

  const senseBeam = beamCone(5.5, 2.6, 0x9ae4ff, 0.14);
  senseBeam.position.copy(APEX);
  beams.add(senseBeam);
  const echoGeo = new THREE.TorusGeometry(0.1, 0.012, 8, 36);
  const echoes = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.MeshBasicMaterial({
      color: 0x9ae4ff,
      transparent: true,
      opacity: 0.8,
      depthWrite: false,
    });
    const e = new THREE.Mesh(echoGeo, m);
    beams.add(e);
    echoes.push({ mesh: e, mat: m });
  }

  // Wavefronts leaving the panel — the site is never not transmitting, and the
  // opening shot needs something that actually moves.
  const SECTOR_AIM = new THREE.Vector3(1.2, 0.42, PHONE_Z + 0.22);
  const SECTOR_DIR = new THREE.Vector3().subVectors(SECTOR_AIM, APEX).normalize();
  const ringGeo = new THREE.TorusGeometry(1, 0.009, 8, 48);
  const rings = [];
  for (let i = 0; i < 5; i++) {
    const m = new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0.4,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
    });
    const mesh = new THREE.Mesh(ringGeo, m);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), SECTOR_DIR);
    beams.add(mesh);
    rings.push({ mesh, mat: m });
  }

  const PKT = 12;
  const flow = flowField(PKT, 0.042, { opacity: 0.95 });
  beams.add(flow.mesh);
  const _fp = new THREE.Vector3();
  const _fq = new THREE.Quaternion();
  const _fc = new THREE.Color();
  const _tipW = new THREE.Vector3();
  const _tipL = new THREE.Vector3();
  const _dir = new THREE.Vector3();
  const _up = new THREE.Vector3(0, 1, 0);
  const _zAxis = new THREE.Vector3(0, 0, 1);
  const _mm = new THREE.Matrix4();
  const _sv = new THREE.Vector3();
  const _senseL = new THREE.Vector3();

  // ==========================================================================
  //  CALLOUTS — anchors are empties parented to the part they name
  // ==========================================================================
  // Callouts are parented to the REAL part group, not to an empty anchor, and
  // carry their offset in that group's local space. player.js subjectRoots()
  // frames a shot by the callout's PARENT bounding box and expandVisible() only
  // grows the box for objects that have geometry — so an empty anchor fits a
  // ZERO-size box and makes `frame:` in video.js unusable (it silently falls
  // back to the whole model). Offsets below are the same numbers the empties
  // held, so on-screen label positions are unchanged.
  const P_HERO = [0, 1.95, MOUNT_Z + 0.12];
  const P_MAST = [0, 1.1, legRadiusAt(1.1)];
  const P_CAB = [0, 0.6, CAB_D / 2];
  const P_RAIL_L = [BX0 + 0.09, RAIL_TOP + 0.12, BENCH_Z];
  const P_RAIL_R = [BX0 + 2.1, RAIL_TOP + 0.16, BENCH_Z];
  const P_STACK = [BX0 + 1.4, RAIL_TOP + 0.33, BENCH_Z];
  const P_AP = [0.34, 0.3, FACE_Z];
  const P_AP_LOW = [0.3, -0.3, FACE_Z];
  const P_CN = [0.14, 0.26, 0.06];
  const P_CN_LOW = [-0.1, -0.26, 0.06];
  const P_PHONE = [0, 0.42, 0];
  const hero = heroSector.group;
  const phone1 = phones[1].group;

  labels.add('site', hero, 'Sector antenna', P_HERO, 34, 78);
  labels.add('site', mast, 'One mast, thirty years', P_MAST, -26, 82);
  labels.add('site', cabinet, 'Base station cabinet', P_CAB, -42, 70);

  labels.add('turns', bench, '200 kHz — the whole channel', P_RAIL_L, 36, 86);
  labels.add('turns', bench, 'One tick = ten times', P_RAIL_R, 38, 74);
  labels.add('turns', access, 'Eight turns · one talker', P_AP, 28, 78);

  labels.add('codes', bench, '5 MHz — 25× wider', P_RAIL_L, 34, 90);
  labels.add('codes', access, 'All three, all the time', P_AP, 32, 74);
  labels.add('codes', access, 'On the air: one hash', P_AP_LOW, -34, 74);

  labels.add('grid', bench, '20 MHz, diced into tiles', P_RAIL_L, 36, 86);
  labels.add('grid', access, 'A fresh deal every ms', P_AP, 30, 80);
  labels.add('grid', access, '12 subcarriers × 0.5 ms', P_AP_LOW, -32, 70);

  // lQam's text is REWRITTEN every frame (QPSK -> 16-QAM -> ...), so it can
  // never be named in video.js `labels`/`frame` — those match live textContent.
  const lQam = labels.add('alphabet', constel, 'QPSK · 2 bits', P_CN, 44, 78);
  labels.add('alphabet', constel, 'Noise never shrinks', P_CN_LOW, -70, 72);

  labels.add('beam', hero, '64 elements: 16 × 4', P_HERO, 38, 80);
  labels.add('beam', phone1, 'A beam each', P_PHONE, 54, 76);
  labels.add('beam', bench, '100 MHz · 400 in mmWave', P_RAIL_L, 34, 90);

  labels.add('levers', stack, 'Lever 1 — how wide', P_STACK, 48, 74);
  labels.add('levers', constel, 'Lever 2 — how dense', P_CN, 40, 72);
  labels.add('levers', hero, 'Lever 3 — how many', P_HERO, 32, 84);

  labels.add('sense', hero, '256 elements · it listens', P_HERO, 36, 82);
  labels.add('sense', bench, 'Up to 1 GHz of channel', P_RAIL_R, 42, 72);

  // Same live-text trap as lQam: the finale's pill names the current generation.
  const lRun = labels.add('run', hero, GEN_NAME[0], P_HERO, 34, 80);

  // ==========================================================================
  //  POSE — ONE state object, applied by ONE function.
  // ==========================================================================
  const S = {
    gen: 0,
    bench: true,
    accessMode: false,
    blocks: false,
    constMode: false, // false hidden, 0..3 a fixed level, 'cycle' loops the lap
    beamMode: false,
    phones: true,
    u: 0,
  };

  function pose() {
    const u = S.u - Math.floor(S.u);
    const g = Math.max(0, Math.min(4, Math.round(S.gen)));

    // --- which era is bolted to the mast -------------------------------------
    for (const sec of sectors) {
      sec.variants.forEach((v, i) => (v.visible = i === g));
      sec.rru.visible = g >= 2;
    }
    channel.scale.x = GEN_W[g];
    for (const m of channel.userData.mats) m.color.setHex(g === 4 ? 0x9ae4ff : ACCENT);
    lRun.setText(GEN_NAME[g]);

    bench.visible = S.bench;
    channel.visible = !S.blocks;
    mmwave.visible = !S.blocks && g === 3;
    stack.visible = S.blocks;
    phoneGroup.visible = S.phones;
    constel.visible = S.constMode !== false;

    // --- access panel ---------------------------------------------------------
    const mode = S.accessMode;
    access.visible = mode !== false;
    slotGroup.visible = mode === 'slots';
    codeGroup.visible = mode === 'codes';
    const layerCount = mode === 'grid' ? 1 : mode === 'layers' ? 3 : mode === 'layers6' ? 4 : 0;
    gridLayers.forEach((l, i) => (l.visible = i < layerCount));
    markerH.visible = mode === 'slots';
    markerV.visible = mode === 'codes' || layerCount > 0;
    markerV.position.z = FACE_Z + 0.04 + Math.max(0, layerCount - 1) * 0.075;

    if (mode === 'slots') {
      // exactly one of eight lit — 8 whole steps a lap, so it wraps clean
      const active = Math.floor(u * SLOTS) % SLOTS;
      markerH.position.y = IN_H / 2 - slotH / 2 - active * (slotH + 0.02);
      slotBars.forEach((bar, i) => {
        const on = i === active;
        bar.material.color.setHex(on ? USER[i % 3] : 0x737f90);
        bar.material.opacity = on ? 0.94 : 0.26;
      });
    }

    if (mode === 'codes') {
      // one read head sweeps all three code rows AT ONCE — that simultaneity is
      // the whole difference from 2G — and the bottom row is their sum
      const head = u * CHIPS;
      markerV.position.x = -IN_W / 2 + (head / CHIPS) * IN_W;
      for (let r = 0; r < 4; r++) {
        const im = codeRows[r];
        for (let c = 0; c < CHIPS; c++) {
          const x = -IN_W / 2 + (c + 0.5) * (IN_W / CHIPS);
          const y =
            r < 3
              ? CODE_Y[r] + CODE_SIGN[r][c] * 0.032
              : CODE_Y[3] + (CODE_SIGN[0][c] + CODE_SIGN[1][c] + CODE_SIGN[2][c]) * 0.026;
          const raw = Math.abs(c + 0.5 - head);
          const d = Math.min(raw, CHIPS - raw); // wrapped distance — no reset flash
          const lit = Math.max(0.3, 1.3 - d * 0.55);
          _mm.makeTranslation(x, y, 0);
          _mm.scale(_sv.set(1, 0.9 + lit * 0.3, 1));
          im.setMatrixAt(c, _mm);
          im.setColorAt(c, _fc.setHex(r < 3 ? USER[r] : 0xe6edf5).multiplyScalar(lit));
        }
        im.instanceMatrix.needsUpdate = true;
        im.instanceColor.needsUpdate = true;
      }
    }

    if (layerCount > 0) {
      // the scheduler head sweeps 16 whole columns a lap; tiles behind it fade
      // over five columns, and the wrap is modular, so there is no reset flash
      const head = Math.floor(u * COLS) % COLS;
      markerV.position.x = -IN_W / 2 + (head + 0.5) * TILE_W;
      for (let L = 0; L < layerCount; L++) {
        const im = gridLayers[L];
        let k = 0;
        for (let r = 0; r < ROWS; r++) {
          for (let c = 0; c < COLS; c++) {
            const age = (head - c + COLS) % COLS;
            const bright = age < 5 ? 1 - age * 0.17 : 0.1;
            // ONE layer = one grid split three ways (4G). SEVERAL layers = the
            // same tile map handed out once per beam (5G and 6G).
            const o = layerCount === 1 ? owner(c, r) : L % 3;
            im.setColorAt(k, _fc.setHex(USER[o]).multiplyScalar(bright));
            k++;
          }
        }
        im.instanceColor.needsUpdate = true;
        im.material.opacity = layerCount === 1 ? 0.88 : 0.42;
      }
    }

    // --- constellation --------------------------------------------------------
    if (S.constMode !== false) {
      const level = S.constMode === 'cycle' ? Math.floor(u * 4) % 4 : S.constMode;
      layoutConstellation(level);
      lQam.setText(QAM_NAME[level]);
      // 16 whole hops a lap — one hop is one symbol, so a denser grid is the
      // same number of hops carrying four times the bits
      const n = 2 ** (level + 1);
      const [cx, cy] = constPoint(level, (Math.floor(u * 16) % 16) % (n * n));
      cursor.position.set(cx, cy, 0.046);
    }

    // --- beams ----------------------------------------------------------------
    const bm = S.beamMode;
    beams.visible = bm !== false;
    sectorBeam.visible = bm === 'sector';
    narrowBeams.forEach((c) => (c.visible = bm === 'narrow'));
    senseBeam.visible = bm === 'sense';
    echoes.forEach((e) => (e.mesh.visible = bm === 'sense'));

    rings.forEach((r, i) => {
      r.mesh.visible = bm === 'sector';
      if (bm !== 'sector') return;
      // 3 whole wavefronts a lap, with an envelope that is zero at both ends
      const t = (u * 3 + i / 5) % 1;
      r.mesh.position.copy(APEX).addScaledVector(SECTOR_DIR, t * 1.95);
      // radius tracks the cone's own half-angle, so the wavefront stays INSIDE
      // the beam instead of reading as a hoop hung in mid-air
      r.mesh.scale.setScalar(0.04 + t * 0.72);
      r.mat.opacity = 0.13 * (1 - t) * Math.min(1, t * 5);
    });

    if (bm === 'narrow') {
      phones.forEach((p, i) => {
        p.tip.getWorldPosition(_tipW);
        narrowBeams[i].lookAt(_tipW);
        _tipL.copy(_tipW);
        rig.worldToLocal(_tipL);
        narrowBeams[i].scale.z = _tipL.distanceTo(APEX) / 3.0;
        // breathes very slightly, so it reads as actively tracking
        narrowBeams[i].material.opacity = 0.15 + 0.07 * Math.sin(TAU * (u + i * 0.29));
      });
    }

    if (bm === 'sense') {
      const sweep = Math.sin(TAU * u) * 0.62; // one whole sine a lap
      _senseL.set(0.95 + Math.sin(sweep) * 1.1, 0.26, PHONE_Z + 0.2);
      senseBeam.lookAt(world(_senseL.x, _senseL.y, _senseL.z));
      _dir.copy(_senseL).sub(APEX);
      const dist = _dir.length();
      senseBeam.scale.z = dist / 2.6;
      _dir.normalize();
      echoes.forEach((e, i) => {
        // echoes run BACK up the beam — the network listening to itself
        const t = 1 - ((u * 3 + i / 3) % 1);
        e.mesh.position.copy(APEX).addScaledVector(_dir, t * dist);
        e.mesh.quaternion.setFromUnitVectors(_zAxis, _dir);
        e.mesh.scale.setScalar(0.4 + t * 1.6);
        e.mat.opacity = 0.75 * (1 - t) * Math.min(1, t * 6);
      });
    }

    // --- packets along whichever beam is live ---------------------------------
    const flowOn = S.phones && bm === 'narrow';
    for (let i = 0; i < PKT; i++) {
      const lane = i % 3;
      const k = Math.floor(i / 3);

      if (!flowOn) {
        _mm.makeScale(0, 0, 0);
        flow.mesh.setMatrixAt(i, _mm);
        continue;
      }
      phones[lane].tip.getWorldPosition(_tipW);
      _tipL.copy(_tipW);
      rig.worldToLocal(_tipL);
      // 2 whole laps per phase lap — integer, so the stream wraps seamlessly
      const t = (u * 2 + k / 4 + lane * 0.11) % 1;
      _fp.copy(APEX).lerp(_tipL, t);
      _fq.setFromUnitVectors(_up, _dir.copy(_tipL).sub(APEX).normalize());
      flow.set(i, _fp, _fq, 1, _fc.setHex(USER[lane]));
    }
    flow.commit();

    // handset screens brighten when that user is the one being served
    if (S.phones) {
      phones.forEach((p, i) => {
        let lit = 0.45 + 0.25 * Math.sin(TAU * (u + i * 0.29));
        if (mode === 'slots') lit = Math.floor(u * SLOTS) % 3 === i ? 0.95 : 0.16;
        else if (mode === 'codes' || layerCount > 1) lit = 0.9;
        else if (layerCount === 1) lit = 0.5 + 0.4 * Math.sin(TAU * (u + i * 0.29));
        p.screen.material.opacity = lit;
      });
    }
  }

  // ==========================================================================
  //  HANDLES
  // ==========================================================================
  const handles = {
    group: sceneGroup,
    setGen(i) {
      S.gen = i;
      pose();
    },
    setBench(on) {
      S.bench = !!on;
      pose();
    },
    setAccess(mode) {
      S.accessMode = mode ?? false;
      pose();
    },
    setBlocks(on) {
      S.blocks = !!on;
      pose();
    },
    setConst(level) {
      S.constMode = level === undefined || level === null ? false : level;
      pose();
    },
    setBeams(mode) {
      S.beamMode = mode ?? false;
      pose();
    },
    setPhones(on) {
      S.phones = !!on;
      pose();
    },
    setPhase(u) {
      S.u = u;
      pose();
    },
    setLabels: labels.setLabels,
    parts: {
      mast,
      heroSector: heroSector.group,
      heroPanels: heroSector.variants,
      cabinet,
      channel,
      stack,
      access,
      constel,
      beams,
      rings: rings.map((r) => r.mesh),
      marker: markerV,
      cursor,
      phones: phoneGroup,
    },
  };

  sceneGroup.updateMatrixWorld(true);
  pose();
  return handles;
}
