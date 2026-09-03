import { defineExplainer } from '../../framework/index.js';
import { profileTable, TAU } from '../../framework/motion.js';
import meta from './meta.js';
import { buildTurbocharger } from './model.js';

// Every step runs the turbo as a seamless loop. `turns` is the number of WHOLE
// shaft revolutions per lap, and everything else derives from that one angle:
// the floating rings turn at exactly 1/3 of it (real ones measure 0.31-0.43x),
// and since their only asymmetry is three oil holes, any whole shaft turn
// wraps them too. `flow` sweeps 0-1 once, which every streamline rides via
// getPointAt - so the arrows wrap by construction.
//
// Speed reads honestly: 15 turns in 8 s is ~110 rev/s on screen. A real one at
// full boost does 3,300. Nothing in this scene could show that and stay
// legible, and the copy says the real number out loud instead.
function run({
  turns = 6,
  duration = 9000,
  reveal = 0,
  hot = 0,
  exhaust = 0,
  intake = 0,
  oil = 0,
  cool = 0,
  gate = 0,
  ghost = 1,
} = {}) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({
          spin: s.t * TAU * turns,
          flow: s.t,
          reveal,
          hot,
          exhaust,
          intake,
          oil,
          cool,
          gate,
          ghost,
        }),
    });
  };
}

// The wastegate step: the flapper swings fully open and shut once per lap, and
// the shaft visibly gives up speed while it is open - which is the whole point
// of the part. Both are periodic in the lap fraction, so the wrap pose is
// identical, and profileTable integrates the varying rate and rescales it so
// the shaft still lands on EXACTLY 8 whole turns.
const gateLift = (u) => 0.5 * (1 - Math.cos(TAU * u));
const gateSpin = profileTable((u) => 1 - 0.42 * gateLift(u), 8);

function gateRun(duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({
          spin: gateSpin.at(s.t),
          flow: s.t,
          reveal: 1,
          hot: 0.55,
          exhaust: 1,
          intake: 0,
          oil: 0,
          cool: 0,
          gate: gateLift(s.t),
          ghost: 1,
        }),
    });
  };
}

