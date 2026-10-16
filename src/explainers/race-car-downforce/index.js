import { defineExplainer } from '../../framework/index.js';
import { profileTable, win, TAU } from '../../framework/motion.js';
import meta from './meta.js';
import { buildRaceCar } from './model.js';

// Every step runs as a seamless loop. `turns` is WHOLE wheel turns per lap; the
// belt, the wheels and every smoke stream are driven from that one number (each
// stream advances a whole number of particle slots per wheel turn), so any
// integer wraps cleanly. Steps whose speed varies use profileTable, which still
// lands on exactly `turns` turns at the end of the lap.
const NONE = { over: 0, front: 0, rear: 0, floor: 0 };

function run({
  turns = 8,
  duration = 8000,
  smoke = NONE,
  pressure = 0,
  ghost = 1,
  cutaway = 0,
  arrows = false,
  kmh = 250,
  skin = 0,
  plates = 1,
} = {}) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({ turns: s.t * turns, smoke: { ...NONE, ...smoke }, pressure, ghost, cutaway, skin, plates, drs: 0, arrows, kmh }),
    });
  };
}

// Speed step: 60 -> 300 -> 60 km/h once per lap. The downforce arrow follows
// v^2 and crosses the weight arrow at 200 km/h on the way up and down.
const speedAt = (u) => 60 + 240 * 0.5 * (1 - Math.cos(TAU * u));
const speedSpin = profileTable((u) => speedAt(u) / 300, 9);

// DRS step: flap shut for the first half of the lap, open for the second.
const drsAt = (u) => win(u, 0.42, 0.5) - win(u, 0.88, 0.96);

