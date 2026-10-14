import { defineExplainer } from '../../framework/index.js';
import { TAU } from '../../framework/motion.js';
import meta from './meta.js';
import { buildSeasons, MILAN_LON } from './model.js';

// Camera bearings around a centre: azimuth 0 looks from +z, 90 from +x (the
// Sun's side in the 'sun' frame). `push` slides the aim left by that fraction
// of the frame width, so the subject sits right of centre — the text panel
// owns the left ~38%.
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

const deg = (x) => (x * Math.PI) / 180;
const MARCH_EQUINOX = 79.4 / 365.25;

// One lap = one year (or a swing either side of a date). The daily spin is a
// whole number of turns per lap and the wind flow a whole number of passes,
// so every loop wraps to an identical pose. `t0` is the date a lap starts on
// (year fraction): the year is periodic, so any start is seamless, and it lets
// a step open on the month its copy (and the video's narration) talks about.
function run({ duration, spins = 0, flowN = 0, hour0 = 0, swing = null, t0 = 0 }) {
  return ({ tl, handles }) => {
    const s = { u: 0 };
    tl.add(s, {
      u: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({
          t: swing ? swing.c + swing.a * Math.sin(TAU * s.u) : t0 + s.u,
          hour: hour0 + TAU * spins * s.u,
          flow: flowN * s.u,
        }),
    });
  };
}

// Every onEnter pins the COMPLETE state, so no step inherits the previous
// step's frame, overlays or mid-lap pose.
const state = (over) => ({
  view: 'globe',
  frame: 'sun',
  t: 0,
  hour: 0,
  lonRef: MILAN_LON,
  tilt: 0,
  flow: 0,
  axis: 1,
  equator: 0,
  cancer: 0,
  capricorn: 0,
  arctic: 0,
  lat45: 0,
  split: 0,
  beam: 0,
  city: 0,
  sub: 0,
  winds: 0,
  monsoonFx: 1,
  clouds: 1,
  ...over,
});

const MONSOON_HOUR = deg(-22); // about 10:30 in the morning over India

