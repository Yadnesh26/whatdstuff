import * as THREE from 'three';
import { materials, box, label, studioPlinth } from '../../framework/parts.js';
import { beveledBox, chainPath } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01 } from '../../framework/motion.js';

// Logic gates, staged as a product shot. Step 1 is a sealed 74HC00 DIP-14
// (four CMOS NAND gates) on a small PCB; every later step swaps the chip for a
// standing schematic board where each transistor is a real, readable part:
// a body, a glowing channel, and a gate plate that slides toward the channel
// when the gate voltage closes the switch (the field effect — the plate never
// touches the channel, and neither does the wire).
//
// Reference facts:
//  - A CMOS gate = a pull-up network of P-type MOSFETs to VDD plus a mirror-image
//    pull-down network of N-type MOSFETs to GND, driven by the same inputs.
//    NMOS conducts when its gate is HIGH; PMOS conducts when its gate is LOW.
//  - NAND: two PMOS in PARALLEL (either input low pulls the output up), two NMOS
//    in SERIES (both inputs high pulls it down). Output = NOT (A AND B).
//  - Series switches = AND, parallel switches = OR.
//  - In steady state exactly one network conducts, so no current flows from VDD
//    to GND; charge moves only while the output is switching (dynamic power).
//    The charge dots below therefore appear ONLY during output transitions.
//  - 74HC00 pinout: 1A=1, 1B=2, 1Y=3, GND=7, VCC=14; notch at the pin-1 end.
//  - NAND is universal: NAND(A,A)=NOT A; NOT(NAND(A,B))=AND(A,B).
//
// Scalars: A, B in 0..1 (smoothed by the step timelines), flow = charge-dot
// phase (whole laps per loop). Everything in the scene derives from these.

const HOT = new THREE.Color(0xffb347); // logic HIGH
const COLD = new THREE.Color(0x33475c); // logic LOW
const TEAL = new THREE.Color(0x4fe3c1);
const N_BLUE = 0x3d6bff;
const P_PINK = 0xff6f91;
const FET_H = 0.28; // terminal reach from a transistor's centre
const GATE_X = 0.37; // where a gate lead's wire ends, from a transistor's centre
const DOT_Z = 0.13;

const std = (color, o = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.2, ...o });

// --- wire: cylinders + round joints, one material, colour = logic level ----
function makeWire(pts, r = 0.022) {
  const mat = std(COLD, { roughness: 0.45, metalness: 0.5 });
  const g = new THREE.Group();
  const v = pts.map((p) => new THREE.Vector3(p[0], p[1], p[2] ?? 0));
  const up = new THREE.Vector3(0, 1, 0);
  const jointGeo = new THREE.SphereGeometry(r, 10, 8);
  for (let i = 0; i < v.length; i++) {
    const j = new THREE.Mesh(jointGeo, mat);
    j.position.copy(v[i]);
    g.add(j);
    if (i === 0) continue;
    const a = v[i - 1];
    const b = v[i];
    const dir = b.clone().sub(a);
    const len = dir.length();
    const cyl = new THREE.Mesh(new THREE.CylinderGeometry(r, r, len, 10), mat);
    cyl.position.copy(a).add(b).multiplyScalar(0.5);
    cyl.quaternion.setFromUnitVectors(up, dir.normalize());
    g.add(cyl);
  }
  return {
    group: g,
    set(l) {
      mat.color.copy(COLD).lerp(HOT, l);
      mat.emissive.copy(HOT).multiplyScalar(0.55 * l);
    },
  };
}