export default defineExplainer({
  ...meta,

  // DOF: only the three macro steps get an aperture. Everything else is a
  // reflective metal wide, where a shallow plane just reads as a soft render.
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildTurbocharger({ scene });
  },

  steps: [
    {
      id: 'anatomy',
      heading: 'The anatomy',
      body: 'Two fans and a stick. That is honestly the whole machine: a fan sitting in the exhaust pipe, a fan sitting in the intake pipe, and one shaft joining them through a lump of iron in the middle. The exhaust fan is cast Inconel because it works at 820 °C. The intake fan is forged aluminium because it works at room temperature. They are about a hundred millimetres apart on the same shaft.',
      hint: 'Drag to orbit · scroll to go inside.',
      camera: { position: [-3.75, 2.22, 3.55], target: [-1.58, 1.12, -0.23] },
      focus: ['Compressor housing', 'Turbine housing'],
      onEnter: ({ handles }) => handles.setLabels('anatomy'),
      timeline: run({ turns: 6, duration: 10000 }),
    },
    {
      id: 'hot',
      heading: '1 · The hot side takes what was already wasted',
      body: 'Your engine throws roughly a third of the fuel it burns straight out of the exhaust as hot, fast-moving gas. A turbo puts a windmill in front of it. The gas arrives at the flange, runs into a spiral passage that gets deliberately narrower all the way round — squeezing the gas makes it faster — and is then fed inward onto the rim of the turbine wheel. It hits the blades, turns the corner, and leaves down the middle having given up most of its speed.',
      hint: 'Not quite free - the turbine does push back on the exhaust - but far cheaper than driving a blower off the crankshaft.',
      camera: { position: [3.38, 2.18, 2.22], target: [-0.31, 0.89, 0.24] },
      focus: ['Exhaust in - 820 C', 'Turbine wheel'],
      onEnter: ({ handles }) => handles.setLabels('hot'),
      timeline: run({ turns: 9, duration: 8000, reveal: 1, hot: 0.55, exhaust: 1 }),
    },
    {
      id: 'shaft',
      heading: '2 · One shaft, and nothing else',
      body: 'There is no gearbox, no clutch, no belt. Whatever the turbine wheel does, the compressor wheel does, on a shaft about ten millimetres thick. At full boost that shaft passes 200,000 rpm — over three thousand revolutions every second, fast enough that the rim of the compressor wheel is travelling well beyond the speed of sound. Balance it a fraction of a gram out and it tears itself apart.',
      hint: 'Idle is already 10,000 rpm. This thing is never really stopped.',
      camera: { position: [-0.54, 1.75, 2.96], target: [-0.84, 1.2, 0.16] },
      focus: ['Shaft - 10 mm', '200,000 rpm'],
      onEnter: ({ handles }) => handles.setLabels('shaft'),
      timeline: run({ turns: 9, duration: 8000, reveal: 1, hot: 0.3, ghost: 0.45 }),
    },
    {
      id: 'cold',
      heading: '3 · The cold side throws air outward',
      body: 'This wheel does not blow air along like a desk fan. Air is drawn in down the middle, gets caught between the blades, and is flung outward by sheer rotation — it leaves the rim very fast, and most of what it has picked up so far is speed rather than pressure. The pressure is made after that. The gap around the wheel and the scroll beyond it both widen, and widening a passage slows moving air down; that lost speed reappears as pressure. Half the blades are short ones, splitters, dropped in later where there is finally room for them.',
      hint: 'Squeezing air also heats it — to about 120 °C. That is what the intercooler is for.',
      camera: { position: [-2.55, 1.52, 1.32], target: [-1.24, 1.19, -0.2] },
      dofAperture: 0.00022,
      focus: ['Exducer - flung out', 'Diffuser and scroll'],
      onEnter: ({ handles }) => handles.setLabels('cold'),
      timeline: run({ turns: 9, duration: 8000, reveal: 1, intake: 1, ghost: 0.5 }),
    },
    {
      id: 'oil',
      heading: '4 · It rides on oil, and touches nothing',
      body: 'Nothing solid holds this shaft up. Engine oil is pumped in at the top and squeezed into two gaps around each bearing — one between the shaft and a loose bronze ring, one between that ring and the housing. The shaft rides the inner film, the ring rides the outer one, and the ring gets dragged round at about a third of shaft speed, sitting between the two. At full song the metal is separated by six thousandths of a millimetre of oil and never makes contact at all.',
      hint: 'The films are drawn about forty times over-scale here. At true scale you could not see them.',
      camera: { position: [-1.82, 1.74, 1.65], target: [-0.83, 1.19, -0.35] },
      dofAperture: 0.00028,
      focus: ['Floating ring', 'Oil film'],
      onEnter: ({ handles }) => handles.setLabels('oil'),
      timeline: run({ turns: 6, duration: 9000, reveal: 1, oil: 1, ghost: 0.42 }),
    },
    {
      id: 'heat',
      heading: '5 · 950 °C and aluminium, on the same shaft',
      body: 'This is the hard part of the design. One end glows; the other end would melt if it got anywhere near that. So a dished steel shield stands between the turbine wheel and the bearings, a water jacket is cast into the housing behind it, and the same oil that floats the shaft is carrying heat away the whole time. Which is why switching off a hot turbo is bad for it: the oil pump stops, the turbine end keeps radiating, and the oil left sitting in those galleries bakes into a hard black varnish that blocks them.',
      hint: 'That is what "let it idle for a minute" was always about.',
      camera: { position: [1.74, 1.85, 3.27], target: [-0.34, 1.13, 0.66] },
      focus: ['Heat shield', 'Water jacket'],
      onEnter: ({ handles }) => handles.setLabels('heat'),
      timeline: run({ turns: 6, duration: 9000, reveal: 1, hot: 1, cool: 1, exhaust: 0.55, oil: 0.5 }),
    },
    {
      id: 'gate',
      heading: '6 · The wastegate, or it never stops',
      body: 'The turbo has a runaway problem built into it: more boost burns more fuel, more fuel makes more exhaust, and more exhaust spins the turbo harder still. Left alone it would climb until something let go. So a spring-loaded canister is plumbed to the compressor outlet and feels the boost it is making. Past its set pressure the spring loses, the rod moves, and a flap swings open on a passage that goes straight past the turbine wheel. Watch the shaft: the moment exhaust has an easier way out, it slows down.',
      hint: 'Typical setting on a road car: about 1 bar above atmospheric.',
      camera: { position: [0.79, 2.96, 3.26], target: [-0.15, 1.63, 0.69] },
      focus: ['Actuator - boost-fed', 'Flapper'],
      onEnter: ({ handles }) => handles.setLabels('gate'),
      timeline: gateRun(10000),
    },
    {
      id: 'run',
      heading: 'The loop, and the lag',
      body: 'Put it together and it is a machine that feeds itself: exhaust spins the turbine, the turbine drives the compressor, the compressor stuffs more air in, more air lets the engine burn more fuel — and more fuel makes more exhaust. The one thing it cannot cheat is its own inertia. Ask for full throttle and those two wheels have to be accelerated from ten thousand rpm to two hundred thousand before anything happens. That pause is turbo lag, and every trick in the field — smaller wheels, twin scrolls, an electric motor on the shaft — exists to shorten it.',
      hint: 'Drag to orbit the running turbo.',
      camera: { position: [1.13, 2.04, 4.39], target: [-1.47, 0.73, -0.13] },
      freeOrbit: true,
      onEnter: ({ handles }) => handles.setLabels(false),
      timeline: run({ turns: 15, duration: 8000, hot: 0.15, exhaust: 1, intake: 1 }),
    },
  ],
});
