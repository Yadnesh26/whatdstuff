// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS (from story.js): you never turn the wheels, you twist a rod. Planted
// loop: "you're twisting a steel rod as thick as a pencil" (shot 3) -> closed
// word-for-word in the button "You twisted a rod", which also re-primes the
// hook ("Your hands have never turned your car's wheels") on replay.
//
// SCRIPTING: one flowing single-take voiceover; every line hands off into the
// next. No em/en dashes, no comma lists or colons (ElevenLabs pauses on them).
//
// STAT PLACEMENT: "three and a half degrees ... seven hundred kilos" is its own
// beat with a HARD CUT back onto the torsion-bar macro, then a silent cut onto
// the glowing power cylinder, so the two numbers each get their picture.
//
// LABELS: every shot hides the in-scene callouts (labels: []). A 9:16 crop cuts
// right-anchored pills in half and the rest are illegible at phone size (the
// dishwasher short's finding). Framing still uses the named callouts' parent
// geometry, so `frame` lists work with the labels hidden.
export default {
  hook: 'Your hands have never turned your car’s wheels.',

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
        // Zone 1 — hook, on the complete sealed rig
        step: 0,
        labels: [],
        frame: ['Steering wheel', 'Steering rack'],
        fill: 0.9,
        narration: 'Your hands have never turned your car’s wheels.',
      },
      {
        step: 0,
        labels: [],
        frame: ['Front tyre'],
        fill: 0.7,
        push: 0.9,
        seconds: 1.2,
      },

      {
        // Zone 2 — second surprise + planted loop, straight onto the rod
        step: 3,
        labels: [],
        frame: ['Torsion bar', 'Input shaft — from your wheel'],
        fill: 0.62,
        move: 'cut',
        narration:
          'Every time you steer, you’re twisting a steel rod as thick as a pencil. That twist is all the system listens to.',
      },
      {
        step: 3,
        labels: [],
        frame: ['Torsion bar', 'Input shaft — from your wheel'],
        fill: 0.55,
        push: 0.88,
        seconds: 2.0,
      },

      {
        // Zone 3 — the spoken question, whole rig running
        step: 6,
        labels: [],
        frame: ['Steering wheel', 'Steering rack'],
        fill: 0.9,
        orbit: -10,
        narration: 'So how does a twist that small drag two tyres across the road?',
      },
      {
        step: 6,
        labels: [],
        frame: ['Front tyre'],
        fill: 0.72,
        orbit: 12,
        seconds: 1.4,
      },

      {
        // Zone 4a — the plain mechanical path. Pinion macro FIRST, under
        // "a small gear on your column" (its label anchor isn't on rotating
        // geometry, so the camera is art-directed), then the tyres swinging.
        step: 1,
        labels: [],
        camera: { position: [1.05, 1.78, 0.36], target: [0.8, 1.5, -0.38] },
        narration:
          'Start with the rack. A small gear on your column slides a toothed bar sideways, and the bar swings the tyres.',
      },
      {
        step: 1,
        labels: [],
        frame: ['Tie rod', 'Steering arm'],
        fill: 0.8,
        seconds: 2.4,
      },
      {
        step: 1,
        labels: [],
        frame: ['Tie rod', 'Steering arm'],
        fill: 0.7,
        orbit: -10,
        seconds: 1.4,
      },

      {
        // Zone 4b — BUT: the pump that never stops (open centre)
        step: 2,
        labels: [],
        frame: ['Vane rotor', 'Cam ring'],
        fill: 0.62,
        narration:
          'But an engine-driven pump keeps oil circling the whole time. With the wheel centred, it just flows back to the tank.',
      },
      {
        step: 2,
        labels: [],
        frame: ['Vane rotor'],
        fill: 0.5,
        push: 0.9,
        seconds: 1.6,
      },
      {
        step: 2,
        labels: [],
        frame: ['Pressure hose', 'Oil back to the reservoir'],
        fill: 0.8,
        seconds: 2.2,
      },

      {
        // Zone 4c — re-hook as a scale change: macro on the torsion bar
        step: 3,
        labels: [],
        frame: ['Torsion bar', 'Input shaft — from your wheel'],
        fill: 0.6,
        move: 'cut',
        narration:
          'Here’s the clever part. Your shaft isn’t bolted to that gear. Only that thin rod links them, so the rod twists first.',
      },
      {
        step: 3,
        labels: [],
        frame: ['Torsion bar'],
        fill: 0.62,
        push: 0.88,
        seconds: 2.4,
      },

      {
        // Zone 4d — THEREFORE: the twist is a valve
        step: 4,
        labels: [],
        frame: ['Spool — turns with your wheel', 'Sleeve — turns with the pinion'],
        fill: 0.78,
        narration:
          'That twist works a valve. It sends pump pressure to one side of the rack and opens the other side to the drain.',
      },
      {
        step: 4,
        labels: [],
        frame: ['Spool — turns with your wheel', 'Sleeve — turns with the pinion'],
        fill: 0.7,
        push: 0.9,
        seconds: 2.0,
      },

      {
        // Zone 4e — THEREFORE: the power cylinder
        step: 5,
        labels: [],
        camera: { position: [0.74, 2.01, 1.08], target: [-0.45, 1.5, -0.45] },
        narration: 'So oil floods one end of a cylinder and shoves a piston fixed to the bar.',
      },
      {
        step: 5,
        labels: [],
        camera: { position: [0.74, 2.01, 1.08], target: [-0.45, 1.5, -0.45] },
        orbit: 10,
        seconds: 1.6,
      },

      {
        // Zone 5 — THE STAT. Hard cut back onto the rod, then the push.
        step: 3,
        labels: [],
        frame: ['Torsion bar'],
        fill: 0.58,
        move: 'cut',
        narration:
          'Full assist arrives at just three and a half degrees of twist. That’s about seven hundred kilos of push.',
      },
      {
        step: 5,
        labels: [],
        camera: { position: [0.2, 1.8, 0.55], target: [-0.5, 1.5, -0.45] },
        move: 'cut',
        push: 0.9,
        seconds: 2.2,
      },

      {
        // Zone 6 — so-what: it follows you (the servo closes itself)
        step: 5,
        labels: [],
        camera: { position: [-1.55, 2.05, 1.0], target: [-0.4, 1.5, -0.45] },
        narration:
          'But the moving bar turns the gear after your hands. So the twist unwinds and the valve closes.',
      },
      {
        step: 3,
        labels: [],
        frame: ['Torsion bar', 'Input shaft — from your wheel'],
        fill: 0.6,
        seconds: 2.0,
      },

      {
        // Zone 7 — button, closes the loop; sealed rig, sets up the replay
        step: 6,
        labels: [],
        frame: ['Steering wheel', 'Steering rack'],
        fill: 0.9,
        narration: 'You never turned the wheels. You twisted a rod.',
      },
      {
        step: 6,
        labels: [],
        frame: ['Steering wheel', 'Front tyre'],
        fill: 0.84,
        orbit: 12,
        seconds: 1.8,
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'Your hands never turn your car’s wheels',
      hashtags: ['#powersteering', '#cars', '#howitworks', '#engineering', '#whatdstuff'],
    },
  },
};
