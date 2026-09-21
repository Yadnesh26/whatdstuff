import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { studioPlinth } from '../../framework/parts.js';
import { coil } from '../../framework/geometry.js';
import { clamp01 } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A five-pin deadbolt cylinder, product-shot staged and cut away at x = 0.
//
// SCALE: 1 world unit = 0.5 inch. Every constant below is a real locksmith
// dimension run through that one factor, so the ratios hold by construction:
//   plug           Ø0.500"  → 1.00u      (industry standard)
//   shell body     Ø1.150"  → 2.30u
//   pins           Ø0.115"  → 0.23u
//   chamber pitch   0.150"  → 0.30u      (5 chambers span 1.20u)
//   driver pins     0.190"  → 0.38u      (all identical)
//   key pins        0.170"–0.290" → 0.34–0.58u  (real range .165"–.320")
//   bolt throw      1.000"  → 2.00u      (180° of plug rotation)
//
// TWO deliberate exaggerations, both disclosed in the step copy:
//   · the shear line is a 0.004" running clearance — invisible at any honest
//     scale, so it is DRAWN as an accent line rather than modelled.
//   · the plug's creep under a tension wrench is thousandths of an inch; the
//     picking step rotates it ~5° so the ledge is legible at macro distance.
//
// ONE pose function, `set()`, drives everything from ONE state object.

const PLINTH_H = 0.3;

// ─── cylinder ────────────────────────────────────────────────────────────────
const PLUG_R = 0.5;
const BORE_GAP = 0.02; // drawn shear clearance (the real one is 1/8 of this)
const PLUG_Z0 = -1.1;
const PLUG_Z1 = 1.1;
const PLUG_LEN = PLUG_Z1 - PLUG_Z0;

const SHELL_R = 1.15;
const SHELL_Z0 = -1.3;
const SHELL_Z1 = 1.1;
const SHELL_LEN = SHELL_Z1 - SHELL_Z0;

const BIBLE_HW = 0.45; // half-width of the raised chamber housing
const BIBLE_OUT = 1.7; // outer top of the bible
const BIBLE_IN = 1.52; // chamber ceiling — the springs press against this
const BIBLE_ANG = Math.acos(BIBLE_HW / SHELL_R);

const ROSE_R = 1.42;
const ROSE_T = 0.16;

// ─── chambers, pins, key ─────────────────────────────────────────────────────
const CHAMBER_Z = [0.52, 0.22, -0.08, -0.38, -0.68]; // 0 = nearest the face
const PIN_R = 0.115;
const DRIVER_L = 0.38;

const SHEAR_Y = PLUG_R; // the top of the plug IS the shear line
const KEY_FLOOR = -0.42; // bottom of the keyway — where a key pin rests, keyless
const GAP = SHEAR_Y - KEY_FLOOR; // 0.92 — floor-to-shear distance

// The bitting of the correct key, expressed as the lift each cut gives its pin.
const LIFTS = [0.58, 0.4, 0.52, 0.34, 0.46];
// ...so each key pin is exactly long enough that lift + length = GAP.
const KEY_PIN_L = LIFTS.map((l) => GAP - l);

// A key that fits the keyway but not the lock: chamber 2 left short, chamber 4
// pushed past the shear line. Three chambers are perfect — and it still fails.
const WRONG_LIFTS = [0.58, 0.22, 0.52, 0.58, 0.46];

const BLADE_H = 0.64; // uncut blade height above the blade's bottom edge
const BLADE_LEN = PLUG_LEN; // 2.20 — the shoulder stops on the plug face
const CUT_U = CHAMBER_Z.map((z) => z - PLUG_Z0); // [1.7,1.4,1.1,0.8,0.5] from the tip
const TIP_H = 0.16;

// The cut-away is a WINDOW milled out of the middle of the cylinder, not a
// half-section: intact metal survives at both ends, so the thing still reads as
// a machined cylinder instead of a flat plate with pins drawn on it.
const WIN_Z0 = -0.95;
const WIN_Z1 = 0.92;

const SPRING_FREE = 1.22;
const SPRING_MIN = 0.3; // coil-bound length — the morph target's pose

