import * as THREE from 'three';
import { materials, rod } from '../../framework/parts.js';
import { beveledBox, tubeAlong, chainPath, boltCircle } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, win, TAU } from '../../framework/motion.js';

// "How a UPI payment works" — one ₹249 shopfront payment, traced from the
// counter down into the rails that actually carry it.
//
// The scene is a schematic, not to scale: a shop counter in the foreground
// (your phone, the QR standee, the merchant's phone) standing over the network
// layer that does the work — the NPCI switch at the centre, bank vaults on
// radial spokes, and the settlement vault behind it.
//
// Reference facts (cross-checked against NPCI's UPI procedural guidelines, the
// NPCI Common Library spec 1.7, Oracle's UPI switch API guide, NPCI circular
// UPI/OC/197, and the World Bank's India fast-payments case study):
//  - HUB AND SPOKE IS LITERAL. Every bank and PSP connects only to the NPCI
//    switch; no participant has a link to any other participant. That topology
//    is the reason any app can pay into any bank.
//  - A TPAP (GPay, PhonePe…) is not a bank. It rides a sponsor PSP bank's
//    handle — which is why the two pucks sit between the phones and the switch.
//  - ADDRESSING: you pay a virtual address, shop@okaxis. The handle AFTER the @
//    tells the switch which PSP bank holds the mapping to a real account. The
//    switch sends ReqValAdd there; what comes back is the registered NAME, not
//    the account number.
//  - THE PIN: captured and encrypted by NPCI's Common Library ON THE DEVICE —
//    not by the app you tapped — and validated inside tamper-resistant hardware
//    (an HSM) at the bank. The PSP app never sees the PIN.
//  - ORDER OF OPERATIONS: the switch sends ReqPay_Debit to the REMITTER
//    (payer's) bank first. Only when that bank confirms the debit does the
//    switch send ReqPay_Credit to the BENEFICIARY (payee's) bank. Then RespPay
//    goes back to both apps.
//  - NO MONEY CROSSES. Each bank edits its own ledger. The interbank position
//    is a debt the switch records.
//  - SETTLEMENT is deferred and NETTED: NPCI computes each bank's multilateral
//    net position and settles it through the RBI in 10 cycles a day (a further
//    pair of cycles handles disputes).
//  - SCALE: 24.51 billion UPI payments in August 2026 — about 791 million a
//    day, ₹29.82 lakh crore for the month.

// ---------------------------------------------------------------------------
// palette
// ---------------------------------------------------------------------------
const ACCENT = 0x2fd07a; // money / credit — UPI green
const REQ = 0x6ec8ff; // the request message
const LOOKUP = 0x7cf0c8; // address resolution
const IOU = 0xf0a63a; // the debt tally
const STEEL = 0xc6ccd4;

// ---------------------------------------------------------------------------
// world layout
// ---------------------------------------------------------------------------
const HUB_R = 1.2; // hub drum radius (port ring)
const RING_R = 3.9; // radius of the bank ring

// θ in degrees, measured in XZ with 0° = +X and increasing toward +Z.
const PAYER_A = 152;
const PAYEE_A = 28;
const OTHER_A = [208, 250, 290, 332];

const PSP_A_A = 100; // your app's sponsor PSP
const PSP_B_A = 52; // the shop's PSP

const VAULT_Z = -5.4;
const COUNTER = { x: 2.4, z: 6.5, top: 2.05 };

const AMOUNT = 249;
const PAYER_START = 12480;
const PAYEE_START = 8116;

const rad = (deg) => (deg * Math.PI) / 180;
const ring = (deg, r = RING_R) => [r * Math.cos(rad(deg)), 0, r * Math.sin(rad(deg))];

function tri(t) {
  return 1 - Math.abs(1 - 2 * t);
}

// A window that rises over [a,b] and is forced back to 0 before the lap wraps,
// so anything it drives is in an identical state at phase 0 and phase 1.
function pulseWin(u, a, b, fallA = 0.94, fallB = 1.0) {
  return win(u, a, b) * (1 - win(u, fallA, fallB));
}

function wireMat() {
  return new THREE.MeshPhysicalMaterial({ color: 0x15181c, metalness: 0.7, roughness: 0.48 });
}

function darkLiner() {
  // never leave a concave metal interior visible — a rough dark liner instead
  return new THREE.MeshStandardMaterial({
    color: 0x0d0f12,
    metalness: 0.1,
    roughness: 0.95,
    side: THREE.BackSide,
  });
}

function discMesh(r, h, material, seg = 40) {
  return new THREE.Mesh(new THREE.CylinderGeometry(r, r, h, seg), material);
}

// ---------------------------------------------------------------------------
// canvas textures
// ---------------------------------------------------------------------------
function canvasTexture(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  texture.anisotropy = 8;
  return { ctx, texture };
}

const money = (n) => '₹ ' + n.toLocaleString('en-IN');

// A bank's ledger face: a dark display showing the balance it holds for one
// customer. Redrawn only when the displayed integer actually changes.
function buildLedgerFace(title, startValue) {
  const { ctx, texture } = canvasTexture(512, 256);
  let last = null;
  function draw(value) {
    const v = Math.round(value);
    if (v === last) return;
    last = v;
    ctx.fillStyle = '#0b0d10';
    ctx.fillRect(0, 0, 512, 256);
    ctx.strokeStyle = 'rgba(120,140,160,0.28)';
    ctx.lineWidth = 3;
    ctx.strokeRect(10, 10, 492, 236);
    ctx.fillStyle = '#7b8896';
    ctx.font = '600 30px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText(title, 34, 64);
    ctx.fillStyle = v === startValue ? '#dfe6ee' : v < startValue ? '#ff9b7a' : '#2fd07a';
    ctx.font = '700 84px "Segoe UI", sans-serif';
    ctx.fillText(money(v), 34, 160);
    ctx.fillStyle = '#5c6875';
    ctx.font = '500 26px "Segoe UI", sans-serif';
    ctx.fillText("this bank's own book", 34, 212);
    texture.needsUpdate = true;
  }
  draw(startValue);
  return { texture, draw };
}

