// The library's hero mechanism — a live gear train behind the home page copy.
//
// Five spur gears of different tooth counts meshed in a chain, plus a spoked
// flywheel coaxial with the driver. Ratios and mesh phase are COMPUTED, so the
// teeth genuinely fall into each other's gaps at every angle — the same
// discipline the explainers themselves are held to, and the reason this reads
// as a machine rather than as decoration.
//
// It also performs the page's headline: the train assembles itself out of an
// exploded view on load, and comes apart again as you scroll off the hero.
//
// studioEnv() and heatBlueTexture() are exported for about-hero.js, which
// runs a different object with a different story behind the about page's
// copy — same lighting/material toolkit, deliberately not the same scene.
//
// Chrome-layer code, not the explainer framework (CLAUDE.md rule 4 is about
// framework/stage.js): nothing here touches stage.js. three.js is already in
// the entry bundle for the explainer stage, so this module adds only its own
// geometry code.
import * as THREE from 'three';
import { materials } from './framework/parts.js';

// --- gear geometry --------------------------------------------------------
// Trapezoidal tooth profile — the same half-width fractions as the 2D credits
// gear in home.js, verified not to interfere at any mesh angle.
const A_ROOT = 0.27;
const A_PITCH = 0.215;
const A_TIP = 0.15;

function gearGeometry(teeth, module, opts = {}) {
  const rPitch = (module * teeth) / 2;
  const rTip = rPitch + module;
  const rRoot = rPitch - module * 1.25;
  const rBore = opts.bore ?? Math.max(0.09, rPitch * 0.15);
  const depth = opts.depth ?? 0.18;

  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / teeth;
  for (let i = 0; i < teeth; i++) {
    const c = i * step;
    const pts = [
      [rRoot, c - step * A_ROOT],
      [rPitch, c - step * A_PITCH],
      [rTip, c - step * A_TIP],
      [rTip, c + step * A_TIP],
      [rPitch, c + step * A_PITCH],
      [rRoot, c + step * A_ROOT],
    ];
    for (let k = 0; k < pts.length; k++) {
      const [r, a] = pts[k];
      const x = r * Math.cos(a);
      const y = r * Math.sin(a);
      if (i === 0 && k === 0) shape.moveTo(x, y);
      else shape.lineTo(x, y);
    }
    shape.absarc(0, 0, rRoot, c + step * A_ROOT, (i + 1) * step - step * A_ROOT, false);
  }
  shape.closePath();

  const bore = new THREE.Path();
  bore.absarc(0, 0, rBore, 0, Math.PI * 2, true);
  shape.holes.push(bore);

  // lightening holes in the web — these are what make the rotation readable
  const nHoles = opts.holes ?? (rPitch > 0.75 ? 5 : 0);
  if (nHoles) {
    const rWeb = (rBore + rRoot) * 0.52;
    const rHole = Math.min((rRoot - rBore) * 0.26, rWeb * 0.42);
    for (let i = 0; i < nHoles; i++) {
      const a = (i / nHoles) * Math.PI * 2 + Math.PI / nHoles;
      const p = new THREE.Path();
      p.absarc(Math.cos(a) * rWeb, Math.sin(a) * rWeb, rHole, 0, Math.PI * 2, true);
      shape.holes.push(p);
    }
  }

  // A cut gear is chamfered, not knife-edged. A slightly larger bevel over more
  // segments gives the tooth tips a curved land that catches a highlight line
  // as they turn, instead of ending in a hard corner.
  const bevel = Math.min(0.028, depth * 0.2);
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: opts.cheap ? 1 : 3,
    curveSegments: opts.cheap ? 6 : 12,
  });
  geo.translate(0, 0, -depth / 2);
  geo.computeVertexNormals();
  return { geo, rPitch, rTip, rBore };
}

