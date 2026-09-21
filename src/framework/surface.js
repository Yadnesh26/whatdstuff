import * as THREE from 'three';
import { bakeTexture } from './noise-bake.js';
import { detailNormalMap, macroFieldTexture } from './textures.js';

// Shared surface-realism helpers (texture-realism-plan.md, Phases 1 & 3).
// All are opt-in: an explainer or a parts.js preset calls them on a material
// AFTER it exists. They chain safely — each wraps the previous onBeforeCompile
// and only injects its world-space varyings once.
//
//  tuneTiling(mesh)      — consistent texel density, kills stretched/smeared maps
//  triplanar(material)   — object-space projection, kills UV seams on box/cyl
//  detailNormal(material)— a second, higher-frequency normal layer
//  macroVariation(material)— large-scale tint/roughness drift, kills "flat panel"
//  locatedWear(material) — grime pools on downward faces / around a contact point

// ---------------------------------------------------------------------------
// Phase 1.1 — consistent texel density
// ---------------------------------------------------------------------------
// A 512² map on a 2 m panel and the same map on a 5 cm screw must not have wildly
// different texel scale. Sets each map's `repeat` from the mesh's WORLD bbox so
// every surface lands near `texelsPerMeter`. Clones are memoised so 40 meshes
// sharing one cached texture don't upload 40 copies at 40 different repeats.
const tiledClones = new Map();
const TILE_KEYS = ['map', 'normalMap', 'roughnessMap', 'metalnessMap', 'aoMap', 'bumpMap'];

export function tuneTiling(mesh, texelsPerMeter = 280) {
  const geo = mesh.geometry;
  const mat = mesh.material;
  if (!geo || !mat) return mesh;
  geo.computeBoundingBox();
  const size = new THREE.Vector3();
  geo.boundingBox.getSize(size);
  mesh.updateWorldMatrix(true, false);
  const ws = new THREE.Vector3();
  mesh.getWorldScale(ws);

  const dims = [size.x * ws.x, size.y * ws.y, size.z * ws.z].sort((a, b) => b - a);
  const rx = Math.max(1, Math.round((dims[0] * texelsPerMeter) / 512));
  const ry = Math.max(1, Math.round((dims[1] * texelsPerMeter) / 512));

  for (const key of TILE_KEYS) {
    const t = mat[key];
    if (!t) continue;
    const cacheKey = `${t.uuid}|${rx}|${ry}`;
    let clone = tiledClones.get(cacheKey);
    if (!clone) {
      clone = t.clone();
      clone.wrapS = clone.wrapT = THREE.RepeatWrapping;
      clone.repeat.set(rx, ry);
      clone.needsUpdate = true;
      tiledClones.set(cacheKey, clone);
    }
    mat[key] = clone;
  }
  mat.needsUpdate = true;
  return mesh;
}

// ---------------------------------------------------------------------------
// shared onBeforeCompile plumbing
// ---------------------------------------------------------------------------
function tagKey(material, part) {
  material.userData.__surfaceKey = (material.userData.__surfaceKey || '') + '|' + part;
  material.customProgramCacheKey = () => material.userData.__surfaceKey;
}

// Guard so a helper applied twice to the SAME material (shared presets, a
// preset passed to several bladeRing calls) injects its shader chunks once.
function once(material, tag) {
  const set = (material.userData.__surfaceApplied ||= new Set());
  if (set.has(tag)) return false;
  set.add(tag);
  return true;
}

function chain(material, patch) {
  const prev = material.onBeforeCompile;
  material.onBeforeCompile = (shader, renderer) => {
    if (prev) prev(shader, renderer);
    patch(shader, renderer);
  };
  material.needsUpdate = true;
}

