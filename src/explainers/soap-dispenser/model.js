import * as THREE from 'three';
import { materials, studioPlinth, flowField } from '../../framework/parts.js';
import { coil } from '../../framework/geometry.js';
import { clamp01, win } from '../../framework/motion.js';
import { calloutSets } from '../../framework/callouts.js';

// A 28/410 lotion/soap pump on a Boston-round bottle — the one on every sink.
//
// MECHANISM (story.js has the angle): a piston on a hollow stem rides in a
// cylinder (the housing) that hangs from the cap into the bottle. A steel
// return spring sits in the chamber under the piston. TWO glass-ball check
// valves: the LOWER ball sits in a cone seat at the bottom of the housing,
// above the dip tube; the UPPER ball sits in a cone seat in the piston, under
// the hollow stem.
//   release (intake)   spring lifts the piston → chamber grows → pressure
//                      drops → lower ball lifts, upper ball stays seated →
//                      atmospheric pressure on the soap surface pushes soap up
//                      the dip tube into the chamber.
//   press (delivery)   piston drives down → lower ball slams onto its seat →
//                      the trapped soap's only exit is up past the upper ball,
//                      through the stem and out of the spout.
//
// SCALE: the whole pump is built in MILLIMETRES inside one group scaled by MM,
// so every constant below is the real dimension. 1 unit = 80 mm.
//   bottle   Ø66 x 168 mm Boston round, 28 mm neck   (ratio h:w ≈ 2.55)
//   closure  Ø32 x 17.6 mm, 60 grip ribs
//   head     Ø26 x 22 mm, spout 28 mm long, Ø1.8 mm bore
//   housing  Ø17 OD, Ø14.5 bore, hangs 80 mm into the bottle
//   stroke   12 mm → 1.45² π/4 x 1.2 ≈ 2.0 mL per press (the published
//            28/410 output is 2.0–2.2 cc)
//   balls    Ø3.2 mm (upper), Ø3.8 mm (lower) glass
//   dip tube Ø4 OD / Ø2 ID, stops 6 mm above the floor
// The pump is drawn to scale against the bottle — the housing is a quarter
// of the bottle's width. That is why the mechanism steps push in close.
//
// CUTAWAY: every turned part is built twice from ONE closed (r, y) profile:
// a full lathe (solid steps) and a half lathe with filled section faces on
// the z = 0 plane (cut steps — the front half is removed, toward the camera).
// The swap snaps in onEnter; the camera flight covers the pop.
//
// SEAMLESS LOOP: one stroke = rest → press → hold → release → rest, back to
// an identical pose. Every lap advances a WHOLE number of strokes, and the
// flow dots advance whole path lengths per stroke, so the wrap is invisible.
// The priming lap (5 strokes) ends full and starts empty: the soap fades out
// over the last few percent of the lap — the one disclosed cheat, since real
// soap cannot flow back past the lower ball.
const MM = 1 / 80;
const PLINTH_H = 0.26;
const SEG = 72;

const STROKE = 12;
const PISTON_BOTTOM = 158; // at rest
const SPRING_BASE = 112.4; // where the spring rests on the housing shoulder
const SPRING_REST = PISTON_BOTTOM - SPRING_BASE;
const BORE_R = 7.25;
const CHAMBER_FLOOR = 113.5;
const LOWER_SEAT = 102.26; // ball r 1.9 tangent to the 1.1→2.4 mm cone
const LOWER_LIFT = 2.6;
const UPPER_SEAT = 162.26; // ball r 1.6 tangent to the 45° piston seat
const UPPER_LIFT = 2.0;
const HEAD_Y = 185; // actuator underside at rest
const SPOUT_Y = HEAD_Y + 15.5;
const SPOUT_TIP = 40;
const DROP_R = 7.4; // ≈ 1.7 mL bead — the dose, near enough to scale

const C_SOAP = 0xd8780f;

// --- profile helpers ---------------------------------------------------------

// Round every real corner of a closed (r, y) loop with a short chamfer. Lathe
// normals are averaged weighted by segment length, so a 0.3 mm chamfer between
// two long edges shades as a soft fillet — no mathematically sharp edges.
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
  return out.map(([r, y]) => [Math.max(0, r), y]);
}

// A closed loop as a lathe path that starts and ends mid-way along its longest
// edge, so the one unsmoothed seam lands on a flat run, not a corner.
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
  return seq.map(([r, y]) => new THREE.Vector2(r, y));
}