// ─── case, cam, bolt ─────────────────────────────────────────────────────────
const CRANK_R = 1.0; // slider-crank: 180° of plug = 2·CRANK_R of bolt travel
// The case is offset AWAY from the bolt side: its bolt wall sits almost on the
// cylinder's axis, so the thrown bolt stands in open air instead of being
// swallowed by the case from every camera that can see into the cut-away.
const CASE_X0 = -1.9;
const CASE_X1 = 0.9;
const CASE_W = CASE_X1 - CASE_X0;
const CASE_XC = (CASE_X0 + CASE_X1) / 2;
// The bolt rides BELOW the hub — which is how a real deadbolt is packaged (the
// tailpiece turns a hub, a tall fork on the bolt's tail catches its crank pin)
// and which also lifts the bolt clear of the cylinder's silhouette, so the
// throw is visible from the same cameras that see into the cut-away.
const CASE_Y0 = -1.74;
const CASE_Y1 = 1.3;
const CASE_H = CASE_Y1 - CASE_Y0;
const CASE_YC = (CASE_Y0 + CASE_Y1) / 2;
const CASE_Z0 = -3.1; // back
const CASE_Z1 = -1.3; // front (abuts the cylinder)
const CASE_ZC = (CASE_Z0 + CASE_Z1) / 2;
const CASE_D = CASE_Z1 - CASE_Z0;
const WALL = 0.2;
// The bolt rides at the FRONT of the case and the hub sits behind it, so a
// front-quarter camera on the cut-away side still sees the thrown bolt clear of
// the case; with the bolt buried mid-case, the case occludes it from every
// angle that can also see into the window.
const FORK_Z = -1.78; // cam pin + bolt fork share this plane
const BOLT_Z = -2.08; // clear of the case's front wall at every position
// long enough to stay guided when thrown, short enough that its tail never
// pushes out through the back of the case when retracted
const BOLT_L = 2.9;
const BOLT_H = 1.45;
const BOLT_Y = -0.78; // below the plug axis
const BOLT_D = 1.05;
const BOLT_X_THROWN = 2.15; // bolt centre when thrown (tip 2.0u proud, +X)

const ACCENT = 0x7ee0ff;

const lerp = (a, b, t) => a + (b - a) * t;

// ─── materials ───────────────────────────────────────────────────────────────
// Map-free on purpose: most of this model is ExtrudeGeometry (ad-hoc UVs), so a
// roughnessMap would sample garbage texels.
const brass = (color = 0xc9a227, roughness = 0.3) =>
  new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness });
const nickel = () =>
  new THREE.MeshPhysicalMaterial({ color: 0xcdd3da, metalness: 1, roughness: 0.22 });
const springSteel = () =>
  new THREE.MeshPhysicalMaterial({ color: 0x9aa2ad, metalness: 1, roughness: 0.34 });
const toolSteel = () =>
  new THREE.MeshPhysicalMaterial({ color: 0x8d949c, metalness: 1, roughness: 0.26 });
const darkLiner = () =>
  new THREE.MeshStandardMaterial({
    color: 0x131519,
    metalness: 0.2,
    roughness: 0.95,
    side: THREE.BackSide,
  });
const accentMat = () =>
  new THREE.MeshStandardMaterial({
    color: ACCENT,
    emissive: ACCENT,
    emissiveIntensity: 2.4,
    roughness: 0.4,
  });

// ─── geometry helpers ────────────────────────────────────────────────────────

// Open tube whose inner far wall is what you see from −X: reads as a drilled
// bore in a cut face, with no CSG.
function boreTube(radius, height, mat) {
  return new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, height, 20, 1, true),
    mat,
  );
}

function pin(length, mat) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(PIN_R, PIN_R, length, 20),
    mat,
  );
  mesh.castShadow = true;
  for (const s of [1, -1]) {
    const cap = new THREE.Mesh(new THREE.SphereGeometry(PIN_R, 20, 10), mat);
    cap.position.y = (s * length) / 2;
    cap.scale.y = 0.5;
    mesh.add(cap);
  }
  return mesh;
}

// The cut-away shell: an annular SECTOR, not a half. A 120° wedge is taken out
// of the upper RIGHT — the same side the bolt throws to — so one camera sees
// the pin stacks AND the bolt. (Cut the other side and the cylinder itself
// stands between every camera that can see the pins and the bolt behind it.)
// The surviving rim keeps the silhouette round; a flat half-cut reads as a wall.
const CUT_A0 = Math.PI / 2; // 90°, the vertical cut face at the bible
const CUT_A1 = (Math.PI * 11) / 6; // 330°, where the wedge ends

function sectorShape(rOuter, rInner) {
  const s = new THREE.Shape();
  s.moveTo(rOuter * Math.cos(CUT_A0), rOuter * Math.sin(CUT_A0));
  s.absarc(0, 0, rOuter, CUT_A0, CUT_A1, false);
  s.lineTo(rInner * Math.cos(CUT_A1), rInner * Math.sin(CUT_A1));
  s.absarc(0, 0, rInner, CUT_A1, CUT_A0, true);
  s.lineTo(rOuter * Math.cos(CUT_A0), rOuter * Math.sin(CUT_A0));
  return s;
}

