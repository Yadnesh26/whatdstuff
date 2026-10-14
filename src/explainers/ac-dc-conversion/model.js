import * as THREE from 'three';
import { materials, studioPlinth } from '../../framework/parts.js';
import { beveledBox, tubeAlong, coil } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { smooth, TAU } from '../../framework/motion.js';

// AC ↔ DC, staged as an online (double-conversion) UPS on a plinth with a desk
// lamp plugged into it, plus a second "view" that swaps the UPS for a
// magnified, cut-open length of mains wire so the two kinds of current can be
// seen as electron motion.
//
// Reference facts (see story.js for the angle):
//  - Mains: 230 V RMS, 50 Hz → 325 V peak. AC = the electrons' drift velocity
//    follows the sine and averages to zero. 10 A in 12 AWG copper: drift
//    ≈ 0.22 mm/s (n = 8.5e28 m⁻³), so at 50 Hz each electron swings only
//    ≈ 1 µm each way. DC = the same tiny drift, always one way.
//  - Rectifier: 4-diode bridge. L→D1→+ and −→D4→N on the positive half;
//    N→D2→+ and −→D3→L on the negative half. Output: every hump positive,
//    100 humps a second.
//  - Reservoir capacitors charge in short gulps near each peak and feed the
//    load between them → flat DC with a small ripple. (A real UPS also does
//    power-factor correction after the bridge — disclosed simplification.)
//  - Battery sits on the DC bus through a two-way charger/booster (a 12 V
//    block cannot sit directly on a ~320 V bus).
//  - Inverter: H-bridge Q1..Q4. Diagonal pairs (Q1+Q4, Q3+Q2) reverse the DC
//    through the load → square wave. Sine PWM: leg B flips at 50 Hz, leg A
//    pulses with width ∝ |sin| (real units ~20 kHz; shown as 16 pulses per
//    cycle). The LC filter (coil + film capacitor) averages pulses → sine.
//
// Scalars: t = mains phase in CYCLES (every lap advances whole cycles, so
// every waveform, dot and switch state wraps identically); drift = DC wire
// electron advance in pattern cells (whole cells per lap); fan = fan angle
// (whole turns per lap); mains 0/1 (power cut).

const ACCENT = new THREE.Color(0xffb347);
const PL_H = 0.26;
const CX = -0.3; // UPS centre x (lamp sits to the right)
const CW = 3.0;
const CD = 1.9;
const CB = 0.29; // case bottom (on rubber feet)
const CH = 0.64;
const CT = CB + CH;
const BY = CB + 0.025 + 0.045 + 0.025; // board top surface (world y)
const BW = 2.7;
const BZ0 = -0.6;
const BZ1 = 0.6;
const RAIL_Z = 0.28;
const BRX = -0.8; // bridge diamond centre
const BRR = 0.28;
const V_L = [BRX - BRR, 0];
const V_N = [BRX + BRR, 0];
const V_P = [BRX, -RAIL_Z];
const V_M = [BRX, RAIL_Z];
const CAP_X = [-0.2, 0.06];
const TAP_X = -0.07;
const LEG_A = 0.5;
const LEG_B = 1.2;
const IND_X = 0.72;
const OUT1_X = 0.9;
const FC_X = 1.04;
const BPAD_X = 1.32;
const SOCK_Z = 0.36; // output socket on the right wall
const FAN_Z = -0.45;
const PWM_N = 16; // pulses per mains cycle (shown) — real units run ~400
const DROOP = 0.12; // bus sag between peaks, fraction of peak
const DOT_Y = 0.028;
const DOT_SP = 0.075;
const DOTS_PER_UNIT = 3; // dot spacings advanced per unit of normalised charge

// wire view
const WIRE_Y = 0.84;
const CUT_L = 3.2;
const STUB_L = 0.4;
const R_CU = 0.34;
const R_INS = 0.44;
const CELL = CUT_L / 2; // electron pattern period (DC drift = whole cells/lap)
const SWING = 0.14; // shown AC swing (hugely magnified)

// ---------------------------------------------------------------------------
// waveform + charge math (t in mains cycles)
// ---------------------------------------------------------------------------
const frac = (x) => x - Math.floor(x);
const gulp = (h) => smooth((h - 0.34) / 0.16);
const gulpRate = (h) => {
  const x = (h - 0.34) / 0.16;
  return x <= 0 || x >= 1 ? 0 : 4 * x * (1 - x);
};
// cumulative normalised charge: each advances by exactly 1 per mains cycle
const Qf = {
  pos: (t) => {
    const n = Math.floor(t);
    const f = t - n;
    return n + (f < 0.5 ? (1 - Math.cos(TAU * f)) / 2 : 1);
  },
  neg: (t) => {
    const n = Math.floor(t);
    const f = t - n;
    return n + (f < 0.5 ? 0 : (1 + Math.cos(TAU * f)) / 2);
  },
  gpos: (t) => {
    const n = Math.floor(t);
    const f = t - n;
    return n + (f < 0.5 ? gulp(2 * f) : 1);
  },
  gneg: (t) => {
    const n = Math.floor(t);
    const f = t - n;
    return n + (f < 0.5 ? 0 : gulp(2 * f - 1));
  },
  spos: (t) => {
    const n = Math.floor(t);
    return n + Math.min(t - n, 0.5) * 2;
  },
  sneg: (t) => {
    const n = Math.floor(t);
    return n + Math.max(t - n - 0.5, 0) * 2;
  },
};

function busV(t, caps) {
  const r = Math.abs(Math.sin(TAU * t));
  if (!caps) return r;
  const lp = Math.floor((t - 0.25) / 0.5) * 0.5 + 0.25;
  return Math.max(1 - (DROOP * (t - lp)) / 0.5, r);
}
function pwmOn(t) {
  const duty = Math.abs(Math.sin(TAU * t));
  return Math.abs(frac(t * PWM_N) - 0.5) < duty / 2;
}
function pwmV(t) {
  return pwmOn(t) ? Math.sign(Math.sin(TAU * t)) : 0;
}
const squareV = (t) => (frac(t) < 0.5 ? 1 : -1);

