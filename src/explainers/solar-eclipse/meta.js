// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'solar-eclipse',
  title: 'How a Solar Eclipse Works',
  summary:
    'The Moon is 400 times smaller than the Sun and 400 times closer, so it fits over the disc almost exactly. Its shadow is a cone that tapers to a point right about where Earth is. On an average day it stops a few thousand kilometres short.',
  accent: '#ffcf6b',
  // one-line teardown for the library card
  spec: '400× wider, 400× farther · a shadow 267 km wide · most years it misses',
  // part names, so search finds this machine by what is inside it
  keywords:
    'solar eclipse total annular ring of fire partial umbra penumbra antumbra corona totality path of totality baily\'s beads diamond ring new moon line of nodes eclipse season moon orbit tilt perigee apogee',
  categories: ['space'],
};
