import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildLidar } from './model.js';

// Zoom-in / reveal story, straight off story.js: the sealed black can, the
// optics inside it, one round trip slowed down, the timing problem, the
// almost-nothing echo, the 64-beam fan, the spin that draws the cloud, then
// the whole thing sealed and running.
//
// SEAMLESS LOOPS. Three phases, each of which wraps by construction:
//   · `spin`  advances a WHOLE number of turns per lap.
//   · `pulse` is a 0–1 round-trip phase, taken mod 1 in the pose function —
//     the packet, the spot, the echo and the avalanche all key off it, and
//     the avalanche is shaped to be gone before the lap wraps.
//   · `fire`  sweeps the firing band down the fan and is re-entered from the
//     same end each lap; the cloud's per-point fade is keyed to `spin`, so
//     there is no 1 → 0 snap when the revolution wraps.
//
// Steps 2–6 pin `spin: 0` so the window faces the camera and the callouts sit
// still on their parts; the head does its real turning in steps 1, 7 and 8.

const TURN = Math.PI * 2;

// Pin EVERY scalar on entry. Anything left unpinned inherits the previous
// step's mid-lap phase and misframes a fixed camera.
const view = (state, labels) => ({ handles }) => {
  handles.set({
    spin: 0,
    reveal: 0,
    pulse: 0,
    fan: 0,
    cloud: 0,
    fire: -1,
    shot: 0,
    ruler: 0,
    post: 0,
    scene: 0,
    ...state,
  });
  handles.setLabels(labels);
};

// One lap = `turns` whole revolutions of the head.
const spinLoop = (turns, duration) => ({ tl, handles }) => {
  const s = { t: 0 }; // LOCAL state — never share a tween target across steps
  tl.add(s, {
    t: 1,
    duration,
    ease: 'linear',
    onUpdate: () => handles.set({ spin: s.t * turns * TURN }),
  });
};

