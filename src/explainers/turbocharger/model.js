import * as THREE from 'three';
import { materials, arrow, studioPlinth } from '../../framework/parts.js';
import { beveledBox, lathe, tubeAlong, boltCircle } from '../../framework/geometry.js';
import { calloutSets } from '../../framework/callouts.js';
import { TAU } from '../../framework/motion.js';

// A GT28-class turbocharger on a display cradle. The machine axis is +X:
// compressor (cold, aluminium) at -X, centre bearing housing in the middle,
// turbine (hot, cast iron) at +X. Azimuth psi is measured from +Y toward +Z,
// so a part's clock position around the axis is one number.
//
// PROPORTIONS, all derived from the two wheel diameters so the ratios hold by
// construction (real GT28: 60 mm compressor wheel, 53 mm turbine, ~135 mm and
// ~120 mm housing ODs, ~250 mm end to end):
//   compressor wheel   0.72 dia     turbine wheel   0.62 dia
//   compressor housing 1.62 OD = 2.25x its wheel
//   turbine housing    1.48 OD = 2.39x its wheel
//   overall length     2.97     = 4.1x the compressor wheel
//   shaft              0.11 dia  = 1/6.5 of the compressor wheel
//
// STATE (one object, one pose function):
//   spin     shaft angle in radians; both wheels ride it, the floating rings
//            ride it at 1/3 (measured 0.31-0.43x on real bearings)
//   flow     0-1 stream phase; every streamline wraps by construction
//   reveal   0 sealed product / 1 housings swapped for their ghost twins
//   hot      0-1 hot-side incandescence
//   exhaust / intake / oil   per-stream opacity
//   cool     water-jacket visualisation
//   gate     wastegate flapper lift, 0 shut / 1 open
const AXIS_Y = 1.24;

// --- compressor (cold) side -------------------------------------------------
const CW_R = 0.36; // exducer radius - the wheel's big diameter
const CW_IND_R = 0.25; // inducer tip radius (the "trim" diameter)
const CW_BACK_X = -0.775; // exducer / backplate station
const CW_NOSE_X = -1.045; // inducer leading edge
const CW_B2 = 0.072; // exducer blade height, measured along the axis
const CV_X = -0.812; // scroll mid-plane
const CV_THROAT = 0.415; // scroll inner wall = wheel + the diffuser gap
const CV_RBIG = 0.215;
const CV_RSMALL = 0.088;
const CV_PSI0 = -0.3; // fat end sits near the top, where a camera can see it
const CV_DIR = -1; // ...and the scroll winds against psi, so flow leaves there
// The discharge leaves the fat end up and forward. That is about 27 degrees
// off the scroll's true tangent - real castings make exactly this bend, and it
// buys a duct that reads as a pipe instead of one aimed at the lens.
const CV_OUT = new THREE.Vector3(0, 0.62, 0.785).normalize();

// --- turbine (hot) side -----------------------------------------------------
const TW_R = 0.31; // inducer radius - gas enters here, radially
const TW_EXD_R = 0.215; // exducer tip radius - gas leaves here, axially
const TW_BACK_X = 0.718; // back disc, the shaft end
const TW_EXD_X = 1.015;
const TW_B = 0.077; // inducer blade height along the axis
const TV_X = 0.756;
const TV_THROAT = 0.36;
const TV_RBIG = 0.208;
const TV_RSMALL = 0.082;
const TV_RC0 = TV_THROAT + TV_RBIG;
const TV_PSI0 = 0; // fat end straight up...
const TV_DIR = 1; // ...winding with psi, the way the wheel turns
const TV_IN = new THREE.Vector3(0, 0, -1); // inlet flange faces the rear

// The hot side is authored in its own natural coordinates and then slid
// inboard as one group. On a real GT28 the exposed centre section between the
// two housings is only about a third of a housing diameter; authored end to
// end it came out nearly a full diameter, and the machine read as two brake
// discs on a pipe rather than a turbocharger.
const HOT_SHIFT = -0.3;

const SWEEP = TAU * 0.95; // 342 degrees, leaving a tongue at the cutwater
const SHAFT_R = 0.055; // 0.11 dia = 1/6.5 of the compressor wheel, as built
const JOURNAL_R = 0.066;
const BORE_R = 0.115;
const GATE_PSI = 0.611; // 35 degrees - wastegate and actuator share this clock

// Quadratic Bezier in the meridional (x, r) plane. Every passage in a radial
// machine is an elbow - axial at one end, radial at the other - and three
// points are exactly the right amount of curve to describe one.
const qbez = (p0, c, p2) => (s) => {
  const u = 1 - s;
  return [
    u * u * p0[0] + 2 * u * s * c[0] + s * s * p2[0],
    u * u * p0[1] + 2 * u * s * c[1] + s * s * p2[1],
  ];
};

// The two meridional lines of each wheel: the hub line its solid body is
// turned from, and the shroud line its blade tips sweep. The housing's own
// contour is that shroud line plus a running clearance, so both wheels and
// both castings come off the same four curves and can never disagree.
const CW_HUB = qbez([CW_NOSE_X, 0.058], [-0.8, 0.086], [CW_BACK_X, 0.355]);
const CW_SHROUD = qbez([CW_NOSE_X, CW_IND_R], [-0.878, 0.289], [CW_BACK_X - CW_B2, CW_R]);
// the hub dives in radius EARLY - a control point pulled out along x instead
// leaves almost no gap between hub and shroud, and the blades vanish into the
// wheel body (the turbine reads as a plain cone)
const TW_HUB = qbez([TW_BACK_X, TW_R], [0.8, 0.205], [TW_EXD_X, 0.075]);
const TW_SHROUD = qbez([TW_BACK_X + TW_B, TW_R], [0.968, 0.306], [TW_EXD_X, TW_EXD_R]);
const clearance = (line, gap) => (s) => {
  const [x, r] = line(s);
  return [x, r + gap];
};

// lathe() revolves [[radius, y]] around +Y, but every housing here is a solid
// of revolution about +X - so profiles are authored in (r, x) and the finished
// mesh is rolled -90 degrees about Z, which maps +Y onto +X.
function latheX(profile, material, segments = 60) {
  const mesh = lathe(profile, material, segments);
  mesh.rotation.z = -Math.PI / 2;
  return mesh;
}

// Sample a meridional line into lathe profile points [[r, x], ...].
function meridian(fn, n, s0 = 0, s1 = 1) {
  const out = [];
  for (let i = 0; i <= n; i++) {
    const [x, r] = fn(s0 + (s1 - s0) * (i / n));
    out.push([r, x]);
  }
  return out;
}

// Point a +Y-built primitive along an arbitrary direction.
function aim(obj, dir) {
  obj.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.clone().normalize());
  return obj;
}

