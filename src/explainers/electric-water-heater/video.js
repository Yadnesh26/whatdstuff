// Editorial layer for video export (scripts/export-video.mjs).
//
// LENS: "your shower doesn't run out of hot water, it hits a line" — the
// packaging promise is a thing every viewer has physically felt, and the
// mechanism (stratification) is the uncommon angle that explains it. Planted
// loop: "that line is climbing while you stand there" (shot 1) → "the line
// just arrived" (shot 8), which also re-primes the hook on replay.
//
// SCRIPTING: one flowing single-take voiceover; each line hands off into the
// next (shot 3 ends "down to the floor", shot 4 opens "and there it stays").
// No em/en dashes anywhere — ElevenLabs renders them as dead air.
//
// STAT PLACEMENT: the isolated number is the interlock, not the wattage — two
// 4,500 W elements that can never both be live is the surprise; 4,500 W on its
// own is just a spec.
export default {
  hook: 'Your shower doesn’t run\nout of hot water.',

  // Declared render config (see export-content skill, step 0). The end card and
  // the follow overlay are outward-facing promises to a viewer, so they stay
  // OFF until the user asks for them by name.
  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    followOverlay: false,
    fps: 30,
  },

  // 9:16 — ~78s at the channel voice's pace (8 beats).
  short: {
    shots: [
      {
        // Zone 1 — hook + the planted loop, on the sealed product. No callouts:
        // the hook names no part, and a clean product shot stops the scroll.
        step: 0,
        dolly: 1.9,
        labels: [],
        frame: null,
        narration:
          'Your shower doesn’t run out of hot water. It hits a line. And that line is climbing while you stand there.',
      },
      {
        // Zone 2+3 — strip it back to nothing, then ask the question out loud
        step: 1,
        dolly: 1.7,
        labels: ['Foam insulation', 'Glass-lined steel tank'],
        frame: null,
        narration:
          'That line lives in here, and there’s barely anything else. A steel bottle, a coat of foam, and two wires. So why does perfect water go freezing in ten seconds?',
      },
      {
        // Zone 4a — the thing that looks like a design error
        step: 2,
        dolly: 1.6,
        labels: ['Dip tube', 'Cold dumped at the floor'],
        frame: null,
        narration:
          'The answer is the two pipes on top. Cold water goes in right beside where hot leaves, but a plastic tube carries that cold straight to the floor.',
      },
      {
        // Zone 4b — THEREFORE: it stays down there, and the tank stacks
        step: 3,
        dolly: 1.55,
        labels: ['Thermocline'],
        frame: null,
        narration:
          'And there it stays. Hot water is about one and a half percent lighter, so it floats, and the two stack with a boundary only centimetres thick. That is your line.',
      },
      {
        // Zone 4c — the re-hook: the surprise IS the pattern interrupt, so it
        // gets said flat instead of announced. Camera holds on the same step.
        step: 3,
        dolly: 1.5,
        labels: ['Thermocline', 'Hot — 60 °C'],
        frame: null,
        narration:
          'And your tank never cools down while you shower. Everything above that line is still perfectly hot. It just has to reach the top.',
      },
      {
        // Zone 5 — the stat, isolated on its own beat
        step: 4,
        // An art-directed shot KEEPS its dolly (the solver is skipped), so this
        // has to be 1 or the pose below gets pushed back 1.45x.
        dolly: 1,
        labels: ['Upper element — 4,500 W', 'Lower element — 4,500 W'],
        frame: ['Upper element — 4,500 W', 'Lower element — 4,500 W'],
        // Art-directed, not solved. The solver only translates the target and
        // dollies, so it kept step 4's authored azimuth (chosen for the desktop
        // 16:9 shot) and portrait then filled half the frame with the jacket
        // wall, leaving both elements at the edges. This looks straight into
        // the wedge along the element axis, with the target set 0.16 below the
        // element midpoint so the pair rides above the caption rail.
        camera: { position: [-1.16, 1.6, 2.89], target: [-0.14, 1.16, 0.1] },
        narration:
          'And once it does, refilling takes two elements, four and a half thousand watts each. But they’re wired so both can never be live at once.',
      },
      {
        // Zone 6 — the so-what, back on the tank so the line reads
        step: 3,
        dolly: 1.55,
        labels: ['Thermocline'],
        frame: null,
        // These two solve AFTER the art-directed shot 6, and frameSubject takes
        // its direction from the live camera, so they inherit a slightly
        // tighter angle and clip the plinth corner at the default 0.88.
        fill: 0.78,
        narration:
          'So the elements take turns, and they claw back about eighty litres an hour. A bigger tank won’t give you hotter water. It buys you more minutes before the line gets there.',
      },
      {
        // Zone 7 — button, closes the loop and re-primes the hook on replay
        step: 7,
        dolly: 1.9,
        labels: [],
        frame: null,
        fill: 0.78,
        narration: 'You didn’t run out. The line just arrived.',
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'Your shower doesn’t run out of hot water',
      hashtags: ['#waterheater', '#howitworks', '#engineering', '#science', '#whatdstuff'],
    },
  },
};
