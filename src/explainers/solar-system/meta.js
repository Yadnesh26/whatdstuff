// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'solar-system',
  title: 'How the Solar System Works',
  summary:
    'Eight planets falling around a star, and never landing. Every orbit is an ellipse with the Sun off to one side — and the Sun is not standing still either: it circles a point just outside its own surface while the whole system flies through the galaxy at 230 km a second.',
  accent: '#ffb454',
  // one-line teardown for the library card
  spec: 'ellipses, not circles · 88 days to 165 years · the Sun wobbles too',
  // part names, so search finds this machine by what is inside it
  keywords:
    'solar system planets orbit sun kepler laws ellipse eccentricity orbital period astronomical unit barycenter ecliptic inclination asteroid belt mercury venus earth mars jupiter saturn uranus neptune galactic orbit',
  categories: ['space'],
};
