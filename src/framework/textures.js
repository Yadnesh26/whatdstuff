import * as THREE from 'three';
import { bakeTexture } from './noise-bake.js';

// Procedural surface maps — zero downloaded assets, cached.
// Two realism gaps these close:
//  1. Perfectly uniform roughness is a dead giveaway of CG — brushedMap/castMap
//     break it with grain, but a flat surface with only roughness variation
//     still reads flat under raking light. Normal maps add the micro-bumps
//     that make brushed/cast metal actually catch highlights per-texel.
//  2. Uniform noise still looks generated — real wear is LOCATED (grime pools
//     at the bottom of a case, gets rubbed off high-touch edges). grimeMap
//     biases its blotches toward one edge instead of scattering evenly.
//
// The grain-bearing maps (brushed/cast/grime + detail/dust/macro) are now
// GPU-baked FBM / Worley / domain-warp via noise-bake.js — non-periodic across
// the tile, so a large flat surface no longer shows an obvious repeat (see
// docs/texture-realism-plan.md Phase 2). Each keeps its old canvas generator as
// a fallback for any context without a GL bake renderer.

const cache = new Map();

function canvasTexture(key, w, h, draw) {
  if (cache.has(key)) return cache.get(key);
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  draw(canvas.getContext('2d'), w, h);
  const tex = new THREE.CanvasTexture(canvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set(key, tex);
  return tex;
}

// Architectural cast concrete (use as the colour `map`) — for the big shells a
// power-station scene is mostly made of: containment domes, cooling towers.
// Three things make a large concrete surface read as a STRUCTURE rather than a
// grey shape: the horizontal construction joints between pour lifts, the rain
// streaking that runs down from each joint, and broad tonal blotching from
// uneven curing.
//
// ALBEDO ONLY, deliberately. Roughness and normal maps of the same structure
// were built first and measured: on a near-diffuse surface at building scale
// neither survives to the pixel (a 3px joint is sub-pixel once tiled, and there
// is almost no specular left at roughness ~0.9 for a roughnessMap to modulate),
// while the three fetches together cost 9 -> 35 ms/frame on two frame-filling
// shells. Colour is the only channel that carries at this distance.
//
// Near-white base, so a material's own `color` still sets the overall tone.
// Tiles seamlessly across X (the wrap direction on a lathe); callers set
// `repeat` to suit the surface's real size — note that a repeat.y above 1
// stacks each tile's streaks onto the tile below and the pair reads as one
// continuous rib, so keep vertical tiling at 1 on a tall shell.
export function concreteAlbedoMap() {
  if (cache.has('concrete-albedo')) return cache.get('concrete-albedo');
  const w = 256;
  const h = 256;
  const canvas = document.createElement('canvas');
  canvas.width = w;
  canvas.height = h;
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#ececec';
  ctx.fillRect(0, 0, w, h);

  // broad curing blotches, wrapped in X so the tile joins cleanly
  for (let i = 0; i < 22; i++) {
    const x = Math.random() * w;
    const y = Math.random() * h;
    const r = 20 + Math.random() * 55;
    const v = 150 + Math.random() * 60;
    for (const dx of [0, -w, w]) {
      const g = ctx.createRadialGradient(x + dx, y, 0, x + dx, y, r);
      g.addColorStop(0, `rgba(${v},${v},${v},0.16)`);
      g.addColorStop(1, `rgba(${v},${v},${v},0)`);
      ctx.fillStyle = g;
      ctx.fillRect(x + dx - r, y - r, r * 2, r * 2);
    }
  }

  // construction joints between pour lifts, and the rain streaks below them
  const LIFTS = 4;
  for (let k = 0; k < LIFTS; k++) {
    const ly = (k / LIFTS) * h;
    ctx.fillStyle = 'rgba(150,152,155,0.45)';
    ctx.fillRect(0, ly, w, 2);
    ctx.fillStyle = 'rgba(238,238,238,0.28)';
    ctx.fillRect(0, ly + 2, w, 2);
    for (let i = 0; i < 13; i++) {
      const x = Math.random() * w;
      const sw = 2 + Math.random() * 7;
      const sh = 15 + Math.random() * 50;
      const g = ctx.createLinearGradient(0, ly, 0, ly + sh);
      g.addColorStop(0, 'rgba(126,129,133,0.14)');
      g.addColorStop(1, 'rgba(126,129,133,0)');
      ctx.fillStyle = g;
      for (const dx of [0, -w, w]) ctx.fillRect(x + dx, ly, sw, sh);
    }
  }

  // aggregate speckle
  for (let i = 0; i < 1800; i++) {
    const v = 150 + Math.random() * 90;
    ctx.fillStyle = `rgba(${v},${v},${v},0.3)`;
    ctx.fillRect(Math.random() * w, Math.random() * h, 1.5, 1.5);
  }

  const tex = new THREE.CanvasTexture(canvas);
  tex.colorSpace = THREE.SRGBColorSpace;
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set('concrete-albedo', tex);
  return tex;
}

// Converts a grayscale height canvas into a tangent-space normal map via a
// Sobel-style neighbor gradient. Shared by every bump-based normal map below.
function heightToNormal(heightCanvas, strength = 1.6) {
  const w = heightCanvas.width;
  const h = heightCanvas.height;
  const src = heightCanvas.getContext('2d').getImageData(0, 0, w, h).data;
  const gray = (x, y) => {
    x = (x + w) % w;
    y = (y + h) % h;
    return src[(y * w + x) * 4] / 255;
  };
  const out = document.createElement('canvas');
  out.width = w;
  out.height = h;
  const octx = out.getContext('2d');
  const img = octx.createImageData(w, h);
  for (let y = 0; y < h; y++) {
    for (let x = 0; x < w; x++) {
      const l = gray(x - 1, y);
      const r = gray(x + 1, y);
      const u = gray(x, y - 1);
      const d = gray(x, y + 1);
      const nx = (l - r) * strength;
      const ny = (u - d) * strength;
      const nz = 1;
      const len = Math.sqrt(nx * nx + ny * ny + nz * nz);
      const i = (y * w + x) * 4;
      img.data[i] = ((nx / len) * 0.5 + 0.5) * 255;
      img.data[i + 1] = ((ny / len) * 0.5 + 0.5) * 255;
      img.data[i + 2] = ((nz / len) * 0.5 + 0.5) * 255;
      img.data[i + 3] = 255;
    }
  }
  octx.putImageData(img, 0, 0);
  return out;
}

// Horizontal brushed-metal streaks (use as roughnessMap). GPU-baked anisotropic
// FBM — many lattice cells along X, few along Y — with the canvas streak
// generator kept as a fallback. Low contrast on purpose: FBM is smoother than
// the old random-arc white noise, so effective roughness variance drops, which
// is SAFE for the clipped-pixel budget.
export function brushedMap() {
  if (cache.has('brushed')) return cache.get('brushed');
  // Conservative shaping: mean roughness held ABOVE the old canvas `#888` base
  // (0.53) and contrast kept low, so on polished-metal close-ups the map never
  // dips shinier than the canvas version did — verified against mechanical-watch
  // (the strictest clipped-pixel pilot).
  const baked = bakeTexture('brushed', {
    kind: 'fbm',
    freq: [96, 10],
    octaves: 5,
    gain: 0.5,
    contrast: 0.22,
    mid: 0.6,
  });
  const tex =
    baked ??
    canvasTexture('brushed-canvas', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#888';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 900; i++) {
        const y = Math.random() * h;
        const v = 100 + Math.floor(Math.random() * 90);
        ctx.strokeStyle = `rgba(${v},${v},${v},0.5)`;
        ctx.lineWidth = 0.6 + Math.random();
        ctx.beginPath();
        const x0 = Math.random() * w;
        ctx.moveTo(x0, y);
        ctx.lineTo(x0 + 30 + Math.random() * 120, y + (Math.random() - 0.5) * 1.5);
        ctx.stroke();
      }
    });
  cache.set('brushed', tex);
  return tex;
}

