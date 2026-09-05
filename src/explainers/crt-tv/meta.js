// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'crt-tv',
  title: 'How a CRT TV Works',
  summary:
    'The picture on an old television is one dot of light, thrown by a gun at a third of the speed of light and steered by magnets 15,734 times a second — how a cabinet-sized vacuum bottle draws a moving image you can never actually see all of.',
  accent: '#8ef05a',
  // one-line teardown for the library card
  spec: 'electron gun · 25,000 volts · magnetic sweep · shadow mask',
  // part names, so search finds this machine by what is inside it
  keywords:
    'cathode ray tube crt television picture tube electron gun deflection yoke shadow mask phosphor flyback anode raster scan interlace degauss',
  categories: ['home', 'electronics'],
};
