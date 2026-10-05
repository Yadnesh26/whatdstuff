import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildRiscVsCisc } from './model.js';

// Every loop is one lap of `u` (0 -> 1) and every view is periodic in it:
// the ribbons advance exactly one program per lap (20 x86 bytes, 32 ARM
// bytes), the decode and micro-op laps end parked where they began, and the
// chip turntable turns one whole revolution. Nothing may end mid-cycle.

const lap = (duration, key = 'u', scale = 1) => ({ tl, handles }) => {
  const s = { t: 0 };
  tl.add(s, {
    t: 1,
    duration,
    ease: 'linear',
    onUpdate: () => handles.set({ [key]: Math.min(s.t, 0.99999) * scale }),
  });
};
const TURN = Math.PI * 2;

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildRiscVsCisc({ scene });
  },

  steps: [
    {
      id: 'chips',
      heading: '1 · Two chips, two vocabularies',
      body: "The processor in most Windows laptops and the one in your phone both run programs, but they don't understand the same instructions. Each chip reads a fixed vocabulary of commands called its instruction set. The laptop's is x86, a CISC design (complex instruction set computer) whose family tree goes back to Intel's 8086 of 1978. The phone's is ARM, a RISC design (reduced instruction set computer). Here is what that difference actually looks like.",
      hint: 'Drag to orbit · scroll to read the instructions.',
      camera: { position: [3, 2.1, 6.18], target: [-1.56, 0.05, 0.29] },
      focus: ['CISC: x86-64', 'RISC: ARM64'],
      onEnter: ({ handles }) => {
        handles.setView('chips');
        handles.setLabels('chips');
        handles.set({ spin: 0, u: 0, lid: 0 });
      },
      timeline: lap(10000, 'spin', TURN),
    },
    {
      id: 'tape',
      heading: '2 · An instruction is a row of bytes',
      body: 'A program sits in memory as a ribbon of bytes, read in order. Both ribbons here hold the same little counting loop. Each x86 instruction is as long as it needs to be: 1, 2, 3 or 6 bytes in this loop, and up to 15 in general. Every ARM instruction is exactly 4 bytes. The x86 version fits in 20 bytes and the ARM version needs 32, so the ARM ribbon has to run faster to deliver the same program. Packing code tightly was what CISC was for, back when memory was the expensive part.',
      camera: { position: [1.01, 4.72, 5.62], target: [-0.38, 0.04, -0.05] },
      focus: ['x86: 1 to 15 bytes each', 'ARM: always 4 bytes'],
      onEnter: ({ handles }) => {
        handles.setView('tape');
        handles.setLabels('tape');
        handles.set({ u: 0 });
      },
      timeline: lap(9000),
    },
    {
      id: 'job',
      heading: '3 · Same job, two scripts',
      body: "Take one line of that loop: add a register into a number kept in memory. x86 does it with a single instruction, add [x], eax. The chip fetches x, adds, and writes the answer back, all on one order. ARM has no instruction that does arithmetic on memory, so it spells the job out in three: load x into a register, add, store it back. The work is the same, one read, one add, one write, and it takes about the same time.",
      camera: { position: [-0.24, 5.99, 7.14], target: [-1.94, 0.25, 0.18] },
      focus: ['x86: one instruction', 'ARM: load, add, store'],
      onEnter: ({ handles }) => {
        handles.setView('job');
        handles.setLabels('job');
        handles.set({ u: 0 });
      },
      timeline: lap(8000),
    },
    {
      id: 'regs',
      heading: '4 · Why RISC carries more registers',
      body: "Now watch which parts touch memory. On the ARM side only the load and the store ever reach it, and the adder works on registers alone. That rule is called load/store, and it keeps every instruction simple. But values need somewhere to wait between steps, so RISC designs carry more registers: 31 general-purpose ones on ARM64, against 16 on x86-64. Registers are the fastest storage a chip has, a few dozen slots right next to the adder.",
      camera: { position: [1.71, 3.99, 4.65], target: [-0.36, 0.05, 0.41] },
      dofAperture: 0.00008,
      focus: ['16 registers', '31 registers'],
      onEnter: ({ handles }) => {
        handles.setView('job');
        handles.setLabels('regs');
        handles.set({ u: 0 });
      },
      timeline: lap(8000),
    },
    {
      id: 'decode',
      heading: '5 · The front door',
      body: "Before a chip can run an instruction it has to decode it, and this is where the fixed size pays off. Every ARM instruction is 4 bytes, so the chip knows where the next eight begin without reading any of them, and eight decoders take eight instructions at once. Apple's M1 does exactly this. An x86 chip has to read the first byte or two of each instruction to learn its length before it can find where the next one starts. Real x86 chips add extra circuitry to guess those boundaries in parallel, and that circuitry costs power.",
      camera: { position: [-0.34, 5.77, 7.07], target: [-2.08, 0.2, 0.1] },
      focus: ['8 decoders, all at once', 'Reads each length first'],
      onEnter: ({ handles }) => {
        handles.setView('decode');
        handles.setLabels('decode');
        handles.set({ u: 0 });
      },
      timeline: lap(10000),
    },
    {
      id: 'uops',
      heading: '6 · The twist: x86 is RISC inside',
      body: "Since the Pentium Pro in 1995, x86 chips haven't run their own instructions directly. The decoder cracks each one into micro-ops, small fixed-format operations. Feed it the 6-byte add [x], eax and out come a load, an add and a store, the same three steps the ARM program spelled out. Line them up against the ARM instructions below and they match one for one. Everything behind the decoder is a RISC-style engine; the CISC part ends at the front door.",
      camera: { position: [0.33, 5.26, 6.93], target: [-1.89, 0.17, 0.3] },
      focus: ['Micro-ops: load, add, store', 'x86 decoder'],
      onEnter: ({ handles }) => {
        handles.setView('uops');
        handles.setLabels('uops');
        handles.set({ u: 0 });
      },
      timeline: lap(10000),
    },
    {
      id: 'run',
      heading: '7 · Complex outside. Simple inside.',
      body: "Lift the lids and the old war turns out to have ended in a draw. Both chips run their work on a RISC-style core. The difference is the strip in front of it. The x86 chip carries a bigger decoder, because decades of software depend on its vocabulary and every instruction has to be translated on the way in. ARM needs far less translating, which saves some transistors and power. That helps battery life, but less than people think: how well a chip is built matters far more than which instruction set it speaks.",
      hint: 'Drag to orbit.',
      focus: ['x86 decoder: translates', 'ARM decoder: simpler'],
      camera: { position: [3.25, 2.55, 5.66], target: [-1.46, 0.19, 0.22] },
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.setView('chips');
        handles.setLabels('inside');
        handles.set({ spin: 0, u: 0, lid: 1 });
      },
      // lids off: a gentle sway (one whole cycle per lap) keeps the dies facing
      // the camera, instead of the opening's full turn
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7000,
          ease: 'linear',
          onUpdate: () => {
            const u = Math.min(s.t, 0.99999);
            handles.set({ u, spin: Math.sin(u * Math.PI * 2) * 0.3 });
          },
        });
      },
    },
  ],
});
