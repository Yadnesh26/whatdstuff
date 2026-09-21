import * as THREE from 'three';
import { materials, rod, disc, chargeQueue, studioPlinth } from '../../framework/parts.js';
import { beveledBox, tubeAlong, coil } from '../../framework/geometry.js';
import { clamp01, win, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A domestic rocker light switch wired to a bare lamp, staged as a product shot
// - plus a macro insert of the copper itself.
//
// STAGING (rewritten after the first render): the switch was originally set in a
// 3.2 x 2.5 wall slab. The plate is 2.15 wide, so the plate came out at TWO
// THIRDS the wall's width and the two near-white masses read as one white box -
// you could not tell it was a light switch at all. Conventions: the machine
// itself plus at most an abstract plinth, never a room. So the wall is now a
// mounting panel barely larger than the plate, and the lamp it feeds sits
// beside it on the same plinth, at the same height.
//
// PROPORTIONS - every constant derives from ONE scale: 1 unit = 40 mm.
// Read off a standard square-plate rocker switch:
//   faceplate 86 x 86 x 10 mm      (2.150 x 2.150 x 0.250 u)
//   aperture  46 x 28 mm           (1.150 x 0.700 u)
//   rocker    42 x 24 x 8 mm       (1.050 x 0.600 x 0.200 u)
//   back box  70 x 70 x 25 mm deep (1.750 x 1.750 x 0.625 u)
// Ratio that matters most: the rocker is just under HALF the plate width, and
// the plate is ~8.6x its own thickness. Getting those two right is what makes
// the silhouette read as a light switch rather than a blank panel.
//
// SEAMLESS LOOP: one lap is OFF -> snap ON -> hold -> snap OFF -> still, and the
// wrap pose is identical to the start (rocker at +TILT, contacts open, lamp
// dark). The AC jiggle runs 8 WHOLE cycles per lap and the push pulse makes 2
// WHOLE traversals, so both also land exactly where they started.
const MM = 1 / 40;

const PLATE = 86 * MM;
const PLATE_T = 10 * MM;
const APER_W = 46 * MM;
const APER_H = 28 * MM;
const ROCKER_W = 42 * MM;
const ROCKER_H = 24 * MM;
const ROCKER_T = 8 * MM;
const BOX = 70 * MM;
const BOX_D = 25 * MM;

// The mounting panel is only ~1.2x the plate, so the plate reads as a plate.
const MOUNT_W = 2.6;
const MOUNT_H = 2.6;
const MOUNT_D = 0.62;
const PLINTH_H = 0.26;

const SWITCH_X = -0.85; // switch left of centre, lamp right - both on the plinth
const SWITCH_Y = PLINTH_H + MOUNT_H / 2;
const LAMP_X = 1.45;
const HOLDER_H = 0.45;
const BULB_R = 0.75; // 60 mm globe = 1.5 u across, next to an 86 mm plate
const LAMP_Y = PLINTH_H + HOLDER_H + BULB_R;
const TILT = (7 * Math.PI) / 180; // rocker travel, +-7 degrees

const C_ACCENT = 0x54c8e8;
const C_LIVE = 0x8a4a2a;
const C_NEUTRAL = 0x2f5c9e;
const C_EARTH = 0x4f7a35;

export function buildLightSwitch({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const plinth = studioPlinth({ w: 4.4, h: PLINTH_H, d: 2.2 });
  plinth.userData.stageChrome = true;
  group.add(plinth);

  // Everything belonging to the switch rides this, so the whole assembly can sit
  // off-centre on the plinth without every child carrying the offset.
  const switchRoot = new THREE.Group();
  switchRoot.position.x = SWITCH_X;
  group.add(switchRoot);

  // --- mounting panel (the "dress": ghosts away on reveal) ------------------
  // Low-specular plastic, so it CAN be faded (trap 3 only forbids ghosting
  // metal). Near-white, so it has to go to ~0.1, not 0.26, or its albedo veils
  // everything behind it. Deliberately a cool grey, NOT the plate's off-white,
  // so plate and panel never merge into one mass again.
  const wallMat = materials.polymer(0x8d9299);
  wallMat.roughness = 0.9;
  const wallBaseCoat = wallMat.clearcoat;
  const wall = beveledBox(MOUNT_W, MOUNT_H, MOUNT_D, wallMat, 0.05);
  wall.position.set(0, SWITCH_Y, -MOUNT_D / 2);
  wall.receiveShadow = true;
  switchRoot.add(wall);

  // --- back box, recessed into the wall ------------------------------------
  const boxMat = materials.paintedMetal(0x30343a);
  boxMat.roughness = 0.72;
  const backBox = new THREE.Group();
  backBox.position.set(0, SWITCH_Y, 0);
  switchRoot.add(backBox);
  // Four sides + a dark rough floor, so the interior is never a concave metal
  // mirror seen from inside (the jet-engine casing rule).
  const linerMat = materials.paintedMetal(0x17191d);
  linerMat.roughness = 0.95;
  const boxSide = (w, h, d, x, y, z) => {
    const m = beveledBox(w, h, d, boxMat, 0.012);
    m.position.set(x, y, z);
    backBox.add(m);
    return m;
  };
  const rim = 0.06;
  boxSide(BOX, rim, BOX_D, 0, BOX / 2 - rim / 2, -BOX_D / 2);
  boxSide(BOX, rim, BOX_D, 0, -BOX / 2 + rim / 2, -BOX_D / 2);
  boxSide(rim, BOX - rim * 2, BOX_D, -BOX / 2 + rim / 2, 0, -BOX_D / 2);
  boxSide(rim, BOX - rim * 2, BOX_D, BOX / 2 - rim / 2, 0, -BOX_D / 2);
  const boxFloor = beveledBox(BOX, BOX, 0.05, linerMat, 0.01);
  boxFloor.position.set(0, 0, -BOX_D);
  backBox.add(boxFloor);

  // --- the mechanism (hidden until reveal) ---------------------------------
  const mech = new THREE.Group();
  mech.position.set(0, SWITCH_Y, 0);
  switchRoot.add(mech);

  const brass = materials.brushedSteel(0xb08d4a);
  brass.roughness = 0.74; // presets read near-chrome on curved/large faces
  // Roughness, NOT envMapIntensity: the blowout is direct-light specular, and a
  // wider softer highlight is the correct look for a switch contact anyway.
  const silver = materials.chrome(0xc9d2da);
  silver.roughness = 0.52;

  // Two terminals: supply in (bottom) and switched live out (top).
  const terminal = (y) => {
    const t = new THREE.Group();
    t.position.set(0.52, y, -BOX_D + 0.18);
    const body = beveledBox(0.3, 0.26, 0.26, brass, 0.03);
    t.add(body);
    const screwMat = materials.chrome(0xb9c0c8);
    screwMat.roughness = 0.5;
    const screw = rod(0.055, 0.12, screwMat);
    screw.rotation.x = Math.PI / 2;
    screw.position.set(0, 0.17, 0);
    t.add(screw);
    mech.add(t);
    return t;
  };
  const termIn = terminal(-0.55);
  const termOut = terminal(0.55);

  // Fixed contact: a silver pad on a brass post standing off the upper terminal.
  const fixedPost = beveledBox(0.1, 0.5, 0.12, brass, 0.02);
  fixedPost.position.set(0.18, 0.34, -BOX_D + 0.2);
  mech.add(fixedPost);
  const fixedPad = disc(0.075, 0.05, silver);
  fixedPad.rotation.z = Math.PI / 2;
  fixedPad.position.set(0.105, 0.14, -BOX_D + 0.2);
  mech.add(fixedPad);

  // Moving contact: a sprung blade pivoted low, carrying the other silver pad.
  // Parented at its PHYSICAL pivot and posed by rotation (never lerped).
  const bladePivot = new THREE.Group();
  bladePivot.position.set(-0.2, -0.34, -BOX_D + 0.2);
  mech.add(bladePivot);
  const blade = beveledBox(0.09, 0.74, 0.1, materials.brushedSteel(0xaab2bd), 0.02);
  blade.geometry.translate(0, 0.37, 0);
  bladePivot.add(blade);
  const movingPad = disc(0.075, 0.05, silver);
  movingPad.rotation.z = Math.PI / 2;
  movingPad.position.set(0.06, 0.7, 0);
  bladePivot.add(movingPad);
  const pinMat = materials.chrome(0xb4bbc4);
  pinMat.roughness = 0.5;
  const pivotPin = rod(0.05, 0.2, pinMat);
  pivotPin.rotation.x = Math.PI / 2;
  bladePivot.add(pivotPin);

  // Over-centre spring: the thing that makes it SNAP.
  const springMat = materials.brushedSteel(0x9fa7b2);
  springMat.roughness = 0.6;
  // coil() returns { mesh, curve, points } - take the mesh, not the record.
  const spring = coil({ turns: 6, radius: 0.075, length: 0.42, wireRadius: 0.018 }, springMat).mesh;
  const springGroup = new THREE.Group();
  springGroup.position.set(-0.26, 0.08, -BOX_D + 0.2);
  springGroup.add(spring);
  mech.add(springGroup);

  // Plunger: rides the rocker's back face down onto the spring.
  const plunger = beveledBox(0.13, 0.3, 0.13, materials.polymer(0x2a2d33), 0.02);
  plunger.position.set(-0.26, 0.42, -BOX_D + 0.2);
  mech.add(plunger);

  // --- faceplate: a REAL frame with a real aperture -------------------------
  // Four bars, not a solid slab with a painted-on hole - the rocker genuinely
  // passes through the opening.
  const plateMat = materials.polymer(0xd5d5d0);
  plateMat.roughness = 0.55;
  const plateBaseCoat = plateMat.clearcoat;
  const faceplate = new THREE.Group();
  faceplate.position.set(0, SWITCH_Y, PLATE_T / 2);
  switchRoot.add(faceplate);
  const barV = (PLATE - APER_H) / 2;
  const barH = (PLATE - APER_W) / 2;
  const addBar = (w, h, x, y) => {
    const b = beveledBox(w, h, PLATE_T, plateMat, 0.035);
    b.position.set(x, y, 0);
    faceplate.add(b);
  };
  addBar(PLATE, barV, 0, (APER_H + barV) / 2);
  addBar(PLATE, barV, 0, -(APER_H + barV) / 2);
  addBar(barH, APER_H, -(APER_W + barH) / 2, 0);
  addBar(barH, APER_H, (APER_W + barH) / 2, 0);

  // --- rocker ---------------------------------------------------------------
  const rockerMat = materials.polymer(0xe2e2dd);
  rockerMat.roughness = 0.5;
  const rockerBaseCoat = rockerMat.clearcoat;
  const rockerPivot = new THREE.Group();
  rockerPivot.position.set(0, SWITCH_Y, -0.02);
  switchRoot.add(rockerPivot);
  const rocker = beveledBox(ROCKER_W, ROCKER_H, ROCKER_T, rockerMat, 0.045);
  rocker.position.z = 0.12;
  rockerPivot.add(rocker);

  // --- the lamp it switches -------------------------------------------------
  // A bare bulb in a holder, standing on the same plinth at the same height as
  // the switch: the pair reads as "one switch, one lamp" in a single glance,
  // which is the whole premise of the explainer.
  const sconce = new THREE.Group();
  sconce.position.set(LAMP_X, PLINTH_H, 0);
  group.add(sconce);

  // Bisected to a mirror-bright disc twice on the first cut: a brushed-steel
  // face square-on to the key light was the ONLY thing clipping. Painted metal
  // at high roughness kills the specular and reads correctly for a fitting.
  const holderMat = materials.paintedMetal(0x6b727a);
  holderMat.roughness = 0.82;
  const holderBody = beveledBox(0.5, HOLDER_H, 0.5, holderMat, 0.06);
  holderBody.position.y = HOLDER_H / 2;
  sconce.add(holderBody);
  const capMat = materials.brushedSteel(0x9a8a5e);
  capMat.roughness = 0.78;
  const cap = disc(0.28, 0.2, capMat);
  cap.position.y = HOLDER_H + 0.08;
  sconce.add(cap);

  // Bulb envelope: plain transparent, NEVER transmission - there is a glowing
  // filament inside it, and the transmission pass would drop it (trap 1).
  const domeMat = new THREE.MeshPhysicalMaterial({
    color: 0xeef3f8,
    roughness: 0.32,
    metalness: 0,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const dome = new THREE.Mesh(new THREE.SphereGeometry(BULB_R, 34, 24), domeMat);
  dome.position.y = HOLDER_H + BULB_R * 0.92;
  sconce.add(dome);

  // The filament itself: a small coil, not a ball - it is the thing the copy
  // keeps calling "the filament", so it has to actually look like one.
  const filamentMat = materials.glow(0xffd9a0, 0.05);
  const filamentCoil = coil(
    { turns: 7, radius: 0.075, length: 0.34, wireRadius: 0.018 },
    filamentMat,
  ).mesh;
  const filament = new THREE.Group();
  filament.add(filamentCoil);
  filament.position.y = HOLDER_H + BULB_R * 0.92;
  sconce.add(filament);

  // Emissive inside a mostly-closed envelope needs a FAR lower intensity than
  // in the open (conventions: start ~3, not ~30).
  const lampLight = new THREE.PointLight(0xffd2a0, 0, 3.4, 2);
  lampLight.position.y = HOLDER_H + BULB_R * 0.92;
  sconce.add(lampLight);

  // --- wiring ---------------------------------------------------------------
  // Supply arrives from the grid at the left edge of the plinth, runs behind the
  // panel to the switch's lower terminal; the switched live leaves the upper
  // terminal and crosses the plinth to the lamp. Wires are part of the product
  // here, not a cutaway detail, so they stay visible in every step - the whole
  // premise is a loop you can see.
  const wireMat = (c) => {
    const m = materials.polymer(c);
    m.roughness = 0.66;
    return m;
  };
  const wires = new THREE.Group();
  group.add(wires);
  const WZ = -0.3; // behind the mounting panel's front face
  const SX = SWITCH_X; // world x of the switch assembly
  const RUN_Y = PLINTH_H + 0.1; // the run across the plinth
  const supply = tubeAlong(
    [
      [-2.15, RUN_Y, WZ],
      [SX - 0.75, RUN_Y, WZ],
      [SX + 0.52, RUN_Y + 0.18, WZ],
      [SX + 0.52, SWITCH_Y - 0.55, -BOX_D + 0.2],
    ],
    0.05,
    wireMat(C_LIVE),
  );
  const switched = tubeAlong(
    [
      [SX + 0.52, SWITCH_Y + 0.55, -BOX_D + 0.2],
      [SX + 0.62, SWITCH_Y + 0.66, WZ],
      [SX + 1.0, SWITCH_Y + 0.2, WZ],
      [LAMP_X - 0.34, RUN_Y + 0.5, WZ],
      [LAMP_X - 0.1, PLINTH_H + HOLDER_H * 0.6, -0.06],
    ],
    0.05,
    wireMat(C_LIVE),
  );
  const neutral = tubeAlong(
    [
      [-2.15, RUN_Y, WZ - 0.16],
      [SX, RUN_Y - 0.03, WZ - 0.16],
      [LAMP_X - 0.5, RUN_Y - 0.03, WZ - 0.16],
      [LAMP_X + 0.1, PLINTH_H + HOLDER_H * 0.5, -0.1],
    ],
    0.05,
    wireMat(C_NEUTRAL),
  );
  const earth = tubeAlong(
    [
      [-2.15, RUN_Y, WZ - 0.3],
      [SX - 0.4, RUN_Y - 0.04, WZ - 0.3],
      [SX + 0.68, SWITCH_Y - 0.85, WZ - 0.22],
    ],
    0.042,
    wireMat(C_EARTH),
  );
  wires.add(supply, switched, neutral, earth);

  // --- the push: a pulse that races the wire --------------------------------
  const push = chargeQueue(supply.userData.curve, 11, C_ACCENT, { size: 0.095, spacing: 0.05 });
  const pushUp = chargeQueue(switched.userData.curve, 11, C_ACCENT, { size: 0.095, spacing: 0.05 });
  for (const q of [push, pushUp]) {
    for (const d of q.dots) d.material.emissiveIntensity = 3.4; // > bloom's 2.2
  }
  group.add(push.group, pushUp.group);

  // --- macro insert: the copper itself --------------------------------------
  // The scale trick (fiber-optics): a huge cut-open section of the conductor
  // floating in FRONT of the wall, shown only while the copper is discussed.
  // Sized DOWN after the first cut: at 2.3 long x 0.52 radius sitting at z=1.75
  // it dominated the frame and ran off the left edge. It is an inset, not the
  // subject - it should sit in the gap between switch and lamp and stay inside
  // the plinth's footprint.
  const macro = new THREE.Group();
  macro.position.set(-0.25, SWITCH_Y + 0.34, 1.45);
  macro.visible = false;
  group.add(macro);

  const copperMat = materials.brushedSteel(0xc07840);
  copperMat.roughness = 0.48;
  copperMat.side = THREE.DoubleSide;
  const sleeve = new THREE.Mesh(
    new THREE.CylinderGeometry(0.38, 0.38, 1.7, 40, 1, true, Math.PI * 0.12, Math.PI * 1.2),
    copperMat,
  );
  sleeve.rotation.z = Math.PI / 2;
  macro.add(sleeve);
  const sleeveLinerMat = materials.paintedMetal(0x4a2c16);
  sleeveLinerMat.roughness = 0.95;
  sleeveLinerMat.side = THREE.BackSide;
  const sleeveLiner = new THREE.Mesh(
    new THREE.CylinderGeometry(0.365, 0.365, 1.7, 40, 1, true),
    sleeveLinerMat,
  );
  sleeveLiner.rotation.z = Math.PI / 2;
  macro.add(sleeveLiner);

  // Copper ion lattice: a regular grid of FIXED cores.
  const ionGeo = new THREE.SphereGeometry(0.04, 12, 10);
  const ionMat = materials.paintedMetal(0x8c4f24);
  ionMat.roughness = 0.6;
  const NX = 9;
  const NY = 4;
  const NZ = 4;
  const lattice = new THREE.InstancedMesh(ionGeo, ionMat, NX * NY * NZ);
  const tmp = new THREE.Object3D();
  let li = 0;
  for (let ix = 0; ix < NX; ix++) {
    for (let iy = 0; iy < NY; iy++) {
      for (let iz = 0; iz < NZ; iz++) {
        tmp.position.set(
          (ix / (NX - 1) - 0.5) * 1.46,
          (iy / (NY - 1) - 0.5) * 0.46,
          (iz / (NZ - 1) - 0.5) * 0.46,
        );
        tmp.updateMatrix();
        lattice.setMatrixAt(li++, tmp.matrix);
      }
    }
  }
  macro.add(lattice);

  // Free electrons: the whole point of the explainer, so they are individual
  // meshes with their own home position and phase - each has to jiggle about
  // ITS OWN spot and go nowhere.
  const electrons = [];
  const eGeo = new THREE.SphereGeometry(0.03, 12, 10);
  for (let i = 0; i < 34; i++) {
    const m = materials.glow(C_ACCENT, 2.2);
    m.transparent = true;
    m.opacity = 0;
    m.depthWrite = false;
    const e = new THREE.Mesh(eGeo, m);
    const home = new THREE.Vector3(
      (i / 33 - 0.5) * 1.44,
      (((i * 7) % 9) / 8 - 0.5) * 0.46,
      (((i * 5) % 7) / 6 - 0.5) * 0.46,
    );
    e.position.copy(home);
    e.userData = { home, drift: 0.6 + (((i * 11) % 13) / 12) * 0.7 };
    macro.add(e);
    electrons.push(e);
  }

  // --- callouts -------------------------------------------------------------
  const labels = calloutSets(['exterior', 'internal', 'snap', 'macro', 'grid']);
  labels.add('exterior', faceplate, 'Wall plate', [PLATE / 2 - 0.1, 0.72, 0.1], 35, 78);
  labels.add('exterior', rockerPivot, 'Rocker', [-0.1, -0.34, 0.22], -96, 96);
  labels.add('exterior', sconce, 'The lamp it feeds', [0.5, HOLDER_H + BULB_R * 0.92, 0.1], 30, 76);

  // Aimed down-RIGHT: pushed left it landed under the text panel (dir -128 was
  // 100% hidden on the circuit step), and the two terminal pills already own the
  // right flank at +-34, so this one drops below them.
  labels.add('internal', backBox, 'Back box', [BOX / 2 - 0.06, -0.82, -0.26], -68, 100);
  labels.add('internal', termIn, 'Live in', [0.16, -0.1, 0.06], -34, 72);
  labels.add('internal', termOut, 'To the lamp', [0.16, 0.12, 0.06], 34, 78);
  labels.add('internal', bladePivot, 'Moving contact', [0.12, 0.72, 0.08], 46, 80);
  labels.add('internal', fixedPost, 'Fixed contact', [0.1, -0.1, 0.08], 8, 74);

  labels.add('snap', springGroup, 'Over-centre spring', [0.12, 0.02, 0.1], -30, 104);
  labels.add('snap', bladePivot, 'Contacts snap shut', [0.12, 0.74, 0.08], 44, 92);

  labels.add('macro', macro, 'Copper lattice', [0.08, 0.34, 0.1], 86, 68);
  labels.add('macro', electrons[17], 'Free electron', [0.1, 0.14, 0.1], 62, 70);

  labels.add('grid', wires, 'The push, at near light speed', [-1.65, RUN_Y + 0.14, WZ + 0.06], -30, 128);

  // --- state ----------------------------------------------------------------
  // ONE object, ONE apply(). Every visible property below derives from it.
  const state = {
    phase: 0, // 0..1 the switch cycle: off -> on -> off
    jiggle: 0, // 0..1 AC oscillation phase (8 whole cycles per lap)
    pulse: 0, // 0..1 push travel (2 whole traversals per lap)
    reveal: 0, // 0 solid, 1 opened up
    spin: 0, // turntable, radians
    macroOn: false,
    pushOn: false,
  };

  // The rocker travels on a smooth window; the CONTACTS do not follow it -
  // they hold, then snap across in a fraction of the time. That difference IS
  // the over-centre spring, and it is the point of step 3.
  const rockerAt = (p) => win(p, 0.15, 0.27) - win(p, 0.7, 0.82);
  const contactAt = (p) => win(p, 0.225, 0.245) - win(p, 0.775, 0.795);

  function apply() {
    const p = clamp01(state.phase);
    group.rotation.y = state.spin;

    const r = rockerAt(p);
    rockerPivot.rotation.x = TILT - r * 2 * TILT;
    plunger.position.y = 0.42 - r * 0.16;
    springGroup.scale.y = 1 - r * 0.3;

    const c = contactAt(p);
    bladePivot.rotation.z = (1 - c) * -0.2; // closed = blade swung in to the pad

    // The lamp is lit exactly while the contacts are closed - one state, one
    // place: nothing else may light it.
    filamentMat.emissiveIntensity = 0.05 + c * 1.15;
    lampLight.intensity = c * 0.9;
    domeMat.opacity = 0.34 + c * 0.16;

    // Reveal: plaster and plate fade; the mechanism appears behind them.
    const t = clamp01(state.reveal);
    const fade = (mat, base, minOp) => {
      mat.transparent = t > 0.002;
      mat.opacity = 1 - (1 - minOp) * t;
      mat.depthWrite = t < 0.5; // trap 7: a fading mat must stop writing depth
      mat.clearcoat = base * (1 - t); // trap 2: coat is opacity-independent
    };
    fade(wallMat, wallBaseCoat, 0.08);
    fade(plateMat, plateBaseCoat, 0.1);
    // The rocker is dress too. Leaving it solid put a white slab across every
    // cutaway step - it sits nearest the camera, directly over the mechanism.
    fade(rockerMat, rockerBaseCoat, 0.12);
    mech.visible = t > 0.35;

    // Electrons: jiggle about their OWN home, net displacement zero.
    const swing = Math.sin(state.jiggle * TAU * 8);
    for (const e of electrons) {
      const h = e.userData.home;
      e.position.set(h.x + swing * 0.05 * e.userData.drift, h.y, h.z);
      e.material.opacity = state.macroOn ? 0.95 : 0;
    }
    macro.visible = state.macroOn;

    // The push races the wire far faster than anything else moves.
    push.setFront((state.pulse * 2) % 1, state.pushOn);
    pushUp.setFront(((state.pulse * 2) % 1) - 0.18, state.pushOn && c > 0.5);
  }
  apply();

  return {
    group,
    state,
    parts: { rockerPivot, bladePivot, springGroup, faceplate, sconce, macro, mech },
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setReveal(t) {
      state.reveal = t;
      apply();
    },
    setMacro(on) {
      state.macroOn = on;
      apply();
    },
    setPush(on) {
      state.pushOn = on;
      apply();
    },
    setLabels: labels.setLabels,
  };
}
