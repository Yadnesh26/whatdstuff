import * as THREE from 'three';
import { materials, studioPlinth } from '../../framework/parts.js';
import { beveledBox } from '../../framework/geometry.js';
import { clamp01, smooth, win, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// "How a blockchain works", built as the real thing: Bitcoin's proof-of-work
// chain, because it is the only blockchain with hard public numbers.
//
// Reference facts (developer.bitcoin.org + network statistics, Sept 2026):
//  - A block HEADER is exactly 80 bytes, six fields in this order:
//      version (4) | previous block header hash (32) | merkle root (32)
//      | time (4) | nBits, the encoded target (4) | nonce (4)
//    Two 32-byte hashes are 64 of those 80 bytes: the header is mostly
//    fingerprints. The nonce is the field a miner sweeps freely.
//  - Every hash here is a DOUBLE SHA-256 - 256 bits, 64 hex characters.
//  - Transactions are folded into ONE 32-byte merkle root by hashing them
//    pairwise up a tree; an odd node is concatenated with a COPY OF ITSELF.
//    The coinbase transaction - the miner's 3.125 BTC subsidy since the April
//    2024 halving, plus the fees - is always the first leaf.
//  - A block carries ~4,700 transactions on average; the cap is 4 million
//    weight units.
//  - PROOF OF WORK: the header's own hash must be <= the target encoded in
//    nBits. At difficulty 125.81 T (Aug 2026) the target is about 2^-78.8 of
//    the hash space - roughly 19 leading zeros in hex - and the expected work
//    per block is difficulty x 2^32 = 5.4e23 hashes.
//  - The network runs at ~1,001 EH/s (Sept 2026) = 1.0e21 hashes/s, so
//    5.4e23 / 1.0e21 = 540 seconds - about NINE minutes, not ten. That gap is
//    the point, not a rounding error: the protocol wants ten, so it retargets
//    every 2,016 blocks (~2 weeks) to drag the average back. (The two figures
//    are real snapshots taken a fortnight apart, which is exactly the interval
//    over which the network corrects for the drift between them.)
//  - TAMPER EVIDENCE: edit one transaction -> its leaf hash changes -> the
//    merkle root changes -> the header hash changes -> the next block's stored
//    "previous hash" no longer matches, and every block after it would have to
//    be re-mined against the whole network.
//  - FORKS: two miners can find a valid block at the same height. Nodes build
//    on whichever branch accumulates the most work; the losing block is
//    orphaned and its transactions go back to the mempool.
//
// Staging. The chain runs along +X on a studio bench. The hero block, #964,940,
// opens - lid lifted, front panel hinged down - to show its transaction
// records, the merkle tree growing out of them, and the 80-byte header laid out
// with each field's width drawn to scale in bytes. Behind the bench sits the
// hash mill: the header docks, the nonce sweeps, and every candidate hash is
// plotted against a target gauge marked in leading zeros.
//
// The couplings between blocks are the whole idea made physical. Each block's
// right-hand face carries a toothed flange cut from its OWN hash; the next
// block's left-hand face carries the complementary flange cut from the previous
// hash it recorded. Matching profiles meet exactly. Change one transaction and
// the teeth collide - the chain visibly cannot close.

const ACCENT = 0xf0a63a; // amber - hashes, the chain itself
const VALID = 0x3ddc84; // green - a hash that beats the target
const BAD = 0xff5c5c; // red - a link that no longer fits
const NONCE_C = 0x62d0ff; // cyan - the four bytes the miner sweeps

const BLOCK_W = 1.9;
const BLOCK_D = 1.4;
const BODY_H = 1.16;
const LID_H = 0.18;
const WALL = 0.09;
const PITCH = 2.4;
const PLINTH_H = 0.22;
const FLOOR_Y = PLINTH_H; // a block's underside
const BODY_TOP = FLOOR_Y + BODY_H; // 1.38
const LID_Y = BODY_TOP + LID_H / 2; // 1.47
const MID_Y = FLOOR_Y + BODY_H / 2; // 0.80 - the coupling axis

const N_CHAIN = 5;
const HERO_I = 2;
const BASE_HEIGHT = 964938;
const chainX = (i) => (i - HERO_I) * PITCH; // -4.8 .. 4.8
const FORK_X = chainX(N_CHAIN); // 7.2
const CHILD_X = chainX(N_CHAIN + 1); // 9.6
const ORPHAN_LIFT = 2.05;

// Coupling: the socket flange sits at local +0.95 and the plug flange at local
// -0.95, so facing flanges stand 0.44 apart across a joint - and a matched pair
// of tooth profiles always sums to exactly that.
const FLANGE_X = BLOCK_W / 2;
const TOOTH_GAP = 0.44;
const TOOTH_BASE = TOOTH_GAP / 2;
const TOOTH_SWING = 0.22;
const JOINT_DX = 1.2; // joint centre, measured from the left-hand block's origin

// The mill and the gauge stand in FRONT of the chain, not behind it: parked
// behind the hero block, the merkle tree grows straight across the sightline to
// them. In front, the chain becomes their backdrop and nothing occludes.
const MILL_X = 3.0;
const MILL_Z = 2.9;
const DOCK = [MILL_X, 2.05, MILL_Z - 0.1];
const GAUGE_X = 4.9;
const TARGET_ZEROS = 19;
const gaugeY = (z) => 0.42 + z * 0.118;

const N_REC = 8;
const REC_PITCH = 0.24;
const recX = (i) => (i - (N_REC - 1) / 2) * REC_PITCH;
const REC_Y = 0.62;
const REC_H = 0.3;
const REC_Z = 0.05;
const REC_TOP = REC_Y + REC_H / 2;
const LEVEL_Y = [1.8, 2.14, 2.48, 2.82];
const TREE_TUCK = 1.4; // how far the tree sits down inside a sealed block
const HEADER_Y = 3.24;
const HEADER_TUCK_Y = 1.02;
const HEADER_W = 1.74;

// The 80-byte header, drawn to scale: each field's width IS its byte count.
const FIELDS = [
  { name: 'Version', bytes: 4, color: 0x9aa4b0 },
  { name: 'Previous block hash', bytes: 32, color: ACCENT },
  { name: 'Merkle root', bytes: 32, color: VALID },
  { name: 'Time', bytes: 4, color: 0x9aa4b0 },
  { name: 'Target', bytes: 4, color: 0x9aa4b0 },
  { name: 'Nonce', bytes: 4, color: NONCE_C },
];

const HEX = '0123456789abcdef';
const ELL = '…';

function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function hexRun(seed, n) {
  const r = mulberry32(Math.imul(seed, 2654435761));
  let s = '';
  for (let i = 0; i < n; i++) s += HEX[Math.floor(r() * 16)];
  return s;
}

// A real hash is 64 hex characters. These plates show the readable prefix,
// which is the only part proof of work is ever about.
const goodHash = (seed, zeros = TARGET_ZEROS) => '0'.repeat(zeros) + hexRun(seed, 11) + ELL;
const failHash = (seed) => {
  const s = hexRun(seed, 30);
  return (s[0] === '0' ? 'c' : s[0]) + s.slice(1) + ELL;
};
const hex8 = (n) => n.toString(16).padStart(8, '0');
const teethOf = (seed, n = 12) => {
  const r = mulberry32(Math.imul(seed, 40503) + 977);
  return Array.from({ length: n }, () => 0.12 + r() * 0.76);
};
const triangle = (u) => 1 - Math.abs(1 - 2 * clamp01(u));
const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------------------
// engraved readout plate - a canvas texture that can be rewritten in place
// ---------------------------------------------------------------------------
function readout(w, h, { caption = '', text = '', zeros = 0, px = 640, align = 'left' } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = Math.max(2, Math.round((px * h) / w));
  const ctx = canvas.getContext('2d');
  let lead = '#f0a63a';
  function draw(t, z) {
    const H = canvas.height;
    ctx.clearRect(0, 0, px, H);
    const pad = px * 0.018;
    if (caption) {
      ctx.font = `700 ${Math.round(H * 0.2)}px "Segoe UI", sans-serif`;
      ctx.fillStyle = '#6d7683';
      ctx.textAlign = 'left';
      ctx.textBaseline = 'middle';
      ctx.fillText(caption, pad, H * 0.25);
    }
    const size = Math.min(H * (caption ? 0.46 : 0.66), (px - pad * 2) / (0.62 * (t.length || 1)));
    ctx.font = `600 ${Math.round(size)}px ui-monospace, Consolas, "Courier New", monospace`;
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    const y = caption ? H * 0.69 : H * 0.52;
    const total = ctx.measureText(t).width;
    const x0 = align === 'center' ? (px - total) / 2 : pad;
    const head = t.slice(0, z);
    ctx.fillStyle = lead;
    ctx.fillText(head, x0, y);
    ctx.fillStyle = '#c9d2dc';
    ctx.fillText(t.slice(z), x0 + ctx.measureText(head).width, y);
  }
  draw(text, zeros);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  const mat = new THREE.MeshStandardMaterial({
    map: tex,
    emissiveMap: tex,
    emissive: 0xffffff,
    emissiveIntensity: 0.5,
    color: 0xffffff,
    roughness: 0.55,
    metalness: 0,
    transparent: true,
    depthWrite: false, // a faded readout must never punch a hole in what is behind it
  });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), mat);
  let last = text;
  let lastZ = zeros;
  let lastLead = lead;
  return {
    mesh,
    mat,
    set(t, z = 0, leadColor = '#f0a63a') {
      if (t === last && z === lastZ && leadColor === lastLead) return;
      last = t;
      lastZ = z;
      lastLead = leadColor;
      lead = leadColor;
      draw(t, z);
      tex.needsUpdate = true;
    },
  };
}

