import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildSolarEclipse, SKY_C } from './model.js';

// Camera bearings around a centre: azimuth 0 looks from +z, 90 from +x.
// `push` slides the aim left by that fraction of the frame width, so the
// subject sits right of centre — the text panel owns the left ~38%.
function shot(center, azDeg, elDeg, dist, push = 0.17) {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  const d = [Math.cos(e) * Math.sin(a), Math.sin(e), Math.cos(e) * Math.cos(a)];
  const position = center.map((c, i) => c + dist * d[i]);
  // frame width ≈ 1.23 × distance at the stage's 42° FOV and 16:10
  const k = push * dist * 1.23;
  const target = [center[0] - k * Math.cos(a), center[1], center[2] + k * Math.sin(a)];
  return { position, target };
}

// The ground-view cameras look UP at the Sun from below. OrbitControls clamps
// the polar angle at 99°, so the tilt is kept under ~8° and the sky dome puts
// its horizon low instead (see HORIZON in model.js).
const skyShot = (azDeg, elDeg, dist, push) => shot(SKY_C, azDeg, -elDeg, dist, push);

function run(duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.set({ phase: s.t }),
    });
  };
}

// Every onEnter pins the COMPLETE state, so no step inherits the previous
// step's mid-lap pose or overlay.
const state = (over) => ({
  view: 'space',
  program: 'lineup',
  phase: 0,
  cones: 0,
  rays: 0,
  sight: 0,
  aids: 0,
  trail: 0,
  ...over,
});

