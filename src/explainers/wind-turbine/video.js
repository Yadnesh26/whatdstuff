// Editorial layer for video export (scripts/export-video.mjs).
// steps: 0 anatomy · 1 blade section + vector triangle · 2 twist/Betz streamtube
//        3 nacelle cutaway · 4 gearbox · 5 generator · 6 yaw & pitch
//        7 down the tower · 8 the run
export default {
  hook: 'It looks like the slowest\nmachine on Earth.',

  // 9:16 — single-take narration + word-synced caption rail.
  // 7-beat arc: hook (looks slow, isn't) -> stakes/loop (300 km/h, nothing is
  // pushing it) -> question -> mechanism (wing, apparent wind, lift, drivetrain)
  // -> re-hook + isolated stat (59.3%) -> so-what -> button, which closes the
  // "nothing is pushing it" loop word for word and sets the hook up on replay.
  //
  // Dolly: the turbine is a TALL subject, so portrait actually frames it better
  // than landscape and the wide shots pull IN below the 1.35 base. The two
  // horizontal subjects (the expanding streamtube, the generator lying along
  // its shaft) are the ones that get cropped, so they push well past it.
  short: {
    dolly: 1.35,
    shots: [
      {
        // 1. hook
        step: 0,
        seconds: 5,
        dolly: 1.35,
        labels: [],
        narration: 'A wind turbine looks like the slowest machine on Earth. It isn’t.',
      },
      {
        // 2. stakes, plants the loop
        step: 0,
        seconds: 7,
        dolly: 1.35,
        labels: [],
        narration:
          'That blade tip is doing three hundred kilometres an hour, and nothing is pushing it.',
      },
      {
        // 3. the question, out loud
        step: 1,
        seconds: 5,
        dolly: 1.85,
        labels: [],
        narration: 'So what drags a seventy metre blade around that fast?',
      },
      {
        // 4. mechanism — the blade is a wing, and the wind it feels isn't yours
        step: 1,
        seconds: 11,
        dolly: 1.85,
        labels: [],
        narration:
          'The blade is a wing. It races sideways seven times faster than the wind you feel, so the air it meets arrives almost head on.',
      },
      {
        // 5. mechanism — lift, and the thin slice of it that actually turns
        step: 1,
        seconds: 13,
        dolly: 1.85,
        labels: [],
        narration:
          'A wing in moving air makes lift. Most of it shoves the tower backwards, but a thin slice points where the blade is going. That slice is the only thing turning the rotor.',
      },
      {
        // 6. mechanism — the drivetrain, fast so the stat lands next
        step: 5,
        seconds: 8,
        dolly: 1.85,
        labels: [],
        narration:
          'That spin goes into a gearbox that multiplies it a hundred times, then past a ring of magnets. Out comes current.',
      },
      {
        // 7. re-hook -> the ceiling nobody beats
        step: 2,
        seconds: 13,
        dolly: 1.9,
        labels: [],
        narration:
          'Here’s the part that gets me. No turbine can take all the wind. The air would have to stop dead in the disc, and stopped air blocks the air behind it.',
      },
      {
        // 8. the stat, isolated
        step: 2,
        seconds: 6,
        dolly: 1.9,
        labels: [],
        narration:
          'The ceiling is fifty nine point three percent. Nobody has ever beaten it.',
      },
      {
        // 9. so-what + button, closes the "nothing is pushing it" loop
        step: 8,
        seconds: 9,
        dolly: 1.35,
        labels: [],
        narration:
          'Real machines land near half that, and one tower still runs about two thousand homes. It was never pushed. It was pulled.',
      },
    ],
  },
};
