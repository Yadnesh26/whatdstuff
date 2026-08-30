import { defineExplainer } from '../../framework/index.js';
import { TAU } from '../../framework/motion.js';
import meta from './meta.js';
import { buildDishwasher } from './model.js';

// Reveal story: the sealed stainless box, then the door drops and the racks
// roll out, then a macro on the soap flap, then the cabinet skin comes off to
// show the thing nobody expects — it never fills, there are only two litres in
// the sump — then the pump and its heater, then the spray arms spinning
// themselves, then the filter loop and the drain, then the drying trick, and
// finally the machine shut again, turning on its plinth, running.
//
// Seamless loops: every step drives ONE linear 0-1 phase. Spray-arm angles
// advance a WHOLE number of turns per lap (lower 3, upper 5 — they are not
// geared to each other; each is driven by its own jets), the wash impeller 7,
// the drain impeller 5, and every dot trail a whole number of cycles. All of
// those counts are ODD on purpose: verify.mjs samples each loop half a lap
// apart, and an even count hashes identically at both points.

// Every scalar the model owns, so each step can pin ALL of them (pre-flight #4)
// and scrolling either direction lands on an identical scene.
const DEFAULTS = {
  reveal: 0,
  door: 0,
  rackOut: 0,
  water: 0,
  armLo: 0,
  armUp: 0,
  impeller: 0,
  drainSpin: 0,
  flow: 0,
  jets: 0,
  heat: 0,
  disp: 0,
  thrust: 0,
  fillVis: 0,
  drainVis: 0,
  steam: 0,
  spin: 0,
  rackLoVis: 1,
};

const view =
  ({ labels = false, ...rest }) =>
  ({ handles }) => {
    handles.set({ ...DEFAULTS, ...rest });
    handles.setLabels(labels);
  };

// One linear phase per lap. `lo`/`up`/`imp`/`drn` are WHOLE turns per lap;
// `extra` derives any other scalar from the same phase.
function run({ duration, lo = 0, up = 0, imp = 0, drn = 0, rock = 0, extra = null }) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({
          armLo: s.t * lo * TAU,
          armUp: s.t * up * TAU,
          impeller: s.t * imp * TAU,
          drainSpin: s.t * drn * TAU,
          spin: rock * Math.sin(s.t * TAU),
          flow: s.t,
          ...(extra ? extra(s.t) : null),
        }),
    });
  };
}

