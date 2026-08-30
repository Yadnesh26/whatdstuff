import * as THREE from 'three';
import { materials, rod, box, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, TAU } from '../../framework/motion.js';

// A 1.5 T whole-body MRI suite as a studio product shot: the gantry, the
// patient table, and — instead of a person — the cylindrical QA phantom a
// radiographer actually scans, sitting in a slotted head receive coil. Reveal
// story: sealed scanner -> swap the covers for a sectioned shell and look into
// a sectioned cryostat
// -> the superconducting windings -> the switch that closes the loop forever
// -> the cold layers that hold 4.2 K -> the protons in the phantom -> the RF
// note that tips them -> the gradients that turn position into frequency ->
// resealed, table in, k-space filling on the console.
//
// SCALE: 1 world unit = 1 metre. Every constant below derives from it.
//   outer cover        2.00 m dia x 1.72 m long
//   patient bore       0.70 m dia            (modern wide bore)
//   gradient former    0.92 -> 1.16 m dia
//   vacuum vessel      1.20 -> 1.94 m dia
//   helium vessel      1.40 -> 1.72 m dia
//   table top          1.90 x 0.52 m, travel 1.35 m to isocentre
//   QA phantom         0.20 m dia x 0.15 m long (ACR phantom, real size)
// The one deliberate exaggeration is the gradient-coil flex in step 8: real
// deflection is a fraction of a millimetre, drawn here at ~2% so the cause of
// the noise is visible. It is called out in the step copy.
//
// The cryostat is drawn as a real SECTION rather than a ghosted x-ray of one:
// every concentric shell, and the outer cover with it, is cut over the same
// upper-front QUARTER, so looking into the notch gives the nested layer cake —
// vacuum, aluminised shield, helium vessel, windings — while the rest of the
// body stays intact and still reads as a cylinder.
//
// MECHANISM (researched — clinical superconducting scanner):
// The field comes from 6-10 COIL SECTIONS of NIOBIUM-TITANIUM microfilaments
// embedded in a COPPER STABILISER. NbTi turns superconducting below ~9.3 K and
// is run at 4.2 K, immersed in (classically) ~1,500 litres of LIQUID HELIUM;
// the newest sealed magnets get away with 7 litres and no quench pipe. The
// helium vessel hangs inside an ALUMINISED RADIATION SHIELD, which hangs
// inside a VACUUM VESSEL — vacuum kills conduction and convection, the shield
// intercepts radiation, and a CRYOCOOLER cold head on top reliquefies the
// boil-off. Outside the main windings sit counter-wound ACTIVE SHIELD COILS
// that cancel the stray field beyond the magnet.
// The magnet is RAMPED over 24-48 hours to about 500 A, then a heated
// PERSISTENT CURRENT SWITCH is allowed to cool: it goes superconducting, the
// loop closes on itself, the ramp leads come off, and the current keeps going
// round with nothing driving it. Field drift is ~0.1 ppm/hour.
// Hydrogen protons in tissue precess about that field at the LARMOR frequency,
// 42.58 MHz/T -> 63.87 MHz at 1.5 T. Thermal noise nearly cancels them out:
// the excess in the aligned state is roughly 4 per million per tesla, so about
// six protons in every million carry the entire signal. A BIRDCAGE BODY COIL
// transmits at exactly that frequency and tips the net magnetisation over; as
// it relaxes it re-radiates, and a local RECEIVE COIL listens.
// Position is encoded by three GRADIENT COILS (x, y, z) which tilt the field
// so that frequency maps to place. They carry several hundred amps switched at
// up to ~200 T/m/s inside 1.5 T, and the Lorentz force on their own windings
// hammers the former — that is the banging, over 100 dB. The measurements fill
// K-SPACE, and a 2D Fourier transform turns it into the slice.
// Sources: mriquestions.com/superconductive-design, mriquestions.com/how-to-ramp,
// arxiv.org/pdf/2205.08918 (magnet design review), philips.com BlueSeal (sealed
// 7 L magnet), radiopaedia.org (dependence of magnetisation), NCBI StatPearls
// NBK564320, cis.rit.edu/htbooks/mri chap-7 (k-space).

// --- staging -----------------------------------------------------------------
const PLINTH_H = 0.2;
const BORE_Y = 1.25; // world height of the bore axis

// --- the gantry (all radii measured from the bore axis) -----------------------
const BORE_R = 0.35;
const LINER_R = 0.355;
const RF_RUNG_R = 0.385;
const RF_SHIELD_R = 0.425;
const GRAD_RI = 0.46;
const GRAD_RO = 0.58;
const GRAD_L = 1.32;
const VAC_RI = 0.6;
const VAC_RO = 0.97;
const VAC_L = 1.66;
const SHD_RI = 0.655;
const SHD_RO = 0.9;
const SHD_L = 1.54;
const HE_RI = 0.7;
const HE_RO = 0.86;
const HE_L = 1.44;
const COIL_R = 0.765; // main winding bundle centreline
const SHIELD_COIL_R = 0.828; // counter-wound active shield
const COVER_R = 1.0;
const COVER_HL = 0.86;
const BORE_LINER_L = 1.59; // stops at the recessed bore lips

// The section wedge. CylinderGeometry theta runs x = r sin(t), z = r cos(t), so
// t = 0 is +Z (front) and t = 270 deg is world up. A quarter is removed from the
// UPPER FRONT — 285 deg round to 15 deg — leaving 270 deg of shell standing.
// A symmetric wedge about +Z was tried first: it takes out the whole
// front-facing band and the gantry stops reading as a cylinder at all, more
// like a clamshell prised apart. Taking one corner out instead keeps the body
// intact and still opens the annulus to a camera sitting ~30 deg above the
// axis, which is where every reveal step is posed.
const CUT_A = (15 * Math.PI) / 180;
const CUT_LEN = (270 * Math.PI) / 180;
// The gantry is rotated -90 deg about Z, so gantry-local (lx, ly, lz) lands at
// world (ly, BORE_Y - lx, lz): local +Y is the bore axis, local -X is world up.
// These two put a point on the UPPER or LOWER face the section knife left.
// These put a point on the UPPER face the section knife left, which is the one
// every reveal camera looks at. (The lower face is at CUT_A, but it sits at a
// grazing angle to those cameras and nothing anchors there — see the note on
// the 'Liquid helium' callout.)
const faceUp = (r, ly) => [Math.sin(CUT_A + CUT_LEN) * r, ly, Math.cos(CUT_A + CUT_LEN) * r];

// six main sections, symmetric about isocentre — wider at the ends, which is
// what flattens the field across the imaging volume
const MAIN_COILS = [
  { x: 0.09, minor: 0.062 },
  { x: -0.09, minor: 0.062 },
  { x: 0.4, minor: 0.048 },
  { x: -0.4, minor: 0.048 },
  { x: 0.645, minor: 0.058 },
  { x: -0.645, minor: 0.058 },
];

// --- table + subject ---------------------------------------------------------
const TABLE_Y = BORE_Y - 0.1;
const TABLE_X = -1.6; // parked centre of the top
const TABLE_L = 1.9;
const TABLE_W = 0.52;
const PHANTOM_X = -1.35; // parked; travels to isocentre
const TABLE_TRAVEL = -PHANTOM_X;
const PHANTOM_R = 0.1;
const PHANTOM_HL = 0.075;
const N_SPIN = 42;