// ExtrudeGeometry writes RAW WORLD XY into the UV channel — it does not
// normalise. A 0..1 gradient map therefore spans only one world unit and clamps
// everywhere else, which on a 2.5-unit gear shows up as a hard seam with flat
// colour either side. So the temper ramp needs its own coordinates: u sweeps
// across the part's diameter, tilted a little, the way a torch runs along steel
// being tempered.
//
// It writes a SECOND channel (uv1) rather than overwriting uv. Overwriting it
// costs the gear every other map — grain and normals would smear along the
// sweep — which is why this one part used to be the only smooth gear in the
// train. three lets each texture pick its channel, so the ramp reads uv1 while
// roughness and normals keep the raw world-XY uv the other gears use.
//
// lo/hi trim the ramp's ends: run it all the way to 1 and half the gear falls
// into cold dark steel, which just reads as dirty next to bright aluminium.
function addSweepUV1(geo, radius, angle, lo = 0, hi = 1) {
  const pos = geo.attributes.position;
  const ca = Math.cos(angle);
  const sa = Math.sin(angle);
  const uv1 = new Float32Array(pos.count * 2);
  for (let i = 0; i < pos.count; i++) {
    const t = (pos.getX(i) * ca + pos.getY(i) * sa) / (2 * radius) + 0.5;
    uv1[i * 2] = lo + Math.min(1, Math.max(0, t)) * (hi - lo);
    uv1[i * 2 + 1] = 0.5;
  }
  geo.setAttribute('uv1', new THREE.BufferAttribute(uv1, 2));
}

// --- studio environment ---------------------------------------------------
// Metalness 1 means the environment IS the lighting — a dark room gives dark
// metal. So: bright ceiling, a broad softbox across the horizon (what the flat
// gear faces reflect back at the camera), dark floor.
// Exported so about-hero.js's different hero object can light itself with
// the same validated studio rig (a pure-metal scene has no diffuse response,
// so the "ring that never goes to zero" fix below is load-bearing, not
// decorative — worth reusing exactly, not re-deriving).
export function studioEnv(dark) {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 256;
  const g = c.getContext('2d');

  const base = g.createLinearGradient(0, 0, 0, 256);
  if (dark) {
    base.addColorStop(0, '#dfe6ee');
    base.addColorStop(0.24, '#8f99a4');
    base.addColorStop(0.46, '#3a4048');
    base.addColorStop(0.62, '#15171a');
    base.addColorStop(0.82, '#0b0c0e');
    base.addColorStop(1, '#191b1d');
  } else {
    base.addColorStop(0, '#ffffff');
    base.addColorStop(0.26, '#cfd4d9');
    base.addColorStop(0.48, '#6d737a');
    base.addColorStop(0.68, '#2f2d2a');
    base.addColorStop(1, '#33383d');
  }
  g.fillStyle = base;
  g.fillRect(0, 0, 512, 256);

  // A CONTINUOUS horizon ring. The environment yaws slowly for the specular
  // sweep, and metalness 1 means the env is the only light a gear has — so any
  // dark arc in this band becomes a phase where the whole train goes black as
  // it rotates past. Ambient/directional light cannot rescue it: pure metal has
  // no diffuse response. A ring that never reaches zero is the actual fix.
  const ring = g.createLinearGradient(0, 52, 0, 200);
  ring.addColorStop(0, 'rgba(255,255,255,0)');
  ring.addColorStop(0.45, dark ? 'rgba(255,255,255,0.46)' : 'rgba(255,255,255,0.6)');
  ring.addColorStop(0.62, dark ? 'rgba(255,255,255,0.4)' : 'rgba(255,255,255,0.52)');
  ring.addColorStop(1, 'rgba(255,255,255,0)');
  g.fillStyle = ring;
  g.fillRect(0, 52, 512, 148);

  // Softboxes on top of the ring for variation. Each is drawn three times, one
  // period either side, so a box overhanging an edge reappears on the opposite
  // one — otherwise the u=0/1 seam passes the camera as a visible jump.
  const box = (cx, cy, rx, ry, col) => {
    for (const off of [-512, 0, 512]) {
      const x = cx + off;
      const rg = g.createRadialGradient(x, cy, 0, x, cy, Math.max(rx, ry));
      rg.addColorStop(0, col);
      rg.addColorStop(1, 'rgba(0,0,0,0)');
      g.save();
      g.translate(x, cy);
      g.scale(1, ry / rx);
      g.translate(-x, -cy);
      g.fillStyle = rg;
      g.beginPath();
      g.arc(x, cy, rx, 0, Math.PI * 2);
      g.fill();
      g.restore();
    }
  };

  box(190, 118, 230, 74, 'rgba(255,255,255,0.7)'); // front softbox (face light)
  box(150, 34, 140, 46, 'rgba(255,255,255,0.9)'); // hard top key for tooth tips
  box(430, 96, 120, 62, dark ? 'rgba(190,214,255,0.5)' : 'rgba(255,255,255,0.62)');
  box(70, 208, 170, 80, dark ? 'rgba(196,204,214,0.3)' : 'rgba(208,216,226,0.32)');

  const tex = new THREE.CanvasTexture(c);
  tex.mapping = THREE.EquirectangularReflectionMapping;
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.needsUpdate = true;
  return tex;
}

