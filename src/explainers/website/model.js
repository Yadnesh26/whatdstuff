import * as THREE from 'three';
import { materials, disc, rod, label, studioPlinth } from '../../framework/parts.js';
import { beveledBox, finStack, lathe, chainPath } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { smudgeMap } from '../../framework/textures.js';
import { win, TAU } from '../../framework/motion.js';

// "How a website works" — the ANATOMY of the two machines that make a page
// exist, staged as a studio product shot: your laptop on one plinth, the
// machine that answers it on another, a leased NAME floating between them, and
// one cable carrying the whole conversation.
//
// Deliberately NOT the same story as the "internet-request" explainer, which
// traces the JOURNEY (radio -> tower -> operator core -> BGP hops -> undersea
// fibre). This one never leaves the two endpoints: it opens them up. Same
// visual family though — the same corridor staging, the same cool "outbound" /
// warm "return" packet streams riding chainPath curves.
//
// Reference facts (cross-checked against MDN "How browsers work", web.dev's
// critical-rendering-path series, Cloudflare/nslookup.io on registrars, and
// the 19-inch rack standard):
//  - A DOMAIN is LEASED, not bought, and it is not the server. A registrant
//    rents the name through a REGISTRAR, which files it with the TLD REGISTRY.
//    The registry's zone file stores only which NAMESERVERS are authoritative
//    for the name; the nameserver holds the actual A record -> IP address.
//    That indirection is why moving hosts means repointing nameservers rather
//    than buying a new name, and why a change takes time to spread: every
//    answer is CACHED against its TTL (propagation up to ~48 hours).
//  - Resolution walks a hierarchy: recursive resolver -> root -> .com TLD ->
//    authoritative nameserver -> IP. (203.0.113.42 here is RFC 5737 TEST-NET-3,
//    the block reserved for documentation — a real site's IP would date fast.)
//  - Before one byte of page: TCP's 3-message handshake (SYN, SYN-ACK, ACK)
//    plus TLS negotiation — MDN counts ~8 round trips total. The first
//    response chunk is ~14 KB, because TCP slow start opens with a congestion
//    window of 10 x 1500-byte MSS and only then doubles per ACK.
//  - An HTTP request is a method + path + headers (+ body). A response is a
//    status line (200 OK), headers (Content-Type, Content-Length) and a body.
//  - The SERVER SIDE splits in two. The WEB SERVER (nginx/Apache/Caddy) hands
//    back static files — HTML, CSS, JS, images — directly off disk. Anything
//    that depends on WHO is asking goes to the APPLICATION (the backend): it
//    runs code, and that code queries a DATABASE.
//  - The DATABASE does not scan the table. A B-tree INDEX keeps keys sorted so
//    a lookup is O(log n) — a handful of node hops instead of millions of row
//    reads. The rows come back, the app renders them into HTML/JSON.
//  - The FRONTEND is a five-stage pipeline: HTML -> DOM, CSS -> CSSOM (which
//    is render-BLOCKING, since a later rule can still override an earlier
//    one), DOM + CSSOM -> render tree (display:none nodes dropped), LAYOUT
//    (size and position of every box), then PAINT and COMPOSITE (layers handed
//    to the GPU). JavaScript runs on the same main thread, so a blocking
//    <script> stalls the parser. Budget: 16.67 ms per frame; a page counts as
//    interactive when it answers input within 50 ms.
//  - Rack standard: 1U = 1.75 in of a 19 in equipment width. This cabinet is a
//    12U floor cabinet, not a 42U rack — a true 42U is over 3x its own width
//    tall and would reduce the laptop beside it to a smudge. Disclosed in the
//    step-1 copy.

// ---------------------------------------------------------------------------
// world layout — two islands on the studio floor, one cable between them
// ---------------------------------------------------------------------------
const DECK_Y = 0.26; // plinth top — everything stands here
const LAPTOP_X = -4.0;
const RACK_X = 4.0;

const REQ_COLOR = 0x3ddc97; // your request going out — the family accent
const RESP_COLOR = 0xffb066; // the reply coming back — warm
const DNS_COLOR = 0x8fd3ff; // the name lookup — cool blue, a different errand
const HTML_COLOR = 0x8fd3ff;
const CSS_COLOR = 0xb28dff;
const JS_COLOR = 0xffd166;

function cableMat() {
  return new THREE.MeshPhysicalMaterial({ color: 0x16181c, metalness: 0.35, roughness: 0.62 });
}

