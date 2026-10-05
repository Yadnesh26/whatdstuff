// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: one flowing voiceover (single ElevenLabs take), built on the
// video-scripting spine. Loop: "two teams of switches, one team always wins"
// is planted in shot 1 and closed word-for-word in the button. The stat (tens
// of billions of switches) gets its own shot. Silent shots carry the cutting.
//
// steps: 0 chip · 1 switch · 2 series · 3 parallel · 4 nand · 5 truth · 6 universal · 7 run
export default {
  hook: 'Your computer has never made a single decision.',

  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    followOverlay: { short: true },
  },

  short: {
    shots: [
      {
        step: 0,
        frame: null, fill: 0.9,
        narration:
          'Your computer has never made a single decision. Every choice it makes is a tug of war between two teams of switches, and one team always wins.',
      },
      { step: 0, frame: ['4 NAND gates'], labels: ['4 NAND gates'], seconds: 2 },
      { step: 0, frame: null, fill: 0.9, push: 0.92, seconds: 3 },
      {
        step: 0,
        frame: ['Input A', 'Input B', 'Output'],
        labels: ['Input A', 'Input B', 'Output'],
        narration:
          'So how do switches become a decision? Start with this chip. Inside are four gates, each answering yes or no with voltage.',
      },
      { step: 0, frame: ['VCC +5 V', 'GND 0 V'], labels: ['VCC +5 V', 'GND 0 V'], seconds: 2.2 },
      {
        step: 1,
        frame: ['Gate'],
        labels: ['Gate', 'Channel'],
        narration:
          'Take one switch. Put voltage on its gate, and an electric field closes the channel, so current flows.',
      },
      { step: 1, frame: ['Channel'], labels: ['Channel'], push: 0.9, seconds: 2 },
      { step: 1, frame: null, fill: 0.9, labels: ['Lamp'], seconds: 2 },
      {
        step: 2,
        frame: null, fill: 0.9,
        labels: ['Switch A', 'Switch B'],
        narration:
          'But one switch only says yes or no. Wire two in a row, and both must close before anything gets through. That is AND.',
      },
      { step: 2, frame: ['Both: AND'], labels: ['Both: AND'], seconds: 2 },
      {
        step: 3,
        frame: null, fill: 0.9,
        labels: ['Switch A', 'Switch B'],
        narration: 'Wire them side by side instead, and either one will do. That is OR.',
      },
      {
        step: 4,
        frame: null, fill: 0.9,
        labels: ['Pull-up: parallel', 'Pull-down: series'],
        narration:
          'Now the trick. Real gates run two teams. The top team connects the output to power, and the bottom team connects it to ground. The same inputs drive both, so when one closes, the other opens.',
      },
      { step: 4, frame: ['Pull-up: parallel'], labels: ['Pull-up: parallel'], seconds: 2.4 },
      { step: 4, frame: ['Pull-down: series'], labels: ['Pull-down: series'], seconds: 2.4 },
      { step: 4, frame: ['Pull-up: parallel', 'Pull-down: series', 'Output'], labels: ['Output'], seconds: 2 },
      {
        step: 5,
        frame: null, fill: 0.9,
        labels: ['Output'],
        narration:
          'So try every input. The output says one, except when both inputs are one. Then it says zero. That is a NAND, and it takes four transistors.',
      },
      {
        step: 6,
        frame: null, fill: 0.9,
        labels: ['NOT: tied inputs', 'AND: NAND + NOT'],
        narration:
          'And that one gate can build every other gate. Tie its inputs together for NOT, add one more for AND.',
      },
      { step: 6, frame: ['AND: NAND + NOT'], labels: ['AND: NAND + NOT'], seconds: 2.4 },
      {
        step: 7,
        frame: null, fill: 0.9,
        narration: 'So a top-end chip is that four-switch cell, copied over 50 billion times.',
      },
      {
        step: 7,
        frame: null, fill: 0.9,
        narration: 'One team always wins. Multiply by billions.',
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'Your computer has never made a single decision',
      hashtags: ['#logicgates', '#howitworks', '#electronics', '#computerscience', '#whatdstuff'],
    },
  },
};