// Blotchy casting grain (use as roughnessMap on cast housings). GPU-baked
// Worley pebble + fine FBM; canvas dot-spray fallback.
export function castMap() {
  if (cache.has('cast')) return cache.get('cast');
  const baked = bakeTexture('cast', {
    kind: 'worley',
    freq: [9, 9],
    contrast: 0.24,
    mid: 0.6,
  });
  const tex =
    baked ??
    canvasTexture('cast-canvas', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#7d7d7d';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 2600; i++) {
        const v = 90 + Math.floor(Math.random() * 90);
        ctx.fillStyle = `rgba(${v},${v},${v},0.35)`;
        const r = 1 + Math.random() * 3.5;
        ctx.beginPath();
        ctx.arc(Math.random() * w, Math.random() * h, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  cache.set('cast', tex);
  return tex;
}

// Fine directional grooves as an actual normal map — the micro-ridges that
// make brushed metal catch a highlight streak per groove, not just a duller
// average reflection.
export function brushedNormalMap() {
  const cached = cache.get('brushed-normal');
  if (cached) return cached;
  const baked = bakeTexture('brushed-normal', {
    kind: 'normal',
    profile: 'fbm',
    freq: [96, 10],
    octaves: 5,
    gain: 0.5,
    // gentler than the old Sobel-from-canvas (2.2): baked gradients are cleaner
    // and were over-glinting near-mirror parts on the watch pilot
    normalStrength: 1.15,
  });
  let tex = baked;
  if (!tex) {
    const height = document.createElement('canvas');
    height.width = height.height = 256;
    const ctx = height.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 700; i++) {
      const y = Math.random() * 256;
      const v = 90 + Math.floor(Math.random() * 130);
      ctx.strokeStyle = `rgb(${v},${v},${v})`;
      ctx.lineWidth = 0.5 + Math.random() * 0.8;
      ctx.beginPath();
      const x0 = Math.random() * 256;
      ctx.moveTo(x0, y);
      ctx.lineTo(x0 + 40 + Math.random() * 140, y + (Math.random() - 0.5) * 1.2);
      ctx.stroke();
    }
    const normalCanvas = heightToNormal(height, 2.2);
    tex = new THREE.CanvasTexture(normalCanvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  }
  cache.set('brushed-normal', tex);
  return tex;
}

// Blotchy casting-surface bump as a normal map — the pebbly, never-quite-flat
// texture of raw cast aluminum, catching light per bump instead of one even
// diffuse value.
export function castNormalMap() {
  const cached = cache.get('cast-normal');
  if (cached) return cached;
  const baked = bakeTexture('cast-normal', {
    kind: 'normal',
    profile: 'worley',
    freq: [9, 9],
    normalStrength: 0.8,
  });
  let tex = baked;
  if (!tex) {
    const height = document.createElement('canvas');
    height.width = height.height = 256;
    const ctx = height.getContext('2d');
    ctx.fillStyle = '#808080';
    ctx.fillRect(0, 0, 256, 256);
    for (let i = 0; i < 1800; i++) {
      const v = 90 + Math.floor(Math.random() * 130);
      ctx.fillStyle = `rgb(${v},${v},${v})`;
      const r = 1.5 + Math.random() * 4;
      ctx.beginPath();
      ctx.arc(Math.random() * 256, Math.random() * 256, r, 0, Math.PI * 2);
      ctx.fill();
    }
    const normalCanvas = heightToNormal(height, 1.4);
    tex = new THREE.CanvasTexture(normalCanvas);
    tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  }
  cache.set('cast-normal', tex);
  return tex;
}

// Grime/oil staining that pools toward one edge of the UV square (v=1,
// "down" for a standard box/cylinder UV) instead of scattering uniformly —
// the located-wear look of an engine case that actually sees oil and grip.
// Use as a roughnessMap (grime reads rougher/duller) or blended into color.
export function grimeMap() {
  if (cache.has('grime')) return cache.get('grime');
  const baked = bakeTexture('grime', {
    kind: 'grime',
    freq: [5, 5],
    warp: 0.32,
    biasDir: [0, 1],
    biasAmt: 0.85,
  });
  const tex =
    baked ??
    canvasTexture('grime-canvas', 256, 256, (ctx, w, h) => {
      ctx.fillStyle = '#8f8f8f';
      ctx.fillRect(0, 0, w, h);
      for (let i = 0; i < 500; i++) {
        // bias y toward the bottom edge with a squared random — most blotches
        // land low, fewer stray upward, none appear at the very top.
        // Blotches are drawn LIGHT: in a roughnessMap, lighter = rougher, and
        // grime dulls a surface — dark blotches would read as polished spots.
        const t = Math.pow(Math.random(), 0.45);
        const y = h * (0.35 + t * 0.65);
        const x = Math.random() * w;
        const r = 3 + Math.random() * 14 * t;
        const light = 200 + Math.random() * 55;
        const grad = ctx.createRadialGradient(x, y, 0, x, y, r);
        grad.addColorStop(0, `rgba(${light},${light},${light},0.5)`);
        grad.addColorStop(1, `rgba(${light},${light},${light},0)`);
        ctx.fillStyle = grad;
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fill();
      }
    });
  cache.set('grime', tex);
  return tex;
}

// --- Phase 1/3 shared maps (GPU-baked; used by src/framework/surface.js) -----

// Higher-frequency isotropic normal detail, layered on top of the base grain by
// surface.detailNormal() to break the single-scale look. 256² is plenty.
export function detailNormalMap() {
  if (cache.has('detail-normal')) return cache.get('detail-normal');
  const tex = bakeTexture('detail-normal', {
    size: 256,
    kind: 'normal',
    profile: 'fbm',
    freq: [40, 40],
    octaves: 4,
    gain: 0.55,
    normalStrength: 1.2,
  });
  cache.set('detail-normal', tex);
  return tex;
}

// Low-frequency field for surface.macroVariation() — large soft unevenness so a
// big flat panel drifts in tint/roughness instead of reading as one CG value.
export function macroFieldTexture() {
  if (cache.has('macro-field')) return cache.get('macro-field');
  const tex = bakeTexture('macro-field', {
    size: 128,
    kind: 'fbm',
    freq: [3, 3],
    octaves: 3,
    gain: 0.6,
    contrast: 1.0,
    mid: 0.5,
  });
  cache.set('macro-field', tex);
  return tex;
}

// Sparse pale dust speckle for up-facing surfaces (Rung 3). Not wired into any
// preset — compose it into a roughness canvas or use as a light overlay.
export function dustMap() {
  if (cache.has('dust')) return cache.get('dust');
  const tex = bakeTexture('dust', { size: 256, kind: 'speckle', freq: [8, 8] });
  cache.set('dust', tex);
  return tex;
}

// Polymer grip stipple: a jittered grid of small raised dots, as a normal map
// — the aggressive texture moulded into a pistol frame's grip so it stays put
// under recoil. Flat roughness alone reads smooth; the per-dot normal is what
// catches a highlight on each bump as the camera orbits.
export function stippleNormalMap() {
  const cached = cache.get('stipple-normal');
  if (cached) return cached;
  const size = 128;
  const height = document.createElement('canvas');
  height.width = height.height = size;
  const ctx = height.getContext('2d');
  ctx.fillStyle = '#808080';
  ctx.fillRect(0, 0, size, size);
  const rows = 9;
  const cell = size / rows;
  for (let ry = 0; ry < rows; ry++) {
    for (let rx = 0; rx < rows; rx++) {
      const cx = (rx + 0.5) * cell + (Math.random() - 0.5) * cell * 0.5;
      const cy = (ry + 0.5) * cell + (Math.random() - 0.5) * cell * 0.5;
      const r = cell * (0.32 + Math.random() * 0.16);
      const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, r);
      grad.addColorStop(0, '#ffffff');
      grad.addColorStop(0.7, '#a0a0a0');
      grad.addColorStop(1, '#808080');
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(cx, cy, r, 0, Math.PI * 2);
      ctx.fill();
    }
  }
  const normalCanvas = heightToNormal(height, 2.8);
  const tex = new THREE.CanvasTexture(normalCanvas);
  tex.wrapS = tex.wrapT = THREE.RepeatWrapping;
  cache.set('stipple-normal', tex);
  return tex;
}

// Heat-bluing colour gradient for exhaust parts: straw-gold at the hot end,
// through purple and blue, fading to dark steel at the cold end.
//
// direction 'u': varies along X — for TubeGeometry, whose U coordinate runs
//   along the tube's length (first curve point = u0 = hottest).
// direction 'v': varies along Y with the HOT end at v=0 — for CylinderGeometry
//   (V runs along the cylinder axis, v=1 at the original +Y end). CanvasTexture
//   flips Y, so v=0 samples the canvas BOTTOM row — the gradient is drawn
//   bottom-hot for that reason.
export function heatBlueMap(direction = 'u') {
  const stops = [
    [0.0, '#d7b56a'], // straw — right at the hot end
    [0.12, '#e2b04a'], // gold
    [0.28, '#a8683f'], // bronze
    [0.42, '#6e5a8c'], // purple
    [0.58, '#4a6aa0'], // blue
    [0.75, '#5b6570'], // fading blue-grey
    [1.0, '#43474d'], // dark steel — cold end
  ];
  const w = direction === 'u' ? 512 : 8;
  const h = direction === 'u' ? 8 : 512;
  return canvasTexture(`heat-blue-${direction}`, w, h, (ctx) => {
    const grad =
      direction === 'u'
        ? ctx.createLinearGradient(0, 0, w, 0)
        : ctx.createLinearGradient(0, h, 0, 0); // bottom (v=0, hot) → top
    for (const [t, c] of stops) grad.addColorStop(t, c);
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, w, h);
  });
}

