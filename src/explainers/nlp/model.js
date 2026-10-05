import * as THREE from 'three';
import { CSS2DObject } from 'three/addons/renderers/CSS2DRenderer.js';
import { materials, rod, studioPlinth } from '../../framework/parts.js';
import { beveledBox } from '../../framework/geometry.js';
import { clamp01, smooth, win, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// How a language model reads text: the GPT-2-small pipeline as a
// tabletop machine. Text is not a physical thing, so this follows the
// binary-search precedent (data as parts), but the story shape is zoom-in /
// reveal: a SEALED console (tape in, one word out) whose shell is removed to
// show the stations inside, laid out left→right on one bench:
//
//   tokenizer → token IDs → lookup table (embedding) → meaning space →
//   attention → 12 stacked layers → next-piece odds → append
//
// Reference facts (checked against the real GPT-2 tokenizer via tiktoken):
//  - "The cat didn't eat the fish because it was" encodes to exactly these ten
//    BPE tokens and IDs — "didn't" genuinely splits into " didn" + "'t", and
//    " stale" is the single token 39985.
//  - GPT-2 small: vocab 50,257, 768 numbers per token (the embedding matrix is
//    50,257 × 768 = 38.6 M numbers), 12 layers, 12 heads, context 1,024.
//  - Causal attention: a token may only attend to itself and EARLIER tokens.
//  - GPT-2 ties its output layer to the input table: the final vector is
//    scored against the same 50,257 rows it was looked up from.
// Disclosed illustrations: the attention weights, the next-piece odds, the
// 3-D "meaning space" (768 dims squashed to 3) and the vector values
// themselves (seeded noise, shown with the true 768-cell count).
//
// Proportions all derive from the slug: CHAR_W per character, one card is
// 16 × 48 cells = 768, the console shell wraps the whole bench.

const TOKENS = [
  ['The', 464],
  ['cat', 3797],
  ['didn', 1422],
  ["'t", 470],
  ['eat', 4483],
  ['the', 262],
  ['fish', 5916],
  ['because', 780],
  ['it', 340],
  ['was', 373],
];
const NEXT = ['stale', 39985];
const ALL = [...TOKENS, NEXT];
const N = TOKENS.length; // 10 input tokens
const IT = 8;
const WAS = 9;
const VOCAB = 50257;

// Illustrative attention of " it" over itself and the tokens before it —
// sums to exactly 1.00; " was" (the future) gets nothing.
const ATTN = [0.03, 0.31, 0.02, 0.02, 0.06, 0.04, 0.37, 0.05, 0.1];
// Illustrative next-piece odds after "... because it was" — sums to 1.00.
const ODDS = [
  ['stale', 0.27],
  ['too', 0.2],
  ['full', 0.13],
  ['rotten', 0.1],
  ['hungry', 0.09],
  ['50,252 more', 0.21],
];

const ACCENT = 0xff8fb8;
const POS_RGB = [255, 95, 162]; // positive value
const NEG_RGB = [63, 182, 255]; // negative value
const ZERO_RGB = [20, 23, 28];

const PLINTH_H = 0.22;
const TRAY_H = 0.04;
const TRAY_TOP = PLINTH_H + TRAY_H;
const SLUG_H = 0.22;
const SLUG_D = 0.3;
const SLUG_Z = 0.12;
const SLUG_Y = TRAY_TOP + SLUG_H / 2;
const SLUG_TOP = TRAY_TOP + SLUG_H;
const SLUG_FRONT = SLUG_Z + SLUG_D / 2;
const CHAR_W = 0.075;
const SLUG_PAD = 0.16;
const GAP = 0.1;

const CARD_W = 0.22; // 16 cells
const CARD_H = 0.66; // 48 cells → 16 × 48 = 768
const CARD_Z = 0.02;
const CARD_TOP = SLUG_TOP + CARD_H;

const W = ALL.map(([t]) => SLUG_PAD + CHAR_W * t.length);
const SPAN = W.reduce((a, b) => a + b, 0) + GAP * (ALL.length - 1);
const X0 = -SPAN / 2;
const CUM = [];
{
  let c = 0;
  for (const w of W) {
    CUM.push(c);
    c += w;
  }
}
const joinedX = (i) => X0 + CUM[i] + W[i] / 2;
export const sepX = (i) => joinedX(i) + GAP * i;
// boundary between token k and k+1 once everything left of it has opened
const sepB = (k) => X0 + CUM[k + 1] + GAP * k + GAP / 2;
const BLADE_X0 = X0 - 0.3;
const BLADE_X1 = sepB(N - 2) + 0.4;
const BLADE_R = 0.16;
const BLADE_REST_Y = SLUG_TOP + BLADE_R + 0.07;
const RAIL_Y = 1.06;

const WALL_Z = -0.78;
const WALL_W = SPAN + 0.2;
const WALL_Y0 = 0.34;
const WALL_H = 1.25;

const CLOUD = new THREE.Vector3(0.35, 2.75, -0.2);
const CLOUD_HALF = 0.72;

const PLATE_Y0 = 1.24;
const PLATE_DY = 0.085;
const PLATES = 12;
const RISE_H = 1.8;

const CHART_X = 1.45;
const CHART_Y = 1.36; // shelf top
const CHART_Z = -0.5;
const BAR_MAX_H = 0.62;

const SHELL = { x0: -3.12, x1: 3.12, y0: PLINTH_H, y1: 1.86, z0: -0.98, z1: 0.58 };
const STRIP_Y = 0.5;
const STRIP_Z = 0.15;
const REEL_X = -3.95;
const REEL_R = 0.15;

const lerp = (a, b, t) => a + (b - a) * t;

// In-scene word tags. Not THREE.Sprites: the stage's GTAOPass renders every
// sprite quad as an opaque surface in its normal pass, so sprite text leaves a
// dark AO box behind it. CSS2D text never enters the WebGL passes.
function wordTag(text, color = '#dfe4ea', px = 13) {
  const el = document.createElement('div');
  el.textContent = text;
  el.style.cssText = `pointer-events:none;font:600 ${px}px "Segoe UI",sans-serif;color:${color};white-space:nowrap;text-shadow:0 1px 3px rgba(0,0,0,.9);transform:translateY(-60%);`;
  const obj = new CSS2DObject(el);
  obj.visible = false;
  return obj;
}

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function vector(seed) {
  const r = rng(seed);
  const v = new Float32Array(768);
  for (let i = 0; i < 768; i++) v[i] = Math.max(-1, Math.min(1, (r() + r() + r() - 1.5) / 0.85));
  return v;
}

function normalized(v) {
  let m = 1e-6;
  for (const x of v) m = Math.max(m, Math.abs(x));
  return v.map((x) => x / m);
}

function cellRGB(x) {
  const k = Math.pow(Math.min(1, Math.abs(x)), 0.8);
  const to = x >= 0 ? POS_RGB : NEG_RGB;
  return ZERO_RGB.map((z, c) => Math.round(z + (to[c] - z) * k));
}

// 16 × 48 canvas, one pixel per number — the card literally carries 768 cells
function vecTexture(v) {
  const canvas = document.createElement('canvas');
  canvas.width = 16;
  canvas.height = 48;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(16, 48);
  for (let i = 0; i < 768; i++) {
    const [r, g, b] = cellRGB(v[i]);
    img.data[i * 4] = r;
    img.data[i * 4 + 1] = g;
    img.data[i * 4 + 2] = b;
    img.data[i * 4 + 3] = 255;
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.magFilter = THREE.NearestFilter;
  return tex;
}

function textTexture(lines, { w = 256, h = 64, color = '#c9d0da', font = 600, size = 44 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = color;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.font = `${font} ${size}px "Segoe UI", sans-serif`;
  const arr = Array.isArray(lines) ? lines : [lines];
  arr.forEach((ln, i) => ctx.fillText(ln, w / 2, (h * (i + 0.5)) / arr.length + 2));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

function textPlane(lines, pw, ph, opts = {}) {
  const px = 128;
  const tex = textTexture(lines, {
    w: Math.round((px * pw) / ph),
    h: px,
    size: opts.size ?? 76,
    color: opts.color,
    font: opts.font,
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
}

function tableTexture() {
  const cw = 128;
  const chh = 512;
  const canvas = document.createElement('canvas');
  canvas.width = cw;
  canvas.height = chh;
  const ctx = canvas.getContext('2d');
  const img = ctx.createImageData(cw, chh);
  const r = rng(50257);
  for (let y = 0; y < chh; y++) {
    for (let x = 0; x < cw; x++) {
      const v = (r() + r() - 1) * 0.55;
      const [cr, cg, cb] = cellRGB(v);
      const o = (y * cw + x) * 4;
      // every other pixel-row darker, so it reads as stacked rows
      const k = y % 2 ? 0.55 : 1;
      img.data[o] = cr * k;
      img.data[o + 1] = cg * k;
      img.data[o + 2] = cb * k;
      img.data[o + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// the tape: the input sentence, repeating, scrolling into the console
function tapeTexture() {
  const canvas = document.createElement('canvas');
  canvas.width = 1024;
  canvas.height = 64;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#16191e';
  ctx.fillRect(0, 0, 1024, 64);
  ctx.fillStyle = '#d6dbe2';
  ctx.font = '600 34px "Segoe UI", sans-serif';
  ctx.textBaseline = 'middle';
  ctx.textAlign = 'center';
  ctx.fillText("The cat didn't eat the fish because it was  ·", 512, 34);
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.repeat.x = 0.62;
  tex.anisotropy = 4;
  return tex;
}

const rowY = (id) =>
  WALL_Y0 + WALL_H - 0.06 - (WALL_H - 0.12) * (Math.log(1 + id) / Math.log(1 + VOCAB));

// shaft + cone pointing along local +Y, scaled to a length at pose time
function makeArrow(color, radius = 0.011, headR = 0.034, headL = 0.09) {
  const mat = new THREE.MeshBasicMaterial({ color, transparent: true, depthWrite: false });
  const g = new THREE.Group();
  const shaftGeo = new THREE.CylinderGeometry(radius, radius, 1, 10);
  shaftGeo.translate(0, 0.5, 0);
  const shaft = new THREE.Mesh(shaftGeo, mat);
  const cone = new THREE.Mesh(new THREE.ConeGeometry(headR, headL, 14), mat);
  g.add(shaft, cone);
  const Y = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  g.userData.set = (from, to, t) => {
    dir.subVectors(to, from);
    const L = dir.length() * t;
    g.visible = t > 0.01;
    if (!g.visible) return;
    dir.normalize();
    g.position.copy(from);
    g.quaternion.setFromUnitVectors(Y, dir);
    shaft.scale.y = Math.max(0.001, L - headL);
    cone.position.y = Math.max(headL / 2, L - headL / 2);
  };
  g.userData.mat = mat;
  return g;
}

export function buildNlp({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  const labels = calloutSets(['exterior', 'tokens', 'embed', 'cloud', 'attention', 'layers', 'predict']);

  const plinthX0 = REEL_X - REEL_R - 0.2;
  const plinthX1 = SHELL.x1 + 0.3;
  const plinth = studioPlinth({ w: plinthX1 - plinthX0, h: PLINTH_H, d: 2.1, color: 0x15171b });
  plinth.position.set((plinthX0 + plinthX1) / 2, PLINTH_H / 2, -0.2);
  group.add(plinth);

  // ------------------------------------------------------------------ tape
  const tapeTex = tapeTexture();
  const stripLen = SHELL.x0 - REEL_X;
  const strip = new THREE.Mesh(
    new THREE.PlaneGeometry(stripLen, 0.13),
    new THREE.MeshStandardMaterial({ map: tapeTex, roughness: 0.8, metalness: 0 }),
  );
  strip.position.set((REEL_X + SHELL.x0) / 2, STRIP_Y, STRIP_Z);
  group.add(strip);

  const reel = new THREE.Group();
  reel.position.set(REEL_X, STRIP_Y, STRIP_Z - REEL_R);
  group.add(reel);
  const reelMat = materials.polymer(0x2a2e35);
  const wound = new THREE.Mesh(
    new THREE.CylinderGeometry(REEL_R - 0.004, REEL_R - 0.004, 0.13, 40),
    new THREE.MeshStandardMaterial({ color: 0x1b1e23, roughness: 0.85 }),
  );
  reel.add(wound);
  for (const s of [-1, 1]) {
    const flange = new THREE.Mesh(new THREE.CylinderGeometry(REEL_R + 0.03, REEL_R + 0.03, 0.012, 40), reelMat);
    flange.position.y = s * 0.072;
    reel.add(flange);
  }
  // spokes on the top flange, so the reel's turning reads
  for (let k = 0; k < 3; k++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(REEL_R * 1.7, 0.006, 0.022), materials.polymer(0x4a505a));
    spoke.position.y = 0.08;
    spoke.rotation.y = (k * TAU) / 3;
    reel.add(spoke);
  }
  const post = rod(0.02, STRIP_Y - PLINTH_H - 0.08, materials.polymer(0x30343b));
  post.position.set(REEL_X, PLINTH_H, STRIP_Z - REEL_R);
  group.add(post);

  // -------------------------------------------------------------- shell
  const shell = new THREE.Group();
  group.add(shell);
  const shellMat = materials.polymer(0x2a2e35);
  const shellW = SHELL.x1 - SHELL.x0;
  const shellH = SHELL.y1 - SHELL.y0;
  const shellD = SHELL.z1 - SHELL.z0;
  const body = beveledBox(shellW, shellH, shellD, shellMat, 0.08);
  body.position.set((SHELL.x0 + SHELL.x1) / 2, SHELL.y0 + shellH / 2, (SHELL.z0 + SHELL.z1) / 2);
  body.receiveShadow = true;
  shell.add(body);
  const darkMat = materials.polymer(0x0e1013);
  // intake slot on the left face — the tape disappears into it
  const slot = new THREE.Mesh(new THREE.BoxGeometry(0.02, 0.2, 0.5), darkMat);
  slot.position.set(SHELL.x0 - 0.002, STRIP_Y, STRIP_Z - 0.1);
  shell.add(slot);
  // vent slots along the top
  for (let k = 0; k < 13; k++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.01, 0.05), darkMat);
    v.position.set(-2.3 + k * 0.38, SHELL.y1 + 0.001, -0.42);
    shell.add(v);
  }
  // accent seam along the front foot
  const seamMat = new THREE.MeshBasicMaterial({ color: ACCENT });
  const seam = new THREE.Mesh(new THREE.BoxGeometry(shellW - 0.3, 0.012, 0.01), seamMat);
  seam.position.set(0, SHELL.y0 + 0.13, SHELL.z1 + 0.002);
  shell.add(seam);
  // output display
  const bezel = beveledBox(1.34, 0.44, 0.04, materials.polymer(0x121418), 0.02);
  bezel.position.set(1.95, 1.34, SHELL.z1 + 0.01);
  shell.add(bezel);
  const screen = textPlane('stale', 1.16, 0.3, { color: '#ff8fb8', size: 88 });
  screen.position.set(1.95, 1.34, SHELL.z1 + 0.032);
  shell.add(screen);
  const screenCaption = textPlane('NEXT WORD', 0.7, 0.07, { color: '#7c8592', size: 70 });
  screenCaption.position.set(1.95, 1.62, SHELL.z1 + 0.002);
  shell.add(screenCaption);
  const inCaption = textPlane('TEXT IN', 0.46, 0.07, { color: '#7c8592', size: 70 });
  inCaption.position.set(SHELL.x0 + 0.45, 0.82, SHELL.z1 + 0.002);
  shell.add(inCaption);
  const inArrow = textPlane('→', 0.2, 0.12, { color: '#7c8592', size: 100 });
  inArrow.position.set(SHELL.x0 + 0.45, 0.68, SHELL.z1 + 0.002);
  shell.add(inArrow);
  labels.add('exterior', strip, 'Text goes in', [0.25, 0.07, 0], 95, 55);
  labels.add('exterior', bezel, 'One next word comes out', [0.45, 0.2, 0.02], 45, 45);

  // -------------------------------------------------------------- inside
  const inner = new THREE.Group();
  group.add(inner);

  const trayMat = materials.polymer(0x383d45);
  const tray = beveledBox(SPAN + 0.24, TRAY_H, SLUG_D + 0.14, trayMat, 0.012);
  tray.position.set(0, PLINTH_H + TRAY_H / 2, SLUG_Z);
  inner.add(tray);

  // --- lookup table wall
  const wall = new THREE.Group();
  inner.add(wall);
  const wallFrame = beveledBox(WALL_W + 0.1, WALL_H + 0.1, 0.05, materials.polymer(0x1a1d22), 0.02);
  wallFrame.position.set(0, WALL_Y0 + WALL_H / 2, WALL_Z - 0.03);
  wall.add(wallFrame);
  const wallFace = new THREE.Mesh(
    new THREE.PlaneGeometry(WALL_W, WALL_H),
    new THREE.MeshBasicMaterial({ map: tableTexture(), color: 0x8a8f99 }),
  );
  wallFace.position.set(0, WALL_Y0 + WALL_H / 2, WALL_Z);
  wall.add(wallFace);
  labels.add('embed', wallFrame, 'Lookup table: 50,257 rows', [WALL_W / 2 - 0.35, WALL_H / 2 + 0.05, 0.03], 35, 40);

  // --- tokens: slug + front text + ID + card
  const tokens = ALL.map(([text, id], i) => {
    const tg = new THREE.Group();
    tg.position.x = sepX(i);
    inner.add(tg);
    const isNext = i === N;
    const slugMat = materials.polymer(isNext ? 0x3a2530 : 0x252930);
    slugMat.emissive = new THREE.Color(ACCENT);
    slugMat.emissiveIntensity = 0;
    const slug = beveledBox(W[i] - 0.015, SLUG_H, SLUG_D, slugMat, 0.025);
    slug.position.set(0, SLUG_Y, SLUG_Z);
    tg.add(slug);
    const word = textPlane(text, W[i] - 0.06, 0.1, { color: '#d2d8e0', size: 84 });
    word.position.set(0, SLUG_Y + 0.045, SLUG_FRONT + 0.002);
    tg.add(word);
    const idPlane = textPlane(String(id), W[i] - 0.05, 0.07, { color: '#ff8fb8', size: 84, font: 700 });
    idPlane.position.set(0, SLUG_Y - 0.055, SLUG_FRONT + 0.002);
    tg.add(idPlane);

    const rise = new THREE.Group();
    tg.add(rise);
    const cg = new THREE.Group();
    cg.position.set(0, SLUG_TOP, CARD_Z);
    rise.add(cg);
    const token = { i, text, id, tg, slug, slugMat, word, idPlane, rise, cg };
    if (isNext) return token;

    const v = normalized(vector(id * 7 + 13));
    token.v = v;
    const backing = beveledBox(CARD_W + 0.03, CARD_H + 0.03, 0.02, materials.polymer(0x101216), 0.008);
    backing.position.y = CARD_H / 2;
    cg.add(backing);
    const cardMat = new THREE.MeshBasicMaterial({ map: vecTexture(v) });
    const card = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), cardMat);
    card.position.set(0, CARD_H / 2, 0.0115);
    cg.add(card);
    token.cardMat = cardMat;
    return token;
  });
  const next = tokens[N];

  // "context" overlays — what each card looks like after the layers have
  // mixed in the tokens before it (causal: only earlier tokens)
  tokens.slice(0, N).forEach((t, i) => {
    const r = rng(t.id + 99);
    const ctxV = new Float32Array(768);
    for (let k = 0; k < 768; k++) {
      let acc = 0.55 * t.v[k];
      for (let j = 0; j <= i; j++) acc += (0.45 / (i + 1)) * tokens[j].v[k];
      ctxV[k] = acc + (r() - 0.5) * 0.35;
    }
    const mat = new THREE.MeshBasicMaterial({
      map: vecTexture(normalized(ctxV)),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    });
    const m = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), mat);
    m.position.set(0, CARD_H / 2, 0.013);
    t.cg.add(m);
    t.ctxMat = mat;
  });
  // attention output for " it": the weighted sum of the value cards
  const attnV = new Float32Array(768);
  ATTN.forEach((w, j) => {
    for (let k = 0; k < 768; k++) attnV[k] += w * tokens[j].v[k];
  });
  const attnMat = new THREE.MeshBasicMaterial({
    map: vecTexture(normalized(attnV)),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const attnCard = new THREE.Mesh(new THREE.PlaneGeometry(CARD_W, CARD_H), attnMat);
  attnCard.position.set(0, CARD_H / 2, 0.0145);
  tokens[IT].cg.add(attnCard);

  labels.add('tokens', tokens[3].tg, "didn't = didn + 't", [0, SLUG_TOP + 0.01, SLUG_Z], 75, 70);
  labels.add('tokens', tokens[6].tg, 'Token ID: fish = 5916', [0.05, SLUG_Y - 0.06, SLUG_FRONT + 0.01], -55, 45);
  labels.add('embed', tokens[WAS].tg, '768 numbers per token', [CARD_W / 2, SLUG_TOP + CARD_H * 0.8, CARD_Z], 25, 40);

  // --- embedding hand-off: one glowing row per token + a packet flying out
  const rowMats = [];
  const packets = [];
  tokens.slice(0, N).forEach((t, i) => {
    const m = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthWrite: false });
    const row = new THREE.Mesh(new THREE.PlaneGeometry(WALL_W - 0.04, 0.016), m);
    row.position.set(0, rowY(t.id), WALL_Z + 0.004);
    wall.add(row);
    rowMats.push(m);
    const p = new THREE.Mesh(new THREE.BoxGeometry(CARD_W, 0.022, 0.03), new THREE.MeshBasicMaterial({ color: ACCENT }));
    p.visible = false;
    inner.add(p);
    packets.push(p);
  });
  const embedStart = (i) => 0.04 + i * 0.034;

  // --- tokenizer: a disc cutter on a gantry above the row
  const gantry = new THREE.Group();
  inner.add(gantry);
  const railMat = materials.brushedSteel(0x9aa4b0);
  railMat.roughness = 0.65;
  const rail = rod(0.022, SPAN + 0.7, railMat);
  rail.rotation.z = -Math.PI / 2;
  rail.position.set(X0 - 0.35, RAIL_Y, SLUG_Z);
  gantry.add(rail);
  for (const x of [X0 - 0.35, -X0 + 0.35]) {
    const leg = rod(0.022, RAIL_Y - PLINTH_H, railMat);
    leg.position.set(x, PLINTH_H, SLUG_Z);
    gantry.add(leg);
  }
  const carriage = new THREE.Group();
  carriage.position.z = SLUG_Z;
  gantry.add(carriage);
  const carBox = beveledBox(0.16, 0.1, 0.12, materials.polymer(0x30343b), 0.02);
  carBox.position.y = RAIL_Y;
  carriage.add(carBox);
  const armMat = materials.polymer(0x30343b);
  const arm = rod(0.014, 1, armMat);
  carriage.add(arm);
  const bladeGroup = new THREE.Group();
  carriage.add(bladeGroup);
  // the disc lies in the cut plane (edge-on to a front camera), so its rim
  // glows and a housing sits on top — the cutter reads from the front
  const bladeMat = new THREE.MeshStandardMaterial({
    color: 0x9aa2ad,
    metalness: 0.6,
    roughness: 0.35,
    emissive: new THREE.Color(ACCENT),
    emissiveIntensity: 0.4,
  });
  const blade = new THREE.Mesh(new THREE.CylinderGeometry(BLADE_R, BLADE_R, 0.016, 36), bladeMat);
  blade.rotation.z = Math.PI / 2;
  bladeGroup.add(blade);
  const head = beveledBox(0.2, 0.13, SLUG_D + 0.06, materials.polymer(0x3a3f47), 0.025);
  head.position.y = BLADE_R * 0.55;
  bladeGroup.add(head);
  const headStripe = new THREE.Mesh(new THREE.BoxGeometry(0.2, 0.014, 0.004), seamMat);
  headStripe.position.set(0, BLADE_R * 0.55, (SLUG_D + 0.06) / 2 + 0.002);
  bladeGroup.add(headStripe);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 20), materials.polymer(0x1a1d22));
  hub.rotation.z = Math.PI / 2;
  bladeGroup.add(hub);
  // four relief slots so the spin reads
  const spinner = new THREE.Group();
  bladeGroup.add(spinner);
  for (let k = 0; k < 4; k++) {
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.07, 0.016), darkMat);
    const a = (k * TAU) / 4;
    s.position.set(0, Math.cos(a) * 0.1, Math.sin(a) * 0.1);
    s.rotation.x = -a;
    spinner.add(s);
  }
  labels.add('tokens', rail, 'Tokenizer', [0, SPAN * 0.78, 0], 60, 40);

  // --- meaning space
  const cloud = new THREE.Group();
  cloud.position.copy(CLOUD);
  inner.add(cloud);
  const cube = new THREE.LineSegments(
    new THREE.EdgesGeometry(new THREE.BoxGeometry(CLOUD_HALF * 2, CLOUD_HALF * 2, CLOUD_HALF * 2)),
    new THREE.LineBasicMaterial({ color: 0x4a5462, transparent: true, opacity: 0.8 }),
  );
  cloud.add(cube);
  const grid = new THREE.GridHelper(CLOUD_HALF * 2, 6, 0x333a44, 0x262b33);
  grid.position.y = -CLOUD_HALF;
  cloud.add(grid);
  const ANIMAL = 0x5ec9b0;
  const FOOD = 0xffb454;
  const PEOPLE = ACCENT;
  const WORDS = [
    ['cat', [-0.5, 0.42, -0.15], ANIMAL],
    ['dog', [-0.32, 0.56, -0.3], ANIMAL],
    ['fish', [-0.62, 0.22, -0.34], ANIMAL],
    ['stale', [0.42, 0.5, -0.25], FOOD],
    ['rotten', [0.58, 0.3, -0.1], FOOD],
    ['fresh', [0.26, 0.64, -0.42], FOOD],
    ['man', [-0.4, -0.45, 0.22], PEOPLE],
    ['woman', [-0.1, -0.66, 0.22], PEOPLE],
    ['king', [0.12, -0.02, 0.22], PEOPLE],
    ['queen', [0.42, -0.23, 0.22], PEOPLE],
  ];
  const wp = Object.fromEntries(WORDS.map(([w, p]) => [w, new THREE.Vector3(...p)]));
  const fill = [];
  const fr = rng(768);
  const centers = [
    [[-0.48, 0.4, -0.26], ANIMAL],
    [[0.42, 0.48, -0.26], FOOD],
    [[0.0, -0.35, 0.22], PEOPLE],
  ];
  for (const [c, col] of centers) {
    for (let k = 0; k < 5; k++) {
      fill.push([[c[0] + (fr() - 0.5) * 0.34, c[1] + (fr() - 0.5) * 0.3, c[2] + (fr() - 0.5) * 0.3], col]);
    }
  }
  for (let k = 0; k < 7; k++) {
    fill.push([[(fr() - 0.5) * 1.2, (fr() - 0.5) * 1.2, (fr() - 0.5) * 1.2], 0x6b7482]);
  }
  const allPts = [...WORDS.map(([, p, c]) => [p, c]), ...fill];
  const ptMat = new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.1 });
  const pts = new THREE.InstancedMesh(new THREE.SphereGeometry(1, 16, 12), ptMat, allPts.length);
  const m4 = new THREE.Matrix4();
  const col = new THREE.Color();
  allPts.forEach(([p, c], k) => {
    const r = k < WORDS.length ? 0.036 : 0.022;
    m4.makeScale(r, r, r).setPosition(...p);
    pts.setMatrixAt(k, m4);
    pts.setColorAt(k, col.setHex(c));
  });
  cloud.add(pts);
  const cloudTags = WORDS.map(([w, p]) => {
    const s = wordTag(w);
    s.position.set(p[0], p[1] + 0.07, p[2]);
    cloud.add(s);
    return s;
  });
  const arrowA = makeArrow(0xf2c6d8);
  const arrowB = makeArrow(0xf2c6d8);
  cloud.add(arrowA, arrowB);
  const queenGlow = new THREE.Mesh(
    new THREE.SphereGeometry(0.075, 20, 14),
    new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0, depthWrite: false }),
  );
  queenGlow.position.copy(wp.queen);
  cloud.add(queenGlow);
  const offsetMid = new THREE.Object3D();
  offsetMid.position.copy(wp.queen);
  cloud.add(offsetMid);
  labels.add('cloud', offsetMid, 'Same step, same meaning', [0.02, -0.04, 0], -80, 60);
  const animalMid = new THREE.Object3D();
  animalMid.position.copy(wp.cat);
  cloud.add(animalMid);
  labels.add('cloud', animalMid, 'Similar words land close', [0, 0.03, 0], 80, 75);

  // --- attention arcs from " it" back over itself and earlier tokens
  const attnGroup = new THREE.Group();
  inner.add(attnGroup);
  const arcStart = new THREE.Vector3(sepX(IT), CARD_TOP + 0.03, CARD_Z);
  const arcs = [];
  const pctSprites = [];
  ATTN.forEach((w, j) => {
    if (j !== IT) {
      const end = new THREE.Vector3(sepX(j), CARD_TOP + 0.03, CARD_Z);
      const dx = Math.abs(end.x - arcStart.x);
      const ctrl = new THREE.Vector3((end.x + arcStart.x) / 2, CARD_TOP + 0.2 + 0.16 * dx, CARD_Z);
      const curve = new THREE.QuadraticBezierCurve3(arcStart, ctrl, end);
      const geo = new THREE.TubeGeometry(curve, 48, 0.004 + 0.026 * (w / 0.37), 8, false);
      const mat = new THREE.MeshBasicMaterial({
        color: ACCENT,
        transparent: true,
        opacity: 0.35 + 0.6 * (w / 0.37),
        depthWrite: false,
      });
      const mesh = new THREE.Mesh(geo, mat);
      attnGroup.add(mesh);
      arcs.push({ mesh, total: geo.index.count, baseOpacity: mat.opacity });
    }
    const s = wordTag(`${Math.round(w * 100)}%`, w > 0.2 ? '#ff8fb8' : '#aeb6c2', w > 0.2 ? 15 : 12);
    s.position.set(sepX(j), CARD_TOP + (j === IT ? 0.2 : 0.1), CARD_Z + 0.02);
    attnGroup.add(s);
    pctSprites.push(s);
  });
  const itAnchor = new THREE.Object3D();
  itAnchor.position.set(sepX(IT), CARD_TOP + 0.03, CARD_Z);
  inner.add(itAnchor);
  labels.add('attention', itAnchor, 'Attention from "it"', [0, 0, 0], 70, 70);
  const wasAnchor = new THREE.Object3D();
  wasAnchor.position.set(sepX(WAS), SLUG_Y - 0.05, SLUG_FRONT + 0.01);
  inner.add(wasAnchor);
  labels.add('attention', wasAnchor, 'Future: masked out', [0, 0, 0], -70, 45);

  // --- layer stack
  const stack = new THREE.Group();
  inner.add(stack);
  const plates = [];
  for (let k = 0; k < PLATES; k++) {
    const y = PLATE_Y0 + k * PLATE_DY;
    const pm = new THREE.MeshStandardMaterial({
      color: 0x9fb4c8,
      roughness: 0.3,
      metalness: 0,
      transparent: true,
      opacity: 0.1,
      depthWrite: false,
      emissive: new THREE.Color(ACCENT),
      emissiveIntensity: 0,
    });
    const plate = new THREE.Mesh(new THREE.BoxGeometry(SPAN + 0.2, 0.008, 0.62), pm);
    plate.position.set(0, y, CARD_Z);
    stack.add(plate);
    const em = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.35, depthWrite: false });
    const edge = new THREE.Mesh(new THREE.BoxGeometry(SPAN + 0.2, 0.006, 0.006), em);
    edge.position.set(0, y, CARD_Z + 0.31);
    stack.add(edge);
    plates.push({ y, pm, em });
  }
  const layerCounter = labels.add(
    'layers',
    stack,
    'Layer 1 of 12',
    [SPAN / 2 + 0.1, PLATE_Y0 + PLATE_DY * 5.5, CARD_Z + 0.31],
    20,
    40,
  );

  // --- next-piece odds
  const chart = new THREE.Group();
  inner.add(chart);
  const board = beveledBox(1.72, 0.92, 0.03, materials.polymer(0x121418), 0.012);
  board.position.set(CHART_X, CHART_Y + 0.4, CHART_Z - 0.08);
  chart.add(board);
  const shelf = beveledBox(1.72, 0.04, 0.22, materials.polymer(0x2a2e35), 0.01);
  shelf.position.set(CHART_X, CHART_Y - 0.02, CHART_Z);
  chart.add(shelf);
  const bars = ODDS.map(([w, p], k) => {
    const x = CHART_X + (k - 2.5) * 0.27;
    const other = k === ODDS.length - 1;
    const mat = new THREE.MeshStandardMaterial({
      color: other ? 0x3a3f47 : 0x2b2f36,
      roughness: 0.5,
      emissive: new THREE.Color(other ? 0x5a616c : ACCENT),
      emissiveIntensity: 0.25,
    });
    const geo = new THREE.BoxGeometry(0.16, 1, 0.08);
    geo.translate(0, 0.5, 0);
    const bar = new THREE.Mesh(geo, mat);
    bar.position.set(x, CHART_Y, CHART_Z);
    chart.add(bar);
    const tag = textPlane([w, `${Math.round(p * 100)}%`], 0.26, 0.13, {
      color: k === 0 ? '#ff8fb8' : '#aeb6c2',
      size: 44,
    });
    tag.position.set(x, CHART_Y - 0.11, CHART_Z + 0.112);
    chart.add(tag);
    return { bar, mat, h: (p / ODDS[0][1]) * BAR_MAX_H, other };
  });
  const scoreArrow = makeArrow(ACCENT, 0.008, 0.028, 0.07);
  inner.add(scoreArrow);
  const scoreFrom = new THREE.Vector3(sepX(WAS), CARD_TOP + 0.04, CARD_Z);
  const scoreTo = new THREE.Vector3(CHART_X + 0.8, CHART_Y + 0.05, CHART_Z + 0.1);
  labels.add('predict', board, 'Odds for the next piece', [0.62, 0.42, 0.02], 40, 40);
  const nextAnchor = new THREE.Object3D();
  nextAnchor.position.set(sepX(N), PLINTH_H + TRAY_H, SLUG_Z + SLUG_D / 2 + 0.07);
  inner.add(nextAnchor);
  labels.add('predict', nextAnchor, 'Appended, then run again', [0, 0, 0], -125, 50);

  // ------------------------------------------------------------------ pose
  const DEFAULTS = {
    reveal: 0,
    feed: 0, // tape travel, whole wraps per lap
    display: 1, // output screen brightness
    wall: 1,
    cut: 1, // blade travel 0..1
    sep: 1, // how far the cuts have opened
    blade: 0, // cutter lowered 0..1
    bladeSpin: 0,
    ids: 1,
    embed: 1, // lookup progress (lap units)
    cards: 1,
    cloud: 0,
    arrow: 0,
    cloudSpin: 0,
    attn: 0,
    pct: 0,
    blend: 0,
    layers: 0,
    rise: 0,
    ctx: 0,
    predict: 0,
    pick: 0,
    drop: 0,
    dropOut: 0,
  };
  const state = { ...DEFAULTS };

  // framework/label-layout.js treats every mesh whose OWN .visible is true as
  // a callout occluder, ignoring hidden ancestors — so a hidden group's meshes
  // must be flagged noOcclude or the removed shell dims every label inside.
  const meshCache = new Map();
  function show(obj, v) {
    obj.visible = v;
    if (!meshCache.has(obj)) {
      const list = [];
      obj.traverse((o) => o.isMesh && list.push(o));
      meshCache.set(obj, list);
    }
  }
  function syncOccluders() {
    for (const list of meshCache.values()) {
      for (const m of list) {
        let hidden = false;
        for (let o = m; o; o = o.parent) if (!o.visible) hidden = true;
        m.userData.noOcclude = hidden;
      }
    }
  }

  function apply() {
    const sealed = state.reveal < 0.5;
    show(shell, sealed);
    show(inner, !sealed);
    show(wall, state.wall > 0.5);

    tapeTex.offset.x = -state.feed * 0.62;
    reel.rotation.y = -state.feed * TAU * 0.77;
    screen.material.opacity = 0.35 + 0.65 * state.display;

    // --- tokenizer: cuts open as the blade passes each boundary
    const bladeX = lerp(BLADE_X0, BLADE_X1, state.cut);
    const open = [];
    for (let k = 0; k < N - 1; k++) {
      open.push(state.sep * smooth((bladeX - sepB(k) + 0.06) / 0.16));
    }
    let shift = 0;
    let dip = 0;
    for (let i = 0; i < N; i++) {
      tokens[i].tg.position.x = joinedX(i) + shift;
      if (i < N - 1) {
        const bx = X0 + CUM[i + 1] + shift + (GAP * open[i]) / 2;
        dip = Math.max(dip, 1 - Math.abs(bladeX - bx) / 0.11);
        shift += GAP * open[i];
      }
    }
    show(gantry, state.blade > 0.001);
    carriage.position.x = bladeX;
    const bladeY = BLADE_REST_Y + (1 - state.blade) * 0.3 - 0.17 * smooth(dip) * state.blade;
    bladeGroup.position.y = bladeY;
    arm.position.y = bladeY;
    arm.scale.y = Math.max(0.01, RAIL_Y - bladeY);
    spinner.rotation.x = -state.bladeSpin;
    bladeMat.emissiveIntensity = 0.35 + 1.4 * smooth(dip);

    // --- IDs, cards, lookup
    const pulseRise = state.rise * RISE_H;
    tokens.forEach((t, i) => {
      t.idPlane.material.opacity = state.ids;
      t.idPlane.visible = state.ids > 0.01;
      if (i === N) return;
      const a = embedStart(i);
      const grow = state.cards * win(state.embed, a + 0.1, a + 0.2);
      t.cg.scale.y = Math.max(0.001, grow);
      show(t.cg, grow > 0.004);
      t.rise.position.y = pulseRise;
      const flight = clamp01((state.embed - a) / 0.14);
      const p = packets[i];
      p.visible = state.cards > 0.5 && flight > 0 && flight < 1;
      if (p.visible) {
        const f = smooth(flight);
        p.position.set(
          t.tg.position.x,
          lerp(rowY(t.id), SLUG_TOP + CARD_H / 2, f) + Math.sin(f * Math.PI) * 0.25,
          lerp(WALL_Z + 0.03, CARD_Z, f),
        );
      }
      const glow = Math.max(0, 1 - Math.abs(state.embed - (a + 0.05)) / 0.09);
      rowMats[i].opacity = state.cards * Math.min(1, glow + (state.embed > a + 0.05 ? 0.1 : 0));
      t.ctxMat.opacity = state.ctx;
      // the future token is masked while attention runs
      const dim = i === WAS ? 1 - 0.72 * clamp01(state.attn * 2) : 1;
      t.cardMat.color.setScalar(dim);
      t.slugMat.emissiveIntensity = i === WAS && state.predict > 0 ? 0.12 * state.predict : 0;
    });

    // --- meaning space
    show(cloud, state.cloud > 0.5);
    for (const t of cloudTags) t.visible = cloud.visible;
    if (cloud.visible) {
      cloud.rotation.y = state.cloudSpin;
      const a1 = smooth(clamp01(state.arrow / 0.5));
      const a2 = smooth(clamp01((state.arrow - 0.5) / 0.5));
      arrowA.userData.set(wp.man, wp.king, a1);
      arrowB.userData.set(wp.woman, wp.queen, a2);
      queenGlow.material.opacity = 0.45 * a2;
      queenGlow.visible = a2 > 0.01;
    }

    // --- attention
    show(attnGroup, state.attn > 0.001 || state.pct > 0.001);
    arcs.forEach((a) => {
      a.mesh.geometry.setDrawRange(0, Math.floor((a.total * smooth(state.attn)) / 6) * 6);
      a.mesh.material.opacity = a.baseOpacity * Math.min(1, state.attn * 3);
    });
    pctSprites.forEach((s) => {
      s.element.style.opacity = String(state.pct);
      s.visible = state.pct > 0.01 && !sealed;
    });
    attnMat.opacity = state.blend;

    // --- layer stack
    show(stack, state.layers > 0.5);
    if (stack.visible) {
      const mid = SLUG_TOP + CARD_H / 2 + pulseRise;
      let passed = 0;
      plates.forEach((pl) => {
        const g = Math.max(0, 1 - Math.abs(mid - pl.y) / 0.16);
        pl.pm.emissiveIntensity = 0.9 * g;
        pl.pm.opacity = 0.1 + 0.12 * g;
        pl.em.opacity = 0.3 + 0.6 * g;
        if (mid > pl.y) passed++;
      });
      layerCounter.setText(`Layer ${Math.max(1, passed)} of 12`);
    }

    // --- odds, pick, append
    show(chart, state.predict > 0.001);
    bars.forEach((b, k) => {
      b.bar.scale.y = Math.max(0.001, b.h * smooth(state.predict));
      const win0 = k === 0;
      b.mat.emissiveIntensity = win0 ? 0.3 + 1.1 * state.pick : b.other ? 0.2 : 0.3 * (1 - 0.5 * state.pick);
    });
    scoreArrow.userData.set(scoreFrom, scoreTo, state.predict > 0.001 ? smooth(state.predict) : 0);
    const land = state.drop;
    show(next.tg, land > 0.001 && state.dropOut < 0.999);
    if (next.tg.visible) {
      // drop with a small damped settle (≤2 oscillations, ~2% of travel)
      const fall = land < 0.85 ? 1 - smooth(land / 0.85) : -0.02 * Math.sin(((land - 0.85) / 0.15) * Math.PI);
      next.tg.position.y = 0.9 * fall + state.dropOut * 0.9;
      next.slugMat.emissiveIntensity = 0.18 * state.pick * (1 - state.dropOut);
      const s = 1 - state.dropOut;
      next.tg.scale.setScalar(Math.max(0.001, s));
    }
    syncOccluders();
  }
  apply();

  function pose(partial = {}) {
    Object.assign(state, DEFAULTS, partial);
    apply();
  }

  return {
    group,
    parts: { shell, inner, tokens: tokens.map((t) => t.tg), cloud, stack, chart, bladeGroup, reel },
    setLabels: labels.setLabels,
    setReveal: (r) => {
      state.reveal = r;
      apply();
    },
    pose,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
  };
}