export default defineExplainer({
  ...meta,

  // No `dof`: BokehPass keys off the depth buffer and the star dome writes none.
  stageOptions: { space: true },

  buildScene({ scene, stage }) {
    return buildSeasons({ scene, stage });
  },

  steps: [
    {
      id: 'year',
      heading: '1 · A year in thirty seconds',
      body: 'This is one year on Earth, squeezed into thirty seconds. Watch the top of the globe: a white cap of snow spreads south over Canada and Siberia, then shrinks back to Greenland. Watch the middle: a band of cloud drifts north over India and back again, and the land underneath turns green. All of it has one cause, and it is not the Sun coming closer. It is the tilt of the line the planet spins around.',
      hint: "Earth's spin is slowed from 365 turns a year to 12 so you can follow it. Sunlight comes from the right.",
      camera: shot([0, 0, 0], 32, 12, 6.4, 0.17),
      focus: ["Earth's axis · tilted 23.4°"],
      onEnter: ({ handles }) => {
        handles.set(state({}));
        handles.setLabels('hero');
      },
      timeline: run({ duration: 30000, spins: 12 }),
    },
    {
      id: 'orbit',
      heading: '2 · Closest in January',
      body: 'Here is the orbit, seen from outside. It is very nearly a circle: over a year, Earth\'s distance from the Sun only swings between 147.1 and 152.1 million kilometres. The closest point comes on 3 January, in the middle of the northern winter. If distance made the seasons, the whole planet would have summer at the same time, in January. Instead the north freezes while Australia has its summer. Distance changes the sunlight by about 7 percent. The real cause is in the blue sticks around the orbit: every one points the same way.',
      hint: 'Sizes are not to scale. Drawn true, the Sun would be a dot and Earth invisible at this distance. The orbit\'s shape, the dates and the tilt are real.',
      camera: shot([0, 0, 0], -18, 40, 26, 0.2),
      focus: ['Closest · 3 Jan · 147.1 million km', 'Sun'],
      onEnter: ({ handles }) => {
        handles.set(state({ view: 'orbit' }));
        handles.setLabels('orbit');
      },
      timeline: run({ duration: 12000, spins: 4, t0: -0.331 }),
    },
    {
      id: 'lean',
      heading: '3 · A 23.4° lean',
      body: 'Now ride along with Earth, keeping the Sun fixed on the right. The axis is tilted 23.4°, and it keeps aiming at the same point in the sky, near the Pole Star, while Earth goes round. From here that makes the planet seem to nod. In June the north end leans into the sunlight. In December it leans away, and the south gets its turn. The gold dot is the one place where the Sun stands straight overhead at noon. Over the year it walks between the two dashed lines, the Tropics, and never goes past them.',
      camera: shot([0, 0, 0], 35, 10, 6.2, 0.17),
      focus: ['Axis · tilted 23.4°', 'Sun overhead'],
      onEnter: ({ handles }) => {
        handles.set(state({ equator: 1, cancer: 1, capricorn: 1, sub: 1 }));
        handles.setLabels('lean');
      },
      timeline: run({ duration: 24000, spins: 8, t0: 0.137 }),
    },
    {
      id: 'beam',
      heading: '4 · The same sunlight, spread thin',
      body: 'Take one square of sunlight at noon and aim it at 45° north, the latitude of Milan or Minneapolis. In June the Sun stands 68° above the horizon and the beam lands on a tight patch. In December it climbs only 22°, the beam arrives at a slant, and the same light is spread over 2.5 times as much ground. Each square metre gets less of it. That is why winter sunshine feels thin on your face, even at midday.',
      hint: 'Every frame here is noon at 45° N. Only the date changes.',
      camera: shot([1.35, 0.8, 0], 25, 10, 4.0, 0.12),
      focus: ['Noon Sun'],
      onEnter: ({ handles }) => {
        handles.set(state({ lat45: 1, beam: 1, clouds: 0.5 }));
        handles.setLabels('beam');
      },
      timeline: run({ duration: 16000, t0: 0.795 }),
    },
    {
      id: 'day',
      heading: '5 · Long days, short days',
      body: 'The tilt does a second thing. On the 45° north circle, gold is daytime and blue is night. In June the circle is mostly gold: 15 hours 26 minutes of daylight. In December it is mostly blue, 8 hours 34 minutes. Steeper Sun and longer days together mean a square metre at 45° north takes in about four times as much sunlight on a June day as on a December one. Further north it gets extreme. The Arctic Circle is all gold in June and all blue in December: one day the Sun never sets, and six months later it never rises.',
      hint: 'The warmest weeks come a month or more after the longest day. The oceans take that long to warm up, and in autumn they give the heat back slowly.',
      camera: shot([0, 0.3, 0], 18, 36, 6.0, 0.17),
      focus: ['45° N'],
      onEnter: ({ handles }) => {
        handles.set(state({ lat45: 1, arctic: 1, split: 1, city: 1, clouds: 0.7 }));
        handles.setLabels('day');
      },
      timeline: run({ duration: 24000, spins: 16, t0: 0.26 }),
    },
    {
      id: 'equinox',
      heading: '6 · Spring and autumn are the crossings',
      body: 'Twice a year, around 20 March and 22 September, the axis leans neither toward the Sun nor away from it, only sideways. The line between day and night then runs through both poles and cuts every circle of latitude exactly in half. Everywhere on Earth gets 12 hours of day and 12 of night. That is what "equinox" means. The overhead Sun crosses the equator, heading north in March and south in September. Spring and autumn are the weeks around these crossings, when the days lengthen or shorten fastest.',
      hint: 'This loop swings three weeks either side of the March equinox.',
      camera: shot([0, 0, 0], 15, 14, 6.2, 0.17),
      focus: ['Day/night line · through both poles', 'Sun overhead'],
      onEnter: ({ handles }) => {
        handles.set(state({ t: MARCH_EQUINOX, equator: 1, lat45: 1, split: 1, sub: 1 }));
        handles.setLabels('equinox');
      },
      timeline: run({ duration: 14000, spins: 4, swing: { c: MARCH_EQUINOX, a: 0.055 } }),
    },
    {
      id: 'monsoon',
      heading: '7 · The monsoon follows the Sun',
      body: 'In the tropics the Sun is always high, so the seasons that matter are wet and dry. Here is South Asia, held still while the year runs. In May the overhead Sun reaches India. Land heats far faster than the sea, and the hot air over it rises. The belt of rain clouds that circles the tropics follows the heat north, and moist sea air pours in to replace the rising air. Trade winds from south of the equator cross it, Earth\'s spin bends them into south-westerlies, and they arrive soaked. The rains reach Kerala around 1 June and cover the whole country by early July. June to September brings three quarters of India\'s rain for the year. In autumn the Sun moves south and the winds reverse, blowing dry off the land.',
      hint: 'Each frame is the same mid-morning hour; only the date moves. The rain belt and winds are drawn from long-term averages, not one particular year.',
      camera: shot([0, 0, 0], 0, 0, 3.9, 0.17),
      focus: ['Rain belt'],
      onEnter: ({ handles }) => {
        handles.set(
          state({ frame: 'fixed', lonRef: 78, tilt: 18, hour: MONSOON_HOUR, axis: 0, cancer: 1, equator: 1, sub: 1, winds: 1 }),
        );
        handles.setLabels('monsoon');
      },
      timeline: run({ duration: 24000, flowN: 8, hour0: MONSOON_HOUR, t0: 0.18 }),
    },
    {
      id: 'snow',
      heading: '8 · Snow is a long night',
      body: 'Now the top of the world. In December the Sun never rises north of the Arctic Circle, and across the northern continents the days are short and the Sun stays low. Land loses heat into space every night. When the nights win, the air near the ground stays below freezing, and whatever falls from the clouds lands as snow. The snow line creeps south across Siberia and Canada until, by January, about 47 million square kilometres of the north is white. By August the summer Sun has cut that to about 3 million, most of it on Greenland\'s ice. Snow also reflects most of the sunlight that does arrive, which helps the cold hold on.',
      hint: 'Each frame is noon over eastern Europe. The snow line follows long-term averages.',
      camera: shot([0, 0, 0], 0, 0, 5.2, 0.17),
      focus: ['Snow line'],
      onEnter: ({ handles }) => {
        handles.set(state({ frame: 'fixed', lonRef: 25, tilt: 52, axis: 0, arctic: 1, split: 1, clouds: 0.45 }));
        handles.setLabels('snow');
      },
      timeline: run({ duration: 20000, t0: 0.85 }),
    },
    {
      id: 'finale',
      heading: '9 · Not closer. Just leaning.',
      body: 'Put it all back together. Earth is not closer to the Sun in the northern summer. It is actually farther away. It just leans. The lean sets how high the Sun climbs and how long it stays up, and that one dial, turning slowly through the year, makes summer and winter, the equinoxes, the monsoon rains and the snow.',
      hint: 'Drag to look around.',
      camera: shot([0, 0, 0], 40, 16, 6.6, 0.17),
      freeOrbit: true,
      focus: ['One lean · 23.4°'],
      onEnter: ({ handles }) => {
        handles.set(state({}));
        handles.setLabels('finale');
      },
      timeline: run({ duration: 14000, spins: 6, t0: 0.957 }),
    },
  ],
});
