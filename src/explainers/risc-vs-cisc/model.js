import * as THREE from 'three';
import { materials, studioPlinth } from '../../framework/parts.js';
import { beveledBox } from '../../framework/geometry.js';
import { clamp01, win } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// RISC vs CISC, staged as two lanes on one plinth. Step 1 is the pair of
// sealed processor packages; every later view is a tabletop diorama where an
// instruction is a physical tile, exactly as many byte-cells wide as its real
// encoding, printed with its true hex bytes in memory order.
//
// Reference facts (every encoding below was assembled by hand and checked):
//  - x86-64 instructions are 1 to 15 bytes long; AArch64 instructions are
//    always 32 bits (4 bytes). The decoder of a variable-length ISA has to read
//    an instruction's opcode/ModRM bytes to learn its length before it knows
//    where the next instruction begins.
//  - The same counting loop, written for both:
//      x86-64 (20 bytes)                 AArch64 (32 bytes)
//      add [x], eax   01 05 FA 0F 00 00  ldr w1, [x0]    B9400001
//      inc ecx        FF C1              add w1, w1, w2  0B020021
//      cmp ecx, 10    83 F9 0A           str w1, [x0]    B9000001
//      jne loop       75 F3              add w3, w3, #1  11000463
//      mov eax, [x]   8B 05 ED 0F 00 00  cmp w3, #10     7100287F
//      ret            C3                 b.ne loop       54FFFF61
//                                        mov w0, w1      2A0103E0
//                                        ret             D65F03C0
//    (x = 0x1000, RIP-relative disp32 from the END of each instruction; ARM
//    words are stored little-endian, so the tiles show their bytes reversed.)
//  - Load/store: AArch64 arithmetic only reads/writes registers; memory is
//    reached only by loads and stores. x86 arithmetic may name a memory
//    operand directly (add [x], eax = read, add, write in one instruction).
//  - Registers: x86-64 has 16 general-purpose registers, AArch64 has 31.
//  - Since the Pentium Pro (1995) x86 cores crack instructions into simple
//    micro-ops; add [mem], reg becomes a load, an add and a store.
//  - Apple's M1 performance core decodes 8 AArch64 instructions per cycle.
//
// ONE scale: 1 byte = B = 0.15 units along X. Every tile, boundary and
// decoder position derives from it. Ribbons flow RIGHT -> LEFT (memory on the
// right, the core on the left) so program order reads left to right.
//
// Scalars: `u` = lap phase of the active view (0..1, every view periodic in
// it), `spin` = turntable angle of the chip pair. Everything derives from these.

const PY = 0.24; // big plinth top
const B = 0.15; // one byte
const GAP = 0.022; // seam between tiles
const SLAB_H = 0.03;
const SLAB_D = 0.72;
const TOP = PY + SLAB_H; // tiles stand here
const TILE_H = 0.07;
const TILE_D = 0.42;
const Z_C = -0.66; // x86 lane (back)
const Z_R = 0.66; // ARM lane (front)
const TZ = -0.06; // tile row sits a little behind the lane centre
const HX0 = -3.4; // housings' outer faces
const HX1 = 3.4;
const WX0 = -2.4; // visible window between the housings = 32 bytes
const WX1 = 2.4;
const X_A = WX0 - 12 * B; // ribbon wrap origin: 12 whole bytes left of the window
const HOUSE_H = 0.42;

const AMBER = 0xffb35c; // x86 / CISC
const CYAN = 0x5ec8ff; // ARM / RISC
const AMBER_CSS = '#ffb35c';
const CYAN_CSS = '#5ec8ff';
const MONO = 'Consolas, "Cascadia Mono", "DejaVu Sans Mono", "Courier New", monospace';

const CISC_PROG = [
  { m: 'add [x], eax', hex: ['01', '05', 'FA', '0F', '00', '00'], read: 2 },
  { m: 'inc ecx', hex: ['FF', 'C1'], read: 2 },
  { m: 'cmp ecx, 10', hex: ['83', 'F9', '0A'], read: 2 },
  { m: 'jne loop', hex: ['75', 'F3'], read: 1 },
  { m: 'mov eax, [x]', hex: ['8B', '05', 'ED', '0F', '00', '00'], read: 2 },
  { m: 'ret', hex: ['C3'], read: 1 },
];
const RISC_PROG = [
  { m: 'ldr w1, [x0]', hex: ['01', '00', '40', 'B9'] },
  { m: 'add w1, w1, w2', hex: ['21', '00', '02', '0B'] },
  { m: 'str w1, [x0]', hex: ['01', '00', '00', 'B9'] },
  { m: 'add w3, w3, #1', hex: ['63', '04', '00', '11'] },
  { m: 'cmp w3, #10', hex: ['7F', '28', '00', '71'] },
  { m: 'b.ne loop', hex: ['61', 'FF', 'FF', '54'] },
  { m: 'mov w0, w1', hex: ['E0', '03', '01', '2A'] },
  { m: 'ret', hex: ['C0', '03', '5F', 'D6'] },
];
const UOPS = [
  { m: 'load t, [x]' },
  { m: 'add t, eax' },
  { m: 'store [x], t' },
];
const byteOffsets = (prog) => {
  let o = 0;
  return prog.map((s) => {
    const r = o;
    o += s.hex.length;
    return r;
  });
};
const CISC_OFF = byteOffsets(CISC_PROG); // 0 6 8 11 13 19   (20 bytes)
const RISC_OFF = byteOffsets(RISC_PROG); // 0 4 8 … 28       (32 bytes)

const lerp = (a, b, t) => a + (b - a) * t;
const env = (u, a, b, c, d) => win(u, a, b) * (1 - win(u, c, d));
const mod = (x, m) => ((x % m) + m) % m;

// ---------------------------------------------------------------------------
// Canvas text
// ---------------------------------------------------------------------------
function canvasTex(w, h, draw) {
  const c = document.createElement('canvas');
  c.width = w;
  c.height = h;
  const x = c.getContext('2d');
  draw(x, w, h);
  const t = new THREE.CanvasTexture(c);
  t.colorSpace = THREE.SRGBColorSpace;
  t.anisotropy = 8;
  return t;
}

function roundRect(x, X, Y, W, H, r) {
  x.beginPath();
  x.moveTo(X + r, Y);
  x.arcTo(X + W, Y, X + W, Y + H, r);
  x.arcTo(X + W, Y + H, X, Y + H, r);
  x.arcTo(X, Y + H, X, Y, r);
  x.arcTo(X, Y, X + W, Y, r);
  x.closePath();
}

