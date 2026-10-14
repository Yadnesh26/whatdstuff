// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'gun-silencer',
  title: 'How a Gun Silencer Works',
  summary:
    'Silencers do not silence. A suppressed shot is still around 130 decibels. The tube just catches the burst of gas leaving the muzzle and makes it squeeze, swirl and cool its way out.',
  accent: '#ff9d4a',
  // one-line teardown for the library card
  spec: 'blast chamber · cone baffles · gas, not bullet, is slowed · about 30 dB quieter',
  // part names, so search finds this machine by what is inside it
  keywords:
    'gun silencer suppressor sound suppressor muzzle blast baffle stack blast chamber expansion chamber propellant gas decibel sonic crack subsonic supersonic muzzle flash',
  categories: ['precision'],
};
