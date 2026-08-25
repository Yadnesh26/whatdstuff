import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildVacuum } from './model.js';

// Zoom-in / reveal story: the sealed upright, then the shell ghosts to expose
// one continuous airway — slot, brush roll, duct, cyclone, cones, filter,
// impeller, exhaust — and re-solidifies for the finale.
//
// Seamless loops: `flow` is the master phase clock and every dot is
// (flow + seed) % 1, so a whole number of cycles per lap wraps invisibly.
// `brush` and `impeller` advance whole turns; the belt's driven pulley is
// geared exactly 3:2 off the brush roll, so any EVEN brush-turn count also
// returns the pulley to its start angle.

const TAU = Math.PI * 2;

// Every step pins the complete state — reveal, labels, phase clock, both
// rotors and the bin's fill level. Anything left unpinned inherits the
// previous step's mid-lap phase and misframes a fixed camera.
const pin =
  (reveal, labels, fill) =>
  ({ handles }) => {
    handles.set({ reveal, flow: 0, brush: 0, impeller: 0, fill });
    handles.setLabels(labels);
  };

const spin =
  ({ flow = 1, brush = 4, imp = 12, duration }) =>
  ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({
          flow: s.t * flow,
          brush: s.t * TAU * brush,
          impeller: s.t * TAU * imp,
        }),
    });
  };

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildVacuum({ scene });
  },

  steps: [
    {
      id: 'sealed',
      heading: '1 · One long airway',
      body: 'From the outside an upright is a floor head, a clear bin at knee height and a handle to push. Run it forward and grit disappears off the carpet — a moment later it is sitting in that bin, dry and loose. Between those two moments nothing solid carries it. It rides on air.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [2.4, 2.1, 3.05], target: [-0.15, 1.26, 0.14] },
      dofAperture: 0.00003,
      onEnter: pin(0, 'exterior', 0.5),
      timeline: spin({ duration: 6000 }),
    },
    {
      id: 'path',
      heading: '2 · The whole path, end to end',
      body: 'Ghost the shell and there is one continuous route: a slot in the floor plate, a duct running up the front, a spiral through the bin, a pleated filter, and a motor buried in the ball. Air makes that entire trip in a fraction of a second, and does it fifty to a hundred cubic feet at a time, every minute.',
      hint: 'Follow the specks — that is the airflow.',
      camera: { position: [0.8, 1.55, 2.6], target: [-0.05, 0.98, 0.12] },
      dofAperture: 0.00006,
      onEnter: pin(1, 'path', 0.4),
      timeline: spin({ duration: 5200 }),
    },
    {
      id: 'head',
      heading: '3 · The head beats the carpet',
      body: 'Carpet will not give up dirt to airflow alone — grit sinks between the fibres and wedges there. So a brush roll spinning at one to three thousand rpm, driven off that small belt, hammers the pile from above. The shock shakes the grit loose for exactly as long as the air needs to take it. On hard floors you switch the roll off, because the same beating just flings grit sideways.',
      camera: { position: [0.55, 1.22, 1.3], target: [-0.04, 0.34, 0.55] },
      dofAperture: 0.0003,
      focus: ['Brush roll', 'Drive belt'],
      onEnter: pin(1, 'head', 0.4),
      timeline: spin({ brush: 6, duration: 2800 }),
    },
    {
      id: 'cyclone',
      heading: '4 · The bin spins the dirt out',
      body: 'The duct does not aim at the bin. It aims along its wall, so the air arrives already turning and keeps turning. Dust is hundreds of times denser than air and cannot make the tight inward corner: it slides out, hits the wall, loses its speed and drops. What is left turns in through the shroud — the fine mesh column in the middle — and heads up. Nothing is straining through a bag, which is why the suction does not fade as the bin fills.',
      hint: 'Watch which specks make the corner and which do not.',
      camera: { position: [1.25, 1.28, 1.05], target: [0.0, 1.04, 0.12] },
      dofAperture: 0.00012,
      focus: ['Tangential inlet', 'Dust thrown to the wall'],
      onEnter: pin(1, 'cyclone', 0.55),
      timeline: spin({ duration: 3600 }),
    },
    {
      id: 'cones',
      heading: '5 · Seven small cones for the fine stuff',
      body: 'Big debris is the easy half. Talc, pollen and skin flakes are light enough to follow the air around a slow corner, so the flow is split into seven narrow cones and the same trick is run much harder: the air accelerates from about 45 to 120 mph, and the spin puts over 79,000 g on everything in it. At that force even a grain of pollen is thrown to the wall. It slides to the tip and drops through the plate into the bin below. Whatever still survives meets the pleated pre-motor filter above.',
      camera: { position: [1.02, 1.78, 0.94], target: [0.0, 1.47, 0.12] },
      dofAperture: 0.00014,
      focus: ['Fine-dust cones'],
      onEnter: pin(1, 'filter', 0.55),
      timeline: spin({ duration: 3200 }),
    },
    {
      id: 'motor',
      heading: '6 · The motor never actually sucks',
      body: 'This is the part that surprises people: nothing in a vacuum pulls. An impeller inside the ball spins and throws air out through the vents in its sides, leaving the inside of the machine at roughly four fifths of normal air pressure. The atmosphere in your room is what does the pushing — it shoves air, and everything loose in it, down that slot to fill the gap. The exhaust leaves through a HEPA filter that keeps 99.97% of what is left, down to 0.3 micron.',
      hint: 'The vents are the whole reason the slot pulls.',
      camera: { position: [0.95, 0.8, 0.95], target: [0.02, 0.53, -0.1] },
      dofAperture: 0.00014,
      focus: ['Impeller', 'Exhaust vents'],
      onEnter: pin(1, 'motor', 0.45),
      timeline: spin({ imp: 16, duration: 2600 }),
    },
    {
      id: 'run',
      heading: '7 · Air doing all of the work',
      body: 'Sealed back up it is a brush, a bent tube, a spinning bin and a fan. The brush loosens, the fan lowers the pressure, the room pushes, and the corner does the sorting — and the only thing that ever carries your dirt is moving air, from the second it leaves the carpet to the second it lands in the bin.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [1.28, 1.62, 3.35], target: [-0.2, 1.3, 0.16] },
      dofAperture: 0.00003,
      freeOrbit: true,
      onEnter: pin(0, false, 0.6),
      timeline: spin({ flow: 2, brush: 8, imp: 24, duration: 2400 }),
    },
  ],
});