// Warm laminated-wood grain as a COLOUR map — long streaky fibres in varied
// browns with a few darker grain bands, the look of varnished rifle/tool
// furniture. Streaks run along the canvas X, so with a standard box UV the
// grain runs down the part's length (rotate the texture per part if not).
export function woodGrainMap() {
  return canvasTexture('wood-grain', 512, 128, (ctx, w, h) => {
    ctx.fillStyle = '#6e3c1d';
    ctx.fillRect(0, 0, w, h);
    // long fibre streaks
    for (let i = 0; i < 1400; i++) {
      const y = Math.random() * h;
      const shade = Math.random();
      const c =
        shade < 0.5
          ? `rgba(${120 + Math.random() * 40},${66 + Math.random() * 26},${30 + Math.random() * 18},0.35)`
          : `rgba(${64 + Math.random() * 24},${34 + Math.random() * 16},${16 + Math.random() * 10},0.4)`;
      ctx.strokeStyle = c;
      ctx.lineWidth = 0.6 + Math.random() * 1.6;
      ctx.beginPath();
      const x0 = Math.random() * w;
      const len = 80 + Math.random() * 260;
      ctx.moveTo(x0, y);
      ctx.bezierCurveTo(
        x0 + len * 0.33, y + (Math.random() - 0.5) * 3,
        x0 + len * 0.66, y + (Math.random() - 0.5) * 3,
        x0 + len, y + (Math.random() - 0.5) * 4,
      );
      ctx.stroke();
    }
    // a few broad darker grain bands
    for (let i = 0; i < 5; i++) {
      const y = Math.random() * h;
      ctx.strokeStyle = `rgba(48,24,10,0.28)`;
      ctx.lineWidth = 2.5 + Math.random() * 3.5;
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.bezierCurveTo(w * 0.33, y + (Math.random() - 0.5) * 10, w * 0.66, y + (Math.random() - 0.5) * 10, w, y + (Math.random() - 0.5) * 8);
      ctx.stroke();
    }
  });
}

