import { defineExplainer } from '../../framework/index.js';
import { TAU, smooth } from '../../framework/motion.js';
import meta from './meta.js';
import { buildNuclearPlant } from './model.js';

// Every step runs the plant as a seamless loop. One lap advances the water a
// whole circuit of each closed loop, the shaft a whole number of turns, and the
// fission event a whole number of splits — so the wrap is invisible. `rods:
// 'cycle'` sweeps the control rods all the way in and back out again over the
// lap, which also returns to its start pose.
//
// The scalars a step does NOT animate are pinned in onEnter, so no step can
// inherit a random mid-lap pose from whichever step the viewer came from.
function run({ duration = 4000, turns = 6, events = 2, rods = 0, reveal = 1, gridOn = 0, labels = null }) {
  const cycling = rods === 'cycle';
  const restRods = cycling ? 0 : rods;
  return {
    onEnter: ({ handles }) => {
      handles.setLabels(labels);
      handles.set({ flow: 0, spin: 0, fission: 0, rods: restRods, reveal, gridOn });
    },
    timeline: ({ tl, handles }) => {
      const s = { t: 0 };
      tl.add(s, {
        t: 1,
        duration,
        ease: 'linear',
        onUpdate: () =>
          handles.set({
            flow: s.t,
            spin: s.t * TAU * turns,
            fission: s.t * events,
            // a symmetric in-and-out sweep: 0 at both ends of the lap, and the
            // smoothstep flattens the turn so the wrap has no visible kink
            rods: cycling ? smooth(1 - Math.abs(1 - 2 * s.t)) : restRods,
          }),
      });
    },
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildNuclearPlant({ scene });
  },

  stageOptions: { dof: true },

  steps: [
    {
      id: 'anatomy',
      heading: 'The anatomy',
      body: "A nuclear station is mostly concrete and steam. The domed building is the containment — a steel-lined concrete shell built to hold whatever happens inside it. Everything to the right of it is an ordinary steam power plant, near enough identical to one burning coal: turbine hall, condenser, cooling tower. The nuclear part is only the fire.",
      hint: 'Drag to orbit · scroll to go inside.',
      camera: { position: [2.3, 3.5, 8.4], target: [-0.5, 1.15, 0] },
      focus: ['Containment building'],
      ...run({ duration: 8000, turns: 4, events: 2, reveal: 0, labels: 'anatomy' }),
    },
    {
      id: 'inside',
      heading: '1 · Inside the dome',
      body: "Take the concrete away and there are only four objects worth naming. The squat vessel on the left holds the uranium. The taller one beside it is the steam generator. The slim one is the pressuriser, and the motor between them drives water round and round between the first two. That is the entire nuclear island: a kettle, a pump, and a pressure regulator.",
      camera: { position: [-1.11, 2.34, 2.7], target: [-2.35, 1.1, -0.2] },
      dofAperture: 0.00008,
      focus: ['Reactor pressure vessel'],
      ...run({ duration: 6000, turns: 5, events: 2, labels: 'inside' }),
    },
    {
      id: 'fission',
      heading: '2 · One atom splits',
      body: "A uranium-235 nucleus is only just holding itself together. When a slow-moving neutron drifts in and is absorbed, the nucleus stretches and tears into two unequal pieces — one roughly 95 times the mass of a hydrogen atom, the other about 135 — and throws them apart with some 200 million electronvolts of energy. Almost all of that is simply motion: the fragments barge into the atoms around them and the fuel gets hot. Each split also flings out two or three fresh neutrons.",
      camera: { position: [-1.74, 0.98, 0.89], target: [-2.37, 0.81, 0.26] },
      dofAperture: 0.00035,
      focus: ['U-235 nucleus'],
      ...run({ duration: 5200, turns: 4, events: 1, labels: 'fission' }),
    },
    {
      id: 'fuel',
      heading: '3 · The fuel, and the water it needs',
      body: "The uranium sits as ceramic pellets the size of a pencil eraser, stacked inside the thin metal tubes you can see glowing here — one pellet carries the heat of about a ton of coal. But the neutrons a split throws out come off fast, and fast neutrons are poor at splitting uranium; they mostly pass straight through. The water packed around the rods slows them by collision until they drift slowly enough to be caught. So the coolant is also the thing that makes the reaction possible: lose the water and the chain reaction stops by itself.",
      camera: { position: [-1.73, 1.06, 0.98], target: [-2.52, 0.76, 0.19] },
      dofAperture: 0.0003,
      focus: ['Fuel rods — UO2 pellets in zircaloy'],
      ...run({ duration: 4600, turns: 4, events: 2, labels: 'fuel' }),
    },
    {
      id: 'rods',
      heading: '4 · The throttle',
      body: "Control rods hang above the core on their own drive mechanisms. They are packed with boron, which swallows neutrons without splitting — so lowering them into the fuel starves the chain reaction, and lifting them lets it build again. Watch the core dim as they come down. They are held up electromagnetically: cut the power and they simply fall, and the reaction is over in seconds.",
      camera: { position: [-1.32, 1.24, 1.26], target: [-2.46, 1.08, 0.12] },
      dofAperture: 0.00018,
      focus: ['Boron control rods'],
      ...run({ duration: 5400, turns: 4, events: 2, rods: 'cycle', labels: 'rods' }),
    },
    {
      id: 'primary',
      heading: '5 · Water that cannot boil',
      body: "The water around the fuel leaves at about 315°C, far past boiling — and stays liquid, because the whole loop is held at 155 times atmospheric pressure. Pinning it there is the pressuriser's only job: a tank of the same water with electric heaters in its base, boiling just enough to set the pressure of the entire circuit. This water is radioactive, and it never leaves the dome.",
      camera: { position: [-0.4, 1.35, 1.75], target: [-2.05, 0.9, -0.02] },
      dofAperture: 0.00005,
      focus: ['Pressuriser holds the pressure'],
      ...run({ duration: 5000, turns: 5, events: 2, labels: 'primary' }),
    },
    {
      id: 'steamgen',
      heading: '6 · The handoff',
      body: "Inside the steam generator, that hot primary water runs up and back down through a bundle of thin U-tubes — several thousand of them in a real unit. Ordinary water fills the space around them, and boils. The two never meet; only heat crosses the tube wall. So the steam leaving the top of this vessel has never been near the uranium, which is why people walk around the turbine hall in shirtsleeves.",
      camera: { position: [-0.9, 1.35, 1.06], target: [-1.74, 1.38, -0.18] },
      dofAperture: 0.00012,
      focus: ['Thousands of U-tubes'],
      ...run({ duration: 4800, turns: 5, events: 2, labels: 'steamgen' }),
    },
    {
      id: 'power',
      heading: '7 · An ordinary steam plant',
      body: "From here nothing is nuclear. The steam blasts through a high-pressure turbine and then two low-pressure ones, whose blades grow longer stage by stage as the steam expands and needs more room. All of it turns a single shaft into the generator, where magnetic poles sweeping past fixed windings induce the current. The spent steam condenses back to water, the cooling tower throws the leftover heat away as plain water vapour, and a transformer steps the voltage up for the grid.",
      camera: { position: [2.05, 2.25, 3.6], target: [0.65, 1.15, 0] },
      dofAperture: 0.00006,
      focus: ['Generator'],
      ...run({ duration: 3800, turns: 7, events: 2, gridOn: 1, labels: 'power' }),
    },
    {
      id: 'run',
      heading: 'The plant runs',
      body: "Three circuits of water nested inside one another: one that touches the fuel and never leaves the dome, one that carries clean steam to the turbine, and one that dumps what is left to the sky. At the centre of all of it sits a stack of ceramic pellets you could hold in one hand, quietly doing the work of a coal train.",
      hint: 'Drag to orbit the running plant.',
      camera: { position: [3.4, 3.2, 7.6], target: [-0.35, 1.2, 0] },
      freeOrbit: true,
      ...run({ duration: 5200, turns: 9, events: 4, reveal: 0, gridOn: 1, labels: null }),
    },
  ],
});
