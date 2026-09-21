---
name: video-scripting
description: Write or improve the narration script for a whatdstuff explainer video — the hook, the retention structure, and the spoken voiceover in video.js. Use BEFORE writing/editing an explainer's video.js editorial, or whenever asked to make a script, hook, or narration punchier, more engaging, higher-retention, or easier to understand. Covers the retention spine (hook → loops → mechanism → stat → payoff → button), the professional formulas (ABT, open loops, Hook-Retain-Reward, SUCCESs), a worked before/after, and a pre-flight checklist. Hands the finished script to export-content; it does not render.
---

# Scripting an explainer video

The script IS the retention curve. On a short, viewers leave in the first 3
seconds and again at every soft transition after. Spend your effort here — a
world-class 3D model narrated over a flat script gets scrolled past.

This skill shapes **words only** — the hook plus the spoken line per shot in
`src/explainers/<id>/video.js`. It hands a finished script to `export-content`,
which renders the picture, synthesizes the ElevenLabs voice, and burns the
voice-matched caption rail. It does **not** touch rendering, TTS, or captions.

## The one hard truth about this pipeline

Captions are the **verbatim voice rail** — the exact spoken words appear on
screen, word-synced. There is **no separate title card** anymore. So:

- The hook must live in **shot 1's first spoken sentence.** That one sentence is
  simultaneously the audio hook AND the on-screen hook.
- Every word is read *and* heard. Write lines that land in the ear and read
  clean on screen — short, punchy, no tongue-twisters, no run-ons.

## Packaging first (before writing a word)

Everything reduces to **expectations vs. reality**: the viewer judges the video
against what the title/hook made them expect. Reality beats expectations → they
stay and share; expectations beat reality → they leave. You can't engineer that
gap against a moving target, so lock the packaging before scripting:

- **Idea** — one line naming the curiosity the video resolves. If the target
  viewer doesn't actually want it answered, no scriptcraft saves it.
- **Title/hook expectation locked first** — the first spoken line must
  **confirm** the click (say/show exactly what was promised), then **exceed** it
  with something the title didn't promise. Opening on anything unrelated to the
  promise is the fastest way to lose a good-faith click. Never an opaque teaser
  ("you won't believe this") — the first line names the plot directly.
- **Story lens** — on a saturated topic, pick the uncommon angle before writing
  ("your fridge doesn't make cold" is a lens; "how fridges work" is not).

Long-form extras: outline the beats FIRST and gut-check for uniqueness — if
they restate what the viewer already knows, research more before writing.
Order body beats **2nd-best → best → 3rd-best** (rising value keeps viewers;
leading with the best reads as decline). Run each beat context → application →
framing (what it is → how it works → why it matters to the story).

Short-form extra: shorts **replay on loop** — write the last line together with
the first line so the button also sets up the hook on replay.

## The retention spine

Structure every script on this. Times are for a ~60-75s short; a ~2min long
develops the same beats with more room to breathe.

| Zone | Time (short) | Job |
| --- | --- | --- |
| 1. **Hook** | 0-3s | The boldest true sentence, word one. Visual matches. |
| 2. **Stakes + promise** | 3-8s | Stack a 2nd surprise; open the main loop; imply the payoff. |
| 3. **Question** | 8-14s | Say the mystery out loud, as a real spoken question. |
| 4. **Mechanism** | 14-40s | 3-4 beats as a BUT/THEREFORE chain, one analogy each, re-hook mid-way. |
| 5. **The stat** | ~40-50s | The single most surprising number, ISOLATED, with a beat of space. |
| 6. **So-what** | 50-60s | The everyday consequence — why the viewer should care. |
| 7. **Button** | last ~5s | A callback that CLOSES the opening loop. Quotable, ≤8 words. |

## The formulas (how to apply, not theory)

- **ABT — And / But / Therefore.** The spine of momentum. Connect beats with
  **"but"** (tension) or **"therefore"** (consequence). If a transition reads
  **"and then,"** rewrite it — that's a list, not a story. Highest-leverage fix
  in the whole skill.
- **Open loop (plant & close).** In zone 2, plant a question you do NOT answer
  ("…and it cooks from the inside out"). Close it — same words — in the button.
  One primary loop per script; never leave it dangling.
