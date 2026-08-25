import * as THREE from 'three';
import { materials, studioPlinth } from '../../framework/parts.js';
import { beveledBox, tubeAlong } from '../../framework/geometry.js';
import { smooth } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A small brushed permanent-magnet DC motor — the RS-380 class can that lives
// in drills, blenders, toy cars and window winders — product-shot staged in a
// bench cradle on a charcoal plinth.
//
// Reference facts (Precision Microdrives' brushed-motor primer; Pelonis
// "Fundamentals of Brushed DC Motors"):
//  - Four parts: a STATOR (two curved permanent magnets bonded inside a steel
//    can, which doubles as the magnetic yoke), a ROTOR/ARMATURE (a laminated
//    iron core on the shaft, each tooth wound with copper), a COMMUTATOR (a
//    split copper ring on the shaft) and two carbon BRUSHES that press on it.
//  - THREE poles, not two. A two-pole armature has a dead spot: with the
//    rotor poles in line with the stator poles the torque is zero and the
//    motor cannot start from that position, and during the revolution the
//    brushes momentarily bridge both commutator sections. "Most small
//    electromechanical DC motors have a minimum of three poles" — three
//    windings wired in delta to three commutator sections.
//  - The commutator is a mechanical rotary switch: as the rotor turns, each
//    brush slides off one segment onto the next, energising the next winding
//    and reversing the current in the one it left. Torque therefore never
//    reverses, and rotation is continuous.
//  - Motors 10 mm in diameter and under are usually coreless; at this size
//    the core is a stack of thin insulated laminations, same reason as a
//    transformer core — to break up eddy currents.
//
// ---------------------------------------------------------------------------
// PROPORTIONS — one scale, ratios read off an RS-380-class can (27.7 mm
// diameter x 38 mm body ≈ 1 : 1.37; output shaft ≈ 0.4 x diameter).
// The axis runs along X. The label-heavy END (commutator, cap, terminals)
// points +X so it lands on the RIGHT of frame, clear of the text panel; the
// output shaft points -X.
// ---------------------------------------------------------------------------
const PLINTH_H = 0.26;
const AXIS_Y = 1.05; // motor centreline above the floor

const CAN_R = 0.6; // can outer radius        → 1.20 dia
const CAN_X0 = -0.66; // front (shaft) end
const CAN_X1 = 0.72; // rear (cap) end        → 1.38 long = 1.15 x dia
const FACE_X = -0.685; // front face plate centre
const BOSS_X = -0.775; // bearing turret centre

const CAP_R = 0.625; // rear cap crimps OVER the can
const CAP_X0 = 0.66;
const CAP_X1 = 0.95;

const SHAFT_R = 0.055;
const SHAFT_X0 = -1.3; // protrudes 0.64 = 0.53 x dia
const SHAFT_X1 = 0.8;

const MAG_IR = 0.455; // stator magnet inner face
const MAG_OR = 0.56;
const MAG_LEN = 0.86; // just overhangs the core, leaving the commutator clear
const MAG_SPAN = 135; // degrees of arc each magnet covers

const CORE_L = 0.78; // armature stack length
const LAM_N = 7; // visible lamination slices
const TIP_R = 0.39; // pole tip → 0.065 air gap
const SHOE_IN_R = 0.32;
const HUB_R = 0.15;
const STEM_W = 0.085; // half-width of a pole stem
// Three 68° shoes leave 156° of open slot: enough for the teeth to read AS
// teeth and for the windings inside them to be visible at all.
const SHOE_HALF = 34;

// 12 turns per tooth, laid out to clear the stem flanks and stay under the
// shoe: every (row, col) pair is inside the slot, none inside the iron.
const COIL_ROWS = [0.155, 0.185, 0.215, 0.245];
const COIL_COLS = [0.102, 0.132, 0.162];
const COIL_WIRE_R = 0.0125;
const END_TURN = 0.075; // how far the winding bulges past the core

