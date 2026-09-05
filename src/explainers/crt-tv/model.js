import * as THREE from 'three';
import { materials, rod, box, disc, studioPlinth } from '../../framework/parts.js';
import { beveledBox, tubeAlong, coil } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, TAU } from '../../framework/motion.js';

// A late-1990s 20-inch colour CRT television, presented as a studio product
// shot: a charcoal cabinet whose entire volume is one evacuated glass bottle.
//
// MECHANISM (researched — Wikipedia "Cathode-ray tube", Britannica "Shadow
// masks and aperture grilles" + "The scanning pattern", Sam's Repair FAQ on
// colour CRTs):
//   Three oxide-coated cathodes in the neck run at 800-1000 C and boil off
//   electrons. A stack of apertured grids meters them (G1) and squeezes each
//   cloud into a pencil (focus electrodes). The final anode sits at 24-32 kV,
//   fed from the flyback transformer through the anode button on the funnel;
//   the aquadag graphite coatings inside and outside the funnel form the
//   smoothing capacitor for it. 25 kV puts the electrons on the screen at
//   about 0.30 c (~90,000 km/s).
//   The deflection yoke straddles the neck/funnel joint. Saddle coils on the
//   +-X flanks make a vertical field, which bends the beam HORIZONTALLY at
//   15,734 Hz (NTSC); toroidal windings on the ferrite ring make a horizontal
//   field, which bends it VERTICALLY at 59.94 Hz. A line lasts 63.5 us, of
//   which ~52.6 us draws and ~10.9 us is a blanked retrace; 525 lines make a
//   frame, 480 of them visible, split into two interlaced fields.
//   13 mm behind the glass is the shadow mask: a perforated steel sheet with
//   ~400,000 holes. The three beams arrive at a hole from three slightly
//   different angles, so each can only reach its own colour of phosphor
//   stripe behind it. The price is brutal — a typical mask is only ~15% open
//   area, so most of the electrons never reach the screen; they die in the
//   mask as heat.
//   The P22 phosphor triads are backed by a ~100 nm aluminium film that
//   mirrors their light forward and lets the electrons punch straight
//   through. Each dot glows for about a millisecond, so the whole picture is
//   never on the screen at once: it is one moving dot plus your eye.
//
// PROPORTIONS — one consistent scale, 1 world unit = 200 mm:
//   cabinet 530 x 450 x 460 mm -> 2.65 W x 2.25 H x 2.30 D (nearly as deep as
//   it is wide, which IS the silhouette). Viewable screen 400 x 300 mm ->
//   2.00 x 1.50, 4:3. Tube faceplate 464 x 364 mm -> 2.32 x 1.82. Neck 29 mm
//   dia -> 0.145. The deflection centre sits 0.875 ahead of the phosphor,
//   which against a 1.25 half-diagonal is exactly the 110 degree full
//   deflection angle real TV tubes use (90 degrees is a monitor).
//
// STATE the pose is built from (all pinned in every step's onEnter):
//   setMode(m)    'off' | 'gun' | 'stream' | 'scan' | 'interlace'
//                 how much of the electron path is drawn, and whether the
//                 landing spot is parked at the centre or sweeping a raster.
//   setScreen(m)  'off' | 'bars' | 'raster' | 'warm' — what the phosphor does.
//   setReveal(r)  0 sealed cabinet / 1 cabinet ghosted, tube + chassis bare.
//   setSwayAmp(d) presentation sway amplitude in degrees (0 on every
//                 mechanism step, so their fixed cameras never inherit a
//                 random angle).
//   setMacro(m)   'off' | 'mask' | 'colour' — the oversized detail block.
//   setPatch(v)   the sampled-patch marker drawn on the real screen.
//   setPhase(u)   the one 0-1 lap phase everything above is evaluated at.
//
// SEAMLESS LOOPS: setPhase is a plain 0-1 phase and every term wraps mod 1.
// The raster's vertical sweep finishes its blanked retrace inside the lap
// (V_FRAC = 0.915 draws, the rest flies back), so u=0 and u=1 are the same
// frame; the electron dot trains run frac(u*3 + j/N) with an ODD number of
// transits and an ODD dot count so the 0.2/0.7 motion probe never hashes
// identically; the sway is sin(TAU*u), zero and rising at both ends.

// --- layout (world units; the set stands on the y=0 shadow floor) ----------
const PLINTH_H = 0.26;
const CAB_W = 2.65;
const CAB_H = 2.25;
const CAB_D = 2.3;
const CAB_Y0 = PLINTH_H;
const CAB_CY = CAB_Y0 + CAB_H / 2;
const FRONT_Z = CAB_D / 2;
const BACK_Z = -CAB_D / 2;

const TUBE_Y = CAB_Y0 + CAB_H * 0.565; // screen centre — thin top bezel, fat bottom
const SCREEN_W = 2.0;
const SCREEN_H = 1.5;
const FACE_W = 2.32;
const FACE_H = 1.82;
const FACE_N = 5.5; // superellipse exponent: 2 = ellipse, 5.5 = rounded rect

const PHOS_Z = 1.0; // phosphor plane (rim); the dome bulges forward from here
const PHOS_BULGE = 0.034;
const GLASS_Z = 1.06;
const GLASS_BULGE = 0.038;
const SKIRT_BACK_Z = 0.96;
const MASK_Z = PHOS_Z - 0.065; // 13 mm behind the phosphor, to scale
const NECK_JOIN_Z = 0.14;
const NECK_BACK_Z = -0.76;
const NECK_R = 0.0725;
const DEFL_Z = 0.185; // deflection centre — 0.875 ahead of the phosphor = 110 deg
const YOKE_Z0 = 0.03;
const YOKE_Z1 = 0.34;

const GUN_Z = -0.62; // cathode plane
const GUN_DX = 0.0275; // in-line cathode spacing, 5.5 mm to scale

const CHASSIS_Y = CAB_Y0 + 0.13;

// raster timing, as fractions of one lap
const V_FRAC = 0.915; // fraction of the field spent drawing (rest = vertical retrace)
const H_ACT = 0.83; // fraction of a line spent drawing (rest = horizontal retrace)
const LINES_SCAN = 15; // odd — see the seamless-loop note
const LINES_ILACE = 26; // two interlaced fields of 13
const DECAY = 0.15; // phosphor trail decay, in lap units (stretched to be visible)

const SCR_W = 160;
const SCR_H = 120;

const BEAM_COLORS = [0xff4d4d, 0x63ff86, 0x5fa8ff];
const INSERT_POS = new THREE.Vector3(2.55, 2.5, 0.7);

const frac = (t) => t - Math.floor(t);

// --- geometry helpers -------------------------------------------------------

// Superellipse contour point: n=2 is an ellipse, n>4 a rounded rectangle. One
// formula gets the whole envelope, from the circular neck to the rounded
// rectangle of the faceplate, with nothing to blend by hand.
function superPt(a, w, h, n) {
  const c = Math.cos(a);
  const s = Math.sin(a);
  const k = 2 / n;
  return [
    Math.sign(c) * Math.pow(Math.abs(c), k) * (w / 2),
    Math.sign(s) * Math.pow(Math.abs(s), k) * (h / 2),
  ];
}

