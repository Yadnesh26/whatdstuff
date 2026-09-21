import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildLightSwitch } from './model.js';

// Reveal story (story.js beats 1-7): the sealed switch on the wall, then the
// plaster and plate ghost away to the mechanism, a slow-motion look at the
// over-centre snap, the completed circuit, the copper itself, the push racing
// the wire while the electrons barely twitch - then re-solidify and free orbit.
//
// SEAMLESS LOOPS: every step drives ONE local scalar s.t from 0 to 1 linearly.
// The model maps it to a switch cycle that starts and ends OFF, an AC jiggle of
// 8 whole cycles and a push of 2 whole traversals, so every lap wraps on an
// identical pose. No step tweens a property any other step also tweens.

// Pin ALL scene state on entering a step (pre-flight #4): reveal, macro insert,
// push pulse, turntable spin AND labels - so scrolling either way lands in the
// same place and the fixed camera never inherits a stray pose.
const view =
  (reveal, macroOn, pushOn, labelMode, spin = 0) =>
  ({ handles }) => {
    handles.set({ reveal, macroOn, pushOn, spin });
    handles.setLabels(labelMode);
  };

// Monotonic remap of the lap onto the phase, spending `share` of the lap inside
// [a, b]. The snap itself lasts ~2% of the cycle - honest, but unreadable at
// normal speed - so the snap step dwells there and races through the rest.
// Still returns 0 at u=0 and 1 at u=1, so the loop stays seamless.
function focusOn(a, b, share) {
  const pre = a;
  const post = 1 - b;
  const s1 = (1 - share) * (pre / (pre + post));
  const s2 = s1 + share;
  return (u) => {
    if (u < s1) return (u / s1) * pre;
    if (u < s2) return a + ((u - s1) / share) * (b - a);
    return b + ((u - s2) / (1 - s2)) * post;
  };
}

// One local state object per timeline (trap 6) driving one pose call.
function cycle(duration, warp = null) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({
          phase: warp ? warp(s.t) : s.t,
          jiggle: s.t,
          pulse: s.t,
        }),
    });
  };
}

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildLightSwitch({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'The most boring object in your house',
      body: 'A square of plastic and a rocker that moves about two millimetres. You have pressed one a hundred thousand times without once wondering what it actually does. It does not make electricity, and it does not send any. It has exactly one job: to open and close a gap.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [1.0, 2.3, 6.1], target: [-1.02, 1.26, 0] },
      dofAperture: 0.00003,
      focus: ['Rocker'],
      onEnter: view(0, false, false, 'exterior'),
      timeline: cycle(6400),
    },
    {
      id: 'inside',
      heading: 'A lever, a spring, and two pieces of metal',
      body: 'Behind the plate sits a steel back box, and inside it there is almost nothing. A brass terminal where the live wire arrives from the grid, a second terminal feeding the lamp, and between them a sprung steel blade carrying a small silver pad. When the pad touches its partner, current flows. When it does not, it does not.',
      camera: { position: [1.2, 2.05, 2.75], target: [-0.78, 1.52, -0.3] },
      dofAperture: 0.00012,
      focus: ['Moving contact', 'Fixed contact'],
      onEnter: view(1, false, false, 'internal'),
      timeline: cycle(5600),
    },
    {
      id: 'snap',
      heading: 'Why it snaps instead of sliding',
      body: 'Watch the contacts, not the rocker. The rocker moves at whatever speed your finger moves, but the contacts do not follow it — they hold, and then fly. A small spring loads up until the rocker pushes it past its own centre line, and the blade slams across in a couple of thousandths of a second. That speed is the whole point: a slowly closing contact draws an arc, and an arc would burn the silver away in weeks.',
      hint: 'Slowed roughly thirty times — the real snap is too fast to see.',
      camera: { position: [-0.05, 2.25, 1.15], target: [-0.96, 1.72, -0.4] },
      dofAperture: 0.00028,
      focus: ['Over-centre spring', 'Contacts snap shut'],
      onEnter: view(1, false, false, 'snap'),
      timeline: cycle(6800, focusOn(0.19, 0.28, 0.62)),
    },
    {
      id: 'circuit',
      heading: 'The loop was always there',
      body: 'Closing that gap does not start a delivery. The live wire was already sitting at full voltage on one side of the contacts, all day, whether the lamp was on or not. The lamp, its filament and every centimetre of copper between them were already packed with electrons. The only thing missing was a complete loop — and the switch is the one millimetre of it you are allowed to touch.',
      camera: { position: [1.7, 2.2, 4.3], target: [0.2, 1.25, -0.1] },
      dofAperture: 0.00008,
      focus: ['To the lamp', 'The lamp it feeds'],
      onEnter: view(1, false, false, 'internal'),
      timeline: cycle(5000),
    },
    {
      id: 'copper',
      heading: 'The electrons were already there',
      body: 'This is a single strand of that copper, blown up enormously. The orange cores are copper atoms locked in a lattice; the blue specks are the free electrons drifting between them, and there are roughly as many of them as there are atoms. They do not travel from the power station. They were manufactured into this wire, and they will die in it.',
      hint: 'Blue = free electrons. Orange = the fixed copper lattice.',
      camera: { position: [0.85, 2.45, 3.35], target: [-0.25, 1.9, 1.45] },
      dofAperture: 0.0002,
      focus: ['Copper lattice', 'Free electron'],
      onEnter: view(1, true, false, 'macro'),
      timeline: cycle(4200),
    },
    {
      id: 'push',
      heading: 'Nothing travels. The push travels.',
      body: 'On alternating current the electrons never even drift anywhere — they shudder back and forth in place, fifty times a second, moving a few millionths of a metre each way and ending exactly where they began. What actually races down the wire is the electric field: the push. It covers the distance at a large fraction of the speed of light, which is why the lamp is instant while the electrons are effectively standing still.',
      camera: { position: [1.65, 2.25, 4.25], target: [0.0, 1.45, 0.35] },
      dofAperture: 0.00006,
      focus: ['The push, at near light speed'],
      onEnter: view(1, true, true, 'grid'),
      timeline: cycle(3600),
    },
    {
      id: 'grid',
      heading: 'And the grid feels you do it',
      body: 'Nothing on the grid is stored. There is no tank of electricity waiting behind your wall, so the instant you close that gap the demand runs all the way back up the line — and somewhere a turbine leans into it, a fraction harder than it did a moment ago. A square of plastic and a rocker, and it reaches four hundred kilometres.',
      camera: { position: [1.15, 2.3, 6.0], target: [-0.95, 1.26, 0] },
      dofAperture: 0.00003,
      focus: ['Rocker'],
      freeOrbit: true,
      onEnter: view(0, false, false, 'exterior'),
      timeline: cycle(4800),
    },
  ],
});
