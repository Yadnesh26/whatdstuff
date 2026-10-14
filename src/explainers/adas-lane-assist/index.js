import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildAdasLaneAssist } from './model.js';

// Zoom-in / reveal story (story.js is the contract): the sealed car holding
// its lane, the four ADAS parts under the ghosted body, the camera's stripe
// detection, the two numbers and the warning, the EPS nudge, the torque cap
// and override, the radar + adaptive cruise, then everything together.
// Every step drives ONE lap function from model.js through a local tween
// object; road scroll, wheel spin and every offset are whole cycles per lap.

// Pin the full layer/label/overlay state on entering a step (pre-flight #4).
const view =
  ({ reveal, labels, overlay, lead = false, carFrame = false }) =>
  ({ handles }) => {
    handles.setCarFrame(carFrame);
    handles.setReveal(reveal);
    handles.setLead(lead);
    handles.setOverlay(overlay);
    handles.setLabels(labels);
  };

function lap(duration, fn, ...args) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state, never shared across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles[fn](s.t % 1, ...args) });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildAdasLaneAssist({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'A car that keeps its own lane',
      body: 'A car holding the middle of its lane at a steady cruise. Nothing on the outside gives the system away. Two clues hide in plain sight: a small black box behind the rear-view mirror, and the badge on the grille.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [8.6, 2.07, -5.45], target: [1.13, 0.58, 1.8] },
      focus: ['Windshield camera', 'Front radar, behind the badge'],
      onEnter: view({ reveal: 0, labels: 'exterior', overlay: 'none' }),
      timeline: lap(8000, 'setCruise'),
    },
    {
      id: 'hardware',
      heading: 'Four parts, and one was already there',
      body: 'Ghost the body and lane assist comes down to four parts. A camera behind the mirror watches the road. A radar behind the badge watches the traffic ahead. A controller under the dash reads both. Its only way to steer is the electric power-steering motor on the column, the same motor that makes the wheel light when you park.',
      hint: 'The dots running along the wires are data, not to scale.',
      camera: { position: [6.28, 4.61, -4.55], target: [1.39, 0.62, 0.87] },
      focus: ['Camera + image chip', 'EPS motor'],
      onEnter: view({ reveal: 1, labels: 'hardware', overlay: 'hardware' }),
      timeline: lap(8000, 'setCruise'),
    },
    {
      id: 'camera',
      heading: 'It looks for stripes, not roads',
      body: 'The camera has no idea what a road is. It scans its picture row by row, near to far, for the places where dark asphalt turns into bright paint, and marks each edge it finds. Where a dash ends there is nothing to mark. Then it fits one smooth line through the points on each side of your lane, bridging the gaps.',
      hint: 'On this straight road the fitted lines are straight. On a bend they curve.',
      camera: { position: [-0.5, 4.5, 8], target: [-5.0, 0, -11.5] },
      focus: ['Edge points: paint vs asphalt', 'Fitted lane line'],
      onEnter: view({ reveal: 1, labels: 'camera', overlay: 'detect' }),
      timeline: lap(9000, 'setDetect'),
    },
    {
      id: 'drift',
      heading: 'Two numbers decide everything',
      body: 'From those two fitted lines the car works out two numbers: how far you sit from the middle of the lane, and which way you are pointing. Extend your heading forward and it meets a line at the amber ring. When that crossing comes up too soon and your indicator is off, the lamp lights and the wheel buzzes. On a warning-only system, you do the steering back.',
      hint: 'Drift and heading drawn three times larger so you can see them.',
      camera: { position: [-0.2, 9.0, 14.0], target: [-4.6, 0, -3.0] },
      focus: ['Predicted line crossing', 'Offset from lane centre'],
      onEnter: view({ reveal: 1, labels: 'drift', overlay: 'drift' }),
      timeline: lap(8000, 'setDrift', 'warn'),
    },
    {
      id: 'nudge',
      heading: 'A little extra torque on the column',
      body: 'Lane keep assist goes one step further. Instead of only warning you, the controller asks the power-steering motor for a little extra torque on top of its normal help. The motor spins a worm that turns a gear on the column, the steering wheel rotates a few degrees by itself, and the front wheels steer the car back toward the middle.',
      hint: 'Steering angles drawn larger than life.',
      camera: { position: [1.36, 1.83, -1.85], target: [-0.18, 0.6, -0.59] },
      focus: ['EPS motor', 'Extra torque, capped ≈3 Nm'],
      onEnter: view({ reveal: 2, labels: 'eps', overlay: 'assist', carFrame: true }),
      timeline: lap(12000, 'setDrift', 'assist'),
    },
    {
      id: 'override',
      heading: 'Weaker than you, on purpose',
      body: 'That nudge is capped at about 3 Nm. On a 38 cm wheel it is roughly 1.6 kg of push at the rim, so one hand beats it. A torque sensor in the column measures how hard your hands are twisting. Push the other way harder than the motor and the assist gives way. Take your hands off for too long and it warns you, then switches itself off.',
      hint: 'Cyan: the motor. White: your hands. Sensor twist drawn large.',
      camera: { position: [0.44, 1.39, 0.36], target: [-0.54, 0.88, -0.28] },
      focus: ['Torque sensor', 'Your hands · more'],
      onEnter: view({ reveal: 2, labels: 'torque', overlay: 'torque', carFrame: true }),
      timeline: lap(12000, 'setDrift', 'override'),
    },
    {
      id: 'radar',
      heading: 'The car ahead is the radar’s job',
      body: 'Behind the badge, a 77 GHz radar sends out a continuous chirp that rises in pitch. The echo comes back as a slightly older note: the difference in pitch gives the distance, and the Doppler shift gives the closing speed. Adaptive cruise uses them to hold a time gap rather than a fixed distance, so when the car ahead slows you ease off until the gap is back. The camera supplies what the radar cannot: that the echo is a car.',
      hint: 'Waves drawn as pulses; the real signal is continuous. Gap drawn shorter.',
      camera: { position: [-1.6, 3.8, 10.5], target: [-5.8, 0.3, -11] },
      focus: ['Time gap', 'Radar echo: range + speed'],
      onEnter: view({ reveal: 1, labels: 'radar', overlay: 'radar', lead: true }),
      timeline: lap(10000, 'setFollow'),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Back together. A camera that only sees stripes, a radar that only hears echoes, and a motor that only leans, all checking in dozens of times a second. You can always overrule it, because it is built to lose that argument. It never drives. It only leans.',
      hint: 'Drag to orbit while it drives.',
      camera: { position: [-7.75, 3.31, 9.35], target: [-0.62, 0, -6.91] },
      freeOrbit: true,
      onEnter: view({ reveal: 0, labels: false, overlay: 'run', lead: true }),
      timeline: lap(10000, 'setRun'),
    },
  ],
});
