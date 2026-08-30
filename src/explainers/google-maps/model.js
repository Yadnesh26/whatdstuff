import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { materials, studioPlinth } from '../../framework/parts.js';
import { lathe, beveledBox } from '../../framework/geometry.js';
import { clamp01, smooth, win, TAU } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';
import * as G from './graph.js';

// A city district that peels into the graph underneath it. The story shape is
// zoom-in/reveal: step 1 is the finished map you would actually see (buildings,
// asphalt, a blue route), and the scroll strips it down to 81 junctions and 160
// road segments, then runs four real routing algorithms over them.
//
// PROPORTIONS (one scale, everything derived from PITCH):
//   junction pitch          0.55        -> district 4.4 across
//   road width              0.075 local ... 0.16 expressway  (1 : 2.1)
//   downtown tower height   up to 0.93  -> 1 : 4.7 against the district width
//   hierarchy tier spacing  0.30 / 0.58 / 0.90 above the map surface
// Real cities run ~100-200 m between junctions and 150 m for a tall tower, so
// the tower:block ratio here is deliberately compressed — a literal ratio would
// leave the buildings invisible at the wide framing every step uses.
//
// The algorithm output (settle orders, shortcuts, routes) all comes from
// graph.js, which runs the real thing. Nothing in this file draws a search
// result by hand.

const PLINTH_H = 0.22;
const GROUND_H = 0.06;
const SURFACE = PLINTH_H + GROUND_H; // the map surface everything sits on
const TILE = G.SPAN + 0.62;

const ROAD_Y = SURFACE + 0.005;
const EDGE_Y = SURFACE + 0.028;
const ROUTE_Y = SURFACE + 0.03;

const LIFT_Y = [0, 0.2, 0.38, 0.58]; // hierarchy tier heights, by road class
const ROAD_W = [0.075, 0.095, 0.125, 0.16];
const EDGE_W = [0.018, 0.024, 0.034, 0.05];

const BASE_ROT = 1.75; // the district's resting yaw (see buildGoogleMaps)

const ACCENT = 0x4285f4; // route blue
const AMBER = 0xff8a3d; // forward search
const VIOLET = 0xa07bff; // backward search
const PIN_A = 0x34a853;
const PIN_B = 0xea4335;

const ROAD_COLS = [0x353b44, 0x414954, 0x59616e, 0xa8862f];
const TRAFFIC_COLS = [0x2b8a55, 0xe0a92c, 0xd93b30]; // free / slow / jammed
const DIM_EDGE = new THREE.Color(0x4a6ea8);

const lerp = (a, b, t) => a + (b - a) * t;
const tmpColor = new THREE.Color();
const tmpColorB = new THREE.Color();
const tmpMat = new THREE.Matrix4();
const tmpVec = new THREE.Vector3();
const tmpQuat = new THREE.Quaternion();
const tmpScale = new THREE.Vector3();