// --- transistor: body + glowing channel + sliding gate plate ---------------
function makeFet(type, side) {
  const g = new THREE.Group();
  const isN = type === 'n';
  const body = beveledBox(0.36, 0.42, 0.14, materials.polymer(0x1a1d22), 0.025);
  const strip = box(0.366, 0.045, 0.146, std(isN ? N_BLUE : P_PINK, { roughness: 0.45 }));
  strip.position.y = 0.19;
  g.add(body, strip);

  const metal = materials.brushedSteel(0xb9c0c8);
  for (const s of [1, -1]) {
    const t = box(0.07, 0.08, 0.07, metal);
    t.position.y = s * (FET_H - 0.035);
    g.add(t);
  }

  const chMat = std(0x10171c, { emissive: TEAL, emissiveIntensity: 0.05, roughness: 0.3 });
  const ch = box(0.07, 0.32, 0.03, chMat);
  ch.position.z = 0.085;
  g.add(ch);

  const plateMat = std(0xaab2bb, { metalness: 0.9, roughness: 0.3, emissive: HOT, emissiveIntensity: 0 });
  const plate = box(0.03, 0.32, 0.1, plateMat);
  g.add(plate);

  const stubMat = std(0x8a929b, { metalness: 0.9, roughness: 0.4 });
  const stub = box(1, 0.03, 0.03, stubMat);
  g.add(stub);

  let stubEnd = GATE_X;
  if (!isN) {
    // the inversion bubble: this switch closes when its gate is LOW
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.035, 0.011, 8, 20), stubMat);
    ring.position.set(side * 0.335, 0, 0);
    g.add(ring);
    stubEnd = 0.3;
  }

  function setGate(v) {
    const on = isN ? v : 1 - v;
    chMat.emissiveIntensity = 0.05 + on * 1.7;
    chMat.color.setHex(0x10171c).lerp(TEAL, on * 0.45);
    plateMat.emissiveIntensity = v * 0.9;
    const px = side * (0.265 - on * 0.05);
    plate.position.x = px;
    const back = px + side * 0.015;
    const len = Math.abs(stubEnd - Math.abs(back));
    stub.scale.x = Math.max(0.001, len);
    stub.position.x = side * ((Math.abs(back) + stubEnd) / 2);
  }
  setGate(0);
  return { group: g, setGate, channel: ch, plate };
}

// --- input toggle ------------------------------------------------------------
function makeToggle() {
  const g = new THREE.Group();
  const base = beveledBox(0.32, 0.12, 0.22, materials.paintedMetal(0x2b2f36), 0.03);
  g.add(base);
  const pivot = new THREE.Group();
  pivot.position.y = 0.06;
  g.add(pivot);
  const lever = box(0.045, 0.26, 0.045, materials.chrome());
  lever.position.y = 0.13;
  const tipMat = std(0x555b63, { emissive: HOT, emissiveIntensity: 0, roughness: 0.3 });
  const tip = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), tipMat);
  tip.position.y = 0.27;
  pivot.add(lever, tip);
  return {
    group: g,
    set(v) {
      pivot.rotation.z = THREE.MathUtils.lerp(0.5, -0.5, v);
      tipMat.emissiveIntensity = v * 1.3;
      tipMat.color.setHex(0x555b63).lerp(HOT, v);
    },
    tip,
  };
}

