import meta from './meta.js';
import { buildNlp } from './model.js';
import { defineExplainer } from '../../framework/index.js';
import { clamp01, win, TAU } from '../../framework/motion.js';

// Zoom-in / reveal: the sealed console (tape in, one word out), then one
// station per step along the bench — cut, look up, place, attend, stack,
// predict — and the sealed console again running fast. Every step drives the
// model through handles.pose(), which resets ALL state to defaults before
// applying the step's own values, so nothing leaks between steps. Each lap
// is one linear tween whose pose at u=0 equals the pose at u=1: tape and
// spins advance whole wraps, every reveal fades back out before the wrap.
// Key moments are timed onto u=0.30 / 0.60 — the instants review-shots and
// the label gate sample.

const loop = (duration, fn) => ({ tl, handles }) => {
  const s = { t: 0 };
  tl.add(s, {
    t: 1,
    duration,
    ease: 'linear',
    onUpdate: () => handles.pose(fn(Math.min(s.t, 0.99999))),
  });
};

const out = (u, a, b) => 1 - win(u, a, b);

const sealed = (u, laps) => ({
  reveal: 0,
  feed: u * laps,
  display: 0.62 + 0.38 * Math.cos(TAU * u * laps),
});

const tokenize = (u) => ({
  reveal: 1,
  feed: u * 2,
  wall: 0,
  cards: 0,
  embed: 0,
  cut: clamp01((u - 0.06) / 0.46),
  blade: win(u, 0, 0.05) * out(u, 0.52, 0.58),
  bladeSpin: u * TAU * 9,
  sep: out(u, 0.86, 0.98),
  ids: win(u, 0.48, 0.58) * out(u, 0.84, 0.92),
});

const embed = (u) => ({ reveal: 1, feed: u * 2, embed: u, cards: out(u, 0.9, 0.99) });

const meaning = (u) => ({
  reveal: 1,
  feed: u * 2,
  wall: 0,
  cloud: 1,
  cloudSpin: 0.2 * Math.sin(TAU * u),
  arrow: u < 0.88 ? clamp01((u - 0.06) / 0.44) : out(u, 0.88, 0.99),
});

const attention = (u) => ({
  reveal: 1,
  feed: u * 2,
  attn: win(u, 0.06, 0.26) * out(u, 0.88, 0.98),
  pct: win(u, 0.18, 0.28) * out(u, 0.84, 0.92),
  blend: win(u, 0.34, 0.54) * out(u, 0.86, 0.96),
});

const layers = (u) => {
  const lin = clamp01((u - 0.04) / 0.8);
  const up = 0.5 * lin + 0.5 * lin * lin * (3 - 2 * lin);
  const r = u < 0.88 ? up : out(u, 0.88, 0.99);
  return { reveal: 1, feed: u * 2, layers: 1, rise: r, ctx: 0.9 * clamp01((r - 0.2) / 0.6) };
};

const predict = (u) => {
  const fade = out(u, 0.9, 0.99);
  return {
    reveal: 1,
    feed: u * 2,
    ctx: 0.9,
    predict: win(u, 0.04, 0.24) * fade,
    pick: win(u, 0.26, 0.34) * fade,
    drop: clamp01((u - 0.36) / 0.18),
    dropOut: win(u, 0.86, 0.96),
  };
};

