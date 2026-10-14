import * as THREE from 'three';
import { materials, studioPlinth, flowField, chargeQueue } from '../../framework/parts.js';
import { beveledBox, tubeAlong } from '../../framework/geometry.js';
import { clamp01, win } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A driver-side frontal airbag on a crash-test rig: the steering-wheel module,
// its dual-stage pyrotechnic inflator, the crush-zone sensor and the control
// unit that decide to fire it, and a headform standing in for the driver.
//
// MECHANISM (story.js has the angle and the sources):
//   0 ms      the fixed barrier meets the bumper; the crush cans start folding
//   ~2 ms     the crush-zone sensor sees the deceleration and reports down the
//             yellow SRS harness; the control unit's own MEMS accelerometer
//             (a comb capacitor) is already deflecting
//   ~20 ms    the unit has integrated enough delta-v to cross its threshold and
//             sends current through the squib
//   ~22 ms    the squib's bridgewire lights the first propellant chamber; stage
//             two (a second chamber with its own squib) follows 8 ms later on a
//             severe crash, and stays dark on a mild one
//   ~26 ms    gas has pushed through the filter and ports; the cover splits on
//             its tear seam into two flaps
//   ~46 ms    the bag is full (about 40 ms from contact, per the sources)
//   ~62 ms    the headform meets the bag, which has been venting since it filled
//   190 ms    the bag is mostly flat around the headform
//
// EVERYTHING is one pure function of `state.ms` (+ severity), so a step's loop
// is just a time-warp over the same event and the rewind at the end of a lap is
// a scrub of the same function. The bag is a parametric surface of revolution
// re-meshed on every pose (a superellipse pillow); the headform clamps it.
//
// SCALE: 1 unit = 0.25 m. Wheel Ø1.56 (390 mm), cover Ø0.92 (230 mm), bag
// depth 1.25 (31 cm) and radius 1.0 (a 50 cm disc, tens of litres), headform
// r 0.4 (a 20 cm head), barrier-to-bumper 1.35 at -24 ms (14 m/s, 50 km/h).
//
// DISCLOSED CHEATS: the electrical signal is instant in life, drawn as a packet
// that crosses the harness in a few ms so the eye can follow it; the loop's
// rewind (fade, then scrub back) resets the rig between laps.

const PLINTH_H = 0.26;
const HY = 1.7; // wheel hub height above the plinth top
const WHEEL_R = 0.78;
const COVER_R = 0.46;
const HEAD_DY = 0.3; // headform sits a little above the wheel axis
const HEAD_R = 0.4;
const D_MAX = 1.25;
const R_MAX = 1.0;
const MS0 = -24; // rest pose (just before the barrier arrives)
const MS1 = 190; // end of the recorded event

export const MS_START = MS0;
export const MS_END = MS1;

// monotone cubic through (x, y) knots (Fritsch-Carlson) — exported so the
// steps can time-warp the event without a visible speed jolt at the knots
export function monoCubic(pts) {
  const n = pts.length;
  const xs = pts.map((p) => p[0]);
  const ys = pts.map((p) => p[1]);
  const d = [];
  const m = new Array(n);
  for (let i = 0; i < n - 1; i++) d[i] = (ys[i + 1] - ys[i]) / (xs[i + 1] - xs[i]);
  m[0] = d[0];
  m[n - 1] = d[n - 2];
  for (let i = 1; i < n - 1; i++) m[i] = d[i - 1] * d[i] <= 0 ? 0 : (d[i - 1] + d[i]) / 2;
  for (let i = 0; i < n - 1; i++) {
    if (d[i] === 0) {
      m[i] = 0;
      m[i + 1] = 0;
    } else {
      const a = m[i] / d[i];
      const b = m[i + 1] / d[i];
      const s = a * a + b * b;
      if (s > 9) {
        const tau = 3 / Math.sqrt(s);
        m[i] = tau * a * d[i];
        m[i + 1] = tau * b * d[i];
      }
    }
  }
  return (x) => {
    if (x <= xs[0]) return ys[0];
    if (x >= xs[n - 1]) return ys[n - 1];
    let i = 0;
    while (x > xs[i + 1]) i++;
    const h = xs[i + 1] - xs[i];
    const t = (x - xs[i]) / h;
    const t2 = t * t;
    const t3 = t2 * t;
    return (
      (2 * t3 - 3 * t2 + 1) * ys[i] +
      (t3 - 2 * t2 + t) * h * m[i] +
      (-2 * t3 + 3 * t2) * ys[i + 1] +
      (t3 - t2) * h * m[i + 1]
    );
  };
}

// headform travel along the axis (ax-space x of its centre) vs time
const headX = monoCubic([
  [-24, 1.9], [22, 1.9], [40, 1.86], [52, 1.79], [62, 1.69], [75, 1.5], [90, 1.22],
  [105, 1.02], [120, 0.93], [140, 0.9], [190, 0.9],
]);

function rng(seed) {
  let s = seed >>> 0;
  return () => (s = (s * 1664525 + 1013904223) >>> 0) / 4294967296;
}

// --- revolve helpers (axis = +x) ---------------------------------------------

// Round every real corner of a closed (r, a) loop with a short chamfer so the
// lathe's averaged normals shade it as a soft fillet.
function chamfer(loop, c) {
  const n = loop.length;
  const out = [];
  for (let i = 0; i < n; i++) {
    const p = loop[i];
    const a = loop[(i - 1 + n) % n];
    const b = loop[(i + 1) % n];
    const ax = a[0] - p[0];
    const ay = a[1] - p[1];
    const bx = b[0] - p[0];
    const by = b[1] - p[1];
    const la = Math.hypot(ax, ay);
    const lb = Math.hypot(bx, by);
    const cos = (ax * bx + ay * by) / (la * lb);
    if (c > 0 && cos > -0.94) {
      const ca = Math.min(c, la * 0.4);
      const cb = Math.min(c, lb * 0.4);
      out.push([p[0] + (ax / la) * ca, p[1] + (ay / la) * ca]);
      out.push([p[0] + (bx / lb) * cb, p[1] + (by / lb) * cb]);
    } else out.push(p);
  }
  return out.map(([r, a]) => [Math.max(0, r), a]);
}

// A closed loop as a lathe path that starts and ends mid-way along its longest
// off-axis edge, so the one unsmoothed seam lands on a flat run.
function lathePath(loop) {
  const n = loop.length;
  let best = 0;
  let bestLen = -1;
  for (let i = 0; i < n; i++) {
    const a = loop[i];
    const b = loop[(i + 1) % n];
    const len = Math.hypot(b[0] - a[0], b[1] - a[1]) * (a[0] + b[0] > 0.01 ? 1 : 0);
    if (len > bestLen) {
      bestLen = len;
      best = i;
    }
  }
  const a = loop[best];
  const b = loop[(best + 1) % n];
  const m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2];
  const seq = [m];
  for (let k = 1; k <= n; k++) seq.push(loop[(best + k) % n]);
  seq.push(m);
  return seq.map(([r, a2]) => new THREE.Vector2(r, a2));
}

const SEG = 64;

