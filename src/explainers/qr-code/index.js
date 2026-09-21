import { defineExplainer } from '../../framework/index.js';
import { smooth, win } from '../../framework/motion.js';
import meta from './meta.js';
import { buildQrCode } from './model.js';

// Every step loops while active: `u` sweeps 0->1 once per lap and every scalar
// below is written to land back on an identical value at the wrap. The plaque
// sways on a sine (whole cycle per lap); the finder probe and the read-out beam
// are mod-1 sweeps whose brightness envelopes close at both ends; the rail fill,
// the sticker and the reticle lock are out-and-back; the fill step is a
// triangle; the mask step is eight discrete slots, so slot 8 IS slot 0.
function run({ duration, pose }) {
  return ({ tl, handles }) => {
    const s = { t: 0 };
    tl.add(s, {
      t: 1,
      duration,
      ease: 'linear',
      onUpdate: () => handles.set(pose(s.t)),
    });
  };
}

// Every onEnter pins ALL of it — anything left unpinned inherits the previous
// step's mid-lap phase and misframes a fixed camera.
const enter =
  (over, labels) =>
  ({ handles }) => {
    handles.set({
      spin: 0,
      highlight: 'none',
      pulse: 0,
      fill: 1,
      maskIdx: -1,
      maskShow: 0,
      ratio: 0,
      ratioOn: 0,
      rail: 0,
      railOn: 0,
      railGlow: 1,
      damage: 0,
      phone: 0,
      beam: 0,
      lock: 0,
      ...over,
    });
    handles.setLabels(labels ?? false);
  };

// a gentle product-shot sway: one whole cycle per lap, so the wrap is exact
const sway = (u, base = 0, amp = 3.5) => base + amp * Math.sin(Math.PI * 2 * u);

