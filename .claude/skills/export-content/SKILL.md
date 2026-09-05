---
name: export-content
description: Export a whatdstuff explainer as publishable video content — a 9:16 short and a 16:9 narrated long-form video. Use when the user asks to export/render/make a video, short, reel, or YouTube version of an explainer. Covers writing the editorial layer (hooks, narration in video.js), the deterministic render pipeline (export-video.mjs), TTS narration, and quality review of the output.
---

# Export an explainer as video content

Turns `src/explainers/<id>/` into publishable MP4s. The render is free and
repeatable — **the editorial layer (hook, narration) is where views
are won or lost.** Spend your effort there.

## Step 0 — the `render` block, not a round of questions

Every render decision lives in a committed `render` block in the explainer's
`video.js`. Formats, captions, cards, overlay, voice, framing — all of it. Write
it (or confirm the existing one) with the user, then never re-litigate it:
a re-render is reproducible from the repo alone.

```js
// src/explainers/<id>/video.js
render: {
  formats: ['short', 'long'],       // what this explainer ships
  captions: true,                   // or { short: true, long: false }
  titleCard: true,
  endCard:       { short: true,  long: false },
  followOverlay: { short: true,  long: false },
  captionStyle: 'bold-karaoke',     // see scripts/caption-style.mjs
  fill: 0.88,                       // auto-framing tightness, or { w, h }
  voice: '<elevenlabs-id>',         // else VOICE_ID from .env
  fps: 30,
}
```

**The ask-first guardrail is unchanged, only relocated.** The end card and the
follow overlay are outward-facing promises to a viewer (the short's default
card points people at a YouTube long-form). Writing one into the config IS the
explicit human choice — get it from the user before you write it, so the choice
lands in a reviewable diff instead of shell history. Absent config means off,
and `explainer-to-video` still applies neither.

Two things still to check every invocation:

1. **Is the editorial current, not just present?** A `video.js` that exists is
   not one that reflects the current conventions. Check it against
   `video-scripting`'s checklist and against this file's shape before reusing
   it — or just run `node scripts/lint-script.mjs <id>`, which reads the
   checklist for you. Rewrite through `video-scripting` if it is stale. Do not
   render a stale script because a file happens to be sitting there.
2. **Captions are a bigger decision than they look.** `captions` also gates the
   title card (both burn in one libass pass, because each burn is a full
   re-encode). Off means fully clean, unbranded footage — say that when you ask.

## Pipeline overview

```
node scripts/render.mjs <id>            # everything the config declares
```

That is the whole command. It orchestrates, and every stage is cached:

1. `scripts/lint-script.mjs` — advisory read of the narration (run it yourself
   before synthesis; it is not part of `render.mjs`)
2. `scripts/make-narration.mjs` — ElevenLabs single take. **Cached on the
   narration text + voice + speed**, so a caption or framing change does not
   re-synthesize.
3. `scripts/export-video.mjs` — frame capture → silent master. **Cached on a
   hash of the model, the steps, the shot framing/timing and the narration
   timings**, so a wording or caption change skips frame capture entirely.
4. `scripts/finish-video.mjs` — caption burn + overlays + audio mix. Two fast
   re-encodes; also runnable standalone against a cached master.
5. `scripts/add-follow-overlay.mjs` — only if the config asks for it.
6. `scripts/make-postkit.mjs` — assembles `renders/<id>/POST.md`.

Individual stages still run standalone with flags; a CLI flag always beats the
config, so one run can differ without editing the committed file.

Outputs in `renders/<id>/`: `*-master.mp4` (silent, clean), `*-captioned.mp4`,
`*-final.mp4` (audio mixed), `*-timeline.json`, `*-render.json`,
`*-master.hash`, `*-storyboard.png`.

The render needs a dev server (port 5199, or `--port`). The page clock is
virtualized (rAF + `performance.now` stubs), so frames are deterministic no
matter how slow the machine is. Headless Chromium must launch with
`channel: 'chromium'` — Playwright's default headless is `chrome-headless-shell`,
which has no GPU and silently CPU-rasterises WebGL at ~40x the cost.

**Seamless audio (audio-master pacing).** `make-narration.mjs` synthesizes a
format's ENTIRE narration in ONE ElevenLabs call (`/with-timestamps`), writing
one continuous take plus per-shot timings. `export-video.mjs` then makes the
AUDIO the clock: each shot is held for exactly its narration span and the camera
fly-to overlaps the shot's opening words, so there is no silent camera-move gap.
Do NOT go back to per-shot synthesis — it resets intonation every clip.

