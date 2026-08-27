---
name: export-content
description: Export a whatdstuff explainer as publishable video content — a 9:16 short and a 16:9 narrated long-form video. Use when the user asks to export/render/make a video, short, reel, or YouTube version of an explainer. Covers writing the editorial layer (hooks, narration in video.js), the deterministic render pipeline (export-video.mjs), TTS narration, and quality review of the output.
---

# Export an explainer as video content

Turns `src/explainers/<id>/` into publishable MP4s. The render is free and
repeatable — **the editorial layer (hook, narration) is where views
are won or lost.** Spend your effort there.

## Step 0 — before touching the pipeline (every invocation)

1. **Ask which format(s).** Never assume. Ask the user — short, long, or
   both — before generating narration or rendering. "Export content for X"
   is not "export both by default"; get an explicit answer (AskUserQuestion
   is fine for this).
2. **Check the editorial is current, not just present.** A `video.js` that
   already exists is not the same as one that reflects the latest
   conventions. Before reusing it, check it against the live checklist in
   `video-scripting`'s SKILL.md (hook = shot 1's first spoken sentence, ABT
   connective tissue not "and then," one planted loop closed in the button,
   the stat isolated on its own shot, no per-shot `caption` one-liners now
   that the verbatim rail exists) and against this file's current shape
   (single-take narration, `seconds` as a floor, the `hook` field is the
   spoken line only — not the same thing as the branded title card).
   If it predates those conventions — check `git log -- src/explainers/<id>/
   video.js` against the date the skills last changed, or just read it and
   judge — rewrite it through `video-scripting` first. Do not render a stale
   script just because a file happens to be sitting there.
3. **Ask about captions too, and name the real stakes.** `--captions` also
   gates the title card (see "Captions" below) — declining captions means
   fully clean, unbranded footage, not just no on-screen text. Say that when
   you ask, don't just ask "captions y/n" in isolation. The END card is a
   separate, opt-in decision (`--endcard`) — never fold it into the captions
   question and never pass it unasked; see Step 3.

## Pipeline overview

1. `src/explainers/<id>/video.js` — editorial layer (you write this)
2. `node scripts/make-narration.mjs <id> --format short|long --voice <id>` —
   ElevenLabs TTS (needs `ELEVENLABS_API_KEY` in `.env`; the script loads it
   itself). Falls back to free Edge TTS if the key is unset/fails.
3. `node scripts/export-video.mjs <id> --format short|long [--captions]` —
   deterministic frame render + ffmpeg. `--captions` also gates the title
   card (see "Captions" below for whether to pass it); the end card is
   separately opt-in via `--endcard` — this is a manual, ask-first workflow,
   unlike the fully unattended `explainer-to-video` pipeline, which always passes `--captions`
   because no one's there to ask.
4. Review the output frames, fix, re-render
5. `node scripts/make-thumbnails.mjs <id>` — 16:9 cover plates (long-form)
6. `node scripts/make-postkit.mjs <id>` — assembles `renders/<id>/POST.md`

Outputs land in `renders/<id>/`: `*-master.mp4` (silent, clean),
`*-final.mp4` (audio mixed, only if narration/sfx files exist),
`*-timeline.json` (shot timings).

**Seamless audio (audio-master pacing).** `make-narration.mjs` synthesizes a
format's ENTIRE narration in ONE ElevenLabs call (the `/with-timestamps`
endpoint), writing one continuous take `<format>-full.mp3` plus per-shot
`<format>-timings.json`. `export-video.mjs` then makes the AUDIO the clock:
each shot is held for exactly its narration span, the camera fly-to overlaps
the shot's opening words (no silent camera-move gap), and the single track
plays straight through. This is why the voiceover sounds like one performance
instead of stitched clips — do NOT go back to per-shot synthesis (it resets
intonation every clip and reintroduces the gaps). If no timings file exists
(Edge fallback), the exporter transparently uses the older per-shot path.

The render needs a dev server: start the `video-export` launch config
(port 5199) or pass `--port`. The page clock is virtualized (rAF +
performance.now stubs), so frames are deterministic and smooth no matter how
slow the machine is. Headless Chromium launches with GPU flags
(`--enable-gpu --use-angle=d3d11`) — without them WebGL falls back to
SwiftShader (CPU) and frames cost ~1s instead of ~0.1-0.2s. Default 24fps.
Different explainers can render in parallel (independent browser instances).

