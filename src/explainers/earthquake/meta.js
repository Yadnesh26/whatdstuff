// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'earthquake',
  title: 'How an Earthquake Works',
  summary:
    'The ground under a fault is moving all the time — about 3.5 cm a year — but friction holds the fault shut, so the rock bends instead. An earthquake is that bend snapping back in seconds, and the waves it throws off.',
  accent: '#e07a4a',
  // one-line teardown for the library card
  spec: 'a locked fault, 15 km of bent crust, and three kinds of wave',
  // part names, so search finds this machine by what is inside it
  keywords:
    'earthquake seismic fault tectonic plates elastic rebound hypocenter hypocentre epicenter epicentre p wave s wave surface wave seismometer seismogram magnitude richter san andreas strike-slip',
  categories: ['earth'],
};