// The payer's phone screen. `stage` 0..4 walks the real app flow.
function buildPhoneScreen() {
  const { ctx, texture } = canvasTexture(256, 512);
  let last = -1;
  function draw(stage) {
    const s = Math.round(stage);
    if (s === last) return;
    last = s;
    ctx.fillStyle = '#0c0f13';
    ctx.fillRect(0, 0, 256, 512);
    ctx.fillStyle = '#16342a';
    ctx.fillRect(0, 0, 256, 54);
    ctx.fillStyle = '#2fd07a';
    ctx.font = '700 22px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('UPI', 18, 35);

    if (s >= 1) {
      ctx.fillStyle = '#7b8896';
      ctx.font = '500 17px "Segoe UI", sans-serif';
      ctx.fillText('PAYING', 18, 104);
      ctx.fillStyle = '#dfe6ee';
      ctx.font = '600 25px "Segoe UI", sans-serif';
      ctx.fillText('shop@okaxis', 18, 136);
    }
    if (s >= 2) {
      ctx.fillStyle = '#2fd07a';
      ctx.font = '700 23px "Segoe UI", sans-serif';
      ctx.fillText('SHREE STORES', 18, 176);
      ctx.fillStyle = '#dfe6ee';
      ctx.font = '700 60px "Segoe UI", sans-serif';
      ctx.fillText(money(AMOUNT), 18, 252);
    }
    if (s === 3) {
      ctx.fillStyle = '#7b8896';
      ctx.font = '500 17px "Segoe UI", sans-serif';
      ctx.fillText('ENTER UPI PIN', 18, 300);
      for (let i = 0; i < 4; i++) {
        ctx.fillStyle = '#2fd07a';
        ctx.beginPath();
        ctx.arc(34 + i * 34, 330, 9, 0, TAU);
        ctx.fill();
      }
      for (let r = 0; r < 4; r++) {
        for (let c = 0; c < 3; c++) {
          ctx.fillStyle = '#1b2026';
          ctx.fillRect(22 + c * 74, 366 + r * 34, 64, 26);
        }
      }
    }
    if (s >= 4) {
      ctx.fillStyle = '#2fd07a';
      ctx.beginPath();
      ctx.arc(128, 340, 44, 0, TAU);
      ctx.fill();
      ctx.strokeStyle = '#0c0f13';
      ctx.lineWidth = 9;
      ctx.beginPath();
      ctx.moveTo(106, 340);
      ctx.lineTo(122, 357);
      ctx.lineTo(152, 322);
      ctx.stroke();
      ctx.fillStyle = '#dfe6ee';
      ctx.font = '600 21px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText('Paid ' + money(AMOUNT), 128, 424);
    }
    texture.needsUpdate = true;
  }
  draw(0);
  return { texture, draw };
}

// The merchant's phone: idle, then the "received" card.
function buildMerchantScreen() {
  const { ctx, texture } = canvasTexture(256, 512);
  let last = -1;
  function draw(stage) {
    const s = Math.round(stage);
    if (s === last) return;
    last = s;
    ctx.fillStyle = '#0c0f13';
    ctx.fillRect(0, 0, 256, 512);
    ctx.fillStyle = '#16342a';
    ctx.fillRect(0, 0, 256, 54);
    ctx.fillStyle = '#2fd07a';
    ctx.font = '700 19px "Segoe UI", sans-serif';
    ctx.textAlign = 'left';
    ctx.fillText('SHREE STORES', 18, 35);
    if (s >= 1) {
      ctx.fillStyle = '#132a22';
      ctx.fillRect(16, 180, 224, 150);
      ctx.fillStyle = '#2fd07a';
      ctx.font = '700 52px "Segoe UI", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(money(AMOUNT), 128, 250);
      ctx.fillStyle = '#9fb0bd';
      ctx.font = '600 21px "Segoe UI", sans-serif';
      ctx.fillText('received', 128, 292);
    }
    texture.needsUpdate = true;
  }
  draw(0);
  return { texture, draw };
}

// The shopfront QR standee. A deterministic module grid — this explainer does
// NOT import the qr-code explainer (that would collapse the lazy split); what
// the modules encode is that explainer's job, not this one's.
function buildQrTexture() {
  const { ctx, texture } = canvasTexture(512, 640);
  let seed = 0x9e3779b9;
  const rnd = () => {
    seed = (seed + 0x6d2b79f5) | 0;
    let t = Math.imul(seed ^ (seed >>> 15), 1 | seed);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
  ctx.fillStyle = '#f4f6f8';
  ctx.fillRect(0, 0, 512, 640);
  ctx.fillStyle = '#16342a';
  ctx.fillRect(0, 0, 512, 78);
  ctx.fillStyle = '#2fd07a';
  ctx.font = '700 40px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.fillText('SCAN & PAY', 256, 54);

  const N = 25;
  const CELL = 14;
  const ox = 256 - (N * CELL) / 2;
  const oy = 118;
  const finder = (cx, cy) =>
    (cx < 7 && cy < 7) || (cx >= N - 7 && cy < 7) || (cx < 7 && cy >= N - 7);
  ctx.fillStyle = '#10141a';
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      let on;
      if (finder(x, y)) {
        const lx = x >= N - 7 ? x - (N - 7) : x;
        const ly = y >= N - 7 ? y - (N - 7) : y;
        const d = Math.max(Math.abs(lx - 3), Math.abs(ly - 3));
        on = d !== 2;
      } else if (x === 6 || y === 6) {
        on = (x + y) % 2 === 0;
      } else {
        on = rnd() > 0.5;
      }
      if (on) ctx.fillRect(ox + x * CELL, oy + y * CELL, CELL - 1, CELL - 1);
    }
  }
  ctx.fillStyle = '#4a5560';
  ctx.font = '600 28px "Segoe UI", sans-serif';
  ctx.fillText('shop@okaxis', 256, 556);
  ctx.fillStyle = '#9aa5b0';
  ctx.font = '500 22px "Segoe UI", sans-serif';
  ctx.fillText('UPI accepted here', 256, 596);
  texture.needsUpdate = true;
  return texture;
}

