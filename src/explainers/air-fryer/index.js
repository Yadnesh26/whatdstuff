import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildFryer } from './model.js';

// Zoom-in / reveal story: the sealed product, then ghost the body to find that
// the whole cooking system is a coil and a fan, then each of those in turn,
// then the closed air circuit they drive, then a macro insert on a single chip
// for what fast air actually does to a wet surface — and the honest ending,
// that none of this is frying. Re-solidify for a fast free-orbit finale.
//
// Seamless loops: `flow` advances a WHOLE number of cycles per lap and every
// packet's phase is `(flow + seed) % 1` on a CLOSED curve, so the wrap is
// invisible; the packets' azimuth swirl is `flow * TAU`, one whole turn per
// lap. `fanSpin` advances whole turns. `heat` and `filmT` use a raised-cosine
// breathe (0.5 - 0.5*cos(u*TAU)), which starts and ends each lap on the same
// value without needing a modulo. Everything else is pinned per step.

const TAU = Math.PI * 2;
const breathe = (u) => 0.5 - 0.5 * Math.cos(u * TAU);

// Pin ALL scene state on entering a step (pre-flight #4) — reveal, labels, the
// macro insert, AND every pose scalar — so scrolling either way lands the same
// frame under the fixed camera.
const pin =
  ({ labels = false, ...over }) =>
  ({ handles }) => {
    handles.set({
      reveal: 0,
      flow: 0,
      fanSpin: 0,
      heat: 0.85,
      crisp: 0.32,
      macro: 0,
      filmT: 0,
      macroCrisp: 0.2,
      ...over,
    });
    handles.setLabels(labels);
  };

