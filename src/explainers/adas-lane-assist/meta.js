// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'adas-lane-assist',
  title: 'How ADAS Lane Assist Works',
  summary:
    'A camera behind your mirror that only looks for bright stripes, a radar that times echoes off the car ahead, and a steering motor that leans on the wheel with about the force of a bag of sugar, so your hands always win.',
  accent: '#5ad1ff',
  // one-line teardown for the library card
  spec: 'windshield camera · 77 GHz radar · ≈3 Nm EPS nudge',
  // part names, so search finds this machine by what is inside it
  keywords:
    'ADAS lane keeping assist LKA lane departure warning LDW lane centering adaptive cruise control ACC radar camera sensor fusion electric power steering EPS torque sensor driver assistance',
  categories: ['vehicles'],
};
