import * as THREE from 'three';
import { RoundedBoxGeometry } from 'three/addons/geometries/RoundedBoxGeometry.js';
import { animate } from 'animejs';
import {
  brushedMap,
  castMap,
  brushedNormalMap,
  castNormalMap,
  grimeMap,
  heatBlueMap,
  woodGrainMap,
} from './textures.js';
import { enhance } from './surface.js';

// Shared material presets so explainers look like one family.
//
// The v2 physical presets take an optional trailing `fx` object forwarded to
// surface.enhance() — opt-in per explainer, no effect unless passed:
//   materials.aluminum(0xb9c0c8, { triplanar: { scale: 1.3 }, macro: true })
// keys: triplanar | detail | macro | wear  (value = that helper's opts, or true)
export const materials = {
  // --- v2 physical presets (use for new/upgraded explainers) ---------------
  // aluminum/brushedSteel carry both a roughnessMap (large-scale grain) AND a
  // normalMap (the same grain as actual micro-bumps) — roughness alone reads
  // flat under raking light; the normal map is what makes each bump catch or
  // lose the highlight as the camera orbits.
  aluminum: (color = 0xb9c0c8, fx) =>
    enhance(
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: 1,
        roughness: 0.42,
        roughnessMap: castMap(),
        normalMap: castNormalMap(),
        normalScale: new THREE.Vector2(0.35, 0.35),
      }),
      fx,
    ),
  brushedSteel: (color = 0xc6ccd4, fx) =>
    enhance(
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: 1,
        roughness: 0.3,
        roughnessMap: brushedMap(),
        normalMap: brushedNormalMap(),
        normalScale: new THREE.Vector2(0.4, 0.4),
      }),
      fx,
    ),
  chrome: (color = 0xd8dde3) =>
    new THREE.MeshPhysicalMaterial({ color, metalness: 1, roughness: 0.09 }),
  // Brushed metal with the anisotropic stretched-highlight [VALIDATED,
  // 2026-07-28, air-conditioner copper tubing]. `rotation` is in radians and
  // must match the geometry's UV layout: on TubeGeometry (drawn pipe/tube —
  // U wraps the circumference, V runs along the length) the grain runs along
  // the length, so pass Math.PI/2 to rotate the stretch off the default
  // U-alignment onto V. On a flat/lathe surface where U already runs the
  // brushing direction, pass 0. Always eyeball a close-up screenshot before
  // trusting the rotation — perpendicular-to-grain stretch looks wrong
  // instantly, per the polish-explainer skill.
  anisoSteel: (color = 0xc6ccd4, rotation = 0, fx) => {
    const mat = new THREE.MeshPhysicalMaterial({
      color,
      metalness: 1,
      roughness: 0.3,
      roughnessMap: brushedMap(),
      normalMap: brushedNormalMap(),
      normalScale: new THREE.Vector2(0.4, 0.4),
      anisotropy: 0.7,
      anisotropyRotation: rotation,
    });
    return enhance(mat, fx);
  },
  paintedMetal: (color, fx) =>
    enhance(
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0.25,
        roughness: 0.42,
        clearcoat: 1,
        clearcoatRoughness: 0.14,
      }),
      fx,
    ),
  rubber: (color = 0x1c1e22) =>
    new THREE.MeshPhysicalMaterial({ color, metalness: 0, roughness: 0.95 }),
  // matte moulded polymer — tool/appliance/firearm housings. Distinct from
  // `plastic` (glossier MeshStandard) and `paintedMetal` (glossy lacquer over
  // metal): near-zero specular gloss, just the faint sheen real polymer has,
  // so it reads as a dry moulded body rather than wet-looking plastic. A low
  // clearcoat (0.15) also lets it ghost correctly on reveal — a high coat
  // renders at full strength regardless of opacity and reads solid.
  polymer: (color = 0x23262c, fx) =>
    enhance(
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: 0,
        roughness: 0.74,
        clearcoat: 0.15,
        clearcoatRoughness: 0.62,
      }),
      fx,
    ),
  // Real refractive optical glass — lens elements, cover glass, anything you
  // look THROUGH [VALIDATED, 2026-08-05, dslr-camera lens elements]. Uses
  // transmission rather than faked opacity, so what sits behind it is genuinely
  // bent, and `coating` is the blue-violet anti-reflective bloom every modern
  // multi-coated element has (0.28 reads as a coating; 1.0 is a soap bubble).
  // TWO CAUTIONS: the transmission pass renders a backbuffer that EXCLUDES
  // transmissive objects, so two of these stacked do not show through each
  // other and a `transparent: true` object behind one may vanish outright; and
  // never use it for glass with transparent CONTENTS (a light beam drawn inside
  // a prism) — plain transparent glass is the correct material there.
  opticalGlass: ({ color = 0xdfe9ff, thickness = 0.16, ior = 1.62, coating = 0.28 } = {}) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0,
      roughness: 0.04,
      transmission: 1,
      thickness,
      ior,
      transparent: false,
      side: THREE.FrontSide,
      iridescence: coating,
      iridescenceIOR: 1.3,
      iridescenceThicknessRange: [180, 520],
    }),

  // varnished laminate wood — rifle/tool furniture, handles, stocks. The grain
  // colour rides a woodGrainMap; `tint` multiplies it (default white keeps the
  // map's own browns). A light clearcoat gives the satin varnish sheen.
  wood: (tint = 0xffffff) =>
    new THREE.MeshPhysicalMaterial({
      color: tint,
      map: woodGrainMap(),
      metalness: 0,
      roughness: 0.55,
      clearcoat: 0.25,
      clearcoatRoughness: 0.38,
    }),
  // grimy cast aluminum — oil/dirt pools toward the UV's "down" edge instead
  // of scattering evenly, for housings that sit low and collect it (sumps,
  // crankcases). Pair with geometry whose UV "down" is the part's actual
  // underside.
  grimyAluminum: (color = 0xb9c0c8, fx) =>
    enhance(
      new THREE.MeshPhysicalMaterial({
        color,
        metalness: 1,
        // roughnessMap MULTIPLIES this — grime texels average ~0.6, so 0.9
        // lands at ~0.55 effective. Lower values turn large flat bases into
        // softbox mirrors.
        roughness: 0.9,
        roughnessMap: grimeMap(),
        normalMap: castNormalMap(),
        normalScale: new THREE.Vector2(0.12, 0.12),
      }),
      fx,
    ),
  // heat-blued steel for exhaust parts: straw-gold at the hot end fading
  // through purple/blue to cold dark steel — colour driven entirely by a
  // gradient texture, no per-part tinting needed. direction 'u' suits
  // TubeGeometry headers, 'v' suits CylinderGeometry (jet nozzles etc.).
  heatBluedSteel: (direction = 'u') =>
    new THREE.MeshPhysicalMaterial({
      color: 0xffffff,
      map: heatBlueMap(direction),
      metalness: 1,
      roughness: 0.28,
      normalMap: brushedNormalMap(),
      normalScale: new THREE.Vector2(0.25, 0.25),
    }),

  // --- v1 presets ------------------------------------------------------------
  steel: (color = 0x9aa2ad) =>
    new THREE.MeshStandardMaterial({ color, metalness: 0.9, roughness: 0.35 }),
  darkMetal: (color = 0x3a3f47) =>
    new THREE.MeshStandardMaterial({ color, metalness: 0.85, roughness: 0.45 }),
  plastic: (color) =>
    new THREE.MeshStandardMaterial({ color, metalness: 0.05, roughness: 0.55 }),
  glass: (color = 0xbfd8ff, opacity = 0.16) =>
    new THREE.MeshPhysicalMaterial({
      color,
      metalness: 0,
      roughness: 0.12,
      transparent: true,
      opacity,
      side: THREE.DoubleSide,
      depthWrite: false,
    }),
  glow: (color, intensity = 1.6) =>
    new THREE.MeshStandardMaterial({
      color,
      emissive: color,
      emissiveIntensity: intensity,
    }),
};

