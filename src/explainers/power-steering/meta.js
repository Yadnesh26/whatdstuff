// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'power-steering',
  title: 'How Power Steering Works',
  summary:
    'Your hands never turn the wheels. They twist a pencil-thick steel rod a few degrees, and that twist opens a valve that sends 100 bar of oil to do the shoving.',
  accent: '#ff7a45',
  // one-line teardown for the library card
  spec: 'rack & pinion · 3.5° torsion bar · 100 bar vane pump',
  // part names, so search finds this machine by what is inside it
  keywords: 'rack pinion torsion bar rotary valve spool sleeve vane pump tie rod hydraulic steering',
  categories: ['vehicles'],
};
