import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { varyInstances } from './surface.js';

// Realism-grade procedural geometry. The single biggest "this is CG" tell is a
// mathematically sharp edge — everything here carries a bevel or a curve.

// Box with chamfered edges that catch highlights like machined metal.
export function beveledBox(w, h, d, material, bevel = 0.02) {
  const r = Math.min(bevel, w / 2, h / 2, d / 2);
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), material);
  mesh.castShadow = true;
  return mesh;
}

// Lathe-turned solid from a 2D profile: [[radius, y], ...] bottom → top.
// For housings, domes, bell covers, flanges.
export function lathe(profile, material, segments = 48) {
  const pts = profile.map(([r, y]) => new THREE.Vector2(r, y));
  const mesh = new THREE.Mesh(new THREE.LatheGeometry(pts, segments), material);
  mesh.castShadow = true;
  return mesh;
}

// Stack of thin cooling fins along +Y, origin at the bottom fin.
// shape 'round' (solid turned fins), 'square' (cast block fins) or 'ring'
// (open tori — use around a glass liner so the piston stays visible).
export function finStack(
  { count = 8, size = 0.5, thickness = 0.03, gap = 0.06, shape = 'round', taper = 0 },
  material,
) {
  const g = new THREE.Group();
  for (let i = 0; i < count; i++) {
    const s = size * (1 - taper * (i / Math.max(1, count - 1)));
    let fin;
    if (shape === 'ring') {
      fin = new THREE.Mesh(new THREE.TorusGeometry(s, thickness, 8, 48), material);
      fin.rotation.x = Math.PI / 2; // torus lies flat, axis along Y
    } else if (shape === 'round') {
      fin = new THREE.Mesh(new THREE.CylinderGeometry(s, s, thickness, 36), material);
    } else {
      fin = new THREE.Mesh(
        new RoundedBoxGeometry(s * 2, thickness, s * 2, 1, thickness / 3),
        material,
      );
    }
    fin.castShadow = true;
    fin.position.y = i * (thickness + gap);
    g.add(fin);
  }
  return g;
}

// Smooth pipe following a series of points, corners auto-filleted by the
// spline. Real plumbing bends — no more right-angle rod joints.
export function tubeAlong(points, radius, material, opts = {}) {
  const { tubularSegments = 80, radialSegments = 16, closed = false, tension = 0.5 } = opts;
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    closed,
    'catmullrom',
    tension,
  );
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, tubularSegments, radius, radialSegments, closed),
    material,
  );
  mesh.castShadow = true;
  mesh.userData.curve = curve; // callers can ride particles along it
  return mesh;
}