// Heat-blued steel, the same ramp as textures.js heatBlueMap(): straw-gold
// through violet to cold steel. It is the accent of the whole page, so exactly
// one gear in the train carries it.
export function heatBlueTexture() {
  const c = document.createElement('canvas');
  c.width = 512;
  c.height = 8;
  const g = c.getContext('2d');
  const grad = g.createLinearGradient(0, 0, 512, 0);
  // The real temper sequence, with the intermediate stops a smith would see:
  // pale straw runs to deep straw, through bronze and brown, into the purples,
  // then peacock blue and finally cold grey. The extra stops matter because
  // the brown→purple crossing is where a two-stop blend goes muddy.
  for (const [t, col] of [
    [0.0, '#f0d79a'],
    [0.08, '#e8c56b'],
    [0.17, '#dda63c'],
    [0.28, '#b7743a'],
    [0.36, '#96543f'],
    [0.44, '#754d72'],
    [0.52, '#5d5391'],
    [0.62, '#3f6bb0'],
    [0.72, '#3f7fa8'],
    [0.85, '#556673'],
    [1.0, '#43474d'],
  ])
    grad.addColorStop(t, col);
  g.fillStyle = grad;
  g.fillRect(0, 0, 512, 8);
  const tex = new THREE.CanvasTexture(c);
  tex.colorSpace = THREE.SRGBColorSpace;
  // the ramp lives on its own UV channel so the grain maps can keep uv
  tex.channel = 1;
  return tex;
}

// --- the train ------------------------------------------------------------
// Real size contrast, so the chain reads as a cascade rather than a row of
// similar discs. `dir` is the line-of-centres angle to the previous gear,
// which is all the mesh solver needs.
const MODULE = 0.086;
const CHAIN = [
  { teeth: 38, dir: null, metal: 'alu', depth: 0.22 },
  { teeth: 17, dir: 0.54, metal: 'steel', depth: 0.16 },
  { teeth: 29, dir: -0.4, metal: 'blued', depth: 0.2 },
  { teeth: 15, dir: 0.6, metal: 'steel', depth: 0.15 },
  { teeth: 23, dir: -0.26, metal: 'alu', depth: 0.18 },
];

const easeOutExpo = (t) => (t >= 1 ? 1 : 1 - Math.pow(2, -10 * t));