- **Hook → Retain → Reward.** Re-hook every ~15-20s with a mini pattern-interrupt
  ("here's the part that gets me"). The stat (zone 5) is the reward — never bury
  it inside the mechanism beats.
- **SUCCESs (comprehension).** Simple, Unexpected, Concrete, Credible, Emotional,
  Story. In practice: one idea per sentence; a concrete analogy for every
  abstract noun; a specific number over a vague claim ("boils water in 90
  seconds" beats "cooks fast").

## Write the PICTURE, not just the words

The script owns the cut now, not just the voiceover. A spoken line is a **beat**,
and a beat can carry several shots — so for every line, also decide what the
viewer SEES while it is spoken. Write those as silent shots (no `narration`)
under the line they belong to; `export-content` owns the syntax.

Why this is now your job: shots used to be 1:1 with spoken lines, which held the
picture still for a median of 8.8 seconds across 55 shipped shorts. A short that
holds one angle for nine seconds is scrolled past regardless of how good the
sentence is.

- **Two to four visuals per spoken line.** Name them while drafting: "the wire
  glowing" / "electrons peeling off" / "the spoke sweeping the cavities".
- **The stat gets a hard cut**, not a glide. Isolate it visually as well as
  verbally — new angle, tight, on the beat the number lands.
- **Re-hooks are cuts.** "Here's the part that gets me" should coincide with a
  change of scale, not just a change of sentence.
- **Cutting is free; re-recording is not.** Silent shots do not re-synthesize the
  take, so the picture can be re-cut against an approved voiceover as many times
  as you like. Never re-word a line just to change what is on screen.
- Silent shots cost no words, so they do not change the ~2.3 words/sec length
  budget. A 70s short with 25 shots has the same script as one with 8.

## Voice: modern register, earned slang only

Priority order for this project: intuitive and easy to understand, then
entertaining — never brand-building for its own sake. Modern conversational
register serves that (cold-open claims, second person, contractions, casual
framing metaphors like "earns its keep" / "banks the punch"); actual slang
vocabulary is a much narrower tool, used only where it sharpens
understanding.

- **The sweet-spot test: slang must be literally true about the mechanism.**
  "The intake stroke is freeloading" works because the stroke genuinely
  spends energy it hasn't earned yet — the slang doubles as the explanation.
  Decoration slang that carries no mechanical meaning ("no cap," "it's
  giving," "goes hard," "built different," "rizz," "skibidi") is banned
  regardless of density — it teaches nothing and reads as trying too hard.
- **No frequency target, in either direction.** Default is zero. A slang
  moment has to *earn* its spot by being the clearest, most entertaining way
  to say that exact thing — once a video, once every five or six videos,
  whatever the material earns. Never insert one to hit a quota; forced
  insertions are where cringe comes from. Hard ceiling: 2–3 per short, never
  a goal to reach.
- **Best placements when one earns its spot:** the hook, a mid-script
  re-hook, or the button. Mechanism beats stay clean cause-and-effect prose
  — that's where "easy to understand" actually lives.
- **The narrator-voice test.** Read the line in the calm, measured channel
  voice (see `export-content`). If it needs a smirk or a young, ironic
  delivery to land, cut it — this pipeline's TTS voice won't sell it.
- **Mainstream-crossover vocabulary only** — basically, literally,
  freeloading, carrying, cheat code, for free, wild, dead weight. Understood
  across ages, doesn't expire with a meme cycle (this library is evergreen).
  Meme/identity slang is out even at the sweet spot, because it's the first
  thing to date a script.
- Worked example (four-stroke-engine short, 2026-08-04): base hook "Your
  engine makes power only a quarter of the time" → slanged "Your engine is
  basically freeloading 75% of the time." One word, mechanically true,
  passes the narrator-voice test — the rest of the script stayed untouched.

## Humanize pass (after the draft, before pre-flight)

Run the `humanizer` skill on the finished draft before locking it in. It
catches the standing AI tells that keep showing up in narration drafts:
negative parallelisms ("it's not just X, it's Y"), tailing negations,
staccato fragment stacks ("No flame. No coil. No contact."), rule-of-three
padding, aphorism formulas, and — critically for this pipeline — em/en
dashes, which ElevenLabs renders as dead-air pauses the speed knob can't
compress. Where humanizer's flattening instinct would fight a deliberate
retention device, retention wins: the hook and the ≤8-word button are
allowed one short, emphatic sentence; only a *run* of them is a defect.

## Non-negotiables (the checklist)

- **Hook in the first spoken sentence.** No warm-up, no "in this video," no
  restating the title. The counterintuitive claim is word one.
- **One flowing single-take voiceover.** Each shot's line HANDS OFF into the next
  (a trailing thought the next line finishes). The whole script is synthesized as
  one ElevenLabs take — write it to be read start-to-finish, not as a stack of
  standalone facts.
- **But/therefore, never and-then** between beats.
- **Plant one loop; close it in the button.**
- **Isolate the stat** on its own shot with a beat of space around it.
- **One idea per sentence.** Break run-ons — short sentences read and hear better.
- **Vary sentence length.** A run of same-length sentences drones regardless of
  content. Check: lay the script out one sentence per line — a flat right edge
  means not enough variation.
- **Analogy per abstract concept;** define jargon the instant it appears.
- **Second person, contractions, ~2.3 words/sec.** Talk to one viewer.
- **Button ≤8 words, quotable, closes the loop.** End on the callback — not a new
  fact, and not "like & subscribe."
- **Never paste the step body copy** — it's written for reading, not listening.
- **Every spoken line has its visuals decided** (2-4 per line), written as silent
  shots. A line with one static shot behind it is an unfinished line.
- **Any slang passes the sweet-spot test** (literally true about the
  mechanism) and the narrator-voice test, or it gets cut — see "Voice"
  above. No em/en dashes anywhere (humanizer pass, same section).

## Worked example (microwave-oven short)

**Hook** — soft open → cold-open claim with a planted loop:
> BEFORE: "There's no flame in here. No hot coil, nothing that even touches your
> food — and yet, close the door, and it cooks in seconds."
>
> AFTER: "Nothing in this box ever touches your food. No flame, no coil, no
> contact — and it'll still boil water in ninety seconds. Whatever's doing it is
> basically caged lightning… that cooks from the inside out."

**Mechanism beat** — "and then" → BUT + a more universal analogy:
> BEFORE: "Magnets bend their path, they ring twelve little cavities like tuning
> forks, and out comes a radio wave — the same kind that carries Wi-Fi, just far
> more powerful."
>
> AFTER: "But the electrons don't fly straight — two magnets bend them into
> loops. As they whip past twelve little cavities, they make them ring like a wet
> finger on a wine glass. That ringing IS a radio wave — same as your Wi-Fi,
> cranked up a thousand times."

**Button** — close the "inside out" loop + callback:
> BEFORE: "…the food heats itself from the inside. No flame. Just a storm of
> invisible waves, and water that can't sit still."
>
> AFTER: "That flipping is friction — and friction is heat. So the food cooks
> itself, from the inside out. No flame. No touch. Just invisible lightning, and
> water that can't sit still."

## Pre-flight (run before handing to make-narration)

1. Read shot 1's first sentence **alone** — does it stop a scroll? If not, rewrite.
2. Walk every transition — is each a but/therefore? Kill every "and then."
3. Find the loop — planted in zone 2, closed word-for-word in the button?
4. Is the stat on its own beat, not buried in the mechanism?
5. Read the whole script **aloud as one take** — does it flow, or is it a list?
6. Any sentence with two ideas → split it. Any undefined jargon → define or cut.
7. Length in range (~60-75s short / ~2min long) at ~2.3 words/sec.
8. Run the `humanizer` skill on the draft (see "Humanize pass" above);
   fold in its rewrite except where it would flatten the hook/button.
9. Any slang word present → sweet-spot test (literally true about the
   mechanism?) and narrator-voice test. Fails either → cut it. No quota to
   fill either way.

Then write it into `video.js` and hand off to **`export-content`** (make-narration
→ export). The spoken words become the on-screen captions automatically, so a
script that reads well IS a caption track that reads well.