// --- lamp (the output you can see) -----------------------------------------
function makeLamp({ ground = false } = {}) {
  const g = new THREE.Group();
  const bulbMat = std(0x2a2620, { emissive: HOT, emissiveIntensity: 0, roughness: 0.25 });
  const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.15, 24, 16), bulbMat);
  const haloMat = new THREE.MeshBasicMaterial({
    color: HOT,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const halo = new THREE.Mesh(new THREE.SphereGeometry(0.27, 20, 14), haloMat);
  g.add(bulb, halo);
  const cap = new THREE.Mesh(
    new THREE.CylinderGeometry(0.09, 0.09, 0.06, 16),
    materials.brushedSteel(0xb9c0c8),
  );
  cap.position.y = -0.17;
  g.add(cap);
  if (ground) {
    const stub = new THREE.Mesh(
      new THREE.CylinderGeometry(0.02, 0.02, 0.32, 8),
      std(0x8a929b, { metalness: 0.8 }),
    );
    stub.position.y = -0.36;
    g.add(stub);
    [0.18, 0.12, 0.06].forEach((w, i) => {
      const bar = box(w * 2, 0.02, 0.04, std(0x8a929b, { metalness: 0.8 }));
      bar.position.y = -0.53 - i * 0.05;
      g.add(bar);
    });
  }
  return {
    group: g,
    set(l) {
      bulbMat.emissiveIntensity = l * 1.6;
      bulbMat.color.setHex(0x2a2620).lerp(new THREE.Color(0xffe2a8), l);
      haloMat.opacity = l * 0.2;
    },
  };
}

// --- power rail bar ----------------------------------------------------------
function makeRail(x0, x1, y, color, emissive = 0) {
  const r = beveledBox(
    x1 - x0,
    0.09,
    0.1,
    std(color, { metalness: 0.9, roughness: 0.35, emissive: color, emissiveIntensity: emissive }),
    0.03,
  );
  r.position.set((x0 + x1) / 2, y, 0);
  return r;
}

// --- canvas textures ----------------------------------------------------------
function gridTexture() {
  const c = document.createElement('canvas');
  c.width = c.height = 256;
  const x = c.getContext('2d');
  x.fillStyle = '#12161c';
  x.fillRect(0, 0, 256, 256);
  x.strokeStyle = 'rgba(120,160,190,0.10)';
  x.lineWidth = 1;
  for (let i = 0; i <= 256; i += 32) {
    x.beginPath();
    x.moveTo(i, 0);
    x.lineTo(i, 256);
    x.moveTo(0, i);
    x.lineTo(256, i);
    x.stroke();
  }
  const t = new THREE.CanvasTexture(c);
  t.wrapS = t.wrapT = THREE.RepeatWrapping;
  t.repeat.set(8, 8);
  t.colorSpace = THREE.SRGBColorSpace;
  return t;
}

function chipMarkingTexture() {
  const c = document.createElement('canvas');
  c.width = 1024;
  c.height = 340;
  const x = c.getContext('2d');
  x.clearRect(0, 0, 1024, 340);
  // pin-1 end notch (left) and the dimple beside it
  x.fillStyle = 'rgba(0,0,0,0.55)';
  x.beginPath();
  x.arc(0, 170, 62, -Math.PI / 2, Math.PI / 2);
  x.fill();
  x.fillStyle = 'rgba(0,0,0,0.5)';
  x.beginPath();
  x.arc(96, 276, 16, 0, Math.PI * 2);
  x.fill();
  x.fillStyle = '#d9dde2';
  x.textBaseline = 'middle';
  x.font = '700 120px "Segoe UI", sans-serif';
  x.fillText('74HC00', 250, 138);
  x.font = '600 40px "Segoe UI", sans-serif';
  x.fillStyle = '#aeb5bd';
  x.fillText('QUAD 2-INPUT NAND GATE', 254, 232);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function makeTruthTable() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 512;
  const x = c.getContext('2d');
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  let lastRow = -2;
  function draw(row) {
    if (row === lastRow) return;
    lastRow = row;
    x.fillStyle = '#10141a';
    x.fillRect(0, 0, 512, 512);
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillStyle = '#4fe3c1';
    x.font = '700 58px "Segoe UI", sans-serif';
    x.fillText('NAND', 256, 52);
    const cols = [110, 256, 402];
    x.fillStyle = '#8b97a3';
    x.font = '600 44px "Segoe UI", sans-serif';
    ['A', 'B', 'OUT'].forEach((h, i) => x.fillText(h, cols[i], 130));
    x.fillStyle = '#2a333d';
    x.fillRect(40, 160, 432, 3);
    for (let r = 0; r < 4; r++) {
      const y = 220 + r * 70;
      if (r === row) {
        x.fillStyle = 'rgba(79,227,193,0.22)';
        x.fillRect(30, y - 33, 452, 66);
      }
      const a = r >> 1;
      const b = r & 1;
      const out = a & b ? 0 : 1;
      [a, b, out].forEach((v, i) => {
        x.fillStyle = v ? '#ffb347' : '#5a6b7c';
        x.font = `700 ${r === row ? 54 : 46}px "Segoe UI", sans-serif`;
        x.fillText(String(v), cols[i], y);
      });
    }
    tex.needsUpdate = true;
  }
  return { tex, draw };
}

// D-shaped gate symbol (NAND: flat back, round front, bubble on the output)
function makeNandIcon(labelSize = 0.15) {
  const g = new THREE.Group();
  const s = new THREE.Shape();
  s.moveTo(-0.3, -0.27);
  s.lineTo(0, -0.27);
  s.absarc(0, 0, 0.27, -Math.PI / 2, Math.PI / 2, false);
  s.lineTo(-0.3, 0.27);
  s.closePath();
  const geo = new THREE.ExtrudeGeometry(s, {
    depth: 0.08,
    bevelEnabled: true,
    bevelSize: 0.015,
    bevelThickness: 0.015,
    bevelSegments: 2,
  });
  geo.translate(0, 0, -0.04);
  const m = new THREE.Mesh(geo, materials.paintedMetal(0x2a3a44));
  m.castShadow = true;
  g.add(m);
  const bubble = new THREE.Mesh(
    new THREE.TorusGeometry(0.045, 0.014, 8, 20),
    materials.brushedSteel(0xb9c0c8),
  );
  bubble.position.x = 0.32;
  g.add(bubble);
  const tag = label('NAND', { color: '#cfe9e3', size: labelSize });
  tag.position.set(-0.05, 0, 0.1);
  g.add(tag);
  return g;
}

export function buildLogicGates({ scene }) {
  const root = new THREE.Group();
  scene.add(root);

  const plinth = studioPlinth({ w: 6.3, h: 0.26, d: 2.0 });
  plinth.position.x = 0.85;
  root.add(plinth);

  const S = { A: 0, B: 0, flow: 0 };
  const labels = calloutSets(['chip', 'single', 'series', 'parallel', 'nand', 'sweep', 'universal']);
  const views = {};
  let current = 'chip';
  let tableOn = false;

  // ===========================================================================
  // Board (schematic backdrop, shared by every non-chip view) + truth plaque
  // ===========================================================================
  const boardGroup = new THREE.Group();
  root.add(boardGroup);
  const boardMat = new THREE.MeshStandardMaterial({ map: gridTexture(), roughness: 0.75, metalness: 0.1 });
  const board = beveledBox(3.95, 3.1, 0.06, boardMat, 0.03);
  board.position.set(0.225, 0.26 + 1.55, -0.2);
  board.receiveShadow = true;
  boardGroup.add(board);

  const table = makeTruthTable();
  const plaque = new THREE.Group();
  plaque.position.set(3.0, 1.03, 0.25);
  plaque.rotation.y = -0.22;
  const plaqueBody = beveledBox(1.7, 1.5, 0.06, materials.paintedMetal(0x20242a), 0.03);
  const plaqueFace = new THREE.Mesh(
    new THREE.PlaneGeometry(1.6, 1.4),
    new THREE.MeshBasicMaterial({ map: table.tex, toneMapped: false }),
  );
  plaqueFace.position.z = 0.032;
  plaque.add(plaqueBody, plaqueFace);
  plaque.visible = false;
  root.add(plaque);

  // ---- per-view helpers ----------------------------------------------------
  function makeView(name) {
    const group = new THREE.Group();
    group.visible = false;
    root.add(group);
    views[name] = { group, ups: [] };
    return views[name];
  }
  function W(v, pts, fn, r) {
    const w = makeWire(pts, r);
    v.group.add(w.group);
    v.ups.push((s) => w.set(fn(s)));
    return w;
  }
  // charge packets riding a polyline; fn(S) -> { w: 0..1 weight, rev: bool }
  function Dots(v, pts, fn, n = 7) {
    const path = chainPath(
      pts.slice(1).map((p, i) => [
        [pts[i][0], pts[i][1], DOT_Z],
        [p[0], p[1], DOT_Z],
      ]),
    );
    const geo = new THREE.SphereGeometry(0.03, 10, 8);
    const dots = [];
    for (let i = 0; i < n; i++) {
      const mat = materials.glow(TEAL.getHex(), 1.6);
      mat.transparent = true;
      mat.opacity = 0;
      mat.depthWrite = false;
      const d = new THREE.Mesh(geo, mat);
      v.group.add(d);
      dots.push(d);
    }
    v.ups.push((s) => {
      const { w, rev } = fn(s);
      dots.forEach((d, i) => {
        const f = (i / n + s.flow) % 1;
        const t = rev ? 1 - f : f;
        d.position.copy(path.getPointAt(Math.min(0.9999, t)));
        d.material.opacity = w * Math.pow(Math.sin(Math.PI * f), 0.6);
      });
    });
  }
  function fet(v, type, side, x, y, gateFn) {
    const f = makeFet(type, side);
    f.group.position.set(x, y, 0);
    v.group.add(f.group);
    v.ups.push((s) => f.setGate(gateFn(s)));
    return f;
  }
  function toggle(v, x, y, key) {
    const t = makeToggle();
    t.group.position.set(x, y, 0);
    v.group.add(t.group);
    v.ups.push((s) => t.set(s[key]));
    const tag = label(key, { color: '#cfd6dd', size: 0.18 });
    tag.position.set(x, y - 0.24, 0.12);
    v.group.add(tag);
    return t;
  }
  function lamp(v, x, y, fn, opts) {
    const l = makeLamp(opts);
    l.group.position.set(x, y, 0);
    v.group.add(l.group);
    v.ups.push((s) => l.set(fn(s)));
    return l;
  }
  const A = (s) => s.A;
  const B = (s) => s.B;
  const one = () => 1;
  const zero = () => 0;

  // ===========================================================================
  // VIEW · chip — the sealed 74HC00 on a PCB
  // ===========================================================================
  const chip = makeView('chip');
  const pcb = beveledBox(3.7, 0.06, 1.7, std(0x0f4a36, { roughness: 0.55 }), 0.02);
  pcb.position.y = 0.03;
  pcb.receiveShadow = true;
  chip.group.add(pcb);

  const BODY_Y0 = 0.17;
  const BODY_H = 0.46;
  const body = beveledBox(2.9, BODY_H, 0.96, materials.polymer(0x0c0d10), 0.04);
  body.position.y = BODY_Y0 + BODY_H / 2 + 0.06;
  chip.group.add(body);
  const marking = new THREE.Mesh(
    new THREE.PlaneGeometry(2.9, 0.96),
    new THREE.MeshBasicMaterial({ map: chipMarkingTexture(), transparent: true, depthWrite: false }),
  );
  marking.rotation.x = -Math.PI / 2;
  marking.position.y = BODY_Y0 + BODY_H + 0.06 + 0.003;
  chip.group.add(marking);

  const PITCH = 0.381;
  const pinMats = {};
  const tin = () =>
    new THREE.MeshStandardMaterial({
      color: 0xcfd4da,
      metalness: 0.9,
      roughness: 0.28,
      emissive: 0x000000,
    });
  const pinX = (n) => (n <= 7 ? -1.143 + (n - 1) * PITCH : 1.143 - (n - 8) * PITCH);
  const pinZ = (n) => (n <= 7 ? 1 : -1);
  for (let n = 1; n <= 14; n++) {
    const mat = tin();
    pinMats[n] = mat;
    const z = pinZ(n);
    const shoulderY = BODY_Y0 + 0.14;
    const sh = beveledBox(0.075, 0.04, 0.14, mat, 0.01);
    sh.position.set(pinX(n), shoulderY, z * 0.52);
    const leg = beveledBox(0.075, shoulderY - 0.06, 0.04, mat, 0.01);
    leg.position.set(pinX(n), 0.06 + (shoulderY - 0.06) / 2, z * 0.575);
    const foot = beveledBox(0.075, 0.03, 0.12, mat, 0.008);
    foot.position.set(pinX(n), 0.075, z * 0.63);
    chip.group.add(sh, leg, foot);
  }
  const setPin = (n, l, cold = 0) => {
    pinMats[n].emissive.copy(HOT).multiplyScalar(0.7 * l);
    if (cold) pinMats[n].emissive.copy(new THREE.Color(0x4a8fff)).multiplyScalar(0.55);
  };
  chip.ups.push((s) => {
    const out = 1 - s.A * s.B;
    setPin(14, 1); // VCC
    setPin(7, 0, 1); // GND
    setPin(1, s.A);
    setPin(2, s.B);
    setPin(3, out);
  });

  const cAnchor = (n, y = BODY_Y0 + 0.16) => [pinX(n), y, pinZ(n) * 0.6];
  labels.add('chip', chip.group, 'VCC +5 V', cAnchor(14), 60, 46);
  labels.add('chip', chip.group, 'GND 0 V', cAnchor(7), -60, 44);
  labels.add('chip', chip.group, 'Input A', cAnchor(1), -120, 40);
  labels.add('chip', chip.group, 'Input B', cAnchor(2), -75, 56);
  labels.add('chip', chip.group, 'Output', cAnchor(3), -40, 40);
  labels.add('chip', chip.group, '4 NAND gates', [0.7, BODY_Y0 + BODY_H + 0.06, -0.1], 70, 60);

  // ===========================================================================
  // VIEW · single — one N-type transistor as a switch with a lamp
  // ===========================================================================
  const single = makeView('single');
  single.group.add(makeRail(-0.5, 0.5, 2.85, 0xb87333, 0.25));
  single.group.add(makeRail(-0.5, 0.5, 0.55, 0x5f6b78));
  const sFet = fet(single, 'n', -1, 0, 2.2, A);
  W(single, [[0, 2.85], [0, 2.2 + FET_H]], one);
  W(single, [[0, 2.2 - FET_H], [0, 1.45]], (s) => s.A);
  lamp(single, 0, 1.3, (s) => s.A);
  W(single, [[0, 1.15], [0, 0.55]], (s) => s.A);
  W(single, [[-1.0, 0.68], [-1.0, 2.2], [-GATE_X, 2.2]], (s) => s.A);
  toggle(single, -1.0, 0.5, 'A');
  Dots(single, [[0, 2.85], [0, 0.55]], (s) => ({ w: s.A, rev: false }), 9);
  labels.add('single', sFet.group, 'Gate', [-0.27, 0.1, 0.06], 150, 46);
  labels.add('single', sFet.group, 'Channel', [0, -0.05, 0.1], -30, 60);
  labels.add('single', single.group, 'Lamp', [0.15, 1.3, 0.1], 20, 46);

  // ===========================================================================
  // VIEW · series — two switches in a row = AND
  // ===========================================================================
  const series = makeView('series');
  series.group.add(makeRail(-0.5, 0.5, 2.9, 0xb87333, 0.25));
  series.group.add(makeRail(-0.5, 0.5, 0.55, 0x5f6b78));
  const seA = fet(series, 'n', -1, 0, 2.4, A);
  const seB = fet(series, 'n', 1, 0, 1.8, B);
  W(series, [[0, 2.9], [0, 2.4 + FET_H]], one);
  W(series, [[0, 2.4 - FET_H], [0, 1.8 + FET_H]], (s) => s.A);
  W(series, [[0, 1.8 - FET_H], [0, 1.45]], (s) => s.A * s.B);
  lamp(series, 0, 1.3, (s) => s.A * s.B);
  W(series, [[0, 1.15], [0, 0.55]], (s) => s.A * s.B);
  W(series, [[-1.1, 0.68], [-1.1, 2.4], [-GATE_X, 2.4]], A);
  W(series, [[1.1, 0.68], [1.1, 1.8], [GATE_X, 1.8]], B);
  toggle(series, -1.1, 0.5, 'A');
  toggle(series, 1.1, 0.5, 'B');
  Dots(series, [[0, 2.9], [0, 0.55]], (s) => ({ w: s.A * s.B, rev: false }), 10);
  labels.add('series', seA.group, 'Switch A', [-0.27, 0.1, 0.06], 150, 46);
  labels.add('series', seB.group, 'Switch B', [0.27, 0.1, 0.06], 30, 46);
  labels.add('series', series.group, 'Both: AND', [0.15, 1.3, 0.1], 20, 60);

  // ===========================================================================
  // VIEW · parallel — two switches side by side = OR
  // ===========================================================================
  const par = makeView('parallel');
  par.group.add(makeRail(-0.9, 0.9, 2.9, 0xb87333, 0.25));
  par.group.add(makeRail(-0.5, 0.5, 0.55, 0x5f6b78));
  const paA = fet(par, 'n', -1, -0.55, 2.2, A);
  const paB = fet(par, 'n', 1, 0.55, 2.2, B);
  const orLvl = (s) => 1 - (1 - s.A) * (1 - s.B);
  W(par, [[-0.55, 2.9], [-0.55, 2.2 + FET_H]], one);
  W(par, [[0.55, 2.9], [0.55, 2.2 + FET_H]], one);
  W(par, [[-0.55, 2.2 - FET_H], [-0.55, 1.6], [0, 1.6]], (s) => s.A);
  W(par, [[0.55, 2.2 - FET_H], [0.55, 1.6], [0, 1.6]], (s) => s.B);
  W(par, [[0, 1.6], [0, 1.45]], orLvl);
  lamp(par, 0, 1.3, orLvl);
  W(par, [[0, 1.15], [0, 0.55]], orLvl);
  W(par, [[-1.25, 0.68], [-1.25, 2.2], [-0.55 - GATE_X, 2.2]], A);
  W(par, [[1.25, 0.68], [1.25, 2.2], [0.55 + GATE_X, 2.2]], B);
  toggle(par, -1.25, 0.5, 'A');
  toggle(par, 1.25, 0.5, 'B');
  Dots(par, [[-0.55, 2.9], [-0.55, 1.6], [0, 1.6], [0, 0.55]], (s) => ({ w: s.A, rev: false }), 10);
  Dots(par, [[0.55, 2.9], [0.55, 1.6], [0, 1.6], [0, 0.55]], (s) => ({ w: s.B, rev: false }), 10);
  labels.add('parallel', paA.group, 'Switch A', [-0.27, 0.1, 0.06], 150, 46);
  labels.add('parallel', paB.group, 'Switch B', [0.27, 0.1, 0.06], 30, 46);
  labels.add('parallel', par.group, 'Either: OR', [0.15, 1.3, 0.1], 20, 60);

  // ===========================================================================
  // VIEW · nand — the full CMOS gate
  // ===========================================================================
  const nand = makeView('nand');
  const OUTY = 1.78;
  const VDDY = 2.9;
  const GNDY = 0.5;
  nand.group.add(makeRail(-0.9, 0.9, VDDY, 0xb87333, 0.3));
  nand.group.add(makeRail(-0.3, 0.3, GNDY, 0x5f6b78));
  const pA = fet(nand, 'p', -1, -0.55, 2.35, A);
  const pB = fet(nand, 'p', 1, 0.55, 2.35, B);
  const nA = fet(nand, 'n', -1, 0, 1.45, A);
  const nB = fet(nand, 'n', 1, 0, 0.85, B);
  const outLvl = (s) => 1 - s.A * s.B;
  // pull-up team: VDD -> each PMOS -> OUT
  W(nand, [[-0.55, VDDY], [-0.55, 2.35 + FET_H]], one);
  W(nand, [[0.55, VDDY], [0.55, 2.35 + FET_H]], one);
  W(nand, [[-0.55, 2.35 - FET_H], [-0.55, OUTY], [0, OUTY]], (s) => 1 - s.A);
  W(nand, [[0.55, 2.35 - FET_H], [0.55, OUTY], [0, OUTY]], (s) => 1 - s.B);
  // pull-down team: OUT -> NMOS A -> NMOS B -> GND
  W(nand, [[0, OUTY], [0, 1.45 + FET_H]], outLvl);
  W(nand, [[0, 1.45 - FET_H], [0, 0.85 + FET_H]], (s) => s.A * outLvl(s));
  W(nand, [[0, 0.85 - FET_H], [0, GNDY]], zero);
  // output line to the lamp, in a front lane so it clears the B bus
  W(nand, [[0.55, OUTY], [0.7, OUTY, 0.16], [1.55, OUTY, 0.16]], outLvl);
  const outNode = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 14, 10),
    materials.brushedSteel(0xd8dde3),
  );
  outNode.position.set(0, OUTY, 0);
  nand.group.add(outNode);
  const nLamp = lamp(nand, 1.7, OUTY, outLvl, { ground: true });
  nLamp.group.position.z = 0.16;
  // input buses: A on the left, B on the right
  W(nand, [[-1.15, 0.68], [-1.15, 2.35], [-0.55 - GATE_X, 2.35]], A);
  W(nand, [[-1.15, 1.45], [-GATE_X, 1.45]], A);
  W(nand, [[1.15, 0.68], [1.15, 2.35], [0.55 + GATE_X, 2.35]], B);
  W(nand, [[1.15, 0.85], [GATE_X, 0.85]], B);
  toggle(nand, -1.15, 0.5, 'A');
  toggle(nand, 1.15, 0.5, 'B');

  // Charge moves only while the output is switching: weight peaks mid-flip
  // and is zero once the output sits on a rail (CMOS burns no static current).
  const act = (s) => clamp01(6 * outLvl(s) * (1 - outLvl(s)));
  const rising = (s) => clamp01(0.5 + (1 - 2 * s.A * s.B) * 1.6);
  Dots(nand, [[-0.55, VDDY], [-0.55, OUTY], [0.7, OUTY], [1.55, OUTY]], (s) => ({
    w: act(s) * rising(s) * (1 - s.A),
    rev: false,
  }), 12);
  Dots(nand, [[0.55, VDDY], [0.55, OUTY], [0.7, OUTY], [1.55, OUTY]], (s) => ({
    w: act(s) * rising(s) * (1 - s.B),
    rev: false,
  }), 12);
  Dots(nand, [[1.55, OUTY], [0.7, OUTY], [0, OUTY], [0, GNDY]], (s) => ({
    w: act(s) * (1 - rising(s)),
    rev: false,
  }), 12);

  labels.add('nand', pB.group, 'Pull-up: parallel', [0.27, 0.1, 0.06], 30, 50);
  labels.add('nand', nA.group, 'Pull-down: series', [0.27, 0.05, 0.06], 25, 50);
  labels.add('nand', outNode, 'Output', [0, 0, 0], 75, 40);
  labels.add('nand', nand.group, '+VDD', [0.9, VDDY, 0.05], 30, 36);
  labels.add('nand', nand.group, 'GND', [0.3, GNDY, 0.05], -30, 36);
  labels.add('sweep', outNode, 'Output', [0, 0, 0], 75, 40);

  // ===========================================================================
  // VIEW · universal — NOT and AND built out of NAND alone
  // ===========================================================================
  const uni = makeView('universal');
  const gate = (cx, cy) => {
    const g = makeNandIcon();
    g.position.set(cx, cy, 0);
    uni.group.add(g);
    return g;
  };
  const NOT_Y = 2.5;
  const AND_Y = 1.0;
  gate(0.2, NOT_Y);
  gate(-0.3, AND_Y);
  gate(0.9, AND_Y);
  // A / B live in one place and fan out
  W(uni, [[-1.5, 0.68], [-1.5, 2.62], [-0.15, 2.62]], A);
  W(uni, [[-1.5, 2.38], [-0.15, 2.38]], A);
  W(uni, [[-1.5, 1.12], [-0.65, 1.12]], A);
  W(uni, [[-1.15, 0.68], [-1.15, 0.88], [-0.65, 0.88]], B);
  toggle(uni, -1.5, 0.5, 'A');
  toggle(uni, -1.15, 0.5, 'B');
  W(uni, [[0.6, NOT_Y], [1.75, NOT_Y]], (s) => 1 - s.A);
  lamp(uni, 1.9, NOT_Y, (s) => 1 - s.A, { ground: true });
  W(uni, [[0.1, AND_Y], [0.3, AND_Y], [0.3, 1.12], [0.55, 1.12]], (s) => 1 - s.A * s.B);
  W(uni, [[0.3, AND_Y], [0.3, 0.88], [0.55, 0.88]], (s) => 1 - s.A * s.B);
  W(uni, [[1.3, AND_Y], [1.75, AND_Y]], (s) => s.A * s.B);
  lamp(uni, 1.9, AND_Y, (s) => s.A * s.B, { ground: true });
  labels.add('universal', uni.group, 'NOT: tied inputs', [0.2, NOT_Y + 0.27, 0.05], 60, 46);
  labels.add('universal', uni.group, 'AND: NAND + NOT', [0.9, AND_Y + 0.27, 0.05], 60, 46);

  // ===========================================================================
  // apply + handles
  // ===========================================================================
  function apply() {
    const v = views[current];
    for (const f of v.ups) f(S);
    if (tableOn) {
      const row = (Math.round(S.A) << 1) | Math.round(S.B);
      table.draw(row);
    }
  }
  function setView(name) {
    current = name;
    for (const [k, v] of Object.entries(views)) v.group.visible = k === name;
    boardGroup.visible = name !== 'chip';
    apply();
  }
  setView('chip');

  return {
    group: root,
    setView,
    setLabels(which) {
      labels.setLabels(which || null);
    },
    setTable(on) {
      tableOn = !!on;
      plaque.visible = tableOn;
      if (tableOn) table.draw(-1);
      apply();
    },
    set(partial) {
      Object.assign(S, partial);
      apply();
    },
    parts: { views, S },
  };
}
