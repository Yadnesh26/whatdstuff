// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS (from story.js): your car never measures distance; it hears it as a
// pitch gap, and the brakes trust a clock (seconds to impact), not a ruler.
// Planted loop: the hook "has never measured the distance" -> closed by the
// button "It never measured distance. It listened to time.", which also
// re-primes the hook on replay.
//
// SCRIPTING: one flowing single-take voiceover; every line hands off into the
// next (so / but / here's). No em/en dashes, no colons.
//
// STAT PLACEMENT: "200 nanoseconds" gets a HARD CUT onto the chart's pitch-gap
// arrow, the picture of exactly that delay.
//
// LOOP PHASE (activate() starts a step's loop at phase 0 on first entry; the
// AEB lap is 14 s): dummy steps out 2.1 s, warn 2.1 s, pre-fill 2.7 s, partial
// 3.1 s, full 4.3 s, stop 5.4 s. The stages line starts on step entry, so
// "warns you ... readies the brakes ... brakes on its own" rides that cascade;
// the ESC line's pump pressure builds 2.7-5.4 s into its own entry.
//
// LABELS: every shot hides the in-scene callouts (labels: []). A 9:16 crop
// cuts right-anchored pills in half and the rest are illegible at phone size.
// Most callouts hang off empty anchors (blinds the auto-framer), so every shot
// carries an authored portrait camera.
export default {
  hook: 'Your car has never measured the distance to the car in front.',
  // the derived 'AUTOMATIC EMERGENCY BRAKING' overflows a 9:16 frame
  titleCard: 'EMERGENCY BRAKING',

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
        // Zone 1 — hook, sealed car following another
        step: 0,
        labels: [],
        camera: { position: [0.9, 2.6, 9.5], target: [0, 0.6, -14] },
        narration: 'Your car has never measured the distance to the car in front.',
      },
      {
        step: 0,
        labels: [],
        camera: { position: [1.4, 1.6, 4.2], target: [0, 0.7, -20] },
        push: 0.92,
        seconds: 1.2,
      },

      {
        // Zone 2 + 3 — the rising note, then the spoken question
        step: 1,
        labels: [],
        camera: { position: [3.0, 1.5, -6.5], target: [0, 0.55, -2.0] },
        move: 'cut',
        narration:
          'Instead, a radar behind the badge hums a note that keeps sliding up in pitch, over and over. So how does a note turn into a distance?',
      },
      {
        step: 1,
        labels: [],
        camera: { position: [7.9, 2.4, -1.1], target: [5.57, 1.78, -7.65] },
        seconds: 1.8,
      },

      {
        // Zone 4a — the late echo
        step: 2,
        labels: [],
        camera: { position: [7.9, 2.4, -1.1], target: [5.57, 1.78, -7.65] },
        narration:
          'The echo off the car ahead is the same rising note, only late. So at every instant it sits a little lower than what the radar is sending.',
      },
      {
        step: 2,
        labels: [],
        camera: { position: [4.0, 2.2, 2.0], target: [0, 0.7, -22] },
        seconds: 1.6,
      },
      {
        step: 2,
        labels: [],
        camera: { position: [7.2, 2.25, -2.6], target: [5.57, 1.78, -7.65] },
        narration: 'That gap in pitch is the distance. The further the car, the later the echo and the wider the gap.',
      },

      {
        // Zone 5 — the stat, isolated on a hard cut onto the gap arrow
        step: 2,
        labels: [],
        camera: { position: [6.8, 2.1, -4.3], target: [5.6, 1.75, -7.65] },
        move: 'cut',
        narration: 'From a car 30 metres away, that echo is just 200 nanoseconds late.',
      },

      {
        // Zone 4b — Doppler + time to collision
        step: 3,
        labels: [],
        camera: { position: [6.6, 2.9, -0.4], target: [3.2, 2.1, -10.5] },
        narration:
          'And if the gap is closing, the echo comes back squeezed a touch higher. Distance divided by closing speed gives the number the brakes actually care about, the seconds left until impact.',
      },
      {
        step: 3,
        labels: [],
        camera: { position: [4.2, 3.3, -6.0], target: [1.4, 3.1, -12.5] },
        push: 0.92,
        seconds: 1.6,
      },

      {
        // re-hook — people barely exist on radar
        step: 4,
        labels: [],
        camera: { position: [0.3, 4.0, 7.0], target: [-0.3, 0.3, -18] },
        move: 'cut',
        narration:
          'Here’s the hard part. To that radar, a person barely exists. So the camera recognises the shape, and the radar confirms where it’s heading.',
      },
      {
        step: 4,
        labels: [],
        camera: { position: [1.6, 2.4, -1.0], target: [0.4, 0.9, -14] },
        seconds: 1.8,
      },

      {
        // Zone 4c — the staged response
        step: 5,
        labels: [],
        camera: { position: [0.7, 3.4, 7.2], target: [0.4, 1.0, -6] },
        narration:
          'As those seconds run down, the car warns you and readies the brakes, before it finally brakes on its own.',
      },
      {
        step: 5,
        labels: [],
        camera: { position: [2.4, 2.3, 1.6], target: [1.0, 1.2, -6] },
        seconds: 1.6,
      },

      {
        // Zone 6 — so-what: nobody presses the pedal
        step: 6,
        labels: [],
        camera: { position: [-1.6, 2.3, -3.3], target: [0, 0.5, -1.0] },
        move: 'cut',
        narration:
          'Nobody touches the pedal, though. The stability control unit has its own pump, and it pushes fluid straight to all four brakes.',
      },
      {
        step: 6,
        labels: [],
        camera: { position: [-1.2, 1.4, -2.6], target: [-0.6, 0.4, -1.3] },
        push: 0.92,
        seconds: 1.6,
      },

      {
        // Zone 7 — button closes the loop
        step: 7,
        labels: [],
        camera: { position: [0.9, 2.4, 10.5], target: [0, 0.6, -6] },
        narration: 'It never measured distance. It listened to time.',
      },
      {
        step: 7,
        labels: [],
        camera: { position: [0.9, 2.4, 10.5], target: [0, 0.6, -6] },
        orbit: -12,
        seconds: 1.4,
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'Your car never measures the gap to the car ahead',
      description:
        'Its radar hears distance as a gap in pitch, and emergency braking runs on seconds to impact, not metres. #AEB #ADAS #HowItWorks',
    },
  },
};
