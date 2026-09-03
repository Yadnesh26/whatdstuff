import { defineExplainer } from '../../framework/index.js';
import { profileTable, TAU } from '../../framework/motion.js';
import meta from './meta.js';
import { buildWindTurbine } from './model.js';

// Every step runs the turbine as a seamless loop. `turns` is the number of
// WHOLE rotor revolutions per lap — the entire drivetrain derives from that one
// angle (sun 3.5x, high-speed shaft 7x), so a whole rotor turn wraps every
// geared part with it. `flow` sweeps 0-1 once, which the wind streamlines and
// the power dots ride via getPointAt, wrapping by construction.
//
// Rotor speed reads true: 2 turns in ~11 s is a lap every 5.5 s, which is the
// ~12 rpm a real utility rotor actually turns at.
function run({
  turns = 2,
  duration = 9000,
  reveal = 0,
  betz = 0,
  sectionViz = 0,
  powerOn = 0,
  windViz = 0,
  shellViz = 1,
} = {}) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({
          rotor: s.t * TAU * turns,
          flow: s.t,
          reveal,
          betz,
          sectionViz,
          powerOn,
          windViz,
          shellViz,
          yaw: 0,
          windDir: 0,
          pitch: 0,
        }),
    });
  };
}

// The control step: the wind swings, the nacelle chases it a beat late, and
// once per lap the blades feather and the rotor visibly falls off its speed.
// Both are periodic in the lap fraction, so the wrap pose is identical; the
// rotor still advances exactly ONE whole turn thanks to profileTable, which
// integrates the slowed-down rate and rescales it.
const feather = (u) => (0.5 * (1 - Math.cos(TAU * u))) ** 2.5;
const spinProfile = profileTable((u) => 1 - 0.74 * feather(u), 1);

function controlRun(duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({
          rotor: spinProfile.at(s.t),
          flow: s.t,
          reveal: 0,
          betz: 0,
          sectionViz: 0,
          powerOn: 0,
          windViz: 0,
          shellViz: 1,
          windDir: 0.34 * Math.sin(TAU * s.t),
          yaw: 0.34 * Math.sin(TAU * s.t - 0.55), // the controller chases, it never leads
          pitch: 1.4 * feather(s.t),
        }),
    });
  };
}

