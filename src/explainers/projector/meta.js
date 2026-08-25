// Tiny, eagerly-bundled library-card metadata. Keep it light: the heavy
// index.js/model.js only load when someone opens this explainer.
export default {
  id: 'projector',
  title: 'How a Projector Works',
  summary:
    'One blinding lamp, a colour wheel spinning at 10,000 rpm, and a chip covered in two million hinged mirrors — how a DLP projector paints a wall-sized picture out of light it mostly throws away.',
  accent: '#ffcf5c',
  // one-line teardown for the library card
  spec: 'UHP arc lamp · 6-segment colour wheel · ±12° micromirror array',
  // part names, so search finds this machine by what is inside it
  keywords: 'dlp dmd micromirror colour wheel color wheel lamp reflector integrator rod lens pwm light dump',
  categories: ['electronics', 'home'],
};