// ---------------------------------------------------------------------------
// packet streams — dots riding chained paths. Every stream's speed multiplier
// is a whole number, so one phase lap returns every dot to an identical pose.
// ---------------------------------------------------------------------------
function buildStream(pts, {
  color = REQ, count = 5, size = 0.05, speedMul = 2, wire = false,
  radius = 0.028, sag = 0,
} = {}) {
  const group = new THREE.Group();
  const segs = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const a = pts[i];
    const b = pts[i + 1];
    if (sag !== 0) {
      segs.push([a, [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2 + sag, (a[2] + b[2]) / 2], b]);
    } else {
      segs.push([a, b]);
    }
  }
  const chain = chainPath(segs);
  if (wire) {
    const wm = wireMat();
    chain.curves.forEach((curve) => {
      group.add(new THREE.Mesh(new THREE.TubeGeometry(curve, 40, radius, 10), wm));
    });
  }
  const geo = new THREE.SphereGeometry(size, 12, 10);
  const dots = [];
  for (let i = 0; i < count; i++) {
    const dm = materials.glow(color, 1.8);
    dm.transparent = true;
    dm.opacity = 0;
    dm.depthWrite = false; // a faded packet must never punch a hole in glass
    const mesh = new THREE.Mesh(geo, dm);
    mesh.userData.seed = i / count;
    group.add(mesh);
    dots.push(mesh);
  }
  function update(phase, amount = 1) {
    const on = amount > 0.004;
    dots.forEach((mesh) => {
      mesh.visible = on;
      if (!on) return;
      const t = (mesh.userData.seed + phase * speedMul) % 1;
      mesh.position.copy(chain.getPointAt(t));
      mesh.material.opacity = Math.min(1, t * 9) * Math.min(1, (1 - t) * 9) * amount;
    });
  }
  update(0, 0);
  return { group, update, chain };
}

// Expanding rings — the chime at the merchant's phone.
function buildChime(origin, { color = ACCENT, rings = 3, maxR = 0.62 } = {}) {
  const group = new THREE.Group();
  group.position.set(...origin);
  group.rotation.x = -Math.PI / 2;
  const meshes = [];
  for (let i = 0; i < rings; i++) {
    const m = new THREE.Mesh(
      new THREE.TorusGeometry(1, 0.016, 6, 40),
      new THREE.MeshBasicMaterial({
        color, transparent: true, opacity: 0, side: THREE.DoubleSide, depthWrite: false,
      }),
    );
    m.userData.seed = i / rings;
    group.add(m);
    meshes.push(m);
  }
  function update(phase, amount = 1) {
    meshes.forEach((m) => {
      const t = (m.userData.seed + phase * 2) % 1;
      const r = 0.05 + t * maxR;
      m.scale.set(r, r, r);
      m.material.opacity = Math.min(1, t * 6) * (1 - t) * amount;
    });
  }
  update(0, 0);
  return { group, update };
}

// ---------------------------------------------------------------------------
// the phone — a product-shot handset on a small stand, screen facing the viewer
// ---------------------------------------------------------------------------
function buildPhone(screen, { scale = 1 } = {}) {
  const g = new THREE.Group();
  const W = 0.34 * scale;
  const H = 0.70 * scale;
  const D = 0.048 * scale;

  const stand = beveledBox(W * 1.2, 0.05 * scale, 0.22 * scale, materials.paintedMetal(0x22252a), 0.015);
  stand.position.y = 0.025 * scale;
  stand.receiveShadow = true;
  g.add(stand);

  const tiltG = new THREE.Group();
  tiltG.position.set(0, 0.05 * scale, -0.02 * scale);
  tiltG.rotation.x = rad(-22); // reclined back, screen up toward the viewer
  g.add(tiltG);

  const body = beveledBox(W, H, D, materials.aluminum(0x2a2e34), 0.02 * scale);
  body.position.set(0, H / 2, 0);
  body.castShadow = true;
  tiltG.add(body);

  // the screen itself, then a PLAIN transparent cover glass over it — never
  // `transmission`, which would hide the transparent-capable display beneath
  const disp = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.87, H * 0.89),
    new THREE.MeshBasicMaterial({ map: screen.texture }),
  );
  disp.position.set(0, H / 2, D / 2 + 0.003 * scale);
  tiltG.add(disp);

  const cover = new THREE.Mesh(
    new THREE.PlaneGeometry(W * 0.94, H * 0.94),
    new THREE.MeshPhysicalMaterial({
      // roughness deliberately high for cover glass: at 0.08 the flat pane
      // caught the studio HDRI as one hard specular sheet and read as a blank
      // grey screen in tight video shots. A diffuse sheen keeps the display
      // readable from every angle the exporter solves.
      color: 0xbfd8ff, metalness: 0, roughness: 0.42,
      transparent: true, opacity: 0.06, depthWrite: false,
    }),
  );
  cover.position.set(0, H / 2, D / 2 + 0.008 * scale);
  tiltG.add(cover);

  // the point packets leave from, in the phone's local space
  const emit = new THREE.Object3D();
  emit.position.set(0, H * 0.5, 0.12 * scale);
  tiltG.add(emit);

  return { group: g, emit, H, W };
}

