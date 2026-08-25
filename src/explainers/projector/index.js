import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildProjector } from './model.js';

// Zoom-in / reveal story: the sealed projector, the lid off over the whole
// optical train, the lamp, the colour wheel, then a macro fly-up to the DMD
// for structure → tilt → colour, and back down for the finale.
//
// SEAMLESS LOOPS: every scalar advances a WHOLE number of cycles per lap —
// `spin` and `fan` in whole turns, `wheel` in whole turns (which also wraps
// the six-segment colour sequence, since 6 segments divide one turn exactly),
// and `pwm` in whole 0-1 phases used mod 1. Wrap pose === start pose.

// Pin EVERY scalar on entering a step. Anything left unpinned inherits
// whatever mid-lap phase the previous step happened to be scrolled past at,
// and a fixed camera then frames a pose nobody chose.
const view = ({ reveal = 0, macroOn = 0, mode = 'pwm', channel = -1, compose = false, beam = 1, labels = false }) =>
  ({ handles }) => {
    handles.set({ spin: 0, reveal, macroOn, mode, channel, compose, beam, wheel: 0, fan: 0, pwm: 0 });
    handles.setLabels(labels);
  };

// One linear lap; `f` maps lap fraction → the scalars this step animates.
function loop(duration, f) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL tween target — never shared across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.set(f(s.t)) });
  };
}

