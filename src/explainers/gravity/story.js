// Phase 0 artifact — written BEFORE the model (add-explainer skill, Phase 0).
// Pure data, no imports, never bundled: the registry globs only meta.js and
// index.js. This is the record of what the explainer is FOR, and the contract
// the model must satisfy.
//
// SCOPE NOTE: `black-hole` already owns lensing, horizons and the extreme
// regime; `solar-system` owns orbital architecture. This explainer deliberately
// stays in the weak field you actually live in — a bench, a dropped capsule,
// two clocks 33 cm apart. It answers the question those two never touch: why
// does a thing fall AT ALL, when nothing is pulling it. The strong field never
// appears; the orbit shows up only at the end, as the same rule run sideways.
//
// THE HONESTY CONSTRAINT: the rubber-sheet demo is banned here. It explains
// gravity using gravity, and it shows curved SPACE, which is the component that
// contributes almost nothing at walking speed. Every curvature visual in this
// explainer is about the rate of TIME. That is the whole point of the piece.
export default {
  angle:
    'Gravity is not a force that pulls you down. Free fall is the natural, ' +
    'force-free state — an accelerometer in free fall reads exactly zero, and it ' +
    'is not broken. What you feel as your weight is the floor shoving you off ' +
    'that path. Things fall because mass makes time run slower lower down, and ' +
    'the straightest possible path through spacetime bends toward slow time.',

  stat:
    'Every falling thing near Earth — a tossed ball, a dropped phone, a bullet — ' +
    'traces an arc of the SAME circle, radius c²/g = 9.2 × 10¹⁵ m. That is 0.97 ' +
    'light-years. Spacetime is barely bent at all; the arc only looks curved ' +
    'because you are watching one metre of a light-year-wide circle.',

  button: 'Nothing pulls you down. The floor stops you.',

  who:
    'Anyone who has been told "mass curves spacetime" a dozen times, nodded, and ' +
    'still could not say why that makes an apple leave a branch.',

  beats: [
    {
      idea: 'A sealed drop rig on a bench. An instrumented capsule is held at the top of an evacuated column, and its readout says 1.000 g.',
      visuals: [
        'the complete sealed test column on a charcoal plinth, opaque and machined, nothing showing',
        'the capsule held at the top of the column, its face readout lit at 1.000 g',
      ],
    },
    {
      idea: 'Inside the capsule is a real accelerometer: a proof mass slung between springs. Sitting still on the bench, the mass hangs DEFLECTED off centre — because the bench is pushing the case up and the mass lags behind.',
      visuals: [
        'the capsule shell ghosting away to expose the mechanism',
        'the proof mass, its springs, and the two capacitive pickoff plates it sits between',
        'the mass visibly off centre, closer to the lower plate, while the rig is at rest',
      ],
    },
    {
      idea: 'Release it. In free fall the proof mass drifts to dead centre and the readout falls to 0.000 g. Nothing is acting on it. The 1.000 g it read a moment ago was never gravity — it was the bench.',
      visuals: [
        'the capsule falling down the column',
        'the proof mass centring itself between the plates as it falls',
        'the readout counting down 1.000 → 0.000 g',
      ],
    },
    {
      idea: 'So if nothing pulls, what picks the path? Mass and energy bend the geometry of spacetime itself, and a free object simply travels the straightest line available in it.',
      // AMENDED IN BUILD: a physical Earth prop below the bench is unbuildable
      // here — the stage's shadow floor occludes everything under y=0, and
      // hiding the floor for two steps would mean bending stage.js for one
      // explainer. The source is named in a callout instead, and the crowding
      // of the planes carries the deformation.
      visuals: [
        'a holographic lattice switching on through and around the rig',
        'its planes evenly spaced far out and packed tighter toward the mass',
        'a callout naming the source: Earth, 5.97e24 kg, 6371 km down',
      ],
    },
    {
      idea: 'The bending that matters is in TIME, not space. Clocks lower down genuinely run slower — measured across 33 cm of bench height with optical clocks.',
      visuals: [
        'two optical clock heads on the column, one low and one 33 cm higher',
        'their tick counters visibly diverging',
        'the lattice repainted as a rate-of-time gradient, slow at the bottom',
      ],
    },
    {
      idea: 'A straight path through a region where time runs slower below tilts downward. That is the fall. The parabola is the path that lets the ball age the most — by about 0.4 femtoseconds over a two-second toss.',
      visuals: [
        'a height-versus-time plane with the ball worldline drawn on it',
        'the worldline arcing, with rival nearby paths shown ageing less',
      ],
    },
    {
      idea: 'At true proportions that arc is almost perfectly straight: it is a piece of a circle 0.97 light-years across, and every falling object near Earth rides the same one.',
      visuals: [
        'the worldline plane rescaling toward true proportions, the arc flattening to a straight line',
        'a radius readout resolving to 0.97 light-years',
      ],
    },
    {
      idea: 'Give it sideways speed and the same straight path closes into an orbit. Astronauts float for exactly the reason our capsule read 0.000 — not absent gravity, just free fall that keeps missing the ground.',
      // AMENDED IN BUILD: the arc-to-closed-orbit transition cannot animate
      // inside a seamless lap (it would have to reset at the wrap). The
      // closing reads on the step-7 -> step-8 cut instead, and the loop shows
      // the finished orbit being ridden.
      visuals: [
        'a closed geodesic ribbon around the mass, with a probe riding it',
        'the probe tagged still reading 0.000 g',
      ],
    },
    {
      idea: 'Every step here is measured and settled. What is NOT settled is why gravity is 10^36 times weaker than electromagnetism, and what spacetime is made of — general relativity and quantum mechanics still do not compose.',
      visuals: [
        'the rig re-sealing to the solid opening object',
        'the lattice thinning to nothing, leaving the sealed column running',
      ],
    },
  ],
};