// Flat text decal (unlit, so printing stays legible from every camera)
function textPlate(lines, w, h, { color = '#dfe6ee', weight = 600, font = '"Segoe UI", sans-serif', align = 'center' } = {}) {
  const W = 1024;
  const H = Math.max(64, Math.round((W * h) / w));
  const tex = canvasTex(W, H, (x) => {
    x.clearRect(0, 0, W, H);
    x.textAlign = align;
    x.textBaseline = 'middle';
    const n = lines.length;
    lines.forEach((ln, i) => {
      const spec = typeof ln === 'string' ? { t: ln } : ln;
      const px = Math.round((H / n) * (spec.size ?? 0.62));
      x.font = `${spec.weight ?? weight} ${px}px ${spec.font ?? font}`;
      x.fillStyle = spec.color ?? color;
      x.fillText(spec.t, align === 'center' ? W / 2 : 16, (H / n) * (i + 0.5));
    });
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.renderOrder = 2;
  return mesh;
}

// The printed top of an instruction tile: mnemonic on the far half, one cell
// per byte (with its hex) on the near half. Micro-ops print a label instead.
const texCache = new Map();
function tileTexture(spec, cssColor, uop) {
  const key = `${spec.m}|${cssColor}|${uop}`;
  if (texCache.has(key)) return texCache.get(key);
  const n = uop ? 4 : spec.hex.length;
  const CW = 128;
  const W = n * CW;
  const H = 360;
  const tex = canvasTex(W, H, (x) => {
    x.fillStyle = '#12161d';
    x.fillRect(0, 0, W, H);
    x.strokeStyle = cssColor;
    x.globalAlpha = 0.9;
    x.lineWidth = 7;
    roundRect(x, 6, 6, W - 12, H - 12, 18);
    x.stroke();
    x.globalAlpha = 1;
    // mnemonic
    const chars = spec.m.length;
    const fs = Math.min(60, Math.floor((W - 34) / (chars * 0.56)));
    x.font = `700 ${fs}px ${MONO}`;
    x.fillStyle = cssColor;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(spec.m, W / 2, 96);
    // divider
    x.fillStyle = 'rgba(200,215,230,0.22)';
    x.fillRect(18, 176, W - 36, 3);
    if (uop) {
      x.font = `600 44px "Segoe UI", sans-serif`;
      x.fillStyle = '#c3ccd6';
      x.fillText('micro-op', W / 2, 266);
    } else {
      for (let i = 0; i < n; i++) {
        if (i > 0) {
          x.fillStyle = 'rgba(200,215,230,0.28)';
          x.fillRect(i * CW - 1.5, 196, 3, 140);
        }
        x.font = `700 58px ${MONO}`;
        x.fillStyle = '#dde3ea';
        x.fillText(spec.hex[i], i * CW + CW / 2, 268);
      }
    }
  });
  texCache.set(key, tex);
  return tex;
}

// ---------------------------------------------------------------------------
// Instruction tile — group origin at its LEFT edge, on the slab top
// ---------------------------------------------------------------------------
function makeTile(spec, color, cssColor, { uop = false } = {}) {
  const n = uop ? 4 : spec.hex.length;
  const w = n * B - GAP;
  const g = new THREE.Group();
  const bodyMat = new THREE.MeshStandardMaterial({
    color: 0x1a1e25,
    roughness: 0.55,
    metalness: 0.15,
    emissive: color,
    emissiveIntensity: 0,
  });
  const body = beveledBox(w, TILE_H, TILE_D, bodyMat, 0.012);
  body.position.set(GAP / 2 + w / 2, TILE_H / 2, 0);
  body.receiveShadow = true;
  const topMat = new THREE.MeshBasicMaterial({ map: tileTexture(spec, cssColor, uop), toneMapped: false });
  topMat.color.setScalar(0.55);
  const top = new THREE.Mesh(new THREE.PlaneGeometry(w - 0.014, TILE_D - 0.014), topMat);
  top.rotation.x = -Math.PI / 2;
  top.position.set(GAP / 2 + w / 2, TILE_H + 0.0015, 0);
  g.add(body, top);
  let lit = -1;
  return {
    lit: () => Math.max(0, lit),
    group: g,
    bytes: n,
    len: n * B,
    setLit(v) {
      if (v === lit) return;
      lit = v;
      topMat.color.setScalar(0.55 + 0.65 * v);
      bodyMat.emissiveIntensity = 0.9 * v;
    },
  };
}

// A looping ribbon of program copies riding the slab. off (bytes) grows ->
// tiles move LEFT. Whole tiles only become visible inside a housing, so the
// wrap is never seen.
function makeRibbon(parent, prog, offs, copies, z, color, css) {
  const P = prog.reduce((a, s) => a + s.hex.length, 0);
  const L = P * copies;
  const items = [];
  for (let k = 0; k < copies; k++) {
    prog.forEach((spec, i) => {
      const t = makeTile(spec, color, css);
      t.group.position.set(0, TOP, z + TZ);
      parent.add(t.group);
      items.push({ t, i, o: offs[i] + k * P, s: 0 });
    });
  }
  function update(off, litFn) {
    for (const it of items) {
      const s = X_A + mod(it.o - off, L) * B;
      it.s = s;
      it.t.group.position.x = s;
      it.t.group.visible = s >= HX0 - 1e-6 && s + it.t.len <= HX1 + 1e-6;
      it.t.setLit(litFn ? litFn(it.i, s) : 0);
    }
  }
  return { items, P, update };
}

function glowMat(color, intensity = 1.8, opacity = 1) {
  const m = materials.glow(color, intensity);
  m.transparent = true;
  m.opacity = opacity;
  m.depthWrite = false;
  return m;
}

// A data packet: a lead orb with a short fading trail, riding an arc.
function makeOrb(parent, color) {
  const g = new THREE.Group();
  const orbs = [];
  for (let i = 0; i < 4; i++) {
    const m = glowMat(color, 2.0, 0);
    const o = new THREE.Mesh(new THREE.SphereGeometry(0.05 * (1 - i * 0.2), 16, 12), m);
    g.add(o);
    orbs.push(o);
  }
  parent.add(g);
  return {
    set(curve, t, alpha) {
      orbs.forEach((o, i) => {
        const ti = t - i * 0.055;
        const a = alpha * (ti < 0 ? 0 : 1) * (1 - i * 0.24);
        o.material.opacity = a;
        o.visible = a > 0.001;
        o.position.copy(curve.getPointAt(clamp01(ti)));
      });
    },
  };
}

function arc(a, b, lift) {
  const A = new THREE.Vector3(...a);
  const C = new THREE.Vector3(...b);
  const mid = A.clone().add(C).multiplyScalar(0.5);
  mid.y += lift ?? 0.3 + 0.16 * A.distanceTo(C);
  return new THREE.QuadraticBezierCurve3(A, mid, C);
}

// ---------------------------------------------------------------------------
// The processor package (step 1 / finale)
// ---------------------------------------------------------------------------
function makePackage({ name, sub, subColor, accent, accentCss, decoderW, decoderText, baseY }) {
  const g = new THREE.Group();
  const SUB = 1.46;
  const BALL_R = 0.03;
  // solder-ball grid under the substrate (BGA)
  const ballGeo = new THREE.SphereGeometry(BALL_R, 10, 8);
  const ballMat = new THREE.MeshStandardMaterial({ color: 0xb9bec4, metalness: 0.85, roughness: 0.35 });
  const N = 13;
  const balls = new THREE.InstancedMesh(ballGeo, ballMat, N * N);
  const m4 = new THREE.Matrix4();
  let bi = 0;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      m4.makeTranslation((i - (N - 1) / 2) * 0.105, baseY + BALL_R, (j - (N - 1) / 2) * 0.105);
      balls.setMatrixAt(bi++, m4);
    }
  }
  g.add(balls);
  const subY = baseY + BALL_R * 1.7;
  const subMat = new THREE.MeshPhysicalMaterial({ color: subColor, roughness: 0.5, metalness: 0.05, clearcoat: 0.3, clearcoatRoughness: 0.4 });
  const substrate = beveledBox(SUB, 0.06, SUB, subMat, 0.012);
  substrate.position.y = subY + 0.03;
  substrate.receiveShadow = true;
  g.add(substrate);
  const subTop = subY + 0.06;
  // sealant bead + nickel-plated lid
  const bead = beveledBox(1.13, 0.014, 1.13, new THREE.MeshStandardMaterial({ color: 0x15171a, roughness: 0.8 }), 0.006);
  bead.position.y = subTop + 0.007;
  g.add(bead);
  // --- the silicon die under the lid: a front-end decoder strip in front of
  // a RISC-style execution core (the finale's payoff). x86's decoder strip is
  // drawn wider: it has far more translating to do.
  const DIE = 0.78;
  const dieTop = subTop + 0.03;
  const die = beveledBox(DIE, 0.03, DIE, new THREE.MeshStandardMaterial({ color: 0x1a2130, roughness: 0.35, metalness: 0.3 }), 0.006);
  die.position.y = subTop + 0.015;
  g.add(die);
  const coreW = DIE - 0.06 - decoderW - 0.02;
  const coreTex = canvasTex(512, Math.round((512 * (DIE - 0.06)) / coreW), (x, W, H) => {
    x.fillStyle = '#0f1824';
    x.fillRect(0, 0, W, H);
    const cols = 6;
    const rows = Math.round((cols * H) / W);
    for (let i = 0; i < cols; i++) {
      for (let j = 0; j < rows; j++) {
        x.fillStyle = (i * 7 + j * 3) % 5 === 0 ? 'rgba(94,200,255,0.75)' : 'rgba(94,200,255,0.32)';
        x.fillRect((i * W) / cols + 6, (j * H) / rows + 6, W / cols - 12, H / rows - 12);
      }
    }
    x.fillStyle = '#e8f6ff';
    x.font = '800 44px "Segoe UI", sans-serif';
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText('RISC-STYLE', W / 2, H / 2 - 28);
    x.fillText('CORE', W / 2, H / 2 + 28);
  });
  const coreMat = new THREE.MeshBasicMaterial({ map: coreTex, toneMapped: false });
  const core = new THREE.Mesh(new THREE.PlaneGeometry(coreW, DIE - 0.06), coreMat);
  core.rotation.x = -Math.PI / 2;
  core.position.set(-DIE / 2 + 0.03 + decoderW + 0.02 + coreW / 2, dieTop + 0.001, 0);
  g.add(core);
  const decTex = canvasTex(256, Math.round((256 * (DIE - 0.06)) / decoderW), (x, W, H) => {
    x.fillStyle = '#1c1408';
    x.fillRect(0, 0, W, H);
    x.fillStyle = accentCss;
    x.globalAlpha = 0.55;
    for (let j = 0; j < 9; j++) x.fillRect(10, (j * H) / 9 + 8, W - 20, H / 9 - 16);
    x.globalAlpha = 1;
    x.save();
    x.translate(W / 2, H / 2);
    x.rotate(-Math.PI / 2);
    x.fillStyle = '#fff6e6';
    x.font = `800 ${Math.min(64, Math.round(W * 0.42))}px "Segoe UI", sans-serif`;
    x.textAlign = 'center';
    x.textBaseline = 'middle';
    x.fillText(decoderText, 0, 0);
    x.restore();
  });
  const decMatP = new THREE.MeshBasicMaterial({ map: decTex, toneMapped: false });
  const decoder = new THREE.Mesh(new THREE.PlaneGeometry(decoderW, DIE - 0.06), decMatP);
  decoder.rotation.x = -Math.PI / 2;
  decoder.position.set(-DIE / 2 + 0.03 + decoderW / 2, dieTop + 0.001, 0);
  g.add(decoder);

  const lidG = new THREE.Group();
  g.add(lidG);
  const lidMat = materials.brushedSteel(0xc7ccd2);
  lidMat.roughness = 0.62;
  const lid = beveledBox(1.1, 0.075, 1.1, lidMat, 0.02);
  lid.position.y = subTop + 0.014 + 0.0375;
  lidG.add(lid);
  const lidTop = subTop + 0.014 + 0.075;
  // laser marking (darker than the nickel, like a real etch)
  const mark = textPlate(
    [
      { t: name, size: 0.78, weight: 800, color: '#2a2e34' },
      { t: sub, size: 0.42, weight: 700, color: '#363a41' },
      { t: 'X2Q7  2614  A1', size: 0.38, weight: 600, color: '#40454c', font: MONO },
    ],
    0.86,
    0.5,
  );
  mark.rotation.x = -Math.PI / 2;
  mark.position.set(0, lidTop + 0.0015, 0.04);
  lidG.add(mark);
  // pin-1 marker in the lane colour
  const pin1 = new THREE.Mesh(new THREE.CircleGeometry(0.035, 20), new THREE.MeshBasicMaterial({ color: accent, toneMapped: false }));
  pin1.rotation.x = -Math.PI / 2;
  pin1.position.set(-0.46, lidTop + 0.0015, -0.46);
  lidG.add(pin1);
  // decoupling capacitors along two edges of the substrate (0402 parts)
  const capGeo = new THREE.BoxGeometry(0.06, 0.028, 0.032);
  const endGeo = new THREE.BoxGeometry(0.014, 0.03, 0.034);
  const caps = [];
  for (let i = 0; i < 9; i++) {
    const t = (i - 4) * 0.12;
    caps.push([t, -0.65, 0], [t, 0.65, 0], [-0.65, t, Math.PI / 2], [0.65, t, Math.PI / 2]);
  }
  const capMesh = new THREE.InstancedMesh(capGeo, new THREE.MeshStandardMaterial({ color: 0x8a6c4a, roughness: 0.6 }), caps.length);
  const endMesh = new THREE.InstancedMesh(endGeo, new THREE.MeshStandardMaterial({ color: 0xc9ced3, metalness: 0.8, roughness: 0.35 }), caps.length * 2);
  const q = new THREE.Quaternion();
  const one = new THREE.Vector3(1, 1, 1);
  caps.forEach(([cx, cz, r], i) => {
    q.setFromAxisAngle(new THREE.Vector3(0, 1, 0), r);
    m4.compose(new THREE.Vector3(cx, subTop + 0.014, cz), q, one);
    capMesh.setMatrixAt(i, m4);
    for (const s of [-1, 1]) {
      const off = new THREE.Vector3(s * 0.033, 0, 0).applyQuaternion(q);
      m4.compose(new THREE.Vector3(cx + off.x, subTop + 0.015, cz + off.z), q, one);
      endMesh.setMatrixAt(i * 2 + (s > 0 ? 1 : 0), m4);
    }
  });
  g.add(capMesh, endMesh);
  // lid off: lifted, set back behind the chip and tipped toward it
  const setLid = (t) => {
    lidG.position.set(0, 0.42 * t, -1.05 * t);
    lidG.rotation.x = -0.5 * t;
  };
  return { group: g, lidTop, dieTop, lid, setLid, decMatP, decoderW, DIE };
}