const shapeGeo = (pts) =>
  new THREE.ShapeGeometry(new THREE.Shape(pts.map(([x, y]) => new THREE.Vector2(x, y))));

const shadowed = (m) => {
  m.castShadow = true;
  m.receiveShadow = true;
  return m;
};

// One turned part, twice: `full` (solid steps) and `cut` (back half + section
// faces on z = 0). `rightCaps` overrides the +x section for parts that are not
// symmetric in section (the head's sideways channel to the spout).
function turned(loop, mat, capMat, { c = 0.3, rightCaps } = {}) {
  const pts = chamfer(loop, c);
  const path = lathePath(pts);
  const full = shadowed(new THREE.Mesh(new THREE.LatheGeometry(path, SEG), mat));
  const cut = new THREE.Group();
  cut.add(shadowed(new THREE.Mesh(new THREE.LatheGeometry(path, SEG / 2, Math.PI / 2, Math.PI), mat)));
  for (const cap of rightCaps ?? [pts]) cut.add(shadowed(new THREE.Mesh(shapeGeo(cap), capMat)));
  const left = shadowed(new THREE.Mesh(shapeGeo(pts), capMat));
  left.scale.x = -1;
  cut.add(left);
  return { full, cut };
}

// --- build -------------------------------------------------------------------

