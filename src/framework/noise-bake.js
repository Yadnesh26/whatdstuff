import * as THREE from 'three';

// GPU-baked procedural noise. One tiny dedicated WebGLRenderer runs a fullscreen
// WGSL-style GLSL noise pass into a RenderTarget, the pixels are read back once,
// and the result is handed out as a plain DataTexture the STAGE renderer uploads
// itself (GL resources don't cross contexts — the readback is mandatory, not a
// choice). Everything is cached by key and baked lazily on first use.
//
// This replaces the `for`-loop-of-random-arcs grain in textures.js: real FBM,
// Worley/cellular and domain warp, which are non-periodic across the tile, so a
// large flat surface no longer shows an obvious repeat. Callers that can't get a
// GL context (should never happen in-app) get `null` and fall back to canvas.

let bakeRenderer = null;
const cache = new Map();

function getRenderer() {
  if (bakeRenderer) return bakeRenderer;
  if (typeof document === 'undefined') throw new Error('no document — cannot bake');
  bakeRenderer = new THREE.WebGLRenderer({ antialias: false, alpha: false, depth: false });
  bakeRenderer.setSize(4, 4);
  return bakeRenderer;
}

const KIND = { fbm: 0, worley: 1, grime: 2, speckle: 3, normal: 4 };
const PROFILE = { fbm: 0, worley: 1 };

// --- the noise library (shared by every kind) -------------------------------
const NOISE_GLSL = /* glsl */ `
precision highp float;
varying vec2 vUv;
uniform float uSize;
uniform int   uKind;
uniform int   uProfile;
uniform vec2  uFreq;        // base lattice frequency — integers keep it seamless
uniform int   uOctaves;
uniform float uGain;
uniform float uContrast;
uniform float uMid;
uniform float uWarp;
uniform vec2  uBiasDir;     // unit axis grime pools toward (in uv space)
uniform float uBiasAmt;
uniform float uNormalStrength;
uniform float uSeed;

float hash1(vec2 p){
  p = mod(p, 8192.0);
  return fract(sin(dot(p, vec2(127.1, 311.7))) * 43758.5453 + uSeed);
}

// value noise that TILES: the lattice is wrapped with mod(period), and callers
// pass period == the same frequency the coords were scaled by.
float vnoise(vec2 x, vec2 period){
  vec2 i = floor(x), f = fract(x);
  vec2 u = f * f * (3.0 - 2.0 * f);
  float a = hash1(mod(i + vec2(0.0, 0.0), period));
  float b = hash1(mod(i + vec2(1.0, 0.0), period));
  float c = hash1(mod(i + vec2(0.0, 1.0), period));
  float d = hash1(mod(i + vec2(1.0, 1.0), period));
  return mix(mix(a, b, u.x), mix(c, d, u.x), u.y);
}

float fbmTile(vec2 uv, vec2 baseFreq, int oct, float gain){
  float s = 0.0, amp = 0.5, norm = 0.0;
  vec2 freq = baseFreq;
  for (int i = 0; i < 8; i++){
    if (i >= oct) break;
    s   += amp * vnoise(uv * freq, freq);
    norm += amp;
    freq *= 2.0;
    amp  *= gain;
  }
  return s / max(norm, 1e-4);
}

// F1/F2 cellular distances, tiled the same way.
vec2 worleyTile(vec2 uv, vec2 period){
  vec2 p = uv * period;
  vec2 i = floor(p), f = fract(p);
  float f1 = 8.0, f2 = 8.0;
  for (int y = -1; y <= 1; y++){
    for (int x = -1; x <= 1; x++){
      vec2 g = vec2(float(x), float(y));
      vec2 cell = mod(i + g, period);
      vec2 o = vec2(hash1(cell), hash1(cell + 17.0));
      vec2 r = g + o - f;
      float d = dot(r, r);
      if (d < f1){ f2 = f1; f1 = d; }
      else if (d < f2){ f2 = d; }
    }
  }
  return sqrt(vec2(f1, f2));
}

vec2 warp(vec2 uv, vec2 baseFreq, float amt){
  float wx = fbmTile(uv + vec2(0.19, 0.73), baseFreq, 4, 0.5);
  float wy = fbmTile(uv + vec2(4.31, 1.17), baseFreq, 4, 0.5);
  return uv + amt * (vec2(wx, wy) - 0.5);
}

float shape(float v){
  return clamp((v - 0.5) * uContrast + uMid, 0.0, 1.0);
}

// height field the normal kind differentiates
float heightField(vec2 uv){
  if (uProfile == ${PROFILE.worley}){
    vec2 w = worleyTile(uv, uFreq);
    return clamp(1.0 - w.x * 1.2, 0.0, 1.0);
  }
  return fbmTile(uv, uFreq, uOctaves, uGain);
}

float scalarField(vec2 uv){
  if (uKind == ${KIND.worley}){
    vec2 w = worleyTile(uv, uFreq);
    float pebble = clamp(1.0 - w.x * 1.3, 0.0, 1.0);
    float grain  = fbmTile(uv, uFreq * 4.0, 3, 0.5);
    return shape(mix(pebble, grain, 0.35));
  }
  if (uKind == ${KIND.grime}){
    vec2 wuv = warp(uv, uFreq, uWarp);
    float blot = fbmTile(wuv, uFreq, 5, 0.55);
    float bias = clamp(dot(uv, normalize(uBiasDir + 1e-4)), 0.0, 1.0);
    blot = mix(blot, blot * (0.35 + 0.65 * bias), uBiasAmt);
    // grime reads LIGHT in a roughness map (a stain dulls a surface)
    return mix(0.52, 0.95, smoothstep(0.42, 0.82, blot));
  }
  if (uKind == ${KIND.speckle}){
    vec2 w = worleyTile(uv, uFreq * 4.0);
    float spot = 1.0 - smoothstep(0.0, 0.16, w.x);
    float keep = step(0.84, hash1(floor(uv * uFreq * 4.0)));
    return 0.5 + spot * keep * 0.34;
  }
  // fbm
  return shape(fbmTile(uv, uFreq, uOctaves, uGain));
}

void main(){
  vec2 uv = vUv;
  if (uKind == ${KIND.normal}){
    float e  = 1.5 / uSize;
    float h0 = heightField(uv);
    float hx = heightField(uv + vec2(e, 0.0));
    float hy = heightField(uv + vec2(0.0, e));
    vec3 n = normalize(vec3((h0 - hx) * uNormalStrength, (h0 - hy) * uNormalStrength, 1.0));
    gl_FragColor = vec4(n * 0.5 + 0.5, 1.0);
    return;
  }
  float v = scalarField(uv);
  gl_FragColor = vec4(vec3(v), 1.0);
}
`;

