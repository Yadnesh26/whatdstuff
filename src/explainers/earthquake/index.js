import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildEarthquake } from './model.js';

// Every step loops while active. Seamlessness: each timeline tweens ONE
// scalar, `cycle`, 0 -> 1 per lap; the model runs two whole earthquake
// cycles per lap (each quake slips half a fence period, so two quakes land the
// farmland on an identical pose — see model.js header). Event-only steps hold
// the fences still and loop the waves, which die out before the wrap.

const CENTER = [0, 1.05, 0];

// Camera bearing -> {position, target}. az 0 = +x (east side), 90 = +z (front).
// The target is pushed left of the subject so the block sits right of centre:
// the text panel owns the left ~38% of the viewport.
function shot(azDeg, elDeg, dist, push = 0.16, targetY = CENTER[1]) {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  const d = [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
  const rx = d[2];
  const rz = -d[0];
  const rl = Math.hypot(rx, rz) || 1;
  const k = (push * dist) / rl;
  return {
    position: [CENTER[0] + dist * d[0], targetY + dist * d[1], CENTER[2] + dist * d[2]],
    target: [CENTER[0] - k * rx, targetY, CENTER[2] - k * rz],
  };
}

// Every onEnter pins the COMPLETE state.
const POSE = {
  cycle: 0,
  loadFrac: 0.62,
  span: 14,
  reveal: 'none',
  heat: 0,
  trace: 0,
  arrows: 0,
  epi: 0,
};
const pin = (handles, set, overrides) => {
  handles.setLabels(set);
  handles.set({ ...POSE, ...overrides });
};

function run(duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.set({ cycle: s.t }),
    });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildEarthquake({ scene });
  },

  steps: [
    {
      id: 'ground',
      heading: 'Solid ground, until it isn’t',
      body: 'This block is a slice of the crust, 44 km across and 15 km deep, with farmland on top and a fault running down the middle. Watch the fence lines. They bend, slowly, and then everything jolts at once and they come back straight — just no longer lined up. That jolt is the earthquake.',
      hint: 'All movement here is exaggerated about 500 times. A big quake moves the ground metres, not kilometres.',
      camera: shot(62, 30, 10.4, 0.1),
      focus: ['Fault line'],
      onEnter: ({ handles }) => pin(handles, 'exterior', { arrows: 1 }),
      timeline: run(16000),
    },
    {
      id: 'locked',
      heading: 'The ground never stops moving',
      body: 'One side of this fault is sliding past the other at about 3.5 cm a year — about as fast as your fingernails grow. But the fault itself is jammed shut by friction. So the rock can’t slip. It bends instead, like a ruler flexed in your hands, and the red is the strain piling up nearest the fault, year after year, for decades or centuries.',
      hint: 'We hold one side still so you can watch the other move. Only the relative motion is real.',
      camera: shot(90, 58, 9.4, 0.1, 1.2),
      focus: ['Locked fault'],
      onEnter: ({ handles }) => pin(handles, 'strain', { loadFrac: 0.82, heat: 1, arrows: 1 }),
      timeline: run(14000),
    },
    {
      id: 'rupture',
      heading: 'Then friction loses',
      body: 'The break starts at one point on the fault, usually 5 to 15 km down: the hypocentre. The spot on the surface straight above it is the epicentre. From there the slip unzips across the fault at around 3 km a second, and as it passes, the bent rock on either side springs back straight. That spring-back is called elastic rebound, and it is where all of an earthquake’s energy comes from.',
      hint: 'In 1906 the San Andreas slipped up to about 6 m sideways, along hundreds of kilometres, in about a minute.',
      camera: shot(16, 16, 8.4, 0.1, 1.0),
      focus: ['Hypocentre · ~10 km down'],
      onEnter: ({ handles }) => pin(handles, 'rupture', { loadFrac: 0.3, span: 8, reveal: 'fault', epi: 1 }),
      timeline: run(12000),
    },
    {
      id: 'waves',
      heading: 'Two waves, two kinds of shove',
      body: 'The released energy races out through solid rock as waves. First the P wave, at about 6 km a second: it pushes and pulls the rock along the direction it travels, like a pulse down a Slinky. Then the S wave, at about 3.5 km a second: it shakes the rock sideways, across the direction of travel, and harder. A seismometer records them as two separate arrivals, and the gap between them gives the distance — about 8 km for every second.',
      hint: 'This seismometer is 19 km away, so the S wave lands about 2.2 seconds after the P.',
      camera: shot(90, 17, 8.6, 0.1, 1.6),
      focus: ['P wave · ~6 km/s', 'S wave · ~3.5 km/s'],
      onEnter: ({ handles }) => pin(handles, 'waves', { loadFrac: 0, span: 12, reveal: 'section', trace: 1 }),
      timeline: run(12000),
    },
    {
      id: 'surface',
      heading: 'The slow roll that does the damage',
      body: 'When those waves reach the surface, they set the ground itself rolling. Surface waves spread out from the epicentre more slowly than either P or S, so they arrive last — but they are the biggest and they last the longest. On the seismogram they’re the widest swing, and they are often what does the most damage to buildings.',
      camera: shot(48, 15, 8.6, 0.1, 1.45),
      focus: ['Surface waves'],
      onEnter: ({ handles }) => pin(handles, 'surface', { loadFrac: 0, span: 12, trace: 1, epi: 1 }),
      timeline: run(11000),
    },
    {
      id: 'again',
      heading: 'And then it starts again',
      body: 'Once the slip stops, the fault locks up again and the plates carry on at fingernail speed. The bending starts over, building toward the next one. How big that one is depends on how much fault breaks at once: each step up in magnitude releases about 32 times more energy, so a magnitude 7 releases about a thousand times the energy of a magnitude 5.',
      hint: 'Drag to orbit while it runs.',
      camera: shot(128, 30, 10.4, 0.1),
      freeOrbit: true,
      focus: ['Plate creeping · ~3.5 cm/yr'],
      onEnter: ({ handles }) => pin(handles, 'exterior', { arrows: 1, trace: 1 }),
      timeline: run(12000),
    },
  ],
});