// ---------------------------------------------------------------------------
// a bank — a vault block with its own ledger face, and (on the payer's) the
// locked hardware module that is the only place the PIN can be opened
// ---------------------------------------------------------------------------
function buildBank({ angleDeg, yaw, ledgerTitle, startValue, hero, hasHsm = false }) {
  const g = new THREE.Group();
  const pos = ring(angleDeg);
  g.position.set(pos[0], 0, pos[2]);
  g.rotation.y = yaw;

  const W = hero ? 1.85 : 1.08;
  const H = hero ? 1.30 : 0.80;
  const D = hero ? 1.20 : 0.80;

  const base = beveledBox(W + 0.2, 0.16, D + 0.2, materials.paintedMetal(0x1c1f24), 0.035);
  base.position.y = 0.08;
  base.receiveShadow = true;
  g.add(base);

  const shell = materials.brushedSteel(hero ? STEEL : 0x8e959d);
  shell.roughness = 0.52; // roughnessMap MULTIPLIES — keep large faces off mirror
  const body = beveledBox(W, H, D, shell, 0.04);
  body.position.y = 0.16 + H / 2;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  // a chamfered cap so nothing ends in a flat cut face
  const cap = beveledBox(W * 0.86, 0.09, D * 0.86, materials.paintedMetal(0x2a2e34), 0.03);
  cap.position.y = 0.16 + H + 0.03;
  g.add(cap);

  let ledger = null;
  if (hero) {
    const bezel = beveledBox(W * 0.8, H * 0.5, 0.05, materials.paintedMetal(0x15181c), 0.02);
    bezel.position.set(0, 0.16 + H * 0.56, D / 2 + 0.012);
    g.add(bezel);
    ledger = buildLedgerFace(ledgerTitle, startValue);
    const face = new THREE.Mesh(
      new THREE.PlaneGeometry(W * 0.72, H * 0.42),
      new THREE.MeshBasicMaterial({ map: ledger.texture }),
    );
    face.position.set(0, 0.16 + H * 0.56, D / 2 + 0.042);
    g.add(face);

    // greeble: a bolted service hatch on the flank
    const bolts = boltCircle(8, W * 0.2, 0.022, materials.chrome(0xb8bec6), 0.02);
    bolts.rotation.set(0, 0, Math.PI / 2);
    bolts.position.set(-W / 2 - 0.006, 0.16 + H * 0.3, 0);
    g.add(bolts);
    const hatch = discMesh(W * 0.17, 0.03, materials.brushedSteel(0xa8afb8), 28);
    hatch.rotation.z = Math.PI / 2;
    hatch.position.set(-W / 2 - 0.014, 0.16 + H * 0.3, 0);
    g.add(hatch);
  }

  // the port facing the switch — every bank has exactly one
  const toHub = new THREE.Vector3(-pos[0], 0, -pos[2]).normalize();
  const localDir = toHub.clone().applyAxisAngle(new THREE.Vector3(0, 1, 0), -yaw);
  const portY = 0.16 + H * 0.26;
  const collar = discMesh(0.13, 0.09, materials.chrome(0xc4cad2), 24);
  collar.position.set(localDir.x * (W / 2 + 0.04), portY, localDir.z * (D / 2 + 0.04));
  collar.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), localDir);
  g.add(collar);

  const lamp = new THREE.Mesh(
    new THREE.SphereGeometry(0.05, 12, 10),
    materials.glow(hero ? ACCENT : 0x4a707f, 1.4),
  );
  lamp.position.copy(collar.position);
  g.add(lamp);

  // world-space point the spoke connects to
  const portPt = [
    pos[0] + toHub.x * (W / 2 + 0.18),
    portY,
    pos[2] + toHub.z * (D / 2 + 0.18),
  ];

  // the payer's hardware security module: the ONLY place the PIN opens.
  // Mounted on TOP so it is unoccluded from every camera that names it.
  let hsmGlow = null;
  let hsmPt = null;
  if (hasHsm) {
    const hg = new THREE.Group();
    hg.position.set(W * 0.2, 0.16 + H + 0.075, 0);
    g.add(hg);
    const hsmBody = beveledBox(0.42, 0.32, 0.36, materials.polymer(0x101318), 0.03);
    hsmBody.position.y = 0.16;
    hsmBody.castShadow = true;
    hg.add(hsmBody);
    const band = beveledBox(0.44, 0.06, 0.38, materials.chrome(0xc8ced6), 0.015);
    band.position.y = 0.16;
    hg.add(band);
    const slot = new THREE.Mesh(
      new THREE.BoxGeometry(0.18, 0.04, 0.025),
      materials.glow(ACCENT, 0.4),
    );
    slot.position.set(0, 0.24, 0.19);
    hg.add(slot);
    hsmGlow = slot;
    const v = new THREE.Vector3();
    hg.getWorldPosition(v);
    hsmPt = [pos[0] + Math.cos(yaw) * W * 0.2, 0.16 + H + 0.24, pos[2] - Math.sin(yaw) * W * 0.2];
  }

  return { group: g, portPt, ledger, hsmGlow, hsmPt, topY: 0.16 + H + 0.09, pos };
}

// ---------------------------------------------------------------------------
// the NPCI switch — the one machine in the middle
// ---------------------------------------------------------------------------
function buildHub(portAngles) {
  const g = new THREE.Group();

  const pedestal = discMesh(1.9, 0.26, materials.paintedMetal(0x1b1e23), 56);
  pedestal.position.y = 0.13;
  pedestal.receiveShadow = true;
  g.add(pedestal);
  const fillet = discMesh(1.72, 0.1, materials.paintedMetal(0x26292f), 56);
  fillet.position.y = 0.31;
  g.add(fillet);

  const drumMat = materials.brushedSteel(0xb4bbc3);
  drumMat.roughness = 0.5;
  const drum = new THREE.Mesh(new THREE.CylinderGeometry(1.2, 1.28, 0.86, 48), drumMat);
  drum.position.y = 0.79;
  drum.castShadow = true;
  drum.receiveShadow = true;
  g.add(drum);

  // chamfered collar instead of a flat cut top
  const collar = new THREE.Mesh(
    new THREE.CylinderGeometry(1.06, 1.2, 0.14, 48),
    materials.paintedMetal(0x2b2f35),
  );
  collar.position.y = 1.29;
  g.add(collar);

  // the exposed routing rotor — spins whole turns per lap
  const rotor = new THREE.Group();
  rotor.position.y = 1.38;
  g.add(rotor);
  rotor.add(discMesh(0.8, 0.07, materials.aluminum(0x9aa2ab), 40));
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * TAU;
    const vane = beveledBox(0.52, 0.05, 0.09, materials.chrome(0xc2c8d0), 0.015);
    vane.position.set(Math.cos(a) * 0.52, 0.055, Math.sin(a) * 0.52);
    vane.rotation.y = -a;
    rotor.add(vane);
    const tip = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), materials.glow(REQ, 1.1));
    tip.position.set(Math.cos(a) * 0.78, 0.06, Math.sin(a) * 0.78);
    rotor.add(tip);
  }

  // accent index ring around the rotor + a finial so the stack ends rounded
  const indexRing = new THREE.Mesh(
    new THREE.TorusGeometry(0.93, 0.03, 10, 64),
    materials.glow(ACCENT, 1.5),
  );
  indexRing.rotation.x = Math.PI / 2;
  indexRing.position.y = 1.42;
  g.add(indexRing);

  const finial = new THREE.Mesh(new THREE.SphereGeometry(0.18, 20, 16), materials.chrome(0xd2d8df));
  finial.position.y = 1.52;
  g.add(finial);

  // one port per connected participant — and nothing else
  portAngles.forEach((deg) => {
    const a = rad(deg);
    const dir = new THREE.Vector3(Math.cos(a), 0, Math.sin(a));
    const nub = discMesh(0.115, 0.18, materials.chrome(0xc4cad2), 22);
    nub.position.set(dir.x * 1.26, 0.62, dir.z * 1.26);
    nub.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir);
    g.add(nub);
  });

  const skirt = boltCircle(16, 1.5, 0.035, materials.chrome(0x9aa1aa), 0.03);
  skirt.position.y = 0.27;
  g.add(skirt);

  const portPt = (deg) => {
    const a = rad(deg);
    return [Math.cos(a) * (HUB_R + 0.22), 0.62, Math.sin(a) * (HUB_R + 0.22)];
  };

  return { group: g, rotor, indexRing, portPt, topY: 1.7 };
}

