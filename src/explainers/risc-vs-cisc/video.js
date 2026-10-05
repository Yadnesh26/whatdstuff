// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: one flowing voiceover, synthesized as a single ElevenLabs take —
// the per-shot `narration` strings are just the cut points; each hands off into
// the next. Arc: hook -> stakes -> spoken question -> mechanism (same job, two
// scripts) -> isolated stat -> BUT/THEREFORE decode -> re-hook reveal -> button.
//
// PACKAGING
//   Idea:   your laptop chip and your phone chip speak different instruction
//           languages, and inside they run the same way.
//   Lens:   the RISC vs CISC war ended in a draw you can't see: x86 has been
//           translating itself into RISC-style micro-ops since 1995.
//   Loop:   "translating themselves since 1995" planted in the hook, asked as
//           the question ("why would a chip translate itself?"), paid off in the
//           1995 re-hook, closed by the button "Complex outside. Simple inside."
//           after "x86 just has to keep translating at the door", and hands
//           back to the hook on replay.
//
// LABELS: every shot hides the in-scene callouts (`labels: []`) — they do not
// survive the 9:16 crop, and the user asked for a clean model in the video.
//
// CAMERAS: every shot pins an explicit `camera`. With callouts hidden, the
// framing solver's subject box (built from the step's focus callouts, several of
// which hang off bare anchor groups) would be empty, so poses were fitted
// numerically against a 1080x1920 frame at the export's 42° FOV.
//
// LOOP TIMING: a step's loop starts at phase 0 the first time it is activated.
// decode (step 4, 10s lap): all eight ARM decoders fire 1.2-4.8s into its line,
// under "decodes eight at once"; the x86 length finder walks after that, under
// "measure each one". uops (step 5, 10s lap): the micro-ops are out and lined up
// over the ARM tiles from ~5.9s to ~8.4s, under "a load, an add and a store".
//
// No em dashes anywhere: ElevenLabs renders them as dead air.

// steps: 0 chips · 1 tape · 2 job · 3 regs · 4 decode · 5 uops · 6 run (chips)
const CHIPS = { position: [6.05, 6.44, 3.57], target: [0.6, -0.21, 0.17] };
const CHIP_X86 = { position: [-0.44, 2.95, 3.9], target: [-1.08, 0.05, 0.24] };
const CHIP_ARM = { position: [0.44, 2.95, 3.9], target: [1.08, 0.05, 0.24] };
const TAPE_DEEP = { position: [9.06, 4.42, 2.34], target: [1.11, -0.41, -0.24] };
const TAPE_TIGHT = { position: [4.36, 5.27, 3.76], target: [1.49, -0.05, 0.34] };
const JOB_DEEP = { position: [7.69, 5.56, 2.45], target: [0.66, -0.28, -0.11] };
const JOB_PROG = { position: [0.16, 4.59, 3.46], target: [-1.63, 0.02, 0.36] };
const JOB_REGS = { position: [5.68, 6.62, 5.53], target: [1.35, -0.11, 0.38] };
const DEC_DEEP = { position: [8.4, 5.26, 2.59], target: [0.61, -0.32, -0.24] };
const DEC_RISC = { position: [4.94, 4.47, 2.77], target: [0.64, -0.23, 0.48] };
const DEC_CISC = { position: [2.67, 4.36, 2.54], target: [-0.49, 0.03, -0.62] };
const UOPS = { position: [3.94, 5.88, 3.27], target: [0.05, 0, 0.24] };
const UOPS_MATCH = { position: [1.44, 5.37, 3.11], target: [-0.87, 0.02, 0.35] };
const CHIPS_OPEN = { position: [5.77, 8.07, 4.3], target: [0.57, -0.02, -0.07] };
const DIE_X86 = { position: [-0.68, 2.61, 1.85], target: [-1.03, 0.19, 0.19] };