// One turned part about the +x axis, built from a closed (radius, axial) loop:
//   full  the whole solid of revolution
//   cut   the far half (z <= 0) plus filled section faces on the z = 0 plane,
//         so a camera on the +z side looks into a real section
// The wrapper rotation maps lathe (r, a) -> world (a, -r).
function turned(loop, mat, capMat, { c = 0.012, full = false } = {}) {
  const pts = chamfer(loop, c);
  const path = lathePath(pts);
  const out = {};
  const wrap = (obj) => {
    const g = new THREE.Group();
    g.rotation.z = -Math.PI / 2;
    g.add(obj);
    return g;
  };
  const shade = (m) => {
    m.castShadow = true;
    m.receiveShadow = true;
    return m;
  };
  if (full) out.full = wrap(shade(new THREE.Mesh(new THREE.LatheGeometry(path, SEG), mat)));
  const cut = new THREE.Group();
  const half = shade(new THREE.Mesh(new THREE.LatheGeometry(path, SEG / 2, Math.PI / 2, Math.PI), mat));
  const capGeo = new THREE.ShapeGeometry(new THREE.Shape(pts.map(([r, a]) => new THREE.Vector2(r, a))));
  const capA = new THREE.Mesh(capGeo, capMat);
  const capB = new THREE.Mesh(capGeo, capMat);
  capB.scale.x = -1;
  const inner = new THREE.Group();
  inner.add(half, capA, capB);
  cut.add(wrap(inner));
  out.cut = cut;
  return out;
}

const rect = (r0, r1, a0, a1) => [[r0, a0], [r1, a0], [r1, a1], [r0, a1]];