const VERT = /* glsl */ `
varying vec2 vUv;
void main(){
  vUv = uv;
  gl_Position = vec4(position.xy, 0.0, 1.0);
}
`;

function doBake(opts) {
  const {
    size = 512,
    kind = 'fbm',
    profile = 'fbm',
    freq = [8, 8],
    octaves = 5,
    gain = 0.5,
    contrast = 1.0,
    mid = 0.5,
    warp = 0.25,
    biasDir = [0, 1],
    biasAmt = 0,
    normalStrength = 2.0,
    seed = 0,
  } = opts;

  const r = getRenderer();
  r.setSize(size, size);
  const rt = new THREE.WebGLRenderTarget(size, size, {
    depthBuffer: false,
    stencilBuffer: false,
    type: THREE.UnsignedByteType,
    format: THREE.RGBAFormat,
    colorSpace: THREE.NoColorSpace,
  });

  const scene = new THREE.Scene();
  const cam = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
  const mat = new THREE.ShaderMaterial({
    vertexShader: VERT,
    fragmentShader: NOISE_GLSL,
    uniforms: {
      uSize: { value: size },
      uKind: { value: KIND[kind] ?? 0 },
      uProfile: { value: PROFILE[profile] ?? 0 },
      uFreq: { value: new THREE.Vector2(Math.round(freq[0]), Math.round(freq[1])) },
      uOctaves: { value: octaves },
      uGain: { value: gain },
      uContrast: { value: contrast },
      uMid: { value: mid },
      uWarp: { value: warp },
      uBiasDir: { value: new THREE.Vector2(biasDir[0], biasDir[1]) },
      uBiasAmt: { value: biasAmt },
      uNormalStrength: { value: normalStrength },
      uSeed: { value: seed },
    },
  });
  const quad = new THREE.Mesh(new THREE.PlaneGeometry(2, 2), mat);
  scene.add(quad);

  r.setRenderTarget(rt);
  r.render(scene, cam);
  const buf = new Uint8Array(size * size * 4);
  r.readRenderTargetPixels(rt, 0, 0, size, size, buf);
  r.setRenderTarget(null);

  rt.dispose();
  mat.dispose();
  quad.geometry.dispose();

  const tex = new THREE.DataTexture(buf, size, size, THREE.RGBAFormat, THREE.UnsignedByteType);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  tex.colorSpace = THREE.NoColorSpace; // roughness/normal/data — never sRGB
  tex.generateMipmaps = true;
  tex.minFilter = THREE.LinearMipmapLinearFilter;
  tex.magFilter = THREE.LinearFilter;
  tex.anisotropy = 4;
  tex.needsUpdate = true;
  return tex;
}

// Bake (or return cached) a procedural map. Returns a DataTexture, or null if a
// GL context is unavailable — callers must fall back to a canvas texture.
export function bakeTexture(key, opts = {}) {
  if (cache.has(key)) return cache.get(key);
  let tex = null;
  try {
    tex = doBake(opts);
  } catch (err) {
    console.warn('[noise-bake] bake failed for', key, '— falling back to canvas:', err);
  }
  cache.set(key, tex); // cache the null too; one failure means no GL, don't retry
  return tex;
}