function rnd(seed) {
  let t = (seed + 0x6d2b79f5) | 0;
  t = Math.imul(t ^ (t >>> 15), t | 1);
  t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
  return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

// Flat ribbon strips share one buffer: 4 verts per quad, all normals up. Used
// for both the asphalt (static) and the graph edges (which move when the
// hierarchy lifts), so the whole road network is two draw calls.
function ribbonGeometry(count) {
  const geo = new THREE.BufferGeometry();
  const pos = new Float32Array(count * 12);
  const col = new Float32Array(count * 12);
  const nrm = new Float32Array(count * 12);
  const idx = new Uint16Array(count * 6);
  for (let k = 0; k < count; k++) {
    const b = k * 4;
    idx.set([b, b + 2, b + 1, b + 1, b + 2, b + 3], k * 6);
    for (let v = 0; v < 4; v++) nrm[k * 12 + v * 3 + 1] = 1;
  }
  geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
  geo.setAttribute('normal', new THREE.BufferAttribute(nrm, 3));
  geo.setIndex(new THREE.BufferAttribute(idx, 1));
  return geo;
}

function writeQuad(arr, slot, ax, ay, az, bx, by, bz, halfW) {
  const dx = bx - ax;
  const dz = bz - az;
  const len = Math.hypot(dx, dz) || 1;
  const px = (-dz / len) * halfW;
  const pz = (dx / len) * halfW;
  const b = slot * 12;
  arr[b] = ax + px;
  arr[b + 1] = ay;
  arr[b + 2] = az + pz;
  arr[b + 3] = ax - px;
  arr[b + 4] = ay;
  arr[b + 5] = az - pz;
  arr[b + 6] = bx + px;
  arr[b + 7] = by;
  arr[b + 8] = bz + pz;
  arr[b + 9] = bx - px;
  arr[b + 10] = by;
  arr[b + 11] = bz - pz;
}

function writeSquare(arr, slot, x, y, z, half) {
  const b = slot * 12;
  arr[b] = x - half;
  arr[b + 1] = y;
  arr[b + 2] = z - half;
  arr[b + 3] = x + half;
  arr[b + 4] = y;
  arr[b + 5] = z - half;
  arr[b + 6] = x - half;
  arr[b + 7] = y;
  arr[b + 8] = z + half;
  arr[b + 9] = x + half;
  arr[b + 10] = y;
  arr[b + 11] = z + half;
}

function paintQuad(arr, slot, color) {
  const b = slot * 12;
  for (let v = 0; v < 4; v++) {
    arr[b + v * 3] = color.r;
    arr[b + v * 3 + 1] = color.g;
    arr[b + v * 3 + 2] = color.b;
  }
}

export function buildGoogleMaps({ scene }) {
  const group = new THREE.Group();
  // The district is yawed so the start->destination axis runs away from the
  // camera rather than across it: every search originates at the start pin, and
  // at any other angle that origin sits under the text panel.
  group.rotation.y = BASE_ROT;
  scene.add(group);

  group.add(studioPlinth({ w: TILE + 0.5, h: PLINTH_H, d: TILE + 0.5, color: 0x101318 }));

  // --- ground -------------------------------------------------------------
  const groundMat = materials.polymer(0x1c2027);
  groundMat.roughness = 0.9;
  groundMat.clearcoat = 0;
  const ground = beveledBox(TILE, GROUND_H, TILE, groundMat, 0.02);
  ground.position.y = PLINTH_H + GROUND_H / 2;
  ground.receiveShadow = true;
  group.add(ground);

  // --- asphalt (the map you see) -------------------------------------------
  const roadGeo = ribbonGeometry(G.edges.length + G.N);
  const roadPos = roadGeo.attributes.position.array;
  const roadCol = roadGeo.attributes.color.array;
  for (const e of G.edges) {
    const A = G.nodes[e.a];
    const B = G.nodes[e.b];
    writeQuad(roadPos, e.id, A.x, ROAD_Y, A.z, B.x, ROAD_Y, B.z, ROAD_W[e.cls] / 2);
  }
  for (const n of G.nodes) {
    writeSquare(roadPos, G.edges.length + n.id, n.x, ROAD_Y, n.z, ROAD_W[n.cls] / 2);
  }
  roadGeo.attributes.position.needsUpdate = true;
  const roadMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 0.92,
    metalness: 0.05,
    side: THREE.DoubleSide,
  });
  const roads = new THREE.Mesh(roadGeo, roadMat);
  roads.receiveShadow = true;
  group.add(roads);

  // --- park + trees (city dressing) ---------------------------------------
  const PARK_CELLS = [
    [4, 1],
    [5, 1],
  ];
  const cellCentre = (i, j) => {
    const a = G.nodes[j * G.GRID + i];
    const b = G.nodes[j * G.GRID + i + 1];
    const c = G.nodes[(j + 1) * G.GRID + i];
    const d = G.nodes[(j + 1) * G.GRID + i + 1];
    return { x: (a.x + b.x + c.x + d.x) / 4, z: (a.z + b.z + c.z + d.z) / 4 };
  };
  const dressing = []; // fades out with the buildings
  const parkMat = new THREE.MeshStandardMaterial({
    color: 0x24512f,
    roughness: 0.95,
    transparent: true,
    depthWrite: false,
  });
  for (const [ci, cj] of PARK_CELLS) {
    const c = cellCentre(ci, cj);
    const plate = beveledBox(G.PITCH * 0.8, 0.012, G.PITCH * 0.8, parkMat, 0.01);
    plate.position.set(c.x, ROAD_Y + 0.004, c.z);
    plate.castShadow = false;
    group.add(plate);
    dressing.push({ mesh: plate, mat: parkMat, base: 1 });
  }
  const treeMat = new THREE.MeshStandardMaterial({
    color: 0x2e6b3c,
    roughness: 0.85,
    transparent: true,
    depthWrite: false,
  });
  for (let t = 0; t < 6; t++) {
    const c = cellCentre(PARK_CELLS[t % 2][0], PARK_CELLS[t % 2][1]);
    const tree = new THREE.Mesh(new THREE.ConeGeometry(0.05, 0.15, 7), treeMat);
    tree.position.set(
      c.x + (rnd(t * 5 + 1) - 0.5) * 0.3,
      SURFACE + 0.075,
      c.z + (rnd(t * 5 + 2) - 0.5) * 0.3,
    );
    tree.castShadow = true;
    group.add(tree);
    dressing.push({ mesh: tree, mat: treeMat, base: 1 });
  }

  // --- buildings ------------------------------------------------------------
  const blocks = [];
  for (let cj = 0; cj < G.GRID - 1; cj++) {
    for (let ci = 0; ci < G.GRID - 1; ci++) {
      if (ci === cj || ci + cj === G.GRID - 2) continue; // the expressways run here
      if (PARK_CELLS.some(([pi, pj]) => pi === ci && pj === cj)) continue;
      const c = cellCentre(ci, cj);
      const slots = [
        [-0.085, -0.085],
        [0.085, -0.085],
        [-0.085, 0.085],
        [0.085, 0.085],
      ];
      const seed = cj * 9 + ci;
      const keep = 2 + Math.floor(rnd(seed * 3 + 7) * 2.99); // 2-4 per block
      for (let s = 0; s < keep; s++) {
        const [ox, oz] = slots[s];
        const x = c.x + ox;
        const z = c.z + oz;
        // a downtown core, so the skyline has a shape instead of a flat crust
        const r = Math.hypot(x, z) / (G.SPAN / 2);
        const core = 1 + 2.4 * Math.max(0, 1 - r * 1.3) ** 2;
        blocks.push({
          x,
          z,
          w: 0.1 + rnd(seed * 31 + s * 7 + 1) * 0.05,
          d: 0.1 + rnd(seed * 31 + s * 7 + 2) * 0.05,
          h: (0.14 + rnd(seed * 31 + s * 7 + 3) * 0.26) * core,
          tint: 0.7 + rnd(seed * 31 + s * 7 + 4) * 0.55,
        });
      }
    }
  }
  const buildingMat = materials.paintedMetal(0xffffff);
  buildingMat.roughness = 0.62;
  buildingMat.clearcoat = 0.25;
  buildingMat.metalness = 0.1;
  const buildings = new THREE.InstancedMesh(
    new RoundedBoxGeometry(1, 1, 1, 2, 0.16),
    buildingMat,
    blocks.length,
  );
  buildings.castShadow = true;
  buildings.receiveShadow = true;
  group.add(buildings);
  blocks.forEach((b, i) => {
    tmpColor.setHex(0x3d444f).multiplyScalar(b.tint);
    buildings.setColorAt(i, tmpColor);
  });
  if (buildings.instanceColor) buildings.instanceColor.needsUpdate = true;

  // --- graph layer ----------------------------------------------------------
  const graphGeo = ribbonGeometry(G.edges.length);
  const graphPos = graphGeo.attributes.position.array;
  const graphCol = graphGeo.attributes.color.array;
  const graphMat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const graphEdges = new THREE.Mesh(graphGeo, graphMat);
  group.add(graphEdges);

  const junctionMat = new THREE.MeshBasicMaterial({
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const junctions = new THREE.InstancedMesh(
    new THREE.IcosahedronGeometry(0.055, 1),
    junctionMat,
    G.N,
  );
  junctions.frustumCulled = false;
  group.add(junctions);

  // --- shortcut arcs (one mesh each, so contraction can reveal them in order)
  const shortcutMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0x7fd4ff).multiplyScalar(1.5),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  // Built once at the fully-lifted pose: shortcuts only ever appear in the two
  // hierarchy steps, where the tiers are already separated. Each arc springs
  // from the junction it replaced, so its height reads as that junction's rank.
  const liftedY = (v) => EDGE_Y + LIFT_Y[G.nodes[v].cls];
  const shortcutMeshes = G.chShortcuts.map((s) => {
    const A = G.nodes[s.a];
    const B = G.nodes[s.b];
    const ay = liftedY(s.a);
    const by = liftedY(s.b);
    const peak = Math.max(ay, by) + 0.07 + 0.09 * (1 - s.rank / G.N);
    const curve = new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(A.x, ay, A.z),
      new THREE.Vector3((A.x + B.x) / 2, peak * 2 - (ay + by) / 2, (A.z + B.z) / 2),
      new THREE.Vector3(B.x, by, B.z),
    );
    const mesh = new THREE.Mesh(new THREE.TubeGeometry(curve, 20, 0.011, 6, false), shortcutMat);
    mesh.visible = false;
    group.add(mesh);
    return mesh;
  });

  // --- routes ---------------------------------------------------------------
  function routeMesh(path, color, radius) {
    const pts = path.map((v) => new THREE.Vector3(G.nodes[v].x, ROUTE_Y, G.nodes[v].z));
    const curve = new THREE.CatmullRomCurve3(pts, false, 'catmullrom', 0.06);
    const geo = new THREE.TubeGeometry(curve, 220, radius, 10, false);
    const mat = new THREE.MeshBasicMaterial({
      color: new THREE.Color(color).multiplyScalar(1.5),
      transparent: true,
      opacity: 1,
      depthWrite: false,
    });
    const mesh = new THREE.Mesh(geo, mat);
    mesh.visible = false;
    mesh.scale.y = 0.4; // a flattened ribbon lying in the carriageway, not a pipe
    mesh.position.y = ROUTE_Y * 0.6; // ...re-centred, since scale.y squashes toward y=0
    mesh.userData.total = geo.index.count;
    group.add(mesh);
    return mesh;
  }
  const mainRoute = routeMesh(G.dijkstra.path, ACCENT, 0.052);
  const detourRoute = routeMesh(G.trafficRoute.path, 0x6ab0ff, 0.052);

  // --- pins -----------------------------------------------------------------
  function mapPin(color) {
    const g = new THREE.Group();
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0.15,
      roughness: 0.34,
      clearcoat: 0.7,
      clearcoatRoughness: 0.2,
      emissive: color,
      emissiveIntensity: 0.22,
    });
    const body = lathe(
      [
        [0, 0],
        [0.03, 0.05],
        [0.062, 0.115],
        [0.086, 0.19],
        [0.086, 0.245],
        [0.058, 0.295],
        [0, 0.318],
      ],
      mat,
      36,
    );
    body.castShadow = true;
    // the dark band around the head is what makes a teardrop read as a map pin
    const band = new THREE.Mesh(
      new THREE.TorusGeometry(0.082, 0.015, 8, 26),
      new THREE.MeshStandardMaterial({ color: 0x14171c, roughness: 0.5 }),
    );
    band.rotation.x = Math.PI / 2;
    band.position.y = 0.205;
    const disc = new THREE.Mesh(
      new THREE.CircleGeometry(0.075, 24),
      new THREE.MeshBasicMaterial({
        color: 0x0b0d10,
        transparent: true,
        opacity: 0.5,
        depthWrite: false,
      }),
    );
    disc.rotation.x = -Math.PI / 2;
    disc.position.y = 0.004;
    g.add(body, band, disc);
    g.scale.setScalar(1.45);
    return g;
  }
  const pinA = mapPin(PIN_A);
  const pinB = mapPin(PIN_B);
  group.add(pinA, pinB);

  // --- live-traffic probes (the phones that produce the speed data) ---------
  const PROBES = 54;
  const probeMat = new THREE.MeshBasicMaterial({
    color: new THREE.Color(0xdff0ff).multiplyScalar(1.7),
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const probes = new THREE.InstancedMesh(new THREE.SphereGeometry(0.021, 10, 8), probeMat, PROBES);
  probes.frustumCulled = false;
  group.add(probes);
  const probeRides = [];
  for (let p = 0; p < PROBES; p++) {
    const e = G.edges[Math.floor(rnd(p * 17 + 3) * G.edges.length)];
    probeRides.push({
      e,
      phase: rnd(p * 17 + 5),
      laps: [1, 1, 2, 3][e.cls], // whole laps -> seamless; faster on faster roads
      back: rnd(p * 17 + 11) > 0.5,
    });
  }

  // --- callouts -------------------------------------------------------------
  const labels = calloutSets(['city', 'graph', 'weights', 'search', 'hierarchy', 'query', 'traffic']);
  // anchors ride the hierarchy lift, so a label never detaches from its part
  const anchors = [];
  function anchorAt(node, dy = 0.1) {
    const obj = new THREE.Object3D();
    group.add(obj);
    anchors.push({ obj, node, dy });
    return obj;
  }
  function anchorFrontier(dy = 0.13) {
    const obj = new THREE.Object3D();
    group.add(obj);
    anchors.push({ obj, node: G.START, frontier: true, dy });
    return obj;
  }
  function anchorMid(a, b, dy = 0.1) {
    const obj = new THREE.Object3D();
    group.add(obj);
    anchors.push({ obj, node: a, node2: b, dy });
    return obj;
  }

  const nid = (i, j) => j * G.GRID + i;

  labels.add('city', pinA, 'Start', [0, 0.36, 0], 35, 46);
  labels.add('city', pinB, 'Destination', [0, 0.36, 0], 40, 46);
  labels.add('city', anchorAt(nid(7, 7), 0.12), 'Expressway — the fast tier', [0, 0, 0], 58, 54);

  labels.add('graph', anchorAt(nid(5, 7), 0.14), 'Junction — one node', [0, 0, 0], 96, 52);
  labels.add('graph', anchorMid(nid(4, 7), nid(5, 7), 0.1), 'Road segment — one edge', [0, 0, 0], 172, 66);
  labels.add('graph', anchorAt(nid(3, 8), 0.12), 'Both directions, priced apart', [0, 0, 0], 158, 72);

  labels.add('weights', anchorMid(nid(6, 6), nid(7, 7), 0.13), 'Expressway — length ÷ 1.45', [0, 0, 0], 52, 58);
  labels.add('weights', anchorMid(nid(4, 7), nid(5, 7), 0.1), 'Side street — length ÷ 0.45', [0, 0, 0], 170, 62);

  labels.add('search', anchorAt(nid(3, 5), 0.13), 'Settled — its cost is final', [0, 0, 0], 46, 54);
  labels.add('search', anchorFrontier(0.14), 'Frontier — next cheapest', [0, 0, 0], 8, 58);

  labels.add('hierarchy', anchorAt(nid(6, 6), 0.16), 'Expressway tier — contracted last', [0, 0, 0], 140, 62);
  labels.add('hierarchy', anchorAt(nid(3, 7), 0.13), 'Side street — contracted first', [0, 0, 0], 6, 58);
  labels.add('hierarchy', anchorAt(nid(4, 7), 0.34), 'Shortcut arc', [0, 0, 0], 76, 48);

  labels.add('query', anchorAt(G.chRun.meet, 0.24), 'They meet up here', [0, 0, 0], 60, 52);
  labels.add('query', anchorAt(nid(7, 6), 0.16), 'Climbing from the destination', [0, 0, 0], 152, 58);

  labels.add('traffic', anchorMid(nid(4, 6), nid(5, 6), 0.12), 'Jammed corridor', [0, 0, 0], 56, 52);
  labels.add('traffic', anchorAt(nid(2, 7), 0.12), 'Phones reporting their speed', [0, 0, 0], 6, 58);

  // --- state ----------------------------------------------------------------
  // ONE object drives everything; every step pins all of it in onEnter.
  const state = {
    reveal: 0, // 0 = the finished map, 1 = the bare graph
    lift: 0, // hierarchy tier separation
    settled: 0, // how many nodes of `order` have been settled
    order: null, // which search is playing
    intensity: 1, // fades the whole search out at the end of a lap
    contract: 0, // contraction sweep (0..1) for the preprocessing step
    shortcutT: 0,
    route: 'none', // 'none' | 'main' | 'detour'
    routeT: 0, // how much of it is drawn
    routeAlpha: 1, // fades the finished ribbon out at the end of a lap
    traffic: 0,
    probes: 0,
    probePhase: 0,
    bob: 0,
    spin: 0,
    labels: false,
  };

  const nodeY = (v) => EDGE_Y + state.lift * LIFT_Y[G.nodes[v].cls];

  // per-node search status, rebuilt each apply()
  const status = new Float32Array(G.N); // 0 none, >0 settled strength
  const side = new Int8Array(G.N); // 1 forward, -1 backward
  const onPath = new Uint8Array(G.N);
  const pathSet = new Set();
  // the dressing and the asphalt only change when reveal/traffic move, and
  // rewriting 240 quads plus 120 instance matrices every frame is real work
  let lastShrink = -1;
  let lastRoadKey = '';

  // the junction the playing search is settling this instant
  function frontierId() {
    if (!state.order || state.settled <= 0) return G.START;
    const k = Math.min(state.order.length - 1, Math.floor(state.settled));
    const item = state.order[k];
    return typeof item === 'number' ? item : item.node;
  }

  function refreshPath() {
    pathSet.clear();
    const p =
      state.route === 'detour' ? G.trafficRoute.path : state.route === 'main' ? G.dijkstra.path : [];
    for (const v of p) pathSet.add(v);
  }

  function apply() {
    group.rotation.y = BASE_ROT + state.spin * TAU;

    // --- dressing: buildings shrink into the ground rather than ghosting, so
    // no transparent-shell tricks are needed at all
    const rev = clamp01(state.reveal);
    const shrink = 1 - 0.985 * rev;
    if (shrink !== lastShrink) {
      lastShrink = shrink;
      for (let i = 0; i < blocks.length; i++) {
        const b = blocks[i];
        const h = b.h * shrink;
        tmpMat.compose(
          tmpVec.set(b.x, SURFACE + h / 2, b.z),
          tmpQuat.identity(),
          tmpScale.set(b.w, h, b.d),
        );
        buildings.setMatrixAt(i, tmpMat);
      }
      buildings.instanceMatrix.needsUpdate = true;
      for (const d of dressing) {
        d.mat.opacity = d.base * (1 - rev);
        d.mesh.visible = rev < 0.99;
      }
      groundMat.color.setHex(0x1c2027).multiplyScalar(1 - 0.45 * rev);
    }
    buildings.visible = rev < 0.995;

    // --- asphalt: road colour, tinted by live traffic when it is running
    const roadKey = `${rev.toFixed(3)}:${state.traffic.toFixed(3)}`;
    if (roadKey !== lastRoadKey) {
      lastRoadKey = roadKey;
      paintRoads(rev);
    }

    // --- search state ---------------------------------------------------
    status.fill(0);
    side.fill(0);
    onPath.fill(0);
    applySearchState();

    // --- graph edges -------------------------------------------------------
    paintGraph();
    graphMat.opacity = rev;
    graphEdges.visible = rev > 0.01;
    paintJunctions(rev);
    junctionMat.opacity = rev;
    junctions.visible = rev > 0.01;
    finishFrame();
  }

  function paintRoads(rev) {
    for (const e of G.edges) {
      tmpColor.setHex(ROAD_COLS[e.cls]).multiplyScalar(1 - 0.78 * rev);
      if (state.traffic > 0) {
        const lvl = G.trafficLevel[e.id];
        const band = lvl >= 1 ? 2 : lvl > 0.4 ? 1 : 0;
        tmpColorB.setHex(TRAFFIC_COLS[band]).multiplyScalar(band === 2 ? 1.15 : 0.85);
        tmpColor.lerp(tmpColorB, state.traffic * (band === 0 ? 0.42 : 0.92));
      }
      paintQuad(roadCol, e.id, tmpColor);
    }
    for (const n of G.nodes) {
      tmpColor.setHex(ROAD_COLS[n.cls]).multiplyScalar((1 - 0.78 * rev) * 0.92);
      paintQuad(roadCol, G.edges.length + n.id, tmpColor);
    }
    roadGeo.attributes.color.needsUpdate = true;
  }

  // which junctions the playing search has settled, and from which side
  function applySearchState() {
    if (state.order && state.settled > 0) {
      const k = Math.min(state.order.length, Math.floor(state.settled));
      const frac = state.settled - Math.floor(state.settled);
      for (let n = 0; n < k; n++) {
        const item = state.order[n];
        const v = typeof item === 'number' ? item : item.node;
        status[v] = 1;
        side[v] = typeof item === 'number' ? 1 : item.fwd ? 1 : -1;
      }
      if (k < state.order.length && frac > 0) {
        const item = state.order[k];
        const v = typeof item === 'number' ? item : item.node;
        status[v] = frac;
        side[v] = typeof item === 'number' ? 1 : item.fwd ? 1 : -1;
      }
    }
    for (const v of pathSet) onPath[v] = 1;
  }

  function paintGraph() {
    for (const e of G.edges) {
      const ay = nodeY(e.a);
      const by = nodeY(e.b);
      const A = G.nodes[e.a];
      const B = G.nodes[e.b];
      writeQuad(graphPos, e.id, A.x, ay, A.z, B.x, by, B.z, EDGE_W[e.cls] / 2);

      const both = Math.min(status[e.a], status[e.b]) * state.intensity;
      const routed =
        onPath[e.a] && onPath[e.b] && Math.abs(pathIndex(e.a) - pathIndex(e.b)) === 1 ? 1 : 0;
      tmpColor.copy(DIM_EDGE).multiplyScalar(0.7 + 0.6 * (e.cls / 3));
      if (both > 0) {
        tmpColorB.setHex(side[e.a] < 0 || side[e.b] < 0 ? VIOLET : AMBER).multiplyScalar(1.15);
        tmpColor.lerp(tmpColorB, both * 0.85);
      }
      if (routed && state.routeT > 0) {
        tmpColorB.setHex(ACCENT).multiplyScalar(2.1);
        tmpColor.lerp(tmpColorB, state.routeT);
      }
      paintQuad(graphCol, e.id, tmpColor);
    }
    graphGeo.attributes.position.needsUpdate = true;
    graphGeo.attributes.color.needsUpdate = true;
  }

  function paintJunctions(rev) {
    const contractFront = state.contract * G.N;
    for (let v = 0; v < G.N; v++) {
      const gone = state.contract > 0 ? clamp01(contractFront - G.chRank[v]) : 0;
      const s = (0.55 + 0.85 * status[v] * state.intensity + 0.5 * onPath[v] * state.routeT) *
        (1 - 0.95 * gone);
      tmpMat.compose(
        tmpVec.set(G.nodes[v].x, nodeY(v), G.nodes[v].z),
        tmpQuat.identity(),
        tmpScale.setScalar(s * rev),
      );
      junctions.setMatrixAt(v, tmpMat);
      tmpColor.setHex(0x35506e).multiplyScalar(0.8 + 0.5 * (G.nodes[v].cls / 3));
      if (status[v] > 0) {
        tmpColorB.setHex(side[v] < 0 ? VIOLET : AMBER).multiplyScalar(1.9);
        tmpColor.lerp(tmpColorB, status[v] * state.intensity);
      }
      if (onPath[v]) {
        tmpColorB.setHex(ACCENT).multiplyScalar(2.4);
        tmpColor.lerp(tmpColorB, state.routeT);
      }
      junctions.setColorAt(v, tmpColor);
    }
    junctions.instanceMatrix.needsUpdate = true;
    if (junctions.instanceColor) junctions.instanceColor.needsUpdate = true;
  }

  function finishFrame() {
    // --- shortcut arcs ------------------------------------------------------
    // one arc becomes visible per contracted junction, in the order the
    // preprocessing actually created them
    const shown = Math.round(state.shortcutT * shortcutMeshes.length);
    shortcutMeshes.forEach((m, i) => {
      m.visible = state.shortcutT > 0 && i < shown;
    });
    shortcutMat.opacity = 0.75 * Math.min(1, state.shortcutT * 4);

    // --- routes -------------------------------------------------------------
    const drawn = state.routeT > 0.001 && state.routeAlpha > 0.004;
    mainRoute.visible = drawn && state.route === 'main';
    detourRoute.visible = drawn && state.route === 'detour';
    const live = state.route === 'detour' ? detourRoute : mainRoute;
    if (live.visible) {
      live.geometry.setDrawRange(
        0,
        Math.max(6, Math.floor(live.userData.total * clamp01(state.routeT))),
      );
      live.material.opacity = clamp01(state.routeAlpha);
    }

    // --- pins ---------------------------------------------------------------
    const bobA = Math.sin(state.bob * TAU) * 0.022;
    const bobB = Math.sin(state.bob * TAU + 2.1) * 0.022;
    const tierA = state.lift * LIFT_Y[G.nodes[G.START].cls];
    const tierB = state.lift * LIFT_Y[G.nodes[G.DEST].cls];
    pinA.position.set(G.nodes[G.START].x, SURFACE + 0.006 + tierA + Math.max(0, bobA), G.nodes[G.START].z);
    pinB.position.set(G.nodes[G.DEST].x, SURFACE + 0.006 + tierB + Math.max(0, bobB), G.nodes[G.DEST].z);

    // --- traffic probes ------------------------------------------------------
    probeMat.opacity = state.probes;
    probes.visible = state.probes > 0.01;
    if (probes.visible) {
      for (let p = 0; p < PROBES; p++) {
        const ride = probeRides[p];
        let u = (ride.phase + state.probePhase * ride.laps) % 1;
        if (ride.back) u = 1 - u;
        const A = G.nodes[ride.e.a];
        const B = G.nodes[ride.e.b];
        tmpMat.compose(
          tmpVec.set(lerp(A.x, B.x, u), ROUTE_Y + 0.01, lerp(A.z, B.z, u)),
          tmpQuat.identity(),
          tmpScale.setScalar(1),
        );
        probes.setMatrixAt(p, tmpMat);
      }
      probes.instanceMatrix.needsUpdate = true;
    }

    // --- label anchors -------------------------------------------------------
    for (const a of anchors) {
      const id = a.frontier ? frontierId() : a.node;
      const n1 = G.nodes[id];
      if (a.node2 !== undefined) {
        const n2 = G.nodes[a.node2];
        a.obj.position.set(
          (n1.x + n2.x) / 2,
          (nodeY(id) + nodeY(a.node2)) / 2 + a.dy,
          (n1.z + n2.z) / 2,
        );
      } else {
        a.obj.position.set(n1.x, nodeY(id) + a.dy, n1.z);
      }
    }
  }

  // index of a node along the currently-drawn route (-9 when it is not on it)
  const pathIdxCache = new Map();
  function pathIndex(v) {
    const key = state.route;
    let map = pathIdxCache.get(key);
    if (!map) {
      map = new Map();
      const p =
        key === 'detour' ? G.trafficRoute.path : key === 'main' ? G.dijkstra.path : [];
      p.forEach((n, i) => map.set(n, i));
      pathIdxCache.set(key, map);
    }
    return map.get(v) ?? -9;
  }

  refreshPath();
  apply();

  return {
    group,
    parts: { buildings, roads, junctions, graphEdges, pinA, pinB, mainRoute, detourRoute, probes },
    setLabels: labels.setLabels,
    stats: G.stats,
    set(partial) {
      const routeChanged = partial.route !== undefined && partial.route !== state.route;
      Object.assign(state, partial);
      if (routeChanged) refreshPath();
      apply();
    },
    // Replay one of the real searches. `u` runs 0..1 across the lap: the front
    // grows, the winning path draws, then the whole thing fades back to an
    // empty map so the wrap is invisible.
    playSearch(order, u, { route = 'main' } = {}) {
      const grow = clamp01(u / 0.62);
      const pathWin = win(clamp01(u), 0.62, 0.86);
      const fade = u > 0.86 ? 1 - win(clamp01(u), 0.86, 1) : 1;
      if (state.route !== route) {
        state.route = route;
        refreshPath();
      }
      state.order = order;
      state.settled = smooth(grow) * order.length;
      state.intensity = fade;
      state.routeT = u <= 0.62 ? 0 : smooth(pathWin) * fade;
      apply();
    },
  };
}
