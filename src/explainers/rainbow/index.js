import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildRainbow } from './model.js';

// Every step loops while active. Seamlessness: `fall` counts WHOLE curtain
// heights per lap (each drop lands exactly where its neighbour began, so the
// field is pixel-identical at wrap), `flow` counts whole packet cycles along
// the beam path, and the two scalars that displace the scene — `walk` and
// `sunEl` — run out-and-back cosines that end where they started.

// Camera bearings, not raw vectors. A rainbow has no near side and no far
// side, so distance, height and bearing are the only shot variety available;
// they have to be deliberate or eight steps look like one. The arc runs
// wide-behind -> macro insert -> macro -> macro -> pull back to the cone ->
// tracking along the band -> back to the insert -> wide again.
function shot([tx, ty, tz], azDeg, elDeg, dist, push = 0.15) {
  const a = (azDeg * Math.PI) / 180;
  const e = (elDeg * Math.PI) / 180;
  const d = [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
  // Aim left of the subject so it sits RIGHT of frame centre — the text panel
  // owns the left ~38% of the viewport. Camera-right in world is
  // normalize(cross(worldUp, eye - target)) = (dz, 0, -dx).
  const rx = d[2];
  const rz = -d[0];
  const rl = Math.hypot(rx, rz) || 1;
  const k = (push * dist) / rl;
  return {
    position: [tx + dist * d[0], ty + dist * d[1], tz + dist * d[2]],
    target: [tx - k * rx, ty, tz - k * rz],
  };
}

// The bow lives out in front of the observer, centred low; these are the two
// things worth pointing a camera at.
const DROP = [3.5, 4.15, -1.5];

// The macro inserts get their own shot helper. The drop's ray plane IS the
// world YZ plane, so these cameras sit almost on the -X axis and see the
// traced path face-on; `shift` then slides the subject along the camera's own
// right vector, which is the only offset that behaves the same at every
// bearing (shot()'s generic push does not, and drove the drop under the text
// panel three framing passes running).
function macroShot({ yaw = 0, el = 8, dist = 6, shift = 0, rise = 0 }) {
  const a = ((180 + yaw) * Math.PI) / 180;
  const e = (el * Math.PI) / 180;
  const d = [Math.cos(e) * Math.cos(a), Math.sin(e), Math.cos(e) * Math.sin(a)];
  // camera-right = normalize(cross(forward, worldUp)), forward = -d
  const rx = d[2];
  const rz = -d[0];
  const rl = Math.hypot(rx, rz) || 1;
  return {
    position: [DROP[0] + dist * d[0], DROP[1] + dist * d[1], DROP[2] + dist * d[2]],
    target: [DROP[0] - (rx / rl) * shift, DROP[1] + rise, DROP[2] - (rz / rl) * shift],
  };
}

// Every onEnter pins the COMPLETE state. Anything left unpinned inherits the
// previous step's mid-lap phase and misframes a camera that cannot move.
const POSE = {
  rain: 1,
  bowP: 1,
  bowS: 1,
  macro: 0,
  fanOn: 0,
  splitOn: 0,
  secOn: 0,
  coneOn: 0,
  sampleOn: 0,
  walk: 0,
  sunEl: 10,
  fall: 0,
  flow: 0,
};
const pin = (handles, set, overrides) => {
  handles.setLabels(set);
  handles.set({ ...POSE, ...overrides });
};

// One scalar sweeping 0->1 per lap; everything cyclic is read off it.
function run({ duration, falls = 1, flows = 3, live = {}, extra }) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () =>
        handles.set({
          ...live,
          fall: (s.t * falls) % 1,
          flow: (s.t * flows) % 1,
          ...(extra ? extra(s.t) : null),
        }),
    });
  };
}

// out-and-back, so a displacement can animate inside a seamless lap
const swing = (t) => 0.5 - 0.5 * Math.cos(t * Math.PI * 2);