// Adds vSurfPos / vSurfNormal (world space) to a shader once.
function ensureWorldVaryings(shader) {
  if (shader.vertexShader.includes('vSurfPos')) return;
  shader.vertexShader = shader.vertexShader
    .replace(
      '#include <common>',
      '#include <common>\nvarying vec3 vSurfPos;\nvarying vec3 vSurfNormal;',
    )
    .replace(
      '#include <begin_vertex>',
      '#include <begin_vertex>\nvSurfPos = ( modelMatrix * vec4( transformed, 1.0 ) ).xyz;',
    )
    .replace(
      '#include <beginnormal_vertex>',
      '#include <beginnormal_vertex>\nvSurfNormal = mat3( modelMatrix ) * objectNormal;',
    );
  shader.fragmentShader = shader.fragmentShader.replace(
    '#include <common>',
    '#include <common>\nvarying vec3 vSurfPos;\nvarying vec3 vSurfNormal;',
  );
}

// ---------------------------------------------------------------------------
// Phase 1.2 — triplanar projection
// ---------------------------------------------------------------------------
// Samples map / roughnessMap / aoMap three times in object-ish (world) space and
// blends by |normal|, so BoxGeometry / CylinderGeometry stop stretching on
// non-square faces and stop seaming at the UV edge. normalMap, when present, is
// blended as a world-space wrinkle added to the geometric normal — crude but
// stable at the subtle normalScale (~0.3–0.4) these presets use.
export function triplanar(material, { scale = 1.0, blend = 4.0, normal = true } = {}) {
  if (!once(material, 'triplanar')) return material;
  material.userData.__triScale = scale;
  material.userData.__triBlend = blend;
  tagKey(material, `tri:${scale}:${blend}:${normal ? 1 : 0}`);
  chain(material, (shader) => {
    ensureWorldVaryings(shader);
    shader.uniforms.uTriScale = { value: scale };
    shader.uniforms.uTriBlend = { value: blend };
    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <common>',
      `#include <common>
uniform float uTriScale;
uniform float uTriBlend;
vec3 __triW(){
  vec3 w = pow( abs( normalize( vSurfNormal ) ), vec3( uTriBlend ) );
  return w / max( w.x + w.y + w.z, 1e-4 );
}`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <map_fragment>',
      `#ifdef USE_MAP
  {
    vec3 w = __triW();
    vec4 mx = texture2D( map, vSurfPos.zy * uTriScale );
    vec4 my = texture2D( map, vSurfPos.xz * uTriScale );
    vec4 mz = texture2D( map, vSurfPos.xy * uTriScale );
    diffuseColor *= ( mx * w.x + my * w.y + mz * w.z );
  }
#endif`,
    );

    shader.fragmentShader = shader.fragmentShader.replace(
      '#include <roughnessmap_fragment>',
      `float roughnessFactor = roughness;
#ifdef USE_ROUGHNESSMAP
  {
    vec3 w = __triW();
    float rx = texture2D( roughnessMap, vSurfPos.zy * uTriScale ).g;
    float ry = texture2D( roughnessMap, vSurfPos.xz * uTriScale ).g;
    float rz = texture2D( roughnessMap, vSurfPos.xy * uTriScale ).g;
    roughnessFactor *= ( rx * w.x + ry * w.y + rz * w.z );
  }
#endif`,
    );

    if (normal) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
#ifdef USE_NORMALMAP
  {
    vec3 w = __triW();
    vec3 nx = texture2D( normalMap, vSurfPos.zy * uTriScale ).xyz * 2.0 - 1.0;
    vec3 ny = texture2D( normalMap, vSurfPos.xz * uTriScale ).xyz * 2.0 - 1.0;
    vec3 nz = texture2D( normalMap, vSurfPos.xy * uTriScale ).xyz * 2.0 - 1.0;
    vec3 nW = nx * w.x + ny * w.y + nz * w.z;
    normal = normalize( normal + vec3( nW.xy, 0.0 ) * normalScale.x );
  }
#endif`,
      );
    }
  });
  return material;
}