const COM_X0 = 0.5; // commutator drum
const COM_X1 = 0.7;
const COM_IR = 0.115;
const COM_OR = 0.19;
// 3 segments with 16° insulating gaps. Real gaps are thinner; these are sized
// so the split — the whole point of a commutator — is legible on screen.
const COM_SPAN = 104;

const BRUSH_X = 0.625; // rear half of the commutator, clear of the risers
const FORCE_R = 0.44; // force arrows ride the air gap

const POLE_PHI0 = 0; // pole 0 starts at +Z

const WARM = 0xff9a4d; // current one way
const COOL = 0x5aa8ff; // current the other way
const FIELD_BLUE = 0x86b9ff;

// φ is measured about the X axis from +Z toward +Y:  p = (x, r·sinφ, r·cosφ).
// A rotation of `a` about +X maps φ → φ − a, which is the whole of the
// commutation maths below.
const wrapDeg = (d) => {
  const x = ((d % 360) + 360) % 360;
  return x > 180 ? x - 360 : x;
};

// Annular sector in the (Z, Y) plane, ready for extrudeAlongX.
function sectorShape(rIn, rOut, centerDeg, spanDeg, segs = 30) {
  const a0 = ((centerDeg - spanDeg / 2) * Math.PI) / 180;
  const a1 = ((centerDeg + spanDeg / 2) * Math.PI) / 180;
  const s = new THREE.Shape();
  for (let i = 0; i <= segs; i++) {
    const a = a0 + ((a1 - a0) * i) / segs;
    const x = Math.cos(a) * rOut;
    const y = Math.sin(a) * rOut;
    if (i === 0) s.moveTo(x, y);
    else s.lineTo(x, y);
  }
  for (let i = segs; i >= 0; i--) {
    const a = a0 + ((a1 - a0) * i) / segs;
    s.lineTo(Math.cos(a) * rIn, Math.sin(a) * rIn);
  }
  s.closePath();
  return s;
}

// Disc with a real hole through it — face plates, bearing turrets. A shaft
// opening has to be an ACTUAL hole: the shaft passes through it.
function ringShape(rIn, rOut) {
  const s = new THREE.Shape();
  s.absarc(0, 0, rOut, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, rIn, 0, Math.PI * 2, true);
  s.holes.push(hole);
  return s;
}

function discShape(r) {
  const s = new THREE.Shape();
  s.absarc(0, 0, r, 0, Math.PI * 2, false);
  return s;
}