function shellWindowGeometry() {
  const geo = new THREE.ExtrudeGeometry(sectorShape(SHELL_R, PLUG_R + BORE_GAP), {
    depth: WIN_Z1 - WIN_Z0,
    bevelEnabled: false,
    curveSegments: 40,
  });
  geo.translate(0, 0, WIN_Z0);
  return geo;
}

// The cut-away half of the plug, keyway notched out of the cut face.
function plugHalfGeometry() {
  const s = new THREE.Shape();
  s.moveTo(0, PLUG_R);
  s.absarc(0, 0, PLUG_R, Math.PI / 2, (Math.PI * 3) / 2, false);
  s.lineTo(0, KEY_FLOOR);
  s.lineTo(-0.085, KEY_FLOOR);
  s.lineTo(-0.085, KEY_FLOOR + BLADE_H);
  s.lineTo(0, KEY_FLOOR + BLADE_H);
  s.lineTo(0, PLUG_R);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: WIN_Z1 - WIN_Z0,
    bevelEnabled: false,
    curveSegments: 32,
  });
  geo.translate(0, 0, WIN_Z0);
  return geo;
}

// A length of intact plug — a disc with the warded keyway as a REAL void, so
// the key slides through a hole rather than into a painted-on slot.
function keywayPath() {
  const k = new THREE.Path();
  const hw = 0.088; // half the blade thickness + clearance
  const w = 0.145; // ward pockets
  const top = KEY_FLOOR + BLADE_H + 0.03;
  k.moveTo(-hw, KEY_FLOOR);
  k.lineTo(hw, KEY_FLOOR);
  k.lineTo(hw, KEY_FLOOR + 0.16);
  k.lineTo(w, KEY_FLOOR + 0.16);
  k.lineTo(w, KEY_FLOOR + 0.3);
  k.lineTo(hw, KEY_FLOOR + 0.3);
  k.lineTo(hw, KEY_FLOOR + 0.46);
  k.lineTo(-w, KEY_FLOOR + 0.46);
  k.lineTo(-w, KEY_FLOOR + 0.56);
  k.lineTo(-hw, KEY_FLOOR + 0.56);
  k.lineTo(-hw, top);
  k.lineTo(-hw, KEY_FLOOR);
  return k;
}

function plugSectionGeometry(z0, z1) {
  const face = new THREE.Shape();
  face.absarc(0, 0, PLUG_R, 0, Math.PI * 2, false);
  face.holes.push(keywayPath());
  const geo = new THREE.ExtrudeGeometry(face, {
    depth: z1 - z0,
    bevelEnabled: false,
    curveSegments: 48,
  });
  geo.translate(0, 0, z0);
  return geo;
}

// A full ring of shell — the untouched metal either side of the window.
function shellRingGeometry(z0, z1) {
  const ring = new THREE.Shape();
  ring.absarc(0, 0, SHELL_R, 0, Math.PI * 2, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, PLUG_R + BORE_GAP, 0, Math.PI * 2, true);
  ring.holes.push(bore);
  const geo = new THREE.ExtrudeGeometry(ring, {
    depth: z1 - z0,
    bevelEnabled: false,
    curveSegments: 56,
  });
  geo.translate(0, 0, z0);
  return geo;
}

// A plate with a rectangular opening, extruded along X (for the case's bolt
// face — the bolt passes through a real hole, never through solid material).
function slottedPlate(y0, y1, d, holeY, holeH, holeD, thickness, mat) {
  const s = new THREE.Shape();
  s.moveTo(-d / 2, y0);
  s.lineTo(d / 2, y0);
  s.lineTo(d / 2, y1);
  s.lineTo(-d / 2, y1);
  s.lineTo(-d / 2, y0);
  const hole = new THREE.Path();
  hole.moveTo(-holeD / 2, holeY - holeH / 2);
  hole.lineTo(holeD / 2, holeY - holeH / 2);
  hole.lineTo(holeD / 2, holeY + holeH / 2);
  hole.lineTo(-holeD / 2, holeY + holeH / 2);
  hole.lineTo(-holeD / 2, holeY - holeH / 2);
  s.holes.push(hole);
  const geo = new THREE.ExtrudeGeometry(s, { depth: thickness, bevelEnabled: false });
  geo.rotateY(Math.PI / 2);
  const mesh = new THREE.Mesh(geo, mat);
  mesh.castShadow = true;
  return mesh;
}

