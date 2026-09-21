# whatdstuff

Voice, values, and the quality bar live in SOUL.md — read it before writing
any user-facing copy (step text, summaries, hooks, narration) or judging
whether a scene is finished. This file covers only how to work.

Interactive 3D "how X works" explainers. Scroll navigates between steps; each
step's mechanism runs as a seamless real-time loop. Three.js (rendering) +
anime.js v4 (timelines) + Vite. Fully procedural models — no external 3D
assets, ever.

## Commands (Windows — call node by absolute path; shell cwd drifts)

- Dev server (review-shots needs it running):
  `& "C:\Program Files\nodejs\node.exe" node_modules/vite/bin/vite.js --port 5174`
- Build — run from the repo root BEFORE calling any change done. The dev
  server masks duplicate-identifier errors (blank page, zero console output),
  and the chunk list is the lazy-split proof:
  `& "C:\Program Files\nodejs\node.exe" node_modules/vite/bin/vite.js build`
  `npm run build` also runs `scripts/prerender.mjs` afterward, which writes a
  real `dist/<id>/index.html` per explainer/category (title, description,
  canonical, step copy as text) plus `dist/sitemap.xml` — see
  `docs/seo-plan.md` § F1. It reads step copy by regex off each `index.js`
  SOURCE FILE rather than importing it, specifically so it can never trigger
  the lazy-split regression in rule 2 below.
- Explainer verification (THE gate — self-starts the dev server, runs the
  build, probes loops/clipping/labels/label-visibility/navigation in headless
  Chromium): `node scripts/verify.mjs <explainer-id>` → must print
  `VERIFY PASS`. The `label-visibility` gate fails the build on any callout
  hidden under the text panel or off-frame (projected at the 30%/60% poses).
- Step screenshots — the only reliable way to SEE the app (the IDE preview
  tab is compositor-throttled; `preview_screenshot` always times out):
  `node scripts/review-shots.mjs <id> [outDir] [port] [--steps=2,5] [--half] [--no-sheet]`
  Captures are deterministic (loops seeked to 30%/60% per step); a full run
  emits `contact-sheet.png` by default (one image = whole-explainer review).
  Iterate with `--steps` + `--half`; full-res full set only for final passes.
- Video export / TTS narration: `scripts/export-video.mjs`,
  `scripts/make-narration.mjs` (per-explainer editorial lives in `video.js`).
- Long-form FILM (6–12 min, spans several explainers — a different product from
  the per-explainer video): `scripts/render-film.mjs <film-id> [--acts 0 --fps 8]`,
  `scripts/make-film-narration.mjs` (one take per act), `scripts/make-sfx.mjs`
  + `scripts/make-music.mjs` (ElevenLabs sound + music generation).
  Editorial lives in `films/<film-id>/film.js`;
  see `films/README.md`. ALWAYS smoke-render one act at `--fps 8` first.
- For checks verify.mjs doesn't cover, ad-hoc Playwright probes live under
  `scripts/` (module resolution); name them `*.tmp.mjs`, delete when done.

## Map

| Path | Role |
| --- | --- |
| src/main.js | path router: `/` library · `/about` · `/<category>` · `/<id>` (falls back to legacy `#/<id>` hash for old links + tooling) |
| src/categories.js | category tree; explainers list theirs in meta.js |
| src/chrome.js | shared page chrome: masthead, footer, credit gears, procedural surfaces (home + about) |
| src/about.js, about-copy.js | the about page; copy lives in the pure data module so prerender.mjs renders the same words |
| src/framework/registry.js | auto-globs explainer folders; eager meta.js, lazy index.js |
| src/framework/player.js | step activation, camera fly-tos, panels, progress rail |
| src/framework/stage.js | renderer, camera, studio HDRI + lights, GTAO/bloom/DoF, shadow floor |
| src/framework/parts.js, geometry.js, textures.js, labels.js | shared procedural toolkit + CSS2D callouts |
| src/framework/motion.js, callouts.js | pose-math helpers (profileTable etc.) + callout-set registry — import, don't re-implement |
| src/explainers/\<id\>/ | meta.js (eager card) · index.js (steps) · model.js (3D) · video.js (export only) |
| films/\<film-id\>/film.js | long-form film manifest: acts → shots across explainers (outside src/ — not bundled) |
| assets/sfx/, assets/music/ | generated sfx cues (shared with shorts) + music beds |
| scripts/ | Playwright/FFmpeg export + review tooling |

