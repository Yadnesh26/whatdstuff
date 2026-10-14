import { defineExplainer } from '../../framework/index.js';
import { TAU } from '../../framework/motion.js';
import meta from './meta.js';
import { buildAcDc } from './model.js';

// Every loop is one linear tween over a lap that advances WHOLE mains cycles
// (t), whole DC drift cells, and whole fan turns, so every waveform, dot and
// switch state lands exactly where it started.

const loop = (duration, fn) => ({ tl, handles }) => {
  const s = { t: 0 };
  tl.add(s, {
    t: 1,
    duration,
    ease: 'linear',
    onUpdate: () => handles.set(fn(s.t)),
  });
};

const UPS = { view: 'ups', mains: 1 };
const ALL_FLOWS = { rect: true, bus: true, inv: true };

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildAcDc({ scene });
  },

  steps: [
    {
      id: 'ups',
      heading: '1 · AC goes in, AC comes out',
      body: "This box, an online (double-conversion) UPS, sits between a wall socket and a computer, and the lamp beside it is running off its output. Power arrives as AC and leaves as AC. In between, inside the box, all of it is turned into DC and back again. The detour exists because the battery inside can only store DC.",
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [-3.35, 2.54, 6.17], target: [-1.44, 0.57, -0.34] },
      focus: ['AC in from the wall', 'Lamp on the AC output'],
      onEnter: ({ handles }) => {
        handles.setMode({ ...UPS, reveal: 0, caps: 1, inv: 'pwm', screens: [0, 0, 0, 0], flows: {} });
        handles.setLabels('ups');
      },
      timeline: loop(9000, (u) => ({ t: u * 3, fan: u * 3 * TAU })),
    },
    {
      id: 'ac',
      heading: '2 · AC: electrons that go nowhere',
      body: "Here is a magnified, cut-open length of mains wire. The copper atoms stay put. The free electrons swing one way and then the other, 50 times a second, in step with the voltage on the screen. Each one travels only about a micrometre before it turns back. Energy flows down the wire, but the electrons just shuffle in place.",
      hint: 'Hugely magnified, and slowed down about 100×.',
      camera: { position: [1.22, 2.41, 6.11], target: [-1.21, 0.95, 0.27] },
      focus: ['Free electron'],
      onEnter: ({ handles }) => {
        handles.setMode({ view: 'wire', wire: 'ac', drift: 0 });
        handles.setLabels('ac');
      },
      timeline: loop(7000, (u) => ({ t: u * 3, fan: u * 2 * TAU })),
    },
    {
      id: 'dc',
      heading: '3 · DC: the same electrons, one way',
      body: "Connect the same wire to a battery and the swinging stops. The electrons drift steadily in one direction instead, and they are slow: at 10 amps they creep about a fifth of a millimetre per second, under a metre an hour. The flat line on the screen is what DC means: a push that never changes direction.",
      camera: { position: [2.03, 1.93, 5.71], target: [-1.11, 0.9, 0.37] },
      focus: ['Electrons drift one way'],
      onEnter: ({ handles }) => {
        handles.setMode({ view: 'wire', wire: 'dc', t: 0 });
        handles.setLabels('dc');
      },
      timeline: loop(8000, (u) => ({ drift: u, fan: u * 2 * TAU })),
    },
    {
      id: 'map',
      heading: '4 · Inside: two conversions in a row',
      body: "With the cover off, the board reads left to right. Four diodes turn the wall's AC into DC. Two big capacitors, with the battery beside them, hold that DC steady in the middle. Four switches turn it back into AC, and a coil and capacitor smooth it on the way out to the lamp. Each screen shows the voltage at one stage.",
      camera: { position: [0.55, 3.42, 4.59], target: [-1.46, 0.44, 0.32] },
      onEnter: ({ handles }) => {
        handles.setMode({ ...UPS, reveal: 1, caps: 1, inv: 'pwm', screens: [1, 1, 1, 1], flows: ALL_FLOWS });
        handles.setLabels('map');
      },
      timeline: loop(9000, (u) => ({ t: u * 3, fan: u * 3 * TAU })),
    },
    {
      id: 'bridge',
      heading: '5 · Four one-way valves',
      body: "A diode lets current through in only one direction, and four of them make a bridge. On each half of the wave one diagonal pair conducts, D1 with D4 and then D2 with D3. So current on the + rail always flows the same way, even while it reverses in the wires from the wall. With the capacitors lifted out, the screen shows the result: every hump flipped positive, 100 of them a second.",
      camera: { position: [-0.5, 2.49, 2.57], target: [-1.64, 0.69, 0.03] },
      focus: ['D1', 'D4', 'D2', 'D3'],
      onEnter: ({ handles }) => {
        handles.setMode({ ...UPS, reveal: 1, caps: 0, inv: 'pwm', screens: [1, 1, 0, 0], flows: { rect: true, bus: true } });
        handles.setLabels('bridge');
      },
      timeline: loop(8000, (u) => ({ t: u * 3, fan: u * 2 * TAU })),
    },
    {
      id: 'caps',
      heading: '6 · Filling in the gaps',
      body: "Those humps are DC, but lumpy. Put the reservoir capacitors back and they charge in a quick gulp near the top of each hump, then feed the inverter while the wave dips. The bus now sits almost flat, around 320 volts, with a small ripple. The battery charger connects to these same two rails, so a power cut changes nothing downstream.",
      camera: { position: [-0.02, 2.29, 2.53], target: [-1.17, 0.71, 0.03] },
      focus: ['Reservoir capacitors'],
      onEnter: ({ handles }) => {
        handles.setMode({ ...UPS, reveal: 1, caps: 1, inv: 'pwm', screens: [0, 1, 0, 0], flows: { rect: true, bus: true } });
        handles.setLabels('caps');
      },
      timeline: loop(8000, (u) => ({ t: u * 3, fan: u * 2 * TAU })),
    },
    {
      id: 'hbridge',
      heading: '7 · Four switches make it alternate',
      body: "Now DC has to become AC again. Four transistors form an H around the output. Close Q1 and Q4 and current crosses the output one way; open them and close Q3 and Q2, and it crosses the other way. Swap the pairs 50 times a second and you have AC, but only a crude square wave.",
      camera: { position: [1.04, 2.5, 2.64], target: [-0.17, 0.71, 0.08] },
      focus: ['Q1', 'Q4', 'Q3', 'Q2'],
      onEnter: ({ handles }) => {
        handles.setMode({ ...UPS, reveal: 1, caps: 1, inv: 'square', screens: [0, 0, 1, 0], flows: { bus: true, inv: true } });
        handles.setLabels('hbridge');
      },
      timeline: loop(8000, (u) => ({ t: u * 3, fan: u * 2 * TAU })),
    },
    {
      id: 'pwm',
      heading: '8 · Thousands of pulses make a sine',
      body: "For a smooth wave, the controller switches thousands of times a second and varies the width of each pulse: wide near the top of the wave, narrow near zero. The coil resists sudden changes in current and the film capacitor resists sudden changes in voltage, so together they average the pulses into the clean sine on the last screen.",
      hint: 'Real units switch about 20,000 times a second. Shown here as 16 pulses per cycle.',
      camera: { position: [0.86, 2.05, 2.55], target: [-0.14, 0.74, 0.02] },
      focus: ['Coil', 'Film capacitor'],
      onEnter: ({ handles }) => {
        handles.setMode({ ...UPS, reveal: 1, caps: 1, inv: 'pwm', screens: [0, 0, 1, 1], flows: { bus: true, inv: true } });
        handles.setLabels('pwm');
      },
      timeline: loop(10000, (u) => ({ t: u * 2, fan: u * 2 * TAU })),
    },
    {
      id: 'run',
      heading: '9 · Straighten it, store it, shake it back',
      body: "Watch the front panel when the wall power cuts out. The LINE light goes dark and BATTERY comes on. In an online UPS like this one, the lamp never flickers, because the inverter was already running on DC. Now that DC just comes from the battery. Wall power sloshes back and forth, a battery stores it one way, and four diodes and four switches translate between the two.",
      hint: 'Drag to orbit while it runs.',
      camera: { position: [-2.74, 2.34, 6.51], target: [-1.39, 0.59, -0.25] },
      freeOrbit: true,
      focus: ['Status lights'],
      onEnter: ({ handles }) => {
        handles.setMode({ ...UPS, reveal: 0, caps: 1, inv: 'pwm', screens: [0, 0, 0, 0], flows: {} });
        handles.setLabels('ups');
      },
      timeline: loop(9000, (u) => ({ t: u * 6, fan: u * 4 * TAU, mains: u > 0.12 && u < 0.6 ? 0 : 1 })),
    },
  ],
});
