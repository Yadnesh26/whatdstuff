// Phase 0 artifact — written BEFORE the model (add-explainer skill, Phase 0).
// Pure data, no imports, never bundled: the registry globs only meta.js and
// index.js. This is the record of what the explainer is FOR, and the contract
// the model must satisfy.
//
// SCOPE NOTE: `phone-call` already walks one voice call end to end (codec →
// radio burst → operator core → the far ear), and `wifi-router` already owns
// the half-duplex "everyone shares one wire" idea at room scale. This
// explainer deliberately does NOT retell either. It stands at the base of one
// cell tower and answers the only question the G-numbers are actually about:
// what changed between them, and why each change bought speed.
export default {
  angle:
    'No generation ever made radio faster. A radio wave in 2026 travels at exactly ' +
    'the speed it did in 1901, and Shannon\'s limit has not moved a decibel. Every ' +
    'G is the same tower buying speed with the same three coins: a wider slice of ' +
    'spectrum, a denser alphabet of symbols, and more copies of the signal sent ' +
    'through space at once. What really changed each time is how the network stops ' +
    'you from waiting your turn.',

  stat:
    'One 2G timeslot carried 9.6 kbit/s — a single phone photo would have taken over an hour. 5G peaks around 20 Gbit/s: about two million times more, off the same steel.',

  button: 'The wave never got faster. The queue did.',

  who: 'Anyone who has watched the 4G/5G icon flip on their phone and never known whether it meant anything.',

  beats: [
    {
      idea: 'The tower is the same tower. Every generation is new boxes bolted to steel that was put up for voice calls in the nineties.',
      visuals: [
        'a complete cell site as a product shot: lattice mast, three sector panels, a grey equipment cabinet at its foot',
        'the tall thin white GSM panel of 1993 on the hero mount',
      ],
    },
    {
      idea: '2G was digital voice on a 200 kHz channel cut into eight turns. Your phone transmitted one eighth of the time and stayed silent for the rest.',
      visuals: [
        'a 200 kHz channel block on a spectrum bench — a sliver at the far left of a decade scale',
        'eight timeslots marching, exactly one lit at a time, three handsets taking turns',
      ],
    },
    {
      idea: '3G abolished turns: everyone transmits at the same moment on a channel 25× wider, and each user is separated by a code rather than a slot.',
      visuals: [
        'the channel block jumping from a sliver to 5 MHz on the same bench',
        'three user waveforms superimposed into one hash, then pulled back apart by their codes',
      ],
    },
    {
      idea: '4G brought back the turns, but made them tiny: a 20 MHz channel is diced into a grid of tiles and a scheduler hands out fresh tiles every millisecond.',
      visuals: [
        'a floating time–frequency grid above the channel block',
        'tiles colouring themselves to three different users, column by column, a new column every millisecond',
      ],
    },
    {
      idea: 'The second lever is the alphabet. A denser constellation packs more bits into each wiggle — but the points crowd together, so it only works on a clean signal.',
      visuals: [
        'a constellation plate densifying 4 → 16 → 64 → 256 points',
        'a fixed-size noise ball around every point, nearly touching by 256',
      ],
    },
    {
      idea: 'The third lever, and the one 5G actually leans on: 64 tiny antennas aim a private beam at each phone, so the same tile is handed to three users at once.',
      visuals: [
        'the hero panel swapping to a compact 8×8 massive-MIMO array',
        'three narrow beams tracking three handsets instead of one broad sector wedge',
        'three stacked copies of the same tile grid, one per beam',
      ],
    },
    {
      idea: 'Speed is just those three numbers multiplied: how wide, how dense, how many at once. Nothing about the radio got faster.',
      visuals: [
        'all five channel blocks laid out together along the decade rail',
        'the constellation and the beam count beside them',
      ],
    },
    {
      idea: '6G is not out. Its actual pitch is that the beam should already know where you are — the network listening to its own echoes to sense the room.',
      visuals: [
        'a denser sensing tile on the hero mount',
        'a beam sweeping and echoes returning from the handsets',
      ],
    },
    {
      idea: 'Run the whole thing: one tower, thirty years, the panel and the channel growing through every generation.',
      visuals: ['the complete site cycling 2G → 6G on a loop, free to orbit'],
    },
  ],
};
