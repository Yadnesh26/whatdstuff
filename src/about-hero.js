// The about page's hero mechanism — one gear, caught mid-build.
//
// Half of it is still a drawing: thin blueprint lines, no metal. The other
// half is the finished part: brushed, chamfered, lit like a product shot.
// A sweep runs between the two, back and forth, forever — the page's own
// claim ("everything is built, nothing is downloaded") running as a loop
// instead of just being typed out.
//
// Deliberately NOT the home hero's gear train (home-hero.js): different
// object, different story, different technique (one part + a clip-plane
// reveal, vs. a meshed chain that explodes apart on scroll). It reuses that
// module's studio lighting rig and temper-ramp texture — pure light/material
// math, not a visual composition — because re-deriving a pure-metal env
// light from scratch is exactly the kind of trap CLAUDE.md warns about.
import * as THREE from 'three';
import { materials } from './framework/parts.js';
import { studioEnv, heatBlueTexture } from './home-hero.js';

// --- geometry ---------------------------------------------------------
// Same trapezoidal tooth profile as the home hero's gears (framework
// convention: computed profile, not a lookalike), built once and reused for
// both the solid layer and the blueprint layer's flat variant.
const TEETH = 28;
// Sized so rTip (below) fills ~62% of the frame HEIGHT at the camera
// distance set further down — camera.position.z = 3.35, fov 30 — not an
// arbitrary module. (rTip = module*(teeth/2 + 1); solve rTip = fill * z *
// tan(fov/2) for the module that hits that fraction.)
const MODULE = 0.037;
const A_ROOT = 0.27;
const A_PITCH = 0.215;
const A_TIP = 0.15;

function gearShape() {
  const rPitch = (MODULE * TEETH) / 2;
  const rTip = rPitch + MODULE;
  const rRoot = rPitch - MODULE * 1.25;
  const rBore = rPitch * 0.22;

  const shape = new THREE.Shape();
  const step = (Math.PI * 2) / TEETH;
  for (let i = 0; i < TEETH; i++) {
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

  const rWeb = (rBore + rRoot) * 0.54;
  const rHole = Math.min((rRoot - rBore) * 0.24, rWeb * 0.4);
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    const p = new THREE.Path();
    p.absarc(Math.cos(a) * rWeb, Math.sin(a) * rWeb, rHole, 0, Math.PI * 2, true);
    shape.holes.push(p);
  }
  return { shape, rPitch, rTip, rRoot, rBore };
}

const DEPTH = 0.17;

// The solid layer: real chamfer, same bevel discipline as every other part
// on the site — the tooth tips get a curved land instead of a knife edge.
function solidGeometry(shape) {
  const bevel = 0.011;
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH,
    bevelEnabled: true,
    bevelThickness: bevel,
    bevelSize: bevel,
    bevelOffset: 0,
    bevelSegments: 3,
    curveSegments: 14,
  });
  geo.translate(0, 0, -DEPTH / 2);
  geo.computeVertexNormals();
  return geo;
}

// The blueprint layer: the SAME profile with no chamfer, reduced to its
// structural edges (EdgesGeometry with a wide threshold drops the smooth
// bore/hole facets and keeps only the real creases — tooth flanks, hole
// rims, the front/back silhouette) — a technical drawing, not a wireframe
// dump of every triangle.
function blueprintGeometry(shape) {
  const geo = new THREE.ExtrudeGeometry(shape, {
    depth: DEPTH,
    bevelEnabled: false,
    curveSegments: 14,
  });
  geo.translate(0, 0, -DEPTH / 2);
  const edges = new THREE.EdgesGeometry(geo, 35);
  geo.dispose();
  return edges;
}