// ---------------------------------------------------------------------------
// Phase 1.4 — second-frequency detail normal
// ---------------------------------------------------------------------------
export function detailNormal(material, { scale = 6.0, strength = 0.4 } = {}) {
  if (!once(material, 'detailNormal')) return material;
  const tex = detailNormalMap();
  if (!tex) return material;
  tagKey(material, `det:${scale}:${strength}`);
  chain(material, (shader) => {
    shader.uniforms.uDetailNormalMap = { value: tex };
    shader.uniforms.uDetailScale = { value: scale };
    shader.uniforms.uDetailStrength = { value: strength };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nvarying vec2 vDetailUv;\nuniform float uDetailScale;')
      .replace('#include <uv_vertex>', '#include <uv_vertex>\nvDetailUv = uv * uDetailScale;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vDetailUv;\nuniform sampler2D uDetailNormalMap;\nuniform float uDetailStrength;',
      )
      .replace(
        '#include <normal_fragment_maps>',
        `#include <normal_fragment_maps>
{
  vec3 dN = texture2D( uDetailNormalMap, vDetailUv ).xyz * 2.0 - 1.0;
  normal = normalize( normal + vec3( dN.xy * uDetailStrength, 0.0 ) );
}`,
      );
  });
  return material;
}

// ---------------------------------------------------------------------------
// Phase 3 — macro variation (large-scale tint + roughness drift)
// ---------------------------------------------------------------------------
export function macroVariation(material, { tint = 0.05, rough = 0.06, freq = 0.14 } = {}) {
  if (!once(material, 'macroVariation')) return material;
  const tex = macroFieldTexture();
  if (!tex) return material;
  tagKey(material, `mac:${tint}:${rough}:${freq}`);
  chain(material, (shader) => {
    ensureWorldVaryings(shader);
    shader.uniforms.uMacroMap = { value: tex };
    shader.uniforms.uMacroFreq = { value: freq };
    shader.uniforms.uMacroTint = { value: tint };
    shader.uniforms.uMacroRough = { value: rough };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nuniform sampler2D uMacroMap;\nuniform float uMacroFreq;\nuniform float uMacroTint;\nuniform float uMacroRough;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  float m = texture2D( uMacroMap, vSurfPos.xz * uMacroFreq ).r - 0.5;
  diffuseColor.rgb *= 1.0 + m * 2.0 * uMacroTint;
}`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
{
  float m = texture2D( uMacroMap, vSurfPos.xz * uMacroFreq ).r - 0.5;
  roughnessFactor = clamp( roughnessFactor + m * uMacroRough, 0.02, 1.0 );
}`,
      );
  });
  return material;
}

// ---------------------------------------------------------------------------
// Phase 3 — located wear (geometry-driven, cheap proxy for a baked cavity map)
// ---------------------------------------------------------------------------
// Downward-facing surfaces collect grime; an optional world-space contact point
// rubs the finish smooth and slightly dark (a handle, a crown, a button).
export function locatedWear(
  material,
  { cavity = 0.6, cavityRough = 0.14, point = null, radius = 0.15, rub = 0.18 } = {},
) {
  if (!once(material, 'locatedWear')) return material;
  tagKey(material, `wear:${cavity}:${!!point}`);
  chain(material, (shader) => {
    ensureWorldVaryings(shader);
    shader.uniforms.uWearCavity = { value: cavity };
    shader.uniforms.uWearCavityRough = { value: cavityRough };
    shader.uniforms.uWearHasPoint = { value: point ? 1 : 0 };
    shader.uniforms.uWearPoint = { value: point ? new THREE.Vector3(...point) : new THREE.Vector3() };
    shader.uniforms.uWearRadius = { value: radius };
    shader.uniforms.uWearRub = { value: rub };
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        `#include <common>
uniform float uWearCavity;
uniform float uWearCavityRough;
uniform int   uWearHasPoint;
uniform vec3  uWearPoint;
uniform float uWearRadius;
uniform float uWearRub;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
{
  float up = clamp( normalize( vSurfNormal ).y * 0.5 + 0.5, 0.0, 1.0 );
  roughnessFactor = clamp( roughnessFactor + ( 1.0 - up ) * uWearCavity * uWearCavityRough, 0.02, 1.0 );
  if ( uWearHasPoint == 1 ) {
    float d = 1.0 - smoothstep( 0.0, uWearRadius, distance( vSurfPos, uWearPoint ) );
    roughnessFactor = clamp( roughnessFactor - d * uWearRub, 0.02, 1.0 );
  }
}`,
      );
    if (point) {
      shader.fragmentShader = shader.fragmentShader.replace(
        '#include <color_fragment>',
        `#include <color_fragment>
{
  float d = 1.0 - smoothstep( 0.0, uWearRadius, distance( vSurfPos, uWearPoint ) );
  diffuseColor.rgb *= 1.0 - d * 0.14;
}`,
      );
    }
  });
  return material;
}

