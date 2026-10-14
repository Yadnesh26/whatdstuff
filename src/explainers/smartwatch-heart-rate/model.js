import * as THREE from 'three';
import { materials, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe } from '../../framework/geometry.js';
import { TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A generic (unbranded) smartwatch measuring heart rate optically, plus a
// magnified "macro insert" of its sensor resting on skin.
//
// MECHANISM (researched — see story.js for sources): reflectance
// photoplethysmography. Green LEDs (~530 nm) under the domed back crystal
// flash hundreds of times a second; light scatters through the skin and a
// small share curves back up to photodiodes a few millimetres away, with
// opaque light barriers stopping it leaking straight across. Blood absorbs
// green strongly, so when each heartbeat stretches the small arteries the
// returned light dips — by roughly 0.1-2 % of the total, the rest being a
// steady level from skin, tissue and venous blood. Arm motion makes much
// larger fake swings; an accelerometer measures the motion so it can be
// filtered out. The watch then times the gap between dips: 0.80 s = 75 BPM.
//
// PROPORTIONS — one scale, 1 unit = 20 mm:
//   case 1.9 W x 2.2 H x 0.5 T  (38 x 44 x 10 mm), corner radius 0.44
//   display 1.66 x 1.96, back crystal dome r 0.72 (29 mm) proud by 0.08
//   strap 1.1 wide (22 mm) x 0.1 thick, open, curving back as if off a wrist
// The macro insert is its own scale (block 2.8 wide = ~10 mm of skin):
//   LED to photodiode 0.85 (~3 mm), green light reaching ~0.2-0.6 deep
//   (1-2 mm), arteries exaggerated in size and swell for legibility.
//
// SCALARS (all from one pose call, tick(u, cfg), u = lap fraction 0..1):
//   beats  whole heartbeats per lap (ODD, so verify's half-lap-apart samples
//          land on different beat phases); the lap length is always
//          beats x 800 ms so every visible pulse is a true 75 BPM
//   phase  beat phase is offset so the systolic peak lands on u = 0.30 —
//          one of the two instants every screenshot/label probe samples
//   flashes / spin / sway / rock — whole cycles per lap (seamless)
// State flags pinned per step by view(): reveal (case off + exploded stack),
// macro (watch swapped for the skin insert), scope (readout plate), screen
// mode, labels.

export const BEAT_MS = 800; // 75 BPM

const CASE_W = 1.9;
const CASE_H = 2.2;
const CASE_T = 0.5;
const CASE_R = 0.44;
const DISP_W = 1.66;
const DISP_H = 1.96;
const DISP_R = 0.36;
const DOME_R = 0.72;
const DOME_H = 0.08;
const BACK_Z = -CASE_T / 2; // case back face
const COVER_T = 0.03;
const SENSOR_Z = BACK_Z - COVER_T - 0.002; // sensor parts sit just under the dome
const STRAP_W = 1.1;
const STRAP_T = 0.1;

const PLINTH_H = 0.26;
// lowest strap point is at local (y -1.6 - STRAP_T/2, z -1.0): rest it on the
// plinth and put the turntable axis straight through that contact point
const CASE_Z = 1.0;
const PIVOT_Y = PLINTH_H + 1.6 + STRAP_T / 2 + 0.004;
const INSERT_POS = new THREE.Vector3(0, 1.95, 0.4);

// macro insert layout (insert-local, skin surface at y = 0, cut face at +z)
const BLK_W = 2.8;
const BLK_D = 1.2;
const FACE_Z = BLK_D / 2;
const EPI = 0.08;
const DERM = 0.7;
const FAT = 1.35;
const ART_X = 0.42;
const ART_Y = -0.42;
const ART_R = 0.07;
const ART_SWELL = 0.33; // exaggerated (disclosed in the step hint)
const LED_Y = 0.12;
const PD_X = 0.85;
const PATH_DEPTHS = [0.2, 0.33, 0.45, 0.56];
const SLOTS = 5;

const frac = (x) => x - Math.floor(x);
const hash = (a, b, c) => frac(Math.sin(a * 12.9898 + b * 78.233 + c * 37.719) * 43758.5453);

// one heartbeat's arterial volume, p = beat phase 0..1, peaking at p 0.14
function beatShape(p) {
  let y = 0;
  for (const k of [-1, 0, 1]) {
    const q = p + k;
    // fast systolic rise, slow fall, then the small dicrotic wave
    const sig = q < 0.14 ? 0.055 : 0.16;
    y += Math.exp(-(((q - 0.14) / sig) ** 2)) + 0.22 * Math.exp(-(((q - 0.46) / 0.08) ** 2));
  }
  return y;
}
const beatPhase0 = (beats) => 0.14 - frac(0.3 * beats);

function roundedRect(w, h, r) {
  const s = new THREE.Shape();
  const x = -w / 2;
  const y = -h / 2;
  s.moveTo(x + r, y);
  s.lineTo(x + w - r, y);
  s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r);
  s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h);
  s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r);
  s.quadraticCurveTo(x, y, x + r, y);
  return s;
}

// ShapeGeometry UVs are raw shape coordinates — remap to 0..1 so a canvas
// texture spans the face exactly.
function normaliseUVs(geo, w, h) {
  const uv = geo.attributes.uv;
  for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) / w + 0.5, uv.getY(i) / h + 0.5);
  uv.needsUpdate = true;
}

