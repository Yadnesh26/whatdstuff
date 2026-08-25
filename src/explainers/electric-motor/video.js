// Editorial layer for video export (scripts/export-video.mjs).
// One flowing voiceover per format (single-take TTS + audio-master pacing);
// captions are the word-synced verbatim rail (--captions), not per-shot
// caption strings. 8-beat arc: pattern interrupt -> curiosity stack ->
// spoken question -> reveal -> step-by-step (armature -> commutator,
// BUT-connected) -> isolated stat -> callback.
//
// steps: 0 overview (sealed) · 1 inside (magnets+armature) · 2 armature
//        (winding becomes a magnet) · 3 commutator (the switch) · 4 force
//        (why one direction) · 5 run (sealed, spinning)
// Short lens: an electric motor with no electronics in it at all — the
// "smart" part is a shape, not a chip. Loop: "no chip / a shape that
// switches itself" (planted shots 1-2, closed word-for-word in the button).
export default {
  hook: 'This spinning can has\nzero electronics inside it.',

  // 9:16 — ~70s. Skips the force step (deeper physics, cut for pace) — the
  // short's job is the anatomy + the switch, the loop's real payload.
  short: {
    shots: [
      {
        // Zone 1 — hook: boldest true claim, matches the full sealed motor
        step: 0,
        dolly: 2.1,
        narration:
          'This spinning can has zero electronics inside it.',
      },
      {
        // Zone 2 — stack the second surprise, plant the loop
        step: 0,
        dolly: 2.1,
        narration:
          'No chip, no sensor, no code. The smartest part of it is a shape that switches itself, a few hundred times a second.',
      },
      {
        // Zone 3 — the spoken question
        step: 0,
        dolly: 2.1,
        narration: 'So what\'s actually doing the flipping in here?',
      },
      {
        // Zone 4 — reveal: name the parts on first sight
        step: 1,
        dolly: 1.6,
        labels: ['North pole magnet', 'South pole magnet', 'Armature'],
        narration:
          'Crack it open and there\'s almost nothing here. Two curved magnets glued to the can, and on the shaft, three iron teeth wrapped in copper wire.',
      },
      {
        // Zone 5a — step: current turns a tooth into a magnet
        step: 2,
        dolly: 1.6,
        labels: ['Copper winding', 'Laminated iron core'],
        narration:
          'Push current into one of those windings and its tooth becomes a real magnet. The fixed ones shove it around, and the shaft swings toward the pull.',
      },
      {
        // Zone 5b — BUT: the switch, re-hook mid-script
        step: 3,
        dolly: 1.6,
        labels: ['Three copper segments', 'Carbon brush'],
        narration:
          'But swing too far and the pull dies. So the shaft carries its own switch: a split copper ring under two carbon brushes. The instant a winding lines up, its segment slides out, and the next one fires.',
      },
      {
        // Zone 6+7+8 — isolated stat, so-what, callback (closes the loop)
        step: 5,
        dolly: 2.1,
        narration:
          'Get that handoff right, and a motor this size spins fifteen thousand times a minute, powered by nothing smarter than its own shape. No chip needed. Just the right shape.',
      },
    ],
  },
};