// The key's bitting edge is built from the SAME lift numbers the pins use, so
// the cuts cannot drift out of agreement with the mechanism they drive.
function bittingProfile(lifts) {
  const pts = [
    [0, TIP_H],
    [0.2, TIP_H],
  ];
  for (let i = CUT_U.length - 1; i >= 0; i--) {
    const u = CUT_U[i];
    if (i < CUT_U.length - 1) pts.push([u - 0.15, BLADE_H]); // peak before this cut
    pts.push([u - 0.09, lifts[i]], [u + 0.09, lifts[i]]);
  }
  pts.sort((a, b) => a[0] - b[0]);
  pts.push([CUT_U[0] + 0.2, BLADE_H], [BLADE_LEN, BLADE_H]);
  return pts;
}

function edgeAt(profile, u) {
  if (u <= profile[0][0]) return 0; // the pin has not reached the blade yet
  for (let i = 1; i < profile.length; i++) {
    if (u <= profile[i][0]) {
      const [x0, y0] = profile[i - 1];
      const [x1, y1] = profile[i];
      return lerp(y0, y1, (u - x0) / Math.max(1e-6, x1 - x0));
    }
  }
  return BLADE_H;
}

function keyGeometry(profile) {
  const s = new THREE.Shape();
  s.moveTo(0.1, 0);
  s.lineTo(BLADE_LEN, 0);
  s.lineTo(BLADE_LEN, -0.16);
  s.lineTo(BLADE_LEN + 0.14, -0.3);
  s.lineTo(BLADE_LEN + 1.32, -0.3);
  s.lineTo(BLADE_LEN + 1.4, -0.18);
  s.lineTo(BLADE_LEN + 1.4, 0.62);
  s.lineTo(BLADE_LEN + 1.3, 0.74);
  s.lineTo(BLADE_LEN + 0.2, 0.74);
  s.lineTo(BLADE_LEN + 0.06, 0.62);
  s.lineTo(BLADE_LEN, BLADE_H);
  for (let i = profile.length - 1; i >= 0; i--) s.lineTo(profile[i][0], profile[i][1]);
  s.lineTo(0, TIP_H);
  s.lineTo(0.1, 0);
  const ring = new THREE.Path();
  ring.absarc(BLADE_LEN + 0.85, 0.22, 0.17, 0, Math.PI * 2, false);
  s.holes.push(ring);
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.15,
    bevelEnabled: true,
    bevelThickness: 0.012,
    bevelSize: 0.012,
    bevelSegments: 1,
    curveSegments: 24,
  });
  geo.translate(0, 0, -0.075);
  return geo;
}

