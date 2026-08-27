import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildQuartzWatch } from './model.js';

// Every step loops while active, driven by ONE scalar: `tick`, the watch's own
// second. A lap is 60 ticks — one watch-minute — and every number closes on a
// whole: seconds hand 1 rev, rotor 30 revs, fifth wheel 5 revs, seconds wheel
// 1 rev, fork 60 flexes, coil polarity back to its starting sign. Steps differ
// only in loop SPEED, CAMERA, and which layers are shown.
const TICKS = 60;

// Every step pins EVERY state field. Anything left unset inherits the previous
// step's mid-lap phase and misframes the fixed camera.
const pin = (handles, s) =>
  handles.set({
    flip: 0,
    reveal: 0,
    dress: 1,
    insert: 0,
    fieldViz: 0,
    ...s,
  });

function run(duration) {
  return ({ tl, handles }) => {
    const s = { tick: 0 };
    tl.add(s, {
      tick: TICKS,
      duration,
      ease: 'linear',
      onUpdate: () => handles.setTick(s.tick),
    });
  };
}

export default defineExplainer({
  ...meta,

  // DOF: the wide steps (1, 2, 7) stay sharp; 3-6 are true macro, filmed at
  // camera-to-target distances of ~0.9-1.9, and get a real aperture.
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildQuartzWatch({ scene });
  },

  steps: [
    {
      id: 'tick',
      heading: '1 · One jump a second',
      body: "Look at the seconds hand. It doesn't sweep — it jumps, holds, jumps again, once a second, and it has done that every second since the battery went in. A mechanical watch hides a swinging balance wheel behind that motion. This one hides a sliver of sand.",
      hint: 'Drag to orbit · scroll to open it up.',
      camera: { position: [0.92, 1.52, 2.62], target: [-0.3, 1.03, 0.12] },
      dofAperture: 0.00003,
      focus: ['Seconds hand'],
      onEnter: ({ handles }) => {
        pin(handles, {});
        handles.setLabels('dial');
      },
      timeline: run(18000),
    },
    {
      id: 'movement',
      heading: '2 · Everything that keeps the time',
      body: 'Undo the back and the whole works lifts out on a single plate of ivory plastic. There is almost nothing on it: a battery the size of a lentil, a black speck of a chip, a coil of copper finer than hair, and a silver capsule two millimetres across. Only one of those knows what a second is, and it is the capsule.',
      hint: 'Case back lifted off · watch the current run battery to chip to coil.',
      camera: { position: [0.88, 2.55, 2.4], target: [-0.42, 2.2, 0.26] },
      dofAperture: 0.00008,
      focus: ['Quartz crystal', 'Battery'],
      onEnter: ({ handles }) => {
        pin(handles, { flip: 1, reveal: 1, dress: 0, fieldViz: 0.6 });
        handles.setLabels('movement');
      },
      timeline: run(15000),
    },
    {
      id: 'crystal',
      heading: '3 · A tuning fork cut from sand',
      body: 'Inside the capsule, sealed in vacuum, is a tuning fork about as long as a grain of rice, cut from a single crystal of quartz. Quartz is piezoelectric both ways: squeeze it and it makes a voltage, feed it a voltage and it bends. So the chip taps it, the fork rings, the ringing makes its own voltage, and the chip taps again in time — locking onto the one frequency the fork was ground to. 32,768 vibrations a second, every second, held to a few parts in a million.',
      hint: 'Shown about five times life size, and slowed roughly thirty thousand times.',
      camera: { position: [0.95, 2.9, 2.15], target: [0.31, 2.58, 0.42] },
      dofAperture: 0.00022,
      focus: ['Quartz tuning fork'],
      onEnter: ({ handles }) => {
        pin(handles, { flip: 1, reveal: 1, dress: 0, insert: 1 });
        handles.setLabels('crystal');
      },
      timeline: run(12000),
    },
    {
      id: 'divider',
      heading: '4 · Counting down to one',
      body: "32,768 isn't a random number: it is two multiplied by itself fifteen times. Inside the chip sit fifteen switches in a row, each one flipping only when the switch above it has flipped twice — so every rung of this ladder runs at exactly half the speed of the rung above it. The top is a blur. Fifteen halvings down, the bottom rung flashes once, and that flash is the second.",
      hint: 'Eight of the fifteen rungs shown — the top ones really do run too fast to see.',
      camera: { position: [1.0, 2.5, 1.68], target: [0.54, 2.28, 0.34] },
      dofAperture: 0.00018,
      focus: ['One a second out'],
      onEnter: ({ handles }) => {
        pin(handles, { flip: 1, reveal: 1, dress: 0, insert: 2 });
        handles.setLabels('divider');
      },
      timeline: run(10000),
    },
    {
      id: 'motor',
      heading: '5 · The kick',
      body: 'The flash goes to the coil, and for a few thousandths of a second the coil becomes a magnet. Facing it, in a slot in the steel yoke, sits a permanent magnet a millimetre and a half across — and that slot is bitten off-centre, which is the only thing deciding which way the magnet swings. It flips half a turn and stops. The next pulse arrives with the current running backwards and flips it another half turn, the same way round; then the coil goes quiet for the rest of the second, which is why the battery lasts years.',
      camera: { position: [0.28, 2.32, 1.12], target: [-0.2, 2.14, 0.33] },
      dofAperture: 0.0003,
      focus: ['Rotor magnet', 'Coil'],
      onEnter: ({ handles }) => {
        pin(handles, { flip: 1, reveal: 1, dress: 0, fieldViz: 1 });
        handles.setLabels('motor');
      },
      timeline: run(21000),
    },
    {
      id: 'train',
      heading: '6 · Half turns into hands',
      body: "Half a turn a second is far too fast for a seconds hand, so it goes through gears — but this train slows things down, where a mechanical watch's gears speed the mainspring up. Ten teeth drive sixty, then twelve drive sixty: thirty to one. Half a turn at the rotor comes out as six degrees at the centre of the dial, which is exactly one second on the face.",
      camera: { position: [0.3, 2.64, 1.98], target: [-0.26, 2.24, 0.22] },
      dofAperture: 0.00022,
      focus: ['Rotor pinion, 10 teeth', 'Seconds wheel'],
      onEnter: ({ handles }) => {
        pin(handles, { flip: 0, reveal: 1, dress: 0 });
        handles.setLabels('train');
      },
      timeline: run(15000),
    },
    {
      id: 'accuracy',
      heading: '7 · Fifteen seconds a month',
      body: 'Put it back together and nothing on the outside admits any of that. An ordinary quartz watch keeps time to about fifteen seconds a month; a fine mechanical one can lose that much in a day. One crystal, one chip, one coil — and it will do this about thirty million times a year until the battery gives up.',
      hint: 'Drag to orbit.',
      camera: { position: [2.35, 1.55, 3.05], target: [-0.4, 1.02, 0.3] },
      dofAperture: 0.00003,
      freeOrbit: true,
      onEnter: ({ handles }) => {
        pin(handles, {});
        handles.setLabels(false);
      },
      timeline: run(9000),
    },
  ],
});
