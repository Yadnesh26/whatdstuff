import { defineExplainer } from '../../framework/index.js';
import { win } from '../../framework/motion.js';
import meta from './meta.js';
import { buildLogicGates } from './model.js';

// Every loop is one lap of a fixed input sequence, and the sequence wraps to
// its own first row, so the seam is invisible. Inputs are smoothed (a real
// input ramps through the middle voltages), which is what lets the charge
// dots show up at all: in CMOS they move only while an output is switching.

const lerp = (a, b, t) => a + (b - a) * t;

// rows: [[A,B], ...] — u in [0,1) walks the rows, each slot ramping from the
// previous row (wrapping) to its own in the first 30 % of the slot.
function seq(u, rows) {
  const n = rows.length;
  const r = Math.min(n - 1, Math.floor(u * n));
  const f = u * n - r;
  const prev = rows[(r + n - 1) % n];
  const cur = rows[r];
  const k = win(f, 0, 0.3);
  return { A: lerp(prev[0], cur[0], k), B: lerp(prev[1], cur[1], k) };
}

const ALL4 = [[0, 0], [0, 1], [1, 0], [1, 1]];
const A_ONLY = [[0, 0], [1, 0]];

// one linear tween over one lap; `fn(u)` returns the state for that moment
const loop = (duration, fn) => ({ tl, handles }) => {
  const s = { t: 0 };
  tl.add(s, {
    t: 1,
    duration,
    ease: 'linear',
    onUpdate: () => handles.set(fn(Math.min(s.t, 0.99999))),
  });
};

// camera helper: the text panel owns the left ~38%, so targets sit left of the
// subject to push it right
const BOARD_X = 0.225;

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildLogicGates({ scene });
  },

  steps: [
    {
      id: 'chip',
      heading: '1 · A gate is a part you can hold',
      body: "This black 14-pin chip is a 74HC00. Inside are four logic gates, and each one answers a yes-or-no question with voltage. Pin 14 sits at +5 V and pin 7 at 0 V. Watch the glowing pins: when both inputs are high, the output pin drops low.",
      hint: 'Drag to orbit · scroll to look inside.',
      camera: { position: [0.5, 3.1, 4.4], target: [-1.3, 0.3, 0] },
      focus: ['Output'],
      onEnter: ({ handles }) => {
        handles.setView('chip');
        handles.setTable(false);
        handles.setLabels('chip');
      },
      timeline: loop(9000, (u) => ({ ...seq(u, ALL4), flow: 0 })),
    },
    {
      id: 'switch',
      heading: '2 · The atom of logic is a switch that nobody flips',
      body: "Here is one transistor. Put a voltage on its gate plate and an electric field closes the channel beside it, so current flows to the lamp. Take the voltage away and the channel opens. The plate never touches the channel: a voltage is doing the pressing.",
      camera: { position: [0.1, 1.75, 5.2], target: [-0.75, 1.6, 0] },
      focus: ['Gate'],
      onEnter: ({ handles }) => {
        handles.setView('single');
        handles.setTable(false);
        handles.setLabels('single');
      },
      timeline: loop(4800, (u) => ({ ...seq(u, A_ONLY), B: 0, flow: u * 4 })),
    },
    {
      id: 'series',
      heading: '3 · Two switches in a row make AND',
      body: "Wire two of them one after the other and current only reaches the lamp when the first one and the second one are closed. That is AND: both inputs must be 1 before the output is 1. Every other combination leaves the path broken somewhere.",
      camera: { position: [0.1, 1.85, 5.6], target: [-0.6, 1.65, 0] },
      focus: ['Both: AND'],
      onEnter: ({ handles }) => {
        handles.setView('series');
        handles.setTable(false);
        handles.setLabels('series');
      },
      timeline: loop(8000, (u) => ({ ...seq(u, ALL4), flow: u * 6 })),
    },
    {
      id: 'parallel',
      heading: '4 · Two switches side by side make OR',
      body: "Now give the current two routes. Close either switch, or both, and the lamp lights. That is OR. Series and parallel are the only two ways to join switches, so every gate you will ever meet is some mix of these two shapes.",
      camera: { position: [0.1, 1.85, 5.6], target: [-0.6, 1.65, 0] },
      focus: ['Either: OR'],
      onEnter: ({ handles }) => {
        handles.setView('parallel');
        handles.setTable(false);
        handles.setLabels('parallel');
      },
      timeline: loop(8000, (u) => ({ ...seq(u, ALL4), flow: u * 6 })),
    },
    {
      id: 'nand',
      heading: '5 · Two teams, and one is always closed',
      body: "Real gates use two teams. The top team of P-type switches sits in parallel and connects the output up to +VDD. The bottom team of N-type switches sits in series and connects it down to ground. The same inputs drive both, so whenever one team is closed the other is open, and the output is never left floating.",
      hint: 'Charge only moves while the output flips.',
      camera: { position: [0.6, 1.95, 6.2], target: [-0.4, 1.7, 0] },
      focus: ['Pull-up: parallel', 'Pull-down: series'],
      onEnter: ({ handles }) => {
        handles.setView('nand');
        handles.setTable(false);
        handles.setLabels('nand');
      },
      timeline: loop(10000, (u) => ({ ...seq(u, ALL4), flow: u * 12 })),
    },
    {
      id: 'truth',
      heading: '6 · Try every input and write down the answers',
      body: "Step through all four input pairs and the output traces out the NAND truth table. It answers 1 every time except when both inputs are 1, then it answers 0. The gate does not compare or compute anything. Whichever team closes wins the output.",
      camera: { position: [1.3, 1.85, 7.4], target: [0.4, 1.5, 0] },
      focus: ['Output'],
      onEnter: ({ handles }) => {
        handles.setView('nand');
        handles.setTable(true);
        handles.setLabels('sweep');
      },
      timeline: loop(10000, (u) => ({ ...seq(u, ALL4), flow: u * 12 })),
    },
    {
      id: 'universal',
      heading: '7 · One gate is enough to build all the others',
      body: "Tie a NAND's two inputs together and it flips whatever you feed it: that is NOT. Follow a NAND with that NOT and you get AND. NAND alone can rebuild every other gate, which is why a chip maker can lay down billions of the same four-switch cell and get a computer.",
      camera: { position: [0.6, 1.9, 6.2], target: [-0.35, 1.65, 0] },
      focus: ['NOT: tied inputs'],
      onEnter: ({ handles }) => {
        handles.setView('universal');
        handles.setTable(false);
        handles.setLabels('universal');
      },
      timeline: loop(9000, (u) => ({ ...seq(u, ALL4), flow: 0 })),
    },
    {
      id: 'run',
      heading: '8 · Four switches. Multiply by billions.',
      body: "Sealed back up, it is the same chip: pins flickering between +5 V and 0 V as inputs come and go. A modern processor holds tens of billions of these switches, and each one has only two ways to be.",
      hint: 'Drag to orbit while it runs.',
      camera: { position: [1.0, 1.8, 4.8], target: [-1.2, 0.3, 0] },
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.setView('chip');
        handles.setTable(false);
        handles.setLabels(null);
      },
      timeline: loop(4000, (u) => ({ ...seq(u, ALL4), flow: 0 })),
    },
  ],
});
