import * as THREE from 'three';
import { studioPlinth, materials } from '../../framework/parts.js';
import { tubeAlong } from '../../framework/geometry.js';
import { clamp01, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A human heart on a museum specimen mount: a solid, wet, beating organ whose
// anterior half lifts away to expose four chambers, four one-way valves, the
// parachute rigging that stops the big ones turning inside out, and the wiring
// that fires the whole thing without a single instruction from the brain.
//
// PROPORTIONS — ONE model unit = 5 cm, so every constant below is a measured
// anatomical figure and the ratios hold by construction:
//   whole organ        12.0 x 9.5 x 6.5 cm   -> 2.40 x 1.90 x 1.30 units
//   LV long axis       8.7 cm (apex -> mitral plane)          -> 1.74
//   LV cavity          42-54 mm diameter at end-diastole      -> r 0.42-0.54
//   LV free wall       9-10 mm, thinnest at the apex (~3 mm)  -> 0.05-0.19
//   RV free wall       3.5 mm                                 -> 0.07
//   RV cavity          crescent, ~27 mm deep at its fattest   -> bulge 0.54
//   annuli (across)    tricuspid 30 / mitral 28 / aortic 21 / pulmonary 22 mm
//   aorta 30 / pulmonary trunk 24 / SVC 20 / IVC 24 / PVs 12 mm diameter
//   coronary arteries  4.5 mm                                 -> r 0.045
// The LV : RV wall ratio (0.19 : 0.07 = 2.7 : 1) is the single most important
// number in the model — it is what step 4 is about, and it reads directly off
// the cut faces of the cutaway rather than having to be asserted in copy.
//
// MECHANISM (researched): the heart is TWO pumps sharing one muscle and one
// clock. The right pump takes blood back from the body (SVC + IVC -> right
// atrium -> tricuspid -> right ventricle) and throws it 30 cm to the lungs at
// ~25 mmHg. The left pump takes it back from the lungs (four pulmonary veins
// -> left atrium -> mitral -> left ventricle) and throws it round the whole
// body at ~120 mmHg. The same ~70 mL a beat leaves each side; five times the
// pressure leaves the left, which is why its wall is three times thicker.
// Four valves sit in one fibrous plate: the two big AV valves hang into the
// ventricles on chordae tendineae tensioned by papillary muscles, the only
// reason they do not evert like an umbrella at 120 mmHg. The two semilunar
// valves are three pockets each and need no rigging — backflow fills them.
// The clock is the heart's own: the SA node fires, both atria depolarise in
// ~90 ms, the AV node deliberately STALLS the signal ~100-120 ms so the atria
// can finish topping the ventricles up (the "atrial kick", the last 20-30% of
// filling), then His -> bundle branches (2 m/s) -> Purkinje (4 m/s) fire the
// whole ventricular mass almost at once, apex first, wringing upward.
// At 75 bpm one cycle is 0.8 s: ~0.3 s systole, ~0.5 s diastole. 5.25 L/min,
// your whole blood volume every minute, ~100,000 beats a day, ~2.7 billion in
// a life. And the muscle can only feed itself in the gap: its own squeeze
// pinches the coronary arteries shut, so the left ventricle is perfused
// almost entirely during diastole.
//
// STATE SCALARS (one pose fn, `set({...})`):
//   beat    0..1 phase of ONE cardiac cycle — drives every moving thing
//   lid     anterior half-shell: 1 solid / 0.12 ghosted outline / 0 gone
//   reveal  0 interior hidden -> 1 chambers, valves and rigging visible
//   flow    0 -> 1 blood packets riding the circuit
//   xray    0 -> 1 great vessels go translucent so the blood shows through
//   wire    0 -> 1 conduction system lit and firing
//   atria   1 atria present -> 0 lifted off (the valve-plane shot)
//   cor     0 -> 1 coronary flow dots (bright in diastole, pinched in systole)
//   spin    turntable angle (rad)

// --- cardiac cycle phase map (fractions of one 0.8 s beat) -------------------
const P_ATRIA_ON = 0.02; // atrial squeeze begins
const P_ATRIA_OFF = 0.15;
const P_AV_HOLD_A = 0.05; // AV node lit, deliberately holding the signal back
const P_AV_HOLD_B = 0.15;
const P_QRS = 0.17; // His-Purkinje fires, ventricles start
const P_AV_SHUT = 0.15; // mitral + tricuspid slam ("lub")
const P_SL_OPEN = 0.22; // aortic + pulmonary open, ejection starts
const P_SL_SHUT = 0.5; // ejection ends ("dub")
const P_AV_OPEN = 0.57; // filling starts

// --- layout ------------------------------------------------------------------
const PLINTH_H = 0.26;
const APEX = [0.52, 0.08, 0.16]; // apex points down, LEFT (+X) and forward
const LVBASE = [0.0, 1.72, -0.06]; // centre of the mitral/aortic plane
const PLATE_Y = 1.74; // the fibrous skeleton the valves are cut into
const PLATE_T = 0.09;
const AP = 0.94; // antero-posterior squash: the heart is not round

// annuli, in the plate's XZ plane: [x, z, radius]
const AN_T = [-0.91, -0.03, 0.3]; // tricuspid   (3 cusps)
const AN_M = [0.21, -0.21, 0.28]; // mitral      (2 cusps)
const AN_A = [-0.2, 0.1, 0.21]; // aortic      (3 cusps)
const AN_P = [0.05, 0.74, 0.22]; // pulmonary   (3 cusps), rides the infundibulum
const AN_P_Y = 1.92;

// angular sectors, degrees. 0deg = +X (patient's left), 90deg = +Z (front).
const LV_LID = [15, 145]; // an anterior window lifts out of the LV
const LV_BACK = [145, 375];
const RV_SPAN = [55, 255]; // the RV crescent wraps the LV's right-front
const RV_LID = [55, 145];
const RV_BACK = [145, 255];

// --- profiles (u = 0 at the apex, 1 at the valve plane) ----------------------
const smoothT = (t) => t * t * (3 - 2 * t);
function tbl(pts) {
  return (u) => {
    if (u <= pts[0][0]) return pts[0][1];
    for (let i = 1; i < pts.length; i++) {
      if (u <= pts[i][0]) {
        const t = (u - pts[i - 1][0]) / (pts[i][0] - pts[i - 1][0]);
        return pts[i - 1][1] + (pts[i][1] - pts[i - 1][1]) * smoothT(t);
      }
    }
    return pts[pts.length - 1][1];
  };
}
// The OUTER silhouette is authored directly and the cavity derived from it, so
// the apex stays a blunt dome (which is what a real apex is) instead of the
// needle you get by tapering the cavity and the wall independently.
const LV_OUT = tbl([
  [0, 0.03],
  [0.03, 0.15],
  [0.07, 0.24],
  [0.12, 0.32],
  [0.2, 0.41],
  [0.32, 0.5],
  [0.46, 0.57],
  [0.62, 0.62],
  [0.8, 0.65],
  [1, 0.69],
]);
const LV_WALL = tbl([
  [0, 0.028],
  [0.04, 0.08],
  [0.1, 0.13],
  [0.18, 0.165],
  [0.34, 0.185],
  [0.6, 0.19],
  [0.82, 0.19],
  [1, 0.185],
]);
const LV_CAV = (u) => Math.max(0.006, LV_OUT(u) - LV_WALL(u));
const RV_BULGE = tbl([
  [0, 0],
  [0.16, 0.05],
  [0.3, 0.26],
  [0.5, 0.46],
  [0.66, 0.54],
  [0.86, 0.55],
  [1, 0.52],
]);
const RV_WALL = tbl([
  [0, 0.045],
  [0.3, 0.065],
  [0.7, 0.07],
  [1, 0.072],
]);

// Systolic deformation, tuned to a real ejection fraction: cavity radius x0.70
// with a 10% long-axis shortening gives 1 - 0.70^2 x 0.90 = 56%.
const SYS_R = 0.7;
const SYS_LONG = 0.9;
const SYS_WALL = 1.5; // 10 mm -> 15 mm: the wall thickens as it shortens

const ramp = (u, a, b) => smoothT(clamp01((u - a) / (b - a)));
const D2R = Math.PI / 180;

// LV ring centre at height fraction u (systole shortens toward the fixed base)
function lvCentre(u, sys) {
  const uu = sys ? 1 - (1 - u) * SYS_LONG : u;
  return [
    APEX[0] + (LVBASE[0] - APEX[0]) * uu,
    APEX[1] + (LVBASE[1] - APEX[1]) * uu,
    APEX[2] + (LVBASE[2] - APEX[2]) * uu,
  ];
}
const lvCav = (u, sys) => LV_CAV(u) * (sys ? SYS_R : 1);
const lvWall = (u, sys) => LV_WALL(u) * (sys ? SYS_WALL : 1);
const lvOuter = (u, sys) => lvCav(u, sys) + lvWall(u, sys);
// The crescent falls to zero at both interventricular grooves, so the RV free
// wall meets the LV surface exactly there — no seam to hide.
const crescent = (deg) => {
  const s = (deg - RV_SPAN[0]) / (RV_SPAN[1] - RV_SPAN[0]);
  if (s <= 0 || s >= 1) return 0;
  return Math.pow(Math.sin(Math.PI * s), 0.7);
};
const rvBulge = (u, sys) => RV_BULGE(u) * (sys ? 0.55 : 1);
const rvInner = (u, deg, sys) => lvOuter(u, sys) + rvBulge(u, sys) * crescent(deg);
const rvOuter = (u, deg, sys) => rvInner(u, deg, sys) + RV_WALL(u) * (sys ? 1.4 : 1);

function ptAt(centre, r, deg) {
  const a = deg * D2R;
  return [centre[0] + r * Math.cos(a), centre[1], centre[2] + r * AP * Math.sin(a)];
}
// A point k of the way across the LV cavity at (u, deg) — used to keep blood
// packets and papillary roots inside the chamber by construction.
function lvCavPt(u, deg, k, sys = false) {
  return ptAt(lvCentre(u, sys), lvCav(u, sys) * k, deg);
}
// ...and k of the way across the RV crescent at (u, deg)
function rvCavPt(u, deg, k, sys = false) {
  const c = lvCentre(u, sys);
  const a = lvOuter(u, sys);
  return ptAt(c, a + (rvInner(u, deg, sys) - a) * k, deg);
}

// --- the band primitive ------------------------------------------------------
// A chamber wall is a BAND: an outer (epicardial) surface, an inner
// (endocardial) surface, the two longitudinal cut faces, and the top/bottom
// rims. The cut faces are the whole point — they are what makes a wall's real
// thickness readable in a cutaway instead of something you have to be told.
// Emitted non-indexed in three material groups: 0 outer, 1 inner, 2 cut.
// INDEXED, one vertex block per surface family: normals then average within a
// family (muscle reads smooth) but stay hard at the family boundaries, so the
// cut faces keep a crisp machined edge instead of smearing into the wall.
// Emitting this non-indexed gave every triangle its own normal and the whole
// organ looked chiselled out of low-poly stone.
function emitBand(rings, opts) {
  const { capStart = true, capEnd = true, capBottom = true, capTop = true } = opts;
  const L = rings.length;
  const N = rings[0].outer.length;
  const pos = [];
  const idx = [];
  const groups = [];
  const pushGrid = (rows, flip) => {
    const base = pos.length / 3;
    const M = rows.length;
    const K = rows[0].length;
    for (const row of rows) for (const p of row) pos.push(p[0], p[1], p[2]);
    for (let i = 0; i < M - 1; i++)
      for (let j = 0; j < K - 1; j++) {
        const a = base + i * K + j;
        const b = a + 1;
        const c = a + K;
        const d = c + 1;
        if (flip) idx.push(a, b, d, a, d, c);
        else idx.push(a, c, d, a, d, b);
      }
  };
  const mark = () => idx.length;
  let cur = 0;
  pushGrid(
    rings.map((r) => r.outer),
    false,
  );
  groups.push({ start: cur, count: mark() - cur, mat: 0 });
  cur = mark();
  pushGrid(
    rings.map((r) => r.inner),
    true,
  );
  groups.push({ start: cur, count: mark() - cur, mat: 1 });
  cur = mark();
  if (capStart)
    pushGrid(
      rings.map((r) => [r.outer[0], r.inner[0]]),
      true,
    );
  if (capEnd)
    pushGrid(
      rings.map((r) => [r.outer[N - 1], r.inner[N - 1]]),
      false,
    );
  if (capBottom) pushGrid([rings[0].outer, rings[0].inner], true);
  if (capTop) pushGrid([rings[L - 1].outer, rings[L - 1].inner], false);
  groups.push({ start: cur, count: mark() - cur, mat: 2 });
  return { pos, idx, groups };
}

// Same-vertex-count diastolic + systolic ring sets become one morphable mesh —
// shape state as a morph target, never a per-frame geometry rebuild.
function bandMesh(ringsDia, ringsSys, mats, opts = {}) {
  const a = emitBand(ringsDia, opts);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(a.pos, 3));
  geo.setIndex(a.idx);
  geo.computeVertexNormals();
  if (ringsSys) {
    const b = emitBand(ringsSys, opts);
    const tmp = new THREE.BufferGeometry();
    tmp.setAttribute('position', new THREE.Float32BufferAttribute(b.pos, 3));
    tmp.setIndex(b.idx);
    tmp.computeVertexNormals();
    geo.morphAttributes.position = [new THREE.Float32BufferAttribute(b.pos, 3)];
    geo.morphAttributes.normal = [tmp.getAttribute('normal')];
  }
  for (const g of a.groups) if (g.count) geo.addGroup(g.start, g.count, g.mat);
  const mesh = new THREE.Mesh(geo, mats);
  mesh.castShadow = true;
  mesh.receiveShadow = true;
  if (ringsSys) mesh.morphTargetInfluences = [0];
  return mesh;
}

