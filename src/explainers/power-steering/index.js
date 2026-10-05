import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildPowerSteering } from './model.js';

// Zoom-in / reveal story (story.js is the contract): the sealed system, the
// plain rack and pinion under it, the pump that never stops (open centre),
// the torsion bar, the rotary valve, the power cylinder closing the loop,
// then everything back together at speed. Every mechanism step loops
// model.js's canonical steering lap (setCycle): rack, pinion, twist,
// pressures and whole-turn pump/oil phases all derive from one scalar.

// Pin the full layer/label state on entering a step (pre-flight #4). There
// is no turntable; the lap scalar owns every moving part.
const view =
  (reveal, labelMode, insert = false) =>
  ({ handles }) => {
    handles.setReveal(reveal);
    handles.setInsert(insert);
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
    return buildPowerSteering({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'Two fingers, two tyres',
      body: 'Turn the wheel of a parked car. Each front tyre is pressed into the ground by hundreds of kilos and has to be scrubbed sideways across it, yet the wheel moves under two fingers. The help comes from the pump at the back, turned by a belt from the engine, and from the oil it sends through two hoses to the steering rack between the tyres.',
      hint: 'Drag to orbit · scroll to open it up.',
      camera: { position: [4.03, 3.57, 7.7], target: [-1.79, 1.19, 0.46] },
      focus: ['Power-steering pump'],
      onEnter: view(0, 'exterior'),
      timeline: lap(7500),
    },
    {
      id: 'rack',
      heading: 'Underneath, a plain rack and pinion',
      body: 'Strip away the hydraulics and this is what steers. The column ends in a small seven-tooth gear, the pinion, meshed with teeth cut along a steel bar, the rack. Turn the pinion and the rack slides sideways, pushing one tie rod out and pulling the other in, and the steering arms swing each tyre about its pivot. None of this needs oil. It is just heavy.',
      camera: { position: [-0.07, 2.3, 1.47], target: [1.02, 1.54, -0.65] },
      focus: ['Pinion — 7 teeth', 'Rack'],
      onEnter: view(1, 'rack'),
      timeline: lap(6000),
    },
    {
      id: 'pump',
      heading: 'The pump never stops',
      body: 'Whenever the engine runs, so does the pump. A slotted rotor spins inside an oval cam ring, and ten vanes slide out against the ring, gathering oil where the gaps widen and squeezing it out where they close. With the wheel centred the oil does no work. It runs straight through the valve and back to the reservoir at a few bar. The pump is always working; the valve decides where that work goes.',
      hint: 'Oil loop: pump → pressure hose → valve → reservoir.',
      camera: { position: [-0.3, 1.2, -0.1], target: [-0.95, 1.0, -1.35] },
      focus: ['Vane rotor'],
      onEnter: view(1, 'pump'),
      timeline: lap(6000, 'setIdle'),
    },
    {
      id: 'torsion',
      heading: 'Your wheel isn’t bolted to the pinion',
      body: 'The shaft from your steering wheel does not grip the pinion. The only thing joining them is a torsion bar, a steel rod about as thick as a pencil. Push on the wheel and the bar winds up before the pinion follows, and the two orange marks drift apart; ease off and it springs back. At full assist the twist is about 3.5°, drawn here four times larger so the stripe can be seen winding.',
      camera: { position: [1.4, 1.95, 0.75], target: [0.72, 1.72, -0.36] },
      focus: ['Torsion bar'],
      onEnter: view(1, 'torsion'),
      timeline: lap(6000),
    },
    {
      id: 'valve',
      heading: 'The twist is the valve',
      body: 'Around the torsion bar sits the valve. The inner spool turns with your wheel, and the sleeve around it turns with the pinion. Both are cut with eight grooves. Centred, every sleeve groove is open a little to pump pressure and a little to return, so nothing pushes. Twist a few degrees and the spool’s edges slide across: grooves on one side seal off from return and fill with pressure, while the others open wide to return. Steer the other way and the pattern flips.',
      hint: 'Magnified slice seen from above, turned to face you. Twist drawn 4× larger.',
      camera: { position: [1.9, 2.75, 2.3], target: [1.0, 2.2, -0.35] },
      focus: ['Spool — turns with your wheel'],
      onEnter: view(1, 'valve', true),
      timeline: lap(6000),
    },
    {
      id: 'cylinder',
      heading: 'Seven hundred kilos, on request',
      body: 'The pressure goes to a cylinder built into the rack housing, where a piston is fixed to the rack. About 100 bar on that piston is some 700 kg of push, enough to drag both tyres across the ground. As the rack moves it turns the pinion after your hands, so the twist unwinds and the valve closes again. Hold the wheel still and the assist settles to whatever the tyres push back with. It follows you and never takes over.',
      camera: { position: [0.67, 2.52, 2.46], target: [-0.65, 1.52, -0.3] },
      focus: ['Piston — fixed to the rack'],
      onEnter: view(1, 'cylinder'),
      timeline: lap(6000),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Back together and running faster. Your hands twist a rod a few degrees, the twist meters oil, the oil moves the rack, and the rack unwinds the twist. If the engine stalls the pump stops with it, and the torsion bar winds up to a mechanical stop and turns the pinion directly. You can still steer, just heavily. You never turned the wheels. You twisted a rod.',
      hint: 'Drag to orbit while it steers.',
      camera: { position: [-0.05, 5.87, 8.3], target: [-2.08, 1.37, -0.37] },
      freeOrbit: true,
      onEnter: view(0, false),
      timeline: lap(4000),
    },
  ],
});