function rng(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = Math.imul(a ^ (a >>> 15), 1 | a);
    x = (x + Math.imul(x ^ (x >>> 7), 61 | x)) ^ x;
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------------------------------------------------------------------------
// small builders
// ---------------------------------------------------------------------------
const std = (color, o = {}) =>
  new THREE.MeshStandardMaterial({ color, roughness: 0.5, metalness: 0.1, ...o });

function canvasTex(w, h) {
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.anisotropy = 8;
  return { canvas, ctx: canvas.getContext('2d'), tex };
}

// Hide/show a group AND keep its meshes out of the callout occlusion test while
// hidden (the label pass walks every mesh and checks only the mesh's own
// visible flag, so a hidden cover would still dim every label under it).
function show(group, v) {
  group.visible = v;
  group.traverse((o) => {
    if (o.isMesh) o.userData.noOcclude = !v || !!o.userData.decor;
  });
}
const decor = (o) => {
  o.traverse((m) => {
    if (m.isMesh) m.userData.decor = m.userData.noOcclude = true;
  });
  return o;
};

// linear polyline with arc-length lookup — dots ride these
function polyPath(pts) {
  const v = pts.map((p) => (p.isVector3 ? p.clone() : new THREE.Vector3(...p)));
  const acc = [0];
  for (let i = 1; i < v.length; i++) acc.push(acc[i - 1] + v[i].distanceTo(v[i - 1]));
  const length = acc[acc.length - 1];
  return {
    length,
    at(s, out) {
      const x = Math.min(Math.max(s, 0), length);
      let i = 1;
      while (i < acc.length - 1 && acc[i] < x) i++;
      const seg = acc[i] - acc[i - 1] || 1;
      return out.copy(v[i - 1]).lerp(v[i], (x - acc[i - 1]) / seg);
    },
  };
}
const curvePts = (curve, n = 28) => curve.getSpacedPoints(n);

// waveform screen: dark glass in a polymer bezel, a canvas redrawn per frame
function makeScreen(w, h, title, sub) {
  const g = new THREE.Group();
  const bezel = beveledBox(w + 0.05, h + 0.05, 0.035, materials.polymer(0x16181c), 0.012);
  g.add(bezel);
  const ch = canvasTex(512, Math.round((512 * h) / w));
  const face = new THREE.Mesh(
    new THREE.PlaneGeometry(w, h),
    new THREE.MeshBasicMaterial({ map: ch.tex, toneMapped: false }),
  );
  face.position.z = 0.0185;
  g.add(face);
  const { ctx, canvas } = ch;
  const W = canvas.width;
  const H = canvas.height;
  const y0 = H * 0.6;
  const amp = H * 0.29;

  // traces: [{ fn(τ) → -1..1, color, alpha, width }], window = last `span` cycles
  function draw(t, traces, span = 2) {
    ctx.fillStyle = '#070b10';
    ctx.fillRect(0, 0, W, H);
    ctx.strokeStyle = 'rgba(130,170,190,0.12)';
    ctx.lineWidth = 1;
    for (let i = 1; i < 8; i++) {
      ctx.beginPath();
      ctx.moveTo((W * i) / 8, H * 0.2);
      ctx.lineTo((W * i) / 8, H);
      ctx.stroke();
    }
    for (const k of [-1, -0.5, 0.5, 1]) {
      ctx.beginPath();
      ctx.moveTo(0, y0 - k * amp);
      ctx.lineTo(W, y0 - k * amp);
      ctx.stroke();
    }
    ctx.strokeStyle = 'rgba(190,210,220,0.32)';
    ctx.beginPath();
    ctx.moveTo(0, y0);
    ctx.lineTo(W, y0);
    ctx.stroke();
    const N = 720;
    for (const tr of traces) {
      ctx.save();
      ctx.globalAlpha = tr.alpha ?? 1;
      ctx.strokeStyle = tr.color;
      ctx.shadowColor = tr.color;
      ctx.shadowBlur = tr.glow ?? 14;
      ctx.lineWidth = tr.width ?? 4;
      ctx.lineJoin = 'round';
      if (tr.dash) ctx.setLineDash(tr.dash);
      ctx.beginPath();
      for (let i = 0; i <= N; i++) {
        const x = (i / N) * (W - 14);
        const v = tr.fn(t - span + (i / N) * span);
        const y = y0 - v * amp;
        if (i === 0) ctx.moveTo(x, y);
        else ctx.lineTo(x, y);
      }
      ctx.stroke();
      ctx.restore();
    }
    const lead = traces.find((tr) => !tr.dash);
    if (lead) {
      ctx.save();
      ctx.fillStyle = '#ffffff';
      ctx.shadowColor = lead.color;
      ctx.shadowBlur = 18;
      ctx.beginPath();
      ctx.arc(W - 14, y0 - lead.fn(t) * amp, 7, 0, TAU);
      ctx.fill();
      ctx.restore();
    }
    ctx.fillStyle = 'rgba(7,11,16,0.75)';
    ctx.fillRect(0, 0, W, H * 0.19);
    ctx.font = '700 25px "Segoe UI", sans-serif';
    ctx.fillStyle = '#d9e8ef';
    ctx.textBaseline = 'middle';
    ctx.textAlign = 'left';
    ctx.fillText(screen.title, 16, H * 0.1);
    ctx.font = '600 22px "Segoe UI", sans-serif';
    ctx.fillStyle = '#ffcf8a';
    ctx.textAlign = 'right';
    ctx.fillText(screen.sub, W - 16, H * 0.1);
    ch.tex.needsUpdate = true;
  }
  const screen = { group: g, draw, title, sub };
  return screen;
}

// flat copper strip along board-local [x,z] points
function strip(pts, w, mat, y = 0.004) {
  const g = new THREE.Group();
  const jointGeo = new THREE.CylinderGeometry(w / 2, w / 2, 0.008, 18);
  for (let i = 0; i < pts.length; i++) {
    const [x, z] = pts[i];
    const j = new THREE.Mesh(jointGeo, mat);
    j.position.set(x, y, z);
    g.add(j);
    if (!i) continue;
    const [x0, z0] = pts[i - 1];
    const len = Math.hypot(x - x0, z - z0);
    const s = new THREE.Mesh(new THREE.BoxGeometry(len, 0.008, w), mat);
    s.position.set((x + x0) / 2, y, (z + z0) / 2);
    s.rotation.y = -Math.atan2(z - z0, x - x0);
    g.add(s);
  }
  g.traverse((o) => (o.receiveShadow = true));
  return g;
}

// ---------------------------------------------------------------------------
export function buildAcDc({ scene }) {
  const root = new THREE.Group();
  scene.add(root);
  const labels = calloutSets(['ups', 'ac', 'dc', 'map', 'bridge', 'caps', 'hbridge', 'pwm']);

  const S = {
    view: 'ups',
    wire: 'ac',
    reveal: 0,
    caps: 1,
    inv: 'pwm',
    screens: [0, 0, 0, 0],
    flows: { rect: false, bus: false, inv: false },
    t: 0,
    drift: 0,
    fan: 0,
    mains: 1,
  };

  const plinth = studioPlinth({ w: 4.8, d: 2.1 });
  root.add(plinth);

  // ===========================================================================
  // UPS VIEW
  // ===========================================================================
  const ups = new THREE.Group();
  ups.position.x = CX;
  root.add(ups);

  const caseMat = materials.paintedMetal(0x2a2d33);
  caseMat.clearcoat = 0.35;
  caseMat.roughness = 0.5;
  const darkMat = std(0x0c0d10, { roughness: 0.8 });
  const bezelMat = materials.polymer(0x17191d);
  const rubber = materials.rubber();

  // chassis tray + end walls (stay when the cover lifts)
  const floor = beveledBox(CW, 0.025, CD, caseMat, 0.008);
  floor.position.y = CB + 0.0125;
  floor.receiveShadow = true;
  ups.add(floor);
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.08, 0.03, 20), rubber);
      foot.position.set(sx * (CW / 2 - 0.2), PL_H + 0.015, sz * (CD / 2 - 0.18));
      ups.add(foot);
    }
  }
  // right wall (output side): plain panel with vents
  const wallR = beveledBox(0.035, CH, CD, caseMat, 0.01);
  wallR.position.set(CW / 2 - 0.0175, CB + CH / 2, 0);
  ups.add(wallR);
  for (let i = 0; i < 7; i++) {
    const v = new THREE.Mesh(new THREE.BoxGeometry(0.006, 0.03, 0.42), darkMat);
    v.position.set(CW / 2 + 0.001, CB + 0.16 + i * 0.055, -0.5);
    ups.add(v);
  }
  // left wall (inlet side): hole for the cooling fan
  {
    const shp = new THREE.Shape();
    shp.moveTo(-CD / 2, -CH / 2);
    shp.lineTo(CD / 2, -CH / 2);
    shp.lineTo(CD / 2, CH / 2);
    shp.lineTo(-CD / 2, CH / 2);
    shp.closePath();
    const hole = new THREE.Path();
    hole.absarc(-FAN_Z, 0, 0.2, 0, TAU, true);
    shp.holes.push(hole);
    const geo = new THREE.ExtrudeGeometry(shp, {
      depth: 0.035,
      bevelEnabled: true,
      bevelThickness: 0.004,
      bevelSize: 0.004,
      bevelSegments: 1,
      curveSegments: 48,
    });
    geo.rotateY(Math.PI / 2);
    const wallL = new THREE.Mesh(geo, caseMat);
    wallL.position.set(-CW / 2, CB + CH / 2, 0);
    wallL.castShadow = true;
    ups.add(wallL);
  }
  // cooling fan behind the left-wall grille (group mirrored to face -x)
  const fan = new THREE.Group();
  fan.position.set(-CW / 2 + 0.09, CB + CH / 2, FAN_Z);
  fan.rotation.y = Math.PI;
  ups.add(fan);
  {
    const frame = beveledBox(0.05, 0.46, 0.46, std(0x111214, { roughness: 0.7 }), 0.02);
    frame.position.x = -0.02;
    const bore = new THREE.Mesh(
      new THREE.CylinderGeometry(0.205, 0.205, 0.052, 40, 1, true),
      std(0x0a0a0c, { side: THREE.DoubleSide }),
    );
    bore.rotation.z = Math.PI / 2;
    bore.position.x = -0.02;
    // the frame is solid — punch it visually with a dark disc behind blades
    const back = new THREE.Mesh(new THREE.CircleGeometry(0.205, 40), std(0x050506));
    back.rotation.y = Math.PI / 2;
    back.position.x = -0.047;
    frame.visible = false; // the bore + back read better than a solid frame
    fan.add(frame, bore, back);
  }
  const rotor = new THREE.Group();
  fan.add(rotor);
  {
    const hubMat = std(0x1a1b1e, { roughness: 0.55 });
    const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.07, 0.04, 28), hubMat);
    hub.rotation.z = Math.PI / 2;
    rotor.add(hub);
    const bladeGeo = new THREE.BoxGeometry(0.008, 0.12, 0.07);
    for (let i = 0; i < 7; i++) {
      const piv = new THREE.Group();
      piv.rotation.x = (i / 7) * TAU;
      const b = new THREE.Mesh(bladeGeo, hubMat);
      b.position.y = 0.125;
      b.rotation.y = 0.5;
      piv.add(b);
      rotor.add(piv);
    }
  }
  // grille on the outer face
  {
    const gm = materials.brushedSteel(0x9aa1a9);
    gm.roughness = 0.6;
    for (const r of [0.06, 0.12, 0.18]) {
      const ring = new THREE.Mesh(new THREE.TorusGeometry(r, 0.005, 6, 48), gm);
      ring.rotation.y = Math.PI / 2;
      ring.position.set(-CW / 2 - 0.006, CB + CH / 2, FAN_Z);
      ups.add(ring);
    }
    for (let i = 0; i < 4; i++) {
      const bar = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.4, 0.008), gm);
      bar.rotation.x = (i / 4) * Math.PI;
      bar.position.set(-CW / 2 - 0.006, CB + CH / 2, FAN_Z);
      ups.add(bar);
    }
  }

  // IEC inlet + plugged connector + mains cord (left wall)
  const inletY = CB + 0.32;
  const inlet = new THREE.Group();
  inlet.position.set(-CW / 2, inletY, 0);
  ups.add(inlet);
  {
    const plate = beveledBox(0.02, 0.2, 0.26, bezelMat, 0.006);
    plate.position.x = -0.01;
    const plug = beveledBox(0.16, 0.13, 0.19, materials.polymer(0x101113), 0.03);
    plug.position.x = -0.09;
    const boot = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.06, 0.12, 20), materials.polymer(0x101113));
    boot.rotation.z = Math.PI / 2;
    boot.position.x = -0.22;
    inlet.add(plate, plug, boot);
  }
  const cordMat = materials.polymer(0x111215);
  cordMat.roughness = 0.6;
  const cordIn = tubeAlong(
    [
      [CX - CW / 2 - 0.26, inletY, 0],
      [-2.05, inletY - 0.06, 0.04],
      [-2.25, PL_H + 0.06, 0.16],
      [-2.38, PL_H + 0.03, 0.22],
      [-2.46, PL_H - 0.12, 0.26],
      [-2.52, 0.03, 0.34],
      [-2.9, 0.025, 0.62],
    ].map(([x, y, z]) => [x - CX, y, z]),
    0.03,
    cordMat,
    { tubularSegments: 90 },
  );
  ups.add(cordIn);

  // output socket + lamp plug (right wall, front)
  const sock = new THREE.Group();
  sock.position.set(CW / 2, CB + 0.3, SOCK_Z);
  ups.add(sock);
  {
    const face = beveledBox(0.02, 0.22, 0.22, materials.polymer(0x202226), 0.02);
    face.position.x = 0.01;
    const plugB = beveledBox(0.11, 0.12, 0.1, materials.polymer(0x0f1012), 0.025);
    plugB.position.x = 0.07;
    sock.add(face, plugB);
  }

  // cover: top + front bezel + back (lifts away on reveal)
  const cover = new THREE.Group();
  ups.add(cover);
  {
    const top = beveledBox(CW, 0.03, CD, caseMat, 0.012);
    top.position.y = CT - 0.015;
    cover.add(top);
    for (let i = 0; i < 9; i++) {
      const slot = new THREE.Mesh(new THREE.BoxGeometry(0.5, 0.004, 0.025), darkMat);
      slot.position.set(0.55, CT + 0.0005, -0.6 + i * 0.06);
      cover.add(slot);
    }
    const backP = beveledBox(CW - 0.07, CH - 0.03, 0.025, caseMat, 0.008);
    backP.position.set(0, CB + CH / 2 - 0.015, -CD / 2 + 0.0125);
    cover.add(backP);
    const bez = beveledBox(CW, CH, 0.06, bezelMat, 0.025);
    bez.position.set(0, CB + CH / 2, CD / 2 - 0.02);
    cover.add(bez);
    // face decal
    const d = canvasTex(2048, Math.round((2048 * CH) / CW));
    const c = d.ctx;
    const Wd = d.canvas.width;
    const Hd = d.canvas.height;
    const px = (x) => ((x + CW / 2) / CW) * Wd;
    const py = (y) => (1 - y / CH) * Hd;
    c.clearRect(0, 0, Wd, Hd);
    c.fillStyle = 'rgba(0,0,0,0.35)';
    for (let i = 0; i < 6; i++) c.fillRect(px(-1.38), py(0.27 - i * 0.035), px(-0.42) - px(-1.38), 7);
    c.fillStyle = '#c9ced6';
    c.font = '700 64px "Segoe UI", sans-serif';
    c.textBaseline = 'middle';
    c.fillText('ONLINE UPS', px(-1.38), py(0.49));
    c.font = '500 34px "Segoe UI", sans-serif';
    c.fillStyle = '#8e959e';
    c.fillText('DOUBLE CONVERSION · 1 kVA', px(-1.38), py(0.4));
    c.font = '600 30px "Segoe UI", sans-serif';
    c.fillStyle = '#aeb4bc';
    c.fillText('LINE', px(0.84), py(0.47));
    c.fillText('BATTERY', px(0.84), py(0.35));
    c.fillText('FAULT', px(0.84), py(0.23));
    c.strokeStyle = 'rgba(255,179,71,0.75)';
    c.lineWidth = 5;
    c.beginPath();
    c.moveTo(px(-1.38), py(0.56));
    c.lineTo(px(-0.9), py(0.56));
    c.stroke();
    d.tex.needsUpdate = true;
    const decal = new THREE.Mesh(
      new THREE.PlaneGeometry(CW, CH),
      new THREE.MeshStandardMaterial({ map: d.tex, transparent: true, roughness: 0.6, depthWrite: false }),
    );
    decal.position.set(0, CB + CH / 2, CD / 2 + 0.013);
    cover.add(decal);
  }
  // LCD
  const lcd = canvasTex(512, 184);
  const lcdMesh = new THREE.Mesh(
    new THREE.PlaneGeometry(0.5, 0.18),
    new THREE.MeshBasicMaterial({ map: lcd.tex, toneMapped: false }),
  );
  lcdMesh.position.set(0.22, CB + 0.37, CD / 2 + 0.017);
  cover.add(lcdMesh);
  {
    const frameL = beveledBox(0.54, 0.22, 0.012, materials.polymer(0x0b0c0e), 0.006);
    frameL.position.set(0.22, CB + 0.37, CD / 2 + 0.006);
    cover.add(frameL);
  }
  let lcdState = null;
  function drawLcd(onBatt) {
    if (lcdState === onBatt) return;
    lcdState = onBatt;
    const { ctx: c, canvas } = lcd;
    c.fillStyle = onBatt ? '#1a1406' : '#06150f';
    c.fillRect(0, 0, canvas.width, canvas.height);
    c.fillStyle = onBatt ? '#ffc76a' : '#7dffcf';
    c.shadowColor = c.fillStyle;
    c.shadowBlur = 10;
    c.font = '700 46px "Consolas", monospace';
    c.textBaseline = 'middle';
    c.fillText(onBatt ? 'ON BATTERY' : 'IN  230V  50Hz', 24, 56);
    c.font = '600 38px "Consolas", monospace';
    c.fillText(onBatt ? 'OUT 230V  ▮▮▮▮▯' : 'OUT 230V  LOAD 32%', 24, 130);
    c.shadowBlur = 0;
    lcd.tex.needsUpdate = true;
  }
  // status LEDs + power button
  const ledMat = (hex) =>
    new THREE.MeshStandardMaterial({ color: 0x222222, emissive: hex, emissiveIntensity: 0, roughness: 0.3 });
  const leds = {
    line: ledMat(0x3dff7a),
    batt: ledMat(0xffa526),
    fault: ledMat(0xff3b30),
  };
  const ledGroup = new THREE.Group();
  ledGroup.position.set(0.79, 0, CD / 2 + 0.012);
  cover.add(ledGroup);
  [
    ['line', 0.47],
    ['batt', 0.35],
    ['fault', 0.23],
  ].forEach(([k, y]) => {
    const led = new THREE.Mesh(new THREE.SphereGeometry(0.022, 16, 10, 0, TAU, 0, Math.PI / 2), leds[k]);
    led.rotation.x = Math.PI / 2;
    led.position.set(0, CB + y, 0);
    ledGroup.add(led);
  });
  {
    const btn = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.055, 0.02, 32), materials.polymer(0x24272c));
    btn.rotation.x = Math.PI / 2;
    btn.position.set(1.28, CB + 0.35, CD / 2 + 0.018);
    const ring = new THREE.Mesh(
      new THREE.TorusGeometry(0.058, 0.006, 8, 40),
      new THREE.MeshStandardMaterial({ color: 0x332211, emissive: ACCENT, emissiveIntensity: 0.9 }),
    );
    ring.position.set(1.28, CB + 0.35, CD / 2 + 0.026);
    cover.add(btn, ring);
  }

  // battery (behind the board, on the chassis floor)
  const battery = new THREE.Group();
  battery.position.set(-0.35, CB + 0.025, -0.76);
  ups.add(battery);
  {
    const body = beveledBox(1.0, 0.31, 0.28, materials.polymer(0x2b2e33), 0.02);
    body.position.y = 0.155;
    const lid = beveledBox(1.0, 0.035, 0.28, materials.polymer(0x3a3e45), 0.012);
    lid.position.y = 0.325;
    battery.add(body, lid);
    const bl = canvasTex(1024, 286);
    const c = bl.ctx;
    c.fillStyle = '#25282d';
    c.fillRect(0, 0, 1024, 286);
    c.fillStyle = '#d6dbe2';
    c.font = '700 74px "Segoe UI", sans-serif';
    c.fillText('12V  9Ah', 40, 110);
    c.font = '500 38px "Segoe UI", sans-serif';
    c.fillStyle = '#9aa1aa';
    c.fillText('SEALED LEAD-ACID · RECHARGEABLE', 40, 180);
    c.fillStyle = '#ffb347';
    c.fillRect(40, 220, 300, 10);
    bl.tex.needsUpdate = true;
    const tag = new THREE.Mesh(
      new THREE.PlaneGeometry(0.9, 0.25),
      new THREE.MeshStandardMaterial({ map: bl.tex, roughness: 0.7 }),
    );
    tag.position.set(0, 0.16, 0.1405);
    battery.add(tag);
    for (const [x, col] of [
      [0.4, 0xc0392b],
      [-0.4, 0x1b1b1b],
    ]) {
      const term = beveledBox(0.07, 0.03, 0.05, std(col, { roughness: 0.4 }), 0.008);
      term.position.set(x, 0.357, 0);
      battery.add(term);
    }
  }

  // ---------------------------------------------------------------------------
  // the board
  // ---------------------------------------------------------------------------
  const board = new THREE.Group();
  board.position.y = BY;
  ups.add(board);
  {
    const pcbSide = std(0x1d4a32, { roughness: 0.6 });
    const pcb = new THREE.Mesh(new THREE.BoxGeometry(BW, 0.025, BZ1 - BZ0), pcbSide);
    pcb.position.set(0, -0.0125, (BZ0 + BZ1) / 2);
    pcb.receiveShadow = true;
    pcb.castShadow = true;
    board.add(pcb);
    // standoffs
    for (const sx of [-1, 1])
      for (const sz of [BZ0 + 0.06, BZ1 - 0.06]) {
        const so = new THREE.Mesh(new THREE.CylinderGeometry(0.018, 0.018, 0.045, 12), materials.brushedSteel());
        so.position.set(sx * (BW / 2 - 0.06), -0.0475, sz);
        board.add(so);
      }
    // solder mask + silkscreen
    const bt = canvasTex(2048, Math.round((2048 * (BZ1 - BZ0)) / BW));
    const c = bt.ctx;
    const Wb = bt.canvas.width;
    const Hb = bt.canvas.height;
    const X = (x) => ((x + BW / 2) / BW) * Wb;
    const Z = (z) => ((z - BZ0) / (BZ1 - BZ0)) * Hb;
    c.fillStyle = '#1f5a3c';
    c.fillRect(0, 0, Wb, Hb);
    const r = rng(7);
    for (let i = 0; i < 2600; i++) {
      c.fillStyle = `rgba(${r() < 0.5 ? '0,0,0' : '120,200,150'},${0.03 + r() * 0.04})`;
      c.fillRect(r() * Wb, r() * Hb, 2 + r() * 5, 2 + r() * 5);
    }
    c.strokeStyle = 'rgba(235,240,235,0.85)';
    c.fillStyle = 'rgba(235,240,235,0.9)';
    c.lineWidth = 3;
    c.font = '700 30px "Segoe UI", sans-serif';
    c.textAlign = 'center';
    c.textBaseline = 'middle';
    const txt = (s, x, z, size = 30) => {
      c.font = `700 ${size}px "Segoe UI", sans-serif`;
      c.fillText(s, X(x), Z(z));
    };
    const rect = (x0, z0, x1, z1, dash) => {
      c.setLineDash(dash ? [12, 9] : []);
      c.strokeRect(X(x0), Z(z0), X(x1) - X(x0), Z(z1) - Z(z0));
      c.setLineDash([]);
    };
    rect(-1.3, -0.52, -0.38, 0.52, true);
    rect(-0.36, -0.52, 0.36, 0.52, true);
    rect(0.38, -0.52, 1.3, 0.52, true);
    txt('RECTIFIER', -0.84, -0.46, 34);
    txt('DC BUS', 0.0, 0.47, 34);
    txt('INVERTER', 0.85, -0.46, 34);
    txt('D1', -1.06, -0.2);
    txt('D2', -0.54, -0.2);
    txt('D3', -1.06, 0.2);
    txt('D4', -0.54, 0.2);
    txt('AC~', -1.22, 0.1, 26);
    txt('+', -0.8, -0.38, 44);
    txt('−', -0.8, 0.38, 44);
    txt('C1', CAP_X[0], 0.17);
    txt('C2', CAP_X[1], 0.17);
    txt('Q1', LEG_A - 0.14, -0.14);
    txt('Q2', LEG_A - 0.14, 0.14);
    txt('Q3', LEG_B - 0.14, -0.14);
    txt('Q4', LEG_B - 0.14, 0.14);
    txt('L1', IND_X, 0.16);
    txt('C3', FC_X, 0.11);
    txt('U1', 0.85, 0.36);
    txt('⚠ HIGH VOLTAGE', -0.84, 0.47, 26);
    c.beginPath();
    for (const [x, z] of [
      [-1.25, -0.55],
      [1.25, -0.55],
      [-1.25, 0.55],
      [1.25, 0.55],
    ]) {
      c.moveTo(X(x) + 18, Z(z));
      c.arc(X(x), Z(z), 18, 0, TAU);
    }
    c.stroke();
    bt.tex.needsUpdate = true;
    const top = new THREE.Mesh(
      new THREE.PlaneGeometry(BW, BZ1 - BZ0),
      new THREE.MeshStandardMaterial({ map: bt.tex, roughness: 0.42, metalness: 0.05 }),
    );
    top.rotation.x = -Math.PI / 2;
    top.position.set(0, 0.0003, (BZ0 + BZ1) / 2);
    top.receiveShadow = true;
    board.add(top);
  }

  // copper: one material per conducting section so each can glow on its own
  const cuMat = () => std(0xc77d48, { metalness: 0.85, roughness: 0.32, emissive: ACCENT, emissiveIntensity: 0 });
  const cu = {
    P: cuMat(),
    M: cuMat(),
    legA: cuMat(),
    legB: cuMat(),
    out: cuMat(),
    misc: cuMat(),
  };
  board.add(strip([V_P, [LEG_B, -RAIL_Z]], 0.06, cu.P));
  board.add(strip([V_M, [LEG_B, RAIL_Z]], 0.06, cu.M));
  board.add(strip([[LEG_A, -RAIL_Z], [LEG_A, RAIL_Z]], 0.05, cu.legA));
  board.add(strip([[LEG_B, -RAIL_Z], [LEG_B, RAIL_Z]], 0.05, cu.legB));
  board.add(strip([[LEG_A, 0], [IND_X - 0.1, 0]], 0.045, cu.out));
  board.add(strip([[IND_X + 0.1, 0], [FC_X - 0.07, 0]], 0.045, cu.out));
  board.add(strip([[FC_X + 0.07, 0], [BPAD_X, 0]], 0.045, cu.legB));
  for (const x of CAP_X) {
    board.add(strip([[x, -RAIL_Z], [x, -0.07]], 0.045, cu.P));
    board.add(strip([[x, 0.07], [x, RAIL_Z]], 0.045, cu.M));
  }
  // bridge vertex pads
  const padGeo = new THREE.CylinderGeometry(0.045, 0.045, 0.01, 24);
  for (const v of [V_L, V_N, V_P, V_M]) {
    const pad = new THREE.Mesh(padGeo, cu.misc);
    pad.position.set(v[0], 0.005, v[1]);
    board.add(pad);
  }
  for (const x of [OUT1_X, BPAD_X]) {
    const pad = new THREE.Mesh(padGeo, cu.out);
    pad.position.set(x, 0.005, 0);
    board.add(pad);
  }
  const solder = materials.brushedSteel(0xc9ccd0);
  solder.roughness = 0.35;

  // --- diodes (axial, black epoxy, silver cathode band) ---
  const diodes = [];
  function diode(a, k) {
    const g = new THREE.Group();
    const dx = k[0] - a[0];
    const dz = k[1] - a[1];
    const len = Math.hypot(dx, dz);
    g.position.set((a[0] + k[0]) / 2, 0, (a[1] + k[1]) / 2);
    g.rotation.y = -Math.atan2(dz, dx);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x15161a,
      roughness: 0.38,
      clearcoat: 0.5,
      clearcoatRoughness: 0.3,
      emissive: ACCENT,
      emissiveIntensity: 0,
    });
    const body = new THREE.Mesh(new THREE.CapsuleGeometry(0.036, 0.11, 6, 18), mat);
    body.rotation.z = Math.PI / 2;
    body.position.y = 0.05;
    body.castShadow = true;
    const band = new THREE.Mesh(new THREE.CylinderGeometry(0.0375, 0.0375, 0.024, 22), materials.brushedSteel(0xd2d6db));
    band.rotation.z = Math.PI / 2;
    band.position.set(0.05, 0.05, 0);
    g.add(body, band);
    for (const s of [-1, 1]) {
      const lead = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, len / 2 - 0.09, 8), solder);
      lead.rotation.z = Math.PI / 2;
      lead.position.set(s * (len / 4 + 0.045), 0.05, 0);
      const drop = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 8), solder);
      drop.position.set(s * (len / 2 - 0.006), 0.025, 0);
      g.add(lead, drop);
    }
    board.add(g);
    diodes.push(mat);
    return g;
  }
  const dD1 = diode(V_L, V_P);
  const dD2 = diode(V_N, V_P);
  const dD3 = diode(V_M, V_L);
  const dD4 = diode(V_M, V_N);

  // --- reservoir capacitors ---
  const capGroup = new THREE.Group();
  board.add(capGroup);
  const capTops = [];
  for (const x of CAP_X) {
    const g = new THREE.Group();
    g.position.set(x, 0, 0);
    const sleeve = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1, 0.1, 0.34, 40),
      new THREE.MeshPhysicalMaterial({ color: 0x1d2c58, roughness: 0.35, clearcoat: 0.6, clearcoatRoughness: 0.25 }),
    );
    sleeve.position.y = 0.17;
    sleeve.castShadow = true;
    const stripe = new THREE.Mesh(
      new THREE.CylinderGeometry(0.1015, 0.1015, 0.3, 40, 1, true, -0.35, 0.7),
      std(0xb8c2d6, { roughness: 0.45 }),
    );
    stripe.position.y = 0.17;
    const lid = new THREE.Mesh(new THREE.CylinderGeometry(0.094, 0.094, 0.01, 40), materials.aluminum(0xc3c8ce));
    lid.position.y = 0.343;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.096, 0.007, 8, 40), sleeve.material);
    lip.rotation.x = Math.PI / 2;
    lip.position.y = 0.338;
    g.add(sleeve, stripe, lid, lip);
    for (const rot of [0, Math.PI / 2]) {
      const score = new THREE.Mesh(new THREE.BoxGeometry(0.12, 0.004, 0.008), std(0x7c838b));
      score.position.y = 0.349;
      score.rotation.y = rot + Math.PI / 4;
      g.add(score);
    }
    capGroup.add(g);
    capTops.push(g);
  }

  // --- MOSFETs (TO-247 lying flat, tab to the back) ---
  const fets = [];
  function mosfet(x, z) {
    const g = new THREE.Group();
    g.position.set(x, 0, z);
    const mat = new THREE.MeshPhysicalMaterial({
      color: 0x131418,
      roughness: 0.55,
      clearcoat: 0.25,
      emissive: ACCENT,
      emissiveIntensity: 0,
    });
    const body = beveledBox(0.15, 0.045, 0.15, mat, 0.01);
    body.position.set(0, 0.0275, 0.01);
    const tab = beveledBox(0.15, 0.012, 0.08, materials.brushedSteel(0xc8ccd2), 0.004);
    tab.position.set(0, 0.011, -0.09);
    const screw = new THREE.Mesh(new THREE.CylinderGeometry(0.02, 0.02, 0.014, 6), materials.brushedSteel(0x9ba3ab));
    screw.position.set(0, 0.024, -0.095);
    g.add(body, tab, screw);
    for (const lx of [-0.045, 0, 0.045]) {
      const lead = new THREE.Mesh(new THREE.BoxGeometry(0.014, 0.004, 0.06), solder);
      lead.position.set(lx, 0.02, 0.11);
      g.add(lead);
    }
    board.add(g);
    fets.push(mat);
    return g;
  }
  const q1 = mosfet(LEG_A, -0.13);
  const q2 = mosfet(LEG_A, 0.13);
  const q3 = mosfet(LEG_B, -0.13);
  const q4 = mosfet(LEG_B, 0.13);

  // --- output filter: toroid coil + film capacitor ---
  const inductor = new THREE.Group();
  inductor.position.set(IND_X, 0.05, 0);
  board.add(inductor);
  {
    const core = new THREE.Mesh(
      new THREE.TorusGeometry(0.085, 0.038, 18, 48),
      std(0xcfc04a, { roughness: 0.55 }),
    );
    core.rotation.x = Math.PI / 2;
    const wind = coil(
      { turns: 22, radius: 0.046, toroidal: true, majorRadius: 0.085, wireRadius: 0.0075, segmentsPerTurn: 14, majorSpan: TAU * 0.92 },
      std(0xc8743c, { metalness: 0.85, roughness: 0.3 }),
    );
    inductor.add(core, wind.mesh);
  }
  const filmCap = beveledBox(0.13, 0.11, 0.085, std(0xd9a832, { roughness: 0.45 }), 0.012);
  filmCap.position.set(FC_X, 0.058, 0);
  board.add(filmCap);

  // --- controller + gate drivers + small parts ---
  const icMat = std(0x16171a, { roughness: 0.5 });
  const controller = beveledBox(0.17, 0.022, 0.17, icMat, 0.006);
  controller.position.set(0.85, 0.011, 0.44);
  board.add(controller);
  for (let s = 0; s < 4; s++)
    for (let i = 0; i < 8; i++) {
      const pin = new THREE.Mesh(new THREE.BoxGeometry(0.008, 0.004, 0.02), solder);
      const o = -0.07 + i * 0.02;
      const side = s < 2 ? (s ? 1 : -1) : 0;
      if (side) pin.position.set(0.85 + o, 0.003, 0.44 + side * 0.095);
      else {
        pin.rotation.y = Math.PI / 2;
        pin.position.set(0.85 + (s === 2 ? -0.095 : 0.095), 0.003, 0.44 + o);
      }
      board.add(pin);
    }
  for (const x of [LEG_A, LEG_B]) {
    const drv = beveledBox(0.1, 0.02, 0.06, icMat, 0.005);
    drv.position.set(x, 0.01, 0.42);
    board.add(drv);
  }
  {
    const r = rng(11);
    const smd = std(0x2b2b2b, { roughness: 0.5 });
    const tan = std(0x9a7b55, { roughness: 0.5 });
    for (let i = 0; i < 18; i++) {
      const p = beveledBox(0.04, 0.015, 0.02, r() < 0.5 ? smd : tan, 0.004);
      const x = -1.2 + r() * 2.4;
      const z = r() < 0.5 ? -0.5 + r() * 0.12 : 0.36 + r() * 0.14;
      if (x > 0.65 && x < 1.05 && z > 0.3) continue; // keep the controller clear
      p.position.set(x, 0.0075, z);
      p.rotation.y = r() < 0.5 ? 0 : Math.PI / 2;
      board.add(p);
    }
  }

  // --- battery charger/booster module (daughter board) ---
  const charger = new THREE.Group();
  charger.position.set(0.28, 0.06, -0.45);
  board.add(charger);
  {
    const pcb = beveledBox(0.34, 0.012, 0.2, std(0x1b3e6a, { roughness: 0.55 }), 0.004);
    charger.add(pcb);
    const ferrite = beveledBox(0.1, 0.08, 0.08, std(0x4a4d52, { roughness: 0.7 }), 0.008);
    ferrite.position.set(-0.06, 0.046, 0);
    const tape = beveledBox(0.06, 0.07, 0.086, std(0xe3c341, { roughness: 0.5 }), 0.006);
    tape.position.set(-0.06, 0.046, 0);
    const smallCap = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.08, 20), std(0x1d2c58, { roughness: 0.4 }));
    smallCap.position.set(0.09, 0.046, 0.03);
    charger.add(ferrite, tape, smallCap);
    for (const [x, z] of [
      [-0.15, -0.08],
      [0.15, -0.08],
      [-0.15, 0.08],
      [0.15, 0.08],
    ]) {
      const so = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.008, 0.06, 8), solder);
      so.position.set(x, -0.03, z);
      charger.add(so);
    }
  }
  board.add(strip([[0.2, -0.38], [0.2, -RAIL_Z]], 0.035, cu.P));
  const wireMat = (hex) => std(hex, { roughness: 0.55 });
  const bY = CB + 0.025 + 0.36 - BY; // battery terminal height, board-local
  board.add(
    tubeAlong([[0.05, bY, -0.76], [0.12, bY + 0.1, -0.68], [0.2, 0.12, -0.55], [0.22, 0.075, -0.5]], 0.012, wireMat(0xc0392b)),
  );
  board.add(
    tubeAlong([[-0.75, bY, -0.76], [-0.5, bY + 0.14, -0.66], [0.25, 0.16, -0.58], [0.34, 0.075, -0.52]], 0.012, wireMat(0x1b1b1b)),
  );
  board.add(
    tubeAlong([[0.4, 0.07, -0.42], [0.36, 0.2, -0.1], [0.32, 0.14, 0.22], [0.3, 0.012, RAIL_Z]], 0.011, wireMat(0x1b1b1b)),
  );

  // --- internal leads: inlet → bridge, filter → socket ---
  const leadIn = BY;
  const inletLocal = [-CW / 2 + 0.06, inletY - leadIn];
  const wL = tubeAlong(
    [
      [inletLocal[0], inletLocal[1], -0.03],
      [-1.32, inletLocal[1] - 0.04, -0.02],
      [-1.17, 0.07, -0.005],
      [V_L[0], 0.012, 0],
    ],
    0.016,
    wireMat(0x7b4a24),
  );
  const wN = tubeAlong(
    [
      [inletLocal[0], inletLocal[1], 0.03],
      [-1.3, inletLocal[1] - 0.08, 0.3],
      [-0.95, 0.09, 0.46],
      [-0.6, 0.1, 0.36],
      [V_N[0], 0.06, 0.12],
      [V_N[0], 0.012, 0],
    ],
    0.016,
    wireMat(0x2a5fa8),
  );
  const sockLocal = [CW / 2 - 0.06, CB + 0.3 - BY];
  const wOut = tubeAlong(
    [
      [OUT1_X, 0.012, 0],
      [OUT1_X - 0.01, 0.1, -0.07],
      [1.1, 0.22, -0.06],
      [1.36, sockLocal[1] + 0.02, SOCK_Z - 0.12],
      [sockLocal[0], sockLocal[1], SOCK_Z - 0.03],
    ],
    0.016,
    wireMat(0x7b4a24),
  );
  const wRet = tubeAlong(
    [
      [BPAD_X, 0.012, 0],
      [BPAD_X + 0.02, 0.1, 0.12],
      [1.38, sockLocal[1] - 0.02, SOCK_Z],
      [sockLocal[0], sockLocal[1], SOCK_Z + 0.03],
    ],
    0.016,
    wireMat(0x2a5fa8),
  );
  board.add(wL, wN, wOut, wRet);

  // ---------------------------------------------------------------------------
  // current dots
  // ---------------------------------------------------------------------------
  const P3 = (x, z, y = DOT_Y) => new THREE.Vector3(x, y, z);
  const lifted = (a, b, h) => [P3(a[0], a[1]), P3(a[0] + (b[0] - a[0]) * 0.18, a[1] + (b[1] - a[1]) * 0.18, h), P3(a[0] + (b[0] - a[0]) * 0.82, a[1] + (b[1] - a[1]) * 0.82, h), P3(b[0], b[1])];
  const paths = {
    inL: polyPath(curvePts(wL.userData.curve)),
    inN: polyPath(curvePts(wN.userData.curve, 40)),
    D1: polyPath(lifted(V_L, V_P, 0.11)),
    D2: polyPath(lifted(V_N, V_P, 0.11)),
    D3: polyPath(lifted(V_M, V_L, 0.11)),
    D4: polyPath(lifted(V_M, V_N, 0.11)),
    P1: polyPath([P3(V_P[0], V_P[1]), P3(TAP_X, -RAIL_Z)]),
    M1: polyPath([P3(TAP_X, RAIL_Z), P3(V_M[0], V_M[1])]),
    P2: polyPath([P3(TAP_X, -RAIL_Z), P3(LEG_A, -RAIL_Z)]),
    M2: polyPath([P3(LEG_A, RAIL_Z), P3(TAP_X, RAIL_Z)]),
    P3: polyPath([P3(LEG_A, -RAIL_Z), P3(LEG_B, -RAIL_Z)]),
    M3: polyPath([P3(LEG_B, RAIL_Z), P3(LEG_A, RAIL_Z)]),
    Q1: polyPath([P3(LEG_A + 0.09, -RAIL_Z), P3(LEG_A + 0.09, -0.21, 0.07), P3(LEG_A + 0.09, -0.04, 0.07), P3(LEG_A + 0.09, 0)]),
    Q2: polyPath([P3(LEG_A + 0.09, 0), P3(LEG_A + 0.09, 0.05, 0.07), P3(LEG_A + 0.09, 0.22, 0.07), P3(LEG_A + 0.09, RAIL_Z)]),
    Q3: polyPath([P3(LEG_B - 0.09, -RAIL_Z), P3(LEG_B - 0.09, -0.21, 0.07), P3(LEG_B - 0.09, -0.04, 0.07), P3(LEG_B - 0.09, 0)]),
    Q4: polyPath([P3(LEG_B - 0.09, 0), P3(LEG_B - 0.09, 0.05, 0.07), P3(LEG_B - 0.09, 0.22, 0.07), P3(LEG_B - 0.09, RAIL_Z)]),
    LO: polyPath([P3(LEG_A, 0), P3(IND_X - 0.1, 0), P3(IND_X, 0, 0.13), P3(IND_X + 0.1, 0), P3(OUT1_X, 0), ...curvePts(wOut.userData.curve, 24).slice(1)]),
    LR: polyPath([...curvePts(wRet.userData.curve, 20).reverse(), P3(LEG_B + 0.05, 0)]),
  };
  const groups = {
    rect: ['inL', 'inN', 'D1', 'D2', 'D3', 'D4', 'P1', 'M1'],
    bus: ['P2', 'M2'],
    inv: ['P3', 'M3', 'Q1', 'Q2', 'Q3', 'Q4', 'LO', 'LR'],
  };
  const dotDefs = [];
  let dotCount = 0;
  for (const [k, p] of Object.entries(paths)) {
    const n = Math.max(2, Math.round(p.length / DOT_SP));
    dotDefs.push({ k, p, n, start: dotCount });
    dotCount += n;
  }
  const dotMat = new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffd27a).multiplyScalar(1.25) });
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.013, 10, 8), dotMat, dotCount);
  dots.frustumCulled = false;
  dots.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  board.add(decor(dots));
  const _m = new THREE.Matrix4();
  const _v = new THREE.Vector3();
  const _q = new THREE.Quaternion();
  const _s = new THREE.Vector3();

  // per-path [cumulative charge, instantaneous rate 0..1]
  function currents() {
    const t = S.t;
    const f = frac(t);
    const sn = Math.sin(TAU * t);
    const on = S.mains;
    const C = {};
    const pos = S.caps ? Qf.gpos(t) : Qf.pos(t);
    const neg = S.caps ? Qf.gneg(t) : Qf.neg(t);
    const rp = S.caps ? (f < 0.5 ? gulpRate(2 * f) : 0) : Math.max(sn, 0);
    const rn = S.caps ? (f >= 0.5 ? gulpRate(2 * f - 1) : 0) : Math.max(-sn, 0);
    C.D1 = C.D4 = [pos, rp * on];
    C.D2 = C.D3 = [neg, rn * on];
    C.inL = [pos - neg, (rp + rn) * on];
    C.inN = [neg - pos, (rp + rn) * on];
    C.P1 = C.M1 = [pos + neg, (rp + rn) * on];
    C.P2 = C.M2 = S.caps ? [2 * t, 1] : [pos + neg, rp + rn];
    if (S.inv === 'square') {
      const a = f < 0.5 ? 1 : 0;
      C.Q1 = C.Q4 = C.M3 = [Qf.spos(t), a];
      C.Q2 = C.Q3 = C.P3 = [Qf.sneg(t), 1 - a];
      C.LO = C.LR = [Qf.spos(t) - Qf.sneg(t), 1];
    } else {
      C.Q1 = C.Q4 = C.M3 = [Qf.pos(t), Math.max(sn, 0)];
      C.Q2 = C.Q3 = C.P3 = [Qf.neg(t), Math.max(-sn, 0)];
      C.LO = C.LR = [Qf.pos(t) - Qf.neg(t), Math.abs(sn)];
    }
    return C;
  }

  function applyDots(C) {
    const show = {};
    for (const [g, ks] of Object.entries(groups)) for (const k of ks) show[k] = S.flows[g];
    for (const d of dotDefs) {
      const [q, rate] = C[d.k];
      const vis = show[d.k] ? smooth(Math.min(1, rate * 3.5)) : 0;
      const sp = d.p.length / d.n;
      const off = q * DOTS_PER_UNIT;
      for (let i = 0; i < d.n; i++) {
        const u = frac((i + off) / d.n);
        const s = u * d.p.length;
        d.p.at(s, _v);
        const edge = Math.min(1, (u * d.n) / 0.6, ((1 - u) * d.n) / 0.6);
        const sc = vis * Math.max(0, edge);
        _m.compose(_v, _q, _s.setScalar(sc || 1e-5));
        dots.setMatrixAt(d.start + i, _m);
      }
      d.sp = sp;
    }
    dots.instanceMatrix.needsUpdate = true;
  }

  // ---------------------------------------------------------------------------
  // scope screens + probe leads
  // ---------------------------------------------------------------------------
  const screenRig = new THREE.Group();
  ups.add(screenRig);
  const SCR_W = 0.6;
  const SCR_H = 0.34;
  const scrDefs = [
    { x: -1.05, title: 'AC IN', sub: '230 V · 50 Hz', probe: [V_L[0], 0.02, V_L[1]] },
    { x: -0.33, title: 'DC BUS', sub: '≈ 320 V DC', probe: [TAP_X, 0.02, -RAIL_Z] },
    { x: 0.39, title: 'SWITCHES', sub: 'H-bridge out', probe: [LEG_A, 0.02, 0] },
    { x: 1.11, title: 'AC OUT', sub: '230 V · 50 Hz', probe: [OUT1_X, 0.02, 0] },
  ];
  const scrY = 1.22;
  const scrZ = -0.86;
  const probeMat = std(0x30343a, { roughness: 0.6 });
  const tipMat = new THREE.MeshStandardMaterial({ color: 0x3a2a14, emissive: ACCENT, emissiveIntensity: 1.2 });
  const screens = scrDefs.map((d, i) => {
    const sc = makeScreen(SCR_W, SCR_H, d.title, d.sub);
    sc.group.position.set(d.x, scrY, scrZ);
    sc.group.rotation.x = -0.12;
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, scrY - SCR_H / 2 - CB, 10), materials.brushedSteel());
    post.position.set(d.x, (scrY - SCR_H / 2 + CB) / 2, scrZ - 0.04);
    const rig = new THREE.Group();
    rig.add(sc.group, decor(post));
    const tip = [d.probe[0], BY + d.probe[1], d.probe[2]];
    const lead = tubeAlong(
      [
        [d.x + 0.18, scrY - SCR_H / 2 - 0.02, scrZ + 0.03],
        [d.x * 0.6 + tip[0] * 0.4 + 0.1, scrY - 0.32, (scrZ + tip[2]) / 2 - 0.05],
        [tip[0] + 0.04, tip[1] + 0.16, tip[2] - 0.05],
        [tip[0], tip[1] + 0.035, tip[2]],
      ],
      0.006,
      probeMat,
      { radialSegments: 8 },
    );
    const hook = new THREE.Mesh(new THREE.ConeGeometry(0.012, 0.04, 12), tipMat);
    hook.rotation.x = Math.PI;
    hook.position.set(tip[0], tip[1] + 0.02, tip[2]);
    rig.add(decor(lead), decor(hook));
    screenRig.add(rig);
    sc.rig = rig;
    sc.index = i;
    return sc;
  });

  const COL = { ac: '#ffb347', dc: '#7ad7ff', ghost: '#ffb347' };
  function drawScreens() {
    const t = S.t;
    const m = S.mains;
    const [s0, s1, s2, s3] = screens;
    if (S.screens[0]) s0.draw(t, [{ fn: (x) => m * Math.sin(TAU * x), color: COL.ac }]);
    if (S.screens[1]) {
      const tr = [];
      if (S.caps) tr.push({ fn: (x) => Math.abs(Math.sin(TAU * x)), color: COL.ghost, alpha: 0.35, width: 2.5, glow: 0, dash: [10, 8] });
      tr.push({ fn: (x) => busV(x, S.caps), color: COL.dc });
      s1.draw(t, tr);
    }
    if (S.screens[2]) s2.draw(t, [{ fn: S.inv === 'square' ? squareV : pwmV, color: '#c99bff', glow: 10, width: 3 }]);
    if (S.screens[3]) s3.draw(t, [{ fn: (x) => Math.sin(TAU * x) + 0.025 * Math.sin(TAU * PWM_N * 2 * x), color: COL.ac }]);
  }

  // ---------------------------------------------------------------------------
  // lamp (plugged into the UPS output)
  // ---------------------------------------------------------------------------
  const lamp = new THREE.Group();
  lamp.position.set(1.95, PL_H, 0.5);
  root.add(lamp);
  const bulbMat = new THREE.MeshStandardMaterial({ color: 0xfff1d6, emissive: 0xffd49a, emissiveIntensity: 2.2 });
  {
    const metal = materials.paintedMetal(0x1c1e22);
    metal.clearcoat = 0.4;
    const base = new THREE.Mesh(new THREE.CylinderGeometry(0.2, 0.22, 0.045, 40), metal);
    base.position.y = 0.0225;
    base.castShadow = true;
    const stem = tubeAlong(
      [
        [0, 0.04, 0],
        [0, 0.55, 0],
        [-0.04, 0.8, 0.08],
        [-0.2, 0.92, 0.22],
      ],
      0.016,
      metal,
    );
    const head = new THREE.Group();
    head.position.set(-0.24, 0.92, 0.26);
    // open end aimed down at the plinth and toward the front-left hero camera,
    // so the lit bulb reads
    head.quaternion.setFromUnitVectors(new THREE.Vector3(0, -1, 0), new THREE.Vector3(-0.55, -0.62, 0.56).normalize());
    const shade = new THREE.Mesh(new THREE.CylinderGeometry(0.06, 0.15, 0.2, 40, 1, true), metal);
    shade.material = metal;
    const liner = new THREE.Mesh(
      new THREE.CylinderGeometry(0.058, 0.147, 0.198, 40, 1, true),
      new THREE.MeshStandardMaterial({ color: 0xf2ece0, roughness: 0.8, side: THREE.BackSide, emissive: 0xffd49a, emissiveIntensity: 0.25 }),
    );
    const capTop = new THREE.Mesh(new THREE.SphereGeometry(0.06, 24, 10, 0, TAU, 0, Math.PI / 2), metal);
    capTop.position.y = 0.1;
    const bulb = new THREE.Mesh(new THREE.SphereGeometry(0.055, 24, 16), bulbMat);
    bulb.position.y = -0.03;
    head.add(shade, liner, capTop, bulb);
    lamp.add(base, stem, head);
  }
  const lampCord = tubeAlong(
    [
      [CX + CW / 2 + 0.12, CB + 0.3, SOCK_Z],
      [CX + CW / 2 + 0.2, CB + 0.18, SOCK_Z + 0.04],
      [1.42, PL_H + 0.012, SOCK_Z + 0.04],
      [1.7, PL_H + 0.012, 0.42],
      [1.95, PL_H + 0.02, 0.5],
    ],
    0.014,
    cordMat,
  );
  root.add(lampCord);

  // ===========================================================================
  // WIRE VIEW — a magnified, cut-open length of mains cable
  // ===========================================================================
  const wireView = new THREE.Group();
  wireView.position.y = WIRE_Y;
  root.add(wireView);
  const insMat = materials.polymer(0x6b3f22);
  insMat.roughness = 0.6;
  insMat.clearcoat = 0.3;
  {
    const sh = new THREE.Shape();
    const a0 = (210 * Math.PI) / 180;
    const a1 = (420 * Math.PI) / 180;
    sh.absarc(0, 0, R_INS, a0, a1, false);
    sh.absarc(0, 0, R_CU + 0.004, a1, a0, true);
    sh.closePath();
    const geo = new THREE.ExtrudeGeometry(sh, { depth: CUT_L, bevelEnabled: false, curveSegments: 64 });
    geo.translate(0, 0, -CUT_L / 2);
    geo.rotateY(Math.PI / 2);
    const ins = new THREE.Mesh(geo, insMat);
    ins.castShadow = true;
    ins.receiveShadow = true;
    wireView.add(ins);
  }
  const copperSolid = materials.anisoSteel(0xd08a55, 0);
  copperSolid.roughness = 0.4;
  for (const s of [-1, 1]) {
    const stubIns = new THREE.Mesh(new THREE.CylinderGeometry(R_INS, R_INS, STUB_L, 64, 1, true), insMat);
    stubIns.rotation.z = Math.PI / 2;
    stubIns.position.x = s * (CUT_L / 2 + STUB_L / 2);
    stubIns.castShadow = true;
    wireView.add(stubIns);
    for (const ex of [CUT_L / 2, CUT_L / 2 + STUB_L]) {
      const ring = new THREE.Mesh(new THREE.RingGeometry(R_CU, R_INS, 64), insMat);
      ring.rotation.y = (s * Math.PI) / 2;
      ring.position.x = s * ex;
      const face = new THREE.Mesh(new THREE.CircleGeometry(R_CU, 64), copperSolid);
      face.rotation.y = (s * Math.PI) / 2;
      face.position.x = s * ex;
      if (ex === CUT_L / 2) {
        ring.rotation.y += Math.PI;
        face.rotation.y += Math.PI;
      }
      wireView.add(ring, face);
    }
  }
  const coreMat = new THREE.MeshPhysicalMaterial({
    color: 0xe0955c,
    metalness: 0.2,
    roughness: 0.25,
    transparent: true,
    opacity: 0.09,
    depthWrite: false,
  });
  const core = new THREE.Mesh(new THREE.CylinderGeometry(R_CU, R_CU, CUT_L, 64, 1, true), coreMat);
  core.rotation.z = Math.PI / 2;
  wireView.add(core);
  // cradles
  for (const x of [-1.3, 1.3]) {
    const base = beveledBox(0.26, WIRE_Y - R_INS - PL_H + 0.06, 0.62, materials.polymer(0x202328), 0.02);
    base.position.set(x, -(R_INS - 0.06) - (WIRE_Y - R_INS - PL_H + 0.06) / 2, 0);
    wireView.add(base);
  }
  // copper atoms: a fixed lattice
  const ionPos = [];
  {
    const sp = 0.17;
    for (let x = -CUT_L / 2 + 0.08; x <= CUT_L / 2 - 0.08; x += sp)
      for (let y = -R_CU; y <= R_CU; y += sp)
        for (let z = -R_CU; z <= R_CU; z += sp) {
          const oy = y + ((Math.round(x / sp) & 1) * sp) / 2;
          if (Math.hypot(oy, z) < R_CU - 0.05) ionPos.push([x, oy, z]);
        }
  }
  const ions = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.032, 14, 10),
    std(0xb87346, { metalness: 0.6, roughness: 0.38 }),
    ionPos.length,
  );
  ionPos.forEach((p, i) => {
    _m.makeTranslation(p[0], p[1], p[2]);
    ions.setMatrixAt(i, _m);
  });
  wireView.add(decor(ions));
  const ionMarker = new THREE.Object3D();
  {
    const p = ionPos.reduce((best, q) => (Math.abs(q[0] - 0.55) + Math.abs(q[1] - 0.12) + Math.abs(q[2] - 0.15) < Math.abs(best[0] - 0.55) + Math.abs(best[1] - 0.12) + Math.abs(best[2] - 0.15) ? q : best));
    ionMarker.position.set(...p);
    wireView.add(ionMarker);
  }
  // free electrons: a repeating pattern (period CELL) so the DC drift wraps
  const PER_CELL = 70;
  const eCell = [];
  {
    const r = rng(42);
    for (let i = 0; i < PER_CELL; i++) {
      const rr = Math.sqrt(r()) * (R_CU - 0.05);
      const a = r() * TAU;
      eCell.push([r() * CELL, Math.cos(a) * rr, Math.sin(a) * rr]);
    }
    eCell[0] = [CELL / 2, 0.1, 0.16]; // the tracked one, near the front
  }
  const NE = PER_CELL * 2;
  const electrons = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.027, 12, 8),
    new THREE.MeshBasicMaterial({ color: 0x3fa2ff }),
    NE,
  );
  electrons.frustumCulled = false;
  electrons.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  wireView.add(decor(electrons));
  const tracked = [0, 1].map(() => {
    const m = new THREE.Mesh(
      new THREE.SphereGeometry(0.038, 18, 12),
      new THREE.MeshBasicMaterial({ color: new THREE.Color(0xffa23c).multiplyScalar(1.15) }),
    );
    wireView.add(decor(m));
    return m;
  });
  const wireScreen = makeScreen(1.0, 0.5, 'WALL SOCKET', '230 V AC · 50 Hz');
  wireScreen.group.position.set(0, 1.62 - WIRE_Y, -0.82);
  wireScreen.group.rotation.x = -0.1;
  wireView.add(wireScreen.group);
  {
    const post = new THREE.Mesh(new THREE.CylinderGeometry(0.014, 0.014, 1.62 - 0.25 - PL_H, 10), materials.brushedSteel());
    post.position.set(0, (1.62 - 0.25 + PL_H) / 2 - WIRE_Y, -0.86);
    wireView.add(post);
  }
  const dirArrow = new THREE.Group(); // DC: which way the drift goes
  dirArrow.position.set(-0.55, R_INS + 0.1, 0.1);
  wireView.add(dirArrow);
  {
    const am = new THREE.MeshBasicMaterial({ color: new THREE.Color(0x6cc6ff).multiplyScalar(1.3) });
    const shaft = new THREE.Mesh(new THREE.CylinderGeometry(0.012, 0.012, 0.5, 10), am);
    shaft.rotation.z = Math.PI / 2;
    const head = new THREE.Mesh(new THREE.ConeGeometry(0.035, 0.09, 16), am);
    head.rotation.z = -Math.PI / 2;
    head.position.x = 0.29;
    dirArrow.add(shaft, head);
  }

  function applyWire() {
    const off = S.wire === 'ac' ? -SWING * Math.cos(TAU * S.t) : S.drift * CELL;
    for (let c = 0; c < 2; c++)
      for (let i = 0; i < PER_CELL; i++) {
        const [x0, y, z] = eCell[i];
        const x = frac((x0 + c * CELL + off) / CUT_L) * CUT_L - CUT_L / 2;
        const edge = smooth((CUT_L / 2 - Math.abs(x)) / 0.1);
        _m.compose(_v.set(x, y, z), _q, _s.setScalar(i === 0 ? 1e-5 : edge || 1e-5));
        electrons.setMatrixAt(c * PER_CELL + i, _m);
        if (i === 0) {
          tracked[c].position.set(x, y, z);
          tracked[c].scale.setScalar(edge || 1e-5);
        }
      }
    electrons.instanceMatrix.needsUpdate = true;
    dirArrow.visible = S.wire === 'dc';
    if (S.wire === 'ac') {
      wireScreen.title = 'WALL SOCKET';
      wireScreen.sub = '230 V AC · 50 Hz';
      wireScreen.draw(S.t, [{ fn: (x) => Math.sin(TAU * x), color: COL.ac }]);
    } else {
      wireScreen.title = 'BATTERY';
      wireScreen.sub = '12 V DC';
      wireScreen.draw(S.drift * 2, [{ fn: () => 0.6, color: COL.dc }]);
    }
  }

  // ===========================================================================
  // callouts
  // ===========================================================================
  labels.add('ups', inlet, 'AC in from the wall', [-0.12, 0.068, 0], 75, 70);
  labels.add('ups', ledGroup, 'Status lights', [0.02, CB + 0.13, 0.01], -70, 60);
  labels.add('ups', lamp, 'Lamp on the AC output', [-0.24, 0.98, 0.26], 80, 60);

  labels.add('ac', tracked[0], 'Free electron', [0, 0, 0], 70, 60);
  labels.add('ac', ionMarker, 'Copper atom (stays put)', [0, 0, 0], 25, 38);
  labels.add('ac', wireView, 'Insulation', [-(CUT_L / 2 + STUB_L / 2), 0.05, R_INS * 0.97], -55, 50);
  labels.add('dc', dirArrow, 'Electrons drift one way', [0.3, 0.0, 0], -25, 42);
  labels.add('dc', ionMarker, 'Copper atom (stays put)', [0, 0, 0], 25, 38);

  labels.add('map', dD1, 'Rectifier', [0.1, 0.08, 0], 120, 40);
  labels.add('map', capTops[1], 'DC bus capacitors', [0, 0.36, 0], 70, 40);
  labels.add('map', battery, 'Battery + charger', [0.35, 0.36, 0], 105, 34);
  labels.add('map', q2, 'Inverter switches', [0.0, 0.05, 0.05], -60, 44);
  labels.add('map', inductor, 'Output filter', [0, 0.05, 0], -30, 52);

  labels.add('bridge', dD1, 'D1', [0, 0.09, 0], 125, 34);
  labels.add('bridge', dD2, 'D2', [0, 0.09, 0], 60, 34);
  labels.add('bridge', dD3, 'D3', [0, 0.09, 0], 210, 34);
  labels.add('bridge', dD4, 'D4', [0, 0.09, 0], -30, 34);
  labels.add('bridge', board, '+ rail', [-0.35, 0.01, -RAIL_Z], 80, 34);
  labels.add('bridge', board, '− rail', [-0.35, 0.01, RAIL_Z], -80, 34);

  labels.add('caps', capTops[0], 'Reservoir capacitors', [0, 0.36, 0], 100, 40);
  labels.add('caps', charger, 'Battery charger', [0.05, 0.08, 0], 95, 46);

  labels.add('hbridge', q1, 'Q1', [0, 0.06, 0], 150, 30);
  labels.add('hbridge', q2, 'Q2', [0, 0.06, 0], 210, 30);
  labels.add('hbridge', q3, 'Q3', [0, 0.06, 0], 30, 30);
  labels.add('hbridge', q4, 'Q4', [0, 0.06, 0], -30, 30);
  labels.add('hbridge', wOut, 'To the lamp', [1.2, 0.2, -0.06], 70, 34);

  labels.add('pwm', inductor, 'Coil', [0, 0.06, 0], 120, 40);
  labels.add('pwm', filmCap, 'Film capacitor', [0, 0.06, 0], 60, 40);
  labels.add('pwm', controller, 'PWM controller', [0, 0.02, 0], -40, 34);

  // ===========================================================================
  // apply
  // ===========================================================================
  const fetMats = { q1: fets[0], q2: fets[1], q3: fets[2], q4: fets[3] };
  function fetStates() {
    const t = S.t;
    const f = frac(t);
    if (S.inv === 'square') return f < 0.5 ? [1, 0, 0, 1] : [0, 1, 1, 0];
    const p = pwmOn(t);
    return f < 0.5 ? [p ? 1 : 0, p ? 0 : 1, 0, 1] : [p ? 0 : 1, p ? 1 : 0, 1, 0];
  }

  function apply() {
    const isUps = S.view === 'ups';
    show(ups, isUps);
    show(lamp, isUps);
    show(lampCord, isUps);
    show(wireView, !isUps);
    if (!isUps) {
      applyWire();
      return;
    }
    const revealed = S.reveal > 0.5;
    show(cover, !revealed);
    show(screenRig, revealed);
    show(capGroup, S.caps > 0.5);
    rotor.rotation.x = S.fan;
    // status
    const onBatt = S.mains < 0.5;
    leds.line.emissiveIntensity = onBatt ? 0 : 2.4;
    leds.batt.emissiveIntensity = onBatt ? 2.4 : 0;
    leds.line.color.setHex(onBatt ? 0x1a2a1e : 0x9dffb8);
    leds.batt.color.setHex(onBatt ? 0xff9a1f : 0x2a2216);
    drawLcd(onBatt);
    bulbMat.emissiveIntensity = 2.2;
    if (!revealed) return;

    const C = currents();
    applyDots(C);
    // diode + switch glow
    const dg = S.flows.rect ? 1 : 0;
    diodes[0].emissiveIntensity = dg * 0.9 * C.D1[1];
    diodes[3].emissiveIntensity = dg * 0.9 * C.D4[1];
    diodes[1].emissiveIntensity = dg * 0.9 * C.D2[1];
    diodes[2].emissiveIntensity = dg * 0.9 * C.D3[1];
    const st = S.flows.inv ? fetStates() : [0, 0, 0, 0];
    [fetMats.q1, fetMats.q2, fetMats.q3, fetMats.q4].forEach((m, i) => (m.emissiveIntensity = st[i] * 0.55));
    const railGlow = (S.flows.rect || S.flows.bus) ? 0.18 : 0;
    cu.P.emissiveIntensity = railGlow;
    cu.M.emissiveIntensity = railGlow;
    cu.out.emissiveIntensity = S.flows.inv ? 0.25 * C.LO[1] : 0;
    cu.legA.emissiveIntensity = S.flows.inv ? 0.18 : 0;
    cu.legB.emissiveIntensity = S.flows.inv ? 0.18 : 0;
    cu.misc.emissiveIntensity = S.flows.rect ? 0.12 : 0;
    for (const sc of screens) show(sc.rig, !!S.screens[sc.index]);
    drawScreens();
  }

  function setMode(partial) {
    Object.assign(S, partial);
    apply();
  }
  apply();

  return {
    group: root,
    set(partial) {
      Object.assign(S, partial);
      apply();
    },
    setMode,
    setLabels(which) {
      labels.setLabels(which || null);
    },
    parts: { ups, cover, board, wireView, electrons, tracked, rotor, screens, S },
  };
}