// A rounded face plate with a REAL circular hole in it (rule: an opening a fan
// breathes through is an actual hole, never a dark disc painted on a plate).
// Extruded geometry has ad-hoc UVs, so callers pass a map-free material.
function ventPlate(w, h, t, holeR, holeX, holeY, material) {
  const r = Math.min(0.02, h / 2.5);
  const shape = new THREE.Shape();
  shape.moveTo(-w / 2 + r, -h / 2);
  shape.lineTo(w / 2 - r, -h / 2);
  shape.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
  shape.lineTo(w / 2, h / 2 - r);
  shape.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
  shape.lineTo(-w / 2 + r, h / 2);
  shape.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
  shape.lineTo(-w / 2, -h / 2 + r);
  shape.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
  if (holeR > 0) {
    const hole = new THREE.Path();
    hole.absarc(holeX, holeY, holeR, 0, TAU, true);
    shape.holes.push(hole);
  }
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: t,
    bevelEnabled: true,
    bevelThickness: 0.004,
    bevelSize: 0.004,
    bevelSegments: 1,
    curveSegments: 20,
  });
  geo.translate(0, 0, -t / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// Axial fan facing +Z, spun by setting group.rotation.z. The blades ride one
// InstancedMesh: ten fans x seven blades was seventy draw calls for geometry
// that never moves relative to its own hub.
const BLADE_ROT = new THREE.Euler(0.55, 0, 0.35);
function buildFan(radius, blades, material) {
  const g = new THREE.Group();
  const hub = disc(radius * 0.32, 0.03, material, 18);
  hub.rotation.x = Math.PI / 2;
  g.add(hub);
  const proto = beveledBox(radius * 0.62, radius * 0.5, 0.012, material, 0.005);
  const inst = new THREE.InstancedMesh(proto.geometry, material, blades);
  const arm = new THREE.Matrix4();
  const local = new THREE.Matrix4().compose(
    new THREE.Vector3(0, radius * 0.55, 0),
    new THREE.Quaternion().setFromEuler(BLADE_ROT),
    new THREE.Vector3(1, 1, 1),
  );
  const out = new THREE.Matrix4();
  for (let i = 0; i < blades; i++) {
    arm.makeRotationZ((i / blades) * TAU);
    inst.setMatrixAt(i, out.multiplyMatrices(arm, local));
  }
  inst.instanceMatrix.needsUpdate = true;
  inst.castShadow = true;
  g.add(inst);
  return g;
}

// One stream of packets riding a chained path. Dot t = (seed + phase*speedMul)
// % 1 with a whole-number speedMul, so one lap (phase 0 -> 1) returns every dot
// to an identical position — seamless however fast the segment looks. Dots fade
// in at the head of the path and out at the tail, so nothing pops at the wrap.
function buildStream(points, {
  count = 7, color = REQ_COLOR, size = 0.03, speedMul = 2,
  wire = false, radius = 0.02, mat = null,
} = {}) {
  const group = new THREE.Group();
  const segs = [];
  for (let i = 0; i < points.length - 1; i++) segs.push([points[i], points[i + 1]]);
  const chain = chainPath(segs);
  if (wire) {
    const wm = mat || cableMat();
    chain.curves.forEach((curve) => {
      const tube = new THREE.Mesh(new THREE.TubeGeometry(curve, 40, radius, 12), wm);
      tube.castShadow = true;
      group.add(tube);
    });
  }
  const geo = new THREE.SphereGeometry(size, 10, 8);
  const dots = [];
  for (let i = 0; i < count; i++) {
    const dm = materials.glow(color, 1.7);
    dm.transparent = true;
    dm.opacity = 0;
    dm.depthWrite = false; // a dot faded to 0 must not punch a hole in anything
    const mesh = new THREE.Mesh(geo, dm);
    mesh.userData.seed = i / count;
    group.add(mesh);
    dots.push(mesh);
  }
  function update(phase, amount = 1) {
    dots.forEach((mesh) => {
      const t = (mesh.userData.seed + phase * speedMul) % 1;
      mesh.position.copy(chain.getPointAt(t));
      const fade = Math.min(1, t * 9) * Math.min(1, (1 - t) * 9);
      mesh.material.opacity = fade * amount;
    });
  }
  update(0, 0);
  return { group, update, chain };
}

// A floating card with a lit face and a text sprite — the domain plaque, the
// nameserver cards, the HTTP message that rides the cable.
function infoCard(text, w, h, { shell = 0x15181c, glow = DNS_COLOR, size = 0.2 } = {}) {
  const group = new THREE.Group();
  const body = beveledBox(w, h, 0.07, materials.polymer(shell), 0.022);
  body.castShadow = true;
  group.add(body);
  // A DARK tinted face, recessed inside the bezel. Two reasons it must stay
  // dark: at 0.9 emissive it bloomed into a solid slab of colour and the name
  // written on it stopped reading; and label() sprites carry a dark quad that
  // is invisible against dark geometry but shows as a black box on a lit
  // surface. Dark panel, light text — which is what real UI chrome looks like.
  const faceMat = materials.glow(glow, 0.11);
  faceMat.transparent = true;
  faceMat.opacity = 0.34;
  faceMat.depthWrite = false;
  const face = beveledBox(w - 0.13, h - 0.13, 0.012, faceMat, 0.014);
  face.position.z = 0.031;
  group.add(face);
  // Leave the sprite's default depthTest:false alone — forcing it true put the
  // quad into the depth pass and GTAO shaded it into a dark box behind every
  // label, which is what made the first render's cards read as black holes.
  const sprite = label(text, { color: '#f4f9f7', size });
  sprite.position.set(0, 0, 0.09);
  group.add(sprite);
  return { group, face, faceMat, sprite, body };
}

// ---------------------------------------------------------------------------
// THE CLIENT — a laptop, lid open, showing the finished site. Its screen is the
// star: in the last mechanism step three layers (HTML, CSS, JavaScript) fly in
// and land on it as the page paints. Built facing +Z, standing on its plinth.
// 13-inch proportions: 30 cm wide x 21 cm deep, 16:10 display.
// ---------------------------------------------------------------------------
function buildLaptop() {
  const g = new THREE.Group();
  const W = 2.4;
  const D = 1.65;
  const BASE_H = 0.1;
  const LID_H = 1.5;
  const LID_T = 0.07;

  // Map-free on purpose: the aluminum preset's brushed/roughness maps have no
  // sensible UV scale on a slab this large and rendered as speckled grime
  // across the palm rest.
  // Fingerprints belong in the clearcoat, not the base — which is exactly how
  // they behave on a real anodised lid: the metal underneath is untouched, the
  // coat above it is not. Nothing on a laptop anyone has used is this clean.
  const shellMat = new THREE.MeshPhysicalMaterial({
    color: 0xbcc2ca, metalness: 0.88, roughness: 0.38,
    clearcoat: 0.45, clearcoatRoughness: 0.24,
    clearcoatRoughnessMap: smudgeMap(),
  });

  const base = beveledBox(W, BASE_H, D, shellMat, 0.028);
  base.position.set(0, BASE_H / 2, 0);
  base.receiveShadow = true;
  g.add(base);

  // keyboard well, keys, trackpad
  const wellMat = materials.polymer(0x15171a);
  const well = beveledBox(W - 0.26, 0.022, D * 0.6, wellMat, 0.012);
  well.position.set(0, BASE_H - 0.004, -D * 0.13);
  g.add(well);

  const COLS = 14;
  const ROWS = 5;
  const kw = (W - 0.34) / COLS;
  const kd = (D * 0.54) / ROWS;
  const keyProto = beveledBox(kw * 0.84, 0.028, kd * 0.78, materials.polymer(0x282c33), 0.006);
  const keys = new THREE.InstancedMesh(keyProto.geometry, keyProto.material, ROWS * COLS);
  const keyM = new THREE.Matrix4();
  let ki = 0;
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      keyM.makeTranslation(
        -(W - 0.34) / 2 + kw * (c + 0.5),
        BASE_H + 0.012,
        -D * 0.13 - (D * 0.54) / 2 + kd * (r + 0.5),
      );
      keys.setMatrixAt(ki++, keyM);
    }
  }
  keys.instanceMatrix.needsUpdate = true;
  keys.castShadow = true;
  g.add(keys);
  const trackpadMat = new THREE.MeshPhysicalMaterial({
    color: 0x1d2025, metalness: 0.1, roughness: 0.28,
    clearcoat: 0.8, clearcoatRoughness: 0.22,
    clearcoatRoughnessMap: smudgeMap(), // the most-touched surface on the machine
  });
  const trackpad = beveledBox(0.78, 0.014, 0.44, trackpadMat, 0.01);
  trackpad.position.set(0, BASE_H + 0.006, D * 0.28);
  g.add(trackpad);

  // The clutch hinge — two barrels with a gap, the way a real laptop's lid
  // actually attaches. Its absence was the loudest thing missing from the
  // macro step: the lid appeared to grow out of the deck.
  const hingeMat = new THREE.MeshPhysicalMaterial({ color: 0x2b2f34, metalness: 0.86, roughness: 0.36 });
  [-0.62, 0.62].forEach((hx) => {
    const barrel = rod(0.042, 0.64, hingeMat, 20);
    barrel.rotation.z = Math.PI / 2; // rod runs +Y; lay it along -X
    barrel.position.set(hx + 0.32, BASE_H + 0.014, -D / 2 + 0.05);
    g.add(barrel);
  });
  const footMat = materials.rubber(0x131518);
  [[-1, -1], [1, -1], [-1, 1], [1, 1]].forEach(([fx, fz]) => {
    const foot = beveledBox(0.14, 0.022, 0.14, footMat, 0.008);
    foot.position.set(fx * (W / 2 - 0.22), -0.008, fz * (D / 2 - 0.18));
    g.add(foot);
  });

  // ---- lid: hinged at the back edge, opens to 105 degrees ----------------
  // rotation.x = 0 stands the lid straight up; -0.26 rad leans it 15 degrees
  // back (105 deg from the base); +PI/2 folds it shut onto the keyboard.
  const lid = new THREE.Group();
  lid.position.set(0, BASE_H, -D / 2 + 0.05);
  g.add(lid);

  const lidShell = beveledBox(W, LID_H, LID_T, shellMat, 0.028);
  lidShell.position.set(0, LID_H / 2, -LID_T / 2);
  lidShell.castShadow = true;
  lid.add(lidShell);

  const bezel = beveledBox(W - 0.05, LID_H - 0.05, 0.014, materials.polymer(0x0a0c0e), 0.012);
  bezel.position.set(0, LID_H / 2, 0.004);
  lid.add(bezel);

  // ---- screen content --------------------------------------------------
  // Emissive blocks on the lid's front face rather than rendered text: at any
  // camera that fits the whole scene, real text would be sub-pixel mush, and
  // block-level page furniture reads as "a web page" instantly.
  const screen = new THREE.Group();
  lid.add(screen);
  const sW = W - 0.17;
  const sH = LID_H - 0.19;
  const sCy = LID_H / 2;
  const sZ = 0.016;
  const sTop = sCy + sH / 2;

  const backlight = materials.glow(0x0a1c19, 0.7);
  backlight.transparent = true;
  const bg = beveledBox(sW, sH, 0.004, backlight, 0.006);
  bg.position.set(0, sCy, sZ - 0.002);
  screen.add(bg);

  // address bar: padlock pip + the domain, the two things every user reads
  const barMat = materials.glow(0x0c1a16, 0.55);
  const bar = beveledBox(sW - 0.06, 0.115, 0.006, barMat, 0.02);
  bar.position.set(0, sTop - 0.085, sZ);
  screen.add(bar);
  const lockPip = new THREE.Mesh(
    new THREE.SphereGeometry(0.022, 12, 10),
    materials.glow(REQ_COLOR, 1.6),
  );
  lockPip.position.set(-sW / 2 + 0.11, sTop - 0.085, sZ + 0.008);
  screen.add(lockPip);
  const urlSprite = label('example.com', { color: '#dff5ec', size: 0.155 });
  urlSprite.position.set(-sW / 2 + 0.5, sTop - 0.085, sZ + 0.012);
  screen.add(urlSprite);

  // page blocks — each carries the DOM order it paints in
  const pageMats = [];
  function pageBlock(x, y, w, h, color, order) {
    const m = materials.glow(color, 1.15);
    m.transparent = true;
    m.opacity = 0;
    m.depthWrite = false;
    m.userData.order = order;
    pageMats.push(m);
    const b = beveledBox(w, h, 0.005, m, 0.008);
    b.position.set(x, y, sZ + 0.006);
    screen.add(b);
    return b;
  }
  const py = sTop - 0.2;
  pageBlock(0, py - 0.1, sW - 0.06, 0.19, 0x3fa88a, 0.0); // hero banner
  pageBlock(-sW / 2 + 0.42, py - 0.28, 0.72, 0.028, 0xdff5ec, 0.16); // headline
  pageBlock(-sW / 2 + 0.62, py - 0.34, 1.1, 0.018, 0x93b8ae, 0.3);
  pageBlock(-sW / 2 + 0.5, py - 0.39, 0.86, 0.018, 0x93b8ae, 0.4);
  const cardW = (sW - 0.12) / 3;
  pageBlock(-cardW - 0.03, py - 0.56, cardW, 0.2, 0x3d82b5, 0.56); // three cards
  pageBlock(0, py - 0.56, cardW, 0.2, 0x8a68c4, 0.68);
  pageBlock(cardW + 0.03, py - 0.56, cardW, 0.2, 0xb87a52, 0.8);
  pageBlock(-sW / 2 + 0.55, py - 0.74, 0.96, 0.018, 0x93b8ae, 0.92); // footer

  // Cover glass over the display. Plain transparent, never transmission: the
  // page blocks behind it are themselves transparent, and the transmission
  // pass would erase every one of them. depthWrite off so a faded block can't
  // punch through it.
  const coverMat = new THREE.MeshPhysicalMaterial({
    color: 0xdfe9f2,
    metalness: 0,
    roughness: 0.09,
    transparent: true,
    opacity: 0.05,
    depthWrite: false,
    clearcoat: 0.9,
    clearcoatRoughness: 0.2,
    clearcoatRoughnessMap: smudgeMap(),
  });
  const cover = beveledBox(sW + 0.03, sH + 0.03, 0.006, coverMat, 0.008);
  cover.position.set(0, sCy, sZ + 0.026);
  screen.add(cover);

  // ---- the three frontend layers ---------------------------------------
  // They hover in front of the screen and converge onto it as `build` -> 1.
  // Plain transparent plates, never transmission glass: their contents are
  // themselves transparent, and the transmission pass would erase them.
  const layers = new THREE.Group();
  lid.add(layers);
  const layerDefs = [
    { name: 'HTML', color: HTML_COLOR, from: [-1.18, 1.52, 2.25], bars: [0.9, 0.62, 0.74, 0.5, 0.8, 0.42] },
    { name: 'CSS', color: CSS_COLOR, from: [0.0, 1.06, 1.72], bars: [0.55, 0.78, 0.44, 0.66, 0.5] },
    { name: 'JavaScript', color: JS_COLOR, from: [1.24, 0.36, 1.15], bars: [0.7, 0.46, 0.82, 0.38] },
  ];
  const layerParts = layerDefs.map((def) => {
    const grp = new THREE.Group();
    layers.add(grp);
    const plateMat = new THREE.MeshPhysicalMaterial({
      color: def.color,
      metalness: 0,
      roughness: 0.25,
      transparent: true,
      opacity: 0.13,
      depthWrite: false,
      side: THREE.DoubleSide,
    });
    const plate = beveledBox(1.34, 0.88, 0.018, plateMat, 0.02);
    grp.add(plate);
    const barMats = [];
    def.bars.forEach((frac, i) => {
      const bm = materials.glow(def.color, 1.5);
      bm.transparent = true;
      bm.depthWrite = false;
      barMats.push(bm);
      const b = beveledBox(1.16 * frac, 0.05, 0.008, bm, 0.01);
      b.position.set(-0.58 + (1.16 * frac) / 2, 0.28 - i * 0.12, 0.016);
      grp.add(b);
    });
    const tag = label(def.name, { color: '#f2f7f5', size: 0.19 });
    tag.material.transparent = true;
    tag.position.set(0, 0.55, 0.05);
    grp.add(tag);
    return { grp, plateMat, barMats, tag, from: def.from };
  });

  // ---- pose -------------------------------------------------------------
  function setLid(open) {
    lid.rotation.x = Math.PI / 2 + open * (-Math.PI / 2 - 0.26);
  }
  function setPaint(t) {
    pageMats.forEach((m) => {
      // each block fades in over its own slice of the paint sweep, in DOM
      // order — the page fills top-down the way a real one does
      m.opacity = win(t, m.userData.order * 0.82, m.userData.order * 0.82 + 0.18);
    });
    backlight.emissiveIntensity = 0.7 + t * 0.5;
  }
  function setLock(t) {
    const hex = t > 0.5 ? REQ_COLOR : 0x5c6a66;
    lockPip.material.emissiveIntensity = 0.5 + t * 1.5;
    lockPip.material.color.setHex(hex);
    lockPip.material.emissive.setHex(hex);
  }
  function setBuild(t) {
    layers.visible = t > 0.012;
    layerParts.forEach((lp, i) => {
      // staggered: HTML lands first, then CSS, then JS — the real order, and
      // the reason a blocking <script> stalls everything behind it
      const u = win(t, i * 0.16, 0.6 + i * 0.13);
      lp.grp.position.set(
        lp.from[0] * (1 - u),
        sCy + (lp.from[1] - sCy) * (1 - u),
        sZ + (lp.from[2] - sZ) * (1 - u),
      );
      const fade = Math.min(1, t * 8) * (1 - u * 0.86);
      lp.plateMat.opacity = 0.13 * fade;
      lp.barMats.forEach((bm) => { bm.opacity = fade; });
      lp.tag.material.opacity = Math.min(1, fade * 1.4);
      lp.grp.scale.setScalar(1 - u * 0.42);
    });
  }
  setLid(1);
  setPaint(1);
  setLock(0);
  setBuild(0);

  return {
    group: g,
    setLid,
    setPaint,
    setLock,
    setBuild,
    lid,
    screen,
    W,
    D,
    LID_H,
    portPt: [W / 2 - 0.28, BASE_H * 0.5, -D / 2 + 0.12],
  };
}