export function mountHeroMachine(canvas) {
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    alpha: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 1.75));
  renderer.outputColorSpace = THREE.SRGBColorSpace;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.15;

  const scene = new THREE.Scene();
  const camera = new THREE.PerspectiveCamera(30, 1, 0.1, 100);

  const isDark = () => {
    const attr = document.documentElement.getAttribute('data-theme');
    if (attr) return attr === 'dark';
    return !window.matchMedia('(prefers-color-scheme: light)').matches;
  };
  let dark = isDark();
  let env = studioEnv(dark);
  scene.environment = env;

  const key = new THREE.DirectionalLight(0xf4f7fb, dark ? 1.5 : 2.1);
  key.position.set(-3, 4, 6);
  scene.add(key);
  const rim = new THREE.DirectionalLight(0x9fc4ff, dark ? 1.1 : 0.7);
  rim.position.set(4, -2, -4);
  scene.add(rim);
  scene.add(new THREE.AmbientLight(0xffffff, 0.18));

  // The ACTUAL presets from framework/parts.js, not lookalikes — so the hero is
  // literally made of the stock the machines are. They carry both a roughnessMap
  // (large-scale grain) and a normalMap (the same grain as micro-bumps):
  // roughness alone reads flat under raking light, and the normal map is what
  // makes each bump catch or lose the highlight as the train turns.
  //
  // ExtrudeGeometry writes raw world XY into the UV channel, and these textures
  // are RepeatWrapping, so the grain tiles at a sane world scale with no remap.
  // (The gradient map on the blued gear is the one that needs its own
  // coordinates — a 0..1 ramp cares where its ends land; repeating grain does
  // not. That ramp rides uv1, so it costs the gear nothing else.)
  const proto = {
    alu: materials.aluminum(0xb9c0c8),
    // anisoSteel = brushedSteel plus the stretched highlight real turned metal
    // has. rotation 0: on a flat extruded face U runs along world X, which is
    // the direction we want the brushing to read.
    steel: materials.anisoSteel(0xc6ccd4, 0),
    // The tempered gear. Built on anisoSteel so it carries the same brushed
    // grain, normals and stretched highlight as the rest of the train, with the
    // temper ramp layered on its own UV channel. White base so the ramp reads
    // true — colour multiplies the map.
    blued: materials.anisoSteel(0xffffff, 0),
    shaft: materials.aluminum(0x3a3f47),
  };
  proto.shaft.roughness = 0.45;
  // Two corrections for using explainer presets under a canvas env rather than
  // the HDRI they were tuned against:
  //  - roughnessMap MULTIPLIES the base, and a dimmer env has less to reflect,
  //    so intensity goes up or the aluminium reads as concrete.
  //  - the presets' normalScale is tuned for parts filling the frame. These
  //    gears are a few hundred pixels across, where the same bump depth turns
  //    into visible speckle, so the micro-relief is dialled back.
  proto.alu.envMapIntensity = 1.85;
  proto.alu.normalScale.set(0.16, 0.16);
  proto.steel.envMapIntensity = 1.7;
  proto.steel.normalScale.set(0.2, 0.2);
  proto.blued.map = heatBlueTexture();
  proto.blued.roughness = 0.24;
  proto.blued.envMapIntensity = 1.6;
  proto.blued.normalScale.set(0.13, 0.13);
  // Temper colours ARE thin-film interference — a few hundred nanometres of
  // oxide grown on the steel. So this is the mechanism, not a stylisation:
  // iridescence makes the hue shift with viewing angle exactly the way a
  // real blued part does as it turns, instead of being a painted-on gradient.
  proto.blued.iridescence = 0.4;
  proto.blued.iridescenceIOR = 1.5; // iron oxide
  proto.blued.iridescenceThicknessRange = [120, 400];
  proto.shaft.envMapIntensity = 1.15;
  proto.shaft.normalScale.set(0.12, 0.12);

  const train = new THREE.Group();
  scene.add(train);

  // Background machinery: dark, oversized, slow. Gives the frame depth without
  // competing — the room continues past the part you are looking at.
  const ghosts = new THREE.Group();
  scene.add(ghosts);
  // Far enough back to read as depth, bright enough to read as machinery. At
  // 0.26 intensity they were holes in the page rather than parts in a room.
  const ghostMat = new THREE.MeshStandardMaterial({
    color: 0x3c434c,
    metalness: 1,
    roughness: 0.68,
    envMapIntensity: 0.62,
  });
  for (const [teeth, x, y, z] of [
    [50, -3.4, 2.4, -5.2],
    [34, 3.9, -2.9, -4.4],
  ]) {
    const { geo } = gearGeometry(teeth, MODULE, { depth: 0.14, cheap: true });
    const m = new THREE.Mesh(geo, ghostMat);
    m.position.set(x, y, z);
    m.userData.rate = 0.05 + Math.random() * 0.06;
    ghosts.add(m);
  }

  // lay the chain out, gear by gear, along its line-of-centres angles
  const gears = [];
  let cx = 0;
  let cy = 0;
  for (let i = 0; i < CHAIN.length; i++) {
    const spec = CHAIN[i];
    const { geo, rPitch, rTip, rBore } = gearGeometry(spec.teeth, MODULE, { depth: spec.depth });
    if (spec.metal === 'blued') addSweepUV1(geo, rTip, 0.62, 0.02, 0.66);
    if (i > 0) {
      const prev = gears[i - 1];
      const d = prev.rPitch + rPitch;
      prev.lineAngle = spec.dir;
      cx = prev.x + Math.cos(spec.dir) * d;
      cy = prev.y + Math.sin(spec.dir) * d;
    }
    // per-gear material clone so the entrance can stagger the fade
    const mat = proto[spec.metal].clone();
    mat.transparent = true;
    mat.opacity = 0;
    const mesh = new THREE.Mesh(geo, mat);
    train.add(mesh);

    const shaftMat = proto.shaft.clone();
    shaftMat.transparent = true;
    shaftMat.opacity = 0;
    const shaft = new THREE.Mesh(
      new THREE.CylinderGeometry(rBore * 0.94, rBore * 0.94, 0.9, 20),
      shaftMat,
    );
    shaft.rotation.x = Math.PI / 2;
    train.add(shaft);

    gears.push({
      mesh,
      shaft,
      mat,
      shaftMat,
      teeth: spec.teeth,
      rPitch,
      rTip,
      x: cx,
      y: cy,
      zBase: i % 2 ? 0.06 : 0,
      lineAngle: 0,
      ex: 0,
      ey: 0,
    });
  }

  // flywheel: coaxial with the driver, sunk behind it
  const fw = new THREE.Group();
  const flyMat = proto.shaft.clone();
  flyMat.transparent = true;
  flyMat.opacity = 0;
  const rFly = gears[0].rPitch * 1.32;
  fw.add(new THREE.Mesh(new THREE.TorusGeometry(rFly, 0.075, 12, 64), flyMat));
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.17, 0.17, 0.22, 24), flyMat);
  hub.rotation.x = Math.PI / 2;
  fw.add(hub);
  for (let i = 0; i < 6; i++) {
    const spoke = new THREE.Mesh(new THREE.BoxGeometry(rFly - 0.1, 0.055, 0.075), flyMat);
    const a = (i / 6) * Math.PI * 2;
    spoke.position.set((Math.cos(a) * (rFly - 0.1)) / 2, (Math.sin(a) * (rFly - 0.1)) / 2, 0);
    spoke.rotation.z = a;
    fw.add(spoke);
  }
  train.add(fw);

  // explode direction: radially out from the chain's centre of mass, so the
  // assembly opens like an exploded-view drawing rather than scattering
  {
    const mx = gears.reduce((s, g) => s + g.x, 0) / gears.length;
    const my = gears.reduce((s, g) => s + g.y, 0) / gears.length;
    for (const g of gears) {
      const dx = g.x - mx;
      const dy = g.y - my;
      const len = Math.hypot(dx, dy) || 1;
      g.ex = dx / len;
      g.ey = dy / len;
    }
  }

  // --- mesh phase --------------------------------------------------------
  // If gear i has a tooth pointing straight at gear i+1 (theta_i === lineAngle)
  // then gear i+1 must have a GAP pointing back, i.e. its own tooth sits half a
  // pitch away. That single condition pins the whole chain.
  function applyAngles(drive) {
    let theta = drive;
    gears[0].mesh.rotation.z = theta;
    fw.rotation.z = theta;
    for (let i = 1; i < gears.length; i++) {
      const prev = gears[i - 1];
      const phi = prev.lineAngle;
      const T = gears[i].teeth;
      theta = -(prev.teeth / T) * (theta - phi) + phi + Math.PI + Math.PI / T;
      gears[i].mesh.rotation.z = theta;
    }
  }

  // Separation along each gear's own outward ray. Never touches rotation, so
  // the mesh solve above stays valid the whole way apart and back.
  function applyExplode(amount, fade) {
    for (let i = 0; i < gears.length; i++) {
      const g = gears[i];
      const k = amount * (0.5 + i * 0.22);
      g.mesh.position.set(g.x + g.ex * k, g.y + g.ey * k, g.zBase + amount * 0.34);
      g.shaft.position.set(g.mesh.position.x, g.mesh.position.y, g.mesh.position.z - 0.25);
      const o = Math.max(0, Math.min(1, fade[i]));
      g.mat.opacity = o;
      g.shaftMat.opacity = o * 0.9;
      g.mat.transparent = o < 0.999;
      g.shaftMat.transparent = o < 0.999;
    }
    fw.position.set(gears[0].mesh.position.x, gears[0].mesh.position.y, -0.42 - amount * 0.5);
    flyMat.opacity = Math.max(0, Math.min(1, fade[0]));
    flyMat.transparent = flyMat.opacity < 0.999;
  }

  // --- framing -----------------------------------------------------------
  // Frame by INTENT: say what fraction of the viewport the mechanism should
  // fill and where its centre should land, then solve for the camera. The copy
  // owns the left half in landscape and the top third in portrait, and the
  // right edge lands at cxFrac + fillW/2 — kept inside the page gutter.
  let portrait = false;
  function frame() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    renderer.setSize(w, h, false);
    const aspect = w / h;
    portrait = aspect < 1.05;

    train.rotation.z = portrait ? 1.16 : 0;
    train.rotation.x = -0.13;
    train.rotation.y = portrait ? 0.1 : 0.2;

    const rot = train.rotation.z;
    let minX = Infinity;
    let maxX = -Infinity;
    let minY = Infinity;
    let maxY = -Infinity;
    for (const g of gears) {
      const x = g.x * Math.cos(rot) - g.y * Math.sin(rot);
      const y = g.x * Math.sin(rot) + g.y * Math.cos(rot);
      minX = Math.min(minX, x - g.rTip);
      maxX = Math.max(maxX, x + g.rTip);
      minY = Math.min(minY, y - g.rTip);
      maxY = Math.max(maxY, y + g.rTip);
    }
    const cxm = (minX + maxX) / 2;
    const cym = (minY + maxY) / 2;
    train.position.set(-cxm, -cym, 0);
    ghosts.position.set(-cxm, -cym, 0);
    ghosts.rotation.z = train.rotation.z;

    const fillW = portrait ? 0.8 : 0.46;
    const fillH = portrait ? 0.5 : 0.7;
    const cxFrac = portrait ? 0.54 : 0.69;
    const cyFrac = portrait ? 0.72 : 0.5;

    camera.aspect = aspect;
    const t = Math.tan((camera.fov * Math.PI) / 360);
    const z = Math.max(
      (maxX - minX) / 2 / (fillW * aspect * t),
      (maxY - minY) / 2 / (fillH * t),
    );
    camera.position.z = z;

    const hv = z * t;
    const hh = hv * aspect;
    camera.position.x = -(cxFrac - 0.5) * 2 * hh;
    camera.position.y = (cyFrac - 0.5) * 2 * hv;
    camera.lookAt(camera.position.x, camera.position.y, 0);
    camera.updateProjectionMatrix();
  }

  // --- drive: idle creep + scroll + drag ---------------------------------
  const IDLE = reduceMotion ? 0 : 0.13; // rad/s
  const PER_PX_SCROLL = 0.0016;
  let angle = 0.4;
  let spin = 0;
  let lastY = window.scrollY;
  let lastT = performance.now();
  const t0 = performance.now();
  let dragging = false;
  let dragId = null;
  let lastPx = 0;
  let dragged = false;

  const pointer = { x: 0, y: 0, tx: 0, ty: 0 };

  const onDown = (e) => {
    dragging = true;
    dragId = e.pointerId;
    lastPx = e.clientX;
    canvas.setPointerCapture(e.pointerId);
    canvas.style.cursor = 'grabbing';
  };
  const onMove = (e) => {
    const r = canvas.getBoundingClientRect();
    pointer.tx = ((e.clientX - r.left) / r.width - 0.5) * 2;
    pointer.ty = ((e.clientY - r.top) / r.height - 0.5) * 2;
    if (!dragging || e.pointerId !== dragId) return;
    const dx = e.clientX - lastPx;
    lastPx = e.clientX;
    angle += dx * 0.006;
    spin = dx * 0.36; // carry the flick
    // the hint has done its job the moment the drag happens — tell the page
    if (Math.abs(dx) > 2 && !dragged) {
      dragged = true;
      canvas.dispatchEvent(new CustomEvent('train-dragged', { bubbles: true }));
    }
  };
  const onUp = (e) => {
    if (e.pointerId !== dragId) return;
    dragging = false;
    dragId = null;
    canvas.style.cursor = 'grab';
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);
  canvas.style.cursor = 'grab';

  // a hero nobody is looking at costs nothing
  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
  io.observe(canvas);

  const ENTER_MS = 1500;
  const ENTER_STAGGER = 120;
  const fade = gears.map(() => (reduceMotion ? 1 : 0));

  let raf = 0;
  function tick(t) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(0.064, (t - lastT) / 1000);
    lastT = t;
    if (!visible || document.hidden) {
      lastY = window.scrollY;
      return;
    }

    const y = window.scrollY;
    if (!reduceMotion) {
      angle += (y - lastY) * PER_PX_SCROLL + IDLE * dt + spin * dt;
      spin *= Math.exp(-3.2 * dt); // inertia bleed-off
    }
    lastY = y;
    applyAngles(angle);

    // ENTRANCE: the train assembles itself, gear by gear, out of an exploded
    // view. LEAVING: it comes apart again on the way out.
    let enter = 0;
    if (!reduceMotion) {
      const el = t - t0;
      for (let i = 0; i < gears.length; i++) {
        fade[i] = Math.min(1, Math.max(0, (el - i * ENTER_STAGGER) / (ENTER_MS * 0.5)));
      }
      enter = (1 - easeOutExpo(Math.min(1, el / ENTER_MS))) * 2.1;
    }
    const heroH = canvas.clientHeight || window.innerHeight;
    const leaving = reduceMotion ? 0 : Math.max(0, Math.min(1, y / heroH));
    applyExplode(enter + leaving * 1.35, fade);

    // a slow specular sweep — the highlight travels across the metal even when
    // nothing is turning, which is what makes a real product shot feel alive
    if (!reduceMotion) scene.environmentRotation.y = (t - t0) * 0.00004;

    for (const g of ghosts.children) g.rotation.z += g.userData.rate * dt;

    pointer.x += (pointer.tx - pointer.x) * Math.min(1, dt * 4);
    pointer.y += (pointer.ty - pointer.y) * Math.min(1, dt * 4);
    if (!reduceMotion) {
      train.rotation.y = (portrait ? 0.1 : 0.2) + pointer.x * 0.07;
      train.rotation.x = -0.13 - pointer.y * 0.05;
      ghosts.rotation.y = train.rotation.y * 0.5;
      ghosts.rotation.x = train.rotation.x * 0.5;
    }
    renderer.render(scene, camera);
  }

  frame();
  applyAngles(angle);
  applyExplode(reduceMotion ? 0 : 2.1, fade);
  renderer.render(scene, camera);
  raf = requestAnimationFrame(tick);

  const ro = new ResizeObserver(() => frame());
  ro.observe(canvas);

  // the studio relights itself when the page theme flips
  const setTheme = () => {
    const next = isDark();
    if (next === dark) return;
    dark = next;
    env.dispose();
    env = studioEnv(dark);
    scene.environment = env;
    key.intensity = dark ? 1.5 : 2.1;
    rim.intensity = dark ? 1.1 : 0.7;
    renderer.toneMappingExposure = dark ? 1.15 : 1.0;
  };
  const themeQuery = window.matchMedia('(prefers-color-scheme: light)');
  themeQuery.addEventListener('change', setTheme);
  const themeWatch = new MutationObserver(setTheme);
  themeWatch.observe(document.documentElement, {
    attributes: true,
    attributeFilter: ['data-theme'],
  });

  return {
    destroy() {
      cancelAnimationFrame(raf);
      io.disconnect();
      ro.disconnect();
      themeWatch.disconnect();
      themeQuery.removeEventListener('change', setTheme);
      canvas.removeEventListener('pointerdown', onDown);
      canvas.removeEventListener('pointermove', onMove);
      canvas.removeEventListener('pointerup', onUp);
      canvas.removeEventListener('pointercancel', onUp);
      scene.traverse((o) => {
        if (o.isMesh) {
          o.geometry.dispose();
          o.material.dispose();
        }
      });
      env.dispose();
      renderer.dispose();
    },
  };
}