## Step 1 — write video.js

**Structure the script with the `video-scripting` skill first.** It owns the
editorial craft — the hook, the retention spine, the ABT connective tissue, the
plant-and-close loop, the isolated stat, and the punchy button — and hands back
a finished, read-aloud-tested script. Then write that script into `video.js` in
the shape below.

Copy the shape from `src/explainers/microwave-oven/video.js` (the reference for
the current single-take + 8-beat approach). `seconds` per shot is now just a
FLOOR — the audio drives the real pacing — so don't fuss over it; write the
script and let the narration set the length.

**Write the narration as ONE flowing voiceover, not standalone sentences.**
Because the whole script is synthesized as a single take, each shot's line
should hand off into the next (a trailing thought the next line finishes:
"…and that's when the real trick happens." → "The trick is…"). Standalone
one-fact-per-shot lines are what made earlier exports feel disconnected.

**Structure both formats on this 8-beat arc** (adapt, don't follow rigidly):
1. *Pattern interrupt* (0–3s) — a claim that sounds wrong until explained
   ("There's a lightning storm inside this box"), NOT the topic.
2. *Curiosity hook* — stack a second surprising fact.
3. *Question* — ask it out loud, a real spoken question.
4. *Reveal* — cut to the mechanism, name it.
5. *Step-by-step* — the mechanism beats, each connecting to the next.
6. *Key insight / mind-blowing moment* — the single most surprising stat,
   given its OWN shot and a beat of space (don't bury it in the steps).
7. *Real-world connection* — why it matters / a everyday consequence.
8. *Powerful ending* — callback to beat 1, short and quotable.

- **hook**: beat 1, under 12 words, `\n` for line breaks. This is NOT the
  branded title card (that's the explainer's name from `meta.js`, burned
  top-center for 5s — see Step 3). The hook is purely the spoken opening
  line; the verbatim caption rail (see below) is what surfaces it on screen,
  word by word, as it's said. The `hook` field only burns as its own
  standalone card on the legacy no-`words.json` fallback path; keep it in
  sync with shot 1's opening line regardless.
- **short.shots**: ~70s (scale to module complexity — simpler ~50s, complex
  ~90s). **First shot shows the ENTIRE model** (establish, then zoom).
  Wide/horizontal models need per-shot `dolly` (2.0+) to fit portrait. Shorts
  ARE narrated.
- **long.shots**: ~2min (scale to complexity), usually every step. `narration`
  is spoken prose — contractions, short sentences, second person, ~2.3 words/
  sec. Never paste the step body copy; it's written for reading, not listening.
- Optional per shot: `dolly` (portrait pull-back, default 1.35 — raise if the
  subject crops), `sfx: [{ file, at }]` referencing `assets/sfx/<file>.mp3`,
  `labels: ['Exact Callout Text', ...]` — see "Label targeting" below.
- Consecutive shots may reuse the same `step` (e.g. beats 1–3 all on the hero)
  — the camera simply holds while the voiceover develops.

## Label targeting — show a callout only while it's being discussed

By default the in-scene 3D part-labels (CSS2D callouts) follow whatever each
player STEP's `onEnter` sets (`handles.setLabels(true/false)` — usually all
labels on the overview step, all off elsewhere). For video, you can instead
show only the label(s) relevant to what's being said RIGHT NOW: add
`labels: ['Exact Callout Text', ...]` to a shot in `video.js`. `export-video.mjs`
matches that text against each callout's rendered text and shows only the
named ones for that shot's duration, hiding the rest — shot-level precision
(one topic per shot, same as the narration is already chunked), not
word-level. Rationale for shot-level over word-level: matching label text
against spoken words via `words.json` timing is fragile (a word like "coil"
can appear elsewhere and trigger the wrong label) and flashing a label on for
under a second reads as a glitch, not a deliberate cue — confirmed as the
right call with the user 2026-07-29.

- The text must match EXACTLY what the callout renders (copy it from
  `model.js`'s `addCallout('Exact Text', ...)` calls, not the heading/body).
- Shots that omit `labels` are untouched — whatever's currently visible
  carries over (from the step's `onEnter`, or from a previous shot's
  override on the same step, since `activate()` is a no-op when consecutive
  shots share a step). Old `video.js` files with no `labels` fields keep
  behaving exactly as before.
- This is export-only — it never touches the live interactive site.
- Sanity-check the exact list against the explainer's `model.js` before
  rendering (`grep addCallout`); a typo'd name just means that label never
  shows for that shot, no error is raised.

## Step 2 — narration (both formats, single take)

```
node scripts/make-narration.mjs <id> --format short --voice <voiceId>
node scripts/make-narration.mjs <id> --format long  --voice <voiceId>
```

The key is loaded from `.env` automatically. Each call is ONE ElevenLabs
request that synthesizes the whole format's script and writes
`renders/<id>/audio/<format>-full.mp3` + `<format>-timings.json` (see the
seamless-audio note above). `--voice` sets the channel voice; without it a
neutral default is used. If the key is missing/invalid it falls back to free
Edge TTS as per-shot files, and the export still works (just less seamless).
Re-run this whenever the script changes, then re-run the export to re-mix.

**Pause trimming is ON by default.** ElevenLabs' own silence at periods and
commas is a delivery trait of the model, not something the text can fully
control — `make-narration.mjs` now shortens any gap over `--max-pause`
(default 0.3s) down to `--target-pause` (default 0.15s) by trimming the
actual audio waveform (ffmpeg atrim+concat) and shifting every later word/
shot timestamp to match, so captions and shot pacing stay in sync with the
shortened take. This is a different fix from the comma/dash-density lesson
above (writing style) — this one targets pause DURATION directly, at the
audio level, regardless of how the script is punctuated. Disable per-run
with `--no-trim-pauses` if a take ever sounds too clipped/rushed.

## Captions — off by default, ask if it's not obvious

The standing default is narration-only, clean footage — don't burn captions
unless the user asked for them (or the platform/context makes it obvious,
e.g. "make me a TikTok"). **This is now a bigger decision than just
captions**: `--captions` is also the flag that gates the title card (see
Step 3), because both burn in the same libass pass to
avoid a second re-encode. Skipping it means a fully clean loop with no
branding at all, not just no on-screen text — say so when you ask, so the
user is choosing the actual trade-off. When captions are wanted, pass
`--captions`; follow the `captions-overlay` doctrine (rail-first, verbatim,
embed scarce — see that skill for the full model):

```
node scripts/export-video.mjs <id> --format short --fps 30 --captions
node scripts/export-video.mjs <id> --format long  --fps 30 --captions
```

`export-video.mjs` prefers the VERBATIM RAIL: if `make-narration.mjs` wrote
`renders/<id>/audio/<format>-words.json` (the ElevenLabs word-level
alignment — it does whenever the ElevenLabs path was used, not the Edge TTS
fallback), the burned captions are word-synced to the actual narration, with
an active-word highlight, grouped into short lower-third phrases. No
per-shot `caption` fields needed — don't add them to video.js, they're the
legacy fallback path for when no words.json exists. This produces
`<format>-captioned.mp4` in addition to the silent master and the final mix.

## Step 3 — render

```
node scripts/export-video.mjs <id> --format short --fps 30 [--captions]
node scripts/export-video.mjs <id> --format long  --fps 30 [--captions]
```

Smoke-test new editorial at `--fps 10` first (renders ~3x faster) before
committing to a 30fps run.

**Overlays ride the caption pass.** Captions, the title card and (when opted
into) the end card are burned in ONE libass pass (each burn is a full
re-encode, so they must not cost extra passes). Consequence: no `--captions`,
no overlays at all — and no `--endcard`, no end card even with captions on.

- **Title card** — the explainer name, top-center, first 5 seconds, then it
  clears so nothing competes with the mechanism and it cannot collide with the
  CSS2D callouts floating mid-frame. The name is derived from `meta.js`
  ("How a Refrigerator Works" → "REFRIGERATOR"); set `titleCard` in video.js
  only when that derivation is wrong. Disable with `--no-title`.
- **End card** — the closing share/funnel beat over the tail. **OPT-IN: pass
  `--endcard`, or set `endCard` in video.js.** It does NOT ride `--captions`
  the way the title card does. An end card is an outward-facing promise (the
  short's default copy points viewers at a YouTube long-form), so it is never
  a side effect of wanting captions — only burn one when the user asked for
  it and the thing it promises actually exists. It is scheduled AFTER the
  last spoken caption wherever the tail allows, so it never fights the voice
  rail. Override the copy with `endCard` (`\n` splits lines); `--no-endcard`
  force-disables even an `endCard` set in video.js.
- **Loudness** — the final mix is normalized to ~-14 LUFS (`loudnorm`). Do not
  remove this: an un-normalized export sounds thin next to the normalized feed
  around it, which reads as amateur before a word is understood.
- **`platforms`** — optional `{ youtube: {title, description, tags}, shorts:
  {title, hashtags} }`, consumed by `make-postkit.mjs`. Author it with the
  script, not at posting time.

## Step 4 — review before shipping (mandatory)

Extract spot-check frames from the final output and LOOK at them:

```
node -e "const f=require('ffmpeg-static');const{execFileSync}=require('child_process');execFileSync(f,['-y','-i','renders/<id>/short-final.mp4','-vf','fps=1/5,scale=540:-1','renders/<id>/check-%02d.jpg'])"
```

Check every frame for:
- **Framing**: subject fully in frame (portrait crops sides — fix with `dolly`)
- **Motion**: mechanism visibly moving in every shot (compare consecutive
  frames if unsure — frozen loops have shipped before)
- **Long-form audio**: narration must not overrun its shot — if a segment
  feels rushed, lengthen `seconds` or cut words
- **If `--captions` was used**: legible at phone size, not covering the
  subject, word-sync actually tracks the voice (spot-check a few frames
  against the audio)

Fix in video.js, re-render. Ship only what you would post.

## Step 5 — follow-button overlay (ask, unless already told)

After shipping the review in Step 4, ask the user whether they want the
channel's animated "Follow" button popup composited onto this export — a
short chroma-keyed clip that pops in over the top-right corner partway
through the video. **Skip the question only if the user's request already
said yes** (e.g. "export X with the follow overlay," or they said yes for
this run earlier in the conversation) — in that case apply it directly, no
extra prompt. Otherwise ask before touching the output; don't assume either
way. This applies to every manual `export-content` run, short or long.

```
node scripts/add-follow-overlay.mjs renders/<id>/<format>-captioned.mp4
```

Composites `assets/overlay/follow-button.mp4` (chroma-keyed off its yellow
background) at 15s into the video, top-right zone — inset from both edges
rather than flush into the corner (margin tightened to ~7% of frame width,
2026-08-25, after it read as clipped-into-the-corner on the quartz-watch
export) — sized to ~34% of frame width. That zone is verified clear of the
3D model, callout labels, the 5s title card, and the caption rail across
every explainer short checked so far (washing-machine, vacuum-cleaner).
Writes `<format>-captioned-followed.mp4`
alongside the original by default (never overwrites — pass `--out` or
`--force` to change that). Re-check placement against a few extracted frames
before trusting it blind on an explainer with unusually wide/flat
cinematography — see the script's header comment for the crop/colorkey
derivation if the overlay asset itself ever changes.

The fully unattended `explainer-to-video` pipeline does NOT apply this (no
one there to ask) — same rule as the end card.

## Facts that matter

- Firearm explainers (semi-auto-pistol): do NOT export for short-form
  platforms — age-restriction/demonetization risk. Long-form YouTube only,
  and flag it to the user first.
- `flyTo` in player.js honors `window.__hiw.cameraScale`; the export script
  drives it via `dolly`. `window.__hiw.activate(i)` is the deterministic step
  driver — keep both when refactoring the player.
- The in-scene 3D part-labels (CSS2D callouts) are scene content and still
  render in the export — to hide them, add `.callout { display:none }` to the
  export's injected CSS.
- Audio mix picks up `renders/<id>/audio/<format>-shot-NN.mp3` +
  `assets/sfx/*.mp3` cues; anything missing is skipped gracefully.
- Captions burn via libass ASS subtitles with `fontsdir=C:/Windows/Fonts`;
  ffmpeg runs with cwd = renders dir to dodge Windows path escaping. Burn
  failure falls back to the uncaptioned master rather than failing the run.