// ---------------------------------------------------------------------------
// THE SERVER — a 12U floor cabinet. Louvred front door on a real hinge; three
// 1U web-server sleds up top, two 2U application sleds under them (the lower
// one slides out on its rails to show the silicon), and a 3U database unit at
// the bottom whose bezel drops to expose the platters.
// 1U = 1.75/19 of the 19-inch equipment width, held exactly.
// ---------------------------------------------------------------------------
function buildRack() {
  const g = new THREE.Group();
  const W = 2.0;
  const H = 2.5;
  const D = 2.4;
  const IW = W - 0.16; // interior equipment width, our "19 inches"
  const U = (1.75 / 19) * IW; // 0.1697 — the whole stack derives from this

  const frameMat = materials.paintedMetal(0x2b2f35);
  frameMat.roughness = 0.52;
  const linerMat = materials.polymer(0x0e1013);
  const steelMat = new THREE.MeshPhysicalMaterial({ color: 0x8f959d, metalness: 0.8, roughness: 0.5 });
  const darkSteel = new THREE.MeshPhysicalMaterial({ color: 0x3d434b, metalness: 0.8, roughness: 0.5 });

  // shell: posts, top, bottom, sides, back — plus a dark liner inside every
  // metal panel so no concave polished interior ever faces the camera
  const post = beveledBox(0.09, H, 0.09, frameMat, 0.015);
  [[-W / 2 + 0.045, -D / 2 + 0.045], [W / 2 - 0.045, -D / 2 + 0.045],
    [-W / 2 + 0.045, D / 2 - 0.045], [W / 2 - 0.045, D / 2 - 0.045]].forEach((p) => {
    const c = post.clone();
    c.position.set(p[0], H / 2, p[1]);
    c.castShadow = true;
    g.add(c);
  });
  const topPanel = beveledBox(W, 0.09, D, frameMat, 0.018);
  topPanel.position.set(0, H - 0.045, 0);
  topPanel.castShadow = true;
  g.add(topPanel);
  const botPanel = beveledBox(W, 0.09, D, frameMat, 0.018);
  botPanel.position.set(0, 0.045, 0);
  botPanel.receiveShadow = true;
  g.add(botPanel);
  const backPanel = beveledBox(W - 0.09, H - 0.14, 0.05, frameMat, 0.014);
  backPanel.position.set(0, H / 2, -D / 2 + 0.03);
  g.add(backPanel);
  const backLiner = beveledBox(W - 0.13, H - 0.18, 0.012, linerMat, 0.008);
  backLiner.position.set(0, H / 2, -D / 2 + 0.062);
  g.add(backLiner);
  [-1, 1].forEach((s) => {
    const side = beveledBox(0.045, H - 0.14, D - 0.11, frameMat, 0.014);
    side.position.set(s * (W / 2 - 0.028), H / 2, 0);
    g.add(side);
    const liner = beveledBox(0.012, H - 0.18, D - 0.15, linerMat, 0.008);
    liner.position.set(s * (W / 2 - 0.058), H / 2, 0);
    g.add(liner);
  });
  const floorLiner = beveledBox(W - 0.13, 0.012, D - 0.15, linerMat, 0.008);
  floorLiner.position.set(0, 0.096, 0);
  g.add(floorLiner);

  // Square mounting holes down both front rails at 1U pitch — the detail that
  // says "rack" faster than anything else in the cabinet. Instanced: this is
  // greebling, and greebling rides one draw call.
  const holeProto = new THREE.BoxGeometry(0.03, U * 0.3, 0.05);
  const holeCount = 12;
  const railHoles = new THREE.InstancedMesh(holeProto, linerMat, holeCount * 2);
  const hm = new THREE.Matrix4();
  let hi = 0;
  for (let side = 0; side < 2; side++) {
    for (let k = 0; k < holeCount; k++) {
      hm.makeTranslation(
        (side ? 1 : -1) * (IW / 2 + 0.028),
        0.24 + k * U,
        D / 2 - 0.075,
      );
      railHoles.setMatrixAt(hi++, hm);
    }
  }
  railHoles.instanceMatrix.needsUpdate = true;
  g.add(railHoles);

  // ---- louvred front door on a real left-hand hinge ---------------------
  const door = new THREE.Group();
  door.position.set(-W / 2 + 0.05, 0, D / 2 - 0.03);
  g.add(door);
  const doorW = W - 0.1;
  const doorH = H - 0.12;
  [-doorW / 2 + 0.035, doorW / 2 - 0.035].forEach((dx) => {
    const rail = beveledBox(0.07, doorH, 0.05, frameMat, 0.012);
    rail.position.set(doorW / 2 + dx, H / 2, 0);
    door.add(rail);
  });
  [doorH / 2 - 0.035, -doorH / 2 + 0.035].forEach((dy) => {
    const rail = beveledBox(doorW, 0.07, 0.05, frameMat, 0.012);
    rail.position.set(doorW / 2, H / 2 + dy, 0);
    door.add(rail);
  });
  const SLATS = 11;
  for (let i = 0; i < SLATS; i++) {
    const slat = beveledBox(doorW - 0.14, 0.085, 0.028, frameMat, 0.008);
    slat.position.set(doorW / 2, H / 2 - doorH / 2 + 0.12 + i * ((doorH - 0.24) / (SLATS - 1)), 0);
    slat.rotation.x = -0.42; // angled louvres — air in from below, sight lines in too
    door.add(slat);
  }
  const handle = beveledBox(0.05, 0.26, 0.05, steelMat, 0.014);
  handle.position.set(doorW - 0.12, H / 2, 0.05);
  door.add(handle);

  // ---- equipment stack --------------------------------------------------
  // Centres derived top-down from the interior ceiling so every gap is a whole
  // fraction of a U — the way a real rack is actually populated.
  const yTop = H - 0.2;
  const sledDepth = 1.95;
  const faceZ = D / 2 - 0.16;

  const ledPipGeo = new THREE.SphereGeometry(0.019, 10, 8);
  function buildSled(units, opts = {}) {
    const { led = REQ_COLOR, ledCount = 3, drives = 0, fan = true } = opts;
    const h = U * units - 0.014; // a sliver of rack gap between neighbours
    const s = new THREE.Group();
    // A tray, not a sealed box: floor, two sides, a back, and a separate top
    // COVER. Pulling a sled out only means something if you can see into it,
    // and a real server's lid comes off exactly this way.
    const wallMat = materials.polymer(0x131519);
    const zc = -sledDepth / 2 + faceZ - 0.02;
    const floorPan = beveledBox(IW - 0.02, 0.016, sledDepth, wallMat, 0.006);
    floorPan.position.set(0, -h * 0.46, zc);
    s.add(floorPan);
    [-1, 1].forEach((sx) => {
      const wall = beveledBox(0.016, h * 0.92, sledDepth, wallMat, 0.005);
      wall.position.set(sx * (IW / 2 - 0.018), 0, zc);
      s.add(wall);
    });
    const backPan = beveledBox(IW - 0.02, h * 0.92, 0.016, wallMat, 0.005);
    backPan.position.set(0, 0, zc - sledDepth / 2 + 0.008);
    s.add(backPan);
    const cover = beveledBox(IW - 0.02, 0.016, sledDepth, wallMat, 0.006);
    cover.position.set(0, h * 0.46, zc);
    cover.castShadow = true;
    s.add(cover);
    s.userData.cover = cover;
    const plate = ventPlate(IW, h, 0.032, h * 0.3, IW / 2 - h * 0.42, 0, steelMat);
    plate.position.set(0, 0, faceZ);
    s.add(plate);
    if (fan) {
      const f = buildFan(h * 0.3, 7, darkSteel);
      f.position.set(IW / 2 - h * 0.42, 0, faceZ - 0.05);
      s.add(f);
      s.userData.fan = f;
    }
    const pips = [];
    for (let i = 0; i < ledCount; i++) {
      const m = materials.glow(i === 0 ? led : 0x2f6f5a, 1.4);
      m.transparent = true;
      const pip = new THREE.Mesh(ledPipGeo, m);
      pip.position.set(-IW / 2 + 0.08 + i * 0.06, h * 0.24, faceZ + 0.02);
      s.add(pip);
      pips.push(m);
    }
    for (let i = 0; i < drives; i++) {
      const bay = beveledBox(0.2, h * 0.58, 0.02, darkSteel, 0.006);
      bay.position.set(-IW / 2 + 0.34 + i * 0.23, -h * 0.05, faceZ + 0.02);
      s.add(bay);
    }
    s.userData.pips = pips;
    return s;
  }

  const webSleds = [];
  for (let i = 0; i < 3; i++) {
    const s = buildSled(1, { led: REQ_COLOR, ledCount: 3, drives: 2 });
    s.position.y = yTop - U * (0.5 + i);
    g.add(s);
    webSleds.push(s);
  }

  const appTopY = yTop - U * 3 - 0.09;
  const appSleds = [];
  for (let i = 0; i < 2; i++) {
    const s = buildSled(2, { led: CSS_COLOR, ledCount: 4, drives: 3 });
    s.position.y = appTopY - U * (1 + i * 2);
    g.add(s);
    appSleds.push(s);
  }

  // the lower application sled rides out on its rails to show the silicon
  const appOutSled = appSleds[1];
  const guts = new THREE.Group();
  appOutSled.add(guts);
  const pcb = beveledBox(IW - 0.12, 0.016, sledDepth - 0.24, new THREE.MeshPhysicalMaterial({ color: 0x0d3b2c, metalness: 0.18, roughness: 0.58 }), 0.008);
  pcb.position.set(0, -U * 0.58, -0.36);
  guts.add(pcb);
  // map-free: the aluminum preset's roughnessMap has no useful scale on fins
  // this small and rendered them near-black
  const finMat = new THREE.MeshPhysicalMaterial({ color: 0xccd2da, metalness: 0.9, roughness: 0.3 });
  const heat = finStack({ count: 13, size: 0.125, thickness: 0.01, gap: 0.021, shape: 'square' }, finMat);
  heat.rotation.x = -Math.PI / 2; // fins stand vertical, stacked front to back
  heat.position.set(-0.3, -U * 0.16, 0.16);
  const cpuBase = beveledBox(0.3, 0.03, 0.3, finMat, 0.006);
  cpuBase.position.set(-0.3, -U * 0.5, -0.05);
  guts.add(cpuBase);
  guts.add(heat);
  const dimmMat = new THREE.MeshPhysicalMaterial({ color: 0x14503c, metalness: 0.15, roughness: 0.6 });
  const goldMat = new THREE.MeshPhysicalMaterial({ color: 0xcaa24a, metalness: 1, roughness: 0.35 });
  for (let i = 0; i < 6; i++) {
    const slot = new THREE.Group();
    slot.position.set(0.12 + i * 0.085, -U * 0.5, -0.06);
    guts.add(slot);
    const stick = beveledBox(0.026, U * 1.05, 0.46, dimmMat, 0.005);
    stick.position.y = U * 0.55;
    slot.add(stick);
    const contact = beveledBox(0.03, 0.024, 0.4, goldMat, 0.004);
    contact.position.y = 0.03;
    slot.add(contact);
  }
  const gutFans = [];
  [-0.44, -0.08, 0.28].forEach((x) => {
    const f = buildFan(U * 0.5, 7, darkSteel);
    f.position.set(x, -U * 0.2, -0.78);
    guts.add(f);
    gutFans.push(f);
  });

  // ---- database unit: a 3U drive shelf that pulls OUT on its rails -------
  // The platters lie flat on a vertical spindle, which is how a rack drive
  // shelf actually stacks them — and which means they are edge-on and
  // invisible from any front camera. So the drawer slides out and its top
  // cover comes off, and you look DOWN into it. That is also how a technician
  // sees one.
  const dbTopY = appTopY - U * 4 - 0.1;
  const dbH = U * 3 - 0.014;
  const dbY = dbTopY - (U * 3) / 2;
  const dbUnit = new THREE.Group();
  dbUnit.position.y = dbY;
  g.add(dbUnit);

  const dbDrawer = new THREE.Group();
  dbUnit.add(dbDrawer);
  const dbWall = materials.polymer(0x131519);
  const dbZc = -sledDepth / 2 + faceZ - 0.02;
  const dbFloor = beveledBox(IW - 0.02, 0.018, sledDepth, dbWall, 0.006);
  dbFloor.position.set(0, -dbH * 0.47, dbZc);
  dbDrawer.add(dbFloor);
  [-1, 1].forEach((sx) => {
    const wall = beveledBox(0.018, dbH * 0.94, sledDepth, dbWall, 0.005);
    wall.position.set(sx * (IW / 2 - 0.019), 0, dbZc);
    dbDrawer.add(wall);
  });
  const dbBack = beveledBox(IW - 0.02, dbH * 0.94, 0.018, dbWall, 0.005);
  dbBack.position.set(0, 0, dbZc - sledDepth / 2 + 0.009);
  dbDrawer.add(dbBack);
  const dbCover = beveledBox(IW - 0.02, 0.018, sledDepth, dbWall, 0.006);
  dbCover.position.set(0, dbH * 0.47, dbZc);
  dbCover.castShadow = true;
  dbDrawer.add(dbCover);

  const bezelPlate = ventPlate(IW, dbH, 0.034, dbH * 0.14, IW / 2 - dbH * 0.22, dbH * 0.3, steelMat);
  bezelPlate.position.set(0, 0, faceZ);
  dbDrawer.add(bezelPlate);
  const dbBadgeMat = materials.glow(RESP_COLOR, 1.5);
  dbBadgeMat.transparent = true;
  const badge = beveledBox(0.3, 0.028, 0.012, dbBadgeMat, 0.008);
  badge.position.set(-IW / 2 + 0.26, dbH * 0.24, faceZ + 0.024);
  dbDrawer.add(badge);

  const platters = new THREE.Group();
  platters.position.set(-0.16, -dbH * 0.12, faceZ - 0.78);
  dbDrawer.add(platters);
  const spindle = disc(0.038, dbH * 0.66, materials.chrome(0xc8ced6), 20);
  spindle.position.y = dbH * 0.2;
  platters.add(spindle);
  const platterMat = materials.chrome(0xe8eef4);
  platterMat.roughness = 0.09;
  platterMat.envMapIntensity = 1.7;
  // Lathed rather than a plain cylinder: a real platter has a rounded outer
  // rim and a spindle bore, and at this macro camera the sharp cut edge of a
  // CylinderGeometry was the giveaway.
  const PR = 0.42;
  const PT = 0.008;
  const pe = 0.0035;
  const platterProfile = [
    [0.05, -PT / 2], [PR - pe, -PT / 2],
    [PR - pe * 0.3, -PT / 2 + pe * 0.55], [PR, 0],
    [PR - pe * 0.3, PT / 2 - pe * 0.55], [PR - pe, PT / 2], [0.05, PT / 2],
  ];
  for (let i = 0; i < 4; i++) {
    const pl = lathe(platterProfile, platterMat, 64);
    pl.position.y = i * (dbH * 0.16);
    platters.add(pl);
  }
  // the rest of the shelf: more drives, because one table is never one disc
  const driveMat = materials.polymer(0x1c2126);
  for (let i = 0; i < 4; i++) {
    const drv = beveledBox(0.26, dbH * 0.42, 0.62, driveMat, 0.012);
    drv.position.set(-IW / 2 + 0.24 + i * 0.3, -dbH * 0.24, faceZ - 1.55);
    dbDrawer.add(drv);
    const lidStrip = beveledBox(0.2, 0.012, 0.5, materials.aluminum(0xaeb5be), 0.004);
    lidStrip.position.set(-IW / 2 + 0.24 + i * 0.3, -dbH * 0.02, faceZ - 1.55);
    dbDrawer.add(lidStrip);
  }
  const actuator = new THREE.Group();
  actuator.position.set(0.58, -dbH * 0.12, faceZ - 0.78);
  dbDrawer.add(actuator);
  const pivot = disc(0.05, dbH * 0.56, darkSteel, 18);
  pivot.position.y = dbH * 0.2;
  actuator.add(pivot);
  const armGroup = new THREE.Group();
  actuator.add(armGroup);
  for (let i = 0; i < 4; i++) {
    const arm = beveledBox(0.52, 0.012, 0.05, materials.aluminum(0xaeb5be), 0.005);
    arm.position.set(-0.27, i * (dbH * 0.16) + 0.012, 0);
    armGroup.add(arm);
  }
  // the row this seek is fetching — lifts off the platter and rides to the app
  const rowMat = materials.glow(RESP_COLOR, 1.9);
  rowMat.transparent = true;
  rowMat.opacity = 0;
  rowMat.depthWrite = false;
  const rowDot = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), rowMat);
  dbDrawer.add(rowDot);

  // patch panel at the bottom — where the world's cable actually lands
  const patch = buildSled(1, { led: DNS_COLOR, ledCount: 6, drives: 0, fan: false });
  patch.position.y = dbTopY - U * 3 - 0.1 - U * 0.5;
  g.add(patch);

  // top exhaust fan
  const exhaust = buildFan(0.28, 9, darkSteel);
  exhaust.rotation.x = -Math.PI / 2;
  exhaust.position.set(0, H - 0.1, -0.35);
  g.add(exhaust);

  const allFans = [...webSleds, ...appSleds].map((s) => s.userData.fan).filter(Boolean);

  // ---- pose -------------------------------------------------------------
  function setDoor(t) {
    door.rotation.y = -t * 2.05; // swings open toward the camera's left
  }
  function setAppOut(t) {
    appOutSled.position.z = t * 1.2;
    appOutSled.userData.cover.visible = t < 0.5; // lid off once it's out
  }
  function setDbOpen(t) {
    dbDrawer.position.z = t * 1.3;
    dbCover.visible = t < 0.5;
  }
  function setSpin(phase, amount) {
    const a = amount > 0.02 ? phase * TAU * 6 : 0; // 6 whole turns per lap
    allFans.forEach((f, i) => { f.rotation.z = a * (i % 2 ? 1 : -1); });
    gutFans.forEach((f) => { f.rotation.z = a; });
    exhaust.rotation.z = a * 0.5;
  }
  function setDb(phase, amount) {
    platters.rotation.y = phase * TAU * 4; // 4 whole turns per lap
    // One decisive seek per lap: the index already knows which track, so the
    // head goes straight there instead of sweeping the whole disc. The two
    // Gaussian bumps are the arrival settle and the park settle — a real
    // actuator lands hard and rings down once, it does not glide to a halt.
    // Both centres sit 5+ widths inside the lap so their tails are ~1e-14 at
    // the wrap; a bump near u=0 or u=1 silently breaks the loop and verify.mjs
    // cannot see it.
    const seek = win(phase, 0.06, 0.2) - win(phase, 0.62, 0.82);
    const ring = (at, w, amp) => amp * Math.exp(-(((phase - at) / w) ** 2));
    const settle = ring(0.222, 0.026, 0.019) - ring(0.272, 0.03, 0.008)
      + ring(0.842, 0.026, -0.015) + ring(0.892, 0.03, 0.006);
    armGroup.rotation.y = -0.62 + seek * 0.7 + settle;
    const lift = win(phase, 0.24, 0.56);
    rowDot.position.set(
      0.1 - lift * 0.12,
      -dbH * 0.12 + 0.22 + lift * 0.85,
      faceZ - 0.78 + lift * 0.32,
    );
    rowMat.opacity = amount * Math.min(1, lift * 6) * Math.min(1, (1 - lift) * 6);
  }
  function setLeds(phase, amount) {
    [...webSleds, ...appSleds, patch].forEach((s, i) => {
      s.userData.pips.forEach((m, j) => {
        const t = (phase * 3 + i * 0.17 + j * 0.31) % 1;
        const flick = Math.max(0, 1 - Math.abs(1 - 2 * t) * 1.6);
        m.emissiveIntensity = (0.35 + 1.5 * flick) * (0.25 + amount * 0.75);
      });
    });
  }

  setDoor(0);
  setAppOut(0);
  setDbOpen(0);

  return {
    group: g,
    setDoor,
    setAppOut,
    setDbOpen,
    setSpin,
    setDb,
    setLeds,
    W,
    H,
    D,
    U,
    webSleds,
    appSleds,
    dbUnit,
    dbDrawer,
    faceZ,
    entryPt: [-0.6, yTop - U * 1.5, -D / 2 + 0.12],
    webPt: [0.1, yTop - U * 1.5, faceZ - 0.6],
    appPt: [0.1, appTopY - U * 3, faceZ - 0.6],
    dbPt: [-0.16, dbY + dbH * 0.28, faceZ - 0.78],
    heights: { yTop, appTopY, dbY, dbH },
  };
}

