import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildHydraulicSystem } from './model.js';

// Zoom-in / reveal story (story.js is the contract): the sealed power pack
// lifting a tonne, the gear pump inside, the centred valve unloading the pump
// while the cylinder holds, the spool, the cylinder doing the work, the relief
// valve capping it all, then everything sealed and running. Every step loops
// one of model.js's lap programs (setCycle / setIdle / setRelief); boom,
// spool, lever, gauge, oil colours and packets all derive from that scalar.

// Pin the whole reveal/label state on entering a step (pre-flight #4). There
// is no turntable; the lap scalar owns every moving part.
const view =
  (reveal, labelMode) =>
  ({ handles }) => {
    handles.setReveal(reveal);
    handles.setLabels(labelMode);
  };

function lap(duration, fn = 'setCycle') {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state, never shared across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles[fn](s.t) });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildHydraulicSystem({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'A tonne on the end of an arm',
      body: 'An electric motor sits on a steel tank of oil. Two hoses run from a valve block to a cylinder under a steel boom, and a one-tonne block hangs off the end. Pull the lever and the boom lifts the tonne smoothly and almost silently. Let go and it stops dead in mid-air. All of that work is done by oil.',
      hint: 'Drag to orbit · scroll to open it up.',
      camera: { position: [1.99, 2.58, 7.14], target: [-1.33, 1.14, 0.24] },
      focus: ['Hydraulic cylinder'],
      onEnter: view(0, 'exterior'),
      timeline: lap(9500),
    },
    {
      id: 'pump',
      heading: 'Two gears and a lot of oil',
      body: 'On the end of the motor shaft sits a gear pump: two twelve-tooth gears in a tight figure-eight case. The oil is not squeezed between the meshing teeth. It drops into the tooth gaps on the inlet side, rides around the outside of both gears against the case wall, and is pushed out where the teeth mesh again. Every turn moves the same 8 cc, about 12 litres a minute.',
      hint: 'Front cover off · gears slowed about 40×.',
      camera: { position: [-1.67, 1.28, 1.45], target: [-2.31, 1.07, 0.21] },
      focus: ['Oil rides round the outside'],
      onEnter: view(1, 'pump'),
      timeline: lap(11000, 'setIdle'),
    },
    {
      id: 'loop',
      heading: 'Full flow, almost no pressure',
      body: 'With the lever centred the pump is still running flat out. Its oil goes into the valve, straight back out to the tank, and round again. Nothing stands in its way, so the gauge reads about 6 bar. The same valve has shut both hoses, so the oil on the lift side is locked in, still at the 70 bar it takes to hold the boom up. Oil barely compresses, so locked-in oil is as good as a steel prop.',
      camera: { position: [-0.62, 1.8, 2.22], target: [-2.09, 1.03, 0.13] },
      focus: ['Gauge 6 bar', 'Port A shut — oil locked in'],
      onEnter: view(1, 'loop'),
      timeline: lap(8000, 'setIdle'),
    },
    {
      id: 'valve',
      heading: 'A spool decides where the oil goes',
      body: 'The lever slides a steel spool along a bore through the valve block. Its raised lands open some passages and seal others, and one move does three things at once. It shuts the path straight back to the tank, opens the pump to port A and the lift side of the cylinder, and opens port B, the other side, to the tank. Push the lever the other way and A and B swap.',
      hint: 'Valve block cut in half along the spool.',
      camera: { position: [-1.02, 1.57, 1.61], target: [-1.6, 1.25, 0.22] },
      focus: ['Spool'],
      onEnter: view(1, 'valve'),
      timeline: lap(9500),
    },
    {
      id: 'cylinder',
      heading: 'Pressure rises until the boom moves',
      body: 'Now the pump’s oil has nowhere to go but under the piston. The pressure climbs until it can lift the load and then stays there, about 70 bar for this boom and its tonne. That 70 bar pushes on every square centimetre of the 63 mm piston, about 2.2 tonnes of push in all. Lowering, the pump fills the smaller rod side instead, so the boom comes down about one and a half times faster.',
      camera: { position: [1.59, 1.61, 3.4], target: [-0.26, 1.13, 0.2] },
      focus: ['Piston'],
      onEnter: view(1, 'cylinder'),
      timeline: lap(13000, 'setWork'),
    },
    {
      id: 'relief',
      heading: 'One spring sets the limit',
      body: 'Keep the lever pulled once the piston reaches the end of the cylinder and nothing can move. The pump keeps pushing the same flow, so the gauge needle shoots up. At 200 bar it pushes a small poppet off its seat against a spring, and all the flow pours back to the tank, its energy turned into heat. That spring sets the most this system can ever push: 200 bar on this piston is about 6 tonnes.',
      hint: 'Poppet lift drawn larger than life.',
      camera: { position: [-1.49, 1.39, 1.48], target: [-2.08, 1.26, 0.3] },
      focus: ['Poppet'],
      onEnter: view(1, 'relief'),
      timeline: lap(14000, 'setRelief'),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Lift, hold, lower. The pump only ever makes flow, the same few cubic centimetres every turn. The valve chooses where that flow goes, and the load decides how hard it has to push, up to the limit the spring allows. The pump only pushes. The load decides the pressure.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [-2.43, 3.27, 6.98], target: [-1.36, 1.35, -0.2] },
      freeOrbit: true,
      onEnter: view(0, false),
      timeline: lap(6500),
    },
  ],
});