// ---------------------------------------------------------------------------
// face coupling - a toothed flange whose profile is cut from a hash.
// dir = +1: teeth point along +X (a block's own-hash socket face).
// dir = -1: teeth point along -X (the next block's previous-hash plug face).
// A matched pair of profiles sums to TOOTH_GAP, so the two faces meet exactly.
// ---------------------------------------------------------------------------
function faceCoupling(mat, dir) {
  const group = new THREE.Group();
  const flange = new THREE.Mesh(new THREE.CylinderGeometry(0.3, 0.32, 0.07, 30), mat);
  flange.rotation.z = Math.PI / 2;
  flange.castShadow = true;
  group.add(flange);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.44, 16), mat);
  hub.rotation.z = Math.PI / 2;
  hub.position.x = dir * 0.22;
  group.add(hub);
  const teeth = [];
  for (let i = 0; i < 12; i++) {
    const a = (i * TAU) / 12;
    const m = beveledBox(1, 0.09, 0.115, mat, 0.014);
    m.rotation.x = a;
    group.add(m);
    teeth.push({ m, a });
  }
  let current = new Array(12).fill(0.5);
  function setTeeth(vals) {
    current = vals;
    for (let i = 0; i < 12; i++) {
      const t = teeth[i];
      const h = TOOTH_BASE + (vals[i] - 0.5) * TOOTH_SWING;
      t.m.scale.x = h;
      t.m.position.set(dir * (0.035 + h / 2), Math.cos(t.a) * 0.2, Math.sin(t.a) * 0.2);
    }
  }
  setTeeth(current);
  return { group, setTeeth, height: (i) => TOOTH_BASE + (current[i] - 0.5) * TOOTH_SWING };
}