export default {
  hook: 'Most laptop chips have been translating\nthemselves since 1995.',

  // the meta title is too long for the 9:16 card and clips at both edges
  titleCard: 'RISC VS CISC',

  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    followOverlay: { short: true },
    speed: 1.0, // channel voice at 1x; make-narration's own default is 0.9
  },

  // 9:16 — ~70s. One take, 8 spoken lines, silent cuts inside them.
  short: {
    shots: [
      // Zone 1 — the hook over the two sealed chips
      {
        step: 0,
        camera: CHIPS,
        labels: [],
        narration:
          'Most laptop chips have been translating themselves since 1995. The chip in your phone never had to.',
      },
      { step: 0, camera: CHIPS, orbit: 6, labels: [], seconds: 2.2 },

      // Zone 2 — the two languages, one chip each
      {
        step: 0,
        camera: CHIP_X86,
        move: 'cut',
        labels: [],
        narration: 'The two chips speak different instruction languages. Laptops speak x86, a CISC design.',
      },
      { step: 0, camera: CHIP_ARM, labels: [], narration: 'Phones speak ARM, which is RISC.' },

      // Zone 3 — the question, over the two ribbons of bytes
      {
        step: 1,
        camera: TAPE_DEEP,
        labels: [],
        narration: 'So what’s the actual difference, and why would a chip translate itself?',
      },
      { step: 1, camera: TAPE_DEEP, push: 0.9, labels: [], seconds: 1.6 },

      // Zone 4 — same job, two scripts
      {
        step: 2,
        camera: JOB_PROG,
        labels: [],
        narration:
          'Take one job, adding a number into memory. x86 does it with one big instruction. ARM only does math inside the chip, so it needs three.',
      },
      { step: 2, camera: JOB_DEEP, labels: [], seconds: 2.4 },
      { step: 2, camera: JOB_REGS, push: 0.9, labels: [], narration: 'Load it, add it and store it back.' },

      // Zone 5 — the stat, isolated on a hard cut to the byte ribbons
      {
        step: 1,
        camera: TAPE_TIGHT,
        move: 'cut',
        labels: [],
        narration:
          'But the bigger difference is size. An x86 instruction can be anywhere from one to fifteen bytes long. Every ARM instruction is exactly four.',
      },
      { step: 1, camera: TAPE_TIGHT, orbit: -10, labels: [], seconds: 2 },

      // Zone 4b — THEREFORE: the front door
      {
        step: 4,
        camera: DEC_RISC,
        labels: [],
        narration: 'So ARM always knows where the next one starts, and decodes eight at once.',
      },
      { step: 4, camera: DEC_DEEP, labels: [], seconds: 1.6 },
      {
        step: 4,
        camera: DEC_CISC,
        move: 'cut',
        labels: [],
        narration: 'x86 has to measure each one before it can find the next.',
      },

      // Re-hook — the reveal that closes the planted question
      {
        step: 5,
        camera: UOPS,
        labels: [],
        narration:
          'Here’s the trick from 1995. x86 cracks each big instruction into tiny micro-ops. That one add becomes a load, an add and a store, exactly the steps ARM wrote out.',
      },
      { step: 5, camera: UOPS_MATCH, push: 0.9, labels: [], seconds: 3 },

      // Zone 6 + 7 — so-what over the opened chips (decoder strip in front of
      // a RISC-style core on each die), then the button
      {
        step: 6,
        camera: CHIPS_OPEN,
        labels: [],
        narration: 'Underneath, both chips run the same simple steps.',
      },
      {
        step: 6,
        camera: DIE_X86,
        move: 'cut',
        labels: [],
        narration: 'x86 just has to keep translating at the door. Complex outside. Simple inside.',
      },
      { step: 6, camera: CHIPS_OPEN, orbit: 12, labels: [], seconds: 2.4 },
    ],
  },

  platforms: {
    shorts: {
      title: 'Most laptop chips have been translating themselves since 1995',
      hashtags: ['#risc', '#cisc', '#cpu', '#arm', '#x86', '#howitworks', '#computerscience', '#whatdstuff'],
    },
  },
};
