import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildAutomaticEmergencyBraking } from './model.js';

// Zoom-in / reveal story (story.js is the contract): the sealed car following
// another, the radar's rising note, the late echo whose pitch gap is the
// distance, the Doppler lift and time-to-collision, the camera recognising a
// pedestrian test dummy, the staged response, the ESC pump clamping the
// calipers, then everything together. Every step drives ONE lap function
// (setFollow: 10 s, setAeb: 14 s — both lengths are baked into model.js's
// physics) through a local tween object.

// Pin the full layer/label/overlay state on entering a step (pre-flight #4).
const view =
  ({ reveal, labels, overlay }) =>
  ({ handles }) => {
    handles.setReveal(reveal);
    handles.setOverlay(overlay);
    handles.setLabels(labels);
  };

function lap(duration, fn) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state, never shared across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles[fn](s.t % 1) });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildAutomaticEmergencyBraking({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'It always knows the gap',
      body: 'A car following another at city speed, the gap between them drifting in and out as traffic does. If the car ahead stops dead, this one will stop too, even if you never touch the pedal. To do that it has to know the gap at every moment, and nothing on the outside shows how it measures it.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [-0.8, 3.4, 9], target: [-5.2, 0.3, -12] },
      onEnter: view({ reveal: 0, labels: false, overlay: 'none' }),
      timeline: lap(10000, 'setFollow'),
    },
    {
      id: 'radar',
      heading: 'It hums a rising note',
      body: 'Behind the badge sits a radar at 77 GHz, far above anything you can hear, but it behaves like a voice humming. Each note starts low and slides steadily upward, then starts again, thousands of times a second. The chart beside the road plots that pitch against time: a sawtooth.',
      hint: 'The chart is a drawing; the real sweep is about 1 GHz wide.',
      camera: { position: [8.92, 3.5, 9.68], target: [-2.5, 0.44, -7.5] },
      focus: ['Sent (blue): a note rising in pitch'],
      onEnter: view({ reveal: 1, labels: 'radar', overlay: 'radar' }),
      timeline: lap(10000, 'setFollow'),
    },
    {
      id: 'echo',
      heading: 'The pitch gap is the distance',
      body: 'The echo off the car ahead is the same rising note, only late. So at every instant it is a little lower than what the radar is sending right now, and that gap in pitch stays steady through the whole sweep. The further away the car, the later the echo and the wider the gap. Watch it breathe as the car ahead drifts in and out. The radar never times the echo; it hears the gap.',
      hint: 'A car 30 m away echoes back just 200 nanoseconds late.',
      camera: { position: [7.5, 2.6, -1.5], target: [-0.5, 1.0, -13] },
      focus: ['Pitch gap = distance'],
      onEnter: view({ reveal: 1, labels: 'echo', overlay: 'echo' }),
      timeline: lap(10000, 'setFollow'),
    },
    {
      id: 'closing',
      heading: 'Distance over speed: seconds to impact',
      body: 'When the gap is shrinking, the echo comes back squeezed a touch higher in pitch, the Doppler shift you hear when a siren passes. That gives the closing speed directly. Divide the distance by the closing speed and you get the number the brakes actually care about: how many seconds until impact if nothing changes.',
      hint: 'Delay and Doppler drawn far larger than life.',
      camera: { position: [8, 3.4, 1.0], target: [-1, 1.2, -13] },
      focus: ['Time to collision'],
      onEnter: view({ reveal: 1, labels: 'doppler', overlay: 'doppler' }),
      timeline: lap(10000, 'setFollow'),
    },
    {
      id: 'detect',
      heading: 'A person barely shows up on radar',
      body: 'To radar, a person is a faint, flickering echo, about a hundred times weaker than a car. So the camera behind the mirror does the recognising: it has learned what people look like and boxes the dummy as it walks into the lane. The radar confirms where it is and how fast it moves, and together they predict whether its path will cross yours.',
      hint: 'The dummy is the kind used in real AEB tests, on its own low platform.',
      camera: { position: [-0.5, 4.5, 8], target: [-5, 0, -11.5] },
      focus: ['Camera: “pedestrian”', 'Weak radar echo'],
      onEnter: view({ reveal: 1, labels: 'detect', overlay: 'detect' }),
      timeline: lap(14000, 'setAeb'),
    },
    {
      id: 'stages',
      heading: 'It acts in stages, against the clock',
      body: 'As the seconds to impact run down, the car escalates. At about 2.6 seconds it warns you. At 2.0 it pre-fills the brakes so the pads already touch the discs. At 1.6 it starts braking gently, and if the clock still reaches 0.8, it brakes as hard as the tyres allow. Here it stops about two metres short.',
      hint: 'Thresholds vary by car; these are typical.',
      camera: { position: [-0.6, 4.0, 8.5], target: [-4.8, 0.6, -10] },
      focus: ['Time to collision'],
      onEnter: view({ reveal: 1, labels: 'stages', overlay: 'stages' }),
      timeline: lap(14000, 'setAeb'),
    },
    {
      id: 'esc',
      heading: 'Nobody presses the pedal',
      body: 'The brake pedal never moves. The stability-control unit under the bonnet has its own electric pump: it spins up, shuts and opens a bank of valves, and pushes brake fluid down the lines to all four calipers, which clamp the discs. It is the same hardware that stops a skid, borrowed for a few seconds.',
      camera: { position: [-2.8, 3.4, -5.13], target: [0.9, 0.3, -0.93] },
      focus: ['ESC unit: its own pump', 'Brake pedal: untouched'],
      onEnter: view({ reveal: 1, labels: 'esc', overlay: 'esc' }),
      timeline: lap(14000, 'setAeb'),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Back together. A radar that hears distance as pitch, a camera that knows a person when it sees one, and a pump that can stop the car without you. It never measured distance. It listened to time.',
      hint: 'Drag to orbit while it brakes.',
      camera: { position: [-2.0, 3.6, 10.5], target: [-5.6, 0.4, -9.5] },
      freeOrbit: true,
      onEnter: view({ reveal: 0, labels: false, overlay: 'run' }),
      timeline: lap(14000, 'setAeb'),
    },
  ],
});
