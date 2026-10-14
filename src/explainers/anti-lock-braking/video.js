// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS (from story.js): ABS does not brake harder, it lets go on purpose,
// because a tyre that is still turning grips better than a sliding one and only
// a rolling wheel can steer. Planted loop: the hook "lets go of the brakes on
// purpose" -> closed by the button "It stops fastest by letting go.", which
// also re-primes the hook on replay.
//
// SCRIPTING: one flowing single-take voiceover; every line hands off into the
// next (so / but / here's). No em/en dashes, no colons.
//
// STAT PLACEMENT: "up to fifteen times every second" gets its own hard cut onto
// the pulsing circuit.
//
// LABELS: every shot hides the in-scene callouts (labels: []). A 9:16 crop cuts
// right-anchored pills in half. Callouts hang off empty anchors (blinds the
// auto-framer), so every shot carries an authored portrait camera.
export default {
  hook: 'Your car lets go of the brakes on purpose.',
  titleCard: 'ANTI-LOCK BRAKES',

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
      {
        // Zone 1 - hook, the sealed wheel on the moving road
        step: 0,
        labels: [],
        camera: { position: [1.2, 1.9, 5.8], target: [-2.2, 1.2, 0] },
        narration: 'Your car lets go of the brakes on purpose, again and again, in a panic stop.',
      },
      {
        step: 0,
        labels: [],
        camera: { position: [0.2, 1.8, 4.6], target: [-2.2, 1.1, 0] },
        push: 0.92,
        seconds: 1.4,
      },

      {
        // Zone 3 - the spoken question, then the tone ring
        step: 1,
        labels: [],
        camera: { position: [-4.4, 1.9, 3.4], target: [-2.4, 1.3, 0.2] },
        move: 'cut',
        narration:
          'So how does it know a wheel is about to lock? A toothed ring spins with the wheel, and a sensor makes one pulse for every tooth.',
      },
      {
        step: 1,
        labels: [],
        camera: { position: [-3.4, 1.7, 2.0], target: [-2.4, 1.3, 0.35] },
        seconds: 1.8,
      },
      {
        step: 1,
        labels: [],
        camera: { position: [-4.8, 2.4, 4.6], target: [-2.2, 1.2, 0.2] },
        orbit: 10,
        narration: 'Pulses per second is wheel speed, and a wheel that locks stops pulsing.',
      },

      {
        // Zone 4a - why locking is bad: the grip curve
        step: 2,
        labels: [],
        camera: { position: [1.8, 2.6, 7.6], target: [-0.8, 1.6, 0] },
        move: 'cut',
        narration:
          'Here is why that matters. Grip peaks when the tyre slips about fifteen percent. Lock the wheel and it grips less than when it was still turning.',
      },
      {
        step: 2,
        labels: [],
        camera: { position: [1.8, 2.5, 4.2], target: [0.35, 2.3, -0.3] },
        seconds: 1.8,
      },
      {
        step: 2,
        labels: [],
        camera: { position: [0.6, 1.8, 3.8], target: [-2.0, 0.8, 0.2] },
        seconds: 1.6,
      },

      {
        // Zone 4b - hold, release, reapply
        step: 3,
        labels: [],
        camera: { position: [0.9, 2.4, 6.9], target: [0.6, 0.8, 0.3] },
        move: 'cut',
        narration:
          'So when a wheel starts to lock, a valve closes to hold the pressure. Then another opens, and the fluid drains away while a pump sends it back.',
      },
      {
        step: 3,
        labels: [],
        camera: { position: [0.5, 1.7, 3.4], target: [0.2, 0.8, 0.3] },
        push: 0.92,
        seconds: 2.0,
      },

      {
        // Zone 5 - the stat, isolated on a hard cut
        step: 4,
        labels: [],
        camera: { position: [1.8, 2.8, 7.6], target: [0.2, 1.6, 0.2] },
        move: 'cut',
        narration: 'So it lets go, and grabs again, up to fifteen times every second.',
      },

      {
        // Zone 6 - so-what: the buzz
        step: 4,
        labels: [],
        camera: { position: [4.9, 2.0, 3.6], target: [3.45, 0.8, 0.4] },
        move: 'cut',
        narration: 'That pump shoving fluid back is the buzz you feel in the pedal. The pedal is not broken. The brakes are letting go.',
      },
      {
        step: 4,
        labels: [],
        camera: { position: [3.6, 2.6, 6.0], target: [1.4, 0.9, 0.3] },
        seconds: 1.8,
      },

      {
        // re-hook - steering
        step: 5,
        labels: [],
        camera: { position: [-2.2, 4.4, -6.6], target: [-2.2, 0.9, -0.2] },
        move: 'cut',
        narration:
          'But the real prize is steering. When the brakes let go, the rolling tyre follows where you point it, while a sliding tyre only pushes where it is already going.',
      },
      {
        step: 5,
        labels: [],
        camera: { position: [-2.2, 2.8, -4.8], target: [-2.2, 0.7, -0.3] },
        push: 0.92,
        seconds: 1.8,
      },

      {
        // Zone 7 - button closes the loop
        step: 6,
        labels: [],
        camera: { position: [1.6, 2.2, 6.2], target: [-2.2, 1.2, 0.1] },
        move: 'cut',
        narration: 'It lets go to stop fastest.',
      },
      {
        step: 6,
        labels: [],
        camera: { position: [1.6, 2.2, 6.2], target: [-2.2, 1.2, 0.1] },
        orbit: -12,
        seconds: 1.4,
      },
    ],
  },

  platforms: {
    // not published (short only); filled so the posting kit has no TODOs
    youtube: {
      title: 'How ABS Works: Your Car Lets Go of the Brakes on Purpose',
      description: 'A toothed ring counts wheel speed, then valves release and reapply brake pressure up to 15 times a second so the tyre keeps rolling and the car keeps steering.',
      tags: ['ABS', 'anti-lock brakes', 'how it works', 'brakes', 'car tech'],
    },
    shorts: {
      title: 'Your car lets go of the brakes on purpose',
      description:
        'ABS counts wheel speed with a toothed ring, then releases and reapplies the brakes up to 15 times a second so the tyre keeps rolling and you keep steering. #ABS #CarTech #HowItWorks',
      hashtags: ['ABS', 'CarTech', 'HowItWorks'],
    },
  },
};
