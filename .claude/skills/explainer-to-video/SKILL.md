---
name: explainer-to-video
description: Run the complete whatdstuff pipeline end to end — build the explainer if it doesn't exist, verify it, review it, script it, narrate it, and render both the 9:16 short and the 16:9 long-form video. Use when the user says "run <topic>", asks for the full/end-to-end pipeline, or wants an explainer taken all the way to finished MP4s in one go. Orchestrates add-explainer → verify → review-explainer → video-scripting → export-content; it does not replace them.
---

# Explainer → video, end to end

One command's worth of intent — "run the fridge" — becomes finished MP4s in
`renders/<id>/`. This skill is the **conductor**. Every stage's craft already
lives in another skill; this file owns only the ORDER, the GATES, and the
FAILURE POLICY. Never inline another skill's rules here — read that skill and
follow it.

## How this runs

The user says **"run <topic>"**. The coordinator spawns ONE `explainer-pipeline`
agent (Sonnet, medium thinking effort) which owns the whole run start to finish.
The coordinator does not do the work itself and does not micro-manage the agent.

**This skill is a standing, explicit authorization for video export.** CLAUDE.md
rule 1 brakes video export to explicit user request only — invoking this pipeline
IS that request, for this run, for this explainer. That carve-out does not extend
to `polish-explainer`, which still requires its own separate ask.

## Autonomy: zero stops

The user has chosen a fully autonomous pipeline. **This overrides the Phase 1
approval stop in `add-explainer`.** Do not post a Blueprint and wait; research
the mechanism, write the Blueprint into your own reasoning as the build spec,
and proceed straight into Phase 2.

Everything else in `add-explainer` still binds — especially the research-first
rule (never invent a mechanism) and the pre-flight material/reveal trap
checklist, which is the repo's #1 time sink.

The only things that stop the run are the **hard failures** listed below.

## Stages

Run in order. A stage may not start until the previous one's gate is green.

| # | Stage | Skill / command | Gate |
| --- | --- | --- | --- |
| 0 | Preflight | this file | all checks pass |
| 0.5 | **Brief** | this file | angle + stat + button written down |
| 1 | Build (if missing) | `add-explainer` | files exist, `vite build` clean |
| 2 | Verify | `node scripts/verify.mjs <id>` | prints `VERIFY PASS` |
| 3 | Self-review | `scripts/review-shots.mjs` | you have LOOKED at every step |
| 4 | Independent review | `explainer-reviewer` agent | verdict SHIP |
| 5 | Script | `video-scripting` | pre-flight checklist passes |
| 6 | Narrate | `make-narration.mjs` × 2 formats | `<format>-timings.json` written |
| 7 | Render | `export-video.mjs` × 2 formats | both `*-final.mp4` exist |
| 8 | Frame check | ffmpeg spot-frames | you have LOOKED at them |
| 9 | Thumbnails | `make-thumbnails.mjs` | candidates exist, you picked one |
| 10 | Posting kit | `make-postkit.mjs` | `POST.md` has zero TODOs |

### Stage 0 — Preflight

Cheap checks that prevent an expensive run from dying at stage 7:

- `.env` exists and contains `ELEVENLABS_API_KEY`. If missing, the run still
  proceeds on the Edge TTS fallback, but it costs TWO things, and you MUST say
  so in the final report: the voiceover becomes per-shot instead of one take,
  AND no `words.json` alignment is written, so the word-synced caption rail
  degrades to per-shot summary text. Do not describe that run as a clean pass.
- `node_modules/ffmpeg-static/ffmpeg.exe` exists. If not, `npm install` first.
- Nothing is already listening on 5199 from a dead previous run.
- Note whether `src/explainers/<id>/` exists — that decides if stage 1 runs.

Never print or echo the contents of `.env` (CLAUDE.md rule 10).

### Stage 0.5 — Brief: decide the ANGLE before anything is built

`run <topic>` is a terse command, not a spec. The mechanism is a fact; the
**angle** is a choice, and it is the single highest-leverage decision in the
whole run — "how a fridge works" and "your fridge doesn't make cold" are the
same mechanism and completely different videos. Left implicit, the angle gets
picked by accident somewhere inside stage 5, long after the model and its
storyboard have been frozen around no particular idea.

So before building, research the mechanism and write a short brief into your
own reasoning — five lines, not a document:

1. **The angle** — the counterintuitive true claim this video is *about*.
2. **The stat** — the single most surprising number, the one that earns its own
   beat in the script.
3. **Who it's for** — the person who stops scrolling for this.
4. **The button** — the closing callback, and therefore the loop to plant.
5. **What must be visible** — the parts the model has to show for the angle to
   land. This feeds the storyboard directly.

Carry the brief into BOTH stage 1's storyboard and stage 5's script. If they
disagree, the brief wins. Do not ask the user to approve it (see Autonomy) —
but do state it in the final report, because it's the decision they'd most want
to overrule on the next run.

### Stage 1 — Build, only if the explainer is missing

Follow `add-explainer` completely, minus its approval stop (see Autonomy).
If the explainer already exists, skip to stage 2 — do NOT rebuild or "improve"
it. An existing explainer is treated as correct; the user asked for a video,
not a rework.

### Stage 2 — Verify

```
node scripts/verify.mjs <id>
```

Flags use `=` (`--port=5174`, `--skip-build`). Must print `VERIFY PASS`.
A FAIL is a hard failure only after you've tried to fix it — see Failure policy.

