// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'cyclone',
  title: 'How a Cyclone Works',
  summary:
    'A hurricane is a heat engine that builds itself out of warm seawater. It burns about 6 x 10^14 watts of evaporated ocean — 200 times the electrical output of the United States — and turns roughly a tenth of it into wind.',
  accent: '#7fb8ff',
  // one-line teardown for the library card
  spec: 'a Carnot engine 800 km wide and 15 km deep, fuelled by 26.5 C seawater',
  // part names, so search finds this machine by what is inside it
  keywords:
    'hurricane typhoon tropical cyclone eye eyewall rainbands storm surge coriolis latent heat outflow stadium effect saffir-simpson',
  categories: ['earth'],
};