export default defineExplainer({
  ...meta,

  // DOF [rung 4]: only the two drivetrain macro steps get an aperture, and a
  // conservative one — both look at reflective metal from close range.
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildWindTurbine({ scene });
  },

  steps: [
    {
      id: 'anatomy',
      heading: 'The anatomy',
      body: 'Three blades, a box behind them called the nacelle, and a tower. That is the entire machine. Each blade is around 70 metres of moulded fibreglass, the nacelle is about the size of a city bus, and the rotor turns roughly twelve times a minute — one unhurried revolution every five seconds. That laziness is the first thing this machine lies to you about.',
      hint: 'Drag to orbit · scroll to go inside.',
      camera: { position: [6.6, 2.9, 5.15], target: [-0.55, 2.35, 0.71] },
      focus: ['Blade', 'Nacelle'],
      onEnter: ({ handles }) => handles.setLabels('anatomy'),
      timeline: run({ turns: 2, duration: 11000 }),
    },
    {
      id: 'blade',
      heading: '1 · The blades are wings',
      body: "A sail gets pushed. A wing gets pulled, and a turbine blade is a wing. Take one slice of it, seven-tenths of the way out: it feels the real wind coming at 12 m/s, but it is also travelling sideways through still air far faster than that. Add those two together and you get the apparent wind — arriving from almost dead ahead — and the blade section flies through it exactly like a glider, generating lift at right angles to it. Most of that lift is thrust, shoving the whole tower backwards. Only a thin slice of it points the way the blade is going, and that slice is the entire reason the rotor turns.",
      hint: 'Lift-to-drag ratio of a modern blade: about 120. A sailplane manages 70.',
      camera: { position: [3.31, 2.61, 1.24], target: [1.44, 2.25, 1.13] },
      dofAperture: 0.00045,
      focus: ['Lift', 'Apparent wind'],
      onEnter: ({ handles }) => handles.setLabels('blade'),
      timeline: run({ turns: 2, duration: 10000, sectionViz: 1 }),
    },
    {
      id: 'rotor',
      heading: '2 · Why it is twisted, and why there are three',
      body: "The further out you go, the faster the blade is moving and the flatter the apparent wind arrives — so the blade has to be wound like a corkscrew to keep every section at its best angle: about 20° of pitch at the root, barely 2° at the tip. Out at that tip it is doing seven times the wind speed — close to 300 km/h. And the rotor can never take all the wind's energy: to do that the air would have to stop dead inside the disc, and stopped air would block the air behind it. Betz worked out the ceiling in 1919 — 59.3%. Real rotors reach 45 to 50, and the air that leaves has slowed, so it has to spread out.",
      hint: 'Three blades, not two: the third adds only ~3% more energy, but it makes the loads far smoother.',
      camera: { position: [6.5, 3.5, 4.55], target: [-0.45, 2.8, 0.62] },
      focus: ['The disc can take 59.3% at most'],
      onEnter: ({ handles }) => handles.setLabels('rotor'),
      timeline: run({ turns: 2, duration: 10000, betz: 1, windViz: 1 }),
    },
    {
      id: 'nacelle',
      heading: '3 · Inside the nacelle',
      body: "Open the box and it is a short, dense power station. The main shaft comes in on a bearing the size of a dinner table, hands its torque to a gearbox, and the gearbox hands a much faster shaft — through a parking brake — to a generator. Behind that sits the converter that cleans up the electricity before it leaves. The whole assembly weighs upward of 70 tonnes and sits 100 metres in the air.",
      hint: 'The cutaway from here on is the same nacelle, enlarged.',
      camera: { position: [4.65, 2.3, 1.95], target: [2.83, 1.5, 0.22] },
      focus: ['Gearbox', 'Generator'],
      onEnter: ({ handles }) => handles.setLabels('nacelle'),
      timeline: run({ turns: 2, duration: 9000, reveal: 1 }),
    },
    {
      id: 'gearbox',
      heading: '4 · The gearbox',
      body: "Twelve revolutions a minute is useless to a generator, which wants around 1,500. So the first stage is a planetary set: the main shaft turns a carrier that walks three planet gears around inside a ring gear bolted solid to the housing, and because the ring cannot move, the little sun gear in the middle is forced to spin much faster than the carrier ever does. Two more gear stages follow it. End to end the box multiplies the speed roughly a hundredfold — and divides the torque by the same amount.",
      hint: 'Shown here at 7:1 across two stages — a real box does the full ~100:1 across three.',
      camera: { position: [3.93, 1.99, 1.19], target: [2.9, 1.49, 0.36] },
      dofAperture: 0.00012,
      focus: ['Ring gear — bolted still', 'Sun gear — the output'],
      onEnter: ({ handles }) => handles.setLabels('gearbox'),
      timeline: run({ turns: 2, duration: 8000, reveal: 1, shellViz: 0 }),
    },
    {
      id: 'generator',
      heading: '5 · The generator',
      body: "The high-speed shaft carries a rotor of magnetic poles spinning inside a fixed ring of stator windings. Every time a pole sweeps past a winding the field through it changes, and a changing field pushes a current along the wire — Faraday's law, the same induction a hydro plant and a transformer run on, just driven by a shaft instead. Out comes alternating current at about 690 volts, which the converter behind it holds to the grid's exact frequency no matter how the wind gusts.",
      camera: { position: [4.13, 1.87, -0.24], target: [3.05, 1.66, -0.44] },
      dofAperture: 0.00014,
      focus: ['Stator windings — 690 V'],
      onEnter: ({ handles }) => handles.setLabels('generator'),
      timeline: run({ turns: 2, duration: 8000, reveal: 1, shellViz: 0, powerOn: 1 }),
    },
    {
      id: 'control',
      heading: '6 · It aims itself, and it can stop itself',
      body: "On the roof sit an anemometer and a wind vane. When the wind swings, motors drive pinions around a toothed ring on the tower top and walk the whole nacelle around to face it again — always a beat behind, because chasing every gust would cost more than it earns. And when the wind gets dangerous, above about 25 m/s, the pitch bearings twist each blade edge-on to the flow. Feathered like that a blade makes almost no lift at all, and the rotor simply gives up and coasts down. That is the brake that matters; the disc inside is only for parking.",
      hint: 'Point 30° off the wind and you lose more than half your power — it falls off as the cube of the cosine.',
      camera: { position: [1.08, 3.16, 0.96], target: [-0.17, 2.86, 0.3] },
      dofAperture: 0.00006,
      focus: ['Anemometer & wind vane', 'Pitch bearing feathers the blade'],
      onEnter: ({ handles }) => handles.setLabels('control'),
      timeline: controlRun(13000),
    },
    {
      id: 'grid',
      heading: '7 · Down the tower',
      body: 'The current leaves the generator and drops the full height of the tower on a cable, into a step-up transformer at the base. Turbine voltage is far too low to travel: raise it, and the same power moves as a much smaller current, which is what stops the cable to the next turbine from cooking itself. From there every machine in the farm feeds one buried spine out to a substation and onto the grid.',
      camera: { position: [2.25, 1.55, 2.35], target: [-0.3, 0.82, 0.18] },
      focus: ['Step-up transformer'],
      onEnter: ({ handles }) => handles.setLabels('grid'),
      timeline: run({ turns: 2, duration: 9000, powerOn: 1 }),
    },
    {
      id: 'run',
      heading: 'The machine runs',
      body: 'A wing pulled around a circle, geared up a hundredfold, spun through a coil, and dropped down a tower. Nothing is burned and nothing is consumed — a pressure difference across a curved surface becomes torque, torque becomes current, and the only thing the machine takes from the sky is a little of its speed.',
      hint: 'Drag to orbit the running turbine.',
      camera: { position: [7.0, 2.65, 5.45], target: [-0.55, 2.1, 0.75] },
      freeOrbit: true,
      onEnter: ({ handles }) => handles.setLabels(null),
      timeline: run({ turns: 3, duration: 12000, powerOn: 1, windViz: 0.5 }),
    },
  ],
});
