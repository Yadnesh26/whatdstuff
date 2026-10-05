// steps: 0 component (assembled) · 1 film on ceramic core (cutaway) ·
//        2 Ohm's law compare (long/thin vs short/thick) · 3 power becomes
//        heat · 4 reading the color code · 5 reassembled, running
//
// LENS: the four stripes aren't decoration, they're a spoken-out version of
// a groove you can't actually see. Planted loop: "stripes... describing a
// spiral" (hook) -> "stripes aren't paint, they're a shape" (button), both
// anchored on "stripes", which also returns the camera to the hook's own
// shot for the button.
//
// SCRIPTING: one flowing single-take voiceover; every line hands off into
// the next on a repeated word ("spiral" hook->stakes, "groove" stakes->
// question->geometry, "spiral"/"current"/"short"/"fat" geometry->compare,
// "push"/"through" compare->heat, "path" heat->code, "stripes" code->stat,
// "exact" stat->so-what, "shape" so-what->button). No em/en dashes anywhere
// (ElevenLabs renders them as dead air the speed knob can't compress).
//
// FRAMING: no per-step `focus` here either, so every shot (including silent
// ones) passes an explicit `frame`. Unlike phone-call this scene stays
// compact — every view (assembled/core/compare) is one small object — so
// the solver alone is enough; no `camera` escape hatch needed anywhere.
export default {
  hook: 'Those four colored stripes are describing a spiral you can’t see.',

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
        // Zone 1 — hook, cold open on the actual stripes. Framed on BOTH
        // labels (not just the bands alone) — a tight solve on the bands
        // alone pulls the camera up toward a stage light panel that's
        // normally out of frame; pairing with the body keeps the shot low.
        step: 0,
        labels: ['Ceramic body', 'Color code bands'],
        frame: ['Ceramic body', 'Color code bands'],
        fill: 0.68,
        narration: 'Those four colored stripes are describing a spiral you can’t see.',
      },
      {
        step: 0,
        labels: ['Ceramic body', 'Color code bands'],
        frame: ['Ceramic body', 'Color code bands'],
        fill: 0.62,
        push: 0.95,
        seconds: 1.3,
      },

      {
        // Zone 2 — stakes + planted loop, crack it open
        step: 1,
        labels: ['Resistive film (carbon/metal)', 'Helical trim groove sets R'],
        frame: ['Resistive film (carbon/metal)', 'Helical trim groove sets R'],
        fill: 0.55,
        move: 'cut',
        narration:
          'Crack it open and there’s no wire at all, just a hair-thin film with one long spiral groove cut through it.',
      },
      {
        step: 1,
        labels: ['Ceramic core (insulator)'],
        frame: ['Ceramic core (insulator)'],
        fill: 0.78,
        push: 0.95,
        seconds: 1.3,
      },

      {
        // Zone 3 — the spoken question, a tight tease on the groove itself
        step: 1,
        labels: ['Helical trim groove sets R'],
        frame: ['Helical trim groove sets R'],
        fill: 0.8,
        push: 0.95,
        narration: 'So how does cutting a groove turn into an exact number?',
      },

      {
        // Zone 4a — the groove forces current down one long track
        step: 1,
        labels: ['Helical trim groove sets R'],
        frame: ['Helical trim groove sets R'],
        fill: 0.8,
        move: 'cut',
        narration: 'That groove forces current down one long, narrow spiral track, instead of a short fat path.',
      },
      {
        step: 1,
        labels: ['Helical trim groove sets R'],
        frame: ['Helical trim groove sets R'],
        fill: 0.8,
        orbit: 8,
        seconds: 1.4,
      },

      {
        // Zone 4b — re-hook + Ohm's law, side by side
        step: 2,
        labels: ['Long & thin path -> higher R -> less current', 'Short & thick path -> lower R -> more current'],
        frame: ['Long & thin path -> higher R -> less current', 'Short & thick path -> lower R -> more current'],
        fill: 0.68,
        move: 'cut',
        narration:
          'Here’s the part that gets me: stretch that spiral longer and thinner, and the same push gets far less current through. Shrink it short and fat, and far more gets through.',
      },
      {
        step: 2,
        labels: ['Long & thin path -> higher R -> less current'],
        frame: ['Long & thin path -> higher R -> less current'],
        fill: 0.78,
        push: 0.97,
        seconds: 1.3,
      },
      {
        step: 2,
        labels: ['Short & thick path -> lower R -> more current'],
        frame: ['Short & thick path -> lower R -> more current'],
        fill: 0.78,
        push: 0.97,
        seconds: 1.3,
      },

      {
        // Zone 4c — power becomes heat. This step's onEnter turns every
        // callout PILL off (it's a pure glow beat), but `frame` reads a
        // callout's PARENT object for its box regardless of the pill's own
        // visibility (framework/player.js `subjectRoots`) — so naming the
        // groove's label here still frames tight on the glowing coil itself,
        // with the pill correctly staying hidden (`labels: []`).
        step: 3,
        labels: [],
        frame: ['Helical trim groove sets R'],
        fill: 0.75,
        move: 'cut',
        narration:
          'Every electron that scrapes through that narrow path loses energy as heat, and push it harder, that heat climbs fast.',
      },
      {
        step: 3,
        labels: [],
        frame: ['Helical trim groove sets R'],
        fill: 0.7,
        push: 0.94,
        seconds: 1.4,
      },

      {
        // Zone 4d — the stripes are the groove's own dimensions, in paint
        step: 4,
        labels: ['Brown = 1st digit (1)', 'Black = 2nd digit (0)', 'Red = multiplier (x100)', 'Gold = tolerance (+/-5%)'],
        frame: ['Brown = 1st digit (1)', 'Black = 2nd digit (0)', 'Red = multiplier (x100)', 'Gold = tolerance (+/-5%)'],
        fill: 0.8,
        move: 'cut',
        narration: 'Those four stripes are just the exact length and width of that path, spelled out in paint.',
      },

      {
        // Zone 5 — THE STAT, isolated, same shot, a hard beat closer
        step: 4,
        labels: ['Brown = 1st digit (1)', 'Black = 2nd digit (0)', 'Red = multiplier (x100)', 'Gold = tolerance (+/-5%)'],
        frame: ['Brown = 1st digit (1)', 'Black = 2nd digit (0)', 'Red = multiplier (x100)', 'Gold = tolerance (+/-5%)'],
        fill: 0.75,
        move: 'cut',
        narration: 'Brown, black, red, gold: those stripes read one, zero, times a hundred: an exact one thousand ohms.',
      },
      {
        step: 4,
        labels: ['Brown = 1st digit (1)', 'Black = 2nd digit (0)', 'Red = multiplier (x100)', 'Gold = tolerance (+/-5%)'],
        frame: ['Brown = 1st digit (1)', 'Black = 2nd digit (0)', 'Red = multiplier (x100)', 'Gold = tolerance (+/-5%)'],
        fill: 0.78,
        push: 0.96,
        seconds: 1.6,
      },

      {
        // Zone 6 — so-what: billions of the same exact shape
        step: 5,
        labels: [],
        frame: null,
        fill: 0.65,
        move: 'cut',
        narration: 'And that exact same shape, cut billions of times, is quietly setting the current in every gadget you own.',
      },
      {
        step: 5,
        labels: [],
        frame: null,
        fill: 0.65,
        orbit: 8,
        seconds: 1.3,
      },

      {
        // Zone 7 — button, closes the "stripes" loop on the hook's own shot.
        // Same body+bands pairing as the hook, for the same stage-prop
        // reason (see Zone 1).
        step: 0,
        labels: ['Ceramic body', 'Color code bands'],
        frame: ['Ceramic body', 'Color code bands'],
        fill: 0.68,
        move: 'cut',
        narration: 'Those stripes aren’t paint. They’re a shape.',
      },
      {
        step: 0,
        labels: ['Ceramic body', 'Color code bands'],
        frame: ['Ceramic body', 'Color code bands'],
        fill: 0.6,
        push: 0.95,
        seconds: 1.6,
      },
    ],
  },

  long: {
    shots: [
      { step: 0, seconds: 8, narration: 'This little striped cylinder is a resistor, probably the most common component in electronics. Its job sounds boring but it’s essential: it resists the flow of electric current, setting how much gets through.' },
      { step: 1, seconds: 9, narration: 'Inside the coating is a ceramic rod with a thin film of carbon or metal cut into a long spiral around it. Forcing the current down that long, narrow track is what creates the resistance.' },
      { step: 2, seconds: 10, narration: 'As electrons squeeze through, they collide and give up energy, and that energy comes out as heat. The power turned to heat grows with the current squared, which is why an overloaded resistor can scorch.' },
      { step: 3, seconds: 10, narration: 'You can read its value right off the body. Those colored bands are a numbering code — each color stands for a digit, and together they tell you the resistance in ohms, without any label or measurement.' },
      { step: 4, seconds: 9, narration: 'On its own it does nothing exciting. But placed by the billions, resistors divide voltages, limit currents, and protect delicate parts. Every gadget you own is full of these quiet little traffic controllers.' },
    ],
  },

  platforms: {
    shorts: {
      title: 'Those color stripes are secretly describing a shape',
      hashtags: ['#resistor', '#electronics', '#howitworks', '#science', '#whatdstuff'],
    },
  },
};
