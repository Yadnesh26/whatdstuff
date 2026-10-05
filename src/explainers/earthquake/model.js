import * as THREE from 'three';
import { studioPlinth, materials } from '../../framework/parts.js';
import { beveledBox } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';

// "How an earthquake works" — a block of crust cut out around a vertical
// strike-slip fault (the San Andreas kind), standing on the studio plinth.
// Nothing here spins; the mechanism is a field. The crust BENDS while the
// fault is locked, SNAPS back when friction gives (elastic rebound, Reid
// 1910), and the stored energy leaves as P, S and surface waves.
//
// Reference facts (USGS "Elastic Rebound", USGS "Fault Slip Rates",
// Wikipedia "Earthquake rupture" / "P wave" / "Seismic velocity structure",
// OpenText Physical Geology 9.1):
//  - San Andreas creep ~3.5 cm/yr (60-75% of the ~5 cm/yr plate rate).
//  - Hypocentres of crustal quakes 5-15 km deep; seismogenic layer ~15 km.
//  - Rupture front ~0.92 Vs, typically 2.5-3.5 km/s.
//  - P ~6 km/s, S ~3.5 km/s in crustal rock; surface (Rayleigh) ~0.92 Vs.
//    Distance ~ 8.4 km per second of S-minus-P delay (Vp*Vs/(Vp-Vs)).
//
// SCALE: 1 unit = 10 km. Block 44 km across the fault (x), 30 km along it
// (z), 15 km deep (y). Hypocentre 10 km down, directly under the epicentre.
// Times are simulated seconds (`tau`), so every speed below is km/s / 10.
//
// DISCLOSED CHEATS
//  1. Displacement is exaggerated ~500x: one quake offsets the fence lines by
//     SLIP = 0.25 units (2.5 km) where a real big one moves ~5 m.
//  2. Reference frame: the WEST (x<0) side is held still and the east side
//     creeps past it. Only relative motion is physical; this frame is what
//     lets the loop close (below). Step 2's hint says so.
//  3. Only the surface markers show the offset — the rock volume is uniform
//     along strike, so the block's end faces stay flush.
//
// SEAMLESS LOOP: the farmland texture repeats every PERIOD along z with ONE
// fence line per period. Each quake slips PERIOD/2 — so after one quake the
// fences on the east side land exactly between the west ones (clearly
// offset), and after TWO quakes they line up again, identical to the start.
// So every full-cycle lap runs two complete earthquake cycles.

const HX = 2.2; // half-width across the fault (22 km)
const HZ = 1.5; // half-length along strike (15 km)
const DEPTH = 1.5; // 15 km
const Y0 = 0.2; // plinth top = block bottom
const YT = Y0 + DEPTH; // ground surface
const HYPO = new THREE.Vector3(0, YT - 1.0, 0); // 10 km down
const HD = YT - HYPO.y;

const PERIOD = 0.5; // farmland repeat along z (one fence per period)
const SLIP = PERIOD / 2; // per quake (exaggerated — see header)
const LOCK = 0.36; // width of the elastic bend (locking-depth scale)

const VP = 0.6; // 6 km/s
const VS = 0.35; // 3.5 km/s
const VR = 0.27; // surface waves, ~0.92 Vs rounded down
const VRUP = 0.3; // rupture front, 3 km/s

// The seismometer: near the back-right corner so the section view (front half
// hidden) keeps it. 18.7 km from the hypocentre -> S arrives 2.2 s after P.
const STATION = new THREE.Vector3(1.3, YT, -0.9);
const ST_EPI = Math.hypot(STATION.x, STATION.z);
const ST_HYPO = Math.hypot(ST_EPI, HD);
const T_P = ST_HYPO / VP;
const T_S = ST_HYPO / VS;
const T_R = ST_EPI / VR;

// --- procedural maps ---------------------------------------------------------

