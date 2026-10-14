// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'soap-dispenser',
  title: 'How a Soap Pump Works',
  summary:
    'Pressing the pump does not pull soap up — letting go does. A spring, a piston and two glass balls that only let soap go one way.',
  accent: '#f2a541',
  // one-line teardown for the library card
  spec: 'piston pump · 2 ball check valves · ~2 mL per press',
  // part names, so search finds this machine by what is inside it
  keywords: 'soap dispenser lotion pump piston spring ball check valve dip tube priming nozzle',
  categories: ['home'],
};