// --- valve leaflets ----------------------------------------------------------
// One builder for all four valves. A leaflet is a bellied sheet hinged on an
// ARC of the annulus, and opening/closing is a shape change, not a hinge
// swing — so it ships as a morph between an authored OPEN and CLOSED state.
//   up=false  AV valve: hangs into the ventricle, closes by rising to a
//             coaptation line that sags below the annulus plane
//   up=true   semilunar: three pockets standing in the artery, open = flat
//             against the wall, closed = free edges bowed into the centre
function leafletMesh(annulus, y, a0, a1, mat, { up = false, len = 0.4, sag = 0.3 } = {}) {
  const NS = 16;
  const NT = 8;
  const [cx, cz, R] = annulus;
  const dirY = up ? 1 : -1;
  const p0x = cx + R * Math.cos(a0 * D2R);
  const p0z = cz + R * AP * Math.sin(a0 * D2R);
  const p1x = cx + R * Math.cos(a1 * D2R);
  const p1z = cz + R * AP * Math.sin(a1 * D2R);
  const emit = (closedState) => {
    const out = [];
    for (let si = 0; si <= NS; si++) {
      const s = si / NS;
      const a = (a0 + (a1 - a0) * s) * D2R;
      const hx = cx + R * Math.cos(a);
      const hz = cz + R * AP * Math.sin(a);
      let fx;
      let fz;
      let fy;
      if (closedState) {
        // The free edge runs commissure -> centre -> commissure: the two radii
        // the cusps actually coapt along. (A bowed chord left real gaps once
        // the annulus was squashed into an ellipse — the bow reached the centre
        // at one orientation and missed it at every other, and the valve
        // rendered with daylight through it.)
        const q = s <= 0.5 ? s * 2 : (s - 0.5) * 2;
        const ax = s <= 0.5 ? p0x : cx;
        const az = s <= 0.5 ? p0z : cz;
        const bx = s <= 0.5 ? cx : p1x;
        const bz = s <= 0.5 ? cz : p1z;
        // 4% of overlap: real leaflets coapt over a few millimetres of surface,
        // they do not meet edge to edge like machined parts
        fx = cx + (ax + (bx - ax) * q - cx) * 0.96;
        fz = cz + (az + (bz - az) * q - cz) * 0.96;
        fy = y + dirY * sag * len * Math.sin(Math.PI * s);
      } else {
        // open: the leaflet lies along the flow, close to the wall
        const inx = (cx - hx) / R;
        const inz = (cz - hz) / R;
        const pull = up ? -0.12 : 0.34;
        fx = hx + inx * pull * R;
        fz = hz + inz * pull * R;
        fy = y + dirY * len;
      }
      for (let ti = 0; ti <= NT; ti++) {
        const t = ti / NT;
        const bell = Math.sin(Math.PI * t) * Math.sin(Math.PI * s);
        const px = hx + (fx - hx) * t;
        const pz = hz + (fz - hz) * t;
        const py = y + (fy - y) * t + (closedState ? -0.14 : 0.1) * dirY * len * bell;
        // a leaflet is a millimetre of tissue, not a plate: a slight belly so
        // it never reads as a flat triangle
        const k = (closedState ? -1 : 1) * 0.06 * bell;
        out.push(px + ((hx - cx) / R) * k, py, pz + ((hz - cz) / R) * k);
      }
    }
    return out;
  };
  const idx = [];
  const row = NT + 1;
  for (let si = 0; si < NS; si++)
    for (let ti = 0; ti < NT; ti++) {
      const k = si * row + ti;
      idx.push(k, k + 1, k + row, k + 1, k + row + 1, k + row);
    }
  const openPos = emit(false);
  const closedPos = emit(true);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(openPos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const tmp = new THREE.BufferGeometry();
  tmp.setAttribute('position', new THREE.Float32BufferAttribute(closedPos, 3));
  tmp.setIndex(idx);
  tmp.computeVertexNormals();
  geo.morphAttributes.position = [new THREE.Float32BufferAttribute(closedPos, 3)];
  geo.morphAttributes.normal = [tmp.getAttribute('normal')];
  const mesh = new THREE.Mesh(geo, mat);
  mesh.morphTargetInfluences = [0];
  mesh.castShadow = true;
  // the free edge in both states, so the chordae can be aimed at the exact
  // point they hold rather than at a guess
  mesh.userData.freeEdge = (s, k) => {
    const i = Math.round(s * NS) * row + NT;
    return new THREE.Vector3(
      openPos[i * 3] + (closedPos[i * 3] - openPos[i * 3]) * k,
      openPos[i * 3 + 1] + (closedPos[i * 3 + 1] - openPos[i * 3 + 1]) * k,
      openPos[i * 3 + 2] + (closedPos[i * 3 + 2] - openPos[i * 3 + 2]) * k,
    );
  };
  return mesh;
}

export function buildHeart({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  group.add(studioPlinth({ w: 3.9, h: PLINTH_H, d: 2.3 }));

  // Everything anatomical lives under `body`, which is the turntable. The
  // plinth and the specimen mount stay put.
  const body = new THREE.Group();
  body.position.y = PLINTH_H;
  group.add(body);

  // ---- materials ------------------------------------------------------------
  const wetMuscle = (color, rough) => {
    const m = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0,
      roughness: rough,
      clearcoat: 0.3,
      clearcoatRoughness: 0.36,
      sheen: 0.5,
      sheenRoughness: 0.7,
      sheenColor: new THREE.Color(0xff9d8c),
    });
    return m;
  };
  const matEpi = wetMuscle(0x8e2f27, 0.52); // epicardium — wet outer muscle
  const matEndo = wetMuscle(0xa9645a, 0.38); // endocardium — paler, glassy lining
  matEndo.clearcoat = 0.5;
  matEndo.side = THREE.DoubleSide;
  // the cut face is raw muscle: darker and much more saturated than either
  // surface, because the whole of step 4 is read off these two ribbons
  const matCut = new THREE.MeshPhysicalMaterial({
    color: 0xc2503f,
    metalness: 0,
    roughness: 0.8,
    sheen: 0.25,
    sheenColor: new THREE.Color(0xff8f7d),
  });
  const coreMats = [matEpi, matEndo, matCut];
  // the anterior half-shell needs its OWN materials so it can ghost without
  // taking the rest of the organ with it
  const lidMats = coreMats.map((m) => m.clone());
  const lidBaseCoat = [0.3, 0.5, 0];

  const matLeaflet = new THREE.MeshPhysicalMaterial({
    color: 0xe4cfc2,
    metalness: 0,
    roughness: 0.36,
    clearcoat: 0.55,
    clearcoatRoughness: 0.28,
    sheen: 0.4,
    sheenColor: new THREE.Color(0xffd9c4),
    side: THREE.DoubleSide,
  });
  const matFibrous = wetMuscle(0xa8907a, 0.68); // the valve plate / cardiac skeleton
  matFibrous.clearcoat = 0.16;
  const matChorda = new THREE.MeshPhysicalMaterial({
    color: 0xded0c4,
    metalness: 0,
    roughness: 0.44,
    clearcoat: 0.28,
  });
  const matArteryWall = wetMuscle(0xa87a69, 0.72); // aorta / pulmonary trunk
  matArteryWall.clearcoat = 0.18;
  const matVeinWall = wetMuscle(0x806a78, 0.72); // cavae / pulmonary veins
  matVeinWall.clearcoat = 0.16;
  const matCoronary = wetMuscle(0xbe3b33, 0.4);
  const matCorVein = wetMuscle(0x5b5f86, 0.44);
  const matFat = wetMuscle(0xe0c98d, 0.62);
  matFat.sheenColor = new THREE.Color(0xfff0c0);
  const matMount = materials.paintedMetal(0x2b2e34);
  matMount.roughness = 0.5;
  matMount.clearcoat = 0.4;
  const vesselMats = [matArteryWall, matVeinWall];

  // ---- the specimen mount ---------------------------------------------------
  // Inside `body`, so it turns with the heart: a museum mount rotates with the
  // specimen, it does not stand still while the exhibit slides off it.
  const mount = new THREE.Group();
  body.add(mount);
  const mountBase = new THREE.Mesh(new THREE.CylinderGeometry(0.42, 0.46, 0.05, 40), matMount);
  mountBase.position.set(-0.1, 0.025, -0.98);
  mountBase.castShadow = true;
  mountBase.receiveShadow = true;
  mount.add(mountBase);
  const mountPost = tubeAlong(
    [
      [-0.1, 0.03, -0.98],
      [-0.12, 0.7, -0.96],
      [-0.14, 1.24, -0.86],
      [-0.15, 1.42, -0.72],
    ],
    0.045,
    matMount,
    { tubularSegments: 40, radialSegments: 14 },
  );
  mount.add(mountPost);
  const mountPad = new THREE.Mesh(new THREE.SphereGeometry(0.09, 20, 14), matMount);
  mountPad.scale.set(1, 0.7, 0.5);
  mountPad.position.set(-0.15, 1.44, -0.68);
  mount.add(mountPad);

  // ---- ventricles -----------------------------------------------------------
  const heart = new THREE.Group();
  body.add(heart);
  const lid = new THREE.Group(); // the anterior half that lifts away
  const shellBack = new THREE.Group(); // the posterior half — ALWAYS present,
  // otherwise the sealed organ is a hollow mask the moment you orbit past it
  const interior = new THREE.Group(); // only visible once the lid is off
  const vessels = new THREE.Group();
  const atriaGroup = new THREE.Group();
  heart.add(lid, shellBack, interior, vessels, atriaGroup);
  // The valve-plane shot looks straight down the aorta's line of sight, so the
  // great vessels come off with the atria rather than hiding the very thing
  // the step is about.
  const vesselHide = [vessels];

  const LV_LEVELS = 34;
  const ANG_STEP = 3; // degrees between ring samples

  function ventricleRings(kind, sector, sys) {
    const [a0, a1] = sector;
    const n = Math.max(2, Math.round((a1 - a0) / ANG_STEP) + 1);
    const rings = [];
    const uMin = kind === 'rv' ? 0.14 : 0;
    for (let i = 0; i < LV_LEVELS; i++) {
      const u = uMin + ((1 - uMin) * i) / (LV_LEVELS - 1);
      const c = lvCentre(u, sys);
      const inner = [];
      const outer = [];
      for (let j = 0; j < n; j++) {
        const deg = a0 + ((a1 - a0) * j) / (n - 1);
        if (kind === 'rv') {
          inner.push(ptAt(c, rvInner(u, deg, sys), deg));
          outer.push(ptAt(c, rvOuter(u, deg, sys), deg));
        } else {
          inner.push(ptAt(c, lvCav(u, sys), deg));
          outer.push(ptAt(c, lvOuter(u, sys), deg));
        }
      }
      rings.push({ inner, outer });
    }
    return rings;
  }

  const morphs = []; // every mesh that follows ventricular contraction
  const atrialMorphs = []; // ...and every mesh that follows atrial contraction

  function addVentricle(kind, sector, target, mats) {
    const mesh = bandMesh(
      ventricleRings(kind, sector, false),
      ventricleRings(kind, sector, true),
      mats,
      { capBottom: kind === 'rv', capTop: true },
    );
    target.add(mesh);
    morphs.push(mesh);
    return mesh;
  }

  const lvBack = addVentricle('lv', LV_BACK, shellBack, coreMats);
  const lvLid = addVentricle('lv', LV_LID, lid, lidMats);
  const rvBack = addVentricle('rv', RV_BACK, shellBack, coreMats);
  const rvLid = addVentricle('rv', RV_LID, lid, lidMats);

  // ---- the fibrous skeleton: one plate, three holes --------------------------
  // The cardiac skeleton is three tendinous rings and the trigones between
  // them, not a saucer. A single elliptical plate cut the organ in half
  // visually: the cutaway read as two cups sitting on a dish on two legs.
  const plateGroup = new THREE.Group();
  shellBack.add(plateGroup);
  // the valves and their rigging come off as one lid so step 4 can look
  // straight down the ventricles' bore
  const topGroup = new THREE.Group();
  interior.add(topGroup);
  const annulusRing = (an, w) => {
    const [hx, hz, hr] = an;
    const shape = new THREE.Shape();
    shape.absellipse(hx, hz, hr + w, (hr + w) * AP, 0, TAU, false);
    const hole = new THREE.Path();
    hole.absellipse(hx, hz, hr, hr * AP, 0, TAU, true);
    shape.holes.push(hole);
    const mesh = new THREE.Mesh(
      new THREE.ExtrudeGeometry(shape, {
        depth: PLATE_T,
        bevelEnabled: true,
        bevelThickness: 0.012,
        bevelSize: 0.012,
        bevelSegments: 2,
        curveSegments: 48,
      }),
      matFibrous,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.y = PLATE_Y;
    mesh.castShadow = true;
    mesh.receiveShadow = true;
    plateGroup.add(mesh);
    return mesh;
  };
  const plate = annulusRing(AN_T, 0.12);
  annulusRing(AN_M, 0.12);
  annulusRing(AN_A, 0.1);

  // ---- valves ---------------------------------------------------------------
  const valves = new THREE.Group();
  topGroup.add(valves);
  const avLeaflets = [];
  const slLeaflets = [];

  // mitral: two cusps, the anterior one much the larger
  const mitralAnt = leafletMesh(AN_M, PLATE_Y - PLATE_T, 20, 200, matLeaflet, {
    len: 0.5,
    sag: 0.4,
  });
  const mitralPost = leafletMesh(AN_M, PLATE_Y - PLATE_T, 200, 380, matLeaflet, {
    len: 0.42,
    sag: 0.4,
  });
  // tricuspid: three
  const tri = [0, 1, 2].map((i) =>
    leafletMesh(AN_T, PLATE_Y - PLATE_T, i * 120, (i + 1) * 120, matLeaflet, {
      len: 0.44,
      sag: 0.36,
    }),
  );
  // semilunars: three pockets each, standing up in the artery
  const aortic = [0, 1, 2].map((i) =>
    leafletMesh(AN_A, PLATE_Y + 0.02, i * 120, (i + 1) * 120, matLeaflet, {
      up: true,
      len: 0.24,
      sag: 0.5,
    }),
  );
  const pulmonary = [0, 1, 2].map((i) =>
    leafletMesh(AN_P, AN_P_Y, i * 120, (i + 1) * 120, matLeaflet, {
      up: true,
      len: 0.19,
      sag: 0.5,
    }),
  );
  avLeaflets.push(mitralAnt, mitralPost, ...tri);
  slLeaflets.push(...aortic, ...pulmonary);
  for (const m of [...avLeaflets, ...slLeaflets]) valves.add(m);

  // the pulmonary annulus needs a collar to stand on once the infundibulum has
  // been lifted away with the rest of the anterior shell
  const pulmCollar = new THREE.Mesh(
    new THREE.CylinderGeometry(AN_P[2] + 0.02, AN_P[2] + 0.04, 0.07, 40, 1, true),
    matEpi,
  );
  pulmCollar.position.set(AN_P[0], AN_P_Y - 0.045, AN_P[1]);
  pulmCollar.scale.z = AP;
  valves.add(pulmCollar);

  // ---- papillary muscles + chordae tendineae ---------------------------------
  const rig = new THREE.Group();
  topGroup.add(rig);
  const papGeo = new THREE.ConeGeometry(0.115, 1, 20, 1);
  papGeo.translate(0, -0.5, 0); // tip at the origin, base hanging below

  // [wall angle, height fraction, which leaflet arc it holds]
  const papSpecs = [
    { deg: 40, u: 0.44, leaf: mitralAnt, ss: [0.14, 0.29, 0.43, 0.57, 0.71, 0.86], chamber: 'lv' },
    { deg: 300, u: 0.42, leaf: mitralPost, ss: [0.14, 0.29, 0.43, 0.57, 0.71, 0.86], chamber: 'lv' },
    { deg: 150, u: 0.4, leaf: tri[1], ss: [0.22, 0.4, 0.58, 0.76], chamber: 'rv' },
  ];
  const chordaGeo = new THREE.CylinderGeometry(0.009, 0.009, 1, 7);
  const papillaries = papSpecs.map((spec) => {
    const mesh = new THREE.Mesh(papGeo, matEndo);
    mesh.castShadow = true;
    rig.add(mesh);
    const chordae = spec.ss.map(() => {
      const c = new THREE.Mesh(chordaGeo, matChorda);
      c.castShadow = true;
      rig.add(c);
      return c;
    });
    // the root sits on the chamber wall and rides it in and out with the squeeze
    const root = (sys) =>
      spec.chamber === 'lv'
        ? new THREE.Vector3(...lvCavPt(spec.u, spec.deg, 0.98, sys))
        : new THREE.Vector3(...rvCavPt(spec.u, spec.deg, 0.92, sys));
    return { spec, mesh, chordae, root };
  });

  // ---- great vessels ---------------------------------------------------------
  // A truncated great vessel ends as a CUT: a rim of wall thickness with a dark
  // lumen set back behind it. Rounded sphere caps turned every one of them into
  // a sausage, which is the single fastest way to make an organ read as a toy.
  const matLumen = new THREE.MeshStandardMaterial({
    color: 0x40191b,
    roughness: 0.92,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const rimMats = new Map();
  const capAt = (pts, endIdx, r, mat) => {
    if (!rimMats.has(mat)) {
      const c = mat.clone();
      c.side = THREE.DoubleSide;
      rimMats.set(mat, c);
    }
    const a = new THREE.Vector3(...pts[endIdx]);
    const b = new THREE.Vector3(...pts[endIdx === 0 ? 1 : endIdx - 1]);
    const dir = a.clone().sub(b).normalize();
    const q = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 0, 1), dir);
    const rim = new THREE.Mesh(new THREE.RingGeometry(r * 0.82, r, 36), rimMats.get(mat));
    rim.quaternion.copy(q);
    rim.position.copy(a);
    const lum = new THREE.Mesh(new THREE.CircleGeometry(r * 0.83, 36), matLumen);
    lum.quaternion.copy(q);
    lum.position.copy(a).addScaledVector(dir, -Math.min(0.06, r * 0.3));
    vessels.add(rim, lum);
    return rim;
  };
  const vessel = (pts, r, mat, opts = {}) => {
    const m = tubeAlong(pts, r, mat, { tubularSegments: 56, radialSegments: 16, ...opts });
    vessels.add(m);
    return m;
  };

  const aortaPts = [
    [AN_A[0], PLATE_Y + 0.02, AN_A[1]],
    [-0.24, 2.2, 0.04],
    [-0.22, 2.72, -0.14],
    [-0.02, 3.12, -0.36],
    [0.36, 3.06, -0.56],
    [0.5, 2.6, -0.74],
    [0.5, 1.9, -0.8],
    [0.48, 1.15, -0.8],
  ];
  const aorta = vessel(aortaPts, 0.3, matArteryWall);
  capAt(aortaPts, aortaPts.length - 1, 0.3, matArteryWall);
  // the aortic root sinuses — the three bulges the coronary arteries leave from
  const sinuses = new THREE.Mesh(new THREE.SphereGeometry(0.25, 28, 20), matArteryWall);
  sinuses.scale.set(1, 0.72, AP);
  sinuses.position.set(AN_A[0] - 0.02, PLATE_Y + 0.24, AN_A[1] + 0.01);
  sinuses.castShadow = true;
  vessels.add(sinuses);

  const branches = [
    [[[-0.05, 3.1, -0.32], [-0.13, 3.34, -0.34], [-0.16, 3.5, -0.32]], 0.1],
    [[[0.14, 3.14, -0.42], [0.15, 3.38, -0.46], [0.16, 3.54, -0.46]], 0.07],
    [[[0.32, 3.06, -0.5], [0.39, 3.28, -0.55], [0.44, 3.44, -0.57]], 0.08],
  ];
  for (const [pts, r] of branches) {
    vessel(pts, r, matArteryWall, { tubularSegments: 40, radialSegments: 14 });
    capAt(pts, pts.length - 1, r, matArteryWall);
  }

  const paTrunkPts = [
    [AN_P[0], AN_P_Y - 0.02, AN_P[1]],
    [0.0, 2.4, 0.44],
    [0.12, 2.72, 0.14],
    [0.16, 2.88, -0.06],
  ];
  vessel(paTrunkPts, 0.24, matArteryWall);
  const paRightPts = [
    [0.1, 2.88, -0.08],
    [-0.45, 2.82, -0.2],
    [-1.02, 2.72, -0.32],
  ];
  const paLeftPts = [
    [0.2, 2.88, -0.08],
    [0.66, 2.86, -0.24],
    [1.06, 2.78, -0.44],
  ];
  vessel(paRightPts, 0.16, matArteryWall, { tubularSegments: 40, radialSegments: 16 });
  vessel(paLeftPts, 0.16, matArteryWall, { tubularSegments: 40, radialSegments: 16 });
  capAt(paRightPts, 2, 0.16, matArteryWall);
  capAt(paLeftPts, 2, 0.16, matArteryWall);

  const svcPts = [
    [-1.02, 3.22, -0.26],
    [-0.99, 2.8, -0.22],
    [-0.96, 2.36, -0.18],
  ];
  vessel(svcPts, 0.2, matVeinWall, { tubularSegments: 40, radialSegments: 16 });
  capAt(svcPts, 0, 0.2, matVeinWall);
  const ivcPts = [
    [-0.78, 1.06, -1.38],
    [-0.86, 1.62, -1.1],
    [-0.93, 2.0, -0.68],
    [-0.95, 2.18, -0.42],
  ];
  vessel(ivcPts, 0.24, matVeinWall, { tubularSegments: 40, radialSegments: 16 });
  capAt(ivcPts, 0, 0.24, matVeinWall);

  const pvPts = [
    [[-0.4, 2.3, -0.92], [-0.1, 2.28, -0.7], [0.06, 2.26, -0.6]],
    [[-0.36, 1.98, -0.96], [-0.06, 1.98, -0.72], [0.08, 1.98, -0.62]],
    [[0.86, 2.32, -0.86], [0.58, 2.3, -0.68], [0.46, 2.28, -0.58]],
    [[0.88, 2.0, -0.9], [0.6, 2.0, -0.7], [0.48, 2.0, -0.6]],
  ];
  for (const pts of pvPts) {
    vessel(pts, 0.12, matVeinWall, { tubularSegments: 36, radialSegments: 14 });
    capAt(pts, 0, 0.12, matVeinWall);
  }

  // the RV outflow tract: a muscular funnel that arcs anteriorly over the
  // aortic root, which is why the pulmonary valve ends up in FRONT of and
  // above the aortic one instead of beside it
  const infundibulum = tubeAlong(
    [
      [...rvCavPt(0.94, 96, 0.5)],
      [-0.28, 1.86, 0.72],
      [AN_P[0], AN_P_Y - 0.04, AN_P[1]],
    ],
    0.26,
    lidMats[0],
    { tubularSegments: 40, radialSegments: 20 },
  );
  lid.add(infundibulum);

  // ---- atria -----------------------------------------------------------------
  // Thin-walled reservoirs, not pumps: they add the last 20-30% of filling and
  // then get out of the way. 2.5 mm of wall against the ventricle's 10.
  const A_LEVELS = 26;
  const RA_R = tbl([
    [0, 0.54],
    [0.2, 0.5],
    [0.52, 0.48],
    [0.76, 0.42],
    [0.91, 0.27],
    [1, 0.1],
  ]);
  const LA_R = tbl([
    [0, 0.52],
    [0.2, 0.48],
    [0.52, 0.46],
    [0.76, 0.4],
    [0.91, 0.25],
    [1, 0.09],
  ]);
  function atriumRings(spec, sector, sys) {
    const [a0, a1] = sector;
    const n = Math.max(2, Math.round((a1 - a0) / ANG_STEP) + 1);
    const rings = [];
    for (let i = 0; i < A_LEVELS; i++) {
      const v = i / (A_LEVELS - 1);
      const r = spec.prof(v) * (sys ? 0.86 : 1);
      const wall = spec.wall * (sys ? 1.3 : 1);
      const c = [spec.cx + spec.lean[0] * v, spec.y0 + (spec.y1 - spec.y0) * v, spec.cz + spec.lean[1] * v];
      const inner = [];
      const outer = [];
      for (let j = 0; j < n; j++) {
        const deg = a0 + ((a1 - a0) * j) / (n - 1);
        inner.push(ptAt(c, r, deg));
        outer.push(ptAt(c, r + wall, deg));
      }
      rings.push({ inner, outer });
    }
    return rings;
  }
  const raSpec = { cx: -0.86, cz: -0.12, y0: 1.66, y1: 2.42, prof: RA_R, wall: 0.05, lean: [-0.06, -0.08] };
  const laSpec = { cx: 0.14, cz: -0.28, y0: 1.66, y1: 2.36, prof: LA_R, wall: 0.055, lean: [0.06, -0.08] };
  function addAtrium(spec, sector, target, mats) {
    const mesh = bandMesh(atriumRings(spec, sector, false), atriumRings(spec, sector, true), mats, {
      capBottom: true,
      capTop: true,
    });
    target.add(mesh);
    atrialMorphs.push(mesh);
    return mesh;
  }
  const raBack = addAtrium(raSpec, LV_BACK, atriaGroup, coreMats);
  addAtrium(raSpec, LV_LID, atriaGroup, lidMats);
  const laBack = addAtrium(laSpec, LV_BACK, atriaGroup, coreMats);
  addAtrium(laSpec, LV_LID, atriaGroup, lidMats);

  // the auricles (atrial appendages) — the two crinkled ear-flaps that are the
  // only part of either atrium you can see from the front
  const auricles = new THREE.Group();
  atriaGroup.add(auricles);
  // Flattened fingers half-buried in the atrium, not spheres bolted to the
  // outside: a stack of lobes read as growths, and an auricle is a flap.
  const auricle = (pos, dir, len, r, flat, mat) => {
    const m = new THREE.Mesh(new THREE.CapsuleGeometry(r, len, 6, 20), mat);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3(...dir).normalize());
    m.position.set(...pos);
    m.scale.set(1, 1, flat);
    m.castShadow = true;
    auricles.add(m);
    return m;
  };
  auricle([-0.66, 2.16, 0.26], [0.78, -0.12, 0.62], 0.44, 0.15, 0.62, lidMats[0]);
  auricle([0.6, 2.0, 0.14], [0.22, -0.32, 0.92], 0.36, 0.115, 0.66, lidMats[0]);

  // ---- coronary arteries + the fat that hides them ---------------------------
  const coronaries = new THREE.Group();
  lid.add(coronaries);
  const grooveTop = 1.66;
  // the LAD runs the anterior interventricular groove — the seam between the
  // two ventricles, which is exactly where the crescent pinches out
  const ladPts = [];
  for (let i = 0; i <= 10; i++) {
    const u = 0.96 - i * 0.078;
    const c = lvCentre(u, false);
    const p = ptAt(c, lvOuter(u, false) + 0.03, RV_SPAN[0] + 2);
    ladPts.push([p[0], p[1], p[2]]);
  }
  ladPts.unshift([AN_A[0] + 0.14, PLATE_Y + 0.1, AN_A[1] + 0.24]);
  const lad = tubeAlong(ladPts, 0.045, matCoronary, { tubularSegments: 90, radialSegments: 12 });
  coronaries.add(lad);
  // the circumflex sweeps the left atrioventricular groove
  const cxPts = [];
  for (let i = 0; i <= 12; i++) {
    const deg = 50 - i * 21;
    const c = lvCentre(0.97, false);
    const p = ptAt(c, lvOuter(0.97, false) + 0.04, deg);
    cxPts.push([p[0], grooveTop, p[2]]);
  }
  cxPts.unshift([AN_A[0] + 0.16, PLATE_Y + 0.08, AN_A[1] + 0.2]);
  const circumflex = tubeAlong(cxPts, 0.04, matCoronary, { tubularSegments: 80, radialSegments: 12 });
  coronaries.add(circumflex);
  // the RCA runs the right atrioventricular groove and turns down the back
  const rcaPts = [[AN_A[0] - 0.16, PLATE_Y + 0.08, AN_A[1] + 0.16]];
  for (let i = 0; i <= 10; i++) {
    const deg = 100 + i * 15;
    const c = lvCentre(0.97, false);
    const p = ptAt(c, rvOuter(0.97, deg, false) + 0.04, deg);
    rcaPts.push([p[0], grooveTop, p[2]]);
  }
  for (let i = 1; i <= 6; i++) {
    const u = 0.94 - i * 0.115;
    const c = lvCentre(u, false);
    const p = ptAt(c, lvOuter(u, false) + 0.03, RV_SPAN[1] - 2);
    rcaPts.push([p[0], p[1], p[2]]);
  }
  const rca = tubeAlong(rcaPts, 0.045, matCoronary, { tubularSegments: 110, radialSegments: 12 });
  coronaries.add(rca);
  // the coronary sinus — the vein that takes the used blood straight back into
  // the right atrium, a centimetre from where it started
  const csPts = [];
  for (let i = 0; i <= 8; i++) {
    const deg = 200 + i * 14;
    const c = lvCentre(0.99, false);
    const p = ptAt(c, lvOuter(0.99, false) + 0.05, deg);
    csPts.push([p[0], grooveTop - 0.06, p[2]]);
  }
  const coronarySinus = tubeAlong(csPts, 0.06, matCorVein, {
    tubularSegments: 60,
    radialSegments: 12,
  });
  shellBack.add(coronarySinus);

  const fatGeo = new THREE.SphereGeometry(0.075, 16, 12);
  for (let i = 0; i < 26; i++) {
    const deg = -34 + i * 11.5;
    const c = lvCentre(0.97, false);
    const r = deg > RV_SPAN[0] && deg < RV_SPAN[1] ? rvOuter(0.97, deg, false) : lvOuter(0.97, false);
    const p = ptAt(c, r - 0.015, deg);
    const f = new THREE.Mesh(fatGeo, matFat);
    f.position.set(p[0], grooveTop + 0.02 + ((i % 3) - 1) * 0.03, p[2]);
    f.scale.set(1.5, 0.62, 0.75);
    f.rotation.y = -deg * D2R;
    f.castShadow = true;
    coronaries.add(f);
  }

  // ---- the conduction system --------------------------------------------------
  // Twelve short runs, each with its OWN material, so the wave can be lit
  // segment by segment: the whole point is the ORDER, and the 0.1 s the AV node
  // spends holding the signal back before it lets the ventricles have it.
  const wiring = new THREE.Group();
  interior.add(wiring);
  const wireSegs = [];
  const addWire = (pts, r, on, off, opts = {}) => {
    const mat = new THREE.MeshStandardMaterial({
      color: 0xffc46b,
      emissive: new THREE.Color(0xffb44a),
      emissiveIntensity: 0,
      roughness: 0.4,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const mesh =
      opts.node === true
        ? new THREE.Mesh(new THREE.SphereGeometry(r, 18, 14), mat)
        : tubeAlong(pts, r, mat, { tubularSegments: 40, radialSegments: 10 });
    if (opts.node === true) mesh.position.set(...pts[0]);
    wiring.add(mesh);
    wireSegs.push({ mesh, mat, on, off });
    return mesh;
  };

  const saPos = [-1.0, 2.34, -0.02];
  const avPos = [-0.5, 1.86, -0.16];
  const saNode = addWire([saPos], 0.075, 0.0, 0.1, { node: true });
  addWire([saPos, [-0.9, 2.16, 0.16], [-0.78, 1.94, 0.12]], 0.022, 0.0, 0.08);
  addWire([saPos, [-0.86, 2.2, -0.34], [-0.66, 1.96, -0.3]], 0.022, 0.01, 0.09);
  addWire([saPos, [-0.72, 2.06, -0.28], [-0.3, 1.92, -0.34], [0.16, 2.06, -0.3]], 0.022, 0.01, 0.09);
  addWire([[-0.78, 1.94, 0.12], avPos], 0.022, 0.05, 0.1);
  const avNode = addWire([avPos], 0.065, P_AV_HOLD_A, P_AV_HOLD_B, { node: true });
  const his = addWire([avPos, [-0.36, 1.72, -0.1], [-0.3, 1.56, -0.06]], 0.028, 0.15, 0.18);
  // the bundle branches run down both faces of the septum, which is the LV's
  // own wall — so they are drawn on the LV outer surface at the septal angle
  const septalPath = (deg, off) => {
    const pts = [];
    for (let i = 0; i <= 7; i++) {
      const u = 0.9 - i * 0.115;
      const c = lvCentre(u, false);
      const p = ptAt(c, (deg === 180 ? lvOuter(u, false) : lvCav(u, false)) + off, deg);
      pts.push([p[0], p[1], p[2]]);
    }
    return pts;
  };
  const lbb = addWire([[-0.3, 1.56, -0.06], ...septalPath(200, 0.02)], 0.024, 0.18, 0.22);
  const rbb = addWire([[-0.3, 1.56, -0.06], ...septalPath(180, 0.03)], 0.024, 0.18, 0.22);
  const purkinje = [];
  for (const deg of [250, 300, 340, 30]) {
    const pts = [];
    for (let i = 0; i <= 6; i++) {
      const u = 0.05 + i * 0.115;
      const c = lvCentre(u, false);
      const p = ptAt(c, lvCav(u, false) - 0.015, deg + i * 3);
      pts.push([p[0], p[1], p[2]]);
    }
    purkinje.push(addWire(pts, 0.016, 0.21, 0.26));
  }

  // ---- blood ------------------------------------------------------------------
  // The colours are the mapmaker's convention, not the truth, and step 3 says
  // so: deoxygenated blood is dark maroon, never blue.
  const VENOUS = 0x4f7fd0;
  const ARTERIAL = 0xe2453f;
  const dotGeo = new THREE.SphereGeometry(0.04, 12, 9);
  const bloodGroup = new THREE.Group();
  heart.add(bloodGroup);
  const streams = [];
  function stream(pts, color, count, opts = {}) {
    const curve = new THREE.CatmullRomCurve3(
      pts.map((p) => new THREE.Vector3(...p)),
      false,
      'catmullrom',
      0.4,
    );
    const mat = materials.glow(color, 1.4);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    const g = new THREE.Group();
    const dots = [];
    for (let i = 0; i < count; i++) {
      const d = new THREE.Mesh(dotGeo, mat);
      d.scale.setScalar(opts.size ?? 1);
      g.add(d);
      dots.push(d);
    }
    bloodGroup.add(g);
    const s = { curve, mat, dots, gate: opts.gate ?? null, group: g };
    streams.push(s);
    return s;
  }
  // gate windows: which slice of the beat this leg is actually flowing in
  const gateFill = (b) =>
    Math.max(ramp(b, P_AV_OPEN, P_AV_OPEN + 0.08), 1 - ramp(b, P_AV_SHUT - 0.06, P_AV_SHUT));
  const gateEject = (b) => ramp(b, P_SL_OPEN, P_SL_OPEN + 0.05) * (1 - ramp(b, P_SL_SHUT - 0.04, P_SL_SHUT));

  stream([[-1.02, 3.2, -0.26], [-0.98, 2.72, -0.2], [-0.95, 2.3, -0.16], [-0.95, 2.06, -0.14]], VENOUS, 6);
  stream([[-0.78, 1.08, -1.36], [-0.87, 1.66, -1.06], [-0.94, 2.0, -0.66], [-0.95, 2.1, -0.3]], VENOUS, 6);
  stream(
    [
      [-0.95, 2.1, -0.14],
      [AN_T[0], PLATE_Y - 0.02, AN_T[1]],
      [...rvCavPt(0.86, 190, 0.5)],
      [...rvCavPt(0.55, 175, 0.5)],
      [...rvCavPt(0.34, 160, 0.5)],
    ],
    VENOUS,
    7,
    { gate: gateFill },
  );
  stream(
    [
      [...rvCavPt(0.4, 150, 0.5)],
      [...rvCavPt(0.8, 120, 0.5)],
      [...rvCavPt(0.94, 96, 0.5)],
      [-0.28, 1.86, 0.72],
      [AN_P[0], AN_P_Y + 0.02, AN_P[1]],
      [0.0, 2.4, 0.44],
      [0.14, 2.8, 0.04],
      [0.16, 2.88, -0.07],
    ],
    VENOUS,
    8,
    { gate: gateEject },
  );
  stream([[0.14, 2.88, -0.08], [-0.45, 2.82, -0.2], [-1.02, 2.72, -0.32]], VENOUS, 5, {
    gate: gateEject,
  });
  stream([[0.18, 2.88, -0.08], [0.66, 2.86, -0.24], [1.06, 2.78, -0.44]], VENOUS, 5, {
    gate: gateEject,
  });
  for (const pts of pvPts) stream([...pts, [0.24, 2.1, -0.3]], ARTERIAL, 3);
  stream(
    [
      [0.24, 2.14, -0.3],
      [AN_M[0], PLATE_Y - 0.04, AN_M[1]],
      [...lvCavPt(0.78, 330, 0.5)],
      [...lvCavPt(0.46, 300, 0.45)],
      [...lvCavPt(0.24, 270, 0.4)],
    ],
    ARTERIAL,
    7,
    { gate: gateFill },
  );
  stream(
    [
      [...lvCavPt(0.24, 250, 0.4)],
      [...lvCavPt(0.5, 200, 0.5)],
      [...lvCavPt(0.86, 170, 0.4)],
      [AN_A[0], PLATE_Y + 0.06, AN_A[1]],
      [-0.24, 2.2, 0.04],
      [-0.22, 2.72, -0.14],
      [-0.02, 3.12, -0.36],
      [0.36, 3.06, -0.56],
      [0.5, 2.6, -0.74],
      [0.5, 1.9, -0.8],
      [0.48, 1.2, -0.8],
    ],
    ARTERIAL,
    12,
    { gate: gateEject },
  );
  for (const [pts] of branches)
    stream([[pts[0][0], pts[0][1] - 0.1, pts[0][2]], ...pts], ARTERIAL, 3, { gate: gateEject });

  // coronary flow gets its own stream set — and its own group, because it is
  // the one circuit that runs on a step where the rest of the blood is off
  const corGroup = new THREE.Group();
  heart.add(corGroup);
  const corStreams = [];
  for (const [src, n] of [
    [ladPts, 9],
    [rcaPts, 11],
    [cxPts, 8],
  ]) {
    const curve = new THREE.CatmullRomCurve3(
      src.map((p) => new THREE.Vector3(...p)),
      false,
      'catmullrom',
      0.4,
    );
    const mat = materials.glow(0xffb0a0, 1.6);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    const dots = [];
    for (let i = 0; i < n; i++) {
      const d = new THREE.Mesh(dotGeo, mat);
      // deliberately FATTER than the 4.5 mm artery they ride: a bead visibly
      // proud of the vessel, not a dot sealed invisibly inside an opaque tube
      d.scale.setScalar(1.5);
      corGroup.add(d);
      dots.push(d);
    }
    corStreams.push({ curve, mat, dots });
  }

  // ---- callouts ---------------------------------------------------------------
  const labels = calloutSets([
    'exterior',
    'chambers',
    'circuit',
    'walls',
    'valves',
    'chordae',
    'wiring',
    'coronary',
  ]);
  const surfLV = (u, deg, off = 0.04) => {
    const p = ptAt(lvCentre(u, false), lvOuter(u, false) + off, deg);
    return [p[0], p[1], p[2]];
  };
  const surfRV = (u, deg, off = 0.04) => {
    const p = ptAt(lvCentre(u, false), rvOuter(u, deg, false) + off, deg);
    return [p[0], p[1], p[2]];
  };

  labels.add('exterior', heart, 'Aorta', [0.0, 3.08, -0.42], 55, 68);
  labels.add('exterior', heart, 'Pulmonary trunk', [0.02, 2.5, 0.34], 12, 96);
  labels.add('exterior', heart, 'Superior vena cava', [-1.0, 3.02, -0.24], 128, 64);
  labels.add('exterior', heart, 'Right atrium', [-0.9, 2.08, 0.3], 40, 104);
  labels.add('exterior', heart, 'Right ventricle', surfRV(0.44, 104), 20, 150);
  labels.add('exterior', heart, 'Left ventricle', surfLV(0.34, 352), 6, 78);
  labels.add('exterior', heart, 'Left anterior descending', ladPts[5], 320, 86);

  labels.add('chambers', heart, 'Right atrium', [-0.9, 2.36, -0.1], 122, 60);
  labels.add('chambers', heart, 'Left atrium', [0.28, 2.34, -0.36], 46, 72);
  labels.add('chambers', heart, 'Right ventricle', rvCavPt(0.5, 175, 0.5), 12, 152);
  labels.add('chambers', heart, 'Left ventricle', lvCavPt(0.46, 300, 0.4), 330, 76);
  labels.add('chambers', heart, 'Interventricular septum', surfLV(0.5, 190, 0.01), 350, 172);

  labels.add('circuit', heart, 'From the body', [-1.0, 3.06, -0.26], 30, 124);
  labels.add('circuit', heart, 'To the lungs', [0.9, 2.82, -0.36], 34, 66);
  labels.add('circuit', heart, 'From the lungs', [-0.32, 2.28, -0.9], 168, 62);
  labels.add('circuit', heart, 'To the body', [0.0, 3.12, -0.36], 62, 74);

  // anchored INSIDE the two cut faces, which is the only place the ratio is
  // actually visible — mid-wall at the LV's cut (180deg) and the RV's (170deg)
  labels.add('walls', heart, 'Left ventricle wall — 10 mm', surfLV(1, 330, -0.092), 18, 96);
  labels.add('walls', heart, 'Right ventricle wall — 3 mm', surfRV(1, 200, -0.035), 6, 152);
  labels.add('walls', heart, 'Septum — the LV wall doing double duty', surfLV(1, 170, -0.092), 62, 104);

  labels.add('valves', heart, 'Tricuspid — 3 flaps', [AN_T[0], PLATE_Y + 0.02, AN_T[1]], 24, 128);
  labels.add('valves', heart, 'Mitral — 2 flaps', [AN_M[0], PLATE_Y + 0.02, AN_M[1]], 12, 80);
  labels.add('valves', heart, 'Aortic valve', [AN_A[0], PLATE_Y + 0.1, AN_A[1]], 84, 60);
  labels.add('valves', heart, 'Pulmonary valve', [AN_P[0], AN_P_Y + 0.1, AN_P[1]], 46, 76);

  labels.add('chordae', heart, 'Mitral leaflet', [AN_M[0] + 0.1, PLATE_Y - 0.3, AN_M[1] + 0.1], 30, 82);
  labels.add('chordae', heart, 'Chordae tendineae', lvCavPt(0.62, 20, 0.62), 8, 76);
  labels.add('chordae', heart, 'Papillary muscle', lvCavPt(0.4, 40, 0.62), 336, 84);

  labels.add('wiring', heart, 'SA node — the pacemaker', saPos, 20, 152);
  labels.add('wiring', heart, 'AV node — the 0.1 s stall', avPos, 35, 114);
  labels.add('wiring', heart, 'Bundle of His', [-0.32, 1.58, -0.06], 330, 122);
  labels.add('wiring', heart, 'Purkinje fibres', lvCavPt(0.16, 300, 0.85), 300, 78);

  labels.add('coronary', heart, 'Left anterior descending', ladPts[4], 320, 90);
  labels.add('coronary', heart, 'Right coronary artery', rcaPts[6], 140, 78);
  labels.add('coronary', heart, 'Coronary sinus', csPts[4], 214, 72);

  // ---- pose -------------------------------------------------------------------
  const state = {
    beat: 0,
    lid: 1,
    reveal: 0,
    flow: 0,
    xray: 0,
    wire: 0,
    atria: 1,
    vess: 1,
    top: 1,
    cor: 0,
    spin: 0,
  };
  const UP = new THREE.Vector3(0, 1, 0);
  const tmpA = new THREE.Vector3();
  const tmpB = new THREE.Vector3();
  const corTarget = new THREE.Color(0xbe3b33);
  const corLit = new THREE.Color(0xff6a5a);

  function apply() {
    const b = ((state.beat % 1) + 1) % 1;

    // ventricular squeeze: fast in, slower out — muscle takes longer to let go
    const squeeze = ramp(b, P_QRS, 0.31) * (1 - ramp(b, 0.44, 0.62));
    // the atrial kick: brief, and finished before the ventricles even start
    const kick = ramp(b, P_ATRIA_ON, 0.06) * (1 - ramp(b, 0.07, P_ATRIA_OFF));
    for (const m of morphs) m.morphTargetInfluences[0] = squeeze;
    for (const m of atrialMorphs) m.morphTargetInfluences[0] = kick;

    // AV valves shut through systole; semilunars open only during ejection
    const avK = clamp01(
      ramp(b, P_AV_SHUT - 0.03, P_AV_SHUT + 0.02) - ramp(b, P_AV_OPEN - 0.03, P_AV_OPEN + 0.02),
    );
    const slK =
      1 -
      clamp01(ramp(b, P_SL_OPEN - 0.03, P_SL_OPEN + 0.02) - ramp(b, P_SL_SHUT - 0.02, P_SL_SHUT + 0.02));
    for (const m of avLeaflets) m.morphTargetInfluences[0] = avK;
    for (const m of slLeaflets) m.morphTargetInfluences[0] = slK;

    // papillary muscles ride the wall in and out, shorten as they pull, and
    // keep every chorda taut from tip to free edge
    if (state.reveal > 0.5 && state.top > 0.5)
      for (const p of papillaries) {
      tmpA.copy(p.root(false)).lerp(p.root(true), squeeze);
      const ann = p.spec.chamber === 'lv' ? AN_M : AN_T;
      tmpB.set(ann[0], PLATE_Y - 0.42, ann[1]).sub(tmpA).normalize();
      const len = 0.44 - 0.09 * squeeze;
      const tipX = tmpA.x + tmpB.x * len;
      const tipY = tmpA.y + tmpB.y * len;
      const tipZ = tmpA.z + tmpB.z * len;
      p.mesh.position.set(tipX, tipY, tipZ);
      p.mesh.quaternion.setFromUnitVectors(UP, tmpB);
      p.mesh.scale.set(1 - 0.12 * squeeze, len, 1 - 0.12 * squeeze);
      p.chordae.forEach((ch, i) => {
        const end = p.spec.leaf.userData.freeEdge(p.spec.ss[i], avK);
        const dx = end.x - tipX;
        const dy = end.y - tipY;
        const dz = end.z - tipZ;
        const l = Math.hypot(dx, dy, dz) || 1e-4;
        ch.position.set(tipX + dx * 0.5, tipY + dy * 0.5, tipZ + dz * 0.5);
        tmpB.set(dx / l, dy / l, dz / l);
        ch.quaternion.setFromUnitVectors(UP, tmpB);
        ch.scale.set(1, l, 1);
      });
    }

    // the anterior half-shell: solid, a ghosted outline, or gone
    const lo = clamp01(state.lid);
    const ghosted = lo < 0.995;
    lidMats.forEach((m, i) => {
      m.opacity = lo;
      m.transparent = ghosted;
      m.depthWrite = !ghosted;
      // clearcoat renders at full strength regardless of opacity — zero it or
      // a "ghosted" shell still reads as solid lacquer
      m.clearcoat = lidBaseCoat[i] * lo;
      m.sheen = ghosted ? 0 : 0.5;
    });
    lid.visible = lo > 0.02;

    const revealed = state.reveal > 0.5;
    interior.visible = revealed;
    atriaGroup.visible = state.atria > 0.5;
    for (const g of vesselHide) g.visible = state.vess > 0.5;
    mount.visible = !revealed;
    topGroup.visible = state.top > 0.5;
    plateGroup.visible = state.top > 0.5;
    // the surface plumbing and its fat come off for the short-axis slice, so
    // nothing crosses the one face the wall ratio is read from
    coronaries.visible = lo > 0.02 && state.top > 0.5;

    // great vessels go translucent only while blood is being traced through them
    const x = clamp01(state.xray);
    for (const m of vesselMats) {
      m.opacity = 1 - 0.64 * x;
      m.transparent = x > 0.02;
      m.depthWrite = x <= 0.02;
    }

    // blood: one whole lap of every stream per cardiac cycle, so the loop wraps
    // on an identical frame. Off-phase legs dim rather than vanish — the veins
    // never actually stop, they just stop being pushed.
    const f = clamp01(state.flow);
    bloodGroup.visible = f > 0.01;
    if (f > 0.01) {
      for (const s of streams) {
        const g = s.gate ? 0.14 + 0.86 * s.gate(b) : 1;
        s.mat.opacity = f * g;
        s.dots.forEach((d, i) => {
          const t = (b + i / s.dots.length) % 1;
          s.curve.getPointAt(t, d.position);
        });
      }
    }

    // coronary flow: the muscle's own supply, throttled by its own squeeze
    const cf = clamp01(state.cor);
    corGroup.visible = cf > 0.01;
    const perfusion = 0.12 + 0.88 * (1 - squeeze);
    matCoronary.emissive.copy(corLit);
    matCoronary.emissiveIntensity = cf * perfusion * 0.5;
    matCoronary.color.copy(corTarget).lerp(corLit, cf * perfusion * 0.35);
    if (cf > 0.01)
      for (const s of corStreams) {
      s.mat.opacity = cf * perfusion;
      s.dots.forEach((d, i) => {
        d.visible = cf > 0.01;
        const t = (b * 0.6 + i / s.dots.length) % 1;
        s.curve.getPointAt(t, d.position);
      });
    }

    // the wiring, lit segment by segment in the order it actually fires
    const w = clamp01(state.wire);
    wiring.visible = w > 0.01 && revealed;
    if (wiring.visible)
      for (const seg of wireSegs) {
      const lit = ramp(b, seg.on, seg.on + 0.02) * (1 - ramp(b, seg.off, seg.off + 0.05));
      seg.mat.opacity = w * (0.22 + 0.78 * lit);
      seg.mat.emissiveIntensity = w * (0.35 + 3.4 * lit);
    }

    // the coronaries are epicardial: they sit ON the muscle, so they have to
    // move with it rather than float where the relaxed heart used to be
    const shrink = 1 - 0.05 * squeeze;
    coronaries.scale.set(shrink, 1, shrink);
    coronaries.position.y = -0.02 * squeeze;

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
      heart,
      body,
      lid,
      shellBack,
      interior,
      lvLid,
      lvBack,
      rvLid,
      rvBack,
      raBack,
      laBack,
      mitralAnt,
      mitralPost,
      tricuspid: tri,
      aortic,
      pulmonary,
      papillaries,
      saNode,
      avNode,
      his,
      lbb,
      rbb,
      purkinje,
      aorta,
      lad,
      rca,
      circumflex,
      coronarySinus,
      infundibulum,
      plate,
      auricles,
      mount,
    },
  };
}