// ---------------------------------------------------------------------------
// one block: a machined case, engraved hash + height plates, a socket flange on
// its right face and a plug flange on its left. The hero block is built from
// separate panels so its lid can lift and its front can hinge down - metal
// cannot be ghosted, so a reveal has to be a real opening.
// ---------------------------------------------------------------------------
function buildBlock({ height, seed, hero = false, caption = 'BLOCK HASH' }) {
  const group = new THREE.Group();
  const shell = materials.paintedMetal(0x2f353d);
  shell.roughness = 0.5;
  shell.clearcoat = 0.4;
  shell.clearcoatRoughness = 0.34;
  const trim = materials.aluminum(0x8d959f);
  trim.roughness = 0.64;
  const dark = materials.rubber(0x08090c);

  const shellParts = [];
  let frontPivot = null;
  if (hero) {
    const inner = BODY_H - WALL;
    const deck = beveledBox(BLOCK_W, WALL, BLOCK_D, shell, 0.02);
    deck.position.y = FLOOR_Y + WALL / 2;
    const back = beveledBox(BLOCK_W, inner, WALL, shell, 0.02);
    back.position.set(0, FLOOR_Y + WALL + inner / 2, -(BLOCK_D / 2 - WALL / 2));
    const left = beveledBox(WALL, inner, BLOCK_D - WALL * 2, shell, 0.02);
    left.position.set(-(BLOCK_W / 2 - WALL / 2), FLOOR_Y + WALL + inner / 2, 0);
    const right = left.clone();
    right.position.x *= -1;
    // dark rough liner: a concave metal interior seen from inside is a curved
    // mirror and blows out under the studio rig
    const liner = new THREE.Mesh(
      new THREE.BoxGeometry(BLOCK_W - WALL * 2.1, inner - 0.01, BLOCK_D - WALL * 2.1),
      dark,
    );
    liner.material.side = THREE.BackSide;
    liner.position.y = FLOOR_Y + WALL + inner / 2;
    group.add(deck, back, left, right, liner);
    shellParts.push(deck, back, left, right);
    frontPivot = new THREE.Group();
    frontPivot.position.set(0, FLOOR_Y + WALL, BLOCK_D / 2 - WALL / 2);
    const front = beveledBox(BLOCK_W, inner, WALL, shell, 0.02);
    front.position.y = inner / 2;
    frontPivot.add(front);
    group.add(frontPivot);
  } else {
    const body = beveledBox(BLOCK_W, BODY_H, BLOCK_D, shell, 0.03);
    body.position.y = FLOOR_Y + BODY_H / 2;
    group.add(body);
    shellParts.push(body);
  }

  const lid = beveledBox(BLOCK_W, LID_H, BLOCK_D, shell, 0.03);
  lid.position.y = LID_Y;
  group.add(lid);
  // machined base skirt + top rail: the two bands that stop a block reading as
  // a plain grey box
  const skirt = beveledBox(BLOCK_W + 0.07, 0.07, BLOCK_D + 0.07, trim, 0.016);
  skirt.position.y = FLOOR_Y + 0.035;
  group.add(skirt);
  const seam = beveledBox(BLOCK_W + 0.03, 0.035, BLOCK_D + 0.03, trim, 0.01);
  seam.position.y = BODY_TOP - 0.012;
  group.add(seam);
  // side vents
  for (const sx of [-1, 1]) {
    for (let v = 0; v < 4; v++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.4, 0.055), dark);
      slot.position.set(sx * (BLOCK_W / 2 - 0.004), FLOOR_Y + 0.62, -0.36 + v * 0.19);
      group.add(slot);
    }
  }
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const bolt = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.026, 6), trim);
      bolt.position.set(sx * 0.74, LID_Y + LID_H / 2 + 0.012, sz * 0.5);
      bolt.rotation.y = 0.4;
      lid.add(bolt);
      bolt.position.y -= LID_Y;
    }
  }

  // engraved front plates - carried on the hinged panel for the hero block
  const host = hero ? frontPivot : group;
  const faceZ = hero ? WALL / 2 + 0.008 : BLOCK_D / 2 + 0.008;
  const yBase = hero ? -(FLOOR_Y + WALL) : 0;
  const hashPlate = readout(1.6, 0.3, {
    caption,
    text: goodHash(seed),
    zeros: TARGET_ZEROS,
    px: 720,
  });
  hashPlate.mesh.position.set(0, 0.64 + yBase, faceZ);
  host.add(hashPlate.mesh);
  const idPlate = readout(0.8, 0.17, { text: `#${height.toLocaleString('en-US')}`, px: 340 });
  idPlate.mesh.position.set(-0.38, 1.12 + yBase, faceZ);
  host.add(idPlate.mesh);
  const grille = new THREE.Mesh(new THREE.BoxGeometry(0.52, 0.15, 0.012), dark);
  grille.position.set(0.53, 1.12 + yBase, faceZ - 0.004);
  host.add(grille);
  const stripeMat = new THREE.MeshBasicMaterial({
    color: ACCENT,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });
  const stripe = new THREE.Mesh(new THREE.BoxGeometry(1.62, 0.016, 0.008), stripeMat);
  stripe.position.set(0, 0.36 + yBase, faceZ);
  host.add(stripe);

  const alloy = materials.aluminum(0xc4cbd4);
  alloy.roughness = 0.5;
  const socket = faceCoupling(alloy, +1);
  socket.group.position.set(FLANGE_X, MID_Y, 0);
  socket.setTeeth(teethOf(seed));
  group.add(socket.group);
  const plug = faceCoupling(alloy, -1);
  plug.group.position.set(-FLANGE_X, MID_Y, 0);
  group.add(plug.group);

  return { group, lid, frontPivot, hashPlate, idPlate, socket, plug, shell, trim, dark, seed };
}

