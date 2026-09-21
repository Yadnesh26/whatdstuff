# Texture realism plan

Goal: kill the "tiled, uniform, born-in-a-computer" look of the current
procedural surfaces without leaving the stack. WebGLRenderer stays; no
WebGPURenderer / vgpu runtime migration (see § G for why). Every phase folds
into `src/framework/textures.js` / `parts.js` as a shared preset — consistency
across ~75 explainers beats peak fidelity on one.

Complements `polish-explainer` (that skill owns per-explainer material/geometry
passes; this plan owns the shared texture *engine* under it). Where they touch,
this doc wins and the skill's Rung 3 gets updated.

## Implementation status (2026-09-08)

Phases 1–4 built as shared framework:

- `src/framework/noise-bake.js` — GPU FBM / Worley / domain-warp / normal-from-
  height baked once to a DataTexture via a dedicated tiny renderer. `bakeTexture(key, opts)`.
- `src/framework/surface.js` — `tuneTiling`, `triplanar`, `detailNormal`,
  `macroVariation`, `locatedWear`, `varyInstances`, `enhance`. All opt-in,
  idempotent per material, chain safely.
- `textures.js` — `brushedMap` / `castMap` / `grimeMap` / their normal maps now
  bake FBM/Worley (canvas generators kept as fallback). New: `detailNormalMap`,
  `macroFieldTexture`, `dustMap`. Baked maps are tuned CONSERVATIVELY (mean
  roughness ≥ the old canvas base, gentle normals) so no explainer regresses its
  clipped-pixel budget on the swap.
- `parts.js` v2 presets take an optional trailing `fx` object → `surface.enhance`.
- `geometry.js` `bladeRing` auto-applies `varyInstances` when the material has maps.

Verified `VERIFY PASS`: `website` (0 clipped px), `mechanical-watch` (the strict
reflective pilot — baseline worst 99, after ≤122, under the 150 limit).
`jet-engine` fails `clipping` but was ALREADY failing pre-change (baseline worst
400) and the new maps improved it (→232). Triplanar / macro / wear / detail are
compiled and available but not yet applied by any explainer.

**Still outstanding (the rollout, § "Rollout order"):** apply the Phase 1
helpers per explainer cheapest-first with a per-step clipped-pixel scan each
time; a full 75-explainer sweep has not been run. Phase 0's tiling probe and the
Phase 5 offline baker are not built.

## Why the current textures read as fake

`src/framework/textures.js` today:

- Every map is a **256×256 `CanvasTexture`** with `RepeatWrapping` and **no
  `repeat` set** — on any surface bigger than ~0.5 m the tile repeats visibly,
  and texel density swings wildly part to part.
- The "noise" is **`for`-loops of random arcs/lines** — white-noise grain, not
  a material. No FBM, no Worley, no domain warp, so it has one frequency and
  reads as digital dirt (the skill itself says "uniform noise reads as dirt").
- **No triplanar** — box/cylinder UVs stretch on non-square faces and seam at
  UV edges.
- **No macro variation** — nothing at a scale larger than the tile, so large
  panels look flat and identical.
- **No per-instance variation** — 70 instanced keyboard keys / fan blades all
  sample the exact same texel pattern.
- Gradient maps (`makeBackdrop`, `heatBlueMap`, contact shadow) have **no
  dither** — fine on the live WebGL site, banded in export.

## Phase 0 — Instrument first (½ day)

1. **Offender audit.** Grep `roughnessMap|normalMap|\.map =` across
   `src/explainers/*/model.js`; for each hit note surface size and whether a
   step camera gets close. The large-flat-and-close surfaces are the whole
   problem set — everything else is fine as-is and should be left alone.
2. **Tiling probe.** `scripts/texture-tiling.tmp.mjs`: per explainer, frame the
   largest flat surface at a grazing angle, render at 30%/60% loop phase, save
   a shot. Optional autocorrelation peak = a number to regress against; the
   shot alone is enough to start.