// ---------------------------------------------------------------------------
// THE NAME — the domain plaque, plus the lookup chain that turns it into an
// address. It floats between the two machines because that is exactly what it
// is: not part of either one, a rented label pointing at a number.
// ---------------------------------------------------------------------------
function buildDomainStack() {
  const g = new THREE.Group();

  const plaque = infoCard('example.com', 1.85, 0.5, { glow: REQ_COLOR, size: 0.29 });
  plaque.group.position.set(-1.25, 2.62, 0);
  // the accent green is far more saturated than the chain's pale blue, so this
  // one face needs pulling down further or it reads as a lit sign
  plaque.faceMat.emissiveIntensity = 0.07;
  plaque.faceMat.opacity = 0.22;
  g.add(plaque.group);

  // the resolution chain, only shown on its own step
  const chainGroup = new THREE.Group();
  g.add(chainGroup);
  const nodes = [
    { text: 'Resolver', pos: [-0.8, 3.1, 0], w: 1.1 },
    { text: 'Root .', pos: [0.35, 3.94, 0], w: 0.95 },
    { text: '.com registry', pos: [1.5, 3.34, 0], w: 1.4 },
    { text: 'Nameserver', pos: [2.35, 2.64, 0], w: 1.32 },
  ];
  const chainCards = nodes.map((n) => {
    const c = infoCard(n.text, n.w, 0.4, { glow: DNS_COLOR, size: 0.2 });
    c.group.position.set(...n.pos);
    chainGroup.add(c.group);
    return c;
  });
  const answer = infoCard('203.0.113.42', 1.45, 0.42, { glow: RESP_COLOR, size: 0.21 });
  answer.group.position.set(0.8, 1.94, 0);
  chainGroup.add(answer.group);

  // out-and-back: the query climbs the hierarchy and the address comes home,
  // so one lap is exactly one lookup and the wrap pose is the start pose
  const path = [
    [-1.25, 2.62, 0], ...nodes.map((n) => n.pos), [0.8, 1.94, 0], [-1.25, 2.62, 0],
  ];
  const query = buildStream(path, { color: DNS_COLOR, count: 5, size: 0.038, speedMul: 1 });
  chainGroup.add(query.group);

  function setChain(show) {
    chainGroup.visible = show > 0.5;
  }
  // The name only belongs to the steps that are about the name. Left on, it
  // floats dead-centre through the server and browser steps explaining nothing.
  function setPlaque(show) {
    plaque.group.visible = show > 0.5;
  }
  function setLookup(phase, amount) {
    query.update(phase, amount);
    // Each card lights as the query reaches it, then fades back before the lap
    // wraps. A plain rising win() left every card lit at t=1 and dark at t=0,
    // which popped the whole hierarchy dark once per lap — a visible seam.
    const pulse = (u, r0, r1, f0, f1) => win(u, r0, r1) - win(u, f0, f1);
    chainCards.forEach((c, i) => {
      // The fall window MUST finish inside the lap. At i=3 the old spacing ran
      // it to 1.05, so the last card was still a fifth lit at the wrap and
      // snapped dark — the one seam a framebuffer diff caught and the pose
      // sampling did not.
      const reach = pulse(phase, 0.08 + i * 0.13, 0.18 + i * 0.13, 0.74 + i * 0.04, 0.86 + i * 0.04);
      c.faceMat.opacity = 0.3 + reach * 0.38 * amount;
    });
    answer.faceMat.opacity = 0.3 + pulse(phase, 0.62, 0.74, 0.9, 1.0) * 0.42 * amount;
  }
  setChain(0);

  return { group: g, setChain, setPlaque, setLookup, plaque, answer, chainCards };
}

