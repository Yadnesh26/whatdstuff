import * as THREE from 'three';
import { calloutSets } from '../../framework/callouts.js';
import { clamp01, smooth, profileTable, TAU } from '../../framework/motion.js';

// "How a cyclone works" — the second subject in this library with no parts to
// machine (after the black hole), and the only one that assembles ITSELF. A
// mature tropical cyclone is a textbook Carnot heat engine: it draws heat from
// a 26.5 C ocean at the bottom, dumps it against a -70 C tropopause at the
// top, and pays out the difference as wind. So the model is not a shell full
// of mechanism — it IS the mechanism, and everything here exists to make one
// closed thermodynamic circuit visible.
//
// Reference facts (NOAA JetStream "Tropical Cyclone Structure"; Stull,
// Practical Meteorology ch.16; Wikipedia "Eye (cyclone)"; Emanuel 1986 and
// the Carnot-engine literature; NOAA AOML Hurricane FAQ):
//  - Fuel: sea surface at or above 26.5 C down to ~50-60 m. Evaporation loads
//    the boundary layer with vapour; condensation aloft releases the latent
//    heat. ~6e14 W released, ~200x US electrical generating capacity.
//  - Efficiency: (T_sea - T_tropopause)/T_sea puts the Carnot ceiling near
//    30%; real storms convert roughly a tenth of the heat into wind.
//  - Spin: needs >= ~5 deg of latitude for usable Coriolis. Inflow is
//    deflected right in the north, so it orbits the low instead of filling
//    it. Counterclockwise north, clockwise south. This model is northern:
//    positive rotation about +Y is counterclockwise seen from above.
//  - Size: 800-1500 km across, ~15 km deep — 10 to 20 times wider than deep.
//    Eye 30-65 km at sea level, flaring UPWARD (the stadium effect: eyewall
//    air climbs surfaces of constant angular momentum, which slope out).
//    Eyewall tops 15-18 km, into the lower stratosphere. Inflow layer only
//    ~1 km deep. Outflow turns anticyclonic and spreads 75-150 km.
//  - Eye: subsiding, nearly cloud-free, warm-core, central pressure up to 15%
//    below its surroundings. Record 870 hPa, Typhoon Tip, 1979 (1013 is
//    standard). Category 5 begins at 252 km/h sustained.
//  - Death: landfall cuts the engine off from the water it burns and adds
//    surface friction. It begins unwinding within hours.
//
// SCALE, AND THE ONE DISCLOSED CHEAT
// Horizontal: 1 unit = 155 km, so the storm radius of 2.6 units is ~800 km
// across. Vertical is EXAGGERATED 11x — the tropopause sits at y = 1.05 where
// honest scale would put it at 0.097. A real hurricane is a pancake (53:1)
// and renders as a sheet of paper; at 11x it reads as 5:1 and the vertical
// circulation is legible. Step 5's hint says so out loud rather than hiding it.
// Every constant below derives from this one scale.

const R_OUT = 2.6; // storm radius, ~800 km across
const R_EYE = 0.34; // eye radius at sea level, ~53 km across
const R_EYE_TOP = 0.5; // eye radius at the tropopause — the stadium flare
const Y_TOP = 1.05; // tropopause / storm top (15 km at 11x — see the header)
const R_CDO = 1.15; // outer edge of the central dense overcast
const SPIRAL_ALPHA = (18 * Math.PI) / 180; // rainband crossing angle
const ARMS = 5;

// Turns per lap, per shell. Integers so one lap of any step timeline returns
// the whole storm to an identical pose (the seamless-loop contract), and
// unequal so the differential rotation of a real vortex is visible: the core
// laps the rainbands, and the outflow canopy runs BACKWARDS.
const TURNS_CORE = 2;
const TURNS_BANDS = 1;
const TURNS_CIRRUS = -1;

// --- procedural maps ---------------------------------------------------------

function seaNormalMap() {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d');
  const img = ctx.createImageData(N, N);
  // two crossed swell trains plus fine chop — a plausible open-ocean surface
  for (let y = 0; y < N; y++) {
    for (let x = 0; x < N; x++) {
      const u = (x / N) * TAU;
      const v = (y / N) * TAU;
      const h =
        Math.sin(u * 3 + v) * 0.5 +
        Math.sin(u - v * 4) * 0.35 +
        Math.sin(u * 11 + v * 7) * 0.12;
      const hx =
        Math.cos(u * 3 + v) * 3 * 0.5 +
        Math.cos(u - v * 4) * 0.35 +
        Math.cos(u * 11 + v * 7) * 11 * 0.12;
      const hy =
        Math.cos(u * 3 + v) * 0.5 -
        Math.cos(u - v * 4) * 4 * 0.35 +
        Math.cos(u * 11 + v * 7) * 7 * 0.12;
      const i = (y * N + x) * 4;
      img.data[i] = 128 + hx * 12;
      img.data[i + 1] = 128 + hy * 12;
      img.data[i + 2] = 235 + h * 4;
      img.data[i + 3] = 255;
    }
  }
  ctx.putImageData(img, 0, 0);
  const tex = new THREE.CanvasTexture(c);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  // 26 tiles moiréd badly at the satellite elevation — the sea read as a
  // stripe pattern rather than water. Nine is coarse enough to survive it.
  tex.repeat.set(9, 9);
  return tex;
}