// Cambered, twisted airfoil plate: span along +Y (root at origin), chord
// along X, camber bulging toward +Z. Twist rotates each spanwise station
// about the span axis, so the tip sits flatter than the root — like every
// real fan/compressor blade.
function airfoilGeometry({ span, chordRoot, chordTip, camber, twistRoot, twistTip }) {
  const spanSteps = 6;
  const chordSteps = 8;
  const pos = [];
  const uvs = [];
  const idx = [];
  for (let si = 0; si <= spanSteps; si++) {
    const s = si / spanSteps;
    const ch = chordRoot + (chordTip - chordRoot) * s;
    const tw = twistRoot + (twistTip - twistRoot) * s;
    const cosT = Math.cos(tw);
    const sinT = Math.sin(tw);
    for (let ci = 0; ci <= chordSteps; ci++) {
      const c = ci / chordSteps;
      const x0 = (c - 0.5) * ch;
      const z0 = camber * ch * Math.sin(Math.PI * c);
      pos.push(x0 * cosT - z0 * sinT, s * span, x0 * sinT + z0 * cosT);
      uvs.push(c, s); // without UVs, rough/normal maps sample one texel — mirror blades
    }
  }
  const row = chordSteps + 1;
  for (let si = 0; si < spanSteps; si++) {
    for (let ci = 0; ci < chordSteps; ci++) {
      const a = si * row + ci;
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  return geo;
}

// Ring of N airfoil blades around a hub — THE jet-engine primitive. One
// InstancedMesh regardless of blade count, so a 40-blade compressor stage
// costs a single draw call. Ring lies in the XY plane, axis +Z (rotate the
// returned group to aim it). Returns { group, instances }.
export function bladeRing(
  {
    blades = 24,
    hubR = 0.2,
    span = 0.4,
    chord = 0.14,
    chordTip,
    camber = 0.08,
    twist = 0.8, // radians at the root…
    twistTip = 0.35, // …flattening toward the tip
    hubDepth = 0, // >0 adds a visible hub cylinder
    hubMaterial,
  },
  material,
) {
  const group = new THREE.Group();
  const geo = airfoilGeometry({
    span,
    chordRoot: chord,
    chordTip: chordTip ?? chord * 0.8,
    camber,
    twistRoot: twist,
    twistTip,
  });
  material.side = THREE.DoubleSide; // thin plate, both faces visible
  const inst = new THREE.InstancedMesh(geo, material, blades);
  inst.castShadow = true;
  const m = new THREE.Matrix4();
  const rot = new THREE.Matrix4();
  for (let i = 0; i < blades; i++) {
    rot.makeRotationZ((i * 2 * Math.PI) / blades);
    m.makeTranslation(0, hubR, 0);
    m.premultiply(rot);
    inst.setMatrixAt(i, m);
  }
  inst.instanceMatrix.needsUpdate = true;
  // Decorrelate the blades: a per-instance roughness/tint jitter so a 24-blade
  // ring doesn't read as one blade stamped 24 times. No-op when the material
  // carries no maps (nothing to break up) — cheap either way.
  if (material.map || material.roughnessMap || material.normalMap) varyInstances(inst);
  group.add(inst);
  if (hubDepth > 0) {
    const hub = new THREE.Mesh(
      new THREE.CylinderGeometry(hubR + 0.01, hubR + 0.01, hubDepth, 32).rotateX(Math.PI / 2),
      hubMaterial ?? material,
    );
    hub.castShadow = true;
    group.add(hub);
  }
  return { group, instances: inst };
}

// Parametric spur gear, lying in the XY plane with its axis along +Z (a watch
// movement viewed face-on). Teeth are trapezoids — at explainer scale they
// read as clockwork without true involute math.
//
// Meshing two gears: space centers by pitchR_A + pitchR_B (stored in
// mesh.userData.pitchR) and drive rotations at ratio −teethA/teethB.
//
// holeR punches an arbor hole; cutouts drills a ring of round openings, the
// classic lightened watch-wheel look.
export function gear(
  { teeth = 12, radius = 0.5, thickness = 0.06, toothDepth, holeR = 0, cutouts = 0 },
  material,
) {
  const tipR = radius;
  const depth = toothDepth ?? Math.min(0.18 * radius, ((2 * Math.PI * radius) / teeth) * 0.45);
  const rootR = tipR - depth;
  const step = (Math.PI * 2) / teeth;
  const halfTip = step * 0.12;
  const halfRoot = step * 0.26;

  const shape = new THREE.Shape();
  for (let i = 0; i < teeth; i++) {
    const c = i * step;
    // root-lead → tip-lead → tip-trail → root-trail → root-arc midpoint
    const pts = [
      [rootR, c - halfRoot],
      [tipR, c - halfTip],
      [tipR, c + halfTip],
      [rootR, c + halfRoot],
      [rootR, c + step / 2],
    ];
    pts.forEach(([r, a], k) => {
      const x = Math.cos(a) * r;
      const y = Math.sin(a) * r;
      if (i === 0 && k === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    });
  }
  shape.closePath();

  if (holeR > 0) {
    const hole = new THREE.Path();
    hole.absarc(0, 0, holeR, 0, Math.PI * 2, true);
    shape.holes.push(hole);
  }
  if (cutouts > 0) {
    const inner = Math.max(holeR, radius * 0.12);
    const ringR = inner + (rootR - inner) * 0.52;
    const rc = Math.min((rootR - inner) * 0.3, ringR * Math.sin(Math.PI / cutouts) * 0.72);
    for (let i = 0; i < cutouts; i++) {
      const a = (i * 2 * Math.PI) / cutouts;
      const c = new THREE.Path();
      c.absarc(Math.cos(a) * ringR, Math.sin(a) * ringR, rc, 0, Math.PI * 2, true);
      shape.holes.push(c);
    }
  }

  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: true,
    bevelThickness: thickness * 0.15,
    bevelSize: Math.min(0.01, thickness * 0.15),
    bevelSegments: 1,
    curveSegments: 10,
  });
  geo.translate(0, 0, -thickness / 2);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.userData.teeth = teeth;
  mesh.userData.pitchR = rootR + depth / 2;
  return mesh;
}

// Chain several point-lists into one continuous path with a single 0–1
// parameter, arc-length mapped. Returns the per-segment boundary fractions —
// exactly what a fluid loop needs to know where the condenser ends and the
// capillary begins. Render each segment as its own tube (radii/materials can
// differ); drive packets along the whole chain with getPointAt/getTangentAt.
export function chainPath(segments, { tension = 0.25 } = {}) {
  const curves = segments.map((pts) => {
    const v = pts.map((p) => new THREE.Vector3(...p));
    return pts.length === 2
      ? new THREE.LineCurve3(v[0], v[1])
      : new THREE.CatmullRomCurve3(v, false, 'catmullrom', tension);
  });
  const lengths = curves.map((c) => c.getLength());
  const total = lengths.reduce((a, b) => a + b, 0);
  const bounds = [];
  let acc = 0;
  for (const L of lengths) {
    acc += L;
    bounds.push(acc / total);
  }
  function locate(t) {
    t = ((t % 1) + 1) % 1;
    let i = 0;
    while (i < bounds.length - 1 && t > bounds[i]) i++;
    const t0 = i === 0 ? 0 : bounds[i - 1];
    const lt = (t - t0) / (bounds[i] - t0 || 1);
    return [i, Math.min(1, Math.max(0, lt))];
  }
  return {
    curves,
    bounds, // bounds[i] = fraction where segment i ends
    getPointAt(t) {
      const [i, lt] = locate(t);
      return curves[i].getPointAt(lt);
    },
    getTangentAt(t) {
      const [i, lt] = locate(t);
      return curves[i].getTangentAt(lt);
    },
  };
}

// A ribbon strip that morphs between "wound into a spiral" (base pose) and
// "laid flat/straight" (morph target 1). For anything real-world wound vs.
// straight — a rolled capacitor foil, an inductor/transformer winding peeled
// straight to show its true length. Spiral winds around the local Y axis
// (the roll axis); ribbon "width" runs along Y in both poses, "length" runs
// around the spiral / along +X when flat. Drive with
// `mesh.morphTargetInfluences[0] = t` (0 = wound, 1 = fully flat).
export function windableRibbon(
  {
    length = 5,
    width = 0.3,
    turns = 3,
    radiusStart = 0.16,
    pitch = 0.11,
    lengthSegments = 120,
    widthSegments = 1,
  },
  material,
) {
  const wSeg = widthSegments;
  const lSeg = lengthSegments;
  const woundPos = [];
  const flatPos = [];
  const uvs = [];
  for (let li = 0; li <= lSeg; li++) {
    const u = li / lSeg;
    const angle = u * turns * Math.PI * 2;
    const r = radiusStart + pitch * (angle / (Math.PI * 2));
    const wx = Math.cos(angle) * r;
    const wz = Math.sin(angle) * r;
    const flatX = (u - 0.5) * length;
    for (let wi = 0; wi <= wSeg; wi++) {
      const v = wi / wSeg;
      const y = (v - 0.5) * width;
      woundPos.push(wx, y, wz);
      flatPos.push(flatX, y, 0);
      uvs.push(u, v);
    }
  }
  const row = wSeg + 1;
  const idx = [];
  for (let li = 0; li < lSeg; li++) {
    for (let wi = 0; wi < wSeg; wi++) {
      const a = li * row + wi;
      idx.push(a, a + 1, a + row, a + 1, a + row + 1, a + row);
    }
  }
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(woundPos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();

  // Morph target: same topology, flat-pose positions + their own normals so
  // lighting stays correct partway through the unroll, not just at the ends.
  const flatGeo = new THREE.BufferGeometry();
  flatGeo.setAttribute('position', new THREE.Float32BufferAttribute(flatPos, 3));
  flatGeo.setIndex(idx);
  flatGeo.computeVertexNormals();
  const flatPosAttr = new THREE.Float32BufferAttribute(flatPos, 3);
  flatPosAttr.name = 'flat';
  geo.morphAttributes.position = [flatPosAttr];
  geo.morphAttributes.normal = [flatGeo.getAttribute('normal')];

  material.side = THREE.DoubleSide;
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  mesh.updateMorphTargets();
  mesh.morphTargetInfluences[0] = 0; // start fully wound
  return mesh;
}

// Loft of same-point-count horizontal rings ("levels" = [{y, points:[[x,z],
// ...]}]) into one smooth watertight solid, y increasing +Y. A ring's point
// list need not trace a FULL loop: if it only sweeps part of a circle (e.g.
// a semicircle for a D-shaped cross-section), the implicit closing edge (last
// point -> first point, wrapping via modulo) becomes a genuine FLAT FACE —
// exactly a TO-92 transistor package's flat front on an otherwise round body.
// Shrinking a ring's radius toward ~0 pinches the loft to a point, a free
// rounded dome cap with no separate mesh (see transistor/model.js for both).
export function radialLoft(levels, material, opts = {}) {
  const { capBottom = true, capTop = false } = opts;
  const n = levels[0].points.length;
  const pos = [];
  const uvs = [];
  const idx = [];
  levels.forEach((lvl, li) => {
    lvl.points.forEach(([x, z], pi) => {
      pos.push(x, lvl.y, z);
      uvs.push(pi / (n - 1), li / (levels.length - 1));
    });
  });
  for (let li = 0; li < levels.length - 1; li++) {
    for (let pi = 0; pi < n; pi++) {
      const piN = (pi + 1) % n;
      const a = li * n + pi;
      const b = li * n + piN;
      const c = (li + 1) * n + pi;
      const d = (li + 1) * n + piN;
      idx.push(a, c, b, b, c, d);
    }
  }
  function cap(li, flip) {
    const lvl = levels[li];
    let cx = 0;
    let cz = 0;
    for (const [x, z] of lvl.points) {
      cx += x;
      cz += z;
    }
    cx /= n;
    cz /= n;
    const centerIdx = pos.length / 3;
    pos.push(cx, lvl.y, cz);
    uvs.push(0.5, 0.5);
    for (let pi = 0; pi < n; pi++) {
      const piN = (pi + 1) % n;
      const a = li * n + pi;
      const b = li * n + piN;
      if (flip) idx.push(centerIdx, a, b);
      else idx.push(centerIdx, b, a);
    }
  }
  if (capBottom) cap(0, true);
  if (capTop) cap(levels.length - 1, false);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
  geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
  geo.setIndex(idx);
  geo.computeVertexNormals();
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

// Wound-wire coil: a tube following a helical path, generic enough for a
// straight-axis solenoid (inductor bobbin, voice coil, transformer primary)
// OR a toroid winding (donut-core inductor/transformer — wire looping
// through the hole while advancing around the ring). Axis convention matches
// the rest of the toolkit's Y-up parts: solenoid axis is +Y; toroid "hole"
// axis is also +Y (rotate a THREE.TorusGeometry core by `rotation.x =
// Math.PI/2` to match).
//
// Returns { mesh, curve, points } — `points` is the raw [x,y,z] sample list
// (feed it straight to chainSegments()-style helpers or a lead-wire tube),
// `curve` is the CatmullRomCurve3 used to build the tube (has getPointAt /
// getTangentAt for riding a chargeQueue/flow-dot stream along the wire), and
// `mesh.userData.curve` mirrors it for the tubeAlong() calling convention.
//
// toroidal:false (default) → solenoid: `turns` loops of `radius`, stacked
//   along +Y over `length`, i.e. a standard wound bobbin.
// toroidal:true → `radius` becomes the wire loop's MINOR radius (how far the
//   winding sits out from the core's center-line) and `majorRadius` is the
//   donut's big radius. The path sweeps the minor angle `turns` times while
//   the major angle sweeps exactly one full turn — the same construction as
//   a real toroidal choke: N evenly-spaced loops threading the hole, wire
//   ends exposed near the same azimuth (NOT a closed loop — leave
//   `closed:false`, the default, so both ends are real exposed leads).
export function coil(
  {
    turns = 8,
    radius = 0.15,
    length = 1,
    wireRadius = 0.02,
    segmentsPerTurn = 24,
    toroidal = false,
    majorRadius = 0.6,
    majorSpan = Math.PI * 2,
    phase = 0,
    closed = false,
  },
  material,
) {
  const totalSegs = Math.max(8, Math.round(turns * segmentsPerTurn));
  const points = [];
  for (let i = 0; i <= totalSegs; i++) {
    const u = i / totalSegs;
    if (toroidal) {
      const majorAngle = u * majorSpan + phase;
      const minorAngle = u * turns * Math.PI * 2;
      const rr = majorRadius + radius * Math.cos(minorAngle);
      points.push([
        Math.cos(majorAngle) * rr,
        radius * Math.sin(minorAngle),
        Math.sin(majorAngle) * rr,
      ]);
    } else {
      const angle = u * turns * Math.PI * 2 + phase;
      points.push([Math.cos(angle) * radius, -length / 2 + u * length, Math.sin(angle) * radius]);
    }
  }
  const curve = new THREE.CatmullRomCurve3(
    points.map((p) => new THREE.Vector3(...p)),
    closed,
    'catmullrom',
    0.4,
  );
  const mesh = new THREE.Mesh(
    new THREE.TubeGeometry(curve, totalSegs, wireRadius, 8, closed),
    material,
  );
  mesh.castShadow = true;
  mesh.userData.curve = curve;
  return { mesh, curve, points };
}

// Ring of hex bolt heads in the local XZ plane (a flange seen from +Y).
export function boltCircle(count, circleR, boltR, material, boltH = 0.03) {
  const g = new THREE.Group();
  const geo = new THREE.CylinderGeometry(boltR, boltR, boltH, 6);
  for (let i = 0; i < count; i++) {
    const a = (i * 2 * Math.PI) / count;
    const bolt = new THREE.Mesh(geo, material);
    bolt.castShadow = true;
    bolt.position.set(Math.cos(a) * circleR, 0, Math.sin(a) * circleR);
    bolt.rotation.y = a; // hex flats vary around the ring
    g.add(bolt);
  }
  return g;
}
