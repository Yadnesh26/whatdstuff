import { defineExplainer } from '../../framework/index.js';
import meta from './meta.js';
import { buildNetwork } from './model.js';

// The story: one cell site, five generations. Step 1 is the complete sealed
// product — the mast, the cabinet, the 1990s GSM panel — with the instruments
// hidden. From there the panel on the arm physically swaps era by era while two
// instruments beside it carry the argument: a LOGARITHMIC spectrum rail (how
// wide is the channel) and an access panel (whose turn is it). The middle of
// the run breaks out to the constellation plate for the second lever, bits per
// symbol, then to the 64-element array for the third, beams. The levers step
// lays all five channel widths out together; 6G is hedged as what it is, a set
// of specifications due in 2028. The finale cycles all five on a loop.
//
// Seamless loops: setPhase is one 0-1 phase and EVERY count it drives is an
// integer per lap — 8 timeslots, 16 scheduler columns, 16 code chips, 2 packet
// laps, one sensing sine, 4 constellation levels, 5 generations — so frame 0
// and frame 1 are the same frame. Nothing in this scene turntables: the site
// stands still and the camera does the moving, which also means no step can
// inherit a stray spin phase.

// Pin ALL scene state on entering a step (pre-flight #4): generation, both
// instruments, the constellation, the beams, the handsets and the labels — so
// scrolling either way lands on exactly the same frame.
const view =
  ({
    gen = 0,
    bench = false,
    access = false,
    blocks = false,
    constellation = false,
    beams = false,
    phones = true,
    labels = false,
  }) =>
  ({ handles }) => {
    handles.setGen(gen);
    handles.setBench(bench);
    handles.setAccess(access);
    handles.setBlocks(blocks);
    handles.setConst(constellation);
    handles.setBeams(beams);
    handles.setPhones(phones);
    handles.setLabels(labels);
  };

