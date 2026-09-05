import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildWaterHeater } from './model.js';

// Zoom-in / reveal story: the sealed product on its plinth, then the wall
// sandwich, then the dip tube that makes two top fittings work, then the
// surprise the whole page is built on — the tank is layered, not mixed — then
// the two elements that are wired so they can never both be live, the
// thermostat that never touches the water, and the rod that dies so the tank
// doesn't. Re-solidify for a fast free-orbit finale.
//
// Seamless loops: `flow` advances a WHOLE number of cycles per lap and every
// packet's phase is `(flow + seed) % 1` along one continuous path, so the wrap
// is invisible; the ion stream rides `flow * 3`, also whole. `spin` advances
// whole turns. `thermo` and the element glows use either a raised-cosine
// breathe (0.5 - 0.5*cos(u*TAU)) or a rise/fall pair of smoothstep windows
// that both read 0 at u = 0 and u = 1 — no modulo needed, identical wrap pose.

const TAU = Math.PI * 2;
const breathe = (u) => 0.5 - 0.5 * Math.cos(u * TAU);
const clamp01 = (v) => Math.min(1, Math.max(0, v));
const smooth = (v) => {
  const x = clamp01(v);
  return x * x * (3 - 2 * x);
};
// on at `a`, fully on by `b`, off again between `c` and `d` — 0 at both ends
// of the lap, which is the entire seamlessness contract for a duty cycle
const duty = (u, a, b, c, d) => clamp01(smooth((u - a) / (b - a)) - smooth((u - c) / (d - c)));

// Pin ALL scene state on entering a step (pre-flight #4) — reveal, labels AND
// every pose scalar, including the turntable — so scrolling either way lands
// the same frame under the fixed camera.
const pin =
  ({ labels = false, ...over }) =>
  ({ handles }) => {
    handles.set({
      reveal: 1,
      spin: 0,
      flow: 0,
      thermo: 0,
      upperHeat: 0,
      lowerHeat: 0,
      anodeWear: 0,
      sediment: 0,
      ions: 0,
      ...over,
    });
    handles.setLabels(labels);
  };

