import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildGpu } from './model.js';

// Every step loops while active. Seamlessness rule: each lap advances the
// scalars a WHOLE number of cycles — `spin` and `fan` whole turns, `vrm` /
// `smPulse` / `flow` whole laps, `pipe` whole pipeline cycles, `simt` one whole
// lockstep-then-diverge cycle, `sched` exactly one pass through its seven warp
// slots. Nothing here may leave a scalar mid-cycle at the wrap.
//
// Two counts matter for the motion probes: the fans have NINE identical blades,
// so a lap must not advance them a whole number of blade pitches (7 turns is
// safe — a 0.3-lap offset lands 0.1 of a turn on, which is not a multiple of
// 1/9), and the scheduler cycles SEVEN slots, odd so the half-lap is not a
// permutation of the sequence onto itself.

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildGpu({ scene });
  },

  steps: [
    {
      id: 'card',
      heading: '1 · Two kilos to cool a fingernail',
      body: 'A high-end graphics card is 330 millimetres long, three expansion slots thick, and heavy enough that most people prop it up with a strut so it does not sag in the case — over two kilos of it. Almost none of that is the computer. Three 100 mm fans, a plastic shroud and a metal backplate are wrapped around a block of aluminium whose only job is to carry heat away from one square of silicon smaller than a postage stamp. The card pulls 450 watts, and every one of them leaves again as warm air.',
      hint: 'Drag to orbit · scroll to go inside.',
      camera: { position: [3.18, 2.347, 5.2], target: [-0.84, 0.297, 0.97] },
      focus: ['Three 100 mm fans'],
      onEnter: ({ handles }) => {
        handles.setView('card');
        handles.setLabels('card');
        handles.set({
          // Held still, not swung. The card sits at the exact angle this step's
          // camera was framed for; the fans supply the motion. A back-and-forth
          // turntable on a whole graphics card reads as a wobble, not a machine.
          spin: 0.52,
          lift: 0,
          smMode: 'idle',
          vrm: 0,
          pipe: 0,
          simt: 0,
          sched: 0,
          flow: 0,
        });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 8000,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              fan: s.t * Math.PI * 2 * 7,
              smPulse: s.t * 3,
            }),
        });
      },
    },
    {
      id: 'cooler',
      heading: '2 · Lift the cooler off',
      body: 'Take the shroud and the fans away and the reason for all that mass appears. The fans blow straight down through 96 aluminium fins packed three millimetres apart, threaded by six copper heatpipes, and those fins stand on a vapour chamber — a sealed plate with a little fluid sealed inside that boils where the chip is and condenses at the cool end, moving heat sideways far faster than solid metal could. On its underside a raised pad presses onto the chip itself. Nothing is in the way: unlike a processor, a graphics chip has no metal lid, and the cooler lands on naked silicon.',
      camera: { position: [3.67, 1.635, 4.45], target: [-0.66, 0.705, 0.85] },
      focus: ['The bare die', 'Copper vapour chamber'],
      onEnter: ({ handles }) => {
        handles.setView('card');
        handles.setLabels('exploded');
        handles.set({
          spin: 0.43,
          lift: 1,
          smMode: 'idle',
          vrm: 0,
          pipe: 0,
          simt: 0,
          sched: 0,
          flow: 0,
        });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7000,
          ease: 'linear',
          // the fans coast rather than run — the cooler is off the card
          onUpdate: () =>
            handles.set({
              fan: s.t * Math.PI * 2 * 2,
              smPulse: s.t * 3,
            }),
        });
      },
    },
    {
      id: 'board',
      heading: '3 · The board underneath',
      body: 'The board itself is barely two-thirds the length of the cooler hanging off it. In the middle sits the processor: a green package carrying one uncovered rectangle of silicon, 24.7 millimetres on a side. Ringed around it are twelve memory chips of 2 GB each. Along the far edge, twenty-three power stages take twelve volts from that single sixteen-pin plug and step it down to about one — because at one volt, this much power means more than three hundred amps, and no single stage could carry it.',
      camera: { position: [1.1, 1.315, 1.71], target: [-0.55, 0.065, -0.05] },
      dofAperture: 0.00014,
      focus: ['The die — 24.7 mm square', '23 power phases'],
      onEnter: ({ handles }) => {
        handles.setView('board');
        handles.setLabels('board');
        handles.set({
          spin: 0.12,
          lift: 1,
          smMode: 'idle',
          pipe: 0,
          simt: 0,
          sched: 0,
          flow: 0,
        });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6000,
          ease: 'linear',
          // A bare powered board has nothing on it that physically moves, so
          // this step is deliberately still: the only things running are the
          // phase lights marching round the VRM and the activity on the die,
          // both emissive. Note that verify.mjs's motion gate does NOT flag it
          // — but only because the hidden inserts are still being posed off
          // screen, so its pass says nothing about this step. The justification
          // for holding the board still is the one above, not that gate.
          onUpdate: () =>
            handles.set({
              vrm: s.t * 2,
              smPulse: s.t * 3,
            }),
        });
      },
    },
    {
      id: 'pipeline',
      heading: '4 · What all of it is actually for',
      body: 'Here is the job the whole machine is shaped around. A 3D scene is millions of triangles. For each one the card takes its three corners and works out where they land on your screen; then it asks which pixels that triangle covers; then it runs a small program — once — for every single covered pixel, to decide what colour it should be. At 4K there are 8.3 million pixels in a frame. And the important part is the last one: no pixel needs to know what its neighbour came out as. All of them can be worked out at the same instant.',
      camera: { position: [0.9, 1.965, 3.15], target: [-0.5, 1.685, 0] },
      dofAperture: 0.00006,
      focus: ['One shader run per pixel'],
      onEnter: ({ handles }) => {
        handles.setView('pipe');
        handles.setLabels('pipe');
        handles.set({
          spin: 0,
          fan: 0,
          lift: 1,
          smMode: 'idle',
          vrm: 0,
          simt: 0,
          sched: 0,
          flow: 0,
          smPulse: 0,
        });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5600,
          ease: 'linear',
          onUpdate: () => handles.set({ pipe: s.t }),
        });
      },
    },
    {
      id: 'floorplan',
      heading: '5 · So you build a field of small cores',
      body: 'Which is why this chip looks nothing like a processor. Instead of eight large cores it carries 144 identical tiles, called streaming multiprocessors, arranged in twelve groups of twelve, with a 96 MB band of shared L2 cache running between the rows and twelve memory controllers along the rims. A CPU core is built to finish one difficult job as quickly as anything can. These are built to be numerous. Not all of them survive: on a die this big some tiles always come out flawed, so the finished card ships with 128 of the 144 switched on — and 72 of those 96 megabytes.',
      camera: { position: [0.72, 2.025, 4.04], target: [-0.71, 1.495, 0.28] },
      dofAperture: 0.00006,
      focus: ['One SM — 144 on this die', 'L2 cache — 96 MB'],
      onEnter: ({ handles }) => {
        handles.setView('die');
        handles.setLabels('die');
        handles.set({
          spin: 0,
          fan: 0,
          lift: 1,
          smMode: 'idle',
          vrm: 0,
          pipe: 0,
          simt: 0,
          sched: 0,
          flow: 0,
        });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () => handles.set({ smPulse: s.t * 3 }),
        });
      },
    },
    {
      id: 'sm',
      heading: '6 · Inside one tile',
      body: 'Blow a single one of those tiles up and it is a small machine in its own right. 128 arithmetic lanes, divided into four blocks of 32, each block with its own scheduler feeding it instructions. Along the bottom, 128 KB of fast memory the whole tile shares. Down the left, a file of registers — 256 KB of them, an absurd amount of scratch space for 128 lanes, and the reason for that is the whole point of the next two steps. Off to the side sit the specialists: four tensor cores for matrix arithmetic, one core that does nothing but trace rays.',
      camera: { position: [0.88, 2.105, 3.95], target: [-0.69, 1.535, 0.34] },
      dofAperture: 0.00006,
      focus: ['Four blocks of 32 lanes', '256 KB of registers'],
      onEnter: ({ handles }) => {
        handles.setView('sm');
        handles.setLabels('sm');
        handles.set({
          spin: 0,
          fan: 0,
          lift: 1,
          smMode: 'idle',
          vrm: 0,
          pipe: 0,
          simt: 0,
          sched: 0,
          flow: 0,
        });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6000,
          ease: 'linear',
          onUpdate: () => handles.set({ smPulse: s.t * 3 }),
        });
      },
    },
    {
      id: 'simt',
      heading: '7 · One instruction, thirty-two lanes',
      body: 'A block does not run 32 separate programs. It runs ONE instruction across all 32 lanes at once, on 32 different pixels. That group of 32 has a name — a warp — and it moves in lockstep. This is the efficiency at the heart of the whole chip: one instruction fetched, one decoded, thirty-two answers. It is also the catch. When a branch in the shader sends some lanes one way and the rest the other, the block cannot do both at once. It runs the first half with the other lanes switched off, then runs the second half. The same work, taking twice as long.',
      camera: { position: [0.23, 1.585, 3.79], target: [-0.71, 1.585, 0.21] },
      dofAperture: 0.00012,
      focus: ['One instruction, 32 lanes', 'A branch splits the warp in two'],
      onEnter: ({ handles }) => {
        handles.setView('sm');
        handles.setLabels('simt');
        handles.set({
          spin: 0,
          fan: 0,
          lift: 1,
          smMode: 'simt',
          vrm: 0,
          pipe: 0,
          sched: 0,
          flow: 0,
        });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5600,
          ease: 'linear',
          onUpdate: () => handles.set({ simt: s.t, smPulse: s.t * 3 }),
        });
      },
    },
    {
      id: 'scheduler',
      heading: '8 · The real trick is never waiting',
      body: 'Fetching a number from memory costs hundreds of clock cycles, and 32 lanes sitting still through every one of them would waste most of the chip. So the tile keeps up to 48 warps loaded at the same time — 1,536 threads — and the instant one of them asks memory for something, the scheduler issues a different warp’s next instruction on the following cycle. Nothing is saved or restored on the way, because every resident warp’s registers are already sitting in that oversized register file, untouched. That is what the 256 KB is for. Across all 128 working tiles, about 196,000 threads are resident at once, and the lanes almost never stop.',
      camera: { position: [1.16, 2.055, 3.91], target: [-0.66, 1.525, 0.38] },
      dofAperture: 0.0001,
      focus: ['The 48 warps parked here', 'The lanes never stop'],
      onEnter: ({ handles }) => {
        handles.setView('sm');
        handles.setLabels('sched');
        handles.set({
          spin: 0,
          fan: 0,
          lift: 1,
          smMode: 'sched',
          vrm: 0,
          pipe: 0,
          simt: 0,
          flow: 0,
          smPulse: 0,
        });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4800,
          ease: 'linear',
          // one whole pass through the seven warp slots per lap
          onUpdate: () => handles.set({ sched: s.t }),
        });
      },
    },
    {
      id: 'memory',
      heading: '9 · A terabyte a second',
      body: 'All of those threads have to be fed, and that is what the ring of twelve chips is doing. Each one talks to the die over its own 32-bit channel — 384 bits wide in total — at 21 billion transfers a second on every wire. Add it up and just over a terabyte of data crosses the two centimetres between the memory and the chip every second. Even that is not enough on its own, which is why a finished card keeps 72 MB of L2 in the middle of the die: every request it can answer itself is a trip out to the board that never has to happen.',
      camera: { position: [1.2, 1.365, 1.9], target: [-0.45, 0.085, -0.02] },
      dofAperture: 0.00011,
      focus: ['Twelve 32-bit channels'],
      onEnter: ({ handles }) => {
        handles.setView('mem');
        handles.setLabels('mem');
        handles.set({
          spin: 0.1,
          fan: 0,
          lift: 1,
          smMode: 'idle',
          vrm: 0,
          pipe: 0,
          simt: 0,
          sched: 0,
        });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5500,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              flow: s.t * 5,
              smPulse: s.t * 3,
            }),
        });
      },
    },
    {
      id: 'running',
      heading: '10 · Sealed, and running',
      body: 'Bolt it back together, and this is what is going on under the fans while a single frame is drawn: a hundred and ninety thousand threads resident on one piece of silicon, warps handed off so quickly that the lanes barely idle, and around a billion pixels a second each worked out by its own little program. The only sign of any of it from outside is the air coming off the fins — 450 watts of it, which is why the machine is mostly cooler.',
      hint: 'Drag to orbit.',
      camera: { position: [3.21, 2.262, 5.36], target: [-0.9, 0.172, 0.98] },
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.setView('card');
        handles.setLabels(false);
        handles.set({
          lift: 0,
          smMode: 'idle',
          vrm: 0,
          pipe: 0,
          simt: 0,
          sched: 0,
          flow: 0,
        });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6000,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              spin: s.t * Math.PI * 2,
              fan: s.t * Math.PI * 2 * 7,
              smPulse: s.t * 3,
            }),
        });
      },
    },
  ],
});