export default defineExplainer({
  ...meta,

  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildRainbow({ scene });
  },

  steps: [
    {
      id: 'bow',
      heading: 'Nothing is up there',
      body: 'A low sun behind you, a few million falling drops in front of you, and this appears. It has no position — you cannot walk to it, drive under it or photograph it from the side, because there is no it. What you are looking at is a direction: the set of drops that happen to sit at one particular angle from the back of your own head. Everything after this is that angle, taken apart.',
      hint: 'Drag to orbit · scroll to take it apart.',
      camera: shot([0, 2.7, -7.4], 78, 15, 18, 0.08),
      focus: ['Primary bow · 42°'],
      onEnter: ({ handles }) => pin(handles, 'exterior', {}),
      timeline: run({ duration: 9000 }),
    },
    {
      id: 'one-drop',
      heading: 'One drop, three events',
      body: 'Blow one raindrop up about two thousand times and the whole mechanism fits in a single frame. Sunlight bends as it crosses into the water, because light travels slower in water than in air. It crosses the drop, hits the back wall, and most of it leaves — but a slice bounces off the inside of that wall and comes back. Crossing out, it bends a second time. Two bends and one bounce. That is the entire machine.',
      hint: 'A real drop here is about a millimetre across.',
      camera: macroShot({ yaw: 14, el: 16, dist: 5.4, shift: 0.6, rise: -0.15 }),
      dofAperture: 0.00014,
      focus: ['One bounce off the back'],
      onEnter: ({ handles }) => pin(handles, 'drop', { macro: 1, rain: 0.35, bowP: 0, bowS: 0 }),
      timeline: run({ duration: 5200, flows: 3, live: { macro: 1, rain: 0.35, bowP: 0, bowS: 0 } }),
    },
    {
      id: 'pile-up',
      heading: 'Why there is a bow at all',
      body: 'Sunlight does not arrive in one neat ray. It hits every part of the drop face, and each entry point comes back out at its own angle — so why is the sky not just evenly lit? Watch where the exits land. They do not spread out evenly; they crowd against a hard limit and stop. Rays that enter a long way apart come back within a fraction of a degree of each other, and that pile-up is the bright band. Beyond the limit, nothing comes back at all.',
      hint: 'Descartes worked this out in 1637, by tracing rays one at a time.',
      camera: macroShot({ yaw: -6, el: 4, dist: 7.0, shift: 0.62 }),
      dofAperture: 0.00009,
      focus: ['Exits pile up here'],
      onEnter: ({ handles }) =>
        pin(handles, 'fan', { macro: 1, fanOn: 1, rain: 0.35, bowP: 0, bowS: 0 }),
      timeline: run({
        duration: 6000,
        live: { macro: 1, fanOn: 1, rain: 0.35, bowP: 0, bowS: 0 },
      }),
    },
    {
      id: 'colour',
      heading: 'One per cent of difference',
      body: 'Water bends violet light slightly harder than red: an index of 1.343 against 1.331, a difference of about one per cent. That one per cent gives every colour its own limiting angle — red piles up at 42.4°, violet at 40.7° — and the 1.7° between them is the entire width of a rainbow. It also means a single drop can only ever send you ONE colour. The red you see and the violet you see are coming from different drops, metres apart.',
      camera: macroShot({ yaw: 8, el: 8, dist: 8.8, shift: 0, rise: 0.35 }),
      dofAperture: 0.00009,
      focus: ['Red · 42.4°'],
      onEnter: ({ handles }) =>
        pin(handles, 'split', { macro: 1, splitOn: 1, rain: 0.35, bowP: 0, bowS: 0 }),
      timeline: run({
        duration: 5200,
        live: { macro: 1, splitOn: 1, rain: 0.35, bowP: 0, bowS: 0 },
      }),
    },
    {
      id: 'cone',
      heading: 'An angle, spun around',
      body: 'Now put that angle back in the sky. Draw a line from the sun, through your head, and out the other side — it points at a spot called the antisolar point, always exactly opposite the sun, and on a sunny day your own shadow is standing on it. Any drop lying 42° off that line sends you colour. Spin 42° all the way around the line and you sweep out a cone with your eye at the tip. The bow is a circle because a cone is; you only see an arc because the ground cuts the bottom off.',
      hint: 'From a plane, with no ground in the way, rainbows really are full circles.',
      camera: shot([0, 2.4, -5.8], 62, 26, 17, 0.1),
      focus: ['Antisolar point · your shadow'],
      onEnter: ({ handles }) => pin(handles, 'cone', { coneOn: 1, sampleOn: 1, bowS: 0.4 }),
      timeline: run({ duration: 7000, live: { coneOn: 1, sampleOn: 1, bowS: 0.4 } }),
    },
    {
      id: 'yours',
      heading: 'Your rainbow, not anyone else’s',
      body: 'The drops are pouring straight down through the band, and they do not stay any colour for long: a drop is red for an instant, then orange, then green, then it has fallen out of the angle and gone dark. The band itself never moves, because it was never made of those drops — it is made of the angle. Step forward and the whole cone steps with you, built out of drops that were dark a second ago. Your left eye and your right eye are not even using the same water.',
      hint: 'Which is why a rainbow gets no closer, ever.',
      camera: shot([0, 2.6, -6.6], 86, 15, 15, 0.09),
      focus: ['Drops fall through the colours'],
      onEnter: ({ handles }) => pin(handles, 'fall', { bowS: 0.5, coneOn: 0.55 }),
      timeline: run({
        duration: 7600,
        falls: 2,
        live: { bowS: 0.5, coneOn: 0.55 },
        extra: (t) => ({ walk: swing(t) }),
      }),
    },
    {
      id: 'twice',
      heading: 'The one that bounced twice',
      body: 'Go back inside the drop. At the back wall, most of the light leaves and a slice bounces — and at the second wall, the same thing happens again. A thinner slice bounces a second time before it finally escapes. Two bounces send it out at a wider angle and in the opposite order, and far less of it survives the extra trip. This is a much rarer path than the one you just watched, which is exactly why the bow it makes is the faint one.',
      camera: macroShot({ yaw: -12, el: 14, dist: 5.8, shift: 0.52, rise: 0.1 }),
      dofAperture: 0.00012,
      focus: ['Bounce two'],
      onEnter: ({ handles }) =>
        pin(handles, 'second', { macro: 1, secOn: 1, rain: 0.35, bowP: 0, bowS: 0 }),
      timeline: run({
        duration: 5600,
        live: { macro: 1, secOn: 1, rain: 0.35, bowP: 0, bowS: 0 },
      }),
    },
    {
      id: 'gap',
      heading: 'And the sky it leaves dark',
      body: 'Put that path back in the sky and you get the second bow: 50° for red, nearly 54° for violet, sitting outside the first with its spectrum reversed — red on the inside now. Then look between the two. That stripe of sky is visibly darker than the sky on either side, and it has to be: no drop anywhere can return light into the gap between 42° and 50°. It is the one part of a rainbow that is made of nothing, and it has been called Alexander’s dark band since about 200 AD.',
      hint: 'Once you have seen it you cannot unsee it in a photograph.',
      camera: shot([0, 3.2, -7.6], 118, 16, 17.5, 0.08),
      focus: ['Alexander’s dark band'],
      onEnter: ({ handles }) => pin(handles, 'gap', { bowS: 1 }),
      timeline: run({ duration: 6400 }),
    },
    {
      id: 'sun',
      heading: 'Then the sun gets too high',
      body: 'The cone points away from the sun, so the higher the sun climbs, the further the cone tips into the ground — and once the sun passes 42°, the whole thing is underground and there is nothing left above the horizon to see. That is why rainbows are a morning and evening animal, and why you will wait a long time for one at noon in the tropics. It was never in the sky. It was aimed at you, and you just walked out of it.',
      hint: 'Drag to orbit while it runs.',
      camera: shot([0, 1.6, -7.2], 96, 14, 15, 0.09),
      freeOrbit: true,
      focus: ['Primary bow · 42°'],
      onEnter: ({ handles }) => pin(handles, 'exterior', {}),
      timeline: run({
        duration: 7200,
        falls: 2,
        live: {},
        extra: (t) => ({ sunEl: 10 + 38 * swing(t) }),
      }),
    },
  ],
});