export default defineExplainer({
  ...meta,

  // No `dof`: BokehPass keys off the depth buffer and the sky writes none.
  stageOptions: { space: true },

  buildScene({ scene, stage }) {
    return buildSolarEclipse({ scene, stage });
  },

  steps: [
    {
      id: 'totality',
      heading: '1 · The Moon fits over the Sun, almost exactly',
      body: 'Watch the Moon cross the Sun. You cannot see it coming: a new Moon is lit only from behind, and the bright daytime air in front of it hides it until it takes its first bite. The bite grows. The last sliver breaks into beads of light shining through valleys on the Moon\'s edge, one bead flares, and then the corona appears — the Sun\'s outer atmosphere. It is always there. It is simply about a million times fainter than the disc, and this is the only time the disc is out of the way.',
      hint: 'Time is squeezed here: totality lasts at most 7 min 32 s, out of a crossing that takes two to three hours. The notches on the Moon\'s edge are drawn deeper than life so the beads show at this size.',
      camera: skyShot(0, 6, 8.8, 0.19),
      focus: ['Corona · seen only in totality'],
      onEnter: ({ handles }) => {
        handles.set(state({ view: 'sky' }));
        handles.setLabels('sky');
      },
      timeline: run(20000),
    },
    {
      id: 'lineup',
      heading: '2 · 400 times wider, 400 times farther',
      body: 'Step off the ground and the fit turns out to be a coincidence. The Sun is about 400 times wider than the Moon. It is also about 400 times farther away. The two numbers cancel, so from Earth both discs are the same size: about half a degree, a pea held at arm\'s length. The gold lines run from one spot on the ground past the Moon\'s two edges, and land on the Sun\'s two edges. No law of physics arranged this. It just happens to be true, for now.',
      hint: 'Drawn at about 12× rather than 400×: the Sun is ten lunar distances away here instead of 389, and shrunk to match, so the two discs still line up.',
      camera: { position: [-0.6, 0.75, 1.05], target: [-20, -0.8, 3.5] },
      focus: ['Sun · ~400× wider than the Moon', 'Moon · the same 0.5° from the ground'],
      onEnter: ({ handles }) => {
        handles.set(state({ program: 'lineup', sight: 1 }));
        handles.setLabels('lineup');
      },
      timeline: run(24000),
    },
    {
      id: 'cones',
      heading: '3 · A shadow with two parts',
      body: 'Space is empty, so the Moon\'s shadow is invisible until it lands on something. Drawn in, it has two parts. Light from opposite edges of the Sun crosses behind the Moon and marks out a dark cone, the umbra, that narrows as it goes. Inside it the whole Sun is hidden. Around it spreads the penumbra, where only part of the Sun is covered. That is a partial eclipse, and it falls on a patch of Earth more than 6,400 kilometres wide.',
      camera: shot([-2.4, 0, 0], 0, 8, 14, 0.19),
      focus: ['Umbra · the Sun fully hidden', 'Penumbra · the Sun partly hidden'],
      onEnter: ({ handles }) => {
        handles.set(state({ program: 'cones', cones: 1, rays: 1 }));
        handles.setLabels('cones');
      },
      timeline: run(24000),
    },
    {
      id: 'distance',
      heading: '4 · The tip only just reaches',
      body: 'The umbra narrows to a point about 373,000 kilometres behind the Moon. At the Moon\'s average distance, the nearest ground is 378,000 kilometres away, so on an average day the tip stops about 5,000 kilometres short. But the Moon\'s orbit is an ellipse, from 356,500 to 406,700 kilometres. Near the close end the tip reaches the ground: a total eclipse. Near the far end it stops short, and beyond the tip the shadow opens out again into the antumbra. From inside that, the Moon looks slightly too small and leaves a ring of fire. That is why ring-of-fire eclipses are the more common kind, 33 percent to 27.',
      hint: 'The Moon slides along the line here so the two cases can be compared. In the sky its distance swings like this once every 27.5 days.',
      camera: shot([-1.6, 0, 0], 8, 12, 4.6, 0.02),
      focus: ['Umbra reaches the ground · total'],
      onEnter: ({ handles }) => {
        handles.set(state({ program: 'distance', cones: 1, rays: 1 }));
        handles.setLabels('distance');
      },
      timeline: run(14000),
    },
    {
      id: 'track',
      heading: '5 · A dark spot racing east',
      body: 'Where the tip does reach, it makes a spot at most 267 kilometres wide, usually 100 to 160. The Moon\'s orbit carries it east at over 3,400 km/h. The ground beneath is turning east too, but more slowly, so the spot outruns the planet at 1,700 km/h or more. The strip it sweeps is the path of totality, and anywhere on it, totality lasts at most 7 minutes 32 seconds. Around it, a partial eclipse covers a patch of Earth thousands of kilometres across.',
      hint: 'Totality happens somewhere every 18 months or so. Any one place waits, on average, around 375 years. Earth\'s spin is slowed here so the shadow still runs about twice as fast as the ground, as it really does.',
      camera: shot([0, 0.1, 0], -96, 14, 4.3, 0.17),
      focus: ['Umbra · at most 267 km wide', 'Path of totality'],
      onEnter: ({ handles }) => {
        handles.set(state({ program: 'track', trail: 1 }));
        handles.setLabels('track');
      },
      timeline: run(22000),
    },
    {
      id: 'nodes',
      heading: '6 · Why not every month?',
      body: 'There is a new Moon every 29.5 days, but not an eclipse every 29.5 days. Here are Earth and the Moon at their true sizes and true distance: Earth is a small target, 30 Earth-widths away. The Moon\'s orbit is tilted 5.1 degrees, so at most new Moons the shadow passes above or below Earth. It only hits when the new Moon falls near the line of nodes, where the two orbits cross. The line swings round to point at the Sun twice a year, 173 days apart. Those are the eclipse seasons, and between them they bring two to five solar eclipses every year.',
      camera: shot([0, 0, 0], 12, 13, 18, 0.15),
      focus: ["Moon's orbit · tilted 5.1°", 'Line of nodes'],
      onEnter: ({ handles }) => {
        handles.set(state({ program: 'nodes', cones: 1, aids: 1 }));
        handles.setLabels('nodes');
      },
      timeline: run(36000),
    },
    {
      id: 'inside',
      heading: '7 · Inside the dot',
      body: 'Back on the ground, inside the umbra. The sky turns deep blue, Venus and the brightest stars come out at midday, and every horizon glows orange: you are looking out of the shadow at sunlit air beyond it. The air can cool by several degrees. The fit is also slowly ending. The Moon drifts 3.8 centimetres farther from Earth every year, and in somewhere between 650 million and 1.4 billion years its shadow will stop reaching the ground at all.',
      hint: 'Drag to look around.',
      camera: skyShot(-10, 3, 15, 0.16),
      freeOrbit: true,
      focus: ['Sunset on every horizon'],
      onEnter: ({ handles }) => {
        handles.set(state({ view: 'sky' }));
        handles.setLabels('finale');
      },
      timeline: run(16000),
    },
  ],
});