// One lap = one round trip of the pulse.
const shotLoop = (duration) => ({ tl, handles }) => {
  const s = { t: 0 };
  tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.set({ pulse: s.t }) });
};

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildLidar({ scene });
  },

  stageOptions: { dof: true },

  steps: [
    {
      id: 'sealed',
      heading: 'The can on the roof',
      body:
        'Every self-driving prototype has worn one of these: a black cylinder the size of a coffee tin, turning steadily all day. There is no lens you can look into and no picture coming out of it. The only thing it ever measures is time — and from time alone it builds a three-dimensional map of everything around the car.',
      hint: 'Drag to orbit · scroll to open it up.',
      camera: { position: [3.75, 3.1, 4.35], target: [0.2, 1.42, 0] },
      dofAperture: 0.00003,
      focus: ['Rotating head'],
      onEnter: view({}, 'exterior'),
      timeline: spinLoop(1, 7200),
    },
    {
      id: 'inside',
      heading: 'No camera in here at all',
      body:
        'Open the housing and there is nothing resembling an image sensor. On one side sit two blocks of laser diodes, thirty-two in each, staring out through their own window. On the other side a single fat lens collects light and drops it onto a detector board. Underneath, a motor spins the whole optical assembly on a bearing while the base stays bolted still.',
      hint: 'Two emitter blocks, one receiver, one motor.',
      camera: { position: [2.7, 2.45, 3.3], target: [-0.05, 1.62, 0.2] },
      dofAperture: 0.00012,
      focus: ['32 laser diodes', 'Receive lens'],
      onEnter: view({ reveal: 1 }, 'internal'),
      // A gentle sway rather than a full turn: one whole sine cycle per lap,
      // so the wrap pose is identical while the window stays facing camera.
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 9000,
          ease: 'linear',
          onUpdate: () =>
            handles.set({ spin: Math.sin(s.t * TURN) * 0.22, pulse: s.t }),
        });
      },
    },
    {
      id: 'roundtrip',
      heading: 'Fire, and start a clock',
      body:
        'Here is the entire measurement, slowed down about a hundred million times. One diode fires a flash of infrared lasting five billionths of a second. The flash crosses to whatever is out there, scatters off it, and a sliver of it finds its way back into the receiving lens. Halve the round-trip time, multiply by the speed of light, and that is the distance. Nothing was recognised; nothing was photographed.',
      hint: 'The target stands 42 cm away here — a real one is 100 m out.',
      camera: { position: [-6.8, 3.1, 0.7], target: [-0.1, 1.7, 1.5] },
      dofAperture: 0.00004,
      focus: ['One 5 ns pulse out', 'Echo lands on the lens'],
      onEnter: view({ reveal: 1, shot: 1, post: 1 }, 'beam'),
      timeline: shotLoop(3400),
    },
    {
      id: 'clock',
      heading: 'Why this is a clock problem',
      body:
        'Light covers thirty centimetres every nanosecond. That white bar is drawn at true scale: it is exactly one nanosecond of flight. So the round trip from a car a hundred metres ahead lands back in 667 nanoseconds — and to call that distance to within two centimetres, marked here in green, the electronics have to resolve 130 trillionths of a second. The hard engineering is not the laser. It is the stopwatch.',
      hint: 'The green notch is ±2 cm — 130 picoseconds.',
      camera: { position: [-4.65, 2.45, 3.95], target: [0.2, 1.45, 1.75] },
      dofAperture: 0.00022,
      focus: ['1 ns of flight = 30 cm', '±2 cm = 130 ps of clock'],
      onEnter: view({ reveal: 1, shot: 1, post: 1, ruler: 1 }, 'ruler'),
      timeline: shotLoop(3600),
    },
    {
      id: 'echo',
      heading: 'What comes back is almost nothing',
      body:
        'The beam spreads as it travels — two milliradians, about a twenty-centimetre patch by the time it reaches a car ahead. It scatters off dull paint in every direction, so only a wisp of the original flash returns. What lands on the detector can be a handful of photons. An avalanche photodiode answers by letting one arriving photon trigger a cascade of electrons, turning a single particle of light into a spike you can actually time.',
      hint: 'One photon in, a measurable spike out.',
      camera: { position: [3.2, 2.0, 1.5], target: [0.52, 1.7, 0.34] },
      dofAperture: 0.0003,
      focus: ['Avalanche photodiode'],
      onEnter: view({ reveal: 1, shot: 1, post: 1 }, 'detect'),
      timeline: shotLoop(4200),
    },
    {
      id: 'fan',
      heading: 'One beam is only one line',
      body:
        'A single laser measures a single direction, which draws you a line, not a world. So sixty-four of them are bolted into those two blocks, each aimed at its own fixed vertical angle, fanning out a blade of beams 26.8 degrees tall. They fire in sequence, top to bottom, thousands of times a second — and every beam owns its own detector, so none of them can be confused for another.',
      hint: '64 lasers · 64 detectors · one shared window.',
      camera: { position: [-4.6, 2.6, 0.15], target: [-0.15, 1.4, 1.15] },
      dofAperture: 0.00003,
      focus: ['64 beams, a 26.8° fan'],
      onEnter: view({ reveal: 1, fan: 1, scene: 1 }, 'fan'),
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 2600,
          ease: 'linear',
          onUpdate: () => handles.set({ fire: s.t, pulse: s.t }),
        });
      },
    },
    {
      id: 'sweep',
      heading: 'Now spin it',
      body:
        'The motor turns the whole head fifteen times a second, and the fan sweeps the full circle with it. Each measurement arrives stamped with the angle the head was at and the angle its laser is fixed at, so a distance becomes a point in space. Watch the floor: the beams land in rings, and the blocks carve holes behind them where nothing came back. That is the picture — 1.3 million dots a second, drawn by rotation rather than by any lens.',
      hint: 'Every dot on the floor is one timed round trip.',
      camera: { position: [7.8, 6.6, 9.0], target: [0.3, 0.7, 0.1] },
      dofAperture: 0.00002,
      focus: ['One dot = one round trip'],
      onEnter: view({ reveal: 1, fan: 1, cloud: 1, scene: 1, fire: 0.5 }, 'cloud'),
      timeline: spinLoop(2, 6400),
    },
    {
      id: 'running',
      heading: 'A stopwatch on a turntable',
      body:
        'Sealed back up, it is a black can doing one thing very fast: timing flashes of light. That is also exactly why it fails where it does. Fog and heavy rain scatter the pulse before it arrives, matte black paint absorbs it, and a wet road bounces it away instead of back. No echo, no point — which is why nobody drives on lidar alone.',
      hint: 'Drag to orbit · it never saw the car, it timed it.',
      camera: { position: [6.9, 5.0, 8.2], target: [0.1, 1.0, 0] },
      dofAperture: 0.00002,
      freeOrbit: true,
      focus: ['900 rpm · 1.3 M points/s'],
      onEnter: view({ reveal: 0, cloud: 1, scene: 1 }, 'cloud'),
      timeline: spinLoop(3, 4800),
    },
  ],
});