// Extrude a (Z, Y)-plane shape along the motor axis, centred on x = 0.
// rotateY(-90°) maps (sx, sy, sz) → (-sz, sy, sx): shape x → world Z,
// shape y → world Y, extrusion → world X, with no reflection.
function extrudeAlongX(shape, len, material, bevel = 0.012) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: len,
    bevelEnabled: bevel > 0,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelSegments: 1,
    curveSegments: 10,
  });
  geo.translate(0, 0, -len / 2);
  geo.rotateY(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// Open-ended tube along the motor axis (FrontSide culls the far wall, so it
// reads solid from outside and never shows a concave metal interior).
function tubeShell(radius, len, material, segs = 64) {
  const geo = new THREE.CylinderGeometry(radius, radius, len, segs, 1, true);
  geo.rotateZ(-Math.PI / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// The 3-pole lamination: narrow stems flaring into wide arc shoes, with the
// classic undercut slot between them. Built counter-clockwise in φ.
function armatureShape() {
  const stemHub = (Math.asin(STEM_W / HUB_R) * 180) / Math.PI; // 34.5°
  const stemOut = (Math.asin(STEM_W / SHOE_IN_R) * 180) / Math.PI; // 17.0°
  const pts = [];
  const push = (r, deg) => {
    const a = (deg * Math.PI) / 180;
    pts.push([Math.cos(a) * r, Math.sin(a) * r]);
  };
  for (let k = 0; k < 3; k++) {
    const c = k * 120;
    // hub arc bridging the previous tooth to this one
    const from = c - 120 + stemHub;
    const to = c - stemHub;
    for (let i = 1; i <= 6; i++) push(HUB_R, from + ((to - from) * i) / 6);
    push(SHOE_IN_R, c - stemOut); // up the stem flank
    push(TIP_R, c - SHOE_HALF); // out under the shoe
    for (let i = 1; i <= 14; i++) push(TIP_R, c - SHOE_HALF + (2 * SHOE_HALF * i) / 14);
    push(SHOE_IN_R, c + stemOut);
    push(HUB_R, c + stemHub);
  }
  const s = new THREE.Shape();
  pts.forEach(([x, y], i) => (i === 0 ? s.moveTo(x, y) : s.lineTo(x, y)));
  s.closePath();
  const bore = new THREE.Path();
  bore.absarc(0, 0, SHAFT_R + 0.005, 0, Math.PI * 2, true);
  s.holes.push(bore);
  return s;
}

// One turn of winding round the tooth at φ: axial runs down both slots,
// rounded end-turns bulging past the core.
function coilLoopPoints(phiDeg, rr, d) {
  const a = (phiDeg * Math.PI) / 180;
  const rHat = new THREE.Vector3(0, Math.sin(a), Math.cos(a));
  const tHat = new THREE.Vector3(0, -Math.cos(a), Math.sin(a));
  const half = CORE_L / 2;
  const P = (x, t) => {
    const v = rHat.clone().multiplyScalar(rr).addScaledVector(tHat, t);
    return [x, v.y, v.z];
  };
  return [
    P(-half, -d),
    P(-half - END_TURN, -d * 0.55),
    P(-half - END_TURN, d * 0.55),
    P(-half, d),
    P(half, d),
    P(half + END_TURN, d * 0.55),
    P(half + END_TURN, -d * 0.55),
    P(half, -d),
  ];
}

// Glowing beads chasing along a lead wire. One scalar phase; a whole lap
// returns every bead to its start, so the loop wrap is invisible.
function flowDots(curve, count, color, size) {
  const geo = new THREE.SphereGeometry(size, 10, 8);
  const group = new THREE.Group();
  const dots = [];
  for (let i = 0; i < count; i++) {
    const mat = materials.glow(color, 1.3);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false; // never punch holes in the wire behind
    const dot = new THREE.Mesh(geo, mat);
    group.add(dot);
    dots.push(dot);
  }
  return {
    group,
    set(phase, strength) {
      dots.forEach((dot, i) => {
        const t = (((phase + i / count) % 1) + 1) % 1;
        dot.position.copy(curve.getPointAt(t));
        // fade at both tips so beads arrive and leave instead of popping
        dot.material.opacity = strength * 0.75 * Math.min(1, Math.sin(Math.PI * t) * 2.4);
      });
    },
  };
}

// Force arrow: shaft + head, centred on its anchor and pointing along +Y
// before orienting. A bare cone at this scale reads as a speck — the whole
// point of the force step is that you can SEE which tooth is being shoved.
function forceArrow(color) {
  const g = new THREE.Group();
  const mat = materials.glow(color, 1.6);
  mat.transparent = true;
  mat.opacity = 0;
  mat.depthWrite = false;
  const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.019, 0.019, 0.19, 10), mat);
  shaft.position.y = -0.055;
  const head = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.11, 14), mat);
  head.position.y = 0.095;
  g.add(shaft, head);
  g.userData.mat = mat;
  return g;
}

function orientAlong(mesh, dir) {
  mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
}