// Open lofted shell through a list of {z, w, h, n} sections.
function loftShell(sections, material, segs = 72) {
  const pos = [];
  const idx = [];
  for (const sec of sections) {
    for (let j = 0; j < segs; j++) {
      const [x, y] = superPt((j / segs) * TAU, sec.w, sec.h, sec.n);
      pos.push(x, y, sec.z);
    }
  }
  for (let i = 0; i < sections.length - 1; i++) {
    for (let j = 0; j < segs; j++) {
      const a = i * segs + j;
      const b = i * segs + ((j + 1) % segs);
      idx.push(a, a + segs, b + segs, a, b + segs, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = false;
  return mesh;
}

// Slightly domed rounded-rectangle panel — the faceplate, the phosphor and
// the shadow mask are all this shape at three depths. UVs map the picture
// straight onto x/y, so screen-right is world +X.
function domedPanel({ w, h, n, z, bulge }, material, rings = 16, segs = 72) {
  const pos = [];
  const uv = [];
  const idx = [];
  pos.push(0, 0, z + bulge);
  uv.push(0.5, 0.5);
  for (let i = 1; i <= rings; i++) {
    const f = i / rings;
    for (let j = 0; j < segs; j++) {
      const [x, y] = superPt((j / segs) * TAU, w * f, h * f, n);
      pos.push(x, y, z + bulge * (1 - f * f));
      uv.push(x / w + 0.5, y / h + 0.5);
    }
  }
  for (let j = 0; j < segs; j++) idx.push(0, 1 + j, 1 + ((j + 1) % segs));
  for (let i = 1; i < rings; i++) {
    for (let j = 0; j < segs; j++) {
      const a = 1 + (i - 1) * segs + j;
      const b = 1 + (i - 1) * segs + ((j + 1) % segs);
      idx.push(a, a + segs, b + segs, a, b + segs, b);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return new THREE.Mesh(geo, material);
}

// Rounded-rect path in the XY plane at a given z — the degaussing coil and
// the faceplate rim band both ride one.
function superPath(w, h, n, z, steps = 44) {
  const pts = [];
  for (let j = 0; j < steps; j++) {
    const [x, y] = superPt((j / steps) * TAU, w, h, n);
    pts.push([x, y, z]);
  }
  return pts;
}

// Perforated-steel look for the shadow mask at cabinet scale: a grey sheet
// stippled with its holes. Local to this model, so setting `repeat` is safe —
// the framework's shared textures must never be mutated.
function maskHoleTexture() {
  const c = document.createElement('canvas');
  c.width = 64;
  c.height = 64;
  const g = c.getContext('2d');
  g.fillStyle = '#6c7075';
  g.fillRect(0, 0, 64, 64);
  g.fillStyle = '#0e1013';
  for (let r = 0; r < 4; r++) {
    for (let q = 0; q < 4; q++) {
      g.beginPath();
      g.arc(8 + q * 16 + (r % 2) * 8, 8 + r * 16, 4.4, 0, TAU);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(34, 26);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Punched speaker grille, as a texture rather than four hundred little meshes.
function grilleTexture() {
  const c = document.createElement('canvas');
  c.width = 32;
  c.height = 32;
  const g = c.getContext('2d');
  g.fillStyle = '#31353b';
  g.fillRect(0, 0, 32, 32);
  g.fillStyle = '#0b0c0f';
  for (let r = 0; r < 4; r++) {
    for (let q = 0; q < 4; q++) {
      g.beginPath();
      g.arc(4 + q * 8 + (r % 2) * 4, 4 + r * 8, 2.3, 0, TAU);
      g.fill();
    }
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = THREE.RepeatWrapping;
  t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(5, 20);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

// Emissive particle used for every electron: transparent + depthWrite off, so
// a faded one can never punch a hole through the glass in front of it.
function electronDot(color, radius = 0.019) {
  const m = new THREE.Mesh(
    new THREE.SphereGeometry(radius, 8, 6),
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 1, depthWrite: false }),
  );
  m.castShadow = false;
  return m;
}

// An apertured gun electrode: a disc with three in-line holes for the three
// beams. Real grids are stamped exactly like this.
function gridPlate(r, thickness, holeR, material) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, r, 0, TAU, false);
  for (let i = -1; i <= 1; i++) {
    const hole = new THREE.Path();
    hole.absarc(i * GUN_DX, 0, holeR, 0, TAU, true);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, { depth: thickness, bevelEnabled: false, curveSegments: 20 });
  geo.translate(0, 0, -thickness / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = false;
  return mesh;
}

export function buildCrtTv({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  group.add(studioPlinth({ w: 3.7, h: PLINTH_H, d: 3.15 }));

  // --- materials -----------------------------------------------------------
  const caseMat = materials.polymer(0x24262b);
  const bezelMat = materials.polymer(0x2b2e34);
  const trimMat = materials.polymer(0x1a1c20);
  const ventMat = materials.polymer(0x101216);
  const grilleMat = new THREE.MeshStandardMaterial({
    map: grilleTexture(),
    roughness: 0.85,
    metalness: 0.05,
  });
  // Plain transparent glass, NOT transmission: the electron beams inside are
  // themselves transparent, and a transmission pass would erase them.
  const glassMat = materials.glass(0xc3d8ef, 0.17);
  const neckGlassMat = materials.glass(0xc9dcf0, 0.18);
  // The faceplate is SMOKED glass — which is why a CRT reads charcoal when it
  // is switched off, and is what stops the studio reflection sitting on top of
  // it from washing the picture out.
  const faceGlassMat = new THREE.MeshPhysicalMaterial({
    color: 0x151b22,
    metalness: 0,
    roughness: 0.11,
    transparent: true,
    opacity: 0.3,
    side: THREE.DoubleSide,
    depthWrite: false,
  });
  const aquadagMat = new THREE.MeshStandardMaterial({
    color: 0x101215,
    roughness: 0.95,
    metalness: 0.1,
    transparent: true,
    opacity: 0.55,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const maskMat = new THREE.MeshStandardMaterial({
    map: maskHoleTexture(),
    color: 0x8a9099,
    roughness: 0.72,
    metalness: 0.85,
    side: THREE.DoubleSide,
  });
  const bandMat = materials.darkMetal(0x35393f);
  const gunMat = materials.steel(0x9ba3ae);
  const gunMatDark = materials.darkMetal(0x4a4f57);
  const ceramicMat = new THREE.MeshStandardMaterial({ color: 0xd8d2c4, roughness: 0.55, metalness: 0 });
  const copperMat = new THREE.MeshPhysicalMaterial({
    color: 0xb87333,
    metalness: 1,
    roughness: 0.42,
  });
  const ferriteMat = new THREE.MeshStandardMaterial({ color: 0x1e2024, roughness: 0.68, metalness: 0.35 });
  const pcbMat = new THREE.MeshStandardMaterial({ color: 0x1f4a2c, roughness: 0.62, metalness: 0.12 });
  const canMat = materials.brushedSteel(0xa9b0b8);
  const ehtMat = materials.rubber(0x5c1616);
  const tapeMat = materials.rubber(0x121317);
  const heaterMat = new THREE.MeshBasicMaterial({ color: 0xffb066, transparent: true, opacity: 0.9 });

  canMat.roughness = 0.62;
  gunMat.roughness = 0.42;

  // ==========================================================================
  //  CABINET — the sealed product (step 1). Ghosts away on setReveal.
  // ==========================================================================
  const shellMats = [caseMat, bezelMat, trimMat, ventMat, grilleMat];
  const cabinet = new THREE.Group();
  group.add(cabinet);
  const hideOnReveal = new THREE.Group();
  cabinet.add(hideOnReveal);

  // front bezel: an extruded frame with the screen opening cut out of it
  const bezelShape = new THREE.Shape();
  const outer = superPath(CAB_W, CAB_H, 9, 0, 56);
  bezelShape.moveTo(outer[0][0], outer[0][1]);
  for (const p of outer.slice(1)) bezelShape.lineTo(p[0], p[1]);
  bezelShape.closePath();
  const openHole = new THREE.Path();
  const inner = superPath(SCREEN_W + 0.06, SCREEN_H + 0.06, FACE_N, 0, 56);
  openHole.moveTo(inner[0][0], inner[0][1] + (TUBE_Y - CAB_CY));
  for (const p of inner.slice(1).reverse()) openHole.lineTo(p[0], p[1] + (TUBE_Y - CAB_CY));
  openHole.closePath();
  bezelShape.holes.push(openHole);
  const bezel = new THREE.Mesh(
    new THREE.ExtrudeGeometry(bezelShape, { depth: 0.11, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.012, bevelSegments: 2, curveSegments: 4 }),
    bezelMat,
  );
  bezel.position.set(0, CAB_CY, FRONT_Z - 0.11);
  bezel.castShadow = true;
  cabinet.add(bezel);

  // body: sides, top, bottom, back
  const sideL = beveledBox(0.06, CAB_H, CAB_D, caseMat, 0.02);
  sideL.position.set(-CAB_W / 2 + 0.03, CAB_CY, 0);
  const sideR = sideL.clone();
  sideR.position.x = CAB_W / 2 - 0.03;
  const top = beveledBox(CAB_W, 0.06, CAB_D, caseMat, 0.02);
  top.position.set(0, CAB_Y0 + CAB_H - 0.03, 0);
  const bottom = beveledBox(CAB_W, 0.07, CAB_D, caseMat, 0.02);
  bottom.position.set(0, CAB_Y0 + 0.035, 0);
  const back = beveledBox(CAB_W - 0.1, CAB_H - 0.1, 0.05, caseMat, 0.02);
  back.position.set(0, CAB_CY, BACK_Z + 0.025);
  cabinet.add(sideL, sideR, top, bottom, back);

  // the bulge the tube neck lives in, and the vents around it
  const neckBoss = new THREE.Mesh(
    new THREE.CylinderGeometry(0.24, 0.3, 0.12, 24),
    caseMat,
  );
  neckBoss.rotation.x = Math.PI / 2;
  neckBoss.position.set(0, TUBE_Y, BACK_Z + 0.06);
  cabinet.add(neckBoss);

  for (let i = 0; i < 11; i++) {
    for (const sx of [-1, 1]) {
      const slot = box(0.035, 0.34, 0.012, ventMat);
      slot.position.set(sx * (0.45 + (i % 6) * 0.075), TUBE_Y + 0.62 - Math.floor(i / 6) * 0.42, BACK_Z + 0.052);
      hideOnReveal.add(slot);
    }
  }
  for (let i = 0; i < 9; i++) {
    const slot = box(CAB_W * 0.5, 0.014, 0.03, ventMat);
    slot.position.set(0, CAB_Y0 + CAB_H - 0.062, -0.55 + i * 0.09);
    hideOnReveal.add(slot);
  }

  // front furniture: speaker grilles, brand plate, control cluster
  for (const sx of [-1, 1]) {
    const grille = box(0.235, 1.24, 0.02, grilleMat);
    grille.position.set(sx * (SCREEN_W / 2 + 0.19), TUBE_Y + 0.06, FRONT_Z - 0.012);
    hideOnReveal.add(grille);
    const speaker = new THREE.Mesh(new THREE.ConeGeometry(0.1, 0.11, 20), trimMat);
    speaker.rotation.x = -Math.PI / 2;
    speaker.position.set(sx * (SCREEN_W / 2 + 0.19), TUBE_Y + 0.06, FRONT_Z - 0.13);
    hideOnReveal.add(speaker);
  }
  const brandPlate = beveledBox(0.42, 0.055, 0.014, trimMat, 0.006);
  brandPlate.position.set(-0.62, CAB_Y0 + 0.19, FRONT_Z - 0.004);
  hideOnReveal.add(brandPlate);
  for (let i = 0; i < 4; i++) {
    const btn = beveledBox(0.075, 0.05, 0.026, trimMat, 0.008);
    btn.position.set(0.5 + i * 0.1, CAB_Y0 + 0.19, FRONT_Z - 0.006);
    hideOnReveal.add(btn);
  }
  const irWindow = beveledBox(0.13, 0.05, 0.012, ventMat, 0.006);
  irWindow.position.set(0.25, CAB_Y0 + 0.19, FRONT_Z - 0.004);
  hideOnReveal.add(irWindow);
  const standbyLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.017, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0xff5a3c }),
  );
  standbyLed.position.set(0.13, CAB_Y0 + 0.19, FRONT_Z - 0.002);
  hideOnReveal.add(standbyLed);

  // ==========================================================================
  //  PICTURE TUBE — faceplate, funnel, neck. One glass envelope.
  // ==========================================================================
  const tube = new THREE.Group();
  tube.position.set(0, TUBE_Y, 0);
  group.add(tube);

  const faceGlass = domedPanel(
    { w: FACE_W, h: FACE_H, n: FACE_N, z: GLASS_Z, bulge: GLASS_BULGE },
    faceGlassMat,
  );
  tube.add(faceGlass);
  const faceSkirt = loftShell(
    [
      { z: GLASS_Z, w: FACE_W, h: FACE_H, n: FACE_N },
      { z: SKIRT_BACK_Z, w: FACE_W, h: FACE_H, n: FACE_N },
    ],
    faceGlassMat,
  );
  tube.add(faceSkirt);

  // funnel: superellipse sections narrowing to the circular neck. The profile
  // stays clear of the 110-degree deflection cone at every station.
  const funnelSections = [];
  const FUNNEL_STEPS = 16;
  for (let i = 0; i <= FUNNEL_STEPS; i++) {
    const s = i / FUNNEL_STEPS;
    const z = SKIRT_BACK_Z + (NECK_JOIN_Z - SKIRT_BACK_Z) * s;
    const k = Math.pow(1 - s, 1.45);
    funnelSections.push({
      z,
      w: NECK_R * 2 + (FACE_W - NECK_R * 2) * k,
      h: NECK_R * 2 + (FACE_H - NECK_R * 2) * k,
      n: 2 + (FACE_N - 2) * k,
    });
  }
  const funnel = loftShell(funnelSections, glassMat);
  tube.add(funnel);

  // aquadag: the graphite coating on the funnel's rear half, inside and out —
  // together with the glass between them it is the EHT smoothing capacitor
  const aquadag = loftShell(
    funnelSections.slice(3).map((s) => ({ ...s, w: s.w * 0.985, h: s.h * 0.985 })),
    aquadagMat,
  );
  tube.add(aquadag);

  const neck = new THREE.Mesh(
    new THREE.CylinderGeometry(NECK_R, NECK_R, NECK_JOIN_Z - NECK_BACK_Z, 28, 1, true),
    neckGlassMat,
  );
  neck.rotation.x = Math.PI / 2;
  neck.position.z = (NECK_JOIN_Z + NECK_BACK_Z) / 2;
  tube.add(neck);

  const phosphor = domedPanel(
    { w: SCREEN_W, h: SCREEN_H, n: FACE_N, z: PHOS_Z, bulge: PHOS_BULGE },
    new THREE.MeshBasicMaterial({ color: 0xffffff }),
  );
  tube.add(phosphor);

  const mask = domedPanel(
    { w: SCREEN_W + 0.06, h: SCREEN_H + 0.06, n: FACE_N, z: MASK_Z, bulge: PHOS_BULGE },
    maskMat,
  );
  tube.add(mask);

  // implosion protection band round the faceplate skirt
  const rimBand = tubeAlong(superPath(FACE_W + 0.03, FACE_H + 0.03, FACE_N, 1.0), 0.028, bandMat, {
    closed: true,
    tubularSegments: 120,
    radialSegments: 8,
  });
  tube.add(rimBand);

  // degaussing coil: taped copper loop round the front of the funnel
  const degauss = tubeAlong(superPath(FACE_W - 0.02, FACE_H - 0.02, FACE_N, 0.9), 0.024, tapeMat, {
    closed: true,
    tubularSegments: 110,
    radialSegments: 8,
  });
  tube.add(degauss);

  // getter ring and its silvered flash on the neck glass
  const getter = new THREE.Mesh(new THREE.TorusGeometry(0.036, 0.008, 8, 20), gunMatDark);
  getter.position.set(0, 0, NECK_JOIN_Z - 0.03);
  tube.add(getter);
  const getterFlash = new THREE.Mesh(
    new THREE.CylinderGeometry(NECK_R + 0.001, NECK_R + 0.001, 0.09, 24, 1, true),
    materials.chrome(0xb9c2cc),
  );
  getterFlash.rotation.x = Math.PI / 2;
  getterFlash.position.z = NECK_JOIN_Z - 0.06;
  tube.add(getterFlash);

  // anode button, with the rubber-capped EHT lead clipped over it. Both are
  // deliberately small: a real cap is about 28 mm across, and an oversized one
  // reads as a red balloon stuck to the side of every mechanism shot.
  const anodeButton = new THREE.Mesh(new THREE.CylinderGeometry(0.036, 0.048, 0.04, 18), gunMat);
  anodeButton.rotation.z = Math.PI / 2;
  anodeButton.position.set(-0.46, 0.14, 0.6);
  tube.add(anodeButton);
  const anodeCap = new THREE.Mesh(new THREE.SphereGeometry(0.062, 16, 12), ehtMat);
  anodeCap.scale.set(0.5, 1, 1);
  anodeCap.position.set(-0.5, 0.14, 0.6);
  tube.add(anodeCap);

  // ==========================================================================
  //  ELECTRON GUN — three in-line cathodes and the grid stack, in the neck
  // ==========================================================================
  const gun = new THREE.Group();
  gun.position.set(0, TUBE_Y, 0);
  group.add(gun);

  const cathodes = [];
  const heaters = [];
  for (let i = -1; i <= 1; i++) {
    const cup = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 0.03, 12), gunMat);
    cup.rotation.x = Math.PI / 2;
    cup.position.set(i * GUN_DX, 0, GUN_Z);
    gun.add(cup);
    cathodes.push(cup);
    const glow = new THREE.Mesh(new THREE.SphereGeometry(0.0135, 10, 8), heaterMat.clone());
    glow.position.set(i * GUN_DX, 0, GUN_Z + 0.017);
    gun.add(glow);
    heaters.push(glow);
    const stem = rod(0.0035, 0.09, gunMatDark, 8);
    stem.rotation.x = Math.PI / 2;
    stem.position.set(i * GUN_DX, 0, GUN_Z);
    gun.add(stem);
  }

  // G1 control grid, G2 screen grid, then the focus / final-anode stack
  const g1 = gridPlate(0.058, 0.008, 0.006, gunMat);
  g1.position.set(0, 0, GUN_Z + 0.055);
  const g2 = gridPlate(0.058, 0.01, 0.009, gunMat);
  g2.position.set(0, 0, GUN_Z + 0.095);
  gun.add(g1, g2);

  const focusCans = [];
  const canSpec = [
    [GUN_Z + 0.185, 0.16, 0.056],
    [GUN_Z + 0.35, 0.15, 0.06],
    [GUN_Z + 0.5, 0.11, 0.062],
  ];
  for (const [cz, len, cr] of canSpec) {
    const can = new THREE.Mesh(new THREE.CylinderGeometry(cr, cr, len, 20, 1, true), gunMat);
    can.rotation.x = Math.PI / 2;
    can.position.set(0, 0, cz);
    gun.add(can);
    focusCans.push(can);
    const lip = new THREE.Mesh(new THREE.TorusGeometry(cr, 0.004, 6, 20), gunMat);
    lip.position.set(0, 0, cz + len / 2);
    gun.add(lip);
  }
  const gunAperture = gridPlate(0.062, 0.008, 0.013, gunMatDark);
  gunAperture.position.set(0, 0, GUN_Z + 0.115);
  gun.add(gunAperture);

  // the two glass beads the whole stack is fused to
  for (const sy of [-1, 1]) {
    const bead = rod(0.008, 0.62, ceramicMat, 8);
    bead.rotation.x = Math.PI / 2;
    bead.position.set(0, sy * 0.052, GUN_Z - 0.01);
    gun.add(bead);
  }

  // tube base and pins
  const base = new THREE.Mesh(new THREE.CylinderGeometry(0.072, 0.072, 0.09, 24), trimMat);
  base.rotation.x = Math.PI / 2;
  base.position.set(0, 0, NECK_BACK_Z - 0.04);
  gun.add(base);
  for (let i = 0; i < 9; i++) {
    const a = (i / 11) * TAU - 0.9;
    const pin = rod(0.005, 0.055, gunMat, 6);
    pin.rotation.x = Math.PI / 2;
    pin.position.set(Math.cos(a) * 0.04, Math.sin(a) * 0.04, NECK_BACK_Z - 0.085);
    gun.add(pin);
  }

  // purity and convergence magnet rings, sitting behind the yoke
  for (let i = 0; i < 3; i++) {
    const ring = new THREE.Mesh(new THREE.TorusGeometry(NECK_R + 0.016, 0.012, 8, 26), gunMatDark);
    ring.position.set(0, 0, -0.16 - i * 0.045);
    gun.add(ring);
  }

  // ==========================================================================
  //  DEFLECTION YOKE — saddle coils for horizontal, toroidal for vertical
  // ==========================================================================
  const yoke = new THREE.Group();
  yoke.position.set(0, TUBE_Y, 0);
  group.add(yoke);

  const yokeR0 = NECK_R + 0.055;
  const yokeR1 = 0.235;
  // The ferrite ring is CUT AWAY over the near (-X) quadrant. Modelled whole it
  // is a perfectly accurate opaque cone that hides the horizontal coils inside
  // it — and a callout pointing at a wall is worse than a cutaway.
  const ferriteShellMat = ferriteMat.clone();
  ferriteShellMat.side = THREE.DoubleSide;
  const ferrite = new THREE.Mesh(
    new THREE.CylinderGeometry(
      yokeR0 + 0.02,
      yokeR1,
      YOKE_Z1 - YOKE_Z0,
      40,
      1,
      true,
      -0.22 * Math.PI,
      1.44 * Math.PI,
    ),
    ferriteShellMat,
  );
  ferrite.rotation.x = -Math.PI / 2;
  ferrite.position.z = (YOKE_Z0 + YOKE_Z1) / 2;
  yoke.add(ferrite);

  // horizontal-deflection saddle coils: axial conductors on the +-X flanks,
  // whose field runs vertically and therefore sweeps the beam side to side
  const saddleCoils = new THREE.Group();
  yoke.add(saddleCoils);
  for (const sx of [-1, 1]) {
    for (let k = 0; k < 7; k++) {
      const spread = 0.45 + k * 0.115;
      const rr = NECK_R + 0.026 + k * 0.0035;
      const pts = [];
      const arcSteps = 10;
      for (let i = 0; i <= arcSteps; i++) {
        const a = -spread + (2 * spread * i) / arcSteps;
        pts.push([sx * Math.cos(a) * rr, Math.sin(a) * rr, YOKE_Z0 + 0.005]);
      }
      for (let i = arcSteps; i >= 0; i--) {
        const a = -spread + (2 * spread * i) / arcSteps;
        pts.push([sx * Math.cos(a) * (rr + 0.042), Math.sin(a) * (rr + 0.042), YOKE_Z1 - 0.005]);
      }
      const loop = tubeAlong(pts, 0.0058, copperMat, {
        closed: true,
        tubularSegments: 96,
        radialSegments: 6,
      });
      saddleCoils.add(loop);
    }
  }

  // vertical-deflection windings: toroidal turns on the ferrite ring, top and
  // bottom, whose field runs horizontally and pulls the beam down the screen
  const toroidCoils = new THREE.Group();
  yoke.add(toroidCoils);
  for (const sy of [1, -1]) {
    const { mesh } = coil(
      {
        turns: 15,
        radius: 0.055,
        toroidal: true,
        majorRadius: yokeR1 - 0.03,
        majorSpan: Math.PI * 0.78,
        phase: sy > 0 ? Math.PI * 0.11 : Math.PI * 1.11,
        wireRadius: 0.0075,
        segmentsPerTurn: 12,
      },
      copperMat,
    );
    mesh.rotation.x = Math.PI / 2;
    mesh.position.z = (YOKE_Z0 + YOKE_Z1) / 2;
    toroidCoils.add(mesh);
  }

  const yokeClamp = new THREE.Mesh(new THREE.TorusGeometry(yokeR0 + 0.01, 0.014, 8, 26), trimMat);
  yokeClamp.position.z = YOKE_Z0 - 0.015;
  yoke.add(yokeClamp);

  // ==========================================================================
  //  CHASSIS — the one board that drives all of it
  // ==========================================================================
  const chassis = new THREE.Group();
  group.add(chassis);

  const boardMain = box(2.24, 0.02, 1.62, pcbMat);
  boardMain.position.set(0, CHASSIS_Y, -0.06);
  chassis.add(boardMain);

  // flyback (LOPT): makes the 25 kV out of the collapsing line-scan current
  const flyback = beveledBox(0.28, 0.34, 0.24, trimMat, 0.015);
  flyback.position.set(-0.62, CHASSIS_Y + 0.18, -0.42);
  chassis.add(flyback);
  const flybackCore = beveledBox(0.06, 0.4, 0.07, ferriteMat, 0.008);
  flybackCore.position.set(-0.62, CHASSIS_Y + 0.2, -0.28);
  chassis.add(flybackCore);
  const flybackPot = new THREE.Mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.03, 12), gunMatDark);
  flybackPot.position.set(-0.53, CHASSIS_Y + 0.355, -0.42);
  chassis.add(flybackPot);

  // The EHT lead is routed out to the cabinet wall and up, the way a real one
  // is cable-tied clear of the neck — otherwise it swings straight through the
  // middle of every shot of the tube.
  const ehtLead = tubeAlong(
    [
      [-0.62, CHASSIS_Y + 0.31, -0.42],
      [-1.06, CHASSIS_Y + 0.36, -0.15],
      [-1.09, TUBE_Y - 0.5, 0.35],
      [-0.86, TUBE_Y - 0.12, 0.66],
      [-0.53, TUBE_Y + 0.14, 0.6],
    ],
    0.016,
    ehtMat,
    { tubularSegments: 70, radialSegments: 10 },
  );
  chassis.add(ehtLead);

  const tunerCan = beveledBox(0.44, 0.16, 0.3, canMat, 0.012);
  tunerCan.position.set(0.72, CHASSIS_Y + 0.09, -0.42);
  chassis.add(tunerCan);
  const mainsTx = beveledBox(0.3, 0.24, 0.28, ferriteMat, 0.012);
  mainsTx.position.set(0.78, CHASSIS_Y + 0.13, 0.28);
  chassis.add(mainsTx);
  const heatsink = beveledBox(0.05, 0.24, 0.34, canMat, 0.008);
  heatsink.position.set(0.2, CHASSIS_Y + 0.13, -0.35);
  chassis.add(heatsink);
  for (let i = 0; i < 6; i++) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.16, 14), canMat);
    cap.position.set(-0.22 + i * 0.12, CHASSIS_Y + 0.09, 0.06 + (i % 2) * 0.16);
    chassis.add(cap);
  }
  for (let i = 0; i < 4; i++) {
    const cap = new THREE.Mesh(new THREE.CylinderGeometry(0.026, 0.026, 0.1, 12), trimMat);
    cap.position.set(0.42, CHASSIS_Y + 0.06, -0.05 + i * 0.11);
    chassis.add(cap);
  }
  const chassisLed = new THREE.Mesh(
    new THREE.SphereGeometry(0.016, 10, 8),
    new THREE.MeshBasicMaterial({ color: 0x64ff9a, transparent: true, opacity: 1, depthWrite: false }),
  );
  chassisLed.position.set(0.98, CHASSIS_Y + 0.04, 0.02);
  chassis.add(chassisLed);

  // neck board, plugged straight onto the tube base
  const neckBoard = box(0.34, 0.34, 0.016, pcbMat);
  neckBoard.position.set(0, TUBE_Y, NECK_BACK_Z - 0.11);
  chassis.add(neckBoard);
  const neckSocket = new THREE.Mesh(new THREE.CylinderGeometry(0.085, 0.085, 0.06, 20), trimMat);
  neckSocket.rotation.x = Math.PI / 2;
  neckSocket.position.set(0, TUBE_Y, NECK_BACK_Z - 0.09);
  chassis.add(neckSocket);
  const yokeCable = tubeAlong(
    [
      [0.0, TUBE_Y - 0.2, NECK_BACK_Z - 0.09],
      [0.35, TUBE_Y - 0.55, -0.35],
      [0.45, CHASSIS_Y + 0.06, -0.3],
    ],
    0.018,
    tapeMat,
    { tubularSegments: 40, radialSegments: 8 },
  );
  chassis.add(yokeCable);
  const yokeLead = tubeAlong(
    [
      [0.18, TUBE_Y - 0.14, YOKE_Z1 - 0.06],
      [0.42, TUBE_Y - 0.55, 0.05],
      [0.5, CHASSIS_Y + 0.06, -0.12],
    ],
    0.016,
    tapeMat,
    { tubularSegments: 40, radialSegments: 8 },
  );
  chassis.add(yokeLead);

  // ==========================================================================
  //  THE PICTURE — one small canvas the phosphor panel is textured with.
  //  Everything here is drawn from the beam's own position, so what the screen
  //  shows can never disagree with where the model says the beam is.
  // ==========================================================================
  const scrCanvas = document.createElement('canvas');
  scrCanvas.width = SCR_W;
  scrCanvas.height = SCR_H;
  const scrCtx = scrCanvas.getContext('2d');
  const scrImg = scrCtx.createImageData(SCR_W, SCR_H);
  const scrTex = new THREE.CanvasTexture(scrCanvas);
  scrTex.colorSpace = THREE.SRGBColorSpace;
  scrTex.minFilter = THREE.LinearFilter;
  scrTex.magFilter = THREE.LinearFilter;
  scrTex.generateMipmaps = false;
  phosphor.material.map = scrTex;

  // 75% colour bars over a live lower band — a real broadcast test signal, and
  // deliberately not full white, so the clipping gate has room.
  const BARS = [
    [0.75, 0.75, 0.75],
    [0.75, 0.75, 0],
    [0, 0.75, 0.75],
    [0, 0.75, 0],
    [0.75, 0, 0.75],
    [0.75, 0, 0],
    [0, 0, 0.75],
  ];
  const _rgb = [0, 0, 0];
  function pictureAt(xn, yn, u) {
    if (yn < 0.7) {
      const b = BARS[Math.min(6, Math.floor(xn * 7))];
      _rgb[0] = b[0];
      _rgb[1] = b[1];
      _rgb[2] = b[2];
    } else if (yn < 0.84) {
      const t = frac(xn + u);
      _rgb[0] = 0.34 + 0.34 * Math.sin(TAU * t);
      _rgb[1] = 0.34 + 0.34 * Math.sin(TAU * (t + 1 / 3));
      _rgb[2] = 0.34 + 0.34 * Math.sin(TAU * (t + 2 / 3));
    } else {
      const s = Math.floor(frac(xn + u * 0.5) * 8) / 7;
      _rgb[0] = s * 0.7;
      _rgb[1] = s * 0.7;
      _rgb[2] = s * 0.7;
    }
    return _rgb;
  }

  // Where the beam is, as a fraction of the screen, at lap phase u.
  function spotAt(u, nl, fields) {
    if (fields === 2) {
      const f = u < 0.5 ? 0 : 1;
      const g = ((u - f * 0.5) * 2) / V_FRAC;
      if (g >= 1) return { xn: 0, yn: 0.5, blank: true };
      const half = nl / 2;
      const li = Math.min(half - 1, Math.floor(g * half));
      const within = g * half - li;
      const active = within < H_ACT;
      return {
        xn: active ? within / H_ACT : 1 - (within - H_ACT) / (1 - H_ACT),
        yn: (li * 2 + f + 0.5) / nl,
        blank: !active,
      };
    }
    const g = u / V_FRAC;
    if (g >= 1) return { xn: 0, yn: 0.5, blank: true };
    const li = Math.min(nl - 1, Math.floor(g * nl));
    const within = g * nl - li;
    const active = within < H_ACT;
    return {
      xn: active ? within / H_ACT : 1 - (within - H_ACT) / (1 - H_ACT),
      yn: (li + 0.5) / nl,
      blank: !active,
    };
  }

  // How brightly a given pixel is still glowing: how long ago the beam swept
  // it, run through the phosphor's exponential decay. A pixel the beam has not
  // reached yet on the current line reads as not-yet-drawn, which is what
  // makes the leading edge of the sweep visible at all.
  function rasterGain(xn, yn, u, nl, fields, decay) {
    const lineIdx = Math.min(nl - 1, Math.floor(yn * nl));
    let tRow;
    let lineDur;
    if (fields === 2) {
      const parity = lineIdx & 1;
      lineDur = (V_FRAC * 0.5) / (nl / 2);
      tRow = parity * 0.5 + ((lineIdx - parity) / 2) * lineDur;
    } else {
      lineDur = V_FRAC / nl;
      tRow = lineIdx * lineDur;
    }
    let age = u - tRow;
    if (age < 0) age += 1;
    if (age < lineDur * H_ACT && xn > age / (lineDur * H_ACT)) return 0;
    return Math.exp(-age / decay);
  }

  function paintScreen(screenMode, beamMode, u, spot) {
    const d = scrImg.data;
    if (screenMode === 'off') {
      for (let i = 0; i < d.length; i += 4) {
        d[i] = 0;
        d[i + 1] = 0;
        d[i + 2] = 0;
        d[i + 3] = 255;
      }
      scrCtx.putImageData(scrImg, 0, 0);
      scrTex.needsUpdate = true;
      return;
    }
    const ilace = beamMode === 'interlace';
    const nl = ilace ? LINES_ILACE : LINES_SCAN;
    const fields = ilace ? 2 : 1;
    const decay = ilace ? 0.12 : DECAY;

    // switch-on envelope: the picture opens out of a bright centre line, the
    // way a warming CRT actually does, and closes back to it before the wrap
    let openness = 1;
    let wobble = 0;
    if (screenMode === 'warm') {
      // The opening is centred so that HALF-open lands on u=0.30 and the full
      // picture on u=0.60 — the only two instants any screenshot, reviewer or
      // label probe ever sees.
      if (u < 0.18) openness = 0;
      else if (u < 0.42) openness = (u - 0.18) / 0.24;
      else if (u < 0.86) openness = 1;
      else if (u < 0.96) openness = 1 - (u - 0.86) / 0.1;
      else openness = 0;
      // the degauss shudder, decaying away over about a fifth of the lap
      if (u > 0.2 && u < 0.42) wobble = Math.exp(-(u - 0.2) * 18) * Math.sin((u - 0.2) * 175);
    }

    let p = 0;
    for (let row = 0; row < SCR_H; row++) {
      const yn = (row + 0.5) / SCR_H;
      const scan = row % 2 === 0 ? 1 : 0.58;
      let vGain = 1;
      if (screenMode === 'warm') {
        const half = 0.5 * openness;
        const dy = Math.abs(yn - 0.5);
        vGain = dy < half || dy < 0.012 ? 1 : 0;
      }
      const dyHot = (yn - spot.yn) * (SCREEN_H / SCREEN_W);
      for (let col = 0; col < SCR_W; col++) {
        const xn = (col + 0.5) / SCR_W;
        let g = vGain * scan;
        if (g > 0 && screenMode === 'raster') g *= rasterGain(xn, yn, u, nl, fields, decay);
        let r = 0;
        let gr = 0;
        let b = 0;
        if (g > 0.002) {
          const c = pictureAt(clamp01(xn + wobble * 0.04), yn, u);
          r = c[0] * g;
          gr = c[1] * g;
          b = c[2] * g;
        }
        if (screenMode === 'raster' && !spot.blank) {
          const dx = xn - spot.xn;
          const hot = Math.exp(-(dx * dx + dyHot * dyHot) / 0.0004) * 0.3;
          r += hot;
          gr += hot;
          b += hot;
        }
        d[p] = Math.min(255, r * 255);
        d[p + 1] = Math.min(255, gr * 255);
        d[p + 2] = Math.min(255, b * 255);
        d[p + 3] = 255;
        p += 4;
      }
    }
    scrCtx.putImageData(scrImg, 0, 0);
    scrTex.needsUpdate = true;
  }

  // ==========================================================================
  //  THE BEAMS — three dot trains riding the real gun-to-phosphor path
  // ==========================================================================
  const beams = new THREE.Group();
  beams.position.set(0, TUBE_Y, 0);
  group.add(beams);

  const NDOTS = 7; // odd, and 3 transits per lap — see the seamless-loop note
  const TRANSITS = 3;
  const beamDots = [];
  for (let i = 0; i < 3; i++) {
    const train = [];
    for (let j = 0; j < NDOTS; j++) {
      const dot = electronDot(BEAM_COLORS[i]);
      beams.add(dot);
      train.push(dot);
    }
    beamDots.push(train);
  }

  const _spot = new THREE.Vector3();
  const _pa = new THREE.Vector3();
  const _pb = new THREE.Vector3();
  const _out = new THREE.Vector3();

  function spotPoint(sx, sy, out) {
    const f = Math.min(1, Math.hypot(sx, sy) / 1.25);
    out.set((sx * SCREEN_W) / 2, (sy * SCREEN_H) / 2, PHOS_Z + PHOS_BULGE * (1 - f * f) - 0.006);
  }

  // Gun -> deflection centre -> wherever the beam is being pointed. Everything
  // downstream of the deflection centre is one straight line, which is exactly
  // why the yoke has to do all the aiming.
  function pathPoint(i, s, target, out) {
    _pa.set((i - 1) * GUN_DX, 0, GUN_Z);
    _pb.set((i - 1) * GUN_DX * 0.55, 0, DEFL_Z);
    const l1 = _pa.distanceTo(_pb);
    const l2 = _pb.distanceTo(target);
    const d = s * (l1 + l2);
    if (d <= l1) out.lerpVectors(_pa, _pb, d / l1);
    else out.lerpVectors(_pb, target, (d - l1) / l2);
  }

  // ==========================================================================
  //  MACRO INSERT — the mask and the phosphor at a size you can actually see.
  //  Ratios are honest, absolute size and the beam angles are not; the copy
  //  and a callout both say so.
  // ==========================================================================
  const insert = new THREE.Group();
  insert.position.copy(INSERT_POS);
  insert.visible = false;
  group.add(insert);

  const COLS = 7;
  const ROWS = 5;
  const TRIAD_X = 0.13;
  const TRIAD_Y = 0.135;
  const STRIPE_X = 0.043;
  const MASK_GAP = 0.22;

  const stripeMat = new THREE.MeshBasicMaterial({ color: 0xffffff });
  const stripes = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.034, 0.115, 0.01),
    stripeMat,
    COLS * ROWS * 3,
  );
  stripes.castShadow = false;
  const _m4 = new THREE.Matrix4();
  let si = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      for (let k = 0; k < 3; k++) {
        _m4.makeTranslation((c - 3) * TRIAD_X + (k - 1) * STRIPE_X, (r - 2) * TRIAD_Y, 0);
        stripes.setMatrixAt(si, _m4);
        si++;
      }
    }
  }
  stripes.instanceMatrix.needsUpdate = true;
  insert.add(stripes);

  // the aluminium film behind the phosphor: mirrors the light forward, and the
  // electrons go straight through it
  const backing = beveledBox(1.0, 0.78, 0.014, materials.chrome(0xa9b2bd), 0.006);
  backing.position.z = -0.018;
  insert.add(backing);

  const insertGlass = beveledBox(1.06, 0.84, 0.03, glassMat, 0.008);
  insertGlass.position.z = 0.05;
  insert.add(insertGlass);

  // the mask itself, holes and all
  const maskShape = new THREE.Shape();
  maskShape.moveTo(-0.53, -0.4);
  maskShape.lineTo(0.53, -0.4);
  maskShape.lineTo(0.53, 0.4);
  maskShape.lineTo(-0.53, 0.4);
  maskShape.closePath();
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      const h = new THREE.Path();
      h.absarc((c - 3) * TRIAD_X, (r - 2) * TRIAD_Y, 0.03, 0, TAU, true);
      maskShape.holes.push(h);
    }
  }
  const insertMask = new THREE.Mesh(
    new THREE.ExtrudeGeometry(maskShape, { depth: 0.022, bevelEnabled: false, curveSegments: 12 }),
    new THREE.MeshStandardMaterial({
      color: 0x7c828a,
      roughness: 0.62,
      metalness: 0.9,
      side: THREE.DoubleSide,
    }),
  );
  insertMask.position.z = -MASK_GAP - 0.011;
  insert.add(insertMask);

  // slim frame, so the block reads as an exhibit rather than floating debris
  for (const [fx, fy, fw, fh] of [
    [0, 0.43, 1.14, 0.026],
    [0, -0.43, 1.14, 0.026],
    [-0.557, 0, 0.026, 0.884],
    [0.557, 0, 0.026, 0.884],
  ]) {
    const bar = beveledBox(fw, fh, 0.075, materials.polymer(0x3c4149), 0.008);
    bar.position.set(fx, fy, 0.03);
    insert.add(bar);
  }

  // three beams arriving at one hole from three angles, and leaving it aimed
  // at three different stripes — the whole trick, drawn at a size that reads
  const insertBeamDots = [];
  for (let i = 0; i < 3; i++) {
    const train = [];
    for (let j = 0; j < NDOTS; j++) {
      const dot = electronDot(BEAM_COLORS[i], 0.022);
      insert.add(dot);
      train.push(dot);
    }
    insertBeamDots.push(train);
  }
  const _ia = new THREE.Vector3();
  const _ib = new THREE.Vector3();
  const _ic = new THREE.Vector3();
  function insertPath(i, s, out) {
    const slope = ((i - 1) * STRIPE_X) / MASK_GAP;
    _ia.set(slope * -0.65, 0, -0.95);
    _ib.set(0, 0, -MASK_GAP);
    _ic.set((i - 1) * STRIPE_X, 0, 0);
    const l1 = _ia.distanceTo(_ib);
    const l2 = _ib.distanceTo(_ic);
    const d = s * (l1 + l2);
    if (d <= l1) out.lerpVectors(_ia, _ib, d / l1);
    else out.lerpVectors(_ib, _ic, (d - l1) / l2);
  }

  // and the great majority that never make it: electrons landing on metal
  const BLOCKED = [
    [-0.195, 0.0675],
    [0.195, 0.0675],
    [0.065, -0.0675],
  ];
  const blockedDots = [];
  const blockedGlows = [];
  for (const [bx, by] of BLOCKED) {
    const train = [];
    for (let j = 0; j < 4; j++) {
      const dot = electronDot(0xbfc6d0, 0.012);
      insert.add(dot);
      train.push(dot);
    }
    blockedDots.push({ train, bx, by });
    const glow = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 12, 10),
      new THREE.MeshBasicMaterial({ color: 0xffa860, transparent: true, opacity: 0, depthWrite: false }),
    );
    glow.position.set(bx, by, -MASK_GAP + 0.014);
    insert.add(glow);
    blockedGlows.push(glow);
  }

  // ==========================================================================
  //  SAMPLED-PATCH MARKER — ties the detail block back to a real square inch
  // ==========================================================================
  const patch = new THREE.Group();
  patch.visible = false;
  group.add(patch);
  const markMat = new THREE.MeshBasicMaterial({
    color: 0x8ef05a,
    transparent: true,
    opacity: 0.6,
    depthWrite: false,
  });
  // the tether back to the screen is deliberately faint — it is a reference
  // line, not a part of the machine
  const leadMat = markMat.clone();
  leadMat.opacity = 0.22;
  const PATCH_X = 0.36 * (SCREEN_W / 2);
  const PATCH_Y = TUBE_Y + 0.34 * (SCREEN_H / 2);
  const PATCH_Z = 1.155;
  for (const [mx, my, mw, mh] of [
    [0, 0.075, 0.2, 0.008],
    [0, -0.075, 0.2, 0.008],
    [-0.096, 0, 0.008, 0.158],
    [0.096, 0, 0.008, 0.158],
  ]) {
    const bar = box(mw, mh, 0.008, markMat);
    bar.position.set(PATCH_X + mx, PATCH_Y + my, PATCH_Z);
    patch.add(bar);
  }
  const patchLead = tubeAlong(
    [
      [PATCH_X + 0.1, PATCH_Y + 0.05, PATCH_Z],
      [1.55, TUBE_Y + 0.72, 1.25],
      [INSERT_POS.x - 0.5, INSERT_POS.y - 0.35, INSERT_POS.z + 0.1],
    ],
    0.0045,
    leadMat,
    { tubularSegments: 40, radialSegments: 6 },
  );
  patch.add(patchLead);

  // ==========================================================================
  //  POSE — one lap phase, evaluated against the pinned mode flags
  // ==========================================================================
  const state = { mode: 'off', screen: 'bars', macro: 'off', sway: 0 };
  const lastSpot = { xn: 0.5, yn: 0.5, blank: false };
  const _col = new THREE.Color();

  function updateBeams(u) {
    if (state.mode === 'off') {
      for (const train of beamDots) for (const dot of train) dot.visible = false;
      lastSpot.xn = 0.5;
      lastSpot.yn = 0.5;
      lastSpot.blank = true;
      return;
    }
    let sx = 0;
    let sy = 0;
    if (state.mode === 'scan' || state.mode === 'interlace') {
      const ilace = state.mode === 'interlace';
      const sp = spotAt(u, ilace ? LINES_ILACE : LINES_SCAN, ilace ? 2 : 1);
      lastSpot.xn = sp.xn;
      lastSpot.yn = sp.yn;
      lastSpot.blank = sp.blank;
      sx = sp.xn * 2 - 1;
      sy = 1 - sp.yn * 2;
    } else {
      lastSpot.xn = 0.5;
      lastSpot.yn = 0.5;
      lastSpot.blank = false;
    }
    spotPoint(sx, sy, _spot);
    const sMax = state.mode === 'gun' ? 0.3 : 1;
    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < NDOTS; j++) {
        const dot = beamDots[i][j];
        const s = frac(u * TRANSITS + j / NDOTS);
        if (lastSpot.blank || s > sMax) {
          dot.visible = false;
          continue;
        }
        pathPoint(i, s, _spot, _out);
        dot.position.copy(_out);
        dot.visible = true;
        dot.material.opacity = 0.45 + 0.55 * Math.sin(Math.PI * clamp01(s / sMax));
      }
    }
  }

  const MIX = [
    [1, 0, 0],
    [1, 1, 0],
    [0, 1, 0],
    [0, 1, 1],
    [0, 0, 1],
    [1, 0, 1],
    [1, 1, 1],
    [1, 0, 0],
  ];
  const STRIPE_FLOOR = 0.045;

  function updateInsert(u) {
    if (state.macro === 'off') return;
    const colourMode = state.macro === 'colour';
    let idx = 0;
    for (let r = 0; r < ROWS; r++) {
      for (let c = 0; c < COLS; c++) {
        let lv = [0, 0, 0];
        if (colourMode) {
          const t = frac(u + c * 0.11 + r * 0.07) * (MIX.length - 1);
          const i0 = Math.floor(t);
          const tt = t - i0;
          const a = MIX[i0];
          const b = MIX[Math.min(i0 + 1, MIX.length - 1)];
          lv = [a[0] + (b[0] - a[0]) * tt, a[1] + (b[1] - a[1]) * tt, a[2] + (b[2] - a[2]) * tt];
        } else if (r === 2 && c === 3) {
          lv = [1, 1, 1];
        } else {
          lv = [0.12, 0.12, 0.12];
        }
        for (let k = 0; k < 3; k++) {
          const v = STRIPE_FLOOR + lv[k] * (0.92 - STRIPE_FLOOR);
          _col.setRGB(k === 0 ? v : 0.02, k === 1 ? v : 0.02, k === 2 ? v : 0.02);
          stripes.setColorAt(idx, _col);
          idx++;
        }
      }
    }
    stripes.instanceColor.needsUpdate = true;

    for (let i = 0; i < 3; i++) {
      for (let j = 0; j < NDOTS; j++) {
        const dot = insertBeamDots[i][j];
        const s = frac(u * TRANSITS + j / NDOTS);
        insertPath(i, s, _out);
        dot.position.copy(_out);
        dot.visible = true;
        dot.material.opacity = 0.4 + 0.6 * Math.sin(Math.PI * s);
      }
    }
    for (let k = 0; k < blockedDots.length; k++) {
      const { train, bx, by } = blockedDots[k];
      let hit = 0;
      for (let j = 0; j < train.length; j++) {
        const dot = train[j];
        const s = frac(u * TRANSITS + j / train.length + k * 0.17);
        dot.position.set(bx * (1 + 0.3 * (1 - s)), by * (1 + 0.3 * (1 - s)), -0.72 + s * 0.43);
        dot.visible = !colourMode;
        dot.material.opacity = colourMode ? 0 : 0.25 + 0.6 * s;
        hit = Math.max(hit, s > 0.72 ? (s - 0.72) / 0.28 : 0);
      }
      blockedGlows[k].material.opacity = colourMode ? 0 : hit * 0.75;
      blockedGlows[k].visible = !colourMode;
    }
  }

  function setPhase(u) {
    const t = clamp01(u);
    group.rotation.y = THREE.MathUtils.degToRad(state.sway) * Math.sin(TAU * t);
    for (let i = 0; i < heaters.length; i++) {
      heaters[i].material.opacity =
        state.mode === 'off' ? 0.12 : 0.62 + 0.34 * Math.sin(TAU * (3 * t + i / 3));
    }
    chassisLed.material.opacity = 0.45 + 0.5 * Math.sin(TAU * t);
    updateBeams(t);
    updateInsert(t);
    paintScreen(state.screen, state.mode, t, lastSpot);
  }

  function setMode(m) {
    state.mode = m;
  }
  function setScreen(m) {
    state.screen = m;
  }
  function setSwayAmp(deg) {
    state.sway = deg;
    group.rotation.y = 0;
  }
  function setMacro(m) {
    state.macro = m;
    insert.visible = m !== 'off';
  }
  function setPatch(v) {
    patch.visible = !!v;
  }

  // Ghost the cabinet away. Metal is never faded (it cannot be — it just
  // hides); the polymer shell fades AND drops its clearcoat, because coat
  // specular renders at full strength no matter what the opacity says.
  function setReveal(r) {
    const k = clamp01(r);
    for (const mat of shellMats) {
      mat.transparent = k > 0.01;
      mat.opacity = 1 - 0.93 * k;
      mat.depthWrite = k < 0.01;
      if (mat.clearcoat !== undefined) mat.clearcoat = 0.15 * (1 - k);
    }
    hideOnReveal.visible = k < 0.5;
    rimBand.visible = true;
  }

  // ==========================================================================
  //  CALLOUTS
  // ==========================================================================
  const labels = calloutSets([
    'exterior',
    'inside',
    'gun',
    'anode',
    'yoke',
    'scan',
    'mask',
    'phosphor',
  ]);

  labels.add('exterior', group, 'Picture tube · 20 in', [0.45, TUBE_Y + 0.3, FRONT_Z + 0.02], 34, 95);
  labels.add('exterior', group, 'Speaker grille', [1.19, TUBE_Y + 0.5, FRONT_Z + 0.02], 52, 78);
  labels.add('exterior', group, 'Controls', [0.65, CAB_Y0 + 0.19, FRONT_Z + 0.03], -46, 72);
  labels.add('exterior', group, '460 mm of depth', [0.95, CAB_Y0 + CAB_H - 0.04, -0.35], 58, 88);

  labels.add('inside', tube, 'Faceplate glass', [0.62, 0.46, 1.09], 12, 62);
  labels.add('inside', tube, 'Funnel', [0.5, -0.36, 0.62], -44, 74);
  labels.add('inside', tube, 'Neck', [0.06, 0.09, -0.34], 58, 74);
  labels.add('inside', group, 'Deflection yoke', [0.2, TUBE_Y + 0.2, 0.2], 30, 92);
  labels.add('inside', group, 'Chassis board', [0.45, CHASSIS_Y + 0.06, 0.34], -40, 84);
  labels.add('inside', group, 'Flyback transformer', [-0.62, CHASSIS_Y + 0.37, -0.42], 46, 98);
  labels.add('inside', tube, 'Degaussing coil', [-0.86, 0.72, 0.9], 34, 58);

  labels.add('gun', gun, 'Cathode · 800 °C', [-GUN_DX, 0.02, GUN_Z], 44, 88);
  labels.add('gun', gun, 'Control grid G1', [0.02, 0.05, GUN_Z + 0.055], 16, 96);
  labels.add('gun', gun, 'Focus electrodes', [0.02, 0.07, GUN_Z + 0.35], 38, 90);
  labels.add('gun', tube, 'Getter ring', [0.04, 0.02, NECK_JOIN_Z - 0.03], -44, 56);

  labels.add('anode', tube, 'Anode button · 25 kV', [-0.5, 0.18, 0.62], 40, 96);
  labels.add('anode', tube, 'Aquadag coating', [-0.4, -0.32, 0.44], -42, 86);
  labels.add('anode', group, 'Flyback transformer', [-0.62, CHASSIS_Y + 0.37, -0.42], 48, 98);
  labels.add('anode', group, 'EHT lead', [-0.86, TUBE_Y - 0.2, 0.05], -34, 72);

  labels.add('yoke', yoke, 'Horizontal coils', [-0.115, 0.0, 0.16], 36, 90);
  labels.add('yoke', yoke, 'Vertical coils', [0.0, 0.21, 0.19], 82, 118);
  labels.add('yoke', yoke, 'Ferrite ring', [-0.12, -0.19, 0.31], -46, 80);
  labels.add('yoke', gun, 'Purity magnets', [0.02, 0.09, -0.2], 52, 86);

  labels.add('scan', tube, 'One dot, moving', [0.42, 0.22, 1.17], 32, 92);
  labels.add('scan', tube, 'Blanked retrace', [-0.62, -0.1, 1.17], -34, 88);
  labels.add('scan', tube, 'Odd lines, then even', [0.5, -0.46, 1.17], -26, 96);

  labels.add('mask', insert, 'Shadow mask', [0.34, 0.3, -MASK_GAP], 40, 84);
  labels.add('mask', insert, 'Most of them hit metal', [-0.2, 0.14, -MASK_GAP + 0.02], -40, 100);
  labels.add('mask', insert, 'Real pitch: 0.6 mm', [0.16, -0.43, 0.02], -72, 120);

  labels.add('phosphor', insert, 'Red · green · blue', [0.02, 0.02, 0.02], 42, 92);
  labels.add('phosphor', insert, 'Aluminised backing', [-0.36, -0.28, -0.02], -38, 92);
  labels.add('phosphor', insert, 'Gone in a millisecond', [0.36, 0.3, 0.03], 30, 96);

  // ==========================================================================
  //  INITIAL STATE
  // ==========================================================================
  setReveal(0);
  setMode('scan');
  setScreen('bars');
  setSwayAmp(0);
  setMacro('off');
  setPatch(false);
  setPhase(0);
  labels.setLabels(false);

  return {
    group,
    setPhase,
    setMode,
    setScreen,
    setReveal,
    setSwayAmp,
    setMacro,
    setPatch,
    setLabels: labels.setLabels,
    parts: { group, cabinet, tube, gun, yoke, chassis, beams, insert, patch, phosphor, mask },
  };
}