// Cylinder whose origin is at its BOTTOM end and which extends along +Y.
// Much easier to position rods/stems with than the centered default.
export function rod(radius, length, material, radialSegments = 20) {
  const geo = new THREE.CylinderGeometry(radius, radius, length, radialSegments);
  geo.translate(0, length / 2, 0);
  const mesh = new THREE.Mesh(geo, material);
  mesh.castShadow = true;
  return mesh;
}

export function box(w, h, d, material) {
  const mesh = new THREE.Mesh(new THREE.BoxGeometry(w, h, d), material);
  mesh.castShadow = true;
  return mesh;
}

export function disc(radius, thickness, material, segments = 40) {
  const mesh = new THREE.Mesh(
    new THREE.CylinderGeometry(radius, radius, thickness, segments),
    material,
  );
  mesh.castShadow = true;
  return mesh;
}

// Small cone used as a flow-direction arrow.
export function arrow(color, size = 0.1) {
  const mesh = new THREE.Mesh(
    new THREE.ConeGeometry(size * 0.5, size, 12),
    materials.glow(color, 1.2),
  );
  mesh.material.transparent = true;
  mesh.material.depthWrite = false; // fully-faded arrows must not punch holes in glass
  return mesh;
}

// Brief emissive pulse to draw attention to a part.
export function pulse(mesh, color = 0x6ea8ff) {
  const mat = mesh.material;
  if (!mat || !mat.emissive) return;
  const original = mat.emissive.getHex();
  mat.emissive.setHex(color);
  const state = { t: 1 };
  animate(state, {
    t: 0,
    duration: 900,
    ease: 'outQuad',
    onUpdate: () => (mat.emissiveIntensity = state.t * 1.4),
    onComplete: () => {
      mat.emissive.setHex(original);
      mat.emissiveIntensity = 1;
    },
  });
}