// ---------------------------------------------------------------------------
// the netting beam — the debts the switch records, and their collapse into
// one net figure per bank
// ---------------------------------------------------------------------------
function buildNetting(hubTopY) {
  const g = new THREE.Group();
  g.position.y = hubTopY + 0.5;

  const post = rod(0.05, 0.5, materials.chrome(0xb8bec6), 14);
  post.position.y = -0.5;
  g.add(post);

  const beam = new THREE.Group();
  g.add(beam);
  beam.add(beveledBox(2.3, 0.07, 0.12, materials.brushedSteel(0xb0b7bf), 0.025));
  beam.add(new THREE.Mesh(new THREE.SphereGeometry(0.085, 16, 12), materials.chrome(0xd0d6dd)));

  // two opposing stacks of tally plates — the debts in each direction
  const stacks = [[-1, IOU], [1, REQ]].map(([side, color]) => {
    const s = new THREE.Group();
    s.position.set(side * 0.92, 0, 0);
    beam.add(s);
    s.add(beveledBox(0.42, 0.035, 0.3, materials.paintedMetal(0x24282e), 0.012));
    const plates = [];
    for (let i = 0; i < 9; i++) {
      const mat = materials.glow(color, 0.85);
      mat.transparent = true;
      mat.opacity = 0.9;
      mat.depthWrite = false;
      const p = beveledBox(0.34, 0.035, 0.24, mat, 0.008);
      p.position.y = 0.05 + i * 0.05;
      p.visible = false;
      s.add(p);
      plates.push(p);
    }
    return { plates };
  });

  // what is actually left after netting: one short bar per bank
  const netMat = materials.glow(ACCENT, 1.6);
  netMat.transparent = true;
  netMat.opacity = 0;
  netMat.depthWrite = false;
  const netBar = beveledBox(0.4, 0.09, 0.28, netMat, 0.02);
  netBar.position.y = 0.09;
  netBar.visible = false;
  beam.add(netBar);

  function update(tally, net) {
    const shown = Math.round(clamp01(tally) * 9);
    const fade = 1 - smooth(clamp01((net - 0.2) / 0.35));
    stacks.forEach(({ plates }) => {
      plates.forEach((p, i) => {
        p.visible = i < shown && fade > 0.02;
        p.material.opacity = 0.9 * fade;
      });
    });
    // the beam tips as the two directions cancel, then settles level again
    beam.rotation.z = Math.sin(clamp01(net) * Math.PI) * 0.16;
    netMat.opacity = smooth(clamp01((net - 0.4) / 0.4));
    netBar.visible = netMat.opacity > 0.01;
    netBar.scale.y = 0.6 + clamp01(net) * 0.8;
  }
  update(0, 0);
  return { group: g, update, beam };
}

// ---------------------------------------------------------------------------
// the settlement vault — where the netted figure actually moves, 10x a day
// ---------------------------------------------------------------------------
function buildVault() {
  const VS = 1.3; // the vault is framed from further off than anything else
  const g = new THREE.Group();
  g.position.set(0, 0, VAULT_Z);
  g.scale.setScalar(VS);

  const plinth = beveledBox(2.9, 0.22, 2.1, materials.paintedMetal(0x1b1e23), 0.05);
  plinth.position.y = 0.11;
  plinth.receiveShadow = true;
  g.add(plinth);

  const shell = materials.brushedSteel(0x9aa2ab);
  shell.roughness = 0.55;
  const body = beveledBox(2.3, 1.62, 1.36, shell, 0.06);
  body.position.y = 1.03;
  body.castShadow = true;
  body.receiveShadow = true;
  g.add(body);

  const crown = beveledBox(2.0, 0.12, 1.14, materials.paintedMetal(0x2a2e34), 0.04);
  crown.position.y = 1.9;
  g.add(crown);

  // the doorway is a real opening with a dark liner behind it, not a flat disc
  const mouth = new THREE.Mesh(
    new THREE.CylinderGeometry(0.52, 0.52, 0.52, 36, 1, true),
    darkLiner(),
  );
  mouth.rotation.x = Math.PI / 2;
  mouth.position.set(0, 1.0, 0.44);
  g.add(mouth);
  const backWall = discMesh(0.53, 0.04, new THREE.MeshStandardMaterial({
    color: 0x0d0f12, metalness: 0.2, roughness: 0.9,
  }), 36);
  backWall.rotation.x = Math.PI / 2;
  backWall.position.set(0, 1.0, 0.2);
  g.add(backWall);

  // one gold bar waiting inside
  const ingot = beveledBox(0.46, 0.15, 0.22, materials.aluminum(0xd9a441), 0.03);
  ingot.position.set(0, 0.84, 0.36);
  g.add(ingot);

  // hinged round door on the left edge of the mouth
  const hinge = new THREE.Group();
  hinge.position.set(-0.54, 1.0, 0.7);
  g.add(hinge);
  const door = discMesh(0.56, 0.11, materials.brushedSteel(0xbac1c9), 40);
  door.rotation.x = Math.PI / 2;
  door.position.set(0.54, 0, 0.02);
  door.castShadow = true;
  hinge.add(door);
  const wheel = new THREE.Mesh(
    new THREE.TorusGeometry(0.19, 0.03, 10, 28),
    materials.chrome(0xc8ced6),
  );
  wheel.position.set(0.54, 0, 0.09);
  hinge.add(wheel);
  for (let i = 0; i < 4; i++) {
    const spoke = beveledBox(0.34, 0.028, 0.028, materials.chrome(0xc8ced6), 0.008);
    spoke.position.set(0.54, 0, 0.09);
    spoke.rotation.z = (i / 4) * Math.PI;
    hinge.add(spoke);
  }
  const doorBolts = boltCircle(10, 0.44, 0.032, materials.chrome(0xaeb5bd), 0.03);
  doorBolts.rotation.x = Math.PI / 2;
  doorBolts.position.set(0.54, 0, 0.06);
  hinge.add(doorBolts);

  // ten cycle lamps across the crown — one per settlement cycle in a day
  const lamps = [];
  for (let i = 0; i < 10; i++) {
    const m = materials.glow(ACCENT, 0.2);
    m.transparent = true;
    m.opacity = 0.25;
    const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.045, 10, 8), m);
    lamp.position.set(-0.855 + i * 0.19, 2.0, 0.45);
    g.add(lamp);
    lamps.push(lamp);
  }

  function update(open, cycle) {
    const o = clamp01(open);
    hinge.rotation.y = smooth(o) * rad(115);
    const lit = Math.round(clamp01(cycle) * 10);
    lamps.forEach((l, i) => {
      l.material.opacity = i < lit ? 1 : 0.22;
      l.material.emissiveIntensity = i < lit ? 1.8 : 0.2;
    });
    ingot.position.z = 0.36 + smooth(clamp01((o - 0.45) / 0.55)) * 0.5;
  }
  update(0, 0);
  return { group: g, update, mouthPt: [0, 1.0 * VS, VAULT_Z + 0.7 * VS] };
}

