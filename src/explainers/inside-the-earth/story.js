// Phase 0 artifact — written BEFORE the model (add-explainer skill, Phase 0).
// Pure data, no imports, never bundled: the registry globs only meta.js and
// index.js. This is the record of what the explainer is FOR, and the contract
// the model must satisfy.
//
// Facts (USGS "Inside the Earth"; Wikipedia "Earth's inner core", "Lower
// mantle", "Kola Superdeep Borehole", "Inge Lehmann"; PREM, Dziewonski &
// Anderson 1981; AMNH "Inge Lehmann"):
//  - Mean radius 6,371 km. Oceanic crust ~5-10 km, continental ~30-50 km
//    (up to ~70 km under mountains). The Moho is the crust/mantle boundary.
//  - Lithosphere (crust + rigid top of mantle) ~100 km; below it the
//    asthenosphere — still solid, but soft enough to creep.
//  - Mantle to 2,890 km: solid silicate rock (olivine -> perovskite), yet it
//    convects over millions of years at a few cm per year. Transition zone
//    410-660 km; D'' layer at the base. ~84% of Earth's volume.
//  - Outer core 2,890-5,150 km: LIQUID iron-nickel, ~4,000-5,000 °C. Its
//    churning is the geodynamo that makes the magnetic field.
//  - Inner core radius ~1,220 km: SOLID iron-nickel at ~5,400 °C (~5,700 K,
//    about the Sun's surface temperature), solid only because pressure
//    (~330-360 GPa, ~3.6 million atmospheres) raises iron's melting point.
//  - Kola Superdeep Borehole: 12,262 m (1989) — ~0.2% of the way to the
//    centre, still inside the crust. Nobody has ever sampled the mantle in
//    place, let alone the core.
//  - Seismic evidence: S (shear) waves cannot cross a liquid, so they stop
//    at the outer core — an S-wave shadow beyond ~103° from the quake
//    (Oldham 1906 / Gutenberg 1913 put the core at 2,900 km). P waves bend
//    at the core, leaving a P shadow ~103-142°. Faint P arrivals INSIDE that
//    shadow led Inge Lehmann (1936) to a solid inner core.
export default {
  angle:
    'Nobody has ever been below 12 km, yet we know the centre of the Earth is ' +
    'a solid iron ball as hot as the surface of the Sun — because earthquakes ' +
    'X-ray the planet, and the core casts a shadow.',

  stat:
    'The deepest hole ever drilled reached 12.3 km: 0.2% of the way to the ' +
    'centre, 6,371 km down.',

  button: 'Everything below 12 km, we heard — never saw.',

  who:
    'Anyone who learned "crust, mantle, core" as a coloured diagram and never ' +
    'asked how anyone could possibly know.',

  beats: [
    {
      idea: 'The whole planet, sealed: oceans, continents, clouds — every metre of it that anyone has ever touched is on this surface.',
      visuals: [
        'a complete globe on a plinth, oceans and continents, turning slowly',
      ],
    },
    {
      idea: 'Cut it open. The deepest hole ever drilled, 12.3 km, does not even get through the crust; the crust itself is thinner, relative to the planet, than an apple skin.',
      visuals: [
        'a wedge removed from the globe exposing concentric layers at true scale',
        'the crust as a hair-thin rim at true scale',
        'a magnified slice of the top ~100 km: continental crust, oceanic crust, the Moho, the 12 km borehole drawn to scale',
      ],
    },
    {
      idea: 'The mantle is solid rock — and it flows. Heated from below, it rises, cools and sinks in loops thousands of kilometres tall, a few centimetres a year.',
      visuals: [
        'the mantle band on the cut face, glowing hotter toward the core',
        'convection loops of rock moving on the cut face: a hot plume rising, a cold slab sinking',
      ],
    },
    {
      idea: 'How we know: an earthquake sends waves through the planet. Shear (S) waves cannot cross liquid, so they die at 2,890 km — and leave a shadow on the far side of the Earth.',
      visuals: [
        'a quake flash on the surface',
        'wave rays fanning through the cut face: P rays bending through the core, S rays stopping dead at the core boundary',
        'the shadow zone band marked on the far surface where no S waves arrive',
      ],
    },
    {
      idea: 'The outer core is liquid iron, 2,260 km deep, churning — and that swirling metal is the dynamo that makes Earth\'s magnetic field.',
      visuals: [
        'the outer core as a glowing liquid shell with swirling flow',
        'magnetic field lines looping from pole to pole around the globe',
      ],
    },
    {
      idea: 'At the centre: a solid iron ball about 2,440 km across at roughly 5,400 °C — the temperature of the Sun\'s surface — kept solid by 3.6 million atmospheres of pressure. Faint P waves bent by it into the P-wave shadow are how Inge Lehmann found it in 1936.',
      visuals: [
        'the inner core glowing white-hot, isolated by camera push-in',
        'a P ray bent by the inner core, landing inside the P-wave shadow where no P wave should arrive',
      ],
    },
    {
      idea: 'Seal it back up: the planet you stand on, known entirely by listening to it.',
      visuals: [
        'the wedge closing and the complete globe turning again',
      ],
    },
  ],
};
