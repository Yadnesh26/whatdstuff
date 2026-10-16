import * as THREE from 'three';
import { materials, rod, studioPlinth } from '../../framework/parts.js';
import { beveledBox } from '../../framework/geometry.js';
import { clamp01, smooth, win } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// How a compiler works: one real C function taken all the way to machine
// code, staged as a bench of stations inside a sealed console. Code is not a
// physical thing, so this follows the nlp / binary-search precedent (data as
// parts), with the zoom-in / reveal story shape: a SEALED console (page of
// code in the top, bytes out the front) whose shell lifts off to show, left
// to right:
//
//   source page + lexer → syntax tree (+ checker) → IR rack (+ optimizer) →
//   code generator (instruction plates + register bank) → bytes + bit lamps
//
// Reference facts (checked on Compiler Explorer, x86-64, 2026-10):
//  - gcc 14.2 -O2 and clang 19.1 -O2 both compile score() below to exactly
//      8d 47 06    lea eax, [rdi+0x6]
//      c3          ret
//    ModRM 0x47 = mod 01 (8-bit displacement), reg 000 (eax), rm 111 (rdi).
//  - clang -O0 emits 10 instructions / 26 bytes for the same function.
//  - clang -O0 LLVM IR: allocas, store 3, two loads, `mul nsw %5, 2`,
//    `add nsw %4, %6`, ret. At -O2: `%2 = add nsw i32 %0, 6`, ret.
//    The rack shows that -O0 list simplified (allocas and the parameter's
//    own spill dropped, types stripped).
//  - System V AMD64 calling convention (Linux, macOS): first integer argument
//    in rdi/edi, return value in rax/eax. x86-64 has 16 general registers.
//  - The tokens come from a real (tiny) lexer run over SRC below: 20 tokens,
//    the comment and every space discarded.
// Disclosed illustrations: the token colours (a common editor theme), and
// the IR's wording (LLVM's own spelling is noisier).
//
// Proportions all derive from the page's character grid: CW per character,
// LH per line; every station is sized against the page.

const SRC = ['int score(int points) {', '    int bonus = 3; // combo', '    return points + bonus * 2;', '}'];
const KEYWORDS = new Set(['int', 'return']);

const ACCENT = 0xffcb6b;
const KIND = {
  keyword: '#c792ea',
  name: '#82aaff',
  number: '#f78c6c',
  symbol: '#89ddff',
  comment: '#7a8199',
};
const TYPE_COLOR = '#c3e88d';
const MONO = '"Cascadia Mono", Consolas, "Courier New", monospace';

const PLINTH_H = 0.22;

// --- source page (the character grid every other size derives from)
const CW = 0.062; // one character
const LH = 0.2; // one line
const COLS = 30; // longest line
const GUTTER = 0.2;
const PAGE_W = 0.16 + GUTTER + COLS * CW; // 2.22
const PAGE_H = 1.08;
const PAGE_X = -2.95;
const PAGE_Y = 1.06;
const PAGE_Z = -0.3;
const PAGE_FRONT = PAGE_Z + 0.02;
const RAISE = 0.95; // page pokes out of the top slot while sealed
const TEXT_X0 = PAGE_X - PAGE_W / 2 + 0.08 + GUTTER;
const lineY = (i) => PAGE_Y + 0.3 - i * LH;
const TOK_H = 0.15;
const TOK_D = 0.07;
const LIFT = 0.24;
const TOK_Z = PAGE_FRONT + TOK_D / 2 + LIFT;

// --- syntax tree
const TREE_X = 0.05;
const TREE_Z = -0.2;
const NODE_H = 0.16;
const NODE_D = 0.08;

// --- IR rack
const RACK_X = 2.35;
const RACK_Z = -0.2;
const PLATE_W = 1.3;
const PLATE_H = 0.17;
const slotY = (k) => 1.66 - k * 0.225;

// --- code generator
const CG_X = 4.05;
const CG_W = 1.4;
const BANK_Y = PLINTH_H + 0.18;
const BANK_Z = -0.12;
const BANK_FRONT = BANK_Z + 0.15;
const TILE_Y = 1.06;
const TILE_Z = -0.15;
const LAMP_Y = 0.86;
const tileX = (k) => CG_X - 0.6 + k * 0.4;

const SHELL = { x0: -4.35, x1: 4.95, y0: PLINTH_H, y1: 1.98, z0: -0.62, z1: 0.42 };

const BYTES = [0x8d, 0x47, 0x06, 0xc3];
const REGS = ['rax', 'rbx', 'rcx', 'rdx', 'rsi', 'rdi', 'rbp', 'rsp', 'r8', 'r9', 'r10', 'r11', 'r12', 'r13', 'r14', 'r15'];
const RAX = 0;
const RDI = 5;

const lerp = (a, b, t) => a + (b - a) * t;
const hex2 = (b) => b.toString(16).toUpperCase().padStart(2, '0');
// arrive with a ~2% overshoot and one damped settle (machined, not springy)
const settle = (a) => (a < 0.8 ? 1.02 * smooth(a / 0.8) : 1.02 - 0.02 * smooth((a - 0.8) / 0.2));
const bump = (u, a, b, c, d) => win(u, a, b) * (1 - win(u, c, d));

// A real lexer, small enough to read: longest match on names/numbers, a line
// comment eats the rest of its line, whitespace produces nothing.
function lex(lines) {
  const out = [];
  const re = /(\s+)|(\/\/.*)|([A-Za-z_]\w*)|(\d+)|([(){};=+*])/g;
  lines.forEach((ln, line) => {
    re.lastIndex = 0;
    let m;
    while ((m = re.exec(ln))) {
      if (m[1]) continue;
      const text = m[0];
      const kind = m[2] ? 'comment' : m[3] ? (KEYWORDS.has(text) ? 'keyword' : 'name') : m[4] ? 'number' : 'symbol';
      out.push({ text, kind, line, col: m.index });
    }
  });
  return out;
}

function canvasTex(w, h, draw) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'));
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 4;
  return tex;
}