// A flat strap swept along a curve in the local y-z plane. Cross-section is
// a stadium (flat faces, rounded edges) — width along x, thickness along the
// in-plane normal. The free end gets a cap; the start hides inside the case.
function strapGeometry(curve, segs = 90) {
  const prof = [];
  const half = STRAP_W / 2 - STRAP_T / 2;
  const rr = STRAP_T / 2;
  const arc = 8;
  for (let i = 0; i <= arc; i++) {
    const a = -Math.PI / 2 + (i / arc) * Math.PI;
    prof.push([half + Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  for (let i = 0; i <= arc; i++) {
    const a = Math.PI / 2 + (i / arc) * Math.PI;
    prof.push([-half + Math.cos(a) * rr, Math.sin(a) * rr]);
  }
  const M = prof.length;
  const pos = [];
  const uvs = [];
  const idx = [];
  const p = new THREE.Vector3();
  const t = new THREE.Vector3();
  for (let i = 0; i <= segs; i++) {
    const s = i / segs;
    curve.getPointAt(s, p);
    curve.getTangentAt(s, t);
    const ny = -t.z;
    const nz = t.y;
    for (let j = 0; j < M; j++) {
      const [px, pn] = prof[j];
      pos.push(px, p.y + ny * pn, p.z + nz * pn);
      uvs.push(s, j / M);
    }
  }
  for (let i = 0; i < segs; i++) {
    for (let j = 0; j < M; j++) {
      const a = i * M + j;
      const b = i * M + ((j + 1) % M);
      const c = (i + 1) * M + j;
      const d = (i + 1) * M + ((j + 1) % M);
      idx.push(a, c, b, b, c, d);
    }
  }
  // end cap (fan) at the free end
  const endC = pos.length / 3;
  curve.getPointAt(1, p);
  pos.push(0, p.y, p.z);
  uvs.push(1, 0.5);
  for (let j = 0; j < M; j++) idx.push(endC, segs * M + j, segs * M + ((j + 1) % M));
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Frame on the strap curve at s: point + in-plane normal pointing AWAY from
// the wrist centre (so the keeper holes sit on the outside face).
function strapFrame(curve, s, centre) {
  const p = curve.getPointAt(s);
  const t = curve.getTangentAt(s);
  const n = new THREE.Vector3(0, -t.z, t.y);
  if (n.dot(p.clone().sub(centre)) < 0) n.negate();
  return { p, t, n };
}

export function buildSmartwatch({ scene }) {
  const root = new THREE.Group();
  scene.add(root);
  const hero = new THREE.Group(); // what the hero bob moves (not the plinth)
  root.add(hero);

  const plinth = studioPlinth({ w: 3.2, d: 2.9, color: 0x17191d });
  root.add(plinth);

  // --- materials -------------------------------------------------------------
  // smooth anodised aluminium — the cast-grain preset read as hammered metal
  // at watch scale
  const caseMat = new THREE.MeshPhysicalMaterial({ color: 0x8f949b, metalness: 1, roughness: 0.36 });
  const crownMat = materials.aluminum(0x9aa0a7);
  crownMat.roughness = 0.5;
  const darkGlass = new THREE.MeshPhysicalMaterial({ color: 0x050608, roughness: 0.1, metalness: 0, clearcoat: 0.6, clearcoatRoughness: 0.08 });
  const ceramic = new THREE.MeshPhysicalMaterial({ color: 0x16181c, roughness: 0.34, metalness: 0, clearcoat: 0.4, clearcoatRoughness: 0.2 });
  const matteBlack = new THREE.MeshPhysicalMaterial({ color: 0x0a0b0d, roughness: 0.9, metalness: 0 });
  const domeMat = new THREE.MeshPhysicalMaterial({
    color: 0x1a2028,
    roughness: 0.05,
    metalness: 0,
    transparent: true,
    opacity: 0.32,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const strapMat = new THREE.MeshPhysicalMaterial({ color: 0x2a2e35, roughness: 0.72, metalness: 0, sheen: 0.35, sheenRoughness: 0.6, sheenColor: new THREE.Color(0x6a7280) });
  const pdMat = new THREE.MeshPhysicalMaterial({ color: 0x262d5c, roughness: 0.25, metalness: 0.2, iridescence: 0.5, iridescenceIOR: 1.4, emissive: 0x2bd96b, emissiveIntensity: 0 });
  const ledGreen = new THREE.MeshStandardMaterial({ color: 0x1c3a24, emissive: 0x3dff6a, emissiveIntensity: 0 });
  const ledRed = new THREE.MeshStandardMaterial({ color: 0x3a1414, emissive: 0xff3030, emissiveIntensity: 0.05 });
  const ledIR = new THREE.MeshStandardMaterial({ color: 0x241418, roughness: 0.4 });
  const boardMat = new THREE.MeshPhysicalMaterial({ color: 0x12161b, roughness: 0.5, metalness: 0.1 });
  const chipMat = new THREE.MeshPhysicalMaterial({ color: 0x2a2d33, roughness: 0.42, metalness: 0.1 });
  const accelMat = new THREE.MeshPhysicalMaterial({ color: 0x2f3238, roughness: 0.4, metalness: 0.1, emissive: 0xffb347, emissiveIntensity: 0 });
  const afeMat = new THREE.MeshPhysicalMaterial({ color: 0x2f3238, roughness: 0.4, metalness: 0.1, emissive: 0x4ef08a, emissiveIntensity: 0 });
  const goldMat = new THREE.MeshPhysicalMaterial({ color: 0xd4a94a, roughness: 0.35, metalness: 1 });
  const batteryMat = new THREE.MeshPhysicalMaterial({ color: 0x9aa1aa, roughness: 0.5, metalness: 0.55 });
  const labelMat = new THREE.MeshPhysicalMaterial({ color: 0x1d3a5a, roughness: 0.6 });

  const labels = calloutSets(['exterior', 'sensor', 'skin', 'beat', 'internal']);

  // =========================================================================
  // THE WATCH
  // =========================================================================
  const pivot = new THREE.Group(); // turntable axis through the strap's contact point
  pivot.position.set(0, PIVOT_Y, 0);
  hero.add(pivot);
  const watch = new THREE.Group(); // case centre
  watch.position.set(0, 0, CASE_Z);
  pivot.add(watch);

  const shell = new THREE.Group(); // case + crown + button + straps — hidden on reveal
  watch.add(shell);

  // --- case: rounded-rectangle slab, edges rounded by the extrude bevel ------
  const B = 0.07;
  const caseGeo = new THREE.ExtrudeGeometry(roundedRect(CASE_W - 2 * B, CASE_H - 2 * B, CASE_R - B), {
    depth: CASE_T - 2 * B,
    bevelEnabled: true,
    bevelThickness: B,
    bevelSize: B,
    bevelSegments: 6,
    curveSegments: 40,
  });
  caseGeo.translate(0, 0, -(CASE_T - 2 * B) / 2);
  const caseMesh = new THREE.Mesh(caseGeo, caseMat);
  caseMesh.castShadow = true;
  shell.add(caseMesh);

  // band slots top and bottom
  for (const s of [1, -1]) {
    const slot = beveledBox(STRAP_W + 0.12, 0.02, 0.16, matteBlack, 0.008);
    slot.position.set(0, s * (CASE_H / 2 - 0.006), -0.02);
    shell.add(slot);
  }

  // digital crown (knurled) + side button on +x; speaker slots on -x
  const crown = new THREE.Group();
  crown.position.set(CASE_W / 2 + 0.005, 0.42, 0);
  shell.add(crown);
  const crownBody = new THREE.Mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.14, 48), crownMat);
  crownBody.rotation.z = Math.PI / 2;
  crownBody.position.x = 0.07;
  crown.add(crownBody);
  const crownCap = new THREE.Mesh(new THREE.SphereGeometry(0.16, 32, 12, 0, TAU, 0, 0.5), crownMat);
  crownCap.rotation.z = -Math.PI / 2;
  crownCap.position.x = 0.14 - 0.16 * Math.cos(0.5);
  crown.add(crownCap);
  const ridgeGeo = new THREE.BoxGeometry(0.12, 0.012, 0.02);
  for (let i = 0; i < 36; i++) {
    const a = (i / 36) * TAU;
    const r = new THREE.Mesh(ridgeGeo, crownMat);
    r.position.set(0.07, Math.cos(a) * 0.162, Math.sin(a) * 0.162);
    r.rotation.x = a;
    crown.add(r);
  }
  const button = beveledBox(0.06, 0.52, 0.17, crownMat, 0.03);
  button.position.set(CASE_W / 2 + 0.02, -0.32, 0);
  shell.add(button);
  for (const y of [-0.15, 0.2]) {
    const slotS = beveledBox(0.02, 0.32, 0.05, matteBlack, 0.01);
    slotS.position.set(-CASE_W / 2 + 0.004, y, 0);
    shell.add(slotS);
  }

  // --- straps -----------------------------------------------------------------
  const wristC = new THREE.Vector3(0, 0, -1.0);
  const topCurve = new THREE.CatmullRomCurve3(
    [[1.0, -0.04], [1.3, -0.18], [1.52, -0.55], [1.6, -1.0], [1.5, -1.45], [1.26, -1.82]].map(([y, z]) => new THREE.Vector3(0, y, z)),
  );
  const botCurve = new THREE.CatmullRomCurve3(
    [[-1.0, -0.04], [-1.3, -0.18], [-1.52, -0.55], [-1.6, -1.0], [-1.52, -1.45], [-1.3, -1.84], [-0.98, -2.12]].map(([y, z]) => new THREE.Vector3(0, y, z)),
  );
  for (const c of [topCurve, botCurve]) {
    const m = new THREE.Mesh(strapGeometry(c), strapMat);
    m.castShadow = true;
    shell.add(m);
  }
  // keeper holes on the long strap
  const holeGeo = new THREE.CylinderGeometry(0.034, 0.034, 0.02, 20);
  for (let i = 0; i < 7; i++) {
    const { p, n } = strapFrame(botCurve, 0.5 + i * 0.065, wristC);
    const h = new THREE.Mesh(holeGeo, matteBlack);
    h.position.copy(p).addScaledVector(n, STRAP_T / 2 - 0.006);
    h.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), n);
    shell.add(h);
  }
  // --- display module (front) ------------------------------------------------
  const displayMod = new THREE.Group();
  watch.add(displayMod);
  const glassGeo = new THREE.ExtrudeGeometry(roundedRect(DISP_W - 0.04, DISP_H - 0.04, DISP_R - 0.02), {
    depth: 0.03,
    bevelEnabled: true,
    bevelThickness: 0.02,
    bevelSize: 0.02,
    bevelSegments: 4,
    curveSegments: 32,
  });
  const glass = new THREE.Mesh(glassGeo, darkGlass);
  glass.position.z = CASE_T / 2 - 0.04;
  displayMod.add(glass);

  const SCR_W = 512;
  const SCR_H = Math.round((SCR_W * DISP_H) / DISP_W);
  const scrCanvas = document.createElement('canvas');
  scrCanvas.width = SCR_W;
  scrCanvas.height = SCR_H;
  const scr = scrCanvas.getContext('2d');
  const scrTex = new THREE.CanvasTexture(scrCanvas);
  scrTex.colorSpace = THREE.SRGBColorSpace;
  scrTex.anisotropy = 8;
  const screenGeo = new THREE.ShapeGeometry(roundedRect(DISP_W - 0.02, DISP_H - 0.02, DISP_R - 0.01), 24);
  normaliseUVs(screenGeo, DISP_W - 0.02, DISP_H - 0.02);
  const screenMat = new THREE.MeshPhysicalMaterial({
    color: 0x111111,
    map: scrTex,
    emissive: 0xffffff,
    emissiveMap: scrTex,
    emissiveIntensity: 0.9,
    roughness: 0.18,
    metalness: 0,
    clearcoat: 0.5,
    clearcoatRoughness: 0.08,
  });
  const screen = new THREE.Mesh(screenGeo, screenMat);
  screen.position.z = CASE_T / 2 + 0.016;
  displayMod.add(screen);

  // --- battery ---------------------------------------------------------------
  const battery = new THREE.Group();
  watch.add(battery);
  const cell = beveledBox(1.42, 1.28, 0.14, batteryMat, 0.05);
  battery.add(cell);
  const sticker = beveledBox(0.9, 0.5, 0.01, labelMat, 0.004);
  sticker.position.set(0.1, -0.2, 0.072);
  battery.add(sticker);
  battery.position.z = 0.06;

  // --- logic board (system-in-package) ---------------------------------------
  const board = new THREE.Group();
  watch.add(board);
  board.position.z = -0.1;
  board.add(beveledBox(1.56, 1.76, 0.08, boardMat, 0.03));
  const soc = beveledBox(0.56, 0.56, 0.06, chipMat, 0.012);
  soc.position.set(-0.3, 0.32, 0.06);
  board.add(soc);
  const accel = beveledBox(0.18, 0.18, 0.05, accelMat, 0.01);
  accel.position.set(0.46, 0.28, 0.055);
  board.add(accel);
  const afe = beveledBox(0.3, 0.22, 0.05, afeMat, 0.01);
  afe.position.set(0.4, -0.42, 0.055);
  board.add(afe);
  {
    const padGeo = new THREE.BoxGeometry(0.035, 0.02, 0.012);
    const passGeo = new THREE.BoxGeometry(0.05, 0.028, 0.025);
    for (let i = 0; i < 44; i++) {
      const x = -0.68 + hash(i, 1, 2) * 1.36;
      const y = -0.8 + hash(i, 3, 4) * 1.6;
      // keep clear of the three named chips
      if (Math.abs(x + 0.3) < 0.36 && Math.abs(y - 0.32) < 0.36) continue;
      if (Math.abs(x - 0.46) < 0.16 && Math.abs(y - 0.28) < 0.16) continue;
      if (Math.abs(x - 0.4) < 0.22 && Math.abs(y + 0.42) < 0.18) continue;
      const pas = new THREE.Mesh(i % 3 ? passGeo : padGeo, i % 3 ? chipMat : goldMat);
      pas.position.set(x, y, 0.05);
      pas.rotation.z = hash(i, 5, 6) > 0.5 ? Math.PI / 2 : 0;
      board.add(pas);
    }
  }

  // --- back: ceramic cover, domed crystal, the optical sensor ----------------
  const back = new THREE.Group();
  watch.add(back);
  const cover = new THREE.Mesh(new THREE.CylinderGeometry(0.88, 0.9, COVER_T, 72), ceramic);
  cover.rotation.x = Math.PI / 2;
  cover.position.z = BACK_Z - COVER_T / 2;
  back.add(cover);
  // dark-grey substrate, so the black light barriers read against it
  const mask = new THREE.Mesh(new THREE.CircleGeometry(DOME_R - 0.01, 64), new THREE.MeshPhysicalMaterial({ color: 0x2c3036, roughness: 0.7 }));
  mask.rotation.y = Math.PI; // faces -z
  mask.position.z = BACK_Z - COVER_T - 0.0005;
  back.add(mask);
  const domeProfile = [];
  for (let i = 0; i <= 16; i++) {
    const r = DOME_R * (1 - i / 16);
    domeProfile.push([r, DOME_H * Math.sqrt(1 - (r / DOME_R) ** 2) ** 0.6]);
  }
  domeProfile[domeProfile.length - 1][0] = 0.0001;
  const dome = lathe(domeProfile, domeMat, 72);
  dome.castShadow = false;
  dome.rotation.x = -Math.PI / 2; // bulge toward -z
  dome.position.z = BACK_Z - COVER_T;
  back.add(dome);
  const domeRim = new THREE.Mesh(new THREE.TorusGeometry(DOME_R + 0.01, 0.014, 10, 96), materials.chrome(0x8d939a));
  domeRim.position.z = BACK_Z - COVER_T;
  back.add(domeRim);

  // sensor face — every part faces -z (toward the skin)
  const sensor = new THREE.Group();
  sensor.position.z = SENSOR_Z;
  back.add(sensor);
  const greenLEDs = [];
  const ledGeo = new THREE.BoxGeometry(0.075, 0.075, 0.02);
  for (const [x, y, mat] of [
    [-0.055, 0.055, ledGreen],
    [0.055, -0.055, ledGreen],
    [0.055, 0.055, ledRed],
    [-0.055, -0.055, ledIR],
  ]) {
    const led = new THREE.Mesh(ledGeo, mat);
    led.position.set(x, y, -0.01);
    sensor.add(led);
    if (mat === ledGreen) greenLEDs.push(led);
  }
  const barrierRing = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.2, 0.03, 48, 1, true), matteBlack);
  barrierRing.material = matteBlack;
  barrierRing.rotation.x = Math.PI / 2;
  barrierRing.position.z = -0.015;
  sensor.add(barrierRing);
  const barrierRingIn = new THREE.Mesh(new THREE.RingGeometry(0.185, 0.215, 48), matteBlack);
  barrierRingIn.rotation.y = Math.PI;
  barrierRingIn.position.z = -0.03;
  sensor.add(barrierRingIn);
  const photodiodes = [];
  const pdGeo = new THREE.BoxGeometry(0.17, 0.17, 0.016);
  for (let k = 0; k < 4; k++) {
    const a = Math.PI / 4 + (k * Math.PI) / 2;
    const pd = new THREE.Mesh(pdGeo, pdMat);
    pd.position.set(Math.cos(a) * 0.4, Math.sin(a) * 0.4, -0.008);
    sensor.add(pd);
    photodiodes.push(pd);
    // radial light barrier between neighbouring windows
    const wall = beveledBox(0.4, 0.03, 0.03, matteBlack, 0.006);
    const wa = (k * Math.PI) / 2;
    wall.position.set(Math.cos(wa) * 0.42, Math.sin(wa) * 0.42, -0.015);
    wall.rotation.z = wa;
    sensor.add(wall);
  }
  // inside face of the cover: the optical module + its flex (seen exploded)
  const optModule = beveledBox(0.7, 0.7, 0.08, boardMat, 0.03);
  optModule.position.z = BACK_Z + 0.04;
  back.add(optModule);
  const flex = beveledBox(0.18, 0.6, 0.012, new THREE.MeshPhysicalMaterial({ color: 0xc27a2a, roughness: 0.5 }), 0.004);
  flex.position.set(0.25, 0.55, BACK_Z + 0.085);
  back.add(flex);

  // --- labels on the watch ---------------------------------------------------
  labels.add('exterior', screen, 'Heart-rate readout', [0.5, -0.78, 0.02], -35, 55);
  labels.add('exterior', crown, 'Digital crown', [0.15, 0, 0], 40, 35);
  labels.add('exterior', button, 'Side button', [0.04, -0.1, 0], -25, 45);
  // the back is seen with the watch turned half a turn: local -x reads as
  // screen-right, so anchors sit on the -x half and leaders point right
  labels.add('sensor', sensor, 'Green LEDs', [-0.055, 0.055, -0.03], 35, 120);
  labels.add('sensor', sensor, 'Photodiodes', [-0.283, 0.283, -0.03], 10, 110);
  labels.add('sensor', sensor, 'Light barrier', [-0.5, 0, -0.035], -35, 110);
  labels.add('sensor', sensor, 'Back crystal', [-0.6, -0.3, -0.07], -20, 80);
  labels.add('internal', screen, 'Display', [0.55, 0.65, 0.02], 30, 60);
  labels.add('internal', cell, 'Battery', [0.6, 0.4, 0.07], 20, 70);
  labels.add('internal', accel, 'Accelerometer', [0.05, 0, 0.03], 15, 80);
  labels.add('internal', afe, 'Sensor chip', [0.1, 0, 0.03], -20, 80);

  // =========================================================================
  // THE MACRO INSERT — sensor slice resting on a block of skin
  // =========================================================================
  const insert = new THREE.Group();
  insert.position.copy(INSERT_POS);
  hero.add(insert);

  const skinMat = (color, sheen = 0.25) =>
    new THREE.MeshPhysicalMaterial({ color, roughness: 0.62, metalness: 0, sheen, sheenRoughness: 0.5, sheenColor: new THREE.Color(0xffd6c8) });
  const epiMat = skinMat(0xbf8565, 0.4);
  const dermMat = skinMat(0xd99a92);
  const fatMat = skinMat(0xe8cc84, 0.15);
  const layer = (top, bottom, mat) => {
    const h = top - bottom;
    const m = beveledBox(BLK_W, h, BLK_D, mat, Math.min(0.03, h / 2.2));
    m.position.y = (top + bottom) / 2;
    m.receiveShadow = true;
    insert.add(m);
    return m;
  };
  const epidermis = layer(0, -EPI, epiMat);
  const dermis = layer(-EPI, -DERM, dermMat);
  layer(-DERM, -FAT, fatMat);
  // fat lobules on the cut face
  {
    const lobGeo = new THREE.SphereGeometry(1, 16, 10);
    for (let i = 0; i < 26; i++) {
      const lob = new THREE.Mesh(lobGeo, skinMat(0xf0d690, 0.15));
      const r = 0.07 + hash(i, 9, 1) * 0.06;
      lob.scale.set(r, r * 0.85, 0.02);
      lob.position.set(-1.25 + hash(i, 2, 7) * 2.5, -0.8 - hash(i, 4, 3) * 0.48, FACE_Z + 0.002);
      insert.add(lob);
    }
  }
  // capillary loops just under the epidermis, drawn on the cut face
  const capMat = new THREE.MeshPhysicalMaterial({ color: 0xb52235, roughness: 0.4 });
  const capGeo = new THREE.TorusGeometry(0.055, 0.013, 8, 20, Math.PI);
  const capillaries = new THREE.Group();
  insert.add(capillaries);
  for (let i = 0; i < 12; i++) {
    const c = new THREE.Mesh(capGeo, capMat);
    c.rotation.z = Math.PI;
    c.position.set(-1.25 + i * 0.227, -EPI - 0.02, FACE_Z + 0.006);
    capillaries.add(c);
  }
  // small arteries, running into the block; their cut ends on the face swell
  const artMat = new THREE.MeshPhysicalMaterial({ color: 0xa3122a, roughness: 0.32, clearcoat: 0.3, clearcoatRoughness: 0.3 });
  const artWallMat = new THREE.MeshPhysicalMaterial({ color: 0x6e0c1c, roughness: 0.5 });
  const arteries = [];
  for (const s of [-1, 1]) {
    const art = new THREE.Group();
    art.position.set(s * ART_X, ART_Y, 0);
    const tube = new THREE.Mesh(new THREE.CylinderGeometry(ART_R, ART_R, BLK_D + 0.012, 32), artMat);
    tube.rotation.x = Math.PI / 2;
    art.add(tube);
    const wall = new THREE.Mesh(new THREE.TorusGeometry(ART_R, 0.012, 8, 40), artWallMat);
    wall.position.z = FACE_Z + 0.007;
    art.add(wall);
    insert.add(art);
    arteries.push(art);
  }

  // sensor slice: crystal on the skin, LED + photodiodes hanging from a board
  const slabMat = materials.glass(0xa9c4d6, 0.2);
  const slab = beveledBox(BLK_W - 0.3, 0.1, BLK_D, slabMat, 0.02);
  slab.position.y = 0.05;
  slab.castShadow = false;
  insert.add(slab);
  const sBoard = beveledBox(BLK_W - 0.3, 0.08, BLK_D, boardMat, 0.02);
  sBoard.position.y = 0.26;
  insert.add(sBoard);
  const insLedMat = new THREE.MeshStandardMaterial({ color: 0x1c3a24, emissive: 0x3dff6a, emissiveIntensity: 2.2 });
  // sensor parts run out to the cut face, so they read as a cross-section
  const insLed = beveledBox(0.2, 0.09, 0.3, insLedMat, 0.015);
  insLed.position.set(0, LED_Y + 0.055, FACE_Z - 0.15);
  insert.add(insLed);
  const insPdMat = new THREE.MeshPhysicalMaterial({ color: 0x252a4a, roughness: 0.28, metalness: 0.2, emissive: 0x2bd96b, emissiveIntensity: 0.5 });
  const insPDs = [];
  for (const s of [-1, 1]) {
    const pd = beveledBox(0.34, 0.06, 0.3, insPdMat, 0.012);
    pd.position.set(s * PD_X, 0.19, FACE_Z - 0.15);
    insert.add(pd);
    insPDs.push(pd);
    const bar = beveledBox(0.06, 0.12, BLK_D, matteBlack, 0.012);
    bar.position.set(s * 0.42, 0.16, 0);
    insert.add(bar);
  }
  // soft glow cone under the LED (additive, no depth write)
  const glowMat = new THREE.MeshBasicMaterial({ color: 0x3dff6a, transparent: true, opacity: 0.22, depthWrite: false, blending: THREE.AdditiveBlending });
  const glow = new THREE.Mesh(new THREE.ConeGeometry(0.26, 0.2, 32, 1, true), glowMat);
  glow.position.set(0, 0.04, FACE_Z - 0.18);
  insert.add(glow);

  // light paths — drawn on the cut face so they are never buried in tissue
  const pathZ = FACE_Z + 0.02;
  const paths = [];
  for (const s of [-1, 1]) {
    for (const d of PATH_DEPTHS) {
      const curve = new THREE.CatmullRomCurve3(
        [
          [0, LED_Y],
          [s * 0.08, 0.0],
          [s * 0.2, -d * 0.72],
          [s * ART_X, -d],
          [s * 0.64, -d * 0.72],
          [s * 0.78, 0.0],
          [s * PD_X, 0.16],
        ].map(([x, y]) => new THREE.Vector3(x, y, pathZ)),
      );
      paths.push({ curve, d, s });
    }
  }
  const pktGeo = new THREE.SphereGeometry(0.03, 12, 8);
  const packets = [];
  paths.forEach((path, i) => {
    for (let j = 0; j < SLOTS; j++) {
      const mat = new THREE.MeshBasicMaterial({ color: 0x7dffa8, transparent: true, opacity: 1, depthWrite: false });
      const m = new THREE.Mesh(pktGeo, mat);
      m.renderOrder = 3;
      m.userData.isPacket = true;
      insert.add(m);
      packets.push({ m, i, j, off: frac(j * 0.2 + i * 0.113 + j * 0.037) });
    }
  });
  const pktGreen = new THREE.Color(0x7dffa8);
  const tmp = new THREE.Vector3();
  const pktBlood = new THREE.Color(0x8a1020);

  // readout plate (step 4): how big the beat is against the steady light
  const plate = new THREE.Group();
  plate.position.set(0, 1.1, -0.35);
  insert.add(plate);
  const PL_W = 2.4;
  const PL_H = 1.2;
  plate.add(beveledBox(PL_W + 0.08, PL_H + 0.08, 0.04, materials.polymer(0x101216), 0.02));
  const plCanvas = document.createElement('canvas');
  plCanvas.width = 768;
  plCanvas.height = 384;
  const pl = plCanvas.getContext('2d');
  const plTex = new THREE.CanvasTexture(plCanvas);
  plTex.colorSpace = THREE.SRGBColorSpace;
  const plScreen = new THREE.Mesh(
    new THREE.PlaneGeometry(PL_W, PL_H),
    new THREE.MeshStandardMaterial({ color: 0x0a0a0a, map: plTex, emissive: 0xffffff, emissiveMap: plTex, emissiveIntensity: 1.0, roughness: 0.3 }),
  );
  plScreen.position.z = 0.022;
  plate.add(plScreen);

  labels.add('skin', insLed, 'Green LED', [0, 0, 0.15], 75, 55);
  labels.add('skin', insPDs[1], 'Photodiode', [0.1, 0, 0.15], 35, 55);
  labels.add('skin', capillaries.children[3], 'Capillaries', [0, -0.03, 0], 70, 85);
  labels.add('skin', arteries[1], 'Small artery', [0.04, -0.04, FACE_Z], -25, 65);
  labels.add('skin', dermis, 'Skin (dermis)', [-0.95, 0.05, FACE_Z], -75, 90);
  labels.add('beat', arteries[0], 'Small artery', [0.04, -0.05, FACE_Z], -60, 60);
  labels.add('beat', insPDs[1], 'Photodiode', [0.1, 0, 0.15], 35, 55);
  labels.add('beat', plate, 'Photodiode signal', [-PL_W / 2 + 0.25, -PL_H / 2, 0.03], 215, 35);

  // =========================================================================
  // SCREEN + PLATE DRAWING
  // =========================================================================
  const GREEN = '#4ef08a';
  const AMBER = '#ffb347';
  const DIM = 'rgba(255,255,255,0.55)';
  const font = (w, px) => `${w} ${px}px "Segoe UI", system-ui, sans-serif`;

  function heartPath(ctx, cx, cy, s) {
    ctx.beginPath();
    ctx.moveTo(cx, cy + s * 0.9);
    ctx.bezierCurveTo(cx - s * 1.3, cy, cx - s * 1.1, cy - s * 1.0, cx - s * 0.55, cy - s * 0.95);
    ctx.bezierCurveTo(cx - s * 0.2, cy - s * 0.92, cx, cy - s * 0.6, cx, cy - s * 0.45);
    ctx.bezierCurveTo(cx, cy - s * 0.6, cx + s * 0.2, cy - s * 0.92, cx + s * 0.55, cy - s * 0.95);
    ctx.bezierCurveTo(cx + s * 1.1, cy - s * 1.0, cx + s * 1.3, cy, cx, cy + s * 0.9);
    ctx.closePath();
  }

  // plot fn(b) for beat-time b over [b1 - span, b1] into a box
  function trace(ctx, fn, b1, span, x0, y0, w, h, color, lw = 5) {
    ctx.strokeStyle = color;
    ctx.lineWidth = lw;
    ctx.lineJoin = 'round';
    ctx.lineCap = 'round';
    ctx.beginPath();
    const n = 160;
    for (let i = 0; i <= n; i++) {
      const b = b1 - span + (i / n) * span;
      const v = fn(b); // 0 (bottom) .. 1 (top)
      const x = x0 + (i / n) * w;
      const y = y0 + h - v * h;
      if (i) ctx.lineTo(x, y);
      else ctx.moveTo(x, y);
    }
    ctx.stroke();
  }

  // the light reaching the photodiode, normalised: dips on every beat
  const lightOf = (b) => 0.92 - 0.62 * beatShape(frac(b)) / 1.05;

  function drawScreen(mode, st) {
    const c = scr;
    c.fillStyle = '#000';
    c.fillRect(0, 0, SCR_W, SCR_H);
    const { b, y, beats, phi, rock } = st;
    if (mode === 'hr') {
      c.textBaseline = 'alphabetic';
      c.font = font(600, 34);
      c.fillStyle = GREEN;
      c.textAlign = 'left';
      c.fillText('Heart Rate', 62, 92);
      c.fillStyle = '#e6eaef';
      c.textAlign = 'right';
      c.fillText('10:09', SCR_W - 62, 92);
      c.textAlign = 'left';
      c.font = font(700, 190);
      c.fillStyle = '#e6eaef';
      c.fillText('75', 52, 300);
      c.font = font(600, 46);
      c.fillStyle = GREEN;
      c.fillText('BPM', 280, 300);
      const s = 36 * (1 + 0.16 * y);
      c.fillStyle = '#ff3b5c';
      heartPath(c, 400, 168, s);
      c.fill();
      c.font = font(500, 26);
      c.fillStyle = DIM;
      c.fillText('light from your wrist', 62, 372);
      trace(c, lightOf, b, 3, 52, 390, SCR_W - 104, 150, GREEN, 5);
    } else if (mode === 'motion') {
      const rockAt = (bb) => {
        const u = (bb - phi) / beats;
        return Math.sin(TAU * rock * u) + 0.35 * Math.sin(TAU * 2 * rock * u + 0.7);
      };
      const raw = (bb) => 0.5 + 0.28 * rockAt(bb) + 0.18 * (lightOf(bb) - 0.6);
      const mot = (bb) => 0.5 + 0.34 * rockAt(bb);
      const clean = lightOf;
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      const rows = [
        ['RAW LIGHT', '#fff', raw, 70],
        ['MOTION (ACCELEROMETER)', AMBER, mot, 250],
        ['LIGHT − MOTION = PULSE', GREEN, clean, 430],
      ];
      for (const [name, col, fn, top] of rows) {
        c.font = font(700, 30);
        c.fillStyle = col;
        c.fillText(name, 56, top + 26);
        trace(c, fn, b, 3, 56, top + 40, SCR_W - 112, 120, col, 6);
      }
    } else if (mode === 'count') {
      const span = 2.6;
      const x0 = 40;
      const w = SCR_W - 80;
      const top = 120;
      const h = 250;
      c.font = font(700, 34);
      c.fillStyle = '#e6eaef';
      c.textAlign = 'left';
      c.textBaseline = 'alphabetic';
      c.fillText('Each dip = one beat', 50, 84);
      trace(c, lightOf, b, span, x0, top, w, h, GREEN, 7);
      // dips sit at beat phase 0.14
      const dips = [];
      for (let k = Math.floor(b - span) - 1; k <= Math.ceil(b); k++) {
        const bd = k + 0.14;
        if (bd < b - span + 0.02 || bd > b - 0.02) continue;
        dips.push(x0 + ((bd - (b - span)) / span) * w);
      }
      const vMin = lightOf(0.14);
      const yDip = top + h - vMin * h;
      c.fillStyle = AMBER;
      for (const x of dips) {
        c.beginPath();
        c.arc(x, yDip, 12, 0, TAU);
        c.fill();
      }
      if (dips.length >= 2) {
        const xa = dips[dips.length - 2];
        const xb = dips[dips.length - 1];
        const yb = top + h + 40;
        c.strokeStyle = AMBER;
        c.lineWidth = 4;
        c.beginPath();
        c.moveTo(xa, yb - 16);
        c.lineTo(xa, yb);
        c.lineTo(xb, yb);
        c.lineTo(xb, yb - 16);
        c.stroke();
        c.font = font(700, 34);
        c.fillStyle = AMBER;
        c.textAlign = 'center';
        c.fillText('0.80 s', (xa + xb) / 2, yb + 40);
      }
      c.textAlign = 'center';
      c.font = font(600, 36);
      c.fillStyle = DIM;
      c.fillText('60 ÷ 0.80 =', SCR_W / 2, SCR_H - 112);
      c.font = font(700, 64);
      c.fillStyle = '#e6eaef';
      c.fillText('75 BPM', SCR_W / 2, SCR_H - 46);
    }
    scrTex.needsUpdate = true;
  }

  function drawPlate(st) {
    const c = pl;
    const W = plCanvas.width;
    const H = plCanvas.height;
    c.fillStyle = '#05070a';
    c.fillRect(0, 0, W, H);
    c.textBaseline = 'alphabetic';
    c.textAlign = 'left';
    // left: all the light coming back, as a bar — the beat is under 1 % of it
    const bx = 48;
    const bw = 150;
    const by = 70;
    const bh = 270;
    c.font = font(700, 30);
    c.fillStyle = '#e6eaef';
    c.fillText('ALL LIGHT', bx - 6, 48);
    c.strokeStyle = 'rgba(255,255,255,0.3)';
    c.lineWidth = 2;
    c.strokeRect(bx, by, bw, bh);
    const level = 0.92 - 0.008 * beatShape(frac(st.b)); // true scale: < 1 %
    c.fillStyle = 'rgba(78,240,138,0.85)';
    c.fillRect(bx, by + bh - bh * level, bw, bh * level);
    // magnifier: the top sliver of the bar, blown up on the right
    const yTop = by + bh - bh * 0.92;
    c.strokeStyle = AMBER;
    c.lineWidth = 4;
    c.strokeRect(bx - 8, yTop - 12, bw + 16, 24);
    const rx = 268;
    c.beginPath();
    c.moveTo(bx + bw + 8, yTop - 12);
    c.lineTo(rx, by);
    c.moveTo(bx + bw + 8, yTop + 12);
    c.lineTo(rx, by + bh);
    c.stroke();
    c.font = font(700, 30);
    c.fillStyle = AMBER;
    c.fillText('TOP 1 %, ZOOMED IN', rx + 4, 48);
    c.strokeStyle = 'rgba(255,183,71,0.45)';
    c.lineWidth = 2;
    c.strokeRect(rx, by, W - rx - 30, bh);
    trace(c, lightOf, st.b, 3, rx + 18, by + 16, W - rx - 66, bh - 70, GREEN, 7);
    c.font = font(600, 26);
    c.fillStyle = DIM;
    c.fillText('one dip per heartbeat', rx + 18, by + bh - 16);
    plTex.needsUpdate = true;
  }

  // =========================================================================
  // STATE + POSE
  // =========================================================================
  let screenMode = 'hr';
  let macro = false;
  let scope = false;
  let explode = 0;

  function applyExplode(e) {
    explode = e;
    // fan the layers sideways as well as apart, so each one shows past the
    // layer in front of it from the three-quarter camera
    displayMod.position.set(-0.35 * e, 0, 0.95 * e);
    battery.position.set(0, 0, 0.06 + 0.3 * e);
    board.position.set(0.35 * e, 0, -0.1 - 0.35 * e);
    back.position.set(0.7 * e, 0, -1.0 * e);
  }

  function view({ reveal = 0, macroOn = false, scopeOn = false, screen: mode = 'hr', labels: set = false } = {}) {
    shell.visible = reveal < 0.5;
    applyExplode(reveal >= 0.5 ? 1 : 0);
    macro = macroOn;
    scope = scopeOn;
    pivot.visible = !macro;
    insert.visible = macro;
    plate.visible = macro && scope;
    screenMode = mode;
    labels.setLabels(set);
    syncOccluders();
  }

  // label-layout.js skips a hidden mesh by ITS OWN .visible only, so meshes
  // inside a hidden GROUP (the swapped-out watch, the removed case shell)
  // still block its occlusion raycast and dim every label behind them. Mark
  // them noOcclude whenever an ancestor is hidden. Light packets never
  // occlude: they are small moving dots, not housings.
  function syncOccluders() {
    root.traverse((o) => {
      if (!o.isMesh) return;
      let shown = true;
      for (let a = o; a && a !== root; a = a.parent) if (!a.visible) shown = false;
      o.userData.noOcclude = !shown || !!o.userData.isPacket;
    });
  }

  // cfg: { beats, turn, spin, sway, rock, flashes }
  function tick(u, cfg = {}) {
    const beats = cfg.beats ?? 5;
    const phi = beatPhase0(beats);
    const b = u * beats + phi;
    const y = beatShape(frac(b));

    // --- watch pose ---
    let turn = cfg.turn ?? 0;
    if (cfg.spin) turn += TAU * cfg.spin * u;
    pivot.rotation.y = turn;
    // sway turns the watch about its OWN centre — about the strap pivot (a
    // whole unit behind the case) it swung the case sideways under the hero
    // title
    watch.rotation.y = cfg.sway ? cfg.sway * Math.sin(TAU * u) : 0;
    const rk = cfg.rock ? Math.sin(TAU * cfg.rock * u) : 0;
    const rkV = cfg.rock ? Math.cos(TAU * cfg.rock * u) : 0;
    watch.rotation.z = 0.13 * rk;
    watch.rotation.x = 0.05 * rkV;
    watch.position.x = 0.07 * rk;

    // green LEDs strobe (slowed down — real ones flash hundreds of times/s)
    const on = cfg.flashes ? frac(u * cfg.flashes) < 0.5 : true;
    ledGreen.emissiveIntensity = on ? 2.4 : 0.08;
    accelMat.emissiveIntensity = cfg.rock ? 0.4 + 1.6 * Math.abs(rkV) : 0;
    afeMat.emissiveIntensity = explode > 0.5 ? 0.3 + 0.9 * (on ? 1 : 0) : 0;

    if (!macro) drawScreen(screenMode, { b, y, beats, phi, rock: cfg.rock ?? 0 });

    // --- macro insert --- (posed every tick, visible or not, so a seek on a
    // step that hasn't been entered still moves it; only canvas redraws are
    // gated on visibility)
    {
      const swell = (uu) => beatShape(frac(uu * beats + phi));
      const rScale = 1 + ART_SWELL * y;
      for (const a of arteries) a.scale.set(rScale, rScale, 1);
      const m = beats; // one traversal per beat-length
      for (const pk of packets) {
        const path = paths[pk.i];
        const x = u * m + pk.off;
        const q = frac(x);
        const k = (((Math.floor(x) % m) + m) % m);
        const h = hash(pk.i, pk.j, k);
        // when (lap time) did this packet pass the artery level (q = 0.5)?
        const uc = u - (q - 0.5) / m;
        const rNow = ART_R * (1 + ART_SWELL * swell(uc));
        const gap = Math.abs(path.d + ART_Y);
        let qAbs = 2;
        if (gap < rNow + 0.012 && h < 0.85) qAbs = 0.5; // blood in the way
        else if (h < 0.1) qAbs = 0.25 + 0.5 * hash(pk.j, pk.i, k + 7); // lost to scatter
        path.curve.getPointAt(Math.min(q, qAbs), tmp);
        pk.m.position.copy(tmp);
        if (q < qAbs) {
          pk.m.material.opacity = 0.95;
          pk.m.material.color.copy(pktGreen);
          pk.m.scale.setScalar(1);
        } else {
          const f = Math.min(1, (q - qAbs) / 0.07);
          pk.m.material.opacity = 0.95 * (1 - f);
          pk.m.material.color.copy(pktGreen).lerp(pktBlood, Math.min(1, f * 2));
          pk.m.scale.setScalar(1 + 0.4 * f);
        }
      }
      const level = 1 - 0.55 * y; // exaggerated, like the artery
      insPdMat.emissiveIntensity = 0.15 + 0.85 * level;
      glowMat.opacity = 0.2;
      if (macro && scope) drawPlate({ b });
    }
  }

  view();
  tick(0);

  return {
    group: hero,
    view,
    tick,
    setLabels: labels.setLabels,
    parts: { pivot, watch, shell, displayMod, battery, board, back, insert, arteries, plate, screen },
  };
}
