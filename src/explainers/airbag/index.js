import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildAirbag, monoCubic, MS_START, MS_END } from './model.js';

// Zoom-in / reveal story: the complete rig, the module cut open, the decision,
// the burn, the bag coming out, the landing on a leak, the two stages, then the
// whole crash again.
//
// Every step plays the SAME ~210 ms crash event, time-warped so the part the
// step is about takes most of the lap (a "warp" is a monotone curve from lap
// fraction to milliseconds). Every lap ends with a rewind — the bag and clock
// fade, the rig scrubs back to rest — so the wrap pose is identical.

const U_EVENT = 0.9; // event plays over the first 90% of a lap
const U_FADE = 0.93; // bag + clock fade out
const U_BACK = 0.985; // rig scrubs back to rest, then the clock returns

// lap fraction u -> pose for one event, given the warp (event fraction -> ms)
function eventPose(u, warp, sev) {
  if (u < U_EVENT) return { ms: warp(u / U_EVENT), alpha: 1, sev };
  if (u < U_FADE) return { ms: MS_END, alpha: 1 - (u - U_EVENT) / (U_FADE - U_EVENT), sev };
  if (u < U_BACK) {
    const k = (u - U_FADE) / (U_BACK - U_FADE);
    return { ms: MS_END + (MS_START - MS_END) * k * k * (3 - 2 * k), alpha: 0, sev };
  }
  return { ms: MS_START, alpha: Math.min(1, (u - U_BACK) / (1 - U_BACK)), sev };
}

// warp keys: [[eventFraction, ms], ...] bracketed by (0, MS_START) and (1, MS_END)
const warpOf = (keys) => monoCubic([[0, MS_START], ...keys, [1, MS_END]]);

const lap = (duration, keys, sev = 2) => {
  const warp = warpOf(keys);
  return ({ tl, handles }) => {
    const s = { u: 0 }; // LOCAL state — one tween target per step
    tl.add(s, {
      u: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.set(eventPose(s.u, warp, sev)),
    });
  };
};

// Two crashes in one lap: a mild one (stage 1 only), then a severe one.
const twoCrashes = (duration, split, keysA, keysB) => {
  const wa = warpOf(keysA);
  const wb = warpOf(keysB);
  return ({ tl, handles }) => {
    const s = { u: 0 };
    tl.add(s, {
      u: 1,
      duration,
      ease: 'linear',
      onUpdate: () => {
        const u = s.u;
        handles.set(u < split ? eventPose(u / split, wa, 1) : eventPose((u - split) / (1 - split), wb, 2));
      },
    });
  };
};