// one line of text on a transparent plane, sized to its box
function textPlane(text, pw, ph, { color = '#d6dbe2', size = 80, font = 600, mono = false, align = 'center' } = {}) {
  const px = 128;
  const w = Math.max(16, Math.round((px * pw) / ph));
  const tex = canvasTex(w, px, (ctx) => {
    ctx.fillStyle = color;
    ctx.textBaseline = 'middle';
    ctx.textAlign = align;
    ctx.font = `${font} ${size}px ${mono ? MONO : '"Segoe UI", sans-serif'}`;
    ctx.fillText(text, align === 'left' ? 6 : w / 2, px / 2 + 3);
  });
  const mat = new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
  return new THREE.Mesh(new THREE.PlaneGeometry(pw, ph), mat);
}

// the page face: editor-style, one plain colour — to the compiler it is just
// characters. Each glyph is drawn on the exact CW grid so the token blocks
// lift off precisely where their characters sit.
function pageTexture() {
  const pxPerU = 460;
  const w = Math.round(PAGE_W * pxPerU);
  const h = Math.round(PAGE_H * pxPerU);
  return canvasTex(w, h, (ctx) => {
    ctx.fillStyle = '#16181d';
    ctx.fillRect(0, 0, w, h);
    ctx.fillStyle = '#1d2026';
    ctx.fillRect(0, 0, (0.08 + GUTTER - 0.04) * pxPerU, h);
    ctx.textBaseline = 'middle';
    const top = PAGE_Y + PAGE_H / 2;
    const left = PAGE_X - PAGE_W / 2;
    SRC.forEach((ln, i) => {
      const y = (top - lineY(i)) * pxPerU;
      ctx.font = `500 ${Math.round(LH * 0.5 * pxPerU)}px ${MONO}`;
      ctx.fillStyle = '#5b6170';
      ctx.textAlign = 'right';
      ctx.fillText(String(i + 1), (0.08 + GUTTER - 0.08) * pxPerU, y);
      ctx.fillStyle = '#c4c9d2';
      ctx.textAlign = 'center';
      ctx.font = `500 ${Math.round(LH * 0.56 * pxPerU)}px ${MONO}`;
      for (let c = 0; c < ln.length; c++) {
        if (ln[c] === ' ') continue;
        const x = (TEXT_X0 + (c + 0.5) * CW - left) * pxPerU;
        ctx.fillText(ln[c], x, y);
      }
    });
  });
}

// framework/label-layout.js treats every mesh whose OWN .visible is true as a
// callout occluder, ignoring hidden ancestors — so meshes under a hidden
// group are flagged noOcclude (see nlp/model.js).
function occluderSync(root) {
  const all = [];
  root.traverse((o) => o.isMesh && all.push(o));
  return () => {
    for (const m of all) {
      let hidden = false;
      for (let o = m; o; o = o.parent) if (!o.visible) hidden = true;
      m.userData.noOcclude = hidden;
    }
  };
}

