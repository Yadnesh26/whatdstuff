// Phase 0 artifact — written BEFORE the model (add-explainer skill, Phase 0).
// Pure data, no imports, never bundled: the registry globs only meta.js and
// index.js. This is the record of what the explainer is FOR, and the contract
// the model must satisfy.
//
// SCOPE NOTE: `solar-system` owns orbits at the scale of planets. This one
// stays inside the Earth–Moon–Sun line and is about a SHADOW: its shape, its
// length, and the single number (umbra length vs. Moon distance) that decides
// whether you get totality, a ring of fire, or nothing.
//
// Facts (Wikipedia "Solar eclipse"; NASA TP-1999-209484; umbra length derived
// L = R_moon · d_SM / (R_sun − R_moon) = 1737 · 149.2e6 / 694,263 ≈ 373,000 km):
//  - Sun is ~400x the Moon's diameter and ~400x its distance: both ~0.5° wide.
//  - Mean Moon-to-surface distance ~378,000 km > umbra ~373,000 km: at average
//    distance the umbra falls short. Annular 33.2% vs total 26.7% of eclipses
//    (2000 BCE–3000 CE).
//  - Path of totality ≤ 267 km wide, typically 100–160 km; penumbra > 6,400 km.
//  - Umbra moves east at ~1,700 km/h or faster; totality ≤ 7 min 32 s.
//  - Moon's orbit tilted ~5.1°; eclipse seasons every ~173.3 days; 2–5 solar
//    eclipses a year; totality somewhere every ~18 months; a given place
//    every ~360–410 years.
//  - Moon recedes ~3.8 cm/yr; totals end in ~650 million to 1.4 billion years.
export default {
  angle:
    'The Moon\'s shadow is a cone that tapers to a point almost exactly at ' +
    'Earth\'s distance — and at the Moon\'s AVERAGE distance the tip actually ' +
    'stops a few thousand kilometres short of the ground. Total eclipses only ' +
    'happen because the Moon is sometimes a little closer than average.',

  stat:
    'The Sun is about 400 times wider than the Moon and about 400 times ' +
    'farther away — so they look the same size, to within a few percent.',

  button: 'A shadow that only just reaches us.',

  who:
    'Anyone who has seen a photo of totality and assumed the Moon simply ' +
    '"covers" the Sun — without knowing how close it comes to not fitting.',

  beats: [
    {
      idea: 'From the ground: the Moon slides across the Sun, the last light breaks into beads, flares as a diamond ring, and the corona appears.',
      visuals: [
        'a daylight sky with the Sun, the new Moon invisible until it bites the disc',
        'a thinning crescent breaking into Baily\'s beads through a jagged lunar limb',
        'a diamond-ring flare, then the corona and a darkened sky during totality',
      ],
    },
    {
      idea: 'Why it fits: the Sun is ~400x wider AND ~400x farther, so both subtend ~0.5°.',
      visuals: [
        'Sun, Moon and Earth lined up, seen from the side',
        'two sight lines from Earth grazing the Moon\'s edges and landing on the Sun\'s edges',
      ],
    },
    {
      idea: 'The Moon casts two shadows: a dark cone (umbra) that narrows to a point, and a wide flaring one (penumbra).',
      visuals: [
        'tangent rays from the Sun\'s limbs crossing the Moon\'s limbs',
        'the umbra cone narrowing, the penumbra cone widening, both reaching Earth',
      ],
    },
    {
      idea: 'The umbra\'s tip only just reaches: nearer the Moon, it touches (total); farther, it falls short and the antumbra gives a ring of fire.',
      visuals: [
        'the Moon sliding between near and far distances along the line',
        'the umbra tip touching Earth\'s surface, then stopping short with an inverted antumbra cone reaching the ground',
      ],
    },
    {
      idea: 'On the ground the umbra is a dot at most 267 km wide, racing east at 1,700 km/h or more inside a partial-eclipse blur thousands of kilometres across.',
      visuals: [
        'Earth\'s day side with a soft penumbral shading and a sharp dark spot at its centre',
        'the spot sweeping across a turning Earth and leaving a path of totality',
      ],
    },
    {
      idea: 'It doesn\'t happen every month because the Moon\'s orbit is tilted 5°. At true scale, most new moons throw their shadow above or below Earth; only near the line of nodes does it hit.',
      visuals: [
        'Earth and Moon at true scale and distance, the Moon\'s orbit tilted to the ecliptic',
        'successive new moons with shadows passing above and below Earth, one lined up with the node that hits',
      ],
    },
    {
      idea: 'Back inside the dot: stars come out, the horizon glows all round, and the Moon is drifting away 3.8 cm a year.',
      visuals: [
        'the totality sky view again, wider, with a sunset glow along the horizon and stars out',
      ],
    },
  ],
};
