// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'turbocharger',
  title: 'How a Turbocharger Works',
  summary:
    'A windmill in the exhaust, spinning a fan in the intake — one shaft between them at 200,000 rpm, riding on nothing but a six-micron film of oil.',
  accent: '#ffa640',
  // one-line teardown for the library card
  spec: 'exhaust turbine · one shaft · 200,000 rpm · boost in, lag included',
  // part names, so search finds this machine by what is inside it
  keywords:
    'turbine wheel compressor impeller volute scroll wastegate boost intercooler floating bearing CHRA inducer exducer turbo lag',
  categories: ['vehicles'],
};