### Stage 3 — Self-review before spending a review cycle

Capture and actually look. A defect you catch here is free; the same defect
caught in stage 4 costs a whole cycle.

```
node scripts/review-shots.mjs <id> --half
```

### Stage 4 — Independent review

Spawn the `explainer-reviewer` agent in a FRESH context. Attach the stage 2
VERIFY PASS report so it skips mechanics and spends its budget on facts,
legibility, proportion and taste.

**Capped at 2 cycles** (CLAUDE.md rule 1). Apply its blocking findings as ONE
batched edit, re-verify, and continue it via SendMessage with a fix summary —
it verifies deltas only. Non-blocking taste notes do NOT earn a second cycle;
carry them to the final report instead.

If it still isn't SHIP after cycle 2: **stop and report.** Do not render a video
of an explainer that failed review — a bad model is permanent in the export.

### Stage 5 — Script

Follow `video-scripting`, then write the result into
`src/explainers/<id>/video.js` in the shape `export-content` specifies. Both
formats. Run that skill's 7-point pre-flight before moving on — especially
reading shot 1's first sentence alone, and killing every "and then".

Author these in the SAME pass, while the script's context is hot — writing them
later, cold, is how they end up generic:

- `platforms.youtube` — `{ title, description, tags: [] }`
- `platforms.shorts` — `{ title, hashtags: [] }`
- `titleCard` — ONLY if the name derived from `meta.js` is wrong. The exporter
  turns "How a Refrigerator Works" into "REFRIGERATOR" automatically.
- `endCard` — omit it. Setting it ENABLES an end card (it is opt-in, not a
  default), and this pipeline runs unattended, so nobody has asked for one.
  Only set it when the user explicitly requested an end-card CTA and the
  thing it promises actually exists.

The YouTube title is a different job from the script's hook: the hook is heard
after the click, the title has to earn the click. Don't paste one into the other.

### Stage 6 — Narrate

```
node scripts/make-narration.mjs <id> --format short --voice <voiceId>
node scripts/make-narration.mjs <id> --format long  --voice <voiceId>
```

Confirm BOTH `<format>-timings.json` and `<format>-words.json` exist under
`renders/<id>/audio/`. `words.json` is the ElevenLabs word-level alignment and
it is what makes the verbatim caption rail possible — if it's missing you fell
back to Edge TTS, and stage 7 will silently degrade to legacy per-shot summary
captions. That is a REPORTABLE degradation, not a pass.

### Stage 7 — Render

Smoke-test new editorial at `--fps 10` before committing to the full run.
Two flag traps: these are **space-separated** (unlike verify.mjs's `=`), and
**captions are opt-in — always pass `--captions`**:

```
node scripts/export-video.mjs <id> --format short --fps 30 --captions
node scripts/export-video.mjs <id> --format long  --fps 30 --captions
```

Confirm the log says `captions: verbatim rail — N word-synced cues`. If it says
`legacy summary`, `words.json` was missing (see stage 6). The silent
`<format>-captioned.mp4` is produced too — that's the one to post over trending
audio.

The `video-export` launch config (port 5199) must be up. Formats may render in
parallel only in separate browser instances; simplest is sequential.

### Stage 8 — Frame check, mandatory

Extract spot frames from each final MP4 and LOOK at them. Framing (portrait
crops the sides — fix with `dolly`), visible motion in every shot (frozen loops
have shipped from this repo before), and narration not overrunning its shot.
Fix in `video.js`, re-render the affected format.

Also confirm the overlay landed: the explainer name holds top-center for the
first 5 seconds and then clears. It is burned in the same pass as the captions
— if captions are missing, so is it. There should be NO end card unless one
was explicitly requested (see the `endCard` note above). Same rule for the
channel's follow-button popup (`scripts/add-follow-overlay.mjs`, see
`export-content`'s Step 5) — this fully unattended pipeline never applies it,
since nobody is there to ask.

### Stage 9 — Thumbnails (long-form)

```
node scripts/make-thumbnails.mjs <id>
```

Clean 16:9 plates in `renders/<id>/thumbs/` (page chrome and callouts hidden —
`--labels` keeps them). LOOK at them and name your pick in the report. On
long-form the thumbnail decides the click, so this is not a formality.

### Stage 10 — Posting kit

```
node scripts/make-postkit.mjs <id>
```

Writes `renders/<id>/POST.md` — files, durations, thumbnails, and the
per-platform copy from stage 5. It prints a TODO count; **a run is not finished
while that count is above zero.** A TODO means copy you were supposed to author
in stage 5 is missing, so go back and write it rather than reporting done.

## Failure policy

- **Retry twice, then stop.** Any stage that fails gets at most two fix
  attempts. Then stop and report — do not thrash.
- **Never skip a gate to keep moving.** A red gate is the pipeline working.
- **Never fake a pass.** If `VERIFY PASS` didn't print, it didn't pass.
- Firearm explainers (e.g. `semi-auto-pistol`): render **long only**. Do not
  produce a short — age-restriction and demonetization risk. Flag it in the
  report.

## Final report

Report to the user, not just to the transcript:

1. Paths to both MP4s, with file sizes and durations.
2. Whether the explainer was newly built or already existed.
3. The reviewer's verdict and any non-blocking findings carried forward.
4. Whether real ElevenLabs narration or the Edge fallback was used.
5. Anything you retried, and anything you left undone.

Do not report success on a run where a gate was skipped. Say which one, and why.
