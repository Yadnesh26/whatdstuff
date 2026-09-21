import * as THREE from 'three';
import { materials } from '../../framework/parts.js';
import { beveledBox, bladeRing } from '../../framework/geometry.js';
import { clamp01, smooth, win, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A modern discrete graphics card, product-shot staged on the stage's own
// shadow floor (no plinth — the card IS a flat slab, and standing one slab on
// another read as two stacked rectangles):
// the sealed triple-fan card, the cooler exploded off it, the board underneath,
// and then three blown-up inserts floating above the real die for the things no
// camera could ever see — the graphics pipeline, the die floorplan, and the
// inside of one streaming multiprocessor.
//
// Reference facts (RTX 4090 / AD102 class, all verified):
//  - Board: a triple-fan card is about 330 x 140 x 62 mm (three slots) and
//    weighs over 2 kg. Board power 450 W. The cooler is a nickel-plated copper
//    vapour chamber under a ~150-plate aluminium fin stack, with three ~100 mm
//    axial fans blowing down through it.
//  - Power delivery: 23 VRM phases (20 for the GPU, 3 for the memory), each
//    DrMOS rated 70 A, fed by one 16-pin 12VHPWR connector.
//  - Die: AD102, 608 mm^2 — 24.7 mm square, a fingernail — with 76.3 billion
//    transistors on TSMC 4N. Unlike a CPU the die is BARE: no heat spreader,
//    the cooler cold plate presses straight onto the silicon.
//  - Floorplan: 144 SMs on the full die (128 enabled on a 4090), grouped as 12
//    GPCs of 12, a 96 MB L2 cache band through the middle, and twelve 32-bit
//    memory controllers around the edge. 176 ROPs.
//  - One SM: 128 CUDA cores split into FOUR processing blocks of 32, one warp
//    scheduler per block, 4 fourth-gen Tensor cores, 1 third-gen RT core, 4
//    texture units, a 256 KB register file and 128 KB of L1/shared memory.
//  - SIMT: a warp is 32 threads executing ONE instruction in lockstep. If a
//    branch splits the warp, the two halves run one after the other with the
//    inactive lanes masked off — that is the divergence penalty.
//  - Latency hiding: up to 48 warps (1,536 threads) stay resident in one SM at
//    once, because every warp's registers live permanently in that 256 KB file
//    — so a warp switch costs nothing and needs no save/restore. 128 SMs x
//    1,536 is about 196,000 threads resident on the chip at any instant.
//  - Memory: 24 GB of GDDR6X as twelve 2 GB modules on a 384-bit bus (twelve
//    32-bit channels) at 21 Gbps => 1,008 GB/s, just over a terabyte a second.
//    Boost clock about 2.52 GHz.
//  - The job: 4K is 3840 x 2160 = 8.3 million pixels; at 120 fps that is a
//    billion independently-shaded pixels a second. The pipeline is vertex
//    shader -> rasteriser -> fragment shader -> ROP -> framebuffer.

// ---------------------------------------------------------------------------
// Proportions. ONE scale: 1 scene unit = 100 mm, so a 330 mm card is 3.30 units
// long, 1.40 wide and 0.62 thick — the true 2.36 : 1 : 0.44 silhouette. Every
// constant below is derived from that one scale.
// ---------------------------------------------------------------------------
const CARD_L = 3.3; // 330 mm, along X
const CARD_W = 1.4; // 140 mm, along Z
const CARD_T = 0.62; // 62 mm — three expansion slots — along Y
const CARD_Y = 0.005; // clears the stage contact-shadow plane at y = 0.002

// Card-local Y layout, 0 = the underside of the backplate
const BP_H = 0.02;
const PCB_Y = BP_H;
const PCB_H = 0.022; // 2.2 mm board
const PCB_TOP = PCB_Y + PCB_H; // 0.042
const VC_Y = 0.088; // vapour chamber underside — a 4.6 mm air gap over the board
const VC_H = 0.05;
const FIN_Y0 = 0.138;
const FIN_H = 0.452;
// 3 mm fin pitch. Real card fins run nearer 2 mm, but at that pitch the plates
// land around a pixel wide and the stack renders as moire interference rings
// rather than fins — even at full resolution. 96 thicker plates read as the
// same object and stay clean; the heatpipes threaded through them below do the
// rest, by breaking up the see-through that generates the pattern.
const FIN_N = 96;
const FIN_T = 0.01;
const FIN_PITCH = 0.031;
const FIN_X0 = -1.4725;
const SHROUD_Y = 0.592; // shroud top plate underside
const SHROUD_H = 0.028; // => card top at 0.620 = CARD_T

// The board is much shorter than the cooler — the fin stack hangs off the end
// of it, over the flow-through window in the backplate.
const PCB_L = 2.1;
const PCB_W = 1.15;
const PCB_CX = -0.35;
const PCB_CZ = -0.025; // PCB spans x [-1.40, 0.70], z [-0.60, 0.55]
const PCB_Z1 = PCB_CZ + PCB_W / 2; // +0.525, the PCIe edge — the NEAR long side
// (which edge carries the fingers is ours to choose; putting them on the side the
// hero camera looks from is what makes the callout point at something visible)

// Three 100 mm fans on a 1.06 pitch: openings of r 0.50 leave a 6 mm web
// between them and a 20 mm margin at the long edges — the real geometry.
const FAN_R = 0.5;
const FAN_PITCH = 1.06;
const FAN_X = [-FAN_PITCH, 0, FAN_PITCH];

// The GPU package, and the bare die on top of it
const PKG_CX = -0.35;
const PKG_CZ = -0.02;
const PKG_L = 0.55;
const PKG_W = 0.5;
const PKG_H = 0.018;
const PKG_TOP = PCB_TOP + PKG_H;
const DIE = 0.247; // 24.7 mm square = 608 mm^2
const DIE_H = 0.01;
const DIE_TOP = PKG_TOP + DIE_H;

// Insert altitude: the blown-up diagrams float clear of the sealed card top
// (0.62) with room for the leader lines to read.
const BENCH_Y = 0.915;

const ACCENT = 0x8f6bff;
const SM_COLOR = 0x8f6bff;
const L2_COLOR = 0x4f9fe0;
const MEM_COLOR = 0xe0a24a;
const DATA_COLOR = 0xc9b6ff;
const HOT_COLOR = 0xfff0c4;

const frac = (x) => x - Math.floor(x);
const tri = (x) => 1 - Math.abs(1 - 2 * clamp01(x));

// ---------------------------------------------------------------------------
// Small helpers
// ---------------------------------------------------------------------------

// Crisp canvas-drawn text on a thin unlit plane — silkscreen on the board,
// nameplates on the inserts. Unlit on purpose: a legend has to stay readable
// from every camera, whatever the key light is doing.
function textPlate(text, w, h, opts = {}) {
  const {
    color = '#dfe8f2',
    weight = 600,
    letter = 0,
    opacity = 1,
    align = 'center',
    font = '"Segoe UI", system-ui, sans-serif',
  } = opts;
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = Math.max(64, Math.round((1024 * h) / w));
  const ctx = canvas.getContext('2d');
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  const px = Math.round(canvas.height * 0.56);
  ctx.font = weight + ' ' + px + 'px ' + font;
  ctx.fillStyle = color;
  ctx.textAlign = align;
  ctx.textBaseline = 'middle';
  if (letter && ctx.letterSpacing !== undefined) ctx.letterSpacing = letter + 'px';
  ctx.fillText(text, align === 'center' ? canvas.width / 2 : 12, canvas.height / 2);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshBasicMaterial({
    map: tex,
    transparent: true,
    opacity,
    depthWrite: false,
    toneMapped: false,
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  mesh.renderOrder = 3;
  return mesh;
}

// A grid of small indicator cells as ONE InstancedMesh, brightness driven per
// cell through instanceColor. This is the only practical way to run 240
// independently-lit pixels (or 128 lanes, or 144 SM tiles) at 60 fps: a
// per-cell material would mean a per-cell draw call, and instanceColor is the
// one channel that varies per instance without a custom shader. Values above
// 1.0 are legal and are what the stage bloom picks up as a glow.
function cellGrid({ cols, rows, cw, ch, gap = 0.006, depth = 0.012, plane = 'xy' }) {
  const geo = new THREE.BoxGeometry(cw, ch, depth);
  const mat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true });
  const mesh = new THREE.InstancedMesh(geo, mat, cols * rows);
  mesh.castShadow = false;
  mesh.receiveShadow = false;
  const pitchX = cw + gap;
  const pitchY = ch + gap;
  const w = cols * pitchX - gap;
  const h = rows * pitchY - gap;
  const dummy = new THREE.Object3D();
  const centres = [];
  for (let j = 0; j < rows; j++) {
    for (let i = 0; i < cols; i++) {
      const x = -w / 2 + cw / 2 + i * pitchX;
      const y = -h / 2 + ch / 2 + j * pitchY;
      if (plane === 'xz') {
        dummy.position.set(x, 0, -y);
        dummy.rotation.set(-Math.PI / 2, 0, 0);
      } else {
        dummy.position.set(x, y, 0);
        dummy.rotation.set(0, 0, 0);
      }
      dummy.updateMatrix();
      mesh.setMatrixAt(j * cols + i, dummy.matrix);
      centres.push([(i + 0.5) / cols, (j + 0.5) / rows]);
    }
  }
  mesh.instanceMatrix.needsUpdate = true;
  const scratch = new THREE.Color();
  for (let k = 0; k < cols * rows; k++) mesh.setColorAt(k, scratch.setRGB(0.06, 0.07, 0.09));
  const set = (k, r, g, b) => mesh.setColorAt(k, scratch.setRGB(r, g, b));
  const flush = () => {
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  };
  return { mesh, set, flush, centres, count: cols * rows, cols, rows, w, h };
}

function dotMesh(radius, color, intensity = 1.4) {
  const mat = materials.glow(color, intensity);
  mat.transparent = true;
  mat.opacity = 0;
  mat.depthWrite = false;
  const m = new THREE.Mesh(new THREE.SphereGeometry(radius, 12, 10), mat);
  m.castShadow = false;
  return m;
}

// A flat emissive block — floorplan tiles, VRM phase pips, legend slabs.
function emissivePlate(w, h, d, color, intensity = 0.5) {
  const mat = new THREE.MeshStandardMaterial({
    color: 0x11151a,
    emissive: color,
    emissiveIntensity: intensity,
    metalness: 0.2,
    roughness: 0.45,
  });
  const mesh = beveledBox(w, h, d, mat, Math.min(0.004, w / 4, h / 4, d / 4));
  mesh.castShadow = false;
  return mesh;
}

// Thin glowing trace between two board points, arced just clear of the PCB.
function traceCurve(from, to, lift) {
  const mid = from.clone().lerp(to, 0.5);
  mid.y += lift;
  return new THREE.CatmullRomCurve3([from.clone(), mid, to.clone()]);
}

// ---------------------------------------------------------------------------
export function buildGpu({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  const spinGroup = new THREE.Group();
  group.add(spinGroup);

  const cardGroup = new THREE.Group();
  cardGroup.position.y = CARD_Y;
  spinGroup.add(cardGroup);

  // =========================================================================
  // Backplate — with the flow-through window every long card now has
  // =========================================================================
  const backGroup = new THREE.Group();
  cardGroup.add(backGroup);
  const backMat = materials.brushedSteel(0x8f959d);
  backMat.roughness = 0.58;
  const backplate = beveledBox(2.28, BP_H, CARD_W - 0.04, backMat, 0.008);
  backplate.position.set(-CARD_L / 2 + 1.14 + 0.02, BP_H / 2, 0);
  backGroup.add(backplate);
  // the open window under the overhanging fin stack: just a narrow rail
  const backRail = beveledBox(0.98, BP_H, 0.14, backMat, 0.008);
  backRail.position.set(1.14, BP_H / 2, CARD_W / 2 - 0.09);
  backGroup.add(backRail);
  const backEtch = textPlate('GEFORCE  ·  24 GB GDDR6X', 0.86, 0.075, {
    color: '#6f7681',
    weight: 700,
    opacity: 0.75,
  });
  backEtch.rotation.x = Math.PI / 2;
  backEtch.position.set(-0.7, 0.0005, 0.42);
  backGroup.add(backEtch);

  // =========================================================================
  // The board
  // =========================================================================
  const boardGroup = new THREE.Group();
  cardGroup.add(boardGroup);

  const pcbMat = materials.plastic(0x0e2a1c);
  pcbMat.roughness = 0.62;
  const pcb = beveledBox(PCB_L, PCB_H, PCB_W, pcbMat, 0.006);
  pcb.position.set(PCB_CX, PCB_Y + PCB_H / 2, PCB_CZ);
  pcb.receiveShadow = true;
  boardGroup.add(pcb);

  // --- the PCIe x16 edge connector: 82 gold fingers in an 11 + 71 split,
  // the notch between them the key that stops the card going in backwards
  const fingerTab = beveledBox(0.89, PCB_H, 0.12, pcbMat, 0.004);
  fingerTab.position.set(-0.855, PCB_Y + PCB_H / 2, PCB_Z1 + 0.055);
  boardGroup.add(fingerTab);
  const goldMat = new THREE.MeshStandardMaterial({
    color: 0xd9b258,
    metalness: 1,
    roughness: 0.34,
  });
  const FINGER_A = 11;
  const FINGER_B = 71;
  const fingerXs = [];
  for (let i = 0; i < FINGER_A; i++) fingerXs.push(-1.29 + i * 0.0102);
  for (let i = 0; i < FINGER_B; i++) fingerXs.push(-1.155 + i * 0.0102);
  const fingers = new THREE.InstancedMesh(
    new THREE.BoxGeometry(0.0062, 0.0012, 0.086),
    goldMat,
    fingerXs.length,
  );
  fingers.castShadow = false;
  {
    const d = new THREE.Object3D();
    fingerXs.forEach((x, k) => {
      d.position.set(x, PCB_TOP + 0.0006, PCB_Z1 + 0.05);
      d.updateMatrix();
      fingers.setMatrixAt(k, d.matrix);
    });
    fingers.instanceMatrix.needsUpdate = true;
  }
  boardGroup.add(fingers);

  // =========================================================================
  // The GPU package and its bare die
  // =========================================================================
  const pkgGroup = new THREE.Group();
  boardGroup.add(pkgGroup);
  const substrateMat = materials.plastic(0x1b2b22);
  substrateMat.roughness = 0.58;
  const substrate = beveledBox(PKG_L, PKG_H, PKG_W, substrateMat, 0.004);
  substrate.position.set(PKG_CX, PCB_TOP + PKG_H / 2, PKG_CZ);
  pkgGroup.add(substrate);

  // No lid. On a graphics card the silicon is bare — the cold plate lands on
  // it directly — which is why you can read the floorplan straight off it.
  const siliconMat = new THREE.MeshStandardMaterial({
    color: 0x252b34,
    metalness: 0.55,
    roughness: 0.18,
  });
  const die = beveledBox(DIE, DIE_H, DIE, siliconMat, 0.003);
  die.position.set(PKG_CX, PKG_TOP + DIE_H / 2, PKG_CZ);
  pkgGroup.add(die);

  // the real-scale floorplan, etched onto the real die: two rows of six GPCs
  // either side of the L2 band, memory controllers along both edges
  const dieFloor = new THREE.Group();
  dieFloor.position.set(PKG_CX, DIE_TOP + 0.0008, PKG_CZ);
  pkgGroup.add(dieFloor);
  const dieGpcMats = [];
  for (let r = 0; r < 2; r++) {
    for (let c = 0; c < 6; c++) {
      const tile = emissivePlate(0.0325, 0.0016, 0.074, SM_COLOR, 0.16);
      tile.position.set(-0.1 + c * 0.04, 0, (r ? 1 : -1) * 0.055);
      dieFloor.add(tile);
      dieGpcMats.push(tile.material);
    }
  }
  const dieL2 = emissivePlate(0.222, 0.0016, 0.05, L2_COLOR, 0.18);
  dieFloor.add(dieL2);
  const dieMcMats = [];
  for (let s = 0; s < 2; s++) {
    for (let c = 0; c < 6; c++) {
      const mc = emissivePlate(0.031, 0.0016, 0.018, MEM_COLOR, 0.18);
      mc.position.set(-0.1 + c * 0.04, 0, (s ? 1 : -1) * 0.108);
      dieFloor.add(mc);
      dieMcMats.push(mc.material);
    }
  }

  // =========================================================================
  // Twelve GDDR6X modules, ringing the package on all four sides
  // =========================================================================
  const memMat = materials.plastic(0x101318);
  memMat.roughness = 0.5;
  const MEM_POS = [
    [-0.72, 0.34],
    [-0.5, 0.34],
    [-0.28, 0.34],
    [-0.06, 0.34],
    [-0.72, -0.38],
    [-0.5, -0.38],
    [-0.28, -0.38],
    [-0.06, -0.38],
    [-0.8, -0.16],
    [-0.8, 0.1],
    [0.1, -0.16],
    [0.1, 0.1],
  ];
  const memModules = [];
  for (const [mx, mz] of MEM_POS) {
    const m = beveledBox(0.14, 0.014, 0.12, memMat, 0.003);
    m.position.set(mx, PCB_TOP + 0.007, mz);
    boardGroup.add(m);
    memModules.push(m);
  }

  // =========================================================================
  // 23 VRM phases along the far edge of the board — 20 for the GPU, 3 for
  // the memory — each an inductor with its DrMOS stage beside it
  // =========================================================================
  const chokeMat = materials.darkMetal(0x2b2f36);
  const vrmPips = [];
  const vrmChokes = [];
  const vrmCols = [
    { x: 0.36, n: 12, z0: -0.5, dz: 0.086 },
    { x: 0.54, n: 11, z0: -0.46, dz: 0.092 },
  ];
  for (const col of vrmCols) {
    for (let i = 0; i < col.n; i++) {
      const z = col.z0 + i * col.dz;
      const choke = beveledBox(0.058, 0.03, 0.05, chokeMat, 0.006);
      choke.position.set(col.x, PCB_TOP + 0.015, z);
      boardGroup.add(choke);
      vrmChokes.push(choke);
      const pip = emissivePlate(0.03, 0.006, 0.042, HOT_COLOR, 0.1);
      pip.position.set(col.x + 0.055, PCB_TOP + 0.003, z);
      boardGroup.add(pip);
      vrmPips.push(pip.material);
    }
  }

  // the 16-pin connector — 450 watts down one plug
  const powerBody = beveledBox(0.24, 0.055, 0.1, materials.plastic(0x14171c), 0.006);
  powerBody.position.set(0.2, PCB_TOP + 0.0275, -0.47);
  boardGroup.add(powerBody);
  const powerInner = beveledBox(0.21, 0.03, 0.06, materials.plastic(0x2a2f38), 0.004);
  powerInner.position.set(0.2, PCB_TOP + 0.032, -0.487);
  boardGroup.add(powerInner);

  // smoothing capacitors scattered around the package
  const capMat = materials.plastic(0x15181d);
  capMat.roughness = 0.5;
  for (let i = 0; i < 26; i++) {
    const a = (i / 26) * TAU;
    const rr = 0.33 + (i % 3) * 0.022;
    const cap = beveledBox(0.03, 0.012, 0.018, capMat, 0.003);
    cap.position.set(PKG_CX + Math.cos(a) * rr, PCB_TOP + 0.006, PKG_CZ + Math.sin(a) * rr * 0.8);
    cap.rotation.y = a;
    cap.castShadow = false;
    boardGroup.add(cap);
  }

  const boardEtch = textPlate('PG139  ·  REV A1', 0.34, 0.045, {
    color: '#9db4a6',
    weight: 600,
    opacity: 0.5,
  });
  boardEtch.rotation.x = -Math.PI / 2;
  boardEtch.position.set(-1.2, PCB_TOP + 0.0012, -0.42);
  boardGroup.add(boardEtch);

  // =========================================================================
  // The I/O bracket
  // =========================================================================
  const bracketGroup = new THREE.Group();
  cardGroup.add(bracketGroup);
  // the bracket is a big flat plate square-on to the key light: at 0.4 it blew
  // out to a white wall beside the board in every step that shows the board
  const bracketMat = materials.brushedSteel(0x767d86);
  bracketMat.roughness = 0.62;
  // A real bracket is a PERFORATED plate, and it has to be one here: modelled
  // solid, its blank inner face read as a bright featureless wall standing
  // beside the board in every step that shows the board. The vents and the port
  // openings are real holes cut through the extrusion, so the scene behind it
  // shows through and it reads as sheet metal instead of a slab.
  const BR_Y0 = 0.02;
  const BR_Y1 = 0.58;
  const rectHole = (cz, cy, w, h) => {
    const path = new THREE.Path();
    path.moveTo(cz - w / 2, cy - h / 2);
    path.lineTo(cz + w / 2, cy - h / 2);
    path.lineTo(cz + w / 2, cy + h / 2);
    path.lineTo(cz - w / 2, cy + h / 2);
    path.closePath();
    return path;
  };
  const PORTS = [
    [-0.44, 0.161],
    [-0.21, 0.161],
    [0.02, 0.161],
    [0.27, 0.2],
  ];
  // drawn in the shape plane as (z, y), then stood up so the extrusion runs
  // along X — rotateY(-PI/2) rather than +PI/2, which would mirror Z and put
  // every port on the wrong side of the bracket
  const brShape = new THREE.Shape();
  brShape.moveTo(-0.6, BR_Y0);
  brShape.lineTo(0.6, BR_Y0);
  brShape.lineTo(0.6, BR_Y1);
  brShape.lineTo(-0.6, BR_Y1);
  brShape.closePath();
  for (const [pz, pw] of PORTS) brShape.holes.push(rectHole(pz, 0.22, pw, 0.05));
  for (let r = 0; r < 3; r++) {
    for (let c = 0; c < 9; c++) {
      brShape.holes.push(rectHole(-0.4 + c * 0.1, 0.37 + r * 0.06, 0.062, 0.026));
    }
  }
  const brGeo = new THREE.ExtrudeGeometry(brShape, {
    depth: 0.024,
    bevelEnabled: true,
    bevelThickness: 0.002,
    bevelSize: 0.002,
    bevelSegments: 1,
    curveSegments: 1,
  });
  brGeo.rotateY(-Math.PI / 2);
  const bracket = new THREE.Mesh(brGeo, bracketMat);
  bracket.position.set(-CARD_L / 2, 0, 0);
  bracket.castShadow = true;
  bracketGroup.add(bracket);
  const portMat = materials.plastic(0x0c0e12);
  PORTS.forEach(([pz, pw], i) => {
    const shell = beveledBox(0.03, 0.05, pw, portMat, 0.005);
    shell.position.set(-CARD_L / 2 - 0.016, 0.22, pz);
    bracketGroup.add(shell);
    const tag = textPlate(i === 3 ? 'HDMI' : 'DP', 0.1, 0.032, {
      color: '#7d8590',
      weight: 700,
      opacity: 0.8,
    });
    tag.rotation.y = -Math.PI / 2;
    tag.position.set(-CARD_L / 2 - 0.03, 0.16, pz);
    bracketGroup.add(tag);
  });

  // =========================================================================
  // The cooler: vapour chamber, fin stack, shroud, three fans
  // =========================================================================
  const vaporGroup = new THREE.Group();
  cardGroup.add(vaporGroup);
  // same trap, worse: a 3 x 1.26 mirror right under the key smeared a white
  // flare across the middle of the exploded shot
  const vaporMat = materials.brushedSteel(0xa8adb5);
  vaporMat.roughness = 0.78;
  const vapor = beveledBox(3.05, VC_H, 1.26, vaporMat, 0.012);
  vapor.position.set(0, VC_Y + VC_H / 2, 0);
  vaporGroup.add(vapor);
  // the cold plate: the raised pad that lands on the bare die
  const coldPlate = beveledBox(0.34, 0.026, 0.32, vaporMat, 0.006);
  coldPlate.position.set(PKG_CX, VC_Y - 0.013, PKG_CZ);
  vaporGroup.add(coldPlate);

  const finGroup = new THREE.Group();
  cardGroup.add(finGroup);
  const finMat = materials.aluminum(0xc2c8d0);
  finMat.roughness = 0.68;
  const fins = new THREE.InstancedMesh(
    new THREE.BoxGeometry(FIN_T, FIN_H, 1.24),
    finMat,
    FIN_N,
  );
  fins.castShadow = true;
  {
    const d = new THREE.Object3D();
    for (let i = 0; i < FIN_N; i++) {
      d.position.set(FIN_X0 + i * FIN_PITCH, FIN_Y0 + FIN_H / 2, 0);
      d.updateMatrix();
      fins.setMatrixAt(i, d.matrix);
    }
    fins.instanceMatrix.needsUpdate = true;
  }
  finGroup.add(fins);
  // six copper heatpipes threaded through the stack, as the real cooler has —
  // they carry heat out to the far end of the fins, and they give the stack an
  // interior instead of a see-through lattice
  const pipeMat = materials.aluminum(0xc08a55);
  pipeMat.roughness = 0.5;
  const pipeGeo = new THREE.CylinderGeometry(0.028, 0.028, 2.92, 18);
  pipeGeo.rotateZ(Math.PI / 2);
  for (const py of [FIN_Y0 + 0.11, FIN_Y0 + 0.29]) {
    for (const pz of [-0.38, 0, 0.38]) {
      const hp = new THREE.Mesh(pipeGeo, pipeMat);
      hp.position.set(-0.02, py, pz);
      hp.castShadow = true;
      finGroup.add(hp);
    }
  }

  const shroudGroup = new THREE.Group();
  cardGroup.add(shroudGroup);
  const shroudMat = materials.polymer(0x2b2f36);
  // the top plate: one rounded rectangle with three fan openings cut clean
  // through it — a real hole, not a disc a blade would pass through
  const shroudShape = new THREE.Shape();
  {
    const hx = CARD_L / 2;
    const hy = CARD_W / 2;
    const rr = 0.07;
    shroudShape.moveTo(-hx + rr, -hy);
    shroudShape.lineTo(hx - rr, -hy);
    shroudShape.absarc(hx - rr, -hy + rr, rr, -Math.PI / 2, 0, false);
    shroudShape.lineTo(hx, hy - rr);
    shroudShape.absarc(hx - rr, hy - rr, rr, 0, Math.PI / 2, false);
    shroudShape.lineTo(-hx + rr, hy);
    shroudShape.absarc(-hx + rr, hy - rr, rr, Math.PI / 2, Math.PI, false);
    shroudShape.lineTo(-hx, -hy + rr);
    shroudShape.absarc(-hx + rr, -hy + rr, rr, Math.PI, Math.PI * 1.5, false);
    for (const fx of FAN_X) {
      const hole = new THREE.Path();
      hole.absarc(fx, 0, FAN_R, 0, TAU, true);
      shroudShape.holes.push(hole);
    }
  }
  const shroudGeo = new THREE.ExtrudeGeometry(shroudShape, {
    depth: SHROUD_H - 0.008,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 2,
    curveSegments: 24,
  });
  shroudGeo.rotateX(-Math.PI / 2);
  shroudGeo.translate(0, SHROUD_Y + SHROUD_H, 0);
  const shroudTop = new THREE.Mesh(shroudGeo, shroudMat);
  shroudTop.castShadow = true;
  shroudGroup.add(shroudTop);
  // end caps and the two top rails, leaving the fin stack open along the long
  // edges exactly as a real card does
  for (const ex of [-1, 1]) {
    const cap = beveledBox(0.03, 0.5, CARD_W - 0.02, shroudMat, 0.008);
    cap.position.set((ex * (CARD_L - 0.03)) / 2, SHROUD_Y - 0.24, 0);
    shroudGroup.add(cap);
  }
  for (const ez of [-1, 1]) {
    const rail = beveledBox(CARD_L - 0.06, 0.11, 0.03, shroudMat, 0.008);
    rail.position.set(0, SHROUD_Y - 0.05, (ez * (CARD_W - 0.03)) / 2);
    shroudGroup.add(rail);
  }

  // three axial fans
  const fanBladeMat = materials.polymer(0x3a4049);
  const fanHubMat = materials.polymer(0x191c21);
  const fanSpinners = [];
  for (const fx of FAN_X) {
    const fanRoot = new THREE.Group();
    fanRoot.position.set(fx, SHROUD_Y - 0.012, 0);
    shroudGroup.add(fanRoot);
    // bladeRing builds its ring in the XY plane with the axis along +Z, so the
    // tilt group lays it flat and the ring itself spins on its own local Z
    const tilt = new THREE.Group();
    tilt.rotation.x = -Math.PI / 2;
    fanRoot.add(tilt);
    const ring = bladeRing(
      {
        blades: 9,
        hubR: 0.155,
        span: 0.325,
        chord: 0.3,
        chordTip: 0.24,
        camber: 0.1,
        twist: 0.55,
        twistTip: 0.22,
      },
      fanBladeMat,
    );
    tilt.add(ring.group);
    fanSpinners.push(ring.group);
    const hub = beveledBox(0.3, 0.055, 0.3, fanHubMat, 0.06);
    hub.position.y = 0.012;
    fanRoot.add(hub);
    const hubCap = textPlate('', 0.2, 0.2, {});
    hubCap.visible = false;
    fanRoot.add(hubCap);
  }

  // =========================================================================
  // Blown-up inserts. Everything from here up is a real object at true scale;
  // everything below is a DIAGRAM, floating above the die it belongs to and
  // tied to it by hairlines, because none of it is visible at any magnification
  // a camera can reach. All three stand upright facing +Z, so the step cameras
  // that use them pin `spin` to 0.
  // =========================================================================

  // Arbitrary-position sibling of cellGrid, for layouts that are grouped rather
  // than a plain lattice (the 144 SM tiles sit in twelve blocks of twelve).
  function cellSet(positions, w, h, d) {
    const mesh = new THREE.InstancedMesh(
      new THREE.BoxGeometry(w, h, d),
      new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: true }),
      positions.length,
    );
    mesh.castShadow = false;
    const dummy = new THREE.Object3D();
    positions.forEach((p, k) => {
      dummy.position.set(p[0], p[1], p[2]);
      dummy.updateMatrix();
      mesh.setMatrixAt(k, dummy.matrix);
    });
    mesh.instanceMatrix.needsUpdate = true;
    const scratch = new THREE.Color();
    for (let k = 0; k < positions.length; k++) mesh.setColorAt(k, scratch.setRGB(0.07, 0.08, 0.1));
    return {
      mesh,
      set: (k, r, g, b) => mesh.setColorAt(k, scratch.setRGB(r, g, b)),
      flush: () => {
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
      },
    };
  }

  const insertBackMat = materials.plastic(0x171b21);
  insertBackMat.roughness = 0.66;

  // -------------------------------------------------------------------------
  // Insert A — the die floorplan: 12 GPCs of 12 SMs around the L2 band
  // -------------------------------------------------------------------------
  const dieInsert = new THREE.Group();
  dieInsert.position.set(0, BENCH_Y, 0);
  spinGroup.add(dieInsert);

  const dieBack = beveledBox(2.3, 1.4, 0.05, insertBackMat, 0.02);
  dieBack.position.set(0, 0.7, -0.04);
  dieInsert.add(dieBack);
  const dieSilicon = beveledBox(2.22, 1.32, 0.02, siliconMat.clone(), 0.012);
  dieSilicon.position.set(0, 0.7, -0.02);
  dieInsert.add(dieSilicon);

  const GPC_CX = [-0.85, -0.51, -0.17, 0.17, 0.51, 0.85];
  const GPC_CY = [0.33, 1.07]; // the two rows, either side of the L2 band
  const smTilePos = [];
  const smTileGpc = [];
  for (let row = 0; row < 2; row++) {
    for (let g = 0; g < 6; g++) {
      for (let c = 0; c < 3; c++) {
        for (let r = 0; r < 4; r++) {
          smTilePos.push([
            GPC_CX[g] - 0.1 + c * 0.1,
            GPC_CY[row] - 0.1575 + r * 0.105,
            0.018,
          ]);
          smTileGpc.push(row * 6 + g);
        }
      }
    }
  }
  const smTiles = cellSet(smTilePos, 0.092, 0.092, 0.014);
  dieInsert.add(smTiles.mesh);
  // a dim carrier plate behind each GPC so the twelve tiles read as one block
  const gpcPlates = [];
  for (let row = 0; row < 2; row++) {
    for (let g = 0; g < 6; g++) {
      const p = emissivePlate(0.325, 0.44, 0.012, SM_COLOR, 0.12);
      p.position.set(GPC_CX[g], GPC_CY[row], 0.004);
      dieInsert.add(p);
      gpcPlates.push(p.material);
    }
  }

  const l2Band = emissivePlate(2.06, 0.24, 0.016, L2_COLOR, 0.3);
  l2Band.position.set(0, 0.7, 0.01);
  dieInsert.add(l2Band);
  const l2Tag = textPlate('L2 CACHE  ·  96 MB', 0.78, 0.06, {
    color: '#cfe4fb',
    weight: 700,
    letter: 2,
    opacity: 0.95,
  });
  l2Tag.position.set(0, 0.7, 0.022);
  dieInsert.add(l2Tag);

  const insertMcMats = [];
  for (let s = 0; s < 2; s++) {
    for (let c = 0; c < 6; c++) {
      const mc = emissivePlate(0.3, 0.05, 0.014, MEM_COLOR, 0.26);
      mc.position.set(GPC_CX[c], s ? 1.345 : 0.055, 0.012);
      dieInsert.add(mc);
      insertMcMats.push(mc.material);
    }
  }

  // traffic riding the L2 band — the die floorplan needs something that
  // actually MOVES, or the step reads as a still diagram however brightly the
  // tiles pulse (and verify's pose probe, which hashes transforms, agrees)
  const l2Dots = [];
  for (let i = 0; i < 5; i++) {
    const d = dotMesh(0.024, i % 2 ? DATA_COLOR : 0x9fd8ff, 1.5);
    dieInsert.add(d);
    l2Dots.push(d);
  }

  const dieInsertTag = textPlate('THE DIE, ABOUT 90x LIFE SIZE', 0.96, 0.055, {
    color: '#8d96a4',
    weight: 600,
    letter: 2,
    opacity: 0.8,
  });
  dieInsertTag.position.set(0.62, -0.09, 0.02);
  dieInsert.add(dieInsertTag);

  // -------------------------------------------------------------------------
  // Insert B — the graphics pipeline: one triangle becoming pixels
  // -------------------------------------------------------------------------
  const pipeBench = new THREE.Group();
  pipeBench.position.set(0, BENCH_Y, 0);
  spinGroup.add(pipeBench);

  const PIPE_NAMES = ['Vertices', 'Rasterise', 'Shade', 'Output'];
  const PIPE_X = [-0.93, -0.31, 0.31, 0.93];
  const pipeRailMat = materials.brushedSteel(0x8f979f);
  pipeRailMat.roughness = 0.5;
  const pipeRail = beveledBox(2.36, 0.045, 0.11, pipeRailMat, 0.014);
  pipeRail.position.set(0, 0.02, 0);
  pipeBench.add(pipeRail);

  const pipeStationMats = [];
  PIPE_X.forEach((sx, i) => {
    const body = beveledBox(0.42, 0.2, 0.28, materials.polymer(0x232830), 0.018);
    body.position.set(sx, 0.145, 0);
    pipeBench.add(body);
    const topMat = new THREE.MeshStandardMaterial({
      color: 0x11151a,
      emissive: ACCENT,
      emissiveIntensity: 0.3,
      metalness: 0.2,
      roughness: 0.4,
    });
    const top = beveledBox(0.37, 0.014, 0.23, topMat, 0.004);
    top.position.set(sx, 0.252, 0);
    top.castShadow = false;
    pipeBench.add(top);
    pipeStationMats.push(topMat);
    const plate = textPlate(PIPE_NAMES[i], 0.34, 0.075, { color: '#e2edf5', weight: 600 });
    plate.position.set(sx, 0.135, 0.145);
    pipeBench.add(plate);
  });

  // the screen: a 20 x 12 framebuffer tile, every cell shaded on its own
  const SCREEN_Y = 1.0;
  const fb = cellGrid({ cols: 20, rows: 12, cw: 0.07, ch: 0.07, gap: 0.006, depth: 0.014 });
  fb.mesh.position.set(0, SCREEN_Y, 0.03);
  pipeBench.add(fb.mesh);
  const fbFrame = beveledBox(fb.w + 0.09, fb.h + 0.09, 0.03, insertBackMat, 0.016);
  fbFrame.position.set(0, SCREEN_Y, 0);
  pipeBench.add(fbFrame);
  const fbTag = textPlate('ONE TILE OF THE FRAMEBUFFER', 0.86, 0.05, {
    color: '#8d96a4',
    weight: 600,
    letter: 2,
    opacity: 0.85,
  });
  fbTag.position.set(0.32, SCREEN_Y - fb.h / 2 - 0.075, 0.03);
  pipeBench.add(fbTag);

  // the triangle, in screen-space (u, v) over that tile
  const TRI_UV = [
    [0.2, 0.86],
    [0.82, 0.6],
    [0.46, 0.1],
  ];
  const TRI_RGB = [
    [1.0, 0.36, 0.42],
    [0.58, 0.44, 1.0],
    [0.36, 0.86, 1.0],
  ];
  const uvToLocal = (u, v) =>
    new THREE.Vector3((u - 0.5) * fb.w, SCREEN_Y + (v - 0.5) * fb.h, 0.05);
  // where the vertices sit BEFORE the vertex shader projects them: the same
  // triangle, but out in 3D space at three different depths
  const TRI_WORLD_OFF = [
    [-0.12, 0.07, 0.36],
    [0.13, -0.03, 0.15],
    [-0.02, -0.11, 0.48],
  ];
  const triFrom = TRI_UV.map((uv, i) => {
    const p = uvToLocal(uv[0], uv[1]);
    return new THREE.Vector3(
      p.x + TRI_WORLD_OFF[i][0],
      p.y + TRI_WORLD_OFF[i][1],
      p.z + TRI_WORLD_OFF[i][2],
    );
  });
  const triTo = TRI_UV.map((uv) => uvToLocal(uv[0], uv[1]));

  const triDots = TRI_RGB.map((rgb) => {
    const d = dotMesh(0.032, new THREE.Color(rgb[0], rgb[1], rgb[2]).getHex(), 1.5);
    pipeBench.add(d);
    return d;
  });
  const X_AXIS = new THREE.Vector3(1, 0, 0);
  const triEdges = [0, 1, 2].map(() => {
    const mat = materials.glow(0xdfe6ff, 0.9);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    // a unit-length rod along +X, re-aimed every frame from its two endpoints:
    // a transform, never a geometry rebuild
    const m = new THREE.Mesh(new THREE.BoxGeometry(1, 0.012, 0.012), mat);
    m.castShadow = false;
    pipeBench.add(m);
    return m;
  });

  // coverage + barycentric weights, worked out once at build time
  const fbCover = new Float32Array(fb.count * 3);
  const fbInside = new Uint8Array(fb.count);
  {
    const [ax, ay] = TRI_UV[0];
    const [bx, by] = TRI_UV[1];
    const [cx, cy] = TRI_UV[2];
    // Barycentric weights are affine-invariant, so they can be solved straight
    // in normalised (u, v) space — the tile's 1.67 : 1 aspect stretches the
    // triangle and its coverage identically, and needs no correction here.
    const den = (by - cy) * (ax - cx) + (cx - bx) * (ay - cy);
    fb.centres.forEach(([u, v], k) => {
      const w0 = ((by - cy) * (u - cx) + (cx - bx) * (v - cy)) / den;
      const w1 = ((cy - ay) * (u - cx) + (ax - cx) * (v - cy)) / den;
      const w2 = 1 - w0 - w1;
      fbInside[k] = w0 >= -0.02 && w1 >= -0.02 && w2 >= -0.02 ? 1 : 0;
      fbCover[k * 3] = clamp01(w0);
      fbCover[k * 3 + 1] = clamp01(w1);
      fbCover[k * 3 + 2] = clamp01(w2);
    });
  }

  // -------------------------------------------------------------------------
  // Insert C — inside one SM
  // -------------------------------------------------------------------------
  const smBench = new THREE.Group();
  smBench.position.set(0, BENCH_Y, 0);
  spinGroup.add(smBench);

  const smBack = beveledBox(2.18, 1.36, 0.05, insertBackMat, 0.022);
  smBack.position.set(0, 0.7, -0.045);
  smBench.add(smBack);
  const smTitle = textPlate('ONE STREAMING MULTIPROCESSOR', 1.02, 0.055, {
    color: '#9aa3b2',
    weight: 700,
    letter: 2,
    opacity: 0.9,
  });
  smTitle.position.set(0.0, 1.33, -0.01);
  smBench.add(smTitle);

  // the register file — 48 warp slots, the reason a warp switch is free
  const regFrame = beveledBox(0.31, 0.86, 0.06, materials.polymer(0x1d222a), 0.014);
  regFrame.position.set(-0.86, 0.7, -0.005);
  smBench.add(regFrame);
  const regGrid = cellGrid({ cols: 4, rows: 12, cw: 0.055, ch: 0.055, gap: 0.007, depth: 0.014 });
  regGrid.mesh.position.set(-0.86, 0.72, 0.035);
  smBench.add(regGrid.mesh);
  const regTag = textPlate('256 KB REGISTER FILE', 0.34, 0.042, {
    color: '#b9c3d2',
    weight: 700,
    letter: 1,
    opacity: 0.95,
  });
  regTag.position.set(-0.86, 1.18, 0.035);
  smBench.add(regTag);

  // four processing blocks of 32 lanes, each with its own warp scheduler
  const BLOCK_X = [-0.34, 0.0, 0.34, 0.68];
  const laneGrids = [];
  const schedMats = [];
  BLOCK_X.forEach((bx, i) => {
    const frame = beveledBox(0.3, 0.78, 0.05, materials.polymer(0x1d222a), 0.012);
    frame.position.set(bx, 0.66, -0.01);
    smBench.add(frame);
    const schedMat = new THREE.MeshStandardMaterial({
      color: 0x11151a,
      emissive: HOT_COLOR,
      emissiveIntensity: 0.16,
      metalness: 0.2,
      roughness: 0.4,
    });
    const sched = beveledBox(0.26, 0.05, 0.016, schedMat, 0.004);
    sched.position.set(bx, 0.98, 0.03);
    sched.castShadow = false;
    smBench.add(sched);
    schedMats.push(schedMat);
    const lanes = cellGrid({ cols: 4, rows: 8, cw: 0.055, ch: 0.055, gap: 0.008, depth: 0.014 });
    lanes.mesh.position.set(bx, 0.63, 0.03);
    smBench.add(lanes.mesh);
    laneGrids.push(lanes);
    if (i === 0) {
      const t = textPlate('32 LANES', 0.2, 0.036, {
        color: '#aab4c4',
        weight: 700,
        letter: 1,
        opacity: 0.9,
      });
      t.position.set(bx, 0.29, 0.03);
      smBench.add(t);
    }
  });
  const schedTag = textPlate('WARP SCHEDULER  x4', 0.42, 0.04, {
    color: '#ffe6b4',
    weight: 700,
    letter: 1,
    opacity: 0.95,
  });
  schedTag.position.set(0.17, 1.06, 0.03);
  smBench.add(schedTag);

  // L1 / shared memory along the bottom, and the fixed-function blocks
  const l1Mat = new THREE.MeshStandardMaterial({
    color: 0x11151a,
    emissive: L2_COLOR,
    emissiveIntensity: 0.22,
    metalness: 0.2,
    roughness: 0.42,
  });
  const l1Slab = beveledBox(1.2, 0.11, 0.05, l1Mat, 0.012);
  l1Slab.position.set(0.17, 0.15, 0.02);
  l1Slab.castShadow = false;
  smBench.add(l1Slab);
  const l1Tag = textPlate('128 KB L1 / SHARED MEMORY', 0.68, 0.04, {
    color: '#cfe4fb',
    weight: 700,
    letter: 1,
    opacity: 0.95,
  });
  l1Tag.position.set(0.17, 0.15, 0.048);
  smBench.add(l1Tag);

  const tensorMat = new THREE.MeshStandardMaterial({
    color: 0x11151a,
    emissive: 0x5ec8a0,
    emissiveIntensity: 0.22,
    metalness: 0.2,
    roughness: 0.42,
  });
  const tensorBlock = beveledBox(0.17, 0.26, 0.05, tensorMat, 0.01);
  tensorBlock.position.set(0.95, 0.82, 0.0);
  tensorBlock.castShadow = false;
  smBench.add(tensorBlock);
  const tensorTag = textPlate('4x TENSOR', 0.15, 0.03, {
    color: '#bdf0dc',
    weight: 700,
    opacity: 0.95,
  });
  tensorTag.position.set(0.95, 0.82, 0.03);
  smBench.add(tensorTag);
  const rtMat = new THREE.MeshStandardMaterial({
    color: 0x11151a,
    emissive: 0xe0a24a,
    emissiveIntensity: 0.22,
    metalness: 0.2,
    roughness: 0.42,
  });
  const rtBlock = beveledBox(0.17, 0.26, 0.05, rtMat, 0.01);
  rtBlock.position.set(0.95, 0.5, 0.0);
  rtBlock.castShadow = false;
  smBench.add(rtBlock);
  const rtTag = textPlate('1x RT', 0.1, 0.03, { color: '#ffdcae', weight: 700, opacity: 0.95 });
  rtTag.position.set(0.95, 0.5, 0.03);
  smBench.add(rtTag);

  // the instruction each scheduler hands down into its 32 lanes — one pill per
  // block, dropping from the scheduler bar into the lane grid on every issue
  const instrPills = BLOCK_X.map((bx) => {
    const mat = materials.glow(HOT_COLOR, 1.1);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    const p = beveledBox(0.05, 0.05, 0.03, mat, 0.01);
    p.position.set(bx, 0.95, 0.09);
    p.castShadow = false;
    smBench.add(p);
    return p;
  });

  // the memory request a stalled warp is waiting on: a dot dropped from the
  // block down through L1 and off the bottom of the SM
  const stallCurve = new THREE.CatmullRomCurve3([
    new THREE.Vector3(-0.34, 0.62, 0.06),
    new THREE.Vector3(-0.28, 0.34, 0.12),
    new THREE.Vector3(-0.1, 0.15, 0.08),
    new THREE.Vector3(0.3, 0.02, 0.06),
  ]);
  const stallTraceMat = materials.glow(MEM_COLOR, 0.5);
  stallTraceMat.transparent = true;
  stallTraceMat.opacity = 0;
  stallTraceMat.depthWrite = false;
  const stallTrace = new THREE.Mesh(
    new THREE.TubeGeometry(stallCurve, 40, 0.007, 6, false),
    stallTraceMat,
  );
  stallTrace.castShadow = false;
  smBench.add(stallTrace);
  const stallDot = dotMesh(0.026, MEM_COLOR, 1.6);
  smBench.add(stallDot);

  // -------------------------------------------------------------------------
  // Hairlines from the real die up to whichever insert is standing
  // -------------------------------------------------------------------------
  const linkGroup = new THREE.Group();
  spinGroup.add(linkGroup);
  const linkMats = [];
  {
    const baseY = CARD_Y + DIE_TOP;
    const h = DIE / 2;
    const corners = [
      [-h, -h, -1.05, -0.02],
      [h, -h, 1.05, -0.02],
      [h, h, 1.05, 0.06],
      [-h, h, -1.05, 0.06],
    ];
    for (const [dx, dz, bx, bz] of corners) {
      const mat = materials.glow(ACCENT, 0.4);
      mat.transparent = true;
      mat.opacity = 0;
      mat.depthWrite = false;
      const c = new THREE.LineCurve3(
        new THREE.Vector3(PKG_CX + dx, baseY, PKG_CZ + dz),
        new THREE.Vector3(bx, BENCH_Y - 0.02, bz),
      );
      const line = new THREE.Mesh(new THREE.TubeGeometry(c, 2, 0.0035, 5, false), mat);
      line.castShadow = false;
      linkGroup.add(line);
      linkMats.push(mat);
    }
  }

  // =========================================================================
  // Memory traffic on the real board: twelve modules, twelve channels
  // =========================================================================
  const memFlowGroup = new THREE.Group();
  cardGroup.add(memFlowGroup);
  const memLanes = MEM_POS.map(([mx, mz], i) => {
    const from = new THREE.Vector3(mx, PCB_TOP + 0.016, mz);
    const edgeX = PKG_CX + Math.sign(mx - PKG_CX || 1) * 0.2;
    const edgeZ = PKG_CZ + Math.sign(mz - PKG_CZ || 1) * 0.16;
    const to = new THREE.Vector3(
      Math.abs(mz - PKG_CZ) > 0.28 ? PKG_CX + (mx - PKG_CX) * 0.35 : edgeX,
      PKG_TOP + 0.004,
      Math.abs(mz - PKG_CZ) > 0.28 ? edgeZ : PKG_CZ + (mz - PKG_CZ) * 0.4,
    );
    const curve = traceCurve(from, to, 0.05 + (i % 3) * 0.012);
    const mat = materials.glow(MEM_COLOR, 0.35);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    const trace = new THREE.Mesh(new THREE.TubeGeometry(curve, 30, 0.0045, 6, false), mat);
    trace.castShadow = false;
    memFlowGroup.add(trace);
    const dot = dotMesh(0.017, DATA_COLOR, 1.5);
    memFlowGroup.add(dot);
    return { curve, mat, dot };
  });

  // =========================================================================
  // Callouts
  // =========================================================================
  const labels = calloutSets([
    'card',
    'exploded',
    'board',
    'pipe',
    'die',
    'sm',
    'simt',
    'sched',
    'mem',
  ]);

  labels.add('card', shroudTop, 'Three 100 mm fans', [0.55, 0.02, -0.1], 74, 150);
  labels.add('card', bracket, 'Display outputs', [0.02, 0.05, 0.42], -26, 96);
  labels.add('card', fingerTab, 'PCIe x16 edge connector', [0.3, 0.02, -0.05], -46, 104);
  labels.add('card', backplate, 'Backplate', [0.72, -0.01, -0.5], -52, 132);

  labels.add('exploded', vapor, 'Copper vapour chamber', [0.72, 0.03, -0.2], 30, 96);
  labels.add('exploded', fins, '96 fins and six heatpipes', [1.18, 0.24, 0.1], 62, 140);
  labels.add('exploded', die, 'The bare die', [0.06, 0.01, -0.08], -34, 108);
  labels.add('exploded', shroudTop, 'Shroud and fans', [1.2, 0.03, 0.02], 44, 84);

  labels.add('board', die, 'The die — 24.7 mm square', [0.09, 0.01, -0.06], 46, 96);
  labels.add('board', memModules[11], '12 GDDR6X modules', [0.06, 0.01, 0.06], 40, 90);
  labels.add('board', vrmChokes[16], '23 power phases', [0.05, 0.02, 0.04], 22, 88);
  labels.add('board', powerBody, '16 pins, 450 watts', [0.02, 0.03, 0.02], 66, 84);

  // Only the right-hand half of this bench gets callouts: the four stations
  // already carry their own nameplates, and anything anchored to the two left
  // ones lands under the text panel (verify's label-visibility gate caught it).
  labels.add('pipe', fb.mesh, 'One shader run per pixel', [0.3, 0.28, 0.06], 42, 96);
  labels.add('pipe', fb.mesh, '8.3 million per 4K frame', [0.36, -0.26, 0.06], -32, 104);
  labels.add('pipe', pipeBench, 'Written to the framebuffer', [0.93, 0.3, 0.1], 40, 86);

  labels.add('die', dieInsert, 'One SM — 144 on this die', [0.51, 1.07, 0.06], 62, 82);
  labels.add('die', l2Band, 'L2 cache — 96 MB', [0.62, 0.02, 0.04], 26, 90);
  labels.add('die', dieInsert, 'Memory controller x12', [0.85, 0.055, 0.05], -44, 96);
  labels.add('die', dieInsert, 'One GPC of twelve SMs', [0.17, 0.33, 0.06], -58, 62);

  labels.add('sm', smBench, 'Four blocks of 32 lanes', [0.34, 0.63, 0.08], 84, 132);
  labels.add('sm', smBench, 'One warp scheduler each', [0.68, 0.98, 0.06], 40, 84);
  labels.add('sm', regFrame, '256 KB of registers', [0.06, -0.42, 0.06], -76, 92);
  labels.add('sm', tensorBlock, 'Tensor and RT cores', [0.06, 0.04, 0.04], -40, 44);

  labels.add('simt', smBench, 'One instruction, 32 lanes', [-0.34, 0.98, 0.09], 62, 96);
  labels.add('simt', smBench, 'A branch splits the warp in two', [0.34, 0.36, 0.08], -40, 108);

  labels.add('sched', regFrame, 'The 48 warps parked here', [0.05, 0.44, 0.06], 84, 86);
  labels.add('sched', smBench, 'This one is waiting on memory', [0.0, 0.15, 0.09], -32, 112);
  labels.add('sched', smBench, 'The lanes never stop', [0.68, 0.63, 0.08], 46, 90);

  labels.add('mem', memModules[10], 'Twelve 32-bit channels', [0.06, 0.02, 0.05], 34, 94);
  labels.add('mem', die, 'A terabyte a second, in here', [0.09, 0.01, -0.05], 52, 100);

  // =========================================================================
  // State + pose. ONE object; every step pins ALL of it in onEnter.
  // =========================================================================
  const state = {
    view: 'card', // card | board | die | pipe | sm | mem
    spin: 0, // turntable, radians
    fan: 0, // fan blade angle, radians — whole turns per lap
    lift: 0, // 0 = sealed card, 1 = cooler exploded off it
    vrm: 0, // VRM phase sequence, whole laps
    pipe: 0, // graphics-pipeline phase, whole cycles
    smMode: 'idle', // idle | simt | sched — what the SM bench is showing
    simt: 0, // lockstep-then-divergence phase, whole cycles
    sched: 0, // warp switches, whole switches
    smPulse: 0, // floorplan activity phase, whole laps
    flow: 0, // memory traffic phase, whole laps
  };

  // Which register slots the scheduler cycles through, and the pseudo-random
  // lane mask a data-dependent branch produces. Seven slots, so a lap of seven
  // switches lands exactly back on the first.
  const SCHED_SLOTS = [3, 17, 9, 34, 22, 41, 12];
  const LANE_MASK = [];
  for (let k = 0; k < 32; k++) LANE_MASK.push(((k * 13 + 5) % 7) < 4);

  const scratchA = new THREE.Vector3();
  const scratchB = new THREE.Vector3();

  function paintLanes(gridIndex, litFn) {
    const g = laneGrids[gridIndex];
    for (let k = 0; k < 32; k++) {
      const b = litFn(k);
      // heavily blue-weighted: an even RGB ramp tonemaps to pale lavender and
      // the lit-vs-masked contrast this step is ABOUT stops reading
      g.set(k, 0.02 + b * 0.36, 0.025 + b * 0.22, 0.055 + b * 1.4);
    }
    g.flush();
  }

  function apply() {
    spinGroup.rotation.y = state.spin;
    const v = state.view;

    // --- the cooler: only on the sealed/exploded card steps
    const coolerOn = v === 'card';
    shroudGroup.visible = coolerOn;
    finGroup.visible = coolerOn;
    vaporGroup.visible = coolerOn;
    // gaps sized so a sightline under the vapour chamber reaches the bare die —
    // the part step 2's copy names, and rule 10 says must be findable
    vaporGroup.position.y = state.lift * 0.42;
    finGroup.position.y = state.lift * 0.74;
    shroudGroup.position.y = state.lift * 1.1;
    for (const s of fanSpinners) s.rotation.z = state.fan;

    // --- inserts
    dieInsert.visible = v === 'die';
    pipeBench.visible = v === 'pipe';
    smBench.visible = v === 'sm';
    const insertOn = dieInsert.visible || pipeBench.visible || smBench.visible;
    for (const m of linkMats) m.opacity = insertOn ? 0.15 : 0;
    memFlowGroup.visible = v === 'mem';

    // --- the real die, always alive under whatever is above it
    const pulse = state.smPulse;
    dieGpcMats.forEach((m, i) => {
      const ph = frac(pulse - (i % 6) * 0.09 - (i > 5 ? 0.05 : 0));
      m.emissiveIntensity = 0.14 + 0.26 * Math.pow(1 - ph, 3);
    });
    const memHot = v === 'mem' ? 1 : 0.35;
    dieMcMats.forEach((m, i) => {
      const ph = frac(state.flow - i * 0.07);
      m.emissiveIntensity = 0.13 + 0.34 * memHot * Math.pow(1 - ph, 4);
    });
    dieL2.material.emissiveIntensity =
      0.14 + 0.2 * memHot * Math.pow(1 - frac(state.flow * 2), 3);

    // --- VRM phases, marching round the ring one after another
    vrmPips.forEach((m, i) => {
      const ph = frac(state.vrm - i / vrmPips.length);
      m.emissiveIntensity = 0.06 + 0.85 * Math.pow(1 - ph, 6);
    });

    // --- memory traffic on the board
    if (memFlowGroup.visible) {
      memLanes.forEach((ln, i) => {
        const t = frac(state.flow + i / memLanes.length);
        ln.dot.position.copy(ln.curve.getPointAt(t));
        // fade in at the module and out at the package so the wrap-around jump
        // back to the start is never a visible pop
        ln.dot.material.opacity = Math.sin(Math.PI * t) * 0.95;
        ln.mat.opacity = 0.22;
      });
    } else {
      for (const ln of memLanes) ln.dot.material.opacity = 0;
    }

    // --- traffic on the L2 band, and the instruction each scheduler hands its
    // lanes. Both are posed UNCONDITIONALLY and only faded by visibility: a
    // pose computed inside a visibility branch is unprobeable, and a step whose
    // only change is colour reads to the eye as a still image.
    l2Dots.forEach((d, i) => {
      const t = frac(state.smPulse + i / l2Dots.length);
      const forward = i % 2 === 0; // the bus runs both ways at once
      d.position.set(forward ? -1.0 + 2.0 * t : 1.0 - 2.0 * t, 0.7, 0.035);
      d.material.opacity = dieInsert.visible ? Math.sin(Math.PI * t) * 0.9 : 0;
    });

    const issue =
      state.smMode === 'simt'
        ? state.simt * 3 // three instructions per lockstep cycle
        : state.smMode === 'sched'
          ? state.sched * SCHED_SLOTS.length // one per warp switch
          : state.smPulse;
    instrPills.forEach((p, i) => {
      const t = frac(issue - i * 0.08);
      p.position.set(BLOCK_X[i], 0.95 - 0.29 * smooth(t), 0.09);
      p.material.opacity = smBench.visible ? Math.sin(Math.PI * t) * 0.9 : 0;
    });

    const schedLocal = frac(frac(state.sched) * SCHED_SLOTS.length);
    stallDot.position.copy(stallCurve.getPointAt(clamp01(schedLocal)));

    // --- die floorplan insert: activity sweeping GPC by GPC
    if (dieInsert.visible) {
      for (let k = 0; k < smTilePos.length; k++) {
        const g = smTileGpc[k];
        const ph = frac(pulse - (g % 6) * 0.085 - (g > 5 ? 0.045 : 0) - (k % 12) * 0.008);
        const b = 0.1 + 0.92 * Math.pow(1 - ph, 4);
        smTiles.set(k, 0.04 + b * 0.3, 0.05 + b * 0.18, 0.1 + b * 1.25);
      }
      smTiles.flush();
      gpcPlates.forEach((m, g) => {
        const ph = frac(pulse - (g % 6) * 0.085 - (g > 5 ? 0.045 : 0));
        m.emissiveIntensity = 0.1 + 0.16 * Math.pow(1 - ph, 3);
      });
      insertMcMats.forEach((m, i) => {
        m.emissiveIntensity = 0.22 + 0.3 * Math.pow(1 - frac(pulse - i * 0.06), 4);
      });
      l2Band.material.emissiveIntensity = 0.26 + 0.26 * Math.pow(1 - frac(pulse * 2), 3);
    }

    // --- the graphics pipeline. The vertex TRANSFORMS run whether or not the
    // bench is on screen, and only opacity is gated: a pose that is computed
    // solely inside a visibility branch cannot be probed (and, more to the
    // point, a step whose only change is colour reads as a still image).
    {
      const u = frac(state.pipe);
      // Front-loaded on purpose: the finished, shaded triangle is the payoff of
      // the whole step, so it snaps in at 54% and then HOLDS for a third of the
      // lap rather than flashing past on the way to the reset.
      const appear = win(u, 0.01, 0.09);
      const project = win(u, 0.12, 0.28);
      const retire = win(u, 0.36, 0.46); // the vertices are consumed by the rasteriser
      const raster = win(u, 0.28, 0.44);
      const shade = win(u, 0.46, 0.54);
      const output = win(u, 0.6, 0.7);
      const clear = 1 - win(u, 0.88, 0.99);

      triDots.forEach((d, i) => {
        d.position.lerpVectors(triFrom[i], triTo[i], project);
        d.material.opacity = appear * (1 - retire) * 0.95;
      });
      triEdges.forEach((e, i) => {
        const a = triDots[i].position;
        const b = triDots[(i + 1) % 3].position;
        scratchA.subVectors(b, a);
        const len = scratchA.length();
        e.position.copy(a).addScaledVector(scratchA, 0.5);
        e.scale.set(len, 1, 1);
        scratchB.copy(scratchA).normalize();
        e.quaternion.setFromUnitVectors(X_AXIS, scratchB);
        e.material.opacity = appear * (1 - retire) * 0.7;
      });

      // the 240-cell repaint is the expensive half — skip it off-screen
      if (pipeBench.visible) {
        for (let k = 0; k < fb.count; k++) {
          if (!fbInside[k]) {
            fb.set(k, 0.05, 0.055, 0.07);
            continue;
          }
          // the rasteriser walks the tile top to bottom finding covered pixels
          const rowT = 1 - fb.centres[k][1];
          const rasterK = clamp01((raster - rowT * 0.5) * 3.2);
          const dimLit = 0.34 * rasterK * (1 - shade);
          // …and then every covered pixel is shaded AT ONCE, each by its own
          // thread, its colour interpolated from the three vertices
          const amt = shade * (0.85 + 0.5 * output);
          const w0 = fbCover[k * 3];
          const w1 = fbCover[k * 3 + 1];
          const w2 = fbCover[k * 3 + 2];
          const cr = w0 * TRI_RGB[0][0] + w1 * TRI_RGB[1][0] + w2 * TRI_RGB[2][0];
          const cg = w0 * TRI_RGB[0][1] + w1 * TRI_RGB[1][1] + w2 * TRI_RGB[2][1];
          const cb = w0 * TRI_RGB[0][2] + w1 * TRI_RGB[1][2] + w2 * TRI_RGB[2][2];
          fb.set(
            k,
            0.05 + (dimLit + amt * cr) * clear,
            0.055 + (dimLit + amt * cg) * clear,
            0.07 + (dimLit + amt * cb) * clear,
          );
        }
        fb.flush();
  
        // each station lights for its own stage and is dark again at the wrap
        const lit = [
          win(u, 0.01, 0.07) * (1 - win(u, 0.18, 0.26)),
          win(u, 0.26, 0.32) * (1 - win(u, 0.44, 0.5)),
          win(u, 0.44, 0.49) * (1 - win(u, 0.58, 0.64)),
          win(u, 0.58, 0.64) * (1 - win(u, 0.88, 0.97)),
        ];
        pipeStationMats.forEach((m, i) => {
          m.emissiveIntensity = 0.22 + 0.95 * clamp01(lit[i]);
        });
      }
    }

    // --- inside one SM
    if (smBench.visible) {
      const mode = state.smMode;

      if (mode === 'simt') {
        const u = frac(state.simt);
        // three instructions issued to all 32 lanes together…
        // Three instructions issued back to back. Each one HOLDS its lanes lit
        // for its whole slot (bright attack, decaying to a floor) rather than
        // flashing: a cubic flash left most of the lap dark, so a still frame of
        // the step about 32 lanes firing showed 32 idle lanes.
        const inLock = u > 0.02 && u < 0.44;
        const f = inLock ? frac((u - 0.02) / 0.15) : 0;
        const lockstep = inLock
          ? (0.38 + 0.62 * Math.pow(1 - f, 2)) * (1 - win(u, 0.38, 0.44))
          : 0;
        // …then a branch splits the warp and the halves run ONE AFTER THE OTHER
        const legA = win(u, 0.52, 0.56) * (1 - win(u, 0.7, 0.74));
        const legB = win(u, 0.76, 0.8) * (1 - win(u, 0.94, 0.98));
        paintLanes(0, (k) => {
          const on = LANE_MASK[k] ? legA : legB;
          return clamp01(lockstep * 0.95 + on * 0.95) + 0.03;
        });
        for (let bi = 1; bi < laneGrids.length; bi++) {
          paintLanes(bi, (k) => 0.06 + 0.2 * Math.pow(1 - frac(state.smPulse - k * 0.02), 5));
        }
        schedMats.forEach((m, i) => {
          m.emissiveIntensity =
            i === 0 ? 0.16 + 1.0 * clamp01(lockstep + legA * 0.7 + legB * 0.7) : 0.16;
        });
        regGrid.mesh.visible = true;
        for (let k = 0; k < 48; k++) regGrid.set(k, 0.07, 0.09, 0.16);
        regGrid.flush();
        stallDot.material.opacity = 0;
        stallTraceMat.opacity = 0;
      } else if (mode === 'sched') {
        const u = frac(state.sched);
        const idx = Math.min(SCHED_SLOTS.length - 1, Math.floor(u * SCHED_SLOTS.length));
        const local = frac(u * SCHED_SLOTS.length);
        const active = SCHED_SLOTS[idx];
        const stalled = SCHED_SLOTS[(idx + SCHED_SLOTS.length - 1) % SCHED_SLOTS.length];
        for (let k = 0; k < 48; k++) {
          if (k === active) regGrid.set(k, 0.62, 0.48, 1.35);
          else if (k === stalled) regGrid.set(k, 0.95, 0.62, 0.2);
          else regGrid.set(k, 0.08, 0.1, 0.18);
        }
        regGrid.flush();
        // the lanes never idle: as one warp stalls the next is already issuing
        for (let bi = 0; bi < laneGrids.length; bi++) {
          paintLanes(bi, (k) => 0.1 + 0.85 * Math.pow(1 - frac(local + bi * 0.1 - k * 0.012), 3));
        }
        schedMats.forEach((m) => {
          m.emissiveIntensity = 0.16 + 1.1 * Math.pow(1 - local, 5);
        });
        // the request the stalled warp went away for (posed above)
        stallDot.material.opacity = Math.sin(Math.PI * local) * 0.95;
        stallTraceMat.opacity = 0.18;
      } else {
        const rip = state.smPulse;
        for (let bi = 0; bi < laneGrids.length; bi++) {
          paintLanes(bi, (k) => 0.08 + 0.5 * Math.pow(1 - frac(rip - bi * 0.1 - k * 0.014), 4));
        }
        schedMats.forEach((m, i) => {
          m.emissiveIntensity = 0.16 + 0.5 * Math.pow(1 - frac(rip - i * 0.1), 5);
        });
        for (let k = 0; k < 48; k++) {
          const b = 0.08 + 0.3 * Math.pow(1 - frac(rip - k * 0.01), 6);
          regGrid.set(k, b * 0.6, b * 0.7, b * 1.3);
        }
        regGrid.flush();
        stallDot.material.opacity = 0;
        stallTraceMat.opacity = 0;
      }

      l1Mat.emissiveIntensity =
        0.2 + (mode === 'sched' ? 0.45 * Math.pow(1 - frac(state.sched * 7), 4) : 0.08);
      tensorMat.emissiveIntensity = 0.2 + (mode === 'idle' ? 0.16 : 0.04);
      rtMat.emissiveIntensity = 0.2 + (mode === 'idle' ? 0.14 : 0.04);
    }
  }

  apply();

  return {
    group,
    parts: {
      cardGroup,
      shroudGroup,
      finGroup,
      vaporGroup,
      boardGroup,
      pkgGroup,
      die,
      dieInsert,
      pipeBench,
      smBench,
      fanSpinners,
      memModules,
      laneGrids,
      smCount: smTilePos.length,
    },
    setView(next) {
      state.view = next;
      apply();
    },
    setLabels: labels.setLabels,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
  };
}