// Procedural smudges/fingerprints for glossy surfaces. Use as a
// clearcoatRoughnessMap or mixed into standard roughness.
export function smudgeMap() {
  return canvasTexture('smudge', 512, 512, (ctx, w, h) => {
    // Base roughness
    ctx.fillStyle = '#111';
    ctx.fillRect(0, 0, w, h);
    
    for (let i = 0; i < 400; i++) {
      const x = Math.random() * w;
      const y = Math.random() * h;
      const r = 2 + Math.random() * 8;
      
      // Ellipses simulate fingerprint presses
      const scaleX = 0.8 + Math.random() * 0.4;
      const scaleY = 0.4 + Math.random() * 0.8;
      const rotation = Math.random() * Math.PI;

      ctx.save();
      ctx.translate(x, y);
      ctx.rotate(rotation);
      ctx.scale(scaleX, scaleY);
      
      const v = 40 + Math.floor(Math.random() * 60);
      const grad = ctx.createRadialGradient(0, 0, 0, 0, 0, r);
      grad.addColorStop(0, `rgba(${v}, ${v}, ${v}, 0.3)`);
      grad.addColorStop(1, `rgba(${v}, ${v}, ${v}, 0)`);
      
      ctx.fillStyle = grad;
      ctx.beginPath();
      ctx.arc(0, 0, r, 0, Math.PI * 2);
      ctx.fill();
      ctx.restore();
    }
  });
}
