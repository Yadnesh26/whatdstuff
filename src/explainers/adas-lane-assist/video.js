// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS (from story.js): lane assist never sees a road; it finds paint, turns
// it into two numbers, and leans on the wheel weaker than your hands. Planted
// loop: "So who's actually steering?" (shot 2's line) -> closed word-for-word
// in the button "So who's actually steering? You are. It never even saw the
// road.", which also calls back the hook ("...has never seen a road") and
// re-primes it on replay.
//
// SCRIPTING: one flowing single-take voiceover; every line hands off into the
// next (but / so / here's the part). No em/en dashes, no colons.
//
// STAT PLACEMENT: "3 newton metres" gets a HARD CUT onto the steering-wheel
// rim as the cyan assist arrow sweeps, then "a kilo and a half" pushes in on
// the same rim, so the number has its own picture.
//
// LOOP PHASE (activate() starts a step's loop at phase 0 on first entry):
//   (measured against audio/short-words.json, step starts from the timeline)
//   drift lap 8 s: lamp 2.2-5.3 s / 10.2-13.3 s -> "warning." at +12.2 s.
//   assist lap 12 s: torque arrow 4.3-11.5 s -> "extra torque" at +5.9 s and
//     "turns the wheel ... eases back" at +7.2-11.7 s.
//   override lap 12 s: assist 0.7-5.5 s -> "3 newton metres" at +0.6-2.6 s;
//     driver 3.6-10.6 s -> "a kilo and a half", "wins", "push back" (+10.5 s).
//
// RADAR is left out of the short on purpose: it doesn't serve the "who's
// steering" loop, and cutting it keeps the take near 70 s. The page has it.
//
// LABELS: every shot hides the in-scene callouts (labels: []). A 9:16 crop
// cuts right-anchored pills in half and the rest are illegible at phone size.
// Most of this model's callouts hang off empty anchors, which blinds the
// auto-framer, so every shot carries an authored portrait camera.
export default {
  hook: 'Your car’s lane assist has never seen a road.',

  // Requested explicitly: short only, captioned + follow overlay. No end card
  // (not asked, and it would promise a long-form that doesn't exist).
  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    followOverlay: true,
    speed: 1.0, // channel voice at 1x (make-narration still defaults to 0.9)
    fps: 30,
  },

  short: {
    shots: [
      {
        // Zone 1 — hook, on the complete sealed car
        step: 0,
        labels: [],
        camera: { position: [3.5, 2.4, -9.6], target: [0, 0.45, -0.2] },
        narration: 'Your car’s lane assist has never seen a road.',
      },
      {
        step: 0,
        labels: [],
        camera: { position: [2.3, 1.85, -3.7], target: [0, 1.05, -0.45] },
        push: 0.9,
        seconds: 1.2,
      },

      {
        // Zone 2 — the parts, plant the loop
        step: 1,
        labels: [],
        camera: { position: [5.4, 5.2, -6.6], target: [0, 0.35, -0.5] },
        narration:
          'Lane assist is a camera that hunts for paint, plus a motor that leans on your wheel. So who’s actually steering?',
      },
      {
        step: 1,
        labels: [],
        camera: { position: [0.85, 1.6, -1.55], target: [0, 1.3, -0.25] },
        seconds: 1.4,
      },
      {
        step: 1,
        labels: [],
        camera: { position: [1.5, 1.7, -3.3], target: [0.1, 0.62, -1.35] },
        orbit: 10,
        seconds: 1.6,
      },

      {
        // Zone 4a — the camera looks for stripes, not roads
        step: 2,
        labels: [],
        camera: { position: [0.3, 4.2, 7.5], target: [-0.3, 0.2, -14] },
        move: 'cut',
        narration:
          'The camera behind your mirror scans the road row by row for edges where dark asphalt meets bright paint.',
      },
      {
        step: 2,
        labels: [],
        camera: { position: [0.6, 3.0, 1.0], target: [0.2, 0, -16] },
        push: 0.92,
        seconds: 1.8,
      },
      {
        step: 2,
        labels: [],
        camera: { position: [0, 9, 3], target: [0, 0, -19] },
        narration: 'From those edges it fits one smooth line on each side of your lane.',
      },

      {
        // Zone 4b — BUT: a line isn't a decision -> two numbers
        step: 3,
        labels: [],
        camera: { position: [-0.6, 9.5, 8.5], target: [-0.6, 0, -5.5] },
        narration:
          'So the car boils those lines into two numbers. Your distance from the middle, and which way you’re pointing.',
      },
      {
        step: 3,
        labels: [],
        camera: { position: [-0.4, 5.6, 7.6], target: [-0.4, 0, 0.8] },
        seconds: 1.8,
      },
      {
        step: 3,
        labels: [],
        camera: { position: [-0.6, 3.6, -3.0], target: [-1.5, 0, -20] },
        narration:
          'Stretch that heading forward and it hits the line. If that’s coming soon and your indicator’s off, you get a warning.',
      },
      {
        step: 3,
        labels: [],
        camera: { position: [-0.35, 4.6, 3.4], target: [-0.45, 0.5, -1.2] },
        seconds: 1.4,
      },

      {
        // Zone 4c — re-hook + the nudge (X-ray, car-locked frame)
        step: 4,
        labels: [],
        camera: { position: [1.0, 1.55, -1.95], target: [-0.3, 0.75, -0.75] },
        move: 'cut',
        narration:
          'Here’s the part that gets me. Instead of warning you, lane keep assist asks your power steering motor for extra torque.',
      },
      {
        step: 4,
        labels: [],
        camera: { position: [0.55, 1.15, -1.25], target: [-0.3, 0.72, -0.72] },
        push: 0.9,
        seconds: 1.6,
      },
      {
        step: 4,
        labels: [],
        camera: { position: [0.25, 1.75, -1.5], target: [-0.37, 0.93, -0.38] },
        narration: 'That torque turns the wheel a few degrees on its own, and the car eases back to the middle.',
      },
      {
        step: 4,
        labels: [],
        camera: { position: [0.9, 1.5, -3.6], target: [-0.5, 0.35, -1.3] },
        orbit: -10,
        seconds: 1.6,
      },

      {
        // Zone 5 — the stat, isolated on a hard cut
        step: 5,
        labels: [],
        camera: { position: [0.2, 1.55, 0.65], target: [-0.37, 0.93, -0.36] },
        move: 'cut',
        narration: 'But that torque is capped at about 3 newton metres.',
      },
      {
        step: 5,
        labels: [],
        camera: { position: [0.05, 1.42, 0.38], target: [-0.37, 0.95, -0.36] },
        push: 0.9,
        narration: 'That’s roughly a kilo and a half of push at the rim.',
      },
      {
        // Zone 6 — so-what: your hands win
        step: 5,
        labels: [],
        camera: { position: [0.3, 1.2, -0.15], target: [-0.37, 0.8, -0.63] },
        narration: 'So your hand always wins. A sensor in the column feels you push back, and the motor gives way.',
      },
      {
        step: 5,
        labels: [],
        camera: { position: [0.44, 1.55, 0.7], target: [-0.45, 0.88, -0.4] },
        orbit: 8,
        seconds: 1.6,
      },

      {
        // Zone 7 — button closes the loop, on the whole car running
        step: 7,
        labels: [],
        camera: { position: [0.9, 2.4, 10.5], target: [0, 0.6, -6] },
        narration: 'So who’s actually steering? You are. It never even saw the road.',
      },
      {
        step: 7,
        labels: [],
        camera: { position: [0.9, 2.4, 10.5], target: [0, 0.6, -6] },
        orbit: -14,
        seconds: 1.6,
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'Your lane assist has never seen a road',
      description:
        'A camera that hunts for paint, two numbers, and a steering motor capped at about 3 Nm, so your hands always win. #ADAS #LaneAssist #HowItWorks',
    },
  },
};