## Rules

1. **Use the skills.** New/reworked explainer → `add-explainer`; fidelity
   pass → `polish-explainer`; QA → `review-explainer` (run it via the
   `explainer-reviewer` agent in a fresh context); LONG-FORM FILM →
   `film-scripting` + `sound-design` + `film-production` (the whole thing via
   the `film-director` agent); video script/narration →
   `video-scripting`; video render → `export-content`; the whole chain in one
   unattended run → `explainer-to-video` (via the `explainer-pipeline` agent).
   They encode every hard-won convention — don't freelance the workflow.
   **Hard brakes:** the reviewer loop caps at 2 cycles (then findings go to
   the user); `polish-explainer` and video export run ONLY on explicit
   user request — never auto-chained after a build. The ONE carve-out:
   invoking `explainer-to-video` is itself that explicit request, and
   authorizes the build→verify→review→script→render chain for that run only.
   It never authorizes `polish-explainer`.
2. **One folder per explainer, zero registration.** `id` === folder name; the
   registry globs it. Never static-import an explainer from shared code: if
   `vite build` stops emitting `dist/assets/<id>-*.js`, the lazy split broke
   and the whole library pays for it.
3. **meta.js stays tiny** (id/title/summary/accent/categories) — it is bundled
   eagerly for the library grid, for every explainer, on every visit.
4. **The framework is shared.** Never bend stage/player/parts to one
   explainer's needs — put special behavior in that explainer's model.js.
   Scene lighting lives in stage.js only.
5. **Loops are seamless and single-owner.** Every step timeline returns to an
   identical pose at wrap (whole turns/cycles per lap) and drives the model
   through ONE local state object; two timelines tweening the same property
   silently kill each other (anime.js tween composition).
6. **Verify with evidence, not vibes**, before reporting done:
   `node scripts/verify.mjs <id>` must print `VERIFY PASS` (it codifies all
   the mechanical gates), and the review-shots screenshots must have been
   LOOKED AT — framing, occlusion, proportion, and copy-vs-visual truth are
   judged by eyes, not scripts. Self-review against the screenshots BEFORE
   spawning the reviewer; a defect found there is free, one found in a review
   round costs a whole cycle.
7. **Controls stay rotate-only.** No zoom/pan — the wheel must scroll the
   page. Any new full-viewport overlay needs `pointer-events: none`.
8. **Material/reveal traps are the #1 time sink** — before the first render
   run the pre-flight checklist in the add-explainer skill (transmission glass
   hides transparent contents; clearcoat ignores opacity; metal can't be
   ghosted, hide it; every `onEnter` must pin ALL state incl. turntable spin;
   no callout in the panel's left ~38%). These are enforced where scriptable
   (verify.mjs) but most are yours to check.
9. **Headless tooling must `scrollIntoView` a step before rendering/projecting**
   — the player's canvas only gets correct layout/aspect once its section is
   scrolled in (both review-shots and verify.mjs do this). CSS2D callout DOM
   rects go document-space under scroll; project world anchors through the
   camera instead (see verify.mjs's label gate).
10. **Secrets:** `.env` holds TTS API keys — gitignored; never commit or print.

## Planning docs

- `docs/roadmap.md` — distilled feature/idea backlog; check it before
  proposing new platform features (it records what's open vs already built,
  and which ideas conflict with the rules above).
- `docs/audience-capture-plan.md` — distribution/SEO/email-capture plan; read
  it before any marketing, OG/meta, routing, or analytics work.
