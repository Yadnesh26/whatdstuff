// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'anti-lock-braking',
  title: 'How Anti-Lock Braking (ABS) Works',
  summary:
    'ABS does not brake harder, it lets go on purpose. A toothed ring counts wheel speed, and valves release and reapply pressure up to 15 times a second so the tyre keeps rolling and the car keeps steering.',
  accent: '#4fd1c5',
  // one-line teardown for the library card
  spec: 'tone ring · inlet/outlet valves · return pump · ~15 cycles/s',
  // part names, so search finds this machine by what is inside it
  keywords:
    'ABS anti-lock brakes wheel speed sensor tone ring slip ratio hydraulic modulator solenoid valve accumulator return pump brake pedal pulsation skid steering',
  categories: ['vehicles'],
};