// ---------------------------------------------------------------------------
// build
// ---------------------------------------------------------------------------
export function buildRiscVsCisc({ scene }) {
  const root = new THREE.Group();
  scene.add(root);
  const S = { u: 0, spin: 0, lid: 0 };
  const labels = calloutSets(['chips', 'inside', 'tape', 'job', 'regs', 'decode', 'uops']);
  let current = 'chips';
  const groups = {};
  const mk = (name) => {
    const g = new THREE.Group();
    root.add(g);
    groups[name] = g;
    return g;
  };

  // ===========================================================================
  // VIEW · chips — two sealed packages on a turntable
  // ===========================================================================
  const chipsG = mk('chips');
  const smallPlinth = studioPlinth({ w: 4.6, h: 0.24, d: 2.5 });
  chipsG.add(smallPlinth);
  const spinner = new THREE.Group();
  chipsG.add(spinner);
  const pkgX86 = makePackage({ name: 'x86-64', sub: 'CISC  ·  LAPTOP CPU', subColor: 0x1d3f33, accent: AMBER, accentCss: AMBER_CSS, decoderW: 0.26, decoderText: 'DECODER', baseY: 0.24 });
  pkgX86.group.position.x = -1.02;
  const pkgArm = makePackage({ name: 'ARM64', sub: 'RISC  ·  PHONE SoC', subColor: 0x1c2533, accent: CYAN, accentCss: CYAN_CSS, decoderW: 0.12, decoderText: 'DECODE', baseY: 0.24 });
  pkgArm.group.position.x = 1.02;
  spinner.add(pkgX86.group, pkgArm.group);
  labels.add('chips', pkgX86.group, 'CISC: x86-64', [0.44, pkgX86.lidTop + 0.005, -0.44], 70, 52);
  labels.add('chips', pkgArm.group, 'RISC: ARM64', [0.44, pkgArm.lidTop + 0.005, -0.44], 60, 52);
  const dieX = (p) => -p.DIE / 2 + 0.03;
  labels.add('inside', pkgX86.group, 'x86 decoder: translates', [dieX(pkgX86) + pkgX86.decoderW / 2, pkgX86.dieTop + 0.01, 0.2], 82, 105);
  labels.add('inside', pkgX86.group, 'RISC-style core', [0.18, pkgX86.dieTop + 0.01, 0.25], -70, 95);
  labels.add('inside', pkgArm.group, 'ARM decoder: simpler', [dieX(pkgArm) + pkgArm.decoderW / 2, pkgArm.dieTop + 0.01, 0.2], 70, 70);
  labels.add('inside', pkgArm.group, 'Same kind of core', [0.12, pkgArm.dieTop + 0.01, 0.25], -40, 70);

  // ===========================================================================
  // Shared diagram stage: big plinth + one slab per lane
  // ===========================================================================
  const stageG = mk('stage');
  const bigPlinth = studioPlinth({ w: 7.6, h: PY, d: 2.7 });
  stageG.add(bigPlinth);
  function slabTexture(css) {
    // byte tick marks every B, aligned to the ribbon grid (X_A is a tick)
    const len = 7.0;
    const W = 2048;
    const H = Math.round((W * SLAB_D) / len);
    return canvasTex(W, H, (x) => {
      x.fillStyle = '#16191f';
      x.fillRect(0, 0, W, H);
      const pxPerUnit = W / len;
      const zTop = H * (0.5 + (TZ - TILE_D / 2 - 0.02) / SLAB_D);
      const zBot = H * (0.5 + (TZ + TILE_D / 2 + 0.02) / SLAB_D);
      x.fillStyle = 'rgba(160,180,200,0.10)';
      x.fillRect(0, zTop, W, zBot - zTop);
      x.fillStyle = 'rgba(190,205,220,0.35)';
      for (let k = -40; k < 60; k++) {
        const wx = X_A + k * B;
        if (wx < -3.5 || wx > 3.5) continue;
        const px = (wx + 3.5) * pxPerUnit;
        x.fillRect(px - 1, zBot + 4, 2, 10);
      }
      x.fillStyle = css;
      x.globalAlpha = 0.85;
      x.fillRect(0, H - 6, W, 3);
      x.globalAlpha = 1;
    });
  }
  function makeSlab(z, css) {
    const mat = new THREE.MeshStandardMaterial({ map: slabTexture(css), roughness: 0.7, metalness: 0.1 });
    const slab = beveledBox(7.0, SLAB_H, SLAB_D, mat, 0.01);
    slab.position.set(0, PY + SLAB_H / 2, z);
    slab.receiveShadow = true;
    return slab;
  }
  stageG.add(makeSlab(Z_C, AMBER_CSS), makeSlab(Z_R, CYAN_CSS));

  // ===========================================================================
  // Housings (ribbon views): memory on the right, the core on the left
  // ===========================================================================
  const housingG = new THREE.Group();
  root.add(housingG);
  const houseMat = materials.paintedMetal(0x2a2f37);
  houseMat.clearcoat = 0.3;
  houseMat.roughness = 0.5;
  function makeHousing(x0, x1, z, name, color, css, face) {
    const g = new THREE.Group();
    const w = x1 - x0;
    const body = beveledBox(w, HOUSE_H, SLAB_D + 0.04, houseMat, 0.03);
    body.position.set((x0 + x1) / 2, TOP + HOUSE_H / 2 - 0.005, z);
    body.receiveShadow = true;
    g.add(body);
    // the slot the ribbon runs through
    const mouth = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE_D + 0.07, TILE_H + 0.05),
      new THREE.MeshBasicMaterial({ color: 0x050607 }),
    );
    mouth.rotation.y = face * Math.PI / 2;
    mouth.position.set(face > 0 ? x1 + 0.002 : x0 - 0.002, TOP + (TILE_H + 0.05) / 2, z + TZ);
    g.add(mouth);
    // lane-colour status strip on top
    const strip = new THREE.Mesh(new THREE.BoxGeometry(w - 0.16, 0.01, 0.03), glowMat(color, 1.1, 0.9));
    strip.position.set((x0 + x1) / 2, TOP + HOUSE_H, z + SLAB_D / 2 - 0.06);
    g.add(strip);
    if (name) {
      const plate = textPlate([{ t: name, color: css, weight: 700, size: 0.6 }], w - 0.12, 0.17);
      plate.position.set((x0 + x1) / 2, TOP + HOUSE_H * 0.55, z + SLAB_D / 2 + 0.021);
      g.add(plate);
    }
    housingG.add(g);
    return body;
  }
  const memC = makeHousing(WX1, HX1, Z_C, 'x86-64 · CISC', AMBER, AMBER_CSS, -1);
  const memR = makeHousing(WX1, HX1, Z_R, 'ARM64 · RISC', CYAN, CYAN_CSS, -1);
  makeHousing(HX0, WX0, Z_C, null, AMBER, AMBER_CSS, 1);
  makeHousing(HX0, WX0, Z_R, null, CYAN, CYAN_CSS, 1);

  // ===========================================================================
  // VIEW · tape + decode — two looping ribbons
  // ===========================================================================
  const ribbonG = new THREE.Group();
  root.add(ribbonG);
  const ribC = makeRibbon(ribbonG, CISC_PROG, CISC_OFF, 3, Z_C, AMBER, AMBER_CSS);
  const ribR = makeRibbon(ribbonG, RISC_PROG, RISC_OFF, 2, Z_R, CYAN, CYAN_CSS);
  const tapeAnchor = new THREE.Group();
  ribbonG.add(tapeAnchor);
  labels.add('tape', tapeAnchor, 'x86: 1 to 15 bytes each', [0.75, TOP + 0.012, Z_C + TZ + TILE_D / 2 + 0.06], 62, 90);
  labels.add('tape', tapeAnchor, 'ARM: always 4 bytes', [0.6, TOP + 0.012, Z_R + TZ + TILE_D / 2 + 0.06], -45, 56);
  labels.add('tape', memC, 'Program in memory', [0, HOUSE_H / 2 + 0.01, 0], 40, 46);

  // --- decode extras ----------------------------------------------------------
  const decodeG = new THREE.Group();
  root.add(decodeG);
  // boundary bars: thin glowing blades standing in the seams
  function makeBar(x, z, color) {
    const m = glowMat(color, 1.9, 0.95);
    const bar = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.17, TILE_D + 0.06), m);
    bar.position.set(x, TOP - 0.1, z + TZ);
    decodeG.add(bar);
    return bar;
  }
  const BAR_DOWN = TOP - 0.1; // hidden inside slab/plinth
  const BAR_UP = TOP + 0.075;
  const riscBars = [];
  for (let k = 0; k <= 8; k++) riscBars.push(makeBar(WX0 + k * 4 * B + (k === 0 ? 0.008 : k === 8 ? -0.008 : 0), Z_R, CYAN));
  const ciscEdges = [...CISC_OFF, 20];
  const ciscBars = ciscEdges.map((o, j) => makeBar(WX0 + o * B + (j === 0 ? 0.008 : 0), Z_C, AMBER));

  // eight ARM decoders, between the lanes
  const decMat = materials.paintedMetal(0x2d333c);
  decMat.clearcoat = 0.25;
  const decoders = [];
  for (let k = 0; k < 8; k++) {
    const g = new THREE.Group();
    const body = beveledBox(0.5, 0.13, 0.17, decMat, 0.02);
    body.position.y = 0.065;
    const faceMat = glowMat(CYAN, 1.6, 0.25);
    const face = new THREE.Mesh(new THREE.PlaneGeometry(0.42, 0.06), faceMat);
    face.position.set(0, 0.07, 0.0855);
    const num = textPlate([{ t: `D${k + 1}`, color: '#9fb4c8', weight: 700, size: 0.7 }], 0.22, 0.09);
    num.rotation.x = -Math.PI / 2;
    num.position.set(0, 0.1305, -0.01);
    g.add(body, face, num);
    g.position.set(WX0 + 0.3 + k * 0.6, PY, 0.16);
    decodeG.add(g);
    decoders.push({ g, faceMat });
  }
  // x86 length finder: a carriage on a rail behind the x86 lane
  const railZ = Z_C - SLAB_D / 2 - 0.13;
  const rail = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 5.0, 16), materials.chrome());
  rail.rotation.z = Math.PI / 2;
  rail.position.set(0, PY + 0.2, railZ);
  decodeG.add(rail);
  for (const px of [-2.5, 2.5]) {
    const post = beveledBox(0.07, 0.22, 0.07, decMat, 0.015);
    post.position.set(px, PY + 0.11, railZ);
    decodeG.add(post);
  }
  const scanner = new THREE.Group();
  decodeG.add(scanner);
  const carriage = beveledBox(0.2, 0.15, 0.16, decMat, 0.025);
  carriage.position.set(0, PY + 0.2, railZ);
  const armLen = (Z_C + TZ) - railZ;
  const armBar = beveledBox(0.05, 0.035, armLen, materials.brushedSteel(0xb9c0c8), 0.01);
  armBar.position.set(0, TOP + TILE_H + 0.2, railZ + armLen / 2);
  const riser = beveledBox(0.05, TOP + TILE_H + 0.2 - (PY + 0.2), 0.05, materials.brushedSteel(0xb9c0c8), 0.01);
  riser.position.set(0, (TOP + TILE_H + 0.2 + PY + 0.2) / 2, railZ);
  const headMat = glowMat(AMBER, 1.8, 1);
  const head = beveledBox(0.11, 0.05, 0.11, decMat, 0.012);
  head.position.set(0, TOP + TILE_H + 0.17, Z_C + TZ);
  const lens = new THREE.Mesh(new THREE.CircleGeometry(0.035, 20), headMat);
  lens.rotation.x = Math.PI / 2;
  lens.position.set(0, TOP + TILE_H + 0.144, Z_C + TZ);
  const beamMat = glowMat(AMBER, 1.2, 0);
  const beam = new THREE.Mesh(new THREE.CylinderGeometry(0.035, 0.11, 0.14, 24, 1, true), beamMat);
  beam.position.set(0, TOP + TILE_H + 0.072, Z_C + TZ);
  scanner.add(carriage, armBar, riser, head, lens, beam);
  // the bytes being read, lit on the tile's top
  const readMat = new THREE.MeshBasicMaterial({ color: AMBER, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
  const readWin = new THREE.Mesh(new THREE.PlaneGeometry(1, TILE_D - 0.04), readMat);
  readWin.rotation.x = -Math.PI / 2;
  readWin.position.set(0, TOP + TILE_H + 0.004, Z_C + TZ);
  readWin.renderOrder = 3;
  decodeG.add(readWin);

  const decAnchor = new THREE.Group();
  decodeG.add(decAnchor);
  labels.add('decode', decoders[6].g, '8 decoders, all at once', [0.18, 0.1, 0.09], -62, 118);
  labels.add('decode', decAnchor, 'Reads each length first', [2.15, PY + 0.25, railZ], 40, 50);

  // ===========================================================================
  // VIEW · uops — the x86 decoder cracking one instruction into micro-ops
  // ===========================================================================
  const uopG = new THREE.Group();
  root.add(uopG);
  const DEC_X0 = 0.2;
  const DEC_X1 = 1.2;
  const crackBody = beveledBox(DEC_X1 - DEC_X0, 0.38, SLAB_D + 0.04, houseMat, 0.03);
  crackBody.position.set((DEC_X0 + DEC_X1) / 2, TOP + 0.19 - 0.005, Z_C);
  uopG.add(crackBody);
  for (const [fx, face] of [[DEC_X0, -1], [DEC_X1, 1]]) {
    const mouth = new THREE.Mesh(
      new THREE.PlaneGeometry(TILE_D + 0.07, TILE_H + 0.05),
      new THREE.MeshBasicMaterial({ color: 0x050607 }),
    );
    mouth.rotation.y = face * Math.PI / 2;
    mouth.position.set(fx + face * 0.002, TOP + (TILE_H + 0.05) / 2, Z_C + TZ);
    uopG.add(mouth);
  }
  const crackGlow = glowMat(AMBER, 1.6, 0.3);
  const crackStrip = new THREE.Mesh(new THREE.BoxGeometry(DEC_X1 - DEC_X0 - 0.16, 0.012, 0.05), crackGlow);
  crackStrip.position.set((DEC_X0 + DEC_X1) / 2, TOP + 0.38, Z_C + SLAB_D / 2 - 0.08);
  uopG.add(crackStrip);
  const crackLabel = textPlate([{ t: 'DECODER', color: '#c9a77a', weight: 700, size: 0.62 }], 0.8, 0.14);
  crackLabel.rotation.x = -Math.PI / 2;
  crackLabel.position.set((DEC_X0 + DEC_X1) / 2, TOP + 0.38 + 0.002, Z_C - 0.05);
  uopG.add(crackLabel);

  const bigTile = makeTile(CISC_PROG[0], AMBER, AMBER_CSS);
  bigTile.group.position.set(0, TOP, Z_C + TZ);
  uopG.add(bigTile.group);
  const UOP_S = [-2.1, -1.5, -0.9];
  const UOP_WIN = [[0.4, 0.5], [0.45, 0.55], [0.5, 0.59]];
  const uops = UOPS.map((spec) => {
    const t = makeTile(spec, AMBER, AMBER_CSS, { uop: true });
    t.group.position.set(0, TOP, Z_C + TZ);
    uopG.add(t.group);
    return t;
  });
  const armTiles = RISC_PROG.slice(0, 3).map((spec, k) => {
    const t = makeTile(spec, CYAN, CYAN_CSS);
    t.group.position.set(UOP_S[k], TOP, Z_R + TZ);
    uopG.add(t.group);
    return t;
  });
  // alignment guides: same shape, edge for edge
  const guides = [UOP_S[0], UOP_S[1], UOP_S[2], UOP_S[2] + 4 * B].map((gx) => {
    const m = new THREE.MeshBasicMaterial({ color: 0xe8eef5, transparent: true, opacity: 0, depthWrite: false, toneMapped: false });
    const gl = new THREE.Mesh(new THREE.PlaneGeometry(0.012, Z_R - Z_C - TILE_D), m);
    gl.rotation.x = -Math.PI / 2;
    gl.position.set(gx, TOP + 0.002, (Z_C + Z_R) / 2 + TZ);
    uopG.add(gl);
    return m;
  });
  labels.add('uops', crackBody, 'x86 decoder', [0.25, 0.02, SLAB_D / 2 + 0.025], 50, 60);
  const uopAnchor = new THREE.Group();
  uopG.add(uopAnchor);
  labels.add('uops', uopAnchor, 'Micro-ops: load, add, store', [-2.26, TOP + 0.012, Z_C + TZ], 70, 80);
  labels.add('uops', uopAnchor, 'ARM: ldr, add, str', [-1.2, TOP + 0.012, Z_R + TZ + TILE_D / 2 + 0.06], -45, 56);

  // ===========================================================================
  // VIEW · job — same job, two scripts: memory, registers, ALU per lane
  // ===========================================================================
  const jobG = mk('job');
  const MEM_X0 = -0.62;
  const MEM_N = 6;
  const MEM_ADDR = ['0FF4', '0FF8', '0FFC', 'x', '1004', '1008'];
  const memCellX = (k) => MEM_X0 + 0.08 + k * 0.16;
  const X_CELL = 3; // address 0x1000 = x
  const REG_X0 = 0.52;
  const regX = (c) => REG_X0 + 0.075 + c * 0.15;
  const ALU_X = 2.3;
  const lane = (z, isRisc) => {
    const zc = z + TZ;
    const color = isRisc ? CYAN : AMBER;
    const css = isRisc ? CYAN_CSS : AMBER_CSS;
    const g = new THREE.Group();
    jobG.add(g);
    // --- program tiles
    const prog = isRisc ? RISC_PROG.slice(0, 3) : [CISC_PROG[0]];
    let s = -2.65;
    const tiles = prog.map((spec) => {
      const t = makeTile(spec, color, css);
      t.group.position.set(s, TOP, zc);
      t.x0 = s;
      s += t.len;
      g.add(t.group);
      return t;
    });
    // --- memory bank
    const memBase = beveledBox(MEM_N * 0.16 + 0.04, 0.03, 0.44, materials.paintedMetal(0x183a2c), 0.01);
    memBase.position.set(MEM_X0 + (MEM_N * 0.16) / 2, TOP + 0.015, zc);
    g.add(memBase);
    const memCells = [];
    for (let k = 0; k < MEM_N; k++) {
      const m = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6, metalness: 0.2, emissive: color, emissiveIntensity: 0 });
      const c = beveledBox(0.14, 0.09, 0.34, m, 0.012);
      c.position.set(memCellX(k), TOP + 0.03 + 0.045, zc);
      g.add(c);
      memCells.push(m);
    }
    // one address label per cell (x = 0x1000, the variable the loop updates)
    for (let k = 0; k < MEM_N; k++) {
      const a = MEM_ADDR[k];
      const p = textPlate(
        [{ t: a, font: MONO, color: k === X_CELL ? css : '#9aa5b1', weight: 700, size: k === X_CELL ? 0.95 : 0.62 }],
        0.13,
        0.07,
      );
      p.rotation.x = -Math.PI / 2;
      p.position.set(memCellX(k), TOP + 0.1215, zc + 0.08);
      g.add(p);
    }
    // --- register file
    const names = isRisc
      ? Array.from({ length: 31 }, (_, i) => `w${i}`)
      : ['eax', 'ecx', 'edx', 'ebx', 'esp', 'ebp', 'esi', 'edi', 'r8d', 'r9d', 'r10d', 'r11d', 'r12d', 'r13d', 'r14d', 'r15d'];
    const rows = Math.ceil(names.length / 8);
    const regBase = beveledBox(1.26, 0.03, rows * 0.15 + 0.06, materials.paintedMetal(0x22272e), 0.01);
    regBase.position.set(REG_X0 + 0.6, TOP + 0.015, zc);
    g.add(regBase);
    const regs = names.map((nm, i) => {
      const r = Math.floor(i / 8);
      const c = i % 8;
      const m = new THREE.MeshStandardMaterial({ color: 0x1b2027, roughness: 0.5, metalness: 0.25, emissive: color, emissiveIntensity: 0.06 });
      const cell = beveledBox(0.13, 0.07, 0.13, m, 0.012);
      const cz = zc - ((rows - 1) / 2) * 0.15 + r * 0.15;
      cell.position.set(regX(c), TOP + 0.03 + 0.035, cz);
      g.add(cell);
      const tp = textPlate([{ t: nm, font: MONO, color: '#c6d0da', weight: 700, size: 0.62 }], 0.125, 0.06);
      tp.rotation.x = -Math.PI / 2;
      tp.position.set(regX(c), TOP + 0.03 + 0.0705, cz);
      g.add(tp);
      return { m, pos: new THREE.Vector3(regX(c), TOP + 0.13, cz) };
    });
    // --- ALU (the classic notched-chevron symbol, as a block)
    const sh = new THREE.Shape();
    sh.moveTo(-0.3, -0.27);
    sh.lineTo(0.3, -0.12);
    sh.lineTo(0.3, 0.12);
    sh.lineTo(-0.3, 0.27);
    sh.lineTo(-0.3, 0.07);
    sh.lineTo(-0.2, 0);
    sh.lineTo(-0.3, -0.07);
    sh.closePath();
    const aluGeo = new THREE.ExtrudeGeometry(sh, { depth: 0.11, bevelEnabled: true, bevelSize: 0.012, bevelThickness: 0.012, bevelSegments: 2 });
    aluGeo.rotateX(-Math.PI / 2);
    const aluMat = materials.paintedMetal(0x2b3038);
    aluMat.clearcoat = 0.3;
    const alu = new THREE.Mesh(aluGeo, aluMat);
    alu.castShadow = true;
    alu.position.set(ALU_X, TOP + 0.012, zc);
    g.add(alu);
    const inset = new THREE.Mesh(new THREE.ShapeGeometry(sh), new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0.12, depthWrite: false, toneMapped: false }));
    inset.rotation.x = -Math.PI / 2;
    inset.scale.setScalar(0.78);
    inset.position.set(ALU_X + 0.01, TOP + 0.012 + 0.11 + 0.013, zc);
    g.add(inset);
    const aluText = textPlate([{ t: 'ALU', color: '#e7edf3', weight: 800, size: 0.75 }], 0.3, 0.12);
    aluText.rotation.x = -Math.PI / 2;
    aluText.position.set(ALU_X + 0.03, TOP + 0.012 + 0.11 + 0.016, zc);
    g.add(aluText);

    const memTop = new THREE.Vector3(memCellX(X_CELL), TOP + 0.13, zc);
    const aluTop = new THREE.Vector3(ALU_X - 0.02, TOP + 0.16, zc);
    return { g, tiles, memCells, regs, alu, inset, memTop, aluTop, color };
  };
  const jobC = lane(Z_C, false);
  const jobR = lane(Z_R, true);
  const V = (v) => [v.x, v.y, v.z];
  // x86: memory -> ALU directly (arching right over the registers) and back
  const cMemAlu = arc(V(jobC.memTop), V(jobC.aluTop), 0.75);
  const cEaxAlu = arc(V(jobC.regs[0].pos), V(jobC.aluTop), 0.4);
  const cAluMem = arc(V(jobC.aluTop), V(jobC.memTop), 0.75);
  // ARM: memory <-> register only; ALU <-> registers only
  const rW1 = jobR.regs[1].pos;
  const rW2 = jobR.regs[2].pos;
  const cMemW1 = arc(V(jobR.memTop), V(rW1), 0.38);
  const cW1Alu = arc(V(rW1), V(jobR.aluTop), 0.42);
  const cW2Alu = arc(V(rW2), V(jobR.aluTop), 0.36);
  const cAluW1 = arc(V(jobR.aluTop), V(rW1), 0.5);
  const cW1Mem = arc(V(rW1), V(jobR.memTop), 0.38);
  const orbC1 = makeOrb(jobG, AMBER);
  const orbC2 = makeOrb(jobG, AMBER);
  const orbC3 = makeOrb(jobG, AMBER);
  const orbR1 = makeOrb(jobG, CYAN);
  const orbR2 = makeOrb(jobG, CYAN);
  const orbR3 = makeOrb(jobG, CYAN);
  const orbR4 = makeOrb(jobG, CYAN);
  const orbR5 = makeOrb(jobG, CYAN);

  labels.add('job', jobC.tiles[0].group, 'x86: one instruction', [0.45, TILE_H + 0.01, -TILE_D / 2 + 0.02], 65, 46);
  labels.add('job', jobR.g, 'ARM: load, add, store', [-1.75, TOP + 0.012, Z_R + TZ + TILE_D / 2 + 0.06], -70, 52);
  labels.add('job', jobC.g, 'Memory', [memCellX(4), TOP + 0.14, Z_C + TZ - 0.1], 80, 44);
  labels.add('job', jobC.alu, 'ALU (the adder)', [0.22, 0.12, -0.05], 50, 62);
  labels.add('regs', jobC.g, '16 registers', [regX(6), TOP + 0.1, Z_C + TZ - 0.1], 75, 46);
  labels.add('regs', jobR.g, '31 registers', [regX(6), TOP + 0.1, Z_R + TZ + 0.25], -30, 50);
  labels.add('regs', jobR.g, 'Memory: load/store only', [memCellX(2), TOP + 0.12, Z_R + TZ + 0.12], -84, 92);

  // ===========================================================================
  // pose functions per view
  // ===========================================================================
  const OFF0 = -12; // ribbon offset that puts each program's first byte at WX0

  function applyTape(u) {
    ribC.update(OFF0 + 20 * u);
    ribR.update(OFF0 + 32 * u);
  }

  // decode lap: ARM decodes 8 at once then advances 32 bytes; x86 finds its
  // six boundaries one by one, then advances 20 bytes.
  const SLOT0 = 0.04;
  const SLOT = (0.8 - SLOT0) / 6;
  const headX = (j) => WX0 + (CISC_OFF[j] + CISC_PROG[j].read / 2) * B;
  function applyDecode(u) {
    const armEnv = env(u, 0.12, 0.2, 0.4, 0.48);
    const offR = OFF0 + 32 * win(u, 0.5, 0.74);
    ribR.update(offR, (i, s) => (s > WX0 - 0.05 && s < WX1 - 0.05 ? armEnv : 0));
    riscBars.forEach((b) => (b.position.y = lerp(BAR_DOWN, BAR_UP, armEnv)));
    decoders.forEach((d) => {
      d.g.position.z = 0.16 + 0.05 * armEnv;
      d.faceMat.opacity = 0.18 + 0.82 * armEnv;
    });

    const drop = 1 - win(u, 0.82, 0.86);
    // bar 0 is the known starting point: up whenever the ribbon is parked
    const barUp = (j) => (j === 0 ? 1 - env(u, 0.82, 0.86, 0.98, 1.0) : win(u, SLOT0 + (j - 1) * SLOT + 0.55 * SLOT, SLOT0 + (j - 1) * SLOT + 0.75 * SLOT) * drop);
    // x86 bar 0 is the known starting point: up across the wrap too
    ciscBars.forEach((b, j) => (b.position.y = lerp(BAR_DOWN, BAR_UP, barUp(j))));
    const offC = OFF0 + 20 * win(u, 0.86, 0.98);
    ribC.update(offC, (i, s) => (s > WX0 - 0.05 && s < WX0 + 20 * B - 0.05 ? barUp(i + 1) : 0));

    // the length finder
    let hx = headX(0);
    let read = 0;
    let rj = 0;
    if (u < SLOT0) {
      hx = headX(0);
    } else if (u < 0.8) {
      const j = Math.min(5, Math.floor((u - SLOT0) / SLOT));
      const f = (u - SLOT0 - j * SLOT) / SLOT;
      hx = lerp(headX(Math.max(0, j - 1)), headX(j), win(f, 0, 0.22));
      read = env(f, 0.2, 0.3, 0.62, 0.72);
      rj = j;
    } else {
      hx = lerp(headX(5), headX(0), win(u, 0.86, 0.98));
    }
    scanner.position.x = hx;
    beamMat.opacity = 0.05 + 0.3 * read;
    headMat.opacity = 0.5 + 0.5 * read;
    readMat.opacity = 0.32 * read;
    const rb = CISC_PROG[rj].read;
    readWin.scale.x = rb * B - 0.03;
    readWin.position.x = WX0 + (CISC_OFF[rj] + rb / 2) * B;
  }

  function applyUops(u) {
    // the one x86 instruction rides in from memory and into the decoder
    const s = lerp(HX1 + 0.2, DEC_X0 + 0.05, win(u, 0.06, 0.42));
    bigTile.group.position.x = s;
    bigTile.group.visible = u < 0.43 && s + bigTile.len <= HX1 + 1e-6;
    bigTile.setLit(0.6);
    crackGlow.opacity = 0.3 + 0.7 * env(u, 0.36, 0.42, 0.56, 0.62);
    const hold = env(u, 0.58, 0.63, 0.8, 0.84);
    const exit = win(u, 0.82, 0.98);
    uops.forEach((t, k) => {
      const [a, b] = UOP_WIN[k];
      const x = lerp(DEC_X0 + 0.2, UOP_S[k], win(u, a, b)) - 2.3 * exit;
      t.group.position.x = x;
      t.group.visible = u >= a && x >= HX0 - 1e-6;
      t.setLit(0.55 + 0.45 * hold);
    });
    armTiles.forEach((t) => t.setLit(0.15 + 0.85 * hold));
    guides.forEach((m) => (m.opacity = 0.55 * hold));
  }

  function applyJob(u) {
    const C = jobC;
    const R = jobR;
    // program tiles
    C.tiles[0].setLit(env(u, 0.06, 0.12, 0.94, 0.99));
    R.tiles[0].setLit(env(u, 0.06, 0.12, 0.38, 0.42));
    R.tiles[1].setLit(env(u, 0.4, 0.44, 0.68, 0.72));
    R.tiles[2].setLit(env(u, 0.7, 0.74, 0.94, 0.99));
    [C, R].forEach((L) => L.tiles.forEach((t) => (t.group.position.y = TOP + 0.022 * t.lit())));
    // leg 1 (0.12-0.40) read · leg 2 (0.42-0.70) add · leg 3 (0.72-0.96) write
    const t1 = clamp01((u - 0.12) / 0.28);
    const t2 = clamp01((u - 0.42) / 0.28);
    const t3 = clamp01((u - 0.72) / 0.24);
    const in1 = u >= 0.12 && u <= 0.41 ? 1 - win(u, 0.39, 0.41) : 0;
    const in3 = u >= 0.72 && u <= 0.97 ? 1 - win(u, 0.95, 0.97) : 0;
    orbC1.set(cMemAlu, t1, in1);
    orbC2.set(cEaxAlu, t1, in1);
    orbC3.set(cAluMem, t3, in3);
    // x86 ALU computes across leg 2
    const cAlu = env(u, 0.38, 0.44, 0.66, 0.72);
    C.inset.material.opacity = 0.12 + 0.75 * cAlu;
    // ARM
    const ta = clamp01((u - 0.42) / 0.14);
    const tb = clamp01((u - 0.56) / 0.14);
    const inA = u >= 0.42 && u <= 0.57 ? 1 - win(u, 0.55, 0.57) : 0;
    const inB = u >= 0.56 && u <= 0.71 ? 1 - win(u, 0.69, 0.71) : 0;
    orbR1.set(cMemW1, t1, in1);
    orbR2.set(cW1Alu, ta, inA);
    orbR3.set(cW2Alu, ta, inA);
    orbR4.set(cAluW1, tb, inB);
    orbR5.set(cW1Mem, t3, in3);
    R.inset.material.opacity = 0.12 + 0.75 * env(u, 0.52, 0.56, 0.58, 0.64);
    // memory cell x: read during leg 1, written at the end of leg 3
    const memRead = env(u, 0.08, 0.14, 0.2, 0.3);
    const memWrite = env(u, 0.9, 0.94, 0.96, 0.995);
    C.memCells[X_CELL].emissiveIntensity = 0.12 + 0.8 * Math.max(memRead, memWrite);
    R.memCells[X_CELL].emissiveIntensity = 0.12 + 0.8 * Math.max(memRead, memWrite);
    // registers
    C.regs[0].m.emissiveIntensity = 0.06 + 0.9 * env(u, 0.08, 0.14, 0.34, 0.42);
    R.regs[0].m.emissiveIntensity = 0.06 + 0.5 * Math.max(env(u, 0.08, 0.14, 0.34, 0.4), env(u, 0.68, 0.74, 0.92, 0.97));
    R.regs[1].m.emissiveIntensity = 0.06 + 0.9 * env(u, 0.36, 0.42, 0.9, 0.96);
    R.regs[2].m.emissiveIntensity = 0.06 + 0.9 * env(u, 0.38, 0.44, 0.52, 0.58);
  }

  function apply() {
    if (current === 'chips') {
      // each package turns in place, so neither ever passes in front of the other
      pkgX86.group.rotation.y = S.spin;
      pkgArm.group.rotation.y = S.spin;
      pkgX86.setLid(S.lid);
      pkgArm.setLid(S.lid);
      // with the lids off, the decoders breathe (3 whole cycles per lap)
      const b = S.lid * (0.5 + 0.5 * Math.sin(S.u * Math.PI * 2 * 3));
      pkgX86.decMatP.color.setScalar(0.7 + 0.5 * b);
      pkgArm.decMatP.color.setScalar(0.7 + 0.5 * b);
    }
    else if (current === 'tape') applyTape(S.u);
    else if (current === 'decode') applyDecode(S.u);
    else if (current === 'uops') applyUops(S.u);
    else if (current === 'job') applyJob(S.u);
  }

  const show = (g, on) => {
    if (on && g.parent !== root) root.add(g);
    else if (!on && g.parent === root) {
      root.remove(g);
      // the CSS2D renderer only hides labels it traverses; a detached one
      // would otherwise stay painted at its last position
      g.traverse((o) => {
        if (o.isCSS2DObject && o.element) o.element.style.display = 'none';
      });
    }
  };
  function setView(name) {
    current = name;
    // Inactive views are DETACHED, not just hidden: label-layout's occlusion
    // sweep tests each mesh's own .visible flag, not its ancestors', so a
    // hidden view's meshes would still dim the active view's callouts.
    show(chipsG, name === 'chips');
    show(stageG, name !== 'chips');
    show(housingG, name === 'tape' || name === 'decode' || name === 'uops');
    show(ribbonG, name === 'tape' || name === 'decode');
    show(decodeG, name === 'decode');
    show(uopG, name === 'uops');
    show(jobG, name === 'job');
    if (name === 'tape' || name === 'decode') {
      // the ribbons' lit state belongs to the decode lap only
      ribC.items.forEach((it) => it.t.setLit(0));
      ribR.items.forEach((it) => it.t.setLit(0));
    }
    apply();
  }
  setView('chips');

  return {
    group: root,
    setView,
    setLabels(which) {
      labels.setLabels(which || null);
    },
    set(partial) {
      Object.assign(S, partial);
      apply();
    },
    parts: { S, spinner, ribC, ribR, scanner, decoders, uops, jobC, jobR, groups },
  };
}
