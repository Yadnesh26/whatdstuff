# Idea backlog

Distilled from the old root `suggestions.txt` (2026-08): everything that was
already built is dropped — motion-driven narration, per-step camera direction,
callouts/highlighting, flow visualization, cutaway/x-ray reveals, component
isolation, the step system + progress rail, the reusable framework, and the
video/short export + TTS pipeline all exist. What's left is the still-open
ideas, roughly ordered by educational return per effort.

## Editorial devices (per-explainer, cheap, high value)

- **Failure moments** — one step showing what happens when the mechanism fails
  (clogged filter, worn synchro, blown fuse). People remember failure better
  than perfect operation.
- **Real-world scale props** — a coin next to a gear, a human next to a jet
  engine. One reference object per model, only where scale is surprising.
- **Before/after comparisons** — dirty vs clean filter, HDD vs SSD; a paired
  step or split view where contrast IS the lesson.
- **Live data readouts** — RPM/pressure/temperature values updating with the
  loop, as callout-style overlays tied to the step state.

## Player features (framework-level, weigh against rule 7)

- **Interactive labels** — clicking a callout focuses camera + highlights the
  part. Natural extension of the existing callout registry.
- **Playback speed** — 0.25×/0.5× slow motion; many mechanisms move too fast
  to read. anime.js timelines already support rate changes.
- **Explorable end-state** — free exploration after the last step. NOTE: any
  zoom/pan conflicts with the rotate-only rule (CLAUDE.md rule 7) — if ever
  built, it must be an explicit opt-in mode, never the default controls.
- **Difficulty levels** — beginner vs deep-dive copy for the same model.
  Expensive (doubles editorial); revisit only if audience data demands it.

## Production

- **Video export pipeline rebuild** — auto subject framing, deterministic loop
  phase + turntable control (no unwanted rotation), a declarative `render`
  block per explainer, a cached master so caption/wording fixes skip the frame
  render, themeable caption presets, and framing/caption/script gates.
  Plan: [video-pipeline-plan.md](video-pipeline-plan.md).
- **Sound design** — subtle mechanism-synced audio (hum, clicks, flow) for
  exported videos first (FFmpeg mix), interactive later.
- **One module → many assets** — thumbnail, blog post, social images generated
  from the same source (make-thumbnails.mjs is the start; see
  [audience-capture-plan.md](audience-capture-plan.md) for the distribution
  side and its P1/P2 prerequisites).
- **Translations** — narration + captions in other languages once the
  English pipeline is fully hands-off.

## North star

An interactive encyclopedia of how the world works — every new explainer
compounds the library's value rather than existing as an isolated animation.
Per the audience plan: with ~30 explainers built, distribution, not inventory,
is the current constraint.