// One LOCAL tween state per step timeline (pre-flight #6) driving one linear lap.
const lap = (duration, drive) =>
  ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.set(drive(s.t)) });
  };

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildWaterHeater({ scene });
  },

  steps: [
    {
      id: 'sealed',
      heading: 'A barrel of hot water, waiting all day',
      body: 'Two pipes on top, a valve on the flank, two little panels screwed to the front. That is the whole of it from outside — no flame, no vent, no moving part you could point at. Everything that makes it work is sealed inside a steel bottle you are not meant to open, and it has been holding 150 litres at 60 °C since the last time anyone in the house wanted a shower.',
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [-3.22, 2.5, 3.42], target: [-0.35, 1.55, 0] },
      dofAperture: 0.00003,
      onEnter: pin({ reveal: 0, labels: 'exterior' }),
      // A slow ROCK, not a full turntable: a whole revolution swings the
      // panels, valve and drain this step names round behind the tank for half
      // the lap. sin returns to 0 at both ends, so the wrap is exact.
      timeline: lap(9000, (t) => ({ flow: t, spin: 0.18 * Math.sin(t * TAU) })),
    },
    {
      id: 'inside',
      heading: 'A steel bottle in a foam coat',
      body: 'Cut the jacket away and the wall turns out to be three layers. Painted sheet steel on the outside, holding nothing but its shape. Then 25 to 50 mm of rigid foam. Then the tank that actually does the work: welded steel with a layer of glass fused to the inside of it, because steel is strong but rusts and glass does not rust but cracks. Bonded together they can hold hot, oxygen-rich water for a decade.',
      hint: 'The foam is why it still costs about a kilowatt-hour a day to own, even untouched.',
      camera: { position: [-2.33, 3.0, 3.58], target: [-0.3, 1.6, 0.05] },
      dofAperture: 0.00006,
      focus: ['Foam insulation'],
      onEnter: pin({ labels: 'tank', thermo: 0.12 }),
      timeline: lap(7000, (t) => ({
        flow: t,
        thermo: 0.1 + 0.06 * breathe(t),
        lowerHeat: duty(t, 0.42, 0.52, 0.86, 0.98),
      })),
    },
    {
      id: 'diptube',
      heading: 'The cold water is sent to the floor',
      body: 'Both pipes come out of the top, which looks like a mistake: cold arriving a hand-width from where hot leaves. A plastic dip tube fixes it. It hangs off the cold inlet almost to the bottom of the tank, so incoming cold is dumped at the floor while hot is skimmed off the very top. Every drop that enters has to cross the whole tank before it can leave.',
      camera: { position: [-0.65, 1.9, 3.57], target: [-0.28, 1.6, 0.08] },
      dofAperture: 0.0001,
      focus: ['Dip tube'],
      onEnter: pin({ labels: 'dip', thermo: 0.22 }),
      timeline: lap(4600, (t) => ({ flow: t * 2, thermo: 0.22 + 0.16 * breathe(t) })),
    },
    {
      id: 'stratified',
      heading: 'The tank is layered, not mixed',
      body: 'Hot water is about 1.6 % lighter than cold at these temperatures. It is not much, but buoyancy does not need much: the hot floats, the cold sits under it, and the boundary between them stays thin — centimetres, not a gentle gradient. Draw a shower and that line climbs. Everything above it is still at full temperature, which is why the water stays perfect right up until the moment the line reaches the outlet and the shower goes cold in about ten seconds.',
      hint: 'Watch the boundary climb as hot is drawn, then sink as the element catches up.',
      camera: { position: [-1.78, 2.35, 3.43], target: [-0.28, 1.6, 0.05] },
      dofAperture: 0.00012,
      focus: ['Thermocline'],
      onEnter: pin({ labels: 'strat' }),
      timeline: lap(6400, (t) => ({
        flow: t * 2,
        thermo: 0.9 * breathe(t),
        lowerHeat: duty(t, 0.5, 0.62, 0.9, 1),
      })),
    },
    {
      id: 'elements',
      heading: 'Two elements, and they never run together',
      body: 'Each is a loop of resistance wire in a copper sheath, screwed straight through the tank wall so it sits in the water: 4,500 watts apiece. On a cold tank the upper one fires first, because heating the top third is the fastest route to one hot shower. Only once that top is up to temperature does power hand down to the lower element for the rest. The switch is built so both can never be live at once — the whole machine draws 4,500 watts, not 9,000, and refills with hot at about 80 litres an hour.',
      camera: { position: [0.25, 1.72, 2.55], target: [-0.43, 1.3, 0.18] },
      dofAperture: 0.00016,
      focus: ['Upper element — 4,500 W'],
      onEnter: pin({ labels: 'elements', thermo: 0.62 }),
      timeline: lap(5200, (t) => ({
        flow: t,
        thermo: 0.66 - 0.12 * breathe(t),
        upperHeat: duty(t, 0.04, 0.12, 0.42, 0.5),
        lowerHeat: duty(t, 0.54, 0.62, 0.92, 1),
      })),
    },
    {
      id: 'thermostat',
      heading: 'The thermostat never touches the water',
      body: 'Both thermostats clip to the outside of the tank wall, behind those access panels, pressed flat against bare steel — they read the water through it. Inside each is a bimetal disc that bends as it warms and snaps its contacts open at the temperature you dialled in. Behind the upper one sits a second disc you cannot adjust: the energy cut-off, which trips near 85 °C and stays tripped until somebody pushes the red button.',
      hint: 'That red button is the last thing between a welded contact and a tank above boiling point.',
      camera: { position: [-1.02, 1.85, 2.08], target: [-0.54, 1.52, 0.17] },
      dofAperture: 0.0002,
      focus: ['Upper thermostat'],
      onEnter: pin({ labels: 'thermostat', thermo: 0.35 }),
      timeline: lap(4800, (t) => ({
        flow: t,
        thermo: 0.35 - 0.06 * breathe(t),
        upperHeat: duty(t, 0.06, 0.16, 0.55, 0.68),
      })),
    },
    {
      id: 'anode',
      heading: 'The rod that dies so the tank does not',
      body: 'The glass lining is never perfect — there are pinholes in it, and bare steel at the weld seams. So a magnesium rod hangs down inside every one of these tanks. Magnesium gives up electrons far more readily than steel, so in the water it corrodes and the exposed steel does not. It is meant to be eaten; when it is gone, the tank is next. Meanwhile the minerals that fall out of heated water settle on the floor beneath the lower element as a crust, and the rumbling you hear at night is water trapped under it flashing to steam.',
      camera: { position: [-0.97, 2.2, 3.47], target: [-0.25, 1.55, 0.08] },
      dofAperture: 0.00014,
      focus: ['Magnesium anode rod'],
      onEnter: pin({ labels: 'anode', thermo: 0.2, anodeWear: 1, sediment: 1, ions: 1 }),
      timeline: lap(5600, (t) => ({ flow: t, thermo: 0.2 + 0.05 * breathe(t) })),
    },
    {
      id: 'run',
      heading: 'A bottle that spends its life defending a temperature',
      body: 'Cold in at the floor, hot off the top, a thin line between them that climbs when you draw and sinks when the elements catch up. No flame, no pump, nothing clever. Just a very well insulated tank, two wires, and a rod quietly corroding on your behalf.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [-3.6, 2.35, 3.14], target: [-0.35, 1.5, 0] },
      dofAperture: 0.00003,
      freeOrbit: true,
      onEnter: pin({ reveal: 0 }),
      timeline: lap(3400, (t) => ({ spin: t * TAU, flow: t * 2 })),
    },
  ],
});
