import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildAntiLockBraking } from './model.js';

// Zoom-in / reveal story (story.js is the contract): the complete wheel on a
// moving road, the toothed ring and sensor that count its speed, the grip
// curve that says why locking is bad, the valve circuit that lets go and
// grabs again, the pedal buzzing back, two wheels steering (one locked), then
// everything together. Every step drives ONE lap function through a local
// tween object (model.js `setLap`); lap names pick the choreography.

// Pin the full layer/label state on entering a step (pre-flight #4).
const view =
  (layers, labelMode) =>
  ({ handles }) => {
    handles.setView(layers);
    handles.setLabels(labelMode);
  };

function lap(name, duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state, never shared across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.setLap(name, s.t % 1) });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildAntiLockBraking({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'A tyre on the edge of locking',
      body: 'This is one front corner of a car, standing on a moving road. In a panic stop the brakes try to freeze the wheel while the road keeps rushing underneath it. Watch the tyre: it keeps turning, slower and slower, without ever stopping. Something is stopping it from locking, and it is not the driver.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [1.2, 2.5, 5.6], target: [-2.2, 1.2, 0] },
      onEnter: view({ wheel: true, corner: true, mod: false }, false),
      timeline: lap('abs4', 9000),
    },
    {
      id: 'sensor',
      heading: 'A ring of teeth counts the speed',
      body: 'Take the wheel off. On the hub sits a toothed steel ring, 24 teeth here and often many more, turning with the wheel. A small magnetic sensor faces the teeth, and every tooth that passes makes one electrical pulse. Pulses per second is wheel speed. A wheel that locks stops making pulses, and the computer notices within a few thousandths of a second.',
      hint: 'Watch the sensor tip flash with each tooth.',
      camera: { position: [-4.2, 1.9, 2.2], target: [-2.4, 1.3, 0.2] },
      onEnter: view({ wheel: false, corner: true, mod: true }, 'sense'),
      timeline: lap('sense', 8000),
    },
    {
      id: 'slip',
      heading: 'Grip peaks before the wheel stops',
      body: 'Slip is how much slower the tyre surface turns than the road moves. At zero the tyre rolls freely. As slip grows, grip climbs, and it peaks around 15 percent. Past that the tyre starts to slide, and when the wheel locks completely it grips noticeably less than it did while still turning. The contact patch turns from green to red.',
      hint: 'The marker rides the curve: rolling, the peak, then locked.',
      camera: { position: [2.4, 2.6, 5.4], target: [-1.0, 1.5, 0] },
      onEnter: view({ wheel: true, corner: true, mod: false, chart: true, patch: true }, 'slip'),
      timeline: lap('slip', 10000),
    },
    {
      id: 'valves',
      heading: 'Hold, release, reapply',
      body: 'Between the pedal and the brake sits the ABS unit. The inlet valve is open, so pedal pressure reaches the caliper. When the wheel starts to lock it closes, holding the pressure. Then the outlet valve opens and fluid drains from the caliper into a spring-loaded accumulator, and the pump sends it back. The brake eases off, the wheel spins up, and the cycle starts again.',
      hint: 'Blue coil: inlet closed. Amber coil: outlet open.',
      camera: { position: [0.9, 2.1, 4.4], target: [0.9, 0.9, 0.3] },
      onEnter: view({ wheel: false, corner: true, mod: true }, 'valves'),
      timeline: lap('abs3', 12000),
    },
    {
      id: 'pulse',
      heading: 'Up to fifteen times a second',
      body: 'The computer repeats that cycle, hold, release, reapply, up to 15 times every second, keeping the wheel hovering around the peak of the grip curve. Here it is slowed so you can follow it. The pump pushing fluid back toward the master cylinder is what you feel as a buzz under your foot. The pedal is not broken. It is the sound of the brakes letting go.',
      hint: 'Watch the pedal kick back each time the pump runs.',
      camera: { position: [2.6, 3.2, 8.2], target: [-1.2, 1.3, 0.2] },
      onEnter: view({ wheel: true, corner: true, mod: true, chart: true, patch: true }, 'pulse'),
      timeline: lap('abs6', 9000),
    },
    {
      id: 'steer',
      heading: 'A rolling wheel can steer',
      body: 'Why bother? Turn the steering wheel in a skid and nothing happens, because a sliding tyre only pushes where it is already going. Here two wheels turn together. The locked one sails straight on along the red arrow. The one ABS keeps rolling follows the green arrow where it points. That is the real prize: the car still obeys you while it brakes as hard as it can.',
      hint: 'White arrow: where the wheel points. Coloured: where the car goes.',
      camera: { position: [-0.6, 4.8, -6.8], target: [-0.9, 0.9, -0.2] },
      onEnter: view({ wheel: false, corner: false, mod: false, steer: true }, 'steer'),
      timeline: lap('steer', 8000),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Wheel back on. A ring of teeth, a sensor, a computer, two valves and a pump, all working to do one odd thing: let go of the brake before the wheel can lock. It stops the car shorter on slippery roads and keeps it steerable on every road. It stops fastest by letting go.',
      hint: 'Drag to orbit while it brakes.',
      camera: { position: [2.4, 3.2, 8.0], target: [-1.3, 1.1, 0.2] },
      freeOrbit: true,
      onEnter: view({ wheel: true, corner: true, mod: true }, false),
      timeline: lap('abs4', 7000),
    },
  ],
});