export default defineExplainer({
  ...meta,

  buildScene({ scene }) {
    return buildQrCode({ scene });
  },

  stageOptions: { dof: true },

  steps: [
    {
      id: 'code',
      heading: '1 · A page with the ruler printed on it',
      body: 'This is a real QR code, moulded into a plate: 25 rows of 25 squares, each square a module, each module black or white. It carries fourteen characters — the address of this site. What makes it different from the barcode on a cereal box is that a barcode assumes you will hold the scanner straight; a QR code assumes you will not. Most of what you are looking at is not the message at all. It is the scaffolding a camera needs to work out where the code is, how big it is, and which way up you are holding it.',
      hint: 'Drag to orbit. The dark modules stand proud of the plate.',
      camera: { position: [-1.35, 2.2, 2.92], target: [-0.7, 1.5, 0] },
      focus: ['Version 2 — 25 × 25 modules'],
      onEnter: enter({}, 'code'),
      timeline: run({ duration: 7500, pose: (u) => ({ spin: sway(u, 0, 4) }) }),
    },
    {
      id: 'finder',
      heading: '2 · Three eyes, and one deliberate gap',
      body: 'The three big squares are finder patterns, and they are the first thing any scanner looks for. Run a line through the middle of one and you cross black, white, black, white, black in widths of 1 : 1 : 3 : 1 : 1 — and that holds no matter which way you cut through it, or how far away you are, or how tilted the code is. Masahiro Hara picked that ratio in 1994 by counting run-lengths in piles of printed matter and choosing the sequence that almost never turned up by accident. Three corners get one; the fourth is left bare on purpose, so the code cannot be read upside down.',
      hint: 'The probe measures the run as it crosses.',
      camera: { position: [-0.85, 2.35, 2.55], target: [-0.55, 1.72, 0] },
      dofAperture: 0.00012,
      focus: ['1 : 1 : 3 : 1 : 1'],
      onEnter: enter({ highlight: 'finder', ratioOn: 1 }, 'finder'),
      timeline: run({
        duration: 4600,
        pose: (u) => ({ highlight: 'finder', ratioOn: 1, ratio: u, spin: sway(u, -6, 2) }),
      }),
    },
    {
      id: 'grid',
      heading: '3 · The ruler and the tripod',
      body: 'Once it has the three eyes, the scanner knows roughly where the code sits — but not yet how wide one module is, and printed codes are never quite square in a photograph. The dotted line running between the finders is the timing pattern: strict black-white-black-white along row six and column six, so counting it gives the exact module pitch. The small 5 × 5 square near the bottom-right is an alignment pattern, and it is the one that saves you when the code is on a curved bottle or shot at an angle. Version 1 has none; version 2 has one; version 40 has forty-six.',
      camera: { position: [0.05, 1.8, 2.45], target: [-0.3, 1.5, 0] },
      dofAperture: 0.00013,
      focus: ['Alignment pattern — 5 × 5'],
      onEnter: enter({ highlight: 'grid' }, 'grid'),
      timeline: run({
        duration: 4200,
        pose: (u) => ({ highlight: 'grid', pulse: u, spin: sway(u, 10, 2.2) }),
      }),
    },
    {
      id: 'format',
      heading: '4 · Fifteen bits that have to survive',
      body: 'Wrapped around the finders is a strip of fifteen modules called the format information. Five bits of it are the actual content — two for the error-correction level, three for which mask was used — and the other ten are a BCH code protecting those five. Then the whole fifteen is XOR-ed with a fixed pattern so it can never come out all-white, and written into the code twice, in two places far apart. It has to be this paranoid: nothing else in the code can be read until these bits are, so a scanner that loses them loses everything. The one module sitting directly above the bottom-left strip is dark in every QR code ever printed, whatever it says.',
      camera: { position: [-0.97, 1.8, 2.93], target: [-0.55, 1.5, 0] },
      dofAperture: 0.0001,
      focus: ['Format information — 15 bits'],
      onEnter: enter({ highlight: 'format' }, 'format'),
      timeline: run({
        duration: 4200,
        pose: (u) => ({ highlight: 'format', pulse: u, spin: sway(u, -12, 2) }),
      }),
    },
    {
      id: 'data',
      heading: '5 · Turning the message into bytes',
      body: 'Now the message. Four bits say which alphabet is coming — 0100 means raw bytes — then eight bits give the length, fourteen. After that it is just ASCII: w is 01110111, h is 01101000, and so on for all fourteen characters. That comes to 124 bits, four zeros of terminator round it up to 128, and 128 bits is exactly sixteen codewords of eight bits each. Sixteen is also exactly what a version 2 code at this correction level has room for, which is why fourteen characters needs this size of code and a fifteenth would not fit.',
      hint: 'The rail below is the message, one tile per codeword.',
      camera: { position: [-1.05, 2.02, 3.45], target: [-0.62, 1.34, 0] },
      dofAperture: 0.00007,
      focus: ['16 data codewords'],
      onEnter: enter({ highlight: 'data', railOn: 1 }, 'data'),
      timeline: run({
        duration: 5200,
        pose: (u) => ({
          highlight: 'data',
          railOn: 1,
          pulse: u,
          rail: (16 / 44) * smooth(win(u, 0.02, 0.68)),
          railGlow: 1 - smooth(win(u, 0.86, 1)),
          spin: sway(u, 0, 2),
        }),
      }),
    },
    {
      id: 'ec',
      heading: '6 · Twenty-eight spare codewords',
      body: 'Sixteen codewords of message get twenty-eight codewords of Reed–Solomon behind them — nearly two check symbols for every one of yours. That is level H, the strongest of the four, and it is why the code you are looking at is more correction than content. Reed–Solomon fixes half its check symbols, so fourteen of the forty-four can be wrong or missing and the message still comes out bit-perfect. Drop a sticker on it and watch: the buried codewords go red on the rail, the spares rebuild them, and the scan still lands. This is also why companies get away with printing a logo in the middle of one.',
      hint: 'The patch hides part of the pattern. It still reads.',
      camera: { position: [-1.1, 2.15, 3.6], target: [-0.68, 1.35, 0] },
      dofAperture: 0.00006,
      focus: ['28 Reed–Solomon codewords'],
      onEnter: enter({ highlight: 'ec', railOn: 1, rail: 1 }, 'ec'),
      timeline: run({
        duration: 6400,
        pose: (u) => ({
          highlight: 'ec',
          railOn: 1,
          rail: 1,
          pulse: u * 0.5,
          damage: u,
          spin: sway(u, -3, 1.6),
        }),
      }),
    },
    {
      id: 'place',
      heading: '7 · Snaking the bits into the grid',
      body: 'Forty-four codewords is 352 bits, and they go into the code in a fixed path: two-module-wide columns starting at the bottom-right corner, zig-zagging up the pair, then down the next pair, then up again, all the way to the left edge. Anything already spoken for — a finder, the timing line, the format strip — is stepped over, and the column that would land on the vertical timing pattern is skipped entirely. Version 2 leaves seven modules over at the end, which are simply filled with zeros and ignored.',
      camera: { position: [-1.25, 2.25, 2.95], target: [-0.72, 1.52, 0] },
      dofAperture: 0.00007,
      focus: ['Two-module columns, snaking upward'],
      onEnter: enter({ fill: 0 }, 'place'),
      timeline: run({
        duration: 6000,
        pose: (u) => ({
          fill: smooth(win(u, 0.02, 0.6)) - smooth(win(u, 0.7, 0.98)),
          spin: sway(u, 8, 2.5),
        }),
      }),
    },
    {
      id: 'mask',
      heading: '8 · Eight patterns, and a scoring round',
      body: 'A raw code often comes out with big blank fields or long stripes, and a camera reads those badly — worse, a run of dark modules can accidentally imitate a finder pattern and send the scanner hunting in the wrong place. So the encoder XOR-s the message area with one of eight fixed patterns, tries all eight, and scores each on four penalty rules: runs of five or more, solid 2 × 2 blocks, anything resembling the 1 : 1 : 3 : 1 : 1 finder run, and how far the black-to-white balance drifts from even. This code scored 445 on mask 2 — every third column flipped — against 692 for the worst. Only the message area is touched; the finders and timing lines are never masked.',
      hint: 'All eight candidates, in order. Watch the score.',
      camera: { position: [-1.15, 2.2, 2.9], target: [-0.7, 1.52, 0] },
      focus: ['Mask 2 · penalty 445'],
      onEnter: enter({ maskIdx: 0 }, 'mask'),
      timeline: run({
        duration: 7200,
        pose: (u) => ({
          maskIdx: Math.floor(u * 8) % 8,
          // each candidate flashes its own pattern mid-slot and settles again,
          // so the eighth slot ends exactly where the first one started
          maskShow: 0.75 * Math.sin(Math.PI * ((u * 8) % 1)),
          spin: sway(u, -8, 2),
        }),
      }),
    },
    {
      id: 'scan',
      heading: '9 · What the camera actually does',
      body: 'Your phone is not reading squares. It thresholds the image to black and white, hunts every row for that 1 : 1 : 3 : 1 : 1 run, and when three of them turn up it has three corners of a square — enough to work out the fourth, undo the perspective, and lay a grid over the picture using the timing pattern for spacing. Then it reads the format bits, learns the level and the mask, XOR-s the mask back off, walks the same snaking path in reverse, and hands 352 bits to Reed–Solomon. From pointing the camera to opening the link is usually under a tenth of a second.',
      hint: 'Drag to orbit while it reads.',
      camera: { position: [-0.95, 2.1, 4.05], target: [-0.33, 1.46, 0.2] },
      freeOrbit: true,
      focus: ['Three finders give it four corners'],
      onEnter: enter({ phone: 1, lock: 1 }, 'scan'),
      timeline: run({
        duration: 4800,
        pose: (u) => ({
          phone: 1,
          beam: u,
          lock: 0.78 + 0.22 * Math.sin(Math.PI * 2 * u),
          spin: sway(u, 0, 2.5),
        }),
      }),
    },
  ],
});
