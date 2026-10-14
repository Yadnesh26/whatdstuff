// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'airbag',
  title: 'How a Car Airbag Works',
  summary:
    'A controlled explosion that is already letting go by the time you hit it. A sensor decides in about 20 milliseconds, a pellet ring becomes gas, and vent holes turn the bag into a cushion.',
  accent: '#ff8a3d',
  // one-line teardown for the library card
  spec: 'MEMS crash sensor · ~20 ms decision · dual-stage inflator · ~40 ms to full',
  // part names, so search finds this machine by what is inside it
  keywords:
    'airbag air bag SRS supplemental restraint system crash sensor accelerometer MEMS airbag control unit ACU squib igniter inflator gas generator propellant sodium azide guanidine nitrate nylon bag vent holes tear seam dual stage driver steering wheel',
  categories: ['vehicles'],
};
