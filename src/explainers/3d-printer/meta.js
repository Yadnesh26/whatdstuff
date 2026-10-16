// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: '3d-printer',
  title: 'How a 3D Printer Works',
  summary:
    'A 3D printer never prints in 3D. A hot nozzle draws one flat layer of melted plastic, steps up a fifth of a millimetre and draws the next, 250 times for a 5 cm part.',
  accent: '#ff7a1a',
  // one-line teardown for the library card
  spec: 'drive gear · 210 °C hotend · 0.4 mm nozzle · 0.2 mm layers',
  // part names, so search finds this machine by what is inside it
  keywords:
    '3D printer FDM FFF fused deposition filament PLA extruder drive gear hotend heat break heatsink heater block thermistor nozzle slicer G-code layer infill heated bed PEI gantry stepper belt lead screw',
  categories: ['precision', 'home'],
};
