# Video export pipeline — improvement plan

Status: phases 1, 2, 3, 4 and 5 **built** (2026-09-04). Phase 1b (§3) is **on
hold** pending the `spinKey` decision in that section.

What shipped: `player.js` frameSubject/frameTo/projectSubject, `scripts/render.mjs`,
`scripts/finish-video.mjs`, `scripts/caption-style.mjs`, `scripts/verify-video.mjs`,
`scripts/lint-script.mjs`, `scripts/storyboard.mjs`, and the master cache in
`scripts/export-video.mjs`.

Companion to [pipeline-architecture.md](pipeline-architecture.md), which
describes the pipeline as it *is*. This file describes what to change and in
what order. Scope is the per-explainer video path (`video.js` →
`make-narration.mjs` → `export-video.mjs`), not the long-form film path
(`render-film.mjs`) — though phases 1, 1b, 3 and 4 are written so the film renderer
can adopt them later.

---

## 0. The complaints, and what actually causes them

| Symptom | Root cause in the code |
| --- | --- |
| "The model isn't centred in the export — I have to prompt for it" | `frameForViewport()` (`player.js:166`) returns the pose **unchanged** when `isExportRender()` is true. The auto-fit the live mobile site uses (widen FOV → dolly the remainder → lift above the sheet) is switched off for exports. |
| "`dolly` doesn't fix it, so I hand-author camera poses" | `dolly` scales `position` away from `target` along the view axis (`player.js:194`). Because `target` always projects to frame centre, dollying shrinks the subject **and** its off-centre offset proportionally — it can never recentre, only zoom out until the crop stops hurting. |
| "Too many external parameters — follow overlay, short/long, captions" | Every render decision lives in CLI flags spread across two scripts, plus three ask-the-user steps in `export-content`'s SKILL.md. Nothing is recorded per explainer, so every re-render re-litigates the same choices and is not reproducible from the repo alone. |
| "Scripting, wording and caption design are lacking" | Caption design is ~40 magic numbers inlined in the middle of `export-video.mjs`'s render loop (`fontSize`, `capMarginV`, `maxChars`, `HILITE`, the style rows). Script quality is enforced only by a human reading a SKILL.md checklist. Neither is inspectable before you have paid for a full render. |
| "On some explainers the model rotates in the video for no reason, mostly at the open" | The turntable (`spin` in the model state, driven by a step timeline) keeps running during the export. Frame 0 lands two seconds into the lap because of a blind warm-up (`export-video.mjs:287-288`), consecutive shots on one step never reset it, and nothing in `video.js` can say "hold still here". See §3. |

One more problem falls out of the above: **the iterate loop is far too slow.**
Changing one word of narration re-renders every frame from scratch, because
frames, caption burn and audio mix are one monolithic script run.

---

## 1. Invariants — do not regress these

Hard-won behaviour any refactor must preserve. Each was a real bug once.

- **Virtual clock.** `rAF` + `performance.now` are stubbed before page scripts
  run; frames advance via `__vt.advance(ms)`. Any `waitForFunction` added to
  `export-video.mjs` must pass `polling: <interval>`, never the default
  `'raf'` — the default deadlocks.
- **`channel: 'chromium'`** on launch. Playwright's default headless is
  `chrome-headless-shell`, which has no GPU and silently CPU-rasterises WebGL
  at roughly 40× the cost.
- **Audio is the master clock.** One ElevenLabs `/with-timestamps` call per
  format, one continuous take. Never go back to per-shot synthesis.
- **Non-overlapping caption cues.** libass stacks simultaneous same-style
  events, which reads as captions bouncing. Cues are clamped so each ends
  exactly where the next begins.
- **Top-anchored caption block** (`alignment 8` plus computed `capMarginV`) so
  a two-line cue grows downward instead of shoving the baseline up.
- **`loudnorm` to -14 LUFS** on the final mix.
- **Opt-in outward-facing beats.** The end card and the follow-button overlay
  are promises to a viewer. They stay explicit choices, never side effects, and
  the unattended pipeline never applies them. Phase 2 moves *where* the choice
  is recorded, not *whether* it is made.
- **Lazy chunk split.** Nothing in `src/` may static-import an explainer.

---

## 2. Phase 1 — real subject framing

Replaces `dolly` and hand-authored camera poses. **Highest priority:** it
removes the most manual work and unblocks the gates in phase 5.

### Change

After `activate(step)` and before capturing a shot's frames, solve camera
distance and target offset from actual scene geometry instead of from a
hand-guessed scalar.