// ---------------------------------------------------------------------------
// convenience: apply several enhancements from one options object
// ---------------------------------------------------------------------------
// Presets in parts.js forward their `fx` argument here, so an explainer can
// write materials.aluminum(color, { triplanar: { scale: 1.4 }, macro: true }).
// Each value is the helper's options object, or `true` for that helper's
// defaults, or falsy to skip.
export function enhance(material, fx = {}) {
  if (!fx) return material;
  if (fx.triplanar) triplanar(material, fx.triplanar === true ? {} : fx.triplanar);
  if (fx.detail) detailNormal(material, fx.detail === true ? {} : fx.detail);
  if (fx.macro) macroVariation(material, fx.macro === true ? {} : fx.macro);
  if (fx.wear) locatedWear(material, fx.wear === true ? {} : fx.wear);
  return material;
}

// ---------------------------------------------------------------------------
// Phase 1.3 — per-instance variation for InstancedMesh greebles
// ---------------------------------------------------------------------------
// 70 instanced keys / blades sampling one texel pattern read as "one part
// stamped 70 times". A per-instance random seeds a small roughness + tint
// offset (always compiles, no UV plumbing). `uvShift` additionally offsets the
// map/roughnessMap sample per instance — only safe where the geometry has real
// UVs and a tiling map (flat keys), so it's off by default.
export function varyInstances(inst, { rough = 0.05, tint = 0.04, uvShift = false } = {}) {
  if (!inst || !inst.isInstancedMesh) return inst;
  if (!inst.geometry.getAttribute('aInstRand')) {
    const n = inst.count;
    const rand = new Float32Array(n * 2);
    for (let i = 0; i < n * 2; i++) rand[i] = Math.random();
    inst.geometry.setAttribute('aInstRand', new THREE.InstancedBufferAttribute(rand, 2));
  }

  const mat = inst.material;
  if (!once(mat, 'varyInstances')) return inst;
  tagKey(mat, `inst:${rough}:${tint}:${uvShift ? 1 : 0}`);
  chain(mat, (shader) => {
    shader.uniforms.uInstRough = { value: rough };
    shader.uniforms.uInstTint = { value: tint };
    shader.vertexShader = shader.vertexShader
      .replace('#include <common>', '#include <common>\nattribute vec2 aInstRand;\nvarying vec2 vInstRand;')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvInstRand = aInstRand;');
    shader.fragmentShader = shader.fragmentShader
      .replace(
        '#include <common>',
        '#include <common>\nvarying vec2 vInstRand;\nuniform float uInstRough;\nuniform float uInstTint;',
      )
      .replace(
        '#include <color_fragment>',
        `#include <color_fragment>
diffuseColor.rgb *= 1.0 + ( vInstRand.x - 0.5 ) * 2.0 * uInstTint;`,
      )
      .replace(
        '#include <roughnessmap_fragment>',
        `#include <roughnessmap_fragment>
roughnessFactor = clamp( roughnessFactor + ( vInstRand.y - 0.5 ) * uInstRough, 0.02, 1.0 );`,
      );
    if (uvShift) {
      shader.vertexShader = shader.vertexShader.replace(
        '#include <uv_vertex>',
        `#include <uv_vertex>
#ifdef USE_MAP
  vMapUv += ( aInstRand - 0.5 ) * 0.5;
#endif
#ifdef USE_ROUGHNESSMAP
  vRoughnessMapUv += ( aInstRand - 0.5 ) * 0.5;
#endif`,
      );
    }
  });
  return inst;
}