export function mountAboutMachine(canvas) {
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
  renderer.localClippingEnabled = true;

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

  const { shape, rTip } = gearShape();
  const solidGeo = solidGeometry(shape);
  const edgeGeo = blueprintGeometry(shape);

  // solid layer: the same anisotropic brushed steel every explainer uses,
  // clipped live to whichever side of the sweep counts as "built"
  const solidMat = materials.anisoSteel(0xc9cfd6, 0);
  solidMat.envMapIntensity = 1.75;
  solidMat.normalScale.set(0.18, 0.18);
  solidMat.clipShadows = true;
  const solid = new THREE.Mesh(solidGeo, solidMat);

  // blueprint layer: cool, thin, always fully present underneath — the
  // drawing the solid part is being built out of
  const blueMat = new THREE.LineBasicMaterial({
    color: 0x6fa3e6,
    transparent: true,
    opacity: 0.7,
  });
  const blueprint = new THREE.LineSegments(edgeGeo, blueMat);

  // the hot seam right where drawing becomes metal — heat-blued steel's own
  // ramp, the site's one accent, doing actual work instead of decorating
  const seamMat = materials.anisoSteel(0xffffff, 0);
  seamMat.map = heatBlueTexture();
  seamMat.roughness = 0.22;
  seamMat.envMapIntensity = 1.7;
  seamMat.iridescence = 0.45;
  seamMat.iridescenceIOR = 1.5;
  seamMat.iridescenceThicknessRange = [120, 400];
  const seam = new THREE.Mesh(solidGeo, seamMat);

  const tilt = new THREE.Group();
  tilt.rotation.x = -0.16;
  tilt.rotation.y = 0.22;
  const spin = new THREE.Group();
  spin.add(blueprint, solid, seam);
  tilt.add(spin);
  scene.add(tilt);

  // Object stays put in world space; the CAMERA solves for wherever the
  // canvas's aspect ratio actually is — same approach as home-hero.js's
  // framing solver. A fixed object offset (an earlier version of this file
  // had one) reads fine on one aspect ratio and pushes the part almost
  // entirely off-canvas on a narrow phone, where the frame is only ~0.46
  // aspect wide.
  let portrait = false;
  function layout() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    const aspect = w / h;
    portrait = aspect < 1.05;

    // landscape: height is the tight dimension, so the gear sits well right
    // of the copy column. portrait: width is tight, so it centers lower,
    // under the text, with more headroom on the height constraint.
    const fillW = portrait ? 0.64 : 0.4;
    const fillH = portrait ? 0.38 : 0.64;
    const cxFrac = portrait ? 0.56 : 0.74;
    const cyFrac = portrait ? 0.78 : 0.5;

    camera.aspect = aspect;
    const t = Math.tan((camera.fov * Math.PI) / 360);
    const z = Math.max(rTip / (fillW * aspect * t), rTip / (fillH * t));
    camera.position.z = z;
    const hv = z * t;
    const hh = hv * aspect;
    camera.position.x = -(cxFrac - 0.5) * 2 * hh;
    camera.position.y = (cyFrac - 0.5) * 2 * hv;
    camera.lookAt(camera.position.x, camera.position.y, 0);
    camera.updateProjectionMatrix();
  }
  layout();

  // --- the sweep ------------------------------------------------------
  // Local-space plane, recomputed into world space every frame off the
  // spinning group's own matrix — that's what keeps the reveal attached to
  // the part's own surface instead of slicing through world space as it
  // (and the pointer-drag on top of it) turns.
  const SWEEP_RANGE = rTip * 1.08;
  const localPlane = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  const seamPlaneA = new THREE.Plane(new THREE.Vector3(1, 0, 0), 0);
  const seamPlaneB = new THREE.Plane(new THREE.Vector3(-1, 0, 0), 0);
  const SEAM_WIDTH = rTip * 0.05;

  // --- pointer drag: turns the part, same language as the rest of the site
  let pointerX = 0;
  let pointerTX = 0;
  let dragging = false;
  let lastPX = 0;
  let dragged = false;
  const onDown = (e) => {
    dragging = true;
    dragged = false;
    lastPX = e.clientX;
    canvas.setPointerCapture(e.pointerId);
  };
  const onMove = (e) => {
    if (!dragging) return;
    const dx = e.clientX - lastPX;
    lastPX = e.clientX;
    if (Math.abs(dx) > 1) dragged = true;
    pointerTX += dx * 0.006;
  };
  const onUp = (e) => {
    dragging = false;
    if (dragged) canvas.dispatchEvent(new CustomEvent('train-dragged', { bubbles: true }));
    canvas.releasePointerCapture?.(e.pointerId);
  };
  canvas.addEventListener('pointerdown', onDown);
  canvas.addEventListener('pointermove', onMove);
  canvas.addEventListener('pointerup', onUp);
  canvas.addEventListener('pointercancel', onUp);

  let visible = true;
  const io = new IntersectionObserver(([e]) => (visible = e.isIntersecting), { threshold: 0 });
  io.observe(canvas);

  let raf = 0;
  let angle = 0;
  let t0 = performance.now();
  let last = t0;

  function frame() {
    const w = canvas.clientWidth || 1;
    const h = canvas.clientHeight || 1;
    if (canvas.width !== Math.round(w * renderer.getPixelRatio()) ||
        canvas.height !== Math.round(h * renderer.getPixelRatio())) {
      renderer.setSize(w, h, false);
      layout();
    }
    renderer.render(scene, camera);
  }

  function tick(t) {
    raf = requestAnimationFrame(tick);
    const dt = Math.min(64, t - last) / 1000;
    last = t;
    if (!visible) return;

    pointerX += (pointerTX - pointerX) * Math.min(1, dt * 4);
    if (!reduceMotion) {
      angle += dt * 0.16;
      spin.rotation.y = angle + pointerX;

      // slow specular sweep across the studio env, same trick the home
      // hero uses to keep pure metal from ever going flat
      scene.environmentRotation.y = (t - t0) * 0.00004;

      // the build sweep — a sine, so it reverses smoothly with no seam
      const sweep = Math.sin((t - t0) * 0.00035) * SWEEP_RANGE;
      localPlane.constant = sweep;
      seamPlaneA.constant = sweep;
      seamPlaneB.constant = -(sweep - SEAM_WIDTH);

      spin.updateMatrixWorld();
      solidMat.clippingPlanes[0] = localPlane.clone().applyMatrix4(spin.matrixWorld);
      seamMat.clippingPlanes[0] = seamPlaneA.clone().applyMatrix4(spin.matrixWorld);
      seamMat.clippingPlanes[1] = seamPlaneB.clone().applyMatrix4(spin.matrixWorld);
    }
    frame();
  }

  solidMat.clippingPlanes = [localPlane];
  seamMat.clippingPlanes = [seamPlaneA, seamPlaneB];
  frame();
  raf = requestAnimationFrame(tick);

  const ro = new ResizeObserver(() => frame());
  ro.observe(canvas);

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
      solidGeo.dispose();
      edgeGeo.dispose();
      solidMat.dispose();
      blueMat.dispose();
      seamMat.dispose();
      env.dispose();
      renderer.dispose();
    },
  };
}