export function buildAirbag({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const plinth = studioPlinth({ w: 9.6, d: 3.2 });
  plinth.position.x = -0.6;
  group.add(plinth);

  const rig = new THREE.Group(); // plinth-top space
  rig.position.y = PLINTH_H;
  group.add(rig);
  const ax = new THREE.Group(); // hub axis space: +x toward the driver, origin on the wheel axis
  ax.position.y = HY;
  rig.add(ax);

  const mesh = (geo, mat, parent, { cast = true, receive = true } = {}) => {
    const m = new THREE.Mesh(geo, mat);
    m.castShadow = cast;
    m.receiveShadow = receive;
    parent?.add(m);
    return m;
  };

  // --- materials ---------------------------------------------------------------
  const wheelMat = materials.polymer(0x1c1e22);
  wheelMat.roughness = 0.62;
  const coverMat = materials.polymer(0x25272c);
  coverMat.roughness = 0.58;
  const bezelMat = materials.brushedSteel(0xc9ced6);
  bezelMat.roughness = 0.45;
  const shroudMat = materials.polymer(0x17181b);
  shroudMat.roughness = 0.7;
  shroudMat.side = THREE.DoubleSide;
  const steelDark = new THREE.MeshStandardMaterial({ color: 0x3d424a, metalness: 0.85, roughness: 0.5, side: THREE.DoubleSide });
  const steelBright = materials.brushedSteel(0xcfd4db);
  steelBright.roughness = 0.5;
  steelBright.side = THREE.DoubleSide;
  const sectionSteel = new THREE.MeshStandardMaterial({ color: 0x9aa1ac, roughness: 0.85, side: THREE.DoubleSide });
  const sectionDark = new THREE.MeshStandardMaterial({ color: 0x2b2e34, roughness: 0.9, side: THREE.DoubleSide });
  // knitted-wire filter: a bronze weave so it reads as a mesh, not a wall
  function weaveTexture(rx, ry) {
    const c = document.createElement('canvas');
    c.width = c.height = 64;
    const g = c.getContext('2d');
    g.fillStyle = '#6a4a22';
    g.fillRect(0, 0, 64, 64);
    g.strokeStyle = '#e0b878';
    g.lineWidth = 7;
    for (let i = -64; i < 128; i += 32) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + 64, 64);
      g.stroke();
      g.beginPath();
      g.moveTo(i + 64, 0);
      g.lineTo(i, 64);
      g.stroke();
    }
    const t = new THREE.CanvasTexture(c);
    t.wrapS = t.wrapT = THREE.RepeatWrapping;
    t.repeat.set(rx, ry);
    t.colorSpace = THREE.SRGBColorSpace;
    return t;
  }
  const filterMat = new THREE.MeshStandardMaterial({ map: weaveTexture(28, 10), metalness: 0.55, roughness: 0.55, side: THREE.DoubleSide });
  const filterCap = new THREE.MeshStandardMaterial({ map: weaveTexture(40, 230), metalness: 0.5, roughness: 0.55, side: THREE.DoubleSide });
  const brassMat = new THREE.MeshStandardMaterial({ color: 0xb98a4a, metalness: 0.9, roughness: 0.4, side: THREE.DoubleSide });
  const fabricA = new THREE.MeshStandardMaterial({ color: 0xece4cf, roughness: 0.95, side: THREE.DoubleSide });
  const fabricB = new THREE.MeshStandardMaterial({ color: 0xd9cfb6, roughness: 0.95, side: THREE.DoubleSide });
  const wireMat = new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.55 });
  const headMat = new THREE.MeshStandardMaterial({ color: 0x6f8db0, roughness: 0.62, metalness: 0.05 });
  const concreteMat = new THREE.MeshStandardMaterial({ color: 0x8b8f96, roughness: 0.95, transparent: true });
  const frameMat = materials.paintedMetal(0x4a5059);
  frameMat.clearcoat = 0.3;
  const bagMat = new THREE.MeshPhysicalMaterial({
    color: 0xf3ecd9,
    roughness: 0.88,
    sheen: 0.6,
    sheenRoughness: 0.7,
    sheenColor: new THREE.Color(0xffffff),
    side: THREE.DoubleSide,
    vertexColors: true,
    transparent: true,
    opacity: 1,
  });

  // --- the wheel -----------------------------------------------------------------
  const wheelNear = new THREE.Group(); // everything on the camera side of z = 0
  const wheelAll = new THREE.Group();
  ax.add(wheelAll, wheelNear);

  const rimGeo = new THREE.TorusGeometry(WHEEL_R, 0.07, 18, 40, Math.PI);
  const rimHolderN = new THREE.Group();
  rimHolderN.rotation.y = Math.PI / 2;
  const rimNear = mesh(rimGeo, wheelMat, rimHolderN);
  rimNear.rotation.z = Math.PI / 2;
  wheelNear.add(rimHolderN);
  const rimHolderF = new THREE.Group();
  rimHolderF.rotation.y = Math.PI / 2;
  const rimFar = mesh(rimGeo, wheelMat, rimHolderF);
  rimFar.rotation.z = -Math.PI / 2;
  wheelAll.add(rimHolderF);

  const spokeNear = beveledBox(0.1, 0.17, 0.4, wheelMat, 0.035);
  spokeNear.position.set(-0.03, -0.04, 0.64);
  spokeNear.rotation.x = -0.1;
  wheelNear.add(spokeNear);
  const spokeFar = beveledBox(0.1, 0.17, 0.4, wheelMat, 0.035);
  spokeFar.position.set(-0.03, -0.04, -0.64);
  spokeFar.rotation.x = 0.1;
  wheelAll.add(spokeFar);
  const spokeLow = beveledBox(0.1, 0.4, 0.2, wheelMat, 0.035);
  spokeLow.position.set(-0.03, -0.66, 0);
  wheelAll.add(spokeLow);

  // hub shroud (the visible back of the module) — full + cut halves
  const shroud = turned(
    [
      [0.5, 0.045], [0.585, 0.0], [0.585, -0.3], [0.46, -0.52], [0.23, -0.8], [0.2, -1.02],
      [0.165, -1.02], [0.18, -0.8], [0.4, -0.52], [0.55, -0.3], [0.55, -0.01], [0.48, 0.02],
    ],
    shroudMat,
    sectionDark,
    { c: 0.02, full: true },
  );
  wheelAll.add(shroud.full, shroud.cut);

  // steering column to the dash support
  const column = mesh(new THREE.CylinderGeometry(0.16, 0.16, 0.55, 28), steelDark, rig);
  column.rotation.z = Math.PI / 2;
  column.position.set(-1.1, HY, 0);
  const dashPost = beveledBox(0.34, 1.7, 0.9, frameMat, 0.05);
  dashPost.position.set(-1.45, 0.85 + 0.3, 0);
  rig.add(dashPost);
  const crossMember = beveledBox(0.34, 0.4, 2.1, frameMat, 0.05);
  crossMember.position.set(-1.45, 0.2, 0);
  rig.add(crossMember);

  // --- the module: cover flaps, bezel, tear seam -----------------------------------
  function flapGeometry(upper) {
    const R = COVER_R;
    const pts = [];
    for (let i = 0; i <= 28; i++) {
      const a = (i / 28) * Math.PI;
      const yy = R * Math.sin(a) - R;
      pts.push(new THREE.Vector2(R * Math.cos(a), upper ? yy : -yy));
    }
    return new THREE.ExtrudeGeometry(new THREE.Shape(pts), {
      depth: 0.05,
      bevelEnabled: true,
      bevelSize: 0.008,
      bevelThickness: 0.008,
      bevelSegments: 2,
      curveSegments: 1,
    });
  }
  const flapU = new THREE.Group();
  flapU.position.set(0, COVER_R, 0);
  const flapUMesh = mesh(flapGeometry(true), coverMat, flapU);
  flapUMesh.rotation.y = Math.PI / 2;
  flapUMesh.position.x = 0.008;
  const flapL = new THREE.Group();
  flapL.position.set(0, -COVER_R, 0);
  const flapLMesh = mesh(flapGeometry(false), coverMat, flapL);
  flapLMesh.rotation.y = Math.PI / 2;
  flapLMesh.position.x = 0.008;
  ax.add(flapU, flapL);

  const seam = beveledBox(0.012, 0.012, COVER_R * 2 - 0.04, new THREE.MeshStandardMaterial({ color: 0x050506, roughness: 1 }), 0.004);
  seam.position.set(0.045, 0, 0);
  ax.add(seam);
  const bezel = mesh(new THREE.TorusGeometry(COVER_R + 0.02, 0.016, 12, 64), bezelMat, ax);
  bezel.rotation.y = Math.PI / 2;
  bezel.position.x = 0.03;

  // --- inside the module (visible in the cutaway only) ----------------------------
  const inside = new THREE.Group();
  ax.add(inside);

  const housing = turned(
    [[0.52, 0.015], [0.52, -0.03], [0.49, -0.03], [0.49, -0.55], [0.0, -0.55], [0.0, -0.52], [0.465, -0.52], [0.465, 0.015]],
    steelDark,
    sectionSteel,
    { c: 0.01 },
  );
  inside.add(housing.cut);

  // folded bag: alternating cream slabs so the section reads as pleats
  const folds = new THREE.Group();
  inside.add(folds);
  {
    let a = -0.5;
    for (let i = 0; i < 8; i++) {
      const t = 0.0345;
      const part = turned(rect(0.232, 0.462 - (i % 2) * 0.012, a, a + t - 0.004), i % 2 ? fabricB : fabricA, i % 2 ? fabricB : fabricA, { c: 0.004 });
      folds.add(part.cut);
      a += t;
    }
    a = -0.2;
    for (let i = 0; i < 6; i++) {
      const t = 0.0295;
      const part = turned(rect(0.0, 0.462 - (i % 2) * 0.012, a, a + t - 0.004), i % 2 ? fabricB : fabricA, i % 2 ? fabricB : fabricA, { c: 0.004 });
      folds.add(part.cut);
      a += t;
    }
  }

  // inflator: can with filter, two propellant chambers, two squibs
  const inflator = new THREE.Group();
  inside.add(inflator);
  {
    const can = turned(
      [
        [0.0, -0.52], [0.32, -0.52], [0.32, -0.495], [0.228, -0.495], [0.228, -0.26], [0.2, -0.215], [0.0, -0.205],
        [0.0, -0.225], [0.185, -0.235], [0.208, -0.27], [0.208, -0.475], [0.0, -0.475],
      ],
      steelBright,
      sectionSteel,
      { c: 0.008 },
    );
    inflator.add(can.cut);
    inflator.add(turned(rect(0.17, 0.203, -0.475, -0.255), filterMat, filterCap, { c: 0.004 }).cut);
    inflator.add(turned(rect(0.162, 0.168, -0.475, -0.27), steelDark, sectionSteel, { c: 0.002 }).cut);
    inflator.add(turned(rect(0.1, 0.106, -0.475, -0.3), steelDark, sectionSteel, { c: 0.002 }).cut);
    inflator.add(turned([[0.0, -0.475], [0.042, -0.475], [0.042, -0.33], [0.025, -0.305], [0.0, -0.3]], brassMat, sectionSteel, { c: 0.004 }).cut);
  }
  // gas ports as dark dots on the far inner wall of the can (the open half)
  const portMat = new THREE.MeshBasicMaterial({ color: 0x050506, side: THREE.DoubleSide });
  const portGeo = new THREE.CircleGeometry(0.018, 16);
  for (let i = 0; i < 16; i++) {
    const phi = (i / 16) * Math.PI * 2;
    if (Math.cos(phi) >= -0.2) continue;
    const dotI = new THREE.Mesh(portGeo, portMat);
    dotI.position.set(-0.3, Math.sin(phi) * 0.2065, Math.cos(phi) * 0.2065);
    dotI.quaternion.setFromUnitVectors(new THREE.Vector3(0, 0, 1), new THREE.Vector3(0, -Math.sin(phi), -Math.cos(phi)));
    inflator.add(dotI);
  }

  // squibs: A on the axis, B up at the rim of the second chamber
  const squibA = new THREE.Group();
  squibA.position.set(-0.52, 0, 0);
  const squibABody = mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.1, 20), brassMat, squibA);
  squibABody.rotation.z = Math.PI / 2;
  squibABody.position.x = -0.05;
  const squibB = new THREE.Group();
  squibB.position.set(-0.49, 0.136, 0);
  const squibBBody = mesh(new THREE.CylinderGeometry(0.032, 0.032, 0.09, 20), brassMat, squibB);
  squibBBody.rotation.z = Math.PI / 2;
  squibBBody.position.x = -0.045;
  inflator.add(squibA, squibB);
  // bridgewires glow when current arrives
  const bridgeMatA = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });
  const bridgeMatB = new THREE.MeshBasicMaterial({ color: 0xffd9a0, toneMapped: false });
  const bridgeA = mesh(new THREE.SphereGeometry(0.03, 16, 12), bridgeMatA, inflator, { cast: false });
  bridgeA.position.set(-0.335, 0, 0);
  const bridgeB = mesh(new THREE.SphereGeometry(0.022, 16, 12), bridgeMatB, inflator, { cast: false });
  bridgeB.position.set(-0.36, 0.136, 0);
  const squibGlow = [bridgeMatA, bridgeMatB];

  // propellant pellets: tablets on the far side of each chamber
  const rand = rng(7);
  const pelletData = [];
  const PEL_A = 46;
  const PEL_B = 84;
  for (let i = 0; i < PEL_A + PEL_B; i++) {
    const chamber = i < PEL_A ? 0 : 1;
    const r = chamber ? 0.114 + rand() * 0.046 : 0.05 + rand() * 0.045;
    const phi = Math.PI / 2 + rand() * Math.PI; // far half (z <= 0)
    const a = -0.465 + rand() * 0.15;
    const y = r * Math.sin(phi);
    const z = r * Math.cos(phi);
    const dist = chamber ? Math.hypot(y - 0.136, z) / 0.3 : r / 0.1;
    pelletData.push({ chamber, pos: new THREE.Vector3(a, y, z), q: new THREE.Quaternion().setFromEuler(new THREE.Euler(rand() * 6, rand() * 6, rand() * 6)), dist });
  }
  const pelletMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const pellets = new THREE.InstancedMesh(new THREE.CylinderGeometry(0.0125, 0.0125, 0.0075, 10), pelletMat, pelletData.length);
  pellets.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  pellets.frustumCulled = false;
  for (let i = 0; i < pelletData.length; i++) pellets.setColorAt(i, new THREE.Color(0.6, 0.64, 0.72));
  inflator.add(pellets);

  // hot gas leaving the inflator and filling the bag
  const NG = 64;
  const gas = flowField(NG, 0.05, { opacity: 0.85 });
  ax.add(gas.mesh);
  gas.mesh.userData.noOcclude = true;
  const gasSeed = Array.from({ length: NG }, (_, i) => ({
    ph: (i * 0.6180339) % 1,
    az: rand() * Math.PI * 2,
    r0: 0.05 + rand() * 0.11,
    k1: 0.25 + rand() * 0.75,
    k2: 0.15 + rand() * 0.85,
  }));

  // --- the bag ------------------------------------------------------------------
  const NT = 40;
  const NP = 56;
  const bagGeo = new THREE.BufferGeometry();
  const bagPos = new Float32Array((NT + 1) * (NP + 1) * 3);
  const bagCol = new Float32Array((NT + 1) * (NP + 1) * 3);
  {
    const idx = [];
    for (let j = 0; j < NT; j++) {
      for (let k = 0; k < NP; k++) {
        const a = j * (NP + 1) + k;
        const b = a + 1;
        const c = a + NP + 1;
        const d = c + 1;
        idx.push(a, c, b, b, c, d);
      }
    }
    bagGeo.setIndex(idx);
    for (let j = 0; j <= NT; j++) {
      const th = (j / NT) * Math.PI;
      const seamDark = 1 - 0.22 * Math.exp(-(((th - Math.PI / 2) / 0.05) ** 2));
      for (let k = 0; k <= NP; k++) {
        const o = (j * (NP + 1) + k) * 3;
        bagCol[o] = bagCol[o + 1] = bagCol[o + 2] = seamDark;
      }
    }
    bagGeo.setAttribute('position', new THREE.BufferAttribute(bagPos, 3));
    bagGeo.setAttribute('color', new THREE.BufferAttribute(bagCol, 3));
  }
  const bag = new THREE.Mesh(bagGeo, bagMat);
  bag.castShadow = true;
  bag.frustumCulled = false;
  bag.renderOrder = 3;
  ax.add(bag);

  const P_EXP = 2.7;
  const bagP = { D: 1, R: 1, wr: 0, head: false, xh: 9 };
  const _o = new THREE.Vector3();
  // surface of revolution point at (theta, phi); returns into `out`
  function bagShape(th, ph, out, withHead = true) {
    const c = Math.cos(th);
    const s = Math.sin(th);
    const u = 0.5 * (1 - Math.sign(c) * Math.pow(Math.abs(c), 2 / P_EXP));
    let r = bagP.R * Math.pow(Math.abs(s), 2 / P_EXP);
    r *= 1 + bagP.wr * Math.sin(5 * th + 1.7) * Math.sin(9 * ph + 2.1 * th);
    let x = 0.02 + 0.1 * Math.min(1, r / 0.8) + bagP.D * u;
    const y = r * Math.sin(ph);
    const z = r * Math.cos(ph);
    if (withHead && bagP.head && u > 0.35) {
      const d = Math.hypot(y - HEAD_DY, z);
      const xs = d < HEAD_R ? bagP.xh - Math.sqrt(HEAD_R * HEAD_R - d * d) : bagP.xh + (d - HEAD_R) * 0.6;
      x = Math.min(x, xs - 0.015);
    }
    return out.set(x, y, z);
  }
  function remeshBag() {
    for (let j = 0; j <= NT; j++) {
      const th = (j / NT) * Math.PI;
      for (let k = 0; k <= NP; k++) {
        const ph = Math.PI + (k / NP) * Math.PI * 2;
        bagShape(th, ph, _o);
        const o = (j * (NP + 1) + k) * 3;
        bagPos[o] = _o.x;
        bagPos[o + 1] = _o.y;
        bagPos[o + 2] = _o.z;
      }
    }
    bagGeo.attributes.position.needsUpdate = true;
    bagGeo.computeVertexNormals();
    bagGeo.computeBoundingBox();
    bagGeo.computeBoundingSphere();
  }

  // vent holes: a dark disc + reinforcing ring riding the bag surface
  const ventParts = [];
  {
    const ringMat = new THREE.MeshStandardMaterial({ color: 0x8b8068, roughness: 0.9 });
    const holeMat = new THREE.MeshBasicMaterial({ color: 0x050506, side: THREE.DoubleSide });
    for (const ph of [0, Math.PI]) {
      const g = new THREE.Group();
      mesh(new THREE.TorusGeometry(0.062, 0.012, 8, 24), ringMat, g, { cast: false });
      mesh(new THREE.CircleGeometry(0.052, 20), holeMat, g, { cast: false, receive: false });
      ax.add(g);
      ventParts.push({ g, ph });
    }
  }
  const TH_V = 1.28;
  const _p0 = new THREE.Vector3();
  const _p1 = new THREE.Vector3();
  const _p2 = new THREE.Vector3();
  const _n = new THREE.Vector3();
  const _zq = new THREE.Vector3(0, 0, 1);
  const ventState = ventParts.map(() => ({ pos: new THREE.Vector3(), n: new THREE.Vector3() }));
  function placeVents(show) {
    ventParts.forEach((v, i) => {
      v.g.visible = show;
      if (!show) return;
      bagShape(TH_V, v.ph, _p0, false);
      bagShape(TH_V + 0.03, v.ph, _p1, false);
      bagShape(TH_V, v.ph + 0.03, _p2, false);
      _n.copy(_p1).sub(_p0).cross(_p2.sub(_p0)).normalize();
      _o.set(0, _p0.y, _p0.z); // outward = away from the axis
      if (_n.dot(_o) < 0) _n.negate();
      v.g.position.copy(_p0).addScaledVector(_n, 0.008);
      v.g.quaternion.setFromUnitVectors(_zq, _n);
      ventState[i].pos.copy(_p0);
      ventState[i].n.copy(_n);
    });
  }
  // gas leaving the vents
  const NV = 36;
  const puffs = flowField(NV, 0.09, { opacity: 0.5 });
  ax.add(puffs.mesh);
  puffs.mesh.userData.noOcclude = true;
  puffs.mesh.renderOrder = 6;
  for (let i = 0; i < NV; i++) puffs.mesh.setColorAt(i, new THREE.Color(0.92, 0.96, 1));
  const puffSeed = Array.from({ length: NV }, (_, i) => ({ ph: (i * 0.381966) % 1, jx: rand() - 0.5, jy: rand() - 0.5 }));

  // --- the headform and its ram ---------------------------------------------------
  const head = new THREE.Group();
  head.position.set(headX(MS0), HEAD_DY, 0);
  ax.add(head);
  mesh(new THREE.SphereGeometry(HEAD_R, 48, 32), headMat, head);
  const neck = mesh(new THREE.CylinderGeometry(0.17, 0.2, 0.08, 28), steelDark, head);
  neck.rotation.z = Math.PI / 2;
  neck.position.x = HEAD_R + 0.02;
  const ram = mesh(new THREE.CylinderGeometry(0.07, 0.07, 2.5, 20), steelBright, head);
  ram.rotation.z = Math.PI / 2;
  ram.position.x = HEAD_R + 0.06 + 1.25;
  // a target ring so you can see the headform slide
  const headBand = mesh(new THREE.TorusGeometry(HEAD_R * 0.98, 0.014, 8, 48), new THREE.MeshStandardMaterial({ color: 0xff8a3d, roughness: 0.5 }), head, { cast: false });
  headBand.rotation.y = Math.PI / 2;
  headBand.position.x = -0.02;
  const standPost = beveledBox(0.5, 1.9, 0.62, frameMat, 0.06);
  standPost.position.set(3.7, 0.95, 0);
  rig.add(standPost);
  const guide = mesh(new THREE.CylinderGeometry(0.17, 0.17, 1.6, 28), steelDark, rig);
  guide.rotation.z = Math.PI / 2;
  guide.position.set(3.65, HY + HEAD_DY, 0);

  // --- crash end: barrier, bumper, crush cans, rails, sensor ----------------------
  const rails = new THREE.Group();
  rig.add(rails);
  for (const zs of [-1, 1]) {
    const rail = beveledBox(0.5, 0.34, 0.3, frameMat, 0.04);
    rail.position.set(-1.78, 0.2, zs * 0.8);
    rails.add(rail);
  }
  const canGroups = [];
  for (const zs of [-1, 1]) {
    const can = new THREE.Group();
    can.position.set(-1.84 - 0.0, 0.2, zs * 0.8);
    const body = beveledBox(0.6, 0.3, 0.26, new THREE.MeshStandardMaterial({ color: 0x9fa6b0, metalness: 0.7, roughness: 0.5 }), 0.03);
    body.position.x = -0.3;
    can.add(body);
    for (let i = 1; i < 6; i++) {
      const g = beveledBox(0.016, 0.31, 0.275, new THREE.MeshStandardMaterial({ color: 0x23262b, metalness: 0.5, roughness: 0.8 }), 0.004);
      g.position.x = -i * 0.1;
      can.add(g);
    }
    rig.add(can);
    canGroups.push(can);
  }
  const bumper = beveledBox(0.22, 0.46, 2.2, frameMat, 0.05);
  bumper.position.set(-2.55, 0.25, 0);
  rig.add(bumper);
  const barrier = beveledBox(0.5, 1.5, 3.0, concreteMat, 0.05);
  barrier.position.set(-4, 0.75, 0);
  rig.add(barrier);
  // hazard bands on the barrier's face
  const hazardMat = new THREE.MeshStandardMaterial({ color: 0xe0b020, roughness: 0.7, transparent: true });
  for (let i = 0; i < 5; i++) {
    const b = beveledBox(0.02, 0.2, 0.28, hazardMat, 0.006);
    b.position.set(0.255, -0.5, -1.1 + i * 0.55);
    barrier.add(b);
  }
  barrier.userData.hazard = hazardMat;

  // satellite crash sensor on the near rail
  const sat = new THREE.Group();
  sat.position.set(-1.7, 0.2, 1.0);
  rig.add(sat);
  const satBody = beveledBox(0.3, 0.2, 0.12, new THREE.MeshStandardMaterial({ color: 0x20232a, roughness: 0.6 }), 0.025);
  sat.add(satBody);
  const satLedMat = new THREE.MeshBasicMaterial({ color: 0x24ff8a, toneMapped: false });
  const satLed = mesh(new THREE.SphereGeometry(0.035, 12, 10), satLedMat, sat, { cast: false });
  satLed.position.set(0.08, 0.04, 0.07);
  const satPlug = beveledBox(0.1, 0.1, 0.08, new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 }), 0.015);
  satPlug.position.set(0.19, -0.02, 0);
  sat.add(satPlug);

  // --- the control unit ----------------------------------------------------------
  const acu = new THREE.Group();
  acu.position.set(0.55, 0.0, 0);
  rig.add(acu);
  const acuBox = beveledBox(1.0, 0.4, 0.8, materials.aluminum(0xa7aeb8), 0.04);
  acuBox.position.set(0, 0.2, 0);
  acu.add(acuBox);
  for (let i = 0; i < 7; i++) {
    const rib = beveledBox(0.04, 0.03, 0.8, materials.aluminum(0x8d949e), 0.008);
    rib.position.set(-0.36 + i * 0.12, 0.41, 0);
    acu.add(rib);
  }
  const acuPlate = beveledBox(0.34, 0.012, 0.22, new THREE.MeshStandardMaterial({ color: 0x1b1d22, roughness: 0.8 }), 0.004);
  acuPlate.position.set(0.28, 0.43, 0.2);
  acu.add(acuPlate);
  const acuLedMat = new THREE.MeshBasicMaterial({ color: 0x24ff8a, toneMapped: false });
  const acuLed = mesh(new THREE.SphereGeometry(0.04, 12, 10), acuLedMat, acu, { cast: false });
  acuLed.position.set(-0.4, 0.43, 0.3);
  const plugA = beveledBox(0.1, 0.18, 0.2, new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 }), 0.02);
  plugA.position.set(-0.55, 0.2, 0.2);
  acu.add(plugA);
  const plugB = beveledBox(0.2, 0.1, 0.1, new THREE.MeshStandardMaterial({ color: 0xf2c230, roughness: 0.6 }), 0.02);
  plugB.position.set(-0.3, 0.45, -0.25);
  acu.add(plugB);

  // yellow SRS harness: sensor -> unit, unit -> squib
  const harness1 = tubeAlong(
    [[-1.55, 0.2, 1.0], [-1.25, 0.1, 1.1], [-0.8, 0.07, 0.8], [-0.35, 0.1, 0.35], [0.0, 0.2, 0.2]].map(([x, y, z]) => [x, y, z]),
    0.03,
    wireMat,
    { tubularSegments: 60, radialSegments: 10 },
  );
  rig.add(harness1);
  const harness2 = tubeAlong(
    [
      [0.25, 0.45, -0.25], [0.1, 0.8, -0.5], [-0.4, 1.15, -0.5], [-0.85, HY - 0.15, -0.3], [-0.75, HY + 0.25, -0.12],
      [-0.7, HY + 0.1, -0.05], [-0.62, HY, 0],
    ],
    0.03,
    wireMat,
    { tubularSegments: 90, radialSegments: 10 },
  );
  rig.add(harness2);
  const wireB = tubeAlong([[-0.72, HY + 0.1, -0.05], [-0.66, HY + 0.17, 0], [-0.58, HY + 0.136, 0]], 0.022, wireMat, {
    tubularSegments: 20,
    radialSegments: 8,
  });
  rig.add(wireB);
  const pulse1 = chargeQueue(harness1.userData.curve, 7, 0xfff1a8, { size: 0.045, spacing: 0.06 });
  rig.add(pulse1.group);
  const pulse2 = chargeQueue(harness2.userData.curve, 7, 0xfff1a8, { size: 0.045, spacing: 0.06 });
  rig.add(pulse2.group);

  // --- the MEMS accelerometer, enlarged beside the unit --------------------------
  const mems = new THREE.Group();
  mems.position.set(2.3, 0.88, 0.55);
  rig.add(mems);
  const die = beveledBox(1.8, 1.3, 0.05, new THREE.MeshStandardMaterial({ color: 0x2b3340, metalness: 0.4, roughness: 0.55 }), 0.03);
  mems.add(die);
  const dieGlass = mesh(new THREE.PlaneGeometry(1.7, 1.2), new THREE.MeshBasicMaterial({ color: 0x0c0f14 }), mems, { cast: false, receive: false });
  dieGlass.position.z = 0.027;
  const goldMat = new THREE.MeshStandardMaterial({ color: 0xe0ac3c, metalness: 0.9, roughness: 0.32 });
  const minusMat = new THREE.MeshStandardMaterial({ color: 0x3d8bff, emissive: 0x3d8bff, emissiveIntensity: 0.15, metalness: 0.5, roughness: 0.4 });
  const plusMat = new THREE.MeshStandardMaterial({ color: 0xff4fa3, emissive: 0xff4fa3, emissiveIntensity: 0.15, metalness: 0.5, roughness: 0.4 });
  const anchorMat = new THREE.MeshStandardMaterial({ color: 0x59626f, metalness: 0.7, roughness: 0.5 });
  const shuttle = new THREE.Group();
  shuttle.position.z = 0.05;
  mems.add(shuttle);
  const bx = (w, h, d, mat, x, y, z, parent) => {
    const m = beveledBox(w, h, d, mat, Math.min(w, h, d) * 0.3);
    m.position.set(x, y, z);
    parent.add(m);
    return m;
  };
  bx(0.84, 0.08, 0.05, goldMat, 0, 0, 0, shuttle);
  const PITCH = 0.14;
  for (let i = 0; i < 5; i++) {
    const x0 = -0.28 + i * PITCH;
    for (const sy of [-1, 1]) {
      bx(0.024, 0.3, 0.05, goldMat, x0, sy * 0.19, 0, shuttle); // moving finger
      bx(0.024, 0.34, 0.05, minusMat, x0 - 0.05, sy * 0.24, 0, mems).position.z = 0.05; // fixed finger, left
      bx(0.024, 0.34, 0.05, plusMat, x0 + 0.05, sy * 0.24, 0, mems).position.z = 0.05; // fixed finger, right
    }
  }
  for (const sy of [-1, 1]) bx(0.9, 0.07, 0.05, anchorMat, 0, sy * 0.44, 0.05, mems);
  for (const sx of [-1, 1]) bx(0.12, 0.34, 0.05, anchorMat, sx * 0.72, 0, 0.05, mems);
  // folded springs (stretch with the shuttle)
  const springPts = (len) => {
    const pts = [];
    for (let i = 0; i <= 8; i++) pts.push([(i / 8) * len, (i % 2 ? 1 : -1) * 0.06 * (i === 0 || i === 8 ? 0 : 1), 0]);
    return pts;
  };
  const springL = new THREE.Group();
  springL.position.set(-0.66, 0, 0.05);
  const springLMesh = tubeAlong(springPts(0.22), 0.012, goldMat, { tubularSegments: 40, radialSegments: 6, tension: 0.5 });
  springL.add(springLMesh);
  const springR = new THREE.Group();
  springR.position.set(0.44, 0, 0.05);
  const springRMesh = tubeAlong(springPts(0.22), 0.012, goldMat, { tubularSegments: 40, radialSegments: 6, tension: 0.5 });
  springR.add(springRMesh);
  mems.add(springL, springR);
  // threshold gauge
  const gauge = new THREE.Group();
  gauge.position.set(1.18, 0, 0.05);
  mems.add(gauge);
  bx(0.14, 1.04, 0.04, new THREE.MeshStandardMaterial({ color: 0x14161a, roughness: 0.8 }), 0, 0, 0, gauge);
  const gaugeFillMat = new THREE.MeshStandardMaterial({ color: 0xff8a3d, emissive: 0xff6a1a, emissiveIntensity: 0.6, roughness: 0.4 });
  const gaugeFill = new THREE.Mesh(new THREE.BoxGeometry(0.1, 1, 0.05), gaugeFillMat);
  gaugeFill.geometry.translate(0, 0.5, 0);
  gaugeFill.position.set(0, -0.46, 0.015);
  gauge.add(gaugeFill);
  const thrMat = new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false });
  const thrBar = new THREE.Mesh(new THREE.BoxGeometry(0.3, 0.025, 0.06), thrMat);
  thrBar.position.set(0, 0.46, 0.03);
  gauge.add(thrBar);
  // magnifier lines from the unit to the enlarged die
  {
    const lineMat = new THREE.LineBasicMaterial({ color: 0xcfd6e0, transparent: true, opacity: 0.35 });
    const lg = new THREE.BufferGeometry().setFromPoints([
      new THREE.Vector3(1.06, 0.43, 0.2), new THREE.Vector3(1.4, 0.23, 0.58),
      new THREE.Vector3(1.06, 0.43, 0.2), new THREE.Vector3(1.4, 1.5, 0.58),
    ]);
    const lines = new THREE.LineSegments(lg, lineMat);
    lines.userData.noOcclude = true;
    mems.userData.lines = lines;
    rig.add(lines);
  }
  mems.visible = false;

  // --- the clock -------------------------------------------------------------------
  const clockCanvas = document.createElement('canvas');
  clockCanvas.width = 512;
  clockCanvas.height = 200;
  const clockCtx = clockCanvas.getContext('2d');
  const clockTex = new THREE.CanvasTexture(clockCanvas);
  clockTex.colorSpace = THREE.SRGBColorSpace;
  const clockMat = new THREE.SpriteMaterial({ map: clockTex, transparent: true, depthWrite: false, depthTest: false, toneMapped: false });
  const clock = new THREE.Sprite(clockMat);
  clock.scale.set(1.5, 0.585, 1);
  clock.position.set(0.9, 3.12, 0);
  clock.renderOrder = 30;
  clock.userData.noOcclude = true;
  rig.add(clock);
  let clockKey = '';
  function drawClock(ms, phase, accent) {
    const key = `${ms}|${phase}`;
    if (key === clockKey) return;
    clockKey = key;
    const g = clockCtx;
    g.clearRect(0, 0, 512, 200);
    g.fillStyle = 'rgba(12,14,18,0.82)';
    g.beginPath();
    g.roundRect(6, 6, 500, 188, 28);
    g.fill();
    g.strokeStyle = accent;
    g.lineWidth = 4;
    g.stroke();
    g.fillStyle = '#f2f4f8';
    g.font = '700 92px "Segoe UI", Arial, sans-serif';
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillText(`${ms} ms`, 256, 84);
    g.fillStyle = accent;
    g.font = '700 38px "Segoe UI", Arial, sans-serif';
    g.fillText(phase, 256, 154);
    clockTex.needsUpdate = true;
  }

  // --- callouts --------------------------------------------------------------------
  const labels = calloutSets(['exterior', 'inside', 'sense', 'ignite', 'burst', 'land', 'stages']);
  const L = (set, parent, text, pos, dir, len) => labels.add(set, parent, text, pos, dir, len);
  // exterior — the solid rig
  L('exterior', flapU, 'Airbag cover', [0.07, -0.3, 0.2], 120, 80);
  L('exterior', seam, 'Tear seam', [0.01, 0, -0.3], 160, 70);
  L('exterior', head, 'Test headform', [-0.1, 0.1, 0.38], 40, 60);
  L('exterior', acuBox, 'Control unit (ACU)', [0, 0.2, 0.4], 0, 70);
  // inside — the cutaway module
  L('inside', folds.children[3], 'Folded bag', [-0.35, 0.38, 0.03], 160, 70);
  L('inside', inflator, 'Inflator', [-0.4, 0.215, 0.03], 140, 70);
  L('inside', squibA, 'Squib (igniter)', [-0.06, 0.0, 0.075], 200, 60);
  // sense
  L('sense', satBody, 'Crush-zone sensor', [0, 0.1, 0.06], 60, 60);
  L('sense', acuBox, 'Control unit (ACU)', [0.2, 0.2, 0.4], 330, 70);
  L('sense', shuttle, 'Sensing comb', [0, 0.0, 0.03], 60, 80);
  L('sense', thrBar, 'Fire threshold', [0.15, 0, 0], 30, 55);
  // ignite
  L('ignite', squibA, 'Squib (igniter)', [-0.06, 0.0, 0.075], 220, 55);
  L('ignite', inflator, 'Propellant pellets', [-0.4, 0.075, 0.03], 270, 55);
  L('ignite', inflator, 'Filter', [-0.36, 0.188, 0.03], 60, 60);
  // burst
  L('burst', flapU, 'Cover flap', [0.07, -0.1, 0.05], 160, 70);
  L('burst', head, 'Test headform', [0, 0.25, 0.38], 60, 60);
  // land
  L('land', head, 'Test headform', [0, 0.25, 0.38], 60, 60);
  L('land', ventParts[0].g, 'Vent hole', [0, 0, 0], 120, 55);
  // stages
  L('stages', inflator, 'Stage 1 chamber', [-0.4, 0.075, 0.03], 250, 70);
  L('stages', inflator, 'Stage 2 chamber', [-0.4, 0.14, 0.03], 80, 70);

  // the cutaway's labels sit on the section plane; nothing in the module should dim them
  for (const root of [inside, shroud.cut, flapU, flapL]) root.traverse((o) => (o.userData.noOcclude = true));

  // --- state and pose ----------------------------------------------------------------
  const state = {
    ms: MS0, // milliseconds since first contact
    sev: 2, // crash severity: 1 mild (stage 1 only), 2 severe (both stages)
    cut: 0, // 1 = module cut open, near half of the wheel removed
    macro: 0, // 1 = enlarged MEMS die + gauge shown
    alpha: 1, // bag + clock opacity (the rewind fades them)
    ghost: 0, // 0..1 bag see-through (to watch the gas inside)
    barrier: 1,
    clock: 1,
    folds: 1,
    stageText: 0,
    clockNear: 0,
  };

  const _q = new THREE.Quaternion();
  const _up = new THREE.Vector3(0, 1, 0);
  const _tmpA = new THREE.Vector3();
  const _tmpB = new THREE.Vector3();
  const _tmpC = new THREE.Vector3();
  const _m4 = new THREE.Matrix4();
  const _s3 = new THREE.Vector3();
  const _col = new THREE.Color();

  function apply() {
    const t = state.ms;
    const sev = state.sev;
    const cut = state.cut >= 0.5;
    const alpha = state.alpha;

    // ---------- crash end ----------
    const crush = win(t, 0, 80);
    const canLen = 0.6 - 0.34 * crush;
    for (const c of canGroups) c.scale.x = canLen / 0.6;
    const bumperX = -2.55 + 0.34 * crush;
    bumper.position.x = bumperX;
    const face = bumperX - 0.11;
    const gap = t < 0 ? 1.35 * clamp01(-t / 24) : 0;
    barrier.position.x = face - gap - 0.25;
    barrier.visible = state.barrier > 0.5;
    const bAlpha = clamp01((t + 24) / 3) * 1;
    concreteMat.opacity = bAlpha;
    hazardMat.opacity = bAlpha;

    // ---------- sensing ----------
    const pulse = win(t, 1, 8) * (1 - 0.5 * win(t, 30, 75)) * (1 - win(t, 90, 150));
    const wob = 0.07 * Math.sin(t * 0.9) * win(t, 3, 10) * (1 - win(t, 60, 100));
    const accel = clamp01(pulse + wob);
    const s = -0.065 * accel; // the proof mass lags: toward the front
    shuttle.position.x = s;
    springL.scale.x = (0.22 + s) / 0.22;
    springR.position.x = 0.44 + s;
    springR.scale.x = (0.22 - s) / 0.22;
    minusMat.emissiveIntensity = 0.15 + 3.4 * clamp01(-s / 0.065);
    plusMat.emissiveIntensity = 0.15 + 0.2 * clamp01(s / 0.065);
    const gv = clamp01((t - 4) / 16);
    gaugeFill.scale.y = Math.max(0.001, gv * 0.92);
    const fired = t >= 20;
    thrMat.color.setRGB(fired ? 3 : 1, fired ? 0.4 : 1, fired ? 0.2 : 1);
    gaugeFillMat.emissiveIntensity = 0.5 + (fired ? 1.6 : 0);
    const satFlash = win(t, 2, 4) * (1 - win(t, 8, 10));
    satLedMat.color.setRGB(0.14 + 3 * satFlash, 1 - 0.55 * satFlash, 0.54 - 0.4 * satFlash);
    acuLedMat.color.setRGB(fired ? 3 : 0.14, fired ? 0.3 : 1, fired ? 0.2 : 0.54);

    // harness packets: signal crossing, then the fire current
    const f1 = (t - 3) / 5;
    pulse1.setFront(f1 * 1.45, f1 > 0 && f1 < 1.05);
    const f2 = (t - 20) / 2.2;
    pulse2.setFront(f2 * 1.45, f2 > 0 && f2 < 1.05);

    // ---------- inflator ----------
    const tIgnA = 22;
    const tIgnB = 30;
    const bridgeFlashA = win(t, tIgnA - 0.5, tIgnA + 0.5) * (1 - win(t, tIgnA + 2, tIgnA + 6));
    const bridgeFlashB = sev === 2 ? win(t, tIgnB - 0.5, tIgnB + 0.5) * (1 - win(t, tIgnB + 2, tIgnB + 6)) : 0;
    squibGlow[0].color.setRGB(0.5 + 3.5 * bridgeFlashA, 0.4 + 1.2 * bridgeFlashA, 0.2 + 0.2 * bridgeFlashA);
    squibGlow[1].color.setRGB(0.5 + 3.5 * bridgeFlashB, 0.4 + 1.2 * bridgeFlashB, 0.2 + 0.2 * bridgeFlashB);
    for (let i = 0; i < pelletData.length; i++) {
      const p = pelletData[i];
      let burn = 0;
      let glow = 0;
      if (p.chamber === 0 || sev === 2) {
        const t0 = (p.chamber ? tIgnB : tIgnA) + p.dist * 4.5;
        burn = win(t, t0, t0 + 4);
        glow = win(t, t0 - 0.2, t0 + 1) * (1 - win(t, t0 + 2, t0 + 5));
      }
      const sc = Math.max(0.02, 1 - burn);
      _m4.compose(p.pos, p.q, _s3.setScalar(sc));
      pellets.setMatrixAt(i, _m4);
      pellets.setColorAt(i, p.chamber ? _col.setRGB(0.78 + 2.5 * glow, 0.58 + 0.8 * glow, 0.32 - 0.1 * glow) : _col.setRGB(0.6 + 2.7 * glow, 0.64 + 0.8 * glow, 0.72 - 0.4 * glow));
    }
    pellets.instanceMatrix.needsUpdate = true;
    pellets.instanceColor.needsUpdate = true;

    // ---------- the cover and the bag ----------
    const open = win(t, 26, 35);
    const theta = 1.48 * open + 0.07 * Math.sin(Math.PI * win(t, 35, 43));
    flapU.rotation.z = theta;
    flapL.rotation.z = -theta;
    const f = sev === 2 ? win(t, 26, 47) : 0.84 * win(t, 26, 49);
    const fill = 1 - 0.88 * win(t, 48, 188);
    const dProg = win(f, 0, 0.62);
    const rProg = win(f, 0.15, 1);
    const Sd = sev === 2 ? 1 : 0.84;
    const Sr = sev === 2 ? 1 : 0.9;
    bagP.D = D_MAX * Sd * dProg * (0.4 + 0.6 * fill);
    bagP.R = R_MAX * Sr * (0.28 + 0.72 * rProg) * (0.55 + 0.45 * fill);
    bagP.wr = 0.09 * (1 - win(f, 0.2, 0.95)) + 0.1 * (1 - fill);
    const hx = headX(t);
    head.position.x = hx;
    const frontRest = 0.02 + bagP.D;
    const bulge = clamp01((frontRest - (hx - HEAD_R)) / 0.9);
    bagP.R *= 1 + 0.14 * bulge;
    bagP.head = true;
    bagP.xh = hx;
    const bagOn = f > 0.004 && alpha > 0.01;
    bag.visible = bagOn;
    if (bagOn) remeshBag();
    bagMat.opacity = alpha * (1 - 0.5 * state.ghost);
    bagMat.depthWrite = state.ghost < 0.5;
    folds.visible = cut && state.folds > 0.5 && f < 0.004;
    placeVents(bagOn && f > 0.9);

    // clock
    clock.visible = state.clock > 0.5 && alpha > 0.01;
    clockMat.opacity = alpha;
    if (state.clockNear) {
      clock.position.set(-0.55, 2.4, 0);
      clock.scale.set(0.66, 0.257, 1);
    } else {
      clock.position.set(0.9, 3.12, 0);
      clock.scale.set(1.5, 0.585, 1);
    }
    const msI = Math.max(0, Math.round(t));
    let phase = 'APPROACH';
    let accent = '#9aa3b2';
    if (t >= 0 && t < 20) [phase, accent] = ['SENSING', '#6fb1ff'];
    else if (t >= 20 && t < 26) [phase, accent] = ['FIRING', '#ff5a3c'];
    else if (t >= 26 && t < 46) [phase, accent] = ['INFLATING', '#ff8a3d'];
    else if (t >= 46 && t < 66) [phase, accent] = ['FULL AND VENTING', '#ffd27a'];
    else if (t >= 66) [phase, accent] = ['OCCUPANT LOADS BAG', '#7ddfc4'];
    if (state.stageText && t >= 20 && t < 62) {
      phase = sev === 1 ? 'STAGE 1 ONLY' : t < 30 ? 'STAGE 1' : 'STAGE 1 + 2';
      accent = sev === 1 ? '#7ddfc4' : '#ff5a3c';
    }
    drawClock(msI, phase, accent);

    // ---------- gas inside the inflator and bag ----------
    const gasRate = (win(t, tIgnA, tIgnA + 4) * (1 - win(t, 40, 52))) * (sev === 2 ? 1 : 0.7);
    const gasShow = (cut || state.ghost > 0.3) && gasRate > 0.02;
    gas.mesh.visible = gasShow;
    if (gasShow) {
      for (let i = 0; i < NG; i++) {
        const sd = gasSeed[i];
        const u = (sd.ph + (t - tIgnA) * 0.045) % 1;
        const uu = u < 0 ? u + 1 : u;
        let x;
        let r;
        if (uu < 0.3) {
          const k = uu / 0.3;
          x = -0.42 + 0.12 * k;
          r = sd.r0 + (0.215 - sd.r0) * k;
        } else {
          const k = (uu - 0.3) / 0.7;
          const xf = 0.05 + sd.k1 * Math.max(0.15, bagP.D) * 0.85;
          const rf = (0.12 + sd.k2 * 0.8) * Math.max(0.3, bagP.R) * 0.8;
          x = -0.3 + (xf + 0.3) * k;
          r = 0.215 + (rf - 0.215) * k;
        }
        const ca = Math.cos(sd.az);
        const sa = Math.sin(sd.az);
        _tmpA.set(x, r * sa, r * ca);
        // tangent by a small step
        const du = 0.01;
        const u2 = Math.min(1, uu + du);
        let x2;
        let r2;
        if (u2 < 0.3) {
          const k = u2 / 0.3;
          x2 = -0.42 + 0.12 * k;
          r2 = sd.r0 + (0.215 - sd.r0) * k;
        } else {
          const k = (u2 - 0.3) / 0.7;
          const xf = 0.05 + sd.k1 * Math.max(0.15, bagP.D) * 0.85;
          const rf = (0.12 + sd.k2 * 0.8) * Math.max(0.3, bagP.R) * 0.8;
          x2 = -0.3 + (xf + 0.3) * k;
          r2 = 0.215 + (rf - 0.215) * k;
        }
        _tmpB.set(x2, r2 * sa, r2 * ca).sub(_tmpA);
        if (_tmpB.lengthSq() < 1e-10) _tmpB.set(1, 0, 0);
        _q.setFromUnitVectors(_up, _tmpB.normalize());
        const edge = Math.min(1, uu / 0.06, (1 - uu) / 0.06);
        const hot = clamp01(1 - uu / 0.6);
        gas.set(i, _tmpA, _q, Math.max(0.001, edge * gasRate * 0.65), _col.setRGB(1.2 + hot * 1.2, 0.75 + 0.2 * (1 - hot) + hot * 0.2, 0.3 + 0.7 * (1 - hot)));
      }
      gas.commit();
      gas.material.opacity = 0.9;
    }

    // ---------- gas leaving the vents ----------
    const loading = win(t, 60, 100);
    const vrate = win(t, 44, 54) * (0.3 + 0.7 * loading) * (0.15 + 0.85 * fill) * (alpha > 0.5 ? 1 : 0);
    const puffOn = bagOn && f > 0.9 && vrate > 0.02;
    puffs.mesh.visible = puffOn;
    if (puffOn) {
      for (let i = 0; i < NV; i++) {
        const sd = puffSeed[i];
        const v = ventState[i % 2];
        const lf = (sd.ph + t * 0.02) % 1;
        _tmpA.copy(v.pos).addScaledVector(v.n, 0.08 + lf * 0.95);
        _tmpA.y += sd.jy * lf * 0.35;
        _tmpA.x += sd.jx * lf * 0.35;
        _q.setFromUnitVectors(_up, v.n);
        puffs.set(i, _tmpA, _q, Math.max(0.001, vrate * (0.5 + lf * 1.2) * (1 - lf * lf)), null);
      }
      puffs.commit();
    }

    // ---------- wheel, reveal ----------
    wheelNear.visible = !cut;
    shroud.full.visible = !cut;
    shroud.cut.visible = cut;
    inside.visible = cut;
    mems.visible = state.macro > 0.5;
    mems.userData.lines.visible = state.macro > 0.5;
  }
  apply();

  return {
    group,
    state,
    parts: { flapU, flapL, head, shuttle, bag, barrier, bumper, sat, acu, inflator, gaugeFill },
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
  };
}
