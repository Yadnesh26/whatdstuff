import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildEarth, C, SLAB_C } from './model.js';

// Every step loops while active. Each timeline tweens ONE local scalar 0 -> 1
// per lap and maps it onto the model's lap phases (see model.js header for
// why each lap closes seamlessly).

// Camera bearing -> {position, target}. az 0 looks from +z, 90 from +x.
// `push` slides the aim left by that fraction of the frame width, so the
// subject sits right of centre: the text panel owns the left ~38%.
function shot(center, azDeg, elDeg, dist, push = 0.15) {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  const d = [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
  const position = center.map((c, i) => c + dist * d[i]);
  // frame width ≈ 1.23 × distance at the stage's 42° FOV and 16:10
  const k = push * dist * 1.23;
  const target = [center[0] - k * Math.cos(a), center[1], center[2] + k * Math.sin(a)];
  return { position, target };
}
const G = [C.x, C.y, C.z];
const at = (dx, dy, dz = 0) => [C.x + dx, C.y + dy, C.z + dz];

// Every onEnter pins the COMPLETE state, so no step inherits the previous
// step's mid-lap spin, overlay or cut.
const POSE = {
  mode: 'sealed',
  spin: 0,
  flow: 0,
  wave: 0,
  rays: 'none',
  slab: 0,
  convect: 0,
  swirl: 0,
  field: 0,
  glow: 0,
};
const pin = (handles, set, over) => {
  handles.setLabels(set);
  handles.set({ ...POSE, ...over });
};

// lap scalar -> the pose keys this step animates
function run(duration, map) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.set(map(s.t)),
    });
  };
}

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildEarth({ scene });
  },

  steps: [
    {
      id: 'planet',
      heading: 'Everything you’ve ever stood on',
      body: 'This is the whole planet, 12,742 km across. Every rock anyone has ever held, every mine and every well, came out of a thin skin on the outside of it. Yet we know what is at the very centre. Nobody has ever been anywhere close.',
      hint: 'Drag to turn it.',
      camera: shot(G, 22, 14, 6.6, 0.14),
      focus: ['Crust · all we’ve touched'],
      onEnter: ({ handles }) => pin(handles, 'exterior'),
      timeline: run(20000, (t) => ({ spin: t })),
    },
    {
      id: 'layers',
      heading: 'Cut it open',
      body: 'Take out a wedge and the planet turns out to be layers, drawn here at true scale. A rocky crust too thin to see. Then 2,900 km of mantle: solid rock, glowing hotter the deeper it goes. Then a core of iron and nickel in two parts: an outer core that is liquid, and an inner core that is solid.',
      camera: shot(G, 45, 26, 5.6, 0.13),
      focus: ['Outer core · liquid', 'Inner core · solid'],
      onEnter: ({ handles }) => pin(handles, 'layers', { mode: 'octant', swirl: 1, glow: 1 }),
      timeline: run(8000, (t) => ({ flow: t })),
    },
    {
      id: 'crust',
      heading: 'The deepest hole ever drilled',
      body: 'The crust is 5 to 10 km thick under the oceans and 30 to 50 km under the continents. Compared with the planet, that is thinner than the skin of an apple. The deepest hole ever drilled, the Kola borehole in Arctic Russia, took 19 years to reach 12.3 km. The rock at the bottom was 180 °C and soft enough to creep into the hole. It never got through the crust: that is 0.2% of the way to the centre.',
      hint: 'The slice is magnified 60 times. On the globe, at true scale, the whole crust is that hair-thin rim.',
      camera: {
        // frames the true-scale rim patch (x ≈ 0.39) AND the slab inside the
        // right 62% of the frame: the text panel owns the left 38%
        position: [1.1, SLAB_C.y + 0.4, SLAB_C.z + 4.4],
        target: [0.88, SLAB_C.y - 0.38, SLAB_C.z - 0.1],
      },
      focus: ['Kola borehole · 12.3 km'],
      onEnter: ({ handles }) => pin(handles, 'crust', { mode: 'octant', slab: 1, glow: 1 }),
      timeline: run(8000, (t) => ({ flow: t })),
    },
    {
      id: 'mantle',
      heading: 'Solid rock that flows',
      body: 'The mantle is 84% of the Earth’s volume, and it is solid rock. But it is heated from below by the core and cooled from above, and over millions of years it creeps. Hot rock rises, spreads out under the crust, cools, and sinks again, a few centimetres a year. That slow churn is the engine under the plates on the surface.',
      hint: 'Sped up enormously. One lap of a loop like this takes on the order of a hundred million years.',
      camera: shot(at(0.62, 0.62), 14, 14, 3.4, 0.12),
      focus: ['Hot rock rising', 'Cool rock sinking'],
      onEnter: ({ handles }) => pin(handles, 'mantle', { mode: 'octant', convect: 1 }),
      timeline: run(12000, (t) => ({ flow: t })),
    },
    {
      id: 'xray',
      heading: 'How we know: earthquakes',
      body: 'Nobody can go down there, so we listen instead. Every big earthquake sends waves through the whole planet, and seismometers around the world time them. P waves push and pull, and cross solids and liquids alike. S waves shake the rock sideways, and a liquid cannot carry that. So every S wave that reaches the core dies there, and a huge band on the far side of the Earth never feels one. That shadow is how we know the outer core is liquid.',
      hint: 'Paths traced through PREM, the standard model of the Earth’s interior. Waves speed up with depth, so they curve back toward the surface. Real crossing time: about 20 minutes.',
      camera: shot(G, 0, 4, 5.4, 0.14),
      focus: ['S waves die here', 'S-wave shadow zone'],
      onEnter: ({ handles }) => pin(handles, 'waves', { mode: 'half', rays: 'xray' }),
      timeline: run(12000, (t) => ({ wave: t })),
    },
    {
      id: 'outer-core',
      heading: 'A liquid-iron dynamo',
      body: 'The outer core is 2,260 km of molten iron and nickel at around 4,000 to 5,000 °C, churning as the planet cools and spins. Moving liquid metal carries electric currents, and those currents make the Earth’s magnetic field: the loops that reach out into space and swing every compass on the surface.',
      hint: 'Flow sped up and simplified. The real field’s axis also tilts about 10° from the spin axis.',
      camera: shot(G, 40, 18, 8.6, 0.13),
      focus: ['Liquid iron, churning', 'Magnetic field'],
      onEnter: ({ handles }) => pin(handles, 'core', { mode: 'octant', swirl: 1, field: 1 }),
      timeline: run(10000, (t) => ({ flow: t })),
    },
    {
      id: 'inner-core',
      heading: 'A solid ball as hot as the Sun',
      body: 'At the centre is a ball of iron and nickel about 2,440 km across, at roughly 5,400 °C: about as hot as the surface of the Sun. At that heat it should be liquid. It stays solid because it is under 3.6 million atmospheres of pressure, which raises iron’s melting point higher still. In 1936 Inge Lehmann noticed faint P waves arriving inside the shadow, where none should be. Something inside the core was bending them there. It was this ball.',
      hint: 'The white paths are bent by the faster inner core into the P-wave shadow.',
      camera: shot(at(0.25, -0.1), 0, 3, 5.1, 0.13),
      focus: ['Bent by the inner core', 'Inner core · ~5,400 °C'],
      onEnter: ({ handles }) => pin(handles, 'inner', { mode: 'half', rays: 'lehmann', glow: 1 }),
      timeline: run(12000, (t) => ({ wave: t, flow: t })),
    },
    {
      id: 'sealed',
      heading: 'Everything below 12 km, we heard',
      body: 'Put the wedge back and it is just a planet again. The flowing mantle, the liquid core, the solid ball at the centre: every layer has been mapped without anyone going deeper than 12 km. We worked it all out by listening.',
      hint: 'Drag to orbit while it turns.',
      camera: shot(G, 68, 16, 6.8, 0.14),
      freeOrbit: true,
      onEnter: ({ handles }) => pin(handles, false),
      timeline: run(12000, (t) => ({ spin: t })),
    },
  ],
});