3. **Frame-cost baseline** per explainer (recipe in `polish-explainer` § "Frame
   cost budget"). The ≤ 10 ms ceiling gates every phase below.

## Phase 1 — Kill tiling in place (no new deps, biggest immediate win)

Ordered by return. One rung at a time, verify block after each (§ F).

1. **Consistent texel density.** `parts.js` helper
   `tuneTiling(mesh, texelsPerMeter = 300)` — reads the mesh's world bbox, sets
   `map.repeat`/`normalMap.repeat` so every surface lands ~250–350 px/m instead
   of stretched. Applies to the existing canvas maps unchanged. Cheapest fix,
   removes the worst "smeared" cases on its own.
2. **Triplanar projection.** Shared `makeTriplanarMaterial(base, { scale })` in
   `parts.js` — `onBeforeCompile` injection that samples the map three times in
   object space (x/y/z planes) and blends by `abs(normal)`. Kills seams and
   stretch on every `BoxGeometry`/`CylinderGeometry` procedural surface. This
   is the single biggest structural fix; do it right after texel density.
   Cost: 3× map samples in the fragment shader on affected materials only —
   measure against the 10 ms ceiling, expect it to be cheap since these are
   small maps.
3. **Per-instance UV variation.** For `InstancedMesh` greebles: an
   `instanceUvOffset` attribute (random offset + 90° rotation quantum per
   instance) added in `onBeforeCompile`. 70 keys stop looking like 1 key
   stamped 70 times. Wire it into the existing instancing helpers
   (`bladeRing`-style) so it's automatic.
4. **Second-frequency detail normal.** `detailNormal(scale = 8)` mixed into the
   base normal in the same injection as triplanar (three takes one
   `normalMap`, so combine in-shader, don't stack slots). Breaks the
   single-scale look — micro-structure at 8× plus the base grain.

Deliverable: `air-conditioner`, `website`, `mechanical-watch` re-shot
before/after. Fold helpers into `parts.js`; document in add-explainer's
model.js conventions.

## Phase 2 — Real procedural noise, GPU-baked at init (no new deps)

Replace the canvas `for`-loop grain with actual noise, still zero downloaded
assets.

- **`src/framework/noise-bake.js`** — a one-time `WebGLRenderTarget` +
  fullscreen-quad pass, rendered once at stage init, result cached like the
  canvas maps are now. GLSL library: value/Perlin/simplex noise, **FBM**
  (4–6 octaves), **Worley/cellular**, **domain warp**, curl. Output is a plain
  `THREE.Texture` that drops into `roughnessMap`/`normalMap`/`map` slots with
  no other change. Nothing is read back to the CPU.
- **Port the existing maps** to it: `brushedMap` → anisotropic stretched FBM;
  `castMap` → Worley + FBM pebble; `grimeMap` → domain-warped blotch with the
  directional bias kept. Domain warp makes them **non-periodic across the
  tile**, so they're seam-free even without triplanar — Phase 1.2 and this
  compound.
- **New maps Rung 3 always wanted** but had no good generator for: dust
  speckle (up-facing only), located wear via a cavity/edge mask, anisotropic
  flow noise for brushed directions.
- **Dither in the bake.** Blue-noise / ordered Bayer baked into gradient maps
  (`makeBackdrop`, `heatBlueMap`, contact shadow) kills the export banding at
  source instead of in the export pipeline's deband pass.

Bake budget: 512² per map, a handful of maps, one frame at startup — target
< 3 ms added to first-frame cost, 0 ms steady-state. If a map needs 1–2 k for a
macro step, that's the Phase 5 trigger, not a reason to bake big every time.

## Phase 3 — Macro variation & located wear (the "used, not noisy" layer)

- **Low-frequency multiply.** One large-scale FBM (period ≈ whole model)
  multiplied ±8 % over albedo and ±0.05 over roughness on every shared
  material. Panel-to-panel tint drift; large soft unevenness. This is what
  separates "clean product" from "flat CG".
- **Curvature / cavity mask.** Bake a cheap AO+curvature map (or reuse GTAO's
  buffer) → grime pools in cavities, wear rubs off convex edges. Generalizes
  `grimeMap`'s hand-authored directional bias into geometry-driven placement.
- **Contact-point wear.** Per explainer, one or two decal-style wear spots
  where the *mechanism* says hands/heat/oil go (watch crown, tool handle,
  fastener rings). 10–20 % visible; halve on a "looks dirty" screenshot note.

## Phase 4 — Micro-geometry that reads as texture

Mostly `polish-explainer` Rung 1 — cross-referenced here, not duplicated:

- Fillets/chamfers everywhere (biggest real-vs-CG tell), via geometry where the
  camera is close, via normal map on instanced greebles where it isn't.
- Subtle `displacementMap` from the cast/Worley bake on parts a step frames
  tight — only there, and only if it stays inside the frame budget.

## Phase 5 — Optional: offline high-res baker (where vgpu would earn its place)

Only if Phase 2's runtime 512² bake proves visibly insufficient on hero /
macro steps. Decision checkpoint, not a commitment.

- `scripts/make-maps.mjs` using **`vgpu/node`** (Dawn headless) → deterministic
  2 k/4 k PNG map sets per explainer into `public/maps/<id>/`, checked in
  exactly like `public/plates/*.jpg`. Loaded per explainer, so the lazy chunk
  split is unaffected.
- Lift FBM/Worley/OKLab-palette math from `@vgpu/wgsl-std` (`noise`, `hash`,
  `color`) and `@vshaders/color` (perceptual mixing, cosine palettes) rather
  than the runtime — the WGSL functions are the reusable part.
- Cost to weigh: vgpu is 0.x with a history of full API rewrites (0.1→0.2 was a
  rewrite; current 0.3.x). A build-time-only dep that emits PNGs is low blast
  radius, but it's still a dep. Don't adopt it for the runtime.

Rejected alternative: switching the framework to `WebGPURenderer` + TSL so
vgpu's `three-tsl` bridge (`tslExports()` → `MeshPhysicalNodeMaterial` slots)
applies live. That's a renderer migration on a 0.x library, against CLAUDE.md
rule 4, for no win Phases 1–3 don't already get.

## F — Validation (after every rung)

Reuses `polish-explainer` § Verify:

1. `node scripts/verify.mjs <id>` → `VERIFY PASS`.
2. Clipped-pixel scan at every step camera (roughnessMap multiplies, triplanar
   adds samples, detail normal adds specular — all move energy around).
3. Frame cost ≤ 10 ms; draw calls not ballooned.
4. Loops still seamless; the per-explainer lazy chunk still emits.
5. Tiling probe (Phase 0.2) re-shot — the grazing-angle surface must show no
   periodic repeat.
6. Screenshot round with the user for the aesthetic verdict.
7. On sign-off, regenerate the library plate:
   `node scripts/make-plates.mjs --only=<id>`.

## Rollout order

1. Build the Phase 1 + 2 engine against **`website`** and **`mechanical-watch`**
   (most flat + reflective close-up geometry — survives there, safe anywhere).
2. Fold every survivor into `parts.js` / `textures.js` as a preset; update the
   `textures.js` header comment, `polish-explainer` Rung 3, and add-explainer's
   model.js conventions.
3. Sweep the rest cheapest-first (table-fan → AC → engines), Phase 1 only,
   then a second pass for Phases 2–3 on explainers whose step cameras get
   close.
4. Phases 3–5 are per-explainer appetite, not a blanket sweep.

## Definition of done

A grazing-angle shot of the largest flat surface in any explainer shows no
visible tile repeat, no uniform-grain sheen, and large-scale unevenness — and
`verify.mjs` + the clipped-pixel scan + the 10 ms budget all still pass.