function radialFadeMap(inner = 0, hardness = 0.55) {
  const N = 256;
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const ctx = c.getContext('2d');
  const g = ctx.createRadialGradient(N / 2, N / 2, (N / 2) * inner, N / 2, N / 2, N / 2);
  g.addColorStop(0, 'rgba(255,255,255,1)');
  g.addColorStop(hardness, 'rgba(255,255,255,0.55)');
  g.addColorStop(1, 'rgba(255,255,255,0)');
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, N, N);
  return new THREE.CanvasTexture(c);
}

function skyGradientMap() {
  const c = document.createElement('canvas');
  c.width = 4;
  c.height = 256;
  const ctx = c.getContext('2d');
  const g = ctx.createLinearGradient(0, 0, 0, 256);
  g.addColorStop(0.0, '#04070f'); // zenith — thin air, near space
  g.addColorStop(0.42, '#0a1524');
  g.addColorStop(0.72, '#132840');
  g.addColorStop(1.0, '#1d3a55'); // horizon haze, matched to the ocean rim
  ctx.fillStyle = g;
  ctx.fillRect(0, 0, 4, 256);
  return new THREE.CanvasTexture(c);
}

// --- geometry of the vortex --------------------------------------------------

// The eye's inner boundary at height y. Linear flare = the stadium effect.
const eyeR = (y) => R_EYE + (R_EYE_TOP - R_EYE) * clamp01(y / Y_TOP);

// Cloud-top height of the central overcast at radius r: the eyewall punches to
// the tropopause, and the deck slumps away from it.
function coreTop(r) {
  const t = clamp01((r - 0.52) / (R_CDO - 0.52));
  return Y_TOP * (1 - smooth(t) * 0.62);
}

// Logarithmic spiral: theta advances with ln(r), crossing every radius at a
// constant angle. Real rainbands do this at roughly 10-20 degrees.
const spiralTheta = (r, r0) => Math.log(r / r0) / Math.tan(SPIRAL_ALPHA);

