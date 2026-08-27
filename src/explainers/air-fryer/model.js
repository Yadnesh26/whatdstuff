import * as THREE from 'three';
import { materials, disc, rod, studioPlinth } from '../../framework/parts.js';
import { beveledBox, tubeAlong, bladeRing } from '../../framework/geometry.js';
import { clamp01, win, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A basket-drawer air fryer (Philips/Cosori-style): a matte moulded body with
// a pull-out pot below and the entire cooking system — a flat sheathed element
// and an axial fan — packed into the head above it.
//
// PROPORTIONS (real 5–6 L units, e.g. 33 x 26 x 30 cm): H:W:D = 1.27 : 1 :
// 1.15. BODY_H:BODY_W:BODY_D = 2.15 : 1.70 : 1.95 = 1.26 : 1 : 1.15, so the
// silhouette holds at model scale. The drawer front owns the lower 55% of the
// face, exactly as it does on the real product.
//
// MECHANISM (researched): a nichrome wire inside a steel sheath, bent into a
// flat hairpin spiral under the chamber roof, turns ~1,500 W of electricity
// into heat. An axial fan at 1,200–2,000 rpm pushes that air DOWN through the
// coil and onto the food at roughly 5 m/s — a countertop convection oven
// manages about 0.9 m/s, and that ratio is the whole product. The air has
// nowhere to go: it passes through the perforated basket floor, over a
// star-shaped deflector moulded into the pot base (Philips' "Rapid Air"
// starfish), up the narrow annulus between basket and pot, and back into the
// fan through slots in the chamber roof. Fast air shears away the film of
// evaporating moisture that otherwise insulates and wets the surface; the
// dried surface can then pass ~140 °C and brown (Maillard). It is NOT frying —
// oil moves heat into food an order of magnitude harder than moving air can.
//
// STATE SCALARS (one pose fn):
//   reveal     0 sealed shell -> 1 body ghosted, internals shown
//   flow       recirculation phase, whole cycles per lap
//   fanSpin    fan angle (rad), whole turns per lap
//   heat       0..1 element emissive (the thermostat cutting in and out)
//   crisp      0..1 browning of the chips in the basket
//   macro      0/1 the oversized single-chip insert
//   filmT      0..1 thickness of the vapour film on the macro chip
//   macroCrisp 0..1 browning of the macro chip

// --- one-scale layout: the product ------------------------------------------
const PLINTH_H = 0.26;
const BODY_W = 1.7;
const BODY_D = 1.95;
const BODY_H = 2.15;
const Y0 = PLINTH_H;
const Y1 = Y0 + BODY_H;
const DRAWER_TOP = Y0 + BODY_H * 0.55;

// --- one-scale layout: the pot and basket -----------------------------------
const PAN_R = 0.74;
const PAN_WALL = 0.045;
const PAN_FLOOR = 0.4;
const PAN_TOP = 1.4;
const BASKET_R = 0.6;
const BASKET_FLOOR = 0.52;
const BASKET_TOP = 1.3;
const STAR_Y = PAN_FLOOR + 0.015;
const FOOD_Y = BASKET_FLOOR + 0.06;

// --- one-scale layout: the head ---------------------------------------------
const ELEM_Y = 1.62;
const ELEM_R_OUT = 0.66;
const ELEM_R_IN = 0.245;
const ELEM_TURNS = 3.5;
const ELEM_TUBE = 0.045;
const SKIRT_Y0 = 1.42;
const PLATE_Y = 1.76;
const PLATE_R_IN = 0.34;
const PLATE_R_OUT = 0.8;
const FAN_Y = 1.83;
const FAN_R = 0.34;
const MOTOR_Y0 = 1.94;
const MOTOR_H = 0.24;
const MOTOR_R = 0.13;

// Sector cutaway: every vertical wall inside the machine (pot, basket, chamber
// skirt) is missing a 120° wedge centred on azimuth 45° — the direction every
// revealed step's camera looks from — so the mechanism is genuinely sectioned
// rather than hidden behind its own pot wall.
const CUT_START = Math.PI / 4 + Math.PI / 3;
const CUT_LEN = TAU - (2 * Math.PI) / 3;

// --- one-scale layout: the macro chip insert --------------------------------
// Deliberately oversized and floated beside the machine (the fiber-optics
// insert trick): the vapour film on a real chip is fractions of a millimetre,
// invisible at product scale.
const MACRO_POS = new THREE.Vector3(2.05, 1.55, 0.5);
// ~7:1:1 — a cut chip, not a loaf. The 3/4 yaw below foreshortens it on
// screen, so anything squatter than this reads as a block of butter.
const CHIP_L = 1.02;
const CHIP_W = 0.15;
const CHIP_H = 0.14;
// A cut chip has FLAT sides and square-ish ends. A generous bevel here turned
// it into a capsule that read as a sausage in the first review pass — keep it
// to a knife-edge softening only.
const CHIP_BEVEL = 0.018;

const RAW_CHIP = new THREE.Color(0xe9cf9a);
const DONE_CHIP = new THREE.Color(0x9d5a1c);

export function buildFryer({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // --- materials -----------------------------------------------------------
  // Each ghostable shell part gets its OWN material instance: fading one must
  // never drag an always-opaque neighbour down with it.
  const bodyMat = materials.polymer(0x2a2d33);
  const drawerMat = materials.polymer(0x2a2d33);
  const panelMat = materials.polymer(0x16181c);
  const trimMat = materials.polymer(0x101216);
  const handleMat = materials.polymer(0x3d434c);

  // Non-stick pot and chamber liner: dark, matte, barely metallic — safe to
  // render DoubleSide, since the concave-metal-mirror trap only bites on
  // polished metal.
  const panMat = new THREE.MeshPhysicalMaterial({
    color: 0x24262a,
    metalness: 0.12,
    roughness: 0.88,
    side: THREE.DoubleSide,
  });
  const skirtMat = new THREE.MeshPhysicalMaterial({
    color: 0x2c2f35,
    metalness: 0.12,
    roughness: 0.86,
    side: THREE.DoubleSide,
  });
  // Map-free on purpose: brushedSteel's roughnessMap MULTIPLIES base roughness
  // and would read near-chrome on this big concave sector. Darkened from the
  // first pass, where it blew out to near-white under the studio HDRI and
  // swallowed its own perforations.
  const basketMat = new THREE.MeshPhysicalMaterial({
    color: 0x878e97,
    metalness: 0.55,
    roughness: 0.86,
    side: THREE.DoubleSide,
  });
  const elementMat = new THREE.MeshPhysicalMaterial({
    color: 0x55575c,
    metalness: 1,
    roughness: 0.44,
    emissive: 0xff4d1a,
    emissiveIntensity: 0,
  });
  const ceramicMat = materials.polymer(0xd8d2c6);
  // Map-free: the aluminum preset's cast normal map reads as heavy pitting at
  // this plate's on-screen size — concrete, not a machined roof panel.
  const plateMat = new THREE.MeshPhysicalMaterial({
    color: 0x9aa1aa,
    metalness: 0.88,
    roughness: 0.56,
  });
  // Also map-free, and lighter than the roof plate: with the cast normal map
  // the thin blades read as crumpled foil at the fan step's framing.
  const fanMat = new THREE.MeshPhysicalMaterial({
    color: 0xccd2d9,
    metalness: 0.8,
    roughness: 0.44,
  });
  // Matte, NOT paintedMetal: the clearcoat put a hard specular dome on the
  // motor that pulled the eye off the mechanism in every interior step.
  const motorMat = materials.polymer(0x24272d);
  const starMat = materials.aluminum(0x9aa0a8);
  starMat.roughness = 0.78;
  const foodMat = new THREE.MeshPhysicalMaterial({
    color: RAW_CHIP.clone(),
    metalness: 0,
    roughness: 0.78,
  });
  const macroChipMat = new THREE.MeshPhysicalMaterial({
    color: RAW_CHIP.clone(),
    metalness: 0,
    roughness: 0.8,
  });
  const filmMat = new THREE.MeshPhysicalMaterial({
    color: 0xbfe0ff,
    metalness: 0,
    roughness: 0.35,
    transparent: true,
    opacity: 0.2,
    depthWrite: false, // trap #7 — a fading skin must not punch holes
    side: THREE.DoubleSide,
  });

  group.add(studioPlinth({ w: 2.9, h: PLINTH_H, d: 2.7 }));

  const shellSoft = []; // ghosts on reveal
  const shellHide = []; // small shell details — hidden outright on reveal
  const internals = []; // hidden until revealed

  // ==========================================================================
  //  SHELL — the complete, solid product
  // ==========================================================================
  const body = beveledBox(BODY_W, BODY_H, BODY_D, bodyMat, 0.16);
  body.position.y = Y0 + BODY_H / 2;
  group.add(body);
  shellSoft.push(body);

  // seam between the head and the drawer it clamps down onto
  const seam = beveledBox(BODY_W + 0.004, 0.014, BODY_D + 0.004, trimMat, 0.005);
  seam.position.y = DRAWER_TOP;
  group.add(seam);
  shellHide.push(seam);

  // Recessed frame behind the drawer front: without this dark shadow gap the
  // drawer was invisible against the body and the whole product read as a
  // featureless cube — the shut line is most of what says "this pulls out".
  const recess = beveledBox(
    BODY_W * 0.96,
    (DRAWER_TOP - Y0) * 0.88,
    0.03,
    materials.rubber(0x0a0b0d),
    0.012,
  );
  recess.position.set(0, Y0 + (DRAWER_TOP - Y0) * 0.5, BODY_D / 2 - 0.004);
  group.add(recess);
  shellHide.push(recess);

  // drawer front, proud of the body, with a moulded pull
  const drawerFront = beveledBox(BODY_W * 0.93, (DRAWER_TOP - Y0) * 0.84, 0.07, drawerMat, 0.045);
  drawerFront.position.set(0, Y0 + (DRAWER_TOP - Y0) * 0.5, BODY_D / 2 + 0.012);
  group.add(drawerFront);
  shellSoft.push(drawerFront);

  const handle = beveledBox(BODY_W * 0.42, 0.11, 0.085, handleMat, 0.03);
  handle.position.set(0, Y0 + (DRAWER_TOP - Y0) * 0.78, BODY_D / 2 + 0.06);
  group.add(handle);
  shellHide.push(handle);

  // raked control panel across the top of the face
  // Near-vertical, and proud of the face: raked back at -0.34 it presented
  // itself to a user standing over the machine, which is exactly the angle
  // none of these cameras shoot from — the readout vanished edge-on.
  const panel = beveledBox(BODY_W * 0.8, 0.3, 0.05, panelMat, 0.02);
  panel.position.set(0, Y1 - 0.26, BODY_D / 2 - 0.012);
  panel.rotation.x = -0.12;
  group.add(panel);
  shellSoft.push(panel);

  // the readout: a real number, because the dial is the only part of this
  // machine most people ever think about
  function screenTexture(text) {
    const cv = document.createElement('canvas');
    cv.width = 256;
    cv.height = 96;
    const ctx = cv.getContext('2d');
    ctx.fillStyle = '#07090d';
    ctx.fillRect(0, 0, 256, 96);
    ctx.font = '700 56px "Segoe UI", sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillStyle = '#ff9a5e';
    ctx.fillText(text, 128, 50);
    const tex = new THREE.CanvasTexture(cv);
    tex.colorSpace = THREE.SRGBColorSpace;
    return tex;
  }
  const screenTex = screenTexture('180°C');
  const screenMat = new THREE.MeshStandardMaterial({
    color: 0x05070a,
    map: screenTex,
    emissive: 0xffffff,
    emissiveMap: screenTex,
    emissiveIntensity: 1.4, // capped — bloom, not a clipped white patch
    roughness: 0.4,
    metalness: 0,
  });
  const screen = new THREE.Mesh(new THREE.PlaneGeometry(0.52, 0.19), screenMat);
  screen.position.set(0, 0.04, 0.034); // clear of the panel face — 0.027 z-fought
  panel.add(screen);
  shellHide.push(screen);

  const buttonMat = materials.rubber(0x2b2f36);
  for (let bi = 0; bi < 4; bi++) {
    const btn = disc(0.028, 0.008, buttonMat, 20);
    btn.rotation.x = Math.PI / 2;
    btn.position.set(-0.3 + bi * 0.2, -0.095, 0.03);
    panel.add(btn);
    shellHide.push(btn);
  }

  // motor vent on the right flank — real slots over a dark cavity, so it reads
  // as an opening rather than a printed pattern
  const ventShape = new THREE.Shape();
  ventShape.moveTo(-0.3, -0.22);
  ventShape.lineTo(0.3, -0.22);
  ventShape.lineTo(0.3, 0.22);
  ventShape.lineTo(-0.3, 0.22);
  ventShape.closePath();
  for (let vi = 0; vi < 7; vi++) {
    const slot = new THREE.Path();
    const sx = -0.24 + vi * 0.08;
    slot.moveTo(sx, -0.17);
    slot.lineTo(sx + 0.032, -0.17);
    slot.lineTo(sx + 0.032, 0.17);
    slot.lineTo(sx, 0.17);
    slot.closePath();
    ventShape.holes.push(slot);
  }
  const vent = new THREE.Mesh(
    new THREE.ExtrudeGeometry(ventShape, { depth: 0.018, bevelEnabled: false }),
    trimMat,
  );
  vent.rotation.y = Math.PI / 2;
  vent.position.set(BODY_W / 2 - 0.004, Y1 - 0.46, -0.1);
  group.add(vent);
  shellHide.push(vent);

  const ventCavity = beveledBox(0.06, 0.4, 0.56, materials.rubber(0x0a0b0d), 0.01);
  ventCavity.position.set(BODY_W / 2 - 0.06, Y1 - 0.46, -0.1);
  group.add(ventCavity);
  shellHide.push(ventCavity);

  // ==========================================================================
  //  THE POT (drawer interior) — sectioned 240°
  // ==========================================================================
  const panWall = new THREE.Mesh(
    new THREE.CylinderGeometry(
      PAN_R,
      PAN_R * 0.97,
      PAN_TOP - PAN_FLOOR,
      56,
      1,
      true,
      CUT_START,
      CUT_LEN,
    ),
    panMat,
  );
  panWall.position.y = (PAN_FLOOR + PAN_TOP) / 2;
  group.add(panWall);
  internals.push(panWall);

  const panFloor = new THREE.Mesh(
    new THREE.CylinderGeometry(PAN_R * 0.97, PAN_R * 0.95, PAN_WALL, 56),
    panMat,
  );
  panFloor.position.y = PAN_FLOOR + PAN_WALL / 2;
  group.add(panFloor);
  internals.push(panFloor);

  const panRim = new THREE.Mesh(new THREE.TorusGeometry(PAN_R - 0.012, 0.024, 10, 64, CUT_LEN), panMat);
  panRim.rotation.x = Math.PI / 2;
  panRim.rotation.z = -CUT_START;
  panRim.position.y = PAN_TOP;
  group.add(panRim);
  internals.push(panRim);

  // Rapid-Air star: the moulded deflector in the pot base that throws the
  // down-draught back outwards instead of letting it stall under the basket
  const starShape = new THREE.Shape();
  const STAR_PTS = 5;
  for (let si = 0; si < STAR_PTS * 2; si++) {
    const sr = si % 2 === 0 ? 0.52 : 0.27;
    const sa = (si / (STAR_PTS * 2)) * TAU;
    const px = Math.cos(sa) * sr;
    const py = Math.sin(sa) * sr;
    if (si === 0) starShape.moveTo(px, py);
    else starShape.lineTo(px, py);
  }
  starShape.closePath();
  const star = new THREE.Mesh(
    new THREE.ExtrudeGeometry(starShape, {
      depth: 0.03,
      bevelEnabled: true,
      bevelThickness: 0.012,
      bevelSize: 0.014,
      bevelSegments: 2,
      curveSegments: 6,
    }),
    starMat,
  );
  star.rotation.x = -Math.PI / 2;
  star.position.y = STAR_Y;
  group.add(star);
  internals.push(star);

  // ==========================================================================
  //  THE BASKET — perforated floor, sectioned wall
  // ==========================================================================
  const floorShape = new THREE.Shape();
  floorShape.absarc(0, 0, BASKET_R, 0, TAU, false);
  const PERF_R = 0.043;
  const PERF_PITCH = 0.155;
  for (let ix = -5; ix <= 5; ix++) {
    for (let iz = -5; iz <= 5; iz++) {
      const hx = ix * PERF_PITCH + (Math.abs(iz) % 2 ? PERF_PITCH / 2 : 0);
      const hz = iz * PERF_PITCH * 0.87;
      if (Math.hypot(hx, hz) > BASKET_R - 0.1) continue;
      const hole = new THREE.Path();
      hole.absarc(hx, hz, PERF_R, 0, TAU, true);
      floorShape.holes.push(hole);
    }
  }
  const basketFloor = new THREE.Mesh(
    new THREE.ExtrudeGeometry(floorShape, { depth: 0.022, bevelEnabled: false, curveSegments: 14 }),
    basketMat,
  );
  basketFloor.rotation.x = -Math.PI / 2;
  basketFloor.position.y = BASKET_FLOOR;
  group.add(basketFloor);
  internals.push(basketFloor);

  const basketWall = new THREE.Mesh(
    new THREE.CylinderGeometry(
      BASKET_R,
      BASKET_R * 0.96,
      BASKET_TOP - BASKET_FLOOR,
      52,
      1,
      true,
      CUT_START,
      CUT_LEN,
    ),
    basketMat,
  );
  basketWall.position.y = (BASKET_FLOOR + BASKET_TOP) / 2;
  group.add(basketWall);
  internals.push(basketWall);

  const basketRim = new THREE.Mesh(
    new THREE.TorusGeometry(BASKET_R - 0.008, 0.018, 10, 60, CUT_LEN),
    basketMat,
  );
  basketRim.rotation.x = Math.PI / 2;
  basketRim.rotation.z = -CUT_START;
  basketRim.position.y = BASKET_TOP;
  group.add(basketRim);
  internals.push(basketRim);

  // chips — deterministic scatter so every capture is identical
  let rndState = 7;
  const rnd = () => {
    rndState = (rndState * 1664525 + 1013904223) % 4294967296;
    return rndState / 4294967296;
  };
  // Scattered around an ANNULUS, not the whole floor: a full load buried the
  // perforations, and step 5's copy is built entirely on the viewer being able
  // to see the holes the air leaves through.
  const chips = new THREE.Group();
  for (let ci = 0; ci < 11; ci++) {
    const chip = beveledBox(0.075, 0.065, 0.3 + rnd() * 0.08, foodMat, 0.026);
    const ca = rnd() * TAU;
    const cr = 0.24 + rnd() * 0.2;
    const layer = ci > 7 ? 1 : 0;
    chip.position.set(Math.cos(ca) * cr, FOOD_Y + layer * 0.07, Math.sin(ca) * cr);
    chip.rotation.set((rnd() - 0.5) * 0.5, rnd() * TAU, (rnd() - 0.5) * 0.4);
    chips.add(chip);
  }
  group.add(chips);
  internals.push(chips);

  // ==========================================================================
  //  THE HEAD — chamber skirt, element, roof plate, fan, motor
  // ==========================================================================
  const skirt = new THREE.Mesh(
    new THREE.CylinderGeometry(
      PLATE_R_OUT,
      PAN_R * 1.02,
      PLATE_Y - SKIRT_Y0,
      56,
      1,
      true,
      CUT_START,
      CUT_LEN,
    ),
    skirtMat,
  );
  skirt.position.y = (SKIRT_Y0 + PLATE_Y) / 2;
  group.add(skirt);
  internals.push(skirt);

  // The element: ONE sheathed rod, spiralling in and back out again, both
  // terminals ending at the chamber wall — how a flat hairpin element is
  // actually bent, rather than a spiral that magically stops in mid-air.
  const elemPts = [];
  const ELEM_SAMPLES = 240;
  for (let ei = 0; ei <= ELEM_SAMPLES; ei++) {
    const u = ei / ELEM_SAMPLES;
    const theta = u * ELEM_TURNS * TAU;
    const er = ELEM_R_IN + (ELEM_R_OUT - ELEM_R_IN) * Math.abs(1 - 2 * u);
    elemPts.push([Math.cos(theta) * er, ELEM_Y, Math.sin(theta) * er]);
  }
  const element = tubeAlong(elemPts, ELEM_TUBE, elementMat, {
    tubularSegments: 320,
    radialSegments: 12,
  });
  group.add(element);
  internals.push(element);

  // terminals: the two rod ends turn up into ceramic insulators
  for (const endIdx of [0, ELEM_SAMPLES]) {
    const ex = elemPts[endIdx][0];
    const ez = elemPts[endIdx][2];
    const riser = rod(ELEM_TUBE * 0.9, 0.12, elementMat, 12);
    riser.position.set(ex, ELEM_Y, ez);
    group.add(riser);
    internals.push(riser);
    const insulator = rod(0.055, 0.09, ceramicMat, 16);
    insulator.position.set(ex, ELEM_Y + 0.11, ez);
    group.add(insulator);
    internals.push(insulator);
  }

  // thermostat probe — the part that decides when 1,500 W is enough
  const probe = rod(0.026, 0.13, ceramicMat, 14);
  probe.position.set(0.5, PLATE_Y - 0.15, 0.34);
  group.add(probe);
  internals.push(probe);
  const probeTip = new THREE.Mesh(
    new THREE.SphereGeometry(0.03, 12, 10),
    materials.aluminum(0xc0c6cc),
  );
  probeTip.position.set(0.5, PLATE_Y - 0.15, 0.34);
  group.add(probeTip);
  internals.push(probeTip);

  // chamber roof: an annulus with the fan bore in the middle and the return
  // slots the recirculating air comes back up through
  const plateShape = new THREE.Shape();
  plateShape.absarc(0, 0, PLATE_R_OUT, 0, TAU, false);
  const bore = new THREE.Path();
  bore.absarc(0, 0, PLATE_R_IN, 0, TAU, true);
  plateShape.holes.push(bore);
  const SLOTS = 18;
  for (let si = 0; si < SLOTS; si++) {
    const sa = (si / SLOTS) * TAU;
    const slot = new THREE.Path();
    const nx = Math.cos(sa);
    const nz = Math.sin(sa);
    const tx = -Math.sin(sa);
    const tz = Math.cos(sa);
    const cx = nx * 0.6;
    const cz = nz * 0.6;
    const half = 0.05;
    const reach = 0.16;
    slot.moveTo(cx + tx * half, cz + tz * half);
    slot.lineTo(cx - tx * half, cz - tz * half);
    slot.lineTo(cx - tx * half + nx * reach, cz - tz * half + nz * reach);
    slot.lineTo(cx + tx * half + nx * reach, cz + tz * half + nz * reach);
    slot.closePath();
    plateShape.holes.push(slot);
  }
  const roofPlate = new THREE.Mesh(
    new THREE.ExtrudeGeometry(plateShape, { depth: 0.04, bevelEnabled: false, curveSegments: 22 }),
    plateMat,
  );
  roofPlate.rotation.x = -Math.PI / 2;
  roofPlate.position.y = PLATE_Y;
  group.add(roofPlate);
  internals.push(roofPlate);

  const fan = bladeRing(
    {
      blades: 7,
      hubR: 0.075,
      span: FAN_R - 0.075,
      chord: 0.19,
      chordTip: 0.16,
      camber: 0.13,
      twist: 0.62,
      twistTip: 0.34,
      hubDepth: 0.07,
      hubMaterial: motorMat,
    },
    fanMat,
  );
  fan.group.rotation.x = -Math.PI / 2;
  fan.group.position.y = FAN_Y;
  group.add(fan.group);
  internals.push(fan.group);

  const motor = new THREE.Mesh(
    new THREE.CylinderGeometry(MOTOR_R, MOTOR_R * 0.94, MOTOR_H, 32),
    motorMat,
  );
  motor.position.y = MOTOR_Y0 + MOTOR_H / 2;
  group.add(motor);
  internals.push(motor);

  const motorCap = new THREE.Mesh(new THREE.SphereGeometry(MOTOR_R * 0.94, 24, 12), motorMat);
  motorCap.scale.y = 0.28;
  motorCap.position.y = MOTOR_Y0 + MOTOR_H;
  group.add(motorCap);
  internals.push(motorCap);

  const shaft = rod(0.035, MOTOR_Y0 - FAN_Y, materials.aluminum(0xc8ced4), 14);
  shaft.position.y = FAN_Y;
  group.add(shaft);
  internals.push(shaft);

  // ==========================================================================
  //  THE AIR CIRCUIT — one closed profile, swept round the axis
  // ==========================================================================
  // The loop is drawn ONCE in the (radius, height) plane and each packet is
  // then rotated to its own azimuth, so a single closed curve carries the whole
  // recirculation: down through the coil, across the food, out through the
  // basket floor, up the annulus, back in through the roof slots.
  const flowProfile = [
    [0.16, 1.74],
    [0.3, ELEM_Y],
    [0.34, 1.2],
    [0.44, 0.66],
    [0.55, 0.47],
    [0.66, 0.56],
    [0.648, 1.26],
    [0.68, 1.55],
    [0.72, PLATE_Y + 0.05],
    [0.52, 2.02],
    [0.18, 2.0],
    [0.1, 1.88],
  ];
  const flowCurve = new THREE.CatmullRomCurve3(
    flowProfile.map(([r, y]) => new THREE.Vector3(r, y, 0)),
    true,
    'catmullrom',
    0.28,
  );

  const HOT = new THREE.Color(0xff6a2a);
  const COOL = new THREE.Color(0x3d9fd6);
  const packetGeo = new THREE.SphereGeometry(0.03, 10, 8);
  const packets = [];
  const packetGroup = new THREE.Group();
  for (let pi = 0; pi < 28; pi++) {
    const pm = materials.glow(0xff6a2a, 1.5);
    pm.transparent = true;
    pm.opacity = 1;
    pm.depthWrite = false;
    const dot = new THREE.Mesh(packetGeo, pm);
    packetGroup.add(dot);
    packets.push({ mesh: dot, seed: pi / 28 });
  }
  group.add(packetGroup);
  internals.push(packetGroup);

  // ==========================================================================
  //  MACRO INSERT — one chip, oversized, with the vapour film on it
  // ==========================================================================
  const macroGroup = new THREE.Group();
  macroGroup.position.copy(MACRO_POS);
  // Yawed to ~3/4 against the macro steps' view axis: broadside, the chip lost
  // its square cross-section and read as a flat plank.
  macroGroup.rotation.set(0.14, 1.62, 0.1);
  group.add(macroGroup);

  const macroChip = beveledBox(CHIP_W, CHIP_H, CHIP_L, macroChipMat, CHIP_BEVEL);
  macroGroup.add(macroChip);

  const film = beveledBox(CHIP_W, CHIP_H, CHIP_L, filmMat, CHIP_BEVEL);
  macroGroup.add(film);

  // Steam, not ping-pong balls: small and faint enough to read as vapour when
  // several drift together.
  const wispGeo = new THREE.SphereGeometry(0.009, 8, 7);
  const wisps = [];
  const WISP_N = 30;
  for (let wi = 0; wi < WISP_N; wi++) {
    const wm = materials.glow(0xdff0ff, 0.8);
    wm.transparent = true;
    wm.depthWrite = false;
    const wisp = new THREE.Mesh(wispGeo, wm);
    macroGroup.add(wisp);
    wisps.push({
      mesh: wisp,
      seed: wi / WISP_N,
      z: (((wi * 7) % WISP_N) / WISP_N - 0.5) * CHIP_L * 0.9,
      side: wi % 2 === 0 ? 1 : -1,
    });
  }

  // ==========================================================================
  //  CALLOUTS
  // ==========================================================================
  const labels = calloutSets(['exterior', 'internal', 'element', 'fan', 'flow', 'film', 'crust']);

  labels.add(
    'exterior',
    group,
    'Basket drawer',
    [0.2, Y0 + (DRAWER_TOP - Y0) * 0.5, BODY_D / 2 + 0.06],
    -38,
    88,
  );
  labels.add('exterior', group, 'Control panel', [0.2, Y1 - 0.16, BODY_D / 2 - 0.1], 46, 86);
  labels.add('exterior', group, 'Motor vent', [BODY_W / 2, Y1 - 0.46, -0.1], 22, 74);

  labels.add('internal', group, 'Heating element', [0.5, ELEM_Y, 0.3], 42, 92);
  labels.add('internal', group, 'Fan', [0.2, FAN_Y + 0.03, 0.2], 52, 78);
  labels.add('internal', group, 'Perforated basket', [0.42, BASKET_FLOOR + 0.02, 0.42], -42, 96);
  // Anchored at the section EDGE (azimuth -15°), not in the middle of the
  // cutaway opening: the gap is only legible where both walls still exist.
  labels.add('internal', group, 'Return gap', [0.626, 1.05, -0.168], 18, 80);

  labels.add('element', group, 'Nichrome element — 1,500 W', [0.5, ELEM_Y, 0.3], 40, 104);
  labels.add('element', group, 'Thermostat probe', [0.5, PLATE_Y - 0.12, 0.34], -34, 88);

  labels.add('fan', group, 'Fan — 1,200–2,000 rpm', [0.24, FAN_Y, 0.24], 46, 100);
  labels.add('fan', group, 'Motor', [0.1, MOTOR_Y0 + MOTOR_H * 0.6, 0.1], 28, 74);
  labels.add('fan', group, 'Return slots', [0.5, PLATE_Y + 0.04, 0.5], -28, 88);

  labels.add('flow', group, 'Blown down over the coil', [0.24, 1.5, 0.24], 38, 104);
  labels.add('flow', group, 'Out through the floor', [0.36, BASKET_FLOOR - 0.03, 0.36], -44, 96);
  labels.add('flow', group, 'Up the return gap', [0.626, 1.02, -0.168], 16, 86);
  labels.add('flow', group, 'Back into the fan', [0.14, 1.98, 0.14], 56, 84);

  labels.add('film', macroGroup, 'Vapour film', [0, CHIP_W * 0.62, -0.1], 62, 80);
  labels.add('film', macroGroup, 'Dry surface', [0.11, -0.02, 0.24], -46, 78);
  labels.add('crust', macroGroup, 'Maillard crust', [0, CHIP_W * 0.56, 0.16], 58, 86);

  // ==========================================================================
  //  POSE
  // ==========================================================================
  const state = {
    reveal: 0,
    flow: 0,
    fanSpin: 0,
    heat: 0.85,
    crisp: 0.32,
    macro: 0,
    filmT: 0,
    macroCrisp: 0.2,
  };

  const tmpColor = new THREE.Color();
  const tmpPoint = new THREE.Vector3();
  const coldElement = new THREE.Color(0x55575c);
  const hotElement = new THREE.Color(0x8a5a44);

  function placePackets() {
    const swirl = state.flow * TAU;
    for (const { mesh, seed } of packets) {
      const t = (state.flow + seed) % 1;
      flowCurve.getPointAt(t, tmpPoint);
      const az = seed * TAU + swirl;
      mesh.position.set(Math.cos(az) * tmpPoint.x, tmpPoint.y, Math.sin(az) * tmpPoint.x);
      // hot leaving the coil, giving that heat up to the food on the way round
      const chill = clamp01(win(t, 0.06, 0.42));
      const reheat = clamp01(win(t, 0.82, 0.99));
      tmpColor.copy(HOT).lerp(COOL, chill * (1 - reheat));
      mesh.material.color.copy(tmpColor);
      mesh.material.emissive.copy(tmpColor);
    }
  }

  function placeWisps() {
    // moisture boiling off the surface: it hangs there in still air and is
    // swept away when the flow picks up, which is the entire mechanism
    const sweep = 0.18 + 0.9 * (1 - state.filmT);
    for (const { mesh, seed, z, side } of wisps) {
      const t = (state.flow * 2 + seed) % 1;
      const lift = CHIP_H * 0.5 + t * 0.2;
      mesh.position.set(side * CHIP_W * 0.36 + t * sweep, lift, z + t * 0.1 * side);
      const fade = clamp01(win(t, 0, 0.12)) * (1 - clamp01(win(t, 0.55, 1)));
      mesh.material.opacity = fade * (0.18 + 0.34 * state.filmT);
    }
  }

  function apply() {
    fan.group.rotation.z = -state.fanSpin;
    shaft.rotation.y = state.fanSpin;

    elementMat.emissiveIntensity = state.heat * 1.6;
    elementMat.color.copy(coldElement).lerp(hotElement, state.heat * 0.5);

    foodMat.color.copy(RAW_CHIP).lerp(DONE_CHIP, clamp01(state.crisp));
    foodMat.roughness = 0.78 - 0.14 * clamp01(state.crisp);
    macroChipMat.color.copy(RAW_CHIP).lerp(DONE_CHIP, clamp01(state.macroCrisp));
    macroChipMat.roughness = 0.8 - 0.18 * clamp01(state.macroCrisp);

    placePackets();
    placeWisps();

    const f = clamp01(state.filmT);
    film.scale.set(1 + f * 0.46, 1 + f * 0.5, 1 + f * 0.09);
    filmMat.opacity = 0.04 + f * 0.26;

    macroGroup.visible = state.macro > 0.5;

    const r = clamp01(state.reveal);
    for (const m of shellSoft) {
      const mat = m.material;
      mat.transparent = r > 0.02;
      mat.opacity = 1 - r * 0.9;
      mat.depthWrite = r < 0.4;
      mat.clearcoat = r > 0.5 ? 0 : 0.15; // coat renders full strength when ghosted
    }
    for (const o of shellHide) o.visible = r < 0.5;
    for (const o of internals) o.visible = r > 0.5;
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
      fan: fan.group,
      element,
      basket: basketWall,
      chips,
      packets: packetGroup,
      macro: macroGroup,
      drawerFront,
    },
  };
}