// deterministic hash noise so every build paints the same rock
function rng(seed) {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function strataMap() {
  const W = 128;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const r = rng(7);
  // canvas row 0 = v 1 = ground surface. Soil, then ~4 km of layered
  // sediment, then crystalline basement to the bottom of the seismogenic layer.
  const bands = [
    [0.0, 0.025, '#3a2a1d'],
    [0.025, 0.07, '#8b6a47'],
    [0.07, 0.1, '#a58759'],
    [0.1, 0.155, '#6f5a47'],
    [0.155, 0.19, '#b08f63'],
    [0.19, 0.24, '#7d624a'],
    [0.24, 0.27, '#9a7a56'],
    [0.27, 1.0, '#6e6661'],
  ];
  for (const [a, b, col] of bands) {
    ctx.fillStyle = col;
    ctx.fillRect(0, a * H, W, (b - a) * H + 1);
  }
  // wavy bedding lines, so the boundaries aren't ruler-straight
  for (let k = 1; k < bands.length; k++) {
    const y0 = bands[k][0] * H;
    ctx.strokeStyle = 'rgba(30,20,12,0.35)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    for (let x = 0; x <= W; x += 4) {
      const y = y0 + Math.sin((x / W) * TAU * 2 + k) * 1.5;
      if (x === 0) ctx.moveTo(x, y);
      else ctx.lineTo(x, y);
    }
    ctx.stroke();
  }
  // grain: granite speckle in the basement, fine grit above
  for (let i = 0; i < 4500; i++) {
    const x = r() * W;
    const y = r() * H;
    const deep = y / H > 0.27;
    const v = r();
    if (deep) {
      ctx.fillStyle =
        v < 0.35 ? 'rgba(20,18,18,0.3)' : v < 0.7 ? 'rgba(190,160,150,0.22)' : 'rgba(230,225,215,0.18)';
      ctx.fillRect(x, y, 1.6, 1.6);
    } else {
      ctx.fillStyle = v < 0.5 ? 'rgba(0,0,0,0.12)' : 'rgba(255,240,210,0.08)';
      ctx.fillRect(x, y, 1, 1);
    }
  }
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

// One PERIOD of farmland along v: a green field, a wheat field, and ONE fence
// line (at v = 0). Crop rows run across the fault, along x.
function farmMap() {
  const W = 256;
  const H = 512;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  const r = rng(11);
  ctx.fillStyle = '#56773a';
  ctx.fillRect(0, 0, W, H / 2);
  ctx.fillStyle = '#b3985a';
  ctx.fillRect(0, H / 2, W, H / 2);
  // crop rows
  for (let y = 6; y < H; y += 12) {
    ctx.fillStyle = y < H / 2 ? 'rgba(30,55,20,0.35)' : 'rgba(120,90,40,0.35)';
    ctx.fillRect(0, y, W, 3);
  }
  for (let i = 0; i < 6000; i++) {
    const x = r() * W;
    const y = r() * H;
    ctx.fillStyle = r() < 0.5 ? 'rgba(0,0,0,0.1)' : 'rgba(255,255,220,0.08)';
    ctx.fillRect(x, y, 2, 2);
  }
  // the fence: a dark hedge line with posts, straddling v = 0 (wraps)
  const fence = (y) => {
    ctx.fillStyle = '#2b2116';
    ctx.fillRect(0, y - 11, W, 22);
    ctx.fillStyle = '#efe4cc';
    ctx.fillRect(0, y - 2.5, W, 5);
  };
  fence(0);
  fence(H);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.anisotropy = 8;
  return tex;
}

function screenMap() {
  const W = 512;
  const H = 160;
  const c = document.createElement('canvas');
  c.width = W;
  c.height = H;
  const ctx = c.getContext('2d');
  ctx.fillStyle = '#0a121a';
  ctx.fillRect(0, 0, W, H);
  ctx.strokeStyle = 'rgba(120,170,200,0.12)';
  ctx.lineWidth = 1;
  for (let x = 0; x <= W; x += 32) {
    ctx.beginPath();
    ctx.moveTo(x + 0.5, 0);
    ctx.lineTo(x + 0.5, H);
    ctx.stroke();
  }
  for (let y = 0; y <= H; y += 32) {
    ctx.beginPath();
    ctx.moveTo(0, y + 0.5);
    ctx.lineTo(W, y + 0.5);
    ctx.stroke();
  }
  ctx.strokeStyle = 'rgba(150,200,230,0.25)';
  ctx.beginPath();
  ctx.moveTo(0, H / 2 + 0.5);
  ctx.lineTo(W, H / 2 + 0.5);
  ctx.stroke();
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  return tex;
}

// --- wave maths --------------------------------------------------------------

// derivative-of-gaussian: one push then one pull, peak 1 at s = +-1
const dw = (s) => s * Math.exp(0.5 * (1 - s * s));
const g = (x) => 0.5 + Math.atan(x / LOCK) / Math.PI; // elastic bend profile

// slip on the fault as the rupture front passes: smooth arrival plus a small
// dynamic overshoot that settles (<= 4% of travel, one swing)
function slipRamp(x) {
  const s = smooth(clamp01(x));
  const o = 0.04 * Math.sin(Math.PI * clamp01((x - 1) / 1.6));
  return s + o;
}

function burst(tau, t0, freq, decay, amp) {
  if (tau < t0) return 0;
  const d = tau - t0;
  return amp * Math.sin(TAU * freq * d) * smooth(d / 0.25) * Math.exp(-Math.max(0, d - 0.3) / decay);
}

// ground motion at the station — what the pen draws
function stationSignal(tau) {
  if (tau < 0) return 0;
  const v =
    burst(tau, T_P, 1.5, 0.55, 0.22) + burst(tau, T_S, 0.9, 0.9, 0.5) + burst(tau, T_R, 0.42, 1.3, 0.95);
  return Math.max(-1, Math.min(1, v));
}

// --- the build ---------------------------------------------------------------

export function buildEarthquake({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const plinth = studioPlinth({ w: 5.4, h: Y0, d: 4.1 });
  plinth.position.z = -0.2;
  group.add(plinth);

  const strata = strataMap();
  const farm = farmMap();

  function rockSet() {
    const side = new THREE.MeshStandardMaterial({ map: strata, roughness: 0.92, metalness: 0 });
    const top = new THREE.MeshStandardMaterial({ map: farm, vertexColors: true, roughness: 0.95, metalness: 0 });
    const bottom = new THREE.MeshStandardMaterial({ color: 0x2a2521, roughness: 1 });
    // BoxGeometry face order: px, nx, py, ny, pz, nz
    return { list: [side, side, top, bottom, side, side], unique: [side, top, bottom] };
  }
  const west = rockSet();
  const east = rockSet();

  // Four quadrants: W/E of the fault x = 0, back/front of the section z = 0.
  // Positions are baked into world space so the deform loop reads them as-is.
  const quads = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) {
      const geo = new THREE.BoxGeometry(HX, DEPTH, HZ, 44, 1, 30);
      geo.translate((sx * HX) / 2, Y0 + DEPTH / 2, (sz * HZ) / 2);
      const n = geo.attributes.position.count;
      const colors = new Float32Array(n * 3).fill(1);
      geo.setAttribute('color', new THREE.BufferAttribute(colors, 3));
      const base = geo.attributes.position.array.slice();
      const nrm = geo.attributes.normal.array;
      const top = [];
      const edge = [];
      for (let i = 0; i < n; i++) {
        if (Math.abs(base[i * 3 + 1] - YT) < 1e-5) edge.push(i);
        if (nrm[i * 3 + 1] > 0.9) top.push(i);
      }
      const mesh = new THREE.Mesh(geo, sx < 0 ? west.list : east.list);
      mesh.castShadow = true;
      mesh.receiveShadow = true;
      group.add(mesh);
      quads.push({ mesh, geo, base, top, edge, east: sx > 0, front: sz > 0 });
    }
  }

  // --- overlays: rupture patch on the fault face, wave rings on the section --

  const ruptureMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { uR: { value: 0 }, uFill: { value: 0 }, uRim: { value: 0 }, uHy: { value: HYPO.y } },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uR, uFill, uRim, uHy;
      varying vec3 vW;
      void main() {
        float r = length(vec2(vW.z, vW.y - uHy));
        float inside = 1.0 - smoothstep(uR - 0.04, uR, r);
        // faint slip contours inside the patch, like a finite-fault slip map
        float contour = 0.5 + 0.5 * cos(r * 34.0);
        float rim = exp(-pow((r - uR) / 0.03, 2.0)) * uRim;
        vec3 fill = mix(vec3(0.78, 0.22, 0.06), vec3(0.92, 0.42, 0.12), contour * 0.6);
        vec3 col = fill * inside * uFill * 0.9 + vec3(1.0, 0.75, 0.4) * rim;
        float a = clamp(inside * uFill * (0.5 + 0.12 * contour) + rim * 0.95, 0.0, 1.0);
        if (a < 0.003) discard;
        gl_FragColor = vec4(col / max(a, 0.001), a);
      }`,
  });
  const rupturePlane = new THREE.Mesh(new THREE.PlaneGeometry(2 * HZ, DEPTH), ruptureMat);
  rupturePlane.rotation.y = Math.PI / 2; // face +x, looking into the east half
  rupturePlane.position.set(0.004, Y0 + DEPTH / 2, 0);
  rupturePlane.renderOrder = 2;
  group.add(rupturePlane);

  const waveMat = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uP: { value: 0 },
      uS: { value: 0 },
      uA: { value: 0 },
      uHy: { value: HYPO.y },
      uTop: { value: YT - 0.06 },
    },
    vertexShader: /* glsl */ `
      varying vec3 vW;
      void main() {
        vec4 w = modelMatrix * vec4(position, 1.0);
        vW = w.xyz;
        gl_Position = projectionMatrix * viewMatrix * w;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uP, uS, uA, uHy, uTop;
      varying vec3 vW;
      void main() {
        if (vW.y > uTop) discard;
        float r = length(vec2(vW.x, vW.y - uHy));
        float p = exp(-pow((r - uP) / 0.035, 2.0));
        float s = exp(-pow((r - uS) / 0.05, 2.0));
        // soft wake behind each front, so the ring reads as a travelling shell
        float pw = exp(-pow((r - uP + 0.12) / 0.12, 2.0)) * 0.25;
        float sw = exp(-pow((r - uS + 0.15) / 0.15, 2.0)) * 0.3;
        vec3 col = vec3(0.35, 0.85, 0.92) * (p + pw) + vec3(1.0, 0.62, 0.26) * (s + sw);
        float a = clamp((p * 0.85 + pw + s * 0.9 + sw) * uA, 0.0, 1.0);
        if (a < 0.003) discard;
        gl_FragColor = vec4(col / max(p + pw + s + sw, 0.001), a);
      }`,
  });
  const wavePlane = new THREE.Mesh(new THREE.PlaneGeometry(2 * HX, DEPTH), waveMat);
  wavePlane.position.set(0, Y0 + DEPTH / 2, 0.004);
  wavePlane.renderOrder = 2;
  group.add(wavePlane);

  // rock "particles" on the section: they show HOW each wave moves the rock
  const dotXs = [];
  for (let x = -2.1; x <= 2.1001; x += 0.12) dotXs.push(x);
  const dotYs = [];
  for (let y = Y0 + 0.07; y <= YT - 0.07; y += 0.12) dotYs.push(y);
  const DOTS = dotXs.length * dotYs.length;
  const dotMat = new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.45, metalness: 0 });
  const dots = new THREE.InstancedMesh(new THREE.SphereGeometry(0.017, 10, 8), dotMat, DOTS);
  dots.renderOrder = 3;
  const dotBase = [];
  for (const y of dotYs) for (const x of dotXs) dotBase.push([x, y]);
  const dm = new THREE.Matrix4();
  const dc = new THREE.Color();
  for (let i = 0; i < DOTS; i++) {
    dm.makeTranslation(dotBase[i][0], dotBase[i][1], 0.03);
    dots.setMatrixAt(i, dm);
    dots.setColorAt(i, dc.setRGB(0.85, 0.82, 0.76));
  }
  group.add(dots);

  // hypocentre + epicentre markers
  const hypo = new THREE.Mesh(
    new THREE.SphereGeometry(0.04, 20, 14),
    new THREE.MeshBasicMaterial({ color: 0xffc07a }),
  );
  hypo.position.copy(HYPO);
  group.add(hypo);
  const epi = new THREE.Mesh(
    new THREE.RingGeometry(0.05, 0.08, 40),
    new THREE.MeshBasicMaterial({ color: 0xffb066, side: THREE.DoubleSide, transparent: true, depthWrite: false }),
  );
  epi.rotation.x = -Math.PI / 2;
  epi.position.set(0, YT + 0.012, 0);
  group.add(epi);

  // plate-motion arrow on the moving (east) side
  const arrowShape = new THREE.Shape();
  arrowShape.moveTo(-0.045, -0.45);
  arrowShape.lineTo(0.045, -0.45);
  arrowShape.lineTo(0.045, 0.28);
  arrowShape.lineTo(0.12, 0.28);
  arrowShape.lineTo(0, 0.5);
  arrowShape.lineTo(-0.12, 0.28);
  arrowShape.lineTo(-0.045, 0.28);
  arrowShape.closePath();
  const arrowGeo = new THREE.ExtrudeGeometry(arrowShape, {
    depth: 0.025,
    bevelEnabled: true,
    bevelThickness: 0.008,
    bevelSize: 0.008,
    bevelSegments: 2,
  });
  const arrowMat = new THREE.MeshStandardMaterial({
    color: 0xe07a4a,
    emissive: 0xe07a4a,
    emissiveIntensity: 0.35,
    roughness: 0.5,
  });
  const plateArrow = new THREE.Mesh(arrowGeo, arrowMat);
  // shape lies in XY pointing +y; lay it flat pointing +z
  plateArrow.rotation.x = Math.PI / 2;
  plateArrow.position.set(1.55, YT + 0.1, 0);
  plateArrow.castShadow = true;
  group.add(plateArrow);

  // seismometer: a small vault puck with a mast, on the surface
  const station = new THREE.Group();
  const stationMat = materials.paintedMetal(0xd9dde2);
  stationMat.roughness = 0.5;
  const puck = new THREE.Mesh(new THREE.CylinderGeometry(0.055, 0.065, 0.035, 28), stationMat);
  puck.position.y = 0.0175;
  const mast = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 0.12, 8), stationMat);
  mast.position.set(0.03, 0.09, 0);
  const lamp = new THREE.Mesh(new THREE.SphereGeometry(0.014, 12, 8), new THREE.MeshBasicMaterial({ color: 0xffb35c }));
  lamp.position.set(0.03, 0.155, 0);
  station.add(puck, mast, lamp);
  station.traverse((o) => (o.castShadow = true));
  station.position.copy(STATION);
  group.add(station);

  // seismogram display: a dark instrument card on a slim stand behind the block
  const CARD_W = 1.9;
  const CARD_H = 0.62;
  const card = new THREE.Group();
  card.position.set(1.0, YT + 0.92, -HZ - 0.32);
  const bezelMat = materials.paintedMetal(0x1c1f24);
  bezelMat.roughness = 0.6;
  bezelMat.clearcoat = 0.2;
  const bezel = beveledBox(CARD_W, CARD_H, 0.05, bezelMat, 0.015);
  bezel.castShadow = true;
  card.add(bezel);
  const screen = new THREE.Mesh(
    new THREE.PlaneGeometry(CARD_W - 0.1, CARD_H - 0.1),
    new THREE.MeshStandardMaterial({ map: screenMap(), roughness: 0.35, metalness: 0 }),
  );
  screen.position.z = 0.026;
  card.add(screen);
  const TW = CARD_W - 0.18;
  const N = 360;
  const tracePos = new Float32Array(N * 2 * 3);
  const traceIdx = [];
  for (let k = 0; k < N - 1; k++) {
    const a = k * 2;
    traceIdx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
  }
  const traceGeo = new THREE.BufferGeometry();
  traceGeo.setAttribute('position', new THREE.BufferAttribute(tracePos, 3));
  traceGeo.setIndex(traceIdx);
  const trace = new THREE.Mesh(traceGeo, new THREE.MeshBasicMaterial({ color: 0xffb35c, side: THREE.DoubleSide }));
  trace.position.z = 0.03;
  trace.frustumCulled = false;
  card.add(trace);
  const pen = new THREE.Mesh(new THREE.SphereGeometry(0.018, 14, 10), new THREE.MeshBasicMaterial({ color: 0xffe0b0 }));
  pen.position.z = 0.034;
  card.add(pen);
  const standMat = materials.brushedSteel();
  standMat.roughness = 0.6;
  const standH = card.position.y - CARD_H / 2 - Y0;
  const stand = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, standH, 16), standMat);
  stand.position.set(0, -CARD_H / 2 - standH / 2, -0.03);
  stand.castShadow = true;
  card.add(stand);
  const foot = new THREE.Mesh(new THREE.CylinderGeometry(0.12, 0.14, 0.02, 32), standMat);
  foot.position.set(0, -CARD_H / 2 - standH + 0.01, -0.03);
  card.add(foot);
  group.add(card);

  // --- callout anchors -------------------------------------------------
  // Every label below rides a mesh (or a small dedicated marker) with REAL
  // geometry, never a bare point on `group` — a zero-size bounding box is
  // invisible to the eye in the live app (the camera is hand-authored per
  // step), but scripts/export-video.mjs solves each shot's camera FROM the
  // named callout's world bounds, and a degenerate box collapses that solve
  // to camera-distance zero, i.e. the camera lands INSIDE the block. These
  // markers are tiny and undraws-nothing to the eye; they exist for framing.
  const markerMat = new THREE.MeshBasicMaterial({ color: 0xffb35c, transparent: true, opacity: 0 });
  const faultMark = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), markerMat);
  faultMark.position.set(0, YT, 1.0);
  group.add(faultMark);
  const slipMark = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), markerMat);
  slipMark.position.set(0.01, HYPO.y + 0.45, -0.75);
  group.add(slipMark);
  const lockedMark = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), markerMat);
  lockedMark.position.set(0, YT, 0.55);
  group.add(lockedMark);
  const bendMark = new THREE.Mesh(new THREE.SphereGeometry(0.05, 10, 8), markerMat);
  bendMark.position.set(0.4, YT, -0.6);
  group.add(bendMark);
  const pAnchor = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), markerMat);
  const sAnchor = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), markerMat);
  const rAnchor = new THREE.Mesh(new THREE.SphereGeometry(0.035, 10, 8), markerMat);
  group.add(pAnchor, sAnchor, rAnchor);

  // --- callouts ------------------------------------------------------------
  const labels = calloutSets(['exterior', 'strain', 'rupture', 'waves', 'surface']);
  labels.add('exterior', faultMark, 'Fault line', [0, 0, 0], 70, 56);
  labels.add('exterior', plateArrow, 'Plate creeping · ~3.5 cm/yr', [0, 0.5, 0.03], 35, 52);
  labels.add('strain', lockedMark, 'Locked fault', [0, 0, 0], 75, 60);
  labels.add('strain', bendMark, 'Rock bending · storing strain', [0, 0, 0], 25, 60);
  labels.add('rupture', hypo, 'Hypocentre · ~10 km down', [0.02, 0, 0], -20, 60);
  labels.add('rupture', slipMark, 'Slip spreads · ~3 km/s', [0, 0, 0], 35, 56);
  labels.add('rupture', epi, 'Epicentre', [0, 0, 0], 80, 58);
  labels.add('waves', pAnchor, 'P wave · ~6 km/s', [0, 0, 0], 50, 56);
  labels.add('waves', sAnchor, 'S wave · ~3.5 km/s', [0, 0, 0], -30, 60);
  labels.add('waves', station, 'Seismometer · 19 km away', [0, 0.16, 0], 115, 50);
  labels.add('waves', card, 'Seismogram', [CARD_W / 2 - 0.1, CARD_H / 2, 0.03], 40, 40);
  labels.add('surface', rAnchor, 'Surface waves', [0, 0, 0], 55, 60);
  labels.add('surface', epi, 'Epicentre ', [0, 0, 0], 110, 56);

  // --- state ---------------------------------------------------------------
  // cycle   0..1 lap phase (the ONLY thing a timeline tweens)
  // loadFrac  share of each earthquake cycle spent loading; 0 = event-only
  //           (fences held straight-and-offset, only the waves run)
  // span    simulated seconds of event per cycle
  // reveal  'none' | 'fault' (east half ghosted) | 'section' (front half hidden)
  const state = {
    cycle: 0,
    loadFrac: 0.62,
    span: 14,
    reveal: 'none',
    heat: 0,
    trace: 0,
    arrows: 1,
    epi: 0,
  };

  // Two earthquake cycles per lap (see header). Returns total far-field
  // displacement D, the settled slip `base`, and event time tau (-1 = loading).
  function phaseAt(c) {
    const cc = ((c % 1) + 1) % 1;
    const sub = Math.floor(cc * 2);
    const f = cc * 2 - sub;
    if (state.loadFrac <= 0) {
      return { D: SLIP, base: 0, tau: f * state.span, f, event: true, fixed: true };
    }
    const lf = state.loadFrac;
    const base = sub * SLIP;
    if (f < lf) return { D: base + (SLIP * f) / lf, base, tau: -1, f, event: false, fixed: false };
    return { D: base + SLIP, base, tau: ((f - lf) / (1 - lf)) * state.span, f, event: true, fixed: false };
  }

  function sigmaAt(z, ph) {
    if (ph.fixed) return SLIP;
    if (!ph.event) return ph.base;
    const rz = Math.hypot(z, HD);
    return ph.base + SLIP * slipRamp((VRUP * ph.tau - rz) / 0.14);
  }

  function surfH(x, z, tau) {
    if (tau < 0) return 0;
    const rho = Math.hypot(x, z);
    const s = rho - VR * tau;
    const env = smooth((tau - 0.8) / 1.6);
    if (env <= 0) return 0;
    return (0.05 * env * Math.sin((TAU * s) / 0.34) * Math.exp(-((s / 0.3) ** 2))) / Math.sqrt(1 + rho);
  }

  function setGhost(set, on) {
    for (const m of set.unique) {
      const want = on ? 0.16 : 1;
      if (m.transparent !== on) {
        m.transparent = on;
        m.depthWrite = !on;
        m.needsUpdate = true;
      }
      m.opacity = want;
    }
  }

  const tmp = new THREE.Vector3();
  let revealApplied = null;

  function apply() {
    const ph = phaseAt(state.cycle);
    const tau = ph.tau;

    // reveal
    if (revealApplied !== state.reveal) {
      revealApplied = state.reveal;
      setGhost(east, state.reveal === 'fault');
      for (const q of quads) {
        q.mesh.visible = !(state.reveal === 'section' && q.front);
        q.mesh.castShadow = !(state.reveal === 'fault' && q.east);
      }
    }

    // crust: surface ripple on every top-edge vertex; fence-line bend, strain
    // tint and the fault seam on the top face
    const sigCache = new Map();
    for (const q of quads) {
      if (!q.mesh.visible) continue;
      const pos = q.geo.attributes.position;
      const uv = q.geo.attributes.uv;
      const col = q.geo.attributes.color;
      const b = q.base;
      for (const i of q.edge) {
        pos.array[i * 3 + 1] = YT + surfH(b[i * 3], b[i * 3 + 2], tau);
      }
      for (const i of q.top) {
        const x = b[i * 3];
        const z = b[i * 3 + 2];
        let sg = sigCache.get(z);
        if (sg === undefined) {
          sg = sigmaAt(z, ph);
          sigCache.set(z, sg);
        }
        const deficit = ph.D - sg;
        const u = sg * (q.east ? 1 : 0) + deficit * g(x);
        uv.setXY(i, (x + HX) / 1.1, (z - u) / PERIOD);
        const heat = state.heat * clamp01(deficit / SLIP) / (1 + 0.5 * (x / LOCK) ** 2);
        const seam = Math.abs(x) < 1e-4 ? 0.45 : 1;
        // vertex colour MULTIPLIES the field map, so red has to push R up and
        // crush G/B hard or it just reads as a darker field
        col.setXYZ(i, seam * (1 + 0.6 * heat), seam * (1 - 0.72 * heat), seam * (1 - 0.8 * heat));
      }
      pos.needsUpdate = true;
      uv.needsUpdate = true;
      col.needsUpdate = true;
      q.geo.computeVertexNormals();
    }

    // rupture patch on the fault face
    const onFault = state.reveal === 'fault';
    rupturePlane.visible = onFault;
    if (onFault) {
      let R = 0;
      let fill = 0;
      if (ph.event) {
        R = VRUP * tau;
        fill = ph.fixed ? 1 - smooth((ph.f - 0.8) / 0.2) : 1;
      } else {
        // last quake's patch fading out through the first half of the loading
        R = 3;
        fill = 1 - smooth(ph.f / (state.loadFrac * 0.5));
      }
      ruptureMat.uniforms.uR.value = R;
      ruptureMat.uniforms.uFill.value = fill;
      ruptureMat.uniforms.uRim.value = ph.event ? 1 - smooth((R - 1.7) / 0.2) : 0;
    }

    // waves on the section
    const onSection = state.reveal === 'section';
    wavePlane.visible = onSection;
    dots.visible = onSection;
    const onset = tau < 0 ? 0 : smooth(tau / 0.4);
    const rp = VP * Math.max(tau, 0);
    const rs = VS * Math.max(tau, 0);
    if (onSection) {
      waveMat.uniforms.uP.value = rp;
      waveMat.uniforms.uS.value = rs;
      waveMat.uniforms.uA.value = onset;
      for (let i = 0; i < DOTS; i++) {
        const [x0, y0] = dotBase[i];
        const dx = x0;
        const dy = y0 - HYPO.y;
        const r = Math.hypot(dx, dy) || 1e-6;
        const nx = dx / r;
        const ny = dy / r;
        const decay = onset / (1 + 1.2 * r);
        const aP = dw((r - rp) / 0.1) * 0.055 * decay;
        const aS = dw((r - rs) / 0.12) * 0.09 * decay;
        // surface-wave roll near the top: vertical + a quarter-phase horizontal
        const depthFade = Math.exp(-(YT - y0) / 0.35);
        const hR = tau < 0 ? 0 : surfH(x0, 0, tau) * depthFade * 1.4;
        const hRx = tau < 0 ? 0 : surfH(x0 + 0.085, 0, tau) * depthFade * 1.0;
        const px = x0 + nx * aP - ny * aS + hRx;
        const py = y0 + ny * aP + nx * aS + hR;
        dm.makeTranslation(px, py, 0.03);
        dots.setMatrixAt(i, dm);
        const wp = Math.min(1, Math.abs(aP) / 0.03);
        const ws = Math.min(1, Math.abs(aS) / 0.05);
        dc.setRGB(0.85 - 0.5 * wp + 0.15 * ws, 0.82 + 0.03 * wp - 0.2 * ws, 0.76 + 0.16 * wp - 0.5 * ws);
        dots.setColorAt(i, dc);
      }
      dots.instanceMatrix.needsUpdate = true;
      dots.instanceColor.needsUpdate = true;
    }

    // markers
    hypo.visible = state.reveal !== 'none';
    const flash = tau >= 0 ? Math.exp(-tau / 0.5) : 0;
    hypo.scale.setScalar(1 + 1.6 * flash);
    epi.visible = state.epi > 0;
    epi.position.y = YT + 0.012 + surfH(0, 0, tau);
    plateArrow.visible = state.arrows > 0;
    station.position.y = YT + surfH(STATION.x, STATION.z, tau);

    // moving callout anchors ride their fronts, clamped inside the section
    const ride = (anchor, r, ang) => {
      const cx = Math.cos(ang);
      const cy = Math.sin(ang);
      let lim = (HX - 0.08) / Math.abs(cx || 1e-6);
      lim = Math.min(lim, cy > 0 ? (YT - 0.08 - HYPO.y) / cy : cy < 0 ? (HYPO.y - Y0 - 0.08) / -cy : 99);
      const rr = Math.min(Math.max(r, 0.12), lim);
      anchor.position.set(cx * rr, HYPO.y + cy * rr, 0.035);
    };
    ride(pAnchor, rp, (40 * Math.PI) / 180);
    ride(sAnchor, rs, (8 * Math.PI) / 180);
    const rho = Math.min(Math.max(VR * Math.max(tau, 0) - 0.05, 0.25), 2.0);
    const ra = (18 * Math.PI) / 180;
    tmp.set(rho * Math.cos(ra), 0, rho * Math.sin(ra));
    rAnchor.position.set(tmp.x, YT + surfH(tmp.x, tmp.z, tau) + 0.01, tmp.z);

    // seismogram: a scrolling window of the station signal. Sampled off the
    // SAME periodic lap phase, so the trace at lap end equals lap start.
    card.visible = state.trace > 0;
    if (card.visible) {
      const W = 0.34;
      const ys = new Float32Array(N);
      for (let k = 0; k < N; k++) {
        const c = state.cycle - W + (k / (N - 1)) * W;
        const p = phaseAt(c);
        const noise =
          0.018 * Math.sin(TAU * 97 * c) + 0.012 * Math.sin(TAU * 211 * c + 1.3) + 0.008 * Math.sin(TAU * 389 * c);
        ys[k] = (stationSignal(p.tau) + noise) * (CARD_H * 0.36);
      }
      const dxs = TW / (N - 1);
      for (let k = 0; k < N; k++) {
        const x = -TW / 2 + k * dxs;
        const y0 = ys[k];
        const dyd = (ys[Math.min(N - 1, k + 1)] - ys[Math.max(0, k - 1)]) / (2 * dxs);
        const inv = 1 / Math.sqrt(1 + dyd * dyd);
        const hw = 0.0065;
        const ox = -dyd * inv * hw;
        const oy = inv * hw;
        tracePos.set([x + ox, y0 + oy, 0, x - ox, y0 - oy, 0], k * 6);
      }
      traceGeo.attributes.position.needsUpdate = true;
      pen.position.set(TW / 2, ys[N - 1], 0.034);
    }
  }
  apply();

  return {
    group,
    state,
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
    parts: {
      quads: quads.map((q) => q.mesh),
      rupturePlane,
      wavePlane,
      dots,
      hypo,
      epi,
      plateArrow,
      station,
      card,
    },
  };
}
