// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS (from story.js): a 3D printer never prints in 3D. It draws one flat
// layer of melted plastic, steps up 0.2 mm and draws the next. Planted loop:
// the hook "never actually prints in 3D" / "flat lines" -> closed by the button
// "Stack enough flat drawings, and you get 3D.", which also re-primes the hook
// on replay.
//
// SCRIPTING: one flowing single-take voiceover; lines hand off with so / but /
// to / here's. No em/en dashes, no colons, no comma lists.
//
// STAT PLACEMENT: "Two hundred and fifty layers" gets its own hard cut onto a
// tight, art-directed shot of the half-printed rook under the nozzle.
//
// LABELS: every shot hides the in-scene callouts (labels: []). A 9:16 crop
// cuts right-anchored pills in half (same call as dishwasher / ABS shorts).
// Framing is solved from `frame` callout names; the stat shot is the one
// authored camera.
const hidden = { labels: [] };

export default {
  hook: 'A 3D printer never actually prints in 3D.',

  // Requested explicitly: short only, captioned + follow overlay. No end card.
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
      // Zone 1 - hook on the whole printer, then in toward the nozzle
      {
        step: 0,
        ...hidden,
        frame: null,
        narration: 'A 3D printer never actually prints in 3D.',
      },
      { step: 0, ...hidden, camera: { position: [0.55, 1.15, 1.5], target: [0, 1.0, 0.15] }, push: 0.9, seconds: 1.4 },

      // Zone 2 - stack the second surprise, plant the "flat" loop
      {
        step: 0,
        ...hidden,
        camera: { position: [0.55, 1.15, 1.5], target: [0, 1.0, 0.15] },
        orbit: 12,
        narration: 'It only ever draws flat lines of melted plastic, one thin layer at a time.',
      },
      { step: 5, ...hidden, frame: ['Print bed'], seconds: 1.6 },

      // Zone 3 - the spoken question
      {
        step: 0,
        ...hidden,
        frame: null,
        move: 'cut',
        orbit: -10,
        narration: 'So how do flat drawings turn into a solid little castle?',
      },

      // Zone 4a - slicing
      {
        step: 1,
        ...hidden,
        frame: null,
        fill: 0.76,
        push: 0.92,
        narration: 'First, software slices the model into layers a fifth of a millimetre thick.',
      },
      {
        step: 1,
        ...hidden,
        frame: ['One layer: 2 walls + 15% infill'],
        orbit: 8,
        narration: 'Each slice becomes a path, with walls around the edge and a sparse grid inside.',
      },
      { step: 1, ...hidden, frame: null, rise: 0.15, seconds: 1.2 },

      // Zone 4b - the extruder gear
      {
        step: 2,
        ...hidden,
        frame: ['Drive gear', 'Idler bearing'],
        move: 'cut',
        narration: 'To draw that path, a toothed gear bites into a string of plastic and shoves it down.',
      },
      { step: 2, ...hidden, frame: ['Drive gear'], fill: 0.68, push: 0.9, seconds: 1.6 },
      { step: 2, ...hidden, frame: null, seconds: 1.2 },

      // Zone 4c - the hotend, thermal view
      {
        step: 3,
        ...hidden,
        frame: null,
        move: 'cut',
        narration: 'But melt it too early and it jams. Only the very tip gets hot.',
      },
      { step: 3, ...hidden, camera: { position: [0.62, 1.12, 1.45], target: [0.04, 0.84, 0] }, seconds: 1.4 },
      {
        step: 3,
        ...hidden,
        frame: null,
        orbit: 10,
        narration: 'The block sits at two hundred and ten degrees, while a fan keeps everything above it cold.',
      },
      { step: 3, ...hidden, camera: { position: [0.3, 1.62, 1.3], target: [-0.2, 1.4, 0] }, seconds: 1.3 },

      // Zone 4d - re-hook: the bead at the nozzle tip (change of scale)
      {
        step: 4,
        ...hidden,
        camera: { position: [1.3, 2.0, 2.5], target: [-0.35, 1.5, 0.1] },
        move: 'cut',
        narration: "Here's the clever part. The nozzle squashes the melt into a flat bead.",
      },
      { step: 4, ...hidden, frame: ['Nozzle · 0.4 mm hole'], fill: 0.7, push: 0.9, seconds: 1.4 },
      {
        step: 4,
        ...hidden,
        camera: { position: [2.3, 1.85, 1.3], target: [0.1, 1.42, 0] },
        orbit: -8,
        narration: 'Its heat welds the bead to the layer below, and a second fan freezes it before it can sag.',
      },
      { step: 4, ...hidden, frame: null, fill: 0.74, seconds: 1.3 },

      // Zone 4e - two motors draw a layer, then step up
      {
        step: 5,
        ...hidden,
        frame: null,
        move: 'cut',
        narration: 'Two motors trace the shape. One slides the nozzle left and right, and the other slides the bed back and forth.',
      },
      { step: 5, ...hidden, camera: { position: [-0.25, 1.62, 1.05], target: [-0.72, 1.3, -0.05] }, seconds: 1.3 },
      { step: 5, ...hidden, camera: { position: [-0.5, 1.2, 1.45], target: [0, 1.0, 0.15] }, push: 0.9, seconds: 1.4 },
      {
        step: 5,
        ...hidden,
        frame: null,
        rise: 0.2,
        narration: 'Finish the layer, step up a fifth of a millimetre, and draw the next one.',
      },

      // Zone 5 - the stat, isolated on a hard cut onto the rook itself
      {
        step: 0,
        ...hidden,
        camera: { position: [0.32, 0.98, 0.78], target: [0, 0.78, 0.14] },
        move: 'cut',
        narration: 'This little rook? Two hundred and fifty layers.',
      },
      {
        step: 0,
        ...hidden,
        camera: { position: [0.32, 0.98, 0.78], target: [0, 0.78, 0.14] },
        move: 'cut',
        push: 0.9,
        seconds: 1.2,
      },

      // Zone 6 - so-what
      {
        step: 7,
        ...hidden,
        frame: null,
        move: 'cut',
        orbit: 14,
        narration: "That's why even a small print takes hours.",
      },

      // Zone 7 - button, closes the "flat" loop
      {
        step: 7,
        ...hidden,
        frame: null,
        fill: 0.8,
        orbit: 12,
        push: 0.95,
        narration: 'Stack enough flat drawings, and you get 3D.',
      },
    ],
  },
};
