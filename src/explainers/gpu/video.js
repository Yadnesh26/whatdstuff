// Editorial layer for video export (scripts/render.mjs).
//
// LENS: the uncommon angle on a saturated topic. Everyone already "knows" a
// GPU is thousands of parallel cores. The part nobody says out loud is that
// each of those cores is SLOWER than a CPU core, and the whole architecture
// exists to make sure none of them ever sits idle waiting on memory.
//
// Planted loop: "they were built to never wait" (shot 2) -> "It just never
// waits" (button), which also re-primes the hook on replay.
//
// SCRIPTING: one flowing single-take voiceover; each line hands off into the
// next. Re-hook at shot 7 ("and this is where the waiting starts") is written
// to ADVANCE the loop rather than perform enthusiasm, and deliberately avoids
// the "here's the part that gets me" formula already used in another script on
// this channel. Stat isolated on its own shot.
//
// NUMBERS: every figure here is card-level (the shipping RTX 4090-class part),
// not full-die: 16,384 lanes, 128 tiles, 128 x 1536 = 196,608 threads resident.
// The floorplan shot therefore runs with NO labels, because the die insert's
// own callout reads "144 on this die" and pairing that with the card's lane
// count is exactly the mismatch the explainer review caught once already.
export default {
  hook: "Every core in here is slower than your CPU's.",

  // Declared render config (see export-content skill, step 0). captions and
  // followOverlay were both requested explicitly by name; endCard was not, and
  // absent means off.
  render: {
    formats: ['short'],
    captions: true,
    titleCard: true,
    endCard: false,
    followOverlay: true,
    captionStyle: 'bold-karaoke',
    fps: 30,
  },

  // Packaging. The title states the exact claim shot 1 opens on, so the click is
  // confirmed in word one rather than teased. It is deliberately "every core",
  // not "your GPU is slower than your CPU": the per-core claim is the true one,
  // and the blanket version is a promise the video could not cash.
  platforms: {
    shorts: {
      title: 'Every core in your GPU is slower than your CPU',
      hashtags: ['#gpu', '#graphicscard', '#howitworks', '#pcbuilding', '#engineering'],
    },
  },

  // 9:16 - ~79s at the channel voice's pace (8 beats).
  short: {
    shots: [
      {
        // Zone 1 - hook, on the whole sealed card. No callouts: the hook names
        // no part, and a clean product shot stops the scroll.
        step: 0,
        labels: [],
        camera: { position: [6.84, 6.46, 0.0], target: [0, 0.31, 0] },
        narration: "Every core in here is slower than your CPU's.",
      },
      {
        // Zone 2 - stack the second surprise and plant the loop. Repeats
        // "cores" from the hook rather than leaning on a pronoun.
        step: 0,
        labels: ['Three 100 mm fans'],
        camera: { position: [6.84, 6.46, 0.0], target: [0, 0.31, 0] },
        narration:
          'There are sixteen thousand of those cores, and they were never built to be fast. They were built to never wait.',
      },
      {
        // Zone 3 - the spoken question, over the cooler coming off. "waiting"
        // hands off from the previous line.
        step: 1,
        labels: ['The bare die'],
        camera: { position: [7.6, 6.0, -1.2], target: [0, 0.78, 0] },
        narration: 'So what does a chip like this spend its whole life waiting on?',
      },
      {
        // Zone 4a - the job that shapes the machine. Answers the question by
        // setting up the real answer.
        step: 3,
        labels: ['One shader run per pixel'],
        camera: { position: [0.82, 2.11, 5.41], target: [0, 1.72, 0] },
        narration:
          'Its whole job is one 4K frame. Eight point three million pixels, and every one needs its own tiny program to pick a colour.',
      },
      {
        // Zone 4b - THEREFORE: a crowd of small tiles, not a few big cores.
        // Labels off on purpose (see NUMBERS above).
        step: 4,
        labels: [],
        camera: { position: [1.4, 2.3, 6.4], target: [0, 1.55, 0] },
        narration:
          "Millions of pixels, all independent. So you don't want a few big cores. You want a crowd of small ones, in a grid of identical tiles.",
      },
      {
        // Zone 4c - BUT: inside a tile the lanes are not independent.
        step: 6,
        labels: ['One instruction, 32 lanes'],
        camera: { position: [0.2, 1.85, 4.2], target: [-0.34, 1.545, 0] },
        narration:
          'But inside a tile, thirty two lanes all run the same instruction on the same tick, each on a different pixel.',
      },
      {
        // Zone 4d - the re-hook, and the payoff to shot 3's question.
        step: 7,
        labels: ['This one is waiting on memory'],
        camera: { position: [1.2, 2.35, 6.8], target: [0, 1.6, 0] },
        narration:
          'And this is where the waiting starts. One trip to memory costs hundreds of cycles. So the tile parks that group and starts another on the next tick.',
      },
      {
        // Zone 5 - the stat, isolated on its own shot with a beat of space.
        step: 7,
        labels: ['The 48 warps parked here'],
        camera: { position: [-0.1, 1.85, 3.9], target: [-0.86, 1.635, 0] },
        narration:
          'Which is why the chip keeps a hundred and ninety six thousand threads loaded at once.',
      },
      {
        // Zone 6 - the everyday consequence, back on the sealed card, which is
        // where the watts and the cooler are actually visible.
        step: 9,
        labels: [],
        camera: { position: [5.18, 5.34, 0.9], target: [0, 0.31, 0] },
        narration:
          'That appetite is what needs four hundred and fifty watts and two kilos of cooler. It is also why the same chip trains AI.',
      },
      {
        // Zone 7 - button, on the freeOrbit finale. Closes the shot-2 loop
        // word for word and re-primes the hook on replay.
        step: 9,
        labels: [],
        camera: { position: [7.9, 7.4, -0.9], target: [0, 0.31, 0] },
        narration: 'It was never fast. It just never waits.',
      },
    ],
  },
};