export function buildCompiler({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  const labels = calloutSets(['exterior', 'lex', 'parse', 'check', 'ir', 'opt', 'cg', 'bytes']);

  const plinth = studioPlinth({ w: SHELL.x1 - SHELL.x0 + 0.5, h: PLINTH_H, d: 1.9, color: 0x15171b });
  plinth.position.set((SHELL.x0 + SHELL.x1) / 2, PLINTH_H / 2, -0.12);
  group.add(plinth);

  const darkMat = materials.polymer(0x0e1013);
  const frameMat = materials.polymer(0x1c1f25);
  const railMat = materials.brushedSteel(0x9aa4b0);
  railMat.roughness = 0.7;
  const accentMat = new THREE.MeshBasicMaterial({ color: ACCENT });

  // dark block with coloured text on its face — tokens, nodes and plates all
  // share this construction, each with its own material so it can glow
  function block(text, w, h, d, color, { size = 84, mono = true, glow = ACCENT, bodyColor = 0x23262d } = {}) {
    const g = new THREE.Group();
    const mat = materials.polymer(bodyColor);
    mat.emissive = new THREE.Color(glow);
    mat.emissiveIntensity = 0;
    const body = beveledBox(w, h, d, mat, Math.min(0.025, h * 0.18));
    g.add(body);
    const face = textPlane(text, w - 0.04, h * 0.7, { color, size, mono });
    face.position.z = d / 2 + 0.002;
    g.add(face);
    return { g, mat, face, w };
  }

  // ------------------------------------------------------------- shell
  const shell = new THREE.Group();
  group.add(shell);
  const shellMat = materials.polymer(0x262a31);
  const sw = SHELL.x1 - SHELL.x0;
  const sh = SHELL.y1 - SHELL.y0;
  const sd = SHELL.z1 - SHELL.z0;
  const body = beveledBox(sw, sh, sd, shellMat, 0.08);
  body.position.set((SHELL.x0 + SHELL.x1) / 2, SHELL.y0 + sh / 2, (SHELL.z0 + SHELL.z1) / 2);
  body.receiveShadow = true;
  shell.add(body);
  // intake slot the page stands in
  const slot = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W + 0.14, 0.012, 0.12), darkMat);
  slot.position.set(PAGE_X, SHELL.y1 + 0.001, PAGE_Z);
  shell.add(slot);
  const slotLip = beveledBox(PAGE_W + 0.26, 0.03, 0.22, frameMat, 0.012);
  slotLip.position.set(PAGE_X, SHELL.y1 + 0.006, PAGE_Z);
  shell.add(slotLip);
  // vents along the top, right half
  for (let k = 0; k < 14; k++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.28, 0.01, 0.045), darkMat);
    v.position.set(-1.05 + k * 0.4, SHELL.y1 + 0.001, -0.3);
    shell.add(v);
  }
  // front: stage legend with the build light running beneath it
  const STAGES = ['LEX', 'PARSE', 'CHECK', 'IR', 'OPTIMIZE', 'CODEGEN', 'ASSEMBLE'];
  const legendX0 = SHELL.x0 + 0.5;
  const legendX1 = SHELL.x1 - 0.5;
  STAGES.forEach((s, k) => {
    const x = lerp(legendX0, legendX1, k / (STAGES.length - 1));
    const t = textPlane(s, 0.15 * s.length * 0.62 + 0.12, 0.14, { color: '#9aa3b2', size: 80, font: 700 });
    t.position.set(x, 0.66, SHELL.z1 + 0.002);
    shell.add(t);
    const dot = new THREE.Mesh(new THREE.CircleGeometry(0.018, 16), new THREE.MeshBasicMaterial({ color: 0x4a515d }));
    dot.position.set(x, 0.53, SHELL.z1 + 0.002);
    shell.add(dot);
  });
  const SEGS = 40;
  const lightTrack = beveledBox(legendX1 - legendX0 + 0.3, 0.05, 0.02, darkMat, 0.01);
  lightTrack.position.set((legendX0 + legendX1) / 2, 0.44, SHELL.z1 + 0.006);
  shell.add(lightTrack);
  const segs = [];
  for (let k = 0; k < SEGS; k++) {
    const m = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.1, depthWrite: false });
    const seg = new THREE.Mesh(new THREE.PlaneGeometry(((legendX1 - legendX0 + 0.2) / SEGS) * 0.7, 0.026), m);
    seg.position.set(lerp(legendX0 - 0.1, legendX1 + 0.1, (k + 0.5) / SEGS), 0.44, SHELL.z1 + 0.018);
    shell.add(seg);
    segs.push({ m, f: (k + 0.5) / SEGS });
  }
  const seam = new THREE.Mesh(new THREE.BoxGeometry(sw - 0.3, 0.01, 0.01), accentMat);
  seam.position.set((SHELL.x0 + SHELL.x1) / 2, SHELL.y0 + 0.1, SHELL.z1 + 0.002);
  shell.add(seam);
  // output window: the bytes, and their bits beneath
  const bezel = beveledBox(1.6, 0.62, 0.04, materials.polymer(0x121418), 0.02);
  bezel.position.set(CG_X - 0.05, 1.3, SHELL.z1 + 0.01);
  shell.add(bezel);
  const screen = textPlane('8D 47 06 C3', 1.42, 0.26, { color: '#ffcb6b', size: 92, mono: true, font: 700 });
  screen.position.set(CG_X - 0.05, 1.36, SHELL.z1 + 0.032);
  shell.add(screen);
  const outCaption = textPlane('MACHINE CODE OUT', 0.95, 0.07, { color: '#7c8592', size: 70, font: 700 });
  outCaption.position.set(CG_X - 0.05, 1.7, SHELL.z1 + 0.002);
  shell.add(outCaption);
  const inCaption = textPlane('SOURCE CODE IN', 0.9, 0.07, { color: '#7c8592', size: 70, font: 700 });
  inCaption.position.set(PAGE_X, 1.82, SHELL.z1 + 0.002);
  shell.add(inCaption);
  const lampOn = new THREE.MeshBasicMaterial({ color: ACCENT });
  const lampOff = new THREE.MeshStandardMaterial({ color: 0x2a2e35, roughness: 0.5 });
  const lampGeo = new THREE.SphereGeometry(1, 12, 8);
  const extLamps = [];
  BYTES.forEach((b, k) => {
    for (let i = 0; i < 8; i++) {
      const on = (b >> (7 - i)) & 1;
      const l = new THREE.Mesh(lampGeo, on ? lampOn : lampOff);
      l.scale.setScalar(0.014);
      l.position.set(CG_X - 0.05 - 0.525 + k * 0.35 + (i - 3.5) * 0.036, 1.13, SHELL.z1 + 0.035);
      shell.add(l);
      if (on) extLamps.push(l);
    }
  });

  // ------------------------------------------------------------- page
  // shared by both states: it stands in the intake slot while sealed and
  // drops to its stand inside once the shell is off
  const page = new THREE.Group();
  group.add(page);
  const pageBoard = beveledBox(PAGE_W + 0.06, PAGE_H + 0.06, 0.04, frameMat, 0.015);
  pageBoard.position.set(PAGE_X, PAGE_Y, PAGE_Z);
  page.add(pageBoard);
  const pageMat = new THREE.MeshBasicMaterial({ map: pageTexture(), color: 0xffffff });
  const pageFace = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W, PAGE_H), pageMat);
  pageFace.position.set(PAGE_X, PAGE_Y, PAGE_FRONT + 0.001);
  page.add(pageFace);
  const pageTopAnchor = new THREE.Object3D();
  pageTopAnchor.position.set(PAGE_X + 0.55, PAGE_Y + PAGE_H / 2 - 0.12, PAGE_FRONT);
  page.add(pageTopAnchor);
  labels.add('exterior', pageTopAnchor, 'Source code goes in', [0, 0, 0], 60, 50);
  labels.add('exterior', bezel, 'Machine code comes out', [0.5, 0.25, 0.03], 50, 45);

  // ------------------------------------------------------------- inside
  const inner = new THREE.Group();
  group.add(inner);

  // page stand: a foot rail and two posts
  const foot = beveledBox(PAGE_W + 0.2, 0.08, 0.3, frameMat, 0.02);
  foot.position.set(PAGE_X, PLINTH_H + 0.04, PAGE_Z);
  inner.add(foot);
  for (const s of [-1, 1]) {
    const post = rod(0.02, PAGE_Y - PAGE_H / 2 - PLINTH_H, railMat);
    post.position.set(PAGE_X + s * (PAGE_W / 2 - 0.1), PLINTH_H, PAGE_Z - 0.04);
    inner.add(post);
  }

  // --- lexer: scan bar sweeping the page
  const scan = new THREE.Group();
  inner.add(scan);
  const scanBar = new THREE.Mesh(new THREE.BoxGeometry(PAGE_W + 0.1, 0.012, 0.012), accentMat);
  scan.add(scanBar);
  const scanGlowMat = new THREE.MeshBasicMaterial({ color: ACCENT, transparent: true, opacity: 0.12, depthWrite: false });
  const scanGlow = new THREE.Mesh(new THREE.PlaneGeometry(PAGE_W, LH * 0.9), scanGlowMat);
  scanGlow.position.z = -0.004;
  scan.add(scanGlow);
  for (const s of [-1, 1]) {
    const cap = beveledBox(0.05, 0.05, 0.05, frameMat, 0.012);
    cap.position.x = s * (PAGE_W / 2 + 0.08);
    scan.add(cap);
  }
  scan.position.set(PAGE_X, lineY(0), PAGE_FRONT + 0.012);

  // --- tokens
  const TOKS = lex(SRC);
  const tokens = TOKS.map((t, i) => {
    const w = t.text.length * CW + 0.03;
    const b = block(t.text, w, TOK_H, TOK_D, KIND[t.kind], { size: t.kind === 'comment' ? 74 : 86 });
    if (t.kind !== 'comment') {
      const under = new THREE.Mesh(
        new THREE.BoxGeometry(w - 0.04, 0.012, 0.004),
        new THREE.MeshBasicMaterial({ color: KIND[t.kind] }),
      );
      under.position.set(0, -TOK_H / 2 + 0.02, TOK_D / 2 + 0.003);
      b.g.add(under);
    }
    const home = new THREE.Vector3(TEXT_X0 + (t.col + t.text.length / 2) * CW, lineY(t.line), TOK_Z);
    b.g.position.copy(home);
    inner.add(b.g);
    // pop time: the scan bar reaches the line, then left to right along it
    const at = 0.04 + t.line * 0.115 + (t.col / COLS) * 0.09;
    return { ...t, ...b, i, home, at };
  });
  const findTok = (text, line) => tokens.find((t) => t.text === text && t.line === line);
  const lexAnchor = (tok, name, dir, len) => {
    const a = new THREE.Object3D();
    a.position.copy(tok.home).add(new THREE.Vector3(0, TOK_H / 2, 0));
    inner.add(a);
    labels.add('lex', a, name, [0, 0, 0], dir, len);
  };
  const comment = tokens.find((t) => t.kind === 'comment');
  lexAnchor(findTok('int', 0), 'Keyword', 95, 40);
  lexAnchor(findTok('score', 0), 'Name', 80, 55);
  lexAnchor(findTok('3', 1), 'Number', -80, 95);
  lexAnchor(comment, 'Comment: thrown away', 25, 60);

  // --- syntax tree on its pegboard
  const tree = new THREE.Group();
  inner.add(tree);
  const board = beveledBox(3.12, 1.56, 0.04, frameMat, 0.02);
  board.position.set(TREE_X, 1.1, TREE_Z - 0.1);
  tree.add(board);
  const pegMat = materials.polymer(0x2c3038);
  for (let gx = 0; gx < 15; gx++) {
    for (let gy = 0; gy < 7; gy++) {
      if ((gx + gy) % 2) continue;
      const peg = new THREE.Mesh(new THREE.CircleGeometry(0.012, 10), pegMat);
      peg.position.set(TREE_X - 1.4 + gx * 0.2, 0.47 + gy * 0.2, TREE_Z - 0.079);
      tree.add(peg);
    }
  }
  const treeLeg = rod(0.025, 0.36, railMat);
  treeLeg.position.set(TREE_X, PLINTH_H, TREE_Z - 0.1);
  tree.add(treeLeg);
  const treeFoot = beveledBox(0.8, 0.06, 0.3, frameMat, 0.02);
  treeFoot.position.set(TREE_X, PLINTH_H + 0.03, TREE_Z - 0.1);
  tree.add(treeFoot);

  // [key, token text, token line, x, y, parent]
  const NODES = [
    ['func', 'score', 0, -0.3, 1.72, null],
    ['param', 'points', 0, -1.25, 1.4, 'func'],
    ['decl', 'bonus', 1, -0.3, 1.4, 'func'],
    ['num3', '3', 1, -0.3, 1.08, 'decl'],
    ['ret', 'return', 2, 0.65, 1.4, 'func'],
    ['add', '+', 2, 0.65, 1.08, 'ret'],
    ['pts', 'points', 2, 0.3, 0.76, 'add'],
    ['mul', '*', 2, 1.0, 0.76, 'add'],
    ['bon', 'bonus', 2, 0.75, 0.44, 'mul'],
    ['two', '2', 2, 1.25, 0.44, 'mul'],
  ];
  const node = {};
  NODES.forEach(([key, text, line, x, y, parent], j) => {
    const tok = findTok(text, line);
    const w = Math.max(0.24, text.length * 0.075 + 0.12);
    const b = block(text, w, NODE_H, NODE_D, KIND[tok.kind], { size: 88 });
    const pos = new THREE.Vector3(TREE_X + x, y, TREE_Z);
    b.g.position.copy(pos);
    tree.add(b.g);
    tok.node = key;
    node[key] = { ...b, key, tok, pos, parent, j, at: 0.06 + j * 0.032 };
  });
  const edgeMat = materials.polymer(0x5a6270);
  edgeMat.emissive = new THREE.Color(ACCENT);
  edgeMat.emissiveIntensity = 0;
  const edges = NODES.filter((n) => n[5]).map(([key, , , , , parent], e) => {
    const a = node[parent].pos;
    const b = node[key].pos;
    const from = new THREE.Vector3(a.x, a.y - NODE_H / 2, TREE_Z - 0.02);
    const to = new THREE.Vector3(b.x, b.y + NODE_H / 2, TREE_Z - 0.02);
    const geo = new THREE.CylinderGeometry(0.009, 0.009, 1, 8);
    geo.translate(0, 0.5, 0);
    const mesh = new THREE.Mesh(geo, edgeMat);
    mesh.position.copy(from);
    mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), to.clone().sub(from).normalize());
    tree.add(mesh);
    return { mesh, len: from.distanceTo(to), at: 0.42 + e * 0.008 };
  });
  const nodeAnchor = (key, set, name, dir, len, dy = NODE_H / 2) => {
    const a = new THREE.Object3D();
    a.position.copy(node[key].pos).add(new THREE.Vector3(0, dy, NODE_D / 2));
    tree.add(a);
    return labels.add(set, a, name, [0, 0, 0], dir, len);
  };
  nodeAnchor('func', 'parse', 'Syntax tree', 70, 45);
  nodeAnchor('mul', 'parse', '* sits deeper: done first', 20, 70);

  // --- checker: name links back to declarations, type tags
  const checkGroup = new THREE.Group();
  tree.add(checkGroup);
  const linkMat = new THREE.MeshBasicMaterial({ color: TYPE_COLOR, transparent: true, depthWrite: false });
  const link = (fromKey, toKey, bulge) => {
    const a = node[fromKey].pos;
    const b = node[toKey].pos;
    const p0 = new THREE.Vector3(a.x - node[fromKey].w / 2 - 0.01, a.y, TREE_Z + NODE_D / 2 + 0.02);
    const p2 = new THREE.Vector3(b.x, b.y - NODE_H / 2 - 0.01, TREE_Z + NODE_D / 2 + 0.02);
    const p1 = new THREE.Vector3((p0.x + p2.x) / 2 - bulge, (p0.y + p2.y) / 2 - 0.1, TREE_Z + 0.25);
    const geo = new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(p0, p1, p2), 48, 0.009, 8, false);
    const mesh = new THREE.Mesh(geo, linkMat);
    checkGroup.add(mesh);
    const head = new THREE.Mesh(new THREE.SphereGeometry(0.022, 12, 8), new THREE.MeshBasicMaterial({ color: TYPE_COLOR }));
    head.position.copy(p2);
    checkGroup.add(head);
    return { mesh, head, total: geo.index.count };
  };
  const links = [
    { ...link('bon', 'decl', 0.25), a: 0.06, b: 0.24 },
    { ...link('pts', 'param', 0.35), a: 0.16, b: 0.32 },
  ];
  const TAGS = [
    ['bon', 0.34],
    ['two', 0.34],
    ['num3', 0.36],
    ['pts', 0.38],
    ['mul', 0.44],
    ['add', 0.5],
    ['ret', 0.54],
  ];
  const tags = TAGS.map(([key, at]) => {
    const n = node[key];
    const t = block('int', 0.2, 0.085, 0.04, TYPE_COLOR, { size: 92, bodyColor: 0x1a2a17, glow: 0xc3e88d });
    t.g.position.set(n.pos.x + n.w / 2 - 0.02, n.pos.y + NODE_H / 2 + 0.03, TREE_Z + NODE_D / 2 + 0.03);
    checkGroup.add(t.g);
    return { ...t, key, at };
  });
  nodeAnchor('bon', 'check', 'bonus → declared on line 2', -20, 60, 0);
  const mulTagAnchor = new THREE.Object3D();
  mulTagAnchor.position.copy(tags.find((t) => t.key === 'mul').g.position);
  tree.add(mulTagAnchor);
  labels.add('check', mulTagAnchor, 'int × int → int', [0, 0, 0], 40, 55);

  // --- IR rack
  const rack = new THREE.Group();
  inner.add(rack);
  const rackBack = beveledBox(PLATE_W + 0.2, 1.52, 0.04, frameMat, 0.02);
  rackBack.position.set(RACK_X, 1.1, RACK_Z - 0.08);
  rack.add(rackBack);
  for (const s of [-1, 1]) {
    const rail = rod(0.018, 1.62, railMat);
    rail.position.set(RACK_X + s * (PLATE_W / 2 + 0.07), PLINTH_H, RACK_Z - 0.04);
    rack.add(rail);
  }
  for (let k = 0; k < 6; k++) {
    const ledge = new THREE.Mesh(new THREE.BoxGeometry(PLATE_W + 0.12, 0.01, 0.06), materials.polymer(0x2c3038));
    ledge.position.set(RACK_X, slotY(k) - PLATE_H / 2 - 0.012, RACK_Z - 0.04);
    rack.add(ledge);
  }
  const rackFoot = beveledBox(PLATE_W + 0.3, 0.06, 0.32, frameMat, 0.02);
  rackFoot.position.set(RACK_X, PLINTH_H + 0.03, RACK_Z - 0.06);
  rack.add(rackFoot);
  const rackHead = new THREE.Object3D();
  rackHead.position.set(RACK_X + 0.3, slotY(0) + PLATE_H / 2 + 0.04, RACK_Z);
  rack.add(rackHead);
  labels.add('ir', rackHead, 'IR: one operation per line', [0, 0, 0], 55, 45);
  const tempAnchor = new THREE.Object3D();
  tempAnchor.position.set(RACK_X + PLATE_W / 2 - 0.1, slotY(5) - PLATE_H / 2, RACK_Z + 0.04);
  rack.add(tempAnchor);
  labels.add('ir', tempAnchor, 't1–t4: in-between results', [0, 0, 0], -50, 50);
  const counter = labels.add('opt', rackHead, 'IR: 6 steps', [0, 0, 0], 60, 45);

  // [texts..., source tree node]; text variants are crossfaded by the optimizer
  const PLATES = [
    [['store bonus, 3'], 'decl'],
    [['t1 = load points'], 'pts'],
    [['t2 = load bonus', 't2 = 3'], 'bon'],
    [['t3 = mul t2, 2', 't3 = mul 3, 2', 't3 = 6'], 'mul'],
    [['t4 = add t1, t3', 't4 = add t1, 6', 't4 = add points, 6'], 'add'],
    [['ret t4'], 'ret'],
  ];
  const plates = PLATES.map(([texts, src], k) => {
    const g = new THREE.Group();
    const mat = materials.polymer(0x23262d);
    mat.emissive = new THREE.Color(ACCENT);
    mat.emissiveIntensity = 0;
    const b = beveledBox(PLATE_W, PLATE_H, 0.05, mat, 0.022);
    g.add(b);
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, PLATE_H - 0.05, 0.004), accentMat);
    stripe.position.set(-PLATE_W / 2 + 0.05, 0, 0.027);
    g.add(stripe);
    const faces = texts.map((t) => {
      const f = textPlane(t, PLATE_W - 0.16, PLATE_H * 0.62, { color: '#e3e7ee', size: 84, mono: true, align: 'left' });
      f.position.set(0.04, 0, 0.027);
      g.add(f);
      return f;
    });
    rack.add(g);
    return { g, mat, faces, src, k, home: new THREE.Vector3(RACK_X, slotY(k), RACK_Z) };
  });
  const foldAnchor = new THREE.Object3D();
  foldAnchor.position.set(PLATE_W / 2, 0, 0.03);
  plates[4].g.add(foldAnchor);
  labels.add('opt', foldAnchor, 'Folded: 3 × 2 = 6', [0, 0, 0], 15, 50);

  // --- code generator: instruction plates + register bank
  const cg = new THREE.Group();
  inner.add(cg);
  const cgBack = beveledBox(CG_W + 0.2, 1.3, 0.04, frameMat, 0.02);
  cgBack.position.set(CG_X, 1.25, RACK_Z - 0.18);
  cg.add(cgBack);
  const bank = beveledBox(1.56, 0.36, 0.3, materials.polymer(0x2a2e35), 0.03);
  bank.position.set(CG_X, BANK_Y, BANK_Z);
  cg.add(bank);
  const bankCap = textPlane('REGISTERS', 0.5, 0.05, { color: '#7c8592', size: 70, font: 700 });
  bankCap.rotation.x = -Math.PI / 2;
  bankCap.position.set(CG_X - 0.48, BANK_Y + 0.181, BANK_Z + 0.07);
  cg.add(bankCap);
  const sockets = REGS.map((r, k) => {
    const x = CG_X + ((k % 8) - 3.5) * 0.18;
    const y = BANK_Y + (k < 8 ? 0.08 : -0.08);
    const mat = new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.6, emissive: new THREE.Color(ACCENT), emissiveIntensity: 0 });
    const s = new THREE.Mesh(new THREE.BoxGeometry(0.15, 0.12, 0.012), mat);
    s.position.set(x, y, BANK_FRONT + 0.006);
    cg.add(s);
    const t = textPlane(r, 0.13, 0.05, { color: '#9aa3b2', size: 84, mono: true, font: 700 });
    t.position.set(x, y + 0.028, BANK_FRONT + 0.013);
    cg.add(t);
    return { s, mat, x, y };
  });
  const chip = (text, color) => {
    const b = block(text, Math.max(0.15, text.length * 0.034 + 0.04), 0.05, 0.03, color, { size: 92 });
    b.g.visible = false;
    cg.add(b.g);
    return b;
  };
  const inChip = chip('points', KIND.name);
  const outChip = chip('points+6', '#ffcb6b');
  const sockAnchor = (k, name, dir, len) => {
    const a = new THREE.Object3D();
    a.position.set(sockets[k].x, sockets[k].y + 0.06, BANK_FRONT + 0.02);
    cg.add(a);
    labels.add('cg', a, name, [0, 0, 0], dir, len);
  };
  sockAnchor(RDI, 'rdi: points arrives here', -30, 55);
  sockAnchor(RAX, 'eax: the answer leaves', -80, 45);
  const ASM = ['lea eax, [rdi+6]', 'ret'];
  const cgPlates = ASM.map((txt, k) => {
    const g = new THREE.Group();
    const mat = materials.polymer(0x23262d);
    mat.emissive = new THREE.Color(ACCENT);
    mat.emissiveIntensity = 0;
    g.add(beveledBox(CG_W, PLATE_H, 0.05, mat, 0.022));
    const stripe = new THREE.Mesh(new THREE.BoxGeometry(0.03, PLATE_H - 0.05, 0.004), accentMat);
    stripe.position.set(-CG_W / 2 + 0.05, 0, 0.027);
    g.add(stripe);
    const irText = textPlane(PLATES[4 + k][0][PLATES[4 + k][0].length - 1], CG_W - 0.16, PLATE_H * 0.62, {
      color: '#e3e7ee',
      size: 84,
      mono: true,
      align: 'left',
    });
    irText.position.set(0.04, 0, 0.027);
    g.add(irText);
    const asm = textPlane(txt, CG_W - 0.16, PLATE_H * 0.62, { color: '#ffcb6b', size: 84, mono: true, align: 'left', font: 700 });
    asm.position.set(0.04, 0, 0.028);
    g.add(asm);
    g.visible = false;
    cg.add(g);
    return { g, mat, irText, asm, from: new THREE.Vector3(RACK_X, slotY(k), RACK_Z), to: new THREE.Vector3(CG_X, slotY(k), RACK_Z) };
  });
  const leaAnchor = new THREE.Object3D();
  leaAnchor.position.set(CG_X + CG_W / 2 - 0.1, slotY(0) + PLATE_H / 2, RACK_Z + 0.03);
  cg.add(leaAnchor);
  labels.add('cg', leaAnchor, 'LEA: add 6 in one move', [0, 0, 0], 60, 45);

  // --- assembler: byte tiles + bit lamps
  const byteGroups = BYTES.map((b, k) => {
    const g = new THREE.Group();
    const t = block(hex2(b), 0.32, 0.2, 0.06, '#ffcb6b', { size: 96 });
    g.add(t.g);
    const strip = beveledBox(0.34, 0.07, 0.03, darkMat, 0.012);
    strip.position.set(0, LAMP_Y - TILE_Y, 0);
    g.add(strip);
    const lamps = [];
    for (let i = 0; i < 8; i++) {
      const on = (b >> (7 - i)) & 1;
      const l = new THREE.Mesh(lampGeo, lampOff);
      l.scale.setScalar(0.014);
      l.position.set((i - 3.5) * 0.038, LAMP_Y - TILE_Y, 0.018);
      g.add(l);
      lamps.push({ l, on, at: 0.3 + (k * 8 + i) * 0.007 });
    }
    g.visible = false;
    cg.add(g);
    const src = k < 3 ? 0 : 1;
    return {
      g,
      tile: t,
      lamps,
      from: new THREE.Vector3(CG_X - 0.25 + (k < 3 ? k * 0.3 - 0.3 : -0.5), slotY(src), RACK_Z + 0.04),
      to: new THREE.Vector3(tileX(k), TILE_Y, TILE_Z),
      at: 0.06 + k * 0.07,
    };
  });
  const byteAnchor = (k, name, dir, len, dy = 0.1) => {
    const a = new THREE.Object3D();
    a.position.set(tileX(k), TILE_Y + dy, TILE_Z + 0.03);
    cg.add(a);
    labels.add('bytes', a, name, [0, 0, 0], dir, len);
  };
  byteAnchor(0, '8D: means LEA', 115, 50);
  byteAnchor(2, '06: the 6, baked in', 70, 70);
  byteAnchor(3, 'C3: return', 30, 50);
  byteAnchor(1, 'Lamp lit = 1', -60, 45, LAMP_Y - TILE_Y - 0.03);

  // ------------------------------------------------------------------ pose
  const DEFAULTS = {
    reveal: 0,
    sweep: -1, // build-light head, -0.2..1.3 across the front (sealed)
    lex: 0, // lexer progress 0..1
    tokScale: 1,
    parse: 0,
    treeScale: 1,
    check: 0,
    checkScale: 1,
    ir: 0,
    rackScale: 1,
    opt: 0,
    cg: 0,
    cgScale: 1,
    bytes: 0,
    bytesScale: 1,
  };
  const state = { ...DEFAULTS };
  const syncInner = occluderSync(inner);
  const syncShell = occluderSync(shell);
  const tmp = new THREE.Vector3();

  function apply() {
    const sealed = state.reveal < 0.5;
    shell.visible = sealed;
    inner.visible = !sealed;
    page.position.y = sealed ? RAISE : 0;

    // ---- sealed: build light + output flash
    const head = state.sweep;
    for (const s of segs) {
      const d = (s.f - head) / 0.07;
      s.m.opacity = head < -0.5 ? 0.08 : 0.08 + 0.92 * Math.exp(-d * d);
    }
    const flash = head < -0.5 ? 0 : Math.exp(-(((head - 1.1) / 0.06) ** 2));
    screen.material.opacity = 0.75 + 0.25 * flash;
    for (const l of extLamps) l.scale.setScalar(0.014 * (1 + 0.5 * flash));

    // ---- lexer
    const p = state.lex;
    const scanOn = win(p, 0.02, 0.05) * (1 - win(p, 0.5, 0.54));
    scan.visible = scanOn > 0.01;
    scan.position.y = lineY(0) - clamp01((p - 0.04) / 0.46) * (4 * LH) + LH * 0.5;
    scanGlowMat.opacity = 0.05 * scanOn;
    scan.scale.x = 0.6 + 0.4 * scanOn;
    pageMat.color.setScalar(1 - 0.35 * clamp01(p * 2));

    const q = state.parse;
    for (const t of tokens) {
      let s = settle(clamp01((p - t.at) / 0.07));
      let lift = s;
      let fall = 0;
      t.g.rotation.set(0, 0, 0);
      t.g.position.copy(t.home);
      if (t.kind === 'comment') {
        fall = clamp01((p - t.at - 0.07) / 0.17);
        t.g.rotation.z = -0.5 * fall;
        t.g.rotation.x = 0.4 * fall;
        s *= 1 - smooth((fall - 0.55) / 0.45);
      }
      if (t.node) {
        if (q >= node[t.node].at) s = 0; // the tree node has taken over
      } else if (t.kind !== 'comment') {
        const f = win(q, 0.03 + t.i * 0.004, 0.15 + t.i * 0.004);
        s *= 1 - f;
        lift *= 1 - f;
      }
      t.g.position.z = lerp(PAGE_FRONT + TOK_D / 2, TOK_Z, lift) + 0.12 * fall;
      t.g.position.y -= 0.55 * fall * fall;
      s *= state.tokScale;
      t.g.visible = s > 0.002;
      t.g.scale.setScalar(Math.max(0.001, s));
    }

    // ---- parse: tokens fly to their tree positions, edges grow
    const treeOn = q > 0.001;
    const glowMul = bump(q, 0.5, 0.56, 0.76, 0.82);
    const glowAdd = bump(q, 0.64, 0.7, 0.82, 0.86);
    for (const n of Object.values(node)) {
      const f = smooth(clamp01((q - n.at) / 0.15));
      const vis = treeOn && q >= n.at;
      n.g.visible = vis && state.treeScale > 0.002;
      if (!n.g.visible) continue;
      // fly in from the token's lifted spot (tree-local == inner-local)
      tmp.copy(n.tok.home).lerp(n.pos, f);
      tmp.z += 0.35 * Math.sin(Math.PI * f);
      tmp.y += 0.18 * Math.sin(Math.PI * f);
      n.g.position.copy(tmp);
      n.g.scale.setScalar(Math.max(0.001, lerp(0.8, 1, f) * state.treeScale));
      const sub = n.key === 'mul' || n.key === 'bon' || n.key === 'two';
      let glow = sub ? glowMul : n.key === 'add' || n.key === 'pts' ? glowAdd : 0;
      // checker: each node flashes green as its type is confirmed
      const tag = tags.find((t) => t.key === n.key);
      if (tag) glow = Math.max(glow, 0.8 * bump(state.check, tag.at, tag.at + 0.04, tag.at + 0.1, tag.at + 0.18));
      // IR: the node glows as its plate leaves it
      const pl = plates.find((x) => x.src === n.key);
      if (pl) glow = Math.max(glow, bump(state.ir, 0.04 + pl.k * 0.075, 0.07 + pl.k * 0.075, 0.12 + pl.k * 0.075, 0.18 + pl.k * 0.075));
      n.mat.emissiveIntensity = 0.14 * glow;
      if (tag && state.check > 0) n.mat.emissive.set(TYPE_COLOR);
      else n.mat.emissive.setHex(ACCENT);
    }
    edges.forEach((e) => {
      const g = smooth(clamp01((q - e.at) / 0.1)) * state.treeScale;
      e.mesh.visible = treeOn && g > 0.002;
      e.mesh.scale.set(1, Math.max(0.001, e.len * g), 1);
    });
    edgeMat.emissiveIntensity = 0.5 * glowMul;

    // ---- check
    checkGroup.visible = state.check > 0.001 && state.checkScale > 0.002;
    links.forEach((l) => {
      const g = smooth(clamp01((state.check - l.a) / (l.b - l.a)));
      l.mesh.geometry.setDrawRange(0, Math.floor((l.total * g) / 6) * 6);
      l.head.visible = g > 0.98;
    });
    linkMat.opacity = 0.9 * state.checkScale;
    tags.forEach((t) => {
      const s = settle(clamp01((state.check - t.at) / 0.06)) * state.checkScale;
      t.g.visible = s > 0.002;
      t.g.scale.setScalar(Math.max(0.001, s));
    });

    // ---- IR rack + optimizer
    const o = state.opt;
    const cgOn = state.cg > 0.001;
    plates.forEach((pl) => {
      const k = pl.k;
      const f = state.ir >= 1 ? 1 : smooth(clamp01((state.ir - (0.06 + k * 0.075)) / 0.12));
      let s = (state.ir >= 1 ? 1 : f > 0 ? lerp(0.5, 1, f) : 0) * state.rackScale;
      const src = node[pl.src].pos;
      pl.g.position.lerpVectors(src, pl.home, f);
      pl.g.position.z += 0.3 * Math.sin(Math.PI * f);
      pl.g.rotation.set(0, 0, 0);
      // text variants
      const steps = k === 2 ? [[0.05, 0.1]] : k === 3 ? [[0.11, 0.15], [0.17, 0.21]] : k === 4 ? [[0.22, 0.25], [0.26, 0.29]] : [];
      let idx = 0;
      let blend = 0;
      let glow = 0;
      steps.forEach(([a, b], v) => {
        const w = win(o, a, b);
        if (w >= 1) idx = v + 1;
        else if (w > 0 && idx === v) blend = w;
        glow = Math.max(glow, bump(o, a - 0.02, a, b + 0.03, b + 0.07));
      });
      // dead code: everything but the add and the ret dims, then falls out
      const dead = k < 4;
      const dim = dead ? win(o, 0.29, 0.32) : 0;
      pl.faces.forEach((fc, v) => {
        const op = v === idx ? 1 - blend : v === idx + 1 ? blend : 0;
        fc.visible = op > 0.01;
        fc.material.opacity = op * (1 - 0.6 * dim);
      });
      pl.mat.emissiveIntensity = 0.14 * glow + (k === 4 ? 0.07 * win(o, 0.29, 0.31) * (1 - win(o, 0.56, 0.62)) : 0);
      if (dead) {
        const e = win(o, 0.33 + k * 0.025, 0.42 + k * 0.025);
        pl.g.position.z += 0.35 * e;
        pl.g.position.y -= 0.2 * e * e;
        pl.g.rotation.x = 0.5 * e;
        s *= 1 - e;
      } else {
        // survivors close ranks to the top two slots
        const c = smooth(clamp01((o - 0.47 - (k - 4) * 0.02) / 0.09));
        pl.g.position.y = lerp(pl.home.y, slotY(k - 4), c);
      }
      if (cgOn && !dead) s = 0; // they move on to the code generator
      pl.g.visible = s > 0.002;
      pl.g.scale.setScalar(Math.max(0.001, s));
    });
    const alive = 6 - plates.filter((pl) => pl.k < 4 && win(o, 0.33 + pl.k * 0.025, 0.42 + pl.k * 0.025) > 0.5).length;
    counter.setText(`IR: ${alive} steps`);

    // ---- code generator
    const c = state.cg;
    cgPlates.forEach((cp, k) => {
      const f = smooth(clamp01((c - 0.06 - k * 0.04) / 0.2));
      cp.g.visible = cgOn && state.cgScale > 0.002;
      cp.g.position.lerpVectors(cp.from, cp.to, f);
      cp.g.position.z += 0.25 * Math.sin(Math.PI * f);
      cp.g.scale.setScalar(Math.max(0.001, state.cgScale));
      const x = smooth((f - 0.35) / 0.35);
      cp.irText.material.opacity = 1 - x;
      cp.irText.visible = x < 0.99;
      cp.asm.material.opacity = x;
      cp.asm.visible = x > 0.01;
      const glow = k === 0 ? bump(c, 0.38, 0.42, 0.52, 0.58) : bump(c, 0.62, 0.66, 0.74, 0.8);
      cp.mat.emissiveIntensity = 0.14 * glow;
    });
    const inF = clamp01((c - 0.3) / 0.08);
    inChip.g.visible = cgOn && inF > 0 && state.cgScale > 0.002;
    inChip.g.position.set(sockets[RDI].x, sockets[RDI].y - 0.02 + 0.3 * (1 - smooth(inF)), BANK_FRONT + 0.03);
    inChip.g.scale.setScalar(Math.max(0.001, state.cgScale));
    const outF = clamp01((c - 0.48) / 0.08);
    outChip.g.visible = cgOn && outF > 0 && state.cgScale > 0.002;
    outChip.g.position.set(sockets[RAX].x, sockets[RAX].y - 0.02, BANK_FRONT + 0.03);
    outChip.g.scale.setScalar(Math.max(0.001, settle(outF) * state.cgScale));
    sockets.forEach((s, k) => {
      const on = k === RDI ? win(c, 0.34, 0.38) : k === RAX ? win(c, 0.5, 0.54) : 0;
      s.mat.emissiveIntensity = 0.16 * on * state.cgScale;
    });

    // ---- assembler
    const b = state.bytes;
    byteGroups.forEach((bg, k) => {
      const f = smooth(clamp01((b - bg.at) / 0.14));
      const outF2 = win(b, 0.66 + k * 0.03, 0.82 + k * 0.03);
      const s = (f > 0 ? lerp(0.4, 1, f) : 0) * (1 - outF2) * state.bytesScale;
      bg.g.visible = b > 0.001 && s > 0.002;
      bg.g.position.lerpVectors(bg.from, bg.to, f);
      bg.g.position.x += 0.7 * outF2;
      bg.g.scale.setScalar(Math.max(0.001, s));
      bg.tile.mat.emissiveIntensity = 0.12 * bump(b, bg.at + 0.1, bg.at + 0.14, bg.at + 0.2, bg.at + 0.26);
      bg.lamps.forEach((lp) => {
        lp.l.material = lp.on && b >= lp.at ? lampOn : lampOff;
      });
    });

    syncInner();
    syncShell();
  }

  apply();

  function pose(partial = {}) {
    Object.assign(state, DEFAULTS, partial);
    apply();
  }

  return {
    group,
    parts: { shell, inner, page, tokens: tokens.map((t) => t.g), tree, rack, cg, scan },
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
