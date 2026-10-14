// Editorial layer for video export (scripts/render.mjs → export-video.mjs).
//
// SCRIPTING: one flowing voiceover (single ElevenLabs take) on the
// video-scripting spine. Angle: an airbag is a controlled explosion that is
// already letting go by the time you hit it. Loop: the hook plants "already
// going flat when you hit it" and the button closes it with "It was already
// letting go." — which also leads straight back into the hook on replay. The
// stat (forty milliseconds, contact to a full bag) gets a hard cut to the bag
// fully out. Silent shots carry the cutting.
//
// LOOP SYNC: every step plays the whole crash event on a time-warp; a step's
// loop starts at phase 0 when it is first activated, so the lines are timed
// against each step's lap (see index.js warps).
//
// In-scene callouts are hidden for the 9:16 crop (labels: []). The clock sprite
// is scene geometry, so it stays.
//
// steps: 0 rig · 1 inside · 2 sense · 3 ignite · 4 burst · 5 land · 6 stages · 7 run
export default {
  hook: 'An airbag is already going flat when you hit it.',

  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    followOverlay: { short: true },
    speed: 1.0,
  },

  short: {
    shots: [
      // 1 · hook — the whole rig, then the crash
      { step: 0, camera: { position: [6.2, 3.4, 6.6], target: [0.9, 2.3, 0] }, labels: [], push: 0.94,
        narration: "An airbag is already going flat when you hit it. It's a controlled explosion, built to leak." },
      { step: 0, camera: { position: [3.6, 2.8, 6.0], target: [0.9, 2.2, 0] }, labels: [], seconds: 2.2 },
      { step: 0, camera: { position: [-3.4, 3.2, 6.6], target: [0.6, 2.3, 0] }, labels: [], orbit: 10, seconds: 2.4 },
      // 2 · question
      { step: 0, camera: { position: [3.4, 3.0, 5.0], target: [0.7, 2.4, 0] }, labels: [], push: 0.95,
        narration: 'So how does a bag fire in a blink and still not punch you?' },
      // 3 · reveal — the module
      { step: 1, frame: ['Inflator', 'Folded bag'], fill: 0.8, labels: [], move: 'cut',
        narration: 'Behind a seam in the wheel, the bag sits folded on a can of powder, wired to the car by one yellow cable.' },
      { step: 1, frame: ['Squib (igniter)'], fill: 0.6, labels: [], push: 0.92, seconds: 2.4 },
      // 4 · the decision
      { step: 2, camera: { position: [0.2, 1.9, 5.4], target: [-2.2, 0.5, 0.3] }, labels: [], move: 'cut',
        narration: "But first the car has to know it's crashing. A sensor in the crumple zone feels the slam, and the control unit adds up the slowdown until it crosses a line." },
      { step: 2, camera: { position: [3.0, 1.8, 5.0], target: [2.4, 1.15, 0.5] }, labels: [], push: 0.93, seconds: 3 },
      { step: 2, camera: { position: [1.9, 1.4, 2.7], target: [0.55, 0.5, 0.1] }, labels: [], seconds: 2.2 },
      { step: 2, camera: { position: [1.9, 1.4, 2.7], target: [0.55, 0.5, 0.1] }, labels: [], orbit: -10,
        narration: 'About twenty milliseconds in, the unit fires current down the wire.' },
      // 5 · the burn
      { step: 3, camera: { position: [-0.5, 2.1, 2.1], target: [-0.5, 2.0, 0] }, labels: [], move: 'cut',
        narration: 'That current heats a hair-thin wire, which lights a ring of pellets.' },
      { step: 3, camera: { position: [-0.5, 2.1, 2.1], target: [-0.5, 2.0, 0] }, labels: [], push: 0.8, seconds: 2.4 },
      // authored: the solver's close oblique pose put the wheel's near rim between the lens and the hub
      { step: 4, camera: { position: [3.2, 2.5, 2.0], target: [0.0, 1.96, 0] }, labels: [], move: 'cut',
        narration: 'The pellets turn into hot gas, and the gas bursts the cover along its seam.' },
      // 6 · the stat — hard cut
      { step: 4, camera: { position: [4.6, 2.8, 5.0], target: [0.9, 2.2, 0] }, labels: [], move: 'cut',
        narration: "Forty milliseconds. That's first contact to a full bag." },
      // 7 · so-what — leak and load
      { step: 5, camera: { position: [3.6, 2.8, 6.0], target: [0.9, 2.2, 0] }, labels: [], move: 'cut',
        narration: "You haven't even started moving. You arrive around sixty, and the bag has leaked through two small holes since the second it filled." },
      { step: 5, camera: { position: [4.6, 2.8, 5.0], target: [0.9, 2.2, 0] }, labels: [], seconds: 2.4 },
      { step: 5, camera: { position: [-3.4, 3.2, 6.6], target: [0.6, 2.3, 0] }, labels: [], orbit: -8,
        narration: 'So it gives under you, and your head slows over a longer stop.' },
      // 8 · dual stage
      { step: 6, camera: { position: [-0.5, 2.15, 2.4], target: [-0.5, 2.05, 0] }, labels: [], move: 'cut',
        narration: 'Mild crash, one chamber. Hard crash, two.' },
      // 9 · button — closes the loop, leads back into the hook
      { step: 7, camera: { position: [6.2, 3.4, 6.6], target: [0.9, 2.3, 0] }, labels: [], push: 0.94, move: 'cut',
        narration: 'It was already letting go.' },
    ],
  },

  platforms: {
    youtube: {
      title: 'Your Airbag Is Already Going Flat When You Hit It',
      description:
        'A car airbag is a controlled explosion built to leak. A crash sensor and a MEMS accelerometer decide in about 20 milliseconds, a squib lights a ring of propellant pellets, the gas bursts the cover along its tear seam and fills the bag in about 40 ms, and vent holes let it deflate as you load it. The mechanism, slowed down, in 3D.',
      tags: ['airbag', 'how airbags work', 'car safety', 'crash sensor', 'accelerometer', 'inflator', 'squib', 'physics', 'engineering', 'whatdstuff'],
    },
    shorts: {
      title: 'Your airbag is already going flat when you hit it',
      hashtags: ['#airbag', '#carsafety', '#howitworks', '#engineering', '#physics', '#whatdstuff'],
    },
  },
};
