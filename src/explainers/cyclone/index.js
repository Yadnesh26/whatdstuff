import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildCyclone } from './model.js';

// Every step loops while active. Seamlessness rule: `spin` counts WHOLE turns
// per lap (each cloud shell multiplies it by its own integer, so all three
// wrap together) and `flow` runs whole cycles of the engine circuit, the
// evaporation, the surf and the subsiding air — so the wrap lands on an
// identical pose everywhere.

// Camera bearings, not raw vectors. The subject is round, so azimuth,
// elevation and distance are the only shot variety there is, and they have to
// be deliberate or eight steps look like one. The arc runs
// 40 -> 120 -> 90 -> 52 -> 90 -> 76 -> (inside) -> 22, and the elevation
// falls from 50 deg (the satellite view everyone knows) to 11 deg (the
// textbook cross-section) before landing inside the eye itself.
const CENTER = [0, 0.28, 0];

function shot(azDeg, elDeg, dist, push = 0.15, targetY = CENTER[1]) {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  const d = [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
  // Aim left of the axis so the storm sits right of frame centre — the text
  // panel owns the left ~38% of the viewport. Camera-right in world is
  // normalize(cross(worldUp, eye - target)) = (dz, 0, -dx).
  const rx = d[2];
  const rz = -d[0];
  const rl = Math.hypot(rx, rz) || 1;
  const k = (push * dist) / rl;
  return {
    position: [CENTER[0] + dist * d[0], targetY + dist * d[1], CENTER[2] + dist * d[2]],
    target: [CENTER[0] - k * rx, targetY, CENTER[2] - k * rz],
  };
}

// Every onEnter pins the COMPLETE state. Anything left unpinned inherits the
// previous step's mid-lap phase and misframes a camera that cannot move.
const POSE = {
  spin: 0,
  flow: 0,
  deck: 1,
  warm: 0,
  ghost: 0,
  inflow: 0,
  engine: 0,
  view: 0,
  sinkAir: 0,
  land: 0,
  lid: 0,
};
const pin = (handles, set, overrides) => {
  handles.setLabels(set);
  handles.set({ ...POSE, ...overrides });
};

// One scalar sweeping 0->1 per lap; `spin` and `flow` are read off it.
function run({ duration, turns = 1, live }) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.set({ spin: s.t * turns, flow: s.t, ...live }),
    });
  };
}