// Pin EVERY piece of scene state on entry (rest pose) so scrolling either way
// lands on a consistent frame.
const view =
  (labels, { cut = 0, macro = 0, ghost = 0, sev = 2, barrier = 1, folds = 1, stageText = 0, clockNear = 0 } = {}) =>
  ({ handles }) => {
    handles.set({ ms: MS_START, alpha: 1, sev, cut, macro, ghost, barrier, folds, stageText, clockNear, clock: 1 });
    handles.setLabels(labels);
  };

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildAirbag({ scene });
  },

  steps: [
    {
      id: 'rig',
      heading: '1 · A seam in the steering wheel',
      body: 'Nothing on this wheel looks like a safety device. There is a flat plastic cover in the hub with a seam down the middle, and that is all. Behind it, a bag is folded up. This is a test rig: a wall rushes at the bumper, and a headform stands in for the driver. Watch the clock above the wheel, because the whole crash is slowed down about fifty times.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [1.4, 3.6, 7.6], target: [-1.1, 2.0, 0] },
      focus: ['Airbag cover', 'Tear seam'],
      onEnter: view('exterior'),
      timeline: lap(13000, [[0.265, 0], [0.316, 20], [0.368, 46], [0.436, 62], [0.64, 110]]),
    },
    {
      id: 'inside',
      heading: '2 · A folded bag on a can of propellant',
      body: 'Cut the hub open and the cover turns out to be a lid. Under it, a nylon bag is folded into a steel dish, pleat on pleat. Behind the bag sits the inflator, a steel can the size of a hockey puck. Its two igniters, the squibs, are wired to the car with a yellow cable. That wire is the whole connection between a crash and the bag.',
      camera: { position: [-1.2, 2.3, 3.4], target: [-1.55, 1.96, 0] },
      focus: ['Folded bag', 'Inflator', 'Squib (igniter)'],
      onEnter: view('inside', { cut: 1, barrier: 0, clockNear: 1 }),
      timeline: lap(12000, [[0.5, 19], [0.58, 24], [0.75, 60], [0.86, 110]]),
    },
    {
      id: 'sense',
      heading: '3 · Twenty milliseconds to decide',
      body: 'The wall hits at 0 ms. A sensor in the crumple zone feels the sudden deceleration and sends it down the yellow cable. Meanwhile the control unit has its own accelerometer: a silicon comb whose middle part lags behind the chip, squeezing the gaps in its fingers and changing its capacitance. The unit adds up the slowdown until it crosses a threshold. That takes about 20 ms, and it is the moment it fires.',
      hint: 'The signal is instant in life. It is drawn crossing the cable so you can follow it.',
      camera: { position: [-1.0, 3.3, 8.9], target: [-1.0, 1.1, 0.4] },
      focus: ['Control unit (ACU)', 'Sensing comb'],
      onEnter: view('sense', { macro: 1 }),
      timeline: lap(18000, [[0.105, 0], [0.8, 20], [0.84, 22.5], [0.91, 40], [0.97, 100]]),
    },
    {
      id: 'ignite',
      heading: '4 · A pellet ring turns into gas',
      body: 'The fire signal heats a hair-thin wire in the squib until it lights the first chamber of the inflator. A ring of small propellant pellets burns outward from the igniter, and in a few milliseconds the solid turns into a large volume of hot gas. In the classic design that gas was nitrogen from sodium azide. Most inflators now burn a non-azide fuel such as guanidine nitrate. The gas squeezes through a metal filter to cool it, and out through the ports.',
      camera: { position: [-1.1, 2.25, 2.2], target: [-1.1, 1.96, 0] },
      focus: ['Squib (igniter)', 'Propellant pellets', 'Filter'],
      onEnter: view('ignite', { cut: 1, barrier: 0, folds: 0, clockNear: 1 }),
      timeline: lap(13000, [[0.08, 21], [0.14, 22.5], [0.3, 34], [0.45, 50], [0.8, 100]]),
    },
    {
      id: 'burst',
      heading: '5 · Through the seam',
      body: 'The gas pushes the folded bag into the cover from behind, and the cover splits along its seam into two flaps. The bag unfolds as it fills, at roughly 300 km/h at the front of the gas. About 40 ms after the wall first touches the bumper, it is full, and the headform has not moved yet.',
      camera: { position: [1.9, 3.0, 6.0], target: [-0.5, 2.35, 0] },
      focus: ['Cover flap', 'Bag'],
      onEnter: view('burst', { barrier: 0 }),
      timeline: lap(12000, [[0.2, 24], [0.3, 28], [0.42, 36], [0.52, 40], [0.6, 46], [0.8, 62], [0.9, 100]]),
    },
    {
      id: 'land',
      heading: '6 · Landing on a leak',
      body: 'Two small holes in the back of the bag let the gas out from the moment it fills. So when the headform arrives, around 60 ms, the bag is already going soft. It gives under the load instead of throwing the head back, and the head slows over a longer time. That longer stop is what spares the driver. The bag is not a balloon, it is a brake.',
      hint: 'The bag is a supplement to the seat belt, not a replacement.',
      camera: { position: [2.1, 3.0, 6.2], target: [-0.2, 2.35, 0] },
      focus: ['Vent hole', 'Test headform'],
      onEnter: view('land', { barrier: 0 }),
      timeline: lap(14000, [[0.07, 46], [0.2, 58], [0.6, 130], [0.78, 175]]),
    },
    {
      id: 'stages',
      heading: '7 · Two stages, two sizes of crash',
      body: 'Most modern inflators have two propellant chambers, each with its own squib. On a mild crash only the first one burns, so the bag fills more gently. On a severe crash the control unit fires the second chamber a few milliseconds later and the bag fills harder. Same module, same wheel. The unit decides how much explosion the crash deserves.',
      hint: 'First a mild crash, then a severe one.',
      camera: { position: [-0.85, 2.35, 2.6], target: [-1.15, 2.0, 0] },
      focus: ['Stage 1 chamber', 'Stage 2 chamber'],
      onEnter: view('stages', { cut: 1, barrier: 0, sev: 1, folds: 0, stageText: 1, clockNear: 1 }),
      timeline: twoCrashes(
        12000,
        0.3,
        [[0.12, 21], [0.22, 28], [0.4, 45], [0.7, 100]],
        [[0.03, 21], [0.07, 30], [0.18, 38], [0.4, 52], [0.8, 100]],
      ),
    },
    {
      id: 'run',
      heading: '8 · Over in a tenth of a second',
      body: 'Put it all back together. A wall, a bumper, a wire and a can of powder: decide in about 20 ms, full in about 40, loaded by 60, and already letting go. It can only do this once, so everything has to happen in the right order, and fast.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [4.0, 3.3, 7.4], target: [0.5, 1.9, 0] },
      freeOrbit: true,
      onEnter: view(false),
      timeline: lap(9000, [[0.04, 40], [0.1, 70], [0.2, 110], [0.5, 175]]),
    },
  ],
});
