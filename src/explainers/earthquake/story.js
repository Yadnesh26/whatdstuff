// Phase 0 artifact — written BEFORE the model (add-explainer skill, Phase 0).
// Pure data, no imports, never bundled: the registry globs only meta.js and
// index.js. This is the record of what the explainer is FOR, and the contract
// the model must satisfy.
//
// Facts (USGS "Elastic Rebound"; USGS Earthquake Hazards glossary; USGS
// "Fault Slip Rates"; Wikipedia "Earthquake rupture", "P wave", "Seismic
// velocity structure"; OpenText BC Physical Geology 9.1):
//  - Elastic rebound (H.F. Reid, after 1906 San Francisco): a fault is stuck
//    by friction while the plates keep moving, so the crust either side BENDS
//    and stores strain; when stress beats friction the rock snaps back to an
//    unstrained shape and the stored energy leaves as seismic waves.
//  - Pacific vs North American plate ~5 cm/yr; the San Andreas takes roughly
//    60-75% of it (~3.5 cm/yr — about how fast a fingernail grows).
//    1906 slip reached ~6 m at the surface.
//  - Most crustal quakes start 5-15 km down (the hypocentre); the point on the
//    surface above it is the epicentre.
//  - Rupture unzips along the fault at up to the Rayleigh speed, ~0.92 Vs,
//    typically 2.5-3.5 km/s (some strike-slip ruptures go supershear).
//  - Crustal rock: P ~6 km/s (push-pull, arrives first), S ~3.5 km/s
//    (side-to-side shear, larger, arrives second), surface waves slower still
//    and largest. Distance ≈ 8 km for every second between P and S.
//  - Each whole step of magnitude = 10x the recorded amplitude and ~32x the
//    energy released.
export default {
  angle:
    'An earthquake is not the ground starting to move — the ground has been ' +
    'moving the whole time. It is a stuck fault finally letting go of decades ' +
    'or centuries of bending, all at once, in seconds.',

  stat:
    'The plates creep about 3.5 cm a year — fingernail speed — and a big ' +
    'rupture pays back several metres of that in under a minute.',

  button: 'The ground is already bending toward the next one.',

  who:
    'Anyone who has felt a tremor (or watched footage of one) and pictured the ' +
    'shaking coming from nowhere, rather than from stored-up bending.',

  beats: [
    {
      idea: 'Solid ground, cut out as a block: fields and fence lines run straight across a fault you can barely see.',
      visuals: [
        'a block of crust on a plinth, layered rock on its sides, farmland on top',
        'straight fence lines crossing a faint fault trace',
      ],
    },
    {
      idea: 'The plates keep sliding past each other, but the fault is locked by friction — so the rock either side bends like a ruler and stores strain.',
      visuals: [
        'the far sides of the block creeping in opposite directions',
        'fence lines bending into an S-curve across the locked fault',
        'strain glowing strongest near the fault',
      ],
    },
    {
      idea: 'Friction gives: the rupture starts at a point ~10 km down and unzips along the fault at ~3 km/s; the bent rock springs back straight — but offset.',
      visuals: [
        'the fault face exposed with the hypocentre marked at depth',
        'a slip patch spreading outward from the hypocentre',
        'fence lines snapping straight with a clean offset at the fault',
      ],
    },
    {
      idea: 'The released energy leaves as waves: P waves push-pull at ~6 km/s and arrive first; S waves shake sideways at ~3.5 km/s and hit harder. The gap tells you the distance.',
      visuals: [
        'a cross-section through the hypocentre with a grid of rock particles',
        'a fast ring whose particles move along the direction of travel, a slower ring whose particles move across it',
        'a seismogram trace recording a small P arrival then a larger S arrival',
      ],
    },
    {
      idea: 'Where the waves reach the surface they turn into slow rolling surface waves — the biggest shaking, the part that does the damage.',
      visuals: [
        'the ground surface rippling outward from the epicentre',
        'the seismogram showing the surface waves as the largest swing',
      ],
    },
    {
      idea: 'Then it starts over: the fault locks again and begins bending toward the next one. Each step of magnitude is about 32 times more energy.',
      visuals: [
        'the complete cycle running — bend, snap, waves — on the solid block',
      ],
    },
  ],
};