// ---------------------------------------------------------------------------
// the shop counter — the only part of this the payer ever sees
// ---------------------------------------------------------------------------
function buildCounter(phoneScreen, merchantScreen) {
  const g = new THREE.Group();
  g.position.set(COUNTER.x, 0, COUNTER.z);

  const pedestalBox = beveledBox(3.0, COUNTER.top - 0.18, 1.05, materials.polymer(0x1d2126), 0.04);
  pedestalBox.position.y = (COUNTER.top - 0.18) / 2;
  pedestalBox.castShadow = true;
  pedestalBox.receiveShadow = true;
  g.add(pedestalBox);

  const top = beveledBox(3.4, 0.18, 1.25, materials.wood(0xb98b5e), 0.035);
  top.position.y = COUNTER.top - 0.09;
  top.castShadow = true;
  top.receiveShadow = true;
  g.add(top);

  const kick = beveledBox(3.06, 0.05, 1.09, materials.chrome(0x9aa1aa), 0.015);
  kick.position.y = COUNTER.top - 0.22;
  g.add(kick);

  // a recessed front panel and a toe rail — without them the pedestal reads as
  // an undetailed monolith under the counter top
  const inset = beveledBox(2.5, COUNTER.top - 0.75, 0.04, materials.polymer(0x15181c), 0.02);
  inset.position.set(0, (COUNTER.top - 0.75) / 2 + 0.18, 0.53);
  g.add(inset);
  const reveal = beveledBox(2.58, 0.03, 0.05, materials.chrome(0x8d949c), 0.01);
  reveal.position.set(0, COUNTER.top - 0.62, 0.545);
  g.add(reveal);
  const toe = beveledBox(2.9, 0.09, 0.06, materials.chrome(0x9aa1aa), 0.02);
  toe.position.set(0, 0.11, 0.51);
  g.add(toe);

  // your phone, left of centre on the counter
  const phone = buildPhone(phoneScreen, { scale: 1 });
  phone.group.position.set(-1.25, COUNTER.top, 0.18);
  phone.group.rotation.y = rad(12);
  g.add(phone.group);

  // the QR standee, the thing you actually scan
  const standee = new THREE.Group();
  standee.position.set(0.04, COUNTER.top, -0.04);
  g.add(standee);
  const foot = beveledBox(0.44, 0.045, 0.26, materials.chrome(0xb0b7bf), 0.015);
  foot.position.y = 0.022;
  standee.add(foot);
  const spine = rod(0.022, 0.22, materials.chrome(0xb0b7bf), 12);
  spine.position.set(0, 0.04, -0.07);
  standee.add(spine);
  const plateG = new THREE.Group();
  plateG.position.set(0, 0.2, -0.04);
  plateG.rotation.x = rad(-13);
  standee.add(plateG);
  const plate = beveledBox(0.6, 0.75, 0.025, materials.polymer(0xe6e9ec), 0.012);
  plate.position.y = 0.38;
  plate.castShadow = true;
  plateG.add(plate);
  const qrFace = new THREE.Mesh(
    new THREE.PlaneGeometry(0.55, 0.69),
    new THREE.MeshBasicMaterial({ map: buildQrTexture() }),
  );
  qrFace.position.set(0, 0.38, 0.015);
  plateG.add(qrFace);

  // the merchant's phone, right of the standee
  const merchant = buildPhone(merchantScreen, { scale: 0.86 });
  merchant.group.position.set(0.45, COUNTER.top, 0.14);
  merchant.group.rotation.y = rad(-16);
  g.add(merchant.group);

  return { group: g, phone, merchant, plateG };
}

