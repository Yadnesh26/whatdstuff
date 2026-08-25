import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildMotor } from './model.js';

// Every step loops while active. Seamlessness rule: the rotor advances a
// WHOLE number of turns per lap and the current beads a whole number of
// passes, so each wrap lands on an identical pose. The commutation pattern
// repeats every 120°, but whole turns are the safe contract.
const TURN = Math.PI * 2;

// Every step pins EVERY state field. Anything left unset inherits the
// previous step's mid-lap phase and misframes the fixed camera.
const pin = (handles, s) =>
  handles.set({
    spin: 0,
    reveal: 0,
    power: 0,
    flow: 0,
    fieldViz: 0,
    forceViz: 0,
    ...s,
  });

export default defineExplainer({
  ...meta,

  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildMotor({ scene });
  },

  steps: [
    {
      id: 'overview',
      heading: 'A can that turns',
      body: 'Almost every motor you own is this object: a steel can about as big as your thumb, two tabs at the back, one shaft out the front. Electricity goes in at the tabs. Rotation comes out of the shaft. Nothing else about it touches the outside world — which is why nobody ever opens one.',
      hint: 'Drag to orbit · scroll to open it up.',
      camera: { position: [1.55, 1.95, 4.55], target: [-0.25, 1.0, 0] },
      dofAperture: 0.00003,
      focus: ['Output shaft', 'Power terminals'],
      onEnter: ({ handles }) => {
        pin(handles, { power: 1 });
        handles.setLabels('exterior');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6400,
          ease: 'linear',
          onUpdate: () => handles.set({ spin: s.t * TURN * 2, flow: (s.t * 2) % 1 }),
        });
      },
    },
    {
      id: 'inside',
      heading: 'Two magnets and a spinning coil',
      body: 'Lift the can and there is almost nothing in here. Two curved permanent magnets are bonded to the wall — north above, south below — filling the inside with a steady magnetic field. Down the middle, on the shaft, sits the armature: three iron teeth wrapped in copper wire. It never touches the magnets. The gap is about a millimetre of air.',
      // Down the bore, not at the side: 135° magnet arcs leave only a slit to
      // look through side-on, so every internal step is framed axially.
      camera: { position: [-2.4, 2.55, 2.9], target: [0.02, 1.05, 0] },
      dofAperture: 0.00008,
      focus: ['North pole magnet', 'South pole magnet', 'Armature'],
      onEnter: ({ handles }) => {
        pin(handles, { reveal: 1, power: 1, fieldViz: 0.85 });
        handles.setLabels('inside');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () => handles.set({ spin: s.t * TURN * 2, flow: (s.t * 2) % 1 }),
        });
      },
    },
    {
      id: 'armature',
      heading: 'The coil becomes a magnet',
      body: 'Push current through one of those copper windings and its iron tooth turns into an electromagnet — a real north pole, sticking out sideways. The permanent magnet above shoves it away; the one below pulls it in. The armature swings. That is the entire trick: an electromagnet you can switch off, chasing magnets you cannot.',
      camera: { position: [-2.55, 1.75, 2.15], target: [-0.05, 1.03, 0.02] },
      dofAperture: 0.00022,
      focus: ['Copper winding', 'Laminated iron core'],
      onEnter: ({ handles }) => {
        pin(handles, { reveal: 1, power: 1, fieldViz: 0.5 });
        handles.setLabels('armature');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4200,
          ease: 'linear',
          onUpdate: () => handles.set({ spin: s.t * TURN, flow: (s.t * 2) % 1 }),
        });
      },
    },
    {
      id: 'commutator',
      heading: 'The switch made of geometry',
      body: 'Swing far enough and the coil lines up with the magnets — and stops pulling. So the copper drum on the end of the shaft is split into three segments, turning under two blocks of carbon. The instant a winding reaches alignment, its segment slides out from under the brush and the next one takes over. Watch the colours hand off: that is the current reversing, a few hundred times a second, with no electronics anywhere.',
      // Over the TOP of the drum: the brushes sit at ±Z, so any view with a
      // big +Z component puts one of them in front of the segments. At ~43°
      // of elevation the lens clears both brushes and sees the whole upper
      // arc — warm segment, dark one mid-handover, cool one — at once.
      camera: { position: [0.95, 2.55, 1.6], target: [0.5, 1.03, 0] },
      dofAperture: 0.00016,
      focus: ['Three copper segments', 'Carbon brush'],
      onEnter: ({ handles }) => {
        pin(handles, { reveal: 1, power: 1 });
        handles.setLabels('commutator');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5000,
          ease: 'linear',
          onUpdate: () => handles.set({ spin: s.t * TURN, flow: (s.t * 3) % 1 }),
        });
      },
    },
    {
      id: 'force',
      heading: 'Why it only ever turns one way',
      body: 'A wire carrying current across a magnetic field gets shoved sideways — always at right angles to both. Each winding runs down the two slots either side of its tooth, so when a tooth swings broadside, its wire is sitting squarely under the magnet faces, in the thickest part of the field, and takes the full shove. Watch the arrow: same push, same direction, every time. Reverse a winding at exactly the moment its shove would flip, and the shove never flips — so a battery that only pushes one way turns the shaft forever.',
      camera: { position: [-2.9, 1.25, 0.95], target: [0.05, 1.05, 0] },
      dofAperture: 0.00012,
      focus: ['Push on the tooth', 'Magnetic field, N to S'],
      onEnter: ({ handles }) => {
        pin(handles, { reveal: 1, power: 1, fieldViz: 0.9, forceViz: 1 });
        handles.setLabels('force');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4600,
          ease: 'linear',
          onUpdate: () => handles.set({ spin: s.t * TURN, flow: (s.t * 3) % 1 }),
        });
      },
    },
    {
      id: 'run',
      heading: 'Sealed, spinning, wearing out',
      body: 'Close it up and it is a plain metal cylinder again, humming. With nothing to drag on it, a can this size passes fifteen thousand turns a minute. Only three things move: the shaft, the armature and the two little blocks of carbon — and those are sacrificial, grinding themselves away every second it runs. When the brushes finally give up, the motor dies. Deleting them is the entire reason brushless motors exist.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [2.4, 1.85, 4.65], target: [-0.2, 1.0, 0.05] },
      dofAperture: 0.00003,
      freeOrbit: true,
      onEnter: ({ handles }) => {
        pin(handles, { power: 1 });
        handles.setLabels(false);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4000,
          ease: 'linear',
          onUpdate: () => handles.set({ spin: s.t * TURN * 6, flow: (s.t * 5) % 1 }),
        });
      },
    },
  ],
});
