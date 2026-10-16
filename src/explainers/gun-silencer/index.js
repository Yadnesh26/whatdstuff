import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildSilencer } from './model.js';

// Zoom-in / reveal story: the complete sealed tube, the bare muzzle blast it is
// there to tame, the tube cut open, the bullet passing through untouched, the
// gas getting caught, the side-by-side comparison, and what is still left.
//
// Every step is the SAME single shot, looping: one lap = bullet out, gas
// released, gas dies away. The model's `u` is the lap fraction, so every wrap
// is an identical pose (bullet hidden, gas faded, heat bled off).
//
// Conceptual physics only. No dimensions or build detail anywhere.

// pin EVERY scene scalar on entry so scrolling either way lands on a clean frame
const view =
  (labels, { cut = 0, can = 1, compare = 0, mach = 0, gas = 1, dcan = 0.05, out = 0.05, burst = 1 } = {}) =>
  ({ handles }) => {
    handles.set({ u: 0, cut, can, compare, mach, gas, dcan, out, burst });
    handles.setLabels(labels);
  };

const lap = (duration) => ({ tl, handles }) => {
  const s = { u: 0 }; // LOCAL state, one tween target per step
  tl.add(s, {
    u: 1,
    duration,
    ease: 'linear',
    onUpdate: () => handles.set({ u: s.u }),
  });
};

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildSilencer({ scene });
  },

  steps: [
    {
      id: 'tube',
      heading: '1 · A tube that does not silence',
      body: 'A suppressor is a steel tube fixed to the end of a barrel. The nickname is generous: a suppressed shot is still around 130 decibels, louder than a jackhammer. What the tube changes is how the burst of gas behind the bullet gets out. (In many places they are tightly regulated, for good reason.)',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [-0.3, 3.4, 11.2], target: [-1.4, 1.2, 0] },
      focus: ['Suppressor tube'],
      onEnter: view('exterior'),
      timeline: lap(7000),
    },
    {
      id: 'blast',
      heading: '2 · Without it: a popped balloon',
      body: 'Take the tube off. Behind the bullet, the barrel is full of propellant gas at enormous pressure. The instant the bullet clears the muzzle, that gas bursts into open air and expands all at once, with a flash. That sudden release is most of what you hear as the bang.',
      camera: { position: [2.4, 3.0, 8.4], target: [-0.2, 1.6, 0] },
      focus: ['Muzzle blast'],
      onEnter: view('bare', { can: 0 }),
      timeline: lap(7000),
    },
    {
      id: 'cutaway',
      heading: '3 · Inside the tube',
      body: 'Cut it open and it is mostly empty space. A wide blast chamber sits right at the muzzle. Past it, a stack of cone-shaped baffles runs to the exit cap, each with a single hole on the bore line. The metal is there to steer gas, not to block it.',
      camera: { position: [1.6, 2.7, 8.2], target: [0.3, 1.3, 0] },
      focus: ['Blast chamber', 'Baffle stack'],
      onEnter: view('internal', { cut: 1, dcan: 0.08, gas: 0.5 }),
      timeline: lap(9000),
    },
    {
      id: 'bullet',
      heading: '4 · The bullet touches nothing',
      body: 'Every hole is wider than the bullet and they all line up on the bore. The bullet flies down the centre line and out of the front without brushing a baffle. It is never the thing being slowed. The gas, which cannot fly straight, is.',
      camera: { position: [1.6, 2.5, 8.2], target: [0.3, 1.3, 0] },
      focus: ['Centre line'],
      onEnter: view('internal', { cut: 1, dcan: 0.28, gas: 0.35 }),
      timeline: lap(9000),
    },
    {
      id: 'gas',
      heading: '5 · The gas gets stuck in traffic',
      body: 'The gas follows the bullet in, fills the blast chamber and expands, losing pressure. To get out it must squeeze through hole after hole, and each cone turns part of it aside into a chamber where it swirls, slows and cools. The steel soaks up the heat, which is why the baffles warm up. What was one violent pop leaves as a long, weak push.',
      camera: { position: [1.6, 2.6, 8.2], target: [0.3, 1.3, 0] },
      focus: ['Hot, high-pressure gas', 'Cooler, slower gas'],
      onEnter: view('gas', { cut: 1, dcan: 0.04, gas: 1 }),
      timeline: lap(12000),
    },
    {
      id: 'compare',
      heading: '6 · One pop becomes a sigh',
      body: 'Same shot, two muzzles. Bare, the gas hits open air at full pressure and the shock races outward. Through the tube, it leaks out slowly at low pressure. A good one takes roughly 20 to 30 decibels off. Thirty decibels is a thousandth of the sound power, and the shot is still around 130 decibels.',
      camera: { position: [3.4, 10.5, 6.5], target: [1.2, 1.0, 0.7] },
      focus: ['Bare muzzle: about 160 dB', 'Suppressed: about 130 dB'],
      onEnter: view('compare', { compare: 1, burst: 0.55 }),
      timeline: lap(8000),
    },
    {
      id: 'crack',
      heading: '7 · What is left',
      body: 'A rifle bullet travels faster than sound, so it builds its own shock wave, a sonic crack, all the way downrange. No tube can touch that. Subsonic ammunition has no crack, and the gun itself still clacks. Suppressed does not mean silent: it means the blast got spread out and softened.',
      hint: 'Drag to orbit while it loops.',
      camera: { position: [3.4, 3.2, 10.6], target: [0.6, 1.35, 0] },
      freeOrbit: true,
      focus: ['Sonic crack'],
      onEnter: view('crack', { mach: 1, dcan: 0.05, out: 0.4 }),
      timeline: lap(8000),
    },
  ],
});
