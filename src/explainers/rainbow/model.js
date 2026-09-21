import * as THREE from 'three';
import { materials, rod } from '../../framework/parts.js';
import { beveledBox } from '../../framework/geometry.js';
import { clamp01, smooth, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A rainbow, built out of the only three things that actually make one: a
// low sun, a volume of falling water, and one observer.
//
// NOTHING HERE IS A PAINTED ARC. Every colour in this scene is computed from
// the real optics, twice over:
//
//   * `traceDrop()` is a genuine Snell/Fresnel ray trace through a spherical
//     drop — refract in, reflect k times off the inside wall, refract out.
//     The beams drawn inside the macro drop are that trace's polyline.
//   * `bowColour()` colours every raindrop in the field purely by the angle
//     between (drop - eye) and the antisolar axis. Drops sitting at 42.4°
//     come back red; at 40.7°, violet; between 42.4° and 50.3° nothing comes
//     back at all, which is Alexander's dark band. Nobody placed a band.
//
// Because both come from the same constants, the bow moves correctly on its
// own when the observer walks forward (step 6) or the sun climbs (step 8) —
// and it vanishes above a 42° sun without a line of code saying so.
//
// SCALE: 1 world unit = roughly 1 metre of a scene about 20 m deep.
//   observer eye height           1.15u   (a camera on a tripod)
//   rain curtain                  18 x 8 x 7u, standing 5.5–12.5u away
//   bow radius at the curtain     ~7.4u   (42° at ~9.6u slant range)
// The macro drop is a deliberate, disclosed scale break: a real raindrop is
// 0.5–2 mm across, drawn here at 1.7u so the ray path inside it is readable.
//
// SEAMLESS LOOP: `fall` counts whole curtain-heights per lap (every drop
// lands exactly where its neighbour started, so the field is identical at
// wrap), `flow` counts whole packet cycles along each beam path, and `walk`
// and `sunEl` are driven by out-and-back cosines that return to their start.
//
// ONE pose function, `set()`, drives all of it from ONE state object.

// --- optics constants ------------------------------------------------------
// Refractive index of water at the two ends of the visible band. These two
// numbers, 1% apart, ARE the rainbow: everything below is derived from them.
const N_RED = 1.331; // ~700 nm
const N_VIOLET = 1.343; // ~400 nm
const DEG = 180 / Math.PI;

// Impact parameter (sin of the incidence angle) of the ray of MINIMUM
// deviation — the Descartes ray — for k internal reflections.
//   cos(theta_i) = sqrt((n^2 - 1) / (k^2 + 2k))
function descartesB(n, k) {
  const cosI = Math.sqrt((n * n - 1) / (k * k + 2 * k));
  return Math.sqrt(1 - cosI * cosI);
}

// Angle between the returning ray and the antisolar direction, in degrees.
//   k = 1:  4*theta_r - 2*theta_i
//   k = 2:  180 + 2*theta_i - 6*theta_r
function bowAngle(n, k) {
  const cosI = Math.sqrt((n * n - 1) / (k * k + 2 * k));
  const thI = Math.acos(cosI);
  const thR = Math.asin(Math.sin(thI) / n);
  return k === 1 ? (4 * thR - 2 * thI) * DEG : 180 + (2 * thI - 6 * thR) * DEG;
}

// 42.36 / 40.66 / 50.34 / 53.52 — the published figures, derived, not typed.
const PRI_RED = bowAngle(N_RED, 1);
const PRI_VIO = bowAngle(N_VIOLET, 1);
const SEC_RED = bowAngle(N_RED, 2);
const SEC_VIO = bowAngle(N_VIOLET, 2);

// The sun is half a degree wide, so every colour band is smeared by that much
// before it ever reaches an eye. Softening the edges by this is physics, not
// art direction.
const SUN_HALF = 0.42;

// --- scene constants -------------------------------------------------------
const EYE = new THREE.Vector3(0, 1.15, -0.1); // the tripod's lens
const SUN_AZ = 0; // the sun sits straight behind the observer, at +Z
const RAIN_N = 8500;
// The shower is staged as a THIN SHELL of rain standing about ten metres out,
// rather than a deep slab. That is a real staging choice and it matters: the
// bow is a CONE, so a deep field puts lit drops at every depth along it, and
// any camera that is not standing exactly at the observer's eye smears that
// cone into a wash of colour across half the sky. A curtain one unit thick
// intersects the cone in a clean ring — which is also precisely the thing the
// explainer is claiming, so the honest staging and the legible one agree.
const RAIN_R0 = 9.5;
const RAIN_R1 = 10.5;
const FALL_SPAN = 1.15; // how far a drop falls before its neighbour replaces it
const RAIN_Y_MIN = 0.14;
const SHELL_R = 10.0; // the smooth bow shell sits in the middle of the curtain
const DROP_R = 0.85; // the macro drop (a disclosed scale break)
const DROP_C = new THREE.Vector3(3.5, 4.15, -1.5);

// --- spectrum --------------------------------------------------------------
// u = 0 is the long-wavelength end, u = 1 the short one. Deliberately hot at
// the red end and cool at the violet end rather than an evenly-spaced hue
// sweep — a real bow is mostly red/orange/green with a thin blue hem.
const SPECTRUM = [
  [0.0, 1.0, 0.13, 0.05],
  [0.17, 1.0, 0.42, 0.05],
  [0.34, 1.0, 0.82, 0.12],
  [0.5, 0.42, 1.0, 0.22],
  [0.66, 0.14, 0.86, 0.62],
  [0.82, 0.16, 0.42, 1.0],
  [1.0, 0.56, 0.2, 1.0],
];

function spectrum(u, out) {
  const x = clamp01(u);
  let i = 0;
  while (i < SPECTRUM.length - 2 && x > SPECTRUM[i + 1][0]) i++;
  const a = SPECTRUM[i];
  const b = SPECTRUM[i + 1];
  const t = (x - a[0]) / (b[0] - a[0]);
  out.r = a[1] + (b[1] - a[1]) * t;
  out.g = a[2] + (b[2] - a[2]) * t;
  out.b = a[3] + (b[3] - a[3]) * t;
  return out;
}

// THE function. Given the angle between a drop and the antisolar axis, what
// colour does that drop send back to the eye? Everything visible in this
// explainer — the sparkle in the field, the smooth shell, the fact that the
// bow curves at all — is this one call, evaluated a few thousand times.
const _sp = { r: 0, g: 0, b: 0 };
function bowColour(deg, pri, sec, out) {
  out.r = out.g = out.b = 0;

  // Primary: light returning after ONE internal reflection, piled up against
  // the minimum-deviation limit. Nothing comes back beyond PRI_RED.
  if (pri > 0.001) {
    if (deg <= PRI_RED + SUN_HALF && deg >= PRI_VIO - SUN_HALF) {
      const u = (PRI_RED - deg) / (PRI_RED - PRI_VIO);
      spectrum(u, _sp);
      // soften both ends by the sun's own angular width
      const edge =
        smooth(clamp01((PRI_RED + SUN_HALF - deg) / SUN_HALF)) *
        smooth(clamp01((deg - (PRI_VIO - SUN_HALF)) / SUN_HALF));
      const k = 1.15 * edge * pri;
      out.r += _sp.r * k;
      out.g += _sp.g * k;
      out.b += _sp.b * k;
    } else if (deg < PRI_VIO) {
      // INSIDE the primary every colour still returns, just overlapping —
      // which is why the sky inside a bright bow is visibly paler than the
      // sky outside it. This wash is that, not a glow effect.
      const k = 0.1 * smooth(clamp01((deg - (PRI_VIO - 9)) / 9)) * pri;
      out.r += 0.62 * k;
      out.g += 0.72 * k;
      out.b += 0.95 * k;
    }
  }

  // Secondary: TWO internal reflections, so the spectrum runs the other way
  // and far less light survives the extra bounce.
  if (sec > 0.001) {
    if (deg >= SEC_RED - SUN_HALF && deg <= SEC_VIO + SUN_HALF) {
      const u = (deg - SEC_RED) / (SEC_VIO - SEC_RED);
      spectrum(u, _sp);
      const edge =
        smooth(clamp01((deg - (SEC_RED - SUN_HALF)) / SUN_HALF)) *
        smooth(clamp01((SEC_VIO + SUN_HALF - deg) / SUN_HALF));
      const k = 0.34 * edge * sec;
      out.r += _sp.r * k;
      out.g += _sp.g * k;
      out.b += _sp.b * k;
    } else if (deg > SEC_VIO) {
      const k = 0.045 * smooth(clamp01((SEC_VIO + 8 - deg) / 8)) * sec;
      out.r += 0.62 * k;
      out.g += 0.72 * k;
      out.b += 0.95 * k;
    }
  }
  // Between PRI_RED and SEC_RED both terms are zero. That gap is Alexander's
  // dark band, and it exists here for exactly the reason it exists outside.
  return out;
}

// --- the ray tracer --------------------------------------------------------
// 2D Snell refraction. I is the unit incident direction, N the unit outward
// normal on the side the ray arrives from, eta the index ratio n_from/n_to.
// Returns null on total internal reflection.
function refract2(ix, iy, nx, ny, eta) {
  const cosI = -(nx * ix + ny * iy);
  const sin2T = eta * eta * (1 - cosI * cosI);
  if (sin2T > 1) return null;
  const c = eta * cosI - Math.sqrt(1 - sin2T);
  return [eta * ix + c * nx, eta * iy + c * ny];
}

// Trace one sunbeam through a spherical drop of radius R and index n, with
// `bounces` internal reflections, and return the polyline it follows — in the
// drop's own 2D plane, incoming direction +x, impact parameter b along +y.
// This is the whole of rainbow optics in twenty lines.
function traceDrop(b, n, bounces, R = 1, lead = 2.4, tail = 3.4) {
  const cosI = Math.sqrt(Math.max(0, 1 - b * b));
  // entry point on the sunward face
  let px = -cosI * R;
  let py = b * R;
  const pts = [[px - lead, py]];
  pts.push([px, py]);

  // refract in
  let [dx, dy] = refract2(1, 0, px / R, py / R, 1 / n);

  for (let k = 0; k < bounces; k++) {
    // chord to the far wall: for a point ON the sphere heading inward,
    // the chord length is -2 * (P . D)
    const L = -2 * (px * dx + py * dy);
    px += dx * L;
    py += dy * L;
    pts.push([px, py]);
    // internal reflection off the wall
    const nx = px / R;
    const ny = py / R;
    const dot = dx * nx + dy * ny;
    dx -= 2 * dot * nx;
    dy -= 2 * dot * ny;
  }

  // chord to the exit wall, then refract out
  const L = -2 * (px * dx + py * dy);
  px += dx * L;
  py += dy * L;
  pts.push([px, py]);
  const out = refract2(dx, dy, px / R, py / R, n);
  const [ox, oy] = out ?? [dx, dy];
  pts.push([px + ox * tail, py + oy * tail]);
  return pts;
}

// --- small builders --------------------------------------------------------
// Straight-segment beam: a chain of cylinders, so the sharp bends inside the
// drop stay sharp (a spline would round off the very corners that ARE the
// mechanism).
function beamFrom(points3, radius, material) {
  const g = new THREE.Group();
  const up = new THREE.Vector3(0, 1, 0);
  const dir = new THREE.Vector3();
  for (let i = 0; i < points3.length - 1; i++) {
    const a = points3[i];
    const b = points3[i + 1];
    dir.subVectors(b, a);
    const len = dir.length();
    if (len < 1e-5) continue;
    const seg = new THREE.Mesh(
      new THREE.CylinderGeometry(radius, radius, len, 8, 1, true),
      material,
    );
    seg.position.copy(a).addScaledVector(dir, 0.5);
    seg.quaternion.setFromUnitVectors(up, dir.normalize());
    g.add(seg);
  }
  return g;
}

// Arc-length walk along a polyline, so a packet rides it at constant speed.
function polyPath(points3) {
  const segs = [];
  let total = 0;
  for (let i = 0; i < points3.length - 1; i++) {
    const len = points3[i].distanceTo(points3[i + 1]);
    segs.push({ a: points3[i], b: points3[i + 1], len, at: total });
    total += len;
  }
  return {
    total,
    at(u, out) {
      const d = clamp01(u) * total;
      let s = segs[segs.length - 1];
      for (const seg of segs) {
        if (d <= seg.at + seg.len) {
          s = seg;
          break;
        }
      }
      return out.lerpVectors(s.a, s.b, s.len ? (d - s.at) / s.len : 0);
    },
  };
}

function haloTexture(inner = 'rgba(255,244,214,1)') {
  const c = document.createElement('canvas');
  c.width = c.height = 128;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(64, 64, 2, 64, 64, 64);
  g.addColorStop(0, inner);
  g.addColorStop(0.28, 'rgba(255,226,166,0.5)');
  g.addColorStop(1, 'rgba(255,200,130,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 128, 128);
  return new THREE.CanvasTexture(c);
}

const additive = (color, opacity = 1) =>
  new THREE.MeshBasicMaterial({
    color,
    transparent: true,
    opacity,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
    toneMapped: true,
  });

// ===========================================================================
export function buildRainbow({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const labels = calloutSets(['exterior', 'drop', 'fan', 'split', 'cone', 'fall', 'second', 'gap']);

  // --- ground ---------------------------------------------------------------
  // Wet, dark and nearly flat: it exists to give the tripod somewhere to
  // stand and to cut the bottom off the bow, which is the whole reason a
  // rainbow is an arc rather than a circle.
  const ground = new THREE.Mesh(
    new THREE.CircleGeometry(17, 72),
    new THREE.MeshPhysicalMaterial({
      color: 0x0c0e12,
      roughness: 0.72,
      metalness: 0,
      clearcoat: 0.18,
      clearcoatRoughness: 0.62,
    }),
  );
  ground.rotation.x = -Math.PI / 2;
  ground.position.y = -0.006; // under the stage's shadow-catching plane
  ground.receiveShadow = true;
  group.add(ground);

  // --- the observer: a camera on a tripod -----------------------------------
  // Never a figure. The story needs a thing with one eye at a known height,
  // and a tripod head is exactly that.
  const rig = new THREE.Group();
  group.add(rig);

  const legMat = materials.brushedSteel(0x8c949e);
  const darkMat = materials.polymer(0x16181c);
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.07, 0.085, 0.1, 20), darkMat);
  hub.position.y = 0.92;
  hub.castShadow = true;
  rig.add(hub);

  for (let i = 0; i < 3; i++) {
    const a = (i / 3) * TAU + Math.PI / 2;
    const leg = new THREE.Group();
    const shaft = rod(0.023, 0.98, legMat, 12);
    shaft.castShadow = true;
    leg.add(shaft);
    const foot = new THREE.Mesh(new THREE.SphereGeometry(0.032, 10, 8), materials.rubber());
    foot.scale.y = 0.6;
    leg.add(foot);
    const knuckle = new THREE.Mesh(new THREE.CylinderGeometry(0.03, 0.03, 0.06, 12), darkMat);
    knuckle.position.y = 0.95;
    leg.add(knuckle);
    leg.position.set(Math.cos(a) * 0.34, 0, Math.sin(a) * 0.34);
    leg.rotation.set(Math.sin(a) * 0.3, 0, -Math.cos(a) * 0.3);
    rig.add(leg);
  }

  const column = rod(0.035, 0.2, legMat, 14);
  column.position.y = 0.97;
  rig.add(column);
  const head = beveledBox(0.17, 0.09, 0.15, darkMat, 0.015);
  head.position.y = 1.19;
  head.castShadow = true;
  rig.add(head);
  const panBar = rod(0.014, 0.3, legMat, 10);
  panBar.position.set(0.05, 1.2, 0.05);
  panBar.rotation.set(0.5, -0.5, 0);
  rig.add(panBar);

  const body = beveledBox(0.42, 0.29, 0.24, materials.paintedMetal(0x1b1e23), 0.022);
  body.position.set(0, 1.4, 0.02);
  body.castShadow = true;
  rig.add(body);
  const prism = beveledBox(0.17, 0.09, 0.15, materials.paintedMetal(0x1b1e23), 0.016);
  prism.position.set(-0.02, 1.57, 0.02);
  rig.add(prism);
  const grip = beveledBox(0.11, 0.26, 0.2, materials.polymer(0x101216), 0.03);
  grip.position.set(0.18, 1.39, 0.04);
  rig.add(grip);
  const shutter = new THREE.Mesh(
    new THREE.CylinderGeometry(0.018, 0.018, 0.02, 12),
    materials.brushedSteel(0xb8bec6),
  );
  shutter.position.set(0.18, 1.54, 0.0);
  rig.add(shutter);

  const barrel = new THREE.Mesh(
    new THREE.CylinderGeometry(0.095, 0.105, 0.2, 28),
    materials.polymer(0x1a1c21),
  );
  barrel.rotation.x = Math.PI / 2;
  barrel.position.set(0, 1.38, -0.2);
  barrel.castShadow = true;
  rig.add(barrel);
  const ring = new THREE.Mesh(
    new THREE.TorusGeometry(0.098, 0.011, 8, 32),
    materials.brushedSteel(0xc2c8d0),
  );
  ring.position.set(0, 1.38, -0.3);
  rig.add(ring);
  const frontGlass = new THREE.Mesh(
    new THREE.CircleGeometry(0.09, 28),
    new THREE.MeshPhysicalMaterial({
      color: 0x0d1626,
      roughness: 0.06,
      metalness: 0.1,
      clearcoat: 1,
      iridescence: 0.5,
      iridescenceIOR: 1.3,
    }),
  );
  frontGlass.position.set(0, 1.38, -0.302);
  frontGlass.rotation.y = Math.PI;
  rig.add(frontGlass);

  // The lens front is the eye. Everything angular in this scene is measured
  // from this point and nowhere else.
  const eye = new THREE.Vector3().copy(EYE);

  // --- the sun --------------------------------------------------------------
  const sunGroup = new THREE.Group();
  group.add(sunGroup);
  const sunDisc = new THREE.Mesh(
    new THREE.CircleGeometry(0.5, 40),
    new THREE.MeshBasicMaterial({ color: 0xfff3d6, fog: false, toneMapped: true }),
  );
  sunGroup.add(sunDisc);
  const sunHalo = new THREE.Mesh(
    new THREE.PlaneGeometry(5.2, 5.2),
    new THREE.MeshBasicMaterial({
      map: haloTexture(),
      transparent: true,
      opacity: 0.55,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  sunGroup.add(sunHalo);

  // --- the rain field -------------------------------------------------------
  // Every drop is a real point in a real volume. Its colour each frame is
  // bowColour() of its own angle from the antisolar axis — nothing else.
  const dropGeo = new THREE.SphereGeometry(0.015, 7, 5);
  dropGeo.scale(1, 1.7, 1); // falling water is not spherical at this scale
  const rainMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 1,
    blending: THREE.AdditiveBlending,
    depthWrite: false,
    fog: false,
  });
  const rain = new THREE.InstancedMesh(dropGeo, rainMat, RAIN_N);
  rain.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  rain.frustumCulled = false;
  group.add(rain);

  const rx = new Float32Array(RAIN_N);
  const ry = new Float32Array(RAIN_N);
  const rz = new Float32Array(RAIN_N);
  const rph = new Float32Array(RAIN_N); // per-drop fall phase
  for (let i = 0; i < RAIN_N; i++) {
    // uniform on the forward part of the shell, everything that would land
    // underground pushed back up into it
    let dx = 0;
    let dy = 0;
    let dz = 0;
    for (let tries = 0; tries < 24; tries++) {
      dx = Math.random() * 2 - 1;
      dy = Math.random() * 2 - 1;
      dz = Math.random() * 2 - 1;
      const l = Math.hypot(dx, dy, dz);
      if (l < 0.25 || l > 1) continue;
      dx /= l;
      dy /= l;
      dz /= l;
      if (dz > 0.16) continue; // the shower stands in FRONT of the observer
      if (EYE.y + dy * RAIN_R1 < RAIN_Y_MIN + FALL_SPAN) continue;
      break;
    }
    const r = RAIN_R0 + Math.random() * (RAIN_R1 - RAIN_R0);
    rx[i] = EYE.x + dx * r;
    ry[i] = Math.max(EYE.y + dy * r, RAIN_Y_MIN + FALL_SPAN);
    rz[i] = EYE.z + dz * r;
    rph[i] = Math.random();
  }
  rain.instanceColor = new THREE.InstancedBufferAttribute(new Float32Array(RAIN_N * 3), 3);
  rain.instanceColor.setUsage(THREE.DynamicDrawUsage);

  // --- the smooth bow shell -------------------------------------------------
  // The drop field is the truth but it is sparse; this shell is the SAME
  // bowColour() sampled continuously, so the bands read as bands. It is
  // masked to the volume that actually contains rain — a bow only exists
  // where there is water to make it.
  const SH_PHI = 108;
  const SH_TH = 13;
  const shellBands = [
    { lo: PRI_VIO - 0.8, hi: PRI_RED + 0.8 },
    { lo: SEC_RED - 0.9, hi: SEC_VIO + 0.9 },
  ];
  const shellTheta = [];
  const shellPhi = [];
  const shellPos = [];
  const shellCol = [];
  const shellIdx = [];
  for (const band of shellBands) {
    const base = shellTheta.length;
    for (let ti = 0; ti <= SH_TH; ti++) {
      const th = band.lo + ((band.hi - band.lo) * ti) / SH_TH;
      for (let pi = 0; pi <= SH_PHI; pi++) {
        shellTheta.push(th);
        shellPhi.push((pi / SH_PHI) * TAU);
        shellPos.push(0, 0, 0);
        shellCol.push(0, 0, 0);
      }
    }
    for (let ti = 0; ti < SH_TH; ti++) {
      for (let pi = 0; pi < SH_PHI; pi++) {
        const a = base + ti * (SH_PHI + 1) + pi;
        shellIdx.push(a, a + 1, a + SH_PHI + 1, a + 1, a + SH_PHI + 2, a + SH_PHI + 1);
      }
    }
  }
  const shellGeo = new THREE.BufferGeometry();
  shellGeo.setAttribute('position', new THREE.Float32BufferAttribute(shellPos, 3));
  shellGeo.setAttribute('color', new THREE.Float32BufferAttribute(shellCol, 3));
  shellGeo.setIndex(shellIdx);
  const shell = new THREE.Mesh(
    shellGeo,
    new THREE.MeshBasicMaterial({
      vertexColors: true,
      transparent: true,
      opacity: 0.85,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      side: THREE.DoubleSide,
      fog: false,
    }),
  );
  shell.frustumCulled = false;
  group.add(shell);
  const shellN = shellTheta.length;

  // --- the 42° cone ---------------------------------------------------------
  const coneGroup = new THREE.Group();
  group.add(coneGroup);
  const coneAngle = (PRI_RED + PRI_VIO) / 2;
  // axial height chosen so the rim lands exactly ON the shell: the cone has
  // to visibly STOP at the colours, which is the whole claim of the step
  const CONE_H = SHELL_R * Math.cos(coneAngle / DEG);
  const coneGeo = new THREE.ConeGeometry(
    CONE_H * Math.tan(coneAngle / DEG),
    CONE_H,
    96,
    1,
    true,
  );
  coneGeo.translate(0, -CONE_H / 2, 0); // apex at the origin, opening along -Y
  const coneMesh = new THREE.Mesh(
    coneGeo,
    new THREE.MeshBasicMaterial({
      color: 0x8ea6ff,
      transparent: true,
      opacity: 0.012,
      side: THREE.DoubleSide,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    }),
  );
  coneGroup.add(coneMesh);
  const coneRim = new THREE.Mesh(
    new THREE.TorusGeometry(CONE_H * Math.tan(coneAngle / DEG), 0.04, 8, 128),
    additive(0xc8d6ff, 0.8),
  );
  coneRim.rotation.x = Math.PI / 2;
  coneRim.position.y = -CONE_H;
  coneGroup.add(coneRim);
  // Ruled lines along the cone. A solid translucent surface reads as a grey
  // sheet hung across the scene; the generatrices read as what this actually
  // is — every direction that happens to sit 42° off the axis.
  const coneRibMat = additive(0xa9bcff, 0.24);
  const coneRibR = CONE_H * Math.tan(coneAngle / DEG);
  for (let i = 0; i < 28; i++) {
    const a = (i / 28) * TAU;
    coneGroup.add(
      beamFrom(
        [
          new THREE.Vector3(0, 0, 0),
          new THREE.Vector3(Math.cos(a) * coneRibR, -CONE_H, Math.sin(a) * coneRibR),
        ],
        0.007,
        coneRibMat,
      ),
    );
  }

  // the antisolar axis, drawn from the eye to the ground
  const axisLine = new THREE.Mesh(
    new THREE.CylinderGeometry(0.012, 0.012, 1, 8, 1, true),
    additive(0x93a6cc, 0.55),
  );
  group.add(axisLine);
  const antiMark = new THREE.Mesh(
    new THREE.RingGeometry(0.2, 0.28, 40),
    additive(0xa8b8e8, 0.85),
  );
  antiMark.rotation.x = -Math.PI / 2;
  group.add(antiMark);
  const antiShade = new THREE.Mesh(
    new THREE.CircleGeometry(0.46, 32),
    new THREE.MeshBasicMaterial({ color: 0x05070b, transparent: true, opacity: 0.5, fog: false }),
  );
  antiShade.rotation.x = -Math.PI / 2;
  group.add(antiShade);

  // three sample rays: eye out to the band, at red, green and violet
  const sampleRays = [];
  for (let i = 0; i < 3; i++) {
    const m = new THREE.Mesh(
      new THREE.CylinderGeometry(0.011, 0.011, 1, 8, 1, true),
      additive(0xffffff, 0.5),
    );
    m.userData.mat = m.material;
    sampleRays.push(m);
    group.add(m);
  }

  // --- the macro drop -------------------------------------------------------
  // A disclosed scale break. Plain transparent glass, NOT transmission: the
  // beams live INSIDE it, and a transmission pass would not see them at all.
  const macro = new THREE.Group();
  macro.position.copy(DROP_C);
  group.add(macro);
  const dropBall = new THREE.Mesh(
    new THREE.SphereGeometry(DROP_R, 64, 48),
    new THREE.MeshPhysicalMaterial({
      color: 0xbcd8ff,
      metalness: 0,
      roughness: 0.08,
      transparent: true,
      opacity: 0.17,
      depthWrite: false,
      // FrontSide: the back faces of a transparent sphere throw bright
      // interior ghosts that read as smudges on the glass
      side: THREE.FrontSide,
      clearcoat: 0, // a coat renders at full strength through any opacity
    }),
  );
  macro.add(dropBall);
  const dropRim = new THREE.Mesh(
    new THREE.SphereGeometry(DROP_R * 1.003, 48, 32),
    new THREE.MeshBasicMaterial({
      color: 0x6f9fd8,
      transparent: true,
      opacity: 0.1,
      side: THREE.BackSide,
      depthWrite: false,
      blending: THREE.AdditiveBlending,
      fog: false,
    }),
  );
  macro.add(dropRim);

  // The insert is drawn in the drop's own plane: +x is the direction sunlight
  // travels (away from the sun), +y is the impact-parameter axis. The group
  // is aimed at the real antisolar axis in the pose function, so the beams
  // genuinely leave back toward the observer.
  const plane = new THREE.Group();
  macro.add(plane);

  const to3 = (pts2) => pts2.map(([x, y]) => new THREE.Vector3(x * DROP_R, y * DROP_R, 0));

  // hero path: the Descartes ray for red, one bounce
  const heroPts = to3(traceDrop(descartesB(N_RED, 1), N_RED, 1));
  const heroMat = additive(0xffd9a0, 0.5);
  const heroBeam = beamFrom(heroPts, 0.013, heroMat);
  plane.add(heroBeam);
  const heroPath = polyPath(heroPts);
  const packets = [];
  for (let i = 0; i < 3; i++) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.042, 14, 10), additive(0xfff0cf, 1));
    plane.add(p);
    packets.push(p);
  }
  // marks the one event people never picture: the bounce off the BACK wall
  const bouncePin = new THREE.Mesh(new THREE.SphereGeometry(0.055, 14, 10), additive(0xffc36a, 0.9));
  bouncePin.position.copy(heroPts[2]);
  plane.add(bouncePin);
  const entryPin = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), additive(0x9fd8ff, 0.8));
  entryPin.position.copy(heroPts[1]);
  plane.add(entryPin);
  const exitPin = new THREE.Mesh(new THREE.SphereGeometry(0.045, 12, 10), additive(0xffa8a8, 0.8));
  exitPin.position.copy(heroPts[3]);
  plane.add(exitPin);

  // --- the fan: why there is a bow at all -----------------------------------
  // Parallel rays striking every part of the drop's face. Their exits do NOT
  // spread evenly; they crowd against the minimum-deviation limit, and that
  // crowding is the entire brightness of a rainbow.
  const fanGroup = new THREE.Group();
  plane.add(fanGroup);
  const FAN_N = 13;
  const fanMat = additive(0xbfe0ff, 0.22);
  const dotMat = additive(0xffe9b8, 0.95);
  const FAN_ARC_R = 2.55;
  const fanDots = [];
  const fanPaths = [];
  const fanPackets = [];
  for (let i = 0; i < FAN_N; i++) {
    const b = (i + 0.5) / FAN_N;
    const pts = to3(traceDrop(b, N_RED, 1, 1, 2.4, 2.9));
    fanGroup.add(beamFrom(pts, 0.008, fanMat));
    fanPaths.push(polyPath(pts));
    const fp = new THREE.Mesh(new THREE.SphereGeometry(0.036, 10, 8), additive(0xfff2d8, 1));
    fanGroup.add(fp);
    fanPackets.push(fp);
    // where this ray crosses a circle drawn round the drop — the dots are
    // the histogram
    // where this exit ray crosses a circle drawn round the drop: solve
    // |prev + d*t| = Rc, so the dots ARE a histogram of exit direction
    const last = pts[pts.length - 1];
    const prev = pts[pts.length - 2];
    const d = new THREE.Vector3().subVectors(last, prev).normalize();
    const Rc = FAN_ARC_R * DROP_R;
    const pd = prev.dot(d);
    const t = -pd + Math.sqrt(Math.max(0, pd * pd - prev.lengthSq() + Rc * Rc));
    const hit = new THREE.Vector3().copy(prev).addScaledVector(d, t);
    const dot = new THREE.Mesh(new THREE.SphereGeometry(0.044, 12, 10), dotMat);
    dot.position.copy(hit);
    fanGroup.add(dot);
    fanDots.push(dot);
  }
  const fanArc = new THREE.Mesh(
    new THREE.TorusGeometry(FAN_ARC_R * DROP_R, 0.008, 6, 128),
    additive(0x7f93b8, 0.5),
  );
  fanGroup.add(fanArc);

  // --- red vs violet --------------------------------------------------------
  const splitGroup = new THREE.Group();
  plane.add(splitGroup);
  // The exits differ by 1.7°, and nothing here exaggerates that. The tails
  // are run out to nine drop-radii instead, so a gap that small has a long
  // enough baseline to be a visible gap rather than a claim in the copy.
  const redPts = to3(traceDrop(descartesB(N_RED, 1), N_RED, 1, 1, 2.0, 6.4));
  const vioPts = to3(traceDrop(descartesB(N_VIOLET, 1), N_VIOLET, 1, 1, 2.0, 6.4));
  splitGroup.add(beamFrom(redPts, 0.017, additive(0xff2a0c, 0.8)));
  splitGroup.add(beamFrom(vioPts, 0.017, additive(0x7b28ff, 0.8)));
  // the gap itself, drawn between the two ray ends
  const gapBar = beamFrom([redPts[redPts.length - 1], vioPts[vioPts.length - 1]], 0.012,
    additive(0xd8e2ff, 0.55));
  splitGroup.add(gapBar);
  const splitPaths = [polyPath(redPts), polyPath(vioPts)];
  const splitPackets = [additive(0xffb9a4, 1), additive(0xd0a8ff, 1)].map((m) => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), m);
    splitGroup.add(p);
    return p;
  });

  // --- two bounces ----------------------------------------------------------
  const secGroup = new THREE.Group();
  plane.add(secGroup);
  const secPts = to3(traceDrop(descartesB(N_RED, 2), N_RED, 2, 1, 1.3, 1.9));
  secGroup.add(beamFrom(secPts, 0.017, additive(0xffb877, 0.7)));
  const secPath = polyPath(secPts);
  const secPackets = [0, 1].map(() => {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.04, 12, 10), additive(0xfff0cf, 1));
    secGroup.add(p);
    return p;
  });
  const secPins = [];
  for (const i of [2, 3]) {
    const p = new THREE.Mesh(new THREE.SphereGeometry(0.042, 12, 10), additive(0xffc36a, 0.9));
    p.position.copy(secPts[i]);
    secGroup.add(p);
    secPins.push(p);
  }

  // --- callouts -------------------------------------------------------------
  const anchor = (parent, pos) => {
    const o = new THREE.Object3D();
    if (pos) o.position.copy(pos);
    parent.add(o);
    return o;
  };

  const bowAnchorP = anchor(group);
  const bowAnchorS = anchor(group);
  const bowAnchorGap = anchor(group);
  const rainAnchor = anchor(group, new THREE.Vector3(5.6, 1.5, -7.4));
  const sunAnchor = anchor(sunGroup);
  const coneAnchor = anchor(group);
  const fallAnchor = anchor(group);

  labels.add('exterior', bowAnchorP, 'Primary bow · 42°', [0, 0, 0], 28, 66);
  labels.add('exterior', bowAnchorS, 'Secondary bow · 50–54°', [0, 0, 0], 22, 82);
  labels.add('exterior', rainAnchor, 'Falling rain', [0, 0, 0], -38, 62);
  labels.add('exterior', sunAnchor, 'Sun, low behind you', [0, 0, 0], 40, 60);

  labels.add('drop', entryPin, 'Bends going in', [0, 0, 0], 132, 62);
  labels.add('drop', bouncePin, 'One bounce off the back', [0, 0, 0], 35, 70);
  labels.add('drop', exitPin, 'Bends coming out', [0, 0, 0], -55, 66);

  labels.add('fan', anchor(plane, new THREE.Vector3(-DROP_R * 0.75, DROP_R * 0.62, 0)),
    'Rays hit the whole face', [0, 0, 0], 140, 66);
  labels.add('fan', fanDots[FAN_N - 5], 'Exits pile up here', [0, 0, 0], 20, 74);

  labels.add('split', anchor(plane, redPts[redPts.length - 1]), 'Red · 42.4°', [0, 0, 0], 14, 58);
  labels.add('split', anchor(plane, vioPts[vioPts.length - 1]), 'Violet · 40.7°', [0, 0, 0], -34, 62);

  labels.add('cone', antiMark, 'Antisolar point · your shadow', [0, 0.05, 0], -40, 78);
  labels.add('cone', coneAnchor, '42° half-angle', [0, 0, 0], 30, 62);

  labels.add('fall', fallAnchor, 'Drops fall through the colours', [0, 0, 0], 78, 26);
  labels.add('fall', bowAnchorP, 'The band never moves', [0, 0, 0], -28, 72);

  labels.add('second', secPins[0], 'Bounce one', [0, 0, 0], 12, 76);
  labels.add('second', secPins[1], 'Bounce two', [0, 0, 0], -28, 66);
  labels.add('gap', bowAnchorS, 'Secondary bow · two bounces', [0, 0, 0], 22, 82);
  labels.add('gap', bowAnchorGap, "Alexander's dark band", [0, 0, 0], 18, 78);

  // --- pose -----------------------------------------------------------------
  const S = {
    rain: 1,
    bowP: 1,
    bowS: 1,
    macro: 0,
    fanOn: 0,
    splitOn: 0,
    secOn: 0,
    coneOn: 0,
    sampleOn: 0,
    walk: 0,
    sunEl: 10,
    fall: 0,
    flow: 0,
  };

  const _m = new THREE.Matrix4();
  const _basis = new THREE.Matrix4();
  const _sp2 = { r: 0, g: 0, b: 0 };
  const _c = new THREE.Color();
  const _v = new THREE.Vector3();
  const _v2 = new THREE.Vector3();
  const axisA = new THREE.Vector3();
  const axisU = new THREE.Vector3();
  const axisV = new THREE.Vector3();
  const sunDir = new THREE.Vector3();
  const shellCache = { x: NaN, y: NaN, z: NaN, el: NaN, p: NaN, s: NaN };

  // direction at (theta from the axis, phi around it); phi = 0 is straight up
  function bowDir(thDeg, phiDeg, out) {
    const th = thDeg / DEG;
    const ph = phiDeg / DEG;
    const st = Math.sin(th);
    return out
      .copy(axisA)
      .multiplyScalar(Math.cos(th))
      .addScaledVector(axisV, Math.cos(ph) * st)
      .addScaledVector(axisU, Math.sin(ph) * st);
  }

  // The curtain does not wrap all the way round the observer and it stops at
  // the ground, so the bow stops there too — which is the only reason a
  // rainbow is an arc and not a circle.
  function inRain(y, dz) {
    return clamp01((y - RAIN_Y_MIN) / 0.7) * clamp01((0.16 - dz) / 0.3);
  }

  function aimSegment(mesh, a, b, radius) {
    _v.subVectors(b, a);
    const len = _v.length() || 1e-4;
    mesh.position.copy(a).addScaledVector(_v, 0.5);
    mesh.quaternion.setFromUnitVectors(_v2.set(0, 1, 0), _v.normalize());
    mesh.scale.set(radius ?? 1, len, radius ?? 1);
  }

  // where the sampling rays point at lap fraction u — out and back, so the
  // sweep is seamless
  const sweepPhi = (u) => -58 + 116 * (0.5 - 0.5 * Math.cos(u * TAU));

  function set(patch = {}) {
    Object.assign(S, patch);

    // --- observer & sun geometry ---
    const walkZ = -S.walk * 2.1;
    rig.position.z = walkZ;
    eye.set(EYE.x, EYE.y, EYE.z + walkZ);

    const el = S.sunEl / DEG;
    sunDir.set(Math.sin(SUN_AZ) * Math.cos(el), Math.sin(el), Math.cos(SUN_AZ) * Math.cos(el));
    axisA.copy(sunDir).negate();
    // a stable frame around the axis: V points as close to "up" as it can
    axisV.set(0, 1, 0).addScaledVector(axisA, -axisA.y).normalize();
    axisU.crossVectors(axisV, axisA).normalize();

    sunGroup.position.copy(eye).addScaledVector(sunDir, 15);
    sunGroup.lookAt(eye);

    // --- the rain field ---
    rain.visible = S.rain > 0.01;
    if (rain.visible) {
      const pri = S.bowP;
      const sec = S.bowS;
      const base = 0.012 * S.rain;
      for (let i = 0; i < RAIN_N; i++) {
        // each drop carries its own phase, so they do not all wrap on the same
        // frame — and at fall = 1 every drop is back where it started
        const y = ry[i] - ((S.fall + rph[i]) % 1) * FALL_SPAN;
        const x = rx[i];
        const z = rz[i];
        const dx = x - eye.x;
        const dy = y - eye.y;
        const dz = z - eye.z;
        const inv = 1 / Math.hypot(dx, dy, dz);
        const cos = (dx * axisA.x + dy * axisA.y + dz * axisA.z) * inv;
        let r = base;
        let g = base * 1.08;
        let b = base * 1.35;
        // only the 34°–58° annulus can return anything; skip the acos for
        // every other drop in the volume
        if (cos > 0.5299 && cos < 0.8291) {
          bowColour(Math.acos(cos) * DEG, pri, sec, _sp2);
          r += _sp2.r;
          g += _sp2.g;
          b += _sp2.b;
        }
        const bright = r + g + b;
        const sc = (0.9 + Math.min(bright, 1.2) * 1.0) * (0.45 + 0.55 * S.rain);
        _m.makeScale(sc, sc, sc);
        _m.setPosition(x, y, z);
        rain.setMatrixAt(i, _m);
        rain.setColorAt(i, _c.setRGB(r, g, b));
      }
      rain.instanceMatrix.needsUpdate = true;
      rain.instanceColor.needsUpdate = true;
    }

    // --- the smooth shell ---
    shell.visible = S.bowP > 0.01 || S.bowS > 0.01;
    if (
      shell.visible &&
      (shellCache.x !== eye.x ||
        shellCache.y !== eye.y ||
        shellCache.z !== eye.z ||
        shellCache.el !== S.sunEl ||
        shellCache.p !== S.bowP ||
        shellCache.s !== S.bowS)
    ) {
      shellCache.x = eye.x;
      shellCache.y = eye.y;
      shellCache.z = eye.z;
      shellCache.el = S.sunEl;
      shellCache.p = S.bowP;
      shellCache.s = S.bowS;
      const pos = shellGeo.attributes.position.array;
      const col = shellGeo.attributes.color.array;
      for (let i = 0; i < shellN; i++) {
        bowDir(shellTheta[i], shellPhi[i] * DEG, _v);
        const x = eye.x + _v.x * SHELL_R;
        const y = eye.y + _v.y * SHELL_R;
        const z = eye.z + _v.z * SHELL_R;
        pos[i * 3] = x;
        pos[i * 3 + 1] = y;
        pos[i * 3 + 2] = z;
        const mask = inRain(y, _v.z);
        if (mask <= 0) {
          col[i * 3] = col[i * 3 + 1] = col[i * 3 + 2] = 0;
          continue;
        }
        bowColour(shellTheta[i], S.bowP, S.bowS, _sp2);
        col[i * 3] = _sp2.r * mask * 0.55;
        col[i * 3 + 1] = _sp2.g * mask * 0.55;
        col[i * 3 + 2] = _sp2.b * mask * 0.55;
      }
      shellGeo.attributes.position.needsUpdate = true;
      shellGeo.attributes.color.needsUpdate = true;
      shellGeo.computeBoundingSphere();
    }

    // --- the cone and the antisolar axis ---
    const coneVisible = S.coneOn > 0.01;
    coneGroup.visible = coneVisible;
    axisLine.visible = coneVisible;
    antiMark.visible = coneVisible;
    antiShade.visible = coneVisible;
    coneMesh.material.opacity = 0.012 * S.coneOn;
    coneRim.material.opacity = 0.8 * S.coneOn;
      coneRibMat.opacity = 0.24 * S.coneOn;
    if (coneVisible) {
      coneGroup.position.copy(eye);
      coneGroup.quaternion.setFromUnitVectors(_v2.set(0, -1, 0), axisA);
      // where the antisolar axis meets the ground
      const tGround = axisA.y < -1e-3 ? -eye.y / axisA.y : 40;
      _v.copy(eye).addScaledVector(axisA, Math.min(tGround, 40));
      aimSegment(axisLine, eye, _v, 1);
      antiMark.position.set(_v.x, 0.012, _v.z);
      antiShade.position.set(_v.x, 0.008, _v.z);
      // ride the sweeping sample ray: a label for "42°" has to sit ON
      // something that visibly measures 42°, not in empty sky
      coneAnchor.position
        .copy(eye)
        .addScaledVector(bowDir(coneAngle, sweepPhi(S.flow), _v2), SHELL_R * 0.58);
    }

    // --- sample rays from the eye to three colours in the band ---
    const sampleVisible = S.sampleOn > 0.01;
    for (let i = 0; i < 3; i++) {
      const m = sampleRays[i];
      m.visible = sampleVisible;
      if (!sampleVisible) continue;
      const th = [PRI_RED, (PRI_RED + PRI_VIO) / 2, PRI_VIO][i];
      bowColour(th, 1, 0, _sp2);
      const peak = Math.max(_sp2.r, _sp2.g, _sp2.b, 0.001);
      m.material.color.setRGB(_sp2.r / peak, _sp2.g / peak, _sp2.b / peak);
      m.material.opacity = 0.5 * S.sampleOn;
      // out-and-back across the visible top of the arc: the same 42° works
      // at every bearing, which is exactly why the bow is a circle
      bowDir(th, sweepPhi(S.flow), _v);
      _v2.copy(eye).addScaledVector(_v, 9.4);
      aimSegment(m, eye, _v2, 1);
    }

    // --- the macro drop ---
    macro.visible = S.macro > 0.01;
    if (macro.visible) {
      dropBall.material.opacity = 0.17 * S.macro;
      dropRim.material.opacity = 0.1 * S.macro;
      // aim the drop's plane so +x runs along the antisolar axis and +y is
      // the vertical impact-parameter axis
      const mx = axisA;
      const my = axisV;
      const mz = _v.crossVectors(mx, my).normalize();
      _basis.makeBasis(mx, my, mz);
      plane.quaternion.setFromRotationMatrix(_basis);

      heroBeam.visible = S.fanOn < 0.5 && S.splitOn < 0.5 && S.secOn < 0.5;
      entryPin.visible = bouncePin.visible = exitPin.visible = heroBeam.visible;
      for (let i = 0; i < packets.length; i++) {
        packets[i].visible = heroBeam.visible;
        if (!heroBeam.visible) continue;
        const u = (S.flow + i / packets.length) % 1;
        heroPath.at(u, _v2);
        packets[i].position.copy(_v2);
      }
      fanGroup.visible = S.fanOn > 0.5;
      if (fanGroup.visible) {
        // one wavefront, arriving across the whole face at once — the packets
        // leave together and are visibly bunched by the time they exit
        for (let i = 0; i < FAN_N; i++) fanPackets[i].position.copy(fanPaths[i].at(S.flow, _v2));
      }
      splitGroup.visible = S.splitOn > 0.5;
      if (splitGroup.visible) {
        for (let i = 0; i < 2; i++) splitPackets[i].position.copy(splitPaths[i].at(S.flow, _v2));
      }
      secGroup.visible = S.secOn > 0.5;
      if (secGroup.visible) {
        for (let i = 0; i < 2; i++) {
          secPackets[i].position.copy(secPath.at((S.flow + i * 0.5) % 1, _v2));
        }
      }
    }

    // --- label anchors that ride the bow ---
    bowAnchorP.position.copy(eye).addScaledVector(bowDir(PRI_RED, 8, _v), 10.0);
    bowAnchorS.position.copy(eye).addScaledVector(bowDir(SEC_RED + 1.6, 26, _v), 10.0);
    bowAnchorGap.position.copy(eye).addScaledVector(bowDir((PRI_RED + SEC_RED) / 2, -56, _v), 10.0);
    fallAnchor.position.copy(eye).addScaledVector(bowDir(PRI_RED - 0.6, -20, _v), 10.0);
    sunAnchor.position.set(0, 0, 0.1);
  }

  set({});

  return {
    group,
    set,
    setLabels: labels.setLabels,
    parts: {
      rig,
      rain,
      shell,
      cone: coneGroup,
      macro,
      fan: fanGroup,
      split: splitGroup,
      second: secGroup,
      sun: sunGroup,
      packets,
      fallAnchor,
      secPins,
    },
    // exposed so the step copy and the model can never drift apart
    optics: { PRI_RED, PRI_VIO, SEC_RED, SEC_VIO },
    // tooling hooks: where the bow actually IS right now, so step cameras can
    // be tuned by projecting real points instead of by screenshot roulette
    eye,
    splitEnd: (i, out = new THREE.Vector3()) =>
      plane.localToWorld(out.copy(i ? vioPts[vioPts.length - 1] : redPts[redPts.length - 1])),
    bowPoint: (thDeg, phiDeg, r = SHELL_R, out = new THREE.Vector3()) =>
      out.copy(eye).addScaledVector(bowDir(thDeg, phiDeg, new THREE.Vector3()), r),
  };
}