export function buildMotor({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  group.add(studioPlinth({ w: 3.3, h: PLINTH_H, d: 1.6 }));

  // --- materials ------------------------------------------------------------
  // Map-free throughout: extruded shapes carry ad-hoc UVs, and on a plain
  // cylinder the brushed normal map wraps circumferentially and reads as a
  // coiled spring rather than a deep-drawn steel can.
  const steelPlain = new THREE.MeshPhysicalMaterial({
    color: 0xa9b0b9,
    metalness: 1,
    roughness: 0.38,
  });
  // Roughness, not envMapIntensity, is the knob for a direct-light glare
  // streak — 0.28 blew the shaft out past the clipping gate in the macro step.
  const shaftMat = new THREE.MeshPhysicalMaterial({
    color: 0xb4bbc3,
    metalness: 1,
    roughness: 0.4,
  });
  const capMat = materials.polymer(0x1e2126);
  const lamMat = new THREE.MeshPhysicalMaterial({
    color: 0x6d737b,
    metalness: 0.92,
    roughness: 0.56,
  });
  const carbonMat = new THREE.MeshPhysicalMaterial({
    color: 0x141416,
    metalness: 0.06,
    roughness: 0.95,
  });
  const brassMat = new THREE.MeshPhysicalMaterial({
    color: 0xb08d4a,
    metalness: 1,
    roughness: 0.32,
  });
  const insulMat = new THREE.MeshPhysicalMaterial({
    color: 0x141518,
    metalness: 0,
    roughness: 0.78,
  });
  const mountMat = materials.paintedMetal(0x33373d);
  mountMat.clearcoat = 0.35;
  mountMat.clearcoatRoughness = 0.42;
  mountMat.roughness = 0.55;
  const wireMat = (color) =>
    new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: 0.62, clearcoat: 0.2 });
  const copperMat = (color = 0xc07a3f) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.85,
      roughness: 0.32,
      clearcoat: 0.4,
      clearcoatRoughness: 0.24,
      emissive: new THREE.Color(WARM),
      emissiveIntensity: 0,
    });
  // Ferrite magnets are charcoal in life; a restrained brick/slate tint is the
  // one diagram liberty taken here, so N and S read at a glance.
  const magnetMat = (color) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.06,
      roughness: 0.82,
      emissive: new THREE.Color(color),
      emissiveIntensity: 0,
    });

  // --- bench cradle ---------------------------------------------------------
  // Two V-blocks the can drops into: a rectangle with the can's own circle
  // bitten out of the top, so the metal actually meets the metal.
  const saddle = () => {
    const halfW = 0.42;
    const cy = AXIS_Y - PLINTH_H;
    const cr = CAN_R + 0.015;
    const top = cy - Math.sqrt(cr * cr - halfW * halfW); // corner meets the arc
    const s = new THREE.Shape();
    s.moveTo(-halfW, 0);
    s.lineTo(halfW, 0);
    s.lineTo(halfW, top);
    const a0 = Math.atan2(top - cy, halfW);
    const a1 = -Math.PI - a0; // the SHORT way, under the circle
    for (let i = 1; i <= 20; i++) {
      const a = a0 + ((a1 - a0) * i) / 20;
      s.lineTo(Math.cos(a) * cr, cy + Math.sin(a) * cr);
    }
    s.lineTo(-halfW, top);
    s.closePath();
    return s;
  };
  for (const sx of [-0.44, 0.44]) {
    const block = extrudeAlongX(saddle(), 0.26, mountMat, 0.018);
    block.position.set(sx, PLINTH_H, 0);
    block.receiveShadow = true;
    group.add(block);
  }

  // rig holds everything on the motor centreline
  const rig = new THREE.Group();
  rig.position.y = AXIS_Y;
  group.add(rig);

  // =========================================================================
  // STATOR — steel can (the magnetic yoke), front face plate with a real
  // shaft hole, bearing turret, rear polymer cap, two arc magnets.
  // =========================================================================
  // Everything that comes off in one piece when you open the motor. Metal
  // can't be ghosted convincingly, so this group is hidden outright on reveal.
  const canGroup = new THREE.Group();
  rig.add(canGroup);

  const canTube = tubeShell(CAN_R, CAN_X1 - CAN_X0, steelPlain);
  canTube.position.x = (CAN_X0 + CAN_X1) / 2;
  canGroup.add(canTube);

  // crimp rings — the rolled beads every deep-drawn can carries
  const beadGeo = new THREE.TorusGeometry(CAN_R - 0.004, 0.014, 8, 64);
  for (const cx of [CAN_X0 + 0.09, CAN_X1 - 0.14]) {
    const bead = new THREE.Mesh(beadGeo, steelPlain);
    bead.rotation.y = Math.PI / 2; // torus axis Z → X
    bead.position.x = cx;
    canGroup.add(bead);
  }

  const canFace = extrudeAlongX(ringShape(0.09, CAN_R), 0.045, steelPlain, 0.01);
  canFace.position.x = FACE_X;
  canGroup.add(canFace);

  const canBoss = extrudeAlongX(ringShape(0.062, 0.155), 0.13, steelPlain, 0.022);
  canBoss.position.x = BOSS_X;
  canGroup.add(canBoss);

  // The cap's barrel comes off with the can — left on, it looms over the
  // commutator in every macro shot. Its back plate stays as the bulkhead the
  // brushes and terminals are mounted to.
  const capTube = tubeShell(CAP_R, CAP_X1 - CAP_X0, capMat);
  capTube.position.x = (CAP_X0 + CAP_X1) / 2;
  canGroup.add(capTube);
  const capBack = extrudeAlongX(discShape(CAP_R), 0.05, capMat, 0.022);
  capBack.position.x = CAP_X1 - 0.03;
  canGroup.add(capBack);

  // moulded detail so the cap reads as a made part, not a black drum: a
  // raised terminal boss, a shallow rib, and the pair of cooling vents
  const capBoss = beveledBox(0.06, 0.34, 0.62, capMat, 0.03);
  capBoss.position.x = CAP_X1 + 0.005;
  canGroup.add(capBoss);
  const capRib = new THREE.Mesh(new THREE.TorusGeometry(CAP_R - 0.006, 0.016, 8, 64), capMat);
  capRib.rotation.y = Math.PI / 2;
  capRib.position.x = CAP_X0 + 0.07;
  canGroup.add(capRib);
  const ventGeo = new THREE.CylinderGeometry(0.075, 0.075, 0.02, 20).rotateZ(-Math.PI / 2);
  for (const vy of [0.34, -0.34]) {
    const vent = new THREE.Mesh(ventGeo, insulMat);
    vent.position.set(CAP_X1 + 0.022, vy, 0);
    canGroup.add(vent);
  }

  // No brush endplate: any disc back here reads as a looming lid in the
  // commutator macro. The brush arms run straight back to the terminals —
  // which is the actual electrical path anyway — through a moulded bushing.
  for (const bz of [0.28, -0.28]) {
    const bushing = beveledBox(0.1, 0.17, 0.15, capMat, 0.02);
    bushing.position.set(0.93, 0, bz);
    rig.add(bushing);
  }

  const magN = extrudeAlongX(sectorShape(MAG_IR, MAG_OR, 90, MAG_SPAN), MAG_LEN, magnetMat(0x5a3833));
  const magS = extrudeAlongX(sectorShape(MAG_IR, MAG_OR, 270, MAG_SPAN), MAG_LEN, magnetMat(0x314257));
  magN.position.x = -0.01;
  magS.position.x = -0.01;
  rig.add(magN, magS);

  // terminal posts: rooted in the brush plate, out through the cap's back
  for (const tz of [0.28, -0.28]) {
    const tab = beveledBox(0.31, 0.09, 0.045, brassMat, 0.012);
    tab.position.set(0.93, 0, tz);
    rig.add(tab);
  }

  // =========================================================================
  // BRUSHES — two carbon blocks on the neutral axis (±Z, 90° from the field),
  // sprung off the cap rim, pressing on the commutator's outer face.
  // =========================================================================
  const brushes = [];
  for (const sgn of [1, -1]) {
    const block = beveledBox(0.17, 0.13, 0.17, carbonMat.clone(), 0.012);
    block.position.set(BRUSH_X, 0, sgn * (COM_OR + 0.085));
    rig.add(block);
    brushes.push(block);
    const strap = tubeAlong(
      [
        [0.93, 0.02, sgn * 0.28],
        [0.8, 0.02, sgn * 0.33],
        [0.68, 0.01, sgn * 0.35],
        [BRUSH_X, 0, sgn * 0.34],
      ],
      0.016,
      brassMat,
      { tubularSegments: 24 },
    );
    rig.add(strap);
  }

  // =========================================================================
  // ROTOR — shaft, laminated 3-pole core, three windings, commutator, risers.
  // Everything here turns as one; nothing else does.
  // =========================================================================
  const rotor = new THREE.Group();
  rig.add(rotor);

  const shaft = new THREE.Mesh(
    new THREE.CylinderGeometry(SHAFT_R, SHAFT_R, SHAFT_X1 - SHAFT_X0, 24).rotateZ(-Math.PI / 2),
    shaftMat,
  );
  shaft.castShadow = true;
  shaft.position.x = (SHAFT_X0 + SHAFT_X1) / 2;
  rotor.add(shaft);
  const shaftTip = new THREE.Mesh(new THREE.SphereGeometry(SHAFT_R, 20, 12), shaftMat);
  shaftTip.position.x = SHAFT_X0;
  rotor.add(shaftTip);

  const lamGeoSource = armatureShape();
  const lamSlice = (CORE_L - 0.024) / LAM_N;
  for (let i = 0; i < LAM_N; i++) {
    const slice = extrudeAlongX(lamGeoSource, lamSlice, lamMat, 0.004);
    slice.position.x = -CORE_L / 2 + lamSlice / 2 + i * (lamSlice + 0.004);
    rotor.add(slice);
  }

  const coilMats = [];
  for (let k = 0; k < 3; k++) {
    const phi = POLE_PHI0 + k * 120;
    const mat = copperMat();
    coilMats.push(mat);
    // one call = one complete turn: down the slot at -d, back up at +d
    for (const rr of COIL_ROWS) {
      for (const d of COIL_COLS) {
        const loop = tubeAlong(coilLoopPoints(phi, rr, d), COIL_WIRE_R, mat, {
          tubularSegments: 72,
          radialSegments: 8,
          closed: true,
          tension: 0.5,
        });
        rotor.add(loop);
      }
    }
  }

  const comHub = new THREE.Mesh(
    new THREE.CylinderGeometry(COM_IR - 0.003, COM_IR - 0.003, COM_X1 - COM_X0 + 0.04, 32).rotateZ(
      -Math.PI / 2,
    ),
    insulMat,
  );
  comHub.position.x = (COM_X0 + COM_X1) / 2;
  rotor.add(comHub);

  const segMats = [];
  for (let k = 0; k < 3; k++) {
    const phi = POLE_PHI0 + k * 120;
    const mat = copperMat(0xd08a45);
    // Brush-polished copper wants to be glossy, but at 0.2 roughness + 0.4
    // clearcoat the specular highlight swamped the emissive and the
    // polarity tint never reached the rendered pixel — sampled grey at the
    // segments' own projected coordinates. Specular is the thing to back
    // off here, not the tint.
    mat.roughness = 0.46;
    mat.clearcoat = 0.1;
    segMats.push(mat);
    const seg = extrudeAlongX(
      sectorShape(COM_IR, COM_OR, phi, COM_SPAN, 22),
      COM_X1 - COM_X0,
      mat,
      0.006,
    );
    seg.position.x = (COM_X0 + COM_X1) / 2;
    rotor.add(seg);

    // riser: the short copper hop from segment to winding
    const a = (phi * Math.PI) / 180;
    const rHat = new THREE.Vector3(0, Math.sin(a), Math.cos(a));
    // kept forward of BRUSH_X — at the commutator's mid-span the risers ran
    // straight through the brush blocks
    const riser = tubeAlong(
      [
        [COM_X0 + 0.005, rHat.y * 0.2, rHat.z * 0.2],
        [COM_X0 - 0.025, rHat.y * 0.225, rHat.z * 0.225],
        [CORE_L / 2 + END_TURN * 0.75, rHat.y * 0.25, rHat.z * 0.25],
      ],
      0.016,
      mat,
      { tubularSegments: 20 },
    );
    rotor.add(riser);
  }

  // Force arrows ride the air gap at each pole tip, always tangential, and
  // peak at ±Z — in the magnet GAPS, which looks backwards until you place
  // the wire. A coil wound on this tooth runs its conductors down the two
  // slots FLANKING it, ~60° either side. So a tooth at ±Z has its wire at
  // ±60°, i.e. squarely under the two pole faces where the field is
  // strongest — maximum force. A tooth pointing AT a pole has both its
  // conductors under that same pole, pushing against each other, and nets
  // zero. Hence torque ∝ |cos φ| below, and hence a bright arrow always
  // lands in an open gap rather than buried in a magnet.
  const forceArrows = [];
  for (let k = 0; k < 3; k++) {
    const a = ((POLE_PHI0 + k * 120) * Math.PI) / 180;
    const ar = forceArrow(0xffa03c);
    ar.position.set(0.02, Math.sin(a) * FORCE_R, Math.cos(a) * FORCE_R);
    orientAlong(ar, new THREE.Vector3(0, -Math.cos(a), Math.sin(a)));
    rotor.add(ar);
    forceArrows.push(ar);
  }

  // =========================================================================
  // FIELD — four lines spanning the gap from the N face to the S face. Each
  // is clipped to the real gap width at its own Z, so they start and end on
  // the magnets instead of floating inside them.
  // =========================================================================
  const fieldMat = new THREE.MeshBasicMaterial({
    color: FIELD_BLUE,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const fieldGroup = new THREE.Group();
  rig.add(fieldGroup);
  for (const fz of [-0.31, -0.13, 0.13, 0.31]) {
    const yTop = Math.sqrt(MAG_IR * MAG_IR - fz * fz);
    const line = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, yTop * 2, 8), fieldMat);
    line.position.set(0, 0, fz);
    fieldGroup.add(line);
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.038, 0.09, 12), fieldMat);
    head.rotation.z = Math.PI; // point down, N → S
    head.position.set(0, -yTop + 0.05, fz);
    fieldGroup.add(head);
  }

  // =========================================================================
  // SUPPLY — two leads from posts on the plinth to the terminal tabs, with
  // current beads chasing along them.
  // =========================================================================
  const flows = [];
  for (const [sgn, color, beadColor] of [
    [1, 0xa8362f, WARM],
    [-1, 0x1c1e22, COOL],
  ]) {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.055, 0.15, 20), brassMat);
    post.castShadow = true;
    post.position.set(1.36, PLINTH_H + 0.075, sgn * 0.42);
    group.add(post);
    const lead = tubeAlong(
      [
        [1.36, PLINTH_H + 0.13, sgn * 0.42],
        [1.4, 0.6, sgn * 0.4],
        [1.32, 0.87, sgn * 0.34],
        [1.1, AXIS_Y, sgn * 0.28],
      ],
      0.02,
      wireMat(color),
      { tubularSegments: 40 },
    );
    group.add(lead);
    const flow = flowDots(lead.userData.curve, 6, beadColor, 0.019);
    group.add(flow.group);
    flows.push(flow);
  }

  // =========================================================================
  // labels
  // =========================================================================
  const labels = calloutSets(['exterior', 'inside', 'armature', 'commutator', 'force']);

  labels.add('exterior', rig, 'Steel can', [0.05, CAN_R, 0.05], 80, 62);
  labels.add('exterior', rig, 'Output shaft', [-1.05, -0.05, 0.06], -15, 76);
  labels.add('exterior', rig, 'Rear cap', [0.8, 0.34, 0.5], 55, 62);
  labels.add('exterior', rig, 'Power terminals', [1.06, -0.02, 0.28], -28, 76);

  labels.add('inside', rig, 'North pole magnet', [0.0, 0.5, 0.2], 76, 68);
  labels.add('inside', rig, 'South pole magnet', [0.06, -0.5, 0.2], -68, 74);
  labels.add('inside', rig, 'Armature', [-0.16, 0.02, 0.36], 26, 92);
  // on TOP of the drum — at φ=0 the anchor sits under brush A
  labels.add('inside', rig, 'Commutator', [0.55, 0.19, 0.02], 34, 84);

  labels.add('armature', rotor, 'Copper winding', [-0.47, 0.12, 0.2], 36, 88);
  labels.add('armature', rotor, 'Laminated iron core', [0.2, 0.16, 0.355], 62, 74);
  labels.add('armature', rig, 'Air gap', [-0.26, 0.42, 0.02], 84, 60);

  // Two labels, not three — at this macro scale a third stacked on the same
  // small assembly reads as clutter. The risers stay visible without a tag.
  labels.add('commutator', rotor, 'Three copper segments', [0.6, 0.18, 0.06], 76, 76);
  labels.add('commutator', rig, 'Carbon brush', [BRUSH_X, 0.02, 0.32], 6, 88);

  labels.add('force', rig, 'Magnetic field, N to S', [0.0, 0.24, 0.31], 32, 92);
  labels.add('force', rig, 'Push on the tooth', [0.02, -0.04, 0.43], 8, 86);

  // =========================================================================
  // pose / state — one object, one apply(), every part derived from it
  // =========================================================================
  const state = {
    spin: 0, // rotor angle, radians about +X
    reveal: 0, // 0 sealed can · 1 opened up
    power: 0, // 0..1 master "electricity on"
    flow: 0, // 0..1 bead phase along the leads
    fieldViz: 0,
    forceViz: 0,
  };

  // A segment sits under the +Z brush for 60° either side of it, under the
  // -Z brush for the opposite 60°, and touches neither in the two windows
  // where its tooth is lined up with a magnet — which is exactly where its
  // torque would have died anyway. Returns +1 / 0 / -1, smoothed at the
  // handovers so the switch reads as a flick rather than a strobe.
  function polarity(phiDeg) {
    const d = Math.abs(wrapDeg(phiDeg));
    return 1 - smooth((d - 50) / 20) - smooth((d - 110) / 20);
  }

  const warmCol = new THREE.Color(WARM);
  const coolCol = new THREE.Color(COOL);
  const scratchCol = new THREE.Color();

  function apply() {
    rotor.rotation.x = state.spin;

    // metal shells can't be ghosted convincingly — they come off outright
    canGroup.visible = state.reveal < 0.5;

    const spinDeg = (state.spin * 180) / Math.PI;
    for (let k = 0; k < 3; k++) {
      const phi = POLE_PHI0 + k * 120 - spinDeg;
      const pol = polarity(phi);
      const mag = Math.abs(pol);
      scratchCol.copy(pol >= 0 ? warmCol : coolCol);

      coilMats[k].emissive.copy(scratchCol);
      coilMats[k].emissiveIntensity = state.power * mag * 0.85;
      segMats[k].emissive.copy(scratchCol);
      segMats[k].emissiveIntensity = state.power * mag * 1.25;

      // torque ∝ |cos φ| — biggest with the tooth broadside (its conductors
      // then sit under both pole faces), zero when the tooth lines up with a
      // pole. Which is exactly why the commutator flips a winding at
      // alignment: that is the moment its torque has died anyway.
      const torque = mag * Math.abs(Math.cos((phi * Math.PI) / 180));
      forceArrows[k].userData.mat.opacity = state.forceViz * state.power * torque;
    }

    // Carbon reads as carbon. Any emissive at all turned these blocks brown;
    // the polarity story is carried by the segments and the windings.

    fieldMat.opacity = state.fieldViz * 0.6;
    magN.material.emissiveIntensity = state.fieldViz * 0.12;
    magS.material.emissiveIntensity = state.fieldViz * 0.12;

    flows[0].set(state.flow, state.power);
    flows[1].set(1 - state.flow, state.power);
  }
  apply();

  return {
    group,
    state,
    parts: { rotor, canGroup, magN, magS, brushes, forceArrows },
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
  };
}
