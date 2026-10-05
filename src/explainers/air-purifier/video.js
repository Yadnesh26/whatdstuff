// steps: 0 sealed tower · 1 behind the wall · 2 pre-filter + HEPA
//        3 activated carbon · 4 the blower · 5 sensor · 6 run
export default {
  hook: 'This quiet cylinder is secretly cleaning your air.',

  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    followOverlay: { short: true },
  },

  short: {
    shots: [
      { step: 0, narration: 'This quiet cylinder is secretly cleaning your air, one layer at a time.' },
      { step: 0, frame: null, fill: 0.75, seconds: 1 },
      { step: 0, frame: null, seconds: 1 },

      { step: 1, narration: 'Pull that cylinder open and it’s just one cartridge, built from layer after layer stacked around a hollow core.' },
      { step: 1, frame: null, seconds: 1.2 },

      { step: 2, narration: 'So how do a few stacked layers catch dust you can’t even see?' },
      { step: 2, frame: null, fill: 0.7, seconds: 1 },
      { step: 2, narration: 'Those outer layers start simple, just a mesh sock for hair and lint. But right behind it, pleated HEPA paper does the real work.' },
      { step: 2, frame: null, fill: 0.65, seconds: 1 },
      { step: 2, narration: 'That HEPA layer alone traps better than ninety-nine percent of particles, some smaller than a third of a micron.' },
      { step: 2, frame: null, fill: 0.5, seconds: 1, push: 0.95 },

      { step: 3, narration: 'That traps the particles, but it does nothing for smells, so a carbon layer right behind it soaks up odors instead.' },
      { step: 3, frame: null, fill: 0.7, seconds: 1.2 },

      { step: 4, narration: 'None of that moves on its own though. A spinning fan above the carbon and the cartridge is what drags every bit of air through those layers.' },
      { step: 4, frame: null, fill: 0.7, seconds: 1.2 },

      { step: 5, narration: 'A laser sensor watches the air moving through those same layers, and speeds everything up the second things get dusty.' },
      { step: 5, frame: null, fill: 0.7, seconds: 1 },

      { step: 6, frame: null, seconds: 0.8 },
      { step: 6, narration: 'Still just a quiet cylinder, running through those same layers.' },
    ],
  },

  long: {
    shots: [
      { step: 0, seconds: 8, narration: 'This is an air purifier — from the outside, just a quiet cylinder with a ring of intake slots, a grille on top, and a status ring that glows a color for the air it senses. Every stage of the actual filtering happens hidden inside.' },
      { step: 1, seconds: 8, narration: 'Lift the side wall away and it’s really just one cartridge and one fan: a cylinder of filter media wrapped around a hollow core, with a small blower sitting above it to pull air up and out.' },
      { step: 2, seconds: 11, narration: 'Air gets pulled in from all 360 degrees around the tower. A fine mesh sock catches hair, fibers and large dust first — cheap insurance for the real work just behind it. That’s a pleated HEPA H13 filter, folded like an accordion to pack in surface area, and it captures 99.97% of particles down to 0.3 micron, the hardest size of all to trap.' },
      { step: 3, seconds: 9, narration: 'HEPA media is superb at catching solid particles, but it does nothing for gases. Right behind it, a layer of activated carbon — so porous that a single gram can have the surface area of a tennis court — adsorbs odor and VOC molecules straight out of the air.' },
      { step: 4, seconds: 8, narration: 'None of this moves on its own. A centrifugal blower above the cartridge drags air up through every one of those layers, then flings it sideways and out through the top grille — the one part of the system that never stops.' },
      { step: 5, seconds: 10, narration: 'A laser particle sensor near the base constantly samples the incoming air, estimating PM2.5 pollution in real time. Auto mode uses that reading to speed the fan up when the air is dirty and let it idle when it’s clean, reporting the same number back to you in the color of the ring.' },
      { step: 6, seconds: 7, narration: 'Mesh, HEPA, carbon, a blower, and a sensor watching all of it — sealed back up, it’s just a quiet cylinder in the corner of the room, doing all of that on every breath of air that passes through.' },
    ],
  },
};
