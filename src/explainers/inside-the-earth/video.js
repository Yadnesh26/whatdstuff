// Editorial layer for video export (scripts/export-video.mjs).
// steps: 0 sealed planet · 1 layers (octant) · 2 crust slab (×60) ·
//        3 mantle convection · 4 seismic X-ray · 5 outer-core dynamo ·
//        6 inner core · 7 sealed again
//
// LENS (from story.js): nobody has ever gone deep, yet we know the centre
// solid and Sun-hot, because Earth has been quietly telling on itself for a
// century. Planted loop: "centre" + "Earth's" (hook) -> "Earth's centre...
// we've only ever heard it" (button), which re-primes the hook on replay.
//
// SCRIPTING: one flowing single-take voiceover; every line hands off into
// the next on a repeated word ("centre" hook->stakes, "Earth" stakes-
// >question->crust, "rock" mantle->earthquakes, "waves"/"core" through the
// evidence chain, "down" stat->so-what, "keeps" so-what->shield, "Earth's"
// shield->button). No em/en dashes anywhere (ElevenLabs renders them as dead
// air the speed knob can't compress).
export default {
  hook: 'Earth’s centre is a solid metal ball, as hot as the sun.',

  // Requested explicitly: captioned + follow overlay. No end card (not asked).
  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    titleCard: true,
    endCard: false,
    followOverlay: true,
    fps: 30,
  },

  short: {
    shots: [
      {
        // Zone 1 — hook, cold open on the one thing it's actually about
        step: 6,
        labels: ['Inner core · ~5,400 °C'],
        frame: ['Inner core · ~5,400 °C'],
        fill: 0.6,
        narration: 'Earth’s centre is a solid metal ball, as hot as the sun.',
      },
      {
        step: 6,
        labels: ['Inner core · ~5,400 °C'],
        frame: ['Inner core · ~5,400 °C'],
        push: 0.95,
        seconds: 1.3,
      },

      {
        // Zone 2 — pull back wide, stakes + planted loop
        step: 0,
        labels: [],
        frame: null,
        fill: 0.62,
        move: 'cut',
        narration: 'Nobody’s ever gone near that centre. Earth just quietly told on itself.',
      },
      {
        // foreshadow the evidence to come, a quick flash
        step: 4,
        labels: ['Earthquake'],
        frame: ['Earthquake'],
        move: 'cut',
        seconds: 1.0,
      },
      {
        step: 0,
        labels: [],
        frame: null,
        orbit: 6,
        seconds: 1.3,
      },

      {
        // Zone 3 — the spoken question
        step: 0,
        labels: [],
        frame: null,
        fill: 0.72,
        push: 0.95,
        narration: 'So how do you map an Earth you’ll never touch?',
      },
      {
        // crust visuals ride here, silent — the callouts show what the next
        // line names, so the line never has to introduce the word "crust"
        step: 1,
        labels: ['Crust'],
        frame: ['Crust'],
        move: 'cut',
        seconds: 1.2,
      },
      {
        step: 2,
        labels: ['Crust at true scale', 'Oceanic crust · ~7 km', 'Continental crust · ~35 km'],
        frame: ['Crust at true scale', 'Oceanic crust · ~7 km', 'Continental crust · ~35 km'],
        move: 'cut',
        seconds: 1.5,
      },

      {
        // Zone 4a — mantle: solid rock that flows
        step: 3,
        labels: ['Hot rock rising', 'Cool rock sinking'],
        frame: ['Hot rock rising', 'Cool rock sinking'],
        fill: 0.58,
        move: 'cut',
        narration:
          'Go past the crust of Earth and it’s solid rock for thousands of kilometres. Heated from below, it rises and sinks, like the world’s slowest lava lamp.',
      },
      {
        step: 3,
        labels: ['Core–mantle boundary · 2,890 km'],
        frame: ['Core–mantle boundary · 2,890 km'],
        push: 0.95,
        seconds: 1.4,
      },

      {
        // Zone 4b — re-hook + the seismic evidence
        step: 4,
        labels: ['Earthquake'],
        frame: ['Earthquake'],
        fill: 0.64,
        move: 'cut',
        narration: 'Here’s the part that gets me: earthquakes send waves through all that moving rock.',
      },
      {
        step: 4,
        labels: ['P wave', 'S wave'],
        frame: ['P wave', 'S wave'],
        narration: 'Every big one sends waves through the whole planet, and a wave that hits liquid just dies.',
      },
      {
        step: 4,
        labels: ['S waves die here', 'S-wave shadow zone'],
        frame: ['S waves die here', 'S-wave shadow zone'],
        move: 'cut',
        seconds: 1.4,
      },
      {
        step: 4,
        labels: ['S waves die here', 'S-wave shadow zone'],
        frame: ['S waves die here', 'S-wave shadow zone'],
        fill: 0.6,
        narration: 'So when one whole side of the Earth stopped feeling those waves, the core down there has to be molten.',
      },

      {
        // Zone 4c — the inner core, Lehmann's clue
        step: 6,
        labels: ['Bent by the inner core'],
        frame: ['Bent by the inner core', 'Lands in the P-wave shadow'],
        fill: 0.6,
        move: 'cut',
        narration: 'But a few of those waves through that same core still turned up exactly where they shouldn’t.',
      },
      {
        step: 6,
        labels: ['Lands in the P-wave shadow'],
        frame: ['Lands in the P-wave shadow'],
        push: 0.95,
        seconds: 1.4,
      },
      {
        step: 6,
        labels: ['Inner core · ~5,400 °C'],
        frame: ['Inner core · ~5,400 °C'],
        orbit: 6,
        narration:
          'In nineteen thirty six, that clue led one scientist to a second core, solid iron held rigid by pressure alone.',
      },

      {
        // Zone 5 — THE STAT, isolated, hard cut back to the crust slab
        step: 2,
        labels: ['Kola borehole · 12.3 km'],
        frame: ['Kola borehole · 12.3 km'],
        fill: 0.55,
        move: 'cut',
        narration: 'Compare that to the crust above the core: the deepest hole ever drilled only reached twelve kilometres down.',
      },
      {
        step: 2,
        labels: ['Kola borehole · 12.3 km'],
        frame: ['Kola borehole · 12.3 km'],
        push: 0.95,
        seconds: 1.6,
      },
      {
        step: 2,
        labels: ['Crust at true scale'],
        frame: ['Crust at true scale'],
        narration: 'That’s two tenths of one percent of the way down.',
      },

      {
        // Zone 6 — so-what: the shield that keeps us alive
        step: 5,
        labels: ['Liquid iron, churning'],
        frame: ['Liquid iron, churning'],
        fill: 0.6,
        move: 'cut',
        narration: 'And down there, that same core keeps us alive up here.',
      },
      {
        step: 5,
        labels: ['Magnetic field'],
        frame: ['Magnetic field'],
        orbit: 8,
        seconds: 1.4,
      },
      {
        step: 5,
        labels: ['Magnetic field'],
        frame: ['Magnetic field'],
        orbit: 10,
        narration: 'Its churn throws up the magnetic shield that keeps Earth’s atmosphere from being stripped away.',
      },

      {
        // Zone 7 — button, closes the "centre" / "Earth's" loop from the hook
        step: 7,
        labels: [],
        frame: null,
        fill: 0.68,
        narration: 'Earth’s centre: we’ve only ever heard it.',
      },
      {
        step: 7,
        labels: [],
        frame: null,
        orbit: 12,
        seconds: 2.6,
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'We mapped the centre of the Earth without ever touching it',
      hashtags: ['#earth', '#geology', '#science', '#howitworks', '#whatdstuff'],
    },
  },
};
