// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'hydraulic-system',
  title: 'How a Hydraulic System Works',
  summary:
    'A fist-sized gear pump lifts a tonne without effort, and it never makes pressure. It only pushes oil. The load decides how hard.',
  accent: '#ffb02e',
  // one-line teardown for the library card
  spec: 'gear pump · spool valve · 200 bar relief · 63 mm cylinder',
  // part names, so search finds this machine by what is inside it
  keywords: 'hydraulics gear pump spool valve directional control relief valve cylinder piston oil tank power pack pascal',
  categories: ['infrastructure', 'vehicles'],
};