1. **Collect the subject**, in priority order:
   - the shot's own `frame: ['Callout Text', ...]` if present;
   - else the step's `focus` keys — these already exist on most steps, resolve
     to CSS2D callouts via `el.dataset.key`, and each callout's `.parent` is
     the part group it was added to;
   - else the model root group.
2. **Build the world bbox** (`Box3.setFromObject`) over that set, expanded to
   include the callout anchor points so labels are not framed out. Sample it at
   several phases across the shot's loop and take the union — a subject that
   turns or translates during the lap must be framed for its whole travel, not
   for one instant (see §3).
3. **Solve distance** so the projected bbox fills a target fraction of the
   frame — `fill`, default ~0.82 portrait / ~0.72 landscape — respecting both
   axes (portrait is usually height-bound after the vertical crop).
4. **Recentre by shifting `target`**, not by rotating. A pure translation of
   the rig preserves the viewing angle the pose was composed at — the same
   trick the existing `lift` uses at `player.js:180`.
5. **Feed the solved distance to DoF.** `bokehPass.uniforms.focus` currently
   derives from `frameForViewport(step.camera)`, which in export mode is the
   *unadjusted* pose — so on any dollied shot the subject is focused at the
   wrong distance.

Expose it as `window.__hiw.frameSubject({ keys, fill, format })` in
`player.js`, returning the solved pose, so `export-video.mjs`,
`review-shots.mjs` and `verify.mjs` share one implementation.

### Authoring impact

`dolly` and per-shot `camera` become **escape hatches**, not the default. Keep
both: `camera` for deliberate art direction (a shot composed off-centre on
purpose), `dolly` as a manual override of the solved `fill`.

Migrate `automatic-transmission/video.js` first — it currently carries four
hand-tuned `camera` poses from the in-flight working-tree change. Those poses
are the regression test: the solver should land close to them without being
told.

### Acceptance

- With every `dolly` and `camera` removed from `automatic-transmission`'s
  short, all seven shots frame at least as well as the hand-tuned version,
  judged from extracted frames.
- The solver is deterministic — same inputs, same pose, every run.

### Risk

Bounding boxes over-estimate for models with thin far-flung geometry (a wire, a
mounting bracket), pushing the camera too far back. Mitigate by preferring the
`focus`/`frame` subset over the model root, and by clamping the solved distance
to a sane multiple of the authored pose's distance.

---

## 3. Phase 1b — deterministic loop phase and spin control

**ON HOLD.** Fixes the model rotating in the export when nothing asked it to —
worst on the opening shot. Everything else in this plan is built; this phase is
parked on the "Reaching the turntable generically" decision below.

### Problem

Many explainers turn the whole model on a turntable during a step: a `spin`
value in the model's state object, driven by a `turn`/`rock` scalar in the
step's timeline (see `heart/index.js:57-59`). Roughly 25 explainers do this. On
the interactive site it is right — the reader is parked on the step and the slow
turn shows the form. In a video it is usually wrong, and it is worst at the top:

- **The opening already has motion.** The camera fly-to runs over the shot's
  first ~1.6s and the title card burns over the first 5s. A turntable turning
  underneath a moving camera compounds into a drift that reads as wobble, not
  as a reveal.
- **The starting angle is arbitrary.** The exporter calls
  `activate(shots[0].step)` and then advances `fps * 2` frames of virtual
  warm-up before frame 0 (`export-video.mjs:287-288`). Frame 0 therefore catches
  the model two seconds into its lap, at whatever angle that lands on — not the
  angle the `camera` pose was composed against.
- **It accumulates across shots.** `activate()` is a no-op when consecutive
  shots share a step, so the step's timeline runs straight through. By the
  fourth shot on one step the model sits at an unrelated orientation, and
  nothing in `video.js` says so.
- **`shot.speed` scales it too.** A shot that slows the scene clock also slows
  the spin, so the same step turns at different rates in different shots.

### Change

1. **Deterministic phase per shot.** Add `phase: 0.0–1.0` to a shot. At shot
   start, pause the step's timeline and `seek(lap * phase)` before capture,
   using `rt.tl.iterationDuration` — the exact mechanism
   `review-shots.mjs:120-131` already uses to make its captures reproducible.
   Default `phase: 0`, so a shot begins where the loop was authored to begin.
   This, not a blind two-second warm-up, becomes what decides frame 0.

