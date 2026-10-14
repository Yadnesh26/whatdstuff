// Phase 0 artifact — written BEFORE the model (add-explainer skill, Phase 0).
// Pure data, no imports, never bundled: the registry globs only meta.js and
// index.js. This is the record of what the explainer is FOR, and the contract
// the model must satisfy.
//
// SCOPE NOTE: `solar-system` owns the planets' orbits; `cyclone` owns storms.
// This one is about ONE number — Earth's 23.4° lean — and everything a year
// does because of it: sun angle, day length, the equinoxes, India's monsoon,
// and the snow line.
//
// Facts (Wikipedia "Season", "Monsoon of South Asia"; NWS; IMD 2022 normals;
// Rutgers Global Snow Lab via NOAA NCEI). Sun-angle, day-length and daily-
// insolation values below are computed from the standard formulas
// (noon altitude 90° − |φ − δ|; cos H0 = −tan φ · tan δ; top-of-atmosphere):
//  - Axial tilt 23.44°. Axis keeps pointing at the same spot in the sky
//    (near Polaris) all year.
//  - Perihelion ~3 Jan at 147.1 million km; aphelion ~4 Jul at 152.1 million
//    km. Eccentricity 0.0167 — the orbit is almost a circle. Distance changes
//    sunlight by only ~7%, and the north is in WINTER when Earth is closest.
//  - At 45° N: noon Sun 68.4° up in June, 21.6° in December → the same beam
//    covers 2.5× more ground in December. Day length 15 h 26 m vs 8 h 34 m.
//    Together: ~4× more sunlight per square metre on a June day.
//  - Equinoxes ~20 Mar / ~22 Sep: the axis leans neither toward nor away;
//    the day/night line runs through both poles; 12 h day everywhere.
//  - Seasonal lag: warmest weeks come ~4–7 weeks after the June solstice
//    (oceans store heat).
//  - Monsoon: overhead Sun crosses India in May; land heats faster than sea;
//    the rain belt (ITCZ / monsoon trough) follows the Sun north, to ~25° N
//    over India by July. South-east trades cross the equator and are bent by
//    Earth's spin into south-westerlies. Kerala onset ~1 June; whole country
//    by ~8 July (IMD normal since 2020); withdrawal Sep–Oct; dry north-east winds in winter.
//    June–Sept brings ~75% (74.9%) of India's annual rain.
//  - Snow: Northern Hemisphere snow cover ~47 million km² in January vs
//    ~3 million km² in August (mostly Greenland). North of 66.6° the Sun
//    does not rise at the December solstice (polar night).
export default {
  angle:
    'Earth is CLOSEST to the Sun in the first week of January — in the ' +
    'middle of northern winter. Seasons have nothing to do with distance. ' +
    'They come from a 23.4° lean that tips each half of the planet toward ' +
    'the Sun for half the year and away for the other half, and that one ' +
    'lean also drags the monsoon rains and the snow line up and down the globe.',

  stat:
    'In January Earth is about 5 million km closer to the Sun than in July.',

  button: 'Not closer. Just leaning.',

  who:
    'Anyone who was taught (or quietly assumed) that summer is when Earth ' +
    'is nearer the Sun, and who has lived through a monsoon or a snowfall ' +
    'without knowing they are the same story.',

  beats: [
    {
      idea: 'A year on Earth, from space: snow spreads across the north and melts away, a band of rain clouds swings north over India and back.',
      visuals: [
        'a real-looking Earth with recognizable continents, turning, lit from one side by the Sun',
        'northern snow cover growing toward ~40° N and shrinking back to Greenland over one loop',
        'a cloud belt sliding north over South Asia and back; India greening and browning',
      ],
    },
    {
      idea: 'It is not distance: the orbit is nearly a circle, and Earth is closest (147.1 M km) on 3 January, in northern winter.',
      visuals: [
        'the Sun with Earth travelling a near-circular orbit through one full year',
        'perihelion and aphelion marked with dates and distances',
        'a live distance readout on Earth that bottoms out in January',
      ],
    },
    {
      idea: 'The 23.4° lean: the axis aims at the same spot in the sky all year, so in June the north leans toward the Sun and in December away. The overhead Sun marches between the tropics.',
      visuals: [
        'axis sticks drawn at several points around the orbit, all parallel',
        'riding along with Earth (Sun kept on the right): the axis nodding toward the Sun, then away',
        'the overhead-Sun point sliding between the Tropic of Cancer and the Tropic of Capricorn',
      ],
    },
    {
      idea: 'Low Sun spreads the same sunlight over more ground: at 45° N the noon beam covers 2.5× more ground in December than in June.',
      visuals: [
        'a bundle of parallel sunbeams landing on 45° N at noon',
        'the lit footprint stretching long in December and tightening in June',
        'a live readout of the noon Sun angle',
      ],
    },
    {
      idea: 'Long days vs short days: 15 h 26 m of daylight at 45° N in June, 8 h 34 m in December; together with the angle, about 4× the sunlight. Above the Arctic Circle the summer Sun never sets.',
      visuals: [
        'the 45° N circle split into a lit arc and a dark arc that grows and shrinks over the year',
        'a city dot riding the circle, spending longer in the light in June',
        'the Arctic Circle fully lit in June and fully dark in December',
        'a live day-length readout',
      ],
    },
    {
      idea: 'Spring and autumn are the crossings: at the equinoxes the axis leans sideways to the Sun, the day/night line runs through both poles, and every place gets 12 hours.',
      visuals: [
        'the day/night line swinging through both poles',
        'the equator and 45° N circles each exactly half lit',
        'the overhead-Sun point crossing the equator',
      ],
    },
    {
      idea: 'The monsoon is a season made by the same march: the overhead Sun reaches India in May, the land heats, the rain belt follows it north, and the winds reverse to blow in from the sea — three quarters of India\'s rain in four months.',
      visuals: [
        'South Asia held still while the overhead-Sun point crosses it northward',
        'the land glowing hot before the rains',
        'south-westerly winds crossing the equator and curving onto India\'s west coast, reversing to dry north-easterlies in winter',
        'a thick cloud band over India and the land turning green',
      ],
    },
    {
      idea: 'Snow is what a long winter night does: low Sun and short days let the northern continents lose more heat than they gain, and snow cover grows from 3 to 47 million km².',
      visuals: [
        'the northern hemisphere from above with the Arctic sunk in polar night',
        'the snow line sweeping south across Eurasia and back north',
        'Greenland white all year',
      ],
    },
    {
      idea: 'Payoff: one lean, every season.',
      visuals: ['the full year again, fast, everything on'],
    },
  ],
};