export function buildLock({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const plinth = studioPlinth({ w: 6.4, h: PLINTH_H, d: 5.0, bevel: 0.08 });
  plinth.position.set(-0.15, 0, -0.9);
  group.add(plinth);

  // Whole assembly: plug axis along Z, bolt throwing along +X, cut plane x = 0.
  const lock = new THREE.Group();
  lock.position.set(-1.0, PLINTH_H + 1.88, 0);
  group.add(lock);

  const brassOuter = brass(0xc9a227, 0.28);
  const brassInner = brass(0xb08d2a, 0.44);
  const brassKey = brass(0xd0aa33, 0.26);
  const brassWrong = brass(0x9a8f57, 0.38);
  const nickelMat = nickel();
  const springMat = springSteel();
  const linerMat = darkLiner();
  const toolMat = toolSteel();
  const caseMat = new THREE.MeshPhysicalMaterial({
    color: 0x41464d,
    metalness: 1,
    roughness: 0.62,
  });
  const boltMat = new THREE.MeshPhysicalMaterial({
    color: 0xa9b0b8,
    metalness: 1,
    roughness: 0.33,
  });

  const liners = []; // dark bore/interior liners — only meaningful when cut open

  // ── the case: six walls, so the bolt leaves through a real opening ─────────
  const always = new THREE.Group();
  lock.add(always);

  const caseTop = new THREE.Mesh(new THREE.BoxGeometry(CASE_W, WALL, CASE_D), caseMat);
  caseTop.position.set(CASE_XC, CASE_Y1 - WALL / 2, CASE_ZC);
  caseTop.castShadow = true;
  const caseBottom = caseTop.clone();
  caseBottom.position.y = CASE_Y0 + WALL / 2;
  const caseBack = new THREE.Mesh(
    new THREE.BoxGeometry(CASE_W, CASE_H, WALL),
    caseMat,
  );
  caseBack.position.set(CASE_XC, CASE_YC, CASE_Z0 + WALL / 2);
  caseBack.castShadow = true;
  // front wall, drilled for the tailpiece
  const caseFrontShape = new THREE.Shape();
  caseFrontShape.moveTo(CASE_X0, CASE_Y0);
  caseFrontShape.lineTo(CASE_X1, CASE_Y0);
  caseFrontShape.lineTo(CASE_X1, CASE_Y1);
  caseFrontShape.lineTo(CASE_X0, CASE_Y1);
  caseFrontShape.lineTo(CASE_X0, CASE_Y0);
  const tailHole = new THREE.Path();
  tailHole.absarc(0, 0, 0.44, 0, Math.PI * 2, false);
  caseFrontShape.holes.push(tailHole);
  const caseFront = new THREE.Mesh(
    new THREE.ExtrudeGeometry(caseFrontShape, {
      depth: WALL,
      bevelEnabled: false,
      curveSegments: 32,
    }),
    caseMat,
  );
  caseFront.position.z = CASE_Z1 - WALL;
  caseFront.castShadow = true;
  // the bolt leaves through a real opening in the +X wall; the −X wall is the
  // one the cut-away removes
  const caseBoltFace = slottedPlate(
    CASE_Y0,
    CASE_Y1,
    CASE_D,
    BOLT_Y,
    BOLT_H + 0.12,
    BOLT_D + 0.14,
    WALL,
    caseMat,
  );
  caseBoltFace.position.set(CASE_X1 - WALL / 2, 0, CASE_ZC);
  const caseNearWall = new THREE.Mesh(
    new THREE.BoxGeometry(WALL, CASE_H, CASE_D),
    caseMat,
  );
  caseNearWall.position.set(CASE_X0 + WALL / 2, CASE_YC, CASE_ZC);
  caseNearWall.castShadow = true;
  always.add(caseTop, caseBottom, caseBack, caseFront, caseBoltFace, caseNearWall);

  const foot = new THREE.Mesh(new THREE.BoxGeometry(CASE_W - 0.4, 0.3, 1.8), caseMat);
  foot.position.set(CASE_XC, CASE_Y0 - 0.15, CASE_ZC);
  foot.castShadow = true;
  foot.receiveShadow = true;
  always.add(foot);

  // ── the bolt (always visible — it is the lock's only output) ───────────────
  const boltGroup = new THREE.Group();
  always.add(boltGroup);
  const boltBody = new THREE.Mesh(
    new RoundedBoxGeometry(BOLT_L, BOLT_H, BOLT_D, 2, 0.09),
    boltMat,
  );
  boltBody.position.set(0, BOLT_Y, BOLT_Z);
  boltBody.castShadow = true;
  boltGroup.add(boltBody);
  let forkBar = null;
  for (const sx of [-1, 1]) {
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 2.42, 0.2), boltMat);
    bar.position.set(-1.15 + sx * 0.33, 0.13, FORK_Z);
    boltGroup.add(bar);
    if (sx > 0) forkBar = bar;
  }
  const forkSpine = new THREE.Mesh(new THREE.BoxGeometry(0.42, 0.5, 0.7), boltMat);
  forkSpine.position.set(-1.15, BOLT_Y + 0.1, BOLT_Z + 0.2);
  boltGroup.add(forkSpine);

  // ── the cylinder ──────────────────────────────────────────────────────────
  // Intact metal at both ends is shared by BOTH states; only the middle
  // section swaps between solid and cut-away, which is what a real display
  // cutaway looks like.
  const shellEnds = new THREE.Group();
  always.add(shellEnds);
  for (const [z0, z1] of [
    [SHELL_Z0, WIN_Z0],
    [WIN_Z1, SHELL_Z1],
  ]) {
    const ring = new THREE.Mesh(shellRingGeometry(z0, z1), brassOuter);
    ring.castShadow = true;
    shellEnds.add(ring);
    const bib = new THREE.Mesh(
      new THREE.BoxGeometry(BIBLE_HW * 2, BIBLE_OUT - 0.82, z1 - z0),
      brassOuter,
    );
    bib.position.set(0, (BIBLE_OUT + 0.82) / 2, (z0 + z1) / 2);
    bib.castShadow = true;
    shellEnds.add(bib);
  }

  // the rose collar, always on
  const roseRim = new THREE.Mesh(
    new THREE.CylinderGeometry(ROSE_R, ROSE_R, ROSE_T, 64, 1, true),
    brassOuter,
  );
  roseRim.geometry.rotateX(Math.PI / 2);
  roseRim.position.z = SHELL_Z1 + ROSE_T / 2;
  roseRim.castShadow = true;
  always.add(roseRim);
  const roseFace = new THREE.Mesh(
    new THREE.RingGeometry(SHELL_R - 0.02, ROSE_R, 64),
    brassOuter,
  );
  roseFace.position.z = SHELL_Z1 + ROSE_T;
  always.add(roseFace);
  const roseBack = new THREE.Mesh(new THREE.RingGeometry(SHELL_R, ROSE_R, 64), brassOuter);
  roseBack.position.z = SHELL_Z1;
  roseBack.rotation.y = Math.PI;
  always.add(roseBack);

  // ── sealed state: the window section, filled in ───────────────────────────
  const solid = new THREE.Group();
  lock.add(solid);
  const shellWhole = new THREE.Mesh(shellRingGeometry(WIN_Z0, WIN_Z1), brassOuter);
  shellWhole.castShadow = true;
  solid.add(shellWhole);
  const bibleWhole = new THREE.Mesh(
    new THREE.BoxGeometry(BIBLE_HW * 2, BIBLE_OUT - 0.82, WIN_Z1 - WIN_Z0),
    brassOuter,
  );
  bibleWhole.position.set(0, (BIBLE_OUT + 0.82) / 2, (WIN_Z0 + WIN_Z1) / 2);
  bibleWhole.castShadow = true;
  solid.add(bibleWhole);

  // ── cut-away state: the same section with a wedge milled out ──────────────
  const cut = new THREE.Group();
  lock.add(cut);

  const shellWindow = new THREE.Mesh(shellWindowGeometry(), brassOuter);
  shellWindow.castShadow = true;
  cut.add(shellWindow);
  const bibleWindow = new THREE.Mesh(
    new THREE.BoxGeometry(BIBLE_HW, BIBLE_OUT - 0.82, WIN_Z1 - WIN_Z0),
    brassOuter,
  );
  bibleWindow.position.set(
    -BIBLE_HW / 2,
    (BIBLE_OUT + 0.82) / 2,
    (WIN_Z0 + WIN_Z1) / 2,
  );
  bibleWindow.castShadow = true;
  cut.add(bibleWindow);

  for (const z of CHAMBER_Z) {
    const h = BIBLE_IN - SHEAR_Y;
    const bore = boreTube(PIN_R + 0.025, h, linerMat);
    bore.position.set(0, SHEAR_Y + h / 2, z);
    cut.add(bore);
    liners.push(bore);
  }

  // the shear line — drawn, not modelled (see the header)
  const shearGroup = new THREE.Group();
  cut.add(shearGroup);
  const shearMat = accentMat();
  const shearBar = new THREE.Mesh(
    new THREE.BoxGeometry(0.03, 0.035, WIN_Z1 - WIN_Z0),
    shearMat,
  );
  shearBar.position.set(-0.02, SHEAR_Y, (WIN_Z0 + WIN_Z1) / 2);
  shearGroup.add(shearBar);
  const shearRing = new THREE.Mesh(
    new THREE.TorusGeometry(PLUG_R + BORE_GAP / 2, 0.016, 8, 64),
    shearMat,
  );
  shearRing.position.z = SHELL_Z1 + ROSE_T + 0.03;
  shearGroup.add(shearRing);

  // ── the plug (rotates; carries the key, the key pins and the cam) ─────────
  const plugGroup = new THREE.Group();
  lock.add(plugGroup);

  // intact plug at both ends, keyway bored right through
  for (const [z0, z1] of [
    [PLUG_Z0, WIN_Z0],
    [WIN_Z1, PLUG_Z1],
  ]) {
    const sec = new THREE.Mesh(plugSectionGeometry(z0, z1), brassInner);
    sec.castShadow = true;
    plugGroup.add(sec);
  }

  const plugHalf = new THREE.Mesh(plugHalfGeometry(), brassInner);
  plugHalf.castShadow = true;
  plugGroup.add(plugHalf);

  const plugSolidGroup = new THREE.Group();
  const plugWhole = new THREE.Mesh(
    plugSectionGeometry(WIN_Z0, WIN_Z1),
    brassInner,
  );
  plugWhole.castShadow = true;
  plugSolidGroup.add(plugWhole);
  plugGroup.add(plugSolidGroup);

  for (const z of CHAMBER_Z) {
    const h = SHEAR_Y - (KEY_FLOOR + BLADE_H);
    const bore = boreTube(PIN_R + 0.025, h, linerMat);
    bore.position.set(0, KEY_FLOOR + BLADE_H + h / 2, z);
    plugGroup.add(bore);
    liners.push(bore);
  }

  // cam: tailpiece through the case wall, crank arm, and the pin in the fork
  const camGroup = new THREE.Group();
  plugGroup.add(camGroup);
  const tailShaft = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.3, 0.72), nickelMat);
  tailShaft.position.z = PLUG_Z0 - 0.36;
  tailShaft.castShadow = true;
  camGroup.add(tailShaft);
  const crankArm = new THREE.Mesh(
    new THREE.BoxGeometry(CRANK_R + 0.36, 0.32, 0.14),
    nickelMat,
  );
  crankArm.position.set(CRANK_R / 2, 0, FORK_Z + 0.13);
  crankArm.castShadow = true;
  camGroup.add(crankArm);
  const crankPin = new THREE.Mesh(
    new THREE.CylinderGeometry(0.13, 0.13, 0.3, 20),
    nickelMat,
  );
  crankPin.geometry.rotateX(Math.PI / 2);
  crankPin.position.set(CRANK_R, 0, FORK_Z);
  camGroup.add(crankPin);

  // ── pin stacks ────────────────────────────────────────────────────────────
  // A spring changes LENGTH, not proportions: scaling a tube mesh in Y flattens
  // the wire into chevrons, so compression rides a morph target instead.
  const springOpts = { turns: 6, radius: 0.085, wireRadius: 0.028, segmentsPerTurn: 18 };
  const springGeo = coil({ ...springOpts, length: SPRING_FREE }, springMat).mesh.geometry;
  const springBound = coil({ ...springOpts, length: SPRING_MIN }, springMat).mesh.geometry;
  springGeo.morphAttributes.position = [
    new THREE.Float32BufferAttribute(
      Float32Array.from(springBound.attributes.position.array),
      3,
    ),
  ];
  springBound.dispose();

  const keyPins = [];
  const driverPins = [];
  const springs = [];
  CHAMBER_Z.forEach((z, i) => {
    const kp = pin(KEY_PIN_L[i], brassInner);
    kp.position.z = z;
    plugGroup.add(kp); // key pins live in the plug and turn with it
    keyPins.push(kp);

    const dp = pin(DRIVER_L, nickelMat);
    dp.position.z = z;
    cut.add(dp);
    driverPins.push(dp);

    const sp = new THREE.Mesh(springGeo, springMat);
    sp.castShadow = true;
    sp.updateMorphTargets();
    sp.position.z = z;
    cut.add(sp);
    springs.push(sp);
  });

  // ── keys ──────────────────────────────────────────────────────────────────
  const rightProfile = bittingProfile(LIFTS);
  const wrongProfile = bittingProfile(WRONG_LIFTS);

  function makeKey(profile, mat) {
    const g = new THREE.Group();
    const mesh = new THREE.Mesh(keyGeometry(profile), mat);
    mesh.rotation.y = -Math.PI / 2; // blade runs along +Z, tip at the group origin
    mesh.position.y = KEY_FLOOR;
    mesh.castShadow = true;
    g.add(mesh);
    return g;
  }
  const rightKey = makeKey(rightProfile, brassKey);
  const wrongKey = makeKey(wrongProfile, brassWrong);
  plugGroup.add(rightKey, wrongKey);

  // ── picking tools ─────────────────────────────────────────────────────────
  const tools = new THREE.Group();
  plugGroup.add(tools);

  const wrenchTip = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.09, 1.5), toolMat);
  wrenchTip.position.set(0, KEY_FLOOR + 0.05, PLUG_Z1 - 0.7);
  tools.add(wrenchTip);
  const wrenchArm = new THREE.Mesh(new THREE.BoxGeometry(0.1, 0.95, 0.12), toolMat);
  wrenchArm.position.set(0, KEY_FLOOR - 0.45, PLUG_Z1 + 0.32);
  wrenchArm.castShadow = true;
  tools.add(wrenchArm);

  const pickGroup = new THREE.Group();
  tools.add(pickGroup);
  const pickShaft = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.075, 3.2), toolMat);
  pickShaft.position.set(0, -0.08, 1.62);
  pickShaft.castShadow = true;
  pickGroup.add(pickShaft);
  const pickHook = new THREE.Mesh(new THREE.BoxGeometry(0.075, 0.22, 0.17), toolMat);
  pickHook.position.set(0, -0.11, 0);
  pickGroup.add(pickHook);

  // ── callouts ──────────────────────────────────────────────────────────────
  const labels = calloutSets(['exterior', 'internal', 'stack', 'release', 'attack']);
  labels.add('exterior', roseRim, 'Brass cylinder', [0.2, 1.1, 0.1], 42, 54);
  labels.add('exterior', plugSolidGroup, 'Keyway', [0.25, -0.5, 1.15], -52, 60);
  labels.add('exterior', boltBody, 'Bolt', [0.8, 1.0, 0], 38, 52);

  labels.add('internal', shellWindow, 'Shell', [0.15, 1.9, 0.6], 46, 56);
  labels.add('internal', plugHalf, 'Plug', [0.2, -0.78, 0.85], -50, 58);
  labels.add('internal', shearBar, 'Shear line', [0.05, 0.16, -0.75], 28, 68);

  labels.add('stack', springs[1], 'Spring', [0.1, 0.5, 0], 44, 50);
  labels.add('stack', driverPins[1], 'Driver pin', [0.15, 0.3, 0], 22, 62);
  labels.add('stack', keyPins[3], 'Key pin', [0.15, -0.28, 0], -44, 58);
  labels.add('stack', driverPins[4], 'The split', [0.12, -0.24, 0], -28, 64);

  labels.add('release', forkBar, 'Bolt fork', [0.25, 0.75, 0], 44, 54);
  labels.add('release', boltBody, 'Bolt', [0.7, 0.95, 0], 40, 50);

  labels.add('attack', wrenchArm, 'Tension wrench', [0.12, -0.42, 0.14], -44, 62);
  labels.add('attack', pickShaft, 'Hook pick', [0.14, -0.12, 0.1], -38, 58);
  labels.add('attack', driverPins[0], 'On the ledge', [0.15, 0.34, 0], 30, 62);

  // ── pose ──────────────────────────────────────────────────────────────────
  const S = {
    reveal: 0,
    stacks: true, // the pin stacks are staged in — step 2 shows the bare bore
    key: 'none', // none | right | wrong | tools
    keyIn: 0,
    turn: 0, // 0 = locked / bolt thrown, 1 = 180° turned / bolt retracted
    creep: 0, // radians of tension-wrench rotation
    set: [0, 0, 0, 0, 0],
    pickIndex: 0,
    pickZ: CHAMBER_Z[0],
    pickLift: 0,
    shear: false,
    spin: 0,
  };

  function set(partial) {
    Object.assign(S, partial);

    group.rotation.y = S.spin;

    const open = clamp01(S.reveal) > 0.5;
    solid.visible = !open;
    cut.visible = open;
    caseNearWall.visible = !open;
    caseBoltFace.visible = !open;
    // the cam sits dead behind the cylinder — the only way in is from above
    caseTop.visible = !open;
    plugHalf.visible = open;
    plugSolidGroup.visible = !open;
    shearGroup.visible = S.shear;
    for (const m of liners) m.visible = open;
    const stacked = open && S.stacks !== false;
    for (let i = 0; i < 5; i++) {
      keyPins[i].visible = stacked;
      driverPins[i].visible = stacked;
      springs[i].visible = stacked;
    }

    rightKey.visible = S.key === 'right';
    wrongKey.visible = S.key === 'wrong';
    tools.visible = S.key === 'tools';

    // 180° of plug rotation unlocks; `creep` is the pick's tension rotation
    plugGroup.rotation.z = -Math.PI * S.turn - S.creep;

    const tipZ = PLUG_Z1 - S.keyIn * BLADE_LEN;
    rightKey.position.z = tipZ;
    wrongKey.position.z = tipZ;

    const profile = S.key === 'wrong' ? wrongProfile : rightProfile;
    const turned = S.turn > 0.004;

    for (let i = 0; i < 5; i++) {
      let lift = 0;
      if (S.key === 'right' || S.key === 'wrong') {
        lift = edgeAt(profile, CHAMBER_Z[i] - tipZ);
      } else if (S.key === 'tools') {
        // a set pin drops back to the keyway; its driver stays on the ledge
        if (S.set[i] < 0.5 && i === S.pickIndex) lift = S.pickLift;
      }

      keyPins[i].position.y = KEY_FLOOR + lift + KEY_PIN_L[i] / 2;

      // the driver rides on its key pin — unless the plug has moved out from
      // under it, in which case it is stranded on the shear line
      const splitY = KEY_FLOOR + lift + KEY_PIN_L[i];
      const stranded = turned || S.set[i] > 0.5;
      const driverBottom = stranded ? SHEAR_Y : splitY;
      driverPins[i].position.y = driverBottom + DRIVER_L / 2;

      const springBottom = driverBottom + DRIVER_L;
      const len = Math.min(SPRING_FREE, Math.max(SPRING_MIN, BIBLE_IN - springBottom));
      springs[i].morphTargetInfluences[0] =
        (SPRING_FREE - len) / (SPRING_FREE - SPRING_MIN);
      springs[i].position.y = springBottom + len / 2;
    }

    pickGroup.position.set(0, KEY_FLOOR + S.pickLift, S.pickZ);

    // slider-crank: the bolt's X tracks the crank pin's X exactly
    boltGroup.position.x = BOLT_X_THROWN - CRANK_R * (1 - Math.cos(Math.PI * S.turn));
  }

  set({});

  return {
    group,
    set,
    setLabels: labels.setLabels,
    parts: {
      plug: plugGroup,
      bolt: boltGroup,
      cam: camGroup,
      keyPins,
      driverPins,
      springs,
      rightKey,
      wrongKey,
      tools,
    },
  };
}