// A real, THICK blade for a radial machine: the ruled surface between a hub
// line and a shroud line, wrapped around +X by wrap(s), then given
// circumferential thickness so it has a visible edge. A single-sided sheet is
// the biggest "programmer's demo" tell on a wheel the camera pushes into.
function bladeSolid({
  hub,
  shroud,
  wrap,
  thick = 0.017,
  thickTip = 0.008,
  sMin = 0,
  ns = 34,
  nt = 9,
}) {
  const P = [];
  const UV = [];
  const IDX = [];
  const nJ = nt + 1;
  const nI = ns + 1;
  for (let layer = 0; layer < 2; layer++) {
    const sign = layer === 0 ? 1 : -1;
    for (let i = 0; i <= ns; i++) {
      const s = sMin + (1 - sMin) * (i / ns);
      const [xh, rh] = hub(s);
      const [xs, rs] = shroud(s);
      const th = wrap(s);
      // thin the leading edge to a knife, taper the trailing edge a little
      const edge = Math.min(1, (i / ns) * 7 + 0.12) * Math.min(1, ((ns - i) / ns) * 9 + 0.3);
      for (let j = 0; j <= nt; j++) {
        const t = j / nt;
        const x = xh + (xs - xh) * t;
        const r = rh + (rs - rh) * t;
        const h = (thick + (thickTip - thick) * t) * edge;
        const psi = th + (sign * h * 0.5) / Math.max(r, 0.03);
        P.push(x, r * Math.cos(psi), r * Math.sin(psi));
        UV.push(i / ns, t);
      }
    }
  }
  const A = (i, j) => i * nJ + j;
  const B = (i, j) => nI * nJ + i * nJ + j;
  for (let i = 0; i < ns; i++) {
    for (let j = 0; j < nt; j++) {
      IDX.push(A(i, j), A(i, j + 1), A(i + 1, j + 1), A(i, j), A(i + 1, j + 1), A(i + 1, j));
      IDX.push(B(i, j), B(i + 1, j + 1), B(i, j + 1), B(i, j), B(i + 1, j), B(i + 1, j + 1));
    }
  }
  for (let j = 0; j < nt; j++) {
    IDX.push(A(0, j), B(0, j), B(0, j + 1), A(0, j), B(0, j + 1), A(0, j + 1));
    IDX.push(A(ns, j), A(ns, j + 1), B(ns, j + 1), A(ns, j), B(ns, j + 1), B(ns, j));
  }
  for (let i = 0; i < ns; i++) {
    IDX.push(A(i, nt), A(i + 1, nt), B(i + 1, nt), A(i, nt), B(i + 1, nt), B(i, nt));
    IDX.push(A(i, 0), B(i, 0), B(i + 1, 0), A(i, 0), B(i + 1, 0), A(i + 1, 0));
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo.setIndex(IDX);
  geo.computeVertexNormals();
  // Winding self-check: layer A must face +psi. Which way the ruled surface
  // comes out depends on the SIGN of wrap(), which differs per wheel, so flip
  // the index buffer rather than maintaining two near-identical loops.
  const mid = A(Math.floor(ns / 2), Math.floor(nt / 2));
  const n = new THREE.Vector3().fromBufferAttribute(geo.attributes.normal, mid);
  const p = new THREE.Vector3().fromBufferAttribute(geo.attributes.position, mid);
  if (n.dot(new THREE.Vector3(0, -p.z, p.y).normalize()) < 0) {
    const a = geo.index.array;
    for (let k = 0; k < a.length; k += 3) {
      const t = a[k];
      a[k] = a[k + 2];
      a[k + 2] = t;
    }
    geo.index.needsUpdate = true;
    geo.computeVertexNormals();
  }
  return geo;
}

// The snail. A spiral centreline in the plane x = x0, swept with a circular
// section whose radius shrinks toward the tongue: the passage gives its area
// away as it gives its flow to the wheel (or takes it). Returns the geometry
// plus centre(t), which the flow streamlines ride - so the arrows are
// guaranteed to run down the middle of the real passage.
function scrollVolute({ x0, throatR, rBig, rSmall, psi0, dir, seg = 168, radSeg = 26 }) {
  const at = (t) => {
    const psi = psi0 + dir * SWEEP * t;
    // the section must visibly SHRINK toward the tongue, or the casting reads
    // as a plain donut and the machine loses the one silhouette everyone knows
    const r = rSmall + (rBig - rSmall) * Math.pow(1 - t, 0.7);
    return { psi, r, Rc: throatR + r };
  };
  const centre = (t) => {
    const { psi, Rc } = at(t);
    return new THREE.Vector3(x0, Rc * Math.cos(psi), Rc * Math.sin(psi));
  };
  const P = [];
  const UV = [];
  const IDX = [];
  for (let i = 0; i <= seg; i++) {
    const t = i / seg;
    const { psi, r, Rc } = at(t);
    const cy = Rc * Math.cos(psi);
    const cz = Rc * Math.sin(psi);
    for (let j = 0; j <= radSeg; j++) {
      const phi = (j / radSeg) * TAU;
      const rr = Math.cos(phi) * r;
      P.push(x0 + Math.sin(phi) * r, cy + rr * Math.cos(psi), cz + rr * Math.sin(psi));
      UV.push(t * 6, j / radSeg);
    }
  }
  for (let i = 0; i < seg; i++) {
    for (let j = 0; j < radSeg; j++) {
      const a = i * (radSeg + 1) + j;
      const b = a + radSeg + 1;
      IDX.push(a, b, a + 1, b, b + 1, a + 1);
    }
  }
  const capA = P.length / 3;
  const c0 = centre(0);
  P.push(c0.x, c0.y, c0.z);
  UV.push(0.5, 0.5);
  const capB = P.length / 3;
  const c1 = centre(1);
  P.push(c1.x, c1.y, c1.z);
  UV.push(0.5, 0.5);
  for (let j = 0; j < radSeg; j++) {
    IDX.push(capA, j + 1, j);
    IDX.push(capB, seg * (radSeg + 1) + j, seg * (radSeg + 1) + j + 1);
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(P, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(UV, 2));
  geo.setIndex(IDX);
  geo.computeVertexNormals();
  return { geometry: geo, centre, at };
}

// A stream of flow arrows riding a curve. One phase scalar sweeps 0-1 and the
// whole queue wraps by construction - the seamless-loop contract for free.
function makeStream(curve, { count = 15, size = 0.085, color = 0x6ec8ff } = {}) {
  const group = new THREE.Group();
  const items = [];
  for (let i = 0; i < count; i++) {
    const a = arrow(color, size);
    a.userData.seed = i / count;
    group.add(a);
    items.push(a);
  }
  const up = new THREE.Vector3(0, 1, 0);
  const tan = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const tint = new THREE.Color();
  function set(phase, opacity, ramp) {
    const on = opacity > 0.002;
    for (const a of items) {
      a.visible = on;
      if (!on) continue;
      const p = (phase + a.userData.seed) % 1;
      a.position.copy(curve.getPointAt(p));
      curve.getTangentAt(p, tan);
      q.setFromUnitVectors(up, tan);
      a.quaternion.copy(q);
      a.material.opacity = opacity * Math.min(1, p * 7) * Math.min(1, (1 - p) * 7);
      if (ramp) {
        ramp(p, tint);
        a.material.color.copy(tint);
        a.material.emissive.copy(tint);
      }
    }
  }
  set(0, 0);
  return { group, set };
}

export function buildTurbocharger({ scene }) {
  const group = new THREE.Group();
  scene.add(group);
  group.add(studioPlinth({ w: 3.05, h: 0.24, d: 1.68 }));

  // everything turbo lives in `core`, whose origin IS the machine axis
  const core = new THREE.Group();
  core.position.y = AXIS_Y;
  group.add(core);

  // ---- materials -----------------------------------------------------------
  const coldMat = materials.aluminum(0xa9b0b9);
  coldMat.roughness = 0.72; // cast aluminium, not a mirror
  const ironMat = materials.grimyAluminum(0x6f6659); // cast iron, hot side
  ironMat.emissive = new THREE.Color(0xd93a10);
  ironMat.emissiveIntensity = 0;
  const chMat = materials.grimyAluminum(0x63605b); // centre housing
  chMat.roughness = 1.0; // it sits between two castings - it must not out-shine them
  const steelMat = materials.brushedSteel(0xb9c0c9);
  steelMat.roughness = 0.55;
  const boltMat = materials.brushedSteel(0x8d949d);
  boltMat.roughness = 0.6;
  const bronzeMat = materials.brushedSteel(0xba9152);
  bronzeMat.roughness = 0.6;
  const darkMat = materials.darkMetal(0x35312b);
  const cwMat = materials.aluminum(0xc4c9d0);
  cwMat.roughness = 0.5;
  const twMat = materials.brushedSteel(0x7c7466);
  twMat.roughness = 0.86;
  twMat.emissive = new THREE.Color(0xd93a10);
  twMat.emissiveIntensity = 0;
  const shieldMat = materials.brushedSteel(0x9aa1a8);
  shieldMat.roughness = 0.75;

  // Ghost twins for the housings. Metal CANNOT be ghosted - it stays specular
  // at any opacity - so on reveal the metal shells are hidden outright and
  // these plain, coat-free, non-metal shells stand in for them.
  const ghostMat = new THREE.MeshPhysicalMaterial({
    color: 0x9db2c6,
    metalness: 0,
    roughness: 0.2,
    clearcoat: 0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const ghostHotMat = new THREE.MeshPhysicalMaterial({
    color: 0xbb9484,
    metalness: 0,
    roughness: 0.25,
    clearcoat: 0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
    emissive: new THREE.Color(0xd93a10),
    emissiveIntensity: 0,
  });

  // Everything on the hot side lives here, slid inboard by HOT_SHIFT.
  const hotGroup = new THREE.Group();
  hotGroup.position.x = HOT_SHIFT;
  core.add(hotGroup);

  const shellSolid = [];
  const shellGhost = [];
  // Register a housing part: it gets a ghost twin sharing the same geometry,
  // and reveal simply swaps which of the two is visible. `hot` does double
  // duty - it picks the warm ghost material AND routes the part into
  // hotGroup, so the turbine side can be authored in its own coordinates.
  function shell(parent, obj, hot = false) {
    (hot ? hotGroup : parent).add(obj);
    const ghost = obj.clone(true);
    ghost.traverse((o) => {
      if (o.isMesh) {
        o.material = hot ? ghostHotMat : ghostMat;
        o.castShadow = false;
        o.renderOrder = 3;
      }
    });
    ghost.visible = false;
    (hot ? hotGroup : parent).add(ghost);
    shellSolid.push(obj);
    shellGhost.push(ghost);
    return obj;
  }

  // ---- compressor housing: scroll, inlet snout, back plate -----------------
  const cv = scrollVolute({
    x0: CV_X,
    throatR: CV_THROAT,
    rBig: CV_RBIG,
    rSmall: CV_RSMALL,
    psi0: CV_PSI0,
    dir: CV_DIR,
  });
  shell(core, new THREE.Mesh(cv.geometry, coldMat));

  // the ring of casting around the wheel that closes the scroll's inner wall
  shell(
    core,
    latheX(
      [
        [CW_R + 0.012, CW_BACK_X - 0.165],
        [CV_THROAT, CW_BACK_X - 0.16],
        [CV_THROAT, CW_BACK_X - 0.02],
        [CW_R + 0.012, CW_BACK_X - 0.015],
        [CW_R + 0.012, CW_BACK_X - 0.165],
      ],
      coldMat,
    ),
  );

  // Inlet snout: a REAL hole, walled, with a rolled bell-mouth lip. Profile
  // order matters - lathe normals come out as (dy, -dr), so the OUTER wall has
  // to be traversed with x increasing or the whole snout renders inside out.
  shell(
    core,
    latheX(
      [
        [0.298, -1.462],
        [0.312, -1.437],
        [0.3, -1.395],
        [0.306, -1.31],
        [0.334, -1.2],
        [0.378, -1.1],
        [0.352, -1.1],
        [0.302, -1.19],
        [0.282, -1.3],
        [0.276, -1.39],
        [0.278, -1.436],
        [0.298, -1.462],
      ],
      coldMat,
    ),
  );

  // The shroud casting: the bulk of the housing, wrapping the impeller from
  // the snout bore out to the scroll. Without it the wheel sits in mid-air and
  // the whole cold side reads as a thin spiral ring rather than a casting.
  shell(
    core,
    latheX(
      [
        [0.352, -1.1],
        [0.392, -1.02],
        [0.412, -0.95],
        [0.418, -0.87],
        [0.418, -0.845],
        [0.378, -0.845],
        ...meridian(clearance(CW_SHROUD, 0.016), 16, 1, 0),
        [0.276, -1.1],
        [0.352, -1.1],
      ],
      coldMat,
    ),
  );

  // back plate closing the compressor onto the centre housing, plus its bolts
  shell(
    core,
    latheX(
      [
        [0.0, -0.742],
        [0.3, -0.742],
        [0.44, -0.738],
        [0.455, -0.716],
        [0.3, -0.706],
        [0.245, -0.7],
        [0.245, -0.72],
        [0.0, -0.724],
      ],
      coldMat,
    ),
  );
  // The full-diameter rear flange. A volute's own walls hug the passage, so
  // where the scroll is thin the casting is thin too - and side-on the whole
  // housing then reads as a wire ring rather than a casting. Every real
  // housing carries this flat flange at close to its maximum diameter; it is
  // most of the cold side's visual mass.
  // sized BELOW the scroll's maximum envelope on purpose: a flange as wide as
  // the fat end swallows the volute bulge and the housing reads as a brake disc
  const CV_OD = 0.6;
  shell(
    core,
    latheX(
      [
        [0.415, -0.738],
        [CV_OD, -0.734],
        [CV_OD + 0.006, -0.712],
        [CV_OD, -0.69],
        [0.415, -0.686],
        [0.415, -0.738],
      ],
      coldMat,
    ),
  );
  const cvBolts = boltCircle(12, CV_OD - 0.075, 0.028, boltMat, 0.034);
  cvBolts.rotation.z = -Math.PI / 2;
  cvBolts.position.x = -0.694;
  shell(core, cvBolts);

  // discharge duct, leaving the fat end of the scroll up and toward the viewer
  const cvFat = cv.centre(0);
  const cvDuctEnd = cvFat.clone().addScaledVector(CV_OUT, 0.4);
  shell(
    core,
    tubeAlong(
      [
        cvFat.toArray(),
        cvFat.clone().addScaledVector(CV_OUT, 0.14).toArray(),
        cvFat.clone().addScaledVector(CV_OUT, 0.28).toArray(),
        cvDuctEnd.toArray(),
      ],
      CV_RBIG * 0.93,
      coldMat,
      { tubularSegments: 40, radialSegments: 26 },
    ),
  );
  const cvBead = aim(
    new THREE.Mesh(new THREE.TorusGeometry(CV_RBIG * 0.93, 0.026, 10, 36), coldMat),
    CV_OUT,
  );
  cvBead.rotation.x += Math.PI / 2;
  cvBead.position.copy(cvDuctEnd);
  cvBead.castShadow = true;
  shell(core, cvBead);
  const cvClamp = aim(
    new THREE.Mesh(
      new THREE.CylinderGeometry(CV_RBIG * 0.99, CV_RBIG * 0.99, 0.045, 36),
      boltMat,
    ),
    CV_OUT,
  );
  cvClamp.position.copy(cvFat).addScaledVector(CV_OUT, 0.31);
  shell(core, cvClamp);

  // Both duct mouths get a dark liner, the way the jet engine's nozzle does:
  // a single-sided tube shows nothing through its open end, so the opening
  // reads as a hole cut in the casting rather than a pipe you can see into.
  const boreMat = new THREE.MeshStandardMaterial({
    color: 0x24262a,
    roughness: 0.94,
    metalness: 0.2,
    side: THREE.DoubleSide,
  });
  const cvBore = aim(
    new THREE.Mesh(
      new THREE.CylinderGeometry(CV_RBIG * 0.88, CV_RBIG * 0.88, 0.34, 32, 1, true),
      boreMat,
    ),
    CV_OUT,
  );
  cvBore.position.copy(cvFat).addScaledVector(CV_OUT, 0.25);
  shell(core, cvBore);

  // ---- turbine housing: scroll, inlet flange, outlet snout ------------------
  const tv = scrollVolute({
    x0: TV_X,
    throatR: TV_THROAT,
    rBig: TV_RBIG,
    rSmall: TV_RSMALL,
    psi0: TV_PSI0,
    dir: TV_DIR,
  });
  shell(core, new THREE.Mesh(tv.geometry, ironMat), true);
  shell(
    core,
    latheX(
      [
        [TW_R + 0.012, TW_BACK_X - 0.03],
        [TV_THROAT, TW_BACK_X - 0.025],
        [TV_THROAT, TW_BACK_X + TW_B + 0.03],
        [TW_R + 0.012, TW_BACK_X + TW_B + 0.035],
        [TW_R + 0.012, TW_BACK_X - 0.03],
      ],
      ironMat,
    ),
    true,
  );

  const tvFat = tv.centre(0);
  const tvDuctEnd = tvFat.clone().addScaledVector(TV_IN, 0.56);
  shell(
    core,
    tubeAlong(
      [
        tvFat.toArray(),
        tvFat.clone().addScaledVector(TV_IN, 0.19).toArray(),
        tvFat.clone().addScaledVector(TV_IN, 0.38).toArray(),
        tvDuctEnd.toArray(),
      ],
      TV_RBIG * 0.93,
      ironMat,
      { tubularSegments: 40, radialSegments: 26 },
    ),
    true,
  );
  const tvFlange = aim(new THREE.Mesh(new THREE.CylinderGeometry(0.27, 0.27, 0.042, 40), ironMat), TV_IN);
  tvFlange.position.copy(tvDuctEnd);
  tvFlange.castShadow = true;
  shell(core, tvFlange, true);
  const tvBore = aim(
    new THREE.Mesh(
      new THREE.CylinderGeometry(TV_RBIG * 0.88, TV_RBIG * 0.88, 0.34, 32, 1, true),
      boreMat,
    ),
    TV_IN,
  );
  tvBore.position.copy(tvFat).addScaledVector(TV_IN, 0.4);
  shell(core, tvBore, true);
  const tvBolts = boltCircle(4, 0.215, 0.03, boltMat, 0.036);
  aim(tvBolts, TV_IN);
  tvBolts.position.copy(tvDuctEnd);
  shell(core, tvBolts, true);

  // outlet snout: the second REAL hole, walled and flanged
  shell(
    core,
    latheX(
      [
        [0.335, 1.02],
        [0.3, 1.1],
        [0.286, 1.26],
        [0.3, 1.38],
        [0.352, 1.395],
        [0.352, 1.428],
        [0.3, 1.428],
        [0.262, 1.412],
        [0.252, 1.3],
        [0.258, 1.14],
        [0.29, 1.04],
        [0.335, 1.02],
      ],
      ironMat,
    ),
    true,
  );

  // the hot side's matching full-diameter flange, facing the centre housing
  const TV_OD = 0.55;
  shell(
    core,
    latheX(
      [
        [0.33, 0.6],
        [TV_OD, 0.604],
        [TV_OD + 0.006, 0.626],
        [TV_OD, 0.648],
        [0.33, 0.652],
        [0.33, 0.6],
      ],
      ironMat,
    ),
    true,
  );
  const tvBoltRing = boltCircle(10, TV_OD - 0.07, 0.028, boltMat, 0.034);
  tvBoltRing.rotation.z = -Math.PI / 2;
  tvBoltRing.position.x = 0.592;
  shell(core, tvBoltRing, true);

  // the matching shroud casting on the hot side: scroll throat to outlet bore
  shell(
    core,
    latheX(
      [
        [0.372, 0.8],
        [0.372, 0.9],
        [0.352, 0.985],
        [0.335, 1.045],
        [0.29, 1.045],
        [0.24, 1.018],
        ...meridian(clearance(TW_SHROUD, 0.018), 16, 1, 0),
        [0.372, 0.8],
      ],
      ironMat,
    ),
    true,
  );

  // ---- centre housing ------------------------------------------------------
  shell(
    core,
    latheX(
      [
        [BORE_R + 0.04, -0.724],
        [0.262, -0.72],
        [0.262, -0.694],
        [0.232, -0.64],
        [0.225, -0.3],
        [0.242, -0.06],
        [0.225, 0.08],
        [0.248, 0.26],
        [0.272, 0.3],
        [0.272, 0.348],
        [BORE_R + 0.04, 0.352],
        [BORE_R, 0.348],
        [BORE_R, 0.245],
        [BORE_R - 0.004, 0.0],
        [BORE_R, -0.545],
        [BORE_R, -0.694],
        [BORE_R + 0.04, -0.724],
      ],
      chMat,
    ),
  );

  // external hardware: bolted to the outside, so it stays visible on reveal
  const hardware = new THREE.Group();
  core.add(hardware);
  const vband = new THREE.Mesh(new THREE.TorusGeometry(0.262, 0.03, 12, 48), boltMat);
  vband.rotation.y = Math.PI / 2;
  vband.position.x = 0.664;
  vband.castShadow = true;
  hotGroup.add(vband);

  // Tilted onto the front shoulder rather than dead top: straight up, the
  // compressor housing occludes it from the hero camera and its callout lands
  // on metal that is not the oil feed.
  const feedMount = new THREE.Group();
  feedMount.rotation.x = 0.42;
  hardware.add(feedMount);
  const feedBoss = new THREE.Mesh(new THREE.CylinderGeometry(0.058, 0.072, 0.2, 20), chMat);
  feedBoss.position.set(-0.24, 0.24, 0);
  feedBoss.castShadow = true;
  const feedPad = beveledBox(0.19, 0.035, 0.15, chMat, 0.012);
  feedPad.position.set(-0.24, 0.345, 0);
  const feedBolts = boltCircle(2, 0.065, 0.022, boltMat, 0.03);
  feedBolts.position.set(-0.24, 0.375, 0);
  feedBolts.rotation.y = Math.PI / 2;
  feedMount.add(feedBoss, feedPad, feedBolts);

  const drainStub = new THREE.Mesh(new THREE.CylinderGeometry(0.1, 0.085, 0.14, 20), chMat);
  drainStub.position.set(-0.06, -0.235, 0);
  drainStub.castShadow = true;
  const drainFlange = beveledBox(0.3, 0.036, 0.21, chMat, 0.014);
  drainFlange.position.set(-0.06, -0.318, 0);
  drainFlange.castShadow = true;
  hardware.add(drainStub, drainFlange);

  for (const sz of [1, -1]) {
    const port = new THREE.Mesh(new THREE.CylinderGeometry(0.048, 0.055, 0.13, 16), chMat);
    port.rotation.x = Math.PI / 2;
    port.position.set(0.1, 0.02, sz * 0.21);
    port.castShadow = true;
    const lip = new THREE.Mesh(new THREE.TorusGeometry(0.05, 0.012, 8, 20), boltMat);
    lip.position.set(0.1, 0.02, sz * 0.272);
    hardware.add(port, lip);
  }

  // ---- display cradle ------------------------------------------------------
  for (const cx of [-0.44, 0.16]) {
    const saddle = new THREE.Mesh(
      new THREE.TorusGeometry(0.238, 0.026, 10, 28, Math.PI * 0.72),
      boltMat,
    );
    saddle.rotation.y = Math.PI / 2;
    saddle.rotation.z = Math.PI * 1.14;
    saddle.position.set(cx, 0, 0);
    saddle.castShadow = true;
    core.add(saddle);
    for (const sz of [1, -1]) {
      core.add(
        tubeAlong(
          [
            [cx, -0.13, sz * 0.16],
            [cx, -0.45, sz * 0.25],
            [cx, -0.87, sz * 0.3],
            [cx, -0.985, sz * 0.3],
          ],
          0.032,
          boltMat,
          { tubularSegments: 24 },
        ),
      );
      const foot = beveledBox(0.16, 0.03, 0.13, boltMat, 0.012);
      foot.position.set(cx, -0.985, sz * 0.3);
      core.add(foot);
    }
  }

  // ---- the rotating assembly ----------------------------------------------
  const rotor = new THREE.Group();
  core.add(rotor);

  rotor.add(
    latheX(
      [
        [0.0, -0.86],
        [0.04, -0.862],
        [0.04, -0.83],
        [0.052, -0.822],
        [0.052, -0.755],
        [SHAFT_R, -0.735],
        [JOURNAL_R, -0.62],
        [JOURNAL_R, -0.24],
        [SHAFT_R, -0.2],
        [SHAFT_R, -0.02],
        [JOURNAL_R, 0.02],
        [JOURNAL_R, 0.22],
        [SHAFT_R, 0.26],
        [SHAFT_R, 0.36],
        [0.048, 0.386],
        [0.1, 0.4],
        [0.0, 0.4],
      ],
      steelMat,
    ),
  );

  // thrust collar: the one part that stops a 200,000 rpm shaft walking
  rotor.add(
    latheX(
      [
        [SHAFT_R, -0.665],
        [0.098, -0.66],
        [0.098, -0.622],
        [SHAFT_R, -0.618],
      ],
      steelMat,
    ),
  );

  // compressor wheel: forged aluminium, 6 full blades + 6 splitters
  const cwWrap = (s) => -0.95 * Math.pow(s, 1.35);
  const cwBody = latheX(
    [
      [0.0, -1.084],
      [0.026, -1.078],
      [0.045, -1.062],
      ...meridian(CW_HUB, 22),
      [0.36, -0.772],
      [0.36, -0.756],
      [0.33, -0.748],
      [0.12, -0.744],
      [0.058, -0.744],
      [0.0, -0.746],
    ],
    cwMat,
  );
  rotor.add(cwBody);
  const cwFullGeo = bladeSolid({ hub: CW_HUB, shroud: CW_SHROUD, wrap: cwWrap });
  const cwSplitGeo = bladeSolid({
    hub: CW_HUB,
    shroud: CW_SHROUD,
    wrap: cwWrap,
    sMin: 0.42,
    ns: 22,
  });
  for (let i = 0; i < 6; i++) {
    const a = (i * TAU) / 6;
    const full = new THREE.Mesh(cwFullGeo, cwMat);
    full.rotation.x = a;
    full.castShadow = true;
    const split = new THREE.Mesh(cwSplitGeo, cwMat);
    split.rotation.x = a + TAU / 12;
    split.castShadow = true;
    rotor.add(full, split);
  }
  const cwNut = new THREE.Mesh(new THREE.CylinderGeometry(0.042, 0.042, 0.05, 6), steelMat);
  cwNut.rotation.z = Math.PI / 2;
  cwNut.position.x = -1.062;
  rotor.add(cwNut);

  // turbine wheel: cast Inconel, 11 blades, friction-welded to the shaft
  const twWrap = (s) => -0.62 * Math.pow(s, 1.5);
  const twBody = latheX(
    [
      [0.0, 0.7],
      [0.12, 0.7],
      [0.3, 0.703],
      [TW_R, 0.712],
      ...meridian(TW_HUB, 22, 0.02),
      [0.068, 1.024],
      [0.044, 1.038],
      [0.0, 1.044],
    ],
    twMat,
  );
  const twGroup = new THREE.Group();
  twGroup.position.x = HOT_SHIFT;
  rotor.add(twGroup);
  twGroup.add(twBody);
  const twGeo = bladeSolid({
    hub: TW_HUB,
    shroud: TW_SHROUD,
    wrap: twWrap,
    thick: 0.019,
    thickTip: 0.01,
  });
  for (let i = 0; i < 11; i++) {
    const b = new THREE.Mesh(twGeo, twMat);
    b.rotation.x = (i * TAU) / 11;
    b.castShadow = true;
    twGroup.add(b);
  }

  // ---- bearings: the reason this thing survives ---------------------------
  // Real clearances are 6-9 microns on a 10 mm shaft - invisible at any camera
  // this scene can hold. The films below are drawn about 40x over-scale, and
  // the copy says so.
  const internals = new THREE.Group();
  core.add(internals);

  const filmMat = new THREE.MeshPhysicalMaterial({
    color: 0xffb24a,
    emissive: new THREE.Color(0xff9a2e),
    emissiveIntensity: 0.5,
    metalness: 0,
    roughness: 0.3,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const RING_IN = 0.078;
  const RING_OUT = 0.1;
  const rings = [];
  for (const bx of [-0.36, 0.12]) {
    const ring = latheX(
      [
        [RING_IN, bx - 0.062],
        [RING_OUT, bx - 0.062],
        [RING_OUT, bx + 0.062],
        [RING_IN, bx + 0.062],
        [RING_IN, bx - 0.062],
      ],
      bronzeMat,
    );
    // three oil holes - and the reason the ring's own rotation reads at all
    for (let i = 0; i < 3; i++) {
      const a = (i * TAU) / 3;
      const hole = new THREE.Mesh(new THREE.CylinderGeometry(0.016, 0.016, 0.042, 10), darkMat);
      hole.position.set(bx, 0.089 * Math.cos(a), 0.089 * Math.sin(a));
      hole.rotation.x = a; // cylinders build along +Y; psi=a IS a rotation of a about X
      internals.add(hole);
      hole.userData.ringIndex = rings.length;
    }
    internals.add(ring);
    rings.push(ring);

    // The two films are deliberately different lengths: the inner one runs
    // PAST the ring's ends and the outer one stops short of them, so the
    // bronze is legible between them instead of being buried under amber.
    for (const [rIn, rOut, len] of [
      [JOURNAL_R, RING_IN, 0.155],
      [RING_OUT, BORE_R, 0.086],
    ]) {
      const film = new THREE.Mesh(
        new THREE.CylinderGeometry((rIn + rOut) / 2, (rIn + rOut) / 2, len, 30, 1, true),
        filmMat,
      );
      film.rotation.z = Math.PI / 2;
      film.position.x = bx;
      film.renderOrder = 4;
      internals.add(film);
    }
  }

  // the thrust bearing: a bronze washer the collar runs against
  internals.add(
    latheX(
      [
        [0.078, -0.678],
        [0.15, -0.678],
        [0.15, -0.664],
        [0.078, -0.664],
        [0.078, -0.678],
      ],
      bronzeMat,
    ),
  );
  const thrustFilm = new THREE.Mesh(new THREE.RingGeometry(0.079, 0.149, 30), filmMat);
  thrustFilm.rotation.y = Math.PI / 2;
  thrustFilm.position.x = -0.6605;
  thrustFilm.renderOrder = 4;
  internals.add(thrustFilm);

  // piston-ring seals at both ends of the bore
  for (const [sx, sr] of [
    [-0.706, 0.085],
    [0.318, 0.08],
  ]) {
    const seal = new THREE.Mesh(new THREE.TorusGeometry(sr, 0.011, 8, 26), darkMat);
    seal.rotation.y = Math.PI / 2;
    seal.position.x = sx;
    internals.add(seal);
  }

  // oil galleries drilled through the housing wall
  internals.add(
    tubeAlong(
      [
        [-0.28, 0.235, 0.09],
        [-0.3, 0.15, 0],
        [-0.33, 0.14, 0],
        [-0.36, 0.122, 0],
      ],
      0.022,
      darkMat,
      { tubularSegments: 24 },
    ),
    tubeAlong(
      [
        [-0.3, 0.15, 0],
        [-0.14, 0.17, 0],
        [0.02, 0.15, 0],
        [0.12, 0.122, 0],
      ],
      0.022,
      darkMat,
      { tubularSegments: 30 },
    ),
  );

  // water jacket: a cavity cast into the hot end of the centre housing
  const jacketMat = new THREE.MeshPhysicalMaterial({
    color: 0x63d8e8,
    emissive: new THREE.Color(0x2aa8bd),
    emissiveIntensity: 0.35,
    metalness: 0,
    roughness: 0.25,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    side: THREE.DoubleSide,
  });
  const jacket = latheX(
    [
      [0.158, -0.08],
      [0.19, -0.06],
      [0.19, 0.2],
      [0.158, 0.23],
      [0.158, -0.08],
    ],
    jacketMat,
  );
  jacket.castShadow = false;
  jacket.renderOrder = 4;
  internals.add(jacket);

  // heat shield: the dished plate that keeps 800 degrees off the bearings
  hotGroup.add(
    latheX(
      [
        [0.055, 0.64],
        [0.15, 0.648],
        [0.25, 0.664],
        [0.3, 0.684],
        [0.3, 0.694],
        [0.248, 0.674],
        [0.15, 0.658],
        [0.055, 0.65],
      ],
      shieldMat,
    ),
  );

  // ---- wastegate + actuator ------------------------------------------------
  const gCos = Math.cos(GATE_PSI);
  const gSin = Math.sin(GATE_PSI);
  const gRad = new THREE.Vector3(0, gCos, gSin); // outward at the gate clock
  const gTan = new THREE.Vector3(0, -gSin, gCos); // tangential there
  const PORT_R = 0.34;
  const PIVOT_R = 0.53;
  const portPos = new THREE.Vector3(1.0, PORT_R * gCos, PORT_R * gSin);

  // the bypass passage: takes gas from the scroll straight past the wheel
  shell(
    core,
    tubeAlong(
      [
        [0.775, 0.46 * gCos, 0.46 * gSin],
        [0.86, 0.44 * gCos, 0.44 * gSin],
        [0.95, 0.375 * gCos, 0.375 * gSin],
        [portPos.x, portPos.y, portPos.z],
      ],
      0.082,
      ironMat,
      { tubularSegments: 30, radialSegments: 18 },
    ),
    true,
  );
  const seat = aim(
    new THREE.Mesh(new THREE.TorusGeometry(0.088, 0.016, 10, 24), ironMat),
    new THREE.Vector3(1, 0, 0),
  );
  seat.position.copy(portPos);
  shell(core, seat, true);

  // pivot frame: local X is axial (the lift direction), Y radial, Z the shaft
  const gateMount = new THREE.Group();
  gateMount.position.set(1.0, PIVOT_R * gCos, PIVOT_R * gSin);
  gateMount.quaternion.setFromRotationMatrix(
    new THREE.Matrix4().makeBasis(new THREE.Vector3(1, 0, 0), gRad, gTan),
  );
  hotGroup.add(gateMount);
  const gateArm = new THREE.Group();
  gateMount.add(gateArm);
  const armLen = PIVOT_R - PORT_R;
  const armBar = beveledBox(0.036, armLen, 0.05, steelMat, 0.012);
  armBar.position.set(0.03, -armLen / 2, 0);
  gateArm.add(armBar);
  const flapper = new THREE.Mesh(new THREE.CylinderGeometry(0.092, 0.092, 0.028, 26), steelMat);
  flapper.rotation.z = Math.PI / 2;
  flapper.position.set(0.014, -armLen, 0);
  flapper.castShadow = true;
  gateArm.add(flapper);

  const gateShaft = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.024, 0.3, 14), steelMat);
  aim(gateShaft, gTan);
  gateShaft.position.copy(gateMount.position).addScaledVector(gTan, 0.09);
  hotGroup.add(gateShaft);
  const crankPos = gateMount.position.clone().addScaledVector(gTan, 0.19);
  const crank = beveledBox(0.05, 0.2, 0.032, steelMat, 0.012);
  crank.position.copy(crankPos).add(new THREE.Vector3(0, 0.1, 0));
  hotGroup.add(crank);

  // actuator can, bolted clear of both housings on a stamped bracket
  const canPos = new THREE.Vector3(-0.16, 0.88 * gCos, 0.88 * gSin);
  const canBody = new THREE.Mesh(
    new THREE.CylinderGeometry(0.135, 0.135, 0.115, 30),
    materials.polymer(0x2b2f35),
  );
  canBody.rotation.z = Math.PI / 2;
  canBody.position.copy(canPos);
  canBody.castShadow = true;
  const canRimA = new THREE.Mesh(new THREE.TorusGeometry(0.138, 0.016, 10, 30), boltMat);
  canRimA.rotation.y = Math.PI / 2;
  canRimA.position.copy(canPos).add(new THREE.Vector3(0.056, 0, 0));
  const canRimB = canRimA.clone();
  canRimB.position.copy(canPos).add(new THREE.Vector3(-0.056, 0, 0));
  const canNipple = new THREE.Mesh(new THREE.CylinderGeometry(0.022, 0.022, 0.1, 12), boltMat);
  canNipple.rotation.z = Math.PI / 2;
  canNipple.position.copy(canPos).add(new THREE.Vector3(-0.14, 0, 0));
  hardware.add(canBody, canRimA, canRimB, canNipple);

  const bracket = beveledBox(0.055, 0.34, 0.1, boltMat, 0.014);
  bracket.position.copy(canPos).add(new THREE.Vector3(-0.16, -0.19, -0.02));
  bracket.rotation.x = -0.24;
  bracket.rotation.z = 0.3;
  hardware.add(bracket);

  // the boost signal hose, running from the compressor scroll up to the can
  hardware.add(
    tubeAlong(
      [
        [-0.7, 0.55 * gCos, 0.55 * gSin],
        [-0.56, 0.68 * gCos, 0.7 * gSin],
        [-0.4, 0.82 * gCos, 0.84 * gSin],
        canPos.clone().add(new THREE.Vector3(-0.19, 0, 0)).toArray(),
      ],
      0.021,
      materials.rubber(0x24262b),
      { tubularSegments: 34 },
    ),
  );

  // actuator rod: the piece that actually moves
  const rodGroup = new THREE.Group();
  hardware.add(rodGroup);
  const rodStart = canPos.clone().add(new THREE.Vector3(0.09, 0, 0));
  // the crank lives in hotGroup, the rod in hardware - so the rod has to reach
  // the crank's WORLD station, not its authored one
  const rodEnd = crankPos.clone().add(new THREE.Vector3(HOT_SHIFT, 0.185, 0));
  const rod = new THREE.Mesh(
    new THREE.CylinderGeometry(0.021, 0.021, rodStart.distanceTo(rodEnd), 12),
    steelMat,
  );
  rod.position.copy(rodStart).lerp(rodEnd, 0.5);
  aim(rod, rodEnd.clone().sub(rodStart));
  rod.castShadow = true;
  rodGroup.add(rod);

  // ---- flow streams --------------------------------------------------------
  const flows = new THREE.Group();
  core.add(flows);

  // exhaust: inlet flange, around the scroll, in at the throat, through the
  // wheel, out the axial snout. The scroll leg rides tv.centre(), so the
  // arrows are guaranteed to run down the middle of the real passage.
  const exPts = [
    [TV_X, TV_RC0, -1.05],
    [TV_X, TV_RC0, -0.6],
    [TV_X, TV_RC0, -0.2],
  ];
  for (let i = 0; i <= 10; i++) {
    const c = tv.centre(0.02 + (0.72 * i) / 10);
    exPts.push([c.x, c.y, c.z]);
  }
  const exTailPsi = TV_PSI0 + SWEEP * 0.74 + 1.9;
  for (let i = 1; i <= 10; i++) {
    const u = i / 10;
    const psi = TV_PSI0 + SWEEP * 0.74 + u * 1.9;
    const r = 0.325 + (0.1 - 0.325) * Math.pow(u, 0.85);
    exPts.push([TV_X + 0.03 + u * 0.3, r * Math.cos(psi), r * Math.sin(psi)]);
  }
  for (const [x, r] of [
    [1.16, 0.105],
    [1.34, 0.11],
    [1.62, 0.115],
  ]) {
    exPts.push([x, r * Math.cos(exTailPsi), r * Math.sin(exTailPsi)]);
  }
  const exhaustStream = makeStream(
    new THREE.CatmullRomCurve3(exPts.map((p) => new THREE.Vector3(...p))),
    { count: 20, size: 0.095, color: 0xff5a2a },
  );
  hotGroup.add(exhaustStream.group);

  // intake: bell mouth, through the impeller, flung out to the scroll, round
  // to the discharge. The compressor scroll is walked in REVERSE, because
  // flow runs from the tongue toward the fat end.
  // The impeller leaves the air swirling the way the wheel turns (+psi), and
  // the scroll carries that swirl on to the discharge - so both legs run in
  // INCREASING psi. A streamline that swirled the other way would be a lie the
  // blade shapes would immediately give away.
  const inPts = [];
  const inPsi0 = CV_PSI0 - SWEEP * 0.86 - 1.9;
  for (const [x, r] of [
    [-1.95, 0.105],
    [-1.62, 0.12],
    [-1.34, 0.145],
    [-1.16, 0.165],
    [-1.06, 0.175],
  ]) {
    inPts.push([x, r * Math.cos(inPsi0), r * Math.sin(inPsi0)]);
  }
  for (let i = 1; i <= 10; i++) {
    const u = i / 10;
    const psi = inPsi0 + u * 1.9;
    const r = 0.175 + (0.4 - 0.175) * Math.pow(u, 1.25);
    inPts.push([-1.045 + u * 0.235, r * Math.cos(psi), r * Math.sin(psi)]);
  }
  for (let i = 0; i <= 11; i++) {
    const c = cv.centre(0.86 - (0.86 * i) / 11);
    inPts.push([c.x, c.y, c.z]);
  }
  for (const d of [0.18, 0.36, 0.55, 0.85]) {
    const p = cvFat.clone().addScaledVector(CV_OUT, d);
    inPts.push([p.x, p.y, p.z]);
  }
  const intakeStream = makeStream(
    new THREE.CatmullRomCurve3(inPts.map((p) => new THREE.Vector3(...p))),
    // fewer, smaller darts than the exhaust: the cold-side step is a macro on
    // the impeller, and fat arrows at that range bury the blades
    { count: 15, size: 0.072, color: 0x63c8ff },
  );
  flows.add(intakeStream.group);

  // bypass: the exhaust that never touches the wheel
  const bpPts = [];
  for (let i = 0; i <= 6; i++) {
    const c = tv.centre(0.02 + (0.1 * i) / 6);
    bpPts.push([c.x, c.y, c.z]);
  }
  for (const [x, r] of [
    [0.8, 0.46],
    [0.88, 0.43],
    [0.97, 0.37],
    [1.09, 0.3],
    [1.24, 0.2],
    [1.45, 0.14],
    [1.7, 0.12],
  ]) {
    bpPts.push([x, r * gCos, r * gSin]);
  }
  const bypassStream = makeStream(
    new THREE.CatmullRomCurve3(bpPts.map((p) => new THREE.Vector3(...p))),
    { count: 12, size: 0.085, color: 0xff7a3a },
  );
  hotGroup.add(bypassStream.group);

  // oil: in at the top boss, along the gallery, through both bearings, out the
  // drain. One circuit, so one phase wraps it.
  const oilStream = makeStream(
    new THREE.CatmullRomCurve3(
      [
        [-0.4, 0.46, 0.18],
        [-0.31, 0.24, 0.09],
        [-0.33, 0.115, 0],
        [-0.36, 0.115, 0],
        [-0.36, 0.0, 0.09],
        [-0.2, -0.1, 0.045],
        [-0.02, 0.13, -0.03],
        [0.12, 0.115, 0],
        [0.12, 0.0, -0.09],
        [0.0, -0.13, -0.03],
        [-0.06, -0.2, 0],
        [-0.06, -0.34, 0],
        [-0.06, -0.6, 0],
      ].map((p) => new THREE.Vector3(...p)),
    ),
    { count: 14, size: 0.06, color: 0xffae42 },
  );
  flows.add(oilStream.group);

  // ---- callouts ------------------------------------------------------------
  const labels = calloutSets(['anatomy', 'hot', 'shaft', 'cold', 'oil', 'heat', 'gate']);

  // Anchors sit ON the part they name - the hot side moved into hotGroup, so
  // its callouts are authored in that group's coordinates too.
  labels.add('anatomy', core, 'Compressor housing', [-1.05, 0.3, 0.28], 100, 80);
  labels.add('anatomy', core, 'Centre housing', [-0.05, -0.15, 0.15], -60, 96);
  labels.add('anatomy', hotGroup, 'Turbine housing', [0.86, 0.46, 0.34], 20, 90);
  labels.add('anatomy', hardware, 'Wastegate actuator', [-0.16, 0.8, 0.56], 55, 80);
  labels.add('anatomy', feedMount, 'Oil feed', [-0.24, 0.38, 0], 112, 62);

  labels.add('hot', hotGroup, 'Exhaust in - 820 C', [TV_X, 0.6, -0.44], 118, 92);
  labels.add('hot', hotGroup, 'The scroll narrows', [TV_X, -0.52, 0.3], -46, 108);
  labels.add('hot', twGroup, 'Turbine wheel', [0.8, 0.26, 0.16], 34, 86);

  labels.add('shaft', twGroup, 'Turbine end', [0.86, 0.26, 0.14], 40, 88);
  labels.add('shaft', rotor, 'Shaft - 10 mm', [-0.1, 0.07, 0.06], 74, 96);
  labels.add('shaft', rotor, 'Compressor end', [-0.92, 0.24, 0.16], 96, 90);
  labels.add('shaft', core, '200,000 rpm', [0.12, -0.3, 0.22], -52, 92);

  labels.add('cold', rotor, 'Inducer - air in', [-1.03, 0.16, 0.14], 108, 92);
  labels.add('cold', rotor, 'Exducer - flung out', [-0.82, 0.36, 0.1], 30, 96);
  labels.add('cold', rotor, 'Splitter blade', [-0.9, 0.2, 0.22], -40, 100);
  labels.add('cold', core, 'Diffuser and scroll', [CV_X, 0.5, 0.18], 62, 96);

  labels.add('oil', internals, 'Floating ring', [-0.36, 0.1, 0.06], 96, 92);
  labels.add('oil', internals, 'Oil film', [0.12, 0.115, 0.03], 44, 96);
  labels.add('oil', internals, 'Thrust bearing', [-0.66, -0.135, 0.07], -54, 96);
  labels.add('oil', feedMount, 'Oil in, at 4 bar', [-0.24, 0.38, 0], 122, 80);

  labels.add('heat', twGroup, 'Inconel - 950 C', [0.84, 0.28, 0.16], 36, 92);
  labels.add('heat', hotGroup, 'Heat shield', [0.66, 0.28, 0.1], 88, 90);
  labels.add('heat', internals, 'Water jacket', [0.06, 0.15, 0.06], 126, 86);
  labels.add('heat', rotor, 'Aluminium, 100 mm away', [-0.9, 0.3, 0.14], 108, 96);

  labels.add('gate', hardware, 'Actuator - boost-fed', [-0.16, 0.8, 0.56], 76, 88);
  labels.add('gate', hotGroup, 'Bypass passage', [0.88, 0.4 * gCos, 0.4 * gSin], 40, 92);
  labels.add('gate', gateArm, 'Flapper', [0.014, -armLen, 0], -34, 88);

  // ---- one state object, one pose function --------------------------------
  const state = {
    spin: 0,
    flow: 0,
    reveal: 0,
    hot: 0,
    exhaust: 0,
    intake: 0,
    oil: 0,
    cool: 0,
    gate: 0,
    ghost: 1, // ghost-shell strength: a macro step drops it so the context
    // housings stop stacking transparent layers over the subject
  };

  const cold = new THREE.Color(0x63c8ff);
  const packed = new THREE.Color(0xd6f0ff);
  const glowHot = new THREE.Color(0xff8a2e);
  const spent = new THREE.Color(0x9e4a30);
  const exRamp = (p, out) => {
    if (p < 0.55) out.set(0xff5a2a).lerp(glowHot, p / 0.55);
    else out.copy(glowHot).lerp(spent, (p - 0.55) / 0.45);
  };
  const inRamp = (p, out) => {
    if (p < 0.32) out.copy(cold);
    else out.copy(cold).lerp(packed, Math.min(1, (p - 0.32) / 0.4));
  };

  function apply() {
    rotor.rotation.x = state.spin;
    // fully floating rings turn the same way as the shaft, at about a third of
    // its speed - dragged round by their own inner oil film
    const ringAngle = state.spin / 3;
    for (const r of rings) r.rotation.x = ringAngle;
    for (const o of internals.children) {
      if (o.userData.ringIndex !== undefined) {
        const a = o.userData.baseAngle ?? (o.userData.baseAngle = Math.atan2(o.position.z, o.position.y));
        const ang = a + ringAngle;
        o.position.y = 0.089 * Math.cos(ang);
        o.position.z = 0.089 * Math.sin(ang);
        o.rotation.x = Math.PI / 2 - ang;
      }
    }

    const revealed = state.reveal >= 0.5;
    for (const m of shellSolid) m.visible = !revealed;
    for (const m of shellGhost) m.visible = revealed;
    ghostMat.opacity = 0.14 * state.reveal * state.ghost;
    ghostHotMat.opacity = 0.11 * state.reveal * state.ghost;
    ghostHotMat.emissiveIntensity = state.hot * 0.32;

    twMat.emissiveIntensity = state.hot * 0.5;
    ironMat.emissiveIntensity = state.hot * 0.13;

    filmMat.opacity = state.oil * 0.55;
    filmMat.emissiveIntensity = 0.3 + state.oil * 0.35;
    jacketMat.opacity = state.cool * 0.4;

    gateArm.rotation.z = state.gate * 0.8;
    rodGroup.position.x = -state.gate * 0.055;

    exhaustStream.set(state.flow, state.exhaust * 0.85, exRamp);
    intakeStream.set(state.flow, state.intake * 0.85, inRamp);
    bypassStream.set((state.flow * 2) % 1, state.gate * state.exhaust * 0.8, exRamp);
    oilStream.set((state.flow * 2) % 1, state.oil * 0.9);
  }
  apply();

  return {
    group,
    core,
    state,
    parts: { rotor, rings, gateArm, cwBody, twBody, twGroup, hotGroup, internals, hardware, flows },
    set(partial) {
      Object.assign(state, partial);
      apply();
    },
    setLabels: labels.setLabels,
  };
}
