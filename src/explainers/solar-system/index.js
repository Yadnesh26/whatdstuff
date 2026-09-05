import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildSolarSystem } from './model.js';

// Camera bearings, not raw vectors. The subject is a flat disk seen from a
// point, so the two knobs that actually change a shot are elevation (46° looks
// down on a diagram, 3° turns it into a line) and distance. Azimuth marches
// ~40° a step so the nine cameras read as one continuous arc rather than nine
// arbitrary positions.
const CENTER = [0, 2.25, 0];

function shot(azDeg, elDeg, dist, push = 0.15, drop = 0) {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  const d = [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
  const position = [
    CENTER[0] + dist * d[0],
    CENTER[1] + dist * d[1],
    CENTER[2] + dist * d[2],
  ];
  // Aim left of the Sun so the system sits right of frame centre — the text
  // panel owns the left ~38%. Camera-right in world is (dz, 0, -dx).
  const rx = d[2];
  const rz = -d[0];
  const rl = Math.hypot(rx, rz) || 1;
  const k = (push * dist) / rl;
  return { position, target: [CENTER[0] - k * rx, CENTER[1] + drop, CENTER[2] - k * rz] };
}

// Default step timeline: one scalar sweeping 0->1 per lap. Laps here are
// 26-40s. Planets are not fast, and at the library's usual 3-8s tempo the
// inner four became a smear — the loop has to feel like something you are
// watching rather than something being flicked past you.
function run({ duration }) {
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

// Every onEnter pins the COMPLETE state — anything left unpinned inherits
// whatever the previous step's loop happened to be doing, including the
// planets' turn set, which decides how fast the whole scene reads.
const state = (over) => ({
  phase: 0,
  slow: 1,
  only: null,
  sunScale: 1,
  rings: 1,
  beltOn: 1,
  innerOn: 1,
  outerOn: 1,
  arrows: 0,
  faller: 0,
  sweep: 0,
  wobble: 0,
  corona: 1,
  flight: 0,
  stars: 1,
  band: 1,
  ...over,
});

export default defineExplainer({
  ...meta,

  // No `dof`: BokehPass keys its blur off the depth buffer and the sky writes
  // no depth, so every star would come out defocused.
  stageOptions: { space: true },

  buildScene({ scene, stage }) {
    return buildSolarSystem({ scene, stage });
  },

  steps: [
    {
      id: 'hero',
      heading: '1 · Eight things falling, and never landing',
      body: 'Nothing is holding these planets up. There is no rail, no engine, no invisible arm — each one is simply falling toward the Sun and missing, over and over, forever. What this picture cannot show you is how far apart they are. Draw the Sun a centimetre across and Earth becomes a speck of dust a metre away, while Neptune\'s orbit is a circle sixty-five metres wide. Distances here are compressed; the shapes, the tilts and the order are not.',
      hint: 'Drag to orbit. Every planet is on its real ellipse, in its real plane, starting where it actually was on 1 January 2000.',
      camera: shot(35, 32, 8.0, 0.20, 0.85),
      onEnter: ({ handles }) => {
        handles.set(state({}));
        handles.setLabels(false);
      },
      timeline: run({ duration: 40000 }),
    },
    {
      id: 'orbit',
      heading: '2 · An orbit is a miss, repeated',
      body: 'Gravity is the only force on Earth and it points straight at the Sun the whole way round, so why does Earth never arrive? Because it is also moving sideways at 30 kilometres a second. In one second it falls about three millimetres toward the Sun — and in that same second it travels far enough along that the Sun has curved away beneath it by roughly the same three millimetres. Take the sideways speed away and you get the grey body: a straight drop, no orbit, gone in 65 days.',
      camera: shot(78, 24, 3.7, 0.16),
      focus: ['Gravity pulls it in', 'Sideways speed · 30 km/s', 'No sideways speed'],
      onEnter: ({ handles }) => {
        handles.set(state({ arrows: 1, faller: 1, outerOn: 0, beltOn: 0 }));
        handles.setLabels('orbit');
      },
      timeline: run({ duration: 34000 }),
    },
    {
      id: 'inner',
      heading: '3 · The inner four are small, rocky and quick',
      body: 'One astronomical unit is the Earth–Sun distance: 149.6 million kilometres. All four rocky planets fit inside 1.6 of them, and being close in is exactly why they move so fast — Mercury runs at 48 kilometres a second and gets round in 88 days, the shortest year in the system. Venus takes 225 days, Earth 365, Mars 687. Past Mars the character of the place changes completely.',
      camera: shot(118, 46, 3.7, 0.14),
      focus: [
        'Mercury · 0.39 AU · 88 d',
        'Venus · 0.72 AU · 225 d',
        'Earth · 1 AU · 365 d',
        'Mars · 1.52 AU · 687 d',
      ],
      onEnter: ({ handles }) => {
        handles.set(state({ outerOn: 0, beltOn: 0, corona: 0.8 }));
        handles.setLabels('inner');
      },
      timeline: run({ duration: 34000 }),
    },
    {
      id: 'outer',
      heading: '4 · The outer four are enormous, and slow',
      body: 'Beyond the asteroid belt each giant sits roughly twice as far out as the one before, and the years stretch accordingly. Jupiter, at 5.2 AU, takes 11.9 of ours. Saturn takes 29. A single year on Uranus, 19.2 AU out, is longer than most human lives — 84 years. And Neptune, at 30 AU, has been round the Sun exactly once since it was found in 1846.',
      hint: 'Jupiter alone is about two-thirds of all the mass that is not the Sun.',
      camera: shot(160, 40, 10.4, 0.13),
      focus: [
        'Jupiter · 5.2 AU · 11.9 yr',
        'Saturn · 9.5 AU · 29.4 yr',
        'Uranus · 19.2 AU · 84 yr',
        'Neptune · 30.1 AU · 165 yr',
      ],
      onEnter: ({ handles }) => {
        handles.set(state({ slow: 0 }));
        handles.setLabels('outer');
      },
      timeline: run({ duration: 30000 }),
    },
    {
      id: 'ellipse',
      heading: '5 · Every orbit is an ellipse, and the Sun is off to one side',
      body: 'An orbit is an ellipse, and the Sun does not sit at its centre — it sits at one focus, off to one side. Most of these are so nearly circular that you would never catch it by eye. Mercury gives it away: its orbit runs from 46 million kilometres out to 70 million, and its speed swings with it, 59 kilometres a second at the near end and 39 at the far end. The two wedges cover the same slice of time and enclose the same area — the whole of Kepler\'s second law, and the reason a planet has to hurry when it is close.',
      hint: 'The Sun is shrunk toward its true proportion for this one. At the size it is drawn everywhere else, its own disc would swallow the gap this step is about.',
      camera: shot(202, 58, 3.4, 0.10),
      focus: [
        'Perihelion · 46 Mkm · 59 km/s',
        'Aphelion · 70 Mkm · 39 km/s',
        'Centre of the ellipse',
      ],
      onEnter: ({ handles }) => {
        handles.set(state({ sweep: 1, only: 'mercury', beltOn: 0, sunScale: 0.34 }));
        handles.setLabels('ellipse');
      },
      timeline: run({ duration: 30000 }),
    },
    {
      id: 'kepler',
      heading: '6 · Further out is slower, twice over',
      body: 'An outer planet has a longer way to go, and it also travels that way more slowly: 48 kilometres a second for Mercury, 5.4 for Neptune. Kepler found the exact rule in 1619 — square the length of a planet\'s year and you get the cube of its distance, for every planet, with nothing else needed. Watch the inner ones lap the outer ones. One honest warning: the real spread is 685 to one, and at that ratio a single Neptune orbit would take you a quarter of an hour to sit through. The outer planets here are sped up. Only their order is exact.',
      camera: shot(244, 40, 10.4, 0.13),
      focus: ['Mercury · 88 days', 'Neptune · 164.8 years'],
      onEnter: ({ handles }) => {
        handles.set(state({ slow: 0 }));
        handles.setLabels('kepler');
      },
      timeline: run({ duration: 26000 }),
    },
    {
      id: 'disk',
      heading: '7 · Seen from the side, it nearly vanishes',
      body: 'Turn the system edge-on and it collapses into a line. Every planet orbits within a few degrees of the same plane — Mercury is the worst offender at 7 degrees, Mars sits at 1.9, Neptune at 1.8, and Earth defines zero by convention. That flatness is a fossil. The Sun and its planets condensed out of one collapsing cloud that was already turning, and a turning cloud flattens into a disk long before it makes anything solid. The planets did not settle into a plane; they were built inside one.',
      camera: shot(288, 3.5, 6.4, 0.10),
      focus: ['Mercury · tilted 7.0°', 'Mars · tilted 1.9°'],
      onEnter: ({ handles }) => {
        handles.set(state({}));
        handles.setLabels('disk');
      },
      timeline: run({ duration: 34000 }),
    },
    {
      id: 'wobble',
      heading: '8 · The Sun is orbiting something too',
      body: 'The Sun holds 99.86 percent of the mass here, which makes it nearly the fixed point — but only nearly. Jupiter pulls back on it, and the two of them circle their shared centre of mass. That point sits 742,000 kilometres from the Sun\'s centre: 1.07 solar radii, which puts it about 46,000 kilometres above the surface. So the Sun really does orbit a spot outside itself, once every 11.9 years, at about 12.5 metres a second. Small — and detectable. Watching other stars make that same little circle is how the first generation of exoplanets was found.',
      hint: 'The circle is drawn true against the Sun. Against Jupiter\'s orbit it is a thousand times too big to see at all.',
      camera: shot(322, 28, 4.4, 0.14),
      focus: ['The barycentre', 'Jupiter · the one doing this'],
      onEnter: ({ handles }) => {
        handles.set(state({ wobble: 1, innerOn: 0, beltOn: 0 }));
        handles.setLabels('wobble');
      },
      timeline: run({ duration: 30000 }),
    },
    {
      id: 'flight',
      heading: '9 · And the whole thing is going somewhere',
      body: 'None of this is standing still. The entire system is orbiting the centre of the galaxy at 230 kilometres a second, from 26,000 light years out, one lap every 230 million years — the Sun has been round roughly twenty times since it formed. Add that motion and no planet traces a closed loop: each one draws a helix, stretched out behind it. And it does not fly face-on, the way the popular animation shows it, with the planets trailing after the Sun like a comet\'s tail. The orbital plane is tipped about 60 degrees to the plane of the galaxy, so every planet spends half its year ahead of the Sun and half behind.',
      hint: 'Drag to orbit — the tilt between the two planes is the whole point of this one.',
      camera: shot(372, 22, 10, 0.12),
      freeOrbit: true,
      focus: ['230 km/s through the galaxy', 'Every orbit is really a helix'],
      onEnter: ({ handles }) => {
        handles.set(state({ slow: 0, flight: 1, beltOn: 0, band: 1.35 }));
        handles.setLabels('flight');
      },
      timeline: run({ duration: 26000 }),
    },
  ],
});