2. **Explicit spin per shot.** Add `spin` to a shot:
   - `spin: 0` — hold orientation for the whole shot. The mechanism still runs;
     only the turntable is pinned.
   - `spin: 1` — whatever the step does, unchanged.
   - any number — scale it.

   **Default to `spin: 0` on the first shot of a video** (and on any shot whose
   step is shared with the previous one, where the accumulated angle is
   meaningless). Every other shot defaults to `1`, so no existing export
   changes behaviour unless it opts in.

3. **Never spin under a fly-to.** While the camera is moving — the shot's first
   `FLY_SECONDS` — hold the turntable regardless of `spin`, then ease it back
   in. One moving thing at a time.

4. **Reaching the turntable generically.** `spin` is a per-explainer naming
   convention, not framework state, so the exporter cannot guess it. Preferred
   fix: declare it once per explainer (`spinKey: 'spin'` in `video.js`, or a
   `turntable` handle exposed by the model). Fallback for the fly-to hold only:
   pause the step timeline, which also freezes the mechanism and is therefore
   acceptable for ~1.6s but not for a whole shot.

   This is the one decision in this phase that needs a call before
   implementation. The plan's preference is the opt-in `spinKey`, because it
   requires no change to the 25 explainer files that already work.

### Interaction with Phase 1

A rotating subject changes its projected bbox over the lap. Phase 1's solver
must therefore frame against the **union of the bbox sampled across the shot's
lap** (8 phases is plenty), not a single instant — otherwise a model framed
tight at phase 0 crops at phase 0.4. Where `spin: 0` pins the shot, one sample
is enough and the framing can be correspondingly tighter, which is a second
reason to prefer a held opening shot.

### Acceptance

- The opening shot of every export holds a fixed orientation while the camera
  flies in and the title card is up.
- Re-running an export twice produces identical frames — the arbitrary warm-up
  angle is gone.
- No existing explainer's export changes except at the shots that opt in.

---

## 4. Phase 2 — declarative `render` config

Kills the flag juggling.

### Change

One block in `video.js`, committed to the repo, that is the source of truth for
what this explainer's exports are:

```js
render: {
  formats: ['short', 'long'],
  captions: true,
  titleCard: true,
  endCard:       { short: true,  long: false },
  followOverlay: { short: true,  long: false },
  captionStyle: 'bold-karaoke',   // phase 4
  voice: '<elevenlabs-id>',       // else VOICE_ID from .env
  fps: 30,
}
```

Then a single entry point:

```
node scripts/render.mjs <id>                              # everything the config declares
node scripts/render.mjs <id> --format short --no-captions # one-off override
```

`render.mjs` orchestrates narration → frames → caption burn → follow overlay →
postkit, per declared format. Existing flags survive as overrides; the config is
what makes a re-render reproducible without re-asking three questions.

### Guardrail preserved

Writing `endCard` or `followOverlay: true` into the file **is** the explicit
human choice the current ask-first rule protects — it lands in a reviewable
diff rather than in shell history. Absent config still means off, and
`explainer-to-video` still never applies either.

### Files

`scripts/render.mjs` (new); `export-video.mjs` and `make-narration.mjs` read
the config as flag defaults; `.claude/skills/export-content/SKILL.md` — Step 0's
three questions collapse into "write or confirm the `render` block".

---

## 5. Phase 3 — cache the master, split burn from render

Biggest win for iteration speed.

### Observation

`<format>-master.mp4` is a pure function of the model, the step definitions, and
the shot list's `step` / framing / timing fields. It does **not** depend on
narration wording, caption text, caption styling, title or end card copy, or the
follow overlay. Yet today a one-word caption fix re-renders every frame.

### Change

1. Hash the master's real inputs (`model.js`, `index.js`, the framing-relevant
   subset of the shot list, fps, viewport, framing-solver version) into
   `renders/<id>/<format>-master.hash`.
2. On re-run, if the hash matches and the master exists, **skip frame capture
   entirely** and go straight to burn + mix.
3. Split the post-frames work into `scripts/finish-video.mjs` (caption burn,
   overlays, audio mix) so it can run standalone against a cached master.
4. `--force-frames` to bypass.

Caveat: shot **durations** come from the audio, so a narration change that
alters timings does change the master. The hash must include the timings file's
content, not just the script text — a re-worded line of identical duration is
rare enough that this is honest rather than clever.

### Also in this phase

- Render `short` and `long` concurrently (independent browser contexts) rather
  than sequentially.
- Reuse a warm dev server across runs instead of paying Vite's cold three.js
  compile per invocation.

### Acceptance

Editing one caption word and re-running finishes in seconds, not minutes.