export default defineExplainer({
  ...meta,
  stageOptions: { dof: true },

  buildScene({ scene }) {
    return buildNlp({ scene });
  },

  steps: [
    {
      id: 'console',
      heading: '1 · Text in, one word out',
      body: 'Autocomplete, translators and chatbots all run on a loop like this box. A sentence feeds in on the left: “The cat didn’t eat the fish because it was”. One word lights up on the right: stale. Nothing in between reads. Here is what it does instead.',
      hint: 'Drag to orbit · scroll to open it up.',
      camera: { position: [-2.47, 4.18, 12.25], target: [-3.64, 0.9, -0.17] },
      focus: ['One next word comes out'],
      dofAperture: 0.00002,
      onEnter: ({ handles }) => {
        handles.pose(sealed(0, 3));
        handles.setLabels('exterior');
      },
      timeline: loop(7000, (u) => sealed(u, 3)),
    },
    {
      id: 'tokenize',
      heading: '2 · Chop it into numbered pieces',
      body: 'First, a cut. The tokenizer slices the text into pieces from a fixed menu of 50,257: whole common words, or fragments of rarer ones. Watch “didn’t” split into didn and ’t. Then every piece is swapped for its number on the menu: fish is 5916, it is 340. From here on the machine only ever sees whole numbers.',
      hint: 'These are the real GPT-2 token numbers for this sentence.',
      camera: { position: [-1.31, 2.99, 7.36], target: [-2.01, 0.6, 0.08] },
      focus: ['Tokenizer', "didn't = didn + 't"],
      dofAperture: 0.00006,
      onEnter: ({ handles }) => {
        handles.pose(tokenize(0));
        handles.setLabels('tokens');
      },
      timeline: loop(6500, tokenize),
    },
    {
      id: 'embed',
      heading: '3 · Each number pulls out a row',
      body: 'The number is an address. It picks one row out of a table 50,257 rows tall, and every row holds 768 numbers learned in training. That row becomes the token’s card: each coloured cell is one of its 768 numbers. The whole table is 38.6 million numbers, and the machine hasn’t read anything yet.',
      hint: 'Pink cells are positive numbers, blue are negative.',
      camera: { position: [-1.03, 3.62, 9.03], target: [-2.12, 0.81, -0.26] },
      focus: ['768 numbers per token', 'Lookup table: 50,257 rows'],
      dofAperture: 0.00005,
      onEnter: ({ handles }) => {
        handles.pose(embed(0));
        handles.setLabels('embed');
      },
      timeline: loop(6500, embed),
    },
    {
      id: 'meaning',
      heading: '4 · Meaning is a place',
      body: 'Read those 768 numbers as coordinates and every token becomes a point in space. Training nudges the points until words used the same way sit together: animals here, spoiled food there. Even directions carry meaning. In classic word vectors, the step from man to king is the same step that takes woman to queen.',
      hint: 'Squashed from 768 dimensions down to 3 so you can see it.',
      camera: { position: [-0.06, 2.79, 3.93], target: [-0.54, 2.74, -0.22] },
      focus: ['Same step, same meaning'],
      dofAperture: 0.00012,
      onEnter: ({ handles }) => {
        handles.pose(meaning(0));
        handles.setLabels('cloud');
      },
      timeline: loop(7000, meaning),
    },
    {
      id: 'attention',
      heading: '5 · Every token looks back',
      body: 'A point on its own can’t tell which “it” you mean. So each token scores itself and every earlier token for relevance, and the scores always add up to 100%. Here “it” spends most of its attention on the two nouns it could stand for: fish and cat. Its card then blends in theirs. “was” comes later, so it is masked out.',
      hint: 'Attention percentages are illustrative. GPT-2 runs 12 of these in parallel per layer.',
      camera: { position: [-1.07, 2.94, 7.56], target: [-1.97, 1.1, -0.02] },
      focus: ['Attention from "it"'],
      dofAperture: 0.00006,
      onEnter: ({ handles }) => {
        handles.pose(attention(0));
        handles.setLabels('attention');
      },
      timeline: loop(6500, attention),
    },
    {
      id: 'layers',
      heading: '6 · Twelve times over',
      body: 'One round of attention, plus a small network that reworks each card, makes a layer. GPT-2 small stacks twelve. Every card rises through all of them, and each layer mixes in more context and reshapes the numbers. By the top, the card for “was” has soaked up the cat, the fish and the refusal.',
      camera: { position: [-0.63, 2.92, 9.45], target: [-2.08, 1.47, 0] },
      focus: ['Layer 1 of 12'],
      dofAperture: 0.00004,
      onEnter: ({ handles }) => {
        handles.pose(layers(0));
        handles.setLabels('layers');
      },
      timeline: loop(7000, layers),
    },
    {
      id: 'predict',
      heading: '7 · Score, pick, append',
      body: 'Only the last card matters now. It is scored against every row of the same 50,257-row table, and the scores become odds. “stale” comes out on top, but “too”, “full” and “rotten” are all in the running. One piece is picked, dropped onto the end of the text, and the whole machine runs again for the next.',
      hint: 'Odds are illustrative. “stale” is real GPT-2 token 39985.',
      camera: { position: [1.39, 2.49, 4.79], target: [0.65, 1.0, -0.17] },
      focus: ['Odds for the next piece'],
      dofAperture: 0.00012,
      onEnter: ({ handles }) => {
        handles.pose(predict(0));
        handles.setLabels('predict');
      },
      timeline: loop(6500, predict),
    },
    {
      id: 'run',
      heading: '8 · Predict one piece. Append. Repeat.',
      body: 'That is the whole trick, run forever: one piece at a time, each fed back in as input. A long chatbot reply is this loop run a few hundred times. The understanding you feel is geometry: points that sit close together, and tokens that pull on each other.',
      hint: 'Drag to orbit while it runs.',
      camera: { position: [-5.72, 3.72, 10.71], target: [-3.71, 1.04, -0.23] },
      freeOrbit: true,
      focus: [],
      dofAperture: 0.00002,
      onEnter: ({ handles }) => {
        handles.pose(sealed(0, 5));
        handles.setLabels(false);
      },
      timeline: loop(4000, (u) => sealed(u, 5)),
    },
  ],
});