// ---------------------------------------------------------------------------
export function buildWebsite({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const laptopPlinth = studioPlinth({ w: 3.5, h: DECK_Y, d: 2.5 });
  laptopPlinth.position.set(LAPTOP_X, 0, 0);
  group.add(laptopPlinth);
  const rackPlinth = studioPlinth({ w: 2.9, h: DECK_Y, d: 3.1 });
  rackPlinth.position.set(RACK_X, 0, 0);
  group.add(rackPlinth);

  const laptop = buildLaptop();
  laptop.group.position.set(LAPTOP_X, DECK_Y, 0);
  group.add(laptop.group);

  const rack = buildRack();
  rack.group.position.set(RACK_X, DECK_Y, 0);
  group.add(rack.group);

  const domain = buildDomainStack();
  group.add(domain.group);

  // ---- the cable: one physical link, two directions ----------------------
  const portW = [LAPTOP_X + laptop.portPt[0], DECK_Y + laptop.portPt[1], laptop.portPt[2]];
  const entryW = [RACK_X + rack.entryPt[0], DECK_Y + rack.entryPt[1], rack.entryPt[2]];
  const outPath = [
    portW,
    [LAPTOP_X + 1.85, DECK_Y - 0.06, -0.44],
    [-1.7, 0.11, -0.3],
    [1.7, 0.11, -0.3],
    [RACK_X - 1.6, DECK_Y - 0.02, -0.5],
    [RACK_X - 1.12, DECK_Y + 0.5, -0.92],
    [RACK_X - 0.95, DECK_Y + 1.5, -1.16],
    entryW,
  ];
  const backPath = [...outPath].reverse().map((p) => [p[0], p[1] + 0.03, p[2] + 0.17]);

  const request = buildStream(outPath, { color: REQ_COLOR, count: 8, size: 0.032, speedMul: 2, wire: true, radius: 0.026 });
  group.add(request.group);
  const response = buildStream(backPath, { color: RESP_COLOR, count: 8, size: 0.032, speedMul: 2, wire: true, radius: 0.022 });
  group.add(response.group);

  // TCP + TLS: shuttles out and back before any page can even be asked for
  const hsPath = [...outPath, ...[...outPath].reverse().slice(1)];
  const handshake = buildStream(hsPath, { color: 0xdff5ec, count: 3, size: 0.036, speedMul: 1 });
  group.add(handshake.group);

  // inside the rack: web tier -> app tier -> database -> and back out
  const innerPath = [
    rack.entryPt, rack.webPt, rack.appPt, rack.dbPt, rack.appPt, rack.webPt, rack.entryPt,
  ];
  const inner = buildStream(innerPath, { color: REQ_COLOR, count: 6, size: 0.03, speedMul: 1 });
  rack.group.add(inner.group);

  // the HTTP messages themselves, as cards that ride the cable
  const reqCard = infoCard('GET /index.html', 1.05, 0.46, { glow: REQ_COLOR, size: 0.17 });
  group.add(reqCard.group);
  const respCard = infoCard('200 OK', 0.85, 0.46, { glow: RESP_COLOR, size: 0.2 });
  group.add(respCard.group);
  [reqCard, respCard].forEach((c) => {
    c.group.visible = false;
    c.body.material = c.body.material.clone();
    c.body.material.transparent = true;
    c.body.material.depthWrite = false;
    c.sprite.material.transparent = true;
  });

  function rideCard(card, chain, t, amount) {
    const show = amount * Math.min(1, t * 7) * Math.min(1, (1 - t) * 7);
    card.group.visible = show > 0.02;
    if (show <= 0.02) return;
    const p = chain.getPointAt(Math.min(0.999, t));
    card.group.position.set(p.x, p.y + 0.62, p.z + 0.3);
    card.body.material.opacity = show;
    card.faceMat.opacity = 0.36 * show;
    card.sprite.material.opacity = show;
  }

  // ---- callouts ----------------------------------------------------------
  const labels = calloutSets(['overview', 'dns', 'request', 'server', 'backend', 'db', 'response', 'frontend']);
  const L = labels.add;

  L('overview', laptop.lid, 'The frontend — your browser', [0.55, laptop.LID_H * 0.62, 0.1], 40, 96);
  L('overview', domain.plaque.group, 'The domain name — rented', [0.5, 0.18, 0], 36, 100);
  L('overview', rack.group, 'The backend — one server', [0.35, rack.H * 0.76, rack.D / 2], 32, 96);
  L('overview', group, 'One cable, two directions', [1.3, 0.18, -0.2], 56, 92);

  L('dns', domain.plaque.group, 'The name you type', [0.45, -0.16, 0], -44, 88);
  L('dns', domain.chainCards[0].group, 'The resolver asks for you', [0.3, -0.18, 0], -46, 104);
  L('dns', domain.chainCards[2].group, 'Registry: nameservers only', [0.45, 0.16, 0], 38, 108);
  L('dns', domain.chainCards[3].group, 'The A record lives here', [0.4, 0.18, 0], 30, 100);
  L('dns', domain.answer.group, 'Cached until the TTL ends', [0.45, -0.16, 0], -38, 104);

  L('request', laptop.lid, 'Padlock: TLS already agreed', [-0.95, laptop.LID_H - 0.2, 0.05], 34, 120);
  L('request', group, 'Method + path + headers', [0.15, 0.85, 0.1], 48, 112);
  L('request', group, 'Handshake first: ~8 round trips', [-1.6, 0.3, -0.2], 40, 120);

  L('server', rack.webSleds[1], 'Web server tier', [0.22, 0.1, rack.faceZ], 28, 92);
  L('server', rack.webSleds[0], 'Three sleds, one job', [0.16, 0.11, rack.faceZ], 44, 116);
  L('server', rack.group, 'Dynamic goes deeper', [0.35, rack.heights.appTopY - 0.12, rack.faceZ], 16, 96);

  L('backend', rack.appSleds[1], 'Your code runs here', [0.3, 0.18, 0.62], 26, 116);
  L('backend', rack.appSleds[1], 'CPU + memory', [-0.3, 0.06, 0.05], 20, 108);
  L('backend', rack.appSleds[0], 'A second app sled, same code', [0.22, 0.12, rack.faceZ], 40, 112);

  L('db', rack.dbDrawer, 'Database: the rows', [-0.16, 0.12, rack.faceZ - 0.78], -30, 104);
  L('db', rack.dbDrawer, 'Index seek — not a scan', [0.58, 0.1, rack.faceZ - 0.78], 24, 104);
  L('db', rack.dbDrawer, 'One row back to the app', [-0.16, 0.5, rack.faceZ - 0.5], 88, 100);

  L('response', laptop.lid, 'First chunk: about 14 KB', [0.62, laptop.LID_H * 0.5, 0.08], 32, 104);
  L('response', group, 'Status + headers + body', [1.5, 0.9, 0.1], 46, 108);

  L('frontend', laptop.lid, 'HTML becomes the DOM', [0.75, laptop.LID_H * 0.94, 0.12], 32, 104);
  L('frontend', laptop.lid, 'CSS becomes the CSSOM', [0.82, laptop.LID_H * 0.66, 0.1], 24, 104);
  L('frontend', laptop.lid, 'JavaScript, same thread', [0.88, laptop.LID_H * 0.38, 0.1], 18, 108);
  L('frontend', laptop.lid, 'Layout, then paint', [0.35, 0.14, 0.06], -34, 100);

  // ---- state -------------------------------------------------------------
  const state = {
    phase: 0,
    reqAmt: 1,
    respAmt: 1,
    hsAmt: 0,
    dnsAmt: 0,
    dnsShow: 0,
    plaqueShow: 1,
    innerAmt: 0,
    reqCardAmt: 0,
    respCardAmt: 0,
    door: 0,
    appOut: 0,
    dbOpen: 0,
    dbAmt: 0,
    fans: 1,
    paint: 1,
    build: 0,
    lock: 0,
    lid: 1,
  };

  function apply() {
    const ph = state.phase;
    request.update(ph, state.reqAmt);
    response.update(ph, state.respAmt);
    handshake.update(ph, state.hsAmt);
    inner.update(ph, state.innerAmt);
    domain.setChain(state.dnsShow);
    domain.setPlaque(state.plaqueShow);
    domain.setLookup(ph, state.dnsAmt);

    rack.setDoor(state.door);
    rack.setAppOut(state.appOut);
    rack.setDbOpen(state.dbOpen);
    rack.setSpin(ph, state.fans);
    rack.setDb(ph, state.dbAmt);
    rack.setLeds(ph, state.fans);

    laptop.setLid(state.lid);
    laptop.setPaint(state.paint);
    laptop.setLock(state.lock);
    laptop.setBuild(state.build);

    // the message cards travel on the same curves the packets do, fading in and
    // out at the ends so the loop wrap is invisible
    rideCard(reqCard, request.chain, win(ph, 0.42, 0.98), state.reqCardAmt);
    rideCard(respCard, response.chain, win(ph, 0.04, 0.56), state.respCardAmt);
  }
  apply();

  return {
    group,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
    anchors: { laptop: LAPTOP_X, rack: RACK_X, deck: DECK_Y },
    parts: {
      laptopLid: laptop.lid,
      appSled: rack.appSleds[1],
      dbUnit: rack.dbUnit,
      screen: laptop.screen,
    },
  };
}
