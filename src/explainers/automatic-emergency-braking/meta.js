// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'automatic-emergency-braking',
  title: 'How Automatic Emergency Braking Works',
  summary:
    'Your car never measures the distance to the car ahead. Its radar hums a rising note and listens for the echo, and the brakes trust a clock, not a ruler: how many seconds until impact.',
  accent: '#ff5a3c',
  // one-line teardown for the library card
  spec: '77 GHz FMCW radar · camera recognition · TTC stages · ESC pump',
  // part names, so search finds this machine by what is inside it
  keywords:
    'AEB automatic emergency braking forward collision warning FCW radar FMCW chirp beat frequency Doppler time to collision TTC pedestrian detection camera sensor fusion ESC hydraulic unit pump brake caliper ADAS',
  categories: ['vehicles'],
};