## Step 1 — write video.js

**Structure the script with the `video-scripting` skill first.** It owns the
editorial craft and hands back a finished, read-aloud-tested script; write that
into `video.js` in the shape below. Copy from
`src/explainers/microwave-oven/video.js`.

**Write the narration as ONE flowing voiceover, not standalone sentences.** The
whole script is a single take, so each shot's line should hand off into the
next. `lint-script.mjs`'s `no-handoff` rule flags lines that don't.

**Structure both formats on the 8-beat arc** (adapt, don't follow rigidly):
pattern interrupt → curiosity hook → spoken question → reveal → step-by-step →
isolated stat → real-world connection → callback button.

- **hook**: beat 1, under 12 words. This is the spoken opening line, NOT the
  branded title card (that comes from `meta.js`). Keep it in sync with shot 1's
  opening sentence — the lint checks.
- **short.shots**: ~70s. First shot shows the ENTIRE model.
- **long.shots**: ~2min, usually every step. Spoken prose, ~2.3 words/sec.
  Never paste step body copy; it's written for reading, not listening.
- Optional per shot: `frame`, `fill`, `bias` (framing — below), `labels`,
  `speed`, `sfx: [{ file, at }]`, `camera` (escape hatch — below).
- Consecutive shots may reuse the same `step`; the camera holds while the
  voiceover develops.
- Do NOT add per-shot `caption` fields. They are the legacy fallback for when
  no `words.json` exists; the verbatim rail renders the spoken words instead.

## Framing — solved, not guessed

`export-video.mjs` solves each shot's camera from the subject's real world
bounds (`player.js` `frameSubject()`): it builds a box over the parts the shot
is about, fits it to the frame at a target `fill`, and recentres by translating
the target. **This replaced the `dolly` scalar**, which could only zoom out —
because `target` always projects to frame centre, dollying shrank the subject
and its off-centre offset by the same factor, so it could never recentre. That
is why hand-authored per-shot `camera` poses used to be necessary.

- **The subject defaults to the step's own `focus` list** — already authored on
  most steps, and already means "what this step is about". Override per shot
  with `frame: ['Exact Callout Text', ...]`, or `frame: null` for the whole model.
- **`fill`** is the fraction of the frame the subject occupies (default 0.88
  portrait / 0.78 landscape). A number, or `{ w, h }` when the axes should
  differ — which matters in portrait, where a long horizontal machine fitted to
  the WIDTH ends up filling ~25% of the height.
- **`bias`** slides the subject up the frame to clear the caption rail. Defaults
  to 0.10 (short) / 0.04 (long) when captions are on, 0 when they're off.
- **`camera: { position, target }` is the escape hatch** — deliberate art
  direction, e.g. a macro that intentionally runs past the frame edge. A shot
  with an explicit `camera` skips the solver entirely and keeps its `dolly`.
- `--no-auto-frame` reproduces a pre-solver render exactly, for regenerating an
  already-approved older export.

`dolly` in a shot that is NOT art-directed is now IGNORED (the solver owns
distance). Old `video.js` files keep working; their `dolly` values are simply
no longer consulted.

## Label targeting — show a callout only while it's discussed

Add `labels: ['Exact Callout Text', ...]` to a shot and only those callouts show
for its duration. Shot-level, not word-level: matching labels against spoken
words is fragile (a word like "coil" appears elsewhere) and a sub-second label
flash reads as a glitch.

- Text must match EXACTLY what the callout renders (from `model.js`'s
  `addCallout(...)` calls). `verify-video.mjs`'s `labels` gate catches typos —
  without it, a wrong name just means the label silently never shows.
- Shots that omit `labels` are untouched; whatever is visible carries over.
- Framing is solved AFTER labels are applied, so narrowing the labels also
  tightens the shot onto the part being discussed.

## Captions — presets, and the invariants under them

Caption design lives in `scripts/caption-style.mjs`. Pick with
`render.captionStyle`:

- `bold-karaoke` (default) — Arial Black, active-word highlight, 1-4 words at a
  time on shorts. The trending shorts/reels look.
- `clean-lower-third` — phrase-grouped, no per-word pop.
- `minimal` — small and unobtrusive, long-form.

The source is the VERBATIM RAIL whenever `make-narration.mjs` wrote
`<format>-words.json` (the ElevenLabs word alignment): captions are the actual
spoken words, timed to when they are said. Without it, the legacy per-shot
`caption` one-liners are used.

**Do not "simplify" these when touching caption code — each was a real bug:**

- Cues must NOT overlap in time. libass stacks simultaneous events, so a
  few frames of overlap shove the caption a full line up and back — which reads
  as the subtitles bouncing for the whole video. Never add a minimum-duration
  floor to a word cue.
- The block is TOP-anchored (alignment 8) at a computed margin. Bottom-anchored
  text grows upward, so the baseline jitters as the wrap count flips.
- Every group must fit one line. `maxChars` per preset is MEASURED, not guessed
  (18/44 for `bold-karaoke`); overflow triggers libass auto-wrap and the jitter
  returns. `verify-video.mjs`'s `caption-width` gate re-measures at the real font.
- Captions stay bottom-ish, never true centre — the CSS2D callouts float
  mid-frame and would collide.
- The final mix is normalized to -14 LUFS (`loudnorm`). An un-normalized export
  sounds thin next to the feed around it, which reads as amateur immediately.

## Step 2 — check before you spend anything

```
node scripts/lint-script.mjs <id> --format short     # advisory, reads the checklist
node scripts/storyboard.mjs   <id> --format short    # one image: every shot, framed, with its copy
node scripts/verify-video.mjs <id> --format short    # framing/caption/label gates → VIDEO PASS
```

The storyboard is the cheap review: every shot at the pose it will actually be
rendered at, annotated with its measured frame coverage, its caption and its
narration. **Look at it before rendering.** A framing or copy problem found here
costs nothing; the same problem found in a finished MP4 costs a whole render.

`verify-video.mjs` FAILS on a shot the solver framed badly and WARNS on the same
problem in an author-pinned `camera` — a deliberate macro that crops is a choice,
a solver that crops is a bug.

## Step 3 — render

```
node scripts/render.mjs <id>
```

Smoke-test new editorial at `--fps 10` first. On a re-run, unchanged inputs mean
the master is reused and only the burn + mix re-run — seconds, not minutes.
`--force-frames` re-renders anyway; `--force-narration` re-synthesizes.

- **Title card** — the explainer name, top-centre, first 5 seconds, then it
  clears so nothing competes with the mechanism. Derived from `meta.js`
  ("How a Refrigerator Works" → "REFRIGERATOR"); set `titleCard` in video.js
  only when the derivation is wrong.
- **End card** — the closing share/funnel beat over the tail, scheduled AFTER
  the last spoken caption so it never fights the rail. Opt-in per Step 0.
- **`platforms`** — optional `{ youtube, shorts }` copy, consumed by
  `make-postkit.mjs`. Author it with the script, not at posting time.

## Step 4 — review the output (mandatory)

Extract spot-check frames from the FINAL file and LOOK at them:

```
node -e "const f=require('ffmpeg-static');const{execFileSync}=require('child_process');execFileSync(f,['-y','-i','renders/<id>/short-final.mp4','-vf','fps=1/5,scale=540:-1','renders/<id>/check-%02d.jpg'])"
```

The gates cover framing, caption width and label names. What they cannot judge,
and you must:

- **Motion**: the mechanism visibly moving in every shot (compare consecutive
  frames — frozen loops have shipped before).
- **Copy vs visual truth**: the narration describing what is actually on screen.
- **Caption legibility** at phone size, and word-sync actually tracking the voice.

Fix in `video.js`, re-run `render.mjs`. Ship only what you would post.

## Facts that matter

- Firearm explainers (semi-auto-pistol): do NOT export for short-form platforms
  — age-restriction/demonetization risk. Long-form YouTube only, and flag it to
  the user first.
- `window.__hiw.activate(i)` is the deterministic step driver; `frameSubject`,
  `frameTo`, `projectSubject` and `flyTo` are the framing API. Keep all of them
  when refactoring the player — the exporter, the gates and the storyboard all
  read them.
- Any `waitForFunction` added to `export-video.mjs` MUST pass an interval
  `polling:` value. The default `'raf'` deadlocks, because the init script
  replaced `requestAnimationFrame` with a queue that only drains on
  `__vt.advance()`, which cannot run until the wait resolves.
- The CSS2D part-labels are scene content and render in the export. To hide them
  entirely, add `.callout { display:none }` to the export's injected CSS.
- Captions burn via libass with `fontsdir=C:/Windows/Fonts`, and ffmpeg runs
  with cwd = the renders dir to dodge Windows path escaping. A burn failure
  falls back to the uncaptioned master rather than failing the run.
- The turntable spin some models run during a step is NOT yet controllable per
  shot — see `docs/video-pipeline-plan.md` §3 (Phase 1b, on hold pending a
  design decision). If a shot rotates when it shouldn't, that is why.