// A queue of small glowing dots riding a curve (anything with getPointAt(t)
// in 0..1 — tubeAlong()'s userData.curve, chainPath(), a plain
// CatmullRomCurve3), for visualizing charge/current queuing along a wire:
// capacitor leads charging, current building in an inductor/transformer
// winding. `setFront(front)` places `count` dots trailing behind a leading
// edge at `front` (0..1 along the curve), each spaced `spacing` behind the
// last and fading in as it enters the curve — so a single scalar sweeping
// 0→1→0 reads as charge arriving then draining, no continuous animation
// loop required. Reverse direction (drain) just sweeps front back down.
export function chargeQueue(curve, count = 6, color = 0x6ea8ff, opts = {}) {
  const { size = 0.022, spacing = 0.09 } = opts;
  const geo = new THREE.SphereGeometry(size, 10, 8);
  const group = new THREE.Group();
  const dots = [];
  for (let i = 0; i < count; i++) {
    const mat = materials.glow(color, 1.5);
    mat.transparent = true;
    mat.opacity = 0;
    mat.depthWrite = false;
    const dot = new THREE.Mesh(geo, mat);
    group.add(dot);
    dots.push(dot);
  }
  function setFront(front, visible = true) {
    dots.forEach((dot, i) => {
      const t = front - i * spacing;
      if (!visible || t <= 0.001) {
        dot.material.opacity = 0;
        return;
      }
      const tc = Math.min(1, t);
      const p = curve.getPointAt(tc);
      dot.position.copy(p);
      dot.material.opacity = Math.min(1, t * 8) * (1 - (i / count) * 0.2);
    });
  }
  setFront(0);
  return { group, dots, setFront };
}

// A field of `count` identical flow arrows drawn as ONE InstancedMesh — the
// shape every fluid-loop explainer had been building as N separate Meshes (84
// of them in nuclear-power-plant, about a fifth of that scene's draw calls).
// Per-instance position, orientation, scale and COLOUR; opacity is shared,
// because three's instancing has no per-instance alpha — which is fine for a
// packet stream, where every packet is equally opaque.
//
// MeshBasic, not the emissive `glow` preset: the stage's bloom threshold is
// 2.2 (HDR), so a packet's emissive never reached it anyway, and a flat bright
// chip reads more like an energy marker than a lit cone does.
//
//   const field = flowField(40, 0.055);
//   group.add(field.mesh);
//   field.set(i, pos, quat, scale, colour);   // per frame
//   field.commit();                           // once, after the loop
export function flowField(count, size = 0.07, { opacity = 0.9 } = {}) {
  const geo = new THREE.ConeGeometry(size * 0.5, size, 12);
  const mat = new THREE.MeshBasicMaterial({
    color: 0xffffff,
    transparent: true,
    opacity,
    depthWrite: false, // a faded packet must never punch a hole through glass
  });
  const mesh = new THREE.InstancedMesh(geo, mat, count);
  mesh.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  // an InstancedMesh's bounding sphere comes from the GEOMETRY, not from where
  // the instances actually sit, so a stream spread across a whole scene gets
  // culled as if it were one cone at the origin
  mesh.frustumCulled = false;
  const _m = new THREE.Matrix4();
  const _s = new THREE.Vector3();
  const _c = new THREE.Color();
  for (let i = 0; i < count; i++) mesh.setColorAt(i, _c.setHex(0xffffff));

  function set(i, position, quaternion, scale, color) {
    _m.compose(position, quaternion, _s.setScalar(scale));
    mesh.setMatrixAt(i, _m);
    if (color) mesh.setColorAt(i, color);
  }
  function commit() {
    mesh.instanceMatrix.needsUpdate = true;
    if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
  }
  return { mesh, material: mat, set, commit };
}

// Standard charcoal display plinth every product-shot explainer stands on.
// The clearcoat comes pre-softened: the paintedMetal preset's default coat
// streak was the ONE clipped-white patch in a full readPixels bisect of the
// gearbox scene — these numbers are the verified fix, don't re-brighten them.
// Returns a mesh with its BOTTOM at y=0 (model stands on top at y=h).
export function studioPlinth({ w = 3.6, h = 0.26, d = 1.9, bevel = 0.06, color = 0x1b1d21 } = {}) {
  const mat = materials.paintedMetal(color);
  mat.clearcoat = 0.45;
  mat.clearcoatRoughness = 0.32;
  mat.roughness = 0.55;
  const r = Math.min(bevel, w / 2, h / 2, d / 2);
  const mesh = new THREE.Mesh(new RoundedBoxGeometry(w, h, d, 2, r), mat);
  mesh.position.y = h / 2;
  mesh.receiveShadow = true;
  mesh.castShadow = true;
  return mesh;
}

// Floating text label rendered onto a canvas sprite.
export function label(text, { color = '#e8eaf0', size = 0.5 } = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = 512;
  canvas.height = 128;
  const ctx = canvas.getContext('2d');
  ctx.font = '600 52px "Segoe UI", sans-serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillStyle = color;
  ctx.fillText(text, 256, 64);
  const texture = new THREE.CanvasTexture(canvas);
  texture.colorSpace = THREE.SRGBColorSpace;
  const sprite = new THREE.Sprite(
    new THREE.SpriteMaterial({ map: texture, transparent: true, depthTest: false }),
  );
  sprite.scale.set(size * 4, size, 1);
  return sprite;
}