---

## 6. Phase 4 — caption design as a themeable module

### Change

Extract every caption constant out of the render loop into
`scripts/caption-style.mjs`, exporting named presets:

- `bold-karaoke` — the current look: Arial Black, active-word highlight, 1–4
  words per group on shorts.
- `clean-lower-third` — quieter, phrase-grouped, no per-word highlight.
- `minimal` — small, low-contrast, long-form only.

Each preset is a function of `(format, viewport)` returning font, sizes,
margins, alignment, grouping caps (`maxWords`, `maxChars`) and the ASS style
rows. Selected via `render.captionStyle`.

**Promote the measurement, don't re-guess it.** `maxChars` is 18/44 today
because it was measured empirically once (a since-deleted `*.tmp.mjs` probe). A
preset that changes font or size invalidates those numbers. Make the width solve
part of the preset: measure the chosen face at the chosen size, derive the cap,
cache it.

### Editorial hooks

Give `video.js` a way to express caption intent, per the `captions-overlay`
doctrine (rail / drop / embed):

```js
captionHints: {
  drop: ['you know', 'basically'],        // spoken but not shown
  embed: ['one ratio makes every gear'],  // promoted to a large held card
}
```

Scarce by design — `embed` is a climax device, one per video at most.

---

## 7. Phase 5 — gates and preview

Catch defects before they cost a render.

### 7a. Framing gate

Reuse phase 1's projection in `verify.mjs` (or a new `verify-video.mjs`): for
each shot, project the subject bbox at the shot's solved pose and fail on crop
(any corner outside the frame), under-fill (below ~0.5), or off-centre (centroid
beyond ~12% from frame centre without an explicit `camera` override). Same shape
as the existing `label-visibility` gate. "Not centred" stops being something you
discover in the finished MP4.

### 7b. Caption gates

- Rendered width per cue group at the real font — fail on overflow rather than
  letting libass silently wrap and shift the block.
- Caption-vs-subject collision, using the same projected bbox.
- Caption-vs-callout collision (callout rects are already projected by the
  existing label gate).

### 7c. Script lint

A non-blocking `scripts/lint-script.mjs <id>`, run **before** the ElevenLabs
call, checking `video.js` narration against the `video-scripting` checklist:

- hook over 12 words;
- "and then" / "next," connectives where ABT tissue belongs;
- standalone one-fact lines that don't hand off into the next shot;
- the stat not isolated on its own shot;
- no planted loop closed in the button;
- optionally piped through the `humanizer` skill's patterns.

Warnings only. The point is catching the wording class of defect before paying
for synthesis and a render.

### 7d. Determinism gate

Re-render the first two seconds of shot 0 twice and compare frame hashes. They
must match. This is the cheap standing check that §3's phase seek is actually
deciding frame 0 — if a blind warm-up or a free-running turntable creeps back
in, this fails immediately instead of shipping a wobbling opening.

### 7e. Storyboard contact sheet

Extend `review-shots.mjs` to emit one image per explainer: a frame per shot at
its solved pose, with that shot's planned caption and narration printed
underneath. Framing, copy and caption reviewed together, once, before committing
to a 30fps run.

---

## 8. Sequencing

| Phase | Delivers | Depends on |
| --- | --- | --- |
| 1 — subject framing | No more hand-authored camera poses | — |
| 1b — phase + spin control | No unwanted rotation; identical frames on re-run | pairs with 1 |
| 3 — master cache + split | Seconds-not-minutes iteration | — (independent of 1) |
| 2 — declarative config | Reproducible, flag-free renders | 1 (so `dolly` is off the surface) |
| 4 — caption presets | Iterable caption design | 2 (for `captionStyle`) |
| 5 — gates + storyboard | Defects caught free | 1, 4 |

Phases 1 and 3 are independent and are the two worth doing first — 1 for output
quality, 3 because it makes every later phase cheaper to iterate on. Do 1b in
the same pass as 1: the framing solver needs the loop-phase control anyway, and
the two together are what make an export deterministic.

---

## 9. Explicitly out of scope

- Changing the live interactive site's framing. `frameForViewport`'s mobile
  path is tuned (`SUBJECT_W = 0.54`) against real review-shots and stays as is;
  phase 1 adds an export-only path beside it.
- Zoom/pan controls (CLAUDE.md rule 7).
- Rewriting the film pipeline. Adopt phases 1/3/4 there afterwards if they hold.
- Any autonomous "re-render until it looks right" loop. The 2-cycle review cap
  and human sign-off stay.
