import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildHybridEngine } from './model.js';

// Zoom-in / reveal story (story.js is the contract): the sealed hybrid, the
// parts inside, the ONE planetary gearset, the speed lever, then the four
// things the car does with it: electric only, charging while driving, full
// power, regenerative braking; finally everything together. Every step drives
// ONE lap function (setLap, 12 s) through a local tween object; the mode
// decides which lap (all modes are seamless — see model.js).

// Pin the full layer/label/overlay state on entering a step (pre-flight #4).
const view =
  ({ mode, reveal, focus = 'none', labels, hud }) =>
  ({ handles }) => {
    handles.setMode(mode);
    handles.setReveal(reveal);
    handles.setFocus(focus);
    handles.setOverlay(!!hud);
    handles.setLabels(labels);
  };

function lap(duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state, never shared across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.setLap(s.t % 1) });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildHybridEngine({ scene });
  },

  steps: [
    {
      id: 'complete',
      heading: 'It never shifts',
      body: 'A hybrid looks like any other car. Yet it creeps away in silence, the engine drones at one steady pitch while you speed up, and nothing ever changes gear. There is no gearbox hiding in there to hear. The trick is somewhere inside.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [4.0, 1.6, -4.6], target: [-0.5, 0.5, -0.3] },
      onEnter: view({ mode: 'cycle', reveal: 0, labels: false }),
      timeline: lap(12000),
    },
    {
      id: 'inside',
      heading: 'An engine, two motors and a battery',
      body: 'Under the skin: a small petrol engine, two electric motor-generators called MG1 and MG2, an inverter that shuttles power between them, and a battery at the back. Look for what is missing. No clutch, no torque converter, no gearbox.',
      hint: 'Everything shown is turning at the speed the car is actually asking for.',
      camera: { position: [1.95, 2.9, -4.4], target: [0.5, 1.1, -1.2] },
      focus: ['Generator MG1'],
      onEnter: view({ mode: 'cruise', reveal: 1, labels: 'inside' }),
      timeline: lap(12000),
    },
    {
      id: 'gearset',
      heading: 'One small set of gears joins all three',
      body: 'This single planetary gearset is the whole transmission. The engine feeds the amber carrier. The blue sun gear is bolted to generator MG1. The green outer ring turns the wheels, and motor MG2 pushes on that same ring. Three things, three connections, four planet gears in between.',
      hint: 'Gears are drawn about twice real size and turned slowly so you can follow them.',
      camera: { position: [1.55, 0.8, -2.25], target: [0.0, 0.55, -1.6] },
      focus: ['Sun gear · 30 teeth → MG1'],
      onEnter: view({ mode: 'cruise', reveal: 2, focus: 'psd', labels: 'psd' }),
      timeline: lap(12000),
    },
    {
      id: 'lever',
      heading: 'The generator is the gear lever',
      body: 'The three speeds always sit on one straight line. The ring is tied to the road, so it cannot move on its own. To change the engine speed, the generator has to change its speed. Watch the amber engine marker slide while the green wheel marker stays put and the blue generator swings further. That swing is the gear ratio. With 30 teeth on the sun and 78 on the ring, the generator turns 3.6 times the engine minus 2.6 times the wheels.',
      hint: 'Speeds drawn relative; the lap repeats every 12 seconds.',
      camera: { position: [1.55, 0.8, -2.25], target: [0.0, 0.55, -1.6] },
      focus: ['Generator speed sets the ratio'],
      onEnter: view({ mode: 'cruise', reveal: 2, focus: 'psd', labels: 'lever', hud: true }),
      timeline: lap(12000),
    },
    {
      id: 'ev',
      heading: 'Pulling away: the engine just stops',
      body: 'At low speed the car runs on the battery alone. The engine stays stopped, its pistons still. MG2 pushes the ring and the car moves. The sun gear spins backwards, freewheeling, because the carrier is standing still while the ring turns, and the generator does no work. No fuel burned, no noise.',
      hint: 'Power travels battery, inverter, MG2, ring, wheels.',
      camera: { position: [1.95, 2.9, -4.4], target: [0.5, 1.1, -1.2] },
      focus: ['Engine: stopped'],
      onEnter: view({ mode: 'ev', reveal: 1, labels: 'ev', hud: true }),
      timeline: lap(12000),
    },
    {
      id: 'charge',
      heading: 'Engine on: split the power',
      body: 'With the engine running its torque splits on the way through the gears: about seventy percent goes straight to the ring and the wheels, about thirty percent spins the sun and MG1. MG1 turns that into electricity, and whatever the wheels do not need tops up the battery. The engine is charging the battery while it drives.',
      hint: 'The split follows the tooth counts: 78 to 30.',
      camera: { position: [1.95, 2.9, -4.4], target: [0.5, 1.1, -1.2] },
      focus: ['MG1 generating'],
      onEnter: view({ mode: 'charge', reveal: 1, labels: 'charge', hud: true }),
      timeline: lap(12000),
    },
    {
      id: 'boost',
      heading: 'Floor it: both push',
      body: 'Press the pedal and the engine speeds up, and MG2 adds its own push to the ring from the battery. The car gets the engine and a motor at once, so a small engine can feel like a large one. The battery runs down for a moment, then recovers.',
      hint: 'Power numbers are relative, not kilowatts.',
      camera: { position: [1.95, 2.9, -4.4], target: [0.5, 1.1, -1.2] },
      focus: ['Battery discharging'],
      onEnter: view({ mode: 'boost', reveal: 1, labels: 'boost', hud: true }),
      timeline: lap(12000),
    },
    {
      id: 'regen',
      heading: 'Braking makes electricity',
      body: 'Lift off and brake, and the engine switches off. Now the wheels turn MG2 against its own push, so it works as a generator and the car slows as the battery fills. The energy you would have thrown away as heat in the brakes goes into the battery instead, and MG2 pulls the car away again afterwards.',
      hint: 'Power flows backwards, wheels to battery.',
      camera: { position: [1.95, 2.9, -4.4], target: [0.5, 1.1, -1.2] },
      focus: ['MG2 as generator'],
      onEnter: view({ mode: 'regen', reveal: 1, labels: 'regen', hud: true }),
      timeline: lap(12000),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Back together. Electric pull-away, engine joining in, a push for the hill, a glide to a stop. The car chooses on its own, and the only gearbox is a generator speeding up and slowing down. The gearbox was a generator all along.',
      hint: 'Drag to orbit while it drives.',
      camera: { position: [4.0, 1.6, -4.6], target: [-0.5, 0.5, -0.3] },
      freeOrbit: true,
      onEnter: view({ mode: 'cycle', reveal: 0, labels: false }),
      timeline: lap(12000),
    },
  ],
});
