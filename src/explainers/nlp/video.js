// Editorial layer for video export (scripts/export-video.mjs).
//
// SCRIPTING: one flowing voiceover (single ElevenLabs take), built on the
// video-scripting spine. Loop: "all it does is guess the next piece" is planted
// in the hook and closed in the button ("Predict one piece. Append. Repeat.").
// The stat (38.6 million numbers before it has read a thing) gets its own shot.
// Silent shots carry the cutting. Token numbers are the real GPT-2 ones.
//
// steps: 0 console · 1 tokenize · 2 embed · 3 meaning · 4 attention · 5 layers · 6 predict · 7 run
export default {
  hook: 'Your chatbot has never read a single word.',

  render: {
    formats: ['short'],
    captions: true,
    captionStyle: 'bold-karaoke',
    followOverlay: { short: true },
  },

  // Portrait art direction: the bench is ~8 units wide, so a "whole model" fit
  // leaves it a 15%-tall strip. Wide shots pin a camera on the station being
  // narrated; close-ups keep the solver (their callouts sit on real meshes).
  short: {
    shots: [
      {
        step: 0,
        camera: { position: [-1.12, 2.85, 9.61], target: [1.28, 0.37, -0.02] },
        push: 0.94, orbit: 8,
        narration:
          'Your chatbot has never read a single word. All it does is guess the next piece of text, over and over.',
      },
      { step: 0, frame: ['Text goes in'], labels: ['Text goes in'], seconds: 2 },
      { step: 0, frame: ['One next word comes out'], labels: ['One next word comes out'], seconds: 2.2 },
      {
        step: 1,
        camera: { position: [0.57, 2.48, 7.66], target: [-0.47, 0.33, 0.23] },
        labels: ['Tokenizer'],
        orbit: -6,
        narration:
          'So what does it do instead? First, it chops your sentence into pieces and swaps each for a number. Even didn’t splits in two. Fish becomes five thousand nine hundred sixteen.',
      },
      { step: 1, frame: ["didn't = didn + 't"], labels: ["didn't = didn + 't"], seconds: 2.2 },
      { step: 1, frame: ['Token ID: fish = 5916'], labels: ['Token ID: fish = 5916'], seconds: 2.2 },
      {
        step: 2,
        camera: { position: [1.14, 2.63, 8.16], target: [-0.32, 0.53, -0.11] },
        labels: ['Lookup table: 50,257 rows'],
        orbit: 6,
        narration:
          'But a bare number means nothing. So each one pulls a row from a giant table: seven hundred sixty eight numbers.',
      },
      { step: 2, frame: ['768 numbers per token'], labels: ['768 numbers per token'], seconds: 2.2 },
      {
        step: 2,
        camera: { position: [2.64, 2.06, 6.19], target: [0.41, 0.52, -0.68] },
        labels: ['Lookup table: 50,257 rows'],
        push: 0.92,
        narration: 'The whole table is thirty eight million numbers, and it hasn’t read a thing.',
      },
      {
        step: 3,
        camera: { position: [1.04, 3.08, 4.32], target: [0.26, 2.44, -0.14] },
        labels: ['Similar words land close'],
        orbit: 8,
        narration:
          'So what are those numbers for? Coordinates. Cat lands near dog, and man to king is the same step as woman to queen.',
      },
      {
        step: 3,
        camera: { position: [1.11, 2.56, 3.09], target: [0.58, 2.13, 0.08] },
        labels: ['Same step, same meaning'],
        seconds: 2.4,
      },
      {
        step: 4,
        camera: { position: [1.11, 3.1, 10.25], target: [-0.3, 0.58, 0.25] },
        labels: ['Attention from "it"'],
        narration:
          'But a point can’t tell which noun it stands for. So every piece looks back, and here, most of the weight lands on fish.',
      },
      {
        step: 4,
        camera: { position: [2.31, 1.9, 4.43], target: [1.4, 0.81, 0.17] },
        labels: ['Attention from "it"'],
        push: 0.9,
        seconds: 2.4,
      },
      {
        step: 4,
        camera: { position: [2.64, 1.2, 3.13], target: [1.9, 0.55, 0.14] },
        labels: ['Future: masked out'],
        seconds: 1.8,
      },
      {
        step: 5,
        camera: { position: [1.18, 2.68, 8.4], target: [0.01, 0.91, 0.14] },
        labels: ['Layer 1 of 12'],
        orbit: 6,
        narration: 'Twelve layers repeat that, reshaping every number.',
      },
      {
        step: 6,
        camera: { position: [3.18, 2.57, 6.48], target: [1.55, 0.89, -0.03] },
        labels: ['Odds for the next piece'],
        narration:
          'At the top, the last card is scored against every piece the model knows. One wins: stale. It joins the text, and the whole machine runs again.',
      },
      {
        step: 6,
        camera: { position: [3.34, 1.5, 4.46], target: [2.27, 0.56, 0.16] },
        labels: ['Appended, then run again'],
        seconds: 2.4,
      },
      {
        step: 7,
        camera: { position: [-1.12, 2.85, 9.61], target: [1.28, 0.37, -0.02] },
        push: 0.94, orbit: -8,
        narration: 'Predict one piece. Append. Repeat.',
      },
    ],
  },

  platforms: {
    shorts: {
      title: 'Your chatbot has never read a single word',
      hashtags: ['#nlp', '#ai', '#chatgpt', '#howitworks', '#whatdstuff'],
    },
  },
};