export function buildCyclone({ scene }) {
  const group = new THREE.Group();
  scene.add(group);

  // deterministic — the same storm every reload, so review screenshots and the
  // verify gates compare like with like
  const rand = (() => {
    let s = 0x1a2b3c4d;
    return () => {
      s ^= s << 13;
      s ^= s >>> 17;
      s ^= s << 5;
      return ((s >>> 0) % 100000) / 100000;
    };
  })();

  // --- sky ------------------------------------------------------------------
  // stageOptions.space drops the studio backdrop and the shadow floor (a dark
  // smudge under a hurricane would read as a rendering bug, not as staging),
  // so this scene paints its own sky corner to corner.
  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(60, 32, 24),
    new THREE.MeshBasicMaterial({
      map: skyGradientMap(),
      side: THREE.BackSide,
      depthWrite: false,
      fog: false,
    }),
  );
  sky.renderOrder = -20;
  sky.frustumCulled = false;
  sky.userData.noOcclude = true; // backdrop, never a reason to dim a label
  group.add(sky);

  // --- ocean ----------------------------------------------------------------
  const seaGeo = new THREE.CircleGeometry(34, 160, 0, TAU);
  seaGeo.rotateX(-Math.PI / 2);
  // bake a shift toward the horizon haze at the rim so the disc dissolves into
  // the sky instead of ending in a hard circle
  const seaPos = seaGeo.attributes.position;
  const seaCol = [];
  const nearC = new THREE.Color(0x0d2c42);
  const farC = new THREE.Color(0x152c3f);
  for (let i = 0; i < seaPos.count; i++) {
    const d = Math.hypot(seaPos.getX(i), seaPos.getZ(i));
    seaCol.push(...nearC.clone().lerp(farC, smooth((d - 6) / 26)).toArray());
  }
  seaGeo.setAttribute('color', new THREE.Float32BufferAttribute(seaCol, 3));
  // Lambert, not Standard. The sea is in every single frame and at the low
  // camera angles it covers most of it; a full PBR shader over that much of
  // the screen was enough on its own to starve the frame. Nothing here needs
  // metalness or roughness response — it is a dark gradient with a swell.
  const sea = new THREE.Mesh(
    seaGeo,
    new THREE.MeshLambertMaterial({
      vertexColors: true,
      normalMap: seaNormalMap(),
      normalScale: new THREE.Vector2(0.3, 0.3),
    }),
  );
  sea.userData.noOcclude = true; // no callout ever hides behind the sea
  group.add(sea);

  // warm-water patch: the fuel tank, additive over the dark sea
  const warmGeo = new THREE.CircleGeometry(3.8, 72);
  warmGeo.rotateX(-Math.PI / 2);
  const warmPatch = new THREE.Mesh(
    warmGeo,
    new THREE.MeshBasicMaterial({
      color: 0x1f7d82,
      alphaMap: radialFadeMap(0.08, 0.35),
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  warmPatch.position.y = 0.004;
  group.add(warmPatch);

  // storm surge: the dome of water the low pressure and the wind pile up under
  // the eye. A real surge is centimetres deep on this scale; drawn at 0.05 so
  // it exists at all.
  const surgeProfile = [];
  for (let i = 0; i <= 24; i++) {
    const u = i / 24;
    surgeProfile.push(new THREE.Vector2(u * 3.4, 0.09 * (1 - smooth(u))));
  }
  const surge = new THREE.Mesh(
    new THREE.LatheGeometry(surgeProfile, 96),
    new THREE.MeshStandardMaterial({
      color: 0x3f86ad,
      roughness: 0.24,
      metalness: 0.12,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  surge.position.y = 0.005;
  group.add(surge);

  // --- land (landfall step only) --------------------------------------------
  const landShape = new THREE.Shape();
  landShape.moveTo(9, -9);
  landShape.lineTo(9, 9);
  const coastPts = [];
  for (let i = 0; i <= 40; i++) {
    const z = 9 - (i / 40) * 18;
    const x =
      1.9 + Math.sin(z * 0.7) * 0.28 + Math.sin(z * 1.9 + 1.2) * 0.14 + Math.sin(z * 4.3) * 0.06;
    coastPts.push(new THREE.Vector3(x, 0.055, z));
    landShape.lineTo(x, z);
  }
  landShape.lineTo(9, -9);
  const landGeo = new THREE.ExtrudeGeometry(landShape, { depth: 0.05, bevelEnabled: false });
  landGeo.rotateX(Math.PI / 2);
  const land = new THREE.Mesh(
    landGeo,
    new THREE.MeshStandardMaterial({
      color: 0x38402f,
      roughness: 0.95,
      metalness: 0,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  land.position.y = 0.05;
  group.add(land);

  // surf line where the surge meets the coast
  const foam = new THREE.Mesh(
    new THREE.TubeGeometry(new THREE.CatmullRomCurve3(coastPts), 220, 0.035, 8, false),
    new THREE.MeshBasicMaterial({
      color: 0x7e94a3,
      transparent: true,
      opacity: 0,
      depthWrite: false,
    }),
  );
  group.add(foam);

  // --- cloud shells ---------------------------------------------------------
  // Three instanced shells, each turning a different WHOLE number of turns per
  // lap. They carry the SATELLITE view only; the cutaway steps switch to the
  // built cross-section further down instead of slicing these.
  // Detail 1, not 2: cloud is drawn by MASS, not by any one puff's silhouette,
  // and 80 faces is the floor at which an overlapping pile still reads as
  // round. Detail 0 was tried and renders as crushed ice.
  const puffGeo = new THREE.IcosahedronGeometry(1, 1);
  // `deck` ghosts both cloud materials for the two diagram steps, so the
  // low-level flow paths read against the storm instead of under it. Depth
  // WRITE has to follow the fade (checklist: a material that can fade must not
  // keep punching holes in what is behind it) — at full strength it writes and
  // behaves exactly like an opaque deck.
  // Strictly OPAQUE. A thousand big overlapping spheres on a transparent
  // material means no early-z at all — every hidden fragment still runs the
  // full shader — and that overdraw was the single most expensive thing in
  // this scene. The diagram steps thin the storm by drawing FEWER instances
  // (see `deck` in apply) rather than by fading it, which costs nothing and
  // reads better anyway: gaps you can see the flow through, not a grey veil.
  const cloudMat = new THREE.MeshStandardMaterial({
    color: 0xffffff, // instance colours carry the shading — see SHADE_* below
    roughness: 1,
    metalness: 0,
  });
  const cirrusMat = new THREE.MeshStandardMaterial({
    color: 0xb9c3d1,
    roughness: 1,
    metalness: 0,
    transparent: true,
    opacity: 0.5,
    depthWrite: false,
  });

  // A cloud is not one grey. Sunlit tops against shadowed bases is most of
  // what makes a mass of spheres read as weather rather than gravel, and a
  // per-instance colour is the cheapest possible way to get it — one buffer,
  // no extra draw calls, no lights.
  const SHADE_BASE = new THREE.Color(0x59637a);
  const SHADE_TOP = new THREE.Color(0xd6dde6);
  const _shade = new THREE.Color();

  // A shell is a flat list of {r, th, y, sx, sy, rot}. Nothing about a puff
  // changes at runtime except its azimuth and whether it is culled.
  const dummy = new THREE.Object3D();

  function makeShell(count, material, fill) {
    const items = [];
    for (let i = 0; i < count; i++) items.push(fill(i));
    const mesh = new THREE.InstancedMesh(puffGeo, material, items.length);
    mesh.frustumCulled = false;
    // Cloud is not housing. The runtime label-occlusion pass raycasts every
    // occluder mesh per callout per frame, and an InstancedMesh answers that
    // by testing all ~1000 instances — three shells of them would cost more
    // than the whole render. It is also wrong on the merits: a callout on the
    // eyewall should not dim because one puff drifted in front of it.
    mesh.userData.noOcclude = true;
    for (let i = 0; i < items.length; i++) {
      mesh.setColorAt(i, _shade.copy(SHADE_BASE).lerp(SHADE_TOP, clamp01(items[i].shade ?? 1)));
    }
    mesh.instanceColor.needsUpdate = true;
    // Written ONCE. Spin is a rotation of the whole mesh from here on, so the
    // instance buffer is never re-uploaded at runtime.
    for (let i = 0; i < items.length; i++) {
      const it = items[i];
      dummy.position.set(it.r * Math.cos(it.th), it.y, it.r * Math.sin(it.th));
      dummy.rotation.set(it.rot, it.th, it.rot * 0.5);
      dummy.scale.set(it.sx, it.sy, it.sx);
      dummy.updateMatrix();
      mesh.setMatrixAt(i, dummy.matrix);
    }
    mesh.instanceMatrix.needsUpdate = true;
    return { mesh, items };
  }

  // central dense overcast + eyewall: dense, tall, with a bowl-shaped hole in
  // the middle whose walls lean OUT with height
  // Height is biased toward each column's top (pow < 1): a cloud deck is a
  // SURFACE you look at from above, not a haze filling a volume. Spread evenly
  // and the satellite view saw straight through to the sea.
  const core = makeShell(850, cloudMat, () => {
    // bias radius toward the eyewall — that is where the cloud actually is
    const r = R_EYE + (R_CDO - R_EYE) * Math.pow(rand(), 1.9);
    const top = coreTop(r);
    const rel = Math.pow(rand(), 0.45);
    const y = 0.03 + rel * Math.max(0.02, top - 0.03);
    let rr = r;
    if (rr < eyeR(y) + 0.02) rr = eyeR(y) + 0.02 + rand() * 0.06;
    const s = 0.115 + rand() * 0.1 + (y / Y_TOP) * 0.055; // the anvil spreads on top
    return {
      r: rr,
      th: rand() * TAU,
      y,
      sx: s,
      sy: s * (0.5 + rand() * 0.25),
      rot: rand() * TAU,
      shade: 0.18 + rel * 0.82,
    };
  });
  group.add(core.mesh);

  // spiral rainbands: five logarithmic arms, deliberately broken
  const bands = makeShell(750, cloudMat, (i) => {
    const arm = i % ARMS;
    const u = Math.pow(rand(), 0.82);
    const r = 0.95 + (R_OUT - 0.95) * u;
    const width = 0.13 + 0.16 * u; // arms fray outward
    const th = (arm / ARMS) * TAU + spiralTheta(r, 0.95) + (rand() - 0.5) * 2 * width;
    const top = 0.34 - 0.06 * u;
    const rel = Math.pow(rand(), 0.5);
    const y = 0.04 + rel * (top - 0.04);
    const s = 0.095 + rand() * 0.09;
    const gap = rand() < 0.22; // the moats between bands, where air sinks
    return {
      r,
      th,
      y,
      sx: gap ? 0 : s,
      sy: gap ? 0 : s * (0.45 + rand() * 0.3),
      rot: rand() * TAU,
      shade: 0.14 + rel * 0.8,
    };
  });
  group.add(bands.mesh);

  // outflow canopy: the cirrus shield the storm exhausts at the tropopause.
  // Its inner edge sits outside the eye's TOP radius — the eye is clear all
  // the way up, which is why you can see sky from inside one.
  const cirrus = makeShell(380, cirrusMat, () => {
    const u = Math.pow(rand(), 0.75);
    const r = 0.58 + (2.35 - 0.58) * u;
    const th = rand() * TAU - spiralTheta(r, 0.58) * 0.45; // trailing, the other way
    const s = 0.17 + rand() * 0.17;
    return {
      r,
      th,
      y: Y_TOP - 0.05 + rand() * 0.07,
      sx: s,
      sy: s * 0.16,
      rot: rand() * TAU,
      shade: 0.75 + rand() * 0.25,
    };
  });
  group.add(cirrus.mesh);

  // --- the cross-section ----------------------------------------------------
  // The cutaway steps do NOT slice the puff shells. Two reasons, both learned
  // the hard way: culling ~2000 instances against a world half-plane meant
  // rewriting and re-uploading three instance buffers every single frame (it
  // was the single most expensive thing in the scene), and a pile of sliced
  // spheres reads as a slab of gravel, not as a section through a vortex.
  //
  // So the section is BUILT: lumpy surfaces of revolution over the same
  // profile functions the puffs were placed against, so the two views agree
  // about where the storm is. Bumps are baked into the vertices, which means
  // the whole thing costs nothing per frame.
  //
  // The happy accident: a surface of revolution is invariant under rotation
  // about its own axis, so the FULL funnel used for the inside-the-eye step
  // can spin at whole turns per lap and stay perfectly seamless, while its
  // baked bumps make that rotation clearly visible.

  // Outer envelope of the storm core at height y: a tower that narrows with
  // height and then flares into the anvil at the tropopause.
  function outerR(y) {
    const u = clamp01(y / Y_TOP);
    // No anvil term: the flare that looked right in profile rendered as a
    // smooth plate sticking out past the puffs. This surface is BACKING and
    // must stay just inside the cloud it backs.
    return 1.05 - 0.5 * smooth(clamp01(u / 0.8));
  }

  // Deterministic lump field — the same every reload, and continuous around
  // the seam at theta = 0 because every term is a whole harmonic of theta.
  const lump = (th, v) =>
    Math.sin(th * 3 + v * 5.5) * 0.55 +
    Math.sin(th * 7 - v * 9) * 0.3 +
    Math.sin(th * 13 + v * 17) * 0.15;

  function revSurface(radiusAt, { yFrom, yTo, rows = 30, segs = 84, thFrom = 0, thLen = TAU, bump = 0.05, flip = false }) {
    const closed = thLen > TAU - 1e-6;
    const cols = closed ? segs : segs + 1;
    const pos = [];
    const col = [];
    const idx = [];
    for (let i = 0; i <= rows; i++) {
      const v = i / rows;
      const y = yFrom + (yTo - yFrom) * v;
      const base = radiusAt(y);
      for (let j = 0; j < cols; j++) {
        const th = thFrom + thLen * (j / segs);
        // taper the lumps to nothing at the very ends so the surface still
        // meets the sea and the anvil cleanly
        const r = base + bump * lump(th, v) * Math.sin(Math.PI * v) * base;
        pos.push(r * Math.cos(th), y, r * Math.sin(th));
        const c = _shade.copy(SHADE_BASE).lerp(SHADE_TOP, 0.1 + v * 0.9);
        col.push(c.r, c.g, c.b);
      }
    }
    for (let i = 0; i < rows; i++) {
      for (let j = 0; j < (closed ? cols : cols - 1); j++) {
        const jN = (j + 1) % cols;
        const a = i * cols + j;
        const b = i * cols + jN;
        const c = (i + 1) * cols + j;
        const d = (i + 1) * cols + jN;
        if (flip) idx.push(a, b, c, b, d, c);
        else idx.push(a, c, b, b, c, d);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(col, 3));
    geo.setIndex(idx);
    geo.computeVertexNormals();
    return geo;
  }

  // Two wall materials: the OUTSIDE of the storm is lit, the inside of the
  // eyewall is in its own shadow. Without that contrast the eye gap in the cut
  // face reads as a grey plate rather than as a hole you are looking down.
  const wallInnerMat = new THREE.MeshStandardMaterial({
    color: 0x6f7889,
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  const wallMat = new THREE.MeshStandardMaterial({
    vertexColors: true,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });
  // The flat face the knife left. Darker than the outside, the way any real
  // cutaway model reads.
  const faceMat = new THREE.MeshStandardMaterial({
    color: 0x6e7789,
    roughness: 1,
    metalness: 0,
    side: THREE.DoubleSide,
  });

  // The surviving half is z < 0 — theta from PI to 2PI — because every
  // cutaway camera sits on +Z.
  const HALF_FROM = Math.PI;
  const section = new THREE.Group();
  section.visible = false;
  const sectionInner = new THREE.Mesh(
    revSurface((y) => eyeR(y), { yFrom: 0.015, yTo: Y_TOP, thFrom: HALF_FROM, thLen: Math.PI, bump: 0.05, flip: true }),
    wallInnerMat,
  );
  const sectionOuter = new THREE.Mesh(
    revSurface(outerR, { yFrom: 0.015, yTo: Y_TOP, thFrom: HALF_FROM, thLen: Math.PI, bump: 0.09 }),
    wallMat,
  );
  section.add(sectionInner, sectionOuter);

  // the two cut faces, one on each side of the axis, spanning eye wall to
  // outer envelope in the z = 0 plane
  for (const sign of [1, -1]) {
    const fpos = [];
    const fidx = [];
    const rows = 30;
    for (let i = 0; i <= rows; i++) {
      const y = 0.015 + (Y_TOP - 0.015) * (i / rows);
      fpos.push(sign * eyeR(y), y, 0, sign * outerR(y), y, 0);
    }
    for (let i = 0; i < rows; i++) {
      const a = i * 2;
      fidx.push(a, a + 1, a + 2, a + 1, a + 3, a + 2);
    }
    const fgeo = new THREE.BufferGeometry();
    fgeo.setAttribute('position', new THREE.Float32BufferAttribute(fpos, 3));
    fgeo.setIndex(fidx);
    fgeo.computeVertexNormals();
    section.add(new THREE.Mesh(fgeo, faceMat));
  }
  // Same reasoning as the puff shells: these are weather, not housing, and
  // letting them dim the callouts that point INTO the cut defeats the cut.
  section.traverse((o) => {
    o.userData.noOcclude = true;
  });
  group.add(section);

  // Those two surfaces are BACKING, not the finished look: on their own they
  // render as smooth card stock, which is exactly what the first cutaway pass
  // looked like. The cloud character comes from puffs, same as the satellite
  // view — pre-built into their own shells so nothing is ever culled or
  // rewritten at runtime.

  // the far half of the storm, seen in section
  const sectionPuffs = makeShell(820, cloudMat, () => {
    const skirt = rand() < 0.3; // low cloud reaching out past the core
    const r = skirt
      ? R_CDO + rand() * 0.9
      : R_EYE + (R_CDO - R_EYE) * Math.pow(rand(), 1.7);
    const top = skirt ? 0.3 : coreTop(r);
    const rel = Math.pow(rand(), 0.5);
    const y = 0.03 + rel * Math.max(0.02, top - 0.03);
    let rr = r;
    if (rr < eyeR(y) + 0.1) rr = eyeR(y) + 0.1 + rand() * 0.08;
    const s = 0.1 + rand() * 0.09 + (y / Y_TOP) * 0.05;
    return {
      // theta confined to the surviving half, and biased AWAY from the cut
      // plane so the flat faces stay clean and readable
      r: rr,
      th: HALF_FROM + 0.1 + rand() * (Math.PI - 0.2),
      y,
      sx: s,
      sy: s * (0.5 + rand() * 0.25),
      rot: rand() * TAU,
      shade: 0.16 + rel * 0.84,
    };
  });
  section.add(sectionPuffs.mesh); // the group visibility gates it


  // --- the engine: one closed thermodynamic circuit -------------------------
  // Sea -> up the eyewall -> out along the tropopause -> sink far away -> back
  // in along the sea. Theta advances 1.6 + 1.1 - 0.55 - 0.15 = 2.0 whole turns
  // over the cycle, so the curve CLOSES exactly and a dot riding it never
  // meets a seam.
  function leg(from, to, turns, n, th0) {
    const pts = [];
    for (let i = 0; i < n; i++) {
      const u = i / n;
      const e = smooth(u);
      const r = from.r + (to.r - from.r) * e;
      const y = from.y + (to.y - from.y) * e;
      const th = th0 + turns * TAU * u;
      pts.push(new THREE.Vector3(r * Math.cos(th), y, r * Math.sin(th)));
    }
    return { pts, endTh: th0 + turns * TAU };
  }
  const enginePts = [];
  let cursor = 0;
  for (const [from, to, turns, n] of [
    [{ r: 2.45, y: 0.035 }, { r: 0.36, y: 0.025 }, 1.6, 70],
    [{ r: 0.36, y: 0.025 }, { r: 0.5, y: 1.02 }, 1.1, 48],
    [{ r: 0.5, y: 1.02 }, { r: 2.4, y: 0.94 }, -0.55, 40],
    [{ r: 2.4, y: 0.94 }, { r: 2.45, y: 0.035 }, -0.15, 26],
  ]) {
    const seg = leg(from, to, turns, n, cursor);
    enginePts.push(...seg.pts);
    cursor = seg.endTh;
  }
  const engineCurve = new THREE.CatmullRomCurve3(enginePts, true, 'catmullrom', 0.2);

  // The circuit is only ever SEEN on the cutaway steps, where the near half of
  // the storm is gone — so the near half of the loop must go with it, or the
  // drawn path sweeps across the foreground in front of a storm that has been
  // cut away behind it. Built as one tube per run of points that survive the
  // cut, which the sampled point list makes easy.
  const engineTube = new THREE.Group();
  const tubeMat = new THREE.MeshBasicMaterial({
    color: 0x4a86bd,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  });
  {
    let run = [];
    const flush = () => {
      if (run.length >= 4) {
        engineTube.add(
          new THREE.Mesh(
            new THREE.TubeGeometry(
              new THREE.CatmullRomCurve3(run, false, 'catmullrom', 0.2),
              run.length * 3,
              0.0075,
              8,
              false,
            ),
            tubeMat,
          ),
        );
      }
      run = [];
    };
    for (const p of enginePts) {
      if (p.z <= 0.04) run.push(p);
      else flush();
    }
    flush();
  }
  engineTube.renderOrder = 6;
  group.add(engineTube);

  const DOTS = 18;
  const dotMat = new THREE.MeshBasicMaterial({
    color: 0x74c2f0,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  });
  const engineDots = new THREE.Group();
  const dotGeo = new THREE.SphereGeometry(0.019, 10, 8);
  for (let i = 0; i < DOTS; i++) engineDots.add(new THREE.Mesh(dotGeo, dotMat));
  engineDots.renderOrder = 6;
  group.add(engineDots);

  // --- inflow streamers + the Coriolis comparison ---------------------------
  // Three low-level streamers spiralling in, each shadowed by the straight line
  // the same parcel would have taken on a planet that did not rotate.
  // These two are ANNOTATION, not weather: they are drawn with depthTest off
  // so the near-top-down Coriolis shot can read them through the cloud deck
  // they physically run beneath.
  const inflowMat = new THREE.MeshBasicMaterial({
    color: 0x5fb0e6,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  });
  const ghostMat = new THREE.MeshBasicMaterial({
    color: 0xa3aebc,
    transparent: true,
    opacity: 0,
    depthWrite: false,
    depthTest: false,
  });
  const inflowCurves = [];
  const inflowGroup = new THREE.Group();
  const ghostGroup = new THREE.Group();
  for (let k = 0; k < 3; k++) {
    const th0 = (k / 3) * TAU + 0.4;
    const cpts = [];
    for (let i = 0; i <= 90; i++) {
      const u = i / 90;
      const r = 2.45 + (0.36 - 2.45) * smooth(u);
      const th = th0 + 1.6 * TAU * u;
      cpts.push(new THREE.Vector3(r * Math.cos(th), 0.045, r * Math.sin(th)));
    }
    const cv = new THREE.CatmullRomCurve3(cpts, false, 'catmullrom', 0.2);
    inflowCurves.push(cv);
    inflowGroup.add(new THREE.Mesh(new THREE.TubeGeometry(cv, 220, 0.009, 8, false), inflowMat));
    ghostGroup.add(
      new THREE.Mesh(
        new THREE.TubeGeometry(
          new THREE.LineCurve3(
            new THREE.Vector3(2.45 * Math.cos(th0), 0.045, 2.45 * Math.sin(th0)),
            new THREE.Vector3(0.1 * Math.cos(th0), 0.045, 0.1 * Math.sin(th0)),
          ),
          2,
          0.009,
          8,
          false,
        ),
        ghostMat,
      ),
    );
  }
  inflowGroup.renderOrder = 6;
  ghostGroup.renderOrder = 6;
  group.add(inflowGroup, ghostGroup);

  // parcels riding both paths at the SAME fraction of the journey, so the
  // deflection reads as a race the straight line wins
  // Three parcels per streamer, staggered a third of a journey apart, each
  // fading in at the rim and out at the wall. One parcel per path would snap
  // from the centre back to the edge on every wrap — a visible seam, which is
  // the one thing a loop may never have.
  const PARCELS = 3;
  const parcelGeo = new THREE.SphereGeometry(0.038, 12, 10);
  const parcels = [];
  const ghostParcels = [];
  for (let k = 0; k < 3; k++) {
    const row = [];
    const grow = [];
    for (let j = 0; j < PARCELS; j++) {
      const a = new THREE.Mesh(parcelGeo, inflowMat);
      const b = new THREE.Mesh(parcelGeo, ghostMat);
      row.push(a);
      grow.push(b);
      inflowGroup.add(a);
      ghostGroup.add(b);
    }
    parcels.push(row);
    ghostParcels.push(grow);
  }
  // inflow accelerates as it converges — angular momentum is conserved, so the
  // same air spins faster on a shorter radius. Integrated so one lap is still
  // exactly one trip down the streamer.
  const inflowRate = profileTable((u) => 0.3 + 2.6 * u * u, 1);

  // --- evaporation off the warm sea ----------------------------------------
  const vapourCount = 150;
  const vapourMat = new THREE.MeshBasicMaterial({
    color: 0x86b8d8,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const vapour = new THREE.InstancedMesh(
    new THREE.SphereGeometry(0.026, 8, 6),
    vapourMat,
    vapourCount,
  );
  vapour.frustumCulled = false;
  vapour.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const vapourSeeds = [];
  for (let i = 0; i < vapourCount; i++) {
    const r = 0.9 + rand() * 2.6;
    const th = rand() * TAU;
    vapourSeeds.push({
      x: r * Math.cos(th),
      z: r * Math.sin(th),
      ph: rand(),
      h: 0.18 + rand() * 0.14,
    });
  }
  group.add(vapour);

  // --- subsiding air in the eye --------------------------------------------
  const sinkCount = 16;
  const sinkMat = new THREE.MeshBasicMaterial({
    color: 0xc08a5f,
    transparent: true,
    opacity: 0,
    depthWrite: false,
  });
  const sink = new THREE.InstancedMesh(new THREE.SphereGeometry(0.011, 10, 8), sinkMat, sinkCount);
  sink.frustumCulled = false;
  sink.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const sinkSeeds = [];
  for (let i = 0; i < sinkCount; i++) {
    sinkSeeds.push({ r: 0.07 + rand() * 0.18, th: rand() * TAU, ph: i / sinkCount });
  }
  group.add(sink);

  // faint tropopause lid, so the outflow has something to spread against
  const lidGeo = new THREE.RingGeometry(0.5, 2.5, 96);
  lidGeo.rotateX(-Math.PI / 2);
  const lid = new THREE.Mesh(
    lidGeo,
    new THREE.MeshBasicMaterial({
      color: 0x4f6f8c,
      transparent: true,
      opacity: 0,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  );
  lid.position.y = Y_TOP + 0.02;
  group.add(lid);

  // --- callouts -------------------------------------------------------------
  // Anchored to a group that does NOT rotate: a label whipping round twice a
  // lap is unreadable, and the parts they name are shells, not objects.
  const anchors = new THREE.Group();
  group.add(anchors);
  const anchor = (x, y, z) => {
    const o = new THREE.Object3D();
    o.position.set(x, y, z);
    anchors.add(o);
    return o;
  };
  const labels = calloutSets([
    'exterior',
    'fuel',
    'spin',
    'spinup',
    'engine',
    'wall',
    'eye',
    'coast',
  ]);

  labels.add('exterior', anchor(0, 0.46, 0), 'Eye', [0, 0, 0], 95, 64);
  labels.add('exterior', anchor(0.66, 0.55, 0.5), 'Eyewall', [0, 0, 0], 38, 74);
  labels.add('exterior', anchor(2.05, 0.2, 0.15), 'Rainbands', [0, 0, 0], 8, 62);
  labels.add('exterior', anchor(1.75, Y_TOP - 0.02, -1.25), 'Outflow canopy', [0, 0, 0], 128, 76);

  labels.add('fuel', anchor(-0.2, 0.02, 3.05), 'Sea at 26.5 °C', [0, 0, 0], -30, 72);
  labels.add('fuel', anchor(2.0, 0.2, 1.35), 'Evaporating seawater', [0, 0, 0], 40, 78);

  labels.add('spin', anchor(1.35, 0.05, 0.95), 'Deflected right', [0, 0, 0], -40, 70);
  labels.add('spin', anchor(1.1, 0.05, -1.4), 'Without Coriolis', [0, 0, 0], 42, 74);

  labels.add('spinup', anchor(0.62, 0.06, 0.55), 'Faster on a shorter radius', [0, 0, 0], -34, 84);
  labels.add('spinup', anchor(0, 0.02, 0), 'Pressure falling', [0, 0, 0], 96, 70);

  // The cutaway drops everything with z > 0, so these three anchor on the FAR
  // half — the half that survives the cut and faces the camera in profile.
  labels.add('engine', anchor(1.7, 0.04, -0.55), 'Inflow · 1 km deep', [0, 0, 0], -32, 78);
  labels.add('engine', anchor(0.46, 0.57, -0.18), 'Eyewall updraft', [0, 0, 0], 26, 78);
  labels.add('engine', anchor(1.35, Y_TOP - 0.14, -0.4), 'Outflow · runs backwards', [0, 0, 0], 30, 78);

  labels.add('wall', anchor(0.46, 0.5, -0.2), 'Category 5 starts here', [0, 0, 0], 152, 70);
  labels.add('wall', anchor(0.58, 0.86, -0.26), 'Leaning outward', [0, 0, 0], 140, 68);

  labels.add('eye', anchor(0.4, 0.28, 0.32), 'The well is clear to the sea', [0, 0, 0], 42, 70);
  labels.add('eye', anchor(0.12, 0.62, -0.1), 'Dry, sinking, warm', [0, 0, 0], 128, 76);

  labels.add('coast', anchor(1.0, 0.07, 2.75), 'Storm surge', [0, 0, 0], -38, 70);
  labels.add('coast', anchor(2.05, 0.08, -1.5), 'Coast', [0, 0, 0], 34, 62);

  // --- pose -----------------------------------------------------------------
  const state = {
    spin: 0, // whole-turn scalar; each shell multiplies it by its own TURNS_*
    flow: 0, // 0-1 phase of the engine circuit
    deck: 1, // fraction of puffs drawn — the diagram steps thin the storm
    warm: 0, // warm-ocean glow + evaporation
    ghost: 0, // straight-line comparison paths
    inflow: 0, // low-level streamers
    engine: 0, // the closed circuit
    view: 0, // 0 = satellite (puff shells) · 1 = cross-section
    sinkAir: 0, // subsiding parcels inside the eye
    land: 0, // coastline, surge dome, surf
    lid: 0, // tropopause plane
  };

  // Spin is a rotation of the whole shell, not 2700 rewritten matrices — the
  // instance buffer is only touched on the two steps that cut the vortex open,
  // where which puffs survive changes every frame. (Rewriting all three shells
  // every frame was what made this scene too slow to load on a phone.)
  function poseShell(shell, turns) {
    shell.mesh.rotation.y = state.spin * turns * TAU;
  }

  function apply() {
    poseShell(core, TURNS_CORE);
    poseShell(bands, TURNS_BANDS);
    poseShell(cirrus, TURNS_CIRRUS);

    // Exactly one of the three representations is on at a time.
    const satellite = state.view < 0.5;
    core.mesh.visible = satellite;
    bands.mesh.visible = satellite;
    cirrus.mesh.visible = satellite;
    section.visible = state.view > 0.5 && state.view < 1.5;

    // InstancedMesh.count is a draw-call limit, and the puffs were generated
    // in random order, so this thins the storm uniformly for free.
    const thin = (sh) => {
      sh.mesh.count = Math.max(1, Math.round(sh.items.length * state.deck));
    };
    thin(core);
    thin(bands);
    thin(cirrus);

    warmPatch.material.opacity = state.warm * 0.48;
    vapourMat.opacity = state.warm * 0.75;
    vapour.visible = state.warm > 0.001;
    if (vapour.visible) {
      for (let i = 0; i < vapourCount; i++) {
        const sd = vapourSeeds[i];
        const t = (state.flow * 3 + sd.ph) % 1;
        dummy.position.set(sd.x, t * sd.h, sd.z);
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(Math.sin(Math.PI * t));
        dummy.updateMatrix();
        vapour.setMatrixAt(i, dummy.matrix);
      }
      vapour.instanceMatrix.needsUpdate = true;
    }

    sinkMat.opacity = state.sinkAir * 0.75;
    sink.visible = state.sinkAir > 0.001;
    if (sink.visible) {
      for (let i = 0; i < sinkCount; i++) {
        const sd = sinkSeeds[i];
        const t = (state.flow + sd.ph) % 1;
        const th = sd.th - t * 0.9; // drifts slowly, the opposite way to the wall
        dummy.position.set(sd.r * Math.cos(th), 0.97 - t * 0.87, sd.r * Math.sin(th));
        dummy.rotation.set(0, 0, 0);
        dummy.scale.setScalar(Math.sin(Math.PI * t) * 1.1);
        dummy.updateMatrix();
        sink.setMatrixAt(i, dummy.matrix);
      }
      sink.instanceMatrix.needsUpdate = true;
    }

    tubeMat.opacity = state.engine * 0.55;
    dotMat.opacity = state.engine;
    engineTube.visible = state.engine > 0.001;
    engineDots.visible = state.engine > 0.001;
    if (engineDots.visible) {
      engineDots.children.forEach((d, i) => {
        d.position.copy(engineCurve.getPointAt((state.flow + i / DOTS) % 1));
        // same half-space rule as the tube: a dot orbiting through the removed
        // half would appear to float in front of the cut
        d.visible = d.position.z <= 0.04;
      });
    }

    inflowMat.opacity = state.inflow;
    ghostMat.opacity = state.ghost * 0.75;
    inflowGroup.visible = state.inflow > 0.001;
    ghostGroup.visible = state.ghost > 0.001;
    if (inflowGroup.visible || ghostGroup.visible) {
      for (let k = 0; k < inflowCurves.length; k++) {
        const th0 = (k / 3) * TAU + 0.4;
        for (let j = 0; j < PARCELS; j++) {
          const t = (state.flow + j / PARCELS) % 1;
          const u = clamp01(inflowRate.at(t) / TAU); // accelerating inward
          const fade = Math.sin(Math.PI * t);
          const p = parcels[k][j];
          p.position.copy(inflowCurves[k].getPointAt(u));
          p.scale.setScalar(fade);
          const g = ghostParcels[k][j];
          const r = 2.45 + (0.1 - 2.45) * u;
          g.position.set(r * Math.cos(th0), 0.045, r * Math.sin(th0));
          g.scale.setScalar(fade);
        }
      }
    }

    lid.material.opacity = state.lid * 0.09;
    lid.visible = state.lid > 0.001;

    land.material.opacity = state.land;
    surge.material.opacity = state.land * 0.92;
    // the surf pulses one whole cycle per lap, so the wrap is invisible
    foam.material.opacity = state.land * (0.28 + 0.16 * Math.sin(state.flow * TAU));
    land.visible = state.land > 0.001;
    surge.visible = state.land > 0.001;
    foam.visible = state.land > 0.001;
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
      core: core.mesh,
      bands: bands.mesh,
      cirrus: cirrus.mesh,
      sea,
      engineTube,
      engineDots,
      inflowGroup,
      ghostGroup,
      land,
      surge,
      vapour,
      sink,
      lid,
    },
  };
}
