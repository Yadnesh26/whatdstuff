import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildSoapPump } from './model.js';

// Zoom-in / reveal story: the sealed bottle dosing, the pump cut in half,
// then the two strokes one at a time — release first, because it is the one
// that does the work — then priming, then the whole thing running again.
//
// Seamless loops: one stroke is rest → press → release → rest, and every lap
// advances a WHOLE number of strokes (the flow packets advance two whole path
// lengths per stroke), so the wrap pose is identical.

const loop =
  (duration, strokes, extra = {}) =>
  ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — one tween target per step
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.set({ stroke: s.t * strokes, ...extra }),
    });
  };

// A one-stroke lap that dwells on ONE half of the stroke. The single-stroke
// close-ups (3 and 4) each teach one direction, so a uniform lap would spend
// half its time contradicting its own copy. The lap runs from stroke phase
// `from` to `from + 1` (the same pose, so still seamless), spending the
// first `knee` of its time reaching phase `at`, and the rest finishing.
const dwell =
  (duration, from, knee, at) =>
  ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => {
        const u = s.t;
        const stroke =
          u < knee ? from + (u / knee) * (at - from) : at + ((u - knee) / (1 - knee)) * (from + 1 - at);
        handles.set({ stroke });
      },
    });
  };

// Pin EVERY piece of scene state on entry, so scrolling either way lands on a
// consistent pose.
const view =
  (reveal, labels, { flows = false, priming = false, dose = true, stroke = 0 } = {}) =>
  ({ handles }) => {
    handles.set({ stroke, reveal, flows, priming, dose });
    handles.setLabels(labels);
  };

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildSoapPump({ scene });
  },

  steps: [
    {
      id: 'dose',
      heading: '1 · Press, and out it comes',
      body: 'Press the head of a soap pump and about 2 mL lands in your hand, the same amount every time. There is no motor and no battery, only a plastic head screwed onto a bottle. What is odd is where that dose comes from. Your press does not pull it out of the bottle.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [1.08, 2.68, 4.81], target: [-0.97, 1.51, 0.52] },
      dofAperture: 0.00002,
      focus: ['Pump head', 'Nozzle'],
      onEnter: view(0, 'exterior'),
      timeline: loop(11400, 3),
    },
    {
      id: 'inside',
      heading: '2 · A tiny piston pump',
      body: 'Cut the pump in half and you find a small piston pump. A plastic cylinder hangs from the cap down into the soap. Inside it, a piston rides on a hollow stem that leads up to the nozzle. A steel spring underneath pushes the piston up, and a thin straw, the dip tube, reaches to the bottom of the bottle. In this design the only valves are two glass balls, each smaller than a peppercorn.',
      camera: { position: [0.79, 2.54, 2.44], target: [-0.33, 2.14, 0.26] },
      dofAperture: 0.00006,
      onEnter: view(1, 'internal', { flows: true }),
      timeline: loop(12000, 3),
    },
    {
      id: 'intake',
      heading: '3 · Letting go fills it',
      body: 'Watch the bottom ball as the piston rises. The spring pushes it up, the space under it grows, and the pressure inside drops. Air, let in through a pinhole vent under the cap, presses down on the soap in the bottle and now pushes harder than anything in the chamber, so it drives the soap up the dip tube, lifts the lower ball off its seat and fills the chamber. The upper ball stays shut, so nothing is drawn back in from the nozzle.',
      hint: 'Your thumb has already let go. The spring is loading the next dose.',
      camera: { position: [-0.83, 2.11, 1.37], target: [-0.36, 1.92, -0.12] },
      dofAperture: 0.00012,
      focus: ['Lower ball valve', 'Return spring'],
      onEnter: view(1, 'intake', { flows: 'intake', dose: false, stroke: 0.5 }),
      timeline: dwell(6000, 0.5, 0.8, 1.0),
    },
    {
      id: 'delivery',
      heading: '4 · Pressing empties it',
      body: 'Now press. The piston drives down, and the soap under it has to go somewhere. It slams the lower ball onto its seat, which closes the way back to the bottle. The only way out is up through the piston: the soap lifts the upper ball, runs up the hollow stem and leaves through the nozzle. Every dose you get was drawn in on your last release. The press only pushes it out.',
      camera: { position: [1.14, 2.95, 2.15], target: [-0.18, 2.18, 0.3] },
      dofAperture: 0.00012,
      focus: ['Upper ball valve', 'Nozzle'],
      onEnter: view(1, 'delivery', { flows: 'delivery' }),
      timeline: dwell(6000, 0, 0.78, 0.5),
    },
    {
      id: 'prime',
      heading: '5 · Why a new pump spits air',
      body: 'A new pump is full of air, and air squashes. Pressing only compresses it and puffs a little out of the nozzle. Letting go draws the soap just part of the way up. Each stroke lifts the column higher: up the dip tube, past the lower ball, into the chamber. Once the chamber holds liquid, which does not squash, the next press pushes soap out. Here it takes five presses; real pumps usually need three to six.',
      hint: 'Shown on a loop: after the first squirt it resets to an empty pump.',
      camera: { position: [0.51, 2.19, 4.09], target: [-0.7, 1.63, 0.29] },
      dofAperture: 0.00004,
      focus: ['Dip tube', 'Pump chamber'],
      onEnter: view(1, 'prime', { priming: true }),
      timeline: loop(16000, 5, { priming: true }),
    },
    {
      id: 'run',
      heading: '6 · Press, release, press',
      body: 'Each press shuts the lower ball and sends a dose out of the nozzle. Each release shuts the upper ball while the spring draws the next dose up. That is about 2 mL a stroke, from a 14.5 mm piston moving 12 mm. You press. The spring does the pulling.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [3.53, 2.05, 4.07], target: [-0.64, 1.53, 1] },
      dofAperture: 0.00002,
      freeOrbit: true,
      onEnter: view(0, false),
      timeline: loop(6600, 3),
    },
  ],
});