// ---------------------------------------------------------------------------
export function buildBlockchain({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // three decks rather than one huge table: the chain rail (with room behind it
  // for the hero block's lid to be set down), the mill deck, the mempool deck.
  const rail = studioPlinth({ w: 18.4, h: PLINTH_H, d: 4.4, color: 0x15171b });
  rail.position.set(1.6, 0, -0.4);
  group.add(rail);
  const millDeck = studioPlinth({ w: 5.6, h: PLINTH_H, d: 2.4, color: 0x131519 });
  millDeck.position.set(3.4, 0, MILL_Z);
  group.add(millDeck);
  const poolDeck = studioPlinth({ w: 2.7, h: PLINTH_H, d: 1.5, color: 0x131519 });
  poolDeck.position.set(-0.9, 0, 2.55);
  group.add(poolDeck);

  const labels = calloutSets([
    'chain',
    'inside',
    'mempool',
    'merkle',
    'header',
    'mine',
    'link',
    'tamper',
    'fork',
  ]);

  const glow = (color, intensity = 1.4) =>
    new THREE.MeshBasicMaterial({ color, transparent: true, opacity: 0, depthWrite: false });

  // === the chain ===========================================================
  const blocks = [];
  for (let i = 0; i < N_CHAIN; i++) {
    const b = buildBlock({
      height: BASE_HEIGHT + i,
      seed: 1000 + i * 37,
      hero: i === HERO_I,
    });
    b.group.position.x = chainX(i);
    group.add(b.group);
    blocks.push(b);
    // each block's plug records the PREVIOUS block's hash
    b.plug.setTeeth(teethOf(1000 + (i - 1) * 37).map((v) => 1 - v));
  }
  const hero = blocks[HERO_I];

  // joint rings - the light that runs down the chain
  const jointRings = [];
  for (let i = 0; i < N_CHAIN - 1; i++) {
    const mat = glow(ACCENT);
    const ring = new THREE.Mesh(new THREE.TorusGeometry(0.44, 0.024, 12, 40), mat);
    ring.rotation.y = Math.PI / 2;
    ring.position.set(chainX(i) + JOINT_DX, MID_Y, 0);
    group.add(ring);
    jointRings.push(ring);
  }

  // === fork branch (finale only) ==========================================
  const forkMain = buildBlock({ height: BASE_HEIGHT + N_CHAIN, seed: 4201 });
  forkMain.group.position.set(FORK_X, 0, 0);
  const forkOrphan = buildBlock({ height: BASE_HEIGHT + N_CHAIN, seed: 7717 });
  forkOrphan.group.position.set(FORK_X, ORPHAN_LIFT, 0);
  const forkChild = buildBlock({ height: BASE_HEIGHT + N_CHAIN + 1, seed: 8803 });
  forkChild.group.position.set(CHILD_X, 0, 0);
  for (const b of [forkMain, forkOrphan, forkChild]) {
    b.plug.setTeeth(teethOf(b.seed - 1).map((v) => 1 - v));
    b.group.visible = false;
    group.add(b.group);
  }
  forkMain.plug.setTeeth(teethOf(1000 + (N_CHAIN - 1) * 37).map((v) => 1 - v));
  forkOrphan.plug.setTeeth(teethOf(1000 + (N_CHAIN - 1) * 37).map((v) => 1 - v));
  forkChild.plug.setTeeth(teethOf(4201).map((v) => 1 - v));
  // the orphan hangs off the same parent, lifted onto its own branch
  const orphanStay = new THREE.Mesh(
    new THREE.CylinderGeometry(0.05, 0.05, ORPHAN_LIFT, 12),
    forkOrphan.trim,
  );
  orphanStay.position.set(FORK_X - FLANGE_X - 0.34, MID_Y + ORPHAN_LIFT / 2, 0);
  orphanStay.visible = false;
  group.add(orphanStay);

  // === hero interior: transaction records =================================
  const recGroup = new THREE.Group();
  hero.group.add(recGroup);
  const records = [];
  for (let i = 0; i < N_REC; i++) {
    const mat = materials.polymer(i === 0 ? 0x2a2115 : 0x1a1e24);
    mat.emissive = new THREE.Color(i === 0 ? ACCENT : 0x4d99ff);
    mat.emissiveIntensity = 0.1;
    const card = beveledBox(0.2, REC_H, 0.05, mat, 0.012);
    card.position.set(recX(i), REC_Y, REC_Z);
    const strip = new THREE.Mesh(
      new THREE.PlaneGeometry(0.15, 0.2),
      new THREE.MeshBasicMaterial({
        color: i === 0 ? ACCENT : 0x7fb4ff,
        transparent: true,
        opacity: 0.55,
        depthWrite: false,
      }),
    );
    strip.position.z = 0.027;
    strip.position.y = 0.01;
    card.add(strip);
    recGroup.add(card);
    records.push({ card, mat, strip });
  }

  // === hero interior: merkle tree =========================================
  const treeGroup = new THREE.Group();
  hero.group.add(treeGroup);
  const nodeMat = () => {
    const m = materials.polymer(0x1b2027);
    m.emissive = new THREE.Color(ACCENT);
    m.emissiveIntensity = 0.26;
    m.roughness = 0.45;
    return m;
  };
  const levels = [];
  const nodeX = (level, i, n) => (i - (n - 1) / 2) * REC_PITCH * 2 ** level;
  for (let lv = 0; lv < 4; lv++) {
    const n = 8 >> lv;
    const row = [];
    for (let i = 0; i < n; i++) {
      const mat = nodeMat();
      const size = lv === 3 ? 0.24 : 0.17;
      const node = beveledBox(size, size, size, mat, 0.022);
      node.position.set(nodeX(lv, i, n), LEVEL_Y[lv], 0);
      treeGroup.add(node);
      row.push({ node, mat });
    }
    levels.push(row);
  }
  const rootNode = levels[3][0];
  rootNode.mat.emissive.setHex(VALID);
  rootNode.mat.emissiveIntensity = 0.6;
  const linkMat = materials.aluminum(0x767e88);
  linkMat.roughness = 0.62;
  function strut(a, b) {
    const dir = new THREE.Vector3().subVectors(b, a);
    const len = dir.length();
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, len, 8), linkMat);
    m.position.copy(a).addScaledVector(dir, 0.5);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
    treeGroup.add(m);
    return m;
  }
  for (let lv = 1; lv < 4; lv++) {
    const n = 8 >> lv;
    for (let i = 0; i < n; i++) {
      const parent = new THREE.Vector3(nodeX(lv, i, n), LEVEL_Y[lv], 0);
      for (const c of [i * 2, i * 2 + 1]) {
        strut(new THREE.Vector3(nodeX(lv - 1, c, n * 2), LEVEL_Y[lv - 1], 0), parent);
      }
    }
  }
  // leaf stems down to the records they hash (drawn outside treeGroup so they
  // can stretch as the tree rises out of the block)
  const stemMat = materials.polymer(0x2b3138);
  stemMat.roughness = 0.8;
  const stems = [];
  for (let i = 0; i < N_REC; i++) {
    const m = new THREE.Mesh(new THREE.CylinderGeometry(0.011, 0.011, 1, 8), stemMat);
    m.position.x = recX(i);
    hero.group.add(m);
    stems.push(m);
  }

  // merkle pulses - one per leaf, climbing to the root
  const pulseMat = new THREE.MeshBasicMaterial({
    color: VALID,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const pulses = [];
  for (let i = 0; i < N_REC; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), pulseMat.clone());
    treeGroup.add(p);
    // path: leaf -> its level-1 parent -> level-2 parent -> root
    const path = [
      new THREE.Vector3(nodeX(0, i, 8), LEVEL_Y[0], 0),
      new THREE.Vector3(nodeX(1, i >> 1, 4), LEVEL_Y[1], 0),
      new THREE.Vector3(nodeX(2, i >> 2, 2), LEVEL_Y[2], 0),
      new THREE.Vector3(0, LEVEL_Y[3], 0),
    ];
    pulses.push({ mesh: p, path });
  }

  // === hero interior: the 80-byte header ==================================
  const headerGroup = new THREE.Group();
  hero.group.add(headerGroup);
  const headerBar = beveledBox(HEADER_W + 0.06, 0.34, 0.1, hero.trim, 0.02);
  headerGroup.add(headerBar);
  const fieldMeshes = [];
  {
    const gap = 0.014;
    const usable = HEADER_W - gap * (FIELDS.length - 1);
    let x = -HEADER_W / 2;
    for (const f of FIELDS) {
      const w = (usable * f.bytes) / 80;
      const mat = materials.polymer(0x171b21);
      mat.emissive = new THREE.Color(f.color);
      mat.emissiveIntensity = 0.55;
      const slot = beveledBox(w, 0.22, 0.04, mat, 0.012);
      slot.position.set(x + w / 2, 0, 0.06);
      headerGroup.add(slot);
      fieldMeshes.push({ slot, mat, def: f });
      x += w + gap;
    }
  }
  const nonceField = fieldMeshes[5];
  const prevField = fieldMeshes[1];
  const rootField = fieldMeshes[2];

  // === the hash mill =======================================================
  const millGroup = new THREE.Group();
  millGroup.position.set(MILL_X, 0, MILL_Z);
  group.add(millGroup);
  const millShell = materials.paintedMetal(0x262b33);
  millShell.roughness = 0.52;
  millShell.clearcoat = 0.35;
  millShell.clearcoatRoughness = 0.36;
  const millTrim = materials.aluminum(0x848c96);
  millTrim.roughness = 0.66;
  const millBody = beveledBox(2.5, 1.5, 1.1, millShell, 0.04);
  millBody.position.y = FLOOR_Y + 0.75;
  millGroup.add(millBody);
  for (let i = 0; i < 9; i++) {
    const fin = beveledBox(2.16, 0.05, 0.06, millTrim, 0.012);
    fin.position.set(0, FLOOR_Y + 1.53, -0.42 + i * 0.09);
    millGroup.add(fin);
  }
  // the dock the header slides into
  const dockSlot = new THREE.Mesh(new THREE.BoxGeometry(1.86, 0.07, 0.34), hero.dark);
  dockSlot.position.set(0, FLOOR_Y + 1.5, -0.1);
  millGroup.add(dockSlot);
  for (const sx of [-1, 1]) {
    const guide = beveledBox(0.07, 0.5, 0.1, millTrim, 0.016);
    guide.position.set(sx * 0.93, FLOOR_Y + 1.72, -0.1);
    millGroup.add(guide);
  }
  const candidateOut = readout(2.06, 0.42, {
    caption: 'CANDIDATE HASH',
    text: failHash(11),
    px: 900,
  });
  candidateOut.mesh.position.set(0, FLOOR_Y + 1.02, 0.565);
  millGroup.add(candidateOut.mesh);
  const nonceOut = readout(1.06, 0.28, { caption: 'NONCE', text: '00000000', px: 420 });
  nonceOut.mesh.position.set(-0.6, FLOOR_Y + 0.44, 0.565);
  millGroup.add(nonceOut.mesh);
  const shaLabel = readout(0.98, 0.2, { text: 'SHA-256 x2', px: 400 });
  shaLabel.mesh.position.set(0.66, FLOOR_Y + 0.44, 0.565);
  millGroup.add(shaLabel.mesh);
  const millLampMat = new THREE.MeshBasicMaterial({
    color: NONCE_C,
    transparent: true,
    opacity: 0.2,
    depthWrite: false,
  });
  const millLamp = new THREE.Mesh(new THREE.BoxGeometry(2.22, 0.035, 0.02), millLampMat);
  millLamp.position.set(0, FLOOR_Y + 0.19, 0.57);
  millGroup.add(millLamp);

  // === the target gauge ====================================================
  const gaugeGroup = new THREE.Group();
  gaugeGroup.position.set(GAUGE_X, 0, MILL_Z);
  group.add(gaugeGroup);
  const post = beveledBox(0.11, 3.2, 0.11, millTrim, 0.02);
  post.position.y = FLOOR_Y + 1.6;
  gaugeGroup.add(post);
  for (let z = 0; z <= 24; z++) {
    const major = z % 4 === 0;
    const tick = new THREE.Mesh(
      new THREE.BoxGeometry(major ? 0.19 : 0.11, 0.014, 0.05),
      millTrim,
    );
    tick.position.set(major ? 0.15 : 0.11, gaugeY(z), 0);
    gaugeGroup.add(tick);
  }
  const bandMat = new THREE.MeshBasicMaterial({
    color: VALID,
    transparent: true,
    opacity: 0.85,
    depthWrite: false,
  });
  const band = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.045, 0.08), bandMat);
  band.position.set(0.22, gaugeY(TARGET_ZEROS), 0);
  gaugeGroup.add(band);
  const bandCap = beveledBox(0.5, 0.02, 0.09, millTrim, 0.008);
  bandCap.position.set(0.22, gaugeY(TARGET_ZEROS) + 0.035, 0);
  gaugeGroup.add(bandCap);

  // candidate markers: 20 tries a lap, plotted by how many leading zeros they
  // actually got. Real tries land on 0-2 almost every time; the copy carries
  // the real odds.
  const N_TRY = 20;
  const TRY_ZEROS = [0, 1, 0, 2, 0, 0, 3, 1, 0, 5, 0, 1, 2, 0, 0, 4, 1, 0, 2, 7];
  const tryMarks = [];
  for (let i = 0; i < N_TRY; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: ACCENT,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.BoxGeometry(0.38, 0.05, 0.07), mat);
    m.position.x = 0.25;
    gaugeGroup.add(m);
    tryMarks.push({ m, mat });
  }
  const winMat = new THREE.MeshBasicMaterial({
    color: VALID,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const winMark = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.07, 0.09), winMat);
  winMark.position.set(0.25, gaugeY(TARGET_ZEROS), 0);
  gaugeGroup.add(winMark);

  // === the mempool hopper ==================================================
  const poolGroup = new THREE.Group();
  poolGroup.position.set(-0.9, 0, 2.55);
  group.add(poolGroup);
  const tray = beveledBox(2.1, 0.14, 1.0, millTrim, 0.03);
  tray.position.y = FLOOR_Y + 0.07;
  poolGroup.add(tray);
  for (const sx of [-1, 1]) {
    const wallM = beveledBox(0.06, 0.26, 1.0, millTrim, 0.016);
    wallM.position.set(sx * 1.02, FLOOR_Y + 0.13, 0);
    poolGroup.add(wallM);
  }
  const poolRnd = mulberry32(90210);
  for (let i = 0; i < 16; i++) {
    const mat = materials.polymer(0x1a1e24);
    mat.emissive = new THREE.Color(0x4d99ff);
    mat.emissiveIntensity = 0.18;
    const chip = beveledBox(0.16, 0.1, 0.04, mat, 0.01);
    chip.position.set(
      (poolRnd() - 0.5) * 1.8,
      FLOOR_Y + 0.16 + poolRnd() * 0.05,
      (poolRnd() - 0.5) * 0.78,
    );
    chip.rotation.set(-Math.PI / 2 + (poolRnd() - 0.5) * 0.3, 0, poolRnd() * TAU);
    poolGroup.add(chip);
  }
  // chips in flight, hopper -> block
  const N_FLY = 12;
  const flyers = [];
  for (let i = 0; i < N_FLY; i++) {
    const mat = new THREE.MeshBasicMaterial({
      color: 0x7fb4ff,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const chip = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.09, 0.02), mat);
    group.add(chip);
    const from = new THREE.Vector3(
      -0.9 + (i % 5) * 0.34 - 0.68,
      FLOOR_Y + 0.24,
      2.55 + ((i % 3) - 1) * 0.2,
    );
    const to = new THREE.Vector3(recX(i % N_REC), REC_Y, REC_Z);
    flyers.push({ chip, mat, from, to, lift: 1.2 + (i % 4) * 0.12 });
  }

  // === callouts ============================================================
  labels.add('chain', blocks[3].group, 'Block #964,941', [0, 1.5, 0.2], 78, 66);
  labels.add(
    'chain',
    jointRings[3],
    'Stores the previous block’s hash',
    [0, 0.45, 0],
    118,
    96,
  );
  labels.add(
    'chain',
    blocks[4].group,
    'Its own hash — 19 leading zeros',
    [0, 0.64, BLOCK_D / 2],
    232,
    120,
  );

  labels.add('inside', records[5].card, 'Transaction records', [0.1, -0.2, 0.1], -46, 96);
  labels.add('inside', levels[1][3].node, 'Merkle tree', [0.12, 0.1, 0], 34, 88);
  labels.add('inside', headerBar, 'The 80-byte header', [0.9, 0.05, 0], 22, 96);

  labels.add('mempool', tray, 'Mempool: transactions waiting to be included', [0.7, 0.2, 0], 30, 130);
  labels.add(
    'mempool',
    records[0].card,
    'Coinbase transaction - pays the miner 3.125 BTC',
    [0.05, 0.24, 0.06],
    116,
    138,
  );

  labels.add('merkle', levels[0][5].node, 'One hash per transaction', [0.1, -0.05, 0], -34, 104);
  labels.add('merkle', levels[1][3].node, 'Every pair hashed together', [0.12, 0.06, 0], 26, 112);
  labels.add(
    'merkle',
    rootNode.node,
    'The merkle root — 32 bytes',
    [0.14, 0.12, 0],
    40,
    130,
  );

  labels.add('header', prevField.slot, 'Previous block hash - 32 bytes', [0, 0.16, 0.04], 58, 120);
  labels.add('header', rootField.slot, 'Merkle root - 32 bytes', [0, -0.16, 0.04], -62, 100);
  labels.add('header', nonceField.slot, 'Nonce - 4 bytes', [0.04, 0.16, 0.04], 52, 92);
  labels.add('header', headerBar, 'Hashed twice with SHA-256', [-0.6, -0.2, 0.06], -20, 150);

  labels.add('mine', nonceOut.mesh, 'The 4 bytes a miner can change', [0.3, -0.1, 0], -34, 130);
  labels.add('mine', candidateOut.mesh, 'Each guess: a brand-new hash', [-0.6, 0.24, 0], 40, 120);
  labels.add('mine', band, 'Target: 19 leading zeros', [0.24, 0.06, 0], 26, 110);

  labels.add(
    'link',
    hero.socket.group,
    'Teeth cut from this block’s own hash',
    [0.2, -0.3, 0.1],
    -124,
    124,
  );
  labels.add(
    'link',
    blocks[3].plug.group,
    'The next block’s copy of it',
    [-0.2, 0.34, 0.1],
    76,
    142,
  );

  labels.add('tamper', records[3].card, 'One record edited', [0.06, 0.22, 0.06], 58, 112);
  labels.add('tamper', rootNode.node, 'Merkle root changes', [0.14, 0.1, 0], 38, 108);
  labels.add(
    'tamper',
    jointRings[2],
    'The link no longer fits',
    [0, 0.42, 0],
    64,
    150,
  );

  labels.add('fork', forkOrphan.group, 'Two miners, two valid blocks', [0, 1.5, 0.2], 62, 110);
  labels.add('fork', forkChild.group, 'The chain with the most work wins', [0, 1.5, 0.2], 44, 128);

  // === state ===============================================================
  const state = {
    phase: 0,
    reveal: 0,
    feed: 0,
    merkleAmt: 0,
    millAmt: 0,
    mineAmt: 0,
    linkAmt: 0,
    tamperAmt: 0,
    forkAmt: 0,
    chainPulse: 0,
    rig: 0,
  };

  const HOME = new THREE.Vector3();
  const DOCK_V = new THREE.Vector3(DOCK[0], DOCK[1], DOCK[2]);
  const heroTeeth = teethOf(hero.seed);
  const badTeeth = teethOf(hero.seed + 991);
  const heroGoodHash = goodHash(hero.seed);
  const heroBadHash = failHash(hero.seed + 991);
  const CAND = Array.from({ length: 12 }, (_, i) => failHash(500 + i * 13));
  const WIN_NONCE = 0xf3a7c204;
  const winHash = goodHash(hero.seed);

  function apply() {
    const ph = clamp01(state.phase);
    const rev = clamp01(state.reveal);
    const tam = clamp01(state.tamperAmt) * smooth(triangle(ph));

    // --- hero opens: the lid is lifted clear and set down on the rail behind
    // the block (a lid left hovering over the case flies straight through
    // every camera that looks past it), and the front panel hinges down
    const rv = smooth(rev);
    hero.lid.position.y = lerp(LID_Y, PLINTH_H + LID_H / 2 + 0.01, rv) + 0.5 * Math.sin(Math.PI * rv);
    hero.lid.position.z = -1.5 * rv;
    hero.lid.rotation.y = 0.07 * rv;
    hero.frontPivot.rotation.x = 1.05 * rv;

    // --- merkle tree rises out of the block --------------------------------
    treeGroup.position.y = -TREE_TUCK * (1 - smooth(rev));
    treeGroup.visible = rev > 0.02;
    const leafBottom = LEVEL_Y[0] - 0.075 + treeGroup.position.y;
    for (let i = 0; i < N_REC; i++) {
      const len = leafBottom - REC_TOP;
      stems[i].visible = rev > 0.45 && len > 0.02;
      if (stems[i].visible) {
        stems[i].position.y = REC_TOP + len / 2;
        stems[i].scale.y = len;
      }
    }

    // --- the header: tucked inside, raised on reveal, docked at the mill ---
    HOME.set(0, lerp(HEADER_TUCK_Y, HEADER_Y, smooth(rev)), 0);
    const mill = smooth(clamp01(state.millAmt));
    headerGroup.position.copy(HOME).lerp(DOCK_V, mill);
    headerGroup.position.z = HOME.z + (DOCK_V.z - HOME.z) * mill;
    headerGroup.visible = rev > 0.02 || mill > 0.02;

    // --- transaction records ----------------------------------------------
    for (let i = 0; i < N_REC; i++) {
      const r = records[i];
      const edited = i === 3 ? tam : 0;
      r.card.rotation.z = 0.22 * edited;
      r.card.position.z = REC_Z + 0.09 * edited;
      r.mat.emissive.setHex(edited > 0.02 ? BAD : i === 0 ? ACCENT : 0x4d99ff);
      r.mat.emissiveIntensity = 0.1 + 0.7 * edited + 0.25 * state.feed;
      r.strip.material.color.setHex(edited > 0.02 ? BAD : i === 0 ? ACCENT : 0x7fb4ff);
    }

    // --- mempool feed ------------------------------------------------------
    poolGroup.visible = state.feed > 0.02;
    poolDeck.visible = state.feed > 0.02;
    for (let i = 0; i < N_FLY; i++) {
      const f = flyers[i];
      const u = (ph + i / N_FLY) % 1;
      const op = state.feed * Math.sin(Math.PI * u) ** 0.7;
      f.mat.opacity = op * 0.95;
      f.chip.visible = op > 0.01;
      if (f.chip.visible) {
        f.chip.position.lerpVectors(f.from, f.to, u);
        f.chip.position.y += Math.sin(Math.PI * u) * f.lift;
        f.chip.rotation.y = u * TAU;
      }
    }

    // --- merkle pulses -----------------------------------------------------
    const mk = clamp01(state.merkleAmt);
    for (let i = 0; i < N_REC; i++) {
      const p = pulses[i];
      const u = clamp01((ph - i * 0.022) / 0.55);
      const op = mk * win(u, 0, 0.06) * (1 - win(u, 0.86, 1));
      p.mesh.material.opacity = op;
      p.mesh.visible = op > 0.01;
      if (p.mesh.visible) {
        const seg = clamp01(u) * 3;
        const k = Math.min(2, Math.floor(seg));
        p.mesh.position.lerpVectors(p.path[k], p.path[k + 1], smooth(seg - k));
      }
    }
    const rootGlow = mk * Math.max(0, Math.sin(Math.PI * clamp01((ph - 0.5) / 0.42)));
    rootNode.mat.emissiveIntensity = 0.6 + 1.9 * rootGlow;
    for (let lv = 0; lv < 3; lv++) {
      for (const nd of levels[lv]) {
        nd.mat.emissive.setHex(tam > 0.35 ? BAD : ACCENT);
        nd.mat.emissiveIntensity = 0.26 + 0.5 * mk + 0.6 * tam;
      }
    }
    rootNode.mat.emissive.setHex(tam > 0.35 ? BAD : VALID);
    rootField.mat.emissive.setHex(tam > 0.35 ? BAD : VALID);
    prevField.mat.emissiveIntensity = 0.55 + 0.5 * mill;

    // --- the mill: nonce sweep, candidates, the target gauge ---------------
    // The rig is only in the scene for the steps that are about it; parked in
    // every other shot it is just background clutter in front of the chain.
    const rigOn = clamp01(state.rig) > 0.02;
    millGroup.visible = rigOn;
    gaugeGroup.visible = rigOn;
    millDeck.visible = rigOn;
    const mine = clamp01(state.mineAmt);
    const sweep = clamp01(ph / 0.84);
    const found = win(ph, 0.84, 0.88) * (1 - win(ph, 0.94, 1));
    const live = win(ph, 0, 0.04) * (1 - win(ph, 0.94, 1));
    nonceOut.mat.opacity = mine ? live : 1;
    candidateOut.mat.opacity = mine ? live : 1;
    if (mine > 0.02) {
      nonceOut.set(hex8(Math.floor(sweep * WIN_NONCE)));
      if (ph >= 0.84) candidateOut.set(winHash, TARGET_ZEROS, '#3ddc84');
      else candidateOut.set(CAND[Math.floor(ph * 36) % 12], 0);
      millLampMat.color.setHex(found > 0.5 ? VALID : NONCE_C);
      millLampMat.opacity = 0.25 + 0.65 * (found > 0.02 ? found : 0.35 + 0.4 * triangle(sweep));
      nonceField.mat.emissive.setHex(found > 0.5 ? VALID : NONCE_C);
      nonceField.mat.emissiveIntensity = 0.55 + 1.4 * (found > 0.02 ? found : triangle(sweep));
    } else {
      nonceOut.set('00000000');
      candidateOut.set(CAND[0], 0);
      millLampMat.color.setHex(NONCE_C);
      millLampMat.opacity = 0.22;
      nonceField.mat.emissive.setHex(NONCE_C);
      nonceField.mat.emissiveIntensity = 0.55;
    }
    for (let i = 0; i < N_TRY; i++) {
      const t = tryMarks[i];
      const u = clamp01((ph - i * 0.039) / 0.1);
      const op = mine * (u > 0 && u < 1 ? Math.sin(Math.PI * u) : 0);
      t.mat.opacity = op * 0.9;
      t.m.visible = op > 0.01;
      if (t.m.visible) t.m.position.y = gaugeY(TRY_ZEROS[i]);
    }
    winMat.opacity = mine * found;
    winMark.visible = winMat.opacity > 0.01;
    bandMat.opacity = 0.35 + 0.5 * mine;

    // --- couplings: the link demo and the tamper break ---------------------
    hero.socket.setTeeth(
      heroTeeth.map((v, i) => lerp(v, badTeeth[i], tam > 0.35 ? smooth(win(tam, 0.35, 0.6)) : 0)),
    );
    const heroBad = tam > 0.35;
    hero.hashPlate.set(
      heroBad ? heroBadHash : heroGoodHash,
      heroBad ? 0 : TARGET_ZEROS,
      heroBad ? '#ff5c5c' : '#f0a63a',
    );
    // the tamper pushes the next block's plug off its seat; the link demo
    // pulls the same plug out and lets it drop back on
    let overlap = 0;
    for (let i = 0; i < 12; i++) {
      overlap = Math.max(
        overlap,
        hero.socket.height(i) + blocks[3].plug.height(i) - TOOTH_GAP,
      );
    }
    const pulled = clamp01(state.linkAmt) * smooth(triangle(ph)) * 0.36;
    blocks[3].plug.group.position.x = -FLANGE_X + overlap + pulled;
    blocks[3].plug.group.rotation.z = -0.05 * (overlap / 0.16) * Math.min(1, tam * 2);
    const seated = clamp01(state.linkAmt) * (1 - smooth(triangle(ph)));

    // joint rings: the chain pulse, the seat flash and the tamper break
    for (let i = 0; i < jointRings.length; i++) {
      const ring = jointRings[i];
      const head = ph * (jointRings.length + 0.7);
      const run =
        state.chainPulse *
        Math.max(0, 1 - Math.abs(head - i) * 1.9) *
        win(ph, 0, 0.06) *
        (1 - win(ph, 0.93, 1));
      const broken = i === 2 ? tam : 0;
      const seat = i === 2 ? seated : 0;
      ring.material.color.setHex(broken > 0.3 ? BAD : seat > 0.05 ? VALID : ACCENT);
      ring.material.opacity = clamp01(run + broken * 0.9 + seat * 0.8);
      ring.visible = ring.material.opacity > 0.01;
      ring.scale.setScalar(1 + 0.18 * seat + 0.1 * broken);
    }
    // downstream blocks go red: every block after the edit would need re-mining
    for (let i = 0; i < N_CHAIN; i++) {
      const downstream = i > HERO_I ? tam : 0;
      blocks[i].shell.emissive.setHex(BAD);
      blocks[i].shell.emissiveIntensity = 0.12 * downstream;
      if (i > HERO_I) {
        blocks[i].hashPlate.set(
          downstream > 0.35 ? failHash(blocks[i].seed + 5) : goodHash(blocks[i].seed),
          downstream > 0.35 ? 0 : TARGET_ZEROS,
          downstream > 0.35 ? '#ff5c5c' : '#f0a63a',
        );
      }
    }

    // --- the fork -----------------------------------------------------------
    const fk = clamp01(state.forkAmt);
    const born = win(ph, 0.06, 0.24);
    const childBorn = win(ph, 0.36, 0.52);
    const lost = win(ph, 0.56, 0.74);
    const clear = win(ph, 0.86, 0.99);
    const sMain = fk * born * (1 - clear);
    const sChild = fk * childBorn * (1 - clear);
    const sOrphan = fk * born * (1 - clear);
    forkMain.group.visible = sMain > 0.02;
    forkMain.group.scale.setScalar(Math.max(0.001, sMain));
    forkChild.group.visible = sChild > 0.02;
    forkChild.group.scale.setScalar(Math.max(0.001, sChild));
    forkOrphan.group.visible = sOrphan > 0.02;
    forkOrphan.group.scale.setScalar(Math.max(0.001, sOrphan));
    orphanStay.visible = sOrphan > 0.02;
    orphanStay.scale.y = Math.max(0.001, 1 - lost);
    orphanStay.position.y = MID_Y + (ORPHAN_LIFT / 2) * Math.max(0.001, 1 - lost);
    forkOrphan.group.position.y = ORPHAN_LIFT + 0.55 * lost;
    forkOrphan.group.position.z = 0.9 * lost;
    forkOrphan.shell.emissive.setHex(BAD);
    forkOrphan.shell.emissiveIntensity = 0.24 * lost;
    forkOrphan.hashPlate.mat.opacity = 1 - 0.75 * lost;
    forkOrphan.idPlate.mat.opacity = 1 - 0.75 * lost;
    forkOrphan.plug.group.position.x = -FLANGE_X - 0.5 * lost;
    for (const b of [forkMain, forkChild]) {
      b.shell.emissive.setHex(VALID);
      b.shell.emissiveIntensity = 0.1 * fk * (1 - lost * 0.4);
    }
  }
  apply();

  return {
    group,
    parts: {
      lid: hero.lid,
      front: hero.frontPivot,
      tree: treeGroup,
      header: headerGroup,
      plug: blocks[3].plug.group,
      orphan: forkOrphan.group,
      records: records.map((r) => r.card),
      marks: tryMarks.map((t) => t.m),
    },
    setLabels: labels.setLabels,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
  };
}