export function buildSoapPump({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  const plinth = studioPlinth({ w: 1.75, d: 1.2 });
  group.add(plinth);

  const pump = new THREE.Group(); // millimetre space
  pump.scale.setScalar(MM);
  pump.position.y = PLINTH_H;
  group.add(pump);

  // --- materials ---
  const headMat = materials.polymer(0x1b1d21);
  headMat.roughness = 0.5;
  const sectionDark = new THREE.MeshStandardMaterial({ color: 0x3b3f46, roughness: 0.85, side: THREE.DoubleSide });
  const housingMat = materials.polymer(0xe2ddd0);
  housingMat.roughness = 0.48;
  housingMat.clearcoat = 0;
  const pistonMat = materials.polymer(0xf3f1ea);
  pistonMat.roughness = 0.42;
  pistonMat.clearcoat = 0;
  const sectionLight = new THREE.MeshStandardMaterial({ color: 0xf6f2e8, roughness: 0.9, side: THREE.DoubleSide });
  const springMat = materials.brushedSteel(0xc8ced6);
  springMat.roughness = 0.45;
  const ballMat = new THREE.MeshPhysicalMaterial({
    color: 0x9cc6e2,
    metalness: 0,
    roughness: 0.05,
    clearcoat: 1,
    clearcoatRoughness: 0.03,
  });
  // trap 1: soap sits INSIDE the bottle, so the bottle is plain transparent
  // glass, never transmission (which would make the soap vanish)
  const bottleMat = materials.glass(0xf2f6ff, 0.1);
  // a little self-light keeps the bulk soap amber instead of washing to peach
  // under the white glass veil
  const reservoirMat = new THREE.MeshPhysicalMaterial({
    color: 0xcf6c0c,
    emissive: 0x4a1e00,
    emissiveIntensity: 0.6,
    roughness: 0.12,
    metalness: 0,
    transparent: true,
    opacity: 0.9,
  });
  const soapMat = new THREE.MeshPhysicalMaterial({
    color: 0xf2a02e,
    emissive: 0x5a2c00,
    emissiveIntensity: 0.35,
    roughness: 0.18,
    transparent: true,
    opacity: 0.72,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const dipMat = new THREE.MeshPhysicalMaterial({
    color: 0xf1ede2,
    roughness: 0.35,
    transparent: true,
    opacity: 0.42,
    depthWrite: false,
  });
  const linerMat = new THREE.MeshStandardMaterial({ color: 0x15161a, roughness: 0.9, side: THREE.DoubleSide });
  const dropMat = new THREE.MeshPhysicalMaterial({
    color: C_SOAP,
    roughness: 0.06,
    clearcoat: 0.6,
    transparent: true,
    opacity: 0.94,
    depthWrite: false,
  });

  const turnedParts = []; // every { full, cut } pair, for the reveal swap
  const internals = []; // only shown in the cutaway

  // --- bottle (Boston round, clear PET) ---
  const bottleProfile = [
    [0, 1.6], [18, 1.0], [28, 0.2], [31.4, 0], [32.6, 0.6], [33, 2.4], [33, 118],
    [32.5, 125], [30.2, 132.5], [25.5, 139.5], [19.5, 145], [15.6, 148.4], [14.2, 150.6],
    [14, 152], [14, 153.4], [15.4, 153.9], [15.4, 155.1], [14, 155.6], [14, 167.1],
    [13.7, 167.8], [12.5, 167.8], [12.5, 160],
  ];
  const bottle = new THREE.Mesh(
    new THREE.LatheGeometry(bottleProfile.map(([r, y]) => new THREE.Vector2(r, y)), SEG),
    bottleMat,
  );
  bottle.renderOrder = 3;
  pump.add(bottle);

  const reservoirLoop = [[0, 2.6], [30.6, 2.4], [31.9, 3.4], [32.3, 5.5], [32.3, 112], [31.8, 112.6], [0, 112.8]];
  const reservoir = new THREE.Mesh(new THREE.LatheGeometry(lathePath(reservoirLoop), SEG), reservoirMat);
  reservoir.castShadow = true;
  reservoir.renderOrder = 2;
  pump.add(reservoir);

  // --- housing (pump cylinder) — hangs from the neck on its flange ---
  const housing = turned(
    [
      [2.05, 90], [3.4, 90], [3.4, 100], [4.0, 101], [4.0, 110], [8.5, 113.5], [8.5, 168],
      [13.5, 168], [13.5, 170], [4.4, 170], [4.4, 166], [BORE_R, 166], [BORE_R, CHAMBER_FLOOR],
      [2.4, 110.5], [2.4, 102.2], [1.1, 100.6], [1.1, 99.4], [2.05, 99.4],
    ],
    housingMat,
    sectionLight,
    { c: 0.25 },
  );
  turnedParts.push(housing);
  pump.add(housing.full, housing.cut);

  // --- dip tube (translucent LDPE, always whole — it's a straw) ---
  const dipTube = turned([[1.0, 6], [2.0, 6], [2.0, 99.2], [1.0, 99.2]], dipMat, dipMat, { c: 0.15 }).full;
  dipTube.castShadow = false;
  pump.add(dipTube);

  // --- closure (ribbed screw cap with the stem turret) ---
  const closure = turned(
    [
      [14.6, 155], [16, 155], [16, 171.2], [15.2, 172.6], [7.5, 172.6], [7.5, 179.4], [6.9, 180],
      [4.2, 180], [4.2, 170.6], [14.6, 170.6],
    ],
    headMat,
    sectionDark,
    { c: 0.35 },
  );
  turnedParts.push(closure);
  pump.add(closure.full, closure.cut);

  // grip ribs — the back half stays in the cutaway, the front half goes with
  // the removed half of the cap
  const ribGeo = new THREE.BoxGeometry(0.9, 14.6, 1.0);
  ribGeo.translate(0, 163.4, 0);
  const RIBS = 60;
  const ribsFront = new THREE.InstancedMesh(ribGeo, headMat, RIBS / 2);
  const ribsBack = new THREE.InstancedMesh(ribGeo, headMat, RIBS / 2);
  {
    const m = new THREE.Matrix4();
    const q = new THREE.Quaternion();
    const up = new THREE.Vector3(0, 1, 0);
    let f = 0;
    let bk = 0;
    for (let i = 0; i < RIBS; i++) {
      const a = ((i + 0.5) / RIBS) * Math.PI * 2;
      q.setFromAxisAngle(up, a);
      m.compose(new THREE.Vector3(Math.sin(a) * 16.2, 0, Math.cos(a) * 16.2), q, new THREE.Vector3(1, 1, 1));
      if (Math.cos(a) > 0) ribsFront.setMatrixAt(f++, m);
      else ribsBack.setMatrixAt(bk++, m);
    }
  }
  ribsFront.castShadow = ribsBack.castShadow = true;
  pump.add(ribsFront, ribsBack);

  // --- return spring (stainless, in the chamber under the piston) ---
  const springGroup = new THREE.Group();
  springGroup.position.y = SPRING_BASE;
  const springMesh = coil(
    { turns: 9, radius: 5.4, length: SPRING_REST - 1.2, wireRadius: 0.5, segmentsPerTurn: 28 },
    springMat,
  ).mesh;
  springMesh.position.y = SPRING_REST / 2;
  springGroup.add(springMesh);
  pump.add(springGroup);
  internals.push(springGroup);

  // --- lower ball valve ---
  const ballGeo = new THREE.SphereGeometry(1, 32, 20);
  const lowerBall = shadowed(new THREE.Mesh(ballGeo, ballMat));
  lowerBall.scale.setScalar(1.9);
  pump.add(lowerBall);
  internals.push(lowerBall);

  // --- the moving plunger: piston + hollow stem + head + spout -------------
  const plunger = new THREE.Group();
  pump.add(plunger);

  const pistonStem = turned(
    [
      [1.0, 158], [6.9, 158], [7.2, 158.5], [7.2, 159.6], [6.8, 160.3], [6.8, 162.7], [7.2, 163.4],
      [7.2, 164.5], [6.9, 165], [3.8, 165], [3.8, 199], [1.0, 199], [1.0, 167], [2.2, 167],
      [2.2, 162.2], [1.0, 161],
    ],
    pistonMat,
    sectionLight,
    { c: 0.2 },
  );
  turnedParts.push(pistonStem);
  plunger.add(pistonStem.full, pistonStem.cut);

  const upperBall = shadowed(new THREE.Mesh(ballGeo, ballMat));
  upperBall.scale.setScalar(1.6);
  plunger.add(upperBall);
  internals.push(upperBall);

  // head: symmetric profile for the lathe; the +x section is traced by hand so
  // the sideways channel to the spout shows as a real open passage
  const head = new THREE.Group();
  head.position.y = HEAD_Y;
  plunger.add(head);
  const headLoop = [
    [9.5, 0], [13, 0], [13, 17.5], [12.6, 19.8], [11.2, 21.3], [8, 22], [0, 22.2], [0, 16.4],
    [1, 16.4], [1, 14], [3.8, 14], [3.8, 9], [9.5, 9],
  ];
  const headParts = turned(headLoop, headMat, sectionDark, {
    c: 0.45,
    rightCaps: [
      [[9.5, 0], [13, 0], [13, 14.6], [1, 14.6], [1, 14], [3.8, 14], [3.8, 9], [9.5, 9]],
      [[0, 16.4], [13, 16.4], [13, 17.5], [12.6, 19.8], [11.2, 21.3], [8, 22], [0, 22.2]],
    ],
  });
  turnedParts.push(headParts);
  head.add(headParts.full, headParts.cut);

  // spout: turned about its own axis (local +y → world +x), same cut plane
  const spoutLoop = [[0.9, 12], [4.6, 12], [4.2, 30], [3.4, 37.6], [3.0, SPOUT_TIP], [0.9, SPOUT_TIP]];
  const spoutPts = chamfer(spoutLoop, 0.35);
  const spoutPath = lathePath(spoutPts);
  const spoutFull = shadowed(new THREE.Mesh(new THREE.LatheGeometry(spoutPath, 40), headMat));
  const spoutCutShell = shadowed(
    new THREE.Mesh(new THREE.LatheGeometry(spoutPath, 20, Math.PI / 2, Math.PI), headMat),
  );
  for (const m of [spoutFull, spoutCutShell]) {
    m.rotation.z = -Math.PI / 2;
    m.position.y = 15.5;
  }
  const spoutCut = new THREE.Group();
  spoutCut.add(spoutCutShell);
  const stripPts = spoutPts.map(([r, y]) => [y, r]); // (along, r) in the z = 0 plane
  for (const sy of [1, -1]) {
    const strip = new THREE.Mesh(shapeGeo(stripPts), sectionDark);
    strip.position.y = 15.5;
    strip.scale.y = sy;
    spoutCut.add(strip);
  }
  head.add(spoutFull, spoutCut);
  turnedParts.push({ full: spoutFull, cut: spoutCut });

  // dark liner behind the head's sideways channel, so the cut passage reads
  // as a bore rather than a window into the hollow lathe shell
  const liner = new THREE.Mesh(new THREE.CylinderGeometry(0.9, 0.9, 13, 16, 1, true, Math.PI, Math.PI), linerMat);
  liner.rotation.z = -Math.PI / 2;
  liner.position.set(6.5, 15.5, 0);
  head.add(liner);
  internals.push(liner);

  // --- soap inside the pump (cutaway only) ---------------------------------
  const column = (r, len) => {
    const geo = new THREE.CylinderGeometry(r, r, len, 14);
    geo.translate(0, len / 2, 0);
    const m = new THREE.Mesh(geo, soapMat);
    m.renderOrder = 1;
    return m;
  };
  const tubeSoap = column(0.92, 99.2 - 6);
  tubeSoap.position.y = 6;
  pump.add(tubeSoap);

  const cageSoap = turned(
    [[0, 100.6], [1.1, 100.6], [2.35, 102.2], [2.35, 110.5], [7.2, CHAMBER_FLOOR], [0, CHAMBER_FLOOR]],
    soapMat,
    soapMat,
    { c: 0 },
  ).cut;
  pump.add(cageSoap);
  const boreSoap = turned([[0, 0], [7.2, 0], [7.2, 1], [0, 1]], soapMat, soapMat, { c: 0 }).cut;
  boreSoap.position.y = CHAMBER_FLOOR;
  pump.add(boreSoap);
  for (const g of [cageSoap, boreSoap]) g.traverse((o) => (o.renderOrder = 1));

  const stemSoap = column(0.92, 199 - 158 + 2.4);
  stemSoap.position.y = 158;
  plunger.add(stemSoap);
  const channelSoap = column(0.82, SPOUT_TIP);
  channelSoap.rotation.z = -Math.PI / 2;
  channelSoap.position.y = SPOUT_Y;
  plunger.add(channelSoap);
  const soapParts = [tubeSoap, cageSoap, boreSoap, stemSoap, channelSoap];
  // the soap never occludes a callout: it is a translucent fill, not a part
  for (const s of soapParts) s.traverse((o) => (o.userData.noOcclude = true));

  // --- flow packets ---------------------------------------------------------
  const intakeCurve = new THREE.CatmullRomCurve3(
    [
      [0, 6.5, 0.4], [0, 55, 0.4], [0, 98, 0.4], [0, 100.8, 1.4], [0, 104.5, 2.1], [0, 108, 1.6],
      [0, 113, 1.0], [0, 124, 1.0], [0, 136, 1.0],
    ].map((p) => new THREE.Vector3(...p)),
  );
  const deliveryCurve = new THREE.CatmullRomCurve3(
    [
      [0, 146, 1.0], [0, 156, 0.9], [0, 159.6, 0.5], [0, 162.6, 1.75], [0, 165.5, 1.6], [0, 168.5, 0.5],
      [0, 185, 0.4], [0, 197.5, 0.4], [0, 199.9, 0.4], [1.6, SPOUT_Y, 0.4], [10, SPOUT_Y, 0.4],
      [26, SPOUT_Y, 0.4], [SPOUT_TIP + 0.5, SPOUT_Y, 0.4],
    ].map((p) => new THREE.Vector3(...p)),
  );
  const N_DOTS = 18;
  const intakeDots = flowField(N_DOTS, 2.4, { opacity: 0.95 });
  const deliveryDots = flowField(N_DOTS, 2.4, { opacity: 0.95 });
  pump.add(intakeDots.mesh);
  // in the pump frame, not the plunger: a packet cone's geometry sits at its
  // group origin, so parenting it under the plunger dragged every plunger-part
  // framing box down to the bottle floor. It tracks the plunger by offset.
  pump.add(deliveryDots.mesh);
  {
    const col = new THREE.Color(0xffd27a);
    for (const f of [intakeDots, deliveryDots]) {
      for (let i = 0; i < N_DOTS; i++) f.mesh.setColorAt(i, col);
      f.mesh.renderOrder = 5;
      f.mesh.userData.noOcclude = true;
    }
  }
  const _q = new THREE.Quaternion();
  const _up = new THREE.Vector3(0, 1, 0);
  function placeDots(field, curve, offset, on) {
    field.mesh.visible = on;
    if (!on) return;
    for (let i = 0; i < N_DOTS; i++) {
      const u = (i / N_DOTS + offset) % 1;
      const pos = curve.getPointAt(u);
      _q.setFromUnitVectors(_up, curve.getTangentAt(u));
      const edge = Math.min(1, u / 0.04, (1 - u) / 0.04);
      field.set(i, pos, _q, Math.max(0.001, edge), null);
    }
    field.commit();
  }

  // --- the dose ---
  const drop = new THREE.Mesh(new THREE.SphereGeometry(1, 28, 20), dropMat);
  drop.renderOrder = 5;
  drop.castShadow = true;
  drop.userData.noOcclude = true;
  pump.add(drop);

  // --- callouts (anchors in millimetres, on their parts) --------------------
  const labels = calloutSets(['exterior', 'internal', 'intake', 'delivery', 'prime']);
  const L = (set, parent, text, pos, dir, len) => labels.add(set, parent, text, pos, dir, len);
  // exterior — the solid product
  L('exterior', head, 'Pump head', [3, 22, 3], 60, 56);
  L('exterior', head, 'Nozzle', [SPOUT_TIP, 15.5, 0], 20, 48);
  L('exterior', pump, 'Screw cap', [11.4, 165, 11.4], -10, 60);
  L('exterior', pump, 'Bottle', [23.3, 70, 23.3], -20, 56);
  // internal — the full parts list in the cutaway
  L('internal', head, 'Pump head', [9, 20, 0], 40, 50);
  L('internal', plunger, 'Hollow stem', [3.8, 182, 0], 10, 70);
  L('internal', plunger, 'Piston', [7.2, 161.5, 0], -5, 70);
  L('internal', upperBall, 'Upper ball valve', [0, 0, 1], 25, 90);
  L('internal', pump, 'Return spring', [0, 128, 6.3], -10, 70);
  L('internal', lowerBall, 'Lower ball valve', [0, 0, 1], -15, 90);
  L('internal', pump, 'Dip tube', [2, 60, 0], 0, 60);
  // intake — release
  L('intake', lowerBall, 'Lower ball valve', [0, 0, 1], -15, 80);
  L('intake', upperBall, 'Upper ball valve', [0, 0, 1], 20, 80);
  L('intake', pump, 'Return spring', [0, 128, 6.3], 0, 70);
  L('intake', pump, 'Dip tube', [2, 80, 0], -10, 60);
  // delivery — press
  L('delivery', upperBall, 'Upper ball valve', [0, 0, 1], 15, 90);
  L('delivery', lowerBall, 'Lower ball valve', [0, 0, 1], -30, 90);
  L('delivery', plunger, 'Hollow stem', [3.8, 182, 0], 10, 70);
  L('delivery', head, 'Nozzle', [SPOUT_TIP, 15.5, 0], 30, 50);
  // prime
  L('prime', pump, 'Dip tube', [2, 50, 0], 0, 60);
  L('prime', pump, 'Pump chamber', [8.5, 140, 0], 0, 60);
  L('prime', lowerBall, 'Lower ball valve', [0, 0, 1], -15, 70);

  // --- pose ------------------------------------------------------------------
  const state = {
    stroke: 0, // continuous stroke count; the fraction is the phase
    reveal: 0, // 0 solid product, 1 cutaway
    flows: false, // flow packets in the cutaway: true, 'intake', 'delivery' or false
    dose: true, // the bead at the nozzle (off on the release-only close-up)
    priming: false, // the 5-stroke priming lap (step 5)
  };

  // Thumb drives the head down on a smooth push; the spring returns it fast
  // and decelerates into the top stop (it is strongest when most compressed).
  const pressAt = (p) => win(p, 0.06, 0.34);
  const releaseAt = (p) => {
    const x = clamp01((p - 0.52) / 0.3);
    return 1 - Math.pow(1 - x, 2.2) * (1 - 0.15 * x);
  };
  const depthAt = (p) => pressAt(p) - (p >= 0.52 ? releaseAt(p) : 0);

  function apply() {
    const K = Math.floor(state.stroke + 1e-9);
    const p = state.stroke - K;
    const d = depthAt(p);
    const R = p >= 0.52 ? releaseAt(p) : 0;
    const cut = state.reveal >= 0.5;

    // --- reveal ---
    for (const t of turnedParts) {
      t.full.visible = !cut;
      t.cut.visible = cut;
    }
    ribsFront.visible = !cut;
    for (const o of internals) o.visible = cut;
    const r = clamp01(state.reveal);
    bottleMat.opacity = 0.1 - 0.05 * r;
    reservoirMat.opacity = 0.9 - 0.76 * r;
    reservoirMat.depthWrite = r < 0.5; // trap 7

    // --- mechanism ---
    plunger.position.y = -STROKE * d;
    deliveryDots.mesh.position.y = plunger.position.y;
    springGroup.scale.y = (PISTON_BOTTOM - STROKE * d - SPRING_BASE) / SPRING_REST;
    const upperLift = win(p, 0.08, 0.13) - win(p, 0.32, 0.37);
    const lowerLift = win(p, 0.53, 0.58) - win(p, 0.79, 0.85);
    upperBall.position.y = UPPER_SEAT + UPPER_LIFT * upperLift;
    lowerBall.position.y = LOWER_SEAT + LOWER_LIFT * lowerLift;

    // --- soap levels ---
    // chamber soap is tracked as a HEIGHT of bore; H is the chamber's height
    const H = PISTON_BOTTOM - STROKE * d - CHAMBER_FLOOR;
    let tube = 1;
    let V = H;
    let stem = 1;
    let fade = 1;
    let dropOn = state.dose;
    if (state.priming) {
      // air squashes instead of opening valves: each release lifts the soap
      // a little further, until the chamber is full and the stem floods
      dropOn = K === 4;
      if (K === 0) [tube, V, stem] = [0.6 * R, 0, 0];
      else if (K === 1) [tube, V, stem] = [0.6 + 0.4 * clamp01(R * 2.5), 14 * clamp01((R - 0.4) / 0.6), 0];
      else if (K === 2) [tube, V, stem] = [1, 14 + 22 * R, 0];
      else if (K === 3) {
        V = p < 0.52 ? 36 : 32.5 + 12 * R;
        stem = p < 0.52 ? clamp01((36 - H) / 3.5) : 1;
      }
      fade = 1 - win(state.stroke / 5, 0.93, 0.995);
    }
    const chamberH = Math.min(V, H);
    soapMat.opacity = 0.72 * fade;
    tubeSoap.visible = cut && tube > 0.001;
    tubeSoap.scale.y = Math.max(0.001, tube);
    cageSoap.visible = cut && (V > 0.001 || !state.priming);
    boreSoap.visible = cut && chamberH > 0.05;
    boreSoap.scale.y = Math.max(0.001, chamberH);
    stemSoap.visible = cut && stem > 0.001;
    stemSoap.scale.y = Math.max(0.001, stem);
    channelSoap.visible = cut && stem >= 0.999;

    // --- flow packets: advance two whole path lengths per stroke ---
    const flowOn = cut && state.flows && !state.priming;
    const ri = clamp01((p - 0.53) / 0.31);
    const rd = clamp01((p - 0.08) / 0.28);
    const showIntake = flowOn && state.flows !== 'delivery';
    const showDelivery = flowOn && state.flows !== 'intake';
    placeDots(intakeDots, intakeCurve, (ri * 2) % 1, showIntake && lowerLift > 0.02);
    intakeDots.material.opacity = 0.95 * lowerLift;
    placeDots(deliveryDots, deliveryCurve, (rd * 2) % 1, showDelivery && upperLift > 0.02);
    deliveryDots.material.opacity = 0.95 * upperLift;

    // --- the dose: a bead swells on the nozzle while the head goes down,
    // lets go at the bottom of the stroke and falls ---
    const g = win(p, 0.12, 0.34);
    const tf = clamp01((p - 0.36) / 0.22);
    drop.visible = dropOn && p > 0.12 && p < 0.58;
    if (drop.visible) {
      const rr = 0.8 + (DROP_R - 0.8) * g;
      if (p < 0.36) {
        const tipY = SPOUT_Y - STROKE * d;
        drop.position.set(SPOUT_TIP + rr * 0.25, tipY + 0.6 - rr * 0.95, 0);
        drop.scale.set(rr * 0.82, rr * (1.0 + 0.12 * g), rr * 0.82);
      } else {
        const y0 = SPOUT_Y - STROKE * depthAt(0.36) + 0.6 - DROP_R * 0.95;
        drop.position.set(SPOUT_TIP + DROP_R * 0.25, y0 - 95 * tf * tf, 0);
        drop.scale.set(DROP_R * 0.82, DROP_R * 1.12, DROP_R * 0.82);
      }
      dropMat.opacity = 0.94 * (1 - win(tf, 0.6, 1));
    }
  }
  apply();

  return {
    group,
    state,
    parts: { plunger, head, springGroup, upperBall, lowerBall, housing: housing.cut, drop },
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setReveal(t) {
      state.reveal = t;
      apply();
    },
    setLabels: labels.setLabels,
  };
}
