// steps: 0 component · 1 rolled foil · 2 unrolling true length
//        3 charging Q=CV · 4 discharge flash · 5 smoothing ripple
export default {
  hook: 'This can is basically a tiny tank for electricity.',

  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    followOverlay: { short: true },
  },

  short: {
    shots: [
      { step: 0, narration: 'This can is basically a tiny tank for electricity.' },
      { step: 0, frame: ['Aluminum can'], seconds: 1 },
      { step: 0, frame: ['Polarity stripe (–)', 'Pressure-relief vent'], seconds: 1 },
      { step: 0, frame: ['Leads'], fill: 0.55, seconds: 0.8 },

      { step: 1, narration: 'Crack that tank open and it’s not simple plates at all, just two long ribbons of foil rolled up like a scroll.' },
      { step: 1, frame: ['Anode foil (+)', 'Cathode foil (–)'], seconds: 1 },
      { step: 1, frame: ['Paper separator + electrolyte'], seconds: 1 },

      { step: 2, narration: 'So how does something rolled up that tight hold any charge at all?' },
      { step: 2, frame: null, seconds: 1.2 },
      { step: 2, narration: 'Unroll what’s rolled up and the foil runs for meters, way more surface than the can lets on.' },
      { step: 2, frame: null, seconds: 1 },

      { step: 3, narration: 'But hook up a battery, and electrons pile onto one strip of foil while just as many get pushed off the other.' },
      { step: 3, frame: ['+ plate', '– plate'], seconds: 1.2 },

      { step: 4, narration: 'Between them sits a thin insulating layer that never lets those electrons cross, which is exactly why the charge stays put.' },
      { step: 4, frame: ['Dielectric'], seconds: 1 },

      { step: 5, narration: 'So that tank can dump its whole charge about a thousand times faster than it filled up, fast enough to fire a camera flash.' },
      { step: 5, frame: ['Stored energy, released'], fill: 0.55, seconds: 1, push: 0.95 },
      { step: 5, frame: null, seconds: 0.8 },

      { step: 6, narration: 'That same charge, filling on the peaks and draining into the dips, is what turns bumpy power into the smooth flow every chip needs.' },
      { step: 6, frame: null, seconds: 1 },
      { step: 6, narration: 'Still just a tiny tank, quietly powering the chip.' },
    ],
  },

  long: {
    shots: [
      { step: 0, seconds: 8, narration: 'This is a capacitor, one of the most common parts in all of electronics. Think of it as a very small, very fast battery — but instead of chemistry, it stores energy as raw electric charge.' },
      { step: 1, seconds: 9, narration: 'Crack one open and you find two long ribbons of metal foil, separated by a thin insulator, and wound into a tight roll. Rolling it packs a huge amount of foil into a tiny can.' },
      { step: 2, seconds: 9, narration: 'Unrolled, you can see the trick. The two foils run side by side for meters, never touching. The more surface area facing each other, the more charge the capacitor can hold.' },
      { step: 3, seconds: 10, narration: 'Connect a voltage and electrons rush onto one foil and off the other, until the capacitor pushes back just as hard. The charge it holds equals its capacitance times the voltage. Bigger plates or higher voltage, more stored energy.' },
      { step: 4, seconds: 9, narration: 'Now give that charge a path to flow, and it doesn’t trickle — it dumps, almost instantly. That sudden burst is how a camera flash fires, or how a defibrillator delivers its jolt.' },
      { step: 5, seconds: 9, narration: 'Its quiet everyday job is smoothing. Power supplies deliver electricity in bumps; the capacitor charges on the peaks and discharges in the dips, ironing those ripples into the steady voltage your chips need.' },
    ],
  },
};