const ACCENT = 0x6ec6ff;

export function buildMriMachine({ scene }) {
  const sceneGroup = new THREE.Group();
  scene.add(sceneGroup);

  // ---------------------------------------------------------------- materials
  // The covers, the table and the receive coil are the same off-white, but they
  // get separate material instances: they are shown and hidden independently.
  const coverMat = materials.polymer(0xeceef1);
  const boreMat = materials.polymer(0xc3c8d0);
  const coverTrimMat = materials.polymer(0x2a2e35);
  const tableMat = materials.polymer(0xeceef1);
  const trimMat = materials.polymer(0x2a2e35);
  const rxMat = materials.polymer(0xe4e7ec);
  // CAUTION (conventions): roughnessMap MULTIPLIES these, and the map averages
  // ~0.5 — every value here is deliberately high so the big curved vessels read
  // as brushed metal instead of chrome mirroring the softbox.
  const steelMat = materials.brushedSteel(0xb9c1cb);
  steelMat.roughness = 0.82;
  steelMat.normalScale.set(0.16, 0.16);
  const vacMat = materials.aluminum(0xa8b0ba);
  vacMat.roughness = 0.86;
  // the cast-grain normal map is authored for parts a few centimetres across;
  // on a 2 m vessel it reads as crumpled foil, so most of it comes back off
  vacMat.normalScale.set(0.08, 0.08);
  const shieldMat = materials.aluminum(0xd6bd8a); // aluminised MLI blanket
  shieldMat.roughness = 0.84;
  shieldMat.normalScale.set(0.18, 0.18); // a blanket may keep some of its crease
  const linerMat = new THREE.MeshStandardMaterial({
    color: 0x14171c,
    metalness: 0.15,
    roughness: 0.94,
    side: THREE.BackSide,
  });
  const cutMat = materials.aluminum(0x8d949e);
  cutMat.roughness = 0.92;
  const copperMat = materials.aluminum(0xc98a53);
  copperMat.roughness = 0.78;
  const epoxyMat = new THREE.MeshPhysicalMaterial({
    color: 0x323841,
    metalness: 0.1,
    roughness: 0.72,
    clearcoat: 0.2,
    clearcoatRoughness: 0.6,
  });
  const heliumMat = new THREE.MeshPhysicalMaterial({
    color: 0x9fd2ea,
    metalness: 0,
    roughness: 0.18,
    transparent: true,
    opacity: 0.3,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const glassMat = materials.glass(0xdcefff, 0.13);
  const rfMat = materials.aluminum(0xd0a06a);
  rfMat.roughness = 0.7;
  const glowMat = (c, i = 1.4) => {
    const m = materials.glow(c, i);
    m.transparent = true;
    m.depthWrite = false; // a fully-faded glow must not punch holes in the glass
    return m;
  };

  const internals = []; // everything the covers hide

  // ------------------------------------------------------------ section tools
  // A cut cylindrical skin. FrontSide shows the convex outside; the concave
  // inside of an outer skin gets its own dark liner mesh, because a DoubleSide
  // metal shell seen from within is a curved mirror and blows out.
  function skin(r, len, mat, side = THREE.FrontSide, full = false) {
    const geo = full
      ? new THREE.CylinderGeometry(r, r, len, 96, 1, true)
      : new THREE.CylinderGeometry(r, r, len, 96, 1, true, CUT_A, CUT_LEN);
    const useMat = side === THREE.FrontSide ? mat : Object.assign(mat.clone(), { side });
    const m = new THREE.Mesh(geo, useMat);
    m.castShadow = true;
    return m;
  }

  // Flip a geometry to face inward: negate the normals and reverse the winding,
  // so a tube seen from within is FrontSide with correct normals. A BackSide
  // shell renders the same pixels but hands the post stack outward-facing
  // normals, which the screen-space AO pass reads wrong.
  function inward(geo) {
    const n = geo.attributes.normal;
    for (let i = 0; i < n.count; i++) n.setXYZ(i, -n.getX(i), -n.getY(i), -n.getZ(i));
    n.needsUpdate = true;
    const idx = geo.index;
    if (idx) {
      for (let i = 0; i < idx.count; i += 3) {
        const a = idx.getX(i);
        idx.setX(i, idx.getX(i + 2));
        idx.setX(i + 2, a);
      }
      idx.needsUpdate = true;
    }
    return geo;
  }

  function boreTube(sector) {
    const geo = inward(
      sector
        ? new THREE.CylinderGeometry(LINER_R, LINER_R, BORE_LINER_L, 96, 1, true, CUT_A, CUT_LEN)
        : new THREE.CylinderGeometry(LINER_R, LINER_R, BORE_LINER_L, 96, 1, true),
    );
    const m = new THREE.Mesh(geo, boreMat);
    m.castShadow = false;
    m.receiveShadow = false;
    return m;
  }

  // Flat annular end wall of a sectioned vessel. RingGeometry lives in XY with
  // phi from +X; rotating -90 deg about X maps it to XZ as x = r cos(phi),
  // z = -r sin(phi), which matches the cylinders' x = r sin(t), z = r cos(t)
  // when phi = t - 90 deg.
  function endRing(rIn, rOut, mat) {
    const m = new THREE.Mesh(
      new THREE.RingGeometry(rIn, rOut, 96, 1, CUT_A - Math.PI / 2, CUT_LEN),
      Object.assign(mat.clone(), { side: THREE.DoubleSide }),
    );
    m.rotation.x = -Math.PI / 2;
    return m;
  }

  // The faces the section knife leaves behind. A thin-walled vessel shows two
  // wall bands per cut plane and open space between them — filling that space
  // with a solid plate walls off the very annulus the section exists to show.
  // `solid` is for genuinely solid parts, like the potted gradient former.
  function cutFaces(rIn, rOut, len, mat, { wall = 0.016, solid = false } = {}) {
    const g = new THREE.Group();
    const bands = solid
      ? [[rIn, rOut]]
      : [
          [rOut - wall, rOut],
          [rIn, rIn + wall],
        ];
    for (const t of [CUT_A, CUT_A + CUT_LEN]) {
      for (const [r0, r1] of bands) {
        const face = box(0.012, len, r1 - r0, mat);
        face.position.set((Math.sin(t) * (r0 + r1)) / 2, 0, (Math.cos(t) * (r0 + r1)) / 2);
        face.rotation.y = t;
        g.add(face);
      }
    }
    return g;
  }

  // A whole sectioned vessel: outer skin + its dark inner liner, inner skin,
  // both end walls and the two knife faces.
  function vessel({ rIn, rOut, len, mat, cut = cutMat, solid = false }) {
    const g = new THREE.Group();
    g.add(skin(rOut, len, mat));
    g.add(skin(rOut - 0.008, len, linerMat, THREE.BackSide));
    g.add(skin(rIn, len, mat));
    for (const s of [-1, 1]) {
      const cap = endRing(rIn, rOut, mat);
      cap.position.y = (s * len) / 2;
      g.add(cap);
    }
    g.add(cutFaces(rIn, rOut, len, cut, { solid }));
    return g;
  }

  // Arc of tube lying on a cylinder of radius R, same theta convention as skin.
  function arcTube(R, ly, tStart, tLen, tubeR, mat) {
    const pts = [];
    for (let i = 0; i <= 72; i++) {
      const t = tStart + (i / 72) * tLen;
      pts.push([Math.sin(t) * R, ly, Math.cos(t) * R]);
    }
    return tubeAlong(pts, tubeR, mat, { tubularSegments: 120, radialSegments: 8, tension: 0.4 });
  }

  // One coil section, drawn as a bundle helix wound round the bore axis: the
  // minor circle spans (radial, axial), which is how a real section's
  // rectangular winding pack reads when you cut it open.
  function windingArc({ R, minor, turns, mat, wire = 0.011 }) {
    const segs = Math.max(120, Math.round(turns * 16));
    const pts = [];
    for (let i = 0; i <= segs; i++) {
      const u = i / segs;
      const t = CUT_A + u * CUT_LEN;
      const a = u * turns * TAU;
      const rr = R + minor * Math.cos(a);
      pts.push(new THREE.Vector3(Math.sin(t) * rr, minor * Math.sin(a), Math.cos(t) * rr));
    }
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.3);
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, segs, wire, 8, false), mat);
    mesh.castShadow = true;
    return { mesh, curve };
  }

  // A closed saddle loop on a cylinder — two axial legs joined by two arcs.
  function saddleLoop(R, thetaC, halfTheta, ly0, ly1, tubeR, mat) {
    const pts = [];
    const push = (t, y) => pts.push([Math.sin(t) * R, y, Math.cos(t) * R]);
    for (let i = 0; i <= 14; i++) push(thetaC - halfTheta + (i / 14) * 2 * halfTheta, ly0);
    for (let i = 1; i <= 6; i++) push(thetaC + halfTheta, ly0 + (i / 6) * (ly1 - ly0));
    for (let i = 1; i <= 14; i++) push(thetaC + halfTheta - (i / 14) * 2 * halfTheta, ly1);
    for (let i = 1; i < 6; i++) push(thetaC - halfTheta, ly1 + (i / 6) * (ly0 - ly1));
    return tubeAlong(pts, tubeR, mat, {
      closed: true,
      tubularSegments: 160,
      radialSegments: 8,
      tension: 0.1,
    });
  }

  // Charge riding a closed circuit. p advances whole laps, so the wrap pose is
  // identical — the loop contract, applied to the current itself.
  function currentDots(curve, n, color) {
    const geo = new THREE.SphereGeometry(0.016, 10, 8);
    const g = new THREE.Group();
    const dots = [];
    for (let i = 0; i < n; i++) {
      const m = glowMat(color, 1.9);
      m.opacity = 0;
      dots.push(new THREE.Mesh(geo, m));
      g.add(dots[i]);
    }
    return {
      group: g,
      set(p, on) {
        dots.forEach((d, i) => {
          const t = (((p + i / n) % 1) + 1) % 1;
          d.position.copy(curve.getPointAt(t));
          d.material.opacity = on ? 0.92 : 0;
        });
      },
    };
  }

  // ------------------------------------------------------------------ plinth
  sceneGroup.add(studioPlinth({ w: 4.6, h: PLINTH_H, d: 2.4 }));

  // ============================================================================
  //  GANTRY — local +Y is the bore axis, rotated onto world +X
  // ============================================================================
  const gantry = new THREE.Group();
  gantry.position.set(0, BORE_Y, 0);
  gantry.rotation.z = -Math.PI / 2;
  sceneGroup.add(gantry);

  // --- outer cover ----------------------------------------------------------
  // Built TWICE from one profile: a full 360-degree shell for the sealed steps,
  // and a sectioned one cut over the same wedge as the cryostat for the reveal
  // steps. Ghosting a white shell to 10% opacity was tried first and reads as a
  // milky veil laid over the mechanism; a hard section is what a manufacturer's
  // cutaway actually does, and the camera flight covers the swap.
  // Half-section outline, bore lip -> front face -> body -> mirrored. The first
  // attempt curved continuously from bore to waist and rendered as a pillow; a
  // real scanner is a CYLINDER with a tight corner fillet and a flat annular
  // face, with the bore mouth set back inside a shallow dished fascia.
  const FRONT = [
    [0.362, -0.795], // bore lip, ~7 cm behind the face
    [0.378, -0.806],
    [0.404, -0.816],
    [0.446, -0.822],
    [0.5, -0.827], // floor of the fascia recess
    [0.524, -0.84],
    [0.54, -0.854],
    [0.575, -0.861],
    [0.68, -0.863], // the flat face
    [0.8, -0.863],
    [0.872, -0.858],
    [0.916, -0.845], // corner fillet starts
    [0.952, -0.824],
    [0.978, -0.796],
    [0.993, -0.762],
    [0.999, -0.724],
    [COVER_R, -0.69],
    [COVER_R, -0.452],
    [0.987, -0.444], // panel seam — a thin joint, not a waist
    [0.987, -0.416],
    [COVER_R, -0.408],
    [COVER_R, -0.02],
  ];
  const COVER_PROFILE = [
    ...FRONT,
    ...FRONT.map(([r, y]) => [r, -y]).reverse(),
  ];

  const coverSolid = new THREE.Group();
  const coverCut = new THREE.Group();
  coverCut.visible = false;
  gantry.add(coverSolid, coverCut);

  const cover = lathe(COVER_PROFILE, coverMat, 96);
  cover.receiveShadow = true;
  coverSolid.add(cover);
  // the bore itself — BackSide, so you see the far wall and look straight in
  coverSolid.add(boreTube(false));

  const coverCutShell = new THREE.Mesh(
    new THREE.LatheGeometry(
      COVER_PROFILE.map(([r, y]) => new THREE.Vector2(r, y)),
      72,
      CUT_A,
      CUT_LEN,
    ),
    coverMat,
  );
  // NOT receiveShadow: probing showed this shell was the one large pale receiver
  // in the reveal shots, and the scene-wide shadow map has far too few texels
  // across a 2 m lathe — it self-shadowed into a scalloped lattice over the
  // whole bore wall. The plinth still catches the contact shadow.
  coverCutShell.receiveShadow = false;
  coverCut.add(coverCutShell);
  coverCut.add(boreTube(true));
  // the wall thickness the knife exposes: the profile outline closed back along
  // the bore, stood up in each cut plane
  // offset the outline along its own inward normal, so the exposed edge is a
  // constant-thickness moulding that follows every curve
  const COVER_WALL = 0.03;
  const coverInner = [];
  for (let i = COVER_PROFILE.length - 1; i >= 0; i--) {
    const [r, y] = COVER_PROFILE[i];
    const prev = COVER_PROFILE[Math.max(0, i - 1)];
    const next = COVER_PROFILE[Math.min(COVER_PROFILE.length - 1, i + 1)];
    const tx = next[0] - prev[0];
    const ty = next[1] - prev[1];
    const len = Math.hypot(tx, ty) || 1;
    // rotating the tangent +90 deg gives the normal pointing into the shell
    coverInner.push([r - (ty / len) * COVER_WALL, y + (tx / len) * COVER_WALL]);
  }
  const coverFaceShape = new THREE.Shape();
  [...COVER_PROFILE, ...coverInner].forEach(([r, y], i) =>
    i ? coverFaceShape.lineTo(r, y) : coverFaceShape.moveTo(r, y),
  );
  coverFaceShape.closePath();
  for (const t of [CUT_A, CUT_A + CUT_LEN]) {
    const face = new THREE.Mesh(
      new THREE.ShapeGeometry(coverFaceShape),
      Object.assign(coverMat.clone(), { side: THREE.DoubleSide, color: coverMat.color.clone() }),
    );
    face.material.color.multiplyScalar(0.55); // a cut edge is never as bright
    face.rotation.y = t - Math.PI / 2;
    coverCut.add(face);
  }

  // lit ring and dark bezel at each bore mouth, in both variants
  const ringMats = [];
  for (const s of [-1, 1]) {
    for (const [parent, sector] of [
      [coverSolid, false],
      [coverCut, true],
    ]) {
      const mat = glowMat(ACCENT, 1.5);
      mat.opacity = 0.9;
      ringMats.push(mat);
      const bezelMat = coverTrimMat.clone();
      if (sector) {
        const ring = arcTube(0.366, s * 0.778, CUT_A, CUT_LEN, 0.007, mat);
        const bez = arcTube(0.532, s * 0.846, CUT_A, CUT_LEN, 0.011, bezelMat);
        parent.add(ring, bez);
      } else {
        const ring = new THREE.Mesh(new THREE.TorusGeometry(0.366, 0.007, 10, 96), mat);
        ring.rotation.x = Math.PI / 2;
        ring.position.y = s * 0.778;
        const bez = new THREE.Mesh(new THREE.TorusGeometry(0.532, 0.011, 12, 96), bezelMat);
        bez.rotation.x = Math.PI / 2;
        bez.position.y = s * 0.846;
        parent.add(ring, bez);
      }
    }
  }

  // front-face furniture, on the solid cover only — it all sits in the wedge
  // the section removes. Placed at azimuth ~25 deg, which is below the bore and
  // on the camera side.
  // A point at azimuth t and radius r is local (r sin t, ly, r cos t); a plate
  // whose own X must run radially is turned by (t - 90 deg).
  const onFace = (obj, r, t, ly) => {
    obj.position.set(Math.sin(t) * r, ly, Math.cos(t) * r);
    obj.rotation.y = t - Math.PI / 2;
    coverSolid.add(obj);
  };
  const keypad = beveledBox(0.24, 0.022, 0.115, coverTrimMat, 0.014);
  onFace(keypad, 0.66, 0.62, -0.856);
  const keypadLight = new THREE.Mesh(new THREE.PlaneGeometry(0.16, 0.03), glowMat(ACCENT, 1.2));
  keypadLight.material.opacity = 0.8;
  keypadLight.rotation.x = Math.PI / 2;
  onFace(keypadLight, 0.66, 0.62, -0.868);
  // the laser alignment window every scanner carries beside the bore
  const laserWin = beveledBox(0.07, 0.018, 0.045, coverTrimMat, 0.008);
  onFace(laserWin, 0.56, 0.2, -0.858);

  // ---- cryostat: the nested section ---------------------------------------
  const cryoGroup = new THREE.Group();
  gantry.add(cryoGroup);

  const vacVessel = vessel({ rIn: VAC_RI, rOut: VAC_RO, len: VAC_L, mat: vacMat });
  const shieldVessel = vessel({ rIn: SHD_RI, rOut: SHD_RO, len: SHD_L, mat: shieldMat });
  const heVessel = vessel({ rIn: HE_RI, rOut: HE_RO, len: HE_L, mat: steelMat });
  cryoGroup.add(vacVessel, shieldVessel, heVessel);

  // the helium itself, lying in the bottom of its vessel. Plain transparent,
  // NOT transmission: the windings standing in it have to show through.
  const heliumPool = new THREE.Group();
  cryoGroup.add(heliumPool);
  for (const r of [HE_RO - 0.014, HE_RI + 0.014]) {
    const wall = new THREE.Mesh(
      new THREE.CylinderGeometry(r, r, HE_L - 0.04, 64, 1, true, CUT_A, 1.9),
      heliumMat,
    );
    heliumPool.add(wall);
  }
  for (const s of [-1, 1]) {
    const face = new THREE.Mesh(
      new THREE.RingGeometry(HE_RI + 0.014, HE_RO - 0.014, 64, 1, CUT_A - Math.PI / 2, 1.9),
      heliumMat,
    );
    face.rotation.x = -Math.PI / 2;
    face.position.y = (s * (HE_L - 0.04)) / 2;
    heliumPool.add(face);
  }

  // ---- the windings --------------------------------------------------------
  const coilGroup = new THREE.Group();
  cryoGroup.add(coilGroup);
  const coilCurves = [];
  for (const c of MAIN_COILS) {
    const w = windingArc({ R: COIL_R, minor: c.minor, turns: 22, mat: copperMat });
    w.mesh.position.y = c.x;
    coilGroup.add(w.mesh);
    coilCurves.push(w.curve);
  }
  for (const s of [-1, 1]) {
    const w = windingArc({ R: SHIELD_COIL_R, minor: 0.034, turns: 16, mat: copperMat, wire: 0.009 });
    w.mesh.position.y = s * 0.52;
    coilGroup.add(w.mesh);
  }
  // the persistent current, running round the two central sections
  const flowQueues = [];
  for (const c of [coilCurves[0], coilCurves[1]]) {
    const q = currentDots(c, 10, ACCENT);
    coilGroup.add(q.group);
    flowQueues.push(q);
  }

  // ---- persistent current switch, up inside the helium vessel --------------
  const switchGroup = new THREE.Group();
  switchGroup.position.set(...faceUp(0.79, 0.245));
  cryoGroup.add(switchGroup);
  const switchBody = beveledBox(0.085, 0.11, 0.085, steelMat, 0.012);
  switchGroup.add(switchBody);
  const switchSpool = new THREE.Mesh(new THREE.TorusGeometry(0.032, 0.013, 10, 40), copperMat);
  switchSpool.position.set(0, 0, 0.052);
  switchGroup.add(switchSpool);
  const heaterBand = new THREE.Mesh(new THREE.TorusGeometry(0.046, 0.006, 8, 40), trimMat);
  heaterBand.position.set(0, 0, 0.052);
  switchGroup.add(heaterBand);
  // ramp leads, retracted — a running magnet has them off
  const leadMats = [];
  for (const s of [-1, 1]) {
    const stub = rod(0.009, 0.09, copperMat);
    stub.rotation.z = Math.PI / 2; // +Y -> -X, which is world "up"
    stub.position.set(-0.05, s * 0.035, 0.02);
    switchGroup.add(stub);
    const gapMat = glowMat(0xff8f5e, 1.1);
    gapMat.opacity = 0.55;
    const socket = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.004, 8, 24), gapMat);
    socket.rotation.y = Math.PI / 2;
    socket.position.set(-0.19, s * 0.035, 0.02);
    switchGroup.add(socket);
    leadMats.push(gapMat);
  }

  // ---- gradient former + its three coil sets -------------------------------
  const gradGroup = new THREE.Group();
  gantry.add(gradGroup);
  gradGroup.add(vessel({ rIn: GRAD_RI, rOut: GRAD_RO, len: GRAD_L, mat: epoxyMat, solid: true }));
  const gradMats = [];
  // z gradient: a counter-wound Maxwell pair — same current, opposite sense
  for (const s of [-1, 1]) {
    const w = windingArc({
      R: GRAD_RO - 0.028,
      minor: 0.019,
      turns: 12,
      mat: copperMat.clone(),
      wire: 0.008,
    });
    w.mesh.position.y = s * 0.42;
    gradGroup.add(w.mesh);
    gradMats.push(w.mesh.material);
  }
  // x and y saddle pairs, drawn as readable arc loops rather than true
  // fingerprint windings
  for (const [thetaC, ly0, ly1] of [
    [CUT_A + 0.62, 0.1, 0.5],
    [CUT_A + 0.62, -0.5, -0.1],
    [CUT_A + 3.64, 0.1, 0.5],
    [CUT_A + 3.64, -0.5, -0.1],
  ]) {
    const saddleMat = copperMat.clone();
    gradGroup.add(saddleLoop(GRAD_RO - 0.055, thetaC, 0.5, ly0, ly1, 0.007, saddleMat));
    gradMats.push(saddleMat);
  }

  // ---- RF birdcage body coil -----------------------------------------------
  const rfGroup = new THREE.Group();
  gantry.add(rfGroup);
  const rfMats = [];
  for (const s of [-1, 1]) {
    const ring = arcTube(RF_RUNG_R, s * 0.31, CUT_A, CUT_LEN, 0.009, rfMat.clone());
    rfGroup.add(ring);
    rfMats.push(ring.material);
  }
  for (let i = 0; i < 16; i++) {
    const t = CUT_A + (i / 15) * CUT_LEN;
    const rung = rod(0.007, 0.62, rfMat.clone());
    rung.position.set(Math.sin(t) * RF_RUNG_R, -0.31, Math.cos(t) * RF_RUNG_R);
    rfGroup.add(rung);
    rfMats.push(rung.material);
  }
  // the screen that keeps the birdcage from talking to the gradient coils
  rfGroup.add(skin(RF_SHIELD_R, 0.9, cutMat));
  rfGroup.add(skin(RF_SHIELD_R - 0.006, 0.9, linerMat, THREE.BackSide));

  // The transmitted pulse: thin rings running down the bore. A translucent
  // cylinder was tried first and reads as a blue haze rather than a pulse — and
  // being a full-bore transparent surface the camera sits inside, it cost more
  // fill than everything else in the frame put together.
  const rfPulse = new THREE.Group();
  gantry.add(rfPulse);
  const rfRings = [];
  const rfRingMats = [];
  for (let i = 0; i < 3; i++) {
    const mat = glowMat(ACCENT, 2.2);
    mat.opacity = 0;
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.3, 0.011, 10, 64), mat);
    ring.rotation.x = Math.PI / 2; // ring axis onto the bore axis (local +Y)
    rfPulse.add(ring);
    rfRings.push(ring);
    rfRingMats.push(mat);
  }

  for (const g of [cryoGroup, gradGroup, rfGroup]) {
    g.traverse((o) => {
      if (!o.isMesh) return;
      o.castShadow = false;
      internals.push(o);
    });
  }
  // The bore wall came out covered in a scalloped lattice of shadow acne: the
  // liner is a BackSide cylinder a few centimetres from the birdcage, and the
  // scene-wide shadow map cannot resolve anything at that spacing. Confirmed by
  // probe — disabling the shadow map alone cleared it. Nothing inside the bore
  // casts now, and the liner does not receive; the outer cover still casts onto
  // the plinth, which is the only cover shadow the shot actually needs.
  for (const o of coverCut.children) o.castShadow = false;
  for (const g of [coverSolid, coverCut]) {
    g.traverse((o) => {
      if (o.isMesh && o.material === boreMat) {
        o.castShadow = false;
        o.receiveShadow = false;
      }
    });
  }

  // ============================================================================
  //  COLD HEAD + QUENCH VENT — world space, on top of the gantry
  // ============================================================================
  const coldHead = new THREE.Group();
  coldHead.position.set(-0.42, BORE_Y + 0.93, 0);
  sceneGroup.add(coldHead);
  coldHead.add(rod(0.115, 0.2, steelMat));
  const turretCap = rod(0.095, 0.15, materials.aluminum(0xa2aab4));
  turretCap.position.y = 0.2;
  coldHead.add(turretCap);
  const headMotor = new THREE.Group();
  headMotor.position.y = 0.35;
  coldHead.add(headMotor);
  headMotor.add(rod(0.082, 0.1, trimMat));
  const motorDome = new THREE.Mesh(new THREE.SphereGeometry(0.082, 24, 12, 0, TAU, 0, 1.2), trimMat);
  motorDome.position.y = 0.1;
  headMotor.add(motorDome);
  const motorKey = beveledBox(0.05, 0.03, 0.12, steelMat, 0.008);
  motorKey.position.y = 0.125;
  headMotor.add(motorKey);
  const displacer = rod(0.028, 0.08, steelMat);
  displacer.position.set(0.062, 0.24, 0);
  coldHead.add(displacer);

  const ventPipe = tubeAlong(
    [
      [-0.42, BORE_Y + 1.02, -0.04],
      [-0.42, BORE_Y + 1.14, -0.14],
      [-0.42, BORE_Y + 1.2, -0.32],
      [-0.42, BORE_Y + 1.19, -0.52],
    ],
    0.072,
    steelMat,
  );
  sceneGroup.add(ventPipe);
  const ventFlange = new THREE.Mesh(new THREE.TorusGeometry(0.083, 0.015, 10, 32), trimMat);
  ventFlange.rotation.x = Math.PI / 2;
  ventFlange.position.set(-0.42, BORE_Y + 1.19, -0.51);
  sceneGroup.add(ventFlange);

  // ============================================================================
  //  PATIENT TABLE — pedestal fixed, top slides to isocentre
  // ============================================================================
  const pedestal = beveledBox(0.52, 0.89, 0.86, tableMat, 0.03);
  pedestal.position.set(-2.05, PLINTH_H + 0.445, 0);
  pedestal.receiveShadow = true;
  sceneGroup.add(pedestal);
  const pedTrim = beveledBox(0.56, 0.05, 0.9, trimMat, 0.014);
  pedTrim.position.set(-2.05, PLINTH_H + 0.045, 0);
  sceneGroup.add(pedTrim);
  const slideRail = beveledBox(1.1, 0.05, 0.34, trimMat, 0.014);
  slideRail.position.set(-1.82, TABLE_Y - 0.06, 0);
  sceneGroup.add(slideRail);

  const tableTop = new THREE.Group();
  sceneGroup.add(tableTop);
  const topSlab = beveledBox(TABLE_L, 0.055, TABLE_W, tableMat, 0.024);
  topSlab.position.set(TABLE_X, TABLE_Y, 0);
  topSlab.castShadow = true;
  tableTop.add(topSlab);
  const topPad = beveledBox(TABLE_L - 0.12, 0.022, TABLE_W - 0.07, materials.polymer(0x2f333a), 0.01);
  topPad.position.set(TABLE_X, TABLE_Y + 0.038, 0);
  tableTop.add(topPad);

  // the subject: the cylindrical QA phantom a radiographer actually scans,
  // sitting in a slotted head receive coil
  const phantomGroup = new THREE.Group();
  phantomGroup.position.set(PHANTOM_X, BORE_Y, 0);
  tableTop.add(phantomGroup);
  const cradle = beveledBox(0.2, 0.09, 0.24, materials.polymer(0x3a3f47), 0.014);
  cradle.position.y = -0.12;
  phantomGroup.add(cradle);
  const phantomShell = new THREE.Mesh(
    new THREE.CylinderGeometry(PHANTOM_R, PHANTOM_R, PHANTOM_HL * 2, 48, 1, false),
    glassMat,
  );
  phantomShell.rotation.z = Math.PI / 2;
  phantomGroup.add(phantomShell);
  for (const s of [-1, 1]) {
    const capRing = new THREE.Mesh(new THREE.TorusGeometry(PHANTOM_R, 0.008, 10, 40), trimMat);
    capRing.rotation.y = Math.PI / 2;
    capRing.position.x = s * PHANTOM_HL;
    phantomGroup.add(capRing);
  }

  const rxCoil = new THREE.Group();
  phantomGroup.add(rxCoil);
  const rxMats = [];
  for (const s of [-1, 1]) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.155, 0.014, 10, 48), rxMat);
    ring.rotation.y = Math.PI / 2;
    ring.position.x = s * 0.13;
    rxCoil.add(ring);
  }
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * TAU + 0.5;
    if (Math.sin(a) < -0.55) continue; // no rib where the cradle already is
    if (Math.cos(a) > 0.75) continue; // and none straight in front of the water
    const rib = rod(0.009, 0.26, rxMat);
    rib.rotation.z = -Math.PI / 2;
    rib.position.set(-0.13, Math.sin(a) * 0.155, Math.cos(a) * 0.155);
    rxCoil.add(rib);
  }
  for (const x of [-0.07, 0.07]) {
    const trace = new THREE.Mesh(new THREE.TorusGeometry(0.148, 0.005, 8, 40), rfMat.clone());
    trace.rotation.y = Math.PI / 2;
    trace.position.x = x;
    rxCoil.add(trace);
    rxMats.push(trace.material);
  }

  // ---- the protons ---------------------------------------------------------
  const spinMat = glowMat(ACCENT, 2.4);
  spinMat.opacity = 0.95;
  const spinShaftGeo = new THREE.CylinderGeometry(0.0028, 0.0028, 0.032, 6);
  spinShaftGeo.translate(0, 0.016, 0);
  const spinHeadGeo = new THREE.ConeGeometry(0.0085, 0.019, 8);
  spinHeadGeo.translate(0, 0.041, 0);
  const spinShafts = new THREE.InstancedMesh(spinShaftGeo, spinMat, N_SPIN);
  const spinHeads = new THREE.InstancedMesh(spinHeadGeo, spinMat, N_SPIN);
  spinShafts.frustumCulled = false;
  spinHeads.frustumCulled = false;
  spinShafts.visible = false;
  spinHeads.visible = false;
  phantomGroup.add(spinShafts, spinHeads);

  const spins = [];
  for (let i = 0; i < N_SPIN; i++) {
    let px;
    let py;
    let pz;
    do {
      px = (Math.random() * 2 - 1) * (PHANTOM_HL - 0.014);
      py = (Math.random() * 2 - 1) * (PHANTOM_R - 0.022);
      pz = (Math.random() * 2 - 1) * (PHANTOM_R - 0.022);
    } while (py * py + pz * pz > (PHANTOM_R - 0.022) ** 2);
    spins.push({
      pos: new THREE.Vector3(px, py, pz),
      rnd: new THREE.Vector3(
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
        Math.random() * 2 - 1,
      ).normalize(),
      phi0: Math.random() * TAU,
      // parallel or antiparallel — they very nearly cancel in pairs, and the
      // handful that do not are the entire signal
      sign: i < 3 ? 1 : i % 2 ? 1 : -1,
      keep: i < 3,
    });
  }
  const spinDummy = new THREE.Object3D();
  const spinUp = new THREE.Vector3(0, 1, 0);
  const spinDir = new THREE.Vector3();
  const spinQuat = new THREE.Quaternion();

  // the net magnetisation vector — the only thing the scanner ever measures
  const netGroup = new THREE.Group();
  netGroup.visible = false;
  phantomGroup.add(netGroup);
  const netMat = glowMat(0xffc86e, 1.8);
  netMat.opacity = 0;
  const netShaft = rod(0.006, 0.1, netMat);
  netShaft.rotation.z = -Math.PI / 2;
  netGroup.add(netShaft);
  const netHead = new THREE.Mesh(new THREE.ConeGeometry(0.017, 0.04, 14), netMat);
  netHead.rotation.z = -Math.PI / 2;
  netHead.position.x = 0.118;
  netGroup.add(netHead);

  // ============================================================================
  //  CONSOLE DISPLAY — k-space filling, then the slice it transforms into
  // ============================================================================
  const SCREEN_PX = 192;
  const screenCanvas = document.createElement('canvas');
  screenCanvas.width = SCREEN_PX;
  screenCanvas.height = SCREEN_PX;
  const sctx = screenCanvas.getContext('2d');
  const screenTex = new THREE.CanvasTexture(screenCanvas);
  screenTex.colorSpace = THREE.SRGBColorSpace;
  const screenMat = new THREE.MeshBasicMaterial({ map: screenTex, toneMapped: false });
  const screenNoise = new Float32Array(SCREEN_PX * SCREEN_PX);
  for (let i = 0; i < screenNoise.length; i++) screenNoise[i] = Math.random();
  const screenImage = sctx.createImageData(SCREEN_PX, SCREEN_PX);
  let screenDrawn = -1;

  function drawScreen(t) {
    const q = Math.round(clamp01(t) * 72);
    if (q === screenDrawn) return;
    screenDrawn = q;
    const u = q / 72;
    // k-space is acquired centre-out, so the lines carrying the contrast land
    // first and the edges — the fine detail — fill in last
    const lines = Math.round(clamp01(u / 0.58) * (SCREEN_PX / 2));
    const slice = clamp01((u - 0.56) / 0.44);
    const d = screenImage.data;
    const half = SCREEN_PX / 2;
    for (let y = 0; y < SCREEN_PX; y++) {
      const ky = y - half;
      const acquired = Math.abs(ky) <= lines;
      for (let x = 0; x < SCREEN_PX; x++) {
        const kx = x - half;
        const i = y * SCREEN_PX + x;
        let v = 0.02;
        // standby: a faint reticle, so an idle console reads as switched on
        if (u < 0.02) {
          const gx = Math.abs(kx) % 24;
          const gy = Math.abs(ky) % 24;
          if (gx < 1 || gy < 1) v = 0.055;
          if (Math.abs(kx) < 1 || Math.abs(ky) < 1) v = 0.11;
        }
        if (acquired) {
          const rr = Math.hypot(kx, ky * 1.1) + 1;
          v = Math.min(1, 2.6 / rr ** 0.9) * (0.45 + 0.55 * screenNoise[i]);
          if (Math.abs(ky) < 2) v = Math.min(1, v * 1.5);
        }
        v *= 1 - slice;
        if (slice > 0) {
          const nx = kx / half;
          const ny = ky / half;
          const rad = Math.hypot(nx, ny);
          let s = 0.015;
          if (rad < 0.6) s = 0.72 + screenNoise[i] * 0.06;
          if (rad > 0.545 && rad < 0.62) s = 0.34;
          for (let k = 0; k < 4; k++) {
            // the resolution inserts every QA phantom carries
            if (Math.hypot(nx - (-0.3 + k * 0.2), ny - 0.24) < 0.055 - k * 0.008) s = 0.1;
          }
          if (Math.abs(ny + 0.3) < 0.05 && Math.abs(nx) < 0.32) s = 0.12;
          v += s * slice;
        }
        const c = Math.round(clamp01(v) * 232);
        d[i * 4] = Math.round(c * 0.86);
        d[i * 4 + 1] = Math.round(c * 0.95);
        d[i * 4 + 2] = c;
        d[i * 4 + 3] = 255;
      }
    }
    sctx.putImageData(screenImage, 0, 0);
    sctx.strokeStyle = 'rgba(110,198,255,0.45)';
    sctx.lineWidth = 2;
    sctx.strokeRect(1, 1, SCREEN_PX - 2, SCREEN_PX - 2);
    sctx.fillStyle = 'rgba(110,198,255,0.7)';
    sctx.fillRect(8, SCREEN_PX - 13, 4 + u * 42, 3);
    screenTex.needsUpdate = true;
  }

  const consoleGroup = new THREE.Group();
  // forward of the gantry and turned towards the lens: parked further back it
  // fell outside the finale's frame, taking the whole k-space payoff with it
  consoleGroup.position.set(1.25, PLINTH_H, 0.95);
  consoleGroup.rotation.y = -0.8;
  sceneGroup.add(consoleGroup);
  const stalkBase = beveledBox(0.3, 0.035, 0.26, trimMat, 0.01);
  stalkBase.position.y = 0.018;
  consoleGroup.add(stalkBase);
  const stalk = rod(0.026, 0.88, steelMat);
  stalk.position.y = 0.03;
  consoleGroup.add(stalk);
  const bezel = beveledBox(0.5, 0.36, 0.03, trimMat, 0.012);
  bezel.position.set(0, 1.06, 0);
  bezel.rotation.x = -0.14;
  consoleGroup.add(bezel);
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.43, 0.29), screenMat);
  screen.position.set(0, 1.062, 0.019);
  screen.rotation.x = -0.14;
  consoleGroup.add(screen);

  // ============================================================================
  //  MACRO INSERT — a cut end of the wire, at a size you can actually read
  // ============================================================================
  const macroGroup = new THREE.Group();
  macroGroup.position.set(0.02, BORE_Y + 0.78, 0.92);
  macroGroup.rotation.set(0.18, -0.55, 0);
  macroGroup.visible = false;
  sceneGroup.add(macroGroup);
  const wireBody = new THREE.Mesh(new THREE.CylinderGeometry(0.13, 0.13, 0.26, 48), copperMat);
  wireBody.rotation.z = Math.PI / 2;
  macroGroup.add(wireBody);
  const wireFace = new THREE.Mesh(new THREE.CircleGeometry(0.13, 48), materials.aluminum(0xd9a06a));
  wireFace.rotation.y = Math.PI / 2;
  wireFace.position.x = 0.131;
  macroGroup.add(wireFace);
  // 54 NbTi filaments in a hex pack — a real wire carries thousands at 20 um,
  // drawn here at a count you can count
  const filaments = new THREE.InstancedMesh(
    new THREE.CylinderGeometry(0.0085, 0.0085, 0.264, 10),
    materials.darkMetal(0x4a5560),
    54,
  );
  macroGroup.add(filaments);
  const filDummy = new THREE.Object3D();
  let filIndex = 0;
  for (let ring = 0; ring < 5 && filIndex < 54; ring++) {
    const n = ring === 0 ? 1 : ring * 6;
    for (let k = 0; k < n && filIndex < 54; k++) {
      const a = (k / n) * TAU + ring * 0.3;
      const rr = ring * 0.0225;
      filDummy.position.set(0, ring === 0 ? 0 : Math.cos(a) * rr, ring === 0 ? 0 : Math.sin(a) * rr);
      filDummy.rotation.set(0, 0, Math.PI / 2); // lie along the wire axis
      filDummy.updateMatrix();
      filaments.setMatrixAt(filIndex, filDummy.matrix);
      filIndex++;
    }
  }
  filaments.instanceMatrix.needsUpdate = true;
  const macroRim = new THREE.Mesh(new THREE.TorusGeometry(0.131, 0.005, 10, 48), trimMat);
  macroRim.rotation.y = Math.PI / 2;
  macroRim.position.x = 0.131;
  macroGroup.add(macroRim);

  // ============================================================================
  //  CALLOUTS
  // ============================================================================
  const labels = calloutSets([
    'exterior',
    'cryostat',
    'coil',
    'switch',
    'cryo',
    'spins',
    'rf',
    'gradient',
    'image',
  ]);

  labels.add('exterior', cover, 'Bore — 70 cm', [0.24, -0.8, 0.26], -34, 78);
  labels.add('exterior', cover, 'The magnet — 3.8 tonnes', [-0.55, 0.42, 0.78], 22, 68);
  labels.add('exterior', coldHead, 'Cold head', [0, 0.44, 0], 48, 56);
  labels.add('exterior', topSlab, 'Patient table', [0.72, 0.035, 0.2], -52, 62);

  labels.add('cryostat', vacVessel, 'Vacuum vessel', faceUp(0.94, 0.62), 72, 78);
  labels.add('cryostat', shieldVessel, 'Aluminised shield', faceUp(0.875, 0.34), 96, 92);
  labels.add('cryostat', heVessel, 'Helium vessel — 4.2 K', faceUp(0.8, 0.06), 84, 108);
  labels.add('cryostat', coilGroup, 'Six coil sections', faceUp(0.765, 0.4), 52, 96);

  labels.add('coil', coilGroup, 'One loop, no resistance', faceUp(0.765, 0.4), 104, 84);
  labels.add('coil', macroGroup, 'NbTi in a copper stabiliser', [0, 0.14, 0], 58, 72);
  labels.add('coil', coilGroup, 'About 500 amps', faceUp(0.765, 0.09), 70, 96);

  labels.add('switch', switchBody, 'Persistent current switch', [-0.06, 0, 0.06], 66, 78);
  labels.add('switch', heaterBand, 'Switch heater', [0.05, 0, 0.03], 112, 74);
  labels.add('switch', switchGroup, 'Ramp leads — disconnected', [-0.21, 0, 0.02], 88, 92);

  labels.add('cryo', vacVessel, 'Vacuum — no conduction', faceUp(0.94, 0.66), 68, 80);
  labels.add('cryo', shieldVessel, 'Radiation shield', faceUp(0.875, 0.38), 98, 96);
    // NOT faceDn(): sitting exactly on the lower knife face, this anchor is at a
  // grazing angle to the step's camera and the outer shells' own cut bands
  // screen it (the label gate caught it twice). Floated a few degrees into the
  // open wedge instead, just in front of the helium it names.
  labels.add('cryo', heliumPool, 'Liquid helium', [0.098, 0.4, 0.794], -58, 86);
  labels.add('cryo', ventFlange, 'Quench vent', [0, 0.06, 0], 128, 62);

  labels.add('spins', spinShafts, 'Hydrogen protons', [0, 0.11, 0.05], 58, 72);
  labels.add('spins', netHead, 'Net magnetisation', [0.02, 0.02, 0], 18, 78);
  labels.add('spins', phantomShell, 'Test phantom — doped water', [0, -0.1, 0.02], -66, 80);

  labels.add('rf', rfGroup, 'Birdcage body coil', faceUp(RF_RUNG_R, 0.25), 62, 76);
  // anchored to the coil, NOT the pulse: the pulse group is hidden for the part
  // of the lap when the transmitter is off, and a label that blinks out with it
  // reads as a bug (caught twice by the label gate)
  labels.add('rf', rfGroup, '63.87 MHz', [-0.22, 0, 0.16], 20, 70);
  labels.add('rf', rxCoil, 'Receive coil', [0, 0.17, 0.02], 40, 90);

  labels.add('gradient', gradGroup, 'Gradient former', faceUp(0.55, 0.6), 74, 78);
  labels.add('gradient', gradGroup, 'Z gradient — a Maxwell pair', faceUp(0.55, 0.42), 104, 88);
  labels.add('gradient', spinShafts, 'Position becomes frequency', [0, 0.1, 0.05], 40, 90);

  labels.add('image', screen, 'k-space', [-0.14, 0.1, 0.02], 118, 56);
  labels.add('image', screen, 'The slice', [0.15, -0.09, 0.02], -38, 60);

  // ============================================================================
  //  POSE — one phase scalar plus the state each step pins in onEnter
  // ============================================================================
  let revealed = false;
  let fieldAmt = 0;
  let rfAmt = 0;
  let tipAmt = 0;
  let gradAmt = 0;
  let flowOn = false;
  let spinsOn = false;

  function setReveal(t) {
    revealed = clamp01(t) > 0.5;
    coverSolid.visible = !revealed;
    coverCut.visible = revealed;
    for (const o of internals) o.visible = revealed;
    rfPulse.visible = revealed && rfAmt > 0.01;
  }

  function setTable(t) {
    tableTop.position.x = clamp01(t) * TABLE_TRAVEL;
  }

  function setSpins(on) {
    spinsOn = !!on;
    spinShafts.visible = spinsOn;
    spinHeads.visible = spinsOn;
  }

  function setField(t) {
    fieldAmt = clamp01(t);
    netMat.opacity = fieldAmt * 0.95;
    netGroup.visible = spinsOn && fieldAmt > 0.02;
  }

  // The transmitter: the birdcage lit and a pulse crossing the bore.
  function setRf(t) {
    rfAmt = clamp01(t);
    rfPulse.visible = revealed && rfAmt > 0.01;
    for (const m of rfMats) m.emissive.setHex(rfAmt > 0.02 ? 0x16344d : 0x000000);
  }

  // How far the magnetisation is tipped out of the field. Separate from setRf
  // on purpose: the signal is broadcast AFTER the transmitter shuts off, so
  // the receive coil lights while the birdcage is dark.
  function setTip(t) {
    tipAmt = clamp01(t);
    for (const m of rxMats) m.emissive.setHex(tipAmt > 0.05 ? 0x1d3a1c : 0x000000);
  }

  function setGrad(t) {
    gradAmt = clamp01(t);
    // real deflection is a fraction of a millimetre; drawn at ~2% so the cause
    // of the noise is visible at all
    const flex = 1 + gradAmt * 0.02;
    gradGroup.scale.set(flex, 1, flex);
    for (const m of gradMats) m.emissive.setHex(gradAmt > 0.02 ? 0x38200c : 0x000000);
  }

  function setFlow(on) {
    flowOn = !!on;
    for (const m of leadMats) m.opacity = flowOn ? 0.75 : 0.35;
  }

  function setImage(t) {
    drawScreen(t);
  }

  function setMacro(on) {
    macroGroup.visible = !!on;
  }

  function setLabels(mode) {
    labels.setLabels(mode);
  }

  function setPhase(u) {
    const p = ((u % 1) + 1) % 1;

    // --- idle: the cold head's valve motor turns, one whole turn per lap ------
    headMotor.rotation.y = p * TAU;
    displacer.position.y = 0.24 + Math.sin(p * TAU) * 0.011;
    const breathe = 0.5 + 0.5 * Math.sin(p * TAU * 2);
    for (const m of ringMats) m.opacity = (0.68 + breathe * 0.26) * (revealed ? 0.25 : 1);

    // --- the RF pulse: rings running the length of the coil, 2 whole passes
    // per lap so frame 0 and frame 1 are the same frame ----------------------
    rfRings.forEach((ring, i) => {
      const t = (((p * 2 + i / 3) % 1) + 1) % 1;
      ring.position.y = -0.28 + t * 0.56;
      rfRingMats[i].opacity = rfAmt * 0.85 * Math.sin(t * Math.PI);
    });

    // --- the persistent current: whole circuits per lap ----------------------
    for (const q of flowQueues) q.set(p * 2, revealed && flowOn);

    // --- the protons ---------------------------------------------------------
    if (spinsOn) {
      // 4 whole precessions per lap, so the wrap pose is identical
      const tilt = 0.32 + tipAmt * (Math.PI / 2 - 0.32);
      for (let i = 0; i < N_SPIN; i++) {
        const s = spins[i];
        // a gradient tilts the field, so protons further along the bore precess
        // faster and fan out of step — then back into step as it releases
        const fan = gradAmt * (s.pos.x / PHANTOM_HL) * TAU * 1.5;
        const phi = p * TAU * 4 + s.phi0 + fan;
        spinDir
          .set(
            s.sign * Math.cos(tilt),
            Math.sin(tilt) * Math.cos(phi),
            Math.sin(tilt) * Math.sin(phi),
          )
          .lerp(s.rnd, 1 - fieldAmt)
          .normalize();
        spinQuat.setFromUnitVectors(spinUp, spinDir);
        spinDummy.position.copy(s.pos);
        spinDummy.quaternion.copy(spinQuat);
        // the pairs that cancel shrink away; the few that do not are the signal
        spinDummy.scale.setScalar(s.keep ? 1 : 1 - fieldAmt * 0.72);
        spinDummy.updateMatrix();
        spinShafts.setMatrixAt(i, spinDummy.matrix);
        spinHeads.setMatrixAt(i, spinDummy.matrix);
      }
      spinShafts.instanceMatrix.needsUpdate = true;
      spinHeads.instanceMatrix.needsUpdate = true;
    }

    // the net vector: along the field, tipped by the RF pulse, precessing
    netGroup.rotation.set(0, 0, 0);
    netGroup.rotateX(p * TAU * 4);
    netGroup.rotateZ(tipAmt * (Math.PI / 2) * 0.95);
  }

  // initial state: sealed, idling, nothing revealed
  setReveal(0);
  setTable(0);
  setSpins(false);
  setField(0);
  setRf(0);
  setTip(0);
  setGrad(0);
  setFlow(false);
  setMacro(false);
  setImage(0);
  setPhase(0);
  setLabels(false);

  return {
    group: sceneGroup,
    setReveal,
    setTable,
    setSpins,
    setField,
    setRf,
    setTip,
    setGrad,
    setFlow,
    setImage,
    setMacro,
    setPhase,
    setLabels,
    parts: {
      gantry,
      cover,
      cryoGroup,
      coilGroup,
      switchGroup,
      gradGroup,
      rfGroup,
      coldHead,
      tableTop,
      phantomGroup,
      netGroup,
      macroGroup,
      consoleGroup,
    },
  };
}