// One LOCAL tween state per step (pre-flight #6) driving one linear lap.
const lap = (duration, drive) =>
  ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.set(drive(s.t)) });
  };

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildFryer({ scene });
  },

  steps: [
    {
      id: 'sealed',
      heading: 'No oil, no flame, no fryer',
      body: 'From the outside it is a matte box with a drawer and a lit panel. There is no oil to pour in, nothing visibly glows, and nothing touches the food. You drop in a handful of chips, push the drawer shut, and fifteen minutes later they come out with a crust on them. Everything responsible for that lives in the head above the drawer.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [2.55, 2.05, 3.15], target: [0, 1.3, 0.05] },
      dofAperture: 0.00003,
      onEnter: pin({ reveal: 0, labels: 'exterior' }),
      timeline: lap(6000, (t) => ({ flow: t, fanSpin: t * TAU * 4 })),
    },
    {
      id: 'inside',
      heading: 'Two parts and a lot of empty space',
      body: 'Ghost the shell and the entire cooking system turns out to be a coil of hot wire and a fan, mounted in the roof above a perforated basket. Below them sits a pot holding about five litres — a tenth of the air inside a full-size oven. That smallness is doing more work than it looks.',
      camera: { position: [3.05, 2.25, 1.55], target: [0, 1.35, 0] },
      dofAperture: 0.00006,
      onEnter: pin({ reveal: 1, labels: 'internal' }),
      timeline: lap(5200, (t) => ({ flow: t, fanSpin: t * TAU * 5 })),
    },
    {
      id: 'element',
      heading: '1,500 watts of hot wire',
      body: 'The heat itself is unremarkable. A nichrome wire inside a steel sheath is bent into a flat spiral under the roof, turning about 1,500 watts of electricity into heat — the same trick a toaster uses. A thermostat probe a few centimetres away cuts it in and out to hold the temperature you dialled in. Left alone, this coil would scorch the top of the food and leave everything under it raw.',
      hint: 'The glow cycling up and down is the thermostat holding 180 °C.',
      camera: { position: [1.62, 1.86, 1.42], target: [0.02, 1.62, 0.02] },
      dofAperture: 0.00014,
      focus: ['Nichrome element — 1,500 W'],
      onEnter: pin({ reveal: 1, labels: 'element', heat: 0.3 }),
      timeline: lap(3600, (t) => ({
        flow: t,
        fanSpin: t * TAU * 5,
        heat: 0.3 + 0.7 * breathe(t),
      })),
    },
    {
      id: 'fan',
      heading: 'The fan is the actual invention',
      body: 'Directly above the coil sits an axial fan turning at 1,200 to 2,000 rpm, which is fast for a kitchen appliance. It drives air down through the element and onto the food at roughly 5 metres a second. A countertop convection oven manages about 0.9. Nothing else in this machine is unusual — that one number is the entire product.',
      // Low enough to read the blades in profile against the coil glow below,
      // instead of looking down at an acre of roof plate
      camera: { position: [1.18, 2.2, 1.12], target: [0, 1.78, 0] },
      dofAperture: 0.00012,
      focus: ['Fan — 1,200–2,000 rpm'],
      onEnter: pin({ reveal: 1, labels: 'fan' }),
      timeline: lap(2800, (t) => ({ flow: t * 2, fanSpin: t * TAU * 10 })),
    },
    {
      id: 'circuit',
      heading: 'The same air, over and over',
      body: 'There is nowhere for that air to escape to. It is pushed down through the coil onto the food, out through the holes in the basket floor, across a star-shaped ridge moulded into the base that throws it back outwards, up the narrow gap between basket and pot, and in through slots in the roof to the fan again. The perforated floor is not a tray with holes in it. It is a duct.',
      hint: 'Packets cool from orange to blue as they hand their heat to the food.',
      // steeper down-angle into the cutaway wedge than the first pass, so the
      // perforated floor this step's copy is built on is actually in frame
      camera: { position: [2.15, 2.15, 2.15], target: [0, 1.02, 0] },
      dofAperture: 0.00008,
      onEnter: pin({ reveal: 1, labels: 'flow' }),
      timeline: lap(4200, (t) => ({ flow: t * 2, fanSpin: t * TAU * 8 })),
    },
    {
      id: 'boundary',
      heading: 'What fast air actually does',
      body: 'Zoom in on one chip. Hot food is always wrapped in a thin skin of its own steam — moisture boiling off the surface and hanging there, insulating it and keeping it wet. Still air lets that skin sit. Air at five metres a second shears it off, and the surface underneath finally gets to dry. Crisping is a drying problem before it is a heating problem.',
      hint: 'The film thickens when the flow eases and is stripped when it picks up.',
      camera: { position: [3.4, 1.88, 1.82], target: [2.05, 1.55, 0.5] },
      dofAperture: 0.00022,
      focus: ['Vapour film'],
      // Sealed, not ghosted: with the machine revealed behind it, its flow
      // packets floated across the insert as loose grey balls and fought the
      // one thing this step is about.
      onEnter: pin({ reveal: 0, labels: 'film', macro: 1, macroCrisp: 0.18 }),
      timeline: lap(5000, (t) => ({
        flow: t * 2,
        fanSpin: t * TAU * 6,
        filmT: breathe(t),
      })),
    },
    {
      id: 'maillard',
      heading: 'And then it browns — but it does not fry',
      body: 'Once the dried surface climbs past about 140 °C, its sugars and amino acids start rearranging into hundreds of new compounds: the Maillard reaction, the same one behind bread crust and a seared steak. That browning is real. The frying is not — hot oil carries heat into food roughly ten times harder than moving air ever can. This is a very small, very fast convection oven with a much better name.',
      camera: { position: [3.15, 1.78, 1.5], target: [2.05, 1.55, 0.5] },
      dofAperture: 0.00028,
      focus: ['Maillard crust'],
      onEnter: pin({ reveal: 0, labels: 'crust', macro: 1, macroCrisp: 0.92, crisp: 0.8 }),
      timeline: lap(4200, (t) => ({ flow: t * 2, fanSpin: t * TAU * 6 })),
    },
    {
      id: 'run',
      heading: 'A coil, a fan, and a box too small to slow down',
      body: 'And that is the whole machine. Fifteen hundred watts of wire, a fan running hard, and a pot small enough that the air it heats never gets a chance to lose its speed before it hits the food again.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [2.75, 2.1, 3.05], target: [0, 1.28, 0.05] },
      dofAperture: 0.00003,
      freeOrbit: true,
      onEnter: pin({ reveal: 0, crisp: 0.85 }),
      timeline: lap(2600, (t) => ({ flow: t * 2, fanSpin: t * TAU * 6 })),
    },
  ],
});