export default defineExplainer({
  ...meta,

  // No plinth, no shadow floor, no studio sweep: the subject is 800 km of
  // ocean air and paints its own sky. DOF is deliberately OFF: a bokeh pass
  // over a diffuse cloud mass buys almost nothing and cost a third of this
  // scene time budget.
  stageOptions: { space: true },

  buildScene({ scene }) {
    return buildCyclone({ scene });
  },

  steps: [
    {
      id: 'orbit',
      heading: 'A machine that builds itself',
      body: 'This is eight hundred kilometres of ocean air turning around a hole. There is no shell, no shaft and no fuel tank — only seawater, sunlight and the spin of the planet. And yet it runs like an engine: an intake along the sea, a hot stage in the wall of cloud, an exhaust spilling out of the top. Everything after this is that engine, taken apart.',
      hint: 'Drag to orbit · scroll to take it apart.',
      camera: shot(40, 68, 8.0, 0.16, 0.32),
      focus: ['Eye'],
      onEnter: ({ handles }) => pin(handles, 'exterior', {}),
      timeline: run({ duration: 9000 }),
    },
    {
      id: 'fuel',
      heading: 'The fuel is warm water',
      body: 'A cyclone can only run over sea that is at least 26.5 °C, and warm about fifty metres down — any shallower and the storm churns up cold water and starves itself. That surface hands the air water vapour by the cubic kilometre. The heat is not in the air yet; it is hidden inside the vapour, and it stays hidden until the vapour climbs.',
      hint: 'Nothing here is burning. The heat is already in the water.',
      camera: shot(120, 26, 7.0, 0.14, 0.3),
      focus: ['Sea at 26.5 °C'],
      onEnter: ({ handles }) => pin(handles, 'fuel', { warm: 1 }),
      timeline: run({ duration: 7000, live: { warm: 1 } }),
    },
    {
      id: 'coriolis',
      heading: 'Why it turns instead of filling',
      body: 'Air rushes toward the low pressure in the middle — but the planet is turning underneath it. In the northern hemisphere every moving parcel gets nudged to its right, so it never actually arrives. It swings past the centre, comes round, and settles into an orbit. The grey paths are where that air would have gone on a planet that stood still.',
      hint: 'Below about five degrees of latitude the nudge is too weak, and cyclones simply do not form.',
      camera: shot(90, 70, 7.4, 0.14, 0.12),
      focus: ['Deflected right'],
      onEnter: ({ handles }) => pin(handles, 'spin', { deck: 0.32, ghost: 1, inflow: 1 }),
      timeline: run({ duration: 8000, live: { deck: 0.32, ghost: 1, inflow: 1 } }),
    },
    {
      id: 'spinup',
      heading: 'Then it winds itself up',
      body: 'Air spiralling inward has to turn faster to keep the angular momentum it started with — a skater pulling her arms in, except eight hundred kilometres across. Faster wind means lower pressure at the centre; lower pressure pulls the air in harder; harder inflow spins faster still. Once that circle closes, the storm is feeding itself.',
      camera: shot(52, 32, 5.6, 0.16, 0.3),
      focus: ['Faster on a shorter radius'],
      onEnter: ({ handles }) => pin(handles, 'spinup', { deck: 0.32, inflow: 1 }),
      timeline: run({ duration: 5200, live: { deck: 0.32, inflow: 1 } }),
    },
    {
      id: 'engine',
      heading: 'The engine, cut open',
      body: 'Here is the whole cycle as one circuit. Wet air crawls in along the sea in a layer barely a kilometre deep, turns the corner at the eyewall and climbs fifteen kilometres. On the way up the vapour condenses and finally lets go of its heat — which is what drives the climb. At the top the air is wrung dry, spreads outward under the tropopause, and sinks back to the sea far away to be used again. A large storm runs that loop at roughly six hundred trillion watts.',
      hint: 'Height is exaggerated about eleven times here. A real hurricane is a pancake: 800 km wide, 15 km tall.',
      camera: shot(90, 14, 3.6, 0.14, 0.55),
      focus: ['Eyewall updraft'],
      onEnter: ({ handles }) => pin(handles, 'engine', { view: 1, engine: 1, lid: 1 }),
      timeline: run({ duration: 6500, live: { view: 1, engine: 1, lid: 1 } }),
    },
    {
      id: 'eyewall',
      heading: 'The eyewall does all the work',
      body: 'Every bit of that heat is released in one ring of thunderstorm, and that ring is where the wind is: a Category 5 begins at 252 km/h and it is measured here, nowhere else. Watch the wall lean outward as it rises. Air climbing the wall keeps the angular momentum it arrived with, and the surface that traces flares as it goes up — which is why, from the middle, it looks like a stadium.',
      camera: shot(90, 12, 3.3, 0.12, 0.5),
      focus: ['Leaning outward'],
      onEnter: ({ handles }) => pin(handles, 'wall', { view: 1, engine: 0.55 }),
      timeline: run({ duration: 4600, live: { view: 1, engine: 0.55 } }),
    },
    {
      id: 'eye',
      heading: 'Inside the eye',
      body: 'The middle of the most violent storm on Earth is calm, dry and often sunny. Air sinking down the middle warms as it compresses, and warm air will not hold cloud — so it burns a clear well straight down to the water, ringed by the tallest thunderstorm on the planet. It is also the lowest sea-level pressure ever measured: 870 hPa, in Typhoon Tip in 1979, about fifteen per cent below a normal day.',
      // Looking DOWN the well rather than standing in it: at any puff size
      // that renders, an interior camera sits inside the cloud itself.
      camera: shot(150, 76, 2.3, 0.18, 0.35),
      focus: ['Dry, sinking, warm'],
      onEnter: ({ handles }) => pin(handles, 'eye', { sinkAir: 1 }),
      timeline: run({ duration: 6000, live: { sinkAir: 1 } }),
    },
    {
      id: 'landfall',
      heading: 'Then it reaches the coast',
      body: 'The engine only runs on warm water, so the storm begins dying the moment it crosses the shore: the fuel is simply gone, and rough ground drags at its base. But the low pressure and the wind have spent days piling a dome of seawater up under the eye, and that dome comes ashore with it. The surge, not the wind, is usually what does the killing.',
      hint: 'Drag to orbit while it runs.',
      camera: shot(22, 28, 9.2, 0.14, 0.34),
      freeOrbit: true,
      focus: ['Storm surge'],
      onEnter: ({ handles }) => pin(handles, 'coast', { land: 1 }),
      timeline: run({ duration: 4200, turns: 2, live: { land: 1 } }),
    },
  ],
});
