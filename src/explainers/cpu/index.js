import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildCpu } from './model.js';

// Every step loops while active. Seamlessness rule: each lap advances the
// scalars a WHOLE number of cycles — spin whole turns, `tick` exactly 9
// packet-slots (PACKET_N in model.js, so the packet queue wraps onto itself),
// `alu` whole operations, `ring`/`corePulse`/`probe` whole laps. Nothing in
// this file may leave a scalar mid-cycle at the wrap. Cycle COUNTS are kept
// odd/co-prime where they can be: an even count makes the half-lap a symmetry,
// which is seamless but replays the same beat twice per lap.

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildCpu({ scene });
  },

  steps: [
    {
      id: 'package',
      heading: '1 · The sealed chip',
      body: "A computer's whole brain, from the outside, is a metal tile 37 by 45 millimetres — small enough to lose in a pocket. The polished lid is nickel-plated copper and carries no signals at all: it exists to move heat out and to stop a cooler's clamping force from cracking what sits underneath. Everything that actually computes is sealed below it, on the green board it is soldered to.",
      hint: 'Drag to orbit · scroll to go inside.',
      camera: { position: [3.05, 2.35, 4.15], target: [-0.8, 0.34, 0] },
      focus: ['Integrated heat spreader'],
      onEnter: ({ handles }) => {
        handles.setView('pkg');
        handles.setLabels('package');
        handles.set({ flip: 0, lid: 0, micro: false, ring: 0, corePulse: 0, tick: 0, clockLit: 0 });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 8000,
          ease: 'linear',
          onUpdate: () => handles.set({ spin: s.t * Math.PI * 2 }),
        });
      },
    },
    {
      id: 'contacts',
      heading: '2 · Seventeen hundred ways in',
      body: 'Turn it over and the underside is a field of gold pads — 1,700 of them on this package, with no pins at all; the pins are spring contacts waiting in the socket. Only a minority of the pads carry data or addresses. Most are power and ground, and that is not waste: the chip can pull well over a hundred amps at less than a volt and a half, and no single contact could survive that, so the current is split across hundreds of them in parallel.',
      camera: { position: [1.35, 2.05, 5.15], target: [-0.85, 1.6, 0] },
      focus: ['1,700 gold contacts'],
      onEnter: ({ handles }) => {
        handles.setView('pads');
        handles.setLabels('pads');
        handles.set({ flip: 1, lid: 0, micro: false, tick: 0, clockLit: 0 });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 7000,
          ease: 'linear',
          // a slow sway, whole cycle per lap, so the gold catches the key light
          onUpdate: () => handles.set({ spin: Math.sin(s.t * Math.PI * 2) * 0.17 }),
        });
      },
    },
    {
      id: 'die',
      heading: '3 · Lift the lid',
      body: 'Under the lid, stuck to it with a film of indium solder, is the part everyone means when they say "chip": one rectangle of silicon about the size of a fingernail. It covers roughly a seventh of the package hiding it — most of what you were just holding is packaging. The little black blocks scattered around it are capacitors, steadying a supply that swings violently as the chip\'s appetite changes within nanoseconds.',
      camera: { position: [2.35, 2.4, 3.85], target: [-0.5, 0.74, 0] },
      focus: ['The silicon die'],
      onEnter: ({ handles }) => {
        handles.setView('reveal');
        handles.setLabels('die');
        handles.set({ flip: 0, micro: false, tick: 0, clockLit: 0 });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 9000,
          ease: 'linear',
          onUpdate: () =>
            handles.set({
              spin: s.t * Math.PI * 2,
              lid: 1 + Math.sin(s.t * Math.PI * 2) * 0.018,
              ring: s.t,
              corePulse: s.t,
            }),
        });
      },
    },
    {
      id: 'floorplan',
      heading: '4 · A city with a ring road',
      body: 'Up close, the die is a floorplan. Each bright block is a core — a complete, independent computer. Beside every core sits a slice of L3 cache, and a ring bus threads every core and every slice into one loop with a stop at each, so any core can reach any slice. The big block filling one end is the integrated graphics; along the far edge sits the memory controller, the chip\'s only door to the RAM outside. Four cores here — today\'s desktop parts pack eight large ones plus sixteen small, laid out the same way.',
      camera: { position: [1.02, 1.58, 1.55], target: [-0.46, 0.34, 0] },
      dofAperture: 0.00012,
      focus: ['Ring bus', 'Core'],
      onEnter: ({ handles }) => {
        handles.setView('die');
        handles.setLabels('floorplan');
        handles.set({ flip: 0, lid: 1, spin: 0, micro: false, tick: 0, clockLit: 0 });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5200,
          ease: 'linear',
          onUpdate: () => handles.set({ ring: s.t * 3, corePulse: s.t * 3 }),
        });
      },
    },
    {
      id: 'pipeline',
      heading: '5 · Inside one core: an assembly line',
      body: 'Blow a single core up and the work it does is a five-station assembly line. Fetch collects the next instruction. Decode works out what it is asking for. Execute does the arithmetic. Memory reads or writes anything the instruction touched. Write-back files the answer into a register. Each station is separate hardware — and that is the whole trick, because it means all five can be busy with five different instructions at the same instant.',
      camera: { position: [1.25, 2.15, 3.65], target: [-0.7, 1.08, 0] },
      focus: ['One instruction enters here'],
      onEnter: ({ handles }) => {
        handles.setView('bench');
        handles.setLabels('pipeline');
        handles.set({ flip: 0, lid: 1, spin: 0, micro: false, clockLit: 0.1 });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 4400,
          ease: 'linear',
          onUpdate: () => handles.set({ tick: s.t * 9, ring: s.t * 3, corePulse: s.t * 3 }),
        });
      },
    },
    {
      id: 'clock',
      heading: '6 · One tick, one step',
      body: 'A clock signal fans out to every station, and on each tick every instruction slides one station along. Five stations, five instructions in flight, one finished result handed out per tick — five times the work of doing them one at a time. On a desktop chip that tick comes round about five billion times a second: each one lasts 200 picoseconds, and in that time light itself travels only about six centimetres. Real cores stretch the same line 14 to 20 stations deep.',
      camera: { position: [0.7, 2.32, 3.95], target: [-0.88, 1.6, 0] },
      focus: ['Clock — one tick, one step'],
      onEnter: ({ handles }) => {
        handles.setView('bench');
        handles.setLabels('clock');
        handles.set({ flip: 0, lid: 1, spin: 0, micro: false, ring: 0, corePulse: 0, clockLit: 1 });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 3600,
          ease: 'linear',
          onUpdate: () => handles.set({ tick: s.t * 9 }),
        });
      },
    },
    {
      id: 'execute',
      heading: '7 · What "computing" actually is',
      body: 'Open the Execute station and here is the whole mystery, undressed. Two registers — four bits here, sixty-four in reality — hold 0011 and 0101. They flow into the arithmetic logic unit, which adds them exactly the way you would on paper: column by column from the right, each carry rippling left into the next. Three carries later the answer 1000 is written back. Three plus five is eight, settled in a fraction of one tick.',
      camera: { position: [0.45, 2.5, 2.55], target: [-0.7, 2.1, 0] },
      dofAperture: 0.00022,
      focus: ['Arithmetic logic unit'],
      onEnter: ({ handles }) => {
        handles.setView('bench');
        handles.setLabels('execute');
        handles.set({ flip: 0, lid: 1, spin: 0, micro: true, ring: 0, corePulse: 0, clockLit: 0 });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 5600,
          ease: 'linear',
          onUpdate: () => handles.set({ tick: s.t * 9, alu: s.t * 2 }),
        });
      },
    },
    {
      id: 'cache',
      heading: '8 · Why the cache exists',
      body: 'A core can add numbers far faster than memory can hand them over, so it hoards copies close by. Its own L1 answers in about four ticks, L2 in fourteen, the shared L3 in roughly forty. Miss all three and the request has to leave the chip altogether for the DRAM outside — hundreds of ticks. Watch the L1 probe finish thirty-odd round trips in the time the memory probe manages one. Almost every clever trick in a modern core exists to avoid that one long walk.',
      camera: { position: [1.35, 1.95, 2.85], target: [0.05, 0.5, 0] },
      dofAperture: 0.00009,
      focus: ['Main memory — hundreds'],
      onEnter: ({ handles }) => {
        handles.setView('cache');
        handles.setLabels('cache');
        handles.set({ flip: 0, lid: 1, spin: 0, micro: false, tick: 0, clockLit: 0 });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6400,
          ease: 'linear',
          onUpdate: () => handles.set({ probe: s.t, ring: s.t * 3, corePulse: s.t * 3 }),
        });
      },
    },
    {
      id: 'running',
      heading: '9 · Sealed, and running',
      body: 'Lid back on, and this is what is happening under it while you read: billions of instructions a second walking that line, nearly all of them fed by cache, arithmetic that would cost you an afternoon with a pencil settled in well under a nanosecond. The only outward sign is heat — a hundred watts or more, leaving through the copper tile you started at.',
      hint: 'Drag to orbit.',
      camera: { position: [2.9, 2.62, 4.35], target: [-0.78, 0.34, 0] },
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.setView('pkg');
        handles.setLabels(false);
        handles.set({ flip: 0, lid: 0, micro: false, tick: 0, ring: 0, corePulse: 0, clockLit: 0 });
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 6000,
          ease: 'linear',
          onUpdate: () => handles.set({ spin: s.t * Math.PI * 2 }),
        });
      },
    },
  ],
});
