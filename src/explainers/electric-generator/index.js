import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildGenerator } from './model.js';

// Every step loops while active. Seamlessness rule: the rotor advances a WHOLE
// number of turns per lap and the DC beads a whole number of passes, so each
// wrap lands on an identical pose. A 2-pole rotor makes exactly one electrical
// cycle per mechanical turn, so the output waveform is seamless for free — it
// IS the rotor angle. The scope draws TWO wavelengths, so any step that shows
// it needs an EVEN turn count for the trace bead to land back where it began.
const TURN = Math.PI * 2;

// Start angle that parks the north pole in the middle of the 60° stator
// cutaway (the pole sits at 90° − spin, the wedge spans 0°–60°).
const POLE_IN_WEDGE = Math.PI / 3;

// Every step pins EVERY state field. Anything left unset inherits the previous
// step's mid-lap phase and misframes the fixed camera.
const pin = (handles, s) =>
  handles.set({
    spin: 0,
    reveal: 0,
    cut: 0,
    run: 0,
    excite: 0,
    load: 0,
    flow: 0,
    fieldViz: 0,
    dragViz: 0,
    scopeViz: 0,
    gapViz: 0,
    coilGain: 1,
    ...s,
  });

export default defineExplainer({
  ...meta,

  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildGenerator({ scene });
  },

  steps: [
    {
      id: 'overview',
      heading: 'The box that makes power',
      body: 'Petrol in the top, electricity out of the front. Between them sits an engine that is never allowed to change speed, and a drum of copper about the size of a coffee tin. Nothing on the outside tells you which half does what — and the half that actually makes the electricity is the quiet one.',
      hint: 'Drag to orbit · scroll to take the covers off.',
      camera: { position: [2.887, 2.5, 4.261], target: [-0.413, 1.18, 0.161] },
      dofAperture: 0.00003,
      focus: ['Petrol engine', 'Alternator head'],
      onEnter: ({ handles }) => {
        pin(handles, { run: 1, excite: 1 });
        handles.setLabels('exterior');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6400,
          ease: 'linear',
          onUpdate: () => handles.set({ spin: s.t * TURN * 3, flow: (s.t * 3) % 1 }),
        });
      },
    },
    {
      id: 'shaft',
      heading: 'Two machines, one shaft',
      body: 'Take the covers off and there is nothing clever in between. No gearbox, no belt, no clutch. The engine’s crankshaft comes straight out of the back and bolts to the generator’s rotor through that flanged coupling — one shaft, one speed, no ratio anywhere. The engine’s entire job is to turn it at exactly the speed it is already turning. Everything that actually makes electricity happens inside the drum on the right.',
      camera: { position: [2.589, 2.2, 3.145], target: [-0.161, 1.12, 0.095] },
      dofAperture: 0.00005,
      focus: ['Crankshaft', 'The alternator'],
      onEnter: ({ handles }) => {
        pin(handles, { reveal: 1, run: 1, excite: 1 });
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
      id: 'gap',
      heading: 'A magnet in a ring of copper',
      body: 'We have cut a wedge out of the drum. Inside: a ring of iron teeth packed with copper wire, sitting perfectly still — and spinning in the middle of it, a magnet. The two never touch. The gap between them is about half a millimetre, the thickness of a fingernail, and that gap is the entire machine. Every other part is only there to hold those two that far apart, that accurately, fifty times a second.',
      // Wider and lower than the macro that follows — the drum has to read as
      // a drum here before step 4 pushes into it. Still angled into the
      // cutaway, so the stator's copper end-turn crown reads as a ring with
      // the rotor's pole face inside it.
      camera: { position: [1.805, 1.789, 1.425], target: [0.4, 1.05, 0.02] },
      dofAperture: 0.00014,
      focus: ['Rotor core', 'Air gap'],
      onEnter: ({ handles }) => {
        pin(handles, { reveal: 1, cut: 1, run: 1, excite: 1, fieldViz: 0.7, gapViz: 1 });
        handles.setLabels('rotorSet');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4600,
          ease: 'linear',
          onUpdate: () =>
            handles.set({ spin: POLE_IN_WEDGE + s.t * TURN * 2, flow: (s.t * 2) % 1 }),
        });
      },
    },
    {
      id: 'induction',
      heading: 'Nothing happens until something changes',
      body: 'Copper sitting next to a magnet does nothing at all. Copper next to a magnet that is moving makes voltage — and that condition is fussier than it sounds. Watch the coils as the pole sweeps past. The one the magnet is pointing straight at goes dark. The bright ones are a quarter-turn away, off to either side, where the field threading them is swinging fastest. The voltage never came from the magnet being there. It comes from it leaving.',
      // Also axial: each slot's crown carries its OWN coil's colour, so end-on
      // the whole ring becomes a bright band rotating a quarter-turn behind the
      // pole — which is the entire claim of this step, drawn in copper.
      camera: { position: [1.264, 1.625, 0.695], target: [0.42, 1.03, 0.0] },
      dofAperture: 0.0002,
      focus: ['Stator winding', 'Rotor pole'],
      onEnter: ({ handles }) => {
        pin(handles, { reveal: 1, cut: 1, run: 1, excite: 1, fieldViz: 0.22, coilGain: 1.75 });
        handles.setLabels('induct');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4200,
          ease: 'linear',
          onUpdate: () => handles.set({ spin: POLE_IN_WEDGE + s.t * TURN, flow: (s.t * 2) % 1 }),
        });
      },
    },
    {
      id: 'wave',
      heading: 'Why it comes out as a wave',
      body: 'Each coil gets shoved one way as the north pole sweeps up to it, then the other way as the south pole follows it round. Wire the coils so those shoves add up and the output is a wave. Nobody designed that shape — it is just what a magnet going round in a circle looks like from the outside. One turn of the shaft, one full cycle. Which is why the engine is never allowed to speed up: 3,000 rpm is 50 hertz, 3,600 is 60, and a mechanical governor spends the machine’s entire life holding it there.',
      camera: { position: [2.684, 1.62, 2.632], target: [0.854, 0.96, 0.532] },
      dofAperture: 0.00009,
      focus: ['One turn, one cycle'],
      onEnter: ({ handles }) => {
        pin(handles, { reveal: 1, cut: 1, run: 1, excite: 1, scopeViz: 1 });
        handles.setLabels('wave');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () => handles.set({ spin: s.t * TURN * 4, flow: (s.t * 2) % 1 }),
        });
      },
    },
    {
      id: 'rings',
      heading: 'Where the magnet gets its magnetism',
      body: 'The spinning part is not a permanent magnet — it is an electromagnet, which means its own current has to get aboard something already moving. Two brass rings on the shaft, two carbon blocks pressed down on top of them. Now look at what is NOT going through them: the power. All of that is made in the stator, which never moves, so these sliding contacts carry only the few amps needed to magnetise the rotor. A motor does it the other way round — it runs its entire current through a split ring, a commutator, and wears it out. This machine keeps its one rubbing part out of the main circuit altogether.',
      hint: 'The first volts come from magnetism left in the iron from last time.',
      camera: { position: [1.314, 1.509, 0.909], target: [0.87, 1.1, 0.0] },
      dofAperture: 0.00026,
      focus: ['Slip rings — continuous', 'Carbon brushes'],
      onEnter: ({ handles }) => {
        pin(handles, { reveal: 1, cut: 1, run: 1, excite: 1 });
        handles.setLabels('rings');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4800,
          ease: 'linear',
          onUpdate: () => handles.set({ spin: s.t * TURN * 2, flow: (s.t * 3) % 1 }),
        });
      },
    },
    {
      id: 'load',
      heading: 'Switch on a kettle, feel it in the shaft',
      body: 'Now actually draw some current. The moment it flows, the copper builds a magnetic field of its own — and it always points the wrong way, pushing back against the magnet that created it. The rotor gets physically harder to turn. The engine note drops, the governor opens the throttle, and the machine starts drinking more petrol. You are not collecting electricity that was already there. You are buying it, in torque, in real time.',
      // Pulled back and lifted from the two macro steps before it: the beat is
      // "stand back and watch the whole machine strain", and three shots at
      // the same distance and height in a row read as a stuck camera.
      camera: { position: [1.3, 2.354, 1.415], target: [0.3, 1.08, 0.0] },
      dofAperture: 0.00007,
      focus: ['Reaction torque', 'Current out'],
      onEnter: ({ handles }) => {
        pin(handles, {
          reveal: 1,
          cut: 1,
          run: 1,
          excite: 1,
          load: 1,
          dragViz: 1,
        });
        handles.setLabels('load');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4200,
          ease: 'linear',
          onUpdate: () =>
            handles.set({ spin: POLE_IN_WEDGE + s.t * TURN * 2, flow: (s.t * 3) % 1 }),
        });
      },
    },
    {
      id: 'run',
      heading: 'Sealed, spinning, holding 50 hertz',
      body: 'Bolt it back together and it is an orange box again, buzzing on its rubber feet. The three parts inside scale all the way up without changing: at a power station the rotor is a steel cylinder the length of a bus, the air gap is still measured in millimetres, and it still turns at exactly these 3,000 rpm. Almost every watt you have ever used came out of a machine shaped like this one.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [3.111, 2.25, 3.969], target: [-0.289, 1.15, 0.269] },
      dofAperture: 0.00003,
      freeOrbit: true,
      onEnter: ({ handles }) => {
        pin(handles, { run: 1, excite: 1, load: 0.6 });
        handles.setLabels(false);
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4000,
          ease: 'linear',
          onUpdate: () => handles.set({ spin: s.t * TURN * 6, flow: (s.t * 4) % 1 }),
        });
      },
    },
  ],
});
