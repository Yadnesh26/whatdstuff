// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: one flowing voiceover, synthesized as a single ElevenLabs take.
// 8-beat arc: pattern interrupt (nothing sucks) -> stakes/promise (something
// else drags the dirt) -> spoken question -> mechanism as a BUT/THEREFORE
// chain (pressure drop -> room air pushes in -> brush roll -> cyclone) ->
// isolated stat (79,000 g) -> so-what (suction never fades, no bag) ->
// callback button closing the "sucks/pushing" loop planted in the hook.
export default {
  hook: 'Nothing inside this machine\nsucks.',

  // 9:16 — ~75s. One take, 9 shots.
  short: {
    shots: [
      {
        // Zone 1 — hook: the boldest true claim, word one, on the full sealed product
        step: 0,
        narration: 'Nothing inside this machine sucks.',
      },
      {
        // Zone 2+3 — stakes: plant the loop (something else drags the dirt), then the spoken question
        step: 0,
        narration:
          'Every bit of dirt that vanishes off your carpet gets dragged there by something else entirely. So what’s actually pulling it in?',
      },
      {
        // Zone 4a — reveal: the impeller, and the pressure drop that starts everything
        step: 5,
        labels: ['Impeller'],
        narration:
          'A spinning fan throws air out of the machine, which drops the pressure inside by about a fifth.',
      },
      {
        // Zone 4b — THEREFORE: the room pushes air in to fill that gap, closing the "what's pulling it" question.
        // Label targeting only ever NARROWS within a step (export-video.mjs
        // hides on first narrow, then can't re-show on the next same-step
        // shot), so this shot shows the union of both this and the next
        // shot's callouts — the next shot then narrows down to just one.
        step: 2,
        labels: ['Suction slot', 'Brush roll'],
        narration:
          'So the air in your room shoves in through the nozzle to fill that gap, dragging the dirt in with it.',
      },
      {
        // Zone 4c — BUT: airflow alone can't free grit from carpet, so the brush roll earns its spot
        step: 2,
        labels: ['Brush roll'],
        narration:
          'But airflow alone can’t rip grit out of carpet fibers, so a brush roll spins up to three thousand times a minute to shake it loose first.',
      },
      {
        // Zone 4d — THEREFORE: that loosened dirt rides into the bin and the cyclone takes over
        step: 3,
        labels: ['Tangential inlet', 'Dust thrown to the wall'],
        narration:
          'So that dirty air enters the bin at an angle, starts to spin, and flings the heavy stuff straight into the wall.',
      },
      {
        // Zone 5 — the stat, isolated with a re-hook
        step: 4,
        labels: ['Fine-dust cones'],
        narration:
          'Here’s the part that gets me: the fine dust gets split into seven tiny cones, spun so hard it feels over seventy nine thousand times gravity.',
      },
      {
        // Zone 6 — so-what: the everyday payoff (no bag, no fading suction)
        step: 3,
        narration:
          'That’s why suction never fades as the bin fills. Nothing is straining through a bag, just dust spinning out of the air.',
      },
      {
        // Zone 7 — button: closes the sucks/pushing loop from the hook
        step: 6,
        narration: 'It never sucked. Your room did all the pushing.',
      },
    ],
  },
};