const TURNS = (t, n) => t * n * Math.PI * 2;

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildProjector({ scene });
  },

  steps: [
    {
      id: 'product',
      heading: 'A box that throws a picture across a room',
      body: 'It sits on a shelf, hums, gets hot, and puts a two-metre image on your wall. Inside there is no screen and no picture — just a very bright lamp, a spinning disc of coloured glass, and one chip that decides, thousands of times a second, which light gets out through the lens and which light gets thrown away.',
      hint: 'Drag to orbit · scroll to open it up.',
      camera: { position: [3.0, 1.7, 2.6], target: [0.15, 0.75, 0.15] },
      dofAperture: 0.00003,
      focus: ['Projection lens'],
      onEnter: view({ labels: 'exterior' }),
      // A slow ROCK, not a full revolution. This is the only labelled step
      // whose body moves, and its five callouts are anchored to the body — a
      // full turn sweeps them across the whole screen, including through the
      // text panel, where "Lamp door" rendered as "oor". (verify.mjs cannot
      // catch that: its label gate projects the 3D anchor, and here the anchor
      // clears the panel while the leader carries the pill back over it.) A
      // full turn also means the step's composed framing only holds at spin 0.
      // One whole sine cycle per lap, so the wrap pose is still identical.
      timeline: loop(8000, (t) => ({
        // one-sided (0 → +0.34 → 0), not a symmetric sway: rocking the other
        // way swings the lens — the hero of this shot — in behind the panel
        spin: ((1 - Math.cos(t * Math.PI * 2)) / 2) * 0.34,
        wheel: TURNS(t, 8),
        fan: TURNS(t, 16),
        pwm: t * 4,
      })),
    },
    {
      id: 'inside',
      heading: 'Lift the lid',
      body: 'Everything inside is arranged along one folded line of light. It starts at the lamp on the left, runs the width of the case through a glass rod and a spinning colour wheel, bounces off a small mirror, and climbs to a chip the size of a postage stamp at the back. Whatever that chip sends forward goes out through the lens. Whatever it does not goes into a black block and becomes heat.',
      hint: 'One beam, five stops, in a straight line.',
      // 35° above the horizon: the lens barrel sticks straight out the front
      // and buries the whole optical train from any eye-level front angle, so
      // this shot looks OVER it and down into the open case.
      camera: { position: [2.2, 3.1, 2.45], target: [0.0, 0.76, -0.1] },
      dofAperture: 0.00004,
      onEnter: view({ reveal: 1, labels: 'optics' }),
      timeline: loop(6000, (t) => ({
        wheel: TURNS(t, 4),
        fan: TURNS(t, 8),
        pwm: t * 3,
      })),
    },
    {
      id: 'lamp',
      heading: 'The lamp is a controlled lightning strike',
      body: 'Inside that quartz capsule, an electric arc jumps a gap about a millimetre wide through mercury vapour under enormous pressure. It runs at a few thousand degrees and is far too small and far too blotchy to project directly. The reflector behind it scoops that light forward, and the glass rod after it bounces the beam off its own polished walls until the hot spot is smeared into an even rectangle.',
      hint: 'Bright, tiny, and completely the wrong shape — until the rod fixes it.',
      camera: { position: [-0.05, 1.45, 1.7], target: [-0.84, 0.6, -0.02] },
      dofAperture: 0.00016,
      focus: ['Arc gap — about 1 mm'],
      onEnter: view({ reveal: 1, labels: 'lamp' }),
      timeline: loop(4200, (t) => ({
        wheel: TURNS(t, 3),
        fan: TURNS(t, 7),
        pwm: t * 2,
      })),
    },
    {
      id: 'wheel',
      heading: 'Colour arrives one at a time',
      body: 'This disc is not a filter wheel in the photographic sense — each wedge is a dichroic coating that lets one band of light straight through and reflects the rest away. It spins somewhere between 7,200 and 14,400 rpm, two to four times the speed of the video frames. Downstream of it the beam is never white again. It is red, then green, then blue, then red again, thousands of times every second.',
      hint: 'Watch the beam past the wheel change colour, wedge by wedge.',
      camera: { position: [1.0, 2.05, 1.95], target: [-0.22, 0.8, -0.06] },
      dofAperture: 0.00013,
      focus: ['Dichroic filter segments'],
      onEnter: view({ reveal: 1, labels: 'wheel' }),
      timeline: loop(4200, (t) => ({
        wheel: TURNS(t, 1),
        fan: TURNS(t, 7),
        pwm: t * 2,
      })),
    },
    {
      id: 'chip',
      heading: 'Two million mirrors on one chip',
      body: 'This is the DMD, blown up until you can see it. Each square is a single aluminium mirror a fifth the width of a human hair, and there is exactly one of them per pixel on your wall — about two million on a 1080p chip. Each one is slung on a torsion hinge running corner to corner, over its own memory cell in the silicon underneath. The cell holds one bit. That bit is the entire instruction.',
      hint: 'Every square here is one pixel of the picture.',
      camera: { position: [0.42, 2.5, 2.45], target: [0.4, 2.02, 0.18] },
      dofAperture: 0.00022,
      focus: ['One mirror = one pixel'],
      onEnter: view({ reveal: 1, macroOn: 1, mode: 'wave', labels: 'chip' }),
      timeline: loop(5200, (t) => ({
        wheel: TURNS(t, 4),
        fan: TURNS(t, 8),
        pwm: t,
      })),
    },
    {
      id: 'tilt',
      heading: 'Twelve degrees, and nothing in between',
      body: 'A mirror has two positions and no others: tilted −12°, or tilted +12°. The lamp is aimed 24° off the chip, which is exactly twice the tilt — so a mirror at −12° kicks its light straight down the projection lens, and a mirror at +12° throws it 48° sideways into a black finned block that swallows it. That is a bright pixel and a dark pixel. Grey comes from speed: flip the mirror on and off thousands of times inside a single colour flash, and the fraction of time it spent aimed at the lens is the brightness you see.',
      hint: 'Follow one ray — it either reaches the lens or it does not.',
      camera: { position: [0.35, 2.55, 2.78], target: [0.55, 1.94, 0.22] },
      dofAperture: 0.00014,
      focus: ['Light dump — +12° ends here'],
      onEnter: view({ reveal: 1, macroOn: 1, labels: 'tilt' }),
      timeline: loop(4400, (t) => ({
        wheel: TURNS(t, 4),
        fan: TURNS(t, 8),
        pwm: t * 2,
      })),
    },
    {
      id: 'colour',
      heading: 'Your eye does the mixing',
      body: 'Now put the two halves together. While the red wedge is in the beam, the mirrors are drawing only the red part of the picture. A blink later the green wedge arrives and the same mirrors redraw the green part, then the blue. The chip never once shows a full-colour image — it shows three single-colour ones in a row, too fast to separate, and your eye adds them up. Glance quickly across the screen and the fusion breaks for a moment: that flash of red-green-blue fringing is this mechanism showing through.',
      hint: 'Top panel: the picture your eye assembles from the flashes below.',
      camera: { position: [0.45, 2.62, 3.72], target: [0.52, 2.34, 0.32] },
      dofAperture: 0.0001,
      focus: ['What your eye adds up'],
      onEnter: view({ reveal: 1, macroOn: 1, channel: 'auto', compose: true, labels: 'colour' }),
      timeline: loop(4800, (t) => ({
        wheel: TURNS(t, 3),
        fan: TURNS(t, 6),
        pwm: t * 6,
      })),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'Lamp burning, wheel spinning, two million mirrors slamming between two stops faster than any moving part in your house. At any instant the picture on your wall is a single colour, and a large share of the light the lamp made is being deliberately thrown into a black block to make the dark parts dark. A projector spends a great deal of its energy on the pixels you are not meant to see.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [3.2, 1.55, 1.6], target: [0.1, 0.74, 0.05] },
      dofAperture: 0.00003,
      freeOrbit: true,
      onEnter: view({ channel: 'auto', labels: false }),
      timeline: loop(6500, (t) => ({
        spin: TURNS(t, 1),
        wheel: TURNS(t, 13),
        fan: TURNS(t, 26),
        pwm: t * 13,
      })),
    },
  ],
  stageOptions: { dof: true },
});