function phaseLoop(duration) {
  return ({ tl, handles }) => {
    const s = { t: 0 }; // LOCAL state — never share tween targets across steps
    tl.add(s, { t: 1, duration, ease: 'linear', onUpdate: () => handles.setPhase(s.t) });
  };
}

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildNetwork({ scene });
  },

  steps: [
    {
      id: 'site',
      heading: 'The same steel, five times over',
      body: 'Almost nothing on a cell site is new. The lattice mast, the cabinet at its foot and the cable trench between them went in for voice calls in the nineties, and they are still holding up whatever the network is called this decade. What actually changes is the panel on the arm — that one white slab, and the arithmetic running through it. Everything a G number promises happens in there.',
      hint: 'Drag to orbit · scroll to change generation.',
      // Low angle on purpose: the un-scrolled HERO renders this pose with the
      // summary text straight over the canvas and no panel box behind it, and
      // from a high angle the plinth's lit top face fills the text column and
      // eats the words. Dropping the camera compresses that face to a band and
      // gives the mast a more heroic silhouette at the same time.
      camera: { position: [4.9, 2.05, 5.1], target: [-0.01, 1.45, 0.94] },
      dofAperture: 0.00003,
      focus: ['Sector antenna'],
      onEnter: view({ gen: 0, beams: 'sector', labels: 'site' }),
      timeline: phaseLoop(7000),
    },
    {
      id: 'turns',
      heading: '2G: eight turns on one channel',
      body: 'A GSM channel is 200 kilohertz wide — narrower than a single FM radio station. Eight phones share it by literally taking turns: the second is cut into bursts, you get one burst in eight, and you are silent for the other seven. That is why 2G data dripped. One timeslot carries about 9.6 kilobits a second, so a single phone photo would have taken you over an hour.',
      hint: 'The rail is logarithmic — each tick is ten times the last.',
      camera: { position: [1.6, 2.4, 3.2], target: [-1.35, 1.0, -1.05] },
      dofAperture: 0.00006,
      focus: ['Eight turns · one talker', '200 kHz — the whole channel'],
      onEnter: view({ gen: 0, bench: true, access: 'slots', phones: false, labels: 'turns' }),
      timeline: phaseLoop(5600),
    },
    {
      id: 'codes',
      heading: '3G: everybody talks at once',
      body: "3G's idea was to abolish turns altogether. The channel widens to 5 megahertz — twenty-five times the room — and all three phones transmit across the whole of it at the same instant. What keeps them apart is not time but a code: each phone multiplies its bits by its own fast pattern of plus and minus, 3.84 million flips a second. On the air that is one hash. Multiply the hash by one phone's code and its bits fall back out, while everyone else averages to nothing.",
      camera: { position: [-2.2, 1.35, 2.6], target: [-1.89, 1.05, -1.3] },
      dofAperture: 0.00007,
      focus: ['All three, all the time', '5 MHz — 25× wider'],
      onEnter: view({ gen: 1, bench: true, access: 'codes', phones: false, labels: 'codes' }),
      timeline: phaseLoop(4600),
    },
    {
      id: 'grid',
      heading: '4G: turns again, a thousand a second',
      body: 'LTE brings turns back and makes them tiny. The 20 megahertz channel is sliced in both directions at once — into subcarriers 15 kilohertz apart and slots half a millisecond long — and what falls out is a grid of tiles. A scheduler in the cabinet re-deals that whole grid every millisecond, handing each phone whatever tiles its signal can currently carry. Nobody waits for a turn any more. They wait a thousandth of a second for the next deal.',
      hint: 'One column of tiles is one millisecond of air.',
      camera: { position: [0.2, 3.1, 2.4], target: [-1.59, 1.1, -0.97] },
      dofAperture: 0.00008,
      focus: ['A fresh deal every ms', '12 subcarriers × 0.5 ms'],
      onEnter: view({ gen: 2, bench: true, access: 'grid', phones: false, labels: 'grid' }),
      timeline: phaseLoop(4200),
    },
    {
      id: 'alphabet',
      heading: 'The second lever: more bits per wiggle',
      body: 'Width alone was never going to do it. The other half of the gain is the alphabet — how much meaning you pack into one flick of the wave. Every symbol is a point on this grid of amplitude and phase: four points carry two bits, two hundred and fifty-six carry eight. But the noise smudging each point does not shrink as you add more of them. Crowd the constellation and the smudges touch, the receiver starts guessing, and the network quietly drops you back to a coarser alphabet.',
      hint: 'The grid densifies; the blur stays exactly the same size.',
      camera: { position: [0.0, 1.35, 0.55], target: [0.66, 0.86, -1.33] },
      dofAperture: 0.00022,
      focus: ['QPSK · 2 bits', 'Noise never shrinks'],
      onEnter: view({
        gen: 2,
        bench: true,
        constellation: 'cycle',
        phones: false,
        labels: 'alphabet',
      }),
      timeline: phaseLoop(6400),
    },
    {
      id: 'beam',
      heading: '5G: sixty-four antennas, one beam each',
      body: 'Here is the lever 5G actually leans on. The slim white panel is gone, replaced by a box the size of a briefcase with sixty-four transceivers behind its face — sixteen across, four down. Delay each one by a fraction of a wavelength and the waves reinforce in exactly one direction: a beam, aimed at one phone, steered in software with nothing moving. Three phones get three beams, and because the beams barely touch, the tower can hand all three of them the same tile at the same moment.',
      hint: 'Three copies of one grid — that is the same tile, three times.',
      camera: { position: [4.6, 2.75, 4.3], target: [0.0, 1.5, 0.4] },
      dofAperture: 0.00004,
      focus: ['64 elements: 16 × 4', 'A beam each'],
      onEnter: view({
        gen: 3,
        bench: true,
        access: 'layers',
        beams: 'narrow',
        labels: 'beam',
      }),
      timeline: phaseLoop(4800),
    },
    {
      id: 'levers',
      heading: 'Why any of it got faster',
      body: 'Nothing here made radio faster. A wave still travels at the speed it did in 1901, and the ceiling Claude Shannon put on a noisy channel has not moved a decibel. Speed is three numbers multiplied: how wide the channel is, how many bits ride on each symbol, and how many separate copies of the signal the antennas can fly at once. 2G had 200 kilohertz, one bit a symbol and one stream. 5G has up to 400 megahertz, eight bits, and dozens of beams — about two million times the peak rate, off the same steel.',
      hint: 'Five generations of channel, stacked on one logarithmic rail.',
      camera: { position: [2.7, 2.95, 5.2], target: [-1.15, 1.05, -1.0] },
      dofAperture: 0.00004,
      focus: ['Lever 1 — how wide', 'Lever 2 — how dense', 'Lever 3 — how many'],
      onEnter: view({
        gen: 3,
        bench: true,
        blocks: true,
        access: 'layers',
        constellation: 3,
        labels: 'levers',
      }),
      timeline: phaseLoop(5200),
    },
    {
      id: 'sense',
      heading: '6G: a beam that already knows where you are',
      body: 'There is no 6G to buy. It is a set of arguments happening right now: the first specifications are due out of 3GPP at the end of 2028, service around 2030, and the shortlist of bands runs from seven to fifteen gigahertz — shorter waves, far more room, noticeably less reach. The interesting part is not the speed. A tower already firing narrow beams can listen for their echoes, and a network that hears its own reflections can map the street it stands on. The radio becomes a radar that happens to carry your data.',
      hint: 'Echoes running back up the beam.',
      camera: { position: [4.2, 2.5, 4.6], target: [-0.08, 1.45, 0.4] },
      dofAperture: 0.00004,
      focus: ['256 elements · it listens'],
      onEnter: view({ gen: 4, bench: true, beams: 'sense', labels: 'sense' }),
      timeline: phaseLoop(5000),
    },
    {
      id: 'run',
      heading: 'Run it',
      body: 'One mast. Five generations bolted to it in thirty years, each buying the same three things — a wider slice, a denser alphabet, more beams at once. Watch the panel change and the channel grow, and notice what never moves: the steel, the physics, the speed of the wave itself. The wave never got faster. The queue did.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [-3.44, 2.57, 5.11], target: [-0.9, 1.3, -0.3] },
      freeOrbit: true,
      onEnter: ({ handles }) => {
        handles.setBench(true);
        handles.setBlocks(false);
        handles.setConst(false);
        handles.setPhones(true);
        handles.setLabels('run');
      },
      timeline: ({ tl, handles }) => {
        const s = { t: 0 };
        tl.add(s, {
          t: 1,
          duration: 9000,
          ease: 'linear',
          onUpdate: () => {
            const u = s.t % 1;
            // five whole generations a lap — at u = 1 it is back on 2G, which
            // is exactly the u = 0 pose, so the cut at the wrap is invisible
            const g = Math.min(4, Math.floor(u * 5));
            handles.setGen(g);
            handles.setAccess(
              g === 0 ? 'slots' : g === 1 ? 'codes' : g === 2 ? 'grid' : g === 3 ? 'layers' : 'layers6',
            );
            handles.setBeams(g >= 3 ? (g === 4 ? 'sense' : 'narrow') : 'sector');
            handles.setPhase(u);
          },
        });
      },
    },
  ],
});