export default defineExplainer({
  ...meta,

  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildRaceCar({ scene });
  },

  steps: [
    {
      id: 'car',
      heading: 'Grip you can buy with air',
      body: 'A tyre grips in proportion to how hard it is pressed into the road. A heavier car would grip harder, but it would also have more mass to brake, turn and accelerate, so the extra grip buys nothing. A race car gets the push without the mass. It uses the air rushing over it to press itself into the track. This one sits on a wind-tunnel rolling road: the car stays still while the belt and the air go past it.',
      hint: 'Drag to orbit · scroll to switch the smoke on.',
      camera: { position: [6.04, 2.37, 7.52], target: [-0.87, 0.26, 1.37] },
      focus: ['Front wing', 'Rear wing', 'Floor'],
      onEnter: ({ handles }) => {
        handles.setLabels('exterior');
        handles.set({ turns: 0, smoke: NONE, pressure: 0, ghost: 1, cutaway: 0, skin: 0, plates: 1, drs: 0, arrows: false });
      },
      timeline: run({ turns: 6, duration: 9000 }),
    },
    {
      id: 'speed',
      heading: '1 · Twice the speed, four times the push',
      body: 'Downforce grows with the square of speed. Watch the smoke speed up and the blue arrow grow: at 100 km/h the car makes about a quarter of its own weight, and at around 200 km/h it makes all of it. A 2020s Formula 1 car weighs about 800 kg with its driver, so above that speed the air presses it down harder than gravity does. On paper it could drive along a ceiling.',
      hint: 'On paper. Nobody has tried it.',
      camera: { position: [-0.63, 2.15, 9.85], target: [-1.82, 1.26, 0.07] },
      focus: ['Downforce', 'Weight ≈ 800 kg'],
      onEnter: ({ handles }) => {
        handles.setLabels('speed');
        handles.set({ turns: 0, smoke: { ...NONE, over: 1 }, pressure: 0, ghost: 1, cutaway: 0, skin: 0, plates: 1, drs: 0, arrows: 'speed', kmh: 60 });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 10000,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              turns: speedSpin.at(s.t) / TAU,
              smoke: { ...NONE, over: 1 },
              pressure: 0,
              ghost: 1,
              cutaway: 0,
              skin: 0,
              plates: 1,
              drs: 0,
              arrows: 'speed',
              kmh: speedAt(s.t),
            }),
        });
      },
    },
    {
      id: 'front',
      heading: '2 · The front wing is an aircraft wing, upside down',
      body: 'Each element is shaped like a small aircraft wing mounted with its curved face toward the road. It turns the passing air upward, and turning air takes a push. Air piles up against the top face, so the pressure there rises (warm). Underneath, the air is squeezed between the wing and the road and speeds through, so the pressure drops (blue). More pressure on top than underneath adds up to a net push down on the nose.',
      hint: 'The road helps. Run this close to the ground, the same wing makes more downforce than it would in open air.',
      camera: { position: [2.41, 0.19, 2.75], target: [2.15, 0.2, 0.54] },
      dofAperture: 0.00018,
      focus: ['High pressure', 'Low pressure'],
      onEnter: ({ handles }) => {
        handles.setLabels('front');
        handles.set({ turns: 0, smoke: { ...NONE, front: 1 }, pressure: 1, ghost: 1, cutaway: 0, skin: 0, plates: 0.12, drs: 0, arrows: false });
      },
      timeline: run({ turns: 6, duration: 8000, smoke: { front: 1 }, pressure: 1, plates: 0.12 }),
    },
    {
      id: 'rear',
      heading: '3 · The rear wing, and its off switch',
      body: 'The rear wing does the same job with two elements stacked steeply. A single surface this steep would stall, with the air peeling off its back. The slot between the two elements feeds fast air from underneath across the back of the flap and keeps the flow stuck to it. Downforce always costs drag, so on a straight the flap swings almost flat. The air stops being thrown upward, and downforce and drag both fall away.',
      hint: 'F1 called this DRS. Since 2026, both wings flatten on designated straights.',
      camera: { position: [-3.04, 1.39, 2.63], target: [-2.94, 0.9, -0.01] },
      focus: ['Flap', 'Slot'],
      onEnter: ({ handles }) => {
        handles.setLabels('rear');
        handles.set({ turns: 0, smoke: { ...NONE, rear: 1 }, pressure: 1, ghost: 1, cutaway: 0, skin: 0, plates: 0.12, drs: 0, arrows: 'rear' });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 10000,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              turns: s.t * 8,
              smoke: { ...NONE, rear: 1 },
              pressure: 1,
              ghost: 1,
              cutaway: 0,
              skin: 0,
              plates: 0.12,
              drs: drsAt(s.t),
              arrows: 'rear',
              kmh: 250,
            }),
        });
      },
    },
    {
      id: 'floor',
      heading: '4 · The floor is the biggest wing on the car',
      body: 'Underneath, two tunnels run along the floor, and the road forms the bottom wall of each one. Air enters behind the front wheels and is squeezed through a narrow throat just above the track. It speeds up as it goes, and fast-moving air is at low pressure (blue). The atmosphere still presses on the whole top of the car at full strength, so the car is pushed down onto the road.',
      hint: 'Cutaway: the nearside wheels and tunnel wall are faded out.',
      camera: { position: [1.24, 1.29, 5.67], target: [-1.58, 0.1, 0.62] },
      focus: ['Throat', 'Venturi tunnel'],
      onEnter: ({ handles }) => {
        handles.setLabels('floor');
        handles.set({ turns: 0, smoke: { ...NONE, floor: 1 }, pressure: 0, ghost: 0.14, cutaway: 1, skin: 0, plates: 1, drs: 0, arrows: false });
      },
      timeline: run({ turns: 7, duration: 8000, smoke: { floor: 1 }, ghost: 0.14, cutaway: 1 }),
    },
    {
      id: 'diffuser',
      heading: '5 · The diffuser pulls air through the tunnels',
      body: 'At the back, the tunnels sweep upward and widen into the diffuser. The air spreads out, slows down and is back at normal pressure by the time it leaves. Because the exit has to sit at normal pressure, that gentle expansion lets the throat run far below it, and more air is pulled through the tunnels than a flat floor could pass. Flare it too steeply and the flow tears away from the surface and the suction collapses.',
      hint: 'It is also why ride height matters so much: a few millimetres closer to the road changes the whole floor.',
      camera: { position: [-5.6, 0.45, 0.64], target: [-2.62, 0.2, -0.85] },
      dofAperture: 0.00012,
      focus: ['Diffuser', 'Back to normal pressure'],
      onEnter: ({ handles }) => {
        handles.setLabels('diffuser');
        handles.set({ turns: 0, smoke: { ...NONE, floor: 1 }, pressure: 0, ghost: 1, cutaway: 0, skin: 1, plates: 1, drs: 0, arrows: false });
      },
      timeline: run({ turns: 7, duration: 8000, smoke: { floor: 1 }, skin: 1 }),
    },
    {
      id: 'run',
      heading: 'It grips harder the faster it goes',
      body: 'Put together, the front wing, the floor and the rear wing all press the car down, and on the 2022–25 cars more than half of it came from the floor. Downforce weighs nothing. It costs drag instead, and it grows with the square of speed, so a car that takes a corner twice as fast is pressed into the track four times as hard. It grips harder the faster it goes.',
      hint: 'Drag to orbit. The exact split varies by car and by track.',
      camera: { position: [4.99, 4.28, 9.15], target: [-1.82, 0.53, 1.37] },
      freeOrbit: true,
      focus: ['Floor ≈ 55%'],
      onEnter: ({ handles }) => {
        handles.setLabels('split');
        handles.set({ turns: 0, smoke: { over: 1, front: 1, rear: 1, floor: 1 }, pressure: 1, ghost: 1, cutaway: 0, skin: 0, plates: 1, drs: 0, arrows: 'split' });
      },
      timeline: run({ turns: 10, duration: 7000, smoke: { over: 1, front: 1, rear: 1, floor: 1 }, pressure: 1, arrows: 'split' }),
    },
  ],
});