// ---------------------------------------------------------------------------
// assembly
// ---------------------------------------------------------------------------
export function buildUpi({ scene }) {
  const root = new THREE.Group();
  scene.add(root);

  const phoneScreen = buildPhoneScreen();
  const merchantScreen = buildMerchantScreen();

  // --- the counter (always present — it is the sealed product) --------------
  const counter = buildCounter(phoneScreen, merchantScreen);
  root.add(counter.group);

  // --- the network layer (hidden until the reveal) --------------------------
  // Metal cannot be ghosted, so this layer is hidden outright and snapped on in
  // onEnter; the camera flight between steps covers the pop.
  const netLayer = new THREE.Group();
  root.add(netLayer);

  const portAngles = [PAYER_A, PAYEE_A, ...OTHER_A, PSP_A_A, PSP_B_A];
  const hub = buildHub(portAngles);
  netLayer.add(hub.group);

  const payerBank = buildBank({
    angleDeg: PAYER_A, yaw: rad(24), hero: true, hasHsm: true,
    ledgerTitle: 'YOUR BANK', startValue: PAYER_START,
  });
  const payeeBank = buildBank({
    angleDeg: PAYEE_A, yaw: rad(-10), hero: true,
    ledgerTitle: "SHOP'S BANK", startValue: PAYEE_START,
  });
  netLayer.add(payerBank.group, payeeBank.group);

  const otherBanks = OTHER_A.map((a) => {
    const p = ring(a);
    const b = buildBank({
      angleDeg: a, yaw: Math.atan2(-p[0], -p[2]), hero: false,
      ledgerTitle: '', startValue: 0,
    });
    netLayer.add(b.group);
    return b;
  });

  const netting = buildNetting(hub.topY);
  netLayer.add(netting.group);

  const vault = buildVault();
  netLayer.add(vault.group);

  // the chute the netted figure travels down to settlement
  netLayer.add(
    tubeAlong(
      [[0, hub.topY + 0.4, -0.2], [0, hub.topY - 0.2, -2.8], [0, 1.9, -5.0], vault.mouthPt],
      0.035,
      wireMat(),
    ),
  );

  // PSP pucks: a TPAP is not a bank — it rides a sponsor bank's line
  function buildPsp(angleDeg, accent) {
    const g = new THREE.Group();
    const p = ring(angleDeg, 2.9);
    g.position.set(p[0], 0, p[2]);
    const base = discMesh(0.38, 0.1, materials.paintedMetal(0x1e2126), 30);
    base.position.y = 0.05;
    base.receiveShadow = true;
    g.add(base);
    const puck = discMesh(0.3, 0.22, materials.brushedSteel(0xa6adb6), 30);
    puck.position.y = 0.21;
    puck.castShadow = true;
    g.add(puck);
    const dome = new THREE.Mesh(
      new THREE.SphereGeometry(0.3, 22, 16, 0, TAU, 0, Math.PI / 2),
      materials.chrome(0xc6ccd4),
    );
    dome.position.y = 0.32;
    g.add(dome);
    const glowRing = new THREE.Mesh(
      new THREE.TorusGeometry(0.31, 0.022, 8, 36),
      materials.glow(accent, 1.3),
    );
    glowRing.rotation.x = Math.PI / 2;
    glowRing.position.y = 0.33;
    g.add(glowRing);
    netLayer.add(g);
    return { group: g, pt: [p[0], 0.42, p[2]] };
  }
  const pspA = buildPsp(PSP_A_A, REQ);
  const pspB = buildPsp(PSP_B_A, ACCENT);

  // --- world anchor points --------------------------------------------------
  root.updateMatrixWorld(true);
  const worldOf = (obj) => {
    const v = new THREE.Vector3();
    obj.getWorldPosition(v);
    return [v.x, v.y, v.z];
  };
  const phonePt = worldOf(counter.phone.emit);
  const merchantPt = worldOf(counter.merchant.emit);
  const payerPort = payerBank.portPt;
  const payeePort = payeeBank.portPt;
  const hubPayer = hub.portPt(PAYER_A);
  const hubPayee = hub.portPt(PAYEE_A);
  const hubPspA = hub.portPt(PSP_A_A);
  const hubPspB = hub.portPt(PSP_B_A);

  // --- the spokes -----------------------------------------------------------
  // Every link in this scene runs to the switch. There is no bank-to-bank link
  // anywhere in the geometry, and that absence is the whole point of step 6.
  const spokes = new THREE.Group();
  netLayer.add(spokes);
  [
    [payerPort, hubPayer],
    [payeePort, hubPayee],
    [pspA.pt, hubPspA],
    [pspB.pt, hubPspB],
    [phonePt, pspA.pt],
    [merchantPt, pspB.pt],
    ...otherBanks.map((b, i) => [b.portPt, hub.portPt(OTHER_A[i])]),
  ].forEach(([a, b]) => {
    const mid = [(a[0] + b[0]) / 2, Math.min(a[1], b[1]) - 0.16, (a[2] + b[2]) / 2];
    spokes.add(tubeAlong([a, mid, b], 0.032, wireMat(), { tubularSegments: 50 }));
  });

  // the phantom bank-to-bank span: drawn only so it can be shown EMPTY
  const gapMat = new THREE.MeshBasicMaterial({
    color: 0x7d8c98, transparent: true, opacity: 0, depthWrite: false,
  });
  const gapGroup = new THREE.Group();
  netLayer.add(gapGroup);
  {
    const curve = new THREE.CatmullRomCurve3([
      new THREE.Vector3(...payerPort),
      new THREE.Vector3(0, 2.6, 3.4),
      new THREE.Vector3(...payeePort),
    ]);
    const beadGeo = new THREE.SphereGeometry(0.038, 8, 6);
    for (let i = 0; i <= 44; i++) {
      const bead = new THREE.Mesh(beadGeo, gapMat);
      bead.position.copy(curve.getPointAt(i / 44));
      gapGroup.add(bead);
    }
  }

  // --- the streams ----------------------------------------------------------
  // address resolution: out to the shop's PSP bank and back with a NAME
  const lookup = buildStream(
    [phonePt, pspA.pt, hubPspA, hubPspB, pspB.pt, payeePort,
      pspB.pt, hubPspB, hubPspA, pspA.pt, phonePt],
    { color: LOOKUP, count: 4, size: 0.055, speedMul: 1 },
  );
  netLayer.add(lookup.group);

  // the signed pay request leaving the phone for the switch
  const pay = buildStream([phonePt, pspA.pt, hubPspA, [0, 1.0, 0.5]], {
    color: REQ, count: 5, size: 0.055, speedMul: 2,
  });
  netLayer.add(pay.group);

  // ReqPay_Debit out to the payer's bank, and its confirmation back
  const debit = buildStream([hubPayer, payerPort, hubPayer], {
    color: REQ, count: 4, size: 0.06, speedMul: 1,
  });
  netLayer.add(debit.group);

  // ReqPay_Credit — sent only after the debit confirms
  const credit = buildStream([hubPayee, payeePort], {
    color: ACCENT, count: 4, size: 0.06, speedMul: 2,
  });
  netLayer.add(credit.group);

  // RespPay to the merchant's app — the chime behind the counter
  const notify = buildStream([payeePort, hubPayee, hubPspB, pspB.pt, merchantPt], {
    color: ACCENT, count: 5, size: 0.05, speedMul: 2,
  });
  netLayer.add(notify.group);

  // everyone else's traffic, on the spokes we are not following
  const busy = otherBanks.map((b, i) => {
    const s = buildStream([b.portPt, hub.portPt(OTHER_A[i]), b.portPt], {
      color: i % 2 ? REQ : ACCENT, count: 4, size: 0.04, speedMul: i + 2,
    });
    netLayer.add(s.group);
    return s;
  });

  const chime = buildChime([merchantPt[0], merchantPt[1] + 0.14, merchantPt[2]]);
  root.add(chime.group);

  // --- the sealed PIN capsule ----------------------------------------------
  // Formed at the phone's keypad, carried through the app and the switch still
  // sealed, opened only inside the bank's hardware module.
  const capsuleG = new THREE.Group();
  netLayer.add(capsuleG);
  // An upright vial, not a dome: the PSP pucks nearby are hemispheres with the
  // same accent ring, and a squashed capsule was indistinguishable from them.
  const capHalves = [1, -1].map((side) => {
    const h = new THREE.Group();
    const shellMesh = new THREE.Mesh(
      new THREE.CapsuleGeometry(0.17, 0.2, 10, 22),
      materials.chrome(0xdfe4ea),
    );
    shellMesh.scale.y = 0.55;
    shellMesh.position.y = side * 0.15;
    h.add(shellMesh);
    capsuleG.add(h);
    return { group: h, side };
  });
  const sealBand = new THREE.Mesh(
    new THREE.TorusGeometry(0.185, 0.042, 10, 32),
    materials.glow(ACCENT, 2.6),
  );
  sealBand.rotation.x = Math.PI / 2;
  capsuleG.add(sealBand);
  const capPath = chainPath([
    [phonePt, pspA.pt],
    [pspA.pt, hubPspA],
    [hubPspA, hubPayer],
    [hubPayer, payerPort],
    [payerPort, payerBank.hsmPt],
  ]);

  // ==========================================================================
  // CALLOUTS
  // ==========================================================================
  const labels = calloutSets(['counter', 'network', 'address', 'pin', 'ledger', 'iou', 'settle']);

  labels.add('counter', counter.phone.group, 'Your phone', [0, 0.9, 0.1], 125, 120);
  labels.add('counter', counter.plateG, "An address, not a card reader", [0, 0.86, 0.03], 108, 165);
  labels.add('counter', counter.merchant.group, "The merchant's phone", [0, 0.86, 0.1], 90, 130);

  labels.add('network', hub.group, 'The NPCI switch', [0, 2.3, 0], 74, 108);
  labels.add('network', payerBank.group, 'Your bank', [0, 2.15, 0], 52, 104);
  labels.add('network', payeeBank.group, "The shop's bank", [0, 2.15, 0], 150, 112);
  labels.add('network', pspA.group, "Your app borrows a bank's line", [0, 0.9, 0], 56, 156);
  labels.add('network', spokes, 'One line each', [1.2, 1.9, -2.4], 35, 110);

  labels.add('address', counter.phone.group, 'shop@okaxis', [0, 0.92, 0.1], 64, 92);
  labels.add('address', hub.group, 'The @ picks the bank', [0.4, 2.1, 0.7], 42, 158);
  labels.add('address', payeeBank.group, 'A name, not a number', [0, 2.0, 0], 150, 116);

  labels.add('pin', counter.phone.group, 'Sealed on your own phone', [0, 0.92, 0.1], 120, 144);
  labels.add('pin', hub.group, 'Still sealed here', [0.55, 1.62, 0.85], 68, 120);
  labels.add('pin', payerBank.group, 'Opened only in here', [0.3, 2.3, 0], 24, 170);

  labels.add('ledger', payerBank.group, 'ReqPay_Debit — subtract first', [0, 2.1, 0], 50, 142);
  labels.add('ledger', payeeBank.group, 'ReqPay_Credit — second', [0, 2.1, 0], 150, 120);

  labels.add('iou', gapGroup, 'No wire between them', [0.2, 3.0, 3.4], 62, 150);
  labels.add('iou', netting.group, 'Only a debt, written down', [0.95, 0.5, 0], 146, 118);

  labels.add('settle', netting.group, 'Both directions cancel', [-0.95, 0.6, 0], 108, 200);
  labels.add('settle', vault.group, 'RBI settlement, 10× a day', [0, 2.2, 0.4], 52, 140);
  labels.add('settle', vault.group, 'Only the NET moves', [0.2, 1.2, 1.1], 18, 166);

  // ==========================================================================
  // pose / state — one object, one apply()
  // ==========================================================================
  const state = {
    phase: 0,
    reveal: 0,
    lookup: 0, pay: 0, debit: 0, credit: 0, notify: 0, busy: 0,
    pinAmt: 0, hsm: 0,
    ledgerPayer: 0, ledgerPayee: 0, beam: 0, tally: 0, net: 0, vaultOpen: 0, cycle: 0,
    gap: 0, screen: 0, chime: 0, spin: 1,
  };

  const ROTOR_TURNS = 2; // whole turns per lap — seamless by construction

  function apply() {
    const ph = state.phase;

    netLayer.visible = state.reveal > 0.5;

    hub.rotor.rotation.y = ph * ROTOR_TURNS * TAU * state.spin;
    hub.indexRing.rotation.z = -ph * TAU * state.spin;

    lookup.update(ph, state.lookup);
    pay.update(ph, state.pay);
    debit.update(ph, state.debit);
    credit.update(ph, state.credit);
    notify.update(ph, state.notify);
    busy.forEach((s) => s.update(ph, state.busy));
    chime.update(ph, state.chime);

    gapMat.opacity = state.gap * 0.55;
    gapGroup.visible = state.gap > 0.02;

    // the two ledgers — each bank edits its OWN book, and the debit leads the
    // credit, so the two scalars are deliberately separate
    payerBank.ledger.draw(PAYER_START - AMOUNT * clamp01(state.ledgerPayer));
    payeeBank.ledger.draw(PAYEE_START + AMOUNT * clamp01(state.ledgerPayee));

    netting.update(state.tally, state.net);
    netting.group.visible = state.beam > 0.5;
    vault.update(state.vaultOpen, state.cycle);

    // the sealed capsule
    // `pinAmt` doubles as the capsule's scale, so a step can fade it in and out
    // inside the lap and the wrap pose stays identical
    const amt = clamp01(state.pinAmt);
    capsuleG.visible = amt > 0.02;
    if (capsuleG.visible) {
      capsuleG.scale.setScalar(amt);
      capsuleG.position.copy(capPath.getPointAt(Math.min(0.9995, clamp01(ph))));
      const crack = clamp01(state.hsm);
      capHalves.forEach(({ group: h, side }) => {
        h.position.y = side * crack * 0.30;
        h.rotation.z = side * crack * 0.5;
      });
      sealBand.scale.setScalar(1 - crack * 0.6);
      sealBand.material.emissiveIntensity = 1.8 + crack * 2.6;
    }
    if (payerBank.hsmGlow) {
      payerBank.hsmGlow.material.emissiveIntensity = 0.4 + clamp01(state.hsm) * 3.2;
    }

    phoneScreen.draw(state.screen);
    merchantScreen.draw(state.chime > 0.25 ? 1 : 0);
  }
  apply();

  return {
    group: root,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
    // probed by verify.mjs and by reviewers
    parts: {
      rotor: hub.rotor,
      beam: netting.beam,
      capsule: capsuleG,
      netLayer,
      payerBank: payerBank.group,
      payeeBank: payeeBank.group,
    },
    anchors: {
      hub: [0, hub.topY, 0],
      payer: payerBank.pos,
      payee: payeeBank.pos,
      counter: [COUNTER.x, COUNTER.top, COUNTER.z],
      vault: [0, 1.1, VAULT_Z],
      phone: phonePt,
      merchant: merchantPt,
    },
    helpers: { pulseWin, tri },
  };
}