// 0 at the ends, 1 across the middle — a discrete event that still loops, held
// open across BOTH capture instants (30% and 60% of a lap) so no screenshot,
// reviewer or label probe ever catches the flap mid-swing.
const dwell = (t) => {
  if (t < 0.12) return 0;
  if (t < 0.26) return (t - 0.12) / 0.14;
  if (t < 0.74) return 1;
  if (t < 0.9) return 1 - (t - 0.74) / 0.16;
  return 0;
};

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildDishwasher({ scene });
  },

  steps: [
    {
      id: 'sealed',
      heading: 'Two hours of nothing you can see',
      body: 'A dishwasher gives you one button and then goes quiet. Behind that stainless door there is no drum to watch and no window to look through — just a hum, a swishing noise that changes every few minutes, and eventually clean plates. What is actually happening in there is stranger than most people picture. It is not a bath. Your dishes never touch a pool of water at all.',
      hint: 'Drag to orbit · scroll to open it up.',
      camera: { position: [2.95, 2.2, 3.25], target: [-0.35, 1.25, 0.1] },
      dofAperture: 0.00004,
      focus: ['Door handle'],
      onEnter: view({ labels: 'exterior' }),
      timeline: run({ duration: 7000, lo: 1, up: 1 }),
    },
    {
      id: 'load',
      heading: 'The door is a shelf, and half the machine',
      body: 'Pull the handle and the whole front falls forward on a hinge at floor level, held by two counterbalance springs so it stops flat instead of dropping. Two wire racks roll out over it on rails: plates stood on edge below, glasses and cups upside down above, cutlery in its own basket. Nothing here is decoration. Every dish is angled so that water thrown from underneath can reach its dirty face and then run straight back off it.',
      camera: { position: [2.55, 2.7, 3.5], target: [-0.35, 1.2, 0.4] },
      dofAperture: 0.00007,
      focus: ['Lower rack — plates', 'Upper rack — glasses'],
      onEnter: view({ labels: 'load', door: 1, rackOut: 1 }),
      timeline: run({ duration: 6200, lo: 1, up: 1 }),
    },
    {
      id: 'soap',
      heading: 'The soap is on a timer, not a trigger',
      body: 'On the inside of the door sits a plastic cup with a sprung lid. You load the tablet, shut the flap, and it stays shut — through the fill, through the cold pre-rinse that washes the worst of the food away. Only when the machine is ready does a wax motor let the catch go — a pellet of wax with a small heater wrapped round it, which expands and shifts a plunger a couple of millimetres, just far enough to trip the release. The lid springs open and the tablet drops into hot water, not cold.',
      hint: 'Detergent enzymes are wasted on a cold pre-rinse — so it waits.',
      camera: { position: [1.35, 1.5, 2.4], target: [-0.28, 0.6, 1.42] },
      dofAperture: 0.0003,
      focus: ['Wax-motor latch', 'Main-wash cup'],
      onEnter: view({ labels: 'soap', door: 1, rackOut: 0.25 }),
      timeline: run({
        duration: 5000,
        lo: 1,
        extra: (t) => ({ disp: dwell(t) }),
      }),
    },
    {
      id: 'water',
      heading: 'It never fills up',
      body: 'Take the cabinet off and the surprise is what is missing. There is no tank and no bath. The inlet valve lets in about two litres — a puddle a couple of centimetres deep, sitting in a well in the floor called the sump — and then shuts. That is all the water in the machine at any moment. The dishes stand a foot above it and stay dry until something throws it at them.',
      camera: { position: [2.05, 1.9, 2.7], target: [-0.36, 0.95, -0.02] },
      dofAperture: 0.00009,
      focus: ['Sump — about 2 litres', 'Dishes never sit in it'],
      onEnter: view({ labels: 'water', reveal: 1, water: 0.25, fillVis: 1, rackLoVis: 0 }),
      timeline: run({
        duration: 6000,
        lo: 1,
        extra: (t) => ({ water: 0.25 + 0.75 * (0.5 - 0.5 * Math.cos(t * TAU)) }),
      }),
    },
    {
      id: 'pump',
      heading: 'The pump doing all the washing',
      body: 'Underneath the tub, in about fifteen centimetres of space, sits a centrifugal pump: a disc of curved vanes spinning near 2800 rpm inside a snail-shaped housing. It sucks the sump dry through the filter and flings the water outward, and the housing turns that speed into pressure. On the way out the water passes a flow-through heater — a heated sleeve in the pipe itself — which lifts it to about 55 °C for a normal wash, or 70 °C when you ask for sanitise.',
      hint: 'Older machines had a bare element in the floor. This one heats the water as it flies past.',
      camera: { position: [0.72, 0.86, 2.02], target: [-0.12, 0.5, 0.16] },
      dofAperture: 0.00026,
      focus: ['Impeller — 2800 rpm', 'Flow-through heater'],
      onEnter: view({ labels: 'pump', reveal: 1, water: 0.55, jets: 1, heat: 0.7 }),
      timeline: run({
        duration: 4000,
        lo: 3,
        up: 5,
        imp: 7,
        extra: (t) => ({ heat: 0.6 + 0.4 * (0.5 - 0.5 * Math.cos(t * TAU)) }),
      }),
    },
    {
      id: 'arms',
      heading: 'The arms spin themselves',
      body: 'Water goes up a duct in the back wall to two spray arms, and here is the trick: neither arm has a motor. Look at the nozzles and they are not pointing straight up — each one is tipped sideways, so every jet leaves at an angle. Push water one way hard enough and it pushes the arm the other way, exactly like a lawn sprinkler, and the whole thing winds up to somewhere between 30 and 60 rpm on its own. That is why a blocked nozzle stops an arm dead: you have removed its engine.',
      camera: { position: [1.55, 1.55, 2.15], target: [-0.28, 1.02, 0.0] },
      dofAperture: 0.00018,
      focus: ['Jet kicks the arm round', 'Hub bearing — no motor'],
      onEnter: view({
        labels: 'arms',
        reveal: 1,
        water: 0.5,
        jets: 1,
        heat: 0.55,
        thrust: 1,
        rackLoVis: 0,
      }),
      timeline: run({ duration: 3400, lo: 3, up: 5, imp: 7 }),
    },
    {
      id: 'drain',
      heading: 'The same two litres, over and over',
      body: 'Everything the arms throw runs off the dishes, down the walls and back into the sump through a filter — a coarse strainer that catches the peas, a fine mesh that holds the crumbs. The pump picks it straight back up. That single puddle goes round hundreds of times in one wash. Only at the end does a second, smaller pump push it out through a hose that has to rise in a high loop above the tub, because without that climb the drain could siphon dirty water back in.',
      camera: { position: [3.05, 2.15, 2.0], target: [-0.4, 1.15, -0.28] },
      dofAperture: 0.00006,
      focus: ['Food trapped on the mesh', 'High loop — no backflow'],
      onEnter: view({ labels: 'drain', reveal: 1, water: 1, jets: 0.35, drainVis: 1, rackLoVis: 0 }),
      timeline: run({
        duration: 4600,
        lo: 3,
        up: 5,
        imp: 7,
        drn: 5,
        extra: (t) => ({ water: 0.5 + 0.5 * Math.cos(t * TAU) }),
      }),
    },
    {
      id: 'dry',
      heading: 'Drying with no fan and no towel',
      body: 'The last rinse is the hottest, and it carries rinse aid — a surfactant that drops the water\'s surface tension so it cannot hold itself into beads. Instead it sheets off the glass in one film and takes almost nothing with it. Then the machine simply stops. The dishes are hotter than the stainless walls around them, so what moisture is left evaporates off the china and condenses on the cold steel, runs down, and drains away. The drying is done by the temperature difference alone.',
      hint: 'Plastic dries worst — it holds too little heat to finish the job.',
      camera: { position: [2.25, 2.1, 2.55], target: [-0.4, 1.5, -0.05] },
      dofAperture: 0.0001,
      focus: ['Rinse aid: it sheets off', 'Condensate on cool steel'],
      onEnter: view({ labels: 'dry', reveal: 1, water: 0.12, heat: 0.2, steam: 1 }),
      timeline: run({ duration: 5200, lo: 1 }),
    },
    {
      id: 'cycle',
      heading: 'Eleven litres, start to finish',
      body: 'Shut the door and all of it disappears again: fill, heat, soap, wash, drain, rinse, drain, dry — four or five little fills of about two litres each, roughly eleven litres for the whole load. The same job at the sink, under a running tap, can take five times that and never gets near 55 °C, because your hands cannot. The machine is not being thorough by using more. It is being thorough by using the same water, again and again, very hard.',
      camera: { position: [3.3, 2.3, 3.65], target: [-0.25, 1.3, 0.05] },
      dofAperture: 0.00005,
      freeOrbit: true,
      onEnter: view({ reveal: 0, water: 0.6, jets: 1, heat: 0.6 }),
      timeline: run({ duration: 2800, lo: 3, up: 5, imp: 7, rock: 0.08 }),
    },
  ],
});
