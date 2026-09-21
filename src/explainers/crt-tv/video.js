// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS: "the picture is a lie your eye tells you" — nothing about a CRT
// picture is simultaneous; it is one dot, redrawn fast enough to fool
// persistence of vision. Planted loop: "just one dot of light" (shot 1) →
// "just one very fast dot" (button), which also re-primes the hook on replay.
//
// SCRIPTING: one flowing single-take voiceover; each line hands off into the
// next (shot 4 ends on the sweep rate, shot 5 opens "that's your one dot").
// No em/en dashes anywhere — ElevenLabs renders them as dead air.
//
// STAT PLACEMENT: the isolated number is the shadow mask's 85% loss, not the
// anode voltage or the beam speed — those are staged earlier as connective
// tissue toward the mechanism; the mask number is the one nobody expects.
export default {
  hook: 'Nothing on this screen is real.',

  // Declared render config (see export-content skill, step 0). captions and
  // followOverlay were both requested explicitly by name.
  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    followOverlay: true,
    fps: 30,
  },

  // 9:16 — ~80s at the channel voice's pace (8 beats).
  short: {
    shots: [
      {
        // Zone 1+2 — hook + planted loop, on the sealed product. No callouts:
        // the hook names no part, and a clean product shot stops the scroll.
        step: 0,
        labels: [],
        frame: null,
        narration:
          "Nothing on this screen is real. There's no picture in here, just one dot of light, about to hit a third of the speed of light.",
      },
      {
        // Zone 3 — the spoken question, into the mechanism's first stage.
        // Art-directed: the auto-solver's inherited azimuth put the permanent
        // EHT lead (a chassis part, always in-scene once revealed) right across
        // this tiny subject. This is the same clean pose the main explainer's
        // "gun" step already uses (screenshot-verified, no occluders).
        step: 2,
        labels: ['Cathode · 800 °C'],
        dolly: 1.9,
        camera: { position: [-0.85, 1.82, -1.05], target: [0.06, 1.53, -0.46] },
        narration:
          "So how do you fire light that fast? You boil it. Three wires in the neck hit eight hundred degrees Celsius, hot enough to cook electrons right off the metal.",
      },
      {
        // Zone 4a — BUT: a cloud sitting still is useless, so it gets dropped.
        // Art-directed for the same reason as above: the solver on a subject
        // this small put the camera near the tube's dark rear interior.
        // Reusing the validated "anode" step pose.
        step: 3,
        labels: ['Anode button · 25 kV'],
        dolly: 2.6,
        camera: { position: [-2.7, 2.1, 1.35], target: [-0.47, 1.66, -0.06] },
        narration:
          "But a cloud of electrons going nowhere is useless. The tube's far end sits at twenty five thousand volts, and that's what launches them.",
      },
      {
        // Zone 4b — THEREFORE: something has to aim the beam it just launched.
        // Art-directed: the solver's fit on the tiny yoke coils pushed the
        // camera almost into the phosphor screen, filling the frame with a
        // blurred smear of the raster color bars. Reusing the validated
        // "yoke" step pose.
        step: 4,
        labels: ['Horizontal coils', 'Vertical coils'],
        dolly: 1.3,
        camera: { position: [-1.8, 2.05, 0.72], target: [-0.13, 1.56, -0.07] },
        narration:
          'So magnets grab that beam and sweep it side to side, more than fifteen thousand times a second.',
      },
      {
        // Zone 4c — re-hook: land back on the planted loop mid-script
        step: 5,
        labels: ['One dot, moving'],
        narration:
          "That's your one dot, drawing the picture line by line, then going dark and starting over, thirty times a second.",
      },
      {
        // Zone 4d — BUT: the twist nobody expects from the color trick
        step: 6,
        labels: ['Shadow mask'],
        narration:
          "But here's the part of that picture that gets me. Making color means throwing most of the beam away, on purpose.",
      },
      {
        // Zone 5 — the stat, isolated on its own beat with a fresh label
        step: 6,
        labels: ['Most of them hit metal'],
        narration: 'A steel mask blocks eighty five percent of it, before color even shows up.',
      },
      {
        // Zone 6 — so-what
        step: 7,
        labels: ['Red · green · blue'],
        narration:
          "That's the price for color, on a screen that only ever lights one dot at a time.",
      },
      {
        // Zone 7 — button, closes the loop and re-primes the hook on replay.
        // Art-directed: frame:null on a non-first shot only translates and
        // dollies the CURRENT camera, so this inherited the previous macro
        // shot's raked side azimuth and sat the screen near edge-on for
        // stretches of the sway loop, right as the video closes. Reuses the
        // "run" step's own camera POSITION (screenshot-verified 3/4 angle),
        // but with the target RECENTRED on the model instead of the desktop
        // pose's rule-of-thirds offset (which pushes the subject right to
        // clear the text panel — a panel that does not exist in this export
        // and made the raw desktop pose crop the sides in portrait).
        step: 8,
        labels: [],
        dolly: 1,
        // target.y nudged down from the model's true 1.5 centre: aiming the
        // camera slightly lower rides the subject higher in frame, clear of
        // the caption band at the bottom (same trick as bias, done by hand
        // because an authored `camera` skips the solver's own bias option).
        camera: { position: [-3.75, 2.85, 4.45], target: [0, 1.2, 0.1] },
        narration:
          "So next time an old TV switches on, remember what's really happening in there. It was never a picture. Just one very fast dot.",
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'Nothing on a CRT screen is real',
      hashtags: ['#crt', '#retrotech', '#howitworks', '#engineering', '#whatdstuff'],
    },
  },
};
